/**
 * Admin panel — search and edit any person, view full changelog.
 * Only visible to users with isAdmin = true.
 */

import { updateProfile, fetchEvents, addEvent, fetchChangelog, addPerson, removePerson, addSpouse } from './api.js';

let allPeople = [];
let peopleById = {};
let sessionToken = null;
let changelog = [];
let selectedPerson = null;
let personEvents = [];

const EVENT_TYPE_LABELS = {
  birth:       'Birth',
  death:       'Death',
  marriage:    'Marriage',
  divorce:     'Divorce',
  adoption:    'Adoption',
  nameChange:  'Name Change',
  relocation:  'Relocation / Move',
  graduation:  'Graduation',
  other:       'Other',
};

export async function initAdmin(people, session) {
  allPeople = people;
  peopleById = {};
  for (const p of people) peopleById[p.personId] = p;
  sessionToken = session.token;

  try {
    const result = await fetchChangelog(sessionToken);
    changelog = result.changes || [];
  } catch (e) {
    changelog = [];
  }

  renderAdminView();
}

function renderAdminView() {
  const container = document.getElementById('admin-view');
  container.innerHTML = `
    <div class="view-header">
      <h2>Admin Panel</h2>
      <span class="admin-badge">Admin Access</span>
    </div>

    <div class="admin-tabs">
      <button class="admin-tab active" data-tab="people">Edit People</button>
      <button class="admin-tab" data-tab="add">Add Person</button>
      <button class="admin-tab" data-tab="changelog">Changelog</button>
    </div>

    <div id="admin-people-panel" class="admin-panel">
      <div class="admin-search-bar">
        <input type="text" id="admin-search-input" placeholder="Search by name...">
        <div id="admin-search-results" class="admin-search-results"></div>
      </div>
      <div id="admin-editor"></div>
    </div>

    <div id="admin-add-panel" class="admin-panel" hidden>
      ${renderAdminAddForm()}
    </div>

    <div id="admin-changelog-panel" class="admin-panel" hidden>
      <div class="changelog-controls">
        <span id="admin-changelog-count" class="changelog-count"></span>
      </div>
      <div id="admin-changelog-table">${renderChangelogTable(changelog)}</div>
    </div>`;

  updateChangelogCount();

  // Tab switching
  container.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('admin-people-panel').hidden = tab.dataset.tab !== 'people';
      document.getElementById('admin-add-panel').hidden = tab.dataset.tab !== 'add';
      document.getElementById('admin-changelog-panel').hidden = tab.dataset.tab !== 'changelog';
    });
  });

  // Add person form handlers
  setupAdminAddForm(container);

  // Search
  const searchInput = document.getElementById('admin-search-input');
  searchInput.addEventListener('input', () => handleSearch(searchInput.value));

  // Close results when clicking outside
  document.addEventListener('click', e => {
    const results = document.getElementById('admin-search-results');
    if (results && !results.contains(e.target) && e.target !== searchInput) {
      results.innerHTML = '';
    }
  });
}

function handleSearch(query) {
  const results = document.getElementById('admin-search-results');
  const q = (query || '').toLowerCase().trim();
  if (!q) { results.innerHTML = ''; return; }

  const matches = allPeople.filter(p => {
    return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q);
  }).slice(0, 12);

  if (!matches.length) {
    results.innerHTML = '<div class="search-empty">No results</div>';
    return;
  }

  results.innerHTML = matches.map(p => `
    <div class="admin-result" data-person-id="${p.personId}">
      <span class="admin-result-name">${esc(p.firstName)} ${esc(p.lastName)}</span>
      <span class="admin-result-info">${p.city ? esc(p.city) + (p.state ? ', ' + esc(p.state) : '') : ''}</span>
    </div>`).join('');

  results.querySelectorAll('.admin-result').forEach(el => {
    el.addEventListener('click', () => {
      const personId = Number(el.dataset.personId);
      document.getElementById('admin-search-input').value =
        `${peopleById[personId].firstName} ${peopleById[personId].lastName}`;
      results.innerHTML = '';
      loadPersonEditor(personId);
    });
  });
}

