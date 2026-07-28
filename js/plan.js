// Rendu SVG du plan du parc (recréation stylisée du plan officiel).
// Usage : renderPlan(container, {
//   decorate(domaine) → { done: bool, badge: '❤️❤️⭐' } (facultatif),
//   onClick(domaine) (facultatif — rend les stands cliquables),
// })
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}, textContent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

function planZone(g, { x, y, w, h, fill, label, vertical, fontSize = 15, color = '#fff' }) {
  g.appendChild(svgEl('rect', { x, y, width: w, height: h, rx: 8, fill }));
  const cx = x + w / 2;
  const cy = y + h / 2;
  const attrs = {
    x: cx, y: cy, fill: color, 'font-size': fontSize, 'font-weight': 700,
    'text-anchor': 'middle', 'dominant-baseline': 'central',
  };
  if (vertical) attrs.transform = `rotate(-90 ${cx} ${cy})`;
  const lines = label.split('\n');
  if (lines.length === 1) {
    g.appendChild(svgEl('text', attrs, label));
  } else {
    const text = svgEl('text', attrs);
    lines.forEach((line, i) => {
      text.appendChild(svgEl('tspan', {
        x: cx, dy: i === 0 ? `${-(lines.length - 1) * 0.55}em` : '1.1em',
      }, line));
    });
    g.appendChild(text);
  }
}

function renderPlan(container, { decorate, onClick } = {}) {
  container.replaceChildren();

  const svg = svgEl('svg', {
    viewBox: '0 0 950 1270',
    class: 'plan-svg',
    role: 'img',
    'aria-label': 'Plan du parc de la fête des vins',
  });

  // Pelouse du parc + enceinte rose
  svg.appendChild(svgEl('path', {
    d: 'M545,60 L110,335 L40,335 L40,352 L128,352 L82,1235 L935,748 L688,330 L612,95 Z',
    fill: '#ddefdd', stroke: '#f59aa0', 'stroke-width': 7, 'stroke-linejoin': 'round',
  }));

  // Allées (traits clairs pour donner la structure du parc)
  const alleys = [
    'M210,520 L700,520', 'M210,660 L700,660', 'M210,520 L210,990',
    'M395,520 L395,990', 'M700,470 L700,660', 'M210,990 L480,990',
  ];
  for (const d of alleys) {
    svg.appendChild(svgEl('path', { d, stroke: '#f7f6f3', 'stroke-width': 14, fill: 'none' }));
  }

  const zones = svgEl('g');
  // Bâtiments et espaces (d'après le plan officiel)
  planZone(zones, { x: 95, y: 355, w: 110, h: 42, fill: '#5c2d5d', label: 'PROTECTION CIVILE', fontSize: 9 });
  planZone(zones, { x: 113, y: 430, w: 82, h: 62, fill: '#f8bbd0', label: '🧸\nGARDERIE', fontSize: 11, color: '#ad1457' });
  planZone(zones, { x: 120, y: 528, w: 58, h: 130, fill: '#5c2d5d', label: 'CHÂTEAU', vertical: true, fontSize: 13 });
  planZone(zones, { x: 118, y: 680, w: 62, h: 82, fill: '#e5387e', label: 'VINS\n&\nYOGA', fontSize: 11 });
  planZone(zones, { x: 213, y: 800, w: 32, h: 170, fill: '#f5a81c', label: 'FOOD TRUCKS', vertical: true, fontSize: 12 });
  planZone(zones, { x: 408, y: 668, w: 64, h: 38, fill: '#e63946', label: 'BAR', fontSize: 15 });
  planZone(zones, { x: 712, y: 548, w: 30, h: 92, fill: '#e5387e', label: 'SCÈNE', vertical: true, fontSize: 12 });

  // Espace VIP (ovale crème + étiquette rose)
  zones.appendChild(svgEl('ellipse', { cx: 570, cy: 772, rx: 165, ry: 52, fill: '#fdeecf' }));
  planZone(zones, { x: 545, y: 748, w: 115, h: 48, fill: '#e5387e', label: 'ESPACE VIP', fontSize: 12 });

  // Étiquettes texte
  const labels = [
    { x: 460, y: 330, text: '🍷 VILLAGE VIGNERONS', size: 17, color: '#e63946' },
    { x: 495, y: 590, text: '🍴 ESPACE RESTAURATION', size: 13, color: '#e8901a' },
    { x: 315, y: 890, text: '🍴 ESPACE RESTAURATION', size: 13, color: '#e8901a' },
    { x: 543, y: 152, text: 'ℹ️ POINT INFO', size: 12, color: '#3d6fb6' },
    { x: 478, y: 775, text: '🚻', size: 16, color: '#3d6fb6' },
    { x: 700, y: 55, text: '➜ ENTRÉE GÉNÉRALE', size: 18, color: '#6c63b5' },
    { x: 845, y: 512, text: 'SORTIE ➜', size: 18, color: '#6c63b5' },
    { x: 745, y: 280, text: 'AIRE DE CHARGEMENT', size: 11, color: '#6c63b5', rotate: 65 },
  ];
  for (const l of labels) {
    const attrs = {
      x: l.x, y: l.y, fill: l.color, 'font-size': l.size, 'font-weight': 700,
      'text-anchor': 'middle',
    };
    if (l.rotate) attrs.transform = `rotate(${l.rotate} ${l.x} ${l.y})`;
    zones.appendChild(svgEl('text', attrs, l.text));
  }
  svg.appendChild(zones);

  // Les stands du Village Vignerons
  const standsGroup = svgEl('g');
  for (const domaine of DOMAINES) {
    const pos = PLAN_POSITIONS[domaine.stand];
    if (!pos) continue;

    const deco = decorate ? decorate(domaine) : {};
    const g = svgEl('g', { class: 'plan-stand' + (onClick ? ' clickable' : '') + (deco.done ? ' done' : '') });
    g.appendChild(svgEl('title', {}, `Stand ${domaine.stand} — ${domaine.name}`));

    g.appendChild(svgEl('circle', { cx: pos.x, cy: pos.y, r: 11 }));
    g.appendChild(svgEl('text', {
      x: pos.x, y: pos.y, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': domaine.stand.length > 2 ? 6.5 : 9.5, 'font-weight': 700, class: 'stand-num',
    }, domaine.stand));

    if (deco.badge) {
      g.appendChild(svgEl('text', {
        x: pos.x, y: pos.y - 16, 'text-anchor': 'middle', 'font-size': 11, class: 'stand-badge',
      }, deco.badge));
    }

    if (onClick) {
      g.addEventListener('click', () => onClick(domaine));
    }
    standsGroup.appendChild(g);
  }
  svg.appendChild(standsGroup);

  // Légende
  const legend = svgEl('g');
  const legendItems = [
    { color: '#e63946', label: 'Stand à déguster' },
    { color: '#7cb518', label: 'Stand noté ✔' },
    { color: '#e5387e', label: 'Animations' },
    { color: '#f5a81c', label: 'Village gourmand' },
  ];
  legendItems.forEach((item, i) => {
    const y = 1035 + i * 34;
    legend.appendChild(svgEl('rect', { x: 620, y, width: 42, height: 22, rx: 4, fill: item.color }));
    legend.appendChild(svgEl('text', { x: 675, y: y + 16, 'font-size': 15, 'font-weight': 600, fill: '#2b2b2b' }, item.label));
  });
  svg.appendChild(legend);

  container.appendChild(svg);
}
