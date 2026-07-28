// Page de notation d'un domaine (?domaine=<id>) : notes par couleur,
// stickers (0 à 5 cœurs / étoiles) et commentaire libre.
const params = new URLSearchParams(window.location.search);
const domaine = getDomaine(params.get('domaine'));

// Une bouteille qui se remplit selon la note (0 à 5) : chaque cinquième de la
// bouteille est cliquable, re-cliquer sur le niveau courant remet à zéro.
// Le SVG lui-même vient de js/bottle.js (partagé avec les guides et moyennes).
function makeBottleRow(boisson, getValue, setValue) {
  const row = document.createElement('div');
  row.className = 'note-row';

  const labelEl = document.createElement('span');
  labelEl.className = 'note-label';
  labelEl.textContent = boisson.label;

  const gauge = document.createElement('div');
  gauge.className = 'bottle-gauge';

  const { svg, liquid } = makeBottleSvg(boisson.color);

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
    btn.setAttribute('aria-label', t('notation.ariaValue', { label: boisson.label, value }));
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

// Stickers disponibles : chaque type garde son champ (coeur / etoile / perso)
// en base. Le sticker perso porte l'emoji du guide (✨ tant qu'il n'en a pas).
function makeStickers(user) {
  return [
    { key: 'coeur', emoji: '❤️', label: t('notation.lovePeople') },
    { key: 'etoile', emoji: '⭐', label: t('notation.loveWines') },
    { key: 'perso', emoji: user.emoji || '✨', label: t('notation.myOwn') },
  ];
}

// Section stickers : les stickers posés s'affichent en « chips » (cliquer
// dessus pour les modifier, ✕ pour les retirer), et un bouton « Ajouter un
// sticker » ouvre un petit panneau pour choisir lequel et combien.
// Si le guide n'a pas encore de sticker perso, le panneau lui fait d'abord
// choisir son emoji (takenEmojis : ceux déjà pris par les autres guides).
function makeStickerSection(user, STICKERS, takenEmojis, getValue, setValue) {
  const section = document.createElement('div');
  section.className = 'sticker-section';

  const chips = document.createElement('div');
  chips.className = 'sticker-chips';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn-secondary add-sticker-btn';
  addBtn.textContent = t('notation.addSticker');

  const picker = document.createElement('div');
  picker.className = 'sticker-picker';
  picker.hidden = true;

  let picking = null; // type de sticker en cours de choix dans le panneau

  addBtn.addEventListener('click', () => {
    picking = null;
    picker.hidden = !picker.hidden;
    render();
  });

  function render() {
    chips.replaceChildren();
    for (const sticker of STICKERS) {
      const count = getValue(sticker.key);
      if (!count) continue;

      const chip = document.createElement('div');
      chip.className = 'sticker-chip';

      const body = document.createElement('button');
      body.type = 'button';
      body.className = 'sticker-chip-body';
      body.textContent = sticker.emoji.repeat(count);
      body.setAttribute('aria-label', t('notation.chipEdit', { label: sticker.label, count }));
      body.addEventListener('click', () => {
        picking = sticker.key;
        picker.hidden = false;
        render();
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'sticker-chip-remove';
      remove.textContent = '✕';
      remove.setAttribute('aria-label', t('notation.chipRemove', { label: sticker.label }));
      remove.addEventListener('click', () => {
        setValue(sticker.key, 0);
        render();
      });

      chip.append(body, remove);
      chips.appendChild(chip);
    }

    picker.replaceChildren();
    if (!picker.hidden) {
      const step1 = document.createElement('p');
      step1.className = 'muted picker-step';
      step1.textContent = t('notation.whichSticker');

      const types = document.createElement('div');
      types.className = 'sticker-choices';
      for (const sticker of STICKERS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sticker-choice' + (picking === sticker.key ? ' active' : '');
        btn.textContent = `${sticker.emoji} ${sticker.label}`;
        btn.addEventListener('click', () => {
          picking = sticker.key;
          render();
        });
        types.appendChild(btn);
      }
      picker.append(step1, types);

      // Sticker perso sans emoji choisi : on fait d'abord choisir l'emoji
      if (picking === 'perso' && !user.emoji) {
        const step = document.createElement('p');
        step.className = 'muted picker-step';
        step.textContent = t('notation.pickEmoji');
        picker.append(step, makeEmojiPalette({
          taken: takenEmojis,
          onPick: async (emoji) => {
            try {
              const { error } = await Storage.setUserEmoji(user.id, emoji);
              if (error) {
                step.textContent = error;
                return;
              }
            } catch (err) {
              showDbError(err);
              return;
            }
            user.emoji = emoji;
            STICKERS.find(s => s.key === 'perso').emoji = emoji;
            const nameEl = document.querySelector('.user-name');
            if (nameEl) nameEl.textContent = `${emoji} ${user.name}`;
            render(); // l'emoji est choisi : place à « Combien ? »
          },
        }));
      } else if (picking) {
        const step2 = document.createElement('p');
        step2.className = 'muted picker-step';
        step2.textContent = t('notation.howMany');

        const qty = document.createElement('div');
        qty.className = 'sticker-qty';
        const current = getValue(picking);
        for (let n = 1; n <= 5; n++) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'sticker-qty-btn' + (n === current ? ' active' : '');
          btn.textContent = String(n);
          btn.addEventListener('click', () => {
            setValue(picking, n);
            picking = null;
            picker.hidden = true;
            render();
          });
          qty.appendChild(btn);
        }
        picker.append(step2, qty);
      }
    }
  }

  render();
  section.append(chips, addBtn, picker);
  return section;
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
    t('notation.sub', { stand: domaine.stand });
  document.title = `MAXIguide — ${domaine.name}`;

  const existing = (await Storage.getUserRatings(user.id))[domaine.id] || {};
  const fiche = {
    coeur: existing.coeur || 0,
    etoile: existing.etoile || 0,
    perso: existing.perso || 0,
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

  // Pas encore de sticker perso ? On repère ceux des autres guides pour les
  // griser dans la palette (hors-ligne : palette complète, tant pis).
  let takenEmojis = new Set();
  if (!user.emoji) {
    try {
      const others = await Storage.getUsers();
      takenEmojis = new Set(others.filter(u => u.id !== user.id && u.emoji).map(u => u.emoji));
    } catch { /* réseau capricieux : on laisse tout cliquable */ }
  }

  const stickerRows = document.getElementById('sticker-rows');
  stickerRows.append(makeStickerSection(
    user, makeStickers(user), takenEmojis,
    key => fiche[key] || 0,
    (key, v) => { fiche[key] = v; },
  ));

  const commentaireEl = document.getElementById('commentaire');
  commentaireEl.value = existing.commentaire || '';

  const saveBtn = document.getElementById('save-btn');
  const savedMsg = document.getElementById('saved-msg');

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    savedMsg.hidden = true;
    try {
      const { queued } = await Storage.saveRating(user.id, domaine.id, {
        ...fiche,
        commentaire: commentaireEl.value,
      });
      await Header.refreshCompletion();
      savedMsg.textContent = t(queued ? 'notation.savedPending' : 'notation.saved');
      savedMsg.hidden = false;
    } catch (err) {
      showDbError(err);
    } finally {
      saveBtn.disabled = false;
    }
  });

  // Navigation stand précédent / suivant (dans l'ordre de la liste des domaines)
  const index = DOMAINES.indexOf(domaine);
  for (const [id, neighbor] of [
    ['nav-prev', DOMAINES[index - 1]],
    ['nav-next', DOMAINES[index + 1]],
  ]) {
    const link = document.getElementById(id);
    if (!neighbor) {
      link.remove();
      continue;
    }
    link.href = `index.html?domaine=${encodeURIComponent(neighbor.id)}`;
    const label = `${neighbor.stand} · ${neighbor.name}`;
    link.textContent = id === 'nav-prev' ? `← ${label}` : `${label} →`;
  }
}

main().catch(showDbError);
