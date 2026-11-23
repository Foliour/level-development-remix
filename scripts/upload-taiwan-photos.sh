#!/usr/bin/env bash
# Resize, strip metadata (including GPS location), and upload photos to the
# private R2 bucket used by /taiwan2026.
#
# Usage:  scripts/upload-taiwan-photos.sh /path/to/photo-folder
# Needs:  macOS (uses the built-in `sips`) and Python 3 with Pillow, or
#         ImageMagick on other systems. Run `npx wrangler login` once.
#
# Set WRANGLER_TARGET=--local to load photos into the local dev bucket used by
# `wrangler dev` instead of the real one (handy for previewing).
#
# Put story.json (see scripts/story.example.json) in the same folder to group
# photos into chapters with narrative text. Photo names in story.json must
# match the uploaded names: lowercase, spaces -> dashes, ending in .jpg.
#
# To update just the story text without re-uploading photos:
#   npx wrangler r2 object put taiwan2026-photos/photos/story.json \
#     --file story.json --content-type application/json
set -euo pipefail

SRC="${1:?Usage: $0 /path/to/photo-folder}"
BUCKET="taiwan2026-photos"
# Wrangler 3 writes to the real bucket by default; --local targets `wrangler dev`.
TARGET=(${WRANGLER_TARGET:-})
WHERE="${WRANGLER_TARGET:-cloudflare}"
MAX_SIZE=2000   # longest edge in pixels
QUALITY=82

if command -v sips >/dev/null 2>&1 && python3 -c "import PIL" 2>/dev/null; then
  MODE=sips
elif command -v magick >/dev/null 2>&1; then MODE=magick
elif command -v convert >/dev/null 2>&1; then MODE=convert
else
  echo "Need macOS sips + Python Pillow, or ImageMagick." >&2; exit 1
fi

# Rotates upright, then re-saves with no EXIF/XMP (so no GPS location).
STRIP_PY='
import sys
from PIL import Image, ImageOps
src, dst, q = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
im.save(dst, "JPEG", quality=q, progressive=True, optimize=True,
        icc_profile=im.info.get("icc_profile"))
'

OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

shopt -s nullglob nocaseglob
files=("$SRC"/*.{jpg,jpeg,png,heic,heif,webp})
shopt -u nocaseglob
[ ${#files[@]} -gt 0 ] || { echo "No photos found in $SRC" >&2; exit 1; }

echo "Processing ${#files[@]} photos ($WHERE)..."
for f in "${files[@]}"; do
  base="$(basename "${f%.*}")"
  # Safe file name: lowercase, spaces -> dashes, drop odd characters.
  safe="$(echo "$base" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9._-')"
  dest="$OUT/$safe.jpg"
  if [ "$MODE" = sips ]; then
    sips -s format jpeg -Z "$MAX_SIZE" "$f" --out "$OUT/tmp.jpg" >/dev/null
    python3 -I -c "$STRIP_PY" "$OUT/tmp.jpg" "$dest" "$QUALITY"
  else
    "$MODE" "$f" -auto-orient -strip -resize "${MAX_SIZE}x${MAX_SIZE}>" \
      -quality "$QUALITY" -interlace JPEG "$dest"
  fi
  echo "  uploading $safe.jpg"
  npx wrangler r2 object put "$BUCKET/photos/$safe.jpg" --file "$dest" \
    --content-type image/jpeg ${TARGET[@]+"${TARGET[@]}"} >/dev/null
done

for json in story.json captions.json; do
  if [ -f "$SRC/$json" ]; then
    echo "  uploading $json"
    npx wrangler r2 object put "$BUCKET/photos/$json" --file "$SRC/$json" \
      --content-type application/json ${TARGET[@]+"${TARGET[@]}"} >/dev/null
  fi
done

echo "Done. Uploaded ${#files[@]} photos to $BUCKET ($WHERE)."
