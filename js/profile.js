/**
 * Profile edit view — edit yourself, your spouse, and your children.
 */

import { updateProfile } from './api.js';

let allPeople = [];
let peopleById = {};
let sessionToken = null;
let myPerson = null;

export function initProfile(people, session) {
  allPeople = people;
  peopleById = {};
  for (const p of people) peopleById[p.personId] = p;
  sessionToken = session.token;

  myPerson = people.find(p => p.personId == session.personId);
  if (!myPerson) {
    document.getElementById('profile-form').innerHTML =
      '<p class="loading">Could not find your record. Contact the database admin.</p>';
    return;
  }

  renderProfileView();
}

export function updateProfileData(people, session) {
  allPeople = people;
  peopleById = {};
  for (const p of people) peopleById[p.personId] = p;
  myPerson = people.find(p => p.personId == session.personId);
  if (myPerson) renderProfileView();
}

function renderProfileView() {
  const container = document.getElementById('profile-view');
  const spouse = myPerson.spouseId ? peopleById[myPerson.spouseId] : null;

  // Find children: people whose parentId is me or my spouse
  const children = allPeople.filter(p => {
    if (p.deceased) return false;
    return p.parentId == myPerson.personId || (spouse && p.parentId == spouse.personId);
  }).filter(p => !p.spouseId && !p.address); // Only dependents (no own household)

  let html = '<div class="view-header"><h2>My Information</h2></div>';

  // My info
  html += personForm(myPerson, 'self', 'My Contact Info');

  // Spouse info
  if (spouse) {
    html += personForm(spouse, 'spouse', `${spouse.firstName}'s Contact Info`);
  }

  // Children
  for (const child of children) {
    html += personForm(child, `child-${child.personId}`, `${child.firstName}'s Info`);
  }

  container.innerHTML = html;

  // Attach submit handlers
  container.querySelectorAll('.profile-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prefix = form.dataset.prefix;
      const personId = Number(form.dataset.personId);
      await saveChanges(prefix, personId, form);
    });
  });
}

function personForm(person, prefix, title) {
  const readonly = prefix === 'self' || prefix === 'spouse' ? '' : '';
  return `
    <form class="profile-form" data-prefix="${prefix}" data-person-id="${person.personId}">
      <fieldset>
        <legend>${title}</legend>
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
          <button type="submit">Save Changes</button>
          <span class="status-msg" id="${prefix}-status" hidden></span>
        </div>
      </fieldset>
    </form>`;
}

async function saveChanges(prefix, personId, form) {
  const btn = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.status-msg');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  status.hidden = true;

  const fields = {
    personId,
    address: document.getElementById(`${prefix}-address`).value,
    city: document.getElementById(`${prefix}-city`).value,
    state: document.getElementById(`${prefix}-state`).value,
    zip: document.getElementById(`${prefix}-zip`).value,
    phone: document.getElementById(`${prefix}-phone`).value,
    cell: document.getElementById(`${prefix}-cell`).value,
    email: document.getElementById(`${prefix}-email`).value,
  };

  try {
    await updateProfile(sessionToken, fields);
    status.textContent = 'Saved!';
    status.className = 'status-msg success';
    status.hidden = false;

    // Update local data
    const person = peopleById[personId];
    if (person) Object.assign(person, fields);

    setTimeout(() => { status.hidden = true; }, 3000);
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    status.className = 'status-msg error';
    status.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
