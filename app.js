/* ============================================================
   Daily Pulse — local-first life tracker (PWA)
   Data lives in localStorage; optionally syncs to a Google Sheet.
   ============================================================ */

'use strict';

const APP_VERSION = 'v51';   // shown in More ▸ About so you can confirm the build on each device

/* ---------- Config: your habits (from the Daily Pulse form) ----------
   DEFAULT_HABITS is only the starting point — the Customize screen
   (More ▸ Customize) saves your own list to dp.habitcfg, and HABITS
   is rebuilt from it (hidden ones excluded) via reloadCfg(). */
const DEFAULT_HABITS = [
  { key: 'workout',     emoji: '💪', label: 'Workout' },
  { key: 'faceWorkout', emoji: '😁', label: 'Face workout', color: '#fb923c' },
  { key: 'meditation',  emoji: '🧘', label: 'Meditation' },
  { key: 'english',     emoji: '💬', label: 'Communication', color: '#fb923c' },
  { key: 'reading',     emoji: '📖', label: 'Books / Reading' },
  { key: 'projectAI',   emoji: '🤖', label: 'Project — AI' },
  { key: 'projectSpace',emoji: '🚀', label: 'Project — Space tech' },
  { key: 'healthyFood', emoji: '🥗', label: 'Healthy food only', color: '#fb923c' },
  { key: 'posted',      emoji: '📣', label: 'Posted content' },
  { key: 'consumed',    emoji: '🧠', label: 'Consumed useful content' },
  { key: 'hairCare',    emoji: '💇', label: 'Hair care' },
  { key: 'skinCare',    emoji: '🧴', label: 'Skin care' },
];
function habitCfg() { const s = localStorage.getItem('dp.habitcfg'); return s ? JSON.parse(s) : DEFAULT_HABITS.map(h => Object.assign({}, h)); }
function saveHabitCfg(cfg) { localStorage.setItem('dp.habitcfg', JSON.stringify(cfg)); reloadCfg(); pushState(); }
let HABITS = habitCfg().filter(h => !h.hidden);
function reloadCfg() {
  HABITS = habitCfg().filter(h => !h.hidden);
  if (typeof actCfg === 'function') TIME_ACTS_ALL = actCfg();
  if (typeof deepCfg === 'function') DEEP_SECTIONS = cookDeep(deepCfg());
}

/* Deep-log sections — the bridge to your full Life Intelligence Tracker.
   Data-driven: add fields here and they appear in the form AND sync to your Sheet
   (also add the new keys to COLUMNS in google-apps-script/Code.gs). */
const DEFAULT_DEEP_SECTIONS = [
  { id: 'mind', title: '🧠 Mind & Focus',
    scales: [{key:'focus',label:'Focus quality'},{key:'productivity',label:'Productivity'},{key:'clarity',label:'Clarity of mind'},{key:'motivation',label:'Motivation'}] },
  { id: 'wellbeing', title: '😌 Wellbeing',
    scales: [{key:'stress',label:'Stress'},{key:'anxiety',label:'Anxiety'},{key:'happiness',label:'Happiness'}],
    nums: [{key:'meditationMin',label:'Meditation (min)'}],
    texts: [{key:'gratitude',label:'Grateful for…'}] },
  { id: 'health', title: '🩺 Health',
    scales: [{key:'sleepQuality',label:'Sleep quality'}],
    nums: [{key:'water',label:'Water (glasses)'},{key:'caffeine',label:'Caffeine (cups)'},{key:'weight',label:'Weight (kg)',step:0.1},{key:'meals',label:'Meals eaten'}] },
  { id: 'work', title: '💼 Work',
    scales: [{key:'efficiency',label:'Efficiency'},{key:'workSatisfaction',label:'Work satisfaction'}],
    nums: [{key:'workHours',label:'Work hours',step:0.5},{key:'meetings',label:'Meetings'}],
    texts: [{key:'goalsAchieved',label:'Goals achieved today'}] },
  { id: 'learning', title: '📚 Learning',
    scales: [{key:'retention',label:'Knowledge retention'}],
    nums: [{key:'codeLines',label:'Lines of code'},{key:'papers',label:'Papers read'}],
    checks: {key:'topics',label:'Topics studied',options:['AI/ML','Physics','Business','Economics','Psychology','Space Tech','Math','Philosophy','Neuroscience','Biotech']},
    texts: [{key:'newConcepts',label:'New concepts learned'},{key:'crossDomain',label:'Cross-domain insight'}] },
  { id: 'finance', title: '💰 Finance',
    scales: [{key:'financialStress',label:'Financial stress'}],
    nums: [{key:'income',label:'Income earned'},{key:'expenses',label:'Expenses'},{key:'savings',label:'Saved'}] },
  { id: 'digital', title: '📱 Digital',
    nums: [{key:'screenTime',label:'Screen time (hrs)',step:0.5},{key:'socialMedia',label:'Social media (hrs)',step:0.5}] },
  { id: 'growth', title: '🌱 Growth & Insight',
    scales: [{key:'lifeSatisfaction',label:'Life satisfaction'},{key:'purposeClarity',label:'Purpose clarity'}],
    texts: [{key:'keyInsight',label:'Key insight today'},{key:'breakthrough',label:'Breakthrough / aha moment'},{key:'priorities',label:"Tomorrow's top priorities"}] },
  { id: 'haircare', title: '💇 Hair care',
    checks: { key: 'hairRoutine', label: 'Tick what you did', options: ['Morning tablet', 'Afternoon tablet', 'Night tablet', 'Weekly shampoo', 'Serum before bed', 'Moisturiser before office'] } },
  { id: 'skincare', title: '🧴 Skin care',
    checks: { key: 'skinRoutine', label: 'Tick what you did', options: ['Allergy lotion on shoulder (3h before bath)'] } },
];
/* Deep-log customization: dp.deepcfg stores the user's edited copy of the
   sections (titles, hidden flags, renamed/hidden/added fields). DEEP_SECTIONS
   is the cooked, visible-only view the Today screen renders. */
function deepCfg() { const s = localStorage.getItem('dp.deepcfg'); return s ? JSON.parse(s) : JSON.parse(JSON.stringify(DEFAULT_DEEP_SECTIONS)); }
function saveDeepCfg(cfg) { localStorage.setItem('dp.deepcfg', JSON.stringify(cfg)); reloadCfg(); pushState(); }
function cookDeep(cfg) {
  return cfg.filter(sec => !sec.hidden).map(sec => Object.assign({}, sec, {
    scales: (sec.scales || []).filter(f => !f.hidden),
    nums: (sec.nums || []).filter(f => !f.hidden),
    texts: (sec.texts || []).filter(f => !f.hidden),
    checks: sec.checks && !sec.checks.hidden ? sec.checks : undefined,
  }));
}
let DEEP_SECTIONS = cookDeep(deepCfg());

/* Core Log-screen fields (the always-visible top card + reflection card).
   Rename/hide via Customize; stored in dp.corecfg. New defaults added in
   future versions get appended to a stored config automatically. */
const DEFAULT_CORE_FIELDS = [
  { key: 'mood',          label: 'Evening mood',                     type: 'scale' },
  { key: 'energy',        label: 'Energy level',                     type: 'scale' },
  { key: 'sleepHours',    label: 'Sleep hrs',                        type: 'num', step: 0.5, req: true },
  { key: 'deepWorkHours', label: 'Deep work hrs',                    type: 'num', step: 0.5, req: true },
  { key: 'tasksDone',     label: 'Tasks done',                       type: 'num' },
  { key: 'tasksPlanned',  label: 'Tasks planned',                    type: 'num' },
  { key: 'wentWell',      label: 'One thing that went well ✨',      type: 'text' },
  { key: 'improve',       label: 'One thing to improve tomorrow 🎯', type: 'text' },
  { key: 'journal',       label: 'Journal entry 📓',                 type: 'journal' },
];
function coreCfg() {
  const s = localStorage.getItem('dp.corecfg');
  const cfg = s ? JSON.parse(s) : DEFAULT_CORE_FIELDS.map(f => Object.assign({}, f));
  DEFAULT_CORE_FIELDS.forEach(d => { if (!cfg.find(f => f.key === d.key)) cfg.push(Object.assign({}, d)); });
  return cfg;
}
function saveCoreCfg(cfg) { localStorage.setItem('dp.corecfg', JSON.stringify(cfg)); pushState(); }

/* Default gym routine — fully editable in the Gym tab. */
const DEFAULT_EXERCISES = [
  { id: 'ex_pushup',   name: 'Push-ups',     target: '3 × 15' },
  { id: 'ex_squat',    name: 'Squats',       target: '4 × 12' },
  { id: 'ex_pullup',   name: 'Pull-ups',     target: '3 × 8' },
  { id: 'ex_plank',    name: 'Plank',        target: '3 × 60s' },
  { id: 'ex_lunge',    name: 'Lunges',       target: '3 × 12' },
  { id: 'ex_bench',    name: 'Bench press',  target: '4 × 10' },
  { id: 'ex_deadlift', name: 'Deadlift',     target: '3 × 8' },
  { id: 'ex_curl',     name: 'Bicep curls',  target: '3 × 12' },
  { id: 'ex_cardio',   name: 'Cardio / Run', target: '20 min' },
  { id: 'ex_stretch',  name: 'Stretching',   target: '10 min' },
];

/* ---------- Highlight colors (Tasks & Notes) ---------- */
const COLORS = [
  { id: '',       hex: '' },          // none / normal
  { id: 'red',    hex: '#f87171' },
  { id: 'orange', hex: '#fb923c' },
  { id: 'yellow', hex: '#fbbf24' },
  { id: 'green',  hex: '#34d399' },
  { id: 'blue',   hex: '#60a5fa' },
  { id: 'purple', hex: '#a78bfa' },
];
const colorHex = id => { const c = COLORS.find(c => c.id === id); return c ? c.hex : ''; };
let openColorId = null; // which task/note's color swatches are showing

/* A reusable swatch strip (shown under an item when its 🎨 is tapped). */
function swatchStrip(id) {
  return `<div class="swatches">${COLORS.map(c => `<button class="sw ${c.id?'':'sw-none'}" data-setcolor="${id}" data-color="${c.id}"
    style="${c.hex?`background:${c.hex}`:''}" title="${c.id||'none'}">${c.id?'':'✕'}</button>`).join('')}</div>`;
}

/* ---------- Touch-friendly drag-to-reorder ---------- */
function enableDrag(listEl, onReorder) {
  if (!listEl) return;
  listEl.querySelectorAll('[data-drag]').forEach(handle => {
    handle.style.touchAction = 'none';
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const row = handle.closest('[data-id]'); if (!row) return;
      const id = row.dataset.id, startY = e.clientY; let lastY = startY;
      row.classList.add('dragging');
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      const move = (ev) => { lastY = ev.clientY; row.style.transform = `translateY(${ev.clientY - startY}px)`; };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        const others = Array.from(listEl.querySelectorAll('[data-id]')).filter(r => r !== row);
        let target = others.length;
        for (let i = 0; i < others.length; i++) { const r = others[i].getBoundingClientRect(); if (lastY < r.top + r.height / 2) { target = i; break; } }
        const ids = others.map(r => r.dataset.id); ids.splice(target, 0, id);
        row.classList.remove('dragging'); row.style.transform = '';
        onReorder(ids);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  });
}

/* ---------- Storage ---------- */
const DB = {
  entries() { return JSON.parse(localStorage.getItem('dp.entries') || '{}'); },
  saveEntries(e) { localStorage.setItem('dp.entries', JSON.stringify(e)); pushState(); },
  entry(date) { return this.entries()[date] || null; },
  putEntry(date, data) { const e = this.entries(); e[date] = data; this.saveEntries(e); },

  tasks() { return JSON.parse(localStorage.getItem('dp.tasks') || '[]'); },
  saveTasks(t) { localStorage.setItem('dp.tasks', JSON.stringify(t)); pushState(); },

  exercises() { const s = localStorage.getItem('dp.exercises'); return s ? JSON.parse(s) : DEFAULT_EXERCISES.slice(); },
  saveExercises(x) { localStorage.setItem('dp.exercises', JSON.stringify(x)); pushState(); },
  gym() { return JSON.parse(localStorage.getItem('dp.gym') || '{}'); },
  saveGym(g) { localStorage.setItem('dp.gym', JSON.stringify(g)); pushState(); },
  gymDay(date) { return this.gym()[date] || { done: {}, log: {} }; },
  putGymDay(date, d) { const g = this.gym(); g[date] = d; this.saveGym(g); },

  reminders() { return JSON.parse(localStorage.getItem('dp.reminders') || '[]'); },
  saveReminders(r) { localStorage.setItem('dp.reminders', JSON.stringify(r)); pushState(); },

  notes() { return JSON.parse(localStorage.getItem('dp.notes') || '[]'); },
  saveNotes(n) { localStorage.setItem('dp.notes', JSON.stringify(n)); pushState(); },

  plans() { return JSON.parse(localStorage.getItem('dp.plans') || '[]'); },
  savePlans(p) { localStorage.setItem('dp.plans', JSON.stringify(p)); pushState(); },

  docs() { return JSON.parse(localStorage.getItem('dp.docs') || '[]'); },
  saveDocs(d) { localStorage.setItem('dp.docs', JSON.stringify(d)); pushState(); syncDocs(); },

  events() { return JSON.parse(localStorage.getItem('dp.events') || '[]'); },
  saveEvents(x) { localStorage.setItem('dp.events', JSON.stringify(x)); pushState(); syncEvents(); },

  timelog() { return JSON.parse(localStorage.getItem('dp.timelog') || '[]'); },
  saveTimelog(t) { localStorage.setItem('dp.timelog', JSON.stringify(t)); pushState(); syncTimelog(); },
  timeacts() { return JSON.parse(localStorage.getItem('dp.timeacts') || '[]'); },   // custom activities
  saveTimeacts(a) { localStorage.setItem('dp.timeacts', JSON.stringify(a)); pushState(); },

  settings() { return Object.assign({ syncUrl: '', reminderTime: '', name: '' }, JSON.parse(localStorage.getItem('dp.settings') || '{}')); },
  saveSettings(s) { localStorage.setItem('dp.settings', JSON.stringify(s)); },
};

/* ---------- Date helpers ---------- */
function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function addDays(str, n) { const d = new Date(str + 'T00:00:00'); d.setDate(d.getDate()+n); return todayStr(d); }
function prettyDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function isSunday(str) { return new Date(str + 'T00:00:00').getDay() === 0; }

/* ---------- Voice dictation (speak → journal) ---------- */
let _recog = null, _recogOn = false, _recogBtn = null, _userStopped = false;
// sel = a CSS selector for the input/textarea to dictate into.
// MANUAL toggle: tap 🎤 to start recording, tap again to stop. No auto-restart, so no
// repeated mic "ding" and no unpredictable cut-in/cut-out. `continuous = true` keeps it
// listening through pauses on capable browsers; if the OS ends it during a long silence
// (common on phones), the mic just turns off and you tap once to continue.
function dictateInto(sel, btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Voice input needs Chrome / Android', true); return; }
  if (_recogOn) { _userStopped = true; try { _recog && _recog.stop(); } catch (_) {} return; }   // tap again = stop
  const ta = document.querySelector(sel); if (!ta) return;
  _userStopped = false; _recogOn = true; _recogBtn = btn; btn.classList.add('rec');
  _recog = new SR(); _recog.lang = 'en-IN'; _recog.continuous = true; _recog.interimResults = false;
  _recog.onresult = (ev) => {
    let txt = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) txt += ev.results[i][0].transcript + ' ';
    txt = txt.trim();
    if (txt) { ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '') + txt; ta.dispatchEvent(new Event('input', { bubbles: true })); }
  };
  _recog.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Mic permission blocked', true); };
  _recog.onend = () => {                       // NO auto-restart — purely manual
    _recogOn = false; if (_recogBtn) _recogBtn.classList.remove('rec'); _recog = null;
    if (!_userStopped) toast('Mic paused — tap 🎤 to continue');
  };
  try { _recog.start(); toast('🎙️ Recording — tap 🎤 again to stop'); }
  catch (e) { _recogOn = false; btn.classList.remove('rec'); _recog = null; }
}
document.addEventListener('click', (ev) => { const m = ev.target.closest('[data-mic]'); if (m) { ev.preventDefault(); dictateInto(m.dataset.mic, m); } });

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = 'toast', 2200);
}

/* ---------- Streaks ---------- */
function loggedStreak() {
  const e = DB.entries(); let n = 0; let cur = todayStr();
  // allow today to be unlogged without breaking the streak (count from yesterday)
  if (!e[cur]) cur = addDays(cur, -1);
  while (e[cur]) { n++; cur = addDays(cur, -1); }
  return n;
}
function habitStreak(key) {
  const e = DB.entries(); let n = 0; let cur = todayStr();
  if (!(e[cur] && e[cur].habits && e[cur].habits[key])) cur = addDays(cur, -1);
  while (e[cur] && e[cur].habits && e[cur].habits[key]) { n++; cur = addDays(cur, -1); }
  return n;
}

/* ---------- Sync to Google Sheet (optional) ---------- */
async function syncEntry(date, data) {
  const url = DB.settings().syncUrl;
  if (!url) return false;
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type: 'entry', date, ...data }),
    });
    return true; // no-cors = opaque; assume success
  } catch (err) { return false; }
}
async function resyncAll() {
  const url = DB.settings().syncUrl;
  if (!url) { toast('Add your Sheet link in More first', true); return; }
  const e = DB.entries(); const dates = Object.keys(e).sort();
  let ok = 0;
  for (const d of dates) { if (await syncEntry(d, e[d])) ok++; }
  syncReminders(); syncNotes(); syncTimelog(); pushState(true);
  toast(`Pushed ${ok} day(s) to your Sheet`);
}

/* ---------- Multi-device sync: full-state push + JSONP pull ----------
   The sync link IS the login. Whichever device saved most recently wins;
   the app pulls on open so you see the latest before editing. */
let pushTimer;
function pushState(now) {
  const url = DB.settings().syncUrl; if (!url) return;
  const touched = Date.now();
  localStorage.setItem('dp.touched', String(touched));
  clearTimeout(pushTimer);
  const send = () => {
    const payload = { type: 'state', touched,
      entries: DB.entries(), tasks: DB.tasks(), notes: DB.notes(), plans: DB.plans(),
      reminders: DB.reminders(), gym: DB.gym(), exercises: DB.exercises(),
      timelog: DB.timelog(), timeacts: DB.timeacts(), events: DB.events(),
      docs: DB.docs(), habitcfg: habitCfg(), actcfg: actCfg(), deepcfg: deepCfg(), gymcfg: gymCfg(),
      corecfg: coreCfg(), daycfg: gymDays(), gymgroups: gymGroups(), navcfg: navCfg() };
    fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }).catch(() => {});
  };
  now ? send() : (pushTimer = setTimeout(send, 1200));
}
function pullState(done) {
  const url = DB.settings().syncUrl; if (!url) { done && done(false); return; }
  const cb = 'dpcb' + Date.now();
  const script = document.createElement('script');
  const cleanup = () => { delete window[cb]; script.remove(); };
  window[cb] = (remote) => { cleanup(); applyRemoteState(remote); done && done(true); };
  script.onerror = () => { cleanup(); done && done(false); };
  script.src = url + (url.includes('?') ? '&' : '?') + 'type=pull&callback=' + cb + '&t=' + Date.now();
  document.body.appendChild(script);
}
// Merge remote into local so NOTHING is lost on either device:
//  entries  -> by date, newest updatedAt wins
//  gym      -> by date, union of done/log
//  tasks/notes/reminders -> union by id (adds anything this device is missing)
function applyRemoteState(remote) {
  if (!remote || !remote.touched) return;            // nothing in the cloud yet
  const localTouched = +(localStorage.getItem('dp.touched') || 0);
  const remoteNewer = remote.touched > localTouched; // the other device changed more recently
  let changed = false;

  // Entries: merge by date, newest updatedAt wins — never lose a day logged on either device.
  if (remote.entries) {
    const local = DB.entries();
    Object.keys(remote.entries).forEach(d => {
      const r = remote.entries[d], l = local[d];
      if (!l || (r.updatedAt || '') > (l.updatedAt || '')) { local[d] = r; changed = true; }
    });
    localStorage.setItem('dp.entries', JSON.stringify(local));
  }
  // Gym: merge by date, union of done/log — never lose a workout.
  if (remote.gym) {
    const local = DB.gym();
    Object.keys(remote.gym).forEach(d => {
      if (!local[d]) { local[d] = remote.gym[d]; changed = true; return; }
      const ld = local[d], rd = remote.gym[d];
      Object.keys(rd.done || {}).forEach(k => { if (rd.done[k] && !ld.done[k]) { ld.done[k] = true; changed = true; } });
      Object.keys(rd.log || {}).forEach(k => { if (rd.log[k] && !ld.log[k]) { ld.log[k] = rd.log[k]; changed = true; } });
    });
    localStorage.setItem('dp.gym', JSON.stringify(local));
  }
  // Time log: merge by segment id, newer `upd` wins — a timer started on either device survives.
  // Deletions: when the other device saved more recently, drop local segments it no longer has
  // (unless ours is newer than its save — that's a fresh local segment it hasn't seen yet).
  if (remote.timelog) {
    const local = DB.timelog();
    const byId = {}; local.forEach(s => byId[s.id] = s);
    const remoteIds = new Set();
    remote.timelog.forEach(r => {
      remoteIds.add(r.id);
      const l = byId[r.id];
      if (!l || (r.upd || 0) > (l.upd || 0)) { byId[r.id] = r; changed = true; }
    });
    let merged = Object.values(byId);
    if (remoteNewer) {
      const before = merged.length;
      merged = merged.filter(s => remoteIds.has(s.id) || (s.upd || 0) > remote.touched);
      if (merged.length !== before) changed = true;
    }
    merged.sort((a, b) => a.start - b.start);
    localStorage.setItem('dp.timelog', JSON.stringify(merged));
  }
  // Tasks / Notes / Reminders / Exercises are LISTS that get completed, edited, reordered, deleted —
  // a union-of-ids would never propagate those. So when the other device changed more recently,
  // adopt its whole list (so done/edit/reorder/delete all sync). Local-newer keeps local.
  if (remoteNewer) {
    [['tasks', 'dp.tasks'], ['notes', 'dp.notes'], ['plans', 'dp.plans'], ['reminders', 'dp.reminders'], ['exercises', 'dp.exercises'], ['timeacts', 'dp.timeacts'], ['events', 'dp.events'], ['docs', 'dp.docs'], ['habitcfg', 'dp.habitcfg'], ['actcfg', 'dp.actcfg'], ['deepcfg', 'dp.deepcfg'], ['gymcfg', 'dp.gymcfg'], ['corecfg', 'dp.corecfg'], ['daycfg', 'dp.daycfg'], ['gymgroups', 'dp.gymgroups'], ['navcfg', 'dp.navcfg']].forEach(([key, store]) => {
      if (!remote[key]) return;
      if (JSON.stringify(remote[key]) !== (localStorage.getItem(store) || 'null')) {
        localStorage.setItem(store, JSON.stringify(remote[key])); changed = true;
      }
    });
  }

  if (changed) {
    localStorage.setItem('dp.touched', String(Date.now()));
    reloadCfg();                // custom habits/activities may have changed
    renderNav(); applyTheme();
    pushState(true);            // push the merged superset back so all devices converge
    refreshStreak(); setupReminders();
    const cur = document.querySelector('.nav button.on'); if (cur) show(cur.dataset.screen);
    toast('Synced from your other device ⬇️');
  }
}

/* ============================================================
   SCREEN: TODAY / LOG
   ============================================================ */
let logDate = todayStr();
let draft = {};

function loadDraft() {
  const existing = DB.entry(logDate);
  draft = existing ? JSON.parse(JSON.stringify(existing)) : { habits: {} };
  if (!draft.habits) draft.habits = {};
}

function scaleField(key, label, required) {
  const v = draft[key];
  let btns = '';
  for (let i = 1; i <= 10; i++) btns += `<button type="button" class="${v===i?'on':''}" data-scale="${key}" data-val="${i}">${i}</button>`;
  return `<div class="field"><label>${label} ${required?'<span class="req">*</span>':''}</label>
    <div class="scale">${btns}</div>
    <div class="scale-labels"><span>low</span><span>high</span></div></div>`;
}
function numField(f) {
  return `<div class="field"><label>${f.label}</label>
    <input type="number" step="${f.step||1}" inputmode="decimal" data-num="${f.key}" value="${draft[f.key]??''}"></div>`;
}
function txtField(f) {
  return `<div class="field"><label>${f.label}</label>
    <textarea data-txt="${f.key}" placeholder="optional">${escapeHtml(draft[f.key]||'')}</textarea></div>`;
}
function checksField(f) {
  const sel = draft[f.key] || {};
  const chips = f.options.map(o => `<div class="habit ${sel[o]?'on':''}" data-check="${f.key}" data-opt="${escapeHtml(o)}">
    <span class="check">✓</span><span>${o}</span></div>`).join('');
  return `<div class="field"><label>${f.label}</label><div class="habits">${chips}</div></div>`;
}

