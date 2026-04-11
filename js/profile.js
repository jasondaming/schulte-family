/**
 * Profile view — edit contact info and manage life events for yourself,
 * your spouse, and your dependent children.
 */

import { updateProfile, fetchEvents, addEvent, addPerson, removePerson, detachSpouse } from './api.js';

let allPeople = [];
let peopleById = {};
let sessionToken = null;
let myPerson = null;
let eventsByPersonId = {};

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

export async function initProfile(people, session) {
  allPeople = people;
  peopleById = {};
  for (const p of people) peopleById[p.personId] = p;
  sessionToken = session.token;

  myPerson = people.find(p => String(p.personId) === String(session.personId));
  if (!myPerson) {
    document.getElementById('profile-view').innerHTML =
      '<p class="loading">Could not find your record. Contact the database admin.</p>';
    return;
  }

  // Load life events for the family
  try {
    const result = await fetchEvents(sessionToken);
    eventsByPersonId = {};
    for (const ev of (result.events || [])) {
      const pid = String(ev.personId);
      if (!eventsByPersonId[pid]) eventsByPersonId[pid] = [];
      eventsByPersonId[pid].push(ev);
    }
  } catch (e) {
    eventsByPersonId = {};
  }

  renderProfileView();
}

export function updateProfileData(people, session) {
  allPeople = people;
  peopleById = {};
  for (const p of people) peopleById[p.personId] = p;
  myPerson = people.find(p => String(p.personId) === String(session.personId));
  if (myPerson) renderProfileView();
}

function renderProfileView() {
  const container = document.getElementById('profile-view');
  const spouse = myPerson.spouseId ? peopleById[myPerson.spouseId] : null;

  // Dependent children: no own household yet
  const children = allPeople.filter(p => {
    if (p.deceased) return false;
    return String(p.parentId) === String(myPerson.personId) ||
           (spouse && String(p.parentId) === String(spouse.personId));
  }).filter(p => !p.spouseId && !p.address);

  let html = '<div class="view-header"><h2>My Information</h2></div>';
  html += personSection(myPerson, 'self');
  if (spouse) html += personSection(spouse, 'spouse');
  for (const child of children) html += personSection(child, `child-${child.personId}`);
  html += addChildFormHtml(myPerson);

  container.innerHTML = html;

  // Attach contact form submit handlers
  container.querySelectorAll('.profile-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prefix = form.dataset.prefix;
      const personId = Number(form.dataset.personId);
      await saveContact(prefix, personId, form);
    });
  });

  // Attach event form handlers
  container.querySelectorAll('.event-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const personId = Number(btn.dataset.personId);
      const prefix = btn.dataset.prefix;
      toggleEventForm(personId, prefix, btn);
    });
  });

  container.querySelectorAll('.event-submit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const personId = Number(btn.dataset.personId);
      const prefix = btn.dataset.prefix;
      await submitEvent(personId, prefix);
    });
  });

  // Person-search for linked person field
  container.querySelectorAll('.linked-person-search').forEach(input => {
    const prefix = input.dataset.prefix;
    const resultsEl = document.getElementById(`${prefix}-linked-results`);
    input.addEventListener('input', () => {
      showPersonSearch(input.value, prefix, resultsEl);
    });
  });

  // Detach spouse (death / divorce)
  container.querySelectorAll('.detach-spouse-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const personId = Number(btn.dataset.personId);
      const name = btn.dataset.name;
      const reason = btn.dataset.reason;

      let deathDate = '';
      if (reason === 'death') {
        deathDate = prompt(`When did ${name} pass away? (YYYY-MM-DD)`, new Date().toISOString().split('T')[0]);
        if (deathDate === null) return; // cancelled
        if (!confirm(`Record ${name}'s death? This will mark them as deceased and remove them from the active directory if they have no children listed.`)) return;
      } else {
        if (!confirm(`Record divorce from ${name}? This will unlink them and remove them from the active directory if they have no children listed.`)) return;
      }

      btn.disabled = true;
      btn.textContent = 'Processing...';
      try {
        const result = await detachSpouse(sessionToken, reason, personId, deathDate);
        alert(result.message);
        // Reload
        const { fetchFamilies } = await import('./api.js');
        const freshData = await fetchFamilies(sessionToken);
        allPeople = freshData.people || [];
        peopleById = {};
        for (const p of allPeople) peopleById[p.personId] = p;
        renderProfileView();
      } catch (err) {
        alert('Error: ' + err.message);
        btn.disabled = false;
        btn.textContent = reason === 'death' ? 'Record Death' : 'Record Divorce';
      }
    });
  });

  // Add Child form
  const addChildBtn = container.querySelector('#add-child-submit');
  if (addChildBtn) {
    addChildBtn.addEventListener('click', handleAddChild);
  }

  // Remove child buttons
  container.querySelectorAll('.remove-child-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const personId = Number(btn.dataset.personId);
      const name = btn.dataset.name;
      if (!confirm(`Remove ${name} from the family directory?`)) return;
      btn.disabled = true;
      btn.textContent = 'Removing...';
      try {
        await removePerson(sessionToken, personId);
        // Reload
        const { fetchFamilies } = await import('./api.js');
        const result = await fetchFamilies(sessionToken);
        allPeople = result.people || [];
        peopleById = {};
        for (const p of allPeople) peopleById[p.personId] = p;
        renderProfileView();
      } catch (err) {
        alert('Error: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Remove';
      }
    });
  });
}

