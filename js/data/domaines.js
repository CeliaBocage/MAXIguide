// Les 51 producteurs de la fête des vins de Gaillac 2026 (source : fete-vins-gaillac.com).
// type : 'vin' (blancs/rouges/rosés), 'whisky' (distillerie), 'mixte' (les deux).
// Tous proposent aussi le jus de raisin pour les softs !
const DOMAINES = [
  { id: 'vayssette', stand: '2', name: 'Domaine Vayssette', type: 'vin' },
  { id: 'rotier', stand: '3', name: 'Domaine Rotier', type: 'vin' },
  { id: 'cazottes', stand: '4', name: 'Distillerie & Domaine Cazottes', type: 'mixte' },
  { id: 'croix-des-marchands', stand: '5', name: 'La Croix des Marchands / Château Palvié', type: 'vin' },
  { id: 'sarrabelle', stand: '6', name: 'Domaine Sarrabelle', type: 'vin' },
  { id: 'long-pech', stand: '7', name: 'Domaine de Long Pech', type: 'vin' },
  { id: 'clos-mazetou', stand: '8', name: 'Clos Mazetou', type: 'vin' },
  { id: 'lastours', stand: '9', name: 'Château Lastours', type: 'vin' },
  { id: 'lamothe', stand: '10', name: 'Domaine de Lamothe', type: 'vin' },
  { id: 'comte-de-thun', stand: '11', name: 'Domaine du Comte de Thun', type: 'vin' },
  { id: 'vergnades', stand: '12', name: 'Domaine des Vergnades', type: 'vin' },
  { id: 'maison-labastide', stand: '13', name: 'Vinovalie — Maison Labastide', type: 'vin' },
  { id: 'calmet', stand: '14', name: 'Domaine Calmet', type: 'vin' },
  { id: 'cantalauze', stand: '15', name: 'Domaine de Cantalauze', type: 'vin' },
  { id: 'bouscaillous', stand: '15bis', name: 'Château Bouscaillous', type: 'vin' },
  { id: 'brin', stand: '16', name: 'Domaine de Brin', type: 'vin' },
  { id: 'les-vignals', stand: '17', name: 'Château Les Vignals', type: 'vin' },
  { id: 'brousse', stand: '18', name: 'Domaine de Brousse', type: 'vin' },
  { id: 'labastidie', stand: '19', name: 'Château Labastidié', type: 'vin' },
  { id: 'lacroux', stand: '20', name: 'Château Lacroux', type: 'vin' },
  { id: 'mayragues', stand: '21', name: 'Château Mayragues', type: 'vin' },
  { id: 'barreau', stand: '22', name: 'Domaine Barreau', type: 'vin' },
  { id: 'trois-tetus', stand: '23', name: 'Domaine des Trois Têtus', type: 'vin' },
  { id: 'escabes', stand: '24', name: "Château d'Escabes", type: 'vin' },
  { id: 'clement-termes', stand: '25', name: 'Château Clément Termes', type: 'vin' },
  { id: 'mas-daurel', stand: '26', name: "Mas d'Aurel", type: 'vin' },
  { id: 'balsamine', stand: '27', name: 'Château Balsamine', type: 'vin' },
  { id: 'in-ventis', stand: '28', name: 'Domaine In Ventis', type: 'vin' },
  { id: 'borie-vieille', stand: '36', name: 'Domaine Borie-Vieille', type: 'vin' },
  { id: 'rhodes', stand: '37', name: 'Château de Rhodes', type: 'vin' },
  { id: 'al-couderc', stand: '38', name: 'Domaine Al Couderc', type: 'vin' },
  { id: 'les-grezels', stand: '39', name: 'Domaine Les Grezels', type: 'vin' },
  { id: 'castan', stand: '40', name: 'Distillerie Castan', type: 'whisky' },
  { id: 'rene-rieux', stand: '41', name: 'Domaine René Rieux', type: 'vin' },
  { id: 'enclos-des-songes', stand: '42', name: "L'Enclos des Songes", type: 'vin' },
  { id: 'philemon', stand: '43', name: 'Domaine Philémon', type: 'vin' },
  { id: 'carcenac', stand: '44', name: 'Domaine Carcenac', type: 'vin' },
  { id: 'vignobles-gayrel', stand: '46', name: 'Les Vignobles Gayrel', type: 'vin' },
  { id: 'petits-jardins', stand: '47', name: 'Domaine Les Petits Jardins', type: 'vin' },
  { id: 'puech-roques', stand: '48', name: 'Domaine Puech Roques', type: 'vin' },
  { id: 'saurs', stand: '49', name: 'Château de Saurs', type: 'vin' },
  { id: 'mas-pignou', stand: '50', name: 'Mas Pignou', type: 'vin' },
  { id: 'romeli', stand: '52', name: 'Domaine Roméli', type: 'vin' },
  { id: 'salvy', stand: '53', name: 'Domaine Salvy', type: 'vin' },
  { id: 'canto-perlic', stand: '54', name: 'Domaine de Canto Perlic', type: 'vin' },
  { id: 'moulin', stand: '55', name: 'Domaine du Moulin', type: 'vin' },
  { id: 'petite-tuile', stand: '56', name: 'Domaine de la Petite Tuile', type: 'vin' },
  { id: 'larroque', stand: '57', name: 'Domaine de Larroque', type: 'vin' },
  { id: 'balaran', stand: '58', name: 'Famille Balaran', type: 'vin' },
  { id: 'labarthe', stand: '59', name: 'Domaine de Labarthe', type: 'vin' },
  { id: 'terroir-de-lagrave', stand: '60', name: 'Terroir de Lagrave', type: 'vin' },
];

// Ce qu'on peut noter dans chaque fiche, selon le type du domaine.
// color : teinte du liquide dans la bouteille-jauge de la page notation.
// Les libellés viennent du dictionnaire i18n (js/i18n.js, chargé avant ce fichier).
const BOISSONS = {
  blanc:  { key: 'note_blanc',  label: t('boisson.blanc'),  color: '#e9c46a' },
  rouge:  { key: 'note_rouge',  label: t('boisson.rouge'),  color: '#7b1e2b' },
  rose:   { key: 'note_rose',   label: t('boisson.rose'),   color: '#f2a0b2' },
  whisky: { key: 'note_whisky', label: t('boisson.whisky'), color: '#c67c2e' },
  jus:    { key: 'note_jus',    label: t('boisson.jus'),    color: '#6d3a7c' },
};

const TYPE_BOISSONS = {
  vin: ['blanc', 'rouge', 'rose', 'jus'],
  whisky: ['whisky', 'jus'],
  mixte: ['blanc', 'rouge', 'rose', 'whisky', 'jus'],
};

function getBoissons(domaine) {
  return TYPE_BOISSONS[domaine.type].map(k => BOISSONS[k]);
}

function getDomaine(id) {
  return DOMAINES.find(d => d.id === id) || null;
}

function getDomaineByStand(stand) {
  return DOMAINES.find(d => d.stand === stand) || null;
}
