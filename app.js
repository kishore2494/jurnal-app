/* ============================================================
   Daylog — local-first life tracker (PWA)
   Data lives in localStorage; optionally syncs to a Google Sheet.
   ============================================================ */

'use strict';

const APP_VERSION = 'v146';   // shown in More ▸ About so you can confirm the build on each device

/* Corruption-proof localStorage reads: one interrupted write (force-kill mid-save is a
   real Android failure mode) must degrade to defaults, never white-screen the boot. */
function safeParse(raw, fb) { if (raw == null) return fb; try { const v = JSON.parse(raw); return v == null ? fb : v; } catch (e) { return fb; } }

/* ---------- Config: your habits (from the Daylog form) ----------
   DEFAULT_HABITS is only the starting point — the Customize screen
   (More ▸ Customize) saves your own list to dp.habitcfg, and HABITS
   is rebuilt from it (hidden ones excluded) via reloadCfg(). */
// A lean, universal starter set — new users see just these 4 and add their own
// (or pick more during onboarding). Everything is editable in More ▸ Customize.
const DEFAULT_HABITS = [
  { key: 'workout',     emoji: '💪', label: 'Workout' },
  { key: 'meditation',  emoji: '🧘', label: 'Meditation' },
  { key: 'reading',     emoji: '📖', label: 'Reading' },
  { key: 'healthyFood', emoji: '🥗', label: 'Healthy food', color: '#fb923c' },
];
function habitCfg() { const p = safeParse(localStorage.getItem('dp.habitcfg'), null); return Array.isArray(p) ? p : DEFAULT_HABITS.map(h => Object.assign({}, h)); }
function saveHabitCfg(cfg) { localStorage.setItem('dp.habitcfg', JSON.stringify(cfg)); reloadCfg(); pushState(); }
let HABITS = habitCfg().filter(h => !h.hidden);
function reloadCfg() {
  HABITS = habitCfg().filter(h => !h.hidden);
  _goalMap = null;                                  // goal cache follows the cfg
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
function deepCfg() { const v = safeParse(localStorage.getItem('dp.deepcfg'), null); return Array.isArray(v) ? v : JSON.parse(JSON.stringify(DEFAULT_DEEP_SECTIONS)); }
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
  { key: 'sleepHours',    label: 'Sleep',                            type: 'num', step: 0.5, req: true, bedwake: true },
  { key: 'deepWorkHours', label: 'Deep work',                        type: 'num', step: 0.5, req: true, dur: true },
  { key: 'tasksDone',     label: 'Tasks done',                       type: 'num' },
  { key: 'tasksPlanned',  label: 'Tasks planned',                    type: 'num' },
  { key: 'wentWell',      label: 'One thing that went well ✨',      type: 'text' },
  { key: 'improve',       label: 'One thing to improve tomorrow 🎯', type: 'text' },
  { key: 'journal',       label: 'Journal entry',                    type: 'journal' },
];
function coreCfg() {
  const v0 = safeParse(localStorage.getItem('dp.corecfg'), null);
  const cfg = Array.isArray(v0) ? v0 : DEFAULT_CORE_FIELDS.map(f => Object.assign({}, f));
  DEFAULT_CORE_FIELDS.forEach(d => { if (!cfg.find(f => f.key === d.key)) cfg.push(Object.assign({}, d)); });
  // Backfill flags added in later versions onto older stored configs.
  cfg.forEach(f => { if (f.key === 'journal') f.label = (f.label || '').replace(/\s*📓\s*/g, '').trim() || 'Journal entry';
    const d = DEFAULT_CORE_FIELDS.find(x => x.key === f.key); if (d) {
    if (d.step && !f.step) f.step = d.step;
    if (d.bedwake) { f.bedwake = true; f.time = false; if (f.label === 'Sleep hrs') f.label = 'Sleep'; }
    if (d.dur) { f.dur = true; f.time = false; if (f.label === 'Deep work hrs') f.label = 'Deep work'; }
  } });
  return cfg;
}
// Duration between a bed time and a wake time (HH:MM strings), in decimal hours, cross-midnight aware.
function bedwakeHours(bed, wake) {
  const p = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const b = p(bed), w = p(wake); if (b == null || w == null) return '';
  let mins = w - b; if (mins <= 0) mins += 1440;   // wake next morning
  return +(mins / 60).toFixed(2);
}
// Decimal hours ⇄ HH:MM for the clock picker. 7.5 ⇄ "07:30".
function hoursToHM(v) { if (v === '' || v == null || isNaN(v)) return ''; const t = Math.max(0, Math.round(+v * 60)); const h = Math.floor(t / 60), m = t % 60; return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
function hmToHours(s) { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); if (!m) return ''; return +(+m[1] + (+m[2]) / 60).toFixed(2); }
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


/* ---------- Crash safety net ----------
   A public app must never dead-end on a blank screen. Any uncaught error shows a
   recovery sheet (retry / export backup / report) instead of nothing. Errors are
   only ever stored locally; nothing is auto-sent. */
let _crashShown = false;
function reportCrash(msg, src) {
  try {
    const log = safeParse(localStorage.getItem('dp.errlog'), []);
    log.unshift({ t: new Date().toISOString(), m: String(msg || '').slice(0, 300), s: String(src || '').slice(0, 120), v: APP_VERSION });
    localStorage.setItem('dp.errlog', JSON.stringify(log.slice(0, 10)));
  } catch (_) {}
  if (_crashShown) return; _crashShown = true;
  try {
    const el = document.createElement('div');
    el.className = 'copy-modal on'; el.id = 'crash-sheet';
    el.innerHTML = '<div class="copy-box confirm-box">' +
      '<h2>Something went wrong</h2>' +
      '<p class="hint">Your data is safe on this phone. Reload to continue — or export a backup first, just in case.</p>' +
      '<div class="copy-actions" style="justify-content:center">' +
      '<button class="btn btn-primary btn-sm" id="crash-reload">Reload app</button>' +
      '<button class="btn btn-ghost btn-sm" id="crash-backup">Export backup</button>' +
      '<button class="btn btn-ghost btn-sm" id="crash-report">Report</button>' +
      '</div></div>';
    document.body.appendChild(el);
  } catch (_) {}
}
window.addEventListener('error', (e) => { if (e && e.message) reportCrash(e.message, e.filename + ':' + e.lineno); });
window.addEventListener('unhandledrejection', (e) => { reportCrash('promise: ' + (e && e.reason), 'async'); });
document.addEventListener('click', (ev) => {
  if (!ev.target.closest) return;
  if (ev.target.closest('#crash-reload')) { location.reload(); return; }
  if (ev.target.closest('#crash-backup')) { try { exportData(); } catch (_) {} return; }
  if (ev.target.closest('#crash-report')) {
    const log = safeParse(localStorage.getItem('dp.errlog'), []);
    const body = encodeURIComponent('What I was doing:\n\n\n--- technical details ---\n' + JSON.stringify(log.slice(0, 3), null, 1));
    location.href = 'mailto:' + FEEDBACK_EMAIL + '?subject=' + encodeURIComponent('Daylog crash (' + APP_VERSION + ')') + '&body=' + body;
    return;
  }
});

/* ---------- Storage-quota safety ----------
   localStorage can throw QuotaExceeded on long-term users (years of entries +
   images in notes). Writes go through this so a full disk warns the user instead
   of silently losing the save. */
function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch (e) {
    try {
      const now = Date.now();
      if (now - (+localStorage.getItem('dp.quotaWarn') || 0) > 3600000) {
        localStorage.setItem('dp.quotaWarn', String(now));
        toast('Phone storage is full — export a backup and free up space', true);
      }
    } catch (_) {}
    return false;
  }
}

