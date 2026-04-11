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

/** Check if the API is configured. */
export function isConfigured() {
  return !!SCRIPT_URL;
}

/** Set the API URL (for first-time setup). */
export function setApiUrl(url) {
  localStorage.setItem('schulte_api_url', url);
  window.location.reload();
}
