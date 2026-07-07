/**
 * Schulte Family Directory — Google Apps Script Backend
 *
 * SETUP:
 * 1. Import schulte_people.csv into a Google Sheet, name the tab "People"
 * 2. Add column T (IsAdmin) to the People sheet — put "Y" for admin users
 * 3. Open Extensions > Apps Script
 * 4. Paste this code into Code.gs
 * 5. Set the SHEET_ID constant below
 * 6. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Copy the deployment URL and set it in the website
 *
 * SHEETS USED:
 *   People    — main directory (one row per person)
 *   LifeEvents — life event records (birth, death, marriage, etc.)
 *   Changelog  — audit log of every change (auto-created on first write)
 */

// === CONFIGURATION ===
const SHEET_ID = '1NVQFqNPKC6dxA-CJ1lBuhg1KqDYcsXZtE1K-O4rgOiU';
const SHEET_NAME = 'People';
const LIFE_EVENTS_SHEET = 'LifeEvents';
const CHANGELOG_SHEET = 'Changelog';

// Column mapping (1-indexed) for the People sheet
const COL = {
  PERSON_ID:   1,  // A
  FIRST_NAME:  2,  // B
  LAST_NAME:   3,  // C
  BIRTHDAY:    4,  // D
  DECEASED:    5,  // E
  DEATH_DATE:  6,  // F
  PHONE:       7,  // G
  CELL:        8,  // H
  EMAIL:       9,  // I
  ADDRESS:    10,  // J
  CITY:       11,  // K
  STATE:      12,  // L
  ZIP:        13,  // M
  ANNIVERSARY:14,  // N
  SPOUSE_ID:  15,  // O
  PARENT_ID:  16,  // P
  GENERATION: 17,  // Q
  BRANCH:     18,  // R
  NOTES:      19,  // S
  IS_ADMIN:   20,  // T  ← add this column to your sheet; put "Y" for admins
};

// LifeEvents sheet column mapping (1-indexed)
const EV = {
  EVENT_ID:         1,  // A
  PERSON_ID:        2,  // B
  EVENT_TYPE:       3,  // C
  EVENT_DATE:       4,  // D
  DESCRIPTION:      5,  // E
  LINKED_PERSON_ID: 6,  // F
  RECORDED_BY_ID:   7,  // G
  RECORDED_AT:      8,  // H
};

// Changelog sheet column mapping (1-indexed)
const CL = {
  CHANGE_ID:       1,  // A
  TIMESTAMP:       2,  // B
  CHANGED_BY_ID:   3,  // C
  CHANGED_BY_NAME: 4,  // D
  TARGET_ID:       5,  // E
  TARGET_NAME:     6,  // F
  FIELD:           7,  // G
  OLD_VALUE:       8,  // H
  NEW_VALUE:       9,  // I
};

const TOKEN_SECRET = 'CHANGE_THIS_TO_A_RANDOM_STRING';

// === ROUTING ===

function doGet(e) {
  try {
    switch (e.parameter.action) {
      case 'auth':         return jsonResponse(handleAuth(e.parameter));
      case 'getData':      return jsonResponse(handleGetData(e.parameter));
      case 'getEvents':    return jsonResponse(handleGetEvents(e.parameter));
      case 'getChangelog': return jsonResponse(handleGetChangelog(e.parameter));
      default:             return jsonResponse({ error: 'Unknown action' });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'update':            return jsonResponse(handleUpdate(body));
      case 'addPerson':         return jsonResponse(handleAddPerson(body));
      case 'addSpouse':         return jsonResponse(handleAddSpouse(body));
      case 'removePerson':      return jsonResponse(handleRemovePerson(body));
      case 'detachSpouse':      return jsonResponse(handleDetachSpouse(body));
      case 'addEvent':          return jsonResponse(handleAddEvent(body));
      default:                  return jsonResponse({ error: 'Unknown action' });
    }
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

function handleAuth(params) {
  const name = (params.name || '').trim().toLowerCase();
  const birthday = params.birthday;

  if (!name || !birthday) return { success: false, error: 'Name and birthday required.' };

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const firstName = String(row[COL.FIRST_NAME - 1] || '').trim().toLowerCase();
    const bd = formatDate(row[COL.BIRTHDAY - 1]);
    const deceased = String(row[COL.DECEASED - 1] || '').trim().toUpperCase();

    if (deceased === 'Y') continue;

    if (firstName === name && bd === birthday) {
      const sheetRow = i + 1;
      const personId = row[COL.PERSON_ID - 1];
      const isAdmin = String(row[COL.IS_ADMIN - 1] || '').trim().toUpperCase() === 'Y';
      return {
        success: true,
        token: makeToken(personId),
        personId: personId,
        sheetRow: sheetRow,
        firstName: String(row[COL.FIRST_NAME - 1] || ''),
        lastName: String(row[COL.LAST_NAME - 1] || ''),
        isAdmin: isAdmin,
      };
    }
  }

  return { success: false };
}

// === GET DATA ===

function handleGetData(params) {
  var myPersonId = verifyToken(params.token);
  if (!myPersonId) return { error: 'Invalid or expired session. Please sign in again.' };

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  const people = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const personId = row[COL.PERSON_ID - 1];
    if (!personId) continue;

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
      isAdmin:     str(row[COL.IS_ADMIN - 1]).toUpperCase() === 'Y',
    });
  }

  return { people: people };
}