/* ---------- Storage ---------- */
const DB = {
  entries() { return safeParse(localStorage.getItem('dp.entries'), {}); },
  saveEntries(e) { safeSet('dp.entries', JSON.stringify(e)); pushState(); },
  entry(date) { return this.entries()[date] || null; },
  putEntry(date, data) { const e = this.entries(); e[date] = data; this.saveEntries(e); },

  tasks() { return safeParse(localStorage.getItem('dp.tasks'), []); },
  saveTasks(t) { safeSet('dp.tasks', JSON.stringify(t)); pushState(); },

  exercises() { const v = safeParse(localStorage.getItem('dp.exercises'), null); return Array.isArray(v) ? v : DEFAULT_EXERCISES.slice(); },
  saveExercises(x) { localStorage.setItem('dp.exercises', JSON.stringify(x)); pushState(); },
  gym() { return safeParse(localStorage.getItem('dp.gym'), {}); },
  saveGym(g) { safeSet('dp.gym', JSON.stringify(g)); pushState(); },
  gymDay(date) { return this.gym()[date] || { done: {}, log: {} }; },
  putGymDay(date, d) { const g = this.gym(); g[date] = d; this.saveGym(g); },

  reminders() { return safeParse(localStorage.getItem('dp.reminders'), []); },
  saveReminders(r) { localStorage.setItem('dp.reminders', JSON.stringify(r)); pushState(); },

  notes() { return safeParse(localStorage.getItem('dp.notes'), []); },
  saveNotes(n) { safeSet('dp.notes', JSON.stringify(n)); pushState(); },

  plans() { return safeParse(localStorage.getItem('dp.plans'), []); },
  savePlans(p) { safeSet('dp.plans', JSON.stringify(p)); pushState(); },

  docs() { return safeParse(localStorage.getItem('dp.docs'), []); },
  saveDocs(d) { safeSet('dp.docs', JSON.stringify(d)); pushState(); syncDocs(); },

  events() { return safeParse(localStorage.getItem('dp.events'), []); },
  saveEvents(x) { localStorage.setItem('dp.events', JSON.stringify(x)); pushState(); syncEvents(); },

  pomo() { return safeParse(localStorage.getItem('dp.pomo'), null); },
  savePomo(p) { localStorage.setItem('dp.pomo', JSON.stringify(p)); pushState(); },
  timebox() { return safeParse(localStorage.getItem('dp.timebox'), []); },
  saveTimebox(t) { localStorage.setItem('dp.timebox', JSON.stringify(t)); pushState(); },

  timelog() { return safeParse(localStorage.getItem('dp.timelog'), []); },
  saveTimelog(t) { safeSet('dp.timelog', JSON.stringify(t)); pushState(); syncTimelog(); },
  timeacts() { return safeParse(localStorage.getItem('dp.timeacts'), []); },   // custom activities
  saveTimeacts(a) { localStorage.setItem('dp.timeacts', JSON.stringify(a)); pushState(); },

  settings() { return Object.assign({ syncUrl: '', reminderTime: '', name: '' }, safeParse(localStorage.getItem('dp.settings'), {})); },
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
let _recog = null, _recogOn = false, _recogBtn = null, _userStopped = false, _natSR = false;
const DICT_LANG = 'en-IN';
function speechPlugin() { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition) || null; }
// sel = a CSS selector for the input/textarea to dictate into.
// MANUAL toggle: tap 🎤 to start recording, tap again to stop. No auto-restart, so no
// repeated mic "ding" and no unpredictable cut-in/cut-out. `continuous = true` keeps it
// listening through pauses on capable browsers; if the OS ends it during a long silence
// (common on phones), the mic just turns off and you tap once to continue.
function stopDictation() {
  _userStopped = true;
  if (_natSR) { const sp = speechPlugin(); try { sp && sp.stop && sp.stop(); sp && sp.removeAllListeners && sp.removeAllListeners(); } catch (_) {}
    _recogOn = false; _natSR = false; if (_recogBtn) _recogBtn.classList.remove('rec'); }
  else { try { _recog && _recog.stop(); } catch (_) {} }
}
async function dictateInto(sel, btn) {
  const ta = document.querySelector(sel); if (!ta) return;
  if (_recogOn) { stopDictation(); return; }   // tap again = stop
  // 1) Native speech plugin (works INSIDE the installed app — the WebView has no Web Speech API)
  const sp = speechPlugin();
  if (sp) { return dictateNative(sp, ta, btn, sel); }
  // 2) Web Speech API (browser / installed PWA)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Voice typing needs the latest app update — or open Daylog in Chrome', true); return; }
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); }
    catch (err) {
      toast(err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
        ? 'Enable microphone in Settings › Apps › Daylog › Permissions' : 'Microphone unavailable', true);
      btn.classList.remove('rec'); return;
    }
  }
  const startText = ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '';
  _userStopped = false; _recogOn = true; _recogBtn = btn; _natSR = false; btn.classList.add('rec');
  _recog = new SR(); _recog.lang = DICT_LANG; _recog.continuous = true; _recog.interimResults = true;
  const liveTa = () => document.querySelector(sel) || ta;   // survive re-renders mid-dictation
  _recog.onresult = (ev) => {   // rebuild from start each event so interim words show live, finals stick
    let all = ''; for (let i = 0; i < ev.results.length; i++) all += ev.results[i][0].transcript + (ev.results[i].isFinal ? ' ' : '');
    const el = liveTa(); el.value = startText + all; el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  _recog.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Allow microphone in Settings › Apps › Daylog › Permissions', true); };
  _recog.onend = () => { _recogOn = false; if (_recogBtn) _recogBtn.classList.remove('rec'); _recog = null; if (!_userStopped) toast('Mic paused — tap 🎤 to continue'); };
  try { _recog.start(); toast('🎙️ Listening — tap 🎤 to stop'); }
  catch (e) { _recogOn = false; btn.classList.remove('rec'); _recog = null; }
}
// Native speech-to-text via @capacitor-community/speech-recognition (added in a rebuild).
async function dictateNative(sp, ta, btn, sel) {
  try {
    if (sp.available) { const a = await sp.available(); if (a && a.available === false) { toast('Speech recognition not available on this device', true); return; } }
    if (sp.requestPermissions) { try { await sp.requestPermissions(); } catch (_) {} }
    else if (sp.requestPermission) { try { await sp.requestPermission(); } catch (_) {} }
    const startText = ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '';
    _userStopped = false; _recogOn = true; _recogBtn = btn; _natSR = true; btn.classList.add('rec');
    if (sp.removeAllListeners) { try { await sp.removeAllListeners(); } catch (_) {} }
    // Re-query by selector on every partial — a re-render mid-dictation detaches the
    // original node (writes there are lost and the input event no longer bubbles).
    const liveTa = () => (sel && document.querySelector(sel)) || ta;
    if (sp.addListener) sp.addListener('partialResults', (d) => {
      const m = d && d.matches && d.matches[0];
      if (m) { const el = liveTa(); el.value = startText + m; el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await sp.start({ language: DICT_LANG, partialResults: true, popup: false });
    // user tapped stop while start() was still resolving → shut the mic down for real
    if (_userStopped) { try { sp.stop && sp.stop(); sp.removeAllListeners && sp.removeAllListeners(); } catch (_) {}
      _recogOn = false; _natSR = false; btn.classList.remove('rec'); return; }
    toast('🎙️ Listening — tap 🎤 to stop');
  } catch (e) { _recogOn = false; _natSR = false; btn.classList.remove('rec'); toast("Couldn't start voice typing", true); }
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
/* Habits are THREE-state, not two (borrowed from Loop/HabitNow — a rest day should
   not read as a failure). Stored value: true = done, 0 = skipped, false/absent = missed.
   `0` is deliberately FALSY so every older truthy check still means "not done". */
const H_DONE = 'done', H_SKIP = 'skip', H_MISS = 'miss';
/* Quantity habits: a habit may carry goal {n, cmp:'atleast'|'atmost', unit}. Its day
   value is then a NUMBER (the count), and done/miss comes from the comparison.
   The goal map is cached — hVal runs inside per-day loops. */
let _goalMap = null;
function goalFor(key) {
  if (!_goalMap) { _goalMap = {}; habitCfg().forEach(h => { if (h.goal && h.goal.n != null) _goalMap[h.key] = h.goal; }); }
  return _goalMap[key] || null;
}
function hVal(entry, key) {
  if (!entry || !entry.habits || !(key in entry.habits)) return H_MISS;
  const v = entry.habits[key];
  const g = goalFor(key);
  if (g) {                                   // count semantics: 0 here means "zero logged", NOT skip
    const n = typeof v === 'number' ? v : (v === true ? g.n : 0);
    if (g.cmp === 'atmost') return n <= g.n ? H_DONE : H_MISS;
    return n >= g.n ? H_DONE : H_MISS;
  }
  if (v === 0) return H_SKIP;
  return v ? H_DONE : H_MISS;
}
/* Partial credit for the strength score (Loop's model): 2 of 3 glasses feeds 0.67
   into the EMA instead of a flat fail. Booleans stay 0/1. */
function hFrac(entry, key) {
  const g = goalFor(key);
  if (g && entry && entry.habits && (key in entry.habits)) {
    const v = entry.habits[key];
    const n = typeof v === 'number' ? v : (v === true ? g.n : 0);
    if (g.cmp === 'atmost') return n <= g.n ? 1 : 0;
    return Math.min(1, n / Math.max(1, g.n));
  }
  return hVal(entry, key) === H_DONE ? 1 : 0;
}
function habitStreak(key) {
  const e = DB.entries(); let n = 0; let cur = todayStr();
  // today may be unlogged without breaking the run
  if (hVal(e[cur], key) !== H_DONE) cur = addDays(cur, -1);
  for (;;) {
    const v = hVal(e[cur], key);
    if (v === H_DONE) { n++; cur = addDays(cur, -1); continue; }
    if (v === H_SKIP) { cur = addDays(cur, -1); continue; }   // skips are streak-neutral
    break;
  }
  return n;
}
/* Habit strength 0-100: exponential moving average with a 13-day half-life for a daily
   habit (Loop Habit Tracker's model). One perfect day can't max it and one miss can't
   zero it — it measures the trend, not the last tick. Skipped days are passed over. */
function habitStrength(key) {
  const e = DB.entries(); const dates = Object.keys(e).sort();
  if (!dates.length) return 0;
  const mult = Math.pow(0.5, 1 / 13);
  let s = 0, cur = dates[0], end = todayStr(), guard = 0;
  while (cur <= end && guard++ < 4000) {
    const v = hVal(e[cur], key);
    if (v !== H_SKIP) s = s * mult + hFrac(e[cur], key) * (1 - mult);
    cur = addDays(cur, 1);
  }
  return Math.round(s * 100);
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

/* ---------- PIS (Personal Intelligence System) direct push ---------- */
function pisUrl() {
  return (DB.settings().pisUrl || 'http://127.0.0.1:5001').replace(/\/+$/, '');
}

async function pisCheck() {
  const st = document.getElementById('pis-status');
  const res = document.getElementById('pis-result');
  if (st) st.textContent = 'checking…';
  try {
    const r = await fetch(pisUrl() + '/api/integrations/daily-pulse/status', { mode: 'cors' });
    if (!r.ok) throw new Error('PIS replied ' + r.status);
    const d = await r.json();
    if (st) st.textContent = 'connected ✓';
    if (res) res.innerHTML = d && d.app ? '<span style="color:var(--green,#4ade80)">✓ ' + escapeHtml(d.app) +
      ' is running — ' + d.days_in_pis + ' day(s), ' + d.habits_in_pis + ' habit(s) already inside.' +
      (d.last_import_at ? '<br>Last import: ' + escapeHtml(d.last_import_at.replace('T', ' ').slice(0, 16)) : '') + '</span>' : '';
    toast('PIS connected ✅');
  } catch (e) {
    if (st) st.textContent = 'offline';
    if (res) res.innerHTML = '<span style="color:var(--red,#f87171)">✗ ' + escapeHtml(e.message || e) +
      '<br>Is the PIS server running on this computer? (cd PIS && ./start_pis.sh)</span>';
    toast('Could not reach PIS', true);
  }
}

async function pisPush() {
  const res = document.getElementById('pis-result');
  if (res) res.textContent = 'Pushing to PIS…';
  try {
    const blob = backupBlob();
    const r = await fetch(pisUrl() + '/api/integrations/daily-pulse/import', {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup: blob })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ('PIS replied ' + r.status));
    const st = document.getElementById('pis-status');
    if (st) st.textContent = 'connected ✓';
    if (res) res.innerHTML = '<span style="color:var(--green,#4ade80)">✓ Imported ' +
      (d.days || 0) + ' day(s) into PIS — ' + (d.habits_synced || 0) + ' habit log(s)' +
      (d.habits_created ? ', ' + d.habits_created + ' new habit(s)' : '') +
      (d.skipped && d.skipped.length ? ', ' + d.skipped.length + ' skipped' : '') +
      '.</span>';
    toast('Pushed to PIS 🧠');
  } catch (e) {
    if (res) res.innerHTML = '<span style="color:var(--red,#f87171)">✗ ' + escapeHtml(e.message || e) + '</span>';
    toast('Push failed', true);
  }
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
      corecfg: coreCfg(), daycfg: gymDays(), gymgroups: gymGroups(), navcfg: navCfg(),
      pomo: DB.pomo(), timebox: DB.timebox() };
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

  // Entries: FIELD-LEVEL merge by date. Newest updatedAt wins for shared fields,
  // but fields present on only one side are always kept — so a machine-generated
  // partial write (timeSummary, gym workoutsDone) on a stale device can NEVER
  // clobber another device's journal/mood/habits for that day. habits merge deeply.
  if (remote.entries) {
    const local = DB.entries();
    Object.keys(remote.entries).forEach(d => {
      const r = remote.entries[d], l = local[d];
      if (!l) { local[d] = r; changed = true; return; }
      const rNewer = (r.updatedAt || '') >= (l.updatedAt || '');
      const older = rNewer ? l : r, newer = rNewer ? r : l;
      const merged = Object.assign({}, older, newer);          // newer wins shared keys; older fills any gaps
      merged.habits = Object.assign({}, older.habits || {}, newer.habits || {});   // never drop a tick from either side
      if (JSON.stringify(merged) !== JSON.stringify(l)) { local[d] = merged; changed = true; }
    });
    safeSet('dp.entries', JSON.stringify(local));
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
    safeSet('dp.gym', JSON.stringify(local));
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
    // Guard: two devices can each have an open (end==null) segment. Keep only the
    // latest as running; close the earlier ones at the next segment's start so time
    // isn't double-counted forever.
    const open = merged.filter(s => s.end == null);
    if (open.length > 1) {
      open.sort((a, b) => a.start - b.start);
      for (let i = 0; i < open.length - 1; i++) { open[i].end = open[i + 1].start > open[i].start ? open[i + 1].start : open[i].start; open[i].upd = Date.now(); }
      changed = true;
    }
    safeSet('dp.timelog', JSON.stringify(merged));
  }
  // Tasks / Notes / Reminders / Exercises are LISTS that get completed, edited, reordered, deleted —
  // a union-of-ids would never propagate those. So when the other device changed more recently,
  // adopt its whole list (so done/edit/reorder/delete all sync). Local-newer keeps local.
  if (remoteNewer) {
    [['tasks', 'dp.tasks'], ['notes', 'dp.notes'], ['plans', 'dp.plans'], ['reminders', 'dp.reminders'], ['exercises', 'dp.exercises'], ['timeacts', 'dp.timeacts'], ['events', 'dp.events'], ['docs', 'dp.docs'], ['habitcfg', 'dp.habitcfg'], ['actcfg', 'dp.actcfg'], ['deepcfg', 'dp.deepcfg'], ['gymcfg', 'dp.gymcfg'], ['corecfg', 'dp.corecfg'], ['daycfg', 'dp.daycfg'], ['gymgroups', 'dp.gymgroups'], ['navcfg', 'dp.navcfg'], ['timebox', 'dp.timebox']].forEach(([key, store]) => {
      if (!remote[key]) return;
      if (JSON.stringify(remote[key]) !== (localStorage.getItem(store) || 'null')) {
        localStorage.setItem(store, JSON.stringify(remote[key])); changed = true;
      }
    });
    // Pomodoro: adopt remote SETTINGS + higher done-count, but NEVER the live `run`
    // countdown (that's device-local — a timer must not "run" on two phones).
    if (remote.pomo && remote.pomo.cfg) {
      const lp = DB.pomo() || { cfg: {}, run: null, done: { d: todayStr(), n: 0 } };
      const merged = { cfg: remote.pomo.cfg, run: lp.run, done: lp.done };
      if (remote.pomo.done && remote.pomo.done.d === todayStr() && (!lp.done || lp.done.d !== todayStr() || (remote.pomo.done.n || 0) > (lp.done.n || 0))) merged.done = remote.pomo.done;
      if (JSON.stringify(merged) !== JSON.stringify(lp)) { localStorage.setItem('dp.pomo', JSON.stringify(merged)); changed = true; }
    }
  }

  if (changed) {
    localStorage.setItem('dp.touched', String(Date.now()));
    reloadCfg();                // custom habits/activities may have changed
    renderNav(); applyTheme();
    pushState(true);            // push the merged superset back so all devices converge
    refreshStreak(); setupReminders();
    // Re-render the VISIBLE screen. (The nav's active button can be the synthetic
    // Menu '__menu' for unpinned screens — show('__menu') would blank the app.)
    const curScr = ((document.querySelector('.screen.on') || {}).id || '').replace('s-', '');
    if (curScr && RENDER[curScr]) show(curScr);
    toast('Synced from your other device ⬇️');
  }
}

/* ============================================================
   SCREEN: TODAY / LOG
   ============================================================ */
let logDate = todayStr();
let draft = {};

/* One source of truth: if you tracked Sleep/Work on the Time tab, the Log's
   sleep & deep-work fields fill themselves from it (manual entry still wins —
   a "tracked" chip lets you adopt the tracked value with one tap). */
let trackedInfo = { sleep: null, work: null };
function trackedHours(date, actId) {
  // ENDED segments only — a still-running timer would freeze a partial mid-day value
  // into the entry on the next autosave (e.g. deep-work stuck at 0.5h of an eventual 6h).
  const ms = segsForDay(date).filter(x => x.seg.act === actId && x.seg.end != null).reduce((s, x) => s + (x.b - x.a), 0);
  return ms >= 60000 ? +(ms / 3600000).toFixed(2) : null;   // ignore sub-minute noise
}
// Sleep is special: "last night's sleep" = the FULL sleep segments that END on this date
// (a 23:00→07:00 night counts 8h toward the morning you woke up — no midnight clipping).
function trackedSleepHours(date) {
  const d0 = new Date(date + 'T00:00:00').getTime(), d1 = d0 + 86400000;
  const ms = DB.timelog()
    .filter(s => s.act === 'sleep' && s.end != null && s.end >= d0 && s.end < d1)
    .reduce((sum, s) => sum + Math.min(s.end - s.start, 16 * 3600000), 0);   // cap a segment at 16h (bad edits)
  return ms >= 60000 ? +(ms / 3600000).toFixed(2) : null;
}
function fmtH(v) { return v == null ? '' : Math.floor(v) + 'h ' + Math.round((v - Math.floor(v)) * 60) + 'm'; }
function loadDraft() {
  const existing = DB.entry(logDate);
  draft = existing ? JSON.parse(JSON.stringify(existing)) : { habits: {} };
  if (!draft.habits) draft.habits = {};
  trackedInfo = { sleep: trackedSleepHours(logDate), work: trackedHours(logDate, 'work') };
  if ((draft.sleepHours == null || draft.sleepHours === '') && trackedInfo.sleep) draft.sleepHours = trackedInfo.sleep;
  if ((draft.deepWorkHours == null || draft.deepWorkHours === '') && trackedInfo.work) draft.deepWorkHours = trackedInfo.work;
}
// chip shown under the field when the tracker has data: current value ≠ tracked → tap to adopt
function trackedChip(key, tracked) {
  if (tracked == null) return '';
  const cur = draft[key];
  const same = cur !== '' && cur != null && Math.abs(+cur - tracked) < 0.02;
  return same
    ? `<span class="tracked-chip on">${icon('clock', 12)} from your Time tracker</span>`
    : `<button type="button" class="tracked-chip" data-use-tracked="${key}" data-tracked-val="${tracked}">${icon('clock', 12)} tracked ${fmtH(tracked)} — tap to use</button>`;
}

function scaleField(key, label, required) {
  const v = draft[key];
  let btns = '';
  for (let i = 1; i <= 10; i++) btns += `<button type="button" class="${v===i?'on':''}" data-scale="${key}" data-val="${i}">${i}</button>`;
  return `<div class="field"><label>${escapeHtml(label)} ${required?'<span class="req">*</span>':''}</label>
    <div class="scale">${btns}</div>
    <div class="scale-labels"><span>low</span><span>high</span></div></div>`;
}
function numField(f) {
  return `<div class="field"><label>${escapeHtml(f.label)}</label>
    <input type="number" step="${f.step||1}" inputmode="decimal" data-num="${f.key}" value="${draft[f.key]??''}"></div>`;
}
// Sleep: pick bed time + wake time → duration (#log-1)
function bedwakeField(f) {
  const dur = draft[f.key]; const h = dur !== '' && dur != null ? Math.floor(dur) + 'h ' + Math.round((dur - Math.floor(dur)) * 60) + 'm' : '';
  return `<div class="field"><label>${escapeHtml(f.label)} ${f.req ? '<span class="req">*</span>' : ''} <span class="hint">bed → wake</span></label>
    <div class="bedwake">
      <span class="bw-cell ${draft.bedTime ? '' : 'bw-empty'}"><span class="bw-lab">Bed</span><input type="time" data-bed="${f.key}" value="${draft.bedTime || ''}"></span>
      <span class="bw-arrow">→</span>
      <span class="bw-cell ${draft.wakeTime ? '' : 'bw-empty'}"><span class="bw-lab">Wake</span><input type="time" data-wake="${f.key}" value="${draft.wakeTime || ''}"></span>
      <span class="bw-dur" data-bw-dur="${f.key}">${h || '—'}</span>
    </div>${f.key === 'sleepHours' ? trackedChip('sleepHours', trackedInfo.sleep) : ''}</div>`;
}
// Deep work (or any duration field): hours + minutes selectors → decimal hours (#log-2)
function durationField(f) {
  const dur = draft[f.key]; const H = dur !== '' && dur != null ? Math.floor(dur) : ''; const M = dur !== '' && dur != null ? Math.round((dur - Math.floor(dur)) * 60) : '';
  const hopts = Array.from({ length: 17 }, (_, i) => `<option value="${i}" ${H === i ? 'selected' : ''}>${i} h</option>`).join('');
  const mopts = [0, 15, 30, 45].map(m => `<option value="${m}" ${M === m ? 'selected' : ''}>${m} m</option>`).join('');
  return `<div class="field"><label>${escapeHtml(f.label)} ${f.req ? '<span class="req">*</span>' : ''} <span class="hint">duration</span></label>
    <div class="dur-pick">
      <select data-dur-h="${f.key}"><option value="">–</option>${hopts}</select>
      <select data-dur-m="${f.key}">${mopts}</select>
    </div>${f.key === 'deepWorkHours' ? trackedChip('deepWorkHours', trackedInfo.work) : ''}</div>`;
}
function txtField(f) {
  return `<div class="field"><label>${escapeHtml(f.label)}</label>
    <textarea data-txt="${f.key}" placeholder="optional">${escapeHtml(draft[f.key]||'')}</textarea></div>`;
}
function checksField(f) {
  const sel = draft[f.key] || {};
  const chips = f.options.map(o => `<div class="habit ${sel[o]?'on':''}" data-check="${f.key}" data-opt="${escapeHtml(o)}">
    <span class="check">✓</span><span>${escapeHtml(o)}</span></div>`).join('');
  return `<div class="field"><label>${escapeHtml(f.label)}</label><div class="habits">${chips}</div></div>`;
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
      <h2 data-toggle-section="${sec.id}" class="h2-icon">${hicon(SECTION_ICON[sec.id] || 'layers')}<span>${escapeHtml(stripLeadEmoji(sec.title))}</span><span class="chev">▾</span></h2>
      <div class="body">${body}</div></div>`;
  }).join('');
}

/* ---------- "What's new" — one dismissible card per release wave ----------
   Testers get silent web updates; this makes improvements visible so they keep
   giving feedback. Bump WHATS_NEW.v to re-show with new items. */
const WHATS_NEW = {
  v: 'w13',
  items: [
    '🔔 <b>Pick your own alarm sound</b> — Customize ▸ Alarm sound. Choose any alarm tone on your phone (or your own audio file), preview it, and turn vibration on or off. Needs the Play Store update.',
    '🧠 <b>PIS sync</b> — Daylog now talks to your <b>Personal Intelligence System</b> directly. Settings ▸ PIS sync ▸ “Push my days to PIS” sends every logged day (mood, energy, focus, sleep, deep work, habits, journal) to PIS on this computer in one tap — no files, no sheet.',
    '😴 <b>Sleep &amp; deep work reach your PIS Trends</b> — the sleep hours and deep-work hours you log now show up as a dedicated chart in PIS ▸ Trends.',
    '⏰ <b>Alarms fixed properly — please update in the Play Store</b> — reminders now ring even while your phone is asleep, and they make a sound even when Android blocks the full-screen alarm. Daylog also asks once for the “Alarms &amp; reminders” permission so your reminder lands on the exact minute.',
    '👀 <b>Readability fixes</b> — the Snooze button on the alarm screen was invisible in light mode, and streak numbers, counters and totals were too faint. All fixed and checked against accessibility contrast standards.',
    '⏰ <b>Alarm fix — please update in the Play Store</b> — on Android 14+ Android blocks exact alarms by default, so some reminders never fired and nothing told you. Settings now shows a warning with a one-tap fix, alarms survive a restart, and they ring loudly even when the full-screen alarm is blocked.',
    '🔢 <b>Counted habits</b> — give any habit a daily goal like “8 glasses of water” or “at most 2 coffees”. The chip becomes a tap counter. Set goals in Customize ▸ Checklist habits (🎯).',
    '✨ <b>Habit ideas</b> — a browse-able gallery of starter habits on the Log (below your checklist), including cut-down goals.',
    '📝 <b>Journal templates</b> — Gratitude, Brain dump, Highlights and Idea buttons above the journal box.',
    '🎨 <b>Mood words now highlight</b> when picked — tap again to remove the tag.',
    '🎯 <b>Today ring</b> — one dial at the top of your Log that closes as you fill the day in. It buzzes when you complete it.',
    '🗓️ <b>Your year in pixels</b> — every day of the year as one coloured square, in Stats. Tap any pixel to open that day.',
    '🎨 <b>New: the mood grid</b> — one square sets your mood <i>and</i> your energy at once (pleasant or unpleasant, high or low energy). Then pick the word that fits — tapping it tags your entry so you can search it later.',
    '⤳ <b>Skip a day without losing your streak</b> — tap a habit twice to mark it skipped. Rest days and sick days no longer count as failures.',
    '💪 <b>Habit strength score</b> — a 0-100 trend on each habit (Habits screen). One miss can\'t zero it; one good day can\'t max it.',
    '🕰️ <b>“On this day”</b> — your entry from a week, a month or a year ago, right at the top of your Log. Tap to open it.',
    '🔮 <b>Next-day mood effects</b> — Stats now shows how a habit today changes your mood <i>tomorrow</i>, with a confidence rating.',
    '🌗 <b>Theme follows your phone</b> — new Auto mode (Settings ▸ Theme), and light mode no longer looks washed out on MIUI/Xiaomi.',
    '🎓 <b>Guided tour</b> — a 60-second walkthrough of everything (Settings ▸ Take the app tour)',
    '🧠 <b>Your patterns</b> — Stats now discovers YOUR sleep sweet spot, which habit actually lifts your mood, your peak focus hours & more',
    '🕸️ <b>Explore your Connections graph</b> — drag to pan, pinch to zoom',
    '🧭 <b>Pin any tabs you want</b> to the bottom bar — ☰ Menu ▸ Edit tabs',
    '🎙️ <b>Voice typing works in the app</b> — update Daylog in the Play Store, then tap Speak',
    '🎉 <b>Streak rewards</b> — full-screen celebration at 3, 5, 7, 10, 14… day streaks',
    '🔗 <b>Connected insights</b> in Stats — how sleep drives your mood, week vs last week',
    '⏱ <b>Time tracker fills your Log</b> — tracked Sleep/Work auto-fill the fields',
    '🧭 <b>Choose your bottom tabs</b> — Settings ▸ Customize ▸ Tabs & navigation',
    '📄 <b>PDF report + backup export</b> now work inside the app',
  ],
};
function whatsNewHTML() { return ''; }   // replaced by the popup (showWhatsNewPopup)
function showWhatsNewPopup() {
  if (localStorage.getItem('dp.whatsnew') === WHATS_NEW.v) return;
  let m = document.getElementById('wn-pop');
  if (!m) { m = document.createElement('div'); m.id = 'wn-pop'; m.className = 'copy-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="copy-box">
    <h2 class="h2-icon">${hicon('sparkle')}<span>What's new in Daylog</span></h2>
    ${WHATS_NEW.items.map(i => `<div class="wn-item">${i}</div>`).join('')}
    <div class="copy-actions" style="justify-content:flex-end;margin-top:6px">
      <button class="btn btn-ghost btn-sm" id="wn-tour">🎓 Take the tour</button>
      <button class="btn btn-primary btn-sm" id="wn-ok">Got it ✓</button>
    </div></div>`;
  m.classList.add('on');
}
document.addEventListener('click', (ev) => {
  const done = () => { localStorage.setItem('dp.whatsnew', WHATS_NEW.v); const m = document.getElementById('wn-pop'); if (m) m.remove(); };
  if (ev.target.closest && ev.target.closest('#wn-ok')) { done(); return; }
  if (ev.target.closest && ev.target.closest('#wn-tour')) { done(); show('today'); startTour(); return; }
});
function openToday() { loadDraft(); renderToday(); }
/* ---------- Throwback ("On this day") ----------
   Journey paywalls this and Daylio ships it inline; it's the cheapest retention
   mechanic there is because it makes old entries pay rent. Purely local. */
function throwbackHTML() {
  if (logDate !== todayStr()) return '';                       // only on today
  if (logSecHidden('onthisday')) return '';
  const e = DB.entries();
  const marks = [
    { d: addDays(logDate, -7),   label: 'A week ago' },
    { d: addDays(logDate, -30),  label: 'A month ago' },
    { d: addDays(logDate, -90),  label: '3 months ago' },
    { d: addDays(logDate, -365), label: 'A year ago' },
  ];
  const hits = marks.filter(m => e[m.d]).slice(0, 2);
  if (!hits.length) return '';
  const rows = hits.map(m => {
    const en = e[m.d];
    const bits = [];
    if (en.mood != null) bits.push(`mood <b>${en.mood}</b>`);
    if (en.energy != null) bits.push(`energy <b>${en.energy}</b>`);
    if (en.sleepHours != null) bits.push(`<b>${en.sleepHours}h</b> sleep`);
    const doneN = en.habits ? Object.keys(en.habits).filter(k => en.habits[k] === true).length : 0;
    if (doneN) bits.push(`<b>${doneN}</b> habit${doneN > 1 ? 's' : ''}`);
    const jr = (en.journal || '').trim().replace(/\s+/g, ' ');
    const quote = jr ? `<div class="otd-quote">“${escapeHtml(jr.slice(0, 140))}${jr.length > 140 ? '…' : ''}”</div>` : '';
    return `<div class="otd-row" data-throwback="${m.d}">
      <div class="otd-when">${m.label}<span class="hint"> · ${prettyDate(m.d)}</span></div>
      ${bits.length ? `<div class="otd-stats">${bits.join(' · ')}</div>` : ''}
      ${quote}
    </div>`;
  }).join('');
  return `<div class="card otd-card">
    <h2 class="h2-icon">${hicon('history')}<span>On this day</span>
      <span class="hint" style="margin-left:auto"><a href="#" id="otd-hide">hide</a></span></h2>
    ${rows}
  </div>`;
}
document.addEventListener('click', (ev) => {
  if (ev.target && ev.target.id === 'otd-hide') { ev.preventDefault();
    setLogSecHidden('onthisday', true); toast('Hidden — Customize ▸ Log screen sections to bring it back'); renderToday(); return; }
  const tb = ev.target.closest && ev.target.closest('[data-throwback]');
  if (tb) { logDate = tb.dataset.throwback; loadDraft(); renderToday(); toast('Opened ' + prettyDate(logDate)); }
});

/* ---------- Mood Meter (How We Feel / RULER's model) ----------
   Their insight: people can't name what they feel, so don't ask them to invent a word —
   GIVE them one. Pleasantness x energy is exactly the mood/energy pair we already store,
   so one tap on the grid sets both, and the quadrant then offers precise vocabulary that
   lands in the journal as a #tag (searchable by our existing tag search). */
const MM_COLS = [2, 4, 7, 9];        // pleasantness -> mood 1-10
const MM_ROWS = [9, 7, 4, 2];        // energy, high at the top
const MM_QUAD = {
  red:    { label: 'High energy, unpleasant', c: '#e2574c',
    words: ['Angry','Anxious','Stressed','Frustrated','Restless','Overwhelmed','Irritated','Worried','Tense','Panicked'] },
  yellow: { label: 'High energy, pleasant',   c: '#e9b53a',
    words: ['Excited','Energised','Motivated','Happy','Proud','Confident','Cheerful','Inspired','Alive','Focused'] },
  blue:   { label: 'Low energy, unpleasant',  c: '#4a7fd0',
    words: ['Sad','Tired','Drained','Lonely','Bored','Discouraged','Flat','Numb','Disappointed','Hopeless'] },
  green:  { label: 'Low energy, pleasant',    c: '#3fa87a',
    words: ['Calm','Content','Relaxed','Grateful','Peaceful','Rested','Satisfied','Comfortable','Thoughtful','Safe'] },
};
function mmQuad(mood, energy) {
  const pleasant = mood >= 6, high = energy >= 6;
  return high ? (pleasant ? 'yellow' : 'red') : (pleasant ? 'green' : 'blue');
}
function moodMeterHTML() {
  if (logSecHidden('moodgrid')) return '';
  const active = coreCfg().filter(f => !f.hidden).map(f => f.key);
  if (!active.includes('mood') || !active.includes('energy')) return '';   // needs both axes
  const m = draft.mood, en = draft.energy;
  const cells = MM_ROWS.map(ry => MM_COLS.map(cx => {
    const q = MM_QUAD[mmQuad(cx, ry)];
    const on = m === cx && en === ry;
    return `<button type="button" class="mm-cell${on ? ' on' : ''}" data-mm="${cx},${ry}"
      style="background:${q.c}${on ? '' : '4d'}" aria-label="mood ${cx}, energy ${ry}"></button>`;
  }).join('')).join('');
  let words = '', head = 'Tap the square that fits how you feel';
  if (m != null && en != null) {
    const key = mmQuad(m, en), q = MM_QUAD[key];
    head = `<b style="color:${q.c}">${q.label}</b> · mood ${m}, energy ${en}`;
    const jl = (draft.journal || '').toLowerCase();
    words = `<div class="mm-words">${q.words.map(w => { const sel = jl.includes('#' + w.toLowerCase());
      return `<button type="button" class="mm-word ${sel ? 'on' : ''}" data-mmword="${w}"
        style="${sel ? `background:${q.c};border-color:${q.c};color:#fff` : `border-color:${q.c}66`}">${w}</button>`; }).join('')}</div>
      <div class="hint mm-hint">Tap a word to tag today's entry — tap again to remove</div>`;
  }
  return `<div class="card mm-card">
    <h2 class="h2-icon">${hicon('smile')}<span>How do you feel?</span>
      <span class="hint" style="margin-left:auto"><a href="#" id="mm-hide">hide</a></span></h2>
    <div class="mm-wrap">
      <div class="mm-yaxis"><span>high<br>energy</span><span>low<br>energy</span></div>
      <div class="mm-grid">${cells}</div>
    </div>
    <div class="mm-xaxis"><span>unpleasant</span><span>pleasant</span></div>
    <div class="mm-head">${head}</div>
    ${words}
  </div>`;
}
document.addEventListener('click', (ev) => {
  if (ev.target && ev.target.id === 'mm-hide') { ev.preventDefault();
    setLogSecHidden('moodgrid', true); toast('Hidden — Customize ▸ Log screen sections to bring it back'); renderToday(); return; }
  const cell = ev.target.closest && ev.target.closest('[data-mm]');
  if (cell) {
    const [mv, evv] = cell.dataset.mm.split(',').map(Number);
    draft.mood = mv; draft.energy = evv; autosaveDraft();
    // keep the 1-10 rows in sync without a full re-render losing scroll position
    document.querySelectorAll('[data-scale="mood"]').forEach(b => b.classList.toggle('on', +b.dataset.val === mv));
    document.querySelectorAll('[data-scale="energy"]').forEach(b => b.classList.toggle('on', +b.dataset.val === evv));
    const card = cell.closest('.mm-card');
    if (card) { const tmp = document.createElement('div'); tmp.innerHTML = moodMeterHTML();
      if (tmp.firstElementChild) card.replaceWith(tmp.firstElementChild); }
    return;
  }
  const wd = ev.target.closest && ev.target.closest('[data-mmword]');
  if (wd) {
    const tag = '#' + wd.dataset.mmword.toLowerCase();
    const ta = document.querySelector('[data-txt=journal]');
    const cur = (draft.journal || '');
    if (cur.toLowerCase().includes(tag)) {
      // toggle OFF: remove the tag (and the space before it) wherever it sits
      const re = new RegExp('\\s*' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
      draft.journal = cur.replace(re, '').replace(/^\s+/, '');
      toast('Removed ' + tag);
    } else {
      draft.journal = cur ? cur.replace(/\s*$/, '') + ' ' + tag : tag;
      buzz(12); toast('Tagged ' + tag);
    }
    if (ta) ta.value = draft.journal;
    autosaveDraft();
    // re-render the card so the word chip's highlight matches the journal
    const card = wd.closest('.mm-card');
    if (card) { const tmp = document.createElement('div'); tmp.innerHTML = moodMeterHTML();
      if (tmp.firstElementChild) card.replaceWith(tmp.firstElementChild); }
    return;
  }
});

/* ---------- Log screen sections: order + visibility ----------
   Every card on the Log is a named section the user can hide or reorder. This is the
   single source of truth — the `hide` links on the ring / On-this-day / mood grid write
   here too, so a section can never be hidden in one place and shown in another. */
const LOG_SECTIONS_DEF = [
  { id: 'ring',      label: 'Today ring',       sub: "how much of today you've logged" },
  { id: 'onthisday', label: 'On this day',      sub: 'your entry from a week / month / year ago' },
  { id: 'core',      label: 'Date & main fields', sub: 'mood, energy, sleep, deep work…', lock: true },
  { id: 'moodgrid',  label: 'Mood grid',        sub: 'set mood and energy with one tap' },
  { id: 'tasks',     label: 'Tasks',            sub: "today's task count + quick add" },
  { id: 'checklist', label: 'Daily checklist',  sub: 'your habits' },
  { id: 'workout',   label: 'Workout',          sub: "link to today's gym log" },
  { id: 'health',    label: 'Health',           sub: 'auto-tracked steps, sleep, screen time' },
  { id: 'reflection',label: 'Reflection',       sub: 'wins, improvements, journal' },
  { id: 'deep',      label: 'Deep log',         sub: 'the optional polymath metrics' },
  { id: 'weekly',    label: 'Sunday weekly review', sub: 'only appears on Sundays' },
];
function logSecCfg() {
  const saved = safeParse(localStorage.getItem('dp.logsec'), null);
  const byId = {};
  if (Array.isArray(saved)) saved.forEach(x => { if (x && x.id) byId[x.id] = x; });
  // start from the saved order, then append any section added in a later release
  const out = [];
  if (Array.isArray(saved)) saved.forEach(x => {
    const def = LOG_SECTIONS_DEF.find(d => d.id === (x || {}).id);
    if (def) out.push(Object.assign({}, def, { hidden: !!x.hidden }));
  });
  LOG_SECTIONS_DEF.forEach(d => { if (!out.some(o => o.id === d.id)) out.push(Object.assign({}, d, { hidden: false })); });
  return out;
}
function saveLogSec(list) {
  localStorage.setItem('dp.logsec', JSON.stringify(list.map(x => ({ id: x.id, hidden: !!x.hidden }))));
  pushState();
}
function logSecHidden(id) {
  const s = logSecCfg().find(x => x.id === id);
  return !!(s && s.hidden);
}
function setLogSecHidden(id, hidden) {
  const list = logSecCfg();
  const row = list.find(x => x.id === id); if (!row) return;
  if (row.lock && hidden) return;                       // the core fields card can't be hidden
  row.hidden = !!hidden; saveLogSec(list);
}
/* One-time migration: the first cut of these widgets used three separate dp.*Off flags. */
(function migrateLogSecFlags() {
  if (localStorage.getItem('dp.logsecMigrated') === '1') return;
  const map = { 'dp.ringOff': 'ring', 'dp.throwbackOff': 'onthisday', 'dp.moodMeterOff': 'moodgrid' };
  const list = logSecCfg(); let touched = false;
  Object.keys(map).forEach(k => {
    if (localStorage.getItem(k) === '1') {
      const row = list.find(x => x.id === map[k]); if (row) { row.hidden = true; touched = true; }
    }
    localStorage.removeItem(k);
  });
  if (touched) saveLogSec(list);
  localStorage.setItem('dp.logsecMigrated', '1');
})();

/* ============================================================
   REWARD WIDGETS
   Plain form fields get filled once; a widget that pays you back gets opened daily.
   Everything here is read-from-existing-data — no new storage, no migration.
   ============================================================ */

/* A short buzz on a rewarding action. Silently absent on iOS/desktop, and we never
   buzz for routine taps — only for a completion or a milestone. */
function buzz(ms) {
  if (localStorage.getItem('dp.hapticsOff') === '1') return;
  try { navigator.vibrate && navigator.vibrate(ms || 18); } catch (e) {}
}

/* ---------- Mood -> colour, one scale used by every reward widget ---------- */
const MOOD_SCALE = ['#ef5f5f', '#f0834a', '#f2b13c', '#c9c94a', '#8fce5b', '#4fc07d', '#33b78e'];
function moodColor(m) {
  if (m == null || m === '') return null;
  const i = Math.max(0, Math.min(MOOD_SCALE.length - 1, Math.round((m - 1) / 9 * (MOOD_SCALE.length - 1))));
  return MOOD_SCALE[i];
}

/* ---------- Today ring: how complete is today, as one dial ----------
   The point is the *closing* of the ring. Every tap visibly moves it, and the
   moment it completes you get a buzz and a colour flip. */
function todayCompletion(entry) {
  const en = entry || {};
  const parts = [];
  const core = coreCfg().filter(f => !f.hidden);
  core.forEach(f => { if (f.type === 'scale' || f.type === 'num' || f.type === 'bedwake')
    parts.push(en[f.key] != null && en[f.key] !== ''); });
  HABITS.forEach(h => parts.push(hVal(en, h.key) !== H_MISS));      // done OR skipped counts
  parts.push(!!(en.journal || en.win || en.improve));
  const done = parts.filter(Boolean).length;
  return { done, total: parts.length || 1, pct: Math.round(done / (parts.length || 1) * 100) };
}
function todayRingHTML() {
  if (logSecHidden('ring')) return '';
  const c = todayCompletion(draft);
  const R = 34, C = 2 * Math.PI * R;
  const off = C * (1 - c.pct / 100);
  const full = c.pct >= 100;
  const col = full ? 'var(--good)' : 'var(--accent)';
  const st = loggedStreak();
  return `<div class="card ring-card${full ? ' ring-full' : ''}">
    <svg class="ring" viewBox="0 0 80 80" aria-label="${c.pct}% of today logged">
      <circle cx="40" cy="40" r="${R}" class="ring-bg"/>
      <circle cx="40" cy="40" r="${R}" class="ring-fg" stroke="${col}"
        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      <text x="40" y="44" class="ring-txt">${c.pct}%</text>
    </svg>
    <div class="ring-side">
      <div class="ring-head">${full ? "Today's complete" : 'Today so far'}</div>
      <div class="hint">${c.done} of ${c.total} logged${full ? ' — nice.' : ''}</div>
      ${st > 1 ? `<div class="ring-streak">${icon('flame', 14)} ${st}-day logging streak</div>` : ''}
    </div>
  </div>`;
}
/* Re-draw the ring in place after any edit, so the dial visibly moves as you fill the form. */
let _ringWasFull = false;
function refreshTodayRing() {
  const card = document.querySelector('.ring-card'); if (!card) return;
  const tmp = document.createElement('div'); tmp.innerHTML = todayRingHTML();
  const next = tmp.firstElementChild; if (!next) return;
  card.replaceWith(next);
  const nowFull = next.classList.contains('ring-full');
  if (nowFull && !_ringWasFull) { buzz(28); toast('🎉 Today fully logged'); }
  _ringWasFull = nowFull;
}

/* ---------- Year in Pixels ----------
   Daylio's most-shared screen, and the reason is simple: a year of your life as one
   picture. 12 columns (months) x 31 rows (days), each pixel your mood that day. */
function yearPixelsHTML(year) {
  const e = DB.entries();
  const y = year || new Date().getFullYear();
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let logged = 0, sum = 0, rows = '';
  // 31 columns (days) x 12 rows (months) — reads like a calendar and stays compact.
  // The other way round (12 x 31) is 700px tall on a phone, which swamps the screen.
  for (let mon = 0; mon < 12; mon++) {
    let cells = '';
    for (let day = 1; day <= 31; day++) {
      const valid = new Date(y, mon, day).getMonth() === mon;
      if (!valid) { cells += '<i class="yp-x"></i>'; continue; }
      const ds = `${y}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const en = e[ds];
      const m = en && en.mood != null && en.mood !== '' ? +en.mood : null;
      if (m != null) { logged++; sum += m; }
      const col = moodColor(m);
      cells += `<i class="yp${m != null ? ' yp-on' : ''}" data-yp="${ds}"
        style="${col ? `background:${col}` : ''}" title="${ds}${m != null ? ' · mood ' + m : ''}"></i>`;
    }
    rows += `<div class="yp-row"><span class="yp-mon">${MON[mon]}</span><div class="yp-days">${cells}</div></div>`;
  }
  const avgM = logged ? (sum / logged).toFixed(1) : '–';
  // a mostly-empty mosaic is a bad first impression; wait until it has something to show
  if (logged < 10) {
    return `<div class="card yp-card">
      <h2 class="h2-icon">${hicon('calendar')}<span>${y} in pixels</span></h2>
      <div class="hint">Log ${10 - logged} more day${10 - logged === 1 ? '' : 's'} and your whole year appears here as one picture — every day a colour, from your mood.</div>
    </div>`;
  }
  return `<div class="card yp-card">
    <h2 class="h2-icon">${hicon('calendar')}<span>${y} in pixels</span>
      <span class="hint" style="margin-left:auto">${logged} days · avg ${avgM}</span></h2>
    <div class="yp-grid">${rows}</div>
    <div class="yp-legend"><span class="hint">low</span>
      ${MOOD_SCALE.map(c => `<i style="background:${c}"></i>`).join('')}
      <span class="hint">high</span></div>
  </div>`;
}
document.addEventListener('click', (ev) => {
  const p = ev.target.closest && ev.target.closest('[data-yp]');
  if (p) { const d = p.dataset.yp;
    if (!DB.entry(d)) { toast('Nothing logged on ' + prettyDate(d)); return; }
    // NOTE: navigateTo('today') force-resets logDate to today — use show() for deep links.
    logDate = d; loadDraft(); show('today'); buzz(12); toast('Opened ' + prettyDate(d)); }
});

/* One habit chip. Boolean habits: tap cycles done → skip → clear. Goal habits: the chip
   is a counter — tap +1, − to undo, and (for "at most") a "0" to log a clean zero. */
/* ---------- Habit ideas gallery ----------
   TickTick ships 60+ presets and Routinery ships category packs because the empty
   checklist is where new users stall. Curated, one tap to add, includes quantity and
   cut-down ("at most") presets so those features are discoverable. */
const HABIT_PRESETS = [
  { cat: 'Health', items: [
    { emoji: '💧', label: 'Water', goal: { n: 8, cmp: 'atleast', unit: 'glasses' } },
    { emoji: '🚶', label: 'Walk' },
    { emoji: '💪', label: 'Stretch' },
    { emoji: '🦷', label: 'Floss' },
    { emoji: '💊', label: 'Vitamins' },
    { emoji: '☀️', label: 'Morning sunlight' },
    { emoji: '😴', label: 'In bed by 11' },
  ]},
  { cat: 'Mind', items: [
    { emoji: '📖', label: 'Read', goal: { n: 20, cmp: 'atleast', unit: 'pages' } },
    { emoji: '🧠', label: 'Learn something new' },
    { emoji: '🎧', label: 'Podcast or audiobook' },
    { emoji: '🙏', label: 'Gratitude note' },
  ]},
  { cat: 'Productivity', items: [
    { emoji: '🛏️', label: 'Make the bed' },
    { emoji: '📵', label: 'No phone first hour' },
    { emoji: '🧹', label: 'Tidy 10 minutes' },
    { emoji: '💼', label: 'Deep work session', goal: { n: 2, cmp: 'atleast', unit: 'blocks' } },
  ]},
  { cat: 'Cut down', items: [
    { emoji: '☕', label: 'Coffee', goal: { n: 2, cmp: 'atmost', unit: 'cups' } },
    { emoji: '🍬', label: 'Sweets', goal: { n: 1, cmp: 'atmost', unit: 'treats' } },
    { emoji: '🍺', label: 'Alcohol', goal: { n: 0, cmp: 'atmost', unit: 'drinks' } },
    { emoji: '🚬', label: 'Cigarettes', goal: { n: 0, cmp: 'atmost', unit: '' } },
    { emoji: '🛒', label: 'Impulse buys', goal: { n: 0, cmp: 'atmost', unit: '' } },
  ]},
];
/* Goal editor for a checklist habit: turn it into a counted habit (at least / at most
   N per day) or back into a simple tick. */
function showGoalEditor(key) {
  const h = habitCfg().find(x => x.key === key); if (!h) return;
  const g = h.goal || { n: 8, cmp: 'atleast', unit: '' };
  let m = document.getElementById('goal-editor');
  if (!m) { m = document.createElement('div'); m.id = 'goal-editor'; m.className = 'copy-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="copy-box">
    <h2 class="h2-icon">${hicon('target')}<span>Daily goal — ${escapeHtml(h.label)}</span></h2>
    <div class="ge-row">
      <select id="ge-cmp">
        <option value="atleast" ${g.cmp !== 'atmost' ? 'selected' : ''}>At least</option>
        <option value="atmost" ${g.cmp === 'atmost' ? 'selected' : ''}>At most</option>
      </select>
      <input type="number" id="ge-n" inputmode="numeric" min="0" max="999" value="${g.n}">
      <input type="text" id="ge-unit" placeholder="unit (glasses…)" maxlength="14" value="${escapeHtml(g.unit || '')}">
    </div>
    <div class="hint" style="margin:8px 0 12px">“At least” turns the habit into a tap counter (done at the target). “At most” is for cutting down — done while you stay at or under it.</div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" id="ge-save" style="flex:1">Save goal</button>
      ${h.goal ? '<button class="btn btn-ghost" id="ge-remove">Remove</button>' : ''}
      <button class="btn btn-ghost" id="ge-cancel">Cancel</button>
    </div>
  </div>`;
  m.style.display = 'flex';
  m.dataset.key = key;
}
document.addEventListener('click', (ev) => {
  const gb = ev.target.closest && ev.target.closest('[data-cfg-goal]');
  if (gb) { showGoalEditor(gb.dataset.cfgGoal); return; }
  const m = document.getElementById('goal-editor');
  if (!m || m.style.display === 'none') return;
  if (ev.target.id === 'ge-cancel' || ev.target === m) { m.style.display = 'none'; return; }
  if (ev.target.id === 'ge-save') {
    const cfg = habitCfg(); const h = cfg.find(x => x.key === m.dataset.key); if (!h) return;
    const n = Math.max(0, Math.min(999, parseInt(document.getElementById('ge-n').value, 10) || 0));
    h.goal = { n, cmp: document.getElementById('ge-cmp').value === 'atmost' ? 'atmost' : 'atleast',
               unit: (document.getElementById('ge-unit').value || '').trim() };
    saveHabitCfg(cfg); m.style.display = 'none'; renderCustom(); toast('Goal saved 🎯'); return;
  }
  if (ev.target.id === 'ge-remove') {
    const cfg = habitCfg(); const h = cfg.find(x => x.key === m.dataset.key); if (!h) return;
    delete h.goal; saveHabitCfg(cfg); m.style.display = 'none'; renderCustom(); toast('Back to a simple tick'); return;
  }
});

function showHabitGallery() {
  let m = document.getElementById('habit-gallery');
  if (!m) { m = document.createElement('div'); m.id = 'habit-gallery'; m.className = 'copy-modal'; document.body.appendChild(m); }
  const have = new Set(habitCfg().map(h => (h.label || '').toLowerCase()));
  const goalTxt = g => g ? ` <span class="hg-goal">${g.cmp === 'atmost' ? '≤' : ''}${g.n}${g.unit ? ' ' + escapeHtml(g.unit) : ''}${g.cmp === 'atmost' ? '' : '/day'}</span>` : '';
  m.innerHTML = `<div class="copy-box hg-box">
    <h2 class="h2-icon">${hicon('flame')}<span>Habit ideas</span></h2>
    <div class="hg-scroll">
    ${HABIT_PRESETS.map(sec => `<div class="hg-cat">${escapeHtml(sec.cat)}</div>
      ${sec.items.map(it => { const got = have.has(it.label.toLowerCase());
        return `<div class="hg-row">
          <span class="hg-emoji">${it.emoji}</span>
          <span class="hg-lbl">${escapeHtml(it.label)}${goalTxt(it.goal)}</span>
          <button class="btn btn-sm ${got ? 'btn-ghost' : 'btn-primary'}" data-hg-add="${escapeHtml(it.label)}" ${got ? 'disabled' : ''}>${got ? '✓ added' : 'Add'}</button>
        </div>`; }).join('')}`).join('')}
    </div>
    <div class="hint" style="margin:8px 0 4px">Counted habits show a tap counter on your Log — “at most” ones are for cutting down.</div>
    <button class="btn btn-ghost" id="hg-close" style="width:100%">Close</button>
  </div>`;
  m.style.display = 'flex';
}
document.addEventListener('click', (ev) => {
  if (ev.target && (ev.target.id === 'hg-close' || (ev.target.id === 'habit-gallery' && ev.target.classList.contains('copy-modal')))) {
    const m = document.getElementById('habit-gallery'); if (m) m.style.display = 'none';
    renderToday(); return;
  }
  if (ev.target && ev.target.id === 'log-habit-ideas') { showHabitGallery(); return; }
  const ha = ev.target.closest && ev.target.closest('[data-hg-add]');
  if (ha && !ha.disabled) {
    const label = ha.dataset.hgAdd;
    const preset = HABIT_PRESETS.flatMap(x => x.items).find(i => i.label === label); if (!preset) return;
    const cfg = habitCfg();
    const item = { key: 'ch' + Date.now(), emoji: preset.emoji, label: preset.label, custom: true };
    if (preset.goal) item.goal = Object.assign({}, preset.goal);
    cfg.push(item); saveHabitCfg(cfg);
    buzz(14); ha.textContent = '✓ added'; ha.disabled = true; ha.classList.remove('btn-primary'); ha.classList.add('btn-ghost');
    return;
  }
});

/* Writing templates — Daylio sells these as premium; a prompt beats a blank box. */
const JOURNAL_TEMPLATES = {
  gratitude:  "Grateful for:\n1. \n2. \n3. ",
  braindump:  "On my mind right now:\n- ",
  highlights: "Best moment today: \nHardest moment: \nTomorrow I'm looking forward to: ",
  idea:       "Idea: \nWhy it matters: \nFirst step: ",
};
document.addEventListener('click', (ev) => {
  const jt = ev.target.closest && ev.target.closest('[data-jt]');
  if (!jt) return;
  const tpl = JOURNAL_TEMPLATES[jt.dataset.jt]; if (!tpl) return;
  const ta = document.querySelector('[data-txt=journal]'); if (!ta) return;
  const cur = (draft.journal || '').replace(/\s+$/, '');
  draft.journal = cur ? cur + '\n\n' + tpl : tpl;
  ta.value = draft.journal;
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  autosaveDraft();
});

function habitChipHTML(h) {
  const g = goalFor(h.key);
  const state = hVal(draft, h.key);
  const on = state === H_DONE, sk = state === H_SKIP;
  const st = habitStreak(h.key);
  const style = h.color ? `box-shadow: inset 4px 0 0 ${h.color}${on ? `; background:${h.color}1f; border-color:${h.color}` : ''}` : '';
  const hi = HABIT_ICON[h.key];
  if (g) {
    const raw = draft.habits ? draft.habits[h.key] : undefined;
    const logged = raw != null;
    const n = typeof raw === 'number' ? raw : (raw === true ? g.n : 0);
    const over = g.cmp === 'atmost' && logged && n > g.n;
    const prog = `${logged ? n : '–'}/${g.cmp === 'atmost' ? '≤' : ''}${g.n}${g.unit ? ' ' + escapeHtml(g.unit) : ''}`;
    return `<div class="habit qty ${on?'on':''}${over?' over':''}" data-habit="${h.key}" style="${style}" title="Tap to add 1">
      <span class="check">${over ? '!' : '✓'}</span><span class="emoji">${hi ? icon(hi, 17) : escapeHtml(h.emoji)}</span>
      <span class="hlbl">${escapeHtml(h.label)}</span>
      <span class="qty-prog">${prog}</span>
      ${logged && n > 0 ? `<button type="button" class="qty-btn" data-habit-dec="${h.key}" aria-label="minus 1">−</button>` : ''}
      ${!logged && g.cmp === 'atmost' ? `<button type="button" class="qty-btn qty-zero" data-habit-zero="${h.key}" title="none today">0</button>` : ''}
    </div>`;
  }
  // NOTE: no "skipped" text label — at 2-up on a 320px screen it overflowed the chip.
  // The ⤳ glyph, the dashed border and the greyscale already communicate it, and the
  // tap toast spells it out. Title attribute carries it for anyone unsure.
  return `<div class="habit ${on?'on':''}${sk?' skip':''}" data-habit="${h.key}" style="${style}" title="${sk?'Skipped — your streak is safe':'Tap: done → skip → clear'}">
    <span class="check">${sk?'⤳':'✓'}</span><span class="emoji">${hi ? icon(hi, 17) : escapeHtml(h.emoji)}</span>
    <span class="hlbl">${escapeHtml(h.label)}</span>${sk?'':(st>1?`<span class="streak">${icon('flame',13)}${st}</span>`:'')}</div>`;
}
function refreshHabitChip(key) {
  const el = document.querySelector(`[data-habit="${key}"]`); if (!el) return;
  const h = HABITS.find(x => x.key === key); if (!h) return;
  const tmp = document.createElement('div'); tmp.innerHTML = habitChipHTML(h);
  el.replaceWith(tmp.firstElementChild);
}

function renderToday() {
  const isToday = logDate === todayStr();
  document.getElementById('screen-title').textContent = isToday ? 'Today' : prettyDate(logDate);
  document.getElementById('screen-sub').textContent = isToday ? prettyDate(logDate) + ' · Daylog' : 'Editing past entry';

  const habitChips = HABITS.map(h => habitChipHTML(h)).join('');

  // Core fields come from the user's config (Customize ▸ Log screen fields)
  const core = coreCfg().filter(f => !f.hidden);
  const coreScales = core.filter(f => f.type === 'scale').map(f => scaleField(f.key, f.label, f.req)).join('');
  // Task counts are auto-derived from the Tasks list (read-only), never manual number inputs.
  const TASK_KEYS = ['tasksDone', 'tasksPlanned'];
  const coreNums = core.filter(f => f.type === 'num' && !TASK_KEYS.includes(f.key));
  const tc = taskCounts(logDate);
  draft.tasksDone = tc.done; draft.tasksPlanned = tc.planned;   // feed Stats/Polymath
  const numCell = f => {
    if (!f) return '<div></div>';
    if (f.bedwake) return bedwakeField(f);
    if (f.dur) return durationField(f);
    return `<div class="field"><label>${escapeHtml(f.label)} ${f.req ? '<span class="req">*</span>' : ''}</label>
      ${f.time
        ? `<input type="time" class="time-pick" data-numtime="${f.key}" value="${hoursToHM(draft[f.key])}"><span class="time-hint">${draft[f.key] !== '' && draft[f.key] != null ? draft[f.key] + ' h' : 'hh : mm'}</span>`
        : `<input type="number" ${f.step ? `step="${f.step}"` : ''} inputmode="${f.step ? 'decimal' : 'numeric'}" data-num="${f.key}" value="${draft[f.key] ?? ''}">`}</div>`;
  };
  // Wide pickers (sleep bed→wake, deep-work duration) get their own full-width row; simple numbers pair up 2-per-row.
  const wideNums = coreNums.filter(f => f.bedwake || f.dur);
  const simpleNums = coreNums.filter(f => !f.bedwake && !f.dur);
  let numRows = wideNums.map(f => `<div class="row-wide">${numCell(f)}</div>`).join('');
  for (let i = 0; i < simpleNums.length; i += 2) numRows += `<div class="row2">${numCell(simpleNums[i])}${numCell(simpleNums[i + 1])}</div>`;
  const reflect = core.filter(f => f.type === 'text').map(f => `<div class="field"><label>${escapeHtml(f.label)}</label>
      <textarea data-txt="${f.key}" placeholder="...">${escapeHtml(draft[f.key] || '')}</textarea></div>`).join('');
  const journalF = core.find(f => f.type === 'journal');
  const journalHtml = journalF ? `<div class="field"><label>${escapeHtml(journalF.label)} <span class="hint">type or speak · use #tags to link</span></label>
      <div class="jt-row">
        <button type="button" class="jt-chip" data-jt="gratitude">🙏 Gratitude</button>
        <button type="button" class="jt-chip" data-jt="braindump">🌙 Brain dump</button>
        <button type="button" class="jt-chip" data-jt="highlights">⭐ Highlights</button>
        <button type="button" class="jt-chip" data-jt="idea">💡 Idea</button>
      </div>
      <textarea data-txt="journal" placeholder="How was your day?" style="min-height:110px">${escapeHtml(draft.journal || '')}</textarea>
      <button type="button" class="mic-btn" data-mic="[data-txt=journal]">🎤 Speak</button></div>` : '';

  // Each Log card is a named section; the user controls order and visibility
  // (Customize ▸ Log screen sections). Build them as a map, then emit in their order.
  const SEC = {
    ring: () => todayRingHTML(),
    onthisday: () => throwbackHTML(),
    core: () => `<div class="card">
      <div class="field"><label>Date</label>
        <input type="date" id="log-date" value="${logDate}" max="${todayStr()}"></div>
      ${coreScales}
      ${numRows}
    </div>`,
    moodgrid: () => moodMeterHTML(),
    tasks: () => `<div class="card">
      <h2 class="h2-icon">${hicon('check')}<span>Tasks</span> <span class="hint">${tc.planned ? tc.done + ' of ' + tc.planned + ' done' : 'auto from your Tasks list'}</span></h2>
      ${tc.planned
        ? `<div class="task-summary"><div class="ts-cell"><div class="ts-n">${tc.done}</div><div class="ts-l">done</div></div><div class="ts-cell"><div class="ts-n">${tc.planned}</div><div class="ts-l">planned</div></div></div>`
        : '<div class="hint" style="padding:4px 0 8px">No tasks yet — add one below or on the Tasks tab.</div>'}
      <div class="task-add">
        <input type="text" id="log-task-input" placeholder="Add a task…" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="log-task-add">Add</button>
      </div>
    </div>`,
    checklist: () => `<div class="card">
      <h2>Daily checklist <span class="hint">tap what you did</span></h2>
      <div class="habits">${habitChips}</div>
      <div class="task-add" style="margin-top:10px">
        <input type="text" id="log-habit-input" placeholder="New checklist item… (e.g. 🌅 Wake at 6)" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="log-habit-add">Add</button>
      </div>
      <button class="btn btn-ghost btn-sm" id="log-habit-ideas" style="margin-top:8px">✨ Browse habit ideas</button>
    </div>`,
    workout: () => `<div class="card">
      <h2 class="h2-icon">${hicon('dumbbell')}<span>Workout</span> <span class="hint">${(() => { const wd = (DB.entry(logDate) || {}).workoutsDone; return wd ? wd + ' exercise' + (wd > 1 ? 's' : '') + ' logged' : 'not logged yet'; })()}</span></h2>
      <button class="btn btn-primary btn-sm" id="log-open-gym">Log / edit today's workout →</button>
    </div>`,
    health: () => (logDate === todayStr() ? healthCardHTML() : ''),
    reflection: () => ((reflect || journalHtml) ? `<div class="card">
      <h2>Reflection</h2>
      ${reflect}
      ${journalHtml}
    </div>` : ''),
    deep: () => `<h2 style="margin:22px 4px 10px;font-size:13px;color:var(--text-dim);font-weight:600;letter-spacing:.3px;text-transform:uppercase">Deep log <span class="hint" style="text-transform:none">optional · the polymath metrics</span></h2>
      ${renderDeepSections()}`,
    weekly: () => (isSunday(logDate) ? `<div class="card"><h2>📅 Sunday weekly review</h2>
      <div class="field"><label>Wins this week</label><textarea data-txt="weekWins" placeholder="...">${escapeHtml(draft.weekWins||'')}</textarea></div>
      <div class="field"><label>Focus for next week</label><textarea data-txt="weekFocus" placeholder="...">${escapeHtml(draft.weekFocus||'')}</textarea></div></div>` : ''),
  };
  const secHTML = logSecCfg()
    .filter(sec => !sec.hidden && SEC[sec.id])
    .map(sec => SEC[sec.id]())
    .join('\n');

  document.getElementById('s-today').innerHTML = `
    ${whatsNewHTML()}
    ${secHTML}

    <div class="log-footer">
      <div class="autosave-hint">✓ Saves automatically as you go <span id="autosave-dot" class="autosave-dot"></span></div>
      <button class="btn btn-ghost" id="save-entry">Done</button>
    </div>
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
  // Surgical updates (no full re-render) so the Log screen never flickers or jumps on a tap.
  const sc = ev.target.closest('[data-scale]');
  if (sc) { const key = sc.dataset.scale; draft[key] = +sc.dataset.val;
    sc.parentNode.querySelectorAll(`[data-scale="${key}"]`).forEach(b => b.classList.toggle('on', b === sc));
    if (key === 'mood' || key === 'energy') {           // mirror into the mood grid
      const card = document.querySelector('.mm-card');
      if (card) { const tmp = document.createElement('div'); tmp.innerHTML = moodMeterHTML();
        if (tmp.firstElementChild) card.replaceWith(tmp.firstElementChild); }
    }
    autosaveDraft(); return; }
  const ck = ev.target.closest('[data-check]');
  if (ck) { const k = ck.dataset.check, o = ck.dataset.opt; draft[k] = draft[k] || {}; draft[k][o] = !draft[k][o];
    ck.classList.toggle('on', !!draft[k][o]); autosaveDraft(); return; }
  const hdec = ev.target.closest('[data-habit-dec]');
  if (hdec && document.getElementById('s-today').classList.contains('on')) {
    const k = hdec.dataset.habitDec, g = goalFor(k);
    const cur = typeof draft.habits[k] === 'number' ? draft.habits[k] : (draft.habits[k] === true && g ? g.n : 0);
    const next = cur - 1;
    if (next <= 0 && g && g.cmp !== 'atmost') delete draft.habits[k]; else draft.habits[k] = Math.max(0, next);
    refreshHabitChip(k); autosaveDraft(); return; }
  const hz = ev.target.closest('[data-habit-zero]');
  if (hz && document.getElementById('s-today').classList.contains('on')) {
    const k = hz.dataset.habitZero;
    draft.habits[k] = 0;                          // a clean zero — counts as done for "at most"
    buzz(18); refreshHabitChip(k); autosaveDraft(); return; }
  const hb = ev.target.closest('[data-habit]');
  if (hb && document.getElementById('s-today').classList.contains('on')) {
    const k = hb.dataset.habit;
    const g = goalFor(k);
    if (g) {                                       // counter: every tap is +1
      const was = hVal(draft, k);
      const cur = typeof draft.habits[k] === 'number' ? draft.habits[k] : (draft.habits[k] === true ? g.n : 0);
      draft.habits[k] = (k in draft.habits ? cur : 0) + 1;
      const now = hVal(draft, k);
      if (was !== H_DONE && now === H_DONE) buzz(24);
      refreshHabitChip(k); autosaveDraft(); return;
    }
    // cycle: (nothing) -> done -> skipped -> (nothing).  Skipped keeps the streak alive.
    const was = hVal(draft, k);
    if (was === H_DONE) { draft.habits[k] = 0; buzz(12); toast('Skipped — your streak is safe'); }
    else if (was === H_SKIP) { delete draft.habits[k]; }
    else { draft.habits[k] = true; buzz(18); }
    const now = hVal(draft, k), on = now === H_DONE, sk = now === H_SKIP;
    hb.classList.toggle('on', on); hb.classList.toggle('skip', sk);
    const ckEl = hb.querySelector('.check'); if (ckEl) ckEl.textContent = sk ? '⤳' : '✓';
    const h = HABITS.find(x => x.key === k);
    if (h && h.color) hb.setAttribute('style', `box-shadow: inset 4px 0 0 ${h.color}${on ? `; background:${h.color}1f; border-color:${h.color}` : ''}`);
    autosaveDraft(); return; }
});
document.addEventListener('input', (ev) => {
  const nt = ev.target.closest('[data-numtime]'); if (nt) { draft[nt.dataset.numtime] = hmToHours(nt.value); const hint = nt.parentNode.querySelector('.time-hint'); if (hint) hint.textContent = nt.value ? draft[nt.dataset.numtime] + ' h' : 'hh : mm'; autosaveDraft(); return; }
  const n = ev.target.closest('[data-num]'); if (n) { draft[n.dataset.num] = n.value === '' ? '' : +n.value; autosaveDraft(); return; }
  const t = ev.target.closest('[data-txt]'); if (t) { draft[t.dataset.txt] = t.value; autosaveDraft(); return; }
});
/* Auto-save the Log draft as you go (debounced) — no need to hit Save. */
let _autosaveTimer;
function autosaveDraft() {
  try { refreshTodayRing(); } catch (e) {}
  clearTimeout(_autosaveTimer);
  // Capture the target date + draft object NOW. loadDraft() reassigns the `draft`/`logDate`
  // globals when you switch day or tab, and the deep-clone means this reference stays intact —
  // so a pending save always lands on the entry it was actually editing (no cross-day loss).
  const targetDate = logDate, targetDraft = draft;
  _autosaveTimer = setTimeout(() => { _autosaveTimer = null; saveDraftNow(targetDate, targetDraft); }, 700);
}
/* ---------- Streak milestone celebrations ----------
   Hitting 3/5/7/10/14/21/30/50/75/100/150/200/365 logged days in a row pops a
   full-screen confetti reward — once per milestone per streak run. */
const MILESTONES = [3, 5, 7, 10, 14, 21, 30, 50, 75, 100, 150, 200, 365];
function checkStreakMilestone() {
  const st = loggedStreak();
  if (!MILESTONES.includes(st)) return;
  const runStart = addDays(todayStr(), -(st - 1));            // identifies THIS streak run
  const key = st + ':' + runStart;
  let shown; try { shown = safeParse(localStorage.getItem('dp.milestones'), {}); } catch (e) { shown = {}; }
  if (shown[key]) return;
  shown[key] = 1; localStorage.setItem('dp.milestones', JSON.stringify(shown));
  showMilestone(st);
}
function showMilestone(n) {
  let m = document.getElementById('milestone');
  if (!m) { m = document.createElement('div'); m.id = 'milestone'; m.className = 'milestone'; document.body.appendChild(m); }
  const confetti = Array.from({ length: 44 }, (_, i) =>
    `<span class="mf" style="left:${(i * 137) % 100}%;background:${['#6d8cff','#4ad6c0','#fbbf24','#f87171','#a78bfa','#34d399'][i % 6]};animation-delay:${(i % 11) * .14}s;animation-duration:${2.2 + (i % 5) * .35}s"></span>`).join('');
  const msg = n >= 100 ? 'Legendary. This is who you are now.' : n >= 30 ? 'A full month of showing up. Unreal.' :
              n >= 21 ? 'Three weeks in — officially unstoppable.' :
              n >= 14 ? 'Two weeks strong — this is a habit now.' : n >= 7 ? 'A whole week, every single day!' : 'Momentum! Keep the chain alive.';
  m.innerHTML = `<div class="mf-wrap">${confetti}</div>
    <div class="ms-inner">
      <div class="ms-fire">🔥</div>
      <div class="ms-num">${n}</div>
      <div class="ms-title">day streak!</div>
      <div class="ms-msg">${msg}</div>
      <button class="btn btn-primary" id="ms-close">Keep going →</button>
    </div>`;
  m.classList.add('on');
  if (navigator.vibrate) navigator.vibrate([80, 60, 80, 60, 160]);
}
document.addEventListener('click', (ev) => {
  if (ev.target.id === 'ms-close' || (ev.target.id === 'milestone')) { const m = document.getElementById('milestone'); if (m) m.classList.remove('on'); }
});
function saveDraftNow(date, d) {
  d.updatedAt = new Date().toISOString();
  d.tasks = tasksForDate(date);
  // Preserve fields owned by other flows (Gym writes workoutsDone/workoutDetail, Time writes
  // timeSummary) so a Log autosave can't blindly clobber them with a stale snapshot.
  const existing = DB.entry(date) || {};
  ['workoutsDone', 'workoutDetail', 'timeSummary'].forEach(k => { if (existing[k] !== undefined) d[k] = existing[k]; });
  DB.putEntry(date, d);
  refreshStreak();
  if (date === todayStr()) checkStreakMilestone();   // full-screen reward at 3/5/7/10/14… days
  pushWidgetData();                                  // keep the (future native) home-screen widget fresh
  scheduleInactivityReminder();
  syncEntry(date, d);
  const dot = document.getElementById('autosave-dot'); if (dot) { dot.textContent = 'Saved ✓'; dot.classList.add('show'); setTimeout(() => dot.classList.remove('show'), 1400); }
}
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'log-date') {
    // Android's date dialog has a Clear button → value=''. An empty/invalid date would
    // store an entry keyed '' and permanently crash Stats — reject and restore instead.
    const v = ev.target.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { ev.target.value = logDate; return; }
    logDate = v; openToday();
  }
  if (ev.target.id === 'dash-range') { dashRange = +ev.target.value; renderDash(); }   // Stats range dropdown (#stats)
});
// Sleep bed/wake → duration, and deep-work hours+minutes → decimal (#log-1, #log-2)
document.addEventListener('change', (ev) => {
  const bw = ev.target.closest('[data-bed], [data-wake]');
  if (bw) {
    const key = bw.dataset.bed || bw.dataset.wake;
    if (bw.dataset.bed !== undefined && bw.hasAttribute('data-bed')) draft.bedTime = bw.value; else draft.wakeTime = bw.value;
    const cell = bw.closest('.bw-cell'); if (cell) cell.classList.toggle('bw-empty', !bw.value);
    draft[key] = bedwakeHours(draft.bedTime, draft.wakeTime);
    const disp = document.querySelector(`[data-bw-dur="${key}"]`);
    if (disp) { const d = draft[key]; disp.textContent = (d !== '' && d != null) ? (Math.floor(d) + 'h ' + Math.round((d - Math.floor(d)) * 60) + 'm') : '—'; }
    autosaveDraft(); return;
  }
  const dur = ev.target.closest('[data-dur-h], [data-dur-m]');
  if (dur) {
    const key = dur.dataset.durH || dur.dataset.durM;
    const hs = document.querySelector(`[data-dur-h="${key}"]`), ms = document.querySelector(`[data-dur-m="${key}"]`);
    const m = ms ? +ms.value : 0;
    const h = hs && hs.value !== '' ? +hs.value : (m > 0 ? 0 : null);   // minutes-only picks count as 0h + m
    draft[key] = h == null ? '' : +(h + m / 60).toFixed(2);
    autosaveDraft(); return;
  }
});
document.addEventListener('click', async (ev) => {
  if (ev.target.id !== 'save-entry') return;
  clearTimeout(_autosaveTimer); _autosaveTimer = null;   // no stale debounced save left behind
  saveDraftNow(logDate, draft);   // same merge-safe path as autosave (preserves gym/time fields)
  toast('Saved 🎉');
  const synced = await syncEntry(logDate, draft);
  if (synced) toast('Saved & synced to Sheet 🎉');
});
// Quick-add straight from the Log screen (#log-4, #menu-1)
document.addEventListener('click', (ev) => {
  if (ev.target.id === 'log-task-add') {
    const inp = document.getElementById('log-task-input'); const text = (inp && inp.value || '').trim(); if (!text) return;
    const tasks = DB.tasks(); tasks.unshift({ id: 't' + Date.now(), text, done: false, created: todayStr(), color: '' });
    DB.saveTasks(tasks); renderToday();
    document.body.classList.remove('kbd-open');   // re-render removed the focused input → no focusout ever fires
    toast('Task added ✅'); return;
  }
  if (ev.target.id === 'log-habit-add') {
    const inp = document.getElementById('log-habit-input'); const raw = (inp && inp.value || '').trim(); if (!raw) return;
    const em = emojiSplit(raw); const cfg = habitCfg();
    cfg.push({ key: 'ch' + Date.now(), emoji: em.emoji, label: em.name, custom: true });
    saveHabitCfg(cfg); renderToday();
    document.body.classList.remove('kbd-open');
    toast('Checklist item added'); return;
  }
  if (ev.target.id === 'log-open-gym') { gymDate = logDate; navigateTo('gym'); return; }   // gym reachable from Log home (#menu-7)
  const ut = ev.target.closest('[data-use-tracked]');
  if (ut) { const k = ut.dataset.useTracked; draft[k] = +ut.dataset.trackedVal;
    if (k === 'sleepHours') { draft.bedTime = ''; draft.wakeTime = ''; }   // tracked value replaces manual bed/wake
    renderToday(); autosaveDraft(); toast('Using your tracked time ⏱'); return; }
  if (ev.target.id === 'health-sync') {
    if (hcPlugin()) syncHealth();
    else toast('Open the installed app → this will read Health Connect (sleep, steps, distance, calories)', true);
    return;
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  if (ev.target.id === 'log-task-input') { ev.preventDefault(); const b = document.getElementById('log-task-add'); if (b) b.click(); }
  if (ev.target.id === 'log-habit-input') { ev.preventDefault(); const b = document.getElementById('log-habit-add'); if (b) b.click(); }
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
// Auto counts for the Log screen — derived from the user's Tasks list, never typed by hand. (#log-3)
function taskCounts(d) {
  const ts = DB.tasks();
  const planned = ts.filter(t => (t.created || todayStr()) <= d && (!t.done || (t.doneDate && t.doneDate >= d))).length;
  const done = ts.filter(t => t.done && t.doneDate === d).length;
  return { planned, done };
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
function gymGroups() { return safeParse(localStorage.getItem('dp.gymgroups'), []); }
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
        <div class="day-name">${escapeHtml(d.name)} · ${escapeHtml(main.name)}</div>
        <div class="day-sub">🏃 Cardio · ${ab.emoji} ${escapeHtml(ab.name)}</div>
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
  if (tg) { const k = dkey(gymDayId, tg.dataset.exToggle); gymDraft.done[k] = !gymDraft.done[k]; persistGym(true); renderGym(); return; }
  const op = ev.target.closest('[data-ex-open]');
  if (op) { const k = dkey(gymDayId, op.dataset.exOpen); if (openExr.has(k)) openExr.delete(k); else openExr.add(k); renderGym(); return; }
  if (ev.target.id === 'gym-save') {
    const entry = persistGym(false);
    toast('Workout saved 💪');
    const synced = await syncEntry(gymDate, entry);
    if (synced) toast('Saved & synced 💪');
    return;
  }
});
// Save the gym day to storage + mirror the count/detail into the log entry. Returns the entry.
// date/draft default to the globals, but the debounced save passes captured values so a
// day-switch mid-debounce can't persist the typed note to the wrong day (or lose it).
function persistGym(silent, date, draft) {
  date = date || gymDate; draft = draft || gymDraft;
  DB.putGymDay(date, draft);
  const doneIds = Object.keys(draft.done).filter(k => draft.done[k]);
  const detail = doneIds.map(k => { const nm = exName(k.split('/').pop()); return nm + (draft.log[k] ? ` (${draft.log[k]})` : ''); }).join('; ');
  const entry = DB.entry(date) || { habits: {} };
  entry.workoutsDone = doneIds.length; entry.workoutDetail = detail;
  entry.updatedAt = new Date().toISOString();
  DB.putEntry(date, entry);
  if (silent) { const dot = document.getElementById('autosave-dot'); if (dot) { dot.textContent = 'Saved ✓'; dot.classList.add('show'); setTimeout(() => dot.classList.remove('show'), 1400); } }
  return entry;
}
let _gymSaveTimer;
document.addEventListener('input', (ev) => {
  const lg = ev.target.closest('[data-ex-log]');
  if (lg) { gymDraft.log[dkey(gymDayId, lg.dataset.exLog)] = lg.value;
    const capDate = gymDate, capDraft = gymDraft;   // capture NOW so a date-switch mid-debounce is safe
    clearTimeout(_gymSaveTimer); _gymSaveTimer = setTimeout(() => persistGym(true, capDate, capDraft), 700); }
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
function actCfg() { const v = safeParse(localStorage.getItem('dp.actcfg'), null); return Array.isArray(v) ? v : DEFAULT_TIME_ACTS.map(a => Object.assign({}, a)); }
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
    const a = toMs(sv); let b = toMs(ev2);
    if (sv === ev2) { toast('Start and end are the same', true); return; }
    if (b <= a) b += 86400000;   // end earlier than start → it crosses midnight (e.g. 23:00 → 07:00 sleep)
    const log = DB.timelog(); const now = Date.now();
    log.push({ id: 'ts' + now, act, start: a, end: b, upd: now });
    log.sort((x, y) => x.start - y.start);
    DB.saveTimelog(log); ttShowManual = false; renderTime(); toast('Block added ✅'); return;
  }
  if (ev.target.id === 'tt-newact-add') {
    const inp = document.getElementById('tt-newact'); const name = inp.value.trim(); if (!name) return;
    const acts = DB.timeacts();
    const em = emojiSplit(name); acts.push({ id: 'ta' + Date.now(), emoji: em.emoji, name: em.name, color: CUSTOM_ACT_COLORS[acts.length % CUSTOM_ACT_COLORS.length] });
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
    const hits = last30.filter(d => hVal(e[d], h.key) === H_DONE).length;
    const skipped = last30.filter(d => hVal(e[d], h.key) === H_SKIP).length;
    const denom = Math.max(1, 30 - skipped);          // skipped days don't count against you
    const pct = Math.round(hits / denom * 100);
    const str = habitStrength(h.key);
    const heat = days.map(d => {
      const v = hVal(e[d], h.key);
      const bg = v === H_DONE ? 'var(--good)' : v === H_SKIP ? '#a9b0c9' : 'var(--bg-input)';
      return `<div class="cell" title="${d}${v === H_SKIP ? ' · skipped' : v === H_DONE ? ' · done' : ''}" style="background:${bg}"></div>`;
    }).join('');
    return `<div class="card">
      <h2>${h.emoji} ${escapeHtml(h.label)}
        <span class="hint" style="float:right">🔥 ${st} day${st===1?'':'s'} · ${pct}% / 30d${skipped?` · ${skipped} skipped`:''}</span></h2>
      <div class="heat">${heat}</div>
      <div class="strength-row" title="Weighted 13-day trend — one miss won't zero it, one day won't max it">
        <span class="hint">Strength</span>
        <div class="strength-bar"><i style="width:${str}%"></i></div>
        <b>${str}</b>
      </div>
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
/* Daily bar chart — one bar per day. Easier to read at a glance than a line.
   values: [{x,y}] · opts.max forces a scale (e.g. 10 for 1-10 fields). */
function barChart(values, color, opts) {
  opts = opts || {};
  const w = 320, h = 118, pad = 8;
  const ys = values.map(v => v.y).filter(v => v != null);
  if (!ys.length) return '<div class="empty">No data yet</div>';
  const max = Math.max(opts.max || 0, ...ys) || 1;
  const n = values.length;
  const slot = (w - pad * 2) / n;
  const bw = Math.max(1.5, slot - Math.min(4, slot * 0.28));
  let bars = '';
  values.forEach((v, i) => {
    if (v.y == null) return;
    const bh = (v.y / max) * (h - pad * 2);
    const x = pad + i * slot + (slot - bw) / 2;
    bars += `<rect x="${x.toFixed(1)}" y="${(h - pad - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.5, bh).toFixed(1)}" rx="1.4" fill="${color}"/>`;
  });
  // date axis labels (first / middle / last) so the graph reads clearly
  const lab = i => { const x = values[i] && values[i].x; if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return ''; const d = new Date(x + 'T00:00:00'); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
  const mid = Math.floor((n - 1) / 2);
  const axis = n > 1 ? `<div class="chart-x"><span>${lab(0)}</span>${n > 6 ? `<span>${lab(mid)}</span>` : ''}<span>${lab(n - 1)}</span></div>` : '';
  return `<svg class="chart chart-bar" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${bars}</svg>${axis}`;
}
/* Pearson correlation over [x,y] pairs → -1..1, or null if degenerate (no variance). */
/* ---------- Pattern-mining helpers (pure, unit-tested) ---------- */
function dpMedian(a) { if (!a || !a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function dpStd(a) { if (!a || a.length < 2) return null; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1)); }
function dpSlope(ys) { const n = ys.length; if (n < 5) return null; const xm = (n - 1) / 2; const ym = ys.reduce((a, b) => a + b, 0) / n; let num = 0, den = 0; ys.forEach((y, i) => { num += (i - xm) * (y - ym); den += (i - xm) * (i - xm); }); return den ? num / den : null; }

/* ---------- "Your patterns" — real insights mined from the raw data.
   Every pattern has an honest minimum-sample guard; nothing is claimed
   from thin data. Runs 100% on-device. Returns [{ico, head, sub, w}]. ---------- */
function computePatterns() {
  const e = DB.entries(); const dates = Object.keys(e).sort();
  const out = [];
  const num = (d, k) => { const v = e[d] && e[d][k]; return v != null && v !== '' && !isNaN(+v) ? +v : null; };
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

  // 1 — YOUR optimal sleep window (mood by sleep bucket)
  const buckets = { 'under 6h': [], '6–7h': [], '7–8h': [], '8h+': [] };
  dates.forEach(d => { const s = num(d, 'sleepHours'), m = num(d, 'mood'); if (s == null || m == null) return;
    (s < 6 ? buckets['under 6h'] : s < 7 ? buckets['6–7h'] : s < 8 ? buckets['7–8h'] : buckets['8h+']).push(m); });
  const elig = Object.entries(buckets).filter(([, v]) => v.length >= 3).map(([k, v]) => ({ k, avg: avg(v), n: v.length }));
  if (elig.length >= 2) { elig.sort((a, b) => b.avg - a.avg); const best = elig[0], worst = elig[elig.length - 1];
    if (best.avg - worst.avg >= 0.7) out.push({ ico: 'moon', w: 5, head: `Your sleep sweet spot: ${best.k}`,
      sub: `Mood averages <b>${best.avg.toFixed(1)}</b> after ${best.k} nights vs <b>${worst.avg.toFixed(1)}</b> after ${worst.k} (${best.n}+${worst.n} nights compared).` }); }

  // 2 — which habit ACTUALLY moves your mood (biggest lift, both sides sampled)
  const lifts = [];
  HABITS.forEach(h => { const on = [], off = [];
    dates.forEach(d => { const m = num(d, 'mood'); if (m == null || !e[d].habits) return;
      const v = hVal(e[d], h.key); if (v === H_SKIP) return;          // a rest day is neither
      (v === H_DONE ? on : off).push(m); });
    if (on.length >= 3 && off.length >= 3) lifts.push({ h, lift: avg(on) - avg(off), n: on.length + off.length }); });
  lifts.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));

  // 2b — NEXT-DAY influence. Daylio's most-loved stat: "how it makes you feel tomorrow".
  // Same-day mood can be reverse-caused (good mood → you work out); the day after can't be.
  const nextDay = [];
  HABITS.forEach(h => { const after = [], other = [];
    dates.forEach(d => {
      const v = hVal(e[d], h.key); if (v === H_SKIP) return;
      const m = num(addDays(d, 1), 'mood'); if (m == null) return;   // tomorrow's mood
      (v === H_DONE ? after : other).push(m);
    });
    if (after.length >= 4 && other.length >= 4) {
      const n = after.length + other.length;
      // confidence from sample size AND effect size relative to spread
      const sd = dpStd(after.concat(other)) || 1;
      const d0 = Math.abs(avg(after) - avg(other)) / sd;
      const conf = (n >= 30 && d0 >= 0.5) ? 'High' : (n >= 14 && d0 >= 0.3) ? 'Medium' : 'Low';
      nextDay.push({ h, lift: avg(after) - avg(other), n, conf });
    } });
  nextDay.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));
  if (nextDay.length && Math.abs(nextDay[0].lift) >= 0.4 && nextDay[0].conf !== 'Low') {
    const N = nextDay[0];
    out.push({ ico: 'trending', w: 5,
      head: `${escapeHtml(N.h.label)} today → mood ${N.lift > 0 ? '+' : '−'}${Math.abs(N.lift).toFixed(1)} tomorrow`,
      sub: `The day <i>after</i> ${escapeHtml(N.h.label)}, your mood averages <b>${N.lift > 0 ? '+' : '−'}${Math.abs(N.lift).toFixed(1)}</b> vs other days (${N.n} days · ${N.conf.toLowerCase()} confidence). Next-day effects can't be explained by mood causing the habit.` });
  }
  if (lifts.length && Math.abs(lifts[0].lift) >= 0.5) { const L = lifts[0];
    out.push({ ico: 'flame', w: 5, head: `${escapeHtml(L.h.label)} ${L.lift > 0 ? 'lifts' : 'drags'} your mood by ${Math.abs(L.lift).toFixed(1)}`,
      sub: `Across ${L.n} days, your mood runs <b>${L.lift > 0 ? '+' : '−'}${Math.abs(L.lift).toFixed(1)}</b> on ${escapeHtml(L.h.label)} days. ${L.lift > 0 ? 'Protect this habit.' : 'Worth a rethink.'}` }); }

  // 3 — mood momentum (least-squares trend over the last 14 logged days)
  const seq = dates.slice(-14).map(d => num(d, 'mood')).filter(v => v != null);
  const sl = dpSlope(seq);
  if (sl != null && Math.abs(sl * 7) >= 0.3) out.push({ ico: 'trending', w: 4,
    head: `Mood trending ${sl > 0 ? 'up' : 'down'} ${Math.abs(sl * 7).toFixed(1)}/week`,
    sub: sl > 0 ? 'Whatever you changed recently — it\'s working. Keep the streak.' : 'Sliding for about two weeks — check your sleep window and screen time.' });

  // 4 — natural bed → wake time + consistency (from ended sleep segments)
  const wakes = [], beds = [];
  DB.timelog().forEach(s => { if (s.act !== 'sleep' || s.end == null) return; const dur = s.end - s.start; if (dur < 3 * 3.6e6 || dur > 14 * 3.6e6) return;
    const wd = new Date(s.end); wakes.push(wd.getHours() * 60 + wd.getMinutes());
    const bd = new Date(s.start); let bm = bd.getHours() * 60 + bd.getMinutes(); if (bm < 720) bm += 1440; beds.push(bm); });
  if (wakes.length >= 4) {
    const fmtT = m => { const h = Math.floor(m / 60) % 24, mm = Math.round(m % 60); const ap = h >= 12 ? 'pm' : 'am'; return (((h + 11) % 12) + 1) + ':' + String(mm).padStart(2, '0') + ap; };
    const sd = dpStd(wakes);
    out.push({ ico: 'clock', w: 3, head: `Your natural night: ${fmtT(dpMedian(beds))} → ${fmtT(dpMedian(wakes))}`,
      sub: sd == null ? '' : (sd <= 35 ? `Impressively consistent wake time (±${Math.round(sd)}m over ${wakes.length} nights).`
        : `Wake time swings ±${Math.round(sd)}m — steadier mornings usually mean steadier energy.`) });
  }

  // 5 — peak focus window (which 2 hours hold the most tracked work)
  const hourMs = Array(24).fill(0);
  DB.timelog().forEach(s => { if (s.act !== 'work') return; const end = s.end == null ? Date.now() : s.end; let t = s.start;
    while (t < end) { const d = new Date(t); const hEnd = new Date(d); hEnd.setMinutes(59, 59, 999); const chunk = Math.min(end, hEnd.getTime() + 1) - t; hourMs[d.getHours()] += chunk; t += chunk; } });
  if (hourMs.reduce((a, b) => a + b, 0) >= 5 * 3.6e6) {
    let best = 0; for (let i = 0; i < 23; i++) if (hourMs[i] + hourMs[i + 1] > hourMs[best] + (hourMs[best + 1] || 0)) best = i;
    const fH = h => { h = h % 24; const ap = h >= 12 ? 'pm' : 'am'; return (((h + 11) % 12) + 1) + ap; };
    out.push({ ico: 'target', w: 3, head: `Peak focus window: ${fH(best)}–${fH(best + 2)}`,
      sub: `<b>${fmtDur(hourMs[best] + (hourMs[best + 1] || 0))}</b> of your tracked work lands here — guard it for deep work, schedule meetings elsewhere.` });
  }

  // 6 — what heavy screen days cost you (top vs bottom third)
  const hsAll = healthStore(); const scrPairs = [];
  Object.keys(hsAll).forEach(d => { const sc = hsAll[d].screenMin, m = num(d, 'mood'); if (sc != null && m != null) scrPairs.push([sc, m]); });
  if (scrPairs.length >= 6) { const sorted = [...scrPairs].sort((a, b) => a[0] - b[0]); const third = Math.floor(sorted.length / 3);
    const lo = sorted.slice(0, third), hi = sorted.slice(-third);
    if (lo.length >= 2 && hi.length >= 2) { const dlt = avg(lo.map(p => p[1])) - avg(hi.map(p => p[1]));
      if (dlt >= 0.7) out.push({ ico: 'phone', w: 4, head: `Heavy screen days cost you −${dlt.toFixed(1)} mood`,
        sub: `Your heaviest screen days (~${fmtMin(Math.round(dpMedian(hi.map(p => p[0]))))}) average mood <b>${avg(hi.map(p => p[1])).toFixed(1)}</b> vs <b>${avg(lo.map(p => p[1])).toFixed(1)}</b> on the lightest.` }); } }

  // 7 — your logging blind spot (weekday you most often miss, last 28 days)
  if (dates.length >= 7) {
    const missByWd = Array(7).fill(0), possByWd = Array(7).fill(0);
    for (let i = 1; i <= 28; i++) { const d = addDays(todayStr(), -i); const wd = new Date(d + 'T00:00:00').getDay(); possByWd[wd]++; if (!e[d]) missByWd[wd]++; }
    let worst = -1, rate = 0;
    for (let w = 0; w < 7; w++) { const r = possByWd[w] ? missByWd[w] / possByWd[w] : 0; if (missByWd[w] >= 3 && r > rate) { rate = r; worst = w; } }
    const totMiss = missByWd.reduce((a, b) => a + b, 0);
    if (worst >= 0 && rate >= 0.6 && totMiss < 25) { const names = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
      out.push({ ico: 'calendar', w: 2, head: `${names[worst]} are your blind spot`,
        sub: `You missed logging ${missByWd[worst]} of the last ${possByWd[worst]} ${names[worst]} — a weekend reminder could protect the streak.` }); } }

  // 8 — sleep regularity score
  const sh = dates.map(d => num(d, 'sleepHours')).filter(v => v != null);
  if (sh.length >= 7) { const sd = dpStd(sh);
    if (sd != null) { const score = Math.max(0, Math.min(100, Math.round(100 - sd * 28)));
      out.push({ ico: 'moon', w: sd > 1.2 ? 3 : 1, head: `Sleep consistency: ${score}%`,
        sub: sd <= 0.8 ? 'Your sleep schedule is steady — a genuine superpower.' : `Your nights swing by ±${sd.toFixed(1)}h — evening out bedtime is the cheapest mood upgrade there is.` }); } }

  out.sort((a, b) => b.w - a.w);
  return out.slice(0, 6);
}
function pearson(pairs) {
  const n = pairs.length; if (n < 3) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  pairs.forEach(([x, y]) => { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; });
  const cov = sxy - sx * sy / n, vx = sxx - sx * sx / n, vy = syy - sy * sy / n;
  if (vx <= 0 || vy <= 0) return null;
  return Math.max(-1, Math.min(1, cov / Math.sqrt(vx * vy)));
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
  const hb = k => { const v = hVal(e, k); return v === H_SKIP ? null : (e.habits && k in e.habits ? (v === H_DONE ? 100 : 0) : null); };
  const mean = arr => { const a = arr.filter(x => x != null); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };

  const body = mean([tgt(e.sleepHours, 8), s10(e.sleepQuality), s10(e.energy), tgt(e.water, 8), hb('workout'), hb('faceWorkout'), hb('healthyFood')]);
  const mind = mean([s10(e.mood), s10(e.happiness), s10i(e.stress), s10i(e.anxiety), s10(e.clarity), s10(e.focus), s10(e.motivation), hb('meditation')]);
  let tasksR = null;
  if (e.tasksDone != null && e.tasksDone !== '' && +e.tasksPlanned > 0) tasksR = cl(+e.tasksDone / +e.tasksPlanned * 100);
  const work = mean([tgt(e.deepWorkHours, 4), s10(e.productivity), s10(e.efficiency), s10(e.workSatisfaction), tasksR]);
  const topicsN = e.topics ? cl(Object.values(e.topics).filter(Boolean).length / 3 * 100) : null;
  const learning = mean([hb('reading'), hb('english'), hb('consumed'), hb('projectAI'), hb('projectSpace'), s10(e.retention), topicsN, tgt(e.codeLines, 100)]);
  let discipline = null;
  if (e.habits && HABITS.length) {
    const counted = HABITS.filter(h => hVal(e, h.key) !== H_SKIP);   // a skipped habit is neither
    if (counted.length) discipline = cl(counted.filter(h => hVal(e, h.key) === H_DONE).length / counted.length * 100);
  }

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
  HABITS.forEach(h => { const c = thisW.filter(d => hVal(e[d], h.key) === H_DONE).length;
    if (!strong || c > strong.c) strong = { h, c }; if (!weak || c < weak.c) weak = { h, c }; });
  if (strong && strong.c > 0) lines.push({ t: `Most consistent: <b>${strong.h.emoji} ${escapeHtml(strong.h.label)}</b> (${strong.c}/7)`, k: 'ok' });
  if (weak && weak.c < logged) lines.push({ t: `Needs love: <b>${weak.h.emoji} ${escapeHtml(weak.h.label)}</b> (${weak.c}/7)`, k: 'warn' });
  const mWo = avgOf(thisW.filter(d => e[d] && e[d].workoutsDone > 0), 'mood');
  const mNo = avgOf(thisW.filter(d => e[d] && !(e[d].workoutsDone > 0)), 'mood');
  if (mWo != null && mNo != null && mWo - mNo >= 0.5) lines.push({ t: `💡 Your mood is <b>+${(mWo - mNo).toFixed(1)}</b> higher on workout days — keep moving.`, k: 'tip' });
  return lines;
}
/* Universal file export. Works in a normal browser (real download) AND inside the
   Capacitor WebView, which has no download manager: there we open Android's share
   sheet (Save to Files/Drive/email…) and, if that's unavailable, a copy-out modal. */
async function saveFile(filename, content, mime) {
  const inApp = !!window.Capacitor;
  if (navigator.canShare) {
    try {
      const file = new File([content], filename, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        toast('Choose where to save 📤'); return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; /* else fall through */ }
  }
  if (!inApp) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type: mime }));
    a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Saved to your downloads'); return;
  }
  // in-app, no share support: text → copy modal; binary (PDF) → try a viewer, but be honest if blocked
  if (typeof content === 'string') { showCopyModal(filename, content); return; }
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type: mime }));
  const win = window.open(url, '_blank');
  if (win) toast('Opened — use the ⋮ menu to save or share');
  else toast('Your app version can\'t save files yet — update Daylog in the Play Store', true);
}
function showCopyModal(filename, content) {
  let m = document.getElementById('copy-modal');
  if (!m) { m = document.createElement('div'); m.id = 'copy-modal'; m.className = 'copy-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="copy-box">
    <div class="copy-head"><b>${escapeHtml(filename)}</b><button class="drawer-x" data-copy-close>✕</button></div>
    <p class="hint">Here's your data. Tap <b>Copy</b> and paste it into Files, Drive, Notes or an email — or <b>Share</b> it straight to another app.</p>
    <textarea class="copy-ta" readonly>${escapeHtml(content)}</textarea>
    <div class="copy-actions">
      <button class="btn btn-primary btn-sm" data-copy-do>📋 Copy</button>
      <button class="btn btn-ghost btn-sm" data-copy-share>📤 Share</button>
      <button class="btn btn-ghost btn-sm" data-copy-close>Close</button>
    </div></div>`;
  m._content = content; m._filename = filename; m.classList.add('on');
}
document.addEventListener('click', async (ev) => {
  const m = document.getElementById('copy-modal'); if (!m || !m.classList.contains('on')) return;
  if (ev.target.closest('[data-copy-close]')) { m.classList.remove('on'); return; }
  if (ev.target.closest('[data-copy-do]')) {
    try { await navigator.clipboard.writeText(m._content); toast('Copied ✓'); }
    catch (e) { const ta = m.querySelector('.copy-ta'); ta.focus(); ta.select(); try { document.execCommand('copy'); toast('Copied ✓'); } catch (_) { toast('Select all and copy', true); } }
    return;
  }
  if (ev.target.closest('[data-copy-share]')) { try { await navigator.share({ text: m._content, title: m._filename }); } catch (e) {} return; }
});
function exportCSV() {
  const e = DB.entries(); const dates = Object.keys(e).sort();
  if (!dates.length) { toast('Nothing to export yet', true); return; }
  const cols = ['date', 'mood', 'energy', 'sleepHours', 'deepWorkHours', 'tasksDone', 'tasksPlanned', 'workoutsDone', 'workoutDetail', 'timeSummary', 'wentWell', 'improve', 'journal', 'tasks'];
  const esc = v => { v = String(v == null ? '' : v).replace(/"/g, '""'); return /[",\n]/.test(v) ? `"${v}"` : v; };
  let csv = cols.join(',') + '\n';
  dates.forEach(d => csv += cols.map(c => esc(c === 'date' ? d : e[d][c])).join(',') + '\n');
  saveFile('daily-pulse-' + todayStr() + '.csv', csv, 'text/csv');
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
    if (en.habits) HABITS.forEach(h => { if (hVal(en, h.key) === H_DONE) { add('h:' + h.key, 'habit', h.label); links.push(['d:' + d, 'h:' + h.key]); } });
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
/* Connections graph explorer: one-finger pan, two-finger pinch zoom, wheel zoom.
   Works by mutating the SVG viewBox — cheap enough for low-end phones. */
const _gPts = new Map(); let _gv = null, _gMovedAt = 0;
function _graphViewOf(svg) {
  if (!svg.dataset.vbInit) { const vb = svg.getAttribute('viewBox').split(' ').map(Number); _gv = { x: vb[0], y: vb[1], w: vb[2], h: vb[3], W: vb[2], H: vb[3] }; svg.dataset.vbInit = '1'; }
  return _gv;
}
document.addEventListener('pointerdown', (e) => { const svg = e.target.closest('#graph-svg'); if (!svg) return; _gPts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { svg.setPointerCapture(e.pointerId); } catch (_) {} });
document.addEventListener('pointermove', (e) => {
  if (!_gPts.has(e.pointerId)) return;
  const svg = document.getElementById('graph-svg'); if (!svg) { _gPts.clear(); return; }
  const v = _graphViewOf(svg); const rect = svg.getBoundingClientRect(); const scale = v.w / Math.max(1, rect.width);
  if (_gPts.size === 1) {
    const p = _gPts.get(e.pointerId); const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) _gMovedAt = Date.now();
    v.x -= dx * scale; v.y -= dy * scale; p.x = e.clientX; p.y = e.clientY;
  } else if (_gPts.size === 2) {
    const before = [..._gPts.values()]; const dOld = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
    const p = _gPts.get(e.pointerId); p.x = e.clientX; p.y = e.clientY;
    const after = [..._gPts.values()]; const dNew = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
    if (dOld > 0 && dNew > 0) { const f = dOld / dNew; const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
      v.w = Math.max(v.W / 5, Math.min(v.W * 3, v.w * f)); v.h = Math.max(v.H / 5, Math.min(v.H * 3, v.h * f)); v.x = cx - v.w / 2; v.y = cy - v.h / 2; }
    _gMovedAt = Date.now();
  }
  svg.setAttribute('viewBox', v.x + ' ' + v.y + ' ' + v.w + ' ' + v.h);
  e.preventDefault();
}, { passive: false });
document.addEventListener('pointerup', (e) => _gPts.delete(e.pointerId));
document.addEventListener('pointercancel', (e) => _gPts.delete(e.pointerId));
document.addEventListener('wheel', (e) => {
  const svg = e.target.closest && e.target.closest('#graph-svg'); if (!svg) return;
  const v = _graphViewOf(svg); const f = e.deltaY > 0 ? 1.12 : 0.89;
  const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
  v.w = Math.max(v.W / 5, Math.min(v.W * 3, v.w * f)); v.h = Math.max(v.H / 5, Math.min(v.H * 3, v.h * f)); v.x = cx - v.w / 2; v.y = cy - v.h / 2;
  svg.setAttribute('viewBox', v.x + ' ' + v.y + ' ' + v.w + ' ' + v.h); e.preventDefault();
}, { passive: false });
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
    return `<g opacity="${dim ? 0.18 : 1}"><circle data-node="${escapeHtml(n.id)}" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r}" fill="${col(n.type)}" stroke="${n.id === focus ? '#fff' : 'none'}" stroke-width="2"/>${showLabel ? `<text x="${Math.min(W - 22, Math.max(22, n.x)).toFixed(1)}" y="${(n.y - r - 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="var(--text-dim)">${escapeHtml(String(n.label).slice(0, 14))}</text>` : ''}</g>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;touch-action:none" id="graph-svg">${edges}${circ}</svg>
    <div class="hint" style="margin:4px 0 2px">🖐 drag to pan · pinch to zoom · tap a node to focus</div>
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
function bestHabitStreak(key) {
  const e = DB.entries();
  const ds = Object.keys(e).filter(d => e[d].habits && e[d].habits[key]).sort();
  let best = 0, cur = 0, prev = null;
  ds.forEach(d => { cur = (prev && addDays(prev, 1) === d) ? cur + 1 : 1; best = Math.max(best, cur); prev = d; });
  return best;
}
let dashRange = 7;
let dashTab = 'overview';
function renderDash() {
  document.getElementById('screen-title').textContent = 'Stats';
  document.getElementById('screen-sub').textContent = 'Your trends & analysis';
  const e = DB.entries();
  const N = dashRange;
  const days = []; for (let i = N - 1; i >= 0; i--) days.push(addDays(todayStr(), -i));
  const series = key => days.map(d => ({ x: d, y: e[d] && e[d][key] != null && e[d][key] !== '' ? +e[d][key] : null }));

  const allDates = Object.keys(e);
  const avg = key => { const v = allDates.map(d=>e[d][key]).filter(x=>x!=null&&x!==''); return v.length ? (v.reduce((a,b)=>a+ +b,0)/v.length).toFixed(1) : '–'; };

  // ---- Health-store helpers (steps / screen time / calories / active / HR from auto-tracking) ----
  const hstore = healthStore();
  const hFor = d => hstore[d] || {};
  const hSeries = key => days.map(d => ({ x: d, y: hFor(d)[key] != null ? hFor(d)[key] : null }));
  const hAvgR = (ds, key) => { const v = ds.map(d => hFor(d)[key]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const hDays = Object.keys(hstore).length;

  const last30 = []; for (let i = 29; i >= 0; i--) last30.push(addDays(todayStr(), -i));
  const habitBars = HABITS.map(h => {
    const hits = last30.filter(d => hVal(e[d], h.key) === H_DONE).length;
    const pct = Math.round(hits / 30 * 100);
    return `<div class="bar-row"><span class="name">${h.emoji} ${escapeHtml(h.label)}</span>
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
  const gymBars = gymStats.map(x => `<div class="bar-row"><span class="name">${x.g.emoji} ${escapeHtml(x.g.name)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.round(x.n/gymMax*100)}%;background:${x.g.color}"></span></span>
      <span class="pct">${x.n}</span></div>`).join('');

  // ---- Wellbeing / deep-log averages — DYNAMIC: every visible 1-10 field
  // (including ones you add in Customize) shows here once you've logged it ----
  const scaleDefs = [];
  deepCfg().forEach(sec => { if (sec.hidden) return;
    (sec.scales || []).forEach(f => { if (!f.hidden) scaleDefs.push({ k: f.key, l: f.label }); }); });
  const scaleBars = scaleDefs.map(s => ({ s, a: avg(s.k) })).filter(x => x.a !== '–')
    .map(x => `<div class="bar-row"><span class="name">${escapeHtml(x.s.l)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${x.a/10*100}%"></span></span>
      <span class="pct">${x.a}</span></div>`).join('');

  // ---- Numeric deep-log fields — DYNAMIC averages (water, weight, code lines, custom numbers…) ----
  const numDefs = [];
  deepCfg().forEach(sec => { if (sec.hidden) return;
    (sec.nums || []).forEach(f => { if (!f.hidden) numDefs.push({ k: f.key, l: f.label }); }); });
  const numAvgRows = numDefs.map(f => ({ f, a: avg(f.k) })).filter(x => x.a !== '–')
    .map(x => `<div class="bar-row"><span class="name" style="width:150px">${escapeHtml(x.f.l)}</span>
      <span style="flex:1"></span><span class="pct" style="width:auto">${x.a}</span></div>`).join('');

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
  allDates.forEach(d => { if (!e[d].mood) return; const day = new Date(d + 'T00:00:00').getDay(); if (!isNaN(day)) wdAgg[day].push(+e[d].mood); });
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

  // ---- REAL analytics: correlations between paired daily metrics + week-over-week ----
  const pairsOf = (kx, ky) => allDates
    .map(d => [e[d][kx], e[d][ky]])
    .filter(([x, y]) => x != null && x !== '' && y != null && y !== '' && !isNaN(+x) && !isNaN(+y))
    .map(([x, y]) => [+x, +y]);
  const corrRows = [];
  [['sleepHours', 'mood', '😴 Sleep → Mood'], ['sleepHours', 'energy', '😴 Sleep → Energy'],
   ['deepWorkHours', 'mood', '🎯 Deep work → Mood'], ['energy', 'deepWorkHours', '⚡ Energy → Deep work']]
  .forEach(([kx, ky, label]) => {
    const ps = pairsOf(kx, ky); if (ps.length < 5) return;   // need enough days to be honest
    const r = pearson(ps); if (r == null) return;
    const mag = Math.abs(r);
    const strength = mag >= 0.6 ? 'strong' : mag >= 0.3 ? 'moderate' : 'weak';
    const dir = r >= 0 ? '↗ together' : '↘ opposite';
    corrRows.push(`<div class="corr-row"><span class="name">${label}</span>
      <span class="corr-bar"><span class="corr-fill ${r >= 0 ? 'pos' : 'neg'}" style="width:${Math.round(mag * 100)}%"></span></span>
      <span class="corr-val">${strength} ${dir} · r=${r.toFixed(2)} · ${ps.length}d</span></div>`);
  });
  const wMood = condAvg(d => e[d].habits && e[d].habits.workout, 'mood');
  const nMood = condAvg(d => e[d].habits && !e[d].habits.workout, 'mood');
  if (wMood != null && nMood != null && allDates.length >= 5)
    corrRows.push(`<div class="corr-note">💪 Workout days: mood <b>${wMood.toFixed(1)}</b> vs <b>${nMood.toFixed(1)}</b> on rest days (${wMood > nMood ? '+' : ''}${(wMood - nMood).toFixed(1)}).</div>`);

  // week (last 7 days) vs the 7 before — real deltas across sources
  const wk = (off) => { const ds = []; for (let i = 0; i < 7; i++) ds.push(addDays(todayStr(), -(i + off))); return ds; };
  const avgOver = (ds, k) => { const v = ds.map(d => e[d] && e[d][k]).filter(x => x != null && x !== '' && !isNaN(+x)); return v.length ? v.reduce((a, b) => a + +b, 0) / v.length : null; };
  const trackedTotal = ds => ds.reduce((s, d) => s + segsForDay(d).reduce((t, x) => t + (x.b - x.a), 0), 0);
  const thisW = wk(0), lastW = wk(7);
  const wowRows = [];
  const wow = (label, a, b, unit, dec) => {
    if (a == null || b == null) return;
    const diff = a - b; const up = diff >= 0;
    wowRows.push(`<div class="wow-row"><span class="name">${label}</span>
      <span class="wow-vals">${a.toFixed(dec)}${unit} <span class="hint">vs ${b.toFixed(dec)}${unit}</span></span>
      <span class="wow-delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(diff).toFixed(dec)}${unit}</span></div>`);
  };
  wow('😊 Mood', avgOver(thisW, 'mood'), avgOver(lastW, 'mood'), '', 1);
  wow('😴 Sleep', avgOver(thisW, 'sleepHours'), avgOver(lastW, 'sleepHours'), 'h', 1);
  wow('🎯 Deep work', avgOver(thisW, 'deepWorkHours'), avgOver(lastW, 'deepWorkHours'), 'h', 1);
  const tA = trackedTotal(thisW) / 3600000, tB = trackedTotal(lastW) / 3600000;
  if (tA > 0 || tB > 0) wow('⏱ Time tracked', tA, tB, 'h', 0);
  const woA = thisW.filter(d => e[d] && +e[d].workoutsDone > 0).length, woB = lastW.filter(d => e[d] && +e[d].workoutsDone > 0).length;
  if (woA || woB) wow('💪 Workouts', woA, woB, '', 0);
  const scA = hAvgR(thisW, 'screenMin'), scB = hAvgR(lastW, 'screenMin');
  if (scA != null && scB != null) wow('📱 Screen time', scA / 60, scB / 60, 'h', 1);
  const stA = hAvgR(thisW, 'steps'), stB = hAvgR(lastW, 'steps');
  if (stA != null && stB != null) wow('👟 Steps', stA, stB, '', 0);
  const deepInsightsCard = (corrRows.length || wowRows.length) ? `<div class="card">
      <h2>🔗 Connected insights <span class="hint">how your metrics move together</span></h2>
      ${corrRows.join('')}
      ${wowRows.length ? `<h3 class="wow-head">This week vs last week</h3>${wowRows.join('')}` : ''}
    </div>` : (allDates.length < 5 ? '<div class="card"><h2>🔗 Connected insights</h2><div class="hint">Log ~5 days and this unlocks: how sleep drives your mood, week-over-week trends, workout effects.</div></div>' : '');

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

  // ---------- three tabbed views (simplify + separate time vs checklist) ----------
  const RANGES = [[1, 'Today'], [7, 'Last 7 days'], [14, 'Last 14 days'], [30, 'Last 30 days'], [90, 'Last 3 months']];
  const rangeRow = `<div class="range-row">
      <label for="dash-range" class="range-lab">${icon('calendar', 14)} Range</label>
      <select id="dash-range" class="range-select">
        ${RANGES.map(([v, l]) => `<option value="${v}" ${dashRange === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>`;

  // ---- Auto-collected productivity: pomodoros / tasks done / words written ----
  const pomoHist = safeParse(localStorage.getItem('dp.pomohist'), {});
  const pNow = DB.pomo();
  if (pNow && pNow.done && pNow.done.d && pNow.done.n) pomoHist[pNow.done.d] = Math.max(pomoHist[pNow.done.d] || 0, pNow.done.n);   // merge pre-history today count
  const pomoSeries = days.map(d => ({ x: d, y: pomoHist[d] || null }));
  const pomoTotal = days.reduce((s, d) => s + (pomoHist[d] || 0), 0);
  const focusMin = (pNow && pNow.cfg && pNow.cfg.focus) ? pomoTotal * pNow.cfg.focus : null;
  const wcOf = d => { const en = e[d]; if (!en) return null;
    const t = ['journal', 'wentWell', 'improve', 'weekWins', 'weekFocus'].map(k => en[k] || '').join(' ').trim();
    return t ? t.split(/\s+/).filter(Boolean).length : null; };
  const wordsSeries = days.map(d => ({ x: d, y: wcOf(d) }));
  const wordsTotal = days.reduce((s, d) => s + (wcOf(d) || 0), 0);
  const tasksSeries = days.map(d => ({ x: d, y: (e[d] && e[d].tasksDone != null && e[d].tasksDone !== '') ? +e[d].tasksDone : null }));
  const tasksDoneTotal = days.reduce((s, d) => s + ((e[d] && +e[d].tasksDone) || 0), 0);
  const autoCards = [
    pomoTotal ? `<div class="card"><h2>🍅 Focus sessions <span class="hint">auto · last ${N} days · ${pomoTotal} total${focusMin ? ' · ' + fmtH(focusMin / 60) : ''}</span></h2>${barChart(pomoSeries, '#f87171')}</div>` : '',
    tasksDoneTotal ? `<div class="card"><h2>✅ Tasks completed <span class="hint">auto · last ${N} days · ${tasksDoneTotal} total</span></h2>${barChart(tasksSeries, '#34d399')}</div>` : '',
    wordsTotal ? `<div class="card"><h2>✍️ Words written <span class="hint">auto from journal+reflections · ${wordsTotal.toLocaleString()} total</span></h2>${barChart(wordsSeries, '#8b9dff')}</div>` : '',
  ].join('');

  // ---- Best days in range (real, dated highlights) ----
  const bestOf = (getV) => { let best = null; days.forEach(d => { const v = getV(d); if (v != null && v !== '' && !isNaN(+v) && (best == null || +v > best.v)) best = { d, v: +v }; }); return best; };
  const bMood = bestOf(d => e[d] && e[d].mood);
  const bFocus = bestOf(d => e[d] && e[d].deepWorkHours);
  const bSteps = bestOf(d => hFor(d).steps);
  const bTracked = bestOf(d => { const ms = segsForDay(d).reduce((s, x) => s + (x.b - x.a), 0); return ms > 0 ? ms : null; });
  const bestRow = (label, best, fmt) => best ? `<div class="wow-row"><span class="name">${label}</span><span class="wow-vals">${fmt(best.v)}</span><span class="hint">${prettyDate(best.d).replace(/, \d{4}$/, '')}</span></div>` : '';
  const bestDaysCard = (bMood || bFocus || bSteps || bTracked) ? `<div class="card">
      <h2>🏅 Best days <span class="hint">in this range</span></h2>
      ${bestRow('😊 Best mood', bMood, v => v + '/10')}
      ${bestRow('🎯 Most deep work', bFocus, v => fmtH(v))}
      ${bestRow('👟 Most steps', bSteps, v => Math.round(v).toLocaleString())}
      ${bestRow('⏱ Most tracked', bTracked, v => fmtDur(v))}
    </div>` : '';

  // ---- Top journal #tags in range ----
  const tagCount = {};
  days.forEach(d => { const j = (e[d] && e[d].journal) || ''; (j.match(/#[\p{L}\d_]+/gu) || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }); });
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const tagsCard = topTags.length ? `<div class="card">
      <h2>#️⃣ Your topics <span class="hint">from journal #tags · this range</span></h2>
      <div class="tag-cloud">${topTags.map(([t, n]) => `<button class="tag-chip" data-searchtag="${escapeHtml(t)}">${escapeHtml(t)} <b>${n}</b></button>`).join('')}</div>
    </div>` : '';

  const patterns = computePatterns();
  const patternsCard = patterns.length
    ? `<div class="card"><h2 class="h2-icon">${hicon('lightbulb')}<span>Your patterns</span> <span class="hint">mined from your data · on-device</span></h2>
        ${patterns.map(p => `<div class="pat-row"><span class="pat-ico">${icon(p.ico, 18)}</span><div class="pat-txt"><div class="pat-head">${p.head}</div>${p.sub ? `<div class="pat-sub">${p.sub}</div>` : ''}</div></div>`).join('')}
      </div>`
    : `<div class="card"><h2 class="h2-icon">${hicon('lightbulb')}<span>Your patterns</span></h2>
        <div class="hint">Log about a week of days and your personal patterns appear here — your sleep sweet spot, which habits actually lift your mood, your peak focus hours. Computed on your phone, never uploaded.</div></div>`;

  const overviewHTML = `
    <div class="card"><div class="stat-grid">
      <div class="stat"><div class="v">${loggedStreak()}</div><div class="l">🔥 day streak</div></div>
      <div class="stat"><div class="v">${longestLoggedStreak()}</div><div class="l">best streak</div></div>
      <div class="stat"><div class="v">${allDates.length}</div><div class="l">days logged</div></div>
      <div class="stat"><div class="v">${avg('mood')}</div><div class="l">avg mood</div></div>
      <div class="stat"><div class="v">${avg('energy')}</div><div class="l">avg energy</div></div>
      <div class="stat"><div class="v">${pmAvg}</div><div class="l">🧭 polymath</div></div>
    </div></div>

    ${patternsCard}

    <div class="card pm-card">
      <h2>🧭 Polymath Index <span class="hint">last 30 days</span></h2>
      <div class="pm-hero">
        <div class="pm-score">${pmAvg}<span class="pm-out">/100</span></div>
        <div class="pm-meta"><div>30-day average</div><div class="hint">latest day: ${latestPm}${typeof latestPm==='number'?'/100':''}</div></div>
      </div>
      ${barChart(pmSeries, '#8b9dff', { max: 100 })}
      <div style="margin-top:10px">${pmBars}</div>
    </div>

    ${(() => { const r = coachReview(); return r ? `<div class="card"><h2>🧑‍🏫 Weekly review <span class="hint">last 7 days</span></h2>${r.map(l => `<div class="rev rev-${l.k}">${l.t}</div>`).join('')}</div>` : ''; })()}

    <div class="card"><h2>😊 Mood <span class="hint">last ${N} days</span></h2>${barChart(series('mood'), '#6d8cff', { max: 10 })}</div>
    <div class="card"><h2>⚡ Energy <span class="hint">last ${N} days</span></h2>${barChart(series('energy'), '#4ad6c0', { max: 10 })}</div>

    ${deepInsightsCard}

    ${bestDaysCard}

    ${autoCards}

    ${tagsCard}

    ${insights.length ? `<div class="card"><h2>💡 Insights</h2>
      ${insights.map(t=>`<div style="font-size:13.5px;color:var(--text-dim);padding:7px 0;border-bottom:1px solid var(--border);line-height:1.5">${t}</div>`).join('')}</div>` : ''}

    <div class="card"><h2>🕸️ Connections <span class="hint">your journal graph</span></h2><div id="graph-wrap">${graphSVG()}</div></div>

    ${yearPixelsHTML()}`;

  const timeHTML = `
    <div class="card"><div class="stat-grid">
      <div class="stat"><div class="v">${avg('sleepHours')}</div><div class="l">avg sleep h</div></div>
      <div class="stat"><div class="v">${avg('deepWorkHours')}</div><div class="l">avg deep wk</div></div>
      <div class="stat"><div class="v">${gymStreak()}</div><div class="l">💪 gym streak</div></div>
      <div class="stat"><div class="v">${totalWorkouts}</div><div class="l">workouts</div></div>
    </div></div>

    ${timeStatsHTML(days) || '<div class="card"><div class="empty">No time tracked in this range. Start a stopwatch on the Time tab.</div></div>'}

    <div class="card"><h2>😴 Sleep <span class="hint">hours · last ${N} days</span></h2>${barChart(series('sleepHours'), '#a78bfa')}</div>
    <div class="card"><h2>🎯 Deep work <span class="hint">hours · last ${N} days</span></h2>${barChart(series('deepWorkHours'), '#fbbf24')}</div>

    <div class="card"><h2>🏋️ Workout volume <span class="hint">exercises/day · last ${N} days</span></h2>${barChart(woSeries, '#34d399')}</div>

    <div class="card"><h2>💪 Gym breakdown <span class="hint">sessions per group · ${totalWorkouts} total</span></h2>
      ${gymBars || '<div class="empty">No workouts logged yet.</div>'}</div>`;

  const checkHTML = `
    <div class="card"><h2>✅ Tasks <span class="hint">${tRate}% completed</span></h2>
      <div class="stat-grid">
        <div class="stat"><div class="v">${tOpen}</div><div class="l">open</div></div>
        <div class="stat"><div class="v">${tDone}</div><div class="l">done</div></div>
        <div class="stat"><div class="v">${tRate}%</div><div class="l">rate</div></div>
      </div></div>

    <div class="card"><h2>🔥 Habit consistency <span class="hint">last 30 days</span></h2>${habitBars || '<div class="empty">No habits yet.</div>'}</div>

    ${(() => { // streak leaderboard: current vs best run per habit, sorted by current
      const rows = HABITS.map(h => ({ h, cur: habitStreak(h.key), best: bestHabitStreak(h.key) }))
        .filter(x => x.best > 0).sort((a, b) => b.cur - a.cur || b.best - a.best);
      if (!rows.length) return '';
      return `<div class="card"><h2>🏆 Streak leaderboard <span class="hint">current · best ever</span></h2>
        ${rows.map((x, i) => `<div class="wow-row"><span class="name">${['🥇','🥈','🥉'][i] || '·'} ${escapeHtml(x.h.label)}</span>
          <span class="wow-vals">🔥 ${x.cur} <span class="hint">now</span></span>
          <span class="wow-delta up">best ${x.best}</span></div>`).join('')}</div>`;
    })()}

    ${scaleBars ? `<div class="card"><h2>🧠 Wellbeing averages <span class="hint">out of 10</span></h2>${scaleBars}</div>` : ''}

    ${numAvgRows ? `<div class="card"><h2>🔢 Tracked numbers <span class="hint">all-time average</span></h2>${numAvgRows}</div>` : ''}

    <div class="card"><h2>📅 Mood calendar <span class="hint">last 12 weeks</span></h2>
      <div class="heat">${heatCells}</div>
      <div class="legend"><span><span class="dot" style="background:hsl(0,62%,45%)"></span>low</span>
        <span><span class="dot" style="background:hsl(60,62%,45%)"></span>ok</span>
        <span><span class="dot" style="background:hsl(120,62%,45%)"></span>great</span></div></div>

    <div class="card"><h2>Mood by weekday <span class="hint">all time</span></h2>${wdBars}</div>`;

  // ---- HEALTH tab: everything auto-tracking captures, charted + connected to your mood ----
  const at = autoTrackCfg();
  const hAvg = key => hAvgR(days, key);
  const hStat = (v, l) => v == null ? '' : `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const hChart = (key, label, color, fmtAvg) => {
    const s = hSeries(key); if (!s.some(p => p.y != null)) return '';
    const a = hAvg(key);
    return `<div class="card"><h2>${label} <span class="hint">last ${N} days${a != null ? ' · avg ' + fmtAvg(a) : ''}</span></h2>${barChart(s, color)}</div>`;
  };
  // health ↔ mood/energy correlations across ALL days both exist
  const hPairs = (hkey, ekey) => Object.keys(hstore)
    .filter(d => hstore[d][hkey] != null && e[d] && e[d][ekey] != null && e[d][ekey] !== '')
    .map(d => [+hstore[d][hkey], +e[d][ekey]]);
  const hCorrRows = [];
  [['screenMin', 'mood', '📱 Screen time → Mood'], ['steps', 'mood', '👟 Steps → Mood'], ['steps', 'energy', '👟 Steps → Energy'], ['exerciseMin', 'energy', '🏃 Active mins → Energy']]
  .forEach(([hk, ek, label]) => {
    const ps = hPairs(hk, ek); if (ps.length < 5) return;
    const r = pearson(ps); if (r == null) return;
    const mag = Math.abs(r);
    hCorrRows.push(`<div class="corr-row"><span class="name">${label}</span>
      <span class="corr-bar"><span class="corr-fill ${r >= 0 ? 'pos' : 'neg'}" style="width:${Math.round(mag * 100)}%"></span></span>
      <span class="corr-val">${mag >= 0.6 ? 'strong' : mag >= 0.3 ? 'moderate' : 'weak'} ${r >= 0 ? '↗' : '↘'} · r=${r.toFixed(2)} · ${ps.length}d</span></div>`);
  });
  const scAvg = hAvg('screenMin'), dwAvg = (() => { const v = days.map(d => e[d] && e[d].deepWorkHours).filter(x => x != null && x !== '' && !isNaN(+x)); return v.length ? v.reduce((a, b) => a + +b, 0) / v.length : null; })();
  const screenVsWork = (scAvg != null && dwAvg > 0) ? `<div class="corr-note">📱 Screen time averages <b>${fmtMin(Math.round(scAvg))}</b>/day — <b>${(scAvg / 60 / dwAvg).toFixed(1)}×</b> your deep work (${fmtH(dwAvg)}).</div>` : '';
  const sampleOn = !!localStorage.getItem('dp.sampleMeta');
  const sampleBar = sampleOn ? `<div class="card sample-bar"><span>👀 Showing <b>sample data</b> — a preview of auto-tracking.</span><button class="btn btn-ghost btn-sm" id="hc-sample-clear">Clear sample</button></div>` : '';
  const healthHTML = !at.on
    ? '<div class="card"><h2>❤️ Health</h2><div class="hint">Auto-tracking is switched off. Turn it on in <b>Settings ▸ Auto-tracking</b>.</div></div>'
    : (hDays === 0
      ? `<div class="card"><h2>❤️ Health <span class="hint">nothing synced yet</span></h2>
          <div class="hint">Steps, screen time, calories, sleep and active minutes from your phone will appear here — <b>coming in a Play update</b>. Pick what to track in <b>Settings ▸ Auto-tracking</b>.</div>
          <button class="btn btn-primary btn-sm" id="hc-sample" style="margin-top:10px">👀 Preview with sample data</button></div>`
      : sampleBar + `
    <div class="card"><div class="stat-grid">
      ${hStat(hAvg('steps') != null ? Math.round(hAvg('steps')).toLocaleString() : null, '👟 avg steps')}
      ${hStat(hAvg('screenMin') != null ? fmtMin(Math.round(hAvg('screenMin'))) : null, '📱 avg screen')}
      ${hStat(hAvg('calories') != null ? Math.round(hAvg('calories')) : null, '🔥 avg kcal')}
      ${hStat(hAvg('sleepMin') != null ? fmtMin(Math.round(hAvg('sleepMin'))) : null, '😴 avg sleep')}
      ${hStat(hAvg('exerciseMin') != null ? fmtMin(Math.round(hAvg('exerciseMin'))) : null, '🏃 avg active')}
      ${hStat(hAvg('hr') != null ? Math.round(hAvg('hr')) + ' bpm' : null, '❤️ avg HR')}
    </div></div>
    ${at.screentime ? hChart('screenMin', '📱 Screen time', '#fb923c', v => fmtMin(Math.round(v))) : ''}
    ${at.steps ? hChart('steps', '👟 Steps', '#34d399', v => Math.round(v).toLocaleString()) : ''}
    ${at.calories ? hChart('calories', '🔥 Calories', '#f87171', v => Math.round(v) + ' kcal') : ''}
    ${at.workouts ? hChart('exerciseMin', '🏃 Active minutes', '#4ad6c0', v => fmtMin(Math.round(v))) : ''}
    ${at.sleep ? hChart('sleepMin', '😴 Sleep (auto)', '#a78bfa', v => fmtMin(Math.round(v))) : ''}
    ${(hCorrRows.length || screenVsWork) ? `<div class="card"><h2>🔗 Health ↔ You</h2>${hCorrRows.join('')}${screenVsWork}</div>` : ''}
    ${(!sampleOn && hDays < 5) ? '<button class="btn btn-ghost btn-sm" id="hc-sample">👀 Preview with sample data</button>' : ''}`);

  const TABS = [['overview', icon('chart', 15) + ' Overview'], ['time', icon('clock', 15) + ' Time'], ['check', icon('check', 15) + ' Checklist'], ['health', icon('heart', 15) + ' Health']];
  const body = { overview: overviewHTML, time: timeHTML, check: checkHTML, health: healthHTML }[dashTab] || overviewHTML;
  document.getElementById('s-dash').innerHTML = `
    <div class="seg-row">${TABS.map(([k, l]) => `<button class="seg-btn ${dashTab===k?'on':''}" data-dashtab="${k}">${l}</button>`).join('')}</div>
    ${dashTab === 'check' ? '' : rangeRow}
    ${body}`;
}

/* ============================================================
   SCREEN: SEARCH — find anything you ever wrote, across the app.
   Searches log entries (journal + reflections), tasks, notes,
   plans, Write articles and calendar events; #tags work naturally.
   Each result deep-links to its home screen.
   ============================================================ */
let searchQ = '';
function renderSearch() {
  document.getElementById('screen-title').textContent = 'Search';
  document.getElementById('screen-sub').textContent = 'find anything you wrote';
  document.getElementById('s-search').innerHTML = `
    <div class="card">
      <div class="task-add">
        <input type="text" id="search-q" placeholder="Search journals, tasks, notes… or #tag" autocomplete="off" value="${escapeHtml(searchQ)}">
      </div>
    </div>
    <div id="search-results">${searchQ ? runSearch(searchQ) : '<div class="empty">Type at least 2 characters. Tip: search a <b>#tag</b> to see every day you mentioned it.</div>'}</div>`;
  const inp = document.getElementById('search-q');
  if (inp && !searchQ) setTimeout(() => inp.focus(), 50);
}
function snippet(text, q) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return escapeHtml(text.slice(0, 80));
  const a = Math.max(0, i - 34), b = Math.min(text.length, i + q.length + 46);
  return (a > 0 ? '…' : '') + escapeHtml(text.slice(a, i)) + '<b>' + escapeHtml(text.slice(i, i + q.length)) + '</b>' + escapeHtml(text.slice(i + q.length, b)) + (b < text.length ? '…' : '');
}
function runSearch(q) {
  q = q.trim(); if (q.length < 2) return '<div class="empty">Type at least 2 characters.</div>';
  const ql = q.toLowerCase(); const hit = s => s && String(s).toLowerCase().includes(ql);
  const groups = [];
  // Log entries — journal + all text fields
  const e = DB.entries();
  const logRows = Object.keys(e).sort().reverse().map(d => {
    const en = e[d];
    const fields = ['journal', 'wentWell', 'improve', 'weekWins', 'weekFocus'];
    const f = fields.find(k => hit(en[k]));
    return f ? `<div class="sr-row" data-sr="log" data-d="${d}"><span class="sr-when">${prettyDate(d).replace(/, \d{4}$/, '')}</span><span class="sr-snip">${snippet(en[f], q)}</span></div>` : '';
  }).filter(Boolean);
  if (logRows.length) groups.push(['📝 Log entries', logRows]);
  const taskRows = DB.tasks().filter(t => hit(t.text)).map(t =>
    `<div class="sr-row" data-sr="task"><span class="sr-when">${t.done ? '✓ done' : 'open'}</span><span class="sr-snip">${snippet(t.text, q)}</span></div>`);
  if (taskRows.length) groups.push(['✅ Tasks', taskRows]);
  const noteRows = DB.notes().filter(n => hit(n.text)).map(n =>
    `<div class="sr-row" data-sr="note"><span class="sr-when">${n.created || ''}</span><span class="sr-snip">${snippet(n.text, q)}</span></div>`);
  if (noteRows.length) groups.push(['🗒️ Notes', noteRows]);
  const planRows = [];
  DB.plans().forEach(p => {
    if (hit(p.name)) planRows.push(`<div class="sr-row" data-sr="plan" data-id="${p.id}"><span class="sr-when">plan</span><span class="sr-snip">${snippet(p.name, q)}</span></div>`);
    (p.items || []).forEach(it => { if (hit(it.text)) planRows.push(`<div class="sr-row" data-sr="plan" data-id="${p.id}"><span class="sr-when">${escapeHtml((p.name || '').slice(0, 14))}</span><span class="sr-snip">${snippet(it.text, q)}</span></div>`); });
  });
  if (planRows.length) groups.push(['📋 Plans', planRows]);
  const docRows = [];
  DB.docs().forEach(dc => {
    const inTitle = hit(dc.title); const blk = (dc.blocks || []).find(b => hit(b.text));
    if (inTitle || blk) docRows.push(`<div class="sr-row" data-sr="doc" data-id="${dc.id}"><span class="sr-when">${escapeHtml((dc.title || 'untitled').slice(0, 14))}</span><span class="sr-snip">${snippet(inTitle ? dc.title : blk.text, q)}</span></div>`);
  });
  if (docRows.length) groups.push(['✍️ Articles', docRows]);
  const evRows = DB.events().filter(x => hit(x.label)).map(x =>
    `<div class="sr-row" data-sr="event" data-d="${x.date}"><span class="sr-when">${x.date}${x.time ? ' ' + x.time : ''}</span><span class="sr-snip">${snippet(x.label, q)}</span></div>`);
  if (evRows.length) groups.push(['📌 Events', evRows]);
  if (!groups.length) return `<div class="empty">Nothing found for “${escapeHtml(q)}”.</div>`;
  const total = groups.reduce((s, [, r]) => s + r.length, 0);
  return `<div class="hint" style="margin:2px 4px 8px">${total} result${total === 1 ? '' : 's'}</div>` +
    groups.map(([title, rows]) => `<div class="card"><h2>${title} <span class="hint">${rows.length}</span></h2>${rows.join('')}</div>`).join('');
}
let _searchTimer;
document.addEventListener('input', (ev) => {
  if (ev.target.id !== 'search-q') return;
  searchQ = ev.target.value;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => { const r = document.getElementById('search-results'); if (r) r.innerHTML = searchQ.trim().length >= 2 ? runSearch(searchQ) : '<div class="empty">Type at least 2 characters.</div>'; }, 220);
});
document.addEventListener('click', (ev) => {
  // tag chips in Stats → search that tag
  const tc = ev.target.closest('.tag-chip[data-searchtag]');
  if (tc) { searchQ = tc.dataset.searchtag; navigateTo('search'); return; }
  const row = ev.target.closest('.sr-row'); if (!row || !document.getElementById('s-search').classList.contains('on')) return;
  const kind = row.dataset.sr;
  if (kind === 'log') { logDate = row.dataset.d; show('today'); }
  else if (kind === 'task') show('tasks');
  else if (kind === 'note') show('notes');
  else if (kind === 'plan') { curPlan = row.dataset.id; show('plans'); }
  else if (kind === 'doc') { curDoc = row.dataset.id; show('write'); }
  else if (kind === 'event') { calSel = row.dataset.d; calMonth = calSel.slice(0, 7); show('cal'); }
});

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
    ${kind === 'h' ? `<button class="cfg-goal ${item.goal ? 'on' : ''}" data-cfg-goal="${id}" title="daily count goal">${item.goal ? `${item.goal.cmp === 'atmost' ? '≤' : ''}${item.goal.n}` : '🎯'}</button>` : ''}
    <button class="cfg-hide" data-cfg-hide="${kind}:${id}" title="show / hide">${item.hidden ? '🙈' : '👁'}</button>
    ${deletable ? `<button class="del" data-cfg-del="${kind}:${id}">×</button>` : '<span style="width:23px"></span>'}
  </div>`;
}
/* Customize is a HUB of cards; each opens its own sub-page (customPage). */
let customPage = null;
const CUSTOM_PAGES = [
  // Daily checklist removed — it's created/edited right on the Log home screen.
  { id: 'tabs',   ico: '🧭', label: 'Tabs & navigation',  sub: 'pin your bottom tabs + default' },
  { id: 'log',    ico: '📝', label: 'Log screen fields',  sub: 'mood, energy, sleep, reflections…' },
  { id: 'logsec', ico: '🧩', label: 'Log screen sections', sub: 'reorder or hide every card' },
  { id: 'habits', ico: '✅', label: 'Checklist habits',    sub: 'emoji, name, colour, counts & goals' },
  { id: 'sound',  ico: '🔔', label: 'Alarm sound',         sub: 'pick the tone your reminders ring with' },
  { id: 'acts',   ico: '⏱️', label: 'Time activities',    sub: 'one-tap stopwatch activities' },
  { id: 'deep',   ico: '🧠', label: 'Deep log',           sub: 'sections & fields' },
  { id: 'gym',    ico: '💪', label: 'Gym & workouts',     sub: 'exercises, split, groups' },
  { id: 'theme',  ico: '🎨', label: 'Theme colour',       sub: 'app accent colour' },
];
function cfgSectionHTML(page) {
  if (page === 'theme') {
    const curAccent = DB.settings().accent || 'indigo';
    const curMode = DB.settings().mode || 'auto';
    return `<div class="card"><h2>🌗 Appearance</h2>
      <div class="mode-row">${THEME_MODES.map(m => `<button class="mode-btn ${m.id === curMode ? 'on' : ''}" data-thememode="${m.id}">
        <span class="mode-chip" style="background:${m.chip}"></span>${m.label}</button>`).join('')}</div></div>
      <div class="card"><h2>🎨 Accent colour</h2>
      <div class="theme-row">${THEMES.map(t => `<button class="theme-sw ${t.id === curAccent ? 'on' : ''}" data-theme="${t.id}"
        style="background:linear-gradient(135deg,${t.a},${t.b})"></button>`).join('')}</div></div>`;
  }
  if (page === 'tabs') {
    const dt = defaultTab();
    const pinnedCount = navCfg().filter(n => !n.hidden && n.primary).length;
    const navRows = navCfg().map(n => `<div class="cfg-row ${n.hidden ? 'hid' : ''}" data-id="${n.k}">
        <span class="drag-handle" data-drag>⠿</span>
        <span class="cfg-ico">${icon(n.ico, 18)}</span>
        <input class="cfg-name" data-nav-label="${n.k}" value="${escapeHtml(n.label)}">
        <button class="cfg-star ${n.k === dt ? 'on' : ''}" data-nav-default="${n.k}" title="default opening tab">${n.k === dt ? '🎯' : '○'}</button>
        <button class="cfg-pin ${n.primary && !n.hidden ? 'on' : ''}" data-nav-pin="${n.k}" title="show in bottom bar" ${n.hidden ? 'disabled' : ''}>📌</button>
        ${n.noHide ? '<span style="width:24px"></span>' : `<button class="cfg-hide" data-nav-hide="${n.k}">${n.hidden ? '🙈' : '👁'}</button>`}
      </div>`).join('');
    return `<div class="card">
      <h2>🧭 Tabs <span class="hint">📌 pinned ${pinnedCount} · 🎯 default · drag · 👁 hide</span></h2>
      <div id="cfg-nav">${navRows}</div>
      <div class="hint" style="margin-top:8px">Pin as many tabs as you like (4–5 stay easiest to tap) — pinned tabs fill the bottom bar in this order, everything else lives in <b>☰ Menu</b>. 🎯 is the tab the app opens to.</div></div>`;
  }
  if (page === 'sound') {
    const FS = fullScreenPlugin();
    if (!nativeShell() || !FS || !FS.getAlarmSound) {
      return `<div class="card">
        <h2>🔔 Alarm sound</h2>
        <div class="hint">Choosing a tone needs the installed Android app — in a browser tab the alarm uses a built-in beep. Update Daylog in the Play Store, then come back here.</div>
      </div>`;
    }
    const cached = safeParse(localStorage.getItem('dp.alarmSound'), null) || {};
    return `<div class="card">
      <h2>🔔 Alarm sound <span class="hint">what your reminders ring with</span></h2>
      <div class="snd-now">
        <div class="snd-lbl">Current tone</div>
        <div class="snd-name" id="snd-name">${escapeHtml(cached.name || 'Phone default alarm')}</div>
      </div>
      <div class="snd-btns">
        <button class="btn btn-primary btn-sm" id="snd-pick">🎵 Choose sound</button>
        <button class="btn btn-ghost btn-sm" id="snd-play">▶ Preview</button>
        <button class="btn btn-ghost btn-sm" id="snd-stop">⏹ Stop</button>
      </div>
      <div class="at-row" style="margin-top:12px">
        <div class="at-txt"><div class="at-lbl">📳 Vibrate with the alarm</div>
          <div class="at-sub">turn off if you only want sound</div></div>
        <button class="at-tog ${cached.vibrate === false ? '' : 'on'}" data-snd-vib><span class="at-knob"></span></button>
      </div>
      <button class="btn btn-ghost btn-sm" id="snd-reset" style="margin-top:12px">↺ Back to the phone's default alarm</button>
      <div class="hint" style="margin-top:10px">Picks from every alarm tone already on your phone, plus your own audio files — nothing extra to download. The same tone is used whether the full-screen alarm opens or it rings as a notification.</div>
    </div>`;
  }
  if (page === 'logsec') {
    const rows = logSecCfg().map(sec => `<div class="cfg-row ${sec.hidden ? 'hid' : ''}" data-id="${sec.id}">
        <span class="drag-handle" data-drag>⠿</span>
        <div class="cfg-secTxt"><div class="cfg-secLbl">${escapeHtml(sec.label)}</div><div class="cfg-secSub">${escapeHtml(sec.sub || '')}</div></div>
        ${sec.lock ? '<span class="cfg-lock" title="always shown">🔒</span>'
                   : `<button class="cfg-hide" data-logsec-hide="${sec.id}">${sec.hidden ? '🙈' : '👁'}</button>`}
      </div>`).join('');
    return `<div class="card">
      <h2>🧩 Log screen sections <span class="hint">drag · 👁 hide</span></h2>
      <div id="cfg-logsec">${rows}</div>
      <div class="hint" style="margin-top:8px">This is the order the cards appear in on your Log. Hide anything you don't use — nothing is deleted, and your saved data stays. Date &amp; main fields can be reordered but not hidden, since that's where the entry itself lives.</div>
      <button class="btn btn-ghost btn-sm" id="logsec-reset" style="margin-top:10px">↺ Reset to default order</button>
    </div>`;
  }
  if (page === 'log') {
    return `<div class="card">
      <h2>📝 Log screen fields <span class="hint">rename · hide — incl. reflection questions</span></h2>
      ${coreCfg().map(f => `<div class="cfg-row ${f.hidden ? 'hid' : ''}">
        <span class="cfg-type">${f.type === 'scale' ? '1-10' : f.type === 'num' ? '123' : 'Aa'}</span>
        <input class="cfg-name" data-core-label="${f.key}" value="${escapeHtml(f.label)}">
        <button class="cfg-hide" data-core-hide="${f.key}">${f.hidden ? '🙈' : '👁'}</button>
      </div>`).join('')}
      <div class="hint" style="margin-top:8px">Covers mood, energy, sleep, deep-work, tasks and the reflection/journal questions. Hidden fields leave the Log screen but keep their history.</div></div>`;
  }
  if (page === 'habits') {
    return `<div class="card">
      <h2>✅ Daily checklist habits <span class="hint">emoji · name · color · 👁 · drag</span></h2>
      <div id="cfg-habits">${habitCfg().map(h => cfgRow('h', h, !!h.custom)).join('')}</div>
      <div class="task-add">
        <input type="text" id="cfg-new-habit" placeholder="New habit… (e.g. 🌅 Wake at 6)" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="cfg-add-habit">Add</button>
      </div>
      <div class="hint" style="margin-top:8px">Hidden habits keep their history. Custom habits sync between devices; the Google-Sheet Log columns stay fixed.</div></div>`;
  }
  if (page === 'acts') {
    return `<div class="card">
      <h2>⏱ Time activities <span class="hint">emoji · name · color · 👁</span></h2>
      <div id="cfg-acts">${actCfg().map(a => cfgRow('a', a, false)).join('')}${DB.timeacts().map(a => cfgRow('c', a, true)).join('')}</div>
      <div class="task-add">
        <input type="text" id="cfg-new-act" placeholder="New activity… (e.g. 🍳 Cooking)" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="cfg-add-act">Add</button>
      </div></div>`;
  }
  if (page === 'deep') {
    return `<div class="card">
      <h2>🧠 Deep log sections <span class="hint">rename · hide · add fields & sections</span></h2>
      ${deepCfg().map(sec => deepSecEditor(sec)).join('')}
      <div class="task-add" style="margin-top:10px">
        <input type="text" id="cfg-new-deepsec" placeholder="New section… (e.g. 🎸 Music practice)" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="cfg-add-deepsec">Add</button>
      </div>
      <div class="hint" style="margin-top:8px">New fields show on the Log screen; scale (1-10) fields also appear in Stats. Sheet Log columns stay fixed — custom fields live in the app + device sync.</div></div>`;
  }
  if (page === 'gym') {
    const daySplit = gymDays().map(d => `<div class="cfg-row">
        <input class="cfg-name" style="flex:0 0 72px" data-day-name="${d.id}" value="${escapeHtml(d.name)}">
        <select data-day-main="${d.id}">${allGroups().filter(g => !['cardio','abs','side','core'].includes(g.id)).map(g =>
          `<option value="${g.id}" ${g.id === d.main ? 'selected' : ''}>${g.emoji} ${escapeHtml(g.name)}</option>`).join('')}</select>
        <select data-day-ab="${d.id}" style="flex:0 0 92px">${['abs','side','core'].map(id => { const g = groupById(id);
          return `<option value="${id}" ${id === d.ab ? 'selected' : ''}>${g.emoji} ${escapeHtml(g.name)}</option>`; }).join('')}</select>
      </div>`).join('');
    return `<div class="card">
      <h2>🗓 6-day split <span class="hint">rename days · pick groups</span></h2>
      ${daySplit}
      <div class="task-add" style="margin-top:10px">
        <input type="text" id="cfg-new-group" placeholder="New muscle group… (e.g. 🧗 Forearms)" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="cfg-add-group">Add</button>
      </div></div>
      <div class="card">
      <h2>🏋️ Gym workouts <span class="hint">rename · sets · hide · add exercises</span></h2>
      ${allGroups().map(g => gymGroupEditor(g)).join('')}</div>`;
  }
  return '';
}
function renderCustom() {
  const el = document.getElementById('s-custom');
  if (!customPage) {
    document.getElementById('screen-title').textContent = 'Customize';
    document.getElementById('screen-sub').textContent = 'Make Daylog yours';
    el.innerHTML = `<button class="back-btn" id="custom-back">← Back to Settings</button>
      <div class="card" style="padding:6px 10px">
        ${CUSTOM_PAGES.map(p => `<button class="menu-row" data-custompage="${p.id}">
          <span class="menu-ico">${p.ico}</span>
          <span class="menu-txt"><span class="menu-lbl">${p.label}</span><span class="menu-sub">${p.sub}</span></span>
          <span class="menu-go">›</span></button>`).join('')}
      </div>`;
    return;
  }
  const page = CUSTOM_PAGES.find(p => p.id === customPage);
  document.getElementById('screen-title').textContent = page ? page.label : 'Customize';
  document.getElementById('screen-sub').textContent = 'Customize';
  el.innerHTML = `<button class="back-btn" id="custom-back">← All settings</button>${cfgSectionHTML(customPage)}`;
  if (customPage === 'habits') enableDrag(document.getElementById('cfg-habits'), ids => {
    const cfg = habitCfg(); saveHabitCfg(ids.map(id => cfg.find(h => h.key === id)).filter(Boolean)); renderCustom();
  });
  if (customPage === 'sound') refreshAlarmSound();
  if (customPage === 'logsec') enableDrag(document.getElementById('cfg-logsec'), ids => {
    const cur = logSecCfg();
    saveLogSec(ids.map(id => cur.find(x => x.id === id)).filter(Boolean));
    renderCustom();
  });
  if (customPage === 'tabs') enableDrag(document.getElementById('cfg-nav'), ids => {
    const cfg = navCfg(); saveNavCfg(ids.map(id => cfg.find(n => n.k === id)).filter(Boolean)); renderCustom();
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
  const isCustomSec = sec.id.indexOf('cs') === 0;
  return `<details class="cfg-sec" data-cfgsec="deep:${sec.id}" ${openCfgSecs.has('deep:' + sec.id) ? 'open' : ''}>
    <summary><span>${escapeHtml(sec.title)}</span><button class="cfg-hide" data-dsec-hide="${sec.id}">${sec.hidden ? '🙈' : '👁'}</button>${isCustomSec ? `<button class="del" data-dsec-del="${sec.id}">×</button>` : ''}</summary>
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
  const cp = ev.target.closest('[data-custompage]');
  if (cp) { customPage = cp.dataset.custompage; renderCustom(); window.scrollTo(0, 0); return; }
  if (ev.target.id === 'custom-back') { if (customPage) { customPage = null; renderCustom(); window.scrollTo(0, 0); } else show('settings'); return; }
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
    const em = emojiSplit(name); acts.push({ id: 'ta' + Date.now(), emoji: em.emoji, name: em.name, color: CUSTOM_ACT_COLORS[acts.length % CUSTOM_ACT_COLORS.length] });
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
  if (ev.target.id === 'cfg-add-deepsec') {
    const raw = (document.getElementById('cfg-new-deepsec').value || '').trim(); if (!raw) return;
    const m = raw.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u);
    const title = (m && m[2]) ? (m[1] + ' ' + m[2]) : raw;
    const id = 'cs' + Date.now();
    const cfg = deepCfg();
    cfg.push({ id, title, scales: [], nums: [], texts: [], custom: true });
    openCfgSecs.add('deep:' + id);   // open it so the user can add fields right away
    saveDeepCfg(cfg); renderCustom(); toast('Section added — now add fields'); return; }
  const dsd = ev.target.closest('[data-dsec-del]');
  if (dsd) { ev.preventDefault();
    if (!confirm('Delete this whole section and its fields? Logged history stays.')) return;
    saveDeepCfg(deepCfg().filter(s => s.id !== dsd.dataset.dsecDel)); renderCustom(); return; }

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
  const tm = ev.target.closest('[data-thememode]');
  if (tm) { const s = DB.settings(); s.mode = tm.dataset.thememode; DB.saveSettings(s); applyTheme(); renderCustom(); return; }
  const nh = ev.target.closest('[data-nav-hide]');
  if (nh) { const cfg = navCfg(); const n = cfg.find(x => x.k === nh.dataset.navHide);
    if (n && !n.noHide) { n.hidden = !n.hidden;
      if (n.hidden) n.primary = false;
      saveNavCfg(cfg); renderCustom(); } return; }
  const np = ev.target.closest('[data-nav-pin]');
  if (np) { const cfg = navCfg(); const n = cfg.find(x => x.k === np.dataset.navPin); if (!n || n.hidden) return;
    n.primary = !n.primary; saveNavCfg(cfg); renderCustom();
    if (n.primary && cfg.filter(x => !x.hidden && x.primary).length > 5) toast('Tip: 4–5 pinned tabs stay easiest to tap');
    return; }
  const nd = ev.target.closest('[data-nav-default]');
  if (nd) { const s = DB.settings(); s.defaultTab = nd.dataset.navDefault; DB.saveSettings(s); renderCustom(); toast('Default tab set'); return; }
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
   SCREEN: FOCUS  (Pomodoro timer + Timebox planner)
   Pomodoro: focus/break cycles with an offline native alarm at each
   phase end; optionally logs focus time to a Time-tracker activity.
   Timebox: plan today's blocks (time range + label), optional start
   alarm, and "start now" to kick off the matching timer.
   ============================================================ */
