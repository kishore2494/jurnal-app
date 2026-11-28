/* Daylog — seeded fuzz test of the two-/three-phone sync.

   Runs INSIDE the page, like tests/unit.js: tools/check-sync-fuzz.mjs loads the real index.html
   and app.js in jsdom and evaluates this file there. Every phone is driven through the REAL save
   paths (saveDraftNow, DB.saveTasks / saveNotes → listSave, startAct / DB.saveTimelog /
   timelogForget + syncTimelogNow, persistGym) and the REAL pushState / applyRemoteState merge.
   Nothing in the merge is copied or mocked.

   The world
   ---------
   * 2 or 3 phones. A phone is every dp.* localStorage key plus the bit of memory that matters
     (_tlDirty), swapped in when that phone acts — the `use(p)` / `held()` pattern of the
     two-phone tests in tests/unit.js, over all dp.* keys.
   * The Sheet is what google-apps-script/Code.gs is: the text of the LAST state push it received,
     handed back whole on a pull. window.fetch is the Sheet's inbox; only `type: 'state'` posts
     matter, the readable tabs (entry, timelog …) are accepted and dropped.
   * Date is a fake clock: one shared time T plus a per-phone skew (up to ±10 min in half the
     runs). Every stamp the merge compares comes from Date.now() / new Date(), so the whole run is
     deterministic. T only moves in steps of 3 ms and phone i's skew is ≡ i (mod 3), so two phones
     can never write the same millisecond: an exact cross-phone stamp tie is a coincidence the
     real world does not produce, and would otherwise be noise here.

   What happens in a run (seeded, so a seed always replays the same run)
   ---------------------------------------------------------------------
   Warm-up: phone A holds a little data (tasks, notes, two days, time blocks, a gym tick), pushes,
   and every phone pulls, so they start linked and in sync, as real phones do. Then 10–45 random
   operations, each on a random phone:
     edits   mood, journal (saveDraftNow, as the Log autosave does); a habit tick / skip / clear
             (habitsAt stamp + saveDraftNow, as the Habits screen does); tasks and notes add /
             edit / tick / delete / reorder; time blocks start / switch / stop (startAct), add,
             edit, delete (timelogForget), each followed by the debounced syncTimelogNow that
             re-sums the day's timeSummary — or, sometimes, the app is killed before it fires;
             gym ticks, un-ticks and logs (persistGym).
     sync    pull (apply the Sheet now); pull-start / pull-end (the reply is applied later, after
             this phone and others did more — the JSONP round trip); stale pull (an older Sheet
             version); the 1.2 s push debounce firing; going offline / online (pushes fail); a slow
             network (pushes held in flight) and the network delivering a held push late, out of
             order, over a newer one.
   Then everyone syncs: every phone online, held pushes delivered, open pulls land, and every phone
   pulls round after round until a whole round sends nothing.

   Invariants checked after that
   -----------------------------
     no-crash     applyRemoteState and the save paths never throw, no section "in the wrong shape"
     settle       the pull rounds stop pushing within MAX_ROUNDS
     quiet        one more full round of pulls pushes nothing and changes nothing (no ping-pong)
     converge     every phone pushes the identical payload (canonJSON, section by section), and
                  the Sheet holds the same data; the stamp maps (listAt/listDel/gymAt/timelogDel)
                  agree on every phone
     dup-id       no list and no time log holds the same id twice
     no-loss      an item / block / habit / gym key / day field whose latest change (by stamp) was
                  a write holds exactly what that write wrote
     no-zombie    an item / block whose latest change was a delete exists nowhere
     derived      each day's timeSummary is what re-summing the merged time log gives (days with a
                  running timer skipped: that line depends on "now"), and each gym day's
                  workoutsDone is the number of ticks the merged gym day holds
   "Latest" is by stamp, in the clock of the phone that wrote it — which is what the merge
   compares; under skew the property is about stamps, not wall time. Day fields and habits use the
   stamp the app wrote (fieldAt / habitsAt): since 2026-11-22 an edit is stamped after the stamp it
   replaces even on a phone whose clock is behind (max(now, old + 1)), so an edit made after seeing a
   value wins over it, as it should. A time block the merge itself
   closed (two phones each had a timer running) is a machine write and is left out of no-loss /
   no-zombie.

   A violation the app is known to have is tagged with a KNOWN id (see KNOWN below): it is reported
   but does not fail the run, unless strict is set. Anything else fails.

   Bite proof (2026-11-21, DAYLOG_ROOT on scratch copies of app.js): ten deliberate merge bugs —
   list deletes ignored, block tombstones ignored, local habit always wins, no re-sum after a pull,
   every pull pushes, older gym tick wins, older list item wins, entries compared as plain JSON
   (key-order ping-pong), newer block loses, and the list half of remoteBehind removed. The first
   nine fail within 40 seeds. The last survived 600: in every interleaving generated here a phone
   holding list items the Sheet lacks also has a newer dp.touched or another section behind, so
   that check is redundant here; not covered: plans (planItems), the other LIST_SYNC stores, the
   settings-like stores, older-app (unstamped) states and restores.

   Config (window.__syncFuzz): { seed, seeds, trace, strict, shrink }. Returns
   { seeds, ops, pushes, fails: [...], known: {...}, ms }. */
