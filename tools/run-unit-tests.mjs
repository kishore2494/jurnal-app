// Run tests/unit.js headlessly, so the unit suite is something CI can fail on.
//
// Why this exists
// ---------------
// tests/unit.js holds 439 assertions against the REAL app functions, and nothing ran it. It was
// browser-only ("load index.html, then paste this into the console"), so it was absent from
// tools/deploy.sh and from CI. Two places in this repo stated the opposite as fact — the CI
// workflow said "this app is vanilla JS with no build and no unit tests", and check-release.mjs
// opened with "the app has no unit tests". Both were written in good faith and both were wrong.
//
// A suite nobody runs does not stay correct. When this was first run headlessly it reported SEVEN
// failures, and six of them were the same rot: backupBlob() started returning { data, skipped } in
// v230 — so that a section which cannot be parsed is reported rather than silently dropped — and
// the assertions still expected the old flat shape. The app was right; the tests had aged out of
// date behind a green wall of nothing checking them.
//
// How it works, and what it refuses to fake
// -----------------------------------------
// jsdom loads the real index.html with the real <script src> tags, served from disk through a
// request interceptor under a real https origin. Two earlier approaches were rejected:
//
//   * a stubbed DOM — tests/unit.js asserts document.getElementById('rate-go') EXISTS, so stubs
//     that return a truthy object make tests pass without testing anything.
//   * inlining the scripts into the HTML — that puts app.js's SOURCE into
//     documentElement.innerHTML, and one test scans exactly that for a forbidden string. It
//     failed for a reason that had nothing to do with the app.
//
// fetch() is stubbed to REJECT rather than resolve: a stub that pretends a network call succeeded
// would let a test pass on something that never happened.

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---- timezone sweep -------------------------------------------------------
//
// The suite exercises DIFFERENT CODE in different timezones, which is not obvious until it bites.
// The weekday-vs-weekend spending pattern only appears when the seeded dates land on enough of
// both, so whether that branch runs at all depends on the offset. The first CI run of this
// harness failed on exactly that: green in IST on my machine, red in UTC on GitHub, for a real
// difference in which assertions executed.
//
// Pinning one timezone would make that reproducible and permanently invisible. Running several is
// cheap — the whole suite takes about two seconds — so the sweep is the default and covers the
// date line in both directions.
const ZONES = ["UTC", "Asia/Kolkata", "America/Los_Angeles", "Pacific/Kiritimati"];

if (!process.env.DAYLOG_TZ) {
  let failed = 0;
  for (const tz of ZONES) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: tz, DAYLOG_TZ: tz },
      encoding: "utf8",
    });
    const line = (r.stdout || "").trim().split("\n").filter(Boolean).pop() || "";
    if (r.status === 0) {
      console.log(`unit tests [${tz}]: ${line.replace(/^unit tests: /, "")}`);
    } else {
      failed++;
      console.error(`\n\x1b[31m✗ unit tests failed under TZ=${tz}\x1b[0m`);
      console.error((r.stdout || "") + (r.stderr || ""));
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}
const ORIGIN = "https://daylog.test/";
const MIN_ASSERTIONS = 400;   // it was 439 when this was written; a collapse means it went blind

let jsdom;
try {
  jsdom = (await import("jsdom")).default;
} catch {
  // Being unable to run the tests is NOT the same as the tests passing.
  console.error("\n\x1b[31m✗ jsdom is not installed, so the unit suite cannot run.\x1b[0m");
  console.error("   Run `npm install` in this directory. Reporting this as a pass would recreate");
  console.error("   exactly the blind spot this harness exists to close.\n");
  process.exit(1);
}
const { JSDOM, VirtualConsole, requestInterceptor } = jsdom;

const TYPES = { js: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png" };

const noise = [];
const vc = new VirtualConsole();
// jsdom does not implement canvas or scrolling; neither is under test here.
vc.on("jsdomError", (e) => { const m = String(e.message); if (!/getContext|scrollTo/.test(m)) noise.push(m.slice(0, 160)); });

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
      return new Response(readFileSync(file), {
        headers: { "Content-Type": TYPES[file.split(".").pop()] || "text/plain" },
      });
    })],
  },
});

const w = dom.window;
w.scrollTo = () => {};
w.fetch = () => Promise.reject(new Error("network is disabled in the headless harness"));

await new Promise((resolve) => {
  w.addEventListener("load", resolve);
  setTimeout(resolve, 15000);
});

if (typeof w.hoursToHM !== "function") {
  console.error("\n\x1b[31m✗ app.js did not load — the suite would report a vacuous pass.\x1b[0m");
  noise.slice(0, 5).forEach((n) => console.error("   " + n));
  process.exit(1);
}

let summary;
try {
  summary = w.eval(readFileSync(join(ROOT, "tests/unit.js"), "utf8"));
} catch (e) {
  console.error(`\n\x1b[31m✗ the unit suite threw: ${String(e.message).slice(0, 200)}\x1b[0m\n`);
  process.exit(1);
}

// The async suite: IndexedDB, FileReader and the recorder, which the synchronous suite can only
// fake by writing into _media directly. It runs after, against an in-memory IndexedDB it brings.
const ASYNC = join(ROOT, "tests/unit-async.js");
if (existsSync(ASYNC)) {
  let a;
  try { a = await w.eval(readFileSync(ASYNC, "utf8")); }
  catch (e) { console.error(`\n\x1b[31m✗ the async suite threw: ${String(e.message).slice(0, 200)}\x1b[0m\n`); process.exit(1); }
  if (!a || typeof a.pass !== "number") { console.error("\n\x1b[31m✗ the async suite returned nothing — it went blind\x1b[0m\n"); process.exit(1); }
  summary.pass += a.pass; summary.fail += a.fail; summary.results.push(...a.results);
}

const total = (summary?.pass ?? 0) + (summary?.fail ?? 0);
if (total < MIN_ASSERTIONS) {
  console.error(`\n\x1b[31m✗ only ${total} assertions ran (expected at least ${MIN_ASSERTIONS}).\x1b[0m`);
  console.error("   A suite that shrinks silently is the failure this harness was written for.\n");
  process.exit(1);
}

if (summary.fail > 0) {
  console.error(`\n\x1b[31m✗ unit tests: ${summary.fail} failed, ${summary.pass} passed\x1b[0m`);
  summary.results.filter((r) => r.startsWith("FAIL")).forEach((r) => console.error("   " + r));
  console.error("");
  process.exit(1);
}

console.log(`unit tests: ${summary.pass} passed`);
if (noise.length) console.log(`   (${noise.length} unrelated jsdom notice${noise.length > 1 ? "s" : ""})`);

// The app sets intervals and animation frames, and jsdom keeps them alive, so node has no reason
// to exit on its own. Without this the harness PASSES and then hangs forever — which in CI is a
// job that never finishes rather than a suite that went green.
dom.window.close();
process.exit(0);
