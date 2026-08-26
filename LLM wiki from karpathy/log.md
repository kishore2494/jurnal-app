## 2026-08-26 — 🚀 LIVE ON GOOGLE PLAY · real Health Connect auto-capture · Strava research

**Daylog is published on Google Play.** Production access granted 08-23, released 08-26.

### Health Connect auto-capture is now REAL (web v148 + bundle 112/72)
Before this, `HealthConnectPlugin.today()` returned **hardcoded nulls** for every sensor
metric — six switches in Settings ▸ Auto-tracking (Sleep, Steps, Calories, Workouts, Heart
rate) **controlled nothing**. Only screen time was ever real. That was a live defect: five
toggles that looked functional and did nothing. The Play listing luckily never claimed them.

- Added **Kotlin 2.1.0** to the project (the HC client exposes only suspend functions) plus
  `androidx.health.connect:connect-client` and coroutines.
- **`HealthReader.kt`** aggregates today's steps / distance / calories / exercise / heart rate,
  and reads **sleep over an 18-hour look-back** — a night's sleep does not sit inside today's
  calendar window, so a midnight→now query would miss it entirely.
- **Each metric is fetched independently.** One ungranted permission cannot wipe the rest.
  Absent stays **null, never 0** — "no data" and "zero steps" are different facts to the
  insight engine.
- **minSdk stayed 24.** HC declares 26; rather than dropping Android 7 users days after
  launch, we use `tools:overrideLibrary` and guard every call behind `SDK_INT >= 26`, with
  **all HC imports isolated in HealthReader.kt** so lazy class loading means old devices never
  load it. That isolation is the whole reason the override is safe.
- Manifest: 6 read permissions, the `HEALTH_PERMISSIONS` rationale alias (HC requires a
  rationale target), and the `healthdata` `<queries>` entry for pre-Android-14.
- **The web consumer side needed no rework** — `syncHealth()` already read `t.steps`,
  `t.sleepMinutes` and honoured each toggle. It was only ever receiving nulls. Added the HC
  permission flow (a separate grant from Usage access), a Connect button **gated on the native
  method existing** so older bundles don't show a dead control, and honest copy.
- APK **2.99 → 4.28 MB** (Kotlin stdlib + HC client).

**⚠️ BEFORE UPLOADING 112:** reading Health Connect data requires the **Health apps
declaration** in Play Console, and Google reviews it. Do not ship 112 without completing it.

### Strava research → `DAYLOG-STRAVA-RESEARCH.md`
5 research dimensions, **111 findings**, 53 rated *build*, 13 adversarial verifications
(2 refuted). Both research workflows hit the session limit before their synthesis agents ran,
so the synthesis was done by hand from the journals — the work was recovered, not lost.

**The finding that reshapes the roadmap, verified against our own code:** Android WebView has
**no Web Share API at all**. `saveFile()` (app.js:2665) gates on `navigator.canShare`, so
inside the shell that branch is **dead code** and a PNG falls through to a blob viewer with no
share sheet. Confirmed independently: `grep -c canvas app.js` → **0** (card rendering is
greenfield) and `@capacitor/share` is **not installed**.
So image *generation* is pure web and ships instantly; image *delivery* needs one rebuild with
`@capacitor/share`. Don't promise "share to WhatsApp" before that lands.

**Also notable:** two of Strava's most-praised mechanics — consistency-over-performance and a
forgiving streak cadence — Daylog already implements in a *more* humane form (EMA strength
score, skip state). And Strava **paywalls custom goals and most of the recap layer**, which a
free private tracker can simply give away.

### Behaviour-design audit — PARTIAL
2 of 4 research areas completed (evidence base, dark patterns) before the session limit; the
ethical-design and retention areas, all 13 verifications and the final grading did not run.
**Re-run after the limit resets** — the script is cached, so completed agents replay free:
`Workflow({scriptPath: '.../behaviour-design-audit-daylog-wf_d9f8a6cb-91a.js', resumeFromRunId: 'wf_d9f8a6cb-91a'})`

## 2026-08-26 (later) — in-app alarm sound picker · web v146 + bundle 111/71

Kishore asked for an in-app sound change, in the Customize section. Built it using
**Android's own ringtone picker** rather than bundling audio: the user gets every alarm tone
already on their phone plus their own files, at zero app-size cost and with no licensing
questions.

**Design point worth keeping:** the chosen tone lives in **SharedPreferences**, not in the
WebView, because both `AlarmActivity` *and* the fallback notification channel must read it
while the app process is dead. That also means **this is the only native change the sound
feature will ever need** — the web layer can change tone/vibration freely from here on.

- `pickAlarmSound()` → `ACTION_RINGTONE_PICKER` on the alarm stream, via `@ActivityCallback`
- `getAlarmSound()` / `setAlarmSound()` → tone, display name, vibrate flag
- `previewAlarmSound()` / `stopPreview()` → hear it before committing
- `AlarmActivity` plays the chosen tone and honours the vibrate switch
- Web: **Customize ▸ Alarm sound** — current tone, Choose, Preview/Stop, vibrate toggle,
  reset to phone default; degrades to an explanatory hint in a browser tab

**Android gotcha handled:** a `NotificationChannel`'s sound is **frozen at creation** — you
cannot change it later. So the audible channel's id is derived from
`hash(soundUri + vibrateFlag)`, and stale `dp_alarm_audible*` channels are deleted on each
fire. Without this, changing the sound would silently keep ringing the old one through the
fallback path (the path that matters most on Android 14+).

**Verified:** every JS path in the harness (pick / preview / stop / vibrate toggle / reset /
browser fallback), 55/55 tests, 17 screens clean; 111/71 builds, installs on the POCO
(versionCode confirmed 111), launches with zero logcat errors, and
`ACTION_RINGTONE_PICKER` resolves to 12 activities on-device.
**Not yet verified:** the picker round-trip by hand on a real device — both phones went to
sleep and stopped responding to `KEYCODE_WAKEUP` before I could tap through it.

### ⚠️ Another session is committing to this repo
Commits `740e0b1` and `5894c0e` ("PIS sync — push your days straight into the Personal
Intelligence System", plus its own v144 bump) were made by a different session, not me. They
are ancestors of my HEAD so nothing was lost, but **assume concurrent edits**: my What's-new
insert failed once because its anchor text had moved. Re-read `app.js` before anchored edits,
and prefer `tools/bump.sh` over hand-editing versions.

**Pages deployment lock recurred again** (74cd465 failed: "in progress deployment ... cancel
0b7c15a first"). One `workflow_dispatch` re-dispatch fixed it, as documented.

## 2026-08-26 — ALARM FIX VERIFIED ON ANDROID 15 (Samsung SM-M146B) — the platform that was broken

Tested 110/70 on Kishore's personal Samsung Galaxy M14 (SM-M146B, **Android 15 / API 35**),
paired over wireless debugging. This is the first test on a platform where the bug can
actually reproduce — the POCO and realme are both Android 11, where `canScheduleExactAlarms()`
does not exist and exact alarms are always granted.

**Every one of the three fixes was proven load-bearing, in one run.**

1. **The bug condition was present.** `canScheduleExactAlarms()` returned **false** — the app's
   own warning card appeared in Settings ("need one more tap" / "Exact alarms are not
   allowed"). So the new health check correctly detects the real-world denial.

2. **`setAndAllowWhileIdle` fired while the phone was dozing.** The registration showed
   `type=RTC_WAKEUP`, `window=+44s`, and critically **`flags=0x20` (FLAG_ALLOW_WHILE_IDLE)**
   with `policyWhenElapsed: device_idle=--` — Doze was not deferring it. Phone was locked and
   `mWakefulness=Dozing` for ~100s, then:
   `13:56:15.226 Received BROADCAST ... act=...ALARM.399 cmp=.../.AlarmReceiver`
   The 109 `setWindow()` version would have been held until the screen came on — exactly the
   reported symptom.

3. **Android 15 blocked the direct activity launch, as predicted:**
   ```
   E ActivityTaskManager: Background activity launch blocked!
     [... intent: .../.AlarmActivity ... resultIfPiSenderAllowsBal: BAL_BLOCK]
   E ActivityTaskManager: Abort background activity starts from 10615
   ```
   With 109's silent channel that would have been **total silence** — the tester's exact
   experience. Instead the notification went out on **`channel=dp_alarm_audible`**
   (`category=alarm`, `HIGH_PRIORITY`, USAGE_ALARM sound + vibration), and its full-screen
   intent then launched AlarmActivity anyway: screen went **Awake**, `AlarmActivity` resumed.

**Conclusion: the chain now degrades correctly at every step.** Doze → fires anyway;
direct launch blocked → notification still rings; FSI available → screen takes over.

### Incidental findings on that phone
- It had **versionCode 2 / name 47 from 2026-07-19** installed — an early Capacitor build with
  **zero alarm components**. Alarms could never have worked there, independent of the bug.
- **Signing keys matched** (`144d1f76…d728`, verified by pulling the installed APK and
  comparing), so `install -r` upgraded in place and preserved data. Checked *before* installing,
  precisely because a mismatch would have forced an uninstall and destroyed his entries.
- The phone was **100% full** (453 MB free of 110 GB) and refused the install. Freed **8.14 GB**
  by deleting only provably-junk Samsung diagnostics: `/sdcard/log/ewlogd` (2,498 rolling logs
  spanning 2024-05 → 2026-08) and `/sdcard/log/batterystats` (2024 dumps).
  **Did NOT touch the "Telegram cache" he asked about** — inspection showed the 13.6 GB is in
  `files/Telegram/` (7.7 GB `Telegram Video`, 5.9 GB `Telegram Files`), i.e. **saved media, not
  cache** (actual cache was 1 MB). Clearing it would have deleted his videos, so it was left
  alone and reported instead. His login was never at risk either way — Telegram's session lives
  in internal `/data/data`, unreachable from `/sdcard`.

### Test-harness lessons
- **Wireless debugging on Android 11+ uses a random port**, so scanning 5555 never finds it.
  `adb pair <ip>:<pairport> <code>` then it appears as an `_adb-tls-connect` device.
- A MAC address is useless for this, and Android randomises it per network anyway. The one
  Kishore sent was the **router's second radio** (one digit off `192.168.1.1`'s MAC).
- Don't blind-tap a personal phone. Coordinate guesses opened a date picker, a Google search
  and his work app's login screen before I switched to reading bounds from `uiautomator dump`.
- `$UID` is read-only in zsh — using it as a variable name kills the shell.

### Documentation (Kishore's request)
`guide.html` grew from 12 to **19 sections**, adding every feature shipped since v119: today
ring, On this day, mood grid + emotion words, counted habits, skip days, habit strength, habit
ideas, **the exact-alarm permission and what happens without it**, boot survival, OEM autostart
guidance, Year in Pixels, journal prompts, Log-section reordering, Auto theme, Focus/Waves/Gym,
next-day mood effects. Also fixed pre-existing duplicate section numbers (two 8s and two 9s)
and gave text-only sections a `.full` class so they aren't squeezed into the 220px screenshot
column.

## 2026-08-23 — tester on Android 16: alarm silent while asleep + invisible Snooze button

Two real bugs from one test session on an Android 16 phone. Web **v143**, bundle **110/70**.

### 1. "I set the alarm, turned the phone off, nothing happened; I turned it on and the alarm appeared"
That sentence is the whole diagnosis. Two independent faults stacked:

**a) The fallback did not pierce Doze.** 109 fell back to `setWindow(RTC_WAKEUP, at, 10min)`
when exact alarms are denied. **`setWindow` is deferred by idle maintenance** — the alarm sat
there until the device left Doze, which is exactly what happens when you turn the screen on.
Hence "nothing, then it fired the moment I woke it".
**Fix: `setAndAllowWhileIdle()`.** Still inexact (OS rate-limits to ~1 per 9 min per app) but
it *does* fire while dozing, and needs no permission.

**b) The sound lived in the Activity.** `AlarmReceiver` chose the silent channel whenever
`canUseFullScreenIntent()` was true, assuming `AlarmActivity` would open and ring. On Android
14+ **having the permission is not the same as being allowed to launch** — OEM keyguard policy
and background-activity-start rules can still refuse, and then nothing makes any noise at all.
We already had proof of this on the POCO, where MIUI logged
`MIUILOG- Permission Denied Activity KeyguardLocked` and only the FSI notification got through.
**Fix: always post on the audible channel** (`dp_alarm_audible`, USAGE_ALARM sound +
vibration). The notification is now the guaranteed delivery path; `AlarmActivity` cancels it in
`onCreate` when it does win, so the two never overlap.

**Rule: never let the only audible path depend on an Activity that the OS may refuse to start.**

Also fixed: snooze called `setAlarmClock()` directly, which throws on Android 14+ — it now
routes through `scheduleOne()` and inherits the same permission check and fallback.

**Proactive permission ask.** The passive warning card was not enough — the tester never saw
it. `maybeAskExactAlarm()` now fires right after a reminder is saved, once per install, with a
one-tap deep link, plus a `visibilitychange` re-check so returning from system settings
refreshes the state.