const POMO_DEFAULTS = { focus: 25, short: 5, long: 15, rounds: 4, auto: true, act: '' };
function pomoState() {
  const p = DB.pomo();
  if (p && p.cfg) return p;
  return { cfg: Object.assign({}, POMO_DEFAULTS), run: null, done: { d: todayStr(), n: 0 } };
}
let focusMode = 'pomo';   // 'pomo' | 'timebox'
const POMO_NOTIF_ID = 750;

function pomoDoneToday(p) { return (p.done && p.done.d === todayStr()) ? p.done.n : 0; }
function phaseName(ph) { return ph === 'focus' ? 'Focus' : ph === 'long' ? 'Long break' : 'Short break'; }
function phaseMin(cfg, ph) { return ph === 'focus' ? cfg.focus : ph === 'long' ? cfg.long : cfg.short; }

async function schedulePomoAlarm(endsAt, label) {
  if (!nativeShell()) return;
  const LN = window.Capacitor.Plugins.LocalNotifications;
  try {
    await LN.cancel({ notifications: [{ id: POMO_NOTIF_ID }] });
    if (!endsAt || endsAt <= Date.now() + 500) return;
    await LN.schedule({ notifications: [{ id: POMO_NOTIF_ID, title: '🍅 ' + label,
      body: label === 'Focus' ? 'Focus done — time for a break ☕' : 'Break over — back to focus 💪',
      schedule: { at: new Date(endsAt), allowWhileIdle: true }, sound: 'default' }] });
  } catch (e) {}
}
function cancelPomoAlarm() { if (nativeShell()) { try { window.Capacitor.Plugins.LocalNotifications.cancel({ notifications: [{ id: POMO_NOTIF_ID }] }); } catch (e) {} } }

