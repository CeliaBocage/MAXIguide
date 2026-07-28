// Palette des stickers persos : chaque guide choisit l'emoji qui le représente.
// Utilisé par la page de création de profil et par la page de notation
// (premier sticker perso posé). En plus des propositions rapides, un champ
// libre accepte n'importe quel emoji tapé avec le clavier du téléphone.
// Un emoji déjà pris par un autre guide est grisé / refusé.
const GUIDE_EMOJIS = [
  '🦄', '🦋', '🐙', '🐸', '🦊', '🐼', '🦁', '🐝',
  '🦜', '🦕', '🐌', '🦔', '🍄', '🌵', '🌈', '🌻',
  '🍒', '🍍', '🥑', '🍩', '🎸', '🚀', '👑', '🍀',
];

// Nettoie une saisie clavier : garde le premier « caractère perçu » (les
// emojis composés — drapeaux, 👩‍🚀 — font plusieurs code points), et refuse
// tout ce qui n'est pas un emoji (lettres, chiffres…). Retourne null si rien
// d'utilisable.
function normalizeCustomEmoji(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const first = typeof Intl !== 'undefined' && Intl.Segmenter
    ? [...new Intl.Segmenter().segment(trimmed)][0].segment
    : [...trimmed][0]; // vieux navigateur : premier code point, ça reste correct pour les emojis simples
  return /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u.test(first) ? first : null;
}

// Palette de choix : grille de propositions + champ libre pour le clavier.
// options :
//   taken    : Set des emojis déjà pris (grisés, non cliquables)
//   selected : emoji actuellement choisi (entouré ; affiché même s'il ne
//              vient pas de la grille)
//   onPick(emoji) : appelé au clic sur un emoji libre ou à la saisie d'un
//              emoji valide au clavier
function makeEmojiPalette({ taken = new Set(), selected = null, onPick } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'emoji-palette-wrap';

  const grid = document.createElement('div');
  grid.className = 'emoji-palette';
  // Un emoji tapé au clavier n'est pas dans la grille : on l'y ajoute pour
  // qu'il apparaisse entouré comme les autres.
  const choices = selected && !GUIDE_EMOJIS.includes(selected)
    ? [...GUIDE_EMOJIS, selected]
    : GUIDE_EMOJIS;
  for (const emoji of choices) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-option' + (emoji === selected ? ' active' : '');
    btn.textContent = emoji;
    if (taken.has(emoji) && emoji !== selected) {
      btn.disabled = true;
      btn.title = t('users.emojiTaken');
    } else {
      btn.addEventListener('click', () => onPick && onPick(emoji));
    }
    grid.appendChild(btn);
  }

  // Champ libre : taper (ou coller) un emoji le choisit aussitôt, comme un
  // clic sur la grille.
  const custom = document.createElement('div');
  custom.className = 'emoji-custom';

  const hint = document.createElement('span');
  hint.className = 'muted emoji-custom-hint';
  hint.textContent = t('users.customEmoji');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'emoji-custom-input';
  input.maxLength = 16; // les emojis composés (👨‍👩‍👧) prennent plusieurs unités
  input.placeholder = '😀';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', t('users.customEmoji'));

  const errorEl = document.createElement('p');
  errorEl.className = 'error emoji-custom-error';
  errorEl.hidden = true;

  const tryPick = () => {
    errorEl.hidden = true;
    if (!input.value.trim()) return;
    const emoji = normalizeCustomEmoji(input.value);
    if (!emoji) {
      errorEl.textContent = t('users.errNotEmoji');
      errorEl.hidden = false;
      return;
    }
    if (taken.has(emoji) && emoji !== selected) {
      errorEl.textContent = t('users.errEmojiTaken');
      errorEl.hidden = false;
      return;
    }
    if (onPick) onPick(emoji);
  };

  input.addEventListener('input', tryPick);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // ne pas soumettre le formulaire englobant
      tryPick();
    }
  });

  custom.append(hint, input);
  wrap.append(grid, custom, errorEl);
  return wrap;
}
