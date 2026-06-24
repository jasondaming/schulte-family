import { authenticate, isConfigured, setApiUrl } from './api.js';

const SESSION_KEY = 'schulte_session';
const REMEMBERED_LOGIN_KEY = 'schulte_remembered_login';

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
    isAdmin: !!data.isAdmin,
    timestamp: Date.now(),
  }));
}

function loadRememberedLogin() {
  try {
    const raw = localStorage.getItem(REMEMBERED_LOGIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveRememberedLogin(firstName, birthday) {
  try {
    localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify({
      firstName,
      birthday,
      savedAt: Date.now(),
    }));
  } catch {
    // Best-effort convenience only; login should still work if storage is blocked.
  }
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
  const firstInput = document.getElementById('login-first');
  const birthInput = document.getElementById('login-birth');
  const birthNativeInput = document.getElementById('login-birth-native');

  const remembered = loadRememberedLogin();
  if (remembered) {
    if (remembered.firstName && !firstInput.value) firstInput.value = remembered.firstName;
    if (remembered.birthday && !birthInput.value) {
      birthInput.value = formatBirthdayForInput(remembered.birthday);
      if (birthNativeInput) birthNativeInput.value = remembered.birthday;
    }
  }

  birthInput.addEventListener('blur', () => {
    const normalized = normalizeBirthdayInput(birthInput.value);
    if (normalized) {
      birthInput.value = formatBirthdayForInput(normalized);
      if (birthNativeInput) birthNativeInput.value = normalized;
    }
  });

  birthInput.addEventListener('input', () => {
    const normalized = normalizeBirthdayInput(birthInput.value);
    if (birthNativeInput && normalized) birthNativeInput.value = normalized;
  });

  if (birthNativeInput) {
    const syncTextToNative = () => {
      const normalized = normalizeBirthdayInput(birthInput.value);
      if (normalized) birthNativeInput.value = normalized;
    };
    const syncNativeToText = () => {
      if (birthNativeInput.value) birthInput.value = formatBirthdayForInput(birthNativeInput.value);
    };

    birthNativeInput.addEventListener('focus', syncTextToNative);
    birthNativeInput.addEventListener('pointerdown', syncTextToNative);
    birthNativeInput.addEventListener('touchstart', syncTextToNative, { passive: true });
    birthNativeInput.addEventListener('input', syncNativeToText);
    birthNativeInput.addEventListener('change', syncNativeToText);
  }

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

    const firstName = firstInput.value.trim();
    const birthday = normalizeBirthdayInput(birthInput.value);

    if (!birthday) {
      errorEl.textContent = 'Enter birthday as MM/DD/YYYY.';
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }

    try {
      const result = await authenticate(firstName, birthday);
      if (result.success) {
        saveSession(result);
        saveRememberedLogin(firstName, birthday);
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

function normalizeBirthdayInput(value) {
  const raw = (value || '').trim();
  if (!raw) return '';

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slashDate = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (slashDate) {
    const year = normalizeYear(slashDate[3]);
    return validIsoDate(year, Number(slashDate[1]), Number(slashDate[2]));
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length === 8 || digits.length === 6) {
    const month = Number(digits.slice(0, 2));
    const day = Number(digits.slice(2, 4));
    const year = normalizeYear(digits.slice(4));
    return validIsoDate(year, month, day);
  }

  return '';
}

function normalizeYear(yearText) {
  if (yearText.length === 4) return Number(yearText);
  const yy = Number(yearText);
  const currentYY = new Date().getFullYear() % 100;
  return yy <= currentYY ? 2000 + yy : 1900 + yy;
}

function validIsoDate(year, month, day) {
  if (!year || !month || !day) return '';
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return '';
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function formatBirthdayForInput(isoDate) {
  const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate || '';
  return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}
