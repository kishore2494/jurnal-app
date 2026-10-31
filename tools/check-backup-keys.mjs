// Every key the app stores must be either backed up or deliberately excluded.
//
// The export/import in Settings is offered inside the wipe flow, so it is the last thing
// standing between the user and losing everything. Twice now it has quietly dropped data:
// v230 found eleven of the user's own choices missing from BACKUP_KEYS, and v231 found
// dp.settings — their name, reminder time and sync URL — still missing after that sweep.
// Both times the app said "Backup restored" and the user had no way to know otherwise.
//
// The rule was written down as prose in a comment, which is why it kept being broken: nothing
// could check a comment. BACKUP_EXCLUDED turns the exclusions into a list, and this script
// holds the two to account. Add a key to neither and the release fails here.
//
// Dynamic writes are the known blind spot: keys written through helpers such as
// flagRow('dp.hapticsOff', ...) never appear as a literal argument to safeSet. Those are
// reported as unmatched entries rather than ignored, so the list cannot rot unnoticed either.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "app.js"), "utf8");

/** Pull an array literal out of the source and evaluate it (comments and all). */
function arrayLiteral(name) {
  const at = src.indexOf(`const ${name}`);
  if (at === -1) throw new Error(`${name} not found in app.js — this check has gone stale`);
  const open = src.indexOf("[", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]" && --depth === 0) return eval(src.slice(open, i + 1));
  }
  throw new Error(`unterminated ${name}`);
}

const backed = arrayLiteral("BACKUP_KEYS");
const excluded = arrayLiteral("BACKUP_EXCLUDED");
// Backup-file sections that do not live in localStorage (photos and voice notes in IndexedDB).
const extra = arrayLiteral("BACKUP_EXTRA");

