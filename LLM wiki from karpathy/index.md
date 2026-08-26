# Daylog — Wiki Index

One-line catalog of every page. Start here.

- **[architecture.md](architecture.md)** — how the app is built: files, storage keys, sync model, native shell, service worker, build & deploy.
- **[features.md](features.md)** — every screen/feature, its storage key, render function, and how it flows into Stats/sync/backup.
- **[competitors.md](competitors.md)** — teardown of 14 rival trackers: the mechanic behind each, where we already win, what we shipped from it, what NOT to copy.
- **[gotchas.md](gotchas.md)** — hard-won lessons and traps (MIUI, emoji, push auth, keystore, full-screen-intent policy, cache bumps, shared emulator…).
- **[play-store.md](play-store.md)** — Play Store launch status, listing, policy notes, and the exact remaining steps.
- **[roadmap.md](roadmap.md)** — decided-but-not-built work (Firebase accounts, ₹9 sub, foreground service, feedback endpoint) and open questions.
- **[schema.md](schema.md)** — the rules this wiki follows (ingest / query / lint).
- **[log.md](log.md)** — reverse-chronological timeline of changes and decisions.

**Current build:** v120 (bump `APP_VERSION` in `app.js` AND `CACHE` in `sw.js` together every release).
**Live:** production https://kishore2494.github.io/daily-pulse/ · dev https://kishore2494.github.io/jurnal-app/
- [backups.md](backups.md) — where every version lives, how snapshots are made, and the one unbacked file that matters
