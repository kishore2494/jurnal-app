# Gotchas — hard-won lessons

## Deploy / git
- **Personal repos push as kishore2494**, but the macOS keychain defaults to the work account kishore-FP → plain `git push` 403s. Use:
  `gh auth switch --user kishore2494 && git -c credential.helper= -c credential.helper='!gh auth git-credential' push <remote> main && gh auth switch --user kishore-FP`
  Do NOT inline `$TOKEN` in a heredoc-quoted helper — the `\$` escaping breaks. Leave kishore-FP active afterward.
- **Two remotes**: `origin`=jurnal-app (dev), `prod`=daily-pulse (production). Push both for releases.
- **Version bump = run `tools/bump.sh`** — it moves `APP_VERSION` (app.js), `CACHE` (sw.js) and `?v=` (index.html) together; miss one and the service worker or the browser serves stale code.
- GitHub Pages takes ~30-90s to serve a push; verify with `curl … | grep "APP_VERSION = 'vNN'"`.

## Android build
- **Capacitor 7 needs JDK 21** → use Android Studio's JBR: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`. Bubblewrap's bundled JDK 17 fails ("invalid source release: 21").
- Bubblewrap's `@capacitor/assets` icon generator emitted an adaptive-icon XML referencing a missing `mipmap/ic_launcher_background`; fix by pointing `<background>` at `@color/ic_launcher_background`.
- The signing keystore + password live in `daily-pulse-android/` (`android.keystore`, `keystore-password.txt`); the back-up to-do is in backups.md. SHA-256 is in the site's `.well-known/assetlinks.json` (TWA leftover; Capacitor does not use it).
- **`USE_FULL_SCREEN_INTENT`** (full-screen alarm) is a Play-restricted permission on Android 14+ → at submission you must tick the declaration that it's an alarm/reminder app.

