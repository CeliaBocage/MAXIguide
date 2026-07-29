// Rendu SVG de la carte réelle du vignoble gaillacois : où se trouvent
// vraiment les domaines, et ce que le groupe en a pensé.
// (Le plan du parc de la fête, lui, vit dans js/plan.js.)
//
// Usage : renderCarte(container, {
//   decorate(domaine) → { done: bool, badge: '❤️⭐', guides: ['🦄'], score: 4.2 }
//     (facultatif — score : note moyenne sur 5, elle colore la pastille),
//   onClick(domaine) (facultatif — rend les domaines cliquables),
// })
//
// Dépend de js/svg.js (svgEl), js/data/carte.js et js/data/paysage.js.

// --- Projection ---------------------------------------------------------
// Équirectangulaire : à cette latitude et sur 35 km de large, la déformation
// est invisible à l'œil, et ça évite d'embarquer une vraie lib de projection.
const CARTE_VIEW = (() => {
  const { minLon, maxLon, minLat, maxLat } = CARTE_BOUNDS;
  const width = 900;
  // Correction méridienne : un degré de longitude est plus court qu'un degré
  // de latitude, d'un facteur cos(latitude).
  const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const height = Math.round(width * (maxLat - minLat) / ((maxLon - minLon) * kx));
  return { width, height, kx };
})();

// Bandeau de légende sous la carte
const CARTE_LEGEND_H = 215;

function carteProject(lon, lat) {
  const { minLon, maxLon, minLat, maxLat } = CARTE_BOUNDS;
  return {
    x: (lon - minLon) / (maxLon - minLon) * CARTE_VIEW.width,
    y: (maxLat - lat) / (maxLat - minLat) * CARTE_VIEW.height,
  };
}

// Un pixel de la carte, en mètres sur le terrain — sert à raisonner en
// distances réelles (le rayon autour d'un domaine, par exemple).
const CARTE_M_PER_PX =
  (CARTE_BOUNDS.maxLat - CARTE_BOUNDS.minLat) * 110570 / CARTE_VIEW.height;

// --- Notes --------------------------------------------------------------
// Note moyenne d'un lot de fiches : moyenne de toutes les boissons notées
// (1–5), toutes fiches confondues. null si personne n'a noté de boisson.
const CARTE_NOTE_KEYS = ['note_blanc', 'note_rouge', 'note_rose', 'note_whisky', 'note_jus'];

function carteScore(fiches) {
  let sum = 0;
  let n = 0;
  for (const fiche of fiches) {
    for (const key of CARTE_NOTE_KEYS) {
      if (fiche[key]) { sum += fiche[key]; n++; }
    }
  }
  return n ? sum / n : null;
}

// Échelle de couleur des notes : du rosé pâle au rouge profond.
// fill/text habillent la pastille du domaine ; vine/vineEdge teintent les
// parcelles de vigne alentour, en plus clair pour rester un fond.
const CARTE_SCALE = [
  { max: 1.5, fill: '#f3d9b8', text: '#6b4a1f', vine: '#f0dcc0', vineEdge: '#d9bf9a' },
  { max: 2.5, fill: '#e6a97c', text: '#5a2c14', vine: '#eec6a4', vineEdge: '#d3a276' },
  { max: 3.5, fill: '#cf6f60', text: '#fff', vine: '#e5a79c', vineEdge: '#c87f71' },
  { max: 4.5, fill: '#a3374b', text: '#fff', vine: '#d08c98', vineEdge: '#ad6070' },
  { max: Infinity, fill: '#6e1730', text: '#fff', vine: '#b5717f', vineEdge: '#8d4354' },
];

function carteScoreColors(score) {
  return CARTE_SCALE.find(step => score <= step.max);
}

// Les vignes d'un domaine ne sont pas identifiées dans OpenStreetMap : on
// teinte donc les parcelles situées dans ce rayon autour de sa cave, ce qui
// couvre l'essentiel d'un domaine gaillacois sans prétendre à un cadastre.
const CARTE_VIGNES_RAYON_M = 1200;

