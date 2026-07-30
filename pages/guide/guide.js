// Page de visualisation du guide d'un invité (?user=<id>) — lecture seule,
// accessible sans avoir choisi de profil.
const select = document.getElementById('user-select');
const content = document.getElementById('guide-content');
const listEl = document.getElementById('guide-list');
const emptyEl = document.getElementById('guide-empty');

// Une note de boisson : émoji + petite bouteille remplie à value/5 + « x/5 ».
function noteCell(boisson, value) {
  const span = document.createElement('span');
  span.className = 'guide-note';
  if (!value) return span;

  const emoji = document.createElement('span');
  emoji.textContent = boisson.label.split(' ')[0];

  const bottle = document.createElement('span');
  bottle.className = 'bottle-mini';
  bottle.appendChild(makeBottleSvg(boisson.color, value).svg);

  const score = document.createElement('span');
  score.className = 'guide-note-value';
  score.textContent = `${value}/5`;

  span.append(emoji, bottle, score);
  return span;
}

let usersById = new Map(); // pour retrouver le sticker perso de chaque guide

// Tous les stickers d'une fiche : ❤️⭐ + le sticker perso du guide
function stickerString(fiche, persoEmoji) {
  return '❤️'.repeat(fiche.coeur || 0)
    + '⭐'.repeat(fiche.etoile || 0)
    + (persoEmoji || '✨').repeat(fiche.perso || 0);
}

async function renderGuide(userId) {
  if (!userId) {
    content.hidden = true;
    return;
  }

  const persoEmoji = usersById.get(userId)?.emoji;
  const ratings = await Storage.getUserRatings(userId);

  // Son classement à lui : les mêmes règles que le classement du groupe
  // (classementDomaines, partagé avec les Classements et les Moyennes), mais
  // sur ses seules fiches. Ses meilleurs domaines passent donc devant.
  const classement = classementDomaines(
    new Map(DOMAINES.map(d => [d.id, ratings[d.id] ? [ratings[d.id]] : []]))
  );
  // Une fiche sans aucune note de boisson (que des ❤️/⭐) n'a pas de place :
  // elle ferme la marche, dans l'ordre des stands.
  const rangDe = (d) => classement.get(d.id)?.rank ?? DOMAINES.length + 1;
  const rated = DOMAINES.filter(d => ratings[d.id]).sort((a, b) => rangDe(a) - rangDe(b));
  const MEDALS = ['🥇', '🥈', '🥉'];

  listEl.replaceChildren();
  emptyEl.hidden = rated.length > 0;
  content.hidden = false;

  // Son plan : ses stickers ❤️/⭐/perso posés sur les stands
  const decorateSes = (domaine) => {
    const fiche = ratings[domaine.id];
    if (!fiche) return {};
    return { done: true, badge: stickerString(fiche, persoEmoji), score: carteScore([fiche]) };
  };
  renderPlan(document.getElementById('plan-container'), { decorate: decorateSes });

  // Sa carte : les mêmes domaines, là où ils se trouvent vraiment
  renderCarte(document.getElementById('carte-container'), { decorate: decorateSes });

  for (const domaine of rated) {
    const fiche = ratings[domaine.id];
    const li = document.createElement('li');
    li.className = 'guide-card';

    const title = document.createElement('div');
    title.className = 'guide-card-title';

    // Sa place à lui, et la note qui la lui donne : 🥇 4,5/5
    const place = classement.get(domaine.id);
    const rank = document.createElement('span');
    rank.className = 'guide-rank';
    if (place) {
      rank.textContent = `${MEDALS[place.rank - 1] || t('moy.rankBadge', { n: place.rank })} `
        + t('guide.rankScore', { avg: place.avg.toFixed(1).replace('.', ',') });
      rank.title = t('guide.rankTitle', { n: place.rank, avg: place.avg.toFixed(1) });
    } else {
      rank.textContent = '·';
      rank.title = t('moy.rankNone');
    }

    const name = document.createElement('span');
    name.className = 'domaine-name';
    name.textContent = `${domaine.stand} · ${domaine.name}`;

    const left = document.createElement('span');
    left.className = 'guide-card-left';
    left.append(rank, name);

    const stickers = document.createElement('span');
    stickers.className = 'guide-stickers';
    stickers.textContent = stickerString(fiche, persoEmoji);

    title.append(left, stickers);
    li.appendChild(title);

    const notes = document.createElement('div');
    notes.className = 'guide-notes';
    for (const boisson of Object.values(BOISSONS)) {
      if (fiche[boisson.key]) notes.append(noteCell(boisson, fiche[boisson.key]));
    }
    li.appendChild(notes);

    if (fiche.commentaire) {
      const comment = document.createElement('p');
      comment.className = 'guide-comment';
      comment.textContent = `« ${fiche.commentaire} »`;
      li.appendChild(comment);
    }

    // Les photos restent en base jusqu'à ce qu'on demande à les voir : un guide
    // bien rempli en compte des dizaines, et elles arriveraient toutes d'un coup.
    if (fiche.nb_photos) {
      li.appendChild(makePhotoLoader(
        fiche.nb_photos,
        () => Storage.getFichePhotos(userId, domaine.id)
      ));
    }

    listEl.appendChild(li);
  }
}

async function main() {
  // Page ouverte à tous : le header s'affiche même sans profil choisi
  const moi = await Header.mount('guides', { requireUser: false }).catch(() => null);

  const users = await Storage.getUsers();
  usersById = new Map(users.map(u => [u.id, u]));
  for (const user of users) {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.emoji ? `${user.emoji} ${user.name}` : user.name;
    select.appendChild(option);
  }

  // Pré-sélection : le guide demandé par ?user=<id>, sinon le sien quand on est
  // connecté — l'onglet Guides tombe ainsi directement sur son classement.
  const demande = new URLSearchParams(window.location.search).get('user');
  const preselected = [demande, moi?.id].find(id => id && users.some(u => u.id === id));
  if (preselected) {
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
