// Tests MAXIguide — s'exécutent dans le navigateur, sans Node ni réseau :
// fetch est remplacé par des simulateurs (panne, erreur HTTP, réponse Turso).
// Ouvrir tests/index.html et vérifier que tout est vert.

// --- Mini-lanceur de tests ---

const TESTS = [];
function test(name, fn) { TESTS.push({ name, fn }); }

function assert(cond, message) {
  if (!cond) throw new Error(message || 'assertion échouée');
}

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message || 'valeurs différentes'} — attendu ${e}, obtenu ${a}`);
}

async function assertThrows(fn, check, message) {
  try {
    await fn();
  } catch (err) {
    if (check) check(err);
    return err;
  }
  throw new Error(message || 'une erreur était attendue');
}

// --- Simulateurs de fetch (le vrai réseau n'est jamais touché) ---

const realFetch = window.fetch;
let fetchCalls = []; // corps JSON des requêtes envoyées, dans l'ordre

function tursoRow(cols, values) {
  return values.map(v => {
    if (v === null) return { type: 'null', value: null };
    if (typeof v === 'number' && Number.isInteger(v)) return { type: 'integer', value: String(v) };
    if (typeof v === 'number') return { type: 'float', value: v };
    return { type: 'text', value: String(v) };
  });
}

// Réponse Turso réussie : rows = [{col: valeur}]
function mockFetchOK(rows = []) {
  fetchCalls = [];
  const cols = rows.length ? Object.keys(rows[0]).map(name => ({ name })) : [];
  window.fetch = async (url, opts) => {
    fetchCalls.push(JSON.parse(opts.body));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: [{
          type: 'ok',
          response: { result: { cols, rows: rows.map(r => tursoRow(cols, Object.values(r))) } },
        }],
      }),
    };
  };
}

// Panne de réseau : fetch rejette, comme dans un parc sans 4G
function mockFetchOffline() {
  fetchCalls = [];
  window.fetch = async () => { throw new TypeError('Failed to fetch'); };
}

function mockFetchHttp(status) {
  fetchCalls = [];
  window.fetch = async () => ({ ok: false, status, json: async () => ({}) });
}

// Turso répond mais la requête SQL est refusée
function mockFetchSqlError(message) {
  fetchCalls = [];
  window.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ results: [{ type: 'error', error: { message } }] }),
  });
}

// Le SQL envoyé par le n-ième appel (pour vérifier l'ordre des écritures)
function sentSql(i) {
  return fetchCalls[i].requests[0].stmt.sql;
}
function sentArgs(i) {
  return fetchCalls[i].requests[0].stmt.args.map(a => a.value);
}

// --- Isolation : chaque test repart d'un localStorage MAXIguide propre ---

function clearAppStorage() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('maxiguide.')) localStorage.removeItem(key);
  }
}

// =====================================================================
// db.js — conversion des types
// =====================================================================

test('toArg convertit entiers, décimaux, null et textes', () => {
  assertEqual(toArg(3), { type: 'integer', value: '3' });
  assertEqual(toArg(2.5), { type: 'float', value: 2.5 });
  assertEqual(toArg(null), { type: 'null', value: null });
  assertEqual(toArg(undefined), { type: 'null', value: null });
  assertEqual(toArg('salut'), { type: 'text', value: 'salut' });
});

test('parseCell fait le chemin inverse', () => {
  assertEqual(parseCell({ type: 'integer', value: '4' }), 4);
  assertEqual(parseCell({ type: 'float', value: 3.5 }), 3.5);
  assertEqual(parseCell({ type: 'null', value: null }), null);
  assertEqual(parseCell({ type: 'text', value: 'ok' }), 'ok');
});

test('dbExecute parse une réponse Turso en objets', async () => {
  mockFetchOK([{ id: 'u1', name: 'Célia' }]);
  const rows = await dbExecute('SELECT id, name FROM users');
  assertEqual(rows, [{ id: 'u1', name: 'Célia' }]);
});

// =====================================================================
// db.js — gestion d'erreurs : passagère (retryable) ou définitive ?
// =====================================================================

test('panne de réseau → erreur passagère (retryable)', async () => {
  mockFetchOffline();
  await assertThrows(
    () => dbExecute('SELECT 1'),
    err => assert(err.retryable === true, 'une panne de fetch doit être retryable')
  );
});

test('HTTP 500 et 429 → passagères ; HTTP 401 → définitive', async () => {
  mockFetchHttp(500);
  await assertThrows(() => dbExecute('SELECT 1'),
    err => assert(err.retryable === true, 'HTTP 500 doit être retryable'));
  mockFetchHttp(429);
  await assertThrows(() => dbExecute('SELECT 1'),
    err => assert(err.retryable === true, 'HTTP 429 doit être retryable'));
  mockFetchHttp(401);
  await assertThrows(() => dbExecute('SELECT 1'),
    err => assert(!err.retryable, 'HTTP 401 ne doit PAS être retryable'));
});

test('erreur SQL → définitive (réessayer ne servirait à rien)', async () => {
  mockFetchSqlError('no such table: ratings');
  await assertThrows(() => dbExecute('SELECT 1'), err => {
    assert(!err.retryable, 'une erreur SQL ne doit pas être retryable');
    assert(err.message.includes('no such table'), 'le message SQL doit remonter');
  });
});

// =====================================================================
// storage.js — file de synchronisation hors-ligne
// =====================================================================

const FICHE = { note_blanc: 4, note_rouge: 0, coeur: 2, etoile: 0, commentaire: 'très bon' };

test('hors-ligne, saveRating garde la fiche et prévient (queued)', async () => {
  clearAppStorage();
  mockFetchOffline();
  const { queued } = await Storage.saveRating('u1', 'rotier', FICHE);
  assert(queued === true, 'la fiche doit être signalée en attente');
  assertEqual(SyncQueue.size(), 1);
});

test('re-noter le même domaine hors-ligne remplace la fiche en attente', async () => {
  clearAppStorage();
  mockFetchOffline();
  await Storage.saveRating('u1', 'rotier', FICHE);
  await Storage.saveRating('u1', 'rotier', { ...FICHE, note_blanc: 5 });
  assertEqual(SyncQueue.size(), 1, 'une seule fiche par (utilisateur, domaine)');
  assertEqual(SyncQueue.load()[0].fiche.note_blanc, 5, 'la dernière version gagne');
});

test('les fiches en attente apparaissent dans getUserRatings (par-dessus le cache)', async () => {
  clearAppStorage();
  // 1. en ligne : une lecture réussie remplit le cache local
  mockFetchOK([]);
  await Storage.getUserRatings('u1');
  // 2. hors-ligne : on note, puis on relit
  mockFetchOffline();
  await Storage.saveRating('u1', 'rotier', FICHE);
  const ratings = await Storage.getUserRatings('u1');
  assert(ratings['rotier'], 'la fiche en attente doit être visible');
  assertEqual(ratings['rotier'].note_blanc, 4);
  assertEqual(ratings['rotier'].commentaire, 'très bon');
});

test('au retour du réseau, la file part toute seule et dans l’ordre', async () => {
  clearAppStorage();
  mockFetchOffline();
  await Storage.saveRating('u1', 'rotier', FICHE);
  await Storage.saveRating('u1', 'lastours', { ...FICHE, note_blanc: 3 });
  assertEqual(SyncQueue.size(), 2);

  mockFetchOK([]);
  const remaining = await SyncQueue.flush();
  assertEqual(remaining, 0, 'la file doit être vide après le flush');
  assertEqual(fetchCalls.length, 2, 'deux écritures doivent partir');
  assert(sentArgs(0).includes('rotier'), 'la première fiche notée part en premier');
  assert(sentArgs(1).includes('lastours'), 'la seconde part ensuite');
});

test('saveRating avec une file non vide se place derrière (ordre préservé)', async () => {
  clearAppStorage();
  mockFetchOffline();
  await Storage.saveRating('u1', 'rotier', FICHE);
  // le réseau revient juste avant la note suivante
  mockFetchOK([]);
  const { queued } = await Storage.saveRating('u1', 'lastours', FICHE);
  assert(queued === false, 'tout est parti, rien ne reste en attente');
  assertEqual(SyncQueue.size(), 0);
  assert(sentArgs(0).includes('rotier'), 'la fiche en attente part avant la nouvelle');
  assert(sentArgs(1).includes('lastours'));
});

test('si la panne persiste au flush, la fiche reste en attente', async () => {
  clearAppStorage();
  mockFetchOffline();
  await Storage.saveRating('u1', 'rotier', FICHE);
  const remaining = await SyncQueue.flush(); // toujours hors-ligne
  assertEqual(remaining, 1, 'la fiche doit rester dans la file');
});

test('une fiche vide devient une suppression (DELETE)', async () => {
  clearAppStorage();
  mockFetchOK([]);
  await Storage.saveRating('u1', 'rotier', { coeur: 0, etoile: 0, commentaire: '  ' });
  assert(sentSql(0).startsWith('DELETE'), 'une fiche vide doit supprimer la ligne');
});

test('hors-ligne sans cache, getUserRatings échoue proprement', async () => {
  clearAppStorage();
  mockFetchOffline();
  await assertThrows(
    () => Storage.getUserRatings('u1'),
    err => assert(err.retryable, "l'erreur réseau doit remonter telle quelle")
  );
});

// =====================================================================
// storage.js — profils sans doublons
// =====================================================================

test('normalizeName ignore accents, casse et espaces en trop', () => {
  assertEqual(normalizeName('  Célia  Dupont '), 'celia dupont');
  assertEqual(normalizeName('CELIA'), 'celia');
  assert(normalizeName('Céline') !== normalizeName('Célia'), 'des noms différents restent différents');
});

test('createUser refuse un nom déjà pris à l’accent ou la casse près', async () => {
  clearAppStorage();
  mockFetchOK([{ id: 'u1', name: 'Célia' }]); // la liste des profils existants
  const dup = await Storage.createUser(' celia ');
  assert(dup.error, 'celia ≈ Célia : doit être refusé');
  const dup2 = await Storage.createUser('CÉLIA');
  assert(dup2.error, 'CÉLIA ≈ Célia : doit être refusé');
});

test('createUser accepte un nom vraiment nouveau (et le nettoie)', async () => {
  clearAppStorage();
  mockFetchOK([{ id: 'u1', name: 'Célia' }]);
  const { user, error } = await Storage.createUser('  Jean   Pierre ');
  assert(!error, `pas d'erreur attendue (reçu : ${error})`);
  assertEqual(user.name, 'Jean Pierre', 'les espaces en trop sont nettoyés');
});

