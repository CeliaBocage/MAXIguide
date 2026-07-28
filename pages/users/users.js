// Page de choix / création d'utilisateur — chaque guide a aussi son sticker
// perso (un emoji de la palette de js/emoji.js), choisi à la création ou
// après coup via le petit bouton ✏️ de sa carte.
const list = document.getElementById('user-list');
const noUsers = document.getElementById('no-users');
const form = document.getElementById('create-user-form');
const input = document.getElementById('new-user-name');
const errorEl = document.getElementById('form-error');
const paletteSlot = document.getElementById('emoji-palette-slot');

let users = [];            // dernière liste chargée (pour griser les emojis pris)
let selectedEmoji = null;  // sticker choisi dans le formulaire de création
let editingId = null;      // guide dont on est en train de changer le sticker

function enterAs(user) {
  Storage.setCurrentUser(user.id);
  window.location.href = '../domaines/index.html';
}

// Les emojis déjà pris par les autres guides (sauf celui qu'on édite)
function takenEmojis(exceptId = null) {
  return new Set(users.filter(u => u.emoji && u.id !== exceptId).map(u => u.emoji));
}

function renderCreatePalette() {
  paletteSlot.replaceChildren(makeEmojiPalette({
    taken: takenEmojis(),
    selected: selectedEmoji,
    onPick: (emoji) => {
      selectedEmoji = selectedEmoji === emoji ? null : emoji; // re-cliquer désélectionne
      renderCreatePalette();
    },
  }));
}

function renderUserList() {
  list.replaceChildren();
  noUsers.hidden = users.length > 0;

  for (const user of users) {
    const li = document.createElement('li');
    li.className = 'user-item';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'user-card';
    btn.textContent = user.emoji ? `${user.emoji} ${user.name}` : user.name;
    btn.addEventListener('click', () => enterAs(user));

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'user-emoji-edit';
    edit.textContent = user.emoji ? '✏️' : '✨';
    edit.title = t('users.editSticker', { name: user.name });
    edit.setAttribute('aria-label', edit.title);
    edit.addEventListener('click', () => {
      editingId = editingId === user.id ? null : user.id;
      renderUserList();
    });

    li.append(btn, edit);
    list.appendChild(li);

    if (editingId === user.id) {
      const editor = document.createElement('li');
      editor.className = 'user-emoji-editor';
      editor.appendChild(makeEmojiPalette({
        taken: takenEmojis(user.id),
        selected: user.emoji,
        onPick: async (emoji) => {
          if (emoji === user.emoji) { // déjà le sien : rien à changer
            editingId = null;
            renderUserList();
            return;
          }
          try {
            const { error } = await Storage.setUserEmoji(user.id, emoji);
            if (error) {
              errorEl.textContent = error;
              errorEl.hidden = false;
              return;
            }
          } catch (err) {
            showDbError(err);
            return;
          }
          user.emoji = emoji;
          editingId = null;
          renderUserList();
          renderCreatePalette();
        },
      }));
      list.appendChild(editor);
    }
  }
}

async function renderUsers() {
  users = await Storage.getUsers();
  renderUserList();
  renderCreatePalette();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const { user, error } = await Storage.createUser(input.value, selectedEmoji);
    if (error) {
      errorEl.textContent = error;
      errorEl.hidden = false;
      return;
    }
    enterAs(user);
  } catch (err) {
    showDbError(err);
  } finally {
    submitBtn.disabled = false;
  }
});

renderUsers().catch(showDbError);