// --- Surfaces (vignes, bois, eau, villages) ------------------------------
// Les anneaux de js/data/paysage.js sont stockés en dix-millièmes de degré
// depuis le coin sud-ouest du cadre : on les repasse en pixels ici.
function cartePaysagePath(ring) {
  let d = '';
  for (let i = 0; i < ring.length; i += 2) {
    const p = carteProject(
      CARTE_BOUNDS.minLon + ring[i] * PAYSAGE_UNIT,
      CARTE_BOUNDS.minLat + ring[i + 1] * PAYSAGE_UNIT
    );
    d += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }
  return d + 'Z';
}

// Centre approximatif d'un anneau, en pixels : suffisant pour savoir de quel
// domaine une parcelle est la plus proche.
function cartePaysageCentre(ring) {
  let sx = 0;
  let sy = 0;
  const n = ring.length / 2;
  for (let i = 0; i < ring.length; i += 2) {
    sx += ring[i];
    sy += ring[i + 1];
  }
  return carteProject(
    CARTE_BOUNDS.minLon + (sx / n) * PAYSAGE_UNIT,
    CARTE_BOUNDS.minLat + (sy / n) * PAYSAGE_UNIT
  );
}

// Dessine une couche de surfaces d'un seul tenant (bois, eau, villages…)
function cartePaysageCouche(rings, className) {
  const g = svgEl('g', { class: className, 'clip-path': 'url(#carte-clip)' });
  for (const ring of rings) g.appendChild(svgEl('path', { d: cartePaysagePath(ring) }));
  return g;
}

// Les parcelles de vigne : celles qui entourent un domaine noté prennent sa
// couleur, les autres gardent la teinte « vigne » neutre.
function carteVignes(rated) {
  const g = svgEl('g', { class: 'carte-vignes', 'clip-path': 'url(#carte-clip)' });
  const rayon = CARTE_VIGNES_RAYON_M / CARTE_M_PER_PX;
  for (const ring of PAYSAGE_VIGNES) {
    const path = svgEl('path', { d: cartePaysagePath(ring) });
    if (rated.length) {
      const c = cartePaysageCentre(ring);
      let near = null;
      let bestDist = rayon;
      for (const r of rated) {
        const dist = Math.hypot(c.x - r.x, c.y - r.y);
        if (dist < bestDist) { bestDist = dist; near = r; }
      }
      if (near) path.setAttribute('style', `fill:${near.colors.vine};stroke:${near.colors.vineEdge}`);
    }
    g.appendChild(path);
  }
  return g;
}

// --- Anti-chevauchement des pastilles -----------------------------------
// Une quinzaine de domaines se serrent autour de Gaillac : on écarte les
// pastilles juste assez pour qu'elles restent lisibles, en les reliant à leur
// vraie position par un fil. Purement déterministe (pas de hasard) pour que
// deux rendus successifs donnent exactement la même carte.
function carteSpread(nodes, { gap, width, height, margin }) {
  for (let step = 0; step < 300; step++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= gap) continue;
        if (dist < 0.001) {
          // Deux domaines à la même adresse : on les sépare selon un angle
          // dérivé de leur rang, donc stable d'un rendu à l'autre.
          const angle = i * 2.399963 + j;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        const push = (gap - dist) / 2;
        const ux = dx / dist * push;
        const uy = dy / dist * push;
        a.x -= ux; a.y -= uy;
        b.x += ux; b.y += uy;
      }
    }
    // Rappel élastique vers la vraie position, pour ne pas dériver plus que nécessaire
    for (const n of nodes) {
      n.x += (n.ax - n.x) * 0.05;
      n.y += (n.ay - n.y) * 0.05;
      n.x = Math.min(Math.max(n.x, margin.left), width - margin.right);
      n.y = Math.min(Math.max(n.y, margin.top), height - margin.bottom);
    }
  }
  return nodes;
}

