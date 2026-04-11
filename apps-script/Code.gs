/**
 * Schulte Family Directory — Google Apps Script Backend
 *
 * This script runs as a web app and serves as the API for the family directory website.
 * It reads/writes data from a Google Sheet with person-centric format (one row per person).
 *
 * SETUP:
 * 1. Import schulte_people.csv into a Google Sheet, name the tab "People"
 * 2. Open Extensions > Apps Script
 * 3. Paste this code into Code.gs
 * 4. Set the SHEET_ID constant below
 * 5. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the deployment URL and set it in the website
 */

// === CONFIGURATION ===
const SHEET_ID = '1NVQFqNPKC6dxA-CJ1lBuhg1KqDYcsXZtE1K-O4rgOiU';
const SHEET_NAME = 'People';

// Column mapping (1-indexed) for the People sheet
const COL = {
  PERSON_ID:  1,  // A
  FIRST_NAME: 2,  // B
  LAST_NAME:  3,  // C
  BIRTHDAY:   4,  // D
  DECEASED:   5,  // E
  DEATH_DATE: 6,  // F
  PHONE:      7,  // G
  CELL:       8,  // H
  EMAIL:      9,  // I
  ADDRESS:   10,  // J
  CITY:      11,  // K
  STATE:     12,  // L
  ZIP:       13,  // M
  ANNIVERSARY:14, // N
  SPOUSE_ID: 15,  // O
  PARENT_ID: 16,  // P
  GENERATION:17,  // Q
  BRANCH:    18,  // R
  NOTES:     19,  // S
};

const TOKEN_SECRET = 'CHANGE_THIS_TO_A_RANDOM_STRING';

// === HANDLERS ===

function doGet(e) {
  try {
    switch (e.parameter.action) {
      case 'auth':   return jsonResponse(handleAuth(e.parameter));
      case 'getData': return jsonResponse(handleGetData(e.parameter));
      default:       return jsonResponse({ error: 'Unknown action' });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'update') return jsonResponse(handleUpdate(body));
    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// === AUTH ===
// Users log in with first name + birthday.
// We search the People sheet for a matching FirstName + Birthday.

function handleAuth(params) {
  const name = (params.name || '').trim().toLowerCase();
  const birthday = params.birthday; // YYYY-MM-DD

  if (!name || !birthday) return { success: false, error: 'Name and birthday required.' };

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const firstName = String(row[COL.FIRST_NAME - 1] || '').trim().toLowerCase();
    const bd = formatDate(row[COL.BIRTHDAY - 1]);
    const deceased = String(row[COL.DECEASED - 1] || '').trim().toUpperCase();

    // Don't let deceased persons log in
    if (deceased === 'Y') continue;

    if (firstName === name && bd === birthday) {
      const sheetRow = i + 1; // 1-indexed
      const personId = row[COL.PERSON_ID - 1];
      return {
        success: true,
        token: makeToken(sheetRow),
        personId: personId,
        sheetRow: sheetRow,
        firstName: String(row[COL.FIRST_NAME - 1] || ''),
        lastName: String(row[COL.LAST_NAME - 1] || ''),
      };
    }
  }

  return { success: false };
}

// === DATA ===

function handleGetData(params) {
  const sheetRow = verifyToken(params.token);
  if (!sheetRow) return { error: 'Invalid or expired session. Please sign in again.' };

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  const people = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const personId = row[COL.PERSON_ID - 1];
    if (!personId) continue; // skip blank rows

    people.push({
      personId:    personId,
      sheetRow:    i + 1,
      firstName:   str(row[COL.FIRST_NAME - 1]),
      lastName:    str(row[COL.LAST_NAME - 1]),
      birthday:    formatDate(row[COL.BIRTHDAY - 1]),
      deceased:    str(row[COL.DECEASED - 1]).toUpperCase() === 'Y',
      deathDate:   formatDate(row[COL.DEATH_DATE - 1]),
      phone:       str(row[COL.PHONE - 1]),
      cell:        str(row[COL.CELL - 1]),
      email:       str(row[COL.EMAIL - 1]),
      address:     str(row[COL.ADDRESS - 1]),
      city:        str(row[COL.CITY - 1]),
      state:       str(row[COL.STATE - 1]),
      zip:         str(row[COL.ZIP - 1]),
      anniversary: formatDate(row[COL.ANNIVERSARY - 1]),
      spouseId:    row[COL.SPOUSE_ID - 1] || null,
      parentId:    row[COL.PARENT_ID - 1] || null,
      generation:  row[COL.GENERATION - 1] || 0,
      branch:      str(row[COL.BRANCH - 1]),
      notes:       str(row[COL.NOTES - 1]),
    });
  }

  return { people: people };
}

// === UPDATE ===
// Users can only update their own row (matched by token).
// Only contact fields are editable — not name, birthday, relationships, etc.

function handleUpdate(body) {
  const sheetRow = verifyToken(body.token);
  if (!sheetRow) return { error: 'Invalid or expired session.' };

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

  const updates = {
    [COL.PHONE]:   body.phone,
    [COL.CELL]:    body.cell,
    [COL.EMAIL]:   body.email,
    [COL.ADDRESS]: body.address,
    [COL.CITY]:    body.city,
    [COL.STATE]:   body.state,
    [COL.ZIP]:     body.zip,
  };

  for (const [col, value] of Object.entries(updates)) {
    if (value !== undefined) {
      sheet.getRange(sheetRow, parseInt(col)).setValue(value);
    }
  }

  return { success: true };
}

// === UTILITIES ===

function str(val) {
  if (val === null || val === undefined || val === '') return '';
  return String(val).trim();
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    // Use UTC methods to avoid timezone day-shift issues
    var y = val.getUTCFullYear();
    var m = String(val.getUTCMonth() + 1).padStart(2, '0');
    var d = String(val.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  var s = String(val).trim();
  if (s.indexOf('T') > 0) s = s.split('T')[0];
  if (s.indexOf(' ') > 0 && s.split(' ')[0].split('-').length === 3) s = s.split(' ')[0];
  return s;
}

function makeToken(sheetRow) {
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    sheetRow + ':' + TOKEN_SECRET
  ).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('').substring(0, 16);
  return Utilities.base64Encode(sheetRow + ':' + hash);
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const decoded = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    const [rowStr, providedHash] = decoded.split(':');
    const sheetRow = parseInt(rowStr);
    const expectedHash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      sheetRow + ':' + TOKEN_SECRET
    ).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('').substring(0, 16);
    return providedHash === expectedHash ? sheetRow : null;
  } catch (e) {
    return null;
  }
}
