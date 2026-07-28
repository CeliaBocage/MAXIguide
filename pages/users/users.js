// Page de choix / création d'utilisateur
const list = document.getElementById('user-list');
const noUsers = document.getElementById('no-users');
const form = document.getElementById('create-user-form');
const input = document.getElementById('new-user-name');
const errorEl = document.getElementById('form-error');

function enterAs(user) {
  Storage.setCurrentUser(user.id);
  window.location.href = '../domaines/index.html';
}

async function renderUsers() {
  const users = await Storage.getUsers();
  list.replaceChildren();
  noUsers.hidden = users.length > 0;

  for (const user of users) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'user-card';
    btn.textContent = user.name;
    btn.addEventListener('click', () => enterAs(user));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const { user, error } = await Storage.createUser(input.value);
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
