// Page de notation d'un domaine (?domaine=<id>) : notes par couleur,
// stickers (0 à 5 cœurs / étoiles) et commentaire libre.
const params = new URLSearchParams(window.location.search);
const domaine = getDomaine(params.get('domaine'));

// Bouteille couchée (goulot à droite) : contour + zone de remplissage, viewBox 0 0 200 60.
const BOTTLE_PATH =
  'M14 8 H128 C146 8 150 20 164 22 H184 V17 H196 V43 H184 V38 ' +
  'C150 40 146 52 128 52 H14 Q4 52 4 42 V18 Q4 8 14 8 Z';

// Une bouteille qui se remplit selon la note (0 à 5) : chaque cinquième de la
// bouteille est cliquable, re-cliquer sur le niveau courant remet à zéro.
function makeBottleRow(boisson, getValue, setValue) {
  const row = document.createElement('div');
  row.className = 'note-row';

  const labelEl = document.createElement('span');
  labelEl.className = 'note-label';
  labelEl.textContent = boisson.label;

  const gauge = document.createElement('div');
  gauge.className = 'bottle-gauge';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, ...children) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    node.append(...children);
    return node;
  };

  const clipId = `bottle-clip-${boisson.key}`;
  const liquid = el('rect', { class: 'bottle-liquid', width: 0, height: 60,
    'clip-path': `url(#${clipId})`, fill: boisson.color });
  const svg = el('svg', { viewBox: '0 0 200 60', 'aria-hidden': 'true' },
    el('defs', {}, el('clipPath', { id: clipId }, el('path', { d: BOTTLE_PATH }))),
    el('rect', { class: 'bottle-bg', width: 200, height: 60, 'clip-path': `url(#${clipId})` }),
    liquid,
    el('g', { class: 'bottle-ticks', 'clip-path': `url(#${clipId})` },
      ...[40, 80, 120, 160].map(x => el('line', { x1: x, y1: 8, x2: x, y2: 52 }))),
    el('path', { class: 'bottle-outline', d: BOTTLE_PATH }),
  );

  const zones = document.createElement('div');
  zones.className = 'bottle-zones';
  const wrap = document.createElement('div');
  wrap.className = 'bottle-wrap';
  wrap.append(svg, zones);

  const valueEl = document.createElement('span');
  valueEl.className = 'bottle-value';
  gauge.append(wrap, valueEl);

  for (let value = 1; value <= 5; value++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bottle-zone';
    btn.setAttribute('aria-label', `${boisson.label} : ${value} sur 5`);
    btn.addEventListener('click', () => {
      setValue(value === getValue() ? 0 : value);
      render();
    });
    zones.appendChild(btn);
  }

  function render() {
    const current = getValue();
    liquid.setAttribute('width', current * 40);
    valueEl.textContent = current ? `${current}/5` : '—';
  }

  render();
  row.append(labelEl, gauge);
  return row;
}

// Une rangée de 5 symboles cliquables (notes ou stickers).
// Cliquer sur la valeur déjà sélectionnée remet à zéro.
function makeSymbolRow(label, symbols, getValue, setValue) {
  const row = document.createElement('div');
  row.className = 'note-row';

  const labelEl = document.createElement('span');
  labelEl.className = 'note-label';
  labelEl.textContent = label;

  const btns = document.createElement('div');
  btns.className = 'symbol-btns';

  function render() {
    btns.replaceChildren();
    const current = getValue();
    for (let value = 1; value <= 5; value++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const active = value <= current;
      btn.className = 'symbol' + (active ? ' filled' : '');
      btn.textContent = active ? symbols.filled : symbols.empty;
      btn.setAttribute('aria-label', `${label} : ${value} sur 5`);
      btn.addEventListener('click', () => {
        setValue(value === getValue() ? 0 : value);
        render();
      });
      btns.appendChild(btn);
    }
  }

  render();
  row.append(labelEl, btns);
  return row;
}

async function main() {
  if (!domaine) {
    window.location.replace('../domaines/index.html');
    return;
  }

  const user = await Header.mount('domaines');
  if (!user) return;

  document.getElementById('domaine-name').textContent = domaine.name;
  document.getElementById('notation-sub').textContent =
    `Stand ${domaine.stand} — notez ce que vous avez dégusté (re-cliquez sur la même valeur pour effacer).`;
  document.title = `MAXIguide — ${domaine.name}`;

  const existing = (await Storage.getUserRatings(user.id))[domaine.id] || {};
  const fiche = {
    coeur: existing.coeur || 0,
    etoile: existing.etoile || 0,
  };

  // Rangées de notes selon le type du domaine (vin, whisky ou les deux) + jus de raisin :
  // une bouteille par boisson, qu'on remplit plus ou moins selon la note.
  const noteRows = document.getElementById('note-rows');
  for (const boisson of getBoissons(domaine)) {
    fiche[boisson.key] = existing[boisson.key] || 0;
    noteRows.append(
      makeBottleRow(boisson, () => fiche[boisson.key], v => { fiche[boisson.key] = v; })
    );
  }

  const stickerRows = document.getElementById('sticker-rows');
  stickerRows.append(
    makeSymbolRow('On a adoré les gens', { filled: '❤️', empty: '🤍' },
      () => fiche.coeur, v => { fiche.coeur = v; }),
    makeSymbolRow('Les vins étaient excellents', { filled: '⭐', empty: '☆' },
      () => fiche.etoile, v => { fiche.etoile = v; }),
  );

  const commentaireEl = document.getElementById('commentaire');
  commentaireEl.value = existing.commentaire || '';

  const saveBtn = document.getElementById('save-btn');
  const savedMsg = document.getElementById('saved-msg');

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    savedMsg.hidden = true;
    try {
      await Storage.saveRating(user.id, domaine.id, {
        ...fiche,
        commentaire: commentaireEl.value,
      });
      await Header.refreshCompletion();
      savedMsg.hidden = false;
    } catch (err) {
      showDbError(err);
    } finally {
      saveBtn.disabled = false;
    }
  });
}

main().catch(showDbError);
