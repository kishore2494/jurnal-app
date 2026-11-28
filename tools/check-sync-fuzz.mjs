// Fuzz the device sync: two or three phones, random edits, random sync order, and afterwards the
// phones must agree, keep every latest change, and stop pushing.
//
// Why this exists
// ---------------
// The sync is the one part of this app where a bug destroys data silently, on another phone.
// Every sync bug so far was found by hand, by somebody thinking of one interleaving: a note lost
// to the other phone's whole-list save, an un-ticked habit coming back, a deleted time block
// returning, a stale phone's time summary undoing the mood typed on the other one. There are far
// more interleavings than anyone will think of — phones offline, pulls whose reply lands after
// more edits, pushes delivered out of order, clocks that disagree. A seeded fuzz walks thousands.
//
// How it works
// ------------
// index.html + app.js are loaded into jsdom exactly as tools/run-unit-tests.mjs does (real
// <script src> tags served from disk under a real https origin), then tests/sync-fuzz.js runs
// inside that page and drives the REAL save paths and the REAL pushState / applyRemoteState. The
// phones, the fake Sheet, the clock and the invariants are described at the top of that file.
//
// Deterministic: run i uses seed SEED+i. A failing run is shrunk to the fewest operations that
// still break the same invariant, and printed with the line that replays it.
//
//   node tools/check-sync-fuzz.mjs                  default: 50 seeds from seed 1 (about 10 s)
//   SEEDS=500 node tools/check-sync-fuzz.mjs        a long run
//   SEED=1234 SEEDS=1 TRACE=1 node tools/check-sync-fuzz.mjs   replay one run, with its full trace
//   STRICT=1 …                                      known violations fail too
//   SHRINK=0 …                                      skip shrinking (faster when many runs fail)
//   DAYLOG_ROOT=<dir> …                             load another checkout (the bite proof: break a
//                                                   merge in a scratch copy and watch this fail)

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DAYLOG_ROOT ? resolve(process.env.DAYLOG_ROOT) : join(HERE, "..");
const ORIGIN = "https://daylog.test/";
const SEEDS = Math.max(1, parseInt(process.env.SEEDS || "50", 10) || 50);
const SEED = parseInt(process.env.SEED || "1", 10) || 1;
const TRACE = !!process.env.TRACE && process.env.TRACE !== "0";
const STRICT = !!process.env.STRICT && process.env.STRICT !== "0";
const SHRINK = process.env.SHRINK !== "0";
const MIN_OPS = 10;   // a run that did nothing proves nothing

let jsdom;
try {
  jsdom = (await import("jsdom")).default;
} catch {
  console.error("\n\x1b[31m✗ jsdom is not installed, so the sync fuzz cannot run.\x1b[0m");
  console.error("   Run `npm install` in this directory. A pass that was never run is not a pass.\n");
  process.exit(1);
}
const { JSDOM, VirtualConsole, requestInterceptor } = jsdom;
const TYPES = { js: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png" };

const noise = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => { const m = String(e.message); if (!/getContext|scrollTo/.test(m)) noise.push(m.slice(0, 160)); });

/* One page per CHUNK seeds. A single page grows by several MB per seed (the app's renders and
   jsdom's timers, none of which a synchronous run lets go), and 300 seeds in one page ran out of
   heap at 2 GB. A fresh page per chunk keeps a long run flat; loading one costs about 2 s. */
