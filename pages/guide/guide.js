// Page de visualisation du guide d'un invité (?user=<id>) — lecture seule,
// accessible sans avoir choisi de profil.
const select = document.getElementById('user-select');
const content = document.getElementById('guide-content');
const listEl = document.getElementById('guide-list');
const emptyEl = document.getElementById('guide-empty');

function symbolCell(label, value) {
  const span = document.createElement('span');
  span.className = 'guide-note';
  span.textContent = value ? `${label} ${'★'.repeat(value)}` : '';
  return span;
}

async function renderGuide(userId) {
  if (!userId) {
    content.hidden = true;
    return;
  }

  const ratings = await Storage.getUserRatings(userId);
  const rated = DOMAINES.filter(d => ratings[d.id]);

  listEl.replaceChildren();
  emptyEl.hidden = rated.length > 0;
  content.hidden = false;

  // Son plan : ses stickers ❤️/⭐ posés sur les stands
  renderPlan(document.getElementById('plan-container'), {
    decorate: (domaine) => {
      const fiche = ratings[domaine.id];
      if (!fiche) return {};
      const badge = '❤️'.repeat(fiche.coeur || 0) + '⭐'.repeat(fiche.etoile || 0);
      return { done: true, badge };
    },
  });

  for (const domaine of rated) {
    const fiche = ratings[domaine.id];
    const li = document.createElement('li');
    li.className = 'guide-card';

    const title = document.createElement('div');
    title.className = 'guide-card-title';

    const name = document.createElement('span');
    name.className = 'domaine-name';
    name.textContent = `${domaine.stand} · ${domaine.name}`;

    const stickers = document.createElement('span');
    stickers.className = 'guide-stickers';
    stickers.textContent = '❤️'.repeat(fiche.coeur || 0) + '⭐'.repeat(fiche.etoile || 0);

    title.append(name, stickers);
    li.appendChild(title);

    const notes = document.createElement('div');
    notes.className = 'guide-notes';
    notes.append(
      symbolCell('⚪', fiche.note_blanc),
      symbolCell('🔴', fiche.note_rouge),
      symbolCell('🌸', fiche.note_rose),
      symbolCell('🥃', fiche.note_whisky),
      symbolCell('🍇', fiche.note_jus),
    );
    li.appendChild(notes);

    if (fiche.commentaire) {
      const comment = document.createElement('p');
      comment.className = 'guide-comment';
      comment.textContent = `« ${fiche.commentaire} »`;
      li.appendChild(comment);
    }

    listEl.appendChild(li);
  }
}

async function main() {
  const users = await Storage.getUsers();
  for (const user of users) {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.name;
    select.appendChild(option);
  }

  // Pré-sélection via ?user=<id>
  const preselected = new URLSearchParams(window.location.search).get('user');
  if (preselected && users.some(u => u.id === preselected)) {
    select.value = preselected;
    await renderGuide(preselected);
  }

  select.addEventListener('change', () => {
    const url = new URL(window.location);
    if (select.value) url.searchParams.set('user', select.value);
    else url.searchParams.delete('user');
    history.replaceState(null, '', url);
    renderGuide(select.value).catch(showDbError);
  });
}

main().catch(showDbError);
