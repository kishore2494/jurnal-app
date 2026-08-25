# Play Store launch — status & handoff

> **STATUS 2026-08-23 — PRODUCTION ACCESS GRANTED.** Applied 2026-08-22 21:07, granted
> within a day. Production track still **Inactive** — access is permission, not a release.
> Next action is to create the production release.
>
> ### ⚠️ THE ONE THING THAT MATTERS NOW
> **Promote 109 (69), NOT 108 (68).** 108 contains the alarm bug (Android 14+ denies
> SCHEDULE_EXACT_ALARM by default → reminders never fired, silently). Only 109 has the fix.
> Version codes only increase, so promoting 108 would ship the bug AND force an immediate
> follow-up. Confirm 109 shows "Available to selected testers" (i.e. it cleared closed-test
> review) before promoting.
>
> ### Recommended: STAGED ROLLOUT, not 100%
> The alarm fix is verified firing on the POCO (Android 11) and verified structurally, but
> **never confirmed on an Android 14+ device** — which is the only platform where the
> original bug exists. Android 11 cannot reproduce it. Start production at a low percentage,
> confirm reminders fire on a real Android 14+ phone, then ramp to 100%.
>
> Play title: `Daylog: Habit Tracker & Mood` · package `io.github.kishore2494.dailypulse`
> (the "dailypulse" id and the hosting URL deliberately keep the old name — changing either
> breaks every install).

_Last updated: 2026-07-29 · app live at v60 · Play Console: closed-test release submitting for review._

## Where we are RIGHT NOW
- Google Play Console account: **kishore_ (Personal)**, identity **verified**. One app: **Daily Pulse**, package **`io.github.kishore2494.dailypulse`**, status **Draft → first closed-test release being submitted for review**.
- **versionCode 105 / versionName 65** (2026-08-18) — adds OEM force-dark opt-out (theme flag + setForceDark OFF): light theme renders correctly under system dark mode on all devices; includes everything from 103/104 (speech, screen time). `store/assets/DailyPulse.aab` = 105. **⏳ UPLOAD THIS ONE.**
- Prior: **versionCode 103 / versionName 63** (2026-08-04) — adds the native **@capacitor-community/speech-recognition@7.0.1** plugin so **Voice typing ("Speak") works inside the app** (Android WebView has NO Web Speech API, so it only ever worked in Chrome/PWA before). Keeps RECORD_AUDIO + mic-optional + native alarms. Built via `npm i` + `npx cap sync android` + gradle (BUILD SUCCESSFUL); verified the RecognitionService `<queries>` merged. File: `store/assets/DailyPulse.aab`. **⏳ UPLOAD to closed testing to test Speak + mic on device.** app.js `dictateNative()` targets `window.Capacitor.Plugins.SpeechRecognition` (available/requestPermissions/start{partialResults}/addListener('partialResults')/stop). Native project backup: `daily-pulse-native/.backup-prespeech/`. Runtime NOT verifiable here (no device) — test on phone.
- Prior built bundle: **versionCode 102 / versionName 62** (2026-08-02) — adds **RECORD_AUDIO + MODIFY_AUDIO_SETTINGS** for mic/dictation, **plus `<uses-feature android:name="android.hardware.microphone" android:required="false"/>`** so NO devices are dropped (verified .apk shows `uses-feature-not-required: microphone`). Keeps native alarms. File: `store/assets/DailyPulse.aab`. **⏳ Upload this to closed testing** — testers get an in-app update; only native changes need a re-upload (web pushes are automatic).
  - History: 100/60 was the first uploaded build. 101/61 (mic, but WITHOUT the optional-feature flag) was uploaded → Play warned it dropped ~20 mic-less devices (6 phones/11 tablets/3 TVs, ~0%). Refixed as 102/62 with the mic marked optional → that warning is gone; user should **Discard the 101 draft** and upload 102.
  - Native project `daily-pulse-native/` is NOT under git (regenerable from Capacitor; loads the remote GitHub Pages URL, so a rebuild only ships manifest/version changes). versionCode lives in `android/app/build.gradle`.
  - ⚠️ Mic caveat: RECORD_AUDIO is declared, but I couldn't test on a real device. Capacitor's WebView *should* grant getUserMedia once the OS permission is held; if the prompt doesn't appear, the user enables it manually in Settings › Apps › Daily Pulse › Permissions (the in-app error toast already says this).
  - ⚠️ An earlier upload was the WRONG bundle (old TWA "2 (47)", no native alarms). It was replaced with 100. If a future release shows a low versionCode, re-upload `store/assets/DailyPulse.aab` (rebuild first — see below).
