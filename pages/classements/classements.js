// Page des classements 🏆 : podiums en direct (par boisson, meilleure bouteille,
// meilleur domaine, stickers, guides les plus complets), calculés sur toutes les fiches.
const pct = (ratio) => `${Math.round(ratio * 100)} %`;

// Un podium : carte avec un titre et jusqu'à trois lignes médaillées.
// entries : [{ name, value }] déjà triées du meilleur au moins bon.
function podium(title, entries) {
  const card = document.createElement('div');
  card.className = 'ranking-card';

  const h3 = document.createElement('h3');
  h3.textContent = title;
  card.appendChild(h3);

  if (!entries.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = t('res.noRanking');
    card.appendChild(p);
    return card;
  }

  const ol = document.createElement('ol');
  ol.className = 'podium';
  const MEDALS = ['🥇', '🥈', '🥉'];
  entries.slice(0, 3).forEach((entry, i) => {
    const li = document.createElement('li');
    const medal = document.createElement('span');
    medal.className = 'podium-medal';
    medal.textContent = MEDALS[i];
    const name = document.createElement('span');
    name.className = 'podium-name';
    name.textContent = entry.name;
    const value = document.createElement('span');
    value.className = 'podium-value';
    value.textContent = entry.value;
    li.append(medal, name, value);
    ol.appendChild(li);
  });
  card.appendChild(ol);
  return card;
}

const countNotes = (n) => t(n === 1 ? 'res.note' : 'res.notes', { n });

// Tous les classements, calculés à partir des fiches groupées par domaine.
function renderRankings(users, byUser, byDomaine) {
  const container = document.getElementById('rankings');
  container.replaceChildren();

  // Moyenne d'une boisson pour un domaine (null si personne ne l'a notée)
  const drinkAvg = (rows, key) => {
    const noted = rows.filter(r => r[key]);
    if (!noted.length) return null;
    return {
      avg: noted.reduce((a, r) => a + r[key], 0) / noted.length,
      count: noted.length,
    };
  };
  const byAvg = (a, b) => b.avg - a.avg || b.count - a.count;
  const avgEntry = (name, s) =>
    ({ name, value: `${s.avg.toFixed(1)}/5 · ${countNotes(s.count)}` });

  // Meilleur par boisson (blanc, rouge, rosé, méthode, liqueur, jus)
  for (const boisson of Object.values(BOISSONS)) {
    const scored = DOMAINES
      .map(d => ({ d, s: drinkAvg(byDomaine.get(d.id), boisson.key) }))
      .filter(x => x.s)
      .sort((a, b) => byAvg(a.s, b.s));
    container.appendChild(podium(
      t('res.best', { boisson: boisson.label }),
      scored.map(x => avgEntry(x.d.name, x.s))
    ));
  }

  // La meilleure bouteille toutes boissons confondues (couple domaine + boisson)
  const bottles = [];
  for (const d of DOMAINES) {
    for (const boisson of getBoissons(d)) {
      const s = drinkAvg(byDomaine.get(d.id), boisson.key);
      if (s) bottles.push({ name: `${boissonEmoji(boisson)} ${d.name}`, s });
    }
  }
  bottles.sort((a, b) => byAvg(a.s, b.s));
  container.appendChild(podium(
    t('res.bestBottle'),
    bottles.map(x => avgEntry(x.name, x.s))
  ));

  // Le meilleur domaine : toutes les notes de boissons confondues.
  // classementDomaines() (js/data/domaines.js) fait le calcul et le tri —
  // c'est ce même classement que la page Moyennes affiche domaine par domaine.
  const overall = [...classementDomaines(byDomaine)]; // déjà trié, du meilleur au moins bon
  container.appendChild(podium(
    t('res.bestDomaine'),
    overall.map(([id, s]) => avgEntry(getDomaine(id).name, s))
  ));

  // Les plus gentils (❤️), les plus étoilés (⭐) et les plus stickés (persos)
  for (const [key, titleKey, emoji] of [
    ['coeur', 'res.nicest', '❤️'],
    ['etoile', 'res.starriest', '⭐'],
    ['perso', 'res.mostStickered', '✨'],
  ]) {
    const totals = DOMAINES
      .map(d => ({ d, total: byDomaine.get(d.id).reduce((a, r) => a + (r[key] || 0), 0) }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total);
    container.appendChild(podium(
      t(titleKey),
      totals.map(x => ({ name: x.d.name, value: `${emoji} × ${x.total}` }))
    ));
  }

  // Les guides les plus complets
  const completest = users
    .map(u => ({ u, count: byUser.get(u.id).length }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);
  container.appendChild(podium(
    t('res.completest'),
    completest.map(x => ({
      name: x.u.emoji ? `${x.u.emoji} ${x.u.name}` : x.u.name,
      value: `${x.count}/${DOMAINES.length} · ${pct(x.count / DOMAINES.length)}`,
    }))
  ));
}

async function main() {
  const user = await Header.mount('classements');
  if (!user) return;

  const [users, allRatings] = await Promise.all([
    Storage.getUsers(),
    Storage.getAllRatings(),
  ]);

  const byUser = new Map(users.map(u => [u.id, []]));
  const byDomaine = new Map(DOMAINES.map(d => [d.id, []]));
  for (const r of allRatings) {
    byUser.get(r.user_id)?.push(r);
    byDomaine.get(r.domaine_id)?.push(r);
  }

  renderRankings(users, byUser, byDomaine);
}

main().catch(showDbError);