function pomoStart(ph) {
  const p = pomoState();
  const mins = phaseMin(p.cfg, ph);
  const endsAt = Date.now() + mins * 60000;
  p.run = { phase: ph, endsAt, round: (p.run && ph !== 'focus') ? p.run.round : (p.run ? p.run.round : 1) };
  DB.savePomo(p);
  if (ph === 'focus' && p.cfg.act) { const r = runningSeg(); if (!r || r.act !== p.cfg.act) startAct(p.cfg.act); }
  else if (p.cfg.act) { const r = runningSeg(); if (r && r.act === p.cfg.act) startAct(r.act); }   // stop timing on break
  schedulePomoAlarm(endsAt, phaseName(ph));
  renderFocus();
}
function pomoAdvance(silent) {
  const p = pomoState();
  if (!p.run) return;
  const wasFocus = p.run.phase === 'focus';
  let round = p.run.round;
  if (wasFocus) {
    p.done = { d: todayStr(), n: pomoDoneToday(p) + 1 };
    // keep a per-day history (p.done only remembers today) so Stats can chart focus sessions
    try { const ph = safeParse(localStorage.getItem('dp.pomohist'), {}); ph[todayStr()] = p.done.n; localStorage.setItem('dp.pomohist', JSON.stringify(ph)); } catch (_) {}
    const next = (round >= p.cfg.rounds) ? 'long' : 'short';
    if (next === 'long') round = 1; else round = round + 1;
    p.run = { phase: next, endsAt: Date.now() + phaseMin(p.cfg, next) * 60000, round };
  } else {
    p.run = { phase: 'focus', endsAt: Date.now() + p.cfg.focus * 60000, round };
  }
  DB.savePomo(p);
  if (silent) { if (!p.cfg.auto) pomoPause(); return; }   // catch-up: just fix state, no side effects/recursion
  // time-tracker link
  if (p.cfg.act) { const r = runningSeg();
    if (p.run.phase === 'focus') { if (!r || r.act !== p.cfg.act) startAct(p.cfg.act); }
    else if (r && r.act === p.cfg.act) startAct(r.act); }
  schedulePomoAlarm(p.run.endsAt, phaseName(p.run.phase));
  try { pomoChime(); } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([300, 120, 300]);
  toast(p.run.phase === 'focus' ? '💪 Focus time!' : '☕ Break time!');
  if (!p.cfg.auto) { pomoPause(); return; }   // if not auto, land paused on the new phase
  renderFocus();
}
function pomoPause() {
  const p = pomoState(); if (!p.run) return;
  p.run.paused = true; p.run.remain = Math.max(0, p.run.endsAt - Date.now());
  DB.savePomo(p); cancelPomoAlarm();
  if (p.cfg.act) { const r = runningSeg(); if (r && r.act === p.cfg.act) startAct(r.act); }
  renderFocus();
}
function pomoResume() {
  const p = pomoState(); if (!p.run || !p.run.paused) return;
  p.run.endsAt = Date.now() + (p.run.remain || 0); p.run.paused = false;
  DB.savePomo(p);
  if (p.run.phase === 'focus' && p.cfg.act) { const r = runningSeg(); if (!r || r.act !== p.cfg.act) startAct(p.cfg.act); }
  schedulePomoAlarm(p.run.endsAt, phaseName(p.run.phase));
  renderFocus();
}
function pomoReset() {
  const p = pomoState();
  if (p.cfg.act) { const r = runningSeg(); if (r && r.act === p.cfg.act) startAct(r.act); }
  p.run = null; DB.savePomo(p); cancelPomoAlarm(); renderFocus();
}
let _pomoAC;
function pomoChime() {
  _pomoAC = _pomoAC || new (window.AudioContext || window.webkitAudioContext)();
  if (_pomoAC.state === 'suspended') _pomoAC.resume();
  [880, 1174, 1568].forEach((f, i) => { const o = _pomoAC.createOscillator(), g = _pomoAC.createGain(), t = _pomoAC.currentTime + i * 0.16;
    o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(_pomoAC.destination); o.start(t); o.stop(t + 0.42); });
}

