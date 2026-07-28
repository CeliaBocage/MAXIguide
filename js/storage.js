// Couche de données — utilisateurs et fiches de notation vivent dans Turso (partagés
// entre tous les téléphones) ; seul l'utilisateur actif sur CET appareil reste en
// localStorage. Toutes les méthodes de lecture/écriture sont async.
//
// Une fiche de notation (par utilisateur et par domaine) contient :
//   note_blanc / note_rouge / note_rose : 1 à 5, null si pas goûté
//   coeur  : stickers « on a adoré les gens », 0 à 5 (1 = excellent, 5 = légendaire)
//   etoile : stickers « vins excellents », 0 à 5 (même échelle)
//   perso  : stickers persos du guide (son emoji à lui), 0 à 5 (même échelle)
//   commentaire : texte libre, null si vide
const NOTE_KEYS = ['note_blanc', 'note_rouge', 'note_rose', 'note_whisky', 'note_jus'];
const STICKER_KEYS = ['coeur', 'etoile', 'perso'];

function isEmptyFiche(fiche) {
  return NOTE_KEYS.every(k => !fiche[k])
    && STICKER_KEYS.every(k => !fiche[k])
    && !(fiche.commentaire || '').trim();
}

// Pour comparer les noms de profils : accents, casse et espaces ne comptent pas
// (évite un « Célia » et un « celia  » qui seraient deux guides différents).
function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// File de synchronisation : le réseau du parc sera capricieux, alors une fiche
// qui ne part pas (erreur retryable, voir js/db.js) attend en localStorage et
// repart automatiquement (retour du réseau, minuterie, chargement de page).
// L'événement 'maxiguide:sync' tient le header au courant (badge ⏳).
const SyncQueue = {
  KEY: 'maxiguide.pendingRatings',
  flushing: false,

  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { return []; }
  },

  save(ops) {
    localStorage.setItem(this.KEY, JSON.stringify(ops));
    this.notify();
  },

  size() {
    return this.load().length;
  },

  // Une seule fiche en attente par (utilisateur, domaine) : la dernière gagne
  push(op) {
    const ops = this.load().filter(
      o => !(o.userId === op.userId && o.domaineId === op.domaineId)
    );
    ops.push(op);
    this.save(ops);
  },

  notify() {
    document.dispatchEvent(new CustomEvent('maxiguide:sync', {
      detail: { pending: this.size() },
    }));
  },

  // Envoie les fiches en attente dans l'ordre ; s'arrête à la première erreur
  // passagère (on retentera plus tard). Retourne le nombre restant.
  async flush() {
    if (this.flushing) return this.size();
    this.flushing = true;
    try {
      while (this.size()) {
        const op = this.load()[0];
        try {
          await Storage.writeRating(op.userId, op.domaineId, op.fiche);
        } catch (err) {
          if (err.retryable) break;
          // Erreur définitive (SQL…) : inutile de garder la fiche, elle ne partira jamais
          console.error('Fiche abandonnée par la file de sync :', err);
        }
        this.save(this.load().slice(1));
      }
    } finally {
      this.flushing = false;
      this.notify();
    }
    return this.size();
  },
};

