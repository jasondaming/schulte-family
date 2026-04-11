/**
 * Family Tree view — interactive collapsible tree.
 *
 * Shows the tree organized by branch. Users can expand/collapse branches
 * to navigate without being overwhelmed by 300+ people at once.
 */

let allPeople = [];
let peopleById = {};
let treeRoot = null;
let expandedNodes = new Set();

export function initTree(people) {
  allPeople = people;
  peopleById = {};
  for (const p of people) peopleById[p.personId] = p;
  treeRoot = buildTree();

  // Auto-expand the root and Gen 1
  if (treeRoot) {
    expandedNodes.add(treeRoot.id);
    for (const child of treeRoot.children) {
      expandedNodes.add(child.id);
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
    expandAll();
    renderTree();
  };
  document.getElementById('tree-zoom-out').onclick = () => {
    collapseAll();
    renderTree();
  };
  document.getElementById('tree-zoom-reset').onclick = () => {
    expandedNodes.clear();
    if (treeRoot) {
      expandedNodes.add(treeRoot.id);
      for (const child of treeRoot.children) {
        expandedNodes.add(child.id);
      }
    }
    renderTree();
  };
}

function expandAll() {
  function walk(node) {
    expandedNodes.add(node.id);
    for (const c of node.children) walk(c);
  }
  if (treeRoot) walk(treeRoot);
}

function collapseAll() {
  expandedNodes.clear();
  if (treeRoot) expandedNodes.add(treeRoot.id);
}

/**
 * Build tree structure. Each node = { id, person, spouse, children: [node...] }
 */
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

    // Find children whose parentId matches this person or spouse
    const childPeople = allPeople.filter(p => {
      if (visited.has(p.personId)) return false;
      return p.parentId == person.personId || (spouse && p.parentId == spouse.personId);
    });

    childPeople.sort((a, b) => a.personId - b.personId);

    const children = childPeople
      .map(c => buildNode(c))
      .filter(Boolean);

    return {
      id: person.personId,
      person,
      spouse,
      children,
    };
  }

  return buildNode(rootPerson);
}

/**
 * Render the tree as nested HTML (not SVG) — much more manageable.
 */
function renderTree() {
  const container = document.getElementById('tree-container');
  if (!treeRoot) {
    container.innerHTML = '<p class="loading">No family tree data available.</p>';
    return;
  }

  container.innerHTML = `<div class="tree-html">${renderNode(treeRoot, 0)}</div>`;

  // Attach click handlers for expand/collapse
  container.querySelectorAll('.tree-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = Number(btn.dataset.nodeId);
      if (expandedNodes.has(nodeId)) {
        expandedNodes.delete(nodeId);
      } else {
        expandedNodes.add(nodeId);
      }
      renderTree();
    });
  });
}

function renderNode(node, depth) {
  const p = node.person;
  const s = node.spouse;
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;

  // Build display name
  let name;
  if (s) {
    const sLastName = s.lastName !== p.lastName ? ` ${s.lastName || ''}` : '';
    name = `${p.firstName} &amp; ${s.firstName}${sLastName} ${p.lastName || ''}`.trim();
  } else {
    name = `${esc(p.firstName)} ${esc(p.lastName || '')}`.trim();
  }

  const location = p.city && p.state ? `${esc(p.city)}, ${esc(p.state)}` : '';
  const gen = p.generation || 0;
  const genClass = `gen-${Math.min(gen, 4)}`;
  const decClass = p.deceased ? ' deceased' : '';
  const childCount = hasChildren ? ` <span class="child-count">(${countDescendants(node)})</span>` : '';

  let html = `<div class="tree-item ${genClass}${decClass}" style="margin-left: ${depth * 24}px">`;

  // Toggle button
  if (hasChildren) {
    html += `<button class="tree-toggle" data-node-id="${node.id}">${isExpanded ? '&#9660;' : '&#9654;'}</button>`;
  } else {
    html += `<span class="tree-toggle-spacer"></span>`;
  }

  // Node content
  html += `<div class="tree-item-content">`;
  html += `<span class="tree-item-name">${name}</span>`;
  if (hasChildren) html += childCount;
  if (location) html += ` <span class="tree-item-loc">${location}</span>`;
  html += `</div>`;
  html += `</div>`;

  // Render children if expanded
  if (hasChildren && isExpanded) {
    for (const child of node.children) {
      html += renderNode(child, depth + 1);
    }
  }

  return html;
}

function countDescendants(node) {
  let count = 0;
  for (const child of node.children) {
    count += 1;
    if (child.spouse) count += 1;
    count += countDescendants(child);
  }
  return count;
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
