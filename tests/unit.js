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
  ok('vs mood is an up-is-better metric', (VS_METRICS.find(m => m.k === 'mood') || {}).dir === 1);
  ok('vs time tracked takes no side', (VS_METRICS.find(m => m.k === 'tracked') || {}).dir === 0);
  // a thin log must say so rather than render an empty frame
  localStorage.setItem('dp.entries', JSON.stringify({ [todayStr()]: { mood: 7 } }));
  const vThin = vsPastHTML();
  ok('vs degrades honestly on a thin log', /more day/.test(vThin) && !/wow-row/.test(vThin));
  vsMode = vSnapMode;
  if (vSnapE != null) localStorage.setItem('dp.entries', vSnapE); else localStorage.removeItem('dp.entries');
  if (vSnapT != null) localStorage.setItem('dp.timelog', vSnapT); else localStorage.removeItem('dp.timelog');
  if (vSnapH != null) localStorage.setItem('dp.health', vSnapH); else localStorage.removeItem('dp.health');

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

  if (snapshot != null) localStorage.setItem('dp.tasks', snapshot); else localStorage.removeItem('dp.tasks');

  const summary = { pass, fail, results: R };
  console.log('UNIT TESTS: ' + pass + ' passed, ' + fail + ' failed');
  R.forEach(r => console.log(r));
  window.__testSummary = summary;
  return summary;
})();
