// Accès à la base Turso via son API HTTP (v2/pipeline) — aucun backend nécessaire.
// Nécessite secrets/config.js (voir secrets/config.example.js).

function toArg(value) {
  if (value === null || value === undefined) return { type: 'null', value: null };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { type: 'integer', value: String(value) }
      : { type: 'float', value };
  }
  return { type: 'text', value: String(value) };
}

function parseCell(cell) {
  switch (cell.type) {
    case 'integer': return parseInt(cell.value, 10);
    case 'float': return Number(cell.value);
    case 'null': return null;
    default: return cell.value;
  }
}

// Une erreur « retryable » est passagère (pas de réseau, serveur surchargé) :
// la file de synchronisation (js/storage.js) retentera plus tard. Les erreurs
// de config ou de SQL, elles, ne se règlent pas en réessayant.
function retryableError(message) {
  const err = new Error(message);
  err.retryable = true;
  return err;
}

async function dbExecute(sql, args = []) {
  if (typeof TURSO === 'undefined' || TURSO.url.includes('REMPLACER')) {
    throw new Error(t('db.notConfigured'));
  }

  // L'API HTTP attend une URL https:// (turso donne souvent libsql://)
  const baseUrl = TURSO.url.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '');

  let res;
  try {
    res = await fetch(`${baseUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TURSO.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          { type: 'execute', stmt: { sql, args: args.map(toArg) } },
          { type: 'close' },
        ],
      }),
    });
  } catch {
    throw retryableError(t('db.network'));
  }

  if (!res.ok) {
    const err = new Error(t('db.http', { status: res.status }));
    err.retryable = res.status >= 500 || res.status === 429;
    throw err;
  }

  const data = await res.json();
  const first = data.results[0];
  if (first.type === 'error') throw new Error(t('db.sql', { message: first.error.message }));

  const { cols, rows } = first.response.result;
  return rows.map(row =>
    Object.fromEntries(row.map((cell, i) => [cols[i].name, parseCell(cell)]))
  );
}

// Affiche une erreur bien visible en haut de page (problème de config, de réseau…)
function showDbError(err) {
  console.error(err);
  let banner = document.getElementById('db-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'db-error-banner';
    banner.className = 'db-error-banner';
    document.body.prepend(banner);
  }
  banner.textContent = `⚠️ ${err.message}`;
}
