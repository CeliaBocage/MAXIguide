// Header commun des pages "connectées" (après le choix d'utilisateur).
// Chaque page définit `const BASE = '...'` (chemin relatif vers la racine)
// avant d'inclure ce script, puis appelle `await Header.mount(...)`, qui
// retourne l'utilisateur courant (ou null après redirection).
const Header = {
  user: null,

  async mount(activeTab) {
    this.user = await Storage.getCurrentUser();
    if (!this.user) {
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
      { key: 'moyennes', label: t('nav.moyennes'), href: BASE + 'pages/moyennes/index.html' },
    ]) {
      const link = document.createElement('a');
      link.href = tab.href;
      link.textContent = tab.label;
      link.className = 'tab' + (tab.key === activeTab ? ' active' : '');
      nav.appendChild(link);
    }

    const userBox = document.createElement('div');
    userBox.className = 'user-box';

    const name = document.createElement('span');
    name.className = 'user-name';
    name.textContent = this.user.name;

    const score = document.createElement('span');
    score.className = 'completion-badge';
    score.id = 'completion-badge';
    score.textContent = '…';

    const switchLink = document.createElement('a');
    switchLink.className = 'switch-user';
    switchLink.href = BASE + 'pages/users/index.html';
    switchLink.title = t('nav.switchUser');
    switchLink.textContent = '⇄';

    userBox.append(name, score, switchLink, I18N.makeToggle());
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
    const ratings = await Storage.getUserRatings(this.user.id);
    const rated = Object.keys(ratings).length;
    const pct = DOMAINES.length ? Math.round((rated / DOMAINES.length) * 100) : 0;
    badge.textContent = `${rated}/${DOMAINES.length} · ${pct} %`;
  },
};
