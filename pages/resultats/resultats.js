// Page des résultats : classements en direct, stats du groupe, plan moyen avec
// les stickers du groupe, détail par participant et par domaine en menus déroulants.
const pct = (ratio) => `${Math.round(ratio * 100)} %`;

// --- Classements 🏆 ---

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

  // Meilleur par boisson (blanc, rouge, rosé, whisky, jus)
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
      if (s) bottles.push({ name: `${boisson.label.split(' ')[0]} ${d.name}`, s });
    }
  }
  bottles.sort((a, b) => byAvg(a.s, b.s));
  container.appendChild(podium(
    t('res.bestBottle'),
    bottles.map(x => avgEntry(x.name, x.s))
  ));

  // Le meilleur domaine : toutes les notes de boissons confondues
  const overall = DOMAINES
    .map(d => {
      const rows = byDomaine.get(d.id);
      const notes = rows.flatMap(r => NOTE_KEYS.map(k => r[k]).filter(Boolean));
      if (!notes.length) return null;
      return { d, s: { avg: notes.reduce((a, n) => a + n, 0) / notes.length, count: notes.length } };
    })
    .filter(Boolean)
    .sort((a, b) => byAvg(a.s, b.s));
  container.appendChild(podium(
    t('res.bestDomaine'),
    overall.map(x => avgEntry(x.d.name, x.s))
  ));

  // Les plus gentils (total de ❤️) et les plus étoilés (total de ⭐)
  for (const [key, titleKey, emoji] of [['coeur', 'res.nicest', '❤️'], ['etoile', 'res.starriest', '⭐']]) {
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
      name: x.u.name,
      value: `${x.count}/${DOMAINES.length} · ${pct(x.count / DOMAINES.length)}`,
    }))
  ));
}

// Résumé compact d'une fiche : ⚪4 🔴3 ❤️❤️ ⭐ …
function ficheParts(fiche) {
  const parts = [];
  if (fiche.note_blanc) parts.push(`⚪${fiche.note_blanc}`);
  if (fiche.note_rouge) parts.push(`🔴${fiche.note_rouge}`);
  if (fiche.note_rose) parts.push(`🌸${fiche.note_rose}`);
  if (fiche.note_whisky) parts.push(`🥃${fiche.note_whisky}`);
  if (fiche.note_jus) parts.push(`🍇${fiche.note_jus}`);
  if (fiche.coeur) parts.push('❤️'.repeat(fiche.coeur));
  if (fiche.etoile) parts.push('⭐'.repeat(fiche.etoile));
  return parts.join(' ');
}

// Une ligne « qui / quoi » dans le corps d'un menu déroulant, avec le commentaire dessous
function ficheLine(who, fiche) {
  const line = document.createElement('div');
  line.className = 'fiche-line';

  const whoEl = document.createElement('span');
  whoEl.className = 'fiche-who';
  whoEl.textContent = who;

  const notesEl = document.createElement('span');
  notesEl.className = 'fiche-notes';
  notesEl.textContent = ficheParts(fiche) || t('domaines.emptyCard');

  line.append(whoEl, notesEl);

  if (fiche.commentaire) {
    const comment = document.createElement('p');
    comment.className = 'fiche-comment';
    comment.textContent = `« ${fiche.commentaire} »`;
    line.appendChild(comment);
  }
  return line;
}

// <details> avec un résumé à deux colonnes (titre à gauche, méta à droite)
function accordion(summaryLeft, summaryRight) {
  const details = document.createElement('details');
  details.className = 'accordion';

  const summary = document.createElement('summary');
  const left = document.createElement('span');
  left.className = 'acc-title';
  left.textContent = summaryLeft;
  const right = document.createElement('span');
  right.className = 'acc-meta';
  right.textContent = summaryRight;
  summary.append(left, right);

  const body = document.createElement('div');
  body.className = 'accordion-body';

  details.append(summary, body);
  return { details, body };
}

function mutedP(text) {
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = text;
  return p;
}

const countCards = (n) => t(n === 1 ? 'moy.card' : 'moy.cards', { n });

