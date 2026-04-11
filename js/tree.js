/**
 * Family Tree — top-down card-based visual tree.
 *
 * Each node is a card (person/couple). Children are arranged in a row below
 * their parent, connected by CSS-drawn lines. Branches collapse/expand.
 *
 * Layout: nested <ul><li> structure — CSS pseudo-elements draw the connectors.
 */

let allPeople = [];
let peopleById = {};
let treeRoot = null;
let expandedNodes = new Set();

// One distinct color per Gen-1 branch (Schulte siblings)
const BRANCH_PALETTE = [
  '#2d5a27', // forest green
  '#1a6b8a', // ocean blue
  '#7a3b10', // warm brown
  '#6b2d8b', // purple
  '#8b6914', // gold
  '#1a7a55', // teal
  '#8b2020', // brick red
  '#3a5a8b', // slate blue
  '#4a7a2d', // olive green
  '#8b4a6b', // mauve
];

// Dismiss tooltips when navigating away from the tree view
window.addEventListener('hashchange', dismissTooltip);

export function initTree(people) {
  allPeople = people;
  peopleById = {};
  for (const p of people) peopleById[p.personId] = p;
  treeRoot = buildTree();

  // Default: root + Gen 1 + Gen 2 (the 12 and their children visible)
  expandedNodes.clear();
  if (treeRoot) {
    expandedNodes.add(treeRoot.id);
    for (const child of treeRoot.children) {
      expandedNodes.add(child.id);
      for (const grandchild of child.children) {
        expandedNodes.add(grandchild.id);
      }
    }
  }

  setupControls();
  renderTree();
}

export function updateTree(people) {
  allPeople = people;
  peopleById = {};
  for (const p of people) peopleById[p.personId] = p;
  treeRoot = buildTree();
  renderTree();
}

function setupControls() {
  document.getElementById('tree-zoom-in').onclick = () => {
    expandAll(treeRoot);
    renderTree();
  };
  document.getElementById('tree-zoom-out').onclick = () => {
    expandedNodes.clear();
    if (treeRoot) expandedNodes.add(treeRoot.id);
    renderTree();
  };
  document.getElementById('tree-zoom-reset').onclick = () => {
    expandedNodes.clear();
    if (treeRoot) {
      expandedNodes.add(treeRoot.id);
      for (const c of treeRoot.children) {
        expandedNodes.add(c.id);
        for (const gc of c.children) expandedNodes.add(gc.id);
      }
    }
    renderTree();
  };
}

function expandAll(node) {
  if (!node) return;
  expandedNodes.add(node.id);
  for (const c of node.children) expandAll(c);
}

// === Tree data structure ===

function buildTree() {
  const roots = allPeople.filter(p => !p.parentId && p.generation === 0);
  const rootPerson = roots.find(p => p.spouseId) || roots[0];
  if (!rootPerson) return null;

  const visited = new Set();

  function buildNode(person) {
    if (!person || visited.has(person.personId)) return null;
    visited.add(person.personId);

    const spouse = person.spouseId ? peopleById[person.spouseId] : null;
    if (spouse) visited.add(spouse.personId);

    const childPeople = allPeople.filter(p => {
      if (visited.has(p.personId)) return false;
      return p.parentId == person.personId || (spouse && p.parentId == spouse.personId);
    }).sort((a, b) => a.personId - b.personId);

    return {
      id: person.personId,
      person,
      spouse,
      children: childPeople.map(c => buildNode(c)).filter(Boolean),
    };
  }

  return buildNode(rootPerson);
}

// === Rendering ===

function renderTree() {
  const container = document.getElementById('tree-container');
  if (!treeRoot) {
    container.innerHTML = '<p class="loading">No family tree data available.</p>';
    return;
  }

  // Preserve scroll position across re-renders
  const scrollEl = container.querySelector('.tree-scroll');
  const savedScrollLeft = scrollEl ? scrollEl.scrollLeft : 0;
  const savedScrollTop = scrollEl ? scrollEl.scrollTop : 0;

  container.innerHTML = `
    <div class="tree-scroll">
      <div class="tree-wrap">
        <ul class="tree-root">
          ${renderNode(treeRoot, 0, 0)}
        </ul>
      </div>
    </div>`;

  // Restore scroll position
  const newScrollEl = container.querySelector('.tree-scroll');
  if (newScrollEl) {
    newScrollEl.scrollLeft = savedScrollLeft;
    newScrollEl.scrollTop = savedScrollTop;
  }

  // Toggle expand/collapse
  container.querySelectorAll('.tc-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const nodeId = Number(btn.closest('.tc').dataset.nodeId);
      if (expandedNodes.has(nodeId)) {
        expandedNodes.delete(nodeId);
      } else {
        expandedNodes.add(nodeId);
      }
      renderTree();
    });
  });

  // Click card to show quick-info tooltip
  container.querySelectorAll('.tc').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('tc-toggle') || e.target.closest('.tc-toggle')) return;
      const nodeId = Number(card.dataset.nodeId);
      showCardTooltip(card, nodeId);
    });
  });

  // Close tooltip when clicking outside or scrolling
  // Use a named handler to avoid accumulating listeners
  document.removeEventListener('click', dismissTooltip);
  document.addEventListener('click', dismissTooltip);
  const scrollArea = container.querySelector('.tree-scroll');
  if (scrollArea) scrollArea.addEventListener('scroll', dismissTooltip);
}

