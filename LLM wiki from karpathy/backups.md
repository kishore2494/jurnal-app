# Backups

**Rule: every version of Daylog must be recoverable from GitHub, not from this laptop.**

## Where everything lives

| Asset | Repo | Visibility | Per-version snapshots |
|---|---|---|---|
| Web app (source mirror) | `kishore2494/jurnal-app` | public | `web-v30` … `web-v165` |
| Web app (**production**) | `kishore2494/daily-pulse` | public | same 109 tags |
| Native shell + plugins | `kishore2494/daylog-native` | **private** | `native-<versionCode>` |
| Upload keystore | **nowhere** | — | **see the risk below** |

The two web repos are independent copies of the same history, so either one alone can
restore any version. `daily-pulse` is the one GitHub Pages serves and the installed app
loads — see the two-remote trap in `gotchas.md`.

## How snapshots are made

- **Web:** `tools/deploy.sh --tag` — pushes both remotes, cuts `web-vN`, dispatches the
  Pages build, then polls the live URL until it serves that version.
- **Native:** `daylog-native-backup/sync.sh` — re-syncs source (excluding build output and
  every secret), commits, pushes, and tags `native-<versionCode>`. It **refuses to commit**
  if a keystore-shaped file is present.

The 109 web tags were created retroactively on 2026-08-26 by walking every commit that
touched `app.js` and reading its `APP_VERSION`.

## The one real risk: the upload keystore

```
/Users/kishore/Documents/p/daily-pulse-android/android.keystore       2,784 bytes
/Users/kishore/Documents/p/daily-pulse-android/keystore-password.txt
alias: dailypulse
```

**One disk. One folder. No copy.** Source code can be rewritten; a signing key cannot. Play
refuses any update whose signature does not match the listing, so without this file Daylog
can never be updated for the users who already have it.

How bad depends on one setting — **Play Console → Test and release → Setup → App integrity →
App signing**:
- **Play App Signing enrolled** → this is only the *upload* key and Google can reset it.
  Recoverable via a support ticket.
- **Not enrolled** → this *is* the app signing key. Losing it is terminal.

Do not commit it in the clear, even to the private repo — a private repo is not encryption.
`daylog-native-backup/KEYSTORE.md` carries the `openssl enc -aes-256-cbc -pbkdf2` recipe;
the passphrase then belongs in a password manager, not beside the archive. **Verify the
restore on a different machine** — an untested backup is a guess.

Play Console retains every `.aab` ever uploaded, so the *bundles* are safe. It does not give
the key back. The artifacts were never the problem.

## What is deliberately NOT backed up

`node_modules/`, `**/build/`, `**/.gradle/` — reproducible, and ~170MB of churn that would
make every native commit unreadable.