### 2. Snooze button invisible in light mode — a CSS specificity collision
`:root[data-mode="light"] .btn-ghost` (specificity **0,3,0**) beat
`.alarm-btns .btn-ghost` (**0,2,0**) and applied `background:#eef1f7`, while the overlay's
`color:#fff` still applied. **White on near-white, ~1.1:1.** Invisible. It only reproduced in
light mode, which is why every earlier on-device test (navy theme) missed it.
Fixed with id specificity (`#alarm .btn-ghost`, 1,1,0) so no theme rule can reach it. Now
4.86:1 in light, navy and black alike.

### That bug class is now caught mechanically
Added a **WCAG contrast check** to `tools/evals/checks.js`. It immediately exposed a systemic
problem: `--warn`, `--good`, `--bad` and `--accent` were tuned for the dark theme and **never
given light-mode values**, so the 🔥 streak number sat at **1.48:1** on light chips, and
counters/totals/deltas at 2.7-3.1:1.

Fix: separate **`--good-ink` / `--warn-ink` / `--bad-ink` / `--accent-ink`** tokens for TEXT,
with dark light-mode values (`#047857`, `#a3560c`, `#b91c1c`, `#3b5bdb`). The fill colours are
unchanged, because they pair with hard-coded dark glyph colours on `.check` elements — a
straight retint would have broken those. Also darkened light `--text-faint` #8b95ab → #6b7280
(3.01 → ~4.8:1).

**Probe false positive worth remembering (the third one):** a gradient background reports
`backgroundColor: transparent`, so the first version walked past it and reported white-on-white
**1.00:1 for all 19 gradient buttons**. It now returns null and skips when any ancestor paints
a background-image.

**Eval movement:** 80 errors / penalty 3524 → **8 errors / 923**, contrast-invisible **72 → 0**,
contrast-low **621 → 42**. The 8 remaining errors are the previously documented tap-target
cases. 55/55 unit tests.

## 2026-08-23 — PRODUCTION ACCESS GRANTED

Applied 2026-08-22 21:07, granted within a day. Open testing is now available too.
Production track is still Inactive — access is a permission, not a release.

**Next action: create the production release from 109 (69).** Not 108 — it still has the
alarm bug, and version codes only increase, so shipping 108 would require an immediate
follow-up update.

**Recommendation recorded: staged rollout rather than 100%.** The alarm fix is verified
firing on the POCO (Android 11) and verified in the shipped dex, but the Android 14+ path —
the only place the original bug exists — has never been confirmed on a real device, because
Android 11 cannot reproduce it. A low initial percentage limits exposure if that path is
still wrong; ramp after a real Android 14+ confirmation.

## 2026-08-22 — applied for production access (109/69 in review)

Rolled out **109 (69)** to the closed "Alpha" track (in review at time of writing) and
**submitted the production-access application at 21:07**. Google reviews the form and emails
the owner, "usually 7 days or less". Production track is still Inactive.

**Critical when access is granted: promote 109, not 108.** Only 108 is currently promotable
(109 was still in review), and 108 contains the alarm bug. Version codes must increase, so
promoting 108 first would ship the bug *and* force an immediate follow-up.

**"Apply for production" does not release anything** — it is an eligibility/permission
request only. The build is chosen later, at the promote step. Applying while 109 was in
review was deliberate: the two reviews run in parallel instead of serially.

### Production form answers (field limit is 300 CHARACTERS, not words)
- **Recruit:** friends/family/colleagues, direct, no paid provider; opt-in link over WhatsApp
  and in person, targeted at people who would genuinely use a daily tracker.
- **Ease of recruiting:** "Difficult" (multiple choice) — installs were reachable but keeping
  testers opted in and actually logging daily took repeated follow-up and per-person help
  with the opt-in flow.
- **Engagement:** ~5-6 daily users giving repeated detailed feedback; the rest intermittent.
  Noted that defects like reminders-not-firing only surface after several consecutive days.
- **Feedback + collection:** in-app form, chat, in person. Fixes listed: Android 14+ reminders,
  navigation rebuild, cramped text, voice typing, PDF export, MIUI theme.
- **Audience:** adults wanting a private offline tracker, no account, uneasy about cloud
  wellbeing apps.
- **Value:** one offline app replacing several trackers, with on-device insights (sleep sweet
  spot, which habits lift mood, peak focus hours, screen-time cost); nothing uploaded or
  paywalled.
- **Expected first-year installs:** 0-10K (honest: niche, no ads, organic only).
- **Changes from testing / readiness:** as above, plus 55 unit tests, layout evals at
  320/360/412px, and on-device verification.

### The one gap to close
The alarm fix is verified on the POCO (Android 11) but **not on Android 14+**, which is where
the original bug lives — Android 11 cannot reproduce it. The tester who reported it should
confirm on 109. Worth closing before any reviewer follow-up.

## 2026-08-21 (later) — alarm fix VERIFIED on the real POCO (109/69)

Tested on the POCO C31 (`VWQCY5HEYHUCYPZP`, Android 11, MIUI) over wireless adb. The cabled
realme was excluded throughout.

**Result: the native alarm fired over the locked screen.** Timeline from `dumpsys`/logcat:

- `FullScreenAlarm.schedule()` registered `*walarm*:io.github.kishore2494.dailypulse.ALARM.399`
- It was accepted as a real **exact alarm clock**: `window=0`,
  `expectedWhenElapsed == maxWhenElapsed`, and it showed up as the OS's
  **"Next alarm clock information"** *and* **"Next wake from idle"** — i.e. Doze-exempt
- Phone: Asleep → Dozing → at `12:32:00.470` the receiver ran, screen went **Awake**,
  `AlarmActivity` became the resumed activity, logcat shows
  `Activity requesting to dismiss Keyguard`
- Audio device left standby while ringing, and returned to standby after dismissal
- The user's 8 real reminders were still scheduled afterwards — the test did not disturb them

**Both notification channels were created exactly as designed**, and the *correct* one was
chosen: on Android 11 `canUseFullScreenIntent()` is true, so the notification went out on the
quiet `dp_fullscreen_alarm` channel and let AlarmActivity own the sound. The fallback channel
`dp_alarm_audible` exists with `sound=content://settings/system/alarm_alert`,
`usage=USAGE_ALARM`, `vibration=[0,500,300,500,300,500]`.

### The most valuable thing this test revealed
MIUI **blocked** the receiver's direct `startActivity()`:

```
W ActivityTaskManager: Background activity start [... isBgStartWhitelisted: false ...]
D ActivityTaskManagerServiceInjector: MIUILOG- Permission Denied Activity KeyguardLocked
```

…and then a **second** START succeeded 400 ms later — that was the **full-screen-intent
notification** path. So on MIUI the FSI notification is what actually delivers the alarm; the
direct activity start is decorative.

**This is the proof that the Android 14+ fallback matters.** On Android 14+ a tracker does not
get `USE_FULL_SCREEN_INTENT` auto-granted, so *both* of those paths fail — which is precisely
the tester's bug — and the only thing left is the notification itself. That is exactly why the
audible `dp_alarm_audible` channel was added. Without it the "alarm" on his phone would be a
silent, non-vibrating notification even after the exact-alarm permission is granted.

### Test-harness notes (for next time)
- `AlarmActivity` is `exported=false`, so `am start` from adb is refused — drive it through the
  app's own **"⏰ Test full-screen alarm (1 min)"** button (`rem-fs-test`), which is the only
  control that exercises the native plugin. **"Test in 15 sec" is JS-only** (`setTimeout` +
  `fireAlarm`) and dies when the screen sleeps — it proves nothing about the native path.
- `BOOT_COMPLETED` is a protected broadcast; shell cannot send it, and `MY_PACKAGE_REPLACED`
  was not delivered to a manifest receiver either. **BootReceiver still needs a real reboot to
  verify** — it is registered on-device (confirmed in `dumpsys package`) but unproven at runtime.
- In `dumpsys alarm`, grep the **tag** (`*walarm*:<pkg>.ALARM.<id>`), not the intent action.
- Drive the UI from `uiautomator dump` bounds, never fixed coordinates — blind taps here opened
  a date picker, a Google search, and the user's work-app login before I switched.
- zsh does not word-split unquoted `$VAR`; `set -- $R` kept "305 286" as one argument and the
  tap silently failed. Use `awk` to split.

### Still unverified
An alarm ringing on **Android 14+** — the POCO is Android 11, where `canScheduleExactAlarms()`
does not exist and exact alarms are always granted, so the original bug cannot reproduce there.
That confirmation has to come from the tester's own phone on build 109.

## 2026-08-21 — ALARM BUG (tester report) — root-caused and fixed · web v139 + bundle 109/69

A tester said his alarm never fired. It was real, and it was three stacked defects. All
required a native rebuild — **bundle 109/69 must be uploaded**; the web part is v139.

### 1. The actual cause: SCHEDULE_EXACT_ALARM is denied by default on Android 14+
We target SDK 36 and declare `SCHEDULE_EXACT_ALARM`. On **Android 14+ (API 34) that
permission is NOT granted at install** — the user has to toggle "Alarms & reminders" in App
info. `AlarmManager.setAlarmClock()` without it throws `SecurityException` on API 31+.

The old `FullScreenAlarmPlugin.schedule()` had ONE try/catch around the whole loop, so:
- the first alarm threw → **every remaining alarm was skipped**, and
- `cancelAllInternal()` had already run → **previously working alarms were wiped too**, and
- JS did `if (nativeShell()) { scheduleNativeAlarms(); ... }` — **discarding the result** —
  and `scheduleNativeAlarms()` itself ended in `catch (e) { return false; }`.

Net effect: the user sets an alarm, sees a success toast, and nothing ever rings. Perfectly
silent failure at three layers.

**Fix:** check `canScheduleExactAlarms()`; when not allowed fall back to
`setWindow(RTC_WAKEUP, at, 10min)` — inexact but it *fires*. Per-alarm try/catch so one
failure can't take out the batch. `schedule()` now returns
`{scheduled, exact, failed, exactAllowed, fullScreenAllowed}`.

**Deliberately NOT using `USE_EXACT_ALARM`** (which is auto-granted): Play restricts it to
apps whose core function is an alarm clock or calendar, and a habit tracker claiming that is
a policy risk.

### 2. Alarms did not survive a reboot
No `RECEIVE_BOOT_COMPLETED`, no boot receiver. Restart the phone → every pending alarm gone
until the app was next opened. The alarm list lives in the WebView's localStorage, which a
receiver cannot read, so `schedule()` now mirrors it into SharedPreferences and the new
`BootReceiver` replays it on `BOOT_COMPLETED` / `QUICKBOOT_POWERON` / `MY_PACKAGE_REPLACED`.

### 3. The fallback alarm was silent
On Android 14+ the full-screen intent is only auto-granted to real alarm/calling apps — ours
is declared "Other", so we don't get it. Android 10+ *also* blocks the receiver's direct
`startActivity()`. So the notification IS the alarm on those phones — and its channel had
`setSound(null,null)` + `enableVibration(false)`, because `AlarmActivity` was assumed to own
the sound. Result: a silent, non-vibrating "alarm". Added a second channel
(`dp_alarm_audible`, `USAGE_ALARM` sound + vibration pattern) used when
`canUseFullScreenIntent()` is false, and `setOngoing` is now conditional on FSI so no stuck
notification is left behind.

### 4. The user could never find out — now they can
New `dp.alarmHealth` + `FullScreenAlarm.status()` + a warning card on Settings ▸ Reminders
that appears **only when something is actually wrong**, each line with a one-tap **Fix**
button deep-linking to `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` or the app's notification
settings. Xiaomi/Redmi/POCO/realme/OPPO/vivo/OnePlus phones additionally get an Autostart +
battery-restriction hint, since those OEMs kill alarms regardless of permissions.

**Rule learned: a scheduling API that can be silently refused must report back, and the
caller must not discard the result. Never `catch { return false }` on a user-visible
promise.**

**Verified:** APK 109/69 builds clean, `RECEIVE_BOOT_COMPLETED` + BootReceiver +
BOOT_COMPLETED filter confirmed merged in the built manifest, signature matches the release
keystore, all four banner states correct (exact denied / notifications off / all healthy /
Fix button calls the right native method), 55/55 unit tests, layout eval unchanged at 8
errors, all 17 screens clean.

**Still needs a real-device check** of an actual alarm firing on an Android 14+ phone — the
POCO was off-network and the only adb device was the cabled Realme, which must not be touched.

## 2026-08-19 (v131-v137) — layout eval suite; habit chip overflow + Log height fixed

Kishore reported "skipped" overflowing the habit chip and the chips being too tall. Rather
than eyeball it, built **`tools/evals/`** — a scored layout probe run across 3 phone widths
x 16 screens (48 combos) with deliberately adversarial seed data. See its README.

**Baseline 103 errors / penalty 1684 → 8 / 797.** Every real breakage class now zero:
`escapes-parent` 50→0, `past-viewport` 10→0, `text-clipped` 10→0, `escapes-parent-left` 4→0,
`tap-tiny` 33→8 (the 8 are documented accepted cases).

### Root cause of the reported bug — a flex-shrink mistake
`.habit` is a flex row; its label `<span>` had **no `min-width: 0`**, so it refused to shrink
below its content width and pushed the "skipped" badge and the streak badge out of the chip.
Fix: the label is the only flexible child (`.hlbl`, `flex:1 1 auto; min-width:0`) and every
badge is `flex: 0 0 auto`.
**Rule: in a flex row with a text label plus fixed badges, the label needs
`min-width:0` or it will push its siblings out of the box.**

