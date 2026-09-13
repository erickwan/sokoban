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

// Free tees for the first SHIRT_LIMIT registered participants. This is
// counted with its own participant counter, NOT bib numbers, so the bib
// allocation logic can change without affecting the shirt cutoff.
var SHIRT_LIMIT = 100;

function doGet(e) {
  var admin = e && e.parameter && e.parameter.page === 'admin';
  return HtmlService.createHtmlOutputFromFile(admin ? 'Admin' : 'Index')
    .setTitle(admin ? 'Fun Run Dashboard' : 'Peninsula Bridge Fun Run 2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Called from the page on load so the form knows whether free T-shirts
 * are still available (and for how many more participants).
 */
function getEventStatus() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var props = PropertiesService.getScriptProperties();
  return {
    participantCount: participantCount_(props, sheet),
    shirtEligibleCount: shirtEligibleCount_(props, sheet),
    shirtLimit: SHIRT_LIMIT
  };
}

/**
 * Called from the page via google.script.run.
 * payload: { participants: [{firstName, lastName, category, categoryOther,
 *            shirtSize}, ...], contact: {name, email, phone} }
 * Returns: { bibs: [{bib, firstName, lastName}, ...], suggestedDonation,
 *            participantCount, shirtsDenied }
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

  // pb is set by the ?pb=1 form, but is also inferred from the fields
  // themselves so a page/backend version mismatch degrades gracefully
  // instead of failing validation with a misleading error.
  var pb = payload.pb === true || payload.participants.some(function (p) {
    return !!(p && (p.fatherSurname || p.motherMaidenName));
  });
  var participants = payload.participants.map(function (p, i) {
    var firstName = clean_(p.firstName);
    if (pb) {
      var father = clean_(p.fatherSurname);
      var maiden = clean_(p.motherMaidenName);
      if (!firstName || !father || !maiden) {
        throw new Error('Runner ' + (i + 1) + " needs a first name, father's surname, and mother's maiden name.");
      }
      return {
        firstName: firstName,
        lastName: father,
        motherMaidenName: maiden,
        category: PB_CATEGORY,
        shirtSize: ''
      };
    }
    var lastName = clean_(p.lastName);
    if (!firstName || !lastName) throw new Error('Runner ' + (i + 1) + ' needs a first and last name.');
    var category = clean_(p.category);
    if (!category) throw new Error('Runner ' + (i + 1) + ' needs a category.');
    if (category === 'Other') {
      var other = clean_(p.categoryOther);
      if (!other) throw new Error('Runner ' + (i + 1) + ': please fill in the category for "Other".');
      category = 'Other: ' + other;
    }
    return {
      firstName: firstName,
      lastName: lastName,
      motherMaidenName: '',
      category: category,
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

    // Shirt eligibility runs on its own counter (only participants who
    // could claim a tee — the pb flow never does), still under the same
    // lock, so the 100-shirt cutoff is exact even under concurrent
    // submissions — and stays correct if bib allocation changes.
    var participantCount = participantCount_(props, sheet);
    var shirtEligible = shirtEligibleCount_(props, sheet);

    var now = new Date();
    var rows = [];
    var bibs = [];
    var shirtsDenied = [];
    participants.forEach(function (p) {
      lastBib += 1;
      participantCount += 1;
      var shirtSize = p.shirtSize;
      if (!pb) {
        shirtEligible += 1;
        if (shirtEligible > SHIRT_LIMIT) {
          if (shirtSize) shirtsDenied.push(p.firstName + ' ' + p.lastName);
          shirtSize = '';
        }
      }
      bibs.push({ bib: lastBib, firstName: p.firstName, lastName: p.lastName });
      rows.push([lastBib, p.firstName, p.lastName, p.motherMaidenName, p.category, shirtSize,
                 contactName, contactEmail, contactPhone, now]);
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    props.setProperty('lastBib', String(lastBib));
    props.setProperty('participantCount', String(participantCount));
    props.setProperty('shirtEligibleCount', String(shirtEligible));

    return {
      bibs: bibs,
      suggestedDonation: participants.length * DONATION_PER_RUNNER,
      participantCount: participantCount,
      shirtEligibleCount: shirtEligible,
      shirtsDenied: shirtsDenied
    };
  } finally {
    lock.releaseLock();
  }
}

var HEADERS = ['Bib #', 'First Name', 'Last Name', "Mother's Maiden Name", 'Category',
               'T-Shirt Size', 'Contact Name', 'Contact Email', 'Contact Phone', 'Registered At'];

// Category recorded for registrations made through the ?pb=1 form
// variant (Peninsula Bridge families: surname fields, no shirt picker,
// no donation ask). These participants never claim a free tee, so they
// do not consume the SHIRT_LIMIT slots either.
var PB_CATEGORY = 'Peninsula Bridge';

/**
 * Summary stats for the organizer dashboard (Admin.html, served at
 * <web app URL>?page=admin). The password lives OUTSIDE the code, in
 * Script Properties: Apps Script editor → Project Settings (gear icon)
 * → Script properties → add ADMIN_PASSWORD. Stats are only computed and
 * returned after the password check, so nothing leaks to the page
 * without it.
 */
function getAdminStats(password) {
  var stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!stored) {
    throw new Error('No admin password is set yet. In the Apps Script editor, open ' +
                    'Project Settings → Script properties and add ADMIN_PASSWORD.');
  }
  Utilities.sleep(300); // slow down password guessing
  if (String(password || '') !== stored) throw new Error('Incorrect password.');

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var lastRow = sheet.getLastRow();
  var rows = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var iCategory = HEADERS.indexOf('Category');
  var iShirt = HEADERS.indexOf('T-Shirt Size');
  var iEmail = HEADERS.indexOf('Contact Email');

  var iRegistered = HEADERS.indexOf('Registered At');

  var families = {};
  var byCategory = {};
  var byShirtSize = {};
  var shirtsClaimed = 0;
  var registrationTimes = [];  // epoch ms per participant (Dates are not
                               // legal google.script.run return values)
  rows.forEach(function (row) {
    var t = row[iRegistered] instanceof Date ? row[iRegistered] : new Date(row[iRegistered]);
    if (!isNaN(t.getTime())) registrationTimes.push(t.getTime());
    var email = String(row[iEmail]).trim().toLowerCase();
    if (email) families[email] = true;
    var category = String(row[iCategory]).trim();
    if (category.indexOf('Other') === 0) category = 'Other';
    if (category) byCategory[category] = (byCategory[category] || 0) + 1;
    var size = String(row[iShirt]).trim();
    if (size) {
      byShirtSize[size] = (byShirtSize[size] || 0) + 1;
      shirtsClaimed += 1;
    }
  });

  return {
    updatedAt: new Date().toISOString(),
    families: Object.keys(families).length,
    participants: rows.length,
    byCategory: byCategory,
    byShirtSize: byShirtSize,
    shirtsClaimed: shirtsClaimed,
    shirtLimit: SHIRT_LIMIT,
    registrationTimes: registrationTimes
  };
}