// === UPDATE ===
// Regular users: can edit contact info for self, spouse, children.
// Admins: can edit contact + identity info for anyone.

function handleUpdate(body) {
  var targetPersonId = body.personId;
  if (!targetPersonId) return { error: 'No personId specified.' };

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();

  var me = resolveAuth(body.token, data);
  if (!me) return { error: 'Invalid or expired session.' };

  var myPersonId = me.personId;
  var mySpouseId = me.spouseId;
  var myFirstName = me.firstName;
  var myLastName = me.lastName;
  var isAdmin = me.isAdmin;

  // Find the target row by personId (never by position)
  var targetSheetRow = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL.PERSON_ID - 1]) === String(targetPersonId)) {
      targetSheetRow = i + 1;
      break;
    }
  }
  if (!targetSheetRow) return { error: 'Person not found.' };

  var targetRow = data[targetSheetRow - 1];
  var targetFirstName = str(targetRow[COL.FIRST_NAME - 1]);
  var targetLastName = str(targetRow[COL.LAST_NAME - 1]);
  var targetParentId = targetRow[COL.PARENT_ID - 1];

  // Authorization check
  var allowed = isAdmin; // admins can edit anyone
  if (!allowed) {
    if (String(targetPersonId) === String(myPersonId)) {
      allowed = true; // self
    } else if (mySpouseId && String(targetPersonId) === String(mySpouseId)) {
      allowed = true; // spouse
    } else if (String(targetParentId) === String(myPersonId) ||
               (mySpouseId && String(targetParentId) === String(mySpouseId))) {
      allowed = true; // child
    }
  }

  if (!allowed) return { error: 'You can only edit yourself, your spouse, or your children.' };

  // Contact fields — editable by anyone (for their family) or admins (for anyone)
  var contactFieldMap = {
    phone:   COL.PHONE,
    cell:    COL.CELL,
    email:   COL.EMAIL,
    address: COL.ADDRESS,
    city:    COL.CITY,
    state:   COL.STATE,
    zip:     COL.ZIP,
  };

  // Personal fields — editable by anyone for their family
  var personalFieldMap = {
    firstName:   COL.FIRST_NAME,
    lastName:    COL.LAST_NAME,
    birthday:    COL.BIRTHDAY,
    anniversary: COL.ANNIVERSARY,
    notes:       COL.NOTES,
  };

  // Admin-only fields
  var adminFieldMap = {
    deceased:    COL.DECEASED,
    deathDate:   COL.DEATH_DATE,
    isAdmin:     COL.IS_ADMIN,
  };

  // Build the set of updates and detect actual changes for changelog
  var updates = {};
  var changedFields = [];

  function applyField(fieldName, col, value) {
    if (value === undefined) return;
    var oldValue = str(targetRow[col - 1]);
    var newValue = str(value);
    if (oldValue !== newValue) {
      updates[col] = value;
      changedFields.push({ field: fieldName, oldValue: oldValue, newValue: newValue });
    }
  }

  for (var field in contactFieldMap) {
    applyField(field, contactFieldMap[field], body[field]);
  }
  for (var pfield in personalFieldMap) {
    applyField(pfield, personalFieldMap[pfield], body[pfield]);
  }
  if (isAdmin) {
    for (var afield in adminFieldMap) {
      applyField(afield, adminFieldMap[afield], body[afield]);
    }
  }

  // Write updates to the sheet
  for (var col in updates) {
    sheet.getRange(targetSheetRow, parseInt(col)).setValue(updates[col]);
  }

  // Log every changed field to the Changelog sheet
  if (changedFields.length > 0) {
    var clSheet = ensureSheet(ss, CHANGELOG_SHEET,
      ['ChangeID', 'Timestamp', 'ChangedByPersonID', 'ChangedByName',
       'TargetPersonID', 'TargetName', 'Field', 'OldValue', 'NewValue']);
    var now = new Date().toISOString();
    var targetName = targetFirstName + ' ' + targetLastName;
    var changerName = myFirstName + ' ' + myLastName;
    var lastId = getLastId(clSheet, CL.CHANGE_ID);
    for (var ci = 0; ci < changedFields.length; ci++) {
      lastId++;
      var cf = changedFields[ci];
      clSheet.appendRow([lastId, now, myPersonId, changerName,
                         targetPersonId, targetName, cf.field, cf.oldValue, cf.newValue]);
    }
  }

  return { success: true, fieldsChanged: changedFields.length };
}

// === ADD / REMOVE PERSON ===
// Users can add children under themselves. Admins can add anyone.

