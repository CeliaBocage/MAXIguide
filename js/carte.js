// Rendu SVG de la carte réelle du vignoble gaillacois : où se trouvent
// vraiment les domaines, quelles vignes sont les leurs, et ce que le groupe
// en a pensé. (Le plan du parc de la fête, lui, vit dans js/plan.js.)
//
// Usage : renderCarte(container, {
//   decorate(domaine) → { done: bool, badge: '❤️⭐', guides: ['🦄'], score: 4.2 }
//     (facultatif — score : note moyenne sur 5, affichée à côté du nom),
//   onClick(domaine) (facultatif — rend les domaines cliquables),
// })
// La carte se zoome et se déplace : les noms sont recalculés à chaque
// changement de vue, donc zoomer fait apparaître ceux qui ne tenaient pas.
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
const CARTE_LEGEND_H = 250;

// Jusqu'où on peut zoomer
const CARTE_ZOOM_MAX = 8;

function carteProject(lon, lat) {
  const { minLon, maxLon, minLat, maxLat } = CARTE_BOUNDS;
  return {
    x: (lon - minLon) / (maxLon - minLon) * CARTE_VIEW.width,
    y: (maxLat - lat) / (maxLat - minLat) * CARTE_VIEW.height,
  };
}

// --- Une couleur par domaine --------------------------------------------
// Dix teintes suffisent : js/data/carte.js les attribue de façon que deux
// domaines voisins n'aient jamais la même (4 km d'écart minimum).
//   ink  : le point du domaine et son nom
//   fill : ses parcelles de vigne
const CARTE_PALETTE = [
  { ink: '#a3374b', fill: '#e9bfc6' }, // grenat
  { ink: '#c96a24', fill: '#f2d2b0' }, // orange brûlé
  { ink: '#9c8412', fill: '#ebe0a6' }, // or
  { ink: '#5f8a2c', fill: '#d2e2b2' }, // olive
  { ink: '#1f8a68', fill: '#b8e0d0' }, // vert
  { ink: '#1f7d95', fill: '#b7dce6' }, // canard
  { ink: '#3a6cb4', fill: '#c4d4ee' }, // bleu
  { ink: '#7048a6', fill: '#d6c8ea' }, // violet
  { ink: '#b0398a', fill: '#efc4e2' }, // magenta
  { ink: '#845c3c', fill: '#dfcbb8' }, // brun
];

