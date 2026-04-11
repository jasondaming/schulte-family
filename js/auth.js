import { authenticate, isConfigured, setApiUrl } from './api.js';

const SESSION_KEY = 'schulte_session';

/**
 * Get the current session (token + user info) or null.
 */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Sessions expire after 4 hours
    if (Date.now() - session.timestamp > 4 * 60 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Save a session after successful login.
 */
function saveSession(data) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    token: data.token,
    personId: data.personId,
    sheetRow: data.sheetRow,
    firstName: data.firstName,
    lastName: data.lastName,
    timestamp: Date.now(),
  }));
}

/**
 * Clear the session (logout).
 */
export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Initialize the login form handlers.
 */
export function initLogin(onSuccess) {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  // If API isn't configured, show a setup prompt
  if (!isConfigured()) {
    errorEl.textContent = 'First-time setup: Enter the Google Apps Script URL in the browser console: setApiUrl("https://script.google.com/...")';
    errorEl.hidden = false;
    // Expose globally for setup
    window.setApiUrl = setApiUrl;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    const firstName = document.getElementById('login-first').value.trim();
    const birthday = document.getElementById('login-birth').value; // YYYY-MM-DD

    try {
      const result = await authenticate(firstName, birthday);
      if (result.success) {
        saveSession(result);
        onSuccess(result);
      } else {
        errorEl.textContent = 'Name and birthday not found. Make sure your info is in the family database.';
        errorEl.hidden = false;
      }
    } catch (err) {
      errorEl.textContent = `Connection error: ${err.message}`;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}
