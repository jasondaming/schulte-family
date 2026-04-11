/**
 * Reunion page — July 4th Schulte Family Reunion 2026.
 *
 * Sections:
 *   info     — event title, date, location, welcome note
 *   schedule — timed itinerary items
 *   food     — potluck signup (everyone can add/remove their own)
 *   bring    — what-to-bring list
 *
 * Admins see edit/delete controls on every item.
 * The backend auto-creates the Reunion and FoodSignup sheets on first use.
 */

import {
  fetchReunion, signupFood, removeSignup,
  upsertReunionItem, deleteReunionItem,
} from './api.js';

let sessionToken = null;
let sessionPersonId = null;
let isAdmin = false;
let reunionItems = [];   // content managed by admins
let foodSignups  = [];   // potluck signups from everyone

const FOOD_CATEGORIES = ['Main Dish', 'Side Dish', 'Dessert', 'Drinks', 'Snacks', 'Other'];

export async function initReunion(session) {
  sessionToken    = session.token;
  sessionPersonId = String(session.personId);
  isAdmin         = !!session.isAdmin;

  const container = document.getElementById('reunion-view');
  container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Loading reunion info…</p></div>`;

  try {
    const data = await fetchReunion(sessionToken);
    reunionItems = data.items   || [];
    foodSignups  = data.signups || [];
  } catch (e) {
    reunionItems = [];
    foodSignups  = [];
  }

  render();
}

// ─────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────

function render() {
  const container = document.getElementById('reunion-view');

  const infoItems     = reunionItems.filter(i => i.type === 'info');
  const scheduleItems = reunionItems.filter(i => i.type === 'schedule');
  const bringItems    = reunionItems.filter(i => i.type === 'bring');

  // Pull well-known info fields by title key
  const get = key => (infoItems.find(i => i.title === key) || {}).body || '';

  const eventTitle    = get('event_title')    || 'Schulte Family Reunion';
  const eventDate     = get('event_date')     || 'July 4, 2026';
  const eventLocation = get('event_location') || 'Location TBD';
  const eventAddress  = get('event_address')  || '';
  const welcomeNote   = get('welcome_note')   || '';

  container.innerHTML = `
    <!-- Hero -->
    <div class="reunion-hero">
      <div class="reunion-hero-inner">
        <div class="reunion-flag">🇺🇸</div>
        <h1 class="reunion-title" id="r-title">${esc(eventTitle)}</h1>
        <div class="reunion-meta">
          <span class="reunion-date" id="r-date">📅 ${esc(eventDate)}</span>
          <span class="reunion-sep">·</span>
          <span class="reunion-loc" id="r-loc">📍 ${esc(eventLocation)}${eventAddress ? ', ' + esc(eventAddress) : ''}</span>
        </div>
        ${welcomeNote ? `<p class="reunion-welcome" id="r-welcome">${esc(welcomeNote)}</p>` : ''}
        ${isAdmin ? `<button class="btn-secondary reunion-edit-info" id="edit-info-btn">✏️ Edit Event Details</button>` : ''}
      </div>
    </div>

    <div class="reunion-body">

      <!-- Schedule -->
      <section class="reunion-section" id="section-schedule">
        <div class="reunion-section-header">
          <h2>📋 Schedule</h2>
          ${isAdmin ? `<button class="btn-secondary" id="add-schedule-btn">+ Add Item</button>` : ''}
        </div>
        <div id="schedule-list" class="schedule-list">
          ${scheduleItems.length ? scheduleItems.map(renderScheduleItem).join('') : emptyMsg('No schedule items yet.')}
        </div>
        <div id="schedule-form-area"></div>
      </section>

      <!-- Food Potluck -->
      <section class="reunion-section" id="section-food">
        <div class="reunion-section-header">
          <h2>🍽️ Potluck Signup</h2>
          <button class="btn-primary" id="signup-food-btn">I'm Bringing Something!</button>
        </div>
        <div id="food-form-area"></div>
        <div id="food-list">
          ${renderFoodList()}
        </div>
      </section>

      <!-- What to Bring -->
      <section class="reunion-section" id="section-bring">
        <div class="reunion-section-header">
          <h2>🎒 What to Bring</h2>
          ${isAdmin ? `<button class="btn-secondary" id="add-bring-btn">+ Add Item</button>` : ''}
        </div>
        <div id="bring-list" class="bring-list">
          ${bringItems.length ? bringItems.map(renderBringItem).join('') : emptyMsg('No items added yet.')}
        </div>
        <div id="bring-form-area"></div>
      </section>

    </div>`;

  attachHandlers();
}

function renderScheduleItem(item) {
  return `
    <div class="schedule-item" data-id="${item.id}">
      <div class="schedule-time">${esc(item.title)}</div>
      <div class="schedule-activity">
        ${esc(item.body)}
      </div>
      ${isAdmin ? `
        <div class="item-actions">
          <button class="item-edit-btn" data-id="${item.id}" data-type="schedule">✏️</button>
          <button class="item-delete-btn" data-id="${item.id}">🗑️</button>
        </div>` : ''}
    </div>`;
}

function renderBringItem(item) {
  return `
    <div class="bring-item" data-id="${item.id}">
      <span class="bring-bullet">•</span>
      <span class="bring-text">${esc(item.body || item.title)}</span>
      ${isAdmin ? `
        <span class="item-actions-inline">
          <button class="item-edit-btn" data-id="${item.id}" data-type="bring">✏️</button>
          <button class="item-delete-btn" data-id="${item.id}">🗑️</button>
        </span>` : ''}
    </div>`;
}

function renderFoodList() {
  if (!foodSignups.length) return emptyMsg('No one has signed up yet — be the first!');

  const byCategory = {};
  for (const s of foodSignups) {
    const cat = s.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(s);
  }

  const order = ['Main Dish', 'Side Dish', 'Dessert', 'Drinks', 'Snacks', 'Other'];
  let html = '';
  for (const cat of order) {
    if (!byCategory[cat]) continue;
    html += `<div class="food-category"><h4>${esc(cat)}</h4><div class="food-items">`;
    for (const s of byCategory[cat]) {
      const isOwn = String(s.personId) === sessionPersonId;
      html += `
        <div class="food-item" data-signup-id="${s.signupId}">
          <div class="food-dish">${esc(s.dish)}</div>
          <div class="food-who">${esc(s.personName)}${s.notes ? ` · <em>${esc(s.notes)}</em>` : ''}</div>
          ${(isOwn || isAdmin) ? `<button class="food-remove-btn" data-signup-id="${s.signupId}" title="Remove">×</button>` : ''}
        </div>`;
    }
    html += `</div></div>`;
  }
  return html;
}

function emptyMsg(msg) {
  return `<p class="reunion-empty">${msg}</p>`;
}

// ─────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────

function attachHandlers() {
  // ── Info edit (admin) ──
  const editInfoBtn = document.getElementById('edit-info-btn');
  if (editInfoBtn) {
    editInfoBtn.addEventListener('click', () => showInfoEditor());
  }

  // ── Schedule ──
  const addSchedBtn = document.getElementById('add-schedule-btn');
  if (addSchedBtn) {
    addSchedBtn.addEventListener('click', () => {
      showItemForm('schedule-form-area', 'schedule', null);
    });
  }

  // ── Bring list ──
  const addBringBtn = document.getElementById('add-bring-btn');
  if (addBringBtn) {
    addBringBtn.addEventListener('click', () => {
      showItemForm('bring-form-area', 'bring', null);
    });
  }

  // ── Food signup ──
  document.getElementById('signup-food-btn').addEventListener('click', () => {
    showFoodForm();
  });

  // ── Delete / edit items (admin) ──
  document.querySelectorAll('.item-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteItem(btn.dataset.id));
  });
  document.querySelectorAll('.item-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = reunionItems.find(i => String(i.id) === String(btn.dataset.id));
      if (item) showItemForm(
        btn.dataset.type === 'schedule' ? 'schedule-form-area' : 'bring-form-area',
        btn.dataset.type,
        item,
      );
    });
  });

  // ── Food remove ──
  document.querySelectorAll('.food-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFood(btn.dataset.signupId));
  });
}

// ─────────────────────────────────────────────
// Forms
// ─────────────────────────────────────────────

function showInfoEditor() {
  const get = key => (reunionItems.find(i => i.type === 'info' && i.title === key) || {}).body || '';
  const area = document.getElementById('reunion-hero');

  // Insert inline form after hero inner
  const existing = document.getElementById('info-editor');
  if (existing) { existing.remove(); return; }

  const div = document.createElement('div');
  div.id = 'info-editor';
  div.className = 'info-editor';
  div.innerHTML = `
    <div class="info-editor-inner profile-form">
      <h3>Edit Event Details</h3>
      <div class="form-group"><label>Event Title</label><input id="ie-title" type="text" value="${esc(get('event_title') || 'Schulte Family Reunion')}"></div>
      <div class="form-row">
        <div class="form-group"><label>Date</label><input id="ie-date" type="text" value="${esc(get('event_date') || 'July 4, 2026')}" placeholder="e.g. July 4, 2026"></div>
        <div class="form-group"><label>Location</label><input id="ie-loc" type="text" value="${esc(get('event_location'))}" placeholder="City, State or venue name"></div>
      </div>
      <div class="form-group"><label>Address</label><input id="ie-addr" type="text" value="${esc(get('event_address'))}" placeholder="Street address (optional)"></div>
      <div class="form-group"><label>Welcome Note</label><input id="ie-note" type="text" value="${esc(get('event_welcome'))}" placeholder="A brief message for family members…"></div>
      <div class="form-actions">
        <button id="ie-save" class="btn-primary">Save</button>
        <button id="ie-cancel" class="btn-secondary">Cancel</button>
        <span class="status-msg" id="ie-status" hidden></span>
      </div>
    </div>`;
  area.appendChild(div);

  document.getElementById('ie-cancel').addEventListener('click', () => div.remove());
  document.getElementById('ie-save').addEventListener('click', async () => {
    const btn = document.getElementById('ie-save');
    btn.disabled = true; btn.textContent = 'Saving…';

    const fields = {
      event_title:    document.getElementById('ie-title').value.trim(),
      event_date:     document.getElementById('ie-date').value.trim(),
      event_location: document.getElementById('ie-loc').value.trim(),
      event_address:  document.getElementById('ie-addr').value.trim(),
      event_welcome:  document.getElementById('ie-note').value.trim(),
    };

    try {
      for (const [key, val] of Object.entries(fields)) {
        const existing = reunionItems.find(i => i.type === 'info' && i.title === key);
        if (existing) {
          await upsertReunionItem(sessionToken, { id: existing.id, body: val });
          existing.body = val;
        } else if (val) {
          const res = await upsertReunionItem(sessionToken, { type: 'info', title: key, body: val });
          reunionItems.push({ id: res.id, type: 'info', title: key, body: val, sortOrder: 0 });
        }
      }
      div.remove();
      render();
    } catch (err) {
      const st = document.getElementById('ie-status');
      st.textContent = `Error: ${err.message}`;
      st.className = 'status-msg error';
      st.hidden = false;
      btn.disabled = false; btn.textContent = 'Save';
    }
  });
}

function showItemForm(areaId, type, existingItem) {
  const area = document.getElementById(areaId);
  if (!area) return;

  const isSchedule = type === 'schedule';
  const title  = existingItem ? existingItem.title : '';
  const body   = existingItem ? (existingItem.body || '') : '';

  area.innerHTML = `
    <div class="item-form profile-form">
      ${isSchedule
        ? `<div class="form-row">
             <div class="form-group form-group-sm"><label>Time</label><input id="if-title" type="text" value="${esc(title)}" placeholder="e.g. 10:00 AM"></div>
             <div class="form-group"><label>Activity</label><input id="if-body" type="text" value="${esc(body)}" placeholder="What's happening?"></div>
           </div>`
        : `<div class="form-group"><label>Item</label><input id="if-body" type="text" value="${esc(body || title)}" placeholder="e.g. Lawn chairs, Sunscreen…"></div>`
      }
      <div class="form-actions">
        <button id="if-save" class="btn-primary">${existingItem ? 'Update' : 'Add'}</button>
        <button id="if-cancel" class="btn-secondary">Cancel</button>
        <span class="status-msg" id="if-status" hidden></span>
      </div>
    </div>`;

  document.getElementById('if-cancel').addEventListener('click', () => { area.innerHTML = ''; });
  document.getElementById('if-save').addEventListener('click', async () => {
    const btn = document.getElementById('if-save');
    btn.disabled = true; btn.textContent = 'Saving…';

    const newTitle = isSchedule ? (document.getElementById('if-title').value.trim()) : '';
    const newBody  = document.getElementById('if-body').value.trim();
    if (!newBody) { btn.disabled = false; btn.textContent = existingItem ? 'Update' : 'Add'; return; }

    try {
      if (existingItem) {
        await upsertReunionItem(sessionToken, {
          id: existingItem.id,
          title: isSchedule ? newTitle : newBody,
          body:  isSchedule ? newBody : '',
        });
        existingItem.title = isSchedule ? newTitle : newBody;
        existingItem.body  = isSchedule ? newBody : '';
      } else {
        const maxOrder = Math.max(0, ...reunionItems.filter(i => i.type === type).map(i => i.sortOrder));
        const res = await upsertReunionItem(sessionToken, {
          type,
          title: isSchedule ? newTitle : newBody,
          body:  isSchedule ? newBody  : '',
          sortOrder: maxOrder + 10,
        });
        reunionItems.push({ id: res.id, type, title: isSchedule ? newTitle : newBody, body: isSchedule ? newBody : '', sortOrder: maxOrder + 10 });
      }
      area.innerHTML = '';
      render();
    } catch (err) {
      const st = document.getElementById('if-status');
      st.textContent = `Error: ${err.message}`;
      st.className = 'status-msg error'; st.hidden = false;
      btn.disabled = false; btn.textContent = existingItem ? 'Update' : 'Add';
    }
  });
}

function showFoodForm() {
  const area = document.getElementById('food-form-area');
  if (area.innerHTML) { area.innerHTML = ''; return; } // toggle

  const catOptions = FOOD_CATEGORIES.map(c => `<option>${c}</option>`).join('');
  area.innerHTML = `
    <div class="food-form profile-form">
      <div class="form-row">
        <div class="form-group"><label>What are you bringing?</label><input id="ff-dish" type="text" placeholder="Potato salad, Apple pie…"></div>
        <div class="form-group form-group-sm"><label>Category</label><select id="ff-cat">${catOptions}</select></div>
      </div>
      <div class="form-group"><label>Notes <span class="form-hint">(optional — serves, dietary info, etc.)</span></label>
        <input id="ff-notes" type="text" placeholder="Serves 12, gluten-free…">
      </div>
      <div class="form-actions">
        <button id="ff-save" class="btn-primary">Sign Me Up!</button>
        <button id="ff-cancel" class="btn-secondary">Cancel</button>
        <span class="status-msg" id="ff-status" hidden></span>
      </div>
    </div>`;

  document.getElementById('ff-cancel').addEventListener('click', () => { area.innerHTML = ''; });
  document.getElementById('ff-save').addEventListener('click', async () => {
    const btn   = document.getElementById('ff-save');
    const dish  = document.getElementById('ff-dish').value.trim();
    const cat   = document.getElementById('ff-cat').value;
    const notes = document.getElementById('ff-notes').value.trim();
    if (!dish) return;

    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const res = await signupFood(sessionToken, dish, cat, notes);
      foodSignups.push({
        signupId:   res.signupId,
        personId:   res.personId,
        personName: res.personName,
        dish, category: cat, notes,
        signedUpAt: new Date().toISOString(),
      });
      area.innerHTML = '';
      document.getElementById('food-list').innerHTML = renderFoodList();
      // Re-attach remove handlers
      document.querySelectorAll('.food-remove-btn').forEach(b => {
        b.addEventListener('click', () => removeFood(b.dataset.signupId));
      });
    } catch (err) {
      const st = document.getElementById('ff-status');
      st.textContent = `Error: ${err.message}`;
      st.className = 'status-msg error'; st.hidden = false;
      btn.disabled = false; btn.textContent = 'Sign Me Up!';
    }
  });
}

// ─────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  try {
    await deleteReunionItem(sessionToken, id);
    reunionItems = reunionItems.filter(i => String(i.id) !== String(id));
    render();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function removeFood(signupId) {
  try {
    await removeSignup(sessionToken, signupId);
    foodSignups = foodSignups.filter(s => String(s.signupId) !== String(signupId));
    document.getElementById('food-list').innerHTML = renderFoodList();
    document.querySelectorAll('.food-remove-btn').forEach(b => {
      b.addEventListener('click', () => removeFood(b.dataset.signupId));
    });
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
