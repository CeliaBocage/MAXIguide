// Internationalisation FR/EN — la langue choisie est mémorisée sur l'appareil.
// - Les textes statiques du HTML portent data-i18n / data-i18n-placeholder (clé du dictionnaire).
// - Les textes construits en JS passent par t('clé', { variables }).
// À charger AVANT tous les autres scripts (db.js, data/domaines.js, etc.).
const I18N = (() => {
  const KEY = 'maxiguide.lang';

  const STRINGS = {
    fr: {
      // Navigation / header
      'nav.domaines': 'Domaines',
      'nav.classements': 'Classements',
      'nav.moyennes': 'Moyennes',
      'nav.switchUser': "Changer d'utilisateur",
      'nav.signIn': 'Choisir mon profil',
      'sync.pending': '{n} fiche(s) en attente de réseau — elles partiront toutes seules dès que possible.',

      // Accueil
      'home.pageTitle': 'MAXIguide — Accueil',
      'home.tagline': 'Le jeu de dégustation de la fête des vins de Gaillac',
      'home.how': 'Comment ça marche ?',
      'home.intro': 'Bienvenue à la fête des vins de Gaillac ! Le principe est simple : parcourez le parc, dégustez, et notez chaque domaine que vous visitez.',
      'home.step1': '🧑 Choisissez votre profil (ou créez-le en deux secondes, sans mot de passe).',
      'home.step2': '🍇 Explorez les domaines, en liste ou sur le plan du parc.',
      'home.step3': '⭐ Notez chaque domaine dégusté, de 1 à 5 étoiles.',
      'home.step4': '📊 Suivez votre score de complétion en continu, et comparez-vous au groupe dans les onglets Classements et Moyennes.',
      'home.goal': 'Objectif : 100 % de complétion. Bonne dégustation !',
      'home.makeGuide': 'Faire mon guide',
      'home.viewGuides': 'Regarder les guides',
      'home.resumeAs': 'Reprendre en tant que {name}',
      'home.carteTitle': '🗺️ La carte du vignoble',
      'home.carteHint': 'Les domaines de la fête ne sortent pas de nulle part : voici où poussent vraiment leurs vignes, autour du Tarn et de la Vère. Chaque domaine a sa couleur — zoomez pour vous promener dedans.',

      // Choix / création d'utilisateur
      'users.pageTitle': 'MAXIguide — Qui êtes-vous ?',
      'users.heading': 'Qui êtes-vous ?',
      'users.tagline': "Choisissez votre profil, ou créez-le si vous n'êtes pas dans la liste.",
      'users.participants': 'Participants',
      'users.none': 'Personne pour l’instant — créez le premier profil !',
      'users.create': 'Créer un profil',
      'users.placeholder': 'Votre prénom ou pseudo',
      'users.createBtn': 'Créer et entrer',
      'users.watchOthers': 'Juste regarder les guides des autres →',
      'users.errEmpty': 'Le nom ne peut pas être vide.',
      'users.errTaken': 'Ce nom est déjà pris — choisissez-le dans la liste !',
      'users.stickerLabel': 'Ton sticker perso',
      'users.stickerHint': "C'est ton emoji à toi : tu pourras le coller sur tes stands préférés. (Facultatif — tu pourras le choisir plus tard.)",
      'users.editSticker': 'Changer le sticker de {name}',
      'users.emojiTaken': 'Déjà pris par un autre guide',
      'users.errEmojiTaken': 'Ce sticker est déjà pris par un autre guide — choisis-en un autre !',
      'users.customEmoji': '… ou tape le tien avec ton clavier :',
      'users.errNotEmoji': 'Ça doit être un emoji !',
      'common.backHome': "← Retour à l'accueil",

      // Guides des invités
      'guide.pageTitle': 'MAXIguide — Guides des invités',
      'guide.heading': 'Les guides des invités',
      'guide.tagline': 'Choisissez un invité pour feuilleter son guide.',
      'guide.selectLabel': 'Le guide de…',
      'guide.selectPlaceholder': '— Choisir un invité —',
      'guide.planTitle': 'Son plan du parc',
      'guide.planHint': 'Ses ❤️, ⭐ et son sticker perso sont posés sur les stands.',
      'guide.carteTitle': 'Sa carte du vignoble',
      'guide.carteHint': 'Les domaines qu’il ou elle a notés, à l’endroit où ils se trouvent vraiment dans le Gaillacois.',
      'guide.cards': 'Ses fiches',
      'guide.empty': "Cet invité n'a encore rien noté.",

      // Page domaines
      'domaines.pageTitle': 'MAXIguide — Domaines',
      'domaines.viewList': 'Liste',
      'domaines.viewPlan': 'Plan du parc',
      'domaines.heading': 'Les domaines',
      'domaines.planHeading': 'Plan du parc',
      'domaines.planHint': 'Touchez un stand pour le noter — les stands verts sont déjà dans votre guide.',
      'domaines.toTaste': 'À déguster',
      'domaines.emptyCard': 'Fiche vide',
      'domaines.filterAll': 'Tous',
      'domaines.filterTodo': 'À déguster',
      'domaines.filterDone': 'Notés',
      'domaines.searchPlaceholder': 'Chercher un domaine ou un n° de stand…',
      'domaines.searchEmpty': 'Aucun domaine ne correspond.',

      // Page notation
      'notation.pageTitle': 'MAXIguide — Notation',
      'notation.sub': 'Stand {stand} — notez ce que vous avez dégusté (re-cliquez sur la même valeur pour effacer).',
      'notation.drinks': 'Les vins',
      'notation.stickers': 'Les stickers',
      'notation.stickerHint': "1 c'est excellent, 2 c'est exceptionnel… 5 c'est légendaire !",
      'notation.comment': 'Un petit mot ?',
      'notation.commentPlaceholder': 'Votre note écrite (facultatif) : une anecdote, un vin à retenir…',
      'notation.save': 'Enregistrer',
      'notation.saved': '✔ Fiche enregistrée !',
      'notation.savedPending': '⏳ Fiche gardée sur cet appareil — elle partira toute seule au retour du réseau !',
      'notation.back': '← Retour aux domaines',
      'notation.lovePeople': 'On a adoré les gens',
      'notation.loveWines': 'Les vins étaient excellents',
      'notation.myOwn': 'Mon sticker perso',
      'notation.pickEmoji': "Choisis d'abord ton sticker perso — il te suivra partout :",
      'notation.ariaValue': '{label} : {value} sur 5',
      'notation.addSticker': '➕ Ajouter un sticker',
      'notation.whichSticker': 'Quel sticker ?',
      'notation.howMany': 'Combien ?',
      'notation.chipEdit': '{label} : {count} — modifier',
      'notation.chipRemove': 'Retirer le sticker « {label} »',
      'notation.photoHint': 'Vous avez surkiffé une bouteille ? Gardez-en jusqu’à 3 photos !',
      'notation.addPhoto': '📷 Ajouter une photo',
      'photo.view': 'Agrandir la photo {n}',
      'photo.alt': 'Photo {n}',
      'photo.remove': 'Retirer la photo {n}',
      'photo.error': 'Impossible de lire cette image — réessayez avec une autre.',

      // Boissons
      'boisson.blanc': '⚪ Blancs',
      'boisson.rouge': '🔴 Rouges',
      'boisson.rose': '🌸 Rosés',
      'boisson.whisky': '🥃 Whisky',
      'boisson.jus': '🍇 Jus de raisin',

      // Page classements
      'res.pageTitle': 'MAXIguide — Classements',
      'res.rankingsTitle': '🏆 Les classements',
      'res.rankingsHint': 'Mis à jour en continu, au fil des dégustations.',
      'res.best': 'Top {boisson}',
      'res.bestBottle': '🍾 La meilleure bouteille',
      'res.bestDomaine': '🏅 Le meilleur domaine',
      'res.nicest': '❤️ Les plus gentils',
      'res.starriest': '⭐ Les plus étoilés',
      'res.mostStickered': '✨ Les plus stickés (stickers persos)',
      'res.completest': '📖 Les guides les plus complets',
      'res.noRanking': 'Pas encore de notes — à vos verres !',
      'res.note': '{n} note',
      'res.notes': '{n} notes',

      // Page moyennes
      'moy.pageTitle': 'MAXIguide — Moyennes',
      'moy.groupTitle': 'Le groupe',
      'moy.avgCompletion': 'Complétion moyenne',
      'moy.coverage': 'Domaines couverts par le groupe',
      'moy.planTitle': 'Le plan moyen du groupe',
      'moy.planHint': 'Les stickers moyens du groupe sont posés sur chaque stand, et l’emoji de chaque participant passé par le stand s’affiche en dessous — les stands verts ont été notés au moins une fois.',
      'moy.carteTitle': 'La carte du vignoble',
      'moy.carteHint': 'Chaque domaine a sa couleur, et ses vignes sont teintées pareil. Sa note moyenne s’affiche à côté de son nom — zoomez pour lire les zones les plus serrées.',
      'moy.usersTitle': 'Détail par participant',
      'moy.usersHint': 'Dépliez un participant pour voir toutes ses fiches.',
      'moy.domainesTitle': 'Détail par domaine',
      'moy.domainesHint': 'Du mieux noté au moins bien noté, avec sa place au classement. Dépliez un domaine pour voir les moyennes et les fiches de chacun.',
      'moy.rankTitle': 'Place {n} au classement des domaines — {avg}/5 de moyenne',
      'moy.rankNone': 'Pas encore de note : pas encore de place au classement.',
      'moy.rankBadge': 'n°{n}',
      'moy.ratedCount': '{rated}/{total} notés',
      'moy.noRatingsUser': 'Aucune fiche pour l’instant.',
      'moy.noRatingsDomaine': "Personne n'a encore noté ce domaine.",
      'moy.noCards': 'aucune fiche',
      'moy.card': '{n} fiche',
      'moy.cards': '{n} fiches',
      'moy.averages': 'Moyennes',

      // Plan du parc
      'plan.aria': 'Plan du parc de la fête des vins',
      'plan.protection': 'PROTECTION CIVILE',
      'plan.garderie': '🧸\nGARDERIE',
      'plan.chateau': 'CHÂTEAU',
      'plan.yoga': 'VINS\n&\nYOGA',
      'plan.foodtrucks': 'FOOD TRUCKS',
      'plan.bar': 'BAR',
      'plan.scene': 'SCÈNE',
      'plan.vip': 'ESPACE VIP',
      'plan.village': '🍷 VILLAGE VIGNERONS',
      'plan.resto': '🍴 ESPACE RESTAURATION',
      'plan.info': 'ℹ️ POINT INFO',
      'plan.entree': '➜ ENTRÉE GÉNÉRALE',
      'plan.sortie': 'SORTIE ➜',
      'plan.chargement': 'AIRE DE CHARGEMENT',
      'plan.legendTaste': 'Stand à déguster',
      'plan.legendRated': 'Stand noté ✔',
      'plan.legendAnim': 'Animations',
      'plan.legendFood': 'Village gourmand',
      'plan.standTitle': 'Stand {stand} — {name}',

      // Carte réelle du vignoble
      'carte.aria': 'Carte du vignoble gaillacois — où se trouvent vraiment les domaines',
      'carte.standTitle': 'Stand {stand} — {name} ({commune})',
      'carte.legendTodo': 'Domaine pas encore noté',
      'carte.legendRatedDot': 'Domaine noté — ses ❤️⭐ et sa note moyenne s’affichent',
      'carte.legendOwnVines': 'Les vignes d’un domaine, à sa couleur',
      'carte.legendOtherVines': 'Vignes sans domaine assez proche',
      'carte.legendRiver': 'Rivière',
      'carte.legendVillage': 'Village',
      'carte.legendWood': 'Bois',
      'carte.legendWater': 'Plan d’eau',
      'carte.legendTown': 'Village bâti',
      'carte.zoomHint': 'Zoomez (+ / − ou double-clic) pour faire apparaître tous les noms, puis glissez pour vous promener.',
      'carte.attrNote': 'Chaque parcelle est rattachée à la cave la plus proche à moins de 2 km : OpenStreetMap ne dit pas qui cultive quoi.',
      'carte.listTitle': 'Les {n} domaines',
      'carte.searchPlaceholder': 'Chercher un domaine…',
      'carte.listEmpty': 'Aucun domaine ne correspond.',
      'carte.focus': 'Voir {name} sur la carte',
      'carte.fullscreen': 'Carte en plein écran',
      'carte.fullscreenExit': 'Quitter le plein écran',
      'carte.zoomIn': 'Zoomer',
      'carte.zoomOut': 'Dézoomer',
      'carte.zoomReset': 'Revoir toute la carte',
      'carte.scale': '{n} km',
      'carte.credits': 'Domaines : annuaire des Vins de Gaillac · Vignes, bois et rivières : © contributeurs OpenStreetMap',

      // Erreurs base de données
      'db.notConfigured': "Base non configurée : copiez secrets/config.example.js en secrets/config.js et remplissez l'URL et le token Turso.",
      'db.http': 'Erreur Turso : HTTP {status}',
      'db.sql': 'Erreur SQL : {message}',
      'db.network': 'Réseau injoignable — vos fiches sont gardées sur cet appareil et partiront toutes seules.',
    },

    en: {
      // Navigation / header
      'nav.domaines': 'Wineries',
      'nav.classements': 'Rankings',
      'nav.moyennes': 'Averages',
      'nav.switchUser': 'Switch user',
      'nav.signIn': 'Pick my profile',
      'sync.pending': '{n} card(s) waiting for network — they will be sent automatically as soon as possible.',

      // Home
      'home.pageTitle': 'MAXIguide — Home',
      'home.tagline': 'The tasting game of the Gaillac wine festival',
      'home.how': 'How does it work?',
      'home.intro': 'Welcome to the Gaillac wine festival! The idea is simple: wander around the park, taste, and rate every winery you visit.',
      'home.step1': '🧑 Pick your profile (or create it in two seconds, no password needed).',
      'home.step2': '🍇 Browse the wineries, as a list or on the park map.',
      'home.step3': '⭐ Rate every winery you taste, from 1 to 5 stars.',
      'home.step4': '📊 Track your completion score live, and compare yourself with the group in the Rankings and Averages tabs.',
      'home.goal': 'Goal: 100% completion. Happy tasting!',
      'home.makeGuide': 'Build my guide',
      'home.viewGuides': 'Browse the guides',
      'home.resumeAs': 'Continue as {name}',
      'home.carteTitle': '🗺️ The vineyard map',
      'home.carteHint': "The festival's wineries come from somewhere: here is where their vines actually grow, along the Tarn and the Vère. Every winery has its own colour — zoom in and wander around.",

      // User selection / creation
      'users.pageTitle': 'MAXIguide — Who are you?',
      'users.heading': 'Who are you?',
      'users.tagline': "Pick your profile, or create it if you're not on the list.",
      'users.participants': 'Participants',
      'users.none': 'Nobody yet — create the first profile!',
      'users.create': 'Create a profile',
      'users.placeholder': 'Your first name or nickname',
      'users.createBtn': 'Create and enter',
      'users.watchOthers': "Just browse the others' guides →",
      'users.errEmpty': 'The name cannot be empty.',
      'users.errTaken': 'This name is already taken — pick it from the list!',
      'users.stickerLabel': 'Your personal sticker',
      'users.stickerHint': "It's your very own emoji: you'll get to stick it on your favourite stands. (Optional — you can pick it later.)",
      'users.editSticker': "Change {name}'s sticker",
      'users.emojiTaken': 'Already taken by another guide',
      'users.errEmojiTaken': 'This sticker is already taken by another guide — pick another one!',
      'users.customEmoji': '… or type your own with your keyboard:',
      'users.errNotEmoji': 'It must be an emoji!',
      'common.backHome': '← Back to home',

      // Guest guides
      'guide.pageTitle': 'MAXIguide — Guest guides',
      'guide.heading': "The guests' guides",
      'guide.tagline': 'Pick a guest to flip through their guide.',
      'guide.selectLabel': 'The guide of…',
      'guide.selectPlaceholder': '— Pick a guest —',
      'guide.planTitle': 'Their park map',
      'guide.planHint': 'Their ❤️, ⭐ and personal sticker are placed on the stands.',
      'guide.carteTitle': 'Their vineyard map',
      'guide.carteHint': 'The wineries they rated, shown where they really sit in the Gaillac countryside.',
      'guide.cards': 'Their tasting cards',
      'guide.empty': "This guest hasn't rated anything yet.",

      // Wineries page
      'domaines.pageTitle': 'MAXIguide — Wineries',
      'domaines.viewList': 'List',
      'domaines.viewPlan': 'Park map',
      'domaines.heading': 'The wineries',
      'domaines.planHeading': 'Park map',
      'domaines.planHint': 'Tap a stand to rate it — green stands are already in your guide.',
      'domaines.toTaste': 'To taste',
      'domaines.emptyCard': 'Empty card',
      'domaines.filterAll': 'All',
      'domaines.filterTodo': 'To taste',
      'domaines.filterDone': 'Rated',
      'domaines.searchPlaceholder': 'Search a winery or a stand no.…',
      'domaines.searchEmpty': 'No winery matches.',

      // Rating page
      'notation.pageTitle': 'MAXIguide — Rating',
      'notation.sub': 'Stand {stand} — rate what you tasted (click the same value again to clear).',
      'notation.drinks': 'The drinks',
      'notation.stickers': 'The stickers',
      'notation.stickerHint': '1 is excellent, 2 is exceptional… 5 is legendary!',
      'notation.comment': 'A little note?',
      'notation.commentPlaceholder': 'Your written note (optional): a story, a wine to remember…',
      'notation.save': 'Save',
      'notation.saved': '✔ Card saved!',
      'notation.savedPending': '⏳ Card kept on this device — it will be sent automatically once the network is back!',
      'notation.back': '← Back to the wineries',
      'notation.lovePeople': 'We loved the people',
      'notation.loveWines': 'The wines were excellent',
      'notation.myOwn': 'My personal sticker',
      'notation.pickEmoji': 'First pick your personal sticker — it will follow you everywhere:',
      'notation.ariaValue': '{label}: {value} out of 5',
      'notation.addSticker': '➕ Add a sticker',
      'notation.whichSticker': 'Which sticker?',
      'notation.howMany': 'How many?',
      'notation.chipEdit': '{label}: {count} — edit',
      'notation.chipRemove': 'Remove the "{label}" sticker',
      'notation.photoHint': 'Fell head over heels for a bottle? Keep up to 3 photos!',
      'notation.addPhoto': '📷 Add a photo',
      'photo.view': 'Enlarge photo {n}',
      'photo.alt': 'Photo {n}',
      'photo.remove': 'Remove photo {n}',
      'photo.error': 'Could not read this image — try another one.',

      // Drinks
      'boisson.blanc': '⚪ Whites',
      'boisson.rouge': '🔴 Reds',
      'boisson.rose': '🌸 Rosés',
      'boisson.whisky': '🥃 Whisky',
      'boisson.jus': '🍇 Grape juice',

      // Rankings page
      'res.pageTitle': 'MAXIguide — Rankings',
      'res.rankingsTitle': '🏆 The rankings',
      'res.rankingsHint': 'Updated live, as the tastings go on.',
      'res.best': 'Top {boisson}',
      'res.bestBottle': '🍾 The best bottle',
      'res.bestDomaine': '🏅 The best winery',
      'res.nicest': '❤️ The nicest ones',
      'res.starriest': '⭐ The most starred',
      'res.mostStickered': '✨ The most stickered (personal stickers)',
      'res.completest': '📖 The most complete guides',
      'res.noRanking': 'No ratings yet — raise your glasses!',
      'res.note': '{n} rating',
      'res.notes': '{n} ratings',

      // Averages page
      'moy.pageTitle': 'MAXIguide — Averages',
      'moy.groupTitle': 'The group',
      'moy.avgCompletion': 'Average completion',
      'moy.coverage': 'Wineries covered by the group',
      'moy.planTitle': "The group's average map",
      'moy.planHint': "The group's average stickers are placed on each stand, with the emoji of every participant who visited it shown below — green stands have been rated at least once.",
      'moy.carteTitle': 'The vineyard map',
      'moy.carteHint': 'Every winery has its own colour, and its vines are tinted to match. Its average rating sits next to its name — zoom in to read the crowded spots.',
      'moy.usersTitle': 'Breakdown by participant',
      'moy.usersHint': 'Expand a participant to see all their cards.',
      'moy.domainesTitle': 'Breakdown by winery',
      'moy.domainesHint': "From best-rated to least, with its ranking place. Expand a winery to see the averages and everyone's cards.",
      'moy.rankTitle': 'Rank {n} in the wineries ranking — {avg}/5 average',
      'moy.rankNone': 'No rating yet, so no place in the ranking.',
      'moy.rankBadge': '#{n}',
      'moy.ratedCount': '{rated}/{total} rated',
      'moy.noRatingsUser': 'No cards yet.',
      'moy.noRatingsDomaine': 'Nobody has rated this winery yet.',
      'moy.noCards': 'no cards',
      'moy.card': '{n} card',
      'moy.cards': '{n} cards',
      'moy.averages': 'Averages',

      // Park map
      'plan.aria': 'Map of the wine festival park',
      'plan.protection': 'FIRST AID',
      'plan.garderie': '🧸\nCHILDCARE',
      'plan.chateau': 'CASTLE',
      'plan.yoga': 'WINE\n&\nYOGA',
      'plan.foodtrucks': 'FOOD TRUCKS',
      'plan.bar': 'BAR',
      'plan.scene': 'STAGE',
      'plan.vip': 'VIP AREA',
      'plan.village': '🍷 WINEMAKERS VILLAGE',
      'plan.resto': '🍴 FOOD COURT',
      'plan.info': 'ℹ️ INFO POINT',
      'plan.entree': '➜ MAIN ENTRANCE',
      'plan.sortie': 'EXIT ➜',
      'plan.chargement': 'LOADING AREA',
      'plan.legendTaste': 'Stand to taste',
      'plan.legendRated': 'Rated stand ✔',
      'plan.legendAnim': 'Activities',
      'plan.legendFood': 'Food village',
      'plan.standTitle': 'Stand {stand} — {name}',

      // Real vineyard map
      'carte.aria': 'Map of the Gaillac vineyard — where the wineries really are',
      'carte.standTitle': 'Stand {stand} — {name} ({commune})',
      'carte.legendTodo': 'Winery not rated yet',
      'carte.legendRatedDot': 'Rated winery — its ❤️⭐ and average rating are shown',
      'carte.legendOwnVines': "A winery's vines, in its own colour",
      'carte.legendOtherVines': 'Vines with no winery close enough',
      'carte.legendRiver': 'River',
      'carte.legendVillage': 'Village',
      'carte.legendWood': 'Woods',
      'carte.legendWater': 'Water',
      'carte.legendTown': 'Built-up area',
      'carte.zoomHint': 'Zoom in (+ / − or double-click) to reveal every name, then drag to wander around.',
      'carte.attrNote': 'Each parcel is tied to the nearest cellar within 2 km: OpenStreetMap does not say who farms what.',
      'carte.listTitle': 'The {n} wineries',
      'carte.searchPlaceholder': 'Search a winery…',
      'carte.listEmpty': 'No winery matches.',
      'carte.focus': 'Show {name} on the map',
      'carte.fullscreen': 'Full-screen map',
      'carte.fullscreenExit': 'Leave full screen',
      'carte.zoomIn': 'Zoom in',
      'carte.zoomOut': 'Zoom out',
      'carte.zoomReset': 'See the whole map',
      'carte.scale': '{n} km',
      'carte.credits': 'Wineries: Vins de Gaillac directory · Vines, woods and rivers: © OpenStreetMap contributors',

      // Database errors
      'db.notConfigured': 'Database not configured: copy secrets/config.example.js to secrets/config.js and fill in the Turso URL and token.',
      'db.http': 'Turso error: HTTP {status}',
      'db.sql': 'SQL error: {message}',
      'db.network': 'Network unreachable — your cards are kept on this device and will be sent automatically.',
    },
  };

  let lang = localStorage.getItem(KEY);
  if (lang !== 'fr' && lang !== 'en') {
    lang = (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  }
  document.documentElement.lang = lang;

  function t(key, vars = {}) {
    let str = STRINGS[lang][key] ?? STRINGS.fr[key] ?? key;
    for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, v);
    return str;
  }

  // Ramène un texte à une clé comparable, pour toutes les recherches de
  // l'appli (liste des domaines, liste de la carte). On enlève les accents et
  // la casse, et les apostrophes — droites, courbes, celles que posent les
  // claviers de téléphone — valent une espace. Résultat : « chateau lastour »
  // trouve « Château Lastours », et « mas d aurel » comme « mas d’aurel »
  // trouvent « Mas d'Aurel ».
  function cleRecherche(s) {
    return s.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['’`\s]+/g, ' ')
      .trim();
  }

  // Traduit les textes statiques du HTML
  function apply(root = document) {
    for (const el of root.querySelectorAll('[data-i18n]')) {
      el.textContent = t(el.dataset.i18n);
    }
    for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    }
  }

  // Bouton FR ⇄ EN ; le changement de langue recharge la page
  function makeToggle() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-toggle';
    btn.textContent = lang === 'fr' ? '🇬🇧 EN' : '🇫🇷 FR';
    btn.title = lang === 'fr' ? 'Switch to English' : 'Passer en français';
    btn.addEventListener('click', () => {
      localStorage.setItem(KEY, lang === 'fr' ? 'en' : 'fr');
      window.location.reload();
    });
    return btn;
  }

  document.addEventListener('DOMContentLoaded', () => {
    apply();
    // Les pages sans header connecté reçoivent un bouton de langue flottant
    if (typeof Header === 'undefined') {
      const btn = makeToggle();
      btn.classList.add('floating');
      document.body.appendChild(btn);
    }
  });

  return { get lang() { return lang; }, t, apply, makeToggle, cleRecherche };
})();

// Raccourcis globaux
const t = I18N.t;
const cleRecherche = I18N.cleRecherche;
