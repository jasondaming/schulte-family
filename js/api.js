/**
 * API client for the Google Apps Script backend.
 *
 * SETUP: After deploying the Apps Script web app, paste the URL below.
 */
const SCRIPT_URL = localStorage.getItem('schulte_api_url') || 'https://script.google.com/macros/s/AKfycbyeloU6Q5HuIH-pQlV2HBZwm-6YE-8ut9m7rR1TJaRmkwyJHYq2U97AoPWfQCJFjcqs2A/exec';

/**
 * Call the Apps Script backend.
 * @param {string} action - The action to perform
 * @param {object} params - Additional parameters
 * @returns {Promise<object>} Response data
 */
export async function apiCall(action, params = {}) {
  if (!SCRIPT_URL) {
    throw new Error('API URL not configured. See setup instructions.');
  }

  const url = new URL(SCRIPT_URL);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, v);
    }
  }

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();

  if (data.error) throw new Error(data.error);
  return data;
}

/**
 * Authenticate with first name + birthday.
 * @returns {Promise<{success: boolean, token: string, rowIndex: number}>}
 */
export async function authenticate(firstName, birthday) {
  return apiCall('auth', { name: firstName, birthday });
}

/**
 * Fetch all family data (requires valid token).
 * @returns {Promise<{families: Array}>}
 */
export async function fetchFamilies(token) {
  return apiCall('getData', { token });
}

/**
 * Update the logged-in user's row.
 * @param {string} token
 * @param {object} fields - { address, city, state, zip, homePhone, cell, email }
 * @returns {Promise<{success: boolean}>}
 */
export async function updateProfile(token, fields) {
  // POST for writes
  if (!SCRIPT_URL) throw new Error('API URL not configured.');

  const resp = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script quirk
    body: JSON.stringify({ action: 'update', token, ...fields }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/**
 * Check if the API is configured.
 */
export function isConfigured() {
  return !!SCRIPT_URL;
}

/**
 * Set the API URL (for first-time setup).
 */
export function setApiUrl(url) {
  localStorage.setItem('schulte_api_url', url);
  window.location.reload();
}