test('createUser refuse un nom vide', async () => {
  clearAppStorage();
  const { error } = await Storage.createUser('   ');
  assert(error, 'un nom vide doit être refusé');
});

// =====================================================================
// storage.js — stickers persos (un emoji par guide)
// =====================================================================

test('createUser enregistre le sticker perso choisi', async () => {
  clearAppStorage();
  mockFetchOK([]);
  const { user, error } = await Storage.createUser('Jean', '🦄');
  assert(!error, `pas d'erreur attendue (reçu : ${error})`);
  assertEqual(user.emoji, '🦄');
  assert(sentSql(1).startsWith('INSERT INTO users'), "l'insertion doit partir en base");
  assert(sentArgs(1).includes('🦄'), "l'emoji doit être envoyé en base");
});

test('createUser refuse un sticker déjà pris par un autre guide', async () => {
  clearAppStorage();
  mockFetchOK([{ id: 'u1', name: 'Célia', emoji: '🦄' }]);
  const { error } = await Storage.createUser('Jean', '🦄');
  assert(error, 'un emoji déjà pris doit être refusé');
});

test('setUserEmoji refuse l’emoji d’un autre, accepte le sien', async () => {
  clearAppStorage();
  mockFetchOK([{ id: 'u1', name: 'Célia', emoji: '🦄' }]);
  const dup = await Storage.setUserEmoji('u2', '🦄');
  assert(dup.error, "l'emoji d'un autre guide doit être refusé");
  const ok = await Storage.setUserEmoji('u1', '🦄'); // re-choisir le sien : ok
  assert(!ok.error, 'reprendre son propre emoji ne doit pas être une erreur');
});