let openSections = new Set();
function renderDeepSections() {
  return DEEP_SECTIONS.map(sec => {
    let body = '';
    (sec.scales || []).forEach(s => body += scaleField(s.key, s.label, false));
    if (sec.checks) body += checksField(sec.checks);
    (sec.nums || []).forEach(n => body += numField(n));
    (sec.texts || []).forEach(t => body += txtField(t));
    const open = openSections.has(sec.id);
    return `<div class="card section-collapsible ${open?'':'collapsed'}" data-section="${sec.id}">
      <h2 data-toggle-section="${sec.id}"><span>${sec.title}</span><span class="chev">▾</span></h2>
      <div class="body">${body}</div></div>`;
  }).join('');
}

function openToday() { loadDraft(); renderToday(); }
function renderToday() {
  const isToday = logDate === todayStr();
  document.getElementById('screen-title').textContent = isToday ? 'Today' : prettyDate(logDate);
  document.getElementById('screen-sub').textContent = isToday ? prettyDate(logDate) + ' · Daily Pulse' : 'Editing past entry';

  const habitChips = HABITS.map(h => {
    const on = !!draft.habits[h.key];
    const st = habitStreak(h.key);
    const style = h.color ? `box-shadow: inset 4px 0 0 ${h.color}${on ? `; background:${h.color}1f; border-color:${h.color}` : ''}` : '';
    return `<div class="habit ${on?'on':''}" data-habit="${h.key}" style="${style}">
      <span class="check">✓</span><span class="emoji">${h.emoji}</span>
      <span>${h.label}</span>${st>1?`<span class="streak">🔥${st}</span>`:''}</div>`;
  }).join('');

  // Core fields come from the user's config (Customize ▸ Log screen fields)
  const core = coreCfg().filter(f => !f.hidden);
  const coreScales = core.filter(f => f.type === 'scale').map(f => scaleField(f.key, f.label, f.req)).join('');
  const coreNums = core.filter(f => f.type === 'num');
  let numRows = '';
  for (let i = 0; i < coreNums.length; i += 2) {
    const cell = f => f ? `<div class="field"><label>${escapeHtml(f.label)} ${f.req ? '<span class="req">*</span>' : ''}</label>
      <input type="number" ${f.step ? `step="${f.step}"` : ''} inputmode="${f.step ? 'decimal' : 'numeric'}" data-num="${f.key}" value="${draft[f.key] ?? ''}"></div>` : '<div></div>';
    numRows += `<div class="row2">${cell(coreNums[i])}${cell(coreNums[i + 1])}</div>`;
  }
  const reflect = core.filter(f => f.type === 'text').map(f => `<div class="field"><label>${escapeHtml(f.label)}</label>
      <textarea data-txt="${f.key}" placeholder="...">${draft[f.key] || ''}</textarea></div>`).join('');
  const journalF = core.find(f => f.type === 'journal');
  const journalHtml = journalF ? `<div class="field"><label>${escapeHtml(journalF.label)} <span class="hint">type or speak · use #tags to link</span></label>
      <textarea data-txt="journal" placeholder="How was your day?" style="min-height:110px">${draft.journal || ''}</textarea>
      <button type="button" class="mic-btn" data-mic="[data-txt=journal]">🎤 Speak</button></div>` : '';

  document.getElementById('s-today').innerHTML = `
    <div class="card">
      <div class="field"><label>Date</label>
        <input type="date" id="log-date" value="${logDate}" max="${todayStr()}"></div>
      ${coreScales}
      ${numRows}
    </div>

    <div class="card">
      <h2>Daily checklist <span class="hint">tap what you did</span></h2>
      <div class="habits">${habitChips}</div>
    </div>

    ${(reflect || journalHtml) ? `<div class="card">
      <h2>Reflection</h2>
      ${reflect}
      ${journalHtml}
    </div>` : ''}

    <h2 style="margin:22px 4px 10px;font-size:13px;color:var(--text-dim);font-weight:600;letter-spacing:.3px;text-transform:uppercase">Deep log <span class="hint" style="text-transform:none">optional · the polymath metrics</span></h2>
    ${renderDeepSections()}

    ${isSunday(logDate) ? `<div class="card"><h2>📅 Sunday weekly review</h2>
      <div class="field"><label>Wins this week</label><textarea data-txt="weekWins" placeholder="...">${draft.weekWins||''}</textarea></div>
      <div class="field"><label>Focus for next week</label><textarea data-txt="weekFocus" placeholder="...">${draft.weekFocus||''}</textarea></div></div>` : ''}

    <button class="btn btn-primary" id="save-entry">Save ${isToday?'today':'entry'}</button>
    <div style="height:14px"></div>
  `;
}

/* delegated handlers for Today screen */
document.addEventListener('click', (ev) => {
  const ts = ev.target.closest('[data-toggle-section]');
  if (ts) { const id = ts.dataset.toggleSection;
    if (openSections.has(id)) openSections.delete(id); else openSections.add(id);
    const card = document.querySelector(`[data-section="${id}"]`); if (card) card.classList.toggle('collapsed');
    return; }
  const sc = ev.target.closest('[data-scale]');
  if (sc) { draft[sc.dataset.scale] = +sc.dataset.val; renderToday(); return; }
  const ck = ev.target.closest('[data-check]');
  if (ck) { const k = ck.dataset.check, o = ck.dataset.opt; draft[k] = draft[k] || {}; draft[k][o] = !draft[k][o]; renderToday(); return; }
  const hb = ev.target.closest('[data-habit]');
  if (hb && document.getElementById('s-today').classList.contains('on')) { const k = hb.dataset.habit; draft.habits[k] = !draft.habits[k]; renderToday(); return; }
});
document.addEventListener('input', (ev) => {
  const n = ev.target.closest('[data-num]'); if (n) { draft[n.dataset.num] = n.value === '' ? '' : +n.value; return; }
  const t = ev.target.closest('[data-txt]'); if (t) { draft[t.dataset.txt] = t.value; return; }
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'log-date') { logDate = ev.target.value; openToday(); }
});
document.addEventListener('click', async (ev) => {
  if (ev.target.id !== 'save-entry') return;
  draft.updatedAt = new Date().toISOString();
  draft.tasks = tasksForDate(logDate);
  DB.putEntry(logDate, draft);
  toast('Saved 🎉');
  scheduleInactivityReminder();   // logging today slides the 2-day nudge forward
  const synced = await syncEntry(logDate, draft);
  refreshStreak();
  if (synced) toast('Saved & synced to Sheet 🎉');
});

/* ============================================================
   SCREEN: TASKS
   ============================================================ */
/* Tasks open on a given date: created on/before D, and not completed before D.
   On the completion day it's shown as "name ✓done"; from the next day it drops off. */
function tasksForDate(d) {
  return DB.tasks()
    .filter(t => (t.created || todayStr()) <= d && (!t.done || (t.doneDate && t.doneDate >= d)))
    .map(t => t.text + (t.done && t.doneDate === d ? ' ✓done' : ''))
    .join(', ');
}
/* Keep today's Sheet row's task list fresh when tasks change. */
async function syncTodayTasks() {
  if (!DB.settings().syncUrl) return;
  const d = todayStr();
  const entry = DB.entry(d) || { habits: {} };
  entry.tasks = tasksForDate(d);
  DB.putEntry(d, entry);
  syncEntry(d, entry);
}

function taskRow(t, drag) {
  return `<div class="lrow ${t.done?'done':''}" data-id="${t.id}" style="${t.color?`border-left:3px solid ${colorHex(t.color)}`:''}">
    <div class="lrow-main">
      ${drag ? '<span class="drag-handle" data-drag>⠿</span>' : '<span class="drag-handle ghost"></span>'}
      <div class="check" data-toggle="${t.id}">✓</div>
      <div class="txt">${escapeHtml(t.text)} ${(!t.done && t.created && t.created!==todayStr())?'<span class="carry">carried</span>':''}</div>
      <button class="pal" data-palette="${t.id}" title="highlight color"${t.color?` style="background:${colorHex(t.color)};border-color:${colorHex(t.color)}"`:''}></button>
      <button class="del" data-del="${t.id}">×</button>
    </div>
    ${openColorId===t.id ? swatchStrip(t.id) : ''}
  </div>`;
}
function renderTasks() {
  document.getElementById('screen-title').textContent = 'Tasks';
  const tasks = DB.tasks();
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  document.getElementById('screen-sub').textContent = `${open.length} open · ${done.length} done`;

  document.getElementById('s-tasks').innerHTML = `
    <div class="card">
      <h2>To-do <span class="hint">drag ⠿ priority · tap ◌ to color</span></h2>
      <div id="task-list">${open.length ? open.map(t=>taskRow(t,true)).join('') : '<div class="empty">No open tasks. Add one below 👇</div>'}</div>
      <div class="task-add">
        <input type="text" id="task-input" placeholder="Add a task…" autocomplete="off">
        <button class="mic-ic" data-mic="#task-input" title="speak">🎤</button>
        <button class="btn btn-primary btn-sm" id="task-add-btn">Add</button>
      </div>
    </div>
    ${done.length ? `<div class="card"><h2>Done <span class="hint">${done.length}</span></h2>${done.map(t=>taskRow(t,false)).join('')}
      <div style="margin-top:12px"><button class="btn btn-ghost btn-sm" id="clear-done">Clear completed</button></div></div>` : ''}
  `;
  enableDrag(document.getElementById('task-list'), ids => {
    const all = DB.tasks();
    const openR = ids.map(id => all.find(t => t.id === id)).filter(Boolean);
    DB.saveTasks([...openR, ...all.filter(t => t.done)]); renderTasks();
  });
}
function addTask() {
  const inp = document.getElementById('task-input');
  const text = inp.value.trim(); if (!text) return;
  const tasks = DB.tasks();
  tasks.unshift({ id: 't' + Date.now(), text, done: false, created: todayStr(), color: '' });
  DB.saveTasks(tasks); renderTasks(); syncTodayTasks();
  document.getElementById('task-input').focus();
}
function rerenderList() {
  if (document.getElementById('s-plans').classList.contains('on')) renderPlans();
  else if (document.getElementById('s-notes').classList.contains('on')) renderNotes();
  else renderTasks();
}
function setColor(id, col) {
  const ts = DB.tasks(); const t = ts.find(x => x.id === id);
  if (t) { t.color = col; DB.saveTasks(ts); openColorId = null; renderTasks(); return; }
  const ns = DB.notes(); const n = ns.find(x => x.id === id);
  if (n) { n.color = col; DB.saveNotes(ns); openColorId = null; renderNotes(); syncNotes(); return; }
  // Plans: the id can be a plan label OR a checklist item inside a plan.
  const ps = DB.plans();
  const p = ps.find(x => x.id === id);
  if (p) { p.color = col; DB.savePlans(ps); openColorId = null; renderPlans(); return; }
  for (const pl of ps) { const it = (pl.items || []).find(x => x.id === id); if (it) { it.color = col; DB.savePlans(ps); openColorId = null; renderPlans(); return; } }
}
document.addEventListener('click', (ev) => {
  if (ev.target.id === 'task-add-btn') return addTask();
  if (ev.target.id === 'clear-done') { DB.saveTasks(DB.tasks().filter(t=>!t.done)); renderTasks(); return; }
  const tg = ev.target.closest('[data-toggle]');
  if (tg) { const id = tg.dataset.toggle; const ts = DB.tasks(); const t = ts.find(x=>x.id===id); if(t){t.done=!t.done; t.doneDate=t.done?todayStr():null;} DB.saveTasks(ts); renderTasks(); syncTodayTasks(); return; }
  const dl = ev.target.closest('[data-del]');
  if (dl) { DB.saveTasks(DB.tasks().filter(t=>t.id!==dl.dataset.del)); renderTasks(); syncTodayTasks(); return; }
  const pal = ev.target.closest('[data-palette]');
  if (pal) { const id = pal.dataset.palette; openColorId = (openColorId === id) ? null : id; rerenderList(); return; }
  const sc = ev.target.closest('[data-setcolor]');
  if (sc) { setColor(sc.dataset.setcolor, sc.dataset.color); return; }
  if (ev.target.id === 'note-add-btn') return addNote();
  const dn = ev.target.closest('[data-delnote]');
  if (dn) { DB.saveNotes(DB.notes().filter(n=>n.id!==dn.dataset.delnote)); renderNotes(); syncNotes(); return; }
});
document.addEventListener('keydown', (ev) => {
  if (ev.target.id === 'task-input' && ev.key === 'Enter') addTask();
  if (ev.target.id === 'note-input' && ev.key === 'Enter') addNote();
});

/* ============================================================
   SCREEN: NOTES
   ============================================================ */
function renderNotes() {
  document.getElementById('screen-title').textContent = 'Notes';
  const notes = DB.notes();
  document.getElementById('screen-sub').textContent = `${notes.length} note${notes.length===1?'':'s'}`;
  const item = n => `<div class="lrow note" data-id="${n.id}" style="${n.color?`border-left:3px solid ${colorHex(n.color)}`:''}">
    <div class="lrow-main">
      <span class="drag-handle" data-drag>⠿</span>
      <textarea class="note-text" data-note="${n.id}" rows="1" placeholder="Note…">${escapeHtml(n.text)}</textarea>
      <button class="pal" data-palette="${n.id}" title="highlight color"${n.color?` style="background:${colorHex(n.color)};border-color:${colorHex(n.color)}"`:''}></button>
      <button class="del" data-delnote="${n.id}">×</button>
    </div>
    ${openColorId===n.id ? swatchStrip(n.id) : ''}
  </div>`;
  document.getElementById('s-notes').innerHTML = `
    <div class="card">
      <div class="task-add">
        <input type="text" id="note-input" placeholder="Add a note…" autocomplete="off">
        <button class="mic-ic" data-mic="#note-input" title="speak">🎤</button>
        <button class="btn btn-primary btn-sm" id="note-add-btn">Add</button>
      </div>
      <div class="hint" style="margin-top:8px">Drag ⠿ to reorder · tap ◌ to color · 🎤 to speak</div>
    </div>
    <div class="card" id="note-list" style="padding:4px 16px">
      ${notes.length ? notes.map(item).join('') : '<div class="empty">No notes yet. Add one above 👆</div>'}
    </div>`;
  // auto-size textareas
  document.querySelectorAll('#note-list .note-text').forEach(t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; });
  enableDrag(document.getElementById('note-list'), ids => {
    const ns = DB.notes(); DB.saveNotes(ids.map(id => ns.find(n => n.id === id)).filter(Boolean)); renderNotes(); syncNotes();
  });
}
function addNote() {
  const inp = document.getElementById('note-input'); const text = inp.value.trim(); if (!text) return;
  const ns = DB.notes(); ns.unshift({ id: 'n' + Date.now(), text, color: '', created: todayStr() });
  DB.saveNotes(ns); renderNotes(); syncNotes();
  document.getElementById('note-input').focus();
}
function syncNotes() {
  const url = DB.settings().syncUrl; if (!url) return;
  fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ type: 'notes', items: DB.notes() }) }).catch(() => {});
}
document.addEventListener('input', (ev) => {
  const nt = ev.target.closest('[data-note]');
  if (nt) { const ns = DB.notes(); const n = ns.find(x => x.id === nt.dataset.note); if (n) { n.text = nt.value; DB.saveNotes(ns); } nt.style.height = 'auto'; nt.style.height = nt.scrollHeight + 'px'; }
});
document.addEventListener('change', (ev) => { if (ev.target.closest('[data-note]')) syncNotes(); });

/* ============================================================
   SCREEN: PLANS  (named plan → its own checklist)
   ============================================================ */
let curPlan = null;   // null = list of plans; otherwise the open plan's id
function planProgress(p) { const its = p.items || []; return { t: its.length, d: its.filter(i => i.done).length }; }
function progressBar(d, t) {
  const pct = t ? Math.round(d / t * 100) : 0;
  return `<div class="pbar"><span style="width:${pct}%"></span></div>`;
}
function planRow(p) {
  const { t, d } = planProgress(p);
  return `<div class="lrow" data-id="${p.id}" style="${p.color?`border-left:3px solid ${colorHex(p.color)}`:''}">
    <div class="lrow-main">
      <span class="drag-handle" data-drag>⠿</span>
      <div class="txt plan-open" data-openplan="${p.id}">
        <div class="plan-name">${escapeHtml(p.name)}</div>
        <div class="plan-meta">${t?`${d}/${t} done`:'empty'} ${progressBar(d, t)}</div>
      </div>
      <button class="pal" data-palette="${p.id}" title="color"${p.color?` style="background:${colorHex(p.color)};border-color:${colorHex(p.color)}"`:''}></button>
      <button class="del" data-delplan="${p.id}">×</button>
    </div>
    ${openColorId===p.id ? swatchStrip(p.id) : ''}
  </div>`;
}
function planItemRow(it) {
  return `<div class="lrow ${it.done?'done':''}" data-id="${it.id}" style="${it.color?`border-left:3px solid ${colorHex(it.color)}`:''}">
    <div class="lrow-main">
      <span class="drag-handle" data-drag>⠿</span>
      <div class="check" data-planitem-toggle="${it.id}">✓</div>
      <div class="txt">${escapeHtml(it.text)}</div>
      <button class="pal" data-palette="${it.id}" title="color"${it.color?` style="background:${colorHex(it.color)};border-color:${colorHex(it.color)}"`:''}></button>
      <button class="del" data-planitem-del="${it.id}">×</button>
    </div>
    ${openColorId===it.id ? swatchStrip(it.id) : ''}
  </div>`;
}
function renderPlans() {
  document.getElementById('screen-title').textContent = 'Plans';
  const plans = DB.plans();

  // ---- LIST VIEW: all plan labels ----
  if (!curPlan) {
    document.getElementById('screen-sub').textContent = `${plans.length} plan${plans.length===1?'':'s'}`;
    document.getElementById('s-plans').innerHTML = `
      <div class="card">
        <div class="task-add">
          <input type="text" id="plan-input" placeholder="New plan name… (e.g. Launch app)" autocomplete="off">
          <button class="mic-ic" data-mic="#plan-input" title="speak">🎤</button>
          <button class="btn btn-primary btn-sm" id="plan-add-btn">Add</button>
        </div>
        <div class="hint" style="margin-top:8px">Each plan holds its own checklist. Tap a plan to open it · drag ⠿ to reorder · tap ◌ to color</div>
      </div>
      <div class="card" id="plan-list" style="padding:4px 16px">
        ${plans.length ? plans.map(planRow).join('') : '<div class="empty">No plans yet. Add one above 👆</div>'}
      </div>`;
    enableDrag(document.getElementById('plan-list'), ids => {
      const ps = DB.plans(); DB.savePlans(ids.map(id => ps.find(p => p.id === id)).filter(Boolean)); renderPlans();
    });
    return;
  }

  // ---- DETAIL VIEW: one plan's checklist ----
  const p = plans.find(x => x.id === curPlan);
  if (!p) { curPlan = null; return renderPlans(); }
  const items = p.items || [];
  const { t, d } = planProgress(p);
  document.getElementById('screen-sub').textContent = `${t?`${d}/${t} done`:'new plan'}`;
  document.getElementById('s-plans').innerHTML = `
    <div class="card">
      <button class="btn btn-ghost btn-sm" id="plan-back">← All plans</button>
      <input type="text" class="plan-title" data-planname="${p.id}" value="${escapeHtml(p.name)}" placeholder="Plan name…">
      <div class="hint" style="margin-top:6px">${t?`${d}/${t} done`:'No steps yet'} ${progressBar(d, t)}</div>
    </div>
    <div class="card">
      <h2>Checklist <span class="hint">drag ⠿ · tap ◌ to color · 🎤 to speak</span></h2>
      <div id="plan-item-list">${items.length ? items.map(planItemRow).join('') : '<div class="empty">No steps yet. Add one below 👇</div>'}</div>
      <div class="task-add">
        <input type="text" id="plan-item-input" placeholder="Add a step…" autocomplete="off">
        <button class="mic-ic" data-mic="#plan-item-input" title="speak">🎤</button>
        <button class="btn btn-primary btn-sm" id="plan-item-add-btn">Add</button>
      </div>
      ${items.some(i => i.done) ? '<div style="margin-top:12px"><button class="btn btn-ghost btn-sm" id="plan-clear-done">Clear completed</button></div>' : ''}
    </div>`;
  enableDrag(document.getElementById('plan-item-list'), ids => {
    const ps = DB.plans(); const pl = ps.find(x => x.id === curPlan); if (!pl) return;
    pl.items = ids.map(id => (pl.items || []).find(i => i.id === id)).filter(Boolean);
    DB.savePlans(ps); renderPlans();
  });
}
function addPlan() {
  const inp = document.getElementById('plan-input'); const name = inp.value.trim(); if (!name) return;
  const ps = DB.plans(); ps.unshift({ id: 'pl' + Date.now(), name, color: '', created: todayStr(), items: [] });
  DB.savePlans(ps); renderPlans();
  const f = document.getElementById('plan-input'); if (f) f.focus();
}
function addPlanItem() {
  const inp = document.getElementById('plan-item-input'); const text = inp.value.trim(); if (!text) return;
  const ps = DB.plans(); const p = ps.find(x => x.id === curPlan); if (!p) return;
  p.items = p.items || []; p.items.push({ id: 'pi' + Date.now(), text, done: false, color: '', created: todayStr() });
  DB.savePlans(ps); renderPlans();
  const f = document.getElementById('plan-item-input'); if (f) f.focus();
}
document.addEventListener('click', (ev) => {
  if (ev.target.id === 'plan-add-btn') return addPlan();
  const op = ev.target.closest('[data-openplan]');
  if (op) { curPlan = op.dataset.openplan; renderPlans(); window.scrollTo(0, 0); return; }
  const dp = ev.target.closest('[data-delplan]');
  if (dp) { if (!confirm('Delete this whole plan and its checklist?')) return; DB.savePlans(DB.plans().filter(p => p.id !== dp.dataset.delplan)); renderPlans(); return; }
  if (ev.target.id === 'plan-back') { curPlan = null; renderPlans(); return; }
  if (ev.target.id === 'plan-item-add-btn') return addPlanItem();
  const pt = ev.target.closest('[data-planitem-toggle]');
  if (pt) { const ps = DB.plans(); const p = ps.find(x => x.id === curPlan); const it = p && (p.items || []).find(i => i.id === pt.dataset.planitemToggle); if (it) { it.done = !it.done; DB.savePlans(ps); renderPlans(); } return; }
  const pid = ev.target.closest('[data-planitem-del]');
  if (pid) { const ps = DB.plans(); const p = ps.find(x => x.id === curPlan); if (p) { p.items = (p.items || []).filter(i => i.id !== pid.dataset.planitemDel); DB.savePlans(ps); renderPlans(); } return; }
  if (ev.target.id === 'plan-clear-done') { const ps = DB.plans(); const p = ps.find(x => x.id === curPlan); if (p) { p.items = (p.items || []).filter(i => !i.done); DB.savePlans(ps); renderPlans(); } return; }
});
document.addEventListener('keydown', (ev) => {
  if (ev.target.id === 'plan-input' && ev.key === 'Enter') addPlan();
  if (ev.target.id === 'plan-item-input' && ev.key === 'Enter') addPlanItem();
});
document.addEventListener('input', (ev) => {
  const pn = ev.target.closest('[data-planname]');
  if (pn) { const ps = DB.plans(); const p = ps.find(x => x.id === pn.dataset.planname); if (p) { p.name = pn.value; DB.savePlans(ps); } }
});

/* ============================================================
   SCREEN: GYM
   ============================================================ */
let gymDate = todayStr();
let gymDraft = { done: {}, log: {} };
let gymDayId = 'day1';
let gymView = 'home';
let openExr = new Set();

/* Gym customization: dp.gymcfg = { ex: {exId: {name?, sets?, tip?, hidden?}},
   custom: {groupId: [{id:'cx…', name, sets, tip}]} }. The cooked* helpers apply
   overrides + customs on top of WORKOUT_PLAN, so the plan file stays pristine. */
function gymCfg() { const s = localStorage.getItem('dp.gymcfg'); return s ? JSON.parse(s) : { ex: {}, custom: {} }; }
function saveGymCfg(c) { localStorage.setItem('dp.gymcfg', JSON.stringify(c)); pushState(); }
/* Custom muscle groups (dp.gymgroups) — brand-new groups whose exercises all
   live in gymCfg().custom[groupId]. */
function gymGroups() { return JSON.parse(localStorage.getItem('dp.gymgroups') || '[]'); }
function saveGymGroups(g) { localStorage.setItem('dp.gymgroups', JSON.stringify(g)); pushState(); }
function anyGroupById(id) {
  const cg = gymGroups().find(g => g.id === id);
  return cg ? Object.assign({ exercises: [] }, cg) : groupById(id);
}
function allGroups() { return WORKOUT_PLAN.concat(gymGroups()); }
/* The 6-day split is editable (dp.daycfg): rename days, pick each day's
   muscle group + core/abs rotation. */
