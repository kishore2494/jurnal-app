# Architecture

## Stack
Vanilla HTML/CSS/JS — **no framework, no build step**. Three core files in `daily-pulse-app/`:
- `index.html` — shell: topbar, one empty `<section class="screen" id="s-*">` per screen, `<nav id="nav">`, alarm overlay, onboarding overlay, toast. Screens are filled by JS.
- `app.js` (~3455 lines) — everything: storage, screens, sync, native bridges. Single file, section-commented (`SCREEN: …`).
- `styles.css` (~582 lines) — "dark instrument panel" theme (Sora + DM Sans, glassy nav, gradient accents, glow + grain background). Revert-safe: `git checkout pre-ux-v40 -- styles.css`.
- `sw.js` — network-first service worker + cache-bust on `controllerchange`. **Bump `CACHE` with every release.**
- `manifest.webmanifest`, `icons/`, `guide.html` (how-to), `privacy.html`, `google-apps-script/Code.gs`.

## Data model — local-first

Everything is `localStorage`, one key per store, all prefixed `dp.`. There is no server.
**The one exception (v251):** photos and voice notes live in IndexedDB (`daylog-media`, store
`media`), because one photo is bigger than localStorage's whole budget. They are in no `dp.*`
key, are never synced to the Sheet, and reach the backup file as `_media` (see `BACKUP_EXTRA`
and features.md ▸ Photos & voice notes). **63 keys** as of v220, totalling ~17 KB on a store with two weeks of
sample data — about **0.3% of the typical 5 MB origin quota**.

### How a read and a write actually work

```js
// read  — always via safeParse with a typed fallback, so a corrupt value degrades to empty
entries() { return safeParse(localStorage.getItem('dp.entries'), {}); }

// write — always via safeSet, which RETURNS FALSE on quota failure
saveEntries(e) { const ok = safeSet('dp.entries', JSON.stringify(e)); pushState(); return ok; }
```

Two rules the whole app depends on:

1. **`safeSet` returns a boolean and callers must honour it.** localStorage throws
   `QuotaExceeded` on a full phone. Before this existed the app showed "Saved 🎉" over a write
   that never landed. Any code path that tells the user something was saved has to check.
2. **`safeParse(raw, fallback)` never throws.** A truncated or hand-edited value returns the
   fallback shape (`{}` or `[]`) rather than crashing the render.

Every save calls `pushState()` — the debounced (1.2 s) multi-device push.

### The two storage shapes

Everything is one of exactly two shapes, and which one is chosen matters:

**Date-keyed object** — one record per calendar day, key `YYYY-MM-DD`:

```json
"2026-08-30": {
  "mood": 5, "energy": 7, "sleepHours": 7.23, "deepWorkHours": 1.6,
  "tasksDone": 3, "tasksPlanned": 3,
  "journal": "Too much scrolling today, need to cut down #digital",
  "habits": { "workout": false, "meditation": false, "healthyFood": true },
  "updatedAt": "2026-08-30T18:04:11.220Z"
}
```

Used by `dp.entries`, `dp.gym`, `dp.health`. Chosen because a day is the natural unit and
because it makes the sync merge *field-level*: two devices editing the same day keep both
sides' fields, and `habits` merges key-by-key so a tick can never be lost.

**Array of records with an `id`** — one item per thing, ordered:

```json
{ "id": "ts1786903440000", "act": "sleep",
  "start": 1786903440000, "end": 1786930860000, "upd": 1786905000000 }
```

Used by `dp.timelog`, `dp.tasks`, `dp.notes`, `dp.plans`, `dp.projects`, `dp.fintx`,
`dp.finaccts`, `dp.finmarks`, `dp.reminders`, `dp.events`, `dp.docs`, and every config store.
Times are **epoch milliseconds** in the time log (a block can cross midnight, so a date string
cannot hold it) and **`YYYY-MM-DD` strings** everywhere a thing belongs to a day.

Ids are `<prefix><Date.now()>` with a collision suffix (`ts1786…-1`). The suffix is not
cosmetic: every lookup in app.js is `list.find(x => x.id === id)`, so a duplicate id makes an
edit or delete hit the wrong record.

### Money is stored as integers

`dp.fintx` amounts are **integer minor units** (paise), never decimals. A hundred 10-paise
entries sum to exactly `1000`; the same sum in floats gives `9.99999999999998`. `parseAmt()`
converts on the way in and returns **`null` on unparseable input — a failure, never 0** —
and `finFmt()` converts on the way out.

### Derived, never stored

The single most important principle. These are computed on every render and never written:
balances, net worth, streaks, progress percentages, award eligibility, all insights, all
charts. Storing them means two sources of truth that drift; deriving them means a corrected
calculation fixes history retroactively and nothing can disagree.

