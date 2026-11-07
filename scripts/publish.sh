#!/usr/bin/env bash
# Usage: publish.sh dev|demo
#   dev  : may reset data on schema conflict (--delete-data=on-conflict)
#   demo : never deletes data; requires RP_CONFIRM_DEMO=yes or an interactive "yes"
set -euo pipefail
export PATH="/opt/homebrew/opt/node@24/bin:$HOME/.local/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-}"
case "$TARGET" in
  dev|demo) ;;
  *) echo "usage: publish.sh dev|demo" >&2; exit 2 ;;
esac

env_get() {
  local key="$1" line val
  [ -f ./.env ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      "$key="*)
        val="${line#"$key="}"
        val="${val#\"}"; val="${val%\"}"
        val="${val#\'}"; val="${val%\'}"
        printf '%s' "$val"
        return 0
        ;;
    esac
  done < ./.env
}

RP_DB_DEV="$(env_get RP_DB_DEV)"; RP_DB_DEV="${RP_DB_DEV:-red-phone-6h786-dev}"
RP_DB_DEMO="$(env_get RP_DB_DEMO)"; RP_DB_DEMO="${RP_DB_DEMO:-red-phone-6h786}"

# Guard against a typo pointing the destructive dev publish at the demo database.
if [ "$RP_DB_DEV" = "$RP_DB_DEMO" ]; then
  echo "refusing: RP_DB_DEV and RP_DB_DEMO are the same ($RP_DB_DEV)" >&2
  exit 3
fi
case "$RP_DB_DEV" in
  *-dev) ;;
  *) echo "refusing: RP_DB_DEV must end in -dev (got $RP_DB_DEV)" >&2; exit 3 ;;
esac

bash scripts/rp-spacetime.sh login

if [ "$TARGET" = "dev" ]; then
  DB="$RP_DB_DEV"
  bash scripts/rp-spacetime.sh publish "$DB" --server maincloud --module-path server --no-config --delete-data=on-conflict -y
else
  DB="$RP_DB_DEMO"
  if [ "${RP_CONFIRM_DEMO:-}" != "yes" ]; then
    if [ -t 0 ]; then
      printf 'Publish to DEMO database %s? Type yes: ' "$DB"
      read -r answer
      [ "$answer" = "yes" ] || { echo "aborted" >&2; exit 4; }
    else
      echo "refusing: set RP_CONFIRM_DEMO=yes to publish to demo ($DB)" >&2
      exit 4
    fi
  fi
  bash scripts/rp-spacetime.sh publish "$DB" --server maincloud --module-path server --no-config -y
fi
echo "published $DB"
