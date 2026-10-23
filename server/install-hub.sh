#!/usr/bin/env bash
# Hub de projets — installation / mise à jour sur un VPS Ubuntu ou Debian.
#  - installe Caddy (HTTPS automatique) et la page d'accueil (branche « hub »)
#  - installe la commande « hub » pour ajouter des projets en une ligne
#  - garde l'API Ollama protégée (clé d'accès reprise de la config existante, sinon créée ;
#    connexion par mot de passe possible : « ll-auth passwd »)
#  - installe le service « ll-server » (connexion, recherche web, lecture de pages) derrière Caddy
#  - ajoute LL (https://<hôte>/llm/) puis les sites statiques de la branche « sites » (hub sync)
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
LL_STATE="${LL_STATE:-/var/lib/ll}"
LL_PORT="${LL_PORT:-8787}"
UNIT_DIR="${UNIT_DIR:-/etc/systemd/system}"
HUB_BIN="${HUB_BIN:-/usr/local/bin/hub}"
SUDO="${SUDO-sudo}"
APT="$SUDO env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get"
export SUDO REPO_URL HUB_DIR PROJ_DIR SNIP_DIR DATA_DIR CADDYFILE CADDY_BIN LL_PORT

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

# 3b. Service ll-server : connexion par mot de passe, recherche web, lecture de pages
$SUDO chmod +x "$HUB_DIR/server/ll-server.py"
$SUDO ln -sf "$HUB_DIR/server/ll-server.py" "${LL_AUTH_BIN:-/usr/local/bin/ll-auth}"
LL_PY=/usr/bin/python3
if [ -z "$SKIP_SERVICE" ]; then
  id ll >/dev/null 2>&1 || $SUDO useradd --system --no-create-home --shell /usr/sbin/nologin ll
  $SUDO mkdir -p "$LL_STATE"; $SUDO chown ll:ll "$LL_STATE"; $SUDO chmod 750 "$LL_STATE"
  if [ ! -x /opt/ll/venv/bin/python ]; then   # bibliothèque de recherche (facultative : sans elle, repli intégré)
    { $APT install -y python3-venv >/dev/null 2>&1 && $SUDO mkdir -p /opt/ll && $SUDO python3 -m venv /opt/ll/venv \
      && $SUDO /opt/ll/venv/bin/pip install -q ddgs >/dev/null 2>&1; } || echo "(recherche web : bibliothèque ddgs non installée, repli intégré utilisé)"
  fi
  [ ! -x /opt/ll/venv/bin/python ] || LL_PY=/opt/ll/venv/bin/python
else
  $SUDO mkdir -p "$LL_STATE"
fi
export LL_CONF="$LL_STATE/auth.json"

# 4. Nom d'hôte et clé d'accès (repris de la config existante si elle existe)
OLD=""; [ -r "$CADDYFILE" ] || [ -n "$SUDO" ] && OLD="$($SUDO cat "$CADDYFILE" 2>/dev/null || true)"
HOST="$1"
[ -n "$HOST" ] || HOST="$(printf '%s\n' "$OLD" | grep -m1 -E '^[A-Za-z0-9.:-]+ \{' | sed 's/ *{.*//')"
[ -n "$HOST" ] || HOST="$(curl -4 -s https://api.ipify.org | tr . -).sslip.io"
KEY=""; NEWKEY=""
if [ ! -s "$LL_CONF" ]; then   # première installation du service : on reprend la clé déjà utilisée, sinon on en crée une
  KEY="$(printf '%s\n' "$OLD" | grep -o 'Bearer [0-9a-f]*' | head -1 | cut -d' ' -f2)"
  [ -n "$KEY" ] || { KEY="$(openssl rand -hex 24)"; NEWKEY=1; }
  $SUDO env LL_CONF="$LL_CONF" python3 "$HUB_DIR/server/ll-server.py" init "$KEY" >/dev/null
fi

# 5. Configuration de Caddy
[ -z "$OLD" ] || $SUDO cp "$CADDYFILE" "$CADDYFILE.bak"
$SUDO tee "$CADDYFILE" >/dev/null <<CADDY
$HOST {
  # API Ollama et service LL (/_ll/...), protégés : clé d'accès ou session (vérifiée par ll-server)
  @api path /v1/* /api/* /_ll/*
  handle @api {
    header Access-Control-Allow-Origin "*"
    @preflight method OPTIONS
    handle @preflight {
      header Access-Control-Allow-Methods "GET, POST, OPTIONS"
      header Access-Control-Allow-Headers "Authorization, Content-Type"
      header Access-Control-Max-Age "86400"
      respond 204
    }
    handle /_ll/auth/login {
      reverse_proxy 127.0.0.1:$LL_PORT
    }
    route {
      forward_auth 127.0.0.1:$LL_PORT {
        uri /_ll/auth/check
      }
      handle /_ll/* {
        reverse_proxy 127.0.0.1:$LL_PORT
      }
      handle {
        reverse_proxy 127.0.0.1:11434 {
          header_up Host 127.0.0.1:11434
          header_up -Origin
          flush_interval -1
        }
      }
    }
  }

  # Textes et éléments de l'accueil (public) ; leur modification passe par /_ll/admin/* (protégé, mot de passe)
  handle /_hub/site.json {
    header Cache-Control "no-store"
    reverse_proxy 127.0.0.1:$LL_PORT
  }

  # Liste des boutons de l'accueil (ancien format, repli)
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

if [ -z "$SKIP_SERVICE" ]; then
  $SUDO tee "$UNIT_DIR/ll-server.service" >/dev/null <<UNIT
[Unit]
Description=LL : connexion, recherche web, lecture de pages
After=network-online.target

[Service]
User=ll
Environment=LL_PORT=$LL_PORT LL_CONF=$LL_CONF
ExecStart=$LL_PY $HUB_DIR/server/ll-server.py serve
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$LL_STATE
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable ll-server >/dev/null 2>&1 || true
  $SUDO systemctl restart ll-server
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
  [ -z "$KEY" ] || echo "Test API avec clé (attendu 200) : $(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $KEY" https://$HOST/api/tags)"
  echo "Service LL        (attendu 401) : $(curl -s -o /dev/null -w '%{http_code}' https://$HOST/_ll/search?q=test)"
  echo
  echo "Connexion par mot de passe : ll-auth passwd   (puis « Se connecter » dans LL > ⚙)"
  echo "Changer la clé d'accès     : ll-auth rotate-key"
  echo
  echo "Ajouter un projet : hub add nom --titre \"Mon projet\" --branche ma-branche"
  echo "Administration de l'accueil : https://$HOST/admin/   (mot de passe : ll-auth passwd)"
fi