The exceptions are deliberate and each has a reason:
- `dp.awards` — the *earned date* ledger. Derivable state can be re-derived; the moment you
  earned something cannot, and the ledger is what stops an award being revoked.
- `dp.health` — a cache of Health Connect readings, because the sensor is not always readable.
- `dp.pomohist`, `dp.finmarks` — point-in-time facts with no other source.

### Current key list (v220)

| Group | Keys |
|---|---|
| Daily records | `entries`, `gym`, `health` |
| Lists | `tasks`, `notes`, `plans`, `docs`, `events`, `reminders`, `timelog`, `timeacts`, `timebox`, `waves`, `goals`, `projects`, `milestones` |
| Money | `finaccts`, `fintx`, `finmarks`, `finbudget`, `fincats`, `finset` |
| Config | `habitcfg`, `actcfg`, `deepcfg`, `gymcfg`, `gymgroups`, `daycfg`, `corecfg`, `navcfg`, `logsec`, `pomo`, `settings` |
| Ledgers / caches | `awards`, `awardsInit`, `pomohist`, `pjnames` (deleted-project name tombstones), `gapskip` |
| Per-device prefs | `cardratio`, `hapticsOff`, `moodMeterOff`, `nudgeOff`, `ringOff`, `throwbackOff`, `alarmSound` |
| Bookkeeping | `touched` (last-write ms), `onboarded`, `toured`, `whatsnew`, `lastBackup`, `backupNudge`, `quotaWarn`, `sampleMeta`, `errlog`, `pausedAct`, `usageDisclosure`, `exactAsked`, `alarmHealth`, `freshSeen`, and migration flags (`logsecMigrated`, `moodInputMigrated`) |

`dp.health` is deliberately **absent from the sync payload** — Health Connect readings never
leave the device, and the Play Data Safety answer depends on that staying true. There is a
test that fails if any health reading appears in a push.

### Backup / export format

`exportData()` walks `BACKUP_KEYS` and produces one flat JSON object — key without the `dp.`
prefix, value already parsed:

```json
{ "entries": { "2026-08-30": { … } }, "timelog": [ … ], "fintx": [ … ], "settings": { … } }
```

`importData()` writes each key straight back. Anything not in `BACKUP_KEYS` is not in the
backup, which is why adding a store means editing that list.

**Four lists must stay in sync — edit ALL of them when adding a store:**
1. `pushState()` payload — what goes to the Sheet
2. `applyRemoteState()` merge — how it comes back (lists adopt newest-device-wins; entries /
   gym / timelog merge per record; `awards` and `gapskip` **union**, because a stale second
   phone must never be able to un-earn an award)
3. `BACKUP_KEYS` — export / import
4. `reloadCfg()` if it is a customization config

Plus `google-apps-script/Code.gs` if it needs a human-readable Sheet tab.

## Multi-device sync (optional)
The Google Sheet **link is the login**. `google-apps-script/Code.gs` is a Web App (Execute as Me, access Anyone). Full-state snapshot chunked into a hidden `_State` tab; pulled via **JSONP** (`pullState`) to dodge CORS; pushed via `no-cors` POST (`pushState`, debounced 1.2s). Readable tabs also written: `Log`, `Time Log`, `Events`, `Articles`, `Notes`, `Reminders`, `Feedback`. **When Code.gs changes, the user must re-paste it and redeploy a new version** — the Sheet's Log columns are FIXED, so brand-new custom fields sync between devices but don't auto-create Sheet columns.

## Native shell (Android)
Two wrappers exist; **Capacitor is current**:
- `daily-pulse-native/` (Capacitor) — loads the live site remotely (`server.url`), so web pushes update the app instantly. Adds native plugins: `@capacitor/local-notifications` + a custom `FullScreenAlarmPlugin` (Java) for lock-screen alarms. This builds the `.aab` for the Play Store.
- `daily-pulse-android/` (older TWA/Bubblewrap) — superseded; keep only for `android.keystore` + `keystore-password.txt` (the shared signing identity — back these up, never lose them).

Because the shell loads the remote URL, **web-only features need no rebuild** (they reach the installed app on next open). Only native-code changes (new plugin, permission, icon) need a Gradle rebuild with JDK 21 (Android Studio's JBR).

## Deploy
Two GitHub repos, both GitHub Pages, both owned by personal account **kishore2494** (git keychain defaults to work account kishore-FP — see gotchas for the push helper):
- `kishore2494/daily-pulse` → **production** URL. Push here for stable releases.
- `kishore2494/jurnal-app` → **dev** URL. First/original repo.
Git remotes in `daily-pulse-app/`: `origin` = jurnal-app, `prod` = daily-pulse. Release = commit, push both, bump version + cache.
