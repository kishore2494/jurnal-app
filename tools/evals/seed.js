/* Eval seed. Deliberately adversarial: long habit labels, a skipped habit, a quantity
   habit with a unit, and a big streak number — the combinations that overflow chips. */
(function () {
  const t = todayStr(), e = {};

  /* Health fixture. The old version wrote sleepMin: 420 every single day — zero variance,
     so every sensor correlation and every health insight was silently untestable. These are
     generated with a fixed-seed Lehmer PRNG (identical numbers on every run) and carry real,
     KNOWN relationships so the detectors have something true to find:
        active day       -> longer sleep the FOLLOWING night
        heavy screen day -> shorter sleep the following night
        short sleep      -> higher heart rate
        active day       -> better mood the next day
     Weekday/weekend split keeps the spread realistic rather than uniform noise. */
  const HD = 90;
  let _s = 1234567;
  const rnd = () => { _s = (_s * 48271) % 2147483647; return _s / 2147483647; };
  const stepsBy = {}, screenBy = {}, sleepBy = {}, hrBy = {};
  for (let i = HD; i >= 0; i--) {
    const wd = new Date(addDays(t, -i) + 'T00:00:00').getDay(), we = wd === 0 || wd === 6;
    stepsBy[i]  = Math.round((we ? 3800 : 6200) + rnd() * 5600);
    screenBy[i] = Math.round((we ? 250 : 165) + rnd() * 170);
  }
  for (let i = HD; i >= 0; i--) {
    const prev = i + 1;                            // the calendar day BEFORE day i
    sleepBy[i] = Math.round(432
      + (stepsBy[prev] > 8000 ? 24 : 0)            // yesterday's activity
      - (screenBy[prev] > 300 ? 34 : 0)            // yesterday's screen time
      + rnd() * 40 - 20);
    hrBy[i] = Math.round((sleepBy[i] < 430 ? 68 : 63) + rnd() * 4);
  }

  const cfg = [
    { key: 'workout',     emoji: '🏋️', label: 'Workout' },
    { key: 'meditation',  emoji: '🧘', label: 'Meditation' },
    { key: 'reading',     emoji: '📖', label: 'Read 20 pages before bed', goal: { n: 20, cmp: 'atleast', unit: 'pages' } },
    { key: 'healthyFood', emoji: '🥗', label: 'Healthy food' },
    { key: 'noPhone',     emoji: '📵', label: 'No phone in the first hour', custom: true },
    { key: 'water',       emoji: '💧', label: 'Water', custom: true, goal: { n: 8, cmp: 'atleast', unit: 'glasses' } },
    { key: 'coffee',      emoji: '☕', label: 'Coffee', custom: true, goal: { n: 2, cmp: 'atmost', unit: 'cups' } },
  ];
  localStorage.setItem('dp.habitcfg', JSON.stringify(cfg));
  for (let i = 200; i >= 0; i--) {
    const d = addDays(t, -i), w = i % 7 !== 2;
    const lift = (i < HD && stepsBy[i + 1] > 8000) ? 1 : 0;   // yesterday's walk shows up today
    e[d] = { mood: Math.min(10, 4 + (i % 6) + lift), energy: Math.min(10, 4 + (i % 5) + lift),
      sleepHours: i <= HD ? +(sleepBy[i] / 60).toFixed(1) : 6.5 + (i % 4) * 0.3,
      // These MUST match the real FIELDS keys. The old seed wrote `deepWork`, which is not a
      // field, so deep-work charts and correlations were never exercised by any eval run.
      deepWorkHours: +(2 + (i % 3) + (i <= HD && stepsBy[i] > 8000 ? 1 : 0)).toFixed(1),
      screenTime: i <= HD ? +(screenBy[i] / 60).toFixed(1) : 3 + (i % 4),
      tasksDone: 2 + (i % 4), tasksPlanned: 5,
      journal: i % 5 === 0 ? 'A reasonably long journal entry with #tags to exercise wrapping.' : '',
      habits: { workout: w, meditation: i % 3 !== 0, reading: 14 + (i % 9),
                healthyFood: true, noPhone: i % 9 === 0 ? 0 : (i % 4 !== 0),
                water: 5 + (i % 4), coffee: i % 5 } };
  }
  e[t].habits.noPhone = 0;             // a SKIPPED chip must be on screen
  e[t].habits.workout = true;
  localStorage.setItem('dp.entries', JSON.stringify(e));
  const hs = {}, tl = [];
  for (let i = HD; i >= 0; i--) {
    const d = addDays(t, -i), d0 = new Date(d + 'T00:00:00').getTime();
    const st = stepsBy[i];
    hs[d] = { steps: st, distanceKm: +(st * 0.00072).toFixed(2),
              calories: 1750 + Math.round(st * 0.042), sleepMin: sleepBy[i],
              exerciseMin: st > 8000 ? 28 + Math.round(rnd() * 32) : Math.round(rnd() * 22),
              hr: hrBy[i], screenMin: screenBy[i], at: new Date().toISOString() };
    tl.push({ id: 'ev' + i + 'a', act: 'sleep', start: d0 - 3e6, end: d0 + 2.4e7, upd: d0 });
    tl.push({ id: 'ev' + i + 'b', act: 'work', start: d0 + 3.4e7, end: d0 + 4.4e7, upd: d0 });
  }
  localStorage.setItem('dp.health', JSON.stringify(hs));
  localStorage.setItem('dp.timelog', JSON.stringify(tl));
  localStorage.setItem('dp.tasks', JSON.stringify([
    { id: 'e1', text: 'A task with a deliberately long title to test wrapping and clipping', done: false, date: t },
    { id: 'e2', text: 'Short task', done: true, date: t }]));
  return 'eval seed ok';
})();
