/* ============================================================
   Daily Pulse — local-first life tracker (PWA)
   Data lives in localStorage; optionally syncs to a Google Sheet.
   ============================================================ */

'use strict';

/* ---------- Config: your habits (from the Daily Pulse form) ---------- */
const HABITS = [
  { key: 'workout',     emoji: '🏋️', label: 'Workout' },
  { key: 'faceWorkout', emoji: '😊', label: 'Face workout', color: '#fb923c' },
  { key: 'meditation',  emoji: '🧘', label: 'Meditation' },
  { key: 'english',     emoji: '🗣️', label: 'English practice', color: '#fb923c' },
  { key: 'reading',     emoji: '📚', label: 'Books / Reading' },
  { key: 'projectAI',   emoji: '🤖', label: 'Project — AI' },
  { key: 'projectSpace',emoji: '🚀', label: 'Project — Space tech' },
  { key: 'healthyFood', emoji: '🥗', label: 'Healthy food only', color: '#fb923c' },
  { key: 'posted',      emoji: '📤', label: 'Posted content' },
  { key: 'consumed',    emoji: '🧠', label: 'Consumed useful content' },
  { key: 'hairCare',    emoji: '💇', label: 'Hair care' },
  { key: 'skinCare',    emoji: '🧴', label: 'Skin care' },
];

/* Deep-log sections — the bridge to your full Life Intelligence Tracker.
   Data-driven: add fields here and they appear in the form AND sync to your Sheet
   (also add the new keys to COLUMNS in google-apps-script/Code.gs). */
