/* ============================================================
   Daylog — local-first life tracker (PWA)
   Data lives in localStorage; optionally syncs to a Google Sheet.
   ============================================================ */

'use strict';

const APP_VERSION = 'v251';   // shown in More ▸ About so you can confirm the build on each device

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
function saveHabitCfg(cfg) { const ok = safeSet('dp.habitcfg', JSON.stringify(cfg)); reloadCfg(); pushState(); return ok; }
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
function saveDeepCfg(cfg) { const ok = safeSet('dp.deepcfg', JSON.stringify(cfg)); reloadCfg(); pushState(); return ok; }
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
function saveCoreCfg(cfg) { const ok = safeSet('dp.corecfg', JSON.stringify(cfg)); pushState(); return ok; }

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

/* A save that failed must never be reported as done. safeSet() does warn about a full phone,
   but only once an hour — so a second failure inside that window would otherwise be silent
   AND crowned with a "Saved ✅". Route every success toast that follows a write through here. */
/* Seeded preview rows carry `sample: true`, but that flag is ONLY read by the clear-sample
   routine — no analytics path filters on it. So while a preview is active, Stats, Habits,
   History and the PDF are computed over Math.random() days and were presenting them as real
   findings with nothing on screen to say so. Health and Awards already had a banner; this is
   the same banner, made reusable so every surface whose numbers move can carry it. */
function sampleActive() { try { return !!localStorage.getItem('dp.sampleMeta'); } catch (_) { return false; } }
function sampleBannerHTML(what) {
  if (!sampleActive()) return '';
  return `<div class="card sample-bar"><span>👀 Includes <b>sample data</b> — ${what} below are a preview, not your real figures.</span><button class="btn btn-ghost btn-sm" id="hc-sample-clear">Clear sample</button></div>`;
}

function savedToast(ok, msg) {
  if (ok === false) { toast('Could not save — your phone storage is full', true); return false; }
  toast(msg); return true;
}

/* ---------- Storage ---------- */
const DB = {
  entries() { return safeParse(localStorage.getItem('dp.entries'), {}); },
  // Returns false when the write failed (quota). Callers that tell the user "Saved" have to
  // know — a full phone used to show "Saved 🎉" over a write that never landed.
  saveEntries(e) { const ok = safeSet('dp.entries', JSON.stringify(e)); pushState(); return ok; },
  entry(date) { return this.entries()[date] || null; },
  putEntry(date, data) { const e = this.entries(); e[date] = data; return this.saveEntries(e); },

  tasks() { return safeParse(localStorage.getItem('dp.tasks'), []); },
  saveTasks(t) { const ok = safeSet('dp.tasks', JSON.stringify(t)); pushState(); return ok; },

  exercises() { const v = safeParse(localStorage.getItem('dp.exercises'), null); return Array.isArray(v) ? v : DEFAULT_EXERCISES.slice(); },
  saveExercises(x) { const ok = safeSet('dp.exercises', JSON.stringify(x)); pushState(); return ok; },
  gym() { return safeParse(localStorage.getItem('dp.gym'), {}); },
  saveGym(g) { const ok = safeSet('dp.gym', JSON.stringify(g)); pushState(); return ok; },
  gymDay(date) { return this.gym()[date] || { done: {}, log: {} }; },
  putGymDay(date, d) { const g = this.gym(); g[date] = d; return this.saveGym(g); },

  reminders() { return safeParse(localStorage.getItem('dp.reminders'), []); },
  saveReminders(r) { const ok = safeSet('dp.reminders', JSON.stringify(r)); pushState(); return ok; },

  notes() { return safeParse(localStorage.getItem('dp.notes'), []); },
  saveNotes(n) { const ok = safeSet('dp.notes', JSON.stringify(n)); pushState(); return ok; },

  plans() { return safeParse(localStorage.getItem('dp.plans'), []); },
  savePlans(p) { const ok = safeSet('dp.plans', JSON.stringify(p)); pushState(); return ok; },

  projects() { return safeParse(localStorage.getItem('dp.projects'), []); },
  saveProjects(p) { const ok = safeSet('dp.projects', JSON.stringify(p)); pushState(); return ok; },

  docs() { return safeParse(localStorage.getItem('dp.docs'), []); },
  saveDocs(d) { const ok = safeSet('dp.docs', JSON.stringify(d)); pushState(); syncDocs(); return ok; },

  events() { return safeParse(localStorage.getItem('dp.events'), []); },
  saveEvents(x) { const ok = safeSet('dp.events', JSON.stringify(x)); pushState(); syncEvents(); return ok; },

  pomo() { return safeParse(localStorage.getItem('dp.pomo'), null); },
  savePomo(p) { const ok = safeSet('dp.pomo', JSON.stringify(p)); pushState(); return ok; },
  timebox() { return safeParse(localStorage.getItem('dp.timebox'), []); },
  saveTimebox(t) { const ok = safeSet('dp.timebox', JSON.stringify(t)); pushState(); return ok; },

  timelog() { return safeParse(localStorage.getItem('dp.timelog'), []); },
  saveTimelog(t) { const ok = safeSet('dp.timelog', JSON.stringify(t)); pushState(); syncTimelog(); return ok; },
  timeacts() { return safeParse(localStorage.getItem('dp.timeacts'), []); },   // custom activities
  saveTimeacts(a) { const ok = safeSet('dp.timeacts', JSON.stringify(a)); pushState(); return ok; },

  settings() { return Object.assign({ syncUrl: '', reminderTime: '', name: '' }, safeParse(localStorage.getItem('dp.settings'), {})); },
  saveSettings(s) { const ok = safeSet('dp.settings', JSON.stringify(s)); return ok; },
};

/* ---------- Date helpers ---------- */
function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function addDays(str, n) { const d = new Date(str + 'T00:00:00'); d.setDate(d.getDate()+n); return todayStr(d); }
function prettyDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function isSunday(str) { return new Date(str + 'T00:00:00').getDay() === 0; }
/* Compact date for records and awards. prettyDate() leads with the weekday, so stripping
   after its comma leaves a bare "Thu" — useless on a shelf that spans years. Shows the
   year only when it is not the current one. */
function shortDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  const other = d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleDateString(undefined, other
    ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
}

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
/* A day counts as LOGGED only if something was actually recorded on it. An entry object can
   exist with no content at all — tap a habit, change your mind, untap it, and the autosave
   leaves {habits:{workout:false}, updatedAt, tasks:''} behind. Before this test, that ghost
   counted toward the streak, the milestones and the days-logged awards, which made the
   trophy case's own promise ("worked out from your log, so nothing can be faked") false.

   Deliberately conservative: a lone zero on an auto-mirrored counter is not content, and an
   all-false habits map is not content — but a SKIP (0) is, because choosing to skip is a
   choice you tapped. */
const ENTRY_META = ['updatedAt', 'tasks', 'tasksPlanned', 'sample'];
function entryHasContent(en) {
  if (!en) return false;
  for (const k of Object.keys(en)) {
    if (ENTRY_META.includes(k)) continue;
    const v = en[k];
    if (v == null || v === '' || v === false) continue;
    if (k === 'habits') {
      if (Object.values(v).some(x => x === true || typeof x === 'number')) return true;
      continue;
    }
    if (typeof v === 'string') { if (v.trim()) return true; continue; }
    if (typeof v === 'number') { if (v !== 0) return true; continue; }   // a mirrored 0 is not a log
    if (v === true) return true;
    if (typeof v === 'object') { if (Object.keys(v).length) return true; continue; }
  }
  return false;
}
function contentDates(ents) {
  const e = ents || DB.entries();
  return Object.keys(e).filter(d => entryHasContent(e[d])).sort();
}
function loggedStreak() {
  const e = DB.entries(); let n = 0; let cur = todayStr();
  // allow today to be unlogged without breaking the streak (count from yesterday)
  if (!entryHasContent(e[cur])) cur = addDays(cur, -1);
  while (entryHasContent(e[cur])) { n++; cur = addDays(cur, -1); }
  return n;
}
/* ---------- Weekly cadence ----------
   The research called this "the single most transferable decision" from Strava: Strava's
   streak is WEEKLY, not daily. A daily streak turns one bad day into a failure and one
   missed day into a reset, which is the all-or-nothing mode the whole app is built to avoid
   — Daylog already has the humane pieces (the skip state, the EMA strength score), and a
   weekly cadence completes them.

   A week counts if you logged at least WEEK_MIN of its days. The threshold is FIXED rather
   than configurable on purpose: the research names "rewards you can fake" as a demotivation
   mode, and a user-set minimum of 1 would turn the weekly award into a formality. 3 of 7 is
   reachable during a genuinely hard week without being a gimme.

   Weeks run Monday–Sunday, matching the ISO convention used everywhere else in the app. */
const WEEK_MIN = 3;

/* Monday of the week containing `d`. getDay() is 0 for Sunday, so Sunday maps back 6 days. */
function weekStart(d) {
  const wd = new Date(d + 'T00:00:00').getDay();
  return addDays(d, -((wd + 6) % 7));
}

/* One pass over the log, bucketed by week. Returns every week that has any logged day,
   oldest first, as { start, days, ok }. */
function weekBuckets(ents) {
  const e = ents || DB.entries();
  const by = {};
  Object.keys(e).forEach(d => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;      // an empty key would bucket as NaN
    if (!entryHasContent(e[d])) return;               // a ghost entry is not a logged day
    const w = weekStart(d);
    by[w] = (by[w] || 0) + 1;
  });
  return Object.keys(by).sort().map(w => ({ start: w, days: by[w], ok: by[w] >= WEEK_MIN }));
}

/* Consecutive qualifying weeks ending at the most recent COMPLETED week — plus this week
   separately, because a week still in progress must never break the streak. That is the
   entire point of a weekly cadence: you cannot fail a week you are still living. */
function weekStreak(ents) {
  const e = ents || DB.entries();
  const map = {};
  weekBuckets(e).forEach(b => { map[b.start] = b; });
  const thisW = weekStart(todayStr());
  const cur = map[thisW] || { start: thisW, days: 0, ok: false };
  let n = 0, w = addDays(thisW, -7);
  while (map[w] && map[w].ok) { n++; w = addDays(w, -7); }
  // A banked current week extends the run you can SEE, without being required for it.
  return { streak: n, current: cur, live: n + (cur.ok ? 1 : 0), min: WEEK_MIN, weekStart: thisW };
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
/* Implementation intention (Gollwitzer): a habit may carry a WHEN/WHERE plan — "after my
   morning coffee, at my desk". The research rated this the strongest single evidence base in
   the whole Strava set (around d = 0.65), and the effect comes from the FORMAT: an if-then
   plan, not a better name. Optional and absent by default, so there is nothing to migrate —
   every read goes through habitCue(), and every write deletes rather than storing ''. */
function habitCue(h) { return h && typeof h.cue === 'string' ? h.cue.trim() : ''; }
const CUE_MAX = 60;

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
function habitStrength(key, ents) {
  const e = ents || DB.entries(); const dates = Object.keys(e).sort();
  if (!dates.length) return 0;
  const mult = Math.pow(0.5, 1 / 13);
  const end = todayStr();
  /* Clamp the START of the walk, never the end. The old guard bailed after 4000 forward
     steps and returned the value from ~11 years BEFORE today as if it were current: one
     entry mis-dated to 2010 (the date input has max but no min, and the Android year wheel
     is easy to mis-scroll) reported strength 0 and silently erased every strength award.
     With a 13-day half-life anything older than ~3.3 years carries weight ~1e-28, so
     starting late costs nothing. 1200 days, not 400, because a long run of H_SKIP days
     deliberately does not decay and must still carry forward. Self-healing: a store that
     already holds a stray old date reads correctly on the next render, no migration. */
  const floor = addDays(end, -1200);
  let s = 0, cur = (dates[0] < floor ? floor : dates[0]), guard = 0;
  while (cur <= end && guard++ < 1300) {
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
    /* no-cors gives an OPAQUE response: we cannot read the status, so this means "sent",
       never "confirmed". Callers must not turn it into "synced ✓". */
    return true;
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
    const blob = backupBlob().data;
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
      entries: DB.entries(), tasks: DB.tasks(), notes: DB.notes(), plans: DB.plans(), projects: DB.projects(),
      reminders: DB.reminders(), gym: DB.gym(), exercises: DB.exercises(),
      timelog: DB.timelog(), timeacts: DB.timeacts(), events: DB.events(),
      docs: DB.docs(), habitcfg: habitCfg(), actcfg: actCfg(), deepcfg: deepCfg(), gymcfg: gymCfg(),
      corecfg: coreCfg(), daycfg: gymDays(), gymgroups: gymGroups(), navcfg: navCfg(),
      pomo: DB.pomo(), timebox: DB.timebox(), goals: DBgoals(),
      /* Added after the first cut of the sync. NOT here on purpose: dp.health (Health
         Connect readings never leave the phone — see the Data Safety note in Settings),
         and dp.cardratio (a per-device preference, not data). */
      projectnames: safeParse(localStorage.getItem('dp.pjnames'), {}),
      finaccts: finAccts(), fintx: finTx(), finmarks: finMarks(),
      finbudget: finBudgets(), fincats: safeParse(localStorage.getItem('dp.fincats'), []), finset: finSet(),
      gapskip: safeParse(localStorage.getItem('dp.gapskip'), {}),
      awards: safeParse(localStorage.getItem('dp.awards'), {}) };
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
/* Is a section from the sync endpoint safe to merge or adopt?
 *
 * applyRemoteState is the SECOND way foreign data enters this store. The first — importData —
 * was hardened in v237 to refuse anything that is not a Daylog backup. This path checked
 * `remote.touched` and nothing else, then trusted every section.
 *
 * Not theoretical. `remote.entries = "oops"` makes Object.keys() iterate the STRING's indices and
 * writes 13 junk day-keys into the journal, persisted. `remote.tasks = "garbage"` is adopted
 * wholesale, so DB.tasks() returns a string and the next .filter() throws — the app broken by a
 * sync, with the bad value already saved. The sync URL is the user's own Apps Script, so this is
 * a misconfigured or half-working endpoint rather than an attacker, which makes it more likely
 * rather than less.
 *
 * Shape is compared against what is ALREADY STORED rather than a hand-written map of which key
 * holds what. Such a map drifts the moment a section is added — the failure check-readme.mjs
 * had — while the local value is always current. With nothing stored yet (a fresh device) the
 * primitive rule still applies, and that is the case that actually breaks things.
 */
function remoteSectionOk(store, value) {
  if (value === null || typeof value !== 'object') return false;   // never adopt a primitive
  const cur = safeParse(localStorage.getItem(store), null);
  if (cur === null || typeof cur !== 'object') return true;        // nothing local to compare with
  return Array.isArray(cur) === Array.isArray(value);              // a list must stay a list
}

function applyRemoteState(remote) {
  if (!remote || !remote.touched) return;            // nothing in the cloud yet
  const localTouched = +(localStorage.getItem('dp.touched') || 0);
  const remoteNewer = remote.touched > localTouched; // the other device changed more recently
  let changed = false;
  const skippedSections = [];

  // Entries: FIELD-LEVEL merge by date. Newest updatedAt wins for shared fields,
  // but fields present on only one side are always kept — so a machine-generated
  // partial write (timeSummary, gym workoutsDone) on a stale device can NEVER
  // clobber another device's journal/mood/habits for that day. habits merge deeply.
  if (remote.entries && !(typeof remote.entries === 'object' && !Array.isArray(remote.entries))) skippedSections.push('entries');
  else if (remote.entries) {
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
  if (remote.gym && !(typeof remote.gym === 'object' && !Array.isArray(remote.gym))) skippedSections.push('gym');
  else if (remote.gym) {
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
  if (remote.timelog && !(Array.isArray(remote.timelog))) skippedSections.push('timelog');
  else if (remote.timelog) {
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
    [['tasks', 'dp.tasks'], ['notes', 'dp.notes'], ['plans', 'dp.plans'], ['projects', 'dp.projects'], ['reminders', 'dp.reminders'], ['exercises', 'dp.exercises'], ['timeacts', 'dp.timeacts'], ['events', 'dp.events'], ['docs', 'dp.docs'], ['habitcfg', 'dp.habitcfg'], ['actcfg', 'dp.actcfg'], ['deepcfg', 'dp.deepcfg'], ['gymcfg', 'dp.gymcfg'], ['corecfg', 'dp.corecfg'], ['daycfg', 'dp.daycfg'], ['gymgroups', 'dp.gymgroups'], ['navcfg', 'dp.navcfg'], ['timebox', 'dp.timebox'], ['goals', 'dp.goals'], ['projectnames', 'dp.pjnames'],
     ['finaccts', 'dp.finaccts'], ['fintx', 'dp.fintx'], ['finmarks', 'dp.finmarks'], ['finbudget', 'dp.finbudget'],
     ['fincats', 'dp.fincats'], ['finset', 'dp.finset']].forEach(([key, store]) => {
      if (!remote[key]) return;
      if (!remoteSectionOk(store, remote[key])) { skippedSections.push(key); return; }
      if (JSON.stringify(remote[key]) !== (localStorage.getItem(store) || 'null')) {
        safeSet(store, JSON.stringify(remote[key])); changed = true;
      }
    });
  }
  /* Outside the remoteNewer branch on purpose. These two are UNIONS, not adoptions: an award
     earned on either device is earned, and a gap you dismissed on either device stays
     dismissed. Adopting the remote copy wholesale would let a stale phone un-earn an award,
     which is the one thing the award ledger exists to prevent. */
  [['awards', 'dp.awards'], ['gapskip', 'dp.gapskip']].forEach(([key, store]) => {
    if (!remote[key] || typeof remote[key] !== 'object') return;
    const local = safeParse(localStorage.getItem(store), {}) || {};
    let hit = false;
    Object.keys(remote[key]).forEach(k => { if (!(k in local)) { local[k] = remote[key][k]; hit = true; } });
    if (hit) { safeSet(store, JSON.stringify(local)); changed = true; }
  });
  if (remoteNewer) {
    // Pomodoro: adopt remote SETTINGS + higher done-count, but NEVER the live `run`
    // countdown (that's device-local — a timer must not "run" on two phones).
    if (remote.pomo && (typeof remote.pomo !== 'object' || Array.isArray(remote.pomo))) skippedSections.push('pomo');
    else if (remote.pomo && remote.pomo.cfg) {
      const lp = DB.pomo() || { cfg: {}, run: null, done: { d: todayStr(), n: 0 } };
      const merged = { cfg: remote.pomo.cfg, run: lp.run, done: lp.done };
      if (remote.pomo.done && remote.pomo.done.d === todayStr() && (!lp.done || lp.done.d !== todayStr() || (remote.pomo.done.n || 0) > (lp.done.n || 0))) merged.done = remote.pomo.done;
      if (JSON.stringify(merged) !== JSON.stringify(lp)) { safeSet('dp.pomo', JSON.stringify(merged)); changed = true; }
    }
  }
  // Say what was ignored. A section dropped in silence looks exactly like a section that
  // synced — the same lie the backup path was fixed for.
  if (skippedSections.length) {
    toast(`Synced, but ${skippedSections.length} section(s) came back in the wrong shape and were ignored: ${skippedSections.join(', ')}`, true);
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
      <span class="bw-dur${h ? '' : ' bw-dur-empty'}" data-bw-dur="${f.key}">${h || '—'}</span>
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
  v: 'w21',
  items: [
    '📷 <b>Photos &amp; voice notes</b> — the Log has a new <b>Photos &amp; voice</b> card, under Reflection. Take a photo, add some from your gallery, or record a voice note while the day is still fresh, and tap any photo to see it full-screen, caption it or share it. On the Notes screen, <b>Photo</b> and <b>Voice</b> each save a new note. Everything stays on your phone. Photos are shrunk to a few hundred KB, still sharp full-screen, and their location data is removed. They go into your backup file, so a new phone gets them back. They are not sent to the Google Sheet. <b>On this day</b> now shows the photos you took a week, a month or a year ago; <b>History ▸ Photos</b> shows them all by month; and there is a <b>month-in-photos</b> share card.',
    '💌 <b>Tell a friend</b> — Settings ▸ Support. Send an invite card or a link on WhatsApp. Daylog has no marketing budget, so people mostly find it this way. Story-shaped share cards now carry a small QR code to the Play Store too.',
    '\ud83e\udeb6 <b>A calmer start</b> \u2014 Daylog had grown to nineteen screens and a Log page that opened with <b>38 deep-log rating scales</b> switched on, before you had written a single thing. New installs now begin with the Log, Time, Focus, Stats and Habits; the other thirteen sit behind <b>More features</b> in the menu, each described by what it does, one tap to add. Setup went from five steps to three. <b>Nothing changed for you</b> \u2014 your menu, your Deep log and your layout are exactly as you left them; this only affects a fresh install.',
    '\ud83d\udcbe <b>Export a backup as a real file again</b> \u2014 please update in the Play Store. Inside the app, exporting could only ever offer \u201ccopy to clipboard\u201d, and the Share button next to it did nothing at all: Android\u2019s WebView has no share API and blocks ordinary downloads, and the failure was being swallowed silently. The new build writes the file straight to your <b>Downloads</b> folder, so Import can pick it like any other file. Until you update, the copy box now says why and the Share button tells you instead of failing quietly.',
    '\ud83d\udcca <b>Money now has a Charts tab</b> \u2014 net worth over 12 months, your spending so far this month drawn against the same point last month, income vs spending by month, a ranked category breakdown, a typical-spend-by-weekday profile, a calendar of every day\u2019s spending, and 12-month trends per category that only say \u201crising\u201d or \u201cfalling\u201d past a 15% change rather than dressing up noise as a trend.<br><br>Three things were wrong and are fixed: net worth used to show an account opened today as already holding its balance a year ago \u2014 accounts now have a start date and count for nothing before it. The weekday chart used the average, which one monthly rent payment could turn into \u201cFriday is your most expensive day\u201d; it now uses the middle day instead. And the spending calendar was washed out by a single big bill setting the scale, so it now scales to your ordinary days and marks where it clips.',
    '\ud83d\udcb0 <b>Money</b> \u2014 a new screen in the \u2630 menu. Accounts, cash, credit cards, investments, property and loans in one place, with net worth worked out from them. Record money in, out and transfers; set optional caps per category; import a bank CSV and it works out which column is which (importing the same statement twice adds nothing). Balances are <b>derived from your own records</b>, so they can never disagree with your ledger, and amounts are held as whole paise rather than decimals \u2014 a hundred 10-paise entries come to exactly \u20b910, not \u20b99.99999999999998.<br><br>The part a finance app cannot do: your spending sits next to your mood, sleep and screen time in the same app, so <b>Patterns</b> can tell you things like \u201cyou spend \u20b9900 more a day on lower-mood days\u201d \u2014 split on your own median, with the sample size shown, and never reported below 6 days on either side. Nothing is uploaded, and there is no bank login.',
    '\ud83c\udfc5 <b>The trophy case, rebuilt</b> \u2014 every award used to be the same grey pill, so a 365-day streak looked exactly like a 3-day one, and the 49 you had not earned were invisible. Each award is now a <b>ranked medal</b> \u2014 Bronze through Diamond by how far up its family\u2019s ladder it sits \u2014 and the locked ones are shown too, dimmed, with exactly how far off you are. A progress ring counts your collection, and there is a per-family bar so you can see which ladder you are furthest up. The five metals were contrast-checked as text in light, navy and black, and every medal writes its rank in words, so none of it depends on telling two colours apart.',
    '\ud83d\udcf1 <b>Share cards default to Story</b> \u2014 9:16 instead of 4:5, because that is the shape Instagram, WhatsApp and Snapchat stories actually use full-screen; a 4:5 post gets letterboxed there. Change it once and it is remembered.',
    '\ud83e\udde9 <b>Untracked time, filled in by asking</b> \u2014 the Time screen now finds the stretches of a past day you never tracked and, where your own history actually supports a guess, asks: \u201c09:00\u201311:15 \u2014 were you \ud83d\udcbc Work?\u201d Tap yes and it is logged. It only names an activity when you logged it in that same window on at least 3 other days, it counts weekdays and weekends separately (sleep and work are exactly what differ), and it always shows the support \u2014 \u201c6 of your last 9 tracked weekdays\u201d \u2014 so you can judge the guess rather than trust it. Nothing is ever filled in on its own, and \u201cleave blank\u201d is remembered.',
    '\ud83d\uddc2\ufe0f <b>Projects</b> \u2014 a new screen in the \u2630 menu. Anything with an outcome and more than one step: a launch, a renovation, a course, a side business. Each project holds milestones, steps, a decision log and links, and shows one honest badge \u2014 <i>On track</i>, <i>Due in 3d</i>, <i>4d overdue</i> or <i>Untouched 12d</i>. The bit no other project tracker can do: hours come from <b>time you actually logged</b>, not hours you typed in. Time on a project is logged <b>as that project</b> \u2014 not under a borrowed tag \u2014 so it shows on your 24-hour timeline as \ud83d\uddc2\ufe0f the project name, in its own colour, and appears by name in where-the-time-went. Start it from the project or from the Projects row on the Time screen. A block belongs to one project or none, so two projects never claim the same hours \u2014 and a project with nothing tracked says so instead of showing a comforting zero.',
    '📊 <b>Stats looks like something now</b> — the overview opened with six identical grey boxes and no sense of direction. It now leads with your streak, then Mood, Energy and Polymath each with a 14-day sparkline and an arrow comparing this week to the one before. The three colours were checked for colour-blind readability and contrast in both light and dark, not just picked because they looked nice.',
    '🔔 <b>Notification fixes</b> — please update in the Play Store. Daylog\'s notifications showed a generic "i" instead of an icon, because there was no notification icon at all; there is now. And the activity-timer notification counts <b>live</b> — Android ticks it itself, so it keeps counting with the app closed, instead of just saying when you started. Pause and Stop are proper buttons.',
    '🏆 <b>Awards moved</b> — the trophy case is now its own screen in the ☰ menu, so Stats keeps all four of its tabs (Health was getting pushed off the edge on smaller phones).',
    '😊 <b>One mood input</b> — the grid now sets mood <i>and</i> energy in one tap and spans 1–10 across five levels, so the two separate sliders are hidden by default. Want the exact 1–10 sliders back? Customize ▸ Log screen fields.',
    '🌅 <b>Fresh start</b> — on a Monday, the 1st of a month or New Year\'s Day, the Log opens with what you actually did last week, month or year, and a clean slate ahead. One note per landmark, dismissible, and it never talks about losing anything. Hide it in Customize ▸ Log layout if you would rather not have it.',
    '🎯 <b>Goals — all of them, free</b> — Stats ▸ Overview. Any of nine measures over a week, a month or a year, as many as you like. Every goal shows exactly what is left and how much per remaining day would get there, and “Suggest” fills in what <i>you</i> actually averaged over your last three periods rather than inventing a number. Other trackers charge for this.',
    '🗓️ <b>Month in review</b> — Stats ▸ Overview. A five-card wrap-up of any month you have logged: the shape of the month, your habits ranked, how it felt, where the time went. In the first ten days of a new month it points at the month just finished. Nothing expires — every month stays browsable.',
    '⏱️ <b>Post-activity save</b> — stop a timer that ran more than two minutes and Daylog asks what it was, how hard it felt (1–10) and anything worth remembering. The block is already logged before you are asked, so you can skip it and lose nothing. Add or edit details on any past block from the 24-hour timeline.',
    '📅 <b>Weekly streaks</b> — a week counts once you log any 3 of its days, and the today-ring card tells you the moment this week is banked. A daily streak makes one bad day a failure; a weekly one absorbs real life. There are tiered awards for 2, 4, 8, 12, 26 and 52 weeks in a row.',
    '📍 <b>Plan a when &amp; where</b> — give any habit a cue like “after my morning coffee, at my desk”. It shows on that habit\'s chip until you tick it off. This is the best-evidenced habit trick there is: naming <i>when</i> and <i>where</i> beats naming the habit. Set one in Customize ▸ Checklist habits, or tap 📍 on the Habits screen.',
    '📈 <b>You vs you</b> — Stats ▸ Overview now compares your last week, last 4 weeks, or the same 4 weeks a year ago against your own past. No leaderboards and no other people: the only person on the other side is you. When there isn\'t enough history it tells you the date it unlocks instead of guessing.',
    '🏆 <b>Trophy case</b> — Stats ▸ Awards. 60 awards across 9 families, tiered so a big goal pays out along the way. Worked out from your own log, so nothing can be faked and nothing is ever taken away. “Next up” shows how close you are.',
    '🖼️ <b>Share cards</b> — turn a streak, your year in pixels, your habits, an insight or an award into a picture. Drawn on your phone from your own data; only the image is ever shared.',
    '❤️ <b>Real auto-tracking</b> — steps, distance, calories, sleep, workouts and heart rate now come from <b>Health Connect</b>, alongside the automatic screen time. Settings ▸ Auto-tracking ▸ Connect Health Connect. Every metric is a separate switch, and anything you don\'t allow simply stays blank.',
    '🔔 <b>Pick your own alarm sound</b> — Customize ▸ Alarm sound. Choose any alarm tone on your phone (or your own audio file), preview it, and turn vibration on or off. Needs the Play Store update.',
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
    '🧭 <b>Pin any tabs you want</b> to the bottom bar — ☰ Menu ▸ Edit this menu',
    '🎙️ <b>Voice typing works in the app</b> — update Daylog in the Play Store, then tap Speak',
    '🎉 <b>Streak rewards</b> — full-screen celebration at 3, 5, 7, 10, 14… day streaks',
    '🔗 <b>Connected insights</b> in Stats — how sleep drives your mood, week vs last week',
    '⏱ <b>Time tracker fills your Log</b> — tracked Sleep/Work auto-fill the fields',
    '🧭 <b>Choose your bottom tabs</b> — Settings ▸ Customize ▸ Tabs & navigation',
    '📄 <b>PDF report + backup export</b> now work inside the app',
  ],
};
function whatsNewHTML() { return ''; }   // replaced by the popup (showWhatsNewPopup)
/* Someone using Daylog in an ANDROID BROWSER is one tap from the Play app, which can do what a
   web page cannot: ring an alarm with the screen off, read Health Connect, measure screen
   time. Say so once, plainly, and get out of the way — "Not now" is 30 days of silence and
   "Get it" is forever. Data does not follow them across (the app's WebView has its own
   storage), so anyone with entries is told how to carry them over before they go. */
const PLAY_NUDGE_SNOOZE = 30 * 86400000;
function playNudgeDue() {
  if (window.Capacitor || !/Android/i.test(navigator.userAgent || '')) return false;
  const st = safeParse(localStorage.getItem('dp.playNudge'), null) || {};
  if (st.done) return false;
  return !st.snoozed || Date.now() - st.snoozed > PLAY_NUDGE_SNOOZE;
}
function playNudgeHTML() {
  if (!playNudgeDue()) return '';
  const n = contentDates().length;
  return `<div class="card play-nudge" id="play-nudge">
    <div class="pn-h">${hicon('phone')}<b>Daylog is on Google Play</b></div>
    <p>The same app, plus what a browser cannot do: alarms that ring while your phone is asleep, steps and sleep from Health Connect, and automatic screen time. Free, no account.</p>
    ${n ? `<p class="pn-dim">Your ${n} logged day${n === 1 ? '' : 's'} here will not move across by themselves: <b>Settings ▸ Backup ▸ Export</b> here, then <b>Import</b> in the app.</p>` : ''}
    <div class="pn-btns">
      <a class="btn btn-primary" id="pn-go" href="${escapeHtml(playLink('pwa', 'web', 'nudge'))}" target="_blank" rel="noopener">Install the app</a>
      <button class="btn btn-ghost" id="pn-later">Not now</button>
    </div></div>`;
}
document.addEventListener('click', (ev) => {
  if (!ev.target.closest) return;
  if (ev.target.closest('#pn-go')) { safeSet('dp.playNudge', JSON.stringify({ done: true })); setTimeout(() => { const el = document.getElementById('play-nudge'); if (el) el.remove(); }, 300); return; }
  if (ev.target.closest('#pn-later')) {
    safeSet('dp.playNudge', JSON.stringify({ snoozed: Date.now() }));
    const el = document.getElementById('play-nudge'); if (el) el.remove();
  }
});
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
  // A day with only a photo counts too: a picture from a year ago is the best "on this day".
  const hits = marks.filter(m => e[m.d] || mediaDayCount(m.d).p).slice(0, 2);
  if (!hits.length) return '';
  const rows = hits.map(m => {
    const en = e[m.d] || {};
    const pics = mediaList('log', m.d).filter(r => r.kind === 'photo').slice(0, 3);
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
      ${pics.length ? `<div class="otd-pics">${pics.map(r => `<button class="mthumb" data-mview="${r.id}" aria-label="Photo from ${escapeHtml(prettyDate(m.d))}"><img src="${mediaUrl(r, 't')}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>` : ''}
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
  if (tb && !ev.target.closest('[data-mview]')) { logDate = tb.dataset.throwback; loadDraft(); renderToday(); toast('Opened ' + prettyDate(logDate)); }
});

/* ---------- Mood Meter (How We Feel / RULER's model) ----------
   Their insight: people can't name what they feel, so don't ask them to invent a word —
   GIVE them one. Pleasantness x energy is exactly the mood/energy pair we already store,
   so one tap on the grid sets both, and the quadrant then offers precise vocabulary that
   lands in the journal as a #tag (searchable by our existing tag search). */
/* 5 levels per axis, spanning 1-10 evenly. This replaced the two separate 1-10 sliders:
   one tap now sets mood AND energy, which is what the two scales were doing in two steps.
   5x5 rather than the old 4x4 because dropping the sliders costs resolution, and 1/3/5/7/9
   covers the range far better than 2/4/7/9 did. 25 cells is still ~62px each at 360px.
   Anyone who wants exact 1-10 values can re-show the sliders in Customize > Main fields. */
const MM_COLS = [1, 3, 5, 7, 9];     // pleasantness -> mood 1-10
const MM_ROWS = [9, 7, 5, 3, 1];     // energy, high at the top
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
  /* Gate on the fields EXISTING, not on them being visible. The old check used the visible
     set, so hiding the two sliders — which this grid is meant to replace — also deleted the
     grid, leaving no way to log mood at all. */
  const keys = coreCfg().map(f => f.key);
  if (!keys.includes('mood') || !keys.includes('energy')) return '';       // needs both axes
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
    // The quadrant colour is tuned for the CELL FILL. As 12.5px label text on white it
    // only reaches 4.01:1, so the label takes a mode-aware ink class instead (same split
    // as --good-ink / --bad-ink). Do not put q.c back on text.
    head = `<b class="mmq-${key}">${q.label}</b> · mood ${m}, energy ${en}`;
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
  { id: 'fresh',     label: 'Fresh start',      sub: 'a note on Mondays, 1sts and new years' },
  { id: 'ring',      label: 'Today ring',       sub: "how much of today you've logged" },
  { id: 'onthisday', label: 'On this day',      sub: 'your entry from a week / month / year ago' },
  { id: 'core',      label: 'Date & main fields', sub: 'mood, energy, sleep, deep work…', lock: true },
  { id: 'moodgrid',  label: 'Mood grid',        sub: 'set mood and energy with one tap' },
  { id: 'tasks',     label: 'Tasks',            sub: "today's task count + quick add" },
  { id: 'checklist', label: 'Daily checklist',  sub: 'your habits' },
  { id: 'workout',   label: 'Workout',          sub: "link to today's gym log" },
  { id: 'health',    label: 'Health',           sub: 'auto-tracked steps, sleep, screen time' },
  { id: 'reflection',label: 'Reflection',       sub: 'wins, improvements, journal' },
  { id: 'media',     label: 'Photos & voice',   sub: 'pictures and voice notes from your day' },
  /* `off` = hidden on a FRESH install only. A saved dp.logsec always wins, so nobody who
     already uses these loses anything. The Deep log is 10 sections and 38 rating scales, and
     every one of them rendered on the Log screen on day one — the onboarding step even said
     "pick only what you'll actually use" and then pre-ticked all ten. It is the single
     biggest reason the app feels like work before you have logged anything. */
  { id: 'deep',      label: 'Deep log',         sub: 'the optional polymath metrics', off: true },
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
  /* A section added in a later release appears for everyone (hidden:false) EXCEPT ones
     marked `off`, which stay out of the way until switched on in Customize. */
  /* It lands right after the section it follows in the defaults, not at the very bottom —
     otherwise Photos & voice (v251) would sit under the Sunday review for everyone who has
     ever saved a layout, which is almost everyone. */
  LOG_SECTIONS_DEF.forEach((d, i) => {
    if (out.some(o => o.id === d.id)) return;
    const row = Object.assign({}, d, { hidden: !!d.off });
    const prev = i > 0 ? out.findIndex(o => o.id === LOG_SECTIONS_DEF[i - 1].id) : -1;
    if (prev >= 0) out.splice(prev + 1, 0, row); else out.push(row);
  });
  return out;
}
function saveLogSec(list) {
  safeSet('dp.logsec', JSON.stringify(list.map(x => ({ id: x.id, hidden: !!x.hidden }))));
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

/* The mood grid replaced the two separate 1-10 sliders: one tap sets mood AND energy, where
   the sliders needed two, and having both on the Log was the same question asked twice.
   Hide the sliders once, and only when the grid is actually there to replace them — never
   leave someone with no way to log mood. Fully reversible in Customize > Main fields, and
   the historical 1-10 values are untouched. */
(function migrateMoodInput() {
  if (localStorage.getItem('dp.moodInputMigrated') === '1') return;
  try {
    if (!logSecHidden('moodgrid')) {
      const cfg = coreCfg(); let touched = false;
      ['mood', 'energy'].forEach(k => {
        const row = cfg.find(f => f.key === k);
        if (row && !row.hidden) { row.hidden = true; touched = true; }
      });
      if (touched) saveCoreCfg(cfg);
    }
  } catch (e) {}
  localStorage.setItem('dp.moodInputMigrated', '1');
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
/* Celebrations used to call navigator.vibrate directly, so a user who had turned haptics
   OFF still got buzzed by every milestone and award. Alarms deliberately do not use this —
   an alarm you asked for must still be able to wake you. */
function buzzPattern(pat) {
  if (localStorage.getItem('dp.hapticsOff') === '1') return;
  try { navigator.vibrate && navigator.vibrate(pat); } catch (e) {}
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
      ${weekLineHTML()}
    </div>
  </div>`;
}
/* The weekly line. Its job is to remove daily-failure pressure: once the week is banked it
   says so plainly, so a missed day tomorrow costs nothing. */
function weekLineHTML() {
  const w = weekStreak();
  const banked = w.current.ok;
  const need = Math.max(0, w.min - w.current.days);
  const run = w.live;
  const runTxt = run > 1 ? ` · <b>${run}-week streak</b>` : '';
  return `<div class="ring-week${banked ? ' ok' : ''}">${banked
    ? `✓ This week counted — ${w.current.days} of 7 days logged${runTxt}`
    : `This week: ${w.current.days} of 7 · <b>${need} more</b> to count it${runTxt}`}</div>`;
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
  const ce2 = ev.target.closest && ev.target.closest('[data-cue-edit]');
  if (ce2) {
    customPage = 'habits'; show('custom');            // show() renders synchronously
    // Focus AFTER show(), because show() calls window.scrollTo(0,0) once the screen has
    // rendered — doing this inside renderCustom would be immediately undone.
    const i = document.querySelector(`[data-cfg-cue="${ce2.dataset.cueEdit}"]`);
    if (i) { i.focus(); try { i.scrollIntoView({ block: 'center' }); } catch (e) {} }
    return;
  }
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
    const gok = saveHabitCfg(cfg); m.style.display = 'none'; renderCustom(); savedToast(gok, 'Goal saved 🎯'); return;
  }
  if (ev.target.id === 'ge-remove') {
    const cfg = habitCfg(); const h = cfg.find(x => x.key === m.dataset.key); if (!h) return;
    delete h.goal; const wrote0 = saveHabitCfg(cfg); m.style.display = 'none'; renderCustom(); savedToast(wrote0, 'Back to a simple tick'); return;
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
    // `added` scopes the 'perfect day' award: a habit created today must not demote every
    // past day for not containing it.
    const item = { key: 'ch' + Date.now(), emoji: preset.emoji, label: preset.label, custom: true, added: todayStr() };
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

/* Label + optional cue as ONE flexible column. With no cue this returns exactly the markup
   it always did, so the chip's flex layout — and the min-width:0 fix that stopped badges
   being pushed out of the chip — is untouched for every user who never sets one. */
function chipTextHTML(h) {
  const cue = logDate === todayStr() ? habitCue(h) : '';   // a plan for 12 days ago is noise
  if (!cue) return `<span class="hlbl">${escapeHtml(h.label)}</span>`;
  return `<span class="htxt"><span class="hlbl">${escapeHtml(h.label)}</span>`
       + `<span class="hcue">📍 ${escapeHtml(cue)}</span></span>`;
}

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
      ${chipTextHTML(h)}
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
    ${chipTextHTML(h)}${sk?'':(st>1?`<span class="streak">${icon('flame',13)}${st}</span>`:'')}</div>`;
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
      <textarea data-txt="${f.key}" placeholder="Write a line or two…">${escapeHtml(draft[f.key] || '')}</textarea></div>`).join('');
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
    fresh: () => freshHTML(),
    ring: () => todayRingHTML(),
    onthisday: () => `<div id="otd-slot">${throwbackHTML()}</div>`,
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
        <input type="text" id="log-habit-input" placeholder="Add a checklist item…" autocomplete="off">
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
    media: () => mediaLogCardHTML(logDate),
    deep: () => `<h2 style="margin:22px 4px 10px;font-size:13px;color:var(--text-dim);font-weight:600;letter-spacing:.3px;text-transform:uppercase">Deep log <span class="hint" style="text-transform:none">optional · the polymath metrics</span></h2>
      ${renderDeepSections()}`,
    weekly: () => (isSunday(logDate) ? `<div class="card"><h2>📅 Sunday weekly review</h2>
      <div class="field"><label>Wins this week</label><textarea data-txt="weekWins" placeholder="Write a line or two…">${escapeHtml(draft.weekWins||'')}</textarea></div>
      <div class="field"><label>Focus for next week</label><textarea data-txt="weekFocus" placeholder="Write a line or two…">${escapeHtml(draft.weekFocus||'')}</textarea></div></div>` : ''),
  };
  const secHTML = logSecCfg()
    .filter(sec => !sec.hidden && SEC[sec.id])
    .map(sec => SEC[sec.id]())
    .join('\n');

  document.getElementById('s-today').innerHTML = `
    ${whatsNewHTML()}
    ${playNudgeHTML()}
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
/* ---------- Support Daylog ----------
   A tip jar, through Google Play Billing, because that is the only rail Play's anti-steering
   rule allows inside the app (the policy's single mention of donations exempts TAX EXEMPT
   ones, which an individual developer's are not). A zero-cut UPI link belongs on the
   website, which is outside the app and outside the rule.

   A donation buys NOTHING. No feature, no badge, no stored supporter flag — deliberately, so
   it stays an honest thank-you rather than a purchase, and so no part of the app can ever
   behave differently for someone who paid.

   The prices shown are the ones Play returns, never typed here: with no products configured
   the plugin reports available:false and this whole feature renders nothing. A donate card
   with invented amounts in it would be worse than no donate card.

   Asked at most twice ever, on the dismissal of a celebration, sharing the same restraint as
   the review ask — and never in the same session as one, because back-to-back asking is how
   goodwill is spent. */
const TIP_MAX_ASKS = 2;
function tipPlugin() {
  const p = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.DaylogBilling;
  return (p && typeof p.products === 'function') ? p : null;
}
function tipState() { return safeParse(localStorage.getItem('dp.tip'), { asks: 0, last: 0, gave: false }) || { asks: 0, last: 0, gave: false }; }
function tipSave(st) { localStorage.setItem('dp.tip', JSON.stringify(st)); }

async function maybeAskForTip() {
  try {
    const pl = tipPlugin(); if (!pl) return;
    const st = tipState();
    if (st.gave || st.asks >= TIP_MAX_ASKS) return;
    if (st.asks >= 1 && Date.now() - st.last < 30 * 86400000) return;   // a month between asks
    if (contentDates().length < 14) return;      // two weeks of real use before asking for money
    const res = await pl.products();
    if (!res || !res.available || !(res.products || []).length) return;  // nothing configured: say nothing
    tipShow(res.products);
    tipSave({ asks: st.asks + 1, last: Date.now(), gave: false });
  } catch (e) { /* a tip ask must never be the thing that breaks a celebration */ }
}

/* The Settings row: the person went looking, so none of the asking limits apply and it does
   not count as an ask. Shown only inside the Play app (no plugin, no row) — in a browser there
   is no Play Billing, and pointing anywhere else would break the anti-steering rule. */
async function tipOpen() {
  const pl = tipPlugin(); if (!pl) return;
  try {
    const res = await pl.products();
    if (!res || !res.available || !(res.products || []).length) { toast('Tips are not available right now \u2014 try again later'); return; }
    tipShow(res.products, false);
  } catch (e) { toast('Could not reach Google Play', true); }
}

/* Play hands back "₹49.00"; whole amounts read as prices, not invoices. Only a trailing
   zero fraction goes — "₹1,00,000" and "€1,50" are left alone. */
function tipPrice(p) { return String(p || '').replace(/[.,]00(?=\D*$)/, ''); }

/* A bottom sheet: pick an amount, then one clear button pays it. The old card bought on the
   first tap while also showing a "selected" amount, so the highlight meant nothing. */
function tipShow(products, asked = true) {
  const once = products.filter(p => p.type === 'once').sort((a, b) => (a.micros || 0) - (b.micros || 0));
  const month = products.find(p => p.type === 'monthly');
  /* Middle option pre-selected: a blank "choose an amount" converts far worse than three
     anchors, and the middle of three is where most people land. */
  const mid = once.length === 3 ? 1 : Math.max(0, once.length - 1);
  const words = i => i === 0 ? 'a little' : i === mid ? 'a coffee' : 'generous';
  let el = document.getElementById('tip-ask');
  if (!el) { el = document.createElement('div'); el.id = 'tip-ask'; el.className = 'sharesheet'; document.body.appendChild(el); }
  const pick = once[mid];
  el.innerHTML = `<div class="tip-card" role="dialog" aria-modal="true" aria-labelledby="tip-h">
    <div class="tip-grip" aria-hidden="true"></div>
    <div class="tip-badge" aria-hidden="true">${icon('heart', 24)}</div>
    <h2 id="tip-h">Enjoying Daylog?</h2>
    <p class="tip-p">Daylog is free and stays free, with no ads and nothing locked. It's made
      by one person, so if it helps you, you can say thanks with a tip.</p>
    ${once.length ? `<div class="tip-opts" role="radiogroup" aria-label="Tip amount">${once.map((p, i) => `
      <button class="tip-opt ${i === mid ? 'on' : ''}" role="radio" aria-checked="${i === mid}"
        data-tip-pick="${escapeHtml(p.id)}" data-price="${escapeHtml(tipPrice(p.price))}">
        <b>${escapeHtml(tipPrice(p.price))}</b><span>${words(i)}</span>
      </button>`).join('')}</div>
    <button class="btn btn-primary tip-go" data-tip-buy="${escapeHtml(pick.id)}">Tip ${escapeHtml(tipPrice(pick.price))}</button>` : ''}
    ${month ? `<button class="tip-month" data-tip-buy="${escapeHtml(month.id)}">
      ${once.length ? 'Or support' : 'Support'} monthly · <b>${escapeHtml(tipPrice(month.price))}/month</b></button>` : ''}
    <button class="tip-no" id="tip-no">Not now</button>
    <p class="tip-fine">Paid through Google Play. A tip changes nothing in the app.${month ? ' Cancel monthly any time in Play Store.' : ''}${asked ? ' We only ask twice, ever.' : ''}</p>
  </div>`;
  el.classList.add('on');
}

document.addEventListener('click', async (ev) => {
  const el = document.getElementById('tip-ask');
  if (!el || !el.classList.contains('on')) return;
  // Not now, or a tap on the dimmed area above the sheet.
  if (ev.target.closest('#tip-no') || !ev.target.closest('.tip-card')) { el.classList.remove('on'); return; }
  const o = ev.target.closest('[data-tip-pick]');
  if (o) {
    el.querySelectorAll('.tip-opt').forEach(x => { const on = x === o; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
    const go = el.querySelector('.tip-go');
    if (go) { go.dataset.tipBuy = o.dataset.tipPick; go.textContent = 'Tip ' + o.dataset.price; }
    buzz(8);
    return;
  }
  const b = ev.target.closest('[data-tip-buy]');
  if (!b) return;
  const pl = tipPlugin(); if (!pl) { el.classList.remove('on'); return; }
  el.classList.remove('on');
  try {
    const r = await pl.buy({ id: b.dataset.tipBuy });
    if (r && r.status === 'thanks') {
      const st = tipState(); st.gave = true; tipSave(st);   // never ask this person again
      toast('Thank you — genuinely 🙏');
      buzz(20);
    } else if (r && r.status === 'failed') {
      toast('That did not go through' + (r.reason ? ' — ' + r.reason : ''), true);
    }
    /* cancelled: say nothing at all. Nobody needs a notification that they changed their mind. */
  } catch (e) { toast('Could not open Google Play', true); }
});

/* ---------- The one review ask ----------
   Reviews gate every distribution channel, and this app never asks for one. The rules that
   keep this from becoming the nagging every store app does:
     · Only at a genuine high point — the moment a 7-day-or-better streak milestone or an
       award celebration is DISMISSED, never at launch and never mid-task.
     · Only after real use: 7+ logged days.
     · Asked at most twice, ever. "Maybe later" retries once, 14+ days later; a second
       dismissal or a tap on Rate ends it permanently. dp.rateAsk stores the state.
     · Inside the shell the Play listing opens via market:// (Capacitor hands unknown
       schemes to the system); in a browser it opens the web listing. */
let _rateArm = false;   // set by a qualifying celebration; consumed on its dismissal
const RATE_URL_APP = 'market://details?id=io.github.kishore2494.dailypulse';
const RATE_URL_WEB = 'https://play.google.com/store/apps/details?id=io.github.kishore2494.dailypulse';
function rateState() { return safeParse(localStorage.getItem('dp.rateAsk'), { asks: 0, last: 0, done: false }) || { asks: 0, last: 0, done: false }; }
function rateSave(st) { localStorage.setItem('dp.rateAsk', JSON.stringify(st)); }
function maybeAskForReview() {
  try {
    if (!nativeShell()) return;                                  // only where a store rating exists
    const st = rateState();
    if (st.done || st.asks >= 2) return;
    if (st.asks === 1 && Date.now() - st.last < 14 * 86400000) return;
    if (contentDates().length < 7) return;                      // 7 REAL days, not ghost entries
    const el = document.getElementById('rate-ask') || (() => {
      const d = document.createElement('div'); d.id = 'rate-ask'; d.className = 'sharesheet';
      document.body.appendChild(d); return d; })();
    el.innerHTML = `<div class="ss-inner rate-card">
      <div class="rate-emoji">🙏</div>
      <h2>A one-time ask</h2>
      <p class="rate-p">Daylog is built by one person, with no company and no ads. If it has
        been useful, a rating on the Play Store is genuinely the thing that helps most —
        it is how other people find an app with no marketing budget.</p>
      <p class="rate-p rate-dim">This is asked ${st.asks === 0 ? 'at most twice, ever' : 'only this once more'}. Nothing here nags.</p>
      <div class="pj-btns" style="justify-content:center">
        <button class="btn btn-primary" id="rate-go">Rate Daylog</button>
        <button class="btn btn-ghost" id="rate-later">${st.asks === 0 ? 'Maybe later' : 'No thanks'}</button>
      </div></div>`;
    el.classList.add('on');
    rateSave({ asks: st.asks + 1, last: Date.now(), done: false });
  } catch (e) {}
}
document.addEventListener('click', (ev) => {
  const el = document.getElementById('rate-ask');
  if (!el || !el.classList.contains('on')) return;
  if (ev.target.id === 'rate-go') {
    const st = rateState(); st.done = true; rateSave(st);
    el.classList.remove('on');
    // market:// first (opens the Play app); the web URL is the browser/desktop path.
    try { window.location.href = nativeShell() ? RATE_URL_APP : RATE_URL_WEB; } catch (e) {}
    return;
  }
  if (ev.target.id === 'rate-later' || ev.target === el) {
    const st = rateState(); if (st.asks >= 2) st.done = true; rateSave(st);
    el.classList.remove('on'); return;
  }
});

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
  shown[key] = 1; safeSet('dp.milestones', JSON.stringify(shown));
  if (celebSpent()) { toast('🔥 ' + st + ' days in a row!'); buzz(18); return; }
  celebSpend();
  showMilestone(st);
  if (st >= 7) _rateArm = true;   // ask when the celebration is dismissed, not over it
}

/* At most ONE full-screen celebration per day. The behaviour audit measured ~25 full-screen
   popups in a heavy first month — a milestone and two awards could stack on a single save.
   A reward that interrupts three times in a row is not a reward, it is training the user to
   dismiss celebrations unread. The first qualifying moment of the day keeps the confetti;
   everything after becomes a toast, and awards land in the trophy case either way, so
   nothing is lost — only the interruption. */
function celebSpent() {
  const c = safeParse(localStorage.getItem('dp.celeb'), {}) || {};
  return c.d === todayStr() && (c.n || 0) >= 1;
}
function celebSpend() {
  const c = safeParse(localStorage.getItem('dp.celeb'), {}) || {};
  localStorage.setItem('dp.celeb', JSON.stringify({ d: todayStr(), n: (c.d === todayStr() ? (c.n || 0) : 0) + 1 }));
}
/* Awards can be earned by editing ANY past day, not just today, so this runs on every
   save. Only genuinely new awards are announced, and at most one at a time — a batch of
   popups is a punishment, not a reward. */
/* saveDraftNow fires on every habit tap and every pause in typing, and the award scan was
   measured at 71% of it (25ms of 35ms at 1000 entries). Coalesce bursts into one trailing
   run ~2s later; awardsFlush() forces it when the user is about to SEE the result. */
let _awTimer = null, _awDate = null;
// Backgrounding or closing the app must not eat a pending scan — Android can kill the
// WebView at any point after onPause, and a dropped timer would lose the award silently.
document.addEventListener('visibilitychange', () => { if (document.hidden) { try { awardsFlush(); } catch (e) {} } });
window.addEventListener('pagehide', () => { try { awardsFlush(); } catch (e) {} });
function checkNewAwardsSoon(savedDate) {
  _awDate = savedDate || _awDate;
  if (_awTimer) clearTimeout(_awTimer);
  _awTimer = setTimeout(() => { _awTimer = null; checkNewAwards(_awDate); _awDate = null; }, 2000);
}
function awardsFlush() {
  if (!_awTimer) return;
  clearTimeout(_awTimer); _awTimer = null;
  checkNewAwards(_awDate); _awDate = null;
}
function checkNewAwards(savedDate) {
  let fresh = [];
  try { fresh = syncAwards(savedDate); } catch (e) { return; }
  if (!fresh.length) return;
  // Rank by how deep the tier is within its own family. Sorting on the raw number made a
  // 250,000-step badge always outrank a 365-day streak, which is backwards.
  const depth = a => { const f = AWARD_FAMILIES.find(x => x.grp === a.grp);
    return f ? (f.tiers.indexOf(a.tier) + 1) / f.tiers.length : 0; };
  fresh.sort((a, b) => depth(b) - depth(a));
  if (celebSpent()) {
    // Already celebrated something today. The award is permanent in the trophy case — a
    // toast says it landed without stealing the screen a second time.
    toast('🏆 New award: ' + awardName(fresh[0]) + (fresh.length > 1 ? ' +' + (fresh.length - 1) + ' more' : '') + ' — in your trophy case');
    buzz(18);
    return;
  }
  celebSpend();
  _rateArm = true;                       // an award is a high point; ask on dismissal
  showAward(fresh[0], fresh.length - 1);
}
function showAward(a, more) {
  /* showMilestone and showAward share the #milestone node, so when a streak milestone and a
     new award land on the same save the second silently replaced the first. Defer instead —
     the award is already permanent in the trophy case, so nothing is lost by waiting for the
     user to dismiss the streak. */
  const open = document.getElementById('milestone');
  if (open && open.classList.contains('on')) {
    setTimeout(() => showAward(a, more), 1200);
    return;
  }
  let m = document.getElementById('milestone');
  if (!m) { m = document.createElement('div'); m.id = 'milestone'; m.className = 'milestone'; document.body.appendChild(m); }
  const confetti = Array.from({ length: 34 }, (_, i) =>
    `<span class="mf" style="left:${(i * 149) % 100}%;background:${['#6d8cff','#4ad6c0','#fbbf24','#f87171','#a78bfa','#34d399'][i % 6]};animation-delay:${(i % 9) * .16}s;animation-duration:${2.2 + (i % 5) * .35}s"></span>`).join('');
  m.innerHTML = `<div class="mf-wrap">${confetti}</div>
    <div class="ms-inner">
      <div class="ms-fire">${a.ico}</div>
      <div class="ms-title" style="margin-top:2px">${a.title}</div>
      <div class="ms-num" style="font-size:44px;line-height:1.15">${awardName(a)}</div>
      <div class="ms-msg">Unlocked${more > 0 ? ` — and ${more} more waiting in your trophy case` : ''}.</div>
      <button class="btn btn-primary" data-share-card="award" data-aw-share="${a.id}">Make a share card</button>
      <button class="btn btn-ghost btn-sm" id="ms-close" style="margin-top:8px">Close</button>
    </div>`;
  m.classList.add('on');
  buzzPattern([70, 50, 70, 50, 140]);
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
  buzzPattern([80, 60, 80, 60, 160]);
}
document.addEventListener('click', (ev) => {
  if (ev.target.id === 'ms-close' || (ev.target.id === 'milestone')) {
    const m = document.getElementById('milestone'); if (m) m.classList.remove('on');
    /* The ask rides on the dismissal of a celebration — the user just chose to end a good
       moment, so nothing is being interrupted. */
    if (_rateArm) {
      _rateArm = false;
      /* One ask per celebration, never both. The review ask comes first — it costs the user
         nothing and is worth more to the app than a few rupees. The tip is only offered on a
         celebration where the review ask has already been settled. */
      const rs = rateState();
      if (!rs.done && rs.asks < 2) setTimeout(maybeAskForReview, 450);
      else setTimeout(maybeAskForTip, 450);
    }
  }
});
function saveDraftNow(date, d) {
  d.updatedAt = new Date().toISOString();
  d.tasks = tasksForDate(date);
  // Preserve fields owned by other flows (Gym writes workoutsDone/workoutDetail, Time writes
  // timeSummary) so a Log autosave can't blindly clobber them with a stale snapshot.
  const existing = DB.entry(date) || {};
  ['workoutsDone', 'workoutDetail', 'timeSummary'].forEach(k => { if (existing[k] !== undefined) d[k] = existing[k]; });
  const wrote = DB.putEntry(date, d);
  refreshStreak();
  if (date === todayStr()) checkStreakMilestone();   // full-screen reward at 3/5/7/10/14… days
  checkNewAwardsSoon(date);                          // tiered awards can land on any date edited
  pushWidgetData();                                  // keep the (future native) home-screen widget fresh
  scheduleInactivityReminder();
  syncEntry(date, d);
  // The autosave dot is the quietest possible "it worked" — so it must not appear when it
  // did not. safeSet has already shown the storage-full warning.
  const dot = document.getElementById('autosave-dot');
  if (dot && wrote !== false) { dot.textContent = 'Saved ✓'; dot.classList.add('show'); setTimeout(() => dot.classList.remove('show'), 1400); }
  return wrote;
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
    if (disp) { const d = draft[key], has = d !== '' && d != null; disp.textContent = has ? (Math.floor(d) + 'h ' + Math.round((d - Math.floor(d)) * 60) + 'm') : '—'; disp.classList.toggle('bw-dur-empty', !has); }
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
  const ok = saveDraftNow(logDate, draft);   // merge-safe path (preserves gym/time fields)
  // Only say it saved if it saved. On a full phone this used to say "Saved 🎉" over a write
  // that never landed, and even overwrote the quota warning in the same tick.
  if (ok === false) return;
  toast('Saved 🎉');
  const sent = await syncEntry(logDate, draft);
  // The Sheet POST is no-cors, so the response is opaque and we cannot read its status.
  // "Sent to your Sheet" is what we actually know; "synced ✓" was a claim we could not make.
  if (sent) toast('Sent to your Sheet 📤');
});
// Quick-add straight from the Log screen (#log-4, #menu-1)
document.addEventListener('click', (ev) => {
  if (ev.target.id === 'log-task-add') {
    const inp = document.getElementById('log-task-input'); const text = (inp && inp.value || '').trim(); if (!text) return;
    const tasks = DB.tasks(); tasks.unshift({ id: 't' + Date.now(), text, done: false, created: todayStr(), color: '' });
    const tok = DB.saveTasks(tasks); renderToday();
    document.body.classList.remove('kbd-open');   // re-render removed the focused input → no focusout ever fires
    savedToast(tok, 'Task added ✅'); return;
  }
  if (ev.target.id === 'log-habit-add') {
    const inp = document.getElementById('log-habit-input'); const raw = (inp && inp.value || '').trim(); if (!raw) return;
    const em = emojiSplit(raw); const cfg = habitCfg();
    cfg.push({ key: 'ch' + Date.now(), emoji: em.emoji, label: em.name, custom: true, added: todayStr() });
    saveHabitCfg(cfg); renderToday();
    document.body.classList.remove('kbd-open');
    toast('Checklist item added'); return;
  }
  if (ev.target.id === 'log-open-gym') { gymDate = logDate; navigateTo('gym'); return; }   // gym reachable from Log home (#menu-7)
  const ut = ev.target.closest('[data-use-tracked]');
  if (ut) { const k = ut.dataset.useTracked; draft[k] = +ut.dataset.trackedVal;
    if (k === 'sleepHours') { draft.bedTime = ''; draft.wakeTime = ''; }   // tracked value replaces manual bed/wake
    renderToday(); autosaveDraft(); toast('Using your tracked time ⏱'); return; }
  if (ev.target.id === 'hc-connect') {
    const hc = hcPlugin();
    if (!hc || !hc.requestHealthPermissions) { toast('Needs the Play Store app', true); return; }
    // promise chain, not await — this listener is not async
    Promise.resolve(hc.isAvailable ? hc.isAvailable() : null)
      .then(a => {
        if (a && a.healthConnectNeedsUpdate) { toast('Update Health Connect on your phone first', true); return null; }
        if (a && a.healthConnect === false) { toast("Health Connect isn't available on this phone", true); return null; }
        return hc.requestHealthPermissions();
      })
      .then(r => { if (!r) return;
        toast(r.granted ? 'Connected — ' + r.granted + ' of ' + r.of + ' metrics allowed' : 'Nothing allowed yet');
        renderSettingsIfShown(); })
      .catch(() => toast('Health Connect unavailable', true));
    return;
  }
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
  if (dn) {
    const nid = dn.dataset.delnote, att = mediaList('note:' + nid, null).map(r => r.id);
    if (att.length && !confirm(`Delete this note and its ${att.length} photo(s)/voice note(s)? This cannot be undone.`)) return;
    DB.saveNotes(DB.notes().filter(n=>n.id!==nid)); renderNotes(); syncNotes();
    if (att.length) mediaDelete(att).then(() => renderNotes());
    return;
  }
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
    ${mediaHas('note:' + n.id) ? mediaSlot('note:' + n.id, '', { compact: true }) : ''}
    ${openColorId===n.id ? swatchStrip(n.id) : ''}
  </div>`;
  document.getElementById('s-notes').innerHTML = `
    <div class="card">
      <div class="task-add">
        <input type="text" id="note-input" placeholder="Add a note…" autocomplete="off">
        <button class="mic-ic" data-mic="#note-input" title="speak">🎤</button>
        <button class="btn btn-primary btn-sm" id="note-add-btn">Add</button>
      </div>
      ${mediaSupported() ? `<div class="media-acts note-acts">
        <button class="m-act" data-madd="camera" data-mctx="note:new" data-mday="${todayStr()}">${icon('camera', 20)}<span>Photo</span></button>
        <button class="m-act" data-madd="gallery" data-mctx="note:new" data-mday="${todayStr()}">${icon('image', 20)}<span>Gallery</span></button>
        <button class="m-act" data-mrec data-mctx="note:new" data-mday="${todayStr()}">${icon('mic', 20)}<span>Voice</span></button>
      </div>
      ${mediaSlot('note:new', todayStr(), { compact: true })}` : ''}
      <div class="hint" style="margin-top:8px">Drag ⠿ to reorder · tap ◌ to color · 🎤 to speak. Photo and Voice save a new note, with anything you typed as its text.</div>
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
function gymCfg() { return safeParse(localStorage.getItem('dp.gymcfg'), { ex: {}, custom: {} }); }
function saveGymCfg(c) { const ok = safeSet('dp.gymcfg', JSON.stringify(c)); pushState(); return ok; }
/* Custom muscle groups (dp.gymgroups) — brand-new groups whose exercises all
   live in gymCfg().custom[groupId]. */
function gymGroups() { return safeParse(localStorage.getItem('dp.gymgroups'), []); }
function saveGymGroups(g) { const ok = safeSet('dp.gymgroups', JSON.stringify(g)); pushState(); return ok; }
function anyGroupById(id) {
  const cg = gymGroups().find(g => g.id === id);
  return cg ? Object.assign({ exercises: [] }, cg) : groupById(id);
}
function allGroups() { return WORKOUT_PLAN.concat(gymGroups()); }
/* The 6-day split is editable (dp.daycfg): rename days, pick each day's
   muscle group + core/abs rotation. */
function gymDays() {
  return safeParse(localStorage.getItem('dp.daycfg'), WORKOUT_DAYS.map(d => Object.assign({}, d)));
}
function saveGymDays(d) { const ok = safeSet('dp.daycfg', JSON.stringify(d)); pushState(); return ok; }
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
    const sent = await syncEntry(gymDate, entry);
    if (sent) toast('Sent to your Sheet 📤');
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
function saveActCfg(cfg) { const ok = safeSet('dp.actcfg', JSON.stringify(cfg)); reloadCfg(); pushState(); return ok; }
let TIME_ACTS_ALL = actCfg();
/* visible activities = non-hidden defaults + non-hidden customs */
function allActs() { return TIME_ACTS_ALL.filter(a => !a.hidden).concat(DB.timeacts().filter(a => !a.hidden)); }
/* lookups include hidden ones so old timeline blocks still render right */
/* Project timers get their own identity rather than borrowing a category tag. Three projects
   all timed as "Work" were indistinguishable on the 24h timeline, in the legend, in the
   where-the-time-went breakdown and in the Android notification — all four of which resolve a
   block through this one function, so teaching it about `pj:<id>` fixes every one of them.

   `dp.pjnames` is a tombstone written when a project is deleted: without it, that project's
   past blocks would resolve to the raw string "pj:pj1787…" forever. History stays readable. */
const PJ_ACT = 'pj:';
function actById(id) {
  if (typeof id === 'string' && id.indexOf(PJ_ACT) === 0) {
    const pid = id.slice(PJ_ACT.length);
    const live = (safeParse(localStorage.getItem('dp.projects'), []) || []).find(x => x.id === pid);
    if (live) return { id, emoji: '🗂️', name: live.name, color: live.color || '#5570dd', project: pid };
    const gone = safeParse(localStorage.getItem('dp.pjnames'), {})[pid];
    if (gone) return { id, emoji: '🗂️', name: gone.name, color: gone.color || '#5f6b85', project: pid, gone: true };
    return { id, emoji: '🗂️', name: 'Former project', color: '#5f6b85', project: pid, gone: true };
  }
  return TIME_ACTS_ALL.concat(DB.timeacts()).find(a => a.id === id) || { id, emoji: '⏱️', name: id, color: '#64748b' };
}

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

/* `pid` tags the new block to a project. Passing it is what makes project hours exact: a
   block belongs to one project or none, so two projects sharing an activity never both
   claim the same time. */
function startAct(actId, pid) {
  const log = DB.timelog(); const now = Date.now();
  const run = log.find(s => s.end == null);
  if (run) {
    run.end = now; run.upd = now;
    // Same activity AND same project = stop. Same activity for a DIFFERENT project has to
    // start a fresh block, or the hours would land on whichever project started first.
    if (run.act === actId && (run.pid || '') === (pid || '')) {   // tapping the running activity = just stop it
      DB.saveTimelog(log); renderTime(); refreshTimerNotif();
      toast(`⏹ ${actById(actId).name} stopped · ${fmtDur(run.end - run.start)}`);
      // The block is saved above FIRST, so the save sheet is pure enrichment and dismissing
      // it loses nothing. Short blocks stop silently, as they always did.
      if (run.end - run.start >= SAVE_MIN_MS) saveSheetOpen(run.id);
      return;
    }
  }
  /* Block ids were plain 'ts' + Date.now(). Two blocks created inside the same millisecond
     therefore shared an id, and every lookup in this file is `log.find(s => s.id === …)` —
     so an edit, a delete or a save-sheet commit would silently hit the wrong block. A human
     cannot tap twice in a millisecond, but a notification action being consumed at the same
     moment as a tap can, and the cost of being wrong is corrupted history. */
  let id = 'ts' + now, n = 0;
  while (log.some(s => s.id === id)) id = 'ts' + now + '-' + (++n);
  const blk = { id, act: actId, start: now, end: null, upd: now };
  if (pid) blk.pid = pid;
  log.push(blk);
  DB.saveTimelog(log); ttDate = todayStr(); renderTime(); refreshTimerNotif();
  toast(`▶ ${actById(actId).name} started`);
}

/* Segments overlapping the viewed day, clipped to it (handles cross-midnight). */
/* Which existing blocks does a proposed one overlap?
 *
 * Every automatic path keeps the timelog non-overlapping: startAct() closes the running block
 * before opening the next, so at most one is ever open. Manual entry did not — it validated that
 * both times were picked and that they differed, and nothing else. Adding 09:00-17:00 to a day
 * that already had 09:00-17:00 gave a sixteen-hour eight-hour day, and every total downstream
 * inherited it: the day summary written into the entry, the string that syncs, and trackedMs in
 * the stats windows.
 *
 * It does NOT refuse the block. Overlap is sometimes what someone means — correcting a
 * mis-tracked morning by laying the right block over it, then deleting the wrong one — and a
 * tracker that argues with you about your own day is worse than one that double-counts. It says
 * what it found, names the block, and saves. Same rule as every other report in this app: do not
 * claim a clean result you have not earned.
 *
 * Pure, so tools/check-overlap.mjs can run it directly.
 */
function overlappingBlocks(block, log) {
  const a = block.start, b = block.end == null ? Infinity : block.end;
  return (Array.isArray(log) ? log : []).filter(x => {
    if (!x || x.id === block.id || x.start == null) return false;
    const xa = x.start, xb = x.end == null ? Infinity : x.end;
    return xa < b && a < xb;          // touching end-to-start is not an overlap
  });
}

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
    ${(seg.t || seg.rpe != null || seg.note) ? `<div class="sv-shown">
      ${seg.t ? `<div class="sv-title">${escapeHtml(seg.t)}</div>` : ''}
      ${seg.rpe != null ? `<div class="hint">felt <b>${seg.rpe}</b>/10</div>` : ''}
      ${seg.note ? `<div class="hint sv-note-txt">${escapeHtml(seg.note)}</div>` : ''}
    </div>` : ''}
    <div class="btn-row">
      <button class="btn btn-ghost btn-sm" data-sv-edit="${seg.id}">${
        (seg.t || seg.rpe != null || seg.note) ? '✏️ Edit details' : '＋ Add details'}</button>
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

  /* Project time is a real category now, so it has to be startable from the place people
     start timers — not only from inside the project. Same identity either way: act
     'pj:<id>', tagged with the project id. */
  const pjChips = (typeof pjAll === 'function' ? pjAll() : []).filter(x => x.status !== 'done');
  const projectRow = pjChips.length ? `
    <div class="pj-chiprow-h">Projects</div>
    <div class="act-grid">${pjChips.map(x => {
      const on = run && run.pid === x.id;
      return `<button class="act-chip ${on ? 'on' : ''}" data-act-start="${PJ_ACT}${x.id}" data-act-pid="${x.id}"
        style="--c:${x.color}"><span class="emoji">🗂️</span><span>${escapeHtml(x.name)}</span>${on ? '<span class="live">●</span>' : ''}</button>`;
    }).join('')}</div>` : '';

  const isToday = ttDate === todayStr();
  const manual = ttShowManual ? `
    <div class="tt-manual">
      <select id="tt-m-act">${allActs().map(a => `<option value="${a.id}">${a.emoji} ${escapeHtml(a.name)}</option>`).join('')}${
        pjChips.map(x => `<option value="${PJ_ACT}${x.id}">🗂️ ${escapeHtml(x.name)}</option>`).join('')}</select>
      <input type="time" id="tt-m-start"><span class="hint">to</span><input type="time" id="tt-m-end">
      <button class="btn btn-primary btn-sm" id="tt-m-save">Add</button>
    </div>` : '';

  document.getElementById('s-time').innerHTML = `
    ${nowCard}
    <div class="card">
      <h2>Activities <span class="hint">tap to start · tap another to switch</span></h2>
      <div class="act-grid">${chips}</div>
      ${projectRow}
      <div class="task-add" style="margin-top:10px">
        <input type="text" id="tt-newact" placeholder="Add an activity…" autocomplete="off">
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
    ${gapCardHTML(ttDate)}
    <div class="card">
      <h2>⏳ Where the ${isToday ? 'day is going' : 'day went'} <span class="hint">${prettyDate(ttDate)}</span></h2>
      ${timeTotalsHTML(ttDate)}
    </div>
    <div style="height:14px"></div>`;
}

/* ============================================================
   POST-ACTIVITY SAVE — the research rated this "the single highest-value thing to copy"
   from Strava's tracking side, and the reason is exactly what was wrong here: the timer
   stopped, a toast said how long it ran, and the moment was gone. A stopped block was a
   duration and nothing else.

   Two rules make this safe to add to a screen people use dozens of times a day:
     1. The block is ALREADY SAVED before this appears. The sheet only enriches it, so
        dismissing it — by tapping away, by Android back, by killing the app — loses
        nothing. It is never a required step in stopping a timer.
     2. It only offers itself for blocks worth annotating (>= SAVE_MIN_MS). Mis-taps and
        30-second switches stop silently, the way they always did.

   The effort scale is research item 8: a subjective 1-10 rating that REPLACES a sensor.
   Perfect for a phone-only app — mood and energy already use this exact input pattern, so
   there is nothing new to learn, and no hardware can contradict it.
   ============================================================ */
const SAVE_MIN_MS = 120000;                    // 2 minutes
let saveState = { id: null, title: '', rpe: null, note: '' };

function segById(id) { return DB.timelog().find(s => s.id === id) || null; }

function saveSheetOpen(segId) {
  const seg = segById(segId);
  if (!seg) return;
  saveState = { id: segId, title: seg.t || '', rpe: seg.rpe == null ? null : +seg.rpe, note: seg.note || '', pid: seg.pid || '' };
  let el = document.getElementById('savesheet');
  if (!el) { el = document.createElement('div'); el.id = 'savesheet'; el.className = 'sharesheet'; document.body.appendChild(el); }
  el.classList.add('on');
  saveSheetRender();
}
function saveSheetClose() {
  const el = document.getElementById('savesheet');
  if (el) el.classList.remove('on');
  saveState.id = null;
}

/* Writes onto the segment itself. Empty values are DELETED rather than stored as '' — the
   time log is synced by comparing serialised state, so blank keys on every block would
   churn a pointless round-trip, the same reason habit cues delete instead of blanking. */
function saveSheetCommit() {
  const log = DB.timelog();
  const seg = log.find(s => s.id === saveState.id);
  if (!seg) { saveSheetClose(); return; }
  const t = (saveState.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const nt = (saveState.note || '').trim().slice(0, 500);
  if (t) seg.t = t; else delete seg.t;
  if (nt) seg.note = nt; else delete seg.note;
  if (saveState.rpe != null) seg.rpe = saveState.rpe; else delete seg.rpe;
  if (saveState.pid) seg.pid = saveState.pid; else delete seg.pid;
  seg.upd = Date.now();
  DB.saveTimelog(log);
  syncTimelog();
  saveSheetClose();
  renderTime();
  buzz(12);
  toast('Saved to that block');
}

function saveSheetRender() {
  const el = document.getElementById('savesheet');
  if (!el) return;
  const seg = segById(saveState.id);
  if (!seg) { saveSheetClose(); return; }
  const act = actById(seg.act);
  const dur = (seg.end == null ? Date.now() : seg.end) - seg.start;
  const RPE = ['', 'barely there', 'very easy', 'easy', 'fairly easy', 'moderate',
               'somewhat hard', 'hard', 'very hard', 'nearly maxed', 'everything I had'];
  el.innerHTML = `<div class="ss-inner">
    <div class="ss-head"><span>How did that go?</span>
      <button type="button" class="ss-x" id="sv-close" aria-label="Close">✕</button></div>

    <div class="card sv-sum" style="border-color:${act.color}">
      <div class="tt-now-emoji">${act.emoji}</div>
      <div class="tt-now-info">
        <div class="tt-now-name">${escapeHtml(act.name)}</div>
        <div class="hint">${fmtClock(seg.start)}–${seg.end == null ? 'now' : fmtClock(seg.end)} · ${fmtDur(dur)}</div>
      </div>
    </div>

    <div class="field"><label for="sv-title">What was it?</label>
      <input type="text" id="sv-title" maxlength="80" autocomplete="off"
        placeholder="e.g. rewrote the parser" value="${escapeHtml(saveState.title)}"></div>

    ${/* The only place ordinary stop-the-timer flow can attribute hours to a project. Hidden
         entirely when there are no projects, so it never adds a field to answer for people
         who don't use them. */''}
    ${DB.projects().length ? `<div class="field"><label for="sv-pid">Part of a project?</label>
      <select id="sv-pid"><option value="">— not project work —</option>
        ${pjAll().filter(p => p.status !== 'done' || p.id === saveState.pid).map(p =>
          `<option value="${p.id}"${saveState.pid === p.id ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
      </select></div>` : ''}

    <div class="field"><label>How hard did it feel?</label>
      <div class="scale sv-scale">${Array.from({ length: 10 }, (_, i) => i + 1).map(n =>
        `<button type="button" class="${saveState.rpe === n ? 'on' : ''}" data-sv-rpe="${n}">${n}</button>`).join('')}</div>
      ${/* the descriptor gets its own centred line: squeezed into the middle of a
             space-between row it collided with both end labels at 412px */''}
      <div class="scale-labels"><span>easy</span><span>maxed</span></div>
      <div class="sv-rpe-txt">${saveState.rpe
        ? `<b>${saveState.rpe}/10</b> — ${RPE[saveState.rpe]}`
        : 'optional — tap a number if you want to remember how it felt'}</div>
    </div>

    <div class="field"><label for="sv-note">Anything worth remembering?</label>
      <textarea id="sv-note" rows="3" maxlength="500"
        placeholder="What worked, what got in the way…">${escapeHtml(saveState.note)}</textarea></div>

    <div class="ss-acts">
      <button type="button" class="btn btn-primary" id="sv-save">Save</button>
      <button type="button" class="btn btn-ghost btn-sm" id="sv-skip" style="margin-top:8px;width:100%">Skip</button>
    </div>
    <div class="hint ss-note">The block is already logged — this only adds detail to it.</div>
  </div>`;
}

document.addEventListener('click', (ev) => {
  const t = ev.target;
  if (!t || !t.closest) return;
  if (t.id === 'sv-close' || t.id === 'sv-skip' || t.id === 'savesheet') { saveSheetClose(); return; }
  const r = t.closest('[data-sv-rpe]');
  if (r) {
    const n = +r.dataset.svRpe;
    saveState.rpe = (saveState.rpe === n) ? null : n;     // tap again to clear
    // keep whatever is typed but not yet committed
    const ti = document.getElementById('sv-title'), no = document.getElementById('sv-note'), pi = document.getElementById('sv-pid');
    if (ti) saveState.title = ti.value;
    if (no) saveState.note = no.value;
    if (pi) saveState.pid = pi.value;
    saveSheetRender(); buzz(6); return;
  }
  if (t.id === 'sv-save') {
    const ti = document.getElementById('sv-title'), no = document.getElementById('sv-note'), pi = document.getElementById('sv-pid');
    if (ti) saveState.title = ti.value;
    if (no) saveState.note = no.value;
    if (pi) saveState.pid = pi.value;
    saveSheetCommit(); return;
  }
  const ed = t.closest('[data-sv-edit]');
  if (ed) { saveSheetOpen(ed.dataset.svEdit); buzz(8); return; }
});

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
  if (st) { startAct(st.dataset.actStart, st.dataset.actPid || ''); return; }
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
    let mid = 'ts' + now, mn = 0;
    while (log.some(x => x.id === mid)) mid = 'ts' + now + '-' + (++mn);
    const mblk = { id: mid, act, start: a, end: b, upd: now };
    // A manual block picked as a project must count toward it, not just look like it.
    if (act.indexOf(PJ_ACT) === 0) mblk.pid = act.slice(PJ_ACT.length);
    const clash = overlappingBlocks(mblk, log);
    log.push(mblk);
    log.sort((x, y) => x.start - y.start);
    const bok = DB.saveTimelog(log); ttShowManual = false; renderTime();
    if (bok && clash.length) {
      const c = clash[0];
      toast(`Added, but it overlaps ${actById(c.act).name} ${fmtClock(c.start)}–${c.end == null ? 'now' : fmtClock(c.end)}` +
            (clash.length > 1 ? ` and ${clash.length - 1} more` : '') + ' — those hours are counted twice.', true);
    } else savedToast(bok, 'Block added ✅');
    return;
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
    const fok = DB.saveTimelog(log); renderTime(); savedToast(fok, 'Time fixed ✅');
  }
});

/* ============================================================
   SCREEN: HABITS (streaks + heatmaps)
   ============================================================ */
function cueLineHTML(h) {
  const cue = habitCue(h);
  return `<button type="button" class="hcue-line${cue ? '' : ' empty'}" data-cue-edit="${h.key}">`
       + (cue ? `📍 ${escapeHtml(cue)}` : '📍 Plan a when &amp; where') + `</button>`;
}
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
      ${cueLineHTML(h)}
      <div class="heat">${heat}</div>
      <div class="strength-row" title="Weighted 13-day trend — one miss won't zero it, one day won't max it">
        <span class="hint">Strength</span>
        <div class="strength-bar"><i style="width:${str}%"></i></div>
        <b>${str}</b>
      </div>
    </div>`;
  }).join('');
  document.getElementById('s-habits').innerHTML = sampleBannerHTML('these streaks') + cards;
}

/* ============================================================
   SCREEN: DASHBOARD
   ============================================================ */
/* ---------- Stat-tile primitives ----------
   The Stats overview used to open with six identical grey boxes: a 201-day streak and a
   65/100 index rendered at exactly the same weight, none of them showing which way anything
   was moving. Six equal numbers is the same as no hierarchy at all.

   Now: ONE hero figure (the streak), then three stat tiles that each carry a value, a signed
   delta against a named period, and a sparkline. A number with no direction is the least
   useful thing a stats screen can show.

   Series colours are per-mode and were validated, not eyeballed — same hues as the app's own
   accents, stepped for each surface so they clear the lightness band, the chroma floor,
   colour-blind separation and 3:1 contrast on both #ffffff and #141c2e. Only three series,
   which is inside the band where hue alone is safe; every tile is direct-labelled anyway. */

/* 12-point sparkline. No axes, no dots, no gridlines — it answers "which way" and nothing
   else. Nulls are bridged rather than dropped so gaps do not fake a trend. */
function sparkline(values, cls, w, h) {
  w = w || 92; h = h || 26;
  const pts = (values || []).filter(v => v != null && !isNaN(v)).map(Number);
  if (pts.length < 2) return `<svg class="spark" width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const span = (hi - lo) || 1;
  const pad = 3;
  const x = i => pad + (i * (w - pad * 2)) / (pts.length - 1);
  const y = v => (h - pad) - ((v - lo) / span) * (h - pad * 2);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${d} L${x(pts.length - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`;
  return `<svg class="spark ${cls}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path class="spark-fill" d="${area}"/>
    <path class="spark-line" d="${d}"/>
    <circle class="spark-dot" cx="${x(pts.length - 1).toFixed(1)}" cy="${y(pts[pts.length - 1]).toFixed(1)}" r="2.6"/>
  </svg>`;
}

/* value + signed delta + sparkline. `upGood` decides the delta's colour, never its arrow —
   the arrow always follows the number. */
function statTile(o) {
  const has = o.value != null && o.value !== '–';
  let delta = '';
  if (has && o.delta != null && isFinite(o.delta) && Math.abs(o.delta) >= (o.eps || 0.05)) {
    const up = o.delta > 0;
    const good = o.upGood === false ? !up : up;
    delta = `<span class="st-delta ${good ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(o.delta).toFixed(o.dec == null ? 1 : o.dec)}</span>`;
  } else if (has) {
    delta = `<span class="st-delta flat">level</span>`;
  }
  /* The delta sits beside the VALUE, not beside the label. Sharing a row with the label left
     "Polymath" 38px in a 3-column grid at 320px — about six readable characters. The value is
     short, so it can afford a neighbour; the label cannot. */
  return `<div class="st st-${o.cls}">
    <div class="st-label">${o.label}</div>
    <div class="st-top"><span class="st-val">${has ? o.value : '–'}</span>${delta}</div>
    ${sparkline(o.spark, 'sp-' + o.cls)}
    ${o.foot ? `<div class="st-foot">${o.foot}</div>` : ''}
  </div>`;
}

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
  // ---- Health Connect insights. These were dead until v148 because every sensor metric
  // came back null; now they are the strongest signals in the engine because they need no
  // manual logging at all. Same honesty rules as the rest: real minimum samples, and we
  // never claim a direction we cannot see.
  (function healthInsights() {
    const hs = healthStore();
    const has = (k) => Object.keys(hs).filter(d => hs[d] && hs[d][k] != null).length;

    // Split on the user's OWN median, never a magazine number. Somebody who averages
    // 3,000 steps still has active days, and a fixed 8,000 cutoff would have told them
    // nothing, ever — the insight would silently never appear.
    const stepMed = dpMedian(Object.keys(hs).map(d => hs[d].steps).filter(v => v != null));

    // 1 — how much longer you sleep after an active day
    if (has('steps') >= 8 && has('sleepMin') >= 8 && stepMed) {
      const act = [], quiet = [];
      Object.keys(hs).sort().forEach(d => {
        const st = hs[d].steps, nextS = (hs[addDays(d, 1)] || {}).sleepMin;
        if (st == null || nextS == null) return;
        (st > stepMed ? act : quiet).push(nextS);
      });
      if (act.length >= 4 && quiet.length >= 4) {
        const diff = avg(act) - avg(quiet);
        if (Math.abs(diff) >= 12) {
          out.push({ ico: 'moon', w: 6,
            head: `Active days buy you ${Math.abs(Math.round(diff))} min ${diff > 0 ? 'more' : 'less'} sleep`,
            sub: `After your more active days (over ${Math.round(stepMed).toLocaleString()} steps) you sleep <b>${fmtMin(Math.round(avg(act)))}</b>, versus <b>${fmtMin(Math.round(avg(quiet)))}</b> after quieter days (${act.length}+${quiet.length} nights).` });
        }
      }
    }

    // 2 — what a heavy screen day costs the NIGHT that FOLLOWS it.
    // `sleepMin` for a day is the night that ENDED that morning (HealthReader looks back
    // 18h), so comparing it against the same day's screen time would measure the screen
    // time that came AFTER the sleep — backwards. Use the next day's night instead.
    if (has('screenMin') >= 8 && has('sleepMin') >= 8) {
      const heavy = [], light = [];
      const vals = Object.keys(hs).filter(d => hs[d].screenMin != null).map(d => hs[d].screenMin);
      const med = dpMedian(vals);
      Object.keys(hs).forEach(d => {
        const sc = hs[d].screenMin, sl = (hs[addDays(d, 1)] || {}).sleepMin;
        if (sc == null || sl == null || med == null) return;
        (sc > med ? heavy : light).push(sl);
      });
      if (heavy.length >= 4 && light.length >= 4) {
        const diff = avg(light) - avg(heavy);
        if (diff >= 12) {
          out.push({ ico: 'phone', w: 6,
            head: `Heavy screen days cost you ${Math.round(diff)} min of sleep`,
            sub: `After a heavier-screen day (over <b>${fmtMin(Math.round(med))}</b>) you sleep <b>${fmtMin(Math.round(avg(heavy)))}</b>, against <b>${fmtMin(Math.round(avg(light)))}</b> after lighter ones (${heavy.length}+${light.length} nights).` });
        }
      }
    }

    // 3 — resting heart rate against sleep: the clearest recovery signal we can see
    const slMed = dpMedian(Object.keys(hs).map(d => hs[d].sleepMin).filter(v => v != null));
    if (has('hr') >= 8 && has('sleepMin') >= 8 && slMed) {
      const rested = [], short = [];
      Object.keys(hs).forEach(d => {
        const h = hs[d].hr, sl = hs[d].sleepMin;
        if (h == null || sl == null) return;
        (sl > slMed ? rested : short).push(h);
      });
      if (rested.length >= 4 && short.length >= 4) {
        const diff = avg(short) - avg(rested);
        if (Math.abs(diff) >= 2) {
          out.push({ ico: 'heart', w: 5,
            head: `Your heart rate runs ${Math.abs(diff).toFixed(1)} bpm ${diff > 0 ? 'higher' : 'lower'} on short sleep`,
            sub: `On your longer nights (over <b>${fmtMin(Math.round(slMed))}</b>) it averages <b>${avg(rested).toFixed(1)}</b> bpm; on shorter ones <b>${avg(short).toFixed(1)}</b> (${rested.length}+${short.length} days).` });
        }
      }
    }

    // 4 — steps today vs mood TOMORROW. A next-day effect cannot be explained by mood
    // causing the activity, which is the whole reason this one is worth showing.
    if (has('steps') >= 10 && stepMed) {
      const after = [], other = [];
      Object.keys(hs).forEach(d => {
        const st = hs[d].steps; const m = num(addDays(d, 1), 'mood');
        if (st == null || m == null) return;
        (st > stepMed ? after : other).push(m);
      });
      if (after.length >= 4 && other.length >= 4) {
        const diff = avg(after) - avg(other);
        const sd = dpStd(after.concat(other)) || 1;
        const conf = (after.length + other.length >= 30 && Math.abs(diff) / sd >= 0.5) ? 'high'
                   : (after.length + other.length >= 14 ? 'medium' : 'low');
        if (Math.abs(diff) >= 0.4 && conf !== 'low') {
          out.push({ ico: 'trending', w: 6,
            head: `Walking today → mood ${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)} tomorrow`,
            sub: `The day after your more active days (over ${Math.round(stepMed).toLocaleString()} steps) your mood averages <b>${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}</b> versus other days (${after.length + other.length} days · ${conf} confidence).` });
        }
      }
    }
  })();

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
  // --good/--bad are FILL colours; as small text on a card they fail WCAG (measured 2.77:1
  // for the negative case in light mode). The *-ink tokens exist for exactly this.
  if (pmT != null && pmL != null) { const d = pmT - pmL; head += ` <span style="color:${d>=0?'var(--good-ink)':'var(--bad-ink)'}">${d>=0?'▲ +':'▼ '}${d}</span> vs last week`; }
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
/* Returns WHAT HAPPENED, because callers were guessing and guessing wrong:
     'shared' | 'download' | 'copy' | 'viewer' | 'cancel' | 'blocked'
   Every one of those is a different truth, and "Report PDF ready" was being toasted on top
   of 'blocked'. Anything that is not 'blocked' or 'cancel' put the content somewhere the
   user can reach; only those two mean nothing was saved. */
async function saveFile(filename, content, mime) {
  const inApp = !!window.Capacitor;
  /* In the installed app this ladder used to fall all the way to a textarea: WebView has no
     navigator.share, and a Capacitor WebView sets no DownloadListener so <a download> does
     nothing at all. Export could therefore only ever offer "copy" — and a backup you have to
     paste out of a textarea cannot be handed back to the app's own file-picker import.
     The native plugin writes a real file to Downloads, where the import picker can see it. */
  if (typeof content === 'string') {
    const p = nativeSharePlugin();
    if (p && p.saveTextFile) {
      try {
        const r = await p.saveTextFile({ filename, text: content, mime: mime || 'text/plain' });
        if (r && r.saved) { toast('Saved to your Downloads folder 📁'); return 'download'; }
        if (p.shareTextFile) {
          await p.shareTextFile({ filename, text: content, mime: mime || 'text/plain' });
          toast('Choose where to save 📤'); return 'shared';
        }
      } catch (e) { /* fall through to the rungs below and say what happened */ }
    }
  }
  if (navigator.canShare) {
    try {
      const file = new File([content], filename, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        toast('Choose where to save 📤'); return 'shared';
      }
    } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; /* else fall through */ }
  }
  if (!inApp) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type: mime }));
    a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Saved to your downloads'); return 'download';
  }
  // in-app, no share support: text → copy modal; binary (PDF) → try a viewer, but be honest if blocked
  if (typeof content === 'string') { showCopyModal(filename, content); return 'copy'; }
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type: mime }));
  const win = window.open(url, '_blank');
  if (win) { toast('Opened — use the ⋮ menu to save or share'); return 'viewer'; }
  toast('Your app version can\'t save files yet — update Daylog in the Play Store', true);
  return 'blocked';
}
/* Did the content actually reach the user? */
function saveOk(r) { return r !== 'blocked' && r !== 'cancel'; }
function showCopyModal(filename, content) {
  let m = document.getElementById('copy-modal');
  if (!m) { m = document.createElement('div'); m.id = 'copy-modal'; m.className = 'copy-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="copy-box">
    <div class="copy-head"><b>${escapeHtml(filename)}</b><button class="drawer-x" data-copy-close>✕</button></div>
    <p class="hint">This build could not write a file, so here is the data itself. Tap <b>Copy</b> and paste it into Files, Drive, Notes or an email — or <b>Share</b> it straight to another app. <b>Update Daylog in the Play Store</b> to get a proper "save to Downloads" instead.</p>
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
  if (ev.target.closest('[data-copy-share]')) {
    /* This was `catch (e) {}` around a navigator.share that does not exist in an Android
       WebView — so the button did nothing, said nothing, and looked broken. Try the native
       plugin first, and if there is genuinely no way to share, SAY so. */
    const p = nativeSharePlugin();
    if (p && p.shareTextFile) {
      try { await p.shareTextFile({ filename: m._filename, text: m._content, mime: 'application/json' }); return; }
      catch (e) { toast('Could not open the share sheet — use Copy instead', true); return; }
    }
    if (navigator.share) {
      try { await navigator.share({ text: m._content, title: m._filename }); }
      catch (e) { if (!e || e.name !== 'AbortError') toast('Sharing is not available here — use Copy', true); }
      return;
    }
    toast('This app version cannot share files — tap Copy, or update Daylog', true);
    return;
  }
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
  const ds = contentDates();
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

  // Correlations only. Week-over-week moved to the "You vs you" card, which handles three
  // periods and does not paint more screen time green — so the placeholder copy, which used
  // to promise "week-over-week trends" here, had to change with it.
  const deepInsightsCard = corrRows.length ? `<div class="card">
      <h2>🔗 Connected insights <span class="hint">how your metrics move together</span></h2>
      ${corrRows.join('')}
    </div>` : (allDates.length < 5 ? '<div class="card"><h2>🔗 Connected insights</h2><div class="hint">Log ~5 days and this unlocks: how sleep drives your mood, workout effects, and what your screen time costs you.</div></div>' : '');

  const woSeries = days.map(d => ({ x: d, y: e[d] && e[d].workoutsDone!=null && e[d].workoutsDone!=='' ? +e[d].workoutsDone : null }));

  // ---- Polymath Index ----
  const pmSeries = days.map(d => { const p = e[d] ? polymath(e[d]) : null; return { x: d, y: p ? p.total : null }; });
  const pm30 = last30.map(d => e[d] ? polymath(e[d]) : null).filter(Boolean);
  // null, not 0. A brand-new user opening Stats was shown a hard "0/100" hero, which reads
  // as "you scored zero" rather than "nothing logged yet" — the worst possible first
  // impression, and untrue.
  const pmAvg = pm30.length ? Math.round(pm30.reduce((a, p) => a + p.total, 0) / pm30.length) : null;
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
    ${(() => {
      /* One hero (the streak), three sparkline tiles, and the two context numbers demoted
         from full-size boxes to a single line — they are reference values, not headlines. */
      const sparkOf = (key, n) => { const out = [];
        for (let i = n - 1; i >= 0; i--) { const d = addDays(todayStr(), -i);
          const v = e[d] && e[d][key]; out.push(v != null && v !== '' && !isNaN(+v) ? +v : null); }
        return out; };
      const pmSparkOf = n => { const out = [];
        for (let i = n - 1; i >= 0; i--) { const d = addDays(todayStr(), -i);
          const pm = e[d] ? polymath(e[d]) : null; out.push(pm ? pm.total : null); }
        return out; };
      /* Delta = this 7 days vs the 7 before, so the number has a period attached. */
      const meanOf = a => { const v = (a || []).filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
      const deltaOf = arr => { const half = Math.floor(arr.length / 2);
        const a = meanOf(arr.slice(half)), b = meanOf(arr.slice(0, half));
        return (a == null || b == null) ? null : a - b; };
      const mS = sparkOf('mood', 14), eS = sparkOf('energy', 14), pS = pmSparkOf(14);
      const st = loggedStreak();
      return `<div class="card ov-hero-card">
        <div class="ov-hero">
          <div class="ov-flame">${icon('flame', 30)}</div>
          <div>
            <div class="ov-num">${st}</div>
            <div class="ov-lab">${st === 1 ? 'day logged' : 'day streak'}</div>
          </div>
        </div>
        <div class="ov-ctx">Best <b>${longestLoggedStreak()}</b> · <b>${contentDates(e).length}</b> days logged all time</div>
        <div class="st-row">
          ${statTile({ cls: 'mood',  label: 'Mood',     value: avg('mood'),   spark: mS, delta: deltaOf(mS), upGood: true, eps: 0.15 })}
          ${statTile({ cls: 'nrg',   label: 'Energy',   value: avg('energy'), spark: eS, delta: deltaOf(eS), upGood: true, eps: 0.15 })}
          ${statTile({ cls: 'poly',  label: 'Polymath', value: pmAvg == null ? '–' : pmAvg, spark: pS, delta: deltaOf(pS), upGood: true, eps: 1, dec: 0 })}
        </div>
        <div class="hint st-note">Last 14 days · the arrow compares this week with the one before.</div>
      </div>`;
    })()}

    ${patternsCard}

    <div class="card pm-card">
      <h2>🧭 Polymath Index <span class="hint">last 30 days</span></h2>
      <div class="pm-hero">
        <div class="pm-score">${pmAvg == null ? '–' : pmAvg}<span class="pm-out">/100</span></div>
        <div class="pm-meta"><div>30-day average</div><div class="hint">${pmAvg == null
          ? 'log a few days and this fills in'
          : `latest day: ${latestPm}${typeof latestPm === 'number' ? '/100' : ''}`}</div></div>
      </div>
      ${barChart(pmSeries, '#8b9dff', { max: 100 })}
      <div style="margin-top:10px">${pmBars}</div>
    </div>

    ${goalsCardHTML()}

    ${monthCardHTML()}

    ${vsPastHTML()}

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

    ${bestEfforts()}
    ${yearPixelsHTML()}`;

  const timeHTML = `
    <div class="card"><div class="stat-grid">
      <div class="stat"><div class="v">${avg('sleepHours')}</div><div class="l">avg sleep h</div></div>
      <div class="stat"><div class="v">${avg('deepWorkHours')}</div><div class="l">avg deep work h</div></div>
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
  [['screenMin', 'mood', '📱 Screen time → Mood'], ['steps', 'mood', '👟 Steps → Mood'],
   ['steps', 'energy', '👟 Steps → Energy'], ['exerciseMin', 'energy', '🏃 Active mins → Energy'],
   ['sleepMin', 'mood', '😴 Sleep → Mood'], ['sleepMin', 'energy', '😴 Sleep → Energy'],
   ['screenMin', 'energy', '📱 Screen time → Energy'],
   ['steps', 'deepWorkHours', '👟 Steps → Deep work'],
   ['exerciseMin', 'mood', '🏃 Active mins → Mood'], ['hr', 'energy', '❤️ Heart rate → Energy'],
   ['calories', 'energy', '🔥 Calories → Energy'],
   ['sleepMin', 'deepWorkHours', '😴 Sleep → Deep work'],
   ['hr', 'mood', '❤️ Heart rate → Mood']]
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
      ${/* the unit lives on the LABEL line like every other stat — "67 bpm" as the value
             overflowed its 60px column at 320px and got clipped */''}
      ${hStat(hAvg('hr') != null ? String(Math.round(hAvg('hr'))) : null, '❤️ avg bpm')}
    </div></div>
    ${at.screentime ? hChart('screenMin', '📱 Screen time', '#fb923c', v => fmtMin(Math.round(v))) : ''}
    ${at.steps ? hChart('steps', '👟 Steps', '#34d399', v => Math.round(v).toLocaleString()) : ''}
    ${at.calories ? hChart('calories', '🔥 Calories', '#f87171', v => Math.round(v) + ' kcal') : ''}
    ${at.workouts ? hChart('exerciseMin', '🏃 Active minutes', '#4ad6c0', v => fmtMin(Math.round(v))) : ''}
    ${at.sleep ? hChart('sleepMin', '😴 Sleep (auto)', '#a78bfa', v => fmtMin(Math.round(v))) : ''}
    ${(hCorrRows.length || screenVsWork) ? `<div class="card"><h2>🔗 Health ↔ You</h2>${hCorrRows.join('')}${screenVsWork}</div>` : ''}
    ${(!sampleOn && hDays < 5) ? '<button class="btn btn-ghost btn-sm" id="hc-sample">👀 Preview with sample data</button>' : ''}`);

  const TABS = [['overview', icon('chart', 15) + ' Overview'], ['time', icon('clock', 15) + ' Time'], ['check', icon('check', 15) + ' Checklist'], ['health', icon('heart', 15) + ' Health']];
  // The other tabs are pre-built STRINGS; the trophy case is a function, so it is called
  // here rather than put in the map — a function reference would stringify its own source
  // into the page. It is also the only tab that replays full history, so it stays lazy.
  const body = { overview: overviewHTML, time: timeHTML, check: checkHTML, health: healthHTML }[dashTab] || overviewHTML;
  document.getElementById('s-dash').innerHTML = sampleBannerHTML('these trends') + `
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
  document.getElementById('s-search').innerHTML = sampleBannerHTML('these results') + `
    <div class="card">
      <div class="task-add">
        <input type="text" id="search-q" placeholder="Search journals, notes, photo captions… or #tag" autocomplete="off" value="${escapeHtml(searchQ)}">
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
  // Photo captions: the thumbnail opens the photo, the rest of the row opens its day.
  const capRows = [];
  _media.forEach(r => { if (r.kind === 'photo' && hit(r.caption)) capRows.push(r); });
  capRows.sort((a, b) => b.day.localeCompare(a.day));
  if (capRows.length) groups.push(['📷 Photo captions', capRows.map(r =>
    `<div class="sr-row sr-photo" data-sr="${r.ctx === 'log' ? 'log' : 'note'}" data-d="${r.day}">
      <button class="mthumb sr-thumb" data-mview="${r.id}" aria-label="Open photo"><img src="${mediaUrl(r, 't')}" alt="" loading="lazy"></button>
      <span class="sr-when">${prettyDate(r.day).replace(/, \d{4}$/, '')}</span><span class="sr-snip">${snippet(r.caption, q)}</span></div>`)]);
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
  if (ev.target.closest('[data-mview]')) return;   // a caption hit's thumbnail opens the photo, not the day
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
let histTab = 'days';
function monthLong(ym, withYear) {
  try { return new Date(ym + '-15T12:00:00').toLocaleDateString('en', withYear ? { month: 'long', year: 'numeric' } : { month: 'long' }); }
  catch (e) { return ym; }
}
/* Every Log photo, newest month first. A month is one card, so a long history stays a list of
   short grids rather than one wall of thumbnails. */
function historyPhotosHTML() {
  if (!_mediaReady) return '<div class="empty">Loading…</div>';
  const ph = [];
  _media.forEach(r => { if (r.kind === 'photo' && r.ctx === 'log') ph.push(r); });
  if (!ph.length) return `<div class="empty">No photos yet. Add one from the <b>Photos &amp; voice</b> card on the Log — a year from now, “On this day” will show it back to you.</div>`;
  ph.sort((a, b) => b.day.localeCompare(a.day) || b.ts - a.ts);
  const byMonth = {};
  ph.forEach(r => (byMonth[r.day.slice(0, 7)] = byMonth[r.day.slice(0, 7)] || []).push(r));
  return `<div data-mset="gallery">${Object.keys(byMonth).map(ym => `<div class="card hist-photos">
    <h2>${escapeHtml(monthLong(ym, true))} <span class="hint">${byMonth[ym].length} photo${byMonth[ym].length === 1 ? '' : 's'}</span></h2>
    <div class="mgrid">${byMonth[ym].map(r => `<button class="mthumb" data-mview="${r.id}" aria-label="Photo from ${escapeHtml(prettyDate(r.day))}"><img src="${mediaUrl(r, 't')}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>
  </div>`).join('')}</div>
  <div class="ss-acts"><button class="btn btn-ghost" data-share-card="photos">${icon('share', 18)} Share a month as a card</button></div>`;
}
function renderHistory() {
  document.getElementById('screen-title').textContent = 'History';
  const e = DB.entries();
  const dates = Object.keys(e).sort().reverse();
  const tabs = mediaSupported() ? `<div class="seg-row hist-tabs">
    <button class="seg-btn ${histTab === 'days' ? 'on' : ''}" data-hist-tab="days">Days</button>
    <button class="seg-btn ${histTab === 'photos' ? 'on' : ''}" data-hist-tab="photos">Photos</button></div>` : '';
  if (histTab === 'photos' && mediaSupported()) {
    let n = 0; _media.forEach(r => { if (r.kind === 'photo' && r.ctx === 'log') n++; });   // what the grid shows
    document.getElementById('screen-sub').textContent = _mediaReady ? `${n} photo${n === 1 ? '' : 's'}` : '';
    document.getElementById('s-history').innerHTML = tabs + historyPhotosHTML();
    return;
  }
  document.getElementById('screen-sub').textContent = `${dates.length} entries`;
  if (!dates.length) { document.getElementById('s-history').innerHTML = tabs + '<div class="empty">No entries yet. Log your first day on the Log tab.</div>'; return; }
  const items = dates.map(d => {
    const en = e[d];
    const hc = en.habits ? Object.values(en.habits).filter(Boolean).length : 0;
    return `<div class="hist-item" data-open="${d}">
      <div><div class="hist-date">${prettyDate(d)}</div>
        <div class="hist-meta">${en.journal ? escapeHtml(en.journal.slice(0,46)) + (en.journal.length>46?'…':'') : '—'}</div></div>
      <div class="hist-moods"><span class="pill">😊 ${en.mood||'–'}</span><span class="pill">⚡ ${en.energy||'–'}</span><span class="pill">✅ ${hc}/${HABITS.length}</span>${(() => { const c = mediaDayCount(d); return c.p + c.v ? `<span class="pill">${c.p ? '📷 ' + c.p : ''}${c.p && c.v ? ' ' : ''}${c.v ? '🎙 ' + c.v : ''}</span>` : ''; })()}</div>
    </div>`;
  }).join('');
  document.getElementById('s-history').innerHTML = tabs + sampleBannerHTML('these days') + `<div class="card">${items}</div>`;
}
document.addEventListener('click', (ev) => {
  const ht = ev.target.closest && ev.target.closest('[data-hist-tab]');
  if (ht) { histTab = ht.dataset.histTab; renderHistory(); window.scrollTo(0, 0); }
});
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
    const wrote1 = DB.saveDocs(DB.docs().filter(x => x.id !== curDoc)); curDoc = null; renderWrite(); savedToast(wrote1, 'Article deleted'); return;
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
/* NO data-id on this row. enableDrag() reorders by querySelectorAll('[data-id]') inside
   #cfg-habits, so a data-id here would inject phantom ids into the saved order and the
   ids.map(...).filter(Boolean) that follows would silently DROP habits on the next drag. */
function cueInputHTML(h) {
  return `<div class="cfg-cue"><span class="cfg-cue-ico">📍</span>
    <input class="cfg-name" data-cfg-cue="${h.key}" maxlength="${CUE_MAX}"
      placeholder="when &amp; where — e.g. after my morning coffee"
      value="${escapeHtml(habitCue(h))}"></div>`;
}
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
        <button class="at-tog ${cached.vibrate === false ? '' : 'on'}" ${togAria(cached.vibrate !== false, 'Vibrate with the alarm')} data-snd-vib><span class="at-knob"></span></button>
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
      <div class="hint" style="margin-bottom:10px">📍 A when-and-where plan is the
        best-evidenced habit trick there is: “after my morning coffee, at my desk” beats
        “read more”. Your plan shows on that habit's chip on the Log until you tick it off.</div>
      <div id="cfg-habits">${habitCfg().map(h => cfgRow('h', h, !!h.custom) + cueInputHTML(h)).join('')}</div>
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
    cfg.push({ key: 'ch' + Date.now(), emoji: (m && m[2]) ? m[1] : '⭐', label: (m && m[2]) ? m[2] : raw, custom: true, added: todayStr() });
    const wrote2 = saveHabitCfg(cfg); renderCustom(); savedToast(wrote2, 'Habit added'); return;
  }
  if (ev.target.id === 'cfg-add-act') {
    const inp = document.getElementById('cfg-new-act'); const name = inp.value.trim(); if (!name) return;
    const acts = DB.timeacts();
    const em = emojiSplit(name); acts.push({ id: 'ta' + Date.now(), emoji: em.emoji, name: em.name, color: CUSTOM_ACT_COLORS[acts.length % CUSTOM_ACT_COLORS.length] });
    const wrote3 = DB.saveTimeacts(acts); renderCustom(); savedToast(wrote3, 'Activity added'); return;
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
    const wrote4 = saveDeepCfg(cfg); renderCustom(); savedToast(wrote4, 'Field added'); return; }
  if (ev.target.id === 'cfg-add-deepsec') {
    const raw = (document.getElementById('cfg-new-deepsec').value || '').trim(); if (!raw) return;
    const m = raw.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u);
    const title = (m && m[2]) ? (m[1] + ' ' + m[2]) : raw;
    const id = 'cs' + Date.now();
    const cfg = deepCfg();
    cfg.push({ id, title, scales: [], nums: [], texts: [], custom: true });
    openCfgSecs.add('deep:' + id);   // open it so the user can add fields right away
    const wrote5 = saveDeepCfg(cfg); renderCustom(); savedToast(wrote5, 'Section added — now add fields'); return; }
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
    const wrote6 = saveGymCfg(cfg); renderCustom(); savedToast(wrote6, 'Exercise added'); return; }

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
  if (nd) { const s = DB.settings(); s.defaultTab = nd.dataset.navDefault; const wrote7 = DB.saveSettings(s); renderCustom(); savedToast(wrote7, 'Default tab set'); return; }
  if (ev.target.id === 'cfg-add-group') {
    const inp = document.getElementById('cfg-new-group'); const raw = inp.value.trim(); if (!raw) return;
    const m = raw.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u);
    const gs = gymGroups();
    gs.push({ id: 'cg' + Date.now(), emoji: (m && m[2]) ? m[1] : '🏷️', name: (m && m[2]) ? m[2] : raw,
      color: CUSTOM_ACT_COLORS[gs.length % CUSTOM_ACT_COLORS.length] });
    const wrote8 = saveGymGroups(gs); renderCustom(); savedToast(wrote8, 'Group added — now add its exercises below'); return;
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
  if (ev.target && ev.target.id === 'wipe-word') {
    _wipeTyped = ev.target.value;
    // Enable/disable the Continue button in place — a full renderSettings() here would
    // destroy the focused input mid-keystroke.
    const b = document.getElementById('wipe-next3');
    if (b) b.disabled = _wipeTyped.trim().toUpperCase() !== WIPE_WORD;
    return;
  }
  const ce = ev.target.closest('[data-cfg-emoji]');
  if (ce) { const [k, id] = ce.dataset.cfgEmoji.split(':'); const f = cfgFind(k, id); if (f.item) { f.item.emoji = ce.value; f.save(); } return; }
  const cn = ev.target.closest('[data-cfg-name]');
  if (cn) { const [k, id] = cn.dataset.cfgName.split(':'); const f = cfgFind(k, id);
    if (f.item) { if (f.item.label !== undefined || k === 'h') f.item.label = cn.value; else f.item.name = cn.value; f.save(); } return; }
  const cq = ev.target.closest('[data-cfg-cue]');
  if (cq) { const f = cfgFind('h', cq.dataset.cfgCue);
    if (f.item) {
      const v = cq.value.replace(/\s+/g, ' ').trim().slice(0, CUE_MAX);
      // Never store '': the sync differ compares JSON.stringify(remote) against the stored
      // string, so writing empty cues into every habit would make every device see habitcfg
      // as changed and churn a pointless round-trip on first open. Mirrors `delete h.goal`.
      if (v) f.item.cue = v; else delete f.item.cue;
      f.save();
    }
    // Deliberately no renderCustom() here — it would destroy the focused input mid-keystroke.
    return; }
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
    await LN.schedule({ notifications: [{ id: POMO_NOTIF_ID, smallIcon: NOTIF_ICON, title: '🍅 ' + label,
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
    try { const ph = safeParse(localStorage.getItem('dp.pomohist'), {}); ph[todayStr()] = p.done.n; safeSet('dp.pomohist', JSON.stringify(ph)); } catch (_) {}
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
      LN.schedule({ notifications: [{ id: id++, smallIcon: NOTIF_ICON, title: '📦 ' + b.label, body: 'Time-box starting (' + b.start + ')',
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
    const wrote9 = DB.saveTimebox(tb); scheduleTimeboxAlarms(); renderFocus(); savedToast(wrote9, 'Block added 📦'); return;
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
function saveWaveSettings(w) { const ok = safeSet('dp.waves', JSON.stringify(w)); return ok; }
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

  document.getElementById('s-cal').innerHTML = sampleBannerHTML('the marked days') + `
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
  if (ed) { const wrote10 = DB.saveEvents(DB.events().filter(x => x.id !== ed.dataset.evDel)); renderCal(); setupReminders(); savedToast(wrote10, 'Event deleted'); return; }
});

/* ============================================================
   SCREEN: SETTINGS / MORE
   ============================================================ */
let settingsPage = null;
/* A switch has to SAY it is a switch and whether it is on; a bare button with a sliding dot
   read to TalkBack as "button", with no state at all. */
function togAria(on, label) {
  const l = stripLeadEmoji(String(label || '').replace(/<[^>]*>/g, '')).trim();
  return `role="switch" aria-checked="${on ? 'true' : 'false'}"${l ? ` aria-label="${escapeHtml(l)}"` : ''}`;
}
/* For async callbacks (a network reply, a permission sheet): the person may have left
   Settings meanwhile, and renderSettings() also rewrites the screen title. */
function renderSettingsIfShown() {
  const s = document.getElementById('s-settings');
  if (s && s.classList.contains('on')) renderSettings();
}   // which Settings page is open; null = the grouped home
function renderSettings() {
  const s = DB.settings();
  /* SYNC IS HIDDEN AGAIN (v222) — offered only to users who already connected it.

     v218 turned the section on for everyone, reasoning that the Data Safety form was "a form
     to update, not a feature to hide". That got the order backwards: this app ships its web
     layer from a URL, so the deploy WAS the rollout, and for four days the store declaration
     ("collects no data") contradicted a live feature. The declaration must change BEFORE the
     offer exists, not after.

     Until store/PASTE-6-data-safety.txt has been entered in Play Console:
       · users with s.syncUrl set keep the full card — they must always be able to see,
         sync and DISCONNECT something they already connected. Hiding their only off
         switch would be worse than the original mistake.
       · everyone else gets no offer. Their app transmits nothing, which is exactly what
         the declaration says.
     After the form is updated, make this `true` again. dp.health stays out of the payload
     either way, and there is still no Daylog server — the endpoint is the user's own
     Apps Script. */
  const SHOW_SYNC = !!s.syncUrl;
  // PIS sync was added by a different session and pushes to http://127.0.0.1:5001 — a
  // localhost-only integration with another of the owner's apps. It is meaningless (and
  // confusing) to public Play Store users, so it is hidden rather than deleted: the code
  // stays intact for whoever owns it, but it is not part of the shipped product.
  const SHOW_PIS = false;
  if (!s.ntfyTopic) { s.ntfyTopic = 'dp-' + randomToken(); DB.saveSettings(s); }   // one secret topic per user
  /* Every card is built on each render (cheap), then the page decides which to show. */
  const C = {
    feedback: `    <div class="card">
      <h2>💬 Feedback <span class="hint">no account · goes to one person</span></h2>
      <div class="hint" style="margin-bottom:9px">Daylog is built by <b>one person</b>, in their
        own time, with no company and no funding behind it. There is no support team reading
        this — it comes straight to me, and it is genuinely how the app gets better. If
        something is confusing, broken, or missing, please tell me. Even one line helps.</div>
      <div class="field"><textarea id="fb-text" placeholder="What's confusing? What's missing? What would make this actually useful for you?" style="min-height:80px"></textarea></div>
      <div class="btn-row"><button class="btn btn-primary btn-sm" id="fb-send">Send feedback</button></div>
      <div class="hint" style="margin-top:8px">No account and no sign-in. This opens your mail
        app with the message ready to send — so it does need a mail app, and I will see the
        address you send from. If you would rather stay anonymous, say so and I will not reply.</div>
    </div>`,
    sync: SHOW_SYNC ? `<div class="card">
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
      <details class="sync-what"><summary>Exactly what gets sent, and where</summary>
        <div class="hint">
          <p><b>Off unless you connect it.</b> With no link pasted above, nothing ever leaves this phone.</p>
          <p><b>It goes to your own Google Sheet.</b> Daylog has no server and no account. You deploy a small script into <i>your</i> Google account and paste its link here — so your data goes to your Drive, and the person who built this app cannot see it.</p>
          <p><b>Sent:</b> your log entries, habits, tasks, notes, plans, projects, time blocks, gym log, journal, goals and awards.</p>
          <p><b>Never sent:</b> anything from Health Connect — steps, sleep, heart rate, distance, calories, workouts. Those readings stay on this phone whether sync is on or off.</p>
          <p><b>To stop:</b> clear the box above. To delete the copy, delete the sheet in your Drive.</p>
          <p><a href="sheets-setup.html">How to set it up (5 minutes)</a></p>
        </div>
      </details>
    </div>` : '',
    tracking: (() => { const at = autoTrackCfg();
      const row = (k, label, sub) => `<div class="at-row ${at.on ? '' : 'at-dim'}">
        <div class="at-txt"><div class="at-lbl">${label}</div>${sub ? `<div class="at-sub">${sub}</div>` : ''}</div>
        <button class="at-tog ${at[k] ? 'on' : ''}" ${togAria(at[k], label)} data-at-toggle="${k}" ${!at.on && k !== 'on' ? 'disabled' : ''}><span class="at-knob"></span></button>
      </div>`;
      return `<div class="card">
      <h2>📈 Auto-tracking <span class="hint">${hcPlugin() ? 'from your phone' : 'needs the Play Store app'}</span></h2>
      ${hcPlugin() ? `<div class="hint" style="margin-bottom:8px">📱 <b>Screen time</b> uses Android's Usage access. 👟 <b>Steps, sleep, calories, workouts and heart rate</b> come from <b>Health Connect</b> — a separate one-time permission. Tap <b>Sync now</b> and Daylog will ask for whichever it needs.</div>
        ${(hcPlugin() && hcPlugin().requestHealthPermissions) ? '<button class="btn btn-ghost btn-sm" id="hc-connect" style="margin-bottom:10px">❤️ Connect Health Connect</button>' : '<div class="hint">Sensor metrics need the latest Play Store update.</div>'}` : ''}
      <div class="at-row">
        <div class="at-txt"><div class="at-lbl"><b>Auto health tracking</b></div><div class="at-sub">master switch — off = nothing is collected</div></div>
        <button class="at-tog ${at.on ? 'on' : ''}" ${togAria(at.on, 'Auto health tracking')} data-at-toggle="on"><span class="at-knob"></span></button>
      </div>
      ${row('sleep', '😴 Sleep', 'auto-fills your sleep from the phone')}
      ${row('steps', '👟 Steps & distance', '')}
      ${row('calories', '🔥 Calories', '')}
      ${row('workouts', '🏃 Workouts / cardio', 'active minutes & sessions')}
      ${row('hr', '❤️ Heart rate', 'needs a watch/band')}
      ${row('screentime', '📱 Screen time', 'daily phone usage')}
      <div class="hint" style="margin-top:8px">Everything stays on your phone. Sensor data needs the Play-update version of the app; these switches control what it's allowed to collect.</div>
    </div>`; })(),
    widgets: (() => {
      // Every widget with a "hide" link must be re-enableable here, or hiding it is a
      // one-way door. Stored flags are inverted (dp.*Off), so the switch shows !flag.
      const secRow = (id, label, sub) => { const on = !logSecHidden(id);
        return `<div class="at-row">
          <div class="at-txt"><div class="at-lbl">${label}</div>${sub ? `<div class="at-sub">${sub}</div>` : ''}</div>
          <button class="at-tog ${on ? 'on' : ''}" ${togAria(on, label)} data-sec-toggle="${id}"><span class="at-knob"></span></button>
        </div>`; };
      const flagRow = (flag, label, sub) => { const on = localStorage.getItem(flag) !== '1';
        return `<div class="at-row">
          <div class="at-txt"><div class="at-lbl">${label}</div>${sub ? `<div class="at-sub">${sub}</div>` : ''}</div>
          <button class="at-tog ${on ? 'on' : ''}" ${togAria(on, label)} data-widget-toggle="${flag}"><span class="at-knob"></span></button>
        </div>`; };
      return `<div class="card">
        <h2>🎛 Log screen widgets <span class="hint">show or hide</span></h2>
        ${secRow('ring', '🎯 Today ring', "how much of today you've logged")}
        ${secRow('onthisday', '🕰 On this day', 'your entry from a week / month / year ago')}
        ${secRow('moodgrid', '🎨 Mood grid', 'set mood and energy with one tap')}
        ${flagRow('dp.hapticsOff', '📳 Haptic buzz', 'a short vibration when you complete something')}
        ${flagRow('dp.nudgeOff', '👋 Nudge after 2 quiet days', 'one notification if you have not logged in two days — nothing else ever')}
        <div class="hint" style="margin-top:8px">To reorder or hide <b>any</b> Log card — tasks, checklist, workout, reflection, deep log — use <b>Customize ▸ Log screen sections</b>.</div>
      </div>`; })(),
    alarmHealth: alarmHealthHTML(),
    reminders: `    <div class="card">
      <h2>⏰ Reminders <span class="hint">${DB.reminders().length} set</span></h2>
      ${DB.reminders().length ? `<div class="rem-list">` + DB.reminders().map(r => `
        <div class="rem ${r.enabled?'':'off'}" data-remid="${r.id}">
          <div class="rem-top">
            <button class="rem-toggle" data-rem-toggle="${r.id}" title="on/off">${r.enabled?'🔔':'🔕'}</button>
            <input type="time" data-rem-time="${r.id}" value="${r.time||''}">
            <input type="text" data-rem-label="${r.id}" value="${escapeHtml(r.label||'')}" placeholder="What for?">
            <button class="del" data-rem-del="${r.id}">×</button>
          </div>
          <button class="rem-mode" data-rem-mode="${r.id}" title="tap to switch">${(r.mode||'alarm')==='alarm'?'⏰ Full-screen alarm':'🔔 Just a notification'}</button>
        </div>`).join('') + `</div>` : '<div class="empty">No reminders yet — add your first one below 👇</div>'}
      ${/* This heading is load-bearing, not decoration. A saved reminder row (time + name + ×)
             and the blank add-row (time + placeholder + Add) look almost identical, and the
             add-row defaults to 21:00 — the same time onboarding sets. A user who set a
             reminder during onboarding read the add-row as the only control and concluded
             their reminder had not been saved at all. The saved rows now sit on their own
             surface and this label marks where the list ends. */''}
      <div class="rem-add-h">${DB.reminders().length ? 'Add another' : 'Add a reminder'}</div>
      <div class="task-add">
        <input type="time" id="rem-new-time" value="21:00" style="max-width:120px">
        <input type="text" id="rem-new-label" placeholder="Reminder name…">
        <button class="btn btn-primary btn-sm" id="rem-add">Add</button>
      </div>
      ${/* There were FOUR overlapping test buttons here — a development scaffold that
             shipped. Only one of them tested anything a user cares about: a real alarm
             firing while the app is closed. The rest tested the in-app overlay, which
             proves nothing about the native path. */''}
      <div class="btn-row" style="margin-top:10px">
        ${fullScreenPlugin()
          ? '<button class="btn btn-primary btn-sm" id="rem-fs-test">⏰ Test my alarm (1 min)</button>'
          : (nativeShell() ? '<button class="btn btn-primary btn-sm" id="rem-native-test">🔔 Test my alarm (1 min)</button>'
                           : '<button class="btn btn-primary btn-sm" id="rem-test">🔔 Test alarm</button>')}
        <button class="btn btn-ghost btn-sm" id="rem-calendar">📅 Add to phone calendar</button>
      </div>
      <div class="hint" style="margin-top:8px">The full-screen alarm fires while the app is open, and catches missed ones when you reopen. For alarms even when the app is fully closed, tap <b>Add to phone calendar</b> (adds daily repeating alerts your phone rings natively).</div>
    </div>`,
    ntfy: nativeShell() ? '' : `<div class="card">
      <h2>🔔 Background alarms · ntfy <span class="hint">${s.ntfyOn ? 'ON ●' : 'off'}</span></h2>
      <div class="hint">Rings even when this app is <b>closed & your phone is locked</b>. One-time setup with the free <b>ntfy</b> app.</div>
      <div class="hint" style="margin-top:6px; border-left:3px solid var(--accent); padding-left:8px">
        <b>This one sends data off your phone.</b> While it is ON, each reminder's <b>name and time</b>
        are sent to <b>ntfy.sh</b>, a free service run by someone else, so their app can ring on
        schedule. Your topic is the only thing keeping those private — anyone who knows it can read
        them, so do not share it. Nothing else in Daylog leaves your phone, and this is off until you
        turn it on.</div>
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
    </div>`,
    backup: `    <div class="card">
      <h2>💾 Backup &amp; restore <span class="hint">last: ${(() => { const t = +localStorage.getItem('dp.lastBackup') || 0; if (!t) return 'never'; const d = Math.floor((Date.now() - t) / 86400000); return d === 0 ? 'today ✅' : d + 'd ago' + (d > 7 ? ' ⚠️' : ''); })()}</span></h2>
      <div class="hint" style="margin-bottom:8px">A backup file is the only way to move your data to a new phone or recover it after a reinstall (the PDF report is just for reading, it can't be restored). Keep one in Drive/email.</div>
      ${(() => { const m = mediaTotals(); return m.photos + m.voice ? `<div class="hint" style="margin-bottom:8px">Your <b>${m.photos ? m.photos + ' photo' + (m.photos === 1 ? '' : 's') : ''}${m.photos && m.voice ? ' and ' : ''}${m.voice ? m.voice + ' voice note' + (m.voice === 1 ? '' : 's') : ''}</b> (${fmtBytes(m.bytes)}) go in the backup file too, so it is bigger than it used to be. They are not sent to the Google Sheet.</div>` : ''; })()}
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" id="export">⬇ Export backup</button>
        <button class="btn btn-ghost btn-sm" id="import">Import backup</button>
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn btn-ghost btn-sm" id="export-csv">⬇ Export CSV (for Excel/AI)</button>
      </div>
      ${/* Both the extension AND the mime: some Android pickers match only on extension and
       show a greyed-out list for a bare mime type, which looks like "no backups found". */''}
      <input type="file" id="import-file" accept=".json,application/json" style="display:none">
      ${s.syncUrl ? '' : `
      ${/* Reconnect for someone who skipped the onboarding restore door. Framed strictly for
             returning sync users; the sync OFFER stays withheld until the Data Safety form
             matches it (see SHOW_SYNC above). */''}
      <details class="sync-what"><summary>Used Google Sheet sync on an old phone? Reconnect</summary>
        <div class="hint">
          <p>Paste the same script link you used before. It pulls your data back onto this phone and keeps syncing to your own sheet.</p>
          <input type="url" id="set-restore-url" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off">
          <button class="btn btn-primary btn-sm" id="set-restore-pull" style="margin-top:8px;min-height:44px">Restore from the link</button>
        </div>
      </details>`}
    </div>`,
    wipe: `    ${/* An app that holds a private journal has to let you destroy it without uninstalling —
         but two taps was far too little friction for something with no undo. This is a
         deliberate gauntlet: four separate confirmations, a countdown you cannot skip, and a
         typed word. Every stage resets on the slightest hesitation. */''}
    <div class="card">
      <h2>🧨 Delete everything <span class="hint">on this device</span></h2>
      <div class="hint" style="margin-bottom:8px">Erases every entry, habit, note, task, plan,
        article, workout, time block, award and setting from this phone. <b>There is no undo.</b>
        It does not touch any backup file you have already saved. <b>Export a backup first</b>
        if there is any chance you will want this back.</div>
      ${wipeStageHTML()}
    </div>`,
    pis: SHOW_PIS ? `<div class="card">
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
    </div>` : ""
  };
  /* Settings used to be one long scroll of eleven unrelated cards — feedback in the middle,
     reminders below the widget switches — so nobody could tell what lived where. Now a short
     home page of labelled groups, each row opening a page that holds one thing. */
  const at = autoTrackCfg(), nRem = DB.reminders().length;
  const lastT = +localStorage.getItem('dp.lastBackup') || 0, lastD = lastT ? Math.floor((Date.now() - lastT) / 86400000) : -1;
  const PAGES = {
    widgets:   { t: 'Log screen',        sub: 'What shows on your Log tab',          html: C.widgets },
    reminders: { t: 'Reminders',         sub: 'Alarms and notifications',            html: C.alarmHealth + C.reminders + C.ntfy },
    tracking:  { t: 'Auto-tracking',     sub: 'Sleep, steps and screen time',        html: C.tracking },
    data:      { t: 'Backup & restore',  sub: 'Keep a copy, move to a new phone',    html: C.backup + C.sync + C.pis },
    wipe:      { t: 'Delete everything', sub: 'Erase all data on this phone',        html: C.wipe },
    feedback:  { t: 'Send feedback',     sub: 'Straight to the person who makes it', html: C.feedback },
  };
  const pg = PAGES[settingsPage];
  if (!pg) settingsPage = null;
  document.getElementById('screen-title').textContent = pg ? pg.t : 'Settings';
  document.getElementById('screen-sub').textContent = pg ? pg.sub : 'Customize, reminders, data';
  const row = (attrs, ico, lbl, sub, cls = '') => `<button class="set-row ${cls}" ${attrs}>
      <span class="set-ico">${icon(ico, 21)}</span>
      <span class="set-txt"><span class="set-lbl">${lbl}</span><span class="set-sub">${sub}</span></span>
      <span class="set-go" aria-hidden="true">›</span></button>`;
  const group = (title, rows) => `<section class="set-group"><h3 class="set-h">${title}</h3><div class="set-card">${rows}</div></section>`;
  document.getElementById('s-settings').innerHTML = pg
    ? `<button class="back-btn set-back" id="set-back">← All settings</button>${pg.html}`
    : `${C.alarmHealth}
    ${group('Make it yours',
      row('id="open-custom"', 'sparkle', 'Customize', 'Tabs, habits, log fields, gym, theme') +
      row('data-set-page="widgets"', 'layers', 'Log screen', 'Show or hide the ring, mood grid and more'))}
    ${group('Reminders &amp; tracking',
      row('data-set-page="reminders"', 'bell', 'Reminders', nRem ? `${nRem} set` + (!nativeShell() && s.ntfyOn ? ' · background alarms on' : '') : 'None yet · add a daily nudge') +
      row('data-set-page="tracking"', 'heart', 'Auto-tracking', !hcPlugin() ? 'Needs the Play Store app' : at.on ? 'On · sleep, steps, screen time from your phone' : 'Off · nothing is collected'))}
    ${group('Your data',
      row('data-set-page="data"', 'download', 'Backup &amp; restore', lastD < 0 ? 'No backup yet · do this once' : lastD === 0 ? 'Last backup today' : `Last backup ${lastD} day${lastD === 1 ? '' : 's'} ago`, lastD < 0 || lastD > 7 ? 'set-warn' : '') +
      row('id="open-report"', 'note', 'Download report (PDF)', 'Your stats as a printable report') +
      row('data-set-page="wipe"', 'trash', 'Delete everything', 'Erase all data on this phone', 'set-danger'))}
    ${group('Help',
      row('id="open-tour"', 'play', 'Take the app tour', '60-second guided walkthrough') +
      `<a class="set-row" href="guide.html"><span class="set-ico">${icon('book', 21)}</span>
        <span class="set-txt"><span class="set-lbl">How to use Daylog</span><span class="set-sub">A quick illustrated guide</span></span><span class="set-go" aria-hidden="true">›</span></a>` +
      row('data-set-page="feedback"', 'message', 'Send feedback', 'Something broken or missing? Tell me'))}
    ${group('Support',
      row('id="open-invite"', 'share', 'Tell a friend', 'A card or a link · how people find Daylog') +
      (tipPlugin() ? row('id="open-tip"', 'heart', 'Support Daylog', 'An optional tip · unlocks nothing', 'set-tip') : ''))}
    <p class="set-about">Daylog ${APP_VERSION} · Your data stays on this phone${s.syncUrl ? ' and your Google Sheet' : ''} · <a href="privacy.html" target="_blank" rel="noopener">Privacy policy</a></p>`;
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
  if (rd) { const wrote11 = DB.saveReminders(DB.reminders().filter(z => z.id !== rd.dataset.remDel)); renderSettings(); syncReminders(); setupReminders(); savedToast(wrote11, 'Reminder deleted'); return; }
  if (ev.target.id === 'rem-test') {
    unlockAudio();
    if ('Notification' in window && Notification.permission !== 'granted') Notification.requestPermission();
    fireAlarm('Test alarm ✅', '', false);
    return;
  }
  if (ev.target.id === 'rem-calendar') { exportReminderCalendar(); return; }
  if (ev.target.id === 'rem-native-test') {
    const LN = window.Capacitor.Plugins.LocalNotifications;
    (async () => {
      const perm = await LN.requestPermissions();
      if (perm.display !== 'granted') { toast('Allow notifications first', true); return; }
      await LN.schedule({ notifications: [{ id: 424242, smallIcon: NOTIF_ICON, title: '⏰ Daylog native alarm',
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
  const sp = ev.target.closest('[data-set-page]');
  if (sp) { settingsPage = sp.dataset.setPage; renderSettings(); window.scrollTo(0, 0); return; }
  if (ev.target.closest('#set-back')) { settingsPage = null; renderSettings(); wipeAbandonIfAway(); window.scrollTo(0, 0); return; }
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
    setLogSecHidden(id, wasOn); sct.classList.toggle('on', !wasOn); sct.setAttribute('aria-checked', !wasOn ? 'true' : 'false');
    toast(wasOn ? 'Hidden' : 'Switched back on'); return; }
  const lsh = ev.target.closest('[data-logsec-hide]');
  if (lsh) { const id = lsh.dataset.logsecHide;
    setLogSecHidden(id, !logSecHidden(id)); renderCustom(); return; }
  if (ev.target && ev.target.id === 'logsec-reset') {
    localStorage.removeItem('dp.logsec'); renderCustom(); toast('Order reset'); return; }
  const wt = ev.target.closest('[data-widget-toggle]');
  if (wt) { const flag = wt.dataset.widgetToggle;
    const wasOn = localStorage.getItem(flag) !== '1';
    if (wasOn) safeSet(flag, '1'); else localStorage.removeItem(flag);
    wt.classList.toggle('on', !wasOn); wt.setAttribute('aria-checked', !wasOn ? 'true' : 'false');
    if (flag === 'dp.hapticsOff' && wasOn === false) buzz(18);
    if (flag === 'dp.nudgeOff') {
      /* An off switch has to take effect NOW. scheduleInactivityReminder only runs on save,
         so without this a nudge already sitting in Android's queue would still fire — the
         user would turn it off and still be nudged, which is worse than not offering it. */
      scheduleInactivityReminder();
      toast(wasOn ? 'Nudge off — no more notifications from Daylog' : 'Nudge back on');
      return;
    }
    toast(wasOn ? 'Hidden' : 'Switched back on');
    return; }
  const att = ev.target.closest('[data-at-toggle]');
  if (att) { const k = att.dataset.atToggle; const at = autoTrackCfg();
    saveAutoTrack({ [k]: !at[k] }); renderSettings();
    if (k === 'on') toast(!at.on ? 'Auto-tracking ON' : 'Auto-tracking OFF — nothing will be collected');
    return; }
  if (ev.target.id === 'wipe-cancel') { wipeReset(); renderSettings(); toast('Cancelled — nothing was deleted'); return; }
  if (ev.target.id === 'wipe-go')    { wipeReset(); _wipeStage = 1; renderSettings(); return; }
  if (ev.target.id === 'wipe-export') { exportData(); return; }
  if (ev.target.id === 'wipe-next1') {
    _wipeStage = 2; _wipeCountdown = 5; renderSettings();
    clearInterval(_wipeTick);
    _wipeTick = setInterval(() => {
      _wipeCountdown--;
      if (_wipeCountdown <= 0) { clearInterval(_wipeTick); _wipeTick = null; }
      // Only repaint while the stage is still on screen, or this fights other renders.
      if (document.getElementById('wipe-stage')) renderSettings(); else wipeReset();
    }, 1000);
    return;
  }
  if (ev.target.id === 'wipe-next2') { if (_wipeCountdown > 0) return; _wipeStage = 3; _wipeTyped = ''; renderSettings(); return; }
  if (ev.target.id === 'wipe-next3') {
    if (_wipeTyped.trim().toUpperCase() !== WIPE_WORD) return;
    _wipeStage = 4; renderSettings(); return;
  }
  if (ev.target.id === 'wipe-confirm') {
    if (_wipeStage !== 4) return;
    wipeReset();
    const n = wipeEverything();
    const p = mediaTotals();
    toast(n + ' items' + (p.photos + p.voice ? ` and ${p.photos + p.voice} photos/voice notes` : '') + ' erased. Daylog is empty.');
    // Reload only once the photo database is really gone, or it survives the "delete everything".
    Promise.all([mediaWipe(), new Promise(r => setTimeout(r, 900))]).then(() => location.reload());
    return;
  }
  if (ev.target.id === 'export') exportData();
  if (ev.target.id === 'export-csv') exportCSV();
  if (ev.target.id === 'import') document.getElementById('import-file').click();
  if (ev.target.id === 'set-restore-pull') {
    const raw = (document.getElementById('set-restore-url').value || '').trim();
    toast('Connecting…');
    syncLinkRestore(raw, (status, days) => {
      if (status === 'restored') { renderSettingsIfShown(); refreshStreak(); toast(`Restored ${days} day${days === 1 ? '' : 's'} ✅`); }
      else if (status === 'empty') { renderSettingsIfShown(); toast('Connected, but the sheet has no data to restore yet', true); }
      else if (status === 'bad-url') toast('That does not look like a sync link — it ends in /exec', true);
      else toast('Could not reach that link — check it and try again', true);
    });
    return;
  }
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
  // A report built while the sample preview is active is computed over seeded Math.random()
  // days, because nothing filters `sample: true` out of the analytics. Saying so on the page
  // is the minimum: a PDF outlives the banner on screen and can be read by someone who never
  // saw it — which is exactly how fake figures get mistaken for real ones.
  if (sampleActive()) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(180, 60, 30);
    doc.text('Includes SAMPLE DATA — a preview, not your real figures.', M, y); y += 16;
    doc.setTextColor(22, 22, 34);
  }
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
  const rr = await saveFile('daily-pulse-report-' + todayStr() + '.pdf', doc.output('blob'), 'application/pdf');
  // saveFile already told the user exactly what happened, including when it could not save
  // at all. A blanket "Report PDF ready 📄" on top of that was a flat contradiction, and the
  // notification promised a file that did not exist.
  if (!saveOk(rr)) return;
  if (nativeShell()) { try { window.Capacitor.Plugins.LocalNotifications.schedule({ notifications: [{ id: 780, smallIcon: NOTIF_ICON, title: 'Daylog', body: 'Your report PDF is ready to save/share', schedule: { at: new Date(Date.now() + 400) } }] }); } catch (e) {} }
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

async function sendFeedback(text, contact) {
  if (FEEDBACK_URL) {
    // mode:'no-cors' means the RESPONSE is opaque — a 500 from the Apps Script is
    // indistinguishable from a 200, and that limit cannot be removed without CORS on the
    // endpoint. But a genuine network failure (offline, DNS, blocked) still REJECTS, and the
    // old code swallowed that in `.catch(() => {})`, cleared the box and said "Feedback sent 💛"
    // to someone on a train with no signal. Await it: keep their words and say what happened.
    try {
      await fetch(FEEDBACK_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ text, contact, version: APP_VERSION, ua: navigator.userAgent.slice(0, 120) }) });
    } catch {
      toast('Could not send — check your connection. Your text is still here.', true);
      return;
    }
    const ft = document.getElementById('fb-text'); if (ft) ft.value = '';
    toast('Thank you! Feedback sent 💛');
    return;
  }
  // No silent endpoint set → hand off to the mail app.
  //
  // The textarea is deliberately NOT cleared here. A mailto: handoff cannot be confirmed: if the
  // phone has no mail client configured — ordinary on Android without Gmail set up — nothing
  // happens at all, and clearing first meant the user watched their feedback vanish while the app
  // said "Opening your mail app…". Same shape as every save that reported success it had not
  // earned, except this one costs someone the paragraph they just wrote.
  const subject = encodeURIComponent('Daylog feedback (' + APP_VERSION + ')');
  const body = encodeURIComponent(text + '\n\n— sent from Daylog ' + APP_VERSION);
  location.href = 'mailto:' + FEEDBACK_EMAIL + '?subject=' + subject + '&body=' + body;
  toast('Opening your mail app — your text stays here until you send it');
}

/* ============================================================
   PHOTOS & VOICE NOTES
   ------------------------------------------------------------
   They live in IndexedDB, never localStorage: one phone photo is bigger than localStorage's
   whole ~5 MB budget, and the journal must never compete with pictures for that space.
   They stay on this phone. They are NOT sent to the Google Sheet (a cell holds 50k characters
   and a photo is ~300k as text), and they DO ride along in the backup file, as base64, so a
   restore on a new phone brings them back.

   A record:  { id, kind: 'photo'|'voice', mime, blob, thumb?, day: 'YYYY-MM-DD',
                ctx: 'log' | 'note:<noteId>', ts, w?, h?, dur?, size, caption? }

   Photos are re-encoded on the phone (longest edge 1600px, JPEG): a 12 MP camera shot is
   4-6 MB and would fill a cheap phone in a few hundred days; this is ~300 KB and still sharp
   full-screen. Re-encoding also drops the EXIF block, so a photo's GPS location never sits
   in the app or a backup file.
   ============================================================ */
const MEDIA_DB = 'daylog-media';
const MEDIA_MAX_EDGE = 1600, MEDIA_THUMB_EDGE = 360, MEDIA_JPEG_Q = 0.82;
const VOICE_MAX_MS = 10 * 60 * 1000;          // a voice NOTE; ten minutes then it saves itself
const VOICE_MIN_MS = 700;                      // shorter than this is a mis-tap, not a note
let _mediaDbP = null;
const _media = new Map();                      // id → record. IDB blobs are disk-backed handles,
let _mediaReady = false;                       // so holding every record costs almost nothing.
const _mediaUrls = new Map();                  // 'id:t' / 'id:f' → object URL
function mediaSupported() { return typeof indexedDB !== 'undefined' && !!indexedDB && typeof Blob !== 'undefined'; }
function mediaId() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function mediaOpen() {
  if (_mediaDbP) return _mediaDbP;
  _mediaDbP = new Promise((res, rej) => {
    let rq;
    try { rq = indexedDB.open(MEDIA_DB, 1); } catch (e) { _mediaDbP = null; rej(e); return; }
    rq.onupgradeneeded = () => {
      const s = rq.result.createObjectStore('media', { keyPath: 'id' });
      s.createIndex('day', 'day'); s.createIndex('ctx', 'ctx');
    };
    rq.onsuccess = () => {
      const db = rq.result;
      // Another tab deleting or upgrading the database must not be blocked by this one.
      db.onversionchange = () => { db.close(); _mediaDbP = null; };
      res(db);
    };
    rq.onerror = () => { _mediaDbP = null; rej(rq.error); };
  });
  return _mediaDbP;
}
/* Resolves only when the transaction COMMITS. A put() request succeeding is not the write
   landing on disk — a quota failure aborts the transaction after the request "succeeded" —
   and this app has had to unlearn reporting success it had not earned more than once. */
async function mediaWrite(fn) {
  const db = await mediaOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('media', 'readwrite');
    fn(tx.objectStore('media'));
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error || new Error('aborted'));
  });
}
async function mediaReadAll() {
  const db = await mediaOpen();
  return new Promise((res, rej) => {
    const rq = db.transaction('media', 'readonly').objectStore('media').getAll();
    rq.onsuccess = () => res(rq.result || []);
    rq.onerror = () => rej(rq.error);
  });
}
async function mediaLoad() {
  if (!mediaSupported()) return;
  try {
    const all = await mediaReadAll();
    _media.clear(); all.forEach(r => { if (r && r.id) _media.set(r.id, r); });
  } catch (e) { /* stays empty; mediaSlotHTML says it cannot open storage */ }
  _mediaReady = true;
  refreshMediaSlots();
  // "On this day" renders before IndexedDB answers; redraw just that card if a photo changes it.
  try { const slot = document.getElementById('otd-slot'); if (slot) slot.innerHTML = throwbackHTML(); } catch (e) {}
}
function mediaQuotaMsg(e) {
  return e && /quota/i.test(String(e.name || '') + String(e.message || ''))
    ? 'Your phone is out of space — free some up, then try again'
    : 'Could not save it on this phone';
}
async function mediaAdd(rec) {
  try { await mediaWrite(s => s.put(rec)); }
  catch (e) { toast(mediaQuotaMsg(e) + ' — it was NOT saved', true); return false; }
  _media.set(rec.id, rec);
  // Ask once for durable storage, so the browser never evicts photos to make room.
  // (In the Play Store app the WebView's storage is app data and is never evicted anyway.)
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  return true;
}
function mediaRevoke(id) {
  ['t', 'f'].forEach(k => { const u = _mediaUrls.get(id + ':' + k); if (u) { URL.revokeObjectURL(u); _mediaUrls.delete(id + ':' + k); } });
}
async function mediaDelete(ids) {
  ids = [].concat(ids).filter(id => _media.has(id));
  if (!ids.length) return true;
  try { await mediaWrite(s => ids.forEach(id => s.delete(id))); }
  catch (e) { toast('Could not delete it — try again', true); return false; }
  ids.forEach(id => { if (_play && _play.id === id) voiceHalt(); mediaRevoke(id); _media.delete(id); });
  return true;
}
function mediaUrl(rec, which) {
  const key = rec.id + ':' + which;
  if (!_mediaUrls.has(key)) {
    const b = which === 't' && rec.thumb ? rec.thumb : rec.blob;
    _mediaUrls.set(key, URL.createObjectURL(b));
  }
  return _mediaUrls.get(key);
}
function mediaList(ctx, day) {
  const out = [];
  _media.forEach(r => { if (r.ctx === ctx && (day == null || r.day === day)) out.push(r); });
  return out.sort((a, b) => a.ts - b.ts);
}
function mediaHas(ctx) { for (const r of _media.values()) if (r.ctx === ctx) return true; return false; }
/* "Photo note" / "Voice note" on the Notes screen. The note is created only AFTER the media is
   safely written — a cancelled camera or a full disk must not leave an empty note behind. */
function mediaNewNoteId() { return 'n' + Date.now(); }
function mediaCommitNote(id) {
  const ns = DB.notes(); if (ns.some(n => n.id === id)) return;
  const inp = document.getElementById('note-input');
  const text = inp ? inp.value.trim() : '';
  if (inp) inp.value = '';
  ns.unshift({ id, text, color: '', created: todayStr() });
  DB.saveNotes(ns); syncNotes();
}
function mediaAfterNote() {
  const sc = document.getElementById('s-notes');
  if (sc && sc.classList.contains('on')) renderNotes();
}
function mediaDayCount(day) {
  let p = 0, v = 0;
  _media.forEach(r => { if (r.day === day && r.ctx === 'log') { if (r.kind === 'photo') p++; else v++; } });
  return { p, v };
}
function mediaTotals() {
  let photos = 0, voice = 0, bytes = 0;
  _media.forEach(r => { if (r.kind === 'photo') photos++; else voice++; bytes += r.size || 0; });
  return { photos, voice, bytes };
}
function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return Math.round(n / 1024) + ' KB';
  return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
}
function fmtClipLen(ms) { const s = Math.max(0, Math.round((ms || 0) / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function mediaWhen(ts) { try { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
/* Scale (w,h) so the longest edge is at most `max`, never upscaling. Pure, so it is tested. */
function mediaFit(w, h, max) {
  const k = Math.min(1, max / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/* ---------- photos: decode → shrink → JPEG ---------- */
async function mediaDecode(file) {
  // createImageBitmap honours the camera's EXIF rotation; without it a portrait shot from
  // many Android cameras lands sideways.
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) {}
  }
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(u); res(im); };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('decode')); };
    im.src = u;
  });
}
function mediaEncode(src, w, h, q) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);     // JPEG has no alpha; a PNG's clear parts would go black
  x.drawImage(src, 0, 0, w, h);
  return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', q));
}
async function mediaPhotoRecord(file, ctx, day) {
  const src = await mediaDecode(file);
  const W = src.width || src.naturalWidth, H = src.height || src.naturalHeight;
  if (!W || !H) throw new Error('decode');
  const big = mediaFit(W, H, MEDIA_MAX_EDGE), sm = mediaFit(W, H, MEDIA_THUMB_EDGE);
  const blob = await mediaEncode(src, big.w, big.h, MEDIA_JPEG_Q);
  const thumb = await mediaEncode(src, sm.w, sm.h, 0.72);
  if (src.close) src.close();
  if (!blob) throw new Error('encode');
  return { id: mediaId(), kind: 'photo', mime: 'image/jpeg', blob, thumb, day, ctx, ts: Date.now(),
    w: big.w, h: big.h, size: blob.size + (thumb ? thumb.size : 0) };
}
let _mediaTarget = null;     // { ctx, day } the next picked photo belongs to
function mediaInputs() {
  if (document.getElementById('media-cam')) return;
  const mk = (id, extra) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/*'; i.id = id; i.hidden = true;
    Object.assign(i, extra);
    i.addEventListener('change', () => { const fs = [...(i.files || [])]; i.value = ''; mediaTakeFiles(fs); });
    document.body.appendChild(i);
  };
  mk('media-cam', {}); document.getElementById('media-cam').setAttribute('capture', 'environment');
  mk('media-pick', { multiple: true });
}
function mediaPick(how, ctx, day) {
  if (!mediaSupported()) { toast('This browser cannot store photos', true); return; }
  mediaInputs();
  _mediaTarget = { ctx, day };
  document.getElementById(how === 'camera' ? 'media-cam' : 'media-pick').click();
}
async function mediaTakeFiles(files) {
  const t = _mediaTarget; if (!t || !files.length) return;
  const imgs = files.filter(f => /^image\//.test(f.type) || !f.type);
  if (!imgs.length) { toast('That is not a photo', true); return; }
  if (imgs.length > 1) toast(`Adding ${imgs.length} photos…`);
  const newNote = t.ctx === 'note:new' ? mediaNewNoteId() : null;
  const ctx = newNote ? 'note:' + newNote : t.ctx;
  let saved = 0, bad = 0;
  for (const f of imgs) {
    let rec;
    try { rec = await mediaPhotoRecord(f, ctx, t.day); } catch (e) { bad++; continue; }
    if (await mediaAdd(rec)) saved++; else break;      // out of space: stop, mediaAdd said so
  }
  if (newNote && saved) { mediaCommitNote(newNote); mediaAfterNote(); }
  refreshMediaSlots();
  if (saved) { buzz(8); toast(saved === 1 ? 'Photo saved' : saved + ' photos saved'); }
  if (bad) toast(bad === 1 ? 'That photo could not be read — try a different one' : bad + ' photos could not be read', true);
}

/* ---------- voice notes ---------- */
let _rec = null;    // { mr, chunks, t0, ctx, day, stream, mime, tick, cap }
function voiceMime() {
  if (!window.MediaRecorder) return null;
  for (const m of ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
  }
  return '';
}
async function voiceStart(ctx, day) {
  if (_rec) return;
  if (!mediaSupported() || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || voiceMime() === null) {
    toast('Voice notes need a newer browser or Android System WebView', true); return;
  }
  voiceHalt();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) {
    toast(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
      ? 'Microphone is off for Daylog — allow it in your phone’s Settings ▸ Apps ▸ Daylog ▸ Permissions'
      : 'Could not start the microphone' + (e && e.name === 'NotReadableError' ? ' — another app is using it' : ''), true);
    return;
  }
  const mime = voiceMime();
  let mr;
  try { mr = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 32000 }, mime ? { mimeType: mime } : {})); }
  catch (e) { stream.getTracks().forEach(t => t.stop()); toast('This phone cannot record audio here', true); return; }
  const r = _rec = { mr, chunks: [], t0: Date.now(), ctx, day, stream, mime: mr.mimeType || mime || 'audio/webm', peak: 0 };
  /* A live level meter. A recording of silence — mic muted, another app holding it, a case
     over the hole — is the classic voice-note failure, and it is invisible until playback. */
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    r.ac = new AC(); r.an = r.ac.createAnalyser(); r.an.fftSize = 512;
    r.ac.createMediaStreamSource(stream).connect(r.an);
    r.buf = new Uint8Array(r.an.fftSize);
  } catch (e) { r.an = null; }
  mr.ondataavailable = e => { if (e.data && e.data.size) r.chunks.push(e.data); };
  mr.onstop = () => voiceFinish(r);
  mr.onerror = () => voiceStop(false);
  try { mr.start(1000); }
  catch (e) { _rec = null; stream.getTracks().forEach(t => t.stop()); toast('Could not start recording', true); return; }
  r.tick = setInterval(voiceTick, 250);
  r.cap = setTimeout(() => { voiceStop(false); toast('Ten minutes is the limit for one note — saved'); }, VOICE_MAX_MS);
  buzz(12);
  refreshMediaSlots();
}
function voiceTick() {
  const r = _rec; if (!r) return;
  const el = document.getElementById('vrec-t');
  if (el) el.textContent = fmtClipLen(Date.now() - r.t0);
  if (r.an) {
    r.an.getByteTimeDomainData(r.buf);
    let sum = 0; for (let i = 0; i < r.buf.length; i++) { const v = (r.buf[i] - 128) / 128; sum += v * v; }
    const lvl = Math.min(1, Math.sqrt(sum / r.buf.length) * 4);
    r.peak = Math.max(r.peak, lvl);
    const m = document.getElementById('vrec-lvl'); if (m) m.style.width = Math.round(lvl * 100) + '%';
  }
}
function voiceStop(cancel) {
  const r = _rec; if (!r || r.stopping) return;
  r.stopping = true; r.cancelled = !!cancel; r.dur = Date.now() - r.t0;
  clearInterval(r.tick); clearTimeout(r.cap);
  try { if (r.mr.state !== 'inactive') r.mr.stop(); else voiceFinish(r); } catch (e) { voiceFinish(r); }
}
async function voiceFinish(r) {
  if (r.done) return; r.done = true;
  try { r.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { if (r.ac) r.ac.close(); } catch (e) {}
  if (_rec === r) _rec = null;
  if (r.cancelled) { refreshMediaSlots(); toast('Recording discarded'); return; }
  const blob = new Blob(r.chunks, { type: r.mime });
  if (!blob.size || r.dur < VOICE_MIN_MS) { refreshMediaSlots(); toast('Too short to keep — hold on a little longer', true); return; }
  const newNote = r.ctx === 'note:new' ? mediaNewNoteId() : null;
  const ok = await mediaAdd({ id: mediaId(), kind: 'voice', mime: r.mime, blob, day: r.day, ctx: newNote ? 'note:' + newNote : r.ctx,
    ts: r.t0, dur: r.dur, size: blob.size });
  if (ok && newNote) { mediaCommitNote(newNote); mediaAfterNote(); }
  refreshMediaSlots();
  if (!ok) return;
  buzz(8);
  // Saved either way — but say so if the meter never moved, rather than let them find out later.
  if (r.an && r.peak < 0.02) toast('Saved, but it sounds silent — check the microphone is not blocked or covered', true);
  else toast('Voice note saved · ' + fmtClipLen(r.dur));
}
/* Leaving the screen or the app ends a recording by SAVING it — nobody expects a voice note
   to vanish because a notification pulled them away. */
function voiceSaveIfRecording() { if (_rec) voiceStop(false); }

let _play = null;   // { id, a }
function voiceToggle(id) {
  if (_play && _play.id === id) { if (_play.a.paused) _play.a.play().catch(() => {}); else _play.a.pause(); return; }
  voiceHalt();
  const rec = _media.get(id); if (!rec) return;
  const a = new Audio(mediaUrl(rec, 'f'));
  _play = { id, a };
  a.ontimeupdate = voicePaint; a.onplay = voicePaint; a.onpause = voicePaint;
  a.onended = () => voiceHalt();
  a.onerror = () => { toast('This voice note cannot be played on this phone', true); voiceHalt(); };
  a.play().catch(() => {});
  voicePaint();
}
function voiceHalt() {
  if (_play) { try { _play.a.pause(); } catch (e) {} _play = null; }
  voicePaint();
}
function voicePaint() {
  document.querySelectorAll('[data-vrow]').forEach(row => {
    const id = row.dataset.vrow, rec = _media.get(id);
    const on = !!(_play && _play.id === id), playing = on && !_play.a.paused;
    const b = row.querySelector('[data-vplay]');
    if (b) { b.innerHTML = playing ? icon('pause', 18) : icon('playFill', 18); b.setAttribute('aria-label', playing ? 'Pause' : 'Play voice note'); }
    const dur = (rec && rec.dur) || 0;
    const t = on ? _play.a.currentTime * 1000 : 0;
    const bar = row.querySelector('.vbar > span'); if (bar) bar.style.width = (on && dur ? Math.min(100, t / dur * 100) : 0) + '%';
    const tm = row.querySelector('.vtime'); if (tm) tm.textContent = on && t ? fmtClipLen(t) + ' / ' + fmtClipLen(dur) : fmtClipLen(dur);
    row.classList.toggle('on', on);
  });
}

/* ---------- rendering ----------
   A "slot" is re-rendered on its own (refreshMediaSlots) so adding a photo never rebuilds the
   Log screen around a half-typed journal. */
function mediaSlot(ctx, day, opts) {
  opts = opts || {};
  return `<div class="media-slot${opts.compact ? ' compact' : ''}" data-mctx="${escapeHtml(ctx)}" data-mday="${escapeHtml(day)}"${opts.compact ? ' data-mcompact="1"' : ''}>${mediaSlotHTML(ctx, day, opts)}</div>`;
}
function mediaSlotHTML(ctx, day, opts) {
  opts = opts || {};
  if (!mediaSupported()) return opts.compact ? '' : '<div class="hint">This browser cannot store photos or voice notes.</div>';
  if (!_mediaReady) return opts.compact ? '' : '<div class="hint">Loading…</div>';
  const items = mediaList(ctx, ctx === 'log' ? day : null);
  const photos = items.filter(r => r.kind === 'photo'), voices = items.filter(r => r.kind === 'voice');
  const grid = photos.length ? `<div class="mgrid">${photos.map(r => `<button class="mthumb" data-mview="${r.id}" aria-label="Photo from ${escapeHtml(mediaWhen(r.ts))}${r.caption ? ': ' + escapeHtml(r.caption) : ''}">
      <img src="${mediaUrl(r, 't')}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>` : '';
  const vlist = voices.map(r => `<div class="vrow" data-vrow="${r.id}">
      <button class="vplay" data-vplay="${r.id}" aria-label="Play voice note">${icon('playFill', 18)}</button>
      <div class="vmid"><div class="vbar"><span></span></div>
        <div class="vmeta"><span class="vtime">${fmtClipLen(r.dur)}</span><span>${escapeHtml(mediaWhen(r.ts))}</span></div></div>
      <button class="vdel" data-mdel="${r.id}" aria-label="Delete voice note">${icon('trash', 17)}</button>
    </div>`).join('');
  const recHere = _rec && _rec.ctx === ctx && _rec.day === day;
  const recBar = recHere ? `<div class="vrec" role="status">
      <span class="vrec-dot" aria-hidden="true"></span><span class="vrec-t" id="vrec-t">${fmtClipLen(Date.now() - _rec.t0)}</span>
      <span class="vrec-lvl" aria-hidden="true"><span id="vrec-lvl"></span></span>
      <div class="vrec-btns">
        <button class="btn btn-ghost" data-vrec-cancel>Discard</button>
        <button class="btn btn-primary" data-vrec-stop>${icon('check', 18)} Save</button>
      </div></div>` : '';
  if (opts.compact) return grid + (vlist ? `<div class="vlist">${vlist}</div>` : '') + recBar;
  const empty = !items.length && !recHere
    ? `<div class="media-empty">A photo of something from today, or a voice note while it is fresh. They stay on this phone and are saved in your backup file.</div>` : '';
  const acts = recHere ? '' : `<div class="media-acts">
      <button class="m-act" data-madd="camera" data-mctx="${escapeHtml(ctx)}" data-mday="${escapeHtml(day)}">${icon('camera', 20)}<span>Camera</span></button>
      <button class="m-act" data-madd="gallery" data-mctx="${escapeHtml(ctx)}" data-mday="${escapeHtml(day)}">${icon('image', 20)}<span>Photos</span></button>
      <button class="m-act" data-mrec data-mctx="${escapeHtml(ctx)}" data-mday="${escapeHtml(day)}"${_rec ? ' disabled' : ''}>${icon('mic', 20)}<span>Record</span></button>
    </div>`;
  return empty + grid + (vlist ? `<div class="vlist">${vlist}</div>` : '') + recBar + acts;
}
function refreshMediaSlots() {
  document.querySelectorAll('.media-slot').forEach(s => {
    s.innerHTML = mediaSlotHTML(s.dataset.mctx, s.dataset.mday, { compact: !!s.dataset.mcompact });
  });
  voicePaint();
  const lc = document.getElementById('media-log-count');
  if (lc) { const c = mediaDayCount(lc.dataset.day); lc.textContent = mediaCountText(c); }
}
function mediaCountText(c) {
  const bits = [];
  if (c.p) bits.push(c.p + ' photo' + (c.p === 1 ? '' : 's'));
  if (c.v) bits.push(c.v + ' voice note' + (c.v === 1 ? '' : 's'));
  return bits.join(' · ') || 'stays on this phone';
}
function mediaLogCardHTML(day) {
  return `<div class="card media-card">
    <h2 class="h2-icon">${hicon('camera')}<span>Photos &amp; voice</span> <span class="hint" id="media-log-count" data-day="${day}">${_mediaReady ? mediaCountText(mediaDayCount(day)) : ''}</span></h2>
    ${mediaSlot('log', day)}
  </div>`;
}

/* ---------- full-screen photo viewer ---------- */
let _mview = null;   // { ids, i }
function mediaViewOpen(id, set) {
  const rec = _media.get(id); if (!rec) return;
  const ids = (set && set.length && set.includes(id)) ? set.slice()
    : mediaList(rec.ctx, rec.ctx === 'log' ? rec.day : null).filter(r => r.kind === 'photo').map(r => r.id);
  _mview = { ids, i: Math.max(0, ids.indexOf(id)) };
  let el = document.getElementById('media-view');
  if (!el) { el = document.createElement('div'); el.id = 'media-view'; el.className = 'mview'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); document.body.appendChild(el); mediaSwipe(el); }
  mediaViewPaint();
  el.classList.add('on');
}
function mediaViewPaint() {
  const el = document.getElementById('media-view'); if (!el || !_mview) return;
  const id = _mview.ids[_mview.i], rec = _media.get(id);
  if (!rec) { mediaViewClose(); return; }
  const n = _mview.ids.length;
  const canShare = !!nativeSharePlugin() || !!navigator.canShare || !window.Capacitor;
  el.setAttribute('aria-label', 'Photo ' + (_mview.i + 1) + ' of ' + n);
  el.innerHTML = `
    <div class="mview-top">
      <div class="mview-when"><b>${escapeHtml(prettyDate(rec.day))}</b><span>${escapeHtml(mediaWhen(rec.ts))}${n > 1 ? ' · ' + (_mview.i + 1) + ' of ' + n : ''}</span></div>
      <button class="mview-x" data-mview-close aria-label="Close">${icon('x', 22)}</button>
    </div>
    <div class="mview-stage"><img class="mview-img" src="${mediaUrl(rec, 'f')}" alt="${escapeHtml(rec.caption || 'Photo')}"></div>
    ${n > 1 ? `<button class="mview-nav prev" data-mview-step="-1" aria-label="Previous photo"${_mview.i === 0 ? ' disabled' : ''}>${icon('chevL', 26)}</button>
      <button class="mview-nav next" data-mview-step="1" aria-label="Next photo"${_mview.i === n - 1 ? ' disabled' : ''}>${icon('chevR', 26)}</button>` : ''}
    <div class="mview-bar">
      <input class="mview-cap" type="text" maxlength="200" data-mcap="${rec.id}" placeholder="Add a caption…" value="${escapeHtml(rec.caption || '')}" aria-label="Caption">
      <div class="mview-acts">
        ${rec.ctx === 'log' && !(logDate === rec.day && document.getElementById('s-today').classList.contains('on'))
          ? `<button class="mview-btn" data-mview-day="${rec.day}">${icon('calendar', 18)}<span>Open day</span></button>` : ''}
        ${canShare ? `<button class="mview-btn" data-mshare="${rec.id}">${icon('share', 18)}<span>Share</span></button>` : ''}
        <button class="mview-btn danger" data-mdel="${rec.id}">${icon('trash', 18)}<span>Delete</span></button>
      </div>
    </div>`;
}
function mediaViewStep(d) {
  if (!_mview) return;
  const j = _mview.i + d; if (j < 0 || j >= _mview.ids.length) return;
  _mview.i = j; mediaViewPaint();
}
function mediaViewClose() {
  const el = document.getElementById('media-view'); if (el) { el.classList.remove('on'); el.innerHTML = ''; }
  _mview = null;
}
function mediaViewIsOpen() { const el = document.getElementById('media-view'); return !!(el && el.classList.contains('on')); }
function mediaSwipe(el) {
  let x0 = null, y0 = 0;
  el.addEventListener('touchstart', e => { if (e.touches.length !== 1 || e.target.closest('.mview-bar')) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) mediaViewStep(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) mediaViewClose();   // swipe down to close
  }, { passive: true });
}
let _capTimer = null;
function mediaSaveCaption(id, text) {
  const rec = _media.get(id); if (!rec) return;
  rec.caption = String(text || '').slice(0, 200);
  clearTimeout(_capTimer);
  _capTimer = setTimeout(() => { mediaWrite(s => s.put(rec)).catch(e => toast(mediaQuotaMsg(e) + ' — caption not saved', true)); }, 400);
}
function b64ToBlob(b64, mime) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime || 'application/octet-stream' });
}
async function mediaShare(id) {
  const rec = _media.get(id); if (!rec) return;
  const name = 'daylog-' + rec.day + '-' + rec.id + '.jpg';
  const nat = nativeSharePlugin();
  if (nat) {
    try { await nat.shareImage({ base64: await blobToB64(rec.blob), filename: name }); }
    catch (e) { toast('Could not open the share sheet', true); }
    return;
  }
  try {
    const f = new File([rec.blob], name, { type: rec.mime });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  if (!window.Capacitor) {
    const a = document.createElement('a'); a.href = mediaUrl(rec, 'f'); a.download = name; a.click();
    toast('Saved to your downloads'); return;
  }
  toast('Sharing photos needs the latest Daylog from the Play Store', true);
}
async function mediaConfirmDelete(id) {
  const rec = _media.get(id); if (!rec) return;
  if (!confirm(rec.kind === 'photo' ? 'Delete this photo? This cannot be undone.' : 'Delete this voice note? This cannot be undone.')) return;
  if (!(await mediaDelete(id))) return;
  if (_mview) {
    _mview.ids = _mview.ids.filter(x => x !== id);
    if (!_mview.ids.length) mediaViewClose();
    else { _mview.i = Math.min(_mview.i, _mview.ids.length - 1); mediaViewPaint(); }
  }
  refreshMediaSlots();
  toast(rec.kind === 'photo' ? 'Photo deleted' : 'Voice note deleted');
}
document.addEventListener('click', (ev) => {
  const t = ev.target.closest && ev.target.closest('[data-madd],[data-mrec],[data-vrec-stop],[data-vrec-cancel],[data-vplay],[data-mview],[data-mdel],[data-mshare],[data-mview-close],[data-mview-step],[data-mview-day]');
  if (!t) {
    // a tap on the dark backdrop around the photo closes the viewer
    if (ev.target.id === 'media-view' || (ev.target.classList && ev.target.classList.contains('mview-stage'))) mediaViewClose();
    return;
  }
  const d = t.dataset;
  if (d.madd !== undefined) { mediaPick(d.madd, d.mctx, d.mday); return; }
  if (d.mrec !== undefined) { voiceStart(d.mctx, d.mday); return; }
  if (d.vrecStop !== undefined) { voiceStop(false); return; }
  if (d.vrecCancel !== undefined) { voiceStop(true); return; }
  if (d.vplay) { voiceToggle(d.vplay); return; }
  if (d.mview) {
    const set = t.closest('[data-mset]');
    mediaViewOpen(d.mview, set ? [...set.querySelectorAll('[data-mview]')].map(x => x.dataset.mview) : null);
    return;
  }
  if (d.mviewDay) { logDate = d.mviewDay; show('today'); return; }   // show() closes the viewer
  if (d.mdel) { mediaConfirmDelete(d.mdel); return; }
  if (d.mshare) { mediaShare(d.mshare); return; }
  if (d.mviewClose !== undefined) { mediaViewClose(); return; }
  if (d.mviewStep) { mediaViewStep(+d.mviewStep); return; }
});
document.addEventListener('input', (ev) => {
  const c = ev.target.closest && ev.target.closest('[data-mcap]');
  if (c) mediaSaveCaption(c.dataset.mcap, c.value);
});
document.addEventListener('keydown', (ev) => {
  if (!mediaViewIsOpen() || (ev.target.closest && ev.target.closest('.mview-cap'))) return;
  if (ev.key === 'Escape') mediaViewClose();
  else if (ev.key === 'ArrowLeft') mediaViewStep(-1);
  else if (ev.key === 'ArrowRight') mediaViewStep(1);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && _rec) { voiceSaveIfRecording(); }
  if (document.visibilityState === 'hidden') voiceHalt();
});

/* ---------- backup ----------
   Media rides in the backup file as `_media`, base64. It is not in BACKUP_KEYS: those are
   localStorage sections and this is not one. validateBackup ignores it, so an old app reading
   a new backup restores everything else and simply skips the pictures. */
async function mediaForBackup() {
  if (!mediaSupported()) return { items: [], skipped: 0, bytes: 0 };
  let all;
  try { all = await mediaReadAll(); } catch (e) { return { items: [], skipped: -1, bytes: 0 }; }
  const items = []; let skipped = 0, bytes = 0;
  for (const r of all) {
    try {
      const it = { id: r.id, kind: r.kind, mime: r.mime, day: r.day, ctx: r.ctx, ts: r.ts, data: await blobToB64(r.blob) };
      if (r.thumb) it.thumb = await blobToB64(r.thumb);
      ['w', 'h', 'dur', 'caption'].forEach(k => { if (r[k] != null && r[k] !== '') it[k] = r[k]; });
      items.push(it); bytes += r.size || 0;
    } catch (e) { skipped++; }
  }
  return { items, skipped, bytes };
}
/* Shape-check one backed-up item. Pure, so tests can feed it junk. */
function mediaItemValid(it) {
  return !!it && typeof it === 'object'
    && typeof it.id === 'string' && /^[\w-]{1,40}$/.test(it.id)
    && (it.kind === 'photo' || it.kind === 'voice')
    && typeof it.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.day)
    && typeof it.ctx === 'string' && /^(log|note:[\w-]{1,40})$/.test(it.ctx)
    && typeof it.data === 'string' && it.data.length > 0
    && (it.mime == null || (typeof it.mime === 'string' && /^(image|audio)\/[\w.+-]+(;[\w=.,+ -]*)?$/.test(it.mime)));
}
/* Adds what is missing and never overwrites: a photo already on this phone is the same photo. */
async function mediaRestore(list) {
  const res = { added: 0, had: 0, bad: 0, failed: 0 };
  if (!mediaSupported() || !Array.isArray(list)) return res;
  if (!_mediaReady) await mediaLoad();
  for (const it of list) {
    if (!mediaItemValid(it)) { res.bad++; continue; }
    if (_media.has(it.id)) { res.had++; continue; }
    let rec;
    try {
      const mime = it.mime || (it.kind === 'photo' ? 'image/jpeg' : 'audio/webm');
      const blob = b64ToBlob(it.data, mime);
      rec = { id: it.id, kind: it.kind, mime, blob, day: it.day, ctx: it.ctx, ts: +it.ts || Date.now(), size: blob.size };
      if (typeof it.thumb === 'string' && it.thumb) { rec.thumb = b64ToBlob(it.thumb, 'image/jpeg'); rec.size += rec.thumb.size; }
      if (+it.w) rec.w = +it.w; if (+it.h) rec.h = +it.h; if (+it.dur) rec.dur = +it.dur;
      if (typeof it.caption === 'string') rec.caption = it.caption.slice(0, 200);
    } catch (e) { res.bad++; continue; }
    try { await mediaWrite(s => s.put(rec)); _media.set(rec.id, rec); res.added++; }
    catch (e) { res.failed++; break; }        // out of space: further writes fail the same way
  }
  refreshMediaSlots();
  return res;
}
/* Delete everything: close our handle first, or deleteDatabase waits on it forever. */
function mediaWipe() {
  voiceHalt(); if (_rec) voiceStop(true);
  _mediaUrls.forEach(u => URL.revokeObjectURL(u)); _mediaUrls.clear(); _media.clear();
  if (!mediaSupported()) return Promise.resolve();
  const closing = _mediaDbP ? _mediaDbP.then(db => db.close()).catch(() => {}) : Promise.resolve();
  _mediaDbP = null;
  return closing.then(() => new Promise(res => {
    try { const rq = indexedDB.deleteDatabase(MEDIA_DB); rq.onsuccess = rq.onerror = rq.onblocked = () => res(); }
    catch (e) { res(); }
  }));
}

/* Everything the app stores, for a COMPLETE backup/restore. */
const BACKUP_KEYS = ['entries', 'tasks', 'notes', 'plans', 'projects', 'pjnames', 'gapskip', 'cardratio',
  'finaccts', 'fintx', 'finmarks', 'finbudget', 'fincats', 'finset', 'gym', 'exercises', 'reminders', 'timelog', 'timeacts', 'events', 'docs', 'habitcfg', 'actcfg', 'deepcfg', 'gymcfg', 'corecfg', 'daycfg', 'gymgroups', 'navcfg', 'pomo', 'timebox', 'pomohist', 'health', 'goals', 'logsec', 'awards', 'freshSeen',
  /* Added v230. These are the user's own CHOICES and earned state, and leaving them out meant
     a wipe-then-restore silently reset them while the app said "Backup restored" — the export
     is offered inside the wipe flow precisely so nothing is lost. Internal flags stay out on
     purpose (errlog, onboarded, toured, whatsnew, lastBackup, quotaWarn, sampleMeta, touched,
     pausedAct, rateAsk, backupNudge, awardsInit, and the one-shot *Migrated markers): those
     are about THIS install, not about the user, and restoring them would be wrong. */
  'milestones', 'alarmSound', 'alarmHealth', 'waves',
  'hapticsOff', 'ringOff', 'throwbackOff', 'moodMeterOff', 'nudgeOff',
  'usageDisclosure', 'exactAsked',
  /* Added v231, and the v231 note about it was WRONG. dp.settings — name, reminder time, sync
     URL — was never actually being lost: backupBlob() special-cased it as `{ settings:
     DB.settings() }` and importData had a matching `d.settings` branch, both there since the
     first commit. It round-tripped fine; it was just invisible to a check that reads this list.
     v232 removed both special cases so this list is the single mechanism, which is what makes
     tools/check-backup-keys.mjs mean what it says. */
  'settings'];

/* Keys the app writes that are DELIBERATELY not backed up, because they describe this install
   rather than the person using it: restoring them onto a fresh device would be wrong.
   This used to be prose in the comment above, which meant nothing could check it. It is a list
   now, so tools/check-backup-keys.mjs can hold the pair to account — every key the app writes
   must appear in exactly one of BACKUP_KEYS or this one. A key in neither fails the release,
   which is what would have caught the eleven missing in v230, and 'settings' here. */
const BACKUP_EXCLUDED = [
  // how many times the support ask has been shown here — not data, and a donation buys
  // nothing, so there is deliberately nothing about a donor worth restoring
  'tip',
  'playNudge',                         // "get the Play app" card state — about this browser, not the user
  'celeb',   // which day's one-per-day celebration budget is spent — meaningless on another install
  'errlog',                            // crash log for the feedback mail, not user data
  'onboarded', 'toured', 'whatsnew',   // one-shot "seen it" flags for THIS install
  'lastBackup',                        // when this device last exported; restoring it misreports
  'quotaWarn',                         // storage-pressure warning state
  'sampleMeta',                        // marks which rows are seeded demo data on this install
  'touched', 'pausedAct',
  'rateAsk', 'backupNudge', 'awardsInit',
  'ntfy.sent',                         // notification de-dup; replaying it would suppress alerts
  'logsecMigrated', 'moodInputMigrated',   // one-shot migration markers
];
/* Sections of the backup FILE that are not localStorage keys, so the BACKUP_KEYS loop cannot
   carry them; each has its own export and restore code. `_media` is the photos and voice notes
   held in IndexedDB (mediaForBackup / mediaRestore). tools/check-backup-keys.mjs checks every
   one is written by exportData AND read by importData, so one side cannot quietly go missing. */
const BACKUP_EXTRA = ['_media'];
/* Deleting everything is irreversible, so it is deliberately hard to do by accident.
   Four stages, in memory only — a reload, a crash or leaving Settings resets it to 0:
     0  the plain button
     1  explains what goes, and offers to export first
     2  a 5-second countdown that cannot be skipped (defeats rapid tapping entirely)
     3  type DELETE, exactly
     4  the final red confirm
   Two taps used to be enough. */
let _wipeStage = 0, _wipeTimer = null, _wipeCountdown = 0, _wipeTick = null, _wipeTyped = '';
const WIPE_WORD = 'DELETE';
function wipeReset() {
  _wipeStage = 0; _wipeTyped = ''; _wipeCountdown = 0;
  clearTimeout(_wipeTimer); clearInterval(_wipeTick); _wipeTimer = _wipeTick = null;
}
/* Anything that leaves Settings abandons a half-finished wipe. */
function wipeAbandonIfAway() { if (_wipeStage && !document.getElementById('wipe-stage')) wipeReset(); }

function wipeStageHTML() {
  const back = `<button class="btn btn-ghost btn-sm" id="wipe-cancel">Cancel</button>`;
  if (_wipeStage === 0) {
    return `<div id="wipe-stage" class="btn-row">
      <button class="btn btn-ghost btn-sm" id="wipe-go" style="color:var(--bad-ink)">Delete all my data…</button></div>`;
  }
  if (_wipeStage === 1) {
    const e = Object.keys(DB.entries()).length;
    const lb = +localStorage.getItem('dp.lastBackup') || 0;
    const days = lb ? Math.floor((Date.now() - lb) / 86400000) : null;
    return `<div id="wipe-stage" class="wipe-box">
      <div class="wipe-warn">You are about to permanently delete <b>${e} logged day${e === 1 ? '' : 's'}</b>
        and everything else Daylog holds on this phone.</div>
      <div class="hint" style="margin:8px 0">${lb
        ? `Your last backup was <b>${days === 0 ? 'today' : days + ' day' + (days === 1 ? '' : 's') + ' ago'}</b>.`
        : `<b>You have never exported a backup.</b>`} Anything logged since then is gone for good.</div>
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" id="wipe-export">⬇ Export a backup first</button>
        ${back}
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn btn-ghost btn-sm" id="wipe-next1" style="color:var(--bad-ink)">I have a backup — continue</button>
      </div></div>`;
  }
  if (_wipeStage === 2) {
    return `<div id="wipe-stage" class="wipe-box">
      <div class="wipe-warn">Step 2 of 4 — take five seconds.</div>
      <div class="hint" style="margin:8px 0">This pause is here on purpose. If you are deleting
        because something looks wrong, an export and a reinstall will fix it without losing
        anything.</div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" id="wipe-next2" ${_wipeCountdown > 0 ? 'disabled' : ''}
          style="color:var(--bad-ink)">${_wipeCountdown > 0 ? `Wait ${_wipeCountdown}…` : 'Continue'}</button>
        ${back}
      </div></div>`;
  }
  if (_wipeStage === 3) {
    const okd = _wipeTyped.trim().toUpperCase() === WIPE_WORD;
    return `<div id="wipe-stage" class="wipe-box">
      <div class="wipe-warn">Step 3 of 4 — type <b>${WIPE_WORD}</b> to confirm.</div>
      <div class="field" style="margin-top:8px">
        <input type="text" id="wipe-word" autocomplete="off" autocapitalize="characters"
          placeholder="${WIPE_WORD}" value="${escapeHtml(_wipeTyped)}"></div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" id="wipe-next3" ${okd ? '' : 'disabled'}
          style="color:var(--bad-ink)">Continue</button>
        ${back}
      </div></div>`;
  }
  return `<div id="wipe-stage" class="wipe-box wipe-final">
    <div class="wipe-warn">Step 4 of 4 — last chance.</div>
    <div class="hint" style="margin:8px 0">Tapping the red button erases everything immediately.
      There is no undo and no confirmation after this.</div>
    <div class="btn-row">
      <button class="btn btn-sm" id="wipe-confirm"
        style="background:var(--bad-ink);color:#fff;border-color:transparent">🧨 Erase everything now</button>
      ${back}
    </div></div>`;
}

function wipeEverything() {
  // Only dp.* keys: anything else in localStorage belongs to the page, not to Daylog.
  const doomed = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf('dp.') === 0) doomed.push(k);
  }
  doomed.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  return doomed.length;
}

async function exportData() {
  const { data: out, skipped } = backupBlob();
  const media = await mediaForBackup();
  if (media.items.length) out._media = media.items;
  // Await it, and only stamp the date if the file actually reached the user. Stamping
  // unconditionally meant Settings said "last backup: today ✅" after a cancelled share
  // sheet — the single most dangerous lie this app could tell.
  const r = await saveFile('daily-pulse-backup-' + todayStr() + '.json', JSON.stringify(out, null, 2), 'application/json');
  if (saveOk(r)) localStorage.setItem('dp.lastBackup', String(Date.now()));
  // Say so if the file is incomplete. A partial backup presented as a whole one is the failure
  // this app keeps having to unlearn — and here it would not be noticed until a restore.
  if (saveOk(r) && skipped.length) {
    toast(`Backed up, but ${skipped.length} section(s) were unreadable and left out: ${skipped.join(', ')}`, true);
  } else if (saveOk(r) && media.skipped) {
    toast(media.skipped < 0 ? 'Backed up, but your photos and voice notes could not be read and are NOT in this file'
      : `Backed up, but ${media.skipped} photo(s)/voice note(s) could not be read and were left out`, true);
  }
  return r;
}
function backupBlob() {
  // Everything goes through BACKUP_KEYS. `settings` used to be special-cased here and matched
  // by a `d.settings` branch in importData, which meant it round-tripped correctly while being
  // invisible to any check that reads the list — see tools/check-backup-keys.mjs.
  // A raw JSON.parse here meant ONE unreadable key threw and the whole export failed — for the
  // user most likely to need it, since corruption and a full disk travel together. Skip what
  // cannot be read, and RETURN the list rather than swallowing it: a backup quietly missing a
  // section is the same lie as a save that reports success it did not earn.
  const out = {};
  const skipped = [];
  BACKUP_KEYS.forEach(k => {
    const raw = localStorage.getItem('dp.' + k);
    if (!raw) return;
    try { out[k] = JSON.parse(raw); }
    catch (e) { skipped.push(k); }
  });
  return { data: out, skipped };
}
/* Is this actually a Daylog backup?
 *
 * importData used to accept anything that was valid JSON. JSON.parse succeeding says nothing
 * about the file being ours — a package.json, another app's export, a half-written file that
 * happens to close its braces all parse fine. Three things followed, on a restore path, which
 * is the one place the user has no second copy:
 *
 *   picking the wrong .json OVERWROTE every colliding key and there was no undo
 *   a file with none of our keys wrote nothing and still said "Backup restored"
 *   a file with the right key holding the wrong type wrote it anyway
 *
 * The second is the worst: the user reads "Backup restored", believes their data is back, and
 * finds out otherwise later. This app has had to unlearn report-success-on-failure in the SAVE
 * paths twice (v223, v224) and once already in this very function for quota failures. Same bug,
 * still here, on the path that matters most.
 *
 * Pure so tools/check-import.mjs can run it directly against known-bad payloads rather than
 * grepping for its existence. */
function validateBackup(d) {
  if (d === null || typeof d !== 'object' || Array.isArray(d)) {
    return { ok: false, reason: 'That file is not a Daylog backup — it does not contain a backup object.', keys: [] };
  }
  const keys = BACKUP_KEYS.filter(k => d[k] !== undefined);
  if (!keys.length) {
    return { ok: false, reason: 'That file is valid JSON but contains no Daylog data. Nothing was changed.', keys: [] };
  }
  // Reject a section whose value is a primitive: every backed-up section is an object, an array
  // or a boolean/string flag, and a number or a stray string where a collection belongs breaks
  // rendering rather than restoring anything.
  const bad = keys.filter(k => {
    const v = d[k];
    return typeof v === 'number' || (typeof v === 'string' && v.length > 512);
  });
  // `keys.length > 0` matters: without it, zero recognised keys makes this 0 === 0 and the file
  // is rejected here with the wrong explanation. Two branches were covering the empty case with
  // different messages, and the check above happened to run first. Mutation-testing found it by
  // disabling that check and watching this one reject by accident.
  if (keys.length > 0 && bad.length === keys.length) {
    return { ok: false, reason: 'That file has Daylog section names but the wrong contents. Nothing was changed.', keys: [] };
  }
  return { ok: true, reason: '', keys: keys.filter(k => !bad.includes(k)) };
}
/* `after(restoredAnything)` lets a caller react to the OUTCOME — onboarding uses it to skip
   itself only when a restore really happened. It fires false on a bad file, a refused
   confirm, or an all-keys-failed write, so a caller can never mistake a no-op for success. */
function importData(file, after) {
  const done = ok => { try { after && after(!!ok); } catch (e) {} };
  const r = new FileReader();
  r.onload = () => {
    try { const d = JSON.parse(r.result);
      const check = validateBackup(d);
      if (!check.ok) { toast(check.reason, true); done(false); return; }
      // Restoring REPLACES what is on this device. Ask first — this is destructive, it is not
      // undoable, and the file picker cannot tell a backup from any other .json.
      const nMedia = Array.isArray(d._media) ? d._media.length : 0;
      if (!confirm(`Restore ${check.keys.length} section(s)${nMedia ? ` and ${nMedia} photo(s)/voice note(s)` : ''} from this backup?\n\nThis replaces the matching data on this device and cannot be undone.${nMedia ? ' Photos and voice notes already on this phone are kept.' : ''}`)) { done(false); return; }
      // safeSet, not setItem: on a full phone a raw write throws per key and the restore
      // would still have said "Backup restored" over a half-loaded backup — the same
      // report-success-on-failure bug fixed for the SAVE paths in v223/v224, but on the
      // RESTORE path, where it matters more.
      let failed = 0, wrote = 0;
      check.keys.forEach(k => { if (safeSet('dp.' + k, JSON.stringify(d[k])) === false) failed++; else wrote++; });
      reloadCfg();
      refreshStreak(); setupReminders(); pushState(true); show('dash');
      if (!wrote) toast(`Nothing was restored — all ${failed} section(s) failed to write. Free up storage and try again.`, true);
      else if (failed) toast(`Restored ${wrote} section(s); ${failed} could not be written — free up storage and import again`, true);
      else if (!nMedia) toast('Backup restored');
      done(wrote > 0);
      // Pictures go after the sections, and report separately: they are big, slow on a cheap
      // phone, and the one part most likely to hit a full disk.
      if (nMedia && wrote) {
        toast(`Restoring ${nMedia} photo(s) and voice note(s)…`);
        mediaRestore(d._media).then(m => {
          if (m.failed) toast(`Restored your data and ${m.added} photo(s)/voice note(s); the rest did not fit — free up space and import again`, true);
          else if (m.bad) toast(`Backup restored · ${m.added} photo(s)/voice note(s) added, ${m.bad} damaged one(s) skipped`, true);
          else toast(`Backup restored · ${m.added} photo(s)/voice note(s) added` + (m.had ? `, ${m.had} were already here` : ''));
        });
      }
    } catch (e) { toast('Bad backup file', true); done(false); }
  };
  r.onerror = () => done(false);
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
    safeSet(flag, '1');
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
    safeSet(flag, '1');
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
    safeSet('dp.usageDisclosure', '1');
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
function saveHealthStore(h) { const ok = safeSet('dp.health', JSON.stringify(h)); return ok; }
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
    // Health Connect is a SEPARATE grant from Usage access, with its own system sheet.
    // Only ask on an explicit sync, and only if a sensor metric is actually switched on.
    const wantsSensors = at.steps || at.sleep || at.calories || at.workouts || at.hr;
    if (!opts.silent && wantsSensors && hc.healthPermissionState && hc.requestHealthPermissions) {
      try {
        const st = await hc.healthPermissionState();
        if (st && st.supported !== false && (st.granted || 0) === 0) {
          const r = await hc.requestHealthPermissions();
          if (r && (r.granted || 0) === 0) {
            toast('Allow Daylog to read the metrics you want in Health Connect, then Sync again', true);
            return null;
          }
        }
      } catch (e) { /* HC unavailable — screen time still works */ }
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
/* Under an hour, drop the "0h": "29m" reads better than "0h29m" and, at 320px, "0h29m"
   overflowed its stat column and got clipped. */
const fmtMin = m => m == null ? null
  : (m < 60 ? (Math.round(m) + 'm')
            : (Math.floor(m / 60) + 'h' + String(Math.round(m) % 60).padStart(2, '0') + 'm'));
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
  safeSet('dp.pomohist', JSON.stringify(ph));
  localStorage.setItem('dp.sampleMeta', JSON.stringify(meta));
}
function clearSampleData() {
  const meta = safeParse(localStorage.getItem('dp.sampleMeta'), null); if (!meta) return;
  const hs = healthStore(); (meta.dates || []).forEach(d => { if (hs[d] && hs[d].sample) delete hs[d]; }); saveHealthStore(hs);
  const es = DB.entries(); (meta.entries || []).forEach(d => { if (es[d] && es[d].sample) delete es[d]; });
  safeSet('dp.entries', JSON.stringify(es));
  const ph = safeParse(localStorage.getItem('dp.pomohist'), {}); (meta.pomo || []).forEach(d => { delete ph[d]; });
  safeSet('dp.pomohist', JSON.stringify(ph));
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
      else notifs.push({ id: seq++, smallIcon: NOTIF_ICON, title, body, schedule: { at: t, allowWhileIdle: true },
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
  if (patch) { safeSet('dp.alarmHealth', JSON.stringify(Object.assign(cur, patch))); return Object.assign(cur, patch); }
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
/* Re-check whenever the app returns to the foreground, and redraw Settings if the answer
   changed. The "Fix" button sends you to a SYSTEM settings page — so the only moment the
   app can learn that you granted the permission is when it gets focus back. Nothing did
   that, so the warning sat there saying "needs a fix" over a permission already granted,
   and re-opening Settings did not help either: the card renders from the cached value.
   Guarded against re-entrancy because visibilitychange can fire twice on some OEM shells. */
let _ahBusy = false;
async function recheckAlarmHealth() {
  if (_ahBusy || !nativeShell()) return;
  _ahBusy = true;
  try {
    const before = JSON.stringify(alarmHealthKeys());
    await refreshAlarmHealth();
    if (JSON.stringify(alarmHealthKeys()) !== before &&
        document.getElementById('s-settings') &&
        document.getElementById('s-settings').classList.contains('on')) {
      renderSettings();
    }
  } finally { _ahBusy = false; }
}
/* Only the fields the card actually branches on — `checked` is a timestamp and would make
   every refresh look like a change. */
function alarmHealthKeys() {
  const h = alarmHealth();
  return { n: h.notifOk, e: h.exactAllowed, f: h.fullScreenAllowed };
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) recheckAlarmHealth(); });

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
  safeSet('dp.exactAsked', '1');
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
    safeSet('dp.alarmSound', JSON.stringify(r));
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
      safeSet('dp.alarmSound', JSON.stringify(r));
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
      safeSet('dp.alarmSound', JSON.stringify(r));
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
      safeSet('dp.alarmSound', JSON.stringify(r));
      vb.classList.toggle('on', next); vb.setAttribute('aria-checked', next ? 'true' : 'false');
      if (next) buzz(22);
      toast(next ? 'Vibration on' : 'Vibration off');
    } catch (e) {}
  }
});

/* ---------- Best Efforts (personal records) ----------
   From the Strava teardown: a top-3 LADDER per benchmark, not a single "record", so second
   and third best still register — and an "this year" column so somebody who peaked long ago
   can still win something today. Deliberately no comparison to anyone else: every number
   here is the user against their own past, which is the evidence-backed substitute for a
   leaderboard. Reads only data we already store; adds no tracking. */
function bestEfforts() {
  const e = DB.entries(), hs = healthStore();
  const yr = String(new Date().getFullYear());
  const rows = [];

  const add = (label, ico, unit, pairs, fmt) => {
    const all = pairs.filter(p => p[1] != null && !isNaN(+p[1])).map(p => [p[0], +p[1]]);
    if (all.length < 3) return;
    const top = all.slice().sort((a, b) => b[1] - a[1]).slice(0, 3);
    const thisYear = all.filter(p => p[0].startsWith(yr)).sort((a, b) => b[1] - a[1])[0] || null;
    rows.push({ label, ico, unit, top, thisYear, fmt: fmt || (v => Math.round(v).toLocaleString()) });
  };

  add('Most steps', 'trending', '', Object.keys(hs).map(d => [d, hs[d].steps]));
  add('Longest sleep', 'moon', '', Object.keys(hs).map(d => [d, hs[d].sleepMin]), v => fmtMin(Math.round(v)));
  add('Most active minutes', 'dumbbell', '', Object.keys(hs).map(d => [d, hs[d].exerciseMin]), v => fmtMin(Math.round(v)));
  add('Least screen time', 'phone', '', Object.keys(hs).filter(d => hs[d].screenMin != null)
      .map(d => [d, -hs[d].screenMin]), v => fmtMin(Math.round(-v)));
  add('Deepest focus day', 'target', 'h', Object.keys(e).map(d => [d, e[d].deepWorkHours]), v => v.toFixed(1) + 'h');
  add('Best mood', 'smile', '', Object.keys(e).map(d => [d, e[d].mood]), v => String(v) + '/10');
  add('Most habits done', 'check', '', Object.keys(e).map(d => [d,
      e[d].habits ? Object.keys(e[d].habits).filter(k => hVal(e[d], k) === H_DONE).length : null]));

  if (!rows.length) return '';
  const medal = i => ['🥇', '🥈', '🥉'][i] || '';
  return `<div class="card">
    <h2 class="h2-icon">${hicon('target')}<span>Your best ever</span>
      <span class="hint" style="margin-left:auto"><a href="#" data-share-card="streak">share</a></span></h2>
    ${rows.map(r => `<div class="be-row">
      <div class="be-head">${icon(r.ico, 15)} <span>${r.label}</span></div>
      <div class="be-list">${r.top.map((t, i) => `<span class="be-item${i === 0 ? ' gold' : ''}"
        data-be-open="${t[0]}" title="${prettyDate(t[0])}">${medal(i)} <b>${r.fmt(t[1])}</b>
        <em>${shortDate(t[0])}</em></span>`).join('')}</div>
      ${r.thisYear && r.thisYear[0] !== r.top[0][0]
        ? `<div class="be-year">Best this year: <b>${r.fmt(r.thisYear[1])}</b> · ${prettyDate(r.thisYear[0])}</div>` : ''}
    </div>`).join('')}
  </div>`;
}
document.addEventListener('click', (ev) => {
  const b = ev.target.closest && ev.target.closest('[data-be-open]');
  if (!b) return;
  const d = b.dataset.beOpen;
  if (!DB.entry(d)) { toast('Nothing logged on ' + prettyDate(d)); return; }
  logDate = d; loadDraft(); show('today'); buzz(12); toast('Opened ' + prettyDate(d));
});

/* ============================================================
   FRESH START — temporal landmarks.

   The fresh-start effect held up under adversarial checking in the research: people are
   measurably more willing to begin again at a temporal landmark — a Monday, the 1st of a
   month, a new year — than on an arbitrary Wednesday. The calendar data was already here;
   this just says the obvious thing out loud on the day it lands.

   Deliberate constraints, because a motivational banner is one bad decision away from being
   spam:
     - ONE landmark per day, highest-order first (year > month > week). Never a stack.
     - Only on TODAY's log. A landmark on a back-dated entry is meaningless.
     - Dismissed once, gone for that landmark forever (dp.freshSeen keeps the keys).
     - Every message carries a real number from the user's OWN previous period, so it is
       information rather than cheerleading.
     - NO LOSS FRAMING. The research rated loss aversion weak and off-brand, and named
       streak-insurance nudges as a thing to refuse — so nothing here says "don't lose" or
       "you're falling behind". It states what happened and what is now open.
   ============================================================ */
function freshSeen() { try { return safeParse(localStorage.getItem('dp.freshSeen'), {}) || {}; } catch (e) { return {}; } }

/* The landmark that applies to today, or null. */
function freshLandmark() {
  const t = todayStr();
  const dow = new Date(t + 'T00:00:00').getDay();
  const dom = +t.slice(8, 10), mon = +t.slice(5, 7);
  if (mon === 1 && dom === 1) return { k: 'y:' + t.slice(0, 4), kind: 'year',  label: t.slice(0, 4) };
  if (dom === 1)              return { k: 'm:' + t.slice(0, 7), kind: 'month', label: MR_MON[mon - 1] };
  if (dow === 1)              return { k: 'w:' + t,             kind: 'week',  label: 'this week' };
  return null;
}

function freshHTML() {
  if (logDate !== todayStr()) return '';
  const lm = freshLandmark();
  if (!lm || freshSeen()[lm.k]) return '';

  const c = goalCtx();
  const sum = (k, ds) => { const m = goalMetric(k); return m ? m.sum(c, ds) : 0; };
  let line = '', title = '';

  if (lm.kind === 'week') {
    const prev = [];
    const ws = addDays(weekStart(todayStr()), -7);
    for (let i = 0; i < 7; i++) prev.push(addDays(ws, i));
    const logged = sum('logged', prev), ticks = sum('habits', prev);
    title = 'New week';
    line = logged
      ? `Last week you logged <b>${logged} of 7</b> days and ticked <b>${ticks}</b> habits. Seven fresh days from here.`
      : `A clean seven days ahead. One logged day is enough to start a run.`;
  } else if (lm.kind === 'month') {
    const pm = ymPrev(ymOf(todayStr()));
    const r = monthReview(pm);
    title = MR_MON[+todayStr().slice(5, 7) - 1] + ' starts today';
    line = r.logged
      ? `${r.label}: <b>${r.logged} days</b> logged, <b>${r.ticks}</b> habits ticked${r.perfect ? `, <b>${r.perfect}</b> perfect` : ''}. A new month is open.`
      : `A whole month ahead of you, nothing written in it yet.`;
  } else {
    const y = +todayStr().slice(0, 4) - 1;
    const e = DB.entries();
    const lastYear = Object.keys(e).filter(d => d.startsWith(String(y))).length;
    title = todayStr().slice(0, 4) + ' starts today';
    line = lastYear
      ? `You logged <b>${lastYear} days</b> in ${y}. A blank year in pixels from here.`
      : `A blank year in pixels. One day at a time.`;
  }

  return `<div class="card fresh-card">
    <div class="fresh-body">
      <div class="fresh-ico">🌅</div>
      <div class="fresh-txt"><div class="fresh-t">${title}</div><div class="fresh-l">${line}</div></div>
      <button type="button" class="fresh-x" data-fresh-x="${lm.k}" aria-label="Dismiss">✕</button>
    </div>
  </div>`;
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest && ev.target.closest('[data-fresh-x]');
  if (!b) return;
  const seen = freshSeen();
  seen[b.dataset.freshX] = todayStr();
  // Keep only the last 24 keys — this is a dismissal log, not history.
  const keys = Object.keys(seen).sort();
  while (keys.length > 24) delete seen[keys.shift()];
  try { safeSet('dp.freshSeen', JSON.stringify(seen)); } catch (e) {}
  const card = b.closest('.fresh-card');
  if (card) card.remove();
  buzz(6);
});

/* ============================================================
   CUSTOM GOALS — free, because Strava charges for them.

   The research was blunt about this: Strava paywalls custom goals along with recaps and most
   of its analysis layer, and it called three progressive paywalls of the REWARD layer
   demotivating. "Your 'nothing paywalled' position is a genuine weapon; don't trade it." So
   this is the whole feature, given away: any of nine measures, over a week, a month or a
   year, as many as you like.

   Two evidence-backed details, both from items that survived adversarial verification:
     - The goal-gradient effect: effort accelerates as a target comes into view. That only
       works if the remaining gap is VISIBLE, so every goal states exactly what is left and
       how much per remaining day would get there.
     - Targets calibrated to nobody is a named demotivation mode, so nothing here suggests a
       number. The user sets it, and "Suggest" fills in what they actually averaged over the
       last three periods — their own history, not a magazine's.
   ============================================================ */
const GOAL_PERIODS = {
  w: { label: 'this week',  days: 7,  name: 'Weekly' },
  m: { label: 'this month', days: 30, name: 'Monthly' },
  y: { label: 'this year',  days: 365, name: 'Yearly' },
};

/* Each measure knows how to total ITSELF over a list of dates, so adding one later is a
   single entry rather than a new branch in three places. */
const GOAL_METRICS = [
  { k: 'logged',  label: 'Days logged',   emoji: '📘', unit: 'days',
    sum: (c, ds) => ds.filter(d => c.e[d]).length },
  { k: 'habits',  label: 'Habits ticked', emoji: '✅', unit: '',
    sum: (c, ds) => ds.reduce((n, d) => n + (c.e[d]
      ? c.hkeys.filter(k => hVal(c.e[d], k) === H_DONE).length : 0), 0) },
  { k: 'perfect', label: 'Perfect days',  emoji: '⭐', unit: 'days',
    sum: (c, ds) => ds.filter(d => c.e[d] && c.hkeys.length &&
      c.hkeys.every(k => hVal(c.e[d], k) === H_DONE)).length },
  { k: 'deep',    label: 'Deep work',     emoji: '🎯', unit: 'h', dec: 1,
    sum: (c, ds) => ds.reduce((n, d) => n + (c.num(d, 'deepWorkHours') || 0), 0) },
  { k: 'workout', label: 'Workout days',  emoji: '💪', unit: 'days',
    sum: (c, ds) => ds.filter(d => c.e[d] && +c.e[d].workoutsDone > 0).length },
  { k: 'journal', label: 'Days written',  emoji: '✍️', unit: 'days',
    sum: (c, ds) => ds.filter(d => c.e[d] && (c.e[d].journal || '').trim()).length },
  { k: 'steps',   label: 'Steps',         emoji: '👟', unit: '',
    sum: (c, ds) => ds.reduce((n, d) => { const v = (c.hs[d] || {}).steps;
      return n + (v != null && !isNaN(+v) ? +v : 0); }, 0) },
  { k: 'tracked', label: 'Time tracked',  emoji: '⏱', unit: 'h', dec: 1,
    sum: (c, ds) => { if (!ds.length) return 0;
      const t0 = new Date(ds[0] + 'T00:00:00').getTime();
      const t1 = new Date(addDays(ds[ds.length - 1], 1) + 'T00:00:00').getTime();
      return c.log.reduce((s, x) => { if (!x || x.start == null) return s;
        const a = Math.max(x.start, t0), b = Math.min(x.end == null ? Date.now() : x.end, t1);
        return s + Math.max(0, b - a); }, 0) / 3600000; } },
  { k: 'weeks',   label: 'Weeks in a row', emoji: '📅', unit: 'weeks',
    sum: () => weekStreak().live },
];
function goalMetric(k) { return GOAL_METRICS.find(m => m.k === k) || null; }

function DBgoals() { const g = safeParse(localStorage.getItem('dp.goals'), null); return Array.isArray(g) ? g : []; }
function saveGoals(g) { const ok = safeSet('dp.goals', JSON.stringify(g)); pushState(); return ok; }

/* Shared context so nine measures do not each re-read the store. */
function goalCtx() {
  const e = DB.entries(), hs = healthStore(), log = DB.timelog();
  return { e, hs, log: Array.isArray(log) ? log : [],
    hkeys: habitCfg().filter(h => !h.hidden).map(h => h.key),
    num: (d, k) => { const v = e[d] && e[d][k];
      return (v != null && v !== '' && !isNaN(+v)) ? +v : null; } };
}

/* The dates of the CURRENT period, and how much of it is left. Weeks use the same
   Monday-start as the weekly streak; months and years are calendar-true, not rolling, so
   "this month" means what a person means by it. */
function goalWindow(p) {
  const t = todayStr();
  let start, end;
  if (p === 'w') { start = weekStart(t); end = addDays(start, 6); }
  else if (p === 'm') { start = t.slice(0, 8) + '01'; end = t.slice(0, 7) + '-' + String(ymDays(t.slice(0, 7))).padStart(2, '0'); }
  else { start = t.slice(0, 4) + '-01-01'; end = t.slice(0, 4) + '-12-31'; }
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const elapsed = days.filter(d => d <= t).length;
  return { start, end, days, elapsed, left: days.length - elapsed };
}

function goalProgress(g) {
  const m = goalMetric(g.k);
  if (!m) return null;
  const w = goalWindow(g.p);
  const c = goalCtx();
  const done = m.sum(c, w.days.filter(d => d <= todayStr()));
  const target = +g.n;
  const pct = target > 0 ? Math.min(100, Math.round(done / target * 100)) : 0;
  const left = Math.max(0, target - done);
  // Per remaining day INCLUDING today — that is the number that makes the gap actionable.
  const perDay = w.left + 1 > 0 ? left / (w.left + 1) : left;
  return { g, m, w, done, target, pct, left, perDay, hit: done >= target };
}

/* Suggest = what they actually averaged over the last three comparable periods. Never a
   round number pulled from nowhere: "targets calibrated to nobody" is a named demotivation
   mode, and a suggestion from someone else's data is exactly that. */
function goalSuggest(k, p) {
  const m = goalMetric(k); if (!m) return null;
  const c = goalCtx(), per = GOAL_PERIODS[p].days;
  const vals = [];
  for (let i = 1; i <= 3; i++) {
    const ds = [];
    for (let j = 0; j < per; j++) ds.push(addDays(todayStr(), -(i * per) + j));
    vals.push(m.sum(c, ds));
  }
  const real = vals.filter(v => v > 0);
  if (!real.length) return null;
  const avg = real.reduce((a, b) => a + b, 0) / real.length;
  return m.dec ? Math.round(avg * 10) / 10 : Math.max(1, Math.round(avg));
}

function goalFmt(m, v) {
  if (m.k === 'steps') return Math.round(v).toLocaleString();
  return (m.dec ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v))) + (m.unit === 'h' ? 'h' : '');
}

/* ---- Goals card ---- */
let goalAdd = false, goalDraft = { k: 'habits', p: 'w', n: '' };

function goalsCardHTML() {
  const gs = DBgoals();
  const rows = gs.map(goalProgress).filter(Boolean);
  const done = rows.filter(r => r.hit).length;

  const form = !goalAdd ? '' : `<div class="gl-form">
    <div class="field"><label for="gl-k">Measure</label>
      <select id="gl-k">${GOAL_METRICS.map(m =>
        `<option value="${m.k}"${goalDraft.k === m.k ? ' selected' : ''}>${m.emoji} ${m.label}</option>`).join('')}</select></div>
    <div class="field"><label>Over</label>
      <div class="range-row">${Object.keys(GOAL_PERIODS).map(p =>
        `<button type="button" class="range-btn ${goalDraft.p === p ? 'on' : ''}" data-gl-p="${p}">${GOAL_PERIODS[p].name}</button>`).join('')}</div></div>
    <div class="field"><label for="gl-n">Target</label>
      <div class="gl-target">
        <input type="number" id="gl-n" inputmode="decimal" min="0" step="any"
          placeholder="how many?" value="${escapeHtml(String(goalDraft.n))}">
        <button type="button" class="btn btn-ghost btn-sm" id="gl-suggest">Suggest</button>
      </div>
      <div class="hint" id="gl-hint">Suggest fills in what you actually averaged over your
        last three ${GOAL_PERIODS[goalDraft.p].name.toLowerCase().replace('ly', '')}s — your own
        history, not somebody else's number.</div></div>
    <div class="btn-row">
      <button type="button" class="btn btn-primary btn-sm" id="gl-save">Add goal</button>
      <button type="button" class="btn btn-ghost btn-sm" id="gl-cancel">Cancel</button>
    </div>
  </div>`;

  return `<div class="card">
    <h2 class="h2-icon">${hicon('target')}<span>Your goals</span>
      <span class="hint" style="margin-left:auto">${rows.length
        ? `${done} of ${rows.length} hit` : 'free, all of them'}</span></h2>

    ${rows.length ? rows.map(r => `<div class="gl-row${r.hit ? ' hit' : ''}">
      <div class="gl-head">
        <span class="gl-name">${r.m.emoji} ${r.m.label}
          <span class="hint">${GOAL_PERIODS[r.g.p].label}</span></span>
        <button type="button" class="gl-del" data-gl-del="${r.g.id}" aria-label="Remove goal">✕</button>
      </div>
      <div class="gl-bar"><i style="width:${Math.max(2, r.pct)}%"></i></div>
      <div class="gl-foot">
        <span><b>${goalFmt(r.m, r.done)}</b> of ${goalFmt(r.m, r.target)}</span>
        <span class="gl-gap">${r.hit
          ? '✓ done'
          : `${goalFmt(r.m, r.left)} to go${r.w.left > 0 && r.m.k !== 'weeks'
              ? ` · ${goalFmt(r.m, r.perDay)}/day` : ''}`}</span>
      </div>
    </div>`).join('')
    : `<div class="hint">Set any target you like — nine measures over a week, a month or a
       year, as many as you want. Other trackers charge for this.</div>`}

    ${form}
    ${goalAdd ? '' : `<button class="btn btn-ghost btn-sm" id="gl-add" style="margin-top:10px">＋ Add a goal</button>`}
  </div>`;
}

/* Swap just this card — renderDash rebuilds the year mosaic and the award list. */
function refreshGoals() {
  const cards = [...document.querySelectorAll('#s-dash .card')];
  const card = cards.find(c => c.querySelector('[data-gl-del], #gl-add, #gl-save'));
  if (!card) { renderDash(); return; }
  const tmp = document.createElement('div');
  tmp.innerHTML = goalsCardHTML();
  const next = tmp.firstElementChild;
  if (next) card.replaceWith(next);
}

function goalDraftRead() {
  const k = document.getElementById('gl-k'), n = document.getElementById('gl-n');
  if (k) goalDraft.k = k.value;
  if (n) goalDraft.n = n.value;
}

document.addEventListener('click', (ev) => {
  const t = ev.target;
  if (!t || !t.closest) return;

  if (t.id === 'gl-add') { goalAdd = true; goalDraft = { k: 'habits', p: 'w', n: '' }; refreshGoals(); return; }
  if (t.id === 'gl-cancel') { goalAdd = false; refreshGoals(); return; }

  const pb = t.closest('[data-gl-p]');
  if (pb) { goalDraftRead(); goalDraft.p = pb.dataset.glP; refreshGoals(); buzz(6); return; }

  if (t.id === 'gl-suggest') {
    goalDraftRead();
    const v = goalSuggest(goalDraft.k, goalDraft.p);
    if (v == null) { toast('Not enough history yet to suggest one', true); return; }
    goalDraft.n = String(v); refreshGoals(); buzz(8);
    toast('Your own average over the last 3 ' + GOAL_PERIODS[goalDraft.p].name.toLowerCase().replace('ly', '') + 's');
    return;
  }

  if (t.id === 'gl-save') {
    goalDraftRead();
    const n = parseFloat(goalDraft.n);
    if (!isFinite(n) || n <= 0) { toast('Give it a target above zero', true); return; }
    const gs = DBgoals();
    // one goal per measure+period, so the card cannot fill with near-duplicates
    const i = gs.findIndex(g => g.k === goalDraft.k && g.p === goalDraft.p);
    const rec = { id: 'g' + Date.now(), k: goalDraft.k, p: goalDraft.p, n, at: new Date().toISOString() };
    if (i >= 0) gs[i] = Object.assign({}, gs[i], { n, at: rec.at }); else gs.push(rec);
    saveGoals(gs);
    goalAdd = false; refreshGoals(); buzz(14);
    toast(i >= 0 ? 'Goal updated' : 'Goal set');
    return;
  }

  const db = t.closest('[data-gl-del]');
  if (db) {
    saveGoals(DBgoals().filter(g => g.id !== db.dataset.glDel));
    refreshGoals(); buzz(8); toast('Goal removed');
    return;
  }
});
document.addEventListener('change', (ev) => {
  if (ev.target && ev.target.id === 'gl-k') { goalDraftRead(); refreshGoals(); }
});

/* ============================================================
   MONTH IN REVIEW — the recap deck.

   Strava's "Month in Sport" was rated a build in the research, with one explicit caveat:
   copy the CADENCE, not the artificial scarcity. Strava's recap expires on the 26th to
   manufacture urgency; a private tracker has no reason to delete your own summary, so every
   month you have ever logged stays browsable forever.

   The cadence part is real though: for the first ten days of a new month the card
   highlights the month just finished, because that is when a recap is worth reading. After
   that it settles back to a browsable archive.

   No new dp.* key. Everything is derived from the log on read, like every other summary in
   this app.
   ============================================================ */
const MR_MON = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
let mrYM = null;        // 'YYYY-MM' being viewed; null = not open

function ymOf(d) { return d.slice(0, 7); }
function ymPrev(ym) {
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7);
  return m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0');
}
function ymNext(ym) {
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7);
  return m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0');
}
function ymLabel(ym) { return MR_MON[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4); }
function ymDays(ym) {
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7);
  return new Date(y, m, 0).getDate();
}

/* Every month that has at least one logged day, newest first. */
function mrMonths() {
  const e = DB.entries(), hs = healthStore(), set = {};
  Object.keys(e).forEach(d => { if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set[ymOf(d)] = 1; });
  Object.keys(hs).forEach(d => { if (/^\d{4}-\d{2}-\d{2}$/.test(d)) set[ymOf(d)] = 1; });
  return Object.keys(set).sort().reverse();
}

/* All the numbers for one month, in one pass per store. `partial` is true when the month is
   still running — the deck says so rather than presenting a half month as a whole one. */
function monthReview(ym) {
  const e = DB.entries(), hs = healthStore(), log = DB.timelog();
  const total = ymDays(ym);
  const days = [];
  for (let i = 1; i <= total; i++) days.push(ym + '-' + String(i).padStart(2, '0'));
  const partial = ym === ymOf(todayStr());
  const upto = partial ? days.filter(d => d <= todayStr()) : days;

  const num = (d, k) => { const v = e[d] && e[d][k];
    return (v != null && v !== '' && !isNaN(+v)) ? +v : null; };
  const vals = k => upto.map(d => num(d, k)).filter(x => x != null);
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const hv = k => upto.map(d => (hs[d] || {})[k]).filter(x => x != null && !isNaN(+x)).map(Number);

  const logged = upto.filter(d => e[d]).length;
  const hkeys = habitCfg().filter(h => !h.hidden).map(h => h.key);
  let ticks = 0, perfect = 0;
  upto.forEach(d => {
    if (!e[d]) return;
    const done = hkeys.filter(k => hVal(e[d], k) === H_DONE).length;
    ticks += done;
    if (hkeys.length && done === hkeys.length) perfect++;
  });

  // per-habit completion over the days that were logged
  const habitRows = hkeys.map(k => {
    const cfg = habitCfg().find(h => h.key === k) || {};
    const done = upto.filter(d => e[d] && hVal(e[d], k) === H_DONE).length;
    const skip = upto.filter(d => e[d] && hVal(e[d], k) === H_SKIP).length;
    const base = Math.max(1, logged - skip);
    return { key: k, emoji: cfg.emoji || '•', label: cfg.label || k, done, skip,
             pct: Math.round(done / base * 100) };
  }).sort((a, b) => b.pct - a.pct);

  // time tracked per activity, one pass, clipped to the month
  const t0 = new Date(days[0] + 'T00:00:00').getTime();
  const t1 = new Date(addDays(days[days.length - 1], 1) + 'T00:00:00').getTime();
  const byAct = {};
  (Array.isArray(log) ? log : []).forEach(x => {
    if (!x || x.start == null) return;
    const a = Math.max(x.start, t0), b = Math.min(x.end == null ? Date.now() : x.end, t1);
    if (b <= a) return;
    byAct[x.act] = (byAct[x.act] || 0) + (b - a);
  });
  const actRows = Object.keys(byAct).map(id => {
    const a = actById(id) || { name: id, emoji: '•', color: '#888' };
    return { id, name: a.name, emoji: a.emoji, color: a.color, ms: byAct[id] };
  }).sort((x, y) => y.ms - x.ms);
  const trackedMs = actRows.reduce((s, r) => s + r.ms, 0);

  const journalled = upto.filter(d => e[d] && (e[d].journal || '').trim()).length;
  const words = upto.reduce((s, d) => s + ((e[d] && e[d].journal || '').trim()
    ? (e[d].journal.trim().split(/\s+/).length) : 0), 0);

  const stepsArr = hv('steps');
  return {
    ym, label: ymLabel(ym), partial, total, elapsed: upto.length,
    logged, coverage: Math.round(logged / upto.length * 100),
    ticks, perfect, habitRows, actRows, trackedMs, journalled, words,
    mood: mean(vals('mood')), energy: mean(vals('energy')),
    sleep: mean(vals('sleepHours')), deep: vals('deepWorkHours').reduce((a, b) => a + b, 0),
    steps: stepsArr.reduce((a, b) => a + b, 0), stepsAvg: mean(stepsArr),
    screen: mean(hv('screenMin')), workouts: upto.filter(d => e[d] && +e[d].workoutsDone > 0).length,
    best: (() => { const withMood = upto.filter(d => num(d, 'mood') != null);
      if (!withMood.length) return null;
      const b = withMood.reduce((p, d) => num(d, 'mood') > num(p, 'mood') ? d : p, withMood[0]);
      return { date: b, mood: num(b, 'mood') }; })(),
  };
}

/* The entry card on Stats > Overview. Highlighted for the first ten days of a new month,
   pointing at the month just finished — the cadence is the useful half of Strava's recap.
   No expiry: every month you have logged stays here. */
function monthCardHTML() {
  const months = mrMonths();
  if (!months.length) return '';
  const today = todayStr();
  const dom = +today.slice(8, 10);
  const prev = ymPrev(ymOf(today));
  const fresh = dom <= 10 && months.indexOf(prev) !== -1;
  const target = fresh ? prev : months[0];
  const r = monthReview(target);
  return `<div class="card mr-entry${fresh ? ' fresh' : ''}">
    <h2 class="h2-icon">${hicon('calendar')}<span>${fresh ? r.label + ' is done' : 'Month in review'}</span>
      <span class="hint" style="margin-left:auto">${months.length} month${months.length === 1 ? '' : 's'}</span></h2>
    <div class="hint">${fresh
      ? `Your ${r.label} wrap-up is ready — ${r.logged} days logged, ${r.ticks} habits ticked.`
      : `A five-card wrap-up of any month you have logged.`}</div>
    <button class="btn btn-primary" style="margin-top:10px" data-mr-open="${target}">
      ${fresh ? `See ${MR_MON[+target.slice(5, 7) - 1]}` : `See ${r.label}`}</button>
  </div>`;
}

/* ---- the deck ---- */
let mrPage = 0;
function mrOpen(ym) {
  mrYM = ym; mrPage = 0;
  let el = document.getElementById('mrdeck');
  if (!el) { el = document.createElement('div'); el.id = 'mrdeck'; el.className = 'sharesheet'; document.body.appendChild(el); }
  el.classList.add('on');
  mrRender();
}
function mrClose() {
  const el = document.getElementById('mrdeck');
  if (el) el.classList.remove('on');
  mrYM = null;
}

function mrCards(r) {
  const n = v => v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1);
  const big = (v, l) => `<div class="mr-big"><div class="mr-v">${v}</div><div class="mr-l">${l}</div></div>`;
  const cards = [];

  // 1 — the shape of the month
  cards.push({ t: 'The month', body: `
    <div class="mr-grid">
      ${big(r.logged, 'days logged')}
      ${big(r.coverage + '%', 'of the month')}
      ${big(r.ticks.toLocaleString(), 'habits ticked')}
      ${big(r.perfect, r.perfect === 1 ? 'perfect day' : 'perfect days')}
    </div>
    ${r.partial ? `<div class="hint mr-note">${r.label} is still running — this covers the ${r.elapsed} day${r.elapsed === 1 ? '' : 's'} so far.</div>` : ''}` });

  // 2 — habits, ranked
  if (r.habitRows.length) cards.push({ t: 'Habits', body: `
    ${r.habitRows.map(h => `<div class="mr-row">
      <span class="mr-row-n">${h.emoji} ${escapeHtml(h.label)}</span>
      <span class="mr-bar"><i style="width:${Math.max(2, h.pct)}%"></i></span>
      <span class="mr-row-v">${h.pct}%</span></div>`).join('')}
    <div class="hint mr-note">Out of the days you logged. Skipped days are left out, not counted against you.</div>` });

  // 3 — how it felt
  cards.push({ t: 'How it felt', body: `
    <div class="mr-grid">
      ${big(n(r.mood), 'avg mood')}
      ${big(n(r.energy), 'avg energy')}
      ${big(n(r.sleep) + 'h', 'avg sleep')}
      ${big(r.workouts, r.workouts === 1 ? 'workout day' : 'workout days')}
    </div>
    ${r.best ? `<div class="mr-note">Best day: <b>${shortDate(r.best.date)}</b> — mood ${r.best.mood}/10.</div>` : ''}` });

  // 4 — where the time went
  if (r.trackedMs > 0) cards.push({ t: 'Where the time went', body: `
    ${r.actRows.slice(0, 8).map(a => `<div class="mr-row">
      <span class="mr-row-n">${a.emoji} ${escapeHtml(a.name)}</span>
      <span class="mr-bar"><i style="width:${Math.max(2, Math.round(a.ms / r.trackedMs * 100))}%;background:${a.color}"></i></span>
      <span class="mr-row-v">${fmtDur(a.ms, true)}</span></div>`).join('')}
    <div class="hint mr-note">${fmtDur(r.trackedMs)} tracked in total.</div>` });

  // 5 — the rest, only what there is data for
  const bits = [];
  if (r.deep) bits.push(big(n(r.deep) + 'h', 'deep work'));
  if (r.steps) bits.push(big(Math.round(r.steps).toLocaleString(), 'steps'));
  if (r.screen != null) bits.push(big(fmtMin(Math.round(r.screen)), 'screen a day'));
  if (r.journalled) bits.push(big(r.journalled, r.journalled === 1 ? 'day written' : 'days written'));
  if (bits.length) cards.push({ t: 'And also', body: `<div class="mr-grid">${bits.join('')}</div>
    ${r.words ? `<div class="hint mr-note">${r.words.toLocaleString()} words written this month.</div>` : ''}` });

  return cards;
}

function mrRender() {
  const el = document.getElementById('mrdeck');
  if (!el || !mrYM) return;
  const r = monthReview(mrYM);
  const cards = mrCards(r);
  if (mrPage >= cards.length) mrPage = cards.length - 1;
  if (mrPage < 0) mrPage = 0;
  const c = cards[mrPage];
  const months = mrMonths();
  const i = months.indexOf(mrYM);
  const older = i >= 0 && i < months.length - 1 ? months[i + 1] : null;
  const newer = i > 0 ? months[i - 1] : null;

  el.innerHTML = `<div class="ss-inner">
    <div class="ss-head">
      <button type="button" class="mr-nav" data-mr-go="${older || ''}" ${older ? '' : 'disabled'} aria-label="Earlier month">‹</button>
      <span class="mr-title">${r.label}</span>
      <button type="button" class="mr-nav" data-mr-go="${newer || ''}" ${newer ? '' : 'disabled'} aria-label="Later month">›</button>
      <button type="button" class="ss-x" id="mr-close" aria-label="Close">✕</button>
    </div>

    <div class="card mr-card">
      <h2 class="mr-card-t">${c.t}</h2>
      ${c.body}
    </div>

    <div class="mr-dots">${cards.map((x, n) =>
      `<button type="button" class="mr-dot ${n === mrPage ? 'on' : ''}" data-mr-page="${n}" aria-label="${escapeHtml(x.t)}"></button>`).join('')}</div>

    <div class="mr-steps">
      <button type="button" class="btn btn-ghost btn-sm" data-mr-step="-1" ${mrPage === 0 ? 'disabled' : ''}>← Back</button>
      <button type="button" class="btn btn-primary btn-sm" data-mr-step="1" ${mrPage === cards.length - 1 ? 'disabled' : ''}>Next →</button>
    </div>
    <div class="ss-acts"><button type="button" class="btn btn-ghost" data-share-card="pixels">🖼️ Make a share card</button></div>
    <div class="hint ss-note">Worked out from your log every time you open it. Nothing is stored, and nothing expires.</div>
  </div>`;
}

document.addEventListener('click', (ev) => {
  const t = ev.target;
  if (!t || !t.closest) return;
  const op = t.closest('[data-mr-open]');
  if (op) { mrOpen(op.dataset.mrOpen); buzz(10); return; }
  if (t.id === 'mr-close' || t.id === 'mrdeck') { mrClose(); return; }
  const go = t.closest('[data-mr-go]');
  if (go && go.dataset.mrGo) { mrYM = go.dataset.mrGo; mrPage = 0; mrRender(); buzz(6); return; }
  const pg = t.closest('[data-mr-page]');
  if (pg) { mrPage = +pg.dataset.mrPage; mrRender(); return; }
  const st = t.closest('[data-mr-step]');
  if (st) { mrPage += +st.dataset.mrStep; mrRender(); buzz(5); return; }
});

/* ============================================================
   YOU vs YOU — temporal (self-past) comparison.

   The research's evidence-backed replacement for a leaderboard: the only person on the
   other side of the comparison is you, n days ago. It is also the only motivational
   comparison an accountless, serverless, single-user app can honestly offer.

   This REPLACES the old week-over-week strip, which had four problems worth naming because
   each one is a rule here:
     - `const up = diff >= 0` painted every increase green, so MORE screen time read as
       progress.
     - `wk(0)` included today. A half-logged today drags steps, screen time, tracked hours
       and habit counts down every morning, so the strip quietly wobbled all day. Today now
       sits out of both windows.
     - `if (a == null || b == null) return` made a metric vanish silently when history was
       thin. Thin metrics are now named instead of hidden.
     - Any non-zero delta was a win or a loss, however tiny. A change inside a metric's own
       noise floor now reads "level".

   Two more rules the old one never had: the year window steps back 364 days (not 365) and
   month mode uses 28 (not 30), so both sides hold the same weekdays; and a period with no
   comparable past names the date it unlocks instead of rendering a fake zero.
   ============================================================ */
const VS_PERIODS = [
  { k: 'w', n: 7,  back: 7,   min: 3, label: 'vs last week',
    aLab: 'Last 7 days',  bLab: 'the 7 before' },
  { k: 'm', n: 28, back: 28,  min: 8, label: 'vs last month',
    aLab: 'Last 4 weeks', bLab: 'the 4 before' },
  { k: 'y', n: 28, back: 364, min: 8, label: 'vs last year',
    aLab: 'Last 4 weeks', bLab: 'the same 4 weeks a year ago' },
];
let vsMode = 'w';          // in-memory only, like dashTab / dashRange

/* n days ending `off` days before today. off is always >= 1, so today never counts.
   The end bound goes through addDays() rather than +86400000 so a DST boundary cannot
   shift it by an hour. */
function vsWindow(n, off) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) days.push(addDays(todayStr(), -(i + off)));
  const last = days[days.length - 1];
  return { days,
    t0: new Date(days[0] + 'T00:00:00').getTime(),
    t1: new Date(addDays(last, 1) + 'T00:00:00').getTime() };
}

/* Reads each store ONCE and hands out window-scoped accessors. Every value comes back as
   { v, n } — the number, and how many days actually carried data — or null. */
function vsCtx() {
  const e = DB.entries(), hs = healthStore(), log = DB.timelog();
  const hkeys = habitCfg().filter(h => !h.hidden).map(h => h.key);
  const num = (d, k) => { const v = e[d] && e[d][k];
    return (v != null && v !== '' && !isNaN(+v)) ? +v : null; };
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  return { e, hs, log, hkeys, num,
    logged: w => w.days.filter(d => e[d]).length,
    avgField: (w, k) => { const v = w.days.map(d => num(d, k)).filter(x => x != null);
      return v.length ? { v: mean(v), n: v.length } : null; },
    avgHealth: (w, k) => { const v = w.days.map(d => (hs[d] || {})[k])
        .filter(x => x != null && !isNaN(+x)).map(Number);
      return v.length ? { v: mean(v), n: v.length } : null; },
    /* One pass over the timelog. A window is a CONTIGUOUS date range, so a single overlap
       per segment equals summing per-day totals — without re-parsing dp.timelog once per
       day (56 parses in year mode, on a POCO C31). */
    trackedMs: w => (Array.isArray(log) ? log : []).reduce((s, x) => {
      if (!x || x.start == null) return s;
      const a = Math.max(x.start, w.t0);
      const b = Math.min(x.end == null ? Date.now() : x.end, w.t1);
      return s + Math.max(0, b - a); }, 0),
  };
}

/* dir: +1 up is better, -1 down is better, 0 no judgement (the arrow still shows which way
   the number moved; only the colour is withheld). eps: the smallest change worth calling a
   change. zero on BOTH sides means the user does not track it at all, and the row stays out
   rather than reporting a meaningless 0 vs 0. */
const VS_METRICS = [
  /* dir 0 for mood and energy on purpose. They are STATES, not performance: the arrow still
     shows which way they moved, but they are never painted red and never named as a "slip".
     Telling someone in a bad fortnight that their mood is their biggest failure is exactly
     the harm a mood tracker has to avoid — and it is not something you can try harder at. */
  { k: 'mood',     label: '😊 Mood',        dir:  0, eps: 0.2,
    fmt: v => v.toFixed(1),                   get: (c, w) => c.avgField(w, 'mood') },
  { k: 'energy',   label: '⚡ Energy',       dir:  0, eps: 0.2,
    fmt: v => v.toFixed(1),                   get: (c, w) => c.avgField(w, 'energy') },
  { k: 'sleep',    label: '😴 Sleep',       dir:  1, eps: 0.2,
    fmt: v => v.toFixed(1) + 'h',             get: (c, w) => c.avgField(w, 'sleepHours') },
  { k: 'deep',     label: '🎯 Deep work',   dir:  1, eps: 0.2,
    fmt: v => v.toFixed(1) + 'h',             get: (c, w) => c.avgField(w, 'deepWorkHours') },
  { k: 'habits',   label: '✅ Habits/day',  dir:  1, eps: 0.3,
    fmt: v => v.toFixed(1),
    get: (c, w) => { if (!c.hkeys.length) return null;
      // per LOGGED day, so unlogged days do not read as zero-habit days
      const per = w.days.filter(d => c.e[d])
        .map(d => c.hkeys.filter(k => hVal(c.e[d], k) === H_DONE).length);
      return per.length ? { v: per.reduce((a, b) => a + b, 0) / per.length, n: per.length } : null; } },
  { k: 'tracked',  label: '⏱ Time tracked', dir:  0, eps: 0.5,
    fmt: v => fmtH(v),
    get: (c, w) => { const ms = c.trackedMs(w);
      return { v: ms / 3600000, n: w.days.length, zero: ms === 0 }; } },
  { k: 'workouts', label: '💪 Workout days', dir:  1, eps: 1,
    fmt: v => String(Math.round(v)),
    get: (c, w) => { const k = w.days.filter(d => c.e[d] && +c.e[d].workoutsDone > 0).length;
      return { v: k, n: c.logged(w), zero: k === 0 }; } },
  { k: 'steps',    label: '👟 Steps',       dir:  1, eps: 250,
    fmt: v => Math.round(v).toLocaleString(), get: (c, w) => c.avgHealth(w, 'steps') },
  { k: 'screen',   label: '📱 Screen time', dir: -1, eps: 5,
    fmt: v => fmtMin(Math.round(v)),          get: (c, w) => c.avgHealth(w, 'screenMin') },
  { k: 'logged',   label: '📘 Days logged',  dir:  1, eps: 1,
    fmt: v => String(Math.round(v)),          get: (c, w) => ({ v: c.logged(w), n: w.days.length }) },
];

function vsPastHTML() {
  const c = vsCtx();
  const all = Object.keys(c.e).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const h2 = hint => `<h2 class="h2-icon">${hicon('history')}<span>You vs you</span>${
    hint ? `<span class="hint" style="margin-left:auto">${hint}</span>` : ''}</h2>`;

  // Under a week of history there is nothing to compare. Say so; do not ship an empty frame.
  if (all.length < 6) {
    const left = 6 - all.length;
    return `<div class="card vs-card">${h2('')}
      <div class="hint">Log ${left} more day${left === 1 ? '' : 's'} and this starts comparing
      your week against the one before. The only person on the other side of this comparison
      is you.</div></div>`;
  }

  const p = VS_PERIODS.find(x => x.k === vsMode) || VS_PERIODS[0];
  const A = vsWindow(p.n, 1), B = vsWindow(p.n, 1 + p.back);
  const picker = `<div class="range-row vs-modes">${VS_PERIODS.map(x =>
    `<button type="button" class="range-btn ${x.k === p.k ? 'on' : ''}"
      data-vsmode="${x.k}">${x.label}</button>`).join('')}</div>`;
  const shell = (hint, body) => `<div class="card vs-card">${h2(hint)}${picker}${body}</div>`;

  // Honest degradation 1 — the older window is entirely before your first logged day.
  const first = all[0], bLast = B.days[B.days.length - 1];
  if (first > bLast) {
    return shell('', `<div class="empty">Your log starts ${shortDate(first)}, so there is
      nothing from ${p.bLab} to compare against. This one unlocks
      <b>${shortDate(addDays(first, p.back + 1))}</b>.</div>`);
  }

  const rows = [], thin = [];
  VS_METRICS.forEach(m => {
    const a = m.get(c, A), b = m.get(c, B);
    if (!a && !b) return;                            // you do not track this — stay quiet
    if (a && b && a.zero && b.zero) return;          // nothing on either side
    if (!a || !b || a.n < p.min || b.n < p.min) { thin.push(m.label); return; }
    const d = a.v - b.v;
    const level = Math.abs(d) < m.eps;
    // the arrow follows the NUMBER, the colour follows dir — they are not the same thing
    const cls = (level || m.dir === 0) ? 'flat' : (((m.dir > 0) === (d > 0)) ? 'up' : 'down');
    const chip = level ? 'level' : `${d > 0 ? '▲' : '▼'} ${m.fmt(Math.abs(d))}`;
    const cov = (a.n === b.n && a.n === p.n) ? '' : ` · ${a.n}d vs ${b.n}d`;
    rows.push({ m, a, b, d, level, cls, chip,
      html: `<div class="wow-row"><span class="name">${m.label}</span>
        <span class="wow-vals">${m.fmt(a.v)} <span class="hint">vs ${m.fmt(b.v)}${cov}</span></span>
        <span class="wow-delta ${cls}">${chip}</span></div>` });
  });

  // Honest degradation 2 — the window exists but is too sparse to say anything.
  if (!rows.length) {
    const bl = c.logged(B);
    return shell('', `<div class="empty">Only ${bl} of those ${p.n} days ${bl === 1 ? 'is' : 'are'}
      logged, so there is nothing solid to compare against yet. Keep logging — it fills
      in.</div>`);
  }

  // Hero: mood if it is comparable, else the first metric that is.
  const hero = rows.find(r => r.m.k === 'mood') || rows[0];
  const list = rows.filter(r => r !== hero);
  const heroHTML = `<div class="pm-hero">
      <div class="pm-score">${hero.m.fmt(hero.a.v)}<span class="pm-out">
        ${stripLeadEmoji(hero.m.label)}</span></div>
      <div class="pm-meta"><span class="wow-delta ${hero.cls}">${hero.chip}</span>
        <span class="hint"> vs ${hero.m.fmt(hero.b.v)}</span>
        <div class="hint">${shortDate(A.days[0])} – ${shortDate(A.days[A.days.length - 1])}
          · ${c.logged(A)} of ${p.n} days logged</div></div>
    </div>`;

  // One sentence worth reading. Ranked by size relative to each metric's OWN noise floor,
  // so 300 steps cannot outrank a full point of mood.
  const moved = rows.filter(r => !r.level && r.m.dir !== 0);
  const rank = (x, y) => Math.abs(y.d) / y.m.eps - Math.abs(x.d) / x.m.eps;
  const up = moved.filter(r => r.cls === 'up').sort(rank)[0];
  const dn = moved.filter(r => r.cls === 'down').sort(rank)[0];
  const sign = r => (r.d > 0 ? '+' : '−') + r.m.fmt(Math.abs(r.d));
  const verdict = (rows.length >= 3 && (up || dn)) ? `<div class="corr-note">${
    up ? `Biggest lift: <b>${stripLeadEmoji(up.m.label)} ${sign(up)}</b>. ` : ''}${
    dn ? `Biggest slip: <b>${stripLeadEmoji(dn.m.label)} ${sign(dn)}</b>.`
       : 'Nothing went backwards.'}</div>` : '';

  const notes = `<div class="hint" style="margin-top:8px">Today is still being logged, so it
    sits out of both sides.${thin.length
      ? ` Not enough history yet to compare: ${thin.join(', ')}.` : ''}</div>`;

  return shell(`${p.aLab} vs ${p.bLab}`, heroHTML + list.map(r => r.html).join('') + verdict + notes);
}

/* Swap the one card instead of re-rendering Stats: renderDash() rebuilds the journal graph,
   the year mosaic and the whole award list, and throws away scroll position. */
function refreshVsCard() {
  const card = document.querySelector('.vs-card');
  if (!card) { renderDash(); return; }
  const tmp = document.createElement('div');
  tmp.innerHTML = vsPastHTML();
  const next = tmp.firstElementChild;
  if (next) card.replaceWith(next); else card.remove();
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest && ev.target.closest('[data-vsmode]');
  if (!b || b.dataset.vsmode === vsMode) return;
  vsMode = b.dataset.vsmode;
  buzz(8);
  refreshVsCard();
});

/* ============================================================
   ACHIEVEMENTS + SHARE CARDS

   Awards are DERIVED from the log on every read. There is no stored score, so there is
   nothing to inflate and nothing to lose — the three failure modes the research named
   were "an unreachable ceiling set by somebody else", "targets calibrated to nobody" and
   "rewards you can lose or fake", and deriving everything from your own history avoids
   all three. Deliberate choices:

     - Every family is TIERED. A 30-day goal pays out at 3, 7, 14, 21 too, so nobody
       finishes empty-handed — the all-or-nothing failure mode.
     - No points, no currency, no streak insurance. Informational feedback only: tangible
       rewards are precisely what erodes intrinsic motivation.
     - Nothing is ever revoked. A 30-day streak you held in March is still yours in July.
     - The earned DATE is replayed from history, not stamped as "today" on first run, so
       an existing user's Trophy Case is truthful the moment it appears.
   ============================================================ */

const AWARD_FAMILIES = [
  { grp: 'streak',   ico: '🔥', title: 'Consistency',  unit: 'days in a row',  mode: 'peak',
    tiers: [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365] },
  { grp: 'weeks',    ico: '📅', title: 'Weeks in a row', unit: 'weeks in a row', mode: 'peak',
    tiers: [2, 4, 8, 12, 26, 52] },
  { grp: 'days',     ico: '📘', title: 'Days logged',  unit: 'days logged',    mode: 'cum',
    tiers: [10, 25, 50, 100, 250, 500, 1000] },
  { grp: 'habits',   ico: '✅', title: 'Habits done',  unit: 'habits ticked',  mode: 'cum',
    tiers: [25, 100, 250, 500, 1000, 2500, 5000] },
  { grp: 'perfect',  ico: '⭐', title: 'Perfect days', unit: 'perfect days',   mode: 'cum',
    tiers: [1, 5, 10, 25, 50, 100, 200] },
  { grp: 'journal',  ico: '✍️', title: 'Written',      unit: 'journal entries', mode: 'cum',
    tiers: [5, 25, 50, 100, 250, 500] },
  { grp: 'focus',    ico: '🎯', title: 'Deep work',    unit: 'focused hours',  mode: 'cum',
    tiers: [10, 50, 100, 250, 500, 1000] },
  { grp: 'steps',    ico: '👟', title: 'Distance',     unit: 'steps walked',   mode: 'cum',
    tiers: [50000, 250000, 1000000, 2500000, 5000000] },
  { grp: 'strength', ico: '💪', title: 'Habit strength', unit: '% strength',   mode: 'peak',
    tiers: [25, 50, 75, 90, 100] },
];

/* A chronological [date, value] series per family. Replaying history is what lets the
   Trophy Case show the real date an award was earned instead of the day the feature
   shipped. 'strength' is the one exception — the EMA would have to be recomputed for
   every past day, so it reports current value only and its date reads "earned earlier". */
function awardSeries(grp, ents, health) {
  const e = ents || DB.entries(), dates = Object.keys(e).sort();
  const out = []; let acc = 0;
  if (grp === 'days')    { dates.forEach(d => { if (entryHasContent(e[d])) out.push([d, ++acc]); }); return out; }
  if (grp === 'journal') { dates.forEach(d => { if ((e[d].journal || '').trim()) acc++; out.push([d, acc]); }); return out; }
  if (grp === 'habits')  { dates.forEach(d => { const h = e[d].habits || {};
      acc += Object.keys(h).filter(k => hVal(e[d], k) === H_DONE).length; out.push([d, acc]); }); return out; }
  if (grp === 'perfect') {
      /* A day is judged only against the habits that EXISTED on it. Keying off today's
         config meant adding one habit re-scored all of history: every past perfect day
         instantly stopped being perfect and the badges vanished. Habit configs carry no
         creation date historically, so the first date a key ever appears in the log is the
         earliest day it can fairly be held against you; `added` is stamped on new habits
         going forward and wins when present. The semantics stay strict — an untouched habit
         still breaks the day, so nothing is inflated. */
      const cfg = habitCfg().filter(h => !h.hidden);
      if (!cfg.length) return [];
      const first = {};
      dates.forEach(d => { const h = e[d].habits || {};
        cfg.forEach(c => { if ((c.key in h) && first[c.key] == null) first[c.key] = d; }); });
      /* Fall back to the FIRST LOGGED DAY, not null. Returning null excluded any habit that
         had never once been tapped — permanently — so a user who only ever ticked 1 of their
         4 habits earned a "perfect day" every single day. A habit with no `added` stamp and
         no appearance in the log is a pre-existing one that has simply never been done; it
         has to count against a perfect day, or the award means nothing. New habits carry
         `added`, so this cannot resurrect the retroactive-demotion bug. */
      const since = c => c.added || first[c.key] || dates[0];
      dates.forEach(d => {
        const req = cfg.filter(c => since(c) <= d).map(c => c.key);
        /* Perfect = nothing MISSED, and at least one thing actually DONE. A skip is neutral
           here exactly as it is for streaks and for habit strength — requiring H_DONE for
           every habit meant taking the rest day the app itself offers cost you the award,
           two lines after the UI says "your streak is safe". Requiring one H_DONE stops a
           day where everything was skipped from counting as perfect. */
        const vals = req.map(k => hVal(e[d], k));
        if (vals.length && !vals.includes(H_MISS) && vals.includes(H_DONE)) acc++;
        out.push([d, acc]);
      });
      return out; }
  if (grp === 'focus')   { dates.forEach(d => { const raw = e[d].deepWorkHours;
      if (raw != null && raw !== '' && !isNaN(+raw)) acc += +raw; out.push([d, Math.round(acc)]); }); return out; }
  if (grp === 'steps')   { const hs = health || healthStore();
      Object.keys(hs).sort().forEach(d => { const v = hs[d] && hs[d].steps;
        if (v != null && !isNaN(+v)) acc += +v; out.push([d, acc]); }); return out; }
  /* Weekly run, dated to the last day of each qualifying week so the trophy case shows a
     real date. A week still in progress is excluded — it cannot yet have been earned. */
  if (grp === 'weeks') {
    const bs = weekBuckets(e), map = {};
    bs.forEach(b => { map[b.start] = b; });
    const thisW = weekStart(todayStr());
    let run = 0;
    bs.forEach(b => {
      if (b.start === thisW) return;
      const prevW = addDays(b.start, -7);
      run = (map[prevW] && map[prevW].ok && b.ok) ? run + 1 : (b.ok ? 1 : 0);
      out.push([addDays(b.start, 6), run]);
    });
    return out;
  }
  if (grp === 'streak')  { let run = 0, prev = null;
      dates.forEach(d => { run = (prev && addDays(prev, 1) === d) ? run + 1 : 1; prev = d; out.push([d, run]); });
      return out; }
  return [];
}

/* Advances every habit's EMA in ONE pass over the day range instead of walking the whole
   history once per habit — O(days) rather than O(habits x days). This was the single
   biggest cost on the entry-save path. Same clamped window and same skip semantics as
   habitStrength(), which stays the canonical single-habit version. */
function bestHabitStrength(ents) {
  const e = ents || DB.entries();
  const keys = habitCfg().filter(h => !h.hidden).map(h => h.key);
  const dates = Object.keys(e).sort();
  if (!keys.length || !dates.length) return 0;
  const mult = Math.pow(0.5, 1 / 13);
  const end = todayStr(), floor = addDays(end, -1200);
  const s = {}; keys.forEach(k => { s[k] = 0; });
  let cur = (dates[0] < floor ? floor : dates[0]), guard = 0;
  while (cur <= end && guard++ < 1300) {
    const en = e[cur];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (hVal(en, k) !== H_SKIP) s[k] = s[k] * mult + hFrac(en, k) * (1 - mult);
    }
    cur = addDays(cur, 1);
  }
  let best = 0;
  keys.forEach(k => { if (s[k] > best) best = s[k]; });
  return Math.round(best * 100);
}

/* `ents` lets the caller pass ONE snapshot of the store through every family instead of
   each of the seven series re-reading and re-parsing localStorage. */
function awardList(ents) {
  const out = [];
  const e = ents || DB.entries();
  const hs = healthStore();
  const seen = awardLog();                    // the ledger: award id -> date first earned
  AWARD_FAMILIES.forEach(f => {
    const ser = f.grp === 'strength' ? [] : awardSeries(f.grp, e, hs);
    let cur = 0;
    if (f.grp === 'strength') cur = bestHabitStrength(e);
    else if (ser.length) cur = f.mode === 'peak'
      ? ser.reduce((m, p) => p[1] > m ? p[1] : m, 0)          // reduce, not Math.max(...) — a
      : ser[ser.length - 1][1];                                // long history would blow the stack

    /* NOTHING IS EVER REVOKED — and this is what actually enforces it. `earned` used to be
       recomputed as `cur >= t` alone, which is fine for the cumulative families (they only
       grow) and for 'streak' (mode 'peak' takes the max over all history), but 'strength' is
       an instantaneous EMA: ten quiet days took it from 100 to 59 and the 75/90/100 badges
       silently disappeared from the trophy case while dp.awards still listed them. Unioning
       the ledger in makes the promise real for every family. */
    const held = f.tiers.filter(t => cur >= t || seen[f.grp + ':' + t]);
    const hi = held.length ? held[held.length - 1] : 0;       // high-water tier, for display

    f.tiers.forEach(t => {
      const id = f.grp + ':' + t;
      const hit = ser.find(p => p[1] >= t);
      out.push({ id, grp: f.grp, ico: f.ico, title: f.title, unit: f.unit, tier: t,
                 cur, hi: Math.max(cur, hi),
                 earned: cur >= t || !!seen[id],
                 /* Replayed history is the only truthful date. The ledger stamps todayStr()
                    for 'strength' (it has no series), so falling back to it there would tell
                    a long-time user they hit 100% today — keep "earned earlier" instead. */
                 on: hit ? hit[0] : (f.grp === 'strength' ? null : (seen[id] || null)) });
    });
  });
  return out;
}

function awardLog() { try { return safeParse(localStorage.getItem('dp.awards'), {}) || {}; } catch (e) { return {}; } }

/* Records which awards have already been announced. On the very first run every existing
   award is recorded SILENTLY — an established user opening this for the first time should
   see a full Trophy Case, not forty stacked celebration popups. */
function syncAwards(savedDate) {
  /* Never record awards earned off SAMPLE data. The preview writes weeks of generated
     entries, which is easily enough for several tiers, and the ledger is permanent by
     design — so a two-tap preview would have burned real badges that the user then owns
     forever without having earned them. Doubly wrong now that the ledger makes awards
     un-revocable. Clearing the sample cannot undo a ledger write, so simply never write. */
  if (localStorage.getItem('dp.sampleMeta')) return [];
  const seen = awardLog(), fresh = [];
  /* The silent absorb exists for an ESTABLISHED log meeting awards for the first time — an
     old user should not get forty stacked popups. But it keyed off the marker alone, so a
     brand-new install whose very first save already earned something got nothing: a perfect
     day is tier 1, reachable on day one, and the most engaged possible new user — the one
     who ticks everything immediately — was the one told nothing. Require history that
     PREDATES the day just written, which also behaves correctly when the first save is a
     backfilled past date. */
  const sd = savedDate || todayStr();
  const ents = DB.entries();                  // read the store ONCE for the whole scan
  const firstRun = !localStorage.getItem('dp.awardsInit') &&
                   Object.keys(ents).some(d => d !== sd);
  awardList(ents).filter(a => a.earned).forEach(a => {
    if (seen[a.id]) return;
    seen[a.id] = a.on || todayStr();
    if (!firstRun) fresh.push(a);
  });
  try {
    safeSet('dp.awards', JSON.stringify(seen));
    if (firstRun) localStorage.setItem('dp.awardsInit', '1');
  } catch (e) {}
  return fresh;
}

function awardName(a) {
  if (a.grp === 'steps')    return (a.tier >= 1e6 ? (a.tier / 1e6) + 'M' : (a.tier / 1000) + 'k') + ' steps';
  if (a.grp === 'strength') return a.tier + '% strength';
  return a.tier.toLocaleString() + ' ' + a.unit.replace(/^% /, '');
}

/* ---------- Trophy Case ---------- */
function renderAwards() {
  document.getElementById('screen-title').textContent = 'Awards';
  document.getElementById('screen-sub').textContent = 'your trophy case';
  // Flush any pending award scan first, or a just-earned badge is missing from the very
  // screen the user opened to look for it.
  try { awardsFlush(); } catch (e) {}
  document.getElementById('s-awards').innerHTML = awardsHTML() + '<div style="height:14px"></div>';
}

/* ---------- Trophy case rendering ----------
   The case used to be one grey pill per award, identical for every tier, so a 365-day streak
   looked exactly like a 3-day one and 49 of the 60 awards were invisible entirely. A trophy
   case with nothing to chase and no sense of rank is not a trophy case, it is a list.

   Now each award is a medal ranked by how far up its family's ladder it sits, locked ones are
   shown dimmed with the distance left, and the metals were contrast-checked as text against
   all three themes (worst case 4.77:1 light, 6.01:1 navy, 7.43:1 black) rather than picked
   for looking metallic. Rank is also written on every medal, so colour is never the only
   thing telling two apart. */
const AW_RANKS = [
  { k: 'bronze',   label: 'Bronze' },
  { k: 'silver',   label: 'Silver' },
  { k: 'gold',     label: 'Gold' },
  { k: 'platinum', label: 'Platinum' },
  { k: 'diamond',  label: 'Diamond' },
];
/* Rank comes from position WITHIN the family, not an absolute tier index: Consistency has 11
   tiers and Weeks has 6, so an absolute index would make the hardest weekly award a mere
   silver while an easy streak tier outranked it. */
function awRank(a) {
  const f = AWARD_FAMILIES.find(x => x.grp === a.grp);
  if (!f) return AW_RANKS[0];
  const i = f.tiers.indexOf(a.tier);
  const n = f.tiers.length - 1;
  const pos = n <= 0 ? 1 : i / n;
  return AW_RANKS[Math.min(AW_RANKS.length - 1, Math.floor(pos * AW_RANKS.length + 1e-9))];
}
let awFilter = 'all';   // all | earned

function awMedal(a) {
  const r = awRank(a);
  const left = Math.max(0, a.tier - a.hi);
  const pct = Math.max(0, Math.min(100, Math.round(a.hi / a.tier * 100)));
  const num = a.grp === 'steps' ? (a.tier >= 1e6 ? (a.tier / 1e6) + 'M' : (a.tier / 1000) + 'k')
            : a.grp === 'strength' ? a.tier + '%'
            : a.tier.toLocaleString();
  const unit = a.unit.replace(/^% /, '');
  const inner = `
    <span class="aw-disc"><span class="aw-ico">${a.ico}</span></span>
    <span class="aw-n">${num}</span>
    <span class="aw-u">${escapeHtml(unit)}</span>
    <span class="aw-meta">${a.earned ? (a.on ? shortDate(a.on) : 'earned') : left.toLocaleString() + ' to go'}</span>`;
  if (!a.earned) {
    return `<div class="aw-medal locked" data-rank="${r.k}" role="img"
      aria-label="Locked: ${escapeHtml(awardName(a))}, ${left.toLocaleString()} to go">
      <span class="aw-lock" aria-hidden="true">🔒</span>${inner}
      <span class="aw-mini"><i style="width:${pct}%"></i></span></div>`;
  }
  return `<button type="button" class="aw-medal" data-rank="${r.k}" data-aw-share="${a.id}">
    <span class="aw-rank">${r.label}</span>${inner}</button>`;
}

function awRing(done, total) {
  const R = 34, C = 2 * Math.PI * R;
  const pct = total ? done / total : 0;
  return `<svg class="aw-ring" width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
    <circle cx="42" cy="42" r="${R}" class="aw-ring-bg"></circle>
    <circle cx="42" cy="42" r="${R}" class="aw-ring-fg"
      stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 42 42)"></circle>
  </svg>`;
}

function awardsHTML() {
  const list = awardList();
  /* Sample data is real entries in the real store, so every award family counts it. The
     ledger refuses to record anything while it is loaded (see syncAwards), but the case
     would still SHOW those awards as if they were the user's. Label it rather than hide it —
     the preview exists to be explored, it just must not be mistaken for your own history. */
  const sampleOn = !!localStorage.getItem('dp.sampleMeta');
  const sampleBar = sampleOn ? `<div class="card sample-bar"><span>👀 Includes <b>sample data</b> — these are not your real awards, and none of them are being recorded.</span><button class="btn btn-ghost btn-sm" id="hc-sample-clear">Clear sample</button></div>` : '';
  const earned = list.filter(a => a.earned);
  if (!earned.length && !Object.keys(DB.entries()).length) {
    // sampleBar first: the early return used to skip it entirely, so a sample-loaded store
    // with no entries would have shown an unlabelled case.
    return `${sampleBar}<div class="card"><h2 class="h2-icon">${hicon('star')}<span>Trophy case</span></h2>
      <div class="empty">Log a day and your first award lands here.<br><br>There are <b>${list.length}</b> to collect across <b>${AWARD_FAMILIES.length}</b> families, all worked out from your own log — so none of them can be faked, and none is ever taken away.</div></div>`;
  }

  // Closest to unlocking, one per family: the goal-gradient effect only works if you can SEE the gap.
  const next = [];
  AWARD_FAMILIES.forEach(f => {
    const t = list.filter(a => a.grp === f.grp && !a.earned).sort((a, b) => a.tier - b.tier)[0];
    if (t) next.push(t);
  });
  next.sort((a, b) => (b.hi / b.tier) - (a.hi / a.tier));

  const tally = {};
  AW_RANKS.forEach(r => tally[r.k] = 0);
  earned.forEach(a => tally[awRank(a).k]++);

  const shown = awFilter === 'earned' ? earned : list;
  const byGrp = {};
  shown.forEach(a => { (byGrp[a.grp] = byGrp[a.grp] || []).push(a); });

  return `${sampleBar}
  <div class="card aw-hero">
    <div class="aw-hero-top">
      <div class="aw-ring-wrap">${awRing(earned.length, list.length)}
        <span class="aw-ring-n">${earned.length}</span></div>
      <div class="aw-hero-txt">
        <div class="aw-hero-h">Trophy case</div>
        <div class="aw-hero-s"><b>${earned.length}</b> of ${list.length} unlocked · ${AWARD_FAMILIES.length} families</div>
        <div class="aw-tally">${AW_RANKS.map(r => `<span class="aw-t-chip" data-rank="${r.k}"><i></i>${tally[r.k]}</span>`).join('')}</div>
      </div>
    </div>
    ${next.length ? `<div class="aw-closest">
      <div class="aw-closest-h">Closest to unlocking</div>
      ${next.slice(0, 3).map(a => { const pct = Math.max(2, Math.min(100, Math.round(a.hi / a.tier * 100)));
        return `<div class="aw-next" data-rank="${awRank(a).k}">
          <div class="aw-next-h"><span>${a.ico} ${escapeHtml(awardName(a))}</span>
            <span class="aw-next-n">${Math.max(0, a.tier - a.hi).toLocaleString()} to go</span></div>
          <div class="aw-bar"><span style="width:${pct}%"></span></div>
        </div>`; }).join('')}
    </div>` : `<div class="aw-closest"><div class="aw-allgot">Every award unlocked. There is nothing left to chase 🏆</div></div>`}
  </div>

  <div class="card" style="padding:12px">
    <div class="seg-row">
      <button class="seg-btn ${awFilter === 'all' ? 'on' : ''}" data-aw-filter="all">All ${list.length}</button>
      <button class="seg-btn ${awFilter === 'earned' ? 'on' : ''}" data-aw-filter="earned">Unlocked ${earned.length}</button>
    </div>
  </div>

  ${AWARD_FAMILIES.filter(f => byGrp[f.grp] && byGrp[f.grp].length).map(f => {
    const all = list.filter(a => a.grp === f.grp);
    const got = all.filter(a => a.earned).length;
    return `<div class="card aw-fam">
      <div class="aw-fam-h">
        <span class="aw-fam-ico">${f.ico}</span>
        <span class="aw-fam-t">${escapeHtml(f.title)}</span>
        <span class="aw-fam-c">${got}/${all.length}</span>
      </div>
      <div class="aw-fam-bar"><i style="width:${Math.round(got / all.length * 100)}%"></i></div>
      <div class="aw-grid">${byGrp[f.grp].sort((a, b) => a.tier - b.tier).map(awMedal).join('')}</div>
    </div>`; }).join('')}

  ${earned.length ? '<div class="hint aw-tip">Tap any unlocked medal to make a share card.</div>' : ''}`;
}

/* ============================================================
   SHARE CARDS — canvas, generated entirely on device.

   The bitmap leaves the app; the data never does. That is the whole point, and it is why
   there is no server in this path at all. Design rules taken from the research: three or
   four numbers at most (a card is not a dashboard), one sentence worth reading, and a
   signature look that is recognisable at thumbnail size — so cards are always dark with
   the same accent stroke regardless of the app theme.
   ============================================================ */

const CARD_W = 1080;
const CARD_RATIOS = { '4:5': 1350, '9:16': 1920 };
/* Every card BODY is laid out against this nominal height and then centred vertically in
   whatever ratio was picked, while the frame, wordmark and footer stay pinned to the real
   edges. Without this, a 9:16 story card kept the 4:5 layout at the top and left a third
   of the canvas empty underneath. */
const CARD_BODY = 1350;
function bodyTop(H) { return (H - CARD_BODY) / 2; }
const CARD_INK = '#f2f5ff', CARD_DIM = '#8f9bbd', CARD_BG = '#0d1220', CARD_BG2 = '#141b2e';
const CARD_ACCENT = '#6d8cff', CARD_WARM = '#fbbf24', CARD_GOOD = '#4ad6c0';

/* Story (9:16) is the default: it is the shape Instagram, WhatsApp and Snapchat stories
   actually use full-screen, which is where these get shared. A 4:5 post gets letterboxed
   there. Remembered per device once changed — picking a shape twice for the same preference
   is the kind of small friction that stops people sharing at all. */
let cardState = { kind: 'streak', ratio: safeParse(localStorage.getItem('dp.cardratio'), null) || '9:16',
  arg: null, blob: null, busy: false, hint: '', sending: false };

function cardFont(px, weight) { return `${weight || 400} ${px}px "DM Sans", "Twemoji Mozilla", system-ui, sans-serif`; }

/* Fonts must be resolved BEFORE the first fillText or the card silently renders in a
   fallback face — and the canvas gives no warning when that happens. */
async function cardFontsReady() {
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.all([document.fonts.load(cardFont(100, 800)), document.fonts.load(cardFont(40, 400)),
                         document.fonts.load(cardFont(48, 700))]);
      await document.fonts.ready;
    }
  } catch (e) {}
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) { g.roundRect(x, y, w, h, r); return; }
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* Wrap to a width and return the y the caller should continue from. */
function cardWrap(g, text, x, y, maxW, lh, align) {
  const words = String(text).split(/\s+/); let line = '', yy = y;
  g.textAlign = align || 'left';
  words.forEach(w => {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); yy += lh; line = w; }
    else line = t;
  });
  if (line) { g.fillText(line, x, yy); yy += lh; }
  return yy;
}

/* Lay text out WITHOUT drawing it, so a box can be sized to its contents. Drawing first
   and hoping is what made the insight card spill its sub-text into the footer. */
function cardLines(g, text, maxW) {
  const words = String(text).split(/\s+/), out = []; let line = '';
  words.forEach(w => {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  });
  if (line) out.push(line);
  return out;
}
/* Truncate to a measured pixel width. A character count cannot know how wide a glyph is:
   "No phone in the first hour" was cut mid-word at 24 chars while shorter labels had room. */
function cardClip(g, text, maxW) {
  let t = String(text);
  if (g.measureText(t).width <= maxW) return t;
  while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t.replace(/\s+$/, '') + '…';
}
function cardDrawLines(g, lines, x, y, lh, align) {
  g.textAlign = align || 'left';
  lines.forEach((l, i) => g.fillText(l, x, y + i * lh));
  return y + lines.length * lh;
}

function cardChrome(g, H, subtitle) {
  const grad = g.createLinearGradient(0, 0, CARD_W, H);
  grad.addColorStop(0, CARD_BG); grad.addColorStop(1, CARD_BG2);
  g.fillStyle = grad; g.fillRect(0, 0, CARD_W, H);
  // signature stroke: high contrast on a muted ground is what survives a thumbnail
  g.strokeStyle = CARD_ACCENT; g.lineWidth = 10;
  roundRect(g, 34, 34, CARD_W - 68, H - 68, 44); g.stroke();
  g.fillStyle = CARD_DIM; g.font = cardFont(34, 600); g.textAlign = 'left';
  g.fillText('DAYLOG', 84, 118);
  if (subtitle) { g.textAlign = 'right'; g.fillText(subtitle, CARD_W - 84, 118); }
  g.textAlign = 'left';
}

/* ---------- Where to get Daylog, on the card itself ----------
   A shared card is the only word of mouth that travels without us. It lands in a WhatsApp
   status or an Instagram story, and whoever sees it had no way to find out where it came
   from. Story cards — the default shape — have ~570px spare under the body, so they get a
   QR code to the Play listing there; Google Lens reads it from a screenshot or a long-press.
   The link carries a Play referrer so the Console's acquisition report can say whether cards
   bring anyone in at all. It is the SAME link for everyone: nothing about the user is in it. */
const PLAY_ID = 'io.github.kishore2494.dailypulse';
function playLink(source, medium, campaign) {
  const ref = 'utm_source=' + source + '&utm_medium=' + medium + (campaign ? '&utm_campaign=' + campaign : '');
  return 'https://play.google.com/store/apps/details?id=' + PLAY_ID + '&referrer=' + encodeURIComponent(ref);
}
let _qrLoad = null;
function qrLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (!_qrLoad) _qrLoad = new Promise(res => {
    const s = document.createElement('script'); s.src = 'libs/qrcode.js';
    s.onload = () => res(window.qrcode || null);
    s.onerror = () => { _qrLoad = null; res(null); };      // offline first run: card just has no QR
    document.head.appendChild(s);
  });
  return _qrLoad;
}
async function cardQR(source) {
  const lib = await qrLib(); if (!lib) return null;
  try { const q = lib(0, 'L'); q.addData(playLink(source || 'card', 'qr')); q.make(); return q; } catch (e) { return null; }
}
function cardDrawQR(g, q, x, y, S) {
  const n = q.getModuleCount(), pad = Math.round(S * 0.09), m = (S - pad * 2) / n;
  g.fillStyle = '#ffffff'; roundRect(g, x, y, S, S, Math.round(S * 0.09)); g.fill();
  g.fillStyle = CARD_BG;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (q.isDark(r, c)) g.fillRect(Math.floor(x + pad + c * m), Math.floor(y + pad + r * m), Math.ceil(m), Math.ceil(m));
  }
}
let _cardQR = null;   // set by buildCardBlob for the card being drawn; null = no room or offline
function cardFooter(g, H, line) {
  if (_cardQR && H - CARD_BODY >= 500) {
    const S = 176, x = 84, y = H - 80 - S, tx = x + S + 30, tw = CARD_W - 84 - tx;
    cardDrawQR(g, _cardQR, x, y, S);
    g.textAlign = 'left';
    g.fillStyle = CARD_INK; g.font = cardFont(40, 700); g.fillText(cardClip(g, 'Daylog · on Google Play', tw), tx, y + 58);
    g.fillStyle = CARD_DIM; g.font = cardFont(29, 500);
    g.fillText(cardClip(g, line || 'Private life tracker · no account, no cloud', tw), tx, y + 104);
    g.fillText(cardClip(g, 'Scan, or search “Daylog”', tw), tx, y + 146);
    return;
  }
  g.fillStyle = CARD_DIM; g.font = cardFont(30, 500); g.textAlign = 'center';
  g.fillText(line || 'Private life tracker · no account, no cloud', CARD_W / 2, H - 86);
  g.textAlign = 'left';
}

/* A big number with a label under it — the only pattern that reads at thumbnail size. */
function cardHero(g, y, value, label, colour) {
  g.textAlign = 'center';
  g.fillStyle = colour || CARD_INK; g.font = cardFont(232, 800);
  g.fillText(String(value), CARD_W / 2, y);
  g.fillStyle = CARD_DIM; g.font = cardFont(46, 600);
  g.fillText(label, CARD_W / 2, y + 74);
  g.textAlign = 'left';
  return y + 150;
}

/* '#3d4666' is "logged, but no mood recorded" — deliberately distinct from the unlogged
   '#1a2133'/'#1d2436' AND from every mood colour. The grids used to paint such days as
   mood 7 (a pleasant teal), which invented data the user never entered, on a card they
   might well post publicly. */
const CARD_NOMOOD = '#3d4666';
function moodColour(v) {
  if (v == null) return '#232a3d';
  const t = Math.max(1, Math.min(10, +v));
  const stops = [[1,'#e2574c'],[4,'#e9b53a'],[7,'#4ad6c0'],[10,'#6d8cff']];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t <= stops[i + 1][0]) return stops[t - stops[i][0] < stops[i + 1][0] - t ? i : i + 1][1];
  }
  return stops[stops.length - 1][1];
}

/* ---- the five designs ---- */
const CARD_KINDS = [
  { k: 'streak',  label: '🔥 Streak' },
  { k: 'pixels',  label: '🎨 Year' },
  { k: 'habit',   label: '✅ Habits' },
  { k: 'insight', label: '💡 Insight' },
  { k: 'award',   label: '🏆 Award' },
  { k: 'photos',  label: '📷 Photos' },
  { k: 'invite',  label: '💌 Invite' },
];

/* "October in photos": up to nine of a month's Log photos, spread across the month rather
   than the first nine. This month if it has four or more, otherwise the latest month that has
   any. The only card that carries the user's own pictures — the sheet says so before Share. */
async function cardPhotoSet() {
  const ph = [];
  _media.forEach(r => { if (r.kind === 'photo' && r.ctx === 'log') ph.push(r); });
  const cur = todayStr().slice(0, 7);
  if (!ph.length) return { ym: cur, bmps: [], total: 0 };
  const months = {};
  ph.forEach(r => (months[r.day.slice(0, 7)] = months[r.day.slice(0, 7)] || []).push(r));
  // This month once it has four; otherwise the latest month that does; otherwise the fullest.
  const keys = Object.keys(months).sort();
  const ym = (months[cur] && months[cur].length >= 4) ? cur
    : (keys.filter(k => months[k].length >= 4).pop() || keys.reduce((a, k) => months[k].length > months[a].length ? k : a, keys[0]));
  const all = months[ym].sort((a, b) => a.day.localeCompare(b.day) || a.ts - b.ts);
  const chosen = all.length <= 9 ? all : Array.from({ length: 9 }, (_, i) => all[Math.round(i * (all.length - 1) / 8)]);
  const bmps = [];
  for (const r of chosen) {
    // Decode SMALL: nine full 1600px photos is ~70 MB of bitmap on a phone with 3 GB.
    const k = 420 / Math.max(1, Math.min(r.w || 420, r.h || 420));
    try { bmps.push(await createImageBitmap(r.blob, { resizeWidth: Math.round((r.w || 420) * k), resizeHeight: Math.round((r.h || 420) * k), resizeQuality: 'medium' })); }
    catch (e) { try { if (r.thumb) bmps.push(await createImageBitmap(r.thumb)); } catch (e2) {} }
  }
  return { ym, bmps, total: all.length };
}
function drawPhotos(g, H, set) {
  set = set || { ym: todayStr().slice(0, 7), bmps: [], total: 0 };
  cardChrome(g, H, set.ym.slice(0, 4));
  const sh = bodyTop(H);
  g.textAlign = 'center'; g.fillStyle = CARD_INK; g.font = cardFont(76, 800);
  g.fillText(monthLong(set.ym) + ' in photos', CARD_W / 2, sh + 200);
  if (!set.bmps.length) {
    g.fillStyle = CARD_DIM; g.font = cardFont(40, 500);
    g.fillText('No photos yet — add one on the Log.', CARD_W / 2, sh + 640);
    cardFooter(g, H); return;
  }
  g.fillStyle = CARD_DIM; g.font = cardFont(36, 500);
  g.fillText(set.total + ' photo' + (set.total === 1 ? '' : 's') + (set.ym === todayStr().slice(0, 7) ? ' this month' : ''), CARD_W / 2, sh + 258);
  const n = set.bmps.length, cols = n === 4 || n === 2 ? 2 : n === 1 ? 1 : 3, rows = Math.ceil(n / cols), gap = 14;
  const availH = CARD_BODY - 300 - 150;
  const cell = Math.min((CARD_W - 168 - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows);
  const gridH = cell * rows + gap * (rows - 1);
  const gx = (CARD_W - (cell * cols + gap * (cols - 1))) / 2, gy = sh + 300 + Math.max(0, (availH - gridH) / 2);
  set.bmps.forEach((b, i) => {
    const x = gx + (i % cols) * (cell + gap), y = gy + Math.floor(i / cols) * (cell + gap);
    const s = Math.min(b.width, b.height);
    g.save(); roundRect(g, x, y, cell, cell, 22); g.clip();
    g.drawImage(b, (b.width - s) / 2, (b.height - s) / 2, s, s, x, y, cell, cell);
    g.restore();
    try { b.close(); } catch (e) {}
  });
  cardFooter(g, H, 'kept on my phone, nowhere else');
}

function inviteText(source) {
  return 'I use Daylog to keep track of my habits, mood and days. It is private: no account, no ads, '
    + 'and nothing gets uploaded. Free on Google Play: ' + playLink(source, 'invite');
}
/* "Tell a friend": what Daylog is, in four lines, and a big QR code. It says only what the
   app does, and the one personal line is a count the user can see right above Share. */
function drawInvite(g, H, q) {
  cardChrome(g, H, '');
  const sh = bodyTop(H), days = contentDates().length;
  g.textAlign = 'center';
  g.fillStyle = CARD_INK; g.font = cardFont(74, 800);
  g.fillText(days >= 7 ? `I've logged ${days} days` : 'My daily log', CARD_W / 2, sh + 250);
  g.fillStyle = CARD_DIM; g.font = cardFont(40, 500);
  g.fillText('in a private, offline life tracker', CARD_W / 2, sh + 312);
  const rows = [['✅', 'Habits, streaks and skip days'], ['😊', 'Mood, journal and voice notes'],
                ['📷', 'A photo a day, kept on the phone'], ['⏱️', 'Screen time, focus and time tracking']];
  g.textAlign = 'left'; g.font = cardFont(42, 600);
  const rx = 150;
  rows.forEach(([e, t], i) => {
    const y = sh + 430 + i * 82;
    g.fillStyle = CARD_INK; g.fillText(e, rx, y); g.fillText(cardClip(g, t, CARD_W - rx - 150 - 76), rx + 76, y);
  });
  const S = 330, qy = sh + 790;
  if (q) {
    cardDrawQR(g, q, (CARD_W - S) / 2, qy, S);
    g.textAlign = 'center'; g.fillStyle = CARD_INK; g.font = cardFont(40, 700);
    g.fillText('Scan to get Daylog on Google Play', CARD_W / 2, qy + S + 70);
  } else {
    g.textAlign = 'center'; g.fillStyle = CARD_INK; g.font = cardFont(52, 800);
    g.fillText('Search “Daylog” on Google Play', CARD_W / 2, qy + 160);
  }
  g.fillStyle = CARD_DIM; g.font = cardFont(30, 500); g.textAlign = 'center';
  g.fillText('No account · no ads · nothing uploaded', CARD_W / 2, H - 86);
  g.textAlign = 'left';
}

function drawStreak(g, H) {
  cardChrome(g, H, shortDate(todayStr()));
  const st = loggedStreak(), e = DB.entries();
  g.textAlign = 'center'; g.fillStyle = CARD_WARM; g.font = cardFont(120, 400);
  const sh = bodyTop(H);
  g.fillText('🔥', CARD_W / 2, sh + CARD_BODY * 0.175);
  let y = cardHero(g, sh + CARD_BODY * 0.335, st, st === 1 ? 'day logged' : 'day streak', CARD_WARM);

  // A 90-day dot grid is this card's stand-in for Strava's route line: a SHAPE, not a
  // fourth number. 18 x 5 lands exactly on 90 cells with no ragged final row.
  const cols = 18, cell = 42, gap = 11;
  const gw = cols * cell + (cols - 1) * gap, gx = (CARD_W - gw) / 2;
  let gy = y + 46;
  for (let i = 0; i < 90; i++) {
    const d = addDays(todayStr(), -(89 - i));
    const cx = gx + (i % cols) * (cell + gap), cy = gy + Math.floor(i / cols) * (cell + gap);
    const en = e[d];
    const mv = en && en.mood != null && en.mood !== '' ? +en.mood : null;
    g.fillStyle = en ? (mv != null ? moodColour(mv) : CARD_NOMOOD) : '#1d2436';
    roundRect(g, cx, cy, cell, cell, 12); g.fill();
  }
  gy += Math.ceil(90 / cols) * (cell + gap) + 44;
  g.fillStyle = CARD_DIM; g.font = cardFont(32, 500); g.textAlign = 'center';
  g.fillText('the last 90 days · colour is mood', CARD_W / 2, gy);

  // Two supporting numbers, no more. Four numbers on a card is a dashboard.
  const days = Object.keys(e).length;
  const done = Object.keys(e).reduce((n, d) => n + (e[d].habits
    ? Object.keys(e[d].habits).filter(k => hVal(e[d], k) === H_DONE).length : 0), 0);
  const sy = gy + 130;
  g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(150, sy - 78); g.lineTo(CARD_W - 150, sy - 78); g.stroke();
  const pair = (x, v, l) => {
    g.fillStyle = CARD_INK; g.font = cardFont(62, 800); g.fillText(v, x, sy);
    g.fillStyle = CARD_DIM; g.font = cardFont(30, 500); g.fillText(l, x, sy + 44);
  };
  pair(CARD_W * 0.31, days.toLocaleString(), 'days logged');
  pair(CARD_W * 0.69, done.toLocaleString(), 'habits ticked');
  cardFooter(g, H);
}

function drawPixels(g, H) {
  const yr = new Date().getFullYear();
  cardChrome(g, H, String(yr));
  const e = DB.entries();
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  g.textAlign = 'center'; g.fillStyle = CARD_INK; g.font = cardFont(66, 800);
  const sh = bodyTop(H);
  g.fillText('Year in pixels', CARD_W / 2, sh + CARD_BODY * 0.185);

  // 31 columns (days) x 12 rows (months) — the same shape the app itself draws, so the
  // card reads as Daylog and not a generic heatmap. The 53-week GitHub grid this replaced
  // was 1532px wide and ran straight off both edges of a 1080px card.
  const pad = 88, lab = 74, gap = 4;
  const cell = Math.floor((CARD_W - pad * 2 - lab - gap * 30) / 31);
  const gx = pad + lab, rowH = cell + gap + 3;
  const gy = sh + CARD_BODY * 0.235;
  let logged = 0, sum = 0, moodDays = 0;
  for (let mon = 0; mon < 12; mon++) {
    const ry = gy + mon * rowH;
    g.textAlign = 'right'; g.fillStyle = CARD_DIM; g.font = cardFont(24, 600);
    g.fillText(MON[mon], gx - 16, ry + cell - 3);
    for (let day = 1; day <= 31; day++) {
      if (new Date(yr, mon, day).getMonth() !== mon) continue;
      const ds = yr + '-' + String(mon + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      const en = e[ds];
      const m = en && en.mood != null && en.mood !== '' ? +en.mood : null;
      if (en) logged++;
      if (m != null) { sum += m; moodDays++; }
      g.fillStyle = en ? (m != null ? moodColour(m) : CARD_NOMOOD) : '#1a2133';
      roundRect(g, gx + (day - 1) * (cell + gap), ry, cell, cell, 5); g.fill();
    }
  }
  let y = gy + 12 * rowH + 56;
  g.fillStyle = CARD_DIM; g.font = cardFont(30, 500); g.textAlign = 'center';
  g.fillText('one square per day · colour is mood', CARD_W / 2, y);
  y = cardHero(g, y + 178, logged, logged === 1 ? 'day logged this year' : 'days logged this year', CARD_ACCENT);
  // Divide by the days that HAVE a mood, not by every logged day — mixing the two
  // understated the average for anyone who logs habits without rating their mood.
  if (moodDays) {
    g.fillStyle = CARD_INK; g.font = cardFont(40, 700); g.textAlign = 'center';
    g.fillText('average mood ' + (sum / moodDays).toFixed(1) + ' / 10', CARD_W / 2, y + 40);
  }
  cardFooter(g, H);
}

function drawHabit(g, H) {
  cardChrome(g, H, 'last 90 days');
  const cfg = habitCfg().filter(h => !h.hidden).slice(0, 6), e = DB.entries();
  g.textAlign = 'center'; g.fillStyle = CARD_INK; g.font = cardFont(66, 800);
  if (!cfg.length) {
    g.fillText('Habits', CARD_W / 2, H * 0.19);
    g.fillStyle = CARD_DIM; g.font = cardFont(42, 500);
    g.fillText('No habits set up yet.', CARD_W / 2, H / 2);
    cardFooter(g, H); return;
  }
  const sh = bodyTop(H);
  g.fillText('Habits', CARD_W / 2, sh + CARD_BODY * 0.19);

  const cols = 30, cell = 22, gap = 5;
  const gw = cols * (cell + gap) - gap, gx = (CARD_W - gw) / 2;
  let y = sh + CARD_BODY * 0.25;
  cfg.forEach(h => {
    let strength = 0; try { strength = Math.round(habitStrength(h.key)); } catch (er) {}
    g.textAlign = 'left'; g.fillStyle = CARD_INK; g.font = cardFont(38, 700);
    g.fillText(cardClip(g, (h.emoji ? h.emoji + '  ' : '') + h.label, gw - 130), gx, y);
    g.textAlign = 'right'; g.fillStyle = CARD_GOOD; g.font = cardFont(36, 700);
    g.fillText(strength + '%', gx + gw, y);
    y += 22;
    for (let i = 0; i < 90; i++) {
      const d = addDays(todayStr(), -(89 - i));
      const st = hVal(e[d], h.key);
      const cx = gx + (i % cols) * (cell + gap), cy = y + Math.floor(i / cols) * (cell + gap);
      g.fillStyle = st === H_DONE ? CARD_GOOD : st === H_SKIP ? '#38415c' : '#1a2133';
      roundRect(g, cx, cy, cell, cell, 6); g.fill();
    }
    y += 3 * (cell + gap) + 44;
  });
  cardFooter(g, H, 'green = done · grey = skipped, guilt-free');
}

function drawInsight(g, H) {
  cardChrome(g, H, 'what my own data says');
  let ps = []; try { ps = computePatterns() || []; } catch (e) {}
  /* Insight text is built as HTML, so a habit called "Gym & Run" arrives as "Gym &amp; Run".
     Canvas has no HTML parser — printing it raw put the entity on the card. Strip tags, then
     decode entities via the DOM, which handles every named and numeric form. */
  const strip = t => {
    const noTags = String(t || '').replace(/<[^>]*>/g, '');
    try { const d = document.createElement('textarea'); d.innerHTML = noTags; return d.value; }
    catch (e) { return noTags; }
  };
  g.textAlign = 'center'; g.fillStyle = CARD_INK; g.font = cardFont(62, 800);
  const sh = bodyTop(H);
  g.fillText('What I learned', CARD_W / 2, sh + CARD_BODY * 0.17);
  if (!ps.length) {
    g.fillStyle = CARD_DIM; g.font = cardFont(42, 500);
    g.fillText('Keep logging — patterns need a few weeks.', CARD_W / 2, H * 0.5);
    cardFooter(g, H); return;
  }

  // ONE headline insight, sized to its own text. The previous version used a fixed 250px
  // box for three insights, so every sub-line overflowed its card and the last one
  // collided with the footer. Measure, then draw.
  const top = ps[0];
  const boxW = CARD_W - 176, innerW = boxW - 120;
  const bx = 88; let by = sh + CARD_BODY * 0.235;
  g.font = cardFont(50, 700);
  const headL = cardLines(g, strip(top.head), innerW);
  g.font = cardFont(32, 400);
  const subL = cardLines(g, strip(top.sub), innerW).slice(0, 5);
  const boxH = 64 + headL.length * 62 + 20 + subL.length * 44 + 52;

  g.fillStyle = 'rgba(109,140,255,.10)';
  roundRect(g, bx, by, boxW, boxH, 32); g.fill();
  g.strokeStyle = CARD_ACCENT; g.lineWidth = 5;
  roundRect(g, bx, by, boxW, boxH, 32); g.stroke();
  g.fillStyle = CARD_INK; g.font = cardFont(50, 700);
  let ty = cardDrawLines(g, headL, CARD_W / 2, by + 106, 62, 'center');
  g.fillStyle = CARD_DIM; g.font = cardFont(32, 400);
  cardDrawLines(g, subL, CARD_W / 2, ty + 34, 44, 'center');
  by += boxH + 46;

  // The rest as single measured lines — they fit or they are not drawn at all.
  const room = sh + CARD_BODY - 190 - by;
  const maxMore = Math.max(0, Math.floor(room / 66));
  ps.slice(1, 1 + Math.min(4, maxMore)).forEach(p => {
    g.fillStyle = CARD_ACCENT; g.font = cardFont(34, 800); g.textAlign = 'left';
    g.fillText('·', bx + 18, by + 8);
    g.fillStyle = CARD_INK; g.font = cardFont(34, 600);
    g.fillText(cardClip(g, strip(p.head), boxW - 70), bx + 48, by + 8);
    by += 66;
  });
  cardFooter(g, H, 'measured on my own phone, not guessed');
}

function drawAward(g, H, id) {
  /* With no id passed, show the most recently EARNED award. `.slice(-1)` picked whatever sat
     last in AWARD_FAMILIES order — usually a low steps tier — not anything just achieved. */
  const all = awardList();
  const a = all.find(x => x.id === id) || all.filter(x => x.earned)
    .sort((p, q) => String(q.on || '').localeCompare(String(p.on || '')) || q.tier - p.tier)[0];
  cardChrome(g, H, a && a.on ? prettyDate(a.on) : '');
  if (!a) {
    g.textAlign = 'center'; g.fillStyle = CARD_DIM; g.font = cardFont(44, 500);
    g.fillText('No awards yet — keep logging.', CARD_W / 2, H / 2); cardFooter(g, H); return;
  }
  g.textAlign = 'center';
  const sh = bodyTop(H);
  g.font = cardFont(240, 400); g.fillText(a.ico, CARD_W / 2, sh + CARD_BODY * 0.36);
  g.fillStyle = CARD_DIM; g.font = cardFont(40, 600);
  g.fillText(a.title.toUpperCase(), CARD_W / 2, sh + CARD_BODY * 0.45);
  g.fillStyle = CARD_INK; g.font = cardFont(96, 800);
  cardWrap(g, awardName(a), CARD_W / 2, sh + CARD_BODY * 0.55, CARD_W - 220, 112, 'center');
  // the tier ladder, so the card shows a journey rather than a single trophy
  const fam = AWARD_FAMILIES.find(f => f.grp === a.grp);
  if (fam) {
    const done = fam.tiers.filter(t => t <= a.hi).length;
    const y = sh + CARD_BODY * 0.7, bw = CARD_W - 260;
    g.fillStyle = '#1d2436'; roundRect(g, 130, y, bw, 26, 13); g.fill();
    g.fillStyle = CARD_WARM;
    roundRect(g, 130, y, Math.max(26, bw * done / fam.tiers.length), 26, 13); g.fill();
    g.fillStyle = CARD_DIM; g.font = cardFont(34, 500);
    g.fillText(`tier ${done} of ${fam.tiers.length}`, CARD_W / 2, y + 74);
  }
  cardFooter(g, H);
}

async function buildCardBlob(kind, ratio, arg) {
  await cardFontsReady();
  const H = CARD_RATIOS[ratio] || CARD_RATIOS['9:16'];
  const cv = document.createElement('canvas');
  cv.width = CARD_W; cv.height = H;
  const g = cv.getContext('2d');
  g.textBaseline = 'alphabetic';
  const q = (kind === 'invite' || H - CARD_BODY >= 500) ? await cardQR(kind === 'invite' ? 'invite' : 'card') : null;
  const pset = kind === 'photos' ? await cardPhotoSet() : null;
  _cardQR = kind === 'invite' ? null : q;      // the invite draws its own, bigger one
  try {
    ({ streak: drawStreak, pixels: drawPixels, habit: drawHabit, insight: drawInsight,
       award: (gg, hh) => drawAward(gg, hh, arg), invite: (gg, hh) => drawInvite(gg, hh, q),
       photos: (gg, hh) => drawPhotos(gg, hh, pset) }[kind] || drawStreak)(g, H);
  } finally { _cardQR = null; }
  return await new Promise(res => {
    if (cv.toBlob) cv.toBlob(b => res(b), 'image/png');
    else res(null);
  });
}

/* ---------- Delivery ----------
   Four paths, best first. This ladder exists because Android WebView implements NO Web
   Share API — not Level 2 (files), not even Level 1 (text) — so the branch that works on
   every other platform is dead code inside our own shell. Verified, not assumed.
     1. native shareImage() through our own plugin  (needs the next native build)
     2. Web Share Level 2                            (Chrome/Safari on the open web)
     3. an <a download>                              (desktop browsers)
     4. an in-app viewer with long-press to save     (Android WebView today)
   The bitmap is what travels. The data never leaves the device on any of these paths. */
async function blobToB64(blob) {
  return await new Promise((res, rej) => {
    const r = new FileReader();
    // On failure r.result is null and String(null) is "null" — four characters of base64 that
    // decode to garbage and would be handed to the share sheet as an image. Reject instead,
    // so deliverCard falls through to the next rung rather than shipping a broken file.
    r.onerror = () => rej(new Error('read failed'));
    r.onabort = () => rej(new Error('read aborted'));
    r.onloadend = () => {
      if (r.result == null) { rej(new Error('empty read')); return; }
      const m = String(r.result).match(/^data:[^,]*,(.*)$/);
      if (!m || !m[1]) { rej(new Error('not a data url')); return; }
      res(m[1]);
    };
    try { r.readAsDataURL(blob); } catch (e) { rej(e); }
  });
}

/* The native rung of the delivery ladder. Present only in builds that ship SharePlugin.java,
   so this returns null on the open web AND in any installed app older than that build — the
   web layer reaches installed apps instantly but native code does not, so the two must be
   allowed to disagree about what exists. */
function nativeSharePlugin() {
  const p = window.Capacitor && Capacitor.Plugins;
  const sp = p && p.DaylogShare;
  return (sp && typeof sp.shareImage === 'function') ? sp : null;
}

async function deliverCard(blob, fname) {
  if (!blob) { toast('Could not build the card', true); return 'fail'; }

  const nat = nativeSharePlugin();
  if (nat) {
    try {
      const r = await nat.shareImage({ base64: await blobToB64(blob), filename: fname });
      if (r && r.ok !== false) return 'native';
    } catch (e) {}
  }

  try {
    const file = new File([blob], fname, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return 'webshare';
    }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }

  // Desktop browsers: a real download. A Capacitor WebView swallows this, which is
  // exactly why path 4 exists rather than us pretending this one always works.
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fname; document.body.appendChild(a);
    a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 20000);
    if (!nativeShell()) { toast('Card saved to your downloads'); return 'download'; }
  } catch (e) {}

  return 'viewer';
}

/* ---------- Share sheet ---------- */
function shareSheetOpen(kind, arg) {
  cardState.kind = kind || 'streak';
  cardState.arg = arg || null;
  cardState.hint = '';                              // never show a stale instruction
  cardState.sending = false;
  let el = document.getElementById('sharesheet');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sharesheet'; el.className = 'sharesheet';
    document.body.appendChild(el);
  }
  el.classList.add('on');
  shareSheetRender();
  cardPreview();
}

function shareSheetClose() {
  const el = document.getElementById('sharesheet');
  if (el) el.classList.remove('on');
  cardSeq++;                                        // invalidate anything still rendering
  if (cardState.url) { try { URL.revokeObjectURL(cardState.url); } catch (e) {} cardState.url = null; }
  cardState.blob = null; cardState.busy = false; cardState.hint = '';
}

function shareSheetRender() {
  const el = document.getElementById('sharesheet');
  if (!el) return;
  el.innerHTML = `<div class="ss-inner">
    <div class="ss-head">
      <span>Share card</span>
      <button type="button" class="ss-x" id="ss-close" aria-label="Close">✕</button>
    </div>
    ${/* Keep the PREVIOUS image on screen, dimmed, with a spinner over it. Clearing to a
           bare "Rendering…" for several seconds on a mid-range phone reads as broken — the
           user taps another chip, which supersedes the render, and it never seems to
           finish. Showing the outgoing card plus visible motion makes the wait legible. */''}
    <div class="ss-stage"><div class="ss-canvas${cardState.busy ? ' busy' : ''}" id="ss-stage">
      ${cardState.url ? `<img src="${cardState.url}" alt="Your share card">`
        : `<div class="ss-load"><span class="ss-spin"></span><span>Drawing your card…</span></div>`}
      ${cardState.busy && cardState.url ? '<div class="ss-veil"><span class="ss-spin"></span></div>' : ''}
    </div></div>
    <div class="ss-pick">${CARD_KINDS.map(c => `<button type="button"
      class="ss-chip ${cardState.kind === c.k ? 'on' : ''}${cardState.kind === c.k && cardState.busy ? ' loading' : ''}"
      data-card-kind="${c.k}">${c.label}</button>`).join('')}</div>
    <div class="ss-pick">${Object.keys(CARD_RATIOS).map(r => `<button type="button"
      class="ss-chip ${cardState.ratio === r ? 'on' : ''}" data-card-ratio="${r}">${r === '4:5' ? 'Post 4:5' : 'Story 9:16'}</button>`).join('')}</div>
    <div class="ss-acts">
      <button type="button" class="btn btn-primary" id="ss-send" ${cardState.busy ? 'disabled' : ''}>
        ${cardState.busy ? 'Drawing…' : (nativeSharePlugin() || navigator.canShare ? 'Share' : 'Save image')}</button>
    </div>
    ${cardState.kind === 'invite' ? `<div class="ss-links">
      <button type="button" class="btn btn-ghost" id="ss-wa">Send the link on WhatsApp</button>
      <button type="button" class="btn btn-ghost" id="ss-copy">Copy link</button></div>` : ''}
    ${cardState.hint ? `<div class="ss-hint">${escapeHtml(cardState.hint)}</div>` : ''}
    <div class="hint ss-note">${cardState.kind === 'invite' ? 'The card and the link say nothing about your entries.'
      : cardState.kind === 'photos' ? '<b>This card shows your own photos.</b> Look through it before you share it.'
      : 'Only the picture is shared. Your entries never leave the phone.'}</div>
  </div>`;
}

/* Monotonic token. The old `if (cardState.busy) return` DROPPED the newest request instead
   of the oldest, so tapping two design chips quickly left the first card in cardState while
   the chips showed the second — and Share then exported a card the user had not chosen. A
   token means the last request always wins and every stale result is discarded. */
let cardSeq = 0;
async function cardPreview() {
  const my = ++cardSeq;
  cardState.busy = true;
  /* The BLOB is cleared straight away so Share can never send the previous card (that was a
     real defect). The preview IMAGE deliberately stays until the new one is ready, dimmed
     under a spinner — clearing it left a blank panel for several seconds, which is what made
     switching designs look like nothing was happening. */
  cardState.blob = null;
  const stale = cardState.url;
  shareSheetRender();

  /* Yield twice so the spinner actually paints before buildCardBlob monopolises the main
     thread. Without this the "busy" state is queued behind the very work it is meant to
     announce, and the user sees nothing change for seconds. */
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (my !== cardSeq) return;

  let blob = null;
  try { blob = await buildCardBlob(cardState.kind, cardState.ratio, cardState.arg); } catch (e) {}
  if (my !== cardSeq) return;                       // superseded — drop this result entirely

  const el = document.getElementById('sharesheet');
  if (!el || !el.classList.contains('on')) {
    // Closed while rendering. Do not create an object URL nothing will revoke, do not
    // repaint hidden markup, and release the outgoing preview we were holding on to.
    if (stale) { try { URL.revokeObjectURL(stale); } catch (e) {} }
    cardState.blob = null; cardState.url = null; cardState.busy = false;
    return;
  }
  cardState.blob = blob;
  cardState.url = blob ? URL.createObjectURL(blob) : null;
  if (stale) { try { URL.revokeObjectURL(stale); } catch (e) {} }   // only now is it safe
  cardState.busy = false;
  shareSheetRender();
}

document.addEventListener('click', async (ev) => {
  const t = ev.target;
  if (!t || !t.closest) return;

  const aw = t.closest('[data-aw-share]');
  if (aw) {
    const ms = document.getElementById('milestone'); if (ms) ms.classList.remove('on');
    shareSheetOpen('award', aw.dataset.awShare); buzz(10); return;
  }

  const sh = t.closest('[data-share-card]');
  if (sh) { shareSheetOpen(sh.dataset.shareCard || 'streak'); buzz(10); return; }

  if (t.id === 'ss-close' || t.id === 'sharesheet') { shareSheetClose(); return; }
  if (t.id === 'ss-wa') {
    // wa.me is an Android App Link: the shell hands it to WhatsApp, or the browser if absent.
    const url = 'https://wa.me/?text=' + encodeURIComponent(inviteText('whatsapp'));
    try { if (window.Capacitor) window.location.href = url; else window.open(url, '_blank', 'noopener'); } catch (e) {}
    return;
  }
  if (t.id === 'ss-copy') {
    const txt = inviteText('copy');
    try { await navigator.clipboard.writeText(txt); toast('Copied — paste it to a friend'); }
    catch (e) { showCopyModal('Daylog invite', txt); }
    return;
  }

  const kb = t.closest('[data-card-kind]');
  if (kb) { cardState.kind = kb.dataset.cardKind; shareSheetRender(); cardPreview(); return; }

  const rb = t.closest('[data-card-ratio]');
  if (rb) { cardState.ratio = rb.dataset.cardRatio; safeSet('dp.cardratio', JSON.stringify(cardState.ratio)); shareSheetRender(); cardPreview(); return; }

  if (t.id === 'ss-send') {
    // Re-entrancy guard: deliverCard awaits, and a second tap during that await fired a
    // second share whose result then overwrote the first one's outcome.
    if (cardState.sending) return;
    if (cardState.busy || !cardState.blob) { toast('Still rendering — one second', true); return; }
    cardState.sending = true;
    const sent = cardState.blob;                    // pin it; a chip tap could swap it mid-await
    try {
      const name = 'daylog-' + cardState.kind + '-' + todayStr() + '.png';
      const how = await deliverCard(sent, name);
      if (how === 'viewer') {
        /* The last rung. Inside the Capacitor shell there is no share sheet and no download,
           so the image stays on screen and the instruction has to stay with it — a toast is
           invisible under the sheet and gone in two seconds. Persist it in the sheet itself. */
        cardState.hint = 'Saving needs the next app update. For now, screenshot this card.';
        shareSheetRender();
        toast('Screenshot the card to keep it');
      } else if (how !== 'cancel' && how !== 'fail') { buzz(14); shareSheetClose(); }
    } finally { cardState.sending = false; }
    return;
  }
});

function alarmHealthHTML() {
  if (!nativeShell()) return '';
  const h = alarmHealth();
  /* Verify in the background every time this renders: the cached value can be minutes or
     days old, and showing a warning for something already fixed is worse than showing
     nothing. recheckAlarmHealth() redraws only if the answer actually changed. */
  setTimeout(() => { try { recheckAlarmHealth(); } catch (e) {} }, 0);
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
    toast('Turn it on, then come back — this updates itself');
    /* Belt and braces for shells where visibilitychange does not fire on return from a
       system settings page. Cheap, and the alternative is a stale warning. */
    [1200, 3000, 6000].forEach(ms => setTimeout(() => { try { recheckAlarmHealth(); } catch (e) {} }, ms));
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
/* Every notification this app posts uses the same monochrome pulse icon. Android masks the
   small icon to its alpha channel, so the launcher icon came out as a tinted blob and the
   default fallback was Android's generic "i" — which is what users were actually seeing. */
const NOTIF_ICON = 'ic_stat_daylog';

/* Present only in builds that ship TimerNotifPlugin.java. */
function timerPlugin() {
  const p = window.Capacitor && Capacitor.Plugins;
  const t = p && p.DaylogTimer;
  return (t && typeof t.show === 'function') ? t : null;
}

async function refreshTimerNotif() {
  if (!nativeShell()) return;
  const run = runningSeg();
  const pausedId = localStorage.getItem('dp.pausedAct');

  /* The native plugin renders a LIVE counter: setUsesChronometer + setWhen means Android
     itself ticks it, so it keeps counting with the app backgrounded or killed. The old
     Capacitor path baked "Running since 12:23" into the body as a string, which never moved
     — and could not, because JS is suspended exactly when the notification is being read. */
  const T = timerPlugin();
  if (T) {
    try {
      if (run) {
        const act = actById(run.act);
        await T.show({ title: `${act.emoji} ${act.name}`, startMillis: run.start, paused: false });
      } else if (pausedId) {
        const act = actById(pausedId);
        await T.show({ title: `${act.emoji} ${act.name}`, startMillis: Date.now(), paused: true });
      } else {
        await T.hide();
      }
      return;
    } catch (e) { /* fall through to the Capacitor path below */ }
  }

  // Older installs without the plugin keep the previous behaviour rather than nothing.
  const LN = window.Capacitor.Plugins.LocalNotifications;
  await setupTimerNotif();
  try {
    if (run) {
      const act = actById(run.act);
      await LN.schedule({ notifications: [{
        id: TIMER_NOTIF_ID, title: `${act.emoji} ${act.name} — timing`,
        body: `Running since ${fmtClock(run.start)} · tap Pause or Stop`,
        smallIcon: NOTIF_ICON,
        actionTypeId: 'dp_running', ongoing: true, autoCancel: false,
        schedule: { at: new Date(Date.now() + 300) } }] });
    } else if (pausedId) {
      const act = actById(pausedId);
      await LN.schedule({ notifications: [{
        id: TIMER_NOTIF_ID, title: `⏸ ${act.emoji} ${act.name} — paused`,
        body: 'Tap Resume to continue timing',
        smallIcon: NOTIF_ICON,
        actionTypeId: 'dp_paused', ongoing: true, autoCancel: false,
        schedule: { at: new Date(Date.now() + 300) } }] });
    } else {
      await LN.cancel({ notifications: [{ id: TIMER_NOTIF_ID }] });
    }
  } catch (e) {}
}

/* Buttons tapped while the web layer was not running are recorded natively; apply them the
   moment we are alive again, so a Pause from the lock screen is not silently lost. */
async function drainTimerAction() {
  const T = timerPlugin();
  if (!T || typeof T.consumeAction !== 'function') return;
  let a = '';
  try { a = (await T.consumeAction()).action || ''; } catch (e) { return; }
  if (!a) return;
  const r = runningSeg();
  if (a === 'stop') { if (r) startAct(r.act); localStorage.removeItem('dp.pausedAct'); }
  else if (a === 'pause') { if (r) { localStorage.setItem('dp.pausedAct', r.act); startAct(r.act); } }
  else if (a === 'resume') { const pa = localStorage.getItem('dp.pausedAct');
    localStorage.removeItem('dp.pausedAct'); if (pa) startAct(pa); }
  refreshTimerNotif();
  try { if (document.getElementById('s-time').classList.contains('on')) renderTime(); } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) drainTimerAction(); });

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
/* The one re-engagement notification in the app. Two rules it now follows, because it
   previously broke both:
     - NO LOSS FRAMING. "a 60-second log keeps your streak alive 🔥" is exactly the
       streak-insurance nudge this project's own rules refuse, and the test that enforces
       that rule only ever checked the fresh-start copy. It now states a fact and offers,
       rather than warning you about something you are about to lose.
     - IT CAN BE TURNED OFF, from Settings, without digging through Android's notification
       channels. A nudge with no off switch is not a nudge. */
async function scheduleInactivityReminder() {
  if (!nativeShell()) return;
  const LN = window.Capacitor.Plugins.LocalNotifications;
  try {
    await LN.cancel({ notifications: [{ id: INACTIVITY_ID }] });
    if (localStorage.getItem('dp.nudgeOff') === '1') return;
    const fireDay = addDays(lastActiveDay(), 2);            // 2 clear days later
    const at = new Date(fireDay + 'T20:00:00');
    if (at.getTime() <= Date.now() + 60000) return;         // already past → nothing to schedule
    await LN.schedule({ notifications: [{
      id: INACTIVITY_ID, title: 'Daylog',
      body: "Two days since your last entry. A minute is enough, whenever you feel like it.",
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

/* ============================================================
   PROJECTS — a portfolio hub wired to time you actually logged.
   ------------------------------------------------------------
   The point of difference from every other project tracker: hours here are not typed in by
   hand and they are not guessed from "activities that look related". A time block counts
   toward a project ONLY if it carries that project's id in `pid`. Two projects that both use
   the "work" activity therefore never claim the same hours, and a project with no tagged
   blocks honestly reports "no time logged yet" rather than a comforting zero.

   Tag time three ways: ▶ Start timing from the project, the project picker on the
   post-activity save sheet, or the picker on any block in the timeline.

   Everything is derived, never stored: progress, hours, last-touched, stalled, overdue. So
   editing a step or logging an hour updates every number at once and none can drift.
   ============================================================ */

const PJ_STATUS = [
  { k: 'planning', label: 'Planning' },
  { k: 'active',   label: 'In progress' },
  { k: 'paused',   label: 'Paused' },
  { k: 'done',     label: 'Done' },
];
/* Same validated series hues the Stats overview uses — a lightness band and chroma floor that
   stay distinguishable from each other in both themes and under the common CVD types. */
const PJ_COLORS = ['#5570dd', '#26a892', '#7f63dd', '#dd7a3c', '#c8489a', '#3c9dd6', '#c9a227', '#5f6b85'];
const PJ_PRIO = { 3: 'High', 2: 'Normal', 1: 'Low' };
const PJ_STALE_DAYS = 7;      // an active project untouched this long is flagged, not hidden
const PJ_SPARK_WEEKS = 8;

let pjOpen = null;            // project id shown in the detail view, or null for the list
let pjFilter = 'open';        // open | active | planning | paused | done | all
let pjSort = 'smart';
let pjAddOpen = false;

/* ---- store ---- */
function pjNorm(p) {
  const o = Object.assign({
    id: 'pj0', name: '', outcome: '', status: 'active', prio: 2, color: PJ_COLORS[0],
    created: todayStr(), due: '', act: '', steps: [], miles: [], notes: [], links: [],
  }, p || {});
  ['steps', 'miles', 'notes', 'links'].forEach(k => { if (!Array.isArray(o[k])) o[k] = []; });
  if (!PJ_STATUS.find(s => s.k === o.status)) o.status = 'active';
  o.prio = [1, 2, 3].includes(+o.prio) ? +o.prio : 2;
  return o;
}
function pjAll() { return DB.projects().map(pjNorm); }
function pjById(id) { return pjAll().find(p => p.id === id) || null; }
function pjPut(p) {
  const all = DB.projects(); const i = all.findIndex(x => x.id === p.id);
  if (i >= 0) all[i] = p; else all.push(p);
  DB.saveProjects(all);
}
function pjMutate(id, fn) { const p = pjById(id); if (!p) return null; fn(p); pjPut(p); return p; }

/* ---- time, from tagged blocks only ---- */
function pjBlocks(id) { return DB.timelog().filter(s => s.pid === id); }
function pjMs(id, fromMs, toMs) {
  const now = Date.now();
  const lo = fromMs == null ? -Infinity : fromMs, hi = toMs == null ? Infinity : toMs;
  return pjBlocks(id).reduce((acc, s) => {
    const end = s.end == null ? now : s.end;          // a running block counts up to now
    return acc + Math.max(0, Math.min(end, hi) - Math.max(s.start, lo));
  }, 0);
}
/* Monday-start week boundaries by real date arithmetic, not ms multiples — adding
   7*86400000 across a DST change lands an hour off and silently shifts a week's hours. */
function pjWeekStartDate(back) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * (back || 0));
  return d;
}
function pjWeekMs(id, back) {
  const a = pjWeekStartDate(back), b = new Date(a); b.setDate(b.getDate() + 7);
  return pjMs(id, a.getTime(), b.getTime());
}
function pjWeeks(id, n) {
  const out = [];
  for (let i = (n || PJ_SPARK_WEEKS) - 1; i >= 0; i--) out.push(+(pjWeekMs(id, i) / 3600000).toFixed(2));
  return out;
}

/* ---- derived state ---- */
function pjProgress(p) {
  const items = (p.steps || []).concat(p.miles || []);
  if (!items.length) return null;      // no plan yet is NOT 0% — don't invent a denominator
  const done = items.filter(x => x.done).length;
  return { done, tot: items.length, pct: Math.round(done * 100 / items.length) };
}
function pjLastMs(p) {
  let last = 0;
  pjBlocks(p.id).forEach(s => { const b = s.end == null ? Date.now() : s.end; if (b > last) last = b; });
  (p.steps || []).concat(p.miles || []).forEach(x => { if (x.doneAt > last) last = x.doneAt; });
  (p.notes || []).forEach(n => { if (n.at > last) last = n.at; });
  return last;
}
function pjDaysIdle(p) { const l = pjLastMs(p); return l ? Math.floor((Date.now() - l) / 86400000) : null; }
function pjDaysToDue(p) {
  if (!p.due) return null;
  return Math.round((new Date(p.due + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000);
}
/* One badge per project, worst-first. Order matters: an overdue project is overdue even if it
   was touched this morning, and a stalled one is stalled even if nothing is due. */
function pjHealth(p) {
  if (p.status === 'done') return { k: 'done', label: 'Done', cls: 'ok' };
  const pr = pjProgress(p);
  const openWork = !pr || pr.done < pr.tot;
  const dd = pjDaysToDue(p);
  if (p.status !== 'paused' && dd != null && dd < 0 && openWork)
    return { k: 'overdue', label: `${-dd}d overdue`, cls: 'bad' };
  if (p.status === 'paused') return { k: 'paused', label: 'Paused', cls: 'mute' };
  if (dd != null && dd <= 3 && openWork)
    return { k: 'due', label: dd === 0 ? 'Due today' : `Due in ${dd}d`, cls: 'warn' };
  const idle = pjDaysIdle(p);
  if (p.status === 'active' && openWork && idle != null && idle >= PJ_STALE_DAYS)
    return { k: 'stalled', label: `Untouched ${idle}d`, cls: 'warn' };
  if (p.status === 'active' && openWork && idle == null)
    return { k: 'new', label: 'Not started', cls: 'mute' };
  if (p.status === 'planning') return { k: 'planning', label: 'Planning', cls: 'mute' };
  return { k: 'on', label: 'On track', cls: 'ok' };
}
function pjNextItem(p) {
  const m = (p.miles || []).filter(x => !x.done).sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1)[0];
  if (m) return { kind: 'Milestone', text: m.text, due: m.due };
  const s = (p.steps || []).find(x => !x.done);
  return s ? { kind: 'Next step', text: s.text, due: s.due } : null;
}
function pjNeedsAttention() {
  return pjAll().filter(p => ['overdue', 'due', 'stalled'].includes(pjHealth(p).k));
}

/* ---- list ordering ---- */
const PJ_SORTS = [
  { k: 'smart',  label: 'Needs me' },
  { k: 'due',    label: 'Due date' },
  { k: 'hours',  label: 'Hours' },
  { k: 'prog',   label: 'Progress' },
  { k: 'name',   label: 'A–Z' },
];
function pjSorted(list) {
  const rank = { overdue: 0, due: 1, stalled: 2, on: 3, new: 4, planning: 5, paused: 6, done: 7 };
  const arr = list.slice();
  if (pjSort === 'smart') {
    arr.sort((a, b) => (rank[pjHealth(a).k] - rank[pjHealth(b).k]) || (b.prio - a.prio) ||
      ((pjDaysIdle(b) || 0) - (pjDaysIdle(a) || 0)));
  } else if (pjSort === 'due') {
    arr.sort((a, b) => (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99') || (b.prio - a.prio));
  } else if (pjSort === 'hours') {
    arr.sort((a, b) => pjMs(b.id) - pjMs(a.id));
  } else if (pjSort === 'prog') {
    arr.sort((a, b) => ((pjProgress(b) || {}).pct || 0) - ((pjProgress(a) || {}).pct || 0));
  } else {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  }
  return arr;
}
function pjFiltered() {
  const all = pjAll();
  if (pjFilter === 'all') return pjSorted(all);
  if (pjFilter === 'open') return pjSorted(all.filter(p => p.status !== 'done'));
  return pjSorted(all.filter(p => p.status === pjFilter));
}

/* ---- bits of markup ---- */
function pjHrs(ms) { return ms >= 3600000 ? fmtDur(ms) : (ms > 0 ? fmtDur(ms, true) : '—'); }
function pjBadge(h) { return `<span class="pj-badge ${h.cls}">${escapeHtml(h.label)}</span>`; }
function pjBar(p) {
  const pr = pjProgress(p);
  if (!pr) return `<div class="pj-noplan">No steps yet — add the first one to track progress</div>`;
  return `<div class="pj-bar" role="img" aria-label="${pr.done} of ${pr.tot} done">
      <i style="width:${pr.pct}%;background:${p.color}"></i></div>
    <div class="pj-bar-l"><b>${pr.pct}%</b> · ${pr.done} of ${pr.tot} done</div>`;
}
function pjCard(p) {
  const h = pjHealth(p), wk = pjWeekMs(p.id), tot = pjMs(p.id), nx = pjNextItem(p);
  const idle = pjDaysIdle(p);
  return `<button class="pj-card" data-pj-open="${p.id}" style="--pj:${p.color}">
    <div class="pj-card-top">
      <span class="pj-name">${escapeHtml(p.name)}</span>
      ${pjBadge(h)}
    </div>
    ${p.outcome ? `<div class="pj-outcome">${escapeHtml(p.outcome)}</div>` : ''}
    ${pjBar(p)}
    <div class="pj-meta">
      <span>${wk > 0 ? `<b>${pjHrs(wk)}</b> this week` : (tot > 0 ? `<b>${pjHrs(tot)}</b> total` : 'No time logged')}</span>
      <span>${idle == null ? 'never touched' : idle === 0 ? 'touched today' : `${idle}d ago`}</span>
    </div>
    ${nx ? `<div class="pj-next"><span class="pj-next-k">${nx.kind}</span> ${escapeHtml(nx.text)}${nx.due ? ` <span class="pj-next-d">· ${shortDate(nx.due)}</span>` : ''}</div>` : ''}
  </button>`;
}

/* ---- the screen ---- */
function renderProjects() {
  const el = document.getElementById('s-projects');
  if (!el) return;
  document.getElementById('screen-title').textContent = 'Projects';
  if (pjOpen && pjById(pjOpen)) return pjRenderDetail(el);
  pjOpen = null;

  const all = pjAll();
  const open = all.filter(p => p.status !== 'done');
  const attn = pjNeedsAttention();
  const weekMs = all.reduce((a, p) => a + pjWeekMs(p.id), 0);
  document.getElementById('screen-sub').textContent =
    all.length ? `${open.length} open · ${all.length - open.length} done` : 'nothing yet';

  const counts = { open: open.length, all: all.length };
  PJ_STATUS.forEach(s => counts[s.k] = all.filter(p => p.status === s.k).length);
  const tabs = [{ k: 'open', label: 'Open' }].concat(PJ_STATUS.map(s => ({ k: s.k, label: s.label })));
  const list = pjFiltered();

  el.innerHTML = `
    ${all.length ? `<div class="card pj-hero">
      <div class="pj-hero-row">
        <div class="pj-hero-cell"><div class="pj-hero-n">${open.length}</div><div class="pj-hero-l">open</div></div>
        <div class="pj-hero-cell"><div class="pj-hero-n">${weekMs > 0 ? pjHrs(weekMs) : '—'}</div><div class="pj-hero-l">logged this week</div></div>
        <div class="pj-hero-cell ${attn.length ? 'hot' : ''}"><div class="pj-hero-n">${attn.length}</div><div class="pj-hero-l">need you</div></div>
      </div>
      ${attn.length ? `<div class="pj-attn">${attn.slice(0, 4).map(p =>
        `<button class="pj-attn-row" data-pj-open="${p.id}"><span class="pj-dot" style="background:${p.color}"></span>
          <span class="pj-attn-n">${escapeHtml(p.name)}</span>${pjBadge(pjHealth(p))}</button>`).join('')}</div>`
      : `<div class="pj-allgood">Nothing overdue, nothing stalled 🎉</div>`}
    </div>` : ''}

    <div class="card">
      ${pjAddOpen ? `
        <h2>New project</h2>
        <div class="field"><label>Name</label><input type="text" id="pj-new-name" placeholder="e.g. Ship Daylog v3" autocomplete="off"></div>
        <div class="field"><label>What does done look like? <span class="hint">(optional)</span></label>
          <input type="text" id="pj-new-outcome" placeholder="e.g. 500 installs and a 4★ rating"></div>
        <div class="pj-row2">
          <div class="field"><label>Status</label><select id="pj-new-status">${PJ_STATUS.filter(s => s.k !== 'done').map(s => `<option value="${s.k}"${s.k === 'active' ? ' selected' : ''}>${s.label}</option>`).join('')}</select></div>
          <div class="field"><label>Target date <span class="hint">(optional)</span></label><input type="date" id="pj-new-due"></div>
        </div>
        <div class="pj-btns"><button class="btn btn-primary btn-sm" id="pj-create">Create project</button>
          <button class="btn btn-ghost btn-sm" id="pj-create-cancel">Cancel</button></div>
      ` : `<button class="btn btn-primary" id="pj-add-open" style="width:100%">＋ New project</button>`}
    </div>

    ${all.length ? `<div class="card" style="padding:12px 12px 8px">
      <div class="seg-row">${tabs.map(t => `<button class="seg-btn ${pjFilter === t.k ? 'on' : ''}" data-pj-filter="${t.k}">${t.label}${counts[t.k] ? ` <span class="pj-c">${counts[t.k]}</span>` : ''}</button>`).join('')}</div>
      <div class="pj-sort">Sort ${PJ_SORTS.map(s => `<button class="pj-sortb ${pjSort === s.k ? 'on' : ''}" data-pj-sort="${s.k}">${s.label}</button>`).join('')}</div>
    </div>` : ''}

    <div class="pj-list">${list.length ? list.map(pjCard).join('')
      : `<div class="card"><div class="empty">${all.length ? 'Nothing in this filter.' : 'No projects yet.<br><br>A project is anything with an outcome and more than one step — a launch, a renovation, a course, a side business. Create one above, then tag your logged time to it to see where the hours really go.'}</div></div>`}</div>`;
}

/* ---- detail ---- */
function pjRenderDetail(el) {
  const p = pjById(pjOpen);
  const h = pjHealth(p), pr = pjProgress(p);
  const tot = pjMs(p.id), wk = pjWeekMs(p.id), weeks = pjWeeks(p.id, PJ_SPARK_WEEKS);
  const idle = pjDaysIdle(p), dd = pjDaysToDue(p);
  const run = runningSeg();
  const running = run && run.pid === p.id;
  const blocks = pjBlocks(p.id).slice().sort((a, b) => b.start - a.start).slice(0, 6);
  document.getElementById('screen-sub').textContent = h.label;

  el.innerHTML = `
    <button class="back-btn" id="pj-back">← All projects</button>

    <div class="card pj-head" style="--pj:${p.color}">
      <input type="text" class="pj-title-in" data-pj-field="name" value="${escapeHtml(p.name)}" placeholder="Project name">
      <input type="text" class="pj-out-in" data-pj-field="outcome" value="${escapeHtml(p.outcome)}" placeholder="What does done look like?">
      <div class="pj-chips">${pjBadge(h)}
        <span class="pj-chip">${PJ_PRIO[p.prio]} priority</span>
        ${p.due ? `<span class="pj-chip">${dd < 0 ? `${-dd}d overdue` : `${shortDate(p.due)}`}</span>` : ''}
        <span class="pj-chip">since ${shortDate(p.created)}</span></div>
      ${pjBar(p)}
    </div>

    <div class="card">
      <h2>⏱ Time on this project</h2>
      ${tot > 0 ? `<div class="pj-time-row">
          <div class="pj-time-cell"><div class="pj-time-n">${pjHrs(tot)}</div><div class="pj-hero-l">total</div></div>
          <div class="pj-time-cell"><div class="pj-time-n">${pjHrs(wk)}</div><div class="pj-hero-l">this week</div></div>
          <div class="pj-time-cell">${sparkline(weeks, 'mood', 96, 30)}<div class="pj-hero-l">${PJ_SPARK_WEEKS} weeks</div></div>
        </div>`
        : `<div class="pj-noplan">No time tagged to this project yet. Start the timer below, or tap any block on the Time screen and assign it here.</div>`}
      ${/* No activity picker: time on a project is logged AS the project, not under a
             borrowed tag. It appears on the timeline, in the legend and in the breakdown as
             🗂️ <the project name> in the project's own colour. */''}
      <button class="btn ${running ? 'pj-stop' : 'btn-primary'}" id="pj-timer" style="width:100%">${running ? '⏹ Stop timing' : '▶ Start timing this project'}</button>
      <div class="hint" style="margin-top:8px">Logs to your 24-hour timeline as <b>🗂️ ${escapeHtml(p.name)}</b>. Tracked something under a normal activity instead? Tap that block on the Time screen and assign it here.</div>
      ${blocks.length ? `<div class="pj-blocks">${blocks.map(s => `<div class="pj-block">
          <span>${actById(s.act).emoji || ''} ${escapeHtml(s.t || actById(s.act).name)}</span>
          <span class="pj-block-d">${shortDate(todayStr(new Date(s.start)))} · ${s.end == null ? 'running' : fmtDur(s.end - s.start, true)}</span>
        </div>`).join('')}</div>` : ''}
    </div>

    <div class="card">
      <h2>🚩 Milestones <span class="hint">${(p.miles || []).filter(x => x.done).length}/${(p.miles || []).length}</span></h2>
      ${(p.miles || []).length ? `<div class="pj-items">${p.miles.map(m => pjItemRow(p, m, 'miles')).join('')}</div>` : ''}
      <div class="pj-add-h">Add a milestone</div>
      ${/* Text, date and Add on one flex row squeezed the text field to 39px at 320px wide —
             unusable. The name gets its own row; the date and button share the next. */''}
      <div class="pj-mile-form">
        <input type="text" id="pj-mile-in" placeholder="e.g. Beta with 10 testers" autocomplete="off">
        <div class="pj-mile-form-row">
          <input type="date" id="pj-mile-due" aria-label="milestone target date">
          <button class="btn btn-primary btn-sm" id="pj-mile-add">Add</button></div>
      </div>
      <div class="hint" style="margin-top:8px">Milestones are the few outcomes that matter. Steps below are the work.</div>
    </div>

    <div class="card">
      <h2>✅ Steps <span class="hint">${(p.steps || []).filter(x => x.done).length}/${(p.steps || []).length}</span></h2>
      ${(p.steps || []).length ? `<div class="pj-items">${p.steps.map(s => pjItemRow(p, s, 'steps')).join('')}</div>` : ''}
      <div class="pj-add-h">Add a step</div>
      <div class="task-add"><input type="text" id="pj-step-in" placeholder="Next concrete thing to do…" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="pj-step-add">Add</button></div>
      ${(p.steps || []).some(x => !x.done) ? `<div class="hint" style="margin-top:8px">Tap <b>↗</b> on any step to drop it into today's tasks.</div>` : ''}
    </div>

    <div class="card">
      <h2>📓 Log <span class="hint">${(p.notes || []).length}</span></h2>
      ${(p.notes || []).length ? `<div class="pj-notes">${p.notes.slice().sort((a, b) => b.at - a.at).map(n => `
        <div class="pj-note"><div class="pj-note-h">${shortDate(todayStr(new Date(n.at)))}
          <button class="del" data-pj-note-del="${n.id}">×</button></div>
          <div class="pj-note-t">${escapeHtml(n.text)}</div></div>`).join('')}</div>` : ''}
      <div class="pj-add-h">Add an entry</div>
      <div class="task-add"><input type="text" id="pj-note-in" placeholder="Decision, blocker, what happened…" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="pj-note-add">Add</button></div>
    </div>

    <div class="card">
      <h2>🔗 Links <span class="hint">${(p.links || []).length}</span></h2>
      ${(p.links || []).length ? `<div class="pj-items">${p.links.map(l => `<div class="pj-item">
        <a class="pj-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label || l.url)}</a>
        <button class="del" data-pj-link-del="${l.id}">×</button></div>`).join('')}</div>` : ''}
      <div class="pj-add-h">Add a link</div>
      <div class="task-add"><input type="text" id="pj-link-label" placeholder="Label" style="max-width:110px">
        <input type="text" id="pj-link-url" placeholder="https://…" inputmode="url">
        <button class="btn btn-primary btn-sm" id="pj-link-add">Add</button></div>
    </div>

    <div class="card">
      <h2>⚙️ Project settings</h2>
      <div class="pj-row2">
        <div class="field"><label>Status</label><select data-pj-field="status">${PJ_STATUS.map(s => `<option value="${s.k}"${p.status === s.k ? ' selected' : ''}>${s.label}</option>`).join('')}</select></div>
        <div class="field"><label>Priority</label><select data-pj-field="prio">${[3, 2, 1].map(v => `<option value="${v}"${p.prio === v ? ' selected' : ''}>${PJ_PRIO[v]}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Target date</label><input type="date" data-pj-field="due" value="${escapeHtml(p.due)}"></div>
      <div class="field"><label>Colour</label>
        <div class="pj-swatches">${PJ_COLORS.map(c => `<button class="pj-sw ${p.color === c ? 'on' : ''}" data-pj-color="${c}" style="background:${c}" aria-label="colour ${c}"></button>`).join('')}</div></div>
      <button class="btn pj-danger btn-sm" id="pj-del" style="margin-top:6px">Delete this project</button>
      <div class="hint" style="margin-top:8px">Deleting a project keeps your time blocks — they just stop being tagged to it.</div>
    </div>`;
}

function pjItemRow(p, it, kind) {
  const done = !!it.done;
  return `<div class="pj-item ${done ? 'done' : ''}">
    <button class="pj-tick" data-pj-tick="${kind}:${it.id}" aria-label="${done ? 'mark not done' : 'mark done'}">${done ? '☑' : '☐'}</button>
    <span class="pj-item-t">${escapeHtml(it.text)}${it.due ? ` <span class="pj-next-d">· ${shortDate(it.due)}</span>` : ''}</span>
    ${done ? '' : `<button class="pj-push" data-pj-push="${kind}:${it.id}" title="add to today's tasks">↗</button>`}
    <button class="del" data-pj-item-del="${kind}:${it.id}">×</button></div>`;
}

/* ---- handlers ---- */
document.addEventListener('click', (ev) => {
  const t = ev.target;

  const openB = t.closest('[data-pj-open]');
  if (openB) { pjOpen = openB.dataset.pjOpen; navigateTo('projects'); return; }
  if (t.id === 'pj-back') { pjOpen = null; renderProjects(); return; }

  const fb = t.closest('[data-pj-filter]');
  if (fb) { pjFilter = fb.dataset.pjFilter; renderProjects(); return; }
  const sb = t.closest('[data-pj-sort]');
  if (sb) { pjSort = sb.dataset.pjSort; renderProjects(); return; }

  if (t.id === 'pj-add-open') { pjAddOpen = true; renderProjects();
    setTimeout(() => { const i = document.getElementById('pj-new-name'); if (i) i.focus(); }, 30); return; }
  if (t.id === 'pj-create-cancel') { pjAddOpen = false; renderProjects(); return; }
  if (t.id === 'pj-create') {
    const name = (document.getElementById('pj-new-name').value || '').trim().slice(0, 80);
    if (!name) { toast('Give the project a name', true); return; }
    const p = pjNorm({
      id: 'pj' + Date.now(), name,
      outcome: (document.getElementById('pj-new-outcome').value || '').trim().slice(0, 160),
      status: document.getElementById('pj-new-status').value,
      due: document.getElementById('pj-new-due').value || '',
      color: PJ_COLORS[DB.projects().length % PJ_COLORS.length],
    });
    pjPut(p); pjAddOpen = false; pjOpen = p.id; renderProjects(); buzz(12); toast('Project created');
    return;
  }

  if (!pjOpen) return;   // everything below is detail-view only

  const tick = t.closest('[data-pj-tick]');
  if (tick) {
    const [kind, id] = tick.dataset.pjTick.split(':');
    pjMutate(pjOpen, p => {
      const it = (p[kind] || []).find(x => x.id === id);
      if (!it) return;
      it.done = !it.done;
      if (it.done) { it.doneAt = Date.now(); buzz(10); } else delete it.doneAt;
    });
    renderProjects(); return;
  }
  const push = t.closest('[data-pj-push]');
  if (push) {
    const [kind, id] = push.dataset.pjPush.split(':');
    const p = pjById(pjOpen);
    const it = (p[kind] || []).find(x => x.id === id);
    if (!it) return;
    const tasks = DB.tasks();
    tasks.unshift({ id: 't' + Date.now(), text: `${p.name}: ${it.text}`, done: false, created: todayStr(), color: '' });
    DB.saveTasks(tasks); buzz(12); toast("Added to today's tasks ✅");
    return;
  }
  const idel = t.closest('[data-pj-item-del]');
  if (idel) {
    const [kind, id] = idel.dataset.pjItemDel.split(':');
    pjMutate(pjOpen, p => { p[kind] = (p[kind] || []).filter(x => x.id !== id); });
    renderProjects(); return;
  }
  if (t.id === 'pj-mile-add' || t.id === 'pj-step-add') {
    const step = t.id === 'pj-step-add';
    const inp = document.getElementById(step ? 'pj-step-in' : 'pj-mile-in');
    const text = (inp.value || '').trim().slice(0, 140);
    if (!text) return;
    const due = step ? '' : (document.getElementById('pj-mile-due').value || '');
    pjMutate(pjOpen, p => (p[step ? 'steps' : 'miles']).push({ id: 'i' + Date.now(), text, due, done: false }));
    renderProjects();
    const again = document.getElementById(step ? 'pj-step-in' : 'pj-mile-in'); if (again) again.focus();
    return;
  }
  if (t.id === 'pj-note-add') {
    const inp = document.getElementById('pj-note-in');
    const text = (inp.value || '').trim().slice(0, 800);
    if (!text) return;
    pjMutate(pjOpen, p => p.notes.push({ id: 'n' + Date.now(), at: Date.now(), text }));
    renderProjects(); return;
  }
  const ndel = t.closest('[data-pj-note-del]');
  if (ndel) { pjMutate(pjOpen, p => { p.notes = p.notes.filter(n => n.id !== ndel.dataset.pjNoteDel); }); renderProjects(); return; }
  if (t.id === 'pj-link-add') {
    let url = (document.getElementById('pj-link-url').value || '').trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;      // a bare domain must not become a relative link
    const label = (document.getElementById('pj-link-label').value || '').trim().slice(0, 60);
    pjMutate(pjOpen, p => p.links.push({ id: 'l' + Date.now(), label, url: url.slice(0, 500) }));
    renderProjects(); return;
  }
  const ldel = t.closest('[data-pj-link-del]');
  if (ldel) { pjMutate(pjOpen, p => { p.links = p.links.filter(l => l.id !== ldel.dataset.pjLinkDel); }); renderProjects(); return; }

  const sw = t.closest('[data-pj-color]');
  if (sw) { pjMutate(pjOpen, p => p.color = sw.dataset.pjColor); renderProjects(); return; }

  if (t.id === 'pj-timer') {
    const p = pjById(pjOpen);
    const run = runningSeg();
    if (run && run.pid === p.id) startAct(run.act, p.id);   // same project = stop
    else startAct(PJ_ACT + p.id, p.id);
    renderProjects(); return;
  }
  if (t.id === 'pj-del') {
    const p = pjById(pjOpen);
    if (!confirm(`Delete "${p.name}"? Its steps, milestones and log are removed. Your time blocks are kept.`)) return;
    DB.saveProjects(DB.projects().filter(x => x.id !== pjOpen));
    /* Untag the orphaned blocks. Leaving a dead pid behind means the hours are invisible
       everywhere: excluded from every project AND from the "untagged" pool. */
    const log = DB.timelog(); let touched = false;
    log.forEach(s => { if (s.pid === pjOpen) { delete s.pid; s.upd = Date.now(); touched = true; } });
    if (touched) DB.saveTimelog(log);
    /* Blocks logged AS this project keep act 'pj:<id>'. Remember the name and colour so they
       do not degrade into a raw id string on the timeline for the rest of time. */
    if (log.some(s => s.act === PJ_ACT + pjOpen)) {
      const names = safeParse(localStorage.getItem('dp.pjnames'), {});
      names[pjOpen] = { name: p.name, color: p.color };
      safeSet('dp.pjnames', JSON.stringify(names));
    }
    pjOpen = null; renderProjects(); toast('Project deleted');
    return;
  }
});

/* Field edits: <input>/<select> carrying data-pj-field write straight onto the project. */
document.addEventListener('change', (ev) => {
  const f = ev.target.closest('[data-pj-field]');
  if (!f || !pjOpen) return;
  const k = f.dataset.pjField;
  let v = f.value;
  if (k === 'prio') v = +v;
  if (k === 'name') { v = (v || '').trim().slice(0, 80); if (!v) { toast('A project needs a name', true); renderProjects(); return; } }
  if (k === 'outcome') v = (v || '').trim().slice(0, 160);
  pjMutate(pjOpen, p => p[k] = v);
  /* Name/outcome are free text — re-rendering on every keystroke-blur would steal focus, so
     only the structural fields redraw. The header inputs already show what was typed. */
  if (['status', 'prio', 'due', 'act'].includes(k)) renderProjects();
  else { const st = document.getElementById('screen-sub'); if (st) st.textContent = pjHealth(pjById(pjOpen)).label; }
});


/* ============================================================
   GAP FILLER — "you didn't track 09:00–11:15; on weekdays that's usually Work. Was it?"
   ------------------------------------------------------------
   Forgetting to start the timer is the biggest hole in any time tracker: the hours are simply
   gone. This finds the untracked stretches of a past day and, where your OWN history actually
   supports a guess, names the likeliest activity and asks. It never fills anything in itself.

   The honesty rules — they matter more here than anywhere else in the app, because a wrong
   guess becomes permanent data:

   ① A guess is only named when it is genuinely supported: the same clock window on at least
      GAP_MIN_DAYS other days, with one activity holding at least GAP_MIN_SHARE of the tracked
      minutes there. Below that the row still appears but says there is no pattern and offers
      the picker instead of a guess.
   ② The support is always shown — "6 of your last 9 tracked weekdays" — so you can judge the
      guess rather than trust it. No invented confidence percentages.
   ③ Weekdays and weekends are tallied separately, because sleep and work are exactly what
      differs. It falls back to all days only when a day-type has too few samples, and says
      which basis it used.
   ④ Nothing is auto-accepted, and "leave blank" is a first-class answer that is remembered.
   ⑤ A gap is SPLIT wherever the likely activity changes, so you are asked about 09:00–12:00
      and 13:00–17:00 separately. Asking "were you working for 17½ hours?" — which is what a
      single whole-gap guess produced — is worse than not asking.
   ============================================================ */

const GAP_MIN_MS = 30 * 60000;      // shorter stretches are normal life, not missing data
const GAP_SLOT_MS = 30 * 60000;     // resolution the day is modelled at (48 slots)
const GAP_SLOTS = 48;
const GAP_LOOKBACK = 90;            // days of history to learn from
const GAP_MIN_DAYS = 3;             // distinct supporting days before naming an activity
const GAP_MIN_SHARE = 0.4;          // the leader must hold this share of tracked minutes
const GAP_MAX_ROWS = 8;             // a wall of rows is not a prompt, it is noise
let gapOpen = null;                 // start-ms (as a string) of the row whose picker is open

function gapSkips() { return safeParse(localStorage.getItem('dp.gapskip'), {}); }
function gapSkip(dateStr, a) {
  const m = gapSkips(); m[dateStr + '|' + a] = 1;
  safeSet('dp.gapskip', JSON.stringify(m));
}
function gapSkipped(dateStr, a) { return !!gapSkips()[dateStr + '|' + a]; }
function gapIsWeekend(ds) { const d = new Date(ds + 'T00:00:00').getDay(); return d === 0 || d === 6; }
/* A gap that runs to the end of the day ends at midnight, and fmtClock renders that as
   "00:00" — which reads as the START of the day. */
function gapClock(ms, dayStart) { return ms - dayStart >= 86400000 ? '24:00' : fmtClock(ms); }

/* Untracked stretches of a day, as absolute ms ranges. Never anything in the future:
   "you didn't track 20:00–24:00" at lunchtime is not missing data. */
function gapsRaw(dateStr) {
  const d0 = new Date(dateStr + 'T00:00:00').getTime();
  const cap = Math.min(d0 + 86400000, Date.now());
  if (cap <= d0) return [];
  const out = []; let cur = d0;
  segsForDay(dateStr).slice().sort((x, y) => x.a - y.a).forEach(({ a, b }) => {
    if (a > cur) out.push({ a: cur, b: Math.min(a, cap) });
    cur = Math.max(cur, b);
  });
  if (cur < cap) out.push({ a: cur, b: cap });
  return out.filter(g => g.b - g.a >= GAP_MIN_MS);
}

/* ONE pass over the log builds a per-half-hour picture of the day, for matching-day-type and
   for all days at once. Predicting each slot with its own scan of 90 days would re-walk the
   whole log ~35 times for a long gap, on every render of the Time screen. */
function gapModel(dateStr) {
  const blank = () => ({
    mins: Array.from({ length: GAP_SLOTS }, () => ({})),
    days: Array.from({ length: GAP_SLOTS }, () => ({})),
    sample: Array.from({ length: GAP_SLOTS }, () => ({})),
  });
  const same = blank(), all = blank();
  const wantWeekend = gapIsWeekend(dateStr);
  const log = DB.timelog().filter(s => s.end != null);   // a running block has no settled span
  for (let i = 1; i <= GAP_LOOKBACK; i++) {
    const ds = addDays(dateStr, -i);
    const b0 = new Date(ds + 'T00:00:00').getTime(), b1 = b0 + 86400000;
    const targets = gapIsWeekend(ds) === wantWeekend ? [all, same] : [all];
    log.forEach(s => {
      const a = Math.max(s.start, b0), b = Math.min(s.end, b1);
      if (b <= a) return;
      const k0 = Math.floor((a - b0) / GAP_SLOT_MS), k1 = Math.ceil((b - b0) / GAP_SLOT_MS);
      for (let k = k0; k < k1 && k < GAP_SLOTS; k++) {
        const ka = b0 + k * GAP_SLOT_MS;
        const ov = Math.min(b, ka + GAP_SLOT_MS) - Math.max(a, ka);
        if (ov <= 0) continue;
        targets.forEach(m => {
          m.mins[k][s.act] = (m.mins[k][s.act] || 0) + ov;
          (m.days[k][s.act] = m.days[k][s.act] || {})[ds] = 1;
          m.sample[k][ds] = 1;
        });
      }
    });
  }
  return { same, all, wantWeekend };
}

/* Aggregate slots [k0,k1) of one tally and name a winner, or decline to. */
function gapFromTally(t, k0, k1) {
  const mins = {}, days = {}, sample = {};
  for (let k = k0; k < k1 && k < GAP_SLOTS; k++) {
    Object.keys(t.mins[k]).forEach(a => { mins[a] = (mins[a] || 0) + t.mins[k][a]; });
    Object.keys(t.days[k]).forEach(a => { days[a] = days[a] || {}; Object.assign(days[a], t.days[k][a]); });
    Object.assign(sample, t.sample[k]);
  }
  const total = Object.values(mins).reduce((x, y) => x + y, 0);
  const sampleDays = Object.keys(sample).length;
  if (!total) return { act: null, sampleDays: 0 };
  const best = Object.keys(mins).sort((x, y) => mins[y] - mins[x])[0];
  const nDays = Object.keys(days[best] || {}).length;
  const share = mins[best] / total;
  if (nDays < GAP_MIN_DAYS || share < GAP_MIN_SHARE) return { act: null, sampleDays };
  return { act: best, share, days: nDays, sampleDays };
}

/* Same day-type first — pooling a Tuesday with a Sunday is how you end up suggesting
   "Work" for a Saturday lie-in. Falls back to all days only when samples are too thin. */
function gapPredictSlots(model, k0, k1) {
  const s = gapFromTally(model.same, k0, k1);
  if (s.act || s.sampleDays >= GAP_MIN_DAYS)
    return Object.assign(s, { basis: model.wantWeekend ? 'weekend days' : 'weekdays' });
  const a = gapFromTally(model.all, k0, k1);
  return Object.assign(a, { basis: 'days' });
}

/* How many distinct days in the lookback window have any tracked time? Below GAP_MIN_DAYS
   there is nothing to learn from, and the card would otherwise appear on every past day of a
   brand-new install saying "00:00–24:00, what were you doing?" — which is not missing data,
   it is an app that has not been used yet. */
function gapHistoryDays(dateStr) {
  const log = DB.timelog().filter(s => s.end != null);
  if (!log.length) return 0;
  const days = {};
  for (let i = 1; i <= GAP_LOOKBACK; i++) {
    const ds = addDays(dateStr, -i);
    const b0 = new Date(ds + 'T00:00:00').getTime(), b1 = b0 + 86400000;
    if (log.some(s => s.end > b0 && s.start < b1)) days[ds] = 1;
  }
  return Object.keys(days).length;
}

/* Rows to ask about: each raw gap split wherever the likely activity changes. */
function gapSegments(dateStr) {
  const d0 = new Date(dateStr + 'T00:00:00').getTime();
  const raw = gapsRaw(dateStr);
  if (!raw.length) return [];
  if (gapHistoryDays(dateStr) < GAP_MIN_DAYS) return [];
  /* A day with nothing tracked at all is one 24-hour "gap". Asking an open-ended "what were
     you doing?" about a whole unused day is useless, so on those days only windows where
     history actually names something are offered — the guesses, and silence elsewhere. */
  const dayIsEmpty = segsForDay(dateStr).length === 0;
  const model = gapModel(dateStr);
  const rows = [];
  raw.forEach(g => {
    const k0 = Math.floor((g.a - d0) / GAP_SLOT_MS);
    const kN = Math.ceil((g.b - d0) / GAP_SLOT_MS);
    const mine = [];
    let run = null;
    for (let k = k0; k < kN; k++) {
      const act = gapPredictSlots(model, k, k + 1).act;
      if (run && run.act === act) run.k1 = k + 1;
      else { if (run) mine.push(run); run = { k0: k, k1: k + 1, act }; }
    }
    if (run) mine.push(run);
    /* Clamp back inside THIS gap — slots are half-open half-hours and the gap edges rarely
       land on one, so without this a row can claim tracked time either side. Clamping `rows`
       (everything accumulated so far) instead of `mine` re-clamped the first gap's rows to
       the second gap's bounds, inverting them so they were silently dropped: with two gaps in
       a day, only the last one was ever offered. */
    mine.forEach(r => {
      r.a = Math.max(g.a, d0 + r.k0 * GAP_SLOT_MS);
      r.b = Math.min(g.b, d0 + r.k1 * GAP_SLOT_MS);
    });
    mine.forEach(r => rows.push(r));
  });
  return rows
    .filter(r => r.b - r.a >= GAP_MIN_MS && !gapSkipped(dateStr, r.a))
    .filter(r => !dayIsEmpty || r.act)
    .map(r => Object.assign(r, { pred: gapPredictSlots(model, r.k0, r.k1) }))
    .slice(0, GAP_MAX_ROWS);
}

/* Write the confirmed block. The boundaries come from the user's own tracked blocks and a
   half-hour grid, and the user has confirmed the activity — so this is a recollection, not an
   estimate, and it is stored like any other manual entry. */
function gapFill(dateStr, a, b, actId) {
  const log = DB.timelog();
  let id = 'ts' + a, n = 0;
  while (log.some(s => s.id === id)) id = 'ts' + a + '-' + (++n);
  log.push({ id, act: actId, start: a, end: b, upd: Date.now() });
  DB.saveTimelog(log);
  gapOpen = null;
  renderTime();
  buzz(12);
  toast(`Logged ${fmtDur(b - a, true)} of ${actById(actId).name}`);
}

function gapCardHTML(dateStr) {
  const rows = gapSegments(dateStr);
  if (!rows.length) return '';
  const d0 = new Date(dateStr + 'T00:00:00').getTime();
  const untracked = gapsRaw(dateStr).reduce((x, g) => x + (g.b - g.a), 0);
  const acts = allActs();

  const html = rows.map(r => {
    const when = `${gapClock(r.a, d0)}–${gapClock(r.b, d0)}`;
    const len = fmtDur(r.b - r.a, true);
    const isOpen = gapOpen === String(r.a);
    const picker = `<div class="gap-pick">${acts.map(x =>
      `<button class="gap-act" data-gap-set="${r.a}:${r.b}:${x.id}">${x.emoji || ''} ${escapeHtml(x.name)}</button>`).join('')}</div>`;
    const head = `<div class="gap-when"><b>${when}</b> <span class="gap-len">${len}</span></div>`;
    const p = r.pred;

    if (p.act) {
      const a2 = actById(p.act);
      return `<div class="gap-row">${head}
        ${/* "Was this X?" not "Were you X?" — activity names are nouns ("Sleep", "Work",
             "Reading"), so "Were you Sleep?" is ungrammatical for most of them. */''}
        <div class="gap-q">Was this ${a2.emoji ? a2.emoji + ' ' : ''}<b>${escapeHtml(a2.name)}</b>?</div>
        <div class="gap-why">You logged it in this window on <b>${p.days}</b> of your last ${p.sampleDays} tracked ${p.basis}.</div>
        <div class="gap-btns">
          <button class="btn btn-primary btn-sm" data-gap-set="${r.a}:${r.b}:${p.act}">Yes, log it</button>
          <button class="btn btn-ghost btn-sm" data-gap-other="${r.a}">${isOpen ? '✕ Close' : 'Something else'}</button>
          <button class="gap-skip" data-gap-skip="${r.a}">Leave blank</button>
        </div>${isOpen ? picker : ''}</div>`;
    }
    return `<div class="gap-row">${head}
      <div class="gap-q">What were you doing?</div>
      <div class="gap-why">${p.sampleDays
        ? `Nothing you do regularly at this time — ${p.sampleDays} tracked ${p.basis} to compare with, and no clear favourite.`
        : 'No history for this time of day yet, so there is nothing to guess from.'}</div>
      <div class="gap-btns">
        <button class="btn btn-ghost btn-sm" data-gap-other="${r.a}">${isOpen ? '✕ Close' : 'Pick an activity'}</button>
        <button class="gap-skip" data-gap-skip="${r.a}">Leave blank</button>
      </div>${isOpen ? picker : ''}</div>`;
  }).join('');

  /* The header total is ALL untracked time; the rows are only what can be asked about, which
     is less once windows are skipped, capped, or have no pattern on an empty day. Stating the
     big number next to two short rows looks like a bug, so the difference is spelled out. */
  const offered = rows.reduce((x, r) => x + (r.b - r.a), 0);
  const rest = untracked - offered;
  return `<div class="card gap-card">
    <h2>🧩 Untracked time <span class="hint">${fmtDur(untracked, true)} on ${shortDate(dateStr)}</span></h2>
    <div class="hint" style="margin-bottom:10px">Nothing is filled in unless you say so. Suggestions come from what <b>you</b> logged at the same time of day before — never from anyone else, and never from an average.${
      rest >= GAP_MIN_MS ? ` Asking about ${fmtDur(offered, true)} of it below; the other ${fmtDur(rest, true)} has no pattern to go on${rows.length >= GAP_MAX_ROWS ? ' or is past the limit for one day' : ''}.` : ''}</div>
    ${html}</div>`;
}

document.addEventListener('click', (ev) => {
  const af = ev.target.closest('[data-aw-filter]');
  if (af) { awFilter = af.dataset.awFilter; renderAwards(); window.scrollTo(0, 0); return; }
});

document.addEventListener('click', (ev) => {
  const set = ev.target.closest('[data-gap-set]');
  if (set) { const [a, b, actId] = set.dataset.gapSet.split(':'); gapFill(ttDate, +a, +b, actId); return; }
  const other = ev.target.closest('[data-gap-other]');
  if (other) { gapOpen = gapOpen === other.dataset.gapOther ? null : other.dataset.gapOther; renderTime(); return; }
  const sk = ev.target.closest('[data-gap-skip]');
  if (sk) { gapSkip(ttDate, +sk.dataset.gapSkip); gapOpen = null; renderTime(); toast('Left blank'); return; }
});


/* ============================================================
   MONEY — accounts, transactions, assets, debts and the analysis on top.
   ------------------------------------------------------------
   Amounts are stored as INTEGER MINOR UNITS (paise/cents), never as decimals. Summing a few
   hundred 2-decimal floats drifts — 0.1 + 0.2 is not 0.3 — and a balance that is wrong by a
   rupee is a balance nobody trusts again. Everything converts at the edges: parseAmt on the
   way in, finFmt on the way out.

   Two kinds of account, because they answer different questions:
     · transactional (bank, cash, card, wallet) — the balance is DERIVED from transactions, so
       it can never disagree with the ledger.
     · valued (investments, property, gold, loans) — you cannot itemise every market move, so
       these carry dated value marks and the balance is the latest mark. The mark history is
       what makes a truthful net-worth line possible.

   A credit card is just an account that goes negative, and paying it off is a transfer. That
   keeps one rule for everything instead of special-casing debt.
   ============================================================ */

const FIN_KINDS = [
  { k: 'bank',   label: 'Bank account', ico: '🏦', mode: 'tx',     sign:  1 },
  { k: 'cash',   label: 'Cash',         ico: '💵', mode: 'tx',     sign:  1 },
  { k: 'wallet', label: 'Wallet / UPI', ico: '📲', mode: 'tx',     sign:  1 },
  { k: 'card',   label: 'Credit card',  ico: '💳', mode: 'tx',     sign:  1 },
  { k: 'invest', label: 'Investment',   ico: '📈', mode: 'valued', sign:  1 },
  { k: 'asset',  label: 'Asset',        ico: '🏠', mode: 'valued', sign:  1 },
  { k: 'loan',   label: 'Loan owed',    ico: '📉', mode: 'valued', sign: -1 },
];
function finKind(k) { return FIN_KINDS.find(x => x.k === k) || FIN_KINDS[0]; }

const FIN_CATS = [
  { id: 'food',      name: 'Food & dining',      ico: '🍽️', dir: 'out' },
  { id: 'grocery',   name: 'Groceries',          ico: '🛒', dir: 'out' },
  { id: 'transport', name: 'Transport & fuel',   ico: '🚗', dir: 'out' },
  { id: 'home',      name: 'Rent & bills',       ico: '🏠', dir: 'out' },
  { id: 'health',    name: 'Health',             ico: '🩺', dir: 'out' },
  { id: 'shopping',  name: 'Shopping',           ico: '🛍️', dir: 'out' },
  { id: 'fun',       name: 'Fun & going out',    ico: '🎬', dir: 'out' },
  { id: 'subs',      name: 'Subscriptions',      ico: '🔁', dir: 'out' },
  { id: 'edu',       name: 'Learning',           ico: '📚', dir: 'out' },
  { id: 'gift',      name: 'Gifts & giving',     ico: '🎁', dir: 'out' },
  { id: 'fees',      name: 'Fees & interest',    ico: '🧾', dir: 'out' },
  { id: 'invested',  name: 'Money invested',     ico: '📈', dir: 'out' },
  { id: 'otherout',  name: 'Other spending',     ico: '•',  dir: 'out' },
  { id: 'salary',    name: 'Salary',             ico: '💼', dir: 'in'  },
  { id: 'freelance', name: 'Freelance & side',   ico: '🧑‍💻', dir: 'in' },
  { id: 'refund',    name: 'Refund',             ico: '↩️', dir: 'in'  },
  { id: 'returns',   name: 'Interest & returns', ico: '🪙', dir: 'in'  },
  { id: 'otherin',   name: 'Other income',       ico: '•',  dir: 'in'  },
];
function finCats() {
  const custom = safeParse(localStorage.getItem('dp.fincats'), []) || [];
  return FIN_CATS.concat(Array.isArray(custom) ? custom : []);
}
function finCat(id) {
  return finCats().find(c => c.id === id) || { id, name: id || 'Uncategorised', ico: '•', dir: 'out' };
}

/* ---- stores ---- */
function finAccts() { const v = safeParse(localStorage.getItem('dp.finaccts'), []); return Array.isArray(v) ? v : []; }
function finSaveAccts(a) { const ok = safeSet('dp.finaccts', JSON.stringify(a)); pushState(); return ok; }
function finTx() { const v = safeParse(localStorage.getItem('dp.fintx'), []); return Array.isArray(v) ? v : []; }
function finSaveTx(t) { const ok = safeSet('dp.fintx', JSON.stringify(t)); pushState(); return ok; }
function finMarks() { const v = safeParse(localStorage.getItem('dp.finmarks'), []); return Array.isArray(v) ? v : []; }
function finSaveMarks(m) { const ok = safeSet('dp.finmarks', JSON.stringify(m)); pushState(); return ok; }
function finBudgets() { return safeParse(localStorage.getItem('dp.finbudget'), {}) || {}; }
function finSaveBudgets(b) { const ok = safeSet('dp.finbudget', JSON.stringify(b)); pushState(); return ok; }
function finSet() {
  return Object.assign({ cur: '₹', dp: 2 }, safeParse(localStorage.getItem('dp.finset'), {}) || {});
}
function finSaveSet(s) { const ok = safeSet('dp.finset', JSON.stringify(s)); pushState(); return ok; }
function finAcct(id) { return finAccts().find(a => a.id === id) || null; }

/* ---- money in and out of text ----
   Accepts what people actually type: "1,234.50", "₹1200", "1.2k", "-450", "1 200".
   Returns integer minor units, or null when there is no number in there at all — null is a
   parse FAILURE and callers must treat it as one, never as zero. */
function parseAmt(str) {
  // A number goes through the SAME parser as typed text, rather than Math.round(n * 100).
  // Two reasons. It is one rule instead of two, which is what you want for money; and the
  // arithmetic version is quietly wrong at the boundary — 1.005 * 100 is 100.49999999999999 in
  // binary floating point, so Math.round returned 100 while the obvious reading says 101. No
  // caller passes a number today (all nine pass a DOM value), so this changes nothing that runs;
  // it removes a trap for whoever first does.
  if (typeof str === 'number') return Number.isFinite(str) ? parseAmt(str.toFixed(2)) : null;
  let s = String(str == null ? '' : str).trim();
  if (!s) return null;
  let mult = 1;
  if (/^-/.test(s)) { s = s.slice(1); }                       // sign is carried by dir, not the amount
  if (/[kK]$/.test(s)) { mult = 1000; s = s.slice(0, -1); }
  else if (/[lL]$/.test(s)) { mult = 100000; s = s.slice(0, -1); }   // 1L = one lakh
  s = s.replace(/[^0-9.]/g, '');                              // strips ₹ , spaces and stray text
  if (!s || !/[0-9]/.test(s)) return null;
  const parts = s.split('.');
  const whole = parts[0] || '0';
  const frac = (parts[1] || '').slice(0, 2).padEnd(2, '0');
  const minor = (parseInt(whole, 10) * 100 + parseInt(frac, 10)) * mult;
  return Number.isFinite(minor) ? Math.round(minor) : null;
}
function finFmt(minor, opts) {
  opts = opts || {};
  const s = finSet();
  const neg = minor < 0;
  const abs = Math.abs(minor || 0);
  let body;
  if (opts.compact && abs >= 100000 * 100) body = (abs / (100000 * 100)).toFixed(abs >= 1000000 * 100 ? 0 : 1) + 'L';
  else if (opts.compact && abs >= 1000 * 100) body = (abs / (1000 * 100)).toFixed(abs >= 100000 ? 1 : 1) + 'k';
  else {
    const whole = Math.floor(abs / 100), cents = abs % 100;
    body = whole.toLocaleString(undefined) + (opts.noPaise || cents === 0 ? '' : '.' + String(cents).padStart(2, '0'));
  }
  return (neg ? '−' : '') + s.cur + body;
}

/* ---- balances ---- */
function finYm(d) { return String(d).slice(0, 7); }
function finMonthEnd(ym) { const [y, m] = ym.split('-').map(Number); return todayStr(new Date(y, m, 0)); }

/* Net movement on a transactional account up to and including `upto` (or all time). */
function finTxNet(acctId, upto) {
  let n = 0;
  finTx().forEach(t => {
    if (upto && t.d > upto) return;
    if (t.dir === 'xfer') {
      if (t.ac === acctId) n -= t.a;
      if (t.to === acctId) n += t.a;
      return;
    }
    if (t.ac !== acctId) return;
    n += t.dir === 'in' ? t.a : -t.a;
  });
  return n;
}
/* The latest value mark on or before `upto`. Valued accounts have no balance before their
   first mark — that is null, not zero, so net worth does not pretend an unmarked asset is
   worth nothing. */
function finMarkAt(acctId, upto) {
  const ms = finMarks().filter(m => m.ac === acctId && (!upto || m.d <= upto)).sort((a, b) => a.d < b.d ? -1 : 1);
  return ms.length ? ms[ms.length - 1].v : null;
}
/* When this account's history starts. Without it, the opening balance — which has no date —
   was applied to EVERY past month, so a net-worth chart showed an account opened today as
   already holding its balance a year ago. That is fabricated history in the one chart people
   read most literally. Accounts saved before this existed get their start inferred from their
   own earliest record rather than a migration. */
function finSince(a) {
  if (!a) return null;
  if (a.since) return a.since;
  const ds = finTx().filter(t => t.ac === a.id || t.to === a.id).map(t => t.d)
    .concat(finMarks().filter(m => m.ac === a.id).map(m => m.d));
  return ds.length ? ds.sort()[0] : (a.created || todayStr());
}

/* Signed balance, positive = adds to net worth. Returns null when the account did not exist
   yet, and for a valued account with no mark yet — so callers can tell "nothing recorded"
   from "zero", and history is never invented. */
function finBal(acctId, upto) {
  const a = finAcct(acctId); if (!a) return 0;
  const k = finKind(a.kind);
  if (upto) { const since = finSince(a); if (since && upto < since) return null; }
  if (k.mode === 'valued') {
    const v = finMarkAt(acctId, upto);
    return v == null ? null : v * k.sign;
  }
  return (a.opening || 0) + finTxNet(acctId, upto);
}
function finNetWorth(upto) {
  return finAccts().filter(a => !a.archived)
    .reduce((s, a) => { const b = finBal(a.id, upto); return s + (b == null ? 0 : b); }, 0);
}
function finSplitWorth(upto) {
  let assets = 0, debts = 0;
  finAccts().filter(a => !a.archived).forEach(a => {
    const b = finBal(a.id, upto);
    if (b == null) return;
    if (b >= 0) assets += b; else debts += -b;
  });
  return { assets, debts, net: assets - debts };
}

/* ---- monthly analysis ---- */
function finMonth(ym) {
  const from = ym + '-01', to = finMonthEnd(ym);
  let inc = 0, out = 0; const byCat = {}, byAcct = {};
  finTx().forEach(t => {
    if (t.d < from || t.d > to) return;
    if (t.dir === 'xfer') return;      // moving your own money is not income or spending
    if (t.dir === 'in') inc += t.a; else out += t.a;
    byCat[t.c] = (byCat[t.c] || 0) + t.a * (t.dir === 'in' ? 0 : 1);
    byAcct[t.ac] = (byAcct[t.ac] || 0) + (t.dir === 'in' ? t.a : -t.a);
  });
  Object.keys(byCat).forEach(k => { if (!byCat[k]) delete byCat[k]; });
  const net = inc - out;
  return { ym, in: inc, out, net, byCat, byAcct,
    /* Savings rate is only meaningful against income. With no income recorded it is not 0% —
       it is unknown, and showing 0% would read as "you saved nothing". */
    rate: inc > 0 ? Math.round(net / inc * 100) : null };
}
function finRecentMonths(n) {
  const out = [];
  const d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(finYm(todayStr(x)));
  }
  return out;
}
function finWorthSeries(n) {
  return finRecentMonths(n).map(ym => {
    const end = ym > finYm(todayStr()) ? todayStr() : finMonthEnd(ym);
    return { ym, v: finNetWorth(end > todayStr() ? todayStr() : end) };
  });
}
/* Which categories moved most against the previous month. Percentages need a base: a jump
   from nothing to something has no percentage, so those report the absolute change only. */
function finMovers(ym) {
  const [y, m] = ym.split('-').map(Number);
  const prev = finYm(todayStr(new Date(y, m - 2, 1)));
  const a = finMonth(ym).byCat, b = finMonth(prev).byCat;
  const keys = [...new Set(Object.keys(a).concat(Object.keys(b)))];
  return keys.map(k => {
    const now = a[k] || 0, was = b[k] || 0;
    return { cat: k, now, was, delta: now - was, pct: was > 0 ? Math.round((now - was) / was * 100) : null };
  }).filter(x => x.delta !== 0).sort((x, y2) => Math.abs(y2.delta) - Math.abs(x.delta));
}

/* Repeat charges that look like subscriptions: the same category and a near-identical amount
   showing up in 3+ distinct months. Deliberately conservative — telling someone they have a
   subscription they do not have is worse than missing one. */
function finRecurring() {
  const groups = {};
  finTx().filter(t => t.dir === 'out').forEach(t => {
    const label = (t.n || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const bucket = Math.round(t.a / 100 / 50) * 50;          // ±₹25 tolerance
    const key = (label || t.c) + '|' + t.c + '|' + bucket;
    (groups[key] = groups[key] || []).push(t);
  });
  return Object.keys(groups).map(k => {
    const list = groups[k];
    const months = [...new Set(list.map(t => finYm(t.d)))].sort();
    const avg = Math.round(list.reduce((s, t) => s + t.a, 0) / list.length);
    const last = list.map(t => t.d).sort().slice(-1)[0];
    return { key: k, n: list.length, months: months.length, avg, last,
      label: (list[0].n || '').trim() || finCat(list[0].c).name, cat: list[0].c };
  }).filter(g => g.months >= 3).sort((a, b) => b.avg * b.months - a.avg * a.months);
}

/* ---- the thing a standalone finance app cannot do ----
   Daylog already holds mood, energy, sleep and screen time for the same days as the spending.
   Every split below is on the user's OWN median, every one states its sample size, and none
   is reported below FIN_MIN_DAYS days on each side. A spurious "you spend more when sad" is
   worse than no insight at all. */
const FIN_MIN_DAYS = 6;
/* Spending per day, EXCLUDING days that have not happened yet. The add form blocks future
   dates and the importer rejects them, but a scheduled payment typed in by hand or a bad
   statement row can still land ahead of today — and "your average Friday" must not include a
   Friday that has not arrived. */
function finDailySpend(includeFuture) {
  const byDay = {}, today = todayStr();
  finTx().forEach(t => {
    if (t.dir !== 'out') return;
    if (!includeFuture && t.d > today) return;
    byDay[t.d] = (byDay[t.d] || 0) + t.a;
  });
  return byDay;
}
function finPatterns() {
  const spend = finDailySpend();
  const days = Object.keys(spend);
  if (days.length < FIN_MIN_DAYS * 2) return [];
  const ents = DB.entries(), hs = (typeof healthStore === 'function' ? healthStore() : {}) || {};
  const out = [];
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

  /* `belowLabel` names days where the METRIC is below your median, `aboveLabel` above it.
     Named this way on purpose: the first cut took (lowWord, highWord) and three of the four
     call sites passed them the other way round, so the insight reported the exact opposite of
     the truth — "you spend more on better-mood days" when the data said the reverse. An
     insight that is backwards is worse than no insight, and the parameter names are the only
     thing standing between the two. */
  const split = (label, valueOf, belowLabel, aboveLabel, unit) => {
    const pairs = days.map(d => ({ d, s: spend[d], v: valueOf(d) })).filter(p => p.v != null);
    if (pairs.length < FIN_MIN_DAYS * 2) return;
    const med = dpMedian(pairs.map(p => p.v));
    if (med == null) return;
    const below = pairs.filter(p => p.v < med), above = pairs.filter(p => p.v >= med);
    if (below.length < FIN_MIN_DAYS || above.length < FIN_MIN_DAYS) return;
    const aBelow = avg(below.map(p => p.s)), aAbove = avg(above.map(p => p.s));
    const diff = aAbove - aBelow;
    if (Math.abs(diff) < 5000) return;                        // under ₹50/day is noise, not a pattern
    const costlier = diff > 0 ? aboveLabel : belowLabel;
    const cheaper  = diff > 0 ? belowLabel : aboveLabel;
    const hiAmt = diff > 0 ? aAbove : aBelow, loAmt = diff > 0 ? aBelow : aAbove;
    const money = v => finFmt(Math.round(v), { compact: true, noPaise: true });
    out.push({
      head: `You spend ${money(Math.abs(diff))} more a day on ${costlier}`,
      body: `${money(hiAmt)} a day on ${costlier} vs ${money(loAmt)} on ${cheaper}. ` +
            `Split at your own median ${label}${unit ? ' of ' + med.toFixed(1) + unit : ''}, over ${pairs.length} days with both recorded.`,
      n: pairs.length, mag: Math.abs(diff),
    });
  };

  split('mood', d => (ents[d] && ents[d].mood != null) ? +ents[d].mood : null,
    'lower-mood days', 'better-mood days', '/10');
  split('energy', d => (ents[d] && ents[d].energy != null) ? +ents[d].energy : null,
    'lower-energy days', 'higher-energy days', '/10');
  split('sleep', d => {
    const h = hs[d] && hs[d].sleepMin != null ? hs[d].sleepMin / 60 : null;
    return h != null ? h : (ents[d] && ents[d].sleepHours != null ? +ents[d].sleepHours : null);
  }, 'short-sleep days', 'well-slept days', 'h');
  split('screen time', d => {
    const m = hs[d] && hs[d].screenMin != null ? hs[d].screenMin / 60 : null;
    return m != null ? m : (ents[d] && ents[d].screenTime != null ? +ents[d].screenTime : null);
  }, 'low-screen days', 'high-screen days', 'h');

  /* Weekday vs weekend needs no other tracking at all, so it works from day one. */
  const wk = days.filter(d => { const g = new Date(d + 'T00:00:00').getDay(); return g !== 0 && g !== 6; });
  const we = days.filter(d => { const g = new Date(d + 'T00:00:00').getDay(); return g === 0 || g === 6; });
  if (wk.length >= FIN_MIN_DAYS && we.length >= FIN_MIN_DAYS) {
    const aW = avg(wk.map(d => spend[d])), aE = avg(we.map(d => spend[d]));
    if (Math.abs(aE - aW) >= 5000) {
      /* Leads with the costlier side, like every other pattern above. Leading with whichever
         happens to be the weekend made the body contradict the emphasis of its own heading. */
      const money = v => finFmt(Math.round(v), { compact: true, noPaise: true });
      const weekendCostlier = aE > aW;
      out.push({
        head: `${weekendCostlier ? 'Weekends' : 'Weekdays'} cost you ${money(Math.abs(aE - aW))} more a day`,
        body: `${money(weekendCostlier ? aE : aW)} on an average ${weekendCostlier ? 'weekend day' : 'weekday'} vs ` +
              `${money(weekendCostlier ? aW : aE)} on a ${weekendCostlier ? 'weekday' : 'weekend day'}, ` +
              `over ${we.length} weekend and ${wk.length} weekday days with spending.`,
        n: days.length, mag: Math.abs(aE - aW),
      });
    }
  }
  return out.sort((a, b) => b.mag - a.mag);
}

/* Month-end projection from the run rate so far. Only after a few days — projecting a month
   from one day of data produces a number that is wrong by an order of magnitude. */
function finProjection(ym) {
  if (ym !== finYm(todayStr())) return null;
  const day = +todayStr().slice(8, 10);
  if (day < 5) return null;
  const m = finMonth(ym);
  const total = +finMonthEnd(ym).slice(8, 10);
  return { spent: m.out, projected: Math.round(m.out / day * total), dayOf: day, days: total };
}

/* ---------- Money screen ---------- */
let mnTab = 'over';          // over | tx | accts | ins
let mnYm = null;             // month being viewed (null = current)
let mnAcctOpen = null;       // account id being edited
let mnTxEdit = null;         // transaction id being edited
let mnAddOpen = false;
let mnImport = null;         // { rows, head, map } while a CSV is being mapped
let mnFilter = { acct: '', cat: '' };

function mnMonth() { return mnYm || finYm(todayStr()); }
function mnMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function mnShiftMonth(n) {
  const [y, m] = mnMonth().split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  const ym = finYm(todayStr(d));
  if (ym > finYm(todayStr())) return;          // no future months
  mnYm = ym; renderMoney();
}

function renderMoney() {
  const el = document.getElementById('s-money');
  if (!el) return;
  document.getElementById('screen-title').textContent = 'Money';
  const accts = finAccts().filter(a => !a.archived);
  const w = finSplitWorth();
  document.getElementById('screen-sub').textContent =
    accts.length ? finFmt(w.net, { compact: true, noPaise: true }) + ' net worth' : 'set up your accounts';

  if (!accts.length && !finAccts().length) return mnRenderEmpty(el);

  const tabs = [{ k: 'over', label: 'Overview' }, { k: 'tx', label: 'Money in/out' },
                { k: 'charts', label: 'Charts' }, { k: 'ins', label: 'Patterns' },
                { k: 'accts', label: 'Accounts' }];
  el.innerHTML = `<div class="card" style="padding:12px">
      <div class="seg-row">${tabs.map(t => `<button class="seg-btn ${mnTab === t.k ? 'on' : ''}" data-mn-tab="${t.k}">${t.label}</button>`).join('')}</div>
    </div>` +
    (mnTab === 'over' ? mnOverviewHTML() : mnTab === 'tx' ? mnTxHTML()
      : mnTab === 'charts' ? mnChartsHTML()
      : mnTab === 'accts' ? mnAcctsHTML() : mnInsightsHTML());
}

function mnRenderEmpty(el) {
  el.innerHTML = `<div class="card">
    <h2 class="h2-icon">${hicon('wallet')}<span>Money</span></h2>
    <div class="empty" style="text-align:left;padding:14px 4px">
      <p><b>Track what you own, what you owe, and where it goes</b> — on this phone only, like
      everything else here. No bank login, nothing uploaded.</p>
      <p>Add an account to start. A bank account and cash is enough; you can add a credit card,
      investments, property or a loan later.</p>
      <p style="color:var(--text-dim)">Because your spending sits next to your mood, sleep and
      screen time in the same app, <b>Patterns</b> can tell you things a finance app never
      can — like whether short nights cost you money.</p>
    </div>
    <div class="mn-quick">${FIN_KINDS.map(k => `<button class="mn-kbtn" data-mn-new-kind="${k.k}">${k.ico} ${k.label}</button>`).join('')}</div>
  </div>` + (mnAcctOpen === 'new' ? mnAcctFormHTML() : '');
}

/* ---- overview ---- */
function mnOverviewHTML() {
  const ym = mnMonth(), m = finMonth(ym), w = finSplitWorth();
  const series = finWorthSeries(8).map(x => x.v / 100);
  const proj = finProjection(ym);
  const budgets = finBudgets();
  const cats = Object.keys(m.byCat).sort((a, b) => m.byCat[b] - m.byCat[a]);
  const top = cats.slice(0, 7);
  const maxCat = top.length ? m.byCat[top[0]] : 0;
  const months = finRecentMonths(6);

  return `
  <div class="card mn-worth">
    <div class="mn-worth-top">
      <div>
        <div class="mn-lbl">Net worth</div>
        <div class="mn-big ${w.net < 0 ? 'neg' : ''}">${finFmt(w.net, { compact: true, noPaise: true })}</div>
        <div class="mn-sub">${finFmt(w.assets, { compact: true, noPaise: true })} owned · ${finFmt(w.debts, { compact: true, noPaise: true })} owed</div>
      </div>
      ${series.filter(v => v !== 0).length >= 2 ? `<div class="mn-spark">${sparkline(series, 'nrg', 104, 40)}<div class="mn-lbl" style="text-align:right">8 months</div></div>` : ''}
    </div>
  </div>

  <div class="card">
    <div class="mn-mhead">
      <button class="mn-arrow" data-mn-month="-1" aria-label="previous month">‹</button>
      <div class="mn-mname">${escapeHtml(mnMonthLabel(ym))}</div>
      <button class="mn-arrow" data-mn-month="1" aria-label="next month" ${ym >= finYm(todayStr()) ? 'disabled' : ''}>›</button>
    </div>
    <div class="mn-3">
      <div class="mn-cell"><div class="mn-n in">${finFmt(m.in, { compact: true, noPaise: true })}</div><div class="mn-lbl">came in</div></div>
      <div class="mn-cell"><div class="mn-n out">${finFmt(m.out, { compact: true, noPaise: true })}</div><div class="mn-lbl">went out</div></div>
      <div class="mn-cell"><div class="mn-n ${m.net < 0 ? 'out' : 'in'}">${finFmt(m.net, { compact: true, noPaise: true })}</div><div class="mn-lbl">kept</div></div>
    </div>
    ${m.rate != null ? `<div class="mn-rate">You kept <b>${m.rate}%</b> of what came in this month.</div>`
      : `<div class="mn-rate mn-dim">No income recorded this month, so there is no savings rate to work out.</div>`}
    ${proj ? `<div class="mn-proj">At this rate — ${finFmt(proj.spent, { compact: true, noPaise: true })} over ${proj.dayOf} days — this month lands near
      <b>${finFmt(proj.projected, { compact: true, noPaise: true })}</b>. It is a run-rate, not a forecast.</div>` : ''}
  </div>

  <div class="card">
    <h2>Where it went <span class="hint">${cats.length ? cats.length + ' categories' : 'nothing yet'}</span></h2>
    ${top.length ? top.map(c => {
      const cat = finCat(c), v = m.byCat[c];
      const b = budgets[c] || 0;
      const pct = maxCat ? Math.round(v / maxCat * 100) : 0;
      const over = b > 0 && v > b;
      return `<div class="mn-cat">
        <div class="mn-cat-h"><span>${cat.ico} ${escapeHtml(cat.name)}</span>
          ${/* Both numbers use the SAME format. Mixing compact and full rendered an on-budget
                category as "₹22,000 / ₹22.0k" — two spellings of one number, which reads as
                a bug even when the figures agree. */''}
          <span class="mn-cat-v">${finFmt(v, { noPaise: true })}${b > 0 ? ` <span class="${over ? 'mn-over' : 'mn-dim'}">of ${finFmt(b, { noPaise: true })}</span>` : ''}</span></div>
        <div class="mn-bar"><i style="width:${pct}%" class="${over ? 'over' : ''}"></i></div>
      </div>`; }).join('')
      : '<div class="empty">Nothing recorded for this month.</div>'}
    ${cats.length > 7 ? `<div class="hint" style="margin-top:8px">+${cats.length - 7} smaller categories — see Money in/out.</div>` : ''}
  </div>

  ${months.length > 1 ? `<div class="card">
    <h2>Month by month <span class="hint">in vs out</span></h2>
    <div class="mn-bars">${(() => {
      const data = months.map(y => finMonth(y));
      const peak = Math.max(1, ...data.map(d => Math.max(d.in, d.out)));
      return data.map((d, i) => `<div class="mn-bcol ${months[i] === ym ? 'on' : ''}" data-mn-jump="${months[i]}">
        <div class="mn-btrack"><i class="bin" style="height:${Math.round(d.in / peak * 100)}%"></i><i class="bout" style="height:${Math.round(d.out / peak * 100)}%"></i></div>
        <div class="mn-blbl">${months[i].slice(5)}</div></div>`).join('');
    })()}</div>
    <div class="mn-legend"><span><i class="bin"></i>in</span><span><i class="bout"></i>out</span></div>
  </div>` : ''}

  ${mnQuickAddHTML()}`;
}

/* ---- quick add, shared by Overview and the ledger ---- */
function mnQuickAddHTML() {
  const accts = finAccts().filter(a => !a.archived && finKind(a.kind).mode === 'tx');
  if (!accts.length) return `<div class="card"><div class="empty">Add a bank, cash or card account to record money in and out.</div></div>`;
  if (!mnAddOpen) return `<div class="card"><button class="btn btn-primary" id="mn-add-open" style="width:100%">＋ Record money in or out</button></div>`;
  const dir = mnAddOpen === true ? 'out' : mnAddOpen;
  const cats = finCats().filter(c => c.dir === (dir === 'in' ? 'in' : 'out'));
  return `<div class="card">
    <h2>Record ${dir === 'xfer' ? 'a transfer' : dir === 'in' ? 'money in' : 'money out'}</h2>
    <div class="seg-row" style="margin-bottom:11px">
      ${[['out', 'Money out'], ['in', 'Money in'], ['xfer', 'Transfer']].map(([k, l]) =>
        `<button class="seg-btn ${dir === k ? 'on' : ''}" data-mn-dir="${k}">${l}</button>`).join('')}
    </div>
    <div class="field"><label>Amount</label>
      <input type="text" id="mn-amt" inputmode="decimal" placeholder="e.g. 450 or 1.2k" autocomplete="off"></div>
    <div class="pj-row2">
      <div class="field"><label>${dir === 'xfer' ? 'From' : 'Account'}</label>
        <select id="mn-acct">${accts.map(a => `<option value="${a.id}">${finKind(a.kind).ico} ${escapeHtml(a.name)}</option>`).join('')}</select></div>
      ${dir === 'xfer'
        ? `<div class="field"><label>To</label><select id="mn-to">${accts.map(a => `<option value="${a.id}">${finKind(a.kind).ico} ${escapeHtml(a.name)}</option>`).join('')}</select></div>`
        : `<div class="field"><label>Category</label><select id="mn-cat">${cats.map(c => `<option value="${c.id}">${c.ico} ${escapeHtml(c.name)}</option>`).join('')}</select></div>`}
    </div>
    <div class="pj-row2">
      <div class="field"><label>Date</label><input type="date" id="mn-date" value="${todayStr()}" max="${todayStr()}"></div>
      <div class="field"><label>Note <span class="hint">optional</span></label><input type="text" id="mn-note" placeholder="e.g. Netflix" autocomplete="off"></div>
    </div>
    <div class="pj-btns"><button class="btn btn-primary btn-sm" id="mn-save">Save</button>
      <button class="btn btn-ghost btn-sm" id="mn-add-cancel">Cancel</button></div>
  </div>`;
}

/* ---- ledger ---- */
function mnTxHTML() {
  const ym = mnMonth();
  const from = ym + '-01', to = finMonthEnd(ym);
  let list = finTx().filter(t => t.d >= from && t.d <= to);
  if (mnFilter.acct) list = list.filter(t => t.ac === mnFilter.acct || t.to === mnFilter.acct);
  if (mnFilter.cat) list = list.filter(t => t.c === mnFilter.cat);
  list.sort((a, b) => a.d === b.d ? (b.id > a.id ? 1 : -1) : (a.d < b.d ? 1 : -1));
  const byDay = {};
  list.forEach(t => { (byDay[t.d] = byDay[t.d] || []).push(t); });
  const accts = finAccts();
  const usedCats = [...new Set(finTx().map(t => t.c).filter(Boolean))];

  return `${mnQuickAddHTML()}
  <div class="card">
    <div class="mn-mhead">
      <button class="mn-arrow" data-mn-month="-1" aria-label="previous month">‹</button>
      <div class="mn-mname">${escapeHtml(mnMonthLabel(ym))}<span class="hint" style="display:block;font-weight:400">${list.length} record${list.length === 1 ? '' : 's'}</span></div>
      <button class="mn-arrow" data-mn-month="1" aria-label="next month" ${ym >= finYm(todayStr()) ? 'disabled' : ''}>›</button>
    </div>
    <div class="pj-row2">
      <div class="field"><label>Account</label><select id="mn-f-acct"><option value="">All accounts</option>
        ${accts.map(a => `<option value="${a.id}"${mnFilter.acct === a.id ? ' selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Category</label><select id="mn-f-cat"><option value="">All categories</option>
        ${usedCats.map(c => `<option value="${c}"${mnFilter.cat === c ? ' selected' : ''}>${escapeHtml(finCat(c).name)}</option>`).join('')}</select></div>
    </div>
  </div>
  ${Object.keys(byDay).length ? Object.keys(byDay).sort().reverse().map(d => {
    const dayOut = byDay[d].filter(t => t.dir === 'out').reduce((s, t) => s + t.a, 0);
    return `<div class="card mn-day">
      <div class="mn-day-h"><span>${shortDate(d)}</span>${dayOut ? `<span class="mn-day-t">${finFmt(dayOut, { noPaise: true })} out</span>` : ''}</div>
      ${byDay[d].map(mnTxRow).join('')}
    </div>`; }).join('')
    : `<div class="card"><div class="empty">Nothing recorded${mnFilter.acct || mnFilter.cat ? ' for this filter' : ' this month'}.</div></div>`}`;
}
function mnTxRow(t) {
  const editing = mnTxEdit === t.id;
  const cat = finCat(t.c), a = finAcct(t.ac);
  const to = t.to ? finAcct(t.to) : null;
  const sign = t.dir === 'in' ? '+' : t.dir === 'out' ? '−' : '⇄';
  const label = t.dir === 'xfer'
    ? `${a ? escapeHtml(a.name) : '?'} → ${to ? escapeHtml(to.name) : '?'}`
    : (t.n ? escapeHtml(t.n) : escapeHtml(cat.name));
  return `<div class="mn-tx ${t.dir}">
    <button class="mn-tx-main" data-mn-tx="${t.id}">
      <span class="mn-tx-ico">${t.dir === 'xfer' ? '⇄' : cat.ico}</span>
      <span class="mn-tx-txt"><span class="mn-tx-l">${label}</span>
        <span class="mn-tx-s">${t.dir === 'xfer' ? 'transfer' : escapeHtml(cat.name)}${a && t.dir !== 'xfer' ? ' · ' + escapeHtml(a.name) : ''}</span></span>
      <span class="mn-tx-a">${sign}${finFmt(t.a, { noPaise: true }).replace('−', '')}</span>
    </button>
    ${editing ? `<div class="mn-tx-edit">
      <button class="btn btn-ghost btn-sm" data-mn-tx-del="${t.id}">Delete</button>
      <span class="hint">${escapeHtml(t.n || '')}${t.n ? ' · ' : ''}${finFmt(t.a)} on ${shortDate(t.d)}</span></div>` : ''}
  </div>`;
}

/* ---- accounts ---- */
function mnAcctsHTML() {
  const all = finAccts();
  const groups = FIN_KINDS.map(k => ({ k, list: all.filter(a => a.kind === k.k && !a.archived) })).filter(g => g.list.length);
  const arch = all.filter(a => a.archived);
  const w = finSplitWorth();
  return `
  <div class="card">
    <div class="mn-3">
      <div class="mn-cell"><div class="mn-n">${finFmt(w.assets, { compact: true, noPaise: true })}</div><div class="mn-lbl">owned</div></div>
      <div class="mn-cell"><div class="mn-n out">${finFmt(w.debts, { compact: true, noPaise: true })}</div><div class="mn-lbl">owed</div></div>
      <div class="mn-cell"><div class="mn-n ${w.net < 0 ? 'out' : 'in'}">${finFmt(w.net, { compact: true, noPaise: true })}</div><div class="mn-lbl">net worth</div></div>
    </div>
  </div>
  ${groups.map(g => `<div class="card">
    <h2>${g.k.ico} ${g.k.label}${g.list.length > 1 ? 's' : ''}</h2>
    ${g.list.map(a => {
      const b = finBal(a.id);
      const mode = finKind(a.kind).mode;
      return `<div class="mn-acct">
        <button class="mn-acct-main" data-mn-acct="${a.id}">
          <span class="mn-acct-n">${escapeHtml(a.name)}</span>
          <span class="mn-acct-b ${b == null ? 'mn-dim' : b < 0 ? 'out' : ''}">${b == null ? 'no value yet' : finFmt(Math.abs(b), { noPaise: true })}</span>
        </button>
        ${mode === 'valued' ? `<div class="mn-acct-sub">${(() => {
          const ms = finMarks().filter(m => m.ac === a.id).sort((x, y) => x.d < y.d ? 1 : -1);
          return ms.length ? `last updated ${shortDate(ms[0].d)} · ${ms.length} value${ms.length === 1 ? '' : 's'} recorded` : 'add a value to include it in your net worth';
        })()}</div>` : ''}
        ${mnAcctOpen === a.id ? mnAcctFormHTML(a) : ''}
      </div>`; }).join('')}
  </div>`).join('')}
  <div class="card">
    <h2>Add an account</h2>
    <div class="mn-quick">${FIN_KINDS.map(k => `<button class="mn-kbtn" data-mn-new-kind="${k.k}">${k.ico} ${k.label}</button>`).join('')}</div>
    ${mnAcctOpen === 'new' ? mnAcctFormHTML() : ''}
  </div>
  ${arch.length ? `<div class="card"><h2>Closed <span class="hint">${arch.length}</span></h2>
    ${arch.map(a => `<div class="mn-acct"><button class="mn-acct-main" data-mn-acct="${a.id}">
      <span class="mn-acct-n mn-dim">${escapeHtml(a.name)}</span><span class="mn-acct-b mn-dim">closed</span></button>
      ${mnAcctOpen === a.id ? mnAcctFormHTML(a) : ''}</div>`).join('')}</div>` : ''}
  ${mnImportHTML()}
  <div class="card">
    <h2>Currency</h2>
    <div class="field"><label>Symbol</label>
      <input type="text" id="mn-cur" maxlength="3" value="${escapeHtml(finSet().cur)}" style="max-width:90px"></div>
    <div class="hint">Only the symbol shown. Nothing is converted — Daylog does not fetch exchange rates, because that would mean talking to a server.</div>
  </div>`;
}

function mnAcctFormHTML(a) {
  const isNew = !a;
  const kind = isNew ? (mnNewKind || 'bank') : a.kind;
  const k = finKind(kind);
  return `<div class="mn-form">
    <div class="field"><label>Name</label>
      <input type="text" id="mn-a-name" value="${isNew ? '' : escapeHtml(a.name)}" placeholder="${k.k === 'bank' ? 'e.g. HDFC savings' : k.k === 'card' ? 'e.g. Amazon Pay card' : k.k === 'asset' ? 'e.g. Gold, or the flat' : 'e.g. ' + k.label}" autocomplete="off"></div>
    ${k.mode === 'tx'
      ? `${/* This said "Balance right now", which was a lie: it is applied BEFORE everything
               you record, so entering today's balance and then adding a past expense left the
               account short by that expense. */''}
         <div class="field"><label>Starting balance <span class="hint">${k.k === 'card' ? 'what was owed at the start' : 'before anything you record'}</span></label>
          <input type="text" id="mn-a-open" inputmode="decimal" value="${isNew || !a.opening ? '' : (a.opening / 100)}" placeholder="0"></div>
         <div class="field"><label>Starting from</label>
          <input type="date" id="mn-a-since" value="${escapeHtml(isNew ? todayStr() : (finSince(a) || todayStr()))}" max="${todayStr()}"></div>
         <div class="hint" style="margin-bottom:9px">The balance is this figure plus everything you record after that date, so it can never disagree with your own ledger. Before that date the account simply does not count — your net-worth history stays honest instead of pretending it always existed.</div>`
      : `<div class="field"><label>${k.sign < 0 ? 'Amount still owed' : 'What it is worth'} today</label>
          <input type="text" id="mn-a-val" inputmode="decimal" placeholder="0"></div>
         <div class="hint" style="margin-bottom:9px">Update this whenever you like — each update is kept with its date, which is what makes the net-worth line real rather than a straight guess.</div>`}
    <div class="pj-btns">
      <button class="btn btn-primary btn-sm" id="mn-a-save" data-kind="${kind}" data-id="${isNew ? '' : a.id}">${isNew ? 'Add account' : 'Save'}</button>
      <button class="btn btn-ghost btn-sm" id="mn-a-cancel">Cancel</button>
      ${isNew ? '' : `<button class="gap-skip" data-mn-a-arch="${a.id}">${a.archived ? 'Reopen' : 'Close account'}</button>
        <button class="gap-skip" data-mn-a-del="${a.id}">Delete</button>`}
    </div>
  </div>`;
}
let mnNewKind = 'bank';

/* ---- patterns ---- */
function mnInsightsHTML() {
  const pats = finPatterns();
  const rec = finRecurring();
  const ym = mnMonth();
  const movers = finMovers(ym).slice(0, 6);
  const spendDays = Object.keys(finDailySpend()).length;

  return `
  <div class="card">
    <h2 class="h2-icon">${hicon('sparkle')}<span>What your spending follows</span></h2>
    ${pats.length ? pats.map(p => `<div class="mn-ins">
        <div class="mn-ins-h">${escapeHtml(p.head)}</div>
        <div class="mn-ins-b">${escapeHtml(p.body)}</div></div>`).join('')
      : `<div class="mn-noins">
          <p>Nothing solid yet. These come from comparing your spending against your own mood,
          energy, sleep and screen time on the same days — so they need both sides recorded on
          at least ${FIN_MIN_DAYS} days either side of your own median.</p>
          <p class="mn-dim">${spendDays} day${spendDays === 1 ? '' : 's'} with spending recorded so far. Keep logging both and they will appear.</p>
        </div>`}
    ${pats.length ? `<div class="hint" style="margin-top:6px">Each split is on <b>your own</b> median, not a general rule, and none is shown below ${FIN_MIN_DAYS} days on either side. A pattern that is not really there is worse than none.</div>` : ''}
  </div>

  <div class="card">
    <h2>Biggest changes <span class="hint">vs the month before</span></h2>
    ${movers.length ? movers.map(mv => {
      const c = finCat(mv.cat), up = mv.delta > 0;
      return `<div class="mn-mv">
        <span class="mn-mv-c">${c.ico} ${escapeHtml(c.name)}</span>
        <span class="mn-mv-d ${up ? 'up' : 'down'}">${up ? '+' : '−'}${finFmt(Math.abs(mv.delta), { compact: true, noPaise: true })}${
          mv.pct != null ? ` <span class="mn-dim">${mv.pct < 0 ? '−' : '+'}${Math.abs(mv.pct)}%</span>` : ' <span class="mn-dim">new</span>'}</span>
      </div>`; }).join('')
      : '<div class="empty">Not enough months to compare yet.</div>'}
  </div>

  <div class="card">
    <h2>Looks like a subscription <span class="hint">${rec.length || 'none found'}</span></h2>
    ${rec.length ? `${rec.slice(0, 8).map(r => `<div class="mn-mv">
        <span class="mn-mv-c">${finCat(r.cat).ico} ${escapeHtml(r.label)}</span>
        <span class="mn-mv-d">${finFmt(r.avg, { noPaise: true })} <span class="mn-dim">× ${r.months} months</span></span>
      </div>`).join('')}
      <div class="hint" style="margin-top:8px">Charges of about the same size in the same category across 3+ months. It is a guess from your own records, not a bank feed — check before cancelling anything.</div>`
      : `<div class="mn-noins"><p>Nothing repeating three months or more yet. Add a note like “Netflix” when you record a charge and repeats get easier to spot.</p></div>`}
  </div>

  <div class="card">
    <h2>Budgets <span class="hint">optional</span></h2>
    <div class="hint" style="margin-bottom:10px">Set a monthly cap on any category and it shows on the Overview bars. Leave blank for no cap.</div>
    ${(() => { const b = finBudgets(); const m = finMonth(ym);
      const cats = [...new Set(Object.keys(m.byCat).concat(Object.keys(b)))];
      if (!cats.length) return '<div class="empty">Record some spending first.</div>';
      return cats.sort((x, y) => (m.byCat[y] || 0) - (m.byCat[x] || 0)).map(c => `<div class="mn-bud">
        <span class="mn-bud-c">${finCat(c).ico} ${escapeHtml(finCat(c).name)}</span>
        <input type="text" inputmode="decimal" data-mn-bud="${c}" value="${b[c] ? (b[c] / 100) : ''}" placeholder="no cap">
      </div>`).join('');
    })()}
  </div>`;
}

/* ---- CSV import ---- */
function mnImportHTML() {
  if (!mnImport) return `<div class="card">
    <h2>Import from a statement</h2>
    <div class="hint" style="margin-bottom:10px">Most banks let you download a CSV. Pick the file and tell Daylog which column is which — nothing is uploaded, the file is read on this phone.</div>
    <input type="file" id="mn-csv" accept=".csv,text/csv,text/plain">
  </div>`;
  const { head, rows } = mnImport;
  const accts = finAccts().filter(a => !a.archived && finKind(a.kind).mode === 'tx');
  const pick = (id, label, hint) => `<div class="field"><label>${label} ${hint ? `<span class="hint">${hint}</span>` : ''}</label>
    <select data-mn-map="${id}">${['', ...head.map((h, i) => i)].map(i =>
      i === '' ? `<option value="">— none —</option>`
        : `<option value="${i}"${String(mnImport.map[id]) === String(i) ? ' selected' : ''}>${escapeHtml(head[i] || 'column ' + (i + 1))}</option>`).join('')}</select></div>`;
  const prev = mnImportPreview();
  return `<div class="card">
    <h2>Import — ${rows.length} row${rows.length === 1 ? '' : 's'} found</h2>
    <div class="field"><label>Into which account</label>
      <select data-mn-map="acct">${accts.map(a => `<option value="${a.id}"${mnImport.map.acct === a.id ? ' selected' : ''}>${finKind(a.kind).ico} ${escapeHtml(a.name)}</option>`).join('')}</select></div>
    ${pick('date', 'Date column')}
    ${pick('desc', 'Description column')}
    ${pick('out', 'Money out / debit')}
    ${pick('in', 'Money in / credit', 'leave as none if one column holds both')}
    ${mnImport.map.in === '' || mnImport.map.in == null
      ? `<div class="hint" style="margin-bottom:9px">With only one amount column, negative values are treated as money out and positive as money in.</div>` : ''}
    <div class="hint" style="margin-bottom:9px"><b>${prev.ok}</b> of ${rows.length} rows read cleanly${prev.bad ? `, <b>${prev.bad}</b> skipped (no date or no amount)` : ''}${prev.dupes ? `, <b>${prev.dupes}</b> already recorded and will be skipped` : ''}.</div>
    ${prev.sample.length ? `<div class="mn-prev">${prev.sample.map(r => `<div class="mn-prev-r">
      <span>${shortDate(r.d)}</span><span class="mn-prev-n">${escapeHtml(r.n || '—')}</span>
      <span class="${r.dir === 'in' ? 'in' : 'out'}">${r.dir === 'in' ? '+' : '−'}${finFmt(r.a, { noPaise: true })}</span></div>`).join('')}</div>` : ''}
    <div class="pj-btns">
      <button class="btn btn-primary btn-sm" id="mn-imp-go" ${prev.ok ? '' : 'disabled'}>Import ${prev.ok} record${prev.ok === 1 ? '' : 's'}</button>
      <button class="btn btn-ghost btn-sm" id="mn-imp-cancel">Cancel</button>
    </div>
    <div class="hint" style="margin-top:8px">Everything lands in <b>Other spending</b> or <b>Other income</b> — recategorise from Money in/out. Rows that match something already recorded on the same day for the same amount are skipped, so importing twice does not double your history.</div>
  </div>`;
}

/* ---- CSV: a real parser, because bank statements contain commas inside quotes ---- */
function csvParse(text) {
  const rows = []; let row = [], cell = '', q = false;
  const s = String(text).replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
/* Banks write dates every possible way. Handles ISO, dd/mm/yyyy, dd-mm-yy and "12 Jan 2026".
   dd/mm is assumed over mm/dd — this app's users are not all American, and guessing wrong
   silently reorders someone's whole year. Ambiguous rows are dropped, not guessed. */
function csvDate(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (+d > 31 || +mo > 12) return null;
    if (y.length === 2) y = (+y > 70 ? '19' : '20') + y;
    return `${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}`;
  }
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3})[A-Za-z]*[\s\-,]*(\d{2,4})/);
  if (m) {
    const mi = MON.indexOf(m[2].toLowerCase());
    if (mi < 0) return null;
    let y = m[3]; if (y.length === 2) y = '20' + y;
    return `${y}-${String(mi + 1).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
  }
  return null;
}
function mnGuessMap(head) {
  const f = (...pats) => {
    for (const p of pats) {
      const i = head.findIndex(h => new RegExp(p, 'i').test(String(h)));
      if (i >= 0) return i;
    }
    return '';
  };
  return {
    acct: (finAccts().filter(a => !a.archived && finKind(a.kind).mode === 'tx')[0] || {}).id || '',
    date: f('^date', 'txn.*date', 'value.*date', 'date'),
    desc: f('narration', 'description', 'particular', 'remark', 'detail', 'refer'),
    out:  f('withdraw', 'debit', 'dr\\b', 'spent', 'paid.*out', '^amount$'),
    in:   f('deposit', '^credit', 'cr\\b', 'received', 'paid.*in'),
  };
}
/* Reads the mapped rows into transactions. Never writes — the preview and the import share
   this, so what you see is exactly what gets saved. */
function mnImportRows() {
  if (!mnImport) return { rows: [], bad: 0, dupes: 0 };
  const { rows, map } = mnImport;
  const has = k => map[k] !== '' && map[k] != null;
  const existing = new Set(finTx().map(t => t.d + '|' + t.a + '|' + t.dir));
  const out = []; let bad = 0, dupes = 0;
  rows.forEach(r => {
    const d = has('date') ? csvDate(r[map.date]) : null;
    if (!d || d > todayStr()) { bad++; return; }
    let a = null, dir = 'out';
    const rawOut = has('out') ? String(r[map.out] || '').trim() : '';
    const rawIn = has('in') ? String(r[map.in] || '').trim() : '';
    if (has('in') && rawIn && parseAmt(rawIn)) { a = parseAmt(rawIn); dir = 'in'; }
    else if (rawOut && parseAmt(rawOut)) {
      a = parseAmt(rawOut);
      /* One-column statements carry the sign. With separate debit/credit columns the sign is
         already implied by which column it sat in, so a stray minus must not flip it. */
      dir = (!has('in') && /^\s*-/.test(rawOut)) ? 'out' : (!has('in') && !/^\s*-/.test(rawOut) ? 'in' : 'out');
    }
    if (!a) { bad++; return; }
    const key = d + '|' + a + '|' + dir;
    if (existing.has(key)) { dupes++; return; }
    out.push({ d, a, dir, n: has('desc') ? String(r[map.desc] || '').trim().slice(0, 90) : '',
      c: dir === 'in' ? 'otherin' : 'otherout', ac: map.acct });
  });
  return { rows: out, bad, dupes };
}
function mnImportPreview() {
  const r = mnImportRows();
  return { ok: r.rows.length, bad: r.bad, dupes: r.dupes, sample: r.rows.slice(0, 6) };
}

/* ---- writes ---- */
function mnTxId() {
  const log = finTx(); let id = 'f' + Date.now(), n = 0;
  while (log.some(t => t.id === id)) id = 'f' + Date.now() + '-' + (++n);
  return id;
}
function mnAddTx(o) {
  const list = finTx();
  list.push(Object.assign({ id: mnTxId() }, o));
  finSaveTx(list);
}

/* ---- handlers ---- */
document.addEventListener('click', (ev) => {
  const t = ev.target;
  const tab = t.closest('[data-mn-tab]');
  if (tab) { mnTab = tab.dataset.mnTab; mnTxEdit = null; mnAcctOpen = null; renderMoney(); window.scrollTo(0, 0); return; }
  const mo = t.closest('[data-mn-month]');
  if (mo) { if (!mo.disabled) mnShiftMonth(+mo.dataset.mnMonth); return; }
  const jump = t.closest('[data-mn-jump]');
  if (jump) { mnYm = jump.dataset.mnJump; renderMoney(); return; }

  const nk = t.closest('[data-mn-new-kind]');
  if (nk) { mnNewKind = nk.dataset.mnNewKind; mnAcctOpen = 'new'; renderMoney();
    setTimeout(() => { const i = document.getElementById('mn-a-name'); if (i) i.focus(); }, 30); return; }
  const ac = t.closest('[data-mn-acct]');
  if (ac) { mnAcctOpen = mnAcctOpen === ac.dataset.mnAcct ? null : ac.dataset.mnAcct; renderMoney(); return; }
  if (t.id === 'mn-a-cancel') { mnAcctOpen = null; renderMoney(); return; }
  if (t.id === 'mn-a-save') {
    const kind = t.dataset.kind, id = t.dataset.id;
    const name = (document.getElementById('mn-a-name').value || '').trim().slice(0, 60);
    if (!name) { toast('Give the account a name', true); return; }
    const k = finKind(kind);
    const all = finAccts();
    if (id) {
      const a = all.find(x => x.id === id); if (!a) return;
      a.name = name;
      if (k.mode === 'tx') {
        const v = parseAmt(document.getElementById('mn-a-open').value); a.opening = v == null ? 0 : v;
        const sc = document.getElementById('mn-a-since');
        if (sc && sc.value) a.since = sc.value;
      }
      finSaveAccts(all);
    } else {
      const nid = 'a' + Date.now();
      const rec = { id: nid, name, kind, opening: 0, created: todayStr() };
      if (k.mode === 'tx') {
        const v = parseAmt(document.getElementById('mn-a-open').value); rec.opening = v == null ? 0 : v;
        const sc = document.getElementById('mn-a-since');
        rec.since = (sc && sc.value) || todayStr();
      }
      all.push(rec); finSaveAccts(all);
      if (k.mode === 'valued') {
        const v = parseAmt(document.getElementById('mn-a-val').value);
        if (v != null) { const ms = finMarks(); ms.push({ id: 'm' + Date.now(), ac: nid, d: todayStr(), v }); finSaveMarks(ms); }
      }
    }
    mnAcctOpen = null; renderMoney(); buzz(12); toast(id ? 'Saved' : 'Account added');
    return;
  }
  const arch = t.closest('[data-mn-a-arch]');
  if (arch) { const all = finAccts(); const a = all.find(x => x.id === arch.dataset.mnAArch);
    if (a) { a.archived = !a.archived; finSaveAccts(all); }
    mnAcctOpen = null; renderMoney(); return; }
  const adel = t.closest('[data-mn-a-del]');
  if (adel) {
    const id = adel.dataset.mnADel, a = finAcct(id);
    const n = finTx().filter(x => x.ac === id || x.to === id).length;
    if (!confirm(`Delete "${a ? a.name : 'this account'}"?` + (n ? `\n\n${n} record${n === 1 ? '' : 's'} on it will be deleted too. This cannot be undone — "Close account" keeps the history instead.` : ''))) return;
    finSaveAccts(finAccts().filter(x => x.id !== id));
    finSaveTx(finTx().filter(x => x.ac !== id && x.to !== id));
    finSaveMarks(finMarks().filter(m => m.ac !== id));
    mnAcctOpen = null; renderMoney(); toast('Account deleted');
    return;
  }

  if (t.id === 'mn-add-open') { mnAddOpen = 'out'; renderMoney();
    setTimeout(() => { const i = document.getElementById('mn-amt'); if (i) i.focus(); }, 30); return; }
  if (t.id === 'mn-add-cancel') { mnAddOpen = false; renderMoney(); return; }
  const dirb = t.closest('[data-mn-dir]');
  if (dirb) { mnAddOpen = dirb.dataset.mnDir; renderMoney();
    setTimeout(() => { const i = document.getElementById('mn-amt'); if (i) i.focus(); }, 30); return; }
  if (t.id === 'mn-save') {
    const a = parseAmt(document.getElementById('mn-amt').value);
    if (a == null || a <= 0) { toast('Enter an amount', true); return; }
    const dir = mnAddOpen === true ? 'out' : mnAddOpen;
    const ac = document.getElementById('mn-acct').value;
    const d = document.getElementById('mn-date').value || todayStr();
    const n = (document.getElementById('mn-note').value || '').trim().slice(0, 90);
    if (dir === 'xfer') {
      const to = document.getElementById('mn-to').value;
      if (to === ac) { toast('Pick two different accounts', true); return; }
      mnAddTx({ d, a, dir: 'xfer', ac, to, c: '', n });
    } else {
      mnAddTx({ d, a, dir, ac, c: document.getElementById('mn-cat').value, n });
    }
    mnAddOpen = false; mnYm = finYm(d); renderMoney(); buzz(12);
    toast(`${dir === 'in' ? 'Money in' : dir === 'xfer' ? 'Transfer' : 'Money out'} recorded`);
    return;
  }

  const tx = t.closest('[data-mn-tx]');
  if (tx) { mnTxEdit = mnTxEdit === tx.dataset.mnTx ? null : tx.dataset.mnTx; renderMoney(); return; }
  const txd = t.closest('[data-mn-tx-del]');
  if (txd) { const wrote12 = finSaveTx(finTx().filter(x => x.id !== txd.dataset.mnTxDel)); mnTxEdit = null; renderMoney(); savedToast(wrote12, 'Deleted'); return; }

  if (t.id === 'mn-imp-cancel') { mnImport = null; renderMoney(); return; }
  if (t.id === 'mn-imp-go') {
    const r = mnImportRows();
    if (!r.rows.length) { toast('Nothing to import', true); return; }
    const list = finTx();
    r.rows.forEach((x, i) => list.push(Object.assign({ id: 'f' + Date.now() + '-' + i }, x)));
    finSaveTx(list);
    mnImport = null; mnTab = 'tx'; renderMoney(); buzz(14);
    toast(`Imported ${r.rows.length} record${r.rows.length === 1 ? '' : 's'}`);
    return;
  }
});

document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.id === 'mn-f-acct') { mnFilter.acct = t.value; renderMoney(); return; }
  if (t.id === 'mn-f-cat') { mnFilter.cat = t.value; renderMoney(); return; }
  if (t.id === 'mn-cur') {
    const s = finSet(); s.cur = (t.value || '₹').trim().slice(0, 3) || '₹'; finSaveSet(s); renderMoney(); return;
  }
  const bud = t.closest('[data-mn-bud]');
  if (bud) {
    const b = finBudgets(); const v = parseAmt(bud.value);
    if (v == null || v <= 0) delete b[bud.dataset.mnBud]; else b[bud.dataset.mnBud] = v;
    finSaveBudgets(b); renderMoney(); return;
  }
  const map = t.closest('[data-mn-map]');
  if (map && mnImport) { mnImport.map[map.dataset.mnMap] = map.value; renderMoney(); return; }
  if (t.id === 'mn-csv' && t.files && t.files[0]) {
    const f = t.files[0];
    const rd = new FileReader();
    rd.onload = () => {
      const rows = csvParse(rd.result || '');
      if (rows.length < 2) { toast('That file has no rows Daylog can read', true); return; }
      /* First row is a header only if it has no readable date in it — some exports start
         straight into data, and eating the first transaction is a silent data loss. */
      const looksHeader = !csvDate(rows[0][0]) && !rows[0].some(c => csvDate(c));
      const head = looksHeader ? rows[0].map(h => String(h).trim()) : rows[0].map((_, i) => 'Column ' + (i + 1));
      const body = looksHeader ? rows.slice(1) : rows;
      mnImport = { head, rows: body, map: mnGuessMap(head) };
      mnTab = 'accts'; renderMoney();
      toast(`Read ${body.length} rows — check the columns below`);
    };
    rd.onerror = () => toast('Could not read that file', true);
    rd.readAsText(f);
    return;
  }
});


/* ============================================================
   MONEY CHARTS — SVG built here, no library, theme-aware through CSS variables.
   ------------------------------------------------------------
   Rules these follow, from the app's own data-viz discipline:
     · one hero figure per view, not a wall of equal-weight charts
     · colour carries the SERIES, never the rank, so a filter cannot repaint the survivors
     · money direction is status (in/out), which uses the *-ink tokens, not the accent
     · never a second y-axis — two measures of different scale get two charts
     · every figure is role="img" with a spoken summary, and every one has an honest empty
       state that says what is missing rather than drawing an empty box
   Coordinates are a fixed viewBox scaled by CSS, so one code path serves every width.
   ============================================================ */

const CH_W = 320, CH_H = 150, CH_PAD = { t: 12, r: 8, b: 20, l: 38 };
/* The y-axis gutter has to fit the LONGEST tick label it will draw. A fixed 38 units was
   enough for "₹0" and not for "₹2.8L": tick text is anchored at the gutter's right edge and
   grows leftwards, so a 52-unit label started at x=-19 and was sliced off the viewBox. The
   layout eval caught it as text-clipped. ~4.7 units per character at the 8px tick size,
   measured against the rendered labels rather than guessed. */
function chPadL(labels) {
  const longest = labels.reduce((m, l) => Math.max(m, String(l).length), 2);
  return Math.min(96, Math.max(26, Math.round(longest * 4.7) + 9));
}
function chNice(max) {
  if (max <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / mag) * mag;
}
function chAxisLabel(minor) { return finFmt(minor, { compact: true, noPaise: true }); }
function chEmpty(msg) { return `<div class="ch-empty">${escapeHtml(msg)}</div>`; }

/* Multi-series line/area. `series` = [{ key, label, cls, pts: [num] }] sharing one x scale. */
function chLines(series, xLabels, opts) {
  opts = opts || {};
  const live = series.filter(s => s.pts.some(v => v != null));
  if (!live.length) return chEmpty(opts.empty || 'Nothing to chart yet.');
  const all = live.flatMap(s => s.pts.filter(v => v != null));
  const hi = chNice(Math.max(...all, 1));
  const lo = opts.zero === false ? Math.min(...all, 0) : 0;
  const ticks = [0, 0.5, 1].map(f => lo + (hi - lo) * f);
  const padL = chPadL(ticks.map(chAxisLabel));
  const iw = CH_W - padL - CH_PAD.r, ih = CH_H - CH_PAD.t - CH_PAD.b;
  const n = Math.max(1, xLabels.length - 1);
  const X = i => padL + (i / n) * iw;
  const Y = v => CH_PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const grid = ticks.map(v =>
    `<line class="ch-grid" x1="${padL}" x2="${CH_W - CH_PAD.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"></line>
      <text class="ch-ytick" x="${padL - 5}" y="${(Y(v) + 3.5).toFixed(1)}">${chAxisLabel(v)}</text>`).join('');
  const every = Math.ceil(xLabels.length / 6);
  const xt = xLabels.map((l, i) => (i % every === 0 || i === xLabels.length - 1)
    ? `<text class="ch-xtick" x="${X(i).toFixed(1)}" y="${CH_H - 5}">${escapeHtml(l)}</text>` : '').join('');
  const paths = live.map(s => {
    const pts = s.pts.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
    if (pts.length < 2) {
      return pts.length === 1 ? `<circle class="ch-dot ${s.cls}" cx="${pts[0][0].toFixed(1)}" cy="${pts[0][1].toFixed(1)}" r="3.5"></circle>` : '';
    }
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = opts.area ? `<path class="ch-area ${s.cls}" d="${d} L${pts[pts.length - 1][0].toFixed(1)},${Y(lo).toFixed(1)} L${pts[0][0].toFixed(1)},${Y(lo).toFixed(1)} Z"></path>` : '';
    const last = pts[pts.length - 1];
    return `${area}<path class="ch-line ${s.cls}" d="${d}"></path>
      <circle class="ch-dot ${s.cls}" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5"></circle>`;
  }).join('');
  const spoken = live.map(s => {
    const v = s.pts.filter(x => x != null);
    return `${s.label}: ${chAxisLabel(v[v.length - 1])} latest, ${chAxisLabel(Math.max(...v))} highest`;
  }).join('. ');
  return `<div class="ch-wrap"><svg class="ch" viewBox="0 0 ${CH_W} ${CH_H}" role="img"
    aria-label="${escapeHtml((opts.title || 'Chart') + '. ' + spoken)}">${grid}${paths}${xt}</svg></div>
    ${live.length > 1 ? `<div class="ch-legend">${live.map(s => `<span><i class="${s.cls}"></i>${escapeHtml(s.label)}</span>`).join('')}</div>` : ''}`;
}

/* Grouped bars. `groups` = [{ label, bars: [{ cls, v, label }] }] */
function chBars(groups, opts) {
  opts = opts || {};
  const all = groups.flatMap(g => g.bars.map(b => b.v));
  if (!all.length || !all.some(v => v > 0)) return chEmpty(opts.empty || 'Nothing to chart yet.');
  const hi = chNice(Math.max(...all, 1));
  const ticks = [0, 0.5, 1].map(f => hi * f);
  const padL = chPadL(ticks.map(chAxisLabel));
  const iw = CH_W - padL - CH_PAD.r, ih = CH_H - CH_PAD.t - CH_PAD.b;
  const slot = iw / groups.length;
  const nb = Math.max(1, groups[0].bars.length);
  const bw = Math.max(3, Math.min(14, (slot - 6) / nb));
  const Y = v => CH_PAD.t + ih - (v / hi) * ih;
  const grid = ticks.map(v =>
    `<line class="ch-grid" x1="${padL}" x2="${CH_W - CH_PAD.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"></line>
      <text class="ch-ytick" x="${padL - 5}" y="${(Y(v) + 3.5).toFixed(1)}">${chAxisLabel(v)}</text>`).join('');
  const bars = groups.map((g, gi) => {
    const cx = padL + slot * gi + slot / 2;
    const startX = cx - (nb * bw + (nb - 1) * 2) / 2;
    return g.bars.map((b, bi) => {
      const h = Math.max(b.v > 0 ? 2 : 0, CH_PAD.t + ih - Y(b.v));
      /* 4px rounded top only, anchored to the baseline — a fully rounded bar reads as a
         different mark and detaches from its axis. */
      return `<rect class="ch-bar ${b.cls}" x="${(startX + bi * (bw + 2)).toFixed(1)}" y="${(CH_PAD.t + ih - h).toFixed(1)}"
        width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5"></rect>`;
    }).join('') +
      `<text class="ch-xtick" x="${cx.toFixed(1)}" y="${CH_H - 5}">${escapeHtml(g.label)}</text>`;
  }).join('');
  const spoken = groups.map(g => `${g.label} ${g.bars.map(b => `${b.label || ''} ${chAxisLabel(b.v)}`).join(', ')}`).join('. ');
  return `<div class="ch-wrap"><svg class="ch" viewBox="0 0 ${CH_W} ${CH_H}" role="img"
    aria-label="${escapeHtml((opts.title || 'Chart') + '. ' + spoken)}">${grid}${bars}</svg></div>
    ${nb > 1 ? `<div class="ch-legend">${groups[0].bars.map(b => `<span><i class="${b.cls}"></i>${escapeHtml(b.label || '')}</span>`).join('')}</div>` : ''}`;
}

/* Horizontal ranked bars — the right form for "which categories, biggest first". */
function chRanked(items, opts) {
  opts = opts || {};
  if (!items.length) return chEmpty(opts.empty || 'Nothing to chart yet.');
  const hi = Math.max(...items.map(i => i.v), 1);
  return `<div class="ch-rank" role="img" aria-label="${escapeHtml((opts.title || '') + '. ' + items.map(i => i.label + ' ' + chAxisLabel(i.v)).join(', '))}">
    ${items.map(i => `<div class="ch-rank-r">
      <div class="ch-rank-h"><span>${i.ico ? i.ico + ' ' : ''}${escapeHtml(i.label)}</span><span class="ch-rank-v">${finFmt(i.v, { noPaise: true })}</span></div>
      <div class="ch-rank-t"><i style="width:${Math.max(1, Math.round(i.v / hi * 100))}%"></i></div>
    </div>`).join('')}</div>`;
}

/* A month as a calendar of spending intensity. Five steps of ONE hue — sequential data must
   never be a rainbow — and days with no spending stay empty rather than becoming step zero,
   because "no spending" and "least spending" are different facts. */
function chCalendar(ym) {
  const spend = finDailySpend();
  const from = ym + '-01', to = finMonthEnd(ym);
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ d, v: spend[d] || 0 });
  const vals = days.map(x => x.v).filter(v => v > 0);
  if (!vals.length) return chEmpty('No spending recorded this month.');
  /* Scale to the 90th percentile, not the maximum. One rent payment of 22,000 against normal
     days of 300-1,600 pushed every ordinary day into the lightest step and left the grid
     effectively monochrome — the opposite of what a heatmap is for. Days above the ceiling
     clamp to the darkest step and the key says so, so nothing is hidden. */
  const sorted = vals.slice().sort((a, b) => a - b);
  const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
  const peak = Math.max(...vals);
  const hi = Math.max(1, p90);
  const clipped = peak > hi;
  const step = v => v <= 0 ? 0 : Math.min(5, Math.max(1, Math.ceil(v / hi * 5)));
  const lead = new Date(from + 'T00:00:00').getDay();
  const offset = (lead + 6) % 7;                       // weeks start Monday
  const cells = Array(offset).fill('<i class="ch-cal-pad"></i>')
    .concat(days.map(x => `<i class="ch-cal-c s${step(x.v)}" title="${shortDate(x.d)} · ${x.v ? finFmt(x.v, { noPaise: true }) : 'nothing'}"></i>`)).join('');
  const busiest = days.slice().sort((a, b) => b.v - a.v)[0];
  return `<div class="ch-cal" role="img" aria-label="Spending by day. Busiest ${shortDate(busiest.d)} at ${finFmt(busiest.v, { noPaise: true })}.">
      <div class="ch-cal-h">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="ch-cal-g">${cells}</div>
    </div>
    <div class="ch-cal-k"><span>less</span>${[1, 2, 3, 4, 5].map(s => `<i class="ch-cal-c s${s}"></i>`).join('')}<span>${clipped ? finFmt(hi, { compact: true, noPaise: true }) + '+' : 'more'}</span>
      <span class="ch-cal-max">busiest ${shortDate(busiest.d)} · ${finFmt(busiest.v, { noPaise: true })}</span></div>`;
}

/* ---- the Charts tab ---- */
/* MEDIAN, not mean. On real data the mean is hijacked by whichever weekday the rent happens
   to land on: with rent on the 3rd, the mean reported Friday as the most expensive day at
   ₹2,770 while the median put Friday at ₹476 and correctly identified the weekend. A
   day-of-week profile is meant to describe behaviour, and one monthly bill is not behaviour.
   The mean is kept alongside so the two can be compared rather than one hidden. */
function finDowProfile() {
  const spend = finDailySpend();
  const buckets = [[], [], [], [], [], [], []];
  Object.keys(spend).forEach(d => {
    buckets[(new Date(d + 'T00:00:00').getDay() + 6) % 7].push(spend[d]);   // Mon = 0
  });
  return buckets.map((b, i) => ({
    i, n: b.length,
    typical: b.length ? Math.round(dpMedian(b)) : 0,
    avg: b.length ? Math.round(b.reduce((x, y) => x + y, 0) / b.length) : 0,
  }));
}
/* Cumulative spend through the month, this month against last — the one chart that answers
   "am I ahead or behind?", which a monthly total cannot. */
function finCumulative(ym) {
  const [y, m] = ym.split('-').map(Number);
  const prev = finYm(todayStr(new Date(y, m - 2, 1)));
  const build = key => {
    const end = +finMonthEnd(key).slice(8, 10);
    const spend = finDailySpend();
    const out = []; let run = 0;
    for (let d = 1; d <= end; d++) {
      const ds = key + '-' + String(d).padStart(2, '0');
      run += spend[ds] || 0;
      out.push(ds > todayStr() ? null : run);
    }
    return out;
  };
  return { ym, prev, now: build(ym), was: build(prev) };
}

function mnChartsHTML() {
  const ym = mnMonth();
  const months = finRecentMonths(12);
  const worth = finWorthSeries(12);
  const anyWorth = worth.some(w => w.v !== 0);
  const md = months.map(k => finMonth(k));
  const cum = finCumulative(ym);
  const dow = finDowProfile();
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const m = finMonth(ym);
  const catRows = Object.keys(m.byCat).sort((a, b) => m.byCat[b] - m.byCat[a]).slice(0, 8)
    .map(c => ({ label: finCat(c).name, ico: finCat(c).ico, v: m.byCat[c] }));
  const topCats = Object.keys(md.reduce((acc, x) => { Object.keys(x.byCat).forEach(k => acc[k] = (acc[k] || 0) + x.byCat[k]); return acc; }, {}))
    .sort((a, b) => md.reduce((s, x) => s + (x.byCat[b] || 0), 0) - md.reduce((s, x) => s + (x.byCat[a] || 0), 0))
    .slice(0, 6);

  return `
  <div class="card">
    <h2>Net worth <span class="hint">12 months</span></h2>
    ${anyWorth
      ? chLines([{ key: 'nw', label: 'Net worth', cls: 'c-nw', pts: worth.map(w => w.v) }],
          months.map(k => k.slice(5)), { area: true, zero: false, title: 'Net worth over 12 months' })
      : chEmpty('Add an account with a balance to chart your net worth.')}
    <div class="hint" style="margin-top:6px">Months before an account existed are not counted, so this line does not pretend you always held what you hold now.</div>
  </div>

  <div class="card">
    <h2>Spending so far <span class="hint">this month vs last</span></h2>
    ${chLines([
        { key: 'now', label: mnMonthLabel(cum.ym).split(' ')[0], cls: 'c-now', pts: cum.now },
        { key: 'was', label: mnMonthLabel(cum.prev).split(' ')[0], cls: 'c-was', pts: cum.was },
      ], cum.now.map((_, i) => String(i + 1)), { title: 'Cumulative spending, this month against last month' })}
    ${(() => {
      const nowV = cum.now.filter(v => v != null);
      const day = nowV.length;
      if (!day || !cum.was.length) return '';
      const wasAtSameDay = cum.was[Math.min(day, cum.was.length) - 1];
      if (wasAtSameDay == null) return '';
      const diff = nowV[day - 1] - wasAtSameDay;
      if (Math.abs(diff) < 100) return `<div class="hint" style="margin-top:6px">Level with last month at this point.</div>`;
      return `<div class="ch-note ${diff > 0 ? 'bad' : 'good'}">
        ${finFmt(Math.abs(diff), { noPaise: true })} ${diff > 0 ? 'more' : 'less'} than by day ${day} last month.</div>`;
    })()}
  </div>

  <div class="card">
    <h2>In, out and kept <span class="hint">12 months</span></h2>
    ${chBars(months.map((k, i) => ({ label: k.slice(5), bars: [
        { cls: 'c-in', v: md[i].in, label: 'in' },
        { cls: 'c-out', v: md[i].out, label: 'out' },
      ] })), { title: 'Income and spending by month', empty: 'Record some money in and out to chart this.' })}
    ${(() => {
      const kept = md.map(x => x.net);
      const good = kept.filter(v => v > 0).length;
      return md.some(x => x.in || x.out)
        ? `<div class="hint" style="margin-top:6px">You kept more than you spent in <b>${good}</b> of the last ${months.length} months.</div>` : '';
    })()}
  </div>

  <div class="card">
    <h2>Where it went <span class="hint">${escapeHtml(mnMonthLabel(ym))}</span></h2>
    ${chRanked(catRows, { title: 'Spending by category', empty: 'Nothing recorded for this month.' })}
  </div>

  <div class="card">
    <h2>Day of the week <span class="hint">typical spend</span></h2>
    ${dow.some(d => d.n)
      ? chBars(dow.map(d => ({ label: DOW[d.i].slice(0, 1), bars: [{ cls: 'c-out', v: d.typical, label: DOW[d.i] }] })),
          { title: 'Typical spending by day of week' })
      : chEmpty('Record a few days of spending to see this.')}
    ${(() => {
      const withData = dow.filter(d => d.n >= 3);
      if (withData.length < 4) return '<div class="hint" style="margin-top:6px">Needs at least three of each weekday before the shape means anything.</div>';
      const worst = withData.slice().sort((a, b) => b.typical - a.typical)[0];
      const skewed = withData.filter(d => d.avg > d.typical * 2);
      return `<div class="hint" style="margin-top:6px"><b>${DOW[worst.i]}</b> is your most expensive day — a typical one costs ${finFmt(worst.typical, { noPaise: true })}, across ${worst.n} of them.
        This is the <b>middle</b> day rather than the average${skewed.length ? `, because a single monthly bill would otherwise make ${(() => {
          const ns = skewed.map(d => DOW[d.i]);
          return ns.length === 1 ? ns[0] : ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1];
        })()} look like ${skewed.length === 1 ? 'a habit' : 'habits'}` : ''}.</div>`;
    })()}
  </div>

  <div class="card">
    <h2>Every day this month <span class="hint">${escapeHtml(mnMonthLabel(ym))}</span></h2>
    ${chCalendar(ym)}
  </div>

  ${topCats.length ? `<div class="card">
    <h2>Category trends <span class="hint">12 months</span></h2>
    <div class="ch-small">${topCats.map(c => {
      const pts = md.map(x => (x.byCat[c] || 0) / 100);
      const first = pts.slice(0, 6).reduce((a, b) => a + b, 0), last = pts.slice(6).reduce((a, b) => a + b, 0);
      const dir = last > first * 1.15 ? 'up' : last < first * 0.85 ? 'down' : 'flat';
      return `<div class="ch-sm">
        <div class="ch-sm-h">${finCat(c).ico} ${escapeHtml(finCat(c).name)}
          <span class="ch-sm-d ${dir}">${dir === 'up' ? '▲ rising' : dir === 'down' ? '▼ falling' : '— steady'}</span></div>
        ${sparkline(pts, 'poly', 132, 30)}
        <div class="ch-sm-f">${finFmt(md[md.length - 1].byCat[c] || 0, { compact: true, noPaise: true })} this month · ${finFmt(Math.round(pts.reduce((a, b) => a + b, 0) * 100 / pts.length), { compact: true, noPaise: true })} monthly average</div>
      </div>`; }).join('')}</div>
    <div class="hint" style="margin-top:8px">Rising or falling compares the last six months against the six before. Under a 15% change it is called steady rather than dressed up as a trend.</div>
  </div>` : ''}`;
}


/* ============================================================
   ASK — a question box over the analysis this app already does.
   ------------------------------------------------------------
   NO MODEL. Deliberately. Daylog's insights are trusted because they are COMPUTED: real
   medians, stated sample sizes, "not enough data" when that is the truth. A small language
   model cannot do arithmetic reliably, so pointing one at the ledger would eventually
   produce a confident number that does not exist — the exact fabricated-statistic failure
   this app has spent months removing, and the one a finance feature cannot survive.

   So every answer here is produced by calling the SAME functions the screens call
   (finMonth, loggedStreak, computePatterns, …) and formatting what comes back. A number can
   only appear in an answer if a computation returned it. The intent router is regex over a
   fixed list of skills; anything it does not recognise gets an honest "I can't answer that
   yet" plus what it CAN do — never a guess.

   Phase 2 (a local model that phrases these results) would slot in behind askRun(): the
   skills below are already the tool surface it would call, and the rule would stay that the
   model may never emit a digit the tools did not hand it. Nothing here assumes it.
   ============================================================ */

const ASK_MAX_HISTORY = 40;          // a session log, not an archive
let askLog = [];                     // [{ q, a, at }] — in memory only, never persisted

/* Every skill: an id, the patterns that select it, an example for the suggestion chips, and
   run() returning { title, lines[], empty? }. `lines` are pre-escaped HTML fragments built
   from computed values. */
const ASK_SKILLS = [
  {
    id: 'streak',
    pats: [/\bstreak\b/i, /\bin a row\b/i, /how many days.*(logged|straight)/i],
    ex: 'What is my streak?',
    run() {
      const cur = loggedStreak(), best = longestLoggedStreak(), total = contentDates().length;
      if (!total) return { empty: 'You have not logged a day yet — log today and this starts working.' };
      const wk = (typeof weekStreak === 'function') ? weekStreak() : null;
      const lines = [
        `Your current streak is <b>${cur}</b> day${cur === 1 ? '' : 's'}.`,
        `Your longest ever is <b>${best}</b>, and you have logged <b>${total}</b> day${total === 1 ? '' : 's'} in total.`,
      ];
      if (wk && wk.cur != null) lines.push(`Weekly: <b>${wk.cur}</b> week${wk.cur === 1 ? '' : 's'} in a row counted (a week counts at ${WEEK_MIN} logged days).`);
      if (cur === 0) lines.push(`Nothing logged today yet — logging anything starts it again.`);
      return { title: 'Streak', lines };
    },
  },
  {
    id: 'money-month',
    pats: [/(where|what).*(money|spend|spent|go)/i, /how much.*(spend|spent)/i, /\b(spending|expenses|outgoings)\b/i],
    ex: 'Where did my money go?',
    run() {
      if (!finAccts().length) return { empty: 'No accounts set up yet — add one on the Money screen and this starts working.' };
      const ym = finYm(todayStr()), m = finMonth(ym);
      if (!m.in && !m.out) return { empty: `Nothing recorded for ${mnMonthLabel(ym)} yet.` };
      const cats = Object.keys(m.byCat).sort((a, b) => m.byCat[b] - m.byCat[a]);
      const lines = [
        `In ${escapeHtml(mnMonthLabel(ym))}: <b>${finFmt(m.in, { compact: true, noPaise: true })}</b> in, <b>${finFmt(m.out, { compact: true, noPaise: true })}</b> out, <b>${finFmt(m.net, { compact: true, noPaise: true })}</b> kept.`,
      ];
      if (m.rate != null) lines.push(`That is <b>${m.rate}%</b> of what came in.`);
      else lines.push(`No income recorded this month, so there is no savings rate to work out.`);
      cats.slice(0, 5).forEach(c => {
        lines.push(`${finCat(c).ico} ${escapeHtml(finCat(c).name)} — <b>${finFmt(m.byCat[c], { noPaise: true })}</b>`);
      });
      if (cats.length > 5) lines.push(`<span class="ask-dim">+${cats.length - 5} smaller categories on the Money screen.</span>`);
      return { title: 'This month', lines };
    },
  },
  {
    id: 'money-compare',
    pats: [/(ahead|behind|compared?).*(last month|previous month)/i, /(more|less).*than last month/i, /\bvs last month\b/i],
    ex: 'Am I spending more than last month?',
    run() {
      if (!finTx().length) return { empty: 'No transactions recorded yet.' };
      const ym = finYm(todayStr());
      const cum = finCumulative(ym);
      const now = cum.now.filter(v => v != null);
      const day = now.length;
      if (!day || !cum.was.length) return { empty: 'Not enough of this month recorded yet to compare.' };
      const wasAt = cum.was[Math.min(day, cum.was.length) - 1];
      if (wasAt == null) return { empty: 'Last month has nothing to compare against.' };
      const diff = now[day - 1] - wasAt;
      const lines = [
        `By day ${day}: <b>${finFmt(now[day - 1], { noPaise: true })}</b> this month vs <b>${finFmt(wasAt, { noPaise: true })}</b> by the same day last month.`,
        Math.abs(diff) < 100
          ? `You are <b>level</b> with last month.`
          : `That is <b>${finFmt(Math.abs(diff), { noPaise: true })} ${diff > 0 ? 'more' : 'less'}</b>.`,
      ];
      const mv = finMovers(ym).slice(0, 3);
      mv.forEach(x => {
        lines.push(`${finCat(x.cat).ico} ${escapeHtml(finCat(x.cat).name)} ${x.delta > 0 ? 'up' : 'down'} <b>${finFmt(Math.abs(x.delta), { compact: true, noPaise: true })}</b>${x.pct != null ? ` (${x.pct > 0 ? '+' : ''}${x.pct}%)` : ' (new)'}`);
      });
      return { title: 'This month vs last', lines };
    },
  },
  {
    id: 'networth',
    pats: [/net worth/i, /how much.*(do i have|am i worth|saved up)/i, /\b(assets?|owe|debt)\b/i],
    ex: 'What is my net worth?',
    run() {
      if (!finAccts().length) return { empty: 'No accounts set up yet — add one on the Money screen.' };
      const w = finSplitWorth();
      const lines = [
        `You own <b>${finFmt(w.assets, { compact: true, noPaise: true })}</b> and owe <b>${finFmt(w.debts, { compact: true, noPaise: true })}</b>.`,
        `Net worth: <b>${finFmt(w.net, { compact: true, noPaise: true })}</b>.`,
      ];
      finAccts().filter(a => !a.archived).forEach(a => {
        const b = finBal(a.id);
        lines.push(`${finKind(a.kind).ico} ${escapeHtml(a.name)} — <b>${b == null ? 'no value recorded' : finFmt(Math.abs(b), { noPaise: true })}</b>${b != null && b < 0 ? ' owed' : ''}`);
      });
      return { title: 'Net worth', lines };
    },
  },
  {
    id: 'subs',
    pats: [/subscription/i, /recurring/i, /\bpaying for\b/i],
    ex: 'What subscriptions am I paying for?',
    run() {
      const rec = finRecurring();
      if (!rec.length) return { empty: 'Nothing repeating across 3+ months yet. Add a note like “Netflix” when you record a charge and repeats get easier to spot.' };
      const lines = rec.slice(0, 8).map(r =>
        `${finCat(r.cat).ico} ${escapeHtml(r.label)} — <b>${finFmt(r.avg, { noPaise: true })}</b> <span class="ask-dim">× ${r.months} months</span>`);
      lines.push(`<span class="ask-dim">A guess from your own records, not a bank feed — check before cancelling anything.</span>`);
      return { title: 'Looks like subscriptions', lines };
    },
  },
  {
    id: 'sleep',
    pats: [/\bsleep\b/i, /\bslept\b/i, /\bbed ?time\b/i, /how.*rest/i],
    ex: 'How is my sleep?',
    run() {
      const e = DB.entries(), hs = (typeof healthStore === 'function' ? healthStore() : {}) || {};
      const vals = [];
      Object.keys(e).forEach(d => {
        const h = hs[d] && hs[d].sleepMin != null ? hs[d].sleepMin / 60
          : (e[d].sleepHours != null && e[d].sleepHours !== '' ? +e[d].sleepHours : null);
        if (h != null && !isNaN(h)) vals.push([d, h]);
      });
      if (vals.length < 3) return { empty: `Only ${vals.length} night${vals.length === 1 ? '' : 's'} of sleep recorded — a few more and this gets useful.` };
      const nums = vals.map(v => v[1]);
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      const med = dpMedian(nums);
      const last7 = vals.slice(-7).map(v => v[1]);
      const lines = [
        `Across <b>${vals.length}</b> nights you average <b>${avg.toFixed(1)}h</b> (middle night: <b>${med.toFixed(1)}h</b>).`,
      ];
      if (last7.length >= 3) {
        const a7 = last7.reduce((a, b) => a + b, 0) / last7.length;
        const d = a7 - avg;
        lines.push(`Last ${last7.length} nights: <b>${a7.toFixed(1)}h</b>${Math.abs(d) >= 0.3 ? ` — <b>${Math.abs(d).toFixed(1)}h ${d > 0 ? 'more' : 'less'}</b> than your usual` : ' — in line with your usual'}.`);
      }
      // Fold in the computed sleep pattern if one exists, verbatim.
      (computePatterns() || []).filter(p => /sleep/i.test(p.head)).slice(0, 1)
        .forEach(p => lines.push(`${p.head}. ${p.sub}`));
      return { title: 'Sleep', lines };
    },
  },
  {
    id: 'mood',
    pats: [/\bmood\b/i, /how.*(feel|felt)/i, /\bhappy|happier|sad\b/i, /\benergy\b/i],
    ex: 'How has my mood been?',
    run() {
      const e = DB.entries();
      const pick = k => Object.keys(e).filter(d => e[d][k] != null && e[d][k] !== '').map(d => [d, +e[d][k]]);
      const mood = pick('mood'), energy = pick('energy');
      if (mood.length < 3) return { empty: `Only ${mood.length} day${mood.length === 1 ? '' : 's'} with a mood recorded — a few more and this gets useful.` };
      const av = a => a.reduce((x, y) => x + y[1], 0) / a.length;
      const lines = [`Mood averages <b>${av(mood).toFixed(1)}/10</b> across <b>${mood.length}</b> days.`];
      if (energy.length >= 3) lines.push(`Energy averages <b>${av(energy).toFixed(1)}/10</b> across <b>${energy.length}</b> days.`);
      const recent = mood.slice(-7);
      if (recent.length >= 3) {
        const d = av(recent) - av(mood);
        lines.push(`Last ${recent.length} days: <b>${av(recent).toFixed(1)}</b>${Math.abs(d) >= 0.3 ? ` — <b>${Math.abs(d).toFixed(1)} ${d > 0 ? 'above' : 'below'}</b> your average` : ' — in line with your average'}.`);
      }
      (computePatterns() || []).filter(p => /mood/i.test(p.head)).slice(0, 2)
        .forEach(p => lines.push(`${p.head}. ${p.sub}`));
      return { title: 'Mood & energy', lines };
    },
  },
  {
    id: 'habits',
    pats: [/\bhabits?\b/i, /how.*consistent/i, /\bchecklist\b/i],
    ex: 'How are my habits doing?',
    run() {
      const cfg = (typeof habitCfg === 'function' ? habitCfg() : []).filter(h => !h.hidden);
      if (!cfg.length) return { empty: 'No habits set up — add some in Customize ▸ Checklist habits.' };
      const rows = cfg.map(h => ({
        label: h.label || h.key,
        strength: (typeof habitStrength === 'function' ? habitStrength(h.key) : null),
        streak: (typeof habitStreak === 'function' ? habitStreak(h.key) : null),
      })).filter(r => r.strength != null);
      if (!rows.length) return { empty: 'Not enough logged days to score your habits yet.' };
      rows.sort((a, b) => b.strength - a.strength);
      const lines = rows.slice(0, 8).map(r =>
        `${escapeHtml(r.label)} — <b>${Math.round(r.strength)}%</b> strength${r.streak ? `, <b>${r.streak}</b> day streak` : ''}`);
      const weak = rows[rows.length - 1];
      if (rows.length > 1) lines.push(`<span class="ask-dim">Weakest right now: ${escapeHtml(weak.label)} at ${Math.round(weak.strength)}%.</span>`);
      return { title: 'Habits', lines };
    },
  },
  {
    id: 'time',
    pats: [/\btime\b.*(go|spent|spend)/i, /where.*(my )?(day|hours|time)/i, /how (long|much time)/i],
    ex: 'Where does my time go?',
    run() {
      const log = DB.timelog().filter(s => s.end != null);
      if (!log.length) return { empty: 'No time blocks tracked yet — start a timer on the Time screen.' };
      const from = new Date(); from.setDate(from.getDate() - 28);
      const cut = todayStr(from);
      const by = {};
      let total = 0;
      log.forEach(s => {
        if (todayStr(new Date(s.start)) < cut) return;
        const ms = s.end - s.start;
        by[s.act] = (by[s.act] || 0) + ms; total += ms;
      });
      if (!total) return { empty: 'Nothing tracked in the last 28 days.' };
      const keys = Object.keys(by).sort((a, b) => by[b] - by[a]);
      const lines = [`Over the last 28 days you tracked <b>${fmtDur(total)}</b> across <b>${keys.length}</b> activities.`];
      keys.slice(0, 6).forEach(k => {
        const a = actById(k);
        lines.push(`${a.emoji || ''} ${escapeHtml(a.name)} — <b>${fmtDur(by[k])}</b> <span class="ask-dim">${Math.round(by[k] / total * 100)}%</span>`);
      });
      return { title: 'Where your time went', lines };
    },
  },
  {
    id: 'patterns',
    pats: [/\bpattern/i, /what.*(affects?|impacts?|makes? me)/i, /\binsight/i, /tell me something/i, /what have you (noticed|learned|found)/i],
    ex: 'What patterns have you found?',
    run() {
      const p = computePatterns() || [];
      const fin = (typeof finPatterns === 'function' ? finPatterns() : []) || [];
      if (!p.length && !fin.length) {
        return { empty: 'No patterns solid enough to report yet. These need both sides recorded on enough days, and nothing is reported below that — a pattern that is not really there is worse than none.' };
      }
      const lines = [];
      p.slice(0, 4).forEach(x => lines.push(`${x.head}. ${x.sub}`));
      fin.slice(0, 2).forEach(x => lines.push(`${escapeHtml(x.head)}. ${escapeHtml(x.body)}`));
      lines.push(`<span class="ask-dim">Every split is on your own median, with its sample size stated.</span>`);
      return { title: 'What your data shows', lines };
    },
  },
  {
    id: 'best',
    pats: [/\bbest\b/i, /\brecord/i, /personal best/i, /\bmost\b.*(ever|steps|i)/i],
    ex: 'What are my records?',
    run() {
      /* Computed here rather than reused from bestEfforts(), which returns rendered HTML
         rather than data — the same floor (3+ days of a measure) so the two never disagree. */
      const e = DB.entries(), hs = (typeof healthStore === 'function' ? healthStore() : {}) || {};
      const lines = [];
      const best = (label, pairs, fmt, lowest) => {
        const all = pairs.filter(p => p[1] != null && p[1] !== '' && !isNaN(+p[1])).map(p => [p[0], +p[1]]);
        if (all.length < 3) return;
        const t = all.slice().sort((a, b) => lowest ? a[1] - b[1] : b[1] - a[1])[0];
        lines.push(`${escapeHtml(label)} — <b>${fmt(t[1])}</b> <span class="ask-dim">on ${shortDate(t[0])}, across ${all.length} days</span>`);
      };
      const num = v => Math.round(v).toLocaleString();
      best('Most steps', Object.keys(hs).map(d => [d, hs[d].steps]), num);
      best('Longest sleep', Object.keys(hs).map(d => [d, hs[d].sleepMin]), v => (v / 60).toFixed(1) + 'h');
      best('Most active minutes', Object.keys(hs).map(d => [d, hs[d].exerciseMin]), v => num(v) + ' min');
      best('Least screen time', Object.keys(hs).filter(d => hs[d].screenMin != null).map(d => [d, hs[d].screenMin]), v => (v / 60).toFixed(1) + 'h', true);
      best('Deepest focus day', Object.keys(e).map(d => [d, e[d].deepWorkHours]), v => v.toFixed(1) + 'h');
      best('Best mood', Object.keys(e).map(d => [d, e[d].mood]), v => String(v) + '/10');
      best('Most habits done', Object.keys(e).map(d => [d,
        Object.keys((e[d] || {}).habits || {}).filter(k => hVal(e[d], k) === H_DONE).length]), num);
      if (!lines.length) return { empty: 'Not enough history for personal records yet — each needs at least 3 days of that measure.' };
      return { title: 'Your records', lines };
    },
  },
  {
    id: 'week',
    pats: [/this week/i, /how.*(week|going)/i, /\bweekly\b/i, /how am i doing/i],
    ex: 'How is this week going?',
    run() {
      const r = (typeof coachReview === 'function' ? coachReview() : null);
      const e = DB.entries();
      const days = []; for (let i = 0; i < 7; i++) days.push(addDays(todayStr(), -i));
      const logged = days.filter(d => entryHasContent(e[d])).length;
      const lines = [`You have logged <b>${logged}</b> of the last 7 days.`];
      if (r && r.lines && r.lines.length) r.lines.slice(0, 4).forEach(l => lines.push(l));
      else if (r && r.head) lines.push(String(r.head));
      const m = finAccts().length ? finMonth(finYm(todayStr())) : null;
      if (m && m.out) lines.push(`Spending so far this month: <b>${finFmt(m.out, { compact: true, noPaise: true })}</b>.`);
      return { title: 'This week', lines };
    },
  },
  {
    id: 'awards',
    pats: [/\bawards?\b/i, /\btroph/i, /\bbadges?\b/i, /what.*unlock/i],
    ex: 'What awards am I close to?',
    run() {
      const list = (typeof awardList === 'function' ? awardList() : []) || [];
      if (!list.length) return { empty: 'Nothing in the trophy case yet.' };
      const earned = list.filter(a => a.earned).length;
      const next = [];
      (typeof AWARD_FAMILIES !== 'undefined' ? AWARD_FAMILIES : []).forEach(f => {
        const t = list.filter(a => a.grp === f.grp && !a.earned).sort((a, b) => a.tier - b.tier)[0];
        if (t) next.push(t);
      });
      next.sort((a, b) => (b.hi / b.tier) - (a.hi / a.tier));
      const lines = [`You have unlocked <b>${earned}</b> of <b>${list.length}</b>.`];
      next.slice(0, 5).forEach(a => {
        const left = Math.max(0, a.tier - a.hi);
        lines.push(`${a.ico} ${escapeHtml(awardName(a))} — <b>${left.toLocaleString()}</b> to go`);
      });
      return { title: 'Awards', lines };
    },
  },
];

/* The router. Scores each skill by how many of its patterns match, longest-match wins ties.
   Deliberately dumb and inspectable — a wrong answer confidently given is the failure mode
   worth engineering against, so no fuzzy matching and no fallback guessing. */
function askRoute(q) {
  const text = String(q || '').trim();
  if (!text) return null;
  let best = null, bestScore = 0;
  ASK_SKILLS.forEach(sk => {
    let score = 0;
    sk.pats.forEach(p => { const m = text.match(p); if (m) score += 1 + (m[0].length / 100); });
    if (score > bestScore) { bestScore = score; best = sk; }
  });
  return best;
}

function askRun(q) {
  const sk = askRoute(q);
  if (!sk) {
    return {
      unknown: true,
      title: "I can't answer that one yet",
      lines: [
        `Everything here is worked out from your own log — there is no model guessing, so I only answer what I can actually compute.`,
        `<span class="ask-dim">Try one of the questions below.</span>`,
      ],
    };
  }
  try {
    const r = sk.run();
    if (r.empty) return { title: 'Nothing to show yet', lines: [r.empty], skill: sk.id };
    return Object.assign({ skill: sk.id }, r);
  } catch (e) {
    /* A broken skill must say so rather than render half an answer as if it were complete. */
    return { title: 'Something went wrong', lines: [`I could not work that out — this is a bug, not your data.`], skill: sk.id, failed: true };
  }
}

/* ---- screen ---- */
function renderAsk() {
  const el = document.getElementById('s-ask');
  if (!el) return;
  document.getElementById('screen-title').textContent = 'Ask';
  document.getElementById('screen-sub').textContent = 'answers from your own data';

  const chips = ASK_SKILLS.map(s => `<button class="ask-chip" data-ask-ex="${escapeHtml(s.ex)}">${escapeHtml(s.ex)}</button>`).join('');
  const thread = askLog.length ? askLog.map(t => `
    <div class="ask-turn">
      <div class="ask-q">${escapeHtml(t.q)}</div>
      <div class="ask-a ${t.a.unknown ? 'unknown' : ''}">
        <div class="ask-a-h">${escapeHtml(t.a.title)}</div>
        ${t.a.lines.map(l => `<div class="ask-l">${l}</div>`).join('')}
      </div>
    </div>`).join('') : '';

  el.innerHTML = `
    <div class="card ask-intro">
      <h2 class="h2-icon">${hicon('sparkle')}<span>Ask your data</span></h2>
      <div class="hint">Worked out from your own log, on this phone. <b>No AI model, nothing uploaded</b> — so every number here is one the app actually computed, never one that was guessed. Works offline.</div>
    </div>

    <div class="card">
      <div class="task-add">
        <input type="text" id="ask-q" placeholder="Ask about your data…" autocomplete="off" enterkeyhint="send">
        <button class="btn btn-primary btn-sm" id="ask-go">Ask</button>
      </div>
    </div>

    ${thread ? `<div class="ask-thread">${thread}</div>
      <div class="card"><button class="btn btn-ghost btn-sm" id="ask-clear" style="width:100%">Clear</button></div>` : ''}

    <div class="card">
      <div class="ask-sug-h">${askLog.length ? 'Ask something else' : 'Try one of these'}</div>
      <div class="ask-chips">${chips}</div>
    </div>`;

  const box = document.getElementById('ask-q');
  if (box && askLog.length === 0) setTimeout(() => { try { box.focus({ preventScroll: true }); } catch (e) {} }, 40);
}

function askSubmit(q) {
  const text = String(q || '').trim().slice(0, 200);
  if (!text) return;
  askLog.unshift({ q: text, a: askRun(text), at: Date.now() });
  if (askLog.length > ASK_MAX_HISTORY) askLog.length = ASK_MAX_HISTORY;
  renderAsk();
  window.scrollTo(0, 0);
}

document.addEventListener('click', (ev) => {
  const ex = ev.target.closest('[data-ask-ex]');
  if (ex) { askSubmit(ex.dataset.askEx); return; }
  if (ev.target.id === 'ask-go') { const b = document.getElementById('ask-q'); if (b) { askSubmit(b.value); b.value = ''; } return; }
  if (ev.target.id === 'ask-clear') { askLog = []; renderAsk(); return; }
});
document.addEventListener('keydown', (ev) => {
  if (ev.target && ev.target.id === 'ask-q' && ev.key === 'Enter') {
    ev.preventDefault();
    askSubmit(ev.target.value); ev.target.value = '';
  }
});


/* ---------- Nav tabs: reorder / hide / rename (dp.navcfg) ---------- */
// Bottom bar shows up to NAV_PRIMARY_MAX (4) pinned tabs + a "Menu" button that opens the side drawer with everything.
/* `adv` = not shown on a FRESH install. Nineteen destinations is a wall on day one, and
   most of them are empty until there is data to put in them — an empty trophy case and a
   Money screen with no accounts teach nothing and cost attention. A saved dp.navcfg always
   wins, so this changes nothing for anyone already using the app, and the drawer carries a
   "More features" row that turns any of them on in one tap. Nothing is removed, ever. */
const NAV_DEF = [
  { k: 'today',    ico: 'pencil',   label: 'Log',     primary: true, noHide: true },
  { k: 'time',     ico: 'clock',    label: 'Time',    primary: true },
  { k: 'tasks',    ico: 'check',    label: 'Tasks',   adv: true, blurb: 'A to-do list that rolls over and feeds your daily log.' },
  { k: 'notes',    ico: 'note',     label: 'Notes',   adv: true, blurb: 'Quick notes, kept on this phone.' },
  { k: 'plans',    ico: 'list',     label: 'Plans',   adv: true, blurb: 'Checklists for anything with steps.' },
  { k: 'projects', ico: 'layers',   label: 'Projects', adv: true, blurb: 'Bigger efforts with milestones — and the hours you actually logged against them.' },
  { k: 'money',    ico: 'wallet',   label: 'Money',   adv: true, blurb: 'Accounts, spending and net worth, with patterns against your mood and sleep.' },
  { k: 'ask',      ico: 'sparkle',  label: 'Ask',     adv: true, blurb: 'Ask questions about your own data. No AI model, works offline.' },
  { k: 'focus',    ico: 'target',   label: 'Focus',   primary: true },
  { k: 'waves',    ico: 'radio',    label: 'Waves', adv: true, blurb: 'Ambient sounds for focus.' },
  { k: 'gym',      ico: 'dumbbell', label: 'Gym', adv: true, blurb: 'Workout logging, sets and reps.' },
  { k: 'habits',   ico: 'flame',    label: 'Habits' },
  { k: 'dash',     ico: 'chart',    label: 'Stats',   primary: true },
  { k: 'cal',      ico: 'calendar', label: 'Cal', adv: true, blurb: 'Your entries on a calendar.' },
  // Awards moved OUT of Stats: a fifth tab pushed Health off the edge of a 360px row, and a
  // lifetime trophy case has nothing to do with the Range picker the other tabs share.
  { k: 'awards',   ico: 'star',     label: 'Awards', adv: true, blurb: 'A trophy case worked out from your own log.' },
  { k: 'write',    ico: 'pencil',   label: 'Write', adv: true, blurb: 'A distraction-free writing space.' },
  { k: 'search',   ico: 'search',   label: 'Search', adv: true, blurb: 'Search everything you have written.' },
  { k: 'history',  ico: 'history',  label: 'History', adv: true, blurb: 'Every day you have logged, in one list.' },
  { k: 'settings', ico: 'settings', label: 'Settings' },
];
function navCfg() {
  const v0 = safeParse(localStorage.getItem('dp.navcfg'), null);
  /* Fresh install: advanced destinations start hidden. Saved config: left exactly alone —
     this must never take a screen away from someone already using it. */
  let cfg = Array.isArray(v0) ? v0
    : NAV_DEF.map(n => Object.assign({}, n, n.adv ? { hidden: true } : {}));
  /* A tab added in a LATER release appears for everyone, except advanced ones, which wait
     to be asked for. Without this an existing user would be handed every new screen
     unannounced — which is how the menu got to nineteen items. */
  NAV_DEF.forEach(d => { if (!cfg.find(n => n.k === d.k)) cfg.push(Object.assign({}, d, d.adv ? { hidden: true } : {})); });
  // Migrate legacy configs (pre-v56 had no `primary`): seed pins from NAV_DEF defaults once.
  if (cfg.every(n => n.primary === undefined)) {
    cfg.forEach(n => { const d = NAV_DEF.find(x => x.k === n.k); n.primary = !!(d && d.primary) && !n.hidden; n.hidden = n.k === 'history' ? false : n.hidden; });
  }
  // Icons are not user data — always take them from NAV_DEF, so stored configs from the
  // emoji era (pre-v82) render the professional line icons too.
  cfg.forEach(n => { const d = NAV_DEF.find(x => x.k === n.k); if (d) n.ico = d.ico; });
  /* The settings tab shipped as "More" for a long time. Labels ARE user data (tabs can be
     renamed), so they are not force-synced from NAV_DEF like icons — which left every
     existing install stuck on the old word. Rename only the exact old default; anything the
     user typed themselves is left alone. */
  cfg.forEach(n => { if (n.k === 'settings' && (n.label === 'More' || n.label === 'More ⚙' || !n.label)) n.label = 'Settings'; });
  return cfg;
}
function saveNavCfg(cfg) { const ok = safeSet('dp.navcfg', JSON.stringify(cfg)); renderNav(); pushState(); return ok; }
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
  /* Settings is not a tab like the others — it lives in the footer with "Edit menu", pinned to
     the bottom of the drawer, so the list above is only places you go to use the app. */
  const items = navCfg().filter(n => !n.hidden && !bottom.has(n.k) && n.k !== 'settings');
  const row = n => `<button class="drawer-row ${n.k === cur ? 'on' : ''}" data-screen="${n.k}">
    <span class="drawer-ico">${icon(n.ico, 21)}</span><span class="drawer-lbl">${escapeHtml(n.label)}</span>
    ${n.primary ? '<span class="drawer-pin">pinned</span>' : ''}</button>`;
  /* Everything switched off that could be switched on, described by what it DOES rather
     than named — a list of nouns is what made the full menu unreadable in the first place. */
  const off = navCfg().filter(n => n.hidden && NAV_DEF.some(d => d.k === n.k && d.adv));
  const peek = off.slice(0, 2).map(n => n.label).join(', ') + (off.length > 2 ? ` and ${off.length - 2} more` : '');
  const more = off.length ? `
    <h3 class="drawer-sec">Add more</h3>
    <div class="drawer-more">
      <button class="drawer-row drawer-more-h" id="drawer-more-toggle" aria-expanded="${drawerMoreOpen}">
        <span class="drawer-ico">${icon('plus', 21)}</span>
        <span class="drawer-lbl"><span>More features</span><span class="drawer-peek">${escapeHtml(peek)}</span></span>
        <span class="drawer-pin">${off.length}</span>
      </button>
      ${drawerMoreOpen ? `<div class="drawer-more-list">${off.map(n => {
        const d = NAV_DEF.find(x => x.k === n.k) || {};
        return `<button class="drawer-add" data-nav-on="${n.k}">
          <span class="drawer-ico">${icon(n.ico, 20)}</span>
          <span class="drawer-add-t"><b>${escapeHtml(n.label)}</b><span>${escapeHtml(d.blurb || '')}</span></span>
          <span class="drawer-add-go">Add</span></button>`;
      }).join('')}</div>` : ''}
    </div>` : '';
  document.getElementById('drawer-list').innerHTML =
    (items.length ? `<h3 class="drawer-sec">Your tabs</h3>${items.map(row).join('')}` : '') + more;
  const st = navCfg().find(n => n.k === 'settings');
  document.getElementById('drawer-foot').innerHTML =
    `<button class="drawer-row ${cur === 'settings' || cur === 'custom' ? 'on' : ''}" data-screen="settings">
      <span class="drawer-ico">${icon('settings', 21)}</span><span class="drawer-lbl">${escapeHtml((st && st.label) || 'Settings')}</span></button>
    <button class="drawer-row drawer-edit" id="drawer-edit-tabs"><span class="drawer-ico">${icon('pencil', 21)}</span><span class="drawer-lbl">Edit this menu</span></button>`;
  const sub = document.getElementById('drawer-sub');
  if (sub) { const k = loggedStreak();
    sub.innerHTML = k > 0 ? `${icon('flame', 14)} ${k}-day streak` : escapeHtml(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })); }
}
let drawerMoreOpen = false;
document.addEventListener('click', (ev) => {
  if (ev.target.closest && ev.target.closest('#drawer-more-toggle')) {
    drawerMoreOpen = !drawerMoreOpen; renderDrawer(); return;
  }
  const add = ev.target.closest && ev.target.closest('[data-nav-on]');
  if (add) {
    const k = add.dataset.navOn;
    const cfg = navCfg();
    const row = cfg.find(n => n.k === k);
    if (row) { row.hidden = false; saveNavCfg(cfg); }
    renderDrawer();
    navigateTo(k);          // take them straight there — adding it IS the intent to use it
    closeDrawer();
    toast(`${row ? row.label : 'Feature'} added to your menu`);
  }
});
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
['drawer-list', 'drawer-foot'].forEach(id => document.getElementById(id).addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-screen]'); if (!b) return;
  closeDrawer(); navigateTo(b.dataset.screen);
}));

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
  // 1) an open overlay always closes first.
  //    The share sheet sits at z-index 95, above every overlay below it, so it must be
  //    checked FIRST. Omitting it meant back fell through to the exit dialog, which is a
  //    .copy-modal at z-index 70 and therefore painted UNDERNEATH the sheet's blurred
  //    scrim — the user pressed back and nothing appeared to happen at all.
  const ssh = document.getElementById('sharesheet');
  if (ssh && ssh.classList.contains('on')) { shareSheetClose(); return; }
  const svh = document.getElementById('savesheet');
  if (svh && svh.classList.contains('on')) { saveSheetClose(); return; }
  const mrd = document.getElementById('mrdeck');
  if (mrd && mrd.classList.contains('on')) { mrClose(); return; }
  if (mediaViewIsOpen()) { mediaViewClose(); return; }
  if (_rec) { voiceStop(false); return; }   // back while recording saves the note, like leaving does
  for (const id of ['tip-ask', 'rate-ask']) {   // the tip and review sheets
    const x = document.getElementById(id); if (x && x.classList.contains('on')) { x.classList.remove('on'); return; }
  }
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
  if (cur === 'settings' && settingsPage) { settingsPage = null; renderSettings(); wipeAbandonIfAway(); window.scrollTo(0, 0); return; }
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
const RENDER = { awards: renderAwards, projects: renderProjects, money: renderMoney, ask: renderAsk, today: openToday, time: openTime, tasks: renderTasks, notes: renderNotes, plans: renderPlans, focus: renderFocus, waves: renderWaves, gym: openGym, habits: renderHabits, dash: renderDash, cal: renderCal, write: renderWrite, history: renderHistory, settings: renderSettings, custom: renderCustom, more: renderMore, search: renderSearch };
function show(name) {
  // Leaving Settings abandons a half-finished delete. An in-progress irreversible action
  // must never survive navigating away and come back still armed.
  if (name !== 'settings') { try { wipeReset(); } catch (e) {} settingsPage = null; }
  voiceSaveIfRecording(); voiceHalt(); mediaViewClose();
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
  if (dt) {
    dashTab = dt.dataset.dashtab; renderDash();
    /* renderDash() rewrites #s-dash, so this is a brand-new .seg-row at scrollLeft 0. With
       five tabs the row scrolls, and without this the tab you just picked lands off-screen
       (Health at 360px). Centring it also pulls the neighbouring tabs into view, which is
       the only affordance that the row scrolls at all. scrollLeft arithmetic, not
       scrollIntoView — the latter scrolls every ancestor including the document. */
    const row = document.querySelector('#s-dash .seg-row');
    const on = row && row.querySelector('.seg-btn.on');
    if (on) row.scrollLeft = Math.max(0, on.offsetLeft + on.offsetWidth / 2 - row.clientWidth / 2);
    window.scrollTo(0, 0);
  }
});
function navigateTo(name) {
  if (name === 'today') logDate = todayStr();               // Log always opens today
  if (name === 'gym') gymDate = todayStr();                 // Gym always opens today
  if (name === 'plans') curPlan = null;                     // Plans opens the list
  if (name === 'cal') { calSel = todayStr(); calMonth = calSel.slice(0, 7); }
  if (name === 'write') curDoc = null;                      // Write opens the article list
  /* Picking Settings — from the menu, a pinned tab or More — opens its HOME, not whichever
     sub-page was last open, and disarms a half-started delete. Done here and not in show():
     the sync merge and the theme change re-render through show(), and must not throw someone
     off a page mid-edit. */
  if (name === 'settings') settingsPage = null;
  show(name);
  if (name === 'settings') wipeAbandonIfAway();
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
  play: '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
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
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  message:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  camera:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  mic:'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  share:'<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
  pause:'<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
  playFill:'<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5Z" fill="currentColor"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  chevL:'<path d="m15 18-6-6 6-6"/>',
  chevR:'<path d="m9 18 6-6-6-6"/>',
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
const EMOJI_ICON = { '🧭':'target','🧑‍🏫':'star','😊':'smile','⚡':'zap','😴':'moon','🎯':'target','🏋️':'dumbbell','🏋':'dumbbell','💪':'dumbbell','🧠':'lightbulb','🔢':'list','✅':'check','📅':'calendar','📆':'calendar','🔥':'flame','🕸️':'radio','🕸':'radio','💡':'lightbulb','📌':'star','💬':'note','☁️':'radio','☁':'radio','⏰':'clock','🔔':'clock','💾':'layers','ℹ️':'dot','ℹ':'dot','📄':'note','📖':'book','🕘':'history','⏱️':'clock','⏱':'clock','🗒️':'note','🗒':'note','📋':'list','🎨':'sparkle','🍅':'target','📝':'pencil','🌊':'radio','😌':'smile','🩺':'heart','💼':'briefcase','📚':'book','💰':'wallet','📱':'phone','🌱':'trending','💇':'scissors','🧴':'droplet','📦':'layers','🎙️':'radio','🗓️':'calendar','🗓':'calendar','📊':'chart','⏳':'clock','⌛':'clock','🏃':'zap','🚌':'target','📈':'trending','🔒':'dot','🎉':'star','⏸':'clock','▶':'target','⏹':'dot','🎤':'radio','💊':'heart','🧘':'sparkle','🥗':'leaf','😁':'smile','📣':'radio','🤖':'dot','🚀':'trending','🍳':'flame','☕':'clock','🛒':'wallet','🎸':'radio','🌅':'sparkle','🎓':'play','💛':'heart' };
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
let obRestore = false;   // the welcome-back panel is open instead of the step
/* Reconnecting an EXISTING sync link. Not a sync offer — the person owns this link already;
   the offer itself stays withheld until the Data Safety form matches it. Outcomes are told
   apart honestly: a dead link is unconfigured again (a silently-swallowing endpoint is worse
   than none), and an empty sheet is reported as empty, never as a restore. */
function syncLinkRestore(raw, onOutcome) {
  if (!/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec/.test(raw || '')) { onOutcome('bad-url', 0); return; }
  const st = DB.settings(); st.syncUrl = raw; DB.saveSettings(st);
  pullState(ok => {
    const days = ok ? contentDates().length : 0;
    if (ok && days) return onOutcome('restored', days);
    if (ok) return onOutcome('empty', 0);
    const s2 = DB.settings(); s2.syncUrl = ''; DB.saveSettings(s2);
    onOutcome('unreachable', 0);
  });
}

/* A successful restore ends onboarding — the person is returning, not new. The tour and the
   what's-new are marked seen for the same reason. */
function obFinishRestore(msg) {
  localStorage.setItem('dp.onboarded', '1');
  localStorage.setItem('dp.toured', '1');
  localStorage.setItem('dp.whatsnew', WHATS_NEW.v);
  obRestore = false;
  const el = document.getElementById('onboard');
  if (el) el.classList.remove('on');
  show('today');
  if (msg) toast(msg);
}
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'ob-restore-file' && ev.target.files && ev.target.files[0]) {
    importData(ev.target.files[0], ok => {
      if (ok) obFinishRestore(`Welcome back — ${contentDates().length} day${contentDates().length === 1 ? '' : 's'} restored ✅`);
      // on failure importData already said exactly why; stay on the panel for another try
    });
  }
});
const obHideH = new Set(), obHideA = new Set();   // obHideA is now always empty: the activity picker step was removed in v245
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
    <button class="btn btn-primary" data-ob-next>Get started</button>
    <button class="ob-restore-link" data-ob-restore>Already used Daylog? <b>Restore your data</b> →</button>`;
  /* The restore door. A local-first app's worst moment is a new phone: before this existed
     there was NO way in — not a backup file, not a sync link — and the first person stranded
     was the developer, with a dead phone and a sheet full of data the app refused to take
     back. Restoring is framed for RETURNING users only; it is not a sync offer (that stays
     withheld until the Data Safety form matches it). */
  if (obRestore) body = `
    <div class="ob-emoji">📦</div>
    <h1>Welcome back</h1>
    <p class="ob-lead">Two ways to bring your data onto this phone.</p>
    <div class="card" style="text-align:left">
      <b>From a backup file</b>
      <p class="hint" style="margin:4px 0 10px">The <code>daily-pulse-backup-….json</code> you exported — Downloads, Drive, wherever you kept it.</p>
      <button class="btn btn-primary" id="ob-restore-file-btn" style="width:100%">Choose the backup file</button>
      <input type="file" id="ob-restore-file" accept=".json,application/json" style="display:none">
    </div>
    <div class="card" style="text-align:left">
      <b>From your sync link</b>
      <p class="hint" style="margin:4px 0 10px">Only if you set up Google Sheet sync on your old phone. Paste the same script link — it pulls everything back and keeps this phone in step.</p>
      <input type="url" id="ob-restore-url" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off">
      <button class="btn btn-primary" id="ob-restore-pull" style="width:100%;margin-top:9px">Restore from the link</button>
    </div>
    <button class="ob-restore-link" data-ob-restore-back>← Start fresh instead</button>`;
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
    <div class="ob-emoji">⏰</div>
    <h1>Never miss a day</h1>
    ${/* This used to read "People who set a daily reminder keep their streak 3x longer."
         That number was invented — the app has no accounts, no server and no analytics, so
         there is no population it could ever have been measured on. Never state a statistic
         this app cannot compute. */''}
    <p class="ob-lead">A nudge at a fixed time makes it much easier to keep going.</p>
    <div class="card" style="text-align:left">
      <label class="ev-alarm-row" style="margin:0 0 10px"><input type="checkbox" id="ob-rem-on" checked> Remind me to log my day</label>
      <div class="field"><label>At</label><input type="time" id="ob-rem-time" value="21:00"></div>
    </div>
    <p class="ob-note">Change or add more anytime in <b>Settings ▸ Reminders</b>.</p>
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
  if (ev.target.id === 'ob-add-habit') {
    const inp = document.getElementById('ob-new-habit'); const raw = (inp.value || '').trim(); if (!raw) return;
    const m = raw.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u);
    const cfg = habitCfg();
    cfg.push({ key: 'ch' + Date.now(), emoji: (m && m[2]) ? m[1] : '⭐', label: (m && m[2]) ? m[2] : raw, custom: true, added: todayStr() });
    saveHabitCfg(cfg); renderOnboard(); return;   // new item shows selected (not in obHideH)
  }
  if (ev.target.id === 'ob-add-act') {
    const inp = document.getElementById('ob-new-act'); const name = (inp.value || '').trim(); if (!name) return;
    const acts = DB.timeacts();
    const em = emojiSplit(name); acts.push({ id: 'ta' + Date.now(), emoji: em.emoji, name: em.name, color: CUSTOM_ACT_COLORS[acts.length % CUSTOM_ACT_COLORS.length] });
    DB.saveTimeacts(acts); renderOnboard(); return;
  }
  if (ev.target.closest('[data-ob-restore]')) { obRestore = true; renderOnboard(); return; }
  if (ev.target.closest('[data-ob-restore-back]')) { obRestore = false; renderOnboard(); return; }
  if (ev.target.id === 'ob-restore-file-btn') { const f = document.getElementById('ob-restore-file'); if (f) f.click(); return; }
  if (ev.target.id === 'ob-restore-pull') {
    const raw = (document.getElementById('ob-restore-url').value || '').trim();
    /* Loose on purpose — deployment URLs vary — but it must at least be an Apps Script
       /exec URL, or a typo becomes a silent endpoint that never answers. */
    toast('Connecting…');
    syncLinkRestore(raw, (status, days) => {
      if (status === 'restored') obFinishRestore(`Welcome back — ${days} day${days === 1 ? '' : 's'} restored ✅`);
      else if (status === 'empty') toast('Connected, but the sheet has no data to restore yet', true);
      else if (status === 'bad-url') toast('That does not look like a sync link — it ends in /exec', true);
      else toast('Could not reach that link — check it and try again', true);
    });
    return;
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
  { s: 'today', t: '.mm-card', alt: '.mm-cell', h: 'Log your day in 60 seconds', b: 'Tap your mood & energy, tick your checklist — everything saves automatically as you go.' },
  { s: 'today', t: '#log-task-add', alt: '.task-summary', h: 'Tasks count themselves', b: 'Add tasks right here — your done/planned numbers fill in automatically. No typing counts by hand.' },
  { s: 'today', t: '#health-sync', alt: '.h2-icon', h: 'Auto-tracking from your phone', b: 'Steps, screen time & more sync in by themselves. Pick what to track in Settings ▸ Auto-tracking.' },
  { s: 'time', t: '.act-chip', h: 'The one-tap time tracker ⭐', b: 'Tap an activity to start its timer, tap another to switch — your whole day becomes a 24-hour timeline. Tracked Sleep & Work auto-fill your Log.' },
  { s: 'dash', t: '.pat-row', alt: '.pm-card', h: 'Your patterns', b: 'Daylog mines your raw data for real insights — your sleep sweet spot, which habit lifts your mood, your peak focus hours. All computed on your phone.' },
  { s: 'dash', t: '[data-dashtab="health"]', h: 'Health analytics', b: 'Steps, screen time, calories — charted and connected to your mood, so you can see what actually helps.' },
  { s: '__menu', t: '#drawer-more-toggle', alt: '.drawer-row', h: 'Everything else lives in Menu', b: 'Search your entire life, History, Gym, Calendar, Focus timers… and pin ANY of these to the bottom bar with “Edit this menu”.' },
  { s: 'today', t: null, h: 'You\'re all set 🔥', b: 'Make every part yours in Settings ▸ Customize. Your data stays on your phone — private, always.' },
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
  else {
    try { closeDrawer(); } catch (_) {}
    // Stats remembers its last sub-tab; the tour's Stats steps live on Overview.
    if (st.s === 'dash') dashTab = 'overview';
    if (st.s) navigateTo(st.s);
  }
  setTimeout(() => {
    let el = st.t ? document.querySelector(st.t) : null;
    if (!el && st.alt) el = document.querySelector(st.alt);
    if (!el) { setTimeout(() => renderTourOverlay(st, null), 30); return; }
    try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); }
    catch (_) { try { el.scrollIntoView({ block: 'center' }); } catch (_) {} }
    // html{scroll-behavior:smooth} animates the scroll, so a fixed wait can measure
    // the element mid-flight and strand the spotlight. Poll until the rect stops moving.
    let last = null, stable = 0, tries = 0;
    (function settle() {
      const b = el.getBoundingClientRect(), t = Math.round(b.top) + ',' + Math.round(b.left);
      stable = (t === last) ? stable + 1 : 0;
      last = t;
      if (stable >= 2 || ++tries > 40) { renderTourOverlay(st, el); return; }
      requestAnimationFrame(settle);
    })();
  }, 380);
}
function renderTourOverlay(st, el) {
  let o = document.getElementById('tour');
  if (!o) { o = document.createElement('div'); o.id = 'tour'; document.body.appendChild(o); }
  const r = el ? el.getBoundingClientRect() : null;
  const pad = 8;
  let spot = '<div class="tour-spot tour-none"></div>';
  if (r) {
    const left = Math.max(4, r.left - pad);
    const top = Math.max(2, r.top - pad);
    const width = Math.min(r.width + pad * 2, window.innerWidth - 4 - left);
    const height = Math.min(r.height + pad * 2, window.innerHeight - 2 - top);
    spot = `<div class="tour-spot" style="top:${top}px;left:${left}px;width:${width}px;height:${height}px"></div>`;
  }
  o.innerHTML = `${spot}<div class="tour-card tour-card-bottom">
    <div class="tour-step">${tourIdx + 1} / ${TOUR.length}</div>
    <div class="tour-h">${st.h}</div>
    <div class="tour-b">${st.b}</div>
    <div class="tour-btns">
      ${tourIdx === TOUR.length - 1 ? '' : '<button class="btn btn-ghost btn-sm" id="tour-skip">Skip</button>'}
      ${tourIdx > 0 ? '<button class="btn btn-ghost btn-sm" id="tour-back">‹ Back</button>' : ''}
      <button class="btn btn-primary btn-sm" id="tour-next">${tourIdx === TOUR.length - 1 ? 'Done 🔥' : 'Next ›'}</button>
    </div></div>`;
}
document.addEventListener('click', (ev) => {
  if (ev.target.id === 'tour-next') { tourIdx++; showTourStep(); return; }
  if (ev.target.id === 'tour-back') { tourIdx = Math.max(0, tourIdx - 1); showTourStep(); return; }
  if (ev.target.id === 'tour-skip') { endTour(); return; }
  if (ev.target.closest && ev.target.closest('#open-tour')) { show('today'); startTour(); return; }
  if (ev.target.closest && ev.target.closest('#open-tip')) { tipOpen(); return; }
  if (ev.target.closest && ev.target.closest('#open-invite')) { shareSheetOpen('invite'); buzz(10); return; }
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
// Hairline under the header only once content is actually scrolling beneath it.
const _topbar = document.querySelector('.topbar');
addEventListener('scroll', () => { if (_topbar) _topbar.classList.toggle('scrolled', scrollY > 4); }, { passive: true });
refreshStreak();
mediaLoad();
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
// Coming BACK to the app is handled by recheckAlarmHealth()'s own visibilitychange listener,
// which redraws only if the answer changed. A second listener here redrew Settings on every
// return — which emptied the feedback box right after the mail-app handoff that promised
// "your text stays here until you send it".
setTimeout(() => { refreshAlarmHealth().then(() => {
  const s = document.getElementById('s-settings');
  if (s && s.classList.contains('on')) renderSettings();
}); }, 2500);
// Gentle data-safety nudge: local-first means a lost phone = lost data. If there's real
// data and no backup for 14+ days, remind once a week (toast only — never a blocker).
setTimeout(() => {
  try {
    /* Photos and voice notes count: they are the one thing nothing else can recreate, and
       someone who adds a photo a day for a week has more to lose than ten logged moods. */
    const n = Object.keys(DB.entries()).length, m = mediaTotals(), pv = m.photos + m.voice;
    if (n < 10 && pv < 5) return;
    const last = +localStorage.getItem('dp.lastBackup') || 0;
    const nudged = +localStorage.getItem('dp.backupNudge') || 0;
    const D = 86400000;
    let newestMedia = 0; _media.forEach(r => { newestMedia = Math.max(newestMedia, r.ts || 0); });
    const stale = Date.now() - last > 14 * D || (pv >= 5 && newestMedia > last && Date.now() - last > 7 * D);
    if (stale && Date.now() - nudged > 7 * D) {
      localStorage.setItem('dp.backupNudge', String(Date.now()));
      toast('💾 ' + (n ? n + ' days' : '') + (n && pv ? ' and ' : '') + (pv ? pv + ' photos/voice notes' : '') + ', no recent backup — export one in Settings ▸ Backup', true);
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
