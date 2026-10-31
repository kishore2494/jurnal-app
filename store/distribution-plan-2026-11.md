> **Drafts only. Nothing has been posted and no accounts were created.** Researched 2026-11-01 overnight.
> - **Before posting anything:** say "deploy". Every draft mentions photos and voice notes, which are live only once v250 and v251 are deployed (production is on v249).
> - **"One small release", items 1 and 2: already built in v251.** Story share cards carry a QR code and "Daylog · on Google Play". Settings ▸ Support ▸ Tell a friend offers an invite card, WhatsApp and Copy link. Every link carries a referrer.
> - **The calendar starts 1 Nov.** Shift it to whenever you start.
> - **Insight wording:** quoted examples were changed to the wording the app actually shows ("your mood is +1.4 higher on workout days").

# Daylog distribution plan (Nov 2026)

Researched 1 Nov 2026. Reddit blocks automated reading, so subreddit rules come from mirrors and third-party trackers: **read each sidebar before posting.** "Impact" is judgment, not a forecast.

## 1. Ranked channels

| # | Channel | Rules / constraints | Effort | Impact | Link |
|---|---|---|---|---|---|
| 1 | In-app loops: review ask, share-card link, "Tell a friend" | Never offer anything for a rating ([Google policy](https://android-developers.googleblog.com/2017/06/google-plays-policy-on-incentivized.html)). In-App Review API: no question before the card, quota-limited, no button that only triggers it ([docs](https://developer.android.com/guide/playcore/in-app-review)) | M (one release) | High, compounding | Play Console |
| 2 | WhatsApp/Telegram: friends, college, alumni groups | One personal message per group, no spam groups. India has 500M+ WhatsApp users ([TechCrunch](https://techcrunch.com/?p=1860803)) | L | High per message | — |
| 3 | r/ProductivityApps | 201k members; "Self Promotion" flair in active use ([GummySearch](https://gummysearch.com/r/ProductivityApps/)); full rules unverified | L | Med–High | reddit.com/r/ProductivityApps |
| 4 | AlternativeTo (as alternative to Daylio, Loop, Journey, StayFree, HabitNow) | Free, email verification, English only, **no links/emails in description**, long free queue (paid skip optional), developer access makes edits instant ([FAQ](https://alternativeto.net/faq/)) | L | Med, durable search traffic | alternativeto.net |
| 5 | Show HN, linking the **web version** | Must be usable without sign-up; no landing pages; don't ask friends to upvote ([rules](https://news.ycombinator.com/showhn.html)) | M (be online 6h) | High variance; desktop traffic, so it won't show in UTM reports | news.ycombinator.com |
| 6 | YouTube Shorts + Instagram Reels | I found no reliable install data for indie demo videos; treat as an experiment | M | Unpredictable | — |
| 7 | Product Hunt | Self-hunting encouraged; the day starts 12:01 am PT; never ask directly for upvotes; no company accounts ([PH](https://www.producthunt.com/launch)) | M | Low–Med installs, lasting backlink | producthunt.com |
| 8 | r/droidappshowcase | On 27 May 2026 r/androidapps moved **all** self-promotion here, with zero tolerance in the main sub ([mod post, mirror](https://redlib.groet-infra.nl/r/AndroidApps)) | L | Low–Med | reddit.com/r/droidappshowcase |
| 9 | r/developersIndia Showcase Sunday | Self-promotion "heavily restricted"; projects go in the monthly megathread on the 2nd Sunday ([sub](https://pol1.lr.ggtyler.dev/r/DevelopersIndia), [bot](https://git.psf.lt/LinearArray/deviras/src/branch/main/showcase-sunday/main.py)) | L | Low–Med | — |
| 10 | Peerlist Launchpad | Window opens Mondays; verified profile required ([help](https://help.peerlist.io/individual/launchpad)); free queue reported ~4 weeks (third party) | L | Low–Med (Indian builders) | peerlist.io/launchpad |
| 11 | r/SideProject, r/imadethis | 887k members ([GummySearch](https://gummysearch.com/r/SideProject/)); bare link drops get removed ([Redship](https://redship.io/blog/reddit-self-promotion-rules-2026)); don't post the same text to both on the same day ([SaaSCity](https://saascity.io/blog/best-subreddits-promote-startup-2026)) | L | Low–Med (builders, not users) | — |
| 12 | Indie Hackers | A community, not a directory; posts with numbers and lessons do best | L | Low | indiehackers.com |
| 13 | X / LinkedIn | Only your own followers | L | Low | — |
| 14 | SaaSHub | Free, manually approved; mobile apps need "a decent website" ([SaaSCity](https://saascity.io/directories/saashub)) | L | Low | saashub.com |
| 15 | Uneed | Free queue 30 days to 5 months; paid skip about $15–40 ([aiidelist](https://aiidelist.com/product-launch-sites/uneed)) | L | Low | uneed.best |

**Skip:**
- **r/androidapps main sub:** see #8.
- **r/Journaling:** handwritten only, no self-promotion ([wiki mirror](https://twt.omada.cafe/r/Journaling/wiki/index)).
- **r/digitaljournaling:** no promotion, "not in posts OR comments" ([mirror](https://r.datuan.dev/r/digitaljournaling)).
- **r/AppHookup:** deals only, every post mod-approved; Daylog has no deal ([mirror](https://redlib.groet-infra.nl/r/appHookup)).
- **r/ADHD:** rules not found; sister sub r/AutisticWithADHD bans even free apps ([mirror](https://redlib.groet-infra.nl/r/AutisticWithADHD)).
- **r/productivity:** a developer reports instant removal ([IH](https://www.indiehackers.com/post/have-you-ever-succeeded-in-finding-an-audience-for-your-product-on-reddit-ace984d946)).
- **r/getdisciplined, r/selfimprovement, r/habits, r/privacy, r/IndiaTech:** rules not verifiable.
- **r/digitalminimalism:** apps enter via community-voted list threads ([mirror](https://r.datuan.dev/r/Digitalminimalism)).
- **BetaList:** needs a real landing page; free hosting subdomains discouraged, so github.io likely fails ([criteria](https://betalist.com/criteria)).
- **AppAgg:** no submission route found.
- **Android Police / XDA:** only a generic "Editorial inquiries" contact ([AP](https://www.androidpolice.com/contact/), [XDA](https://www.xda-developers.com/contact/)); pitch once there are reviews.
- **Play "Promotional content":** gated by install, DAU and spend thresholds ([Google](https://play.google.com/console/about/guides/premium-growth-tools/)).

**All Reddit:** post from your real account with history, never a new one (r/apps rule, [SaaSCity](https://saascity.io/blog/best-subreddits-promote-startup-2026)). Say "I'm the developer"; answer every comment.

## 2. Tracking links

This is Google's documented format. The referrer value must be URL-encoded and 512 characters or less ([docs](https://developer.android.com/games/playgames/user-acquisition)):

```
https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3D<source>%26utm_medium%3D<medium>%26utm_campaign%3D<campaign>
```

**Where to read it:** Play Console ▸ Grow users ▸ Store performance. The UTM source and campaign breakdown shows only when traffic source is filtered to "Ads and referrals" ([help](https://support.google.com/googleplay/android-developer/answer/9859173)).

**Caveats:**
- Only visits inside the Play Store app count; play.google.com web visits don't ([help](https://support.google.com/googleplay/android-developer/answer/6263332)).
- Small numbers are grouped as "Other". Since July 2026 the report counts listing clicks, not installs.
- Google defines the dimensions but shows no example link. If a link you know was clicked shows nothing after a week, test top-level `&utm_source=…&utm_campaign=…` on one channel.

| Channel | Link |
|---|---|
| WhatsApp/Telegram | https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dwhatsapp%26utm_medium%3Dmessaging%26utm_campaign%3Dlaunch_nov26 |
| Reddit | https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dreddit%26utm_medium%3Dforum%26utm_campaign%3Dlaunch_nov26 |
| Product Hunt | https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dproducthunt%26utm_medium%3Dlaunch%26utm_campaign%3Dlaunch_nov26 |
| YouTube Shorts | https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dyoutube%26utm_medium%3Dvideo%26utm_campaign%3Dlaunch_nov26 |
| Instagram Reels | https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dinstagram%26utm_medium%3Dvideo%26utm_campaign%3Dlaunch_nov26 |
| In-app share | https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dapp_share%26utm_medium%3Dreferral%26utm_campaign%3Devergreen |

Other channels use the same pattern: `hn`, `peerlist`, `linkedin`, `x`, `devsindia`.

**Custom store listing:** up to 50, each opened with `&listing=<name>` (lowercase, digits, `. - _ ~`) ([help](https://support.google.com/googleplay/android-developer/answer/9156429)). A `students` listing suits college groups. Whether `listing` combines with `referrer` in one URL is undocumented, so test it.

**One small release:**
1. The share card footer ("Private life tracker · no account, no cloud") gives no way to find the app. Add "Daylog · Google Play" and put the in-app share link in the share text.
2. Add a "Tell a friend" row in Settings that shares the WhatsApp message below.
3. Keep the one-time review ask after a 7-day streak celebration. If you switch it to the In-App Review API, drop the explanation sheet in front of it.

## 3. Drafts

### (a) Reddit: r/ProductivityApps (flair: Self Promotion)

**Title:** I made a private, offline life tracker for Android: habits, mood, journal, screen time. No account, no ads

> Hi, I'm Kishore, a solo developer in India. Daylog started as the Google Form I filled in every night; now it's an app on Google Play.
>
> What's in it:
> - Habits with streaks, a skip state for rest days that keeps your streak alive, and a 0–100 strength score, so one missed day doesn't erase months
> - Mood and energy on one grid, and a journal with #tags and voice typing
> - New: photos and voice notes for each day. They stay on the phone and go into your backup file
> - Automatic screen time (needs Android's Usage access) and Health Connect, a one-tap 24h time tracker, focus timers, a gym log and a money tracker
> - Insights worked out on the phone, like "your mood is +1.4 higher on workout days", plus next-day effects with a confidence label. They need a few weeks of entries; Stats ▸ Health has "Preview with sample data" if you want to see them first.
>
> What it doesn't have: an account, a cloud, ads or a paywall (there's an optional tip). Because nothing is uploaded, uninstalling deletes your data unless you export a backup. There's no iPhone app, only a web version. It isn't open source.
>
> I'd value blunt feedback: what confused you in the first five minutes, and what would you remove?
>
> [Reddit link]

### (a2) r/droidappshowcase (short)

**Title:** Daylog: offline habit, mood and journal tracker (free, no account, no ads)

> I'm the developer. Daylog puts habits, mood, a journal with photos and voice notes, screen time and a 24h time log in one app, all stored on your phone. It finds patterns on the device, such as which habits come before your better-mood days. No sign-up, no ads, nothing paywalled; tips are optional. Bug reports with your phone model are very welcome. [Reddit link]

### (b) Show HN

**Title (75 chars):** Show HN: Daylog – an offline life tracker that finds what affects your mood
**URL:** https://kishore2494.github.io/daily-pulse/

**First comment:**
> I built Daylog to replace a Google Form I filled in every night. It's a habit tracker, mood log and journal in one, and everything stays on the device: no account, no server of mine, no analytics.
>
> The link opens the web version (no sign-up). The Android app adds screen time, Health Connect and full-screen alarms.
>
> Details that may interest people here:
> - Plain JavaScript, localStorage and a service worker for offline use. The Android app is the same code in a Capacitor shell.
> - Habit strength is an exponential moving average with a 13-day half-life. I checked it against Loop Habit Tracker's published curve (96 vs. their 95.9 after 60 perfect days).
> - Next-day insights compare your mood the day after a habit with days after you skipped it. The confidence label comes from sample size and from effect size relative to spread. These are correlations in your own data, not causes.
> - To see insights without logging for weeks, use Stats ▸ Health ▸ "Preview with sample data". It's removed in one tap.
>
> Limits: it's free with optional tips, but it isn't open source. The code is readable on GitHub Pages, but there's no license. Two optional features send data off the phone if you turn them on: sync to your own Google Sheet, and ntfy.sh reminders that fire while the app is closed. Both are off by default. With no cloud, uninstalling erases your data unless you export a backup.
>
> Critique of the statistics is most welcome. Play: [hn link]

### (c) Product Hunt

**Tagline (59 chars):** Offline habit, mood and journal tracker that spots patterns

**Description (251 chars):** Daylog is a habit tracker, mood log and journal for Android that works fully offline: no account, no ads, no paywall. Add photos and voice notes to any day, see your screen time, and get on-device insights such as which habits come before better days.

**Maker's first comment:**
> Hi PH, I'm Kishore, the solo developer behind Daylog. I wanted one app for habits, mood, journaling and screen time that needed no account and uploaded nothing. Entries and insights (sleep sweet spot, next-day mood effects with a confidence label) stay on your phone.
>
> New: photos and voice notes for each day, included in your backup file.
>
> Honest limits: Android only (plus a web version), not open source, and uninstalling deletes your data unless you export a backup. It's free; tips are optional.
>
> I'd like to know which part you'd use first, and what feels like too much.

### (d) AlternativeTo description (no links allowed)

> Daylog is a private life tracker for Android and the web that works fully offline, with no account. It combines a habit tracker (streaks, skip days, 0–100 habit strength), a mood and energy grid, a journal with #tags, voice typing, photos and voice notes, automatic screen time, Health Connect data, a one-tap 24-hour time tracker, focus timers, a gym log and a money tracker. On-device insights show which habits and sleep patterns go with better mood, including next-day effects with a confidence rating. Data stays on the device and exports to JSON, CSV or PDF. No ads, no paywall; optional tips.

**Settings:** License: Free (not Open Source). Platforms: Android, Online. Tags: habit-tracker, mood-tracking, journal, offline, privacy.

### (e) WhatsApp / Telegram forward (≤400 chars incl. link)

> Hi! I made an Android app, Daylog: a private diary + habit and mood tracker. Offline, no login, no ads, free. Add photos and voice notes to each day; after a few weeks it shows what lifts your mood. Honest feedback welcome: [WhatsApp link]

### (f) X / LinkedIn

1. I built Daylog, a habit, mood and journal tracker for Android that keeps everything on your phone. No account, no ads. After a few weeks it tells you things like "your mood is +1.4 higher on workout days". Free on Play: [link]
2. New in Daylog: attach photos and voice notes to any day. They stay on your phone and go into your backup file, with no cloud copy. I'm a solo developer, so feedback goes straight to the person who fixes it. [link]
3. What I learned building an offline tracker: next-day effects ("workout today, better mood tomorrow") are more honest than same-day ones, which can mix up cause and effect. Daylog labels each one High/Medium/Low confidence. [link]

### (g) 30-second Reel / Short (vertical screen recording, voice-over)

| Time | Screen | Voice-over / on-screen text |
|---|---|---|
| 0–3s | Today screen, ring at 100% | "My whole day, logged in 20 seconds." |
| 3–9s | Tap the mood grid, type a journal line with #gym | "Mood, energy, one line of journal." |
| 9–15s | Attach a photo, record a 3s voice note | "Photo and voice note for today. They never leave my phone." |
| 15–23s | Stats ▸ insights: "Your mood is +1.4 higher on workout days", a next-day card with its confidence label | "After a few weeks, it shows what actually lifts my mood." |
| 23–27s | Settings ▸ Export backup | "No account. No ads. Offline." |
| 27–30s | Play badge + "Daylog" | "Free on Google Play, link in bio." |

Use real data or clearly labelled sample data; tracking link in description/bio.

## 4. 14-day calendar (times in IST; US is on standard time from 1 Nov, so 8 am ET = 6:30 pm IST and 12:01 am PT = 1:31 pm IST)

**Every day:** reply to every comment within 2h for 12h after a post; answer Play reviews within 24h; log clicks and installs by source nightly; never ask for upvotes; fix reported bugs before the next post.

| Day | Date | Main action | In between |
|---|---|---|---|
| 0 | Sun 1 Nov | Read every sidebar; record the Reel; submit AlternativeTo, SaaSHub, Uneed (free queue); verify Peerlist profile | Build the links above |
| 1 | Mon 2 | WhatsApp 20–30 close contacts | Fix anything they hit on install |
| 2 | Tue 3 | **r/ProductivityApps**, 6:30 pm | Stay online 3h |
| 3 | Wed 4 | Short/Reel #1 (insights); X/LinkedIn post 1 | Turn repeated questions into an FAQ |
| 4 | Thu 5 | **Show HN**, 6:30–7:30 pm | Online 6h; answer stats and privacy questions plainly |
| 5 | Fri 6 | r/droidappshowcase | Fix release; prepare PH gallery and video |
| 6 | Sat 7 | **Product Hunt**, 1:31 pm (weekend = fewer competing launches; my judgment) | Reply to every PH comment all day |
| 7 | Sun 8 | r/developersIndia Showcase Sunday megathread | LinkedIn post 2 |
| 8 | Mon 9 | Peerlist Launchpad (if your slot has come up) | College and alumni groups, one message each |
| 9 | Tue 10 | Short/Reel #2 (photos + voice notes) | — |
| 10 | Wed 11 | r/SideProject: builder story, new text | Reply all evening |
| 11 | Thu 12 | Indie Hackers: real numbers so far, what worked | — |
| 12 | Fri 13 | Release: share-card link, "Tell a friend", fixes; X post 3 | — |
| 13 | Sat 14 | r/imadethis; Short/Reel #3 (one real insight) | — |
| 14 | Sun 15 | Retrospective: compare the UTM table and daily installs with post dates; keep the two channels that moved installs; add the results to the project wiki | — |