const DEEP_SECTIONS = [
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
let _recog = null, _recogOn = false;
function dictateInto(key, btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Voice input needs Chrome / Android', true); return; }
  if (_recogOn) { _recog && _recog.stop(); return; }
  const ta = document.querySelector(`[data-txt="${key}"]`); if (!ta) return;
  _recog = new SR(); _recog.lang = 'en-IN'; _recog.continuous = true; _recog.interimResults = false;
  _recogOn = true; btn.classList.add('rec'); btn.textContent = '● Listening… tap to stop';
  _recog.onresult = (ev) => {
    let txt = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) txt += ev.results[i][0].transcript;
    txt = txt.trim();
    if (txt) { ta.value = (ta.value ? ta.value + ' ' : '') + txt; ta.dispatchEvent(new Event('input', { bubbles: true })); }
  };
  _recog.onerror = (e) => { toast(e.error === 'not-allowed' ? 'Mic permission blocked' : 'Mic error', true); };
  _recog.onend = () => { _recogOn = false; btn.classList.remove('rec'); btn.textContent = '🎤 Speak'; };
  try { _recog.start(); toast('Listening… speak now 🎤'); } catch (e) { _recogOn = false; }
}
document.addEventListener('click', (ev) => { const m = ev.target.closest('[data-mic]'); if (m) dictateInto(m.dataset.mic, m); });

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
  syncReminders(); syncNotes(); pushState(true);
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
      entries: DB.entries(), tasks: DB.tasks(), notes: DB.notes(),
      reminders: DB.reminders(), gym: DB.gym(), exercises: DB.exercises() };
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
  let changed = false;

  if (remote.entries) {
    const local = DB.entries();
    Object.keys(remote.entries).forEach(d => {
      const r = remote.entries[d], l = local[d];
      if (!l || (r.updatedAt || '') > (l.updatedAt || '')) { local[d] = r; changed = true; }
    });
    localStorage.setItem('dp.entries', JSON.stringify(local));
  }
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
  [['tasks', 'dp.tasks'], ['notes', 'dp.notes'], ['reminders', 'dp.reminders']].forEach(([key, store]) => {
    if (!remote[key]) return;
    const local = JSON.parse(localStorage.getItem(store) || '[]');
    const ids = new Set(local.map(x => x.id));
    const add = remote[key].filter(x => !ids.has(x.id));
    if (add.length) { localStorage.setItem(store, JSON.stringify(local.concat(add))); changed = true; }
  });
  if (remote.exercises && !localStorage.getItem('dp.exercises')) localStorage.setItem('dp.exercises', JSON.stringify(remote.exercises));

  if (changed) {
    localStorage.setItem('dp.touched', String(Date.now()));
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

  document.getElementById('s-today').innerHTML = `
    <div class="card">
      <div class="field"><label>Date</label>
        <input type="date" id="log-date" value="${logDate}" max="${todayStr()}"></div>
      ${scaleField('mood','Evening mood',false)}
      ${scaleField('energy','Energy level',false)}
      <div class="row2">
        <div class="field"><label>Sleep hrs <span class="req">*</span></label>
          <input type="number" step="0.5" inputmode="decimal" data-num="sleepHours" value="${draft.sleepHours??''}"></div>
        <div class="field"><label>Deep work hrs <span class="req">*</span></label>
          <input type="number" step="0.5" inputmode="decimal" data-num="deepWorkHours" value="${draft.deepWorkHours??''}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Tasks done</label>
          <input type="number" inputmode="numeric" data-num="tasksDone" value="${draft.tasksDone??''}"></div>
        <div class="field"><label>Tasks planned</label>
          <input type="number" inputmode="numeric" data-num="tasksPlanned" value="${draft.tasksPlanned??''}"></div>
      </div>
    </div>

    <div class="card">
      <h2>Daily checklist <span class="hint">tap what you did</span></h2>
      <div class="habits">${habitChips}</div>
    </div>

    <div class="card">
      <h2>Reflection</h2>
      <div class="field"><label>One thing that went well ✨</label>
        <textarea data-txt="wentWell" placeholder="...">${draft.wentWell||''}</textarea></div>
      <div class="field"><label>One thing to improve tomorrow 🎯</label>
        <textarea data-txt="improve" placeholder="...">${draft.improve||''}</textarea></div>
      <div class="field"><label>Journal entry 📓 <span class="hint">type or speak · use #tags to link</span></label>
        <textarea data-txt="journal" placeholder="How was your day?" style="min-height:110px">${draft.journal||''}</textarea>
        <button type="button" class="mic-btn" data-mic="journal">🎤 Speak</button></div>
    </div>

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
      <button class="pal" data-palette="${t.id}">🎨</button>
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
      <h2>To-do <span class="hint">drag ⠿ to set priority</span></h2>
      <div id="task-list">${open.length ? open.map(t=>taskRow(t,true)).join('') : '<div class="empty">No open tasks. Add one below 👇</div>'}</div>
      <div class="task-add">
        <input type="text" id="task-input" placeholder="Add a task…" autocomplete="off">
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
function rerenderList() { if (document.getElementById('s-notes').classList.contains('on')) renderNotes(); else renderTasks(); }
function setColor(id, col) {
  const ts = DB.tasks(); const t = ts.find(x => x.id === id);
  if (t) { t.color = col; DB.saveTasks(ts); openColorId = null; renderTasks(); return; }
  const ns = DB.notes(); const n = ns.find(x => x.id === id);
  if (n) { n.color = col; DB.saveNotes(ns); openColorId = null; renderNotes(); syncNotes(); }
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
      <button class="pal" data-palette="${n.id}">🎨</button>
      <button class="del" data-delnote="${n.id}">×</button>
    </div>
    ${openColorId===n.id ? swatchStrip(n.id) : ''}
  </div>`;
  document.getElementById('s-notes').innerHTML = `
    <div class="card">
      <div class="task-add">
        <input type="text" id="note-input" placeholder="Add a note…" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="note-add-btn">Add</button>
      </div>
      <div class="hint" style="margin-top:8px">Drag ⠿ to reorder · 🎨 to highlight</div>
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
   SCREEN: GYM
   ============================================================ */
let gymDate = todayStr();
let gymDraft = { done: {}, log: {} };
let gymDayId = 'day1';
let gymView = 'home';
let openExr = new Set();

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
  const rows = WORKOUT_DAYS.map(d => {
    const ex = dayExercises(d);
    const done = ex.filter(e => gymDraft.done[dkey(d.id, e.id)]).length;
    const main = dayMain(d);
    const ab = groupById(d.ab);
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
  const day = WORKOUT_DAYS.find(d => d.id === gymDayId) || WORKOUT_DAYS[0];
  const main = dayMain(day);
  const blocks = dayBlocks(day);
  const ex = dayExercises(day);
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
    const detail = doneIds.map(k => { const exId = k.split('/').pop(); const e = WORKOUT_BY_ID[exId]; const nm = e ? e.name : exId; return nm + (gymDraft.log[k] ? ` (${gymDraft.log[k]})` : ''); }).join('; ');
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
  const cols = ['date', 'mood', 'energy', 'sleepHours', 'deepWorkHours', 'tasksDone', 'tasksPlanned', 'workoutsDone', 'workoutDetail', 'wentWell', 'improve', 'journal', 'tasks'];
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
  const gymOrder = ['cardio','chest','triceps','shoulder','biceps','back','legs','abs','side','core'];
  const gymStats = gymOrder.map(id => { const g = groupById(id); return { g, n: groupSessions(g) }; }).filter(x => x.g);
  const gymMax = Math.max(1, ...gymStats.map(x => x.n));
  const totalWorkouts = gymDates.filter(d => Object.values(gym[d].done||{}).some(Boolean)).length;
  const gymBars = gymStats.map(x => `<div class="bar-row"><span class="name">${x.g.emoji} ${x.g.name}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.round(x.n/gymMax*100)}%;background:${x.g.color}"></span></span>
      <span class="pct">${x.n}</span></div>`).join('');

  // ---- Wellbeing / deep-log averages (only those you've logged) ----
  const scaleDefs = [
    {k:'focus',l:'🎯 Focus'},{k:'productivity',l:'⚡ Productivity'},{k:'stress',l:'😰 Stress'},
    {k:'happiness',l:'😊 Happiness'},{k:'sleepQuality',l:'😴 Sleep quality'},{k:'lifeSatisfaction',l:'🌱 Life satisfaction'}
  ];
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
   SCREEN: SETTINGS / MORE
   ============================================================ */
function renderSettings() {
  document.getElementById('screen-title').textContent = 'More';
  document.getElementById('screen-sub').textContent = 'Sync, reminders, data';
  const s = DB.settings();
  document.getElementById('s-settings').innerHTML = `
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
          </div>
          <button class="del" data-rem-del="${r.id}">×</button>
        </div>`).join('') : '<div class="empty">No reminders yet. Add one below 👇</div>'}
      <div class="task-add">
        <input type="time" id="rem-new-time" value="21:00" style="max-width:120px">
        <input type="text" id="rem-new-label" placeholder="Reminder name…">
        <button class="btn btn-primary btn-sm" id="rem-add">Add</button>
      </div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn btn-ghost btn-sm" id="rem-calendar">📅 Add to phone calendar</button>
      </div>
      <div class="hint" style="margin-top:8px">In-app reminders fire while the app is open. For alarms even when it's closed, tap <b>Add to phone calendar</b> — it adds them as daily repeating events with alerts.</div>
    </div>
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
      <div class="hint">Daily Pulse · local-first. Your data stays on this device${s.syncUrl?' and syncs to your Google Sheet':''}.
      Add to Home Screen to use it like a native app, offline.</div></div>
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
  const rd = ev.target.closest('[data-rem-del]');
  if (rd) { DB.saveReminders(DB.reminders().filter(z => z.id !== rd.dataset.remDel)); renderSettings(); syncReminders(); setupReminders(); toast('Reminder deleted'); return; }
  if (ev.target.id === 'rem-calendar') { exportReminderCalendar(); return; }
  if (ev.target.id === 'export') exportData();
  if (ev.target.id === 'export-csv') exportCSV();
  if (ev.target.id === 'import') document.getElementById('import-file').click();
});
// Edit a reminder's time/label inline
document.addEventListener('input', (ev) => {
  const t = ev.target.closest('[data-rem-time]'); if (t) { const r = DB.reminders(); const x = r.find(z => z.id === t.dataset.remTime); if (x) { x.time = t.value; DB.saveReminders(r); setupReminders(); } return; }
  const l = ev.target.closest('[data-rem-label]'); if (l) { const r = DB.reminders(); const x = r.find(z => z.id === l.dataset.remLabel); if (x) { x.label = l.value; DB.saveReminders(r); } return; }
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'import-file' && ev.target.files[0]) importData(ev.target.files[0]);
  if (ev.target.closest('[data-rem-time]') || ev.target.closest('[data-rem-label]')) syncReminders();
});
function exportData() {
  const blob = new Blob([JSON.stringify({ entries: DB.entries(), tasks: DB.tasks(), settings: DB.settings() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'daily-pulse-backup-' + todayStr() + '.json'; a.click();
  toast('Backup downloaded');
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try { const d = JSON.parse(r.result);
      if (d.entries) DB.saveEntries(d.entries);
      if (d.tasks) DB.saveTasks(d.tasks);
      if (d.settings) DB.saveSettings(Object.assign(DB.settings(), d.settings));
      toast('Backup restored'); refreshStreak(); show('dash');
    } catch (e) { toast('Bad backup file', true); }
  };
  r.readAsText(file);
}

/* ---------- Reminders (multiple, foreground firing) ---------- */
let reminderInterval;
function setupReminders() {
  clearInterval(reminderInterval);
  if (!DB.reminders().some(r => r.enabled)) return;
  reminderInterval = setInterval(() => {
    const now = new Date();
    const hhmm = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    DB.reminders().forEach(r => {
      if (!r.enabled || r.time !== hhmm) return;
      const flag = 'dp.notified.' + r.id + '.' + todayStr();
      if (localStorage.getItem(flag)) return;
      localStorage.setItem(flag, '1');
      if ('Notification' in window && Notification.permission === 'granted')
        new Notification('⏰ ' + (r.label || 'Daily Pulse'), { body: r.label ? 'Reminder: ' + r.label : 'Time for your daily log 🔥', tag: r.id });
    });
  }, 20000);
}
// Push the reminders list to the Sheet (a "Reminders" tab)
function syncReminders() {
  const url = DB.settings().syncUrl; if (!url) return;
  fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ type: 'reminders', items: DB.reminders() }) }).catch(() => {});
}
// Download an .ics so the phone calendar alarms even when the app is closed
function exportReminderCalendar() {
  const rs = DB.reminders().filter(r => r.enabled && r.time);
  if (!rs.length) { toast('Add a reminder first', true); return; }
  const pad = n => String(n).padStart(2, '0');
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Daily Pulse//EN\r\nCALSCALE:GREGORIAN\r\n';
  rs.forEach((r, i) => {
    const [h, m] = r.time.split(':');
    ics += 'BEGIN:VEVENT\r\n' +
      'UID:dailypulse-' + r.id + '@jurnal\r\n' +
      'DTSTART:20260101T' + pad(h) + pad(m) + '00\r\n' +
      'RRULE:FREQ=DAILY\r\n' +
      'SUMMARY:' + (r.label || 'Daily Pulse reminder') + '\r\n' +
      'BEGIN:VALARM\r\nTRIGGER:PT0M\r\nACTION:DISPLAY\r\nDESCRIPTION:' + (r.label || 'Daily Pulse') + '\r\nEND:VALARM\r\n' +
      'END:VEVENT\r\n';
  });
  ics += 'END:VCALENDAR\r\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'daily-pulse-reminders.ics'; a.click();
  toast('Calendar file ready — open it to add');
}

/* ---------- Navigation ---------- */
const RENDER = { today: openToday, tasks: renderTasks, notes: renderNotes, gym: openGym, habits: renderHabits, dash: renderDash, history: renderHistory, settings: renderSettings };
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
  show(b.dataset.screen);
});

function refreshStreak() { document.getElementById('streak-n').textContent = loggedStreak(); }
function escapeHtml(s) { return (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---------- Init ---------- */
refreshStreak();
show('today');
setupReminders();
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