function cartePalette(domaineId) {
  const geo = CARTE_DOMAINES[domaineId];
  return CARTE_PALETTE[geo ? geo.couleur % CARTE_PALETTE.length : 0];
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

// Dessine une couche de surfaces d'un seul tenant (bois, eau, villages…)
function cartePaysageCouche(rings, className) {
  const g = svgEl('g', { class: className });
  for (const ring of rings) g.appendChild(svgEl('path', { d: cartePaysagePath(ring) }));
  return g;
}

// Les parcelles de vigne, chacune à la couleur du domaine auquel
// js/data/paysage.js la rattache (la plus proche cave à moins de 2 km).
function carteVignes() {
  const g = svgEl('g', { class: 'carte-vignes' });
  PAYSAGE_VIGNES.forEach((ring, i) => {
    const path = svgEl('path', { d: cartePaysagePath(ring) });
    const owner = PAYSAGE_VIGNES_OWNER[i];
    if (owner >= 0) {
      const palette = cartePalette(PAYSAGE_VIGNES_DOMAINES[owner]);
      path.setAttribute('style', `fill:${palette.fill};stroke:${palette.ink};stroke-opacity:0.35`);
    }
    g.appendChild(path);
  });
  return g;
}

// --- Étiquettes ---------------------------------------------------------
function boxOverlap(a, b) {
  const dx = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const dy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return dx > 0 && dy > 0 ? dx * dy : 0;
}

// Largeur approximative d'un texte : mesurer pour de vrai demanderait un
// aller-retour dans le DOM par étiquette, à chaque déplacement de la carte.
function carteTextWidth(text, size) {
  return text.length * size * 0.56;
}

// Le nom d'une rivière se pose sur son passage le plus rectiligne : le faire
// suivre les méandres le rendrait illisible. On note chaque tronçon assez long
// pour porter le nom — on préfère les longs, bien droits, et loin des bords —
// puis on écrit le nom le long du meilleur.
const CARTE_RIVER_WINDOW = 25; // tronçons d'au plus 25 points, au-delà ça serpente

function carteRiverLabelSpot(river) {
  const pts = river.pts.map(([lon, lat]) => carteProject(lon, lat));
  const needed = carteTextWidth(river.name, 15) + 20;

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

      // Le nom doit rester dans le cadre — le Cérou ne fait que frôler le bord
      // nord, le Dadou le bord sud — et, à choisir, on le préfère au large.
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const edge = Math.min(mx, CARTE_VIEW.width - mx, my, CARTE_VIEW.height - my);
      if (edge < 22) continue;

      const score = chord - 4 * drift - Math.max(0, 90 - edge) * 3;
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

// Le tronçon choisi ne dépend que de la forme de la rivière : on le calcule
// une fois pour toutes, et on le suit ensuite au fil des zooms.
const CARTE_RIVER_SPOTS = CARTE_RIVERS.map(carteRiverLabelSpot);

// Pose une étiquette près de son point d'ancrage, dans la première position
// libre. Rien de libre → pas d'étiquette : c'est ce qui évite la bouillie
// quand tout est serré, et zoomer libère de la place.
function cartePlaceLabel(text, anchor, size, occupied, frame, opts = {}) {
  const w = carteTextWidth(text, size) + (opts.extra || 0);
  const near = opts.gap || 7;
  const far = near + 9;
  const candidates = [
    { x: anchor.x + near, y: anchor.y + size * 0.35, align: 'start' },
    { x: anchor.x - near, y: anchor.y + size * 0.35, align: 'end' },
    { x: anchor.x, y: anchor.y - near - 2, align: 'middle' },
    { x: anchor.x, y: anchor.y + near + size, align: 'middle' },
    { x: anchor.x + far, y: anchor.y - far, align: 'start' },
    { x: anchor.x + far, y: anchor.y + far + size * 0.5, align: 'start' },
    { x: anchor.x - far, y: anchor.y - far, align: 'end' },
    { x: anchor.x - far, y: anchor.y + far + size * 0.5, align: 'end' },
  ];

  for (const c of candidates) {
    const left = c.align === 'start' ? c.x : c.align === 'end' ? c.x - w : c.x - w / 2;
    const box = { x1: left - 1, y1: c.y - size, x2: left + w + 1, y2: c.y + 3 };
    if (box.x1 < frame.x1 || box.x2 > frame.x2 || box.y1 < frame.y1 || box.y2 > frame.y2) continue;
    if (occupied.some(o => boxOverlap(box, o) > 0)) continue;
    occupied.push(box);
    return c;
  }
  return null;
}

// --- Rendu --------------------------------------------------------------
function renderCarte(container, { decorate, onClick } = {}) {
  container.replaceChildren();
  container.classList.add('carte-wrap');

  const { width: W, height: H } = CARTE_VIEW;
  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H + CARTE_LEGEND_H}`,
    class: 'carte-svg',
    role: 'img',
    'aria-label': t('carte.aria'),
  });

  // Fond : la campagne du Gaillacois. Le même rectangle sert de masque, pour
  // que rien ne déborde du cadre quand on se déplace dedans.
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, rx: 10, class: 'carte-fond' }));
  const defs = svgEl('defs');
  const clip = svgEl('clipPath', { id: 'carte-clip' });
  clip.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, rx: 10 }));
  defs.appendChild(clip);
  svg.appendChild(defs);

  // Où se trouve chaque domaine, et ce que le groupe en a pensé
  const domaines = [];
  for (const domaine of DOMAINES) {
    const geo = CARTE_DOMAINES[domaine.id];
    if (!geo) continue;
    domaines.push({
      domaine, geo,
      palette: cartePalette(domaine.id),
      deco: decorate ? decorate(domaine) : {},
      world: carteProject(geo.lon, geo.lat),
    });
  }
  // Les domaines notés placent leur nom en premier : ce sont eux qu'on cherche
  domaines.sort((a, b) => (b.deco.done ? 1 : 0) - (a.deco.done ? 1 : 0));

  // --- Le paysage, qui se déplace et grossit avec le zoom
  const monde = svgEl('g', { class: 'carte-monde', 'clip-path': 'url(#carte-clip)' });
  monde.appendChild(cartePaysageCouche(PAYSAGE_BOIS, 'carte-bois'));
  monde.appendChild(carteVignes());
  monde.appendChild(cartePaysageCouche(PAYSAGE_VILLAGES, 'carte-villages'));
  monde.appendChild(cartePaysageCouche(PAYSAGE_EAU, 'carte-eau'));

  const waters = svgEl('g');
  for (const river of CARTE_RIVERS) {
    const d = river.pts
      .map(([lon, lat], k) => {
        const p = carteProject(lon, lat);
        return `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');
    waters.appendChild(svgEl('path', { d, class: 'carte-water' + (river.main ? ' main' : '') }));
  }
  monde.appendChild(waters);
  svg.appendChild(monde);

  // --- Les écritures, redessinées à chaque changement de vue pour garder
  //     leur taille et se replacer là où il y a de la place
  const calque = svgEl('g', { class: 'carte-calque', 'clip-path': 'url(#carte-clip)' });
  svg.appendChild(calque);

  const vue = { k: 1, tx: 0, ty: 0 };
  const versEcran = (p) => ({ x: p.x * vue.k + vue.tx, y: p.y * vue.k + vue.ty });

  function dessineCalque() {
    calque.replaceChildren();
    const frame = { x1: 4, y1: 4, x2: W - 4, y2: H - 4 };
    const dedans = (p) => p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20;
    const occupied = [];

    // Les points des domaines réservent leur place avant toute étiquette
    for (const n of domaines) {
      n.screen = versEcran(n.world);
      if (!dedans(n.screen)) continue;
      const r = n.deco.done ? 6 : 4.5;
      occupied.push({
        x1: n.screen.x - r - 1, y1: n.screen.y - r - 1,
        x2: n.screen.x + r + 1, y2: n.screen.y + r + 1,
      });
    }

    // Nom des rivières
    for (const spot of CARTE_RIVER_SPOTS) {
      if (!spot) continue;
      const p = versEcran(spot);
      if (!dedans(p)) continue;
      calque.appendChild(svgEl('text', {
        x: p.x, y: p.y, 'text-anchor': 'middle',
        transform: `rotate(${spot.angle.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})`,
        class: 'carte-river-label',
      }, CARTE_RIVERS[CARTE_RIVER_SPOTS.indexOf(spot)].name));
    }

    // Villages et villes repères
    for (const place of CARTE_PLACES) {
      const p = versEcran(carteProject(place.lon, place.lat));
      if (!dedans(p)) continue;
      const town = place.rank >= 2;
      calque.appendChild(svgEl('circle', {
        cx: p.x, cy: p.y, r: town ? 4 : 2.5, class: 'carte-place-dot' + (town ? ' town' : ''),
      }));
      occupied.push({ x1: p.x - 5, y1: p.y - 5, x2: p.x + 5, y2: p.y + 5 });
      const size = town ? 15 : 12;
      const spot = cartePlaceLabel(place.name, p, size, occupied, frame, { gap: town ? 8 : 6 });
      if (!spot) continue;
      calque.appendChild(svgEl('text', {
        x: spot.x, y: spot.y, 'text-anchor': spot.align,
        class: 'carte-place-label' + (town ? ' town' : ''),
      }, place.name));
    }

    // Les domaines : un point à leur couleur, leur nom à côté
    for (const n of domaines) {
      if (!dedans(n.screen)) continue;
      const { domaine, geo, deco, palette, screen } = n;
      const g = svgEl('g', {
        class: 'carte-dom' + (onClick ? ' clickable' : '') + (deco.done ? ' done' : ''),
      });
      g.appendChild(svgEl('title', {}, t('carte.standTitle', {
        stand: domaine.stand, name: domaine.name, commune: geo.commune,
      })));

      const r = deco.done ? 6 : 4.5;
      g.appendChild(svgEl('circle', {
        cx: screen.x, cy: screen.y, r, class: 'carte-dom-dot',
        style: `fill:${deco.done ? palette.ink : '#fff'};stroke:${palette.ink}`,
      }));

      // Les stickers moyens du groupe, juste au-dessus du point
      if (deco.badge) {
        g.appendChild(svgEl('text', {
          x: screen.x, y: screen.y - r - 4, 'text-anchor': 'middle',
          'font-size': 10, class: 'stand-badge',
        }, deco.badge));
      }

      // Le nom, et la note moyenne quand il y en a une
      const score = deco.score != null ? deco.score.toFixed(1).replace('.', ',') : null;
      const spot = cartePlaceLabel(geo.court, screen, 11, occupied, frame, {
        gap: r + 3, extra: score ? 22 : 0,
      });
      if (spot) {
        const label = svgEl('text', {
          x: spot.x, y: spot.y, 'text-anchor': spot.align,
          class: 'carte-dom-label' + (deco.done ? ' done' : ''),
          style: `fill:${palette.ink}`,
        }, geo.court);
        if (score) {
          label.appendChild(svgEl('tspan', { class: 'carte-dom-score' }, ` ${score}`));
        }
        g.appendChild(label);
      }

      // Les emojis des participants passés par ce domaine, sous le point
      if (deco.guides && deco.guides.length) {
        const PER_LINE = 5;
        const text = svgEl('text', { 'text-anchor': 'middle', 'font-size': 9, class: 'stand-guides' });
        for (let i = 0; i < deco.guides.length; i += PER_LINE) {
          text.appendChild(svgEl('tspan', {
            x: screen.x, y: screen.y + r + 10 + (i / PER_LINE) * 11,
          }, deco.guides.slice(i, i + PER_LINE).join('')));
        }
        g.appendChild(text);
      }

      if (onClick) g.addEventListener('click', () => onClick(domaine));
      calque.appendChild(g);
    }
  }

  function appliqueVue() {
    // On ne sort jamais du cadre : à zoom 1 la carte reste calée dessus
    vue.k = Math.min(Math.max(vue.k, 1), CARTE_ZOOM_MAX);
    vue.tx = Math.min(0, Math.max(W - W * vue.k, vue.tx));
    vue.ty = Math.min(0, Math.max(H - H * vue.k, vue.ty));
    monde.setAttribute('transform', `translate(${vue.tx.toFixed(2)},${vue.ty.toFixed(2)}) scale(${vue.k.toFixed(4)})`);
    container.classList.toggle('zoomed', vue.k > 1);
    dessineCalque();
  }

  // Zoom centré sur un point du cadre (souris, doigt, ou milieu de la carte)
  function zoomVers(facteur, cx = W / 2, cy = H / 2) {
    const k0 = vue.k;
    const k1 = Math.min(Math.max(k0 * facteur, 1), CARTE_ZOOM_MAX);
    if (k1 === k0) return;
    vue.tx = cx - (cx - vue.tx) * (k1 / k0);
    vue.ty = cy - (cy - vue.ty) * (k1 / k0);
    vue.k = k1;
    appliqueVue();
  }

  carteInteractions(container, svg, vue, zoomVers, appliqueVue);
  svg.appendChild(carteLegend());
  container.appendChild(svg);
  container.appendChild(carteControls(zoomVers, () => {
    vue.k = 1; vue.tx = 0; vue.ty = 0; appliqueVue();
  }));
  appliqueVue();
}