function gymDays() {
  const s = localStorage.getItem('dp.daycfg');
  return s ? JSON.parse(s) : WORKOUT_DAYS.map(d => Object.assign({}, d));
}
function saveGymDays(d) { localStorage.setItem('dp.daycfg', JSON.stringify(d)); pushState(); }
function cookedGroupById(id) {
  const g = anyGroupById(id); const cfg = gymCfg();
  const own = g.exercises.map(e => Object.assign({}, e, cfg.ex[e.id] || {}));
  const extra = (cfg.custom[g.id] || []).map(e => Object.assign({ group: g.id, anim: '' }, e, cfg.ex[e.id] || {}));
  return Object.assign({}, g, { exercises: own.concat(extra).filter(e => !e.hidden) });
}
function cookedBlocks(day) {
  const cardio = cookedGroupById('cardio'), main = cookedGroupById(day.main), ab = cookedGroupById(day.ab);
  return [
    { title: '🏃 Cardio', color: cardio.color, exercises: cardio.exercises },
    { title: main.emoji + ' ' + main.name, color: main.color, exercises: main.exercises },
    { title: ab.emoji + ' ' + ab.name, color: ab.color, exercises: ab.exercises },
  ];
}
function cookedDayEx(day) { return cookedBlocks(day).reduce((a, b) => a.concat(b.exercises), []); }
function exName(id) {
  const cfg = gymCfg();
  const e = WORKOUT_BY_ID[id];
  if (e) return (cfg.ex[id] && cfg.ex[id].name) || e.name;
  for (const gid in cfg.custom) { const c = cfg.custom[gid].find(x => x.id === id); if (c) return (cfg.ex[id] && cfg.ex[id].name) || c.name; }
  return id;
}

function gymStreak() {
  const g = DB.gym(); let n = 0; let cur = todayStr();
  const has = d => g[d] && g[d].done && Object.values(g[d].done).some(Boolean);
  if (!has(cur)) cur = addDays(cur, -1);
  while (has(cur)) { n++; cur = addDays(cur, -1); }
  return n;
}
function openGym() {
  const d = DB.gymDay(gymDate);
  gymDraft = { done: Object.assign({}, d.done), log: Object.assign({}, d.log) };
  gymView = 'home';
  renderGym();
}
// Each day's ticks are independent: store keyed by "dayId/exerciseId".
function dkey(dayId, exId) { return dayId + '/' + exId; }
function exRow(ex) {
  const k = dkey(gymDayId, ex.id);
  const on = !!gymDraft.done[k];
  const open = openExr.has(k);
  const yt = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ex.name + ' proper form tutorial');
  const anim = (typeof renderAnim === 'function') ? renderAnim(ex.anim) : '';
  return `<div class="exr ${on?'on':''} ${open?'open':''}" data-exid="${ex.id}">
    <div class="exr-main">
      <div class="check" data-ex-toggle="${ex.id}">✓</div>
      <div class="exr-prev" data-ex-open="${ex.id}">${anim}</div>
      <div class="exr-info" data-ex-open="${ex.id}">
        <div class="name">${escapeHtml(ex.name)}</div>
        <div class="sets">${escapeHtml(ex.sets||'')}</div>
        ${ex.tip ? `<div class="tip">${escapeHtml(ex.tip)}</div>` : ''}
      </div>
      <div class="exr-chev" data-ex-open="${ex.id}">${open?'▲':'▼'}</div>
    </div>
    <div class="exr-howto">
      ${open ? `<div class="big">${anim}</div>` : ''}
      ${ex.tip ? `<div class="tip-box"><b>Form tip:</b> ${escapeHtml(ex.tip)}</div>` : ''}
      <div class="field"><label>Your reps / weight (optional)</label>
        <input type="text" data-ex-log="${ex.id}" value="${escapeHtml(gymDraft.log[k]||'')}" placeholder="e.g. 3 × 12 @ 40kg"></div>
      <a class="watch-btn" target="_blank" rel="noopener" href="${yt}">▶  Watch tutorial on YouTube</a>
    </div>
  </div>`;
}
function renderGym() {
  const isToday = gymDate === todayStr();
  document.getElementById('screen-title').textContent = 'Gym';
  document.getElementById('screen-sub').textContent = isToday ? prettyDate(gymDate) + " · today's workout" : 'Editing ' + prettyDate(gymDate);
  document.getElementById('s-gym').innerHTML = (gymView === 'day') ? gymDayHTML() : gymHomeHTML();
}
// HOME: 6 day labels (history-list style)
function gymHomeHTML() {
  const rows = gymDays().map(d => {
    const ex = cookedDayEx(d);
    const done = ex.filter(e => gymDraft.done[dkey(d.id, e.id)]).length;
    const main = cookedGroupById(d.main);
    const ab = cookedGroupById(d.ab);
    return `<div class="day-row" data-day="${d.id}">
      <div class="day-dot" style="background:${main.color}">${main.emoji}</div>
      <div class="day-info">
        <div class="day-name">${d.name} · ${main.name}</div>
        <div class="day-sub">🏃 Cardio · ${ab.emoji} ${ab.name}</div>
      </div>
      <div class="day-cnt">${done}/${ex.length}</div>
      <div class="day-go">›</div>
    </div>`;
  }).join('');
  return `
    <div class="card">
      <div class="field"><label>Date</label><input type="date" id="gym-date" value="${gymDate}" max="${todayStr()}"></div>
      <div class="progress-ring">
        <div class="big">🔥 ${gymStreak()}</div>
        <div><div style="font-weight:600">day gym streak</div><div class="hint">Tap a day to start 👇</div></div>
      </div>
    </div>
    <div class="card" style="padding:4px 16px">${rows}</div>
    <div style="height:14px"></div>`;
}
// DAY: that day's workouts on the next page
function gymDayHTML() {
  const days = gymDays();
  const day = days.find(d => d.id === gymDayId) || days[0];
  const main = cookedGroupById(day.main);
  const blocks = cookedBlocks(day);
  const ex = cookedDayEx(day);
  const done = ex.filter(e => gymDraft.done[dkey(day.id, e.id)]).length;
  const blockCards = blocks.map(b => `
    <div class="card">
      <h2><span style="color:${b.color}">${b.title}</span> <span class="hint">${b.exercises.filter(e=>gymDraft.done[dkey(day.id, e.id)]).length}/${b.exercises.length} · tap for how-to</span></h2>
      ${b.exercises.map(exRow).join('')}
    </div>`).join('');
  return `
    <button class="back-btn" id="gym-back">← All workouts</button>
    <div class="card">
      <div class="progress-ring">
        <div class="big">${done}/${ex.length}</div>
        <div><div style="font-weight:600">${day.name} · ${escapeHtml(main.name)}</div><div class="hint">🔥 ${gymStreak()} day streak · ${prettyDate(gymDate)}</div></div>
      </div>
    </div>
    ${blockCards}
    <button class="btn btn-primary" id="gym-save">Save workout</button>
    <div style="height:14px"></div>`;
}
document.addEventListener('click', async (ev) => {
  const grp = ev.target.closest('[data-day]');
  if (grp) { gymDayId = grp.dataset.day; gymView = 'day'; renderGym(); window.scrollTo(0, 0); return; }
  if (ev.target.id === 'gym-back') { gymView = 'home'; renderGym(); window.scrollTo(0, 0); return; }
  const tg = ev.target.closest('[data-ex-toggle]');
  if (tg) { const k = dkey(gymDayId, tg.dataset.exToggle); gymDraft.done[k] = !gymDraft.done[k]; renderGym(); return; }
  const op = ev.target.closest('[data-ex-open]');
  if (op) { const k = dkey(gymDayId, op.dataset.exOpen); if (openExr.has(k)) openExr.delete(k); else openExr.add(k); renderGym(); return; }
  if (ev.target.id === 'gym-save') {
    DB.putGymDay(gymDate, gymDraft);
    const doneIds = Object.keys(gymDraft.done).filter(k => gymDraft.done[k]);
    const detail = doneIds.map(k => { const nm = exName(k.split('/').pop()); return nm + (gymDraft.log[k] ? ` (${gymDraft.log[k]})` : ''); }).join('; ');
    const entry = DB.entry(gymDate) || { habits: {} };
    entry.workoutsDone = doneIds.length; entry.workoutDetail = detail;
    entry.updatedAt = new Date().toISOString();
    DB.putEntry(gymDate, entry);
    toast('Workout saved 💪');
    const synced = await syncEntry(gymDate, entry);
    if (synced) toast('Saved & synced 💪');
    return;
  }
});
document.addEventListener('input', (ev) => {
  const lg = ev.target.closest('[data-ex-log]'); if (lg) { gymDraft.log[dkey(gymDayId, lg.dataset.exLog)] = lg.value; }
});
document.addEventListener('change', (ev) => { if (ev.target.id === 'gym-date') { gymDate = ev.target.value; openGym(); } });

/* ============================================================
   SCREEN: TIME  (24h activity stopwatch + visual timeline)
   Tap an activity to start its timer; tapping another switches
   (the old one stops, the new one starts) — so the whole day gets
   recorded as back-to-back segments on a 24-hour scale.
   Segments are stored as epoch ms {id, act, start, end|null, upd},
   so one that crosses midnight just renders on both days.
   ============================================================ */
const DEFAULT_TIME_ACTS = [
  { id: 'sleep',  emoji: '😴', name: 'Sleep',           color: '#a78bfa' },
  { id: 'ready',  emoji: '🚿', name: 'Getting ready',   color: '#94a3b8' },
  { id: 'travel', emoji: '🚌', name: 'Travel',          color: '#fbbf24' },
  { id: 'work',   emoji: '💼', name: 'Work',            color: '#6d8cff' },
  { id: 'eat',    emoji: '🍽️', name: 'Eating',          color: '#34d399' },
  { id: 'break',  emoji: '☕', name: 'Break',           color: '#4ad6c0' },
  { id: 'gymt',   emoji: '💪', name: 'Gym',             color: '#f87171' },
  { id: 'learn',  emoji: '📖', name: 'Learning',        color: '#ec4899' },
  { id: 'scroll', emoji: '📱', name: 'Scrolling',       color: '#fb923c' },
  { id: 'social', emoji: '👥', name: 'Friends & family', color: '#22d3ee' },
];
const CUSTOM_ACT_COLORS = ['#f472b6', '#818cf8', '#2dd4bf', '#facc15', '#fb7185', '#a3e635'];
function actCfg() { const s = localStorage.getItem('dp.actcfg'); return s ? JSON.parse(s) : DEFAULT_TIME_ACTS.map(a => Object.assign({}, a)); }
function saveActCfg(cfg) { localStorage.setItem('dp.actcfg', JSON.stringify(cfg)); reloadCfg(); pushState(); }
let TIME_ACTS_ALL = actCfg();
/* visible activities = non-hidden defaults + non-hidden customs */
function allActs() { return TIME_ACTS_ALL.filter(a => !a.hidden).concat(DB.timeacts().filter(a => !a.hidden)); }
/* lookups include hidden ones so old timeline blocks still render right */
function actById(id) { return TIME_ACTS_ALL.concat(DB.timeacts()).find(a => a.id === id) || { id, emoji: '⏱️', name: id, color: '#64748b' }; }

let ttDate = todayStr();       // day being viewed on the timeline
let ttSelSeg = null;           // selected segment id (shows the edit card)
let ttShowManual = false;      // manual "forgot to track" form open?

function runningSeg() { return DB.timelog().find(s => s.end == null) || null; }
function fmtDur(ms, short) {
  ms = Math.max(0, ms);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
  if (h) return `${h}h ${String(m).padStart(2,'0')}m`;
  if (m) return short ? `${m}m` : `${m}m ${String(s).padStart(2,'0')}s`;
  return short ? '<1m' : `${s}s`;
}
function fmtClock(ms) { const d = new Date(ms); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }

function startAct(actId) {
  const log = DB.timelog(); const now = Date.now();
  const run = log.find(s => s.end == null);
  if (run) {
    run.end = now; run.upd = now;
    if (run.act === actId) {   // tapping the running activity = just stop it
      DB.saveTimelog(log); renderTime(); refreshTimerNotif(); toast(`⏹ ${actById(actId).name} stopped · ${fmtDur(run.end - run.start)}`); return;
    }
  }
  log.push({ id: 'ts' + now, act: actId, start: now, end: null, upd: now });
  DB.saveTimelog(log); ttDate = todayStr(); renderTime(); refreshTimerNotif();
  toast(`▶ ${actById(actId).name} started`);
}

/* Segments overlapping the viewed day, clipped to it (handles cross-midnight). */
function segsForDay(dateStr) {
  const d0 = new Date(dateStr + 'T00:00:00').getTime(), d1 = d0 + 86400000;
  const now = Date.now();
  return DB.timelog()
    .map(s => ({ seg: s, a: Math.max(s.start, d0), b: Math.min(s.end == null ? now : s.end, d1) }))
    .filter(x => x.b > x.a)
    .sort((x, y) => x.a - y.a);
}

function timelineHTML(dateStr) {
  const d0 = new Date(dateStr + 'T00:00:00').getTime();
  const px = t => ((t - d0) / 86400000 * 100).toFixed(2) + '%';
  const clips = segsForDay(dateStr);
  const blocks = clips.map(({ seg, a, b }) => {
    const act = actById(seg.act);
    const run = seg.end == null;
    return `<div class="tl-seg ${run ? 'run' : ''} ${ttSelSeg === seg.id ? 'sel' : ''}" data-seg="${seg.id}"
      style="left:${px(a)};width:${((b - a) / 86400000 * 100).toFixed(2)}%;background:${act.color}"
      title="${escapeHtml(act.name)} ${fmtClock(a)}–${run ? 'now' : fmtClock(b)}"></div>`;
  }).join('');
  const isToday = dateStr === todayStr();
  const nowLine = isToday ? `<div class="tl-now" style="left:${px(Date.now())}"></div>` : '';
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => `<span>${h}</span>`).join('');
  return `<div class="tl-wrap" id="tl-wrap">${blocks}${nowLine}</div><div class="tl-ticks">${ticks}</div>`;
}

function timeTotalsHTML(dateStr) {
  const totals = {};
  segsForDay(dateStr).forEach(({ seg, a, b }) => { totals[seg.act] = (totals[seg.act] || 0) + (b - a); });
  const acts = Object.keys(totals).map(id => ({ act: actById(id), ms: totals[id] })).sort((x, y) => y.ms - x.ms);
  if (!acts.length) return '<div class="empty">Nothing tracked this day yet.</div>';
  const tracked = acts.reduce((s, x) => s + x.ms, 0);
  const max = acts[0].ms;
  const rows = acts.map(x => `<div class="bar-row"><span class="name">${x.act.emoji} ${escapeHtml(x.act.name)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.round(x.ms / max * 100)}%;background:${x.act.color}"></span></span>
      <span class="pct" style="width:56px">${fmtDur(x.ms, true)}</span></div>`).join('');
  // "untracked" compares against how much of the day has actually elapsed (full 24h for past days)
  const dayStart = new Date(dateStr + 'T00:00:00').getTime();
  const elapsed = dateStr === todayStr() ? Math.min(86400000, Date.now() - dayStart) : 86400000;
  return rows + `<div class="hint" style="margin-top:8px">Tracked <b>${fmtDur(tracked)}</b> · untracked ${fmtDur(Math.max(0, elapsed - tracked))}</div>`;
}

function segEditHTML() {
  if (!ttSelSeg) return '';
  const seg = DB.timelog().find(s => s.id === ttSelSeg);
  if (!seg) { ttSelSeg = null; return ''; }
  const act = actById(seg.act);
  const run = seg.end == null;
  return `<div class="card" style="border-color:${act.color}">
    <h2>${act.emoji} ${escapeHtml(act.name)} <span class="hint">${fmtDur((run ? Date.now() : seg.end) - seg.start)} · tap times to fix them</span></h2>
    <div class="row2">
      <div class="field"><label>Started</label><input type="time" data-segt="start" value="${fmtClock(seg.start)}"></div>
      <div class="field"><label>Ended</label><input type="time" data-segt="end" value="${run ? '' : fmtClock(seg.end)}" ${run ? 'disabled placeholder="running…"' : ''}></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost btn-sm" id="seg-close">Close</button>
      <button class="btn btn-ghost btn-sm" id="seg-del" style="color:var(--bad,#f87171)">🗑 Delete</button>
    </div>
  </div>`;
}

function openTime() { ttDate = todayStr(); ttSelSeg = null; renderTime(); }
function renderTime() {
  document.getElementById('screen-title').textContent = 'Time';
  const run = runningSeg();
  document.getElementById('screen-sub').textContent = run ? `⏱ ${actById(run.act).name} running` : '24-hour activity tracker';

  const nowCard = run ? (() => { const act = actById(run.act); return `
    <div class="card tt-now" style="border-color:${act.color}">
      <div class="tt-now-emoji">${act.emoji}</div>
      <div class="tt-now-info">
        <div class="tt-now-name">${escapeHtml(act.name)}</div>
        <div class="tt-now-since hint">since ${fmtClock(run.start)}</div>
      </div>
      <div class="tt-now-elapsed" id="tt-elapsed">${fmtDur(Date.now() - run.start)}</div>
      <button class="btn btn-primary btn-sm" id="tt-stop">⏹ Stop</button>
    </div>`; })() : `
    <div class="card tt-now idle">
      <div class="tt-now-emoji">⏱️</div>
      <div class="tt-now-info"><div class="tt-now-name">Nothing running</div>
      <div class="hint">Tap an activity below to start tracking 👇</div></div>
    </div>`;

  const chips = allActs().map(a => {
    const on = run && run.act === a.id;
    return `<button class="act-chip ${on ? 'on' : ''}" data-act-start="${a.id}"
      style="--c:${a.color}"><span class="emoji">${a.emoji}</span><span>${escapeHtml(a.name)}</span>${on ? '<span class="live">●</span>' : ''}</button>`;
  }).join('');

  const isToday = ttDate === todayStr();
  const manual = ttShowManual ? `
    <div class="tt-manual">
      <select id="tt-m-act">${allActs().map(a => `<option value="${a.id}">${a.emoji} ${escapeHtml(a.name)}</option>`).join('')}</select>
      <input type="time" id="tt-m-start"><span class="hint">to</span><input type="time" id="tt-m-end">
      <button class="btn btn-primary btn-sm" id="tt-m-save">Add</button>
    </div>` : '';

  document.getElementById('s-time').innerHTML = `
    ${nowCard}
    <div class="card">
      <h2>Switch to <span class="hint">tapping switches instantly — the old timer stops itself</span></h2>
      <div class="act-grid">${chips}</div>
      <div class="task-add" style="margin-top:10px">
        <input type="text" id="tt-newact" placeholder="Add your own activity… (e.g. Cooking)" autocomplete="off">
        <button class="btn btn-ghost btn-sm" id="tt-newact-add">Add</button>
      </div>
    </div>
    <div class="card">
      <h2>📊 Your day on a 24h scale
        <span class="hint">tap a block to fix or delete it</span></h2>
      <div class="field"><label>Date</label><input type="date" id="tt-date" value="${ttDate}" max="${todayStr()}"></div>
      ${timelineHTML(ttDate)}
      <div class="tl-legend">${[...new Set(segsForDay(ttDate).map(x => x.seg.act))].map(id => { const a = actById(id); return `<span><span class="dot" style="background:${a.color}"></span>${a.emoji} ${escapeHtml(a.name)}</span>`; }).join('') || '<span class="hint">empty day</span>'}</div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn btn-ghost btn-sm" id="tt-manual-toggle">${ttShowManual ? '✕ Cancel' : '＋ Add a block I forgot to track'}</button>
      </div>
      ${manual}
    </div>
    ${segEditHTML()}
    <div class="card">
      <h2>⏳ Where the ${isToday ? 'day is going' : 'day went'} <span class="hint">${prettyDate(ttDate)}</span></h2>
      ${timeTotalsHTML(ttDate)}
    </div>
    <div style="height:14px"></div>`;
}

/* ---------- Sync the time log to the Sheet ----------
   Two things go over: ① a readable "Time Log" tab (one row per block, cross-midnight
   blocks split per day) and ② a per-day "timeSummary" column on the daily Log row
   (e.g. "Work 6h 20m · Travel 1h 05m"). Debounced so rapid switches send once. */
let timelogSyncTimer;
function syncTimelog() { clearTimeout(timelogSyncTimer); timelogSyncTimer = setTimeout(syncTimelogNow, 1500); }
function syncTimelogNow() {
  const url = DB.settings().syncUrl; if (!url) return;
  const items = [];
  const touchedDates = new Set();
  DB.timelog().forEach(s => {
    const running = s.end == null;
    const end = running ? Date.now() : s.end;
    let a = s.start;
    while (a < end) {                             // split per calendar day for the sheet
      const dayStr = todayStr(new Date(a));
      const dayEnd = new Date(dayStr + 'T00:00:00').getTime() + 86400000;
      const b = Math.min(end, dayEnd);
      const act = actById(s.act);
      items.push({ date: dayStr, activity: act.emoji + ' ' + act.name,
        start: fmtClock(a), end: (running && b === end) ? 'running' : fmtClock(b),
        duration: fmtDur(b - a), hours: +((b - a) / 3600000).toFixed(2) });
      touchedDates.add(dayStr);
      a = b;
    }
  });
  items.sort((x, y) => x.date === y.date ? (x.start < y.start ? -1 : 1) : (x.date < y.date ? -1 : 1));
  fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ type: 'timelog', items }) }).catch(() => {});
  touchedDates.forEach(updateTimeSummary);
}
/* Write "Work 6h 20m · Travel 1h 05m" into the day's entry so it lands on the Log row. */
function updateTimeSummary(dateStr) {
  const totals = {};
  segsForDay(dateStr).forEach(({ seg, a, b }) => { totals[seg.act] = (totals[seg.act] || 0) + (b - a); });
  const parts = Object.keys(totals).sort((x, y) => totals[y] - totals[x])
    .map(id => { const act = actById(id); return `${act.emoji} ${act.name} ${fmtDur(totals[id])}`; });
  if (!parts.length) return;
  const entry = DB.entry(dateStr) || { habits: {} };
  const summary = parts.join(' · ');
  if (entry.timeSummary === summary) return;     // nothing changed — skip the network call
  entry.timeSummary = summary;
  entry.updatedAt = new Date().toISOString();
  DB.putEntry(dateStr, entry);
  syncEntry(dateStr, entry);
}

/* live ticker — updates the elapsed readout each second; light-refreshes the
   timeline once a minute (skipped while you're typing in an input) */
setInterval(() => {
  if (!document.getElementById('s-time').classList.contains('on')) return;
  const run = runningSeg(); if (!run) return;
  const el = document.getElementById('tt-elapsed');
  if (el) el.textContent = fmtDur(Date.now() - run.start);
  const sec = new Date().getSeconds();
  const typing = document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (sec === 0 && !typing && ttDate === todayStr()) {
    const w = document.getElementById('tl-wrap');
    if (w) w.outerHTML = timelineHTML(ttDate).split('<div class="tl-ticks">')[0];
  }
}, 1000);

document.addEventListener('click', (ev) => {
  if (!document.getElementById('s-time').classList.contains('on')) return;
  const st = ev.target.closest('[data-act-start]');
  if (st) { startAct(st.dataset.actStart); return; }
  if (ev.target.id === 'tt-stop') { const run = runningSeg(); if (run) startAct(run.act); return; }   // startAct on the running act = stop
  const sg = ev.target.closest('[data-seg]');
  if (sg) { ttSelSeg = (ttSelSeg === sg.dataset.seg) ? null : sg.dataset.seg; renderTime(); return; }
  if (ev.target.id === 'seg-close') { ttSelSeg = null; renderTime(); return; }
  if (ev.target.id === 'seg-del') {
    DB.saveTimelog(DB.timelog().filter(s => s.id !== ttSelSeg));
    ttSelSeg = null; renderTime(); toast('Block deleted'); return;
  }
  if (ev.target.id === 'tt-manual-toggle') { ttShowManual = !ttShowManual; renderTime(); return; }
  if (ev.target.id === 'tt-m-save') {
    const act = document.getElementById('tt-m-act').value;
    const sv = document.getElementById('tt-m-start').value, ev2 = document.getElementById('tt-m-end').value;
    if (!sv || !ev2) { toast('Pick both times', true); return; }
    const d0 = new Date(ttDate + 'T00:00:00').getTime();
    const toMs = t => { const [h, m] = t.split(':').map(Number); return d0 + (h * 60 + m) * 60000; };
    const a = toMs(sv), b = toMs(ev2);
    if (b <= a) { toast('End must be after start', true); return; }
    const log = DB.timelog(); const now = Date.now();
    log.push({ id: 'ts' + now, act, start: a, end: b, upd: now });
    log.sort((x, y) => x.start - y.start);
    DB.saveTimelog(log); ttShowManual = false; renderTime(); toast('Block added ✅'); return;
  }
  if (ev.target.id === 'tt-newact-add') {
    const inp = document.getElementById('tt-newact'); const name = inp.value.trim(); if (!name) return;
    const acts = DB.timeacts();
    acts.push({ id: 'ta' + Date.now(), emoji: '⭐', name, color: CUSTOM_ACT_COLORS[acts.length % CUSTOM_ACT_COLORS.length] });
    DB.saveTimeacts(acts); renderTime(); toast(`"${name}" added`); return;
  }
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'tt-date') { ttDate = ev.target.value; ttSelSeg = null; renderTime(); return; }
  const te = ev.target.closest('[data-segt]');
  if (te && ttSelSeg) {
    const log = DB.timelog(); const seg = log.find(s => s.id === ttSelSeg); if (!seg || !ev.target.value) return;
    const [h, m] = ev.target.value.split(':').map(Number);
    const base = new Date(te.dataset.segt === 'start' ? seg.start : seg.end);   // keep the segment's own date, change only the clock time
    base.setHours(h, m, 0, 0);
    const v = base.getTime();
    if (te.dataset.segt === 'start' && seg.end != null && v >= seg.end) { toast('Start must be before end', true); renderTime(); return; }
    if (te.dataset.segt === 'end' && v <= seg.start) { toast('End must be after start', true); renderTime(); return; }
    seg[te.dataset.segt] = v; seg.upd = Date.now();
    DB.saveTimelog(log); renderTime(); toast('Time fixed ✅');
  }
});