function handleAddPerson(body) {
  if (!body.firstName || !body.firstName.trim()) return { error: 'First name is required.' };

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();

  var me = resolveAuth(body.token, data);
  if (!me) return { error: 'Invalid or expired session.' };
  var myPersonId = me.personId;
  var mySpouseId = me.spouseId;
  var myFirstName = me.firstName;
  var myLastName = me.lastName;
  var isAdmin = me.isAdmin;

  // Determine parent: defaults to the logged-in user
  var parentId = body.parentId ? String(body.parentId) : myPersonId;

  // Authorization: can only add children under self/spouse, or admin can add anywhere
  if (!isAdmin) {
    if (parentId !== myPersonId && parentId !== mySpouseId) {
      return { error: 'You can only add children under yourself or your spouse.' };
    }
  }

  // Find parent's info for branch/generation
  var parentGen = 0;
  var parentBranch = '';
  var parentLastName = '';
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL.PERSON_ID - 1]) === parentId) {
      parentGen = parseInt(data[i][COL.GENERATION - 1]) || 0;
      parentBranch = str(data[i][COL.BRANCH - 1]);
      parentLastName = str(data[i][COL.LAST_NAME - 1]);
      break;
    }
  }

  // Next PersonID
  var maxId = 0;
  for (var j = 1; j < data.length; j++) {
    var pid = parseInt(data[j][COL.PERSON_ID - 1]) || 0;
    if (pid > maxId) maxId = pid;
  }
  var newPersonId = maxId + 1;

  // Build new row (19 columns + IsAdmin = 20 columns)
  var newRow = [];
  for (var c = 0; c < 20; c++) newRow.push('');
  newRow[COL.PERSON_ID - 1]  = newPersonId;
  newRow[COL.FIRST_NAME - 1] = body.firstName.trim();
  newRow[COL.LAST_NAME - 1]  = (body.lastName || parentLastName).trim();
  newRow[COL.BIRTHDAY - 1]   = body.birthday || '';
  newRow[COL.PARENT_ID - 1]  = parseInt(parentId);
  newRow[COL.GENERATION - 1] = parentGen + 1;
  newRow[COL.BRANCH - 1]     = parentBranch;
  if (body.phone)   newRow[COL.PHONE - 1]   = body.phone;
  if (body.cell)    newRow[COL.CELL - 1]    = body.cell;
  if (body.email)   newRow[COL.EMAIL - 1]   = body.email;
  if (body.address) newRow[COL.ADDRESS - 1] = body.address;
  if (body.city)    newRow[COL.CITY - 1]    = body.city;
  if (body.state)   newRow[COL.STATE - 1]   = body.state;
  if (body.zip)     newRow[COL.ZIP - 1]     = body.zip;

  sheet.appendRow(newRow);

  // Log to changelog
  var clSheet = ensureSheet(ss, CHANGELOG_SHEET,
    ['ChangeID', 'Timestamp', 'ChangedByPersonID', 'ChangedByName',
     'TargetPersonID', 'TargetName', 'Field', 'OldValue', 'NewValue']);
  var clId = getLastId(clSheet, CL.CHANGE_ID) + 1;
  var now = new Date().toISOString();
  clSheet.appendRow([
    clId, now, myPersonId, myFirstName + ' ' + myLastName,
    newPersonId, body.firstName.trim() + ' ' + (body.lastName || parentLastName).trim(),
    'add_person', '', 'Added new family member',
  ]);

  return {
    success: true,
    personId: newPersonId,
    message: body.firstName.trim() + ' has been added to the family directory.',
  };
}

// === ADD SPOUSE ===
// Creates a new person and links them as spouse to an existing person.
// Admin only. Sets SpouseID on both the new person and the existing person.