test('normalizeCustomEmoji accepte les emojis du clavier, refuse le reste', () => {
  assertEqual(normalizeCustomEmoji(' 🤖 '), '🤖');
  assertEqual(normalizeCustomEmoji('❤️'), '❤️', 'emoji avec sélecteur de variante');
  assertEqual(normalizeCustomEmoji('👩‍🚀'), '👩‍🚀', 'emoji composé (ZWJ)');
  assertEqual(normalizeCustomEmoji('🤖🐸'), '🤖', 'seul le premier emoji est gardé');
  assertEqual(normalizeCustomEmoji('abc'), null, 'des lettres ne sont pas un sticker');
  assertEqual(normalizeCustomEmoji('3'), null, 'un chiffre non plus');
  assertEqual(normalizeCustomEmoji('   '), null);
  assertEqual(normalizeCustomEmoji(''), null);
});

test('setUserEmoji met à jour le profil en cache sur cet appareil', async () => {
  clearAppStorage();
  Storage.setCurrentUser('u1');
  mockFetchOK([{ id: 'u1', name: 'Célia', emoji: null }]);
  await Storage.getCurrentUser(); // remplit le cache
  await Storage.setUserEmoji('u1', '🐙');
  mockFetchOffline();
  const user = await Storage.getCurrentUser(); // relu depuis le cache
  assertEqual(user.emoji, '🐙', 'le cache local doit connaître le nouvel emoji');
});

// =====================================================================
// storage.js — divers
// =====================================================================

test('isEmptyFiche : vide si aucune note, aucun sticker, aucun mot', () => {
  assert(isEmptyFiche({ coeur: 0, etoile: 0, perso: 0, commentaire: ' ' }));
  assert(!isEmptyFiche({ note_rouge: 3, coeur: 0, etoile: 0 }));
  assert(!isEmptyFiche({ coeur: 1, etoile: 0 }));
  assert(!isEmptyFiche({ coeur: 0, etoile: 0, perso: 2 }), 'un sticker perso suffit à garder la fiche');
  assert(!isEmptyFiche({ coeur: 0, etoile: 0, commentaire: 'super' }));
});

test('isEmptyFiche : des photos suffisent à garder la fiche', () => {
  assert(isEmptyFiche({ coeur: 0, etoile: 0, photos: [] }));
  assert(!isEmptyFiche({ coeur: 0, etoile: 0, photos: ['data:image/jpeg;base64,AAA'] }));
});

test('parsePhotos : JSON → tableau, et tableau vide si la colonne est illisible', () => {
  assertEqual(parsePhotos('["a","b"]'), ['a', 'b']);
  assertEqual(parsePhotos(['a']), ['a'], 'un tableau déjà parsé repasse tel quel');
  assertEqual(parsePhotos(null), []);
  assertEqual(parsePhotos('pas du JSON'), []);
});

test('les photos partent en JSON (3 maximum) et reviennent en tableau', async () => {
  clearAppStorage();
  mockFetchOK([]);
  const photos = ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'];
  await Storage.saveRating('u1', 'rotier', { photos });
  assertEqual(JSON.parse(sentArgs(0).at(-1)), photos, 'la colonne photos doit contenir le tableau en JSON');

  mockFetchOK([]);
  await Storage.saveRating('u1', 'rotier', { photos: ['a', 'b', 'c', 'd'] });
  assertEqual(JSON.parse(sentArgs(0).at(-1)), ['a', 'b', 'c'], 'jamais plus de 3 photos en base');
});

