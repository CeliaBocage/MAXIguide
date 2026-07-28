// Couche de données — utilisateurs et fiches de notation vivent dans Turso (partagés
// entre tous les téléphones) ; seul l'utilisateur actif sur CET appareil reste en
// localStorage. Toutes les méthodes de lecture/écriture sont async.
//
// Une fiche de notation (par utilisateur et par domaine) contient :
//   note_blanc / note_rouge / note_rose : 1 à 5, null si pas goûté
//   coeur  : stickers « on a adoré les gens », 0 à 5 (1 = excellent, 5 = légendaire)
//   etoile : stickers « vins excellents », 0 à 5 (même échelle)
//   commentaire : texte libre, null si vide
const Storage = {
  CURRENT_KEY: 'maxiguide.currentUserId',

  // --- Session locale (quel profil est actif sur cet appareil) ---

  setCurrentUser(id) {
    localStorage.setItem(this.CURRENT_KEY, id);
  },

  getCurrentUserId() {
    return localStorage.getItem(this.CURRENT_KEY);
  },

  async getCurrentUser() {
    const id = this.getCurrentUserId();
    if (!id) return null;
    const rows = await dbExecute('SELECT id, name FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  },

  // --- Utilisateurs ---

  async getUsers() {
    return dbExecute('SELECT id, name FROM users ORDER BY name COLLATE NOCASE');
  },

  async getUser(id) {
    const rows = await dbExecute('SELECT id, name FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async createUser(name) {
    const trimmed = name.trim();
    if (!trimmed) return { error: 'Le nom ne peut pas être vide.' };

    const id = crypto.randomUUID();
    try {
      await dbExecute('INSERT INTO users (id, name) VALUES (?, ?)', [id, trimmed]);
    } catch (err) {
      if (/UNIQUE/i.test(err.message)) {
        return { error: 'Ce nom est déjà pris — choisissez-le dans la liste !' };
      }
      throw err;
    }
    return { user: { id, name: trimmed } };
  },

  // --- Fiches de notation ---

  // Retourne { domaineId: fiche } pour un utilisateur
  async getUserRatings(userId) {
    const rows = await dbExecute(
      `SELECT domaine_id, note_blanc, note_rouge, note_rose, note_whisky, note_jus,
              coeur, etoile, commentaire
       FROM ratings WHERE user_id = ?`,
      [userId]
    );
    return Object.fromEntries(rows.map(r => [r.domaine_id, r]));
  },

  // Enregistre la fiche complète ; la supprime si elle est entièrement vide
  async saveRating(userId, domaineId, fiche) {
    const commentaire = (fiche.commentaire || '').trim() || null;
    const NOTES = ['note_blanc', 'note_rouge', 'note_rose', 'note_whisky', 'note_jus'];
    const empty = NOTES.every(k => !fiche[k])
      && !fiche.coeur && !fiche.etoile && !commentaire;

    if (empty) {
      await dbExecute(
        'DELETE FROM ratings WHERE user_id = ? AND domaine_id = ?',
        [userId, domaineId]
      );
      return;
    }

    await dbExecute(
      `INSERT INTO ratings (user_id, domaine_id, note_blanc, note_rouge, note_rose,
                            note_whisky, note_jus, coeur, etoile, commentaire)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, domaine_id) DO UPDATE SET
         note_blanc = excluded.note_blanc,
         note_rouge = excluded.note_rouge,
         note_rose = excluded.note_rose,
         note_whisky = excluded.note_whisky,
         note_jus = excluded.note_jus,
         coeur = excluded.coeur,
         etoile = excluded.etoile,
         commentaire = excluded.commentaire,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      [
        userId, domaineId,
        ...NOTES.map(k => fiche[k] || null),
        fiche.coeur || 0, fiche.etoile || 0,
        commentaire,
      ]
    );
  },

  // --- Stats pour l'onglet Moyennes (nécessite js/data/domaines.js chargé avant) ---

  // Nombre de domaines notés par utilisateur : [{ id, name, rated }]
  async getUsersWithProgress() {
    return dbExecute(
      `SELECT u.id, u.name, COUNT(r.domaine_id) AS rated
       FROM users u
       LEFT JOIN ratings r ON r.user_id = u.id
       GROUP BY u.id
       ORDER BY u.name COLLATE NOCASE`
    );
  },

  // Moyennes par domaine : { domaineId: { avg_blanc, avg_rouge, avg_rose, coeurs, etoiles, votes } }
  async getDomaineAverages() {
    const rows = await dbExecute(
      `SELECT domaine_id,
              AVG(note_blanc) AS avg_blanc,
              AVG(note_rouge) AS avg_rouge,
              AVG(note_rose) AS avg_rose,
              AVG(note_whisky) AS avg_whisky,
              AVG(note_jus) AS avg_jus,
              SUM(coeur) AS coeurs,
              SUM(etoile) AS etoiles,
              COUNT(*) AS votes
       FROM ratings
       GROUP BY domaine_id`
    );
    return Object.fromEntries(rows.map(r => [r.domaine_id, r]));
  },

  // Part des domaines notés par au moins une personne (0 à 1)
  async getGroupCoverage() {
    if (!DOMAINES.length) return 0;
    const rows = await dbExecute('SELECT COUNT(DISTINCT domaine_id) AS covered FROM ratings');
    return rows[0].covered / DOMAINES.length;
  },
};
