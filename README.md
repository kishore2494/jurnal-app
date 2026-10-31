# Daylog — your life tracker app

A fast, offline, installable app version of your **Daylog** Google Form.
One tap to log mood, energy, habits, journal + tasks. Saves on your device and
(optionally) syncs every entry to a Google Sheet.

Works on **phone + desktop** as an installable app (PWA). No app store needed.

## What's inside
- `index.html`, `styles.css`, `app.js` — the app
- `manifest.webmanifest`, `sw.js`, `icons/` — makes it installable + offline
- `google-apps-script/Code.gs` — the Google Sheet sync backend

---

## 1) Try it on your Mac right now
```bash
cd "/Users/kishore/Documents/p/daily-pulse-app"
python3 -m http.server 8077
```
Open <http://127.0.0.1:8077> in Chrome. To install as a desktop app:
Chrome menu ▸ **Cast, save & share ▸ Install page as app**.

## 2) Put it on your phone (the real goal)
A phone needs the app on an **https link**, not a file. Easiest free options:

**Option A — GitHub Pages / Netlify / Vercel (recommended).** Upload this folder;
you get a link like `https://yourname.github.io/daily-pulse`. Open it on your
phone ▸ Share ▸ **Add to Home Screen**. Now it opens like a native app, offline.

> Ask me ("deploy it") and I'll set this up for you.

## 3) Connect your Google Sheet (optional but nice)
1. Open a Google Sheet ▸ **Extensions ▸ Apps Script**.
2. Paste everything from `google-apps-script/Code.gs`, **Save**.
3. **Deploy ▸ New deployment ▸ Web app** → Execute as *Me*, Access *Anyone* →
   **Deploy**, authorize, and **copy the Web App URL**.
4. In the app: **More ▸ Google Sheet sync** ▸ paste the URL ▸ **Save link**.

Every saved day now appends/updates a row in a `Log` tab. Hit **Push all to
Sheet** to back-fill everything you've logged so far.

---

## Features
- **Log** — your full Daylog: mood, energy, sleep, deep-work, tasks done/planned,
  10-habit checklist, "went well / improve / journal", + a **Deep log** organised into
  collapsible sections (🧠 Mind & Focus · 😌 Wellbeing · 🩺 Health · 💼 Work · 📚 Learning ·
  💰 Finance · 📱 Digital · 🌱 Growth) — the bridge to your full 255-field Life Intelligence
  Tracker. Sunday adds a weekly-review block automatically.
- **Gym** — your real **Fitness Zone** plan (8 groups · 42 exercises: Cardio, Core, Chest,
  Triceps, Shoulder, Biceps, Back, Legs). Pick a group, tick each move off, tap any exercise
  for its **animated how-to demo + form tip + YouTube tutorial**, and log reps/weight.
  Per-day with a 💪 gym streak. Saves locally + folds a workout summary into the day's Sheet row.
  Edit the plan in `workout-plan.js`; animations live in `workout-anims.js`.
- **Tasks** — quick add, check off, carried-over tasks are flagged.
- **Habits** — per-habit streaks 🔥 and 90-day consistency heatmaps.
- **Stats** — streak, days logged, avg mood/energy, gym streak, workouts/30d; mood/energy &
  sleep/deep-work trend charts; 30-day habit completion bars.
- **Photos & voice** (v251) — a Log card to add photos (camera or gallery) and record voice notes
  for the day; Notes can be a photo or a voice clip too. Kept in IndexedDB (`daylog-media`), never
  in localStorage and never sent to the Sheet; carried in the backup file as `_media`.
  "On this day" shows old photos, and History has a Photos tab.
- **History** — every past day, tap to view/edit; a Photos tab shows every Log photo by month.
- **Settings** — grouped pages: Make it yours · Reminders & tracking · Your data (backup includes
  photos and voice notes) · Help · Support (Tell a friend, optional tips).

## Notes
- Data is stored locally in your browser (localStorage). **Export a backup** from
  *More* periodically, or connect the Sheet so you always have a cloud copy.
- Reminders fire while the app is open/installed. For alarms that ring with the app
  **closed and the phone locked**, turn on *ntfy* in More → Background alarms — that has
  shipped, and no notification server of our own was needed. Note what it costs: while it
  is on, each reminder's name and time go to ntfy.sh, a third party. The switch says so,
  and so does `privacy.html`. It is off until you turn it on.
- The **Deep log** fields are the bridge to your full *Life Intelligence Tracker*
  (255-field spec). Add more fields in `DEEP_*` arrays in `app.js` and the matching
  `COLUMNS` in `Code.gs` — the form and Sheet pick them up automatically.


