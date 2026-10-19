#!/usr/bin/env bash
# Hub de projets — installation / mise à jour sur un VPS Ubuntu ou Debian.
#  - installe Caddy (HTTPS automatique) et la page d'accueil (branche « hub »)
#  - installe la commande « hub » pour ajouter des projets en une ligne
#  - garde l'API Ollama protégée par la clé d'accès (reprise de la config existante, sinon créée)
#  - ajoute LocalLM (https://<hôte>/llm/) puis les sites statiques de la branche « sites » (hub sync)
# Relançable sans risque.
# Usage : bash install-hub.sh [nom-d-hôte]      (par défaut : <ip>.sslip.io)
set -e
REPO_URL="${REPO_URL:-https://github.com/czb5y8fj7d-prog/test-git-}"
HUB_BRANCH="${HUB_BRANCH:-hub}"
HUB_DIR="${HUB_DIR:-/var/www/hub}"
PROJ_DIR="${PROJ_DIR:-/var/www/projects}"
SNIP_DIR="${SNIP_DIR:-/etc/caddy/projects}"
DATA_DIR="${DATA_DIR:-/var/lib/hub}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
CADDY_BIN="${CADDY_BIN:-caddy}"
HUB_BIN="${HUB_BIN:-/usr/local/bin/hub}"
SUDO="${SUDO-sudo}"
APT="$SUDO env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get"
export SUDO REPO_URL HUB_DIR PROJ_DIR SNIP_DIR DATA_DIR CADDYFILE CADDY_BIN

# 1. git, python3, openssl
command -v git >/dev/null || { $APT update -qq; $APT install -y git; }
command -v python3 >/dev/null || { $APT update -qq; $APT install -y python3; }
command -v openssl >/dev/null || { $APT update -qq; $APT install -y openssl; }

# 2. Caddy
if ! command -v "$CADDY_BIN" >/dev/null; then
  $APT update -qq
  $APT install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | $SUDO gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | $SUDO tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  $APT update -qq
  $APT install -y caddy
fi

# 3. La page d'accueil (clone la première fois, git pull ensuite)
if [ -d "$HUB_DIR/.git" ]; then
  $SUDO git -C "$HUB_DIR" pull --ff-only
else
  $SUDO mkdir -p "$(dirname "$HUB_DIR")"
  $SUDO git clone --depth 1 --branch "$HUB_BRANCH" --single-branch "$REPO_URL" "$HUB_DIR"
fi
$SUDO chmod -R a+rX "$HUB_DIR"
$SUDO chmod +x "$HUB_DIR/server/hub"
$SUDO mkdir -p "$PROJ_DIR" "$SNIP_DIR" "$DATA_DIR"
[ -e "$DATA_DIR/projects.json" ] || echo '[]' | $SUDO tee "$DATA_DIR/projects.json" >/dev/null
$SUDO chmod 755 "$DATA_DIR"; $SUDO chmod 644 "$DATA_DIR/projects.json"
$SUDO ln -sf "$HUB_DIR/server/hub" "$HUB_BIN"

# 4. Nom d'hôte et clé d'accès (repris de la config existante si elle existe)
OLD=""; [ -r "$CADDYFILE" ] || [ -n "$SUDO" ] && OLD="$($SUDO cat "$CADDYFILE" 2>/dev/null || true)"
HOST="$1"
[ -n "$HOST" ] || HOST="$(printf '%s\n' "$OLD" | grep -m1 -E '^[A-Za-z0-9.:-]+ \{' | sed 's/ *{.*//')"
[ -n "$HOST" ] || HOST="$(curl -4 -s https://api.ipify.org | tr . -).sslip.io"
KEY="$(printf '%s\n' "$OLD" | grep -o 'Bearer [0-9a-f]*' | head -1 | cut -d' ' -f2)"
NEWKEY=""
[ -n "$KEY" ] || { KEY="$(openssl rand -hex 24)"; NEWKEY=1; }

# 5. Configuration de Caddy
[ -z "$OLD" ] || $SUDO cp "$CADDYFILE" "$CADDYFILE.bak"
$SUDO tee "$CADDYFILE" >/dev/null <<CADDY
$HOST {
  # API Ollama, protégée par la clé d'accès
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

  # Liste des boutons de l'accueil
  handle /projects.json {
    root * $DATA_DIR
    header Cache-Control "no-store"
    file_server
  }

  # Un fichier par projet : $SNIP_DIR/<nom>.caddy  (géré par la commande « hub »)
  import $SNIP_DIR/*.caddy

  # Tout le reste : la page d'accueil
  handle {
    root * $HUB_DIR
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

# 6. Premier projet : LocalLM (sans redémarrer Caddy ici, on le fait une fois à la fin)
if [ -z "$NO_LLM" ]; then
  CADDY_RELOAD=true "$HUB_DIR/server/hub" add llm --titre "LL" --icone "💬" --categorie "IA" --rang 4 \
    --desc "Chat IA privé : sur l'iPhone ou sur le serveur" --branche locallm
fi
# Les sites statiques (branche « sites »), s'ils existent
if [ -z "$NO_SITES" ]; then
  CADDY_RELOAD=true "$HUB_DIR/server/hub" sync || echo "(branche « sites » ignorée : voir le message ci-dessus)"
fi

if [ -z "$SKIP_RESTART" ]; then
  $SUDO systemctl enable caddy >/dev/null 2>&1 || true
  $SUDO systemctl restart caddy
  sleep 20
  echo
  echo "=== TERMINÉ ==="
  echo "Accueil       : https://$HOST/"
  echo "LL            : https://$HOST/llm/"
  echo "Adresse API   : https://$HOST   (à saisir dans LL > ⚙ > Serveur distant)"
  [ -z "$NEWKEY" ] || echo "Clé d'accès   : $KEY   (nouvelle : notez-la)"
  echo "Service Caddy : $($SUDO systemctl is-active caddy)"
  echo "Test accueil      (attendu 200) : $(curl -s -o /dev/null -w '%{http_code}' https://$HOST/)"
  echo "Test LL           (attendu 200) : $(curl -s -o /dev/null -w '%{http_code}' https://$HOST/llm/)"
  echo "Test API sans clé (attendu 401) : $(curl -s -o /dev/null -w '%{http_code}' https://$HOST/api/tags)"
  echo "Test API avec clé (attendu 200) : $(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $KEY" https://$HOST/api/tags)"
  echo
  echo "Ajouter un projet : hub add nom --titre \"Mon projet\" --branche ma-branche"
fi
