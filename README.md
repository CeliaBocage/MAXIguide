# MAXIguide 🍷

Le jeu de dégustation de la fête des vins de Gaillac — site statique tout simple : pas de Node.js, pas de backend, pas d'authentification.

## Principe

Chaque invité choisit son profil (ou le crée, sans mot de passe), puis parcourt les 51 producteurs de la fête ([source](https://www.fete-vins-gaillac.com/les-vignerons)) et remplit sa fiche pour chaque stand dégusté :

- une note de 1 à 5 ⭐ **par boisson** : blancs ⚪, rouges 🔴, rosés 🌸, whisky 🥃 (distillerie Castan, domaine Cazottes) et jus de raisin 🍇 pour les softs — les rangées s'adaptent au type de domaine ;
- des **stickers** de 0 à 5 : ❤️ « on a adoré les gens », ⭐ « les vins étaient excellents » (1 c'est excellent, 2 c'est exceptionnel… 5 c'est légendaire) ;
- un **commentaire libre** facultatif.

Le plan du parc est recréé en SVG interactif d'après le [plan officiel](https://www.fete-vins-gaillac.com/plan-du-parc) : on peut noter un stand en le touchant, et le guide de chaque invité affiche ses stickers posés sur le plan.

Son score de complétion (part des domaines notés) est visible en continu dans le header, et la liste des domaines se filtre (tous / à déguster / notés) pour repérer vite où aller. L'onglet **Classements** affiche les podiums en direct — top par boisson, meilleure bouteille, meilleur domaine, les plus gentils ❤️, les plus étoilés ⭐, les guides les plus complets 📖 — et l'onglet **Moyennes** les stats détaillées du groupe. La page « Guides des invités » permet de feuilleter le guide de chacun, avec ses cœurs et étoiles posés sur le plan du parc.

**Réseau capricieux, pas de panique** : si la 4G du parc lâche, les fiches sont gardées sur
le téléphone (file de sync en `localStorage`, badge ⏳ dans le header) et repartent toutes
seules au retour du réseau. Les pages déjà visitées continuent de s'afficher grâce à un
cache local des lectures.

## Architecture

```
index.html                    → accueil : explication du jeu
pages/
├── users/                    → choix ou création de profil (la « connexion »)
├── domaines/                 → liste filtrable des domaines + plan du parc
├── notation/                 → fiche de notation d'un domaine (?domaine=<id>), nav stand ← →
├── classements/              → podiums 🏆 en direct (par boisson, domaines, guides…)
├── moyennes/                 → stats du groupe : complétion, plan moyen, détail par personne/domaine
└── guide/                    → guides des invités en lecture seule (?user=<id>)
css/style.css                 → styles communs
js/
├── data/domaines.js          → les 51 producteurs (n° de stand, type vin/whisky/mixte)
├── data/plan.js              → positions des stands sur le plan (rangées, provisoire)
├── plan.js                   → rendu SVG du plan du parc (partagé domaines/guide)
├── db.js                     → client HTTP Turso (fetch, aucune dépendance)
├── storage.js                → couche de données + file de sync hors-ligne
├── i18n.js                   → textes FR/EN (bouton 🇫🇷⇄🇬🇧)
└── header.js                 → header commun : onglets, score de complétion, badge ⏳
tests/                        → tests navigateur (ouvrir tests/index.html, réseau simulé)
secrets/
├── config.example.js         → modèle de config (committé)
└── config.js                 → URL + token Turso (gitignoré, jamais sur GitHub)
```

Chaque page vit dans son dossier avec son propre JS ; tout ce qui est partagé est dans `js/` et `css/`.

## Données

Les profils et les fiches sont partagés entre tous les téléphones via une base **Turso**
(le navigateur appelle directement son API HTTP — toujours pas de backend). Seul
`maxiguide.currentUserId` (le profil actif sur cet appareil) reste en `localStorage`.

Tables (voir `schema.sql`) :

- `users` — les profils (id, nom unique)
- `ratings` — une fiche par utilisateur et par domaine : `note_blanc`, `note_rouge`, `note_rose`, `note_whisky`, `note_jus` (1–5 ou NULL), `coeur`, `etoile` (0–5), `commentaire`

## Configurer la base Turso

```bash
turso db shell lemaxiguide < schema.sql
turso db tokens create lemaxiguide       # → token (option --expiration conseillée)
```

Puis copier `secrets/config.example.js` en `secrets/config.js` et y coller l'URL
(en remplaçant `libsql://` par `https://`) et le token.

⚠️ Le token est visible par quiconque ouvre le site déployé (c'est assumé pour un jeu entre
invités). `secrets/` est gitignoré pour ne rien publier sur GitHub ; créez un token à durée
limitée et révoquez-le après la fête (`turso db tokens invalidate lemaxiguide`).

## Lancer le site

Ouvrir `index.html` dans un navigateur, tout simplement. (Ou servir le dossier avec n'importe quel serveur statique, ex. `python3 -m http.server`.)

## Tests

Ouvrir `tests/index.html` dans un navigateur : la vingtaine de tests s'exécute sur place
(fetch est simulé — pannes de réseau, erreurs Turso, doublons de profils… — rien ne part
sur le vrai réseau) et la page affiche le total au vert ou les échecs en rouge.

## TODO

- [ ] Corriger l'attribution stand ↔ position sur le plan quand les numéros définitifs
      seront connus (réordonner les tableaux `stands` dans `js/data/plan.js`)
