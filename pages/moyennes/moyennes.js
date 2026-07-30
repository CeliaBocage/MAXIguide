// Page des moyennes : stats du groupe, plan moyen avec les stickers du groupe,
// détail par participant et par domaine en menus déroulants.
// (Les podiums, eux, vivent dans pages/classements.)
const pct = (ratio) => `${Math.round(ratio * 100)} %`;

// Résumé compact d'une fiche : ⚪4 🔴3 ❤️❤️ ⭐ 🦄🦄 …
// (le sticker perso s'affiche avec l'emoji du guide, u.emoji de getAllRatings)
function ficheParts(fiche) {
  const parts = [];
  if (fiche.note_blanc) parts.push(`⚪${fiche.note_blanc}`);
  if (fiche.note_rouge) parts.push(`🔴${fiche.note_rouge}`);
  if (fiche.note_rose) parts.push(`🌸${fiche.note_rose}`);
  if (fiche.note_whisky) parts.push(`🥃${fiche.note_whisky}`);
  if (fiche.note_jus) parts.push(`🍇${fiche.note_jus}`);
  if (fiche.coeur) parts.push('❤️'.repeat(fiche.coeur));
  if (fiche.etoile) parts.push('⭐'.repeat(fiche.etoile));
  if (fiche.perso) parts.push((fiche.user_emoji || '✨').repeat(fiche.perso));
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
  // Les photos ne descendent pas avec les fiches (elles pèsent trop lourd pour
  // 51 domaines × tout le monde) : un bouton va les chercher à la demande.
  if (fiche.nb_photos) {
    line.appendChild(makePhotoLoader(
      fiche.nb_photos,
      () => Storage.getFichePhotos(fiche.user_id, fiche.domaine_id)
    ));
  }
  return line;
}

