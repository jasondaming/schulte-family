/**
 * Main application — routing, initialization, glue code.
 */

import { fetchFamilies, isConfigured } from './api.js';
import { initLogin, getSession, logout } from './auth.js';
import { initDirectory, updateDirectory } from './directory.js';
import { initTree, updateTree } from './tree.js';
import { initProfile, updateProfileData } from './profile.js';

let people = [];
let session = null;

// === Boot ===

document.addEventListener('DOMContentLoaded', () => {
  session = getSession();
  if (session) {
    showApp();
  } else {
    showLogin();
  }
});

// === Login ===

function showLogin() {
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('main-screen').classList.remove('active');

  initLogin(() => {
    session = getSession();
    showApp();
  });
}

// === Main App ===

async function showApp() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('main-screen').classList.add('active');

  setupNav();

  document.getElementById('logout-btn').addEventListener('click', () => {
    logout();
    window.location.reload();
  });

  await loadData();
}

async function loadData() {
  // Show loading spinner in the active view
  const activeView = document.querySelector('.view.active');
  if (activeView) {
    activeView.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading family data...</p></div>';
  }

  try {
    if (!isConfigured()) {
      showSetupInstructions();
      return;
    }

    const result = await fetchFamilies(session.token);
    people = result.people || [];

    restoreViews();
    initDirectory(people);
    initTree(people);
    initProfile(people, session);
  } catch (err) {
    console.error('Failed to load data:', err);
    const view = document.querySelector('.view.active');
    if (view) {
      view.innerHTML = `<div class="loading"><p>Failed to load data: ${err.message}</p></div>`;
    }
  }
}

function restoreViews() {
  const dirView = document.getElementById('directory-view');
  if (dirView && !dirView.querySelector('.view-header')) {
    dirView.innerHTML = `
      <div class="view-header">
        <h2>Family Directory</h2>
        <input type="text" id="search-input" placeholder="Search by name, city, state...">
      </div>
      <div class="directory-filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="branch">By Branch</button>
        <button class="filter-btn" data-filter="upcoming">Upcoming Birthdays</button>
      </div>
      <div id="directory-list" class="card-grid"></div>`;
  }

  const treeView = document.getElementById('tree-view');
  if (treeView && !treeView.querySelector('.view-header')) {
    treeView.innerHTML = `
      <div class="view-header">
        <h2>Family Tree</h2>
        <div class="tree-controls">
          <button id="tree-zoom-in" title="Expand all">Expand All</button>
          <button id="tree-zoom-reset" title="Reset">Reset</button>
          <button id="tree-zoom-out" title="Collapse all">Collapse</button>
        </div>
      </div>
      <div id="tree-container"></div>`;
  }

  const profView = document.getElementById('profile-view');
  if (profView && !profView.querySelector('.view-header')) {
    profView.innerHTML = `
      <div class="view-header"><h2>My Information</h2></div>
      <form id="profile-form" class="profile-form">
        <div class="form-row">
          <div class="form-group"><label>First Name</label><input type="text" id="prof-names" readonly class="readonly"></div>
          <div class="form-group"><label>Last Name</label><input type="text" id="prof-last" readonly class="readonly"></div>
        </div>
        <fieldset><legend>Address</legend>
          <div class="form-group"><label>Street Address</label><input type="text" id="prof-address"></div>
          <div class="form-row">
            <div class="form-group"><label>City</label><input type="text" id="prof-city"></div>
            <div class="form-group form-group-sm"><label>State</label><input type="text" id="prof-state" maxlength="2"></div>
            <div class="form-group form-group-sm"><label>Zip</label><input type="text" id="prof-zip"></div>
          </div>
        </fieldset>
        <fieldset><legend>Contact</legend>
          <div class="form-row">
            <div class="form-group"><label>Home Phone</label><input type="tel" id="prof-home-phone"></div>
            <div class="form-group"><label>Cell Phone</label><input type="text" id="prof-cell"></div>
          </div>
          <div class="form-group"><label>Email</label><input type="email" id="prof-email"></div>
        </fieldset>
        <div class="form-actions">
          <button type="submit" id="prof-save-btn">Save Changes</button>
          <span id="prof-status" class="status-msg" hidden></span>
        </div>
      </form>`;
  }
}

function showSetupInstructions() {
  const view = document.querySelector('.view.active');
  if (!view) return;
  view.innerHTML = `
    <div class="loading" style="text-align:left;max-width:600px;margin:2rem auto;">
      <h2>Setup Required</h2>
      <p>The Google Apps Script backend isn't connected yet.</p>
      <ol style="margin:1rem 0;padding-left:1.5rem;line-height:2;">
        <li>Import <code>schulte_people.csv</code> into a Google Sheet (tab named "People")</li>
        <li>Deploy the Google Apps Script (see <code>apps-script/README.md</code>)</li>
        <li>Set the API URL in the browser console:<br>
          <code style="background:#f0f0f0;padding:0.2rem 0.5rem;border-radius:4px;">
            setApiUrl("https://script.google.com/macros/s/YOUR_ID/exec")
          </code>
        </li>
      </ol>
    </div>`;
  import('./api.js').then(m => { window.setApiUrl = m.setApiUrl; });
}

// === Navigation ===

function setupNav() {
  const links = document.querySelectorAll('.nav-link');
  const views = document.querySelectorAll('.view');

  function navigate(viewName) {
    links.forEach(l => l.classList.toggle('active', l.dataset.view === viewName));
    views.forEach(v => v.classList.toggle('active', v.id === `${viewName}-view`));
  }

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = link.dataset.view;
      navigate(link.dataset.view);
    });
  });

  const hash = window.location.hash.replace('#', '') || 'directory';
  navigate(hash);

  window.addEventListener('hashchange', () => {
    navigate(window.location.hash.replace('#', '') || 'directory');
  });
}
