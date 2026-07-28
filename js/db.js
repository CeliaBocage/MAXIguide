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

async function dbExecute(sql, args = []) {
  if (typeof TURSO === 'undefined' || TURSO.url.includes('REMPLACER')) {
    throw new Error("Base non configurée : copiez secrets/config.example.js en secrets/config.js et remplissez l'URL et le token Turso.");
  }

  // L'API HTTP attend une URL https:// (turso donne souvent libsql://)
  const baseUrl = TURSO.url.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '');

  const res = await fetch(`${baseUrl}/v2/pipeline`, {
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

  if (!res.ok) throw new Error(`Erreur Turso : HTTP ${res.status}`);

  const data = await res.json();
  const first = data.results[0];
  if (first.type === 'error') throw new Error(`Erreur SQL : ${first.error.message}`);

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