/* ============================================================
   SCREEN: HABITS (streaks + heatmaps)
   ============================================================ */
function renderHabits() {
  document.getElementById('screen-title').textContent = 'Habits';
  document.getElementById('screen-sub').textContent = 'Streaks & consistency';
  const e = DB.entries();
  const days = []; for (let i = 90; i >= 0; i--) days.push(addDays(todayStr(), -i));

  const cards = HABITS.map(h => {
    const st = habitStreak(h.key);
    const last30 = days.slice(-30);
    const hits = last30.filter(d => e[d] && e[d].habits && e[d].habits[h.key]).length;
    const pct = Math.round(hits / 30 * 100);
    const heat = days.map(d => {
      const on = e[d] && e[d].habits && e[d].habits[h.key];
      return `<div class="cell" title="${d}" style="background:${on?'var(--good)':'var(--bg-input)'}"></div>`;
    }).join('');
    return `<div class="card">
      <h2>${h.emoji} ${h.label}
        <span class="hint" style="float:right">🔥 ${st} day${st===1?'':'s'} · ${pct}% / 30d</span></h2>
      <div class="heat">${heat}</div>
    </div>`;
  }).join('');
  document.getElementById('s-habits').innerHTML = cards;
}

/* ============================================================
   SCREEN: DASHBOARD
   ============================================================ */
