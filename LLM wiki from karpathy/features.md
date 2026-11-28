# Features

Nav = **5 pinned tabs + a More overflow grid** (v56). `dp.navcfg` items carry `primary` (pinned to bottom bar — **no cap**, user pins however many they want), `hidden`, `noHide` (Log). renderNav() shows ALL pinned non-hidden tabs (no slice/cap) + a synthetic ⋯ More button → `renderMore()` grid of the rest (incl. Settings). Default opening tab = `settings.defaultTab` (device-local), applied via `navigateTo(defaultTab())` at init. All configurable in Settings ▸ Customize ▸ Tabs (📌 pin any number / 🎯 default / drag order / 👁 hide; a soft tip appears past 5 pins but nothing is blocked). Each screen = a `render*()` in the `RENDER` map, filling `#s-<key>`.

| Tab | key | render fn | storage | notes |
|---|---|---|---|---|
| Log | today | openToday/renderToday | dp.entries | core fields config-driven (`dp.corecfg`): mood, energy, sleep, deep-work, tasks, reflection, journal + deep-log sections (`dp.deepcfg`) + habit checklist (`dp.habitcfg`) |
| Time | time | openTime/renderTime | dp.timelog, dp.timeacts | 24h stopwatch, tap-to-switch, editable timeline, per-activity totals; writes `timeSummary` to the day's entry |
| Tasks | tasks | renderTasks | dp.tasks | carry-over, colors, drag |
| Notes | notes | renderNotes | dp.notes | drag, colors, voice |
| Plans | plans | renderPlans | dp.plans | named plan → own checklist |
| Focus | focus | renderFocus | dp.pomo, dp.timebox | Pomodoro (config cycles, countdown ring, native end-of-phase alarm, optional logs focus time to a Time activity, daily 🍅 count) + Timebox (plan today's blocks, start alarm, one-tap start) |
| Waves | waves | renderWaves | dp.waves | binaural-beat generator (delta/theta/alpha/beta/gamma), offline Web Audio, needs headphones |
| Gym | gym | openGym/renderGym | dp.gym + configs | 6-day split (`dp.daycfg`), exercises (`dp.gymcfg` overrides + `dp.gymgroups` custom), animated demos (workout-anims.js), per-set log |
| Habits | habits | renderHabits | dp.entries | streaks + 90-day heatmaps, built from HABITS (=visible `dp.habitcfg`) |
| Stats | dash | renderDash | all | trends, Polymath Index, time analytics (v38), connections graph, weekly auto-review, wellbeing averages (DYNAMIC from deep-log config) |
| Cal | cal | renderCal | dp.entries, dp.gym, dp.timelog, dp.events | month grid tinted by mood + dots; dated events with alarms |
| Write | write | renderWrite | dp.docs | block editor: heading/text/checklist/bullet, dictation, drag; photo/video/voice blocks (v254); lists articles only |
| Memories | memories | renderMemories | dp.docs (`kind:'memory'`) | v254 (unreleased): pages with date/place/people/tags, `[[links]]` + backlinks, timeline, bulk import, videos |
| Meals | meals | renderMeals | dp.meals, dp.meallib, dp.mealshop | unreleased (2026-11-15): weekly planner, shopping list, Today's meals on the Log — see ▸ Meals |
| History | history | renderHistory | dp.entries | (hidden from nav by default; reachable via More) |
| More | settings | renderSettings | dp.settings | sync, reminders, ntfy, data backup, feedback, **Customize** (renderCustom → `#s-custom`), guide link |

## Customization engine (More ▸ Customize, renderCustom)
Everything is editable and hideable: theme mode (navy/black/light) + accent (6 colors), nav tabs (reorder/rename/hide), core Log fields, deep-log sections/fields (add/rename/hide, incl. tick-list options), habits, time activities, gym exercises + sets + custom groups + the 6-day split. Deep-log: add/rename/hide fields AND **add or delete whole custom sections** (v58, ids `cs*`). `reloadCfg()` rebuilds the live `HABITS`, `TIME_ACTS_ALL`, `DEEP_SECTIONS` from their configs. Hidden items keep their history.

## UI styles (Settings ▸ Style & appearance; v256, three more in v268)

`UI_STYLES` in app.js (id, name, tag, fixed `mode` or null, status-bar `tc`, picker preview `pv`) + one CSS block per
style keyed on `<html data-style>`; `applyTheme()` sets data-style/data-mode, and Midnight alone uses the accent picker.
Eight styles: **Midnight** (default), **Paper**, **Luxe** (dark), **Aurora** (dark), **Bloom** (light), and from v268
**Clay** (light; ivory #f4f2ea, terracotta #b5532f, Fraunces titles), **Dot** (dark; pure black, dot grid behind
everything, red #d71921 accent, white pill buttons, Doto dot-matrix only on big text: page titles, greeting, numbers,
the recorder timer) and **Glass** (follows light/dark; grouped grey, white 16px cards, blue #007aff, system font,
frosted top bar, a docked full-width tab bar with no pill). The v268 blocks sit at the very end of styles.css so they
win over the shared polish rules. Names stay neutral on purpose (no brand names, logos or brand fonts; a unit test
checks the list). Fonts are OFL, self-hosted in `fonts/self/` and precached in sw.js (Fraunces 37 KB, Doto 5 KB).
Gotchas: on the Log the top bar must stay transparent while the greeting card is at the top (`:root.lh-top`), so a
style that frosts `.topbar` must use `:not(.lh-top)`; never force `.lh-date` colour (the greeting card is dark at
night in every style); no apostrophes in sw.js comments inside ASSETS (check-release parses that list naively).

## Home-screen widget (Play build 121+, v262 web)
- Native (daily-pulse-native, `WidgetBridgePlugin.java` + `DaylogWidgetProvider.java`, layouts `widget_full` 4x2 /
  `widget_compact` 4x1 / `widget_narrow` 3x1, `xml/daylog_widget_info.xml`): deep-ink card, sunrise mark, "Not logged
  yet / Logged today / Feeling good", 🔥 streak chip, tasks hint, 5 faces 😣😕😐🙂😄 = mood 1/3/5/7/9 (the mood grid's
  MM_COLS). No journal text. Redraws for a new day after midnight without the app (inexact, 3-hour backstop).
- Data in: `pushWidgetData()` → `WidgetBridge.update({streak, mood, logged, day, tasksDone, tasksPlanned, …})` after
  every save, on open, when the app is left, and across midnight (`widgetSync`).