// --- Photos : chargées seulement quand on veut les voir ---
// Elles pèsent ~100 Ko chacune : les listes de fiches ne transportent que leur
// nombre (nb_photos), et getFichePhotos va chercher celles d'une fiche.

test('la liste des fiches ne rapporte pas les photos, juste leur nombre', async () => {
  clearAppStorage();
  mockFetchOK([{ domaine_id: 'rotier', note_blanc: 4, nb_photos: 2 }]);
  const ratings = await Storage.getUserRatings('u1');
  assertEqual(ratings['rotier'].nb_photos, 2);
  assert(!('photos' in ratings['rotier']), 'les data-URL ne doivent pas descendre avec la liste');
  assert(!sentSql(0).includes(' photos'), `la requête ne doit pas lire la colonne : ${sentSql(0)}`);
});

test('getAllRatings non plus (des dizaines de photos, ça ferait des Mo)', async () => {
  clearAppStorage();
  mockFetchOK([{ user_id: 'u1', user_name: 'Célia', domaine_id: 'rotier', nb_photos: 1 }]);
  const all = await Storage.getAllRatings();
  assertEqual(all[0].nb_photos, 1);
  assert(!('photos' in all[0]), 'les data-URL ne doivent pas descendre avec les fiches du groupe');
});

test('getFichePhotos va chercher les photos d’une seule fiche', async () => {
  clearAppStorage();
  mockFetchOK([{ photos: '["data:image/jpeg;base64,AAA"]' }]);
  const photos = await Storage.getFichePhotos('u1', 'rotier');
  assertEqual(photos, ['data:image/jpeg;base64,AAA']);
  assert(sentArgs(0).includes('rotier'), 'on ne demande que cette fiche-là');

  // Rouvrir le même détail ne retélécharge rien
  mockFetchOffline();
  assertEqual(await Storage.getFichePhotos('u1', 'rotier'), ['data:image/jpeg;base64,AAA'],
    'les photos déjà chargées restent disponibles');
});

test('les photos d’une fiche en attente sont lisibles hors-ligne', async () => {
  clearAppStorage();
  mockFetchOK([]);
  await Storage.getUserRatings('u1'); // remplit le cache
  mockFetchOffline();
  await Storage.saveRating('u1', 'rotier', { ...FICHE, photos: ['data:image/jpeg;base64,AAA'] });

  // La fiche n'est pas encore en base : ses photos n'existent que dans la file
  const ratings = await Storage.getUserRatings('u1');
  assertEqual(ratings['rotier'].nb_photos, 1);
  assertEqual(await Storage.getFichePhotos('u1', 'rotier'), ['data:image/jpeg;base64,AAA']);
});

test('une fiche enregistrée sans ses photos ne les efface pas', async () => {
  clearAppStorage();
  // La page de notation n'a pas pu charger les photos : gardePhotos le dit
  mockFetchOK([]);
  await Storage.saveRating('u1', 'rotier', { ...FICHE, photos: [], gardePhotos: true });
  assert(!sentSql(0).includes('photos = excluded.photos'),
    `la colonne photos doit rester intacte : ${sentSql(0)}`);

  // …et une fiche vidée de tout le reste ne devient pas une suppression :
  // ses photos, elles, sont toujours là
  mockFetchOK([]);
  await Storage.saveRating('u1', 'rotier', { coeur: 0, etoile: 0, gardePhotos: true });
  assert(!sentSql(0).startsWith('DELETE'), 'la fiche a encore ses photos, on ne la supprime pas');

  // Sans gardePhotos, en revanche, rien ne retient la fiche vide
  mockFetchOK([]);
  await Storage.saveRating('u1', 'rotier', { coeur: 0, etoile: 0, photos: [] });
  assert(sentSql(0).startsWith('DELETE'));
});

test('makePhotoLoader ne charge les photos qu’au clic', async () => {
  let appels = 0;
  const btn = makePhotoLoader(2, async () => {
    appels++;
    return ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'];
  });
  const box = document.createElement('div');
  box.appendChild(btn);
  assertEqual(appels, 0, 'rien ne doit être chargé avant le clic');
  assert(btn.textContent.includes('2'), 'le bouton annonce le nombre de photos');

  btn.click();
  await new Promise(r => setTimeout(r, 0));
  assertEqual(appels, 1);
  assertEqual(box.querySelectorAll('.photo-strip img').length, 2,
    'les vignettes remplacent le bouton');
});

test('makePhotoLoader hors-ligne : le bouton reste, pour réessayer', async () => {
  const btn = makePhotoLoader(1, async () => { throw new Error('hors-ligne'); });
  const box = document.createElement('div');
  box.appendChild(btn);
  btn.click();
  await new Promise(r => setTimeout(r, 0));
  assert(box.contains(btn), 'le bouton doit rester en place');
  assert(!btn.disabled, 'et rester cliquable pour réessayer');
});

