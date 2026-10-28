#!/usr/bin/env bash
# Rebuilds fonts/material-symbols.woff2: a subset containing only the icons referenced in the source.
set -euo pipefail
cd "$(dirname "$0")/.."
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
curl -sf -m 30 "https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsRounded%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints" -o /tmp/ms.codepoints
names=$(grep -ohE "['\"\`>]([a-z][a-z0-9_]{1,40})['\"\`<]" index.html js/*.js js/apps/*.js | tr -d "'\"\`<>" | sort -u | \
  awk 'NR==FNR{ok[$1]=1;next} ($1 in ok)' <(cut -d' ' -f1 /tmp/ms.codepoints) - | sort -u | paste -sd, -)
echo "icons: $(echo $names | tr ',' '\n' | wc -l)"
css=$(curl -sf -m 30 -A "$UA" "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=${names}")
url=$(echo "$css" | grep -o 'https://[^)]*' | head -1)
curl -sf -m 60 "$url" -o fonts/material-symbols.woff2
ls -la fonts/material-symbols.woff2
sed -i '/Material Symbols Rounded/d' css/fonts.css
echo "@font-face{font-family:'Material Symbols Rounded';font-weight:400;font-style:normal;src:url(../fonts/material-symbols.woff2) format('woff2');font-display:block}" >> css/fonts.css