async function loadPersonEditor(personId) {
  const editor = document.getElementById('admin-editor');
  editor.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';

  selectedPerson = peopleById[personId];
  if (!selectedPerson) { editor.innerHTML = ''; return; }

  try {
    const evResult = await fetchEvents(sessionToken, personId);
    personEvents = evResult.events || [];
  } catch (e) {
    personEvents = [];
  }

  renderPersonEditor();
}

function renderPersonEditor() {
  const person = selectedPerson;
  const editor = document.getElementById('admin-editor');
  const personChangelog = changelog.filter(c => String(c.targetId) === String(person.personId));
  const typeOptions = Object.entries(EVENT_TYPE_LABELS)
    .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

  editor.innerHTML = `
    <div class="admin-person-card">
      <div class="admin-person-header">
        <h3>${esc(person.firstName)} ${esc(person.lastName)}</h3>
        ${person.deceased ? '<span class="deceased-badge">Deceased</span>' : ''}
        ${person.isAdmin ? '<span class="admin-user-badge">Admin</span>' : ''}
      </div>

      ${renderSpouseSection(person)}

      <form class="profile-form admin-edit-form" id="admin-edit-form" data-person-id="${person.personId}">
        <fieldset>
          <legend>Contact Info</legend>
          <div class="form-group">
            <label>Street Address</label>
            <input type="text" id="admin-address" value="${esc(person.address)}">
          </div>
          <div class="form-row">
            <div class="form-group"><label>City</label><input type="text" id="admin-city" value="${esc(person.city)}"></div>
            <div class="form-group form-group-sm"><label>State</label><input type="text" id="admin-state" value="${esc(person.state)}" maxlength="2"></div>
            <div class="form-group form-group-sm"><label>Zip</label><input type="text" id="admin-zip" value="${esc(person.zip)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Phone</label><input type="tel" id="admin-phone" value="${esc(person.phone)}"></div>
            <div class="form-group"><label>Cell</label><input type="text" id="admin-cell" value="${esc(person.cell)}"></div>
          </div>
          <div class="form-group"><label>Email</label><input type="email" id="admin-email" value="${esc(person.email)}"></div>
        </fieldset>

        <fieldset>
          <legend>Personal Info <span class="admin-only-label">(Admin Only)</span></legend>
          <div class="form-row">
            <div class="form-group"><label>First Name</label><input type="text" id="admin-firstName" value="${esc(person.firstName)}"></div>
            <div class="form-group"><label>Last Name</label><input type="text" id="admin-lastName" value="${esc(person.lastName)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Birthday</label><input type="date" id="admin-birthday" value="${esc(person.birthday)}"></div>
            <div class="form-group"><label>Anniversary</label><input type="date" id="admin-anniversary" value="${esc(person.anniversary)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Deceased</label>
              <select id="admin-deceased">
                <option value="">No</option>
                <option value="Y" ${person.deceased ? 'selected' : ''}>Yes</option>
              </select>
            </div>
            <div class="form-group"><label>Death Date</label><input type="date" id="admin-deathDate" value="${esc(person.deathDate)}"></div>
          </div>
          <div class="form-group"><label>Notes</label><input type="text" id="admin-notes" value="${esc(person.notes)}"></div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="admin-isAdmin" ${person.isAdmin ? 'checked' : ''}>
              Grant Admin Access
            </label>
          </div>
        </fieldset>

        <div class="form-actions">
          <button type="submit">Save Changes</button>
          <span class="status-msg" id="admin-save-status" hidden></span>
        </div>
      </form>

      <div class="life-events-block">
        <div class="life-events-header">
          <h4>Life Events — ${esc(person.firstName)}</h4>
          <button class="btn-secondary" id="admin-toggle-event-form">+ Add Event</button>
        </div>
        <div id="admin-event-form" hidden>
          <div class="event-form-fields">
            <div class="form-row">
              <div class="form-group">
                <label>Event Type</label>
                <select id="admin-event-type">${typeOptions}</select>
              </div>
              <div class="form-group">
                <label>Date</label>
                <input type="date" id="admin-event-date">
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <input type="text" id="admin-event-desc" placeholder="Brief description...">
            </div>
            <div class="form-group">
              <label>Linked Person <span class="form-hint">(optional)</span></label>
              <input type="text" id="admin-linked-input" placeholder="Type a name to search...">
              <input type="hidden" id="admin-linked-id">
              <div id="admin-linked-results" class="linked-results"></div>
            </div>
            <div class="form-actions">
              <button type="button" id="admin-event-submit-btn">Save Event</button>
              <span class="status-msg" id="admin-event-status" hidden></span>
            </div>
          </div>
        </div>
        <div id="admin-events-list" class="events-list">
          ${eventsListHtml(personEvents)}
        </div>
      </div>

      ${personChangelog.length ? `
      <div class="person-changelog">
        <h4>Change History for ${esc(person.firstName)}</h4>
        ${renderChangelogTable(personChangelog)}
      </div>` : ''}
    </div>`;

  // Save form
  document.getElementById('admin-edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    await saveAdminEdit(person.personId);
  });

  // Event form toggle
  document.getElementById('admin-toggle-event-form').addEventListener('click', () => {
    const form = document.getElementById('admin-event-form');
    const btn = document.getElementById('admin-toggle-event-form');
    form.hidden = !form.hidden;
    btn.textContent = form.hidden ? '+ Add Event' : '— Cancel';
  });

  // Event submit
  document.getElementById('admin-event-submit-btn').addEventListener('click', () => {
    saveAdminEvent(person.personId);
  });

  // Linked person search
  document.getElementById('admin-linked-input').addEventListener('input', e => {
    showPersonSearch(e.target.value, 'admin-linked-results', 'admin-linked-id', 'admin-linked-input');
  });

  // Add spouse form
  setupSpouseForm(person);
}