test('getCurrentUser retombe sur le cache local quand le réseau manque', async () => {
  clearAppStorage();
  Storage.setCurrentUser('u1');
  mockFetchOK([{ id: 'u1', name: 'Célia' }]);
  await Storage.getCurrentUser(); // remplit le cache
  mockFetchOffline();
  const user = await Storage.getCurrentUser();
  assertEqual(user, { id: 'u1', name: 'Célia' }, 'le profil connu doit revenir du cache');
});

// --- Carte réelle du vignoble ---

test('chaque domaine a une position réelle, à l’intérieur du cadre de la carte', () => {
  const missing = DOMAINES.filter(d => !CARTE_DOMAINES[d.id]).map(d => d.id);
  assertEqual(missing, [], 'des domaines sans coordonnées');

  const outside = Object.entries(CARTE_DOMAINES)
    .filter(([, g]) => g.lon < CARTE_BOUNDS.minLon || g.lon > CARTE_BOUNDS.maxLon
      || g.lat < CARTE_BOUNDS.minLat || g.lat > CARTE_BOUNDS.maxLat)
    .map(([id]) => id);
  assertEqual(outside, [], 'des domaines tombent hors du cadre');
});

test('la carte ne connaît que des domaines qui existent vraiment', () => {
  const ids = new Set(DOMAINES.map(d => d.id));
  const unknown = Object.keys(CARTE_DOMAINES).filter(id => !ids.has(id));
  assertEqual(unknown, [], 'des positions ne correspondent à aucun domaine');
});

test('chaque domaine a un nom court à afficher sur la carte', () => {
  const sans = Object.entries(CARTE_DOMAINES)
    .filter(([, g]) => !g.court || g.court.length > 22)
    .map(([id]) => id);
  assertEqual(sans, [], 'nom court manquant ou trop long pour tenir sur la carte');
});

test('la projection met le nord-ouest en haut à gauche et le sud-est en bas à droite', () => {
  const nw = carteProject(CARTE_BOUNDS.minLon, CARTE_BOUNDS.maxLat);
  const se = carteProject(CARTE_BOUNDS.maxLon, CARTE_BOUNDS.minLat);
  assert(Math.abs(nw.x) < 0.001 && Math.abs(nw.y) < 0.001, `coin nord-ouest en ${nw.x},${nw.y}`);
  assert(Math.abs(se.x - CARTE_VIEW.width) < 0.001, `bord est en ${se.x}`);
  assert(Math.abs(se.y - CARTE_VIEW.height) < 0.001, `bord sud en ${se.y}`);
});

test('les rivières vont d’ouest en est (sinon leur nom s’écrirait à l’envers)', () => {
  const backwards = CARTE_RIVERS
    .filter(r => r.pts[0][0] > r.pts[r.pts.length - 1][0])
    .map(r => r.name);
  assertEqual(backwards, [], 'des tracés remontent vers l’ouest');
});

test('chaque rivière un peu longue trouve où écrire son nom', () => {
  const sansNom = CARTE_RIVERS
    .filter((r, i) => r.pts.length > 12 && !CARTE_RIVER_SPOTS[i])
    .map(r => r.name);
  assertEqual(sansNom, [], 'des rivières restent anonymes');
});

// --- Une couleur par domaine ---

test('deux domaines voisins n’ont jamais la même couleur', () => {
  const ids = Object.keys(CARTE_DOMAINES);
  const kx = 111 * Math.cos(43.92 * Math.PI / 180);
  let closest = { km: Infinity };
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = CARTE_DOMAINES[ids[i]];
      const b = CARTE_DOMAINES[ids[j]];
      if (a.couleur !== b.couleur) continue;
      const km = Math.hypot((a.lon - b.lon) * kx, (a.lat - b.lat) * 111);
      if (km < closest.km) closest = { km, a: ids[i], b: ids[j] };
    }
  }
  assert(closest.km > 3, `${closest.a} et ${closest.b} partagent une couleur à ${closest.km.toFixed(1)} km`);
});

test('toutes les couleurs pointent vers une teinte de la palette', () => {
  const hors = Object.entries(CARTE_DOMAINES)
    .filter(([, g]) => !Number.isInteger(g.couleur) || g.couleur < 0 || g.couleur >= CARTE_PALETTE.length)
    .map(([id]) => id);
  assertEqual(hors, [], 'indice de couleur invalide');
  for (const id of Object.keys(CARTE_DOMAINES)) {
    assert(cartePalette(id).ink, `pas de teinte pour ${id}`);
  }
});

test('chaque parcelle de vigne est rattachée à un domaine connu, ou à aucun', () => {
  assertEqual(PAYSAGE_VIGNES_OWNER.length, PAYSAGE_VIGNES.length,
    'il manque des rattachements de parcelles');
  const ids = new Set(Object.keys(CARTE_DOMAINES));
  const mauvais = PAYSAGE_VIGNES_OWNER.filter(o =>
    o !== -1 && !ids.has(PAYSAGE_VIGNES_DOMAINES[o]));
  assertEqual(mauvais, [], 'des parcelles pointent vers un domaine inconnu');
  assert(PAYSAGE_VIGNES_OWNER.some(o => o >= 0), 'aucune parcelle rattachée');
  assert(PAYSAGE_VIGNES_OWNER.some(o => o === -1), 'toutes les parcelles rattachées, c’est suspect');
});

// --- Notes ---