function lineChart(values, color) {
  // values: array of {x:label, y:number|null}
  const w = 320, h = 130, pad = 8;
  const ys = values.map(v => v.y).filter(v => v != null);
  if (!ys.length) return '<div class="empty">No data yet</div>';
  const min = Math.min(...ys, 0), max = Math.max(...ys, 10);
  const n = values.length;
  const px = i => pad + (i / Math.max(1, n - 1)) * (w - pad * 2);
  const py = y => h - pad - ((y - min) / Math.max(1, max - min)) * (h - pad * 2);
  let d = '', pts = '';
  values.forEach((v, i) => {
    if (v.y == null) return;
    d += (d ? 'L' : 'M') + px(i).toFixed(1) + ',' + py(v.y).toFixed(1) + ' ';
    pts += `<circle cx="${px(i).toFixed(1)}" cy="${py(v.y).toFixed(1)}" r="2.4" fill="${color}"/>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts}</svg>`;
}
/* Polymath Index — one 0-100 score/day from 5 pillars. Missing metrics are skipped,
   so even a light day scores fairly (only what you logged counts). */
function polymath(e) {
  if (!e) return null;
  const num = v => (v != null && v !== '' && !isNaN(+v)) ? +v : null;
  const cl = v => Math.max(0, Math.min(100, v));
  const s10 = v => { v = num(v); return v == null ? null : cl(v / 10 * 100); };          // higher = better
  const s10i = v => { v = num(v); return v == null ? null : cl((10 - v) / 9 * 100); };    // lower = better
  const tgt = (v, t) => { v = num(v); return v == null ? null : cl(v / t * 100); };
  const hb = k => (e.habits && k in e.habits) ? (e.habits[k] ? 100 : 0) : null;
  const mean = arr => { const a = arr.filter(x => x != null); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };

  const body = mean([tgt(e.sleepHours, 8), s10(e.sleepQuality), s10(e.energy), tgt(e.water, 8), hb('workout'), hb('faceWorkout'), hb('healthyFood')]);
  const mind = mean([s10(e.mood), s10(e.happiness), s10i(e.stress), s10i(e.anxiety), s10(e.clarity), s10(e.focus), s10(e.motivation), hb('meditation')]);
  let tasksR = null;
  if (e.tasksDone != null && e.tasksDone !== '' && +e.tasksPlanned > 0) tasksR = cl(+e.tasksDone / +e.tasksPlanned * 100);
  const work = mean([tgt(e.deepWorkHours, 4), s10(e.productivity), s10(e.efficiency), s10(e.workSatisfaction), tasksR]);
  const topicsN = e.topics ? cl(Object.values(e.topics).filter(Boolean).length / 3 * 100) : null;
  const learning = mean([hb('reading'), hb('english'), hb('consumed'), hb('projectAI'), hb('projectSpace'), s10(e.retention), topicsN, tgt(e.codeLines, 100)]);
  let discipline = null;
  if (e.habits) discipline = cl(HABITS.filter(h => e.habits[h.key]).length / HABITS.length * 100);

  const total = mean([body, mind, work, learning, discipline]);
  return total == null ? null : { total: Math.round(total), body, mind, work, learning, discipline };
}
// Auto-written weekly review from the last 7 days (no AI needed — pure analysis).
function coachReview() {
  const e = DB.entries();
  const win = start => { const a = []; for (let i = start; i < start + 7; i++) a.push(addDays(todayStr(), -i)); return a; };
  const thisW = win(0), lastW = win(7);
  const logged = thisW.filter(d => e[d]).length;
  if (!logged) return null;
  const pmAvg = ds => { const v = ds.map(d => e[d] ? polymath(e[d]) : null).filter(Boolean).map(p => p.total); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const avgOf = (ds, k) => { const v = ds.map(d => e[d] && e[d][k] != null && e[d][k] !== '' ? +e[d][k] : null).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const lines = [];
  const pmT = pmAvg(thisW), pmL = pmAvg(lastW);
  let head = `Polymath averaged <b>${pmT ?? '–'}/100</b> this week`;
  if (pmT != null && pmL != null) { const d = pmT - pmL; head += ` <span style="color:${d>=0?'var(--good)':'var(--bad)'}">${d>=0?'▲ +':'▼ '}${d}</span> vs last week`; }
  lines.push({ t: head, k: 'head' });
  lines.push({ t: `Logged <b>${logged}/7</b> days · 🔥 ${loggedStreak()}-day streak`, k: 'ok' });
  let best = null; thisW.forEach(d => { const p = e[d] ? polymath(e[d]) : null; if (p && (!best || p.total > best.s)) best = { d, s: p.total }; });
  if (best) lines.push({ t: `Best day: <b>${prettyDate(best.d)}</b> (${best.s}/100)`, k: 'ok' });
  const sl = avgOf(thisW, 'sleepHours');
  if (sl != null) lines.push({ t: `😴 Sleep averaged <b>${sl.toFixed(1)}h</b>${sl < 7 ? ' — aim for 7h+' : ' — solid'}`, k: sl < 7 ? 'warn' : 'ok' });
  const wo = thisW.filter(d => e[d] && e[d].workoutsDone > 0).length;
  lines.push({ t: `💪 Worked out <b>${wo}/7</b> days`, k: wo >= 3 ? 'ok' : 'warn' });
  let strong = null, weak = null;
  HABITS.forEach(h => { const c = thisW.filter(d => e[d] && e[d].habits && e[d].habits[h.key]).length;
    if (!strong || c > strong.c) strong = { h, c }; if (!weak || c < weak.c) weak = { h, c }; });
  if (strong && strong.c > 0) lines.push({ t: `Most consistent: <b>${strong.h.emoji} ${strong.h.label}</b> (${strong.c}/7)`, k: 'ok' });
  if (weak && weak.c < logged) lines.push({ t: `Needs love: <b>${weak.h.emoji} ${weak.h.label}</b> (${weak.c}/7)`, k: 'warn' });
  const mWo = avgOf(thisW.filter(d => e[d] && e[d].workoutsDone > 0), 'mood');
  const mNo = avgOf(thisW.filter(d => e[d] && !(e[d].workoutsDone > 0)), 'mood');
  if (mWo != null && mNo != null && mWo - mNo >= 0.5) lines.push({ t: `💡 Your mood is <b>+${(mWo - mNo).toFixed(1)}</b> higher on workout days — keep moving.`, k: 'tip' });
  return lines;
}
function exportCSV() {
  const e = DB.entries(); const dates = Object.keys(e).sort();
  if (!dates.length) { toast('Nothing to export yet', true); return; }
  const cols = ['date', 'mood', 'energy', 'sleepHours', 'deepWorkHours', 'tasksDone', 'tasksPlanned', 'workoutsDone', 'workoutDetail', 'timeSummary', 'wentWell', 'improve', 'journal', 'tasks'];
  const esc = v => { v = String(v == null ? '' : v).replace(/"/g, '""'); return /[",\n]/.test(v) ? `"${v}"` : v; };
  let csv = cols.join(',') + '\n';
  dates.forEach(d => csv += cols.map(c => esc(c === 'date' ? d : e[d][c])).join(',') + '\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'daily-pulse-' + todayStr() + '.csv'; a.click(); toast('CSV exported');
}
/* ---------- Obsidian-style connections graph ----------
   Nodes: days, topics, habits. Edges link each day to its topics + habits done,
   so shared topics/habits become hubs that connect your days. */
let graphFocus = null;
function extractTags(s) { const out = []; const m = String(s || '').match(/#[a-z0-9_]+/gi); if (m) m.forEach(t => { t = t.toLowerCase(); if (!out.includes(t)) out.push(t); }); return out; }
function buildGraph() {
  const e = DB.entries();
  const days = Object.keys(e).sort().slice(-21);
  const nodes = {}; const links = [];
  const add = (id, type, label) => { if (!nodes[id]) nodes[id] = { id, type, label, deg: 0 }; };
  days.forEach(d => {
    add('d:' + d, 'day', prettyDate(d).replace(/^[A-Za-z]+,\s*/, ''));
    const en = e[d];
    if (en.topics) Object.keys(en.topics).filter(k => en.topics[k]).forEach(t => { add('t:' + t, 'topic', t); links.push(['d:' + d, 't:' + t]); });
    if (en.habits) HABITS.forEach(h => { if (en.habits[h.key]) { add('h:' + h.key, 'habit', h.label); links.push(['d:' + d, 'h:' + h.key]); } });
    // #tags from the day's journal/reflection
    [...new Set([].concat(extractTags(en.journal), extractTags(en.wentWell), extractTags(en.improve), extractTags(en.keyInsight)))]
      .forEach(tg => { add('g:' + tg, 'tag', tg); links.push(['d:' + d, 'g:' + tg]); });
  });
  // notes with #tags become nodes too (link to days via shared tags)
  DB.notes().forEach(nt => {
    const tags = [...new Set(extractTags(nt.text))]; if (!tags.length) return;
    add('n:' + nt.id, 'note', (nt.text || '').replace(/#[a-z0-9_]+/gi, '').trim().slice(0, 14) || 'note');
    tags.forEach(tg => { add('g:' + tg, 'tag', tg); links.push(['n:' + nt.id, 'g:' + tg]); });
  });
  const ns = nodes; links.forEach(([a, b]) => { if (ns[a]) ns[a].deg++; if (ns[b]) ns[b].deg++; });
  return { nodes: Object.values(nodes), links: links.filter(([a, b]) => ns[a] && ns[b]) };
}
function layoutGraph(g, W, H) {
  const N = g.nodes.length; if (!N) return;
  const idx = {}; g.nodes.forEach((n, i) => { idx[n.id] = i; const a = 2 * Math.PI * i / N; n.x = W / 2 + Math.cos(a) * W * 0.32; n.y = H / 2 + Math.sin(a) * H * 0.32; n.vx = 0; n.vy = 0; });
  const L = g.links.map(([a, b]) => [idx[a], idx[b]]);
  for (let it = 0; it < 220; it++) {
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const a = g.nodes[i], b = g.nodes[j]; let dx = a.x - b.x, dy = a.y - b.y; const d2 = dx * dx + dy * dy + 0.01; const d = Math.sqrt(d2); const f = 1400 / d2; dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    L.forEach(([i, j]) => { const a = g.nodes[i], b = g.nodes[j]; let dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) + 0.01; const f = (d - 58) * 0.02; dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f; });
    g.nodes.forEach(n => { n.vx += (W / 2 - n.x) * 0.003; n.vy += (H / 2 - n.y) * 0.003; n.x += Math.max(-7, Math.min(7, n.vx)); n.y += Math.max(-7, Math.min(7, n.vy)); n.vx *= 0.86; n.vy *= 0.86; n.x = Math.max(12, Math.min(W - 12, n.x)); n.y = Math.max(14, Math.min(H - 8, n.y)); });
  }
}
function graphSVG() {
  const g = buildGraph();
  if (g.nodes.length < 2) return '<div class="empty">Log a few days with topics &amp; habits — your graph grows here.</div>';
  const W = 340, H = 300; layoutGraph(g, W, H);
  const pos = {}; g.nodes.forEach(n => pos[n.id] = n);
  const col = t => ({ day: '#6d8cff', topic: '#fbbf24', habit: '#34d399', tag: '#ec4899', note: '#a78bfa' }[t] || '#34d399');
  const focus = (graphFocus && pos[graphFocus]) ? graphFocus : null;
  const near = new Set(); if (focus) { near.add(focus); g.links.forEach(([a, b]) => { if (a === focus) near.add(b); if (b === focus) near.add(a); }); }
  const edges = g.links.map(([a, b]) => { const on = focus && (a === focus || b === focus); return `<line x1="${pos[a].x.toFixed(1)}" y1="${pos[a].y.toFixed(1)}" x2="${pos[b].x.toFixed(1)}" y2="${pos[b].y.toFixed(1)}" stroke="${on ? '#6d8cff' : '#2a3550'}" stroke-width="${on ? 1.6 : 0.7}" opacity="${focus && !on ? 0.12 : 0.55}"/>`; }).join('');
  const circ = g.nodes.map(n => { const r = Math.min(12, 4 + n.deg * 0.8); const dim = focus && !near.has(n.id); const showLabel = n.id === focus || (n.type !== 'day' && n.deg >= 2);
    return `<g opacity="${dim ? 0.18 : 1}"><circle data-node="${escapeHtml(n.id)}" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r}" fill="${col(n.type)}" stroke="${n.id === focus ? '#fff' : 'none'}" stroke-width="2"/>${showLabel ? `<text x="${n.x.toFixed(1)}" y="${(n.y - r - 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="var(--text-dim)">${escapeHtml(n.label)}</text>` : ''}</g>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;touch-action:none" id="graph-svg">${edges}${circ}</svg>
    <div class="legend"><span><span class="dot" style="background:#6d8cff"></span>Day</span><span><span class="dot" style="background:#fbbf24"></span>Topic</span><span><span class="dot" style="background:#34d399"></span>Habit</span><span><span class="dot" style="background:#ec4899"></span>#tag</span><span><span class="dot" style="background:#a78bfa"></span>Note</span></div>
    <div class="hint" style="margin-top:4px">${focus ? `Connections for <b style="color:var(--text)">${escapeHtml(pos[focus].label)}</b> · tap it again to reset` : 'Tap a node · add #tags in journals/notes to link them'}</div>`;
}
/* ---------- Time-log analytics for the Stats screen ---------- */
function timeStatsHTML(days) {
  // days: chronological list of YYYY-MM-DD in the selected range
  const dayData = days.map(d => ({ d, clips: segsForDay(d) }));
  const totals = {};                      // actId -> ms over the whole range
  const byDay = {};                       // date -> {actId -> ms}
  let tracked = 0, activeDays = 0;
  dayData.forEach(({ d, clips }) => {
    if (clips.length) activeDays++;
    byDay[d] = {};
    clips.forEach(({ seg, a, b }) => {
      totals[seg.act] = (totals[seg.act] || 0) + (b - a);
      byDay[d][seg.act] = (byDay[d][seg.act] || 0) + (b - a);
      tracked += b - a;
    });
  });
  const actIds = Object.keys(totals).sort((x, y) => totals[y] - totals[x]);
  if (!actIds.length) return '';          // nothing tracked in range → no time cards at all

  // ---- headline stats ----
  const elapsedInRange = days.reduce((s, d) => {
    const d0 = new Date(d + 'T00:00:00').getTime();
    return s + Math.max(0, Math.min(86400000, Date.now() - d0));
  }, 0);
  const coverage = elapsedInRange ? Math.round(tracked / elapsedInRange * 100) : 0;
  const top = actById(actIds[0]);
  const topShare = Math.round(totals[actIds[0]] / tracked * 100);

  // ---- per-activity bars: total + avg per active day ----
  const maxT = totals[actIds[0]];
  const actBars = actIds.map(id => {
    const act = actById(id);
    const daysWith = days.filter(d => byDay[d][id]).length;
    const avg = totals[id] / Math.max(1, daysWith);
    return `<div class="bar-row"><span class="name">${act.emoji} ${escapeHtml(act.name)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.round(totals[id] / maxT * 100)}%;background:${act.color}"></span></span>
      <span class="pct" style="width:92px">${fmtDur(totals[id])} · ~${fmtDur(avg)}/d</span></div>`;
  }).join('');

  // ---- trend chart: hours/day for the top 2 activities ----
  const hSeries = id => days.map(d => ({ x: d, y: dayHasData(d) ? +((byDay[d][id] || 0) / 3600000).toFixed(2) : null }));
  function dayHasData(d) { return Object.keys(byDay[d]).length > 0; }
  const trendActs = actIds.slice(0, 2).map(actById);
  const trend = trendActs.map((act, i) =>
    `<div style="${i ? 'margin-top:-6px' : ''}">${lineChart(hSeries(actIds[i]), act.color)}</div>`).join('');
  const trendLegend = trendActs.map(a =>
    `<span><span class="dot" style="background:${a.color}"></span>${a.emoji} ${escapeHtml(a.name)} (h/day)</span>`).join('');

  // ---- day-by-day 24h strips (newest first, capped at 14 rows) ----
  const stripDays = dayData.filter(x => x.clips.length).slice(-14).reverse();
  const strips = stripDays.map(({ d, clips }) => {
    const d0 = new Date(d + 'T00:00:00').getTime();
    const px = t => ((t - d0) / 86400000 * 100).toFixed(2) + '%';
    const blocks = clips.map(({ seg, a, b }) => { const act = actById(seg.act);
      return `<div class="tl-seg" style="left:${px(a)};width:${((b - a) / 86400000 * 100).toFixed(2)}%;background:${act.color}" title="${escapeHtml(act.name)}"></div>`; }).join('');
    return `<div class="tl-day-row"><span class="tl-day-lab">${prettyDate(d).replace(/,.*$/, '')} ${d.slice(8)}</span><div class="tl-wrap tl-mini">${blocks}</div></div>`;
  }).join('');
  const stripLegend = actIds.map(id => { const a = actById(id);
    return `<span><span class="dot" style="background:${a.color}"></span>${a.emoji} ${escapeHtml(a.name)}</span>`; }).join('');

  // ---- auto insights from the time log ----
  const tIns = [];
  const avgH = id => { const ds = days.filter(d => byDay[d][id]); return ds.length ? ds.reduce((s, d) => s + byDay[d][id], 0) / ds.length : null; };
  const sleepAvg = avgH('sleep');
  if (sleepAvg != null) tIns.push(`😴 You sleep <b>${fmtDur(sleepAvg)}</b> a day on average (tracked).`);
  const workAvg = avgH('work');
  if (workAvg != null) tIns.push(`💼 Average tracked work: <b>${fmtDur(workAvg)}</b> a day.`);
  const travelAvg = avgH('travel');
  if (travelAvg != null) tIns.push(`🚌 Commute costs you about <b>${fmtDur(travelAvg)}</b> a day.`);
  const scrollAvg = avgH('scroll');
  if (scrollAvg != null) tIns.push(`📱 Scrolling eats <b>${fmtDur(scrollAvg)}</b> a day${workAvg && scrollAvg > workAvg / 2 ? ' — more than half your work time 👀' : ''}.`);

  return `
    <div class="card"><h2>⏱ Time analysis <span class="hint">last ${days.length} days</span></h2>
      <div class="stat-grid">
        <div class="stat"><div class="v">${Math.round(tracked / 3600000)}h</div><div class="l">tracked</div></div>
        <div class="stat"><div class="v">${coverage}%</div><div class="l">of time covered</div></div>
        <div class="stat"><div class="v">${activeDays}</div><div class="l">days tracked</div></div>
        <div class="stat"><div class="v">${top.emoji}</div><div class="l">${escapeHtml(top.name)} ${topShare}%</div></div>
      </div>
      <div style="margin-top:12px">${actBars}</div>
      ${tIns.length ? `<div style="margin-top:10px">${tIns.map(t => `<div style="font-size:13.5px;color:var(--text-dim);padding:7px 0;border-bottom:1px solid var(--border);line-height:1.5">${t}</div>`).join('')}</div>` : ''}
    </div>
    <div class="card"><h2>⏱ Top activities trend <span class="hint">hours per day</span></h2>
      ${trend}
      <div class="legend">${trendLegend}</div></div>
    <div class="card"><h2>📆 Your days, side by side <span class="hint">each row = one day, 0–24h</span></h2>
      ${strips}
      <div class="tl-ticks" style="margin-left:52px">${[0, 6, 12, 18, 24].map(h => `<span>${h}</span>`).join('')}</div>
      <div class="tl-legend">${stripLegend}</div></div>`;
}

function longestLoggedStreak() {
  const ds = Object.keys(DB.entries()).sort();
  let best = 0, cur = 0, prev = null;
  ds.forEach(d => { cur = (prev && addDays(prev, 1) === d) ? cur + 1 : 1; best = Math.max(best, cur); prev = d; });
  return best;
}
let dashRange = 14;
function renderDash() {
  document.getElementById('screen-title').textContent = 'Stats';
  document.getElementById('screen-sub').textContent = 'Your trends & analysis';
  const e = DB.entries();
  const N = dashRange;
  const days = []; for (let i = N - 1; i >= 0; i--) days.push(addDays(todayStr(), -i));
  const series = key => days.map(d => ({ x: d, y: e[d] && e[d][key] != null && e[d][key] !== '' ? +e[d][key] : null }));

  const allDates = Object.keys(e);
  const avg = key => { const v = allDates.map(d=>e[d][key]).filter(x=>x!=null&&x!==''); return v.length ? (v.reduce((a,b)=>a+ +b,0)/v.length).toFixed(1) : '–'; };

  const last30 = []; for (let i = 29; i >= 0; i--) last30.push(addDays(todayStr(), -i));
  const habitBars = HABITS.map(h => {
    const hits = last30.filter(d => e[d] && e[d].habits && e[d].habits[h.key]).length;
    const pct = Math.round(hits / 30 * 100);
    return `<div class="bar-row"><span class="name">${h.emoji} ${h.label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
      <span class="pct">${pct}%</span></div>`;
  }).join('');

  // ---- Gym analysis: how many sessions per muscle group / cardio / abs-sides-core ----
  const gym = DB.gym(); const gymDates = Object.keys(gym);
  const doneExIdsOn = d => new Set(Object.keys(gym[d].done || {}).filter(k => gym[d].done[k]).map(k => k.split('/').pop()));
  const groupSessions = g => gymDates.filter(d => { const s = doneExIdsOn(d); return g.exercises.some(x => s.has(x.id)); }).length;
  const gymOrder = ['cardio','chest','triceps','shoulder','biceps','back','legs','abs','side','core'].concat(gymGroups().map(g => g.id));
  const gymStats = gymOrder.map(id => { const g = cookedGroupById(id); return { g, n: groupSessions(g) }; }).filter(x => x.g);
  const gymMax = Math.max(1, ...gymStats.map(x => x.n));
  const totalWorkouts = gymDates.filter(d => Object.values(gym[d].done||{}).some(Boolean)).length;
  const gymBars = gymStats.map(x => `<div class="bar-row"><span class="name">${x.g.emoji} ${x.g.name}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.round(x.n/gymMax*100)}%;background:${x.g.color}"></span></span>
      <span class="pct">${x.n}</span></div>`).join('');

  // ---- Wellbeing / deep-log averages — DYNAMIC: every visible 1-10 field
  // (including ones you add in Customize) shows here once you've logged it ----
  const scaleDefs = [];
  deepCfg().forEach(sec => { if (sec.hidden) return;
    (sec.scales || []).forEach(f => { if (!f.hidden) scaleDefs.push({ k: f.key, l: f.label }); }); });
  const scaleBars = scaleDefs.map(s => ({ s, a: avg(s.k) })).filter(x => x.a !== '–')
    .map(x => `<div class="bar-row"><span class="name">${x.s.l}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${x.a/10*100}%"></span></span>
      <span class="pct">${x.a}</span></div>`).join('');

  // ---- Tasks ----
  const tasks = DB.tasks(); const tDone = tasks.filter(t=>t.done).length; const tOpen = tasks.length - tDone;
  const tRate = tasks.length ? Math.round(tDone/tasks.length*100) : 0;

  // ---- Mood calendar heatmap (last 12 weeks) ----
  const heatDays = []; for (let i = 83; i >= 0; i--) heatDays.push(addDays(todayStr(), -i));
  const heatCells = heatDays.map(d => {
    const m = e[d] && e[d].mood;
    const bg = m ? `hsl(${Math.round((m-1)/9*120)},62%,45%)` : 'var(--bg-input)';
    return `<div class="cell" title="${d}${m?' · mood '+m:''}" style="background:${bg}"></div>`;
  }).join('');

  // ---- Averages by weekday ----
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const wdAgg = wd.map(() => []);
  allDates.forEach(d => { if (e[d].mood) wdAgg[new Date(d+'T00:00:00').getDay()].push(+e[d].mood); });
  const wdAvg = i => wdAgg[i].length ? wdAgg[i].reduce((a,b)=>a+b,0)/wdAgg[i].length : 0;
  const wdBars = wd.map((name,i) => { const a = wdAvg(i); return `<div class="bar-row"><span class="name" style="width:40px">${name}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${a/10*100}%"></span></span><span class="pct">${a?a.toFixed(1):'–'}</span></div>`; }).join('');

  // ---- Auto insights ----
  const condAvg = (fn, key) => { const v = allDates.filter(fn).map(d=>e[d][key]).filter(x=>x!=null&&x!==''); return v.length ? v.reduce((a,b)=>a+ +b,0)/v.length : null; };
  const insights = [];
  const mHi = condAvg(d=>e[d].sleepHours!==''&&+e[d].sleepHours>=7, 'mood');
  const mLo = condAvg(d=>e[d].sleepHours!=null&&e[d].sleepHours!==''&&+e[d].sleepHours<7, 'mood');
  if (mHi!=null && mLo!=null) insights.push(`😴 On 7h+ sleep nights your mood averages <b>${mHi.toFixed(1)}</b> vs <b>${mLo.toFixed(1)}</b> on less sleep.`);
  let bWd=-1,bV=-1; wd.forEach((n,i)=>{const a=wdAvg(i); if(a>bV){bV=a;bWd=i;}});
  if (bV>0) insights.push(`📅 Your best-mood day is <b>${wd[bWd]}</b> (avg ${bV.toFixed(1)}/10).`);
  const eHi = condAvg(d=>e[d].deepWorkHours!==''&&+e[d].deepWorkHours>=4, 'energy');
  const eLo = condAvg(d=>e[d].deepWorkHours!=null&&e[d].deepWorkHours!==''&&+e[d].deepWorkHours<4, 'energy');
  if (eHi!=null && eLo!=null) insights.push(`⚡ Deep-work 4h+ days: energy <b>${eHi.toFixed(1)}</b> vs <b>${eLo.toFixed(1)}</b>.`);

  const woSeries = days.map(d => ({ x: d, y: e[d] && e[d].workoutsDone!=null && e[d].workoutsDone!=='' ? +e[d].workoutsDone : null }));

  // ---- Polymath Index ----
  const pmSeries = days.map(d => { const p = e[d] ? polymath(e[d]) : null; return { x: d, y: p ? p.total : null }; });
  const pm30 = last30.map(d => e[d] ? polymath(e[d]) : null).filter(Boolean);
  const pmAvg = pm30.length ? Math.round(pm30.reduce((a, p) => a + p.total, 0) / pm30.length) : 0;
  const pillarAvg = key => { const v = pm30.map(p => p[key]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; };
  const latestDate = allDates.slice().sort().slice(-1)[0];
  const latestPm = latestDate && polymath(e[latestDate]) ? polymath(e[latestDate]).total : '–';
  const PILLARS = [
    { k: 'body', l: '💪 Body', c: '#34d399' }, { k: 'mind', l: '🧠 Mind', c: '#6d8cff' },
    { k: 'work', l: '💼 Work', c: '#fbbf24' }, { k: 'learning', l: '📚 Learning', c: '#a78bfa' },
    { k: 'discipline', l: '🔥 Discipline', c: '#f87171' },
  ];
  const pmBars = PILLARS.map(p => { const v = pillarAvg(p.k); return `<div class="bar-row"><span class="name">${p.l}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${v}%;background:${p.c}"></span></span><span class="pct">${v}</span></div>`; }).join('');

  document.getElementById('s-dash').innerHTML = `
    <div class="range-row">
      ${[7, 14, 30, 90].map(r => `<button class="range-btn ${dashRange===r?'on':''}" data-range="${r}">${r===90?'3 months':r+' days'}</button>`).join('')}
    </div>
    <div class="card pm-card">
      <h2>🧭 Polymath Index <span class="hint">last 30 days</span></h2>
      <div class="pm-hero">
        <div class="pm-score">${pmAvg}<span class="pm-out">/100</span></div>
        <div class="pm-meta"><div>30-day average</div><div class="hint">latest day: ${latestPm}${typeof latestPm==='number'?'/100':''}</div></div>
      </div>
      ${lineChart(pmSeries, '#8b9dff')}
      <div style="margin-top:10px">${pmBars}</div>
    </div>

    ${(() => { const r = coachReview(); return r ? `<div class="card"><h2>🧑‍🏫 Weekly review <span class="hint">last 7 days</span></h2>${r.map(l => `<div class="rev rev-${l.k}">${l.t}</div>`).join('')}</div>` : ''; })()}

    <div class="card"><h2>🕸️ Connections <span class="hint">your journal graph</span></h2><div id="graph-wrap">${graphSVG()}</div></div>

    <div class="card"><div class="stat-grid">
      <div class="stat"><div class="v">${loggedStreak()}</div><div class="l">🔥 day streak</div></div>
      <div class="stat"><div class="v">${longestLoggedStreak()}</div><div class="l">best streak</div></div>
      <div class="stat"><div class="v">${allDates.length}</div><div class="l">days logged</div></div>
      <div class="stat"><div class="v">${avg('mood')}</div><div class="l">avg mood</div></div>
      <div class="stat"><div class="v">${avg('energy')}</div><div class="l">avg energy</div></div>
      <div class="stat"><div class="v">${avg('sleepHours')}</div><div class="l">avg sleep h</div></div>
      <div class="stat"><div class="v">${avg('deepWorkHours')}</div><div class="l">avg deep wk</div></div>
      <div class="stat"><div class="v">${gymStreak()}</div><div class="l">💪 gym streak</div></div>
      <div class="stat"><div class="v">${totalWorkouts}</div><div class="l">workouts</div></div>
    </div></div>

    ${timeStatsHTML(days)}

    <div class="card"><h2>Mood &amp; Energy <span class="hint">last ${N} days</span></h2>
      ${lineChart(series('mood'), '#6d8cff')}
      <div style="margin-top:-6px">${lineChart(series('energy'), '#4ad6c0')}</div>
      <div class="legend"><span><span class="dot" style="background:#6d8cff"></span>Mood</span>
        <span><span class="dot" style="background:#4ad6c0"></span>Energy</span></div></div>

    <div class="card"><h2>Sleep &amp; Deep work <span class="hint">last ${N} days</span></h2>
      ${lineChart(series('sleepHours'), '#a78bfa')}
      <div style="margin-top:-6px">${lineChart(series('deepWorkHours'), '#fbbf24')}</div>
      <div class="legend"><span><span class="dot" style="background:#a78bfa"></span>Sleep (h)</span>
        <span><span class="dot" style="background:#fbbf24"></span>Deep work (h)</span></div></div>

    ${insights.length ? `<div class="card"><h2>💡 Insights</h2>
      ${insights.map(t=>`<div style="font-size:13.5px;color:var(--text-dim);padding:7px 0;border-bottom:1px solid var(--border);line-height:1.5">${t}</div>`).join('')}</div>` : ''}

    <div class="card"><h2>📅 Mood calendar <span class="hint">last 12 weeks</span></h2>
      <div class="heat">${heatCells}</div>
      <div class="legend"><span><span class="dot" style="background:hsl(0,62%,45%)"></span>low</span>
        <span><span class="dot" style="background:hsl(60,62%,45%)"></span>ok</span>
        <span><span class="dot" style="background:hsl(120,62%,45%)"></span>great</span></div></div>

    <div class="card"><h2>Mood by weekday <span class="hint">all time</span></h2>${wdBars}</div>

    <div class="card"><h2>🏋️ Workout volume <span class="hint">exercises/day · last ${N} days</span></h2>
      ${lineChart(woSeries, '#34d399')}</div>

    <div class="card"><h2>💪 Gym breakdown <span class="hint">sessions per group · ${totalWorkouts} total</span></h2>
      ${gymBars || '<div class="empty">No workouts logged yet.</div>'}</div>

    ${scaleBars ? `<div class="card"><h2>🧠 Wellbeing averages <span class="hint">out of 10</span></h2>${scaleBars}</div>` : ''}

    <div class="card"><h2>✅ Tasks <span class="hint">${tRate}% completed</span></h2>
      <div class="stat-grid">
        <div class="stat"><div class="v">${tOpen}</div><div class="l">open</div></div>
        <div class="stat"><div class="v">${tDone}</div><div class="l">done</div></div>
        <div class="stat"><div class="v">${tRate}%</div><div class="l">rate</div></div>
      </div></div>

    <div class="card"><h2>Habit consistency <span class="hint">last 30 days</span></h2>${habitBars}</div>
  `;
}

/* ============================================================
   SCREEN: HISTORY
   ============================================================ */
function renderHistory() {
  document.getElementById('screen-title').textContent = 'History';
  const e = DB.entries();
  const dates = Object.keys(e).sort().reverse();
  document.getElementById('screen-sub').textContent = `${dates.length} entries`;
  if (!dates.length) { document.getElementById('s-history').innerHTML = '<div class="empty">No entries yet. Log your first day on the Log tab.</div>'; return; }
  const items = dates.map(d => {
    const en = e[d];
    const hc = en.habits ? Object.values(en.habits).filter(Boolean).length : 0;
    return `<div class="hist-item" data-open="${d}">
      <div><div class="hist-date">${prettyDate(d)}</div>
        <div class="hist-meta">${en.journal ? escapeHtml(en.journal.slice(0,46)) + (en.journal.length>46?'…':'') : '—'}</div></div>
      <div class="hist-moods"><span class="pill">😊 ${en.mood||'–'}</span><span class="pill">⚡ ${en.energy||'–'}</span><span class="pill">✅ ${hc}/${HABITS.length}</span></div>
    </div>`;
  }).join('');
  document.getElementById('s-history').innerHTML = `<div class="card">${items}</div>`;
}
document.addEventListener('click', (ev) => {
  const it = ev.target.closest('[data-open]');
  if (it) { logDate = it.dataset.open; show('today'); }
});

/* ============================================================
   SCREEN: WRITE  (inner blog — block-based articles)
   A doc = title + ordered blocks. Block types:
     h = heading · p = paragraph · c = checklist item · b = bullet
   Every block is a textarea you can also dictate into (the 🎤
   targets whichever block you touched last). Drag ⠿ to reorder,
   Enter inside a checklist/bullet starts the next item.
   ============================================================ */
let curDoc = null;            // open doc id (null = list of articles)
let lastBlk = null;           // id of the block that had focus last (mic target)

function docText(d) { return (d.blocks || []).map(b => b.text).join(' '); }
let docsSyncTimer;
function syncDocs() { clearTimeout(docsSyncTimer); docsSyncTimer = setTimeout(() => {
  const url = DB.settings().syncUrl; if (!url) return;
  const items = DB.docs().map(d => ({ title: d.title || 'Untitled', updated: (d.updated || '').slice(0, 10),
    text: (d.blocks || []).map(b => (b.t === 'h' ? '## ' : b.t === 'c' ? (b.done ? '[x] ' : '[ ] ') : b.t === 'b' ? '• ' : '') + b.text).join('\n') }));
  fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ type: 'docs', items }) }).catch(() => {});
}, 2000); }

function blockRow(b) {
  const ta = `<textarea class="blk blk-${b.t}" data-blk="${b.id}" rows="1"
    placeholder="${b.t === 'h' ? 'Heading…' : b.t === 'c' ? 'To-do…' : b.t === 'b' ? 'Point…' : 'Write… (or tap 🎤 and speak)'}">${escapeHtml(b.text || '')}</textarea>`;
  return `<div class="blk-row ${b.t === 'c' && b.done ? 'done' : ''}" data-id="${b.id}">
    <span class="drag-handle" data-drag>⠿</span>
    ${b.t === 'c' ? `<div class="check" data-blkcheck="${b.id}">✓</div>` : b.t === 'b' ? '<span class="blk-bullet">•</span>' : ''}
    ${ta}
    <button class="del" data-blkdel="${b.id}">×</button>
  </div>`;
}
function autoSizeBlocks() {
  document.querySelectorAll('#blk-list .blk').forEach(t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; });
}
function renderWrite() {
  document.getElementById('screen-title').textContent = 'Write';
  const docs = DB.docs();

  // ---- LIST: all articles ----
  if (!curDoc) {
    document.getElementById('screen-sub').textContent = `${docs.length} article${docs.length === 1 ? '' : 's'}`;
    const items = docs.map(d => { const txt = docText(d);
      const donePart = (d.blocks || []).filter(b => b.t === 'c');
      return `<div class="doc-item" data-opendoc="${d.id}">
        <div class="doc-title">${escapeHtml(d.title || 'Untitled')}</div>
        <div class="doc-meta">${(d.updated || d.created || '').slice(0, 10)}${donePart.length ? ` · ☑ ${donePart.filter(b => b.done).length}/${donePart.length}` : ''} · ${(d.blocks || []).length} block${(d.blocks || []).length === 1 ? '' : 's'}</div>
        ${txt ? `<div class="doc-snip">${escapeHtml(txt.slice(0, 90))}${txt.length > 90 ? '…' : ''}</div>` : ''}
      </div>`; }).join('');
    document.getElementById('s-write').innerHTML = `
      <div class="card">
        <button class="btn btn-primary" id="doc-new">＋ New article</button>
        <div class="hint" style="margin-top:8px;text-align:center">Your inner blog — headings, writing, voice notes, checklists.</div>
      </div>
      <div class="card" style="padding:6px 16px">${items || '<div class="empty">Nothing written yet. Start your first article 👆</div>'}</div>`;
    return;
  }

  // ---- EDITOR: one article ----
  const d = docs.find(x => x.id === curDoc);
  if (!d) { curDoc = null; return renderWrite(); }
  document.getElementById('screen-sub').textContent = 'Editing · saves as you type';
  document.getElementById('s-write').innerHTML = `
    <button class="back-btn" id="doc-back">← All articles</button>
    <div class="card">
      <input type="text" class="doc-title-input" data-doctitle="${d.id}" value="${escapeHtml(d.title || '')}" placeholder="Article title…">
      <div id="blk-list" style="margin-top:10px">${(d.blocks || []).map(blockRow).join('') || '<div class="empty">Empty — add a block below 👇</div>'}</div>
      <div class="blk-toolbar">
        <button data-addblk="h">H Heading</button>
        <button data-addblk="p">¶ Text</button>
        <button data-addblk="c">☑ Check</button>
        <button data-addblk="b">• Bullet</button>
        <button data-mic="#blk-focus-target" id="doc-mic">🎤</button>
      </div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn btn-ghost btn-sm" id="doc-del" style="color:var(--bad)">🗑 Delete article</button>
      </div>
    </div>`;
  autoSizeBlocks();
  enableDrag(document.getElementById('blk-list'), ids => {
    const ds = DB.docs(); const doc = ds.find(x => x.id === curDoc); if (!doc) return;
    doc.blocks = ids.map(id => (doc.blocks || []).find(b => b.id === id)).filter(Boolean);
    doc.updated = new Date().toISOString(); DB.saveDocs(ds); renderWrite();
  });
}
function addBlock(type, afterId) {
  const ds = DB.docs(); const d = ds.find(x => x.id === curDoc); if (!d) return null;
  d.blocks = d.blocks || [];
  const blk = { id: 'bk' + Date.now() + Math.floor(Math.random() * 99), t: type, text: '' };
  if (type === 'c') blk.done = false;
  const at = afterId ? d.blocks.findIndex(b => b.id === afterId) + 1 : d.blocks.length;
  d.blocks.splice(at, 0, blk);
  d.updated = new Date().toISOString();
  DB.saveDocs(ds); renderWrite();
  const el = document.querySelector(`[data-blk="${blk.id}"]`); if (el) el.focus();
  return blk.id;
}
document.addEventListener('click', (ev) => {
  const sw = document.getElementById('s-write');
  if (!sw || !sw.classList.contains('on')) return;
  if (ev.target.id === 'doc-new') {
    const ds = DB.docs();
    const d = { id: 'doc' + Date.now(), title: '', blocks: [{ id: 'bk' + Date.now(), t: 'h', text: '' }], created: todayStr(), updated: new Date().toISOString() };
    ds.unshift(d); DB.saveDocs(ds); curDoc = d.id; renderWrite();
    const t = document.querySelector('.doc-title-input'); if (t) t.focus();
    return;
  }
  const od = ev.target.closest('[data-opendoc]');
  if (od) { curDoc = od.dataset.opendoc; renderWrite(); window.scrollTo(0, 0); return; }
  if (ev.target.id === 'doc-back') { curDoc = null; renderWrite(); return; }
  if (ev.target.id === 'doc-del') {
    if (!confirm('Delete this whole article?')) return;
    DB.saveDocs(DB.docs().filter(x => x.id !== curDoc)); curDoc = null; renderWrite(); toast('Article deleted'); return;
  }
  const ab = ev.target.closest('[data-addblk]');
  if (ab) { addBlock(ab.dataset.addblk); return; }
  const bc = ev.target.closest('[data-blkcheck]');
  if (bc) { const ds = DB.docs(); const d = ds.find(x => x.id === curDoc);
    const b = d && (d.blocks || []).find(z => z.id === bc.dataset.blkcheck);
    if (b) { b.done = !b.done; d.updated = new Date().toISOString(); DB.saveDocs(ds); renderWrite(); } return; }
  const bd = ev.target.closest('[data-blkdel]');
  if (bd) { const ds = DB.docs(); const d = ds.find(x => x.id === curDoc);
    if (d) { d.blocks = (d.blocks || []).filter(z => z.id !== bd.dataset.blkdel); d.updated = new Date().toISOString(); DB.saveDocs(ds); renderWrite(); } return; }
});
/* typing saves live; the mic button always targets the block you touched last */
document.addEventListener('focusin', (ev) => {
  const b = ev.target.closest('[data-blk]');
  if (b) { lastBlk = b.dataset.blk;
    const mic = document.getElementById('doc-mic'); if (mic) mic.dataset.mic = `[data-blk="${lastBlk}"]`; }
});
document.addEventListener('input', (ev) => {
  const t = ev.target.closest('[data-blk]');
  if (t) { const ds = DB.docs(); const d = ds.find(x => x.id === curDoc);
    const b = d && (d.blocks || []).find(z => z.id === t.dataset.blk);
    if (b) { b.text = t.value; d.updated = new Date().toISOString(); DB.saveDocs(ds); }
    t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; return; }
  const dt = ev.target.closest('[data-doctitle]');
  if (dt) { const ds = DB.docs(); const d = ds.find(x => x.id === dt.dataset.doctitle);
    if (d) { d.title = dt.value; d.updated = new Date().toISOString(); DB.saveDocs(ds); } }
});
document.addEventListener('keydown', (ev) => {
  const t = ev.target.closest('[data-blk]');
  if (!t || ev.key !== 'Enter') return;
  const ds = DB.docs(); const d = ds.find(x => x.id === curDoc);
  const b = d && (d.blocks || []).find(z => z.id === t.dataset.blk);
  if (b && (b.t === 'c' || b.t === 'b')) { ev.preventDefault(); addBlock(b.t, b.id); }   // Enter = next item
});

/* ============================================================
   SCREEN: CUSTOMIZE  (More ▸ Customize — make the app yours)
   Edit emoji / name / accent color, hide what you don't use,
   drag to reorder, add your own. Applies everywhere instantly.
   ============================================================ */
const CFG_COLORS = ['', '#fb923c', '#6d8cff', '#a78bfa', '#ec4899', '#34d399', '#fbbf24', '#f87171', '#22d3ee'];
function nextCfgColor(c) { return CFG_COLORS[(CFG_COLORS.indexOf(c || '') + 1) % CFG_COLORS.length]; }
function cfgRow(kind, item, deletable) {
  const id = item.key || item.id;
  const color = item.color || '';
  return `<div class="cfg-row ${item.hidden ? 'hid' : ''}" data-id="${id}">
    <span class="drag-handle" data-drag>⠿</span>
    <input class="cfg-emoji" maxlength="4" data-cfg-emoji="${kind}:${id}" value="${escapeHtml(item.emoji || '')}">
    <input class="cfg-name" data-cfg-name="${kind}:${id}" value="${escapeHtml(item.label || item.name || '')}">
    <button class="cfg-color" data-cfg-color="${kind}:${id}" title="tap to change color" style="${color ? `background:${color};border-color:${color}` : ''}"></button>
    <button class="cfg-hide" data-cfg-hide="${kind}:${id}" title="show / hide">${item.hidden ? '🙈' : '👁'}</button>
    ${deletable ? `<button class="del" data-cfg-del="${kind}:${id}">×</button>` : '<span style="width:23px"></span>'}
  </div>`;
}
function renderCustom() {
  document.getElementById('screen-title').textContent = 'Customize';
  document.getElementById('screen-sub').textContent = 'Make Daily Pulse yours';
  const habits = habitCfg();
  const acts = actCfg();
  const customActs = DB.timeacts();
  const daySplit = gymDays().map(d => `<div class="cfg-row">
      <input class="cfg-name" style="flex:0 0 72px" data-day-name="${d.id}" value="${escapeHtml(d.name)}">
      <select data-day-main="${d.id}">${allGroups().filter(g => !['cardio','abs','side','core'].includes(g.id)).map(g =>
        `<option value="${g.id}" ${g.id === d.main ? 'selected' : ''}>${g.emoji} ${escapeHtml(g.name)}</option>`).join('')}</select>
      <select data-day-ab="${d.id}" style="flex:0 0 92px">${['abs','side','core'].map(id => { const g = groupById(id);
        return `<option value="${id}" ${id === d.ab ? 'selected' : ''}>${g.emoji} ${escapeHtml(g.name)}</option>`; }).join('')}</select>
    </div>`).join('');
  const navRows = navCfg().map(n => `<div class="cfg-row ${n.hidden ? 'hid' : ''}" data-id="${n.k}">
      <span class="drag-handle" data-drag>⠿</span>
      <span style="flex:0 0 26px;text-align:center">${n.ico}</span>
      <input class="cfg-name" data-nav-label="${n.k}" value="${escapeHtml(n.label)}">
      ${n.locked ? '<span class="hint" style="flex:0 0 auto">always</span>' : `<button class="cfg-hide" data-nav-hide="${n.k}">${n.hidden ? '🙈' : '👁'}</button>`}
    </div>`).join('');
  const curAccent = DB.settings().accent || 'indigo';
  document.getElementById('s-custom').innerHTML = `
    <button class="back-btn" id="custom-back">← Back to More</button>
    <div class="card">
      <h2>🎨 Theme color</h2>
      <div class="theme-row">${THEMES.map(t => `<button class="theme-sw ${t.id === curAccent ? 'on' : ''}" data-theme="${t.id}"
        style="background:linear-gradient(135deg,${t.a},${t.b})"></button>`).join('')}</div>
    </div>
    <div class="card">
      <h2>🧭 Tabs <span class="hint">drag order · rename · 👁 hide</span></h2>
      <div id="cfg-nav">${navRows}</div>
    </div>
    <div class="card">
      <h2>📝 Log screen fields <span class="hint">rename · hide — incl. reflection questions</span></h2>
      ${coreCfg().map(f => `<div class="cfg-row ${f.hidden ? 'hid' : ''}">
        <span class="cfg-type">${f.type === 'scale' ? '1-10' : f.type === 'num' ? '123' : 'Aa'}</span>
        <input class="cfg-name" data-core-label="${f.key}" value="${escapeHtml(f.label)}">
        <button class="cfg-hide" data-core-hide="${f.key}">${f.hidden ? '🙈' : '👁'}</button>
      </div>`).join('')}
    </div>
    <div class="card">
      <h2>🗓 Gym 6-day split <span class="hint">rename days · pick muscle + core group</span></h2>
      ${daySplit}
      <div class="task-add" style="margin-top:10px">
        <input type="text" id="cfg-new-group" placeholder="New muscle group… (e.g. 🧗 Forearms)" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="cfg-add-group">Add</button>
      </div>
      <div class="hint" style="margin-top:8px">New groups appear below under Gym workouts — add exercises there, then pick the group for any day.</div>
    </div>
    <div class="card">
      <h2>✅ Daily checklist habits <span class="hint">emoji · name · color · 👁 hide · drag</span></h2>
      <div id="cfg-habits">${habits.map(h => cfgRow('h', h, !!h.custom)).join('')}</div>
      <div class="task-add">
        <input type="text" id="cfg-new-habit" placeholder="New habit… (e.g. 🌅 Wake at 6)" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="cfg-add-habit">Add</button>
      </div>
      <div class="hint" style="margin-top:8px">Hidden habits keep their history — they just leave the checklist. Custom habits sync between devices; the Google-Sheet Log columns stay fixed.</div>
    </div>
    <div class="card">
      <h2>⏱ Time activities <span class="hint">same controls</span></h2>
      <div id="cfg-acts">${acts.map(a => cfgRow('a', a, false)).join('')}${customActs.map(a => cfgRow('c', a, true)).join('')}</div>
      <div class="task-add">
        <input type="text" id="cfg-new-act" placeholder="New activity… (e.g. Cooking)" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="cfg-add-act">Add</button>
      </div>
    </div>
    <div class="card">
      <h2>🧠 Deep log sections <span class="hint">rename · hide · add your own fields</span></h2>
      ${deepCfg().map(sec => deepSecEditor(sec)).join('')}
      <div class="hint" style="margin-top:8px">New fields show up on the Log screen and in Stats averages automatically. The Google-Sheet Log columns stay fixed — custom fields live in the app + device sync.</div>
    </div>
    <div class="card">
      <h2>🏋️ Gym workouts <span class="hint">rename · sets · hide · add exercises</span></h2>
      ${allGroups().map(g => gymGroupEditor(g)).join('')}
    </div>`;
  enableDrag(document.getElementById('cfg-habits'), ids => {
    const cfg = habitCfg();
    saveHabitCfg(ids.map(id => cfg.find(h => h.key === id)).filter(Boolean)); renderCustom();
  });
  enableDrag(document.getElementById('cfg-nav'), ids => {
    const cfg = navCfg();
    saveNavCfg(ids.map(id => cfg.find(n => n.k === id)).filter(Boolean)); renderCustom();
  });
}
/* --- Deep-log section editor (one collapsible <details> per section) --- */
const DFIELD_LISTS = [['scales', 'scale 1-10'], ['nums', 'number'], ['texts', 'text']];
function deepSecEditor(sec) {
  const fieldRow = (list, f) => `<div class="cfg-row ${f.hidden ? 'hid' : ''}">
      <span class="cfg-type">${list === 'scales' ? '1-10' : list === 'nums' ? '123' : 'Aa'}</span>
      <input class="cfg-name" data-dfield-label="${sec.id}:${list}:${f.key}" value="${escapeHtml(f.label)}">
      <button class="cfg-hide" data-dfield-hide="${sec.id}:${list}:${f.key}">${f.hidden ? '🙈' : '👁'}</button>
      ${f.custom ? `<button class="del" data-dfield-del="${sec.id}:${list}:${f.key}">×</button>` : '<span style="width:23px"></span>'}
    </div>`;
  const fields = DFIELD_LISTS.map(([list]) => (sec[list] || []).map(f => fieldRow(list, f)).join('')).join('');
  const checks = sec.checks ? `<div class="cfg-row ${sec.checks.hidden ? 'hid' : ''}">
      <span class="cfg-type">☑</span>
      <input class="cfg-name" data-dchecks-opts="${sec.id}" value="${escapeHtml((sec.checks.options || []).join(', '))}" title="tick options, comma separated">
      <button class="cfg-hide" data-dchecks-hide="${sec.id}">${sec.checks.hidden ? '🙈' : '👁'}</button>
      <span style="width:23px"></span>
    </div>` : '';
  return `<details class="cfg-sec" data-cfgsec="deep:${sec.id}" ${openCfgSecs.has('deep:' + sec.id) ? 'open' : ''}>
    <summary><span>${escapeHtml(sec.title)}</span><button class="cfg-hide" data-dsec-hide="${sec.id}">${sec.hidden ? '🙈' : '👁'}</button></summary>
    <div class="cfg-sec-body">
      <input class="cfg-name" style="margin-bottom:8px" data-dsec-title="${sec.id}" value="${escapeHtml(sec.title)}" placeholder="Section title…">
      ${fields}${checks}
      <div class="task-add" style="margin-top:8px">
        <select id="dfield-type-${sec.id}" style="max-width:104px">${DFIELD_LISTS.map(([l, n]) => `<option value="${l}">${n}</option>`).join('')}</select>
        <input type="text" id="dfield-name-${sec.id}" placeholder="New field…" autocomplete="off">
        <button class="btn btn-primary btn-sm" data-dfield-add="${sec.id}">Add</button>
      </div>
    </div>
  </details>`;
}
/* --- Gym group editor --- */
function gymGroupEditor(g) {
  const cfg = gymCfg();
  const row = (e, custom) => { const o = Object.assign({}, e, cfg.ex[e.id] || {});
    return `<div class="cfg-row ${o.hidden ? 'hid' : ''}">
      <input class="cfg-name" data-gx-name="${e.id}" value="${escapeHtml(o.name)}">
      <input class="cfg-name" style="flex:0 0 84px" data-gx-sets="${e.id}" value="${escapeHtml(o.sets || '')}" placeholder="sets">
      <button class="cfg-hide" data-gx-hide="${e.id}">${o.hidden ? '🙈' : '👁'}</button>
      ${custom ? `<button class="del" data-gx-del="${g.id}:${e.id}">×</button>` : '<span style="width:23px"></span>'}
    </div>`; };
  const customs = (cfg.custom[g.id] || []);
  const isCustomGroup = g.id.indexOf('cg') === 0;
  return `<details class="cfg-sec" data-cfgsec="gym:${g.id}" ${openCfgSecs.has('gym:' + g.id) ? 'open' : ''}>
    <summary><span style="color:${g.color}">${g.emoji} ${escapeHtml(g.name)}</span><span class="hint">${cookedGroupById(g.id).exercises.length} shown</span>${isCustomGroup ? `<button class="del" data-ggroup-del="${g.id}">×</button>` : ''}</summary>
    <div class="cfg-sec-body">
      ${(g.exercises || []).map(e => row(e, false)).join('')}${customs.map(e => row(e, true)).join('')}
      <div class="task-add" style="margin-top:8px">
        <input type="text" id="gx-new-${g.id}" placeholder="New exercise… (e.g. Dips 3 × 12)" autocomplete="off">
        <button class="btn btn-primary btn-sm" data-gx-add="${g.id}">Add</button>
      </div>
    </div>
  </details>`;
}
function dfieldFind(ref) {   // "secId:list:key" → {cfg, sec, list, f}
  const [secId, list, key] = ref.split(':');
  const cfg = deepCfg(); const sec = cfg.find(s => s.id === secId);
  const f = sec && (sec[list] || []).find(x => x.key === key);
  return { cfg, sec, list, f };
}
function cfgFind(kind, id) {
  if (kind === 'h') { const cfg = habitCfg(); return { list: cfg, item: cfg.find(h => h.key === id), save: () => saveHabitCfg(cfg) }; }
  if (kind === 'a') { const cfg = actCfg(); return { list: cfg, item: cfg.find(a => a.id === id), save: () => saveActCfg(cfg) }; }
  const cfg = DB.timeacts(); return { list: cfg, item: cfg.find(a => a.id === id), save: () => DB.saveTimeacts(cfg) };
}
document.addEventListener('click', (ev) => {
  const sc = document.getElementById('s-custom');
  if (!sc || !sc.classList.contains('on')) return;
  if (ev.target.id === 'custom-back') { show('settings'); return; }
  if (ev.target.id === 'cfg-add-habit') {
    const inp = document.getElementById('cfg-new-habit'); const raw = inp.value.trim(); if (!raw) return;
    const m = raw.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u);
    const cfg = habitCfg();
    cfg.push({ key: 'ch' + Date.now(), emoji: (m && m[2]) ? m[1] : '⭐', label: (m && m[2]) ? m[2] : raw, custom: true });
    saveHabitCfg(cfg); renderCustom(); toast('Habit added'); return;
  }
  if (ev.target.id === 'cfg-add-act') {
    const inp = document.getElementById('cfg-new-act'); const name = inp.value.trim(); if (!name) return;
    const acts = DB.timeacts();
    acts.push({ id: 'ta' + Date.now(), emoji: '⭐', name, color: CUSTOM_ACT_COLORS[acts.length % CUSTOM_ACT_COLORS.length] });
    DB.saveTimeacts(acts); renderCustom(); toast('Activity added'); return;
  }
  const cc = ev.target.closest('[data-cfg-color]');
  if (cc) { const [k, id] = cc.dataset.cfgColor.split(':'); const f = cfgFind(k, id);
    if (f.item) { f.item.color = nextCfgColor(f.item.color); f.save(); renderCustom(); } return; }
  const ch = ev.target.closest('[data-cfg-hide]');
  if (ch) { const [k, id] = ch.dataset.cfgHide.split(':'); const f = cfgFind(k, id);
    if (f.item) { f.item.hidden = !f.item.hidden; f.save(); renderCustom(); } return; }
  const cd = ev.target.closest('[data-cfg-del]');
  if (cd) { const [k, id] = cd.dataset.cfgDel.split(':');
    if (!confirm('Delete this? Its logged history stays.')) return;
    if (k === 'h') saveHabitCfg(habitCfg().filter(h => h.key !== id));
    else DB.saveTimeacts(DB.timeacts().filter(a => a.id !== id));
    renderCustom(); return; }

  // ---- deep-log section / field controls ----
  const dsh = ev.target.closest('[data-dsec-hide]');
  if (dsh) { ev.preventDefault(); const cfg = deepCfg(); const sec = cfg.find(s => s.id === dsh.dataset.dsecHide);
    if (sec) { sec.hidden = !sec.hidden; saveDeepCfg(cfg); renderCustom(); } return; }
  const dfh = ev.target.closest('[data-dfield-hide]');
  if (dfh) { const r = dfieldFind(dfh.dataset.dfieldHide);
    if (r.f) { r.f.hidden = !r.f.hidden; saveDeepCfg(r.cfg); renderCustom(); } return; }
  const dfd = ev.target.closest('[data-dfield-del]');
  if (dfd) { const [secId, list, key] = dfd.dataset.dfieldDel.split(':');
    const cfg = deepCfg(); const sec = cfg.find(s => s.id === secId);
    if (sec) { sec[list] = (sec[list] || []).filter(x => x.key !== key); saveDeepCfg(cfg); renderCustom(); } return; }
  const dch = ev.target.closest('[data-dchecks-hide]');
  if (dch) { const cfg = deepCfg(); const sec = cfg.find(s => s.id === dch.dataset.dchecksHide);
    if (sec && sec.checks) { sec.checks.hidden = !sec.checks.hidden; saveDeepCfg(cfg); renderCustom(); } return; }
  const dfa = ev.target.closest('[data-dfield-add]');
  if (dfa) { const secId = dfa.dataset.dfieldAdd;
    const list = document.getElementById('dfield-type-' + secId).value;
    const label = document.getElementById('dfield-name-' + secId).value.trim(); if (!label) return;
    const cfg = deepCfg(); const sec = cfg.find(s => s.id === secId); if (!sec) return;
    sec[list] = sec[list] || [];
    sec[list].push({ key: 'cf' + Date.now(), label, custom: true });
    saveDeepCfg(cfg); renderCustom(); toast('Field added'); return; }

  // ---- gym exercise controls ----
  const gxh = ev.target.closest('[data-gx-hide]');
  if (gxh) { const id = gxh.dataset.gxHide; const cfg = gymCfg();
    cfg.ex[id] = Object.assign({}, cfg.ex[id], { hidden: !(cfg.ex[id] && cfg.ex[id].hidden) });
    saveGymCfg(cfg); renderCustom(); return; }
  const gxd = ev.target.closest('[data-gx-del]');
  if (gxd) { const [gid, id] = gxd.dataset.gxDel.split(':');
    if (!confirm('Delete this exercise?')) return;
    const cfg = gymCfg(); cfg.custom[gid] = (cfg.custom[gid] || []).filter(x => x.id !== id); delete cfg.ex[id];
    saveGymCfg(cfg); renderCustom(); return; }
  const gxa = ev.target.closest('[data-gx-add]');
  if (gxa) { const gid = gxa.dataset.gxAdd;
    const raw = document.getElementById('gx-new-' + gid).value.trim(); if (!raw) return;
    const m = raw.match(/^(.*?)\s+(\d+\s*[×x].*|\d+\s*min.*)$/i);
    const cfg = gymCfg(); cfg.custom[gid] = cfg.custom[gid] || [];
    cfg.custom[gid].push({ id: 'cx' + Date.now(), name: m ? m[1] : raw, sets: m ? m[2].replace(/x/i, '×') : '3 × 15' });
    saveGymCfg(cfg); renderCustom(); toast('Exercise added'); return; }

  // ---- theme / nav / gym-group controls ----
  const th = ev.target.closest('[data-theme]');
  if (th) { const s = DB.settings(); s.accent = th.dataset.theme; DB.saveSettings(s); applyTheme(); renderCustom(); return; }
  const nh = ev.target.closest('[data-nav-hide]');
  if (nh) { const cfg = navCfg(); const n = cfg.find(x => x.k === nh.dataset.navHide);
    if (n && !n.locked) { n.hidden = !n.hidden; saveNavCfg(cfg); renderCustom(); } return; }
  if (ev.target.id === 'cfg-add-group') {
    const inp = document.getElementById('cfg-new-group'); const raw = inp.value.trim(); if (!raw) return;
    const m = raw.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u);
    const gs = gymGroups();
    gs.push({ id: 'cg' + Date.now(), emoji: (m && m[2]) ? m[1] : '🏷️', name: (m && m[2]) ? m[2] : raw,
      color: CUSTOM_ACT_COLORS[gs.length % CUSTOM_ACT_COLORS.length] });
    saveGymGroups(gs); renderCustom(); toast('Group added — now add its exercises below'); return;
  }
  const gd = ev.target.closest('[data-ggroup-del]');
  if (gd) { ev.preventDefault();
    if (!confirm('Delete this group and its exercises?')) return;
    const gid = gd.dataset.ggroupDel;
    saveGymGroups(gymGroups().filter(g => g.id !== gid));
    const cfg = gymCfg(); delete cfg.custom[gid]; saveGymCfg(cfg);
    const days = gymDays(); let changed = false;
    days.forEach(d => { if (d.main === gid) { d.main = 'chest'; changed = true; } });
    if (changed) saveGymDays(days);
    renderCustom(); return; }
});
/* keep <details> sections open across re-renders */
let openCfgSecs = new Set();
document.addEventListener('toggle', (ev) => {
  const d = ev.target.closest && ev.target.closest('details[data-cfgsec]');
  if (d) { if (d.open) openCfgSecs.add(d.dataset.cfgsec); else openCfgSecs.delete(d.dataset.cfgsec); }
}, true);
document.addEventListener('input', (ev) => {
  const ce = ev.target.closest('[data-cfg-emoji]');
  if (ce) { const [k, id] = ce.dataset.cfgEmoji.split(':'); const f = cfgFind(k, id); if (f.item) { f.item.emoji = ce.value; f.save(); } return; }
  const cn = ev.target.closest('[data-cfg-name]');
  if (cn) { const [k, id] = cn.dataset.cfgName.split(':'); const f = cfgFind(k, id);
    if (f.item) { if (f.item.label !== undefined || k === 'h') f.item.label = cn.value; else f.item.name = cn.value; f.save(); } return; }
  // deep-log renames
  const dst = ev.target.closest('[data-dsec-title]');
  if (dst) { const cfg = deepCfg(); const sec = cfg.find(s => s.id === dst.dataset.dsecTitle);
    if (sec) { sec.title = dst.value; saveDeepCfg(cfg); } return; }
  const dfl = ev.target.closest('[data-dfield-label]');
  if (dfl) { const r = dfieldFind(dfl.dataset.dfieldLabel);
    if (r.f) { r.f.label = dfl.value; saveDeepCfg(r.cfg); } return; }
  const dco = ev.target.closest('[data-dchecks-opts]');
  if (dco) { const cfg = deepCfg(); const sec = cfg.find(s => s.id === dco.dataset.dchecksOpts);
    if (sec && sec.checks) { sec.checks.options = dco.value.split(',').map(x => x.trim()).filter(Boolean); saveDeepCfg(cfg); } return; }
  // gym renames / sets
  const gxn = ev.target.closest('[data-gx-name]');
  if (gxn) { const cfg = gymCfg(); cfg.ex[gxn.dataset.gxName] = Object.assign({}, cfg.ex[gxn.dataset.gxName], { name: gxn.value }); saveGymCfg(cfg); return; }
  const gxs = ev.target.closest('[data-gx-sets]');
  if (gxs) { const cfg = gymCfg(); cfg.ex[gxs.dataset.gxSets] = Object.assign({}, cfg.ex[gxs.dataset.gxSets], { sets: gxs.value }); saveGymCfg(cfg); return; }
  // core Log fields / nav labels / day names
  const cl = ev.target.closest('[data-core-label]');
  if (cl) { const cfg = coreCfg(); const f = cfg.find(x => x.key === cl.dataset.coreLabel);
    if (f) { f.label = cl.value; saveCoreCfg(cfg); } return; }
  const nl = ev.target.closest('[data-nav-label]');
  if (nl) { const cfg = navCfg(); const n = cfg.find(x => x.k === nl.dataset.navLabel);
    if (n) { n.label = nl.value; saveNavCfg(cfg); } return; }
  const dn = ev.target.closest('[data-day-name]');
  if (dn) { const days = gymDays(); const d = days.find(x => x.id === dn.dataset.dayName);
    if (d) { d.name = dn.value; saveGymDays(days); } return; }
});
/* select changes: day split + core-field hide clicks */
document.addEventListener('change', (ev) => {
  const dm = ev.target.closest('[data-day-main]');
  if (dm) { const days = gymDays(); const d = days.find(x => x.id === dm.dataset.dayMain);
    if (d) { d.main = dm.value; saveGymDays(days); renderCustom(); } return; }
  const da = ev.target.closest('[data-day-ab]');
  if (da) { const days = gymDays(); const d = days.find(x => x.id === da.dataset.dayAb);
    if (d) { d.ab = da.value; saveGymDays(days); renderCustom(); } return; }
});
document.addEventListener('click', (ev) => {
  const chd = ev.target.closest('[data-core-hide]');
  if (chd) { const cfg = coreCfg(); const f = cfg.find(x => x.key === chd.dataset.coreHide);
    if (f) { f.hidden = !f.hidden; saveCoreCfg(cfg); renderCustom(); } return; }
});

/* ============================================================
   SCREEN: CALENDAR  (month grid of your data + dated events)
   Each day is tinted by that day's mood; dots mark gym / time
   tracked / events. Tap a day to see its summary, add events
   with alarms, or jump into its full log.
   ============================================================ */
let calMonth = todayStr().slice(0, 7);   // 'YYYY-MM' being viewed
let calSel = todayStr();                 // selected day

function eventsOn(date) { return DB.events().filter(x => x.date === date).sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1); }
function syncEvents() {
  const url = DB.settings().syncUrl; if (!url) return;
  const items = DB.events().slice().sort((a, b) => (a.date + a.time) < (b.date + b.time) ? -1 : 1)
    .map(x => ({ date: x.date, time: x.time || '', label: x.label || '', alarm: x.alarm ? 'Yes' : '' }));
  fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ type: 'events', items }) }).catch(() => {});
}