function handleAddSpouse(body) {
  if (!body.firstName || !body.firstName.trim()) return { error: 'First name is required.' };
  if (!body.personId) return { error: 'personId of existing person is required.' };

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();

  var me = resolveAuth(body.token, data);
  if (!me) return { error: 'Invalid or expired session.' };

  var targetPersonId = String(body.personId);

  // Non-admins can only add a spouse for themselves
  if (!me.isAdmin && targetPersonId !== me.personId) {
    return { error: 'You can only add a spouse for yourself.' };
  }

  // Find the existing person
  var targetSheetRow = null;
  var targetRow = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL.PERSON_ID - 1]) === targetPersonId) {
      targetSheetRow = i + 1;
      targetRow = data[i];
      break;
    }
  }
  if (!targetSheetRow) return { error: 'Person not found.' };

  var targetGen = parseInt(targetRow[COL.GENERATION - 1]) || 0;
  var targetBranch = str(targetRow[COL.BRANCH - 1]);
  var targetLastName = str(targetRow[COL.LAST_NAME - 1]);
  var requestedFirstName = body.firstName.trim();
  var requestedLastName = (body.lastName || targetLastName).trim();

  var existingSpouseId = String(targetRow[COL.SPOUSE_ID - 1] || '');
  var previousSpouseSheetRow = null;
  var previousSpouseRow = null;
  var previousSpouseName = '';

  if (existingSpouseId) {
    for (var s = 1; s < data.length; s++) {
      if (String(data[s][COL.PERSON_ID - 1]) === existingSpouseId) {
        previousSpouseSheetRow = s + 1;
        previousSpouseRow = data[s];
        break;
      }
    }

    if (!previousSpouseRow) {
      return { error: 'Existing spouse link points to a missing person. Ask an admin to repair the SpouseID before adding another spouse.' };
    }

    var previousSpouseDeceased = str(previousSpouseRow[COL.DECEASED - 1]).toUpperCase() === 'Y';
    previousSpouseName = (str(previousSpouseRow[COL.FIRST_NAME - 1]) + ' ' + str(previousSpouseRow[COL.LAST_NAME - 1])).trim();
    if (!previousSpouseDeceased) {
      return { error: str(targetRow[COL.FIRST_NAME - 1]) + ' already has a living spouse linked: ' + previousSpouseName + '. Mark that spouse deceased/divorced, or clear the bad SpouseID before adding another current spouse.' };
    }
  }

  var reusable = findReusableSpouseCandidate(data, targetPersonId, requestedFirstName, requestedLastName);
  var newPersonId = null;
  var reusedExistingPerson = false;

  if (reusable) {
    newPersonId = reusable.personId;
    reusedExistingPerson = true;
    updateExistingSpouseRow(sheet, reusable.sheetRow, body, requestedFirstName, requestedLastName, targetPersonId, targetGen, targetBranch);
  } else {
    // Get next PersonID
    var maxId = 0;
    for (var j = 1; j < data.length; j++) {
      var pid = parseInt(data[j][COL.PERSON_ID - 1]) || 0;
      if (pid > maxId) maxId = pid;
    }
    newPersonId = maxId + 1;

    // Build new spouse row
    var newRow = [];
    for (var c = 0; c < 20; c++) newRow.push('');
    newRow[COL.PERSON_ID - 1]  = newPersonId;
    newRow[COL.FIRST_NAME - 1] = requestedFirstName;
    newRow[COL.LAST_NAME - 1]  = requestedLastName;
    newRow[COL.BIRTHDAY - 1]   = body.birthday || '';
    newRow[COL.SPOUSE_ID - 1]  = parseInt(targetPersonId); // Link to existing person
    newRow[COL.GENERATION - 1] = targetGen;
    newRow[COL.BRANCH - 1]     = targetBranch;
    // ParentID left blank - married-in spouse
    if (body.phone)   newRow[COL.PHONE - 1]   = body.phone;
    if (body.cell)    newRow[COL.CELL - 1]    = body.cell;
    if (body.email)   newRow[COL.EMAIL - 1]   = body.email;
    if (body.address) newRow[COL.ADDRESS - 1] = body.address;
    if (body.city)    newRow[COL.CITY - 1]    = body.city;
    if (body.state)   newRow[COL.STATE - 1]   = body.state;
    if (body.zip)     newRow[COL.ZIP - 1]     = body.zip;

    sheet.appendRow(newRow);
  }

  // A deceased spouse can stay in People for history, but the active SpouseID moves to the new spouse.
  // Clear the deceased spouse's reverse link so future edits do not treat them as the active spouse.
  if (previousSpouseSheetRow) {
    sheet.getRange(previousSpouseSheetRow, COL.SPOUSE_ID).setValue('');
  }

  // Link the existing person back to the new spouse
  sheet.getRange(targetSheetRow, COL.SPOUSE_ID).setValue(newPersonId);

  // Log to changelog
  var clSheet = ensureSheet(ss, CHANGELOG_SHEET,
    ['ChangeID', 'Timestamp', 'ChangedByPersonID', 'ChangedByName',
     'TargetPersonID', 'TargetName', 'Field', 'OldValue', 'NewValue']);
  var clId = getLastId(clSheet, CL.CHANGE_ID) + 1;
  var now = new Date().toISOString();
  var targetName = (str(targetRow[COL.FIRST_NAME - 1]) + ' ' + targetLastName).trim();
  var spouseName = (requestedFirstName + ' ' + requestedLastName).trim();
  var oldValue = previousSpouseName ? 'Previous deceased spouse: ' + previousSpouseName : '';
  var newValue = (reusedExistingPerson ? 'Re-linked existing person as spouse of ' : 'Added as spouse of ') + targetName;
  clSheet.appendRow([
    clId, now, me.personId, me.firstName + ' ' + me.lastName,
    newPersonId, spouseName, 'add_spouse',
    oldValue, newValue,
  ]);

  return {
    success: true,
    spousePersonId: newPersonId,
    reusedExistingPerson: reusedExistingPerson,
    replacedDeceasedSpouseName: previousSpouseName,
    message: spouseName + ' has been added as spouse of ' + targetName + '.',
  };
}