function renderFocus() {
  document.getElementById('screen-title').textContent = 'Focus';
  // Reconcile phases that elapsed while away — a SILENT bounded loop (no per-phase
  // chime/toast/segments and, crucially, no recursion back into renderFocus).
  let rp = pomoState(), guard = 0, advanced = false;
  while (rp.run && !rp.run.paused && Date.now() >= rp.run.endsAt && guard++ < 1000) { pomoAdvance(true); rp = pomoState(); advanced = true; }
  if (advanced) {
    const fp = pomoState();
    if (fp.run && !fp.run.paused) schedulePomoAlarm(fp.run.endsAt, phaseName(fp.run.phase));   // one alarm for the final phase
    try { pomoChime(); } catch (e) {}
    if (navigator.vibrate) navigator.vibrate([300, 120, 300]);
  }
  const p = pomoState();
  document.getElementById('screen-sub').textContent = focusMode === 'pomo' ? '🍅 Pomodoro' : '📦 Timebox — plan your day';
  document.getElementById('s-focus').innerHTML = `
    <div class="focus-toggle">
      <button class="ftog ${focusMode==='pomo'?'on':''}" data-focusmode="pomo">🍅 Pomodoro</button>
      <button class="ftog ${focusMode==='timebox'?'on':''}" data-focusmode="timebox">📦 Timebox</button>
    </div>
    ${focusMode === 'pomo' ? pomoHTML(p) : timeboxHTML()}`;
}