test('carteScore fait la moyenne de toutes les boissons notées', () => {
  assertEqual(carteScore([{ note_blanc: 4, note_rouge: 2 }]), 3);
  // Deux fiches, quatre notes : (5+3+1+3)/4
  assertEqual(carteScore([{ note_blanc: 5, note_rouge: 3 }, { note_rose: 1, note_jus: 3 }]), 3);
});

test('carteScore vaut null quand personne n’a noté de boisson', () => {
  assertEqual(carteScore([]), null);
  assertEqual(carteScore([{ coeur: 2, etoile: 1, commentaire: 'sympa' }]), null,
    'les stickers seuls ne font pas une note');
});

// --- Placement des étiquettes ---

test('une étiquette se range à côté de son point quand la place est libre', () => {
  const occupied = [];
  const frame = { x1: 0, y1: 0, x2: 900, y2: 900 };
  const spot = cartePlaceLabel('Vayssette', { x: 400, y: 400 }, 11, occupied, frame);
  assert(spot, 'aucune place trouvée sur une carte vide');
  assertEqual(occupied.length, 1, 'la place prise doit être réservée');
});

test('une étiquette cède la place à celles déjà posées', () => {
  const frame = { x1: 0, y1: 0, x2: 900, y2: 900 };
  const occupied = [];
  const premier = cartePlaceLabel('Vayssette', { x: 400, y: 400 }, 11, occupied, frame);
  const second = cartePlaceLabel('Vayssette', { x: 400, y: 400 }, 11, occupied, frame);
  assert(second, 'la seconde étiquette doit trouver un autre côté');
  assert(premier.x !== second.x || premier.y !== second.y, 'les deux se superposent');
});

test('pas d’étiquette plutôt qu’une étiquette illisible quand tout est pris', () => {
  const frame = { x1: 0, y1: 0, x2: 900, y2: 900 };
  // Tout le voisinage est déjà occupé
  const occupied = [{ x1: 200, y1: 200, x2: 600, y2: 600 }];
  const spot = cartePlaceLabel('Vayssette', { x: 400, y: 400 }, 11, occupied, frame);
  assertEqual(spot, null, 'une étiquette a été posée sur une zone occupée');
});

test('une étiquette ne déborde jamais du cadre', () => {
  // « Croix des Marchands » fait une centaine de pixels : aucun placement ne
  // tient dans un cadre de 80 de large, quelle que soit la hauteur.
  const frame = { x1: 0, y1: 0, x2: 80, y2: 400 };
  const spot = cartePlaceLabel('Croix des Marchands', { x: 40, y: 200 }, 11, [], frame);
  assertEqual(spot, null, 'un nom trop large pour le cadre a quand même été posé');
});

// --- Rendu ---

test('renderCarte pose un point par domaine, noté ou non', () => {
  const container = document.createElement('div');
  renderCarte(container, {
    decorate: (d) => (d.stand === '2' ? { done: true, badge: '❤️', score: 4.2 } : {}),
  });
  assertEqual(container.querySelectorAll('.carte-dom').length, DOMAINES.length,
    'il manque des domaines sur la carte');
  assertEqual(container.querySelectorAll('.carte-dom.done').length, 1);
  assert(container.querySelector('.carte-svg'), 'pas de SVG produit');
});

test('renderCarte dessine toutes les parcelles de vigne', () => {
  const container = document.createElement('div');
  renderCarte(container);
  assertEqual(container.querySelectorAll('.carte-vignes path').length, PAYSAGE_VIGNES.length);
});

test('renderCarte ne rend cliquable que si on lui donne un onClick', () => {
  const plain = document.createElement('div');
  renderCarte(plain);
  assertEqual(plain.querySelectorAll('.carte-dom.clickable').length, 0);

  const clickable = document.createElement('div');
  renderCarte(clickable, { onClick: () => {} });
  assertEqual(clickable.querySelectorAll('.carte-dom.clickable').length, DOMAINES.length);
});

test('renderCarte fournit les boutons zoom, recadrage et plein écran', () => {
  const container = document.createElement('div');
  renderCarte(container);
  const labels = [...container.querySelectorAll('.carte-zoom-btn')].map(b => b.textContent);
  assertEqual(labels, ['+', '−', '⤢', '⛶']);
});

// Le pincement à deux doigts : la carte doit zoomer au doigt, pas seulement
// aux boutons (sur téléphone il n'y a ni molette ni double-clic fiable).
function carteDoigt(svg, type, id, x, y) {
  svg.dispatchEvent(new PointerEvent(type, {
    pointerId: id, clientX: x, clientY: y, bubbles: true, isPrimary: id === 1,
  }));
}

