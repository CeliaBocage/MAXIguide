#!/bin/sh
# Lance les tests sans ouvrir de fenêtre : Chrome en mode headless charge
# tests/index.html, et on lit le résultat dans la page.
#
#   ./tests/run.sh          → « ✅ 62/62 tests au vert », et le code de sortie va
#                             avec (0 tout vert, 1 au moins un échec).
#   CHROME=/chemin/chrome ./tests/run.sh   pour imposer un navigateur.
#
# (Ouvrir tests/index.html à la main marche toujours aussi bien — c'est la même
# page, avec les échecs en rouge.)
set -eu
cd "$(dirname "$0")/.."

if [ -z "${CHROME:-}" ]; then
  for candidat in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$(command -v google-chrome || true)" \
    "$(command -v chromium || true)"
  do
    if [ -n "$candidat" ] && [ -x "$candidat" ]; then CHROME=$candidat; break; fi
  done
fi

if [ -z "${CHROME:-}" ]; then
  echo "Chrome introuvable. Ouvrez tests/index.html dans un navigateur," >&2
  echo "ou indiquez le binaire : CHROME=/chemin/vers/chrome ./tests/run.sh" >&2
  exit 2
fi

dom=$(mktemp)
trap 'rm -f "$dom"' EXIT

# --virtual-time-budget laisse le temps aux tests asynchrones de finir avant le
# --dump-dom ; --allow-file-access-from-files est nécessaire en file://.
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --virtual-time-budget=20000 --allow-file-access-from-files \
  --dump-dom "file://$PWD/tests/index.html" 2>/dev/null > "$dom"

# Les échecs en clair : « ❌ nom du test → ce qui n'allait pas »
grep -o '<li class="test-fail">[^<]*<span class="detail">[^<]*' "$dom" \
  | sed -e 's|<li class="test-fail">|❌ |' -e 's|<span class="detail">| → |' >&2 || true

resume=$(grep -o 'id="summary">[^<]*' "$dom" | sed 's|.*>||' || true)
if [ -z "$resume" ]; then
  resume="aucun résultat : la page de tests semble bloquée"
fi
echo "$resume"

case "$resume" in
  *✅*) exit 0 ;;
  *) exit 1 ;;
esac
