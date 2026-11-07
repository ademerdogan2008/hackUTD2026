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

# Read KEY from .env without executing it as shell code; strips CR and surrounding quotes.
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

has_login() {
  [ -f "$CFG" ] && grep -c '^spacetimedb_token' "$CFG" >/dev/null 2>&1
}

rp_login() {
  local token
  token="$(env_get SPACETIME_TOKEN)"
  if [ -z "$token" ]; then
    echo "SPACETIME_TOKEN missing in .env" >&2
    exit 1
  fi
  # Note: --token is briefly visible in the local process list while this runs.
  # Skipped entirely when the isolated config already holds a login.
  if ! spacetime --config-path "$CFG" login --token "$token" >/dev/null 2>&1; then
    unset token
    echo "login failed" >&2
    exit 1
  fi
  unset token
  chmod 600 "$CFG"
}

ensure_server() {
  local servers
  servers="$(spacetime --config-path "$CFG" server list 2>/dev/null || true)"
  case "$servers" in
    *maincloud*) ;;
    *) spacetime --config-path "$CFG" server add --url https://maincloud.spacetimedb.com maincloud >/dev/null 2>&1 || true ;;
  esac
}

if [ "${1:-}" = "login" ]; then
  if [ "$#" -ne 1 ]; then
    echo "rp-spacetime.sh login takes no extra arguments" >&2
    exit 2
  fi
  has_login || rp_login
  ensure_server
  exit 0
fi

if ! has_login; then
  rp_login
  ensure_server
fi
exec spacetime --config-path "$CFG" "$@"
