/**
 * Directory view — searchable, filterable person cards.
 * Data is person-centric: one entry per person, linked by SpouseID/ParentID.
 */

import { navigateToPerson } from './tree.js';

let allPeople = [];
let peopleById = {};
let currentFilter = 'all';
let lastRenderedHouseholds = [];

const BIRTHDAY_INITIAL_PAST_DAYS = 7;
const BIRTHDAY_INITIAL_FUTURE_DAYS = 30;
const BIRTHDAY_LOAD_PAST_DAYS = 30;
const BIRTHDAY_LOAD_FUTURE_DAYS = 60;
let birthdayStartOffset = -BIRTHDAY_INITIAL_PAST_DAYS;
let birthdayEndOffset = BIRTHDAY_INITIAL_FUTURE_DAYS;
let birthdayScrollRestore = { mode: 'today' };
let birthdayScrollPending = false;

export function initDirectory(people) {
  allPeople = people;
  peopleById = {};
  for (const p of people) {
    peopleById[p.personId] = p;
  }

  document.getElementById('search-input').addEventListener('input', () => {
    if (currentFilter === 'upcoming') birthdayScrollRestore = { mode: 'today' };
    render();
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const nextFilter = btn.dataset.filter;
      if (nextFilter === 'upcoming') resetBirthdayWindow();
      currentFilter = nextFilter;
      render();
    });
  });

  // Print button
  const printBtn = document.getElementById('print-directory-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      renderPrintDirectory(lastRenderedHouseholds);
      window.print();
    });
  }

  render();
}

export function updateDirectory(people) {
  allPeople = people;
  peopleById = {};
  for (const p of people) peopleById[p.personId] = p;
  render();
}

function render() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  const container = document.getElementById('directory-list');

  // Group people into households (person + spouse shown together)
  let households = buildHouseholds();

  // Filter
  if (query) {
    households = households.filter(h => {
      const memberFields = h.members.map(m =>
        [m.firstName, m.lastName, m.city, m.state, m.zip, m.email, m.cell, m.phone, m.address, m.branch]
          .filter(Boolean).join(' ')
      ).join(' ');
      const childFields = h.children.map(c =>
        [c.firstName, c.lastName].filter(Boolean).join(' ')
      ).join(' ');
      const searchable = (memberFields + ' ' + childFields).toLowerCase();
      return searchable.includes(query);
    });
  }

  lastRenderedHouseholds = households;
  renderPrintDirectory(households);

  if (currentFilter === 'upcoming') {
    renderUpcomingBirthdays(container, query);
    return;
  }

  if (currentFilter === 'branch') {
    renderByBranch(container, households);
  } else {
    container.innerHTML = households.length
      ? households.map(h => householdCard(h)).join('')
      : '<p class="loading">No results found.</p>';
  }

  // Attach "View in Tree" handlers
  container.querySelectorAll('.card-tree-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateToPerson(Number(link.dataset.personId));
    });
  });

  // Attach child link handlers — scroll to their card or go to tree
  container.querySelectorAll('.child-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const personId = Number(link.dataset.personId);
      const person = peopleById[personId];
      if (!person) return;

      // Find their card in the directory (they have one if they're the primary of a household)
      const card = container.querySelector(`.family-card .card-tree-link[data-person-id="${personId}"]`);
      if (card) {
        const familyCard = card.closest('.family-card');
        familyCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        familyCard.classList.add('card-highlight');
        setTimeout(() => familyCard.classList.remove('card-highlight'), 2000);
      } else if (person.spouseId) {
        // Try finding via spouse's card
        const spouseCard = container.querySelector(`.family-card .card-tree-link[data-person-id="${person.spouseId}"]`);
        if (spouseCard) {
          const familyCard = spouseCard.closest('.family-card');
          familyCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          familyCard.classList.add('card-highlight');
          setTimeout(() => familyCard.classList.remove('card-highlight'), 2000);
        }
      } else {
        // No card in directory — go to tree
        navigateToPerson(personId);
      }
    });
  });
}

/**
 * Group people into households: couples live together, singles are their own household.
 * Avoids showing the same couple twice.
 */