function findReusableSpouseCandidate(data, targetPersonId, firstName, lastName) {
  var target = String(targetPersonId);
  var first = normalizeNamePart(firstName);
  var last = normalizeNamePart(lastName);

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var parentId = String(row[COL.PARENT_ID - 1] || '');
    if (parentId !== target) continue;
    if (row[COL.SPOUSE_ID - 1]) continue;
    if (str(row[COL.DECEASED - 1]).toUpperCase() === 'Y') continue;
    if (normalizeNamePart(row[COL.FIRST_NAME - 1]) !== first) continue;
    if (normalizeNamePart(row[COL.LAST_NAME - 1]) !== last) continue;

    return {
      sheetRow: i + 1,
      personId: parseInt(row[COL.PERSON_ID - 1]),
    };
  }

  return null;
}

function updateExistingSpouseRow(sheet, sheetRow, body, firstName, lastName, targetPersonId, targetGen, targetBranch) {
  sheet.getRange(sheetRow, COL.FIRST_NAME).setValue(firstName);
  sheet.getRange(sheetRow, COL.LAST_NAME).setValue(lastName);
  sheet.getRange(sheetRow, COL.SPOUSE_ID).setValue(parseInt(targetPersonId));
  sheet.getRange(sheetRow, COL.PARENT_ID).setValue('');
  sheet.getRange(sheetRow, COL.GENERATION).setValue(targetGen);
  sheet.getRange(sheetRow, COL.BRANCH).setValue(targetBranch);
  if (body.birthday) sheet.getRange(sheetRow, COL.BIRTHDAY).setValue(body.birthday);
  if (body.phone)   sheet.getRange(sheetRow, COL.PHONE).setValue(body.phone);
  if (body.cell)    sheet.getRange(sheetRow, COL.CELL).setValue(body.cell);
  if (body.email)   sheet.getRange(sheetRow, COL.EMAIL).setValue(body.email);
  if (body.address) sheet.getRange(sheetRow, COL.ADDRESS).setValue(body.address);
  if (body.city)    sheet.getRange(sheetRow, COL.CITY).setValue(body.city);
  if (body.state)   sheet.getRange(sheetRow, COL.STATE).setValue(body.state);
  if (body.zip)     sheet.getRange(sheetRow, COL.ZIP).setValue(body.zip);
}

function normalizeNamePart(value) {
  return str(value).trim().toLowerCase();
}
function handleRemovePerson(body) {
  if (!body.personId) return { error: 'personId is required.' };

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();

  var me = resolveAuth(body.token, data);
  if (!me) return { error: 'Invalid or expired session.' };
  var myPersonId = me.personId;
  var mySpouseId = me.spouseId;
  var isAdmin = me.isAdmin;

  var targetPersonId = String(body.personId);

  // Find target row
  var targetSheetRow = null;
  var targetRow = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL.PERSON_ID - 1]) === targetPersonId) {
      targetSheetRow = i + 1;
      targetRow = data[i];
      break;
    }
  }
  if (!targetSheetRow) return { error: 'Person not found.' };

  // Authorization: can only remove own children (or admin can remove anyone)
  var targetParentId = String(targetRow[COL.PARENT_ID - 1] || '');
  if (!isAdmin) {
    if (targetParentId !== myPersonId && targetParentId !== mySpouseId) {
      return { error: 'You can only remove your own children.' };
    }
  }
  // Never allow removing someone who has children — prevents orphaned records
  for (var j = 1; j < data.length; j++) {
    if (String(data[j][COL.PARENT_ID - 1]) === targetPersonId) {
      return { error: 'Cannot remove someone who has children in the database. Remove their children first.' };
    }
  }

  var targetName = str(targetRow[COL.FIRST_NAME - 1]) + ' ' + str(targetRow[COL.LAST_NAME - 1]);

  // Log before deleting
  var clSheet = ensureSheet(ss, CHANGELOG_SHEET,
    ['ChangeID', 'Timestamp', 'ChangedByPersonID', 'ChangedByName',
     'TargetPersonID', 'TargetName', 'Field', 'OldValue', 'NewValue']);
  var clId = getLastId(clSheet, CL.CHANGE_ID) + 1;
  var now = new Date().toISOString();
  var myFirstName = str(myRow[COL.FIRST_NAME - 1]);
  var myLastName = str(myRow[COL.LAST_NAME - 1]);
  clSheet.appendRow([
    clId, now, myPersonId, myFirstName + ' ' + myLastName,
    targetPersonId, targetName, 'remove_person', targetName, 'Removed from directory',
  ]);

  sheet.deleteRow(targetSheetRow);

  return { success: true, message: targetName + ' has been removed.' };
}

// === DETACH SPOUSE (death or divorce) ===
// Clears the SpouseID link between two people.
// For death: marks the departing person as deceased.
// If the departing person is married-in (no ParentID) and has no children,
// they are removed from the directory. Otherwise they stay as inactive/deceased.

