# Daylog metrics log

Play numbers over time, so a listing or product change can be judged against what came before.
Newest at the bottom. Each row says where the numbers came from. "28d" = the Play Console's
last-28-days view against the 28 days before it.

## The listing-text experiment (started 2026-11-21)

- **Changed 2026-11-21:** title `Daylog: Habit Tracker & Mood` → `Daylog: Lifelog, Mood & Habits`;
  short and full description rewritten (from `aso-2026-11.md`, updated for v263).
- **Old text, for rollback:** `listing-live-before-2026-11-21.json` (exactly what Play served).
  **New text:** `listing-new-2026-11-21.json`.
  Rollback = `node daylog-native-backup/play.mjs set-listing daily-pulse-app/store/listing-live-before-2026-11-21.json`.
- **Same day, also changed (so not all of a move is the text):** new icon, feature graphic and 8
  screenshots (sunset brand); build 121 (widget) in review; web v262/v263 (notification mood
  buttons, Sunday recap, shorter setup, one-time notification ask).
- **Judge on 2026-12-21** (Kishore: "if it underperforms, push back the older one after 1 month"):
  compare store listing visitors/day (search traffic is what the title changes) and conversion.
  Keep the new text if visitors/day are up and conversion has not fallen by more than ~5 points.
  Weekly visitor numbers this small swing a lot; read the 28-day figure, not a single week.

## Snapshots

| Date read | Period | Source | Listing visitors/day | Conversion | Acquisitions | First opens | Total installs | Active devices | DAU (avg) | MAU | User loss/day | Rating |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-21 | Oct 23 – Nov 19 (28d) | Kishore's Play Console screenshots | 8.6 | 47.1% (+15.3 pp) | 127 (+59%) | 73 (+38%) | 232 | ~82 | 18.2 | 113 | 2.96 (+60%) | 5★ |
| 2026-11-23 | all-time | Kishore (chat) | | | | | 242 | 84 (installed audience) | | | | |
| 2026-11-28 | last 28d to Nov 28 | Kishore's Play Console screenshots (Home + app dashboard) | | | 137 (+32%) | 86 (+16%) | | | | 146 monthly active devices (+51%) | | | (also: revenue ₹50.0 in 28d; 67 installs on the Nov 21 release) |