function renderCal() {
  const [y, m] = calMonth.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  document.getElementById('screen-title').textContent = 'Calendar';
  document.getElementById('screen-sub').textContent = monthName;

  const e = DB.entries(), gym = DB.gym();
  const startDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;   // Monday-first
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = todayStr();

  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<span class="cal-cell blank"></span>';
  for (let n = 1; n <= daysInMonth; n++) {
    const ds = calMonth + '-' + String(n).padStart(2, '0');
    const en = e[ds];
    const future = ds > today;
    let bg = '';
    if (en && en.mood) bg = `background:hsla(${Math.round((en.mood - 1) / 9 * 120)},62%,45%,.4)`;
    else if (en) bg = 'background:rgba(109,140,255,.18)';       // logged, no mood yet
    const dots =
      (gym[ds] && Object.values(gym[ds].done || {}).some(Boolean) ? '<i style="background:#f87171"></i>' : '') +
      (segsForDay(ds).length ? '<i style="background:#4ad6c0"></i>' : '') +
      (eventsOn(ds).length ? '<i style="background:#fbbf24"></i>' : '');
    cells += `<button class="cal-cell ${ds === today ? 'today' : ''} ${ds === calSel ? 'sel' : ''} ${future ? 'future' : ''}"
      data-calday="${ds}" style="${bg}"><span class="d">${n}</span><span class="cal-dots">${dots}</span></button>`;
  }

  // ---- selected-day panel ----
  const en = e[calSel];
  const hc = en && en.habits ? Object.values(en.habits).filter(Boolean).length : 0;
  const evs = eventsOn(calSel);
  const evRows = evs.map(x => `<div class="lrow"><div class="lrow-main">
      <span class="ev-time">${x.time || '—'}</span>
      <div class="txt">${escapeHtml(x.label)} ${x.alarm ? '⏰' : ''}</div>
      <button class="del" data-ev-del="${x.id}">×</button></div></div>`).join('');
  const pills = en ? `<div class="hist-moods" style="margin:8px 0">
      <span class="pill">😊 ${en.mood || '–'}</span><span class="pill">⚡ ${en.energy || '–'}</span>
      <span class="pill">✅ ${hc}/${HABITS.length}</span>${en.sleepHours ? `<span class="pill">😴 ${en.sleepHours}h</span>` : ''}</div>
      ${en.timeSummary ? `<div class="hint" style="margin-bottom:6px">⏱ ${escapeHtml(en.timeSummary)}</div>` : ''}
      ${en.journal ? `<div class="hint" style="margin-bottom:6px">📓 ${escapeHtml(en.journal.slice(0, 80))}${en.journal.length > 80 ? '…' : ''}</div>` : ''}`
    : `<div class="hint" style="margin:8px 0">${calSel > today ? 'Future day — plan something below 👇' : 'Nothing logged this day.'}</div>`;

  document.getElementById('s-cal').innerHTML = `
    <div class="card">
      <div class="cal-nav">
        <button class="btn btn-ghost btn-sm" id="cal-prev">‹</button>
        <div class="cal-title">${monthName}</div>
        <button class="btn btn-ghost btn-sm" id="cal-next">›</button>
        <button class="btn btn-ghost btn-sm" id="cal-today">Today</button>
      </div>
      <div class="cal-head">${['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="tl-legend" style="margin-top:10px">
        <span><span class="dot" style="background:hsl(120,62%,45%)"></span>good day</span>
        <span><span class="dot" style="background:hsl(30,62%,45%)"></span>rough</span>
        <span><span class="dot" style="background:#f87171"></span>gym</span>
        <span><span class="dot" style="background:#4ad6c0"></span>time tracked</span>
        <span><span class="dot" style="background:#fbbf24"></span>event</span>
      </div>
    </div>
    <div class="card">
      <h2>${prettyDate(calSel)} ${calSel === today ? '<span class="hint">today</span>' : ''}
        <button class="btn btn-ghost btn-sm" style="float:right" data-callog="${calSel}">Open log →</button></h2>
      ${pills}
      <h2 style="margin-top:14px">📌 Events <span class="hint">${evs.length ? evs.length : 'none yet'}</span></h2>
      ${evRows}
      <div class="task-add">
        <input type="time" id="ev-new-time" style="max-width:110px">
        <input type="text" id="ev-new-label" placeholder="Event… (e.g. Dentist)" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="ev-add">Add</button>
      </div>
      <label class="ev-alarm-row"><input type="checkbox" id="ev-new-alarm" checked> ⏰ Ring an alarm at that time</label>
    </div>`;
}
document.addEventListener('click', (ev) => {
  if (!document.getElementById('s-cal') || !document.getElementById('s-cal').classList.contains('on')) return;
  const shift = n => { const [y, m] = calMonth.split('-').map(Number); const d = new Date(y, m - 1 + n, 1);
    calMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); renderCal(); };
  if (ev.target.id === 'cal-prev') return shift(-1);
  if (ev.target.id === 'cal-next') return shift(1);
  if (ev.target.id === 'cal-today') { calSel = todayStr(); calMonth = calSel.slice(0, 7); renderCal(); return; }
  const dc = ev.target.closest('[data-calday]');
  if (dc) { calSel = dc.dataset.calday; renderCal(); return; }
  const ol = ev.target.closest('[data-callog]');
  if (ol) { logDate = ol.dataset.callog; show('today'); return; }
  if (ev.target.id === 'ev-add') {
    const time = document.getElementById('ev-new-time').value;
    const label = document.getElementById('ev-new-label').value.trim();
    const alarm = document.getElementById('ev-new-alarm').checked;
    if (!label) { toast('Name the event', true); return; }
    const evs = DB.events();
    const id = 'ev' + Date.now();
    // if the event's moment is already in the past, mark it acknowledged so it doesn't insta-ring
    if (time && new Date(calSel + 'T' + time + ':00').getTime() <= Date.now()) localStorage.setItem('dp.notified.' + id, '1');
    evs.push({ id, date: calSel, time, label, alarm });
    DB.saveEvents(evs); renderCal(); setupReminders();
    if (alarm && 'Notification' in window && Notification.permission !== 'granted') Notification.requestPermission();
    toast('Event added 📌'); return;
  }
  const ed = ev.target.closest('[data-ev-del]');
  if (ed) { DB.saveEvents(DB.events().filter(x => x.id !== ed.dataset.evDel)); renderCal(); setupReminders(); toast('Event deleted'); return; }
});

