# Gotchas — hard-won lessons

## Deploy / git
- **Personal repos push as kishore2494**, but the macOS keychain defaults to the work account kishore-FP → plain `git push` 403s. Use:
  `gh auth switch --user kishore2494 && git -c credential.helper= -c credential.helper='!gh auth git-credential' push <remote> main && gh auth switch --user kishore-FP`
  Do NOT inline `$TOKEN` in a heredoc-quoted helper — the `\$` escaping breaks. Leave kishore-FP active afterward.
- **Two remotes**: `origin`=jurnal-app (dev), `prod`=daily-pulse (production). Push both for releases.
- **Always bump BOTH** `APP_VERSION` (app.js) and `CACHE` (sw.js) or the service worker serves stale code.
- GitHub Pages takes ~30-90s to serve a push; verify with `curl … | grep "APP_VERSION = 'vNN'"`.

## Android build
- **Capacitor 7 needs JDK 21** → use Android Studio's JBR: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`. Bubblewrap's bundled JDK 17 fails ("invalid source release: 21").
- Bubblewrap's `@capacitor/assets` icon generator emitted an adaptive-icon XML referencing a missing `mipmap/ic_launcher_background`; fix by pointing `<background>` at `@color/ic_launcher_background`.
- The signing keystore + password live in `daily-pulse-android/` (`android.keystore`, `keystore-password.txt`). **Back them up. Lose them = can't update the app ever.** SHA-256 is in the site's `.well-known/assetlinks.json`.
- **`USE_FULL_SCREEN_INTENT`** (full-screen alarm) is a Play-restricted permission on Android 14+ → at submission you must tick the declaration that it's an alarm/reminder app.

## Emulator testing
- The emulator `Medium_Phone_API_36.1` is **SHARED with the user's FieldOps session** — screenshots may show the wrong app; collisions happen. Use `adb -s emulator-5554`.
- Prod emulator images can't `adb root`, and shell can't trigger a non-exported `AlarmReceiver` — so native alarms can't be fire-tested from shell. Cold-booted emulator on software GPU throws "System UI isn't responding" ANRs — that's the emulator, not the app.
- **Real-phone testing is authoritative** for alarms (emulator can't mimic MIUI, can't fast-forward days). Plain notification WAS proven firing with app dead (id 424242).
- Release WebView has no devtools socket → can't inject JS to drive it. Drive via `input tap` or test the web build in the `browse` headless Chromium instead.

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
`daily-pulse-factory/` + the `focus-tracker-*.html` / comparison pages / `factory-data.json` inside `daily-pulse-app/` are a **programmatic-SEO landing-page generator** (separate marketing work, ~128 pages, n8n drip). Harmless to the app; don't confuse them with app code.


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

The real keys come from `FIELDS` (~line 90): `mood`, `energy`, `sleepHours`,
`deepWorkHours`, `tasksDone`, `tasksPlanned`. Grep `FIELDS` before inventing a key.

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
