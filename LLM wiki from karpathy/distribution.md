# Distribution — how people find Daylog

Started 2026-11-01. Daylog has no marketing budget, so installs come from the Play listing, the
website's SEO pages, and people sharing things from inside the app. This page records what is
wired up and the rules for adding more. The research behind it is in `store/aso-2026-11.md` and
`store/distribution-plan-2026-11.md`, both proposals Kishore has not acted on yet.

## Install referrers: the naming scheme

Every Play link carries `&referrer=` with URL-encoded UTM values, built in one place:
`playLink(source, medium, campaign)` in app.js. Keep using these names so Play Console's report
stays readable.

| utm_source | utm_medium | campaign | Where it comes from |
|---|---|---|---|
| `card` | `qr` | — | QR code on story-shaped share cards (`cardFooter`) |
| `invite` | `qr` | — | QR code on the Invite card |
| `whatsapp` | `invite` | — | "Send the link on WhatsApp" in the invite sheet |
| `copy` | `invite` | — | "Copy link" in the invite sheet |
| `pwa` | `web` | `nudge` | "Install the app" card for Android browser users |
| `landing` | `web` | `header` / `hero` / `final` / `footer` | landing.html buttons |
| `seo` | `web` | page slug (new pages add `-hero` / `-footer`) | the factory SEO pages and the two hand-written ones |
| `llms` | `web` | — | llms.txt |

**Where to read it:** Play Console ▸ Grow users ▸ Store performance, with traffic source filtered
to "Ads and referrals".

**Limits:**
- Only visits inside the Play Store app are counted. A desktop click on play.google.com is not.
- Since July 2026 the report counts listing clicks, not installs.
- Small numbers are grouped as "Other".
- If a link you know was used shows nothing after a week, test plain top-level `&utm_source=`
  on one channel. Google documents the referrer form but shows no example of it.

## What is wired up (v251)

- **Share cards.** Story cards (9:16, the default) get a 176px QR code and
  "Daylog · on Google Play" in the space under the body. 4:5 cards have no room and keep the
  plain footer. The QR comes from the vendored `libs/qrcode.js` (qrcode-generator 1.4.4, MIT),
  which is lazy-loaded and precached. It was decoded with Chrome's BarcodeDetector at full size
  and after a WhatsApp-like 720px JPEG at quality 0.6.
- **Invite card + Settings ▸ Support ▸ Tell a friend** (shown to everyone, not only the Play app).
  - It shows what the app does, plus the number of days logged once there are 7 or more.
  - The sheet adds WhatsApp (`wa.me`, which the shell hands to WhatsApp) and Copy link.
  - Android WebView has no Web Share API, and the native `shareImage` cannot attach text. That
    is why the link travels on the card as a QR code, and separately through wa.me.
- **Web → Play.**
  - Android browser users see a one-time card on the Log. "Not now" hides it for 30 days and
    "Install" hides it for good. State is in `dp.playNudge`, which is BACKUP_EXCLUDED.
  - The card tells anyone with entries how to carry their data across: Export, then Import.
  - landing.html leads with Play; it used to have no Play link at all.
  - The SEO pages make Play the primary button on Android.
- **SEO.**
  - 128 factory pages.
  - `lifelog-app.html` targets "lifelog", the softest term in the 2026-11-01 Play search.
  - `photo-voice-journal.html` covers the new feature.
  - llms.txt is the summary that AI assistants and Ask Play read. Keep it in step with features.

## Rules

- **Never claim:**
  - open source (no license is declared)
  - iOS (there is only the web app)
  - AI (insights are on-device statistics)
  - "nothing ever leaves the phone": the optional Google Sheet sync and ntfy reminders do send
    data. Use "stays on your phone" or "no account".
- **Quote insights in the app's actual wording.**
  - "Your mood is +1.4 higher on workout days" (app.js:3713)
  - "Heavy screen days cost you −1.2 mood"
  - "Walking today → mood +0.7 tomorrow"
  - The drafts once said "workout days lift your mood +1.4", which the app never shows.
- **Marketing pages rot silently.** landing.html said "Coming soon to Google Play" for two months
  after launch, and llms.txt still said "Daily Pulse" ten weeks after the rename. When a feature
  ships, grep the site for the old wording.
- **Don't touch the review ask.** Nothing posts or shares without the user tapping, and nothing
  is offered in return for a rating (Play policy). The one-time review ask after a celebration
  stays as it is.
- **Where not to post:** see the "Skip" list in `store/distribution-plan-2026-11.md`. The big one
  is r/androidapps, which moved all self-promotion to r/droidappshowcase on 27 May 2026.

## Open (Kishore's calls)

- Whether to change the Play title (see `store/aso-2026-11.md` §1). The live listing still shows
  the August text; PASTE-2/3 were never applied.
- The developer name is `kishore_`. A brand name is suggested.
- When to start the 14-day launch calendar. Deploy v250 + v251 first, because every draft
  mentions photos and voice notes.
- New Play screenshots: §4 of the ASO file gives the order and captions.