function handleDetachSpouse(body) {
  var reason = body.reason; // 'death' or 'divorce'
  if (reason !== 'death' && reason !== 'divorce') return { error: 'Reason must be "death" or "divorce".' };

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();

  var me = resolveAuth(body.token, data);
  if (!me) return { error: 'Invalid or expired session.' };
  var myPersonId = me.personId;
  var mySpouseId = me.spouseId;
  var myFirstName = me.firstName;
  var myLastName = me.lastName;
  var isAdmin = me.isAdmin;

  // Determine who is being detached
  var spousePersonId = body.spousePersonId ? String(body.spousePersonId) : mySpouseId;
  if (!spousePersonId) return { error: 'No spouse to detach.' };

  // Find the spouse row
  var spouseSheetRow = null;
  var spouseRow = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL.PERSON_ID - 1]) === spousePersonId) {
      spouseSheetRow = i + 1;
      spouseRow = data[i];
      break;
    }
  }
  if (!spouseSheetRow) return { error: 'Spouse not found.' };

  var spouseFirstName = str(spouseRow[COL.FIRST_NAME - 1]);
  var spouseLastName = str(spouseRow[COL.LAST_NAME - 1]);
  var spouseName = spouseFirstName + ' ' + spouseLastName;
  var spouseParentId = spouseRow[COL.PARENT_ID - 1];

  // Authorization: must be the spouse's partner or admin
  var partnerId = String(spouseRow[COL.SPOUSE_ID - 1] || '');
  if (!isAdmin && partnerId !== myPersonId) {
    return { error: 'You can only detach your own spouse.' };
  }

  // Find the Schulte-line partner's row (the one keeping their spot)
  var partnerSheetRow = null;
  for (var j = 1; j < data.length; j++) {
    if (String(data[j][COL.PERSON_ID - 1]) === partnerId) {
      partnerSheetRow = j + 1;
      break;
    }
  }

  // 1. For divorce: clear SpouseID on both sides. For death: keep the link.
  if (reason === 'divorce') {
    if (partnerSheetRow) {
      sheet.getRange(partnerSheetRow, COL.SPOUSE_ID).setValue('');
    }
    sheet.getRange(spouseSheetRow, COL.SPOUSE_ID).setValue('');
  }

  // 2. Check if the departing spouse has children in the database
  var hasChildren = false;
  for (var k = 1; k < data.length; k++) {
    if (String(data[k][COL.PARENT_ID - 1]) === spousePersonId) {
      hasChildren = true;
      break;
    }
  }

  // 3. Determine if spouse is married-in (no ParentID = not Schulte bloodline)
  var isMarriedIn = !spouseParentId;

  var message = '';

  if (reason === 'death') {
    // Mark as deceased but KEEP in the database for family records
    sheet.getRange(spouseSheetRow, COL.DECEASED).setValue('Y');
    if (body.deathDate) {
      sheet.getRange(spouseSheetRow, COL.DEATH_DATE).setValue(body.deathDate);
    }
    message = spouseName + ' has been marked as deceased.';
  } else {
    // Divorce — remove married-in spouses with no children; keep everyone else
    if (isMarriedIn && !hasChildren) {
      sheet.deleteRow(spouseSheetRow);
      message = spouseName + ' has been removed from the directory.';
    } else {
      message = spouseName + ' has been unlinked. They remain in the directory.';
    }
  }

  // Log to changelog
  var clSheet = ensureSheet(ss, CHANGELOG_SHEET,
    ['ChangeID', 'Timestamp', 'ChangedByPersonID', 'ChangedByName',
     'TargetPersonID', 'TargetName', 'Field', 'OldValue', 'NewValue']);
  var clId = getLastId(clSheet, CL.CHANGE_ID) + 1;
  var now = new Date().toISOString();
  clSheet.appendRow([
    clId, now, myPersonId, myFirstName + ' ' + myLastName,
    spousePersonId, spouseName, reason, 'SpouseID=' + partnerId, message,
  ]);

  // Also record a life event
  var evSheet = ensureSheet(ss, LIFE_EVENTS_SHEET,
    ['EventID', 'PersonID', 'EventType', 'EventDate', 'Description',
     'LinkedPersonID', 'RecordedByPersonID', 'RecordedAt']);
  var evId = getLastId(evSheet, EV.EVENT_ID) + 1;
  evSheet.appendRow([
    evId, spousePersonId, reason, body.deathDate || now.split('T')[0],
    reason === 'death' ? 'Passed away' : 'Divorce',
    partnerId, myPersonId, now,
  ]);

  return { success: true, message: message };
}

// === LIFE EVENTS ===

