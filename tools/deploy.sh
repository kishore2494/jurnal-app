#!/usr/bin/env bash
# Deploy the web app, and PROVE it went live.
#
# Why this script exists: this repo has TWO remotes and they are not interchangeable.
#
#   origin -> github.com/kishore2494/jurnal-app     (source mirror)
#   prod   -> github.com/kishore2494/daily-pulse    (what the app ACTUALLY loads)
#
# capacitor.config.json points the installed Android app at
# https://kishore2494.github.io/daily-pulse/ — the *prod* remote. Pushing only to origin
# looks completely successful and changes nothing for a single real user. That mistake was
# made and it cost a whole batch of work sitting undeployed while it read as shipped.
#
# It also does not trust the `on: push` trigger. Observed on this repo: a push to prod/main
# landed and registered NO workflow run at all, so the site stayed on the previous version
# with every command reporting success. The workflow is therefore dispatched explicitly and
# the LIVE URL is polled until it serves the expected version. Nothing here reports success
# on the strength of a git exit code.
#
# Usage:  tools/deploy.sh              # deploy current HEAD
#         tools/deploy.sh --tag        # also create+push a per-version snapshot tag
set -uo pipefail
cd "$(dirname "$0")/.."

LIVE="https://kishore2494.github.io/daily-pulse"
WANT_TAG=0
[ "${1:-}" = "--tag" ] && WANT_TAG=1

VER=$(grep -m1 -oE "APP_VERSION = 'v[0-9]+'" app.js | grep -oE 'v[0-9]+')
[ -z "$VER" ] && { echo "!! could not read APP_VERSION from app.js"; exit 1; }
echo "==> deploying $VER"

DIRTY=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$DIRTY" != "0" ]; then
  echo "!! working tree has $DIRTY uncommitted file(s). Commit first — a deploy must be"
  echo "   reproducible from a commit, or the live site and the repo disagree."
  git status --short
  exit 1
fi

# One token, fetched once, never written to disk.
GHT=$(gh auth token -u kishore2494 2>/dev/null)
[ -z "$GHT" ] && { echo "!! no kishore2494 token from gh; run: gh auth login"; exit 1; }
export GHT
HELPER='!f(){ test "$1" = get && printf "username=kishore2494\npassword=%s\n" "$GHT"; }; f'
gitp() { git -c credential.helper= -c credential.helper="$HELPER" "$@"; }

for R in origin prod; do
  echo "==> push $R"
  gitp push "$R" HEAD:main || { echo "!! push to $R failed"; exit 1; }
done

if [ "$WANT_TAG" = "1" ]; then
  TAG="web-$VER"
  if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
    echo "==> tag $TAG already exists, leaving it alone"
  else
    git tag -a "$TAG" -m "web $VER — deployed $(date -u +%Y-%m-%dT%H:%MZ)"
    for R in origin prod; do gitp push "$R" "$TAG" >/dev/null 2>&1 && echo "==> tag $TAG -> $R"; done
  fi
fi

echo "==> dispatching Pages build on prod (never trust the push trigger)"
GH_TOKEN="$GHT" gh workflow run pages.yml --repo kishore2494/daily-pulse --ref main >/dev/null 2>&1 \
  || echo "   (dispatch call failed; a push-triggered run may still exist)"

echo "==> waiting for the build"
for i in $(seq 1 24); do
  sleep 15
  S=$(GH_TOKEN="$GHT" gh run list --repo kishore2494/daily-pulse --limit 1 \
        --json status,conclusion -q '.[0]|"\(.status)/\(.conclusion)"' 2>/dev/null)
  echo "   build poll $i: ${S:-unknown}"
  case "$S" in
    completed/success) break;;
    completed/failure|completed/cancelled)
      echo "!! Pages build failed. A wedged build holds the deployment lock and blocks every"
      echo "   later deploy — check it and re-dispatch:"
      echo "   gh run list --repo kishore2494/daily-pulse"
      exit 1;;
  esac
done

echo "==> confirming the LIVE url actually serves $VER"
for i in $(seq 1 20); do
  GOT=$(curl -s --max-time 25 "$LIVE/app.js?cb=$RANDOM$RANDOM" \
        | grep -m1 -oE "APP_VERSION = 'v[0-9]+'" | grep -oE 'v[0-9]+')
  echo "   live poll $i: ${GOT:-no response}"
  [ "$GOT" = "$VER" ] && { echo "==> LIVE: $LIVE is serving $VER"; exit 0; }
  sleep 15
done

echo "!! $LIVE never served $VER. It is NOT deployed — do not report this as shipped."
exit 1
