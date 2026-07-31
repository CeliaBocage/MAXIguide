// Plan du parc recréé d'après fete-vins-gaillac.com/plan-du-parc (viewBox 950 × 1270).
// Les stands sont répartis le long des rangées rouges du Village Vignerons.
//
// La numérotation suit un seul chemin continu, dans l'ordre de PLAN_ROWS : elle
// démarre en haut de la colonne est (le long de l'aire de chargement, juste
// sous le point info), descend vers la sortie jusqu'au n° 17, repart vers
// l'ouest par l'arc central (le 18 est à son extrémité est), remonte la rangée
// ouest puis la grande diagonale, et finit sur la petite diagonale du point
// info avec le n° 60. C'est le parcours du visiteur : chaque rangée reprend là
// où la précédente s'arrête.
const PLAN_ROWS = [
  // Colonne est (le long de l'aire de chargement), du haut vers le bas
  { points: [[592, 210], [686, 470]] },
  // Arc central, repris par son extrémité est
  { points: [[586, 470], [548, 388], [418, 412]] },
  // Rangée ouest, du bas vers le haut
  { points: [[304, 486], [232, 406]] },
  // Grande diagonale nord-ouest, en remontant vers le point info
  { points: [[226, 394], [382, 260]] },
  // Petite diagonale haute (près du point info)
  { points: [[400, 236], [504, 170]] },
];

// Les numéros de stand du plan officiel, dans l'ordre du parcours. Tous les
// numéros comptent, même ceux qu'aucun domaine n'occupe (1, 29 à 35, 45, 51 —
// absents de js/data/domaines.js) : ils tiennent une place le long des rangées,
// et les sauter décalerait tous les suivants.
const PLAN_STANDS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14',
  '15', '15bis', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25',
  '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38',
  '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51',
  '52', '53', '54', '55', '56', '57', '58', '59', '60',
];

// Positions calculées : { stand: {x, y} }
//
// Les stands sont espacés régulièrement le long des rangées, alors chaque
// rangée en accueille à la mesure de sa longueur : les 61 numéros se répartissent
// au prorata des longueurs, puis chaque rangée étale les siens sur sa polyligne.
const PLAN_POSITIONS = (() => {
  // Longueur de chaque rangée (et de chacun de ses segments)
  const rows = PLAN_ROWS.map(row => {
    const segs = [];
    let total = 0;
    for (let i = 0; i < row.points.length - 1; i++) {
      const [x1, y1] = row.points[i];
      const [x2, y2] = row.points[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      segs.push({ x1, y1, x2, y2, len });
      total += len;
    }
    return { segs, total };
  });

  // Combien de numéros par rangée : au prorata de sa longueur, en gardant les
  // arrondis honnêtes (on suit le cumul, la dernière rangée prend le reste).
  const longueurTotale = rows.reduce((a, r) => a + r.total, 0);
  let place = 0;
  let cumul = 0;
  for (const [i, row] of rows.entries()) {
    cumul += row.total;
    const fin = i === rows.length - 1
      ? PLAN_STANDS.length
      : Math.round(PLAN_STANDS.length * cumul / longueurTotale);
    row.stands = PLAN_STANDS.slice(place, fin);
    place = fin;
  }

  // Répartition régulière des stands sur la polyligne de leur rangée
  const positions = {};
  for (const row of rows) {
    row.stands.forEach((stand, i) => {
      const t = row.stands.length === 1 ? 0.5 : i / (row.stands.length - 1);
      let dist = t * row.total;
      for (const seg of row.segs) {
        if (dist <= seg.len || seg === row.segs[row.segs.length - 1]) {
          const r = seg.len ? dist / seg.len : 0;
          positions[stand] = {
            x: seg.x1 + (seg.x2 - seg.x1) * r,
            y: seg.y1 + (seg.y2 - seg.y1) * r,
          };
          break;
        }
        dist -= seg.len;
      }
    });
  }
  return positions;
})();
