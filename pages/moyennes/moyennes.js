// Page des moyennes : stats du groupe, complétion par participant, note moyenne par domaine
const pct = (ratio) => `${Math.round(ratio * 100)} %`;

async function main() {
  const user = await Header.mount('moyennes');
  if (!user) return;

  const [users, averages, coverage] = await Promise.all([
    Storage.getUsersWithProgress(),
    Storage.getDomaineAverages(),
    Storage.getGroupCoverage(),
  ]);

  // Stats du groupe
  const avgCompletion = users.length && DOMAINES.length
    ? users.reduce((acc, u) => acc + u.rated / DOMAINES.length, 0) / users.length
    : 0;
  document.getElementById('stat-avg-completion').textContent = pct(avgCompletion);
  document.getElementById('stat-coverage').textContent = pct(coverage);

  // Complétion par participant
  const usersTable = document.getElementById('users-table');
  for (const u of users) {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = u.name;

    const ratedCell = document.createElement('td');
    ratedCell.textContent = `${u.rated}/${DOMAINES.length}`;

    const completionCell = document.createElement('td');
    completionCell.textContent = DOMAINES.length ? pct(u.rated / DOMAINES.length) : '—';

    row.append(nameCell, ratedCell, completionCell);
    usersTable.appendChild(row);
  }

  // Moyennes par domaine : notes par couleur + total de stickers reçus
  const avgText = (v) => (v === null || v === undefined) ? '—' : `★ ${v.toFixed(1)}`;
  const domainesTable = document.getElementById('domaines-table');
  for (const domaine of DOMAINES) {
    const stats = averages[domaine.id];
    const row = document.createElement('tr');

    const cells = [
      `${domaine.stand} · ${domaine.name}`,
      avgText(stats?.avg_blanc ?? null),
      avgText(stats?.avg_rouge ?? null),
      avgText(stats?.avg_rose ?? null),
      avgText(stats?.avg_whisky ?? null),
      avgText(stats?.avg_jus ?? null),
      String(stats?.coeurs ?? 0),
      String(stats?.etoiles ?? 0),
      String(stats?.votes ?? 0),
    ];
    for (const text of cells) {
      const cell = document.createElement('td');
      cell.textContent = text;
      row.appendChild(cell);
    }
    domainesTable.appendChild(row);
  }
}

main().catch(showDbError);
