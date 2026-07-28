// Page des domaines : vue liste / vue plan, accès à la notation
const listEl = document.getElementById('domaine-list');
const viewList = document.getElementById('view-list');
const viewPlan = document.getElementById('view-plan');
const toggleList = document.getElementById('toggle-list');
const togglePlan = document.getElementById('toggle-plan');

function showView(view) {
  viewList.hidden = view !== 'list';
  viewPlan.hidden = view !== 'plan';
  toggleList.classList.toggle('active', view === 'list');
  togglePlan.classList.toggle('active', view === 'plan');
}

toggleList.addEventListener('click', () => showView('list'));
togglePlan.addEventListener('click', () => showView('plan'));

async function main() {
  const user = await Header.mount('domaines');
  if (!user) return;

  const ratings = await Storage.getUserRatings(user.id);
  listEl.replaceChildren();

  for (const domaine of DOMAINES) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'domaine-card';
    link.href = `../notation/index.html?domaine=${encodeURIComponent(domaine.id)}`;

    const name = document.createElement('span');
    name.className = 'domaine-name';
    name.textContent = `${domaine.stand} · ${domaine.name}`;
    if (domaine.type !== 'vin') name.textContent += domaine.type === 'whisky' ? ' 🥃' : ' 🍷🥃';

    const status = document.createElement('span');
    status.className = 'domaine-status';
    const fiche = ratings[domaine.id];
    if (fiche) {
      const parts = [];
      if (fiche.note_blanc) parts.push(`⚪${fiche.note_blanc}`);
      if (fiche.note_rouge) parts.push(`🔴${fiche.note_rouge}`);
      if (fiche.note_rose) parts.push(`🌸${fiche.note_rose}`);
      if (fiche.note_whisky) parts.push(`🥃${fiche.note_whisky}`);
      if (fiche.note_jus) parts.push(`🍇${fiche.note_jus}`);
      if (fiche.coeur) parts.push('❤️'.repeat(fiche.coeur));
      if (fiche.etoile) parts.push('⭐'.repeat(fiche.etoile));
      if (fiche.commentaire) parts.push('💬');
      status.textContent = parts.join(' ') || t('domaines.emptyCard');
      status.classList.add('rated');
    } else {
      status.textContent = t('domaines.toTaste');
    }

    link.append(name, status);
    li.appendChild(link);
    listEl.appendChild(li);
  }

  // Vue plan : stands cliquables, verts quand la fiche existe
  renderPlan(document.getElementById('plan-container'), {
    decorate: (domaine) => ({ done: Boolean(ratings[domaine.id]) }),
    onClick: (domaine) => {
      window.location.href = `../notation/index.html?domaine=${encodeURIComponent(domaine.id)}`;
    },
  });
}

main().catch(showDbError);