function pomoHTML(p) {
  const run = p.run;
  const total = run ? phaseMin(p.cfg, run.phase) * 60000 : p.cfg.focus * 60000;
  const remain = run ? (run.paused ? (run.remain || 0) : Math.max(0, run.endsAt - Date.now())) : p.cfg.focus * 60000;
  const mm = String(Math.floor(remain / 60000)).padStart(2, '0');
  const ss = String(Math.floor(remain % 60000 / 1000)).padStart(2, '0');
  const pct = total ? (1 - remain / total) : 0;
  const R = 120, C = 2 * Math.PI * R;
  const phase = run ? run.phase : 'focus';
  const ring = phase === 'focus' ? 'var(--accent)' : 'var(--good)';
  const acts = allActs();
  const actOpts = `<option value="">— no activity —</option>` + acts.map(a => `<option value="${a.id}" ${p.cfg.act===a.id?'selected':''}>${a.emoji} ${escapeHtml(a.name)}</option>`).join('');
  return `
    <div class="card pomo-card">
      <div class="pomo-phase" style="color:${ring}">${run ? phaseName(run.phase) : 'Ready'} ${run ? `· round ${run.round}/${p.cfg.rounds}` : ''}</div>
      <div class="pomo-ring-wrap">
        <svg viewBox="0 0 300 300" class="pomo-ring">
          <circle cx="150" cy="150" r="${R}" fill="none" stroke="var(--bg-input)" stroke-width="16"/>
          <circle cx="150" cy="150" r="${R}" fill="none" stroke="${ring}" stroke-width="16" stroke-linecap="round"
            stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}" transform="rotate(-90 150 150)" style="transition:stroke-dashoffset .5s"/>
        </svg>
        <div class="pomo-time">${mm}:${ss}</div>
      </div>
      <div class="pomo-controls">
        ${!run ? `<button class="btn btn-primary" data-pomo="start-focus">▶ Start focus</button>`
          : run.paused ? `<button class="btn btn-primary" data-pomo="resume">▶ Resume</button><button class="btn btn-ghost" data-pomo="reset">Reset</button>`
          : `<button class="btn btn-ghost" data-pomo="pause">⏸ Pause</button><button class="btn btn-ghost" data-pomo="skip">⏭ Skip</button><button class="btn btn-ghost" data-pomo="reset">⏹</button>`}
      </div>
      <div class="pomo-done">🍅 <b>${pomoDoneToday(p)}</b> completed today</div>
    </div>
    <div class="card">
      <h2>Settings</h2>
      <div class="field"><label>Log focus time to activity</label>
        <select data-pomo-act>${actOpts}</select></div>
      <div class="row2">
        <div class="field"><label>Focus (min)</label><input type="number" inputmode="numeric" data-pomo-cfg="focus" value="${p.cfg.focus}"></div>
        <div class="field"><label>Short break</label><input type="number" inputmode="numeric" data-pomo-cfg="short" value="${p.cfg.short}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Long break</label><input type="number" inputmode="numeric" data-pomo-cfg="long" value="${p.cfg.long}"></div>
        <div class="field"><label>Rounds → long break</label><input type="number" inputmode="numeric" data-pomo-cfg="rounds" value="${p.cfg.rounds}"></div>
      </div>
      <label class="ev-alarm-row"><input type="checkbox" data-pomo-cfg="auto" ${p.cfg.auto?'checked':''}> Auto-start the next phase</label>
      <div class="hint" style="margin-top:8px">A native alarm rings at each phase end — even with the app closed.</div>
    </div>`;
}

function timeboxHTML() {
  const today = todayStr();
  const blocks = DB.timebox().filter(b => b.date === today).sort((a, b) => (a.start || '') < (b.start || '') ? -1 : 1);
  const now = new Date(); const curMin = now.getHours() * 60 + now.getMinutes();
  const toMin = t => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
  const rows = blocks.map(b => {
    const act = b.act ? actById(b.act) : null;
    const live = curMin >= toMin(b.start) && curMin < toMin(b.end);
    return `<div class="tb-row ${live?'live':''}" data-id="${b.id}" style="${act?`border-left:3px solid ${act.color}`:''}">
      <div class="tb-time">${b.start}<span>${b.end}</span></div>
      <div class="tb-main"><div class="tb-label">${act?act.emoji+' ':''}${escapeHtml(b.label)} ${b.alarm?'⏰':''}</div>
        ${live?'<div class="tb-now">● now</div>':''}</div>
      ${act ? `<button class="btn btn-ghost btn-sm" data-tb-start="${b.id}">▶</button>` : ''}
      <button class="del" data-tb-del="${b.id}">×</button>
    </div>`;
  }).join('');
  return `
    <div class="card">
      <h2>Today's plan <span class="hint">${prettyDate(today)}</span></h2>
      <div id="tb-list">${blocks.length ? rows : '<div class="empty">No blocks planned. Add one below 👇</div>'}</div>
    </div>
    <div class="card">
      <h2>Add a block</h2>
      <div class="row2">
        <div class="field"><label>Start</label><input type="time" id="tb-start" value="09:00"></div>
        <div class="field"><label>End</label><input type="time" id="tb-end" value="10:00"></div>
      </div>
      <div class="field"><label>What for?</label><input type="text" id="tb-label" placeholder="e.g. Deep work — report" autocomplete="off"></div>
      <div class="field"><label>Activity (optional — enables ▶ start)</label>
        <select id="tb-act"><option value="">— none —</option>${allActs().map(a=>`<option value="${a.id}">${a.emoji} ${escapeHtml(a.name)}</option>`).join('')}</select></div>
      <label class="ev-alarm-row"><input type="checkbox" id="tb-alarm" checked> ⏰ Alarm at start time</label>
      <button class="btn btn-primary" id="tb-add" style="margin-top:12px">Add block</button>
    </div>`;
}

async function scheduleTimeboxAlarms() {
  if (!nativeShell()) return;
  const LN = window.Capacitor.Plugins.LocalNotifications;
  try {
    // ids 800..830 reserved for timebox
    const cancels = []; for (let i = 800; i < 831; i++) cancels.push({ id: i });
    await LN.cancel({ notifications: cancels });
    const now = Date.now(); let id = 800;
    DB.timebox().filter(b => b.alarm && b.start).forEach(b => {
      if (id > 830) return;
      const at = new Date(b.date + 'T' + b.start + ':00');
      if (isNaN(at.getTime()) || at.getTime() <= now) return;
      LN.schedule({ notifications: [{ id: id++, title: '📦 ' + b.label, body: 'Time-box starting (' + b.start + ')',
        schedule: { at, allowWhileIdle: true }, sound: 'default' }] });
    });
  } catch (e) {}
}

document.addEventListener('click', (ev) => {
  const sf = document.getElementById('s-focus');
  if (!sf || !sf.classList.contains('on')) return;
  const fm = ev.target.closest('[data-focusmode]');
  if (fm) { focusMode = fm.dataset.focusmode; renderFocus(); return; }
  const pc = ev.target.closest('[data-pomo]');
  if (pc) { const a = pc.dataset.pomo;
    if (a === 'start-focus') pomoStart('focus');
    else if (a === 'pause') pomoPause();
    else if (a === 'resume') pomoResume();
    else if (a === 'skip') pomoAdvance();
    else if (a === 'reset') pomoReset();
    return; }
  if (ev.target.id === 'tb-add') {
    const start = document.getElementById('tb-start').value, end = document.getElementById('tb-end').value;
    const label = (document.getElementById('tb-label').value || '').trim();
    const act = document.getElementById('tb-act').value, alarm = document.getElementById('tb-alarm').checked;
    if (!label) { toast('Name the block', true); return; }
    if (!start || !end) { toast('Set start and end', true); return; }
    const tb = DB.timebox();
    tb.push({ id: 'tb' + Date.now(), date: todayStr(), start, end, label, act, alarm });
    DB.saveTimebox(tb); scheduleTimeboxAlarms(); renderFocus(); toast('Block added 📦'); return;
  }
  const ts = ev.target.closest('[data-tb-start]');
  if (ts) { const b = DB.timebox().find(x => x.id === ts.dataset.tbStart); if (b && b.act) { startAct(b.act); toast('▶ ' + actById(b.act).name + ' started'); } return; }
  const td = ev.target.closest('[data-tb-del]');
  if (td) { DB.saveTimebox(DB.timebox().filter(x => x.id !== td.dataset.tbDel)); scheduleTimeboxAlarms(); renderFocus(); return; }
});
document.addEventListener('change', (ev) => {
  const pa = ev.target.closest('[data-pomo-act]');
  if (pa) { const p = pomoState(); p.cfg.act = pa.value; DB.savePomo(p); return; }
  const pcfg = ev.target.closest('[data-pomo-cfg]');
  if (pcfg) { const p = pomoState(); const k = pcfg.dataset.pomoCfg;
    p.cfg[k] = (k === 'auto') ? pcfg.checked : Math.max(1, +pcfg.value || POMO_DEFAULTS[k]);
    DB.savePomo(p); return; }
});
/* 1-second tick to update the countdown while the Focus screen is open */
setInterval(() => {
  const sf = document.getElementById('s-focus');
  if (!sf || !sf.classList.contains('on') || focusMode !== 'pomo') return;
  const p = pomoState(); if (!p.run || p.run.paused) return;
  if (Date.now() >= p.run.endsAt) { pomoAdvance(); return; }
  const remain = Math.max(0, p.run.endsAt - Date.now());
  const el = sf.querySelector('.pomo-time');
  if (el) el.textContent = String(Math.floor(remain / 60000)).padStart(2, '0') + ':' + String(Math.floor(remain % 60000 / 1000)).padStart(2, '0');
  const total = phaseMin(p.cfg, p.run.phase) * 60000, C = 2 * Math.PI * 120;
  const ring = sf.querySelector('.pomo-ring circle:last-child');
  if (ring) ring.setAttribute('stroke-dashoffset', (C * (remain / total)).toFixed(1));
}, 1000);

/* ============================================================
   SCREEN: WAVES  (binaural-beat brainwave generator, offline Web Audio)
   Two pure tones a few Hz apart — one per ear — create a perceived "beat"
   at the difference frequency. Needs headphones. Wellness aid, not medicine.
   ============================================================ */
const WAVE_PRESETS = [
  { id: 'delta', emoji: '😴', name: 'Delta', hz: 2.5, use: 'Deep sleep & rest', color: '#a78bfa' },
  { id: 'theta', emoji: '🧘', name: 'Theta', hz: 6,   use: 'Meditation & creativity', color: '#22d3ee' },
  { id: 'alpha', emoji: '🌊', name: 'Alpha', hz: 10,  use: 'Relaxed calm focus', color: '#34d399' },
  { id: 'beta',  emoji: '⚡', name: 'Beta',  hz: 18,  use: 'Alert & productive', color: '#6d8cff' },
  { id: 'gamma', emoji: '🚀', name: 'Gamma', hz: 40,  use: 'Peak concentration', color: '#fb923c' },
];
let _waveCtx = null, _waveNodes = null, _wavePlaying = null, _waveTimer = null, _waveEndsAt = 0;
function waveSettings() { return Object.assign({ carrier: 200, vol: 0.25, minutes: 0 }, safeParse(localStorage.getItem('dp.waves'), {})); }
function saveWaveSettings(w) { localStorage.setItem('dp.waves', JSON.stringify(w)); }
function wavesStop() {
  if (_waveNodes) { try { _waveNodes.oL.stop(); _waveNodes.oR.stop(); } catch (_) {} _waveNodes = null; }
  _wavePlaying = null; clearTimeout(_waveTimer); _waveTimer = null; _waveEndsAt = 0;
}
function wavesStart(preset) {
  const w = waveSettings();
  try {
    _waveCtx = _waveCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (_waveCtx.state === 'suspended') _waveCtx.resume();
  } catch (e) { toast('Audio not supported here', true); return; }
  wavesStop();
  const ctx = _waveCtx;
  const merger = ctx.createChannelMerger(2);
  const gain = ctx.createGain(); gain.gain.value = Math.max(0.01, Math.min(0.5, w.vol));
  const oL = ctx.createOscillator(); oL.type = 'sine'; oL.frequency.value = w.carrier;
  const oR = ctx.createOscillator(); oR.type = 'sine'; oR.frequency.value = w.carrier + preset.hz;
  oL.connect(merger, 0, 0); oR.connect(merger, 0, 1);
  merger.connect(gain); gain.connect(ctx.destination);
  oL.start(); oR.start();
  _waveNodes = { oL, oR, gain, merger }; _wavePlaying = preset.id;
  if (w.minutes > 0) { _waveEndsAt = Date.now() + w.minutes * 60000; _waveTimer = setTimeout(() => { wavesStop(); if (isOn('waves')) renderWaves(); toast('Waves ended'); }, w.minutes * 60000); }
  renderWaves();
}
function isOn(name) { const el = document.getElementById('s-' + name); return el && el.classList.contains('on'); }
function renderWaves() {
  document.getElementById('screen-title').textContent = 'Waves';
  document.getElementById('screen-sub').textContent = _wavePlaying ? '▶ playing — headphones on 🎧' : 'Binaural beats · needs headphones 🎧';
  const w = waveSettings();
  const cards = WAVE_PRESETS.map(p => {
    const on = _wavePlaying === p.id;
    return `<button class="wave-card ${on ? 'on' : ''}" data-wave="${p.id}" style="--c:${p.color}">
      <span class="wave-emoji">${p.emoji}</span>
      <span class="wave-name">${p.name} <span class="wave-hz">${p.hz} Hz</span></span>
      <span class="wave-use">${p.use}</span>
      <span class="wave-state">${on ? '⏸ Stop' : '▶ Play'}</span></button>`;
  }).join('');
  const mins = [0, 10, 20, 30, 60];
  document.getElementById('s-waves').innerHTML = `
    <div class="card">
      <div class="hint">🎧 <b>Use headphones</b> — the effect comes from a slightly different tone in each ear. A gentle wellness aid for focus, calm or sleep (not a medical treatment).</div>
    </div>
    <div class="wave-grid">${cards}</div>
    <div class="card">
      <h2>Settings</h2>
      <div class="field"><label>Auto-stop after</label>
        <div class="range-row">${mins.map(m => `<button class="range-btn ${w.minutes===m?'on':''}" data-wave-min="${m}">${m===0?'∞':m+'m'}</button>`).join('')}</div></div>
      <div class="field"><label>Volume</label>
        <input type="range" min="1" max="50" value="${Math.round(w.vol*100)}" data-wave-vol style="width:100%"></div>
      <div class="hint">Base tone ${w.carrier} Hz. Binaural beats are a relaxation aid — if you feel any discomfort, stop.</div>
    </div>`;
}
document.addEventListener('click', (ev) => {
  if (!isOn('waves')) return;
  const wc = ev.target.closest('[data-wave]');
  if (wc) { const p = WAVE_PRESETS.find(x => x.id === wc.dataset.wave);
    if (_wavePlaying === p.id) { wavesStop(); renderWaves(); } else wavesStart(p); return; }
  const wm = ev.target.closest('[data-wave-min]');
  if (wm) { const s = waveSettings(); s.minutes = +wm.dataset.waveMin; saveWaveSettings(s);
    if (_wavePlaying) { const p = WAVE_PRESETS.find(x => x.id === _wavePlaying); wavesStart(p); } else renderWaves(); return; }
});
document.addEventListener('input', (ev) => {
  const wv = ev.target.closest('[data-wave-vol]');
  if (wv) { const s = waveSettings(); s.vol = (+wv.value) / 100; saveWaveSettings(s);
    if (_waveNodes) _waveNodes.gain.gain.value = Math.max(0.01, Math.min(0.5, s.vol)); }
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
    if (alarm && !time) { toast('Set a time for the alarm (or untick it)', true); return; }   // an alarm with no time can never ring
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
  document.getElementById('screen-title').textContent = 'Settings';
  document.getElementById('screen-sub').textContent = 'Customize, reminders, data';
  const s = DB.settings();
  // Sync UI hidden for production: the Data Safety answer is "collects no data", and a
  // visible sync/login section would contradict it. Sync returns as the paid feature
  // (Google Sign-In + pay-what-you-want) — see the wiki roadmap. Existing sync users'
  // saved syncUrl keeps working silently; only the UI is hidden.
  const SHOW_SYNC = false;
  if (!s.ntfyTopic) { s.ntfyTopic = 'dp-' + randomToken(); DB.saveSettings(s); }   // one secret topic per user
  document.getElementById('s-settings').innerHTML = `
    <div class="card" style="padding:6px 10px">
      <button class="menu-row" id="open-custom"><span class="menu-ico">🎨</span>
        <span class="menu-txt"><span class="menu-lbl">Customize</span><span class="menu-sub">tabs, habits, log fields, gym, deep log, theme</span></span><span class="menu-go">›</span></button>
      <button class="menu-row" id="open-report"><span class="menu-ico">📄</span>
        <span class="menu-txt"><span class="menu-lbl">Download report (PDF)</span><span class="menu-sub">your full stats as a printable report</span></span><span class="menu-go">›</span></button>
      <button class="menu-row" id="open-tour"><span class="menu-ico">🎓</span>
        <span class="menu-txt"><span class="menu-lbl">Take the app tour</span><span class="menu-sub">60-second guided walkthrough</span></span><span class="menu-go">›</span></button>
      <a class="menu-row" href="guide.html"><span class="menu-ico">📖</span>
        <span class="menu-txt"><span class="menu-lbl">How to use Daylog</span><span class="menu-sub">a quick illustrated tour</span></span><span class="menu-go">›</span></a>
    </div>
    <div class="card">
      <h2>💬 Feedback <span class="hint">private · no sign-in</span></h2>
      <div class="field"><textarea id="fb-text" placeholder="What's confusing? What's missing? What do you love?" style="min-height:70px"></textarea></div>
      <div class="btn-row"><button class="btn btn-primary btn-sm" id="fb-send">Send feedback</button></div>
      <div class="hint" style="margin-top:8px">Goes straight to the developer — no email or account needed.</div>
    </div>
    ${SHOW_SYNC ? `<div class="card">
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
    </div>` : ''}
    ${(() => { const at = autoTrackCfg();
      const row = (k, label, sub) => `<div class="at-row ${at.on ? '' : 'at-dim'}">
        <div class="at-txt"><div class="at-lbl">${label}</div>${sub ? `<div class="at-sub">${sub}</div>` : ''}</div>
        <button class="at-tog ${at[k] ? 'on' : ''}" data-at-toggle="${k}" ${!at.on && k !== 'on' ? 'disabled' : ''}><span class="at-knob"></span></button>
      </div>`;
      return `<div class="card">
      <h2>📈 Auto-tracking <span class="hint">${hcPlugin() ? 'from your phone' : 'coming in a Play update'}</span></h2>
      <div class="at-row">
        <div class="at-txt"><div class="at-lbl"><b>Auto health tracking</b></div><div class="at-sub">master switch — off = nothing is collected</div></div>
        <button class="at-tog ${at.on ? 'on' : ''}" data-at-toggle="on"><span class="at-knob"></span></button>
      </div>
      ${row('sleep', '😴 Sleep', 'auto-fills your sleep from the phone')}
      ${row('steps', '👟 Steps & distance', '')}
      ${row('calories', '🔥 Calories', '')}
      ${row('workouts', '🏃 Workouts / cardio', 'active minutes & sessions')}
      ${row('hr', '❤️ Heart rate', 'needs a watch/band')}
      ${row('screentime', '📱 Screen time', 'daily phone usage')}
      <div class="hint" style="margin-top:8px">Everything stays on your phone. Sensor data needs the Play-update version of the app; these switches control what it's allowed to collect.</div>
    </div>`; })()}
    ${(() => {
      // Every widget with a "hide" link must be re-enableable here, or hiding it is a
      // one-way door. Stored flags are inverted (dp.*Off), so the switch shows !flag.
      const secRow = (id, label, sub) => { const on = !logSecHidden(id);
        return `<div class="at-row">
          <div class="at-txt"><div class="at-lbl">${label}</div>${sub ? `<div class="at-sub">${sub}</div>` : ''}</div>
          <button class="at-tog ${on ? 'on' : ''}" data-sec-toggle="${id}"><span class="at-knob"></span></button>
        </div>`; };
      const flagRow = (flag, label, sub) => { const on = localStorage.getItem(flag) !== '1';
        return `<div class="at-row">
          <div class="at-txt"><div class="at-lbl">${label}</div>${sub ? `<div class="at-sub">${sub}</div>` : ''}</div>
          <button class="at-tog ${on ? 'on' : ''}" data-widget-toggle="${flag}"><span class="at-knob"></span></button>
        </div>`; };
      return `<div class="card">
        <h2>🎛 Log screen widgets <span class="hint">show or hide</span></h2>
        ${secRow('ring', '🎯 Today ring', "how much of today you've logged")}
        ${secRow('onthisday', '🕰 On this day', 'your entry from a week / month / year ago')}
        ${secRow('moodgrid', '🎨 Mood grid', 'set mood and energy with one tap')}
        ${flagRow('dp.hapticsOff', '📳 Haptic buzz', 'a short vibration when you complete something')}
        <div class="hint" style="margin-top:8px">To reorder or hide <b>any</b> Log card — tasks, checklist, workout, reflection, deep log — use <b>Customize ▸ Log screen sections</b>.</div>
      </div>`; })()}
    ${alarmHealthHTML()}
    <div class="card">
      <h2>⏰ Reminders <span class="hint">${DB.reminders().length} set</span></h2>
      ${DB.reminders().length ? DB.reminders().map(r => `
        <div class="rem ${r.enabled?'':'off'}" data-remid="${r.id}">
          <div class="rem-top">
            <button class="rem-toggle" data-rem-toggle="${r.id}" title="on/off">${r.enabled?'🔔':'🔕'}</button>
            <input type="time" data-rem-time="${r.id}" value="${r.time||''}">
            <input type="text" data-rem-label="${r.id}" value="${escapeHtml(r.label||'')}" placeholder="What for?">
            <button class="del" data-rem-del="${r.id}">×</button>
          </div>
          <button class="rem-mode" data-rem-mode="${r.id}" title="tap to switch">${(r.mode||'alarm')==='alarm'?'⏰ Full-screen alarm':'🔔 Just a notification'}</button>
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
      <h2>💾 Backup &amp; restore <span class="hint">last: ${(() => { const t = +localStorage.getItem('dp.lastBackup') || 0; if (!t) return 'never'; const d = Math.floor((Date.now() - t) / 86400000); return d === 0 ? 'today ✅' : d + 'd ago' + (d > 7 ? ' ⚠️' : ''); })()}</span></h2>
      <div class="hint" style="margin-bottom:8px">A backup file is the only way to move your data to a new phone or recover it after a reinstall (the PDF report is just for reading, it can't be restored). Keep one in Drive/email.</div>
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" id="export">⬇ Export backup</button>
        <button class="btn btn-ghost btn-sm" id="import">Import backup</button>
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn btn-ghost btn-sm" id="export-csv">⬇ Export CSV (for Excel/AI)</button>
      </div>
      <input type="file" id="import-file" accept="application/json" style="display:none">
    </div>
    <div class="card">
      <h2>🧠 PIS sync <span class="hint" id="pis-status">not connected</span></h2>
      <div class="hint" style="margin-bottom:8px">Push your Daylog days straight into your <b>Personal Intelligence System</b> (the PIS app on this computer — server running at <b>localhost:5001</b>) so its Mirror, Trends, and chat can analyze your life. On your phone, use the Google Sheet link instead.</div>
      <div class="task-add" style="margin-top:8px">
        <input type="text" id="pis-url" value="${escapeHtml(s.pisUrl || 'http://127.0.0.1:5001')}" placeholder="http://127.0.0.1:5001" style="flex:1" spellcheck="false" autocapitalize="off">
        <button class="btn btn-ghost btn-sm" id="pis-save">Save</button>
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn btn-primary btn-sm" id="pis-push">⬆ Push my days to PIS</button>
        <button class="btn btn-ghost btn-sm" id="pis-check">Check connection</button>
      </div>
      <div class="hint" id="pis-result" style="margin-top:8px"></div>
    </div>
    <div class="card"><h2>ℹ️ About</h2>
      <div class="hint">Daylog · <b>${APP_VERSION}</b> · local-first. Your data stays on this device${s.syncUrl?' and syncs to your Google Sheet':''}.
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
  if (ev.target.id === 'pis-save') {
    const s2 = DB.settings();
    s2.pisUrl = (document.getElementById('pis-url').value || '').trim();
    DB.saveSettings(s2);
    toast('PIS link saved');
    renderSettings();
    return;
  }
  if (ev.target.id === 'pis-check') { pisCheck(); return; }
  if (ev.target.id === 'pis-push') { pisPush(); return; }
  if (ev.target.id === 'rem-add') {
    const time = document.getElementById('rem-new-time').value;
    const label = document.getElementById('rem-new-label').value.trim();
    if (!time) { toast('Pick a time', true); return; }
    const r = DB.reminders(); r.push({ id: 'r' + Date.now(), time, label: label || 'Reminder', enabled: true });
    DB.saveReminders(r); renderSettings(); syncReminders();
    if ('Notification' in window && Notification.permission !== 'granted') await Notification.requestPermission();
    setupReminders(); toast('Reminder added');
    // Ask for exact alarms HERE, at the moment the user commits to a reminder. The passive
    // warning card was not enough — a tester set an alarm, saw a success toast, and got
    // nothing, because Android 14+ denies exact alarms by default and the card was further
    // down the page.
    maybeAskExactAlarm();
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
      await LN.schedule({ notifications: [{ id: 424242, title: '⏰ Daylog native alarm',
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
      title: 'Daylog alarm ⏰', body: 'Full-screen alarm — it works even when locked! 🎉' }] });
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
  if (ev.target.closest('#open-custom')) { customPage = null; show('custom'); return; }
  if (ev.target.closest('#open-history')) { show('history'); return; }
  if (ev.target.id === 'export-quick') { exportData(); renderSettings(); return; }
  if (ev.target.id === 'fb-send') {
    const text = (document.getElementById('fb-text').value || '').trim();
    if (!text) { toast('Write something first 🙂', true); return; }
    sendFeedback(text, '');
    return;
  }
  if (ev.target.closest('#open-report')) { downloadReport(); return; }
  const sct = ev.target.closest('[data-sec-toggle]');
  if (sct) { const id = sct.dataset.secToggle; const wasOn = !logSecHidden(id);
    setLogSecHidden(id, wasOn); sct.classList.toggle('on', !wasOn);
    toast(wasOn ? 'Hidden' : 'Switched back on'); return; }
  const lsh = ev.target.closest('[data-logsec-hide]');
  if (lsh) { const id = lsh.dataset.logsecHide;
    setLogSecHidden(id, !logSecHidden(id)); renderCustom(); return; }
  if (ev.target && ev.target.id === 'logsec-reset') {
    localStorage.removeItem('dp.logsec'); renderCustom(); toast('Order reset'); return; }
  const wt = ev.target.closest('[data-widget-toggle]');
  if (wt) { const flag = wt.dataset.widgetToggle;
    const wasOn = localStorage.getItem(flag) !== '1';
    if (wasOn) localStorage.setItem(flag, '1'); else localStorage.removeItem(flag);
    wt.classList.toggle('on', !wasOn);
    if (flag === 'dp.hapticsOff' && wasOn === false) buzz(18);
    toast(wasOn ? 'Hidden' : 'Switched back on');
    return; }
  const att = ev.target.closest('[data-at-toggle]');
  if (att) { const k = att.dataset.atToggle; const at = autoTrackCfg();
    saveAutoTrack({ [k]: !at[k] }); renderSettings();
    if (k === 'on') toast(!at.on ? 'Auto-tracking ON' : 'Auto-tracking OFF — nothing will be collected');
    return; }
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
const FEEDBACK_URL = '';   // paste the Feedback.gs web-app URL after deploying (silent collection)
const FEEDBACK_EMAIL = 'akishorekumar2494@gmail.com';   // fallback: opens the user's mail app (no GitHub login)
/* ---------- Downloadable PDF report ----------
   Builds a printable summary of ALL the user's data into #print-report and
   calls window.print(). On Android WebView / mobile the print sheet offers
   "Save as PDF"; on desktop the browser print dialog does. Fully offline. */
// Real PDF via jsPDF (works in the WebView, unlike window.print). Saves via share sheet /
// download, toast + a native notification. (#menu-8)
async function generatePdfReport() {
  if (!(window.jspdf && window.jspdf.jsPDF)) { toast('PDF engine still loading — try once more', true); return; }
  const e = DB.entries(); const dates = Object.keys(e).sort();
  if (!dates.length) { toast('Log a day or two first — nothing to report yet', true); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 42; let y = M;
  const ensure = h => { if (y + h > H - M) { doc.addPage(); y = M; } };
  const num = k => { const v = dates.map(d => e[d][k]).filter(x => x != null && x !== '' && !isNaN(+x)); return v.length ? v.reduce((a, b) => a + +b, 0) / v.length : null; };
  const fmt = (v, d = 1) => v == null ? '–' : (+v).toFixed(d);
  const heading = t => { ensure(34); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(70, 90, 210); doc.text(t, M, y); y += 6; doc.setDrawColor(222, 226, 238); doc.line(M, y, W - M, y); y += 15; };
  const row = (l, r) => { ensure(18); doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(45, 45, 60); doc.text(String(l), M, y); doc.text(String(r), W - M, y, { align: 'right' }); y += 18; };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(22, 22, 34); doc.text('Daylog — Report', M, y); y += 22;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(120, 120, 142);
  const name = (DB.settings().name || '').trim();
  doc.text((name ? name + ' · ' : '') + prettyDate(todayStr()) + ' · ' + dates.length + ' days logged', M, y); y += 26;
  const last30 = []; for (let i = 29; i >= 0; i--) last30.push(addDays(todayStr(), -i));
  const pm30 = last30.map(d => e[d] ? polymath(e[d]) : null).filter(Boolean);
  const pmAvg = pm30.length ? Math.round(pm30.reduce((a, p) => a + p.total, 0) / pm30.length) : null;
  heading('Overview');
  if (pmAvg != null) row('Polymath Index (30-day avg)', pmAvg + ' / 100');
  row('Current streak', loggedStreak() + ' days');
  row('Best streak', longestLoggedStreak() + ' days');
  row('Avg mood / energy', fmt(num('mood')) + ' / ' + fmt(num('energy')) + ' (of 10)');
  row('Avg sleep / deep-work', fmt(num('sleepHours')) + 'h / ' + fmt(num('deepWorkHours')) + 'h');
  const gym = DB.gym(); const workouts = Object.keys(gym).filter(d => Object.values(gym[d].done || {}).some(Boolean)).length;
  row('Workouts logged', workouts + ' · streak ' + gymStreak()); y += 8;
  heading('Habit consistency (last 30 days)');
  HABITS.forEach(h => { const hits = last30.filter(d => hVal(e[d], h.key) === H_DONE).length; row(h.label, Math.round(hits / 30 * 100) + '%  (' + hits + '/30)'); }); y += 8;
  const tt = {}; last30.forEach(d => segsForDay(d).forEach(({ seg, a, b }) => { tt[seg.act] = (tt[seg.act] || 0) + (b - a); }));
  const actIds = Object.keys(tt).sort((x, z) => tt[z] - tt[x]);
  if (actIds.length) { heading('Where your time goes (last 30 days)'); actIds.forEach(id => row(actById(id).name, fmtDur(tt[id]) + ' · ' + fmtDur(tt[id] / 30) + '/day')); y += 8; }
  const wb = []; deepCfg().filter(s => !s.hidden).forEach(sec => (sec.scales || []).filter(f => !f.hidden).forEach(f => { const a = num(f.key); if (a != null) wb.push([f.label, fmt(a) + ' / 10']); }));
  if (wb.length) { heading('Wellbeing & focus (avg)'); wb.forEach(([l, r]) => row(l, r)); }
  doc.setFontSize(9); doc.setTextColor(150, 150, 168); doc.text('Generated by Daylog · private & offline · ' + APP_VERSION, M, H - 24);
  await saveFile('daily-pulse-report-' + todayStr() + '.pdf', doc.output('blob'), 'application/pdf');
  toast('Report PDF ready 📄');
  if (nativeShell()) { try { window.Capacitor.Plugins.LocalNotifications.schedule({ notifications: [{ id: 780, title: 'Daylog', body: 'Your report PDF is ready to save/share', schedule: { at: new Date(Date.now() + 400) } }] }); } catch (e) {} }
}
function downloadReport() {
  const e = DB.entries();
  const dates = Object.keys(e).sort();
  if (!dates.length) { toast('Log a day or two first — nothing to report yet', true); return; }
  const num = (arr, k) => { const v = arr.map(d => e[d][k]).filter(x => x != null && x !== '' && !isNaN(+x)); return v.length ? (v.reduce((a, b) => a + +b, 0) / v.length) : null; };
  const fmt = (v, d = 1) => v == null ? '–' : (+v).toFixed(d);
  const last30 = []; for (let i = 29; i >= 0; i--) last30.push(addDays(todayStr(), -i));

  // Polymath 30-day
  const pm30 = last30.map(d => e[d] ? polymath(e[d]) : null).filter(Boolean);
  const pmAvg = pm30.length ? Math.round(pm30.reduce((a, p) => a + p.total, 0) / pm30.length) : null;

  // Habit consistency (last 30d)
  const habitRows = HABITS.map(h => {
    const hits = last30.filter(d => hVal(e[d], h.key) === H_DONE).length;
    return `<tr><td>${h.emoji} ${escapeHtml(h.label)}</td><td>${hits}/30</td><td>${Math.round(hits / 30 * 100)}%</td><td>🔥 ${habitStreak(h.key)}</td></tr>`;
  }).join('');

  // Time totals (last 30d)
  const tt = {}; last30.forEach(d => segsForDay(d).forEach(({ seg, a, b }) => { tt[seg.act] = (tt[seg.act] || 0) + (b - a); }));
  const timeRows = Object.keys(tt).sort((x, y) => tt[y] - tt[x]).map(id => { const act = actById(id);
    return `<tr><td>${act.emoji} ${escapeHtml(act.name)}</td><td>${fmtDur(tt[id])}</td><td>${fmtDur(tt[id] / 30)}/day</td></tr>`; }).join('');

  // Deep-log averages: scales (out of 10) + numbers
  const scaleRows = [], numRows = [];
  deepCfg().filter(s => !s.hidden).forEach(sec => {
    (sec.scales || []).filter(f => !f.hidden).forEach(f => { const a = num(dates, f.key); if (a != null) scaleRows.push(`<tr><td>${escapeHtml(f.label)}</td><td>${fmt(a)} / 10</td></tr>`); });
    (sec.nums || []).filter(f => !f.hidden).forEach(f => { const a = num(dates, f.key); if (a != null) numRows.push(`<tr><td>${escapeHtml(f.label)}</td><td>${fmt(a)}</td></tr>`); });
  });

  // Gym + pomodoro
  const gym = DB.gym(); const workouts = Object.keys(gym).filter(d => Object.values(gym[d].done || {}).some(Boolean)).length;
  const pomo = DB.pomo(); const pomoToday = pomo ? pomoDoneToday(pomo) : 0;
  const name = (DB.settings().name || '').trim();
  const tbl = (head, rows, cols) => rows ? `<h3>${head}</h3><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>` : '';

  document.getElementById('print-report').innerHTML = `
    <div class="rep">
      <div class="rep-head"><div class="rep-fire">🔥</div><div>
        <div class="rep-title">Daylog — Report</div>
        <div class="rep-meta">${name ? escapeHtml(name) + ' · ' : ''}${prettyDate(todayStr())} · ${dates.length} days logged</div></div></div>
      ${pmAvg != null ? `<div class="rep-score">Polymath Index (30-day avg): <b>${pmAvg}/100</b></div>` : ''}
      <h3>Overview</h3>
      <table><tbody>
        <tr><td>Current streak</td><td>🔥 ${loggedStreak()} days</td></tr>
        <tr><td>Best streak</td><td>${longestLoggedStreak()} days</td></tr>
        <tr><td>Avg mood / energy</td><td>${fmt(num(dates,'mood'))} / ${fmt(num(dates,'energy'))} (of 10)</td></tr>
        <tr><td>Avg sleep / deep-work</td><td>${fmt(num(dates,'sleepHours'))}h / ${fmt(num(dates,'deepWorkHours'))}h</td></tr>
        <tr><td>Workouts logged</td><td>💪 ${workouts} · streak ${gymStreak()}</td></tr>
        <tr><td>Pomodoros today</td><td>🍅 ${pomoToday}</td></tr>
      </tbody></table>
      ${tbl('Habit consistency (last 30 days)', habitRows, ['Habit','Days','%','Streak'])}
      ${tbl('Where your time goes (last 30 days)', timeRows, ['Activity','Total','Average'])}
      ${tbl('Wellbeing &amp; focus (all-time avg)', scaleRows.join(''), ['Metric','Average'])}
      ${tbl('Tracked numbers (all-time avg)', numRows.join(''), ['Metric','Average'])}
      <div class="rep-foot">Generated by Daylog · private &amp; offline · ${APP_VERSION}</div>
    </div>
    <div class="rep-actions">
      <button class="btn btn-primary" id="rep-print">⬇ Download PDF</button>
      <button class="btn btn-ghost" id="rep-close">Close</button>
    </div>`;
  document.body.classList.add('reporting');   // shows the full-screen report overlay
  window.scrollTo(0, 0);
}
document.addEventListener('click', (ev) => {
  if (ev.target.closest('#rep-close')) { document.body.classList.remove('reporting'); return; }
  if (ev.target.closest('#rep-print')) { generatePdfReport(); return; }
});
window.addEventListener('afterprint', () => { /* keep overlay open so they can re-print or close */ });

function sendFeedback(text, contact) {
  if (FEEDBACK_URL) {
    fetch(FEEDBACK_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ text, contact, version: APP_VERSION, ua: navigator.userAgent.slice(0, 120) }) }).catch(() => {});
    const ft = document.getElementById('fb-text'); if (ft) ft.value = '';
    toast('Thank you! Feedback sent 💛');
    return;
  }
  // No silent endpoint set → open the mail app to the developer (no GitHub login, no account).
  const subject = encodeURIComponent('Daylog feedback (' + APP_VERSION + ')');
  const body = encodeURIComponent(text + '\n\n— sent from Daylog ' + APP_VERSION);
  location.href = 'mailto:' + FEEDBACK_EMAIL + '?subject=' + subject + '&body=' + body;
  const ft = document.getElementById('fb-text'); if (ft) ft.value = '';
  toast('Opening your mail app…');
}

/* Everything the app stores, for a COMPLETE backup/restore. */
const BACKUP_KEYS = ['entries', 'tasks', 'notes', 'plans', 'gym', 'exercises', 'reminders', 'timelog', 'timeacts', 'events', 'docs', 'habitcfg', 'actcfg', 'deepcfg', 'gymcfg', 'corecfg', 'daycfg', 'gymgroups', 'navcfg', 'pomo', 'timebox', 'pomohist', 'health'];
function exportData() {
  const out = backupBlob();
  saveFile('daily-pulse-backup-' + todayStr() + '.json', JSON.stringify(out, null, 2), 'application/json');
  localStorage.setItem('dp.lastBackup', String(Date.now()));
}
function backupBlob() {
  const out = { settings: DB.settings() };
  BACKUP_KEYS.forEach(k => { const raw = localStorage.getItem('dp.' + k); if (raw) out[k] = JSON.parse(raw); });
  return out;
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
      new Notification('⏰ ' + (r.label || 'Daylog'), { body: r.label ? 'Reminder: ' + r.label : 'Time for your daily log 🔥', tag: r.id });
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
  if (nativeShell()) { scheduleNativeAlarms(); refreshTimerNotif(); scheduleTimeboxAlarms(); return; }   // Android app: real native alarms, skip the workarounds
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
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminders(true); scheduleNtfy(); syncTimelog(); refreshTimerNotif(); scheduleInactivityReminder(); if (hcPlugin()) syncHealth({ silent: true }); } });
if (hcPlugin()) setTimeout(() => syncHealth({ silent: true }), 4000);   // pull today's screen time/health shortly after open
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
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Daylog//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';
  rs.forEach((r) => {
    const [h, m] = r.time.split(':');
    const label = esc(r.label || 'Daylog reminder');
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
  saveFile('daily-pulse-reminders.ics', ics, 'text/calendar;charset=utf-8');
}

/* ---------- Native alarms (Capacitor shell) ----------
   When the site runs inside the Daylog Android app (Capacitor WebView),
   window.Capacitor exposes LocalNotifications — REAL exact alarms that ring
   with the app closed, no ntfy needed. In a plain browser this whole block
   no-ops. Reminder n uses ids n*1000+day, events use hash ids — cancelled
   and rescheduled wholesale on every setupReminders(). */
function nativeShell() { return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications); }

