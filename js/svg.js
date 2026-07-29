// Petits utilitaires SVG partagés par le plan du parc (js/plan.js)
// et la carte du vignoble (js/carte.js). À charger avant ces deux-là.
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}, textContent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}
