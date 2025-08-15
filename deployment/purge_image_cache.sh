#!/usr/bin/env bash
set -euo pipefail

# Simple cache purge for backend VPS (Ubuntu)
# - Deletes files under data/image_cache
# - Clears imageCache array inside data/db.json
#
# Usage:
#   chmod +x deployment/purge_image_cache.sh
#   ./deployment/purge_image_cache.sh
#
# Optional: set APP_DIR if running from elsewhere
#   APP_DIR=/var/www/app ./deployment/purge_image_cache.sh

APP_DIR=${APP_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"}
CACHE_DIR="$APP_DIR/data/image_cache"
DB_FILE="$APP_DIR/data/db.json"
BACKUP_DIR="$APP_DIR/data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

printf "[Purge] App dir: %s\n" "$APP_DIR"
printf "[Purge] Cache dir: %s\n" "$CACHE_DIR"
printf "[Purge] DB file: %s\n" "$DB_FILE"

# Ensure paths exist
mkdir -p "$CACHE_DIR"
mkdir -p "$BACKUP_DIR"

# Backup DB file if present
if [[ -f "$DB_FILE" ]]; then
  cp -f "$DB_FILE" "$BACKUP_DIR/db.json.$TIMESTAMP.bak"
  printf "[Purge] Backed up DB to %s\n" "$BACKUP_DIR/db.json.$TIMESTAMP.bak"
else
  # Create minimal DB if missing so clearing step works
  echo '{"users":[],"courses":[],"imageCache":[]}' > "$DB_FILE"
  printf "[Purge] Created new DB file at %s\n" "$DB_FILE"
fi

# Count files before
before_files=$(find "$CACHE_DIR" -type f 2>/dev/null | wc -l || true)

# Remove cached files
rm -f "$CACHE_DIR"/* 2>/dev/null || true

# Count files after
after_files=$(find "$CACHE_DIR" -type f 2>/dev/null | wc -l || true)
removed_files=$(( before_files - after_files ))
if (( removed_files < 0 )); then removed_files=0; fi

printf "[Purge] Removed %d cached file(s)\n" "$removed_files"

# Clear imageCache array in DB using jq if available; fallback to Node
if command -v jq >/dev/null 2>&1; then
  tmp_file="$DB_FILE.tmp"
  jq '(.imageCache) = []' "$DB_FILE" > "$tmp_file"
  mv "$tmp_file" "$DB_FILE"
  printf "[Purge] Cleared imageCache in DB using jq\n"
else
  if command -v node >/dev/null 2>&1; then
    DB_FILE="$DB_FILE" node <<'NODE'
const fs = require('fs');
const dbPath = process.env.DB_FILE;
try {
  const raw = fs.readFileSync(dbPath, 'utf8') || '{}';
  const json = JSON.parse(raw);
  if (!json || typeof json !== 'object') throw new Error('Invalid JSON in DB file');
  json.imageCache = [];
  fs.writeFileSync(dbPath, JSON.stringify(json, null, 2));
  console.log('[Purge] Cleared imageCache in DB using Node');
} catch (e) {
  console.error('[Purge] Failed to update DB:', e.message);
  process.exit(1);
}
NODE
  else
    printf "[Purge] Neither jq nor node found. DB imageCache not cleared. Install jq (sudo apt-get install -y jq) or Node.\n" >&2
  fi
fi

printf "[Purge] Done. Cache dir now has %d file(s).\n" "$after_files" 