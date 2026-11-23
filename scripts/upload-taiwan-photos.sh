#!/usr/bin/env bash
# Resize, strip metadata (including GPS location), and upload photos to the
# private R2 bucket used by /taiwan2026.
#
# Usage:  scripts/upload-taiwan-photos.sh /path/to/photo-folder
# Needs:  ImageMagick (`brew install imagemagick`) and `npx wrangler login` done once.
#
# Files are uploaded in alphabetical order of their names, which is the order
# they appear in the scrapbook (rename them 001-..., 002-... to control order).
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

if [ -f "$SRC/captions.json" ]; then
  echo "  uploading captions.json"
  npx wrangler r2 object put "$BUCKET/photos/captions.json" --file "$SRC/captions.json" \
    --content-type application/json --remote >/dev/null
fi

echo "Done. Uploaded ${#files[@]} photos to $BUCKET."
