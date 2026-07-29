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

test('les photos des fiches en attente restent visibles hors-ligne', async () => {
  clearAppStorage();
  mockFetchOK([]);
  await Storage.getUserRatings('u1'); // remplit le cache
  mockFetchOffline();
  await Storage.saveRating('u1', 'rotier', { ...FICHE, photos: ['data:image/jpeg;base64,AAA'] });
  const ratings = await Storage.getUserRatings('u1');
  assertEqual(ratings['rotier'].photos, ['data:image/jpeg;base64,AAA']);
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

test('la couleur de la pastille suit la note, du plus pâle au plus foncé', () => {
  const fills = [1, 2, 3, 4, 5].map(n => carteScoreColors(n).fill);
  assertEqual(new Set(fills).size, 5, 'cinq notes doivent donner cinq teintes');
  assertEqual(carteScoreColors(1.4).fill, carteScoreColors(1).fill, '1,4 reste dans le premier palier');
});

test('carteSpread sépare deux domaines à la même adresse', () => {
  const nodes = [
    { ax: 400, ay: 400, x: 400, y: 400 },
    { ax: 400, ay: 400, x: 400, y: 400 },
  ];
  carteSpread(nodes, { gap: 27, width: 900, height: 900, margin: { left: 10, right: 10, top: 10, bottom: 10 } });
  const dist = Math.hypot(nodes[0].x - nodes[1].x, nodes[0].y - nodes[1].y);
  assert(dist > 20, `les deux pastilles se chevauchent encore (${dist.toFixed(1)} px)`);
  // …sans les envoyer à l'autre bout de la carte
  assert(Math.hypot(nodes[0].x - 400, nodes[0].y - 400) < 40, 'la pastille a trop dérivé');
});

test('carteSpread laisse tranquille un domaine isolé', () => {
  const nodes = [{ ax: 300, ay: 500, x: 300, y: 500 }];
  carteSpread(nodes, { gap: 27, width: 900, height: 900, margin: { left: 10, right: 10, top: 10, bottom: 10 } });
  assert(Math.hypot(nodes[0].x - 300, nodes[0].y - 500) < 0.5, 'la pastille a bougé sans raison');
});

test('renderCarte dessine une pastille par domaine, notée ou non', () => {
  const container = document.createElement('div');
  renderCarte(container, {
    decorate: (d) => (d.stand === '2' ? { done: true, badge: '❤️', score: 4.2 } : {}),
  });
  const stands = container.querySelectorAll('.carte-stand');
  assertEqual(stands.length, DOMAINES.length, 'il manque des domaines sur la carte');
  assertEqual(container.querySelectorAll('.carte-stand.done').length, 1);
  assert(container.querySelector('.carte-svg'), 'pas de SVG produit');
});

test('renderCarte ne rend cliquable que si on lui donne un onClick', () => {
  const plain = document.createElement('div');
  renderCarte(plain);
  assertEqual(plain.querySelectorAll('.carte-stand.clickable').length, 0);

  const clickable = document.createElement('div');
  renderCarte(clickable, { onClick: () => {} });
  assertEqual(clickable.querySelectorAll('.carte-stand.clickable').length, DOMAINES.length);
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