// --- Étiquettes ---------------------------------------------------------
// Le nom d'une rivière se pose sur son passage le plus rectiligne : le faire
// suivre les méandres le rendrait illisible. On note chaque tronçon assez long
// pour porter le nom — on préfère les longs, bien droits, et libres de toute
// pastille de domaine — puis on écrit le nom le long du meilleur.
const CARTE_RIVER_WINDOW = 25; // tronçons d'au plus 25 points, au-delà ça serpente

function carteRiverLabelSpot(river, markers) {
  const pts = river.pts.map(([lon, lat]) => carteProject(lon, lat));
  const needed = river.name.length * 9 + 20; // largeur approximative du nom
  const boxes = markers.map(m => ({ x1: m.x - 13, y1: m.y - 13, x2: m.x + 13, y2: m.y + 13 }));

  let best = null;
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = i + 1; j < Math.min(pts.length, i + CARTE_RIVER_WINDOW); j++) {
      const a = pts[i];
      const b = pts[j];
      const chord = Math.hypot(b.x - a.x, b.y - a.y);
      if (chord < needed) continue;

      // Écart maximal du tracé réel à la corde : plus il est faible, plus le
      // nom collera à la rivière.
      let drift = 0;
      for (let k = i + 1; k < j; k++) {
        const p = pts[k];
        drift = Math.max(drift, Math.abs(
          (b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x
        ) / chord);
      }
      if (drift > 12) continue;

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      // Le nom doit rester dans le cadre — le Cérou ne fait que frôler le bord
      // nord, le Dadou le bord sud — et, à choisir, on le préfère au large.
      const edge = Math.min(mx, CARTE_VIEW.width - mx, my, CARTE_VIEW.height - my);
      if (edge < 22) continue;

      const box = { x1: mx - needed / 2, y1: my - 20, x2: mx + needed / 2, y2: my + 6 };
      const busy = boxes.some(bb => boxOverlap(box, bb) > 0);
      const score = chord - 4 * drift - (busy ? 400 : 0) - Math.max(0, 90 - edge) * 3;
      if (!best || score > best.score) best = { a, b, score };
    }
  }
  if (!best) return null;

  // Toujours de gauche à droite, sinon le nom s'écrirait à l'envers
  const [a, b] = best.a.x <= best.b.x ? [best.a, best.b] : [best.b, best.a];
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2 - 7, // légèrement au-dessus du trait
    angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
  };
}

function boxOverlap(a, b) {
  const dx = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const dy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return dx > 0 && dy > 0 ? dx * dy : 0;
}

// Le nom d'un village se range à droite du point, ou à gauche / dessous s'il
// tomberait sur une pastille de domaine ou sortirait du cadre.
function cartePlaceLabelSpot(place, p, markers, W) {
  const town = place.rank >= 2;
  const size = town ? 16 : 13;
  // Largeur estimée : mesurer le texte demanderait un aller-retour dans le DOM
  // pour chaque village, alors qu'une approximation suffit à choisir un côté.
  const w = place.name.length * size * 0.55;
  const gap = town ? 8 : 6;
  const boxes = markers.map(m => ({ x1: m.x - 13, y1: m.y - 13, x2: m.x + 13, y2: m.y + 13 }));

  // Du plus naturel au plus acrobatique : à droite, à gauche, dessous, dessus,
  // puis en diagonale un peu plus loin quand le voisinage est encombré.
  const far = gap + 14;
  const candidates = [
    { x: p.x + gap, y: p.y + 4, anchor: 'start' },
    { x: p.x - gap, y: p.y + 4, anchor: 'end' },
    { x: p.x, y: p.y + gap + size, anchor: 'middle' },
    { x: p.x, y: p.y - gap - 4, anchor: 'middle' },
    { x: p.x + far, y: p.y + far, anchor: 'start' },
    { x: p.x - far, y: p.y + far, anchor: 'end' },
    { x: p.x + far, y: p.y - far, anchor: 'start' },
    { x: p.x - far, y: p.y - far, anchor: 'end' },
  ];

  let best = null;
  for (const c of candidates) {
    const left = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - w : c.x - w / 2;
    const box = { x1: left, y1: c.y - size, x2: left + w, y2: c.y + 3 };
    if (box.x1 < 4 || box.x2 > W - 4) continue; // déborderait du cadre
    const cost = boxes.reduce((acc, b) => acc + boxOverlap(box, b), 0);
    if (!best || cost < best.cost) best = { ...c, cost };
    if (cost === 0) break;
  }
  return best || candidates[1];
}