// Every literal key written through safeSet() or localStorage.setItem().
const written = new Set();
for (const m of src.matchAll(/(?:safeSet|localStorage\.setItem)\(\s*['"]dp\.([^'"]+)['"]/g)) {
  written.add(m[1]);
}

const problems = [];

// A key must be in exactly one of the two lists.
const both = backed.filter((k) => excluded.includes(k));
if (both.length) problems.push(`in BOTH BACKUP_KEYS and BACKUP_EXCLUDED: ${both.join(", ")}`);

const unaccounted = [...written]
  .filter((k) => !k.endsWith("."))                       // dp.notified.<id> is a key PREFIX
  .filter((k) => !backed.includes(k) && !excluded.includes(k))
  .sort();
if (unaccounted.length) {
  problems.push(
    `written by the app but in neither list: ${unaccounted.join(", ")}\n` +
    `     Add each to BACKUP_KEYS if it is the user's data or a choice they made, or to\n` +
    `     BACKUP_EXCLUDED if it only describes this install. Silence here is how a\n` +
    `     wipe-then-restore loses data while reporting success.`
  );
}

// User data must be written through safeSet(), not raw localStorage.setItem().
//
// localStorage throws QuotaExceededError on a full phone — years of entries, images in notes.
// safeSet() catches that, warns once an hour, and returns false so the caller can decline to
// claim success. A raw setItem() throws instead: the handler dies part-way and the user's edit
// is gone with no toast, or with a crash toast that says nothing useful.
//
// v223/v224 swept the app onto safeSet and the queue recorded that as complete. It was not:
// eighteen literal writes to BACKUP_KEYS keys were still raw, plus the sync path and the
// preference toggles — dp.logsec, dp.pomohist, dp.alarmSound, dp.awards, dp.pjnames,
// dp.gapskip among them. A sweep with nothing enforcing it erodes, and there was no way to
// notice. Fixed in v234; this keeps it fixed.
//
// Install-state flags (BACKUP_EXCLUDED) may stay raw: losing "you have seen the tour" to a full
// disk costs nobody anything, and safeSet's own implementation obviously cannot use itself.
const rawUserWrites = [];
src.split("\n").forEach((line, i) => {
  const m = line.match(/localStorage\.setItem\(\s*['"]dp\.([^'"]+)['"]/);
  if (m && backed.includes(m[1])) rawUserWrites.push(`app.js:${i + 1}  dp.${m[1]}`);
});
if (rawUserWrites.length) {
  problems.push(
    `user data written with raw localStorage.setItem instead of safeSet:\n     ` +
    rawUserWrites.join("\n     ") +
    `\n     On a full phone setItem THROWS: the save is lost and the user is told nothing.` +
    `\n     Use safeSet(), which warns and returns false so the caller can be honest.`
  );
}

// Keys handled OUTSIDE the BACKUP_KEYS loop, in backupBlob() or importData().
//
// This is the blind spot that made v231's finding wrong. `settings` was special-cased on both
// sides — `{ settings: DB.settings() }` on export, a `d.settings` branch on import — since the
// first commit. It round-tripped perfectly and was invisible to a check that only reads the
// list, so the list said "missing" and I read that as "being lost". It was neither.
//
// A key handled by hand is not necessarily wrong, but it must be deliberate: it bypasses
// everything this script checks, so it has to be in BACKUP_KEYS anyway or declared excluded.
function bodyOf(fnName) {
  const at = src.indexOf(`function ${fnName}`);
  if (at === -1) throw new Error(`${fnName} not found in app.js — this check has gone stale`);
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`unterminated ${fnName}`);
}

const specialCased = new Set();
// export side: `out.foo = ...` or an object literal `{ foo: ... }` seeding the blob
for (const m of bodyOf("backupBlob").matchAll(/\bout\.([A-Za-z_]\w*)\s*=|const out = \{\s*([A-Za-z_]\w*):/g)) {
  specialCased.add(m[1] ?? m[2]);
}
// import side: any `d.foo` read that is not the loop's own `d[k]`
for (const m of bodyOf("importData").matchAll(/\bd\.([A-Za-z_]\w*)/g)) specialCased.add(m[1]);

const undeclared = [...specialCased]
  .filter((k) => !backed.includes(k) && !excluded.includes(k) && !extra.includes(k))
  .sort();
// A non-localStorage section is only a backup if BOTH sides exist. Exporting photos that the
// import never reads would be the same "Backup restored" lie this whole script is about.
for (const k of extra) {
  if (backed.includes(k) || excluded.includes(k)) problems.push(`${k} is in BACKUP_EXTRA and also in a localStorage list`);
  if (!new RegExp(`\\bout\\.${k}\\s*=`).test(bodyOf("exportData"))) problems.push(`${k} is in BACKUP_EXTRA but exportData() never writes out.${k}`);
  if (!new RegExp(`\\bd\\.${k}\\b`).test(bodyOf("importData"))) problems.push(`${k} is in BACKUP_EXTRA but importData() never reads d.${k}`);
}
if (undeclared.length) {
  problems.push(
    `handled by hand in backupBlob()/importData() but in neither list: ${undeclared.join(", ")}\n` +
    `     A key restored outside the BACKUP_KEYS loop bypasses every check here. Add it to\n` +
    `     BACKUP_KEYS (and let the loop carry it) or to BACKUP_EXCLUDED, so this script's\n` +
    `     answer matches what the code actually does.`
  );
}

// Entries that no literal write matches — either dead, or written through a helper.
const unmatched = [...backed, ...excluded].filter((k) => !written.has(k)).sort();

if (problems.length) {
  console.error("\n\x1b[31m✗ backup key coverage\x1b[0m");
  for (const p of problems) console.error(`   ${p}`);
  console.error("");
  process.exit(1);
}

console.log(
  `backup keys: ${written.size} written, ${backed.length} backed up, ${excluded.length} excluded by design, ${extra.length} outside localStorage (${extra.join(", ")}), ${specialCased.size} hand-handled` +
  (unmatched.length ? ` (${unmatched.length} written via helpers, not literals: ${unmatched.join(", ")})` : "")
);