function personSection(person, prefix) {
  const events = eventsByPersonId[String(person.personId)] || [];
  const isSpouse = prefix === 'spouse';
  const isSelf = prefix === 'self';
  const isChild = prefix.startsWith('child-');
  const sectionLabel = isSelf ? 'My Contact Info' : isSpouse
    ? `${esc(person.firstName)}'s Contact Info`
    : `${esc(person.firstName)}'s Info`;
  const removeBtn = isChild
    ? ` <button class="remove-child-btn btn-danger-sm" data-person-id="${person.personId}" data-name="${esc(person.firstName)} ${esc(person.lastName || '')}">Remove</button>`
    : '';
  const spouseActions = isSpouse
    ? `<div class="spouse-actions">
        <button class="btn-danger-sm detach-spouse-btn" data-person-id="${person.personId}" data-name="${esc(person.firstName)}" data-reason="death">Record Death</button>
        <button class="btn-danger-sm detach-spouse-btn" data-person-id="${person.personId}" data-name="${esc(person.firstName)}" data-reason="divorce">Record Divorce</button>
       </div>`
    : '';

  return `
    <div class="profile-section">
      <form class="profile-form" data-prefix="${prefix}" data-person-id="${person.personId}">
        <fieldset>
          <legend>${sectionLabel}${removeBtn}</legend>
          <div class="form-row">
            <div class="form-group">
              <label>Name</label>
              <input type="text" value="${esc(person.firstName)} ${esc(person.lastName || '')}" readonly class="readonly">
            </div>
          </div>
          <div class="form-group">
            <label>Street Address</label>
            <input type="text" id="${prefix}-address" value="${esc(person.address)}">
          </div>
          <div class="form-row">
            <div class="form-group"><label>City</label><input type="text" id="${prefix}-city" value="${esc(person.city)}"></div>
            <div class="form-group form-group-sm"><label>State</label><input type="text" id="${prefix}-state" value="${esc(person.state)}" maxlength="2"></div>
            <div class="form-group form-group-sm"><label>Zip</label><input type="text" id="${prefix}-zip" value="${esc(person.zip)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Phone</label><input type="tel" id="${prefix}-phone" value="${esc(person.phone)}"></div>
            <div class="form-group"><label>Cell</label><input type="text" id="${prefix}-cell" value="${esc(person.cell)}"></div>
          </div>
          <div class="form-group"><label>Email</label><input type="email" id="${prefix}-email" value="${esc(person.email)}"></div>
          <div class="form-actions">
            <button type="submit">Save ${esc(person.firstName)}'s Info</button>
            <span class="status-msg" id="${prefix}-status" hidden></span>
          </div>
        </fieldset>
      </form>
      ${spouseActions}

      <div class="life-events-block">
        <div class="life-events-header">
          <h4>Life Events — ${esc(person.firstName)}</h4>
          <button class="event-add-btn btn-secondary" data-person-id="${person.personId}" data-prefix="${prefix}">+ Add Event</button>
        </div>
        <div id="${prefix}-event-form" class="event-form" hidden>
          ${eventFormHtml(prefix, person.personId)}
        </div>
        <div id="${prefix}-events-list" class="events-list">
          ${eventsListHtml(events)}
        </div>
      </div>
    </div>`;
}

