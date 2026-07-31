// Page des domaines : vue liste / vue plan, accès à la notation
const listEl = document.getElementById('domaine-list');
const viewList = document.getElementById('view-list');
const viewPlan = document.getElementById('view-plan');
const toggleList = document.getElementById('toggle-list');
const togglePlan = document.getElementById('toggle-plan');
const searchEl = document.getElementById('list-search');
const emptyEl = document.getElementById('list-empty');

function showView(view) {
  viewList.hidden = view !== 'list';
  viewPlan.hidden = view !== 'plan';
  toggleList.classList.toggle('active', view === 'list');
  togglePlan.classList.toggle('active', view === 'plan');
}

toggleList.addEventListener('click', () => showView('list'));
togglePlan.addEventListener('click', () => showView('plan'));

// La barre de recherche et les chips se combinent : un seul endroit décide
// quelles lignes restent visibles.
let filtreActif = 'all';

function refreshList() {
  const q = cleRecherche(searchEl.value);
  let visibles = 0;
  for (const li of listEl.children) {
    const ok = (filtreActif === 'all' || li.dataset.status === filtreActif)
      && (!q || li.dataset.search.includes(q));
    li.hidden = !ok;
    if (ok) visibles++;
  }
  emptyEl.hidden = visibles > 0;
}

searchEl.setAttribute('aria-label', t('domaines.searchPlaceholder'));
searchEl.addEventListener('input', refreshList);

// Chips de filtre au-dessus de la liste : idéal pour repérer d'un coup d'œil
// ce qu'il reste à déguster.
function renderFilters(ratings) {
  const filtersEl = document.getElementById('list-filters');
  const ratedCount = DOMAINES.filter(d => ratings[d.id]).length;
  const FILTERS = [
    { key: 'all', label: t('domaines.filterAll'), count: DOMAINES.length },
    { key: 'todo', label: t('domaines.filterTodo'), count: DOMAINES.length - ratedCount },
    { key: 'done', label: t('domaines.filterDone'), count: ratedCount },
  ];

  const apply = (key) => {
    filtreActif = key;
    for (const btn of filtersEl.children) {
      btn.classList.toggle('active', btn.dataset.filter === key);
    }
    refreshList();
  };

  filtersEl.replaceChildren();
  for (const f of FILTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-chip';
    btn.dataset.filter = f.key;
    btn.textContent = `${f.label} (${f.count})`;
    btn.addEventListener('click', () => apply(f.key));
    filtersEl.appendChild(btn);
  }
  apply('all');
}

async function main() {
  const user = await Header.mount('domaines');
  if (!user) return;

  const ratings = await Storage.getUserRatings(user.id);
  listEl.replaceChildren();

  for (const domaine of DOMAINES) {
    const li = document.createElement('li');
    li.dataset.status = ratings[domaine.id] ? 'done' : 'todo';
    // On cherche sur le n° de stand et le nom : « 27 » comme « mas d'aurel »
    // doivent ramener le bon domaine.
    li.dataset.search = cleRecherche(`${domaine.stand} ${domaine.name}`);
    const link = document.createElement('a');
    link.className = 'domaine-card';
    link.href = `../notation/index.html?domaine=${encodeURIComponent(domaine.id)}`;

    const name = document.createElement('span');
    name.className = 'domaine-name';
    name.textContent = `${domaine.stand} · ${domaine.name}`;
    if (domaine.type !== 'vin') name.textContent += domaine.type === 'liqueur' ? ' 🥃' : ' 🍷🥃';

    const status = document.createElement('span');
    status.className = 'domaine-status';
    const fiche = ratings[domaine.id];
    if (fiche) {
      // Une boisson notée = son emoji et sa note (l'ordre est celui de BOISSONS)
      const parts = [];
      for (const boisson of Object.values(BOISSONS)) {
        if (fiche[boisson.key]) parts.push(`${boissonEmoji(boisson)}${fiche[boisson.key]}`);
      }
      if (fiche.coeur) parts.push('❤️'.repeat(fiche.coeur));
      if (fiche.etoile) parts.push('⭐'.repeat(fiche.etoile));
      if (fiche.perso) parts.push((user.emoji || '✨').repeat(fiche.perso));
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

  renderFilters(ratings);

  // Vue plan : stands cliquables, verts quand la fiche existe
  renderPlan(document.getElementById('plan-container'), {
    decorate: (domaine) => ({ done: Boolean(ratings[domaine.id]) }),
    onClick: (domaine) => {
      window.location.href = `../notation/index.html?domaine=${encodeURIComponent(domaine.id)}`;
    },
  });
}

main().catch(showDbError);
