#!/usr/bin/env bash
# Regenerate the plugin's small WebP derivatives from the canonical images in img/.
# The originals are never modified. Runtime files are committed under plugin/assets/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/plugin/assets"
mkdir -p "$OUT"

if command -v magick >/dev/null 2>&1; then
  IM=magick
elif command -v convert >/dev/null 2>&1; then
  IM=convert
else
  echo "build-whalestory-assets: ImageMagick (magick/convert) is required" >&2
  exit 1
fi

for name in normal attention asking writing walk_1 walk_2; do
  "$IM" "$ROOT/img/${name}.png" -trim +repage -resize x240 -quality 88 "$OUT/${name}.webp"
done
"$IM" "$ROOT/img/bubble.png" -trim +repage -resize 480x -quality 90 "$OUT/bubble.webp"

echo "Wrote WebP assets to $OUT"