function handleGetEvents(params) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var peopleSheet = ss.getSheetByName(SHEET_NAME);
  var peopleData = peopleSheet.getDataRange().getValues();

  var me = resolveAuth(params.token, peopleData);
  if (!me) return { error: 'Invalid or expired session.' };
  var myPersonId = me.personId;
  var mySpouseId = me.spouseId;
  var isAdmin = me.isAdmin;

  // Build set of person IDs this user is allowed to see
  var allowedIds = new Set([myPersonId]);
  if (mySpouseId) allowedIds.add(mySpouseId);
  for (var i = 1; i < peopleData.length; i++) {
    var pid = String(peopleData[i][COL.PERSON_ID - 1] || '');
    var parentId = String(peopleData[i][COL.PARENT_ID - 1] || '');
    if (parentId && (parentId === myPersonId || (mySpouseId && parentId === mySpouseId))) {
      allowedIds.add(pid);
    }
  }

  var evSheet = ensureSheet(ss, LIFE_EVENTS_SHEET,
    ['EventID', 'PersonID', 'EventType', 'EventDate', 'Description',
     'LinkedPersonID', 'RecordedByPersonID', 'RecordedAt']);
  var evData = evSheet.getDataRange().getValues();

  // Optional filter by a specific personId
  var filterPersonId = params.personId ? String(params.personId) : null;

  var events = [];
  for (var j = 1; j < evData.length; j++) {
    var row = evData[j];
    if (!row[EV.EVENT_ID - 1]) continue;

    var evPersonId = String(row[EV.PERSON_ID - 1]);
    if (!isAdmin && !allowedIds.has(evPersonId)) continue;
    if (filterPersonId && evPersonId !== filterPersonId) continue;

    events.push({
      eventId:        row[EV.EVENT_ID - 1],
      personId:       row[EV.PERSON_ID - 1],
      eventType:      str(row[EV.EVENT_TYPE - 1]),
      eventDate:      formatDate(row[EV.EVENT_DATE - 1]),
      description:    str(row[EV.DESCRIPTION - 1]),
      linkedPersonId: row[EV.LINKED_PERSON_ID - 1] || null,
      recordedById:   row[EV.RECORDED_BY_ID - 1],
      recordedAt:     str(row[EV.RECORDED_AT - 1]),
    });
  }

  events.sort(function(a, b) {
    return (b.eventDate || '').localeCompare(a.eventDate || '');
  });

  return { events: events };
}

function handleAddEvent(body) {
  if (!body.personId) return { error: 'personId is required.' };
  if (!body.eventType) return { error: 'eventType is required.' };

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var peopleSheet = ss.getSheetByName(SHEET_NAME);
  var peopleData = peopleSheet.getDataRange().getValues();

  var me = resolveAuth(body.token, peopleData);
  if (!me) return { error: 'Invalid or expired session.' };
  var myPersonId = me.personId;
  var mySpouseId = me.spouseId;
  var myFirstName = me.firstName;
  var myLastName = me.lastName;
  var isAdmin = me.isAdmin;

  var targetPersonId = String(body.personId);

  // Authorization: self, spouse, child, or admin
  var allowed = isAdmin;
  if (!allowed) {
    if (targetPersonId === myPersonId) {
      allowed = true;
    } else if (mySpouseId && targetPersonId === mySpouseId) {
      allowed = true;
    } else {
      for (var i = 1; i < peopleData.length; i++) {
        if (String(peopleData[i][COL.PERSON_ID - 1]) === targetPersonId) {
          var parentId = String(peopleData[i][COL.PARENT_ID - 1] || '');
          if (parentId === myPersonId || (mySpouseId && parentId === mySpouseId)) {
            allowed = true;
          }
          break;
        }
      }
    }
  }
  if (!allowed) return { error: 'You can only add events for yourself, your spouse, or your children.' };

  // Find target name for logging
  var targetName = 'Unknown';
  for (var j = 1; j < peopleData.length; j++) {
    if (String(peopleData[j][COL.PERSON_ID - 1]) === targetPersonId) {
      targetName = str(peopleData[j][COL.FIRST_NAME - 1]) + ' ' + str(peopleData[j][COL.LAST_NAME - 1]);
      break;
    }
  }

  var evSheet = ensureSheet(ss, LIFE_EVENTS_SHEET,
    ['EventID', 'PersonID', 'EventType', 'EventDate', 'Description',
     'LinkedPersonID', 'RecordedByPersonID', 'RecordedAt']);
  var now = new Date().toISOString();
  var newId = getLastId(evSheet, EV.EVENT_ID) + 1;

  evSheet.appendRow([
    newId,
    targetPersonId,
    body.eventType,
    body.eventDate || '',
    body.description || '',
    body.linkedPersonId || '',
    myPersonId,
    now,
  ]);

  // Log to changelog
  var clSheet = ensureSheet(ss, CHANGELOG_SHEET,
    ['ChangeID', 'Timestamp', 'ChangedByPersonID', 'ChangedByName',
     'TargetPersonID', 'TargetName', 'Field', 'OldValue', 'NewValue']);
  var clId = getLastId(clSheet, CL.CHANGE_ID) + 1;
  clSheet.appendRow([
    clId, now, myPersonId, myFirstName + ' ' + myLastName,
    targetPersonId, targetName,
    'life_event:' + body.eventType,
    '',
    body.description || body.eventType,
  ]);

  return { success: true, eventId: newId };
}