- Taps out: a face opens MainActivity, which queues `{mood, at}` natively (per-install secret on the intent so other
  apps can't inject; newest 20 kept). `drainWidgetActions()` at launch / on return / on the `widgetTap` event →
  `widgetTapsApply`: newest tap per day, saved via `saveDraftNow`; never overwrites a mood saved after the tap;
  energy untouched; dropped during onboarding. Then the Log + "Mood saved 🙂"; the grid says "Mood 🙂 saved · tap a
  square to add your energy too".
- The plugin also has `requestPin` and `status`: an "Add widget to home screen" button can ship web-only later.
- Not yet seen on a real device (as of 2026-11-21). A layout mistake shows as "Problem loading widget".

## Rating asks (native shell only)

- **Two ways, one budget: at most two asks per person, ever, and none after they tap Rate.**
- **Build ≤121 / no plugin:** the older card (`maybeAskForReview`, `dp.rateAsk {asks,last,done}`), shown when a
  celebration closes (7+ day streak or new award) after 7 real days; "Rate Daylog" opens the Play listing.
- **Build 122+:** Play's own in-app sheet via the `InAppReview` plugin (`InAppReviewPlugin.java`,
  `com.google.android.play:review:2.0.2`); the old card stands aside. `maybeAskReview()` runs after each save
  by hand and fires 2.5 s later (after the award scan) when: onboarded, no tour, today logged by hand with mood
  ≥7, 7+ hand-logged days (30+ and 60 days after the last ask for the second), no celebration or card on
  screen, not typing, app visible. `dp.reviewAsk {n,last}` is written before the call. Both keys are
  install-local (BACKUP_EXCLUDED). Google decides whether the sheet actually shows (quota) and never says;
  it only appears in an app installed from Play (internal testing works).
- No "Do you like Daylog?" pre-question and nothing routes unhappy users elsewhere: review gating is against
  Play policy. Mood ≥7 only picks the moment.

## Onboarding (first run only)
**2 steps since v262 (was 4):** (1) welcome + privacy + backup note + the restore door; (2) "Make it yours": the 4
starter habits (tap to drop) and "Remind me to log my day" ticked at 21:00 → "Start logging". Step 2 is the only
place onboarding asks for notification permission, so everyone who finishes passes it (`OB_LAST = 1`; an old step
number lands on the last step). Dropped from onboarding: the style picker (Settings ▸ Style & appearance), the
add-your-own habit/activity rows (Log checklist add row, Settings ▸ Customize). Gated by `needsOnboard()` (no data +
no `dp.onboarded`). Unpicked items are hidden via the same config flags.
**Tour: 4 steps (was 8):** mood card → time tracker → Your patterns → Menu (mentions Settings for looks, reminders,
backups). "Skip tour" first; every exit lands on the Log; after it, "Your turn: tap how today feels" until today
has a mood. The card moves to the top when it would cover its target.

## Alarms & notifications (native shell only, all offline)
- **Reminders** (`dp.reminders`) — daily; mode `alarm` (full-screen) or `notify`.
- **Events** (`dp.events`) — one-time dated, optional alarm.
- **Web (no native shell):** `checkReminders` fires `fireAlarm`. Since v253 a reminder due while
  another is ringing waits in `_alarmQueue` and rings 600 ms after the first is dismissed.
  Before that it was marked notified and dropped. The same label is never queued twice.