// --- Déplacement et zoom -------------------------------------------------
function carteInteractions(container, svg, vue, zoomVers, appliqueVue) {
  // Un événement souris/doigt, ramené aux coordonnées du dessin
  const enCadre = (e) => {
    const r = svg.getBoundingClientRect();
    const echelle = CARTE_VIEW.width / r.width;
    return { x: (e.clientX - r.left) * echelle, y: (e.clientY - r.top) * echelle };
  };

  let drag = null;
  svg.addEventListener('pointerdown', (e) => {
    if (vue.k === 1) return; // rien à déplacer tant qu'on n'a pas zoomé
    drag = { ...enCadre(e), tx: vue.tx, ty: vue.ty, id: e.pointerId };
    svg.setPointerCapture(e.pointerId);
    container.classList.add('dragging');
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = enCadre(e);
    vue.tx = drag.tx + (p.x - drag.x);
    vue.ty = drag.ty + (p.y - drag.y);
    appliqueVue();
  });
  const finDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    container.classList.remove('dragging');
  };
  svg.addEventListener('pointerup', finDrag);
  svg.addEventListener('pointercancel', finDrag);

  svg.addEventListener('dblclick', (e) => {
    const p = enCadre(e);
    zoomVers(1.8, p.x, p.y);
  });

  // Molette : seulement avec Ctrl/⌘, sinon on volerait le défilement de la page
  svg.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const p = enCadre(e);
    zoomVers(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  }, { passive: false });
}