async function saveAdminEdit(personId) {
  const form = document.getElementById('admin-edit-form');
  const btn = form.querySelector('button[type="submit"]');
  const status = document.getElementById('admin-save-status');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  status.hidden = true;

  const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };

  const fields = {
    personId,
    address:    get('admin-address'),
    city:       get('admin-city'),
    state:      get('admin-state'),
    zip:        get('admin-zip'),
    phone:      get('admin-phone'),
    cell:       get('admin-cell'),
    email:      get('admin-email'),
    firstName:  get('admin-firstName'),
    lastName:   get('admin-lastName'),
    birthday:   get('admin-birthday'),
    anniversary:get('admin-anniversary'),
    deceased:   get('admin-deceased'),
    deathDate:  get('admin-deathDate'),
    notes:      get('admin-notes'),
    isAdmin:    document.getElementById('admin-isAdmin').checked ? 'Y' : '',
  };

  try {
    const result = await updateProfile(sessionToken, fields);
    // Update local cache
    const person = peopleById[personId];
    if (person) {
      Object.assign(person, {
        address: fields.address, city: fields.city, state: fields.state, zip: fields.zip,
        phone: fields.phone, cell: fields.cell, email: fields.email,
        firstName: fields.firstName, lastName: fields.lastName,
        birthday: fields.birthday, anniversary: fields.anniversary,
        deceased: fields.deceased === 'Y', deathDate: fields.deathDate,
        notes: fields.notes, isAdmin: fields.isAdmin === 'Y',
      });
    }
    selectedPerson = peopleById[personId];

    status.textContent = `Saved! (${result.fieldsChanged || 0} field${result.fieldsChanged !== 1 ? 's' : ''} changed)`;
    status.className = 'status-msg success';
    status.hidden = false;

    // Refresh changelog
    refreshChangelog();

    setTimeout(() => { status.hidden = true; }, 4000);
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    status.className = 'status-msg error';
    status.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

async function saveAdminEvent(personId) {
  const btn = document.getElementById('admin-event-submit-btn');
  const status = document.getElementById('admin-event-status');
  const eventType = document.getElementById('admin-event-type').value;
  const eventDate = document.getElementById('admin-event-date').value;
  const description = document.getElementById('admin-event-desc').value.trim();
  const linkedPersonId = document.getElementById('admin-linked-id').value || null;

  btn.disabled = true;
  btn.textContent = 'Saving...';
  status.hidden = true;

  try {
    const result = await addEvent(sessionToken, {
      personId, eventType,
      eventDate: eventDate || null,
      description: description || null,
      linkedPersonId: linkedPersonId || null,
    });

    personEvents.unshift({
      eventId: result.eventId, personId, eventType,
      eventDate: eventDate || '', description: description || '',
      linkedPersonId, recordedAt: new Date().toISOString(),
    });

    document.getElementById('admin-events-list').innerHTML = eventsListHtml(personEvents);
    document.getElementById('admin-event-date').value = '';
    document.getElementById('admin-event-desc').value = '';
    document.getElementById('admin-linked-id').value = '';
    document.getElementById('admin-linked-input').value = '';

    status.textContent = 'Event saved!';
    status.className = 'status-msg success';
    status.hidden = false;

    document.getElementById('admin-event-form').hidden = true;
    document.getElementById('admin-toggle-event-form').textContent = '+ Add Event';

    refreshChangelog();
    setTimeout(() => { status.hidden = true; }, 3000);
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    status.className = 'status-msg error';
    status.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Event';
  }
}

async function refreshChangelog() {
  try {
    const result = await fetchChangelog(sessionToken);
    changelog = result.changes || [];
    const tableEl = document.getElementById('admin-changelog-table');
    if (tableEl) tableEl.innerHTML = renderChangelogTable(changelog);
    updateChangelogCount();
    // Refresh person-specific changelog if visible
    if (selectedPerson) {
      const personCl = document.querySelector('.person-changelog');
      if (personCl) {
        const personChanges = changelog.filter(c => String(c.targetId) === String(selectedPerson.personId));
        if (personChanges.length) {
          personCl.innerHTML = `<h4>Change History for ${esc(selectedPerson.firstName)}</h4>${renderChangelogTable(personChanges)}`;
        }
      }
    }
  } catch (e) { /* silent */ }
}

function updateChangelogCount() {
  const el = document.getElementById('admin-changelog-count');
  if (el) el.textContent = `${changelog.length} change${changelog.length !== 1 ? 's' : ''} logged`;
}

function showPersonSearch(query, resultsId, hiddenId, inputId) {
  const resultsEl = document.getElementById(resultsId);
  const q = (query || '').toLowerCase().trim();
  if (!q) { resultsEl.innerHTML = ''; return; }

  const matches = allPeople.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) && !p.deceased
  ).slice(0, 8);

  if (!matches.length) { resultsEl.innerHTML = '<p class="search-empty">No matches</p>'; return; }

  resultsEl.innerHTML = matches.map(p => `
    <div class="linked-result" data-id="${p.personId}" data-name="${esc(p.firstName)} ${esc(p.lastName)}">
      ${esc(p.firstName)} ${esc(p.lastName)}
      ${p.city ? `<span class="search-result-info">${esc(p.city)}</span>` : ''}
    </div>`).join('');

  resultsEl.querySelectorAll('.linked-result').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById(hiddenId).value = el.dataset.id;
      document.getElementById(inputId).value = el.dataset.name;
      resultsEl.innerHTML = '';
    });
  });
}

