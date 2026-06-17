/**
 * Daily Pulse → Google Sheet sync backend
 * --------------------------------------------------------------
 * SETUP (one time, ~3 minutes):
 *  1. Open your Google Sheet (or make a new one).
 *  2. Extensions ▸ Apps Script.
 *  3. Delete anything there, paste THIS whole file, click Save.
 *  4. Click Deploy ▸ New deployment ▸ type "Web app".
 *       - Execute as: Me
 *       - Who has access: Anyone
 *     Click Deploy, authorize, and COPY the Web App URL.
 *  5. In the app: More ▸ Google Sheet sync ▸ paste the URL ▸ Save link.
 * That's it — every saved day appends/updates a row in the "Log" tab.
 */

var SHEET_NAME = 'Log';

// Column order written to the sheet. Add keys here to capture more fields.
var COLUMNS = [
  'date', 'updatedAt', 'mood', 'energy', 'sleepHours', 'deepWorkHours',
  'tasksDone', 'tasksPlanned',
  // habits (flattened)
  'workout', 'faceWorkout', 'meditation', 'english', 'reading',
  'projectAI', 'projectSpace', 'healthyFood', 'posted', 'consumed', 'hairCare', 'skinCare',
  // reflection
  'wentWell', 'improve', 'journal',
  // workout summary (from the Gym tab)
  'workoutsDone', 'workoutDetail',
  // deep log — mind & wellbeing
  'focus', 'productivity', 'clarity', 'motivation',
  'stress', 'anxiety', 'happiness', 'meditationMin', 'gratitude',
  // deep log — health
  'sleepQuality', 'water', 'caffeine', 'weight', 'meals',
  // deep log — work
  'efficiency', 'workSatisfaction', 'workHours', 'meetings', 'goalsAchieved',
  // deep log — learning
  'retention', 'codeLines', 'papers', 'topics', 'newConcepts', 'crossDomain',
  // deep log — finance
  'financialStress', 'income', 'expenses', 'savings',
  // deep log — digital
  'screenTime', 'socialMedia',
  // deep log — growth
  'lifeSatisfaction', 'purposeClarity', 'keyInsight', 'breakthrough', 'priorities',
  // weekly
  'weekWins', 'weekFocus',
  // grooming / care routines (tick lists)
  'hairRoutine', 'skinRoutine',
  // tasks open on this date (carried until completed)
  'tasks'
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.type === 'reminders') return saveReminders_(data.items || []);
    var sheet = getSheet_();
    flatten_(data);
    var row = COLUMNS.map(function (k) { return data[k] !== undefined && data[k] !== null ? data[k] : ''; });

    // Upsert by date (column 1). Guard against an empty sheet (header only).
    var lastRow = sheet.getLastRow();
    var found = -1;
    if (lastRow > 1) {
      var dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < dates.length; i++) {
        if (ymd_(dates[i][0]) === String(data.date)) { found = i + 2; break; }
      }
    }
    if (found > 0) sheet.getRange(found, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() { return json_({ ok: true, msg: 'Daily Pulse sync is live.' }); }

// Reminders → a dedicated "Reminders" tab (rewritten each time)
function saveReminders_(items) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Reminders') || ss.insertSheet('Reminders');
  sh.clear();
  sh.appendRow(['time', 'label', 'enabled']);
  sh.setFrozenRows(1);
  items.forEach(function (r) { sh.appendRow([r.time || '', r.label || '', r.enabled ? 'Yes' : 'No']); });
  return json_({ ok: true, count: items.length });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { sheet = ss.insertSheet(SHEET_NAME); }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('@'); // keep dates as plain text
  }
  return sheet;
}

// Normalize a date cell (string or auto-parsed Date) back to YYYY-MM-DD
function ymd_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
  }
  return String(v);
}

// Flatten nested objects (habits, topics) onto the top level
function flatten_(data) {
  // habits -> one Yes/'' column per habit key
  if (data.habits && typeof data.habits === 'object') {
    Object.keys(data.habits).forEach(function (k) { data[k] = data.habits[k] ? 'Yes' : ''; });
    delete data.habits;
  }
  // any remaining tick-group object (topics, hairRoutine, skinRoutine, …) -> comma list of ticked items
  Object.keys(data).forEach(function (k) {
    var v = data[k];
    if (v && typeof v === 'object' && !(v instanceof Array)) {
      data[k] = Object.keys(v).filter(function (x) { return v[x]; }).join(', ');
    }
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
