/**
 * Profile edit view — lets the logged-in person update their own contact info.
 */

import { updateProfile } from './api.js';

let currentPerson = null;
let sessionToken = null;

export function initProfile(people, session) {
  sessionToken = session.token;

  // Find the logged-in person by matching personId from session
  currentPerson = people.find(p => p.personId == session.personId);
  if (!currentPerson) {
    // Fallback: match by sheetRow
    currentPerson = people.find(p => p.sheetRow === session.sheetRow);
  }

  if (!currentPerson) {
    document.getElementById('profile-form').innerHTML =
      '<p class="loading">Could not find your record. Contact the database admin.</p>';
    return;
  }

  populateForm(currentPerson);
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveChanges();
  });
}

export function updateProfileData(people, session) {
  currentPerson = people.find(p => p.personId == session.personId);
  if (currentPerson) populateForm(currentPerson);
}

function populateForm(p) {
  document.getElementById('prof-names').value = p.firstName || '';
  document.getElementById('prof-last').value = p.lastName || '';
  document.getElementById('prof-address').value = p.address || '';
  document.getElementById('prof-city').value = p.city || '';
  document.getElementById('prof-state').value = p.state || '';
  document.getElementById('prof-zip').value = p.zip || '';
  document.getElementById('prof-home-phone').value = p.phone || '';
  document.getElementById('prof-cell').value = p.cell || '';
  document.getElementById('prof-email').value = p.email || '';
}

async function saveChanges() {
  const btn = document.getElementById('prof-save-btn');
  const status = document.getElementById('prof-status');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  status.hidden = true;

  const fields = {
    address: document.getElementById('prof-address').value,
    city: document.getElementById('prof-city').value,
    state: document.getElementById('prof-state').value,
    zip: document.getElementById('prof-zip').value,
    phone: document.getElementById('prof-home-phone').value,
    cell: document.getElementById('prof-cell').value,
    email: document.getElementById('prof-email').value,
  };

  try {
    await updateProfile(sessionToken, fields);
    status.textContent = 'Changes saved!';
    status.className = 'status-msg success';
    status.hidden = false;
    if (currentPerson) Object.assign(currentPerson, fields);
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