function eventFormHtml(prefix, personId) {
  const typeOptions = Object.entries(EVENT_TYPE_LABELS)
    .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  return `
    <div class="event-form-fields">
      <div class="form-row">
        <div class="form-group">
          <label>Event Type</label>
          <select id="${prefix}-event-type">${typeOptions}</select>
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="${prefix}-event-date">
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <input type="text" id="${prefix}-event-desc" placeholder="Brief description of this event...">
      </div>
      <div class="form-group">
        <label>Linked Person <span class="form-hint">(optional — for marriages, births, etc.)</span></label>
        <input type="text" id="${prefix}-linked-input" class="linked-person-search" data-prefix="${prefix}" placeholder="Type a name to search...">
        <input type="hidden" id="${prefix}-linked-id">
        <div id="${prefix}-linked-results" class="linked-results"></div>
      </div>
      <div class="form-actions">
        <button type="button" class="event-submit-btn" data-person-id="${personId}" data-prefix="${prefix}">Save Event</button>
        <span class="status-msg" id="${prefix}-event-status" hidden></span>
      </div>
    </div>`;
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

function toggleEventForm(personId, prefix, btn) {
  const form = document.getElementById(`${prefix}-event-form`);
  const isHidden = form.hidden;
  form.hidden = !isHidden;
  btn.textContent = isHidden ? '— Cancel' : '+ Add Event';
}

async function submitEvent(personId, prefix) {
  const btn = document.querySelector(`.event-submit-btn[data-prefix="${prefix}"]`);
  const status = document.getElementById(`${prefix}-event-status`);
  const eventType = document.getElementById(`${prefix}-event-type`).value;
  const eventDate = document.getElementById(`${prefix}-event-date`).value;
  const description = document.getElementById(`${prefix}-event-desc`).value.trim();
  const linkedPersonId = document.getElementById(`${prefix}-linked-id`).value || null;

  if (!eventType) return;

  btn.disabled = true;
  btn.textContent = 'Saving...';
  status.hidden = true;

  try {
    const result = await addEvent(sessionToken, {
      personId,
      eventType,
      eventDate: eventDate || null,
      description: description || null,
      linkedPersonId: linkedPersonId || null,
    });

    // Add to local cache and re-render the list
    const newEvent = {
      eventId: result.eventId,
      personId,
      eventType,
      eventDate: eventDate || '',
      description: description || '',
      linkedPersonId,
      recordedAt: new Date().toISOString(),
    };
    const pid = String(personId);
    if (!eventsByPersonId[pid]) eventsByPersonId[pid] = [];
    eventsByPersonId[pid].unshift(newEvent);

    // Re-render just this person's events list
    const listEl = document.getElementById(`${prefix}-events-list`);
    if (listEl) listEl.innerHTML = eventsListHtml(eventsByPersonId[pid]);

    // Reset form
    document.getElementById(`${prefix}-event-date`).value = '';
    document.getElementById(`${prefix}-event-desc`).value = '';
    document.getElementById(`${prefix}-linked-id`).value = '';
    document.getElementById(`${prefix}-linked-input`).value = '';

    status.textContent = 'Event saved!';
    status.className = 'status-msg success';
    status.hidden = false;
    setTimeout(() => { status.hidden = true; }, 3000);

    // Close the form
    const form = document.getElementById(`${prefix}-event-form`);
    if (form) form.hidden = true;
    const addBtn = document.querySelector(`.event-add-btn[data-prefix="${prefix}"]`);
    if (addBtn) addBtn.textContent = '+ Add Event';
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    status.className = 'status-msg error';
    status.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Event';
  }
}

async function saveContact(prefix, personId, form) {
  const btn = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.status-msg');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  status.hidden = true;

  // Scope reads to the specific form to prevent cross-form data leakage
  const get = id => { const el = form.querySelector('#' + id); return el ? el.value : ''; };

  const fields = {
    personId,
    address: get(`${prefix}-address`),
    city:    get(`${prefix}-city`),
    state:   get(`${prefix}-state`),
    zip:     get(`${prefix}-zip`),
    phone:   get(`${prefix}-phone`),
    cell:    get(`${prefix}-cell`),
    email:   get(`${prefix}-email`),
  };

  try {
    await updateProfile(sessionToken, fields);
    status.textContent = 'Saved!';
    status.className = 'status-msg success';
    status.hidden = false;

    // Update local cache
    const person = peopleById[personId];
    if (person) Object.assign(person, fields);

    setTimeout(() => { status.hidden = true; }, 3000);
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    status.className = 'status-msg error';
    status.hidden = false;
  } finally {
    btn.disabled = false;
    const person = peopleById[personId];
    btn.textContent = person ? `Save ${person.firstName}'s Info` : 'Save Changes';
  }
}

function showPersonSearch(query, prefix, resultsEl) {
  const q = (query || '').toLowerCase().trim();
  if (!q) { resultsEl.innerHTML = ''; return; }

  const matches = allPeople.filter(p => {
    const name = `${p.firstName} ${p.lastName}`.toLowerCase();
    return name.includes(q) && !p.deceased;
  }).slice(0, 8);

  if (!matches.length) {
    resultsEl.innerHTML = '<p class="search-empty">No matches.</p>';
    return;
  }

  resultsEl.innerHTML = matches.map(p => `
    <div class="linked-result" data-person-id="${p.personId}" data-name="${esc(p.firstName)} ${esc(p.lastName)}">
      ${esc(p.firstName)} ${esc(p.lastName)}
      ${p.city ? `<span class="search-result-info">${esc(p.city)}, ${esc(p.state)}</span>` : ''}
    </div>`).join('');

  resultsEl.querySelectorAll('.linked-result').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById(`${prefix}-linked-id`).value = el.dataset.personId;
      document.getElementById(`${prefix}-linked-input`).value = el.dataset.name;
      resultsEl.innerHTML = '';
    });
  });
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return '';
  try {
    const [y, m, d] = isoDate.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
  } catch { return isoDate; }
}

