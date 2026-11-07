#!/usr/bin/env bash
# Wrapper: every spacetime call uses the isolated project-local config.
# The global ~/.config/spacetime/cli.toml (another project) is never used.
set -euo pipefail
umask 077
export PATH="/opt/homebrew/opt/node@24/bin:$HOME/.local/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
CFG="$ROOT/.spacetime/cli.toml"
mkdir -p .spacetime
chmod 700 .spacetime

rp_login() {
  if [ ! -f ./.env ]; then
    echo "SPACETIME_TOKEN missing in .env" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  if [ -z "${SPACETIME_TOKEN:-}" ]; then
    echo "SPACETIME_TOKEN missing in .env" >&2
    exit 1
  fi
  if ! spacetime --config-path "$CFG" login --token "$SPACETIME_TOKEN" >/dev/null 2>&1; then
    echo "login failed" >&2
    exit 1
  fi
  chmod 600 "$CFG"
  unset SPACETIME_TOKEN
  # Ensure the maincloud server nickname exists in the isolated config.
  if ! spacetime --config-path "$CFG" server list 2>/dev/null | grep -q 'maincloud'; then
    spacetime --config-path "$CFG" server add --url https://maincloud.spacetimedb.com maincloud >/dev/null 2>&1 || true
  fi
}

if [ "${1:-}" = "login" ]; then
  if [ "$#" -ne 1 ]; then
    echo "rp-spacetime.sh login takes no extra arguments" >&2
    exit 2
  fi
  rp_login
  exit 0
fi

if [ ! -f "$CFG" ]; then
  rp_login
fi
exec spacetime --config-path "$CFG" "$@"
