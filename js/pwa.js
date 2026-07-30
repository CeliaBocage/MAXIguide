// Installe le service worker (sw.js), qui garde une copie du site sur le
// téléphone : dans le parc, un rechargement sans réseau continue d'afficher
// l'appli. À inclure sur toutes les pages, après les autres scripts.
//
// Deux cas où il ne se passe rien, et c'est normal : les service workers
// demandent http(s) (ouvrir index.html en file:// n'en aura pas), et un
// navigateur qui n'en veut pas nous laisse le site tel qu'avant.
(() => {
  if (!('serviceWorker' in navigator)) return;
  if (!location.protocol.startsWith('http')) return;

  // sw.js vit à la racine du site — c'est ce qui lui donne la main sur toutes
  // les pages, y compris pages/*. On le retrouve depuis js/pwa.js, quelle que
  // soit la profondeur de la page courante.
  const sw = new URL('../sw.js', document.currentScript.src);
  addEventListener('load', () => navigator.serviceWorker.register(sw).catch(() => {}));
})();
