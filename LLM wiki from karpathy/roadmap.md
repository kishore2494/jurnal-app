# Roadmap — decided but not built

## Agreed, queued
- **Sync bugs the fuzzer found (2026-11-22, `node tools/check-sync-fuzz.mjs`, listed in `KNOWN` in tests/sync-fuzz.js;
  `STRICT=1` fails on them).** ALL FOUR FIXED (2026-11-22) and MERGED + LIVE since v265 (see log.md):
  1. `day-lww-stale-save` (the big one, ~30% of runs): a habit tick or any day edit on a phone that hasn't pulled
     saves the whole day with a new `updatedAt`, so its OLD mood/journal beats the other phone's typing. Same class
     as v257's autoAt fix. Fix = per-field stamps for day fields (diff against the stored day at save time), merged
     per field like `mergeHabits` / `mergeAuto`. Needs care; the fuzzer is the safety net.
  2. `day-lww-gap-fill` (3 phones): the merge fills a field missing on the newer copy from the older one but
     stamps it with the newer `updatedAt`. Goes away with (1).
  3. `gym-count-not-rederived`: after gym ticks merge, `workoutsDone`/`workoutDetail` are not re-derived (the v263
     time re-sum has no gym twin). Small.
  4. `summary-stale-after-kill`: `_tlDirty` is in memory, so a delete followed by the app being killed within
     1.5 s keeps the old summary on both phones. Persist the dirty days or re-sum on start. Small.
- **Long-form recorder (Kishore, 2026-11-21: "I need to journal a lot but can't type it").** **BUILT 2026-11-22, not
  shipped:** web half on branch `recorder` (features.md ▸ Recordings), native half in daily-pulse-native (build 123,
  log.md). The proposal as written then: Today: voice notes on a
  day/note, 10-minute cap, no pause, webm/opus. Proposed:
  - **Native (build 123):** foreground-service recorder so it keeps going with the screen off; record / pause /
    resume, many takes; a notification with Pause/Stop; saves AAC `.m4a` (plays and imports almost everywhere).
    Shortcuts: long-press the app icon ▸ "Record", and a mic button on the home-screen widget.
  - **Web:** a Recordings screen (☰ menu + a button on the Log): list by day, play with a scrub bar and ±15 s,
    rename, attach to a day, **Export / Share one recording** (Android share sheet), and **Paste transcript** →
    saved into that day's journal. Long recordings stay on the phone and out of backup files (like videos).
  - **Transcription:** export, then Claude on the Mac/inbook can transcribe with local Whisper (offline) and the
    text is pasted back. Waiting on Kishore's go-ahead.
- **Daily users (DAU) plan — proposed 2026-11-21; items 1-5 BUILT the same day (v262 + native 121, see log.md).** Play: DAU 18 / MAU 113 (16%),
  ~43% of installs never open, uninstalls +60%. In order of expected effect:
  1. **Reach more people with notifications.** Permission is asked only at onboarding's end, and only if the
     reminder box stays ticked; quitting onboarding early or unticking = unreachable forever. Ask once after the
     first real log ("Want a nudge tomorrow at 9 pm?") for anyone without permission. Web-only.
  2. **One-tap mood from the notification** — action buttons (😊 / 😐 / 😞) on the "Log my day" reminder via
     `registerActionTypes`; the tap opens the app with the mood saved. Web-only (Capacitor actions).
  3. **Home-screen widget** with today's ring + one-tap mood (`pushWidgetData` already exists, no widget yet).
     Needs a native build.
  4. **Sunday recap notification** — "This week: 5 days logged, best mood Tuesday" (gain framing, local data).
  5. **Shorter onboarding** (4 steps today) so more people reach the reminder step and the first log.
  **Next, proposed 2026-11-23 (Kishore asked "what do we need to do to keep the users?"):** judge items 1-5 on
  2026-12-21 first (they shipped after the baseline window). Daylog has no analytics by design, so "why they
  leave" is unknown; ways to learn it without tracking: Play Console search terms + retained-installers by day
  (screenshots, or bulk reports once AG-31 permission is ticked); an opt-in one-question check-in on day 5
  ("What would make Daylog worth opening every day?", sent only if the user taps Send); reply to every review.
  Product ideas after that: a first insight after 3 logged days (not waiting for Sunday); the ~43 % who never
  open cannot be reached in-app (no notifications before first launch), only by the listing promise.
