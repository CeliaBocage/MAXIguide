// Plan du parc recréé d'après fete-vins-gaillac.com/plan-du-parc (viewBox 950 × 1270).
// Les stands sont répartis le long des rangées rouges du Village Vignerons.
//
// ⚠️ L'attribution stand ↔ position est PROVISOIRE (l'ordre des numéros le long
// des rangées n'est pas encore connu). Pour corriger : réordonner les numéros
// dans les tableaux `stands` ci-dessous — chaque rangée va du premier point
// vers le dernier, les stands y sont répartis régulièrement.
const PLAN_ROWS = [
  // Petite diagonale haute (près du point info)
  { points: [[400, 236], [504, 170]], stands: ['2', '3', '4', '5', '6', '7'] },
  // Grande diagonale nord-ouest
  { points: [[382, 260], [226, 394]], stands: ['8', '9', '10', '11', '12', '13', '14', '15', '15bis', '16', '17'] },
  // Retour vers le bas, côté ouest
  { points: [[232, 406], [304, 486]], stands: ['18', '19', '20', '21', '22', '23'] },
  // Arc central
  { points: [[418, 412], [548, 388], [586, 470]], stands: ['24', '25', '26', '27', '28', '36', '37', '38', '39', '40', '41', '42'] },
  // Colonne est (le long de l'aire de chargement)
  { points: [[592, 210], [686, 470]], stands: ['43', '44', '46', '47', '48', '49', '50', '52', '53', '54', '55', '56', '57', '58', '59', '60'] },
];

// Positions calculées : { stand: {x, y} }
const PLAN_POSITIONS = (() => {
  const positions = {};
  for (const row of PLAN_ROWS) {
    // Longueur de chaque segment de la polyligne
    const segs = [];
    let total = 0;
    for (let i = 0; i < row.points.length - 1; i++) {
      const [x1, y1] = row.points[i];
      const [x2, y2] = row.points[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      segs.push({ x1, y1, x2, y2, len });
      total += len;
    }
    // Répartition régulière des stands sur la polyligne
    row.stands.forEach((stand, i) => {
      const t = row.stands.length === 1 ? 0.5 : i / (row.stands.length - 1);
      let dist = t * total;
      for (const seg of segs) {
        if (dist <= seg.len || seg === segs[segs.length - 1]) {
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
