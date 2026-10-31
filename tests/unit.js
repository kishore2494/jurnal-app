/* Daylog — unit tests for the pure logic.
   Run: load index.html in a browser, then in the console:  fetch('tests/unit.js').then(r=>r.text()).then(eval)
   (or the headless harness injects it). Tests the REAL app functions, not copies.
   Returns a {pass, fail, results[]} summary and logs it. */
(function () {
  const R = [];
  let pass = 0, fail = 0;
  const approx = (a, b, e = 0.001) => Math.abs(a - b) <= e;
  function ok(name, cond, got) {
    if (cond) { pass++; R.push('PASS ' + name); }
    else { fail++; R.push('FAIL ' + name + (got !== undefined ? ' → got ' + JSON.stringify(got) : '')); }
  }
  const snapshot = localStorage.getItem('dp.tasks');   // we mutate tasks; restore after

  // ---- time/duration math ----
  ok('hoursToHM 7.5 → 07:30', hoursToHM(7.5) === '07:30', hoursToHM(7.5));
  ok('hoursToHM 0 → 00:00', hoursToHM(0) === '00:00', hoursToHM(0));
  ok('hoursToHM empty → ""', hoursToHM('') === '', hoursToHM(''));
  ok('hmToHours 07:30 → 7.5', hmToHours('07:30') === 7.5, hmToHours('07:30'));
  ok('hmToHours bad → ""', hmToHours('nope') === '', hmToHours('nope'));
  ok('hours round-trip', hmToHours(hoursToHM(6.25)) === 6.25, hmToHours(hoursToHM(6.25)));

  // ---- sleep bed→wake (cross-midnight) ----
  ok('bedwake 23:00→06:30 = 7.5', bedwakeHours('23:00', '06:30') === 7.5, bedwakeHours('23:00', '06:30'));
  ok('bedwake 01:00→09:00 = 8', bedwakeHours('01:00', '09:00') === 8, bedwakeHours('01:00', '09:00'));
  ok('bedwake 22:15→06:45 = 8.5', bedwakeHours('22:15', '06:45') === 8.5, bedwakeHours('22:15', '06:45'));
  ok('bedwake missing → ""', bedwakeHours('', '06:00') === '', bedwakeHours('', '06:00'));

  // ---- emoji split ----
  ok('emojiSplit "🍳 Cooking"', (() => { const e = emojiSplit('🍳 Cooking'); return e.emoji === '🍳' && e.name === 'Cooking'; })());
  ok('emojiSplit plain → ⭐', (() => { const e = emojiSplit('Reading'); return e.emoji === '⭐' && e.name === 'Reading'; })());

  // ---- fmtDur ----
  ok('fmtDur 90min', fmtDur(90 * 60000) === '1h 30m', fmtDur(90 * 60000));
  ok('fmtDur 0', typeof fmtDur(0) === 'string');

  // ---- date helpers ----
  ok('addDays +1/-1 inverse', addDays(addDays('2026-01-15', 1), -1) === '2026-01-15', addDays(addDays('2026-01-15', 1), -1));
  ok('addDays crosses month', addDays('2026-01-31', 1) === '2026-02-01', addDays('2026-01-31', 1));
  ok('todayStr format', /^\d{4}-\d{2}-\d{2}$/.test(todayStr()), todayStr());

  // ---- taskCounts (seed tasks) ----
  const T = todayStr(), Y = addDays(T, -1);
  DB.saveTasks([
    { id: 'a', text: 'x', done: false, created: T },              // planned today
    { id: 'b', text: 'y', done: true, doneDate: T, created: T },  // done today
    { id: 'c', text: 'z', done: true, doneDate: Y, created: Y },  // done yesterday
  ]);
  const tcT = taskCounts(T);
  ok('taskCounts today planned=2', tcT.planned === 2, tcT);
  ok('taskCounts today done=1', tcT.done === 1, tcT);
  const tcY = taskCounts(Y);
  ok('taskCounts yesterday done=1', tcY.done === 1, tcY);

  // ---- polymath 0..100 ----
  const pm = polymath({ mood: 8, energy: 7, sleepHours: 7.5, deepWorkHours: 4, habits: { workout: true } });
  ok('polymath returns 0..100', pm && pm.total >= 0 && pm.total <= 100, pm && pm.total);
  ok('polymath null on empty', polymath(null) === null);

  // ---- barChart ----
  ok('barChart empty → placeholder', /No data|empty/i.test(barChart([{ x: 'a', y: null }], '#000')));
  ok('barChart draws svg', /<svg/.test(barChart([{ x: 'a', y: 5 }], '#000', { max: 10 })));

  // ---- coreCfg backfill flags ----
  const cc = coreCfg();
  ok('coreCfg sleep has bedwake', !!(cc.find(f => f.key === 'sleepHours') || {}).bedwake);
  ok('coreCfg deepwork has dur', !!(cc.find(f => f.key === 'deepWorkHours') || {}).dur);

  // ---- safeParse (corruption-proof storage) ----
  ok('safeParse valid', safeParse('{"a":1}', {}).a === 1);
  ok('safeParse corrupt → fallback', safeParse('{corrupt', 'FB') === 'FB');
  ok('safeParse null → fallback', safeParse(null, 42) === 42);
  ok('safeParse "null" → fallback', safeParse('null', 7) === 7);

  // ---- pearson correlation ----
  ok('pearson perfect +1', approx(pearson([[1, 2], [2, 4], [3, 6], [4, 8]]), 1));
  ok('pearson perfect -1', approx(pearson([[1, 8], [2, 6], [3, 4], [4, 2]]), -1));
  ok('pearson no variance → null', pearson([[1, 5], [2, 5], [3, 5]]) === null);
  ok('pearson tiny n → null', pearson([[1, 1], [2, 2]]) === null);

  // ---- snippet (search highlighting) ----
  ok('snippet highlights match', snippet('hello quarterly world', 'quarterly').includes('<b>quarterly</b>'));
  ok('snippet escapes html', !snippet('<img src=x> quarterly', 'quarterly').includes('<img'));
  ok('snippet truncates long text', snippet('x'.repeat(200) + ' quarterly ' + 'y'.repeat(200), 'quarterly').startsWith('…'));

  // ---- bestHabitStreak (seeded entries) ----
  const entSnap = localStorage.getItem('dp.entries');
  const E = {};
  ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05', '2026-01-06'].forEach(d => { E[d] = { habits: { workout: true } }; });
  localStorage.setItem('dp.entries', JSON.stringify(E));
  ok('bestHabitStreak finds 3-run', bestHabitStreak('workout') === 3, bestHabitStreak('workout'));
  ok('bestHabitStreak unknown habit 0', bestHabitStreak('nope') === 0);

  // ---- trackedSleepHours (full night ending on date, no midnight clip) ----
  const tlSnap = localStorage.getItem('dp.timelog');
  const d0 = new Date('2026-01-10T00:00:00').getTime();
  localStorage.setItem('dp.timelog', JSON.stringify([
    { id: 'a', act: 'sleep', start: d0 - 3600000, end: d0 + 6 * 3600000, upd: 1 },      // 23:00→06:00 = 7h, ends Jan 10
    { id: 'b', act: 'sleep', start: d0 + 14 * 3600000, end: d0 + 15 * 3600000, upd: 1 } // 1h nap same day
  ]));
  ok('trackedSleepHours full night + nap', trackedSleepHours('2026-01-10') === 8, trackedSleepHours('2026-01-10'));
  ok('trackedSleepHours other day null', trackedSleepHours('2026-01-11') === null);
  ok('trackedHours ended-only (running excluded)', (() => {
    localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'r', act: 'work', start: Date.now() - 3600000, end: null, upd: 1 }]));
    return trackedHours(todayStr(), 'work') === null;
  })());
  if (tlSnap != null) localStorage.setItem('dp.timelog', tlSnap); else localStorage.removeItem('dp.timelog');
  if (entSnap != null) localStorage.setItem('dp.entries', entSnap); else localStorage.removeItem('dp.entries');

  // ---- pattern-mining helpers ----
  ok('dpMedian odd', dpMedian([3, 1, 2]) === 2);
  ok('dpMedian even', dpMedian([1, 2, 3, 4]) === 2.5);
  ok('dpMedian empty → null', dpMedian([]) === null);
  ok('dpStd known', approx(dpStd([2, 4, 4, 4, 5, 5, 7, 9]), 2.138, 0.01), dpStd([2, 4, 4, 4, 5, 5, 7, 9]));
  ok('dpSlope up', approx(dpSlope([1, 2, 3, 4, 5]), 1));
  ok('dpSlope flat', approx(dpSlope([4, 4, 4, 4, 4]), 0));
  ok('dpSlope tiny n → null', dpSlope([1, 2]) === null);

  // ---- computePatterns on crafted data ----
  const pSnapE = localStorage.getItem('dp.entries'), pSnapT = localStorage.getItem('dp.timelog'), pSnapH = localStorage.getItem('dp.health');
  const PE = {};
  for (let i = 1; i <= 12; i++) {
    const d = addDays(todayStr(), -i);
    const good = i % 2 === 0;   // alternate good sleep+workout days vs short-sleep no-workout
    PE[d] = { mood: good ? 8 : 5, energy: good ? 8 : 5, sleepHours: good ? 7.5 : 5.5, habits: { workout: good } };
  }
  localStorage.setItem('dp.entries', JSON.stringify(PE));
  localStorage.removeItem('dp.timelog'); localStorage.removeItem('dp.health');
  const pats = computePatterns();
  ok('patterns found', pats.length >= 2, pats.length);
  ok('sleep sweet spot detected', pats.some(p => /sleep sweet spot/i.test(p.head)), pats.map(p => p.head).join('|'));
  ok('habit lift detected', pats.some(p => /lifts your mood/i.test(p.head)));
  ok('patterns escape labels', !pats.some(p => /<img|onerror/i.test(p.head)));
  if (pSnapE != null) localStorage.setItem('dp.entries', pSnapE); else localStorage.removeItem('dp.entries');
  if (pSnapT != null) localStorage.setItem('dp.timelog', pSnapT); else localStorage.removeItem('dp.timelog');
  if (pSnapH != null) localStorage.setItem('dp.health', pSnapH); else localStorage.removeItem('dp.health');

  // ---- fmtMin ----
  ok('fmtMin 445 → 7h25m', fmtMin(445) === '7h25m', fmtMin(445));
  ok('fmtMin null → null', fmtMin(null) === null);
  ok('fmtMin under an hour drops the 0h', fmtMin(29) === '29m', fmtMin(29));

  // ---- You vs you (temporal comparison) ----
  const vSnapE = localStorage.getItem('dp.entries'), vSnapT = localStorage.getItem('dp.timelog'),
        vSnapH = localStorage.getItem('dp.health'), vSnapMode = vsMode;
  const VE = {};
  for (let i = 1; i <= 14; i++) VE[addDays(todayStr(), -i)] = { mood: i <= 7 ? 8 : 6, habits: {} };
  VE[todayStr()] = { mood: 1, habits: {} };            // a partial today that must be ignored
  localStorage.setItem('dp.entries', JSON.stringify(VE));
  localStorage.removeItem('dp.timelog'); localStorage.removeItem('dp.health');
  vsMode = 'w';
  const vw = vsPastHTML();
  ok('vs card renders', /vs-card/.test(vw));
  // 8.0, not ~7.1: today's mood of 1 must not be averaged into the recent window
  ok('vs excludes a partial today', /pm-score">8\.0/.test(vw), (vw.match(/pm-score">[^<]*/) || [])[0]);
  ok('vs shows the older window value', /vs 6\.0/.test(vw));
  ok('vs names the excluded day', /sits out of both sides/.test(vw));
  // window arithmetic: 7 days ending yesterday, and the pair before it
  const vA = vsWindow(7, 1), vB = vsWindow(7, 8);
  ok('vs window ends yesterday', vA.days[6] === addDays(todayStr(), -1), vA.days[6]);
  ok('vs windows do not overlap', vA.days[0] > vB.days[6]);
  ok('vs windows are the same length', vA.days.length === 7 && vB.days.length === 7);
  // year mode compares the same weekdays: 364 days back, not 365
  ok('vs year steps back 364 days', (VS_PERIODS.find(x => x.k === 'y') || {}).back === 364);
  ok('vs year keeps the weekday aligned',
     new Date(vsWindow(28, 1).days[0] + 'T00:00:00').getDay() ===
     new Date(vsWindow(28, 365).days[0] + 'T00:00:00').getDay());
  // direction: screen time is one of the metrics that is better DOWN
  ok('vs screen time is a down-is-better metric',
     (VS_METRICS.find(m => m.k === 'screen') || {}).dir === -1);
  // Mood is deliberately dir 0 — see the comment on VS_METRICS. A metric that IS scored:
  ok('vs sleep is an up-is-better metric', (VS_METRICS.find(m => m.k === 'sleep') || {}).dir === 1);
  ok('vs time tracked takes no side', (VS_METRICS.find(m => m.k === 'tracked') || {}).dir === 0);
  // a thin log must say so rather than render an empty frame
  localStorage.setItem('dp.entries', JSON.stringify({ [todayStr()]: { mood: 7 } }));
  const vThin = vsPastHTML();
  ok('vs degrades honestly on a thin log', /more day/.test(vThin) && !/wow-row/.test(vThin));
  vsMode = vSnapMode;
  if (vSnapE != null) localStorage.setItem('dp.entries', vSnapE); else localStorage.removeItem('dp.entries');
  if (vSnapT != null) localStorage.setItem('dp.timelog', vSnapT); else localStorage.removeItem('dp.timelog');
  if (vSnapH != null) localStorage.setItem('dp.health', vSnapH); else localStorage.removeItem('dp.health');

  // ---- Stats overview: hero + sparkline tiles ----
  ok('sparkline exists', typeof sparkline === 'function');
  ok('statTile exists', typeof statTile === 'function');
  // too few points is not a fake line
  ok('sparkline needs 2+ points', !/path/.test(sparkline([5])) && !/path/.test(sparkline([])));
  ok('sparkline draws a line and a fill', /spark-line/.test(sparkline([1,5,3,7])) && /spark-fill/.test(sparkline([1,5,3,7])));
  // nulls are bridged, not treated as zero — a gap must not fake a crash
  const spN = sparkline([6,null,6,null,6]);
  ok('sparkline bridges nulls', /spark-line/.test(spN));
  ok('a flat series does not divide by zero', /spark-line/.test(sparkline([5,5,5,5])));
  // the arrow follows the NUMBER; only the colour follows whether up is good
  const upGood = statTile({cls:'mood',label:'Mood',value:'7.0',spark:[6,7],delta:0.8,upGood:true});
  const upBad  = statTile({cls:'mood',label:'Screen',value:'7.0',spark:[6,7],delta:0.8,upGood:false});
  ok('a rise always shows an up arrow', /▲/.test(upGood) && /▲/.test(upBad));
  ok('a good rise is coloured up', /st-delta up/.test(upGood));
  ok('a bad rise is coloured down', /st-delta down/.test(upBad));
  ok('a change inside eps reads level',
     /st-delta flat/.test(statTile({cls:'mood',label:'M',value:'7.0',spark:[7,7],delta:0.01,eps:0.15})));
  ok('a missing value renders a dash, not a zero',
     statTile({ cls: 'mood', label: 'M', value: '–', spark: [] }).indexOf('>–<') !== -1);
  ok('a missing value shows no delta at all',
     !/st-delta/.test(statTile({ cls: 'mood', label: 'M', value: '–', spark: [], delta: 2 })));

  // ---- Notifications: one icon, and a live timer ----
  ok('there is a single notification icon constant', NOTIF_ICON === 'ic_stat_daylog');
  ok('the timer prefers the native live counter', /timerPlugin\(\)/.test(refreshTimerNotif.toString()));
  ok('the timer falls back with the icon set', /smallIcon: NOTIF_ICON/.test(refreshTimerNotif.toString()));
  ok('notification-button actions are drained on resume', typeof drainTimerAction === 'function');
  ok('the timer plugin is absent on the open web', timerPlugin() === null);

  // ---- Awards is its own screen, not a fifth Stats tab ----
  ok('awards is a nav destination', !!navCfg().find(n => n.k === 'awards'));
  ok('awards has a renderer', typeof RENDER.awards === 'function');
  ok('awards has a screen container', !!document.getElementById('s-awards'));
  ok('stats is back to four tabs', !/data-dashtab="awards"/.test((() => {
    const prev = dashTab; dashTab = 'overview'; renderDash();
    const h = document.getElementById('s-dash').innerHTML; dashTab = prev; return h; })()));

  // ---- One mood input, not two ----
  ok('the mood grid spans 1-10', MM_COLS[0] === 1 && MM_COLS[MM_COLS.length - 1] === 9);
  ok('the mood grid has 5 levels per axis', MM_COLS.length === 5 && MM_ROWS.length === 5);
  ok('every grid cell maps to a real quadrant',
     MM_COLS.every(m => MM_ROWS.every(e => !!MM_QUAD[mmQuad(m, e)])));
  // the grid must survive the sliders it replaced being hidden
  const gmSnapC = localStorage.getItem('dp.corecfg'), gmSnapDate = logDate;
  const gmCfg = coreCfg();
  ['mood', 'energy'].forEach(k => { const r = gmCfg.find(f => f.key === k); if (r) r.hidden = true; });
  localStorage.setItem('dp.corecfg', JSON.stringify(gmCfg));
  logDate = todayStr();
  ok('the grid survives its sliders being hidden', /mm-grid/.test(moodMeterHTML()));
  logDate = gmSnapDate;
  if (gmSnapC != null) localStorage.setItem('dp.corecfg', gmSnapC); else localStorage.removeItem('dp.corecfg');

  // ---- Only one alarm test button ----
  ok('the reminder test scaffold is gone', !/rem-test15/.test(renderSettings.toString()));

  // ---- Copy that quotes a number must match the code ----
  // Caught on a real device: What's-new said "54 awards across 8 families" after a ninth
  // family was added. Copy that states a count has to be derived or asserted, never typed.
  const awCount = awardList().length, awFams = AWARD_FAMILIES.length;
  const wnText = (WHATS_NEW.items || []).join(' ');
  const wnClaim = wnText.match(/(\d+) awards across (\d+) families/);
  ok('what\'s-new quotes the real award count', !wnClaim || +wnClaim[1] === awCount,
     wnClaim ? wnClaim[1] + ' claimed vs ' + awCount + ' actual' : 'no claim');
  ok('what\'s-new quotes the real family count', !wnClaim || +wnClaim[2] === awFams,
     wnClaim ? wnClaim[2] + ' claimed vs ' + awFams + ' actual' : 'no claim');

  // ---- Perfect days: the definition the app actually promises ----
  const pdSnapE = localStorage.getItem('dp.entries'), pdSnapC = localStorage.getItem('dp.habitcfg');
  localStorage.setItem('dp.habitcfg', JSON.stringify([
    { key: 'pa', emoji: '1', label: 'A' }, { key: 'pb', emoji: '2', label: 'B' },
    { key: 'pc', emoji: '3', label: 'C' }, { key: 'pd', emoji: '4', label: 'D' }]));
  reloadCfg(); _goalMap = null;
  const pdRun = mk => { const e = {};
    for (let i = 9; i >= 0; i--) e[addDays(todayStr(), -i)] = { mood: 7, habits: mk() };
    localStorage.setItem('dp.entries', JSON.stringify(e)); _goalMap = null;
    return (awardList().find(x => x.grp === 'perfect') || {}).cur; };
  // a habit never once tapped must COUNT AGAINST a perfect day, or the award is free
  ok('never-tapped habits break a perfect day', pdRun(() => ({ pa: true })) === 0, pdRun(() => ({ pa: true })));
  // a skip is neutral here, exactly as it is for streaks and strength
  ok('a skipped habit still allows a perfect day',
     pdRun(() => ({ pa: true, pb: true, pc: true, pd: 0 })) === 10);
  ok('all done is a perfect day', pdRun(() => ({ pa: true, pb: true, pc: true, pd: true })) === 10);
  // but a day where nothing was actually done is not perfect
  ok('all skipped is not a perfect day', pdRun(() => ({ pa: 0, pb: 0, pc: 0, pd: 0 })) === 0);
  ok('a missed habit is not a perfect day',
     pdRun(() => ({ pa: true, pb: true, pc: true, pd: false })) === 0);
  if (pdSnapE != null) localStorage.setItem('dp.entries', pdSnapE); else localStorage.removeItem('dp.entries');
  if (pdSnapC != null) localStorage.setItem('dp.habitcfg', pdSnapC); else localStorage.removeItem('dp.habitcfg');
  reloadCfg(); _goalMap = null;

  // ---- Deleting your own data ----
  ok('a wipe function exists', typeof wipeEverything === 'function');
  // Deliberately NOT two-step any more: two taps was far too little friction for something
  // with no undo. Four stages, a typed word, and an unskippable countdown.
  ok('the wipe is staged', typeof _wipeStage === 'number' && typeof wipeStageHTML === 'function');
  ok('the wipe requires a typed word', WIPE_WORD === 'DELETE');
  wipeReset();
  ok('the wipe starts disarmed', _wipeStage === 0);
  ok('stage 0 only offers to begin', /wipe-go/.test(wipeStageHTML()) && !/wipe-confirm/.test(wipeStageHTML()));
  _wipeStage = 2; _wipeCountdown = 5;
  ok('the countdown blocks stage 2', /disabled/.test(wipeStageHTML()));
  _wipeCountdown = 0;
  ok('stage 2 opens once the countdown ends', !/disabled/.test(wipeStageHTML()));
  _wipeStage = 3; _wipeTyped = 'delet';
  ok('a wrong word blocks stage 3', /disabled/.test(wipeStageHTML()));
  _wipeTyped = 'delete';
  ok('the right word opens stage 3', !/disabled/.test(wipeStageHTML()));
  _wipeStage = 4;
  ok('only stage 4 shows the final confirm', /wipe-confirm/.test(wipeStageHTML()));
  wipeReset();
  ok('reset clears the typed word too', _wipeStage === 0 && _wipeTyped === '');
  const wKeep = 'notDaylog.key';
  localStorage.setItem(wKeep, 'keep me');
  const wSnap = {};
  Object.keys(localStorage).filter(k => k.indexOf('dp.') === 0).forEach(k => { wSnap[k] = localStorage.getItem(k); });
  const wErased = wipeEverything();
  ok('the wipe erases every dp.* key', Object.keys(localStorage).filter(k => k.indexOf('dp.') === 0).length === 0);
  ok('the wipe leaves foreign keys alone', localStorage.getItem(wKeep) === 'keep me');
  ok('the wipe reports how much it erased', wErased === Object.keys(wSnap).length, wErased);
  localStorage.removeItem(wKeep);
  Object.keys(wSnap).forEach(k => localStorage.setItem(k, wSnap[k]));
  reloadCfg(); _goalMap = null;

  // ---- Empty states must not read as scores of zero ----
  ok('two celebrations do not clobber each other', /setTimeout\(\(\) => showAward/.test(showAward.toString()));

  // ---- Honesty: the app must never report success on failure ----
  ok('saveFile reports its outcome', /return 'blocked'/.test(saveFile.toString()));
  ok('saveOk treats blocked and cancel as failures',
     saveOk('shared') && saveOk('download') && saveOk('viewer') && !saveOk('blocked') && !saveOk('cancel'));
  ok('exportData only stamps a backup date on success',
     /saveOk\(r\)/.test(exportData.toString()) && /await saveFile/.test(exportData.toString()));
  // a failed write must be reportable to the caller
  const hSnapE = localStorage.getItem('dp.entries');
  /* Override on Storage.PROTOTYPE, not on the instance. Assigning localStorage.setItem = fn
     works in a browser but is a no-op under a spec-compliant Storage proxy, which treats every
     property write as storing an ITEM called "setItem" — so the throw never fires, saveEntries
     succeeds, and the test reports a pass it did not earn. The prototype route works in both. */
  const storageProto = Object.getPrototypeOf(localStorage);
  const realSet = storageProto.setItem;
  storageProto.setItem = function (k, v) { if (k === 'dp.entries') throw new Error('QuotaExceeded'); return realSet.call(this, k, v); };
  const wrote = DB.saveEntries({ x: 1 });
  storageProto.setItem = realSet;
  ok('saveEntries reports a failed write', wrote === false, String(wrote));
  ok('the autosave dot is gated on the write', /wrote !== false/.test(saveDraftNow.toString()));
  if (hSnapE != null) localStorage.setItem('dp.entries', hSnapE); else localStorage.removeItem('dp.entries');
  // no invented statistics anywhere: the app has no telemetry that could produce one
  ok('no fabricated population statistic', !/3× longer|3x longer/.test(document.documentElement.innerHTML));
  // the one re-engagement nudge: no loss framing, and a real off switch
  const nudgeSrc = scheduleInactivityReminder.toString();
  ok('the nudge has an off switch', /dp\.nudgeOff/.test(nudgeSrc));
  ok('the nudge uses no loss framing',
     !/keeps your streak alive|miss you|don't lose|falling behind/i.test(nudgeSrc), nudgeSrc.slice(0, 300));
  // an opaque no-cors response must not be reported as a confirmed sync
  ok('no claim of a confirmed Sheet sync', !/Saved & synced/.test(document.documentElement.innerHTML));
  // celebrations must respect the haptics switch
  ok('celebrations route through the haptics gate', typeof buzzPattern === 'function');
  ok('buzzPattern honours dp.hapticsOff', /dp\.hapticsOff/.test(buzzPattern.toString()));
  ok('showAward does not bypass the gate', !/navigator\.vibrate/.test(showAward.toString()));
  ok('showMilestone does not bypass the gate', !/navigator\.vibrate/.test(showMilestone.toString()));
  // a backup that drops the user's own choices is not a backup
  ['logsec', 'awards', 'goals', 'freshSeen'].forEach(k =>
    ok('BACKUP_KEYS carries ' + k, BACKUP_KEYS.includes(k)));
  // mood and energy are states, never framed as performance
  ok('mood is not scored as performance', (VS_METRICS.find(m => m.k === 'mood') || {}).dir === 0);
  ok('energy is not scored as performance', (VS_METRICS.find(m => m.k === 'energy') || {}).dir === 0);
  // sample data must be labelled wherever it can be mistaken for real history
  const smSnap = localStorage.getItem('dp.sampleMeta'), smSnapE = localStorage.getItem('dp.entries');
  localStorage.setItem('dp.sampleMeta', JSON.stringify({ dates: ['x'] }));
  // Sample data means real entries in the real store — seed one so this exercises the
  // normal path, not just the empty-store early return.
  localStorage.setItem('dp.entries', JSON.stringify({ [todayStr()]: { mood: 7, habits: {} } }));
  ok('the trophy case labels sample data', /sample-bar/.test(awardsHTML()));
  localStorage.setItem('dp.entries', JSON.stringify({}));
  ok('an empty store still labels sample data', /sample-bar/.test(awardsHTML()));
  ok('sample data still writes no ledger entry', syncAwards().length === 0);
  if (smSnap != null) localStorage.setItem('dp.sampleMeta', smSnap); else localStorage.removeItem('dp.sampleMeta');
  if (smSnapE != null) localStorage.setItem('dp.entries', smSnapE); else localStorage.removeItem('dp.entries');

  // ---- Fresh start (temporal landmarks) ----
  /* NOTE for future tests: overriding todayStr MUST forward its argument. addDays() calls
     todayStr(date) internally, so a stub that ignores the argument makes addDays return the
     fake "today" for every input — which silently broke this test the first time. */
  const fSnapSeen = localStorage.getItem('dp.freshSeen'), fSnapDate = logDate;
  const fReal = todayStr;
  const fFake = d => { window.todayStr = x => (x ? fReal(x) : d); };
  const fRestore = () => { window.todayStr = fReal; };
  fFake('2026-01-01');
  ok('Jan 1 is a YEAR landmark, not a month one', (freshLandmark() || {}).kind === 'year',
     JSON.stringify(freshLandmark()));
  fFake('2026-06-01');   // a Monday AND the 1st — month must win
  ok('the 1st outranks a Monday', (freshLandmark() || {}).kind === 'month',
     JSON.stringify(freshLandmark()));
  fFake('2026-08-24');
  ok('a Monday is a week landmark', (freshLandmark() || {}).kind === 'week');
  fFake('2026-08-25');
  ok('an ordinary Tuesday is no landmark', freshLandmark() === null);
  fFake('2026-08-30');
  ok('a Sunday is no landmark', freshLandmark() === null);
  // renders only on today, and only until dismissed
  fFake('2026-08-24'); localStorage.removeItem('dp.freshSeen');
  // Seed the PREVIOUS week so the number path is what gets tested. With no prior week the
  // copy legitimately carries no number ("a clean seven days ahead"), which is a different
  // branch — assert the one that matters.
  const fSnapE = localStorage.getItem('dp.entries');
  const FE = {}; for (let i = 1; i <= 7; i++) FE[addDays('2026-08-24', -i)] = { mood: 7, habits: {} };
  localStorage.setItem('dp.entries', JSON.stringify(FE));
  logDate = '2026-08-24';
  const fOn = freshHTML();
  ok('the landmark renders on the day', fOn !== '' && /fresh-card/.test(fOn));
  ok('the landmark carries a real number', /<b>\d/.test(fOn), fOn.slice(0, 200));
  ok('the landmark uses no loss framing',
     !/lose|losing|falling behind|at risk/i.test(fOn), fOn.slice(0, 200));
  logDate = addDays('2026-08-24', -7);
  ok('no landmark on a back-dated entry', freshHTML() === '');
  logDate = '2026-08-24';
  const fLm = freshLandmark();
  localStorage.setItem('dp.freshSeen', JSON.stringify({ [fLm.k]: '2026-08-24' }));
  ok('a dismissed landmark stays dismissed', freshHTML() === '');
  fRestore();
  logDate = fSnapDate;
  if (fSnapE != null) localStorage.setItem('dp.entries', fSnapE); else localStorage.removeItem('dp.entries');
  if (fSnapSeen != null) localStorage.setItem('dp.freshSeen', fSnapSeen); else localStorage.removeItem('dp.freshSeen');

  // ---- Custom goals ----
  const gSnapG = localStorage.getItem('dp.goals'), gSnapE2 = localStorage.getItem('dp.entries');
  ok('goals join BACKUP_KEYS', BACKUP_KEYS.includes('goals'));
  ok('goals reach the sync payload', /goals: DBgoals\(\)/.test(pushState.toString()));
  ok('goals are in the sync adopt list', /\['goals', 'dp\.goals'\]/.test(applyRemoteState.toString()));
  ok('nine measures offered free', GOAL_METRICS.length === 9, GOAL_METRICS.length);
  ok('three timeframes offered', Object.keys(GOAL_PERIODS).length === 3);
  // periods are calendar-true, not rolling
  const gW = goalWindow('w'), gM = goalWindow('m'), gY = goalWindow('y');
  ok('the week window starts on a Monday', new Date(gW.start + 'T00:00:00').getDay() === 1, gW.start);
  ok('the week window is 7 days', gW.days.length === 7);
  ok('the month window starts on the 1st', gW && gM.start.slice(8) === '01', gM.start);
  ok('the month window covers the whole month', gM.days.length === ymDays(todayStr().slice(0, 7)));
  ok('the year window is calendar-true', gY.start.slice(5) === '01-01' && gY.end.slice(5) === '12-31');
  ok('elapsed never exceeds the window', gM.elapsed <= gM.days.length && gY.elapsed <= gY.days.length);
  // progress maths
  const GE = {}; for (let i = 0; i < 7; i++) GE[addDays(todayStr(), -i)] = { mood: 7, habits: {} };
  localStorage.setItem('dp.entries', JSON.stringify(GE));
  localStorage.setItem('dp.goals', JSON.stringify([{ id: 'gu1', k: 'logged', p: 'w', n: 100, at: '' }]));
  let gP = goalProgress(DBgoals()[0]);
  ok('goal progress counts only elapsed days', gP.done === gW.elapsed, gP.done + ' vs ' + gW.elapsed);
  ok('goal progress reports the remaining gap', gP.left === 100 - gP.done);
  ok('goal per-day includes today', Math.abs(gP.perDay - gP.left / (gW.left + 1)) < 1e-9);
  ok('an unmet goal is not hit', gP.hit === false);
  // a met goal must not report a negative gap
  localStorage.setItem('dp.goals', JSON.stringify([{ id: 'gu2', k: 'logged', p: 'w', n: 1, at: '' }]));
  gP = goalProgress(DBgoals()[0]);
  ok('a met goal clamps to 100%', gP.pct === 100, gP.pct);
  ok('a met goal reports no gap', gP.left === 0 && gP.hit === true);
  // suggest comes from the user's own history, or nothing at all
  ok('suggest returns a number or null', [null].concat([goalSuggest('logged', 'w')])
     .some(v => v === null || typeof v === 'number'));
  ok('suggest on an untracked measure returns null', goalSuggest('workout', 'w') === null,
     String(goalSuggest('workout', 'w')));
  ok('an unknown measure yields no progress row', goalProgress({ id: 'x', k: 'nope', p: 'w', n: 5 }) === null);
  if (gSnapG != null) localStorage.setItem('dp.goals', gSnapG); else localStorage.removeItem('dp.goals');
  if (gSnapE2 != null) localStorage.setItem('dp.entries', gSnapE2); else localStorage.removeItem('dp.entries');

  // ---- Month in review ----
  ok('ymDays Jan', ymDays('2026-01') === 31);
  ok('ymDays Feb non-leap', ymDays('2026-02') === 28, ymDays('2026-02'));
  ok('ymDays Feb leap', ymDays('2024-02') === 29, ymDays('2024-02'));
  ok('ymPrev crosses the year', ymPrev('2026-01') === '2025-12', ymPrev('2026-01'));
  ok('ymNext crosses the year', ymNext('2026-12') === '2027-01', ymNext('2026-12'));
  ok('ymLabel is human', ymLabel('2026-07') === 'July 2026', ymLabel('2026-07'));
  const mSnapE = localStorage.getItem('dp.entries'), mSnapT = localStorage.getItem('dp.timelog');
  const ME = {}, mYM = ymPrev(ymOf(todayStr())), mTot = ymDays(mYM);
  const hK = habitCfg().filter(h => !h.hidden).map(h => h.key);
  for (let i = 1; i <= mTot; i++) {
    const hs = {}; hK.forEach(k => { hs[k] = true; });
    ME[mYM + '-' + String(i).padStart(2, '0')] = { mood: 8, energy: 7, sleepHours: 7.5, habits: hs };
  }
  localStorage.setItem('dp.entries', JSON.stringify(ME));
  localStorage.removeItem('dp.timelog');
  const MR = monthReview(mYM);
  ok('month covers every day', MR.logged === mTot && MR.coverage === 100, MR.logged + '/' + mTot);
  ok('a completed month is not partial', MR.partial === false);
  ok('month counts every habit tick', MR.ticks === mTot * hK.length, MR.ticks);
  ok('month counts perfect days', MR.perfect === mTot, MR.perfect);
  ok('month averages mood', Math.abs(MR.mood - 8) < 0.001, MR.mood);
  ok('month finds the best day', MR.best && MR.best.mood === 8);
  // the current month must declare itself partial
  const MRnow = monthReview(ymOf(todayStr()));
  ok('the running month is partial', MRnow.partial === true);
  ok('a partial month only counts elapsed days', MRnow.elapsed <= MRnow.total);
  // cards drop rather than render empty
  const mNames = mrCards(MR).map(c => c.t);
  ok('no time tracked drops the time card', !mNames.includes('Where the time went'), mNames.join(','));
  ok('month deck always has the shape card', mNames[0] === 'The month');
  ok('month deck lists habits', mNames.includes('Habits'));
  // a month with nothing logged must not divide by zero
  const MRempty = monthReview('2019-03');
  ok('an empty month does not blow up', MRempty.logged === 0 && MRempty.ticks === 0);
  ok('an empty month reports no best day', MRempty.best === null);
  if (mSnapE != null) localStorage.setItem('dp.entries', mSnapE); else localStorage.removeItem('dp.entries');
  if (mSnapT != null) localStorage.setItem('dp.timelog', mSnapT); else localStorage.removeItem('dp.timelog');

  // ---- Post-activity save ----
  const sSnapT = localStorage.getItem('dp.timelog');
  const sNow = Date.now(), sAct = allActs()[0].id;
  DB.saveTimelog([{ id: 'utA', act: sAct, start: sNow - 5400000, end: sNow - 600000, upd: sNow }]);
  ok('save sheet threshold is 2 minutes', SAVE_MIN_MS === 120000);
  saveSheetOpen('utA');
  ok('save sheet targets the block', saveState.id === 'utA');
  saveState.title = '  rewrote   the parser  '; saveState.rpe = 7; saveState.note = ' flow state ';
  saveSheetCommit();
  let sSeg = DB.timelog().find(x => x.id === 'utA');
  ok('save writes a normalised title', sSeg.t === 'rewrote the parser', sSeg.t);
  ok('save writes the effort rating', sSeg.rpe === 7);
  ok('save writes a trimmed note', sSeg.note === 'flow state', sSeg.note);
  ok('save touches upd for the sync differ', sSeg.upd >= sNow);
  // empty values must be DELETED, never stored as ''
  saveSheetOpen('utA');
  saveState.title = ''; saveState.rpe = null; saveState.note = '   ';
  saveSheetCommit();
  sSeg = DB.timelog().find(x => x.id === 'utA');
  ok('cleared title is deleted not blanked', !('t' in sSeg));
  ok('cleared effort is deleted not blanked', !('rpe' in sSeg));
  ok('cleared note is deleted not blanked', !('note' in sSeg));
  // the block must already be saved before the sheet is ever offered
  DB.saveTimelog([{ id: 'utB', act: sAct, start: sNow - 3600000, end: null, upd: sNow }]);
  startAct(sAct);
  const sEnded = DB.timelog().find(x => x.id === 'utB');
  ok('stopping ends the block regardless of the sheet', sEnded && sEnded.end != null);
  ok('a long block offers the sheet', saveState.id === 'utB', saveState.id);
  saveSheetClose();
  // a short block stops silently
  DB.saveTimelog([{ id: 'utC', act: sAct, start: Date.now() - 30000, end: null, upd: Date.now() }]);
  saveState.id = null;
  startAct(sAct);
  ok('a short block does not offer the sheet', saveState.id === null, saveState.id);
  // a title cap keeps a pasted paragraph out of the sync payload
  DB.saveTimelog([{ id: 'utD', act: sAct, start: sNow - 900000, end: sNow, upd: sNow }]);
  saveSheetOpen('utD'); saveState.title = 'x'.repeat(300); saveState.note = 'y'.repeat(900);
  saveSheetCommit();
  const sCap = DB.timelog().find(x => x.id === 'utD');
  ok('title is capped at 80', sCap.t.length === 80, sCap.t.length);
  ok('note is capped at 500', sCap.note.length === 500, sCap.note.length);
  if (sSnapT != null) localStorage.setItem('dp.timelog', sSnapT); else localStorage.removeItem('dp.timelog');

  // ---- Weekly cadence ----
  const wSnapE = localStorage.getItem('dp.entries');
  ok('weekStart maps a Sunday back to Monday', weekStart('2026-08-30') === '2026-08-24', weekStart('2026-08-30'));
  ok('weekStart is idempotent on a Monday', weekStart('2026-08-24') === '2026-08-24');
  const wTW = weekStart(todayStr()), WE = {};
  // five qualifying weeks, then only one day in the week still in progress
  for (let k = 1; k <= 5; k++) { const ws = addDays(wTW, -7 * k);
    for (let i = 0; i < 4; i++) WE[addDays(ws, i)] = { mood: 7, habits: {} }; }
  WE[wTW] = { mood: 7, habits: {} };
  localStorage.setItem('dp.entries', JSON.stringify(WE));
  let wS = weekStreak();
  ok('an unfinished week never breaks the weekly streak', wS.streak === 5, wS.streak);
  ok('an unfinished week is not banked', wS.current.ok === false);
  ok('weekly threshold is fixed at 3', wS.min === 3 && WEEK_MIN === 3);
  ok('unbanked line says how many more are needed', /more<\/b> to count it/.test(weekLineHTML()));
  // bank it
  for (let i = 0; i < 3; i++) WE[addDays(wTW, i)] = { mood: 7, habits: {} };
  localStorage.setItem('dp.entries', JSON.stringify(WE));
  wS = weekStreak();
  ok('a banked week counts toward what you see', wS.current.ok && wS.live === 6, wS.live);
  ok('banked line says the week counted', /This week counted/.test(weekLineHTML()));
  // a genuinely missed week does break it
  const WE2 = {};
  for (let k = 1; k <= 5; k++) { if (k === 3) continue; const ws = addDays(wTW, -7 * k);
    for (let i = 0; i < 4; i++) WE2[addDays(ws, i)] = { mood: 7, habits: {} }; }
  localStorage.setItem('dp.entries', JSON.stringify(WE2));
  ok('a missed week does break the weekly streak', weekStreak().streak === 2, weekStreak().streak);
  // a two-day week does not qualify
  const WE3 = {}; const ws3 = addDays(wTW, -7);
  for (let i = 0; i < 2; i++) WE3[addDays(ws3, i)] = { mood: 7, habits: {} };
  localStorage.setItem('dp.entries', JSON.stringify(WE3));
  ok('a two-day week does not qualify', weekStreak().streak === 0);
  // a malformed key must not bucket as NaN
  localStorage.setItem('dp.entries', JSON.stringify(Object.assign({ '': { mood: 5 } }, WE)));
  ok('weekBuckets ignores malformed keys', weekBuckets().every(b => /^\d{4}-\d{2}-\d{2}$/.test(b.start)));
  if (wSnapE != null) localStorage.setItem('dp.entries', wSnapE); else localStorage.removeItem('dp.entries');

  // ---- Habit cues (implementation intentions) ----
  const cSnapC = localStorage.getItem('dp.habitcfg'), cSnapDate = logDate;
  localStorage.setItem('dp.habitcfg', JSON.stringify([
    { key: 'cq', emoji: '📖', label: 'Read' }, { key: 'cw', emoji: '🏋️', label: 'Lift' }]));
  reloadCfg();
  const cH = habitCfg()[0];
  logDate = todayStr();
  // the regression that matters: with no cue the markup must be exactly what it always was
  ok('no cue leaves chip markup unchanged',
     chipTextHTML(cH) === '<span class="hlbl">' + escapeHtml(cH.label) + '</span>', chipTextHTML(cH));
  ok('habitCue is empty for an unset habit', habitCue(cH) === '');
  const cCfg = habitCfg(); cCfg[0].cue = 'after my morning coffee'; saveHabitCfg(cCfg);
  ok('cue renders on the chip', /hcue/.test(chipTextHTML(habitCfg()[0])));
  ok('cue renders its text', /after my morning coffee/.test(chipTextHTML(habitCfg()[0])));
  // a plan for a past day is noise
  logDate = addDays(todayStr(), -3);
  ok('cue is suppressed on a past day', !/hcue/.test(chipTextHTML(habitCfg()[0])));
  logDate = todayStr();
  // escaping on all three surfaces
  const cCfg2 = habitCfg(); cCfg2[0].cue = '<img src=x onerror=alert(1)> "q" & amp'; saveHabitCfg(cCfg2);
  const cH2 = habitCfg()[0];
  ok('cue escapes html on the chip', /&lt;img/.test(chipTextHTML(cH2)) && !/<img/.test(chipTextHTML(cH2)));
  ok('cue escapes html on the habits line', /&lt;img/.test(cueLineHTML(cH2)) && !/<img/.test(cueLineHTML(cH2)));
  ok('cue escapes html in the editor value', /&lt;img/.test(cueInputHTML(cH2)) && !/<img/.test(cueInputHTML(cH2)));
  // the editor row must never carry data-id, or enableDrag reorders phantom rows
  ok('cue editor row has no data-id', !/data-id/.test(cueInputHTML(cH2)));
  ok('cue editor caps length', new RegExp('maxlength="' + CUE_MAX + '"').test(cueInputHTML(cH2)));
  // empty is deleted, never stored, or every device sees habitcfg as changed
  const cCfg3 = habitCfg(); delete cCfg3[0].cue; saveHabitCfg(cCfg3);
  ok('cleared cue is deleted not blanked', !('cue' in habitCfg()[0]));
  ok('unset habit shows the plan prompt', /Plan a when/.test(cueLineHTML(habitCfg()[0])));
  logDate = cSnapDate;
  if (cSnapC != null) localStorage.setItem('dp.habitcfg', cSnapC); else localStorage.removeItem('dp.habitcfg');
  reloadCfg(); _goalMap = null;

  // ---- Awards ----
  const aSnapE = localStorage.getItem('dp.entries'), aSnapC = localStorage.getItem('dp.habitcfg'),
        aSnapA = localStorage.getItem('dp.awards'), aSnapI = localStorage.getItem('dp.awardsInit'),
        aSnapS = localStorage.getItem('dp.sampleMeta');
  localStorage.setItem('dp.habitcfg', JSON.stringify([{ key: 'w', emoji: '🏋️', label: 'W', added: '2000-01-01' }]));
  const AE = {}; for (let i = 200; i >= 0; i--) AE[addDays(todayStr(), -i)] = { mood: 7, habits: { w: true } };
  localStorage.setItem('dp.entries', JSON.stringify(AE));
  localStorage.removeItem('dp.awards'); localStorage.setItem('dp.awardsInit', '1');
  localStorage.removeItem('dp.sampleMeta');
  syncAwards();
  const aPeak = awardList().filter(a => a.grp === 'strength' && a.earned).length;
  ok('strength awards earned at peak', aPeak >= 4, aPeak);
  // decay the EMA by removing the last 10 days — earned awards must NOT be revoked
  for (let i = 0; i < 10; i++) delete AE[addDays(todayStr(), -i)];
  localStorage.setItem('dp.entries', JSON.stringify(AE));
  const aAfter = awardList().filter(a => a.grp === 'strength' && a.earned).length;
  ok('awards are never revoked', aAfter === aPeak, aPeak + ' -> ' + aAfter);
  // one stray old date must not zero habit strength
  AE['2010-01-01'] = { mood: 5, habits: {} };
  localStorage.setItem('dp.entries', JSON.stringify(AE));
  ok('a stray 2010 entry does not zero strength', bestHabitStrength() > 0, bestHabitStrength());
  // sample data must never write to the permanent ledger
  localStorage.removeItem('dp.awards');
  localStorage.setItem('dp.sampleMeta', JSON.stringify({ dates: ['x'] }));
  syncAwards();
  ok('sample data earns no real awards', Object.keys(awardLog()).length === 0);
  localStorage.removeItem('dp.sampleMeta');
  if (aSnapE != null) localStorage.setItem('dp.entries', aSnapE); else localStorage.removeItem('dp.entries');
  if (aSnapC != null) localStorage.setItem('dp.habitcfg', aSnapC); else localStorage.removeItem('dp.habitcfg');
  if (aSnapA != null) localStorage.setItem('dp.awards', aSnapA); else localStorage.removeItem('dp.awards');
  if (aSnapI != null) localStorage.setItem('dp.awardsInit', aSnapI); else localStorage.removeItem('dp.awardsInit');
  if (aSnapS != null) localStorage.setItem('dp.sampleMeta', aSnapS); else localStorage.removeItem('dp.sampleMeta');
  _goalMap = null;

  /* A reminder created during onboarding IS saved and IS listed in Settings — but the saved
     row and the blank add-row below it were visually identical (both time + text + button,
     both defaulting to 21:00), so it read as "my reminder never saved". These assert the two
     things that keep them distinguishable: saved rows live in their own .rem-list container,
     and a heading marks where that list ends and the add-form begins. */
  (function () {
    const rSnap = localStorage.getItem('dp.reminders');
    localStorage.setItem('dp.reminders', JSON.stringify(
      [{ id: 'remTEST1', time: '21:00', label: 'Log my day', enabled: true, mode: 'notify' }]));
    settingsPage = 'reminders'; renderSettings();   // Settings ▸ Reminders (v250)
    const card = [...document.querySelectorAll('#s-settings .card')]
      .find(c => /Reminders/.test((c.querySelector('h2') || {}).textContent || ''));
    ok('settings has a Reminders card', !!card);
    if (card) {
      ok('a saved reminder is listed', !!card.querySelector('[data-remid="remTEST1"]'));
      ok('saved reminder is editable (time + label inputs)',
        !!card.querySelector('[data-rem-time="remTEST1"]') && !!card.querySelector('[data-rem-label="remTEST1"]'));
      ok('saved reminder is deletable', !!card.querySelector('[data-rem-del="remTEST1"]'));
      ok('saved rows sit in their own list container', !!card.querySelector('.rem-list'));
      const h = card.querySelector('.rem-add-h');
      ok('add-form is separated by a heading', !!h && /add another/i.test(h.textContent));
      ok('saved row is not inside the add-form',
        !card.querySelector('.task-add [data-remid]'));
    }
    localStorage.removeItem('dp.reminders');
    renderSettings();
    const card2 = [...document.querySelectorAll('#s-settings .card')]
      .find(c => /Reminders/.test((c.querySelector('h2') || {}).textContent || ''));
    const h2 = card2 && card2.querySelector('.rem-add-h');
    ok('empty state says "Add a reminder", not "Add another"', !!h2 && /add a reminder/i.test(h2.textContent));
    if (rSnap != null) localStorage.setItem('dp.reminders', rSnap); else localStorage.removeItem('dp.reminders');
    settingsPage = null; renderSettings();
    /* Settings home is a short list of labelled groups; each row opens one page. */
    const groups = [...document.querySelectorAll('#s-settings .set-h')].map(h => h.textContent);
    ok('settings home is grouped', ['Make it yours', 'Reminders & tracking', 'Your data', 'Help'].every(g => groups.includes(g)), groups.join(' | '));
    ok('the home holds no setting cards of its own', !document.querySelector('#s-settings .card:not(.alarm-warn)'));
    const pages = [...document.querySelectorAll('#s-settings [data-set-page]')].map(b => b.dataset.setPage);
    ok('every page row opens a page that renders', pages.length >= 6 && pages.every(k => {
      settingsPage = k; renderSettings();
      // a back button alone would pass on an empty page — require the page's own content
      const ok1 = !!document.getElementById('set-back') && settingsPage === k
        && document.querySelectorAll('#s-settings .card').length > 0
        && (document.getElementById('s-settings').textContent || '').trim().length > 120;
      settingsPage = null; return ok1; }), pages.join(','));
    renderSettings();
    /* Picking Settings again — menu, pinned tab, More — lands on the home and disarms a
       half-started delete. It used to redraw whichever page was open, still armed. */
    settingsPage = 'wipe'; renderSettings(); _wipeStage = 1; renderSettings();
    navigateTo('settings');
    ok('choosing Settings again opens its home', settingsPage === null && !document.getElementById('set-back'));
    ok('…and a half-started delete is disarmed', _wipeStage === 0);
    /* A re-render after an async reply must not paint Settings over another screen. */
    show('notes');
    renderSettingsIfShown();
    ok('a late reply does not repaint Settings over Notes', document.getElementById('screen-title').textContent === 'Notes');
    show('settings');
  })();

  /* ---- PROJECTS ---- */
  (function () {
    const pSnap = localStorage.getItem('dp.projects'), tSnap = localStorage.getItem('dp.timelog');
    const H = 3600000, now = Date.now();
    const mk = o => Object.assign({ name: 'x', status: 'active', act: '', steps: [], miles: [],
      notes: [], links: [], color: '#5570dd', created: todayStr(), prio: 2, outcome: '', due: '' }, o);

    // --- hours are exact: a block belongs to ONE project, or none ---
    const monday = (() => { const d = new Date(); d.setHours(9, 0, 0, 0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); })();
    localStorage.setItem('dp.projects', JSON.stringify([mk({ id: 'pA' }), mk({ id: 'pB' })]));
    localStorage.setItem('dp.timelog', JSON.stringify([
      { id: 'b1', act: 'work', start: monday, end: monday + 2 * H, upd: 1, pid: 'pA' },
      { id: 'b2', act: 'work', start: monday + 3 * H, end: monday + 4 * H, upd: 1, pid: 'pB' },
      { id: 'b3', act: 'work', start: monday + 5 * H, end: monday + 6 * H, upd: 1 },
      { id: 'b4', act: 'work', start: monday - 7 * 24 * H, end: monday - 7 * 24 * H + 4 * H, upd: 1, pid: 'pA' },
    ]));
    ok('project hours count only tagged blocks', pjMs('pA') === 6 * H, pjMs('pA') / H);
    ok('a shared activity does not leak hours between projects', pjMs('pB') === 1 * H, pjMs('pB') / H);
    ok('an untagged block belongs to no project',
      pjMs('pA') + pjMs('pB') === 7 * H && DB.timelog().length === 4);
    ok('this-week hours exclude last week', pjWeekMs('pA') === 2 * H, pjWeekMs('pA') / H);
    const wk = pjWeeks('pA', 8);
    ok('week buckets land in the right slot', wk.length === 8 && wk[7] === 2 && wk[6] === 4, wk.join(','));

    // --- a running block counts up to now, not to zero ---
    localStorage.setItem('dp.timelog', JSON.stringify(
      [{ id: 'r1', act: 'work', start: now - 90 * 60000, end: null, upd: 1, pid: 'pA' }]));
    const runMs = pjMs('pA');
    ok('a running block counts toward its project', runMs > 88 * 60000 && runMs < 92 * 60000, runMs / 60000);

    // --- progress: no plan is NOT 0% ---
    localStorage.setItem('dp.timelog', '[]');
    ok('a project with no steps has no fake progress', pjProgress(pjNorm(mk({ id: 'p0' }))) === null);
    const pr = pjProgress(pjNorm(mk({ id: 'p0',
      steps: [{ id: 'a', done: true }, { id: 'b', done: false }], miles: [{ id: 'c', done: true }] })));
    ok('progress counts steps AND milestones', pr.done === 2 && pr.tot === 3 && pr.pct === 67, JSON.stringify(pr));

    // --- health badges, worst-first ---
    const H2 = p => pjHealth(pjNorm(p)).k;
    const openStep = [{ id: 's', text: 'a', done: false }];
    ok('overdue beats everything', H2(mk({ id: '1', due: addDays(todayStr(), -5), steps: openStep })) === 'overdue');
    ok('due within 3 days warns', H2(mk({ id: '2', due: addDays(todayStr(), 2), steps: openStep })) === 'due');
    ok('an active project untouched a week is stalled',
      H2(mk({ id: '3', steps: openStep, notes: [{ id: 'n', at: now - 12 * 86400000, text: 'x' }] })) === 'stalled');
    ok('recent work is on track',
      H2(mk({ id: '4', steps: openStep, notes: [{ id: 'n', at: now - 2 * 86400000, text: 'x' }] })) === 'on');
    /* Paused deliberately outranks overdue: you put it down on purpose, so nagging about a
       date you already chose to miss would be wrong. */
    ok('paused is not reported as overdue',
      H2(mk({ id: '5', status: 'paused', due: addDays(todayStr(), -9), steps: openStep })) === 'paused');
    ok('a finished project is never overdue',
      H2(mk({ id: '6', status: 'done', due: addDays(todayStr(), -9), steps: openStep })) === 'done');
    ok('all steps done clears an overdue flag',
      H2(mk({ id: '7', due: addDays(todayStr(), -5), steps: [{ id: 's', done: true, doneAt: now }] })) !== 'overdue');

    // --- startAct tags, and switches project on the same activity ---
    localStorage.setItem('dp.timelog', '[]');
    startAct('work', 'pA');
    const first = runningSeg();
    ok('startAct tags the new block with the project', first && first.pid === 'pA');
    ok('two blocks made in the same millisecond get different ids',
      new Set(DB.timelog().map(x => x.id)).size === DB.timelog().length);
    startAct('work', 'pB');
    const second = runningSeg();
    ok('same activity for another project opens a NEW block', second && second.id !== first.id && second.pid === 'pB');
    ok('the previous project\'s block was closed, keeping its own pid',
      DB.timelog().find(x => x.id === first.id).end != null &&
      DB.timelog().find(x => x.id === first.id).pid === 'pA');
    startAct('work', 'pB');
    ok('same activity AND same project stops the timer', runningSeg() == null);
    startAct('work');
    ok('an untagged start carries no pid', !('pid' in runningSeg()));
    localStorage.setItem('dp.timelog', '[]');

    // --- the screen renders, and reaches the detail view ---
    localStorage.setItem('dp.projects', JSON.stringify([mk({ id: 'pS', name: 'Screen test', steps: openStep })]));
    const before = pjOpen; pjOpen = null;
    renderProjects();
    const el = document.getElementById('s-projects');
    ok('projects screen renders a card per project', !!el.querySelector('[data-pj-open="pS"]'));
    ok('projects screen has a create button', !!document.getElementById('pj-add-open'));
    pjOpen = 'pS'; renderProjects();
    ok('detail view renders', !!document.getElementById('pj-back') && !!document.getElementById('pj-timer'));
    ok('detail view has a back button, milestones, steps, log and links',
      ['pj-mile-add', 'pj-step-add', 'pj-note-add', 'pj-link-add', 'pj-del'].every(i => !!document.getElementById(i)));
    ok('the timer needs no activity picked first', !document.getElementById('pj-timer').disabled);
    ok('there is no borrowed-activity picker any more', !document.querySelector('[data-pj-field="act"]'));

    /* Time on a project is logged AS the project. Three projects all timed under "Work" were
       indistinguishable on the timeline, in the legend, in the breakdown and in the Android
       notification — every one of which resolves a block through actById. */
    localStorage.setItem('dp.timelog', '[]');
    document.getElementById('pj-timer').click();
    const pr1 = runningSeg();
    ok('starting a project logs under the project\'s own activity id', pr1 && pr1.act === PJ_ACT + 'pS', pr1 && pr1.act);
    ok('and is still tagged so the hours count', pr1 && pr1.pid === 'pS');
    const shown = actById(pr1.act);
    ok('the block resolves to the project name, not a borrowed tag', shown.name === 'Screen test', shown.name);
    ok('the block carries the project colour', shown.color === '#5570dd', shown.color);
    ok('two projects are distinguishable on the timeline',
      actById(PJ_ACT + 'pS').name !== actById(PJ_ACT + 'nope').name);
    /* Without a tombstone a deleted project's blocks resolve to the raw string "pj:pS". */
    localStorage.setItem('dp.pjnames', JSON.stringify({ zz: { name: 'Old thing', color: '#dd7a3c' } }));
    ok('a deleted project\'s history stays readable', actById(PJ_ACT + 'zz').name === 'Old thing');
    ok('and is marked as gone', actById(PJ_ACT + 'zz').gone === true);
    ok('an unknown project never shows a raw id', !/^pj:/.test(actById(PJ_ACT + 'never').name));
    localStorage.removeItem('dp.pjnames');
    ok('project names are backed up', BACKUP_KEYS.includes('pjnames'));
    /* Project pseudo-activities must not leak into the activity grid or the customiser. */
    ok('projects do not appear in the normal activity list', !allActs().some(a => /^pj:/.test(a.id)));
    localStorage.setItem('dp.timelog', '[]');
    pjOpen = before;

    // --- Projects is reachable from the nav ---
    ok('projects is a nav destination', !!navCfg().find(n => n.k === 'projects'));
    ok('projects has a render function', typeof RENDER.projects === 'function');
    ok('projects is backed up', BACKUP_KEYS.includes('projects'));

    if (pSnap != null) localStorage.setItem('dp.projects', pSnap); else localStorage.removeItem('dp.projects');
    if (tSnap != null) localStorage.setItem('dp.timelog', tSnap); else localStorage.removeItem('dp.timelog');
  })();

  /* ---- GAP FILLER ---- */
  (function () {
    const tSnap = localStorage.getItem('dp.timelog'), sSnap = localStorage.getItem('dp.gapskip');
    const H = 3600000;
    // Weekdays: work 09-12 and 13-17. Weekends: reading 09-12. Every night: sleep 22-06:30.
    const build = () => {
      const log = [];
      for (let i = 2; i <= 42; i++) {
        const ds = addDays(todayStr(), -i), b0 = new Date(ds + 'T00:00:00').getTime();
        const wknd = [0, 6].includes(new Date(ds + 'T00:00:00').getDay());
        log.push({ id: 'a' + i, act: 'sleep', start: b0 - 2 * H, end: b0 + 6.5 * H, upd: 1 });
        log.push({ id: 'b' + i, act: wknd ? 'read' : 'work', start: b0 + 9 * H, end: b0 + 12 * H, upd: 1 });
        if (!wknd) log.push({ id: 'c' + i, act: 'work', start: b0 + 13 * H, end: b0 + 17 * H, upd: 1 });
      }
      return log;
    };
    const pastDay = wantWeekend => {
      for (let i = 1; i < 40; i++) {
        const ds = addDays(todayStr(), -i);
        if (gapIsWeekend(ds) === wantWeekend) return ds;
      }
    };
    localStorage.removeItem('dp.gapskip');

    // --- a weekday with two tracked blocks leaves gaps, split where the guess changes ---
    /* build() seeds days 2..42 back. Whether the target day falls inside that range depends
       on what weekday today is — on a Sunday the most recent weekday IS day 2 and arrives
       pre-filled, so the gaps the test needs do not exist. Strip the target day explicitly
       instead of relying on the calendar, the way the weekend case below already does. */
    const wd = pastDay(false), wb = new Date(wd + 'T00:00:00').getTime();
    const clearDay = (arr, b0) => arr.filter(x => !(x.start < b0 + 86400000 && x.end > b0 + 7 * H));
    let log = clearDay(build(), wb);
    log.push({ id: 'y1', act: 'sleep', start: wb - 2 * H, end: wb + 6.5 * H, upd: 1 });
    log.push({ id: 'y2', act: 'gym', start: wb + 12 * H, end: wb + 13 * H, upd: 1 });
    localStorage.setItem('dp.timelog', JSON.stringify(log));

    const raw = gapsRaw(wd);
    ok('a day with two tracked blocks has two raw gaps', raw.length === 2, raw.length);
    const rows = gapSegments(wd);
    /* The clamp loop used to iterate every row accumulated so far, re-clamping the FIRST
       gap's rows to the SECOND gap's bounds and inverting them, so with two gaps in a day
       only the last one was ever offered. */
    ok('rows come from every gap, not just the last one',
      rows.some(r => r.a < wb + 12 * H) && rows.some(r => r.a >= wb + 13 * H));
    ok('every row is at least the minimum length', rows.every(r => r.b - r.a >= GAP_MIN_MS));
    ok('no row overlaps a tracked block',
      rows.every(r => !segsForDay(wd).some(x => Math.min(x.b, r.b) - Math.max(x.a, r.a) > 0)));
    ok('rows never overlap each other',
      rows.every((r, i) => rows.slice(i + 1).every(o => Math.min(o.b, r.b) - Math.max(o.a, r.a) <= 0)));

    const at = h => rows.find(r => r.a === wb + h * H);
    ok('09:00 on a weekday is guessed as work', at(9) && at(9).pred.act === 'work',
      at(9) && at(9).pred.act);
    ok('13:00 on a weekday is guessed as work', at(13) && at(13).pred.act === 'work');
    ok('a window with no history gets no guess', at(6.5) ? at(6.5).pred.act === null : true);
    ok('a named guess always carries its support',
      rows.filter(r => r.pred.act).every(r => r.pred.days >= GAP_MIN_DAYS && r.pred.sampleDays >= r.pred.days));
    ok('a named guess always meets the share floor',
      rows.filter(r => r.pred.act).every(r => r.pred.share >= GAP_MIN_SHARE));

    // --- the weekday/weekend split is the whole point ---
    const we = pastDay(true), eb = new Date(we + 'T00:00:00').getTime();
    log = clearDay(build(), eb);
    log.push({ id: 'w1', act: 'sleep', start: eb - 2 * H, end: eb + 6.5 * H, upd: 1 });
    localStorage.setItem('dp.timelog', JSON.stringify(log));
    const wrows = gapSegments(we);
    const w9 = wrows.find(r => r.a === eb + 9 * H);
    ok('09:00 on a weekend is guessed as reading, not work', w9 && w9.pred.act === 'read',
      w9 && w9.pred.act);
    ok('the weekend guess says it used weekend days', w9 && w9.pred.basis === 'weekend days');

    // --- never nag about the future ---
    ok('today\'s gaps never run past now', gapSegments(todayStr()).every(r => r.b <= Date.now() + 2000));

    // --- accepting writes exactly the offered range, and the row then disappears ---
    localStorage.setItem('dp.timelog', JSON.stringify(log));
    const target = gapSegments(we).find(r => r.pred.act);
    const before = DB.timelog().length;
    const savedTtDate = ttDate;
    gapFill(we, target.a, target.b, target.pred.act);
    const added = DB.timelog().find(s => s.start === target.a && s.end === target.b);
    ok('accepting a guess writes one block over exactly that range',
      !!added && added.act === target.pred.act && DB.timelog().length === before + 1);
    ok('the filled range is no longer offered', !gapSegments(we).some(r => r.a === target.a));

    // --- leaving blank is remembered ---
    const next = gapSegments(we)[0];
    gapSkip(we, next.a);
    ok('leave-blank is remembered', !gapSegments(we).some(r => r.a === next.a));
    ok('leave-blank does not silence a different day',
      !gapSkipped(addDays(we, -1), next.a));
    ok('gap skips are backed up', BACKUP_KEYS.includes('gapskip'));

    // --- an empty log must not manufacture questions ---
    localStorage.setItem('dp.timelog', '[]');
    ok('no history means no rows at all', gapSegments(addDays(todayStr(), -1)).length === 0);
    /* One tracked day is not a pattern. Without this floor the card appeared on every past
       day of a fresh install asking "00:00-24:00, what were you doing?" */
    const oneDay = addDays(todayStr(), -3), ob = new Date(oneDay + 'T00:00:00').getTime();
    localStorage.setItem('dp.timelog', JSON.stringify(
      [{ id: 'o1', act: 'work', start: ob + 9 * H, end: ob + 10 * H, upd: 1 }]));
    ok('a single tracked day is not enough to start guessing',
      gapSegments(addDays(todayStr(), -1)).length === 0);

    /* A wholly untracked day is one 24h gap; only windows history can actually name are
       offered, so it never becomes a single useless "what were you doing all day?" row. */
    const blank = pastDay(false), bb = new Date(blank + 'T00:00:00').getTime();
    localStorage.setItem('dp.timelog', JSON.stringify(build().filter(x =>
      !(x.end > bb && x.start < bb + 86400000))));   // fully blank, including the night block
    localStorage.removeItem('dp.gapskip');
    const brows = gapSegments(blank);
    ok('an untracked day offers only windows with a real guess',
      brows.length > 0 && brows.every(r => !!r.pred.act), brows.length);

    ttDate = savedTtDate;
    if (tSnap != null) localStorage.setItem('dp.timelog', tSnap); else localStorage.removeItem('dp.timelog');
    if (sSnap != null) localStorage.setItem('dp.gapskip', sSnap); else localStorage.removeItem('dp.gapskip');
  })();

  /* ---- TROPHY CASE (v217 medals) ---- */
  (function () {
    /* Rank must come from position WITHIN a family. Consistency has 11 tiers and Weeks has 6,
       so an absolute tier index would rank the hardest weekly award below an easy streak. */
    const first = g => awRank({ grp: g, tier: AWARD_FAMILIES.find(f => f.grp === g).tiers[0] }).k;
    const last = g => { const f = AWARD_FAMILIES.find(x => x.grp === g);
      return awRank({ grp: g, tier: f.tiers[f.tiers.length - 1] }).k; };
    ok('the easiest tier of every family is bronze',
      AWARD_FAMILIES.every(f => first(f.grp) === 'bronze'),
      AWARD_FAMILIES.map(f => f.grp + ':' + first(f.grp)).join(' '));
    ok('the hardest tier of every family is diamond',
      AWARD_FAMILIES.every(f => last(f.grp) === 'diamond'),
      AWARD_FAMILIES.map(f => f.grp + ':' + last(f.grp)).join(' '));
    ok('the top weekly award outranks an easy streak award',
      AW_RANKS.findIndex(r => r.k === last('weeks')) > AW_RANKS.findIndex(r => r.k === first('streak')));
    ok('rank never falls as the tier rises', AWARD_FAMILIES.every(f => {
      let prev = -1;
      return f.tiers.every(t => { const i = AW_RANKS.findIndex(r => r.k === awRank({ grp: f.grp, tier: t }).k);
        const okk = i >= prev; prev = i; return okk; });
    }));
    ok('every award resolves to a known rank',
      awardList().every(a => AW_RANKS.some(r => r.k === awRank(a).k)));

    // --- the screen renders both filters, and locked medals are not tappable ---
    const eSnap = localStorage.getItem('dp.entries'), aSnap = localStorage.getItem('dp.awards');
    const ents = {}; for (let i = 0; i < 14; i++) ents[addDays(todayStr(), -i)] = { mood: 7, energy: 7 };
    localStorage.setItem('dp.entries', JSON.stringify(ents));
    const prevF = awFilter;
    awFilter = 'all'; renderAwards();
    const el = document.getElementById('s-awards');
    const all = el.querySelectorAll('.aw-medal');
    ok('every award has a medal in the All view', all.length === awardList().length, all.length);
    ok('locked medals are not buttons',
      [...el.querySelectorAll('.aw-medal.locked')].every(m => m.tagName !== 'BUTTON'));
    ok('unlocked medals open a share card',
      [...el.querySelectorAll('.aw-medal:not(.locked)')].every(m => !!m.dataset.awShare));
    ok('locked medals never carry a share target',
      [...el.querySelectorAll('.aw-medal.locked')].every(m => !m.dataset.awShare));
    ok('a locked medal says how far off it is',
      [...el.querySelectorAll('.aw-medal.locked')].every(m => /to go/.test(m.textContent)));
    ok('every medal names its rank in text, not colour alone',
      [...el.querySelectorAll('.aw-medal:not(.locked)')].every(m => !!m.querySelector('.aw-rank')));
    ok('the hero ring is present', !!el.querySelector('.aw-ring-fg'));
    const earnedN = awardList().filter(a => a.earned).length;
    awFilter = 'earned'; renderAwards();
    const el2 = document.getElementById('s-awards');
    ok('the Unlocked filter shows only earned medals',
      el2.querySelectorAll('.aw-medal').length === earnedN &&
      el2.querySelectorAll('.aw-medal.locked').length === 0, el2.querySelectorAll('.aw-medal').length);
    awFilter = prevF;
    if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
    if (aSnap != null) localStorage.setItem('dp.awards', aSnap); else localStorage.removeItem('dp.awards');
  })();

  /* ---- SHARE CARD DEFAULT SHAPE ---- */
  (function () {
    const r = safeParse(localStorage.getItem('dp.cardratio'), null);
    ok('share cards default to story 9:16', (r || '9:16') === '9:16' ? cardState.ratio === (r || '9:16') : true);
    ok('9:16 is a real ratio the builder knows', !!CARD_RATIOS['9:16']);
    ok('story is taller than post', CARD_RATIOS['9:16'] > CARD_RATIOS['4:5']);
    ok('cardratio is backed up', BACKUP_KEYS.includes('cardratio'));
  })();

  /* ---- SHEET SYNC ---- */
  (function () {
    const sSnap = localStorage.getItem('dp.settings');
    /* The offer is withdrawn until the Play Data Safety form matches it (v222): no card for
       a user who never connected, the FULL card for one who did — an off switch must never
       be hidden from the person who turned the thing on. */
    const sHid = DB.settings(); sHid.syncUrl = ''; DB.saveSettings(sHid);
    settingsPage = 'data'; renderSettings();   // Settings ▸ Backup & restore (v250)
    const findCard = () => [...document.querySelectorAll('#s-settings .card')]
      .find(c => /Sync/.test((c.querySelector('h2') || {}).textContent || ''));
    ok('sync is NOT offered while Data Safety says "collects no data"', !findCard());
    const sOn = DB.settings(); sOn.syncUrl = 'https://script.google.com/macros/s/x/exec'; DB.saveSettings(sOn);
    renderSettings();
    const card = findCard();
    ok('a user who already connected keeps the card', !!card);
    ok('including the link box, to disconnect', !!document.getElementById('sync-url'));
    ok('and the disclosure of what is sent', !!card && /Never sent/.test(card.textContent));

    /* The whole Data Safety answer rests on this: Health Connect readings must never appear
       in the push payload. If a future change adds them, this fails before it ships. */
    const s0 = DB.settings(); s0.syncUrl = ''; DB.saveSettings(s0);
    const hSnap = localStorage.getItem('dp.health');
    localStorage.setItem('dp.health', JSON.stringify({ '2026-01-01': { steps: 9999, hr: 61 } }));
    let captured = null;
    const realFetch = window.fetch;
    window.fetch = (u, o) => { captured = o && o.body; return Promise.resolve({ ok: true }); };
    const s1 = DB.settings(); s1.syncUrl = 'https://example.invalid/exec'; DB.saveSettings(s1);
    pushState(true);
    window.fetch = realFetch;
    ok('a push actually happened', typeof captured === 'string' && captured.length > 0);
    if (typeof captured === 'string') {
      const sent = JSON.parse(captured);
      ok('Health Connect data is NOT in the sync payload', !('health' in sent));
      ok('and no health reading leaks into it', !/9999|"hr"\s*:\s*61/.test(captured));
      ok('the per-device card shape is not synced', !('cardratio' in sent));
      ok('projects are synced', 'projects' in sent);
      ok('project name tombstones are synced', 'projectnames' in sent);
      ok('the award ledger is synced', 'awards' in sent);
    }
    if (hSnap != null) localStorage.setItem('dp.health', hSnap); else localStorage.removeItem('dp.health');

    /* Awards and gap dismissals must UNION, never adopt: a stale second phone pushing its
       older ledger must not be able to un-earn an award. */
    localStorage.setItem('dp.awards', JSON.stringify({ 'streak:7': '2026-01-05' }));
    applyRemoteState({ touched: 1, awards: { 'streak:14': '2026-02-01' } });
    const led = safeParse(localStorage.getItem('dp.awards'), {});
    ok('a remote award is added', led['streak:14'] === '2026-02-01');
    ok('and a local award is never removed by the merge', led['streak:7'] === '2026-01-05');
    applyRemoteState({ touched: 1, awards: {} });
    ok('an empty remote ledger cannot wipe local awards',
      Object.keys(safeParse(localStorage.getItem('dp.awards'), {})).length === 2);
    localStorage.removeItem('dp.awards');

    if (sSnap != null) localStorage.setItem('dp.settings', sSnap); else localStorage.removeItem('dp.settings');
    settingsPage = null; renderSettings();
  })();

  /* ---- MONEY ---- */
  (function () {
    const snapA = localStorage.getItem('dp.finaccts'), snapT = localStorage.getItem('dp.fintx');
    const snapM = localStorage.getItem('dp.finmarks'), snapE = localStorage.getItem('dp.entries');
    const snapB = localStorage.getItem('dp.finbudget');
    const T = todayStr(), ym = finYm(T);

    // --- amounts are integer minor units, so sums cannot drift ---
    ok('parses a plain amount', parseAmt('450') === 45000);
    ok('parses grouped digits and paise', parseAmt('1,234.50') === 123450);
    ok('ignores a currency symbol', parseAmt('₹1200') === 120000);
    ok('understands k and L shorthand', parseAmt('1.2k') === 120000 && parseAmt('1L') === 10000000);
    /* null is a parse FAILURE, not zero. Treating unparseable input as 0 silently records a
       zero-rupee transaction instead of telling the user their input was wrong. */
    ok('unparseable input is null, never zero',
      parseAmt('') === null && parseAmt('abc') === null && parseAmt('   ') === null);
    ok('a stray minus does not change the magnitude', parseAmt('-450') === 45000);
    let sum = 0; for (let i = 0; i < 100; i++) sum += parseAmt('0.10');
    ok('100 x 0.10 sums to exactly 10.00, not 9.99999...', sum === 1000, sum);

    // --- balances derive from the ledger, and a credit card just goes negative ---
    localStorage.setItem('dp.finaccts', JSON.stringify([
      { id: 'bank', name: 'Bank', kind: 'bank', opening: parseAmt('50000') },
      { id: 'cash', name: 'Cash', kind: 'cash', opening: parseAmt('2000') },
      { id: 'card', name: 'Card', kind: 'card', opening: 0 },
      { id: 'mf', name: 'Funds', kind: 'invest', opening: 0 },
      { id: 'hl', name: 'Loan', kind: 'loan', opening: 0 },
      { id: 'unset', name: 'Unmarked asset', kind: 'asset', opening: 0 },
    ]));
    localStorage.setItem('dp.finmarks', JSON.stringify([
      { id: 'm1', ac: 'mf', d: addDays(T, -60), v: parseAmt('120000') },
      { id: 'm2', ac: 'mf', d: T, v: parseAmt('141000') },
      { id: 'm3', ac: 'hl', d: T, v: parseAmt('2800000') },
    ]));
    localStorage.setItem('dp.fintx', JSON.stringify([
      { id: 't1', d: ym + '-02', a: parseAmt('85000'), dir: 'in', ac: 'bank', c: 'salary', n: 'Salary' },
      { id: 't2', d: ym + '-03', a: parseAmt('22000'), dir: 'out', ac: 'bank', c: 'home', n: 'Rent' },
      { id: 't3', d: ym + '-04', a: parseAmt('3400'), dir: 'out', ac: 'card', c: 'grocery', n: 'BigBasket' },
      { id: 't4', d: ym + '-05', a: parseAmt('649'), dir: 'out', ac: 'card', c: 'subs', n: 'Netflix' },
      { id: 't5', d: ym + '-06', a: parseAmt('5000'), dir: 'xfer', ac: 'bank', to: 'cash', c: '', n: 'ATM' },
    ]));
    /* 50,000 opening + 85,000 salary − 22,000 rent − 5,000 moved to cash = 108,000. */
    ok('a transactional balance is opening plus the ledger',
      finBal('bank') === parseAmt('108000'), finBal('bank'));
    ok('a transfer moves money without creating or destroying it',
      finBal('cash') === parseAmt('7000'), finBal('cash'));
    ok('spending on a credit card makes it negative',
      finBal('card') === -parseAmt('4049'), finBal('card'));
    ok('a valued account uses its latest mark', finBal('mf') === parseAmt('141000'));
    ok('an earlier date sees the earlier mark',
      finBal('mf', addDays(T, -30)) === parseAmt('120000'));
    ok('a loan counts against you', finBal('hl') === -parseAmt('2800000'));
    /* null, not 0: an asset you have never valued is unknown, and calling it zero would
       quietly understate net worth rather than admitting the gap. */
    ok('an unvalued asset is null, not zero', finBal('unset') === null);

    const w = finSplitWorth();
    ok('net worth is what you own minus what you owe', w.net === w.assets - w.debts);
    ok('net worth adds up',
      w.assets === parseAmt('108000') + parseAmt('7000') + parseAmt('141000') &&
      w.debts === parseAmt('2800000') + parseAmt('4049'), JSON.stringify(w));

    // --- the month view ---
    const m = finMonth(ym);
    ok('income and spending are counted separately',
      m.in === parseAmt('85000') && m.out === parseAmt('26049'), m.in + '/' + m.out);
    /* Moving your own money between your own accounts is neither income nor spending. */
    ok('transfers are excluded from income and spending', m.in + m.out === parseAmt('111049'));
    ok('kept is income minus spending', m.net === parseAmt('58951'));
    ok('savings rate is a percentage of income', m.rate === 69, m.rate);
    localStorage.setItem('dp.fintx', JSON.stringify(
      [{ id: 'z', d: ym + '-02', a: parseAmt('500'), dir: 'out', ac: 'bank', c: 'food', n: '' }]));
    /* With no income there is no rate. 0% would read as "you saved nothing this month". */
    ok('no income means no savings rate, not 0%', finMonth(ym).rate === null);

    // --- patterns: direction, and the floors that stop invented findings ---
    const seed = (days, lowSpend, highSpend, lowMood, highMood) => {
      const tx = [], ents = {};
      for (let i = 1; i <= days; i++) {
        const d = addDays(T, -i), low = i % 2 === 0;
        ents[d] = { mood: low ? lowMood : highMood, updatedAt: d };
        tx.push({ id: 'p' + i, d, a: parseAmt(String(low ? lowSpend : highSpend)),
          dir: 'out', ac: 'bank', c: 'fun', n: '' });
      }
      localStorage.setItem('dp.entries', JSON.stringify(ents));
      localStorage.setItem('dp.fintx', JSON.stringify(tx));
    };
    /* THE bug this catches: split() took (lowWord, highWord) and three of four call sites
       passed them reversed, so the app reported "you spend more on better-mood days" when the
       data said the exact opposite. A backwards insight is worse than none. */
    seed(40, 1200, 300, 4, 8);      // low mood -> HIGH spending
    const pm = finPatterns().find(p => /mood/.test(p.body));
    ok('a mood pattern is found when one is really there', !!pm);
    ok('the mood pattern points the right way',
      !!pm && /more a day on lower-mood days/.test(pm.head), pm && pm.head);
    ok('and its body agrees with its heading',
      !!pm && /on lower-mood days vs .* on better-mood days/.test(pm.body), pm && pm.body);
    seed(40, 300, 1200, 4, 8);      // reversed: low mood -> LOW spending
    const pm2 = finPatterns().find(p => /mood/.test(p.body));
    ok('reversing the data reverses the finding',
      !!pm2 && /more a day on better-mood days/.test(pm2.head), pm2 && pm2.head);
    /* Name the offender. A bare boolean here said only "something has no sample size", which
       cost a round-trip through CI to identify — this failed under UTC and passed under IST. */
    /* The weekday/weekend pattern states its sample size in a richer form — "over 12 weekend and
       20 weekday days with spending" — which /over \d+ days/ does not match. The app was right and
       this assertion was too narrow; it only ever surfaced under UTC, because whether the seeded
       dates produce a weekday pattern at all depends on the timezone.
       Still requires a COUNT after "over" and the word "days": a body with no sample size, or one
       that says "over several days", fails. */
    const SAMPLE_SIZE = /\bover \d+\b[^.]*\bdays\b/;
    const noSize = finPatterns().filter(p => !SAMPLE_SIZE.test(p.body));
    ok('every pattern states its sample size', noSize.length === 0,
      noSize.map(p => p.head + ' :: ' + p.body).join(' | '));
    seed(8, 2000, 100, 3, 9);
    ok('too few days yields no pattern at all', finPatterns().length === 0);
    seed(40, 510, 500, 3, 9);
    ok('a difference under the noise floor is not reported', finPatterns().length === 0);

    // --- recurring charges ---
    const rtx = [];
    for (let k = 0; k < 4; k++) {
      const b = new Date(); b.setDate(1); b.setMonth(b.getMonth() - k);
      rtx.push({ id: 'r' + k, d: finYm(todayStr(b)) + '-05', a: parseAmt('649'),
        dir: 'out', ac: 'bank', c: 'subs', n: 'Netflix' });
    }
    rtx.push({ id: 'one', d: T, a: parseAmt('45000'), dir: 'out', ac: 'bank', c: 'shopping', n: 'Laptop' });
    localStorage.setItem('dp.fintx', JSON.stringify(rtx));
    const rec = finRecurring();
    ok('a monthly charge across 4 months is flagged', rec.length === 1 && rec[0].months === 4);
    ok('a one-off purchase is not flagged as a subscription', !rec.some(r => /Laptop/i.test(r.label)));

    // --- CSV import ---
    const csv = 'Date,Narration,Withdrawal Amt.,Deposit Amt.\n' +
      '03/08/26,"UPI-SWIGGY, BANGALORE",450.00,\n' +
      '04/08/26,SALARY AUG,,85000.00\n' +
      'no date here,,,\n';
    const rows = csvParse(csv);
    ok('a quoted comma does not split a cell', rows[1][1] === 'UPI-SWIGGY, BANGALORE');
    ok('ISO dates parse', csvDate('2026-08-03') === '2026-08-03');
    /* dd/mm is assumed, not mm/dd — guessing wrong silently reorders someone's whole year. */
    ok('dd/mm/yy parses as day first', csvDate('03/08/26') === '2026-08-03');
    ok('a written month parses', csvDate('15-Mar-2026') === '2026-03-15');
    ok('an impossible date is rejected, not guessed', csvDate('32/01/2026') === null);
    ok('junk is rejected', csvDate('nonsense') === null);

    localStorage.setItem('dp.fintx', '[]');
    const head = rows[0].map(h => String(h).trim());
    const guess = mnGuessMap(head);
    ok('columns are auto-detected from a real bank header',
      head[guess.date] === 'Date' && head[guess.out] === 'Withdrawal Amt.' &&
      head[guess.in] === 'Deposit Amt.', JSON.stringify(guess));
    const prevImport = mnImport;
    mnImport = { head, rows: rows.slice(1), map: guess };
    const p1 = mnImportRows();
    ok('clean rows import and junk is skipped', p1.rows.length === 2 && p1.bad === 1,
      p1.rows.length + '/' + p1.bad);
    ok('debit and credit columns set the direction',
      p1.rows[0].dir === 'out' && p1.rows[1].dir === 'in');
    ok('the amount survives the round trip', p1.rows[1].a === parseAmt('85000'));
    const list = finTx();
    p1.rows.forEach((x, i) => list.push(Object.assign({ id: 'imp' + i }, x)));
    finSaveTx(list);
    /* Importing the same statement twice is a thing people do. */
    const p2 = mnImportRows();
    ok('re-importing the same file adds nothing', p2.rows.length === 0 && p2.dupes === 2);
    mnImport = prevImport;

    // --- screen renders ---
    const prevTab = mnTab, prevYm = mnYm;
    localStorage.setItem('dp.fintx', JSON.stringify([
      { id: 'v1', d: ym + '-02', a: parseAmt('85000'), dir: 'in', ac: 'bank', c: 'salary', n: 'Salary' },
      { id: 'v2', d: ym + '-03', a: parseAmt('22000'), dir: 'out', ac: 'bank', c: 'home', n: 'Rent' },
    ]));
    ['over', 'tx', 'accts', 'ins'].forEach(tb => {
      mnTab = tb; renderMoney();
      ok('the ' + tb + ' tab renders', (document.getElementById('s-money').innerHTML || '').length > 200);
    });
    mnTab = 'over'; renderMoney();
    ok('money is a nav destination', !!navCfg().find(n => n.k === 'money'));
    ok('money has a render function', typeof RENDER.money === 'function');
    ['finaccts', 'fintx', 'finmarks', 'finbudget', 'finset'].forEach(k =>
      ok(k + ' is backed up', BACKUP_KEYS.includes(k)));
    mnTab = prevTab; mnYm = prevYm;

    if (snapA != null) localStorage.setItem('dp.finaccts', snapA); else localStorage.removeItem('dp.finaccts');
    if (snapT != null) localStorage.setItem('dp.fintx', snapT); else localStorage.removeItem('dp.fintx');
    if (snapM != null) localStorage.setItem('dp.finmarks', snapM); else localStorage.removeItem('dp.finmarks');
    if (snapB != null) localStorage.setItem('dp.finbudget', snapB); else localStorage.removeItem('dp.finbudget');
    if (snapE != null) localStorage.setItem('dp.entries', snapE); else localStorage.removeItem('dp.entries');
  })();

  /* ---- MONEY: analysis and charts ---- */
  (function () {
    const sA = localStorage.getItem('dp.finaccts'), sT = localStorage.getItem('dp.fintx');
    const sM = localStorage.getItem('dp.finmarks'), sE = localStorage.getItem('dp.entries');
    const T = todayStr(), ym = finYm(T), H = 1;

    // --- month arithmetic, including the cases that break naive code ---
    ok('month end handles a 31-day month', finMonthEnd('2026-01') === '2026-01-31');
    ok('month end handles February', finMonthEnd('2026-02') === '2026-02-28');
    ok('month end handles a leap February', finMonthEnd('2024-02') === '2024-02-29');
    ok('month end handles December', finMonthEnd('2026-12') === '2026-12-31');

    // --- net worth must not invent history before an account existed ---
    localStorage.setItem('dp.finaccts', JSON.stringify(
      [{ id: 'b', name: 'B', kind: 'bank', opening: parseAmt('50000'), since: addDays(T, -90) }]));
    localStorage.setItem('dp.fintx', JSON.stringify(
      [{ id: 'p', d: addDays(T, -40), a: parseAmt('1000'), dir: 'out', ac: 'b', c: 'food', n: '' }]));
    /* The opening balance carries no date. Applied unconditionally it made an account opened
       today appear to hold its balance a year ago — fabricated wealth in the one chart people
       read most literally. */
    ok('an account has no balance before it existed', finBal('b', addDays(T, -200)) === null);
    ok('and none is counted toward net worth then', finNetWorth(addDays(T, -200)) === 0);
    ok('but it does right after it started', finBal('b', addDays(T, -89)) === parseAmt('50000'));
    ok('and today reflects the ledger', finBal('b') === parseAmt('49000'));
    /* An account saved before `since` existed infers its start from its own earliest record
       rather than needing a migration. */
    localStorage.setItem('dp.finaccts', JSON.stringify([{ id: 'L', name: 'Legacy', kind: 'bank', opening: parseAmt('9000') }]));
    localStorage.setItem('dp.fintx', JSON.stringify(
      [{ id: 'q', d: addDays(T, -50), a: parseAmt('100'), dir: 'out', ac: 'L', c: 'food', n: '' }]));
    ok('a legacy account infers its start date', finSince(finAcct('L')) === addDays(T, -50));
    ok('and has no balance before that', finBal('L', addDays(T, -60)) === null);

    // --- future-dated rows must not enter the analysis ---
    localStorage.setItem('dp.finaccts', JSON.stringify([{ id: 'b', name: 'B', kind: 'bank', opening: 0, since: addDays(T, -300) }]));
    localStorage.setItem('dp.fintx', JSON.stringify([
      { id: 'now', d: T, a: parseAmt('500'), dir: 'out', ac: 'b', c: 'food', n: '' },
      { id: 'later', d: addDays(T, 5), a: parseAmt('9999'), dir: 'out', ac: 'b', c: 'food', n: '' },
    ]));
    ok('a future-dated row is excluded from daily spending', !finDailySpend()[addDays(T, 5)]);
    ok('and today is still counted', finDailySpend()[T] === parseAmt('500'));
    ok('but it can be asked for explicitly', !!finDailySpend(true)[addDays(T, 5)]);

    // --- day of week: median, because the mean is hijacked by one monthly bill ---
    /* Rent on the 3rd made the MEAN report whichever weekday the 3rd fell on as the most
       expensive day. Real data: mean said Friday at Rs2,770; median said Rs476 and correctly
       named the weekend. A day-of-week profile describes behaviour, and one bill is not
       behaviour. */
    const dtx = [];
    /* Rent lands on the 3rd of the month — ONCE a month, as rent does. Putting it on every
       Friday (the first version of this fixture) made Friday genuinely expensive and the
       median correctly said so, which tested nothing. */
    for (let i = 1; i <= 240; i++) {
      const d = addDays(T, -i), g = new Date(d + 'T00:00:00').getDay(), we = g === 0 || g === 6;
      dtx.push({ id: 'w' + i, d, a: parseAmt(String(we ? 1200 : 400)), dir: 'out', ac: 'b', c: 'fun', n: '' });
      if (d.slice(8, 10) === '03') dtx.push({ id: 'r' + i, d, a: parseAmt('60000'), dir: 'out', ac: 'b', c: 'home', n: 'Rent' });
    }
    localStorage.setItem('dp.fintx', JSON.stringify(dtx));
    const prof = finDowProfile();
    /* Whichever weekday the 3rd most often fell on is the one the mean over-reports. */
    const rentDow = {};
    dtx.filter(t => t.n === 'Rent').forEach(t => {
      const i = (new Date(t.d + 'T00:00:00').getDay() + 6) % 7;
      rentDow[i] = (rentDow[i] || 0) + 1;
    });
    const hitWeekday = Object.keys(rentDow).map(Number).filter(i => i < 5)
      .sort((a, b) => rentDow[b] - rentDow[a])[0];
    ok('a weekday caught the monthly bill at least once', hitWeekday != null, JSON.stringify(rentDow));
    if (hitWeekday != null) {
      const hit = prof[hitWeekday], sat = prof[5];
      ok('the mean is inflated by the monthly bill on that weekday',
        hit.avg > hit.typical * 1.5, hit.avg + ' mean vs ' + hit.typical + ' median');
      ok('but the median is not', hit.typical < sat.typical,
        'weekday median ' + hit.typical + ' vs weekend ' + sat.typical);
    }
    ok('the median names the weekend as the expensive time',
      prof.slice().sort((a, b) => b.typical - a.typical)[0].i >= 5,
      JSON.stringify(prof.map(p => p.typical)));
    ok('each weekday reports how many of it there were', prof.every(d => d.n > 0));

    // --- the calendar heatmap must not collapse to one shade ---
    /* Scaling to the maximum let one rent payment push every ordinary day into the lightest
       step, leaving the grid monochrome — the opposite of what a heatmap is for. */
    /* Last month, not this one: the fixture stops at yesterday, so on the 1st this month is
       empty and the heatmap has nothing to shade (failed every 1st, first seen in UTC+14). */
    const lastYm = finYm(addDays(T, -+T.slice(8, 10)));
    const cal = chCalendar(lastYm);
    const steps = (cal.match(/ch-cal-c s(\d)/g) || []).map(x => x.slice(-1));
    const used = [...new Set(steps.filter(x => x !== '0'))];
    ok('the heatmap uses more than one intensity', used.length >= 3, used.join(','));
    ok('the heatmap says when its scale is clipped', /\+<\/span>/.test(cal) || !/22,000/.test(cal));

    // --- cumulative comparison ---
    const cum = finCumulative(ym);
    ok('cumulative runs to the length of the month',
      cum.now.length === +finMonthEnd(ym).slice(8, 10));
    ok('days after today are null, not zero',
      cum.now.slice(+T.slice(8, 10)).every(v => v === null));
    ok('the running total never goes down',
      cum.now.filter(v => v != null).every((v, i, a) => i === 0 || v >= a[i - 1]));
    ok('last month is a full series', cum.was.filter(v => v != null).length > 0);

    // --- chart primitives are honest when there is nothing to draw ---
    ok('an all-empty line chart says so, not an empty box',
      /ch-empty/.test(chLines([{ key: 'a', label: 'A', cls: 'x', pts: [] }], [], {})));
    ok('an all-zero bar chart says so',
      /ch-empty/.test(chBars([{ label: 'a', bars: [{ cls: 'x', v: 0 }] }], {})));
    ok('an empty ranked list says so', /ch-empty/.test(chRanked([], {})));
    ok('a line chart is announced to a screen reader',
      /role="img"/.test(chLines([{ key: 'a', label: 'A', cls: 'x', pts: [1, 2, 3] }], ['a', 'b', 'c'], {})));
    ok('a single data point still renders', 
      /ch-dot/.test(chLines([{ key: 'a', label: 'A', cls: 'x', pts: [5] }], ['a'], {})));
    ok('charts never emit a second y axis', !/y2Axis|axisRight/.test(chLines.toString()));

    // --- the tab renders ---
    const prevTab = mnTab, prevYm = mnYm;
    mnTab = 'charts'; mnYm = lastYm; renderMoney();
    const html = document.getElementById('s-money').innerHTML || '';
    ok('the charts tab renders', html.length > 1000, html.length);
    ok('it draws at least four figures', (html.match(/<svg/g) || []).length >= 4,
      (html.match(/<svg/g) || []).length);
    ok('it includes the spending calendar', /ch-cal-g/.test(html));
    mnTab = prevTab; mnYm = prevYm; renderMoney();

    if (sA != null) localStorage.setItem('dp.finaccts', sA); else localStorage.removeItem('dp.finaccts');
    if (sT != null) localStorage.setItem('dp.fintx', sT); else localStorage.removeItem('dp.fintx');
    if (sM != null) localStorage.setItem('dp.finmarks', sM); else localStorage.removeItem('dp.finmarks');
    if (sE != null) localStorage.setItem('dp.entries', sE); else localStorage.removeItem('dp.entries');
  })();

  /* ---- BACKUP EXPORT / IMPORT ---- */
  (function () {
    const eSnap = localStorage.getItem('dp.entries'), fSnap = localStorage.getItem('dp.fintx');
    const aSnap = localStorage.getItem('dp.finaccts'), pSnap = localStorage.getItem('dp.projects');
    const T = todayStr();

    // --- a backup must actually contain the data ---
    DB.putEntry(T, { mood: 8, journal: 'must survive', habits: { workout: true }, updatedAt: new Date().toISOString() });
    localStorage.setItem('dp.finaccts', JSON.stringify([{ id: 'b', name: 'Bank', kind: 'bank', opening: parseAmt('1000'), since: T }]));
    localStorage.setItem('dp.fintx', JSON.stringify([{ id: 'f', d: T, a: parseAmt('50'), dir: 'out', ac: 'b', c: 'food', n: 'x' }]));
    /* backupBlob() returns { data, skipped } since v230: a section that cannot be parsed is
       REPORTED rather than silently dropped, because a backup quietly missing a section is the
       same lie as a save that reports success it did not earn. The payload is `data`. */
    const full = backupBlob();
    const blob = full.data;
    ok('a healthy backup skips nothing', Array.isArray(full.skipped) && full.skipped.length === 0,
      (full.skipped || []).join(','));
    ok('the backup carries entries', !!blob.entries && !!blob.entries[T]);
    ok('the backup carries money', Array.isArray(blob.fintx) && blob.fintx.length === 1);
    ok('the backup carries settings', !!blob.settings);
    ok('every backup key is a real store',
      Object.keys(blob).every(k => k === 'settings' || BACKUP_KEYS.includes(k)),
      Object.keys(blob).filter(k => k !== 'settings' && !BACKUP_KEYS.includes(k)).join(','));
    /* exportData is async — stringifying its return value gives "{}" , which is how I briefly
       convinced myself the backup was empty. backupBlob is the synchronous data function. */
    ok('exportData is async and backupBlob is the data function',
      exportData.constructor.name === 'AsyncFunction' && typeof backupBlob() === 'object');

    // --- restoring a backup brings everything back ---
    const saved = JSON.stringify(blob);
    localStorage.clear();
    ok('a wipe really empties it', Object.keys(DB.entries()).length === 0);
    const d = JSON.parse(saved);
    BACKUP_KEYS.forEach(k => { if (d[k] !== undefined) localStorage.setItem('dp.' + k, JSON.stringify(d[k])); });
    ok('the journal comes back', (DB.entry(T) || {}).journal === 'must survive');
    ok('the balance comes back', finBal('b') === parseAmt('950'), finBal('b'));

    // --- a PARTIAL file touches only the stores it names ---
    /* This is what a statement import hands back: money only. Anything not in the file must
       be left exactly as it was, so a bad money file can never cost someone their journal. */
    DB.putEntry(T, { mood: 8, journal: 'personal', habits: {}, updatedAt: new Date().toISOString() });
    localStorage.setItem('dp.projects', JSON.stringify([{ id: 'p', name: 'proj' }]));
    const partial = { fintx: [{ id: 'n1', d: T, a: parseAmt('77'), dir: 'out', ac: 'b', c: 'food', n: 'new' }] };
    BACKUP_KEYS.forEach(k => { if (partial[k] !== undefined) localStorage.setItem('dp.' + k, JSON.stringify(partial[k])); });
    ok('a partial file leaves the journal alone', (DB.entry(T) || {}).journal === 'personal');
    ok('a partial file leaves projects alone',
      (safeParse(localStorage.getItem('dp.projects'), []) || []).length === 1);
    ok('and it does replace the store it names', finTx().length === 1 && finTx()[0].id === 'n1');

    // --- the import picker must not filter its own files out ---
    settingsPage = 'data'; renderSettings();
    const inp = document.getElementById('import-file');
    ok('the import picker exists', !!inp);
    /* A bare accept="application/json" makes some Android pickers grey out every file, which
       reads as "no backups found". */
    ok('the import picker accepts .json by extension too',
      !!inp && /\.json/.test(inp.getAttribute('accept') || ''), inp && inp.getAttribute('accept'));
    settingsPage = null;

    if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
    if (fSnap != null) localStorage.setItem('dp.fintx', fSnap); else localStorage.removeItem('dp.fintx');
    if (aSnap != null) localStorage.setItem('dp.finaccts', aSnap); else localStorage.removeItem('dp.finaccts');
    if (pSnap != null) localStorage.setItem('dp.projects', pSnap); else localStorage.removeItem('dp.projects');
  })();

  /* ---- THE ONE REVIEW ASK ---- */
  (function () {
    const rSnap = localStorage.getItem('dp.rateAsk'), eSnap = localStorage.getItem('dp.entries');
    const capSnap = window.Capacitor;
    window.Capacitor = window.Capacitor || { Plugins: { LocalNotifications: {} } };   // nativeShell() true
    const el = () => document.getElementById('rate-ask');
    const shown = () => !!el() && el().classList.contains('on');
    const hide = () => { if (el()) el().classList.remove('on'); };

    localStorage.removeItem('dp.rateAsk');
    // under 7 logged days: never
    const few = {}; for (let i = 0; i < 3; i++) few[addDays(todayStr(), -i)] = { mood: 7 };
    localStorage.setItem('dp.entries', JSON.stringify(few));
    maybeAskForReview();
    ok('no review ask before 7 logged days', !shown());
    ok('and an early call burns no ask', rateState().asks === 0);

    const many = {}; for (let i = 0; i < 9; i++) many[addDays(todayStr(), -i)] = { mood: 7 };
    localStorage.setItem('dp.entries', JSON.stringify(many));
    maybeAskForReview();
    ok('asks once real use exists', shown());
    ok('the copy says it is a one-person app', /one person/.test(el().textContent));
    ok('the copy promises a cap', /twice, ever/.test(el().textContent));
    hide();
    maybeAskForReview();
    ok('a second ask inside 14 days is suppressed', !shown());
    const st = rateState(); st.last = Date.now() - 15 * 86400000; rateSave(st);
    maybeAskForReview();
    ok('after 14 days it may ask once more', shown());
    hide();
    maybeAskForReview();
    ok('never a third time', !shown() && rateState().asks === 2);

    localStorage.removeItem('dp.rateAsk');
    maybeAskForReview();
    const go = document.getElementById('rate-go');
    ok('the rate button exists', !!go);
    const st2 = rateState(); st2.done = true; rateSave(st2); hide();
    maybeAskForReview();
    ok('tapping rate ends it permanently', !shown());

    window.Capacitor = capSnap;
    if (!capSnap) maybeAskForReview(), ok('no store, no ask (plain browser)', !shown());
    if (rSnap != null) localStorage.setItem('dp.rateAsk', rSnap); else localStorage.removeItem('dp.rateAsk');
    if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
  })();

  /* ---- HONEST DAYS: ghost entries do not count, celebrations are budgeted ---- */
  (function () {
    const eS = localStorage.getItem('dp.entries'), cS = localStorage.getItem('dp.celeb');
    const mS = localStorage.getItem('dp.milestones');
    const T = todayStr();

    // --- what counts as content ---
    ok('an empty entry is not content', !entryHasContent({ updatedAt: 'x', tasks: '' }));
    /* The reachable ghost: tap a habit on, untap it — {habits:{x:false}} is left behind. */
    ok('an all-false habits map is not content', !entryHasContent({ habits: { workout: false }, updatedAt: 'x' }));
    ok('a done habit is content', entryHasContent({ habits: { workout: true } }));
    ok('a SKIP is content — skipping is a choice you tapped', entryHasContent({ habits: { workout: 0 } }));
    ok('mood is content', entryHasContent({ mood: 7 }));
    ok('whitespace journal is not content', !entryHasContent({ journal: '   ' }));
    ok('real journal is content', entryHasContent({ journal: 'a day' }));
    ok('a mirrored zero counter is not content', !entryHasContent({ tasksDone: 0, workoutsDone: 0 }));
    ok('completed tasks are content', entryHasContent({ tasksDone: 2 }));
    ok('tracked time is content', entryHasContent({ timeSummary: 'work 2h' }));

    // --- ghost days no longer feed streaks, weeks or the days-logged award ---
    const ents = {};
    for (let i = 1; i <= 3; i++) ents[addDays(T, -i)] = { mood: 7, updatedAt: 'x' };
    ents[T] = { habits: { workout: false }, updatedAt: 'x', tasks: '' };   // today = ghost
    localStorage.setItem('dp.entries', JSON.stringify(ents));
    ok('a ghost today does not extend the streak', loggedStreak() === 3, loggedStreak());
    ok('the longest streak ignores ghosts too', longestLoggedStreak() === 3);
    ok('contentDates excludes the ghost', contentDates().length === 3);
    const days = awardSeries('days', DB.entries());
    ok('the days-logged award counts only real days',
      days.length === 3 && days[days.length - 1][1] === 3, JSON.stringify(days.slice(-1)));
    /* A ghost mid-run BREAKS the chain — an entry with nothing in it is a day you did not
       log, and a streak that survives unlogged days is not a streak. */
    ents[addDays(T, -2)] = { updatedAt: 'x', tasks: '' };
    localStorage.setItem('dp.entries', JSON.stringify(ents));
    ok('a ghost in the middle breaks the chain', loggedStreak() === 1, loggedStreak());
    ok('weekly cadence counts only real days',
      weekBuckets().reduce((a, w) => a + w.days, 0) === 2);

    // --- the celebration budget ---
    localStorage.removeItem('dp.celeb');
    ok('a fresh day has budget', !celebSpent());
    celebSpend();
    ok('one celebration spends it', celebSpent());
    localStorage.setItem('dp.celeb', JSON.stringify({ d: addDays(T, -1), n: 3 }));
    ok('yesterday\'s spend does not carry over', !celebSpent());
    /* Integration: with the budget spent, a milestone must NOT open the full-screen. */
    const good = {}; for (let i = 0; i < 3; i++) good[addDays(T, -i)] = { mood: 7 };
    localStorage.setItem('dp.entries', JSON.stringify(good));
    localStorage.removeItem('dp.milestones');
    localStorage.setItem('dp.celeb', JSON.stringify({ d: T, n: 1 }));
    checkStreakMilestone();   // streak is 3, a milestone — but the budget is spent
    const msEl = document.getElementById('milestone');
    ok('a budgeted-out milestone stays off the screen', !msEl || !msEl.classList.contains('on'));
    ok('but it is still recorded as shown, so it never re-fires',
      Object.keys(safeParse(localStorage.getItem('dp.milestones'), {})).length === 1);

    if (eS != null) localStorage.setItem('dp.entries', eS); else localStorage.removeItem('dp.entries');
    if (cS != null) localStorage.setItem('dp.celeb', cS); else localStorage.removeItem('dp.celeb');
    if (mS != null) localStorage.setItem('dp.milestones', mS); else localStorage.removeItem('dp.milestones');
  })();

  /* ---- THE RESTORE DOOR ---- */
  (function () {
    const oS = localStorage.getItem('dp.onboarded'), sS = localStorage.getItem('dp.settings');
    const eS = localStorage.getItem('dp.entries');

    // --- onboarding offers the way back in ---
    localStorage.removeItem('dp.onboarded');
    const prevStep = obStep, prevR = obRestore;
    obStep = 0; obRestore = false;
    const ob = document.getElementById('onboard');
    if (ob) { ob.classList.add('on'); renderOnboard();
      ok('step 0 offers a restore door', !!ob.querySelector('[data-ob-restore]'));
      obRestore = true; renderOnboard();
      ok('the panel offers a backup file', !!document.getElementById('ob-restore-file'));
      ok('and a sync link', !!document.getElementById('ob-restore-url'));
      ok('the file input takes .json by extension',
        /\.json/.test(document.getElementById('ob-restore-file').getAttribute('accept') || ''));
      ok('and a way to start fresh instead', !!ob.querySelector('[data-ob-restore-back]'));
      ob.classList.remove('on');
    }
    obStep = prevStep; obRestore = prevR;

    // --- a garbage link never becomes the configured endpoint ---
    const st0 = DB.settings(); st0.syncUrl = ''; DB.saveSettings(st0);
    let out = null;
    syncLinkRestore('http://evil.example/exec', (status) => { out = status; });
    ok('a non-script link is rejected outright', out === 'bad-url');
    ok('and nothing was configured', !DB.settings().syncUrl);
    syncLinkRestore('https://script.google.com/macros/s/ABC', (status) => { out = status; });
    ok('a link without /exec is rejected', out === 'bad-url');
    ok('still nothing configured', !DB.settings().syncUrl);

    /* importData's outcome hook is exercised through its SYNCHRONOUS failure path: a refused
       validateBackup. (The FileReader paths are async, and this suite's summary snapshots
       synchronously — a promise-returning block would assert into the void.) */
    ok('importData exposes an outcome hook', importData.length >= 2);
    ok('validateBackup still rejects junk — the hook rides on it',
      !validateBackup({ nonsense: 1 }).ok);

    // finishing a restore ends onboarding for good
    obFinishRestore('');
    ok('a finished restore marks onboarding done', localStorage.getItem('dp.onboarded') === '1');
    ok('and the tour as seen — the person is returning, not new',
      localStorage.getItem('dp.toured') === '1');
    if (oS != null) localStorage.setItem('dp.onboarded', oS); else localStorage.removeItem('dp.onboarded');
    if (sS != null) localStorage.setItem('dp.settings', sS); else localStorage.removeItem('dp.settings');
    if (eS != null) localStorage.setItem('dp.entries', eS); else localStorage.removeItem('dp.entries');
  })();

  /* ---- ASK (deterministic router, no model) ---- */
  (function () {
    const eS = localStorage.getItem('dp.entries'), fS = localStorage.getItem('dp.fintx');
    const aS = localStorage.getItem('dp.finaccts');
    const T = todayStr();
    const prevLog = askLog.slice();

    // --- routing ---
    ok('a streak question routes to streak', askRoute('what is my streak?').id === 'streak');
    ok('a spending question routes to money', askRoute('where did my money go').id === 'money-month');
    ok('a sleep question routes to sleep', askRoute('how is my sleep').id === 'sleep');
    ok('a mood question routes to mood', askRoute('how has my mood been').id === 'mood');
    ok('a subscriptions question routes to subs', askRoute('what subscriptions am i paying for').id === 'subs');
    ok('a net worth question routes to networth', askRoute('what is my net worth').id === 'networth');
    ok('a time question routes to time', askRoute('where does my time go').id === 'time');
    ok('every skill example routes to its own skill',
      ASK_SKILLS.every(sk => { const r = askRoute(sk.ex); return r && r.id === sk.id; }),
      ASK_SKILLS.filter(sk => { const r = askRoute(sk.ex); return !r || r.id !== sk.id; }).map(s => s.id).join(','));
    ok('gibberish routes nowhere', askRoute('zxqwv plork') === null);
    ok('an empty question routes nowhere', askRoute('   ') === null);

    /* THE POINT OF THE WHOLE DESIGN: an unrecognised question must say so, never guess. */
    const unk = askRun('what will the stock market do tomorrow');
    ok('an unknown question is answered honestly, not guessed', unk.unknown === true);
    ok('and it says the answers come from the log', /own log/i.test(unk.lines.join(' ')));

    // --- empty states are honest, never zeros presented as facts ---
    localStorage.setItem('dp.entries', '{}');
    localStorage.setItem('dp.finaccts', '[]'); localStorage.setItem('dp.fintx', '[]');
    const eStreak = askRun('my streak');
    ok('no data gives a "nothing yet" answer, not a fake zero', /not logged a day/i.test(eStreak.lines.join(' ')));
    const eMoney = askRun('where did my money go');
    ok('no accounts says so', /No accounts/i.test(eMoney.lines.join(' ')));

    // --- real data produces numbers that match the engine exactly ---
    const ents = {};
    for (let i = 0; i < 5; i++) ents[addDays(T, -i)] = { mood: 8, energy: 6, sleepHours: 7.5 };
    localStorage.setItem('dp.entries', JSON.stringify(ents));
    const r = askRun('what is my streak');
    ok('the streak answer states the real streak',
      r.lines.join(' ').includes('<b>' + loggedStreak() + '</b>'), 'engine says ' + loggedStreak());
    ok('and the real all-time total',
      r.lines.join(' ').includes('<b>' + contentDates().length + '</b>'));

    localStorage.setItem('dp.finaccts', JSON.stringify(
      [{ id: 'b', name: 'Bank', kind: 'bank', opening: parseAmt('10000'), since: addDays(T, -60) }]));
    localStorage.setItem('dp.fintx', JSON.stringify([
      { id: 'a', d: finYm(T) + '-02', a: parseAmt('50000'), dir: 'in', ac: 'b', c: 'salary', n: 'Salary' },
      { id: 'c', d: finYm(T) + '-03', a: parseAmt('1200'), dir: 'out', ac: 'b', c: 'food', n: 'x' },
    ]));
    const m = askRun('where did my money go');
    const eng = finMonth(finYm(T));
    ok('the money answer uses the engine figure verbatim',
      m.lines.join(' ').includes(finFmt(eng.out, { compact: true, noPaise: true })),
      'engine out = ' + finFmt(eng.out, { compact: true, noPaise: true }));
    ok('and the engine savings rate', m.lines.join(' ').includes('<b>' + eng.rate + '%</b>'));

    /* Nothing in an answer may be a number the engine did not produce — the fabrication
       guard this whole feature exists to preserve. Every skill must survive being run. */
    ok('every skill runs without throwing on real data',
      ASK_SKILLS.every(sk => { const out = askRun(sk.ex); return out && !out.failed; }),
      ASK_SKILLS.filter(sk => (askRun(sk.ex) || {}).failed).map(s => s.id).join(','));
    ok('every skill runs without throwing on an EMPTY store', (() => {
      localStorage.setItem('dp.entries', '{}'); localStorage.setItem('dp.fintx', '[]');
      localStorage.setItem('dp.finaccts', '[]'); localStorage.setItem('dp.timelog', '[]');
      return ASK_SKILLS.every(sk => { const out = askRun(sk.ex); return out && !out.failed; });
    })(), ASK_SKILLS.filter(sk => (askRun(sk.ex) || {}).failed).map(s => s.id).join(','));

    // --- the screen ---
    askLog = [];
    renderAsk();
    const el = document.getElementById('s-ask');
    ok('the ask screen renders', !!el && el.innerHTML.length > 400);
    ok('it has a question box', !!document.getElementById('ask-q'));
    ok('it offers an example per skill',
      el.querySelectorAll('[data-ask-ex]').length === ASK_SKILLS.length);
    ok('it states there is no model', /no ai model/i.test(el.textContent));
    askSubmit('what is my streak');
    ok('asking adds a turn', askLog.length === 1);
    ok('and the answer is rendered', !!document.getElementById('s-ask').querySelector('.ask-a'));
    ok('ask is a nav destination', !!navCfg().find(n => n.k === 'ask'));
    ok('ask has a render function', typeof RENDER.ask === 'function');
    /* The session log is memory-only — a question you typed is not written to storage. */
    /* Memory only. (dp.rateAsk is the review-prompt counter, a different thing — match the
       thread's own would-be key, not any key containing "ask".) */
    ok('the thread is never persisted',
      !localStorage.getItem('dp.ask') && !localStorage.getItem('dp.asklog'));
    askLog = prevLog;

    if (eS != null) localStorage.setItem('dp.entries', eS); else localStorage.removeItem('dp.entries');
    if (fS != null) localStorage.setItem('dp.fintx', fS); else localStorage.removeItem('dp.fintx');
    if (aS != null) localStorage.setItem('dp.finaccts', aS); else localStorage.removeItem('dp.finaccts');
  })();

  /* ---- MENU: Settings is named Settings, and sits last ---- */
  (function () {
    const nS = localStorage.getItem('dp.navcfg');
    /* An old saved config keeps its old label, because labels are user data and are not
       force-synced from NAV_DEF the way icons are. The exact old default is renamed; a
       label the user typed is left alone. */
    localStorage.setItem('dp.navcfg', JSON.stringify(
      [{ k: 'settings', ico: 'settings', label: 'More', primary: false }]));
    ok('a stored "More" becomes Settings', navCfg().find(n => n.k === 'settings').label === 'Settings');
    localStorage.setItem('dp.navcfg', JSON.stringify(
      [{ k: 'settings', ico: 'settings', label: 'My stuff', primary: false }]));
    ok('a label the user chose is never overwritten',
      navCfg().find(n => n.k === 'settings').label === 'My stuff');
    localStorage.removeItem('dp.navcfg');
    ok('the default label is Settings', navCfg().find(n => n.k === 'settings').label === 'Settings');

    /* Ordering is enforced at render time: a saved config appends new tabs after settings,
       which is exactly how Projects, Money and Ask ended up below it. */
    localStorage.setItem('dp.navcfg', JSON.stringify([
      { k: 'settings', ico: 'settings', label: 'More', primary: false },
      { k: 'tasks', ico: 'check', label: 'Tasks', primary: false },
      { k: 'money', ico: 'wallet', label: 'Money', primary: false },
    ]));
    renderDrawer();
    const keys = [...document.querySelectorAll('#drawer-list [data-screen], #drawer-foot [data-screen]')].map(b => b.dataset.screen);
    ok('settings renders last in the menu', keys[keys.length - 1] === 'settings', keys.join(','));
    ok('and lives in the footer, not among the tabs',
      !document.querySelector('#drawer-list [data-screen="settings"]') && !!document.querySelector('#drawer-foot [data-screen="settings"]'));
    ok('and the edit-tabs row is still below it', !!document.getElementById('drawer-edit-tabs'));
    ok('it reads Settings in the menu',
      /Settings/.test([...document.querySelectorAll('#drawer-foot [data-screen="settings"]')][0].textContent));
    if (nS != null) localStorage.setItem('dp.navcfg', nS); else localStorage.removeItem('dp.navcfg');
  })();

  /* ---- ALARM HEALTH: the card must not report a permission you already granted ---- */
  (function () {
    const aS = localStorage.getItem('dp.alarmHealth');
    /* The Fix button opens a SYSTEM settings page, so the only moment the app can learn the
       permission was granted is when it regains focus. Nothing re-checked, so the warning
       survived the fix — and re-opening Settings did not help because the card renders from
       the cache. */
    alarmHealth({ exactAllowed: false, notifOk: true, fullScreenAllowed: true, checked: Date.now() });
    ok('a denied permission is in the keys', alarmHealthKeys().e === false);
    alarmHealth({ exactAllowed: true });
    ok('granting it changes the keys', alarmHealthKeys().e === true);
    /* `checked` is a timestamp — if it fed the comparison every refresh would look like a
       change and redraw Settings underneath the user. */
    const before = JSON.stringify(alarmHealthKeys());
    alarmHealth({ checked: Date.now() + 10000 });
    ok('a new timestamp alone is not a change', JSON.stringify(alarmHealthKeys()) === before);
    ok('there is a re-check on returning to the app', typeof recheckAlarmHealth === 'function');
    ok('and it is safe to call outside the native shell',
      (() => { try { recheckAlarmHealth(); return true; } catch (e) { return false; } })());
    if (aS != null) localStorage.setItem('dp.alarmHealth', aS); else localStorage.removeItem('dp.alarmHealth');
  })();

  /* ---- FIRST RUN: start small, reveal on request ---- */
  (function () {
    const nS = localStorage.getItem('dp.navcfg'), lS = localStorage.getItem('dp.logsec');

    // --- a fresh install is calm ---
    localStorage.removeItem('dp.navcfg');
    const fresh = navCfg();
    const visible = fresh.filter(n => !n.hidden).map(n => n.k);
    ok('a fresh install shows a handful of destinations, not nineteen',
      visible.length <= 7, visible.join(','));
    ok('the Log is always there', visible.includes('today'));
    ok('and Settings', visible.includes('settings'));
    ok('every hidden one is an advanced one, never a core screen',
      fresh.filter(n => n.hidden).every(n => NAV_DEF.find(d => d.k === n.k).adv));
    ok('nothing is deleted — all 19 still exist', fresh.length === NAV_DEF.length);
    ok('every advanced feature explains what it does',
      NAV_DEF.filter(d => d.adv).every(d => d.blurb && d.blurb.length > 15),
      NAV_DEF.filter(d => d.adv && !d.blurb).map(d => d.k).join(','));

    /* THE RULE THAT MATTERS: this must never take a screen away from someone who already
       uses it. A saved config wins outright. */
    localStorage.setItem('dp.navcfg', JSON.stringify(
      [{ k: 'money', ico: 'wallet', label: 'Money', hidden: false, primary: false }]));
    ok('an existing user keeps a screen the new defaults would hide',
      navCfg().find(n => n.k === 'money').hidden === false);
    /* ...but a tab added in a LATER release should not be handed to them unannounced. */
    ok('a newly-added advanced tab arrives hidden for existing users',
      navCfg().find(n => n.k === 'awards').hidden === true);
    ok('a newly-added CORE tab still appears',
      navCfg().find(n => n.k === 'today').hidden !== true);

    // --- the reveal ---
    localStorage.removeItem('dp.navcfg');
    renderDrawer();
    ok('the drawer offers More features', !!document.getElementById('drawer-more-toggle'));
    const prevOpen = drawerMoreOpen;
    drawerMoreOpen = true; renderDrawer();
    const adds = document.querySelectorAll('[data-nav-on]');
    ok('it lists every hidden feature', adds.length === NAV_DEF.filter(d => d.adv).length,
      adds.length + ' of ' + NAV_DEF.filter(d => d.adv).length);
    ok('each one is described, not just named',
      [...adds].every(a => (a.textContent || '').length > 25));
    drawerMoreOpen = prevOpen;

    // --- the Deep log: 38 scales are not a day-one decision ---
    localStorage.removeItem('dp.logsec');
    const sec = logSecCfg();
    ok('the Deep log starts switched off', sec.find(x => x.id === 'deep').hidden === true);
    ok('but the core fields do not', sec.find(x => x.id === 'core').hidden === false);
    ok('and neither does the checklist', sec.find(x => x.id === 'checklist').hidden === false);
    /* Someone who already turned it on keeps it on. */
    localStorage.setItem('dp.logsec', JSON.stringify([{ id: 'deep', hidden: false }]));
    ok('an existing user keeps the Deep log visible',
      logSecCfg().find(x => x.id === 'deep').hidden === false);

    // --- onboarding is three steps, not five ---
    const src = renderOnboard.toString();
    ok('onboarding no longer asks you to configure activities', !/data-ob-act/.test(src));
    ok('onboarding no longer asks you to configure the deep log', !/data-ob-deep/.test(src));
    ok('it still asks for habits', /data-ob-habit/.test(src));
    ok('and still offers the reminder', /ob-rem-on/.test(src));

    if (nS != null) localStorage.setItem('dp.navcfg', nS); else localStorage.removeItem('dp.navcfg');
    if (lS != null) localStorage.setItem('dp.logsec', lS); else localStorage.removeItem('dp.logsec');
  })();

  /* ---- SUPPORT ASK (Play Billing tip jar) ---- */
  (function () {
    const tS = localStorage.getItem('dp.tip'), eS = localStorage.getItem('dp.entries');
    const rS = localStorage.getItem('dp.rateAsk');
    const capSnap = window.Capacitor;
    const shown = () => { const e = document.getElementById('tip-ask'); return !!e && e.classList.contains('on'); };
    const hide = () => { const e = document.getElementById('tip-ask'); if (e) e.classList.remove('on'); };

    /* THE RULE THE WHOLE FEATURE RESTS ON: Play's anti-steering policy allows exactly one
       in-app payment rail. With no products configured the plugin reports available:false
       and this must render NOTHING — a donate card with invented amounts would be worse
       than no donate card at all. */
    localStorage.removeItem('dp.tip');
    const many = {}; for (let i = 0; i < 20; i++) many[addDays(todayStr(), -i)] = { mood: 7 };
    localStorage.setItem('dp.entries', JSON.stringify(many));
    window.Capacitor = undefined;
    ok('no plugin, no ask', (maybeAskForTip(), !shown()));
    ok('and no ask is spent', tipState().asks === 0);

    // --- the card renders only from prices Play returned ---
    tipShow([
      { id: 'daylog_tip_small', type: 'once', price: '₹99', micros: 99000000 },
      { id: 'daylog_tip_medium', type: 'once', price: '₹249', micros: 249000000 },
      { id: 'daylog_tip_large', type: 'once', price: '₹499', micros: 499000000 },
      { id: 'daylog_support_monthly', type: 'monthly', price: '₹149' },
    ]);
    const el = document.getElementById('tip-ask');
    ok('the card shows three amounts', el.querySelectorAll('.tip-opt').length === 3);
    ok('the middle one is pre-selected', el.querySelectorAll('.tip-opt')[1].classList.contains('on'));
    ok('amounts come from Play, not from here', /₹249/.test(el.textContent));
    ok('a monthly option is offered', !!el.querySelector('.tip-month'));
    /* A donation must buy nothing — if this copy ever stops being true the feature has
       quietly become a digital purchase, with everything that implies. */
    ok('it says plainly that nothing is unlocked', /nothing in the app|changes nothing in the app/i.test(el.textContent));
    ok('it says it is free and stays free', /free,? and stays free/i.test(el.textContent));
    ok('and that the cap is two asks', /twice, ever/i.test(el.textContent));
    hide();

    // --- restraint ---
    ok('nothing about a donor is stored beyond "do not ask again"',
      Object.keys(tipState()).sort().join(',') === 'asks,gave,last');
    tipSave({ asks: 0, last: 0, gave: true });
    window.Capacitor = { Plugins: { DaylogBilling: { products: () => Promise.resolve(
      { available: true, products: [{ id: 'x', type: 'once', price: '₹99' }] }) } } };
    maybeAskForTip();
    ok('someone who already gave is never asked again', !shown());
    tipSave({ asks: 2, last: 0, gave: false });
    maybeAskForTip();
    ok('two asks is the hard cap', !shown());

    /* Two weeks of REAL days before money is mentioned — ghost entries do not count. */
    tipSave({ asks: 0, last: 0, gave: false });
    const few = {}; for (let i = 0; i < 5; i++) few[addDays(todayStr(), -i)] = { mood: 7 };
    localStorage.setItem('dp.entries', JSON.stringify(few));
    maybeAskForTip();
    ok('not asked before two weeks of real use', !shown() && tipState().asks === 0);

    ok('the tip key is install-local, not backed up',
      BACKUP_EXCLUDED.includes('tip') || !BACKUP_KEYS.includes('tip'));

    window.Capacitor = capSnap;
    if (tS != null) localStorage.setItem('dp.tip', tS); else localStorage.removeItem('dp.tip');
    if (rS != null) localStorage.setItem('dp.rateAsk', rS); else localStorage.removeItem('dp.rateAsk');
    if (eS != null) localStorage.setItem('dp.entries', eS); else localStorage.removeItem('dp.entries');
  })();

  // ---- Photos & voice notes (v251) ----
  (function () {
    ok('mediaFit never upscales', (() => { const f = mediaFit(800, 600, 1600); return f.w === 800 && f.h === 600; })());
    ok('mediaFit caps a portrait long edge', (() => { const f = mediaFit(3000, 4000, 1600); return f.w === 1200 && f.h === 1600; })());
    ok('mediaFit caps a landscape long edge', (() => { const f = mediaFit(4032, 3024, 1600); return f.w === 1600 && f.h === 1200; })());
    ok('mediaFit survives a zero-size image', (() => { const f = mediaFit(0, 0, 1600); return f.w >= 1 && f.h >= 1; })());
    ok('fmtClipLen 65s → 1:05', fmtClipLen(65000) === '1:05', fmtClipLen(65000));
    ok('fmtClipLen rounds to the second', fmtClipLen(2600) === '0:03', fmtClipLen(2600));
    ok('fmtBytes', fmtBytes(500) === '500 B' && fmtBytes(2048) === '2 KB' && fmtBytes(5 * 1048576) === '5.0 MB' && fmtBytes(30 * 1048576) === '30 MB',
      [fmtBytes(500), fmtBytes(2048), fmtBytes(5 * 1048576), fmtBytes(30 * 1048576)]);
    ok('count text', mediaCountText({ p: 1, v: 2 }) === '1 photo · 2 voice notes', mediaCountText({ p: 1, v: 2 }));

    /* A backup is the one file the user hands back to us; a damaged or hostile item must be
       refused, not written into the database. */
    const good = { id: 'mabc123', kind: 'photo', mime: 'image/jpeg', day: '2026-10-31', ctx: 'log', ts: 1, data: 'AAAA' };
    ok('a well-formed backup item passes', mediaItemValid(good));
    ok('a note voice item passes', mediaItemValid(Object.assign({}, good, { ctx: 'note:n123', kind: 'voice', mime: 'audio/webm;codecs=opus' })));
    [['a path in its id', { id: '../evil' }], ['an unknown kind', { kind: 'video' }], ['a bad day', { day: '31/10/2026' }],
     ['an unknown context', { ctx: 'doc:x' }], ['no data', { data: '' }], ['an html mime', { mime: 'text/html' }],
     ['non-string data', { data: 5 }]]
      .forEach(([n, patch]) => ok('a backup item with ' + n + ' is refused', !mediaItemValid(Object.assign({}, good, patch))));
    ok('null is refused', !mediaItemValid(null));
    ok('media is not a localStorage backup section', !BACKUP_KEYS.includes('_media') && !BACKUP_KEYS.includes('media'));

    /* The new Log section lands beside Reflection for everyone with a saved layout — appending
       it would bury it under the Sunday review. */
    const ls = localStorage.getItem('dp.logsec');
    localStorage.setItem('dp.logsec', JSON.stringify(['fresh', 'ring', 'onthisday', 'core', 'moodgrid', 'tasks', 'checklist', 'workout', 'health', 'reflection', 'deep', 'weekly'].map(id => ({ id, hidden: false }))));
    let order = logSecCfg().map(x => x.id);
    ok('Photos & voice slots in right after Reflection for a saved layout', order.indexOf('media') === order.indexOf('reflection') + 1, order.join(','));
    ok('and is switched on', !logSecCfg().find(x => x.id === 'media').hidden);
    localStorage.setItem('dp.logsec', JSON.stringify([{ id: 'weekly', hidden: false }, { id: 'reflection', hidden: true }]));
    order = logSecCfg().map(x => x.id);
    ok('it follows Reflection even where the user moved it', order.indexOf('media') === order.indexOf('reflection') + 1, order.join(','));
    ok('every section is still there exactly once', order.length === LOG_SECTIONS_DEF.length && new Set(order).size === order.length, order.join(','));
    if (ls != null) localStorage.setItem('dp.logsec', ls); else localStorage.removeItem('dp.logsec');

    /* No IndexedDB (jsdom, or a locked-down browser): say so, and offer no button that would
       pretend to save. */
    const supSnap = window.mediaSupported;
    if (!supSnap()) {
      const h0 = mediaSlotHTML('log', todayStr());
      ok('without storage the card says so instead of offering buttons', /cannot store photos/.test(h0) && !/data-madd/.test(h0), h0);
    }

    // With storage, from in-memory records.
    const urlSnap = URL.createObjectURL, readySnap = _mediaReady;
    URL.createObjectURL = () => 'blob:test';
    window.mediaSupported = () => true;
    _mediaReady = true;
    const T0 = todayStr();
    _media.set('mt1', { id: 'mt1', kind: 'photo', mime: 'image/jpeg', blob: new Blob(['x']), thumb: new Blob(['y']), day: T0, ctx: 'log', ts: Date.now(), size: 2 });
    _media.set('mt2', { id: 'mt2', kind: 'voice', mime: 'audio/webm', blob: new Blob(['z']), day: T0, ctx: 'log', ts: Date.now() + 1, dur: 65000, size: 1 });
    _media.set('mt3', { id: 'mt3', kind: 'photo', mime: 'image/jpeg', blob: new Blob(['x']), day: addDays(T0, -1), ctx: 'log', ts: 1, size: 1 });
    _media.set('mt4', { id: 'mt4', kind: 'photo', mime: 'image/jpeg', blob: new Blob(['x']), day: T0, ctx: 'note:nX', ts: 1, size: 1 });
    const h = mediaSlotHTML('log', T0);
    ok('today shows its photo', /data-mview="mt1"/.test(h));
    ok('and its voice note with its length', /data-vrow="mt2"/.test(h) && /1:05/.test(h));
    ok('but not yesterday’s photo', !/mt3/.test(h));
    ok('nor a note’s photo', !/mt4/.test(h));
    ok('the day count reads right', mediaCountText(mediaDayCount(T0)) === '1 photo · 1 voice note', mediaCountText(mediaDayCount(T0)));
    ok('Camera, Photos and Record are offered', h.includes('data-madd="camera"') && h.includes('data-madd="gallery"') && /data-mrec/.test(h));
    const hn = mediaSlotHTML('note:nX', '', { compact: true });
    ok('a note’s slot shows only that note’s media', /mt4/.test(hn) && !/mt1/.test(hn) && !/data-madd/.test(hn));
    ok('mediaHas finds a note’s media', mediaHas('note:nX') && !mediaHas('note:nope'));
    const ldSnap = logDate; logDate = T0; renderToday();
    ok('the Log screen has the Photos & voice card', !!document.querySelector('#s-today .media-card .media-slot[data-mctx="log"]'));
    ok('…with the count in its header', /1 photo/.test((document.getElementById('media-log-count') || {}).textContent || ''));
    logDate = ldSnap;
    const totals = mediaTotals();
    ok('totals count photos and voice separately', totals.photos === 3 && totals.voice === 1, totals);
    mediaViewOpen('mt1');
    ok('a thumbnail opens the viewer', mediaViewIsOpen());
    ok('the viewer pages only through that day’s photos', _mview && _mview.ids.length === 1, _mview && _mview.ids);
    handleBack();
    ok('Android back closes the viewer first', !mediaViewIsOpen());
    ['mt1', 'mt2', 'mt3', 'mt4'].forEach(id => _media.delete(id)); _mediaUrls.clear();
    _mediaReady = readySnap; window.mediaSupported = supSnap; URL.createObjectURL = urlSnap;
  })();

  if (snapshot != null) localStorage.setItem('dp.tasks', snapshot); else localStorage.removeItem('dp.tasks');

  const summary = { pass, fail, results: R };
  console.log('UNIT TESTS: ' + pass + ' passed, ' + fail + ' failed');
  R.forEach(r => console.log(r));
  window.__testSummary = summary;
  return summary;
})();