- **Cloud sync — DECIDED 2026-08-19 (Kishore's plan, supersedes both earlier designs).**
  **Flow:** post-launch update → one What's-new popup + a Settings card → **"Sign in with
  Google"** (native one-tap; accounts chosen deliberately — a lost sync-code means lost data,
  a Google account gives free recovery) → **pay-what-you-want subscription: ₹9 / ₹49 / ₹99
  per month, EXACT same feature at every tier** ("Supporter / Fan / Patron — pick what it's
  worth to you"; three Play Billing subscription products). Honest same-feature tiering fits
  the brand — teardown showed users punish greedy pricing (Forest/Regain) and reward generous
  devs (Loop/How We Feel).
  - **Lapse behaviour:** payment stops → sync PAUSES. Local data always untouched
    (local-first). **Non-negotiable exception: lapsed users can always RESTORE (read/download)
    their cloud copy — they just can't push new changes.** Guards the broken-phone +
    lapsed-sub case, which is Journey's #1 angry-review generator ("stranded with 9 years of
    entries"). Read free forever, write needs payment.
  - **Backend:** blob-per-Google-account. Cloudflare Worker verifies the Google ID token
    (JWKS), stores one opaque-ish blob per `sub` in R2, `If-Match: rev`; existing
    `applyRemoteState` merge reused unchanged. (Firebase is the fallback if the token dance
    fights us.) Free tier ≈ thousands of users at ₹0.
  - **Native work:** Google Sign-In Capacitor plugin → new .aab (109+, post-launch only).
  - **⚠️ Play compliance the accounts trigger:** in-app AND web **account-deletion** flow is
    mandatory once sign-in exists — build it in phase 1, not later. Data Safety form changes
    in the same release (account identifiers + app activity, encrypted in transit, deletable).
    Listing wording becomes "no account required — optional sign-in for cloud sync".
  - **Popups:** the What's-new mention + Settings card only. Never a recurring nag.
  - Phase 0 done: `SHOW_SYNC` is now `!!settings.syncUrl` (app.js), so the sync card only shows for someone who already set up a Sheet (checked 2026-11-01).
- **Google Play Billing** — tip jar shipped (web v246, native 118) — see play-store.md ▸ Merchant setup.
- **Foreground service for the running-timer** — current timer notification with Pause/Stop works while the app process is alive; if Android fully kills the app, actions only apply on relaunch. A true always-live control needs a native foreground service (Java, + Android 14 foregroundServiceType declaration).

## Photos & voice: next steps (from v251, 2026-11-01)
- **Share INTO Daylog** from Google Photos and the gallery: an `ACTION_SEND image/*` intent
  filter plus a small plugin that hands the file to the web layer. Needs a native build.
- **Sharing voice notes in the app:** `DaylogShare.shareImage` hard-codes an image MIME type, so
  the viewer offers Share for photos only. Add `shareFile({base64, mime, filename})`. Native build.
- (Done v253: image block in Write; media on an existing note.)
- Optionally export media as a SEPARATE file once libraries get big; the guard asks past ~35 MB.

## Memories: next steps (from v254, 2026-11-04)
- **Native video share/save:** `DaylogShare.shareImage` is image-only; add a file share that
  streams from a path (not base64) — next native build. Also verify on a real phone that the
  `capture` video input opens the camera in video mode (Capacitor's file chooser) and that a
  long 4K clip stores and plays.
- **Videos out of the phone, by choice:** Kishore chose phone-only; if he loses the phone the
  videos go. Options to offer later: "Save all videos to a folder" (native), or Google Drive.
- ~~History's day page and the Log's "On this day" could list that day's memories.~~ Built v277 (2026-11-28).
- HEIC photos keep no taken date (EXIF is read from JPEG only) — they fall back to the file date.
- A memory's own date does not move its media's `day` when edited (media `day` = taken day).

## Native fixes found 2026-11-01 — DONE in build 119 (built, not uploaded)
- **TimerNotifPlugin:** queue `{action, atMillis}` instead of one overwritten tag, so a Stop or
  Pause from the notification applies at the time it was tapped. Before 119 a Stop at 18:00 seen at
  22:00 counted to 22:00, and Pause + Resume collapsed to just Resume.
- **SharePlugin.shareTextFile:** report whether the user actually shared. Before 119 it resolved as
  soon as the sheet opened, so `dp.lastBackup` was stamped after a cancel on Android ≤9, or
  when saving to Downloads failed.

## User action items (only they can do)
- Finish Google Play identity verification (blocking everything).
- Deploy `Code.gs` (latest) + redeploy new version → unlocks Time Log / Events / Articles Sheet tabs,
  and (v253) stops `_State` pieces and "- …" journal lines coming back as #ERROR!.
  - (DONE 2026-11-02, unreleased (on origin after v253): `doGet` passes `SCRIPT_VERSION` as a second JSONP
    argument; the app keeps it per link in `dp.sheetScript` and says "update your Sheet
    script" in Settings ▸ Backup & restore when it is older than `SHEET_SCRIPT`.)
- Deploy `Feedback.gs` → paste URL into `FEEDBACK_URL` in app.js.
- Back up the upload keystore off-machine — see backups.md.
- Test full-screen alarm + timer notification on the real phone (emulator can't).

## Open questions / deferred
- **Tab count** — the default tab set may still overwhelm new users (5 pinned + menu since v250). Consider a "starter" default that hides advanced tabs.
- Whether to make the Sheet's `Log` columns dynamic (so custom deep-log fields get Sheet columns) — currently fixed.
- Marketing: programmatic-SEO pages — see distribution.md ▸ SEO (separate track).

## Phase 2 — iOS (decided 2026-08-16: AFTER Android production ships)
Android-first confirmed by Kishore. When Android is live:
- `npx cap add ios` in daily-pulse-native (Xcode 26.4 already on this Mac); simulator proof is FREE — no account needed. Distribution/TestFlight needs the **$99/yr Apple Developer account** (Kishore's call).
- iOS differences to plan for: bundle web assets IN the app (Apple rejects remote-URL wrappers; updates then ship via App Store releases), full-screen alarm impossible (degrade to notifications), Health = **HealthKit** not Health Connect, screen time NOT available (FamilyControls is parental-control-only), widgets = WidgetKit/SwiftUI. Speech plugin already supports iOS.
- Zero-cost interim: iPhone users can install the **PWA** (Safari → Add to Home Screen) today.

## From competitor research (2026-08-18) — ranked web-shippable wins
Still unbuilt: ~~PIN lock (S)~~ built v273 (fingerprint unlock = native, later) · ~~flexible habit schedules e.g. 3x/week (M)~~ built v272 · ~~CSV import for entries (S; Money has one)~~ built v274 (Daylio + any sheet) · ~~notes per habit check-in~~ built v275 + ~~week-start setting~~ built v276. Shipped: Year in Pixels (v124) — see competitors.md. Native-only gaps: widgets, Wear OS. Monetization: one-time unlock or free (fits privacy brand).

## Nice-to-haves (not committed)
- Pomodoro count → Stats card. Widget. Data-viz polish on Stats.

## From the 2026-07-24 audit — deferred fixes (prioritize before/around launch)
- **Sync robustness**: (DONE 2026-11-01, v253: the 14 lists with ids merge item by item with
  stamps + delete records — see architecture.md.) ~~Still open: settings-like stores last-writer-wins
  whole; gym union-only; plans whole~~ — ALL FIXED: gym per key + plans per step (2026-11-02,
  `dp.gymAt`, `mergePlans`); settings-like stores by their own change time (v277, `dp.cfgAt`).
  Two phones changing the SAME settings store at once still keep the later whole copy (by design).
  - Found again 2026-11-01 (review 2), both reproduced in a jsdom harness:
    - (DONE 2026-11-01, v253: per-habit stamps `habitsAt`; time-log tombstones `dp.timelogDel`;
      push-after-pull and flush-on-hide. List stores: done too, same day.)
- **Sync security**: the sync URL is an unauthenticated bearer to all data; pull uses JSONP. Add a shared-secret token + CORS fetch with shape validation. Document the secrecy requirement.
- **Native**: fill the SCHEDULE_EXACT_ALARM Play declaration. (Done, build 109: BOOT_COMPLETED receiver, POST_NOTIFICATIONS.)
- **Perf**: renderToday re-renders whole screen per tap; layoutGraph O(N²) on main thread; pushState serializes all stores per keystroke (debounce note-save).
- **Consistency**: (Done: `dp.exercises` is a live list store (LIST_SYNC, merged on pull); fonts are self-hosted, so the privacy claim holds; custom number fields show in Stats as averages; 'Push all to Sheet' sends Events/Articles since v253.)

## Ather scooter data in Daylog (asked 2026-11-22; researched, not built; PARKED by Kishore 2026-11-23: "leave it")

Kishore wants charge alarms ("charge the bike tonight"), km driven and analytics from his Ather scooter.
Findings (2026-11-22):
- **No official API.** Ather's forum thread "Open API and Platform" (2019→) has owners asking for SoC/stats
  endpoints; Ather has not hosted any vehicle feature as an API. Android app id: `com.athermobileapp`.
- **Unofficial API** (blog "Collect Ather Ride Logs using API", anbuchelva.github.io): logs in as the owner and
  calls the app's private endpoints for ride logs. Needs the app's API token, which was captured from `adb logcat`
  until app 11.3.0 removed it (a workaround exists); Ather blocked server-side callers (Apps Script) on
  2024-10-05 and revokes keys periodically. Verdict: works for a hobby bot, too fragile for a Daylog feature, and
  needs Kishore's login (OTP) on a real phone, so it cannot be tested in the emulator alone.
- **Notification route (recommended):** the Ather app pushes "charged to 100 %" (and other) notifications. A
  `NotificationListenerService` in the native shell (user grants "Notification access" once) can read them and
  hand events to the web app: log a charge event, ride summaries if Ather posts them, and raise Daylog's own
  alarm ("charge tonight" rule from the last charge time / days since). No API, no ToS problem, survives app
  updates as long as the texts stay similar. Limit: only what Ather chooses to notify; no live SoC/odometer.
- **Screen reading** (AccessibilityService over the Ather app) would give SoC/km but is heavy and brittle; last resort.
Plan if Kishore says go: native plugin `AtherNotifications` (listener + whitelist `com.athermobileapp`), web side
"Vehicle" section with charge log + "days since charge" alarm; test on Kishore's phone (needs Ather app + login).
Sources: https://forum.atherenergy.com/t/open-api-and-platform/1803 ,
https://anbuchelva.github.io/posts/appscript/collect-ather-logs-using-api/ ,
https://forum.atherenergy.com/t/notification-of-charge-completion/42587

## Be different, not another tracker (Kishore 2026-11-23: "we need to be different… no body expected")

Ideas proposed 2026-11-23. **2 (sealed letters) and 3 (month film) built 2026-11-26, live since web v270** (features.md). **4 (anti-streak) REJECTED by Kishore 2026-11-26: "no we need streak" — keep the streak as it is.** 1 still open (needs build 123 on Play):
1. **Daylog calls you.** Each evening at the user's time, a call-style heads-up notification ("Daylog · your day,
   one minute") with Answer / Not now. Answer opens the recorder; the clip becomes today's entry. Reuses the build-123
   recorder. Doubles as the reminder that fixes the first-3-days drop-off. Play limits true full-screen call screens
   to calling/alarm apps, so it is a high-priority notification styled like a call, not a lock-screen takeover.
2. **Sealed letters to future you.** Write or record a message locked until a chosen date (birthday, New Year, one
   year on); a countdown shows on the Log; it opens only that day. Cheap (journal + recorder exist).
3. **Your month as a film.** On the 1st, a private 30-second story of last month made on the phone: mood colours,
   best day, a voice clip, a photo, sleep. Optional share as video.
4. **The anti-streak promise.** No broken-streak guilt: a "days remembered" count that only goes up (the Log's 🔥
   streak badge would change). A positioning line the store listing can lead with.
Also asked the same day: three more UI styles, Claude-like (Clay), Nothing-like (Dot), Apple-like (Glass), with
neutral names and free look-alike fonts; scheduled to build after the weekly usage reset (board AG-82).

## From the 2026-11-29 research (subagent; web-only ideas, ranked)
Built in v281: ~~Your year~~, ~~Welcome back~~, ~~Rediscover~~. Still open:
- **Threads — a page per #tag / @person** (M): every mention over the years, monthly frequency, first/last
  mention, mood and sleep on those days vs others, next-day effect with the existing confidence labels.
  Evidence: Exist custom tags, Bearable factor-effect report.
- **Life chapters** (M): named date ranges ("Bangalore job"); History grouped by chapter, Stats filter, a
  chapter-vs-chapter card. McAdams' life-story method; no competitor has it.
- **Morning intention, closed in the evening** (S–M): optional, off by default, offered from day 7.
- **Starter mode for new installs** (M, judgment): lean Log + 3 tabs, modules offered as you keep logging.
  Kishore's call — it hides breadth.