window.addEventListener('online', () => { SyncQueue.flush(); });
setInterval(() => { if (SyncQueue.size()) SyncQueue.flush(); }, 15000);
document.addEventListener('DOMContentLoaded', () => { if (SyncQueue.size()) SyncQueue.flush(); });

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
    const cacheKey = 'maxiguide.cache.user';
    let user;
    try {
      const rows = await dbExecute('SELECT id, name, emoji FROM users WHERE id = ?', [id]);
      user = rows[0] || null;
    } catch (err) {
      // Hors-ligne : on continue avec le profil connu de cet appareil
      if (!err.retryable) throw err;
      try { user = JSON.parse(localStorage.getItem(cacheKey)); } catch { user = null; }
      if (!user || user.id !== id) throw err;
      return user;
    }
    if (user) localStorage.setItem(cacheKey, JSON.stringify(user));
    return user;
  },

  // --- Utilisateurs ---

  async getUsers() {
    return dbExecute('SELECT id, name, emoji FROM users ORDER BY name COLLATE NOCASE');
  },

  async getUser(id) {
    const rows = await dbExecute('SELECT id, name, emoji FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async createUser(name, emoji = null) {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) return { error: t('users.errEmpty') };
    emoji = (emoji || '').trim() || null;

    // La base refuse déjà les doublons exacts (UNIQUE NOCASE), mais pas
    // « Celia » vs « Célia » : on compare sans accents pour éviter deux guides
    // qui sont en fait la même personne.
    const existing = await this.getUsers();
    if (existing.some(u => normalizeName(u.name) === normalizeName(trimmed))) {
      return { error: t('users.errTaken') };
    }
    // Un sticker perso par personne : deux guides avec le même emoji, on ne
    // saurait plus qui a stické quoi.
    if (emoji && existing.some(u => u.emoji === emoji)) {
      return { error: t('users.errEmojiTaken') };
    }

    const id = crypto.randomUUID();
    try {
      await dbExecute('INSERT INTO users (id, name, emoji) VALUES (?, ?, ?)', [id, trimmed, emoji]);
    } catch (err) {
      if (/UNIQUE/i.test(err.message)) {
        return { error: t('users.errTaken') };
      }
      throw err;
    }
    return { user: { id, name: trimmed, emoji } };
  },

  // Choisit (ou change) le sticker perso d'un guide
  async setUserEmoji(id, emoji) {
    emoji = (emoji || '').trim() || null;
    if (emoji) {
      const existing = await this.getUsers();
      if (existing.some(u => u.id !== id && u.emoji === emoji)) {
        return { error: t('users.errEmojiTaken') };
      }
    }
    await dbExecute('UPDATE users SET emoji = ? WHERE id = ?', [emoji, id]);
    // Le profil actif de cet appareil est en cache : on le garde à jour
    try {
      const cached = JSON.parse(localStorage.getItem('maxiguide.cache.user'));
      if (cached && cached.id === id) {
        cached.emoji = emoji;
        localStorage.setItem('maxiguide.cache.user', JSON.stringify(cached));
      }
    } catch { /* cache illisible : tant pis */ }
    return {};
  },

  // --- Fiches de notation ---

  // Retourne { domaineId: fiche } pour un utilisateur. Hors-ligne, retombe sur
  // la dernière lecture réussie (cache local) ; dans tous les cas, les fiches
  // en attente dans la file de sync sont posées par-dessus, comme si elles
  // étaient déjà en base.
  async getUserRatings(userId) {
    const cacheKey = `maxiguide.cache.ratings.${userId}`;
    let map;
    try {
      const rows = await dbExecute(
        `SELECT domaine_id, note_blanc, note_rouge, note_rose, note_whisky, note_jus,
                coeur, etoile, perso, commentaire
         FROM ratings WHERE user_id = ?`,
        [userId]
      );
      map = Object.fromEntries(rows.map(r => [r.domaine_id, r]));
      localStorage.setItem(cacheKey, JSON.stringify(map));
    } catch (err) {
      if (!err.retryable) throw err;
      const cached = localStorage.getItem(cacheKey);
      if (cached === null) throw err;
      map = JSON.parse(cached);
    }

    for (const op of SyncQueue.load()) {
      if (op.userId !== userId) continue;
      if (isEmptyFiche(op.fiche)) {
        delete map[op.domaineId];
      } else {
        map[op.domaineId] = {
          domaine_id: op.domaineId,
          ...Object.fromEntries(NOTE_KEYS.map(k => [k, op.fiche[k] || null])),
          ...Object.fromEntries(STICKER_KEYS.map(k => [k, op.fiche[k] || 0])),
          commentaire: (op.fiche.commentaire || '').trim() || null,
        };
      }
    }
    return map;
  },

  // Enregistre la fiche ; si le réseau manque, elle rejoint la file de sync et
  // partira toute seule. Retourne { queued } pour que la page notation puisse
  // afficher « enregistrée » ou « en attente de réseau ».
  async saveRating(userId, domaineId, fiche) {
    // Des fiches attendent déjà ? La nôtre passe derrière pour garder l'ordre.
    if (SyncQueue.size()) {
      SyncQueue.push({ userId, domaineId, fiche });
      const remaining = await SyncQueue.flush();
      return { queued: remaining > 0 };
    }

    try {
      await this.writeRating(userId, domaineId, fiche);
      return { queued: false };
    } catch (err) {
      if (!err.retryable) throw err;
      SyncQueue.push({ userId, domaineId, fiche });
      return { queued: true };
    }
  },

  // Écriture brute en base (utilisée par saveRating et la file de sync) ;
  // supprime la fiche si elle est entièrement vide
  async writeRating(userId, domaineId, fiche) {
    const commentaire = (fiche.commentaire || '').trim() || null;
    const NOTES = NOTE_KEYS;
    const empty = isEmptyFiche(fiche);

    if (empty) {
      await dbExecute(
        'DELETE FROM ratings WHERE user_id = ? AND domaine_id = ?',
        [userId, domaineId]
      );
      return;
    }

    await dbExecute(
      `INSERT INTO ratings (user_id, domaine_id, note_blanc, note_rouge, note_rose,
                            note_whisky, note_jus, coeur, etoile, perso, commentaire)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, domaine_id) DO UPDATE SET
         note_blanc = excluded.note_blanc,
         note_rouge = excluded.note_rouge,
         note_rose = excluded.note_rose,
         note_whisky = excluded.note_whisky,
         note_jus = excluded.note_jus,
         coeur = excluded.coeur,
         etoile = excluded.etoile,
         perso = excluded.perso,
         commentaire = excluded.commentaire,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      [
        userId, domaineId,
        ...NOTES.map(k => fiche[k] || null),
        ...STICKER_KEYS.map(k => fiche[k] || 0),
        commentaire,
      ]
    );
  },

  // --- Stats pour l'onglet Moyennes ---

  // Toutes les fiches de tout le monde, avec le nom du participant
  async getAllRatings() {
    return dbExecute(
      `SELECT r.user_id, u.name AS user_name, u.emoji AS user_emoji, r.domaine_id,
              r.note_blanc, r.note_rouge, r.note_rose, r.note_whisky, r.note_jus,
              r.coeur, r.etoile, r.perso, r.commentaire
       FROM ratings r
       JOIN users u ON u.id = r.user_id
       ORDER BY u.name COLLATE NOCASE`
    );
  },
};