/**
 * DELETES all registrations and resets the bib and T-shirt counters to
 * their starting state. For clearing out test data before launch.
 *
 * Not reachable from the web app — run it manually from the Apps Script
 * editor: select "resetForLaunch" in the function dropdown and click Run.
 */
function resetForLaunch() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty('lastBib');
    props.deleteProperty('participantCount');
    props.deleteProperty('shirtEligibleCount');
  } finally {
    lock.releaseLock();
  }
}

// Keeps row 1 matching HEADERS, so adding or removing a column here
// updates the sheet automatically on the next submission (leftover
// header cells beyond HEADERS are blanked).
function ensureHeader_(sheet) {
  var width = Math.max(sheet.getLastColumn(), HEADERS.length);
  var desired = HEADERS.concat(new Array(width - HEADERS.length).fill(''));
  var current = sheet.getLastRow() === 0 ? [] :
    sheet.getRange(1, 1, 1, width).getValues()[0];
  if (JSON.stringify(current) !== JSON.stringify(desired)) {
    sheet.getRange(1, 1, 1, width).setValues([desired]);
  }
}

// Registered participants so far: the tracked counter, cross-checked
// against the sheet's data-row count (each participant is one row) so a
// fresh script picks up existing registrations.
function participantCount_(props, sheet) {
  return Math.max(
    Number(props.getProperty('participantCount')) || 0,
    Math.max(0, sheet.getLastRow() - 1)
  );
}

// Participants who could claim a free tee (everyone except pb-flow
// registrations): the tracked counter, cross-checked against the
// sheet's non-PB_CATEGORY rows.
function shirtEligibleCount_(props, sheet) {
  var fromProps = Number(props.getProperty('shirtEligibleCount')) || 0;
  var fromSheet = 0;
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var categories = sheet.getRange(2, HEADERS.indexOf('Category') + 1, lastRow - 1, 1).getValues();
    categories.forEach(function (row) {
      if (String(row[0]).trim() !== PB_CATEGORY) fromSheet += 1;
    });
  }
  return Math.max(fromProps, fromSheet);
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
