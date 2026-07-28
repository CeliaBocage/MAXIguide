// Page de notation d'un domaine (?domaine=<id>) : notes par couleur,
// stickers (0 à 5 cœurs / étoiles) et commentaire libre.
const params = new URLSearchParams(window.location.search);
const domaine = getDomaine(params.get('domaine'));

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

  // Rangées de notes selon le type du domaine (vin, whisky ou les deux) + jus de raisin
  const stars = { filled: '★', empty: '☆' };
  const noteRows = document.getElementById('note-rows');
  for (const boisson of getBoissons(domaine)) {
    fiche[boisson.key] = existing[boisson.key] || 0;
    noteRows.append(
      makeSymbolRow(boisson.label, stars, () => fiche[boisson.key], v => { fiche[boisson.key] = v; })
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
