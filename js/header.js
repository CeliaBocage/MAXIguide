// Header commun des pages "connectées" (après le choix d'utilisateur).
// Chaque page définit `const BASE = '...'` (chemin relatif vers la racine)
// avant d'inclure ce script, puis appelle `await Header.mount(...)`, qui
// retourne l'utilisateur courant (ou null après redirection).
//
// Les pages ouvertes à tous (accueil, guides des invités) passent
// `{ requireUser: false }` : le header s'affiche quand même, avec un lien
// « Choisir mon profil » à la place du nom, et personne n'est redirigé.
const Header = {
  user: null,

  async mount(activeTab, { requireUser = true } = {}) {
    try {
      this.user = await Storage.getCurrentUser();
    } catch {
      // Base injoignable : sur une page ouverte à tous, le header reste utile
      if (requireUser) throw new Error('utilisateur introuvable');
      this.user = null;
    }
    if (!this.user && requireUser) {
      window.location.replace(BASE + 'pages/users/index.html');
      return null;
    }

    const header = document.createElement('header');
    header.className = 'site-header';

    const brand = document.createElement('a');
    brand.className = 'brand';
    brand.href = BASE + 'index.html';
    brand.textContent = 'MAXIguide';

    const nav = document.createElement('nav');
    nav.className = 'tabs';
    for (const tab of [
      { key: 'domaines', label: t('nav.domaines'), href: BASE + 'pages/domaines/index.html' },
      { key: 'classements', label: t('nav.classements'), href: BASE + 'pages/classements/index.html' },
      { key: 'moyennes', label: t('nav.moyennes'), href: BASE + 'pages/moyennes/index.html' },
      { key: 'guides', label: t('nav.guides'), href: BASE + 'pages/guide/index.html' },
    ]) {
      const link = document.createElement('a');
      link.href = tab.href;
      link.textContent = tab.label;
      link.className = 'tab' + (tab.key === activeTab ? ' active' : '');
      nav.appendChild(link);
    }

    const userBox = document.createElement('div');
    userBox.className = 'user-box';

    // Personne de connecté : on invite simplement à choisir un profil
    if (!this.user) {
      const signIn = document.createElement('a');
      signIn.className = 'switch-user sign-in';
      signIn.href = BASE + 'pages/users/index.html';
      signIn.textContent = t('nav.signIn');
      userBox.append(signIn, I18N.makeToggle());
      header.append(brand, nav, userBox);
      document.body.prepend(header);
      return null;
    }

    const name = document.createElement('span');
    name.className = 'user-name';
    name.textContent = this.user.emoji
      ? `${this.user.emoji} ${this.user.name}`
      : this.user.name;

    const score = document.createElement('span');
    score.className = 'completion-badge';
    score.id = 'completion-badge';
    score.textContent = '…';

    // Badge ⏳ : fiches en attente de réseau (file de sync de js/storage.js)
    const sync = document.createElement('span');
    sync.className = 'sync-badge';
    sync.hidden = true;
    const updateSync = (pending) => {
      sync.hidden = !pending;
      sync.textContent = `⏳ ${pending}`;
      sync.title = t('sync.pending', { n: pending });
    };
    updateSync(SyncQueue.size());
    document.addEventListener('maxiguide:sync', (e) => {
      updateSync(e.detail.pending);
      // Des fiches viennent de partir : le score de complétion peut bouger
      if (!e.detail.pending) this.refreshCompletion();
    });

    const switchLink = document.createElement('a');
    switchLink.className = 'switch-user';
    switchLink.href = BASE + 'pages/users/index.html';
    switchLink.title = t('nav.switchUser');
    switchLink.textContent = '⇄';

    userBox.append(name, score, sync, switchLink, I18N.makeToggle());
    header.append(brand, nav, userBox);
    document.body.prepend(header);

    await this.refreshCompletion();
    return this.user;
  },

  // À appeler après chaque notation pour mettre à jour le score en continu
  async refreshCompletion() {
    if (!this.user) return;
    const badge = document.getElementById('completion-badge');
    if (!badge) return;
    let ratings;
    try {
      ratings = await Storage.getUserRatings(this.user.id);
    } catch {
      return; // hors-ligne sans cache : on garde l'ancien score affiché
    }
    const rated = Object.keys(ratings).length;
    const pct = DOMAINES.length ? Math.round((rated / DOMAINES.length) * 100) : 0;
    badge.textContent = `${rated}/${DOMAINES.length} · ${pct} %`;
  },
};
