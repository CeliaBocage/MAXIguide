// Service worker — le site entier tient sur le téléphone.
//
// La file de sync (js/storage.js) savait déjà attendre le retour du réseau pour
// les écritures, mais si la 4G du parc lâchait et qu'on rechargeait la page, le
// navigateur n'avait plus rien à afficher : l'appli elle-même venait du réseau.
// Ici on garde une copie de tous les fichiers du site, servie d'emblée.
//
// Stratégie : on répond avec la copie locale (instantané, marche sans réseau) et
// on rafraîchit en arrière-plan. Un déploiement est donc visible à la visite
// suivante. Bump de CACHE = on repart d'un cache propre.
const CACHE = 'maxiguide-v1';

// Tout ce qu'il faut pour que chaque page s'ouvre hors-ligne. Les data-URL des
// photos, elles, restent en base : elles ne se chargent que sur demande.
const FICHIERS = [
  './',
  'index.html',
  'manifest.json',
  'icon.svg',
  'icons/icon-512.png',
  'css/style.css',
  'secrets/config.js',
  'js/i18n.js',
  'js/db.js',
  'js/storage.js',
  'js/header.js',
  'js/pwa.js',
  'js/emoji.js',
  'js/photos.js',
  'js/bottle.js',
  'js/svg.js',
  'js/plan.js',
  'js/carte.js',
  'js/data/domaines.js',
  'js/data/plan.js',
  'js/data/carte.js',
  'js/data/paysage.js',
  'pages/users/index.html',
  'pages/users/users.js',
  'pages/domaines/index.html',
  'pages/domaines/domaines.js',
  'pages/notation/index.html',
  'pages/notation/notation.js',
  'pages/classements/index.html',
  'pages/classements/classements.js',
  'pages/moyennes/index.html',
  'pages/moyennes/moyennes.js',
  'pages/guide/index.html',
  'pages/guide/guide.js',
];

// Un fichier qui manque (secrets/config.js absent en local, par exemple) ne doit
// pas faire échouer toute l'installation : on prend ce qu'on peut.
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(FICHIERS.map(f => cache.add(f).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom !== CACHE) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Turso, c'est du POST vers un autre domaine : jamais notre affaire (et il ne
  // faut surtout pas mettre les réponses de la base en cache).
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(servir(req, url));
});

async function servir(req, url) {
  const cache = await caches.open(CACHE);
  // ?domaine=rotier ou ?user=u1 ne changent pas le fichier servi : une seule
  // entrée par chemin, sinon le cache se remplirait d'une copie par domaine.
  const cle = url.origin + url.pathname;

  const connu = await cache.match(cle);
  const reseau = fetch(req).then((res) => {
    if (res.ok) cache.put(cle, res.clone());
    return res;
  });

  if (connu) {
    reseau.catch(() => {}); // rafraîchissement silencieux, échec sans conséquence
    return connu;
  }
  return reseau;
}
