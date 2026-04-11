/**
 * Directory view — searchable, filterable person cards.
 * Data is person-centric: one entry per person, linked by SpouseID/ParentID.
 */

let allPeople = [];
let peopleById = {};
let currentFilter = 'all';

export function initDirectory(people) {
  allPeople = people;
  peopleById = {};
  for (const p of people) {
    peopleById[p.personId] = p;
  }

  document.getElementById('search-input').addEventListener('input', () => render());

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

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
      const searchable = h.members.map(m =>
        [m.firstName, m.lastName, m.city, m.state, m.email, m.cell, m.phone]
          .filter(Boolean).join(' ')
      ).join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }

  if (currentFilter === 'upcoming') {
    renderUpcomingBirthdays(container);
    return;
  }

  if (currentFilter === 'branch') {
    renderByBranch(container, households);
  } else {
    container.innerHTML = households.length
      ? households.map(h => householdCard(h)).join('')
      : '<p class="loading">No results found.</p>';
  }
}

/**
 * Group people into households: couples live together, singles are their own household.
 * Avoids showing the same couple twice.
 */
function buildHouseholds() {
  const seen = new Set();
  const households = [];

  for (const p of allPeople) {
    if (seen.has(p.personId) || p.deceased) continue;
    seen.add(p.personId);

    const members = [p];
    // Add spouse if exists and not deceased
    if (p.spouseId && peopleById[p.spouseId] && !peopleById[p.spouseId].deceased) {
      const spouse = peopleById[p.spouseId];
      members.push(spouse);
      seen.add(spouse.personId);
    }

    // Find children (people whose parentId = this person or spouse)
    const childIds = new Set();
    const children = allPeople.filter(c => {
      if (c.deceased) return false;
      const isChild = members.some(m => c.parentId == m.personId);
      if (isChild && !childIds.has(c.personId)) {
        childIds.add(c.personId);
        return true;
      }
      return false;
    });

    // Only include children who don't have their own household (no spouse, no address)
    const dependentChildren = children.filter(c =>
      !c.spouseId && !c.address && !c.cell && !c.email
    );

    households.push({
      members,
      children: dependentChildren,
      branch: p.branch || (p.spouseId && peopleById[p.spouseId]?.branch) || '',
    });
  }

  return households;
}

function renderUpcomingBirthdays(container) {
  // Collect all living people with birthdays in the next 60 days
  const upcoming = [];
  for (const p of allPeople) {
    if (p.deceased || !p.birthday) continue;
    const days = daysUntilBirthday(p.birthday);
    if (days !== null && days <= 60) {
      upcoming.push({ person: p, days });
    }
  }
  upcoming.sort((a, b) => a.days - b.days);

  if (upcoming.length === 0) {
    container.innerHTML = '<p class="loading">No upcoming birthdays in the next 60 days.</p>';
    return;
  }

  let html = '<div class="birthday-list">';
  for (const { person: p, days } of upcoming) {
    const name = `${esc(p.firstName)} ${esc(p.lastName || '')}`.trim();
    const dateStr = fmtBday(p.birthday);
    const age = getUpcomingAge(p.birthday);
    let when;
    if (days === 0) when = '<strong>Today!</strong>';
    else if (days === 1) when = 'Tomorrow';
    else when = `in ${days} days`;

    html += `<div class="birthday-row${days <= 7 ? ' birthday-soon' : ''}">`;
    html += `<span class="birthday-row-name">${name}</span>`;
    html += `<span class="birthday-row-date">${dateStr}${age ? ` (turning ${age})` : ''}</span>`;
    html += `<span class="birthday-row-when">${when}</span>`;
    html += `</div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

function getUpcomingAge(dateStr) {
  if (!dateStr) return null;
  try {
    const bd = new Date(dateStr);
    if (isNaN(bd)) return null;
    const today = new Date();
    let age = today.getFullYear() - bd.getFullYear();
    const thisYearBd = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
    if (thisYearBd < today) age += 1; // birthday already passed, so next year
    return age;
  } catch { return null; }
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

  // Build display name
  let displayName = '';
  if (spouse) {
    displayName = `${primary.firstName} & ${spouse.firstName} ${primary.lastName || spouse.lastName || ''}`;
  } else {
    displayName = `${primary.firstName} ${primary.lastName || ''}`;
  }

  let html = `<div class="family-card${hasBirthdaySoon(h) ? ' birthday-soon' : ''}">`;
  html += `<div class="card-header">`;
  html += `<span class="card-name">${esc(displayName.trim())}</span>`;
  if (h.branch) html += `<span class="card-branch">${esc(h.branch)}</span>`;
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

  // Anniversary
  const anniv = primary.anniversary || spouse?.anniversary;
  if (anniv) {
    html += `<div class="card-detail"><span class="label">Anniv</span> ${fmtBday(anniv)}</div>`;
  }

  // Dependent children
  if (h.children.length) {
    const kidStr = h.children.map(c => {
      let s = c.firstName;
      if (c.birthday) {
        const days = daysUntilBirthday(c.birthday);
        s += ` (${fmtBday(c.birthday)})`;
        if (days !== null && days <= 30) {
          s += ` <span class="birthday-badge">${days === 0 ? 'Today!' : `in ${days}d`}</span>`;
        }
      }
      return s;
    }).join(', ');
    html += `<div class="card-children"><strong>Children:</strong> ${kidStr}</div>`;
  }

  html += `</div>`;
  return html;
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
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    const today = new Date();
    const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
    return Math.round((thisYear - today) / (1000 * 60 * 60 * 24));
  } catch { return null; }
}

function fmtBday(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
