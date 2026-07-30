#!/bin/sh
# Refait icons/icon-512.png à partir de icon.svg (iOS ne prend pas de SVG pour
# l'écran d'accueil). À relancer seulement si le dessin change — les systèmes
# réduisent eux-mêmes ce PNG à la taille dont ils ont besoin.
#
#   ./icons/generer.sh
#
# Chrome sert de moteur de rendu : il capture une page où le SVG occupe
# exactement la fenêtre — d'où le petit HTML intermédiaire, un SVG servi seul
# gardant sa taille d'origine et se faisant rogner.
set -eu
cd "$(dirname "$0")/.."

CHROME=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
if [ ! -x "$CHROME" ]; then
  CHROME=$(command -v google-chrome || command -v chromium || true)
fi
if [ -z "$CHROME" ] || [ ! -x "$CHROME" ]; then
  echo "Chrome introuvable : CHROME=/chemin/vers/chrome ./icons/generer.sh" >&2
  exit 2
fi

page=$(mktemp -t maxiguide-icone).html
trap 'rm -f "$page"' EXIT
{
  echo '<!DOCTYPE html><meta charset="utf-8">'
  # le SVG occupe exactement la fenêtre (100vw/100vh) : c'est la taille de la
  # fenêtre de Chrome qui décide de la taille du PNG.
  echo '<style>html,body{margin:0;padding:0;overflow:hidden}'
  echo 'svg{display:block;width:100vw;height:100vh}</style>'
  sed '1,/-->/d' icon.svg
} > "$page"

# 512 px et pas moins : en dessous, Chrome impose une largeur de fenêtre
# minimale et la capture serait rognée.
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=512,512 \
  --screenshot=icons/icon-512.png "file://$page" 2>/dev/null
echo icons/icon-512.png