- Declarations done in Console: **Data safety = collects/shares NO data**; **Advertising ID = No**; **Full-screen intent = core functionality "Other"** (NOT "Alarm clock" — declaring a tracker as an alarm clock is a misdeclaration risk; so FSI is NOT pre-granted on Android 14+, alarm still fires as a high-priority notification and users can enable full-screen manually). **Category = Productivity**.
- **assetlinks/SHA-256 NOT needed** — that was only for the abandoned TWA approach. Capacitor loads the site in a native WebView (always fullscreen). The `.well-known/assetlinks.json` in the repo is harmless leftover.

## Immediate next steps (to actually launch)
1. **Submit the closed-test release for review** (0 errors; the "no deobfuscation file" warning is harmless — we don't obfuscate). Google reviews first release: hours–2 days.
2. **Add ≥12 testers** — Test and release ▸ Testing ▸ Closed testing ▸ your track ▸ **Testers** tab → email list (12 real Google accounts) + share the opt-in link. They must stay opted in **14 continuous days**.
3. After 14 days → **Apply for production** → answer the closed-test questions → Google review → live.
4. Verify the "Finish setting up your app" checklist is all green (privacy policy, content rating=Everyone, target audience 18+, store listing, category, contact).

## Store listing content (all prepared)
- App name: **Daily Pulse: Private Log**. Short/full description + data-safety answers: `store/play-listing.md`.
- Privacy policy URL: `https://kishore2494.github.io/daily-pulse/privacy.html`
- Website URL (for Console contact): `https://kishore2494.github.io/daily-pulse/landing.html` (the marketing landing page).
- Graphics in `store/assets/` (committed to git except the binaries):
  - `feature-graphic.png` 1024×500 · `screenshot-1..5-*.png` 412×820 (≤2:1) · `tablet-1..3.png` 1920×1200 (upload the SAME 3 to BOTH 7-inch and 10-inch slots) · app icon `icons/icon-512.png`.
  - `DailyPulse.aab` / `DailyPulse.apk` — git-IGNORED (rebuildable), sit in `store/assets/` on disk.

## Rebuild the bundle (if needed)
```
cd daily-pulse-native/android
# bump versionCode ABOVE the last uploaded (currently 100) in app/build.gradle
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease assembleRelease
cp app/build/outputs/bundle/release/app-release.aab ../../daily-pulse-app/store/assets/DailyPulse.aab
cp app/build/outputs/apk/release/app-release.apk  ../../daily-pulse-app/store/assets/DailyPulse.apk
```
Verify it has native alarms: `aapt dump xmltree DailyPulse.apk AndroidManifest.xml | grep -iE "AlarmActivity|USE_FULL_SCREEN_INTENT"`.

## Decisions locked
- **Free launch.** Later: optional **₹9/mo cloud-sync subscription** (or ₹99 one-time Pro) via Google Play Billing. Sync/accounts = the premium feature. Sync UI currently HIDDEN in-app (`SHOW_SYNC=false` in renderSettings; code intact). Multi-device sync backend = Firebase (user must create the project) — see roadmap.
- Feedback: email field removed; posts to owner-only `Feedback.gs` sheet.

## Still on the USER (only they can do)
- Deploy the latest **`google-apps-script/Code.gs`** (Time Log/Events/Articles tabs) AND **`Feedback.gs`** in Apps Script, then paste the Feedback web-app URL into **`FEEDBACK_URL`** in app.js (feedback currently falls back to opening a GitHub issue).
- **Back up `daily-pulse-android/android.keystore` + `keystore-password.txt` off-machine** — irreplaceable; losing them = can never update the app.
- Line up the 12 testers.
- Real-phone test of the full-screen alarm + timer notification (emulator can't; MIUI needs manual "show on lock screen" perms).


## 🚨 REJECTION-RISK AUDIT (2026-08-18) — do these before submitting
Audited the shipping bundle (106/66) against Play policy. Findings and status:

| # | Risk | Severity | Status |
|---|---|---|---|
| 1 | **PACKAGE_USAGE_STATS** is a *restricted* permission. Play requires (a) a **prominent in-app disclosure BEFORE** the request, (b) the policy page to disclose it, (c) core-functionality use only. Missing = likely rejection. | HIGH | ✅ FIXED v117 (pre-request disclosure sheet w/ Not-now/Continue; native request only after consent; silent syncs never prompt) |
| 2 | privacy.html had **zero mentions** of screen time / usage access / microphone / health data (predated those features). Mismatch between declared behaviour and app behaviour = rejection + Data-safety violation. | HIGH | ✅ FIXED v117 (new "Device permissions" + "Health-related data" sections) |
| 3 | **Permissions declaration form** in Console must be filled for SCHEDULE_EXACT_ALARM + USE_FULL_SCREEN_INTENT (already answered "Other") and now **usage access** if asked. | MED | ⏳ USER: re-check "App content ▸ Sensitive permissions" after uploading 106 |
| 4 | **Data safety form** must stay accurate: still "collects no data / shares no data". Screen time & mic are on-device only → answer stays No-collection, but be ready to explain in review notes. | MED | ⏳ USER: re-verify, no change expected |
| 5 | **Health & Fitness category = avoid.** Personal dev accounts get extra scrutiny; keep **Productivity**. App makes no medical claims (now stated in the policy too). | MED | ✅ Documented; keep Productivity |
| 6 | RECORD_AUDIO: mic is foreground-only, user-initiated, marked `required=false`. Must be explained in the listing/policy. | LOW | ✅ FIXED v117 (policy) |
| 7 | Duplicate/misleading title: an identical "Daily Pulse" already exists in Health & Fitness. | MED | ⏳ Resolves with the rename (in progress) |
| 8 | targetSdk 36, minSdk 24, signed, no obfuscation → the deobfuscation warning is benign. | NONE | ✅ Fine |

**Review-notes text to paste in Console (helps a human reviewer approve fast):**
> Daylog is a private, offline personal-tracking app. There is no login — all
> functionality is available immediately. Usage access (PACKAGE_USAGE_STATS) is used
> only for the app's optional digital-wellbeing feature: it shows the user their own
> daily screen time on-device and charts it against their mood. The user sees a
> prominent in-app disclosure and must explicitly opt in; the value never leaves the
> device. The microphone is used only while the user taps the on-screen "Speak"
> button to dictate a journal entry, via Android's own speech service. No data is
> collected, transmitted, sold or shared. Not a medical app; no health claims.

## PRODUCTION CHECKLIST (109/69 rolled out 2026-08-22; applying for production)
1. **`SHOW_SYNC = false`** in app.js (Sheet sync is the future paid feature; also keeps the data-safety answer "collects nothing" unambiguous). Ship as a web push before applying.
2. Store listing: **upload the v92 screenshots** (`store/assets/screenshot-1-log…5-streak.png` + `tablet-1..3.png` to BOTH tablet slots) — old ones show the pre-icon design.
3. Verify latest closed-testing build is the one to promote (currently 103/63 with the speech plugin).
4. Re-check "App content": data safety (no collection — still true), ads (none), target audience, privacy policy URL live.
5. Landing page: swap "coming soon" pill → Get-it-on-Google-Play badge after approval.

### Draft answers for Google's production-access questions
- **How did you recruit testers?** "12+ personal contacts (friends/colleagues) recruited directly; they installed via the closed-testing opt-in link and used the app daily as their personal life tracker."
- **How did you collect feedback?** "In-app feedback form (opens the developer's email), plus direct chat messages. Feedback was triaged into a public changelog; ~40 improvements shipped during testing."
- **What did you change based on testing?** "Testers reported: unclear navigation → rebuilt as a fixed 5-tab bar + side menu; manual data entry duplication → time-tracker now auto-fills sleep/deep-work; export/PDF not working on-device → replaced with share-sheet + in-app PDF generation; voice typing not working → added a native speech plugin; plus dark/light theme fixes, streak rewards, and data-loss/stability fixes found via automated audits."
- **Who is the app for?** "Adults who want a private, offline-first daily life tracker (mood, habits, time, workouts, journaling) with all data stored on-device."
- **Expected installs?** modest/organic — personal-productivity niche, no ads.

## When the app goes live
- Swap the landing page's "Coming soon to Google Play" pill for a real **Get it on Google Play** badge + set `product.play_url`.
