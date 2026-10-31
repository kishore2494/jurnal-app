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

# Another Claude session on this machine shares the browse daemon and can navigate the tab
# out from under a run — one full viewport pass was silently measured against a Qube preview
# page from a different project. This re-claims the tab when that happens, so a hijack costs
# a reload instead of a third of the run.
claim() {
  local n=0
  while [ "$($B js "typeof APP_VERSION!=='undefined'" 2>/dev/null | tail -1)" != "true" ]; do
    n=$((n+1)); [ $n -gt 3 ] && { echo "  !! tab hijacked and could not be reclaimed" >&2; return 1; }
    echo "  .. tab drifted to another page; reclaiming" >&2
    $B goto "http://localhost:$PORT/?cb=$RANDOM$RANDOM" >/dev/null 2>&1
    sleep 2
  done
  return 0
}

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

SCREENS="today time tasks notes plans projects money awards focus waves gym habits dash cal write history settings search"
echo "[" > "$OUT"; FIRST=1

for VP in "320 640" "360 740" "412 820"; do
  set -- $VP; W=$1; H=$2
  boot "$W" "$H" || { echo "  !! boot failed at ${W}x${H}" >&2; continue; }
  for S in $SCREENS; do
    claim || break
    $B js "try{ show('$S'); window.scrollTo(0,0); }catch(e){} 'ok'" >/dev/null 2>&1
    R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
    case "$R" in \{*) ;; *) continue;; esac
    [ $FIRST -eq 0 ] && echo "," >> "$OUT"; FIRST=0
    printf '{"screen":"%s","w":%s,"h":%s,"r":%s}' "$S" "$W" "$H" "$R" >> "$OUT"
  done
  claim || continue
  # the bottom of the Log screen too (where the habit grid + deep log live)
  $B js "show('today'); window.scrollTo(0, document.documentElement.scrollHeight); 'ok'" >/dev/null 2>&1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"today-bottom","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac

  # Stats sub-tabs are not reachable through show(), so drive dashTab directly. Without
  # this the trophy case and the health charts were never measured at any width.
  for T in health check time; do
    $B js "try{ dashTab='$T'; show('dash'); renderDash(); window.scrollTo(0,0); }catch(e){} 'ok'" >/dev/null 2>&1
    R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
    case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"dash-%s","w":%s,"h":%s,"r":%s}' "$T" "$W" "$H" "$R" >> "$OUT";; esac
  done

  # Settings opens on a short list of rows; the dense cards (reminder rows, ntfy, the delete
  # stages, backup, sync) live on its pages. Measuring only show('settings') stopped
  # measuring all of them in v250.
  for P in widgets reminders tracking data wipe feedback; do
    $B js "try{ settingsPage='$P'; show('settings'); window.scrollTo(0,0); }catch(e){} 'ok'" >/dev/null 2>&1
    R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
    case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"settings-%s","w":%s,"h":%s,"r":%s}' "$P" "$W" "$H" "$R" >> "$OUT";; esac
  done
  $B js "try{ settingsPage=null; }catch(e){} 'ok'" >/dev/null 2>&1

  claim || continue
  # Money: four tabs, and the empty state is a different page again. Seeded with a credit card
  # in debt and a loan so the negative-balance styling is actually measured, plus the quick-add
  # form and the CSV column-mapper, which only exist while open.
  $B js "try{ var T=todayStr(), ym=finYm(T);
    localStorage.setItem('dp.finaccts', JSON.stringify([
      {id:'bank',name:'HDFC savings account',kind:'bank',opening:parseAmt('50000')},
      {id:'card',name:'Amazon Pay credit card',kind:'card',opening:0},
      {id:'flat',name:'The flat',kind:'asset',opening:0},
      {id:'hl',name:'Home loan',kind:'loan',opening:0}]));
    localStorage.setItem('dp.finmarks', JSON.stringify([
      {id:'m1',ac:'flat',d:T,v:parseAmt('4500000')},{id:'m2',ac:'hl',d:T,v:parseAmt('2800000')}]));
    var tx=[]; for(var i=1;i<=30;i++){ var d=addDays(T,-i);
      tx.push({id:'e'+i,d:d,a:parseAmt(String(300+i*40)),dir:'out',ac:i%3?'bank':'card',
               c:['food','grocery','transport','subs','shopping','fun'][i%6],n:'A fairly long merchant name '+i}); }
    tx.push({id:'sal',d:ym+'-02',a:parseAmt('85000'),dir:'in',ac:'bank',c:'salary',n:'Salary'});
    localStorage.setItem('dp.fintx', JSON.stringify(tx));
    localStorage.setItem('dp.finbudget', JSON.stringify({food:parseAmt('6000'),grocery:parseAmt('4000')}));
    mnTab='over'; mnYm=null; mnAddOpen=false; mnImport=null; show('money'); window.scrollTo(0,0); }catch(e){} 'ok'" >/dev/null 2>&1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"money-over","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  for MT in tx charts ins accts; do
    $B js "try{ mnTab='$MT'; show('money'); window.scrollTo(0,0); }catch(e){} 'ok'" >/dev/null 2>&1
    R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
    case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"money-%s","w":%s,"h":%s,"r":%s}' "$MT" "$W" "$H" "$R" >> "$OUT";; esac
  done
  $B js "try{ mnTab='over'; mnAddOpen='out'; show('money'); }catch(e){} 'ok'" >/dev/null 2>&1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"money-add","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ mnAddOpen=false; mnTab='accts';
    var head=['Date','Narration','Withdrawal Amt.','Deposit Amt.'];
    mnImport={head:head, rows:[['03/08/26','UPI-SWIGGY BANGALORE','450.00',''],['04/08/26','SALARY','','85000.00']], map:mnGuessMap(head)};
    show('money'); }catch(e){} 'ok'" >/dev/null 2>&1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"money-import","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ mnImport=null; mnTab='over';
    ['dp.finaccts','dp.fintx','dp.finmarks','dp.finbudget'].forEach(function(k){localStorage.removeItem(k);});
    show('money'); }catch(e){} 'ok'" >/dev/null 2>&1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"money-empty","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac

  claim || continue
  # The trophy case with its "Unlocked only" filter — a different set of tiles (no locked
  # medals, no mini progress bars) that the default view never renders.
  $B js "try{ awFilter='earned'; show('awards'); window.scrollTo(0,0); }catch(e){} 'ok'" >/dev/null 2>&1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"awards-earned","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ awFilter='all'; }catch(e){} 'ok'" >/dev/null 2>&1

  claim || continue
  # The untracked-time card only exists on a PAST day that has gaps and enough history to
  # guess from — a fresh eval store has none, so it was never measured. Seeded with both row
  # shapes: one carrying a named guess (Yes / Something else / Leave blank) and one open-ended.
  $B js "try{ var H=3600000, log=[];
    for (var i=2;i<=42;i++){ var ds=addDays(todayStr(),-i), b0=new Date(ds+'T00:00:00').getTime();
      log.push({id:'ev'+i+'a',act:'sleep',start:b0-2*H,end:b0+6.5*H,upd:1});
      log.push({id:'ev'+i+'b',act:'work',start:b0+9*H,end:b0+12*H,upd:1}); }
    var y=addDays(todayStr(),-1), yb=new Date(y+'T00:00:00').getTime();
    log.push({id:'evy',act:'gym',start:yb+12*H,end:yb+13*H,upd:1});
    localStorage.setItem('dp.timelog', JSON.stringify(log));
    localStorage.removeItem('dp.gapskip');
    ttDate=y; gapOpen=null; show('time'); window.scrollTo(0,0); }catch(e){} 'ok'" >/dev/null 2>&1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"time-gaps","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  # and with the activity picker expanded, which is a whole row of chips that only exists then
  $B js "try{ var r=gapSegments(ttDate)[0]; if(r){ gapOpen=String(r.a); show('time'); } }catch(e){} 'ok'" >/dev/null 2>&1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"time-gaps-picker","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ gapOpen=null; ttDate=todayStr(); localStorage.removeItem('dp.timelog'); localStorage.removeItem('dp.gapskip'); }catch(e){} 'ok'" >/dev/null 2>&1

  claim || continue
  # The project DETAIL view is not reachable through show() — it needs pjOpen set first, and
  # it holds most of the new markup: status badges on tinted grounds, the inline title inputs,
  # colour swatches and the delete button. Seeded with one of every health state so each
  # badge variant is actually measured rather than only the one a fresh store happens to show.
  $B js "try{ var mk=function(o){return Object.assign({name:'x',status:'active',act:'work',steps:[],miles:[],notes:[],links:[],color:'#5570dd',created:todayStr(),prio:2,outcome:'',due:''},o);};
    localStorage.setItem('dp.projects', JSON.stringify([
      mk({id:'ev1',name:'Overdue project with a long name that wraps',outcome:'An outcome sentence that also runs long',due:addDays(todayStr(),-4),prio:3,steps:[{id:'s',text:'An open step',done:false}],miles:[{id:'m',text:'A milestone',due:addDays(todayStr(),3),done:false}],notes:[{id:'n',at:Date.now(),text:'a log entry'}],links:[{id:'l',label:'Link',url:'https://example.com'}]}),
      mk({id:'ev2',name:'Stalled',steps:[{id:'s',text:'x',done:false}],notes:[{id:'n',at:Date.now()-12*86400000,text:'old'}]}),
      mk({id:'ev3',name:'Planning',status:'planning'}),
      mk({id:'ev4',name:'Paused',status:'paused',due:addDays(todayStr(),-9),steps:[{id:'s',text:'x',done:false}]}),
      mk({id:'ev5',name:'Done',status:'done',steps:[{id:'s',text:'x',done:true,doneAt:Date.now()}]})]));
    pjOpen=null; pjFilter='open'; show('projects'); window.scrollTo(0,0); }catch(e){} 'ok'" >/dev/null 2>&1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"projects-seeded","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ pjOpen='ev1'; show('projects'); window.scrollTo(0,0); }catch(e){} 'ok'" >/dev/null 2>&1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"projects-detail","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ pjAddOpen=true; pjOpen=null; show('projects'); }catch(e){} 'ok'" >/dev/null 2>&1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"projects-new","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ pjAddOpen=false; pjOpen=null; localStorage.removeItem('dp.projects'); }catch(e){} 'ok'" >/dev/null 2>&1

  # The share sheet is a full-screen overlay with its own palette on a dark scrim, so it
  # cannot inherit the app's contrast guarantees — it needs measuring in its own right.
  # The goals card with its form OPEN — inputs, a 3-button picker and a suggest button that
  # only exist in that state.
  $B js "try{ dashTab='overview'; show('dash'); renderDash(); saveGoals([{id:'ev1',k:'habits',p:'w',n:60,at:''},{id:'ev2',k:'deep',p:'m',n:90,at:''},{id:'ev3',k:'steps',p:'y',n:3000000,at:''}]); goalAdd=true; refreshGoals(); window.scrollTo(0,0); }catch(e){} 'ok'" >/dev/null 2>&1
  sleep 1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"dash-goals","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ goalAdd=false; localStorage.removeItem('dp.goals'); refreshGoals(); }catch(e){} 'ok'" >/dev/null 2>&1

  # The month-in-review deck: its own scrim, its own internals.
  $B js "try{ show('dash'); mrOpen(mrMonths()[1]||mrMonths()[0]); }catch(e){} 'ok'" >/dev/null 2>&1
  sleep 2
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"month-deck","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ mrPage=1; mrRender(); }catch(e){} 'ok'" >/dev/null 2>&1
  sleep 1
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"month-deck-2","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ mrClose(); }catch(e){} 'ok'" >/dev/null 2>&1

  # The post-activity save sheet is a form on a dark scrim — its own contrast/tap surface.
  $B js "try{ const n=Date.now(); DB.saveTimelog([{id:'evs',act:allActs()[0].id,start:n-5400000,end:n-600000,upd:n,t:'rewrote the parser',rpe:7,note:'flow state after the first 20 minutes'}]); show('time'); saveSheetOpen('evs'); }catch(e){} 'ok'" >/dev/null 2>&1
  sleep 2
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"save-sheet","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ saveSheetClose(); }catch(e){} 'ok'" >/dev/null 2>&1

  $B js "try{ dashTab='overview'; show('dash'); shareSheetOpen('streak'); }catch(e){} 'ok'" >/dev/null 2>&1
  sleep 3
  R=$($B eval "$PWD/tools/evals/checks.js" 2>/dev/null | tail -1)
  case "$R" in \{*) echo "," >> "$OUT"; printf '{"screen":"share-sheet","w":%s,"h":%s,"r":%s}' "$W" "$H" "$R" >> "$OUT";; esac
  $B js "try{ shareSheetClose(); }catch(e){} 'ok'" >/dev/null 2>&1
done
echo "]" >> "$OUT"
python3 tools/evals/report.py "$OUT"
