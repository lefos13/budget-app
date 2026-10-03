#!/usr/bin/env bash
: <<'COMMENT'
Activates an already-extracted release on the droplet. CI builds everything (Next standalone
server, static assets, a pinned Prisma CLI for migrations), so the host only backs up the
SQLite file, applies migrations, swaps the `current` symlink and reloads PM2.

Layout under APP_ROOT (default /root/budget-app):
  releases/<id>/           one directory per deploy, newest KEEP_RELEASES kept
  current -> releases/<id>  what PM2 runs
  shared/.env.production    runtime config (AUTH_SECRET, DATABASE_URL, PORT, HOSTNAME)
  shared/data/              SQLite database (outside releases, survives deploys)
  shared/backups/           pre-migration DB copies, newest KEEP_BACKUPS kept

Usage: deploy-release.sh <release-dir>
COMMENT
set -euo pipefail

RELEASE_DIR="$(cd "$1" && pwd)"
APP_ROOT="${APP_ROOT:-/root/budget-app}"
ENV_FILE="$APP_ROOT/shared/.env.production"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"
export APP_ROOT

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi
set -a
. "$ENV_FILE"
set +a

if [[ -z "${AUTH_SECRET:-}" || ${#AUTH_SECRET} -lt 32 ]]; then
  echo "AUTH_SECRET in $ENV_FILE must be at least 32 characters." >&2
  exit 1
fi
# Absolute file: URL only, so the database can never land inside a release that gets pruned.
if [[ "${DATABASE_URL:-}" != file:/* ]]; then
  echo "DATABASE_URL in $ENV_FILE must be an absolute file: URL (got '${DATABASE_URL:-}')." >&2
  exit 1
fi
DB_FILE="${DATABASE_URL#file:}"
mkdir -p "$(dirname "$DB_FILE")" "$APP_ROOT/shared/backups"

test -f "$RELEASE_DIR/server.js"
test -d "$RELEASE_DIR/.next/static"
test -x "$RELEASE_DIR/migrator/node_modules/.bin/prisma"

if [[ -f "$DB_FILE" ]]; then
  BACKUP="$APP_ROOT/shared/backups/$(basename "$DB_FILE" .db)-$(date -u +%Y%m%dT%H%M%SZ).db"
  cp -p "$DB_FILE" "$BACKUP"
  echo "Backed up database to $BACKUP"
  ls -1t "$APP_ROOT/shared/backups/"*.db | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f
fi

nice -n 10 "$RELEASE_DIR/migrator/node_modules/.bin/prisma" migrate deploy --schema "$RELEASE_DIR/prisma/schema.prisma"

# Atomic swap: rename a fresh symlink over the old one.
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current.next"
mv -T "$APP_ROOT/current.next" "$APP_ROOT/current"

pm2 startOrReload "$RELEASE_DIR/deploy/ecosystem.config.cjs" --update-env
pm2 save

HEALTH_URL="http://${HOSTNAME:-127.0.0.1}:${PORT}/login"
for attempt in $(seq 1 20); do
  if curl -fsS -o /dev/null "$HEALTH_URL"; then
    echo "Health check passed: $HEALTH_URL"
    break
  fi
  if [[ "$attempt" -eq 20 ]]; then
    echo "Health check failed: $HEALTH_URL" >&2
    pm2 logs budget-app --lines 80 --nostream || true
    exit 1
  fi
  sleep 2
done

CURRENT_TARGET="$(readlink -f "$APP_ROOT/current")"
for old in $(ls -1dt "$APP_ROOT/releases/"*/ | tail -n +"$((KEEP_RELEASES + 1))"); do
  if [[ "$(readlink -f "$old")" != "$CURRENT_TARGET" ]]; then
    nice -n 19 ionice -c 3 rm -rf "$old"
  fi
done

echo "budget-app release $(basename "$RELEASE_DIR") is live"
