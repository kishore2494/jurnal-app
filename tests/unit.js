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
  // Coverage is spelled out ("4 vs 7 days logged", never "4d vs 7d"), and only when a metric
  // was logged on fewer days than the window's logged days — otherwise it repeats the hero line.
  const VC = {};
  // mood (the hero) every day; energy skipped on 3 of the last 7, so only its row needs the note
  for (let i = 1; i <= 14; i++) VC[addDays(todayStr(), -i)] = Object.assign({ mood: 7, habits: {} }, (i > 4 && i <= 7) ? {} : { energy: 6 });
  localStorage.setItem('dp.entries', JSON.stringify(VC));
  const vCov = vsPastHTML();
  ok('vs spells coverage out in days logged', /4 vs 7 days logged/.test(vCov), (vCov.match(/vs-cov">[^<]*/) || [])[0]);
  ok('vs never writes "4d vs 7d"', !/\d+d vs \d+d/.test(vCov));
  ok('vs stays quiet when a metric was logged every logged day',
     (vCov.match(/days logged<\/span>/g) || []).length === 1, (vCov.match(/days logged<\/span>/g) || []).length);
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

  // ---- Stats in plain words (real-user audit: "what is r=?", "what is Polymath?") ----
  const cwS = corrWords(0.72, 40, 'sleepHours', 'mood');
  ok('a big r on plenty of days is "a strong link"', cwS.level === 'a strong link', cwS.level);
  ok('…and says which way in an everyday sentence',
     cwS.say === 'On days you sleep more, your mood tends to be higher (40 days compared).', cwS.say);
  ok('a medium r is "a clear link"', corrWords(0.4, 40, 'sleepHours', 'mood').level === 'a clear link');
  const cwL = corrWords(0.2, 40, 'sleepHours', 'energy');
  ok('a small r is "a slight link" and says "a little"', cwL.level === 'a slight link' && /tends to be a little higher/.test(cwL.say), cwL);
  const cwN = corrWords(-0.5, 40, 'screenMin', 'mood');
  ok('a negative r reads as the opposite direction', /more time on your phone, your mood tends to be lower/.test(cwN.say), cwN.say);
  ok('a reversed pair keeps its own wording', /you have more energy, you tend to do less deep work/.test(corrWords(-0.4, 30, 'energy', 'deepWorkHours').say));
  ok('a near-zero r is "no clear link", with no sentence to over-read', (() => { const w = corrWords(-0.05, 40, 'sleepHours', 'mood'); return w.level === 'no clear link' && w.noise && !w.say; })());
  // r=0.4 on 5 days is what chance alone throws up — it must not be sold as a finding
  ok('a few days is "no clear link yet", not "a clear link"', corrWords(0.4, 5, 'sleepHours', 'mood').level === 'no clear link yet');
  const crH = corrRowsHTML([['A', 0.05, 30, 'sleepHours', 'mood'], ['B', -0.7, 30, 'sleepHours', 'mood'], ['C', 0.35, 30, 'sleepHours', 'mood']]).join('');
  ok('correlation rows never print r=', !/r=/.test(crH), crH.slice(0, 120));
  ok('findings come first, strongest first, no-link last', crH.indexOf('>B<') < crH.indexOf('>C<') && crH.indexOf('>C<') < crH.indexOf('>A<'));
  ok('a no-link row draws no bar', /corr-row quiet"><span class="name">A</.test(crH) && (crH.match(/corr-bar/g) || []).length === 2);
  // the explainer has to describe what polymath() really returns
  const pmKeys = Object.keys(polymath({ mood: 7, sleepHours: 8 }) || {});
  ok('polymath still has the five parts the explainer names',
     ['body', 'mind', 'work', 'learning', 'discipline'].every(k => pmKeys.indexOf(k) !== -1), pmKeys);
  {
    const sE = localStorage.getItem('dp.entries'), sR = dashRange, sT = dashTab, sM = dashMore;
    const SE = {};
    for (let i = 0; i < 20; i++) { const sl = 5 + (i % 4); SE[addDays(todayStr(), -i)] = { sleepHours: sl, mood: sl, energy: 6 + (i % 2), deepWorkHours: 2 + (i % 3), habits: {} }; }
    localStorage.setItem('dp.entries', JSON.stringify(SE));
    const dashOf = (tab, range) => { dashTab = tab; if (range) dashRange = range; renderDash(); return document.getElementById('s-dash').innerHTML; };
    const ov = dashOf('overview', 7);
    ok('Stats overview prints no r= anywhere', !/r=-?\d/.test(ov));
    ok('Connected insights speaks in plain words', /On days you sleep more, your mood tends to be higher/.test(ov));
    ok('Polymath has a "What is this?" explainer', /class="pm-what"/.test(ov) && /What is this\?/.test(ov)
       && ['Body', 'Mind', 'Work', 'Learning', 'Discipline'].every(p => ov.indexOf(' ' + p + '</b>') !== -1));
    ok('the Range picker says which cards it drives', /Applies to cards marked “last 7 days”/.test(ov));
    ok('the hero states its own period', /Averages for the last 14 days/.test(ov));
    ok('cards that ignore the picker name their own period',
       /Connected insights <span class="hint">all time/.test(ov) && /Your patterns<\/span> <span class="hint">from all your history/.test(ov));
    ok('the Range picker sits above the cards it drives, under the ones it does not',
       ov.indexOf('id="dash-range"') > ov.indexOf('pm-card') && ov.indexOf('id="dash-range"') < ov.indexOf('Mood <span class="hint">last 7 days'));
    ok('the overview renders one Range picker', (ov.match(/id="dash-range"/g) || []).length === 1);
    ok('Time and Health keep the picker at the top', ['time', 'health'].every(t => (dashOf(t).match(/id="dash-range"/g) || []).length === 1));
    ok('Checklist has no picker (nothing there follows it)', !/id="dash-range"/.test(dashOf('check')));
    dashMore = false;
    const ovT = dashOf('overview', 1);
    ok('a one-day range reads "today", not "last 1 days"', /Mood <span class="hint">today</.test(ovT) && !/last 1 days/.test(ovT));
    ok('"More stats" folds the reference cards, closed by default', /<details class="dash-more" id="dash-more">/.test(ovT) && /id="graph-wrap"/.test(ovT));
    dashMore = true;
    ok('…and stays open across a re-render once opened', /id="dash-more" open/.test(dashOf('overview', 7)));
    if (sE != null) localStorage.setItem('dp.entries', sE); else localStorage.removeItem('dp.entries');
    dashRange = sR; dashTab = sT; dashMore = sM;
  }

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
  // the re-engagement nudges: no loss framing, and a real off switch
  const nudgeSrc = [scheduleInactivityReminder, nudgeInput, nudgePlan, logReminderCopy, comebackCopy].map(f => f.toString()).join('\n') + JSON.stringify(LOGREM_COPY);
  ok('the nudge has an off switch', /dp\.nudgeOff/.test(nudgeInput.toString()) && /o\.off/.test(nudgePlan.toString()));
  ok('the nudge uses no loss framing',
     !/keeps your streak alive|miss you|don't lose|falling behind|streak/i.test(nudgeSrc.replace(/loggedStreak/g, '')), nudgeSrc.slice(0, 300));
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

  // ---- v269: first insight after 3 hand-logged days + the day-5 question ----
  (function () {
    const keys = ['dp.entries', 'dp.firstSeen', 'dp.insightSeen', 'dp.checkin', 'dp.onboarded', 'dp.freshSeen', 'dp.notifAsk'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const realToday = todayStr, snapLog = logDate;
    const T = '2026-08-27';   // a Thursday: no landmark
    window.todayStr = x => (x ? realToday(x) : T);
    try {
      const hk = habitCfg().filter(h => !h.hidden).map(h => h.key);
      const day = (mood, sleep, nTicks, extra) => Object.assign({ mood, sleepHours: sleep,
        habits: Object.fromEntries(hk.slice(0, nTicks).map(k => [k, H_DONE])) }, extra || {});
      // 2 days → nothing yet
      let E = { '2026-08-24': day(5, 6, 1), '2026-08-25': day(7, 7, 1) };
      ok('no first insight before the third day logged by hand', firstInsight(E) === null);
      // an auto-only day (health sleep) does not count as logged by hand
      E['2026-08-26'] = { workoutsDone: 2, timeSummary: { work: 60 } };   // ENTRY_AUTO fields only
      ok('…a day with only automatic data does not count', firstInsight(E) === null);
      // 3 hand-logged days with a clear best day
      E = { '2026-08-24': day(5, 6, 1), '2026-08-25': day(9, 8, 3, { deepWorkHours: 3 }), '2026-08-26': day(5, 6, 1, { deepWorkHours: 1 }) };
      const ins = firstInsight(E);
      ok('three days → a first pattern built on the best mood day', ins && ins.kind === 'best' && ins.best === '2026-08-25', JSON.stringify(ins));
      ok('…it names the day and the mood', /mood 9 of 10/.test(ins.lines[0]));
      ok('…and what was different: sleep', ins.lines.some(l => /Sleep that day: <b>8 h<\/b>, against 6 h/.test(l)), ins.lines.join(' | '));
      if (hk.length >= 3) ok('…and habits', ins.lines.some(l => /Habits ticked: <b>3<\/b>, against 1 /.test(l)), ins.lines.join(' | '));
      ok('…never more than three lines', ins.lines.length <= 3);
      // flat moods → the plain line, no invented pattern
      const flat = firstInsight({ '2026-08-24': day(6, 7, 1), '2026-08-25': day(6, 7, 1), '2026-08-26': day(6, 7, 1) });
      ok('flat moods give the plain card, not a made-up pattern', flat && flat.kind === 'plain' && /3 days logged/.test(flat.title));
      // no moods at all
      const nomood = firstInsight({ '2026-08-24': { journal: 'a' }, '2026-08-25': { journal: 'b' }, '2026-08-26': { journal: 'c' } });
      ok('journal-only days give the plain card', nomood && nomood.kind === 'plain');
      // a best day with nothing else different says so
      const same = firstInsight({ '2026-08-24': day(5, 7, 1), '2026-08-25': day(8, 7, 1), '2026-08-26': day(5, 7, 1) });
      ok('a best day with nothing different says so honestly', same.lines.length === 2 && /Nothing else stood out/.test(same.lines[1]));

      // ---- the Log slot ----
      localStorage.setItem('dp.onboarded', '1'); localStorage.setItem('dp.notifAsk', '1');
      localStorage.removeItem('dp.insightSeen'); localStorage.removeItem('dp.checkin');
      localStorage.setItem('dp.entries', JSON.stringify(E));
      localStorage.setItem('dp.firstSeen', '2026-08-24');
      logDate = T;
      ok('the insight card shows on today once three days are logged', nudgeCardKind() === 'insight' && /ins-card/.test(nudgeCardHTML()));
      logDate = '2026-08-26';
      ok('…but not on a back-dated Log', nudgeCardKind() === '');
      logDate = T;
      safeSet('dp.insightSeen', T);
      ok('dismissed: gone, and no second card the same day', nudgeCardKind() === '');
      safeSet('dp.insightSeen', '2026-08-20');
      ok('day 4 after the first open: no question yet', nudgeCardKind() === '');
      localStorage.setItem('dp.firstSeen', '2026-08-23');
      ok('day 5: the question appears', nudgeCardKind() === 'ask' && /What would make Daylog worth opening every day\?/.test(nudgeCardHTML()));
      ok('…and says nothing is sent without a tap', /Nothing is sent unless you tap Send/.test(nudgeCardHTML()));
      const mt = checkinMailto('A weekly email of my patterns');
      ok('Send hands the answer to the mail app, prefilled', mt.startsWith('mailto:' + FEEDBACK_EMAIL + '?subject=') && /A%20weekly%20email%20of%20my%20patterns/.test(mt));
      safeSet('dp.checkin', 'no:' + T);
      ok('Not now: never asked again', nudgeCardKind() === '');
      localStorage.removeItem('dp.checkin');
      ok('one card at a time: a landmark day takes the slot', (() => { window.todayStr = x => (x ? realToday(x) : '2026-08-31'); logDate = '2026-08-31'; localStorage.removeItem('dp.freshSeen'); const k = nudgeCardKind(); window.todayStr = x => (x ? realToday(x) : T); logDate = T; return k === ''; })());
      localStorage.removeItem('dp.firstSeen'); localStorage.setItem('dp.entries', JSON.stringify({}));
      ok('a brand-new install is dated from today', firstSeenDate() === T && localStorage.getItem('dp.firstSeen') === T);
      localStorage.removeItem('dp.firstSeen'); localStorage.setItem('dp.entries', JSON.stringify({ '2026-03-02': { mood: 5 } }));
      ok('an existing user is dated from their first entry', firstSeenDate() === '2026-03-02');
      ok('the new flags describe this install, so they stay out of backups', ['firstSeen', 'insightSeen', 'checkin'].every(k => BACKUP_EXCLUDED.includes(k) && !BACKUP_KEYS.includes(k)));
    } finally {
      window.todayStr = realToday; logDate = snapLog;
      keys.forEach(k => { if (snap[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, snap[k]); });
    }
  })();

  // ---- v270: sealed letters + the month film ----
  (function () {
    const keys = ['dp.letters', 'dp.entries', 'dp.filmSeen', 'dp.onboarded', 'dp.freshSeen', 'dp.notifAsk', 'dp.insightSeen', 'dp.checkin', 'dp.firstSeen'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const realToday = todayStr, snapLog = logDate, snapLt = _lt;
    const T = '2026-11-26';
    window.todayStr = x => (x ? realToday(x) : T);
    try {
      // dates and words
      ok('a month after 31 Jan is the last day of February', letterAddMonths('2026-01-31', 1) === '2026-02-28' && letterAddMonths('2028-01-31', 1) === '2028-02-29');
      ok('a year after is the same date next year', letterAddMonths('2026-11-26', 12) === '2027-11-26');
      ok('countdown words read the way people say them',
        [[0, 'today'], [1, 'tomorrow'], [5, 'in 5 days'], [21, 'in 3 weeks'], [30, 'in 1 month'], [182, 'in 6 months'], [365, 'in 1 year'], [730, 'in 2 years']]
          .every(([n, w]) => letterIn(n) === w), [0, 1, 5, 21, 30, 182, 365, 730].map(letterIn).join(','));
      ok('…and so does how long it waited', letterAgo(365) === '1 year ago' && letterAgo(1) === 'yesterday');
      const pr = letterPresets(T);
      ok('the presets: a month, six months, a year, New Year', pr.map(p => p.d).join() === '2026-12-26,2027-05-26,2027-11-26,2027-01-01', pr.map(p => p.d).join());
      localStorage.setItem('dp.letters', JSON.stringify([null, { id: 'x' }, { id: 'L1', openOn: '2027-01-01', created: T, sealed: true, text: 'a' }, 'junk']));
      ok('a damaged letters store keeps only real letters', lettersAll().length === 1 && lettersAll()[0].id === 'L1');

      // sealed means sealed
      const SECRET = 'SECRET-WORDS-270';
      localStorage.setItem('dp.letters', JSON.stringify([{ id: 'Lseal', created: '2026-11-01', at: 1, openOn: '2026-12-26', text: SECRET, sealed: true, openedAt: null }]));
      const L = letterById('Lseal');
      ok('before its day a letter is locked, not ready', letterLocked(L) && !letterReady(L));
      logDate = T;
      const pill = letterLogHTML();
      ok('the Log shows when it opens', /lt-pill/.test(pill) && /opens in 1 month/.test(pill), pill.replace(/\s+/g, ' '));
      ok('…and never a word of it', !pill.includes(SECRET) && !letterListHTML().includes(SECRET) && !letterDrawerHTML('today').includes(SECRET));
      _lt = { mode: 'read', id: 'Lseal' }; renderLetters();
      ok('asking to read a sealed letter shows the list instead', _lt === null && !document.getElementById('s-letters').innerHTML.includes(SECRET));
      logDate = '2026-11-20';
      ok('a back-dated Log shows no letter', letterLogHTML() === '');
      logDate = T;
      // its day comes
      window.todayStr = x => (x ? realToday(x) : '2026-12-26');
      logDate = '2026-12-26';
      ok('on its day it is ready', letterReady(letterById('Lseal')) && /A letter from you is ready/.test(letterLogHTML()) && /data-lt-open="Lseal"/.test(letterLogHTML()));
      ok('the menu says so too', /A letter is ready to open/.test(letterDrawerHTML('today')));
      _lt = { mode: 'read', id: 'Lseal' }; renderLetters();
      ok('reading an unopened letter goes through the opening first', _lt && _lt.mode === 'opening');
      letterPatch('Lseal', { openedAt: Date.now() }); _lt = { mode: 'read', id: 'Lseal' }; renderLetters();
      ok('once opened it reads in full', document.getElementById('s-letters').innerHTML.includes(SECRET) && /sealed for 2 months/.test(document.getElementById('s-letters').innerHTML));
      ok('an opened letter leaves the Log', letterLogHTML() === '');
      _lt = null;
      window.todayStr = x => (x ? realToday(x) : T); logDate = T;

      // drafts
      localStorage.setItem('dp.letters', '[]');
      const d = letterNew();
      ok('a new letter starts as a draft dated today, opening in a year', d && !d.sealed && d.created === T && d.openOn === '2027-11-26');
      ok('an empty draft counts as empty', letterEmpty(letterById(d.id)));
      letterPatch(d.id, { text: 'hello' });
      ok('a draft with words does not', !letterEmpty(letterById(d.id)) && /Draft/.test(letterListHTML()));
      ok('a draft never shows on the Log', letterLogHTML() === '');

      // storage, backups, media
      ok('letters are in backups', BACKUP_KEYS.includes('letters'));
      ok('the film flag stays out of backups', BACKUP_EXCLUDED.includes('filmSeen') && !BACKUP_KEYS.includes('filmSeen'));
      ok('letters are not sent to the Sheet', !/letters/.test(pushState.toString()));
      ok('a letter’s photo or voice note survives a restore', mediaItemValid({ id: 'm1', kind: 'voice', day: T, ctx: 'letter:Labc12', data: 'AAAA', mime: 'audio/webm' }));
      ok('…but a made-up context does not', !mediaItemValid({ id: 'm1', kind: 'voice', day: T, ctx: 'letter:../x', data: 'AAAA' }));
      ok('a fresh install still shows nine or fewer tabs (Letters is a menu row)', (() => { const v0 = localStorage.getItem('dp.navcfg'); localStorage.removeItem('dp.navcfg'); const n = navCfg().filter(x => !x.hidden).length; if (v0 != null) localStorage.setItem('dp.navcfg', v0); return n <= 9; })());

      // ---- the film ----
      ok('a short line stays whole', filmClip('A good day.', 150) === 'A good day.');
      ok('a long one ends on a sentence when it can', filmClip('One two three four five six. Seven eight nine ten eleven twelve thirteen fourteen.', 40) === 'One two three four five six.');
      ok('…else on a word, with an ellipsis', /…$/.test(filmClip('alpha beta gamma delta epsilon zeta eta theta iota kappa', 30)));
      const hk = habitCfg().filter(h => !h.hidden).map(h => h.key);
      const E = {};
      for (let i = 1; i <= 31; i++) {
        if (i % 5 === 3) continue;
        const dd = '2026-10-' + String(i).padStart(2, '0');
        E[dd] = { mood: i === 1 || i === 17 ? 10 : 5, sleepHours: 7, habits: Object.fromEntries(hk.slice(0, 2).map(k => [k, H_DONE])),
          journal: i === 17 ? 'Finished the release and walked by the lake in the evening.' : i === 1 ? 'ok day' : '' };
      }
      E['2026-10-30'].sample = true;
      localStorage.setItem('dp.entries', JSON.stringify(E));
      const fd = filmData('2026-10');
      ok('the film covers every day of the month', fd.cells.length === 31);
      ok('…starting on the right weekday (1 Oct 2026 is a Thursday)', fd.lead === 3);
      ok('demo rows are not logged days', fd.logged === 24, fd.logged);
      ok('a tie for best day goes to the day you wrote about', fd.best && fd.best.date === '2026-10-17' && fd.best.mood === 10, JSON.stringify(fd.best));
      ok('…and its words become the quote', /walked by the lake/.test(fd.quote));
      ok('at most three numbers', fd.stats.length >= 1 && fd.stats.length <= 3);
      const sc = filmScenes(fd).map(s => s.k);
      ok('it opens on the month and ends on the next', sc[0] === 'title' && sc[sc.length - 1] === 'end' && fd.next === 'November', sc.join(','));
      const tot = filmScenes(fd).reduce((a, s) => a + s.dur, 0);
      ok('about thirty seconds', tot >= 20 && tot <= 36, tot);
      ok('"ok day" is not quoted', (() => { const e2 = JSON.parse(JSON.stringify(E)); e2['2026-10-17'].journal = ''; localStorage.setItem('dp.entries', JSON.stringify(e2)); const q = filmData('2026-10').quote; localStorage.setItem('dp.entries', JSON.stringify(E)); return q === ''; })());
      ok('a month needs three logged days for a film', filmMonthOk('2026-10') && !filmMonthOk('2026-09'));
      // the Log offers it in the first week, once
      localStorage.setItem('dp.onboarded', '1'); localStorage.setItem('dp.notifAsk', '1');
      localStorage.removeItem('dp.filmSeen');
      window.todayStr = x => (x ? realToday(x) : '2026-11-03'); logDate = '2026-11-03';
      ok('in the first week the Log offers last month’s film', filmCardYM() === '2026-10' && nudgeCardKind() === 'film' && /data-film-open="2026-10"/.test(nudgeCardHTML()));
      safeSet('dp.filmSeen', '2026-10');
      ok('…once', filmCardYM() === null && nudgeCardKind() !== 'film');
      localStorage.removeItem('dp.filmSeen');
      window.todayStr = x => (x ? realToday(x) : '2026-11-09'); logDate = '2026-11-09';
      ok('…and not after the first week', filmCardYM() === null);
      window.todayStr = x => (x ? realToday(x) : '2026-11-01'); logDate = '2026-11-01';
      localStorage.setItem('dp.freshSeen', '{}');
      ok('on the 1st the new-month card carries the film', /data-film-open="2026-10"/.test(freshHTML()) && nudgeCardKind() === '');
      ok('the Stats month card offers it too', /data-film-open="2026-10"/.test(monthCardHTML()));
    } finally {
      window.todayStr = realToday; logDate = snapLog; _lt = snapLt;
      keys.forEach(k => { if (snap[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, snap[k]); });
    }
  })();

  // ---- v272: habit schedules (some weekdays, N times a week) ----
  (function () {
    const keys = ['dp.habitcfg', 'dp.entries'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const realToday = todayStr, snapLog = logDate, snapDraft = draft;
    const T = '2026-11-26';                                   // a Thursday; its week starts Mon 23 Nov
    window.todayStr = x => (x ? realToday(x) : T);
    const setCfg = cfg => { localStorage.setItem('dp.habitcfg', JSON.stringify(cfg)); reloadCfg(); };
    const ents = {};
    const tick = (d, k, v) => { (ents[d] = ents[d] || { habits: {} }).habits[k] = v === undefined ? true : v; };
    const save = () => localStorage.setItem('dp.entries', JSON.stringify(ents));
    try {
      // cleaning what comes from a sync or a backup
      ok('weekdays are de-duplicated and sorted', JSON.stringify(schedClean({ days: [5, 1, 3, 3, '1'] })) === '{"days":[1,3,5]}');
      ok('no days, all seven days or junk means every day',
        [{ days: [] }, { days: [0, 1, 2, 3, 4, 5, 6] }, { days: [9, -1] }, { week: 0 }, { week: 7 }, { week: 2.5 }, 'x', null].every(x => schedClean(x) === null));
      ok('N a week keeps 1 to 6', schedClean({ week: '3' }).week === 3 && schedClean({ week: 6 }).week === 6);
      ok('labels read the way people say them',
        schedLabel(null) === 'Every day' && schedLabel({ days: [1, 2, 3, 4, 5] }) === 'Weekdays' && schedLabel({ days: [0, 6] }) === 'Weekends'
        && schedLabel({ days: [5, 1, 3] }) === 'Mon, Wed, Fri' && schedLabel({ days: [0, 1] }) === 'Mon, Sun'
        && schedLabel({ week: 3 }) === '3 times a week' && schedLabel({ week: 1 }) === 'Once a week');

      setCfg([{ key: 'run', emoji: '🏃', label: 'Run', sched: { days: [1, 3, 5] } },
              { key: 'gym', emoji: '💪', label: 'Gym', sched: { week: 3 } },
              { key: 'read', emoji: '📖', label: 'Read' }]);
      // Run: Mon/Wed/Fri, every one of them done for two weeks
      ['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-23', '2026-11-25'].forEach(d => tick(d, 'run'));
      // Gym: 3 a week for the two weeks before this one, 1 so far this week, 1 the week before those
      ['2026-11-03', '2026-11-09', '2026-11-11', '2026-11-13', '2026-11-16', '2026-11-18', '2026-11-20', '2026-11-24'].forEach(d => tick(d, 'gym'));
      // Read: an everyday habit done the same days as Run
      ['2026-11-23', '2026-11-25'].forEach(d => tick(d, 'read'));
      save();
      const e = DB.entriesRO();

      ok('a weekday off reads as a rest day, only when the date is given',
        hVal(e['2026-11-24'], 'run', '2026-11-24') === H_SKIP && hVal(e['2026-11-24'], 'run') === H_MISS);
      ok('a planned day not done is still a miss', hVal(e['2026-11-13'], 'run', '2026-11-13') === H_MISS);
      ok('an everyday habit is untouched', hVal(e['2026-11-24'], 'read', '2026-11-24') === H_MISS);
      ok('rest days never break the streak', habitStreak('run') === 5, habitStreak('run'));
      ok('…where every day it would have been 1', habitStreak('read') === 1);
      ok('best is counted the same way, so never below now', bestHabitStreak('run') === 5, bestHabitStreak('run'));

      ok('in a week with its 3, the other days rest', hVal(e['2026-11-10'], 'gym', '2026-11-10') === H_SKIP);
      ok('a past week that fell short is a miss', hVal(e['2026-11-04'], 'gym', '2026-11-04') === H_MISS);
      ok('this week, still able to make 3, is not a miss yet', hVal(e['2026-11-25'], 'gym', '2026-11-25') === H_SKIP);
      ok('a 3-a-week streak counts weeks, and an unfinished week does not break it', habitStreak('gym') === 2, habitStreak('gym'));
      ok('…in its own unit', streakShort('gym', 2) === '2w' && streakLong('gym', 2) === '2-week streak' && streakLong('run', 5) === '5-day streak');
      tick('2026-11-25', 'gym'); tick('2026-11-26', 'gym'); save();
      ok('the week grows the streak once its 3 are in', habitStreak('gym') === 3 && bestHabitStreak('gym') === 3);
      delete ents['2026-11-25'].habits.gym; delete ents['2026-11-26'].habits.gym; save();
      window.todayStr = x => (x ? realToday(x) : '2026-11-29');   // Sunday, still 1 of 3
      ok('once the week can no longer make it, the streak is gone', habitStreak('gym') === 0 && bestHabitStreak('gym') === 2);
      window.todayStr = x => (x ? realToday(x) : T);
      // a week short of 3 but with skipped days to cover it is passed over, like a skipped day
      ['2026-10-26', '2026-10-28', '2026-10-30'].forEach(d => tick(d, 'gym'));
      tick('2026-11-04', 'gym', 0); tick('2026-11-05', 'gym', 0); save();
      ok('a week made up with skips neither counts nor breaks', habitStreak('gym') === 3, habitStreak('gym'));

      ok('the last 30 days count planned days only (13 Mon/Wed/Fri, 5 done)', habit30('run', DB.entriesRO()).denom === 13 && habit30('run', DB.entriesRO()).hits === 5 && habit30('read', DB.entriesRO()).denom === 30,
        JSON.stringify(habit30('run', DB.entriesRO())));
      const strWith = habitStrength('run');
      setCfg([{ key: 'run', emoji: '🏃', label: 'Run' }, { key: 'gym', emoji: '💪', label: 'Gym', sched: { week: 3 } }, { key: 'read', emoji: '📖', label: 'Read' }]);
      ok('rest days do not drag strength down', strWith > habitStrength('run'), strWith + ' vs ' + habitStrength('run'));
      setCfg([{ key: 'run', emoji: '🏃', label: 'Run', sched: { days: [1, 3, 5] } }, { key: 'gym', emoji: '💪', label: 'Gym', sched: { week: 3 } }, { key: 'read', emoji: '📖', label: 'Read' }]);

      // the Log on Thursday
      logDate = T; draft = { habits: {} };
      const runChip = habitChipHTML(HABITS.find(h => h.key === 'run'));
      ok('the Log marks the day off', /class="habit [^"]*rest/.test(runChip) && /class="hrest">rest</.test(runChip));
      ok('…and it still counts as complete', todayCompletion(draft, T).done >= todayCompletion({ habits: { run: true } }, '2026-11-27').done);
      ok('the weekly habit shows its count', /class="hwk">1\/3</.test(habitChipHTML(HABITS.find(h => h.key === 'gym'))));
      draft = { habits: { run: true, gym: true } };
      ok('a tick on a rest day is a tick', /class="habit on/.test(habitChipHTML(HABITS.find(h => h.key === 'run'))) && !/hrest/.test(habitChipHTML(HABITS.find(h => h.key === 'run'))));
      ok('the unsaved tick counts toward the week', /hwk">2\/3</.test(habitChipHTML(HABITS.find(h => h.key === 'gym'))));
      draft = { habits: {} };

      // the Habits screen
      renderHabits();
      const hs = document.getElementById('s-habits').innerHTML;
      ok('the Habits screen shows each schedule', /data-sched-edit="run"[^>]*>.*Mon, Wed, Fri/.test(hs) && /3 times a week/.test(hs) && /data-sched-edit="read"[^>]*>.*Every day/.test(hs));
      ok('…the week so far and a streak in weeks', /This week 1 of 3 · 🔥 3-week streak/.test(hs), (hs.match(/This week[^<]*/) || [''])[0]);
      ok('…and rest days in the heatmap', /class="cell rest/.test(hs) && /rest day/.test(hs));

      // the editor
      showSchedEditor('read');
      const m = () => document.getElementById('sched-editor');
      ok('the editor opens on the current schedule', m().style.display === 'flex' && /data-sched-mode="daily" aria-pressed="true"/.test(m().innerHTML));
      m().querySelector('[data-sched-mode="week"]').click();
      m().querySelector('[data-sched-n="1"]').click();
      ok('times a week steps from 3', /<b>4<\/b>/.test(m().innerHTML));
      m().querySelector('#se-save').click();
      ok('saving stores it on the habit', JSON.stringify(habitCfg().find(h => h.key === 'read').sched) === '{"week":4}' && m().style.display === 'none');
      showSchedEditor('read');
      m().querySelector('[data-sched-mode="days"]').click();
      [1, 3, 5].forEach(d => m().querySelector(`[data-sched-day="${d}"]`).click());   // Mon/Wed/Fri start on: clear them
      ok('no day picked cannot be saved', m().querySelector('#se-save').disabled);
      [0, 1, 2, 3, 4, 5, 6].forEach(d => m().querySelector(`[data-sched-day="${d}"]`).click());
      m().querySelector('#se-save').click();
      ok('all seven days saves as every day', !('sched' in habitCfg().find(h => h.key === 'read')));
      showSchedEditor('run'); handleBack();
      ok('back closes the editor', m().style.display === 'none' && _schedDraft === null);
      ok('Customize shows the schedule too', /data-sched-edit="run"/.test(cueInputHTML(habitCfg().find(h => h.key === 'run'))));
    } finally {
      window.todayStr = realToday; logDate = snapLog; draft = snapDraft;
      keys.forEach(k => { if (snap[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, snap[k]); });
      reloadCfg();
      const se = document.getElementById('sched-editor'); if (se) se.style.display = 'none';
    }
  })();

  // ---- v274: import days from a CSV (Daylio export or a spreadsheet) ----
  {
    const eSnap = localStorage.getItem('dp.entries'), hSnap = localStorage.getItem('dp.habitcfg');
    const spSnap = settingsPage, tSnap = window.toast;
    try {
      localStorage.setItem('dp.habitcfg', JSON.stringify([{ key: 'workout', emoji: '💪', label: 'Workout' }, { key: 'reading', emoji: '📖', label: 'Reading' }, { key: 'gym', emoji: '🏋️', label: 'Gym' }]));
      reloadCfg();
      const daylio = 'full_date,date,weekday,time,mood,activities,note_title,note\n' +
        '2026-11-20,Nov 20,Friday,21:10,rad,Workout | family,Great day,"Ran 5k<br>felt good"\n' +
        '2026-11-20,Nov 20,Friday,09:00,meh,reading,,\n' +
        '2026-11-19,Nov 19,Thursday,20:00,awful,,,"bad, sleep"\n' +
        '2026-11-18,Nov 18,Wednesday,20:00,ecstatic,walking,,\n' +
        'nope,,,,good,,,\n';
      const D = entriesFromCSV(daylio);
      ok('csv: a Daylio export is recognised', D.kind === 'daylio' && D.rows === 5 && D.bad === 1, D);
      const d20 = D.days['2026-11-20'] || {};
      ok('csv: two Daylio check-ins on one day average their mood (rad 9 + meh 5 → 7)', d20.mood === 7, d20);
      ok('csv: activities named like a habit tick it (any case)', d20.habits && d20.habits.workout === true && d20.habits.reading === true, d20.habits);
      ok('csv: note title, note (<br> → line break) and the other activities are kept', /Great day\nRan 5k\nfelt good/.test(d20.journal) && /Activities: family/.test(d20.journal), d20.journal);
      ok('csv: awful → 1, a quoted comma survives', D.days['2026-11-19'].mood === 1 && D.days['2026-11-19'].journal === 'bad, sleep', D.days['2026-11-19']);
      ok('csv: an unknown mood is left out and reported, the day still comes in', D.moodsUnknown.includes('ecstatic') && D.days['2026-11-18'].mood === undefined && /walking/.test(D.days['2026-11-18'].journal));
      ok('csv: matched and unmatched activities are listed', D.matched.Workout === 'workout' && D.matched.reading === 'reading' && D.unmatched.join() === 'family,walking', [D.matched, D.unmatched]);

      const sheet = 'date,mood,sleep,notes,Gym,energy\n2026-10-01,4,7:30,"hello, world",yes,8\n02/10/2026,2,6.5,,no,\n2026-10-03,,,,x,\n2026-13-01,3,,,,\n';
      const S = entriesFromCSV(sheet);
      ok('csv: a sheet is read by column name', S.kind === 'table' && ['mood', 'sleepHours', 'journal', 'energy', 'habit:gym'].every(c => S.cols.includes(c)), S.cols);
      ok('csv: a 1–5 mood scale is spread over 1–10 (4 → 8, 2 → 3)', S.days['2026-10-01'].mood === 8 && S.days['2026-10-02'].mood === 3, [S.days['2026-10-01'], S.days['2026-10-02']]);
      ok('csv: sleep as h:mm, energy, notes and a habit column', S.days['2026-10-01'].sleepHours === 7.5 && S.days['2026-10-01'].energy === 8 && S.days['2026-10-01'].journal === 'hello, world' && S.days['2026-10-01'].habits.gym === true);
      ok('csv: dd/mm dates, "no" does not tick, "x" does', S.days['2026-10-02'].sleepHours === 6.5 && !S.days['2026-10-02'].habits && S.days['2026-10-03'].habits.gym === true);
      ok('csv: an impossible date is skipped and counted', S.bad === 1 && !S.days['2026-13-01']);
      const own = entriesFromCSV('date,mood,energy,sleepHours,deepWorkHours,tasksDone,tasksPlanned,workoutsDone,workoutDetail,timeSummary,wentWell,improve,journal,tasks\n2026-09-01,7,6,8,3,1,2,,,,"a walk",less phone,day one,\n');
      const o1 = own.days['2026-09-01'] || {};
      ok('csv: Daylog\'s own CSV export comes back in (1–10 kept as is)', o1.mood === 7 && o1.energy === 6 && o1.sleepHours === 8 && o1.deepWorkHours === 3 && o1.wentWell === 'a walk' && o1.improve === 'less phone' && o1.journal === 'day one', o1);
      ok('csv: no date column is said plainly', /No date column/.test(entriesFromCSV('mood,note\n5,x\n').error || ''));
      ok('csv: a header with no rows is refused', !!entriesFromCSV('date,mood\n').error);
      ok('csv: dates with nothing usable are refused', /nothing Daylog can use/.test(entriesFromCSV('date,colour\n2026-01-01,blue\n').error || ''));
      // v280: every daily field, by key or label, lands in its own field
      const F = entriesFromCSV('date,mood,stress,Focus quality,weight,meditationMin,gratitude,income,tasksDone,Workout,workoutDetail,Sleep quality\n' +
        '2026-08-01,3,6.6,8,77.2,15,family,13500,4,yes,Push Up; Squat,11\n' +
        '2026-08-01,,2,,,,friends,,,,,\n' +
        '2026-08-02,4,0,,,,,,,,,7\n');
      const f1 = F.days['2026-08-01'] || {}, f2 = F.days['2026-08-02'] || {};
      ok('csv v280: deep fields by key and label (stress, Focus quality, weight, meditation, income, tasks)',
        f1.focus === 8 && f1.weight === 77.2 && f1.meditationMin === 15 && f1.income === 13500 && f1.tasksDone === 4, f1);
      ok('csv v280: a scale rounds to 1–10 and the later row wins; text rows join', f1.stress === 2 && f1.gratitude === 'family\nfriends', f1);
      ok('csv v280: a scale outside 1–10 is left out (11, 0)', f1.sleepQuality === undefined && f2.stress === undefined && f2.sleepQuality === 7, [f1, f2]);
      ok('csv v280: the 1–5 mood spread never touches other scales', f1.mood === 6 && f2.mood === 8 && f2.sleepQuality === 7, [f1.mood, f2.mood]);
      ok('csv v280: a column named like a habit still ticks the habit; workout details are text', f1.habits && f1.habits.workout === true && f1.workoutDetail === 'Push Up; Squat', f1);
      ok('csv v280: the columns used are listed with their labels', ['stress', 'focus', 'weight', 'gratitude', 'income', 'tasksDone', 'workoutDetail', 'sleepQuality'].every(c => F.cols.includes(c)) && F.labels.focus === 'Focus quality', [F.cols, F.labels]);
      {
        const eHere = localStorage.getItem('dp.entries');
        DB.saveEntries({ '2026-08-01': { mood: 5, stress: 9, habits: {}, updatedAt: '2026-08-01T10:00:00.000Z' } });
        const rr = csviApply(F.days), E8 = DB.entries()['2026-08-01'];
        ok('csv v280: fill-only for deep fields too: a logged stress stays, an empty weight fills and is stamped',
          rr.changed === 2 && E8.stress === 9 && E8.mood === 5 && E8.weight === 77.2 && +(E8.fieldAt || {}).weight > 0, E8);
        localStorage.setItem('dp.entries', eHere);
      }

      // applying: fill-only, stamped, idempotent, undoable
      DB.saveEntries({ '2026-11-20': { mood: 4, journal: '', habits: { reading: false }, updatedAt: '2026-11-20T10:00:00.000Z' }, '2026-11-19': { mood: 6, journal: 'mine', habits: {} , updatedAt: '2026-11-19T10:00:00.000Z' } });
      const plan = csviPlan(D.days, DB.entries());
      ok('csv: the plan counts new days and days that gain something', plan.add === 1 && plan.fill === 1 && plan.same === 1, plan);
      const r = csviApply(D.days), E = DB.entries();
      ok('csv: importing changes only days that gain something', r.changed === 2, r);
      ok('csv: a logged mood is never overwritten', E['2026-11-20'].mood === 4 && E['2026-11-19'].mood === 6);
      ok('csv: an empty note is filled', /Great day/.test(E['2026-11-20'].journal));
      ok('csv: a habit already set that day is left alone, a new one is added and stamped',
        E['2026-11-20'].habits.reading === false && E['2026-11-20'].habits.workout === true && +E['2026-11-20'].habitsAt.workout > 0);
      ok('csv: changed days get a new updatedAt and field stamps (so the sync keeps them)',
        E['2026-11-20'].updatedAt > '2026-11-21' && E['2026-11-20'].fieldAt && +E['2026-11-20'].fieldAt.journal > 0);
      ok('csv: a new day comes in whole', E['2026-11-18'] && /walking/.test(E['2026-11-18'].journal));
      ok('csv: a day with a note already keeps it', E['2026-11-19'].journal === 'mine');
      ok('csv: importing the same file again changes nothing', csviApply(D.days).changed === 0);

      // the card
      DB.saveEntries({ '2026-11-19': { mood: 6, journal: 'mine', habits: {} } });
      navigateTo('settings'); settingsPage = 'data'; renderSettings();
      const card = () => document.getElementById('s-settings').textContent;
      ok('csv: Backup & restore offers the import, and says Daylio', !!document.getElementById('csvi-pick') && /Moving from Daylio/.test(card()));
      _csvImp = Object.assign({ name: 'daylio_export.csv' }, D); renderSettings();
      ok('csv: the preview names the file and what will happen', /daylio_export\.csv · Daylio export/.test(card()) && /3 days/.test(card()) && /2 new · 1 already has all of this/.test(card()) && !/you already logged:/.test(card()), (card().match(/[^\n]*new[^\n]*/g) || []).join(' | '));
      ok('csv: …lists other activities and unknown moods', /Other activities \(2\)/.test(card()) && /ecstatic/.test(card()) && /1 row skipped/.test(card()));
      ok('csv: …with an Import button that counts only days that gain something', /Import 2 days/.test(document.getElementById('csvi-go').textContent));
      document.getElementById('csvi-go').click();
      ok('csv: Import writes the days and closes the preview', DB.entries()['2026-11-20'] && DB.entries()['2026-11-20'].mood === 7 && !_csvImp && !!document.getElementById('csvi-pick'));
      ok('csv: …and offers Undo', /Imported 2 days/.test(document.getElementById('toast').textContent) && !!document.querySelector('.toast-undo'));
      document.querySelector('.toast-undo').click();
      ok('csv: Undo puts the days back exactly', JSON.stringify(Object.keys(DB.entries())) === '["2026-11-19"]' && DB.entries()['2026-11-19'].journal === 'mine');
      _csvImp = { name: 'x.csv', error: 'No date column. The first row needs a column called "date".' }; renderSettings();
      ok('csv: a bad file says why and lets you pick again', /No date column/.test(card()) && !!document.getElementById('csvi-pick'));
      _csvImp = Object.assign({ name: 'again.csv' }, entriesFromCSV('date,mood\n2026-11-19,8\n')); renderSettings();
      ok('csv: a file with nothing new says so and cannot be imported', document.getElementById('csvi-go').disabled && /Nothing new to import/.test(document.getElementById('csvi-go').textContent));
      document.getElementById('csvi-cancel').click();
      ok('csv: Cancel drops the preview', !_csvImp && !document.getElementById('csvi-go'));
    } finally {
      _csvImp = null; window.toast = tSnap;
      if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
      if (hSnap != null) localStorage.setItem('dp.habitcfg', hSnap); else localStorage.removeItem('dp.habitcfg');
      reloadCfg(); settingsPage = spSnap; navigateTo('today');
    }
  }

  // ---- v275: a note on a habit, for one day ----
  {
    const eSnap = localStorage.getItem('dp.entries'), hSnap = localStorage.getItem('dp.habitcfg'), ldSnap = logDate, tSnap = window.toast;
    const toasts = []; window.toast = m => toasts.push(m);
    const T = todayStr(), Y = addDays(T, -1);
    const sheetOn = () => hnoteIsOpen() && !!document.getElementById('hn-text');
    try {
      localStorage.setItem('dp.habitcfg', JSON.stringify([{ key: 'workout', emoji: '💪', label: 'Workout' }, { key: 'reading', emoji: '📖', label: 'Reading' }]));
      DB.saveEntries({}); reloadCfg(); logDate = T; loadDraft(); navigateTo('today');
      hnoteOpen('workout', T);
      ok('hnote: the sheet opens empty for today, with no Delete', sheetOn() && document.getElementById('hn-text').value === '' && !document.getElementById('hn-del') && /Workout · today/.test(document.getElementById('hnote-sheet').textContent));
      document.getElementById('hn-text').value = '  legs, 45 min  '; document.getElementById('hn-save').click();
      const en = DB.entry(T) || {};
      ok('hnote: Save keeps the note on the day, trimmed', en.hnotes && en.hnotes.workout === 'legs, 45 min', en);
      ok('hnote: …without ticking the habit', hBase(en, 'workout') === H_MISS);
      ok('hnote: …says so and closes', !sheetOn() && toasts.includes('📝 Note saved'));
      ok('hnote: …and is stamped for the sync merge, per habit (v281)', en.hnotesAt && +en.hnotesAt.workout > 0 && !(en.fieldAt && en.fieldAt.hnotes) && !!en.updatedAt, en);
      ok('hnote: the Log draft has it, and the chip shows a dot', hnoteGet(draft, 'workout') === 'legs, 45 min' && document.querySelector('#s-today [data-habit="workout"]').classList.contains('has-note'));
      ok('hnote: the chip tells you to hold for a note', /hold for a note/.test(document.querySelector('#s-today [data-habit="reading"]').title));
      hnoteOpen('workout', T);
      ok('hnote: reopening shows the note and a Delete', document.getElementById('hn-text').value === 'legs, 45 min' && !!document.getElementById('hn-del'));
      handleBack();
      ok('hnote: Back closes the sheet', !hnoteIsOpen());
      ok('hnote: saving the same text changes nothing', hnoteSave('workout', T, 'legs, 45 min') === false);
      hnoteSave('workout', T, 'x'.repeat(400));
      ok('hnote: a note is capped at 300 characters', DB.entry(T).hnotes.workout.length === 300);
      hnoteSave('workout', T, '   ');
      ok('hnote: an empty note deletes it, and the empty map goes too', !('hnotes' in DB.entry(T)));
      hnoteSave('reading', Y, 'ch 3 <img src=x onerror=alert(1)>');
      ok('hnote: a note on another day makes that day, and leaves the Log alone', hnoteGet(DB.entry(Y), 'reading').indexOf('ch 3') === 0 && logDate === T);
      ok('hnote: the CSV line names the habit', hnoteLine(DB.entry(Y)) === 'Reading: ch 3 <img src=x onerror=alert(1)>');
      ok('hnote: the CSV export has a habitNotes column', /'habitNotes'/.test(exportCSV.toString()));
      navigateTo('habits');
      const card = [...document.querySelectorAll('#s-habits .card')].find(c => c.querySelector('[data-hnote-edit="reading"]'));
      ok('hnote: each Habits card has a Note button', !!card && /Note/.test(card.querySelector('[data-hnote-edit]').textContent));
      ok('hnote: …and lists the recent notes, escaped', !!card.querySelector('.hab-note') && /ch 3/.test(card.querySelector('.hab-notes').textContent) && !card.querySelector('.hab-notes img'));
      card.querySelector('[data-hnote-edit="reading"]').click();
      ok('hnote: Note on a Habits card writes today\'s note', sheetOn() && _hn.key === 'reading' && _hn.day === T);
      document.getElementById('hn-text').value = 'ch 4'; document.getElementById('hn-save').click();
      ok('hnote: …saved, and the card now says Today\'s note', hnoteGet(DB.entry(T), 'reading') === 'ch 4' && /Today's note/.test(document.querySelector('#s-habits [data-hnote-edit="reading"]').textContent));
      hnoteOpen('reading', T); document.getElementById('hn-del').click();
      ok('hnote: Delete removes it and says so', !hnoteGet(DB.entry(T), 'reading') && toasts.includes('Note deleted'));
      hnoteOpen('reading', T); document.getElementById('hn-cancel').click();
      ok('hnote: Cancel closes without saving', !hnoteIsOpen() && !hnoteGet(DB.entry(T), 'reading'));
      navigateTo('history'); histDayOpen(Y);
      const hv = document.getElementById('s-history');
      ok('hnote: History shows the day\'s habit notes, escaped', /Reading/.test(hv.querySelector('.hd-hnotes').textContent) && /ch 3/.test(hv.querySelector('.hd-hnotes').textContent) && !hv.querySelector('.hd-hnotes img'));
      try { histDayClose(); } catch (e) {}
    } finally {
      hnoteClose(); window.toast = tSnap;
      if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
      if (hSnap != null) localStorage.setItem('dp.habitcfg', hSnap); else localStorage.removeItem('dp.habitcfg');
      reloadCfg(); logDate = ldSnap; loadDraft(); navigateTo('today');
    }
  }

  // ---- v276: the week can start on Sunday ----
  {
    const sSnap = localStorage.getItem('dp.settings'), eSnap = localStorage.getItem('dp.entries'), hSnap = localStorage.getItem('dp.habitcfg');
    const tdSnap = todayStr, spSnap = settingsPage, tSnap = window.toast;
    const toasts = []; window.toast = m => toasts.push(m);
    try {
      const s0 = DB.settings(); delete s0.weekStart; DB.saveSettings(s0);
      ok('week: Monday first by default', weekFirst() === 1 && weekStart('2026-11-25') === '2026-11-23' && weekStart('2026-11-29') === '2026-11-23' && isWeekEnd('2026-11-29'));
      ok('week: Monday first, a Mon/Sun schedule reads Mon, Sun', schedLabel({ days: [0, 1] }) === 'Mon, Sun');
      navigateTo('settings'); settingsPage = null; renderSettings();
      ok('week: Settings offers the switch', /Week starts on/.test(document.getElementById('s-settings').textContent) && /Monday · tap to switch to Sunday/.test(document.getElementById('s-settings').textContent));
      document.getElementById('set-weekstart').click();
      ok('week: one tap switches to Sunday, saved, and says what follows', DB.settings().weekStart === 0 && weekFirst() === 0 && toasts.some(m => /start on Sunday/.test(m)) && /Sunday · tap to switch to Monday/.test(document.getElementById('s-settings').textContent));
      ok('week: Sunday first — a Wednesday\'s week starts the Sunday before', weekStart('2026-11-25') === '2026-11-22' && weekStart('2026-11-29') === '2026-11-29' && weekStart('2026-11-28') === '2026-11-22');
      ok('week: …Saturday ends it', isWeekEnd('2026-11-28') && !isWeekEnd('2026-11-29'));
      ok('week: …letters, order and index follow', weekLetters().join('') === 'SMTWTFS' && weekOrder()[0] === 0 && wdIndex('2026-11-22') === 0 && wdIndex('2026-11-28') === 6);
      ok('week: …a Mon/Sun schedule reads Sun, Mon', schedLabel({ days: [0, 1] }) === 'Sun, Mon');
      _schedDraft = { key: 'x', mode: 'week', days: [], week: 3 };
      localStorage.setItem('dp.habitcfg', JSON.stringify([{ key: 'x', emoji: '🏃', label: 'Run', sched: { week: 3 } }])); reloadCfg();
      renderSchedEditor();
      ok('week: …the schedule sheet says Sunday to Saturday', /from Sunday to Saturday/.test(document.getElementById('sched-editor').textContent) && /by Saturday/.test(document.getElementById('sched-editor').textContent));
      _schedDraft = Object.assign(_schedDraft, { mode: 'days', days: [1] }); renderSchedEditor();
      ok('week: …and lists Sunday first', document.querySelector('#sched-editor .sched-day').dataset.schedDay === '0');
      schedEditorClose();
      const E = { '2026-11-22': { habits: { x: true } }, '2026-11-23': { habits: { x: true } }, '2026-11-24': { habits: { x: true } } };
      ok('week: a times-a-week habit counts Sunday in the new week', habitWeek('x', weekStart('2026-11-24'), E).done === 3);
      todayStr = d => d ? tdSnap(d) : '2026-11-22';
      ok('week: Fresh start comes on a Sunday', (freshLandmark() || {}).kind === 'week');
      const recent = {}; [1, 2, 3, 4, 5, 6].forEach(k => recent[addDays('2026-11-28', -k)] = 6);
      ok('week: the week recap fires on Saturday', /Your week/.test((logReminderCopy('2026-11-28', { logDays: 200, recent }) || {}).t || ''));
      ok('week: project weeks start on Sunday', pjWeekStartDate(0).getDay() === 0);
      navigateTo('settings'); renderSettings(); document.getElementById('set-weekstart').click();
      ok('week: and back to Monday', DB.settings().weekStart === 1 && weekFirst() === 1 && weekStart('2026-11-25') === '2026-11-23');
      todayStr = d => d ? tdSnap(d) : '2026-11-22';
      ok('week: Monday first, a Sunday is not a fresh start', freshLandmark() === null);
      ok('week: Monday first, the recap is Sunday\'s', !/Your week/.test((logReminderCopy('2026-11-28', { logDays: 200, recent }) || {}).t || '') && /Your week/.test((logReminderCopy('2026-11-29', { logDays: 200, recent: Object.assign({ '2026-11-28': 7 }, recent) }) || {}).t || ''));
      ok('week: project weeks start on Monday', pjWeekStartDate(0).getDay() === 1);
    } finally {
      todayStr = tdSnap; window.toast = tSnap; try { schedEditorClose(); } catch (e) {}
      if (sSnap != null) localStorage.setItem('dp.settings', sSnap); else localStorage.removeItem('dp.settings');
      if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
      if (hSnap != null) localStorage.setItem('dp.habitcfg', hSnap); else localStorage.removeItem('dp.habitcfg');
      reloadCfg(); settingsPage = spSnap; navigateTo('today');
    }
  }

  // ---- v277: memories on a day's page and in "On this day" ----
  {
    const dSnap = localStorage.getItem('dp.docs'), eSnap = localStorage.getItem('dp.entries');
    const tdSnap = todayStr, ldSnap = logDate, cSnap = window.confirm, tSnap = window.toast;
    const ob = document.getElementById('onboard'), obOn = !!(ob && ob.classList.contains('on'));
    window.toast = () => {}; if (ob) ob.classList.remove('on');   // onboarding swallows Back
    try {
      todayStr = d => d ? tdSnap(d) : '2026-11-28';
      const M1 = { id: 'm277a', kind: 'memory', title: 'Lake walk', date: '2025-11-28', place: '', people: [], tags: [], blocks: [], created: '2025-11-28', updated: '2025-11-28T10:00:00Z' };
      const M2 = { id: 'm277b', kind: 'memory', title: 'Dinner with Asha', date: '2025-11-28', place: '', people: [], tags: [], blocks: [], created: '2025-11-28', updated: '2025-11-28T20:00:00Z' };
      const M3 = { id: 'm277c', kind: 'memory', title: 'Other day', date: '2025-11-20', place: '', people: [], tags: [], blocks: [], created: '2025-11-20', updated: '' };
      localStorage.setItem('dp.docs', JSON.stringify([M1, M2, M3]));
      localStorage.setItem('dp.entries', JSON.stringify({ '2026-11-21': { mood: 7, journal: 'A good week ago' } }));
      ok('memday: memsOn picks that day only, newest first', memsOn('2025-11-28').map(m => m.id).join() === 'm277b,m277a' && memsOn('2025-11-21').length === 0);
      // the day page
      show('today'); dayOpen('2025-11-28');
      const sh = document.getElementById('s-history');
      ok('memday: a day with only memories is not "nothing logged"', !/Nothing was logged on this day/.test(sh.textContent));
      ok('memday: the day page lists both, and they open from there', /Memories from this day/.test(sh.textContent) && sh.querySelectorAll('.hd-mems [data-hday-mem]').length === 2 && !sh.querySelector('.hd-mems [data-memopen]'));
      localStorage.setItem('dp.docs', JSON.stringify([M1, M3])); dayOpen('2025-11-28');
      ok('memday: one memory reads "A memory from this day"', /A memory from this day/.test(sh.textContent) && /Lake walk/.test(sh.textContent));
      localStorage.setItem('dp.docs', JSON.stringify([M1, M2, M3])); show('today'); dayOpen('2025-11-28');
      ok('memday: opened from the Log, the day page goes back to the Log', /← Log/.test(sh.querySelector('[data-hday-back]').textContent));
      sh.querySelector('[data-hday-mem="m277a"]').click();
      const sm = document.getElementById('s-memories');
      ok('memday: tapping a card opens that memory', sm.classList.contains('on') && curMem === 'm277a' && /Lake walk/.test(sm.textContent));
      ok('memday: its back button names the day', sm.querySelector('[data-mem-back]').textContent.trim() === '← ' + prettyDate('2025-11-28'));
      sm.querySelector('[data-mem-back]').click();
      ok('memday: back returns to the day page, not the memories list', sh.classList.contains('on') && histDay === '2025-11-28' && curMem === null && /Memories from this day/.test(sh.textContent));
      ok('memday: …and the day page still goes back to the Log', /← Log/.test(sh.querySelector('[data-hday-back]').textContent));
      sh.querySelector('[data-hday-mem="m277b"]').click();
      handleBack();
      ok('memday: the phone\'s Back does the same', sh.classList.contains('on') && histDay === '2025-11-28' && curMem === null);
      sh.querySelector('[data-hday-mem="m277b"]').click();
      sm.querySelector('[data-mem-edit]').click();
      handleBack();
      ok('memday: Back while editing first leaves edit mode', sm.classList.contains('on') && curMem === 'm277b' && !memEdit);
      handleBack();
      ok('memday: …then returns to the day', sh.classList.contains('on') && histDay === '2025-11-28');
      // leaving another way forgets the way back
      sh.querySelector('[data-hday-mem="m277a"]').click();
      show('today');
      ok('memday: going elsewhere forgets "back to the day"', _memFromDay === null);
      curMem = 'm277a'; memEdit = false; show('memories');
      ok('memday: …so the memory goes back to All memories again', sm.querySelector('[data-mem-back]').textContent.trim() === '← All memories');
      sm.querySelector('[data-mem-back]').click();
      ok('memday: the memories list still opens memories itself', new Set([...sm.querySelectorAll('[data-memopen]')].map(b => b.dataset.memopen)).size === 3 && ![...sm.querySelectorAll('.mem-card')].some(b => b.hasAttribute('1') || b.hasAttribute('2')));
      // delete from a page opened from the day
      show('today'); dayOpen('2025-11-28'); sh.querySelector('[data-hday-mem="m277b"]').click();
      window.confirm = () => true;
      sm.querySelector('[data-mem-del]') ? sm.querySelector('[data-mem-del]').click() : (sm.querySelector('[data-mem-edit]').click(), sm.querySelector('[data-mem-del]').click());
      ok('memday: deleting it returns to the day, which now lists one', sh.classList.contains('on') && memsOn('2025-11-28').length === 1 && /A memory from this day/.test(sh.textContent));
      // On this day on the Log
      localStorage.setItem('dp.docs', JSON.stringify([M1, M2, M3]));
      logDate = todayStr(); const tb = throwbackHTML(), box = document.createElement('div'); box.innerHTML = tb;
      const yr = box.querySelector('[data-throwback="2025-11-28"]');
      ok('memday: On this day shows a year ago for a day with only memories', !!yr && /A year ago/.test(yr.textContent));
      ok('memday: …with the memory\'s title and how many more', /Dinner with Asha/.test(yr.textContent) && /\+1/.test(yr.querySelector('.otd-mem').textContent));
      ok('memday: …and the week-ago entry still shows, without a memory line', !!box.querySelector('[data-throwback="2026-11-21"]') && !box.querySelector('[data-throwback="2026-11-21"] .otd-mem'));
      localStorage.setItem('dp.docs', JSON.stringify([M3])); box.innerHTML = throwbackHTML();
      ok('memday: no memory, no entry, no card', !box.querySelector('[data-throwback="2025-11-28"]'));
    } finally {
      if (obOn) ob.classList.add('on');
      todayStr = tdSnap; logDate = ldSnap; window.confirm = cSnap; window.toast = tSnap; _memFromDay = null; curMem = null; memEdit = false; histDay = null;
      if (dSnap != null) localStorage.setItem('dp.docs', dSnap); else localStorage.removeItem('dp.docs');
      if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
      navigateTo('today');
    }
  }

  // ---- v277: settings-like stores sync by their own change time (dp.cfgAt) ----
  {
    const keys = ['dp.habitcfg', 'dp.navcfg', 'dp.cfgAt', 'dp.touched', 'dp.settings'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const fSnap = window.fetch, sent = [], tSnap = window.toast;
    window.fetch = (u, o) => { try { sent.push(JSON.parse(o.body)); } catch (e) {} return Promise.resolve({ ok: true }); };
    window.toast = () => {};
    try {
      const st0 = DB.settings(); delete st0.syncUrl; DB.saveSettings(st0);
      localStorage.removeItem('dp.cfgAt');
      const base = habitCfg().map(h => Object.assign({}, h));
      saveHabitCfg(base.map((h, i) => i ? h : Object.assign({}, h, { label: 'Before link' })));
      ok('cfgAt: no sync link, no stamp (a new phone\'s choices never outrank the Sheet)', !('habitcfg' in listMeta('dp.cfgAt')));
      const st = DB.settings(); st.syncUrl = 'https://example.invalid/exec'; DB.saveSettings(st);
      const renamed = habitCfg().map((h, i) => i ? h : Object.assign({}, h, { label: 'Renamed here' }));
      saveHabitCfg(renamed);
      const ls = +listMeta('dp.cfgAt').habitcfg;
      ok('cfgAt: linked, a change is stamped', ls > 0 && Math.abs(ls - Date.now()) < 5000);
      localStorage.setItem('dp.cfgAt', JSON.stringify({ habitcfg: ls - 777 })); saveHabitCfg(renamed);
      ok('cfgAt: saving the same copy again keeps the stamp', +listMeta('dp.cfgAt').habitcfg === ls - 777);
      localStorage.setItem('dp.cfgAt', JSON.stringify({ habitcfg: ls }));
      // the bug: the other phone changed SOMETHING later (newer touched), its habit list earlier
      const older = base.map((h, i) => i ? h : Object.assign({}, h, { label: 'Old name' }));
      localStorage.setItem('dp.touched', String(ls + 10));
      sent.length = 0;
      applyRemoteState({ touched: ls + 60000, habitcfg: older, cfgAt: { habitcfg: ls - 60000 } });
      flushPush && flushPush();
      ok('cfgAt: a habit renamed here survives the other phone\'s later, unrelated change', habitCfg()[0].label === 'Renamed here');
      ok('cfgAt: …and this phone sends its newer copy back, with its stamp', sent.some(p => p.habitcfg && p.habitcfg[0].label === 'Renamed here' && +objOf(p.cfgAt).habitcfg === ls));
      // the other phone changed it later: taken, with its stamp
      const theirs = base.map((h, i) => i ? h : Object.assign({}, h, { label: 'Their newer name' }));
      applyRemoteState({ touched: ls + 90000, habitcfg: theirs, cfgAt: { habitcfg: ls + 80000 } });
      ok('cfgAt: a newer change on the other phone is taken', habitCfg()[0].label === 'Their newer name' && +listMeta('dp.cfgAt').habitcfg === ls + 80000);
      // a store the other phone never stamped (but this one did) stays
      localStorage.setItem('dp.cfgAt', JSON.stringify({ habitcfg: ls + 80000 }));
      applyRemoteState({ touched: ls + 99000, habitcfg: older, cfgAt: {} });
      ok('cfgAt: a stamped copy here beats an unstamped one from a newer app', habitCfg()[0].label === 'Their newer name');
      // an older app's state: no cfgAt at all
      localStorage.setItem('dp.touched', String(ls + 100000));
      applyRemoteState({ touched: ls + 120000, habitcfg: older });
      ok('cfgAt: an older app\'s copy saved after this phone\'s change is taken (the old rule)', habitCfg()[0].label === 'Old name');
      saveHabitCfg(renamed); const ls2 = +listMeta('dp.cfgAt').habitcfg;
      localStorage.setItem('dp.touched', String(ls2 - 50000));
      applyRemoteState({ touched: ls2 - 1000, habitcfg: older });
      ok('cfgAt: …but not one saved before this phone changed it', habitCfg()[0].label === 'Renamed here');
      // neither phone has stamped a store: the old whole-state rule
      localStorage.setItem('dp.cfgAt', '{}');
      const nav0 = navCfg(), navR = nav0.map((n, i) => i ? n : Object.assign({}, n, { label: 'Remote tab' }));
      localStorage.setItem('dp.touched', String(ls2));
      applyRemoteState({ touched: ls2 + 5000, navcfg: navR, cfgAt: {} });
      ok('cfgAt: unstamped on both sides, the phone that changed anything later still gives it', navCfg()[0].label === 'Remote tab');
      localStorage.setItem('dp.navcfg', JSON.stringify(nav0)); localStorage.setItem('dp.touched', String(ls2 + 99999));
      applyRemoteState({ touched: ls2 + 6000, navcfg: navR, cfgAt: {} });
      ok('cfgAt: …and an older one does not', navCfg()[0].label === nav0[0].label);
      // the push carries the stamps; a backup restore stamps what it changed at the backup's time
      sent.length = 0; pushState(true);
      ok('cfgAt: every push carries dp.cfgAt', sent.length && 'cfgAt' in sent[sent.length - 1]);
      ok('cfgAt: dp.cfgAt is per device, not in backups', BACKUP_EXCLUDED.includes('cfgAt'));
      localStorage.setItem('dp.cfgAt', JSON.stringify({ habitcfg: 5, navcfg: 7 }));
      const before = cfgRaw();
      localStorage.setItem('dp.habitcfg', JSON.stringify(older));
      cfgRestored(before, 1000);
      ok('cfgRestored: a store the restore changed is stamped at the backup\'s time; others keep theirs', listMeta('dp.cfgAt').habitcfg === 1000 && listMeta('dp.cfgAt').navcfg === 7);
      const before2 = cfgRaw(); localStorage.setItem('dp.habitcfg', JSON.stringify(renamed));
      cfgRestored(before2, 2000, { cfg: { habitcfg: 1500 } });
      ok('cfgRestored: …at the time it last changed in the backup, when the file says', listMeta('dp.cfgAt').habitcfg === 1500);
      const before3 = cfgRaw(); localStorage.setItem('dp.habitcfg', JSON.stringify(older));
      cfgRestored(before3, 2000, { cfg: { habitcfg: 9e15 } });
      ok('cfgRestored: …never later than the backup itself', listMeta('dp.cfgAt').habitcfg === 2000);
    } finally {
      window.fetch = fSnap; window.toast = tSnap;
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      reloadCfg(); renderNav();
    }
  }

  // ---- v279: one cached date formatter per option set (History was slow with years of data) ----
  {
    const OPTS = [{ weekday: 'short', month: 'short', day: 'numeric' }, { month: 'short', day: 'numeric', year: 'numeric' }, { month: 'short', day: 'numeric' },
      { month: 'long', year: 'numeric' }, { month: 'long' }, { day: 'numeric', month: 'long', year: 'numeric' }, { weekday: 'long' }, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
      { day: 'numeric', month: 'short', year: 'numeric' }, { weekday: 'short' }, { month: 'short', day: 'numeric', year: undefined }];
    let bad = 0, n = 0;
    for (let i = 0; i < 800; i += 7) {
      const d = new Date(new Date('2024-01-01T00:00:00').getTime() + i * 864e5 + (i % 3) * 36e5);
      OPTS.forEach(o => { n++; if (fmtDate(d, o) !== d.toLocaleDateString(undefined, o)) bad++; if (fmtDate(d, o, 'en') !== d.toLocaleDateString('en', o)) bad++; });
    }
    ok('fmtDate: the same text as toLocaleDateString, ' + n * 2 + ' dates × options', bad === 0, bad);
    ok('fmtDate: an invalid date still reads "Invalid Date", never throws', fmtDate(new Date('x'), OPTS[0]) === new Date('x').toLocaleDateString(undefined, OPTS[0]) && prettyDate('not a day') === new Date('not a dayT00:00:00').toLocaleDateString(undefined, OPTS[0]));
    ok('fmtDate: not a Date at all is handled the same way', fmtDate(null, OPTS[0]) === new Date(NaN).toLocaleDateString(undefined, OPTS[0]));
    ok('fmtDate: prettyDate / shortDate / longDate unchanged', prettyDate('2026-11-28') === new Date('2026-11-28T00:00:00').toLocaleDateString(undefined, OPTS[0])
      && longDate('2026-11-28') === new Date('2026-11-28T12:00:00').toLocaleDateString(undefined, OPTS[5]) && weekdayLong('2026-11-28') === new Date('2026-11-28T12:00:00').toLocaleDateString(undefined, OPTS[6]));
    ok('fmtDate: one formatter per option set, reused', (() => { const k = _dtf.size; prettyDate('2026-01-01'); prettyDate('2026-01-02'); return _dtf.size === k; })());
  }

  // ---- v279: the faster week streak and gap model give the same answers as before ----
  {
    const tlSnap = localStorage.getItem('dp.timelog'), tdSnap = todayStr;
    try {
      // the old weekStreak: bucket every logged day, then walk the buckets
      const oldWeekStreak = e => {
        const map = {}; weekBuckets(e).forEach(b => { map[b.start] = b; });
        const thisW = weekStart(todayStr()), cur = map[thisW] || { start: thisW, days: 0, ok: false };
        let n = 0, w = addDays(thisW, -7); while (map[w] && map[w].ok) { n++; w = addDays(w, -7); }
        return { streak: n, current: cur, live: n + (cur.ok ? 1 : 0), min: WEEK_MIN, weekStart: thisW };
      };
      let s32 = 7; const rnd = () => { s32 = (s32 * 1103515245 + 12345) & 0x7fffffff; return s32 / 0x7fffffff; };
      let bad = 0, runs = 0, longest = 0;
      for (let r = 0; r < 60; r++) {
        const e = {}, dens = 0.3 + rnd() * 0.7, span = 20 + Math.floor(rnd() * 400);
        for (let i = 0; i < span; i++) { if (rnd() < dens) e[addDays(tdSnap(), -i)] = rnd() < 0.1 ? { habits: {} } : { mood: 1 + Math.floor(rnd() * 10) }; }
        if (rnd() < 0.2) e[''] = { mood: 5 };
        const a = JSON.stringify(weekStreak(e)), b = JSON.stringify(oldWeekStreak(e)); runs++; if (a !== b) bad++;
        longest = Math.max(longest, weekStreak(e).streak);
      }
      ok('perf: weekStreak walks back and gives what bucketing gave, ' + runs + ' random logs (longest ' + longest + ' weeks)', bad === 0 && longest > 3, bad);
      // the old gap model: every block, every day of the look-back
      const oldGapModel = dateStr => {
        const blank = () => ({ mins: Array.from({ length: GAP_SLOTS }, () => ({})), days: Array.from({ length: GAP_SLOTS }, () => ({})), sample: Array.from({ length: GAP_SLOTS }, () => ({})) });
        const same = blank(), all = blank(), wantWeekend = gapIsWeekend(dateStr), log = DB.timelog().filter(s => s.end != null);
        for (let i = 1; i <= GAP_LOOKBACK; i++) {
          const ds = addDays(dateStr, -i), b0 = dayStartMs(ds), b1 = dayEndMs(ds), targets = gapIsWeekend(ds) === wantWeekend ? [all, same] : [all];
          log.forEach(s => { const a = Math.max(s.start, b0), b = Math.min(s.end, b1); if (b <= a) return;
            const k0 = Math.floor((a - b0) / GAP_SLOT_MS), k1 = Math.ceil((b - b0) / GAP_SLOT_MS);
            for (let k = k0; k < k1 && k < GAP_SLOTS; k++) { const ka = b0 + k * GAP_SLOT_MS, ov = Math.min(b, ka + GAP_SLOT_MS) - Math.max(a, ka); if (ov <= 0) continue;
              targets.forEach(m => { m.mins[k][s.act] = (m.mins[k][s.act] || 0) + ov; (m.days[k][s.act] = m.days[k][s.act] || {})[ds] = 1; m.sample[k][ds] = 1; }); } });
        }
        return { same, all, wantWeekend };
      };
      const oldHist = dateStr => { const log = DB.timelog().filter(s => s.end != null); if (!log.length) return 0; const days = {};
        for (let i = 1; i <= GAP_LOOKBACK; i++) { const ds = addDays(dateStr, -i), b0 = dayStartMs(ds), b1 = dayEndMs(ds); if (log.some(s => s.end > b0 && s.start < b1)) days[ds] = 1; }
        return Object.keys(days).length; };
      const T = tdSnap(), TL = [];
      for (let i = 0; i < 160; i += 1 + Math.floor(rnd() * 2)) {
        const d0 = dayStartMs(addDays(T, -i));
        TL.push({ id: 'g' + i + 'a', act: 'work', start: d0 + 9 * 36e5, end: d0 + 12.5 * 36e5, upd: 1 });
        TL.push({ id: 'g' + i + 'b', act: 'sleep', start: d0 + 22.5 * 36e5, end: d0 + 31 * 36e5, upd: 1 });   // across midnight
        if (i % 5 === 0) TL.push({ id: 'g' + i + 'c', act: 'learn', start: d0 - 40 * 36e5, end: d0 + 2 * 36e5, upd: 1 });   // two days long
      }
      TL.push({ id: 'run', act: 'work', start: Date.now() - 36e5, end: null, upd: 1 });
      localStorage.setItem('dp.timelog', JSON.stringify(TL));
      const same = [T, addDays(T, -3), addDays(T, -40), addDays(T, -95)].every(d => canonJSON(gapModel(d)) === canonJSON(oldGapModel(d)) && gapHistoryDays(d) === oldHist(d));
      ok('perf: the gap model reads only its window and finds the same gaps', same && gapHistoryDays(T) > 40);
      localStorage.setItem('dp.timelog', '[]');
      ok('perf: no blocks, no history', gapHistoryDays(T) === 0 && oldHist(T) === 0);
    } finally {
      if (tlSnap != null) localStorage.setItem('dp.timelog', tlSnap); else localStorage.removeItem('dp.timelog');
    }
  }

  // ---- v281: streak answers are kept until the entries, the day or the week start change ----
  {
    const eSnap = localStorage.getItem('dp.entries'), sSnap = localStorage.getItem('dp.settings');
    try {
      const t = todayStr(), e0 = {};
      for (let i = 1; i <= 20; i++) e0[addDays(t, -i)] = { mood: 6, journal: 'x' };
      DB.saveEntries(e0);
      const a = weekStreak(), b = weekStreak();
      ok('v281 weekStreak: a second call returns the kept answer, equal to a fresh walk', a === b && JSON.stringify(a) === JSON.stringify(weekStreakOf(DB.entriesRO())));
      ok('v281 loggedStreak counts back from yesterday', loggedStreak() === 20, loggedStreak());
      const e1 = DB.entries(); e1[t] = { mood: 7, journal: 'today' }; DB.saveEntries(e1);
      ok('v281 loggedStreak: saving today is seen at once', loggedStreak() === 21, loggedStreak());
      const e2 = DB.entries(); delete e2[addDays(t, -3)]; DB.saveEntries(e2);
      ok('v281 loggedStreak: a removed day breaks the run at once', loggedStreak() === 3, loggedStreak());
      ok('v281 weekStreak: matches a fresh walk after the entries change', JSON.stringify(weekStreak()) === JSON.stringify(weekStreakOf(DB.entriesRO())));
      const st = DB.settings(), w1 = weekStreak().weekStart; st.weekStart = st.weekStart === 0 ? 1 : 0; DB.saveSettings(st);
      const w2 = weekStreak().weekStart;
      ok('v281 weekStreak: changing the week start is seen at once', w1 !== w2 && w2 === weekStart(t), [w1, w2]);
    } finally {
      if (eSnap == null) localStorage.removeItem('dp.entries'); else localStorage.setItem('dp.entries', eSnap);
      if (sSnap == null) localStorage.removeItem('dp.settings'); else localStorage.setItem('dp.settings', sSnap);
      try { reloadCfg(); } catch (e) {}
    }
  }

  // ---- v281: Your year ----
  {
    const eSnap = localStorage.getItem('dp.entries'), hSnap = localStorage.getItem('dp.habitcfg'), seenSnap = localStorage.getItem('dp.yrSeen');
    try {
      localStorage.setItem('dp.habitcfg', JSON.stringify([{ key: 'workout', emoji: '💪', label: 'Workout' }, { key: 'reading', emoji: '📖', label: 'Reading' }]));
      reloadCfg();
      const e = {};
      // 2024: 20 days logged in March; 2025: Jan 1–30 in a row, plus 10 days in June
      for (let i = 1; i <= 20; i++) e['2024-03-' + String(i).padStart(2, '0')] = { mood: 5, journal: 'old year', sleepHours: 7 };
      for (let i = 1; i <= 30; i++) e['2025-01-' + String(i).padStart(2, '0')] = { mood: 4, journal: 'cold #work day', habits: { workout: true }, sleepHours: 6 };
      for (let i = 1; i <= 10; i++) e['2025-06-' + String(i).padStart(2, '0')] = { mood: 8, journal: 'summer #work #trip', habits: { reading: true }, sleepHours: 8 };
      e['2025-06-05'] = { mood: 9, journal: 'The best day of the year, by far.\n\nFrom my old sheets:\n- Food: dosa', habits: { reading: true } };
      e['2025-09-01'] = { mood: 9, journal: 'short' };   // same top mood, fewer own words
      e['2023-05-01'] = { mood: 6, journal: 'too few days for a year' };
      DB.saveEntries(e);
      ok('yr: only years with 14+ days logged by hand are offered, newest first', JSON.stringify(yrYears()) === '["2025","2024"]', yrYears());
      const r = yearReview('2025');
      ok('yr: days logged, coverage and the longest run inside the year', r.logged === 41 && r.best === 30 && r.coverage === Math.round(41 / 365 * 100) && !r.partial, r);
      ok('yr: months carry their mood average; best and hardest month need 3 rated days', r.months[0].mood === 4 && r.months[5].logged === 10 && r.bestM.m === 6 && r.worstM.m === 1, [r.months[0], r.bestM, r.worstM]);
      ok('yr: habits ranked by days done', r.habitRows[0].key === 'workout' && r.habitRows[0].done === 30 && r.habitRows[1].done === 10, r.habitRows);
      ok('yr: top tags counted per day', r.topTags[0].t === '#work' && r.topTags[0].n === 39 && r.topTags[1].t === '#trip', r.topTags);
      ok('yr: the best day is the top mood with the most of your own words, quoted without the imported block', r.bestDay === '2025-06-05' && /best day of the year/.test(r.quote) && !/old sheets|dosa/.test(r.quote), [r.bestDay, r.quote]);
      const cards = yrCards(r, yearReview('2024'));
      ok('yr: six cards, ending with the year before', cards.length === 6 && cards[0].t === 'Your 2025' && cards[5].t === 'vs 2024' && /20 → <b>41<\/b>/.test(cards[5].body), cards.map(c => c.t));
      ok('yr: a year with too little before it has no comparison card', yrCards(yearReview('2024'), null).every(c => !/^vs /.test(c.t)));
      yrOpen('2025');
      const deck = () => document.getElementById('yrdeck');
      ok('yr: the deck opens on the first card and remembers the year as seen', deck().classList.contains('on') && /Your 2025/.test(deck().textContent) && localStorage.getItem('dp.yrSeen') === '2025');
      deck().querySelector('[data-yr-step="1"]').click();
      ok('yr: Next goes to month by month', /Month by month/.test(deck().textContent) && deck().querySelectorAll('.yr-m').length === 12);
      deck().querySelector('[data-yr-go="2024"]').click();
      ok('yr: the arrow moves to the earlier year, back on card one', /Your 2024/.test(deck().textContent));
      document.getElementById('yr-close').click();
      ok('yr: close hides it', !deck().classList.contains('on'));
      ok('yr: Stats offers the newest year', /Your 20(25|26)/.test(yearCardHTML()) || /Your 2025/.test(yearCardHTML()), yearCardHTML().slice(0, 200));
    } finally {
      [['dp.entries', eSnap], ['dp.habitcfg', hSnap], ['dp.yrSeen', seenSnap]].forEach(([k, v]) => { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); });
      try { reloadCfg(); } catch (e) {}
      const d = document.getElementById('yrdeck'); if (d) d.remove();
    }
  }

  // ---- v281: audit fixes (CSV import, settings stamps, lock clock, weekly memo) ----
  {
    const eSnap = localStorage.getItem('dp.entries'), hSnap = localStorage.getItem('dp.habitcfg'), sSnap = localStorage.getItem('dp.settings'), aSnap = localStorage.getItem('dp.cfgAt');
    try {
      const T = entriesFromCSV('date,notes,income,sleep\n2026-07-01,"sleep <6h, mood >7 today",1234,7\n2026-07-02,A <- B -> C &amp; D,"10,000","7,5"\n');
      ok('v281 csv: a sheet keeps text between < and >, and &amp; as written', T.days['2026-07-01'].journal === 'sleep <6h, mood >7 today' && T.days['2026-07-02'].journal === 'A <- B -> C &amp; D', T.days);
      ok('v281 csv: thousands separators are thousands, a decimal comma is still a decimal', T.days['2026-07-02'].income === 10000 && T.days['2026-07-01'].income === 1234 && T.days['2026-07-02'].sleepHours === 7.5, T.days['2026-07-02']);
      const Dl = entriesFromCSV('full_date,date,weekday,time,mood,activities,note_title,note\n2026-07-03,Jul 3,Friday,21:10,good,,,"a<br>b &amp; c"\n');
      ok('v281 csv: a Daylio note still turns <br> into a line and decodes &amp;', Dl.days['2026-07-03'].journal === 'a\nb & c', Dl.days['2026-07-03']);
      const US = entriesFromCSV('date,mood\n11/20/2026,7\n11/05/2026,6\n');
      ok('v281 csv: a second part above 12 makes the whole file month/day', US.dateOrder === 'mdy' && US.days['2026-11-20'] && US.days['2026-11-05'] && !US.days['2026-05-11'] && US.bad === 0, Object.keys(US.days));
      const EU = entriesFromCSV('date,mood\n20/11/2026,7\n05/11/2026,6\n');
      ok('v281 csv: a first part above 12 makes it day/month', EU.dateOrder === 'dmy' && EU.days['2026-11-05'] && !EU.dateAsk, Object.keys(EU.days));
      const AMB = entriesFromCSV('date,mood\n05/11/2026,7\n');
      ok('v281 csv: an ambiguous file reads day/month and asks', AMB.dateAsk && AMB.days['2026-11-05'], AMB);
      const AMB2 = entriesFromCSV('date,mood\n05/11/2026,7\n', { order: 'mdy' });
      ok('v281 csv: …and month/day when switched', AMB2.days['2026-05-11'] && AMB2.dateOrder === 'mdy' && AMB2.dateAsk, Object.keys(AMB2.days));
      const LOW = entriesFromCSV('date,mood\n2026-07-01,3\n2026-07-02,5\n');
      ok('v281 csv: an all-1-to-5 mood column is spread, and says so', LOW.canSpread && LOW.fiveScale && LOW.days['2026-07-02'].mood === 10, LOW);
      const LOW2 = entriesFromCSV('date,mood\n2026-07-01,3\n2026-07-02,5\n', { noSpread: true });
      ok('v281 csv: …and kept as written when switched off', !LOW2.fiveScale && LOW2.days['2026-07-02'].mood === 5 && LOW2.days['2026-07-01'].mood === 3, LOW2.days);
      navigateTo('settings'); settingsPage = 'data';
      _csvImp = Object.assign({ name: 'low.csv', text: 'date,mood\n2026-07-01,3\n2026-07-02,5\n', opts: {} }, LOW); renderSettings();
      const sw = document.querySelector('[data-csvi-opt="noSpread"]');
      ok('v281 csv: the preview names the 1–5 reading with a switch', !!sw && /read as a 1–5 scale/.test(document.getElementById('s-settings').textContent));
      sw.click();
      ok('v281 csv: the switch re-reads the file out of 10', _csvImp && _csvImp.days['2026-07-02'].mood === 5 && !!document.querySelector('[data-csvi-opt="spread"]'), _csvImp && _csvImp.days);
      _csvImp = null; renderSettings();

      // settings stamps never go backwards on a phone whose clock runs behind
      const st = DB.settings(); st.syncUrl = 'https://example.invalid/exec'; DB.saveSettings(st);
      const future = Date.now() + 60000; localStorage.setItem('dp.cfgAt', JSON.stringify({ habitcfg: future }));
      const hc = habitCfg(); hc[0] = Object.assign({}, hc[0], { label: (hc[0].label || 'x') + ' renamed' }); saveHabitCfg(hc);
      ok('v281 cfgSave: a stamp is max(now, last + 1)', +listMeta('dp.cfgAt').habitcfg === future + 1, listMeta('dp.cfgAt'));

      // weekly counts follow a goal added to the habit
      localStorage.setItem('dp.habitcfg', JSON.stringify([{ key: 'water', emoji: '💧', label: 'Water' }])); reloadCfg();
      const wsk = weekStart(todayStr()), ew = {}; ew[wsk] = { habits: { water: 3 } }; ew[addDays(wsk, 1)] = { habits: { water: 3 } }; DB.saveEntries(ew);
      const wBefore = habitWeek('water', wsk).done;
      saveHabitCfg([{ key: 'water', emoji: '💧', label: 'Water', goal: { n: 8, cmp: 'atleast', unit: 'glasses' } }]);
      const wAfter = habitWeek('water', wsk).done;
      ok('v281 habitWeek: adding a goal is counted at once, not after the next save', wBefore === 2 && wAfter === 0, [wBefore, wAfter]);

      // the lock: a clock set back while away asks for the PIN
      const oOn = window.lockOn, oShow = window.lockShow, oHide = window.lockHide; let shown = '', hid = 0;
      try {
        window.lockOn = () => true; window.lockShow = m => { shown = m; }; window.lockHide = () => { hid++; };
        _lk = { mode: 'unlock', soft: true }; _lockAway = Date.now() + 3600000; lockBack();
        ok('v281 lock: coming back to a clock earlier than when it left does not skip the PIN', hid === 0 && _lk.soft === false, [hid, _lk]);
        _lk = { mode: 'none' }; _lockAway = Date.now() + 3600000; shown = ''; lockBack();
        ok('v281 lock: …and shows the keypad when it was closed', shown === 'unlock', shown);
        _lk = { mode: 'unlock', soft: true }; _lockAway = Date.now() - 1000; hid = 0; lockBack();
        ok('v281 lock: a short real absence still opens without the PIN', hid === 1, hid);
      } finally { window.lockOn = oOn; window.lockShow = oShow; window.lockHide = oHide; _lk = null; _lockAway = 0; try { lockRender && 0; } catch (e) {} }
    } finally {
      [['dp.entries', eSnap], ['dp.habitcfg', hSnap], ['dp.settings', sSnap], ['dp.cfgAt', aSnap]].forEach(([k, v]) => { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); });
      try { reloadCfg(); } catch (e) {}
    }
  }

  // ---- v281: habit notes merge per habit ----
  {
    const now0 = Date.now();
    const st1 = entryFieldStamp({ hnotes: { workout: 'legs' }, updatedAt: '2026-01-01T00:00:00.000Z' }, { hnotes: { workout: 'legs', reading: 'ch 4' }, updatedAt: new Date().toISOString() });
    ok('hnotes: a new note is stamped now, an untouched one keeps the old stand-in', +st1.hnotesAt.reading >= now0 && st1.hnotesAt.workout === Date.parse('2026-01-01T00:00:00.000Z') && !(st1.fieldAt || {}).hnotes, st1);
    const A = { hnotes: { workout: 'legs' }, hnotesAt: { workout: 100 }, updatedAt: '2026-01-02T00:00:00.000Z' };
    const B = { hnotes: { meditation: 'calm' }, hnotesAt: { meditation: 200 }, updatedAt: '2026-01-01T00:00:00.000Z' };
    const m1 = mergeHnotes(A, B, {});
    ok('hnotes: two phones noting two habits keep both', m1.hnotes.workout === 'legs' && m1.hnotes.meditation === 'calm' && m1.hnotesAt.workout === 100 && m1.hnotesAt.meditation === 200, m1);
    const C = { hnotesAt: { workout: 300 }, updatedAt: '2026-01-03T00:00:00.000Z' };
    const m2 = mergeHnotes(A, C, {});
    ok('hnotes: a newer removal removes', !m2.hnotes && m2.hnotesAt.workout === 300, m2);
    const D = { hnotes: { workout: 'old text' }, fieldAt: { hnotes: 150 }, updatedAt: '2026-01-01T00:00:00.000Z' };
    const E2 = { hnotes: { workout: 'new text' }, hnotesAt: { workout: 200 }, updatedAt: '2026-01-01T00:00:00.000Z' };
    ok('hnotes: a copy from before the stamps uses its fieldAt.hnotes', mergeHnotes(D, E2, {}).hnotes.workout === 'new text' && mergeHnotes(E2, D, {}).hnotes.workout === 'new text');
    const T1 = { hnotes: { workout: 'a' }, hnotesAt: { workout: 50 } }, T2 = { hnotes: { workout: 'b' }, hnotesAt: { workout: 50 } };
    ok('hnotes: two notes under one stamp pick the same on both phones', mergeHnotes(T1, T2, {}).hnotes.workout === mergeHnotes(T2, T1, {}).hnotes.workout);
  }

  // ---- v281: Year in pixels moves between years ----
  {
    const eSnap = localStorage.getItem('dp.entries');
    try {
      const e = {}; for (let i = 1; i <= 15; i++) e['2024-02-' + String(i).padStart(2, '0')] = { mood: 6 };
      DB.saveEntries(e); ypYear = null;
      const cur = new Date().getFullYear();
      ok('yp: the years with a mood, and this one', JSON.stringify(ypYears()) === JSON.stringify([2024, cur]), ypYears());
      const host = document.createElement('div'); host.innerHTML = yearPixelsHTML(); document.body.appendChild(host);
      const back = host.querySelector('[data-yp-year="2024"]');
      ok('yp: this year offers ‹ to 2024', !!back && /in pixels/.test(host.textContent));
      back.click();
      ok('yp: ‹ shows 2024 with its days', /2024 in pixels/.test(host.textContent) && /15 days/.test(host.textContent) && ypYear === 2024, host.textContent.slice(0, 120));
      host.remove(); ypYear = null;
    } finally { if (eSnap == null) localStorage.removeItem('dp.entries'); else localStorage.setItem('dp.entries', eSnap); }
  }

  // ---- Custom goals ----
  const gSnapG = localStorage.getItem('dp.goals'), gSnapE2 = localStorage.getItem('dp.entries');
  ok('goals join BACKUP_KEYS', BACKUP_KEYS.includes('goals'));
  ok('goals reach the sync payload', /goals: DBgoals\(\)/.test(pushState.toString()));
  ok('goals sync item by item', LIST_SYNC.includes('goals') && /listSave\('dp\.goals'/.test(saveGoals.toString()));
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
    /* Every switch says it is a switch, whether it is on, and what it switches. */
    settingsPage = 'tracking'; renderSettings();
    const togs = [...document.querySelectorAll('#s-settings .at-tog')];
    ok('settings switches are announced as switches with a state and a name', togs.length > 3 && togs.every(t =>
      t.getAttribute('role') === 'switch' && /^(true|false)$/.test(t.getAttribute('aria-checked') || '') && (t.getAttribute('aria-label') || '').length > 1),
      togs.map(t => t.outerHTML.slice(0, 90)));
    settingsPage = 'widgets'; renderSettings();
    const st0 = document.querySelector('#s-settings [data-sec-toggle]');
    const was = st0.getAttribute('aria-checked'); st0.click();
    const st1 = document.querySelector('#s-settings [data-sec-toggle="' + st0.dataset.secToggle + '"]');
    ok('flipping a switch flips its announced state', st1.getAttribute('aria-checked') !== was);
    st1.click();
    const nudgeRow = document.querySelector('#s-settings [data-widget-toggle="dp.nudgeOff"]');
    ok('Settings ▸ widgets names the come-back nudges honestly', !!nudgeRow &&
       /Come-back nudges/.test(nudgeRow.closest('.at-row').textContent) && /none after 30 days/.test(nudgeRow.closest('.at-row').textContent) &&
       !/nothing else ever/.test(document.getElementById('s-settings').textContent));
    settingsPage = null; renderSettings();
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

  // ---- Money's record form on top with an honest category; Ask says what it left out ----
  (function () {
    const keys = ['dp.finaccts', 'dp.fintx', 'dp.fincats'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const tSnap = window.toast; window.toast = () => {};
    const prev = { tab: mnTab, open: mnAddOpen, ym: mnYm, log: askLog.slice() };
    try {
      const T = todayStr(), ym = finYm(T), [y, mo] = ym.split('-').map(Number);
      const lastYm = finYm(todayStr(new Date(y, mo - 2, 1)));
      localStorage.removeItem('dp.fincats');
      localStorage.setItem('dp.finaccts', JSON.stringify([{ id: 'bk', name: 'Bank', kind: 'bank', opening: 0, since: addDays(T, -90) }]));
      localStorage.setItem('dp.fintx', '[]');
      ok('with no history a new record starts on "Other", not on Food & dining', mnDefaultCat('out') === 'otherout' && mnDefaultCat('in') === 'otherin');
      localStorage.setItem('dp.fintx', JSON.stringify([
        { id: 'f1', d: ym + '-01', a: 850000, dir: 'in', ac: 'bk', c: 'salary', n: 'Salary' },
        { id: 'f2', d: ym + '-01', a: 64900, dir: 'out', ac: 'bk', c: 'subs', n: 'Netflix' },
        { id: 'f3', d: ym + '-01', a: 340000, dir: 'out', ac: 'bk', c: 'grocery', n: 'Big basket' },
        { id: 'f4', d: lastYm + '-15', a: 11900, dir: 'out', ac: 'bk', c: 'subs', n: 'Spotify' },
        { id: 'f5', d: ym + '-01', a: 25000, dir: 'out', ac: 'bk', c: 'food', n: 'Chai Point' },
        { id: 'f6', d: ym + '-01', a: 30000, dir: 'out', ac: 'bk', c: 'health', n: 'Apollo' },
      ]));
      ok('…and then on the category used last, in that direction', mnDefaultCat('out') === 'health' && mnDefaultCat('in') === 'salary');
      ok('a note suggests its category: a known name', finGuessCat('Netflix', 'out') === 'subs' && finGuessCat('uber to airport', 'out') === 'transport');
      ok('…a category the note names', finGuessCat('groceries', 'out') === 'grocery' && finGuessCat('Electricity bill', 'out') === 'home');
      ok('…what the same note got last time', finGuessCat('chai point', 'out') === 'food');
      ok('…in the right direction only, and nothing rather than a guess', finGuessCat('Netflix', 'in') === null && finGuessCat('money for mum', 'out') === null && finGuessCat('qwerty', 'out') === null);
      const fx = localStorage.getItem('dp.fintx');
      localStorage.setItem('dp.fintx', JSON.stringify([{ id: 'g1', d: ym + '-01', a: 100, dir: 'out', ac: 'bk', c: 'food', n: 'Netflix' },
        { id: 'g2', d: ym + '-01', a: 100, dir: 'out', ac: 'bk', c: 'fun', n: 'Swiggy' }]));
      ok('…a past "Food & dining" (what the picker used to open on) does not outvote a name that says otherwise', finGuessCat('netflix', 'out') === 'subs');
      ok('…but any other past choice does', finGuessCat('swiggy', 'out') === 'fun');
      localStorage.setItem('dp.fintx', fx);
      // the screen
      mnTab = 'over'; mnAddOpen = false; mnYm = null; renderMoney();
      const el = document.getElementById('s-money');
      ok('Overview: "Record money in or out" comes first, above net worth and the charts',
        !!(document.getElementById('mn-add-open').compareDocumentPosition(el.querySelector('.mn-worth')) & Node.DOCUMENT_POSITION_FOLLOWING));
      mnTab = 'tx'; renderMoney();
      ok('…and first on Money in/out', !!(document.getElementById('mn-add-open').compareDocumentPosition(el.querySelector('.mn-mhead')) & Node.DOCUMENT_POSITION_FOLLOWING));
      mnTab = 'over'; mnAddOpen = 'out'; renderMoney();
      const cat = () => document.getElementById('mn-cat'), note = document.getElementById('mn-note');
      ok('the form opens at the top, on the last category used', !!(cat().compareDocumentPosition(el.querySelector('.mn-worth')) & Node.DOCUMENT_POSITION_FOLLOWING) && cat().value === 'health', cat().value);
      note.value = 'Netflix'; note.dispatchEvent(new Event('input', { bubbles: true }));
      ok('typing the note picks its category, and says so', cat().value === 'subs' && /note/.test(document.getElementById('mn-cat-why').textContent));
      note.value = 'zzz'; note.dispatchEvent(new Event('input', { bubbles: true }));
      ok('…and drops the guess when the note stops matching', cat().value === 'health' && document.getElementById('mn-cat-why').textContent === '');
      cat().value = 'fun'; cat().dispatchEvent(new Event('change', { bubbles: true }));
      note.value = 'groceries'; note.dispatchEvent(new Event('input', { bubbles: true }));
      ok('a category picked by hand stays picked', cat().value === 'fun');
      document.getElementById('mn-amt').value = '250';
      document.getElementById('mn-save').click();
      ok('…and is the one saved', (finTx().slice(-1)[0] || {}).c === 'fun' && (finTx().slice(-1)[0] || {}).n === 'groceries');
      localStorage.setItem('dp.fintx', JSON.stringify(finTx().slice(0, -1)));

      // Ask: a word the answer did not use is said out loud, or answered from the records
      const flat = r => r.lines.join(' ');
      const nf = askRun('how much did I spend on netflix');
      ok('Ask: "spend on netflix" answers from the Netflix records', /netflix/i.test(nf.title) && flat(nf).includes(finFmt(64900, { noPaise: true })) && !nf.ignored.length, nf);
      ok('…not with the whole month', !flat(nf).includes(finFmt(finMonth(ym).out, { compact: true, noPaise: true })));
      const gr = askRun('how much did I spend on groceries');
      ok('…a category name works the same way', flat(gr).includes(finFmt(340000, { noPaise: true })));
      const sp = askRun('how much did I spend on spotify');
      ok('…a word recorded only in another month says so, then gives what there is', /Nothing on “spotify”/.test(flat(sp)) && flat(sp).includes(finFmt(11900, { noPaise: true })));
      const zz = askRun('how much did I spend on hoverboards');
      ok('…a word nothing mentions is named up front, before the month', /ask-note/.test(zz.lines[0]) && /“hoverboards”/.test(zz.lines[0])
        && flat(zz).includes(finFmt(finMonth(ym).out, { compact: true, noPaise: true })));
      const wk = askRun('how much did I spend yesterday');
      ok('…a time it cannot narrow to is named too', wk.ignored.join() === 'yesterday' && /ask-note/.test(wk.lines[0]) && /“yesterday”/.test(wk.lines[0]), wk.ignored);
      const lm = askRun('how much did I spend last month');
      ok('"last month" answers last month', flat(lm).includes(escapeHtml(mnMonthLabel(lastYm))) && !lm.ignored.length, lm);
      const sl = askRun('how is my sleep in paris');
      ok('any skill: a leftover word is flagged', sl.ignored.join() === 'paris' && /ask-note/.test(sl.lines[0]));
      ok('no example question gets flagged', ASK_SKILLS.every(sk => !askRun(sk.ex).lines.some(l => /ask-note/.test(l))),
        ASK_SKILLS.map(sk => sk.id + ':' + askRun(sk.ex).ignored.join('+')).filter(s => !/:$/.test(s)).join());
      const everyday = ['where did my money go this month', 'how much have i spent', 'how much did I spend in total', 'what is my current streak', 'how is my sleep lately'];
      const noted = q => askRun(q).lines.some(l => /ask-note/.test(l));
      ok('…nor everyday wording', !everyday.some(noted), everyday.filter(noted));
      // the Clear button sits with the answers
      askLog = []; askSubmit('how much did I spend on hoverboards');
      const clr = document.getElementById('ask-clear');
      ok('Clear sits in the answers\' header, not alone in a card', !!clr && !clr.closest('.card') && !!clr.closest('.ask-thread-h'));
      ok('…and the "can\'t break out" line is shown', !!document.querySelector('#s-ask .ask-note'));
      clr.click();
      ok('…and still clears', askLog.length === 0 && !document.getElementById('ask-clear'));
    } finally {
      window.toast = tSnap; mnTab = prev.tab; mnAddOpen = prev.open; mnYm = prev.ym; askLog = prev.log;
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
    }
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
    // 9 since v255: History and Search are core for a journal (4 in the bar, 5 in the menu).
    ok('a fresh install shows a handful of destinations, not nineteen',
      visible.length <= 9, visible.join(','));
    ok('History and Search are visible on a fresh install', visible.includes('history') && visible.includes('search'));
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

    // --- onboarding is two steps (2026-11-21; it was five, then three, then four) ---
    const src = renderOnboard.toString();
    ok('onboarding no longer asks you to configure activities', !/data-ob-act/.test(src));
    ok('onboarding no longer asks you to configure the deep log', !/data-ob-deep/.test(src));
    ok('onboarding no longer has a style step (Settings ▸ Style & appearance has it)', !/stylePickerHTML/.test(src));
    ok('it still asks for habits', /data-ob-habit/.test(src));
    ok('and still offers the reminder', /ob-rem-on/.test(src));
    ok('onboarding is two steps', OB_LAST === 1, OB_LAST);

    if (nS != null) localStorage.setItem('dp.navcfg', nS); else localStorage.removeItem('dp.navcfg');
    if (lS != null) localStorage.setItem('dp.logsec', lS); else localStorage.removeItem('dp.logsec');
  })();

  /* ---- two-step onboarding (2026-11-21), driven by real clicks ----
     Step 2 is where the "Log my day" reminder is made, and that reminder is what makes Android
     ask for notification permission (the only place the app asks). So: everyone who finishes
     must pass through it, its box must start ticked, and the finish must still apply every flag
     the four-step version did. */
  (function () {
    const KEYS = ['dp.reminders', 'dp.habitcfg', 'dp.deepcfg', 'dp.onboarded', 'dp.whatsnew', 'dp.toured'];
    const snap = KEYS.map(k => localStorage.getItem(k));
    const ob = document.getElementById('onboard'), obWas = ob.classList.contains('on');
    const stepWas = obStep, restWas = obRestore, hideWas = [...obHideH];
    const tourSnap = window.startTour, remSnap = window.setupReminders;
    let tours = 0, setups = 0;
    const click = sel => { const b = ob.querySelector(sel); if (b) b.click(); return !!b; };
    try {
      window.startTour = () => { tours++; };
      window.setupReminders = () => { setups++; };
      ['dp.reminders', 'dp.habitcfg', 'dp.deepcfg', 'dp.onboarded', 'dp.toured'].forEach(k => localStorage.removeItem(k));
      obHideH.clear(); obStep = 0; obRestore = false;
      ob.classList.add('on'); renderOnboard();

      // step 1: welcome + the restore door, nothing to configure
      ok('onboarding step 1 offers the restore door', !!ob.querySelector('[data-ob-restore]'));
      ok('…and one button forward', !!ob.querySelector('[data-ob-next]'));
      ok('…with no back button on the first step', !ob.querySelector('[data-ob-back]'));
      ok('two progress dots, the first one lit', ob.querySelectorAll('.ob-dots span').length === 2
        && ob.querySelectorAll('.ob-dots span')[0].classList.contains('on'));
      ok('step 1 asks nothing yet (no habits, no reminder)', !ob.querySelector('[data-ob-habit]') && !ob.querySelector('#ob-rem-on'));
      ok('step 1 still says where the data lives and how to keep it', /only on this phone/.test(ob.textContent) && /backup/i.test(ob.textContent));

      // step 2: the checklist and the reminder together, both already set
      click('[data-ob-next]');
      ok('one tap reaches step 2', obStep === 1, obStep);
      const rem = ob.querySelector('#ob-rem-on'), rt = ob.querySelector('#ob-rem-time');
      ok('step 2 holds the daily reminder, ticked by default', !!rem && rem.checked === true);
      ok('…at 21:00', !!rt && rt.value === '21:00', rt && rt.value);
      const chips = ob.querySelectorAll('[data-ob-habit]');
      ok('step 2 shows every starter habit, all kept', chips.length === habitCfg().length && [...chips].every(c => c.classList.contains('on')), chips.length);
      ok('…without the old add-your-own row (the Log has one)', !ob.querySelector('#ob-new-habit') && !ob.querySelector('#ob-add-habit'));
      ok('…and without the style picker', !ob.querySelector('[data-uistyle]'));
      ok('step 2 is the last: its button finishes', /Start logging/.test((ob.querySelector('[data-ob-next]') || {}).textContent || ''));
      ok('the second dot is lit', ob.querySelectorAll('.ob-dots span')[1].classList.contains('on'));
      ok('there is a way back to step 1', !!ob.querySelector('[data-ob-back]'));

      // dropping a habit re-renders, and must not reset the reminder the person just set
      rt.value = '20:30';
      const dropKey = chips[0].dataset.obHabit;
      chips[0].click();
      ok('tapping a habit drops it', obHideH.has(dropKey) && !ob.querySelector(`[data-ob-habit="${dropKey}"]`).classList.contains('on'));
      ok('…and keeps the reminder time as set', ob.querySelector('#ob-rem-time').value === '20:30', ob.querySelector('#ob-rem-time').value);
      ok('…and the box still ticked', ob.querySelector('#ob-rem-on').checked === true);

      click('[data-ob-back]');
      ok('back returns to step 1, restore door and all', obStep === 0 && !!ob.querySelector('[data-ob-restore]'));
      click('[data-ob-next]');
      ob.querySelector('#ob-rem-time').value = '20:30';

      // finish
      click('[data-ob-next]');
      const rs = DB.reminders();
      const made = rs.filter(r => r.label === 'Log my day');
      ok('finishing makes exactly one "Log my day" reminder', made.length === 1, rs);
      ok('…in notify mode, on, at the time picked', made[0] && made[0].mode === 'notify' && made[0].enabled === true && made[0].time === '20:30', made[0]);
      ok('…which the nudge planner recognises as the log reminder', !!made[0] && isLogReminder(made[0]));
      ok('…and reminders are set up (on Android this is the permission prompt)', setups === 1, setups);
      ok('the dropped habit is hidden, the rest are not', habitCfg().every(h => !!h.hidden === (h.key === dropKey)), habitCfg());
      ok('the Deep log starts light (obHideD applied)', [...obHideD].every(id => (deepCfg().find(s => s.id === id) || { hidden: true }).hidden === true)
        && deepCfg().some(s => !s.hidden));
      ok('onboarding is marked done', localStorage.getItem('dp.onboarded') === '1');
      ok('a brand-new user skips the What\'s-new card', localStorage.getItem('dp.whatsnew') === WHATS_NEW.v);
      ok('the onboarding screen closes', !ob.classList.contains('on'));
      ok('the tour starts', tours === 1, tours);
      ok('…on the Log', document.getElementById('s-today').classList.contains('on'));

      // unticking the box: no reminder, but everything else still happens
      ['dp.reminders', 'dp.onboarded'].forEach(k => localStorage.removeItem(k));
      tours = 0; setups = 0; obHideH.clear(); obStep = 0; ob.classList.add('on'); renderOnboard();
      click('[data-ob-next]');
      ob.querySelector('#ob-rem-on').checked = false;
      click('[data-ob-next]');
      ok('an unticked box makes no reminder', !DB.reminders().some(r => r.label === 'Log my day'), DB.reminders());
      ok('…and asks for nothing', setups === 0, setups);
      ok('…but onboarding still finishes and the tour still starts', localStorage.getItem('dp.onboarded') === '1' && tours === 1);

      // a step number from the four-step version must not strand anyone past the reminder
      obStep = 3; ob.classList.add('on'); renderOnboard();
      ok('an old step number lands on the reminder step', obStep === OB_LAST && !!ob.querySelector('#ob-rem-on'));
    } catch (e) {
      fail++; R.push('FAIL the onboarding-flow block threw: ' + (e && e.stack || e));
    } finally {
      window.startTour = tourSnap; window.setupReminders = remSnap;
      KEYS.forEach((k, i) => { if (snap[i] != null) localStorage.setItem(k, snap[i]); else localStorage.removeItem(k); });
      reloadCfg();
      obHideH.clear(); hideWas.forEach(k => obHideH.add(k));
      obStep = stepWas; obRestore = restWas;
      if (obWas) { ob.classList.add('on'); renderOnboard(); } else ob.classList.remove('on');
    }
  })();

  /* ---- the tour (2026-11-21): four steps, starts on the mood card, always ends on the Log ----
     The tour fails silently when a target is missing (gotchas.md), so every step's target is
     checked on its real screen. Only the synchronous paths are driven here: Next on a middle
     step schedules a render, which would leave an overlay behind for later blocks. */
  (function () {
    const tSnap = window.toast, eSnap = localStorage.getItem('dp.entries'), trSnap = localStorage.getItem('dp.toured');
    const dtSnap = dashTab;
    const toasts = [];
    const onToday = () => document.getElementById('s-today').classList.contains('on');
    try {
      window.toast = m => toasts.push(m);
      ok('the tour is short (at most 5 steps)', TOUR.length >= 3 && TOUR.length <= 5, TOUR.length);
      ok('it starts on the Log, at the mood card', TOUR[0].s === 'today' && /\.mm-card/.test(TOUR[0].t));
      ok('no step is Play-only, so "1 / N" is the real count everywhere', TOUR.every(st => !st.native));
      ok('the tour copy states no statistic', !TOUR.some(st => /\d+\s*(%|x|×)/.test(st.h + st.b)));
      TOUR.forEach((st, i) => {
        if (st.s === '__menu') openDrawer();
        else { closeDrawer(); if (st.s === 'dash') dashTab = 'overview'; navigateTo(st.s); }
        const el = (st.t && document.querySelector(st.t)) || (st.alt && document.querySelector(st.alt));
        ok(`tour step ${i + 1} (${st.s}) finds its target`, !!el, st.t);
      });
      closeDrawer();

      // the card: a clear Skip tour, and the true count
      tourIdx = 0; renderTourOverlay(TOUR[0], null);
      const skip = document.getElementById('tour-skip');
      ok('every step but the last offers "Skip tour"', !!skip && /Skip tour/.test(skip.textContent));
      ok('…placed first, apart from Back and Next', !!skip && skip.parentElement.firstElementChild === skip);
      ok('the counter shows the real length', new RegExp('1 / ' + TOUR.length).test(document.querySelector('#tour .tour-step').textContent));
      tourIdx = TOUR.length - 1; renderTourOverlay(TOUR[tourIdx], null);
      ok('the last step has no Skip, just Done', !document.getElementById('tour-skip') && /Done/.test(document.getElementById('tour-next').textContent));

      /* The card must not cover what it points at. jsdom has no layout, so the rects are the ones
         measured at 360×740 in Chromium: the card is 430–650 at the bottom, 14–234 at the top. */
      const gbr = HTMLElement.prototype.getBoundingClientRect;
      try {
        HTMLElement.prototype.getBoundingClientRect = function () {
          if (this.classList.contains('tour-card')) return this.classList.contains('tour-card-top')
            ? { top: 14, bottom: 234, left: 14, right: 346, width: 332, height: 220 }
            : { top: 430, bottom: 650, left: 14, right: 346, width: 332, height: 220 };
          if (this.classList.contains('tour-spot')) { const t = parseFloat(this.style.top) || 0, h = parseFloat(this.style.height) || 0; return { top: t, bottom: t + h, left: 0, right: 0, width: 0, height: h }; }
          return gbr.call(this);
        };
        const at = (top, h) => ({ getBoundingClientRect: () => ({ top, left: 61, width: 289, height: h, bottom: top + h, right: 350 }) });
        tourIdx = 3; renderTourOverlay(TOUR[3], at(474, 55));   // the Menu's "More features" row
        ok('a target low on the screen moves the card to the top', document.querySelector('#tour .tour-card').classList.contains('tour-card-top'));
        tourIdx = 1; renderTourOverlay(TOUR[1], at(235, 46));   // an activity chip, clear of the card
        ok('a target clear of the card leaves it at the bottom', !document.querySelector('#tour .tour-card').classList.contains('tour-card-top'));
      } finally { HTMLElement.prototype.getBoundingClientRect = gbr; }
      tourIdx = TOUR.length - 1; renderTourOverlay(TOUR[tourIdx], null);

      // Done from the Menu step: back on the Log, invited to log when today has no mood yet
      const e = safeParse(eSnap, {}) || {}; delete e[todayStr()];
      localStorage.setItem('dp.entries', JSON.stringify(e));
      localStorage.removeItem('dp.toured');
      openDrawer();
      document.getElementById('tour-next').click();
      ok('Done ends the tour', !document.getElementById('tour') && tourIdx === -1);
      ok('…closes the menu', !document.getElementById('drawer').classList.contains('on'));
      ok('…lands on the Log', onToday());
      ok('…marks the tour seen', localStorage.getItem('dp.toured') === '1');
      ok('…and invites the first log', toasts[toasts.length - 1] === 'Your turn: tap how today feels', toasts);
      e[todayStr()] = { mood: 7 }; localStorage.setItem('dp.entries', JSON.stringify(e));
      ok('once today has a mood the sign-off is plain', tourEndMsg() === 'Enjoy Daylog 🔥', tourEndMsg());

      // Skip tour from the middle of the tour also lands on the Log
      localStorage.removeItem('dp.toured');
      navigateTo('time'); tourIdx = 1; renderTourOverlay(TOUR[1], null);
      document.getElementById('tour-skip').click();
      ok('Skip tour ends it from any step', !document.getElementById('tour') && tourIdx === -1 && localStorage.getItem('dp.toured') === '1');
      ok('…and lands on the Log, ready for a first log', onToday());
    } catch (e) {
      fail++; R.push('FAIL the tour block threw: ' + (e && e.stack || e));
    } finally {
      window.toast = tSnap; dashTab = dtSnap; tourIdx = -1;
      const o = document.getElementById('tour'); if (o) o.remove();
      closeDrawer();
      if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
      if (trSnap != null) localStorage.setItem('dp.toured', trSnap); else localStorage.removeItem('dp.toured');
      navigateTo('today');
    }
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
     ['an unknown context', { ctx: 'page:x' }], ['a context with a bad id', { ctx: 'doc:a b' }], ['no data', { data: '' }], ['an html mime', { mime: 'text/html' }],
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
    /* Memories: a photo-only day still counts for "On this day", and History has a Photos tab. */
    const wk = addDays(T0, -7);
    _media.set('mt5', { id: 'mt5', kind: 'photo', mime: 'image/jpeg', blob: new Blob(['x']), day: wk, ctx: 'log', ts: 5, size: 1 });
    const eSnap2 = localStorage.getItem('dp.entries');
    const e2 = DB.entries(); delete e2[wk]; localStorage.setItem('dp.entries', JSON.stringify(e2));
    const lsSnap2 = localStorage.getItem('dp.logsec'); localStorage.removeItem('dp.logsec');
    logDate = T0;
    const otd = throwbackHTML();
    ok('"On this day" shows a day that has only a photo', /A week ago/.test(otd) && /data-mview="mt5"/.test(otd), otd.slice(0, 200));
    if (eSnap2 != null) localStorage.setItem('dp.entries', eSnap2); else localStorage.removeItem('dp.entries');
    if (lsSnap2 != null) localStorage.setItem('dp.logsec', lsSnap2);
    histTab = 'photos'; show('history');
    ok('History ▸ Photos lists Log photos by month', document.querySelectorAll('#s-history .hist-photos .mthumb').length === 3, document.querySelectorAll('#s-history .hist-photos .mthumb').length);
    ok('…not a note’s photo', !document.querySelector('#s-history [data-mview="mt4"]'));
    ok('…and its count matches the grid', /^3 photos$/.test(document.getElementById('screen-sub').textContent), document.getElementById('screen-sub').textContent);
    mediaViewOpen('mt1', ['mt3', 'mt1', 'mt5']);
    ok('the gallery viewer pages through the whole gallery', _mview && _mview.ids.length === 3 && _mview.i === 1);
    ok('…and offers to open that day', !!document.querySelector('#media-view [data-mview-day]'));
    mediaViewClose();
    histTab = 'days'; show('history');
    ok('Photos is a share-card kind', CARD_KINDS.some(c => c.k === 'photos'));
    _media.get('mt1').caption = 'Sunset over the lake';
    const sr = runSearch('sunset');
    ok('search finds a photo by its caption', /Photo captions/.test(sr) && /data-mview="mt1"/.test(sr), sr.slice(0, 160));
    delete _media.get('mt1').caption;
    _media.delete('mt5');
    ['mt1', 'mt2', 'mt3', 'mt4'].forEach(id => _media.delete(id)); _mediaUrls.clear();
    _mediaReady = readySnap; window.mediaSupported = supSnap; URL.createObjectURL = urlSnap;
  })();

  // ---- Distribution: share links, invite, Play nudge (v251) ----
  (function () {
    const L = playLink('card', 'qr');
    ok('a Play link carries an encoded install referrer',
      L.indexOf('https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse&referrer=') === 0
      && decodeURIComponent(L.split('referrer=')[1]) === 'utm_source=card&utm_medium=qr', L);
    ok('…and a campaign when given', decodeURIComponent(playLink('pwa', 'web', 'nudge').split('referrer=')[1]) === 'utm_source=pwa&utm_medium=web&utm_campaign=nudge');
    const it = inviteText('whatsapp');
    ok('the invite message ends with the tracked link', /utm_source%3Dwhatsapp/.test(it) && it.trim().endsWith(playLink('whatsapp', 'invite')));
    ok('…and says nothing about the person’s data', !/\d/.test(it.split('Free on Google Play')[0]));
    ok('Invite is offered as a card', CARD_KINDS.some(c => c.k === 'invite'));
    ok('the nudge state is install-local, not backed up', BACKUP_EXCLUDED.includes('playNudge') && !BACKUP_KEYS.includes('playNudge'));
    const setUA = ua => Object.defineProperty(navigator, 'userAgent', { get: () => ua, configurable: true });
    const pnSnap = localStorage.getItem('dp.playNudge'), capSnap = window.Capacitor;
    delete window.Capacitor; localStorage.removeItem('dp.playNudge');
    setUA('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36');
    ok('an Android browser is offered the Play app', playNudgeDue() && /id="pn-go"/.test(playNudgeHTML()));
    ok('…through a tracked link', /utm_source%3Dpwa/.test(playNudgeHTML()));
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1');
    ok('an iPhone is not — there is no iOS app', !playNudgeDue());
    setUA('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36');
    window.Capacitor = { Plugins: {} };
    ok('the Play app itself never shows it', !playNudgeDue());
    delete window.Capacitor;
    localStorage.setItem('dp.playNudge', JSON.stringify({ snoozed: Date.now() }));
    ok('"Not now" means silence', !playNudgeDue());
    localStorage.setItem('dp.playNudge', JSON.stringify({ snoozed: Date.now() - 31 * 86400000 }));
    ok('…for a month', playNudgeDue());
    localStorage.setItem('dp.playNudge', JSON.stringify({ done: true }));
    ok('after "Get it", never again', !playNudgeDue());
    delete navigator.userAgent;
    if (capSnap !== undefined) window.Capacitor = capSnap;
    if (pnSnap != null) localStorage.setItem('dp.playNudge', pnSnap); else localStorage.removeItem('dp.playNudge');
    ok('the userAgent override is gone again', !/Pixel 7/.test(navigator.userAgent));
  })();

  // ---- v252: History ▸ one day (read-only), Settings ▸ Storage ----
  (function () {
    const T0 = todayStr();
    // A missing button is a failed check, not a crash that skips every check after it.
    const tap = (sel) => { const el = document.querySelector(sel); if (!el) { ok('the page has ' + sel, false); return false; } el.click(); return true; };
    ok('relDay: today / yesterday', relDay(T0, T0) === 'Today' && relDay(addDays(T0, -1), T0) === 'Yesterday');
    ok('relDay: days, weeks, months, years', relDay(addDays(T0, -5), T0) === '5 days ago' && relDay(addDays(T0, -21), T0) === '3 weeks ago'
      && relDay(addDays(T0, -92), T0) === '3 months ago' && relDay(addDays(T0, -365), T0) === 'A year ago' && relDay(addDays(T0, -800), T0) === '2 years ago',
      [relDay(addDays(T0, -21), T0), relDay(addDays(T0, -92), T0), relDay(addDays(T0, -365), T0), relDay(addDays(T0, -800), T0)]);
    ok('fmtHours', fmtHours(7.5) === '7h 30m' && fmtHours(8) === '8h' && fmtHours(0.5) === '30m' && fmtHours('') === '', [fmtHours(7.5), fmtHours(8), fmtHours(0.5)]);
    ok('moodFace spans the scale', moodFace(1) === '😣' && moodFace(10) === '😄' && moodFace(null) === '');

    const eSnap = localStorage.getItem('dp.entries'), nSnap = localStorage.getItem('dp.notes');
    const d1 = addDays(T0, -3), d0 = addDays(T0, -9), d2 = addDays(T0, -1);
    const e = DB.entries();
    const h0 = HABITS[0], h1 = HABITS[1];
    e[d1] = { mood: 8, energy: 3, sleepHours: 7.5, bedTime: '23:00', wakeTime: '06:30', deepWorkHours: 2,
      journal: 'Long walk by the lake.\nFelt <b>good</b> #calm #grateful #work', wentWell: 'Finished the draft ✨', improve: '',
      habits: h0 && h1 ? { [h0.key]: true, [h1.key]: 0 } : {}, focus: 7, topics: { 'AI/ML': true, Physics: false }, keyInsight: 'Rest is work' };
    e[d0] = { mood: 4, energy: 4, journal: 'older' };
    e[d2] = { mood: 6, energy: 6, journal: 'newer' };
    localStorage.setItem('dp.entries', JSON.stringify(e));
    const ns = DB.notes(); ns.unshift({ id: 'nHD1', text: 'A note from that day', color: '', created: d1 });
    localStorage.setItem('dp.notes', JSON.stringify(ns));

    const html = historyDayHTML(d1);
    ok('the day page leads with how the day felt', /class="hd-hero"/.test(html) && /🙂/.test(html) && /Low energy, pleasant/.test(html));
    ok('…names the mood words it was tagged with', /hd-word">Calm</.test(html) && /hd-word">Grateful</.test(html) && !/hd-word">Work</.test(html));
    ok('…shows the journal with its line break and tags', /Long walk by the lake\.\nFelt/.test(html) && /<span class="hd-tag">#work<\/span>/.test(html));
    ok('…and escapes what was typed', /&lt;b&gt;good&lt;\/b&gt;/.test(html) && !/<b>good<\/b>/.test(html));
    ok('…the core text fields, without their emoji', /One thing that went well<\/div>/.test(html) && /Finished the draft/.test(html));
    ok('…an empty field is left out, not shown blank', !/One thing to improve tomorrow/.test(html));
    ok('…sleep and deep work as tiles', /7h 30m/.test(html) && /23:00–06:30/.test(html) && />2h</.test(html));
    ok('…the deep log, only what holds something', /Focus quality/.test(html) && /AI\/ML/.test(html) && !/Physics/.test(html) && /Rest is work/.test(html) && !/Anxiety/.test(html));
    ok('…a note written that day', /A note from that day/.test(html));
    if (h0 && h1) ok('…the checklist: done, skipped and missed', new RegExp('hd-hab done[^>]*><span class="hd-hk">✓</span>' + h0.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(html) && /hd-hab skip/.test(html));
    ok('…with Edit at the top and at the bottom', (html.match(/data-hday-edit="/g) || []).length === 2);
    ok('…and arrows to the days either side', html.includes(`data-hday-go="${d0}"`) && html.includes(`data-hday-go="${d2}"`));
    const empty = historyDayHTML(addDays(T0, -400));
    ok('a day with nothing logged says so, and offers to log it', /Nothing was logged on this day/.test(empty) && /Log this day/.test(empty));

    // navigation: list → day → Edit → back → day → back → list
    const ldSnap = logDate;
    navigateTo('history');
    ok('History rows open the day page, not the editor', !!document.querySelector(`#s-history [data-hday="${d1}"]`));
    tap(`#s-history [data-hday="${d1}"]`);
    ok('tapping a day opens its read-only page', document.getElementById('s-history').classList.contains('on') && histDay === d1 && !!document.querySelector('#s-history .hd-hero'));
    ok('…titled with that day', document.getElementById('screen-title').textContent === prettyDate(d1));
    tap(`#s-history [data-hday-go="${d0}"]`);
    ok('the ‹ arrow steps to the older day', histDay === d0 && /older/.test(document.getElementById('s-history').textContent));
    tap(`#s-history [data-hday-go="${d1}"]`);
    tap('#s-history .hd-hero [data-hday-edit]');
    ok('Edit opens the Log for that day', document.getElementById('s-today').classList.contains('on') && logDate === d1 && _editFromHist === d1);
    handleBack();
    ok('Back from that Log returns to the day page', document.getElementById('s-history').classList.contains('on') && histDay === d1);
    handleBack();
    ok('Back from the day page returns to the list', document.getElementById('s-history').classList.contains('on') && histDay === null && !!document.querySelector('#s-history .hist-item'));
    tap(`#s-history [data-hday="${d1}"]`);
    tap('#s-history .hd-foot [data-hday-edit]');
    tap('#save-entry');
    ok('Done on that Log saves and returns to the day page', document.getElementById('s-history').classList.contains('on') && histDay === d1);
    tap('#s-history .hd-hero [data-hday-edit]');
    show('cal');
    ok('leaving the Log another way forgets the way back', _editFromHist === null);
    histDayOpen(d1); tap('#s-history .hd-hero [data-hday-edit]');
    navigateTo('today');
    ok('…including tapping the Log tab, which opens today', _editFromHist === null && logDate === todayStr());
    navigateTo('history');
    ok('the History tab always opens on the list', histDay === null && !!document.querySelector('#s-history .hist-item'));

    // every other "open that day" tap lands on the same read-only page, and Back goes where it came from
    const onDay = () => document.getElementById('s-history').classList.contains('on') && !!document.querySelector('#s-history .hd-hero');
    const plant = (scr, attr) => { const b = document.createElement('button'); b.setAttribute(attr, d1); b.id = 't-plant'; document.getElementById('s-' + scr).appendChild(b); return '#t-plant'; };
    navigateTo('cal'); calSel = d1; calMonth = d1.slice(0, 7); renderCal();
    ok('Calendar offers "View day", not "Open log"', /View day →/.test(document.getElementById('s-cal').innerHTML) && !/Open log/.test(document.getElementById('s-cal').innerHTML));
    tap(`#s-cal [data-callog="${d1}"]`);
    ok('Calendar ▸ View day opens the read-only page, not the Log', onDay() && histDay === d1 && logDate === todayStr());
    ok('…whose back button names the Calendar', /← Calendar/.test(document.querySelector('#s-history [data-hday-back]').textContent));
    tap('#s-history .hd-hero [data-hday-edit]');
    ok('…Edit there still opens the Log for that day', document.getElementById('s-today').classList.contains('on') && logDate === d1);
    handleBack();
    ok('…Back from that Log returns to the day page', onDay() && histDay === d1);
    tap('#s-history [data-hday-back]');
    ok('…and Back from the day page returns to the Calendar, on the same day', document.getElementById('s-cal').classList.contains('on') && calSel === d1 && _dayFrom === null && histDay === null);
    logDate = todayStr();
    navigateTo('dash'); tap(plant('dash', 'data-yp'));
    ok('a year-in-pixels square opens the read-only page', onDay() && histDay === d1 && logDate === todayStr());
    handleBack();
    ok('…and Back returns to Stats', document.getElementById('s-dash').classList.contains('on') && histDay === null);
    navigateTo('dash'); tap(plant('dash', 'data-be-open'));
    ok('a personal best opens the read-only page', onDay() && histDay === d1 && logDate === todayStr());
    navigateTo('history');
    ok('…and a tab tap from there forgets the way back', _dayFrom === null && histDay === null);
    navigateTo('dash'); tap(plant('dash', 'data-yp')); show('tasks');
    ok('…as does leaving for any other screen', _dayFrom === null);
    searchQ = 'lake'; navigateTo('search');
    tap(`#s-search .sr-row[data-sr="log"][data-d="${d1}"]`);
    ok('a Search hit in a day opens the read-only page', onDay() && histDay === d1 && logDate === todayStr());
    handleBack();
    ok('…and Back returns to the results', document.getElementById('s-search').classList.contains('on') && !!document.querySelector(`#s-search .sr-row[data-d="${d1}"]`));
    navigateTo('today'); tap(plant('today', 'data-throwback'));
    ok('On this day opens the read-only page instead of loading that day into the Log', onDay() && histDay === d1 && logDate === todayStr());
    handleBack();
    ok('…and Back returns to today\'s Log', document.getElementById('s-today').classList.contains('on') && logDate === todayStr());
    // independent review: Edit from there, Done, then "← Log" must land on TODAY's Log
    navigateTo('today'); tap(plant('today', 'data-throwback'));
    tap('#s-history .hd-hero [data-hday-edit]');
    ok('…Edit from that page opens the old day', logDate === d1);
    tap('#save-entry');
    ok('…Done returns to its page', onDay() && histDay === d1);
    tap('#s-history [data-hday-back]');
    ok('…and "← Log" lands on today\'s Log, not the old day\'s', document.getElementById('s-today').classList.contains('on') && logDate === todayStr(), logDate);
    // Edit, then pick another day in the Log's own date picker: Done goes to THAT day's page
    histDayOpen(d1); tap('#s-history .hd-hero [data-hday-edit]');
    const ld = document.getElementById('log-date');
    if (ld) { ld.value = d2; ld.dispatchEvent(new Event('change', { bubbles: true })); }
    tap('#save-entry');
    ok('Edit, change the date, Done → the page of the day now shown', onDay() && histDay === d2, histDay);
    navigateTo('history');
    // a day with only auto-tracked steps is not "Nothing was logged"
    const hsSnap = localStorage.getItem('dp.health'), dS = addDays(T0, -30);
    const hs0 = healthStore(); hs0[dS] = { steps: 4321 }; localStorage.setItem('dp.health', JSON.stringify(hs0));
    const stepsOnly = historyDayHTML(dS);
    ok('a steps-only day shows its steps without claiming nothing was logged', /4,321/.test(stepsOnly) && !/Nothing was logged/.test(stepsOnly));
    if (hsSnap != null) localStorage.setItem('dp.health', hsSnap); else localStorage.removeItem('dp.health');
    navigateTo('history');
    logDate = ldSnap;

    // photos on the day page, and the viewer's "Open day"
    const readySnap = _mediaReady, supSnap = window.mediaSupported, urlSnap = URL.createObjectURL;
    URL.createObjectURL = () => 'blob:test'; window.mediaSupported = () => true; _mediaReady = true;
    _media.set('hd1', { id: 'hd1', kind: 'photo', mime: 'image/webp', blob: new Blob(['x']), thumb: new Blob(['y']), day: d1, ctx: 'log', ts: 1, size: 2, caption: 'The lake' });
    _media.set('hd2', { id: 'hd2', kind: 'voice', mime: 'audio/webm', blob: new Blob(['z']), day: d1, ctx: 'log', ts: 2, dur: 5000, size: 1 });
    const hp = historyDayHTML(d1);
    ok('the day page shows its photos with captions', /data-mview="hd1"/.test(hp) && /hd-cap">The lake</.test(hp) && /data-mset="day"/.test(hp));
    ok('…and its voice notes, playable but not deletable here', /data-vplay="hd2"/.test(hp) && !/data-mdel="hd2"/.test(hp));
    ok('voiceRowHTML still offers delete where asked', /data-mdel="hd2"/.test(voiceRowHTML(_media.get('hd2'), true)));
    histTab = 'photos'; navigateTo('history');
    mediaViewOpen('hd1', ['hd1']);
    tap('#media-view [data-mview-day]');
    ok('"Open day" in the viewer opens the read-only day', !mediaViewIsOpen() && histDay === d1 && histTab === 'days' && !!document.querySelector('#s-history .hd-hero'));
    mediaViewOpen('hd1');
    ok('…and is not offered for the day already open', !document.querySelector('#media-view [data-mview-day]'));
    mediaViewClose(); handleBack();
    ok('Back from a day opened from History ▸ Photos returns to Photos', histDay === null && histTab === 'photos' && !!document.querySelector('#s-history .mgrid, #s-history [data-mview="hd1"]'), histTab);
    _media.set('hd4', { id: 'hd4', kind: 'photo', mime: 'image/webp', blob: new Blob(['x']), thumb: new Blob(['y']), day: d1, ctx: 'log', ts: 4, size: 2 });
    refreshMediaSlots();
    ok('History ▸ Photos redraws when the photos change (fresh object URLs after a shrink)', !!document.querySelector('#s-history [data-mview="hd4"]'));
    _media.delete('hd4'); histDayOpen(d1); mediaViewOpen('hd1');
    _media.get('hd1').caption = 'Renamed in the viewer';
    mediaViewClose();
    ok('a caption typed in the viewer shows on the day page', /Renamed in the viewer/.test(document.getElementById('s-history').innerHTML));
    _media.delete('hd2'); refreshMediaSlots();
    ok('a voice note deleted elsewhere leaves the day page at once', !document.querySelector('#s-history [data-vplay="hd2"]') && !!document.querySelector('#s-history [data-mview="hd1"]'));
    _media.set('hd2', { id: 'hd2', kind: 'voice', mime: 'audio/webm', blob: new Blob(['z']), day: d1, ctx: 'log', ts: 2, dur: 5000, size: 1 });
    navigateTo('history');

    // Settings ▸ Storage
    _media.set('hd3', { id: 'hd3', kind: 'photo', mime: 'image/jpeg', blob: new Blob(['x']), day: d1, ctx: 'log', ts: 3, size: 300000 });
    ok('mediaShrinkable: an old photo yes; a new one, a voice note no', mediaShrinkable(_media.get('hd3')) && !mediaShrinkable({ kind: 'photo', enc: MEDIA_ENC }) && !mediaShrinkable(_media.get('hd2')));
    const fx = localStorage.getItem('dp.fintx');
    localStorage.setItem('dp.fintx', JSON.stringify([{ id: 'tx1', d: d1, dir: 'out', a: 45000, ac: 'x', c: 'food', n: 'Lunch' }]));
    localStorage.setItem('zz.someone-else', 'abc');
    const st = storageText();
    ok('storage groups money keys under Money', st.by.money >= ('dp.fintx' + localStorage.getItem('dp.fintx')).length);
    ok('…and an unknown key under Settings & other', st.by.other >= 'zz.someone-elseabc'.length);
    ok('…and the parts add up to the whole', Object.values(st.by).reduce((a, b) => a + b, 0) === st.chars);
    const sr = storageRows().rows;
    ok('storage rows are biggest first', sr.every((r, i) => !i || sr[i - 1].bytes >= r.bytes));
    ok('…photos and voice notes have their own rows', sr.some(r => r.k === 'photos' && r.sub === '2 photos' && r.bytes === 300002) && sr.some(r => r.k === 'voice' && /1 note · 0:05/.test(r.sub)));
    ok('…daily logs count their days', sr.some(r => r.k === 'logs' && /\d+ days?/.test(r.sub)));
    const dayMoney = historyDayHTML(d1);
    ok('the day page shows that day’s spending', /Lunch/.test(dayMoney) && /450/.test(dayMoney) && /spent/.test(dayMoney));
    settingsPage = null; navigateTo('settings');
    ok('Settings ▸ Your data has a Storage row with the total', /Storage/.test(document.getElementById('s-settings').textContent) && /on this phone · photos can be shrunk/.test(document.getElementById('s-settings').textContent));
    tap('#s-settings [data-set-page="storage"]');
    ok('the Storage page shows the total, a bar and every row', !!document.querySelector('#st-card .st-total b') && document.querySelectorAll('#st-card .st-bar i').length === document.querySelectorAll('#st-card .st-row').length);
    ok('…offers to shrink the older photos', /Shrink 2 photos/.test((document.getElementById('st-shrink') || {}).textContent || ''));
    ok('…and how full the text space is', /% of about 5 MB/.test(document.getElementById('st-card').textContent));
    _media.get('hd3').enc = MEDIA_ENC; _media.get('hd1').enc = MEDIA_ENC;
    renderSettings();
    ok('…and stops offering once every photo is current', !document.getElementById('st-shrink'));
    handleBack();
    ok('Back leaves the Storage page for Settings', settingsPage === null);
    ok('a WebP item is a valid backup item', mediaItemValid({ id: 'w1', kind: 'photo', mime: 'image/webp', day: d1, ctx: 'log', data: 'UklGR' }));

    localStorage.removeItem('zz.someone-else');
    if (fx != null) localStorage.setItem('dp.fintx', fx); else localStorage.removeItem('dp.fintx');
    ['hd1', 'hd2', 'hd3'].forEach(id => _media.delete(id)); _mediaUrls.clear();
    _mediaReady = readySnap; window.mediaSupported = supSnap; URL.createObjectURL = urlSnap;
    if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
    if (nSnap != null) localStorage.setItem('dp.notes', nSnap); else localStorage.removeItem('dp.notes');
    histDay = null; settingsPage = null;
  })();

  // ---- v253: photos and voice on a note you already have ----
  (function () {
    const tap = (sel) => { const el = document.querySelector(sel); if (!el) { ok('the page has ' + sel, false); return false; } el.click(); return true; };
    const nSnap = localStorage.getItem('dp.notes');
    const readySnap = _mediaReady, supSnap = window.mediaSupported, urlSnap = URL.createObjectURL;
    URL.createObjectURL = () => 'blob:test'; window.mediaSupported = () => true; _mediaReady = true;
    localStorage.setItem('dp.notes', JSON.stringify([{ id: 'nA1', text: 'Old note', color: '', created: '2026-01-02' }, { id: 'nA"2', text: 'Odd id', color: '', created: '2026-01-02' }]));
    navigateTo('notes');
    ok('every note offers a camera button', document.querySelectorAll('#note-list [data-note-attach]').length === 2);
    ok('…and has a media slot of its own, empty until something is added', !!document.querySelector('#note-list .media-slot[data-mctx="note:nA1"]') && document.querySelector('#note-list .media-slot[data-mctx="note:nA1"]').innerHTML === '');
    ok('Photo / Gallery / Voice stay hidden until asked for', !document.querySelector('#note-list [data-madd]'));
    tap('#note-list [data-note-attach="nA1"]');
    const acts = [...document.querySelectorAll('#note-list [data-madd],[data-mrec]')].filter(b => b.closest('#note-list'));
    ok('tapping it shows Photo, Gallery and Voice for THAT note', acts.length === 3 && acts.every(b => b.dataset.mctx === 'note:nA1' && b.dataset.mday === todayStr()));
    ok('…and marks the button as open', document.querySelector('#note-list [data-note-attach="nA1"]').classList.contains('on'));
    tap('#note-list [data-note-attach="nA1"]');
    ok('tapping it again hides them', !document.querySelector('#note-list [data-madd]') && openAttachId === null);
    ok('an id with a quote in it is escaped, not broken out of', !!document.querySelector('#note-list [data-note-attach="nA\\"2"]'));
    _media.set('nm1', { id: 'nm1', kind: 'photo', mime: 'image/webp', blob: new Blob(['x']), thumb: new Blob(['y']), day: todayStr(), ctx: 'note:nA1', ts: 1, size: 2, enc: MEDIA_ENC });
    refreshMediaSlots();
    ok('a photo added to an older note shows in that note at once', !!document.querySelector('#note-list .media-slot[data-mctx="note:nA1"] [data-mview="nm1"]'));
    ok('…and nowhere else', document.querySelectorAll('[data-mview="nm1"]').length === 1);
    ok('…and the note is not treated as unattached', !mediaOrphanCtxs().includes('note:nA1'));
    _media.delete('nm1'); _mediaUrls.clear(); openAttachId = null;
    _mediaReady = readySnap; window.mediaSupported = supSnap; URL.createObjectURL = urlSnap;
    if (nSnap != null) localStorage.setItem('dp.notes', nSnap); else localStorage.removeItem('dp.notes');
  })();

  // ---- v253: two reminders in the same minute both ring ----
  (function () {
    const st = window.setTimeout, si = window.setInterval; let later = [];
    window.setTimeout = (fn) => { later.push(fn); return 0; }; window.setInterval = () => 0;
    const el = document.getElementById('alarm'), lbl = () => document.getElementById('alarm-label').textContent;
    try {
      fireAlarm('Take meds', '08:00', false);
      fireAlarm('Water plants', '08:00', false);
      ok('the first reminder rings', el.classList.contains('on') && lbl() === 'Take meds');
      ok('…and the second waits instead of being dropped', _alarmQueue.length === 1);
      fireAlarm('Water plants', '08:00', false); fireAlarm('Take meds', '08:00', false);
      ok('the same reminder is not queued twice, nor the one already ringing', _alarmQueue.length === 1);
      stopAlarm(); later.splice(0).forEach(f => f());
      ok('dismissing the first rings the second', el.classList.contains('on') && lbl() === 'Water plants' && _alarmQueue.length === 0);
      stopAlarm(); later.splice(0).forEach(f => f());
      ok('dismissing the last leaves it quiet', !el.classList.contains('on'));
    } finally { window.setTimeout = st; window.setInterval = si; stopAlarm(); _alarmQueue = []; }
  })();

  // ---- v253: sync — un-ticks, deleted blocks, unsynced timers, the last save before a kill ----
  (function () {
    const keys = ['dp.entries', 'dp.timelog', 'dp.timelogDel', 'dp.touched', 'dp.settings'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const fSnap = window.fetch, sent = [];
    window.fetch = (u, o) => { try { sent.push(JSON.parse(o.body)); } catch (e) {} return Promise.resolve({ ok: true }); };
    const tSnap = window.toast; window.toast = () => {};
    try {
      const T0 = todayStr();
      // mergeHabits, directly
      let m = mergeHabits({ habits: {}, habitsAt: { w: 200 } }, { habits: { w: true }, habitsAt: { w: 100 } });
      ok('a newer un-tick beats an older tick', !('w' in m.habits) && m.habitsAt.w === 200);
      m = mergeHabits({ habits: {}, habitsAt: { w: 100 } }, { habits: { w: true }, habitsAt: { w: 200 } });
      ok('…and a newer tick beats an older un-tick', m.habits.w === true);
      m = mergeHabits({ habits: { w: true }, habitsAt: { w: 100 } }, { habits: {}, updatedAt: new Date(Date.now() + 9e6).toISOString(), timeSummary: 'x' });
      ok('a side that never touched a habit cannot drop its tick (a stale machine write)', m.habits.w === true);
      m = mergeHabits({ habits: { a: true } }, { habits: { b: 0 } });
      ok('entries without stamps (older app) still merge as a union', m.habits.a === true && m.habits.b === 0 && !m.habitsAt);
      // end to end: un-tick in the Log, then a pull of the other phone's older tick
      const st = DB.settings(); st.syncUrl = 'https://example.invalid/exec'; DB.saveSettings(st);
      const h = HABITS[0].key;
      const olderTick = { [T0]: { habits: { [h]: true }, habitsAt: { [h]: Date.now() - 60000 }, updatedAt: new Date(Date.now() - 60000).toISOString() } };
      localStorage.setItem('dp.entries', JSON.stringify(olderTick));
      navigateTo('today');
      const chip = () => document.querySelector(`#s-today [data-habit="${h}"]`);
      if (goalFor(h)) ok('(first habit is a plain one)', true);
      else chip().click();                                  // done → cleared (v255: one tap unticks)
      flushAutosave();
      ok('(un-ticked locally)', !(h in (DB.entry(T0).habits || {})) && DB.entry(T0).habitsAt[h] > olderTick[T0].habitsAt[h]);
      applyRemoteState({ touched: Date.now() + 5000, entries: olderTick });
      ok('an un-ticked habit stays un-ticked when the other phone\'s older tick syncs in', !(h in (DB.entry(T0).habits || {})), DB.entry(T0).habits);
      // time log
      const t = Date.now();
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'run1', act: 'work', start: t - 3600000, end: null, upd: t - 3600000 }]));
      localStorage.setItem('dp.timelogDel', '{}'); localStorage.setItem('dp.touched', String(t - 3600000));
      applyRemoteState({ touched: t, timelog: [], timelogDel: {} });
      ok('a running timer the other phone has not seen survives a pull', DB.timelog().some(s => s.id === 'run1'));
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'b1', act: 'work', start: t - 7200000, end: t - 3600000, upd: t - 7200000 }]));
      timelogForget('b1'); localStorage.setItem('dp.timelog', '[]');
      applyRemoteState({ touched: t + 9000, timelog: [{ id: 'b1', act: 'work', start: t - 7200000, end: t - 3600000, upd: t - 7200000 }], timelogDel: {} });
      ok('a block deleted here does not come back from the other phone', !DB.timelog().some(s => s.id === 'b1'));
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'b5', act: 'work', start: t - 7200000, end: t - 3600000, upd: t - 7200000 }]));
      show('time'); ttDate = todayStr(new Date(t - 7200000)); ttSelSeg = 'b5'; renderTime();
      const del = document.getElementById('seg-del'); if (del) del.click();
      ok('deleting a block on the Time screen records the delete for the other phone', !!del && !DB.timelog().some(s => s.id === 'b5') && !!timelogDels().b5);
      ttSelSeg = null;
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'b2', act: 'work', start: t - 7200000, end: t - 3600000, upd: t - 7200000 }]));
      applyRemoteState({ touched: t - 99999999, timelog: [], timelogDel: { b2: t - 1000 } });
      ok('a block deleted on the other phone goes here too, even from an older save', !DB.timelog().some(s => s.id === 'b2'));
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'b3', act: 'work', start: t - 7200000, end: t - 3600000, upd: t }]));
      applyRemoteState({ touched: t + 5, timelog: [], timelogDel: { b3: t - 1000 } });
      ok('…unless it was edited after that delete', DB.timelog().some(s => s.id === 'b3'));
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'b4', act: 'work', start: t - 7200000, end: t - 3600000, upd: t - 7200000 }]));
      localStorage.setItem('dp.timelogDel', '{}'); localStorage.setItem('dp.touched', String(t - 3600000));   // the other phone saved later
      applyRemoteState({ touched: t + 10, timelog: [] });
      ok('a state from an older app version (no tombstones) still deletes the old way', !DB.timelog().some(s => s.id === 'b4'));
      ok('tombstones go up with every push', (pushState(true), sent.length && 'timelogDel' in sent[sent.length - 1]));
      // the last save before a kill: a pull with nothing new still sends ours
      sent.length = 0;
      localStorage.setItem('dp.timelog', '[]'); localStorage.setItem('dp.touched', String(t + 50000));
      applyRemoteState({ touched: t, timelog: [], timelogDel: {} });
      ok('a pull with nothing new still pushes this phone\'s unsent changes', sent.some(x => x.type === 'state'));
      sent.length = 0;
      pushState();                                       // debounced
      window.dispatchEvent(new Event('pagehide'));
      ok('hiding or closing the app sends a push still waiting out its debounce', sent.some(x => x.type === 'state') && !_pushPending);
    } finally {
      window.fetch = fSnap; window.toast = tSnap; clearTimeout(pushTimer); _pushPending = null;
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      navigateTo('today');
    }
  })();

  // ---- two phones, one Sheet: what the Time tracker and the Gym fill in is not an edit of the day ----
  /* Writing the time summary or a gym tick into the day bumped its updatedAt, and the sync gives
     every shared field of a day to the newer updatedAt. So a phone that had not pulled yet
     (re-summing a running timer on every return to the app, a gym tick) carried its OLD mood and
     journal over what was typed on the other phone — on both phones. Each test runs both phones
     through the real save, push and pull. */
  (function () {
    const PK = ['dp.entries', 'dp.timelog', 'dp.timelogDel', 'dp.touched', 'dp.gym', 'dp.gymAt'];
    const keys = [...PK, 'dp.settings', 'dp.listAt', 'dp.listDel'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const fSnap = window.fetch, sent = [];
    window.fetch = (u, o) => { try { sent.push(JSON.parse(o.body)); } catch (e) {} return Promise.resolve({ ok: true }); };
    const tSnap = window.toast; window.toast = () => {};
    const D = '2026-01-05', d0 = dayStartMs(D), H = 3600000, now = Date.now();
    const phones = {}; let on = null;
    const held = () => { const s = {}; PK.forEach(k => { s[k] = localStorage.getItem(k); }); return s; };
    const both = st => { phones.A = Object.assign({}, st); phones.B = Object.assign({}, st); on = null; };
    const use = p => {   // pick up phone p; the one put down keeps what it holds
      if (on) phones[on] = held();
      on = p; PK.forEach(k => { const v = phones[p][k]; if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); });
    };
    const lastState = () => { const s = sent.filter(x => x.type === 'state').pop(); return s && JSON.parse(JSON.stringify(s)); };
    const push = () => { clearTimeout(pushTimer); _pushPending = null; sent.length = 0; pushState(true); return lastState(); };   // what the Sheet then holds
    const tick = () => { const t = Date.now(); while (Date.now() <= t) { /* "later" must be a later millisecond */ } };
    const day = () => DB.entry(D) || {};
    const start = (entry, timelog) => both({ 'dp.entries': JSON.stringify({ [D]: entry }), 'dp.timelog': JSON.stringify(timelog),
      'dp.timelogDel': '{}', 'dp.touched': String(now - 2 * H), 'dp.gym': '{}', 'dp.gymAt': '{}' });
    const typed = { mood: 3, journal: 'morning', habits: {}, updatedAt: new Date(now - 2 * H).toISOString() };
    const blk1 = { id: 'tw1', act: 'work', start: d0 + 9 * H, end: d0 + 10 * H, upd: now - 3 * H };
    const blk2 = { id: 'tw2', act: 'work', start: d0 + 11 * H, end: d0 + 12 * H, upd: now - 60000 };
    try {
      const st = DB.settings(); st.syncUrl = 'https://example.invalid/exec'; DB.saveSettings(st);

      // 1. B, not yet synced, re-sums its time after the mood and journal were typed on A
      start(typed, [blk1]);
      use('A'); const a1 = day(); a1.mood = 8; a1.journal = 'evening, typed on A'; saveDraftNow(D, a1); push();
      tick(); use('B'); syncTimelogNow();
      const sum1 = day().timeSummary;
      ok('(B sums its time into the day, still holding the old mood)', !!sum1 && day().mood === 3, day());
      const sheetB = push();
      use('A'); sent.length = 0; applyRemoteState(sheetB);
      ok('two phones: a time summary written on a phone that had not synced does not undo the mood and journal typed on the other',
        day().mood === 8 && day().journal === 'evening, typed on A', day());
      ok('…and that summary arrives', day().timeSummary === sum1, day());
      use('B'); applyRemoteState(lastState());
      ok('…and the phone that summed gets the typing, keeping its summary', day().mood === 8 && day().journal === 'evening, typed on A' && day().timeSummary === sum1, day());
      const b1 = day(); use('A');
      ok('…so both phones end with the same day', canonJSON(day()) === canonJSON(b1), [day(), b1]);

      // 2. The other way round: typing on A, which holds an older summary, after B summed a newer one
      start(typed, [blk1]);
      use('A'); syncTimelogNow(); const sumOld = day().timeSummary; both(held());   // both phones synced, one block summed
      tick(); use('B'); localStorage.setItem('dp.timelog', JSON.stringify([blk1, blk2])); syncTimelogNow();
      const sumNew = day().timeSummary;
      ok('(B tracked another hour: a new summary)', !!sumOld && !!sumNew && sumNew !== sumOld, [sumOld, sumNew]);
      const sheetB2 = push();
      tick(); use('A'); const a2 = day(); a2.mood = 9; saveDraftNow(D, a2);
      sent.length = 0; applyRemoteState(sheetB2);
      ok('two phones: typing on a phone that holds an older time summary does not carry it over the newer one', day().timeSummary === sumNew && day().mood === 9, day());
      use('B'); applyRemoteState(lastState());
      ok('…on the other phone either', day().timeSummary === sumNew && day().mood === 9, day());

      // 3. A gym tick on B, not yet synced, after the journal was typed on A
      start(typed, []);
      use('A'); const a3 = day(); a3.journal = 'gym after work'; saveDraftNow(D, a3); push();
      tick(); use('B'); persistGym(true, D, { done: { 'd1/e1': true }, log: {} });
      ok('(B ticks an exercise into the day, still holding the old journal)', day().workoutsDone === 1 && day().journal === 'morning', day());
      const sheetB3 = push();
      use('A'); sent.length = 0; applyRemoteState(sheetB3);
      ok('two phones: a gym tick on a phone that had not synced does not undo the journal typed on the other', day().journal === 'gym after work' && day().workoutsDone === 1, day());
      use('B'); applyRemoteState(lastState());
      ok('…and the phone that ticked gets the journal', day().journal === 'gym after work' && day().workoutsDone === 1, day());
      const same = JSON.parse(JSON.stringify(day()));
      same.autoAt = Object.keys(same.autoAt || {}).reverse().reduce((o, k) => { o[k] = same.autoAt[k]; return o; }, {});
      localStorage.setItem('dp.touched', String(now + 10)); sent.length = 0;
      applyRemoteState({ touched: now + 10, entries: { [D]: same } });
      ok('the same day with its stamps in another order is not a difference (no push back and forth)',
        Object.keys(same.autoAt).length === 2 && !sent.some(x => x.type === 'state'), sent.length);

      // 4. A Log draft opened before the timer re-summed the day: its autosave keeps the new summary AND its stamp
      start(typed, [blk1]);
      use('B'); syncTimelogNow();
      const opened = JSON.parse(JSON.stringify(day()));   // what loadDraft holds
      tick(); localStorage.setItem('dp.timelog', JSON.stringify([blk1, blk2])); syncTimelogNow();
      const t4 = (day().autoAt || {}).timeSummary, sum4 = day().timeSummary;
      tick(); opened.mood = 6; saveDraftNow(D, opened);
      ok('a Log autosave from a draft opened earlier keeps the newer time summary and its stamp',
        !!t4 && day().timeSummary === sum4 && day().mood === 6 && (day().autoAt || {}).timeSummary === t4, [t4, day()]);
      applyRemoteState({ touched: Date.now() + 5000, entries: { [D]: Object.assign({}, day(), { timeSummary: 'older, from A', autoAt: { timeSummary: t4 - 1 } }) } });
      ok('…so the other phone\'s older summary does not win', day().timeSummary === sum4, day());

      // 5. Both phones track the same day before either has pulled: the summary must cover both phones' blocks
      const blkA = { id: 'tA', act: 'work', start: d0 + 9 * H, end: d0 + 11 * H, upd: now - 50000 };
      const blkB = { id: 'tB', act: 'gymt', start: d0 + 18 * H, end: d0 + 19 * H, upd: now - 40000 };
      start(typed, []);
      use('A'); localStorage.setItem('dp.timelog', JSON.stringify([blkA])); syncTimelogNow();
      const sheetA5 = push();
      tick(); use('B'); localStorage.setItem('dp.timelog', JSON.stringify([blkB])); syncTimelogNow();
      ok('(each phone sums only its own block; B\'s summary is the newer one)',
        /Gym/.test(day().timeSummary || '') && !/Work/.test(day().timeSummary || ''), day());
      sent.length = 0; applyRemoteState(sheetA5);
      ok('two phones tracking the same day: after the pull the summary covers both phones\' blocks',
        /Work 2h/.test(day().timeSummary || '') && /Gym 1h/.test(day().timeSummary || '') && DB.timelog().length === 2, day());
      ok('…and the mood typed earlier is untouched', day().mood === 3 && day().journal === 'morning', day());
      const sum5 = day().timeSummary, sheetB5 = lastState();
      ok('…and the corrected summary is pushed', !!sheetB5 && (sheetB5.entries[D] || {}).timeSummary === sum5, sheetB5 && sheetB5.entries[D]);
      use('A'); sent.length = 0; applyRemoteState(sheetB5);
      ok('…so the other phone ends with the same summary', day().timeSummary === sum5, day());
      const settledA = lastState(); use('B'); sent.length = 0;
      if (settledA) applyRemoteState(settledA);
      ok('…and it settles: no further push back and forth', !sent.some(x => x.type === 'state') && day().timeSummary === sum5, [sent.length, day()]);

      // 6. Deleting the day's last block drops its summary, here and on the other phone
      start(typed, [blk1]);
      use('A'); syncTimelogNow();
      ok('(the day has a summary)', !!day().timeSummary, day());
      both(held());
      tick(); use('A');
      timelogForget('tw1'); DB.saveTimelog(DB.timelog().filter(s => s.id !== 'tw1'));
      clearTimeout(timelogSyncTimer); syncTimelogNow();
      ok('deleting the last block of a day removes its time summary', !('timeSummary' in day()) && +(day().autoAt || {}).timeSummary > 0, day());
      const delRow = sent.filter(x => x.type === 'entry' && x.date === D).pop();
      ok('…and the Sheet row is rewritten without it', !!delRow && delRow.timeSummary === undefined, delRow);
      const sheetA6 = push();
      use('B'); sent.length = 0; applyRemoteState(sheetA6);
      ok('…and the other phone drops it too', !('timeSummary' in day()) && DB.timelog().length === 0 && day().mood === 3, day());
      start(typed, [blk1, blk2]);
      use('A'); syncTimelogNow(); const sumTwo = day().timeSummary;
      tick(); DB.saveTimelog(DB.timelog().filter(s => s.id !== 'tw2')); clearTimeout(timelogSyncTimer); syncTimelogNow();
      ok('deleting one of two blocks re-sums the day from the one left', !!sumTwo && /Work 1h/.test(day().timeSummary || '') && day().timeSummary !== sumTwo, [sumTwo, day().timeSummary]);

      // review #2: a Log draft opened BEFORE the last block was deleted still holds the old summary;
      // its autosave must not bring the summary back (with the deletion's newer stamp on it)
      start(typed, [blk1]);
      use('A'); syncTimelogNow();
      const opened7 = JSON.parse(JSON.stringify(day()));   // what loadDraft holds
      ok('(the opened draft holds a summary)', !!opened7.timeSummary, opened7);
      tick(); timelogForget('tw1'); DB.saveTimelog([]); clearTimeout(timelogSyncTimer); syncTimelogNow();
      ok('(the deletion dropped it)', !('timeSummary' in day()), day());
      tick(); opened7.mood = 7; saveDraftNow(D, opened7);
      ok('review #2: a stale Log draft does not bring back a deleted time summary',
        !('timeSummary' in day()) && day().mood === 7 && +(day().autoAt || {}).timeSummary > 0, day());
      const gymOpen = JSON.parse(JSON.stringify(Object.assign(day(), { workoutsDone: 2, workoutDetail: 'stale' })));
      delete gymOpen.autoAt;   // a draft from before any stamp existed
      tick(); gymOpen.mood = 5; saveDraftNow(D, gymOpen);
      ok('review #2: …nor workout fields the stored day does not have', !('workoutsDone' in day()) && !('workoutDetail' in day()) && day().mood === 5, day());

      // 7. A stale Log draft saved in the background after a pull must not delete what the pull brought
      start(typed, []);
      use('A'); logDate = D; loadDraft();                      // A holds a draft of D without the evening journal
      use('B'); const b7 = day(); b7.journal = 'evening, typed on B'; saveDraftNow(D, b7); const sheetB7 = push();
      tick(); use('A'); logDate = D; loadDraft(); sent.length = 0;
      const onScr = [...document.querySelectorAll('.screen.on')]; onScr.forEach(el => el.classList.remove('on'));   // the Log is not on screen
      try { applyRemoteState(sheetB7); } finally { onScr.forEach(el => el.classList.add('on')); }
      ok('(the pull brought B\'s journal to A)', day().journal === 'evening, typed on B', day());
      saveDraftNow(D, draft);                                   // what syncHealth does with the global draft, Log not on screen
      ok('a background save of the Log draft after a pull keeps what the pull brought', day().journal === 'evening, typed on B', day());
      const sheetA7 = push(); use('B'); applyRemoteState(sheetA7);
      ok('…and nothing is deleted on the other phone', day().journal === 'evening, typed on B', day());

      // 8. review 2026-11-22: a Log draft staler than storage cannot delete or revert what it never saw.
      //    (With per-field stamps such a save removed the fields it lacked on every phone.)
      const draftSnap8 = draft, logSnap8 = logDate;
      try {
        // 8a. a cold start on another tab never loads the draft; a background save of it (the old syncHealth)
        start(typed, []);
        use('A'); const a8 = day(); a8.habits = { gym: true }; saveDraftNow(D, a8);
        tick(); logDate = D; draft = {}; _draftBase.set(draft, {});    // the app's never-loaded draft
        draft.sleepHours = 7.2; saveDraftNow(D, draft);
        ok('review 2026-11-22: a never-loaded draft saved in the background keeps the stored mood, journal and habits',
          day().mood === 3 && day().journal === 'morning' && day().habits.gym === true && day().sleepHours === 7.2, day());
        const sheetA8 = push(); use('B'); applyRemoteState(sheetA8);
        ok('…and the other phone keeps them too', day().mood === 3 && day().journal === 'morning' && day().sleepHours === 7.2, day());

        // 8b. two tabs of one browser: tab 2 wrote the journal after tab 1 loaded its draft
        start(typed, []);
        use('A'); logDate = D; loadDraft();                           // tab 1 opens the Log
        tick(); const t2 = day(); t2.journal = 'long entry typed in tab 2'; DB.putEntry(D, Object.assign(t2, { updatedAt: new Date().toISOString() }));
        tick(); draft.mood = 8; saveDraftNow(D, draft);               // one mood tap in tab 1
        ok('review 2026-11-22: a mood tap in a tab opened earlier keeps the journal another tab wrote since',
          day().journal === 'long entry typed in tab 2' && day().mood === 8, day());
        tick(); draft.journal = 'tab 1 rewrote it'; saveDraftNow(D, draft);
        ok('…but a field the draft itself changed is saved as typed', day().journal === 'tab 1 rewrote it' && day().mood === 8, day());

        // 8c. midnight with the Log off screen: yesterday's draft is saved into today
        const Dy = addDays(D, -1);
        start(typed, []);
        use('A'); DB.putEntry(Dy, { mood: 2, journal: 'rough day', habits: { gym: true }, updatedAt: new Date(now - 20 * H).toISOString() });
        localStorage.setItem('dp.entries', JSON.stringify({ [D]: { journal: 'grateful for coffee', habits: {}, updatedAt: new Date().toISOString() }, [Dy]: DB.entry(Dy) }));
        logDate = Dy; loadDraft(); logDate = D;                       // logRollover moves the date, keeps the object
        tick(); draft.sleepHours = 7; saveDraftNow(D, draft);
        ok('review 2026-11-22: yesterday\'s draft saved into today keeps today\'s journal and brings none of yesterday',
          day().journal === 'grateful for coffee' && day().mood === undefined && !(day().habits || {}).gym && day().sleepHours === 7, day());

        // 8d. a phone whose clock runs behind still makes the person's latest edit win
        const ahead = Date.now() + 3600000;
        const st = entryFieldStamp({ mood: 8, fieldAt: { mood: ahead } }, { mood: 3 });
        ok('review 2026-11-22: an edit on a phone whose clock is behind is stamped after the stamp it replaces',
          st.fieldAt.mood > ahead, st.fieldAt);
        const au = entryAutoSet({ workoutsDone: 1, autoAt: { workoutsDone: ahead } }, { workoutsDone: 2 });
        ok('…and so is a gym count or time summary', au.autoAt.workoutsDone > ahead, au.autoAt);
      } finally { draft = draftSnap8; logDate = logSnap8; }

      // timelogChangedDays, directly
      const D2 = addDays(D, 1), sOv = { id: 'ov', act: 'sleep', start: d0 + 23 * H, end: d0 + 31 * H };
      ok('a block across midnight marks both days', [...timelogChangedDays([], [sOv])].join() === [D, D2].join());
      ok('an unchanged log marks nothing', timelogChangedDays([blk1, sOv], [blk1, sOv]).size === 0);
      ok('a block moved to another day marks the old day and the new', (() => { const m = timelogChangedDays([blk1], [Object.assign({}, blk1, { start: d0 + 33 * H, end: d0 + 34 * H })]); return m.has(D) && m.has(D2); })());
      ok('junk in either list is ignored', timelogChangedDays('x', [null, {}, { id: 'n' }]).size === 0);

      // mergeAuto, directly
      const iso = t => new Date(t).toISOString(), N = Date.now();
      let m = mergeAuto({ timeSummary: 'newer', autoAt: { timeSummary: N - 1000 }, updatedAt: iso(N - 9000) },
        { timeSummary: 'older', autoAt: { timeSummary: N - 5000 }, updatedAt: iso(N) }, {});
      ok('the newer summary wins, whichever phone edited the day last', m.timeSummary === 'newer' && m.autoAt.timeSummary === N - 1000, m);
      m = mergeAuto({ workoutsDone: 2, autoAt: { workoutsDone: N - 5000 } }, { workoutsDone: 3, updatedAt: iso(N - 1000) }, {});
      ok('a day from an older app version (no stamps): its updatedAt stands in', m.workoutsDone === 3 && m.autoAt.workoutsDone === N - 1000, m);
      m = mergeAuto({ timeSummary: 'x', autoAt: { timeSummary: N - 5000 } }, { mood: 4, updatedAt: iso(N) }, { timeSummary: 'x', mood: 4 });
      ok('a side that never had the field cannot drop it', m.timeSummary === 'x', m);
      m = mergeAuto({ timeSummary: 's', updatedAt: iso(N) }, { timeSummary: 's', updatedAt: iso(N - 5) }, { timeSummary: 's' });
      ok('days without stamps on either side gain none', !('autoAt' in m), m);
      let threw = null; try { mergeAuto('junk', { autoAt: 'no', timeSummary: 'y' }, {}); mergeAuto({ autoAt: [1] }, null, {}); } catch (e) { threw = e; }
      ok('a day in the wrong shape merges as having no stamps, rather than throwing', !threw, threw && threw.message);
      ok('the stamps are not content: a day holding only them is not a logged day', !entryHasContent({ workoutsDone: 0, workoutDetail: '', autoAt: { workoutsDone: N } }));
    } finally {
      window.fetch = fSnap; window.toast = tSnap; clearTimeout(pushTimer); _pushPending = null; clearTimeout(timelogSyncTimer);
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      navigateTo('today');
    }
  })();

  // ---- two phones: what the sync fuzzer found (tests/sync-fuzz.js, 2026-11-22) ----
  (function () {
    const PK = ['dp.entries', 'dp.timelog', 'dp.timelogDel', 'dp.touched', 'dp.gym', 'dp.gymAt', 'dp.tlDirty'];
    const keys = [...PK, 'dp.settings', 'dp.listAt', 'dp.listDel'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const fSnap = window.fetch, sent = [];
    window.fetch = (u, o) => { try { sent.push(JSON.parse(o.body)); } catch (e) {} return Promise.resolve({ ok: true }); };
    const tSnap = window.toast; window.toast = () => {};
    const D = '2026-01-07', d0 = dayStartMs(D), H = 3600000, now = Date.now();
    const phones = {}; let on = null;
    const held = () => { const s = {}; PK.forEach(k => { s[k] = localStorage.getItem(k); }); return s; };
    const all = st => { ['A', 'B', 'C'].forEach(p => { phones[p] = Object.assign({}, st); }); on = null; };
    const use = p => {
      if (on) phones[on] = held();
      on = p; PK.forEach(k => { const v = phones[p][k]; if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); });
    };
    const lastState = () => { const s = sent.filter(x => x.type === 'state').pop(); return s && JSON.parse(JSON.stringify(s)); };
    const push = () => { clearTimeout(pushTimer); _pushPending = null; sent.length = 0; pushState(true); return lastState(); };
    const pull = st => { sent.length = 0; applyRemoteState(JSON.parse(JSON.stringify(st))); return lastState(); };
    const tick = () => { const t = Date.now(); while (Date.now() <= t) { /* a later millisecond */ } };
    const day = () => DB.entry(D) || {};
    const start = (entry, timelog) => all({ 'dp.entries': JSON.stringify({ [D]: entry }), 'dp.timelog': JSON.stringify(timelog || []),
      'dp.timelogDel': '{}', 'dp.touched': String(now - 2 * H), 'dp.gym': '{}', 'dp.gymAt': '{}' });
    const typed = { mood: 3, journal: 'morning', habits: {}, updatedAt: new Date(now - 2 * H).toISOString() };
    try {
      const st = DB.settings(); st.syncUrl = 'https://example.invalid/exec'; DB.saveSettings(st);

      // gym-count-not-rederived: the day's workout count follows the MERGED ticks
      start(typed);
      use('A'); persistGym(true, D, { done: { 'd1/e1': true }, log: {} }); const sheetA = push();
      tick(); use('B'); persistGym(true, D, { done: { 'd1/e2': true }, log: { 'd1/e2': '3x5' } });
      ok('(each phone ticked one exercise; B wrote its count last)', day().workoutsDone === 1, day());
      const sheetB = pull(sheetA);
      ok('gym: after a pull brings the other phone\'s tick, the day counts both phones\' ticks',
        day().workoutsDone === 2 && Object.keys(DB.gymDay(D).done).length === 2, [day(), DB.gymDay(D)]);
      ok('…and its workout list names both, the typed log included', (day().workoutDetail || '').split('; ').length === 2 && /3x5/.test(day().workoutDetail || ''), day().workoutDetail);
      ok('…stamped, not an edit by hand', +(day().autoAt || {}).workoutsDone > 0 && day().updatedAt === typed.updatedAt && day().mood === 3, day());
      use('A'); const back = pull(sheetB);
      ok('…and the other phone ends with the same count', day().workoutsDone === 2, day());
      const a = day(); use('B'); if (back) pull(back);
      ok('…and it settles: the same day on both phones, no push back and forth', canonJSON(day()) === canonJSON(a) && !sent.some(x => x.type === 'state'), [sent.length, day(), a]);
      // an un-tick that arrives by a pull lowers the count
      tick(); use('A'); persistGym(true, D, { done: { 'd1/e1': false, 'd1/e2': true }, log: { 'd1/e2': '3x5' } }); const sheetA2 = push();
      use('B'); pull(sheetA2);
      ok('gym: an un-tick pulled from the other phone lowers the count', day().workoutsDone === 1 && !/e1/.test(day().workoutDetail || ''), day());

      // summary-stale-after-kill: the days a delete emptied survive the app being killed
      const blk = { id: 'tk1', act: 'work', start: d0 + 9 * H, end: d0 + 10 * H, upd: now - 3 * H };
      start(typed, []);
      use('A'); DB.saveTimelog([blk]); clearTimeout(timelogSyncTimer); syncTimelogNow(); const sum = day().timeSummary;
      ok('(A tracked an hour: the day has a summary)', !!sum, day());
      tick(); timelogForget('tk1'); DB.saveTimelog([]);
      clearTimeout(timelogSyncTimer); _tlDirty.clear();   // killed before the debounced re-sum: memory is gone
      ok('kill: the day the delete emptied is remembered on disk', JSON.parse(localStorage.getItem('dp.tlDirty') || '[]').includes(D), localStorage.getItem('dp.tlDirty'));
      const sheetK = push();
      use('B'); pull(sheetK);
      ok('(B never held the block: its log did not change, so it did not re-sum the day)', day().timeSummary === sum && !DB.timelog().length, day());
      use('A'); syncTimelogNow();   // the next open (or the next re-sum)
      ok('kill: the next re-sum drops the emptied day\'s summary, stamped', !('timeSummary' in day()) && +(day().autoAt || {}).timeSummary > 0, day());
      ok('…and forgets the dirty days once summed', localStorage.getItem('dp.tlDirty') == null, localStorage.getItem('dp.tlDirty'));
      const sheetK2 = push();
      use('B'); pull(sheetK2);
      ok('…and the other phone drops the summary too', !('timeSummary' in day()) && day().mood === 3, day());
      ok('the dirty days are install state, not backed up', BACKUP_EXCLUDED.includes('tlDirty') && !BACKUP_KEYS.includes('tlDirty'));

      // day-lww-stale-save: a save of the whole day on a phone that has not pulled carries only
      // what it changed, not its old copy of the other fields
      const HK = 'stale-tick-habit';
      const habitTick = () => { const en = JSON.parse(JSON.stringify(day())); en.habits = Object.assign({}, en.habits, { [HK]: true }); en.habitsAt = Object.assign({}, en.habitsAt, { [HK]: Date.now() }); saveDraftNow(D, en); };
      const typed2 = Object.assign({}, typed, { sleepHours: 7 });   // saved before the field stamps: no fieldAt
      start(typed2);
      use('A'); const s1 = day(); s1.mood = 8; s1.journal = 'evening, typed on A'; saveDraftNow(D, s1); const sheetS1 = push();
      tick(); use('B'); habitTick();
      ok('(B ticks a habit, still holding the old mood and journal)', day().mood === 3 && day().habits[HK] === true, day());
      const sheetS2 = push();
      use('A'); const backS = pull(sheetS2);
      ok('stale save: a habit tick on a phone that had not pulled does not undo the mood and journal typed on the other',
        day().mood === 8 && day().journal === 'evening, typed on A' && day().habits[HK] === true, day());
      use('B'); const backS2 = backS ? pull(backS) : null;
      ok('…and the phone that ticked gets the typing', day().mood === 8 && day().journal === 'evening, typed on A' && day().habits[HK] === true, day());
      const sb = day(); use('A'); if (backS2) pull(backS2);
      ok('…so both phones end with the same day, and it settles', canonJSON(day()) === canonJSON(sb) && !sent.some(x => x.type === 'state'), [sent.length, day(), sb]);
      // a journal edit on the stale phone, a mood typed on the other: both survive
      start(typed2);
      use('A'); const s3 = day(); s3.mood = 9; saveDraftNow(D, s3); const sheetS3 = push();
      tick(); use('B'); const s4 = day(); s4.journal = 'typed on B'; saveDraftNow(D, s4); const sheetS4 = push();
      use('A'); pull(sheetS4);
      ok('stale save: a journal typed on one phone and a mood on the other both survive', day().mood === 9 && day().journal === 'typed on B' && day().sleepHours === 7, day());
      use('B'); pull(sheetS3);
      ok('…on the other phone too', day().mood === 9 && day().journal === 'typed on B', day());
      // the same field on both phones: the later write wins, whichever phone pulls
      start(typed2);
      use('A'); const s5 = day(); s5.mood = 5; saveDraftNow(D, s5); const sheetS5 = push();
      tick(); use('B'); const s6 = day(); s6.mood = 6; saveDraftNow(D, s6); const sheetS6 = push();
      use('A'); pull(sheetS6); const mA = day().mood; use('B'); pull(sheetS5);
      ok('the same field typed on both phones: the later one wins on both', mA === 6 && day().mood === 6, [mA, day()]);
      // a field removed on one phone stays removed under a stale save of the day on the other
      start(typed2);
      use('A'); const s7 = day(); delete s7.sleepHours; saveDraftNow(D, s7); const sheetS7 = push();
      ok('(the removal is stamped)', !('sleepHours' in day()) && +(day().fieldAt || {}).sleepHours > 0, day());
      tick(); use('B'); const s8 = day(); s8.mood = 4; saveDraftNow(D, s8); const sheetS8 = push();
      use('A'); pull(sheetS8);
      ok('stale save: a field removed on the other phone does not come back', !('sleepHours' in day()) && day().mood === 4, day());
      use('B'); pull(sheetS7);
      ok('…on that phone either', !('sleepHours' in day()) && day().mood === 4, day());
      // an older app version (no stamps): its updatedAt stands for every field it holds
      start(typed2);
      use('A'); const s9 = day(); s9.mood = 8; saveDraftNow(D, s9);
      const tA = +day().fieldAt.mood;
      const oldApp = (mood, journal, at) => ({ touched: Date.now() + 1000, entries: { [D]: { mood, journal, habits: {}, sleepHours: 7, updatedAt: new Date(at).toISOString() } } });
      pull(oldApp(2, 'older app, later', tA + 5000));
      ok('an older app\'s save after the stamps wins every field it holds', day().mood === 2 && day().journal === 'older app, later', day());
      start(typed2);
      use('A'); const s10 = day(); s10.mood = 8; saveDraftNow(D, s10);
      pull(oldApp(3, 'older app, between', +day().fieldAt.mood - 1000));
      ok('…an older app\'s save from before an edit loses that field and wins the ones not edited since',
        day().mood === 8 && day().journal === 'older app, between', day());

      // day-lww-gap-fill (three phones): a field filled from an older copy keeps its own stamp
      start({ journal: 'j0', habits: {}, updatedAt: new Date(now - 2 * H).toISOString() });
      use('A'); const g1 = day(); g1.mood = 4; saveDraftNow(D, g1); const sheetG1 = push();
      tick(); use('C'); const g2 = day(); g2.mood = 10; saveDraftNow(D, g2);   // the latest mood, not pushed yet
      tick(); use('B'); const g3 = day(); g3.journal = 'j1 on B'; saveDraftNow(D, g3);   // B has no mood at all
      const sheetG2 = pull(sheetG1);
      ok('(B filled the mood from A\'s copy)', day().mood === 4 && day().journal === 'j1 on B', day());
      use('C'); pull(sheetG2 || push());
      ok('gap fill: a mood filled in from an older copy does not beat a later mood typed on a third phone', day().mood === 10 && day().journal === 'j1 on B', day());

      // the stamps themselves
      const iso = t => new Date(t).toISOString(), N = Date.now();
      const st1 = entryFieldStamp({ mood: 3, journal: 'a', habits: {}, updatedAt: iso(N - 9000) }, { mood: 4, journal: 'a', habits: { x: true }, updatedAt: iso(N) });
      ok('first save since the stamps: the changed field is stamped now, the others at the day\'s old updatedAt',
        st1.fieldAt.mood >= N && st1.fieldAt.journal === N - 9000 && !('habits' in st1.fieldAt), st1);
      const st2 = entryFieldStamp(st1, Object.assign(JSON.parse(JSON.stringify(st1)), { updatedAt: iso(N + 50), fieldAt: { mood: 1, journal: 1 } }));
      ok('a save that changes nothing keeps the stored stamps (not the draft\'s)', canonJSON(st2.fieldAt) === canonJSON(st1.fieldAt), [st1.fieldAt, st2.fieldAt]);
      ok('the stamps are sorted, so the same day is the same JSON on every phone', Object.keys(entryFieldStamp({}, { zeta: 1, alpha: 2, mood: 3 }).fieldAt).join() === 'alpha,mood,zeta');
      ok('the field stamps are not content: a day holding only them is not a logged day',
        !entryHasContent({ fieldAt: { mood: N }, updatedAt: iso(N) }) && !loggedByHand({ fieldAt: { mood: N }, updatedAt: iso(N) }));
      start(typed);
      use('A'); persistGym(true, D, { done: { 'd1/e1': true }, log: {} });
      ok('a gym tick (a fill-in, not an edit) adds no field stamps', !('fieldAt' in day()) && day().updatedAt === typed.updatedAt, day());
      const ma = { mood: 5, journal: 'x', fieldAt: { mood: N - 100 }, updatedAt: iso(N - 100) }, mb = { mood: 6, journal: 'x', fieldAt: { mood: N - 100 }, updatedAt: iso(N - 50) };
      ok('one stamp, two values: both phones pick the same copy', canonJSON(mergeFields(ma, mb, Object.assign({}, ma, mb))) === canonJSON(mergeFields(mb, ma, Object.assign({}, ma, mb))) && mergeFields(ma, mb, {}).mood === 6);
      let threw2 = null; try { mergeFields('junk', { fieldAt: 'no', mood: 1 }, {}); mergeFields({ fieldAt: [1] }, null, {}); entryFieldStamp(null, {}); } catch (e) { threw2 = e; }
      ok('a day in the wrong shape merges as having no field stamps, rather than throwing', !threw2, threw2 && threw2.message);
    } finally {
      window.fetch = fSnap; window.toast = tSnap; clearTimeout(pushTimer); _pushPending = null; clearTimeout(timelogSyncTimer); _tlDirty.clear();
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      navigateTo('today');
    }
  })();

  // ---- v253: lists sync item by item (tasks, notes, money, …) ----
  (function () {
    const keys = ['dp.notes', 'dp.tasks', 'dp.fintx', 'dp.entries', 'dp.timelog', 'dp.timelogDel', 'dp.listAt', 'dp.listDel', 'dp.touched', 'dp.settings'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const fSnap = window.fetch, sent = [];
    window.fetch = (u, o) => { try { sent.push(JSON.parse(o.body)); } catch (e) {} return Promise.resolve({ ok: true }); };
    const tSnap = window.toast, toasts = []; window.toast = (m) => toasts.push(m);
    const ids = l => l.map(x => x.id).join(',');
    try {
      // mergeList, directly
      const A = { id: 'a', text: 'a' }, B = { id: 'b', text: 'b' }, C = { id: 'c', text: 'c' };
      let m = mergeList([{ id: 'n1', text: 'mine' }, A], [{ id: 'n2', text: 'theirs' }, A], { n1: 200 }, { n2: 300 }, {}, {}, true);
      ok('a new item on each phone: both kept', ids(m.list) === 'n1,n2,a' || ids(m.list) === 'n2,n1,a', ids(m.list));
      ok('…the newer side\'s order, the other side\'s new item where it was (top)', ids(m.list) === 'n1,n2,a', ids(m.list));
      ok('…and both stamps kept', m.at.n1 === 200 && m.at.n2 === 300);
      m = mergeList([A, B], [A, B, C], {}, { c: 500 }, {}, {}, false);
      ok('an item the other phone added arrives even when this phone saved last', ids(m.list) === 'a,b,c', ids(m.list));
      m = mergeList([A, B, C], [A, B], { c: 500 }, {}, {}, {}, true);
      ok('…and one added here survives the other phone\'s later save', ids(m.list) === 'a,b,c', ids(m.list));
      const N = Date.now() - 864e5;
      m = mergeList([A], [A, B], {}, { b: N }, { b: N + 100 }, {}, true);
      ok('an item deleted here does not come back from the other phone', ids(m.list) === 'a' && m.del.b === N + 100 && !('b' in m.at), ids(m.list));
      m = mergeList([A, B], [A], { b: N }, {}, {}, { b: N + 100 }, false);
      ok('an item deleted on the other phone goes here too, even from its older save', ids(m.list) === 'a', ids(m.list));
      m = mergeList([A, { id: 'b', text: 'edited' }], [A], { b: N + 200 }, {}, {}, { b: N + 100 }, true);
      ok('…unless it was edited after that delete', m.list[1] && m.list[1].text === 'edited');
      m = mergeList([{ id: 'a', text: 'here, later' }], [{ id: 'a', text: 'there' }], { a: 900 }, { a: 100 }, {}, {}, true);
      ok('the later edit of one item wins, whichever phone saved last', m.list[0].text === 'here, later');
      m = mergeList([{ id: 'a', text: 'here' }], [{ id: 'a', text: 'there' }], {}, {}, {}, {}, true);
      ok('unstamped (older than the stamps): the phone that saved last wins, as before', m.list[0].text === 'there');
      m = mergeList([A, B], [A], {}, {}, {}, {}, true);
      ok('…and an unstamped item missing from the later save goes, as before', ids(m.list) === 'a');
      m = mergeList([A, B], [A], {}, {}, {}, {}, false);
      ok('…but stays when this phone saved last', ids(m.list) === 'a,b');
      m = mergeList([A, B, C], [C, B, A], {}, {}, {}, {}, true);
      ok('a reorder follows the phone that saved last', ids(m.list) === 'c,b,a');
      m = mergeList([A, { id: 'x', text: 'x' }, B], [A, B], { x: 50 }, {}, {}, {}, true);
      ok('a new item is placed after the one it followed', ids(m.list) === 'a,x,b', ids(m.list));
      m = mergeList([A], [A], {}, {}, { old: Date.now() - 91 * 864e5 }, {}, false);
      ok('delete records older than 90 days are dropped', !('old' in m.del));

      // listSave: stamps what changed, records what went, nothing else
      localStorage.setItem('dp.listAt', '{}'); localStorage.setItem('dp.listDel', '{}');
      localStorage.setItem('dp.notes', JSON.stringify([{ id: 'n1', text: 'one' }, { id: 'n2', text: 'two' }]));
      const list = DB.notes(); list[1].text = 'two!'; DB.saveNotes(list);
      let at = listMeta('dp.listAt').notes || {};
      ok('saving a list stamps only the item that changed', !!at.n2 && !('n1' in at), at);
      ok('…and stores exactly what JSON.stringify would', localStorage.getItem('dp.notes') === JSON.stringify(list));
      const t0 = at.n2;
      DB.saveNotes(DB.notes());
      ok('saving it unchanged stamps nothing', (listMeta('dp.listAt').notes || {}).n2 === t0 && !('n1' in (listMeta('dp.listAt').notes || {})));
      DB.saveNotes(DB.notes().filter(n => n.id !== 'n1'));
      ok('deleting an item records when', !!(listMeta('dp.listDel').notes || {}).n1);
      localStorage.setItem('dp.notes', JSON.stringify([{ id: 'n2', text: 'two!' }, { id: 'n3', text: 'from a pull' }]));
      DB.saveNotes(DB.notes());
      ok('a list written by a pull is re-read, not diffed against the old one', !('n3' in (listMeta('dp.listAt').notes || {})));
      DB.saveNotes([...DB.notes(), { id: 'n4', text: 'new' }]);
      ok('a new item is stamped', !!(listMeta('dp.listAt').notes || {}).n4);

      // end to end
      const st = DB.settings(); st.syncUrl = 'https://example.invalid/exec'; DB.saveSettings(st);
      const now = Date.now();
      localStorage.setItem('dp.entries', '{}'); localStorage.setItem('dp.timelog', '[]'); localStorage.setItem('dp.timelogDel', '{}');
      localStorage.setItem('dp.listAt', '{}'); localStorage.setItem('dp.listDel', '{}');
      localStorage.setItem('dp.notes', JSON.stringify([{ id: 'old', text: 'old' }]));
      DB.saveNotes([{ id: 'mine', text: 'typed here' }, ...DB.notes()]);
      localStorage.setItem('dp.touched', String(now - 60000));
      sent.length = 0;
      applyRemoteState({ touched: now, notes: [{ id: 'theirs', text: 'typed there' }, { id: 'old', text: 'old' }], listAt: { notes: { theirs: now - 1000 } }, listDel: {}, entries: {}, timelog: [], timelogDel: {} });
      ok('a note typed here survives the other phone\'s later save that never saw it', DB.notes().some(n => n.id === 'mine'), ids(DB.notes()));
      ok('…and the other phone\'s note arrives', DB.notes().some(n => n.id === 'theirs'));
      ok('…and the merge goes back up', sent.some(x => x.type === 'state' && x.notes.some(n => n.id === 'mine') && x.notes.some(n => n.id === 'theirs')));
      ok('every push carries the stamps and delete records', sent.length && 'listAt' in sent[sent.length - 1] && 'listDel' in sent[sent.length - 1]);
      // nothing new came down, but the Sheet lacks this phone's note: push anyway
      localStorage.setItem('dp.touched', String(now - 5000));
      DB.saveNotes([{ id: 'late', text: 'unsent' }, ...DB.notes()]); localStorage.setItem('dp.touched', String(now - 5000));
      clearTimeout(pushTimer); _pushPending = null; sent.length = 0;
      const sheet = DB.notes().filter(n => n.id !== 'late');
      applyRemoteState({ touched: now, notes: sheet, listAt: { notes: listMeta('dp.listAt').notes }, listDel: listMeta('dp.listDel'), entries: {}, timelog: [], timelogDel: {} });
      ok('a pull that brings nothing new still sends what the Sheet lacks', sent.some(x => x.type === 'state' && x.notes.some(n => n.id === 'late')));
      // …and does not push when the Sheet already has it all
      localStorage.setItem('dp.touched', String(now + 10)); sent.length = 0;
      applyRemoteState({ touched: now + 10, notes: DB.notes(), listAt: { notes: listMeta('dp.listAt').notes }, listDel: listMeta('dp.listDel'), entries: {}, timelog: [], timelogDel: {} });
      ok('a pull of an identical state sends nothing', !sent.some(x => x.type === 'state'), sent.length);
      // two phones holding the same day with its keys in a different order: no push back and forth
      localStorage.setItem('dp.entries', JSON.stringify({ '2026-01-02': { mood: 5, journal: 'x', updatedAt: '2026-01-02T10:00:00.000Z' } }));
      localStorage.setItem('dp.touched', String(now + 10)); sent.length = 0;
      applyRemoteState({ touched: now + 10, entries: { '2026-01-02': { journal: 'x', updatedAt: '2026-01-02T10:00:00.000Z', mood: 5 } }, notes: DB.notes(), listAt: { notes: listMeta('dp.listAt').notes }, listDel: listMeta('dp.listDel'), timelog: [], timelogDel: {} });
      ok('the same day with its keys in another order is not a difference', !sent.some(x => x.type === 'state'), sent.length);
      // a time block only this phone has, the other phone saved later: push it
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'only-here', act: 'work', start: now - 7200000, end: now - 3600000, upd: now - 7200000 }]));
      localStorage.setItem('dp.touched', String(now - 99999)); sent.length = 0;
      applyRemoteState({ touched: now + 20, entries: JSON.parse(localStorage.getItem('dp.entries')), timelog: [], timelogDel: {}, notes: DB.notes(), listAt: { notes: listMeta('dp.listAt').notes }, listDel: listMeta('dp.listDel') });
      ok('a time block the Sheet lost to the other phone\'s save is sent again', DB.timelog().some(s => s.id === 'only-here') && sent.some(x => x.type === 'state' && x.timelog.some(s => s.id === 'only-here')));
      // a state from an older app version: the whole list, the old way
      localStorage.setItem('dp.tasks', JSON.stringify([{ id: 't1', text: 'kept?' }]));
      localStorage.setItem('dp.touched', String(now));
      applyRemoteState({ touched: now + 30, tasks: [{ id: 't2', text: 'theirs' }] });
      ok('a state from an older app version still replaces the list (no stamps to merge by)', ids(DB.tasks()) === 't2', ids(DB.tasks()));
      // a list in the wrong shape is refused and named
      toasts.length = 0;
      applyRemoteState({ touched: now + 40, tasks: 'garbage', listAt: {}, listDel: {} });
      ok('a list in the wrong shape is refused and named', Array.isArray(DB.tasks()) && toasts.some(t => /tasks/.test(t)));
      // restore: what it brings back is new, what it rolls back is old
      localStorage.setItem('dp.fintx', JSON.stringify([{ id: 'x1', a: 100 }, { id: 'x2', a: 999 }]));
      localStorage.setItem('dp.listAt', JSON.stringify({ fintx: { x1: now - 5000, x2: now - 5000 } }));
      localStorage.setItem('dp.listDel', JSON.stringify({ fintx: { x3: now - 4000 } }));
      const before = listIds(['fintx', 'entries']);
      localStorage.setItem('dp.fintx', JSON.stringify([{ id: 'x1', a: 100 }, { id: 'x2', a: 500 }, { id: 'x3', a: 42 }]));   // the backup
      listRestored(before, now - 10000);   // a backup taken 10 s ago
      const fa = listMeta('dp.listAt').fintx || {}, fd = listMeta('dp.listDel').fintx || {};
      ok('a restored item that was deleted here is stamped just past that delete, and the record goes', fa.x3 === now - 3999 && !('x3' in fd), { fa, fd });
      ok('a rolled-back item is stamped at the backup\'s time, so a newer edit on the other phone wins', fa.x2 === now - 10000, fa);
      ok('an item the restore left as it was keeps its stamp', fa.x1 === now - 5000, fa);
      m = mergeList(finTx(), [{ id: 'x2', a: 999 }, { id: 'x1', a: 100 }], fa, { x2: now - 5000, x1: now - 5000 }, fd, { x3: now - 4000 }, false);
      ok('…end to end: the restored item survives the pull, the newer edit wins', m.list.some(x => x.id === 'x3') && m.list.find(x => x.id === 'x2').a === 999);
      ok('list stamps are not in a backup', BACKUP_EXCLUDED.includes('listAt') && BACKUP_EXCLUDED.includes('listDel'));
      // review 5 (2026-11-02), #1: a backup restored on a NEW phone must not roll back edits made since
      const day = 864e5, tb = now - 3 * day;
      localStorage.removeItem('dp.fintx'); localStorage.removeItem('dp.listAt'); localStorage.removeItem('dp.listDel');
      const fresh = listIds(['fintx']);
      localStorage.setItem('dp.fintx', JSON.stringify([{ id: 'g', n: 'groceries v1' }]));   // the backup, taken at t0
      listRestored(fresh, tb);
      const ra = listMeta('dp.listAt').fintx || {};
      ok('on a new phone every restored item is stamped at the backup\'s time, not now', ra.g === tb, ra);
      m = mergeList(finTx(), [{ id: 'g', n: 'groceries v2 (edited 3 days later)' }], ra, { g: now - 1000 }, {}, {}, true);
      ok('…so an edit made on the other phone after the backup wins', m.list[0].n === 'groceries v2 (edited 3 days later)', m.list[0]);
      m = mergeList(finTx(), [{ id: 'g', n: 'groceries v0' }], ra, { g: tb - day }, {}, {}, true);
      ok('…and the backup beats a version older than it', m.list[0].n === 'groceries v1', m.list[0]);
      ok('backupTime: a new backup says when it was taken', backupTime(123456, { '2026-01-01': { updatedAt: '2026-06-01T00:00:00Z' } }) === 123456);
      ok('…an older backup counts as its newest day or time block', backupTime(undefined, { a: { updatedAt: '2026-06-01T00:00:00Z' }, b: null }, [{ upd: Date.parse('2026-07-01T00:00:00Z') }]) === Date.parse('2026-07-01T00:00:00Z'));
      ok('…and one with neither as very old', backupTime() === 1 && backupTime('x', 'junk', 'junk') === 1);
      ok('_at is a backup section that exportData writes and restore reads', BACKUP_EXTRA.includes('_at') && BACKUP_EXTRA.includes('_stamps'));
      // review 5, pass 2: a backup carries each item's own change time, and restores at it
      localStorage.setItem('dp.fintx', '[]'); localStorage.removeItem('dp.listAt');
      const fresh2 = listIds(['fintx']);
      localStorage.setItem('dp.fintx', JSON.stringify([{ id: 'p', n: 'old copy, exported by a phone that had not pulled' }, { id: 'q', n: 'q' }]));
      listRestored(fresh2, now - 1000, { at: { fintx: { p: now - 7 * day } } });   // the file is fresh, the item in it is a week old
      const r2 = listMeta('dp.listAt').fintx || {};
      ok('an item is restored at the time it last changed, from the backup\'s own stamps', r2.p === now - 7 * day && r2.q === now - 1000, r2);
      m = mergeList(finTx(), [{ id: 'p', n: 'edited on the other phone, before the file was exported' }, { id: 'q', n: 'q' }], r2, { p: now - 3600000, q: now - 1000 }, {}, {}, false);
      ok('…so an edit made elsewhere after that, even before the file, wins', /edited on the other phone/.test(m.list.find(x => x.id === 'p').n));
      ok('a restore overrides a delete record this phone holds, so the person gets back what they asked for', (() => { localStorage.setItem('dp.listDel', JSON.stringify({ fintx: { p: now - 500 } })); listRestored(fresh2, now - 1000, { at: { fintx: { p: now - 7 * day } } }); const a = listMeta('dp.listAt').fintx; return a.p === now - 499 && !(listMeta('dp.listDel').fintx || {}).p; })());
      // #2: a delete made on a phone still on an older app version must not come back
      localStorage.setItem('dp.notes', JSON.stringify([{ id: 'keep', text: 'k' }, { id: 'x', text: 'gone on the old phone' }]));
      localStorage.setItem('dp.listAt', JSON.stringify({ notes: { keep: now - 9000, x: now - 9000 } })); localStorage.removeItem('dp.listDel');
      localStorage.setItem('dp.touched', String(now - 9000));
      applyRemoteState({ touched: now - 100, notes: [{ id: 'keep', text: 'k' }] });   // the v252 phone's save: no listAt
      const oa = listMeta('dp.listAt').notes || {}, od = listMeta('dp.listDel').notes || {};
      ok('a list adopted whole from an older app drops what that save lacks, with no delete record and no stamp', ids(DB.notes()) === 'keep' && !('x' in od) && !('x' in oa), { oa, od });
      m = mergeList(DB.notes(), [{ id: 'keep', text: 'k' }, { id: 'x', text: 'gone on the old phone' }], oa, { keep: now - 9000, x: now - 9000 }, od, {}, true);
      ok('…so the other v253 phone brings it back (a resurrected delete beats a lost addition)', ids(m.list) === 'keep,x', ids(m.list));
      localStorage.setItem('dp.notes', JSON.stringify([{ id: 'keep', text: 'k' }, { id: 'new', text: 'added after the old phone saved' }]));
      localStorage.setItem('dp.listAt', JSON.stringify({ notes: { keep: now - 9000, new: now - 60 } })); localStorage.setItem('dp.touched', String(now - 9000));
      applyRemoteState({ touched: now - 100, notes: [{ id: 'keep', text: 'k' }] });
      ok('…but an item stamped after that save is kept: the old phone cannot have seen it', ids(DB.notes()) === 'keep,new' && (listMeta('dp.listAt').notes || {}).new === now - 60, ids(DB.notes()));
      localStorage.setItem('dp.touched', String(now - 9000));   // the push the pull just made bumped it
      applyRemoteState({ touched: now - 50, notes: [{ id: 'keep', text: 'k, edited on the old phone' }] });
      ok('…and an item it changed is stamped at that save', (listMeta('dp.listAt').notes || {}).keep === now - 50 && DB.notes()[0].text === 'k, edited on the old phone');
      // #4: one bad day must not abort the whole pull
      let threw = null; try { mergeHabits({ habits: 'yes', updatedAt: 'x' }, { habits: { workout: true }, habitsAt: 'no' }); } catch (e) { threw = e; }
      ok('a day whose habits is not an object merges as having none, rather than throwing', !threw && mergeHabits({ habits: 'yes' }, { habits: { workout: true } }).habits.workout === true, threw && threw.message);
      // #5: time-block delete records older than the window expire in the merge too
      localStorage.setItem('dp.timelog', '[]'); localStorage.setItem('dp.timelogDel', JSON.stringify({ old: now - 200 * day, young: now - day }));
      localStorage.setItem('dp.touched', String(now));
      sent.length = 0;
      applyRemoteState({ touched: now + 5, timelog: [], timelogDel: { old: now - 200 * day, young: now - day, older: now - 300 * day }, listAt: {}, listDel: {} });
      const td = timelogDels();
      ok('a 200-day-old time-block delete record is dropped in the merge, a young one kept', !('old' in td) && !('older' in td) && td.young === now - day, td);
      ok('…without a push to put it back', !sent.some(x => x.type === 'state'), sent.length);
      const savers = { tasks: DB.saveTasks, notes: DB.saveNotes, plans: DB.savePlans, projects: DB.saveProjects, reminders: DB.saveReminders, exercises: DB.saveExercises, timeacts: DB.saveTimeacts, events: DB.saveEvents, docs: DB.saveDocs, timebox: DB.saveTimebox, goals: saveGoals, finaccts: finSaveAccts, fintx: finSaveTx, finmarks: finSaveMarks,
        meals: mealSavePlan, meallib: mealSaveLib, mealshop: mealSaveShop };
      ok('every list in the sync is saved through listSave', LIST_SYNC.every(k => savers[k] && savers[k].toString().includes("listSave('dp." + k + "'")), LIST_SYNC.filter(k => !(savers[k] && savers[k].toString().includes("listSave('dp." + k + "'"))));
    } finally {
      window.fetch = fSnap; window.toast = tSnap; clearTimeout(pushTimer); _pushPending = null;
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
    }
  })();

  // ---- plans sync step by step: a tick on each phone both survive ----
  (function () {
    const keys = ['dp.plans', 'dp.listAt', 'dp.listDel', 'dp.touched', 'dp.settings', 'dp.entries', 'dp.timelog', 'dp.timelogDel'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const fSnap = window.fetch, sent = [];
    window.fetch = (u, o) => { try { sent.push(JSON.parse(o.body)); } catch (e) {} return Promise.resolve({ ok: true }); };
    const tSnap = window.toast; window.toast = () => {};
    const cSnap = window.confirm; window.confirm = () => true;
    const cpSnap = curPlan;
    const at = () => listMeta('dp.listAt'), dl = () => listMeta('dp.listDel');
    const dig = (o, ...ks) => ks.reduce((x, k) => x == null ? undefined : x[k], o);   // a missing level reads as undefined, not a throw
    const step = (id, done, text) => ({ id, text: text || id, done: !!done, color: '', created: '2026-01-01' });
    const plan = (items, extra) => Object.assign({ id: 'p1', name: 'Trip', color: '', created: '2026-01-01', items }, extra || {});
    const P = () => DB.plans().find(p => p.id === 'p1') || {};
    const its = () => (P().items || []).map(i => i.id + (i.done ? '+' : '')).join(',');
    const seed = (items, listAt, listDel) => {
      localStorage.setItem('dp.plans', JSON.stringify([plan(items)]));
      localStorage.setItem('dp.listAt', JSON.stringify(listAt || {})); localStorage.setItem('dp.listDel', JSON.stringify(listDel || {}));
    };
    const open = () => { show('plans'); curPlan = 'p1'; renderPlans(); };
    const tap = sel => { const el = document.querySelector(sel); if (el) el.click(); return !!el; };
    const pull = (plans, listAt, listDel, extra) => applyRemoteState(Object.assign({ touched: Date.now() + 5000, plans, listAt, listDel: listDel || {}, entries: {}, timelog: [], timelogDel: {} }, extra || {}));
    try {
      // what each save records
      seed([step('i1'), step('i2'), step('i3')], { plans: { p1: 1000 } });
      open();
      ok('(the plan is open)', tap('[data-planitem-toggle="i1"]'));
      let A = at();
      ok('ticking a step stamps that step', A.planItems && dig(A, 'planItems', 'p1', 'i1') > 1000, A.planItems);
      ok('…the steps it did not change keep the plan\'s earlier stamp', dig(A, 'planItems', 'p1', 'i2') === 1000 && dig(A, 'planItems', 'p1', 'i3') === 1000);
      ok('…and so do the plan\'s own fields', dig(A, 'planFields', 'p1') === 1000);
      ok('…while the whole-plan stamp still moves (older app versions merge by it)', dig(A, 'plans', 'p1') > 1000);
      ok('…and no delete records appear', !('planItems' in dl()), dl());
      const tTick = dig(A, 'planItems', 'p1', 'i1');
      const nm = document.querySelector('[data-planname="p1"]');
      if (nm) { nm.value = 'Trip to Goa'; nm.dispatchEvent(new Event('input', { bubbles: true })); }
      ok('renaming a plan stamps its fields, and no step', !!nm && P().name === 'Trip to Goa' && dig(at(), 'planFields', 'p1') >= tTick && dig(at(), 'planItems', 'p1', 'i2') === 1000);
      open(); tap('[data-planitem-del="i3"]');
      ok('deleting a step records when', (dl().planItems || {}).p1 && dig(dl(), 'planItems', 'p1', 'i3') >= tTick && !('i3' in (dig(at(), 'planItems', 'p1') || {})), dl());
      open(); tap('[data-planitem-toggle="i2"]'); open(); tap('#plan-clear-done');
      ok('"Clear completed" records each step it removed', its() === '' && dig(dl(), 'planItems', 'p1', 'i1') >= tTick && dig(dl(), 'planItems', 'p1', 'i2') >= tTick, its());
      open(); const inp = document.getElementById('plan-item-input'); if (inp) inp.value = 'Book hotel'; tap('#plan-item-add-btn');
      const added = (P().items || [])[0];
      ok('adding a step stamps it', !!added && dig(at(), 'planItems', 'p1', added.id) >= tTick);
      const A0 = at(); A0.planItems = A0.planItems || {}; A0.planItems.p1 = A0.planItems.p1 || {}; A0.planFields = A0.planFields || {}; A0.planItems.p1[added.id] = 7; A0.planFields.p1 = 7; localStorage.setItem('dp.listAt', JSON.stringify(A0));
      open(); setColor(added.id, 'red');
      ok('colouring a step stamps it, not the plan\'s fields', P().items[0].color === 'red' && dig(at(), 'planFields', 'p1') === 7 && dig(at(), 'planItems', 'p1', added.id) > 7, at());
      seed([step('i1')], {}, { planItems: { p1: { old: Date.now() - 91 * 864e5 } } });
      open(); tap('[data-planitem-toggle="i1"]');
      ok('a plan with no stamp at all: its fields are marked as not yet changed (0)', dig(at(), 'planFields', 'p1') === 0 && dig(at(), 'planItems', 'p1', 'i1') > 0, at());
      ok('delete records older than 90 days are dropped', !(dl().planItems || {}).p1);
      localStorage.setItem('dp.listDel', JSON.stringify({ planItems: { p1: { i9: Date.now() - 1000 } } }));
      DB.savePlans([plan([step('i1', true), step('i9')])]);
      ok('a step saved again under a deleted id loses its delete record', !(dl().planItems || {}).p1 && dig(at(), 'planItems', 'p1', 'i9') > 0, dl());
      DB.savePlans([plan([step('i1', true), step('i9')]), { id: 'p2', name: 'New', items: [step('j1')] }]);
      ok('a new plan stamps its fields and every step', dig(at(), 'planFields', 'p2') > 0 && dig(at(), 'planItems', 'p2', 'j1') > 0);
      show('plans'); curPlan = null; renderPlans(); tap('[data-delplan="p2"]');
      ok('deleting a plan drops its steps\' stamps (its own delete record covers them)', !DB.plans().some(p => p.id === 'p2') && !((at().planItems || {}).p2) && !('p2' in (at().planFields || {})) && !!dig(dl(), 'plans', 'p2'));

      // the merge, directly: a tick on each phone
      const st = DB.settings(); st.syncUrl = 'https://example.invalid/exec'; DB.saveSettings(st);
      const now = Date.now();
      localStorage.setItem('dp.entries', '{}'); localStorage.setItem('dp.timelog', '[]'); localStorage.setItem('dp.timelogDel', '{}');
      seed([step('i1'), step('i2'), step('i3')], { plans: { p1: 1000 } });
      open(); tap('[data-planitem-toggle="i1"]');   // ticked here
      const tA = dig(at(), 'planItems', 'p1', 'i1');
      localStorage.setItem('dp.touched', String(tA));
      pull([plan([step('i1'), step('i2', true), step('i3')])],
        { plans: { p1: tA + 5 }, planFields: { p1: 1000 }, planItems: { p1: { i1: 1000, i2: tA + 5, i3: 1000 } } });
      ok('a step ticked on each phone: both ticks survive', its() === 'i1+,i2+,i3', its());
      ok('…and both stamps are kept', dig(at(), 'planItems', 'p1', 'i1') === tA && dig(at(), 'planItems', 'p1', 'i2') === tA + 5, at().planItems);
      // un-tick here, the other phone still has the tick (older)
      open(); tap('[data-planitem-toggle="i1"]');
      const tU = dig(at(), 'planItems', 'p1', 'i1');
      pull([plan([step('i1', true), step('i2', true), step('i3')])],
        { plans: { p1: tA + 5 }, planFields: { p1: 1000 }, planItems: { p1: { i1: tA, i2: tA + 5, i3: 1000 } } });
      ok('an un-tick here survives the other phone\'s older tick', its() === 'i1,i2+,i3', its());
      pull([plan([step('i1'), step('i2'), step('i3')])],
        { plans: { p1: tU + 50 }, planFields: { p1: 1000 }, planItems: { p1: { i1: tU, i2: tU + 50, i3: 1000 } } });
      ok('…and an un-tick there arrives here', its() === 'i1,i2,i3', its());
      // a rename on one phone, a tick on the other
      seed([step('i1'), step('i2')], { plans: { p1: now - 500 }, planFields: { p1: now - 400 }, planItems: { p1: { i1: 1000, i2: 1000 } } });
      localStorage.setItem('dp.plans', JSON.stringify([plan([step('i1'), step('i2')], { name: 'Renamed here' })]));
      pull([plan([step('i1', true), step('i2')])], { plans: { p1: now }, planFields: { p1: 1000 }, planItems: { p1: { i1: now, i2: 1000 } } });
      ok('a rename here survives the other phone\'s later tick', P().name === 'Renamed here' && its() === 'i1+,i2', [P().name, its()]);
      pull([plan([step('i1', true), step('i2')], { name: 'Renamed there' })], { plans: { p1: now + 9 }, planFields: { p1: now + 9 }, planItems: { p1: { i1: now, i2: 1000 } } });
      ok('…and a later rename there wins', P().name === 'Renamed there');
      // delete beats an older edit
      seed([step('i1'), step('i2')], { plans: { p1: 1000 }, planFields: { p1: 1000 }, planItems: { p1: { i1: 1000, i2: 1000 } } });
      open(); tap('[data-planitem-del="i2"]');
      const tD = dig(dl(), 'planItems', 'p1', 'i2');
      pull([plan([step('i1'), step('i2', false, 'edited there')])], { plans: { p1: tD - 10 }, planFields: { p1: 1000 }, planItems: { p1: { i1: 1000, i2: tD - 10 } } });
      ok('a step deleted here is not brought back by the other phone\'s older edit', its() === 'i1', its());
      pull([plan([step('i1'), step('i2', false, 'edited later')])], { plans: { p1: tD + 10 }, planFields: { p1: 1000 }, planItems: { p1: { i1: 1000, i2: tD + 10 } } });
      ok('…but an edit made after the delete brings it back', its() === 'i1,i2' && P().items[1].text === 'edited later', its());
      pull([plan([step('i1')])], { plans: { p1: tD + 20 }, planFields: { p1: 1000 }, planItems: { p1: { i1: 1000 } } }, { planItems: { p1: { i2: tD + 20 } } });
      ok('a step deleted there goes here too', its() === 'i1', its());
      // an older app version (v253): its whole-plan stamp stands for every step
      seed([step('i1'), step('i2'), step('i3')], { plans: { p1: now - 900 }, planFields: { p1: 1000 }, planItems: { p1: { i1: now - 900, i2: 1000, i3: 1000 } } });
      localStorage.setItem('dp.plans', JSON.stringify([plan([step('i1', true), step('i2'), step('i3')])]));
      pull([plan([step('i1'), step('i2', true)], { name: 'Theirs' })], { plans: { p1: now - 100 } });
      ok('a newer plan from an older app version wins whole, as before', its() === 'i1,i2+' && P().name === 'Theirs', [its(), P().name]);
      ok('…and its stamp now stands for each of its steps here', dig(at(), 'planItems', 'p1', 'i1') === now - 100 && dig(dl(), 'planItems', 'p1', 'i3') === now - 100, [at().planItems, dl().planItems]);
      seed([step('i1'), step('i2'), step('i3')], { plans: { p1: now - 50 }, planFields: { p1: 1000 }, planItems: { p1: { i1: now - 50, i2: 1000, i3: 1000 } } });
      localStorage.setItem('dp.plans', JSON.stringify([plan([step('i1', true), step('i2'), step('i3')])]));
      pull([plan([step('i1'), step('i2', true), step('i3')])], { plans: { p1: now - 100 } });
      ok('…an older one keeps this phone\'s later tick, and takes its own', its() === 'i1+,i2+,i3', its());
      seed([step('i1')], { plans: { p1: now - 900 } });
      pull([plan([step('i1', true), step('i2')])], { plans: { p1: now - 100 } });
      ok('two phones without step stamps: the newer whole plan, as before', its() === 'i1+,i2' && dig(at(), 'planFields', 'p1') === now - 100, [its(), at()]);
      seed([step('i1')], { planFields: { p1: 0 } });
      localStorage.setItem('dp.plans', JSON.stringify([plan([step('i1')], { name: 'A' })]));
      localStorage.setItem('dp.touched', String(now + 1e6));
      pull([plan([step('i1', true)], { name: 'B' })], { plans: { p1: now }, planFields: { p1: 0 } }, {}, { touched: now });
      ok('steps and fields neither phone stamped follow the plan changed last, not the state saved last', its() === 'i1+' && P().name === 'B', [its(), P().name]);
      seed([step('i1')], { plans: { p1: now - 900 } });
      localStorage.setItem('dp.touched', String(now));
      applyRemoteState({ touched: now + 30, plans: [plan([step('i9')])] });
      ok('a state from before item stamps (no listAt) still replaces the list', its() === 'i9', its());
      // a plan only the other phone has: its step stamps come with it — unless it has none
      seed([step('i1')], { plans: { p1: 1000, p6: 1000 }, planFields: { p1: 1000, p6: 1000 }, planItems: { p1: { i1: 1000 }, p6: { q1: 1000 } } });
      localStorage.setItem('dp.plans', JSON.stringify([plan([step('i1')]), { id: 'p6', name: 'Mine', items: [step('q1')] }]));
      pull([plan([step('i1')]), { id: 'p3', name: 'Theirs', items: [step('k1')] }, { id: 'p4', name: 'Old', items: [step('m1')] }],
        { plans: { p1: 1000, p3: now, p4: now }, planFields: { p1: 1000, p3: now }, planItems: { p1: { i1: 1000 }, p3: { k1: now } } }, { planItems: { p3: { k0: now } } });
      ok('a plan that arrives brings its step stamps and delete records', dig(at(), 'planItems', 'p3', 'k1') === now && dig(at(), 'planFields', 'p3') === now && dig(dl(), 'planItems', 'p3', 'k0') === now);
      ok('…and one with none stays without (its whole-plan stamp stands for them)', !('p4' in (dig(at(), 'planFields') || {})) && !(at().planItems || {}).p4);
      ok('a plan only this phone has keeps its step stamps', dig(at(), 'planItems', 'p6', 'q1') === 1000 && dig(at(), 'planFields', 'p6') === 1000);
      // pushes: none when nothing differs, one when the Sheet lacks a delete record
      seed([step('i1'), step('i2')], { plans: { p1: 1000 }, planFields: { p1: 1000 }, planItems: { p1: { i1: 1000, i2: 1000 } } }, { planItems: { p1: { i0: now } } });
      localStorage.setItem('dp.touched', String(now + 100)); clearTimeout(pushTimer); _pushPending = null; sent.length = 0;
      applyRemoteState({ touched: now + 100, plans: DB.plans(), listAt: at(), listDel: dl(), entries: {}, timelog: [], timelogDel: {} });
      ok('a pull of an identical state (steps and all) sends nothing', !sent.some(x => x.type === 'state'), sent.length);
      applyRemoteState({ touched: now + 100, plans: DB.plans(), listAt: at(), listDel: {}, entries: {}, timelog: [], timelogDel: {} });
      ok('a pull whose Sheet lacks a deleted step\'s record sends ours', sent.some(x => x.type === 'state' && x.listDel.planItems && x.listDel.planItems.p1.i0 === now));
      // restore
      seed([step('i1', true), step('i2')], { plans: { p1: now }, planFields: { p1: now }, planItems: { p1: { i1: now, i2: now } } }, { planItems: { p1: { i9: now - 5, i8: now - 5 } } });
      const before = listIds(['plans']);
      localStorage.setItem('dp.plans', JSON.stringify([plan([step('i1'), step('i9')]), { id: 'p5', name: 'Back', items: [step('n1')] }]));
      listRestored(before, now - 3000);   // a backup taken 3 s ago
      A = at(); const D = dl();
      ok('restore: a step it brings back is stamped at the backup\'s time and its delete record goes', dig(A, 'planItems', 'p1', 'i9') === now - 3000 && !('i9' in (dig(D, 'planItems', 'p1') || {})) && dig(D, 'planItems', 'p1', 'i8') === now - 5, [A.planItems, D.planItems]);
      ok('…a rolled-back step and the plan\'s fields lose their stamps', !('i1' in (dig(A, 'planItems', 'p1') || {})) && dig(A, 'planFields', 'p1') === 0);
      ok('…and a plan it brings back whole is left to its new whole-plan stamp, the backup\'s time', dig(A, 'plans', 'p5') === now - 3000 && !('p5' in (dig(A, 'planFields') || {})) && !(dig(A, 'planItems', 'p5')));
    } finally {
      window.fetch = fSnap; window.toast = tSnap; window.confirm = cSnap; curPlan = cpSnap; clearTimeout(pushTimer); _pushPending = null;
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      navigateTo('today');
    }
  })();

  // ---- gym days sync tick by tick: un-ticks and log edits propagate ----
  (function () {
    const keys = ['dp.gym', 'dp.gymAt', 'dp.entries', 'dp.touched', 'dp.settings', 'dp.timelog', 'dp.timelogDel'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const fSnap = window.fetch, sent = [];
    window.fetch = (u, o) => { try { sent.push(JSON.parse(o.body)); } catch (e) {} return Promise.resolve({ ok: true }); };
    const tSnap = window.toast; window.toast = () => {};
    const gdSnap = gymDate, gidSnap = gymDayId, gvSnap = gymView;
    const GA = () => listMeta('dp.gymAt');
    const dig = (o, ...ks) => ks.reduce((x, k) => x == null ? undefined : x[k], o);
    const D = '2026-01-05';
    const day = (done, log) => ({ [D]: { done: done || {}, log: log || {} } });
    try {
      // gymMerge, directly: (local, remote, local stamps, remote stamps, when the remote state was saved)
      let m = gymMerge(day({ a: false }), day({ a: true }), { [D]: { done: { a: 200 } } }, { [D]: { done: { a: 100 } } }, 1);
      ok('gym: a newer un-tick beats an older tick', dig(m.gym, D, 'done', 'a') === false && dig(m.at, D, 'done', 'a') === 200, m);
      m = gymMerge(day({ a: true }), day({ a: false }), { [D]: { done: { a: 100 } } }, { [D]: { done: { a: 200 } } }, 1);
      ok('gym: …and an un-tick on the other phone arrives', dig(m.gym, D, 'done', 'a') === false && dig(m.at, D, 'done', 'a') === 200);
      m = gymMerge(day({ a: false }), day({ a: true }), { [D]: { done: { a: 100 } } }, {}, 1);
      ok('gym: an un-tick beats a tick older than the stamps', dig(m.gym, D, 'done', 'a') === false);
      m = gymMerge(day({ a: true }), day({}), { [D]: { done: { a: 100 } } }, {}, 1);
      ok('gym: a side that never touched an exercise has no say about it', dig(m.gym, D, 'done', 'a') === true);
      m = gymMerge(day({ a: false, b: true }, { x: '' }), day({ a: true, c: true }, { x: '3x10', y: '2x5' }), {}, {}, 1);
      ok('gym: what neither phone has stamped still merges as a union', dig(m.gym, D, 'done', 'a') === true && dig(m.gym, D, 'done', 'b') === true && dig(m.gym, D, 'done', 'c') === true && dig(m.gym, D, 'log', 'x') === '3x10' && dig(m.gym, D, 'log', 'y') === '2x5' && !Object.keys(m.at).length, m);
      m = gymMerge(day({}, { x: '3x12' }), day({}, { x: '3x10' }), { [D]: { log: { x: 300 } } }, { [D]: { log: { x: 200 } } }, 1);
      ok('gym: a newer log edit here is kept', dig(m.gym, D, 'log', 'x') === '3x12');
      m = gymMerge(day({}, { x: '3x10' }), day({}, { x: '3x12' }), { [D]: { log: { x: 200 } } }, { [D]: { log: { x: 300 } } }, 1);
      ok('gym: …and a newer one there arrives', dig(m.gym, D, 'log', 'x') === '3x12' && dig(m.at, D, 'log', 'x') === 300);
      m = gymMerge(day({}, { x: '' }), day({}, { x: '3x10' }), { [D]: { log: { x: 300 } } }, { [D]: { log: { x: 200 } } }, 1);
      ok('gym: a cleared log stays cleared', dig(m.gym, D, 'log', 'x') === '');
      m = gymMerge(day({ a: false }), day({ a: true }), { [D]: { done: { a: 100 } } }, { [D]: { done: { a: 100 } } }, 1);
      ok('gym: a tie keeps the tick rather than a gap', dig(m.gym, D, 'done', 'a') === true);
      m = gymMerge(day({}), { '2026-01-06': { done: { z: true }, log: {} } }, {}, { '2026-01-06': { done: { z: 50 } } }, 1);
      ok('gym: a day only the other phone has arrives with its stamps', dig(m.gym, '2026-01-06', 'done', 'z') === true && dig(m.at, '2026-01-06', 'done', 'z') === 50 && D in m.gym);
      m = gymMerge(day({}), day({ a: false }), {}, {}, 1);
      ok('gym: an unticked exercise the other phone holds is kept (or the two would send it back and forth)', dig(m.gym, D, 'done', 'a') === false);
      m = gymMerge({ [D]: { done: { a: true }, note: 'x' } }, { [D]: { done: { a: true } } }, {}, {}, 1);
      ok('gym: a day keeps what it holds and gets nothing it did not have', !('log' in (m.gym[D] || {})) && dig(m.gym, D, 'note') === 'x', m.gym[D]);
      // a state from an older app version (no gymAt): the union, as before…
      m = gymMerge(day({ a: false }, { x: '3x12' }), day({ a: true, c: true }, { x: '3x10' }), { [D]: { done: { a: 100 }, log: { x: 100 } } }, undefined, 500);
      ok('gym: an older app version\'s tick still arrives (the union, as before)', dig(m.gym, D, 'done', 'a') === true && dig(m.gym, D, 'done', 'c') === true, m);
      ok('gym: …stamped with when that state was saved', dig(m.at, D, 'done', 'a') === 500 && dig(m.at, D, 'done', 'c') === 500);
      ok('gym: …and the union never overwrites a log here', dig(m.gym, D, 'log', 'x') === '3x12' && dig(m.at, D, 'log', 'x') === 100);
      m = gymMerge(day({ a: false }), day({ a: true }), { [D]: { done: { a: 900 } } }, undefined, 500);
      ok('gym: …but an un-tick made after that state was saved stays', dig(m.gym, D, 'done', 'a') === false && dig(m.at, D, 'done', 'a') === 900);

      // writers stamp: putGymDay, saveGym, the Gym screen (tick, typed log, Save)
      localStorage.setItem('dp.gymAt', '{}');
      const T0 = todayStr(), Y = addDays(T0, -1);
      const day0 = gymDays()[0], ex = cookedDayEx(day0), k1 = dkey(day0.id, ex[0].id), k2 = dkey(day0.id, ex[1].id);
      localStorage.setItem('dp.gym', JSON.stringify({ [T0]: { done: { [k1]: true }, log: {} } }));
      DB.putGymDay(Y, { done: { [k1]: true }, log: {} });
      ok('putGymDay stamps what it changed', GA()[Y] && dig(GA(), Y, 'done', k1) > 0 && !GA()[T0], GA());
      const g = DB.gym(); g[Y].log[k1] = '5 km'; DB.saveGym(g);
      ok('saveGym stamps what changed, and nothing else', dig(GA(), Y, 'log', k1) > 0 && Object.keys(dig(GA(), Y, 'done') || {}).length === 1 && !GA()[T0]);
      const tY = dig(GA(), Y, 'done', k1);
      DB.saveGym(DB.gym());
      ok('saving it unchanged stamps nothing new', dig(GA(), Y, 'done', k1) === tY);
      gymDate = T0; show('gym'); gymDayId = day0.id; gymView = 'day'; renderGym();
      const tg = document.querySelector(`#s-gym [data-ex-toggle="${ex[0].id}"]`);
      if (tg) tg.click();
      ok('un-ticking on the Gym screen stamps it', !!tg && DB.gymDay(T0).done[k1] === false && dig(GA(), T0, 'done', k1) > 0, GA()[T0]);
      const tU = dig(GA(), T0, 'done', k1);
      const stT = window.setTimeout; let due = null;
      window.setTimeout = (f, ms) => { if (ms === 700) due = f; return stT(() => {}, 0); };
      const lg0 = document.querySelector(`#s-gym [data-ex-log="${ex[2].id}"]`);
      if (lg0) { lg0.value = 'warm-up'; lg0.dispatchEvent(new Event('input', { bubbles: true })); }
      window.setTimeout = stT;
      if (due) due();
      ok('a typed log is saved, and stamped, when its debounce runs out', !!due && DB.gymDay(T0).log[dkey(day0.id, ex[2].id)] === 'warm-up' && dig(GA(), T0, 'log', dkey(day0.id, ex[2].id)) > 0 && !_gymPending);
      const lg = document.querySelector(`#s-gym [data-ex-log="${ex[1].id}"]`);
      if (lg) { lg.value = '3 x 12'; lg.dispatchEvent(new Event('input', { bubbles: true })); }
      ok('(typing waits out its debounce)', !!lg && !!_gymPending && !DB.gymDay(T0).log[k2]);
      // a pull lands mid-typing: the typing is saved first, the other phone's newer tick arrives, nothing is undone after
      const st = DB.settings(); st.syncUrl = 'https://example.invalid/exec'; DB.saveSettings(st);
      localStorage.setItem('dp.entries', '{}'); localStorage.setItem('dp.timelog', '[]'); localStorage.setItem('dp.timelogDel', '{}');
      const k3 = dkey(day0.id, ex[2].id), later = Date.now() + 1000;
      applyRemoteState({ touched: Date.now() + 5000, gym: { [T0]: { done: { [k1]: true, [k3]: true }, log: {} } }, gymAt: { [T0]: { done: { [k3]: later } } }, entries: {}, timelog: [], timelogDel: {} });
      ok('a pull mid-typing saves the typed log first, stamped', DB.gymDay(T0).log[k2] === '3 x 12' && dig(GA(), T0, 'log', k2) > 0 && !_gymPending);
      ok('…the other phone\'s older tick does not undo the un-tick here', DB.gymDay(T0).done[k1] === false && dig(GA(), T0, 'done', k1) === tU);
      ok('…and its newer tick arrives', DB.gymDay(T0).done[k3] === true && dig(GA(), T0, 'done', k3) === later);
      flushGymSave();
      ok('…and no late save writes the old day back over it', DB.gymDay(T0).done[k3] === true && dig(GA(), T0, 'done', k3) === later);
      gymDayId = day0.id; gymView = 'day'; renderGym();
      const lg2 = document.querySelector(`#s-gym [data-ex-log="${ex[1].id}"]`);
      if (lg2) { lg2.value = '3 x 15'; lg2.dispatchEvent(new Event('input', { bubbles: true })); }
      window.dispatchEvent(new Event('pagehide'));
      ok('hiding the app saves typing still waiting in the Gym', DB.gymDay(T0).log[k2] === '3 x 15' && !_gymPending);
      gymDate = Y; openGym(); gymDayId = day0.id; gymView = 'day'; renderGym();
      const lg3 = document.querySelector(`#s-gym [data-ex-log="${ex[1].id}"]`);
      if (lg3) { lg3.value = 'day Y'; lg3.dispatchEvent(new Event('input', { bubbles: true })); }
      gymDate = T0; openGym();
      ok('switching day mid-typing saves the typing to the day it was typed on', DB.gymDay(Y).log[k2] === 'day Y' && DB.gymDay(T0).log[k2] === '3 x 15' && !_gymPending);
      // pushes: what goes up, and when
      sent.length = 0; pushState(true);
      ok('every push carries the gym stamps', sent.length && dig(sent[sent.length - 1], 'gymAt', T0, 'done', k1) === tU);
      const mine = JSON.parse(localStorage.getItem('dp.gym')), myAt = GA(), ents = () => JSON.parse(localStorage.getItem('dp.entries'));
      const reorder = o => JSON.parse(JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).reverse().reduce((x, kk) => { x[kk] = v[kk]; return x; }, {}) : v));
      localStorage.setItem('dp.touched', String(Date.now() + 9000)); clearTimeout(pushTimer); _pushPending = null; sent.length = 0;
      applyRemoteState({ touched: Date.now() + 9000, gym: reorder(mine), gymAt: reorder(myAt), entries: ents(), timelog: [], timelogDel: {} });
      ok('a pull of the same gym days and stamps (keys in another order) sends nothing', !sent.some(x => x.type === 'state') && localStorage.getItem('dp.gym') === JSON.stringify(mine), sent.length);
      applyRemoteState({ touched: Date.now() + 9000, gym: mine, entries: ents(), timelog: [], timelogDel: {} });
      ok('a pull from an older app version (no stamps) sends ours back up', sent.some(x => x.type === 'state' && x.gymAt && x.gymAt[T0]));
      sent.length = 0;
      const theirs = JSON.parse(JSON.stringify(mine)); theirs[T0].done[k1] = true;
      const theirAt = JSON.parse(JSON.stringify(myAt)); theirAt[T0] = Object.assign({}, theirAt[T0]); theirAt[T0].done = Object.assign({}, theirAt[T0].done, { [k1]: tU - 1000 });
      applyRemoteState({ touched: Date.now() + 9000, gym: theirs, gymAt: theirAt, entries: ents(), timelog: [], timelogDel: {} });
      ok('a pull whose Sheet still has the old tick sends the un-tick back up', DB.gymDay(T0).done[k1] === false && sent.some(x => x.type === 'state' && dig(x, 'gym', T0, 'done', k1) === false));
      sent.length = 0;
      const extra = JSON.parse(localStorage.getItem('dp.gym')); extra['2025-12-31'] = { done: { 'x/y': true }, log: {} };
      localStorage.setItem('dp.gym', JSON.stringify(extra));
      const sheet = JSON.parse(JSON.stringify(extra)); delete sheet['2025-12-31'];
      applyRemoteState({ touched: Date.now() + 9000, gym: sheet, gymAt: GA(), entries: ents(), timelog: [], timelogDel: {} });
      ok('a pull whose Sheet lacks a gym day only this phone has sends it', sent.some(x => x.type === 'state' && x.gym['2025-12-31']));
      ok('gym stamps are not in a backup', BACKUP_EXCLUDED.includes('gymAt') && !BACKUP_KEYS.includes('gymAt'));
      ok('every gym write goes through the stamping save', DB.saveGym.toString().includes('gymStamp(') && DB.putGymDay.toString().includes('this.saveGym(') && persistGym.toString().includes('DB.putGymDay(') && importData.toString().includes('gymRestored('));
      // restore: what it brings back is new, what it rolls back is old
      const before = { [T0]: { done: { [k1]: false, [k2]: true }, log: { [k1]: 'old' } } };
      localStorage.setItem('dp.gymAt', JSON.stringify({ [T0]: { done: { [k1]: 5, [k2]: 5 }, log: { [k1]: 5 } } }));
      localStorage.setItem('dp.gym', JSON.stringify({ [T0]: { done: { [k1]: true, [k2]: true }, log: { [k1]: 'older' } }, [Y]: { done: { z: true }, log: {} } }));
      const tR = Date.now() - 2 * 864e5; gymRestored(before, tR);   // a backup taken two days ago
      const ra = GA();
      ok('restore: a tick it brings back is stamped at the backup\'s time, so a later un-tick elsewhere wins', dig(ra, T0, 'done', k1) === tR && dig(ra, Y, 'done', 'z') === tR, ra);
      ok('…an unchanged or rolled-back one loses its stamp', !(k2 in (dig(ra, T0, 'done') || {})) && !dig(ra, T0, 'log'));
    } finally {
      window.fetch = fSnap; window.toast = tSnap; clearTimeout(pushTimer); _pushPending = null;
      clearTimeout(_gymSaveTimer); _gymPending = null;
      gymDate = gdSnap; gymDayId = gidSnap; gymView = gvSnap;
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      navigateTo('today');
    }
  })();

  // ---- v253: the Time tracker (independent review 4) ----
  (function () {
    const keys = ['dp.timelog', 'dp.timeacts', 'dp.actnames', 'dp.pausedAct', 'dp.pausedPid', 'dp.pomo', 'dp.timebox', 'dp.projects'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const ttSnap = ttDate, selSnap = ttSelSeg, manSnap = ttShowManual;
    const tl = () => DB.timelog();
    const H = 3600000;
    try {
      localStorage.setItem('dp.timelog', '[]');
      // Stop on a project timer stops it
      startAct('pj:p1', 'p1');
      stopRunning();
      ok('Stop on a project timer stops it, without starting an untagged one', !runningSeg() && tl().length === 1 && tl()[0].pid === 'p1' && tl()[0].end != null, tl());
      // notification Pause / Resume keep the project
      localStorage.setItem('dp.timelog', '[]');
      startAct('pj:p1', 'p1'); timerAction('pause');
      ok('Pause from the notification stops the project block and remembers it', !runningSeg() && localStorage.getItem('dp.pausedPid') === 'p1');
      timerAction('resume');
      const rr = runningSeg();
      ok('…and Resume starts it again ON the project', rr && rr.act === 'pj:p1' && rr.pid === 'p1' && !localStorage.getItem('dp.pausedAct'));
      timerAction('pause'); startAct('work');
      ok('starting something in the app clears a stale pause', !localStorage.getItem('dp.pausedAct') && !localStorage.getItem('dp.pausedPid'));
      stopRunning();
      // fixing a block's time across midnight
      const d0 = new Date(); d0.setHours(0, 0, 0, 0); const D0 = d0.getTime();
      const sleepBlk = { id: 'tsS1', act: 'sleep', start: D0 - 1 * H, end: D0 + 7 * H, upd: 1 };   // 23:00 → 07:00
      localStorage.setItem('dp.timelog', JSON.stringify([sleepBlk]));
      show('time'); ttDate = todayStr(); ttSelSeg = 'tsS1';   // opening Time clears the selection
      const fix = (which, val) => { const i = document.createElement('input'); i.type = 'time'; i.dataset.segt = which; i.value = val; document.getElementById('s-time').appendChild(i); i.dispatchEvent(new Event('change', { bubbles: true })); i.remove(); };
      fix('start', '00:30');
      let sb = tl().find(s => s.id === 'tsS1');
      ok('fixing a 23:00→07:00 sleep to start at 00:30 gives 6.5 hours, not 30.5', sb.end - sb.start === 6.5 * H, (sb.end - sb.start) / H);
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'tsS2', act: 'work', start: D0 - 2 * H, end: D0 + 0.5 * H, upd: 1 }]));   // 22:00 → 00:30
      ttSelSeg = 'tsS2'; fix('end', '23:50');
      sb = tl().find(s => s.id === 'tsS2');
      ok('fixing a 22:00→00:30 block to end at 23:50 gives 1h 50m, not 25.8 hours', Math.round((sb.end - sb.start) / 60000) === 110, (sb.end - sb.start) / H);
      // a running block's start can only move into the past
      const nowD = new Date(); const startRun = Date.now() - 20 * 60000;
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'tsR', act: 'sleep', start: startRun, end: null, upd: 1 }]));
      ttSelSeg = 'tsR';
      const later = new Date(Date.now() + 2 * H); fix('start', String(later.getHours()).padStart(2, '0') + ':' + String(later.getMinutes()).padStart(2, '0'));
      sb = tl().find(s => s.id === 'tsR');
      ok('a running block cannot be given a start in the future', sb.start < Date.now(), new Date(sb.start).toString());
      stopRunning();
      // old data can already hold a future start (before this fix); stopping it must not go negative
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'tsF', act: 'sleep', start: Date.now() + 3 * H, end: null, upd: 1 }]));
      stopRunning();
      ok('…and stopping it never makes a negative block', tl().every(s => s.end == null || s.end >= s.start), tl());
      ttSelSeg = null;
      // daylight saving: a day's bounds are calendar-true (25 h on 1 Nov 2026 in Los Angeles)
      const n1s = new Date(2026, 10, 1, 22).getTime(), n2 = new Date(2026, 10, 2, 0).getTime();
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'tsD', act: 'work', start: n1s, end: n2, upd: 1 }]));
      const tot = segsForDay('2026-11-01').reduce((s, x) => s + (x.b - x.a), 0);
      ok('22:00 to midnight counts in full on a 23- or 25-hour day', tot === n2 - n1s && segsForDay('2026-11-02').length === 0, tot / H);
      ok('dayEndMs is the next day\'s midnight, not +24 h', dayEndMs('2026-11-01') === n2 && dayEndMs('2026-03-08') === new Date(2026, 2, 9).getTime());
      // manual add uses the wall clock on that date
      localStorage.setItem('dp.timelog', '[]'); ttDate = '2026-11-01'; ttShowManual = true; renderTime();
      const ma = document.getElementById('tt-m-act'), ms = document.getElementById('tt-m-start'), me = document.getElementById('tt-m-end');
      if (ma && ms && me) { ma.value = 'work'; ms.value = '09:00'; me.value = '10:00'; document.getElementById('tt-m-save').click(); }
      const mb = tl()[0] || {};
      ok('a manual 09:00–10:00 is stored as 09:00–10:00 on that date, whatever its length', mb.start === new Date(2026, 10, 1, 9).getTime() && mb.end === new Date(2026, 10, 1, 10).getTime(), [new Date(mb.start).toString(), new Date(mb.end).toString()]);
      ttShowManual = false;
      // pomodoro catch-up closes the linked block where the focus ended
      const endsAt = Date.now() - 2 * H;
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'tsP', act: 'work', start: endsAt - 25 * 60000, end: null, upd: 1 }]));
      localStorage.setItem('dp.pomo', JSON.stringify({ cfg: Object.assign({}, POMO_DEFAULTS, { act: 'work', auto: true }), run: { phase: 'focus', endsAt, round: 1 }, done: { d: todayStr(), n: 0 } }));
      pomoAdvance(true);
      const pb = tl().find(s => s.id === 'tsP');
      ok('a focus phase that ended while away closes its tracked block at its end, not now', pb.end === endsAt, (pb.end - endsAt) / 60000);
      // "Was this <project>?" logs the project
      localStorage.setItem('dp.timelog', '[]'); ttDate = todayStr(); show('time');
      const g = document.createElement('button'); g.dataset.gapSet = (D0 + 9 * H) + ':' + (D0 + 10 * H) + ':pj:p1'; document.getElementById('s-time').appendChild(g); g.click(); g.remove();
      ok('filling a gap with a project logs the project, not an activity called "pj"', tl().length === 1 && tl()[0].act === 'pj:p1' && tl()[0].pid === 'p1', tl());
      // a timebox's ▶ for what is already running leaves it running
      localStorage.setItem('dp.timelog', '[]'); startAct('work');
      localStorage.setItem('dp.timebox', JSON.stringify([{ id: 'tbX', date: todayStr(), start: '09:00', end: '10:00', label: 'Deep work', act: 'work' }]));
      show('focus');   // the timebox buttons only answer on the Focus screen
      const tbb = document.createElement('button'); tbb.dataset.tbStart = 'tbX'; document.getElementById('s-focus').appendChild(tbb); tbb.click(); tbb.remove();
      ok('▶ on a timebox for the running activity does not stop it', !!runningSeg() && runningSeg().act === 'work');
      stopRunning();
      // a deleted activity keeps its name in history
      DB.saveTimeacts([{ id: 'taR', emoji: '📚', name: 'Reading', color: '#f0f' }]);
      DB.saveTimeacts([]);
      ok('a deleted activity\'s history still shows its name', actById('taR').name === 'Reading' && actById('taR').emoji === '📚');
    } finally {
      try { stopRunning(); } catch (e) {}
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      ttDate = ttSnap; ttSelSeg = selSnap; ttShowManual = manSnap; navigateTo('today');
    }
  })();

  // ---- The Nov 2 Time review's last two: a time box across midnight is "now"; overlapping blocks count once ----
  (function () {
    const keys = ['dp.timebox'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const daySnap = tbDay, edSnap = tbEdit;
    const at = (ds, hh, mm) => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d, hh, mm); };
    try {
      // the Today / Tomorrow views, drawn at a given moment
      const D = '2026-03-10', N = addDays(D, 1);
      const night = { id: 'tbM1', date: D, start: '23:00', end: '01:00', label: 'Night shift' };
      localStorage.setItem('dp.timebox', JSON.stringify([night, { id: 'tbM2', date: N, start: '09:00', end: '10:00', label: 'Standup' }]));
      const view = now => { const el = document.createElement('div'); el.innerHTML = timeboxHTML(now); return el; };
      const row = (el, id) => el.querySelector(`.tb-row[data-id="${id}"]`);
      const isNow = r => !!r && r.classList.contains('live') && /● now/.test(r.textContent);
      tbDay = 0; tbEdit = null;
      let v = view(at(D, 23, 30));
      ok('timebox Today at 23:30: the 23:00–01:00 block is now', isNow(row(v, 'tbM1')), v.innerHTML.slice(0, 300));
      v = view(at(N, 0, 30));
      ok('timebox Today at 00:30 the next day: last night\'s block is still on, first, as now', isNow(row(v, 'tbM1')) && v.querySelector('.tb-row') === row(v, 'tbM1'));
      ok('…next to today\'s own blocks, which are not now', !!row(v, 'tbM2') && !isNow(row(v, 'tbM2')));
      v = view(at(N, 1, 30));
      ok('…and it leaves Today once it has ended', !row(v, 'tbM1') && !!row(v, 'tbM2'));
      v = view(at(N, 9, 30));
      ok('a same-day block is still now inside its hours', isNow(row(v, 'tbM2')));
      tbDay = 1;
      v = view(at(D, 23, 30));
      ok('timebox Tomorrow at 23:30: tomorrow\'s blocks, none of them now', !row(v, 'tbM1') && !!row(v, 'tbM2') && !v.querySelector('.tb-row.live'));
      tbDay = 0;
      // the rule itself
      ok('timebox: 23:00–01:00 is now at 23:30 on its day', tbLive(night, at(D, 23, 30)));
      ok('…and at 00:30 the morning after', tbLive(night, at(N, 0, 30)));
      ok('…but not at 01:00, at 22:59, at 00:30 BEFORE it, or at 23:30 the next day',
        !tbLive(night, at(N, 1, 0)) && !tbLive(night, at(D, 22, 59)) && !tbLive(night, at(D, 0, 30)) && !tbLive(night, at(N, 23, 30)));
      const toMid = { date: D, start: '23:00', end: '00:00' };
      ok('a 23:00–00:00 block runs to midnight', tbLive(toMid, at(D, 23, 59)) && !tbLive(toMid, at(N, 0, 0)));
      const same = { date: D, start: '09:00', end: '10:00' };
      ok('09:00–10:00 is now at 09:00 and 09:59, not at 10:00 or on another day',
        tbLive(same, at(D, 9, 0)) && tbLive(same, at(D, 9, 59)) && !tbLive(same, at(D, 10, 0)) && !tbLive(same, at(N, 9, 30)));
      const zero = { date: D, start: '09:00', end: '09:00' };
      ok('a block that starts and ends at the same minute is never now (not a 24-hour block)', !tbLive(zero, at(D, 9, 0)) && !tbLive(zero, at(D, 15, 0)) && !tbLive(zero, at(N, 8, 0)));
    } catch (e) {
      ok('timebox across midnight: the block ran without throwing', false, String(e && e.stack || e).slice(0, 300));
    } finally {
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      tbDay = daySnap; tbEdit = edSnap;
    }
  })();
  (function () {
    const keys = ['dp.timelog', 'dp.entries'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const H = 3600000;
    try {
      // overlapping time blocks (two phones, a hand edit) count once
      const P = addDays(todayStr(), -3), p0 = dayStartMs(P), p1 = dayEndMs(P);
      localStorage.setItem('dp.timelog', JSON.stringify([
        { id: 'ov1', act: 'work', start: p0 + 9 * H, end: p0 + 12 * H, upd: 1 },    // phone A: work 9–12
        { id: 'ov2', act: 'work', start: p0 + 10 * H, end: p0 + 13 * H, upd: 1 },   // phone B: work 10–13
        { id: 'ov3', act: 'gymt', start: p0 + 12 * H, end: p0 + 13 * H, upd: 1 },   // gym 12–13, over B's work
        { id: 'ov4', act: 'sleep', start: p0 - 1 * H, end: p0 + 7 * H, upd: 1 },    // last night's sleep…
        { id: 'ov5', act: 'sleep', start: p0 - 1 * H, end: p0 + 7 * H, upd: 1 },    // …on both phones
      ]));
      localStorage.setItem('dp.entries', '{}');
      updateTimeSummary(P);
      const sum = (DB.entry(P) || {}).timeSummary || '';
      ok('time summary: the same activity tracked twice over the same hours counts once', /Work 4h 00m/.test(sum) && /Sleep 7h 00m/.test(sum), sum);
      ok('…and a different activity over the same hours keeps its own time', /Gym 1h 00m/.test(sum), sum);
      ok('Log fill-in: tracked work and sleep are not doubled', trackedHours(P, 'work') === 4 && trackedSleepHours(P) === 8, [trackedHours(P, 'work'), trackedSleepHours(P)]);
      const tt = timeTotalsHTML(P);
      // covered: sleep 0–7 (twice) + work 9–13 (gym 12–13 sits inside it) = 11 h
      ok('Time screen: the day total is the time covered, not the sum of the bars',
        tt.includes('Tracked <b>11h 00m</b> · untracked ' + fmtDur(p1 - p0 - 11 * H)), tt.slice(-160));
      const hdWork = (historyDayHTML(P).match(/Work<\/span><span class="hd-ab">.*?<\/span><b>([^<]*)<\/b>/) || [])[1];
      ok('day page: the same activity tracked twice is not doubled', hdWork === '4h 00m', hdWork);
      // a day covered twice over: coverage reads 100%, not 200%+
      const Q = addDays(todayStr(), -5), q0 = dayStartMs(Q), q1 = dayEndMs(Q);
      localStorage.setItem('dp.timelog', JSON.stringify([
        { id: 'ow1', act: 'work', start: q0, end: q1, upd: 1 },
        { id: 'ow2', act: 'work', start: q0, end: q1, upd: 1 },
        { id: 'ow3', act: 'learn', start: q0 + 6 * H, end: q0 + 18 * H, upd: 1 },
      ]));
      const st = timeStatsHTML([Q]);
      const cov = +((st.match(/>(\d+)%<\/div><div class="l">of time covered/) || [])[1]);
      ok('Stats: a day tracked twice over (two phones) reads 100% covered, never more', cov === 100, cov);
      const trk = +((st.match(/>(\d+)h<\/div><div class="l">tracked/) || [])[1]);
      ok('…and its tracked hours are the length of the day', trk === Math.round((q1 - q0) / H), trk);
      const mr = monthReview(Q.slice(0, 7));
      ok('month wrap-up: overlaps count once in its total and per activity',
        mr.trackedMs === q1 - q0 && (mr.actRows.find(r => r.id === 'work') || {}).ms === q1 - q0, [mr.trackedMs / H, mr.actRows.map(r => r.id + ':' + r.ms / H)]);
      const qw = { days: [Q], t0: q0, t1: q1 };
      ok('compare periods: tracked time counts an hour once', vsCtx().trackedMs(qw) === q1 - q0, vsCtx().trackedMs(qw) / H);
      // the rule itself
      ok('coveredMs: overlapping blocks count once', coveredMs([{ a: 0, b: 2 * H }, { a: H, b: 3 * H }]) === 3 * H);
      ok('coveredMs: a block inside another adds nothing', coveredMs([{ a: 0, b: 4 * H }, { a: H, b: 2 * H }]) === 4 * H);
      ok('coveredMs: blocks that touch or stand apart add up', coveredMs([{ a: 3 * H, b: 4 * H }, { a: 0, b: H }, { a: H, b: 2 * H }]) === 3 * H);
      ok('coveredMs: clamped to the range asked for', coveredMs([{ a: -H, b: 2 * H }], 0, H) === H && coveredMs([]) === 0);
    } catch (e) {
      ok('overlapping time blocks: the block ran without throwing', false, String(e && e.stack || e).slice(0, 300));
    } finally {
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
    }
  })();

  // ---- review #9: the time re-sum reads the entries once and writes the changed days in one save ----
  /* syncTimelogNow re-sums EVERY day that has a block. Per day it re-scanned the whole time log
     and re-parsed the whole entries store (and re-wrote it for each changed day): 1.7 s on every
     timer stop with 3 years of data. The lines must stay exactly what the per-day sum gave. */
  (function () {
    const keys = ['dp.timelog', 'dp.entries', 'dp.settings', 'dp.timelogDel'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const fSnap = window.fetch, eSnap = DB.entries, sSnap = DB.saveEntries;
    const H = 3600000, T = todayStr(), now = Date.now();
    let reads = 0, writes = 0;
    try {
      window.fetch = () => Promise.resolve({ ok: true });
      const st = DB.settings(); st.syncUrl = 'https://example.invalid/exec'; DB.saveSettings(st);
      const tl = [], ents = {}, acts = ['work', 'sleep', 'gymt', 'learn'];
      for (let i = 1; i <= 30; i++) {
        const d = addDays(T, -i), d0 = dayStartMs(d);
        tl.push({ id: 'rs' + i + 'a', act: 'sleep', start: d0 - 2 * H, end: d0 + 6 * H, upd: 1 });           // across midnight
        tl.push({ id: 'rs' + i + 'b', act: acts[i % 4], start: d0 + 9 * H, end: d0 + (10 + i % 3) * H, upd: 1 });
        if (i % 5 === 0) tl.push({ id: 'rs' + i + 'c', act: acts[i % 4], start: d0 + 9.5 * H, end: d0 + 11 * H, upd: 1 });   // overlap
        if (i % 7 === 0) ents[d] = { mood: 6, habits: {}, timeSummary: 'stale line', autoAt: { timeSummary: 1 } };
      }
      ents[addDays(T, -40)] = { mood: 4, habits: {}, timeSummary: 'a day with no block left' };   // dropped
      tl.push({ id: 'rsRun', act: 'work', start: now - 2 * H, end: null, upd: 1 });                 // running
      tl.push({ id: 'rsLong', act: 'learn', start: dayStartMs(addDays(T, -12)) + 20 * H, end: dayStartMs(addDays(T, -10)) + 3 * H, upd: 1 });   // 3 days
      localStorage.setItem('dp.timelog', JSON.stringify(tl));
      localStorage.setItem('dp.entries', JSON.stringify(ents));
      const days = new Set(); tl.forEach(s => segDays(s, days)); days.add(addDays(T, -40));
      // the reference: the per-day sum, from segsForDay
      const ref = {};
      days.forEach(d => { const t = actTotalsMs(segsForDay(d));
        ref[d] = Object.keys(t).sort((x, y) => t[y] - t[x]).map(id => { const a = actById(id); return `${a.emoji} ${a.name} ${fmtDur(t[id])}`; }).join(' · ') || undefined; });
      DB.entries = function () { reads++; return eSnap.call(this); };
      DB.saveEntries = function (e) { writes++; return sSnap.call(this, e); };
      _tlDirty.add(addDays(T, -40)); clearTimeout(timelogSyncTimer); syncTimelogNow();
      DB.entries = eSnap; DB.saveEntries = sSnap;
      const got = DB.entriesRO(), bad = [...days].filter(d => (got[d] || {}).timeSummary !== ref[d]);
      ok('review #9: the batched re-sum gives every day the same line as the per-day sum', bad.length === 0 && days.size > 30,
        bad.slice(0, 3).map(d => [d, (got[d] || {}).timeSummary, ref[d]]));
      ok('review #9: …a day with no block left loses its line, stamped', !('timeSummary' in got[addDays(T, -40)]) && +(got[addDays(T, -40)].autoAt || {}).timeSummary > 0 && got[addDays(T, -40)].mood === 4);
      ok('review #9: …the rest of a day is untouched', got[addDays(T, -7)].mood === 6 && +got[addDays(T, -7)].autoAt.timeSummary > 1);
      ok('review #9: the entries are read once and written once for the whole re-sum', reads === 1 && writes === 1, { reads, writes, days: days.size });
      reads = writes = 0;
      DB.entries = function () { reads++; return eSnap.call(this); };
      DB.saveEntries = function (e) { writes++; return sSnap.call(this, e); };
      const before = localStorage.getItem('dp.entries');
      syncTimelogNow();
      DB.entries = eSnap; DB.saveEntries = sSnap;
      ok('review #9: nothing changed: one read, no write', reads === 1 && writes === 0 && localStorage.getItem('dp.entries') === before, { reads, writes });
      ok('review #9: updateTimeSummary(day) still re-sums one day', (() => {
        const d = addDays(T, -3), e = DB.entries(); delete e[d]; localStorage.setItem('dp.entries', JSON.stringify(e));
        updateTimeSummary(d); return (DB.entry(d) || {}).timeSummary === ref[d]; })());
    } catch (e) {
      ok('review #9: the block ran without throwing', false, String(e && e.stack || e).slice(0, 300));
    } finally {
      DB.entries = eSnap; DB.saveEntries = sSnap; window.fetch = fSnap; _tlDirty.clear();
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
    }
  })();

  // ---- v253: the read-only parse cache (Stats 2.4× faster with 3 years of data) ----
  (function () {
    const eSnap = localStorage.getItem('dp.entries'), roSnap = roParse;
    try {
      const T0 = todayStr();
      localStorage.setItem('dp.entries', JSON.stringify({ [T0]: { mood: 5, habits: {} } }));
      const a = DB.entriesRO(), b = DB.entriesRO();
      ok('a second read of an unchanged store is the cached object', a === b && a[T0].mood === 5);
      DB.putEntry(T0, { mood: 9, habits: {} });
      ok('…and a write through the app is seen at once', DB.entriesRO()[T0].mood === 9);
      localStorage.setItem('dp.entries', JSON.stringify({ [T0]: { mood: 2, habits: {} } }));
      ok('…as is a write straight to storage (a restore, a sync, another tab)', DB.entriesRO()[T0].mood === 2);
      ok('DB.entries() still hands out a fresh copy to code that edits', DB.entries() !== DB.entries() && DB.entries() !== DB.entriesRO());
      const nsS = localStorage.getItem('dp.notes');
      localStorage.setItem('dp.notes', JSON.stringify([{ id: 'nH1', text: 'one', color: '', created: T0 }, { id: 'nH2', text: 'two\nlines', color: '', created: T0 }]));
      navigateTo('notes');
      ok('note boxes are fitted to their text (in one batch)', [...document.querySelectorAll('#note-list .note-text')].every(t => /px$/.test(t.style.height)));
      if (nsS != null) localStorage.setItem('dp.notes', nsS); else localStorage.removeItem('dp.notes');
      // Nothing that reads through the cache may change what it reads: freeze it and draw everything.
      if (eSnap != null) localStorage.setItem('dp.entries', eSnap);
      seedSampleData();
      const deepFreeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
      roParse = (key, fb) => deepFreeze(roSnap(key, fb));
      let threw = null;
      try {
        ['today', 'dash', 'cal', 'history', 'habits', 'time', 'awards', 'search'].forEach(k => show(k));
        ['health', 'mood', 'habits', 'time', 'money', 'check', 'overview'].forEach(t => { dashTab = t; renderDash(); });
        habitStreak(HABITS[0].key); bestHabitStreak(HABITS[0].key); loggedStreak(); yearPixelsHTML(); segsForDay(addDays(T0, -2)); contentDates();
        histDayOpen(addDays(T0, -2));
        const c = document.querySelector('#s-today [data-habit]'); navigateTo('today'); const c2 = document.querySelector('#s-today [data-habit]'); if (c2) c2.click();
      } catch (e) { threw = e.message; }
      ok('no screen or helper writes into the shared read-only data', threw === null, threw);
    } finally {
      roParse = roSnap; _roCache.clear(); try { clearSampleData && clearSampleData(); } catch (e) {}
      if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
      histDay = null; navigateTo('today');
    }
  })();

  // ---- v253: the Log's save path (independent review: lost typing, wrong day) ----
  (function () {
    const T0 = todayStr(), dA = addDays(T0, -2), dB = addDays(T0, -3);
    const eSnap = localStorage.getItem('dp.entries'), ldSnap = logDate, tsSnap = window.todayStr;
    const ent = d => (DB.entries()[d] || {});
    const jt = () => document.querySelector('#s-today [data-txt=journal]');
    const typeJ = (txt) => { const t = jt(); if (!t) { ok('the Log has a journal box', false); return; } t.value = txt; t.dispatchEvent(new Event('input', { bubbles: true })); };
    try {
      const e = DB.entries(); delete e[T0]; delete e[dA]; delete e[dB]; localStorage.setItem('dp.entries', JSON.stringify(e));
      navigateTo('today');
      typeJ('Walked to the lake');
      ok('(typing schedules an autosave)', !!_pendingSave && ent(T0).journal !== 'Walked to the lake');
      navigateTo('today');                                   // a re-render inside the 700 ms
      ok('re-opening the Log inside the autosave delay keeps what was typed', ent(T0).journal === 'Walked to the lake' && jt().value === 'Walked to the lake', [ent(T0).journal, jt() && jt().value]);
      typeJ('Walked to the lake. Then dinner.');
      applyRemoteState({ touched: 1, entries: {} });         // a sync pull lands mid-typing
      ok('a sync pull mid-typing saves the typing first', ent(T0).journal === 'Walked to the lake. Then dinner.' && !_pendingSave);
      typeJ('Typed right before switching apps');
      window.dispatchEvent(new Event('pagehide'));
      ok('closing or hiding the app saves the pending typing', ent(T0).journal === 'Typed right before switching apps' && !_pendingSave);
      // a pending save for another day is not cancelled by Done on this one
      logDate = dA; openToday(); typeJ('About day A');
      logDate = T0; draft = JSON.parse(JSON.stringify(DB.entry(T0))); // the draft was replaced without loadDraft
      document.getElementById('save-entry') && document.getElementById('save-entry').click();
      ok('Done does not throw away a pending save for another day', ent(dA).journal === 'About day A', ent(dA));

      // midnight: the Log open as "Today" moves to the new today when the app comes back
      navigateTo('today');
      const tomorrow = addDays(T0, 1);
      window.todayStr = () => tomorrow;
      logRollover();
      ok('the Log left open overnight moves to the new day', logDate === tomorrow && document.getElementById('screen-title').textContent === 'Today' && document.getElementById('log-date').max === tomorrow, [logDate, document.getElementById('log-date') && document.getElementById('log-date').max]);
      window.todayStr = tsSnap;
      logDate = dA; openToday();
      window.todayStr = () => tomorrow; logRollover(); window.todayStr = tsSnap;
      ok('…but a past day opened on purpose stays put', logDate === dA);
      navigateTo('today'); jt().focus();
      window.todayStr = () => tomorrow; logRollover(); window.todayStr = tsSnap;
      ok('…and nothing moves while you are typing', logDate === T0);
      jt().blur();

      // dictation started on one day never writes into another day's journal
      const SRsnap = window.SpeechRecognition; let rec = null, aborted = false;
      window.SpeechRecognition = function () { rec = this; this.start = () => {}; this.stop = () => {}; this.abort = () => { aborted = true; }; };
      const res = t => ({ results: [Object.assign([{ transcript: t }], { isFinal: true })] });
      navigateTo('today'); typeJ('TODAY notes');
      const mic = document.createElement('button');
      dictateInto('[data-txt=journal]', mic);
      rec.onresult(res('went for a run'));
      ok('(dictation writes into the open day)', ent(T0).journal === 'TODAY notes went for a run ' || jt().value === 'TODAY notes went for a run ', jt().value);
      flushAutosave();
      const e2 = DB.entries(); e2[dB] = { journal: 'YESTERDAY: the trip', habits: {} }; localStorage.setItem('dp.entries', JSON.stringify(e2));
      logDate = dB; openToday();
      rec.onresult(res('went for a run and'));
      flushAutosave();
      ok('switching day mid-dictation leaves the other day\'s journal alone', ent(dB).journal === 'YESTERDAY: the trip' && jt().value === 'YESTERDAY: the trip', [ent(dB).journal, jt().value]);
      ok('…and stops listening', aborted);
      stopDictation && (_recogOn = false, _recog = null, _recogBtn = null);
      window.SpeechRecognition = SRsnap;
      ok('dictation into a field outside the Log is never "stale"', dictStaleCheck(document.createElement('textarea'))() === false);

      // tags: whole tags only
      ok('hasTag matches a whole tag, any case, before punctuation', hasTag('A day. #Content.', '#content') && hasTag('#content', '#content') && !hasTag('for #contentcreation', '#content') && !hasTag('#content-ish', '#content') && !hasTag('a#content', '#content'));
      navigateTo('today'); typeJ('Filmed two reels for #contentcreation today');
      const w = document.createElement('button'); w.dataset.mmword = 'Content'; document.getElementById('s-today').appendChild(w);
      w.click();
      ok('tagging "Content" next to #contentcreation adds the tag', draft.journal === 'Filmed two reels for #contentcreation today #content', draft.journal);
      w.click();
      ok('…and untagging removes only it, never part of another tag', draft.journal === 'Filmed two reels for #contentcreation today', draft.journal);
      w.remove();

      // a sample day you write in is yours
      saveDraftNow(dA, { sample: true, journal: 'REAL: my sister visited', habits: {} });
      ok('saving a sample day makes it a real entry ("Clear sample" keeps it)', ent(dA).journal === 'REAL: my sister visited' && ent(dA).sample === undefined);

      // Workout from a past day's Log
      logDate = dA; openToday();
      const g = document.getElementById('log-open-gym') || Object.assign(document.createElement('button'), { id: 'log-open-gym' });
      if (!g.isConnected) document.getElementById('s-today').appendChild(g);
      ok('the Log\'s workout button names the day it opens', !document.getElementById('log-open-gym').textContent.includes("today's") || logDate === todayStr());
      g.click();
      ok('…and opens THAT day\'s gym, not today\'s', document.getElementById('s-gym').classList.contains('on') && gymDate === dA, gymDate);
    } finally {
      window.todayStr = tsSnap; flushAutosave();
      if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
      logDate = ldSnap; navigateTo('today');
    }
  })();

  // ---- Home-screen widget (Play build 121): what it is sent, and its one-tap mood ----
  (function () {
    const T0 = todayStr();
    const eSnap = localStorage.getItem('dp.entries'), capSnap = window.Capacitor;
    const ent = d => (DB.entries()[d] || {});
    const dOf = at => todayStr(new Date(at));
    const clear = (...ds) => { const e = DB.entries(); ds.forEach(d => delete e[d]); localStorage.setItem('dp.entries', JSON.stringify(e)); };
    const setEnt = (d, patch) => { const e = DB.entries(); e[d] = Object.assign({ habits: {} }, e[d], patch); localStorage.setItem('dp.entries', JSON.stringify(e)); };
    try {
      flushAutosave();
      window.Capacitor = undefined;
      let threw = false; try { pushWidgetData(); } catch (x) { threw = true; }
      ok('widget: with no WidgetBridge (the web, Play builds up to 120) pushWidgetData does nothing and never throws', !threw && widgetPlugin() === null);

      const sent = [];
      window.Capacitor = { Plugins: { WidgetBridge: { update: o => { sent.push(o); return Promise.resolve({ ok: true }); } } } };
      const last = () => sent[sent.length - 1] || {};
      clear(T0);
      pushWidgetData();
      ok('widget: an unlogged today is sent as not logged, with the day it is about', last().day === T0 && last().logged === false && last().mood === null && typeof last().streak === 'number', last());
      ok('…and no journal or other typed text is ever sent to it', !Object.keys(last()).some(k => /journal|text|note|wins|title/i.test(k)), Object.keys(last()));
      setEnt(T0, { timeSummary: { work: 60 }, autoAt: { timeSummary: 1 } });
      pushWidgetData();
      ok('…a day with only an auto-filled time summary still shows as not logged', last().logged === false, last());

      // every tap below is inside one calendar day, even when the suite runs just after midnight
      let n = Date.now(); if (dOf(n - 10000) !== dOf(n)) n -= 11000;
      const D = dOf(n);
      let r = widgetTapsApply([{ action: 'mood', mood: 7, at: n - 4000 }], n);
      ok('widget tap: the mood is saved on the day it was tapped, through the Log save path', ent(D).mood === 7 && !!ent(D).updatedAt && r.saved.length === 1 && r.saved[0].date === D, ent(D));
      ok('…keeping what other screens filled in, and leaving energy alone', (D !== T0 || (ent(D).timeSummary || {}).work === 60) && ent(D).energy === undefined, ent(D));
      ok('…and the widget is refreshed with it', D !== T0 || (last().mood === 7 && last().logged === true), last());

      setEnt(D, { mood: 3, journal: 'kept', updatedAt: new Date(n - 1000).toISOString() });
      r = widgetTapsApply([{ action: 'mood', mood: 9, at: n - 2000 }], n);
      ok('widget tap: an older queued tap never overwrites a mood saved after it', ent(D).mood === 3 && r.kept.includes(D) && !r.saved.length, [ent(D).mood, r]);
      r = widgetTapsApply([{ action: 'mood', mood: 9, at: n - 500 }], n);
      ok('…a tap newer than the last edit changes it, and keeps the rest of the day', ent(D).mood === 9 && ent(D).journal === 'kept', ent(D));

      setEnt(D, { updatedAt: new Date(n - 9000).toISOString() });
      r = widgetTapsApply([{ action: 'mood', mood: 1, at: n - 1000 }, { action: 'mood', mood: 5, at: n - 3000 }], n);
      ok('widget taps: several on one day, in any order: the newest wins', ent(D).mood === 1 && r.saved.length === 1, ent(D).mood);
      const ua = ent(D).updatedAt;
      r = widgetTapsApply([{ action: 'mood', mood: 1, at: n - 50 }], n);
      ok('…a tap for the mood already set writes nothing', ent(D).updatedAt === ua && r.saved.length === 1);

      const Y = addDays(D, -1), yAt = new Date(Y + 'T21:30:00').getTime();
      clear(Y);
      r = widgetTapsApply([{ action: 'mood', mood: 8, at: yAt }, { action: 'open', at: n - 100 }], n);
      ok('widget tap: one tapped before midnight lands on that day, not on the day the app opened', ent(Y).mood === 8 && r.saved.some(s => s.date === Y) && r.any, ent(Y));
      setEnt(D, { updatedAt: new Date(n - 9000).toISOString() });
      r = widgetTapsApply([{ action: 'mood', mood: 6, at: n + 86400000 }], n);
      ok('…a tap stamped in the future (a clock change) counts as now, on today', ent(D).mood === 6 && r.saved[0].date === D, ent(D).mood);

      const before = JSON.stringify(DB.entries());
      r = widgetTapsApply([{ action: 'mood', mood: 0, at: n }, { action: 'mood', mood: 11, at: n }, { action: 'mood', mood: 'x', at: n },
        { action: 'mood', mood: 5 }, { action: 'nope', mood: 5, at: n }, null, 7], n);
      ok('widget taps: out-of-range moods, missing times and unknown actions change nothing', JSON.stringify(DB.entries()) === before && !r.saved.length && !r.kept.length, r);
      ok('…and an empty or missing queue is nothing at all', !widgetTapsApply([]).any && !widgetTapsApply(undefined).any);
    } finally {
      window.Capacitor = capSnap;
      if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
    }
  })();

  // ---- v254: the app says when the Sheet's script is an old copy ----
  (function () {
    const keys = ['dp.sheetScript', 'dp.settings'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const tSnap = window.toast, toasts = []; window.toast = (m) => toasts.push(m);
    const pspSnap = settingsPage;
    // pull through the real pullState; jsdom never loads the <script>, so answer it by hand
    // (jsdom's 404 for the script lands later and would call done(false) after the test; detach it)
    const answer = (args) => { const cb = Object.keys(window).filter(k => /^dpcb\d+$/.test(k)).pop(); const el = document.querySelector('script[src*="callback=' + cb + '&"]'); if (el) el.onerror = null; window[cb](...args); };
    const pull = (args) => { let done = null; pullState(ok => { done = ok; }); answer(args); return done; };
    const U1 = 'https://script.google.com/macros/s/ONE/exec', U2 = 'https://script.google.com/macros/s/TWO/exec';
    try {
      localStorage.removeItem('dp.sheetScript');
      const st = DB.settings(); st.syncUrl = U1; DB.saveSettings(st);
      ok('a pull from the current script is not "old"', pull([{}, { script: SHEET_SCRIPT }]) === true && !sheetScriptOld(U1) && !toasts.length, toasts);
      ok('a pull from a copy pasted before versions (one argument) is old', pull([{}]) === true && sheetScriptOld(U1));
      ok('…and says so once', toasts.length === 1 && /Sheet script is out of date/.test(toasts[0]) && /Backup & restore/.test(toasts[0]), toasts);
      pull([{}]); pull([{}]);
      ok('…not on every open', toasts.length === 1, toasts.length);
      ok('an older numbered copy is old too', pull([{}, { script: SHEET_SCRIPT - 1 }]) && sheetScriptOld(U1));
      ok('a newer copy than this app knows is not old', pull([{}, { script: SHEET_SCRIPT + 1 }]) && !sheetScriptOld(U1));
      pull([{}]);
      ok('it is kept per link: a new link is not judged by the old one', sheetScriptOld(U1) && !sheetScriptOld(U2) && !sheetScriptOld(''));
      settingsPage = 'data'; renderSettings();
      const box = document.getElementById('sync-old');
      ok('Settings ▸ Backup & restore shows how to update an old copy', !!box && /New version/.test(box.textContent) && !!box.querySelector('a[href="sheets-setup.html#update"]'), box && box.textContent.slice(0, 80));
      settingsPage = null; renderSettings();
      const rowSub = [...document.querySelectorAll('#s-settings [data-set-page="data"]')].map(b => b.textContent).join('');
      ok('…and the Settings home row says so', /Sheet script is out of date/.test(rowSub), rowSub);
      pull([{}, { script: SHEET_SCRIPT }]);
      settingsPage = 'data'; renderSettings();
      ok('once the new copy answers, the notice goes', !document.getElementById('sync-old') && !sheetScriptOld(U1));
      localStorage.setItem('dp.sheetScript', JSON.stringify({ url: U1, v: 1 }));
      const sn = document.getElementById('sync-now');
      if (sn) { sn.click(); answer([{}]); }
      ok('a Sync now that finds an old copy shows the notice at once, without leaving the page', !!sn && !!document.getElementById('sync-old') && settingsPage === 'data');
      ok('which script answered is this device\'s, never in a backup', BACKUP_EXCLUDED.includes('sheetScript'));
    } finally {
      window.toast = tSnap; settingsPage = pspSnap; clearTimeout(pushTimer); _pushPending = null;
      Object.keys(window).filter(k => /^dpcb\d+$/.test(k)).forEach(k => { delete window[k]; });
      document.querySelectorAll('script[src*="type=pull"]').forEach(x => x.remove());
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      renderSettings();
    }
  })();

  // ---- v254: a failed pull says why, once, and never hangs or raises the crash sheet ----
  (function () {
    const keys = ['dp.sheetScript', 'dp.settings', 'dp.errlog', 'dp.onboarded'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const tSnap = window.toast, toasts = []; window.toast = (m, err) => toasts.push((err ? 'ERR ' : '') + m);
    const fSnap = window.fetch, sent = []; window.fetch = (u, o) => { sent.push(o && o.body); return Promise.resolve({ ok: true }); };
    const stSnap = window.setTimeout, pspSnap = settingsPage;
    const lastCb = () => Object.keys(window).filter(k => /^dpcb\d+$/.test(k)).pop();
    const lastScript = () => [...document.querySelectorAll('script[src*="type=pull"]')].pop();
    // start a pull and hand back its script element, with jsdom's own late 404 detached
    const start = () => { const calls = []; pullState((ok, why) => calls.push([ok, why])); const el = lastScript(); const on = { error: el.onerror, load: el.onload }; el.onerror = el.onload = null; return { calls, el, on, cb: lastCb() }; };
    try {
      const st = DB.settings(); st.syncUrl = 'https://script.google.com/macros/s/FAIL/exec'; DB.saveSettings(st);
      const open0 = _pullsOpen;
      let p = start(); p.on.error();
      ok('a link that does not load: done(false, "unreachable")', JSON.stringify(p.calls) === '[[false,"unreachable"]]', p.calls);
      ok('…the script is gone and the pull no longer counted as open', !p.el.isConnected && _pullsOpen === open0);
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
      p = start(); p.on.error();
      delete navigator.onLine;
      ok('no connection: done(false, "offline")', JSON.stringify(p.calls) === '[[false,"offline"]]', p.calls);
      p = start(); p.on.load(); p.on.error();
      ok('a reply that loads but never calls back: done(false, "unreadable"), once', JSON.stringify(p.calls) === '[[false,"unreadable"]]', p.calls);
      ok('…and an answer that turns up later finds a harmless callback', typeof window[p.cb] === 'function' && (window[p.cb]({ touched: 1 }), true));
      let fired = null; window.setTimeout = (fn, ms) => { if (ms === PULL_WAIT) { fired = fn; return 0; } return stSnap(fn, ms); };
      p = start(); window.setTimeout = stSnap;
      ok('a pull waits PULL_WAIT for its answer', typeof fired === 'function' && PULL_WAIT >= 15000);
      fired && fired(); p.on.load();
      ok('no answer in time: done(false, "timeout"), once', JSON.stringify(p.calls) === '[[false,"timeout"]]', p.calls);
      const shown0 = _crashShown;
      p = start(); window[p.cb]({ get touched() { throw new Error('boom'); } });
      ok('a state the merge throws on: done(false, "unreadable"), and logged', JSON.stringify(p.calls) === '[[false,"unreadable"]]' && /sync pull: boom/.test(localStorage.getItem('dp.errlog') || ''), p.calls);
      document.querySelectorAll('#crash-sheet').forEach(x => x.remove()); _crashShown = shown0;
      p = start(); window[p.cb]({}, { script: SHEET_SCRIPT }); p.on.load();
      ok('a good answer: done(true) once, even though load fires after it', JSON.stringify(p.calls) === '[[true,null]]' || JSON.stringify(p.calls) === '[[true,undefined]]' || (p.calls.length === 1 && p.calls[0][0] === true), p.calls);
      ok('…and its callback is removed', !(p.cb in window));
      // "Script error." from a pull's reply is the pull's to report, not the crash sheet's
      p = start();
      window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.', filename: '' }));
      ok('a reply that does not parse does not raise the crash sheet', !_crashShown && !document.getElementById('crash-sheet'));
      window.dispatchEvent(new ErrorEvent('error', { message: 'Uncaught SyntaxError: Invalid or unexpected token', filename: p.el.src, lineno: 1 }));
      ok('…nor does the same from this origin, which names the pull\'s URL', !_crashShown && !document.getElementById('crash-sheet'));
      window.dispatchEvent(new ErrorEvent('error', { message: 'Uncaught TypeError: x is not a function', filename: 'https://daylog.test/app.js', lineno: 9 }));
      ok('…while a real error during a pull still does', _crashShown && !!document.getElementById('crash-sheet'));
      document.querySelectorAll('#crash-sheet').forEach(x => x.remove()); _crashShown = shown0;
      p.on.load();
      window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.', filename: '' }));
      ok('…and for five minutes after a pull ended (a reply can land after the timeout), it still does not', !_crashShown && !document.getElementById('crash-sheet'));
      const pe = _pullEnded; _pullEnded = Date.now() - 6 * 60000;
      window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.', filename: '' }));
      ok('…but with no pull open or recent, "Script error." still does', _crashShown && !!document.getElementById('crash-sheet'));
      _pullEnded = pe;
      document.querySelectorAll('#crash-sheet').forEach(x => x.remove()); _crashShown = shown0;
      // what the buttons say
      settingsPage = 'data'; renderSettings(); toasts.length = 0; sent.length = 0;
      document.getElementById('sync-now').click(); lastScript().onerror();
      ok('Sync now that reaches nothing says so, not "Synced ✅"', toasts.length === 2 && toasts[1].startsWith('ERR Could not reach your Sheet') && !toasts.some(t => /Synced/.test(t)), toasts);
      ok('…and does not push', sent.length === 0, sent.length);
      toasts.length = 0; document.getElementById('sync-now').click(); lastScript().onload();
      ok('Sync now with an unreadable copy points at the script', /could not be read/.test(toasts[1] || ''), toasts);
      toasts.length = 0; document.getElementById('sync-now').click(); window[lastCb()]({}, { script: SHEET_SCRIPT });
      ok('Sync now that works still says "Synced ✅"', toasts[1] === 'Synced ✅', toasts);
      renderSettings(); toasts.length = 0;
      document.getElementById('sync-url').value = 'https://script.google.com/macros/s/FAIL2/exec';
      document.getElementById('save-sync').click(); lastScript().onerror();
      ok('Connect to a link that does not load says so, not "Connected (nothing to pull yet)"', toasts.some(t => t.startsWith('ERR Could not reach')) && !toasts.some(t => /nothing to pull/.test(t)), toasts);
      let out = null;
      syncLinkRestore('https://script.google.com/macros/s/R/exec', (status) => { out = status; }); lastScript().onload();
      ok('restoring from a sheet whose copy cannot be read ends, as "unreadable"', out === 'unreadable', out);
      out = null; syncLinkRestore('https://script.google.com/macros/s/R/exec', (status) => { out = status; }); lastScript().onerror();
      ok('…and from one that does not load, as "unreachable"', out === 'unreachable', out);
      out = null; window.setTimeout = (fn, ms) => { if (ms === PULL_WAIT) { fired = fn; return 0; } return stSnap(fn, ms); };
      syncLinkRestore('https://script.google.com/macros/s/SLOW/exec', (status) => { out = status; }); window.setTimeout = stSnap; fired();
      ok('…and from one that does not answer in time, as "timeout", keeping the link for a retry', out === 'timeout' && DB.settings().syncUrl === 'https://script.google.com/macros/s/SLOW/exec', out);
      ok('every failure has its own words', new Set(['offline', 'timeout', 'unreadable', 'unreachable'].map(syncFailMsg)).size === 4);
      ok('no pull is left open', _pullsOpen === open0, _pullsOpen);
    } finally {
      window.toast = tSnap; window.fetch = fSnap; window.setTimeout = stSnap; settingsPage = pspSnap; try { delete navigator.onLine; } catch (e) {}
      clearTimeout(pushTimer); _pushPending = null;
      Object.keys(window).filter(k => /^dpcb\d+$/.test(k)).forEach(k => { delete window[k]; });
      document.querySelectorAll('script[src*="type=pull"]').forEach(x => { x.onerror = x.onload = null; x.remove(); });
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      renderSettings();
    }
  })();

  // ---- v254: Memories — pages with properties, links, videos ----
  (function () {
    const keys = ['dp.docs', 'dp.navcfg'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const tSnap = window.toast; window.toast = () => {};
    const mSnap = new Map(_media), rdySnap = _mediaReady;
    try {
      // when a photo or video was taken
      const exif = (str) => {   // a minimal JPEG: SOI, then APP1 with IFD0 -> Exif IFD -> DateTimeOriginal
        const dt = [...str].map(c => c.charCodeAt(0)).concat([0]), b = [];
        const u16 = n => [n & 255, n >> 8], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24];
        const tiff = [0x49, 0x49, ...u16(42), ...u32(8), ...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0),
          ...u16(1), ...u16(0x9003), ...u16(2), ...u32(dt.length), ...u32(44), ...u32(0), ...dt];
        const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
        b.push(0xFF, 0xD8, 0xFF, 0xE1, (app1.length + 2) >> 8, (app1.length + 2) & 255, ...app1, 0xFF, 0xDA, 0, 2);
        return new Uint8Array(b).buffer;
      };
      ok('EXIF: the date a photo was taken, in the camera\'s local time', exifTaken(exif('2024:05:12 09:15:00')) === new Date(2024, 4, 12, 9, 15, 0).getTime());
      ok('…none in a JPEG without EXIF, junk, a future date or a zeroed one', exifTaken(new Uint8Array([0xFF, 0xD8, 0xFF, 0xDA, 0, 2]).buffer) === null
        && exifTaken(new Uint8Array([1, 2, 3]).buffer) === null && exifTaken(exif('2099:01:01 00:00:00')) === null && exifTaken(exif('0000:00:00 00:00:00')) === null);
      const mvhd = (ver, secs) => { const b = new DataView(new ArrayBuffer(ver ? 36 : 32)); b.setUint32(0, ver ? 36 : 32); [0x6d, 0x76, 0x68, 0x64].forEach((c, i) => b.setUint8(4 + i, c)); b.setUint8(8, ver);
        if (ver) { b.setUint32(12, Math.floor(secs / 4294967296)); b.setUint32(16, secs % 4294967296); } else b.setUint32(12, secs); return b; };
      const at = Date.UTC(2024, 4, 12, 10, 30) / 1000 + 2082844800;
      ok('MP4: a video\'s creation time from its mvhd box (both versions)', mvhdTaken(mvhd(0, at)) === Date.UTC(2024, 4, 12, 10, 30) && mvhdTaken(mvhd(1, at)) === Date.UTC(2024, 4, 12, 10, 30));
      ok('…none when the camera wrote zero', mvhdTaken(mvhd(0, 0)) === null);
      const grp = memGroupByDay([{ t: new Date(2024, 4, 12, 23, 50).getTime() }, { t: new Date(2023, 11, 31, 8, 0).getTime() }, { t: new Date(2024, 4, 12, 0, 10).getTime() }]);
      ok('files group by the local day they were taken, oldest first', grp.map(g => g.day + ':' + g.items.length).join() === '2023-12-31:1,2024-05-12:2', grp.map(g => g.day));
      // properties
      ok('people and tags: trimmed, de-duplicated without regard to case', JSON.stringify(memWords(' Asha, asha ,Ravi,, ')) === '["Asha","Ravi"]');
      ok('…and read safely from another phone\'s junk', JSON.stringify(memArr(['a', 3, null, ' ', ' b '])) === '["a","b"]' && memArr('x').length === 0);
      const A = { id: 'mA', kind: 'memory', title: 'Beach day', date: '2024-05-12', place: 'Goa', people: ['Asha', 'Ravi'], tags: ['trip'],
        blocks: [{ id: 'b1', t: 'p', text: 'Better than [[New Year\'s Eve]] <b>really</b>' }, { id: 'b2', t: 'v', mid: 'gone' }], created: '2024-05-12', updated: '' };
      const B = { id: 'mB', kind: 'memory', title: "New Year's Eve", date: '2023-12-31', place: 'goa ', people: [], tags: [], blocks: [], created: '2023-12-31', updated: '' };
      const C = { id: 'mC', kind: 'memory', title: '', date: '2022-01-02', place: '', people: ['asha'], tags: [], blocks: [], created: '', updated: '' };
      const W = { id: 'dW', title: 'Ideas', blocks: [{ id: 'w1', t: 'p', text: 'see [[beach day]] and [[Ideas]]' }], created: '2024-01-01', updated: '' };
      localStorage.setItem('dp.docs', JSON.stringify([A, B, C, W]));
      ok('a memory without a title goes by its date', memTitle(C) === memDateLong('2022-01-02') && /2022/.test(memTitle(C)));
      ok('links: [[Title]] finds the page without regard to case', docByTitle("new year's eve").id === 'mB' && docByTitle('BEACH DAY').id === 'mA' && docByTitle('nope') === null);
      ok('backlinks: every page that links here, articles included', docBacklinks(A).map(d => d.id).join() === 'dW' && docBacklinks(B).map(d => d.id).join() === 'mA');
      ok('…but never the page itself, when it names itself', docBacklinks(W).length === 0);
      const html = memInline("Better than [[New Year's Eve]] <b>x</b> and [[Nowhere]]\nnext <i>end</i>");
      ok('read view text: links become buttons, unknown links are marked, HTML is escaped, lines kept',
        /data-memlink="mB"/.test(html) && /mem-link missing/.test(html) && /&lt;b&gt;/.test(html) && !/<b>|<i>/.test(html) && /&lt;i&gt;/.test(html) && /<br>/.test(html), html);
      ok('same people or place: case-insensitive, and not the page itself', memRelated(A).map(m => m.id).sort().join() === 'mB,mC');
      ok('filter by person, place or tag; search across title, place, people, tags and text',
        memMatches(A, '', { k: 'person', v: 'asha' }) && !memMatches(B, '', { k: 'person', v: 'asha' }) && memMatches(B, '', { k: 'place', v: 'Goa' })
        && memMatches(A, 'goa really', null) && !memMatches(A, 'goa paris', null) && memMatches(A, 'trip', null));
      const fc = memFacets(memList());
      ok('facets count people across memories, merging case', fc.person[0].v === 'Asha' && fc.person[0].n === 2 && fc.place[0].n === 2, fc.person);
      ok('saving properties: a bad date is refused, words are cleaned', memSaveProp('mA', 'date', '12/05/2024') === false && memSaveProp('mA', 'people', 'Ravi, Meera') !== false
        && JSON.stringify(memList().find(m => m.id === 'mA').people) === '["Ravi","Meera"]' && memSaveProp('mA', 'evil', 'x') === false);
      ok('the Sheet gets a memory\'s properties as its first line', /📍 Goa/.test(memPropsLine(A)) && /👥 Asha, Ravi/.test(memPropsLine(A)));
      // blocks
      ok('media blocks: i photo, v video, a voice', mediaBlockType('photo') === 'i' && mediaBlockType('video') === 'v' && mediaBlockType('voice') === 'a' && isMediaBlk({ t: 'a' }) && !isMediaBlk({ t: 'p' }));
      ok('docMediaBlock adds a block once per file', docMediaBlock('mB', { id: 'vv1', kind: 'video' }) && docMediaBlock('mB', { id: 'vv1', kind: 'video' })
        && memList().find(m => m.id === 'mB').blocks.filter(b => b.mid === 'vv1').length === 1 && memList().find(m => m.id === 'mB').blocks[0].t === 'v');
      _mediaReady = true;
      ok('a video block whose file is not here says where it is', /stays on the phone it was added on/.test(mediaBlockRow({ id: 'x', t: 'v', mid: 'gone' })));
      ok('docText leaves media blocks out', docText(A) === A.blocks[0].text);
      // totals: videos apart from what a backup carries
      _media.clear();
      _media.set('p1', { id: 'p1', kind: 'photo', size: 100, ctx: 'log', day: '2024-01-01' });
      _media.set('v1', { id: 'v1', kind: 'video', size: 5000, dur: 3000, ctx: 'doc:mA', day: '2024-01-01' });
      _media.set('a1', { id: 'a1', kind: 'voice', size: 10, ctx: 'log', day: '2024-01-01' });
      const tt = mediaTotals();
      ok('totals: videos counted apart, and not in the bytes a backup carries', tt.photos === 1 && tt.voice === 1 && tt.videos === 1 && tt.bytes === 110 && tt.vbytes === 5000, tt);
      ok('Storage lists videos and says they are not in backups', storageRows().rows.some(r => r.k === 'videos' && /not in backups/.test(r.sub)));
      ok('a video tile shows its length', /0:03/.test(mediaTileHTML(_media.get('v1'))) && /mvid/.test(mediaTileHTML(_media.get('v1'))));
      // screens
      navigateTo('write');
      ok('Write lists articles, not memories', /Ideas/.test(document.getElementById('s-write').textContent) && !/Beach day/.test(document.getElementById('s-write').textContent));
      navigateTo('memories');
      const sc = document.getElementById('s-memories');
      ok('Memories: a timeline by year, newest first', [...sc.querySelectorAll('.mem-year-h')].map(h => h.textContent).join() === '2024,2023,2022');
      sc.querySelector('[data-memopen="mA"]').click();
      ok('a memory opens to its read view: title, properties, linked text', /Beach day/.test(sc.querySelector('.mem-title').textContent) && !!sc.querySelector('[data-memlink="mB"]') && sc.querySelectorAll('.mem-prop').length === 4);
      ok('…and lists the pages that link to it', /Ideas/.test([...sc.querySelectorAll('.mem-links')].map(c => c.textContent).join()));
      sc.querySelector('[data-memlink="mB"]').click();
      ok('a link opens the page it names', curMem === 'mB' && /New Year/.test(sc.querySelector('.mem-title').textContent));
      const idbS = window.indexedDB; window.indexedDB = {};   // the media row needs storage; this suite has none
      _mediaReady = false;   // storage still opening: the slot must not say "Loading…" under every page
      sc.querySelector('[data-mem-edit]').click();
      _mediaReady = true;
      if (idbS === undefined) delete window.indexedDB; else window.indexedDB = idbS;
      ok('the recording slot under the page is empty until a recording starts there', sc.querySelector('.media-slot.rec-only') && sc.querySelector('.media-slot.rec-only').innerHTML === '');
      ok('Edit shows the properties and the block editor with photo, video, gallery and voice', !!sc.querySelector('[data-memprop="date"]') && !!sc.querySelector('#mem-blk-list')
        && [...sc.querySelectorAll('[data-madd]')].map(b => b.dataset.madd).join() === 'camera,video,gallery' && !!sc.querySelector('[data-mrec][data-mctx="doc:mB"]'));
      sc.querySelector('[data-addblk="p"]').click();
      ok('the shared block editor adds to THIS memory', memList().find(m => m.id === 'mB').blocks.some(b => b.t === 'p'));
      sc.querySelector('[data-memlinkbtn]').click();
      const lb = memList().find(m => m.id === 'mB').blocks.find(b => b.t === 'p'); lastBlk = lb.id;
      sc.querySelector('[data-memlinkadd="dW"]').click();
      ok('Link inserts [[Title]] into the block last touched', /\[\[Ideas\]\]/.test(memList().find(m => m.id === 'mB').blocks.find(b => b.id === lb.id).text));
      navigateTo('memories');
      sc.querySelector('[data-memf="person"][data-memv="Ravi"]').click();
      ok('a person chip filters the timeline', [...sc.querySelectorAll('[data-memopen]')].map(b => b.dataset.memopen).join() === 'mA');
      memFilter = null;
      ok('Memories is in the menu, not hidden, for an existing install too', (localStorage.setItem('dp.navcfg', JSON.stringify(NAV_DEF.filter(n => n.k !== 'memories'))), navCfg().some(n => n.k === 'memories' && !n.hidden)));
    } finally {
      window.toast = tSnap; _media.clear(); mSnap.forEach((v, k) => _media.set(k, v)); _mediaReady = rdySnap;
      curMem = null; memEdit = false; memFilter = null; memLinkOpen = false;
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      navigateTo('today');
    }
  })();

  // ---- Memories editor: the story first, photos as tiles, the toolbar within reach ----
  (function () {
    const dSnap = localStorage.getItem('dp.docs'), tSnap = window.toast; window.toast = () => {};
    const mSnap = new Map(_media), rdySnap = _mediaReady, lbSnap = lastBlk, ucSnap = URL.createObjectURL;
    URL.createObjectURL = () => 'blob:test';   // jsdom has none; a tile only needs a src
    try {
      // dropping a dragged block: a plain list is unchanged, a tile is passed by its middle
      const wide = { top: 100, bottom: 140, height: 40, left: 0, width: 300 }, tile = { top: 100, bottom: 170, height: 70, left: 80, width: 70 };
      ok('drag in a plain list: before a row when above its middle, wherever the finger is across', dragBefore(wide, 290, 110, 0) && !dragBefore(wide, 5, 130, 0));
      ok('drag among tiles: level with a tile, its horizontal middle decides', dragBefore(tile, 100, 120, 300) && !dragBefore(tile, 140, 120, 300));
      ok('…above its row it is before, below its row it is not', dragBefore(tile, 290, 90, 300) && !dragBefore(tile, 5, 200, 300));
      ok('…and a full-width text row among the tiles keeps the plain rule', dragBefore(wide, 290, 110, 300) && !dragBefore(wide, 5, 130, 300));
      // where the toolbar puts a new block
      const P = id => ({ id, t: 'p', text: '' }), I = id => ({ id, t: 'i', mid: id });
      lastBlk = null;
      ok('a new block on an imported page goes above its photos, not under them', memAddIndex({ blocks: [P('s'), I('g1'), I('g2')] }) === 1);
      ok('…at the top of a page that is only photos', memAddIndex({ blocks: [I('g1'), I('g2')] }) === 0 && memAddIndex({ blocks: [] }) === 0);
      ok('…at the end when the page ends in writing', memAddIndex({ blocks: [P('s'), I('g1'), P('t')] }) === 3);
      lastBlk = 's';
      ok('…and right after the block you were writing in', memAddIndex({ blocks: [P('s'), P('t'), I('g1')] }) === 1);
      lastBlk = 'elsewhere';
      ok('…a block on another page does not count', memAddIndex({ blocks: [P('s'), I('g1')] }) === 1);
      // the edit view
      _mediaReady = true;
      _media.set('tp1', { id: 'tp1', kind: 'photo', blob: new Blob(['x']), ctx: 'doc:mT', day: '2024-05-12' });
      _media.set('tv1', { id: 'tv1', kind: 'video', blob: new Blob(['x']), dur: 4000, ctx: 'doc:mT', day: '2024-05-12' });
      localStorage.setItem('dp.docs', JSON.stringify([{ id: 'mT', kind: 'memory', title: '', date: '2024-05-12', place: '', people: [], tags: [],
        blocks: [P('s1'), P('s2'), I('tp1'), { id: 'tv1', t: 'v', mid: 'tv1' }, { id: 'ta1', t: 'a', mid: 'gone' }], created: '2024-05-12', updated: '' }]));
      navigateTo('memories'); curMem = 'mT'; memEdit = true; renderMemories();
      const sc = document.getElementById('s-memories'), list = sc.querySelector('#mem-blk-list');
      const tiles = [...list.querySelectorAll('.mem-tile')];
      ok('in the editor, photos and videos are tiles, each still with its drag handle and delete',
        tiles.map(t => t.dataset.id).join() === 'tp1,tv1' && tiles.every(t => t.querySelector('[data-drag]') && t.querySelector('[data-blkdel="' + t.dataset.id + '"]')), tiles.map(t => t.dataset.id));
      ok('…a voice note keeps its full-width row', !!list.querySelector('.blk-row.blk-photo[data-id="ta1"]') && !list.querySelector('.mem-tile[data-id="ta1"]'));
      const tas = [...list.querySelectorAll('textarea[data-blk]')];
      ok('the first text block asks for the story; later ones keep the usual prompt', tas[0].placeholder === 'Tell the story…' && tas[1].placeholder !== 'Tell the story…', tas.map(t => t.placeholder));
      ok('the add-block toolbar is the sticky one', !!sc.querySelector('.blk-toolbar.mem-tools [data-addblk="p"]'));
      lastBlk = null;
      sc.querySelector('.mem-tools [data-addblk="b"]').click();
      ok('tapping Bullet with nothing chosen puts it above the photos the page ends with',
        memList().find(m => m.id === 'mT').blocks.map(b => b.t).join('') === 'ppbiva', memList().find(m => m.id === 'mT').blocks.map(b => b.t).join(''));
      lastBlk = 's1';
      sc.querySelector('.mem-tools [data-addblk="h"]').click();
      ok('…and a block added while writing goes right after that block', memList().find(m => m.id === 'mT').blocks.map(b => b.t).join('') === 'phpbiva');
      sc.querySelector('[data-mem-done]').click();
      ok('the read view is unchanged: the empty story says nothing, the photos stay a gallery', !sc.querySelector('.mem-tile') && !!sc.querySelector('.mem-gallery'));
    } finally {
      window.toast = tSnap; URL.createObjectURL = ucSnap; _mediaUrls.delete('tp1:t'); _mediaUrls.delete('tp1:f');
      _media.clear(); mSnap.forEach((v, k) => _media.set(k, v)); _mediaReady = rdySnap; lastBlk = lbSnap;
      curMem = null; memEdit = false;
      if (dSnap != null) localStorage.setItem('dp.docs', dSnap); else localStorage.removeItem('dp.docs');
      navigateTo('today');
    }
  })();

  // ---- v255: UX pass — undo, habits screen, ring, search, reminders, links, empty pages ----
  (function () {
    const keys = ['dp.tasks', 'dp.plans', 'dp.notes', 'dp.docs', 'dp.entries', 'dp.reminders', 'dp.listAt', 'dp.listDel', 'dp.timebox', 'dp.navcfg', 'dp.navmig255', 'dp.logsec', 'dp.fbDraft'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const tSnap = window.toast; window.toast = () => {};
    const undo = () => document.querySelector('#toast .toast-undo');
    try {
      // restoreItems keeps other edits and puts the removed ones back in place
      const before = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }];
      const r = restoreItems([{ id: 'a', v: 2 }, { id: 'c', v: 1 }, { id: 'd', v: 1 }], before, new Set(['b']));
      ok('restoreItems: the deleted item returns where it was, later edits and additions are kept',
        r.map(x => x.id + x.v).join() === 'a2,b1,c1,d1', JSON.stringify(r));

      // a task delete can be undone, and the restored task wins over its delete record
      DB.saveTasks([{ id: 't1', text: 'one', done: false }, { id: 't2', text: 'two', done: true }]);
      navigateTo('tasks');
      document.querySelector('[data-del="t1"]').click();
      ok('deleting a task offers Undo', DB.tasks().length === 1 && !!undo());
      undo().click();
      ok('Undo brings the task back', DB.tasks().map(t => t.id).join() === 't1,t2');
      ok('…stamped newer than its delete, so sync keeps it', !((listMeta('dp.listDel').tasks || {}).t1) && (listMeta('dp.listAt').tasks || {}).t1 > 0);
      document.getElementById('clear-done').click();
      ok('Clear completed offers Undo too', DB.tasks().length === 1 && /Cleared 1 done task/.test(document.getElementById('toast').textContent));
      undo().click();
      ok('…and puts the done task back', DB.tasks().length === 2);
      tSnap('plain');
      ok('a plain toast drops the Undo button', !undo());

      // plan steps
      DB.savePlans([{ id: 'p1', name: 'Trip', items: [{ id: 'i1', text: 'tickets', done: false }, { id: 'i2', text: 'bags', done: true }] }]);
      navigateTo('plans'); curPlan = 'p1'; renderPlans();
      document.querySelector('[data-planitem-del="i1"]').click();
      undo().click();
      ok('a deleted plan step comes back with Undo', DB.plans()[0].items.map(i => i.id).join() === 'i1,i2');

      // Habits screen: tick today without going to the Log
      const h = HABITS.find(x => !goalFor(x.key)), T = todayStr();
      localStorage.setItem('dp.entries', '{}');
      navigateTo('habits');
      const hb = () => document.querySelector(`#s-habits [data-hab-today="${h.key}"]`);
      ok('every habit card has a "Mark done" button for today', !!hb() && /Mark done/.test(hb().textContent));
      hb().click();
      ok('tapping it ticks the habit for today', hVal(DB.entry(T), h.key) === H_DONE && hb().classList.contains('on'));
      ok('…and the Log draft for today has it too, before the Log is even opened', logDate === T && hVal(draft, h.key) === H_DONE);
      navigateTo('today');
      ok('…and the Log shows it ticked', hVal(draft, h.key) === H_DONE);
      navigateTo('habits'); hb().click();
      ok('tapping again unticks, not skips', !(h.key in (DB.entry(T).habits || {})));
      undo().click();
      ok('"Skip today" on the toast marks it skipped', hVal(DB.entry(T), h.key) === H_SKIP);
      ok('the heatmap is one column per week with today outlined', !!document.querySelector('#s-habits .heat-wk .cell.today'));

      // the ring: zeros are not "logged", the mood grid counts
      const zero = todayCompletion({ tasksDone: 0, tasksPlanned: 0, habits: {} });
      ok('a fresh day with only the default zeros is 0% logged', zero.done === 0, JSON.stringify(zero));
      if (!logSecHidden('moodgrid')) ok('a mood-grid tap moves the ring', todayCompletion({ mood: 7, energy: 6, habits: {} }).done === 1);

      // search: every word, anywhere
      localStorage.setItem('dp.entries', JSON.stringify({ [T]: { journal: 'Argued with the landlord about the deposit today', habits: {} } }));
      const sr = runSearch('landlord deposit');
      ok('search matches every word, not the exact phrase', /1 result/.test(sr) && /<b>landlord<\/b>/.test(sr) && /<b>deposit<\/b>/.test(sr));
      ok('a word that is not there finds nothing', /Nothing found/.test(runSearch('landlord cat')));
      const stx = 'x'.repeat(20) + ' alphabetic betamax gammaray deltawing epsilon zeta eta theta landlord';
      const first = snippet(stx, 'landlord').replace(/^…/, '').split(' ')[0];
      ok('a snippet starts on a whole word', stx.split(' ').includes(first), first);

      // reminders: one added after its time today does not ring until tomorrow
      const now = new Date(), past = new Date(now.getTime() - 3600000);
      if (past.getDate() === now.getDate()) {
        const hhmm = String(past.getHours()).padStart(2, '0') + ':' + String(past.getMinutes()).padStart(2, '0');
        const ns = nativeShell; window.nativeShell = () => false;
        const fa = window.fireAlarm; let rang = 0; window.fireAlarm = () => { rang++; };
        DB.saveReminders([{ id: 'rz', label: 'Log', time: hhmm, enabled: true, mode: 'alarm' }]);
        localStorage.removeItem('dp.notified.rz.' + todayStr());
        checkReminders(true);
        ok('a reminder added after its time today does not ring at once', rang === 0 && !!localStorage.getItem('dp.notified.rz.' + todayStr()));
        const at = listMeta('dp.listAt'); at.reminders.rz = past.getTime() - 60000; safeSet('dp.listAt', JSON.stringify(at));
        localStorage.removeItem('dp.notified.rz.' + todayStr());
        checkReminders(true);
        ok('…but one set earlier and missed still rings on reopen', rang === 1);
        window.nativeShell = ns; window.fireAlarm = fa;
        localStorage.removeItem('dp.notified.rz.' + todayStr());
      }

      // links follow a rename; an empty new page is not kept
      DB.saveDocs([{ id: 'dA', kind: 'memory', title: 'Goa', date: T, blocks: [{ id: 'b1', t: 'p', text: '' }] },
        { id: 'dB', kind: 'memory', title: 'Plans', date: T, blocks: [{ id: 'b2', t: 'p', text: 'see [[goa]] and [[Elsewhere]]' }] }]);
      ok('renaming a page rewrites the links to it', docRenameLinks('dA', 'Goa', 'Goa trip') === 1 && DB.docs().find(d => d.id === 'dB').blocks[0].text === 'see [[Goa trip]] and [[Elsewhere]]');
      DB.saveDocs(DB.docs().concat([{ id: 'dC', kind: 'memory', title: 'Goa trip', date: T, blocks: [] }]));
      ok('…but not when another page still has the old title', docRenameLinks('dA', 'Goa trip', 'Beach') === 0);
      DB.saveDocs(DB.docs().concat([{ id: 'dE', kind: 'memory', title: '', date: T, people: [], tags: [], blocks: [{ id: 'b9', t: 'p', text: '  ' }] }]));
      ok('a page with nothing in it is discarded', docDiscardIfEmpty('dE') && !DB.docs().some(d => d.id === 'dE'));
      ok('a page with words is kept', !docDiscardIfEmpty('dB') && DB.docs().some(d => d.id === 'dB'));
      navigateTo('memories');
      document.querySelector('[data-mem-new]').click();
      const n0 = memList().length;
      document.querySelector('[data-mem-done]') && document.querySelector('[data-mem-done]').click();
      ok('New then Done with nothing written leaves no blank memory behind', memList().length === n0 - 1);

      // History and Search: visible for an existing install once, Cal is called Calendar
      localStorage.setItem('dp.navcfg', JSON.stringify(NAV_DEF.map(n => Object.assign({}, n, n.k === 'history' || n.k === 'search' || n.k === 'cal' ? { hidden: true, label: n.k === 'cal' ? 'Cal' : n.label } : {}))));
      localStorage.removeItem('dp.navmig255');
      let nc = navCfg();
      ok('an existing install gets History and Search back once', !nc.find(n => n.k === 'history').hidden && !nc.find(n => n.k === 'search').hidden);
      ok('"Cal" is renamed Calendar, and a hidden screen stays hidden', nc.find(n => n.k === 'cal').label === 'Calendar' && nc.find(n => n.k === 'cal').hidden);
      nc.find(n => n.k === 'history').hidden = true; localStorage.setItem('dp.navcfg', JSON.stringify(nc));
      ok('…and only once: hiding History again sticks', navCfg().find(n => n.k === 'history').hidden);

      // timebox default start is the next half hour
      ok('the timebox form starts at the next half hour', /^\d\d:(00|30)$/.test(tbNext(0)) || tbNext(0) === '23:59');
    } finally {
      window.toast = tSnap;
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      curPlan = null; curMem = null; memEdit = false;
      navigateTo('today');
    }
  })();

  // ---- v256: UI styles — each a whole look, chosen by the person ----
  (function () {
    const stSnap = localStorage.getItem('dp.settings');
    const tSnap = window.toast; window.toast = () => {};
    try {
      const root = document.documentElement;
      ok('eight styles, Midnight first (the look nobody chose stays the default)', UI_STYLES.length === 8 && UI_STYLES[0].id === 'midnight' && uiStyle().id === (DB.settings().style || 'midnight'));
      setUiStyle('paper');
      ok('choosing a style saves it and sets <html data-style>', DB.settings().style === 'paper' && root.dataset.style === 'paper');
      ok('…and drops Midnight\'s accent so the style\'s own palette shows', !root.style.getPropertyValue('--accent'));
      const s = DB.settings(); s.mode = 'light'; DB.saveSettings(s);
      setUiStyle('luxe');
      ok('Luxe is always dark, even with Light chosen', root.dataset.mode !== 'light');
      setUiStyle('bloom');
      { const s2 = DB.settings(); s2.mode = 'black'; DB.saveSettings(s2); } applyTheme();
      ok('Bloom is always light, even with Black chosen', root.dataset.mode === 'light');
      // v268: Clay is always light, Dot always dark, Glass follows the Light / Dark choice
      setUiStyle('clay');
      ok('Clay is always light, even with Black chosen', root.dataset.style === 'clay' && root.dataset.mode === 'light');
      setUiStyle('dot');
      { const s3 = DB.settings(); s3.mode = 'light'; DB.saveSettings(s3); } applyTheme();
      ok('Dot is always dark, even with Light chosen', root.dataset.style === 'dot' && root.dataset.mode !== 'light');
      setUiStyle('glass');
      ok('Glass follows Light', root.dataset.mode === 'light');
      { const s4 = DB.settings(); s4.mode = 'black'; DB.saveSettings(s4); } applyTheme();
      ok('…and Black', root.dataset.style === 'glass' && root.dataset.mode === 'black');
      ok('the new styles keep their own palette (no Midnight accent)', !root.style.getPropertyValue('--accent'));
      ok('no brand names in the style list', !UI_STYLES.some(x => /claude|anthropic|nothing|apple|iphone|ios\b/i.test(x.name + ' ' + x.tag)));
      setUiStyle('bloom');
      setUiStyle('nope');
      ok('an unknown style is ignored', DB.settings().style === 'bloom');
      setUiStyle('midnight');
      ok('back on Midnight the accent colour returns', !!root.style.getPropertyValue('--accent') && root.dataset.mode === 'black');
      const tmp = document.createElement('div'); tmp.innerHTML = stylePickerHTML();
      ok('the picker shows every style with a live preview, the current one marked', tmp.querySelectorAll('[data-uistyle]').length === 8 && tmp.querySelector('.style-tile.on').dataset.uistyle === 'midnight' && tmp.querySelectorAll('.st-prev').length === 8);
      navigateTo('settings');
      ok('Settings opens with "Style & appearance"', !!document.getElementById('open-style') && /Midnight/.test(document.getElementById('open-style').textContent));
      document.getElementById('open-style').click();
      ok('…which opens the style picker, with Back to Settings', !!document.querySelector('#s-custom .style-grid') && /Settings/.test(document.getElementById('custom-back').textContent));
      document.querySelector('#s-custom [data-uistyle="aurora"]').click();
      ok('tapping a tile switches the whole app at once', root.dataset.style === 'aurora' && document.querySelector('#s-custom .style-tile.on').dataset.uistyle === 'aurora');
      document.getElementById('custom-back').click();
      ok('Back returns to Settings', document.getElementById('s-settings').classList.contains('on'));
    } finally {
      window.toast = tSnap;
      if (stSnap != null) localStorage.setItem('dp.settings', stSnap); else localStorage.removeItem('dp.settings');
      applyTheme(); navigateTo('today');
    }
  })();

  /* ---- editing item text in place, and the timebox's Today / Tomorrow (real-user audit) ---- */
  (function () {
    const keys = ['dp.tasks', 'dp.plans', 'dp.projects', 'dp.timebox', 'dp.listAt', 'dp.listDel', 'dp.settings'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    const field = host => host && host.querySelector('.inline-edit');
    // tap the text, type, then finish the way a person would: Enter, Escape or tapping away
    const edit = (sel, val, how) => {
      const host = document.querySelector(sel); if (!host) { ok('the page has ' + sel, false); return null; }
      host.click(); const f = field(host); if (!f) { ok('tapping ' + sel + ' opens a field', false); return null; }
      f.value = val;
      if (how === 'blur') f.blur(); else key(f, how || 'Enter');
      return host;
    };
    const stamp = (list, id) => (listMeta('dp.listAt')[list] || {})[id] || 0;
    // each part reports its own failure, so a missing feature fails its assertions, not the whole suite
    const part = (name, fn) => { try { fn(); } catch (e) { ok(name + ' (threw)', false, String(e && e.message || e)); } };
    const T = todayStr(), TM = addDays(T, 1), Y = addDays(T, -1);
    const tb = () => DB.timebox(), on = d => tb().filter(b => b.date === d), sf = () => document.getElementById('s-focus');
    try {
      const st = DB.settings(); delete st.syncUrl; DB.saveSettings(st);   // no Sheet: nothing leaves the test
      part('editing a task', () => {
        localStorage.setItem('dp.listAt', '{}'); localStorage.setItem('dp.listDel', '{}');
        DB.saveTasks([{ id: 'e1', text: 'buy mlik', done: false, created: todayStr() }, { id: 'e2', text: 'pay rnet', done: true, doneDate: todayStr(), created: todayStr() }]);
        localStorage.setItem('dp.listAt', JSON.stringify({ tasks: { e1: 5, e2: 5 } }));
        navigateTo('tasks');
        const tx = id => DB.tasks().find(t => t.id === id).text;
        const row1 = document.querySelector('#s-tasks [data-id="e1"]');
        document.querySelector('[data-task-edit="e1"]').click();
        const f1 = field(document.querySelector('[data-task-edit="e1"]'));
        ok('tapping a task\'s text opens a field holding that text', !!f1 && f1.value === 'buy mlik' && document.activeElement === f1, f1 && f1.value);
        f1.value = 'buy milk'; key(f1, 'Enter');
        ok('Enter saves the corrected text', tx('e1') === 'buy milk', tx('e1'));
        ok('…the row shows it, with the field gone', !field(row1) && /buy milk/.test(row1.textContent));
        ok('…in place: the row is not re-rendered, so a tap on its ✓ or × right after still lands', document.querySelector('#s-tasks [data-id="e1"]') === row1);
        ok('…and the edit is stamped, so it syncs item by item', stamp('tasks', 'e1') > 5 && stamp('tasks', 'e2') === 5, listMeta('dp.listAt').tasks);
        edit('[data-task-edit="e1"]', 'something else', 'Escape');
        ok('Escape puts the old text back and saves nothing', tx('e1') === 'buy milk' && /buy milk/.test(row1.textContent) && !field(row1));
        edit('[data-task-edit="e1"]', '   ', 'Enter');
        ok('an emptied field keeps the old text (the task is not deleted)', DB.tasks().length === 2 && tx('e1') === 'buy milk');
        edit('[data-task-edit="e1"]', '  buy oat\n milk ', 'blur');
        ok('tapping away saves too, trimmed, a pasted line break made a space', tx('e1') === 'buy oat milk', tx('e1'));
        const hd = document.querySelector('[data-task-edit="e1"]'); hd.click(); field(hd).value = 'buy milk';
        const hnd = document.querySelector('#s-tasks [data-id="e1"] [data-drag]');
        hnd.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        ok('pressing a drag handle saves the open edit first (a handle keeps focus, so no blur would come)', tx('e1') === 'buy milk' && !field(hd), tx('e1'));
        hnd.dispatchEvent(new Event('pointerup', { bubbles: true }));   // let the drag it started finish
        edit('[data-task-edit="e2"]', 'pay rent', 'Enter');
        const r2 = document.querySelector('#s-tasks [data-id="e2"]');
        ok('a done task can be corrected and stays done (still struck through)', tx('e2') === 'pay rent' && DB.tasks().find(t => t.id === 'e2').done && r2.classList.contains('done'));
        ok('the drag handle, ✓, colour and × are still separate from the text', !!document.querySelector('[data-id="e1"] [data-drag]') && !!document.querySelector('[data-toggle="e1"]') && !!document.querySelector('[data-palette="e1"]') && !!document.querySelector('[data-del="e1"]') && !document.querySelector('[data-task-edit="e1"] [data-toggle],[data-task-edit="e1"] [data-del]'));

      });
      part('editing a plan step', () => {
        localStorage.setItem('dp.plans', JSON.stringify([{ id: 'pE', name: 'Trip', color: '', created: todayStr(), items: [{ id: 's1', text: 'tickts', done: false }, { id: 's2', text: 'bags', done: true }] }]));
        localStorage.setItem('dp.listAt', JSON.stringify({ plans: { pE: 5 }, planFields: { pE: 5 }, planItems: { pE: { s1: 5, s2: 5 } } }));
        navigateTo('plans'); curPlan = 'pE'; renderPlans();
        edit('[data-planitem-edit="s1"]', 'tickets', 'Enter');
        const its = () => DB.plans()[0].items;
        ok('a plan step\'s text can be corrected in place', its()[0].text === 'tickets' && its().length === 2, its());
        const A = listMeta('dp.listAt');
        ok('…stamping that step only, not the plan\'s name or the other step', A.planItems.pE.s1 > 5 && A.planItems.pE.s2 === 5 && A.planFields.pE === 5, A);
        edit('[data-planitem-edit="s2"]', '', 'Enter');
        ok('…an emptied plan step keeps its text', its()[1].text === 'bags' && its()[1].done);
        ok('the plan title is still its own field', !!document.querySelector('[data-planname="pE"]'));

      });
      part('editing a project step', () => {
        DB.saveProjects([pjNorm({ id: 'pjE', name: 'Launch', steps: [{ id: 'st1', text: 'wirte copy', done: false, due: '' }],
          miles: [{ id: 'm1', text: 'Beta', done: true, due: '2026-12-01' }] })]);
        navigateTo('projects'); pjOpen = 'pjE'; renderProjects();
        edit('[data-pj-edit="steps:st1"]', 'write copy', 'Enter');
        ok('a project step\'s text can be corrected in place', pjById('pjE').steps[0].text === 'write copy', pjById('pjE').steps);
        edit('[data-pj-edit="miles:m1"]', 'Beta with 10 testers', 'Enter');
        const m1 = pjById('pjE').miles[0];
        ok('…and a milestone\'s, keeping its date and its tick', m1.text === 'Beta with 10 testers' && m1.due === '2026-12-01' && m1.done, m1);
        ok('…with the date still shown beside the new text', /Beta with 10 testers.*Dec/.test(document.querySelector('[data-pj-edit="miles:m1"]').textContent));
        edit('[data-pj-edit="steps:st1"]', 'x'.repeat(300), 'Enter');
        ok('…capped at 140 characters, as when it was added', pjById('pjE').steps[0].text.length === 140);
        pjOpen = null;

      });
      part('timebox Today / Tomorrow', () => {
        localStorage.setItem('dp.listAt', '{}');
        DB.saveTimebox([
          { id: 'y1', date: Y, start: '09:00', end: '10:00', label: 'Gym', act: '', alarm: true },
          { id: 'y2', date: Y, start: '10:00', end: '11:00', label: 'Email', act: '', alarm: false },
          { id: 'd1', date: T, start: '09:00', end: '10:00', label: 'gym ', act: 'work', alarm: true },
        ]);
        const c = tbCopyBlocks(tb(), Y, T);
        ok('copying yesterday skips a block today already has (same start, end and name)', c.length === 1 && c[0].label === 'Email' && c[0].date === T && c[0].id !== 'y2', c);
        ok('…and copies the rest with new ids', new Set(tbCopyBlocks(tb(), Y, TM).map(b => b.id)).size === 2 && tbCopyBlocks(tb(), Y, TM).every(b => !tb().some(x => x.id === b.id)));
        focusMode = 'timebox'; tbDay = 0; tbEdit = null; show('focus');
        ok('the timebox opens on Today, with a Tomorrow switch', /Today's plan/.test(sf().textContent) && !!sf().querySelector('[data-tb-day="1"]') && sf().querySelector('[data-tb-day="0"]').classList.contains('on'));
        ok('Today offers "Copy yesterday\'s plan", counting only what is missing', /Copy yesterday's plan · 1 block/.test((document.getElementById('tb-copy') || {}).textContent || ''));
        document.getElementById('tb-copy').click();
        ok('…which copies it onto today', on(T).length === 2 && on(T).some(b => b.label === 'Email') && on(Y).length === 2);
        ok('…and then has nothing left to copy, so the button goes', !document.getElementById('tb-copy'));
        const undoB = document.querySelector('#toast .toast-undo'); if (undoB) undoB.click();
        ok('Undo takes the copied blocks back off', on(T).length === 1 && on(T)[0].id === 'd1');
        sf().querySelector('[data-tb-day="1"]').click();
        ok('Tomorrow shows tomorrow\'s plan and date', /Tomorrow's plan/.test(sf().textContent) && sf().textContent.includes(prettyDate(TM)) && !sf().querySelector('[data-id="d1"]'));
        ok('…its form starts at 09:00, not at the next half hour of tonight', document.getElementById('tb-start').value === '09:00');
        document.getElementById('tb-label').value = 'Plan the week'; document.getElementById('tb-start').value = '00:00'; document.getElementById('tb-end').value = '23:59';   // covers now, whenever this runs
        document.getElementById('tb-act').value = 'work';
        document.getElementById('tb-add').click();
        const nb = on(TM)[0] || {};
        ok('a block added on Tomorrow is planned for tomorrow', on(TM).length === 1 && nb.label === 'Plan the week' && nb.start === '00:00', on(TM));
        const nrow = sf().querySelector(`[data-id="${nb.id}"]`);
        ok('…shown there, never as "now" and with no ▶ (that would start the timer today)', !!nrow && !nrow.classList.contains('live') && !nrow.querySelector('[data-tb-start]'));
        ok('Tomorrow offers "Copy today\'s plan"', /Copy today's plan · 1 block/.test((document.getElementById('tb-copy') || {}).textContent || ''));
        document.getElementById('tb-copy').click();
        ok('…which copies today\'s blocks onto tomorrow, with new ids', on(TM).length === 2 && on(TM).some(b => b.label === 'gym ' && b.id !== 'd1') && on(T).length === 1);
        sf().querySelector('[data-tb-day="0"]').click();
        ok('Today still shows only today\'s blocks', on(T).length === 1 && !!sf().querySelector('[data-id="d1"]') && !sf().querySelector(`[data-id="${nb.id}"]`));

      });
      part('editing a timebox block', () => {
        const d1 = () => tb().find(b => b.id === 'd1');
        const listAt1 = stamp('timebox', 'd1');
        sf().querySelector('.tb-main[data-tb-edit="d1"]').click();
        ok('tapping a block opens it as a form with its start, end and name', document.getElementById('tb-e-start').value === '09:00' && document.getElementById('tb-e-end').value === '10:00' && document.getElementById('tb-e-label').value === 'gym ');
        document.getElementById('tb-e-start').value = '07:30'; document.getElementById('tb-e-end').value = '08:15'; document.getElementById('tb-e-label').value = 'Run';
        sf().querySelector('[data-tb-save="d1"]').click();
        ok('Save changes the block in place (same id, same day, its activity and alarm kept)', d1().start === '07:30' && d1().end === '08:15' && d1().label === 'Run' && d1().date === T && d1().act === 'work' && d1().alarm === true, d1());
        ok('…closes the form', !document.getElementById('tb-e-start') && /Run/.test(sf().querySelector('[data-id="d1"]').textContent));
        ok('…and stamps the block so the edit syncs', stamp('timebox', 'd1') >= listAt1 && stamp('timebox', 'd1') > 0);
        sf().querySelector('.tb-time[data-tb-edit="d1"]').click();
        document.getElementById('tb-e-label').value = '  ';
        sf().querySelector('[data-tb-save="d1"]').click();
        ok('an emptied name keeps the old one', d1().label === 'Run');
        sf().querySelector('.tb-main[data-tb-edit="d1"]').click();
        document.getElementById('tb-e-label').value = 'nope'; key(document.getElementById('tb-e-label'), 'Escape');
        ok('Escape closes the form without saving', d1().label === 'Run' && !document.getElementById('tb-e-label'));
        sf().querySelector('.tb-main[data-tb-edit="d1"]').click();
        document.getElementById('tb-e-label').value = 'Long run'; key(document.getElementById('tb-e-label'), 'Enter');
        ok('Enter in the form saves', d1().label === 'Long run' && !document.getElementById('tb-e-label'));
      });
    } finally {
      focusMode = 'pomo'; tbDay = 0; tbEdit = null; curPlan = null; pjOpen = null;
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      navigateTo('today');
    }
  })();

  // ---- v257: Back in a browser / installed web app (history guards + popstate) ----
  // The history calls are stubbed so this block never moves the real session history; the async
  // suite walks the real one with history.back().
  (function () {
    const H = history, goS = H.go, pushS = H.pushState, replS = H.replaceState, capSnap = window.Capacitor, tSnap = window.toast;
    const ob = document.getElementById('onboard'), obWas = ob.classList.contains('on');
    const on = id => document.getElementById('s-' + id).classList.contains('on');
    const exitOn = () => !!document.querySelector('#confirm-exit.on');
    const pop = n => window.dispatchEvent(new PopStateEvent('popstate', { state: n === null ? null : { dlBack: n } }));
    let vars = null, gos = [], pushed = [], replaced = [], toasts = [];
    try {
      vars = [_hbAt, _hbTop, _hbLeaving];
      ok('the web build keeps Back guards in history (no Capacitor here)', _hbOn === true && typeof (H.state || {}).dlBack === 'number', H.state);
      H.go = d => gos.push(d); H.pushState = s => pushed.push(s); H.replaceState = s => replaced.push(s);
      window.toast = m => toasts.push(m);
      ob.classList.remove('on'); _hbLeaving = false;
      saveSheetClose(); shareSheetClose();   // an earlier block leaves the save sheet open, and Back would close that first

      navigateTo('settings'); settingsPage = 'data'; renderSettings();
      _hbAt = 4; _hbTop = 6; pop(3);
      ok('a popstate onto the guard below is Back: Settings page → Settings', on('settings') && settingsPage === null && _hbAt === 3);
      pop(2);
      ok('…and the next one goes to the home tab', on(defaultTab()) && _hbAt === 2);
      openDrawer(); pop(3);
      ok('a popstate onto a HIGHER guard is Forward and undoes nothing', document.getElementById('drawer').classList.contains('on') && _hbAt === 3);
      closeDrawer();
      _hbAt = 1; pushed = []; pop(0);
      ok('spending the last guard asks before exiting…', exitOn());
      ok('…and re-arms a full stack of guards', pushed.length === HB_DEPTH && pushed.every((s, i) => s.dlBack === i + 1) && _hbAt === HB_DEPTH && _hbTop === HB_DEPTH, pushed);
      pushed = [];
      pop(null);
      ok('an entry we did not make (a # link) is adopted as the next guard', _hbAt === HB_DEPTH + 1 && _hbTop === HB_DEPTH + 1 && replaced.length && replaced[replaced.length - 1].dlBack === HB_DEPTH + 1 && exitOn(), replaced);

      // Exit, when a page came before Daylog: back past all of our entries to it
      _hbAt = _hbTop = HB_DEPTH;
      Object.defineProperty(H, 'length', { value: HB_DEPTH + 4, configurable: true });
      document.querySelector('#confirm-exit [data-exit-yes]').click();
      ok('Exit goes back past every Daylog entry to the page before it', gos.length === 1 && gos[0] === -(HB_DEPTH + 1) && !exitOn() && _hbLeaving, gos);
      openDrawer(); pop(HB_DEPTH - 1);
      ok('…and the Back that follows is them leaving, not a step back', document.getElementById('drawer').classList.contains('on'));
      closeDrawer();
      // Exit, when Daylog is the first page (a home-screen launch): nothing to go back to
      gos = []; _hbLeaving = false; _hbAt = _hbTop = HB_DEPTH;
      Object.defineProperty(H, 'length', { value: HB_DEPTH + 1, configurable: true });
      showExitConfirm(); document.querySelector('#confirm-exit [data-exit-yes]').click();
      ok('with nothing before Daylog, Exit drops to its own entry', gos.length === 1 && gos[0] === -HB_DEPTH && _hbLeaving, gos);
      ok('…and says one more Back closes it', /once more/.test(toasts.join('|')), toasts);
      gos = []; _hbAt = 0; document.body.click();
      ok('a tap instead of Back means they stayed: guards back on', !_hbLeaving && _hbAt === HB_DEPTH && pushed.length === HB_DEPTH, [_hbLeaving, _hbAt, pushed.length]);

      // the welcome screens: no guards, and a Back there leaves rather than vanishing
      ob.classList.add('on'); pushed = []; _hbAt = 0; hbTopUp();
      ok('no guards are pushed while the welcome screens show', pushed.length === 0 && _hbAt === 0);
      _hbAt = 3; _hbTop = HB_DEPTH; _hbLeaving = false; gos = [];
      Object.defineProperty(H, 'length', { value: HB_DEPTH + 3, configurable: true });
      pop(2);
      ok('Back during onboarding (old guards from before a reload) leaves Daylog at once', gos.length === 1 && gos[0] === -3 && _hbLeaving, gos);
      ob.classList.remove('on'); _hbLeaving = false;

      // a reload must not stack more guards; a first load marks its entry and pushes them
      pushed = []; replaced = [];
      Object.defineProperty(H, 'state', { value: { dlBack: HB_DEPTH }, configurable: true });
      hbSync();
      ok('a reload on a guard entry reuses the guards (no growing pile)', pushed.length === 0 && replaced.length === 0 && _hbAt === HB_DEPTH);
      Object.defineProperty(H, 'state', { value: { dlBack: 2 }, configurable: true });
      hbSync();
      ok('…and one lower in the stack tops up only what is missing', pushed.length === HB_DEPTH - 2 && pushed[0].dlBack === 3 && replaced.length === 0, pushed);
      pushed = [];
      Object.defineProperty(H, 'state', { value: null, configurable: true });
      hbSync();
      ok('a first load marks its own entry 0 and pushes the guards above it', replaced.length === 1 && replaced[0].dlBack === 0 && pushed.length === HB_DEPTH, [replaced, pushed.length]);
      delete H.state;

      // the Play app: Capacitor owns Back, Exit really exits, and history is never touched
      let exited = 0; gos = [];
      window.Capacitor = { Plugins: { App: { exitApp: () => { exited++; } } } };
      showExitConfirm(); document.querySelector('#confirm-exit [data-exit-yes]').click();
      ok('in the Play app Exit calls exitApp and leaves history alone', exited === 1 && gos.length === 0);
      _hbOn = false; hbInit();
      ok('…and the web guard is never installed there', _hbOn === false);
      _hbOn = true;
    } catch (e) {
      ok('the Back-guard block ran', false, String(e && e.message || e));
    } finally {
      H.go = goS; H.pushState = pushS; H.replaceState = replS; window.toast = tSnap;
      delete H.length; delete H.state;
      if (capSnap === undefined) delete window.Capacitor; else window.Capacitor = capSnap;
      if (vars) { _hbAt = vars[0]; _hbTop = vars[1]; _hbLeaving = vars[2]; }
      const ce = document.getElementById('confirm-exit'); if (ce) ce.classList.remove('on');
      if (obWas) ob.classList.add('on'); else ob.classList.remove('on');
      closeDrawer(); navigateTo('today');
    }
  })();

  // ---- v258: Log glance card, Deep log switch ----
  (function () {
    const keys = ['dp.logsec', 'dp.entries'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const tSnap = window.toast; window.toast = () => {};
    try {
      navigateTo('today');
      const sc = document.getElementById('s-today');
      // round 2: the date pill and the figures live in the Log hero, not a card of their own
      ok('the Log shows the date as a pill, not a full-width field', !!sc.querySelector('.lhero .gl-date #log-date'));
      ok('sleep and deep work are big figures, pickers closed', sc.querySelectorAll('.lhero .gl-tile').length >= 1 && !sc.querySelector('.lhero [data-bed]') && !sc.querySelector('.lhero [data-dur-h]') && !sc.querySelector('.gl-edit'));
      const t = sc.querySelector('[data-gl]'); const k = t.dataset.gl; t.click();
      ok('tapping a figure opens its pickers', !!document.querySelector(`#s-today .gl-edit`) && document.querySelector(`#s-today [data-gl="${k}"]`).classList.contains('on'));
      ok('…in a card right under the hero', (document.querySelector('#s-today .lhero') || {}).nextElementSibling === document.querySelector('#s-today .gl-edit'));
      document.querySelector(`#s-today [data-gl="${k}"]`).click();
      ok('tapping again closes them', !document.querySelector('#s-today .gl-edit'));
      setLogSecHidden('deep', true);
      customPage = 'deep'; show('custom');
      const sw = document.querySelector('[data-deep-show]');
      ok('Customize ▸ Deep log has a show-on-Log switch, off when hidden', !!sw && !sw.classList.contains('on'));
      sw.click();
      ok('turning it on shows the Deep log on the Log screen', !logSecHidden('deep'));
    } finally {
      window.toast = tSnap; _glanceOpen = null; customPage = null;
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      navigateTo('today');
    }
  })();

  // ---- Log hero round 2: one hero panel, the past-day chip, the On-this-day strip, the slim Tasks row ----
  (function () {
    const keys = ['dp.logsec', 'dp.entries', 'dp.tasks'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const tSnap = window.toast; window.toast = () => {};
    const ldSnap = logDate;
    try {
      const T = todayStr();
      localStorage.removeItem('dp.logsec');
      logDate = T; navigateTo('today');
      const sc = () => document.getElementById('s-today');
      const hero = () => sc().querySelector('.lhero');
      ok('the Log opens with one hero panel', !!hero() && sc().firstElementChild === hero());
      ok('…holding the ring, the day chip and the numbers', !!hero().querySelector('.ring-card svg.ring') && !!hero().querySelector('.lh-chip #log-date') && hero().querySelectorAll('.gl-tile[data-gl]').length >= 1);
      ok('…the chip says Today', hero().querySelector('.lh-chip-t').textContent.trim() === 'Today');
      ok('the ring is no longer a card of its own', !sc().querySelector('.card.ring-card') && sc().querySelectorAll('.ring-card').length === 1);

      // ring hidden: the hero stays first, with no ring and no week line; chip and numbers stay
      setLogSecHidden('ring', true); renderToday();
      ok('ring hidden: the hero is still first, with no ring', !!hero() && sc().firstElementChild === hero() && !sc().querySelector('.ring-card') && hero().classList.contains('no-ring'));
      ok('…the day chip and the numbers are still there', !!hero().querySelector('#log-date') && hero().querySelectorAll('.gl-tile[data-gl]').length >= 1);
      ok('…and the week line goes with the ring', !hero().querySelector('.ring-week'));
      setLogSecHidden('ring', false);
      // the ring moved to the bottom of the order: still shown once, in the hero
      const cfg = logSecCfg(); cfg.push(cfg.splice(cfg.findIndex(x => x.id === 'ring'), 1)[0]); saveLogSec(cfg); renderToday();
      ok('a reordered ring still shows once, in the hero', sc().querySelectorAll('.ring-card').length === 1 && !!hero().querySelector('.ring-card'));
      localStorage.removeItem('dp.logsec');

      // a past day: the chip shows that day, the greeting says so, one tap goes back
      const y = addDays(T, -1), d3 = addDays(T, -3);
      const pick = d => { const ld = document.getElementById('log-date'); ld.value = d; ld.dispatchEvent(new Event('change', { bubbles: true })); };
      pick(y);
      ok('a past day: the chip shows that day', logDate === y && hero().querySelector('.lh-chip-t').textContent.trim() === prettyDate(y));
      ok('…and the greeting says you are editing it', hero().querySelector('.lh-greet').textContent.trim() === 'Editing yesterday' && hero().classList.contains('lh-past'), hero().querySelector('.lh-greet').textContent);
      pick(d3);
      const wd = new Date(d3 + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' });
      ok('…three days back it names the weekday', hero().querySelector('.lh-greet').textContent.trim() === 'Editing ' + wd && /3 days ago/.test(hero().querySelector('.lh-date').textContent), hero().querySelector('.lh-greet').textContent);
      ok('…and the date input points at that day', document.getElementById('log-date').value === d3);
      sc().querySelector('[data-lh-today]').click();
      ok('"Back to today" returns to today', logDate === T && !hero().classList.contains('lh-past') && !/Editing/.test(hero().querySelector('.lh-greet').textContent));

      // On this day: a strip of small mood-tinted cards, one clipped line of quote each
      const e = DB.entries();
      e[addDays(T, -7)] = { mood: 8, energy: 7, journal: 'A long quiet walk by the lake, then pancakes with everyone. '.repeat(4), habits: {} };
      e[addDays(T, -30)] = { mood: 3, energy: 4, journal: 'Rough one.', habits: {} };
      delete e[addDays(T, -90)];
      e[addDays(T, -365)] = { mood: 6, habits: {} };
      localStorage.setItem('dp.entries', JSON.stringify(e));
      const box = document.createElement('div'); box.innerHTML = throwbackHTML();
      const cards = box.querySelectorAll('.otd-strip .otd-c');
      ok('On this day is a strip of small cards, not a tall card', cards.length === 3 && !box.querySelector('.card') && !!box.querySelector('#otd-hide'), cards.length);
      ok('…each opens its day', [...cards].every(c => !!c.querySelector('[data-throwback]')) && cards[0].querySelector('[data-throwback]').dataset.throwback === addDays(T, -7));
      ok('…tinted by that day\'s mood', (cards[0].getAttribute('style') || '').includes(moodColor(8)) && (cards[1].getAttribute('style') || '').includes(moodColor(3)));
      ok('…says when, with the mood and energy numbers', /A week ago/.test(cards[0].textContent) && /8\s*mood/.test(cards[0].querySelector('.otd-nums').textContent) && /7\s*energy/.test(cards[0].querySelector('.otd-nums').textContent));
      ok('…and the quote is one line, clipped by CSS rather than cut short', !!cards[0].querySelector('.otd-q') && cards[0].querySelector('.otd-q').textContent.length > 140);
      setLogSecHidden('onthisday', true);
      ok('…hiding it still hides it', throwbackHTML() === '');
      setLogSecHidden('onthisday', false);

      // Tasks with none yet: one slim "+ Add a task" row
      localStorage.setItem('dp.tasks', '[]'); renderToday();
      const slim = sc().querySelector('.task-slim');
      ok('no tasks: Tasks is one slim "Add a task" row', !!slim && !!slim.querySelector('#log-task-input') && !!slim.querySelector('#log-task-add') && !sc().querySelector('.task-summary') && !/No tasks yet/.test(sc().textContent));
      slim.querySelector('#log-task-input').value = 'Call the bank';
      slim.querySelector('#log-task-add').click();
      ok('…adding one turns it into the Tasks card with its counts', DB.tasks().length === 1 && DB.tasks()[0].text === 'Call the bank' && !sc().querySelector('.task-slim') && !!sc().querySelector('.task-summary'));
    } finally {
      window.toast = tSnap; logDate = ldSnap;
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      navigateTo('today');
    }
  })();

  // ---- Lift: low-mood support (trigger, Talk-to-someone escalation, learning line minimum) ----
  (function () {
    const keys = ['dp.entries', 'dp.logsec'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const tSnap = window.toast; window.toast = () => {};
    const T = todayStr();
    // moods for the last N days, the last one today
    const mk = moods => { const e = {}; moods.forEach((m, i) => { e[addDays(T, -(moods.length - 1 - i))] = { mood: m }; }); return e; };
    try {
      // --- when the card shows ---
      ok('Lift: mood 3 is a low day', liftIsLow({ mood: 3 }));
      ok('Lift: mood 4 is still low (the line)', liftIsLow({ mood: 4 }));
      ok('Lift: mood 5 on its own is not', !liftIsLow({ mood: 5 }));
      ok('Lift: mood 5 with an unpleasant word tagged is', liftIsLow({ mood: 5, journal: 'meh #drained' }));
      ok('Lift: #sadness is not #sad', !liftIsLow({ mood: 5, journal: 'reading about #sadness' }));
      ok('Lift: a pleasant mood is never low, whatever is tagged', !liftIsLow({ mood: 7, journal: '#tired' }));
      ok('Lift: no mood and nothing tagged is not low', !liftIsLow({}) && !liftIsLow(null) && !liftIsLow({ mood: '' }));
      ok('Lift: the card shows on a low today', liftCardShows({ mood: 2 }, T));
      ok('Lift: not once dismissed for the day', !liftCardShows({ mood: 2, lift: { hide: true } }, T));
      ok('Lift: not on a past day', !liftCardShows({ mood: 2 }, addDays(T, -1)));
      ok('Lift: a tick or a dismissed card alone is not a logged day', !entryHasContent({ lift: { did: ['water'], hide: true }, updatedAt: 'x', habits: {} }));

      // --- Talk to someone moves up ---
      ok('Lift: 3 low of the last 5 logged days raises Talk to someone', liftEscalate(mk([7, 3, 6, 2, 4])));
      ok('Lift: 2 low of 5 does not', !liftEscalate(mk([7, 3, 6, 8, 4])));
      ok('Lift: only the last 5 logged days count', !liftEscalate(mk([2, 2, 2, 7, 7, 7, 7, 7])));
      const old = {}; [20, 19, 18].forEach(n => { old[addDays(T, -n)] = { mood: 2 }; });
      ok('Lift: low days more than two weeks back do not', !liftEscalate(old));
      const samp = mk([2, 2, 2]); Object.keys(samp).forEach(d => { samp[d].sample = true; });
      ok('Lift: sample days do not', !liftEscalate(samp));
      ok('Lift: heavy-day count says how many of how many', JSON.stringify(liftHeavyDays(mk([7, 3, 6, 2, 4]))) === '{"low":3,"of":5}');

      // --- the learning line: nothing below LIFT_MIN_N days on either side ---
      const L = (nOn, nOff, onNext, offNext) => { const e = {}; let d = addDays(T, -200);
        for (let i = 0; i < nOn; i++) { e[d] = { mood: 3, lift: { did: ['outside'] } }; e[addDays(d, 1)] = { mood: onNext }; d = addDays(d, 3); }
        for (let i = 0; i < nOff; i++) { e[d] = { mood: 3 }; e[addDays(d, 1)] = { mood: offNext }; d = addDays(d, 3); }
        return e; };
      ok('Lift learning: the minimum is 4', LIFT_MIN_N === 4);
      ok('Lift learning: 3 days with the action says nothing', liftLearn(L(3, 6, 6, 4)) === null);
      ok('Lift learning: 4 with only 3 to compare with says nothing', liftLearn(L(4, 3, 6, 4)) === null);
      const ln = liftLearn(L(4, 4, 6, 4));
      ok('Lift learning: 4 and 4 names the action', !!ln && ln.act.id === 'outside' && ln.nOn === 4 && ln.nOff === 4 && approx(ln.diff, 2), ln && [ln.act.id, ln.nOn, ln.nOff, ln.diff]);
      ok('Lift learning: the line gives both sample sizes and the plain numbers', !!ln && /4 vs 4 days/.test(liftLearnLine(ln)) && /\+3\.0/.test(liftLearnLine(ln)) && /\+1\.0/.test(liftLearnLine(ln)) && /not proof/.test(liftLearnLine(ln)), ln && liftLearnLine(ln));
      ok('Lift learning: an action that did not help is not praised', liftLearn(L(5, 5, 3, 6)) === null);
      ok('Lift learning: no data, no line', liftLearn({}) === null && liftLearnLine(null) === '');

      // --- the card on the Log ---
      localStorage.removeItem('dp.logsec');
      localStorage.setItem('dp.entries', JSON.stringify({ [T]: { mood: 8, energy: 7, habits: {} } }));
      navigateTo('today');
      ok('Lift card: none on a good day', !document.querySelector('#s-today .lift-card') && !!document.getElementById('lift-slot'));
      document.querySelector('#s-today [data-mm="1,3"]').click();
      ok('Lift card: appears as soon as a low mood is tapped', !!document.querySelector('#s-today .lift-card'));
      const slot = document.getElementById('lift-slot');
      ok('Lift card: sits right under the mood grid', !!slot.previousElementSibling && slot.previousElementSibling.classList.contains('mm-card'));
      document.querySelector('#s-today [data-lift-dismiss]').click();
      ok('Lift card: Not today hides it', !document.querySelector('#s-today .lift-card'));
      flushAutosave();
      ok('Lift card: and that is kept on the day', objOf((DB.entry(T) || {}).lift).hide === true, DB.entry(T));
      navigateTo('today');
      ok('Lift card: still hidden when the Log opens again', !document.querySelector('#s-today .lift-card'));

      // --- the screen ---
      localStorage.setItem('dp.entries', JSON.stringify({ [T]: { mood: 3, journal: 'Long day.' } }));
      _liftNotOk = null; navigateTo('lift');
      const sc = document.getElementById('s-lift');
      const order = () => [...sc.querySelectorAll('section.lift-sec')].map(s => s.id);
      ok('Lift: a screen with all six parts', sc.classList.contains('on') && ['lift-breathe', 'lift-ground', 'lift-small', 'lift-good', 'lift-write', 'lift-talk'].every(id => order().includes(id)), order().join(','));
      ok('Lift: Talk to someone is last on an ordinary low day', order()[order().length - 1] === 'lift-talk', order().join(','));
      ok('Lift: Tele-MANAS numbers are tap-to-call links', !!sc.querySelector('a[href="tel:14416"]') && !!sc.querySelector('a[href="tel:18008914416"]'));
      ok('Lift: findahelpline.com for everywhere else', !!sc.querySelector('a[href="https://findahelpline.com"]'));
      ok('Lift: says plainly it is not a medical service', /not a medical service/i.test(sc.textContent) && /cannot diagnose or treat/i.test(sc.textContent));
      sc.querySelector('[data-lift-notok]').click();
      ok("Lift: I'm not okay raises Talk to someone to the top", order()[0] === 'lift-talk', order().join(','));
      _liftNotOk = null;
      localStorage.setItem('dp.entries', JSON.stringify(mk([7, 3, 6, 2, 4])));
      renderLift();
      ok('Lift: 3 low days of the last 5 raise it too, and say so', order()[0] === 'lift-talk' && /3 of your last 5/.test(sc.querySelector('#lift-talk').textContent), order().join(','));
      localStorage.setItem('dp.entries', JSON.stringify(mk([8, 7, 3])));
      renderLift();
      ok('Lift: one low day in a good week keeps it at the bottom', order()[order().length - 1] === 'lift-talk', order().join(','));

      // ticking a small thing, and writing it out
      localStorage.setItem('dp.entries', JSON.stringify({ [T]: { mood: 3, journal: 'Long day.' } }));
      renderLift();
      const id = sc.querySelector('[data-lift-did]').dataset.liftDid;
      sc.querySelector('[data-lift-did]').click();
      ok('Lift: I did this is recorded on today', liftDid(DB.entry(T)).includes(id), DB.entry(T).lift);
      sc.querySelector('[data-lift-did]').click();
      ok('Lift: Undo takes it back, leaving nothing behind', !('lift' in DB.entry(T)), DB.entry(T));
      const ta = sc.querySelector('#lift-text'); ta.value = 'It was <b>a lot</b>.'; ta.dispatchEvent(new Event('input', { bubbles: true }));
      sc.querySelector('[data-lift-save]').click();
      ok("Lift: Write it out adds to today's journal", DB.entry(T).journal === 'Long day.\n\nIt was <b>a lot</b>.', DB.entry(T).journal);
      ok('Lift: and says it was saved', !!sc.querySelector('#lift-write .lift-saved') && sc.querySelector('#lift-text').value === '');

      // the person's own good days, escaped
      const e2 = DB.entries(); e2[addDays(T, -30)] = { mood: 9, journal: '<img src=x onerror=alert(1)> best day in ages #grateful' };
      localStorage.setItem('dp.entries', JSON.stringify(e2));
      _liftGood = null; renderLift();
      const good = sc.querySelector('#lift-good');
      ok('Lift: a good day is read back in their words', /best day in ages/.test(good.textContent) && /Grateful/.test(good.textContent), good.textContent.replace(/\s+/g, ' ').slice(0, 160));
      ok('Lift: and their text is escaped', !good.querySelector('img[src="x"]'));
      ok('Lift: a low day is never offered as a good one', liftGoodDays({ [addDays(T, -3)]: { mood: 4, journal: 'rough' } }).length === 0);

      renderDrawer();
      ok('Lift: the menu always offers it', !!document.querySelector('#drawer-list [data-screen="lift"]'));
    } catch (err) {
      ok('Lift tests ran to the end', false, String(err && err.stack || err));
    } finally {
      window.toast = tSnap; _liftNotOk = null; _liftDeck = null; _liftGood = null; _liftText = ''; _liftSaved = false; liftBreathStop();
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      navigateTo('today');
    }
  })();

  // ---- The greeting on a non-Log opening tab (homeGreetSync) ----
  (function () {
    const sS = localStorage.getItem('dp.settings');
    try {
      const set = dt => { const st = DB.settings(); if (dt) st.defaultTab = dt; else delete st.defaultTab; st.name = 'Asha Rao'; DB.saveSettings(st); };
      const hg = () => document.getElementById('home-greet');
      ok('there is a greeting slot outside the screens', !!hg() && !hg().closest('.screen'));
      set('dash'); navigateTo('dash');
      ok('the opening tab (Stats) shows the greeting', !hg().hidden && /Good (night|morning|afternoon|evening)/.test(hg().textContent) && /Asha/.test(hg().textContent));
      ok('…with today\'s progress as a way into the Log', !!hg().querySelector('[data-hg-log]') && /%/.test(hg().querySelector('[data-hg-log]').textContent));
      renderDash();
      ok('…and a re-render inside Stats keeps it', !hg().hidden && !!hg().querySelector('.lh-greet'));
      navigateTo('time');
      ok('another screen does not show it', hg().hidden && hg().innerHTML === '');
      navigateTo('dash'); hg().querySelector('[data-hg-log]').click();
      ok('tapping the progress opens the Log', document.getElementById('s-today').classList.contains('on') && hg().hidden);
      set(null); navigateTo('dash');
      ok('with the Log as the opening tab, Stats shows no greeting (the Log has its own hero)', hg().hidden);
    } finally {
      if (sS != null) localStorage.setItem('dp.settings', sS); else localStorage.removeItem('dp.settings');
      navigateTo('today');
    }
  })();

  // ---- Meals: plan a slot, your meals, the shopping list, copy last week, sync, backup, the Log card ----
  (function () {
    const keys = ['dp.meals', 'dp.meallib', 'dp.mealshop', 'dp.listAt', 'dp.listDel', 'dp.logsec', 'dp.entries', 'dp.touched', 'dp.health', 'dp.settings'];
    const snap = {}; keys.forEach(k => { snap[k] = localStorage.getItem(k); });
    const tSnap = window.toast; window.toast = () => {};
    const tap = (sel) => { const el = document.querySelector(sel); if (!el) { ok('the page has ' + sel, false); return false; } el.click(); return true; };
    try {
      ['dp.meals', 'dp.meallib', 'dp.mealshop', 'dp.listAt', 'dp.listDel', 'dp.logsec'].forEach(k => localStorage.removeItem(k));
      const st = DB.settings(); delete st.syncUrl; DB.saveSettings(st);
      const T = todayStr(), WS = weekStart(T), idea = n => MEAL_IDEAS.find(m => m.name === n);
      ok('Meals is a screen with a renderer', typeof RENDER.meals === 'function' && !!document.getElementById('s-meals'));
      ok('the plan, your meals and the shopping list sync item by item', ['meals', 'meallib', 'mealshop'].every(k => LIST_SYNC.includes(k)));
      ok('…and are all backed up', ['meals', 'meallib', 'mealshop'].every(k => BACKUP_KEYS.includes(k)));
      ok('there are about 30 starter ideas, each with an emoji, a type and ingredients', MEAL_IDEAS.length >= 30 && MEAL_IDEAS.every(m => m.emoji && MEAL_DIETS[m.diet] && m.ing && m.s));
      ok("Today's meals on the Log stays hidden while nothing is planned", logSecHidden('meals'));

      // planning a slot
      const it = mealAdd(T, 'b', idea('Poha'));
      const p0 = mealPlan()[0];
      ok('planning a slot stores the meal on that day and slot', !!it && mealPlan().length === 1 && p0.day === T && p0.slot === 'b' && p0.name === 'Poha' && p0.emoji === '🍚');
      ok('…stamped for the item-by-item sync', !!(listMeta('dp.listAt').meals || {})[it.id]);
      ok('…and the idea is now one of your meals, ingredients and all', mealLib().length === 1 && /onion/.test(mealLib()[0].ing) && p0.lib === mealLib()[0].id);
      ok("…and the first meal planned brings Today's meals onto the Log", !logSecHidden('meals'));

      // the library
      mealAdd(T, 'd', { name: '  Masala   oats ' });
      const mo = mealLibFind('masala oats');
      ok('a typed name is saved to your meals, tidied', !!mo && mo.name === 'Masala oats');
      ok('…with an emoji guessed from the name', mo && mo.emoji === '🥣');
      mealAdd(addDays(T, 1), 'd', { name: 'masala OATS' });
      ok('planning it again does not make a second library meal', mealLib().filter(m => mealNorm(m.name) === 'masala oats').length === 1);
      ok('chicken is non-veg, paneer bhurji is not egg, an egg dish is egg', mealGuess('Chicken 65').diet === 'nonveg' && mealGuess('Paneer bhurji').diet === 'veg' && mealGuess('Egg roast').diet === 'egg');
      const lib = mealLib(); lib.find(m => m.id === mo.id).ing = 'Oats, Onions, tomato'; mealSaveLib(lib);
      ok('a library edit is stamped too', !!(listMeta('dp.listAt').meallib || {})[mo.id]);

      // the shopping list
      const onion = () => mealShopRows().find(r => r.id === 'g:onion');
      ok('the list adds ingredients up across meals, "Onions" and "onion" as one line', !!onion() && onion().n === 3, mealShopRows().map(r => r.id + '×' + r.n));
      ok('…and says which meals need it', onion().meals.includes('Poha') && onion().meals.includes('Masala oats'));
      ok('"tomatoes" and "tomato" are one ingredient too', mealIngKey('Tomatoes') === mealIngKey('tomato') && mealIngKey('glass') === 'glass');
      mealAdd(addDays(T, 9), 'l', { name: 'Masala oats' });
      ok('a meal more than 6 days out is not on the list yet', onion().n === 3);
      mealEatToggle(it.id);
      ok('an eaten meal leaves the list', onion().n === 2 && !mealShopRows().some(r => r.id === 'g:poha'));
      mealEatToggle(it.id);
      ok('a meal cannot be eaten before its day', mealEatToggle(mealPlan().find(p => p.day === addDays(T, 9)).id) === null);
      mealShopToggle('g:onion');
      ok('ticking a line keeps it, ticked', onion().done === true && mealShop().some(x => x.id === 'g:onion' && x.done));
      mealAdd(addDays(T, 2), 'l', { name: 'Masala oats' });
      ok('a newly planned meal that needs it brings it back unticked, with the new count', onion().done === false && onion().n === 4, onion());
      mealShopToggle('g:onion');
      mealShopAddManual('  Dish   soap ');
      const soap = mealShopRows().find(r => r.manual);
      ok('your own items go on the list too', !!soap && soap.name === 'Dish soap');
      mealShopToggle(soap.id);
      const cl = mealShopClear();
      ok('clearing checked removes your own items and clears ticked plan items', cl.n === 2 && !onion() && !mealShopRows().some(r => r.manual), mealShopRows().map(r => r.id));
      ok('…which stay cleared for those meals, not deleted', mealShop().some(x => x.id === 'g:onion' && x.cleared));
      ok('the copied text lists what is still to get, counted', /• tomato ×3/.test(mealShopText()), mealShopText());
      mealSaveShop(cl.before);
      ok('…and Undo puts them back', mealShopRows().some(r => r.manual && r.done) && onion().done);

      // copy last week, repeat on…
      mealSavePlan([]);
      const LW = addDays(WS, -7);
      mealAdd(LW, 'b', idea('Poha')); mealAdd(addDays(LW, 1), 'l', idea('Dal rice')); mealAdd(addDays(LW, 1), 'd', idea('Khichdi'));
      mealEatToggle(mealPlan()[0].id);
      mealAdd(addDays(WS, 1), 'l', idea('Rajma chawal'));   // already planned this week
      const n = mealCopyWeek(WS);
      const wk = () => mealPlan().filter(p => p.day >= WS && p.day <= addDays(WS, 6));
      ok('copy last week fills this week\'s empty slots from last week', n === 2 && wk().some(p => p.day === WS && p.slot === 'b' && p.name === 'Poha') && wk().some(p => p.day === addDays(WS, 1) && p.slot === 'd' && p.name === 'Khichdi'), n);
      ok('…never over a slot that is already planned', wk().filter(p => p.day === addDays(WS, 1) && p.slot === 'l').map(p => p.name).join() === 'Rajma chawal');
      ok('…and the copies are not eaten, with ids of their own', wk().every(p => !p.eaten) && new Set(mealPlan().map(p => p.id)).size === mealPlan().length);
      ok('copying again adds nothing', mealCopyWeek(WS) === 0);
      const pw = wk().find(p => p.name === 'Poha');
      ok('repeat on… adds the meal on the days picked, not again on its own day', mealRepeat(pw.id, [addDays(WS, 2), addDays(WS, 3), WS]) === 2 && mealsOn(addDays(WS, 3), 'b').some(p => p.name === 'Poha'));
      ok('…and leaves a day that already has it alone', mealRepeat(pw.id, [addDays(WS, 2)]) === 0);

      // swap: on the day or after, the planned name is kept
      const dr = mealAdd(T, 'd', idea('Dal rice'));
      mealSwap(dr.id, idea('Khichdi'), true);
      const sw = mealPlan().find(p => p.id === dr.id);
      ok('swapping today keeps what was planned and, from the Log, marks it eaten', sw.name === 'Khichdi' && sw.was === 'Dal rice' && sw.eaten === true);
      mealSwap(dr.id, idea('Dal rice'));
      ok('…and swapping back forgets it was swapped', !mealPlan().find(p => p.id === dr.id).was);

      // two phones editing the same week
      const now = Date.now();
      localStorage.setItem('dp.listAt', '{}'); localStorage.setItem('dp.listDel', '{}');
      const shared = { id: 'mlshared', day: WS, slot: 'd', name: 'Dal rice', emoji: '🍛', diet: 'veg', tags: [], lib: '' };
      localStorage.setItem('dp.meals', JSON.stringify([shared]));
      mealSavePlan([shared, { id: 'mlmine', day: WS, slot: 'b', name: 'Poha', emoji: '🍚', diet: 'veg', tags: [], lib: '' }]);
      const P = mealPlan(); P.find(p => p.id === 'mlshared').eaten = true; mealSavePlan(P);
      localStorage.setItem('dp.touched', String(now - 60000));
      applyRemoteState({ touched: now, meals: [shared, { id: 'mltheirs', day: addDays(WS, 1), slot: 'l', name: 'Rajma chawal', emoji: '🫘', diet: 'veg', tags: [], lib: '' }],
        listAt: { meals: { mlshared: now - 50000, mltheirs: now - 1000 } }, listDel: {}, entries: {}, timelog: [], timelogDel: {} });
      const M = mealPlan();
      ok('two phones planning the same week: both phones\' meals survive the merge', M.some(p => p.id === 'mlmine') && M.some(p => p.id === 'mltheirs'), M.map(p => p.id));
      ok('…and the later edit of the same meal wins (eaten here after their older copy)', (M.find(p => p.id === 'mlshared') || {}).eaten === true);
      applyRemoteState({ touched: Date.now() + 10, meals: M.filter(p => p.id !== 'mlmine'), listAt: { meals: { mltheirs: now - 1000 } },
        listDel: { meals: { mlmine: Date.now() + 5 } }, entries: {}, timelog: [], timelogDel: {} });
      ok('…and a meal removed on the other phone goes here too', !mealPlan().some(p => p.id === 'mlmine') && mealPlan().some(p => p.id === 'mltheirs'));
      const mm = mergeList([{ id: 'g:onion', done: true, src: ['a'] }], [{ id: 'g:onion', done: true, src: ['a', 'b'] }], { 'g:onion': now - 900 }, { 'g:onion': now - 100 }, {}, {}, true);
      ok('the same ingredient ticked on both phones stays one line, the later tick wins', mm.list.length === 1 && mm.list[0].src.length === 2);

      // backup and restore
      mealShopAddManual('Ghee');
      const blob = backupBlob().data;
      ok('a backup carries the plan, your meals and the shopping list', Array.isArray(blob.meals) && blob.meals.length === mealPlan().length && blob.meals.length > 0
        && Array.isArray(blob.meallib) && blob.meallib.length === mealLib().length && Array.isArray(blob.mealshop) && blob.mealshop.some(x => x.name === 'Ghee'));
      const saved = JSON.stringify({ meals: blob.meals, meallib: blob.meallib, mealshop: blob.mealshop });
      ['dp.meals', 'dp.meallib', 'dp.mealshop'].forEach(k => localStorage.removeItem(k));
      ok('(a wipe empties them)', !mealPlan().length && !mealLib().length && !mealShop().length);
      const d = JSON.parse(saved), check = validateBackup(d);
      ok('the backup file validates with all three sections', check.ok && ['meals', 'meallib', 'mealshop'].every(k => check.keys.includes(k)), check);
      const before = listIds(check.keys);
      check.keys.forEach(k => safeSet('dp.' + k, JSON.stringify(d[k])));
      listRestored(before, Date.now() - 5000);
      ok('restoring brings every meal, library meal and list item back', mealPlan().length === d.meals.length && mealLib().length === d.meallib.length && mealShop().some(x => x.name === 'Ghee'));
      ok('…each stamped, so the next sync carries them', Object.keys(listMeta('dp.listAt').meals || {}).length === d.meals.length);
      ok('a backup whose plan is not a list is refused', !validateBackup({ meals: { a: 1 } }).ok);

      // the insight: nothing below 6 days a side, then an honest sentence
      mealSavePlan([]);
      ok('no insight without enough days', mealInsight() === null);
      const ents = {}, pl = [];
      for (let i = 1; i <= 14; i++) {
        const day = addDays(T, -i - 1), ate = i % 2 === 0;
        pl.push({ id: 'ins' + i, day, slot: 'd', name: 'Khichdi', emoji: '🍲', diet: 'veg', tags: [], lib: '', eaten: ate || undefined });
        ents[addDays(day, 1)] = { sleepHours: ate ? 7.5 + (i % 3) * 0.1 : 7 + (i % 3) * 0.1, updatedAt: new Date().toISOString() };
      }
      localStorage.setItem('dp.health', '{}');
      localStorage.setItem('dp.entries', JSON.stringify(ents));
      mealSavePlan(pl.slice(0, 10));
      ok('5 days a side is still not enough', mealInsight() === null);
      mealSavePlan(pl);
      const ins = mealInsight();
      ok('7 days a side gives one finding, worded like Patterns, sample sizes shown', !!ins && /slept 3\d min more/.test(ins.head) && /7 planned dinners/.test(ins.body) && /7 you skipped/.test(ins.body), ins);

      // the Log card
      mealSavePlan([]);
      const tp = mealAdd(T, 'l', idea('Curd rice'));
      navigateTo('today');
      const card = document.querySelector('#s-today .ml-log');
      ok("the Log shows Today's meals once there is a plan", !!card && /Curd rice/.test(card.textContent));
      tap(`#s-today [data-ml-eat="${tp.id}"]`);
      ok('one tap on the Log marks it eaten', mealPlan().find(p => p.id === tp.id).eaten === true && !!document.querySelector(`#s-today [data-ml-eat="${tp.id}"].on`));

      // the screen and its sheet
      navigateTo('meals');
      const sc = document.getElementById('s-meals');
      ok('the planner shows a 7-day strip with today marked', sc.querySelectorAll('.ml-dp').length === 7 && !!sc.querySelector('.ml-dp.today.on'));
      ok('…the day\'s four slots, and the week at a glance', sc.querySelectorAll('.ml-day .ml-slot').length === 4 && sc.querySelectorAll('.ml-glance .ml-grow[data-ml-day]').length === 7);
      ok('an empty slot offers a one-tap suggestion', !!sc.querySelector('.ml-day [data-ml-quick]'));
      tap('#s-meals .ml-day [data-ml-add]');
      ok('a slot opens the add sheet, with ideas', mealSheetIsOpen() && document.querySelectorAll('#ml-sheet .ml-idea').length >= 20);
      const q = document.getElementById('ml-q');
      if (q) { q.value = 'Thayir <b>sadam</b>'; q.dispatchEvent(new Event('input', { bubbles: true })); }
      ok('typing a new name offers to add it, escaped', !!document.querySelector('#ml-sheet [data-ml-new]') && !document.querySelector('#ml-sheet [data-ml-new] b b'));
      tap('#ml-sheet [data-ml-new]');
      ok('…which plans it and closes the sheet', !mealSheetIsOpen() && mealPlan().some(p => p.name === 'Thayir <b>sadam</b>'));
      tap(`#s-meals [data-ml-item="${tp.id}"]`);
      ok('a planned meal opens its options', mealSheetIsOpen() && !!document.querySelector('#ml-sheet [data-ml-act="repeat"]'));
      tap('#ml-sheet [data-ml-act="repeat"]');
      ok('Repeat on… shows two weeks of days', document.querySelectorAll('#ml-sheet [data-ml-rday]').length === 14);
      handleBack();
      ok('Back steps from Repeat to the meal, then closes', mealSheetIsOpen() && !!document.querySelector('#ml-sheet [data-ml-act]') && (handleBack(), !mealSheetIsOpen()));
      tap('#s-meals [data-ml-week="1"]');
      ok('the arrow goes to next week', mlWeek === addDays(WS, 7) && /Next week/.test(sc.textContent));
      mealAdd(addDays(T, 1), 'd', idea('Dal rice'));
      tap('#s-meals [data-ml-tab="shop"]');
      ok('the shopping tab lists the week\'s ingredients', mlTab === 'shop' && !!sc.querySelector('.ml-li') && /rice/i.test(sc.textContent));
      handleBack();
      ok('Back from the shopping list returns to the plan', mlTab === 'plan');

      // Search finds planned meals and opens that day in Meals
      const sm = mealAdd(addDays(T, -3), 'l', { name: 'Paneer butter masala' });
      const res = runSearch('paneer');
      ok('Search finds a planned meal by name', !!sm && /🍽️ Meals/.test(res) && /data-sr="meal" data-d="/.test(res) && /Lunch/.test(res));
      ok('…and a meal swapped away is found by the planned name too', (() => {
        mealSwap(sm.id, { name: 'Dal rice' }, false); return /data-sr="meal"/.test(runSearch('paneer'));
      })());
      show('search'); const sr = document.getElementById('search-results'); if (sr) sr.innerHTML = runSearch('paneer');
      tap('#search-results .sr-row[data-sr="meal"]');
      ok('…and tapping it opens Meals on that day', document.getElementById('s-meals').classList.contains('on') && mlDay === addDays(T, -3));
    } finally {
      window.toast = tSnap; mealSheetClose(); mlWeek = null;
      keys.forEach(k => { if (snap[k] != null) localStorage.setItem(k, snap[k]); else localStorage.removeItem(k); });
      navigateTo('today');
    }
  })();


  // ---- Come-back nudges + the "Log my day" reminder (nudgePlan, 2026-11-21) ----
  (() => {
    const T = todayStr();
    const at10 = new Date(T + 'T10:00:00').getTime();
    const base = { now: at10, today: T, last: T, loggedToday: false, logDays: 0, logTime: null, off: false };
    const days = p => p.map(n => n.day);
    const uniq = p => new Set(days(p)).size === p.length;
    const noLoss = p => p.every(n => !/streak|miss you|don't lose|falling behind|lose/i.test(n.title + ' ' + n.body));

    const fresh = nudgePlan(Object.assign({}, base, { logDays: 1 }));
    ok('a brand-new user without a reminder hears back the next day',
       fresh.length === 5 && fresh[0].day === addDays(T, 1) && fresh[0].at.getHours() === 20 && fresh[0].id === 760, JSON.stringify(days(fresh)));
    ok('…then on a widening gap: 5, 10, 20, 30 days, then never',
       JSON.stringify(days(fresh)) === JSON.stringify([1, 5, 10, 20, 30].map(g => addDays(T, g))));
    ok('…and the last one says it is the last', /last nudge/i.test(fresh[4].body) && /Settings/.test(fresh[4].body));
    const settled = nudgePlan(Object.assign({}, base, { logDays: 12 }));
    ok('a settled user without a reminder: first nudge after two clear days, not every evening',
       settled[0].day === addDays(T, 2) && settled.length === 5);
    const gapFrom = nudgePlan(Object.assign({}, base, { logDays: 12, last: addDays(T, -3) }));
    ok('come-back days count from the last logged day, past ones dropped',
       JSON.stringify(days(gapFrom)) === JSON.stringify([5, 10, 20, 30].map(g => addDays(T, g - 3))));

    const withRem = nudgePlan(Object.assign({}, base, { logDays: 12, logTime: '21:00' }));
    const remOnes = withRem.filter(n => n.id >= 840);
    ok('the Log my day reminder: today + 6 days at its own time',
       remOnes.length === 7 && remOnes[0].day === T && remOnes.every(n => n.at.getHours() === 21 && n.at.getMinutes() === 0), JSON.stringify(days(remOnes)));
    ok('…come-back nudges only after its week, at the reminder\'s time',
       JSON.stringify(days(withRem.filter(n => n.id < 840))) === JSON.stringify([10, 20, 30].map(g => addDays(T, g))) && withRem.filter(n => n.id < 840).every(n => n.at.getHours() === 21));
    ok('never two log notifications on one day', uniq(withRem) && uniq(fresh) && uniq(gapFrom));
    const loggedNow = nudgePlan(Object.assign({}, base, { logDays: 12, logTime: '21:00', loggedToday: true }));
    ok('once today is logged, today\'s Log my day is skipped', !loggedNow.some(n => n.day === T) && loggedNow.filter(n => n.id >= 840).length === 6);
    const late = nudgePlan(Object.assign({}, base, { now: new Date(T + 'T22:00:00').getTime(), logDays: 12, logTime: '21:00' }));
    ok('a time already past today is not scheduled', !late.some(n => n.day === T) && late.every(n => n.at.getTime() > late[0].at.getTime() - 1));
    // review #5: a save 30 s before 21:00 re-plans; today's occurrence is still ahead and must stay
    const justBefore = nudgePlan(Object.assign({}, base, { now: new Date(T + 'T20:59:30').getTime(), logDays: 12, logTime: '21:00' }));
    ok('review #5: rescheduled in the minute before, today\'s Log my day is kept',
       justBefore.some(n => n.day === T && n.id === LOGREM_ID), JSON.stringify(days(justBefore)));
    const onTheDot = nudgePlan(Object.assign({}, base, { now: new Date(T + 'T21:00:00').getTime(), logDays: 12, logTime: '21:00' }));
    ok('review #5: …but not once its minute has come', !onTheDot.some(n => n.day === T));
    const off = nudgePlan(Object.assign({}, base, { logDays: 12, logTime: '21:00', off: true }));
    ok('nudges off: only the user\'s own reminder remains', off.length === 7 && off.every(n => n.id >= 840));
    ok('nudges off and no reminder: nothing at all', nudgePlan(Object.assign({}, base, { off: true })).length === 0);

    ok('first ever log: a first-log line', /first log/i.test(logReminderCopy(T, { logDays: 0 }).t));
    ok('under 5 logged days: the honest count to Stats insights',
       /^2 more logged days and Stats/.test(logReminderCopy(T, { logDays: 3 }).b) && /^1 more logged day and/.test(logReminderCopy(T, { logDays: 4 }).b));
    const week = [0, 1, 2, 3, 4].map(d => logReminderCopy(addDays(T, d), { logDays: 20 }).b);
    ok('…after that the copy changes from day to day', new Set(week).size === 5, JSON.stringify(week));
    ok('no notification uses loss framing', noLoss(fresh) && noLoss(withRem) && noLoss(settled));
    ok('every notification opens the Log', /extra: \{ go: 'today'/.test(scheduleInactivityReminder.toString()) && /navigateTo\('today'\)/.test(onNudgeAction.toString()));
    ok('scheduling never asks for permission', !/requestPermissions/.test(scheduleInactivityReminder.toString()));

    ok('isLogReminder: the onboarding reminder', isLogReminder({ id: 'r', time: '21:00', label: 'Log my day', enabled: true, mode: 'notify' }));
    ok('…but not in alarm mode, renamed or switched off',
       !isLogReminder({ time: '21:00', label: 'Log my day', enabled: true, mode: 'alarm' }) &&
       !isLogReminder({ time: '21:00', label: 'Take meds', enabled: true, mode: 'notify' }) &&
       !isLogReminder({ time: '21:00', label: 'Log my day', enabled: false, mode: 'notify' }));
    ok('scheduleNativeAlarms leaves the Log my day reminder to nudgePlan', /logRem = rems\.find\(isLogReminder\)/.test(scheduleNativeAlarms.toString()));   // behaviour: unit-async.js, review #7
    ok('an auto-filled time summary is not a log by hand', !loggedByHand({ timeSummary: { sleep: 420 }, autoAt: { timeSummary: 1 } }) && loggedByHand({ mood: 4 }));

    const kSnap = ['dp.reminders', 'dp.nudgeOff', 'dp.entries'].map(k => [k, localStorage.getItem(k)]);
    try {
      localStorage.setItem('dp.reminders', JSON.stringify([{ id: 'r1', time: '21:30', label: 'Log my day', enabled: true, mode: 'notify' }]));
      localStorage.setItem('dp.nudgeOff', '1');
      const inp = nudgeInput();
      ok('nudgeInput reads the reminder time and the off switch', inp.logTime === '21:30' && inp.off === true && inp.today === T);
    } finally { kSnap.forEach(([k, v]) => { if (v != null) localStorage.setItem(k, v); else localStorage.removeItem(k); }); }
    // review #4: the sample preview's demo rows (entries and time blocks marked sample) are not logged days
    const sSnap = ['dp.entries', 'dp.timelog', 'dp.gym'].map(k => [k, localStorage.getItem(k)]);
    try {
      const smp = {}; [3, 4, 5, 6, 8].forEach(i => { smp[addDays(T, -i)] = { mood: 8, journal: 'demo', habits: {}, sample: true }; });
      const d3 = new Date(addDays(T, -3) + 'T09:00:00').getTime();
      localStorage.setItem('dp.entries', JSON.stringify(smp)); localStorage.setItem('dp.gym', '{}');
      localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'smpX', act: 'work', start: d3, end: d3 + 3600000, upd: d3, sample: true }]));
      const si = nudgeInput();
      ok('review #4: sample days do not count as logged days in the nudge plan',
         si.logDays === 0 && Object.keys(si.recent).length === 0, { logDays: si.logDays, recent: si.recent });
      ok('review #4: …nor as the last active day (entries or time blocks)', lastActiveDay() === T && si.last === T, [lastActiveDay(), si.last]);
      smp[addDays(T, -10)] = { mood: 6, habits: {} }; localStorage.setItem('dp.entries', JSON.stringify(smp));
      const ri = nudgeInput();
      ok('review #4: …a real day among them still counts', ri.logDays === 1 && ri.last === addDays(T, -10) && Object.keys(ri.recent).join() === addDays(T, -10), ri);
    } finally { sSnap.forEach(([k, v]) => { if (v != null) localStorage.setItem(k, v); else localStorage.removeItem(k); }); }
  })();


  // ---- v262: Sunday recap, mood buttons on log notifications, the one-time notification ask ----
  (() => {
    const T = todayStr();
    // find the next Sunday on/after T + 1 so it is in the future
    let sun = addDays(T, 1); while (new Date(sun + 'T12:00:00').getDay() !== 0) sun = addDays(sun, 1);
    const recent = {}; recent[addDays(sun, -1)] = 6; recent[addDays(sun, -3)] = 9; recent[addDays(sun, -5)] = 4; recent[addDays(sun, -6)] = null;
    const rc = logReminderCopy(sun, { logDays: 20, recent });
    ok('Sunday\'s Log my day is a week recap', rc.t === 'Your week in Daylog' && /^This week: 4 days logged, best mood on /.test(rc.b), JSON.stringify(rc));
    ok('…naming the best-mood weekday', rc.b.includes(WEEKDAYS[new Date(addDays(sun, -3) + 'T12:00:00').getDay()]));
    ok('…with no loss framing', !/streak|lose|miss|behind/i.test(rc.b));
    ok('a quiet week (under 2 logged days) gets the normal copy', logReminderCopy(sun, { logDays: 20, recent: { [addDays(sun, -2)]: 7 } }).t !== 'Your week in Daylog');
    ok('early days keep the count-to-insights line on Sunday too', /more logged day/.test(logReminderCopy(sun, { logDays: 2, recent }).b));
    const mon = addDays(sun, 1);
    ok('other days are not a recap', logReminderCopy(mon, { logDays: 20, recent }).t !== 'Your week in Daylog');
    const plan = nudgePlan({ now: new Date(T + 'T10:00:00').getTime(), today: T, last: T, loggedToday: false, logDays: 20, logTime: '21:00', off: false, recent });
    ok('nudgeInput carries recent hand-logged moods', (() => {
      const snapE = localStorage.getItem('dp.entries');
      try {
        localStorage.setItem('dp.entries', JSON.stringify({ [addDays(T, -1)]: { mood: 7 }, [addDays(T, -2)]: { journal: 'x' }, [addDays(T, -3)]: { timeSummary: { a: 1 } }, [addDays(T, -30)]: { mood: 2 } }));
        const r = nudgeInput().recent;
        return r[addDays(T, -1)] === 7 && r[addDays(T, -2)] === null && !(addDays(T, -3) in r) && !(addDays(T, -30) in r);
      } finally { if (snapE != null) localStorage.setItem('dp.entries', snapE); else localStorage.removeItem('dp.entries'); }
    })());
    ok('the plan still has one notification a day with the recap in it', new Set(plan.map(n => n.day)).size === plan.length);

    // mood buttons
    const src = scheduleInactivityReminder.toString();
    ok('every log notification carries the mood buttons and its day', /actionTypeId: 'dp_log'/.test(src) && /day: n\.day/.test(src));
    ok('three moods, mid-band values', NOTIF_MOODS.map(m => m.v).join() === '8,5,3' && NOTIF_MOODS.every(m => moodFace(m.v)));
    ok('the action type is registered without touching the timer\'s types', (() => {
      const cs = window.Capacitor, rs = _nudgeTapReady; let got = null, listened = false;
      try {
        window.Capacitor = { Plugins: { LocalNotifications: { registerActionTypes: (o) => { got = o; }, addListener: () => { listened = true; } } } };
        _nudgeTapReady = false; setupNudgeTap();
        return !!got && got.types.map(t => t.id).join() === 'dp_log' && got.types[0].actions.length === 3 && listened;
      } finally { window.Capacitor = cs; _nudgeTapReady = rs; }
    })());
    const keys = ['dp.entries', 'dp.onboarded'];
    const snap = keys.map(k => [k, localStorage.getItem(k)]);
    const tSnap = window.toast; let toasted = '';
    window.toast = (m) => { toasted = m; };
    try {
      localStorage.setItem('dp.onboarded', '1');
      localStorage.setItem('dp.entries', JSON.stringify({}));
      onNudgeAction({ actionId: 'dp_m_8', notification: { extra: { go: 'today', day: T } } });
      ok('a mood button saves that mood for today and opens the Log', (DB.entry(T) || {}).mood === 8 && document.getElementById('s-today').classList.contains('on'), JSON.stringify(DB.entry(T)));
      ok('…and says so', /Mood saved/.test(toasted));
      onNudgeAction({ actionId: 'dp_m_3', notification: { extra: { go: 'today', day: T } } });
      ok('a second tap never overwrites a mood already set', DB.entry(T).mood === 8 && /already logged/.test(toasted));
      const Y = addDays(T, -1);
      onNudgeAction({ actionId: 'dp_m_5', notification: { extra: { go: 'today', day: Y } } });
      ok('last night\'s reminder answered after midnight lands on yesterday', (DB.entry(Y) || {}).mood === 5 && /yesterday/.test(toasted));
      localStorage.setItem('dp.entries', JSON.stringify({}));
      onNudgeAction({ actionId: 'dp_m_3', notification: { extra: { go: 'today', day: addDays(T, -9) } } });
      ok('an old notification\'s mood lands on today, not 9 days ago', (DB.entry(T) || {}).mood === 3 && !DB.entry(addDays(T, -9)));
      localStorage.setItem('dp.entries', JSON.stringify({}));
      onNudgeAction({ actionId: 'dp_m_8', notification: { extra: { go: 'elsewhere', day: T } } });
      onNudgeAction({ actionId: 'dp_pause', notification: { id: 770 } });
      ok('other notifications\' actions are ignored here', !DB.entry(T));
      // review #1: Android re-delivers the launch intent on a later cold start; the same button
      // press must not toast again or land an old mood on today
      localStorage.removeItem('dp.notifDone'); localStorage.setItem('dp.entries', JSON.stringify({}));
      const press = { actionId: 'dp_m_8', notification: { id: 841, extra: { go: 'today', day: Y } } };
      onNudgeAction(press);
      ok('(the press saves yesterday\'s mood)', (DB.entry(Y) || {}).mood === 8, DB.entry(Y));
      localStorage.setItem('dp.entries', JSON.stringify({})); toasted = '';
      onNudgeAction(JSON.parse(JSON.stringify(press)));   // the replay (days later it would land an old mood on today)
      ok('review #1: a replayed notification button is ignored (no toast, no mood saved)', toasted === '' && !DB.entry(T) && !DB.entry(Y), [toasted, DB.entry(T)]);
      onNudgeAction({ actionId: 'dp_m_5', notification: { id: 840, extra: { go: 'today', day: T } } });
      ok('review #1: …another notification\'s press is still handled', (DB.entry(T) || {}).mood === 5 && /Mood saved/.test(toasted), DB.entry(T));
      for (let i = 0; i < 60; i++) onNudgeAction({ actionId: 'tap', notification: { id: 760, extra: { go: 'today', day: addDays(T, -100 - i) } } });
      const done = safeParse(localStorage.getItem('dp.notifDone'), []);
      ok('review #1: the handled list keeps only the last 50', Array.isArray(done) && done.length === 50 && done[49] === '760|' + addDays(T, -159) + '|tap', done.length);
      ok('review #1: the handled list is install-local, not backed up', BACKUP_EXCLUDED.includes('notifDone') && !BACKUP_KEYS.includes('notifDone'));
    } finally {
      localStorage.removeItem('dp.notifDone');
      window.toast = tSnap;
      snap.forEach(([k, v]) => { if (v != null) localStorage.setItem(k, v); else localStorage.removeItem(k); });
    }

    // the one-time notification ask
    const capSnap = window.Capacitor, permSnap = _notifPerm;
    const ks = ['dp.entries', 'dp.reminders', 'dp.notifAsk', 'dp.onboarded'];
    const sn = ks.map(k => [k, localStorage.getItem(k)]);
    try {
      window.Capacitor = { Plugins: { LocalNotifications: { checkPermissions: () => Promise.resolve({ display: 'prompt' }) } } };
      localStorage.setItem('dp.onboarded', '1'); localStorage.removeItem('dp.notifAsk');
      localStorage.setItem('dp.reminders', '[]'); localStorage.setItem('dp.entries', '{}');
      navigateTo('today'); _notifPerm = 'prompt';
      ok('no ask before anything is logged today', notifAskKind() === null);
      localStorage.setItem('dp.entries', JSON.stringify({ [T]: { timeSummary: { s: 1 } } }));
      ok('…nor for an auto-filled time summary', notifAskKind() === null);
      localStorage.setItem('dp.entries', JSON.stringify({ [T]: { mood: 7 } }));
      ok('after a real log with no reminder: offer one', notifAskKind() === 'remind');
      renderToday();
      const slot = document.getElementById('notif-ask-slot');
      ok('the card shows on today\'s Log', !!slot && /Want a nudge tomorrow/.test(slot.textContent) && !!slot.querySelector('#notif-ask-time'));
      localStorage.setItem('dp.reminders', JSON.stringify([{ id: 'r', time: '21:00', label: 'Log my day', enabled: true, mode: 'notify' }]));
      _notifPerm = 'denied';
      ok('reminder set but notifications off: offer to switch them on', notifAskKind() === 'enable' && /can't ring/.test(notifAskHTML('enable')) && /21:00/.test(notifAskHTML('enable')));
      _notifPerm = 'granted';
      ok('reminder set and allowed: nothing to ask', notifAskKind() === null);
      _notifPerm = 'prompt'; localStorage.setItem('dp.reminders', '[]');
      renderToday();
      const no = document.querySelector('#notif-ask-slot [data-notif-ask="no"]');
      if (no) no.click();
      ok('one answer and it never comes back', /^no:/.test(localStorage.getItem('dp.notifAsk') || '') && notifAskKind() === null);
      ok('the ask is install-local, not backed up', BACKUP_EXCLUDED.includes('notifAsk') && !BACKUP_KEYS.includes('notifAsk'));
      window.Capacitor = undefined; localStorage.removeItem('dp.notifAsk');
      ok('the web app (no native shell) never shows it', notifAskKind() === null);
    } finally {
      window.Capacitor = capSnap; _notifPerm = permSnap;
      sn.forEach(([k, v]) => { if (v != null) localStorage.setItem(k, v); else localStorage.removeItem(k); });
      navigateTo('today');
    }

    // Play's in-app rating sheet (native build 122+): maybeAskReview after a save by hand
    {
      const capSnap2 = window.Capacitor, tourSnap = tourIdx;
      const rk = ['dp.entries', 'dp.reviewAsk', 'dp.rateAsk', 'dp.onboarded', 'dp.milestones', 'dp.celeb'];
      const rsn = rk.map(k => [k, localStorage.getItem(k)]);
      const TD = todayStr(), DAY = 86400000;
      let calls = 0, seen = null, mode = 'ok';
      const IAR = { request() {
        calls++; seen = safeParse(localStorage.getItem('dp.reviewAsk'), null);
        if (mode === 'throw') throw new Error('boom');
        if (mode === 'reject') return Promise.reject(new Error('nope'));
        return Promise.resolve({ ok: true }); } };
      const LN = { checkPermissions: () => Promise.resolve({ display: 'denied' }), cancel: () => Promise.resolve(), schedule: () => Promise.resolve() };
      // n hand-logged days: today with moodToday, the rest every OTHER day back, so no streak
      // milestone (a full-screen celebration) lands on the save and takes the moment
      const seed = (n, moodToday) => { const e = { [TD]: { mood: moodToday } };
        for (let i = 1; i < n; i++) e[addDays(TD, -2 * i)] = { mood: 5 };
        localStorage.setItem('dp.entries', JSON.stringify(e)); };
      const save = () => saveDraftNow(TD, Object.assign({}, DB.entry(TD)));
      const flush = () => { if (!_reviewAskTimer) return false; clearTimeout(_reviewAskTimer); reviewAskFire(); return true; };
      const setAsk = (n, daysAgo) => localStorage.setItem('dp.reviewAsk', JSON.stringify({ n, last: Date.now() - daysAgo * DAY }));
      const fresh = () => { localStorage.removeItem('dp.reviewAsk'); localStorage.removeItem('dp.rateAsk'); calls = 0; seen = null; mode = 'ok'; };
      const overlays = ['milestone', 'rate-ask'].map(id => document.getElementById(id)).filter(Boolean);
      const ovSnap = overlays.map(el => el.classList.contains('on'));
      try {
        window.Capacitor = { Plugins: { LocalNotifications: LN, InAppReview: IAR } };
        localStorage.setItem('dp.onboarded', '1'); tourIdx = -1;
        overlays.forEach(el => el.classList.remove('on'));

        fresh(); seed(7, 8); save();
        ok('review ask: nothing during the save itself (the save\'s own "Saved ✓" comes first)', calls === 0 && !!_reviewAskTimer);
        ok('review ask: shows on the 7th hand-logged day with a good mood', flush() && calls === 1, calls);
        ok('review ask: dp.reviewAsk is written BEFORE the plugin is called', !!seen && seen.n === 1 && seen.last > Date.now() - 60000, seen);

        fresh(); seed(6, 8); save();
        ok('review ask: not on day 6', !flush() && calls === 0 && reviewAskDue() === 0 && localStorage.getItem('dp.reviewAsk') === null);
        fresh(); seed(7, 5); save();
        ok('review ask: not with mood 5', !flush() && calls === 0 && reviewAskDue() === 0);
        fresh(); seed(7, 8);
        const se = DB.entriesRO(); Object.keys(se).forEach(d => { if (d !== TD) se[d].sample = true; });
        localStorage.setItem('dp.entries', JSON.stringify(se));
        ok('review ask: sample (demo) days do not count as logged', reviewAskDue() === 0);

        fresh(); seed(7, 8); window.Capacitor = { Plugins: { LocalNotifications: LN } };
        let webErr = false; try { save(); flush(); } catch (e) { webErr = true; }
        ok('review ask: not without the plugin (builds ≤121), and no error', !webErr && calls === 0 && localStorage.getItem('dp.reviewAsk') === null);
        window.Capacitor = undefined;
        ok('review ask: never on the plain web', reviewAskDue() === 0);
        window.Capacitor = { Plugins: { LocalNotifications: LN, InAppReview: IAR } };
        localStorage.removeItem('dp.onboarded');
        ok('review ask: not before onboarding is done', reviewAskDue() === 0);
        localStorage.setItem('dp.onboarded', '1'); tourIdx = 0;
        ok('review ask: not while the tour runs', reviewAskDue() === 0);
        tourIdx = -1;

        fresh(); seed(7, 8); save();
        const ms = document.getElementById('milestone') || (() => { const d = document.createElement('div'); d.id = 'milestone'; document.body.appendChild(d); overlays.push(d); ovSnap.push(false); return d; })();
        ms.classList.add('on'); flush(); ms.classList.remove('on');
        ok('review ask: skipped while a celebration is on screen, without spending the ask', calls === 0 && reviewAskState().n === 0 && reviewAskDue() === 1);

        fresh(); setAsk(1, 59); seed(40, 8); save();
        ok('review ask: not twice within 60 days', !flush() && calls === 0 && reviewAskDue() === 0);
        fresh(); setAsk(1, 61); seed(29, 8); save();
        ok('review ask: second ask needs 30 logged days, not just 60 days', !flush() && calls === 0 && reviewAskDue() === 0);
        fresh(); setAsk(1, 61); seed(30, 8); save();
        ok('review ask: second ask after 60+ days and 30+ logged days', flush() && calls === 1 && seen && seen.n === 2, seen);
        fresh(); setAsk(2, 400); seed(100, 9); save();
        ok('review ask: never a third time', !flush() && calls === 0 && reviewAskDue() === 0);

        fresh(); seed(7, 8); mode = 'throw';
        let threw = false; try { save(); flush(); } catch (e) { threw = true; }
        ok('review ask: a throwing plugin does not break the save', !threw && calls === 1 && (DB.entry(TD) || {}).mood === 8 && reviewAskState().n === 1);
        fresh(); seed(7, 8); mode = 'reject';
        threw = false; try { save(); flush(); } catch (e) { threw = true; }
        ok('review ask: a plugin that rejects does not throw either', !threw && calls === 1 && reviewAskState().n === 1);
        // one budget with the older rate card (dp.rateAsk)
        fresh(); seed(40, 8); localStorage.setItem('dp.rateAsk', JSON.stringify({ asks: 1, last: Date.now() - 10 * DAY, done: false }));
        ok('review ask: an earlier rate-card ask counts: the sheet waits 60 days from it', reviewAskDue() === 0);
        localStorage.setItem('dp.rateAsk', JSON.stringify({ asks: 1, last: Date.now() - 61 * DAY, done: false }));
        save();
        ok('review ask: …then it is the second and last ask', flush() && calls === 1 && reviewAskDue() === 0 && reviewAskState().n === 1, reviewAskState());
        fresh(); seed(40, 8); localStorage.setItem('dp.rateAsk', JSON.stringify({ asks: 1, last: Date.now() - 400 * DAY, done: true }));
        ok('review ask: never after a tap on the rate card\'s Rate button', reviewAskDue() === 0);
        fresh(); seed(40, 8); localStorage.setItem('dp.rateAsk', JSON.stringify({ asks: 2, last: Date.now() - 400 * DAY, done: false }));
        ok('review ask: never after the rate card was shown twice', reviewAskDue() === 0);
        fresh(); seed(40, 8); maybeAskForReview();
        const rcard = document.getElementById('rate-ask');
        ok('rate card: stands aside when Play\'s in-app sheet is available', !(rcard && rcard.classList.contains('on')) && rateState().asks === 0, rateState());
        ok('review ask: the counter is install-local, not backed up', BACKUP_EXCLUDED.includes('reviewAsk') && !BACKUP_KEYS.includes('reviewAsk'));
      } finally {
        if (_reviewAskTimer) { clearTimeout(_reviewAskTimer); _reviewAskTimer = null; }
        window.Capacitor = capSnap2; tourIdx = tourSnap;
        overlays.forEach((el, i) => el.classList.toggle('on', !!ovSnap[i]));
        rsn.forEach(([k, v]) => { if (v != null) localStorage.setItem(k, v); else localStorage.removeItem(k); });
      }
    }
  })();

  /* ---- Recordings (2026-11-22): the pure parts. The IndexedDB, recorder and native-plugin
     flows are in tests/unit-async.js. ---- */
  (function () {
    // durations and sizes
    ok('rec length: 0 → 0:00', fmtRecLen(0) === '0:00', fmtRecLen(0));
    ok('rec length: 5.4 s → 0:05 (floored: a live timer never jumps back)', fmtRecLen(5400) === '0:05' && fmtRecLen(59999) === '0:59', [fmtRecLen(5400), fmtRecLen(59999)]);
    ok('rec length: 12:34', fmtRecLen(754000) === '12:34', fmtRecLen(754000));
    ok('rec length: over an hour shows hours, 1:02:03', fmtRecLen(3723000) === '1:02:03' && fmtRecLen(3 * 3600000) === '3:00:00', [fmtRecLen(3723000), fmtRecLen(3 * 3600000)]);
    ok('rec length: junk and negatives are 0:00', fmtRecLen(-5) === '0:00' && fmtRecLen(NaN) === '0:00' && fmtRecLen(undefined) === '0:00');
    ok('rec size: uses the app\'s byte format', fmtBytes(2202010) === '2.1 MB' && fmtBytes(5000) === '5 KB', fmtBytes(2202010));

    // names
    const at = (h, m) => new Date(2026, 10, 22, h, m).getTime();
    ok('rec default name: "Recording · 9:40 pm"', recTitle({ ts: at(21, 40) }) === 'Recording · 9:40 pm', recTitle({ ts: at(21, 40) }));
    ok('rec clock: midnight and noon read 12', recClock(at(0, 5)) === '12:05 am' && recClock(at(12, 0)) === '12:00 pm', [recClock(at(0, 5)), recClock(at(12, 0))]);
    const r0 = { id: 'r1', ts: at(9, 7), day: '2026-11-22', state: 'done' };
    const rn = recRenamed(r0, '  Walk   with   Asha ');
    ok('rename: spaces are tidied and the original is not changed', rn.title === 'Walk with Asha' && r0.title === undefined && rn.id === 'r1', rn);
    ok('rename: an empty name goes back to the default', recRenamed(rn, '   ').title === undefined && recTitle(recRenamed(rn, '')) === 'Recording · 9:07 am');
    ok('rename: typing the default name back stores no name', recRenamed(r0, 'Recording · 9:07 am').title === undefined);
    ok('rename: at most 80 characters', recRenamed(r0, 'x'.repeat(200)).title.length === 80);

    // which day
    const T = todayStr();
    ok('move: to an earlier day gives a copy on that day', (recMoved(r0, '2026-01-05', T) || {}).day === '2026-01-05' && r0.day === '2026-11-22');
    ok('move: not to a future day, nor to junk', recMoved(r0, addDays(T, 1), T) === null && recMoved(r0, '2026-13-45', T) === null && recMoved(r0, 'soon', T) === null && recMoved(r0, '', T) === null);
    ok('move: today is fine', (recMoved(r0, T, T) || {}).day === T);

    // the list
    const L = [
      { id: 'a', day: '2026-11-20', ts: 100, state: 'done' }, { id: 'b', day: '2026-11-22', ts: 300, state: 'done' },
      { id: 'c', day: '2026-11-22', ts: 500, state: 'done' }, { id: 'd', day: '2026-11-22', ts: 900, state: 'live' },
      { id: 'e', day: '2026-11-21', ts: 200, state: 'done', del: Date.now() }, null];
    const G = recGroups(L);
    ok('list: grouped by day, newest day first', G.map(g => g.day).join() === '2026-11-22,2026-11-20', G.map(g => g.day));
    ok('list: newest recording first within a day', G[0].items.map(r => r.id).join() === 'c,b', G[0].items.map(r => r.id));
    ok('list: a recording still going, or waiting out its Undo, is not listed', !G.some(g => g.items.some(r => r.id === 'd' || r.id === 'e')));
    ok('list: empty in, empty out', recGroups([]).length === 0 && recGroups(undefined).length === 0);

    // the live timer and the cap
    ok('elapsed: paused counts only what was recorded', recElapsed({ state: 'paused', acc: 61000, from: 0 }, 999999) === 61000);
    ok('elapsed: recording adds the current run', recElapsed({ state: 'recording', acc: 1000, from: 5000 }, 9000) === 5000);
    ok('elapsed: nothing live is 0', recElapsed(null) === 0);
    ok('cap: three hours with a warning ten minutes before', recCapState(0) === 'ok' && recCapState(REC_WARN_MS - 1) === 'ok' && recCapState(REC_WARN_MS) === 'warn'
      && recCapState(REC_MAX_MS - 1) === 'warn' && recCapState(REC_MAX_MS) === 'stop' && REC_MAX_MS === 3 * 3600000);

    // the widget / shortcut queue
    const n = Date.now();
    let q = widgetRecordRoute([{ action: 'record', at: n - 5000 }], n);
    ok('record tap: a fresh one opens Recordings and starts recording', q.open && q.start, q);
    q = widgetRecordRoute([{ action: 'record', at: n - 3 * 60000 }], n);
    ok('record tap: one older than two minutes only opens the screen', q.open && !q.start, q);
    q = widgetRecordRoute([{ action: 'record' }], n);
    ok('record tap: one with no time only opens the screen', q.open && !q.start, q);
    q = widgetRecordRoute([{ action: 'record', at: n + 86400000 }], n);
    ok('record tap: one stamped in the future (a clock change) counts as now', q.open && q.start, q);
    q = widgetRecordRoute([{ action: 'record', at: n - 9 * 60000 }, { action: 'record', at: n - 1000 }, { action: 'record', at: n - 2000 }], n);
    ok('record taps: several queued start ONE recording', q.open && q.start === true && Object.keys(q).length === 2, q);
    q = widgetRecordRoute([{ action: 'mood', mood: 7, at: n }, { action: 'open', at: n }, null, 7, 'record'], n);
    ok('record route: mood taps, other actions and junk are not record taps', !q.open && !q.start, q);
    ok('record route: an empty or missing queue is nothing', !widgetRecordRoute([]).open && !widgetRecordRoute(undefined).open);
    // mood taps go through widgetTapsApply exactly as before; the drain filters record taps out first
    const eSnap = localStorage.getItem('dp.entries');
    try {
      let n2 = Date.now(); if (todayStr(new Date(n2 - 10000)) !== todayStr(new Date(n2))) n2 -= 11000;
      const D2 = todayStr(new Date(n2)), mixed = [{ action: 'record', at: n2 - 1000 }, { action: 'mood', mood: 7, at: n2 - 2000 }];
      const ents = DB.entries(); delete ents[D2]; DB.saveEntries(ents);
      const wr = widgetTapsApply(mixed.filter(x => !(x && x.action === 'record')), n2);
      ok('record + mood in one queue: the mood is saved as before', (DB.entry(D2) || {}).mood === 7 && wr.saved.length === 1 && wr.any, wr);
      ok('…and a queue of only record taps saves no mood and does not open the Log', !widgetTapsApply([{ action: 'record', at: n2 }].filter(x => !(x && x.action === 'record')), n2).any);
    } finally { if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries'); }

    // crash recovery
    const B = s => new Blob([s]);
    const ch = (rid, seq, s, ms) => ({ k: rid + ':' + seq, rid, seq, blob: B(s), ms });
    let pl = recRecoverPlan({ id: 'rA' }, [ch('rA', 2, 'cc', 12000), ch('rA', 0, 'aaaa', 4000), ch('rB', 0, 'zz', 4000), ch('rA', 1, 'bbb', 8000), ch('rA', 1, 'bbb', 8000)]);
    ok('recovery: slices in order, each once, only this recording\'s', pl.parts.length === 3 && pl.bytes === 9 && pl.keep, pl.bytes);
    ok('recovery: the length is the time stamped on the last slice', pl.dur === 12000, pl.dur);
    pl = recRecoverPlan({ id: 'rA' }, [ch('rA', 0, 'aaaa', 0), ch('rA', 1, 'bb', 0)]);
    ok('recovery: no stamps → slices × slice length', pl.dur === 2 * REC_SLICE_MS, pl.dur);
    ok('recovery: nothing on disk is not kept', !recRecoverPlan({ id: 'rA' }, []).keep && !recRecoverPlan({ id: 'rA' }, [ch('rA', 0, '', 4000)]).keep && !recRecoverPlan({ id: 'rA' }, null).keep);
    ok('recovery: a mis-tap (under 0.7 s) is not kept', !recRecoverPlan({ id: 'rA' }, [ch('rA', 0, 'a', 300)]).keep);

    // the transcript into the journal
    const blk = recTrBlock({ ts: at(21, 40) }, '  I walked to the lake.  ');
    ok('transcript paragraph: the recording\'s name, then the words', blk === '🎙️ Recording · 9:40 pm\nI walked to the lake.', blk);
    ok('transcript paragraph: no words, no paragraph', recTrBlock({ ts: 1 }, '   ') === '');
    ok('journal merge: into an empty journal it is the journal', recJournalMerge('', '', 'X') === 'X');
    ok('journal merge: after what is there, with one blank line', recJournalMerge('Morning.\n\n  ', '', 'X') === 'Morning.\n\nX');
    ok('journal merge: an edited transcript replaces its old paragraph, not a second copy', recJournalMerge('A\n\nOLD\n\nB', 'OLD', 'NEW') === 'A\n\nNEW\n\nB');
    ok('journal merge: if the old paragraph was changed by hand, the new one is added', recJournalMerge('A\n\nOLD edited', 'OLD!', 'NEW') === 'A\n\nOLD edited\n\nNEW');
    ok('journal merge: emptied, it takes its paragraph out cleanly', recJournalMerge('A\n\nOLD', 'OLD', '') === 'A' && recJournalMerge('OLD\n\nB', 'OLD', '') === 'B' && recJournalMerge('OLD', 'OLD', '') === '');
    ok('journal merge: a $ in the words is kept as typed', recJournalMerge('A\n\nOLD', 'OLD', 'cost $& and $1') === 'A\n\ncost $& and $1');

    const eSnap2 = localStorage.getItem('dp.entries'), logSnap = logDate;
    try {
      const D = addDays(todayStr(), -2);
      const ents = DB.entries(); ents[D] = { mood: 6, journal: 'Morning walk.', habits: {}, updatedAt: new Date(Date.now() - 60000).toISOString() }; DB.saveEntries(ents);
      logDate = D; loadDraft();
      const r = { id: 'rT', ts: at(21, 40), day: D, title: 'Evening' };
      let res = recTranscriptToDay(r, 'Talked about the week.');
      ok('add transcript: appended to that day\'s journal through the Log save path', (DB.entry(D) || {}).journal === 'Morning walk.\n\n🎙️ Evening\nTalked about the week.' && res.ok && res.changed, DB.entry(D));
      ok('…keeping the rest of the day and stamping the edit', DB.entry(D).mood === 6 && Date.parse(DB.entry(D).updatedAt) > Date.now() - 5000);
      ok('…and the Log open on that day shows it', draft.journal === DB.entry(D).journal);
      Object.assign(r, { trBlock: res.block, trDay: D });
      res = recTranscriptToDay(r, 'Talked about the week. And Sunday.');
      ok('edit transcript: replaced in the journal, not added twice', DB.entry(D).journal === 'Morning walk.\n\n🎙️ Evening\nTalked about the week. And Sunday.', DB.entry(D).journal);
      Object.assign(r, { trBlock: res.block });
      res = recTranscriptToDay(r, '');
      ok('empty transcript: its paragraph comes out of the journal', DB.entry(D).journal === 'Morning walk.' && res.block === '', DB.entry(D).journal);
      const D3 = addDays(todayStr(), -3); const e3 = DB.entries(); delete e3[D3]; DB.saveEntries(e3);
      recTranscriptToDay({ id: 'rU', ts: at(8, 0), day: D3 }, 'First words.');
      ok('add transcript: a day with nothing logged gets a journal', (DB.entry(D3) || {}).journal === '🎙️ Recording · 8:00 am\nFirst words.', DB.entry(D3));
      ok('recordings write no dp.* key (they are in IndexedDB, out of backups and sync)', !Object.keys(localStorage).some(k => /^dp\.rec/i.test(k)));
    } finally {
      if (eSnap2 != null) localStorage.setItem('dp.entries', eSnap2); else localStorage.removeItem('dp.entries');
      logDate = logSnap; loadDraft();
    }

    // files, storage, backups
    ok('file name: day, name and the container', recFileName({ day: '2026-11-22', ts: at(21, 40), mime: 'audio/webm;codecs=opus' }) === 'daylog-2026-11-22-recording-9-40-pm.webm'
      && recFileName({ day: '2026-11-22', ts: 1, title: 'Lake / Asha!', mime: 'audio/mp4' }) === 'daylog-2026-11-22-lake-asha.m4a', recFileName({ day: '2026-11-22', ts: at(21, 40), mime: 'audio/webm' }));
    ok('recordings have their own database, apart from photos', REC_DB !== MEDIA_DB && !BACKUP_KEYS.some(k => /^rec/i.test(k)) && !BACKUP_EXTRA.some(k => /rec/i.test(k)));
    _recs.set('rS', { id: 'rS', src: 'native', state: 'done', ts: 1, day: '2026-11-22', size: 3 * 1048576, dur: 600000 });
    try {
      const row = storageRows().rows.find(x => x.k === 'recordings');
      ok('Storage: a Recordings row, said to be not in backups', !!row && row.bytes === 3 * 1048576 && /not in backups/.test(row.sub) && /10:00/.test(row.sub), row);
      ok('Storage: recordings are not counted as backed-up media', mediaTotals().bytes < 3 * 1048576);
      ok('backup file: no recording in it', !JSON.stringify(backupBlob().data).includes('rS'));
      const ws = _wipeStage; _wipeStage = 1;
      try { ok('Delete everything warns that recordings are in no backup', /1 recording<\/b>|1 recording is in no backup/.test(wipeStageHTML()) && /in no backup/.test(wipeStageHTML()), wipeStageHTML().slice(0, 0)); }
      finally { _wipeStage = ws; }
    } finally { _recs.delete('rS'); }

    // the screen, the menu and the Log
    show('recordings');
    ok('Recordings screen renders with a Record button', !!document.querySelector('#s-recordings [data-rec-start]') && document.getElementById('screen-title').textContent === 'Recordings');
    const idbS = window.indexedDB; window.indexedDB = {};   // jsdom has none; the list only needs to think it can store
    try { ok('…and its list says recordings stay on this phone, out of backups', /stay on this phone/.test(recListHTML()) && /not in backup files/.test(recListHTML()) && /No recordings yet/.test(recListHTML())); }
    finally { if (idbS === undefined) delete window.indexedDB; else window.indexedDB = idbS; }
    renderDrawer();
    ok('☰ menu lists Recordings', !!document.querySelector('#drawer-list [data-screen="recordings"]'));
    navigateTo('today');
    ok('the Log has a Record button next to Speak', !!document.querySelector('#s-today .jr-acts [data-rec-open]') && !!document.querySelector('#s-today .jr-acts [data-mic]'));
  })();

  if (snapshot != null) localStorage.setItem('dp.tasks', snapshot); else localStorage.removeItem('dp.tasks');

  const summary = { pass, fail, results: R };
  console.log('UNIT TESTS: ' + pass + ' passed, ' + fail + ' failed');
  R.forEach(r => console.log(r));
  window.__testSummary = summary;
  return summary;
})();