/* ============================================================
   SCREEN: SETTINGS / MORE
   ============================================================ */
function renderSettings() {
  document.getElementById('screen-title').textContent = 'More';
  document.getElementById('screen-sub').textContent = 'Sync, reminders, data';
  const s = DB.settings();
  if (!s.ntfyTopic) { s.ntfyTopic = 'dp-' + randomToken(); DB.saveSettings(s); }   // one secret topic per user
  document.getElementById('s-settings').innerHTML = `
    <div class="card">
      <h2>🎨 Customize &amp; more</h2>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" id="open-custom">🎨 Customize habits &amp; activities</button>
        <button class="btn btn-ghost btn-sm" id="open-history">🕘 History</button>
      </div>
      <div class="btn-row" style="margin-top:8px">
        <a class="btn btn-ghost btn-sm" href="guide.html" target="_blank" rel="noopener" style="text-decoration:none;display:flex;align-items:center;justify-content:center">📖 How to use Daily Pulse</a>
      </div>
    </div>
    <div class="card" style="border-color:rgba(251,191,36,.4)">
      <h2>📦 Your data lives on this device</h2>
      <div class="hint">Daily Pulse is fully private — nothing is uploaded anywhere. The flip side: <b>uninstalling the app or clearing its storage erases everything.</b> Export a backup file regularly and keep it somewhere safe (Drive, email to yourself…).</div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn btn-primary btn-sm" id="export-quick">⬇ Export backup now</button>
      </div>
      <div class="hint" style="margin-top:8px">Last backup: <b>${(() => { const t = +localStorage.getItem('dp.lastBackup') || 0; if (!t) return 'never ⚠️'; const d = Math.floor((Date.now() - t) / 86400000); return d === 0 ? 'today ✅' : d + ' day' + (d === 1 ? '' : 's') + ' ago' + (d > 7 ? ' ⚠️' : ''); })()}</b></div>
    </div>
    <div class="card">
      <h2>💬 Feedback <span class="hint">30 seconds, no sign-in</span></h2>
      <div class="field"><textarea id="fb-text" placeholder="What's confusing? What's missing? What do you love?" style="min-height:70px"></textarea></div>
      <div class="task-add">
        <input type="text" id="fb-contact" placeholder="Email (optional, only if you want a reply)" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="fb-send">Send</button>
      </div>
    </div>
    <div class="card">
      <h2>☁️ Sync &amp; login <span class="hint">${s.syncUrl ? 'connected ●' : 'not connected'}</span></h2>
      <div class="field"><label>Your sheet link = your login key <span class="hint">paste it on any device to load your data</span></label>
        <input type="url" id="sync-url" placeholder="https://script.google.com/macros/s/…/exec" value="${escapeHtml(s.syncUrl)}"></div>
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" id="save-sync">Connect / Log in</button>
        <button class="btn btn-ghost btn-sm" id="sync-now">⟳ Sync now</button>
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn btn-ghost btn-sm" id="resync">Push all to Sheet</button>
      </div>
      <div class="hint" style="margin-top:8px">Saving on one device shows on the others when you open the app or tap Sync now. Newest edit wins.</div>
    </div>
    <div class="card">
      <h2>⏰ Reminders <span class="hint">${DB.reminders().length} set</span></h2>
      ${DB.reminders().length ? DB.reminders().map(r => `
        <div class="rem ${r.enabled?'':'off'}" data-remid="${r.id}">
          <button class="rem-toggle" data-rem-toggle="${r.id}" title="on/off">${r.enabled?'🔔':'🔕'}</button>
          <div class="rem-body">
            <input type="time" data-rem-time="${r.id}" value="${r.time||''}">
            <input type="text" data-rem-label="${r.id}" value="${escapeHtml(r.label||'')}" placeholder="What for? (e.g. Log my day, Drink water)">
            <button class="rem-mode" data-rem-mode="${r.id}" title="tap to switch">${(r.mode||'alarm')==='alarm'?'⏰ Full-screen alarm':'🔔 Just a notification'}</button>
          </div>
          <button class="del" data-rem-del="${r.id}">×</button>
        </div>`).join('') : '<div class="empty">No reminders yet. Add one below 👇</div>'}
      <div class="task-add">
        <input type="time" id="rem-new-time" value="21:00" style="max-width:120px">
        <input type="text" id="rem-new-label" placeholder="Reminder name…">
        <button class="btn btn-primary btn-sm" id="rem-add">Add</button>
      </div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn btn-primary btn-sm" id="rem-test">🔔 Test alarm</button>
        <button class="btn btn-ghost btn-sm" id="rem-test15">⏱ Test in 15 sec</button>
        <button class="btn btn-ghost btn-sm" id="rem-calendar">📅 Add to phone calendar</button>
        ${nativeShell() ? '<button class="btn btn-ghost btn-sm" id="rem-native-test">🔔 Test notification (1 min)</button>' : ''}
        ${fullScreenPlugin() ? '<button class="btn btn-primary btn-sm" id="rem-fs-test">⏰ Test full-screen alarm (1 min)</button>' : ''}
      </div>
      <div class="hint" style="margin-top:8px">The full-screen alarm fires while the app is open, and catches missed ones when you reopen. For alarms even when the app is fully closed, tap <b>Add to phone calendar</b> (adds daily repeating alerts your phone rings natively).</div>
    </div>
    ${nativeShell() ? '' : `<div class="card">
      <h2>🔔 Background alarms · ntfy <span class="hint">${s.ntfyOn ? 'ON ●' : 'off'}</span></h2>
      <div class="hint">Rings even when this app is <b>closed & your phone is locked</b>. One-time setup with the free <b>ntfy</b> app.</div>
      <div class="task-add" style="margin-top:8px">
        <input type="text" id="ntfy-topic" value="${escapeHtml(s.ntfyTopic || '')}" placeholder="your-secret-topic" style="flex:1" spellcheck="false" autocapitalize="off">
        <button class="btn btn-ghost btn-sm" id="ntfy-copy">Copy</button>
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn ${s.ntfyOn ? 'btn-ghost' : 'btn-primary'} btn-sm" id="ntfy-enable">${s.ntfyOn ? 'Turn OFF' : 'Turn ON'}</button>
        <button class="btn btn-ghost btn-sm" id="ntfy-open">Open ntfy</button>
        <button class="btn btn-ghost btn-sm" id="ntfy-test">Test push</button>
      </div>
      <div class="hint" style="margin-top:8px"><b>Setup:</b> ① Install <b>ntfy</b> (Play Store / App&nbsp;Store). ② In ntfy tap ➕ and subscribe to the topic <b>${escapeHtml(s.ntfyTopic || '—')}</b>. ③ Come back, tap <b>Turn ON</b>, then <b>Test push</b> — your phone should buzz. Reminders are sent up to 3 days ahead, so open this app at least every few days.</div>
    </div>`}
    <div class="card">
      <h2>💾 Your data</h2>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" id="export">Export backup</button>
        <button class="btn btn-ghost btn-sm" id="import">Import backup</button>
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn btn-ghost btn-sm" id="export-csv">⬇ Export CSV (for Excel/AI)</button>
      </div>
      <input type="file" id="import-file" accept="application/json" style="display:none">
    </div>
    <div class="card"><h2>ℹ️ About</h2>
      <div class="hint">Daily Pulse · <b>${APP_VERSION}</b> · local-first. Your data stays on this device${s.syncUrl?' and syncs to your Google Sheet':''}.
      Add to Home Screen to use it like a native app, offline. · <a href="privacy.html" target="_blank" rel="noopener">Privacy policy</a></div></div>
  `;
}
document.addEventListener('click', async (ev) => {
  const s = DB.settings();
  if (ev.target.id === 'save-sync') {
    s.syncUrl = document.getElementById('sync-url').value.trim(); DB.saveSettings(s);
    if (s.syncUrl) { toast('Connected — loading your data…'); pullState(ok => { renderSettings(); toast(ok ? 'Logged in & synced ✅' : 'Connected (nothing to pull yet)'); }); }
    else { renderSettings(); toast('Link cleared'); }
  }
  if (ev.target.id === 'sync-now') { toast('Syncing…'); pullState(ok => { if (!ok) pushState(true); toast('Synced ✅'); }); }
  if (ev.target.id === 'resync') { toast('Pushing all…'); resyncAll(); }
  if (ev.target.id === 'rem-add') {
    const time = document.getElementById('rem-new-time').value;
    const label = document.getElementById('rem-new-label').value.trim();
    if (!time) { toast('Pick a time', true); return; }
    const r = DB.reminders(); r.push({ id: 'r' + Date.now(), time, label: label || 'Reminder', enabled: true });
    DB.saveReminders(r); renderSettings(); syncReminders();
    if ('Notification' in window && Notification.permission !== 'granted') await Notification.requestPermission();
    setupReminders(); toast('Reminder added');
    return;
  }
  const rt = ev.target.closest('[data-rem-toggle]');
  if (rt) { const r = DB.reminders(); const x = r.find(z => z.id === rt.dataset.remToggle); if (x) x.enabled = !x.enabled; DB.saveReminders(r); renderSettings(); syncReminders(); setupReminders(); return; }
  const rm = ev.target.closest('[data-rem-mode]');
  if (rm) { const r = DB.reminders(); const x = r.find(z => z.id === rm.dataset.remMode); if (x) { x.mode = (x.mode || 'alarm') === 'alarm' ? 'notify' : 'alarm'; DB.saveReminders(r); renderSettings(); syncReminders(); setupReminders(); toast(x.mode === 'alarm' ? 'Full-screen alarm ⏰' : 'Just a notification 🔔'); } return; }
  const rd = ev.target.closest('[data-rem-del]');
  if (rd) { DB.saveReminders(DB.reminders().filter(z => z.id !== rd.dataset.remDel)); renderSettings(); syncReminders(); setupReminders(); toast('Reminder deleted'); return; }
  if (ev.target.id === 'rem-test') {
    unlockAudio();
    if ('Notification' in window && Notification.permission !== 'granted') Notification.requestPermission();
    fireAlarm('Test alarm ✅', '', false);
    return;
  }
  if (ev.target.id === 'rem-test15') {
    unlockAudio();
    if ('Notification' in window && Notification.permission !== 'granted') await Notification.requestPermission();
    toast('Alarm in 15s — keep this screen open 👀');
    setTimeout(() => fireAlarm('Scheduled test 🔔 (15s)', '', false), 15000);
    return;
  }
  if (ev.target.id === 'rem-calendar') { exportReminderCalendar(); return; }
  if (ev.target.id === 'rem-native-test') {
    const LN = window.Capacitor.Plugins.LocalNotifications;
    (async () => {
      const perm = await LN.requestPermissions();
      if (perm.display !== 'granted') { toast('Allow notifications first', true); return; }
      await LN.schedule({ notifications: [{ id: 424242, title: '⏰ Daily Pulse native alarm',
        body: 'It works — this rang even with the app closed! 🎉',
        schedule: { at: new Date(Date.now() + 60000), allowWhileIdle: true }, sound: 'default' }] });
      toast('Scheduled for 1 min — now swipe the app away and wait 📴');
    })();
    return;
  }
  if (ev.target.id === 'rem-fs-test') {
    const FS = fullScreenPlugin();
    if (!FS) { toast('Full-screen alarm needs the app update', true); return; }
    FS.schedule({ alarms: [{ id: 399, at: Date.now() + 60000,
      title: 'Daily Pulse alarm ⏰', body: 'Full-screen alarm — it works even when locked! 🎉' }] });
    toast('Full-screen alarm in 1 min — lock your phone & wait 🔔');
    return;
  }
  if (ev.target.id === 'ntfy-enable') {
    s.ntfyOn = !s.ntfyOn;
    if (s.ntfyOn && !s.ntfyTopic) s.ntfyTopic = 'dp-' + randomToken();
    DB.saveSettings(s); renderSettings();
    if (s.ntfyOn) { scheduleNtfy(); toast('Background alarms ON — subscribe to the topic in the ntfy app'); }
    else toast('Background alarms off');
    return;
  }
  if (ev.target.id === 'ntfy-copy') {
    const t = (document.getElementById('ntfy-topic') || {}).value || s.ntfyTopic || '';
    try { await navigator.clipboard.writeText(t); toast('Topic copied'); } catch (_) { toast(t); }
    return;
  }
  if (ev.target.id === 'ntfy-open') {
    const t = (document.getElementById('ntfy-topic') || {}).value || s.ntfyTopic || '';
    window.open('https://ntfy.sh/' + encodeURIComponent(t), '_blank');
    return;
  }
  if (ev.target.id === 'ntfy-test') {
    const t = (document.getElementById('ntfy-topic') || {}).value || s.ntfyTopic || '';
    if (!t) { toast('Set a topic first', true); return; }
    toast('Sending test push…');
    const ok = await ntfyPublish(t, 'Test push ✅ — ntfy works!', null);
    toast(ok ? 'Sent ✅ — check your phone / ntfy app' : 'Failed — check the topic & connection', !ok);
    return;
  }
  if (ev.target.id === 'open-custom') { show('custom'); return; }
  if (ev.target.id === 'open-history') { show('history'); return; }
  if (ev.target.id === 'export-quick') { exportData(); renderSettings(); return; }
  if (ev.target.id === 'fb-send') {
    const text = (document.getElementById('fb-text').value || '').trim();
    if (!text) { toast('Write something first 🙂', true); return; }
    const contact = (document.getElementById('fb-contact').value || '').trim();
    sendFeedback(text, contact);
    return;
  }
  if (ev.target.id === 'export') exportData();
  if (ev.target.id === 'export-csv') exportCSV();
  if (ev.target.id === 'import') document.getElementById('import-file').click();
});
// Edit a reminder's time/label inline
document.addEventListener('input', (ev) => {
  const t = ev.target.closest('[data-rem-time]'); if (t) { const r = DB.reminders(); const x = r.find(z => z.id === t.dataset.remTime); if (x) { x.time = t.value; DB.saveReminders(r); setupReminders(); } return; }
  const l = ev.target.closest('[data-rem-label]'); if (l) { const r = DB.reminders(); const x = r.find(z => z.id === l.dataset.remLabel); if (x) { x.label = l.value; DB.saveReminders(r); } return; }
  if (ev.target.id === 'ntfy-topic') { const s = DB.settings(); s.ntfyTopic = ev.target.value.trim(); DB.saveSettings(s); return; }
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'import-file' && ev.target.files[0]) importData(ev.target.files[0]);
  if (ev.target.closest('[data-rem-time]') || ev.target.closest('[data-rem-label]')) syncReminders();
});
/* ---------- Feedback (frictionless, no sign-in) ----------
   Goes to a tiny Apps Script endpoint (google-apps-script/Feedback.gs)
   that appends rows to a private "Feedback" sheet. Empty URL = not yet
   deployed; falls back to opening a GitHub issue. */
const FEEDBACK_URL = '';   // paste the Feedback.gs web-app URL after deploying
function sendFeedback(text, contact) {
  if (!FEEDBACK_URL) {
    window.open('https://github.com/kishore2494/daily-pulse/issues/new?title=' + encodeURIComponent('Feedback') + '&body=' + encodeURIComponent(text), '_blank');
    return;
  }
  fetch(FEEDBACK_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ text, contact, version: APP_VERSION, ua: navigator.userAgent.slice(0, 120) }) }).catch(() => {});
  document.getElementById('fb-text').value = '';
  document.getElementById('fb-contact').value = '';
  toast('Thank you! Feedback sent 💛');
}

/* Everything the app stores, for a COMPLETE backup/restore. */
const BACKUP_KEYS = ['entries', 'tasks', 'notes', 'plans', 'gym', 'exercises', 'reminders', 'timelog', 'timeacts', 'events', 'docs', 'habitcfg', 'actcfg', 'deepcfg', 'gymcfg', 'corecfg', 'daycfg', 'gymgroups', 'navcfg'];
function exportData() {
  const out = { settings: DB.settings() };
  BACKUP_KEYS.forEach(k => { const raw = localStorage.getItem('dp.' + k); if (raw) out[k] = JSON.parse(raw); });
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'daily-pulse-backup-' + todayStr() + '.json'; a.click();
  localStorage.setItem('dp.lastBackup', String(Date.now()));
  toast('Full backup downloaded');
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try { const d = JSON.parse(r.result);
      BACKUP_KEYS.forEach(k => { if (d[k] !== undefined) localStorage.setItem('dp.' + k, JSON.stringify(d[k])); });
      if (d.settings) DB.saveSettings(Object.assign(DB.settings(), d.settings));
      reloadCfg();
      toast('Backup restored'); refreshStreak(); setupReminders(); pushState(true); show('dash');
    } catch (e) { toast('Bad backup file', true); }
  };
  r.readAsText(file);
}
/* Janitor: drop notified-flags from past days so localStorage doesn't grow forever. */
function cleanNotifiedFlags() {
  const today = todayStr();
  const liveEventIds = new Set(DB.events().filter(x => x.date >= today).map(x => x.id));
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k || k.indexOf('dp.notified.') !== 0) continue;
    const rest = k.slice('dp.notified.'.length);
    const m = rest.match(/\.(\d{4}-\d{2}-\d{2})$/);
    if (m) { if (m[1] < today) localStorage.removeItem(k); }              // daily reminder flag
    else if (rest.indexOf('ev') === 0 && !liveEventIds.has(rest)) localStorage.removeItem(k);   // stale event flag
  }
}

/* ---------- Reminders (multiple, foreground firing) ---------- */
let reminderInterval, reminderTimeouts = [];
function checkReminders(catchUp) {
  if (nativeShell()) return;   // native app: AlarmManager + LocalNotifications own firing (no web double-ring)
  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();
  DB.reminders().forEach(r => {
    if (!r.enabled || !r.time) return;
    const [h, m] = r.time.split(':').map(Number);
    const remMin = h * 60 + m;
    const flag = 'dp.notified.' + r.id + '.' + todayStr();
    if (localStorage.getItem(flag)) return;
    // when open: fire at the exact minute. on reopen: fire anything due earlier today (still unacknowledged).
    const due = catchUp ? (curMin >= remMin) : (curMin === remMin);
    if (!due) return;
    localStorage.setItem(flag, '1');
    if ('Notification' in window && Notification.permission === 'granted')
      new Notification('⏰ ' + (r.label || 'Daily Pulse'), { body: r.label ? 'Reminder: ' + r.label : 'Time for your daily log 🔥', tag: r.id });
    if ((r.mode || 'alarm') === 'alarm') fireAlarm(r.label || 'Reminder', r.time, catchUp && curMin !== remMin);
    else toast('🔔 ' + (r.label || 'Reminder'));   // "just a notification" mode — no full-screen alarm
  });
  // One-time dated events (from the Calendar tab) — same due/ack logic, no daily repeat.
  DB.events().forEach(x => {
    if (x.date !== todayStr() || !x.time) return;
    const [h, m] = x.time.split(':').map(Number);
    const evMin = h * 60 + m;
    const flag = 'dp.notified.' + x.id;
    if (localStorage.getItem(flag)) return;
    const due = catchUp ? (curMin >= evMin) : (curMin === evMin);
    if (!due) return;
    localStorage.setItem(flag, '1');
    if ('Notification' in window && Notification.permission === 'granted')
      new Notification('📌 ' + x.label, { body: x.time + ' · ' + x.label, tag: x.id });
    if (x.alarm) fireAlarm(x.label, x.time, catchUp && curMin !== evMin);
    else toast('📌 ' + x.label);
  });
}
function setupReminders() {
  clearInterval(reminderInterval);
  reminderTimeouts.forEach(clearTimeout); reminderTimeouts = [];
  const rems = DB.reminders().filter(r => r.enabled && r.time);
  const todaysEvents = DB.events().filter(x => x.date === todayStr() && x.time);
  if (!rems.length && !todaysEvents.length) return;
  // 1) Polling backup every 10s — self-heals a missed/late tick (`true` = due & unacknowledged).
  reminderInterval = setInterval(() => checkReminders(true), 10000);
  // 2) Precise per-reminder timer to the exact next occurrence today. A setTimeout aimed at the
  //    exact moment is far more reliable than waiting for a poll tick to land on the right minute.
  const now = new Date();
  rems.concat(todaysEvents).forEach(r => {
    const [h, m] = r.time.split(':').map(Number);
    const target = new Date(now); target.setHours(h, m, 0, 0);
    const ms = target - now;
    if (ms < -60000 || ms > 12 * 3600 * 1000) return;   // long past → poll/catch-up; too far → skip
    reminderTimeouts.push(setTimeout(() => checkReminders(true), Math.max(0, ms) + 300));
  });
  checkReminders(true);   // check immediately too (catches an already-due one)
  if (nativeShell()) { scheduleNativeAlarms(); refreshTimerNotif(); return; }   // Android app: real native alarms, skip the workarounds
  scheduleBackgroundNotifications();   // + OS-level alarms even when the app is closed (where supported)
  scheduleNtfy();                      // + ntfy push (rings via the ntfy app even when this app is closed)
}

/* ---------- Loud in-app alarm (Web Audio siren + vibration + full-screen) ---------- */
let _ac = null, _alarmTimer = null;
function unlockAudio() { try { if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)(); if (_ac.state === 'suspended') _ac.resume(); } catch (e) {} }
document.addEventListener('pointerdown', unlockAudio);
function beep(freq) {
  if (!_ac) return;
  const o = _ac.createOscillator(), g = _ac.createGain(), t = _ac.currentTime;
  o.type = 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g); g.connect(_ac.destination); o.start(t); o.stop(t + 0.47);
}
function fireAlarm(label, time, missed) {
  const el = document.getElementById('alarm'); if (!el || el.classList.contains('on')) return;
  el.dataset.label = label; el.dataset.time = time || '';
  document.getElementById('alarm-label').textContent = label;
  document.getElementById('alarm-sub').textContent = (missed ? 'missed · ' : '') + (time || '') + ' reminder';
  el.classList.add('on');
  unlockAudio();
  let hi = true; beep(880);
  _alarmTimer = setInterval(() => { beep(hi ? 988 : 740); hi = !hi; if (navigator.vibrate) navigator.vibrate(300); }, 700);
  if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
}
function stopAlarm() {
  const el = document.getElementById('alarm'); if (el) el.classList.remove('on');
  clearInterval(_alarmTimer); _alarmTimer = null;
  if (navigator.vibrate) navigator.vibrate(0);
}
document.addEventListener('click', (ev) => {
  if (ev.target.id === 'alarm-dismiss') { stopAlarm(); return; }
  if (ev.target.id === 'alarm-snooze') {
    const el = document.getElementById('alarm'); const label = el.dataset.label;
    stopAlarm();
    toast('Snoozed 5 min'); setTimeout(() => fireAlarm(label, '', true), 5 * 60000);
  }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminders(true); scheduleNtfy(); syncTimelog(); refreshTimerNotif(); scheduleInactivityReminder(); } });