/* ---------- Health Connect (native) integration ----------
   Reads REAL sensor data (sleep/steps/distance/calories/workouts/HR) via a native
   Capacitor plugin that exposes this contract:
     HealthConnect.isAvailable() -> { available:boolean }
     HealthConnect.requestPermissions() -> { granted:boolean }
     HealthConnect.today() -> { steps, distanceMeters, caloriesKcal, sleepMinutes, exerciseMinutes, heartRateAvg }
   Degrades gracefully: on the web/PWA (no plugin) the Health card just invites you to
   use the app; nothing breaks. Data is cached per-day in dp.health and auto-fills sleep. */

/* Play policy: a "prominent disclosure" must appear BEFORE requesting a restricted
   permission (PACKAGE_USAGE_STATS), explaining what is accessed and why, with an
   explicit user choice. This gate runs before any usage-access request. */
function usageDisclosureAccepted() { return localStorage.getItem('dp.usageDisclosure') === '1'; }
function showUsageDisclosure(onAccept) {
  let m = document.getElementById('usage-disc');
  if (!m) { m = document.createElement('div'); m.id = 'usage-disc'; m.className = 'copy-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="copy-box">
    <h2 class="h2-icon">${hicon('phone')}<span>Enable screen-time tracking?</span></h2>
    <p class="hint" style="line-height:1.6">To show your daily screen time, Daylog needs Android's <b>Usage access</b> permission. Here's exactly what that means:</p>
    <div class="wn-item">📱 It reads <b>how long your phone was in use today</b> — nothing else.</div>
    <div class="wn-item">🔒 The number is stored <b>only on this phone</b>. It is never uploaded, shared or sold.</div>
    <div class="wn-item">📊 It's used solely to show your screen time and compare it with your mood.</div>
    <div class="wn-item">↩️ You can turn it off any time in <b>Settings ▸ Auto-tracking</b>, or revoke it in Android settings.</div>
    <div class="copy-actions" style="justify-content:flex-end;margin-top:8px">
      <button class="btn btn-ghost btn-sm" id="usage-no">Not now</button>
      <button class="btn btn-primary btn-sm" id="usage-yes">Continue</button>
    </div></div>`;
  m.classList.add('on');
  m._onAccept = onAccept;
}
document.addEventListener('click', (ev) => {
  if (!ev.target.closest) return;
  const m = document.getElementById('usage-disc');
  if (ev.target.closest('#usage-no')) { if (m) m.remove(); toast('Screen-time tracking stays off'); return; }
  if (ev.target.closest('#usage-yes')) {
    localStorage.setItem('dp.usageDisclosure', '1');
    const cb = m && m._onAccept; if (m) m.remove();
    if (cb) cb();
    return;
  }
});

function hcPlugin() { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.HealthConnect) || null; }
/* Home-screen widget bridge. Android widgets are pure native (RemoteViews) — they can't
   run web code — so the app pushes a small summary to the native side after every save;
   the (future) native WidgetBridge plugin stores it in SharedPreferences and refreshes
   the AppWidget. No-op until that plugin ships in a rebuild. */
function widgetPlugin() { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.WidgetBridge) || null; }
function pushWidgetData() {
  const w = widgetPlugin(); if (!w || !w.update) return;
  try {
    const en = DB.entry(todayStr()) || {}; const tc = taskCounts(todayStr()); const h = healthFor(todayStr()) || {};
    const run = runningSeg(); const act = run ? actById(run.act) : null;
    w.update({
      streak: loggedStreak(), mood: en.mood ?? null,
      tasksDone: tc.done, tasksPlanned: tc.planned,
      steps: h.steps ?? null, sleepMin: h.sleepMin ?? null,
      timing: act ? (act.emoji + ' ' + act.name) : null,
      updated: Date.now(),
    });
  } catch (e) {}
}
/* Auto-tracking preferences — every tracked signal can be switched on/off in
   Settings ▸ Auto-tracking. Master `on` gates everything. Defaults: all on. */
const AUTOTRACK_DEF = { on: true, sleep: true, steps: true, calories: true, workouts: true, hr: true, screentime: true };
function autoTrackCfg() { return Object.assign({}, AUTOTRACK_DEF, DB.settings().autoTrack || {}); }
function saveAutoTrack(patch) { const s = DB.settings(); s.autoTrack = Object.assign(autoTrackCfg(), patch); DB.saveSettings(s); }
function healthStore() { try { return safeParse(localStorage.getItem('dp.health'), {}); } catch (e) { return {}; } }
function saveHealthStore(h) { localStorage.setItem('dp.health', JSON.stringify(h)); }
function healthFor(date) { return healthStore()[date] || null; }
async function syncHealth(opts) {
  opts = opts || {};
  const at = autoTrackCfg();
  if (!at.on) { if (!opts.silent) toast('Auto-tracking is off — enable it in Settings', true); return null; }
  const hc = hcPlugin();
  if (!hc) { if (!opts.silent) toast('Health sync works in the installed app', true); return null; }
  try {
    if (hc.isAvailable) { const a = await hc.isAvailable(); if (a && a.available === false) { if (!opts.silent) toast('Enable Health Connect on your phone first', true); return null; } }
    // Permission prompt only on EXPLICIT sync — the native side may open a system
    // settings page, which must never happen from a silent background sync.
    if (!opts.silent && hc.requestPermissions) {
      if (!usageDisclosureAccepted()) { showUsageDisclosure(() => syncHealth(opts)); return null; }
      const p = await hc.requestPermissions();
      if (p && p.granted === false) { toast('Turn on Usage access for Daylog (screen just opened), then tap Sync again', true); return null; }
    }
    const t = await hc.today();
    if (!t) return null;
    // Screen time comes from a separate native module (UsageStats); optional in the contract.
    let scr = null;
    if (at.screentime && hc.screenTimeToday) { try { const r = await hc.screenTimeToday(); scr = r && r.screenTimeMinutes != null ? r.screenTimeMinutes : null; } catch (_) {} }
    const store = healthStore(); const key = todayStr();
    // Only store what's switched ON — an off toggle means "don't collect", not "hide".
    store[key] = {
      steps: at.steps ? (t.steps ?? null) : null,
      distanceKm: at.steps && t.distanceMeters != null ? +(t.distanceMeters / 1000).toFixed(2) : null,
      calories: at.calories && t.caloriesKcal != null ? Math.round(t.caloriesKcal) : null,
      sleepMin: at.sleep ? (t.sleepMinutes ?? null) : null,
      exerciseMin: at.workouts ? (t.exerciseMinutes ?? null) : null,
      hr: at.hr ? (t.heartRateAvg ?? null) : null,
      screenMin: scr,
      at: new Date().toISOString(),
    };
    // don't store an all-null day (e.g. silent sync before Usage access is granted)
    const hasAny = ['steps', 'distanceKm', 'calories', 'sleepMin', 'exerciseMin', 'hr', 'screenMin'].some(k => store[key][k] != null);
    if (!hasAny) { if (!opts.silent) toast('No health data yet — grant Usage access first', true); return null; }
    saveHealthStore(store);
    // auto-fill sleep from Health Connect if the user hasn't entered it for today.
    // Only PERSIST when the day already has an entry — a health sync alone must not
    // create a logged day (that would award streak/milestone credit the user never earned).
    if (at.sleep && store[key].sleepMin && logDate === key) {
      const cur = draft.sleepHours;
      if (cur == null || cur === '') {
        draft.sleepHours = +(store[key].sleepMin / 60).toFixed(2);
        if (DB.entry(key)) saveDraftNow(key, draft);
      }
    }
    if (!opts.silent) toast('Health synced ✅');
    if (document.getElementById('s-today') && document.getElementById('s-today').classList.contains('on')) renderToday();
    return store[key];
  } catch (e) { if (!opts.silent) toast('Health sync failed', true); return null; }
}
const fmtMin = m => m == null ? null : (Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0') + 'm');
/* ---------- Sample data preview (auto-tracking) ----------
   Seeds 14 PAST days (skipping yesterday & the day before, so the logged-streak
   and today's real sync are untouched) of realistic health + focus + entry data,
   all marked sample:true and listed in dp.sampleMeta for exact one-tap removal. */
function seedSampleData() {
  const meta = { dates: [], entries: [], pomo: [] };
  const hs = healthStore();
  const es = DB.entries();
  const ph = safeParse(localStorage.getItem('dp.pomohist'), {});
  const journals = [
    'Deep work went great today, shipped the feature #work #focus',
    'Long walk in the evening, felt refreshed #health',
    'Read 30 pages before bed #learning',
    'Too much scrolling today, need to cut down #digital',
    'Solid gym session, energy high all day #health #gym',
    'Planned the week, feeling organized #work',
    'Quiet day, mostly recovery and reading #learning #health',
  ];
  for (let i = 3; i <= 16; i++) {
    const d = addDays(todayStr(), -i);
    const steps = 4200 + Math.round(Math.random() * 7000);
    const screenMin = 160 + Math.round(Math.random() * 260);
    const sleepMin = 360 + Math.round(Math.random() * 150);
    const exerciseMin = steps > 8000 ? 30 + Math.round(Math.random() * 40) : Math.round(Math.random() * 25);
    hs[d] = { steps, distanceKm: +(steps * 0.00072).toFixed(2), calories: 1750 + Math.round(steps * 0.06),
      sleepMin, exerciseMin, hr: 64 + Math.round(Math.random() * 12), screenMin, at: new Date().toISOString(), sample: true };
    meta.dates.push(d);
    if (!es[d]) {
      // mood/energy loosely follow the health story so the correlations demo honestly
      const mood = Math.max(3, Math.min(9, Math.round(5 + steps / 4000 - screenMin / 200 + (sleepMin - 400) / 100)));
      const energy = Math.max(3, Math.min(9, Math.round(4.5 + steps / 3500 + (sleepMin - 400) / 120)));
      es[d] = { mood, energy, sleepHours: +(sleepMin / 60).toFixed(2), deepWorkHours: +(1.5 + Math.random() * 3).toFixed(1),
        workoutsDone: exerciseMin > 30 ? 4 + (i % 3) : 0, tasksDone: i % 4, tasksPlanned: 3 + (i % 3),
        journal: journals[i % journals.length],
        habits: { workout: exerciseMin > 30, meditation: i % 3 !== 0, reading: i % 2 === 0, healthyFood: i % 3 !== 1 }, sample: true };
      meta.entries.push(d);
    }
    if (ph[d] == null) { ph[d] = 2 + (i % 5); meta.pomo.push(d); }
  }
  // timelog: a night of sleep + two work blocks per sample day (unlocks wake-time & focus-window patterns)
  const tl = DB.timelog ? safeParse(localStorage.getItem('dp.timelog'), []) : [];
  meta.timelog = [];
  meta.dates.forEach((d, idx) => {
    const d0 = new Date(d + 'T00:00:00').getTime();
    const jitter = (m) => Math.round((Math.random() - 0.5) * 2 * m) * 60000;
    const bed = d0 - 45 * 60000 + jitter(35);                       // ~23:15 the night before
    const wake = d0 + (6.7 * 60 + Math.round(Math.random() * 50)) * 60000;  // ~06:40–07:30
    const id = 'smp' + d.replace(/-/g, '') ;
    tl.push({ id: id + 'a', act: 'sleep', start: bed, end: wake, upd: d0, sample: true });
    tl.push({ id: id + 'b', act: 'work', start: d0 + 9.5 * 3.6e6 + jitter(20), end: d0 + 12.4 * 3.6e6 + jitter(15), upd: d0, sample: true });
    tl.push({ id: id + 'c', act: 'work', start: d0 + 14 * 3.6e6 + jitter(20), end: d0 + 16.6 * 3.6e6 + jitter(20), upd: d0, sample: true });
    meta.timelog.push(id + 'a', id + 'b', id + 'c');
  });
  tl.sort((a, b) => a.start - b.start);
  safeSet('dp.timelog', JSON.stringify(tl));
  safeSet('dp.entries', JSON.stringify(es));   // direct write — sample must not trigger sync/pushState
  saveHealthStore(hs);
  localStorage.setItem('dp.pomohist', JSON.stringify(ph));
  localStorage.setItem('dp.sampleMeta', JSON.stringify(meta));
}
function clearSampleData() {
  const meta = safeParse(localStorage.getItem('dp.sampleMeta'), null); if (!meta) return;
  const hs = healthStore(); (meta.dates || []).forEach(d => { if (hs[d] && hs[d].sample) delete hs[d]; }); saveHealthStore(hs);
  const es = DB.entries(); (meta.entries || []).forEach(d => { if (es[d] && es[d].sample) delete es[d]; });
  safeSet('dp.entries', JSON.stringify(es));
  const ph = safeParse(localStorage.getItem('dp.pomohist'), {}); (meta.pomo || []).forEach(d => { delete ph[d]; });
  localStorage.setItem('dp.pomohist', JSON.stringify(ph));
  if (meta.timelog && meta.timelog.length) {
    const ids = new Set(meta.timelog);
    safeSet('dp.timelog', JSON.stringify(safeParse(localStorage.getItem('dp.timelog'), []).filter(s => !ids.has(s.id))));
  }
  localStorage.removeItem('dp.sampleMeta');
}
document.addEventListener('click', (ev) => {
  if (ev.target.id === 'hc-sample') { seedSampleData(); dashRange = 30; dashTab = 'health'; renderDash(); refreshStreak(); toast('👀 Sample data loaded — explore Stats! Clear it anytime.'); return; }
  if (ev.target.id === 'hc-sample-clear') { clearSampleData(); renderDash(); refreshStreak(); toast('Sample data removed'); return; }
});
// Compact Health card for the Log screen — shows ONLY the metrics enabled in Settings ▸ Auto-tracking.
function healthCardHTML() {
  const at = autoTrackCfg();
  if (!at.on) return '';   // master switch off → no card at all
  const h = healthFor(todayStr());
  const hasPlugin = !!hcPlugin();
  const cell = (v, unit, label) => `<div class="ts-cell"><div class="ts-n">${v != null ? v : '—'}</div><div class="ts-l">${label}${v != null && unit ? ' ' + unit : ''}</div></div>`;
  const cells = h ? [
    at.steps ? cell(h.steps, '', 'steps') : '',
    at.steps ? cell(h.distanceKm, 'km', 'distance') : '',
    at.calories ? cell(h.calories, 'kcal', 'calories') : '',
    at.sleep ? cell(fmtMin(h.sleepMin), '', 'sleep') : '',
    at.workouts ? cell(fmtMin(h.exerciseMin), '', 'active') : '',
    at.screentime ? cell(fmtMin(h.screenMin), '', 'screen time') : '',
  ].join('') : '';
  const grid = h ? `<div class="health-grid">${cells}</div>`
    : `<div class="hint" style="padding:4px 0 8px">${hasPlugin ? 'Not synced yet today — tap Sync.' : 'Auto sleep, steps, calories &amp; screen time from your phone — <b>coming in a Play update</b>. Choose what to track in <b>Settings ▸ Auto-tracking</b>.'}</div>`;
  return `<div class="card">
    <h2 class="h2-icon">${hicon('heart')}<span>Health</span> <span class="hint">${h && at.hr && h.hr ? '❤ ' + h.hr + ' bpm' : (hasPlugin ? 'auto from your phone' : 'coming soon')}</span></h2>
    ${grid}
    ${hasPlugin ? '<button class="btn btn-primary btn-sm" id="health-sync">↻ Sync health now</button>' : ''}
  </div>`;
}
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
    // wipe previously scheduled reminder/event notifications ONLY (ids < 700).
    // Reserved ids owned by other features must survive this reschedule:
    // 399 fs-test, 750 pomodoro, 760 inactivity, 770 running-timer, 800-830 timebox.
    if (notifOk) {
      const pending = await LN.getPending();
      const mine = (pending.notifications || []).filter(n => n.id < 700 && n.id !== 399);
      if (mine.length) await LN.cancel({ notifications: mine.map(n => ({ id: n.id })) });
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
        add(t, '⏰ ' + (r.label || 'Daylog'),
          r.label ? 'Reminder: ' + r.label : 'Time for your daily log 🔥', wantsAlarm(r.mode));
      }
    });
    DB.events().filter(x => x.time && x.date >= todayStr()).forEach(x => {
      const t = new Date(x.date + 'T' + x.time + ':00');
      if (isNaN(t.getTime()) || t.getTime() <= now) return;
      add(t, '📌 ' + x.label, x.time + ' · ' + x.label, !!x.alarm);
    });
    if (notifOk && notifs.length) await LN.schedule({ notifications: notifs });
    if (FS) {
      // always call so it clears old ones when the list is empty
      const res = await FS.schedule({ alarms });
      // The old code threw this away. A tester's alarms silently never fired because
      // SCHEDULE_EXACT_ALARM is denied by default on Android 14+ and nothing surfaced it.
      alarmHealth({ exactAllowed: res && res.exactAllowed !== false,
                    fullScreenAllowed: res && res.fullScreenAllowed !== false,
                    notifOk, failed: (res && res.failed) || 0, checked: Date.now() });
    }
    scheduleInactivityReminder();
    return true;
  } catch (e) { return false; }
}

/* ---------- Alarm health ----------
   Android can accept a reminder and then never ring it: SCHEDULE_EXACT_ALARM is denied by
   default on Android 14+, notifications can be off, and the full-screen intent is only
   auto-granted to real alarm-clock apps. None of that used to be visible to the user, so
   "I set an alarm and nothing happened" looked like a broken app. We now record the state
   and show it wherever reminders are managed. */
function alarmHealth(patch) {
  const cur = safeParse(localStorage.getItem('dp.alarmHealth'), {}) || {};
  if (patch) { localStorage.setItem('dp.alarmHealth', JSON.stringify(Object.assign(cur, patch))); return Object.assign(cur, patch); }
  return cur;
}
async function refreshAlarmHealth() {
  const FS = fullScreenPlugin(); if (!FS || !FS.status) return alarmHealth();
  try {
    const st = await FS.status();
    return alarmHealth({ exactAllowed: !!st.exactAllowed, canRequestExact: !!st.canRequestExact,
      fullScreenAllowed: !!st.fullScreenAllowed, notifOk: !!st.notificationsEnabled,
      sdk: st.sdk, manufacturer: st.manufacturer, checked: Date.now() });
  } catch (e) { return alarmHealth(); }
}
/* The banner shown on the Reminders card in Settings. Only appears when something is
   actually wrong, and every line is one tap from being fixed. */
/* Ask for the exact-alarm permission at the moment it matters. Without it Android only
   fires the reminder "sometime after" the chosen time (and, before v140, not at all while
   the phone was dozing). Shown at most once per install unless the user re-triggers it. */
async function maybeAskExactAlarm() {
  if (!nativeShell()) return;
  const h = await refreshAlarmHealth();
  if (h.exactAllowed !== false) return;                    // already allowed, or unknown
  if (localStorage.getItem('dp.exactAsked') === '1') { renderSettings(); return; }
  localStorage.setItem('dp.exactAsked', '1');
  let m = document.getElementById('exact-ask');
  if (!m) { m = document.createElement('div'); m.id = 'exact-ask'; m.className = 'copy-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="copy-box">
    <h2 class="h2-icon">${hicon('clock')}<span>One tap so your alarm is on time</span></h2>
    <p class="hint" style="line-height:1.6">Android blocks apps from setting <b>exact</b> alarms unless you allow it. Without this, Daylog can still remind you — but Android decides when, and it can be several minutes late.</p>
    <div class="wn-item">⏰ Allow <b>Alarms &amp; reminders</b> and your reminder fires at the minute you chose.</div>
    <div class="wn-item">🔒 It only lets Daylog schedule alarms. Nothing is collected or sent.</div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-primary" id="exact-go" style="flex:1">Allow exact alarms</button>
      <button class="btn btn-ghost" id="exact-skip">Not now</button>
    </div>
  </div>`;
  m.style.display = 'flex';
}
document.addEventListener('click', async (ev) => {
  const m = document.getElementById('exact-ask');
  if (!m || m.style.display === 'none') return;
  if (ev.target.id === 'exact-skip' || ev.target === m) {
    m.style.display = 'none'; renderSettings();
    toast('You can turn it on any time in Settings ▸ Reminders'); return;
  }
  if (ev.target.id === 'exact-go') {
    m.style.display = 'none';
    const FS = fullScreenPlugin();
    try { if (FS && FS.openExactAlarmSettings) await FS.openExactAlarmSettings(); } catch (e) {}
    toast('Turn on “Alarms & reminders”, then come back');
  }
});

/* ---------- Alarm sound (Customize ▸ Alarm sound) ----------
   The tone is stored natively (SharedPreferences) so the alarm screen AND the fallback
   notification channel can both read it without the WebView being alive. We keep a copy in
   localStorage purely so the page can render instantly before the plugin answers. */
async function refreshAlarmSound() {
  const FS = fullScreenPlugin(); if (!FS || !FS.getAlarmSound) return null;
  try {
    const r = await FS.getAlarmSound();
    localStorage.setItem('dp.alarmSound', JSON.stringify(r));
    const el = document.getElementById('snd-name');
    if (el) el.textContent = r.name || 'Phone default alarm';
    return r;
  } catch (e) { return null; }
}
document.addEventListener('click', async (ev) => {
  const FS = fullScreenPlugin();
  if (ev.target && ev.target.id === 'snd-pick') {
    if (!FS || !FS.pickAlarmSound) { toast('Needs the app update', true); return; }
    try { const r = await FS.pickAlarmSound();
      localStorage.setItem('dp.alarmSound', JSON.stringify(r));
      renderCustom(); toast('Alarm sound: ' + (r.name || 'default'));
    } catch (e) { toast("Couldn't open the sound picker", true); }
    return;
  }
  if (ev.target && ev.target.id === 'snd-play') {
    if (!FS || !FS.previewAlarmSound) return;
    const cur = safeParse(localStorage.getItem('dp.alarmSound'), null) || {};
    try { await FS.previewAlarmSound({ uri: cur.uri || '' }); } catch (e) {}
    return;
  }
  if (ev.target && ev.target.id === 'snd-stop') { try { FS && FS.stopPreview && await FS.stopPreview(); } catch (e) {} return; }
  if (ev.target && ev.target.id === 'snd-reset') {
    if (!FS || !FS.setAlarmSound) return;
    try { const r = await FS.setAlarmSound({ uri: '', name: '' });
      localStorage.setItem('dp.alarmSound', JSON.stringify(r));
      renderCustom(); toast('Back to your phone default');
    } catch (e) {}
    return;
  }
  const vb = ev.target.closest && ev.target.closest('[data-snd-vib]');
  if (vb) {
    if (!FS || !FS.setAlarmSound) return;
    const cur = safeParse(localStorage.getItem('dp.alarmSound'), null) || {};
    const next = cur.vibrate === false;               // toggle
    try { const r = await FS.setAlarmSound({ uri: cur.uri || '', name: cur.name || '', vibrate: next });
      localStorage.setItem('dp.alarmSound', JSON.stringify(r));
      vb.classList.toggle('on', next);
      if (next) buzz(22);
      toast(next ? 'Vibration on' : 'Vibration off');
    } catch (e) {}
  }
});

function alarmHealthHTML() {
  if (!nativeShell()) return '';
  const h = alarmHealth();
  if (!h.checked) return '';
  const bad = [];
  if (h.notifOk === false)
    bad.push(['Notifications are turned off', 'Nothing can reach you until these are on.', 'notif']);
  if (h.exactAllowed === false)
    bad.push(['Exact alarms are not allowed', 'Android will only fire your reminder within ~10 minutes of the time you set. Allow "Alarms & reminders" for on-the-dot alarms.', 'exact']);
  if (h.exactAllowed !== false && h.fullScreenAllowed === false)
    bad.push(['Full-screen alarms are off', 'Alarms will ring as a loud notification instead of taking over the screen.', 'fsi']);
  if (!bad.length) return '';
  return `<div class="card alarm-warn">
    <h2 class="h2-icon">${hicon('clock')}<span>Your alarms need one more tap</span></h2>
    ${bad.map(([t, d, k]) => `<div class="aw-row">
      <div class="aw-txt"><div class="aw-t">${t}</div><div class="aw-d">${d}</div></div>
      <button class="btn btn-primary btn-sm" data-alarm-fix="${k}">Fix</button>
    </div>`).join('')}
    ${(h.manufacturer && /xiaomi|redmi|poco|realme|oppo|vivo|oneplus/i.test(h.manufacturer))
      ? `<div class="hint" style="margin-top:8px">On ${escapeHtml(h.manufacturer)} phones also enable <b>Autostart</b> and set battery usage to <b>No restrictions</b> for Daylog, or the system stops alarms after a while.</div>` : ''}
  </div>`;
}
document.addEventListener('click', async (ev) => {
  const b = ev.target.closest && ev.target.closest('[data-alarm-fix]');
  if (!b) return;
  const FS = fullScreenPlugin(); if (!FS) return;
  try {
    if (b.dataset.alarmFix === 'exact' && FS.openExactAlarmSettings) await FS.openExactAlarmSettings();
    else if (FS.openNotificationSettings) await FS.openNotificationSettings();
    toast('Turn it on, then come back');
  } catch (e) { toast('Open Settings ▸ Apps ▸ Daylog', true); }
});

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
      title: '⏰ ' + (message || 'Daylog'),
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
      const ok = await ntfyPublish(s.ntfyTopic, r.label || 'Daylog reminder', Math.floor(ts / 1000), r.mode);
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
        await reg.showNotification('⏰ ' + (r.label || 'Daylog'), {
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
// Bottom bar shows up to NAV_PRIMARY_MAX (4) pinned tabs + a "Menu" button that opens the side drawer with everything.
const NAV_DEF = [
  { k: 'today',    ico: 'pencil',   label: 'Log',     primary: true, noHide: true },
  { k: 'time',     ico: 'clock',    label: 'Time',    primary: true },
  { k: 'tasks',    ico: 'check',    label: 'Tasks' },
  { k: 'notes',    ico: 'note',     label: 'Notes' },
  { k: 'plans',    ico: 'list',     label: 'Plans' },
  { k: 'focus',    ico: 'target',   label: 'Focus',   primary: true },
  { k: 'waves',    ico: 'radio',    label: 'Waves' },
  { k: 'gym',      ico: 'dumbbell', label: 'Gym' },
  { k: 'habits',   ico: 'flame',    label: 'Habits' },
  { k: 'dash',     ico: 'chart',    label: 'Stats',   primary: true },
  { k: 'cal',      ico: 'calendar', label: 'Cal' },
  { k: 'write',    ico: 'pencil',   label: 'Write' },
  { k: 'search',   ico: 'search',   label: 'Search' },
  { k: 'history',  ico: 'history',  label: 'History' },
  { k: 'settings', ico: 'settings', label: 'Settings' },
];
function navCfg() {
  const v0 = safeParse(localStorage.getItem('dp.navcfg'), null);
  let cfg = Array.isArray(v0) ? v0 : NAV_DEF.map(n => Object.assign({}, n));
  NAV_DEF.forEach(d => { if (!cfg.find(n => n.k === d.k)) cfg.push(Object.assign({}, d)); });   // future tabs append
  // Migrate legacy configs (pre-v56 had no `primary`): seed pins from NAV_DEF defaults once.
  if (cfg.every(n => n.primary === undefined)) {
    cfg.forEach(n => { const d = NAV_DEF.find(x => x.k === n.k); n.primary = !!(d && d.primary) && !n.hidden; n.hidden = n.k === 'history' ? false : n.hidden; });
  }
  // Icons are not user data — always take them from NAV_DEF, so stored configs from the
  // emoji era (pre-v82) render the professional line icons too.
  cfg.forEach(n => { const d = NAV_DEF.find(x => x.k === n.k); if (d) n.ico = d.ico; });
  return cfg;
}
function saveNavCfg(cfg) { localStorage.setItem('dp.navcfg', JSON.stringify(cfg)); renderNav(); pushState(); }
function defaultTab() {
  const dt = DB.settings().defaultTab || 'today';
  const n = navCfg().find(x => x.k === dt);
  return (n && !n.hidden) ? dt : 'today';
}
const NAV_PRIMARY_MAX = 4;   // bottom bar shows ≤4 pinned tabs + the Menu button = 5 slots
function renderNav() {
  const cur = (document.querySelector('.screen.on') || {}).id || 's-today';
  const curKey = cur.replace('s-', '');
  const items = navCfg().filter(n => !n.hidden);
  const primary = items.filter(n => n.primary);   // user's choice how many — Menu is always appended
  const primaryKeys = new Set(primary.map(n => n.k));
  const btns = primary.map(n => `<button data-screen="${n.k}" class="${'s-' + n.k === cur ? 'on' : ''}"><span class="ico">${icon(n.ico)}</span>${escapeHtml(n.label)}</button>`);
  // synthetic Menu button — always present, opens the side drawer with everything
  const menuOn = (!primaryKeys.has(curKey) || document.getElementById('drawer')?.classList.contains('on')) ? 'on' : '';
  btns.push(`<button data-screen="__menu" class="${menuOn}"><span class="ico">${icon('menu')}</span>Menu</button>`);
  document.getElementById('nav').innerHTML = btns.join('');
  // Back-to-menu affordance for any screen that isn't a pinned bottom-bar tab
  const back = document.getElementById('nav-back');
  if (back) back.hidden = primaryKeys.has(curKey) || curKey === 'today';
}

/* ---------- Side navigation drawer ---------- */
function renderDrawer() {
  const cur = ((document.querySelector('.screen.on') || {}).id || 's-today').replace('s-', '');
  // Menu lists only what's NOT already in the fixed bottom bar (#menu-3).
  const bottom = new Set(navCfg().filter(n => !n.hidden && n.primary).map(n => n.k));
  const items = navCfg().filter(n => !n.hidden && !bottom.has(n.k));
  const rows = items.map(n => `<button class="drawer-row ${n.k === cur ? 'on' : ''}" data-screen="${n.k}">
    <span class="drawer-ico">${icon(n.ico, 22)}</span><span class="drawer-lbl">${escapeHtml(n.label)}</span>
    ${n.primary ? '<span class="drawer-pin">pinned</span>' : ''}</button>`).join('');
  document.getElementById('drawer-list').innerHTML = rows +
    `<button class="drawer-row drawer-edit" id="drawer-edit-tabs">${icon('pencil', 20)}<span class="drawer-lbl" style="margin-left:12px">Edit tabs &amp; this menu…</span></button>`;
}
document.addEventListener('click', (ev) => {
  if (ev.target.closest && ev.target.closest('#drawer-edit-tabs')) { closeDrawer(); customPage = 'tabs'; navigateTo('custom'); }
});
// Hide the fixed bottom nav while a text field is focused, so the on-screen keyboard
// never pushes the nav up over the input (affects every screen). (#log-5)
document.addEventListener('focusin', (e) => {
  if (e.target.matches && e.target.matches('input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable]')) document.body.classList.add('kbd-open');
});
document.addEventListener('focusout', (e) => {
  if (e.target.matches && e.target.matches('input, textarea, [contenteditable]'))
    setTimeout(() => { const a = document.activeElement; if (!a || !a.matches || !a.matches('input, textarea, [contenteditable]')) document.body.classList.remove('kbd-open'); }, 80);
});
function openDrawer() {
  renderDrawer();
  document.getElementById('drawer').classList.add('on');
  document.getElementById('drawer').setAttribute('aria-hidden', 'false');
  document.getElementById('drawer-scrim').classList.add('on');
  renderNav();   // light up the Menu button
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('on');
  document.getElementById('drawer').setAttribute('aria-hidden', 'true');
  document.getElementById('drawer-scrim').classList.remove('on');
  renderNav();
}
document.getElementById('drawer-scrim').addEventListener('click', closeDrawer);
document.getElementById('drawer-close').addEventListener('click', closeDrawer);
document.getElementById('nav-back').addEventListener('click', openDrawer);
document.getElementById('drawer-list').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-screen]'); if (!b) return;
  closeDrawer(); navigateTo(b.dataset.screen);
});