test('écarter deux doigts zoome la carte, les rapprocher la dézoome', () => {
  const container = document.createElement('div');
  container.style.width = '600px';
  document.body.appendChild(container);
  renderCarte(container);
  const svg = container.querySelector('.carte-svg');
  const r = svg.getBoundingClientRect();
  assert(r.width > 0, 'la carte devrait avoir une taille à l’écran');
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  // Deux doigts posés à 40 px de part et d'autre du centre, puis écartés au
  // double : la carte doit avoir grossi.
  carteDoigt(svg, 'pointerdown', 1, cx - 40, cy);
  carteDoigt(svg, 'pointerdown', 2, cx + 40, cy);
  carteDoigt(svg, 'pointermove', 2, cx + 120, cy);
  assert(container.classList.contains('zoomed'), 'écarter les doigts devrait zoomer');
  carteDoigt(svg, 'pointerup', 1, cx - 40, cy);
  carteDoigt(svg, 'pointerup', 2, cx + 120, cy);

  // Et en les rapprochant, on revient à la carte entière (le zoom ne descend
  // jamais sous 1).
  carteDoigt(svg, 'pointerdown', 1, cx - 200, cy);
  carteDoigt(svg, 'pointerdown', 2, cx + 200, cy);
  carteDoigt(svg, 'pointermove', 1, cx - 5, cy);
  carteDoigt(svg, 'pointermove', 2, cx + 5, cy);
  carteDoigt(svg, 'pointerup', 1, cx - 5, cy);
  carteDoigt(svg, 'pointerup', 2, cx + 5, cy);
  assert(!container.classList.contains('zoomed'), 'rapprocher les doigts devrait dézoomer');
  container.remove();
});

test('un doigt ne déplace la carte qu’une fois zoomée', () => {
  const container = document.createElement('div');
  container.style.width = '600px';
  document.body.appendChild(container);
  renderCarte(container);
  const svg = container.querySelector('.carte-svg');
  const monde = container.querySelector('.carte-monde');
  const r = svg.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  // À plat, glisser le doigt laisse la page défiler : la carte ne bouge pas
  const depart = monde.getAttribute('transform');
  carteDoigt(svg, 'pointerdown', 1, cx, cy);
  carteDoigt(svg, 'pointermove', 1, cx - 60, cy - 60);
  assertEqual(monde.getAttribute('transform'), depart, 'la carte à plat ne devrait pas bouger');
  carteDoigt(svg, 'pointerup', 1, cx - 60, cy - 60);

  // Une fois zoomée, le même geste s'y promène
  [...container.querySelectorAll('.carte-zoom-btn')].find(b => b.textContent === '+').click();
  const zoome = monde.getAttribute('transform');
  carteDoigt(svg, 'pointerdown', 1, cx, cy);
  carteDoigt(svg, 'pointermove', 1, cx - 60, cy - 60);
  assert(monde.getAttribute('transform') !== zoome, 'la carte zoomée devrait suivre le doigt');
  assert(container.classList.contains('dragging'), 'le curseur devrait passer en « prise »');
  carteDoigt(svg, 'pointerup', 1, cx - 60, cy - 60);
  assert(!container.classList.contains('dragging'), 'doigt levé, plus de « prise »');
  container.remove();
});

test('le bouton plein écran bascule la classe, et Échap en sort', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  renderCarte(container);
  const plein = [...container.querySelectorAll('.carte-zoom-btn')].find(b => b.textContent === '⛶');

  plein.click();
  assert(container.classList.contains('carte-plein'), 'la carte devrait passer en plein écran');
  assert(document.body.classList.contains('carte-plein-actif'), 'le corps de page devrait être figé');
  assertEqual(plein.textContent, '✕', 'le bouton devrait proposer de sortir');

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  assert(!container.classList.contains('carte-plein'), 'Échap devrait sortir du plein écran');
  assert(!document.body.classList.contains('carte-plein-actif'));
  container.remove();
});

// --- Le classement général des domaines (partagé classements + moyennes) ---

// Petit raccourci : { id: [fiches] } → la Map attendue par classementDomaines
function mapFiches(parDomaine) {
  return new Map(DOMAINES.map(d => [d.id, parDomaine[d.id] || []]));
}

test('le classement des domaines suit la moyenne de toutes les boissons notées', () => {
  const c = classementDomaines(mapFiches({
    rotier: [{ note_rouge: 5, note_blanc: 5 }],
    vayssette: [{ note_rouge: 4 }],
    lastours: [{ note_rouge: 2 }],
  }));
  assertEqual([...c.keys()], ['rotier', 'vayssette', 'lastours'], 'mauvais ordre');
  assertEqual(c.get('rotier').rank, 1);
  assertEqual(c.get('rotier').avg, 5);
  assertEqual(c.get('rotier').count, 2, 'les deux notes doivent compter');
  assertEqual(c.get('lastours').rank, 3);
});

test('à moyenne égale, le domaine le plus goûté passe devant', () => {
  const c = classementDomaines(mapFiches({
    rotier: [{ note_rouge: 4 }],
    vayssette: [{ note_rouge: 4 }, { note_blanc: 4 }],
  }));
  assertEqual(c.get('vayssette').rank, 1, '2 notes devraient devancer 1 note');
  assertEqual(c.get('rotier').rank, 2);
});

test('sans note de boisson, un domaine n’a pas de place au classement', () => {
  // Une fiche peut ne porter que des ❤️/⭐ : elle existe, mais ne note rien.
  const c = classementDomaines(mapFiches({ rotier: [{ coeur: 2, etoile: 1 }] }));
  assertEqual(c.size, 0, 'une fiche sans note ne devrait pas classer le domaine');
  assertEqual(classementDomaines(mapFiches({})).size, 0, 'sans fiche, classement vide');
});

