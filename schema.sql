-- Schéma MAXIguide — à exécuter une fois : turso db shell <nom-de-la-base> < schema.sql
-- (si la base existait déjà avec l'ancien schéma : DROP TABLE ratings; puis relancer ce fichier)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Une fiche de notation par utilisateur et par domaine :
--   notes séparées blancs / rouges / rosés (1 à 5, NULL si pas goûté),
--   stickers de 0 à 5 : cœurs (« on a adoré les gens » — 1 c'est excellent,
--   2 c'est exceptionnel, etc.) et étoiles (« vins excellents », même échelle),
--   commentaire libre facultatif.
CREATE TABLE IF NOT EXISTS ratings (
  user_id TEXT NOT NULL REFERENCES users(id),
  domaine_id TEXT NOT NULL,
  note_blanc INTEGER CHECK (note_blanc BETWEEN 1 AND 5),
  note_rouge INTEGER CHECK (note_rouge BETWEEN 1 AND 5),
  note_rose INTEGER CHECK (note_rose BETWEEN 1 AND 5),
  note_whisky INTEGER CHECK (note_whisky BETWEEN 1 AND 5),
  note_jus INTEGER CHECK (note_jus BETWEEN 1 AND 5),
  coeur INTEGER NOT NULL DEFAULT 0 CHECK (coeur BETWEEN 0 AND 5),
  etoile INTEGER NOT NULL DEFAULT 0 CHECK (etoile BETWEEN 0 AND 5),
  commentaire TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, domaine_id)
);
