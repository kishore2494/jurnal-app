# Features

Nav = **5 pinned tabs + a More overflow grid** (v56). `dp.navcfg` items carry `primary` (pinned to bottom bar — **no cap**, user pins however many they want), `hidden`, `noHide` (Log). renderNav() shows ALL pinned non-hidden tabs (no slice/cap) + a synthetic ⋯ More button → `renderMore()` grid of the rest (incl. Settings). Default opening tab = `settings.defaultTab` (device-local), applied via `navigateTo(defaultTab())` at init. All configurable in Settings ▸ Customize ▸ Tabs (📌 pin any number / 🎯 default / drag order / 👁 hide; a soft tip appears past 5 pins but nothing is blocked). Each screen = a `render*()` in the `RENDER` map, filling `#s-<key>`.

| Tab | key | render fn | storage | notes |
|---|---|---|---|---|
| Log | today | openToday/renderToday | dp.entries | core fields config-driven (`dp.corecfg`): mood, energy, sleep, deep-work, tasks, reflection, journal + deep-log sections (`dp.deepcfg`) + habit checklist (`dp.habitcfg`) |
| Time | time | openTime/renderTime | dp.timelog, dp.timeacts | 24h stopwatch, tap-to-switch, editable timeline, per-activity totals; writes `timeSummary` to the day's entry |
| Tasks | tasks | renderTasks | dp.tasks | carry-over, colors, drag |
| Notes | notes | renderNotes | dp.notes | drag, colors, voice |
| Plans | plans | renderPlans | dp.plans | named plan → own checklist |
| Focus | focus | renderFocus | dp.pomo, dp.timebox |
| Waves | waves | renderWaves | dp.waves | binaural-beat generator (delta/theta/alpha/beta/gamma), offline Web Audio, needs headphones | Pomodoro (config cycles, countdown ring, native end-of-phase alarm, optional logs focus time to a Time activity, daily 🍅 count) + Timebox (plan today's blocks, start alarm, one-tap start) |
| Gym | gym | openGym/renderGym | dp.gym + configs | 6-day split (`dp.daycfg`), exercises (`dp.gymcfg` overrides + `dp.gymgroups` custom), animated demos (workout-anims.js), per-set log |
| Habits | habits | renderHabits | dp.entries | streaks + 90-day heatmaps, built from HABITS (=visible `dp.habitcfg`) |
| Stats | dash | renderDash | all | trends, Polymath Index, time analytics (v38), connections graph, weekly auto-review, wellbeing averages (DYNAMIC from deep-log config) |
| Cal | cal | renderCal | dp.entries, dp.gym, dp.timelog, dp.events | month grid tinted by mood + dots; dated events with alarms |
| Write | write | renderWrite | dp.docs | block editor: heading/text/checklist/bullet, dictation, drag |
| History | history | renderHistory | dp.entries | (hidden from nav by default; reachable via More) |
| More | settings | renderSettings | dp.settings | sync, reminders, ntfy, data backup, feedback, **Customize** (renderCustom → `#s-custom`), guide link |

## Customization engine (More ▸ Customize, renderCustom)
Everything is editable and hideable: theme mode (navy/black/light) + accent (6 colors), nav tabs (reorder/rename/hide), core Log fields, deep-log sections/fields (add/rename/hide, incl. tick-list options), habits, time activities, gym exercises + sets + custom groups + the 6-day split. Deep-log: add/rename/hide fields AND **add or delete whole custom sections** (v58, ids `cs*`). `reloadCfg()` rebuilds the live `HABITS`, `TIME_ACTS_ALL`, `DEEP_SECTIONS` from their configs. Hidden items keep their history.

## Onboarding (first run only)
3 steps: welcome (with data-loss note) → pick habits (+ add own) → pick activities (+ add own). Gated by `needsOnboard()` (no data + no `dp.onboarded`). Unpicked items are hidden via the same config flags.

## Alarms & notifications (native shell only, all offline)
- **Reminders** (`dp.reminders`) — daily; mode `alarm` (full-screen) or `notify`.
- **Events** (`dp.events`) — one-time dated, optional alarm.
- **Full-screen alarm** — `FullScreenAlarmPlugin` → `AlarmActivity` over lock screen (siren/vibrate/Dismiss/Snooze).
- **Running-timer notification** (id 770) — shows active activity + Pause/Stop/Resume (`refreshTimerNotif`).
- **2-day inactivity nudge** (id 760) — pre-scheduled, fires even if app never opened (`scheduleInactivityReminder`).
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
  a 4-rung ladder because Android WebView has no Web Share API; the native rung needs the
  next store build.
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

Supporting: `tools/deploy.sh` (proves the live URL serves the version), 159 unit tests, and
an eval suite that now measures every Stats sub-tab and all four overlays.


## Photos & voice notes (v251, 2026-11-01)

**Storage:** IndexedDB `daylog-media`, object store `media` (keyPath `id`, indexes `day` and `ctx`).
A record looks like this:
`{ id, kind:'photo'|'voice', mime, blob, thumb?, day, ctx:'log'|'note:<noteId>', ts, w?, h?, dur?, size, caption? }`.
At boot `mediaLoad()` reads every record into the in-memory map `_media`. IDB blobs are
disk-backed handles, so this is cheap. After that, rendering is synchronous.

- **Where it shows:**
  - The Log section `media` ("Photos & voice", after Reflection). `logSecCfg()` now inserts a
    newly added section after its predecessor in the defaults, not at the very bottom.
  - Notes: Photo / Gallery / Voice each create a new note. The note is created only after the
    media is written, so a cancelled camera leaves no empty note. Deleting a note deletes its
    media.
  - History row pills (📷 n 🎙 n), History ▸ Photos (by month), "On this day" (photo-only days
    count), and the `photos` share card.
- **Photos:**
  - `mediaPhotoRecord()` decodes with `createImageBitmap(..., {imageOrientation:'from-image'})`
    and re-encodes on a canvas to JPEG at q0.82 with a 1600px long edge, plus a 360px thumbnail.
  - Typical size is 80–300 KB. Re-encoding also strips EXIF, so no GPS data is kept.
  - Camera = `<input capture=environment>`; gallery = `multiple`.
- **Voice:**
  - MediaRecorder, preferring `audio/webm;codecs=opus` at 32 kbps (about 4 KB/s).
  - An AnalyserNode drives a level meter. If the peak stayed below 0.02, the save toast says
    the clip sounds silent.
  - Notes under 0.7 s are dropped; recording stops at 10 minutes.
  - Leaving the screen or the app, or pressing Android back, **saves** the recording.
  - `dur` is stored because webm from MediaRecorder carries no duration.
- **Viewer** (`#media-view`):
  - Swipe left/right to page, swipe down to close.
  - Caption (debounced put), "Open day", Share (native `DaylogShare.shareImage`, else Web Share,
    else a download) and Delete.
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
- **Not done yet:**
  - adding media to an existing note
  - a Write/article image block
  - search over captions
  - a size cap or cleanup tool beyond the Backup card's MB count
  - sharing voice notes in the native app (`shareImage` sets an image MIME type)