test('les places sont contiguës et couvrent tous les domaines notés', () => {
  const parDomaine = {};
  DOMAINES.forEach((d, i) => { parDomaine[d.id] = [{ note_rouge: (i % 5) + 1 }]; });
  const c = classementDomaines(mapFiches(parDomaine));
  assertEqual(c.size, DOMAINES.length, 'tous les domaines notés doivent être classés');
  const rangs = [...c.values()].map(v => v.rank);
  assertEqual(rangs, rangs.map((_, i) => i + 1), 'les places devraient aller de 1 à n sans trou');
  const notes = [...c.values()].map(v => v.avg);
  assert(notes.every((v, i) => i === 0 || notes[i - 1] >= v), 'du mieux noté au moins bien noté');
});

// --- La normalisation des recherches (partagée liste + carte) ---

test('cleRecherche ignore accents, casse et apostrophes', () => {
  assertEqual(cleRecherche('Château Lastours'), 'chateau lastours');
  assertEqual(cleRecherche('Roméli'), 'romeli');
  assertEqual(cleRecherche('CAHUZAC-SUR-VÈRE'), 'cahuzac-sur-vere');
  // Les trois apostrophes possibles donnent la même clé, espace comprise :
  // c'est ce qui fait que « mas d aurel » trouve « Mas d'Aurel ».
  assertEqual(cleRecherche("Mas d'Aurel"), 'mas d aurel');
  assertEqual(cleRecherche('Mas d’Aurel'), 'mas d aurel');
  assertEqual(cleRecherche('  MAS   D  AUREL  '), 'mas d aurel');
});

test('chaque domaine est trouvable par son nom et par son n° de stand', () => {
  // La liste de la page domaines cherche sur « stand + nom » : deux domaines
  // ne doivent pas se marcher dessus, et chaque n° doit être discriminant.
  const cles = DOMAINES.map(d => cleRecherche(`${d.stand} ${d.name}`));
  assertEqual(new Set(cles).size, DOMAINES.length, 'deux domaines ont la même clé de recherche');

  for (const d of DOMAINES) {
    const parNom = cles.filter(c => c.includes(cleRecherche(d.name)));
    assertEqual(parNom.length, 1, `« ${d.name} » ne ramène pas exactement un domaine`);
  }
});

// --- La liste des domaines ---

test('la liste propose les 51 domaines, triés par nom', () => {
  const container = document.createElement('div');
  renderCarte(container);
  const noms = [...container.querySelectorAll('.carte-liste-nom')].map(e => e.textContent);
  assertEqual(noms.length, DOMAINES.length);
  assertEqual(noms, [...noms].sort((a, b) => a.localeCompare(b, 'fr')), 'la liste n’est pas triée');
});

test('la recherche ignore accents et casse, et cherche aussi la commune', () => {
  const container = document.createElement('div');
  renderCarte(container);
  const search = container.querySelector('.carte-search');
  const visibles = () => [...container.querySelectorAll('.carte-liste-items li')]
    .filter(li => !li.hidden)
    .map(li => li.querySelector('.carte-liste-nom').textContent);

  search.value = 'romeli';
  search.dispatchEvent(new Event('input'));
  assertEqual(visibles(), ['Roméli'], 'un nom accentué doit se trouver sans accent');

  search.value = 'CAHUZAC';
  search.dispatchEvent(new Event('input'));
  assert(visibles().length > 1, 'chercher une commune doit ramener ses domaines');

  search.value = 'zzz';
  search.dispatchEvent(new Event('input'));
  assertEqual(visibles(), []);
  assert(!container.querySelector('.carte-liste-vide').hidden, 'le message « aucun résultat » doit apparaître');
});

test('cliquer un domaine de la liste zoome la carte dessus', () => {
  const container = document.createElement('div');
  renderCarte(container);
  const monde = container.querySelector('.carte-monde');
  assert(monde.getAttribute('transform').includes('scale(1.0000)'), 'la carte devrait partir dézoomée');

  container.querySelector('.carte-liste-btn').click();
  const t = monde.getAttribute('transform');
  assert(!t.includes('scale(1.0000)'), `la carte devrait avoir zoomé (${t})`);
  assertEqual(container.querySelectorAll('.carte-dom.choisi').length, 1,
    'le domaine choisi devrait être mis en avant');
});

// --- Exécution ---

(async () => {
  const listEl = document.getElementById('test-results');
  const summaryEl = document.getElementById('summary');
  let passed = 0;

  for (const { name, fn } of TESTS) {
    const li = document.createElement('li');
    try {
      await fn();
      li.className = 'test-pass';
      li.textContent = name;
      passed++;
    } catch (err) {
      li.className = 'test-fail';
      li.textContent = name;
      const detail = document.createElement('span');
      detail.className = 'detail';
      detail.textContent = err.message;
      li.appendChild(detail);
      console.error(`❌ ${name}`, err);
    }
    listEl.appendChild(li);
  }

  clearAppStorage();
  window.fetch = realFetch;

  const failed = TESTS.length - passed;
  summaryEl.textContent = failed
    ? `❌ ${failed} test(s) en échec sur ${TESTS.length}`
    : `✅ ${passed}/${TESTS.length} tests au vert`;
  document.title = `MAXIguide — Tests (${passed}/${TESTS.length})`;
})();