// --- Rendu --------------------------------------------------------------
function renderCarte(container, { decorate, onClick } = {}) {
  container.replaceChildren();

  const { width: W, height: H } = CARTE_VIEW;
  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H + CARTE_LEGEND_H}`,
    class: 'carte-svg',
    role: 'img',
    'aria-label': t('carte.aria'),
  });

  // Fond : la campagne du Gaillacois. Le même rectangle sert de masque, pour
  // que rien ne déborde du cadre.
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, rx: 10, class: 'carte-fond' }));
  const defs = svgEl('defs');
  const clip = svgEl('clipPath', { id: 'carte-clip' });
  clip.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, rx: 10 }));
  defs.appendChild(clip);
  svg.appendChild(defs);

  // Les domaines, écartés juste ce qu'il faut pour rester lisibles. On les
  // place en premier : les parcelles de vigne se teintent d'après eux, et les
  // noms de rivières et de villages se rangeront là où ils ne passent pas
  // sous une pastille.
  const placed = [];
  for (const domaine of DOMAINES) {
    const geo = CARTE_DOMAINES[domaine.id];
    if (!geo) continue;
    const p = carteProject(geo.lon, geo.lat);
    const deco = decorate ? decorate(domaine) : {};
    placed.push({ domaine, geo, deco, ax: p.x, ay: p.y, x: p.x, y: p.y });
  }
  carteSpread(placed, {
    gap: 27, width: W, height: H,
    margin: { left: 14, right: 14, top: 26, bottom: 34 },
  });

  // Les surfaces réelles : bois, vignes, villages, plans d'eau. Les vignes
  // autour d'un domaine noté prennent la couleur de sa note (ax/ay : la vraie
  // position du domaine, pas la pastille écartée).
  const rated = placed
    .filter(n => n.deco.done && n.deco.score != null)
    .map(n => ({ x: n.ax, y: n.ay, colors: carteScoreColors(n.deco.score) }));
  svg.appendChild(cartePaysageCouche(PAYSAGE_BOIS, 'carte-bois'));
  svg.appendChild(carteVignes(rated));
  svg.appendChild(cartePaysageCouche(PAYSAGE_VILLAGES, 'carte-villages'));
  svg.appendChild(cartePaysageCouche(PAYSAGE_EAU, 'carte-eau'));

  // Rivières — le Tarn et la Vère donnent tout de suite le nord et le sud
  const waters = svgEl('g', { 'clip-path': 'url(#carte-clip)' });
  for (const river of CARTE_RIVERS) {
    const d = river.pts
      .map(([lon, lat], k) => {
        const p = carteProject(lon, lat);
        return `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');
    waters.appendChild(svgEl('path', { d, class: 'carte-water' + (river.main ? ' main' : '') }));
  }
  svg.appendChild(waters);

  // Nom des rivières, posé bien droit sur leur plus longue ligne droite
  const riverLabels = svgEl('g');
  for (const river of CARTE_RIVERS) {
    const spot = carteRiverLabelSpot(river, placed);
    if (!spot) continue;
    riverLabels.appendChild(svgEl('text', {
      x: spot.x, y: spot.y, 'text-anchor': 'middle',
      transform: `rotate(${spot.angle.toFixed(1)} ${spot.x.toFixed(1)} ${spot.y.toFixed(1)})`,
      class: 'carte-river-label',
    }, river.name));
  }
  svg.appendChild(riverLabels);

  // Villages et villes repères, placés après les domaines : leur nom se range
  // du côté où il ne passe pas sous une pastille.
  const places = svgEl('g');
  for (const place of CARTE_PLACES) {
    const p = carteProject(place.lon, place.lat);
    const town = place.rank >= 2;
    places.appendChild(svgEl('circle', {
      cx: p.x, cy: p.y, r: town ? 4.5 : 3, class: 'carte-place-dot' + (town ? ' town' : ''),
    }));
    const spot = cartePlaceLabelSpot(place, p, placed, W);
    places.appendChild(svgEl('text', {
      x: spot.x, y: spot.y, 'text-anchor': spot.anchor,
      class: 'carte-place-label' + (town ? ' town' : ''),
    }, place.name));
  }
  svg.appendChild(places);

  // Les fils qui relient chaque pastille à son emplacement réel
  const leaders = svgEl('g');
  for (const node of placed) {
    if (Math.hypot(node.x - node.ax, node.y - node.ay) < 4) continue;
    leaders.appendChild(svgEl('line', {
      x1: node.ax, y1: node.ay, x2: node.x, y2: node.y, class: 'carte-leader',
    }));
    leaders.appendChild(svgEl('circle', { cx: node.ax, cy: node.ay, r: 2, class: 'carte-anchor' }));
  }
  svg.appendChild(leaders);

  const standsGroup = svgEl('g');
  for (const node of placed) {
    const { domaine, geo, deco } = node;
    const g = svgEl('g', {
      class: 'carte-stand' + (onClick ? ' clickable' : '') + (deco.done ? ' done' : ''),
    });
    g.appendChild(svgEl('title', {}, t('carte.standTitle', {
      stand: domaine.stand, name: domaine.name, commune: geo.commune,
    })));

    // Liseré clair, pour que la pastille se détache du damier des parcelles
    g.appendChild(svgEl('circle', { cx: node.x, cy: node.y, r: 13.5, class: 'carte-halo' }));

    // Pastille : verte si notée, teintée selon la note moyenne si on en a une
    const circle = svgEl('circle', { cx: node.x, cy: node.y, r: 11, class: 'stand-dot' });
    const num = svgEl('text', {
      x: node.x, y: node.y, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': domaine.stand.length > 2 ? 6.5 : 9.5, 'font-weight': 700, class: 'stand-num',
    }, domaine.stand);
    if (deco.done && deco.score != null) {
      const colors = carteScoreColors(deco.score);
      circle.setAttribute('style', `fill:${colors.fill};stroke:#5c1424`);
      num.setAttribute('style', `fill:${colors.text}`);
    }
    g.append(circle, num);

    if (deco.badge) {
      g.appendChild(svgEl('text', {
        x: node.x, y: node.y - 16, 'text-anchor': 'middle', 'font-size': 11, class: 'stand-badge',
      }, deco.badge));
    }

    // Les emojis des participants passés par ce domaine, sous la pastille
    if (deco.guides && deco.guides.length) {
      const PER_LINE = 5;
      const text = svgEl('text', { 'text-anchor': 'middle', 'font-size': 10, class: 'stand-guides' });
      for (let i = 0; i < deco.guides.length; i += PER_LINE) {
        text.appendChild(svgEl('tspan', {
          x: node.x, y: node.y + 23 + (i / PER_LINE) * 12,
        }, deco.guides.slice(i, i + PER_LINE).join('')));
      }
      g.appendChild(text);
    }

    if (onClick) g.addEventListener('click', () => onClick(domaine));
    standsGroup.appendChild(g);
  }
  svg.appendChild(standsGroup);

  svg.appendChild(carteLegend());
  container.appendChild(svg);
}

