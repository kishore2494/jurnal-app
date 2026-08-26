#!/usr/bin/env bash
# Layout eval suite. Runs the probe across every screen x several phone widths and
# prints a scored report. Use it as a BEFORE/AFTER gate on any UI change:
#   tools/evals/run.sh > /tmp/before.txt   # then make the fix
#   tools/evals/run.sh > /tmp/after.txt
#   diff those two.
# Widths chosen from real Android reality: 320 = small/older (Galaxy A0x in
# display-zoom), 360 = the single most common Android CSS width, 412 = Pixel-class,
# 480 = large/tablet-ish.
set -uo pipefail
cd "$(dirname "$0")/../.."
B=~/.claude/skills/gstack/browse/dist/browse
PORT=8471
OUT="${1:-/tmp/eval-report.json}"

lsof -ti :$PORT >/dev/null 2>&1 || (python3 -m http.server $PORT >/dev/null 2>&1 &)
sleep 2

boot() {  # width height
  $B viewport "${1}x${2}" >/dev/null 2>&1
  $B goto "http://localhost:$PORT/?cb=$RANDOM$RANDOM" >/dev/null 2>&1
  local n=0
  until [ "$($B js "typeof navigateTo==='function'" 2>/dev/null | tail -1)" = "true" ]; do
    n=$((n+1)); [ $n -gt 15 ] && return 1; sleep 2
  done
  $B js "localStorage.setItem('dp.onboarded','1'); localStorage.setItem('dp.tourDone','1'); localStorage.setItem('dp.whatsnew',WHATS_NEW.v); localStorage.setItem('dp.lastBackup',String(Date.now())); 'ok'" >/dev/null 2>&1
  $B eval "$PWD/tools/evals/seed.js" >/dev/null 2>&1
  $B goto "http://localhost:$PORT/?cb=$RANDOM$RANDOM" >/dev/null 2>&1
  n=0; until [ "$($B js "typeof navigateTo==='function'" 2>/dev/null | tail -1)" = "true" ]; do
    n=$((n+1)); [ $n -gt 15 ] && return 1; sleep 2
  done
  return 0
}

SCREENS="today time tasks notes plans focus waves gym habits dash cal write history settings search"
echo "[" > "$OUT"; FIRST=1

for VP in "320 640" "360 740" "412 820"; do
  set -- $VP; W=$1; H=$2
  boot "$W" "$H" || { echo "  !! boot failed at ${W}x${H}" >&2; continue; }
  for S in $SCREENS; do
    $B js "try{ show('$S'); window.scrollTo(0,0); }catch(e){} 'ok'" >/dev/null 2>&1
    R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
    case "$R" in \{*) ;; *) continue;; esac
    [ $FIRST -eq 0 ] && echo "," >> "$OUT"; FIRST=0
    printf '{"screen":"%s","w":%s,"h":%s,"r":%s}' "$S" "$W" "$H" "$R" >> "$OUT"
  done
  # the bottom of the Log screen too (where the habit grid + deep log live)
  $B js "show('today'); window.scrollTo(0, document.documentElement.scrollHeight); 'ok'" >/dev/null 2>&1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"today-bottom","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac

  # Stats sub-tabs are not reachable through show(), so drive dashTab directly. Without
  # this the trophy case and the health charts were never measured at any width.
  for T in awards health check time; do
    $B js "try{ dashTab='$T'; show('dash'); renderDash(); window.scrollTo(0,0); }catch(e){} 'ok'" >/dev/null 2>&1
    R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
    case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"dash-%s","w":%s,"h":%s,"r":%s}' "$T" "$W" "$H" "$R" >> "$OUT";; esac
  done

  # The share sheet is a full-screen overlay with its own palette on a dark scrim, so it
  # cannot inherit the app's contrast guarantees — it needs measuring in its own right.
  $B js "try{ dashTab='overview'; show('dash'); shareSheetOpen('streak'); }catch(e){} 'ok'" >/dev/null 2>&1
  sleep 3
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"share-sheet","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ shareSheetClose(); }catch(e){} 'ok'" >/dev/null 2>&1
done
echo "]" >> "$OUT"
python3 tools/evals/report.py "$OUT"
