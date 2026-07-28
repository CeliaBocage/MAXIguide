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

  // Plan moyen : les stickers moyens du groupe (arrondis) posés sur chaque stand
  renderPlan(document.getElementById('plan-container'), {
    decorate: (domaine) => {
      const rows = byDomaine.get(domaine.id);
      if (!rows.length) return {};
      const badge = '❤️'.repeat(Math.round(avgOf(rows, 'coeur')))
        + '⭐'.repeat(Math.round(avgOf(rows, 'etoile')))
        + '✨'.repeat(Math.round(avgOf(rows, 'perso')));
      return { done: true, badge };
    },
  });

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

  // Détail par domaine : moyennes par boisson + la fiche de chaque participant
  const domainesAcc = document.getElementById('domaines-acc');
  for (const domaine of DOMAINES) {
    const rows = byDomaine.get(domaine.id);
    const persoAvg = rows.length ? avgOf(rows, 'perso') : 0;
    const meta = rows.length
      ? `${countCards(rows.length)} · ❤️ ${avgOf(rows, 'coeur').toFixed(1)} ⭐ ${avgOf(rows, 'etoile').toFixed(1)}`
        + (persoAvg ? ` ✨ ${persoAvg.toFixed(1)}` : '')
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

      for (const r of rows) {
        body.appendChild(ficheLine(
          r.user_emoji ? `${r.user_emoji} ${r.user_name}` : r.user_name, r
        ));
      }
    }
    domainesAcc.appendChild(details);
  }
}

main().catch(showDbError);