// Légende + échelle + crédits, dans le bandeau sous la carte.
// Deux rangées : les repères du fond de carte, puis l'échelle des notes.
function carteLegend() {
  const { width: W, height: H } = CARTE_VIEW;
  const g = svgEl('g');

  // --- Rangée 1 : les repères ponctuels
  const row1 = H + 30;
  g.appendChild(svgEl('circle', { cx: 30, cy: row1, r: 11, class: 'carte-key-todo' }));
  g.appendChild(svgEl('text', { x: 52, y: row1 + 6, class: 'carte-legend-label' }, t('carte.legendTodo')));

  g.appendChild(svgEl('line', { x1: 480, y1: row1, x2: 524, y2: row1, class: 'carte-water main' }));
  g.appendChild(svgEl('text', { x: 534, y: row1 + 6, class: 'carte-legend-label' }, t('carte.legendRiver')));

  g.appendChild(svgEl('circle', { cx: 680, cy: row1, r: 4.5, class: 'carte-place-dot town' }));
  g.appendChild(svgEl('text', { x: 694, y: row1 + 6, class: 'carte-legend-label' }, t('carte.legendVillage')));

  // --- Rangée 2 : les surfaces du paysage
  const row2 = H + 66;
  const surfaces = [
    { x: 19, cls: 'carte-vignes', label: t('carte.legendVines') },
    { x: 300, cls: 'carte-bois', label: t('carte.legendWood') },
    { x: 520, cls: 'carte-eau', label: t('carte.legendWater') },
    { x: 720, cls: 'carte-villages', label: t('carte.legendTown') },
  ];
  for (const s of surfaces) {
    const swatch = svgEl('g', { class: s.cls });
    swatch.appendChild(svgEl('path', {
      d: `M${s.x},${row2 - 11}L${s.x + 30},${row2 - 13}L${s.x + 32},${row2 + 5}L${s.x + 2},${row2 + 7}Z`,
    }));
    g.appendChild(swatch);
    g.appendChild(svgEl('text', { x: s.x + 42, y: row2 + 3, class: 'carte-legend-label' }, s.label));
  }

  // --- Rangée 3 : l'échelle de couleur des notes, et l'échelle métrique
  const row3 = H + 112;
  g.appendChild(svgEl('text', { x: 19, y: row3, class: 'carte-legend-label' }, t('carte.legendRated')));
  const swatchW = 42;
  const swatchGap = 46;
  CARTE_SCALE.forEach((step, i) => {
    const x = 19 + i * swatchGap;
    // La teinte des vignes au-dessus, celle de la pastille en dessous
    g.appendChild(svgEl('rect', { x, y: row3 + 10, width: swatchW, height: 8, fill: step.vine }));
    g.appendChild(svgEl('rect', { x, y: row3 + 18, width: swatchW, height: 14, fill: step.fill }));
  });
  g.appendChild(svgEl('text', { x: 19, y: row3 + 49, class: 'carte-legend-tick' }, '1/5'));
  g.appendChild(svgEl('text', {
    x: 19 + (CARTE_SCALE.length - 1) * swatchGap + swatchW, y: row3 + 49,
    'text-anchor': 'end', class: 'carte-legend-tick',
  }, '5/5'));

  // Échelle métrique : 5 km, convertis en pixels via la largeur du cadre
  const KM_PER_DEG_LON = 111.32 * CARTE_VIEW.kx;
  const barKm = 5;
  const barPx = (barKm / KM_PER_DEG_LON) / (CARTE_BOUNDS.maxLon - CARTE_BOUNDS.minLon) * W;
  const barX = W - 30 - barPx;
  const barY = row3 + 24;
  g.appendChild(svgEl('line', { x1: barX, y1: barY, x2: barX + barPx, y2: barY, class: 'carte-scalebar' }));
  g.appendChild(svgEl('line', { x1: barX, y1: barY - 5, x2: barX, y2: barY + 5, class: 'carte-scalebar' }));
  g.appendChild(svgEl('line', {
    x1: barX + barPx, y1: barY - 5, x2: barX + barPx, y2: barY + 5, class: 'carte-scalebar',
  }));
  g.appendChild(svgEl('text', {
    x: barX + barPx / 2, y: barY - 12, 'text-anchor': 'middle', class: 'carte-legend-label',
  }, t('carte.scale', { n: barKm })));

  g.appendChild(svgEl('text', {
    x: W - 30, y: H + CARTE_LEGEND_H - 12, 'text-anchor': 'end', class: 'carte-credits',
  }, t('carte.credits')));

  return g;
}
