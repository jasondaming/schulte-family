/**
 * Camporee page — 2026 Schulte Family Camporee.
 *
 * Sections:
 *   info     — event title, date, location, welcome note
 *   schedule — timed itinerary items
 *   meals    — catered/food-truck meal notes and head count info
 *   food     — optional extra food signup (everyone can add/remove their own)
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
const CAMPOREE_SCHEDULE_PDF = 'CAMPOREE%20SCHEDULE%202026%20-%20Google%20Docs.pdf';
const CAMPOREE_CABIN_LIST_PDF = 'Cabin%20List%20-%20Google%20Docs.pdf';
const CAMPOREE_POSTER_IMAGE = '2026%20Camporee.jpg';
const VAL_EMAIL = 'vawashburn1979@gmail.com';
const VAL_PHONE = '502-525-1979';
const KEVIN_PHONE = '513-885-8851';
const PAIGE_PHONE = '812-393-0500';
const PAIGE_EMAIL = 'paigebutterfly@hotmail.com';
const ANGELA_EMAIL = 'craftycreations2024@outlook.com';

const CAMPOREE_DEFAULTS = {
  eventTitle: '2026 Schulte Family Camporee',
  eventDate: 'July 2-5, 2026',
  eventLocation: "Santa's Cottages",
  eventAddress: '1405 W Christmas Blvd, Santa Claus, IN 47579',
  welcomeNote: 'The Schulte Standard: four days of family, food, games, music, Mass, and the family picture.',
};

const CAMPOREE_ACTION_ITEMS = [
  {
    title: 'Review latest PDFs',
    body: 'The schedule and cabin list were updated June 29. Check your cabin assignment and contact Val ASAP with any issues.',
    links: [
      { label: 'Schedule PDF', href: CAMPOREE_SCHEDULE_PDF, newTab: true },
      { label: 'Cabin list PDF', href: CAMPOREE_CABIN_LIST_PDF, newTab: true },
      { label: 'Text Val', href: 'sms:5025251979' },
    ],
  },
  {
    title: 'Craft signup',
    body: 'If you still want to reserve a craft spot, do that ASAP. Search the earlier craft email or reach out if you need the details resent.',
    links: [
      { label: 'Text Paige', href: 'sms:8123930500' },
      { label: 'Email Paige', href: `mailto:${PAIGE_EMAIL}?subject=Camporee%20Craft%20Signup` },
    ],
  },
  {
    title: 'Camporee gear pickup',
    body: 'Val checks in Wednesday, July 1 and will take remaining shirts and gear to Cabin 22. Text Val if you want to pick yours up before then.',
    links: [{ label: 'Text Val', href: 'sms:5025251979' }],
  },
  {
    title: 'Thursday setup help',
    body: 'Setup starts Thursday, July 2 at 10:00 AM. A cooler with cold beverages will be available.',
  },
  {
    title: 'Bring tip cash',
    body: 'Dinners and the DJ are paid for; please bring cash if you want to tip Thursday and Friday vendors or the Friday DJ.',
  },
  {
    title: 'Add or change an activity',
    body: 'Reach out to Val if you want to head up an activity or need a date/time change.',
    links: [{ label: VAL_EMAIL, href: `mailto:${VAL_EMAIL}?subject=Camporee%20Activity` }],
  },
];
const CAMPOREE_FEATURED_DETAILS = [
  {
    title: 'Golf Outing',
    meta: 'Friday, July 3 at 7:30 AM',
    facts: [
      'Where: Christmas Lake Golf Course.',
      'Cost: $58.',
      `Questions: text Kevin Schulte at ${KEVIN_PHONE}.`,
    ],
    links: [{ label: 'Text Kevin', href: 'sms:5138858851' }],
  },
  {
    title: 'Paint Party',
    meta: 'Friday, July 3 at 2:00 PM',
    facts: [
      "Where: Santa's Cottages Pavilion.",
      'Crafts: HOME, 4THOFJULY, and kid craft pack.',
      'Cost: $30 for Home or July 4th craft; $10 for kid craft pack.',
      `Payment: Venmo @EppersonAng or email Angela at ${ANGELA_EMAIL} for other payment options.`,
      'Reserve ASAP if you still want a craft spot.',
      `Questions: text or email Paige Goffinet at ${PAIGE_PHONE} or ${PAIGE_EMAIL}.`,
    ],
    links: [
      { label: 'Email Angela', href: `mailto:${ANGELA_EMAIL}?subject=Camporee%20Paint%20Party` },
      { label: 'Text Paige', href: 'sms:8123930500' },
      { label: 'Email Paige', href: `mailto:${PAIGE_EMAIL}?subject=Camporee%20Paint%20Party` },
    ],
  },
  {
    title: 'Camporee Gear',
    meta: 'Pickup before Wednesday, July 1 or at Cabin 22',
    facts: [
      'Shirts are heathered light blue and red.',
      'If you did not order shirts, pack something red or blue and you will fit right in.',
      'Val checks in Wednesday, July 1; all remaining gear at the barn will go with her to Cabin 22.',
      `Early pickup: text Val at ${VAL_PHONE}.`,
    ],
  },
];
const CAMPOREE_MEAL_NOTES = [
  'Thursday dinner: Oink Smokehouse and Bee\'s Original Dawgs food trucks. Tips appreciated. Desserts: Cindy, Kathy, Connie.',
  'Friday dinner: Jimador, Taylor Made, and Champ Dawgs food trucks. Tips appreciated. Desserts: Herb, John, Don.',
  'Saturday dinner: Sanders Catering right after Mass with fried chicken, corn, green beans, mashed potatoes, mac and cheese, and rolls. Desserts: Sylvia, Doris, Janice, Phyllis, Paul.',
];
const CAMPOREE_SCHEDULE = [
  {
    day: 'Thursday, July 2',
    items: [
      ['10:00 AM', 'Setup help needed for the tent, tables, and chairs. Cold beverages will be available.'],
      ['4:00 PM', 'Check-in begins after 4:00 PM. Instructions were sent by email.'],
      ['5:30 PM', "Dinner: Oink Smokehouse and Bee's Original Dawgs food trucks. Tips appreciated. Desserts: Cindy, Kathy, Connie."],
      ['6:30-8:00 PM', 'Board/card games at the pavilion for kids, teens, and the young at heart.'],
      ['8:00 PM', "Texas Hold 'em (Jon Pierce)."],
      ['9:00 PM', 'Pool and splash pad close.'],
    ],
  },
  {
    day: 'Friday, July 3',
    items: [
      ['7:30 AM', 'Golf (Kevin Schulte).'],
      ['8:30 AM-9:00 PM', 'Pool and splash pad open.'],
      ['9:00 AM', 'Yoga with Mike.'],
      ['10:30 AM', 'Kid Games (Doris Troth, Nicole Pattison, Jamie DeCarlo).'],
      ['12:00 PM', 'Teen Games (Doris Troth, Nicole Pattison, Jamie DeCarlo).'],
      ['2:00 PM', 'Paint Party (Paige Goffinet): Home/July 4th craft, or kid craft pack.'],
      ['4:00 PM', '15+ Cornhole Tourney - blind draw, single elimination (Mike Goffinet).'],
      ['5:30 PM', 'Dinner: Jimador, Taylor Made, and Champ Dawgs food trucks. Tips appreciated. Desserts: Herb, John, Don.'],
      ['6:00-7:00 PM', 'Kids Karaoke.'],
      ['7:00-9:00 PM', 'Adult Karaoke with DJ. Tips appreciated.'],
      ['9:00 PM', 'Beer Olympics (Steven Meglio).'],
    ],
  },
  {
    day: 'Saturday, July 4',
    items: [
      ['8:30 AM-9:00 PM', 'Pool open.'],
      ['10:00 AM-1:00 PM', 'Volleyball (Jason Daming).'],
      ['12:30 PM', 'Snowcones (Vicki Summerlot).'],
      ['3:30 PM', 'Large family picture (Randy Daming). Subject to change due to weather.'],
      ['4:30 PM', 'Mass (Fr. Ron).'],
      ['5:30 PM', 'Dinner after Mass provided by Sanders Catering: fried chicken, corn, green beans, mashed potatoes, mac and cheese, and roll. Desserts: Sylvia, Doris, Janice, Phyllis, Paul.'],
      ['7:00-8:30 PM', 'Euchre Tournament (Katie Kissel).'],
      ['8:30-10:00 PM', 'Adult Horse Races (Doug Young).'],
    ],
  },
  {
    day: 'Sunday, July 5',
    items: [
      ['11:00 AM', 'Check out by 11:00 AM. Take trash to receptacles and wash dishes. Check out times are strictly enforced. Safe travels home.'],
    ],
  },
];
const CAMPOREE_BRING_ITEMS = [
  'Cash for food vendor tips and the Friday DJ tip jar.',
  'Cornhole boards, if you can bring a set. Contact Val first.',
  'Red or blue shirts or Camporee gear for the family picture.',
  'Comfortable clothes for games, pool time, yoga, volleyball, golf, and hot weather.',
  'Any supplies needed for an activity you are leading.',
  'Sunscreen, deodorant, water bottles, and anything else that helps with heat.',
];
const CAMPOREE_OTHER_INFO = [
  "No fireworks are allowed at Santa's Cottages. Holiday World fireworks may be viewable from outside the park, and some community fireworks may be visible nearby.",
  'Golf carts are allowed for transporting older family members. Kids are not allowed to drive golf carts.',
  'Train rides are free and offered throughout the weekend.',
  'Unlimited free soft drinks are available in the store, along with items for purchase and items to rent.',
  `Questions, head counts, cornhole boards, or activity updates: contact Val Washburn at ${VAL_EMAIL} or ${VAL_PHONE}.`,
];

export async function initReunion(session) {
  sessionToken    = session.token;
  sessionPersonId = String(session.personId);
  isAdmin         = !!session.isAdmin;

  const container = document.getElementById('reunion-view');
  container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Loading camporee info…</p></div>`;

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

  const eventTitle    = camporeeDefault(get('event_title'), CAMPOREE_DEFAULTS.eventTitle, ['Schulte Family Reunion']);
  const eventDate     = camporeeDefault(get('event_date'), CAMPOREE_DEFAULTS.eventDate, ['July 4, 2026']);
  const eventLocation = camporeeDefault(get('event_location'), CAMPOREE_DEFAULTS.eventLocation, ['Location TBD']);
  const eventAddress  = get('event_address') || CAMPOREE_DEFAULTS.eventAddress;
  const eventMapsUrl  = googleMapsUrl(eventLocation, eventAddress);
  const welcomeNote   = get('welcome_note') || CAMPOREE_DEFAULTS.welcomeNote;

  container.innerHTML = `
    <!-- Hero -->
    <div class="reunion-hero" id="reunion-hero">
      <div class="reunion-hero-inner">
        <div class="reunion-flag">🇺🇸</div>
        <h1 class="reunion-title" id="r-title">${esc(eventTitle)}</h1>
        <div class="reunion-meta">
          <span class="reunion-date" id="r-date">📅 ${esc(eventDate)}</span>
          <span class="reunion-sep">·</span>
          <a class="reunion-loc" id="r-loc" href="${esc(eventMapsUrl)}" target="_blank" rel="noopener" title="Open in Google Maps">📍 ${esc(eventLocation)}${eventAddress ? ', ' + esc(eventAddress) : ''}</a>
        </div>
        ${welcomeNote ? `<p class="reunion-welcome" id="r-welcome">${esc(welcomeNote)}</p>` : ''}
        <div class="reunion-hero-actions">
          <a class="reunion-hero-link" href="${CAMPOREE_SCHEDULE_PDF}" target="_blank" rel="noopener">View schedule PDF</a>
          <a class="reunion-hero-link" href="${CAMPOREE_CABIN_LIST_PDF}" target="_blank" rel="noopener">View cabin list</a>
          ${isAdmin ? `<button class="btn-secondary reunion-edit-info" id="edit-info-btn">✏️ Edit Event Details</button>` : ''}
        </div>
      </div>
    </div>

    <div class="reunion-body">
      <section class="reunion-section" id="section-action">
        <div class="reunion-section-header">
          <h2>Latest Updates</h2>
        </div>
        ${renderActionItems()}
      </section>

      <section class="reunion-section" id="section-featured-details">
        <div class="reunion-section-header">
          <h2>Activities and Gear</h2>
        </div>
        ${renderFeaturedDetails()}
      </section>

      <section class="reunion-section" id="section-meals">
        <div class="reunion-section-header">
          <h2>Meals and Head Count</h2>
        </div>
        ${renderMealNotes()}
      </section>

      <!-- Schedule -->
      <section class="reunion-section" id="section-schedule">
        <div class="reunion-section-header">
          <div>
            <h2>Schedule</h2>
            <p class="section-subtitle">All times are CST.</p>
          </div>
          ${isAdmin ? `<button class="btn-secondary" id="add-schedule-btn">+ Add Item</button>` : ''}
        </div>
        <div id="schedule-list" class="schedule-list">
          ${renderCamporeeSchedule()}
          ${scheduleItems.length ? renderAdditionalScheduleItems(scheduleItems) : ''}
        </div>
        <div id="schedule-form-area"></div>
      </section>

      <!-- Food Potluck -->
      <section class="reunion-section" id="section-food">
        <div class="reunion-section-header">
          <div>
            <h2>Extra Food Signup</h2>
            <p class="section-subtitle">Official dinners are covered; use this only for extras, snacks, or shared items.</p>
          </div>
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
          <h2>What to Bring</h2>
          ${isAdmin ? `<button class="btn-secondary" id="add-bring-btn">+ Add Item</button>` : ''}
        </div>
        <div id="bring-list" class="bring-list">
          ${renderBringList(bringItems)}
        </div>
        <div id="bring-form-area"></div>
      </section>

      <section class="reunion-section" id="section-other-info">
        <div class="reunion-section-header">
          <h2>Other Info</h2>
        </div>
        ${renderOtherInfo()}
      </section>

      <section class="reunion-poster-section" aria-label="2026 Schulte Camporee poster">
        <a href="${CAMPOREE_POSTER_IMAGE}" target="_blank" rel="noopener">
          <img src="${CAMPOREE_POSTER_IMAGE}" alt="The Schulte Standard 2026 Camporee poster" loading="lazy">
        </a>
      </section>

    </div>`;

  attachHandlers();
}

function camporeeDefault(value, fallback, staleValues = []) {
  const trimmed = (value || '').trim();
  if (!trimmed || staleValues.includes(trimmed)) return fallback;
  return trimmed;
}

function googleMapsUrl(location, address) {
  const query = [location, address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function renderActionItems() {
  return `
    <div class="action-grid">
      ${CAMPOREE_ACTION_ITEMS.map(item => `
        <div class="action-card">
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.body)}</p>
          ${renderLinks(item.links)}
        </div>
      `).join('')}
    </div>`;
}

function renderFeaturedDetails() {
  return `
    <div class="detail-grid">
      ${CAMPOREE_FEATURED_DETAILS.map(detail => `
        <div class="detail-card">
          <div class="detail-card-header">
            <h3>${esc(detail.title)}</h3>
            <p>${esc(detail.meta)}</p>
          </div>
          <ul class="detail-facts">
            ${detail.facts.map(fact => `<li>${esc(fact)}</li>`).join('')}
          </ul>
          ${renderLinks(detail.links)}
        </div>
      `).join('')}
    </div>`;
}

function renderMealNotes() {
  return `
    <div class="reunion-callout">
      <strong>Thank you, Uncle Paul.</strong>
      <span>Dinner for all three nights is paid for courtesy of Paul Schulte.</span>
    </div>
    <div class="info-list">
      ${CAMPOREE_MEAL_NOTES.map(note => `<div class="info-list-item">${esc(note)}</div>`).join('')}
    </div>`;
}

function renderCamporeeSchedule() {
  return CAMPOREE_SCHEDULE.map(day => `
    <div class="schedule-day">
      <h3>${esc(day.day)}</h3>
      <div class="schedule-day-items">
        ${day.items.map(([time, activity]) => `
          <div class="schedule-item schedule-default-item">
            <div class="schedule-time">${esc(time)}</div>
            <div class="schedule-activity">${esc(activity)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderAdditionalScheduleItems(items) {
  return `
    <div class="schedule-day schedule-added">
      <h3>Additional Schedule Notes</h3>
      <div class="schedule-day-items">
        ${items.map(renderScheduleItem).join('')}
      </div>
    </div>`;
}

function renderBringList(bringItems) {
  return `
    ${CAMPOREE_BRING_ITEMS.map(item => renderBringText(item)).join('')}
    ${bringItems.length ? bringItems.map(renderBringItem).join('') : ''}`;
}

function renderBringText(text) {
  return `
    <div class="bring-item">
      <span class="bring-bullet">•</span>
      <span class="bring-text">${esc(text)}</span>
    </div>`;
}

function renderOtherInfo() {
  return `
    <div class="info-list">
      ${CAMPOREE_OTHER_INFO.map(note => `<div class="info-list-item">${esc(note)}</div>`).join('')}
    </div>`;
}

function renderLinks(links = []) {
  if (!links || !links.length) return '';
  return `
    <div class="inline-link-row">
      ${links.map(link => {
        const attrs = link.newTab ? ' target="_blank" rel="noopener"' : '';
        return `<a href="${esc(link.href)}"${attrs}>${esc(link.label)}</a>`;
      }).join('')}
    </div>`;
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
      <div class="form-group"><label>Event Title</label><input id="ie-title" type="text" value="${esc(camporeeDefault(get('event_title'), CAMPOREE_DEFAULTS.eventTitle, ['Schulte Family Reunion']))}"></div>
      <div class="form-row">
        <div class="form-group"><label>Date</label><input id="ie-date" type="text" value="${esc(camporeeDefault(get('event_date'), CAMPOREE_DEFAULTS.eventDate, ['July 4, 2026']))}" placeholder="e.g. July 2-5, 2026"></div>
        <div class="form-group"><label>Location</label><input id="ie-loc" type="text" value="${esc(camporeeDefault(get('event_location'), CAMPOREE_DEFAULTS.eventLocation, ['Location TBD']))}" placeholder="City, State or venue name"></div>
      </div>
      <div class="form-group"><label>Address</label><input id="ie-addr" type="text" value="${esc(get('event_address') || CAMPOREE_DEFAULTS.eventAddress)}" placeholder="Street address (optional)"></div>
      <div class="form-group"><label>Welcome Note</label><input id="ie-note" type="text" value="${esc(get('welcome_note') || CAMPOREE_DEFAULTS.welcomeNote)}" placeholder="A brief message for family members…"></div>
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
      welcome_note:  document.getElementById('ie-note').value.trim(),
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
