// Carte réelle du vignoble gaillacois — où se trouvent vraiment les domaines.
// (Le plan du parc de la fête, lui, vit dans js/data/plan.js.)
//
// Sources :
//  - domaines : coordonnées publiées par l'annuaire des Vins de Gaillac
//    (vins-gaillac.com/nos-vignerons/annuaire-du-vignoble), complétées pour
//    Cazottes, Clos Mazetou et Castan par leur adresse géocodée via la Base
//    Adresse Nationale (api-adresse.data.gouv.fr) — source notée sur chaque ligne ;
//  - rivières et villages : OpenStreetMap (© contributeurs OSM, ODbL),
//    tracés simplifiés (Douglas-Peucker, ~70 m) pour rester légers hors-ligne.
//
// Tout est en degrés [longitude, latitude] : la projection en pixels se fait
// au rendu, dans js/carte.js.

// Cadre géographique de la carte
const CARTE_BOUNDS = { minLon: 1.68, maxLon: 2.1, minLat: 43.752, maxLat: 44.085 };

// Où se trouve vraiment chaque domaine : { id: { lat, lon, commune, src } }
const CARTE_DOMAINES = {
  'vayssette': { lat: 43.943264, lon: 1.88884, commune: 'Gaillac', src: 'annuaire' },
  'rotier': { lat: 43.873491, lon: 1.984389, commune: 'Cadalen', src: 'annuaire' },
  'cazottes': { lat: 43.999891, lon: 2.022916, commune: 'Villeneuve-sur-Vère', src: 'ban' },
  'croix-des-marchands': { lat: 43.860639, lon: 1.8854, commune: 'Montans', src: 'annuaire' },
  'sarrabelle': { lat: 43.886218, lon: 1.810417, commune: 'Lisle-sur-Tarn', src: 'annuaire' },
  'long-pech': { lat: 43.894585, lon: 1.752641, commune: 'Lisle-sur-Tarn', src: 'annuaire' },
  'clos-mazetou': { lat: 43.995929, lon: 2.026292, commune: 'Villeneuve-sur-Vère', src: 'ban' },
  'lastours': { lat: 43.871408, lon: 1.846957, commune: 'Lisle-sur-Tarn', src: 'annuaire' },
  'lamothe': { lat: 44.004189, lon: 1.814899, commune: 'Sainte-Cécile-du-Cayrou', src: 'annuaire' },
  'comte-de-thun': { lat: 44.027682, lon: 1.929123, commune: 'Frausseilles', src: 'annuaire' },
  'vergnades': { lat: 43.860113, lon: 1.960748, commune: 'Cadalen', src: 'annuaire' },
  'maison-labastide': { lat: 43.931009, lon: 2.016453, commune: 'Labastide-de-Lévis', src: 'annuaire' },
  'calmet': { lat: 43.88685, lon: 1.971742, commune: 'Lagrave', src: 'annuaire' },
  'cantalauze': { lat: 44.013832, lon: 1.913545, commune: 'Cahuzac-sur-Vère', src: 'annuaire' },
  'bouscaillous': { lat: 44.010148, lon: 1.982327, commune: 'Noailles', src: 'annuaire' },
  'brin': { lat: 43.983748, lon: 2.025117, commune: 'Castanet', src: 'annuaire' },
  'les-vignals': { lat: 43.961242, lon: 2.010118, commune: 'Cestayrols', src: 'annuaire' },
  'brousse': { lat: 43.991286, lon: 1.887748, commune: 'Cahuzac-sur-Vère', src: 'annuaire' },
  'labastidie': { lat: 43.895882, lon: 2.051032, commune: 'Florentin', src: 'annuaire' },
  'lacroux': { lat: 43.966126, lon: 1.995797, commune: 'Cestayrols', src: 'annuaire' },
  'mayragues': { lat: 43.976619, lon: 1.850822, commune: 'Castelnau-de-Montmiral', src: 'annuaire' },
  'barreau': { lat: 43.934402, lon: 1.917758, commune: 'Gaillac', src: 'annuaire' },
  'trois-tetus': { lat: 43.996937, lon: 1.917923, commune: 'Cahuzac-sur-Vère', src: 'annuaire' },
  'escabes': { lat: 43.881939, lon: 1.784861, commune: 'Lisle-sur-Tarn', src: 'annuaire' },
  'clement-termes': { lat: 43.886438, lon: 1.812558, commune: 'Lisle-sur-Tarn', src: 'annuaire' },
  'mas-daurel': { lat: 44.012586, lon: 1.943314, commune: 'Donnazac', src: 'annuaire' },
  'balsamine': { lat: 43.923103, lon: 1.883529, commune: 'Gaillac', src: 'annuaire' },
  'in-ventis': { lat: 43.849695, lon: 1.726984, commune: 'Rabastens', src: 'annuaire' },
  'borie-vieille': { lat: 43.883918, lon: 1.805009, commune: 'Lisle-sur-Tarn', src: 'annuaire' },
  'rhodes': { lat: 43.935141, lon: 1.916463, commune: 'Gaillac', src: 'annuaire' },
  'al-couderc': { lat: 43.93192, lon: 2.006645, commune: 'Labastide-de-Lévis', src: 'annuaire' },
  'les-grezels': { lat: 43.92927, lon: 1.889728, commune: 'Gaillac', src: 'annuaire' },
  'castan': { lat: 44.01193, lon: 2.03146, commune: 'Villeneuve-sur-Vère', src: 'ban' },
  'rene-rieux': { lat: 43.94001, lon: 1.914797, commune: 'Gaillac', src: 'annuaire' },
  'enclos-des-songes': { lat: 43.775608, lon: 1.716126, commune: 'Coufouleux', src: 'annuaire' },
  'philemon': { lat: 44.004021, lon: 2.016103, commune: 'Villeneuve-sur-Vère', src: 'annuaire' },
  'carcenac': { lat: 43.853476, lon: 1.872432, commune: 'Montans', src: 'annuaire' },
  'vignobles-gayrel': { lat: 43.908131, lon: 1.899585, commune: 'Gaillac', src: 'annuaire' },
  'petits-jardins': { lat: 43.946013, lon: 1.863434, commune: 'Gaillac', src: 'annuaire' },
  'puech-roques': { lat: 43.959429, lon: 1.893169, commune: 'Montels', src: 'annuaire' },
  'saurs': { lat: 43.898684, lon: 1.836952, commune: 'Lisle-sur-Tarn', src: 'annuaire' },
  'mas-pignou': { lat: 43.953047, lon: 1.871572, commune: 'Gaillac', src: 'annuaire' },
  'romeli': { lat: 43.959371, lon: 1.973028, commune: 'Fayssac', src: 'annuaire' },
  'salvy': { lat: 43.983307, lon: 1.91124, commune: 'Cahuzac-sur-Vère', src: 'annuaire' },
  'canto-perlic': { lat: 43.917846, lon: 1.846098, commune: 'Gaillac', src: 'annuaire' },
  'moulin': { lat: 43.928959, lon: 1.908994, commune: 'Gaillac', src: 'annuaire' },
  'petite-tuile': { lat: 43.931329, lon: 1.879387, commune: 'Gaillac', src: 'annuaire' },
  'larroque': { lat: 43.979616, lon: 2.018955, commune: 'Cestayrols', src: 'annuaire' },
  'balaran': { lat: 43.971093, lon: 2.057397, commune: 'Sainte-Croix', src: 'annuaire' },
  'labarthe': { lat: 43.983841, lon: 2.02112, commune: 'Castanet', src: 'annuaire' },
  'terroir-de-lagrave': { lat: 43.889633, lon: 1.971245, commune: 'Lagrave', src: 'annuaire' },
};