const CHUNK = 25;
async function runChunk(seed, seeds) {
  const dom = new JSDOM(readFileSync(join(ROOT, "index.html"), "utf8"), {
    url: ORIGIN,
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    resources: {
      interceptors: [requestInterceptor((request) => {
        const path = new URL(request.url).pathname.replace(/^\//, "");
        const file = join(ROOT, decodeURIComponent(path));
        if (!existsSync(file)) return new Response("", { status: 404 });
        return new Response(readFileSync(file), { headers: { "Content-Type": TYPES[file.split(".").pop()] || "text/plain" } });
      })],
    },
  });
  const w = dom.window;
  w.scrollTo = () => {};
  w.fetch = () => Promise.reject(new Error("network is disabled in the headless harness"));
  await new Promise((resolve) => { w.addEventListener("load", resolve); setTimeout(resolve, 15000); });
  for (const fn of ["applyRemoteState", "pushState", "flushPush", "mergeList", "mergeHabits", "canonJSON", "saveDraftNow", "persistGym", "startAct", "syncTimelogNow", "updateTimeSummary"]) {
    if (typeof w[fn] !== "function") {
      console.error(`\n\x1b[31m✗ app.js did not load, or ${fn}() is gone — the fuzz would be vacuous.\x1b[0m`);
      noise.slice(0, 5).forEach((n) => console.error("   " + n));
      process.exit(1);
    }
  }
  w.__syncFuzz = { seed, seeds, trace: TRACE, strict: STRICT, shrink: SHRINK };
  try {
    return w.eval(readFileSync(join(ROOT, "tests/sync-fuzz.js"), "utf8"));
  } catch (e) {
    console.error(`\n\x1b[31m✗ the sync fuzz threw: ${String((e && e.stack) || e).slice(0, 800)}\x1b[0m\n`);
    process.exit(1);
  } finally {
    w.close();   // jsdom keeps the app's intervals alive; without this a green run hangs forever
  }
}

const out = { seeds: 0, ops: 0, pushes: 0, fails: [], known: {}, ms: 0, checked: {}, last: null };
for (let s = SEED; s < SEED + SEEDS && out.fails.length < 8; s += CHUNK) {
  const r = await runChunk(s, Math.min(CHUNK, SEED + SEEDS - s));
  if (!r || typeof r.seeds !== "number") { console.error("\n\x1b[31m✗ the sync fuzz returned nothing — it went blind\x1b[0m\n"); process.exit(1); }
  out.seeds += r.seeds; out.ops += r.ops; out.pushes += r.pushes; out.ms += r.ms; out.fails.push(...r.fails);
  for (const [k, v] of Object.entries(r.checked)) out.checked[k] = (out.checked[k] || 0) + v;
  for (const [id, k] of Object.entries(r.known)) { const o = out.known[id] || (out.known[id] = { runs: 0, first: k.first }); o.runs += k.runs; }
  if (r.last) out.last = r.last;
}
const secs = (out.ms / 1000).toFixed(1);
const replay = (seed) => `SEED=${seed} SEEDS=1 TRACE=1 node tools/check-sync-fuzz.mjs`;

const checks = out ? Object.values(out.checked || {}).reduce((a, b) => a + b, 0) : 0;
if (!out || out.seeds < 1 || (out.fails.length === 0 && out.seeds !== SEEDS) || out.ops < MIN_OPS * out.seeds || checks < 20 * out.seeds) {
  console.error(`\n\x1b[31m✗ the sync fuzz went blind: ${out ? out.seeds : 0} runs, ${out ? out.ops : 0} operations.\x1b[0m\n`);
  process.exit(1);
}

const knownIds = Object.keys(out.known || {});
const knownLine = () => knownIds.forEach((id) => {
  const k = out.known[id];
  console.log(`   known (not failing): ${id} in ${k.runs} run(s); first seed ${k.first.seed}: ${k.first.detail.slice(0, 300)}`);
  console.log(`     replay: ${replay(k.first.seed)}`);
});

if (out.fails.length) {
  console.error(`\n\x1b[31m✗ sync fuzz: ${out.fails.length} run(s) broke an invariant (stopped after ${out.seeds} of ${SEEDS})\x1b[0m`);
  for (const r of out.fails.slice(0, 5)) {
    const sk = r.phones.filter((p) => Math.abs(r.skew[p]) > 2).map((p) => `${p}${r.skew[p] > 0 ? "+" : ""}${Math.round(r.skew[p] / 1000)}s`).join(" ");
    console.error(`\n   seed ${r.seed}: phones ${r.phones.join("")}${sk ? ", skew " + sk : ""}, ${r.ops} ops, ${r.pushes} pushes, ${r.rounds} round(s) to settle`);
    console.error(`   replay: ${replay(r.seed)}`);
    r.fails.slice(0, 4).forEach((f) => console.error(`     ${f.inv}${f.known ? " [" + f.known + "]" : ""}: ${f.detail}`));
    if (r.fails.length > 4) console.error(`     … ${r.fails.length - 4} more`);
    if (r.min) {
      const msk = r.min.phones.filter((p) => Math.abs(r.min.skew[p]) > 2).map((p) => `${p}${r.min.skew[p] > 0 ? "+" : ""}${Math.round(r.min.skew[p] / 1000)}s`).join(" ");
      console.error(`   shrunk to ${r.min.ops.length} operation(s)${msk ? " (skew " + msk + ")" : " (no skew)"}; it still fails with:`);
      r.min.fails.slice(0, 2).forEach((f) => console.error(`     ${f.inv}: ${f.detail}`));
      console.error(`   minimal trace:\n     ${r.min.trace.join("\n     ")}`);
    } else if (TRACE) {
      console.error(`   trace:\n     ${r.trace.join("\n     ")}`);
    }
  }
  if (out.fails.length > 5) console.error(`\n   … ${out.fails.length - 5} more failing runs`);
  knownLine();
  console.error("");
  process.exit(1);
}

const c = out.checked;
console.log(`sync fuzz: ${out.seeds} runs (seeds ${SEED}–${SEED + out.seeds - 1}), ${out.ops} operations, ${out.pushes} pushes; every invariant held${knownIds.length ? " apart from the known ones below" : ""} (${secs}s)`);
console.log(`   checked: ${c.items} list items, ${c.blocks} time blocks, ${c.fields} day fields, ${c.habits} habits, ${c.hnote || 0} habit notes, ${c.gym} gym keys, ${c.cfg || 0} habit-list saves, ${c.sums} time summaries, ${c.wo} gym counts`);
knownLine();
if (TRACE && out.last) console.log(`   trace of the last run:\n     ${out.last.join("\n     ")}`);
if (noise.length && process.env.SHOW_NOISE) noise.forEach((n) => console.log("     " + n));

process.exit(0);