(function () {
  const cfg = Object.assign({ seed: 1, seeds: 50, trace: false, strict: false, shrink: true }, window.__syncFuzz || {});
  const MAX_ROUNDS = 6;
  const SKEW_MAX = 10 * 60 * 1000;
  const DAY_MS = 864e5;
  const DEBOUNCE = 1200;   // pushState's debounce
  const STORES = ['tasks', 'notes'];
  const MANUAL = ['mood', 'journal'];
  /* Violations the app is known to have (found by this fuzzer, reported, not yet fixed). Each is a
     function of a failure record; a match tags it instead of failing the run. */
  const KNOWN = {
    /* None open. Fixed 2026-11-22: day-lww-stale-save and day-lww-gap-fill (per-field stamps,
       fieldAt / mergeFields), gym-count-not-rederived (gymRederive), summary-stale-after-kill
       (dp.tlDirty). A new one goes here as { id: { match: f => … } } with a comment saying why. */
  };

  /* ---------------- deterministic clock ---------------- */
  const RealDate = Date;
  let T = 0, cur = null;
  const phones = {};
  const fakeNow = () => T + (cur && phones[cur] ? phones[cur].skew : 0);
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(fakeNow()); }
    static now() { return fakeNow(); }
  }
  const T0 = (() => { const t = new RealDate(2026, 5, 15, 12, 0, 0).getTime(); return t - (t % 3); })();   // local noon: no day flips mid-run
  const DAYS = [-2, -1, 0].map(d => todayStr(new RealDate(T0 + d * DAY_MS)));

  /* ---------------- the Sheet and the network ---------------- */
  const SHEET = { state: null, hist: [], log: [] };
  const net = { inflight: [], capture: null, sent: 0 };
  let toasts = [];
  function deliver(phone, body) { SHEET.state = body; SHEET.hist.push(body); SHEET.log.push(phone); }
  function fakeFetch(url, o) {
    const ph = phones[cur], body = o && typeof o.body === 'string' ? o.body : null;
    let b = null; try { b = body ? JSON.parse(body) : null; } catch (e) { b = null; }
    if (b && b.type === 'state') {
      if (net.capture) { net.capture.push(b); return Promise.resolve({ ok: true }); }
      if (!ph || !ph.online) return Promise.reject(new Error('offline'));
      net.sent++;
      if (ph.lag) net.inflight.push({ phone: cur, body }); else deliver(cur, body);
      return Promise.resolve({ ok: true });
    }
    if (ph && !ph.online) return Promise.reject(new Error('offline'));
    return Promise.resolve({ ok: true });
  }

  /* ---------------- phones: localStorage snapshots + the memory that matters ---------------- */
  const dpKeys = () => { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('dp.') === 0) ks.push(k); } return ks; };
  const held = () => { const o = {}; dpKeys().forEach(k => { o[k] = localStorage.getItem(k); }); return o; };
  const load = (o) => { dpKeys().forEach(k => localStorage.removeItem(k)); Object.keys(o).forEach(k => localStorage.setItem(k, o[k])); };
  let base = null;
  function fresh() {
    const o = Object.assign({}, base);
    ['dp.touched', 'dp.listAt', 'dp.listDel', 'dp.timelogDel', 'dp.timelog', 'dp.entries', 'dp.gym', 'dp.gymAt', 'dp.tlDirty'].concat(STORES.map(s => 'dp.' + s)).forEach(k => delete o[k]);
    const st = JSON.parse(o['dp.settings'] || '{}'); st.syncUrl = 'https://sheet.invalid/exec'; o['dp.settings'] = JSON.stringify(st);
    return o;
  }
  /* Put the phone in hand down: its debounced push fires (it keeps living while we look at
     another phone, and pagehide flushes anyway), and it keeps what it holds. */
  function park() {
    if (cur === null) return;
    flushPush();
    const ph = phones[cur];
    ph.ls = held(); ph.dirty = [..._tlDirty]; _tlDirty.clear();
  }
  function use(name) {
    if (cur === name) return;
    park(); cur = name;
    const ph = phones[name];
    load(ph.ls); ph.dirty.forEach(d => _tlDirty.add(d));
  }

  /* ---------------- PRNG (mulberry32) ---------------- */
  let s32 = 1;
  const rnd = () => { s32 |= 0; s32 = s32 + 0x6D2B79F5 | 0; let t = Math.imul(s32 ^ s32 >>> 15, 1 | s32); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const irnd = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const at = (arr, f) => arr[Math.min(arr.length - 1, Math.floor(f * arr.length))];

  /* ---------------- generating a run (pure data, so it can be replayed and shrunk) ---------------- */
  const ACTS = ['work', 'gymt', 'learn', 'travel'];
  const SYNC_OPS = [['pull', 12], ['pullStart', 4], ['pullEnd', 4], ['stale', 3], ['flush', 3], ['offline', 4], ['lag', 3], ['deliver', 3]];
  const EDIT_OPS = [['mood', 8], ['journal', 7], ['habit', 10], ['task', 10], ['note', 7], ['tl', 15], ['gym', 8], ['cfg', 4]];
  const KINDS = SYNC_OPS.concat(EDIT_OPS), KSUM = KINDS.reduce((s, k) => s + k[1], 0);
  function gen(seed) {
    s32 = seed;
    const n = rnd() < 0.5 ? 2 : 3, withSkew = rnd() < 0.5;
    const names = ['A', 'B', 'C'].slice(0, n);
    const skew = {}; names.forEach((p, i) => { skew[p] = (withSkew && i ? 3 * irnd(-SKEW_MAX / 3, SKEW_MAX / 3) : 0) + i; });
    const steps = irnd(10, 45), ops = [];
    for (let i = 0; i < steps; i++) {
      let r = rnd() * KSUM, k = KINDS[0][0];
      for (const [name, w] of KINDS) { if (r < w) { k = name; break; } r -= w; }
      // dt: mostly seconds to a minute; sometimes under the push debounce, so a pull can land
      // while this phone's own push is still waiting
      ops.push({ p: at(names, rnd()), k, dt: 3 * (rnd() < 0.15 ? irnd(100, 390) : irnd(400, 20000)), r: [rnd(), rnd(), rnd(), rnd()] });
    }
    return { seed, names, skew, ops };
  }

  /* ---------------- truth: the latest change to everything, by stamp ---------------- */
  let truth, machine, trace, fails, counters, killedDays;
  function stampIt(bag, key, rec) { const prev = bag[key]; if (!prev || rec.stamp >= prev.stamp) bag[key] = rec; }
  const ids = l => new Map((Array.isArray(l) ? l : []).filter(x => x && x.id != null).map(x => [String(x.id), JSON.stringify(x)]));
  const readList = s => { const v = safeParse(localStorage.getItem('dp.' + s), []); return Array.isArray(v) ? v : []; };
  /* What one local operation changed, recorded as the truth with this phone's stamp. Taken as a
     before/after diff of what the real save path stored, so the bookkeeping cannot drift from
     what the app actually wrote. */
  function before() {
    const o = { lists: {}, tl: ids(DB.timelog()), entries: DB.entries(), gym: objOf(DB.gym()), cfg: canonJSON(habitCfg()) };
    STORES.forEach(s => { o.lists[s] = ids(readList(s)); });
    return o;
  }
  function record(b, why) {
    const p = cur, now = Date.now();
    STORES.forEach(s => {
      const a = ids(readList(s));
      a.forEach((j, id) => { if (b.lists[s].get(id) !== j) stampIt(truth.list[s], id, { stamp: now, phone: p, del: false, json: j }); });
      b.lists[s].forEach((j, id) => { if (!a.has(id)) stampIt(truth.list[s], id, { stamp: now, phone: p, del: true }); });
    });
    const tl = ids(DB.timelog());
    tl.forEach((j, id) => { if (b.tl.get(id) !== j) stampIt(truth.tl, id, { stamp: now, phone: p, del: false, json: j }); });
    b.tl.forEach((j, id) => { if (!tl.has(id)) stampIt(truth.tl, id, { stamp: now, phone: p, del: true }); });
    const e = DB.entries();
    DAYS.forEach(d => {
      const x = objOf(e[d]), y = objOf(b.entries[d]);
      MANUAL.forEach(f => { if (JSON.stringify(x[f]) !== JSON.stringify(y[f])) stampIt(truth.field, d + '|' + f, { stamp: +objOf(x.fieldAt)[f] || now, phone: p, val: x[f], has: f in x }); });
      const hx = objOf(x.habits), hy = objOf(y.habits);
      new Set([...Object.keys(hx), ...Object.keys(hy), ...Object.keys(objOf(x.habitsAt))]).forEach(k => {
        if (JSON.stringify(hx[k]) !== JSON.stringify(hy[k]) || +objOf(x.habitsAt)[k] !== +objOf(y.habitsAt)[k]) stampIt(truth.habit, d + '|' + k, { stamp: +objOf(x.habitsAt)[k] || now, phone: p, val: hx[k] });
      });
      // A save of the day carries every manual field this phone holds, with a new updatedAt (the
      // day merge once gave every shared field to the newer updatedAt; fieldAt fixed that). Kept
      // so a loss can be explained (see check): a field this save held a STALE copy of, or
      // lacked, under a stamp newer than the latest write of that field.
      if (x.updatedAt && x.updatedAt !== y.updatedAt) {
        const val = {}, has = {};
        MANUAL.forEach(f => {
          has[f] = f in x; val[f] = JSON.stringify(x[f]);
          (truth.vals[d + '|' + f] = truth.vals[d + '|' + f] || new Set()).add(val[f]);
        });
        (truth.saves[d] = truth.saves[d] || []).push({ stamp: now, phone: p, has, val, why });
      }
    });
    // the habit list is one whole setting: its latest save wins as a whole (v277 dp.cfgAt)
    const hc = canonJSON(habitCfg());
    // the stamp the app actually wrote (v281: max(now, last + 1)), like the day fields' fieldAt
    if (hc !== b.cfg) stampIt(truth.cfg, 'habitcfg', { stamp: +objOf(listMeta('dp.cfgAt')).habitcfg || now, phone: p, json: hc });
    const g = objOf(DB.gym());
    new Set([...Object.keys(g), ...Object.keys(b.gym)]).forEach(d => ['done', 'log'].forEach(part => {
      const x = objOf(objOf(g[d])[part]), y = objOf(objOf(b.gym[d])[part]);
      new Set([...Object.keys(x), ...Object.keys(y)]).forEach(k => { if (x[k] !== y[k]) stampIt(truth.gym, d + '|' + part + '|' + k, { stamp: now, phone: p, val: x[k] }); });
    }));
  }

  /* ---------------- the operations ---------------- */
  let ver = 0;
  const clone = v => JSON.parse(JSON.stringify(v));
  function saveDay(d, change, why) {
    const en = clone(DB.entry(d) || { habits: {} });
    change(en);
    saveDraftNow(d, en);
  }
  function timeSaved(op) {
    // the debounced syncTimelogNow (DB.saveTimelog → syncTimelog, 1.5 s) — unless the app is
    // killed first, which loses _tlDirty (memory) and the re-sum but not dp.tlDirty (disk); the
    // next open re-sums days that still have a block and the days kept on disk
    if (op.r[3] < 0.08) { _tlDirty.forEach(d => killedDays.add(d)); _tlDirty.clear(); phones[cur].killed = true; return ' (killed before the re-sum)'; }
    syncTimelogNow(); return '';
  }
  function pullWith(text, label) {
    const remote = JSON.parse(text);
    const tlLocal = new Map(DB.timelog().map(s => [s.id, JSON.stringify(s)]));
    const rmap = new Map((Array.isArray(remote.timelog) ? remote.timelog : []).filter(s => s && s.id).map(s => [s.id, JSON.stringify(s)]));
    const sent = net.sent, was = cfg.trace ? held() : null;
    applyRemoteState(remote);
    // a block the merge wrote itself (closed one of two running timers): neither side's copy
    DB.timelog().forEach(s => { const j = JSON.stringify(s); if (j !== tlLocal.get(s.id) && j !== rmap.get(s.id)) machine.add(s.id); });
    const pushed = net.sent > sent;
    let diff = '';
    if (was) { const now = held(); diff = ['dp.entries', 'dp.tasks', 'dp.notes', 'dp.timelog', 'dp.timelogDel', 'dp.gym', 'dp.listAt', 'dp.listDel'].filter(k => was[k] !== now[k]).map(k => k.slice(3)).join(','); }
    return label + (pushed ? '>push' : '') + (diff ? ' [' + diff + ']' : '');
  }
  function exec(op) {
    const ph = phones[op.p], r = op.r;
    T += op.dt;
    if (op.k === 'deliver') {   // the network, not a phone
      if (!net.inflight.length) return 'net: nothing in flight';
      const [m] = net.inflight.splice(Math.floor(r[0] * net.inflight.length), 1);
      deliver(m.phone, m.body); return 'net: ' + m.phone + "'s held push lands late";
    }
    const same = cur === op.p;
    use(op.p);
    if (same && T - ph.lastT >= DEBOUNCE) flushPush();   // the debounce fired in between
    ph.lastT = T;
    if (ph.killed) { ph.killed = false; syncTimelogNow(); }   // reopened: visibilitychange → syncTimelog
    const P = op.p + (ph.online ? '' : '(off)') + ' ';
    switch (op.k) {
      case 'pull': return ph.online && SHEET.state ? P + pullWith(SHEET.state, 'pull') : P + 'pull (nothing to pull)';
      case 'pullStart': if (!ph.online || !SHEET.state) return P + 'pull-start (no reply)'; ph.pend = SHEET.state; return P + 'pull-start (reply = Sheet #' + SHEET.hist.length + ')';
      case 'pullEnd': { if (!ph.pend) return P + 'pull-end (none open)'; const t = ph.pend; ph.pend = null; return ph.online ? P + pullWith(t, 'pull-end (late reply)') : P + 'pull-end (dropped, offline)'; }
      case 'stale': { if (!ph.online || !SHEET.hist.length) return P + 'stale pull (no reply)'; const i = Math.floor(r[0] * SHEET.hist.length); return P + pullWith(SHEET.hist[i], 'stale pull (Sheet #' + (i + 1) + ' of ' + SHEET.hist.length + ')'); }
      case 'flush': flushPush(); return P + 'debounce fires';
      case 'offline': ph.online = !ph.online; return op.p + (ph.online ? ' back online' : ' goes offline');
      case 'lag': ph.lag = !ph.lag; return op.p + (ph.lag ? ' network slow (pushes held)' : ' network ok');
    }
    const b = before();
    let what = '';
    if (op.k === 'mood') { const d = at(DAYS, r[0]), v = 1 + Math.floor(r[1] * 10); saveDay(d, en => { en.mood = v; }); what = 'mood ' + d.slice(5) + '=' + v; }
    else if (op.k === 'journal') { const d = at(DAYS, r[0]), v = 'j' + (++ver); saveDay(d, en => { en.journal = v; }); what = 'journal ' + d.slice(5) + '=' + v; }
    else if (op.k === 'habit') {
      const d = at(DAYS, r[0]), k = at(HK, r[1]), kind = at(['tick', 'tick', 'skip', 'clear'], r[2]);
      saveDay(d, en => {
        en.habits = en.habits && typeof en.habits === 'object' ? en.habits : {};
        if (kind === 'tick') en.habits[k] = true; else if (kind === 'skip') en.habits[k] = 0; else delete en.habits[k];
        en.habitsAt = en.habitsAt || {}; en.habitsAt[k] = Date.now();
      }, 'habit');
      what = 'habit ' + kind + ' ' + d.slice(5) + ' ' + k;
    } else if (op.k === 'task' || op.k === 'note') {
      const s = op.k + 's', list = readList(s), save = l => (s === 'tasks' ? DB.saveTasks(l) : DB.saveNotes(l));
      const kind = !list.length || r[0] < 0.3 ? 'add' : r[0] < 0.55 ? 'edit' : r[0] < 0.65 && s === 'tasks' ? 'tick' : r[0] < 0.88 ? 'del' : 'reorder';
      if (kind === 'add') {
        const x = s === 'tasks' ? { id: 't' + Date.now(), text: 'task v' + (++ver), done: false, created: todayStr(), color: '' } : { id: 'n' + Date.now(), text: 'note v' + (++ver), color: '', created: todayStr() };
        list.unshift(x); save(list); what = '+' + op.k + ' ' + x.id;
      } else {
        const x = at(list, r[1]);
        if (kind === 'edit') { x.text = op.k + ' ' + x.id + ' v' + (++ver); save(list); }
        else if (kind === 'tick') { x.done = !x.done; if (x.done) x.doneDate = todayStr(); else delete x.doneDate; save(list); }
        else if (kind === 'del') save(list.filter(y => y !== x));
        else { list.splice(list.indexOf(x), 1); list.unshift(x); save(list); }
        what = kind + ' ' + op.k + ' ' + x.id;
      }
      if (s === 'tasks' && kind !== 'reorder') syncTodayTasks();   // as addTask / the in-place edit do
    } else if (op.k === 'tl') {
      const log = DB.timelog(), run = log.find(x => x.end == null);
      const kind = r[0] < 0.3 ? 'start' : r[0] < 0.4 ? (run ? 'stop' : 'start') : r[0] < 0.6 || !log.length ? 'add' : r[0] < 0.8 ? 'edit' : 'del';
      if (kind === 'start') { const a = at(ACTS, r[1]); startAct(a); what = 'timer ' + a + (run ? ' (was ' + run.act + ' ' + run.id + ')' : ''); }
      else if (kind === 'stop') { stopRunning(); what = 'timer stop ' + run.id; }
      else if (kind === 'add') {
        const now = Date.now(), d = at(DAYS, r[1]), start = dayStartMs(d) + Math.floor(r[2] * 22 * 60) * 60000, dur = (15 + Math.floor(r[3] * 165)) * 60000;
        let id = 'ts' + now, n = 0; while (log.some(x => x.id === id)) id = 'ts' + now + '-' + (++n);
        log.push({ id, act: at(ACTS, r[2]), start, end: Math.min(start + dur, now), upd: now }); DB.saveTimelog(log);
        what = 'block add ' + id + ' ' + d.slice(5);
      } else if (kind === 'edit') {
        const x = at(log, r[1]), now = Date.now();
        if (x.end == null || r[2] < 0.5) x.act = at(ACTS.filter(a => a !== x.act), r[2]);
        else { const sh = (r[2] < 0.75 ? -1 : 1) * 30 * 60000; x.start += sh; x.end = Math.min(x.end + sh, now); if (x.end <= x.start) x.end = x.start + 60000; }
        x.upd = now; DB.saveTimelog(log); what = 'block edit ' + x.id;
      } else {
        const x = at(log, r[1]); timelogForget(x.id); DB.saveTimelog(log.filter(y => y !== x)); what = 'block del ' + x.id + (x.end == null ? ' (running)' : '');
      }
      what += timeSaved(op);
    } else if (op.k === 'gym') {
      const d = at(DAYS, r[0]), k = dkey('d1', at(EX, r[1])), g = clone(DB.gymDay(d));
      g.done = objOf(g.done); g.log = objOf(g.log);
      if (r[2] < 0.75) { g.done[k] = !g.done[k]; what = 'gym ' + (g.done[k] ? 'tick ' : 'untick ') + d.slice(5) + ' ' + k; }
      else { g.log[k] = r[3] < 0.2 ? '' : '3x' + (++ver); what = 'gym log ' + d.slice(5) + ' ' + k + '=' + JSON.stringify(g.log[k]); }
      persistGym(true, d, g);
    } else if (op.k === 'cfg') {   // rename a habit: a settings-like store, saved whole
      const c = clone(habitCfg()), h = at(c, r[0]);
      if (h) { h.label = 'H' + (++ver); saveHabitCfg(c); what = 'habit rename ' + h.key + '=' + h.label; } else what = 'cfg (no habits)';
    }
    record(b, op.k);
    return P + what;
  }

  /* ---------------- the end state ---------------- */
  const SECTIONS = ['entries', 'tasks', 'notes', 'timelog', 'gym', 'habitcfg', 'actcfg', 'awards', 'gapskip'];
  const STAMPS = ['timelogDel', 'listAt', 'listDel', 'gymAt', 'cfgAt'];
  /* What this phone would push, section by section — the canonical state. Taken from a real
     pushState call that is captured instead of sent; dp.touched is put back. */
  function payload() {
    const t = localStorage.getItem('dp.touched');
    net.capture = []; pushState(true); const out = net.capture.pop(); net.capture = null;
    if (t == null) localStorage.removeItem('dp.touched'); else localStorage.setItem('dp.touched', t);
    delete out.type; delete out.touched;
    return out;
  }
  const short = s => { s = String(s); return s.length > 240 ? s.slice(0, 240) + '…' : s; };
  const fail = (inv, detail, extra) => fails.push(Object.assign({ inv, detail }, extra || {}));
  function finalSync() {
    PH.forEach(p => { phones[p].online = true; phones[p].lag = false; });
    while (net.inflight.length) { const m = net.inflight.shift(); deliver(m.phone, m.body); trace.push('net: ' + m.phone + "'s held push lands"); }
    PH.forEach(p => { const ph = phones[p]; if (!ph.pend) return; T += 3; use(p); const t = ph.pend; ph.pend = null; trace.push(p + ' ' + pullWith(t, 'pull-end (late reply)')); });
    PH.forEach(p => { if (phones[p].killed) { use(p); phones[p].killed = false; syncTimelogNow(); } });
    let settled = false, rounds = 0;
    for (let i = 0; i < MAX_ROUNDS && !settled; i++) {
      rounds++;
      const sent = net.sent;
      PH.forEach(p => { T += 5001; use(p); trace.push('  ' + p + ' ' + pullWith(SHEET.state, 'pull')); park(); cur = null; });
      trace.push('round ' + rounds + ': ' + (net.sent - sent) + ' push(es)');
      if (net.sent === sent) settled = true;
    }
    if (!settled) fail('settle', 'still pushing after ' + MAX_ROUNDS + ' rounds of pulls with no edits in between');
    // no ping-pong: a further full round changes nothing and sends nothing
    const snaps = {}; PH.forEach(p => { snaps[p] = JSON.stringify(phones[p].ls); });
    const sent = net.sent;
    PH.forEach(p => { T += 5001; use(p); pullWith(SHEET.state, 'pull'); park(); cur = null; });
    if (net.sent !== sent) fail('quiet', (net.sent - sent) + ' push(es) from a round of pulls that brought nothing new');
    PH.forEach(p => {
      if (JSON.stringify(phones[p].ls) === snaps[p]) return;
      const a = JSON.parse(snaps[p]), b = phones[p].ls;
      const ks = Object.keys(Object.assign({}, a, b)).filter(k => a[k] !== b[k] && k !== 'dp.touched');
      if (ks.length) fail('quiet', p + ' changed on a pull that brought nothing new: ' + ks.join(', '));
    });
    return rounds;
  }
  function check(run) {
    const views = {};
    PH.forEach(p => { use(p); views[p] = payload(); });
    const sheet = SHEET.state ? JSON.parse(SHEET.state) : {};
    const norm = (name, v) => canonJSON(v == null ? (['tasks', 'notes', 'timelog'].includes(name) ? [] : {}) : v);
    SECTIONS.concat(STAMPS).forEach(name => {
      const vals = PH.map(p => norm(name, views[p][name]));
      if (vals.some(v => v !== vals[0])) fail('converge', 'phones disagree on ' + name + ': ' + PH.map((p, i) => p + '=' + short(vals[i])).join(' | '), { section: name });
      else if (!STAMPS.includes(name) && norm(name, sheet[name]) !== vals[0]) fail('converge', 'the Sheet differs from the phones on ' + name + ': sheet=' + short(norm(name, sheet[name])) + ' phones=' + short(vals[0]), { section: name });
    });
    PH.forEach(p => ['tasks', 'notes', 'timelog'].forEach(name => {
      const seen = new Set(), dup = new Set();
      (views[p][name] || []).forEach(x => { const id = x && x.id; if (seen.has(id)) dup.add(id); seen.add(id); });
      if (dup.size) fail('dup-id', p + ' holds ' + name + ' ids twice: ' + [...dup].join(', '));
    }));

    // the truth, on the first phone (they agree, or converge has already failed)
    use(PH[0]);
    const v = views[PH[0]];
    STORES.forEach(s => {
      const have = new Map((v[s] || []).map(x => [String(x.id), x]));
      Object.keys(truth.list[s]).forEach(id => {
        const g = truth.list[s][id], h = have.get(id);
        counters.items++;
        if (g.del && h) fail('no-zombie', s + ' ' + id + ' was deleted last (by ' + g.phone + ' @' + rel(g.stamp) + ') and is back: ' + JSON.stringify(h), { key: s + ':' + id });
        else if (!g.del && !h) fail('no-loss', s + ' ' + id + ' was written last (by ' + g.phone + ' @' + rel(g.stamp) + ') and is gone', { key: s + ':' + id });
        else if (!g.del && JSON.stringify(h) !== g.json) fail('no-loss', s + ' ' + id + ' holds ' + JSON.stringify(h) + ', the latest write (by ' + g.phone + ' @' + rel(g.stamp) + ') was ' + g.json, { key: s + ':' + id });
      });
    });
    const tl = new Map((v.timelog || []).map(x => [String(x.id), x]));
    Object.keys(truth.tl).forEach(id => {
      if (machine.has(id)) return;
      const g = truth.tl[id], h = tl.get(id);
      counters.blocks++;
      if (g.del && h) fail('no-zombie', 'time block ' + id + ' was deleted last (by ' + g.phone + ' @' + rel(g.stamp) + ') and is back: ' + JSON.stringify(h), { key: 'tl:' + id });
      else if (!g.del && !h) fail('no-loss', 'time block ' + id + ' was written last (by ' + g.phone + ' @' + rel(g.stamp) + ') and is gone', { key: 'tl:' + id });
      else if (!g.del && JSON.stringify(h) !== g.json) fail('no-loss', 'time block ' + id + ' holds ' + JSON.stringify(h) + ', the latest write (by ' + g.phone + ') was ' + g.json, { key: 'tl:' + id });
    });
    const e = objOf(v.entries);
    Object.keys(truth.field).forEach(key => {
      const [d, f] = key.split('|'), g = truth.field[key], h = objOf(e[d]);
      counters.fields++;
      if (JSON.stringify(h[f]) === JSON.stringify(g.val)) return;
      // How the loss came about, if it is the known one: a save of the day stamped after that write
      // which held a stale copy of the field (clob), or which lacked it, so the merge filled it
      // from an older copy under the newer stamp (gap). Either way the value left must be one
      // somebody saved. "After" is by stamp, as the merge compares.
      const later = (truth.saves[d] || []).filter(sv => sv.stamp > g.stamp && sv.phone !== g.phone);
      const clob = later.find(sv => sv.has[f] && sv.val[f] !== JSON.stringify(g.val));
      const gap = later.some(sv => !sv.has[f]);
      const seen = (truth.vals[key] || new Set()).has(JSON.stringify(h[f]));
      fail('no-loss', d + ' ' + f + ' is ' + JSON.stringify(h[f]) + ', the latest write (by ' + g.phone + ' @' + rel(g.stamp) + ') set ' + JSON.stringify(g.val) +
        (clob ? '; a save of the day stamped later on ' + clob.phone + ' (@' + rel(clob.stamp) + ', a ' + clob.why + ' edit) still held ' + f + '=' + clob.val[f]
          : gap ? '; a save of the day stamped later without ' + f + ' let the merge fill it from an older copy under the newer stamp' : '') +
        (seen ? '' : ' — and nobody ever saved that value'),
        { key: 'field:' + key, clob: clob ? clob.why : null, gap, seen });
    });
    Object.keys(truth.habit).forEach(key => {
      const [d, k] = key.split('|'), g = truth.habit[key], h = objOf(objOf(e[d]).habits)[k];
      counters.habits++;
      if (JSON.stringify(h) !== JSON.stringify(g.val)) fail('no-loss', d + ' habit ' + k + ' is ' + JSON.stringify(h) + ', the latest change (by ' + g.phone + ' @' + rel(g.stamp) + ') set ' + JSON.stringify(g.val), { key: 'habit:' + key });
    });
    Object.keys(truth.cfg).forEach(key => {
      const g = truth.cfg[key];
      counters.cfg++;
      if (canonJSON(v[key]) !== g.json) fail('no-loss', key + ' is ' + short(canonJSON(v[key])) + ', the latest save (by ' + g.phone + ' @' + rel(g.stamp) + ') was ' + short(g.json), { key: 'cfg:' + key });
    });
    const gym = objOf(v.gym);
    Object.keys(truth.gym).forEach(key => {
      const [d, part, k] = key.split('|'), g = truth.gym[key], h = objOf(objOf(gym[d])[part])[k];
      counters.gym++;
      const same = part === 'done' ? !!h === !!g.val : (h || '') === (g.val || '');
      if (!same) fail('no-loss', 'gym ' + d + ' ' + part + ' ' + k + ' is ' + JSON.stringify(h) + ', the latest change (by ' + g.phone + ' @' + rel(g.stamp) + ') set ' + JSON.stringify(g.val), { key: 'gym:' + key });
    });

    // derived fields: what re-deriving them from the merged data gives
    const running = DB.timelog().filter(s => s.end == null);
    const runDays = new Set(); running.forEach(s => segDays(s, runDays));
    const days = new Set(DAYS); Object.keys(e).forEach(d => days.add(d)); DB.timelog().forEach(s => segDays(s, days));
    days.forEach(d => {
      if (runDays.has(d)) return;
      const en = objOf(e[d]), was = en.timeSummary;
      const want = resum(d);
      counters.sums++;
      if (want !== was) fail('derived', d + ' timeSummary is ' + JSON.stringify(was) + ', re-summing the merged time log gives ' + JSON.stringify(want) +
        (killedDays.has(d) ? ' (a time-log change on this day was killed before its re-sum)' : ''), { key: 'sum:' + d, afterKill: killedDays.has(d) });
    });
    Object.keys(gym).forEach(d => {
      const n = Object.values(objOf(objOf(gym[d]).done)).filter(Boolean).length, en = objOf(e[d]);
      counters.wo++;
      if ((+en.workoutsDone || 0) !== n) fail('derived', d + ' workoutsDone is ' + JSON.stringify(en.workoutsDone) + ' but the merged gym day holds ' + n + ' tick(s): ' + JSON.stringify(objOf(gym[d]).done), { key: 'wo:' + d });
    });
  }
  /* updateTimeSummary as the oracle: run it on the merged log, read what it wrote, put it all back. */
  function resum(d) {
    const keep = ['dp.entries', 'dp.touched'].map(k => [k, localStorage.getItem(k)]);
    updateTimeSummary(d);
    const got = objOf(DB.entry(d)).timeSummary;
    clearTimeout(pushTimer); _pushPending = null;
    keep.forEach(([k, val]) => { if (val == null) localStorage.removeItem(k); else localStorage.setItem(k, val); });
    return got;
  }
  const rel = t => { const s = Math.round((t - T0) / 1000); return (s < 0 ? '-' : '+') + Math.abs(s) + 's'; };

  /* ---------------- one run ---------------- */
  let PH = [], HK = [], EX = [];
  function reset() {
    if (cur !== null) { park(); cur = null; }
    Object.keys(phones).forEach(k => delete phones[k]);
    SHEET.state = null; SHEET.hist = []; SHEET.log = []; net.inflight = []; net.sent = 0; toasts = [];
    truth = { list: { tasks: {}, notes: {} }, tl: {}, field: {}, habit: {}, gym: {}, cfg: {}, saves: {}, vals: {} };
    machine = new Set(); trace = []; fails = []; ver = 0; killedDays = new Set();
    counters = { items: 0, blocks: 0, fields: 0, habits: 0, gym: 0, cfg: 0, sums: 0, wo: 0 };
    T = T0 - 3600 * 1000 * 3;
  }
  function warmup() {
    use(PH[0]);
    const b = before();
    DB.saveTasks([{ id: 'tw1', text: 'seed task 1', done: false, created: DAYS[0], color: '' }, { id: 'tw2', text: 'seed task 2', done: false, created: DAYS[1], color: '' }]);
    DB.saveNotes([{ id: 'nw1', text: 'seed note 1', color: '', created: DAYS[0] }, { id: 'nw2', text: 'seed note 2', color: '', created: DAYS[1] }]);
    const d0 = dayStartMs(DAYS[1]), now = Date.now();
    DB.saveTimelog([{ id: 'tsw1', act: 'work', start: d0 + 9 * 36e5, end: d0 + 11 * 36e5, upd: now }, { id: 'tsw2', act: 'learn', start: d0 + 13 * 36e5, end: d0 + 14 * 36e5, upd: now }]);
    syncTimelogNow();
    saveDay(DAYS[1], en => { en.mood = 6; en.journal = 'seed'; en.habits = { [HK[0]]: true }; en.habitsAt = { [HK[0]]: Date.now() }; });
    saveDay(DAYS[2], en => { en.mood = 4; });
    persistGym(true, DAYS[1], { done: { [dkey('d1', EX[0])]: true }, log: {} });
    record(b, 'seed');
    pushState(true);
    PH.slice(1).forEach(p => { T += 3000; use(p); pullWith(SHEET.state, 'pull'); });
    PH.forEach(p => { T += 3000; use(p); pullWith(SHEET.state, 'pull'); });
    park(); cur = null;
  }
  function runOnce(run) {
    reset();
    PH = run.names.slice();
    PH.forEach(p => { phones[p] = { ls: fresh(), dirty: [], skew: run.skew[p], online: true, lag: false, pend: null, lastT: 0, killed: false }; });
    let rounds = 0;
    try {
      warmup();
      trace.push('warm-up: ' + PH.join(', ') + ' linked and in sync' + (PH.some(p => Math.abs(run.skew[p]) > 2) ? ' (clock skew ' + PH.map(p => p + (run.skew[p] >= 0 ? '+' : '') + Math.round(run.skew[p] / 1000) + 's').join(' ') + ')' : ''));
      T = T0;
      run.ops.forEach((op, i) => { const t = exec(op); trace.push('#' + (i + 1) + ' ' + t); });
      if (cur !== null) { park(); cur = null; }
      trace.push('-- everyone syncs --');
      rounds = finalSync();
      check(run);
    } catch (e) {
      fail('no-crash', 'threw: ' + (e && e.stack ? String(e.stack).split('\n').slice(0, 3).join(' ← ') : e));
    }
    const shape = toasts.filter(m => /wrong shape/.test(m));
    if (shape.length) fail('no-crash', 'a section was refused: ' + shape[0]);
    if (cur !== null) { park(); cur = null; }
    fails.forEach(f => { f.known = Object.keys(KNOWN).find(id => KNOWN[id].match(f)) || null; });
    return { seed: run.seed, phones: PH.slice(), skew: Object.assign({}, run.skew), ops: run.ops.length, rounds, pushes: SHEET.hist.length, fails: fails.slice(), trace: trace.slice(), counters: Object.assign({}, counters) };
  }

  /* ---------------- shrinking: the fewest operations that still break the same invariant ---------------- */
  const sigOf = f => f.inv + '/' + (f.known || '-');
  function shrink(run, sig) {
    let ops = run.ops.slice(), runs = 0;
    const still = o => { runs++; const r = runOnce(Object.assign({}, run, { ops: o })); return r.fails.some(f => sigOf(f) === sig); };
    // no skew at all, if it still fails without
    const flat = {}; run.names.forEach((p, i) => { flat[p] = i; });
    if (run.names.some((p, i) => run.skew[p] !== i) && runOnce(Object.assign({}, run, { skew: flat })).fails.some(f => sigOf(f) === sig)) run = Object.assign({}, run, { skew: flat });
    for (let size = Math.max(1, Math.floor(ops.length / 2)); size >= 1; size = Math.floor(size / 2)) {
      for (let i = 0; i < ops.length && runs < 600;) {
        const o = ops.slice(0, i).concat(ops.slice(i + size));
        if (o.length && still(o)) ops = o; else i += size;
      }
      if (size === 1) break;
    }
    // a third phone nobody needs
    if (run.names.length === 3 && !ops.some(o => o.p === 'C')) run = Object.assign({}, run, { names: ['A', 'B'] });
    return Object.assign({}, run, { ops });
  }

  /* ---------------- main ---------------- */
  const saved = {};
  const STUB = ['syncTimelog', 'syncEntry', 'syncDocs', 'syncEvents', 'checkNewAwardsSoon', 'saveSheetOpen', 'refreshTimerNotif'];
  const out = { seeds: 0, ops: 0, pushes: 0, fails: [], known: {}, ms: 0, checked: { items: 0, blocks: 0, fields: 0, habits: 0, gym: 0, cfg: 0, sums: 0, wo: 0 } };
  const t0 = RealDate.now();
  try {
    saved.Date = window.Date; saved.fetch = window.fetch; saved.toast = window.toast;
    window.Date = FakeDate; window.fetch = fakeFetch; window.toast = (m) => { toasts.push(String(m)); };
    // The readable Sheet tabs and a few timers / native calls: not the sync, and a timer would fire
    // after this synchronous run, against whichever phone happens to be loaded.
    STUB.forEach(k => { saved[k] = window[k]; window[k] = () => {}; });
    base = held();
    HK = HABITS.slice(0, 3).map(h => h.key);
    EX = Object.keys(WORKOUT_BY_ID).slice(0, 3);
    if (HK.length < 2 || EX.length < 2) throw new Error('no habits or exercises to work with');
    for (let i = 0; i < cfg.seeds; i++) {
      const run = gen(cfg.seed + i);
      const res = runOnce(run);
      out.seeds++; out.ops += res.ops; out.pushes += res.pushes;
      Object.keys(out.checked).forEach(k => { out.checked[k] += res.counters[k]; });
      const hard = res.fails.filter(f => cfg.strict || !f.known);
      if (!cfg.strict) new Set(res.fails.filter(f => f.known).map(f => f.known)).forEach(id => {
        const k = out.known[id] || (out.known[id] = { runs: 0, first: null });
        k.runs++; if (!k.first) k.first = { seed: res.seed, detail: res.fails.find(f => f.known === id).detail };
      });
      if (cfg.trace) out.last = res.trace;
      if (!hard.length) continue;
      if (cfg.shrink) {
        const small = shrink(run, sigOf(hard[0]));
        const again = runOnce(small);
        res.min = { phones: small.names, skew: small.skew, ops: small.ops, trace: again.trace, fails: again.fails.filter(f => sigOf(f) === sigOf(hard[0])) };
      }
      res.fails = hard;
      out.fails.push(res);
      if (out.fails.length >= 8) break;   // enough to read; the first ones are the useful ones
    }
  } finally {
    if (cur !== null) { try { park(); } catch (e) {} cur = null; }
    if (base) load(base);
    window.Date = saved.Date; window.fetch = saved.fetch; window.toast = saved.toast;
    STUB.forEach(k => { if (saved[k]) window[k] = saved[k]; });
    clearTimeout(pushTimer); _pushPending = null; _tlDirty.clear();
  }
  out.ms = RealDate.now() - t0;
  window.__syncFuzzSummary = out;
  return out;
})();
