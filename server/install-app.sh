#!/usr/bin/env bash
# LocalLM — installation / mise à jour sur un VPS Ubuntu ou Debian.
#  - récupère l'app depuis GitHub (branche « locallm ») dans /var/www/locallm
#  - installe Caddy si besoin et le configure :
#       https://<hôte>/            -> l'app (fichiers statiques)
#       https://<hôte>/v1, /api    -> Ollama (127.0.0.1:11434), protégé par une clé d'accès
#  - réutilise la clé déjà présente dans la config Caddy, sinon en crée une
# Relançable sans risque : sert aussi à mettre à jour (git pull).
# Usage : bash install-app.sh [nom-d-hôte]      (par défaut : <ip>.sslip.io)
set -e
REPO_URL="${REPO_URL:-https://github.com/czb5y8fj7d-prog/test-git-}"
BRANCH="${BRANCH:-locallm}"
WEBROOT="${WEBROOT:-/var/www/locallm}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
CADDY_BIN="${CADDY_BIN:-caddy}"
SUDO="${SUDO-sudo}"
APT="$SUDO env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get"

# 1. git
command -v git >/dev/null || { $APT update -qq; $APT install -y git; }

# 2. Caddy
if ! command -v "$CADDY_BIN" >/dev/null; then
  $APT update -qq
  $APT install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | $SUDO gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | $SUDO tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  $APT update -qq
  $APT install -y caddy
fi

# 3. L'app (clone la première fois, git pull ensuite)
if [ -d "$WEBROOT/.git" ]; then
  $SUDO git -C "$WEBROOT" pull --ff-only
else
  $SUDO mkdir -p "$(dirname "$WEBROOT")"
  $SUDO git clone --depth 1 --branch "$BRANCH" --single-branch "$REPO_URL" "$WEBROOT"
fi
$SUDO chmod -R a+rX "$WEBROOT"

# 4. Nom d'hôte et clé d'accès (repris de la config existante si elle existe)
OLD=""; [ -r "$CADDYFILE" ] || [ -n "$SUDO" ] && OLD="$($SUDO cat "$CADDYFILE" 2>/dev/null || true)"
HOST="$1"
[ -n "$HOST" ] || HOST="$(printf '%s\n' "$OLD" | grep -m1 -E '^[A-Za-z0-9.-]+ \{' | sed 's/ *{.*//')"
[ -n "$HOST" ] || HOST="$(curl -4 -s https://api.ipify.org | tr . -).sslip.io"
KEY="$(printf '%s\n' "$OLD" | grep -o 'Bearer [0-9a-f]*' | head -1 | cut -d' ' -f2)"
NEWKEY=""
[ -n "$KEY" ] || { KEY="$(openssl rand -hex 24)"; NEWKEY=1; }

# 5. Configuration de Caddy
[ -z "$OLD" ] || $SUDO cp "$CADDYFILE" "$CADDYFILE.bak"
$SUDO tee "$CADDYFILE" >/dev/null <<CADDY
$HOST {
  @api path /v1/* /api/*
  handle @api {
    header Access-Control-Allow-Origin "*"
    @preflight method OPTIONS
    handle @preflight {
      header Access-Control-Allow-Methods "GET, POST, OPTIONS"
      header Access-Control-Allow-Headers "Authorization, Content-Type"
      header Access-Control-Max-Age "86400"
      respond 204
    }
    @authed header Authorization "Bearer $KEY"
    handle @authed {
      reverse_proxy 127.0.0.1:11434 {
        header_up Host 127.0.0.1:11434
        header_up -Origin
        flush_interval -1
      }
    }
    handle {
      respond "Unauthorized" 401
    }
  }
  handle {
    root * $WEBROOT
    encode gzip
    header Cache-Control "no-cache"
    file_server {
      hide .git server
    }
  }
}
CADDY
$SUDO chown root:caddy "$CADDYFILE" 2>/dev/null || true
$SUDO chmod 640 "$CADDYFILE"
$SUDO "$CADDY_BIN" validate --config "$CADDYFILE" --adapter caddyfile

if [ -z "$SKIP_RESTART" ]; then
  $SUDO systemctl enable caddy >/dev/null 2>&1 || true
  $SUDO systemctl restart caddy
  sleep 20
  echo
  echo "=== TERMINÉ ==="
  echo "Page de l'app : https://$HOST"
  echo "Adresse API   : https://$HOST   (à saisir dans ⚙ > Serveur distant)"
  [ -z "$NEWKEY" ] || echo "Clé d'accès   : $KEY   (nouvelle : notez-la)"
  echo "Service Caddy : $($SUDO systemctl is-active caddy)"
  echo "Test page         (attendu 200) : $(curl -s -o /dev/null -w '%{http_code}' https://$HOST/)"
  echo "Test API sans clé (attendu 401) : $(curl -s -o /dev/null -w '%{http_code}' https://$HOST/api/tags)"
  echo "Test API avec clé (attendu 200) : $(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $KEY" https://$HOST/api/tags)"
fi