function addChildFormHtml(parent) {
  return `
    <div class="profile-section">
      <fieldset>
        <legend>Add a Family Member</legend>
        <div class="form-row">
          <div class="form-group"><label>First Name *</label><input type="text" id="new-child-first" required></div>
          <div class="form-group"><label>Last Name</label><input type="text" id="new-child-last" value="${esc(parent.lastName || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Birthday</label><input type="date" id="new-child-birthday"></div>
          <div class="form-group"><label>Cell</label><input type="text" id="new-child-cell"></div>
        </div>
        <div class="form-group"><label>Email</label><input type="email" id="new-child-email"></div>
        <div class="form-actions">
          <button type="button" id="add-child-submit">Add Family Member</button>
          <span class="status-msg" id="add-child-status" hidden></span>
        </div>
      </fieldset>
    </div>`;
}

async function handleAddChild() {
  const btn = document.getElementById('add-child-submit');
  const status = document.getElementById('add-child-status');
  const firstName = document.getElementById('new-child-first').value.trim();
  if (!firstName) { alert('First name is required.'); return; }

  btn.disabled = true;
  btn.textContent = 'Adding...';
  status.hidden = true;

  try {
    const result = await addPerson(sessionToken, {
      firstName,
      lastName: document.getElementById('new-child-last').value.trim(),
      birthday: document.getElementById('new-child-birthday').value,
      cell: document.getElementById('new-child-cell').value.trim(),
      email: document.getElementById('new-child-email').value.trim(),
    });

    status.textContent = result.message || 'Added!';
    status.className = 'status-msg success';
    status.hidden = false;

    // Reload data to show the new person
    const { fetchFamilies } = await import('./api.js');
    const freshData = await fetchFamilies(sessionToken);
    allPeople = freshData.people || [];
    peopleById = {};
    for (const p of allPeople) peopleById[p.personId] = p;
    renderProfileView();
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    status.className = 'status-msg error';
    status.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Add Family Member';
  }
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