function renderNode(node, depth, branchIdx) {
  const p = node.person;
  const s = node.spouse;
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;

  // Assign branch color: root uses palette[0], Gen-1 children each get a unique hue
  const color = depth === 0
    ? BRANCH_PALETTE[0]
    : BRANCH_PALETTE[branchIdx % BRANCH_PALETTE.length];

  const initials = getInitials(p, s);
  const names   = getDisplayNames(p, s);
  const loc     = p.city ? (p.state ? `${esc(p.city)}, ${esc(p.state)}` : esc(p.city)) : '';
  const birthYr = p.birthday ? p.birthday.slice(0, 4) : '';
  const deathYr = p.deathDate ? p.deathDate.slice(0, 4) : '';
  const genNum  = Math.min(p.generation || 0, 4);

  const decClass    = p.deceased ? ' tc-deceased' : '';
  const expandClass = isExpanded ? ' tc-open' : '';

  let html = `<li>`;

  // Card
  html += `<div class="tc tc-gen${genNum}${decClass}${expandClass}" data-node-id="${node.id}" style="--cc:${color}">`;
  html += `  <div class="tc-av" style="background:${color}">${initials}</div>`;
  html += `  <div class="tc-nm">${names}</div>`;
  if (loc) html += `  <div class="tc-lc">${loc}</div>`;
  if (p.deceased && deathYr) {
    html += `  <div class="tc-yr">${birthYr ? birthYr + '–' : '†'}${deathYr}</div>`;
  } else if (birthYr) {
    html += `  <div class="tc-yr">b.&nbsp;${birthYr}</div>`;
  }
  if (hasChildren) {
    const desc = countDescendants(node);
    html += `  <button class="tc-toggle">${isExpanded ? '▲' : `▼&thinsp;${node.children.length}`}</button>`;
  }
  html += `</div>`;

  // Children
  if (hasChildren && isExpanded) {
    html += `<ul>`;
    for (let i = 0; i < node.children.length; i++) {
      // Pass branch index: at depth 0 each child gets unique color; deeper inherits parent's
      const childBranchIdx = depth === 0 ? i + 1 : branchIdx;
      html += renderNode(node.children[i], depth + 1, childBranchIdx);
    }
    html += `</ul>`;
  }

  html += `</li>`;
  return html;
}

// === Card tooltip (click to see full info) ===

function showCardTooltip(cardEl, nodeId) {
  dismissTooltip();

  const node = findNode(treeRoot, nodeId);
  if (!node) return;

  const p = node.person;
  const s = node.spouse;

  const rows = [];
  const addRow = (label, val) => val ? rows.push(`<tr><td>${label}</td><td>${esc(val)}</td></tr>`) : null;

  const addPerson = (person, label) => {
    if (!person) return;
    rows.push(`<tr class="tt-person-row"><td colspan="2">${label}</td></tr>`);
    addRow('Phone', person.phone);
    addRow('Cell',  person.cell);
    addRow('Email', person.email);
    if (person.address) addRow('Address', [person.address, person.city, person.state, person.zip].filter(Boolean).join(', '));
    if (person.birthday) addRow('Birthday', formatDate(person.birthday));
    if (person.deceased) addRow('Died', formatDate(person.deathDate) || '');
  };

  addPerson(p, `${p.firstName} ${p.lastName}`);
  if (s) addPerson(s, `${s.firstName} ${s.lastName}`);
  if (p.anniversary) addRow('Anniversary', formatDate(p.anniversary));

  if (!rows.length) return;

  const tip = document.createElement('div');
  tip.className = 'tree-tooltip';
  tip.innerHTML = `<table class="tt-table">${rows.join('')}</table>`;
  tip.dataset.tipFor = nodeId;

  document.body.appendChild(tip);

  // Position near the card
  const rect = cardEl.getBoundingClientRect();
  const tipW = 260;
  let left = rect.left + window.scrollX + rect.width / 2 - tipW / 2;
  let top  = rect.bottom + window.scrollY + 8;

  // Keep within viewport
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
  if (top + 200 > window.innerHeight + window.scrollY) {
    top = rect.top + window.scrollY - 8;
    tip.style.transform = 'translateY(-100%)';
  }

  tip.style.left = left + 'px';
  tip.style.top  = top + 'px';
  tip.style.width = tipW + 'px';
}

function dismissTooltip() {
  document.querySelectorAll('.tree-tooltip').forEach(t => t.remove());
}

function findNode(node, id) {
  if (!node) return null;
  if (node.id == id) return node;
  for (const c of node.children) {
    const found = findNode(c, id);
    if (found) return found;
  }
  return null;
}

// === Helpers ===

function getInitials(p, s) {
  const pi = (p.firstName || '').charAt(0).toUpperCase();
  if (!s) return pi;
  const si = (s.firstName || '').charAt(0).toUpperCase();
  return pi + si;
}

function getDisplayNames(p, s) {
  if (!s) return `${esc(p.firstName)}<br><span class="tc-last">${esc(p.lastName || '')}</span>`;
  const sameLastName = s.lastName === p.lastName;
  const coupleNames = `${esc(p.firstName)} &amp; ${esc(s.firstName)}`;
  return `${coupleNames}<br><span class="tc-last">${esc(p.lastName || '')}</span>`;
}

function countDescendants(node) {
  let n = 0;
  for (const c of node.children) {
    n += 1 + (c.spouse ? 1 : 0) + countDescendants(c);
  }
  return n;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const [y, m, d] = iso.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m)-1]} ${parseInt(d)}, ${y}`;
  } catch { return iso; }
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