function buildHouseholds() {
  const familyOrder = buildFamilyOrderMap();
  const seen = new Set();
  const households = [];

  for (const p of allPeople) {
    if (seen.has(p.personId)) continue;
    // Skip deceased people who have no living spouse (they'll show via their spouse's card)
    if (p.deceased) {
      const spouse = p.spouseId ? peopleById[p.spouseId] : null;
      if (!spouse || spouse.deceased) continue; // both deceased or no spouse - skip
      // Has a living spouse - they'll be shown on the spouse's card
      continue;
    }
    seen.add(p.personId);

    const members = [p];
    // Add spouse (including deceased - they're still part of the family)
    if (p.spouseId && peopleById[p.spouseId]) {
      const spouse = peopleById[p.spouseId];
      members.push(spouse);
      seen.add(spouse.personId);
    }

    // Find ALL children (people whose parentId = this person or spouse)
    const childIds = new Set();
    const children = allPeople.filter(c => {
      const isChild = members.some(m => c.parentId == m.personId);
      if (isChild && !childIds.has(c.personId)) {
        childIds.add(c.personId);
        return true;
      }
      return false;
    });

    children.sort(compareSiblingsByBirth);

    households.push({
      members,
      children,
      branch: p.branch || (p.spouseId && peopleById[p.spouseId]?.branch) || '',
      familyOrder: householdFamilyOrder(members, familyOrder),
    });
  }

  households.sort((a, b) => {
    if (a.familyOrder !== b.familyOrder) return a.familyOrder - b.familyOrder;
    return compareSiblingsByBirth(a.members[0], b.members[0]);
  });

  return households;
}

function buildFamilyOrderMap() {
  const order = new Map();
  let nextOrder = 0;
  let currentGeneration = allPeople
    .filter(p => !p.parentId && Number(p.generation) === 0)
    .sort(compareSiblingsByBirth);

  while (currentGeneration.length) {
    const nextGeneration = [];
    const nextIds = new Set();

    for (const person of currentGeneration) {
      if (!person || order.has(String(person.personId))) continue;
      assignFamilyOrder(order, person, nextOrder++);

      const spouse = person.spouseId ? peopleById[person.spouseId] : null;
      const parentIds = new Set([String(person.personId)]);
      if (spouse) parentIds.add(String(spouse.personId));

      const children = allPeople
        .filter(p => parentIds.has(String(p.parentId || '')))
        .sort(compareSiblingsByBirth);

      for (const child of children) {
        const id = String(child.personId);
        if (!order.has(id) && !nextIds.has(id)) {
          nextIds.add(id);
          nextGeneration.push(child);
        }
      }
    }

    currentGeneration = nextGeneration;
  }

  for (const person of [...allPeople].sort(compareSiblingsByBirth)) {
    if (!order.has(String(person.personId))) assignFamilyOrder(order, person, nextOrder++);
  }

  return order;
}

function assignFamilyOrder(order, person, value) {
  order.set(String(person.personId), value);
  const spouse = person.spouseId ? peopleById[person.spouseId] : null;
  if (spouse && !order.has(String(spouse.personId))) {
    order.set(String(spouse.personId), value);
  }
}

function householdFamilyOrder(members, familyOrder) {
  return Math.min(...members.map(m => familyOrder.get(String(m.personId)) ?? Number.MAX_SAFE_INTEGER));
}

function compareSiblingsByBirth(a, b) {
  const aBirth = birthTime(a);
  const bBirth = birthTime(b);
  if (aBirth !== null && bBirth !== null && aBirth !== bBirth) return aBirth - bBirth;
  if (aBirth !== null && bBirth === null) return -1;
  if (aBirth === null && bBirth !== null) return 1;
  return numericPersonId(a) - numericPersonId(b);
}

function birthTime(person) {
  if (!person || !person.birthday) return null;
  const d = parseDate(person.birthday);
  return d ? d.getTime() : null;
}