- **Full-screen alarm** — `FullScreenAlarmPlugin` → `AlarmActivity` over lock screen (siren/vibrate/Dismiss/Snooze).
- **Running-timer notification** (id 770) — shows active activity + Pause/Stop/Resume (`refreshTimerNotif`).
- **Log notifications — `nudgePlan()`** (since v261; `scheduleInactivityReminder` runs it on every save, open and
  Settings switch; never asks for permission). At most one log notification per day, all tapping through to the Log
  (`extra.go`, `setupNudgeTap`):
  - the **"Log my day" reminder** (`isLogReminder`: label "Log my day", notify mode, i.e. the one onboarding creates)
    is scheduled here, ids 840-846, today + 6 days, skipping today once `loggedByHand` (auto-filled timeSummary /
    workouts don't count). Copy: first-log line → "N more logged days and Stats can show…" (insights unlock at 5) →
    5 rotating lines. In alarm mode it is an ordinary reminder again (scheduleNativeAlarms).
  - **come-back nudges** (ids 760-764, `dp.nudgeOff` = Settings ▸ Log screen widgets ▸ Come-back nudges): days
    1 (brand-new users) or 2, then 5, 10, 20, 30 after the last logged day; the 30-day one says it is the last.
    Days already covered by the reminder are skipped. Time = the reminder's time, else 20:00.
  - Copy rules (tests enforce): no loss framing, no "streak", never quotes an entry on the lock screen.
  - **Mood buttons** (v262): every log notification has action type `dp_log` = 🙂 Good (8) / 😐 Okay (5) / 😕 Low (3)
    (`NOTIF_MOODS`). Capacitor builds actions as activity intents, so a button opens the app; `onNudgeAction` →
    `applyNotifMood(extra.day, v)`: today, or yesterday when last night's reminder is answered after midnight,
    older → today; a mood already set is never overwritten. Registering `dp_log` leaves the timer's types alone
    (Capacitor's writeActionGroup stores per type id).
  - **Sunday recap** (v262): once past 5 logged days, Sunday's "Log my day" reads "This week: N days logged, best
    mood on <weekday>. Log today to round it off." (`weekRecapCopy`, from `nudgeInput().recent`, needs ≥2 days).
- **One-time notification ask** (v262, `notifAskKind`/`notifAskHTML`, slot `#notif-ask-slot` under the Lift card on
  today's Log): after the first entry logged BY HAND today (saved entry, not the draft — loadDraft pre-fills tracked
  sleep). No "Log my day" reminder → "Want a nudge tomorrow?" + time → creates it (→ Android's prompt via
  scheduleNativeAlarms). Reminder set but permission off → "Your reminder can't ring" → requestPermissions, else
  opens Android's notification settings. Never during onboarding/tour, never on the web. One answer per install
  (`dp.notifAsk`, BACKUP_EXCLUDED). `_notifPerm` refreshed at start and on every return to the app.
- **Pomodoro** (id 750) and **Timebox** (ids 800-830) end/start alarms.
- PWA fallbacks (no native shell): in-app foreground alarm, `.ics` calendar export, ntfy push.

## Added 2026-08-26/27 (v164 → v190)

Motivation and review layer, from `DAYLOG-STRAVA-RESEARCH.md`. Full mapping and the rules
each is bound by: `strava-build.md`.

- **Trophy case** (Stats ▸ Awards) — 60 awards across 9 tiered families, derived on read,
  never revocable, earned dates replayed from history.
- **Your best ever** (Stats ▸ Overview) — top-3 lifetime ladder per benchmark plus
  best-this-year; rows open that day.
- **Share cards** — 5 canvas designs at 4:5 and 9:16, drawn on device. Delivery falls through
  a 4-rung ladder because Android WebView has no Web Share API; delivery shipped natively
  (build 113+, live on Play), so `deliverCard()`'s screenshot rung is now only the PWA fallback.
- **You vs you** — temporal self-comparison over week / month / year, 10 measures, per-metric
  direction, today excluded, honest degradation.
- **Habit cues** — an optional when/where plan per habit, shown on the chip while un-ticked.
- **Weekly streaks** — a week counts at 3 of 7 days; the running week can never break it.
- **Month in review** — a 5-card deck for any month ever logged, no expiry.
- **Custom goals** — 9 measures × 3 timeframes, free, with the remaining gap always visible
  and "Suggest" drawn from the user's own last three periods.
- **Post-activity save** — title, 1–10 perceived effort and a note on any time block over two
  minutes; the block is saved before you are asked.
- **Fresh start** — one landmark note on a Monday, the 1st, or New Year's Day.
- **Health Connect insights** — 4 sensor insights and 13 correlations, every split on the
  user's own median.

Supporting: `tools/deploy.sh` (proves the live URL serves the version), unit tests (count: see log.md), and
an eval suite that now measures every Stats sub-tab and all four overlays.


## Photos & voice notes (v251, 2026-11-01)

**Storage:** IndexedDB `daylog-media`, object store `media` (keyPath `id`, indexes `day` and `ctx`).
A record looks like this:
`{ id, kind:'photo'|'voice', mime, blob, thumb?, day, ctx:'log'|'note:<noteId>', ts, w?, h?, dur?, size, caption?, enc? }`.
`enc` is the encoder generation (`MEDIA_ENC`, 2 since v252). A photo without it was saved by v251.
At boot `mediaLoad()` reads every record into the in-memory map `_media`. IDB blobs are
disk-backed handles, so this is cheap. After that, rendering is synchronous.

- **Where it shows:**
  - The Log section `media` ("Photos & voice", after Reflection). `logSecCfg()` now inserts a
    newly added section after its predecessor in the defaults, not at the very bottom.
  - Notes: Photo / Gallery / Voice each create a new note. The note is created only after the
    media is written, so a cancelled camera leaves no empty note. Deleting a note deletes its
    media.
  - An existing note (v253): its camera button (`data-note-attach`, state `openAttachId`) shows
    Photo / Gallery / Voice with `data-mctx="note:<id>"`. Every note now renders its compact
    media slot (empty and hidden by `:empty` until something is added), so an addition or a
    recording bar appears in place through `refreshMediaSlots()`.
  - History row pills (📷 n 🎙 n), History ▸ Photos (by month), "On this day" (photo-only days
    count), and the `photos` share card.
- **Photos:**
  - `mediaPhotoBlobs()` decodes with `createImageBitmap(..., {imageOrientation:'from-image'})`
    and re-encodes on a canvas. Since v252 that is **WebP q0.70 with a 1280px long edge**, plus a
    320px WebP q0.6 thumbnail. `mediaEncode` checks the type that comes back, because Safari
    returns a PNG when asked for WebP, and anything that is not WebP is redone as JPEG.
  - Measured in Chrome on six real 12 MP photos: 181 KB on average with the thumbnail
    (113–282). v251's 1600px JPEG q0.82 averaged 407 KB for the same six; 1440px WebP q0.74
    averaged 223 KB. Lower quality at 1440 saved little. Re-encoding also strips EXIF, so no GPS
    data is kept.
  - **Shrink older photos** (Settings ▸ Storage, `mediaShrinkAll`): re-encodes each photo with
    `enc < MEDIA_ENC` and replaces it only when the result is at least 10% smaller. It always
    stamps `enc`, so a photo is never re-compressed twice. It stops at the first quota abort and
    re-reads IDB afterwards, so the blobs are disk-backed again. On the six test photos the v251
    copies went from 2.4 MB to 901 KB.
  - Sharing converts to JPEG at full size (`mediaShareBlob`), because some apps take a shared
    .webp as a sticker. The backup stores `enc`. On restore, `b64ImageMime` sniffs the
    thumbnail's type from its first bytes (`UklGR` = WebP, `/9j/` = JPEG).
  - Camera = `<input capture=environment>`; gallery = `multiple`.
- **Voice:**
  - MediaRecorder, preferring `audio/webm;codecs=opus` at 24 kbps **mono** since v252
    (`VOICE_BPS`, `channelCount: 1`, AGC on). Measured at 22 kbps, about 180 KB a minute. v251
    used 32 kbps.
  - An AnalyserNode drives a level meter. If the peak stayed below 0.02, the save toast says
    the clip sounds silent.
  - Notes under 0.7 s are dropped; recording stops at 10 minutes.
  - Leaving the screen or the app, or pressing Android back, **saves** the recording.
  - `dur` is stored because webm from MediaRecorder carries no duration.
- **Viewer** (`#media-view`):
  - Swipe left/right to page, swipe down to close.
  - Caption (debounced put), "Open day", Share (native `DaylogShare.shareImage`, else Web Share,
    else a download) and Delete.
  - "Open day" opens the **read-only day page** (History), not the Log editor. It is hidden
    when that day's page or Log is already showing. Closing the viewer, or any
    `refreshMediaSlots()`, redraws an open day page in place (`histDayRefresh`).
  - Android back closes it first. From History ▸ Photos it pages through the whole gallery
    (`data-mset`).
- **Writes:** `mediaWrite()` resolves on transaction **complete**, not on the request. A quota
  abort lands after the request has "succeeded" (gotchas).
- **Backup and wipe:**
  - The backup carries `_media` as base64.
  - Restore validates each item with `mediaItemValid()`, adds only missing ids, never
    overwrites, and stops at the first quota failure. Its result is reported separately.
  - Delete-everything closes the handle and calls `deleteDatabase` before reloading.
- **Native:** no change was needed in build 118.
  - CAMERA is not declared, so Capacitor's file chooser takes the image-capture intent path.
  - RECORD_AUDIO and MODIFY_AUDIO_SETTINGS were already declared, so getUserMedia gets a
    runtime prompt.
  - The FileProvider `external-path "."` covers the capture file.
- **Open items:** roadmap.md ▸ Photos & voice.


## Recordings (built 2026-11-22; live since web v267)

Kishore, 2026-11-21: "I need to journal a lot but can't type it." Long voice entries: record, pause, leave the app,
come back, stop; share one as an audio file (he gives it to Claude to transcribe) and paste the text back.
Contract with the Android side: `RECORDER-SPEC.md`. Code: app.js `SCREEN: RECORDINGS` block.

- **Where:** ☰ Menu ▸ Your tabs ▸ Recordings (always there, like Lift; not a navcfg tab) and the **Recordings** button
  beside 🎤 Speak under the journal. From a past day's Log, a new recording is saved on that day (`_recFor`).
- **Engines:** `recNative()` = `Capacitor.Plugins.LongRecorder` (build 123+): records with the screen off; at start-up
  and on every return `recNativeAttach()` calls `status()` (reattach, `recovered`) and `list()` (finish records
  stopped while closed, adopt files with no record, refresh uris: `.aac` while recording → `.m4a` after). Without it:
  MediaRecorder, `REC_SLICE_MS` 4 s slices written to IndexedDB as they arrive (chained writes), wake lock,
  "keep Daylog open"; `recRecover()` at start glues a killed recording's slices back (`cut: true`, "saved after
  Daylog closed"). Pausing flushes a slice (`requestData`). One microphone: voice notes refuse to start meanwhile.
- **Limits:** `REC_MAX_MS` 3 h (saves itself), warning at 2 h 50 m; under 0.7 s is dropped (`VOICE_MIN_MS`).
- **Storage:** IndexedDB `daylog-rec`: `recs` {id, src web|native, state live|done, ts, day, title?, mime, blob (web) or
  uri (native), dur, size, transcript?, trBlock?, trDay?, del?, cut?} and `chunks` {k, rid, seq, blob, ms}.
  Never in a backup (not in `_media`, no dp.* key), never synced. A delete hides at once with Undo; the `del` flag
  is saved so a kill inside the 6.5 s window still finishes it at the next start; a native file is removed first.
- **List:** by day, newest first; title (default "Recording · 9:40 pm", `recTitle`), length, size. Tap a row: scrub
  bar, ±15 s, Rename, Day (date input, not after today), Share, Add/Edit transcript, Delete. A webm from
  MediaRecorder has no duration; the player seeks to 1e101 once so Chrome finds it.
- **Share:** native → `LongRecorder.share({id,title})`; web blob → Web Share with files, else a download in a
  browser; the Play app ≤122 cannot share one (its share plugin is image/text only) and says so.
- **Add transcript:** `recTranscriptToDay` → `saveDraftNow` (flushAutosave first; loadDraft if the Log shows that
  day). The paragraph is "🎙️ <title>\n<text>"; saving again replaces it if unchanged by hand, emptying removes it.
- **Widget/shortcut:** `{action:'record', at}` → `widgetRecordRoute`: opens Recordings; starts one recording if a tap
  is ≤2 min old (`REC_STALE_TAP_MS`) and none is running. Mood taps are unaffected.
- **Tests:** unit.js (formatting, names, day moves, grouping, cap, queue routing, recovery plan, journal merge,
  storage/backup exclusion, screen/menu/Log) and unit-async.js (web engine with a fake MediaRecorder, crash
  recovery, Undo, native engine/reattach/notification events with a fake plugin, widget drain, wipe).
- **Edge rules (review, 2026-11-22):** a native record whose file is not in `list()` is marked "The file is not on
  this phone" (Android backup excludes the files), not dropped; a web recording holds a Web Lock so a second tab
  does not recover it; 🎤 Speak and voice notes are refused while a recording runs; the native side also stops at
  3 h (`cap`) and on low storage (`storage`).
- **Open:** run in the Play app with build 123; History's day page could list that day's recordings.

## Sealed letters (v270, live since 2026-11-26)

Kishore picked it from the "be different" list (2026-11-26: "yes build sealed letters").
- **What:** write a letter to future you, seal it until a day you choose (presets: in a month, in 6 months, in a
  year, New Year; or any date after today). Optional photos / voice note via the normal media slot. Menu ▸ Letters
  (its own drawer row like Recordings, NOT a nav tab: a fresh install's menu is capped at 9 by a unit test).
- **Sealed means sealed:** before `openOn` nothing of the letter renders anywhere (list, Log, drawer, read view all
  fall back; unit-tested with a secret string). The Log shows a slim dashed countdown pill, then on the day a
  "A letter from you is ready" card; Open plays a ~1.9 s envelope animation (250 ms with reduced motion) and sets
  `openedAt`. Leaving during the animation leaves it unopened.
- **Store:** `dp.letters` = `[{ id, created, at, openOn, text, sealed, sealedAt?, openedAt }]`, written with
  `safeSet` (not `listSave`), in BACKUP_KEYS, NOT in the Sheet sync (a sheet cell could be read early).
  Drafts (`sealed:false`) save as you type (500 ms debounce, flush on leave/hide); an empty draft is dropped
  1.5 s after leaving (so an in-flight voice note lands first). Delete is two-step ("Delete it without reading it?").
- **Media:** ctx `letter:<id>`; `mediaItemValid` accepts it (backup restore); Search's photo-caption rows skip it.
  `mediaSlot(..., { noEmpty: true })` hides the Log's "A photo of something from today" text.
- **Notification (Play app):** id 791 at 09:00 on the next unopened letter's day, `extra.go = 'letters'` → opens
  Letters. Rescheduled on every `lettersSave` and 4 s after start. Reminders own ids < 700, so their purge skips it.
- **Gotcha:** state vars (`_lt`, `_ltDelArm` …) are `var`, not `let`: `show()`/`handleBack()` read them and must not
  hit the TDZ if they run before that part of app.js is evaluated.

## Month film (v270, live since 2026-11-26)

Kishore 2026-11-26: "good about the video do it" (idea 3, "Your month as a film").
- **What:** a ~30 s stories-style film of one month drawn on a canvas: title → mood calendar (each day pops in its
  mood colour) → best day + its journal line typed in → top 3 habits (bars) → up to 3 numbers counting up (sleep,
  steps, deep work, words, workouts, top activity) → a photo (Ken Burns) → "December starts now." Theme colours are
  resolved per style (probe element → 1 px canvas, so color-mix() works); fonts are the style's display/body fonts.
- **Where:** Log card in the first 7 days of a month for last month (once: `dp.filmSeen`, BACKUP_EXCLUDED; part of
  `nudgeCardKind` 'film', after the landmark and notification ask, before the first-pattern card); a button on the
  1st's new-month landmark card; Stats ▸ Month in review card ("Film"); the month deck. Needs ≥3 hand-logged days
  (demo rows ignored).
- **Best day:** top mood; ties go to the day with the longest journal, then the latest. A journal under 4 words
  ("ok day") is not quoted.
- **Controls:** tap right = next part, tap left = back, hold = pause, ✕ / Back closes (handleBack closes it before
  the month deck). Messages show in the film's own footer (toasts sit underneath the overlay).
- **Video:** "Make a video" replays the film on the same canvas at 720×1280 while MediaRecorder records
  (`video/mp4;codecs=avc1` when supported, else WebM). Tested headless: 720×1280 MP4, 32.7 s, ~5 MB. Then
  "Share video" (needs a fresh tap: Web Share wants user activation) → native `DaylogShare.shareFile` if present →
  Web Share → download. Leaving the app mid-recording aborts it.
- **Play app:** WebView has no Web Share and builds ≤123 have no `shareFile`, so `filmCanVideo()` hides
  "Make a video" there. `shareFile({base64, filename, mime})` was added to SharePlugin.java on 2026-11-26
  (video/audio/image only) and ships with the next native build after 123.

## Week starts on Monday or Sunday (v276, 2026-11-28)

- Settings ▸ Make it yours ▸ **Week starts on** (one tap toggles; toast says what follows). Stored as
  `dp.settings.weekStart` (0 = Sunday, 1/absent = Monday). Settings do not sync, so it is per phone.
- One source: `weekFirst()` (cached; `DB.saveSettings` and `reloadCfg` drop the cache), `wdIndex(d)` (0 = the
  week's first day), `weekOrder()` (getDay numbers, first day first), `weekLetters()`, `isWeekEnd(d)`, and
  `weekStart(d)` built on them. Every former Monday-first spot uses these: logging + habit week streaks,
  times-a-week habits (and the schedule sheet's day order + "from Sunday to Saturday" text), the weekly review
  (last day of the week; Customize label now "Weekly review"), Fresh start (first day), the week-recap "Log my
  day" notification (last day), History calendar header/offset, Habits heatmap rows, the month film grid,
  project hours (`pjWeekStartDate`), Money calendar + weekday chart, Meals week. `isSunday` and `WD_ORDER` gone.
- Switching recomputes week streaks on the new boundaries (no stored data changes).
- Tests: tests/unit.js "v276: the week can start on Sunday" (18).

## Habit notes — a note on a habit for one day (v275, 2026-11-28)

- `entry.hnotes = { habitKey: text }` (≤ 300 chars, trimmed; empty deletes the key, an empty map is removed).
  **Since v281 it is stamped per habit** (`entry.hnotesAt[key]`, written by `entryFieldStamp`, merged by
  `mergeHnotes` like `mergeHabits`): as one field, the copy saved later won whole, so notes on two habits from
  two phones lost one. A copy from before v281 has its `fieldAt.hnotes` stand in. It syncs inside entries and
  rides in backups. Not a Sheet "Log" column (Code.gs COLUMNS unchanged).
- Write: **hold** a habit chip on the Log (550 ms; a move > 10 px or a scroll cancels; the click that ends the
  hold is swallowed so it never ticks; `contextmenu` suppressed) → sheet `#hnote-sheet` (copy-modal) for the
  Log's day. Or the **Note** pill on each Habits card (writes today). Save/Delete/Cancel; Back closes it.
  `hnoteSave` = flushAutosave → clone stored day → saveDraftNow → loadDraft if it is the Log's day. Saving a
  note never ticks or unticks the habit.
- Read: a dot on the Log chip (`.has-note`), the last 3 notes under each Habits card, the day's notes under
  Checklist in History ▸ day, and a `habitNotes` column ("Label: note; …") in Export CSV.
- The Habits plan row now wraps: how often · note on one line, the when & where cue on its own line.
- Tests: tests/unit.js "v275: a note on a habit" (22) + unit-async long-press (4).

## Import days from a CSV — Daylio or a spreadsheet (v274, 2026-11-28)

- Settings ▸ Backup & restore ▸ "Import days from a CSV" (`csviCardHTML`, under the backup card). Pick a file →
  preview (days, date range, new vs already-logged, columns used, matched/unmatched activities, unknown moods,
  skipped rows) → Import → toast with **Undo** (restores the entries JSON from before).
- **Fill-only merge** (`csviApply`): a day already logged keeps every non-empty field; habits already set that
  day (even `false`) are left alone. Each changed day gets `updatedAt`, `entryFieldStamp` field stamps and
  `habitsAt[k]` so the Sheet sync keeps the import. One save. Importing the same file twice changes nothing.
- **Daylio** (header has `full_date` + `activities`): mood names rad/good/meh/bad/awful → 9/7/5/3/1 (custom
  names are reported, not guessed); several check-ins on one day → moods averaged, notes joined (title + note,
  `<br>` → newline); an activity whose name matches a habit key/label ticks it; others go into the note as
  "Activities: …".
- **Any sheet**: column names matched loosely (`date/day`, `mood`, `energy`, `sleep/sleepHours` (h:mm ok),
  `deepWork`, `journal/note/notes/diary/entry`, `wentWell`, `improve`) — Daylog's own CSV export round-trips.
  A column named like a habit ticks it on yes/1/x/✓/true/done. Numeric moods: if every number is ≤ 5 the file is
  a 1–5 scale → 1, 3, 6, 8, 10. Dates via `csvDate` (ISO, dd/mm/yyyy — US mm/dd with day > 12 is refused, not
  guessed); impossible dates are skipped and counted.
- Tests: tests/unit.js "v274: import days from a CSV" (34 checks) + unit-async file-pick check.

## App lock — PIN (v273, built 2026-11-28, live since 2026-11-28)

- Settings ▸ Your data ▸ **App lock**. A 4–6 digit PIN, asked when Daylog opens and when you come back after
  the chosen time away: right away (10 s grace so a photo picker or share sheet can return), 1 min (default),
  5 or 15 min. Lock now · Change PIN (asks the current one; keeps the recovery code) · New recovery code ·
  Turn off (asks the PIN).
- **What it is:** a privacy screen, not encryption. localStorage is unchanged; backup files and the Sheet open
  without the PIN. The card says so in plain words.
- **Storage:** `dp.lock` = `{v, len, it, salt, hash, rs, rh, after}`; the PIN and the recovery code are kept only
  as salted PBKDF2-SHA256 hashes (120 000 rounds, WebCrypto). `dp.lockFail` = wrong-try count: 5 free, then a
  wait doubling from 30 s to 15 min, kept across reloads. Both are in `BACKUP_EXCLUDED` and not in the sync
  payload: a restore onto a new phone must never lock its owner out.
- **Recovery code:** 10 characters `XXXXX-XXXXX` from 32 unambiguous letters/digits (no 0/O, 1/I), shown once
  when the PIN is first set; the lock is saved only after "I saved it" (Cancel saves nothing). Forgot PIN →
  type the code (any case, spaces fine) → lock turns OFF and Settings ▸ App lock opens to set a new one. Lost
  both: the screen says Android Settings ▸ Apps ▸ Daylog ▸ Storage ▸ Clear storage (web: clear site data).
- **No flash:** an inline script in index.html `<head>` adds `html.locked` when `dp.lock` exists, and CSS hides
  every body child except `#lock` and `#alarm` with `visibility:hidden` (not focusable, not read aloud).
  `lockBoot()` (runs right after `DB`) shows the keypad, or drops the class if the stored value is unusable.
- **Away/back:** on `visibilitychange` hidden (and Capacitor App `pause`), the lock screen goes up at once so the
  recent-apps thumbnail shows it; on return (`resume`) it comes down without a PIN if away < the chosen time.
  A Settings step (verify/change) left open past the time turns into the real lock, so Cancel cannot open
  the app. Both handlers are idempotent.
- A ringing alarm stays on top (`html.locked #alarm` z 400) and can be dismissed without the PIN.
- Back button: on the lock → minimize the app (`App.minimizeApp`); in a Settings step → cancel it; on the
  recovery-code screen → back to the keypad. Physical keyboard: digits, Backspace, Enter; Esc cancels a step.
- Tests: tests/unit-async.js "v273: App lock" (55 checks). The runner gives jsdom Node's real
  `crypto.subtle` (jsdom has none). Also fixed a pre-existing flake there: the recorder "reason cap" check read
  the on-screen toast, which a recovered recording's 1.8 s-delayed toast could overwrite.
- Not done (would need native): biometric unlock, FLAG_SECURE (block screenshots).

## Habit schedules (v272, live since 2026-11-28)

Asked for by Kishore 2026-11-26 after "no we need streak": streaks stay, but a non-daily habit must not lose its
streak on every day off.
- **Data:** optional `sched` on a habitcfg item: `{days:[1,3,5]}` (getDay numbers, 1–6 of them) or `{week:3}`
  (1–6 a week, Monday–Sunday). Absent = every day; nothing to migrate. Rides along in habitcfg (sync, backup).
  `schedClean` normalises anything from sync/backup (no days / all 7 / junk → every day). Cached in `_schedMap`,
  reset by `reloadCfg()` with `_goalMap`.
- **Core rule:** `hVal(entry, key, day, ents)`. The stored value is `hBase(entry, key)` (the old hVal). When the
  caller passes the DATE and the stored value is a miss, the schedule may turn it into `H_SKIP` (a rest day), the
  meaning a tapped skip already had, so every streak / strength / percentage that treats a skip as neutral works
  unchanged. Without the date nothing changes, so taps and the toggle cycle still read stored values (ticking on a
  rest day works and counts).
  - Weekdays: a day not in `days` rests.
  - N a week (`schedRest`): once the week has its N (done + tapped skips), its other days rest; the current week's
    open days rest while N is still reachable (`weekReachable`); a past week that fell short is a miss.
    Week counts are memoised per entries object (`_wkMemo` WeakMap; `DB.entriesRO()` keeps identity until the
    store changes, `DB.entries()` is a fresh object).
- **Streaks:** weekday habits count done days, rest days neutral (walk bounded at 5000 days). N-a-week habits count
  WEEKS (`habitWeekStreak` — `weekStreak` was already the logging-week streak): a week with N adds one; a week short
  but made up with skips is passed over; this week adds one once N is in and breaks the run only when N can no
  longer be reached. Units: `streakShort` ("8w"), `streakLong` ("8-week streak"). `bestHabitStreak` now counts
  exactly like `habitStreak` (it used to count any truthy value on calendar days, so a skip broke "best" but not
  "now", and 2 of 8 glasses counted) and is never below "now".
- **Percentages:** `habit30(key, ents)` = done / planned days in the last 30 (rest days and tapped skips out), used
  by Stats ▸ Checklist "Habit consistency", the PDF report and the printable report. A 3-a-week habit kept every
  week reads 100 %, not 43 %.
- **UI:** 📅 pill (`schedPillHTML`) on each Habits card (next to the 📍 cue line, `.hab-plan`) and at the end of the
  Customize cue row. Sheet `#sched-editor` ("How often — X"): Every day / Some days (Mon-first weekday chips) /
  Times a week (− N +, 1–6); Save disabled with no day; all 7 saves as every day; back closes it (handleBack also
  closes the goal editor now). Log chip: `rest` badge + dimmed dashed chip on a day off; `n/N` this week for
  N-a-week (the unsaved draft counts), turning into the 🔥 `8w` streak once the week is in. Habits heatmap: rest
  days are outlined empty cells (`.cell.rest`), tapped skips keep the hatch. The day-completion ring
  (`todayCompletion(entry, day)`) counts a resting habit as complete.
- Tests: "v272: habit schedules" block in tests/unit.js (35 checks; 1953 total × 4 zones).

## History ▸ one day, read-only (v252, 2026-11-01)

A History row used to open the Log editor for that day. It now opens `historyDayHTML(d)`, a
read-only page, as a sub-view of History (`histDay`, like `curDoc` in Write).
- **What it shows**, only where the day has something:
  - Hero: the mood-tinted header (hue from mood, red→green), the weekday, full date and
    relative date (`relDay`), mood and energy bars, the mood-grid quadrant, and any mood words
    tagged in the journal. Edit sits top right.
  - Tiles: sleep with bed–wake, deep work, tasks done, checklist x/y, steps, screen time,
    exercises and money spent. 2 or 4 tiles use two columns, so none is left on a row alone.
  - Reflection: the core text fields with the user's own labels and trailing emoji removed, the
    journal with line breaks and #tags, and the Sunday review.
  - Photos (full images, captions overlaid, the first one wide when the count is odd) and
    playable voice notes. They cannot be deleted here (`voiceRowHTML(r, false)`).
  - Checklist (done, then skipped, then missed), a 24-hour time bar with the top 6 activities,
    workout, tasks done and events, money, notes created that day, and the deep log (only the
    fields that hold something).
- **Navigation:**
  - The ‹ › arrows step through the days History lists.
  - Back (on screen or Android) returns to the list at the same scroll position.
  - Edit sets `_editFromHist`. Back or Done on that Log flushes the debounced autosave and
    returns to the day page, which shows the edit. Leaving the Log any other way (`show()` to
    another screen, or `navigateTo`, including the Log tab) forgets the way back.
  - The History tab always opens on the list.
- **Every other "open that day" tap opens this page too**, never the Log: Calendar's "View day →"
  (was "Open log →"), a year-in-pixels square, a personal best, a Search hit in a day, an On
  this day row, and the photo viewer's "Open day". `dayOpen(d)` records `_dayFrom = {screen, y}`;
  the back button then names that screen ("← Calendar", "← Stats", "← Search", "← Log") and
  Back returns there at the same scroll (instant, because `html` has `scroll-behavior: smooth`).
  Edit → Log → Back still comes back to the day page first. `show()` to any screen other than
  the Log or History, and every `navigateTo`, forget `_dayFrom`.
- Money rows use `hd-in`, not `.in`/`.out`. The Money screen's global `.in`/`.out` rules colour
  whole rows.

## Memories (v254, built 2026-11-04, NOT deployed)

Kishore asked for "live documentation" of his memories — photos, videos — "like Notion or
Obsidian". Decided with him: **inside Daylog**; a memory holds videos, a story, a timeline and
bulk import; big files stay **on the phone only** (no Drive, no compression).

- **Model:** a memory is a Write page (`dp.docs`) with `kind:'memory'`, `date` (YYYY-MM-DD, the
  day it happened), `place`, `people[]`, `tags[]`, `blocks`. So it syncs item by item like any
  page (LIST_SYNC `docs`), is in backups, and reaches the Sheet's Articles tab (first line =
  `memPropsLine`). Write's list filters memories out; search opens them on Memories.
- **Blocks:** the shared editor now serves both screens (`docHost`/`docCurId`/`docRerender`).
  Media blocks: `i` photo, `v` video, `a` voice (`isMediaBlk`, `mediaBlockType`,
  `docMediaBlock`). `docMediaActsHTML` = Photo · Video · Gallery · Voice, with a rec-only media
  slot that is empty unless a recording runs there.
- **Read view** (Notion-style): cover (first photo/video still, or `m.cover`), title, property
  rows (date + "N years ago", place/people/tags as filter chips), blocks with consecutive
  photos/videos as a gallery, then **Links to**, **Linked from** (backlinks, articles included)
  and **Same people or place**. `[[Title]]` matches a page title case-insensitively; an
  untitled memory goes by its date (`memTitle`). `memInline` escapes everything else.
- **Edit view:** title, date/place/people/tags (people and tags are comma lists, cleaned by
  `memWords`; suggestion chips from other memories; places via a datalist), the block editor,
  🔗 Link picker (inserts `[[Title]]` into the block last touched), Delete (media first).
- **Timeline:** year → month, 2-column cards (cover, title, date, place, people, snippet,
  counts), search over title/place/people/tags/text/captions, facet chips, and an "On this
  day" strip (same MM-DD, earlier years).
- **Bulk import** (`memImportPrepare` → `memImportRun`): many photos/videos at once, grouped by
  the day each was **taken** — JPEG EXIF DateTimeOriginal (`exifTaken`), MP4/MOV `mvhd`
  creation time (`mp4Taken` walks box headers only, so `moov` at the end costs a few reads),
  else `lastModified`. "One memory per day" or "All in one memory"; progress on the button;
  stops at a full disk; a page whose every file failed is removed. Media `ts`/`day` = taken.
- **Videos** (`kind:'video'`): stored as the File itself (no re-encode; IDB keeps it on disk),
  plus a 320px WebP still from a frame near the start, `w`/`h`/`dur` (`mediaVideoMeta`, gives
  up after `VIDEO_META_WAIT` 8 s — an undecodable HEVC clip still saves, with a plain tile).
  Over 300 MB asks first. Grids show a ▶ length badge; the viewer plays it (`<video controls>`).
  Also allowed in the Log's and notes' gallery picker, and History ▸ Photos shows the Log's.
  - **Not in backups:** `mediaForBackup` skips them (base64 of hundreds of MB would kill the
    WebView) and counts them; export says "videos stay on this phone"; Storage has a Videos
    row "not in backups"; Delete-everything warns; `mediaTotals().bytes` excludes them.
  - **Share:** web = Web Share with files or a download; **the Play app cannot share a video
    yet** (DaylogShare is image-only) — says so.
- **Verified** in headless Chrome with real files (EXIF JPEGs, MP4s with `moov` at end and
  start, a no-EXIF JPEG): 3 memories on the right days, stills + lengths, video plays in the
  viewer, links/backlinks/filters/search, backup = photos only. 44 unit tests (sync + async).
- **Open items:** roadmap.md ▸ Memories.

- **On their day (v277, LIVE 2026-11-28):** History's day page has a "Memories from this day"
  section (cards via `memCardHTML(m, 'data-hday-mem')`, `memsOn(d)`); a day with only memories is not "Nothing
  logged". Opening one sets `_memFromDay = {d, from: _dayFrom, y}`, so its back button reads "← <date>" and
  `memBackToDay()` returns to the day page (scroll and the page's own Back kept); the phone's Back, Delete and
  leaving Memories behave the same (`show()` clears it). The Log's "On this day" strip counts a day with only
  memories, shows the first memory's title (+N more) and uses a memory photo when the Log has none.
  Gotcha found: `list.map(memCardHTML)` passed the array index as the new 2nd argument; call it as `m => memCardHTML(m)`.

## Meals (built 2026-11-15 on branch worktree-agent-a7d95bec3ba692ed9, NOT deployed)

Kishore: "we may can have the meal planned". A weekly meal planner, in the ☰ menu under More
features (`adv: true`; the fresh-install test caps visible destinations at 9). Code: the
`MEALS` block in app.js (`renderMeals`, `mealsLogCard`, the sheet `mealSheetRender`), CSS: the
`===== Meals =====` block at the end of styles.css.
- **Screen:** week strip (swipe or arrows, today ringed, 4 slot dots per day, `x/28` bar),
  Copy last week (fills only empty slots, Undo), Plan / Shopping list tabs. Plan = the day's
  Breakfast · Lunch · Dinner · Snacks as cards (emoji tile, Indian veg/egg/non-veg mark, tags,
  eaten tick on today and past days); an empty slot offers a one-tap "Again?" (planned 2+ times
  there in 6 weeks) or "Try" (a starter idea for that slot, rotating by date). Then "This week at
  a glance" (7×4 emoji grid) and the insight.
- **Sheet** (`#ml-sheet`, Back steps edit/repeat → previous, else closes): add (slot switch,
  search-or-type, diet/tag filters, your meals favourites → recent → in-slot count, 35
  `MEAL_IDEAS` with ingredients), a meal's options (eaten, swap, repeat on… 14-day picker with
  Next 7 days / Weekdays, edit, remove with Undo), edit a library meal (emoji, name, type, tags,
  comma-separated ingredients; plans from today on follow the edit).
- **Shopping list:** ingredients of un-eaten meals planned today..+6, one line per ingredient
  (`mealIngKey`: case, "onions"/"onion", "tomatoes"/"tomato"), "×n" = meals needing it, plus typed
  items; Clear checked (Undo), Copy list (clipboard).
- **Log:** section `meals` ("Today's meals") after the checklist; hidden until a meal is planned
  (`get off()` in LOG_SECTIONS_DEF, and the first `mealAdd` unhides it). Eaten tick, and ⇄ = "had
  something else instead" (swap + eaten, the planned name kept as `was`).
- **Insight** (`mealInsight`): next-night sleep, else next-day mood, after planned dinners marked
  eaten vs planned dinners not eaten or swapped; only with ≥ 6 days a side (`MEAL_MIN_DAYS`), 15 min
  or 0.5 points, sample sizes in the sentence.
- **Storage:** `dp.meals` (plan items), `dp.meallib` (your meals + ingredients + fav),
  `dp.mealshop` (typed items; ticks on derived items as `g:<ingredient>` with the plan ids they
  covered, so a newly planned meal brings the line back). All three in LIST_SYNC, the push
  payload and BACKUP_KEYS. 60+ unit tests (plan, library, list, copy week, two-phone merge,
  backup round trip, Log card, sheet).
- **Deferred:** meals in Search and the PDF/CSV export; the Sheet has no Meals tab; an old app
  version's push drops `meals` from the Sheet until this phone saves again (same as every new list).

## Write ▸ photos (v253)

- Camera / Photo under the block toolbar save a photo with ctx `doc:<docId>` and append a block
  `{t:'i', mid}` (`docPhotoBlock`). `photoBlockRow` shows it full width with the viewer caption;
  `#blk-list[data-mset]` makes the viewer page in block order.
- Deleting:
  - Removing the block deletes the photo, media first.
  - Deleting the photo in the viewer drops its block (`docDropBlocks`).
  - Deleting the article deletes its photos.
- A block whose photo is missing (synced from another phone) shows "not on this phone" and is
  never pruned automatically: pruning would sync back and orphan the photo on the phone that
  has it.
- Orphans: `mediaOrphanCtxs` includes `doc:` ctxs with no article. Notes ▸ Unattached offers
  "Make it an article again" (`mediaRestoreDoc`, titled "Recovered photos").
- `writeRefresh()` (from `refreshMediaSlots`) redraws the editor only when it holds a photo
  block, so typing elsewhere is not interrupted.
- The Sheet gets a `[photo: caption]` line.
- Backup: `mediaItemValid` accepts `doc:`.

## Settings ▸ Storage (v252, 2026-11-01)

`storagePageHTML()`, on the "Your data" group's Storage row (whose subtitle is the total).
- One card shows the total, a stacked bar and rows biggest first: localStorage grouped by
  `STORE_GROUPS` (logs, health, time, money `dp.fin*`, notes/tasks/plans, workouts, other),
  plus Photos, Voice notes and App files.
  - App files is the service worker cache, summed once per session by `storageMeasure()`. It is
    left out if it cannot be measured.
- **Text space** is the localStorage characters against Chrome/WebView's 10 MiB of UTF-16
  (5 Mi characters). It turns red at 70% and says to export a backup.
- The page says Android's App info shows more, because it also counts the app and its
  temporary files, and that **Clear storage** there deletes everything.
- The Shrink older photos card shows only while `mediaShrinkCount() > 0`.


## Lift — low-mood support (built 2026-11-15, NOT deployed)

Kishore asked for "things to do" when the mood is low. All offline; JS in one block
(`===== Lift (low-mood support) =====`, before SCREEN: CALENDAR), CSS in one block at the end of styles.css.
- **Trigger** (`liftIsLow`): today's mood ≤ 4 (`LIFT_LOW`), or mood 5 / no mood with an unpleasant
  mood-grid word tagged (#sad, #anxious… from `MM_QUAD.red/blue`). The card (`liftSlotHTML`, Log section
  `lift` after the mood grid) appears the moment the mood is tapped (`liftSlotRefresh` from
  `autosaveDraft`, skipped while a text field has focus). "Not today" sets `lift.hide` on the day, with Undo.
  Only on today. No notification, ever.
- **Screen** (`renderLift`, `show('lift')`, drawer row `liftDrawerHTML`, not in NAV_DEF so it does not
  count against the fresh-install menu): hero, Breathe (box 4-4-4-4 ×4 or 4-7-8 ×3, orb + progress ring,
  timer reads `Date.now()` so it cannot drift, stops when you leave), 5-4-3-2-1 grounding (one tap per thing),
  One small thing (10 actions, `LIFT_ACTS`; "I did this" → `lift.did`), From your good days (mood 8+ days
  with words/tags/photos, `liftGoodDays`; memories), Write it out (appends to today's `journal`), Talk to someone.
- **Talk to someone** goes to the top when 3+ of the last 5 days with a mood (within 14 days, sample days
  excluded) are ≤ 4 (`liftEscalate`), or after "I'm not okay" (session only, never stored).
- **Learning line** (`liftLearn`): for hard days (mood ≤ 5) with a mood the next day, the next-day change
  after days WITH the action vs hard days WITHOUT it — not "did the mood rise", which every low day does.
  Needs ≥ 4 days on each side (`LIFT_MIN_N`) and a gap ≥ 0.3; shows only a positive one; says "not proof".
- **Storage:** `entry.lift = { did: [ids], hide: true }` on the day, written via `liftWrite` (flushes the
  Log autosave first, mirrors into the open draft). In `ENTRY_META`, so it never makes a day count as logged.
  Syncs with the day (field-level merge), in backups/import; not a Sheet Log column; not in the CSV.
- **Open items:** use `lift.did` to order the deck beyond the single best action; a Customize list for
  the user's own actions; a WHATS_NEW line when it ships.

## Your year — a six-card year in review (v281, built 2026-11-29, NOT deployed)
- Stats ▸ Overview card (`yearCardHTML`, under Month in review) and a Log top card from 1 Dec to 10 Jan
  (`yrCardY`, nudge kind `year`, dismissed per year in `dp.yrSeen`, per device, not backed up).
- Deck `#yrdeck` reuses the Month in review classes: Your YYYY (days logged, % of year, longest run inside
  the year, habits ticked) · Month by month (12 bars of average mood, best/hardest month need 3 rated days) ·
  Habits (days done) · What you wrote (words, days written, top #tags, best day quoted — `yrOwnText` drops
  an import's "From my old sheets:" block) · Body and mind · vs last year (only if that year has
  `YR_MIN_DAYS` = 14 days logged by hand). ‹ › between years (`yrYears`). Computed on open, nothing stored.

## Rediscover (v281, NOT deployed)
- On this day gains a "Rediscovered" card: a random day 14+ days back with ≥ 8 words of the user's own
  text or a photo, never mood ≤ 3, never a sample. Pick is seeded by today's date (stable across renders);
  "↻ another day" bumps `_rdOffset`. The strip shows even with no anniversary hits. Older-year dates show
  the year. `rediscoverPool` is memoised on the read-only entries object.

## Welcome back (v281, NOT deployed)
- After 3+ days with nothing logged (and nothing today), the Log's top card (nudge kind `back`) says how long
  it has been, that there is no need to fill the gap, and "Write about today" scrolls to the journal. No
  backfill buttons, no streak change (streaks stay as they are, Kishore 2026-11-26). Dismissed per day
  (`dp.backSeen`, per device).

## Year in pixels ‹ › (v281, NOT deployed)
- Arrows step between the years that have a mood (`ypYears`, `ypYear`); the count moves under the title
  when the arrows show.
