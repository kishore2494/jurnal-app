# Daylog Reddit launch plan (Nov 2026)

> **These are drafts. Nothing was posted, and no account was used or created.** Written 2026-11-21 for web v263 / Play build 121; refreshed 2026-11-26 for web v269 / Play build 122 (8 styles).
> - **I couldn't read any subreddit's rules myself.** Reddit blocks automated readers. `reddit.com/r/<sub>/about/rules.json` returned 403 "blocked by network security", `old.reddit.com` redirected to a login page, and Reddit refuses Anthropic's fetch and search tools by name. I didn't work around the block. The rules below come from second-hand sources (search snippets, directories, indie-maker write-ups and the 2026-11-01 research in `distribution-plan-2026-11.md`), so **every sub is marked UNVERIFIED**. Each post day starts with a 2-minute sidebar check (section 1, step 6). If the sidebar disagrees with this file, the sidebar wins.
> - **Don't mention Google Sheet sync.** New installs don't offer it: `SHOW_SYNC = !!s.syncUrl` in app.js (it waits for the Data Safety form). All drafts say "no cloud copy, keep a backup file" instead.
> - **The widget and the notification mood buttons haven't been checked on a real phone yet** (features.md, 2026-11-21), and the widget shipped in Play build 121 (now 122 in production). Posts 1, 3 and 4 mention them, so step 1 of the checklist below has to pass first.

---

## 1. Before you start (account safety)

Do every item in order. Steps 1–5 happen once, before Day 1. Steps 6–12 apply on every post day.

