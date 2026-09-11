/**
 * Peninsula Bridge Fun Run 2026 — registration backend.
 *
 * This script is container-bound: it must live inside the registration
 * Google Sheet (Extensions → Apps Script). It serves the registration
 * page (Index.html) and records submissions as rows in the sheet.
 *
 * Bib numbers start at 1 and are assigned under a script lock, so two
 * people submitting at the same moment can never receive the same bib.
 * The last-assigned bib is tracked in Script Properties AND cross-checked
 * against the sheet, so bibs are never reused even if rows are deleted.
 */

var DONATION_PER_RUNNER = 25;
var MAX_RUNNERS_PER_SUBMISSION = 20;
var FIRST_BIB = 1;

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Peninsula Bridge Fun Run 2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Called from the page via google.script.run.
 * payload: { participants: [{firstName, lastName, age, shirtSize}, ...],
 *            contact: {name, email, phone} }
 * Returns: { bibs: [{bib, firstName, lastName}, ...], suggestedDonation }
 */
function submitRegistration(payload) {
  if (!payload || !Array.isArray(payload.participants) || payload.participants.length === 0) {
    throw new Error('At least one runner is required.');
  }
  if (payload.participants.length > MAX_RUNNERS_PER_SUBMISSION) {
    throw new Error('Please register at most ' + MAX_RUNNERS_PER_SUBMISSION + ' runners per submission.');
  }
  var contact = payload.contact || {};
  var contactName = clean_(contact.name);
  var contactEmail = clean_(contact.email);
  var contactPhone = clean_(contact.phone);
  if (!contactName) throw new Error('A contact name is required.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) throw new Error('A valid contact email is required.');

  var participants = payload.participants.map(function (p, i) {
    var firstName = clean_(p.firstName);
    var lastName = clean_(p.lastName);
    if (!firstName || !lastName) throw new Error('Runner ' + (i + 1) + ' needs a first and last name.');
    return {
      firstName: firstName,
      lastName: lastName,
      age: clean_(p.age),
      shirtSize: clean_(p.shirtSize)
    };
  });

  // The lock is what guarantees bib numbers are never duplicated:
  // only one submission at a time may read the counter, assign, and write.
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    ensureHeader_(sheet);

    var props = PropertiesService.getScriptProperties();
    var lastBib = Math.max(
      Number(props.getProperty('lastBib')) || 0,
      maxBibInSheet_(sheet),
      FIRST_BIB - 1
    );

    var now = new Date();
    var rows = [];
    var bibs = [];
    participants.forEach(function (p) {
      lastBib += 1;
      bibs.push({ bib: lastBib, firstName: p.firstName, lastName: p.lastName });
      rows.push([lastBib, p.firstName, p.lastName, p.age, p.shirtSize,
                 contactName, contactEmail, contactPhone, now]);
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    props.setProperty('lastBib', String(lastBib));

    return { bibs: bibs, suggestedDonation: participants.length * DONATION_PER_RUNNER };
  } finally {
    lock.releaseLock();
  }
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Bib #', 'First Name', 'Last Name', 'Age', 'T-Shirt Size',
                     'Contact Name', 'Contact Email', 'Contact Phone', 'Registered At']);
  }
}

function maxBibInSheet_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var max = 0;
  values.forEach(function (row) {
    var n = Number(row[0]);
    if (isFinite(n) && n > max) max = n;
  });
  return max;
}

function clean_(value) {
  return String(value == null ? '' : value).trim().slice(0, 200);
}
