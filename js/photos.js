// Photos souvenirs d'une fiche — partagé entre la page de notation (ajout,
// vignettes supprimables) et les pages de lecture (guides, moyennes).
// Les photos vivent en data-URL JPEG compressées côté client dans la colonne
// photos de ratings : pas de stockage de fichiers, et la file de sync
// hors-ligne (js/storage.js) les embarque comme le reste de la fiche.
const MAX_PHOTOS = 3;

// Réduit une photo de téléphone (plusieurs Mo) à une taille raisonnable
// (~100 Ko) : grand côté limité à 1000 px, JPEG qualité 0.72.
function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t('photo.error')));
    };
    img.src = url;
  });
}

// Photo en plein écran — toucher n'importe où pour fermer
function openPhotoLightbox(src) {
  const overlay = document.createElement('div');
  overlay.className = 'photo-lightbox';
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  overlay.appendChild(img);
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

// Bande de vignettes cliquables (plein écran). onRemove (facultatif) ajoute
// un ✕ sur chaque photo — utilisé par la page de notation.
function makePhotoStrip(photos, { onRemove } = {}) {
  const strip = document.createElement('div');
  strip.className = 'photo-strip';
  photos.forEach((src, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';

    const view = document.createElement('button');
    view.type = 'button';
    view.className = 'photo-thumb-view';
    view.setAttribute('aria-label', t('photo.view', { n: i + 1 }));
    const img = document.createElement('img');
    img.src = src;
    img.alt = t('photo.alt', { n: i + 1 });
    view.appendChild(img);
    view.addEventListener('click', () => openPhotoLightbox(src));
    thumb.appendChild(view);

    if (onRemove) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'photo-thumb-remove';
      remove.textContent = '✕';
      remove.setAttribute('aria-label', t('photo.remove', { n: i + 1 }));
      remove.addEventListener('click', () => onRemove(i));
      thumb.appendChild(remove);
    }
    strip.appendChild(thumb);
  });
  return strip;
}