function numericPersonId(person) {
  const id = Number(person?.personId);
  return Number.isFinite(id) ? id : Number.MAX_SAFE_INTEGER;
}
function renderUpcomingBirthdays(container, query = '') {
  const birthdays = birthdayEntriesForWindow(birthdayStartOffset, birthdayEndOffset, query);

  if (birthdays.length === 0) {
    container.innerHTML = query
      ? '<p class="loading">No birthdays found for this search.</p>'
      : '<p class="loading">No birthdays found.</p>';
    return;
  }

  let html = '<div class="birthday-list birthday-list-scroll" id="birthday-scroll-list">';

  let todayInserted = false;
  for (const { person: p, days, occurrence } of birthdays) {
    if (!todayInserted && days >= 0) {
      html += todayDividerHtml();
      todayInserted = true;
    }

    const name = `${esc(p.firstName)} ${esc(p.lastName || '')}`.trim();
    const dateStr = fmtDateForBirthdayList(occurrence);
    const age = getAgeOnOccurrence(p.birthday, occurrence);
    const ageText = age ? (days < 0 ? ' (turned ' + age + ')' : ' (turning ' + age + ')') : '';
    const when = describeBirthdayOffset(days);
    const rowClass = days < 0 ? ' birthday-past' : days === 0 ? ' birthday-today' : days <= 7 ? ' birthday-soon' : '';

    html += `<div class="birthday-row${rowClass}">`;
    html += `<span class="birthday-row-name">${name}</span>`;
    html += `<span class="birthday-row-date">${dateStr}${ageText}</span>`;
    html += `<span class="birthday-row-when">${when}</span>`;
    html += '</div>';
  }

  if (!todayInserted) html += todayDividerHtml();
  html += '</div>';
  container.innerHTML = html;
  attachBirthdayScroller(container, !!query);
}

function resetBirthdayWindow() {
  birthdayStartOffset = -BIRTHDAY_INITIAL_PAST_DAYS;
  birthdayEndOffset = BIRTHDAY_INITIAL_FUTURE_DAYS;
  birthdayScrollRestore = { mode: 'today' };
  birthdayScrollPending = false;
}

function birthdayEntriesForWindow(startOffset, endOffset, query = '') {
  const today = startOfToday();
  const activeQuery = (query || '').toLowerCase().trim();
  const startDate = addDays(today, activeQuery ? -BIRTHDAY_INITIAL_PAST_DAYS : startOffset);
  const endDate = addDays(today, activeQuery ? 366 : endOffset);
  const entries = [];

  for (const p of allPeople) {
    if (p.deceased || !p.birthday) continue;
    const bd = parseDate(p.birthday);
    if (!bd) continue;

    for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year += 1) {
      const occurrence = new Date(year, bd.getMonth(), bd.getDate());
      if (occurrence.getMonth() !== bd.getMonth() || occurrence.getDate() !== bd.getDate()) continue;
      if (occurrence < startDate || occurrence > endDate) continue;
      if (activeQuery && !matchesBirthdayQuery(p, occurrence, activeQuery)) continue;
      entries.push({ person: p, occurrence, days: daysBetween(occurrence, today) });
    }
  }

  entries.sort((a, b) => {
    if (a.days !== b.days) return a.days - b.days;
    const aName = `${a.person.firstName} ${a.person.lastName || ''}`;
    const bName = `${b.person.firstName} ${b.person.lastName || ''}`;
    return aName.localeCompare(bName);
  });

  return entries;
}

function matchesBirthdayQuery(person, occurrence, query) {
  const terms = query.split(/\s+/).filter(Boolean);
  if (!terms.length) return true;

  const haystack = [
    person.firstName,
    person.lastName,
    person.branch,
    person.city,
    person.state,
    person.birthday,
    fmtDateForBirthdayList(occurrence),
    fmtBday(person.birthday),
  ].filter(Boolean).join(' ').toLowerCase();

  return terms.every(term => haystack.includes(term));
}