// Cours d'eau (le Tarn et la Vère structurent tout le vignoble)
const CARTE_RIVERS = [
  { name: 'Cérou', main: false, pts: [[1.90167,44.10482],[1.899,44.10297],[1.89398,44.10429],[1.89036,44.10363],[1.88868,44.10143],[1.88997,44.09874],[1.88896,44.09672],[1.89336,44.09218],[1.89166,44.09038],[1.89438,44.08873],[1.89317,44.08443],[1.89493,44.07971],[1.90215,44.07802],[1.9031,44.07703],[1.90193,44.07191],[1.90751,44.06975],[1.91281,44.07048],[1.9185,44.0694],[1.92102,44.07163],[1.92515,44.07268],[1.9339,44.07125],[1.94051,44.06826],[1.94316,44.07051],[1.94228,44.07162],[1.94397,44.07133],[1.94468,44.07276],[1.94696,44.07202],[1.94803,44.06802],[1.95206,44.06714],[1.9553,44.06829],[1.95685,44.07109],[1.96196,44.07071],[1.96245,44.06875],[1.9722,44.06933],[1.97741,44.07053],[1.97803,44.0732],[1.98147,44.07785],[1.98894,44.07951],[2.00144,44.07765],[2.00298,44.07298],[2.00628,44.0721],[2.00991,44.0739],[2.01078,44.07545],[2.01007,44.0783],[2.01503,44.08109],[2.01817,44.07974],[2.01722,44.07789],[2.019,44.07562],[2.02589,44.0778],[2.02893,44.07348],[2.03994,44.07374],[2.04081,44.06992],[2.04342,44.06733],[2.0514,44.07187],[2.05913,44.07068],[2.06549,44.07649],[2.06699,44.07624],[2.06817,44.07369],[2.07111,44.07163],[2.07357,44.0732],[2.07638,44.07257],[2.07974,44.07344],[2.08317,44.07722],[2.08573,44.07683],[2.08746,44.07459],[2.08878,44.07564],[2.08811,44.07703],[2.09116,44.07684],[2.09462,44.07202],[2.09475,44.06937],[2.09867,44.07027],[2.10005,44.07314],[2.10202,44.07385],[2.10386,44.07281],[2.10244,44.06918],[2.10387,44.06728],[2.11541,44.07075],[2.11987,44.06921]] },
  { name: 'Tarn', main: true, pts: [[1.66992,43.78423],[1.68519,43.78633],[1.69005,43.78979],[1.69794,43.80164],[1.70377,43.80701],[1.71705,43.81225],[1.72309,43.81668],[1.73107,43.82507],[1.73478,43.82721],[1.73698,43.82768],[1.74407,43.82457],[1.75165,43.82599],[1.75504,43.83286],[1.76236,43.83831],[1.76796,43.8376],[1.77169,43.832],[1.77888,43.83122],[1.7935,43.83655],[1.80692,43.83745],[1.81929,43.84186],[1.82038,43.84406],[1.81335,43.84883],[1.81329,43.85458],[1.81669,43.8595],[1.83201,43.86821],[1.84597,43.87014],[1.8544,43.87498],[1.8588,43.87576],[1.86806,43.86962],[1.87932,43.86645],[1.88258,43.86698],[1.88444,43.86903],[1.88674,43.88002],[1.88317,43.88908],[1.8912,43.89794],[1.89469,43.89734],[1.89688,43.8928],[1.89889,43.89118],[1.90333,43.88976],[1.90818,43.89021],[1.92025,43.89874],[1.9239,43.90244],[1.92671,43.90779],[1.93901,43.91143],[1.94826,43.91547],[1.95324,43.91632],[1.95608,43.9147],[1.9634,43.90529],[1.98084,43.89713],[1.98453,43.89661],[1.98618,43.89839],[1.9855,43.90529],[1.989,43.90916],[1.99463,43.9088],[2.00349,43.90544],[2.00647,43.90549],[2.02086,43.91824],[2.02886,43.9203],[2.03954,43.92107],[2.06097,43.93125],[2.07294,43.93],[2.08121,43.93287],[2.0858,43.92869],[2.09102,43.92763],[2.09303,43.92903],[2.09447,43.93371],[2.09642,43.93605],[2.09952,43.93709],[2.11351,43.93715],[2.115,43.9386],[2.11403,43.94299],[2.11753,43.94349]] },
  { name: 'Dadou', main: false, pts: [[1.89363,43.75072],[1.89816,43.75228],[1.89967,43.74934],[1.90195,43.74964],[1.90523,43.75176],[1.90786,43.75635],[1.90628,43.75861],[1.91007,43.75915],[1.9155,43.76413],[1.92084,43.76244],[1.92195,43.76014],[1.92555,43.75886],[1.9323,43.75976],[1.93368,43.76147],[1.93168,43.76275],[1.93483,43.76366],[1.93615,43.7627],[1.93615,43.76037],[1.93954,43.75914],[1.94128,43.7609],[1.94101,43.76508],[1.93741,43.76561],[1.93589,43.76685],[1.93605,43.76829],[1.93973,43.769],[1.9457,43.76796],[1.94999,43.76995],[1.95262,43.76845],[1.9542,43.7697],[1.95817,43.76964],[1.96033,43.77346],[1.96444,43.7711],[1.96489,43.76926],[1.96718,43.76863],[1.97464,43.77252],[1.97592,43.77081],[1.97817,43.77084],[1.97983,43.77236],[1.98365,43.77268],[1.98945,43.77568],[1.99233,43.77535],[1.99738,43.77298],[1.9985,43.77092],[1.99745,43.76938],[1.99461,43.76901],[1.98954,43.76385],[1.99479,43.76122],[2.00599,43.76277],[2.00888,43.7642],[2.01295,43.76254],[2.01571,43.76455],[2.0223,43.7623],[2.03417,43.76335],[2.03851,43.76245],[2.04305,43.76402],[2.04798,43.76387],[2.0545,43.76695],[2.05592,43.76493],[2.05858,43.76513],[2.06369,43.77057],[2.07284,43.77134],[2.07587,43.77328],[2.07936,43.77377],[2.083,43.77557],[2.08382,43.77839],[2.08721,43.77762],[2.09476,43.77894],[2.10558,43.77486],[2.11962,43.78066]] },
  { name: 'Vère', main: true, pts: [[1.66946,44.01612],[1.67274,44.01436],[1.6777,44.01376],[1.68093,44.00142],[1.68422,44.00062],[1.68933,44.00259],[1.69239,44.00202],[1.69818,43.99344],[1.7017,43.99031],[1.70519,43.98921],[1.71587,43.97905],[1.72168,43.97789],[1.7243,43.97624],[1.72714,43.97338],[1.7297,43.96554],[1.73439,43.96379],[1.75057,43.96879],[1.75942,43.96656],[1.77276,43.96771],[1.77748,43.96656],[1.78519,43.96921],[1.79644,43.97552],[1.81142,43.97713],[1.81577,43.97899],[1.8209,43.98346],[1.82375,43.98321],[1.82844,43.98481],[1.83751,43.98316],[1.84677,43.98321],[1.85988,43.98892],[1.87737,43.99162],[1.90092,43.98487],[1.90475,43.98436],[1.91083,43.98546],[1.91391,43.9824],[1.91993,43.98193],[1.92599,43.97966],[1.92939,43.98459],[1.93923,43.98721],[1.94497,43.9871],[1.96117,43.99106],[1.96752,43.98816],[1.96957,43.98872],[1.9702,43.98965],[1.96892,43.99306],[1.96982,43.99493],[1.97515,43.99506],[1.97482,43.99804],[1.97635,44.00092],[1.98106,44.00257],[1.987,44.00878],[1.99181,44.00977],[1.99568,44.00887],[2.00211,44.00949],[2.0076,44.00808],[2.01271,44.00949],[2.01761,44.00722],[2.03134,44.00681],[2.03584,44.00517],[2.03778,44.00594],[2.04975,44.00087],[2.06079,43.99858],[2.06677,43.99538],[2.07747,43.99514],[2.08427,43.99645]] },
  { name: 'Agoût', main: false, pts: [[1.68258,43.78539],[1.68352,43.78365],[1.68273,43.77906],[1.68659,43.7767],[1.70026,43.77612],[1.7112,43.771],[1.72114,43.77192],[1.7393,43.77138],[1.77108,43.76409],[1.77238,43.76243],[1.77209,43.76057],[1.76627,43.75705],[1.76367,43.75303],[1.76407,43.75049],[1.76748,43.7476]] },
  { name: 'Dadou', main: false, pts: [[1.85299,43.74954],[1.86275,43.75276],[1.8697,43.75084],[1.87119,43.74839],[1.87317,43.74779],[1.881,43.74955],[1.88569,43.74892]] },
  { name: 'Tescou', main: false, pts: [[1.66059,43.91722],[1.68206,43.91639],[1.68978,43.91743],[1.70773,43.91346],[1.71812,43.91412],[1.73379,43.90955],[1.75022,43.91017]] },
];

