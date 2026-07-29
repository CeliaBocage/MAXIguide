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
// Dépend de js/svg.js (svgEl) et js/data/carte.js, à charger avant.

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
const CARTE_LEGEND_H = 190;

function carteProject(lon, lat) {
  const { minLon, maxLon, minLat, maxLat } = CARTE_BOUNDS;
  return {
    x: (lon - minLon) / (maxLon - minLon) * CARTE_VIEW.width,
    y: (maxLat - lat) / (maxLat - minLat) * CARTE_VIEW.height,
  };
}

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

// Échelle de couleur des pastilles : du rosé pâle au rouge profond.
const CARTE_SCALE = [
  { max: 1.5, fill: '#f3d9b8', text: '#6b4a1f' },
  { max: 2.5, fill: '#e6a97c', text: '#5a2c14' },
  { max: 3.5, fill: '#cf6f60', text: '#fff' },
  { max: 4.5, fill: '#a3374b', text: '#fff' },
  { max: Infinity, fill: '#6e1730', text: '#fff' },
];

function carteScoreColors(score) {
  return CARTE_SCALE.find(step => score <= step.max);
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
      const box = { x1: mx - needed / 2, y1: my - 20, x2: mx + needed / 2, y2: my + 6 };
      const busy = boxes.some(bb => boxOverlap(box, bb) > 0);
      const score = chord - 4 * drift - (busy ? 400 : 0);
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

  // Fond : les coteaux du Gaillacois. Le même rectangle sert de masque, pour
  // que les rivières s'arrêtent net au bord de la carte.
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, rx: 10, fill: '#eef3e6' }));
  const defs = svgEl('defs');
  const clip = svgEl('clipPath', { id: 'carte-clip' });
  clip.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, rx: 10 }));
  defs.appendChild(clip);
  svg.appendChild(defs);

  // Les domaines, écartés juste ce qu'il faut pour rester lisibles. On les
  // place en premier : les noms de rivières et de villages se rangeront
  // ensuite là où ils ne passent pas sous une pastille.
  const placed = [];
  for (const domaine of DOMAINES) {
    const geo = CARTE_DOMAINES[domaine.id];
    if (!geo) continue;
    const p = carteProject(geo.lon, geo.lat);
    placed.push({ domaine, geo, ax: p.x, ay: p.y, x: p.x, y: p.y });
  }
  carteSpread(placed, {
    gap: 27, width: W, height: H,
    margin: { left: 14, right: 14, top: 26, bottom: 34 },
  });

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
    const { domaine, geo } = node;
    const deco = decorate ? decorate(domaine) : {};
    const g = svgEl('g', {
      class: 'carte-stand' + (onClick ? ' clickable' : '') + (deco.done ? ' done' : ''),
    });
    g.appendChild(svgEl('title', {}, t('carte.standTitle', {
      stand: domaine.stand, name: domaine.name, commune: geo.commune,
    })));

    // Pastille : verte si notée, teintée selon la note moyenne si on en a une
    const circle = svgEl('circle', { cx: node.x, cy: node.y, r: 11 });
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

  // --- Rangée 1 : ce qu'on voit sur le fond de carte
  const row1 = H + 34;
  g.appendChild(svgEl('circle', { cx: 30, cy: row1, r: 11, class: 'carte-key-todo' }));
  g.appendChild(svgEl('text', { x: 52, y: row1 + 6, class: 'carte-legend-label' }, t('carte.legendTodo')));

  g.appendChild(svgEl('line', { x1: 480, y1: row1, x2: 524, y2: row1, class: 'carte-water main' }));
  g.appendChild(svgEl('text', { x: 534, y: row1 + 6, class: 'carte-legend-label' }, t('carte.legendRiver')));

  g.appendChild(svgEl('circle', { cx: 680, cy: row1, r: 4.5, class: 'carte-place-dot town' }));
  g.appendChild(svgEl('text', { x: 694, y: row1 + 6, class: 'carte-legend-label' }, t('carte.legendVillage')));

  // --- Rangée 2 : l'échelle de couleur des notes, et l'échelle métrique
  const row2 = H + 82;
  g.appendChild(svgEl('text', { x: 19, y: row2, class: 'carte-legend-label' }, t('carte.legendRated')));
  const swatchW = 42;
  const swatchGap = 46;
  CARTE_SCALE.forEach((step, i) => {
    g.appendChild(svgEl('rect', {
      x: 19 + i * swatchGap, y: row2 + 12, width: swatchW, height: 18, rx: 4, fill: step.fill,
    }));
  });
  g.appendChild(svgEl('text', { x: 19, y: row2 + 47, class: 'carte-legend-tick' }, '1/5'));
  g.appendChild(svgEl('text', {
    x: 19 + (CARTE_SCALE.length - 1) * swatchGap + swatchW, y: row2 + 47,
    'text-anchor': 'end', class: 'carte-legend-tick',
  }, '5/5'));

  // Échelle métrique : 5 km, convertis en pixels via la largeur du cadre
  const KM_PER_DEG_LON = 111.32 * CARTE_VIEW.kx;
  const barKm = 5;
  const barPx = (barKm / KM_PER_DEG_LON) / (CARTE_BOUNDS.maxLon - CARTE_BOUNDS.minLon) * W;
  const barX = W - 30 - barPx;
  const barY = row2 + 21;
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