function attachBirthdayScroller(container, searchActive = false) {
  const list = container.querySelector('#birthday-scroll-list');
  if (!list) return;

  if (searchActive) {
    restoreBirthdayScroll(list);
    return;
  }

  list.addEventListener('scroll', () => {
    if (birthdayScrollPending) return;

    if (list.scrollTop < 48) {
      extendBirthdayWindow(container, 'earlier', list);
    } else if (list.scrollTop + list.clientHeight > list.scrollHeight - 48) {
      extendBirthdayWindow(container, 'later', list);
    }
  }, { passive: true });
  list.addEventListener('wheel', (e) => {
    if (birthdayScrollPending) return;

    if (e.deltaY < 0 && list.scrollTop <= 0) {
      extendBirthdayWindow(container, 'earlier', list);
    } else if (e.deltaY > 0 && list.scrollTop + list.clientHeight >= list.scrollHeight) {
      extendBirthdayWindow(container, 'later', list);
    }
  }, { passive: true });
  restoreBirthdayScroll(list);
}

function extendBirthdayWindow(container, direction, list) {
  birthdayScrollPending = true;

  if (direction === 'earlier') {
    birthdayStartOffset -= BIRTHDAY_LOAD_PAST_DAYS;
    birthdayScrollRestore = {
      mode: 'earlier',
      previousHeight: list.scrollHeight,
      previousTop: list.scrollTop,
    };
  } else {
    birthdayEndOffset += BIRTHDAY_LOAD_FUTURE_DAYS;
    birthdayScrollRestore = {
      mode: 'later',
      previousTop: list.scrollTop,
    };
  }

  renderUpcomingBirthdays(container);
}

function restoreBirthdayScroll(list) {
  const restore = birthdayScrollRestore || { mode: 'same', previousTop: list.scrollTop };
  birthdayScrollRestore = null;

  requestAnimationFrame(() => {
    if (restore.mode === 'today') {
      const anchor = list.querySelector('.birthday-today-anchor');
      if (anchor) list.scrollTop = Math.max(0, anchor.offsetTop - list.offsetTop);
    } else if (restore.mode === 'earlier') {
      list.scrollTop = Math.max(0, list.scrollHeight - restore.previousHeight + restore.previousTop);
    } else if (restore.mode === 'later') {
      list.scrollTop = restore.previousTop;
    }

    birthdayScrollPending = false;
  });
}

function todayDividerHtml() {
  return '<div class="birthday-day-divider birthday-today-anchor">Today</div>';
}