// Push the reminders list to the Sheet (a "Reminders" tab)
function syncReminders() {
  const url = DB.settings().syncUrl; if (!url) return;
  fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ type: 'reminders', items: DB.reminders() }) }).catch(() => {});
}
// Download an .ics so the phone calendar alarms even when the app is closed.
// RFC5545-valid: includes DTSTAMP + DURATION (Google/Apple reject events without them).
function exportReminderCalendar() {
  const rs = DB.reminders().filter(r => r.enabled && r.time);
  if (!rs.length) { toast('Add a reminder first', true); return; }
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const stamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) +
    'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + 'Z';
  const start = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());   // start recurring today (local)
  const esc = s => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Daily Pulse//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';
  rs.forEach((r) => {
    const [h, m] = r.time.split(':');
    const label = esc(r.label || 'Daily Pulse reminder');
    ics += 'BEGIN:VEVENT\r\n' +
      'UID:dailypulse-' + r.id + '@jurnal\r\n' +
      'DTSTAMP:' + stamp + '\r\n' +
      'DTSTART:' + start + 'T' + pad(h) + pad(m) + '00\r\n' +
      'DURATION:PT5M\r\n' +
      'RRULE:FREQ=DAILY\r\n' +
      'SUMMARY:' + label + '\r\n' +
      'BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT0M\r\nDESCRIPTION:' + label + '\r\nEND:VALARM\r\n' +
      'END:VEVENT\r\n';
  });
  ics += 'END:VCALENDAR\r\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  a.download = 'daily-pulse-reminders.ics'; a.click();
  toast('Calendar file ready — open it to add');
}

/* ---------- Native alarms (Capacitor shell) ----------
   When the site runs inside the Daily Pulse Android app (Capacitor WebView),
   window.Capacitor exposes LocalNotifications — REAL exact alarms that ring
   with the app closed, no ntfy needed. In a plain browser this whole block
   no-ops. Reminder n uses ids n*1000+day, events use hash ids — cancelled
   and rescheduled wholesale on every setupReminders(). */
function nativeShell() { return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications); }
function fullScreenPlugin() { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FullScreenAlarm) || null; }
// Each reminder/event carries mode 'alarm' (loud full-screen takeover) or 'notify' (plain heads-up).
// Alarm-mode → the native FullScreenAlarm plugin (rings over the lock screen). Notify-mode, and
// everything when the full-screen plugin is absent, → ordinary LocalNotifications.
async function scheduleNativeAlarms() {
  if (!nativeShell()) return false;
  const LN = window.Capacitor.Plugins.LocalNotifications;
  const FS = fullScreenPlugin();
  const now = Date.now();
  try {
    const perm = await LN.requestPermissions();
    const notifOk = perm.display === 'granted';
    // wipe previously scheduled LocalNotifications
    if (notifOk) {
      const pending = await LN.getPending();
      if (pending.notifications && pending.notifications.length)
        await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    }
    const notifs = [];   // LocalNotifications (notify mode / fallback)
    const alarms = [];   // native full-screen (alarm mode)
    let seq = 1;
    const wantsAlarm = m => (m || 'alarm') === 'alarm';
    const add = (t, title, body, alarm) => {
      if (alarm && FS) alarms.push({ id: seq++, at: t.getTime(), title, body });
      else notifs.push({ id: seq++, title, body, schedule: { at: t, allowWhileIdle: true },
        sound: alarm ? 'default' : undefined });
    };
    DB.reminders().filter(r => r.enabled && r.time).forEach(r => {
      const [h, m] = r.time.split(':').map(Number);
      for (let d = 0; d < 7; d++) {
        const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0);
        if (t.getTime() <= now) continue;
        add(t, '⏰ ' + (r.label || 'Daily Pulse'),
          r.label ? 'Reminder: ' + r.label : 'Time for your daily log 🔥', wantsAlarm(r.mode));
      }
    });
    DB.events().filter(x => x.time && x.date >= todayStr()).forEach(x => {
      const t = new Date(x.date + 'T' + x.time + ':00');
      if (isNaN(t.getTime()) || t.getTime() <= now) return;
      add(t, '📌 ' + x.label, x.time + ' · ' + x.label, !!x.alarm);
    });
    if (notifOk && notifs.length) await LN.schedule({ notifications: notifs });
    if (FS) await FS.schedule({ alarms });   // always call so it clears old ones when list is empty
    scheduleInactivityReminder();
    return true;
  } catch (e) { return false; }
}

/* ---------- Running-timer notification (native shell) ----------
   Shows which activity is timing right now, with Pause / Stop / Resume actions.
   Live while the app process is alive; if Android has killed it, tapping an
   action relaunches the app and applies the change on open. Offline throughout. */
const TIMER_NOTIF_ID = 770;
let _timerNotifReady = false;
async function setupTimerNotif() {
  if (!nativeShell() || _timerNotifReady) return;
  const LN = window.Capacitor.Plugins.LocalNotifications;
  try {
    await LN.registerActionTypes({ types: [
      { id: 'dp_running', actions: [{ id: 'dp_pause', title: '⏸ Pause' }, { id: 'dp_stop', title: '⏹ Stop' }] },
      { id: 'dp_paused',  actions: [{ id: 'dp_resume', title: '▶ Resume' }, { id: 'dp_stop', title: '⏹ Stop' }] },
    ] });
    LN.addListener('localNotificationActionPerformed', (e) => {
      const a = e.actionId;
      if (a === 'dp_stop') { const r = runningSeg(); if (r) startAct(r.act); localStorage.removeItem('dp.pausedAct'); }
      else if (a === 'dp_pause') { const r = runningSeg(); if (r) { localStorage.setItem('dp.pausedAct', r.act); startAct(r.act); } }
      else if (a === 'dp_resume') { const pa = localStorage.getItem('dp.pausedAct'); localStorage.removeItem('dp.pausedAct'); if (pa) startAct(pa); }
      refreshTimerNotif();
      if (document.getElementById('s-time').classList.contains('on')) renderTime();
    });
    _timerNotifReady = true;
  } catch (e) {}
}
async function refreshTimerNotif() {
  if (!nativeShell()) return;
  const LN = window.Capacitor.Plugins.LocalNotifications;
  await setupTimerNotif();
  try {
    const run = runningSeg();
    const pausedId = localStorage.getItem('dp.pausedAct');
    if (run) {
      const act = actById(run.act);
      await LN.schedule({ notifications: [{
        id: TIMER_NOTIF_ID, title: `${act.emoji} ${act.name} — timing`,
        body: `Running since ${fmtClock(run.start)} · tap Pause or Stop`,
        actionTypeId: 'dp_running', ongoing: true, autoCancel: false,
        schedule: { at: new Date(Date.now() + 300) } }] });
    } else if (pausedId) {
      const act = actById(pausedId);
      await LN.schedule({ notifications: [{
        id: TIMER_NOTIF_ID, title: `⏸ ${act.emoji} ${act.name} — paused`,
        body: 'Tap Resume to continue timing',
        actionTypeId: 'dp_paused', ongoing: true, autoCancel: false,
        schedule: { at: new Date(Date.now() + 300) } }] });
    } else {
      await LN.cancel({ notifications: [{ id: TIMER_NOTIF_ID }] });
    }
  } catch (e) {}
}

/* ---------- 2-day inactivity nudge (native shell, fully offline) ----------
   Pre-schedules one "we miss you" notification for (last active day + 2 days)
   at 20:00. Fires even if the app is never opened. Refreshed on every use, so
   it keeps sliding forward as long as you keep logging. */
const INACTIVITY_ID = 760;
function lastActiveDay() {
  const days = Object.keys(DB.entries());
  DB.timelog().forEach(s => days.push(todayStr(new Date(s.start))));
  DB.gym && Object.keys(DB.gym()).forEach(d => days.push(d));
  return days.sort().slice(-1)[0] || todayStr();
}
async function scheduleInactivityReminder() {
  if (!nativeShell()) return;
  const LN = window.Capacitor.Plugins.LocalNotifications;
  try {
    await LN.cancel({ notifications: [{ id: INACTIVITY_ID }] });
    const fireDay = addDays(lastActiveDay(), 2);            // 2 clear days later
    const at = new Date(fireDay + 'T20:00:00');
    if (at.getTime() <= Date.now() + 60000) return;         // already past → nothing to schedule
    await LN.schedule({ notifications: [{
      id: INACTIVITY_ID, title: 'We miss you 👋',
      body: "It's been 2 days — a 60-second log keeps your streak alive 🔥",
      schedule: { at, allowWhileIdle: true } }] });
  } catch (e) {}
}

/* ---------- ntfy: real background push (rings even when the app is closed) ----------
   Uses ntfy.sh scheduled delivery: we POST each upcoming reminder occurrence with a
   future delivery time (up to ntfy.sh's 3-day limit). The ntfy phone app, subscribed
   to your secret topic, then rings natively at that time — no app-open needed. */
function randomToken() {
  const a = new Uint8Array(9);
  (crypto || window.crypto).getRandomValues(a);
  return Array.from(a, b => b.toString(36)).join('').slice(0, 12);
}
async function ntfyPublish(topic, message, atEpochSec, mode) {
  if (!topic) return false;
  try {
    const alarm = (mode || 'alarm') === 'alarm';
    const appUrl = location.href.split('#')[0].split('?')[0];
    // Alarm mode → tapping opens the loud full-screen alarm. Notify mode → just opens the app.
    const clickUrl = alarm ? appUrl + '?alarm=' + encodeURIComponent(message || 'Reminder') : appUrl;
    const body = {
      topic: topic,
      title: '⏰ ' + (message || 'Daily Pulse'),
      message: message || 'Time for your daily log 🔥',
      priority: alarm ? 5 : 3,           // 5 = max/loud heads-up; 3 = normal notification
      tags: [alarm ? 'alarm_clock' : 'bell'],
      click: clickUrl,
    };
    if (alarm) body.actions = [{ action: 'view', label: '⏰ Open alarm', url: clickUrl, clear: false }];
    if (atEpochSec) body.delay = String(atEpochSec);   // schedule for a future unix time
    const res = await fetch('https://ntfy.sh/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) { return false; }
}
// Schedule the next ~3 days of reminder occurrences to ntfy, de-duped so re-opening the
// app doesn't stack duplicate pushes.
async function scheduleNtfy() {
  const s = DB.settings();
  if (!s.ntfyOn || !s.ntfyTopic) return;
  const rs = DB.reminders().filter(r => r.enabled && r.time);
  const evs = DB.events().filter(x => x.time);
  if (!rs.length && !evs.length) return;
  let sent = {};
  try { sent = JSON.parse(localStorage.getItem('dp.ntfy.sent') || '{}'); } catch (_) {}
  const now = Date.now();
  const horizon = now + 3 * 24 * 3600 * 1000 - 5 * 60000;   // just under ntfy.sh's 3-day cap
  for (const r of rs) {
    const [h, m] = r.time.split(':').map(Number);
    for (let d = 0; d < 3; d++) {
      const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0);
      const ts = t.getTime();
      if (ts <= now + 30000 || ts > horizon) continue;       // must be ≥10s out and within 3 days
      const key = r.id + '@' + ts;
      if (sent[key]) continue;
      const ok = await ntfyPublish(s.ntfyTopic, r.label || 'Daily Pulse reminder', Math.floor(ts / 1000), r.mode);
      if (ok) sent[key] = 1;
    }
  }
  // Calendar events within the 3-day window (one-time, so no per-day loop)
  for (const x of evs) {
    const ts = new Date(x.date + 'T' + x.time + ':00').getTime();
    if (isNaN(ts) || ts <= now + 30000 || ts > horizon) continue;
    const key = x.id + '@' + ts;
    if (sent[key]) continue;
    const ok = await ntfyPublish(s.ntfyTopic, '📌 ' + x.label, Math.floor(ts / 1000), x.alarm ? 'alarm' : 'notify');
    if (ok) sent[key] = 1;
  }
  Object.keys(sent).forEach(k => { const ts = +String(k).split('@')[1]; if (ts && ts < now - 3600000) delete sent[k]; });
  localStorage.setItem('dp.ntfy.sent', JSON.stringify(sent));
}

// Progressive enhancement: on phones that support Notification Triggers (Chrome/Android),
// schedule OS-level notifications that fire even when the app is fully closed. Silently
// no-ops where unsupported (e.g. iOS) — the in-app alarm + calendar remain the fallbacks.
async function scheduleBackgroundNotifications() {
  try {
    if (!('serviceWorker' in navigator) || !('showTrigger' in Notification.prototype)) return false;
    if (Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    // Clear our previously-scheduled triggers so we don't stack duplicates.
    const existing = await reg.getNotifications({ includeTriggered: true });
    existing.forEach(n => { if (n.tag && n.tag.indexOf('dp-rem-') === 0) n.close(); });
    const rs = DB.reminders().filter(r => r.enabled && r.time);
    const now = new Date();
    for (const r of rs) {
      const [h, m] = r.time.split(':').map(Number);
      // schedule the next 14 daily occurrences
      for (let d = 0; d < 14; d++) {
        const t = new Date(now); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0);
        if (t.getTime() <= now.getTime()) continue;
        await reg.showNotification('⏰ ' + (r.label || 'Daily Pulse'), {
          tag: 'dp-rem-' + r.id + '-' + d,
          body: r.label ? 'Reminder: ' + r.label : 'Time for your daily log 🔥',
          showTrigger: new TimestampTrigger(t.getTime()),
          requireInteraction: true,
        });
      }
    }
    return true;
  } catch (e) { return false; }
}

/* ---------- Nav tabs: reorder / hide / rename (dp.navcfg) ---------- */
const NAV_DEF = [
  { k: 'today',    ico: '📝', label: 'Log',     locked: true },
  { k: 'time',     ico: '⏱️', label: 'Time' },
  { k: 'tasks',    ico: '✅', label: 'Tasks' },
  { k: 'notes',    ico: '🗒️', label: 'Notes' },
  { k: 'plans',    ico: '📋', label: 'Plans' },
  { k: 'gym',      ico: '💪', label: 'Gym' },
  { k: 'habits',   ico: '🔥', label: 'Habits' },
  { k: 'dash',     ico: '📊', label: 'Stats' },
  { k: 'cal',      ico: '📆', label: 'Cal' },
  { k: 'write',    ico: '✍️', label: 'Write' },
  { k: 'history',  ico: '🕘', label: 'History', hidden: true },
  { k: 'settings', ico: '⚙️', label: 'More',    locked: true },
];
function navCfg() {
  const s = localStorage.getItem('dp.navcfg');
  const cfg = s ? JSON.parse(s) : NAV_DEF.map(n => Object.assign({}, n));
  NAV_DEF.forEach(d => { if (!cfg.find(n => n.k === d.k)) cfg.splice(cfg.length - 1, 0, Object.assign({}, d)); });   // future tabs slot in before More
  return cfg;
}
function saveNavCfg(cfg) { localStorage.setItem('dp.navcfg', JSON.stringify(cfg)); renderNav(); pushState(); }
function renderNav() {
  const cur = (document.querySelector('.screen.on') || {}).id || 's-today';
  document.getElementById('nav').innerHTML = navCfg().filter(n => !n.hidden)
    .map(n => `<button data-screen="${n.k}" class="${'s-' + n.k === cur ? 'on' : ''}"><span class="ico">${n.ico}</span>${escapeHtml(n.label)}</button>`).join('');
}

/* ---------- Theme accent (device-local, in settings) ---------- */
const THEMES = [
  { id: 'indigo', a: '#6d8cff', b: '#8f7bff' },
  { id: 'teal',   a: '#2dd4bf', b: '#4ad6c0' },
  { id: 'pink',   a: '#ec4899', b: '#f472b6' },
  { id: 'amber',  a: '#f59e0b', b: '#fbbf24' },
  { id: 'green',  a: '#34d399', b: '#4ade80' },
  { id: 'red',    a: '#f87171', b: '#fb7185' },
];
function applyTheme() {
  const t = THEMES.find(x => x.id === (DB.settings().accent || 'indigo')) || THEMES[0];
  const r = document.documentElement.style;
  r.setProperty('--accent', t.a);
  r.setProperty('--grad-accent', `linear-gradient(135deg, ${t.a} 0%, ${t.b} 100%)`);
  r.setProperty('--glow-accent', `0 6px 22px ${t.a}52`);
}

/* ---------- Navigation ---------- */
const RENDER = { today: openToday, time: openTime, tasks: renderTasks, notes: renderNotes, plans: renderPlans, gym: openGym, habits: renderHabits, dash: renderDash, cal: renderCal, write: renderWrite, history: renderHistory, settings: renderSettings, custom: renderCustom };
function show(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById('s-' + name).classList.add('on');
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.screen === name));
  (RENDER[name] || (()=>{}))();
  window.scrollTo(0, 0);
}
document.addEventListener('click', (ev) => {
  const gn = ev.target.closest('[data-node]');
  if (gn && document.getElementById('s-dash').classList.contains('on')) {
    graphFocus = (graphFocus === gn.dataset.node) ? null : gn.dataset.node;
    const w = document.getElementById('graph-wrap');   // update ONLY the graph — page doesn't move
    if (w) w.innerHTML = graphSVG();
    return;
  }
  const rb = ev.target.closest('[data-range]');
  if (rb) { dashRange = +rb.dataset.range; renderDash(); }
});
document.getElementById('nav').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.screen === 'today') logDate = todayStr();   // Log tab always opens today
  if (b.dataset.screen === 'gym') gymDate = todayStr();     // Gym tab always opens today
  if (b.dataset.screen === 'plans') curPlan = null;         // Plans tab always opens the list
  if (b.dataset.screen === 'cal') { calSel = todayStr(); calMonth = calSel.slice(0, 7); }   // Calendar opens on today
  if (b.dataset.screen === 'write') curDoc = null;          // Write tab always opens the article list
  show(b.dataset.screen);
});

function refreshStreak() { document.getElementById('streak-n').textContent = loggedStreak(); }
function escapeHtml(s) { return (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ============================================================
   FIRST-RUN ONBOARDING — shown once to brand-new users only
   (any existing data or the dp.onboarded flag skips it).
   Step 1 welcome → step 2 pick habits → step 3 pick activities.
   Unpicked items are hidden via the same customize configs, so
   everything remains changeable later in More ▸ Customize.
   ============================================================ */
let obStep = 0;
const obHideH = new Set(), obHideA = new Set();
function needsOnboard() {
  return !localStorage.getItem('dp.onboarded')
    && !Object.keys(DB.entries()).length && !DB.timelog().length
    && !DB.tasks().length && !DB.docs().length;
}
function renderOnboard() {
  const el = document.getElementById('onboard');
  let body = '';
  if (obStep === 0) body = `
    <div class="ob-emoji">🔥</div>
    <h1>Daily Pulse</h1>
    <p class="ob-lead">Your whole life in one private tracker.</p>
    <div class="ob-points">
      <div>🔒 <b>Private by design</b> — everything stays on your phone. No account, no cloud, no tracking.</div>
      <div>⏱ <b>Track anything</b> — habits, mood, your day hour-by-hour, gym, journal, plans.</div>
      <div>🎨 <b>Make it yours</b> — every habit, field, workout and tab is customizable.</div>
      <div>📦 <b>One thing to know</b> — because it's fully private, your data lives ONLY on this phone. Export a backup now and then (More ▸ Your data) — uninstalling the app erases everything.</div>
    </div>
    <button class="btn btn-primary" data-ob-next>Get started</button>`;
  if (obStep === 1) body = `
    <h1>Pick your daily habits</h1>
    <p class="ob-lead">Tap to keep or drop, or add your own.</p>
    <div class="habits ob-grid">${habitCfg().map(h => `
      <div class="habit ${obHideH.has(h.key) ? '' : 'on'}" data-ob-habit="${h.key}">
        <span class="check">✓</span><span class="emoji">${h.emoji}</span><span>${escapeHtml(h.label)}</span>
      </div>`).join('')}</div>
    <div class="task-add ob-add">
      <input type="text" id="ob-new-habit" placeholder="Add your own… (e.g. 🌅 Wake at 6)" autocomplete="off">
      <button class="btn btn-primary btn-sm" id="ob-add-habit">Add</button>
    </div>
    <p class="ob-note">You can rename, recolor, hide or add more anytime in <b>More ▸ Customize</b>.</p>
    <button class="btn btn-primary" data-ob-next>Next</button>`;
  if (obStep === 2) body = `
    <h1>What do you spend time on?</h1>
    <p class="ob-lead">These become your one-tap stopwatch activities.</p>
    <div class="habits ob-grid">${actCfg().concat(DB.timeacts()).map(a => `
      <div class="habit ${obHideA.has(a.id) ? '' : 'on'}" data-ob-act="${a.id}">
        <span class="check">✓</span><span class="emoji">${a.emoji}</span><span>${escapeHtml(a.name)}</span>
      </div>`).join('')}</div>
    <div class="task-add ob-add">
      <input type="text" id="ob-new-act" placeholder="Add your own… (e.g. Cooking)" autocomplete="off">
      <button class="btn btn-primary btn-sm" id="ob-add-act">Add</button>
    </div>
    <p class="ob-note">Everything here is editable later in <b>More ▸ Customize</b>.</p>
    <button class="btn btn-primary" data-ob-next>Let's go 🚀</button>`;
  el.innerHTML = `<div class="ob-inner">${body}
    ${obStep > 0 ? '<button class="ob-back" data-ob-back>← back</button>' : ''}
    <div class="ob-dots">${[0, 1, 2].map(i => `<span class="${i === obStep ? 'on' : ''}"></span>`).join('')}</div></div>`;
}
document.addEventListener('click', (ev) => {
  const el = document.getElementById('onboard');
  if (!el || !el.classList.contains('on')) return;
  const hb = ev.target.closest('[data-ob-habit]');
  if (hb) { const k = hb.dataset.obHabit; obHideH.has(k) ? obHideH.delete(k) : obHideH.add(k); renderOnboard(); return; }
  const ac = ev.target.closest('[data-ob-act]');
  if (ac) { const k = ac.dataset.obAct; obHideA.has(k) ? obHideA.delete(k) : obHideA.add(k); renderOnboard(); return; }
  if (ev.target.id === 'ob-add-habit') {
    const inp = document.getElementById('ob-new-habit'); const raw = (inp.value || '').trim(); if (!raw) return;
    const m = raw.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u);
    const cfg = habitCfg();
    cfg.push({ key: 'ch' + Date.now(), emoji: (m && m[2]) ? m[1] : '⭐', label: (m && m[2]) ? m[2] : raw, custom: true });
    saveHabitCfg(cfg); renderOnboard(); return;   // new item shows selected (not in obHideH)
  }
  if (ev.target.id === 'ob-add-act') {
    const inp = document.getElementById('ob-new-act'); const name = (inp.value || '').trim(); if (!name) return;
    const acts = DB.timeacts();
    acts.push({ id: 'ta' + Date.now(), emoji: '⭐', name, color: CUSTOM_ACT_COLORS[acts.length % CUSTOM_ACT_COLORS.length] });
    DB.saveTimeacts(acts); renderOnboard(); return;
  }
  if (ev.target.closest('[data-ob-back]')) { obStep = Math.max(0, obStep - 1); renderOnboard(); return; }
  if (ev.target.closest('[data-ob-next]')) {
    if (obStep < 2) { obStep++; renderOnboard(); return; }
    // finish: apply picks as hidden-flags in the normal customize configs
    if (obHideH.size) { const cfg = habitCfg(); cfg.forEach(h => { if (obHideH.has(h.key)) h.hidden = true; }); saveHabitCfg(cfg); }
    if (obHideA.size) {
      const cfg = actCfg(); cfg.forEach(a => { if (obHideA.has(a.id)) a.hidden = true; }); saveActCfg(cfg);
      const cust = DB.timeacts(); let ch = false; cust.forEach(a => { if (obHideA.has(a.id)) { a.hidden = true; ch = true; } }); if (ch) DB.saveTimeacts(cust);
    }
    localStorage.setItem('dp.onboarded', '1');
    el.classList.remove('on');
    show('today');
    toast('Welcome! Change anything later in More ▸ Customize 🎨');
  }
});

/* ---------- Init ---------- */
cleanNotifiedFlags();
applyTheme();
renderNav();
refreshStreak();
show('today');
if (needsOnboard()) { document.getElementById('onboard').classList.add('on'); renderOnboard(); }
else localStorage.setItem('dp.onboarded', '1');   // existing users never see it
setupReminders();
setTimeout(() => checkReminders(true), 1000);   // catch a reminder you missed while the app was closed
// Opened by tapping an ntfy push (?alarm=<label>) → go straight into the loud full-screen alarm.
(function () {
  try {
    const p = new URLSearchParams(location.search);
    if (p.has('alarm')) {
      const label = p.get('alarm') || 'Reminder';
      history.replaceState(null, '', location.pathname);   // clean URL so a refresh won't re-fire
      unlockAudio();
      setTimeout(() => fireAlarm(label, '', false), 400);
    }
  } catch (e) {}
})();
pullState();   // multi-device: pull latest from your Sheet on open
if ('serviceWorker' in navigator) {
  // If a service worker already controls this page, auto-reload once when a new
  // version takes over — so app updates appear immediately, no manual refresh.
  if (navigator.serviceWorker.controller) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return; refreshing = true; location.reload();
    });
  }
  navigator.serviceWorker.register('sw.js').then(reg => reg.update && reg.update()).catch(() => {});
}
