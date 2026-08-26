# Strava → Daylog: what to build

**Date:** 2026-08-26
**Method:** 5 parallel research agents (achievements, shareable images, recaps, tracking
mechanics, retention psychology) → 13 adversarial verifications → this synthesis.
**111 findings**, 53 rated *build*, 2 refuted on verification.
**Constraint applied throughout:** no social feed, no accounts, no server, not a GPS app.

> **Caveat.** The two research runs hit a session limit before the automated synthesis and
> before 16 of the verifications completed. All 5 research dimensions finished; the
> unverified claims are marked. The psychology audit is separate and only partially complete
> (see the end).

---

## The one constraint that reshapes the whole plan

**Android WebView has no Web Share API — not Level 2 (files), not even Level 1 (text).**

I verified this against our own code rather than taking it on faith:

- `saveFile()` (app.js:2665) gates on `navigator.canShare` → **inside the Capacitor shell that
  entire branch is dead code**, and a PNG falls through to a blob-URL viewer with no share sheet.
- `grep -c canvas app.js` → **0**. Card rendering is greenfield.
- `@capacitor/share` is **not installed**.

So the headline ask splits cleanly, and the seam is worth being honest about:

| Half | Ships how |
|---|---|
| **Generating** the achievement image | **Pure web — instantly.** Canvas 2D → `toBlob()` at ~1080×1350 |
| **Delivering** it to a share sheet / gallery | **One rebuild.** Add `@capacitor/share`, write via Filesystem, share the URI |

Until that rebuild, in-app users get a viewer they must long-press to save. **Don't promise
"share to WhatsApp" before the rebuild lands.**

---

## Build list, ranked by value ÷ effort

### 1. Achievement share cards — S to M, web (delivery needs the rebuild)
The thing you asked for. Details in the next section.

### 2. Best Efforts + PR medals — S, web
Automatic **top-3 lifetime bests per benchmark**, with gold/silver/bronze for 1st/2nd/3rd.
Not just "a record" — a *ladder*, so second-best still registers. Daylog already computes
streaks and strength; this is the same data framed as a personal podium.
**Plus Annual Best Efforts** — "your best this year", which lets someone who peaked in 2024
still win something in 2026. Cheap, and it removes the unreachable-ceiling problem.

### 3. Weekly streaks instead of daily — S, web
**Strava's streak is weekly, and the research called this the single most transferable
decision.** A daily streak makes one bad day a failure; a weekly one absorbs real life.
Daylog already has the humane version of this (the **skip** state and the EMA strength score)
— adding a *weekly* cadence alongside the daily one completes it.

### 4. Goals: 4 metrics × 3 timeframes — L, web
Strava **paywalls custom goals**. A free, private tracker can simply give them away. Combine
with the **goal-gradient effect** (effort accelerates near a target) — which survived
verification — and progress rings you already render.

### 5. Month in Sport: a monthly recap deck — M, web
5 cards, generated monthly. This is the "review" you asked for. Note Strava's deliberate
**scarcity window** (it expires on the 26th) — worth copying the *cadence*, not the artificial
deadline.

### 6. Tiered milestone badges inside one challenge — M, web
Nobody finishes empty-handed. A 30-day challenge awards at 10/20/30, not only at 30. Directly
counters the all-or-nothing failure mode.

### 7. Trophy Case — M, web
A permanent, ordered shelf of everything earned. Accumulated history is itself a retention
force — and it's the natural home for the cards from #1.

### 8. Perceived Exertion (1–10) — S, web
A subjective scale that **replaces a sensor**. Perfect for a phone-only app: you already
collect mood and energy 1–10, so the input pattern exists.

### 9. Post-activity save screen — M, web
Rated "the single highest-value thing to copy" from tracking. Right now Daylog's time tracker
stops and the moment is gone. A save screen (title, how it felt, a note) turns a timer into a
record.

### 10. Temporal (self-past) comparison — M, web
**The evidence-backed replacement for social comparison.** "vs last week / last month / this
time last year" — motivating without a leaderboard. Fits a private app exactly.

### 11. Implementation intentions — S, web
**The strongest single evidence base in the whole set** (reported around d = 0.65). Concretely:
let a habit carry a *when/where* plan ("after coffee, at my desk"), not just a name.

### 12. Fresh-start effect — S, web
Temporal landmarks (Mondays, month starts, birthdays) are free motivational surface. You
already have "On this day" and Year in Pixels — the calendar data is there.

---

## Shareable achievement images — the design

**What goes on the card when there's no GPS route?** Strava hit this exact problem for gym
workouts and answered it with the **Muscle Map**. Daylog's equivalent "route line" candidates,
one per card type:

- The **Year in Pixels** mosaic (already built — and HabitKit proved the grid *is* the share card)
- The **90-day habit heatmap**
- The **24-hour time-tracker ring**
- The **mood/energy line** for the period
- The **habit strength curve**

**Rules the research converged on:**

1. **Deliberately restrict the stats.** Strava puts a tiny number of numbers on a card. Three
   or four, large. Not a dashboard.
