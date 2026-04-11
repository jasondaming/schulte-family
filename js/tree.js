/**
 * Family Tree view — SVG-based interactive tree built from person-centric data.
 *
 * Each person has a parentId linking to their Schulte-line parent.
 * Spouses are shown as joined nodes.
 * The tree follows parentId chains from root (Sylvia) down through generations.
 */

let treeRoot = null;
let zoom = 1;
let peopleById = {};

const NODE_W = 160;
const NODE_H = 52;
const COUPLE_W = 280;
const H_GAP = 20;
const V_GAP = 70;

export function initTree(people) {
  buildPeopleIndex(people);
  treeRoot = buildTree(people);
  setupControls();
  renderTree();
}

export function updateTree(people) {
  buildPeopleIndex(people);
  treeRoot = buildTree(people);
  renderTree();
}

function buildPeopleIndex(people) {
  peopleById = {};
  for (const p of people) peopleById[p.personId] = p;
}

function setupControls() {
  document.getElementById('tree-zoom-in').onclick = () => { zoom = Math.min(zoom + 0.15, 2); renderTree(); };
  document.getElementById('tree-zoom-out').onclick = () => { zoom = Math.max(zoom - 0.15, 0.2); renderTree(); };
  document.getElementById('tree-zoom-reset').onclick = () => { zoom = 1; renderTree(); };
}

/**
 * Build a tree from person data.
 * Each node represents a person (or couple). Children are linked via parentId.
 */
function buildTree(people) {
  // Find root (generation 0, no parentId)
  const roots = people.filter(p => !p.parentId && p.generation === 0);
  // Find the Schulte-line root (not the married-in spouse)
  const rootPerson = roots.find(p => p.parentId === null || p.parentId === '') || roots[0];

  if (!rootPerson) return null;

  // Build tree nodes recursively
  // A node = { person, spouse, children: [node, ...] }
  const visited = new Set();

  function buildNode(person) {
    if (!person || visited.has(person.personId)) return null;
    visited.add(person.personId);

    const spouse = person.spouseId ? peopleById[person.spouseId] : null;
    if (spouse) visited.add(spouse.personId);

    // Find children: people whose parentId matches this person or spouse
    const childPeople = people.filter(p => {
      if (visited.has(p.personId)) return false;
      return p.parentId == person.personId || (spouse && p.parentId == spouse.personId);
    });

    // Sort children by generation then personId
    childPeople.sort((a, b) => a.personId - b.personId);

    const children = childPeople
      .map(c => buildNode(c))
      .filter(Boolean);

    return { person, spouse, children };
  }

  return buildNode(rootPerson);
}

/**
 * Layout and render the tree.
 */
function renderTree() {
  const container = document.getElementById('tree-container');
  if (!treeRoot) {
    container.innerHTML = '<p class="loading">No family tree data available.</p>';
    return;
  }

  const positions = new Map();
  let nextX = [20]; // global x cursor (array for mutability in closure)

  function layoutNode(node, depth) {
    const y = 20 + depth * (NODE_H + V_GAP);
    const w = node.spouse ? COUPLE_W : NODE_W;

    if (node.children.length === 0) {
      positions.set(node, { x: nextX[0], y, w });
      nextX[0] += w + H_GAP;
      return;
    }

    for (const child of node.children) {
      layoutNode(child, depth + 1);
    }

    const first = positions.get(node.children[0]);
    const last = positions.get(node.children[node.children.length - 1]);
    const childCenter = (first.x + first.w / 2 + last.x + last.w / 2) / 2;
    const x = childCenter - w / 2;

    // Ensure no overlap: x must be >= nextX at this depth
    const finalX = Math.max(x, nextX[0] > 20 ? nextX[0] : x);
    positions.set(node, { x: finalX, y, w });

    // If we shifted right, shift children too
    if (finalX > x) {
      shiftSubtree(node, finalX - x, positions);
    }

    nextX[0] = Math.max(nextX[0], finalX + w + H_GAP);
  }

  function shiftSubtree(node, dx, pos) {
    for (const child of node.children) {
      const cp = pos.get(child);
      if (cp) {
        cp.x += dx;
        shiftSubtree(child, dx, pos);
      }
    }
  }

  layoutNode(treeRoot, 0);

  // Find bounds
  let maxX = 0, maxY = 0;
  for (const pos of positions.values()) {
    maxX = Math.max(maxX, pos.x + pos.w);
    maxY = Math.max(maxY, pos.y + NODE_H);
  }

  const totalW = (maxX + 40) * zoom;
  const totalH = (maxY + 40) * zoom;

  let nodesHtml = '';
  let svgLines = '';

  for (const [node, pos] of positions) {
    const x = pos.x * zoom;
    const y = pos.y * zoom;
    const w = pos.w * zoom;
    const h = NODE_H * zoom;
    const fontSize = Math.max(0.55, 0.75 * zoom);

    const gen = node.person.generation || 0;
    const genClass = `generation-${Math.min(gen, 3)}`;
    const decClass = node.person.deceased ? ' deceased' : '';

    if (node.spouse) {
      // Render as couple node
      const p = node.person;
      const s = node.spouse;
      const name1 = `${p.firstName} ${p.lastName || ''}`.trim();
      const name2 = `${s.firstName} ${s.lastName !== p.lastName ? (s.lastName || '') : ''}`.trim();
      const location = p.city && p.state ? `${p.city}, ${p.state}` : (p.city || p.state || '');

      nodesHtml += `<div class="tree-node ${genClass}${decClass}"
        style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;font-size:${fontSize}rem;"
        title="${escAttr(name1)} & ${escAttr(name2)}">
        <div class="node-name">${escHtml(name1)} &amp; ${escHtml(name2)}</div>
        ${location ? `<div class="node-detail" style="font-size:${fontSize * 0.85}rem">${escHtml(location)}</div>` : ''}
      </div>`;
    } else {
      // Single person node
      const p = node.person;
      const name = `${p.firstName} ${p.lastName || ''}`.trim();
      const location = p.city && p.state ? `${p.city}, ${p.state}` : (p.city || p.state || '');

      nodesHtml += `<div class="tree-node ${genClass}${decClass}"
        style="left:${x}px;top:${y}px;width:${w * 0.6}px;height:${h}px;font-size:${fontSize}rem;"
        title="${escAttr(name)}">
        <div class="node-name">${escHtml(name)}</div>
        ${location ? `<div class="node-detail" style="font-size:${fontSize * 0.85}rem">${escHtml(location)}</div>` : ''}
      </div>`;
    }

    // Lines to children
    const parentCx = x + (node.spouse ? w : w * 0.6) / 2;
    const parentBot = y + h;

    for (const child of node.children) {
      const cpos = positions.get(child);
      if (!cpos) continue;
      const cw = (child.spouse ? cpos.w : cpos.w * 0.6) * zoom;
      const childCx = cpos.x * zoom + cw / 2;
      const childTop = cpos.y * zoom;
      const midY = (parentBot + childTop) / 2;

      svgLines += `<path d="M ${parentCx} ${parentBot} L ${parentCx} ${midY} L ${childCx} ${midY} L ${childCx} ${childTop}"
        fill="none" stroke="#999" stroke-width="${Math.max(1, 1.5 * zoom)}"/>`;
    }
  }

  container.innerHTML = `
    <svg width="${totalW}" height="${totalH}" style="width:${totalW}px;height:${totalH}px;">
      ${svgLines}
    </svg>
    ${nodesHtml}
  `;
  container.style.width = totalW + 'px';
  container.style.height = totalH + 'px';
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
