#!/usr/bin/env bash
# Usage: publish.sh dev|demo
set -euo pipefail
export PATH="/opt/homebrew/opt/node@24/bin:$HOME/.local/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-}"
case "$TARGET" in
  dev|demo) ;;
  *) echo "usage: publish.sh dev|demo" >&2; exit 2 ;;
esac

RP_DB_DEV=red-phone-6h786-dev
RP_DB_DEMO=red-phone-6h786
if [ -f ./.env ]; then
  RP_DB_DEV_ENV="$(sed -n 's/^RP_DB_DEV=//p' .env | head -1)"
  RP_DB_DEMO_ENV="$(sed -n 's/^RP_DB_DEMO=//p' .env | head -1)"
  RP_DB_DEV="${RP_DB_DEV_ENV:-$RP_DB_DEV}"
  RP_DB_DEMO="${RP_DB_DEMO_ENV:-$RP_DB_DEMO}"
fi

bash scripts/rp-spacetime.sh login

if [ "$TARGET" = "dev" ]; then
  DB="$RP_DB_DEV"
  bash scripts/rp-spacetime.sh publish "$DB" --server maincloud --module-path server --no-config --delete-data=on-conflict -y
else
  DB="$RP_DB_DEMO"
  bash scripts/rp-spacetime.sh publish "$DB" --server maincloud --module-path server --no-config -y
fi
echo "published $DB"
