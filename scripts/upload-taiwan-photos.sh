#!/usr/bin/env bash
# Resize, strip metadata (including GPS location), and upload photos to the
# private R2 bucket used by /taiwan2026.
#
# Usage:  scripts/upload-taiwan-photos.sh /path/to/photo-folder
# Needs:  ImageMagick (`brew install imagemagick`) and `npx wrangler login` done once.
#
# Put story.json (see scripts/story.example.json) in the same folder to group
# photos into chapters with narrative text. Photo names in story.json must
# match the uploaded names: lowercase, spaces -> dashes, ending in .jpg.
#
# To update just the story text without re-uploading photos:
#   npx wrangler r2 object put taiwan2026-photos/photos/story.json \
#     --file story.json --content-type application/json --remote
set -euo pipefail

SRC="${1:?Usage: $0 /path/to/photo-folder}"
BUCKET="taiwan2026-photos"
MAX_SIZE=2000   # longest edge in pixels
QUALITY=82

if command -v magick >/dev/null 2>&1; then IM=(magick)
elif command -v convert >/dev/null 2>&1; then IM=(convert)
else echo "ImageMagick not found. Install it (e.g. brew install imagemagick)." >&2; exit 1
fi

OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

shopt -s nullglob nocaseglob
files=("$SRC"/*.{jpg,jpeg,png,heic,heif,webp})
shopt -u nocaseglob
[ ${#files[@]} -gt 0 ] || { echo "No photos found in $SRC" >&2; exit 1; }

echo "Processing ${#files[@]} photos..."
for f in "${files[@]}"; do
  base="$(basename "${f%.*}")"
  # Safe file name: lowercase, spaces -> dashes, drop odd characters.
  safe="$(echo "$base" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9._-')"
  dest="$OUT/$safe.jpg"
  "${IM[@]}" "$f" -auto-orient -strip -resize "${MAX_SIZE}x${MAX_SIZE}>" \
    -quality "$QUALITY" -interlace JPEG "$dest"
  echo "  uploading $safe.jpg"
  npx wrangler r2 object put "$BUCKET/photos/$safe.jpg" --file "$dest" \
    --content-type image/jpeg --remote >/dev/null
done

for json in story.json captions.json; do
  if [ -f "$SRC/$json" ]; then
    echo "  uploading $json"
    npx wrangler r2 object put "$BUCKET/photos/$json" --file "$SRC/$json" \
      --content-type application/json --remote >/dev/null
  fi
done

echo "Done. Uploaded ${#files[@]} photos to $BUCKET."
