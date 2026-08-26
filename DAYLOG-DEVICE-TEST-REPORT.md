# Daylog — device test report

**Date:** 2026-08-26
**App:** Daylog (`io.github.kishore2494.dailypulse`)
**Builds under test:** native **108/68 → 111/71**, web **v119 → v146**
**Purpose:** verify the reminder/alarm defects a closed tester reported, and the UI defects
found alongside them.

---

## Verdict

| Item | Status |
|---|---|
| Alarm fires while the phone is asleep | ✅ **Verified on Android 15 and Android 11** |
| Alarm still rings when Android blocks the alarm screen | ✅ **Verified on both** |
| Exact-alarm permission denial detected and surfaced to the user | ✅ **Verified on Android 15** |
| MIUI dark-mode wash-out | ✅ Fixed and verified |
| Invisible "Snooze" button (light mode) | ✅ Fixed, 1.1:1 → 4.86:1 |
| Alarms restored after reboot | ⚠️ **Code shipped, runtime-unverified** |
| Alarm sound picker | ⚠️ **Code shipped, hand-test pending** |

**Recommended for production: 110/70** — the fully verified build.
111/71 adds the sound picker, which touches the same alarm code path and has not been
hand-tested on a device.

---

## Devices

| Device | OS | Transport | Role |
|---|---|---|---|
| Samsung Galaxy M14 (`SM-M146B`) | **Android 15 / API 35**, One UI 7 | Wireless debugging | **Primary** — the only device where the reported bug can reproduce |
| POCO C31 (`211033MI`) | Android 11 / API 30, MIUI | Wireless + USB | OEM-restriction testing |
| realme (`RMX3231`) | Android 11 / API 30 | — | **Excluded by instruction. Never touched.** |
| Emulator (`Medium_Phone_API_36.1`) | Android 16 / API 36 | — | Abandoned — no network (NAT broken), and excluded by instruction |

**Why Android 15 was essential:** `canScheduleExactAlarms()` does not exist before Android 12,
so exact alarms are *always* granted on Android 11. **The original bug is not reproducible on
the POCO or the realme.** Every earlier "it works" result was therefore inconclusive for the
actual defect.

---

## The defect, and what each fix does

The tester's report — *"I set the alarm, turned the phone off, nothing happened; I turned it on
and the alarm appeared"* — was two independent faults stacked on top of each other.

### Fault 1 — the fallback did not survive Doze
Build 109 fell back to `setWindow(RTC_WAKEUP, at, 10min)` when exact alarms were denied.
`setWindow` is **deferred by idle maintenance**, so the alarm sat unfired until the device left
Doze — which is exactly what happens when you turn the screen on.

**Fix:** `setAndAllowWhileIdle()`. Still inexact (the OS rate-limits it to roughly once per
9 minutes per app) but it *does* fire while dozing, and needs no permission.

### Fault 2 — the sound lived inside the Activity
`AlarmReceiver` chose the **silent** notification channel whenever
`canUseFullScreenIntent()` returned true, assuming `AlarmActivity` would open and ring.
**Having the permission is not the same as being allowed to launch.**

**Fix:** always post on the audible channel (`dp_alarm_audible`, `USAGE_ALARM` sound +
vibration). The notification is now the guaranteed delivery path; `AlarmActivity` cancels it in
`onCreate` when it does win, so the two never overlap.

### Fault 3 — the failure was invisible
`schedule()` threw a `SecurityException` inside a single try/catch wrapping the whole loop, so
one failure skipped every remaining alarm — and `cancelAllInternal()` had already wiped the
working ones. The JS caller discarded the result and ended in `catch { return false }`.

**Fix:** per-alarm try/catch, real state returned to JS, an alarm-health warning card in
Settings, and a one-time prompt right after a reminder is saved.

---

## Primary test — Samsung Galaxy M14, Android 15