Two more, found by the probe rather than reported:
- `.habits` used **`grid-auto-rows: 1fr`**, so ONE wrapping label inflated *every* row in the
  grid. That was the real height multiplier. Rows now size independently.
- Quantity chips cannot fit check+emoji+label+counter+button in a 143px half-column at any
  font size — they now take a full row (`grid-column: 1 / -1`).
- Dropped the "skipped" word: the ⤳ glyph + dashed border + greyscale already say it.

### The height win was not where it looked
Measured the Log's height budget per card instead of guessing. The biggest block was **the
deep log: ten COLLAPSED sections at 79px each = 790px, 19% of the page, to show ten title
rows** — full card padding (17px) + card margin (14px) + the h2's own bottom margin, all
while displaying nothing. Collapsed sections now read as list rows (52px). Plus chip padding
12→9px and min-height 52→46px. **Net: Log -10% at 320/360px, -13% at 412px.**

### A judgment call worth recording
Kishore suggested smaller text to keep two habit columns. Measured it: at 360px a 2-up chip
leaves ~43px of label, and no readable font size fits "No phone in the first hour" in 43px —
even a 2-line clamp cut it. So the grid goes **single-column below 400px**. Costs ~0.13
screens; a habit tracker whose habit names are unreadable is worse. Verified 0/7 truncated
labels at 320/360/412/480.

### Two probe false positives it took a round to learn
1. `text-overflow: ellipsis` legitimately makes `scrollWidth > clientWidth` — v1 flagged every
   correctly-truncating label. Now reports `label-squeezed` only when the width left is
   genuinely unreadable.
2. An `<input>` inside a `<label>` inherits the label's clickable area; measuring the 18px
   checkbox alone was wrong.

### CSS class collision found (third one in this codebase)
`.habit` is shared by the Daily-checklist chips **and** the deep-log `checksField` chips (24
`.habit` elements on the Log, only 7 with labels). Harmless here — both wanted the same
padding/height — but it's the same trap as `.tb-row` (timebox vs throwback). **Still true:
grep styles.css before naming a class.**

Also fixed from eval findings: `.scale` clipped the "10" at 320px; `.act-chip` emoji squeezed;
`.seg-btn` clipped (icons hidden ≤360px); history mood pills escaped their row; 25x16 text
links and 13x13 checkboxes untappable; Waves range slider had a 16px grab area.

**Verified:** 55/55 unit tests, all 17 screens error-free, boolean tap-cycle and the quantity
counter still correct after the markup change. **NOT verified on device** — the POCO was off
the network and the only adb device present was the cabled Realme (`0461B081222138A5`), which
must not be touched.

## 2026-08-19 (v130) — sync UI hidden for production; deploy-lock recurrence note

`SHOW_SYNC=false` shipped (production checklist item #1 done — the Settings sync/login card
is hidden so the "collects no data" Data Safety answer stays unambiguous; a saved `syncUrl`
keeps working silently). 

**Deploy-lock note:** the Pages deployment lock recurred — two pushes ~30 min apart, and the
second Actions run failed with "in progress deployment, cancel <prev-sha> first". No cancel
needed: by the time you react the lock has usually released, so just **re-dispatch**
(`POST /actions/workflows/pages.yml/dispatches {"ref":"main"}`) and it deploys clean. If a
run fails with that error, re-dispatch once before investigating anything else.

## 2026-08-19 (later) — sync plan REVISED to Kishore's design

Kishore overruled the sync-code/zero-knowledge design, correctly: normal users lose secret
codes, and a lost code = lost data. **Decided:** Google Sign-In (native one-tap) →
pay-what-you-want monthly sub (₹9/₹49/₹99, identical feature — "pick what it's worth") →
sync pauses on lapse. One exception negotiated in: **lapsed users can always restore
(read-only) their cloud copy** — guards the broken-phone case that generates Journey's worst
reviews. Accounts trigger Play's mandatory account-deletion requirement (in-app + web) —
scheduled for phase 1. Full spec in roadmap.md.

## 2026-08-19 — sync architecture decided (plan only, nothing built)

Replaced the old "Firebase accounts" roadmap item with a concrete design: **zero-knowledge
encrypted-blob sync on a Cloudflare Worker + R2** — no accounts, the sync code is the login
(hash = storage key, PBKDF2 = encryption key), one opaque blob per user, existing
`applyRemoteState` merge reused unchanged, `If-Match: rev` optimistic concurrency. Billing via
Play Billing + RevenueCat later. Full rationale and phases in `roadmap.md`. Two launch notes:
`SHOW_SYNC` is still `true` in app.js and must go `false` before production; the Data Safety
form changes in the same release that ships sync.

## 2026-08-19 (v129) — quantity habits, habit gallery, journal templates, mood-word highlight