// <details> avec un résumé à deux colonnes (titre à gauche, méta à droite).
// rank (facultatif) : { label, title } d'une pastille de classement posée
// avant le titre — les participants n'en ont pas, les domaines si.
function accordion(summaryLeft, summaryRight, rank) {
  const details = document.createElement('details');
  details.className = 'accordion';

  const summary = document.createElement('summary');
  const left = document.createElement('span');
  left.className = 'acc-title';
  left.textContent = summaryLeft;
  const right = document.createElement('span');
  right.className = 'acc-meta';
  right.textContent = summaryRight;

  if (rank) {
    const badge = document.createElement('span');
    badge.className = 'acc-rank';
    badge.textContent = rank.label;
    badge.title = rank.title;
    summary.appendChild(badge);
  }
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
  const user = await Header.mount('moyennes');
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

  // Stats du groupe
  const avgCompletion = users.length && DOMAINES.length
    ? users.reduce((acc, u) => acc + byUser.get(u.id).length / DOMAINES.length, 0) / users.length
    : 0;
  const covered = DOMAINES.filter(d => byDomaine.get(d.id).length > 0).length;
  document.getElementById('stat-avg-completion').textContent = pct(avgCompletion);
  document.getElementById('stat-coverage').textContent =
    pct(DOMAINES.length ? covered / DOMAINES.length : 0);

  // Plan moyen : les stickers moyens du groupe (arrondis) posés sur chaque stand,
  // et l'emoji de chaque participant passé par le stand affiché en dessous
  const decorateGroupe = (domaine) => {
    const rows = byDomaine.get(domaine.id);
    if (!rows.length) return {};
    const badge = '❤️'.repeat(Math.round(avgOf(rows, 'coeur')))
      + '⭐'.repeat(Math.round(avgOf(rows, 'etoile')))
      + '✨'.repeat(Math.round(avgOf(rows, 'perso')));
    const guides = rows.map(r => r.user_emoji || '✨');
    return { done: true, badge, guides, score: carteScore(rows) };
  };
  renderPlan(document.getElementById('plan-container'), { decorate: decorateGroupe });

  // Même chose, mais sur la carte réelle du vignoble : la pastille de chaque
  // domaine se teinte selon la note moyenne que le groupe lui a donnée.
  renderCarte(document.getElementById('carte-container'), { decorate: decorateGroupe });

  // Détail par participant : un menu déroulant par personne, avec toutes ses fiches
  const usersAcc = document.getElementById('users-acc');
  for (const u of users) {
    const rows = byUser.get(u.id);
    const completion = DOMAINES.length ? pct(rows.length / DOMAINES.length) : '—';
    const { details, body } = accordion(
      u.emoji ? `${u.emoji} ${u.name}` : u.name,
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

  // Détail par domaine : moyennes par boisson + la fiche de chaque participant.
  // La liste suit le classement général — du mieux noté au moins bien noté,
  // les domaines que personne n'a encore notés fermant la marche par n° de stand.
  const domainesAcc = document.getElementById('domaines-acc');
  const classement = classementDomaines(byDomaine);
  const MEDALS = ['🥇', '🥈', '🥉'];
  // Les non-classés partagent tous le même rang de repli — fini, et non pas
  // Infinity, sinon Infinity - Infinity donne NaN et le tri n'est plus défini.
  // À rang égal le tri reste stable : ils gardent leur ordre de n° de stand.
  const rangDe = (d) => classement.get(d.id)?.rank ?? DOMAINES.length + 1;
  const domainesTries = [...DOMAINES].sort((a, b) => rangDe(a) - rangDe(b));

  for (const domaine of domainesTries) {
    const rows = byDomaine.get(domaine.id);
    const place = classement.get(domaine.id);
    const persoAvg = rows.length ? avgOf(rows, 'perso') : 0;
    // La note qui décide de la place s'affiche en tête : sans elle, le rang
    // n'est lisible qu'au survol, et il n'y a pas de survol sur un téléphone.
    // Une fiche peut n'avoir que des ❤️/⭐ sans note de boisson : dans ce cas
    // le domaine a bien des fiches, mais pas de note et donc pas de place.
    const meta = rows.length
      ? (place ? `${place.avg.toFixed(1)}/5 · ` : '')
        + `${countCards(rows.length)}`
        + ` · ❤️ ${avgOf(rows, 'coeur').toFixed(1)} ⭐ ${avgOf(rows, 'etoile').toFixed(1)}`
        + (persoAvg ? ` ✨ ${persoAvg.toFixed(1)}` : '')
      : t('moy.noCards');
    // Podium pour les trois premiers, puis le numéro de place tout simple
    const rank = place
      ? {
        label: MEDALS[place.rank - 1] || t('moy.rankBadge', { n: place.rank }),
        title: t('moy.rankTitle', { n: place.rank, avg: place.avg.toFixed(1) }),
      }
      : { label: '·', title: t('moy.rankNone') };
    const { details, body } = accordion(`${domaine.stand} · ${domaine.name}`, meta, rank);
    details.dataset.search = cleRecherche(`${domaine.stand} ${domaine.name}`);

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

      for (const r of rows) {
        body.appendChild(ficheLine(
          r.user_emoji ? `${r.user_emoji} ${r.user_name}` : r.user_name, r
        ));
      }
    }
    domainesAcc.appendChild(details);
  }

  // Recherche dans le détail par domaine : 51 menus déroulants, c'est long à
  // faire défiler quand on cherche juste celui devant lequel on est.
  const searchEl = document.getElementById('domaines-search');
  const emptyEl = document.getElementById('domaines-empty');
  searchEl.setAttribute('aria-label', t('domaines.searchPlaceholder'));
  searchEl.addEventListener('input', () => {
    const q = cleRecherche(searchEl.value);
    let visibles = 0;
    for (const details of domainesAcc.children) {
      const ok = !q || details.dataset.search.includes(q);
      details.hidden = !ok;
      if (ok) visibles++;
    }
    emptyEl.hidden = visibles > 0;
  });
}

main().catch(showDbError);
