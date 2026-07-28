// Bouteille-jauge partagée (notation, guides, moyennes) : une bouteille
// couchée (goulot à droite) dont le remplissage reflète une note sur 5.
// viewBox 0 0 200 60 — le corps utile fait 200 de large, soit 40 par point.
const BOTTLE_PATH =
  'M14 8 H128 C146 8 150 20 164 22 H184 V17 H196 V43 H184 V38 ' +
  'C150 40 146 52 128 52 H14 Q4 52 4 42 V18 Q4 8 14 8 Z';

// Les clip-paths SVG ont besoin d'un id unique par bouteille sur la page.
let bottleClipSeq = 0;

// Construit le SVG d'une bouteille remplie à value/5 (value peut être décimal).
// Retourne { svg, liquid } : pour animer le niveau plus tard, faire
// liquid.setAttribute('width', value * 40).
function makeBottleSvg(color, value = 0) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, ...children) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    node.append(...children);
    return node;
  };

  const clipId = `bottle-clip-${++bottleClipSeq}`;
  const liquid = el('rect', { class: 'bottle-liquid', width: value * 40, height: 60,
    'clip-path': `url(#${clipId})`, fill: color });
  const svg = el('svg', { viewBox: '0 0 200 60', 'aria-hidden': 'true' },
    el('defs', {}, el('clipPath', { id: clipId }, el('path', { d: BOTTLE_PATH }))),
    el('rect', { class: 'bottle-bg', width: 200, height: 60, 'clip-path': `url(#${clipId})` }),
    liquid,
    el('g', { class: 'bottle-ticks', 'clip-path': `url(#${clipId})` },
      ...[40, 80, 120, 160].map(x => el('line', { x1: x, y1: 8, x2: x, y2: 52 }))),
    el('path', { class: 'bottle-outline', d: BOTTLE_PATH }),
  );
  return { svg, liquid };
}