## Releasing a version

Never edit the version by hand — three files carry it and they went out of step once, leaving
offline users on a v214 shell for thirteen releases while the site looked fine.

```
bash tools/bump.sh 236     # app.js APP_VERSION + sw.js CACHE + every index.html ?v=
bash tools/deploy.sh --tag # checks, pushes both remotes, tags, waits, then PROVES it is live
```

`deploy.sh` refuses to run on a dirty tree and runs these first, so a bad release cannot reach
the remotes:

| check | what it stops |
|---|---|
| `tools/run-unit-tests.mjs` | the unit suite rotting unseen. Runs `tests/unit.js` — 439 assertions against the real `app.js` functions — headlessly in jsdom against the real `index.html`. It was browser-only and nothing ran it, so `backupBlob()` could change shape in v230 and leave six assertions failing behind a green wall. Runs the suite under four timezones, because the weekday/weekend spending pattern only appears when the seeded dates land on enough of both — the first CI run was green in IST and red in UTC for that reason. Fails if jsdom is missing, rather than reporting a pass it did not earn. |
| `tools/check-release.mjs` | the three version stamps disagreeing; a precache entry missing from disk (`cache.addAll` is atomic — one 404 kills offline mode); a script or font the page loads that `sw.js` does not precache; any third-party asset |
| `tools/check-backup-keys.mjs` | a stored key that is in neither `BACKUP_KEYS` nor `BACKUP_EXCLUDED`, and user data written with raw `localStorage.setItem` instead of `safeSet` |
| `tools/check-import.mjs` | a backup-restore that accepts a file which is not a Daylog backup. Runs `validateBackup()` from `app.js` for real against nine payloads — an array, `{}`, another app's JSON — because the dangerous case is not a crash but a file with none of our keys writing nothing while the app says "Backup restored". |
| `tools/check-export.mjs` | the hand-rolled CSV escaper in `exportCSV()` breaking. Runs it for real on nine cases plus four properties — a journal entry containing a comma, a quote or a newline must not shift columns. It also *reports* (without failing) that free-text columns export unprefixed, so a line starting `= + - @` is read as a formula by Excel/Sheets. |
| `tools/gen-sitemap.mjs` | the sitemap drifting from the pages on disk. It was hand-maintained and had lost 13 pages, including a closed island — the eight `daily-pulse-vs-*` comparison pages plus `use-cases.html` — that no listed page linked to. Now generated from the directory; `--check` runs in deploy and CI and compares URL sets, not bytes, so a touched file does not fail a release. |
| `tools/check-links.mjs` | a factory-generated page linking somewhere that does not exist, or a page nobody links to. 1,631 internal links across 143 pages. It resolves this site's ABSOLUTE urls to local files — the comparison pages link to the hub that way, and a checker that treats them as external calls the hub an orphan and the links unverifiable, which is wrong twice. Orphans are allowed only by name, with a reason. |
| `tools/check-overlap.mjs` | manual time entry silently double-counting. Runs `overlappingBlocks()` from `app.js` over eleven cases. The boundary is the point: blocks that merely *touch* (09:00–10:00 then 10:00–11:00) are a normal day and must not be flagged, or the warning fires constantly and gets ignored. |
| `tools/check-money.mjs` | a typed amount turning into the wrong money. Runs `parseAmt()` from `app.js` over 25 cases — `1.5k`, `2.5L`, `1,00,000`, `₹250`, refusals — and asserts everything comes back as whole paise, never a float. Two quirks (`1.005` truncates, `1e3` becomes ₹13) are pinned deliberately so changing them is a decision. |
| `tools/check-sync.mjs` | a misconfigured sync endpoint corrupting the store. `remote.entries = "oops"` used to write 13 junk day-keys into the journal; `remote.tasks = "garbage"` was adopted wholesale, so `DB.tasks()` returned a string and the next `.filter()` threw. Runs `remoteSectionOk()` over 13 payloads, and asserts it is actually CALLED — matched as a call, not as the declaration. |
| `tools/check-readme.mjs` | this table drifting from `tools/`: a release tool nobody documents, or a documented one that no longer exists. The tool list is derived from the directory, so a new guard is covered the day it is written. |

Afterwards `tools/verify-live.sh` confirms `app.js`, `sw.js` and `index.html` all serve the same
version. Run it any time:

```
bash tools/verify-live.sh        # checks the version in app.js
bash tools/verify-live.sh v234   # or a specific one
```
