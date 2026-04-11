/**
 * API client for the Google Apps Script backend.
 *
 * SETUP: After deploying the Apps Script web app, paste the URL below.
 */
const SCRIPT_URL = localStorage.getItem('schulte_api_url') || 'https://script.google.com/macros/s/AKfycbyeloU6Q5HuIH-pQlV2HBZwm-6YE-8ut9m7rR1TJaRmkwyJHYq2U97AoPWfQCJFjcqs2A/exec';

async function apiCall(action, params = {}) {
  if (!SCRIPT_URL) throw new Error('API URL not configured. See setup instructions.');

  const url = new URL(SCRIPT_URL);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function apiPost(body) {
  if (!SCRIPT_URL) throw new Error('API URL not configured.');
  const resp = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script quirk
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/** Authenticate with first name + birthday. */
export async function authenticate(firstName, birthday) {
  return apiCall('auth', { name: firstName, birthday });
}

/** Fetch all family data (requires valid token). */
export async function fetchFamilies(token) {
  return apiCall('getData', { token });
}

/**
 * Update a person's info.
 * Regular users: contact fields only, for self/spouse/children.
 * Admins: contact + identity fields for anyone.
 */
export async function updateProfile(token, fields) {
  return apiPost({ action: 'update', token, ...fields });
}

/**
 * Add a new person (child) to the directory.
 */
export async function addPerson(token, personData) {
  return apiPost({ action: 'addPerson', token, ...personData });
}

/**
 * Remove a person from the directory.
 */
export async function removePerson(token, personId) {
  return apiPost({ action: 'removePerson', token, personId });
}

/**
 * Detach a spouse (death or divorce). Clears SpouseID, may remove married-in spouse.
 * @param {string} reason - 'death' or 'divorce'
 * @param {number} spousePersonId - the person being detached
 * @param {string} deathDate - optional, YYYY-MM-DD (for death)
 */
export async function detachSpouse(token, reason, spousePersonId, deathDate = '') {
  return apiPost({ action: 'detachSpouse', token, reason, spousePersonId, deathDate });
}

/**
 * Fetch life events.
 * @param {string} token
 * @param {number|null} personId - if null, returns all family events
 */
export async function fetchEvents(token, personId = null) {
  const params = { token };
  if (personId !== null) params.personId = personId;
  return apiCall('getEvents', params);
}

/**
 * Add a life event for a person.
 * @param {string} token
 * @param {object} eventData - { personId, eventType, eventDate, description, linkedPersonId? }
 */
export async function addEvent(token, eventData) {
  return apiPost({ action: 'addEvent', token, ...eventData });
}

/**
 * Fetch the changelog.
 * Admins: all changes. Regular users: changes to their family only.
 */
export async function fetchChangelog(token) {
  return apiCall('getChangelog', { token });
}

// === Reunion ===

/** Fetch all reunion content + food signups. */
export async function fetchReunion(token) {
  return apiCall('getReunion', { token });
}

/** Sign up to bring a dish. */
export async function signupFood(token, dish, category, notes) {
  return apiPost({ action: 'signupFood', token, dish, category, notes });
}

/** Remove a food signup (own or admin). */
export async function removeSignup(token, signupId) {
  return apiPost({ action: 'removeSignup', token, signupId });
}

/** Admin: add or edit a reunion content item (schedule, info, bring list). */
export async function upsertReunionItem(token, item) {
  return apiPost({ action: 'upsertReunionItem', token, ...item });
}

/** Admin: delete a reunion content item. */
export async function deleteReunionItem(token, id) {
  return apiPost({ action: 'deleteReunionItem', token, id });
}

/** Check if the API is configured. */
export function isConfigured() {
  return !!SCRIPT_URL;
}

/** Set the API URL (for first-time setup). */
export function setApiUrl(url) {
  localStorage.setItem('schulte_api_url', url);
  window.location.reload();
}
