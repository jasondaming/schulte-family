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

// Reunion sheet names
const REUNION_SHEET    = 'Reunion';      // admin-managed content (schedule, info, bring list)
const FOOD_SIGNUP_SHEET = 'FoodSignup'; // anyone can sign up

// Reunion sheet columns
const RU = {
  ID:           1,  // A
  TYPE:         2,  // B  — 'info' | 'schedule' | 'bring'
  TITLE:        3,  // C
  BODY:         4,  // D
  SORT_ORDER:   5,  // E
  UPDATED_AT:   6,  // F
  UPDATED_BY:   7,  // G
};

// FoodSignup sheet columns
const FS = {
  SIGNUP_ID:    1,  // A
  PERSON_ID:    2,  // B
  PERSON_NAME:  3,  // C
  DISH:         4,  // D
  CATEGORY:     5,  // E  — Main, Side, Dessert, Drinks, Snacks, Other
  NOTES:        6,  // F
  SIGNED_UP_AT: 7,  // G
};

// === ROUTING ===

function doGet(e) {
  try {
    switch (e.parameter.action) {
      case 'auth':         return jsonResponse(handleAuth(e.parameter));
      case 'getData':      return jsonResponse(handleGetData(e.parameter));
      case 'getEvents':    return jsonResponse(handleGetEvents(e.parameter));
      case 'getChangelog': return jsonResponse(handleGetChangelog(e.parameter));
      case 'getReunion':   return jsonResponse(handleGetReunion(e.parameter));
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
      case 'removePerson':      return jsonResponse(handleRemovePerson(body));
      case 'detachSpouse':      return jsonResponse(handleDetachSpouse(body));
      case 'addEvent':          return jsonResponse(handleAddEvent(body));
      case 'signupFood':        return jsonResponse(handleSignupFood(body));
      case 'removeSignup':      return jsonResponse(handleRemoveSignup(body));
      case 'upsertReunionItem': return jsonResponse(handleUpsertReunionItem(body));
      case 'deleteReunionItem': return jsonResponse(handleDeleteReunionItem(body));
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

  // Identity/admin-only fields
  var adminFieldMap = {
    firstName:   COL.FIRST_NAME,
    lastName:    COL.LAST_NAME,
    birthday:    COL.BIRTHDAY,
    anniversary: COL.ANNIVERSARY,
    deceased:    COL.DECEASED,
    deathDate:   COL.DEATH_DATE,
    notes:       COL.NOTES,
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
  if (body.phone) newRow[COL.PHONE - 1] = body.phone;
  if (body.cell)  newRow[COL.CELL - 1]  = body.cell;
  if (body.email) newRow[COL.EMAIL - 1] = body.email;

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

  // 1. Clear SpouseID on both sides
  if (partnerSheetRow) {
    sheet.getRange(partnerSheetRow, COL.SPOUSE_ID).setValue('');
  }
  sheet.getRange(spouseSheetRow, COL.SPOUSE_ID).setValue('');

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
    // Mark as deceased
    sheet.getRange(spouseSheetRow, COL.DECEASED).setValue('Y');
    if (body.deathDate) {
      sheet.getRange(spouseSheetRow, COL.DEATH_DATE).setValue(body.deathDate);
    }

    if (isMarriedIn && !hasChildren) {
      // Remove entirely — they have no tree connections left
      sheet.deleteRow(spouseSheetRow);
      message = spouseName + ' has been marked as deceased and removed from the directory.';
    } else {
      message = spouseName + ' has been marked as deceased.';
    }
  } else {
    // Divorce
    if (isMarriedIn && !hasChildren) {
      sheet.deleteRow(spouseSheetRow);
      message = spouseName + ' has been removed from the directory.';
    } else {
      // Keep them but unlinked
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

// ============================================================
// === REUNION ================================================
// ============================================================

function handleGetReunion(params) {
  if (!verifyToken(params.token)) return { error: 'Invalid or expired session.' };

  var ss = SpreadsheetApp.openById(SHEET_ID);

  // Reunion content (admin-managed)
  var ruSheet = ensureSheet(ss, REUNION_SHEET,
    ['ID','Type','Title','Body','SortOrder','UpdatedAt','UpdatedBy']);
  var ruData = ruSheet.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < ruData.length; i++) {
    var row = ruData[i];
    if (!row[RU.ID - 1]) continue;
    items.push({
      id:        row[RU.ID - 1],
      type:      str(row[RU.TYPE - 1]),
      title:     str(row[RU.TITLE - 1]),
      body:      str(row[RU.BODY - 1]),
      sortOrder: parseInt(row[RU.SORT_ORDER - 1]) || 0,
      updatedAt: str(row[RU.UPDATED_AT - 1]),
      updatedBy: str(row[RU.UPDATED_BY - 1]),
    });
  }
  items.sort(function(a, b) { return a.sortOrder - b.sortOrder; });

  // Food signups (everyone)
  var fsSheet = ensureSheet(ss, FOOD_SIGNUP_SHEET,
    ['SignupID','PersonID','PersonName','Dish','Category','Notes','SignedUpAt']);
  var fsData = fsSheet.getDataRange().getValues();
  var signups = [];
  for (var j = 1; j < fsData.length; j++) {
    var r = fsData[j];
    if (!r[FS.SIGNUP_ID - 1]) continue;
    signups.push({
      signupId:   r[FS.SIGNUP_ID - 1],
      personId:   String(r[FS.PERSON_ID - 1]),
      personName: str(r[FS.PERSON_NAME - 1]),
      dish:       str(r[FS.DISH - 1]),
      category:   str(r[FS.CATEGORY - 1]),
      notes:      str(r[FS.NOTES - 1]),
      signedUpAt: str(r[FS.SIGNED_UP_AT - 1]),
    });
  }

  return { items: items, signups: signups };
}

function handleSignupFood(body) {
  if (!body.dish || !body.dish.trim()) return { error: 'Dish name is required.' };

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var peopleData = ss.getSheetByName(SHEET_NAME).getDataRange().getValues();
  var me = resolveAuth(body.token, peopleData);
  if (!me) return { error: 'Invalid or expired session.' };
  var myPersonId = me.personId;
  var myName = me.firstName + ' ' + me.lastName;

  var fsSheet = ensureSheet(ss, FOOD_SIGNUP_SHEET,
    ['SignupID','PersonID','PersonName','Dish','Category','Notes','SignedUpAt']);
  var newId = getLastId(fsSheet, FS.SIGNUP_ID) + 1;
  var now = new Date().toISOString();

  fsSheet.appendRow([
    newId,
    myPersonId,
    myName,
    body.dish.trim(),
    body.category || 'Other',
    body.notes || '',
    now,
  ]);

  return { success: true, signupId: newId, personId: myPersonId, personName: myName };
}

function handleRemoveSignup(body) {
  if (!body.signupId) return { error: 'signupId required.' };

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var peopleData = ss.getSheetByName(SHEET_NAME).getDataRange().getValues();
  var me = resolveAuth(body.token, peopleData);
  if (!me) return { error: 'Invalid or expired session.' };
  var myPersonId = me.personId;
  var isAdmin = me.isAdmin;

  var fsSheet = ensureSheet(ss, FOOD_SIGNUP_SHEET,
    ['SignupID','PersonID','PersonName','Dish','Category','Notes','SignedUpAt']);
  var fsData = fsSheet.getDataRange().getValues();

  for (var i = 1; i < fsData.length; i++) {
    if (String(fsData[i][FS.SIGNUP_ID - 1]) === String(body.signupId)) {
      var rowPersonId = String(fsData[i][FS.PERSON_ID - 1]);
      if (!isAdmin && rowPersonId !== myPersonId) {
        return { error: 'You can only remove your own signup.' };
      }
      fsSheet.deleteRow(i + 1); // 1-indexed sheet row
      return { success: true };
    }
  }
  return { error: 'Signup not found.' };
}

// Admin: add or update a reunion content item (schedule, info, bring list)
function handleUpsertReunionItem(body) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var peopleData = ss.getSheetByName(SHEET_NAME).getDataRange().getValues();
  var me = resolveAuth(body.token, peopleData);
  if (!me) return { error: 'Invalid or expired session.' };
  if (!me.isAdmin) return { error: 'Admin access required.' };

  var myPersonId = me.personId;
  var now = new Date().toISOString();

  var ruSheet = ensureSheet(ss, REUNION_SHEET,
    ['ID','Type','Title','Body','SortOrder','UpdatedAt','UpdatedBy']);

  if (body.id) {
    // Update existing row
    var ruData = ruSheet.getDataRange().getValues();
    for (var i = 1; i < ruData.length; i++) {
      if (String(ruData[i][RU.ID - 1]) === String(body.id)) {
        var sheetRow = i + 1;
        if (body.title !== undefined) ruSheet.getRange(sheetRow, RU.TITLE).setValue(body.title);
        if (body.body !== undefined)  ruSheet.getRange(sheetRow, RU.BODY).setValue(body.body);
        if (body.sortOrder !== undefined) ruSheet.getRange(sheetRow, RU.SORT_ORDER).setValue(body.sortOrder);
        ruSheet.getRange(sheetRow, RU.UPDATED_AT).setValue(now);
        ruSheet.getRange(sheetRow, RU.UPDATED_BY).setValue(myPersonId);
        return { success: true, id: body.id };
      }
    }
    return { error: 'Item not found.' };
  } else {
    // New item
    var newId = getLastId(ruSheet, RU.ID) + 1;
    var sortOrder = body.sortOrder || (getLastId(ruSheet, RU.SORT_ORDER) + 10);
    ruSheet.appendRow([newId, body.type || 'info', body.title || '', body.body || '', sortOrder, now, myPersonId]);
    return { success: true, id: newId };
  }
}

function handleDeleteReunionItem(body) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var peopleData = ss.getSheetByName(SHEET_NAME).getDataRange().getValues();
  var me = resolveAuth(body.token, peopleData);
  if (!me) return { error: 'Invalid or expired session.' };
  if (!me.isAdmin) return { error: 'Admin access required.' };

  var ruSheet = ensureSheet(ss, REUNION_SHEET,
    ['ID','Type','Title','Body','SortOrder','UpdatedAt','UpdatedBy']);
  var ruData = ruSheet.getDataRange().getValues();

  for (var i = 1; i < ruData.length; i++) {
    if (String(ruData[i][RU.ID - 1]) === String(body.id)) {
      ruSheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Item not found.' };
}