Build **110/70**, exact-alarm permission **left denied** (the tester's exact state).

**1. The bug condition was present**

`canScheduleExactAlarms()` → `false`. The in-app warning card appeared correctly, showing
*"Your alarms need one more tap"* and *"Exact alarms are not allowed"*.

**2. The alarm was registered with the Doze-piercing fallback**

```
tag=*walarm*:io.github.kishore2494.dailypulse.ALARM.399
type=RTC_WAKEUP  window=+44s799ms  flags=0x20
whenElapsed=+55s677ms  maxWhenElapsed=+1m40s476ms
policyWhenElapsed: device_idle=--
```

`flags=0x20` is **FLAG_ALLOW_WHILE_IDLE**, and `device_idle=--` confirms Doze was not
deferring it. This is the single most important line in this report — build 109 would have
had neither.

**3. It fired while the phone was asleep**

Phone locked, `mWakefulness=Dozing` for ~100 seconds, then:

```
13:56:15.226  ActivityManager: Received BROADCAST intent
              act=io.github.kishore2494.dailypulse.ALARM.399
              cmp=io.github.kishore2494.dailypulse/.AlarmReceiver
```

**4. Android 15 blocked the alarm screen — and it rang anyway**

```
13:56:15.308  ActivityTaskManager: Background activity launch blocked!
              [... intent: .../.AlarmActivity ... resultIfPiSenderAllowsBal: BAL_BLOCK]
              Abort background activity starts from 10615
```

With build 109's silent channel this was **total silence** — the tester's experience exactly.
Instead:

```
Notification(channel=dp_alarm_audible  category=alarm  flags=...|HIGH_PRIORITY)
```

…and that notification's full-screen intent then launched the alarm screen: screen went
**Awake**, `AlarmActivity` became the resumed activity.

**Conclusion: the chain degrades correctly at every step.** Doze → fires anyway; direct launch
blocked → notification still rings; full-screen intent available → screen takes over.

---

## Secondary test — POCO C31, Android 11, MIUI

Build 109/69. Exact alarms always granted on this OS, so this exercised the OEM path.

- Registered as a genuine **exact alarm clock**: `window=0`,
  `expectedWhenElapsed == maxWhenElapsed`, listed by the OS as **"Next alarm clock
  information"** and **"Next wake from idle"** (Doze-exempt).
- Fired over the locked screen; `Activity requesting to dismiss Keyguard`; audio device left
  standby while ringing and returned afterwards.
- **MIUI blocked the receiver's direct `startActivity()`:**
  `MIUILOG- Permission Denied Activity KeyguardLocked`
  A second launch succeeded 400 ms later — the **full-screen-intent notification**. So on MIUI
  the notification is what actually delivers the alarm; the direct start is decorative.
- Correct channel selected: `dp_fullscreen_alarm` (the quiet one), because
  `canUseFullScreenIntent()` is true on Android 11 and `AlarmActivity` owns the sound.
  The audible fallback channel existed with the right config
  (`sound=alarm_alert`, `usage=USAGE_ALARM`, vibration pattern).
- The user's 8 real reminders were still scheduled afterwards — testing disturbed nothing.

Also verified on this device: the **MIUI dark-mode wash-out fix** (build 108) — background
returned to `(243,245,250)` with system dark mode ON, stable across a dark-mode off→on flip
and a cold restart. The fix only becomes visible after a genuine cold start with the WebView
HTTP cache cleared; a stale render made 108 look broken for an hour.

---

## UI defects fixed alongside

**Invisible Snooze button (reported on Android 16, light mode).** A CSS specificity collision:
`:root[data-mode="light"] .btn-ghost` (0,3,0) out-specified `.alarm-btns .btn-ghost` (0,2,0)
and applied a near-white background while the overlay's white text remained.
**~1.1:1 contrast.** Reproduced only in light mode, which is why every earlier on-device test
(navy theme) missed it. Fixed with id specificity → **4.86:1 in light, navy and black alike**.

**Systemic light-mode contrast gap**, found by adding a WCAG contrast check to the layout eval
suite: `--warn`, `--good`, `--bad` and `--accent` had **no light-mode values**, leaving the 🔥
streak number at **1.48:1**. Fixed with separate `--*-ink` text tokens.

**Habit chip overflow and Log height** (also reported): the chip's label span had no
`min-width: 0`, so it refused to shrink and pushed the "skipped" and streak badges out of the
chip; and `grid-auto-rows: 1fr` made one long label inflate every row. Collapsed deep-log
sections were 79px each — 790px, 19% of the Log — to show ten title rows.

Layout eval movement across 48 screen/viewport combos (320/360/412px):

```
errors 103 → 8      penalty 1684 → 923
  escapes-parent        50 → 0
  past-viewport         10 → 0
  text-clipped          10 → 0
  contrast-invisible    72 → 0
Log screen height:  -10% @320/360,  -13% @412
```

The 8 remaining errors are documented, deliberately accepted cases (5×9px year-in-pixels
cells; ten digits sharing one 320px row).

---

## Not verified — read before promoting

**1. Reboot restore.** `BootReceiver` is registered on-device (confirmed in `dumpsys package`,
with `BOOT_COMPLETED` / `QUICKBOOT_POWERON` / `MY_PACKAGE_REPLACED` filters merged into the
built manifest) and the alarm list is mirrored to SharedPreferences on every `schedule()`.
**But it has never run at runtime.** `BOOT_COMPLETED` is a protected broadcast that adb cannot
send, and `MY_PACKAGE_REPLACED` was not delivered to a manifest receiver either.
**To close it: reboot a phone that has a future reminder set, then check `dumpsys alarm`.**

**2. Alarm sound picker (111/71).** All JS paths verified in the harness (pick / preview / stop
/ vibrate toggle / reset / browser fallback). On-device: 111 installs, launches with zero
logcat errors, and `ACTION_RINGTONE_PICKER` resolves to 12 activities. **The picker round-trip
was never tapped through** — both phones fell asleep and stopped responding to
`KEYCODE_WAKEUP`. Note this change touches the alarm path (`AlarmActivity` reads the chosen
tone; the notification channel id is now derived from it), so **111 should not go to production
until that is confirmed.**

**3. Android 12/13 (API 31–33).** Untested. Exact alarms are *default-granted* there but
revocable, so the behaviour should sit between the two devices tested.

---

## Environment notes worth keeping

- **Wireless debugging on Android 11+ uses a random port**, not 5555 — port scanning cannot
  discover it. Pair with `adb pair <ip>:<pairPort> <code>`, then it appears as an
  `_adb-tls-connect` device.
- A **MAC address is useless** for this, and Android randomises it per network.
- **`AlarmActivity` is `exported=false`**, so `am start` from adb is refused. Drive the native
  path through the app's own **"⏰ Test full-screen alarm (1 min)"** button.
  **"Test in 15 sec" is JS-only** (`setTimeout` + an in-app overlay) and dies when the screen
  sleeps — it proves nothing about the native path.
- In `dumpsys alarm`, grep the **tag** (`*walarm*:<pkg>.ALARM.<id>`), not the intent action.
- Read element bounds from `uiautomator dump`; fixed coordinates are unreliable and on a
  personal device they open the wrong things.

### Handling of the primary device (personal phone)

- **Signing keys were compared before installing** (installed APK pulled and checked:
  both `144d1f76…d728`). They matched, so `install -r` upgraded in place and preserved app
  data. A mismatch would have forced an uninstall and destroyed the entries — hence the check
  first.
- The phone was at **100% storage** (453 MB free of 110 GB) and refused the install. Freed
  **8.14 GB** by deleting only provably-junk Samsung diagnostics: `/sdcard/log/ewlogd`
  (2,498 rolling logs spanning 2024-05 → 2026-08) and `/sdcard/log/batterystats` (2024 dumps).
- **Telegram was left untouched.** The 13.6 GB reported as "cache" is in `files/Telegram/`
  (7.7 GB `Telegram Video`, 5.9 GB `Telegram Files`) — **saved media, not cache**; actual cache
  was 1 MB. Clearing it would have deleted media, so it was reported rather than removed.
- The pre-existing install was **versionCode 2 / versionName 47 (2026-07-19)** with **zero
  alarm components** — alarms could never have worked on that phone regardless of the bug.