async function main() {
  const user = await Header.mount('resultats');
  if (!user) return;

  const [users, allRatings] = await Promise.all([
    Storage.getUsers(),
    Storage.getAllRatings(),
  ]);

  // Regroupement des fiches par participant et par domaine
  const byUser = new Map(users.map(u => [u.id, []]));
  const byDomaine = new Map(DOMAINES.map(d => [d.id, []]));
  for (const r of allRatings) {
    byUser.get(r.user_id)?.push(r);
    byDomaine.get(r.domaine_id)?.push(r);
  }
  const avgOf = (rows, key) => rows.reduce((acc, r) => acc + (r[key] || 0), 0) / rows.length;

  // Classements 🏆
  renderRankings(users, byUser, byDomaine);

  // Stats du groupe
  const avgCompletion = users.length && DOMAINES.length
    ? users.reduce((acc, u) => acc + byUser.get(u.id).length / DOMAINES.length, 0) / users.length
    : 0;
  const covered = DOMAINES.filter(d => byDomaine.get(d.id).length > 0).length;
  document.getElementById('stat-avg-completion').textContent = pct(avgCompletion);
  document.getElementById('stat-coverage').textContent =
    pct(DOMAINES.length ? covered / DOMAINES.length : 0);

  // Plan moyen : les stickers moyens du groupe (arrondis) posés sur chaque stand
  renderPlan(document.getElementById('plan-container'), {
    decorate: (domaine) => {
      const rows = byDomaine.get(domaine.id);
      if (!rows.length) return {};
      const badge = '❤️'.repeat(Math.round(avgOf(rows, 'coeur')))
        + '⭐'.repeat(Math.round(avgOf(rows, 'etoile')));
      return { done: true, badge };
    },
  });

  // Détail par participant : un menu déroulant par personne, avec toutes ses fiches
  const usersAcc = document.getElementById('users-acc');
  for (const u of users) {
    const rows = byUser.get(u.id);
    const completion = DOMAINES.length ? pct(rows.length / DOMAINES.length) : '—';
    const { details, body } = accordion(
      u.name,
      `${t('moy.ratedCount', { rated: rows.length, total: DOMAINES.length })} · ${completion}`
    );

    if (!rows.length) {
      body.appendChild(mutedP(t('moy.noRatingsUser')));
    } else {
      for (const domaine of DOMAINES) {
        const fiche = rows.find(r => r.domaine_id === domaine.id);
        if (fiche) body.appendChild(ficheLine(`${domaine.stand} · ${domaine.name}`, fiche));
      }
    }
    usersAcc.appendChild(details);
  }

  // Détail par domaine : moyennes par boisson + la fiche de chaque participant
  const domainesAcc = document.getElementById('domaines-acc');
  for (const domaine of DOMAINES) {
    const rows = byDomaine.get(domaine.id);
    const meta = rows.length
      ? `${countCards(rows.length)} · ❤️ ${avgOf(rows, 'coeur').toFixed(1)} ⭐ ${avgOf(rows, 'etoile').toFixed(1)}`
      : t('moy.noCards');
    const { details, body } = accordion(`${domaine.stand} · ${domaine.name}`, meta);

    if (!rows.length) {
      body.appendChild(mutedP(t('moy.noRatingsDomaine')));
    } else {
      // Note moyenne par boisson (seulement celles notées au moins une fois)
      const avgLine = document.createElement('div');
      avgLine.className = 'fiche-line avg-line';
      const label = document.createElement('span');
      label.className = 'fiche-who';
      label.textContent = t('moy.averages');
      const values = document.createElement('span');
      values.className = 'fiche-notes avg-bottles';
      for (const boisson of getBoissons(domaine)) {
        const noted = rows.filter(r => r[boisson.key]);
        if (!noted.length) continue;
        const avg = noted.reduce((a, r) => a + r[boisson.key], 0) / noted.length;

        const cell = document.createElement('span');
        cell.className = 'guide-note';
        const emoji = document.createElement('span');
        emoji.textContent = boisson.label.split(' ')[0];
        const bottle = document.createElement('span');
        bottle.className = 'bottle-mini';
        bottle.appendChild(makeBottleSvg(boisson.color, avg).svg);
        const score = document.createElement('span');
        score.className = 'guide-note-value';
        score.textContent = `${avg.toFixed(1)}/5`;
        cell.append(emoji, bottle, score);
        values.appendChild(cell);
      }
      if (!values.childElementCount) values.textContent = '—';
      avgLine.append(label, values);
      body.appendChild(avgLine);

      for (const r of rows) body.appendChild(ficheLine(r.user_name, r));
    }
    domainesAcc.appendChild(details);
  }
}

main().catch(showDbError);