// Villages et villes repères (rank 2 = ville, 1 = village)
const CARTE_PLACES = [
  { name: 'Cordes-sur-Ciel', lon: 1.95799, lat: 44.0626, rank: 2 },
  { name: 'Gaillac', lon: 1.89679, lat: 43.90168, rank: 2 },
  { name: 'Lisle-sur-Tarn', lon: 1.81007, lat: 43.85266, rank: 2 },
  { name: 'Rabastens', lon: 1.72404, lat: 43.82124, rank: 2 },
  { name: 'Andillac', lon: 1.89109, lat: 43.99909, rank: 1 },
  { name: 'Bernac', lon: 2.01924, lat: 43.959, rank: 1 },
  { name: 'Broze', lon: 1.89157, lat: 43.9532, rank: 1 },
  { name: 'Cadalen', lon: 1.98152, lat: 43.85, rank: 1 },
  { name: 'Cahuzac-sur-Vère', lon: 1.91227, lat: 43.9831, rank: 1 },
  { name: 'Campagnac', lon: 1.84449, lat: 44.0305, rank: 1 },
  { name: 'Castanet', lon: 2.02887, lat: 43.9743, rank: 1 },
  { name: 'Castelnau-de-Montmiral', lon: 1.8204, lat: 43.96552, rank: 1 },
  { name: 'Cestayrols', lon: 1.98484, lat: 43.98062, rank: 1 },
  { name: 'Coufouleux', lon: 1.73069, lat: 43.81759, rank: 1 },
  { name: 'Donnazac', lon: 1.94436, lat: 44.0147, rank: 1 },
  { name: 'Fayssac', lon: 1.9713, lat: 43.9552, rank: 1 },
  { name: 'Florentin', lon: 2.03316, lat: 43.887, rank: 1 },
  { name: 'Frausseilles', lon: 1.92844, lat: 44.0279, rank: 1 },
  { name: 'Labastide-de-Lévis', lon: 2.0128, lat: 43.9271, rank: 1 },
  { name: 'Lagrave', lon: 1.99364, lat: 43.8974, rank: 1 },
  { name: 'Milhavet', lon: 2.02689, lat: 44.0292, rank: 1 },
  { name: 'Montans', lon: 1.88487, lat: 43.8654, rank: 1 },
  { name: 'Montels', lon: 1.89235, lat: 43.9624, rank: 1 },
  { name: 'Noailles', lon: 1.98304, lat: 44.00968, rank: 1 },
  { name: 'Puycelsi', lon: 1.71021, lat: 43.9933, rank: 1 },
  { name: 'Sainte-Croix', lon: 2.06786, lat: 43.97223, rank: 1 },
  { name: 'Sainte-Cécile-du-Cayrou', lon: 1.80883, lat: 44.00372, rank: 1 },
  { name: 'Souel', lon: 1.95586, lat: 44.03032, rank: 1 },
  { name: 'Técou', lon: 1.94897, lat: 43.8433, rank: 1 },
  { name: 'Villeneuve-sur-Vère', lon: 2.02882, lat: 44.00226, rank: 1 },
  { name: 'Vindrac-Alayrac', lon: 1.914, lat: 44.0647, rank: 1 },
];