2. **The card is the app's own card, dressed up** — not a separate design language. Reuse your
   existing card styling so it's recognisably Daylog.
3. **A signature mark**: high-contrast stroke on a muted ground — that's what makes a shared
   image identifiable at thumbnail size.
4. **One sentence that makes it worth reading.** Strava's "Athlete Intelligence" line. You
   already generate exactly this: *"Workout lifts your mood by 2.0."* Your insight engine is
   the differentiator here.
5. **A share-variant carousel**: one data bundle, four or five pre-rendered card designs, let
   them pick.
6. **1080×1350 (4:5) and 1080×1920 (9:16)** with safe zones — these get shared to stories.
7. **What actually gets shared is effort brags, not confessions.** Streaks, totals, milestones
   — not "my mood was 3/10". Daylio's approach is instructive: export the *chart*, and let the
   ambiguity protect the user.
8. **Share the bitmap, never the data** (Apple Fitness's stance) — privacy as a feature, which
   is your whole brand.

**Canvas traps flagged:** device-pixel-ratio scaling, font loading before first paint,
`toBlob` being async, and emoji rendering — you already ship a twemoji subset, so reuse it.

---

## What Daylog already has — sharpen, don't rebuild

| Strava mechanic | Daylog already does it |
|---|---|
| Consistency > performance (Local Legend) | **Habit strength score** (EMA, 13-day half-life) |
| Forgiving streaks | **Skip state** — streak-neutral, excluded from completion % |
| Progress rings | **Today ring** |
| Annual recap | **Year in Pixels** + **On this day** |
| Athlete Intelligence prose | **On-device insight engine** — arguably better, since it's causal and carries confidence |
| Training Log grid | **90-day heatmaps** |
| Activity taxonomy | **Time-tracker activities** + gym log |

Two of Strava's most-praised mechanics — consistency-over-speed and forgiving cadence — you
already implement in a *more* humane form. Say so in the listing.

---

## Do not build

- **GPS, segments, KOM/QOM, leaderboards, Local Legend crowns.** Not a GPS app; needs a server
  and other people. The *effort histogram* idea ("you need N more") transfers; the crown does not.
- **Kudos and any social-validation loop.** The research flagged this as the one mechanic that
  must not be copied — and there is peer-reviewed evidence of Strava's harms via
  self-presentation and social pressure.
- **Wear OS app, BLE heart-rate sensors, Flyover video.** Large native effort, wrong product.
- **Gear tracking, public-vs-private description split.** Doesn't transfer to a solo tracker.
- **Snapchat-style partner lens integrations.**
- **Strava's paywall pattern.** It gates almost the entire reward and analysis layer — custom
  goals, recaps, most analysis. The research called out three progressive paywalls of the reward
  layer as demotivating. Your "nothing paywalled" position is a genuine weapon; don't trade it.
- **The monthly summary email.** No accounts, no email — and it was the one delivery channel
  rated skip.

### Demotivation modes to avoid (named in the research)
1. **An unreachable ceiling set by somebody else** — the core flaw of leaderboards.
2. **Challenge targets calibrated to nobody** — generic goals that fit no actual user.
3. **Rewards you can lose, and rewards you can fake.**

---

## Evidence notes

**Held up under adversarial checking:** implementation intentions (strongest effect size here),
goal-gradient effect, self-monitoring + goal-setting as the best-evidenced mechanism in
behaviour change, temporal self-comparison, fresh-start effect.

**Rated weak or refused:**
- **Nir Eyal's Hook Model** — an engagement-*extraction* framework, largely inappropriate here.
  (Eyal himself later wrote the counter-argument.)
- **Variable reward schedules** — effective, well-evidenced, and the one mechanic explicitly
  flagged as the one to refuse.
- **Endowed progress** — real, but only ethical if the head start is genuine.
- **Loss aversion / streak protection** — real mechanism, weak app-specific evidence.
- **Tangible rewards undermine intrinsic motivation** — informational feedback is safe, prizes
  are not. Relevant: keep celebrating *information*, never award points-as-currency.
- **The uncomfortable null:** gamification added to plain self-tracking may add little. Plain
  self-monitoring is already the active ingredient. Gamification's real effect size for physical
  activity is *small*.
- **Habit-formation apps have almost no RCT evidence at all.** Worth internalising before
  believing any of this too strongly.

**2 findings were refuted on verification** — one where half the mechanic was sourced to a dead
page and contradicted by Strava's current docs; the other survived the mechanic check but not
its framing.

**Not verified:** 16 verifications never ran (session limit). Anything above marked as
unverified should be re-checked before it drives a build decision.

---

## Suggested order

1. **Achievement card generation** (pure web, ships now) + **Best Efforts / PR medals** — the
   fastest path to the thing you asked for.
2. **`@capacitor/share` rebuild** so the cards actually reach a share sheet. Bundle it with any
   other native work rather than spending a release on it alone.
3. **Weekly streak cadence**, **tiered badges**, **Trophy Case** — the reward layer.
4. **Monthly recap deck** + **temporal comparison** — the "review" surface.
5. **Post-activity save screen** + **perceived exertion** — turns the timer into a record.