/* ---------- Android hardware back button ----------
   Close any open overlay first → else step back to the default tab →
   else ask before exiting (via the already-bundled @capacitor/app plugin). */
function showExitConfirm() {
  let m = document.getElementById('confirm-exit');
  if (!m) { m = document.createElement('div'); m.id = 'confirm-exit'; m.className = 'copy-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="copy-box confirm-box">
    <h2>Exit Daylog?</h2>
    <p class="hint">Your day is saved automatically — nothing will be lost.</p>
    <div class="copy-actions" style="justify-content:center">
      <button class="btn btn-ghost btn-sm" data-exit-cancel>Stay</button>
      <button class="btn btn-primary btn-sm" data-exit-yes>Exit</button>
    </div></div>`;
  m.classList.add('on');
}
document.addEventListener('click', (ev) => {
  const m = document.getElementById('confirm-exit'); if (!m || !m.classList.contains('on')) return;
  if (ev.target.closest('[data-exit-cancel]')) { m.classList.remove('on'); return; }
  if (ev.target.closest('[data-exit-yes]')) { const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; if (App && App.exitApp) App.exitApp(); else m.classList.remove('on'); }
});
function handleBack() {
  // 0) a ringing alarm owns the screen — back must never dismiss it or poke things behind it
  const alarm = document.getElementById('alarm'); if (alarm && alarm.classList.contains('on')) return;
  // 1) an open overlay always closes first
  const tr = document.getElementById('tour'); if (tr) { endTour(); return; }
  const wn = document.getElementById('wn-pop'); if (wn) { localStorage.setItem('dp.whatsnew', WHATS_NEW.v); wn.remove(); return; }
  const drawer = document.getElementById('drawer');
  if (drawer && drawer.classList.contains('on')) { closeDrawer(); return; }
  const cm = document.getElementById('copy-modal'); if (cm && cm.classList.contains('on')) { cm.classList.remove('on'); return; }
  const ce = document.getElementById('confirm-exit'); if (ce && ce.classList.contains('on')) { ce.classList.remove('on'); return; }
  const ms = document.getElementById('milestone'); if (ms && ms.classList.contains('on')) { ms.classList.remove('on'); return; }
  if (document.body.classList.contains('reporting')) { document.body.classList.remove('reporting'); return; }
  const onboard = document.getElementById('onboard'); if (onboard && onboard.classList.contains('on')) return;
  const cur = ((document.querySelector('.screen.on') || {}).id || 's-today').replace('s-', '');
  // 2) step back within a screen's sub-view first (mirror the on-screen "← back" buttons)
  if (cur === 'write' && curDoc) { curDoc = null; renderWrite(); return; }
  if (cur === 'plans' && curPlan) { curPlan = null; renderPlans(); return; }
  if (cur === 'gym' && gymView === 'day') { gymView = 'home'; renderGym(); return; }
  if (cur === 'custom' && customPage) { customPage = null; renderCustom(); return; }
  if (cur === 'custom') { show('settings'); return; }   // hub → Settings (mirrors the on-screen back)
  // 3) not on the home tab → go back to it
  const home = defaultTab();
  if (cur !== home) { navigateTo(home); return; }
  // 4) already home → confirm exit
  showExitConfirm();
}
(function setupBackButton() {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App && App.addListener) App.addListener('backButton', handleBack);
})();

/* ---------- Theme: accent colour + light/dark MODE (device-local) ---------- */
const THEMES = [
  { id: 'indigo', a: '#6d8cff', b: '#8f7bff' },
  { id: 'teal',   a: '#2dd4bf', b: '#4ad6c0' },
  { id: 'pink',   a: '#ec4899', b: '#f472b6' },
  { id: 'amber',  a: '#f59e0b', b: '#fbbf24' },
  { id: 'green',  a: '#34d399', b: '#4ade80' },
  { id: 'red',    a: '#f87171', b: '#fb7185' },
];
const THEME_MODES = [
  { id: 'auto',  label: 'Auto (system)',  chip: 'linear-gradient(135deg,#f4f6fb 50%,#141c2e 50%)' },
  { id: 'light', label: 'Light',           chip: '#f4f6fb' },
  { id: 'navy',  label: 'Dark navy',       chip: '#141c2e' },
  { id: 'black', label: 'Black',           chip: '#000000' },
];
try {
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((DB.settings().mode || 'auto') === 'auto') { applyTheme(); const on = document.querySelector('.screen.on'); if (on) { const k = on.id.replace('s-',''); if (RENDER[k]) RENDER[k](); } }
  });
} catch (e) {}
function applyTheme() {
  // 'auto' (the default) follows the OS. This also stops OEM skins (MIUI) from
  // dimming/force-darkening a light page while the system is in dark mode.
  const _pref = DB.settings().mode || 'auto';
  const _sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const _mode = _pref === 'auto' ? (_sysDark ? 'navy' : 'light') : _pref;
  document.documentElement.setAttribute('data-mode', _mode);
  // keep the Android status bar in step with the theme
  const _tc = { light: '#f4f6fb', navy: '#070b14', black: '#000000' }[_mode] || '#f4f6fb';
  const _meta = document.querySelector('meta[name="theme-color"]'); if (_meta) _meta.setAttribute('content', _tc);
  // Tell the WebView we handle theming ourselves — otherwise system dark mode
  // force-darkens the light theme (auto-inversion; found on MIUI/POCO).
  document.documentElement.style.colorScheme = _mode === 'light' ? 'light' : 'dark';
  const _cs = document.querySelector('meta[name="color-scheme"]'); if (_cs) _cs.setAttribute('content', _mode === 'light' ? 'light' : 'dark');
  const t = THEMES.find(x => x.id === (DB.settings().accent || 'indigo')) || THEMES[0];
  const r = document.documentElement.style;
  r.setProperty('--accent', t.a);
  r.setProperty('--grad-accent', `linear-gradient(135deg, ${t.a} 0%, ${t.b} 100%)`);
  r.setProperty('--glow-accent', `0 6px 22px ${t.a}52`);
}

/* ---------- More: overflow launcher grid ---------- */
function renderMore() {
  document.getElementById('screen-title').textContent = 'More';
  document.getElementById('screen-sub').textContent = 'Everything else';
  const overflow = navCfg().filter(n => !n.hidden && !n.primary);
  const cards = overflow.map(n => `<button class="more-card" data-screen="${n.k}">
    <span class="more-ico">${icon(n.ico, 24)}</span><span class="more-lbl">${escapeHtml(n.label)}</span></button>`).join('');
  document.getElementById('s-more').innerHTML = `
    <div class="more-grid">${cards || '<div class="empty">All your tabs are pinned to the bottom bar.</div>'}</div>
    <div class="card" style="margin-top:6px">
      <div class="hint">Pin your favourite tabs to the bottom bar, reorder them, and choose your default opening tab in <b>Settings ▸ Customize ▸ Tabs</b>.</div>
    </div>`;
}

/* ---------- Navigation ---------- */
const RENDER = { today: openToday, time: openTime, tasks: renderTasks, notes: renderNotes, plans: renderPlans, focus: renderFocus, waves: renderWaves, gym: openGym, habits: renderHabits, dash: renderDash, cal: renderCal, write: renderWrite, history: renderHistory, settings: renderSettings, custom: renderCustom, more: renderMore, search: renderSearch };
function show(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  const sec = document.getElementById('s-' + name);
  if (sec) sec.classList.add('on');
  (RENDER[name] || (()=>{}))();
  if (sec) decorateHeaders(sec);   // swap leading header/menu emoji → clean icons app-wide
  renderNav();   // recompute bottom-bar highlight (More lights up for overflow screens)
  window.scrollTo(0, 0);
}
document.addEventListener('click', (ev) => {
  const gn = ev.target.closest('[data-node]');
  if (gn && document.getElementById('s-dash').classList.contains('on')) {
    if (Date.now() - _gMovedAt < 250) return;   // that tap was the end of a pan
    graphFocus = (graphFocus === gn.dataset.node) ? null : gn.dataset.node;
    const w = document.getElementById('graph-wrap');   // update ONLY the graph — page doesn't move
    if (w) w.innerHTML = graphSVG();
    return;
  }
  const dt = ev.target.closest('[data-dashtab]');
  if (dt) { dashTab = dt.dataset.dashtab; renderDash(); window.scrollTo(0, 0); }
});
function navigateTo(name) {
  if (name === 'today') logDate = todayStr();               // Log always opens today
  if (name === 'gym') gymDate = todayStr();                 // Gym always opens today
  if (name === 'plans') curPlan = null;                     // Plans opens the list
  if (name === 'cal') { calSel = todayStr(); calMonth = calSel.slice(0, 7); }
  if (name === 'write') curDoc = null;                      // Write opens the article list
  show(name);
}
document.getElementById('nav').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.screen === '__menu') { openDrawer(); return; }
  navigateTo(b.dataset.screen);
});
// Tapping a card in the More overflow grid
document.addEventListener('click', (ev) => {
  const c = ev.target.closest('.more-card[data-screen]');
  if (c && document.getElementById('s-more').classList.contains('on')) navigateTo(c.dataset.screen);
});

function refreshStreak() { document.getElementById('streak-n').textContent = loggedStreak(); }
function emojiSplit(raw){ raw=(raw||'').trim(); const m=raw.match(/^(\p{Extended_Pictographic}[\u{fe0f}\u{200d}\p{Extended_Pictographic}]*)\s*(.*)$/u); return (m&&m[2])?{emoji:m[1],name:m[2]}:{emoji:'⭐',name:raw}; }
function escapeHtml(s) { return (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
/* Clean line-icon set (Lucide-style) for app CHROME — nav, menu, headers, buttons.
   Inline SVG, stroke=currentColor so it themes automatically. Emoji stays only for
   user-chosen content (custom habits/activities). icon() falls back to the raw string
   (e.g. an emoji) if the name isn't in the set. */
const ICONS = {
  pencil:'<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>',
  chart:'<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="6" width="3" height="11"/><rect x="17" y="13" width="3" height="4"/>',
  menu:'<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  check:'<path d="M9 11.5l2.5 2.5L20 5.5"/><path d="M20 12v6.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H15"/>',
  note:'<path d="M5 3.5h9L19 8.5V20a.5.5 0 0 1-.5.5h-13A.5.5 0 0 1 5 20Z"/><path d="M14 3.5V9h5"/>',
  list:'<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  dumbbell:'<path d="M4 8v8"/><path d="M7.5 6v12"/><path d="M16.5 6v12"/><path d="M20 8v8"/><path d="M7.5 12h9"/>',
  flame:'<path d="M12 3s5 3.6 5 8.5A5 5 0 0 1 7 11.5c0-1.6.9-2.7.9-2.7s.2 1.8 1.8 1.8c0-2.8 2.3-5.6 2.3-7.6Z"/>',
  calendar:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9.5h16"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  history:'<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8"/><path d="M3.5 4v4h4"/><path d="M12 8v4.2l3 1.8"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5l1.6 2.2 2.6-.6 .6 2.6 2.2 1.6-1.2 2.4 1.2 2.4-2.2 1.6-.6 2.6-2.6-.6L12 21.5l-1.6-2.2-2.6.6-.6-2.6-2.2-1.6 1.2-2.4-1.2-2.4 2.2-1.6.6-2.6 2.6.6Z"/>',
  radio:'<circle cx="12" cy="12" r="2"/><path d="M8 8a5.5 5.5 0 0 0 0 8"/><path d="M16 8a5.5 5.5 0 0 1 0 8"/><path d="M5 5a9.5 9.5 0 0 0 0 14"/><path d="M19 5a9.5 9.5 0 0 1 0 14"/>',
  // section / header / content icons
  lightbulb:'<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/>',
  smile:'<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  heart:'<path d="M12 20 4.6 12.6a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5Z"/>',
  briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
  book:'<path d="M12 6C10 4.6 7.2 4 4 4v14c3.2 0 6 .6 8 2 2-1.4 4.8-2 8-2V4c-3.2 0-6 .6-8 2Z"/><path d="M12 6v14"/>',
  wallet:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14" r="1.1"/>',
  phone:'<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M11 18h2"/>',
  trending:'<path d="M3 17l6-6 4 4 8-8"/><path d="M16 7h5v5"/>',
  scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 20"/><path d="M8.1 15.9 20 4"/>',
  droplet:'<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z"/>',
  sparkle:'<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4Z"/>',
  layers:'<path d="M12 3 3 8l9 5 9-5Z"/><path d="M3 13l9 5 9-5"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
  leaf:'<path d="M11 20A7 7 0 0 1 4 13C4 7 9 4 20 4c0 8-4 13-9 16Z"/><path d="M4 20c3-4 6.5-6 11-8"/>',
  dropletCare:'<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z"/><path d="M9 13a3 3 0 0 0 3 3"/>',
  zap:'<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
  star:'<path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17.3 6 20.4l1.4-6.3L2.6 9.8l6.4-.6Z"/>',
  plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',
  dot:'<circle cx="12" cy="12" r="4"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/>',
};
// section id → icon, and default-habit key → icon (custom items keep their emoji)
const SECTION_ICON = { mind:'lightbulb', wellbeing:'smile', health:'heart', work:'briefcase', learning:'book', finance:'wallet', digital:'phone', growth:'trending', haircare:'scissors', skincare:'droplet' };
const HABIT_ICON = { workout:'dumbbell', meditation:'sparkle', reading:'book', healthyFood:'leaf', faceWorkout:'smile', english:'radio', reading2:'book' };
function icon(name, size) { size = size || 20; const p = ICONS[name]; if (!p) return name || ''; return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`; }
// a rich accent-tinted chip around a line icon — the "polished" header treatment
function hicon(name) { return `<span class="hicon">${icon(name, 18)}</span>`; }
// strip a leading emoji (+ space) from a stored title so we can show a clean icon instead
function stripLeadEmoji(s) { return (s || '').replace(/^\s*[\p{Extended_Pictographic}\u{1f000}-\u{1ffff}☀-➿][\u{fe0f}‍\p{Extended_Pictographic}]*\s*/u, ''); }
/* Global emoji→icon decorator. Runs after each screen renders and swaps a leading emoji
   in any card header (h2) or menu-row icon for a clean line-icon chip — so every screen
   gets the professional treatment without editing dozens of template strings. */
const EMOJI_ICON = { '🧭':'target','🧑‍🏫':'star','😊':'smile','⚡':'zap','😴':'moon','🎯':'target','🏋️':'dumbbell','🏋':'dumbbell','💪':'dumbbell','🧠':'lightbulb','🔢':'list','✅':'check','📅':'calendar','📆':'calendar','🔥':'flame','🕸️':'radio','🕸':'radio','💡':'lightbulb','📌':'star','💬':'note','☁️':'radio','☁':'radio','⏰':'clock','🔔':'clock','💾':'layers','ℹ️':'dot','ℹ':'dot','📄':'note','📖':'book','🕘':'history','⏱️':'clock','⏱':'clock','🗒️':'note','🗒':'note','📋':'list','🎨':'sparkle','🍅':'target','📝':'pencil','🌊':'radio','😌':'smile','🩺':'heart','💼':'briefcase','📚':'book','💰':'wallet','📱':'phone','🌱':'trending','💇':'scissors','🧴':'droplet','📦':'layers','🎙️':'radio','🗓️':'calendar','🗓':'calendar','📊':'chart','⏳':'clock','⌛':'clock','🏃':'zap','🚌':'target','📈':'trending','🔒':'dot','🎉':'star','⏸':'clock','▶':'target','⏹':'dot','🎤':'radio','💊':'heart','🧘':'sparkle','🥗':'leaf','😁':'smile','📣':'radio','🤖':'dot','🚀':'trending','🍳':'flame','☕':'clock','🛒':'wallet','🎸':'radio','🌅':'sparkle' };
function lookupEmojiIcon(e) { return EMOJI_ICON[e] || EMOJI_ICON[e.replace(/️/g, '')] || null; }
function decorateHeaders(root) {
  if (!root) return;
  root.querySelectorAll('h2:not(.h2-icon)').forEach(h => {
    const t = h.firstChild; if (!t || t.nodeType !== 3) return;
    const m = t.nodeValue.match(/^\s*(\p{Extended_Pictographic}[\u{fe0f}\u{200d}\p{Extended_Pictographic}]*)\s*/u);
    if (!m) return; const ic = lookupEmojiIcon(m[1]); if (!ic) return;
    t.nodeValue = t.nodeValue.slice(m[0].length);
    h.classList.add('h2-icon'); h.insertAdjacentHTML('afterbegin', hicon(ic));
  });
  root.querySelectorAll('.menu-ico').forEach(s => {
    if (s.querySelector('svg')) return; const e = (s.textContent || '').trim(); const ic = lookupEmojiIcon(e);
    if (ic) { s.innerHTML = icon(ic, 20); s.classList.add('menu-ico-svg'); }
  });
}
// Re-decorate after ANY re-render (many screens rebuild innerHTML without going through show()).
let _decorTimer = null;
try {
  new MutationObserver(() => {
    if (_decorTimer) return;
    _decorTimer = setTimeout(() => {
      _decorTimer = null;
      const on = document.querySelector('.screen.on'); if (on) decorateHeaders(on);
      // if a re-render destroyed the focused field, focusout never fired — unhide the nav
      const a = document.activeElement;
      if (document.body.classList.contains('kbd-open') && !(a && a.matches && a.matches('input, textarea, [contenteditable]')))
        document.body.classList.remove('kbd-open');
    }, 30);
  }).observe(document.body, { childList: true, subtree: true });
} catch (e) {}

/* ============================================================
   FIRST-RUN ONBOARDING — shown once to brand-new users only
   (any existing data or the dp.onboarded flag skips it).
   Step 1 welcome → step 2 pick habits → step 3 pick activities.
   Unpicked items are hidden via the same customize configs, so
   everything remains changeable later in More ▸ Customize.
   ============================================================ */
let obStep = 0;
const obHideH = new Set(), obHideA = new Set();
// Deep-log sections: start light — only the core four preselected; the rest are
// opt-in here (and re-enableable anytime in Customize ▸ Deep log).
const obHideD = new Set(['health', 'finance', 'digital', 'growth', 'haircare', 'skincare']);
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
    <h1>Daylog</h1>
    <p class="ob-lead">Your whole life in one private tracker.</p>
    <div class="ob-privacy">🔒 <b>No Google account. No sign-up. No cloud.</b><br>Your data lives only on this phone — nothing is ever uploaded.</div>
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
    <button class="btn btn-primary" data-ob-next>Next</button>`;
  if (obStep === 3) body = `
    <h1>How deep do you want to go?</h1>
    <p class="ob-lead">The optional Deep log adds richer daily metrics. Pick only what you'll actually use.</p>
    <div class="habits ob-grid">${deepCfg().map(s => `
      <div class="habit ${obHideD.has(s.id) ? '' : 'on'}" data-ob-deep="${s.id}">
        <span class="check">✓</span><span class="emoji">${icon(SECTION_ICON[s.id] || 'layers', 16)}</span><span>${escapeHtml(stripLeadEmoji(s.title))}</span>
      </div>`).join('')}</div>
    <p class="ob-note">Skipped sections stay hidden — turn them on anytime in <b>Customize ▸ Deep log</b>.</p>
    <button class="btn btn-primary" data-ob-next>Next</button>`;
  if (obStep === 4) body = `
    <div class="ob-emoji">⏰</div>
    <h1>Never miss a day</h1>
    <p class="ob-lead">People who set a daily reminder keep their streak 3× longer.</p>
    <div class="card" style="text-align:left">
      <label class="ev-alarm-row" style="margin:0 0 10px"><input type="checkbox" id="ob-rem-on" checked> Remind me to log my day</label>
      <div class="field"><label>At</label><input type="time" id="ob-rem-time" value="21:00"></div>
    </div>
    <p class="ob-note">Change or add more anytime in <b>Settings ▸ Reminders</b>.</p>
    <button class="btn btn-primary" data-ob-next>Let's go 🚀</button>`;
  el.innerHTML = `<div class="ob-inner">${body}
    ${obStep > 0 ? '<button class="ob-back" data-ob-back>← back</button>' : ''}
    <div class="ob-dots">${[0, 1, 2, 3, 4].map(i => `<span class="${i === obStep ? 'on' : ''}"></span>`).join('')}</div></div>`;
}
document.addEventListener('click', (ev) => {
  const el = document.getElementById('onboard');
  if (!el || !el.classList.contains('on')) return;
  const hb = ev.target.closest('[data-ob-habit]');
  if (hb) { const k = hb.dataset.obHabit; obHideH.has(k) ? obHideH.delete(k) : obHideH.add(k); renderOnboard(); return; }
  const ac = ev.target.closest('[data-ob-act]');
  if (ac) { const k = ac.dataset.obAct; obHideA.has(k) ? obHideA.delete(k) : obHideA.add(k); renderOnboard(); return; }
  const dp = ev.target.closest('[data-ob-deep]');
  if (dp) { const k = dp.dataset.obDeep; obHideD.has(k) ? obHideD.delete(k) : obHideD.add(k); renderOnboard(); return; }
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
    const em = emojiSplit(name); acts.push({ id: 'ta' + Date.now(), emoji: em.emoji, name: em.name, color: CUSTOM_ACT_COLORS[acts.length % CUSTOM_ACT_COLORS.length] });
    DB.saveTimeacts(acts); renderOnboard(); return;
  }
  if (ev.target.closest('[data-ob-back]')) { obStep = Math.max(0, obStep - 1); renderOnboard(); return; }
  if (ev.target.closest('[data-ob-next]')) {
    if (obStep < 4) { obStep++; renderOnboard(); return; }
    // finish: apply picks as hidden-flags in the normal customize configs
    if (obHideH.size) { const cfg = habitCfg(); cfg.forEach(h => { if (obHideH.has(h.key)) h.hidden = true; }); saveHabitCfg(cfg); }
    if (obHideA.size) {
      const cfg = actCfg(); cfg.forEach(a => { if (obHideA.has(a.id)) a.hidden = true; }); saveActCfg(cfg);
      const cust = DB.timeacts(); let ch = false; cust.forEach(a => { if (obHideA.has(a.id)) { a.hidden = true; ch = true; } }); if (ch) DB.saveTimeacts(cust);
    }
    if (obHideD.size) { const dc = deepCfg(); dc.forEach(s => { if (obHideD.has(s.id)) s.hidden = true; }); saveDeepCfg(dc); }
    // daily-log reminder from the new onboarding step (retention: streaks live on reminders)
    const remOn = document.getElementById('ob-rem-on'), remT = document.getElementById('ob-rem-time');
    if (remOn && remOn.checked) {
      const rs = DB.reminders();
      rs.push({ id: 'rem' + Date.now(), time: (remT && remT.value) || '21:00', label: 'Log my day', enabled: true, mode: 'notify' });
      DB.saveReminders(rs); setupReminders();
      if (!nativeShell() && 'Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (_) {} }
    }
    localStorage.setItem('dp.onboarded', '1');
    localStorage.setItem('dp.whatsnew', WHATS_NEW.v);   // brand-new users: everything is new — skip the What's-new card
    el.classList.remove('on');
    show('today');
    startTour();   // walk brand-new users through everything once
  }
});


/* ============================================================
   GUIDED TOUR — spotlight walkthrough of the whole app.
   Auto-starts after onboarding; replayable from Settings.
   Each step navigates to the right screen, highlights the real
   element (spotlight cutout) and explains it. ============================================================ */
const TOUR = [
  { s: 'today', t: '.scale', h: 'Log your day in 60 seconds', b: 'Tap your mood & energy, tick your checklist — everything saves automatically as you go.' },
  { s: 'today', t: '#log-task-add', alt: '.task-summary', h: 'Tasks count themselves', b: 'Add tasks right here — your done/planned numbers fill in automatically. No typing counts by hand.' },
  { s: 'today', t: '#health-sync', alt: '.h2-icon', h: 'Auto-tracking from your phone', b: 'Steps, screen time & more sync in by themselves. Pick what to track in Settings ▸ Auto-tracking.' },
  { s: 'time', t: '.act-chip', h: 'The one-tap time tracker ⭐', b: 'Tap an activity to start its timer, tap another to switch — your whole day becomes a 24-hour timeline. Tracked Sleep & Work auto-fill your Log.' },
  { s: 'dash', t: '.pat-row', alt: '.pm-card', h: 'Your patterns', b: 'Daylog mines your raw data for real insights — your sleep sweet spot, which habit lifts your mood, your peak focus hours. All computed on your phone.' },
  { s: 'dash', t: '[data-dashtab="health"]', h: 'Health analytics', b: 'Steps, screen time, calories — charted and connected to your mood, so you can see what actually helps.' },
  { s: '__menu', t: '.drawer-row[data-screen="search"]', alt: '.drawer-list', h: 'Everything else lives in Menu', b: 'Search your entire life, History, Gym, Calendar, Focus timers… and pin ANY of these to the bottom bar with “Edit tabs”.' },
  { s: null, t: null, h: 'You\'re all set 🔥', b: 'Make every part yours in Settings ▸ Customize. Your data stays on your phone — private, always.' },
];
let tourIdx = -1;
function startTour() { tourIdx = 0; showTourStep(); }
function endTour() {
  tourIdx = -1; const o = document.getElementById('tour'); if (o) o.remove();
  try { closeDrawer(); } catch (_) {}
  localStorage.setItem('dp.toured', '1');
}
function showTourStep() {
  const st = TOUR[tourIdx];
  if (!st) { endTour(); toast('Enjoy Daylog 🔥'); return; }
  if (st.s === '__menu') { try { openDrawer(); } catch (_) {} }
  else { try { closeDrawer(); } catch (_) {} if (st.s) navigateTo(st.s); }
  setTimeout(() => {
    let el = st.t ? document.querySelector(st.t) : null;
    if (!el && st.alt) el = document.querySelector(st.alt);
    if (el) { try { el.scrollIntoView({ block: 'center' }); } catch (_) {} }
    setTimeout(() => renderTourOverlay(st, el), el ? 260 : 30);
  }, 380);
}
function renderTourOverlay(st, el) {
  let o = document.getElementById('tour');
  if (!o) { o = document.createElement('div'); o.id = 'tour'; document.body.appendChild(o); }
  const r = el ? el.getBoundingClientRect() : null;
  const pad = 8;
  const spot = r
    ? `<div class="tour-spot" style="top:${Math.max(2, r.top - pad)}px;left:${Math.max(4, r.left - pad)}px;width:${Math.min(window.innerWidth - 8, r.width + pad * 2)}px;height:${r.height + pad * 2}px"></div>`
    : '<div class="tour-spot tour-none"></div>';
  o.innerHTML = `${spot}<div class="tour-card tour-card-bottom">
    <div class="tour-step">${tourIdx + 1} / ${TOUR.length}</div>
    <div class="tour-h">${st.h}</div>
    <div class="tour-b">${st.b}</div>
    <div class="tour-btns">
      <button class="btn btn-ghost btn-sm" id="tour-skip">Skip</button>
      ${tourIdx > 0 ? '<button class="btn btn-ghost btn-sm" id="tour-back">‹ Back</button>' : ''}
      <button class="btn btn-primary btn-sm" id="tour-next">${tourIdx === TOUR.length - 1 ? 'Done 🔥' : 'Next ›'}</button>
    </div></div>`;
}
document.addEventListener('click', (ev) => {
  if (ev.target.id === 'tour-next') { tourIdx++; showTourStep(); return; }
  if (ev.target.id === 'tour-back') { tourIdx = Math.max(0, tourIdx - 1); showTourStep(); return; }
  if (ev.target.id === 'tour-skip') { endTour(); return; }
  if (ev.target.closest && ev.target.closest('#open-tour')) { show('today'); startTour(); return; }
});

/* ---------- Init ---------- */
// Migration: purge invalid-key entries ('' or non-dates) that the old unvalidated
// date picker could create — they crashed Stats and polluted exports.
(function () {
  try {
    const raw = localStorage.getItem('dp.entries'); if (!raw) return;
    const e = JSON.parse(raw); let dirty = false;
    Object.keys(e).forEach(k => { if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) { delete e[k]; dirty = true; } });
    if (dirty) safeSet('dp.entries', JSON.stringify(e));
  } catch (_) {}
})();
cleanNotifiedFlags();
applyTheme();
renderNav();
document.getElementById('nav').classList.add('ready');   // reveal the bar now that the correct tabs are rendered (no flash)
refreshStreak();
// Returning from the standalone How-to guide (index.html?go=settings) lands on Settings, not home.
const _go = new URLSearchParams(location.search).get('go');
navigateTo((_go && RENDER[_go]) ? _go : defaultTab());
if (_go) history.replaceState(null, '', location.pathname);   // clean the URL so a refresh goes home
if (needsOnboard()) { document.getElementById('onboard').classList.add('on'); renderOnboard(); }
else localStorage.setItem('dp.onboarded', '1');   // existing users never see it
setupReminders();
setTimeout(() => { if (localStorage.getItem('dp.onboarded') && !document.getElementById('onboard').classList.contains('on')) showWhatsNewPopup(); }, 1200);
setTimeout(() => checkReminders(true), 1000);   // catch a reminder you missed while the app was closed
// Ask Android what it will actually honour, so Settings can warn instead of failing silently.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !nativeShell()) return;
  refreshAlarmHealth().then(() => {          // they may have just granted it in Settings
    const s = document.getElementById('s-settings');
    if (s && s.classList.contains('on')) renderSettings();
  });
});
setTimeout(() => { refreshAlarmHealth().then(() => {
  const s = document.getElementById('s-settings');
  if (s && s.classList.contains('on')) renderSettings();
}); }, 2500);
// Gentle data-safety nudge: local-first means a lost phone = lost data. If there's real
// data and no backup for 14+ days, remind once a week (toast only — never a blocker).
setTimeout(() => {
  try {
    const n = Object.keys(DB.entries()).length; if (n < 10) return;
    const last = +localStorage.getItem('dp.lastBackup') || 0;
    const nudged = +localStorage.getItem('dp.backupNudge') || 0;
    const D = 86400000;
    if (Date.now() - last > 14 * D && Date.now() - nudged > 7 * D) {
      localStorage.setItem('dp.backupNudge', String(Date.now()));
      toast('💾 ' + n + ' days of data, no recent backup — export one in Settings ▸ Backup', true);
    }
  } catch (_) {}
}, 2500);
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
