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
// storage.js — divers
// =====================================================================

test('isEmptyFiche : vide si aucune note, aucun sticker, aucun mot', () => {
  assert(isEmptyFiche({ coeur: 0, etoile: 0, commentaire: ' ' }));
  assert(!isEmptyFiche({ note_rouge: 3, coeur: 0, etoile: 0 }));
  assert(!isEmptyFiche({ coeur: 1, etoile: 0 }));
  assert(!isEmptyFiche({ coeur: 0, etoile: 0, commentaire: 'super' }));
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