function eventsListHtml(events) {
  if (!events.length) return '<p class="events-empty">No life events recorded yet.</p>';
  return events.map(ev => {
    const label = EVENT_TYPE_LABELS[ev.eventType] || ev.eventType;
    const date = ev.eventDate ? formatDisplayDate(ev.eventDate) : '';
    return `
      <div class="event-item">
        <span class="event-badge event-${ev.eventType}">${label}</span>
        ${date ? `<span class="event-date">${date}</span>` : ''}
        ${ev.description ? `<span class="event-desc">${esc(ev.description)}</span>` : ''}
      </div>`;
  }).join('');
}

function renderChangelogTable(changes) {
  if (!changes.length) return '<p class="events-empty">No changes recorded yet.</p>';
  return `
    <div class="changelog-table-wrap">
      <table class="changelog-table">
        <thead>
          <tr>
            <th>Date &amp; Time</th>
            <th>Changed By</th>
            <th>Person</th>
            <th>Field</th>
            <th>Old Value</th>
            <th>New Value</th>
          </tr>
        </thead>
        <tbody>
          ${changes.map(c => `
            <tr>
              <td class="cl-time">${formatTimestamp(c.timestamp)}</td>
              <td>${esc(c.changedByName)}</td>
              <td>${esc(c.targetName)}</td>
              <td class="cl-field">${esc(c.field)}</td>
              <td class="cl-old">${esc(c.oldValue)}</td>
              <td class="cl-new">${esc(c.newValue)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch { return ts; }
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return '';
  try {
    const [y, m, d] = isoDate.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
  } catch { return isoDate; }
}

// === Spouse Section (admin) ===

function renderSpouseSection(person) {
  if (person.spouseId && peopleById[person.spouseId]) {
    const spouse = peopleById[person.spouseId];
    return `
      <div class="admin-spouse-info">
        <strong>Spouse:</strong> ${esc(spouse.firstName)} ${esc(spouse.lastName || '')}
        ${spouse.deceased ? '(deceased)' : ''}
      </div>`;
  }

  // No spouse — show add form
  return `
    <div class="admin-spouse-form" id="admin-spouse-section">
      <form class="profile-form" onsubmit="return false">
        <fieldset>
          <legend>Add Spouse for ${esc(person.firstName)}</legend>
          <div class="form-row">
            <div class="form-group"><label>First Name *</label><input type="text" id="spouse-first"></div>
            <div class="form-group"><label>Last Name</label><input type="text" id="spouse-last" value="${esc(person.lastName || '')}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Birthday</label><input type="date" id="spouse-birthday"></div>
            <div class="form-group"><label>Cell</label><input type="text" id="spouse-cell"></div>
          </div>
          <div class="form-group"><label>Email</label><input type="email" id="spouse-email"></div>
          <div class="form-actions">
            <button type="button" id="spouse-submit">Add Spouse</button>
            <span class="status-msg" id="spouse-status" hidden></span>
          </div>
        </fieldset>
      </form>
    </div>`;
}

function setupSpouseForm(person) {
  const btn = document.getElementById('spouse-submit');
  if (!btn) return; // Already has a spouse, no form rendered

  btn.addEventListener('click', async () => {
    const firstName = document.getElementById('spouse-first').value.trim();
    if (!firstName) { alert('First name is required.'); return; }

    const status = document.getElementById('spouse-status');
    btn.disabled = true;
    btn.textContent = 'Adding...';
    status.hidden = true;

    try {
      const result = await addSpouse(sessionToken, {
        personId: person.personId,
        firstName,
        lastName: document.getElementById('spouse-last').value.trim(),
        birthday: document.getElementById('spouse-birthday').value,
        cell: document.getElementById('spouse-cell').value.trim(),
        email: document.getElementById('spouse-email').value.trim(),
      });

      status.textContent = result.message || 'Spouse added!';
      status.className = 'status-msg success';
      status.hidden = false;

      // Update local cache
      if (result.spousePersonId) {
        const newSpouse = {
          personId: result.spousePersonId,
          firstName,
          lastName: document.getElementById('spouse-last').value.trim() || person.lastName,
          spouseId: person.personId,
          generation: person.generation,
          branch: person.branch,
          deceased: false,
        };
        allPeople.push(newSpouse);
        peopleById[newSpouse.personId] = newSpouse;
        person.spouseId = result.spousePersonId;
        peopleById[person.personId] = person;
        selectedPerson = person;
      }

      // Re-render to show the spouse info instead of the form
      setTimeout(() => renderPersonEditor(), 1000);
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      status.className = 'status-msg error';
      status.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Add Spouse';
    }
  });
}

// === Add Person (admin) ===

function renderAdminAddForm() {
  return `
    <div class="admin-add-section">
      <form class="profile-form" onsubmit="return false">
        <fieldset>
          <legend>Add a Family Member</legend>
          <div class="form-group">
            <label>Parent (who is this person a child of?) *</label>
            <input type="text" id="aa-parent-search" placeholder="Type a name to search..." autocomplete="off">
            <input type="hidden" id="aa-parent-id" value="">
            <div id="aa-parent-results" class="person-search-results"></div>
            <div class="form-hint" id="aa-parent-display">No parent selected</div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>First Name *</label><input type="text" id="aa-first"></div>
            <div class="form-group"><label>Last Name</label><input type="text" id="aa-last"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Birthday</label><input type="date" id="aa-birthday"></div>
            <div class="form-group"><label>Cell</label><input type="text" id="aa-cell"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Email</label><input type="email" id="aa-email"></div>
            <div class="form-group"><label>Phone</label><input type="tel" id="aa-phone"></div>
          </div>
          <fieldset>
            <legend>Address</legend>
            <div class="form-group"><label>Street</label><input type="text" id="aa-address"></div>
            <div class="form-row">
              <div class="form-group"><label>City</label><input type="text" id="aa-city"></div>
              <div class="form-group form-group-sm"><label>State</label><input type="text" id="aa-state" maxlength="2"></div>
              <div class="form-group form-group-sm"><label>Zip</label><input type="text" id="aa-zip"></div>
            </div>
          </fieldset>
          <div class="form-actions">
            <button type="button" id="aa-submit">Add Family Member</button>
            <span class="status-msg" id="aa-status" hidden></span>
          </div>
        </fieldset>
      </form>
    </div>`;
}

function setupAdminAddForm(container) {
  // Parent search
  const parentSearch = container.querySelector('#aa-parent-search');
  if (!parentSearch) return;

  parentSearch.addEventListener('input', () => {
    const query = parentSearch.value.toLowerCase().trim();
    const resultsEl = document.getElementById('aa-parent-results');
    if (!query || query.length < 2) { resultsEl.innerHTML = ''; return; }
    const matches = allPeople
      .filter(p => !p.deceased && (`${p.firstName} ${p.lastName}`).toLowerCase().includes(query))
      .slice(0, 10);
    resultsEl.innerHTML = matches.map(p =>
      `<div class="person-search-item" data-pid="${p.personId}">${esc(p.firstName)} ${esc(p.lastName || '')} <span class="form-hint">${esc(p.branch || '')}</span></div>`
    ).join('');
    resultsEl.querySelectorAll('.person-search-item').forEach(item => {
      item.addEventListener('click', () => {
        const pid = Number(item.dataset.pid);
        const person = peopleById[pid];
        document.getElementById('aa-parent-id').value = pid;
        document.getElementById('aa-parent-display').textContent =
          `Parent: ${person.firstName} ${person.lastName || ''}`;
        document.getElementById('aa-last').value = person.lastName || '';
        parentSearch.value = '';
        resultsEl.innerHTML = '';
      });
    });
  });

  // Submit
  container.querySelector('#aa-submit').addEventListener('click', async () => {
    const parentId = document.getElementById('aa-parent-id').value;
    const firstName = document.getElementById('aa-first').value.trim();
    if (!parentId) { alert('Please select a parent first.'); return; }
    if (!firstName) { alert('First name is required.'); return; }

    const btn = document.getElementById('aa-submit');
    const status = document.getElementById('aa-status');
    btn.disabled = true;
    btn.textContent = 'Adding...';
    status.hidden = true;

    try {
      const result = await addPerson(sessionToken, {
        parentId,
        firstName,
        lastName: document.getElementById('aa-last').value.trim(),
        birthday: document.getElementById('aa-birthday').value,
        cell: document.getElementById('aa-cell').value.trim(),
        email: document.getElementById('aa-email').value.trim(),
        phone: document.getElementById('aa-phone').value.trim(),
        address: document.getElementById('aa-address').value.trim(),
        city: document.getElementById('aa-city').value.trim(),
        state: document.getElementById('aa-state').value.trim(),
        zip: document.getElementById('aa-zip').value.trim(),
      });

      status.textContent = result.message || 'Added!';
      status.className = 'status-msg success';
      status.hidden = false;

      // Clear the form
      ['aa-first','aa-last','aa-birthday','aa-cell','aa-email','aa-phone',
       'aa-address','aa-city','aa-state','aa-zip'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('aa-parent-id').value = '';
      document.getElementById('aa-parent-display').textContent = 'No parent selected';

      // Add to local cache
      if (result.personId) {
        const parent = peopleById[parentId];
        const newPerson = {
          personId: result.personId,
          firstName, lastName: document.getElementById('aa-last').value || parent?.lastName || '',
          parentId: Number(parentId),
          generation: (parent?.generation || 0) + 1,
          branch: parent?.branch || '',
          deceased: false,
        };
        allPeople.push(newPerson);
        peopleById[newPerson.personId] = newPerson;
      }

      setTimeout(() => { status.hidden = true; }, 4000);
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      status.className = 'status-msg error';
      status.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add Family Member';
    }
  });
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