// === CHANGELOG ===

function handleGetChangelog(params) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var peopleSheet = ss.getSheetByName(SHEET_NAME);
  var peopleData = peopleSheet.getDataRange().getValues();

  var me = resolveAuth(params.token, peopleData);
  if (!me) return { error: 'Invalid or expired session.' };
  var myPersonId = me.personId;
  var mySpouseId = me.spouseId;
  var isAdmin = me.isAdmin;

  // Build family set for non-admins
  var allowedIds = new Set([myPersonId]);
  if (mySpouseId) allowedIds.add(mySpouseId);
  for (var i = 1; i < peopleData.length; i++) {
    var pid = String(peopleData[i][COL.PERSON_ID - 1] || '');
    var parentId = String(peopleData[i][COL.PARENT_ID - 1] || '');
    if (parentId && (parentId === myPersonId || (mySpouseId && parentId === mySpouseId))) {
      allowedIds.add(pid);
    }
  }

  var clSheet = ensureSheet(ss, CHANGELOG_SHEET,
    ['ChangeID', 'Timestamp', 'ChangedByPersonID', 'ChangedByName',
     'TargetPersonID', 'TargetName', 'Field', 'OldValue', 'NewValue']);
  var clData = clSheet.getDataRange().getValues();

  var changes = [];
  for (var j = 1; j < clData.length; j++) {
    var row = clData[j];
    if (!row[CL.CHANGE_ID - 1]) continue;

    var targetId = String(row[CL.TARGET_ID - 1] || '');
    // Non-admins see only changes to their family
    if (!isAdmin && !allowedIds.has(targetId)) continue;

    changes.push({
      changeId:      row[CL.CHANGE_ID - 1],
      timestamp:     str(row[CL.TIMESTAMP - 1]),
      changedById:   String(row[CL.CHANGED_BY_ID - 1] || ''),
      changedByName: str(row[CL.CHANGED_BY_NAME - 1]),
      targetId:      String(row[CL.TARGET_ID - 1] || ''),
      targetName:    str(row[CL.TARGET_NAME - 1]),
      field:         str(row[CL.FIELD - 1]),
      oldValue:      str(row[CL.OLD_VALUE - 1]),
      newValue:      str(row[CL.NEW_VALUE - 1]),
    });
  }

  // Newest first
  changes.sort(function(a, b) {
    return (b.timestamp || '').localeCompare(a.timestamp || '');
  });

  return { changes: changes };
}

// === SHEET UTILITIES ===

function ensureSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getLastId(sheet, col) {
  var data = sheet.getDataRange().getValues();
  var maxId = 0;
  for (var i = 1; i < data.length; i++) {
    var id = parseInt(data[i][col - 1]) || 0;
    if (id > maxId) maxId = id;
  }
  return maxId;
}

// === UTILITIES ===

function str(val) {
  if (val === null || val === undefined || val === '') return '';
  return String(val).trim();
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
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

function makeToken(personId) {
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    'pid:' + personId + ':' + TOKEN_SECRET
  ).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('').substring(0, 16);
  return Utilities.base64Encode('pid:' + personId + ':' + hash);
}

// Returns the personId (stable, survives row deletes) or null.
function verifyToken(token) {
  if (!token) return null;
  try {
    const decoded = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    const parts = decoded.split(':');
    // New format: "pid:<personId>:<hash>"
    if (parts[0] === 'pid' && parts.length === 3) {
      const personId = parseInt(parts[1]);
      const providedHash = parts[2];
      if (!personId) return null;
      const expectedHash = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        'pid:' + personId + ':' + TOKEN_SECRET
      ).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('').substring(0, 16);
      return providedHash === expectedHash ? personId : null;
    }
    // Legacy format: "<sheetRow>:<hash>" — reject (force re-login)
    return null;
  } catch (e) {
    return null;
  }
}

// Resolve a personId to { sheetRow, rowData } by scanning the People sheet.
function findPersonById(data, personId) {
  var pid = String(personId);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL.PERSON_ID - 1]) === pid) {
      return { sheetRow: i + 1, rowData: data[i] };
    }
  }
  return null;
}

// Authenticate a token and resolve the caller's row. Returns null or an object with all the
// caller's info needed by most handlers. Callers should check for null and return an error.
function resolveAuth(token, data) {
  var personId = verifyToken(token);
  if (!personId) return null;
  var found = findPersonById(data, personId);
  if (!found) return null;
  var row = found.rowData;
  return {
    personId:  String(row[COL.PERSON_ID - 1]),
    sheetRow:  found.sheetRow,
    row:       row,
    firstName: str(row[COL.FIRST_NAME - 1]),
    lastName:  str(row[COL.LAST_NAME - 1]),
    spouseId:  row[COL.SPOUSE_ID - 1] ? String(row[COL.SPOUSE_ID - 1]) : null,
    isAdmin:   str(row[COL.IS_ADMIN - 1]).toUpperCase() === 'Y',
  };
}

