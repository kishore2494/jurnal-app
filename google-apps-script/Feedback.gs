/**
 * Daily Pulse — feedback collector (SEPARATE from the personal sync script!)
 * SETUP: create a NEW Google Sheet named "Daily Pulse Feedback" →
 * Extensions ▸ Apps Script → paste this file → Deploy ▸ New deployment ▸
 * Web app, Execute as Me, access "Anyone" → copy URL → paste into
 * FEEDBACK_URL in app.js.
 */
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Feedback') || ss.insertSheet('Feedback');
    if (sh.getLastRow() === 0) { sh.appendRow(['when', 'text', 'contact', 'version', 'device']); sh.setFrozenRows(1); }
    sh.appendRow([new Date(), String(d.text || '').slice(0, 5000), String(d.contact || '').slice(0, 200),
                  String(d.version || ''), String(d.ua || '')]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false })).setMimeType(ContentService.MimeType.JSON);
  }
}
function doGet() { return ContentService.createTextOutput('Daily Pulse feedback endpoint is live.'); }
