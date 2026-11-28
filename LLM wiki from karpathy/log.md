## 2026-11-29 — v280 LIVE (deployed same day): CSV import fills every daily field; Kishore's old sheets converted

- Kishore asked to bring his old Google Sheets into Daylog "without losing data". Route chosen: one CSV through
  Settings ▸ Backup & restore ▸ Import CSV (fill-only, preview, field stamps, pushes to the Sheet). Rejected: a
  backup restore (it REPLACES sections) and writing the Sheet with the sync link (the phone's next push wins).
- v280: `entriesFromCSV` also maps any core field or deep metric by key or label (`csviFieldIndex`): scales → int
  1–10, nums ≥ 0, texts join across rows; habit columns keep priority; `workoutDetail` / `workoutsDone` too.
  7 new unit checks; 4 zones + release checks pass; preview checked at 360 px.
- Converter (scratchpad, not in the repo: private data): Google Form (2 versions, 47 responses), Tracker.xlsx (8 tabs),
  Habbit track, War map (template says 2019, real year 2025 — weekday alignment of the months he re-aligned), Content
  planner (✅ platform → Posted content habit). Sheets swapped day/month whenever the day ≤ 12; fixed by sequence and
  the weekday column. Everything without a field goes to that day's journal under "From my old sheets". Checks: every
  source cell present in the output; the real importer reads all 258 days with 0 cell differences in 4 timezones;
  applying it to his 139 synced days changes none of their values.
- **Import only after v280 is live** — v279 ignores the new columns. Not importable: 144 undated content-planner
  topics. 30 May 2026 already has a Daylog journal, so the form's text for that day must be pasted by hand.

## 2026-11-28 — Play vitals readable: zero crash/ANR reports; bulk reports still pending

- Kishore ticked the ACCOUNT-level "View app information and download bulk reports" and enabled the
  Play Developer Reporting API. The API answered within ~2 minutes.
- New `node daylog-native-backup/play.mjs vitals`: crash rate, ANR rate, crash/ANR report count for the
  last 28 days. First read (Oct 30 – Nov 27): no rows for any of them, so zero reports (Play also
  shows no rate when users are too few). errorCountMetricSet needs dimension `reportType`.
- `play.mjs metrics` (bulk-report CSVs in Cloud Storage) still 403 right after the grant. Google says
  it can take up to 24 h for a service account to get the bucket. Retry on 2026-11-29.

## 2026-11-28 — v279 LIVE (Kishore said "deploy")

- `tools/deploy.sh --tag`: all checks green, tag `web-v279` on both remotes, Pages build success,
  live app.js / sw.js / index.html all serve v279.
- Metrics still blocked. Kishore couldn't find "View app information and download bulk reports":
  it is an ACCOUNT permission, not an app one. Path in the 2026 Play Console: leave the app menu →
  Manage account (or Home) → Users and permissions → service-account row → **Account permissions**
  tab. The Reporting API (vitals) also still needs enabling in Cloud project 387412896984.
- His dashboard screenshot (28 days to 28 Nov): 86 device first opens (+16%), ~146 monthly users,
  67 installs on the 21 Nov release.

## 2026-11-28 — v279 built (not deployed): faster with years of data; metrics still blocked

- Kishore asked "what's next" → "measure first". Seeded 3 years (1,095 days, 6,570 time blocks) in
  headless Chromium at 360px and timed each screen (median of 5, laptop; a phone is ~4–6× slower):
  History 53 → 14 ms, Time 17 → 10 ms, Log 15 → 10 ms, Habits 9 ms, Calendar 7 ms.
  - History: `toLocaleDateString` builds an Intl formatter per call (35 ms for 1,095 dates). New
    `fmtDate(d, opts, loc)` caches one `Intl.DateTimeFormat` per option set; used by prettyDate,
    shortDate, monthLong, longDate, weekdayLong, memDateLong, letterDate, mealWeekday, fin month.
    Same text (test compares 2,000+ dates × options); an invalid date still reads "Invalid Date".
  - Log: `weekStreak` bucketed every day ever logged per render; now walks back week by week
    (`weekDaysLogged`) and stops at the first missed week. Test: 60 random logs equal the old answer.
  - Time: `gapModel` / `gapHistoryDays` looped the whole time log for each of 90 look-back days;
    now filter to the window first. Test: identical model vs the old code.
  - `firstInsight` costs ~7 ms but only until the first-pattern card is dismissed; left alone.
  - Version went v277 → v279 (two bumps while beating the browser cache; v278 never shipped).
- Metrics (Kishore: "see the metrics too"): `play.mjs metrics` still 403 (service account lacks
  "View app information and download bulk reports"); the Play Developer Reporting API (crash/ANR
  rate, daily users) is DISABLED in Cloud project 387412896984. Both need Kishore. Readable now:
  production = 122 (completed); reviews all replied.
- Answered peer session daylog-8a with the Reddit warm-up facts (plan file, rules; username,
  karma and commented posts are not recorded anywhere).

## 2026-11-28 — v277 LIVE: memories on their day + settings sync by own stamp

- Deployed on Kishore's "deploy" (web-v277 on both remotes; live app.js/sw.js/index agree; 360px live smoke, no console errors).

### Built earlier the same day

- Kishore asked "what's next". Built the roadmap's Memories item: History's day page lists that day's memories,
  Back from one returns to the day, and the Log's "On this day" shows them (features.md ▸ Memories ▸ On their day).
- Verified: 4-timezone unit tests (+19 checks, "memday:"), every release check, 360px browser walk (strip →
  day page → memory → back), no console errors. Bumped to v277, What's New w40. Waiting on "deploy".
- Review check the same day: no unreplied reviews.
- **Sync fix folded into v277: settings-like stores by their own change time.** The roadmap's "gym
  untick doesn't propagate" was stale (fixed 2026-11-02, `dp.gymAt`), but its neighbour was real: habit
  list, tabs, fields, budgets etc. adopted the WHOLE copy of whichever phone changed anything later,
  so a habit renamed on phone A was undone by a gym tick on phone B. The fuzzer got a `cfg` step
  (rename a habit; truth = latest save wins whole) and reproduced it in 3 moves; fixed with
  `CFG_SYNC` + `cfgSave()` + `dp.cfgAt` (pushed, merged per store, `cfgRestored` on restore at the
  backup's time, excluded from backups). First version re-pushed forever under clock skew (a phone
  with no stored copy compared `null` to the other's defaults); now only a newer local stamp pushes.
  Verified: 16 unit checks (a mutation back to the old rule fails 3), STRICT fuzz 300 seeds clean,
  4 timezones, all release checks, browser smoke.

## 2026-11-28 — v276 LIVE; fingerprint unlock parked (no device)

- v276 deployed (web-v276, live check, no console errors). Night batch done: v273 App lock, v274 CSV import,
  v275 habit notes, v276 week start — all live.
- Fingerprint unlock (native build 124: androidx.biometric BiometricPrompt, BIOMETRIC_STRONG only, the Daylog
  PIN as fallback) NOT built: inbook was offline (Tailscale: last seen 2 days ago) and this Mac cannot run the
  emulator, so it could not be tested on a device. Build + test it when inbook is back.
- Other sessions checked before stopping: hollpack-cf (FieldProxy backfill) done; kishore-10 (FieldProxy app
  test) done.

## 2026-11-28 — v275 LIVE (habit notes); v276 built: week starts on Sunday or Monday

- v275 deployed (web-v275, live check, no console errors). v276 (features.md ▸ Week starts on): one helper set
  behind every week boundary. Tests 4 zones + every release check pass; checked at 360 px with Sunday first
  (Settings row, Calendar header/offset, Habits heatmap, schedule sheet).

## 2026-11-28 — v274 LIVE (CSV import); v275 built: habit notes

- v274 deployed (web-v274, live check, no console errors). v275: notes on a habit for one day (features.md ▸
  Habit notes). Tests 4 zones + every release check pass; checked at 360 px (Log chip dot, the sheet, Habits card
  with notes, History day). Deploying under Kishore's overnight "and deploy".

## 2026-11-28 — v273 LIVE (App lock); v274 built: import days from a CSV (Daylio / sheets)

- Kishore (going to sleep): "do all things 1 by 1 … and deploy … test every thing". Deployed v273 (web-v273,
  live check + no console errors). Built v274: CSV import (features.md ▸ Import days from a CSV). Tests 4 zones +
  every release check pass; checked at 360 px (card, preview, import → History shows the days, Undo).

## 2026-11-28 — v273 built: App lock (PIN) (NOT deployed)

- Kishore: "what's next … there are tokens you need to complete" → built the next roadmap item, the PIN lock
  (features.md ▸ App lock). PIN + recovery code stored only as PBKDF2 hashes; per-device (not synced, not
  backed up); no flash on open; locks again after a chosen time away; alarms still ring on top.
- Tests 4 zones + every release check pass; checked at 360 px (Settings row + page, set/confirm, recovery code,
  wrong PIN, recovery screen, reload while locked, alarm over the lock). `🔒` card emoji now maps to the new
  `lock` icon (was `dot`). Waits for Kishore's "deploy".

## 2026-11-28 — v272 LIVE (habit schedules); review reply

- Kishore said "deploy". v272 deployed with `tools/deploy.sh --tag`: every check passed, both remotes have
  `web-v272`, live app.js + sw.js report v272, no console errors at 360 px.
- Play review (Harsh kumar, ★5, 2026-11-26, Hinglish): loves the app and its "editable format", says everyone
  should try it. Reply posted: "Bahut shukriya Harsh ji! 🙏 Jaan kar khushi hui ki editable format aapko pasand
  aaya. Sab data aapke phone par hi rehta hai. Dosto ko bhi batayein, aur koi sujhav ho to zaroor likhiye.
  — Kishore, Daylog"

## 2026-11-26 — v272 built: habit schedules (NOT deployed); Sheet box still yellow for Kishore

- Kishore: "yes build habit schedules". Built (features.md ▸ Habit schedules): weekdays or N-a-week per habit, rest
  days never break a streak, N-a-week streaks count weeks, Stats/report percentages count planned days only,
  `bestHabitStreak` fixed to count like the current streak. Tests 4 zones + every release check pass; checked at
  360 px (Log chips, Habits cards, the sheet, Customize, Stats). Waits for Kishore's "deploy".
- Kishore re-pasted Code.gs but the yellow "Sheet script is out of date" box stayed. The app and Code.gs v2 are
  right (the box clears only when a pull answers `{script: 2}`), so his link still serves the old copy: most likely
  the deployment was not edited to **New version** (or a New deployment was made, which gets a new link). The box
  now says how to check: open the link in a browser; the new script's reply ends with `"script":2`.

## 2026-11-26 — decision: streaks stay

- Proposed replacing the top-bar 🔥 streak with an only-up "days remembered" count (roadmap idea 4, plus a middle
  path: keep habit streaks, one free missed day a week). Kishore: "no we need streak". Idea 4 dropped; don't
  re-propose removing or softening the streak.

## 2026-11-26 — web v271 LIVE (film footer button fix)

- Kishore said "deploy". `deploy.sh --tag` passed every check; Pages built first time; live app.js/sw.js/index.html
  say v271 and the live styles.css carries the `.film-btns .btn-ghost` fix.

## 2026-11-26 — web v270 LIVE (sealed letters + month film); v271 fix ready, not deployed

- Kishore said "deploy". `deploy.sh --tag` passed every check, pushed both remotes, tagged `web-v270`; the Pages
  build succeeded first time and the live app.js/sw.js/index.html all say v270.
- **Live test (360×800, live URL):** What's new shows the two new items to a returning user; a letter written and
  sealed live never shows its text; the Log pill reads "Your letter opens in 1 month"; the film plays; no console
  errors. Checked Capacitor's bridge: `Capacitor.Plugins.X` only carries methods the native build really has, so
  build 123 has no `shareFile` and the Play app hides "Make a video" (as designed).
- **Found:** in light styles the film footer's "Restart" was white on white (the styles' own `.btn-ghost` fill).
  Fixed with `!important` on `.film-btns .btn-ghost`, checked in Midnight light, Glass light, Dot, Clay →
  **v271 (a010452), committed and backed up, waiting for "deploy".**

## 2026-11-26 — v270 built: sealed letters + month film (NOT deployed; waiting for "deploy")

- Kishore (2026-11-26): "yes build sealed letters / good about the video do it.. do it…". Built both as web v270
  (d23bdaf): **Letters** (Menu ▸ Letters: write, seal until a day, countdown pill on the Log, ready card + envelope
  opening on the day, notification id 791 in the Play app) and **Month film** (30 s canvas story of a month, Log card
  in the first week, Stats + month deck buttons, "Make a video" → 720×1280 MP4). Details + gotchas in features.md.
- Checks: 1918 unit tests × 4 zones (44 new) + 11/11 release checks. Looked at 360×800: Letters in Midnight, Paper,
  Dot (list, draft, sealed, ready card, opening, read, drawer); film in Midnight and Clay (every scene, recording,
  ready-to-share); Log film card; Stats "Film" button. Headless video export: MP4 720×1280, 32.7 s, 5 MB.
- Fixed during the look: menu cap (Letters became a drawer row, not a tab); faint unselected date chips; bold letter
  text (Sora has no 400); backup-nudge banner over the film (film messages now in its own footer); ▶ emoji box.
- Native: `DaylogShare.shareFile` added to SharePlugin.java for the video share (daylog-native b83001d). Not in any
  build yet: the next native build after 123 carries it; until then the Play app hides "Make a video".
- Reddit drafts refreshed for v269 / build 122 (store/reddit-plan-2026-11.md); Kishore starts the warm-up today.

## 2026-11-23 (03:55) — web v269 LIVE (v268 styles + v269 first pattern / day-5 question)

- Deployed overnight on Kishore's go-ahead before sleeping ("Yes, deploy it and then test it… I give you the
  permission"). `deploy.sh --tag` passed every check, pushed both remotes, tagged `web-v269`. Both the push-triggered
  and the dispatched Pages runs then failed with the GitHub flake "No artifacts named github-pages" (this time BOTH
  failed, so the site stayed on v267); one re-dispatch of pages.yml succeeded and the live app.js/sw.js say v269,
  fonts/self/fraunces.woff2 and doto.woff2 serve 200.
- **Live test (04:00):** headless browser at 360×800 on the live URL: APP_VERSION v269, the What's-new popup shows
  the two new items to a returning user, Clay / Dot / Glass light / Glass dark each render the Log and open Recordings,
  no console errors. Android: the inbook emulator's Daylog (build 123) loaded the live site and showed the v269
  What's-new popup. Emulator stopped afterwards.

## 2026-11-23 (03:10) — v269 built: first pattern + day-5 question; review replies tooling; Play stats still 403

- **v269** (b3e79a0, on top of v268 styles): after the 3rd day logged by hand a one-time Log card shows the best mood
  day so far and what differed (sleep, habits ticked, deep work; at most 3 lines; a plain line if data is thin or flat).
  From day 5 after the first open (`dp.firstSeen`, new; existing users dated from their first entry) one card asks
  "What would make Daylog worth opening every day?"; Send opens the mail app prefilled (FEEDBACK_EMAIL, FEEDBACK_URL is
  still empty), Not now / Send = never again (`dp.checkin`). Both sit in the Log's top `fresh` slot, today only, one
  card at a time (landmark card, notification ask, tour each win). New flags are in BACKUP_EXCLUDED. 17 new tests;
  1874 × 4 zones + 11/11 checks; looked at both cards at 360×800 in Midnight, Clay, Glass. Not built: "time on top
  activity" in the insight (timelog shape is complex; add later if wanted).
- **Reviews:** `play.mjs reviews` / `reply <id> <text>` added (daylog-native 2446b9a). The API returned no reviews: it
  only shows reviews with text from the last 7 days. Older ones must be answered in Play Console ▸ Ratings and reviews.
  A session cron checks daily at 10:13 for 7 days and replies to new ones (Kishore: "Reply to every review. yea do it").
- **Play stats (AG-85):** still 403 at 03:30 on the reports bucket. Kishore must tick "View app information and
  download bulk reports" on the service account's ACCOUNT permissions tab; Google can take up to a day to apply it.

## 2026-11-23 (03:20) — v268 built: three new UI styles, Clay, Dot and Glass (NOT deployed yet)

- Kishore asked for styles in the spirit of Claude, Nothing and Apple; built as **Clay**, **Dot** and **Glass** with
  neutral names (details + gotchas in features.md "UI styles"). WHATS_NEW w33, bump → v268, tests 4 zones (1857) +
  11/11 checks green; looked at every new style at 360×800 (Log + picker, Glass light and dark).
- Found and fixed during the look: Glass frosted the Log top bar over the greeting; the forced date colour was grey on
  the night card; dot-matrix page titles were too big for long titles.
- Ran from the session schedule after the weekly usage reset. Kishore said before sleeping (00:57): "Yes, deploy it
  and then test it… I give you the permission", so the 03:47 job deploys after the 02:53 features job.

## 2026-11-22 (21:25) — Play demo video recorded on an emulator on inbook; recorder verified on Android 14

- Kishore: "inbook emulator". Set up user-level on the Windows laptop (no admin needed in the end: WHPX was already
  usable, so the queued reboot was dropped): `tools/inbook-emu/` has the setup, boot and demo scripts + README.
  Boot ~2 min, taps instant — the Mac could not do this.
- **Build 123 verified on Android 14 (x86_64):** installs, loads v267, first-run pages + tour, Recordings screen,
  RecorderService notification with a running timer, keeps recording on the home screen, Stop and save → a 1:30
  / 725 KB .m4a appears in the list. First native run of the recorder outside unit tests.
- **Video:** `docs/daylog-123-fgs-demo.mp4` (1080×2400, 103 s): start in app → timer → notification shade on the
  home screen → save. Pause/Resume via the notification is not shown (the collapsed notification hides its
  buttons; a second take mis-tapped). Good enough for the Play form. Kishore uploads it unlisted and fills the
  Foreground service permissions form (`store/play-fgs-microphone-123.md`), then the 123 internal upload is re-queued.

## 2026-11-22 (20:35) — second emulator attempt for the Play demo video: still unusable on this Mac

- Kishore asked to "use the emulator". Retried `ciena_phone` with hw.ramSize 1024 / 2 cores / host GPU, first at
  720×1600 (display never composed: screencap black, host-side `adb emu screenrecord` showed a stale launcher
  frame), then at the stock 1080×2400 (renders, but guest load 40–60 from host paging: a tap took up to 9 minutes
  to show, `input tap` landed as long-presses, uiautomator dumps timed out). Build 123 itself ran fine on
  Android 16 (installs, launches, loads v267 from the live site, onboarding shows). AVD config restored from
  backup; `hide_error_dialogs=1` and stay-awake remain set inside the AVD. Verdict unchanged: needs a phone, or
  an x86_64 emulator on inbook (admin: Windows Hypervisor Platform + reboot, ~2 GB download).

## 2026-11-22 (15:45) — v267 LIVE (Recordings); Play refused build 123 until the Foreground-service form is filled

- **v267 live** via board cmd 13 (`run 13`, Kishore). `deploy.sh` reported a failed Pages build, but that was the
  *dispatched* run hitting GitHub's "No artifacts named github-pages" flake; the push-triggered run 4 s earlier
  had already deployed. Live app.js / sw.js / index.html all say v267. Tag `web-v267` on both repos.
- **Build 123 → internal testing refused** (board cmd 14): Play accepted the bundle and the internal release, then
  the edit commit came back `403 You must let us know whether your app uses any Foreground Service permissions`.
  `play.mjs` deletes an uncommitted edit, so nothing changed on Play and versionCode 123 is still free. This is
  the Play Console ▸ App content ▸ Foreground service permissions declaration (`store/play-fgs-microphone-123.md`);
  it blocks even internal-testing uploads, and it wants a demo video — which needs build 123 running somewhere.
  Tried to make the video on this Mac's Android 16 emulator (`ciena_phone`, arm64, headless, host GPU, build 123
  sideloaded): unusable — the 8 GB host had ~100 MB free and 3.3 GB compressed, the kernel spent 60 % CPU paging,
  guest load sat at 45–50 and System UI kept ANR-ing. Stopped it. Internal app sharing is no way round either
  (Play re-signs those builds with its own key). **Path now:** Kishore sideloads `builds/Daylog-123.apk` on a phone
  he can reset (Sync now → uninstall → install), records the video, saves the form, then the internal upload
  is re-queued. `store/play-fgs-microphone-123.md` has the corrected order.