## Emulator testing
- The emulator `Medium_Phone_API_36.1` is **SHARED with the user's FieldOps session** — screenshots may show the wrong app; collisions happen. Use `adb -s emulator-5554`.
- Prod emulator images can't `adb root`, and shell can't trigger a non-exported `AlarmReceiver` — so native alarms can't be fire-tested from shell. Cold-booted emulator on software GPU throws "System UI isn't responding" ANRs — that's the emulator, not the app.
- **Real-phone testing is authoritative** for alarms (emulator can't mimic MIUI, can't fast-forward days). Plain notification WAS proven firing with app dead (id 424242).
- Release WebView has no devtools socket → can't inject JS to drive it. Drive via `input tap` or test the web build in the `browse` headless Chromium instead.
  **Better (2026-10-30): drive the web layer on the REAL phone through phone Chrome**, which does
  have a devtools socket: `adb reverse tcp:8471 tcp:8471`, open `http://localhost:8471/index.html`
  in the phone's Chrome, then `adb forward tcp:9222 localabstract:chrome_devtools_remote` and speak
  CDP (`Runtime.evaluate`, `Page.captureScreenshot` — the latter excludes Chrome's own UI and banners).
  Same engine family as the WebView, real width/DPR/fonts, and no native shell to rebuild. Only touch
  the localhost tab — the user's own tabs are in the same browser.

## MIUI / Redmi (the user's phone)
- Blocks `adb install` (INSTALL_FAILED_USER_RESTRICTED) → push the APK to `/sdcard/Download/` and install from the file manager's **Internal storage ▸ Download** (the category tab may not show it until media-scanned).
- Blocks lock-screen takeover by default → user must enable **"Show on lock screen"** + **"Display pop-up windows while running in background"** in the app's MIUI permissions for full-screen alarms.

## Emoji / rendering
- Avoid ZWJ sequences (e.g. 🧑‍🤝‍🧑) and heavy variation-selector emoji — they render broken/tripled on older Android. Prefer single-codepoint (👥, 💪, 💬, 📖). Default configs were cleaned in v50.

## App logic
- `renderToday()` must NOT reload the draft from storage (only `openToday()` does) or in-progress edits get wiped before save.
- `checkReminders()` early-returns in the native shell so the web layer doesn't double-ring over the native alarms.
- Force-stopping the app cancels its AlarmManager alarms — to test alarms survive, use HOME + gentle kill, not force-stop.
- The `browse` gstack daemon wedges on stale state fairly often: `kill -9 $(lsof -ti :9400); rm -f /tmp/browse-server.json` then retry.
- Local server for browser testing dies between turns; restart `python3 -m http.server 8471` in the app dir as needed.

## Not part of the app
The `*-for-*.html` / `daily-pulse-vs-*.html` pages / `factory-data.json` inside `daily-pulse-app/` are programmatic-SEO landing pages — see distribution.md ▸ SEO. Harmless to the app; don't confuse them with app code.


## MIUI / Xiaomi dark mode washes out a light WebView (RESOLVED 2026-08-19)

**Symptom:** with system dark mode ON, the whole app rendered under a uniform grey wash —
background `(165,167,170)` instead of `(243,245,250)`, modals included. With system dark
mode OFF it was perfectly clean. Ruled out first: JS errors (logcat clean), a stuck modal
(Back showed the exit dialog, so nothing was open), low brightness (raised 37→255, no
change), and a stray `values-night` directory (none exists).

**Two real theme defects, both introduced in build 106 during splash work:**
1. `AppTheme` had no `android:forceDarkAllowed` opt-out at all.
2. `AppTheme.NoActionBarLaunch` inherited `Theme.AppCompat.NoActionBar` — the **DARK**
   variant — and `AppTheme.NoActionBar` inherited `DayNight`.

**Fix** (`android/app/src/main/res/values/styles.xml`): every parent → `Theme.AppCompat.Light.*`,
and `<item name="android:forceDarkAllowed" tools:targetApi="q">false</item>` on all three
styles. Plus `WebSettings.setForceDark(FORCE_DARK_OFF)` in `MainActivity.onCreate` for
API 29-32. Shipped as **108/68**.

**The trap that cost the most time:** after installing 108 the app STILL looked dimmed.
It was a stale WebView render. The fix only shows after a genuine cold start with the
WebView HTTP cache cleared:

```
adb shell am force-stop io.github.kishore2494.dailypulse
adb shell "run-as io.github.kishore2494.dailypulse rm -rf /data/data/io.github.kishore2494.dailypulse/cache/WebView"
adb shell monkey -p io.github.kishore2494.dailypulse -c android.intent.category.LAUNCHER 1
```

Verified afterwards: clean `(243,245,250)` with `cmd uimode night yes`, stable across a
dark-mode off→on flip and a cold restart.

**Belt and braces (v120):** the default theme is now **Auto** — it follows
`prefers-color-scheme`, so if a user's phone is dark we render our own navy theme and the
OEM has nothing to force-darken. Note that because the native theme is now `Light` with
force-dark off, the WebView reports `prefers-color-scheme: light` even under MIUI dark
mode, so Auto resolves to light there; users who want dark pick it explicitly.


## Layout: the flex-shrink trap, and where screen height actually goes

**A flex row with a text label + fixed badges needs `min-width: 0` on the label.** Without it
the label refuses to shrink below its content width and *pushes its siblings out of the box*.
That is what made "skipped" overflow the habit chip. The label should be the only
`flex: 1 1 auto; min-width: 0` child; every badge is `flex: 0 0 auto`.

**`grid-auto-rows: 1fr` makes every row as tall as the tallest one.** One long wrapping label
inflated an entire habit grid. Use `auto` unless you genuinely want uniform rows.

**Measure height per card before optimising it.** The Log felt too long, and the instinct was
to shrink the visible chips. The actual culprit was ten *collapsed* deep-log sections at 79px
each (790px, 19% of the page) — each carrying full card padding, a card margin, and the h2's
bottom margin to render one title row. Collapsing them to list rows saved more than every
other tweak combined. `tools/evals/` prints this breakdown; use it.

**Run `tools/evals/run.sh` before and after any UI change.** It catches overflow, clipped
text, unreadable truncation, tiny tap targets and scroll bloat across 320/360/412px — the
class of bug that otherwise reaches the user's phone. Its README lists the two false
positives already fixed and the findings deliberately accepted.

## Two remotes, and only one of them is production (2026-08-26)

`daily-pulse-app` has **two** git remotes and they are not interchangeable:

| remote | repo | role |
|---|---|---|
| `origin` | `kishore2494/jurnal-app` | source mirror |
| `prod` | `kishore2494/daily-pulse` | **what the installed app actually loads** |

`capacitor.config.json` sets `server.url` to `https://kishore2494.github.io/daily-pulse/`,
which is the **prod** remote. `git push origin` therefore succeeds loudly and changes nothing
for a single real user. This happened: v149–v164 (analytics, trophy case, share cards) all
landed on `origin` while the live site kept serving **v146**, and every command reported
success. Nothing in git's output can tell you about it.

**Worse, `on: push` cannot be trusted either.** A push to `prod/main` landed and registered
**no workflow run at all** — the site silently kept serving the old bundle. The Pages
workflow has to be dispatched explicitly.

**Always deploy with `tools/deploy.sh`.** It pushes both remotes, dispatches the workflow,
waits for the build, then polls the LIVE url until it serves the expected `APP_VERSION`, and
exits non-zero otherwise. It refuses to run on a dirty tree. Never report something as
shipped on the strength of a `git push` exit code.

## zsh does not word-split unquoted `$VAR` (again, twice)

Bitten twice more today:
- `set -- $r` inside a `for r in "9:16 st" ...` loop left `$1` as the whole string and `$2`
  empty, so exported files were written to the wrong names and I compared **stale** PNGs
  against new code, concluding a fix hadn't worked when it had.
- `git show "$C:app.js"` applied zsh's `:a` **history modifier** to `$C`, producing
  `/Users/.../<sha>pp.js`. Version extraction silently returned zero results.

`tools/*.sh` have `#!/usr/bin/env bash`, so they are fine. It is the **interactive
Bash-tool** calls that run under zsh. For anything with word-splitting or `$var:suffix`,
wrap it: `bash -c '...'`.

## Wrong entry-field names silently disable features

`deepWork` vs `deepWorkHours` cost three separate bugs in one day:
- Two new health correlations keyed `'focus'` — not a field at all. Zero rows, no error.
- `bestEfforts()` read `e[d].deepWork` — the "Deepest focus day" record was dead for every
  real user.
- **The eval seed itself** wrote `deepWork`, so the fixture agreed with the bug and no test
  or eval run ever noticed. A fixture that shares the code's mistake hides it.

The real keys come from `DEFAULT_CORE_FIELDS` (app.js:102): `mood`, `energy`, `sleepHours`,
`deepWorkHours`, `tasksDone`, `tasksPlanned`. Grep `DEFAULT_CORE_FIELDS` before inventing a key.

## A flat fixture tests nothing

The eval seed wrote `sleepMin: 420` for **every** day — zero variance — so every sensor
correlation and all four health insights were untestable, and the code paths read as "not
firing" rather than "never exercised". A fixture needs real spread and **known**
relationships, generated from a fixed-seed PRNG so runs stay reproducible.

## Hardcoded thresholds silently exclude people

The health insights split on `steps >= 8000` and `sleep >= 420`. Anyone whose average sits
below those lines would **never** see the insight — not "rarely", *never*. Every split now
uses the user's **own median**. Absolute thresholds are only honest when the number itself is
the point (an award tier); for "your active days" they are a bug.

## Passing a function where a string is expected renders its source

`renderDash` builds `{ overview: overviewHTML, time: timeHTML, ... }[dashTab]` where those
are pre-computed **strings**. Adding `awards: awardsHTML` (a function reference) put the
function's own source text on screen, complete with visible `${...}` templates. It looked
like a template-literal escaping bug and was not.

## `prettyDate()` leads with the weekday

`prettyDate('2026-03-05')` → `"Thu, Mar 5"`. `.replace(/,.*$/, '')` — which reads like
"drop the year" — leaves a bare `"Thu"`. Two features shipped with useless dates before this
was spotted. Use `shortDate()` for compact dates; it adds the year only when it is not the
current one.

## Eval probe false positives (rounds 4 and 5)

Two more, both the same shape as the earlier three — the probe cannot see the real ground:
- **`past-viewport` inside a horizontal scroller.** Children of `overflow-x: auto` are
  *supposed* to sit outside the viewport; that is what makes them swipeable. 66 bogus errors
  the moment the Stats tab row was made scrollable. Now exempted (the page-level
  `page-hscroll` check still catches genuine horizontal scroll).
- **`contrast-invisible` on translucent layers.** The probe skipped any background with
  alpha < 0.9 and walked past it, so a chip on `rgba(255,255,255,.07)` over an
  `rgba(6,10,20,.82)` scrim was compared against the *light page body far below* → 1.10:1
  for near-white-on-near-black. Layers are now composited.

And one blind spot: **overlays were never measured at all** — the probe read the screen
behind them. A visible overlay is now the probe root, which is how the share sheet's own
40px chips surfaced. The runner also only ever measured Stats' *default* tab; it now drives
all four sub-tabs plus the share sheet.

## Awards derived on read are not automatically permanent (2026-08-27)

`earned: cur >= t` is correct for a cumulative metric and for `mode: 'peak'` over full
history — but `strength` is an **instantaneous** EMA. Ten quiet days took it 100 → 59 and the
75/90/100 badges silently disappeared, while `dp.awards` still listed them. The ledger was
written and never read back for the display decision; `awardsHTML`'s `seen` was dead code.

The fix is to union the ledger into `earned` AND carry a high-water `hi` for every progress
surface — otherwise a sticky badge renders as regressed ("100% strength", ladder says "tier 2
of 5").

## Anything derived from `habitCfg()` re-scores all of history

`awardSeries('perfect')` keyed off today's config, so **adding one habit un-perfected every
past day** and dropped four badges at once. Old entries have no key for a habit created
later, and `hVal` returns `H_MISS` for a missing key. Judge a day only against habits that
existed on it — inferred from the first date a key appears in the log, and stamped exactly
via `added: todayStr()` on new habits.

## `habitStrength`'s guard truncated the WRONG end

It bailed after 4000 **forward** steps from `dates[0]`, returning a value from ~11 years
before today as if it were current. One entry mis-dated to 2010 (the date input has `max` but
no `min`, and the Android year wheel is easy to mis-scroll) reported strength 0 and erased
every strength award. Clamp the **start** of the walk, never the end — with a 13-day
half-life anything older than ~3.3 years weighs ~1e-28. Self-healing, no migration.

## A todayStr stub must forward its argument

`addDays(str, n)` ends with `return todayStr(d)`. A test stub like `todayStr = () => fake`
therefore makes **addDays return the fake date for every input**, which silently broke a
back-dated assertion and made a working guard look broken. Always
`todayStr = x => (x ? real(x) : fake)`.

## Fill colours are not text colours

`--good` / `--bad` / quadrant colours / `--text-faint` are tuned for fills and card
backgrounds. As small text they fail WCAG: `.wow-delta.down` at 2.77:1, `coachReview`'s delta
at 2.77:1, mood-meter labels at 4.01:1, `--text-faint` at 4.27–4.43:1 on tinted grounds, and
`.scale-labels` at 2.31:1 on the share/save sheets' dark scrim. The `--*-ink` tokens exist
for text; an overlay with its own ground needs its own ink.

## A 44px hit area must not escape its parent

`.gl-del` used `margin: -12px -10px -12px 0` to grow a 44px target, which pushed the button
10px outside the card's content box (`escapes-parent`). Grow vertically with negative
margins; never sideways. For a page indicator that must *look* small, keep the button 44px
and draw the dot with an inset `::after`.

## A rule is only enforced where the test looks (2026-08-27)

`strava-build.md` documents "no loss framing" as a hard rule, and `tests/unit.js` asserts it —
on `freshHTML()` only. Meanwhile `scheduleInactivityReminder()` shipped *"a 60-second log keeps
your streak alive 🔥"*, on by default with no off switch, for weeks. Three other documented
rules were violated the same way.

When a rule is global, **grep for the pattern across the file**, not the one function you were
thinking about when you wrote the rule.

## An empty test run is a failure, not a pass

`tools/evals/run.sh` printed `errors: 0  warns: 0  PENALTY SCORE: 0  (0 = clean)` after the
browse server wedged on port 9400 and **every** boot failed — zero rows measured, reported as
perfect. This is the same success-on-failure bug the suite exists to catch in the app.
`report.py` now exits 2 below a minimum row count. Any harness that can report success without
having run needs that floor.

## Copy that quotes a number will drift (2026-08-27)

What's-new said *"54 awards across 8 families"* for a whole day after a ninth family took it to
60. Nothing broke, nothing failed a test — the app simply told users something false about
itself. Any copy stating a count must be **derived** from the source of truth, or asserted
against it. There is now a test that reads `awardList().length` / `AWARD_FAMILIES.length` and
fails on a mismatch.

## A test can pass for the wrong reason

The "trophy case labels sample data" assertion passed while the feature was broken, because
the store happened to be empty and it hit `awardsHTML`'s early return — a path that skipped
the banner entirely. Green does not mean the code under test ran. When adding a test for a
guard, make sure the fixture actually reaches the guard.

## Always compare signing certs BEFORE `install -r`

Pull the installed APK off the device and compare its SHA-256 to the new build:
`apksigner verify --print-certs`. Matching means `install -r` upgrades in place and preserves
app data; a mismatch forces an uninstall and **destroys every entry**. On a phone with real
user data this check is not optional.

## The installed app can be a whole release behind (2026-08-27)

The POCO was running native 114 but **web v206** while the live site served v208 — so
`timerPlugin()` was undefined and the app silently took the Capacitor fallback path. Every
symptom pointed at "the native plugin is broken"; the plugin was fine, the WebView was
serving a cached bundle.

The service worker is network-first and auto-reloads on `controllerchange`, but that needs a
fetch cycle. **Two force-stop + relaunch rounds** moved it v206 → v208.

Before concluding a native feature does not work, CHECK THE WEB VERSION THE APP IS ACTUALLY
RUNNING (Settings, bottom). A native/web version mismatch is the default state for a few
minutes after every deploy, and it looks exactly like a broken plugin.

## Proving a native notification ran, without seeing it

A notification channel is created lazily inside the code that posts the notification, and it
persists in `dumpsys notification`. So:

    adb shell "dumpsys notification | grep -o \"mId='dp_timer_ongoing'\""

finding the channel — with the exact name/importance/sound config from the source — proves
that code path executed, even when the notification itself is no longer live. That is often
the only evidence available on a shared device.


## A CSS change doesn't reach a browser until `?v=` changes (2026-10-30)

`index.html` loads `styles.css?v=NNN`. Edit the CSS without bumping and any browser that already
has that URL keeps the old file — the change looks like it "didn't work". Run `tools/bump.sh`, or
reload with the cache bypassed (CDP `Page.reload {ignoreCache:true}`) while iterating.

## Off-canvas elements keep painting their shadows

The menu drawer was parked at `translateX(100%)` with `box-shadow: -12px 0 40px`, so its shadow
bled ~50px into the right edge of every screen — and made the clean left gutter look like a
stripe. Closed drawers get `visibility: hidden` (delayed by the slide duration on close), which
also takes their buttons out of the tab order. Measure edges with pixels, not eyes: the "left
stripe" was an illusion caused by the right-hand shadow.

## A sticky glass header must be full-bleed

`.topbar` sat inside the 16px gutter with a gradient fading to transparent under a blur: hard
seams at both sides, a hard blur line at its bottom, and scrolled content smeared into blobs under
the title. It now spans edge to edge (`margin: 0 -16px`) on `color-mix(var(--bg) 90%)` with a
hairline that appears only once scrolled (`.topbar.scrolled`).

## The guided tour fails silently — probe it, don't eyeball it

A step whose selector matches nothing renders a full-screen dim with no highlight; nothing errors.
v246 had: step 1 aimed at `.scale` (the legacy 1–10 row, replaced by the `.mm-card` mood grid);
step 5's spotlight 389px off because `html { scroll-behavior: smooth }` animates `scrollIntoView`
and the old fixed 260ms wait measured mid-scroll; step 7's primary row absent from the default
drawer so it highlighted the whole panel and overflowed the edge; Stats steps landing on whatever
sub-tab the user last viewed. Fixes: retargeted selectors, an instant scroll + rAF poll until the
rect (top AND left — the drawer slides sideways) stops moving, viewport-clamped spotlight,
`dashTab = 'overview'` for Stats steps. Verify by comparing each step's spotlight rect with its
target's rect, started from a non-default state.

## `font: <weight> <size>/<lh> inherit` silently drops the whole rule
A CSS-wide keyword (`inherit`, `initial`…) cannot be combined with other values in a shorthand.
The declaration is thrown away at parse time with no warning, and a `<button>` then renders in
the browser's own font (Arial on Mac, Roboto on Android) at its own size and weight. Nine
styles had this until v250. Use `var(--font-ui)` (defined in :root) in shorthands; check with
`grep -nE "font: [^;]* inherit;" styles.css` — it must print nothing.


## An IndexedDB `put()` succeeding is not the write landing (2026-11-01)
A quota failure **aborts the transaction after the request's `onsuccess` has fired**. Reporting
"Photo saved" from the request handler is the same report-success-on-failure bug this app has
fixed in its localStorage savers. `mediaWrite()` resolves on `tx.oncomplete` and rejects on
`onerror`/`onabort`. Use it, or the same pattern, for any new IDB write.

## Headless tests: the What's-new popup eats the first tap after a version bump
Bumping `WHATS_NEW.v` makes the popup open 1.2 s after load. A CDP mouse click then lands on
`.wn-item`, not on the button under it, while `el.click()` from script still "works". Before
driving real taps, set `dp.whatsnew` to `WHATS_NEW.v` and remove `#wn-pop`. Also use
`behavior:'instant'` when scrolling: `html { scroll-behavior: smooth }` means
`getBoundingClientRect()` straight after a `scrollBy` still reads the old position.

## Android WebView has no text share
There is no Web Share API in the shell, and native `DaylogShare.shareImage` sends an image with
no text. A link therefore travels either inside the picture (the QR code on share cards) or
through `wa.me` / `market://`. The shell hands both to Android as intents.


## "Save on hide" plus a screen timeout means the timeout decides (2026-11-01)
Voice notes save when the page is hidden, which is right for leaving the app. But the phone's
screen timeout also hides the page, so a recording stopped at whatever the timeout was
(30 s on many phones) and nobody touched anything. Anything long-running that reacts to
`visibilitychange` needs `navigator.wakeLock.request('screen')` while it runs, released when it
ends. The same applies to the service worker's `controllerchange` → `location.reload()`: defer it
while anything is only in memory (`mediaBusyNow()`).

## Canvas `toBlob('image/webp')` can hand back a PNG (2026-11-01)
Safari's canvas cannot encode WebP. Asked for it, it returns a PNG several times the size and
raises no error. Check the returned `blob.type`, never assume it. `mediaEncode` falls back to
JPEG when the type is not WebP.

## A test that throws skips every test after it (2026-11-01)
In tests/unit.js, `document.querySelector(x).click()` on a missing element throws. That aborts
the whole IIFE, and the harness reports one "suite threw" line, not which checks failed. The
first mutation pass on v252 counted four real breaks as "missed" for this reason. Click through
`tap(sel)`, which records a failed check instead. When checking mutations, treat a non-zero
exit or "threw" as caught, not only lines containing FAIL.

## The Money screen's `.in` / `.out` are global (2026-11-01)
styles.css has bare `.in` and `.out` rules (green and red text). Any other element with class
`in` or `out` gets a coloured row. Use prefixed names (`hd-in`).

## A debounced save must be flushed before anything re-reads storage (2026-11-01)
The Log autosaves 700 ms after the last change. `loadDraft()` re-reads the entry from storage,
so before v253 any re-render inside that window (re-opening the Log, a sync pull landing,
Done after a re-render) showed the stale copy, and the next keystroke saved over the pending
text. The rule: every re-read and every exit (hidden, pagehide, update reload) calls
`flushAutosave()` first. Add any new debounced store to the same places.

## Fixed sleeps in the async tests flake under load (2026-11-01)
`await sleep(40)` after a click that starts an async chain passes on an idle machine and fails
when four timezone runs (or a reviewer's harness) share the CPU. Use `until(() => condition)`
in tests/unit-async.js, which polls for up to 2 s.

## A photo block that points at a missing photo is never pruned (2026-11-01)
Media stay on one phone; articles sync. On another phone the block's photo is "not on this
phone". Pruning it there would sync back and orphan the photo on the phone that has it.

## The emulator needs free disk (2026-11-01)
`Medium_Phone_API_36.1` refused to start ("not enough disk space") with 2 GB free on the Mac.
With no emulator, a native change can be compile-checked (`assembleDebug`) but not run.
Free space first (ask Kishore before deleting anything), or test on the phone through the
internal track.

## Sheets reads a value written from Apps Script like typed input (2026-11-01)
- A string starting with `=` becomes a formula; `+` or `-` before text is a formula parse
  error (`#ERROR!`); a leading `'` is dropped. `setValues` / `appendRow` do this too.
- So `saveState_` cutting the JSON every 45000 characters could start a piece with `-`
  (every date has one) and the next pull got broken JSON. `cut_()` now cuts only where
  neither side of the cut is one of those characters; readState_ is unchanged.
- Text the user typed goes through `text_()`, which prefixes `'` (hidden in the cell).
- `tools/check-sheet-script.mjs` runs Code.gs against a stand-in sheet with these rules,
  and first proves the stand-in reproduces the damage. It also holds the copy embedded in
  `sheets-setup.html` to the file: the page has its own copy, and nothing kept them equal.
- It pins what the script assumes about Sheets; it was never run against Google itself.

## Date-like test stamps get pruned as "older than 90 days"
- Delete records older than 90 days are dropped on merge. A test using `{ b: 200 }` as a
  delete time (200 ms after 1970) had its record pruned and failed for the wrong reason;
  use `Date.now()`-relative stamps.

## Sync review 5 (2026-11-02): the traps the item-by-item merge added
- **A stamp of "now" is a claim that this is the newest version.** `listRestored` stamped every
  restored item "now", so restoring a 3-day-old backup on a new phone made its stale copies
  beat every edit made since, on every phone. Any code that writes `dp.listAt` must stamp with
  the time the DATA is from, never the time the code ran.
- **Adopting a list whole keeps the old stamps.** With no delete record and a live stamp, an
  item missing on one side is "new here", so a delete made on a v252 phone was undone. Any
  whole-list write of a `LIST_SYNC` store must go through `listSave` (it diffs and records).
- **`cut_` must not split a surrogate pair.** Emoji are two UTF-16 units in Apps Script too;
  a cut between them came back as two replacement marks. The stand-in check now fails a
  piece that starts with a low surrogate or ends with a high one.
- **JSONP replies that do not parse** reach `window.onerror` as a bare "Script error." from
  Google's origin, or as the real SyntaxError named after the pull URL from the same origin
  (tests, a local copy). Both are the pull's failure, not a crash — guarded by `_pullsOpen`.
- **Delete records need the same expiry on both sides.** `timelogForget` pruned at 90 days
  but the merge did not, so a 200-day-old record ping-ponged with one extra push per open.

## CSS (learned in the 2026-11-15 visual pass)
- A positioned element with a glow (box-shadow/filter) paints OVER the plain cards below it unless it gets `z-index: -1` (or the cards get their own stacking context).
- `* { box-sizing: border-box }` does NOT reach `::before`/`::after`: the nav's sliding pill drifted 2px per tab until the pseudo-element got its own `box-sizing`.
- The entrance animation (slight scale-up) makes 44px buttons measure under 44px in the layout eval: switch it off while measuring (`tools/evals`).
- `<html>` carries the class `lh-top` while the Log hero is on screen. Never name a component class `.lh-top`: a row styled `display:flex` turned `<html>` into a flex box, the body grew to 720px and every screenshot came back zoomed out (the hero's row is `.lh-head`).
- An element inside the Log hero that needs taps near the top of the screen works only because the top bar is `pointer-events: none` under `html.lh-top`; anything new put in the top bar must opt back in.
- Never toggle a class that switches a `.screen`'s OWN `animation` to `none` and back: when the
  `none` goes away, the original animation (`.screen.on { animation: fade }`) starts again from
  its first keyframe, and the screen blinks. Animate the children once instead (`screenRise`).


- **Date formatting is slow per call** (2026-11-28): `toLocaleDateString(…, opts)` builds a new Intl formatter each time (~30 µs). In anything that runs per row/day, use `fmtDate(d, opts)` (cached `Intl.DateTimeFormat`).

## Caches keyed on the entries object (v279–v281)
- `weekStreak`, `loggedStreak`, `rediscoverPool`, `habitWeek` (`_wkMemo`) keep answers per `DB.entriesRO()`
  object (roParse returns the same object while `dp.entries` is unchanged). Anything else they depend on must
  be in the key or reset elsewhere: today's date, the week start (via `weekStart(todayStr())`), goals and
  schedules (`reloadCfg` resets `_wkMemo` — in a try, because reloadCfg can run before the `let`). Never mutate
  the object `entriesRO()` returns.
- `fmtDate` caches Intl formatters; the key carries `d.getTimezoneOffset()` (a formatter keeps the zone it was
  built in; after a flight with the app open dates read a day out otherwise).
