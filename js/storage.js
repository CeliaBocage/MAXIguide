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
    if (!trimmed) return { error: t('users.errEmpty') };

    const id = crypto.randomUUID();
    try {
      await dbExecute('INSERT INTO users (id, name) VALUES (?, ?)', [id, trimmed]);
    } catch (err) {
      if (/UNIQUE/i.test(err.message)) {
        return { error: t('users.errTaken') };
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

  // --- Stats pour l'onglet Moyennes ---

  // Toutes les fiches de tout le monde, avec le nom du participant
  async getAllRatings() {
    return dbExecute(
      `SELECT r.user_id, u.name AS user_name, r.domaine_id,
              r.note_blanc, r.note_rouge, r.note_rose, r.note_whisky, r.note_jus,
              r.coeur, r.etoile, r.commentaire
       FROM ratings r
       JOIN users u ON u.id = r.user_id
       ORDER BY u.name COLLATE NOCASE`
    );
  },
};