## 2026-11-22 (14:10) — v266 LIVE (hotfix + SEO sweep); v267 (Recordings) committed, deploy queued

- **v266 live** (Kishore: "deploy"): the stale-draft data-loss fix + Lamport-style stamps + the SEO claims sweep.
- Branch `recorder` merged into main (union merge on log.md), WHATS_NEW.v → `w32` (the Recordings item leads the
  popup), bump → **v267** (993edf1, pushed to origin only). Tests + 11 checks green on the merged tree.
  **Not live:** the auto-mode safety check blocked `deploy.sh` and the Play upload; both are queued on the
  board as cmd 13 (deploy v267) and cmd 14 (upload 123 to internal testing). Kishore runs them with `run 13` /
  `run 14`. Kishore's words: "do other things too i give the permission".

## 2026-11-22 (13:40) — recorder review fixes done; native build 123 built (NOT uploaded)

- Review of both halves: no audio-loss bugs; 1 medium (Android Auto Backup copied `files/recordings/` and
  would blow the 25 MB quota, silently stopping the app's whole cloud backup) + 8 low. All fixed: native
  `data_extraction_rules.xml` + `full_backup_content.xml` exclude `recordings/` and `dp_recorder.xml`; native
  60 s watchdog ends with reason `cap` (3 h) / `storage` (<30 MB) / `error` (writer stalled 30 s) plus a "Recording
  stopped" notice; remux keeps the .aac unless the .m4a is complete. Web: reconcile races, widget start always on
  today, Speak blocked while recording, reload guard, `removed:false`, Web Locks across tabs, missing-file rows,
  one start retry. Branch `recorder` @ 34c1d72 (1846 tests × 4 zones, 11/11 checks); native backup branch
  `recorder-native` @ 591b7b1.
- **Build 123** (versionName 83) = live native folder incl. the recorder: `builds/Daylog-123.aab/.apk`, signed
  with the same upload key as 122 (SHA256 14:4D:1F…), `sync.sh` → daylog-native main 1d0aef6, tag `native-123`.
- Play needs the Foreground service permissions form (Microphone) before review: exact answers and the video
  script in `store/play-fgs-microphone-123.md`. Ship order: v266 hotfix → merge `recorder`, deploy v267 → upload
  123 to internal testing → Kishore records the video + fills the form → promote 123 to production.

## 2026-11-22 (13:10) — recorder built on branches (web `recorder`, native in the live folder); NOT released

- **Web half:** branch `recorder` (pushed to origin; main merged in). Recordings screen, both engines, widget/shortcut
  `record` tap, transcript into the journal. 1816 tests. Details in that branch's log.md/features.md/RECORDER-SPEC.md.
- **Native half:** written straight into `daily-pulse-native/` (LongRecorderPlugin, RecorderService (FGS type
  microphone), RecordShortcutActivity, widget mic, manifest perms FOREGROUND_SERVICE(_MICROPHONE)). versionCode
  still 122. assembleDebug OK, emulator-tested. Backed up on `daylog-native` branch **`recorder-native`** (0af0595);
  `daylog-native` main still = released 122. Pre-change snapshot: session scratchpad `native-src-before-recorder.tgz`.
- **⚠ Any native build from the live folder now includes the recorder** and its microphone foreground service, so
  Play will require the App content ▸ Foreground service permissions form (Microphone, "Background Audio Access",
  description + a 30-60 s video) before review. Needed for 123 anyway.
- An independent review of both halves is running; ship order: v266 hotfix → review fixes → merge `recorder` →
  build 123 (Kishore's OK + the FGS form) → deploy web.

## 2026-11-22 (16:30) — Recordings web half: review fixes (branch `recorder`, NOT merged, NOT deployed)

Independent review: no audio-loss bugs; fixed its 8 items + Luxe wrap (3224dbd), each with a test that fails without
the fix (mutation-checked): reconcile skips finishing / list-`recording` ids and never forgets live records when
status() failed or a start is pending; widget start clears `_recFor`; 🎤 Speak refused while recording; reload
waits on a native stop; `removed:false` confirmed via list(); Web Lock per web recording (two tabs); native
records with no file marked "not on this phone"; `start_failed` retried once (300 ms); toasts for the native
side's new `storage`/`cap` reasons. 1846 tests × 4 zones, 11/11 checks.

## 2026-11-22 (13:30) — native recorder: review fixes (backup exclusion, native cap, safer remux)

- Auto Backup / device transfer now exclude `files/recordings/` and `shared_prefs/dp_recorder.xml`
  (`res/xml/data_extraction_rules.xml` for 12+, `full_backup_content.xml` for ≤11, wired in the manifest); all else
  backed up as before. Before: recordings went to Google backup, and ~50 min of audio blew the 25 MB quota, stopping
  the whole app backup (journal included).
- `RecorderService.watch()` every 60 s on the worker: ends with reason `cap` at 3 h recorded, `storage` under 30 MB
  free, `error` when 30 s of recording added no bytes (the ADTS writer dies silently on write errors). Plus an
  OnInfoListener for platform size/duration limits and a one-time "Recording stopped" notification for these endings.
- `remux` returns the copied payload; the .aac is deleted only if the .m4a holds at least that, and the copy is
  skipped (the .aac kept) when free space < source + 8 MB. Spec updated with the new reasons.

## 2026-11-22 (14:00) — long-form recorder, WEB half (branch `recorder`, NOT merged, NOT deployed, no version bump)

Contract: `RECORDER-SPEC.md` (branch root). Details: features.md ▸ Recordings.
- **Recordings screen** (`s-recordings`, `renderRecordings`), in ☰ Menu ▸ Your tabs (`recDrawerHTML`, fixed like Lift,
  not in navcfg) and a **Recordings** button beside 🎤 Speak under the journal (`recLogBtnHTML`; shows "● Recording
  m:ss" while one runs). Not called "Record": the Photos & voice card already has a Record button (voice notes).
- Two engines: native `LongRecorder` when present (feature-detected per method; `status()` + `list()` reconcile at
  start and on every return; `recorderState` drives Pause/Resume/Stop from the notification; final uri always from
  stop()/event/`status().recovered`/list(), never start()'s .aac), else MediaRecorder (24 kbps opus, 4 s slices to
  IndexedDB, wake lock re-asked on return, "keep Daylog open"). Three-hour cap with a ten-minute warning.
- Storage: own IndexedDB `daylog-rec` (stores `recs`, `chunks`), so backups/restore/History never see recordings.
  No dp.* key, nothing synced. Export toast, Storage row ("not in backups") and Delete everything say so; Delete
  everything also removes the native files (`recWipe`).
- Widget/shortcut `{action:'record'}`: routed apart in `drainWidgetActions` (`widgetRecordRoute`); mood taps go
  through `widgetTapsApply` unchanged; fresh tap (≤2 min) starts one recording, a stale one only opens the screen.
- Add transcript → `recTranscriptToDay` → `saveDraftNow` (flushAutosave first, loadDraft if the Log is on that day);
  saved again it replaces its own paragraph (`recJournalMerge`), emptied it takes it out.
- Verified: +116 tests (1816) × 4 timezones, every tools/check-*.mjs. Headless Chromium at 360×800 with a fake mic
  (oscillator → MediaStream; the browse daemon has no fake-media flags): record, pause/resume, a reload mid-recording
  came back as "saved after Daylog closed" (34.5 of 35.5 s), playback + ±15 s seek on the duration-less webm, rename,
  move day, transcript into the journal, share (download), delete + Undo; five styles looked right.
- **Not done / open:** never run inside the Play app or against the real plugin (only a fake shaped like the spec);
  a web-made recording cannot be shared from the Play app (DaylogShare is image/text only); History's day page does
  not list recordings yet.

## 2026-11-22 (12:30) — long-form recorder, NATIVE half (daily-pulse-native, build 123; not built for release, not synced)

Contract: `RECORDER-SPEC.md` (updated with everything below; the web half reads it).
- **Plugin `LongRecorder`** (`LongRecorderPlugin.java`, registered in MainActivity) over **`RecorderService.java`**
  (foreground service, `foregroundServiceType="microphone"`, + `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_MICROPHONE`).
  start/pause/resume/stop/status/list/remove/share + event `recorderState`. Rejections are `reject(msg, code)`:
  invalid, permission, busy, exists, storage (<50 MB), start_failed, not_recording, empty, not_found, share_failed.
  All recorder work on one worker thread; nothing blocks the main or Capacitor plugin thread.
- **Container: ADTS `.aac` while recording, copied (no re-encode) into `.m4a` on stop** (MediaExtractor → MediaMuxer;
  the copy is refused, and the .aac kept, if it would hold <97% of the source). ADTS survives a killed process
  (OEM killer, Android's active-apps "Stop", crash, power off); .m4a gives exact duration, seeking and works with
  every transcriber. The `uri` from start() is the .aac; the final one comes from stop()/the ending event/list().
  A recording cut short is finished on the next status()/list() (`status().recovered`, event reason `recovered`),
  from a `dp_recorder` SharedPreferences record written with commit(). Mono AAC-LC 44.1 kHz 64 kbps ≈ 29 MB/h.
- Notification (channel `dp_recorder`, id 912, LOW): system chronometer = recorded time; Paused shows "Paused at
  m:ss"; Pause/Resume + Stop; re-posted if swiped away (Android 14+ allows that); never shows the title.
- Android 14+: started with startService + startForeground(type MICROPHONE) only from the visible app; a refusal
  rejects `start_failed` with no crash (startForegroundService would risk the 5 s crash). START_NOT_STICKY.
  Swiping from Recents keeps recording (onTaskRemoved saves state). No app wake lock (Play's wake-lock vital).
- **Shortcut "Record"**: `res/xml/shortcuts.xml` → non-exported trampoline `RecordShortcutActivity` (own
  taskAffinity, Theme.NoDisplay) → `WidgetBridgePlugin.queueTap(ctx, "record")` + widgetTap, then MainActivity
  comes forward without the reload a static shortcut's CLEAR_TASK would cause.
- **Widget mic** (`w_mic`, `widget_mic` + `widget_mic_bg`) in all three layouts: full = top right of the header
  (28dp with -4dp margins, row height unchanged), compact/narrow = 32dp after the faces. Token-checked
  `WIDGET_RECORD` intent → `{action:'record'}`. Mood faces unchanged; at 3x1 minimum the faces are ~27dp wide.
- FileProvider: `file_paths.xml` + `<files-path name="recordings" path="recordings/">`; share names the file
  `<title>.m4a` via a hard link (copy if refused) in `cache/recshare/`.
- Verified: `:app:assembleDebug` succeeds; javac -Xlint and Android lint report nothing in the new code (lint's 28
  errors are old: HealthReader java.time NewApi, requestPinAppWidget). No phone attached; **API 36 emulator
  (`ciena_phone`) run, debug APK uninstalled after**: start → busy → pause → resume → stop gave a valid .m4a
  (afinfo: AAC mono 44.1 kHz 64 kbps), events at every step, list/share/not_found/invalid OK, share sheet opened
  with the named copy (the hard link was refused there; the copy fallback ran); crash recovery (planted cut-short
  .aac + live record) → `status().recovered` once, .m4a 46.8 s; mic failure → `start_failed`, nothing left behind;
  widget intent with a wrong token queues nothing, right token and the shortcut trampoline (launcher flags) each
  queue `{action:'record'}` + widgetTap with no WebView reload. The emulator was starved by host swap (dropped
  audio: 123 s wall time gave 47 s of audio; its system_server watchdog-restarted once), so timings mean nothing.
  NOT tested: a real phone, the notification's buttons, the widget drawn on a home screen, a real launcher
  long-press, OEM battery killers, stop() time on an hour-long file.
- **Play: before build 123 can go to review, Kishore fills App content ▸ Foreground service permissions**
  (microphone ▸ "Background Audio Access", description, impact if deferred/interrupted, a video link showing a
  recording started in the app). versionCode NOT bumped; `daylog-native-backup/sync.sh` NOT run.
## 2026-11-22 (12:55) — HIGH data-loss bug found in live v265, fixed on main (needs "deploy")

Adversarial review of the v265 per-field sync (repro harness + scenarios in the session scratchpad `review/`).
- **HIGH (live):** `syncHealth` saved the GLOBAL Log draft into today. The draft is `{}` after a cold start on a
  non-Log default tab (only `openToday`/a changed pull/habit or notification taps load it) and still yesterday's
  after midnight with the Log off screen. With `fieldAt` a missing field is a removal, so the day's mood, journal
  etc. were deleted on every phone and the Sheet (v264 lost them only on that phone; a single phone loses them
  in both). **Fix:** `syncHealth` decides from the stored day and saves a fresh copy of it (and never overwrites a
  stored sleep value); plus a general guard, `draftRebase` in `saveDraftNow`: `loadDraft` records the stored day
  each draft came from (`_draftBase`, a WeakMap) and every field/habit the draft has not changed since then takes
  the day as stored now. Also fixes **two tabs of one browser** (tab 1's mood tap deleted tab 2's journal) and the
  **midnight rollover** variant. Drafts not made by `loadDraft` (widget, Lift, gym…) have no base and save as is.
- **Clock skew:** `entryFieldStamp`, `entryAutoSet`, `habitTouch` stamp `max(now, old + 1)` so an edit made after
  seeing a value wins even on a phone whose clock is behind. The fuzzer oracle now reads the app's own
  `fieldAt`/`habitsAt` for day fields/habits (it used the writer's skewed clock and flagged the correct result).
- Rollout-only effects accepted: a v264 phone counts a day holding only `fieldAt` as logged; v264 edits can lose
  to v265 stamps until every phone updates.
- Tests: section 8 in the two-phones block (never-loaded draft, two tabs, rollover, skew); 4 fail with the rebase
  commented out. 1707 × 4 timezones, 11/11 checks, `STRICT=1 SEEDS=200` fuzz green. Reviewer's scenarios s1/s3/s4/s5
  all correct on main.

## 2026-11-22 (13:00) — SEO pages: iOS, Sheet-sync and habit-count claims removed (branch `seo-sweep`, NOT merged, NOT deployed)

Closes the open item from the landing-refresh entry. A scripted sweep (counted exact-string rules; nothing
written unless every count matched) changed 140 files: 128 factory pages, 8 `daily-pulse-vs-*`, use-cases.html,
llms.txt, and the generator inputs `factory-data.json` + `copy-cache.json`.
- **iOS:** `operatingSystem` "Android, iOS, Web" → "Android, Web" (128 JSON-LD blocks); comparison Platform row
  "Android, iOS, web" → Android (Google Play) + any modern browser, no iOS app, add to the iPhone home screen (8).
- **Sheet sync:** new users are not offered it (`SHOW_SYNC = !!s.syncUrl`; only reconnect doors for old users),
  so it is gone from the one-liner (→ "private on your device, with no account"), the offline / private FAQs
  (→ export a backup file; no account, no Daylog server), "Private by default", the comparison rows/FAQs
  (→ backup or CSV export) and 10 hand-written persona lines. It also said "one-way"; the sync is two-way.
- **Other:** "10-habit checklist" / "up to ten habits" → a checklist of your own habits (4 starters, no cap);
  two "lock screen" claims dropped; llms.txt privacy line no longer says the Sheet is the only network feature
  (ntfy too) and points to the privacy policy. Kept: sheets-setup.html, privacy.html, the photo pages' "not sent
  to the Sheet" lines. Rules + a lint grep in distribution.md ▸ Rules.
11/11 checks, 1700 unit tests (UTC), sitemap check, 264 JSON-LD blocks parse; 3 pages looked at 360 px.

## 2026-11-22 (12:10) — web v265 DEPLOYED (Kishore: "deploy")

Live and confirmed (app.js, sw.js, index.html all v265; tag `web-v265` on both repos). Contents: per-field day
sync (`fieldAt`), gym re-derive after a pull, persisted `dp.tlDirty`, stale-draft reload after a pull, the 9
review fixes, midnight timebox "now" + coverage never over 100%, landing refresh. One WHATS_NEW line added to w31
("Two phones, field by field") without bumping `WHATS_NEW.v` (fixes don't warrant a popup). Play production track
shows 122 "completed" (the API doesn't say whether Google's review has finished). Metrics bucket still 403.
Started on branches (not merged): recorder (web + native, spec in the `recorder` worktree's RECORDER-SPEC.md),
an adversarial review of the v265 sync, and the SEO-page claims sweep (`seo-sweep`).

## 2026-11-22 (04:50) — the 4 fuzzer sync bugs fixed (main, NOT deployed); one extra guard added in review

Helper branch `sync-fixes` merged: per-field day stamps `fieldAt` (`entryFieldStamp` in DB.putEntry/liftWrite,
`mergeFields` in the pull; unstamped sides fall back to `updatedAt`), `gymRederive` after a pull, `dp.tlDirty`
persisted so a kill before the re-sum can't strand a summary. Fuzzer `KNOWN` is empty; STRICT runs pass.
**My review found a hole and closed it:** removals now travel, so a stale Log draft saved in the background
(syncHealth saves the global draft while the Log is off screen) deleted the other phone's journal — reproduced
in a test (fails without the fix), fixed by `loadDraft()` after any pull that changed data (63d023d).
1700 tests × 4 timezones, 11/11 checks, STRICT fuzz 200 seeds green. Known limit: during rollout an older app's
edits don't stamp `fieldAt`, the same weakness habitsAt/autoAt have.

## 2026-11-22 (06:30) — the four fuzzer sync bugs fixed (branch `sync-fixes`, NOT merged, NOT deployed)

- **day-lww-stale-save + day-lww-gap-fill:** every day field (not habits / ENTRY_AUTO / updatedAt) has its own
  stamp `fieldAt[field]`. `entryFieldStamp(prev, next)` in `DB.putEntry` and `liftWrite` diffs against the stored
  day (changed/removed → now; unchanged keeps its stamp; first save since stamps → the day's old updatedAt).
  `mergeFields` merges per field, unstamped side falls back to its updatedAt (as `mergeAuto`).
- **gym-count-not-rederived:** `gymRederive(days)` after a pull, for days whose gym ticks the pull changed.
- **summary-stale-after-kill:** dirty days also kept on disk in `dp.tlDirty` (BACKUP_EXCLUDED), taken by
  `syncTimelogNow`, re-summed at start-up when present.
- Fuzzer `KNOWN` is empty; `STRICT=1` passes 300 seeds (1–300) and 600 (5000–5599); plain 500 passes.

## 2026-11-22 (04:00) — the 9 review findings fixed + sync fuzzer merged (main, NOT deployed)

- **review-fixes** (helper; each finding test-first, one commit each): #5 today's "Log my day" kept when
  rescheduled in the last minute; #2 saveDraftNow copies-or-deletes ENTRY_AUTO + autoAt from the stored day; #3 the
  ask card waits for Android's answer — a refusal no longer spends `dp.notifAsk` or says "Reminder set", and an
  existing "Log my day" is reused (an alarm-mode one becomes a notification); #4 sample days/blocks ignored by
  nudgeInput/lastActiveDay; #6 tip ask reachable on 122+ (combined rating budget); #1 replayed notification
  presses ignored (`dp.notifDone`, last 50, BACKUP_EXCLUDED); #7 a second "Log my day" rings as a normal reminder;
  #8 Health Connect sleep fill saved only into a day already logged by hand; #9 `updateTimeSummaries(days)`:
  one pass, one read, one write — 3 years of data 4.1 s → 0.07 s, identical output. Not done: phones in different
  time zones still overwrite each other's summaries.
- **sync-fuzz**: `tools/check-sync-fuzz.mjs` (50 seeds, ~8 s; in deploy.sh and CI; `SEEDS=500`, `STRICT=1`,
  `SEED=n TRACE=1`). Found 4 sync bugs → roadmap.md (not fixed).
1662 tests × 4 timezones, 11/11 checks on main. With the time fixes + landing refresh, ships as v265 on "deploy".

## 2026-11-22 (00:05) — review of v260..v264: 9 findings, NOT fixed yet (fix next session)

Helper review (read-only; scratch repros in the session scratchpad). Ranked:
1. Notification mood button REPLAYS on a later cold start (launch intent re-delivered; `onNudgeAction` ~13659):
   stray toast, or an old mood saved to today. Fix: remember handled `notifId|extra.day|actionId`. PLAUSIBLE.
2. Deleted time summary comes back from a stale Log draft (`saveDraftNow` ~2986 copies ENTRY_AUTO only when the
   stored entry has them). Fix: copy-or-delete each ENTRY_AUTO key + autoAt from the stored entry. CONFIRMED.
3. Ask card toasts "Reminder set" when permission is denied, and spends `dp.notifAsk`. Re-check after the request. CONFIRMED.
4. Sample data counts as logged days in `nudgeInput`/`lastActiveDay` (recap from demo rows). Filter `.sample`. CONFIRMED.
5. Today's "Log my day" dropped when rescheduled in the minute before (`at <= now + 60000`, ~13579). Use `<= now`. CONFIRMED.
6. Tip ask never appears on build 122+ (rate card returns early, `asks` never grows). Settle on combined budget. CONFIRMED.
7. Two synced "Log my day" reminders: only one rings. Exclude only the one nudgeInput picked, by id. PLAUSIBLE.
8. Health Connect sleep fill makes `loggedByHand` true for Sheet users. Persist fill only if already hand-logged. PLAUSIBLE.
9. Time re-sum slow with years of data (3 y ≈ 7–9 s on a Mac); phones in different time zones overwrite summaries.
Clean: planner DST/midnight, ids, widget taps, onboarding exits, recap weekdays, rating budget math.

## 2026-11-22 (00:00) — merged to main, NOT deployed: time-tracker fixes + website refresh

- `time-fixes-2` (helper, reviewed): midnight time boxes are "now" (`tbLive`; last night's block leads Today as
  "● now · since yesterday"); day totals use the union of blocks (`coveredMs`, `actTotalsMs`): Stats coverage
  was 250% / "60h" on an overlapped day, the same activity counted twice in summaries and in the Log's sleep /
  deep-work fill-in. +25 tests (1620). No phone-width browser look yet (the visible change is the Today label).
- `landing-refresh` (helper, checked at 360/1280 px): "Widget & reminders" section, lifelog title/meta, meals
  card, two-screen setup; small fixes in lifelog-app.html, guide.html (old Play title, "Health Connect coming
  next"), llms.txt. **Open:** 136 factory pages claim "Android, iOS, Web" in structured data (never claim iOS)
  and pitch Sheet sync that new users can't see — a sed sweep, not done.
4 timezones + 10/10 checks on main after both merges. Ship as v265 on Kishore's "deploy".

## 2026-11-21 (23:40) — build 122 uploaded to Play production; Hindi listing drafted

- Kishore: "upload 122". `play.mjs upload builds/Daylog-122.aab --track production --name "122 (82)"`, same notes
  as 121 (most phones go 120 → 122). `status`: production = 122. In Google review.
- `store/listing-hi-IN-draft.json` + `listing-hi-IN-notes.md` (helper): title `Daylog: डायरी, मूड और आदतें` (27),
  short 77, full 3846; says on line 2 that the app's screens are English. NOT published — needs Kishore's call
  (the app itself is English-only) and a native speaker's read (questions in the notes, §6).
## 2026-11-22 — Sync fuzz harness (branch sync-fuzz, not merged): four known sync bugs found

`tools/check-sync-fuzz.mjs` + `tests/sync-fuzz.js` (ported from the parked agent-ae6722… WIP onto v264): 2–3
phones, fake Sheet (last push wins), fake clock with skew, seeded random edits through the real save paths and
random sync orders (late pull replies, stale pulls, offline, out-of-order pushes); then every phone syncs and it
checks converge / no-loss / no-zombie / dup-id / derived / settle / quiet. Failing seeds shrink to minimal repros.
Wired into deploy.sh and CI; known bugs are reported, not failed (`STRICT=1` fails them). Found, NOT fixed:
1. **day-lww-stale-save** — mood/journal share one `updatedAt`; a save of the day on a phone that has not pulled
   (most often one Habits-screen tick → saveDraftNow) carries its old mood/journal over the other phone's newer
   typing. Repro: C types journal; A (not pulled) ticks a habit on that day → journal lost on all phones.
2. **day-lww-gap-fill** (3 phones) — the day merge fills a field the newer copy lacks from the older copy but
   stamps it with the newer `updatedAt`, so it then beats a later edit on the third phone. Repro: A mood=4,
   B mood=10 (neither pulled), C ticks a habit on that (to C, empty) day → mood 4 everywhere.
3. **gym-count-not-rederived** — gym ticks merge per tick, but `workoutsDone`/`workoutDetail` are not re-derived
   after a pull (v263 did this for timeSummary only): A ticks e1, B ticks e2 → day holds 2 ticks, count says 1.
4. **summary-stale-after-kill** — deleting a day's last block and closing the app within 1.5 s (before
   syncTimelogNow) loses `_tlDirty`; the emptied day keeps its old timeSummary on every phone.
Bite proof: 9 of 10 injected merge bugs caught in 40 seeds; the list half of `remoteBehind` survived 600 seeds.

## 2026-11-21 (23:30) — Play listing approved and live; build 122 upload waits for Kishore's OK

Public Play page (fetched 23:28 IST): title "Daylog: Lifelog, Mood & Habits", the sunset icon, the new
description (mentions the home-screen widget), "Updated on 21 Nov 2026" — so the listing change and, most
likely, build 121 are approved. Reports bucket found from the developer id in the notes:
`pubsite_prod_5724262917689037597` (saved in daylog-native-backup/play-config.json); it answers 403 for now,
i.e. the new "download bulk reports" permission had not propagated yet (Google says up to a day). Uploading 122
was stopped by the session's safety check: a production upload needs Kishore's explicit OK for that build.
## 2026-11-21 — Time review's last two bugs fixed on branch `time-fixes-2` (NOT merged / NOT deployed)

- **Midnight time boxes are "now":** `tbLive(b, now)` — an end before the start (23:00–01:00) ends the next
  morning; equal start/end is an empty block, not 24 h. After midnight the Today view lists last night's
  block first while it is still on ("● now · since yesterday"). `timeboxHTML(now)` takes the moment for tests.
- **Overlapping blocks count once:** `coveredMs(clips, lo, hi)` (union, clamped) and `actTotalsMs(clips)`
  (per activity: the SAME activity's overlaps once; DIFFERENT activities over one hour each keep it — only
  day totals are a union). Used by Stats coverage % + tracked h (was 250% on a doubled day), the Time
  screen's Tracked/untracked line, `updateTimeSummary`, `trackedHours`/`trackedSleepHours` (Log fill-in),
  the day page, Best days, both reports, the month wrap-up and compare-periods.
+25 tests, written first (on old main 16 fail: 14 asserts + 2 "helper missing"). Closes the Nov 2 Time review.

## 2026-11-21 — v264 LIVE (tag web-v264): rating sheet web side

Deployed on Kishore's "deploy". Only change since v263: the in-app rating code (features.md ▸ Rating asks), inert
until build 122 is installed. No What's new item (nothing visible to announce). Build 122 upload waits for 121's approval.

## 2026-11-21 — Reddit launch plan written (store/reddit-plan-2026-11.md)

Kishore asked for exact subreddits and exact posts that won't get him banned. A helper wrote the plan; I checked it
(no blanks, 11 distinct referrer links, accurate claims: no "without opening the app", no sync mention since
`SHOW_SYNC` hides it). Reddit blocked every automated read, so no rule is verified first-hand: the plan has a
2-minute sidebar check before each post. The r/SideProject draft shares real numbers (200+ installs, 47%
conversion, ~9 visitors/day); Kishore decides whether to publish those. distribution.md ▸ Reddit launch.

## 2026-11-21 — Play in-app rating sheet: native 122 built, web side on main (NOT deployed / NOT uploaded)

Kishore said yes to asking happy users for a rating. A helper built it; I reviewed and merged:
- **Native 122 / "82":** `InAppReviewPlugin.java` (`request()` → requestReviewFlow + launchReviewFlow, never
  rejects), registered in MainActivity, `com.google.android.play:review:2.0.2`. `builds/Daylog-122.aab/.apk`,
  cert SHA-256 144d1f76…d728 (same as 121), 0 .so, no new permissions; backup commit 47ea4aa, tag native-122.
- **Web (merged 29a77be):** `maybeAskReview` and friends — see features.md ▸ Rating asks.
- **My change on top:** the app already had a rate card (`maybeAskForReview`, `dp.rateAsk`) that promised "at
  most twice, ever"; with both, one person could be asked 4 times. Now one budget of two across both, none
  after a tap on Rate, and the card stands aside when the plugin exists. +5 tests.
1595 tests × 4 timezones, 10/10 checks. Web side is inert without the plugin, so it can deploy before 122.
**Upload 122 only after 121 is approved** — a new production upload replaces the release under review.

## 2026-11-21 — Play title + descriptions changed by API (1-month experiment); metrics log started

Kishore: push the ASO text now, log the metrics locally, roll back after a month if it underperforms.
- Saved what Play served first: `store/listing-live-before-2026-11-21.json` (title `Daylog: Habit Tracker & Mood`).
- Pushed `store/listing-new-2026-11-21.json`: title `Daylog: Lifelog, Mood & Habits`, short + full from
  `aso-2026-11.md`, updated for v263 (widget + notification buttons as "New", Memories, meal planner, five looks).
  Read back from the API: 30/30, 80/80, 3575/4000. Under Google review.
- `store/metrics-log.md`: experiment notes, rollback command, judge date 2026-12-21, and the Nov 21 baseline row.
- Reading metrics automatically: the Reporting API is not enabled on project `daylog-publish` and only gives
  vitals anyway. Installs/uninstalls/active devices/store visitors come from the bulk-report bucket:
  `play.mjs metrics` is written and its UTF-16 CSV parsing tested, but it needs Kishore to (1) give
  daylog-publisher "download bulk reports" access and (2) paste the bucket's Cloud Storage URI. DAU/MAU stay Console-only.

## 2026-11-21 — v263 LIVE (tag web-v263): two-phone time summary fixed

Kishore: "fix the two phone time bug". The bug the Nov 2 review flagged (a timer re-sum bumping
`updatedAt`, so a stale phone's mood won) was already fixed in v257 (`autoAt`); memory still called it
open. What was still wrong, both reproduced in tests that fail on the old code:
- **Both phones track the same day before syncing:** the blocks merged, but the summary was the one
  written last, so it lacked the other phone's activities until a block changed again. Now a pull
  re-sums each day whose blocks it changed (`timelogChangedDays`, at the end of `applyRemoteState`).
- **Deleting the last block of a day** (on either phone) left its summary for good. Now
  `updateTimeSummary` drops it with an `autoAt` stamp (the deletion syncs; the Sheet cell blanks),
  and `DB.saveTimelog` records changed days in `_tlDirty` so emptied/moved-from days get re-summed.
Deployed on Kishore's "deploy"; deploy.sh confirmed app.js, sw.js and index.html all serve v263. What's new: one line
added as item 4 of w31 (no new popup for a small sync fix).
+15 tests (two-phone cases 5–6, helper cases). 1572 × 4 timezones, 10/10 checks. No UI change, so
no browser check. Still open from that review: midnight time boxes never "now"; coverage >100% with
overlapping blocks. architecture.md ▸ "Day fields other screens fill in".

## 2026-11-21 — Play phone screenshots replaced with store/brand/out/store-1..8 (by API)

Kishore: "screenshots too". `play.mjs set-image phoneScreenshots store-1-memories … store-8-private` (1080×1920,
8 files); `images` afterwards lists the 8 local sha256s in order; production still 121. The 3 tablet screenshots
(sevenInch/tenInch) are still the old set — nothing new was made for tablets. Under Google review like the icon.
Also at 19:50 Kishore said stop; two background agents (v262 bug review, fix-time clobber fix) were started and
stopped unfinished — nothing from them landed.

## 2026-11-21 — Play listing icon + feature graphic replaced with the sunset brand (by API)

Kishore: "update the logo too … OK do it". The store still showed the old pulse-line icon and the old "Habits,
mood & screen time" feature graphic. `play.mjs set-image icon store/brand/out/play-icon-512.png` and
`set-image featureGraphic store/brand/out/feature-graphic.png`; `images` afterwards shows both with the local
files' exact sha256 (ba7a2843…, 699c0006…). Each was its own committed edit; listing changes go through Google
review. Production track still 121 afterwards. **Left alone:** the 8 phone screenshots (an older design set,
no logo in them) and the 3 tablet ones — `store/brand/out/store-1..8` is the newer set, swap only if Kishore asks.

## 2026-11-21 — native 121 uploaded to Play production (first upload by API)

Kishore picked "production, everyone at once" over a 20% rollout or internal first. `play.mjs upload
../builds/Daylog-121.aab --track production --name "121 (81)"` (bundle sha256 7ab5d72f… = the gradle output).
Play accepted versionCode 121; commit went through without `changesNotSentForReview`, so it was sent for
review automatically. `status` afterwards: production = 121 completed. The API says "completed" while Google is
still reviewing — it reaches phones after review. Release notes: widget, mood from the notification, Sunday
recap, quicker setup. Not yet verified on a real phone: the widget and the notification mood buttons.

## 2026-11-21 — Play API upload works: `daylog-native-backup/play.mjs`

Kishore: "you don't have direct access to upload this?" … "I think I have already done it". He had: a prior
session created service account `daylog-publisher` and committed its key to `daylog-native-backup/signing/
play-publisher.json` (2026-10-14) but never wrote an uploader. Wrote `play.mjs` (no deps: JWT → token →
androidpublisher v3 edits). `status` verified the key: **production = 120** (so the Nov 15 release was 120),
alpha = 110, internal empty, **121 not uploaded**. play-store.md banner updated with the commands.

## 2026-11-21 — v262 LIVE (tag web-v262); Kishore uploads native 121 next

Deployed on Kishore's "deploy" (he then uploads `builds/Daylog-121.aab` himself). deploy.sh passed every check and
pushed both remotes + tags, but **the Pages build failed on GitHub's side** ("No artifacts named github-pages were
found" — both the push-triggered and the dispatched run, same minute). Re-dispatching `pages.yml` once fixed it
(run 44902647643, success); the live app.js, sw.js cache and index.html `?v=` all say v262. Pitfall worth
remembering: that artifact error is a GitHub flake, not our build — re-dispatch before debugging anything.

## 2026-11-21 — v262 + native 121 BUILT (NOT deployed / NOT uploaded): the daily-users push

Kishore: "there are lots of tokens, can you use that to build it" (the DAU plan in roadmap.md). Built in parallel,
merged one at a time into main:
- **Mine (notifications):** 🙂/😐/😕 mood buttons on every log notification (`NOTIF_MOODS`, `applyNotifMood`);
  Sunday "Log my day" = week recap (`weekRecapCopy`); one-time Log card after the first real log asking for a
  reminder / to switch notifications on (`notifAskKind`, `dp.notifAsk`). features.md ▸ Alarms & notifications.
- **Agent: onboarding 2 steps (was 4), tour 4 steps (was 8).** Style picker and add-your-own rows left onboarding.
  features.md ▸ Onboarding. Open question for Kishore: keep the style picker out?
- **Agent: home-screen widget**, native build **121 / versionName 81** (`builds/Daylog-121.aab/.apk`, same signing
  cert as 120, no .so files, backed up + tagged `native-121`). features.md ▸ Home-screen widget.
- What's new w31 (widget, log from the notification + Sunday recap). APP_VERSION v262.
Verified: 1557 unit tests × 4 timezones, every tools/check-*.mjs; agents checked onboarding at 360/412 px and the
widget's web side at 412 px with a fake plugin. NOT verified: the widget on a real phone; the notification buttons
on a real phone. **Order:** deploy web v262 first (or together), then upload 121 — otherwise widget taps wait in the
native queue until the web side arrives.

## 2026-11-21 — v261 LIVE (tag web-v261): come-back nudges + smarter "Log my day"

Deployed on Kishore's "deploy" 2026-11-21; deploy.sh confirmed the live URL serves v261 (app.js, sw.js, index.html agree).
Not yet confirmed on a phone that the notifications fire.


Kishore, after the Play stats (DAU ≈ 16% of MAU, uninstalls +60%): "push the notification 1 day after… it needs to
trigger them to open it"; "we need to increase the every day users". Found two leaks: the daily "Log my day"
reminder was only scheduled 7 days ahead (on each open), so a user who stopped opening heard nothing after a week;
and the come-back nudge fired once (day 2) and never again. Now one planner, `nudgePlan()` (features.md ▸ Alarms &
notifications): the reminder's next 7 days with day-to-day copy, skipped today once logged by hand; come-back
nudges at day 1 (new users) or 2, then 5, 10, 20, 30; one per day max; every tap opens the Log. Web-only, no Play
build needed. Settings row renamed "Come-back nudges" (it used to promise "nothing else ever"); What's new w30.
Limits worth knowing: nothing can reach someone who never opened the app or never granted notifications
(Android 13+): permission is asked only at the end of onboarding when the reminder box is ticked.
Verified: 1446 unit tests × 4 timezones (24 new), every tools/check-*.mjs. NOT checked in a phone-sized browser
(the browser step was blocked by the session's safety check); the visible change is one Settings row's text and
one What's new item.

## 2026-11-21 — Play Console snapshot (Oct 23 – Nov 19) + the "16 KB devices" warning

From Kishore's screenshots of the Play Console dashboard (28 days vs the previous 28):
- Device acquisitions 127 (+59%), first opens 73 (+38%): only ~57% of new installs open the app.
- Total installs 232 (+122), active devices ~82: about 35% of everyone who ever installed still has it.
- DAU 18.2 avg, MAU 113: DAU/MAU ≈ 16% (a daily log should aim for 30%+).
- User loss 2.96/day (+60%) against 4.61/day acquisitions.
- Store listing: 8.6 visitors/day, 47.1% conversion (+15.3 pp). The listing converts well; traffic is the limit.
- Rating 5★. Crash and ANR rates show "Data unavailable" (too few users). Revenue ₹50 (first tip).
- Latest production release dated 2026-11-15, 100% rollout, 63 installs, 62.4% install base
  (which versionCode it was is not confirmed yet; build 120 is the likely one).
- **"Your app may crash on 16 KB devices" does not apply to our builds:** none of them contains any `.so`
  native library (checked every .aab/.apk in `builds/` 113–120 and the old TWA build in
  `daily-pulse-android/`). 16 KB page alignment only matters for native libraries. If the warning
  stays, open it in Play Console to see which versionCode it names; it is probably an old bundle.

## 2026-11-16 (evening) — v260 LIVE (tag web-v260): blink fix + greeting on any opening tab

- **Every screen blinked once** ~0.8s after opening (Kishore, on his Realme RMX3231). Cause: v259's
  entrance put `.enter` on the screen with `.screen.enter { animation: none }`; removing the class at
  900ms re-armed `.screen.on { animation: fade }`, so the whole screen replayed its fade from opacity 0.
  Fix: `screenRise(sec)` marks the screen's top-level children `.rise` once, after the render, and
  `.screen.on { animation: none }` for good. Proven on the phone (Chrome over adb reverse + CDP):
  live v259 showed `fade` with screen opacity 0.00 on every screen; the fix shows none, and no child
  ever drops back below 0.5. Screen recordings agree (no frame change at +0.8s). gotchas.md ▸ CSS.
- **Greeting on any opening tab** (Kishore: "what if the user sets another first screen?"):
  `homeGreetHTML`/`homeGreetSync` put a compact hero (date, greeting, today's % as a ring button
  that opens the Log, streak) in `#home-greet`, outside the screens, only on the `defaultTab()`
  screen when that is not the Log. 7 unit tests.
- Deployed on Kishore's "deploy". Verified after deploy on his phone: live site in Chrome (CDP probe: no
  screen animation, opacity stays 1.00 on 6 screens) and the real Daylog app (Settings shows v260;
  screen recordings of Stats/Time/Focus/Log taps: no frame change later than 0.4s after navigation).
- Tests ran on **inbook** (repo cloned to `C:\Users\gskee\projects\p\daylog\daily-pulse-app`;
  in PowerShell use `npm.cmd`, not `npm`, since script execution is disabled).

## 2026-11-16 — v259 LIVE (tag web-v259): Lift, Meals, premium look (two rounds)

Kishore (2026-11-15): "the UI is not modern… we need to wow the users"; "if the mood feels low give
them things to do"; "we may can have the meal planned". Four worktree agents, merged one at a time:
- Lift (low-mood support) and Meals (planner, shopping list, Today's meals on the Log): entries below.
- Visual pass round 1: greeting hero, gradient ring, colour mood field, tick pop, floating frosted nav,
  Stats/Habits polish (CSS block at the end of styles.css).
- Round 2: the top of the Log is ONE hero panel (date chip holding #log-date, greeting, ring, sleep and
  deep-work tiles, streak/week line); On this day is a swipeable mood-tinted strip; an empty Tasks
  section is a slim "+ Add a task" row. Past day: "Editing Friday" + Back to today.
- Mine: Search finds planned meals (and the planned name after a swap); What's new w29; bump v259.
Verified: 1412+ unit tests in 4 timezones, every tools/check-*.mjs, browser at 412 and 360 px (no
overflow, no console errors). Meals stays `adv` (☰ ▸ More features) because of the ≤9 fresh-install
destinations rule. Deployed on Kishore's "deploy" 2026-11-16; deploy.sh confirmed the live URL serves v259.

## 2026-11-16 — Log hero round 2 (branch worktree-agent-a8d33da650b032e09, NOT merged/deployed)

Kishore: "not a polished wow UI". The top of the Log was 4 cards (greeting, ring card, tall On this day
card, date pill + Sleep/Deep work figures) and said the date twice. Now ONE panel, `logHeroHTML(tiles)`:
eyebrow date + "Today ▾" chip (holds `#log-date`), greeting, the ring beside the glance tiles (still
`[data-gl]` tap-to-edit; the pickers open as `.card.gl-edit` right under the hero), streak + week line
in `.lh-foot` (`logHeroFootHTML`, refreshed by `refreshTodayRing`). Past day: "Editing Friday", the chip
shows the day, `[data-lh-today]` "Back to today" fires the normal date change. Section rules: `ring`
draws nothing in place — it is in the hero whenever shown, whatever its order; `core` keeps only scale /
plain-number fields as `.card.core-more`. On this day = scroll-snap strip of mood-tinted `.otd-c` cards
(all 4 marks, not 2). No tasks = `.task-slim` "+ Add a task" row (same ids; TOUR step targets it).
While the hero is on screen the top bar is click-through and hides its flame badge. CSS: one block at
the end of styles.css, per-style `--hx-*` tokens; Midnight is a night-sky panel in light AND dark.
Verified: 1412 tests × 4 timezones, every check, shots in all 6 looks + past day / ring hidden / fresh
install / 360px. No version bump, no WHATS_NEW item (add when merging).

## 2026-11-15 — Lift: low-mood support (branch worktree-agent-a42815294431461c7, NOT merged/deployed)

Kishore: "if the mood feels low we need to give them some kind of things like that". Built as a new
screen `lift` (features.md ▸ Lift). A low mood on today's Log shows a warm card under the mood grid
(Log section `lift`); the drawer always has a "Lift" row. No new dp.* key: `entry.lift = {did, hide}`.
Talk to someone lists Tele-MANAS (14416 / 1-800-891-4416) and findahelpline.com. 46 unit tests.
Verified at 412px in midnight light/dark, paper, luxe, aurora, bloom. Not in WHATS_NEW yet.

## 2026-11-15 — Meals: weekly planner, shopping list, Today's meals on the Log (branch, NOT merged)

Built in worktree branch `worktree-agent-a7d95bec3ba692ed9` (parallel with a low-mood support feature
and a visual polish pass). New screen `meals` (☰ ▸ More features), three new LIST_SYNC stores
`dp.meals` / `dp.meallib` / `dp.mealshop`, Log section `meals` (hidden until a meal is planned).
Details and deferred items: features.md ▸ Meals. Verified: 1344 unit tests in 4 timezones, every
`tools/check-*.mjs`, and screenshots at 412×900 in midnight light/dark, paper light/dark, luxe,
aurora, bloom. No version bump, no WHATS_NEW item yet (add both when merging).

## 2026-11-15 — native 120 rebuilt with R8 (Play "Obfuscation 1%" warning, fix by Feb 2027)

minifyEnabled + shrinkResources ON. Runtime-verified on the emulator (Medium_Phone_API_36.1, headless):
app renders; FullScreenAlarm.status/openFullScreenSettings, HealthConnect.isAvailable/day/screenTimeForDay,
LocalNotifications, DaylogShare, DaylogBilling all answer through the WebView (checked via adb-forwarded
webview_devtools_remote). APK 5.4 → 1.8 MB; mapping ships in the .aab. Also: screenTimeForDay now ends open
stretches at screen-off (an app left in front while the phone sleeps was counted to midnight).
`builds/Daylog-120.aab` replaced with this build; tag native-120 moved to it. Still NOT uploaded.
**How to verify a native build on the emulator:** boot `-no-window`, install the release APK, `adb forward
tcp:9555 localabstract:webview_devtools_remote_<pid>`, then CDP Runtime.evaluate `Capacitor.Plugins.X.method()`.

## 2026-11-15 — everything Daylog moved into one folder: ~/Documents/p/daylog/

Kishore wants one folder to open in Claude and run several sessions on. Moved `daily-pulse-app`,
`daily-pulse-native`, `daily-pulse-android`, `daylog-native-backup` into `~/Documents/p/daylog/`
(names unchanged), the `.aab/.apk` builds into `daylog/builds/`, the device test reports into
`daylog/docs/`. Updated hard-coded paths: native `build.gradle` signing (keystore), `daylog-native-backup/sync.sh`
SRC_ROOT, `tools/test-alarm.sh`, README, backups.md, play-store.md, KEYSTORE.md, the old TWA files.
`git worktree repair` run; the five merged 2026-11-09 helper worktrees removed (branches kept).
New `daylog/CLAUDE.md` = folder map + commands + rules; Claude memory seeded at
`~/.claude/projects/-Users-kishore-Documents-p-daylog/memory/`; permissions copied to `daylog/.claude/`.
Verified after the move: 1282 tests, all checks, Gradle signing config resolves.

## 2026-11-15 — v258 + native 120: alarm Fix page, Deep log switch, whole-day health, Log glance card

Kishore reported: full-screen alarm always "off", Deep log missing, screen time lower than the phone's,
sleep/distance blank, and the Log's date/sleep/deep-work card looking dated.
- **Alarm:** the 'fsi' Fix opened app notification settings; the Android 14+ switch is Special app access ▸
  Full screen notifications. New native `FullScreenAlarm.openFullScreenSettings` (ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
  JS uses it, older builds get the path in a toast.
- **Deep log:** off on the Log by default (`LOG_SECTIONS_DEF` off:true) and Customize ▸ Deep log never said so.
  It now has a "Show on the Log screen" switch (`data-deep-show`).
- **Health:** only "today so far" was ever stored, so a day kept its value from the last sync. Native 120 adds
  `HealthConnect.day({date})` (full day; sleep window 18:00 prev → 14:00) and `screenTimeForDay({date})`
  (pairs per activity class, reads from 6 h before midnight, clips to the day, skips launcher + systemui;
  also returns the longest overnight screen-off gap ≥3 h as `idleSleepMinutes`). `syncHealth` re-reads
  today + 2 previous days when those exist. Fallbacks marked `distEst` (steps × 0.76 m) and `sleepEst` (phone idle).
- **Log:** the core card is now "at a glance": date pill over a hidden date input, Sleep / Deep work figures
  with their source (`glanceTileHTML`, `_glanceOpen`); pickers open on tap.
- Native 120 (versionName 80) also carries the new sunrise launcher icon. Built, backed up (`native-120`),
  NOT uploaded. Files: `~/Documents/p/Daylog-120.aab/.apk`.

## 2026-11-09 (morning) — v257 built: overnight helper work merged (NOT deployed)

Five worktree helpers, each reviewed, merged, tested (1276 × 4 timezones, all checks, every screen × 5 styles clean):
- **Sync:** Time tracker / Gym fields carry their own `autoAt` stamps (`ENTRY_AUTO`, `entryAutoSet`, `mergeAuto`) and no longer bump `updatedAt` — a stale phone's timer/gym tick could overwrite the other phone's mood and journal. (`fix-time` branch had no real fix; written fresh.)
- **Stats:** plain words instead of `r=`, "N vs M days logged", Polymath explained, every card names its period, "More stats" fold.
- **Inline edit** of task / plan-step / project-step text (`inlineEdit`); **Timebox** Today/Tomorrow, copy plan, edit block, alarms soonest-first.
- **Web Back:** history guard stack (`hbInit`, 6 guards, `popstate` → `handleBack`), web-only; Exit goes back past Daylog. Verify on a real phone browser.
- **Memories** import starts with a story block, tile grid + sticky toolbar in edit; **Money** Record on top, category from note/last used (`finGuessCat`); **Ask** names ignored words, filters money by note.

## 2026-11-09 (overnight) — new brand, Play Store set and landing page (committed, NOT uploaded/deployed)

Kishore: "we need distribution… improve the logo and banners and images", then "do whatever you want
to improve this system" before sleeping. Done:
- **Logo:** a sunrise half-sun (amber→coral→rose) over three cream journal lines on deep ink
  (`store/brand/daylog-logo.svg`). Replaced the heartbeat line (read as a health/ECG app). Installed as
  `icons/icon-192/512/maskable-512.png` (web app, manifest, landing, favicon) and in `og-card.png`
  (`tools/make-og-card.py` accent now #ff8a4c). Two rejected concepts: a fitness-style "day ring", a
  document-icon "day page".
- **Native launcher icon:** `store/brand/android-res/` (adaptive foreground per density, legacy + round,
  background #15172F). NOT applied — copying it into daily-pulse-native needs a native build + upload.
- **Play set** in `store/brand/out/`: play-icon-512, feature-graphic (1024×500), store-1..8 (1080×1920).
  Each frame shows a real screen in one of the five styles, headline type matching that style;
  generator `store/brand/store-frames.html`, captures in `store/brand/screens/`, how-to in its README.
- **Listing text draft:** `store/listing-2026-11-08.md` (short 77, full 2,379, notes 389 chars). Title
  change still Kishore's call.
- **landing.html rebuilt** in the new brand (self-hosted fonts, real v256 screens as webp in `site/img/`,
  same Play referrer campaigns and footer links). guide.html no longer calls Google Fonts.
- Fixed `tools/seed-store-data.js` crashing on the gap day it deletes.
**Kishore must:** upload the icon, feature graphic and 8 screenshots in Play Console (remove the August
set); OK a native build for the launcher icon; say "deploy" for the web icon/landing to go live.

## 2026-11-08 — v256: five UI styles the user picks (DEPLOYED, tag web-v256)

Kishore: "the UI was not rich and classy and not fancy… and let the users choose the UI too".
Added `UI_STYLES` + `<html data-style>`: **Midnight** (unchanged default), **Paper** (Notion-like:
ink on white / Notion dark, Newsreader serif headings, flat hairline cards; follows light/dark),
**Luxe** (warm black + champagne gold, Cormorant Garamond, uppercase tracked labels/buttons, 3px
radius; always dark), **Aurora** (animated aurora behind glass cards, Bricolage Grotesque, 24px
radius; always dark; motion off under prefers-reduced-motion), **Bloom** (cream + coral, Fredoka,
pill buttons, floating rounded bottom bar; always light). Picker with live preview tiles in
Settings ▸ "Style & appearance" (new first row), Customize ▸ "Style & dark mode", and a new
onboarding step 1 "Pick your look" (onboarding is now 4 steps). Accent colours apply to Midnight
only (`applyTheme` removes the inline accent vars otherwise). Fonts self-hosted in fonts/self
(+167 KB, precached — check-release requires it). Rules: a style may FORCE the mode
(`mode: 'dark'|'light'`); hard-coded Midnight light fixes still apply under data-mode=light.
Tests 1110 × 4 timezones (+12); all 20 screens × 5 styles: no overflow, no page errors.
Play listing (public): 100+ downloads, 5.0★ from 10 reviews (2026-11-08).

## 2026-11-07 — v255: the real-user UX pass (built, tested, deploying)

Kishore: "lots of UI and UX gaps … think like a real user", then "deploy and test it properly".
Three auditor agents clicked through every screen at 360/390px, dark and light, new user and
day-40 user (~45 findings). **Fixed in v255:**
- **Undo** (`undoToast`, `restoreItems`) for task / plan-step / project-step / note / timebox
  deletes, Clear completed, and hiding a Log card. A restore re-stamps the item newer than its
  delete record, so sync keeps it. Time blocks have no undo (separate `timelogDel` tombstones).
- **Habits screen**: "Mark done" per habit (`habitTodayToggle`, writes today's entry, reloads the
  Log draft), "Edit habits", empty state, week-column heatmap with today outlined. Habit tap is
  now tick ↔ untick; skip is the toast's "Skip today" (was done → SKIP → clear).
- **Today ring**: default 0s no longer count; the mood grid counts (mood/energy are hidden fields).
  Past-day edit says "This day", no streak/week lines.
- **Nav**: History + Search not advanced (one-time `dp.navmig255` unhide for existing installs);
  "Cal" → "Calendar". Fresh install now shows 9 destinations (test threshold raised to 9).
- **Reminders**: catch-up skips a reminder whose `listAt` stamp is after its time today (adding a
  21:00 reminder at 22:46 rang a MISSED alarm at once; web/PWA only).
- **Stats**: storage `.st-row` CSS was unscoped and squashed the Mood tile to 18px — scoped to `.st-rows`.
- **What's new**: 4 newest + "Earlier changes", list scrolls inside the box, ✕ and backdrop close.
- **Search**: every word must match (not the phrase), whole-word snippets, all words bolded,
  clear ✕; memories' place/people/tags searchable.
- **Memories/Write**: `docRenameLinks` rewrites `[[old]]` on title change (and an untitled memory's
  date change); `docDiscardIfEmpty` drops a page left blank on Back/Done/leaving.
- **Back**: open project → list; Customize opened from Habits/Gym → back there; Money forms close.
- **Smaller**: tour skips absent Health steps and targets `#patterns-card`; contradictory patterns
  hidden; untyped inputs styled (`input:not([type])`); 44px hit areas on checkboxes/×/drag;
  Enter adds in Projects/Time; Time "All blocks" list + nearest-block tap; Focus "⏹ End" needs two
  taps, clamped values shown, (min) labels; Waves solid Stop + a "playing" bar on every screen;
  timebox defaults to the next half hour; Gym "Finish workout", last reps as placeholder, "last done"
  tag, Edit link; project "No activity yet"/"Needs you"; feedback draft kept; backup nudge is a
  neutral toast with "Back up" (and never for sample data); exports named `daylog-*`; History mood
  emoji matches the mood; onboarding says Settings ▸ not More ▸.
Tests 1098 × 4 timezones (+31 new; 9/10 mutations caught). Both browser passes: no page errors,
no sideways scroll.
**Deferred (not done):** Log screen reorder (mood first, date in header); Stats jargon (r=…,
Polymath, Range picker scope); inline edit of task/step text; one add/back pattern across
Tasks/Plans/Projects; Tabs & navigation labelled controls; web/PWA history-based Back
(popstate); imported memories' story block first; Money sticky Record + last-used category;
Ask admitting ignored words; delete-everything counting memories/notes/money; timebox
tomorrow/copy-yesterday; Settings Appearance row (Theme renamed "Theme & dark mode" only).

## 2026-11-04 — v254 DEPLOYED (Memories + every fix since v253)

Kishore: "then pushed to live", then "try noww". Two deploy attempts failed on a GitHub outage
(git pushes returned 500, 15:20 IST onward); the background retry got origin through, and
`tools/deploy.sh --tag` then passed every check (1066 tests × 4 timezones), pushed prod
370ec07..76749fd, tagged `web-v254` on both remotes, and the live app.js, sw.js and index.html
all serve v254. Live files checked for Memories, SHEET_SCRIPT 2 and the setup page's update
section. **Kishore must re-paste the Sheet script (SCRIPT_VERSION 2) and deploy a new version.**
Native 119 still not uploaded.

## 2026-11-04 — Memories: a Notion-style page per moment, with videos (built, NOT deployed)

Kishore: "I need this to be live documentation … document the memories that I have, photos,
videos … like if we do this in notion or obsidian". Asked three questions; answers: inside
Daylog; videos + a story per memory + a timeline + bulk import, Notion/Obsidian style; big files
on the phone only. Built as features.md ▸ Memories describes: memory = a Write page with
`kind:'memory'` and properties; shared block editor gains video and voice blocks; read view
with cover, property chips, `[[links]]`, backlinks and "same people or place"; timeline with
search, facets and On this day; bulk import grouped by the taken date (EXIF / MP4 `mvhd` /
file date). Videos are kept as recorded and are NOT in backups (said everywhere it matters).
Fixed on the way: the viewer counted a memory's cover twice. Verified in headless Chrome with
real files; 1065 tests (UTC). Not deployed; no version bump yet.

## 2026-11-02 (01:25) — the sprint hit the weekly limit; what landed and what is parked

Kishore: "now it was reseted don't use just finish what is in progress". Nothing new started.
**On main (pushed, NOT deployed, no version bump yet):**
- Backup & restore: nine fixes from review 6 (7767db1, 532fa40): a sync reply landing after
  "Delete everything" no longer restores it all; a pending push no longer posts the empty
  state; sample rows cleared before a restore; `dp.touched` set from the backup; a partial
  restore no longer ends onboarding; `lastBackup` not stamped on copy-only/partial exports;
  the backup's delete records honoured; future `_at` clamped; list/object shape refused;
  CSV quotes `\r` and skips sample days. Tests for these are NOT written yet (branch
  `tests-backup` holds the reviewer's start). 1021 tests, 4 timezones, all checks pass.
- Wiki lint commits 1 and 2 (76d59eb, ed28c50). Commit 3 (play-store history section,
  log.md reorder) was not done.
**Parked in worktree branches (WIP commits, untested, do not merge as is):**
- `worktree-agent-ae099bcea5a6daba1` — settings-like stores merge per entry (code + tests
  in progress).
- `fix-time` — the Time-tracker review's fixes (findings: `updateTimeSummary` bumps
  `updatedAt` so a stale phone's mood beats the other's — REAL two-phone bug, unfixed on
  main; a deleted last block keeps its timeSummary; midnight time boxes never "now";
  coverage >100% with overlaps). Repros in the session scratchpad `review-time/`.
- `tests-backup` — unit tests for the review-6 fixes.
- `worktree-agent-a907a6abb6c0c8a1a` — a11y labelling edits, mid-batch.
- `worktree-agent-ae6722ffd04046f39` — fuzz harness for the sync merge, nearly runnable.
- `worktree-agent-a85ff139d97c6486f` — perf pass, measurement script only.
- The sync reviewer's third pass (plans/gym merge) never reported.
**Next session:** finish `fix-time` first (real bug), then `tests-backup`, then decide on
the rest; then `tools/bump.sh` and Kishore's "deploy".

## 2026-11-02 (01:15) — wiki lint 2/3: deduplicate

Each repeated to-do now lives on one page; the others point to it:
- keystore back-up → backups.md (roadmap, gotchas, play-store pointed).
- Code.gs / Feedback.gs deploy → roadmap.md ▸ User action items (play-store's "Still on the
  USER" list replaced by a pointer; its testers item was obsolete).
- version-bump rule → gotchas.md ▸ Deploy / git, rewritten as "run tools/bump.sh" (architecture,
  index pointed).
- the 128 SEO pages → distribution.md ▸ SEO (gotchas, roadmap pointed).
- photos/voice open items → roadmap.md ▸ Photos & voice (features pointed).
- features.md table: the Pomodoro/Timebox notes cell moved from the Waves row to the Focus row.

## 2026-11-02 (01:15) — wiki lint 1/3: contradictions and stale facts

Lint report applied (facts re-checked against app.js, the native project and git tags):
- features/roadmap: Write image block + note media are done (v253); the three v253 sync
  bullets (un-tick, dropped block, last-1.2 s save) deleted; one-tap share shipped natively
  (113+) — strava-build.md too; test count no longer stated (see this log).
- play-store: header now "LIVE since 2026-08-26, native 118, web v253"; `SHOW_SYNC` is
  `!!s.syncUrl` (not false); sync plan is Google sign-in + Cloudflare, not Firebase (index too);
  tip-jar products replace the ₹9/₹99 idea; build 118 published (date: Kishore to confirm).
- roadmap: tab-count item rewritten (5 pinned + menu since v250); BOOT receiver +
  POST_NOTIFICATIONS done (build 109); `dp.exercises` is live, not dead; Pixels / mood grid /
  gallery marked shipped (competitors.md too); "v254" → unreleased (on origin after v253),
  architecture.md too; build-119 notes in past tense; no `daily-pulse-factory/` folder (gotchas too).
- architecture: real line counts, 75 `dp.*` keys with the missing 14 in the table, full native
  plugin list, release = bump.sh + deploy.sh.
- gotchas: assetlinks is a TWA leftover; `DEFAULT_CORE_FIELDS` (no `FIELDS`). backups: tags
  web-v30…web-v253 (152), native-112…119. distribution: insight line is app.js:4313.
  behaviour-audit: attention volume fixed v241. schema: topic-page list complete.
  index: one link style.

## 2026-11-02 (01:10) — plans merge step by step, gym per key (merged); the 01:01 sprint

Kishore set a trigger for 01:01 to spend the whole window before the weekly reset at 02:00.
- **Merged the builder branch** (6396c2d): plan checklists merge per step (`planItems`,
  `planFields` sub-maps inside listAt/listDel; `mergePlans`, `planSide` for stamp-less sides);
  gym days per key (`dp.gymAt`, `gymMerge`, `flushGymSave` before a pull / on day switch /
  pagehide). 78 tests, 77/77 mutations caught by the builder. Resolved against main; the
  two restore helpers now stamp at the backup's time, the review-5 rule. 1020 tests.
- A restore link that only *times out* is kept for a retry instead of being cleared.
- Seven agents launched in parallel in worktrees: settings-store per-entry merge; adversarial
  reviews of backup/restore and the Time tracker; a11y/phone-width audit; a fuzz harness for
  the sync merge wired into the release checks; wiki lint; performance pass. The sync reviewer
  is attacking the plans/gym merge. Results are folded in below as they land.

## 2026-11-02 (00:30) — review 5, second pass: restore stamps per item; adoption keeps unseen adds

The reviewer's second pass on the fixes (fuzzers clean, five repros pass) found three more:
- **A backup's `_at` beat an edit older than the file but newer than its contents** (a phone
  that had not pulled exports stale items under a fresh time). Backups now carry `_stamps`
  (listAt/listDel at export) and each item is restored at its own change time; `_at` is only
  the fallback. Commit 428587c.
- **Adopting a v252 list deleted an item the old phone never saw** (my fix for finding 2 of
  pass 1). Reverted to no delete records for dropped items — a resurrected delete beats a lost
  addition — and an item stamped after the old phone's save is now kept outright (`adoptList`).
- **A restore undoes a delete synced from the other phone.** KEPT as a trade-off: restoring is
  the person's explicit act; the alternative is a restore that undoes itself on the next pull.
  Documented in `listRestored`.
942 tests. Pending: builder agent (plans items + gym per-key merge); Kishore's 01:01 trigger
to spend the remaining window.

## 2026-11-02 (early) — review 5: five real v253 sync bugs fixed (not deployed)

An adversarial review agent (fuzzed 2- and 3-phone sims, ±10 min clock skew, malformed
data; all repros under the session scratchpad `review/`) found five bugs; all reproduced
against the `web-v253` tag, all fixed on main, all repros pass against main.
1. **Restoring a backup on a new phone rolled back later edits on every phone** (data loss,
   LIVE in v253). `listRestored` stamped restored items "now". Now stamped at the backup's
   time: `_at` (new in backups), else the newest day/time block in it. Unchanged items keep
   their stamp. See architecture.md ▸ Restore.
2. **A delete on a phone still on v252 came back everywhere.** Whole-list adoption now goes
   through `listSave(…, remote.touched)`.
3. **`cut_` could split an emoji** in `_State` → two replacement marks, spread by the merge.
   Fixed in Code.gs (script version stays 2 — the version bump was in the same unreleased
   batch); the setup-page copy and `check-sheet-script` (12 cases) follow.
4. **A day whose `habits` was not an object aborted the whole pull.** `mergeHabits` guards.
5. **Time-block delete records never expired in the merge** → one extra push per open.
Sound per the review: no item lost or resurrected across 170 random runs, no ping-pong,
latest edit wins, malformed items tolerated, 20k entries merge in 46 ms.
937 unit tests; 14/14 mutations caught (one by `check-backup-keys`).

## 2026-11-02 (early) — the app says when a Sheet script is old; a failed pull says why

Kishore: "you have to use more... broo". Two sync gaps, committed on origin (20c0ae3,
1bfbc6b), NOT deployed; no version bump yet.
- **Old Sheet script detected.** Code.gs `SCRIPT_VERSION = 2`, passed as a second JSONP
  argument on every pull (a copy from before passes none, read as v1). The app keeps which
  version answered per link and per device (`dp.sheetScript`, excluded from backups) and,
  when it is below `SHEET_SCRIPT`, toasts once, marks the Backup & restore row, and shows
  the four update steps in the sync card. The setup page has a new "Updating the script you
  already have" section (`#update`): Manage deployments, not New deployment, or the link
  changes. `check-sheet-script` holds the two version constants together and runs the pull
  end to end. 12 tests, 10/10 mutations caught.
- **A failed pull says why.** `pullState(done)` now calls `done(ok, why)` exactly once:
  offline / unreachable / unreadable / timeout (30 s). Before, a reply that loaded but did
  not parse, or a merge that threw, never called done — the restore screens sat on
  "Connecting…" — and Sync now said "Synced ✅" after any failure, offline included, and
  pushed anyway. "Script error." from a pull no longer raises the crash sheet. 21 tests,
  13/13 mutations caught.
- Stale wording fixed: the sync card and setup page no longer say "newest edit wins; nothing
  is deleted" (untrue since v253); step 7 names the real Settings path.
- Two agents in flight: an adversarial review of the v253 sync code, and a worktree build of
  plans-items and gym per-key merges (both lost once when the session died; resumed).

## 2026-11-01 (late night) — v253 DEPLOYED

Kishore said "deplye". `tools/deploy.sh --tag`: all checks and 888 tests × 4 timezones
passed; prod 3664df2..370ec07; tag `web-v253` on both remotes; the Pages build succeeded and
the live app.js, sw.js and index.html all serve v253. The live setup page carries the new
Code.gs (`cut_`, `text_`). Kishore still has to re-paste and redeploy his own Sheet script.
Native build 119 is still not uploaded.

## 2026-11-01 (late night) — lists sync item by item; the Sheet script stops mangling text

Kishore: "still the tokens are left". Took the biggest open roadmap item.
- **Lists merge item by item** (v253, not deployed). Tasks, notes, plans, projects,
  reminders, exercises, activities, events, articles, time boxes, goals, money accounts,
  transactions and balance marks used to sync whole, the phone that saved last winning, so
  a note added on one phone was lost when the other saved before seeing it.
  - `listSave()` stamps changes and records deletes at save time (`dp.listAt`,
    `dp.listDel`); `mergeList()` merges on pull; details in architecture.md.
  - Items older than the stamps, and states from older app versions, keep the old rule.
  - A pull that brings nothing new now pushes when the Sheet's copy lacks something this
    phone has (lists, entries, time log), compared key-order-blind so two phones never push
    in turn forever.
  - Restore: items the backup brings back count as new, items it rolls back as old.
  - Side fix: the day merge no longer adds an empty `habits: {}` to a day that had none
    (it made the day differ from both phones' copies; v252 did it too).
- **Code.gs** (needs a re-paste + redeploy by each user, Kishore included):
  - `_State` pieces are cut only where Sheets will not change them (`cut_`). A piece
    starting with `-`, `=`, `+` or `'` came back changed, so the next pull got broken JSON.
  - Typed text goes through `text_()`: "- ran 5k" no longer shows as #ERROR! in Log,
    Notes, Events, Articles, Reminders, Time Log.
  - `sheets-setup.html` carries its own copy of the script; updated to match.
  - New release check `tools/check-sheet-script.mjs` (deploy.sh + CI + README). Against
    the old script it reports 14 failures; against the new one, none. It uses a stand-in
    sheet, not Google.
- **Verified:** 888 unit tests × 4 timezones; 19 deliberate breaks of the new code, all
  caught; all release checks pass. In headless Chrome with 3 years of data at 4x CPU, a note
  keystroke's save went 0.6 → 1.0 ms (articles 3.3 → 3.5, money 2.1 → 2.3); two simulated
  phones converged through a fake Sheet (both new notes kept, a delete and an edit both
  arrived), no page errors.
- **Still open:** settings-like stores sync whole; a plan merges as one item; gym is a
  union; the app cannot tell a user that their Sheet script is old.

## 2026-11-01 (night) — the four deferred items, fixed: sync merge + native build 119

Kishore asked why four items were left unfixed ("do it then"). All four are done.
- **Habits merge per habit.** Every habit change stamps `entry.habitsAt[key]`, and
  `mergeHabits` keeps the newest change, so an un-tick no longer comes back from the other
  phone. A side that never touched a habit has no say, so a stale machine write still can't
  drop a tick. Entries from older versions fall back to `updatedAt` and the old union.
  `habitsAt` is in `ENTRY_META`, and the Sheet ignores it (fixed `COLUMNS`).
- **Time-log tombstones** (`dp.timelogDel`, id → deletedAt, kept 90 days, sent with every
  push).
  - A block missing on the side that saved last is no longer treated as deleted, so an
    unsynced running timer survives a pull. A deleted block no longer comes back.
  - A state from an older version (no `timelogDel`) still uses the old rule, so its
    deletions arrive.
- **The last save syncs.** A pull that brings nothing down still pushes when local `touched`
  is newer than the remote's. Hiding or closing the app sends a push that is still in its
  1.2 s debounce (`flushPush`).
- **Native build 119 / 79** (daily-pulse-native; backed up as daylog-native `native-119`):
  - `TimerNotifPlugin` queues every tap with its time (`consumeActions` → `[{action, at}]`).
    `drainTimerAction` applies them oldest first at their own times, and a tap older than
    the running block is ignored. `consumeAction` is kept for older web builds and clears the
    queue too.
  - `SharePlugin.shareTextFile` waits. The chooser's IntentSender → `ShareChosenReceiver`
    (not exported) says an app was picked; resuming without one means the sheet was
    dismissed. It resolves `{ok, chosen, target?}`, and `saveFile` returns 'cancel' on
    `chosen:false`, so no backup date is stamped.
  - Both orders are safe: native 119 + web v252 behaves as before, and web v253 + native 118
    uses the fallbacks (both tested).
- **Verified:**
  - 852 tests × 4 timezones; every new rule mutation-checked.
  - The debug and release builds compile; the release manifest has `ShareChosenReceiver`.
  - `.aab`/`.apk` copied to `store/assets/`.
  - **Not run on a device:** the emulator refused to start with only 2 GB free on disk. The
    first real-phone check is the internal test track.
- **Not done (needs Kishore):**
  - Uploading build 119 to Play.
  - Deploying web v253.

## 2026-11-01 (evening) — v253 built, not deployed: spare-budget session

Kishore asked me to use the spare weekly budget usefully and log it. This is not deployed;
each change is committed and pushed to origin only.
- **Notes:** photos and voice can be added to an existing note, not just a new one
  (features.md, "Photos & voice"). 10 tests.
- **Web reminders:** of two reminders due in the same minute, the second never rang (old
  bug-hunt item #7). It now waits its turn. 5 tests. This only affects the browser PWA; the
  Play app's alarms are native.
- **Push all to Sheet** now also sends Calendar events and Write articles (`resyncAll` never
  called `syncEvents`/`syncDocs`). Async test.
- **Checked and already fixed, so dropped from the open lists:** `loggedStreak` counting
  empty entries (fixed by `entryHasContent`), the midnight-crossing manual time block (v71),
  the habit chip's streak badge not refreshing (`refreshHabitChip` re-renders it), and custom
  number fields in Stats (`numAvgRows`).
- All 6 + 1 mutations were caught.
- **Two independent reviews (fresh subagents, not given my conclusions), with all findings
  fixed except two sync items.**
  - **Review 1, v252 code (now live):**
    - "On this day" → Edit → Done → "← Log" left the Log on the OLD day, so the next thing
      typed was saved there. `dayOpen` now stores `logDate` and restores it.
    - Shrink could bring back a photo deleted while it ran. It now re-checks before the put,
      and deletes again after the put if a delete was already queued.
    - History ▸ Photos → Open day → Back went to Days at the wrong scroll.
    - A second Shrink tap said "already small". The Storage page now shows the running shrink
      (`_shrinkNow`), and a non-quota error reports as a failure.
    - A steps-only day said "Nothing was logged".
    - Changing `#log-date` mid-Edit broke Done.
    - History ▸ Photos kept revoked object URLs.
  - **Review 2, the Log's save path (seven fixed, two deferred):**
    - `flushAutosave()`: a pending 700 ms autosave was lost when anything re-read the entry
      (`loadDraft` on re-opening the Log, a sync pull, Done after a re-render). It is now run
      first: in `loadDraft`, `applyRemoteState`, Done (when it is for another day/draft),
      `visibilitychange` hidden, `pagehide`, and before an update reload.
    - `logRollover()`: the Log left open overnight still showed yesterday as "Today" and saved
      the morning to it. It now moves to the new day on resume and once a minute, but not for a
      past day opened on purpose and not while a field has focus.
    - Dictation that started on one day overwrote another day's journal after a date switch
      (`dictStaleCheck`, for both web and native).
    - Mood-word tags: tapping "Content" treated `#contentcreation` as tagged and cut text out of
      the journal (`hasTag`, whole-tag match).
    - Editing a sample day now drops `sample`, so "Clear sample" no longer deletes real writing.
    - The Log's workout button on a past day opened today's gym.
  - **Deferred (sync design, documented in roadmap.md):**
    - An un-ticked habit comes back from an older device, because the habits merge is a union
      and clearing deletes the key.
    - An edit saved within ~1.2 s of the app being killed never reaches the other device.
  - Each reviewer's repro scripts were re-run against the fixed code: all fixed cases now
    behave correctly.
  - **Review 3, backup / restore / delete (6 fixed, 1 native deferred):**
    - Restore no longer runs `pushState(true)`. It stamped the restored file newer than every
      phone, and the Sheet's `saveState_` replaces its whole state, so restoring an old backup
      on one phone wiped newer notes, tasks and articles on the others. It now calls
      `pullState()` when a Sheet is set up.
    - `mediaForExport` asks the database (`mediaReadAll`) when `_media` is empty. A failed or
      slow start-up read had produced photo-less backups, and `dp.lastBackup` is no longer
      stamped when media could not be read.
    - `setupReminders` with nothing left calls `clearNativeReminderAlarms()`, using
      `checkPermissions`, never request. Up to 7 days of alarms for a deleted reminder kept
      ringing.
    - `BACKUP_FLAG_KEYS`: the seven on/off flags (stored as '1', exported as the number 1)
      were dropped on restore. tools/check-import.mjs now supplies the list and tests it.
    - `backupDropSample`: sample-preview rows stay out of backups, and a restore removes
      `dp.sampleMeta`.
    - `mediaRestore` holds `_mediaBusy`, so an update reload waits for it.
    - Deferred (native): SharePlugin.shareTextFile reports success when the sheet opens, so
      `dp.lastBackup` can be stamped after a cancel on Android ≤9 or a failed Downloads save.
  - **Review 4, Time tracker (9 fixed, 2 deferred):**
    - `stopRunning()`: Stop on a project timer opened a new untagged block, because
      `startAct(act)` without the pid takes the switch path. The fix covers the in-app Stop,
      the pomodoro break and stop sites, and the notification actions (`timerAction`, with
      `dp.pausedPid` so Resume keeps the project).
    - `startAct` clears a stale pause and never writes a negative block; deleting a block
      refreshes the notification.
    - `drainTimerAction()` also runs at launch. A Stop tapped while the app was closed was
      undone by the start-up notification refresh.
    - Block time edits choose the day (−1/0/+1) that keeps the block between 0 and 24 h, and
      warn about overlaps. A cross-midnight fix had made 30.5 h blocks, and a running block
      could get a future start.
    - Daylight saving: `dayStartMs` / `dayEndMs` replace `d0 + 86400000` in segsForDay,
      trackedSleepHours, every timeline, gaps, the export split and coverage. Manual add now
      uses the wall clock (`new Date(ds + 'T' + hh:mm)`).
    - Pomodoro catch-up closes the linked block at the focus phase's `endsAt`
      (`stopRunningAt`).
    - The gap card's project choice logs `pj:<id>` with its pid, not `act:'pj'`.
    - A timebox ▶ for the activity already running no longer stops it.
    - `rememberActNames()`: a deleted activity (Customize or a sync) keeps its name in
      history (`dp.actnames`, backed up).
    - **Deferred (native):** notification taps carry no timestamp, so one is applied when the
      app next opens; a Stop at 18:00 seen at 22:00 counts to 22:00. This needs a queue of
      `{action, atMillis}` in TimerNotifPlugin.
    - **Deferred (sync):** a pull deletes a block the other device has never seen (an
      unsynced running timer) and resurrects deleted ones. This needs tombstones; see the
      roadmap.
  - **Perf:** `roParse`/`DB.entriesRO`/`DB.timelogRO`. Stats tabs went from ~540 to ~225 ms
    and the Calendar from 292 to 51 ms (3 years of data, 4× throttled CPU, medians of 5).
    Textarea auto-sizing is batched (`autoSizeAll`).
- **Write: photo blocks** (features.md, "Write ▸ photos"). Backups accept `doc:` media; older
  versions skip and count those items.
- **Tests:** 797 sync+async × 4 timezones. Every fix was mutation-checked, and one survivor led
  to an extra "never written back" test. The async suite now waits on conditions instead of
  fixed sleeps; two old tests flaked under load.

## 2026-11-01 — v252 deployed (live)

Kishore said "deploy". `tools/deploy.sh --tag` pushed 8ce2df9..3664df2 to prod and tagged
`web-v252` on both remotes. The Pages build succeeded on the third poll, and app.js, sw.js and
index.html all serve v252. Spot-checked: the live app.js contains `dayOpen`, `historyDayHTML`,
`storagePageHTML` and "View day →". Phones pick it up the next time the app is reopened, after
the service worker updates.

## 2026-11-01 (later) — v252: every day tap opens the read-only page, not just History

Kishore saw the filling screen when opening a day and asked again for a separate view. Two
causes. First, v252 was not live (prod was still v251). Second, even in v252 only History rows
went to the day page: Calendar's "Open log", year in pixels, personal bests, Search hits and On
this day still opened the Log editor.
- All of these now call `dayOpen(d)`; details are in features.md, "History ▸ one day".
- Back returns to the screen the tap came from, at the same scroll position, with no animation.
  The list restore is instant as well; it used to animate because of the page's smooth scrolling.
- Tests: 733 in 4 timezones, with 15 new checks covering the five routes, the back labels,
  Edit → Back → Back, and `_dayFrom` being cleared by a tab tap or any other screen. All 9
  mutations were caught (one only after adding the "any other screen" check).
- Verified in headless Chrome with real taps on each route. Back from Stats returned to the
  same scrollY (6299). There were no page errors.
- Still not deployed. This waits for Kishore's "deploy".

## 2026-11-01 — v252: read-only day page in History, Settings ▸ Storage, smaller photos and voice

Kishore asked for three things: compress the photos and audio, show how much storage the app
takes, and make tapping a History day open a proper detail view, with Edit as the way into the
editor.
- **Day page:** see features.md, "History ▸ one day". "Open day" in the photo viewer now opens
  it too.
- **Storage page:** see features.md, "Settings ▸ Storage".
- **Compression:**
  - Photos went from 1600px JPEG q0.82 to 1280px WebP q0.70 (a 320px thumbnail): 44% of the
    old size on real 12 MP photos. Shrink older photos re-encodes v251 photos; the test set went
    from 2.4 MB to 901 KB.
  - Voice went from 32 kbps to 24 kbps mono.
  - Shared photos leave as JPEG.
- **Tests:** 718 unit tests in 4 timezones, including a new async shrink suite (quota, decode
  failure, idempotence, backup `enc`, WebP thumbnail sniffing). Every new behaviour was
  mutation-checked. Clicks in the sync suite go through `tap()`, so a missing button is a
  failed check, not a crash that silently skips everything after it. A crash had hidden four
  mutations on the first pass.
- **Not deployed yet:** committed as 8b10955 and pushed to origin. The production deploy was
  blocked pending Kishore's explicit "deploy"; live is still v251.
- **Verified in real Chrome at 360 and 320 px, dark and light:** the day page, Edit → Back
  showing the edit, voice playback, the viewer, Storage before and after Shrink, a reload, and
  all 21 screens.

## 2026-11-01 — v250 + v251 deployed (live)

Kishore said "deploy". `tools/deploy.sh --tag` pushed 17 commits (3432f0d..8ce2df9) to prod, tagged
`web-v251` on both remotes, and confirmed that app.js, sw.js and index.html all serve v251. The
gate passed (649 tests in 4 timezones). Spot-checked on the live site: `libs/qrcode.js`, the two
new SEO pages, llms.txt and the photos screenshot all return 200, and landing.html no longer says
"Coming soon". check-release warns "precached but referenced nowhere: libs/qrcode.js". That is a
false positive: app.js loads it through a dynamic `s.src = 'libs/qrcode.js'`.
Next: the Play listing (ASO), screenshot 8 and the launch calendar can now start (see distribution.md).

## 2026-11-01 (overnight, later) — v251: ten media defects from an independent review, async tests

A read-only review agent went through the photos, voice and sharing commits. All ten findings
are fixed (details in commit 94f0e96). The two worth remembering:
- **The screen timeout decided where voice notes ended.** Hiding the page saves the note, and
  nothing kept the screen on, so on a 30 s timeout every note stopped at 0:30. Fixed with a
  wake lock while recording.
- **An app update could reload the page in the middle of a recording.**

Also fixed:
- note media orphaned by delete order, sync or restore (now listed as "Unattached" on Notes)
- backups with no size limit, plus an old build's copy-paste fallback that would have
  "copied" megabytes
- a double-tap starting two recorders
- caption autosave bringing a deleted photo back
- delete-everything reloading before the database was gone

New: `tests/unit-async.js` (33 tests) drives the real IndexedDB code against an in-memory shim
that fails like a full phone. Tests: 649.

## 2026-11-01 (overnight) — v251: photos & voice notes, memories, distribution

Kishore asked for photos and audio ("yes we need this"), then left the session overnight with
"think out of the box … do something for distribution too … need ppl to install more".
**Not deployed** (production is still v249; v250 + v251 wait for "deploy"). Every commit went to
`origin` (jurnal-app mirror) as a backup; `prod` was not touched.

- **Photos & voice notes** (features.md ▸ Photos & voice notes): IndexedDB `daylog-media`, a
  Log section after Reflection, Notes Photo/Voice buttons, a full-screen viewer, backup as
  `_media` (declared in the new `BACKUP_EXTRA`; check-backup-keys verifies both export and
  import), and delete-everything removes the database. Works in Play build 118 with no native
  change: camera capture uses Capacitor's file chooser intent (CAMERA not declared), and
  RECORD_AUDIO was already declared. Verified end to end in headless Chrome with a fake camera
  and mic.
- **Memories:** "On this day" counts photo-only days and shows their photos; History has Days |
  Photos tabs; there is a "month in photos" share card.
- **Review of v250** (an independent agent): choosing Settings again kept you on a sub-page with
  a delete still armed; two row subtitles were untrue; "Edit tabs" copy was stale; a second
  resume listener wiped the feedback box; late async replies painted Settings over other
  screens. All fixed, with tests that fail without the fix.
- **Distribution** (distribution.md): QR code + "Daylog · on Google Play" on story share cards;
  Invite card + Settings ▸ Support ▸ Tell a friend (WhatsApp / copy link); install referrers on
  every Play link; landing.html had no Play link and still said "Coming soon" — fixed; Android
  browser users get a one-time "Install the app" card; Play becomes the primary CTA on Android
  across the 128 SEO pages; two new pages (lifelog-app, photo-voice-journal); llms.txt rewritten
  (it still said "Daily Pulse").
- **Store docs (proposals, nothing applied or posted):** `store/aso-2026-11.md` (live Play search:
  Daylog is outside the top 30 for every target term after ten weeks; suggests the title
  "Daylog: Lifelog, Mood & Habits") and `store/distribution-plan-2026-11.md` (ranked channels,
  drafts, 14-day calendar).

Tests 550 → 613 (4 timezones). Layout eval 926 → 864.

## 2026-10-31 — v250: grouped Settings, a proper side menu, the app's own font on buttons

Kishore: the side bar "was not good", Settings needed people to "know the difference", and "it all
looks small". Settings home is now labelled groups (Make it yours · Reminders & tracking · Your
data · Help · Support) of big rows; each row opens one page (`settingsPage`: widgets, reminders,
tracking, data, wipe, feedback) with "← All settings"; Android back and leaving Settings return
to the home. Inner pages got bigger type (h2 17px, hints 14px). Drawer: logo + streak header,
"Your tabs" / "Add more" sections, Settings + Edit pinned in a footer, 54px rows.
Found while doing it: `font: 600 13px/1 inherit` is invalid CSS, so 9 button styles (drawer
rows, seg tabs, chips…) fell back to Arial/Roboto at the browser's size — now `var(--font-ui)`
(see gotchas). Also: Android back now closes the tip and review sheets. Layout eval vs v247:
penalty 1029 → 926, no new errors after the privacy-link fix; Money seg-btn "44x44" flags are
the known sub-pixel noise. Tests 547 → 550.

## 2026-10-31 — v249: the tip card is a real bottom sheet

Kishore: "the page was not good". The v246 card floated text on a full-screen blur with the lower
half empty, showed Play's "₹49.00", and pre-highlighted an amount that meant nothing because the
first tap bought immediately. Now a bottom sheet: heart badge, short copy (keeps "free and stays
free" and "changes nothing in the app", both unit-tested), pick an amount → one "Tip ₹99" button
pays it, monthly as a quiet link, "Not now", fine print. `tipPrice()` drops only a trailing zero
fraction. Checked at 360 and 320px in navy, light and black with a stubbed DaylogBilling plugin
(headless Chrome + CDP, phone not connected).

## 2026-10-31 — v248: Support Daylog row in Settings

Kishore couldn't find a donate button anywhere — by design the only entry was the post-celebration
ask. Added a Settings row (Play app only) that opens the same tip card without the "asked at most
twice" line and without counting as an ask. Tested with a stubbed DaylogBilling plugin: row hidden
without the plugin, card opens, buy marks `gave`, empty product list toasts. Also fixed two Money
chart unit tests that failed on the 1st of every month (fixture stops at yesterday) — they now
check last month.

## 2026-10-31 — Play merchant setup + web v247 live

v247 (tour + polish) deployed and verified live (tag web-v247). Kishore linked the Play payments
profile and created the account group; recorded the IDs and what is still open (15% terms,
products, BillDesk KYC) in play-store.md ▸ Merchant setup.

## 2026-10-30 — v247: tour fixes + real-device polish pass

Kishore called the tour "messy and amateur, lots of bugs" and asked to refine the app. Audited on
a Realme RMX3231 (Android 11, 360px) via phone Chrome + CDP (see gotchas).

Tour (all 8 steps measured — spotlight vs target rect, delta now 0 on every step, including when
started from a non-default Stats sub-tab): step 1 retargeted from the dead `.scale` to `.mm-card`;
scroll settle polls the rect instead of a fixed 260ms; spotlight clamped to the viewport; step 7
points at "More features"; Stats steps force the Overview sub-tab; tour ends back on Log; no
"Skip" beside "Done" on the last step.

Polish: full-bleed header with scroll hairline; drawer shadow no longer bleeds when closed (right
edge brightness 177 -> 246); Stats tabs fit at 360px (were cut at "Heal"), icons drop below that;
straight menu divider + aligned "Edit tabs" label; placeholders no longer cut mid-word; Time
"Activities" header no longer reads as one garbled sentence; empty sleep readout muted; 4-tile stat
grids go 2x2; "avg deep work h"; tour row gets a line icon (new `play` icon, 🎓 mapped).

Gates: 547 unit tests x4 timezones, all 9 tools/check-*.mjs, layout eval 1008 -> 1029 — the delta
is sub-pixel `< 44` noise on 44.00px tabs (measured on device), not new small targets.
Flagged, not changed (judgment calls): What's-new popup reads as a developer changelog; the 🔥
pill shows the day streak while Today shows a week streak; app-wide 36px chips under 44px.

## 2026-09-11 — v241: ghost days and celebration fatigue (behaviour-audit items closed)

The two integrity items open since the audit. An entry with no content — reachable by
tapping a habit and untapping it — counted as a logged day (streak, milestones, days-logged
awards). `entryHasContent()`/`contentDates()` now define a logged day everywhere: daily
streak, weekly cadence, days-logged family, Stats hero, review-ask gate. Skip (0) counts;
all-false habits / whitespace / mirrored zeros don't; a ghost mid-run breaks the chain.
Existing streaks may drop — that's the fix working.

Celebrations budgeted: one full-screen per day (dp.celeb, BACKUP_EXCLUDED — the new
check-backup-keys guard from the parallel sessions caught it unregistered); overflow becomes
a toast, awards still land in the case, budgeted-out milestones still marked shown.

Note for future sessions: this repo advanced v223→v240 in parallel sessions (CI harness in
.github/workflows/check.yml, tools/run-unit-tests.mjs runs the suite in 4 timezones,
tools/bump.sh is now the ONLY sanctioned version bump). Fetch before assuming the version.

## 2026-09-02 — data model section rewritten for v220

Ingested the current storage reality into `architecture.md`. The old section predated
Projects, the gap filler and the whole Money module, and listed neither `safeSet`'s
quota-failure contract nor the derived-never-stored principle.

Added: the two storage shapes (date-keyed object vs id'd array) with real dumps from a live
store; why money is integer minor units; the full 63-key table grouped by purpose; the
`dp.health`-never-syncs guarantee that the Play Data Safety answer rests on; the backup
format; and the four-list checklist extended to note that `awards`/`gapskip` union rather
than adopt.

Measured, not estimated: ~17 KB total on a two-week sample store, 0.3% of a 5 MB quota,
`dp.timelog` the largest single key at 9.1 KB for 84 blocks.


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

## 2026-08-26 — 🚀 LIVE ON GOOGLE PLAY · real Health Connect auto-capture · Strava research

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

## 2026-08-27 — the whole Strava build list, and 27 defects found by reviewing my own work

**Ingested:** an overnight autonomous run, v164 → v190.

- **A 40-agent review fleet** over the awards/share-card code: 32 claimed defects, 27
  confirmed, 5 refuted. All 27 fixed. The worst were mine and live: awards were silently
  revocable (the ledger existed but was never unioned into `earned`, so a decayed EMA dropped
  badges), `perfect` re-scored all of history against TODAY's habit config, and one entry
  mis-dated to 2010 zeroed every strength award. See `gotchas.md`.
- **All 12 research items shipped** — see `strava-build.md`. Highlights: "You vs you"
  temporal comparison (which replaced a week-over-week strip that painted *more screen time*
  green and included a half-logged today), habit cues, weekly streaks, the month deck,
  free custom goals, post-activity save with perceived effort, fresh-start landmarks.
- **Tests 55 → 159.** Eval extended from "the dash default tab" to four Stats sub-tabs, the
  share sheet, the save sheet, the month deck and the goals form. Two more probe
  false-positive classes fixed and one blind spot closed (overlays were never measured).
- **The deploy trap.** v149–v164 were pushed to `origin` while the live app loads from
  `prod`; the site served v146 the whole time and every command reported success. `on: push`
  also failed to register a run. `tools/deploy.sh` now proves deployment by polling the live
  URL and exits non-zero otherwise.
- **Backups.** `daylog-native` private repo created (the native half had none), 109
  retroactive `web-vN` tags on both web remotes. **The upload keystore is still unbacked** —
  `backups.md` and `KEYSTORE.md` state the risk and the fix; it needs a human decision.

**New pages:** `strava-build.md`, `backups.md`. **Updated:** `gotchas.md`, `features.md`,
`index.md`, `log.md`.

## 2026-08-27 (later) — audit fixes shipped, and verified on real hardware

- **The behaviour audit's findings were all real.** Honesty scored 4.5/10 and earned it: a
  fabricated statistic in onboarding ("streak 3x longer" — no telemetry exists that could
  measure it), "last backup: today ✅" after a CANCELLED share, "Saved 🎉" over a write that
  failed on a full phone, "Report PDF ready" on every failure path, and a loss-framed
  re-engagement push with no off switch that violated a rule this wiki documents. All fixed
  in v194–v199. See `behaviour-audit.md`.
- **Device test on the POCO C31, USB and wireless** (report:
  `DAYLOG-DEVICE-TEST-2026-08-27.md`). Native share **works** — the chooser launched with
  `flg=0x10000001` (`GRANT_READ_URI_PERMISSION | ACTIVITY_NEW_TASK`), exactly what
  `SharePlugin.java` sets. Certs were compared before installing so `install -r` preserved his
  17 days of real data.
- **The sample-data banner added hours earlier fired on his phone** — he had sample data
  loaded, and without it he would have read those awards as his own history.
- **Two bugs only a device found:** What's-new hardcoded "54 awards across 8 families" after a
  ninth family shipped, and `awardsHTML`'s empty-store early return skipped the sample banner
  — with its own test passing only because it hit that same early return.
- Tests 159 → 194. `report.py` now refuses to score a run that measured nothing (it printed
  "PENALTY 0 (0 = clean)" after every boot failed).