function carteControls(zoomVers, reset) {
  const box = document.createElement('div');
  box.className = 'carte-controls';
  const bouton = (label, title, action) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'carte-zoom-btn';
    b.textContent = label;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.addEventListener('click', action);
    box.appendChild(b);
  };
  bouton('+', t('carte.zoomIn'), () => zoomVers(1.6));
  bouton('−', t('carte.zoomOut'), () => zoomVers(1 / 1.6));
  bouton('⤢', t('carte.zoomReset'), reset);
  return box;
}

// --- Légende -------------------------------------------------------------
function carteLegend() {
  const { width: W, height: H } = CARTE_VIEW;
  const g = svgEl('g');

  // Rangée 1 : les domaines
  const row1 = H + 30;
  g.appendChild(svgEl('circle', {
    cx: 30, cy: row1, r: 4.5, class: 'carte-dom-dot', style: 'fill:#fff;stroke:#7048a6',
  }));
  g.appendChild(svgEl('text', { x: 44, y: row1 + 5, class: 'carte-legend-label' }, t('carte.legendTodo')));
  g.appendChild(svgEl('circle', {
    cx: 400, cy: row1, r: 6, class: 'carte-dom-dot', style: 'fill:#7048a6;stroke:#7048a6',
  }));
  g.appendChild(svgEl('text', { x: 416, y: row1 + 5, class: 'carte-legend-label' }, t('carte.legendRatedDot')));

  // Rangée 2 : les vignes, colorées par domaine ou laissées neutres
  const row2 = H + 66;
  const tache = (x, style, cls) => {
    const p = svgEl('path', {
      d: `M${x},${row2 - 11}L${x + 30},${row2 - 13}L${x + 32},${row2 + 5}L${x + 2},${row2 + 7}Z`,
      class: cls,
    });
    if (style) p.setAttribute('style', style);
    return p;
  };
  // Trois teintes de la palette, pour montrer qu'un domaine = une couleur
  [0, 4, 7].forEach((i, k) => {
    g.appendChild(tache(19 + k * 34, `fill:${CARTE_PALETTE[i].fill};stroke:${CARTE_PALETTE[i].ink}`, 'carte-vignes-key'));
  });
  g.appendChild(svgEl('text', { x: 133, y: row2 + 3, class: 'carte-legend-label' }, t('carte.legendOwnVines')));
  g.appendChild(tache(560, null, 'carte-vignes-key neutre'));
  g.appendChild(svgEl('text', { x: 598, y: row2 + 3, class: 'carte-legend-label' }, t('carte.legendOtherVines')));

  // Rangée 3 : le reste du paysage
  const row3 = H + 104;
  const surfaces = [
    { x: 19, cls: 'carte-bois', label: t('carte.legendWood') },
    { x: 220, cls: 'carte-eau', label: t('carte.legendWater') },
    { x: 420, cls: 'carte-villages', label: t('carte.legendTown') },
  ];
  for (const s of surfaces) {
    const swatch = svgEl('g', { class: s.cls });
    swatch.appendChild(svgEl('path', {
      d: `M${s.x},${row3 - 11}L${s.x + 30},${row3 - 13}L${s.x + 32},${row3 + 5}L${s.x + 2},${row3 + 7}Z`,
    }));
    g.appendChild(swatch);
    g.appendChild(svgEl('text', { x: s.x + 42, y: row3 + 3, class: 'carte-legend-label' }, s.label));
  }
  g.appendChild(svgEl('line', { x1: 660, y1: row3 - 3, x2: 704, y2: row3 - 3, class: 'carte-water main' }));
  g.appendChild(svgEl('text', { x: 714, y: row3 + 3, class: 'carte-legend-label' }, t('carte.legendRiver')));

  // Rangée 4 : l'échelle métrique et le mode d'emploi du zoom
  const row4 = H + 150;
  g.appendChild(svgEl('text', { x: 19, y: row4, class: 'carte-legend-hint' }, t('carte.zoomHint')));
  g.appendChild(svgEl('text', { x: 19, y: row4 + 22, class: 'carte-legend-hint' }, t('carte.attrNote')));

  const KM_PER_DEG_LON = 111.32 * CARTE_VIEW.kx;
  const barKm = 5;
  const barPx = (barKm / KM_PER_DEG_LON) / (CARTE_BOUNDS.maxLon - CARTE_BOUNDS.minLon) * W;
  const barX = W - 30 - barPx;
  const barY = row4 - 4;
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
