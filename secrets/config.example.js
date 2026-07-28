// Copier ce fichier en secrets/config.js et remplir avec les infos de votre base Turso :
//   turso db show <nom-de-la-base> --url        → URL (remplacer libsql:// par https://)
//   turso db tokens create <nom-de-la-base>     → token (idéalement avec --expiration)
// secrets/config.js est gitignoré : il ne sera jamais poussé sur GitHub.
const TURSO = {
  url: 'libsql://lemaxiguide-celiabocage.aws-eu-west-1.turso.io',
  token: 'REMPLACER',
};