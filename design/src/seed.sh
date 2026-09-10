#!/usr/bin/env zsh
# Seeds design/canvas/convexa-desk-redesign.html (the self-contained Claude Design canvas) from the
# built artboards. Needs the Claude Design helper that ships with the /design skill:
#   DESIGN_HELPER=/path/to/folder-with-seed-canvas.mjs zsh design/src/seed.sh
# Then republish the file to the artifact URL from a Claude Code session (same URL keeps the link).
set -e
HERE=${0:A:h}
CANVAS=$HERE/../canvas
: ${DESIGN_HELPER:?set DESIGN_HELPER to the folder holding seed-canvas.mjs and payload.template.html}
cd "$CANVAS"
ARR=()
for f in *.dc.html; do ARR+=(--artboard "$f"); done
node "$DESIGN_HELPER/seed-canvas.mjs" --template "$DESIGN_HELPER/payload.template.html" --out convexa-desk-redesign.html --title "Convexa Desk Redesign" "${ARR[@]}" --canvas canvas.json
node "$DESIGN_HELPER/seed-canvas.mjs" --check convexa-desk-redesign.html