function fmtDateForBirthdayList(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function describeBirthdayOffset(days) {
  if (days === 0) return '<strong>Today!</strong>';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `in ${days} days`;
}

function getAgeOnOccurrence(dateStr, occurrence) {
  const bd = parseDate(dateStr);
  if (!bd || !occurrence) return null;
  return occurrence.getFullYear() - bd.getFullYear();
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysBetween(target, base) {
  return Math.round((target - base) / (1000 * 60 * 60 * 24));
}
/** Parse a YYYY-MM-DD string without timezone shift. */
function parseDate(dateStr) {
  if (!dateStr) return null;
  // Append T12:00:00 so noon UTC — no timezone can shift it to a different day
  const d = new Date(dateStr + 'T12:00:00');
  return isNaN(d) ? null : d;
}

function renderByBranch(container, households) {
  const groups = {};
  for (const h of households) {
    const branch = h.branch || 'Other';
    if (!groups[branch]) groups[branch] = [];
    groups[branch].push(h);
  }

  let html = '';
  for (const [branch, members] of Object.entries(groups).sort()) {
    html += `<div class="branch-header">${esc(branch)} Branch</div>`;
    html += members.map(h => householdCard(h)).join('');
  }
  container.innerHTML = html || '<p class="loading">No results found.</p>';
}

function householdCard(h) {
  const primary = h.members[0];
  const spouse = h.members[1];

  // Build display name (deceased shown greyed with cross)
  function nameHtml(person) {
    if (person.deceased) {
      return `<span class="deceased-name">${esc(person.firstName)} ✝</span>`;
    }
    return esc(person.firstName);
  }
  let displayName = '';
  if (spouse) {
    const sameLast = (primary.lastName || '') === (spouse.lastName || '');
    if (sameLast || !spouse.lastName) {
      // Same last name: "John & Jane Smith"
      displayName = `${nameHtml(primary)} &amp; ${nameHtml(spouse)} ${esc(primary.lastName || '')}`;
    } else {
      // Different last names: "John Smith & Jane Doe"
      displayName = `${nameHtml(primary)} ${esc(primary.lastName || '')} &amp; ${nameHtml(spouse)} ${esc(spouse.lastName || '')}`;
    }
  } else {
    displayName = `${nameHtml(primary)} ${esc(primary.lastName || '')}`;
  }

  let html = `<div class="family-card${hasBirthdaySoon(h) ? ' birthday-soon' : ''}">`;
  html += `<div class="card-header">`;
  html += `<span class="card-name">${displayName.trim()}</span>`;
  html += `<span class="card-header-right">`;
  html += `<a class="card-tree-link" href="#" data-person-id="${primary.personId}" title="View in Family Tree">&#x1f333;</a>`;
  if (h.branch) html += `<span class="card-branch">${esc(h.branch)}</span>`;
  html += `</span>`;
  html += `</div>`;

  // Address (from primary — shared household)
  const addr = primary.address || spouse?.address;
  if (addr || primary.city) {
    const full = [addr, [primary.city || spouse?.city, primary.state || spouse?.state]
      .filter(Boolean).join(', '), primary.zip || spouse?.zip]
      .filter(Boolean).join(', ');
    html += `<div class="card-detail"><span class="label">Addr</span> ${esc(full)}</div>`;
  }

  // Phones
  const phone = primary.phone || spouse?.phone;
  if (phone) {
    html += `<div class="card-detail"><span class="label">Home</span> <a href="tel:${phone}">${esc(phone)}</a></div>`;
  }
  for (const m of h.members) {
    if (m.cell) {
      html += `<div class="card-detail"><span class="label">${esc(m.firstName)}</span> <a href="tel:${m.cell}">${esc(m.cell)}</a></div>`;
    }
  }

  // Emails
  for (const m of h.members) {
    if (m.email) {
      html += `<div class="card-detail"><span class="label">${esc(m.firstName)}</span> <a href="mailto:${m.email}">${esc(m.email)}</a></div>`;
    }
  }

  // Birthdays
  const bdays = [];
  for (const m of h.members) {
    if (m.birthday) {
      const days = daysUntilBirthday(m.birthday);
      let label = fmtBday(m.birthday);
      if (days !== null && days <= 30) {
        label += ` <span class="birthday-badge">${days === 0 ? 'Today!' : `in ${days}d`}</span>`;
      }
      bdays.push(`${m.firstName}: ${label}`);
    }
  }
  if (bdays.length) {
    html += `<div class="card-detail"><span class="label">Bday</span> ${bdays.join(' &bull; ')}</div>`;
  }

  // Death dates
  for (const m of h.members) {
    if (m.deceased && m.deathDate) {
      html += `<div class="card-detail"><span class="label">Died</span> <span class="deceased-name">${esc(m.firstName)}: ${fmtBday(m.deathDate)}</span></div>`;
    }
  }

  // Anniversary
  const anniv = primary.anniversary || spouse?.anniversary;
  if (anniv) {
    html += `<div class="card-detail"><span class="label">Anniv</span> ${fmtBday(anniv)}</div>`;
  }

  // Children — all shown, each links to their own card
  if (h.children.length) {
    const kidLinks = h.children.map(c => {
      const name = esc(c.firstName);
      const deceased = c.deceased ? ' deceased-name' : '';
      const cross = c.deceased ? ' ✝' : '';
      // Link: if child has a spouse, they have their own card — scroll to it
      // Otherwise link to tree view
      const spouse = c.spouseId ? peopleById[c.spouseId] : null;
      const displayLast = c.lastName !== (primary.lastName || spouse?.lastName || '') ? ` ${esc(c.lastName)}` : '';
      return `<a href="#" class="child-link${deceased}" data-person-id="${c.personId}">${name}${displayLast}${cross}</a>`;
    }).join(', ');
    html += `<div class="card-children"><strong>Children:</strong> ${kidLinks}</div>`;
  }

  html += `</div>`;
  return html;
}

function renderPrintDirectory(households) {
  const wrap = ensurePrintDirectory();
  const rows = households.map(h => printDirectoryRow(h)).join('');
  const printedDate = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  wrap.innerHTML = `
    <div class="print-directory-title">Schulte Family Directory</div>
    <div class="print-directory-meta">${households.length} households - printed ${esc(printedDate)}</div>
    <table class="print-directory-table">
      <thead>
        <tr>
          <th>Household</th>
          <th>Mailing Address</th>
          <th>Phone</th>
          <th>Email</th>
          <th>Dates</th>
          <th>Branch</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6">No directory entries found.</td></tr>'}</tbody>
    </table>`;
}

function ensurePrintDirectory() {
  let wrap = document.getElementById('print-directory-list');
  if (wrap) return wrap;

  wrap = document.createElement('div');
  wrap.id = 'print-directory-list';
  wrap.className = 'print-directory-wrap';
  const list = document.getElementById('directory-list');
  if (list && list.parentNode) list.parentNode.insertBefore(wrap, list.nextSibling);
  return wrap;
}

function printDirectoryRow(h) {
  return `
    <tr>
      <td>${esc(householdNameText(h))}</td>
      <td>${linesHtml(householdAddressLines(h))}</td>
      <td>${linesHtml(householdPhoneLines(h))}</td>
      <td>${linesHtml(householdEmailLines(h))}</td>
      <td>${linesHtml(householdDateLines(h))}</td>
      <td>${esc(h.branch || '')}</td>
    </tr>`;
}

function householdNameText(h) {
  const [primary, spouse] = h.members;
  if (!spouse) return personFullNameText(primary);

  const sameLast = (primary.lastName || '') === (spouse.lastName || '');
  if (sameLast || !spouse.lastName) {
    return `${personFirstNameText(primary)} & ${personFirstNameText(spouse)} ${primary.lastName || ''}`.trim();
  }
  return `${personFullNameText(primary)} & ${personFullNameText(spouse)}`.trim();
}

function personFirstNameText(person) {
  return `${person.firstName || ''}${person.deceased ? ' (dec.)' : ''}`;
}

function personFullNameText(person) {
  return `${person.firstName || ''} ${person.lastName || ''}${person.deceased ? ' (dec.)' : ''}`.trim();
}

function householdAddressLines(h) {
  const primary = h.members[0];
  const spouse = h.members[1];
  const address = primary.address || spouse?.address || '';
  const city = primary.city || spouse?.city || '';
  const state = primary.state || spouse?.state || '';
  const zip = primary.zip || spouse?.zip || '';
  const cityState = [city, state].filter(Boolean).join(', ');
  return [address, [cityState, zip].filter(Boolean).join(' ')].filter(Boolean);
}

function householdPhoneLines(h) {
  const primary = h.members[0];
  const spouse = h.members[1];
  const lines = [];
  const home = primary.phone || spouse?.phone;
  if (home) lines.push(`Home: ${home}`);
  for (const m of h.members) {
    if (m.cell) lines.push(`${m.firstName}: ${m.cell}`);
  }
  return lines;
}

function householdEmailLines(h) {
  return h.members
    .filter(m => m.email)
    .map(m => `${m.firstName}: ${m.email}`);
}

function householdDateLines(h) {
  const lines = [];
  for (const m of h.members) {
    if (m.birthday) lines.push(`${m.firstName} bday: ${fmtMonthDay(m.birthday)}`);
  }
  const anniv = h.members[0].anniversary || h.members[1]?.anniversary;
  if (anniv) lines.push(`Anniv: ${fmtMonthDay(anniv)}`);
  return lines;
}

function linesHtml(lines) {
  return lines.filter(Boolean).map(esc).join('<br>');
}

function fmtMonthDay(dateStr) {
  if (!dateStr) return '';
  try {
    const d = parseDate(dateStr);
    if (!d) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}
function hasBirthdaySoon(h) {
  return h.members.some(m => {
    const d = daysUntilBirthday(m.birthday);
    return d !== null && d <= 30;
  });
}

function daysUntilBirthday(dateStr) {
  if (!dateStr) return null;
  try {
    const d = parseDate(dateStr);
    if (!d) return null;
    const today = startOfToday();
    const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
    return daysBetween(thisYear, today);
  } catch { return null; }
}

function fmtBday(dateStr) {
  if (!dateStr) return '';
  try {
    const d = parseDate(dateStr);
    if (!d) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