The last big functional gap from `competitors.md` (#3 "quantity habits with At least /
Exactly / Less than" — HabitNow's differentiator) plus two cheap wins, shipped as one batch:

- **Counted habits.** A habit may carry `goal: {n, cmp:'atleast'|'atmost', unit}` in
  `dp.habitcfg`. Its day value is then a **number** (the count); `hVal()` interprets it
  against the goal, and a cached `goalFor()` map keeps the per-day loops fast (the cache
  invalidates in `reloadCfg()`). The Log chip becomes a tap counter: tap +1, − to undo,
  and "at most" chips get a **0** button to log a clean zero (absent ≠ zero: an unlogged
  day is a miss, so streaks aren't free). Exceeding an at-most limit shows red.
  `habitStrength()` now uses **fractional credit** (`hFrac` = min(1, n/target)), Loop's
  partial-credit model — verified: 20 days at half target scores 33 vs ~65 for full.
- **Important data-model note:** for goal habits, a stored `0` means *count zero*, NOT
  skip — `hVal` checks the goal first, so the legacy `0 = skipped` boolean encoding is
  untouched. Quantity habits have no skip state in v1.
- Converted the last raw `e[d].habits[key]` truthy checks (day-detail hb(), discipline,
  weekly counts, search index, PDF report) to `hVal()` — a count of 3 below target no
  longer reads as "done" in secondary stats. Zero raw checks remain.
- **Habit ideas gallery** (`HABIT_PRESETS`, ~20 curated across Health / Mind /
  Productivity / Cut down) — "✨ Browse habit ideas" under the checklist. Kills the
  empty-state stall; the Cut-down section makes at-most goals discoverable.
- **Goal editor** — revived the orphaned `habits` Customize page (it existed but was
  removed from `CUSTOM_PAGES`) and added a 🎯 button per row → at-least/at-most + n +
  unit editor.
- **Journal templates** (Daylio paywalls these): Gratitude / Brain dump / Highlights /
  Idea chips above the journal box, appending with a blank line between.
- **Bug (Kishore):** mood-grid words wrote the #tag but never highlighted. Words now
  render filled with the quadrant colour when their tag is in the journal, and tap
  **toggles** — second tap removes the tag.

Verified: gallery add → 8-tap water counter → done at target; − undoes; coffee ≤2 flow
(unlogged=miss, 0=done, 2=done, 3=miss+red); goal editor save/remove; boolean cycle
unchanged; word highlight round-trip; 55/55 tests; 17 screens error-free.

## 2026-08-19 (v127) — the Log screen is now fully customizable

Kishore: "the log screen customization was not fully customizable." Correct — **Customize ▸
Log screen fields** only ever covered `coreCfg` *fields* (mood, energy, sleep, reflection
questions). The Log's *cards* — Tasks, Daily checklist, Workout, Health, Reflection, Deep log,
Sunday review — were hard-coded in `renderToday()` and could not be hidden or reordered at all.

**New: `dp.logsec` + Customize ▸ Log screen sections.** `renderToday()` no longer contains a
fixed template; it builds a `SEC` map of section-id -> HTML thunk and emits
`logSecCfg().filter(!hidden).map(...)`. Eleven sections, drag to reorder (reuses `enableDrag`),
eye button to hide. `core` carries `lock: true` — reorderable but not hideable, since that card
holds the entry itself.

`logSecCfg()` merges the saved order with `LOG_SECTIONS_DEF`, so **a section added in a future
release automatically appears at the end of an existing user's saved order** instead of
vanishing. That merge is the important part — a naive `saved || default` would silently drop
new sections for everyone who had ever reordered.

**Removed a second source of truth.** v126 shipped ring / On-this-day / mood-grid visibility as
three separate `dp.*Off` localStorage flags. Those are now section flags in `dp.logsec`, with a
one-time migration (`dp.logsecMigrated`) that folds any existing `*Off` flag in and deletes it.
Settings ▸ Log screen widgets stays as a convenience shortcut but reads and writes the same
config, so a card can never be hidden in one place and shown in another.

**Rule: when a feature grows a second place to configure it, migrate to one store rather than
keeping both in sync.**

**Verified:** 11 sections in order, hide/unhide of a mid-list card, core lock respected,
reorder (deep log to top actually renders first), reset-to-default, and the old-flag
migration. 55/55 tests, all 17 screens error-free.

## 2026-08-19 (v125/v126) — CSS class collision, Year in Pixels moved, hide is now reversible

**Bug: "On this day" rows were squashed into three cramped columns.** Cause was a **CSS class
collision** — `.tb-row` was already defined at styles.css:592 for the **timebox** feature with
`display:flex; align-items:center; gap:11px`. My throwback markup reused `tb-*` and silently
inherited that flex row, so when / stats / quote laid out side-by-side instead of stacking.
Renamed every throwback class to `otd-*` ("on this day") and made `.otd-row` an explicit
`display:block`. Timebox's `.tb-row` is untouched.

**Rule: this codebase has one flat global stylesheet with ~1100 lines and no scoping.
Before naming a new CSS class, `grep -n "\.your-class" styles.css`.** A two-letter prefix
is not unique enough — `tb` already meant timebox.

**Year in Pixels moved to the END of Stats ▸ Overview** (Kishore's call). It was the first
card; it's a look-back widget, so it belongs after the numbers and insights, not before them.

**Hide was a one-way door.** The `hide` links on "On this day" and the mood grid set
`dp.throwbackOff` / `dp.moodMeterOff` and toasted "re-enable in Settings" — but no such
Settings control existed. Added a **🎛 Log screen widgets** card in Settings with four
toggles (`dp.ringOff`, `dp.throwbackOff`, `dp.moodMeterOff`, `dp.hapticsOff`), reusing the
existing `.at-row` / `.at-tog` markup and a new `data-widget-toggle` handler. Flags are
inverted (`*Off`), so the switch renders `!flag`.

**Rule: never ship a hide/dismiss affordance without the control that undoes it, and don't
write a toast that names a setting that doesn't exist.**

**Verified:** all four hide → Settings → restore round-trips, `display:block` on `.otd-row`
with stats below when (not beside), 55/55 tests, all 17 screens error-free, screenshots
regenerated.

## 2026-08-19 (late) — Pages deploys fixed properly: it was a stuck deployment LOCK

Supersedes the "Pages builds are flaky, just re-queue" note below. Re-queueing was treating
a symptom. The actual cause, from the first real error message we got all day:

```
Deployment request failed for 618565c... due to in progress deployment.
Please cancel a823d7ef... first or wait for it to complete.
```

**One wedged legacy build (the v123 commit) held the Pages deployment lock, and every
later deploy queued behind it failed or hung.** That is why three commits "errored" with a
generic `Page build failed.`, why one sat at `building` with `updated_at == created_at` for
20+ minutes, and why ~15 re-queues all did nothing — they were all blocked on the same lock.
GitHub's status page reported Pages as fully operational throughout.

**What actually fixed it:** switching Pages from the **legacy** builder to the
**GitHub Actions** pipeline (`.github/workflows/pages.yml`, standard
`configure-pages` -> `upload-pages-artifact` -> `deploy-pages`), then
`PUT /repos/:o/:r/pages -d '{"build_type":"workflow"}'`. First dispatch after the lock
released: **completed/success**, v124 live.

**Why this is the better pipeline, permanently:**
- Real, readable logs. The legacy builder only ever said `Page build failed.` — the Actions
  run named the blocking deployment in one line.
- Re-runnable and dispatchable: `POST /actions/workflows/pages.yml/dispatches -d '{"ref":"main"}'`.
- `concurrency: {group: pages, cancel-in-progress: false}` serialises deploys instead of
  letting them pile onto a lock.

**Diagnostics worth keeping:**
```
T=$(gh auth token -u kishore2494)
# which run, and why it failed
curl -s -H "Authorization: token $T" .../actions/runs?per_page=1
curl -sL -H "Authorization: token $T" .../actions/runs/<id>/logs -o /tmp/l.zip   # real errors
# cancel a stuck deployment (400 if it is already releasing)
curl -s -X POST -H "Authorization: token $T" .../pages/deployments/<sha>/cancel
```

If a deploy ever hangs again: read the Actions log first, and look for a blocking deployment
sha before assuming flakiness.

## 2026-08-19 (late) — v124: Year in Pixels made compact + release versions now bump together

**Kishore's feedback: the pixel grid was too big.** It was. Transposed it from 12 columns x
31 rows to **31 columns (days) x 12 rows (months)** with month labels down the left, and set
a fixed 9px cell height instead of `aspect-ratio`. The card went **1050px -> 234px**, and the
whole Stats overview (year mosaic + stat tiles + insights) now fits one screen. It also reads
like a calendar, which the tall version never did.

### The cache bug this uncovered — read this before shipping a CSS-only change
The compact grid was live on Pages but the phone kept rendering the old square cells, even
after force-stop + clearing `cache/WebView` + deleting the service-worker directory. Root
cause: `index.html` linked `styles.css` and `app.js` **unversioned**, so the WebView HTTP
cache and the Pages edge cache could both serve stale CSS indefinitely. Bumping
`APP_VERSION` and the SW `CACHE` key does nothing for that — neither changes the asset URL.

**Fix, now permanent:** `tools/bump.sh [n]` bumps all three in lockstep —
`app.js APP_VERSION`, `sw.js CACHE`, and the `?v=` query on every local css/js tag in
`index.html`. **Use it for every release; never hand-edit those three.**

Second-order fix: the service worker precaches assets *unversioned*, so a request for
`styles.css?v=124` would have missed the cache and an offline launch would have rendered
unstyled. `sw.js` now matches with `{ ignoreSearch: true }`.

**Verified:** card 234px, 12 rows x 31 cells, 230 pixels coloured, `styles.css?v=124`
confirmed as the loaded stylesheet, deep-link still opens the tapped day, 55/55 tests,
all 17 screens error-free. Store screenshots regenerated for the new layout.

## 2026-08-19 (evening) — v122/v123: reward widgets + a reusable screenshot pipeline

Direction from Kishore: stop adding plain form widgets, add ones that "hit dopamine".
The mood grid worked because it *rewards* the tap; these follow the same rule.

**Shipped:**
- **Today ring** — one dial at the top of the Log showing how complete the day is
  (`todayCompletion()` counts visible core fields + habits + any written reflection;
  a skipped habit counts as answered). Re-rendered on every `autosaveDraft()`, so the arc
  visibly moves as you fill the form, and it buzzes + turns green the moment it closes.
- **Year in Pixels** — 12x31 mosaic of the year coloured by mood (Daylio's most-shared
  screen). Tap a pixel to open that day. Hidden behind a hint until 10 days are logged,
  because a 372-cell empty grid is a terrible first impression.
- **`buzz()`** haptics on habit tick/skip and ring completion, opt-out `dp.hapticsOff`.
  Never fires on routine taps — only completions.
- Shared **`MOOD_SCALE` / `moodColor()`** so every reward widget speaks one colour language.

**Bug found and fixed:** `navigateTo('today')` force-resets `logDate` to today (app.js
~line 5255). The Year-in-Pixels deep link used it and so silently opened *today* instead of
the tapped day. The other deep links (calendar, history, search) all use `show('today')`.
**Rule: deep-linking to a past day must use `show()`, never `navigateTo()`.**

### New: a reusable store-screenshot pipeline
`tools/shots.sh <outdir>` + `tools/seed-store-data.js` + `tools/crop.py`. Replaces the
ad-hoc process that had to be redone by hand every release. Three traps it encodes:
1. `browse screenshot` captures the **full page**, so `position:fixed` chrome (`.topbar`,
   `#nav`) renders at its document offset rather than pinned. The script hides both, measures
   the target element's offset, shoots, then crops to 412x820.
2. **The seed must produce positive insights.** An earlier seed generated "Workout drags your
   mood by 1.0" — arithmetically true, unusable as store copy. Mood now depends on workouts
   *today and yesterday*, which is both realistic and makes the next-day insight read well.
3. **Don't seed an unbroken 400-day streak** — it reads as fake. The seed leaves one gap
   ~186 days back, which is one barely-visible grey pixel in the mosaic.

Empty states also have to be seeded away: the first run showed "nothing synced yet" for
screen time and "Nothing running" for the timeline, so the seed now fills `dp.health`,
`dp.timelog` and `dp.pomohist` too.

**Store assets:** 8 phone shots (412x820, ratio 1.990 — inside Play's 2:1 cap) reordered so
the three most distinctive lead: today ring -> year in pixels -> insights. 3 tablet shots at
1920x1200. Old set archived in `store/assets/.old-screenshots-v121/`.

**Verified:** 55/55 unit tests, all 17 screens error-free, and on-device (POCO, MIUI, system
dark mode ON) the ring, mood grid and year mosaic all render clean with no logcat errors.

## 2026-08-19 (later) — v121: the mood grid

Shipped the top-ranked item from `competitors.md`: **How We Feel's Mood Meter**. A 4x4
pleasantness x energy grid; one tap sets mood AND energy (they were already our two axes),
the quadrant then offers 10 precise emotion words, and tapping a word appends it to the
journal as a `#tag` so it's searchable by the existing tag search. Bidirectional — using
the 1-10 rows re-renders the grid and vice versa. Hideable via `dp.moodMeterOff`.

Also fixed: two `↔` characters in the What's-new copy rendered as tofu boxes in the
Android WebView (the bundled twemoji subset doesn't cover U+2194). Rule: **keep What's-new
and any in-app copy to ASCII punctuation plus emoji that exist in the subset.**

### GitHub Pages builds are flaky — always verify, and re-queue on failure
v120 was pushed and appeared to deploy, but the site kept serving v119 for ~15 minutes.
`build_type` is **legacy**, and the API showed two `errored` builds plus one wedged at
`building` with `updated_at == created_at`. GitHub reported Pages as fully operational, and
an unrelated earlier commit had also errored, so this is builder flakiness, not our content
(`.nojekyll` is present; no Liquid syntax anywhere).

```
T=$(gh auth token -u kishore2494)
curl -s -H "Authorization: token $T" \
  https://api.github.com/repos/kishore2494/daily-pulse/pages/builds?per_page=5
curl -s -X POST -H "Authorization: token $T" \
  https://api.github.com/repos/kishore2494/daily-pulse/pages/builds     # re-queue
```
One re-queue fixed it. **Never assume a push deployed — check `APP_VERSION` on the live
cache-busted URL, and if it lags, check the build status rather than waiting on the cache.**

**Verified on the POCO (Android 11, MIUI, system dark mode ON):** mood grid, emotion chips,
skipped-habit chip, strength bars, "On this day" — all render clean, no OEM dimming, no
logcat errors. 55/55 unit tests; all 17 screens error-free.

**Bundle staged for upload: `store/assets/DailyPulse.aab` is now 108/68** (was 107/67 —
107 did not contain the MIUI theme fix).

## 2026-08-19 — v120: competitor-gap features + MIUI dimming resolved

**Ingested:** teardown of 14 competitor trackers (Daylio, Loop, HabitNow, StayFree, Forest,
Habitica, Finch, How We Feel, Journey, Daybook, Routinery, Habitify, HabitKit, TickTick,
YourHour, Regain) → new page `competitors.md`.

**Shipped (v120, web-only — reaches installed apps without a new .aab):**
- Three-state habits: tap cycles done → skipped → clear. Skips are streak-neutral and
  excluded from the 30-day rate and from mood correlation. Stored as `0` (falsy) so every
  pre-existing truthy check still reads "not done" — no migration needed.
- Habit strength 0-100: EMA, 13-day half-life (Loop's model). Verified against their
  published curve — 96 at 60 perfect days vs their 95.9.
- "On this day" throwback card on the Log (a week / month / 3 months / year ago, tap to open).
- Next-day mood influence in Stats with High/Medium/Low confidence.
- Fixed `ico: 'trend'` — not a real ICONS key, so one existing insight rendered a blank icon.
- Removed a duplicate CSS block referencing the undefined `--muted` token.

**Shipped (v119):** default theme is now **Auto** (follows `prefers-color-scheme`); explicit
Light / Dark navy / Black still available.

**Resolved:** the MIUI grey-wash bug. Root cause was two theme defects from build 106
(no `forceDarkAllowed` opt-out on `AppTheme`; the launch theme inherited AppCompat's DARK
variant). Fixed in **108/68**. The reason it looked unfixed for an hour was a stale WebView
render — see `gotchas.md` for the cold-start + cache-clear procedure.

**Verified:** 55/55 unit tests; all 17 screens render with zero runtime errors; on-device
cold start under system dark mode renders clean `(243,245,250)` and survives a dark-mode
off→on flip.

**Note:** the bundle to upload is **108/68**, not 107/67 as an earlier note in
`play-store.md` said.

# Log (reverse-chronological)

## 2026-08-19 — RENAMED: "Daily Pulse" → **Daylog** (v118) + full ASO keyword plan
User rejected coined names ("Dayvault" felt unfamiliar) and set the real goal plainly:
**people must be able to FIND the app in Play search**; trademark = a note, not a veto.

**Research (4 passes, live Play SERPs in IN + US, + Google's own policy pages) converged:**
the winning shape is **(b) short familiar real-word brand + keyword suffix** — not a coined
name (invisible) and not a bare keyword title (Google explicitly advises titles "be unique…
avoid common terms"). Play's 30-char title is the heaviest keyword field; Play has **no**
hidden keyword field and **fully indexes** the 4000-char description; developer name and
reviews are indexed too.

**Chosen: `Daylog`** — two familiar words, spellable after one hearing; only 6 chars so
"Habit Tracker" fits verbatim; existing Play "Daylog" apps are a **D-day countdown widget
and a watch face** → no wellness rival (unlike Daybook 1M+ or Journey 5M+ which would bury us).
Rejected with evidence: Dayvault/Innerlog (coined + iOS niche clones), Momentum/Ledger/Tally
(live trademarks, wrong intent), Daybook/Journey/Compass (buried by 1M–10M incumbents).

**SHIPPED:** title `Daylog: Habit Tracker & Mood` (28/30) · short `Private habit tracker,
mood log, screen time & focus timer. 100% offline.` (73/80) · long description rewritten
(3141/4000, "habit tracker" 4×, front-loads habit+mood+screen-time for Ask Play, policy-clean).

**Keyword plan saved in store/play-listing.md.** Key measured findings:
- **Winnable at ZERO installs** (each has an unrated/sub-1k app in its top 8): `streak tracker`,
  `routine tracker`, `habit tracker offline`, `habit tracker no ads`, `private journal`
  ("Private Offline Journal" ranks #2 with NO rating), `app usage tracker`, `daily time tracker`
  (thinnest SERP measured — 14 apps), `time log`, `phone usage tracker`.
- **Hopeless:** habit tracker head (Loop 7.6M), mood tracker (Daylio 10M+), screen time
  (StayFree 20M), focus timer/pomodoro (Forest 48M), diary app, time tracker (Toggl B2B).
- **TRAP:** bare privacy words are dead ends — `offline app`/`no internet app` return offline
  **games**/maps. Privacy words only work appended to a category noun.
- **Mechanism:** exact-match titling — every winnable term has a literal title-match app top-5.
- **Underrated (sourced traffic/difficulty):** mental health diary 64/37, emotional tracker 64/38,
  emotional journal 68/42 — only sourced terms with real traffic AND beatable difficulty.
- **User phrasing** (r/androidapps verbatim): they stack negations — "completely offline, no cloud,
  no ads", "no registration required", "100% private" — used verbatim in the description.
- **India:** 22.1% of global Play installs, SERPs markedly softer (unrated single-dev apps rank
  top-8; US payroll/parental incumbents drop out). Indian devs already winning this niche:
  YourHour (Indore 1M+), Engross (Indore 500K+), **Regain (Bengaluru, unfunded, inc. May 2023 →
  1M+ installs / 148K reviews in ~2 years)**. Category is NOT closed.
  Monetization note: IN skews ad-tolerant; Android ARPU ~$72 vs iOS ~$138 → subscription-only
  won't carry an India-skewed base.

**Mechanics:** `tools/rename-app.sh "New Name"` renames 151 files in one command and
**deliberately preserves** the hosting URL (`github.io/daily-pulse/` — the native shell loads it,
so changing it would break every installed app), package id, bundle filenames and SW cache key;
the wiki keeps the old name as historical record. Verified live: title/drawer show "Daylog",
0 stale refs, canonical URL unchanged. Native rebuilt **107/67** with `application-label:'Daylog'`
(verified in the APK) — **this is the bundle to upload**. Device install pending (POCO dropped
off wireless ADB).

## 2026-08-18 (pt 8) — v117: Play REJECTION-RISK audit + compliance fixes (pre-launch)
User asked: "do we need to do anything new, or are there chances Google rejects us?" → audited the shipping bundle against Play policy and found TWO high-severity rejection risks, both fixed:
1. **PACKAGE_USAGE_STATS is a restricted permission** — Play requires a *prominent disclosure BEFORE* requesting it. We were requesting it with only a post-hoc toast. Added a pre-request sheet (what's read: "how long your phone was in use today"; stays on-device; why; how to turn off) with Not now / Continue; the native request now fires only after explicit consent (`dp.usageDisclosure`), and silent background syncs never prompt. All 4 paths verified.
2. **privacy.html disclosed none of it** — zero mentions of screen time, usage access, microphone or health data (it predated those features); a policy/behaviour mismatch is a classic rejection + Data-safety violation. Added "Device permissions and what they're used for" (usage access, mic, notifications/alarms, boot, internet) + "Health-related data" (not a medical device, nothing shared); fixed a stale backup-path reference.
Also recorded a full 8-row **rejection-risk table** + ready-to-paste **review notes** in play-store.md (remaining items are Console-side: sensitive-permissions declaration, data-safety re-verify, keep Productivity category, rename resolves the duplicate-title risk).
Earlier in the session: v116 crash-net + storage-quota guard; Play listing rewritten (2649/4000 chars, title/short-desc options with counts). 55/55 tests throughout.

## 2026-08-18 (pt 7) — v116 launch hardening + listing rewrite + NAME RESEARCH (rename recommended)
3–4 days from publishing, so: harden for strangers, then fix discoverability.
- **v116 — crash safety net**: global error + unhandledrejection handlers show a recovery sheet (Reload / Export backup / Report) instead of a dead blank screen; last 10 errors stored LOCALLY only (`dp.errlog`), Report opens mail with details. **Storage-quota guard**: `safeSet()` wraps all major writes (entries/tasks/notes/docs/timelog/gym/plans) — QuotaExceeded now shows a throttled "storage full, export a backup" toast instead of a silent lost save or crash. Verified: sheet+3 actions+logging, quota no longer throws, every screen has a real empty state, 55/55 tests, 16 screens 0 errors, device-verified on POCO.
- **Play listing rewritten for launch** (`store/play-listing.md`): title/short-desc options with exact char counts; full description rebuilt around the differentiators (insights engine with example sentences, automatic screen time, one-tap time tracker, streak celebrations, search, voice typing, themes, true privacy) — 2649/4000 chars.
- **NAME RESEARCH (subagent) → RENAME RECOMMENDED, keep the icon.** FOUR live Play apps already named "Daily Pulse" (one is a privacy-focused local-only mood tracker in Health & Fitness; another is a feature near-clone in Productivity). Worse: "Pulse" semantically = heart-rate/BP on Play, mis-filing us; "Daily Pulse" has ~zero search demand yet consumes the 30-char title (highest-weight ASO field). PULSE trademark exists in software services (Reg #5235848) — low-moderate risk, but identical-title-in-category adds review risk. Clean candidates: **Innerlog** (cleanest), **Dayvault** (privacy signal), Vitalog, Rhythmlog, Tallyday; keep-Pulse options SteadyPulse/Pulseboard/Pulsecraft. Keyword economics: habit tracker = top value; mood tracker = saturated (Daylio); **screen time = our unique edge**; offline/no-account = low-volume high-convert. Ranking levers 2026: retention/conversion > keywords, free Store Listing Experiments, localize title+short desc. Full details + candidate table saved in play-listing.md. **DECISION NEEDED FROM USER before publishing** (package name never changes — only the store title).

## 2026-08-18 (pt 6) — v113–v115: systematic RESPONSIVE audit (no per-device hacks)
User reported the Log ▸ Health card overflowing, then correctly pushed back: "don't configure for THIS mobile — make it responsive for ALL mobiles properly."
- **Root cause**: the health card reused `.task-summary` (flex row) → 6 cells crushed into one row and clipped values ("4h15m" cut off). Fixed as a real `minmax(0,1fr)` 3-col grid (`.health-grid`).
- **Then built an automated overflow detector** (headless): for widths **320/360/412/480/600/768** it walks every element of every screen + all four Stats tabs, flags `scrollWidth-clientWidth>6px`, excluding native input scroll and intentional ellipsis. Found and fixed with FLUID rules only: habit grid + chips `minmax(0,1fr)`/`min-width:0` (chips crushed at 320px), `.h2-icon` wrap + `.section-collapsible>h2` clip (deep-log chevron poked out on every width), `.corr-row`/`.wow-row` wrap, act-chip label ellipsis, stat grids minmax, `.screen svg{max-width:100%}`, and finally the Connections graph: SVG `<text>` can't be constrained by CSS → node labels clamped to the plot area + truncated to 14 chars, `#graph-wrap{overflow:hidden}`.
- **Result: CLEAN at every audited width (320→768) across all screens and Stats tabs.** 55/55 tests. Device-verified on the POCO: health card now a tidy 3×2 grid with "4h37m SCREEN TIME" fully visible.
- LESSON: prefer `grid + minmax(0,1fr)` + `min-width:0` over flex rows for any multi-cell card; audit by measurement across widths, never by eyeballing one device.

## 2026-08-18 (pt 5) — v110–v112: guided tour, What's-new popup, SEO'd docs (all device-verified)
User: "we need to show them and take a tour of all these functionalities" + "What's-new must be a popup, I never saw the ✕" + "document everything permanently + make the doc page SEO-able".
- **v110 — 🎓 Guided tour**: 8-step coach-mark walkthrough (mood/checklist → auto tasks → auto-tracking → time tracker → Your patterns → Health analytics → Menu/search/pin-tabs → wrap). Spotlight = .tour-spot with 9999px box-shadow cutout over the live element; per-step navigation incl. opening the drawer; auto-starts once after onboarding; replayable via Settings ▸ 'Take the app tour'; hardware back closes.
- **v111**: tour Settings row needed closest() not exact id — real touches land on child spans; headless .click() masked it (LESSON: always use closest() for rows with children).
- **v112**: tour card **pinned to bottom** every step (element-relative positioning could land off-screen — found on device); **What's-new → modal popup** with '🎓 Take the tour' / 'Got it ✓' buttons (w6), shows once per wave 1.2s after boot for onboarded users, back dismisses; **guide.html now documents every feature** (new sections: Your patterns, Auto-tracking, Search & Menu w/ real device screenshots) and is **SEO-ready**: descriptive title, meta description, robots index, canonical, OpenGraph, JSON-LD SoftwareApplication + FAQPage (private/offline/screen-time/free).
- **Native 106/66**: designed splash screen — brand-navy bg + centered rounded logo (layer-list windowBackground, launch theme Theme.AppCompat.NoActionBar + forceDarkAllowed:false; light splash was force-dark-dimmed by MIUI pre-code, so brand-dark = OEM-proof). `store/assets/DailyPulse.aab` = **106/66 — THE bundle to upload** (splash + force-dark fix + speech + screen time).
- **Device-verified**: popup w/ buttons, popup→tour, tour step 1 spotlight on mood scale, step 4 cross-screen on Time tab, splash. Accidentally also verified the on-screen report modal. Ops: phone WebView caches app.js ~10 min (plain URL) — wait TTL or pm clear before device re-verification.

## 2026-08-18 (pt 4) — v107–v109: insight engine, graph explorer, device photo shoot
- **v107 — 🧠 'Your patterns' engine** (the Play-Store differentiator): on-device pattern mining with honest sample guards — sleep sweet spot (mood by sleep bucket), biggest habit mood-lift, mood trend slope, natural bed→wake ±consistency (from tracked sleep), peak 2h focus window (from tracked work), heavy-screen mood cost (terciles), weekday logging blind spot, sleep-regularity score. Pure helpers dpMedian/dpStd/dpSlope; top card in Stats Overview; sample seeder now also writes sleep/work timelog segments so ALL patterns demo. **Connections graph**: pan (1-finger), pinch + wheel zoom via viewBox; pan suppresses node-tap. **BUG: .bar-fill/.bar-track inline spans ignored width/height → Stats bars were NEVER rendering** (user caught it in light mode) → display:block. Tests 44→55. Play-listing gained the insights paragraph.
- **v108** — box typography: reminder time selects no longer clip ('9:00 pr'), stat/health cells clamp() + nowrap ('69 bpm' one line), comfortable select fonts.
- **v109** — pin cap REMOVED (user decision: user's choice; soft tip past 5); '✎ Edit tabs & this menu…' discoverability row at the drawer bottom → Customize▸Tabs.
- **Real-device photo shoot (POCO, v108)**: `store/assets/device-shots/{light,dark}/` — raw 720×1600 + play-ready 720×1440 (2:1, status bar cropped) for log/patterns/health/time/focus/menu in BOTH themes. Patterns card verified on-device in both themes with 6 mined insights. Theme restored to light after the dark set.
- Play note: build 105 upload showed only the harmless deobfuscation warning → safe to roll out.

## 2026-08-18 (pt 3) — v105/v106: sample-data preview for auto-tracking (live, demoed on POCO)
User: "add sample data for all the auto tracking things so I can see how it looks."
- **'👀 Preview with sample data'** on the Stats Health tab (shown when empty OR <5 real days): `seedSampleData()` writes 14 realistic PAST days — health metrics (steps/screen/calories/sleep/active/HR), pomodoro history, and sample entries whose mood/energy honestly correlate with the health story (+ tagged journals so Topics fills). Safety: skips yesterday & day-before (**loggedStreak can't be faked** — verified stays 1), every record `sample:true`, exact removal via `dp.sampleMeta` + **Clear sample** button (yellow banner), direct localStorage writes (no sync/pushState).
- **Demoed on the POCO:** averages grid (6,948 steps · 4h04m screen · 2167 kcal · 7h27m sleep · 69bpm), populated charts incl. today's REAL screen-time bar (2h27m — auto-sync kept updating all day), **Health ↔ You: screen→mood r=-0.68 strong↘, steps→energy r=0.85 strong↗**, "screen = 1.4× your deep work" note; Overview: mood/energy charts + Connected insights (sleep→mood r=0.78). Sample left loaded on the device for the user to browse.
- 44/44 tests; range auto-switches to 30d on seed. Ops: phone screen sleeps during long CDN waits (keyevent 224 + 82 to wake); plain-URL cache ~10min — poll before device checks.

## 2026-08-18 (pt 2) — Theme overhaul + FULL functional pass on the POCO (v103/v104 web, native 105/65)
User demands: light theme broken → make LIGHT the DEFAULT; reminders card boxes overflowing; guide must follow the app theme; test everything end-to-end.
- **v103:** light = default theme (fallback navy→light, THEME_MODES reordered, meta theme-color follows mode); **reminders card redesigned** (row = bell·time·label·× + full-width mode pill; add-row/test-buttons wrap at 360px); **guide.html follows the app theme** (reads dp.settings.mode pre-paint; full light palette + light backbar).
- **"Light theme not working" ROOT CAUSE:** the POCO's system dark mode → **WebView force-dark auto-inversion** (bg rendered #202226, not our navy — the tell). v104 declared color-scheme (CSS+meta+JS) — required but NOT sufficient on MIUI. **Native 105/65:** `forceDarkAllowed=false` in the activity theme + `WebSettings.setForceDark(FORCE_DARK_OFF)` (API 29–32) in MainActivity → **verified: system dark ON + app light = renders #f4f6fb exactly.** Fixes OEM force-dark on ALL devices. → **UPLOAD 105/65** (supersedes 104; also contains speech + screen-time modules).
- **Full functional pass on-device (light, system-dark ON), all PASS:** 5-step onboarding → Log (mood tap → streak 1 live; task add → 0/1 auto-cells; habit ✓); Time (Work timer runs w/ Stop; **ongoing notification id=770 w/ 2 actions confirmed in shade**); Focus (pomodoro round 1/4 counting); Reminders (onboarding-created 9:00pm present; **Test alarm → full-screen red takeover; hardware back CANNOT dismiss it** (v94 guard)); guide light + back→Settings; **Search 'milk' → 1 result, highlighted, found the task created mid-test**; exit dialog Stay.
- Ops learnings: GitHub Pages plain-URL cache = max-age 600 (phone fetches unbusted URLs — wait for the PLAIN url to flip before device verification); wireless adb drops on idle (adb connect re-attaches); `cmd uimode night yes|no` toggles system dark for testing (restored to yes).

## 2026-08-18 — REAL-DEVICE E2E (POCO C31 via wireless ADB) + v100–v102 fix loop + competitor research
First full end-to-end session on real hardware (192.168.1.6:5555, Android 11, WebView 150; cabled Realme left untouched). Installed build 104 via adb; granted RECORD_AUDIO (pm grant) + usage access (appops set android:get_usage_stats allow).
**VERIFIED WORKING on-device:** 5-step onboarding (privacy badge → habits → activities → deep-log picker → reminder step, native time input); auto task counts; icon system (nav/drawer/cards/checklist); Menu drawer; **native voice typing** (logcat: GoogleRecognitionService onStartListening, VOICE_RECOGNITION audio source; Speak button red rec state); **REAL screen time** — 0h28m auto-synced at boot with no user action → Health card cell + Stats▸Health orange bar chart w/ date axis; hardware back (Stats→home→'Exit Daily Pulse?' dialog); exit Stay.
**UI bugs found on-device → fixed (v100, v102 batches):** (1) gradient-clip titles mispaint on Android WebView even at 0% stops (compositing offset — 'Today'/'Pick your'/'Daily Pulse' part-invisible) → ALL gradient text replaced with solid colors (topbar/ob/guide h1, pm-score, ms-num; light variants too); (2) bed/wake time inputs rendered blank → '--:--' overlay via .bw-cell.bw-empty (toggled on change) + .bw-dur spacing; (3) 'Journal entry 📓' glyph broken in Twemoji → label now plain (default+backfill); (4) Stats segment tabs + Range label emoji → line icons (.seg-btn flex). Process per user: collect all issues → one batch → one deploy → re-verify (Pages build was slow/stuck once; POST /pages/builds re-queued it).
**v101** (same session): onboarding privacy headline card + deep-log picker step (obHideD default-hides health/finance/digital/growth/haircare/skincare).
**Competitor research** (subagent, Daylio/Loop/HabitNow/Me+/Forest/Journey…): top web-shippable gaps = Year in Pixels (S), streak grace + flexible schedules 3x/wk (M), PIN lock (S), CSV import (S), notes per check-in + week-start config (S). Monetization norm: freemium subs or one-time unlock; free/one-time fits our privacy positioning. Our differentiators for listing copy: all-in-one (replaces 3–4 apps), truly private (no account/cloud/ads), built-in time tracker + pomodoro.
**Play track note:** testers still get Speak/screen-time only after the user uploads build 104 to closed testing (POCO got it via adb).

## 2026-08-16 — v99 + native 104/64: REAL screen-time tracking (aab awaiting upload)
User: auto-tracking must show real data with analysis. Shipped phase 1 of the native module:
- **Native build 104/64**: `HealthConnectPlugin.java` (Java, registered in MainActivity) — `screenTimeToday()` via UsageStatsManager **event pairing** (ACTIVITY_RESUMED→PAUSED/STOPPED per package + open tail to now — the accurate method, not the lossy daily-bucket sum); `requestPermissions()` checks AppOps OPSTR_GET_USAGE_STATS and auto-opens ACTION_USAGE_ACCESS_SETTINGS; `today()` returns nulls (HC client = phase 2); `isAvailable()` reports {screenTime:true, healthConnect:false}. Manifest: PACKAGE_USAGE_STATS (tools:ignore=ProtectedPermissions). Compiled clean; verified in .apk. In store/assets, **user must upload**.
- **Web v99**: silent syncs skip requestPermissions entirely (native may open a settings page — must never happen in background); explicit Sync guides to Usage access; all-null days never stored; **auto-sync on app open (4s) + resume** so screen time flows into the Health card/tab/correlations/WoW hands-free.
- Play note for production: PACKAGE_USAGE_STATS is a sensitive permission — production review will ask for a declaration; Daily Pulse fits the permitted "digital wellbeing" use case. Phase 2 = Health Connect client (Kotlin, minSdk 24→26 bump, HC permission contract) for steps/sleep/calories/HR.

## 2026-08-16 — v98: auto-collected data surfaced in Stats (live)
User: "we collect automatically — where is it shown in Stats? show it properly." Found + fixed a real gap: **pomodoro history was being discarded** (only today's count in `p.done`). Now `pomoAdvance` persists `dp.pomohist[date]=n`; Stats Overview gained three "auto" cards: 🍅 Focus sessions (chart + total + total focus time from cfg.focus), ✅ Tasks completed/day (the v76 auto counts, first time charted), ✍️ Words written/day (journal+reflections word counts). Cards hide with no data. `dp.pomohist` + `dp.health` added to BACKUP_KEYS. Sensor metrics (steps/screen/etc.) already have the v95 Health tab — still awaiting the native module for real data. 44/44 tests.
Harness note: browse-daemon page context does NOT survive across separate Bash invocations — always run server+goto+js in ONE block.

## 2026-08-16 — v97: 44-test suite + light onboarding fix (live)
- tests/unit.js grew 26→44: safeParse, pearson (±1/degenerate), snippet (highlight/escape/truncate), bestHabitStreak, trackedSleepHours (cross-midnight + ended-only), fmtMin. All green.
- Light-mode: `.ob-inner h1` used the white gradient → invisible on light (same class of bug as pm-score/nav-label); added the dark-gradient override.
- Learned (harness): headless Chromium doesn't advance CSS animations without painted frames — a screenshot right after `navigateTo` can catch `.screen.on` at opacity 0. Force a paint (extra screenshot / delay) before judging "blank screen" from a shot; verify via DOM.

## 2026-08-16 — v96: global Search + onboarding reminder + backup nudge (live)
- **🔍 Search screen** (`s-search`, in the Menu drawer; NAV_DEF k:'search'): searches entries (journal/wentWell/improve/weekWins/weekFocus), tasks, notes, plans (name+items), Write docs (title+blocks), events. Debounced input, grouped cards with counts, highlighted snippets (`snippet()`), deep links per type (log→that day, plan→curPlan, doc→curDoc, event→calendar day). Stats "Your topics" tag chips are now buttons (`data-searchtag`) that jump into a tag search.
- **⏰ Onboarding step 4** (dots now 0-3): "Never miss a day" — checkbox (default on) + time (default 21:00) creates a 'Log my day' notify-mode reminder on finish + web Notification permission request. Retention lever for production.
- **💾 Backup nudge:** boot check (2.5s delayed) — ≥10 entries & no backup 14d+ → weekly toast pointing at Settings ▸ Backup (`dp.backupNudge` throttle).
- Verified: 5 result groups/highlights/deep-links, tag→search, onboarding reminder creation (20:30 test); 26/26 unit tests; 16 screens 0 errors.

## 2026-08-16 — v95: Stats surfaces everything we track (live)
User: "we track screen time and more — where is it shown?" — the dp.health store was only visible on the Log's today card. Shipped:
- **New ❤️ Health tab in Stats** (4th segment): averages grid (steps/screen/kcal/sleep/active/HR), per-metric date-axis bar charts gated by the Auto-tracking toggles, **Health ↔ You** correlations (screenMin→mood, steps→mood, steps→energy, exerciseMin→energy via `hPairs`+pearson, ≥5 paired days), and a screen-vs-deep-work ratio note ("4h45m/day — 1.7× your deep work"). Distinct states: master-off → "switched off in Settings"; no data → "coming in a Play update".
- **Overview additions:** 🏅 Best days (best mood / most deep work / most steps / most tracked, dated, range-scoped) + #️⃣ Your topics (journal #tag counts, top 8 chips). Week-over-week gained 📱 screen-time and 👟 steps deltas.
- **Checklist tab:** 🏆 Streak leaderboard (current 🔥 vs best-ever per habit, medal-ranked; `bestHabitStreak()`).
Verified with seeded health data (6 stats, 5 charts, corr rows, off/empty states); 26/26 unit tests; 15 screens clean.

## 2026-08-16 — v92–v94: asset refresh, What's-new, pre-production hardening (live)
8 days left of closed testing (production apply ~Aug 24). Full-speed session per user.
- **v92:** ALL visual assets regenerated from the live app (old ones showed the pre-v82 emoji design): Play phone screenshots 412x820 (log-with-tracked-chips / time / stats-analytics / habits / 21-day-streak-celebration hero), tablet 1920x1200 ×3, all 9 guide images (more.png now = side drawer). **USER: upload to Play listing.** +21-day milestone message tier.
- **v93:** What's-new card — one dismissible card per release wave (`dp.whatsnew`, WHATS_NEW.v='w3') at the top of Log; brand-new users skip it (onboarding sets the flag).
- **v94 — third bug-hunt (subagent) fixes, 10 findings:** [HIGH] Android date-dialog **Clear** stored a ''-keyed entry → permanently crashed Stats (validate + boot migration purges invalid keys + NaN guard in weekday agg); [HIGH] sync re-render on an unpinned screen called `show('__menu')` → blank app (now re-renders the visible screen); [HIGH] running work timer froze partial hours into deep-work (ended-segments only) + a Health sync alone created a logged day → phantom streak credit (persist only when the entry exists); [MED] `safeParse()` at 24 storage sites — corrupted localStorage no longer white-screens boot, cfg getters reject non-arrays; [MED] Enter-to-add left the nav hidden (kbd-open cleared + MutationObserver safety net); [MED] dictation double-tap race (post-start stop check) + textareas re-queried by selector so re-renders don't lose speech; [LOW] unhide can't demote a visible pin; minutes-only duration = 0.5h; alarm-first handleBack; renderMore icons/hint. All verified; 26/26 unit tests; 15 screens clean.
- **play-store.md** gained the PRODUCTION CHECKLIST (SHOW_SYNC off, upload v92 shots, promote 103/63, content re-check) + drafted answers for Google's production-access questions.

## 2026-08-16 — v91: tracker→Log connection, real analytics, streak rewards, widget bridge (live)
Backup: `backup/v90-preanalytics` (pushed). Four user asks in one release, all browser-verified + 26/26 unit tests:
- **Sleep/deep-work duplication FIXED (one source of truth):** Log auto-fills sleep/deep-work from Time-tracker Sleep/Work segments when empty (`trackedSleepHours`/`trackedHours` + `trackedInfo` in loadDraft); a `tracked-chip` shows "from your Time tracker", and when a manual value differs, "tracked 7h — tap to use" adopts it (`data-use-tracked`). Sleep semantics: the FULL night that ENDS on this date (23:00→07:00 = 8h, no midnight clipping; 16h/segment cap).
- **Stats "Connected insights" card (Overview):** `pearson()` correlations (sleep→mood, sleep→energy, deep-work→mood, energy→deep-work; requires ≥5 paired days; shows strong/moderate/weak, ↗/↘, r, sample size), workout-day vs rest-day mood diff, and a **This week vs last week** table (mood/sleep/deep-work/tracked-time/workouts, ▲▼ colored deltas). Placeholder card invites logging ~5 days when data is thin.
- **Streak milestone rewards:** full-screen confetti overlay (`#milestone`, 44 CSS-animated pieces, gradient number, per-tier message, vibration) at 3/5/7/10/14/21/30/50/75/100/150/200/365-day logging streaks; shown once per milestone per streak run (`dp.milestones` keyed `n:runStartDate`); triggered from `saveDraftNow` (today only); hardware back + tap closes; reduced-motion respected.
- **Widgets:** Android home-screen widgets are pure native (RemoteViews — can't run web code). Web side is ready: `pushWidgetData()` after every save sends {streak, mood, tasksDone/planned, steps, sleepMin, running-timer, updated} to a future `WidgetBridge` native plugin (no-op today). Native widget joins the rebuild list.
- **NATIVE PHASE queue (device session):** Health Connect (sleep/steps/cal/cardio/HR), UsageStats screen time, WidgetBridge + AppWidget, on-device Speak test (build 103/63 uploaded).

## 2026-08-09 — v90: Auto-tracking toggles + screen time contract (live)
User: auto-tracking (sleep/cardio/etc.) must be enable/disable-able from Settings; also asked for **screen time** capture. Shipped **Settings ▸ 📈 Auto-tracking**: master switch + per-signal toggles (sleep, steps&distance, calories, workouts/cardio, heart-rate, screen time), stored in `DB.settings().autoTrack` (`autoTrackCfg()`/`saveAutoTrack()`, defaults all-on). Semantics: OFF = **not collected** (syncHealth stores null for disabled signals, no sleep auto-fill when sleep off, master off = no sync + no Health card on Log). Screen time added to the native plugin contract — `HealthConnect.screenTimeToday() → {screenTimeMinutes}` (Android **UsageStatsManager**, needs the special "Usage access" grant — native rebuild, like HC). Health card shows only enabled metrics incl. screen time (fmtMin). All behaviours verified with a mocked plugin; 0 JS errors. NOTE: the actual sensor data still needs the Health Connect / UsageStats native modules (device-testing phase) — these toggles gate what the app is ALLOWED to collect once that ships.

## 2026-08-09 — v89: tab customization restored (live)
User asked for tab customization back after v78 removed it. Re-added **Customize ▸ Tabs & navigation**: choose WHICH 4 tabs fill the fixed bottom bar (drag order, rename, hide, 🎯 default tab) — the bar itself stays 4 + ☰ Menu. Pin cap enforced with a toast (was silently dropping the 5th pin); NAV_DEF default pins trimmed 5→4 (`cal` unpinned) so defaults agree with the cap; `navCfg()` now always takes `ico` from NAV_DEF (fixes existing users' stored emoji-era configs showing emoji in the bar after v82) and clamps legacy >4-pin configs. Browser-verified end-to-end + 26/26 unit tests. Also earlier (v88, 2026-08-04): native speech build **103/63** uploaded to closed testing — only warning was the harmless deobfuscation note; awaiting on-device Speak test.

## 2026-08-03/04 — Big rework: v75→v85 (all live on web = live in native app too)
Native app loads the remote GitHub Pages URL, so ALL of this reached the installed app with NO rebuild. Backups: `backup/v74-prerework`, `backup/v82-preicons` (both pushed).
- **v75** dedup Settings in menu · bottom nav hides while typing (keyboard overlap) · How-to back→Settings (`index.html?go=settings`).
- **v76** Log: task done/planned now AUTO from the Tasks list (read-only `taskCounts`) · quick-add task + quick-add checklist item on the Log home.
- **v77** Sleep = Bed→Wake time → duration (cross-midnight, `bedwakeHours`) · Deep-work = hours+minutes duration picker. `DEFAULT_CORE_FIELDS` gained `bedwake`/`dur` flags (backfilled).
- **v78** Bottom nav is now FIXED; side menu lists only non-bottom screens; removed Tabs & Daily-checklist from Customize.
- **v79** 💪 Workout card on Log opens the logger · Stats range is a DROPDOWN (Today/7/14/30/90, default 7) · bar charts show date-axis labels.
- **v80** Removed the verbose "your data lives on device" card; kept a compact Backup & restore (export/import is the ONLY restore path — PDF is read-only).
- **v81** Fixed Log layout — sleep/deep-work pickers now full-width rows (were crammed into the 2-col grid).
- **v82–v84 — PROFESSIONAL ICON SYSTEM (replaces emoji chrome):** `icon()` + Lucide-style inline SVG set; nav + drawer use line icons; rich accent-tinted `hicon()` chips on every card/section header; default habit chips use icons; a global `decorateHeaders()` + MutationObserver swaps a leading emoji in ANY h2/menu-icon → mapped icon (EMOJI_ICON) across all 14 screens (33 header icons, 0 leftover). Emoji kept only for user-typed custom content. Twemoji font (v74) still loads for any remaining user emoji.
- **v85** Real **PDF report** via self-hosted jsPDF (`generatePdfReport`, SW-precached) — saves via share sheet/download + toast + native notification (window.print didn't work in WebView); `saveFile()` now handles binary blobs. **Re-enabled `SHOW_SYNC=true`** (Google Sheet sync/login) for testing — ⚠️ **set back to false before PRODUCTION**.
- **Unit tests**: `tests/unit.js` — 26 tests on pure logic, all pass (re-run after each batch).
- **STILL PENDING**: Health Connect native scaffold (sleep/steps/distance/calories/workouts/HR — needs rebuild + Play health-data declaration); the 3 tester "previous errors" (deep-log/time/reminders) — NO JS crash reproduces, need screenshots.

## 2026-08-02 — v74: light-mode drawer/modals + professional Twemoji emojis (live)
Tester report: opening the side drawer in light mode showed a black panel with invisible text; also wants consistent/professional emojis instead of each device's own ("junkie/amateur").
- **Light-mode drawer/modal bug:** `.drawer`, `.copy-box` (export modal) and the exit-confirm used `background: var(--card, #141c2e)` — but there is NO `--card` variable (it's `--bg-card`), so they ALWAYS fell back to the hardcoded dark `#141c2e`. Fine in dark mode, but in light mode = dark bg + (correct) dark text → invisible. Fixed all three to `--bg-card`/`--border`/`--text`; drawer/rows/modals now correct in navy/black/light.
- **Professional emojis:** self-hosted **Twemoji COLR** font (`fonts/twemoji.woff2`, 493KB, converted from Mozilla's 1.47MB ttf via fonttools; COLR because Chromium/WebView don't support SVGinOT). Added `@font-face 'Twemoji Mozilla'` + appended it to every font stack (`--font-display`, body, all `'DM Sans'` spots) as the emoji fallback — emoji-only font so text still uses DM Sans/Sora. Precached in `sw.js` ASSETS for offline. Result: one clean flat emoji set on every device. NOTE: app already loads Google Fonts from CDN, so a self-hosted font is consistent with existing behaviour and actually MORE offline-safe.
- **Tested end-to-end (user demanded):** 15 screens × 3 themes = 0 JS errors; drawer + copy + exit modals readable in light (white bg, dark text); `document.fonts.check('Twemoji Mozilla')`=true and applied on `.habit .emoji`; full regression battery all PASS — autosave cross-day (no loss), gym-field preserve, surgical scale tap, back sub-view, pomodoro catch-up (no overflow), cross-midnight block, export→import round trip.

## 2026-08-02 — Autonomous session: v73 (2nd bug-hunt: edit flows) (live)
Second read-only bug-hunt subagent covered Customize/Gym/Calendar/Reminders/Write/Focus/Waves. Fixed (browser-verified):
- **[HIGH data-loss] Gym note lost on date-switch mid-debounce:** the gym log-input autosave read global `gymDate`/`gymDraft` at fire time (Log had this fixed, Gym didn't). Now `persistGym(silent, date, draft)` and the debounce captures `(capDate, capDraft)` at schedule time.
- **[MED freeze] Pomodoro catch-up recursion:** `renderFocus`→`pomoAdvance`→`renderFocus` recursed one frame per elapsed phase (the `guard<20` reset every call, useless) → stack-overflow with short phases + long absence. Now a **silent bounded loop** (`pomoAdvance(true)` skips chime/toast/segments/alarm/recursion; `guard<1000`); after the loop it chimes once + schedules one alarm for the final phase. Verified: 8h away on 1-min phases survives in ~1.5s, lands on the correct future phase.
- **[LOW-MED] Calendar event alarm w/o time:** showed ⏰ but could never ring → now requires a time when the alarm box is ticked.
- **[LOW] Back from Customize hub:** now goes to Settings (mirrors the on-screen "← Back to Settings") instead of the home tab.
- **Deferred (documented):** #2 web-only same-minute reminder swallow (native schedules each reminder as a separate alarm id, so testers on the app are unaffected); #4 gym `workoutsDone`/`workoutDetail` counts orphaned `dayId/exId` ticks after a day's group is reassigned in Customize (uncommon); #6 native alarm `seq++` ids can cross the reserved-700 boundary only at unrealistic reminder volume. Agent confirmed Write editor, drag-reorder, deep-log/gym config editors, waves audio, .ics export all sound.
- Regression: normal Focus render + active-phase (no premature reconcile) + all-screens smoke = ZERO JS errors.

## 2026-08-02 — Autonomous session: v71 cross-midnight, v72 Done merge-safe + QA (live)
- **v71:** manual "forgot to track" time block can now cross midnight (`b<=a` → `+24h`, e.g. 23:00→07:00 sleep); rejects identical start/end. (bug-hunt #6)
- **v72:** the manual **Done** button had the same blind-`putEntry` clobber risk as autosave + left the debounced timer running → now clears the timer and routes through `saveDraftNow()`, so it preserves Gym/Time fields identically.
- **QA verified this session:** full **export→wipe→import round trip** restores all data (entries/tasks/habits/journal) — restore path is safe. **All 15 screens** (today/time/tasks/notes/plans/gym/habits/dash/cal/write/history/settings/focus/waves/custom) render with **ZERO JS errors** after v67–v72. No horizontal overflow anywhere; all 3 themes clean.
- Net this session: v67→v72, 6 releases. Everything web (auto to testers). Backup `backup/v66-autonomous` pushed.

## 2026-08-02 — Autonomous session: v69 theme fixes, v70 bug-hunt fixes (live)
- **v69 — light-theme contrast:** `.pm-score` (Polymath hero) used a `#fff→#b9c8ff` gradient invisible on white cards → now `var(--grad-accent)`. Active bottom-nav label was `#fff`, invisible on the white light-mode nav → added `:root[data-mode="light"] .nav button.on { color: var(--accent) }`. Caught in a light-mode screenshot QA. All 3 themes (navy/black/light) verified clean.
- **v70 — fixes from a read-only bug-hunt subagent** (browser-verified):
  - **[HIGH data-loss]** debounced `autosaveDraft` read the `draft`/`logDate` globals at *fire* time; editing a past entry then switching day/tab within 700ms lost the edit or wrote it to the wrong date. Fixed: capture `targetDate`+`targetDraft` at schedule time (loadDraft deep-clones so the ref stays intact) → `saveDraftNow(date,d)`. Added `flushAutosave()`.
  - **[MED data-loss]** autosave blindly overwrote the whole entry, clobbering Gym/Time fields. Fixed: `saveDraftNow` preserves `workoutsDone`/`workoutDetail`/`timeSummary` from the stored entry.
  - **[MED nav]** hardware back ignored sub-views. Fixed: `handleBack` now steps back within Write article (`curDoc`), Plan detail (`curPlan`), Gym day (`gymView`), Customize sub-page (`customPage`) before leaving the screen.
  - **[self-XSS]** escaped config-derived labels on the Log screen (scale/num/text/checklist labels + options, habit label/emoji) — the last unescaped `innerHTML` sites.
  - **DEFERRED (documented):** #3 timelog-merge heuristic can drop a device's un-pushed segments — sync-gated (SHOW_SYNC=false), fold into the existing sync-hardening item. #6 manual "forgot to track" block can't cross midnight (`b<=a` rejected). #7 two reminders at the same minute: the 2nd is marked notified but `fireAlarm` early-returns if the overlay's already up → never rings. #8 the v68 surgical habit tap doesn't live-refresh the `🔥streak` badge (self-heals on next full render). Bug-hunt confirmed all other user free-text is consistently escaped; SW + pomodoro math sound.

## 2026-08-02 — Autonomous session: v67 how-to, v68 smoothness (live)
User asked to "go hard" autonomously for a few hours with backups. Backup: tag `backup-v66-live` + branch `backup/v66-autonomous` (pushed) + `.backups/v66-<sha>/`.
- **v67 — How-to "unnamed button" fixed:** the guide opened via `target="_blank"`, which inside the installed WebView spawned an in-app browser whose **unlabeled close button** was the "unnamed button" testers saw. Now the menu row (`app.js` ~2916) opens `guide.html` in-place (no `_blank`), and `guide.html` has a sticky, clearly-labeled "← Back to Daily Pulse" bar at the top (plus the existing bottom CTA).
- Confirmed already-built (discoverability, not missing): **timer start alert** (▶ toast in `startAct`) + **ongoing timer notification** (`refreshTimerNotif` schedules an ongoing LocalNotification w/ Pause/Stop, native + POST_NOTIFICATIONS); **custom deep-log** sections/fields (Customize ▸ Deep log, `cfg-add-deepsec`). The side drawer (v63) improves discovery.
- **v68 — smoother Log + accessibility:** scale/checklist/habit taps now do **surgical class toggles** instead of `renderToday()` full rebuilds — kills the flicker/scroll-jump on the most common interactions (the "not smooth vs Focus Plant" feel). Added `@media (prefers-reduced-motion: reduce)` + `scroll-behavior:smooth`. Browser-verified taps persist correctly.
- QA: no horizontal overflow on any screen (today/time/dash/habits/gym/history/settings/cal/write all 0px); **light theme verified fully light** via screenshot (white bg/cards, dark text, centered footer, working time picker) — resolves the earlier "make it fully white" ask. A read-only bug-hunt subagent ran over app.js in parallel.

## 2026-08-02 — Batch 5: Suri's feedback (v66, live)
Tanglish tester feedback, all web (no rebuild — back button uses the already-bundled @capacitor/app plugin, confirmed `include ':capacitor-app'` in native settings.gradle). Browser-verified.
- **Uniform habit cards:** `.habits { grid-auto-rows: 1fr }` — all cards equal height, clean grid (was ragged with multi-line labels like "Project — Space tech").
- **No nav flash on open:** static index.html nav updated to match the default render (Log/Time/Focus/Stats/Menu) so there's no button-swap; plus `.nav{visibility:hidden}` until JS adds `.ready` after first `renderNav()`.
- **Android back button** (`handleBack` + `@capacitor/app` `backButton` listener): closes any open overlay (drawer/copy-modal/report/exit-confirm) → else navigates to the home/default tab → else shows an "Exit Daily Pulse?" confirm (Stay/Exit; Exit → `App.exitApp()`). Ignores back while alarm ringing or onboarding.
- **Centered Log footer:** wrapped the auto-save hint + Done button in `.log-footer` (flex column, centered).
- Note on the screenshot: onboarding still showed 12 habits on Suri's device because that's their STORED `dp.habitcfg` from a pre-v62 install; new installs get the trimmed 4. Not a bug.

## 2026-08-02 — Batch 4: Stats redesign (v65, live) + native 101/61 uploaded
- **v65 Stats redesign (web, live):** replaced the 17-card scroll-wall with a **segmented control** (`dashTab`: Overview / Time / Checklist) — directly answers testers' "simplify, remove clutter, separate time vs checklist". Overview = key stats + Polymath + mood/energy + insights + connections graph; Time = time analysis + sleep + deep-work + workout volume + gym breakdown; Checklist = habits + tasks + wellbeing scales + tracked numbers + mood calendar/weekday. New **`barChart(values,color,{max})`** — daily trends (mood/energy/sleep/deep-work/workout/polymath) now render as bar charts instead of line charts. Range row hidden on Checklist. Browser + screenshot verified.
- **Native build 101/61 UPLOADED by user** to Play closed testing (was awaiting upload in batch 3). Play showed 2 harmless warnings at Preview&confirm: (1) "no longer supports 20 devices" — RECORD_AUDIO implies an `android.hardware.microphone` feature req, dropping ~20 mic-less devices (~0%, mostly TVs); safe to proceed. Optional future fix: add `<uses-feature android:name="android.hardware.microphone" android:required="false"/>` (needs rebuild → 102). (2) no-deobfuscation-file — expected, we don't obfuscate. User advised to roll out.

## 2026-08-02 — Batch 3: web export fix (v64, live) + native rebuild 101/61 (awaiting upload)
- **v64 (web, live on both repos):** universal `saveFile(filename,content,mime)` — CSV / full-backup JSON / reminders ICS now work INSIDE the app (they silently failed before: WebView has no download manager). Path: Web Share API file → Android share sheet; else a copy-out modal (`showCopyModal`, textarea + Copy/Share). Browser still does a real download. Fixes testers' "export/backup/CSV not working" with no rebuild. Browser-verified all three routes.
- **Native rebuild (NOT web):** `daily-pulse-native` versionCode 100→**101**, versionName 60→**61**; built signed `bundleRelease assembleRelease` (BUILD SUCCESSFUL, ~1m22s). Verified .apk has RECORD_AUDIO + POST_NOTIFICATIONS + USE_FULL_SCREEN_INTENT + AlarmActivity/AlarmReceiver. Copied to `store/assets/DailyPulse.aab`. **USER ACTION: upload this .aab to Play closed testing** → testers get an in-app update (mic needs this; downloads/notifications already handled via web). Mic on-device behaviour untested (no device) — may need manual permission grant first time.
- Clarified to user: web changes need NO tester update (auto); a new .aab DOES (Play update). Production is gated by Google's 14-day closed-testing rule — earliest apply ~Aug 13 (testing started ~Jul 30). Cannot skip.

## 2026-08-02 — Tester feedback batch 2: side-nav drawer + polish (v63, live)
Backup taken first (user asked): tag `backup-v62-live`, branch `backup/v62-pre-navdrawer` (pushed to prod), file snapshot in `.backups/v62-<sha>/`. All below browser-verified, pushed to both repos.
- **Nav overhaul (the big recurring ask — user + 2 testers).** Bottom bar now **capped at 5**: up to `NAV_PRIMARY_MAX = 4` pinned tabs + a **☰ Menu** button. Menu opens a **slide-out side drawer** (right side, `#drawer`/`#drawer-scrim`, `renderDrawer/openDrawer/closeDrawer`) listing **every** screen one tap away, current highlighted, "pinned" badges, + a Settings row. A **'‹ Menu' back button** (`#nav-back` in topbar) appears on any screen that isn't a pinned tab and re-opens the drawer. NOTE: this reverses the earlier "no cap, user chooses count" (v55) — testers explicitly wanted max-5 + side nav; user confirmed "do both". Old `s-more` grid screen is now unreachable/dead (harmless).
- **Clock time picker** for Sleep hrs / Deep-work hrs: `time:true` flag on those DEFAULT_CORE_FIELDS (backfilled onto stored configs in `coreCfg()`); renders `<input type=time>`, converts HH:MM⇄decimal via `hoursToHM`/`hmToHours` (7:30⇄7.5), shows an "x h" hint. Handler branch on `[data-numtime]`.
- **Gym auto-saves** on exercise toggle + debounced as you type each log (new `persistGym(silent)` helper; mirrors count/detail into the day's entry). No more Save-trip.
- **Default habits trimmed 12→4** (Workout, Meditation, Reading, Healthy food) for NEW users; existing testers keep their stored set. Onboarding still lets you add more.
STILL PENDING: unnamed How-to button (need a screenshot to locate), NATIVE rebuild batch (downloads/CSV/PDF via Filesystem+Share, running-timer notification, mic in WebView), Stats redesign (simplify + bar charts, separate time vs checklist).

## 2026-08-02 — Tester feedback batch 1 (v62, live)
App is LIVE in Play closed testing; testers (Kishore's friends) sent ~25 feedback items. Batch 1 shipped (web push → both repos `kishore2494/daily-pulse` prod + `jurnal-app` origin; testers get it on next open). Browser-verified all six:
- **Auto-save on Log** — entries persist on-the-go (700ms debounce via `autosaveDraft()` wired into scale/check/habit/num/txt handlers); Save button relabeled "Done" + "Saves automatically" hint (`.autosave-hint`/`.autosave-dot` CSS).
- **Feedback** — opens mail (`mailto:akishorekumar2494@gmail.com`) instead of GitHub login; `sendFeedback` no longer references github. Still falls back to POST if `FEEDBACK_URL` set.
- **Duplicate History removed** from Settings (kept in More).
- **Mic** — `dictateInto` now `await`s `getUserMedia({audio:true})` to trigger the OS prompt; error toasts point to Settings › Apps › Permissions. Native manifest gained RECORD_AUDIO + MODIFY_AUDIO_SETTINGS (needs native rebuild+reupload to take effect in the installed app).
- **Custom activity emoji** — `emojiSplit()` parses "🍳 Cooking" → {emoji,name}; applied to 3 activity-add sites; placeholder updated.
- **Checklist alignment** — `.habit{min-height:52px}`; reminders row spacing.
STILL PENDING from the batch (bigger/deferred): 5-tab nav + side drawer (recurring ask), Stats redesign, native downloads/CSV/PDF (Filesystem+Share rebuild), running-timer notification, sleep-hrs time picker, fewer default habits, professional icon set, unnamed How-to button (needs a screenshot to locate).

## 2026-07-24 — Wiki bootstrapped
Created the wiki at v52 during an overnight autonomous QA session. Pages: architecture, features, gotchas, play-store, roadmap, schema, index. Facts verified against code (v52, 3455-line app.js, 13 nav tabs, ~24 dp.* keys). A parallel multi-agent audit was running; its verified findings + fixes are recorded in the session REPORT and folded here as applied.

## Backdrop (condensed history to v52)
- v35→v52 built in one long session. Milestones: Time tracker (v36), Sheet Time-Log sync (v37), Stats time analytics (v38), Calendar+events (v40), UI redesign "dark instrument panel" (v41), Write block-editor + Customize v1 (v42), deep-log/gym customizable (v43), EVERYTHING customizable incl. nav/theme/core-fields/gym-split (v44), onboarding + privacy + store prep (v45), data-loss education + feedback form (v46), native full-screen alarm via Capacitor (v47-v49), Play-Store prep, onboarding add-your-own + emoji fixes + guide page (v50), running-timer notification + 2-day inactivity nudge (v51), Focus tab: Pomodoro + Timebox (v52).
- Production repo `kishore2494/daily-pulse` created 2026-07-16; Capacitor native shell replaced the earlier TWA.

## 2026-07-24 — Overnight audit + hardening (v52 → v54)
60-agent adversarial audit (8 dims) + independent runtime QA. 42 confirmed findings (0 crit / 5 high / 20 med / 17 low). Full list in REPORT.md.
FIXED & shipped (v53/v54, browser-verified): field-level entry merge (HIGH data-loss), stored-XSS escaping across Log/Habits/Stats/Gym (2×HIGH), reminder-reschedule no longer cancels pomo/timer/timebox alarms, double-open timelog guard, pomo settings sync (live run stays local), a11y (pinch-zoom, 40px scale tap targets, safe-area-top, nav contrast), polymath NaN guard when all habits hidden.
DEFERRED (see REPORT.md + roadmap): sync-auth/JSONP hardening, list-store concurrent-edit convergence (tombstones), gym union-merge edits, ntfy plaintext labels, perf (full re-renders / layoutGraph / pushState serialize), no boot receiver, exact-alarm Play declaration, custom number/text deep-log fields absent from Stats, 12-tab nav crowding.

## 2026-07-25 — Nav overhaul (v55–v56)
v55: enlarged small icon-button tap targets (40px) + color-mix() fallback (nav layout unchanged per user pref at the time). v56: replaced the crammed 12-tab bar with **5 pinned tabs + More overflow grid**. navCfg gained `primary`; new `renderMore()` launcher screen (`s-more`); default-opening-tab setting (`settings.defaultTab`); Customize ▸ Tabs now has 📌 pin (max 5, enforced), 🎯 default, drag-order, 👁 hide. Legacy navcfg auto-migrates (seeds pins from NAV_DEF). Bottom bar went 12×33px → 6×~65px.

## 2026-07-25 — Nav: remove the 5-tab cap (v57)
Per user: don't force 5 pinned tabs — let them choose how many. Removed MAX_PRIMARY hard cap in renderNav + the pin-cap block in the handler; kept a non-blocking "4-5 stays easiest to tap" tip past 5 pins. Customize labels updated to "pin as many as you like".

## 2026-07-25 — Deep-log: add whole new sections (v58)
Customize ▸ Deep log now has a "New section…" input (emoji-aware) + delete (×) on custom sections (ids `cs*`). Previously you could only add FIELDS to existing sections. New sections render on Log; their scale (1-10) fields flow into Stats wellbeing averages. Verified end-to-end.

## 2026-07-26 — Big customize/stats/report/waves batch (v59)
- Customize is now a HUB of cards (customPage state) → each opens its own sub-page (tabs/log/habits/acts/deep/gym/theme).
- Settings reorganized into menu-rows (Customize / Download report / History / How-to). Sync & login HIDDEN behind `SHOW_SYNC=false` (kept for a future paid feature). ntfy already native-hidden. Feedback: email field removed (goes to owner-only Feedback.gs sheet).
- Nav active tab: stronger highlight (accent-gradient pill + top indicator bar + bold white label).
- Stats completeness: added 🔢 Tracked-numbers card (numeric deep-log field averages) + 🍅 pomodoro-today stat. (Custom habits/activities/scale-fields already flowed in.)
- NEW **Waves** tab: binaural-beat generator (`dp.waves`), 5 presets, ChannelMerger L/R oscillators, auto-stop timer + volume. Non-primary tab (lives in More).
- NEW **Download report (PDF)**: `downloadReport()` builds #print-report + window.print() → Save as PDF (offline). Print CSS hides the app while printing.

## 2026-07-26 — Fixes (v60)
- Settings menu rows: navigated only when the arrow was tapped (handlers used `ev.target.id===` which missed child spans) → switched to `ev.target.closest('#id')`; whole row is tappable now.
- PDF report printed the Settings page instead of the report (print-media class timing). Reworked: report now shows as an on-screen full-screen overlay (`body.reporting`, #print-report) with its own "Save as PDF / Print" + Close buttons; print CSS just hides the action bar. Reliable + testable.

## 2026-07-26 — Marketing landing page
Added landing.html (showcase front page: hero + phone shot, 9-feature grid, screenshot gallery from guide/img, privacy banner, CTAs). Served at /daily-pulse/landing.html — use as the Play Console website URL (can't be the app root, that's the PWA). Reuses guide/img screenshots.

## 2026-07-29 — v59/v60 batch + Play Console submission (handoff written)
Shipped v59 (Customize→hub of sub-pages; Settings reorg w/ menu-rows, Sync hidden via SHOW_SYNC=false, feedback email removed; stronger nav active highlight; Stats numeric-deep-log averages + 🍅 pomodoro stat; NEW Waves binaural-beat tab dp.waves; NEW Download-report-as-PDF via body.reporting overlay + window.print) and v60 (fix: settings menu rows tappable via closest(); report overlay instead of print-media so it stops printing the settings page). Added landing.html marketing page (/daily-pulse/landing.html) + store/assets/ (feature graphic, 5 phone shots 412×820, 3 tablet 1920×1200, DailyPulse.aab/.apk git-ignored). Rebuilt Capacitor bundle to versionCode 100/versionName 60 (targetSdk 36) — replaced the wrong TWA bundle that was uploaded. Play Console: app created, verified, closed-test release with bundle 100 submitting for review; declarations done (data safety=none, ad-ID=no, full-screen-intent core=Other). SHA-256/assetlinks confirmed NOT needed for Capacitor. See play-store.md for the full launch handoff + next steps.

## 2026-07-30 — Theme modes + overflow fix (v61)
Added appearance MODES (settings.mode: navy default / black AMOLED / light) on top of the 6 accent colours. applyTheme() sets data-mode on <html>; CSS overrides base vars per mode + fixes hard-coded dark bits in light (topbar bg/gradient-title, nav, btn-ghost). Selector in Customize ▸ Theme. Also fixed stray horizontal scroll on some screens via overflow-x:clip on .app/.screen (clip, not hidden, to preserve the sticky topbar). Verified all 7 screens overflow-free + light/black render clean.

## 2026-08-26 — analytics depth, trophy case, share cards, and a deploy that lies

**Ingested:** this session's work and its failures.

- **Analytics.** Health-Connect insights wired up for real (4 insights, 13 correlations),
  Best Efforts podium added. Three wrong-field bugs found (`deepWork` vs `deepWorkHours`,
  `'focus'` as a field), plus a **causality bug** — the screen-time insight compared a day's
  screen time against the night that had already *ended* that morning.
- **Thresholds.** Fixed 8,000-step / 7-hour splits meant anyone below those lines would
  never see the insight at all. Everything now splits on the user's own median.
- **Trophy case + share cards.** 54 tiered awards derived from the log (nothing storable,
  nothing losable), five canvas share designs at two ratios, four-rung delivery ladder
  because Android WebView has no Web Share API. `SharePlugin.java` added for the native rung.
- **Eval probe.** Two more false-positive classes (horizontal-scroller `past-viewport`;
  un-composited translucent backgrounds) and one blind spot (overlays never measured).
  Runner now covers all four Stats sub-tabs and the share sheet. Errors held at 8 documented
  accepted cases; penalty 878 vs a 923 baseline while measuring five new surfaces.
- **The important one:** all of v149–v164 was pushed to `origin` while the live app loads
  from `prod`. The site served **v146** the whole time and every command reported success.
  `on: push` also failed to trigger a run at all. `tools/deploy.sh` now proves deployment by
  polling the live URL. See `gotchas.md`.
- **Backups.** `daily-pulse-native` and `daily-pulse-android` had **no backup of any kind**.
  New private repo `kishore2494/daylog-native` + `sync.sh`. 109 retroactive `web-vN` tags on
  both web remotes. **The upload keystore is still unbacked** — new `backups.md` and
  `KEYSTORE.md` state the risk and the fix.

**New pages:** `backups.md`. **Updated:** `gotchas.md` (7 entries), `index.md`, `log.md`.