1. **Check the product first.** On your own phone, Play must show build 122 or later (production since 2026-11-21). Add the widget, tap a face and confirm the mood saves. Then wait for the evening "Log my day" reminder and tap Good, Okay or Low. If either one fails, fix it and wait for the fix to go live before Day 6. A post that promises a broken widget burns that sub for good.
2. **Use your real, long-standing account. Never make a new one, and never use a second account.** Third-party guides report that many subs require an account 7–30 days old and 50–500 karma ([conbersa](https://www.conbersa.ai/learn/reddit-self-promotion-rules)). r/Android's wiki once required developers to have accounts at least 3 months old. **Target: account older than 30 days and at least 100 comment karma before Day 6.** If you're below that, repeat the warm-up (Days 1–5) until you aren't.
3. **The 9:1 rule.** For every post or comment that mentions Daylog, write about nine that don't. Before posting in a sub, leave at least 5 genuinely helpful comments there over 3 or more days. Answer questions, try other people's apps, and give real feedback. The warm-up days in the schedule are for this.
4. **Say "I'm the developer" in the first sentence.** Every draft below already does. Never write as a "user who found this app".
5. **Use only the full links in this file.** No bit.ly or other shorteners (Reddit's spam filter treats them as spam), and no edits that add a link to a post after it has taken off.
6. **On post day, read the sub's sidebar first (2 minutes).** In the Reddit app, open the sub ▸ About ▸ Rules, plus any pinned post, and check three things:
   - (a) Self-promotion is not banned.
   - (b) Which flair is required.
   - (c) Whether the link may go in the post or only in a comment.

   If self-promotion is banned, don't post. Skip that day and move on. If only (b) or (c) differs, follow the sidebar.
7. **One subreddit a day at most, and never the same text twice.** Every body below is different. Don't cross-post, and don't post the same body anywhere else later.
8. **Never ask anyone to upvote or comment.** That includes friends and WhatsApp groups ("please upvote my post"). Don't vote from any other account. Reddit treats this as vote manipulation and can ban the account site-wide.
9. **Stay online for 3 hours after posting, and reply to every comment within a few hours** for the first day. Thank people for criticism and never argue. If someone reports a bug, ask for their phone model and say you'll reply when it's fixed. Then actually reply.
10. **If a post is removed, do not repost it, and do not delete it and post again.** Send the moderators this message once (Reddit app ▸ the sub ▸ ⋯ ▸ Message mods) and accept their answer:

    > Hi mods, my post about my app Daylog was removed today. I'm sorry if I missed a rule. I'm the developer, the app is free with no ads, and I was hoping for feedback rather than clicks. Could you tell me what I got wrong, and whether there is a thread or a day where a post like this is welcome? I won't post it again unless you say it's okay. Thank you for your time.

11. **For subs marked "ask first" (Days 18 and 20), send this message 3 days before**, and post only if a mod says yes:

    > Hi mods, I'm a solo developer in India and I made a free Android app, Daylog: a habit, mood and journal log that keeps everything on the phone, with no account and no ads. Before posting, I wanted to ask whether a post about it is allowed here, and if so, whether the Google Play link should go in the post or in a comment, and which flair to use. If it isn't allowed, no problem at all. Thank you for letting me know.

12. **After posting, open the post from a logged-out browser** (a private tab). If it doesn't show, the spam filter caught it. Send the message from step 10 instead of reposting.

**How you'll see results:** go to Play Console ▸ Grow users ▸ Store performance, and filter traffic source to "Ads and referrals". Each sub has its own `utm_campaign` (the links are in section 3). There are three caveats:
- Only clicks that open the Play Store app are counted. Desktop clicks on play.google.com aren't.
- Since July 2026 the report counts listing visits, not installs.
- Small numbers are grouped as "Other".

---

## 2. Schedule

Times are for US standard time, which runs until 14 Mar 2027. **IST = US Eastern + 10:30.** After 14 Mar, post one hour earlier in IST to hit the same US time. **Suggested start: make Day 1 a Thursday.** Posts then land on Tue, Thu, Sat, Mon, Wed, Fri, Sun and Tue. Order: most promotion-friendly first, strictest last. The small, friendly subs come first, so bugs get fixed before the big ones.

| Day | Subreddit | What | Post at (IST) | US equivalent | Link goes |
|---|---|---|---|---|---|
| 1–5 | r/droidappshowcase, r/TestMyApp, r/alphaandbetausers, r/SideProject, r/ProductivityApps, r/QuantifiedSelf | **Warm-up, no posts.** 3–5 helpful comments a day across these subs. Try two other people's apps in r/droidappshowcase and r/TestMyApp and leave real feedback | any time | — | no links |
| 6 | r/droidappshowcase | Post 1 | 6:30 pm | 8:00 am ET / 5:00 am PT | in the post |
| 7 | — | Reply to everything; 3 comments in r/TestMyApp | — | — | — |
| 8 | r/TestMyApp | Post 2 | 6:30 pm | 8:00 am ET / 5:00 am PT | in the post |
| 9 | — | Reply; fix anything testers hit | — | — | — |
| 10 | r/alphaandbetausers | Post 3 | 6:30 pm | 8:00 am ET / 5:00 am PT | in the post |
| 11 | — | Reply; 3 comments in r/SideProject | — | — | — |
| 12 | r/SideProject | Post 4 | 7:30 pm | 9:00 am ET / 6:00 am PT | in the post |
| 13 | — | Reply; 3 comments in r/ProductivityApps | — | — | — |
| 14 | r/ProductivityApps | Post 5 | 6:30 pm | 8:00 am ET / 5:00 am PT | in the post |
| 15 | — | Reply; send the step-11 message to r/IndiaTech and r/habits | — | — | — |
| 16 | r/QuantifiedSelf | Post 6 (sidebar check is strict here) | 7:30 pm | 9:00 am ET / 6:00 am PT | **first comment** |
| 17 | — | Reply (expect statistics questions) | — | — | — |
| 18 | r/IndiaTech | Post 7, **only if a mod said yes** | 8:00 pm | 9:30 am ET / 6:30 am PT | **first comment** |
| 19 | — | Reply | — | — | — |
| 20 | r/habits | Post 8, **only if a mod said yes** | 6:30 pm | 8:00 am ET / 5:00 am PT | **first comment** |
| 21 | — | Review: compare the Play Console campaign rows with post dates; repeat only what brought visits; note the results in the wiki | — | — | — |

**Weekly threads** (section 4) go on a free day, never on a post day:
- r/androiddev's weekly thread: the first free Monday.
- r/developersIndia Showcase Sunday: the second Sunday of the month. The next one is Sun 13 Dec 2026, then Sun 10 Jan 2027. If it lands on Day 18, move the r/IndiaTech post to Day 19.

### What each sub's rules say (all UNVERIFIED, attempted 2026-11-21)

Subscriber numbers come from third-party directories and may be months old. "Rule" is the closest wording I could find. Where I had no exact wording, I say so.

| Sub | Subscribers | Self-promotion rule (best available) | Play link | Flair | Status |
|---|---|---|---|---|---|
| r/droidappshowcase | not available | The sub exists for app showcases. On 27 May 2026 r/androidapps moved all self-promotion here (mod post, per 2026-11-01 research). A Feb 2026 copy of its rules: Android-only content, and no spam, meaning "substantive descriptions rather than bare links" (paraphrase). | in post | none known | UNVERIFIED |
| r/TestMyApp | ~28k ([Hive Index](https://thehiveindex.com/communities/r-test-my-app/)) | Listed as a "Subreddit for Self Promoters". No rule text found. | in post | none known | UNVERIFIED |
| r/alphaandbetausers | ~41k ([Hive Index](https://thehiveindex.com/communities/r-alpha-and-beta-users/)) | 2021 mod post: "ideally best testing should be free for the user to sign up, as this is not an advertising platform"; include "a description of your app, and a link for how users can sign up". Spam accounts are banned at mod discretion (Aug 2024 copy). | in post | none known | UNVERIFIED |
| r/SideProject | ~280k–887k (estimates conflict: [GummySearch](https://gummysearch.com/tools/subreddit-finder/self-promoters), [Hive Index](https://thehiveindex.com/communities/r-sideproject)) | Promotion tolerated if you also engage; "ads dressed as journey posts get removed" (third-party guide); bare link drops removed ([Redship](https://redship.io/blog/reddit-self-promotion-rules-2026)). Pinned 2026 posts reportedly changed the rules: read them. | in post | possibly required (guides mention flairs; pick the closest to "Showcase / Feedback") | UNVERIFIED |
| r/ProductivityApps | ~201k (GummySearch, 2026-11-01 research) | "Self Promotion" flair in active use. Full rules not found. | in post | Self Promotion | UNVERIFIED |
| r/QuantifiedSelf | ~27k ([Hive Index](https://thehiveindex.com/communities/r-quantifiedself/)) | No rule text found. Recent feeds show developers posting beta invitations and Play links. Treat as strict: discussion first, link in a comment. | first comment | none known | UNVERIFIED |
| r/IndiaTech | not available | Wiki rules seen in a search snippet: civil discourse, "avoid disrupting the community", "posts must be relevant to technology". No self-promotion clause seen, but the snippet may be incomplete. | first comment, **ask mods first** | unknown | UNVERIFIED |
| r/habits | not available | No rule text found. Developers' own habit apps appear in recent posts, but I can't tell whether they're allowed. | first comment, **ask mods first** | unknown | UNVERIFIED |
| r/androiddev | not available | Standalone app posts are against "Rule 3 (promoting your apps without source code)" and "rule no 6 (self-promotion)". The weekly thread says both "are not applied to this thread". | weekly thread only | — | UNVERIFIED |
| r/developersIndia | not available | "self-promotion is heavily restricted"; "posts solely created to sell something are not allowed". Projects go in the Showcase Sunday megathread (2nd Sunday monthly). | megathread only | — | UNVERIFIED |

---

## 3. The posts

The base link is the same everywhere. Only `utm_campaign` changes, so each sub shows up as its own row in Play Console. The scheme follows `LLM wiki from karpathy/distribution.md`: source `reddit`, medium `forum`, campaign = the sub's name, plus `-thread` for megathread comments.

Bodies avoid emoji, so they paste cleanly in both of Reddit's editors. Paste the link on its own line, as written.

---

### Post 1 · Day 6 · r/droidappshowcase

- **Flair:** none known. If the form requires one, pick the one meant for a developer's own app.
- **Link:** in the post.

**Title:**
```
Daylog: free habit, mood and journal tracker that keeps everything on your phone (no account, no ads)
```

**Body:**
```
I'm the developer. Daylog is a free Android app I build on my own, in India.

It puts your day in one place:

- Habits with streaks, schedules (weekdays only, or 3 times a week) so a rest day never breaks a streak, and a 0-100 strength score
- Mood and energy in one tap, a journal with #tags, and photos or voice notes on any day
- Screen time read from the phone (needs Usage access), plus sleep and steps from Health Connect
- Stats that link them, worked out on the phone, like "Heavy screen days cost you -1.2 mood"
- A home-screen widget, mood buttons on the evening reminder, eight visual styles and an optional PIN lock
- Coming from Daylio? It imports Daylio's CSV export, so your old days come with you

No account, no ads, nothing locked. The only purchase is an optional tip. Your entries stay on the phone; one backup file (photos and voice notes included) moves them to a new phone. If you uninstall without a backup, they are gone.

Bug reports with your phone model help a lot. Which part would you actually use, and which would you hide?

Google Play: https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dreddit%26utm_medium%3Dforum%26utm_campaign%3Ddroidappshowcase
```

**Likely questions:**
- **"What's the catch? How do you make money?"**
  > No catch that I know of. There are no ads and no account, and your entries aren't on any server, so there's nothing to sell. Settings has an optional tip. It unlocks nothing; every feature is free for everyone.
- **"Why does it want Usage access?"**
  > Only for screen time. Android shares daily app-usage totals with apps you allow, and Daylog shows them and compares them with your mood and sleep. It's optional: the rest of the app works without it, and the numbers stay on your phone.
- **"Is it open source?"**
  > No. The code of the web version can be read in a browser, but there's no license, so I won't call it open source.
- **"The widget says 'Problem loading widget'" (or doesn't update)**
  > Thank you, that's exactly the report I was hoping for. Which phone, Android version and launcher are you on? I'll try to reproduce it and reply here when the fix is out.

---

### Post 2 · Day 8 · r/TestMyApp

- **Flair:** none known. If the form requires one, pick the one for Android or for feedback.
- **Link:** in the post.

**Title:**
```
Test my app: Daylog for Android, a private daily log. I'd like blunt feedback on the first five minutes
```

**Body:**
```
I'm the developer, one person in India, and the app is free: no ads, no account, nothing paywalled.

Daylog is a daily log: mood, habits, a short journal, photos and voice notes, and, if you allow it, screen time and Health Connect sleep. Everything is stored on the phone.

I recently cut setup from four screens to two and the tour from eight steps to four, because a lot of people install it and drop off on day one. I'd like to know if it's clear now.

If you have five minutes:

1. Install it and finish setup
2. Log today: tap the mood grid, write one line, tick a habit
3. Open Stats and tell me whether it makes sense with one day of data
4. Tell me the exact moment you felt lost or bored

Your phone model and Android version help. I'll reply to every comment and try other people's apps here in return.

What would make you open it again tomorrow?

Google Play: https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dreddit%26utm_medium%3Dforum%26utm_campaign%3Dtestmyapp
```

**Likely questions:**
- **"Why did setup ask for notifications?"**
  > The second setup screen has "Remind me to log my day" ticked at 9 pm. If you untick it, the app doesn't ask. With it on, you get that one daily reminder and, if you stop logging for a while, a few come-back nudges you can switch off under Settings ▸ Log screen widgets.
- **"Stats is empty."**
  > That's expected on day one: Stats starts showing patterns after about a week of entries. I should say that more clearly on the empty screen, so thank you. Did anything there look broken rather than just empty?
- **"Too many features, it's overwhelming."**
  > Fair. Most of it can be hidden from the menu in Settings ▸ Customize, and the Log only shows what you keep. If you tell me the two things you'd remove first, that tells me what to hide by default.
- **"Where is my data? What if I change phones?"**
  > Only on the phone. Settings ▸ Your data makes one backup file you can keep in Drive or email, and you import it on the new phone. Photos and voice notes are inside it. There's no cloud copy, so uninstalling without a backup deletes everything.

---

### Post 3 · Day 10 · r/alphaandbetausers

- **Flair:** none known. The sub expects free sign-up, which Daylog meets: it's the public Play version.
- **Link:** in the post.

**Title:**
```
[Android] Testers wanted for a new home-screen widget in Daylog, a free private habit and mood log
```

**Body:**
```
I'm the developer of Daylog, a free Android app I make on my own in India. It's a habit, mood and journal log that keeps everything on the phone, with no account and no ads.

The latest version added two things I've only tested on my own phone:

1. A home-screen widget: tap one of five faces and today's mood is saved (the app then opens on today's log)
2. Good, Okay and Low buttons on the evening "Log my day" reminder, which save your mood the same way

How to help: install it from Play (no sign-up, no form, nothing to pay), add the widget and use it for three or four days. Then tell me your phone model, Android version and launcher, and anything odd: a widget that says "Problem loading widget", a face that didn't save, a reminder that never came.

I'll reply to every comment, and fixes go out as updates.

Which phones or launchers do you think I should worry about most?

Google Play: https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dreddit%26utm_medium%3Dforum%26utm_campaign%3Dalphaandbetausers
```

**Likely questions:**
- **"Why does tapping the widget open the app?"**
  > Daylog's data lives inside the app itself, so it has to start to save the mood. It opens on today's log, where it says the mood was saved and you can add energy or a note. Would you rather it saved and stayed closed? That tells me whether to work on it.
- **"Do testers get anything?"**
  > There's nothing to unlock: every feature is already free for everyone. What I can promise is that I'll read every report and reply here when it's fixed.
- **"What do you collect from testers?"**
  > Only what you write here. The app has no analytics and no account, so I can't see anyone's entries or how they use it. That's why reports like yours matter so much to me.
- **"Is there an iPhone version?"**
  > No iPhone app, sorry. The web version works in Safari or on a computer: https://kishore2494.github.io/daily-pulse/. It has everything except screen time, Health Connect and the widget, which need Android. Its data stays in that browser, so export a backup now and then.

---

### Post 4 · Day 12 · r/SideProject

- **Flair:** if the form requires one, pick the closest to "Showcase" or "Feedback". Read the pinned posts first; they reportedly changed the rules in 2026.
- **Link:** in the post.

**Title:**
```
I built a private life-log app on my own in India. The Play listing converts well, but almost nobody sees it
```

**Body:**
```
I'm the developer of Daylog, a free Android app (with a web version) for logging your day: habits, mood, a journal with photos and voice notes, a 24-hour time tracker, and screen time, sleep and steps read from the phone. No account, no server, no ads; the only purchase is an optional tip.

It's plain JavaScript in a Capacitor shell with a few native plugins, and all the stats run on the phone, e.g. "Your mood is +1.4 higher on workout days".

Since it went live on Play in late August: 200+ installs, and about 47% of listing visitors install it. But before I started posting, only about 9 people a day saw the listing. The other problem is daily use: roughly 1 in 6 monthly users opens it on a given day. I just shipped a home-screen widget and mood buttons on the evening reminder for that.

If you've grown an app with no ad budget, what actually moved the numbers for you?

Google Play: https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dreddit%26utm_medium%3Dforum%26utm_campaign%3Dsideproject
Web version: https://kishore2494.github.io/daily-pulse/
```

**Likely questions:**
- **"How did you get the first 200 installs?"**
  > Before I posted anywhere it was Play search, my website and friends. I've put a tracking tag on every link since, so in a few weeks I'll know which posts actually brought anyone.
- **"Is 47% real?"**
  > It's Play Console's store-listing conversion for 28 days, so it's a small sample: roughly 9 visitors a day. I read it as "the listing isn't the problem, reach is", not as a precise number.
- **"Why JavaScript and Capacitor instead of native?"**
  > It started as a web app I used myself, and the web version is the same code. Capacitor let me add the native parts (exact alarms, Health Connect, screen time, the widget) without rewriting everything. The cost is that some Android things take extra work, like a widget that saves without opening the app.
- **"What's the monetization plan?"**
  > For now, an optional tip, and nothing is locked. I'm focused on getting people to use it daily first; money matters only once people actually keep it.

---

### Post 5 · Day 14 · r/ProductivityApps

- **Flair:** `Self Promotion` (reported in use; confirm in the post form).
- **Link:** in the post.

**Title:**
```
I made a free, offline day tracker for Android: time, habits, mood and screen time in one place, no account
```

**Body:**
```
I'm the developer, one person working from India, and it's free. I built Daylog because my day was split across a habit app, a mood app, a time tracker and Digital Wellbeing, and none of them talked to each other.

What it does:

- A one-tap 24-hour time tracker: tap what you're doing, tap the next thing when you switch, and the day becomes a colour timeline
- Habits with skip days and a strength score, tasks that carry over to tomorrow, and a Pomodoro timer
- Screen time read from Android, set against your mood and sleep in Stats
- A quick evening log: mood in one tap, a line of journal, a photo if you like

It works offline with no account, no ads and nothing locked (there's an optional tip). Data stays on your phone, so export a backup before switching phones. On iPhone or a computer there's a web version, without the screen time part.

What's the one thing your current setup does that would stop you from switching?

Google Play: https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dreddit%26utm_medium%3Dforum%26utm_campaign%3Dproductivityapps
```

**Likely questions:**
- **"Does the time tracker keep running in the background?"**
  > Yes. A running timer shows an ongoing notification with Pause and Stop, and you can edit the timeline afterwards if you forgot to switch.
- **"Does it connect to Google Calendar?"**
  > No, it doesn't read or write Google Calendar. It has its own calendar, with one-off events and alarms.
- **"Can I use it on my computer too?"**
  > Yes, in the browser: https://kishore2494.github.io/daily-pulse/. The browser copy and the phone copy are separate, though. There's no cloud sync, so you move data between them with a backup file (Settings ▸ Your data ▸ export, then import).
- **"How does screen time relate to mood?"**
  > Once you have enough days with both, Stats compares your heaviest screen-time days with your lightest and shows the mood gap, for example "Heavy screen days cost you -1.2 mood". It's a comparison inside your own data, not a diagnosis.

---

### Post 6 · Day 16 · r/QuantifiedSelf

- **Flair:** none known.
- **Link:** **in the first comment only**, posted right after the post. If the sidebar bans self-promotion even in comments, post nothing here.

**Title:**
```
How I compute sleep, screen-time and habit effects on mood on the phone, and where I think the method is weak
```

**Body:**
```
I'm the developer of Daylog, a free Android app I make alone in India, so this is a maker's post. The link is in a comment, not here.

Daylog logs mood (1-10) and habits by hand and reads screen time, sleep and steps from the phone. All the stats run on the device. Choices I'd like critiqued:

- Screen time: mood on your heaviest third of days vs your lightest third ("Heavy screen days cost you -1.2 mood")
- Steps: mood the day after days above your own median vs other days ("Walking today -> mood +0.7 tomorrow")
- Habits: mood the day after doing a habit vs other days, which avoids the obvious reverse causation, though mood carries over from day to day
- Next-day results get a High, Medium or Low confidence label from sample size and the gap relative to the spread; Low ones stay hidden

What I know is weak: no correction for running many comparisons, no adjustment for weekday, and self-rated mood is noisy.

Which of these would you fix first, and how?
```

**First comment (post it yourself, straight after):**
```
Link for anyone who wants to try it (free, no account, no ads; Android, plus a web version without the phone data): https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dreddit%26utm_medium%3Dforum%26utm_campaign%3Dquantifiedself

To see the health insights before logging for weeks: Stats > Health > "Preview with sample data" (shown until you have 5 days of health data); "Clear sample" removes it.
```

**Likely questions:**
- **"What are the actual thresholds?"**
  > Next-day habit effects need at least 4 days on each side. High confidence = 30+ days and a gap of at least 0.5 SD. Medium = 14+ days and 0.3 SD. Anything else is Low and isn't shown, and a shown effect also needs a gap of at least 0.4 mood points. The screen-time line needs only 6 days with both numbers and a 0.7-point gap, which I agree is thin.
- **"Can I export the raw data?"**
  > Yes. Settings ▸ Your data has a JSON backup (what the app restores from), a CSV with one row per day (date, mood, energy, sleep hours, deep work, tasks, workouts, time summary, journal) and a PDF report.
- **"Why not a regression or a mixed model?"**
  > Mostly because each result has to fit in one honest sentence for people who aren't statisticians, and with 30–60 days per person a model with several predictors overfits fast. But a simple regression with weekday as a covariate for the habit effects is next on my list. Would that be your first step too?
- **"How is habit strength computed?"**
  > It's an exponential moving average with a 13-day half-life, scaled to 0–100, so one missed day dents it instead of zeroing it, and rest days are skipped over. I checked it against Loop Habit Tracker's published curve: 96 vs their 95.9 after 60 perfect days.

---

### Post 7 · Day 18 · r/IndiaTech (only if a mod said yes)

- **Flair:** whatever the mods named; otherwise the sub's closest to "Apps" or "Discussion".
- **Link:** in the first comment, unless the mods said the post is fine.

**Title:**
```
I'm a solo developer in India and made a free Android app that keeps your daily log on your phone, not on a server
```

**Body:**
```
I'm the developer. Daylog is a free Android app I've built on my own here in India: a daily log for habits, mood, a journal with photos and voice notes, and your screen time, sleep and steps from the phone.

Why I built it this way: I didn't want my diary on anyone's server, including mine. There's no account and no login; your entries stay on the phone, and you keep one backup file yourself. No ads, nothing locked, only an optional tip. There's also a simple money tracker that defaults to rupees, and a weekly meal planner that marks dishes veg, egg or non-veg.

Honest limits: Android only (plus a web version), English only for now, and not open source.

I'd like feedback from people here: would Hindi or Tamil versions make a difference for you or your family, or is English fine for an app like this?

Link in the first comment.
```

**First comment:**
```
Google Play (free): https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dreddit%26utm_medium%3Dforum%26utm_campaign%3Dindiatech
```

**Likely questions:**
- **"Why not open source?"**
  > It isn't open source, and I don't want to pretend otherwise. The web version's code can be read in your browser if you want to check what it does with your data.
- **"Does it work fully offline?"**
  > Yes, after the first launch, which needs internet once. Updates arrive when you're online.
- **"Can I pay the tip with UPI?"**
  > The tip goes through Google Play, so whatever payment methods Play offers on your phone work. It's optional and unlocks nothing.
- **"What if I lose my phone?"**
  > Then your entries are gone unless you've kept a backup, because there's no cloud copy. Settings ▸ Your data makes one file; keep it in Drive or email and import it on the new phone. Photos and voice notes are included.

---

### Post 8 · Day 20 · r/habits (only if a mod said yes)

- **Flair:** whatever the mods named.
- **Link:** in the first comment, unless the mods said the post is fine.

**Title:**
```
I built a habit tracker where one missed day doesn't wipe out your streak. Would that help you or make you lazier?
```

**Body:**
```
I'm the developer of Daylog, a free Android app I make on my own in India, so I'm biased. The link is in a comment.

I designed it around one question: why does one missed day feel like losing everything? So:

- Tap a habit twice to mark a rest day. It isn't a tick, but the streak survives
- Weekly habits count any 3 days out of 7, and the week in progress can't break the streak
- Each habit gets a strength score out of 100, a weighted trend, so one bad day dents it instead of zeroing it
- You can add a cue, like "after my morning coffee, at my desk", which shows until you tick the habit off

It's free with no ads and no account, and your data stays on your phone.

My worry is the obvious one: does forgiveness make skipping too easy? If you've kept a habit for months, did a strict streak help you, or did it make you quit after the first miss?
```

**First comment:**
```
Link for anyone curious (free; Android, plus a web version): https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dreddit%26utm_medium%3Dforum%26utm_campaign%3Dhabits
```

**Likely questions:**
- **"Does a rest day count as done in the stats?"**
  > No. It's recorded as skipped, not done, and the day page lists done, skipped and missed separately. It only protects the streak.
- **"Can I track amounts, like 8 glasses of water?"**
  > Yes. A habit can have a target amount and unit, either "at least" (8 glasses, 20 pages) or "at most" (2 coffees).
- **"Why not just use Loop?"**
  > Loop is excellent if you only want habits; the strength score here was checked against its published curve. Daylog is for people who also want mood, a journal and screen time in the same place, so it can show which habits come before your better days.
- **"Isn't a skip button just cheating?"**
  > It can be, and that's my worry too. That's why a skip keeps the streak but never counts as done: the strength score just pauses on that day instead of rising. I'd like to know where you'd draw the line.

---

## 4. Weekly threads (use these instead of a standalone post)

Each one counts as that day's single subreddit. Put it on a free day.

### r/androiddev: "Weekly discussion, code review, and feedback thread"
- **When:** AutoModerator posts it weekly. In the 2024 snapshots it went up on **Mondays**, so comment the same day. The thread waives "Rule 3 (promoting your apps without source code)" and "rule no 6 (self-promotion)". In 2025 there was also a monthly showcase thread; if one is open, this comment fits there too.
- **Comment:**
```
I'm the solo developer of Daylog (free, Android, made in India): a habit, mood and journal app whose UI is a plain-JavaScript web app inside a Capacitor shell, with Java plugins for exact alarms, Health Connect, UsageStats screen time and a new home-screen widget. The widget's RemoteViews are fed by a bridge plugin after every save, and a face tap opens the activity with a per-install secret so other apps can't inject moods. It isn't open source, which is why I'm posting here rather than as a thread.

Question for anyone who has shipped a widget from a WebView or Capacitor app: how did you catch "Problem loading widget" cases across launchers you don't own?

Google Play: https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dreddit%26utm_medium%3Dforum%26utm_campaign%3Dandroiddev-thread
```

### r/developersIndia: "Showcase Sunday Megathread"
- **When:** the second Sunday of every month, posted by the sub's bot. Next: **Sun 13 Dec 2026**, then **Sun 10 Jan 2027**. Comment within a few hours of it going up. The sub restricts self-promotion everywhere else, and older showcase guidance favoured open-source projects, so the comment says plainly that Daylog isn't one.
- **Comment:**
```
Daylog: a free Android app I build alone, a private daily log (habits, mood, a journal with photos and voice notes, screen time, Health Connect sleep and steps). No account and no server: entries stay on the phone.

Stack: vanilla JS with localStorage and IndexedDB plus a service worker, wrapped in Capacitor with Java plugins for alarms, Health Connect, screen time and a home-screen widget. It's hosted on GitHub Pages and the Play app loads the same code. Not open source.

Since late August: 200+ installs and about 47% listing conversion, but low daily use. Question for this sub: how would you test a widget across Xiaomi, Realme and Samsung launchers without owning all of them?

Play: https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dreddit%26utm_medium%3Dforum%26utm_campaign%3Ddevelopersindia-thread
```

### r/digitalminimalism: app-list threads only
- **When:** no fixed day. Per the 2026-11-01 research, apps get in through community-voted list threads. Comment **only** when a mod-run or pinned thread explicitly asks for app suggestions. Never make a standalone post.
- **Comment:**
```
Disclosure: I'm the developer, so weigh this accordingly. Daylog (free, Android, no account, no ads) reads your daily screen time and, after a week or so of logging your mood, shows how your heavy-phone days compare with your light ones, e.g. "Heavy screen days cost you -1.2 mood". It doesn't block anything; it just shows you the trade-off.

Google Play: https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=utm_source%3Dreddit%26utm_medium%3Dforum%26utm_campaign%3Ddigitalminimalism-thread
```

---

## 5. Do NOT post in

### These subs forbid it

None of these could be read on Reddit itself. Each quote shows where it came from.

| Sub | Rule (quoted where wording was available) | Source |
|---|---|---|
| r/androidapps | All self-promotion moved to r/droidappshowcase on 27 May 2026, with zero tolerance in the main sub (paraphrase; exact wording not available) | mod post, recorded in `distribution-plan-2026-11.md` (2026-11-01) |
| r/getdisciplined | "[Meta] If you post about your App, you will be banned." Also a July 2025 mod update: the sidebar rules "clearly state no selling, no external links" | mod posts, July 2024 and July 2025, seen as search-engine copies |
| r/Journaling | For handwritten journaling only; no self-promotion (paraphrase) | wiki, per 2026-11-01 research |
| r/digitaljournaling | Promotion is banned, "not in posts OR comments" | sidebar, per 2026-11-01 research |
| r/productivity | No rule text found, but a developer reports instant removal of an app post ([Indie Hackers](https://www.indiehackers.com/post/have-you-ever-succeeded-in-finding-an-audience-for-your-product-on-reddit-ace984d946)), and a directory advises against "My startup" framing ([launchkit](https://launchkit-5du.pages.dev/best-subreddits/productivity/)) | third-party |
| r/opensource | Open-source projects only, and it reportedly "Bans AI Projects, Restricts Solo Developers". Daylog has no license | [TechRepublic](https://www.techrepublic.com/article/news-reddit-opensource-ai-ban-developers/) |
| r/AppHookup | Deals only, with "new deal posting rules to maintain a higher standard of quality" (Nov 2025). Daylog is already free, so there's no deal to offer | mod post Nov 2025, seen as a search-engine copy |
| r/minimalism, r/simpleliving | "No self-promotion / advertising"; r/simpleliving bans self-promotion and referral links | search-engine copies of the rules |
| r/androiddev (outside the weekly thread) | "Rule 3 (promoting your apps without source code)", "rule no 6 (self-promotion)" | weekly-thread text, 2024 copy |
| r/developersIndia (outside Showcase Sunday) | "self-promotion is heavily restricted"; "posts solely created to sell something are not allowed" | mod announcement, seen as a search-engine copy |

### Left out: no rules found, and the risk is high

- **r/selfimprovement (~2.7M) and r/nosurf (~308k):** no self-promotion rule found either way. The audiences fit, but a removal or ban in a sub this large isn't worth the risk without seeing the sidebar. If you want them later, send the step-11 message first.
- **r/privacy and r/degoogle:** no rules found. Privacy communities usually expect open source, and Daylog isn't. Skip.
- **r/InternetIsBeautiful:** no rules found. It's a websites sub, so only the web version could go there, and it wouldn't send anyone to the Play listing.
- **r/Mood, r/apps, r/IMadeThis:** no rules found. r/IMadeThis reads as mostly crafts.
- **r/Android:** an old wiki copy allows developers' own apps as detailed self-posts from accounts at least 3 months old, if the developer stays to answer questions. That copy may be years old. Re-check its sidebar before considering it.
