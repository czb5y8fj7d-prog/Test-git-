#!/usr/bin/env bash
# Générateur d'images pour LL : FLUX.1 schnell (licence Apache 2.0) en Q8, sur processeur,
# avec stable-diffusion.cpp. Environ 19 Go à télécharger. Relançable : reprend là où il s'est arrêté.
#
#   sudo bash install-images.sh            (à lancer avec nohup : voir la commande donnée par l'assistant)
#
# Ce que ça installe (tout dans /opt/ll/sd) :
#   bin/sd-cli                         le programme (binaire officiel, sinon compilé sur place)
#   models/flux1-schnell-Q8_0.gguf     le modèle de dessin (12,7 Go)
#   models/t5xxl-Q8_0.gguf             l'encodeur de texte (5 Go)
#   models/clip_l.safetensors, ae.safetensors
# Le service « ll-server » détecte seul l'installation : le bouton 🎨 apparaît dans LL.
set -e
SD_DIR="${SD_DIR:-/opt/ll/sd}"
BIN_DIR="$SD_DIR/bin"; MODELS="$SD_DIR/models"
HF="${HF_BASE:-https://huggingface.co/second-state/FLUX.1-schnell-GGUF/resolve/main}"
SUDO="${SUDO-sudo}"; [ "$(id -u)" != 0 ] || SUDO=""
APT="$SUDO env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get"
say() { echo; echo "== $* =="; }
die() { echo "ERREUR : $*" >&2; exit 1; }

# 0. Vérifications
say "Vérifications"
free_gb=$($SUDO mkdir -p "$SD_DIR" && df -BG --output=avail "$SD_DIR" | tail -1 | tr -dc 0-9)
mem_gb=$(awk '/MemTotal/ {printf "%d", $2/1048576}' /proc/meminfo)
cores=$(nproc)
echo "Disque libre : ${free_gb} Go · Mémoire : ${mem_gb} Go · Cœurs : ${cores}"
[ "${free_gb:-0}" -ge 30 ] || die "il faut au moins 30 Go libres (il y en a ${free_gb})."
[ "${mem_gb:-0}" -ge 24 ] || die "il faut au moins 24 Go de mémoire pour FLUX (il y en a ${mem_gb})."
grep -qm1 avx2 /proc/cpuinfo || echo "ATTENTION : le processeur n'annonce pas AVX2 ; la génération risque d'être très lente ou impossible."
command -v curl >/dev/null && command -v unzip >/dev/null && command -v python3 >/dev/null || { $APT update -qq; $APT install -y curl unzip python3; }
$SUDO mkdir -p "$BIN_DIR" "$MODELS"

# 1. Le programme
have_bin() { [ -x "$BIN_DIR/sd-cli" ] || [ -x "$BIN_DIR/sd" ]; }
bin_ok() { local b; for b in "$BIN_DIR/sd-cli" "$BIN_DIR/sd"; do [ -x "$b" ] && "$b" --help 2>&1 | grep -q -- "--diffusion-model" && return 0; done; return 1; }
if ! bin_ok; then
  say "Programme stable-diffusion.cpp (binaire officiel)"
  TMP="$(mktemp -d)"
  if python3 - "$TMP" <<'PY'
import json, re, sys, urllib.request
tmp = sys.argv[1]
rel = json.load(urllib.request.urlopen(urllib.request.Request("https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest", headers={"User-Agent": "ll-install"}), timeout=30))
vid = ""
try:
    vid = re.search(r'VERSION_ID="?([\d.]+)', open("/etc/os-release").read()).group(1)
except Exception:
    pass
cands = [a for a in rel["assets"] if re.search(r"Linux-Ubuntu-[\d.]+-x86_64\.zip$", a["name"])]
if not cands:
    sys.exit("aucun binaire Linux CPU dans la dernière version")
cands.sort(key=lambda a: (("Ubuntu-" + vid + "-") not in a["name"], a["name"]))
a = cands[0]
print("→", a["name"], "(" + rel["tag_name"] + ")")
urllib.request.urlretrieve(a["browser_download_url"], tmp + "/sd.zip")
PY
  then
    ( cd "$TMP" && unzip -oq sd.zip -d x )
    f="$(find "$TMP/x" -type f \( -name sd-cli -o -name sd \) | head -1)"
    if [ -n "$f" ]; then
      for lib in $(find "$TMP/x" -type f -name '*.so*'); do $SUDO cp "$lib" "$BIN_DIR/"; done
      $SUDO cp "$f" "$BIN_DIR/$(basename "$f")"; $SUDO chmod 755 "$BIN_DIR"/*
    fi
  else
    echo "(téléchargement du binaire impossible, on compile sur place)"
  fi
  rm -rf "$TMP"
fi
if ! bin_ok; then
  say "Compilation de stable-diffusion.cpp (10 à 20 minutes)"
  $APT update -qq; $APT install -y git cmake build-essential
  SRC="$SD_DIR/src"
  [ -d "$SRC/.git" ] || $SUDO git clone --depth 1 --recursive https://github.com/leejet/stable-diffusion.cpp "$SRC"
  $SUDO cmake -S "$SRC" -B "$SRC/build" -DCMAKE_BUILD_TYPE=Release
  $SUDO cmake --build "$SRC/build" --config Release -j"$cores"
  f="$(find "$SRC/build" -type f \( -name sd-cli -o -name sd \) -perm -u+x | head -1)"
  [ -n "$f" ] || die "compilation terminée mais programme introuvable."
  $SUDO cp "$f" "$BIN_DIR/$(basename "$f")"; $SUDO chmod 755 "$BIN_DIR"/*
fi
bin_ok || die "le programme d'images ne démarre pas sur ce serveur."
echo "Programme prêt : $(ls "$BIN_DIR" | grep -E '^sd(-cli)?$' | head -1)"

# 2. Les modèles (reprise automatique en cas de coupure)
get() { # fichier taille-minimale-octets
  local f="$MODELS/$1"
  if [ -f "$f" ] && [ "$(stat -c %s "$f")" -ge "$2" ]; then echo "✓ $1 déjà présent"; return; fi
  echo "→ $1 …"
  $SUDO curl -fL -C - --retry 8 --retry-delay 5 --retry-all-errors -sS -o "$f.part" "$HF/$1"
  [ "$(stat -c %s "$f.part")" -ge "$2" ] || die "$1 incomplet ou invalide (relancez le script)."
  $SUDO mv "$f.part" "$f"
  echo "✓ $1 ($(du -h "$f" | cut -f1))"
}
say "Modèles (≈ 19 Go, de quoi patienter)"
get ae.safetensors 300000000
get clip_l.safetensors 200000000
get t5xxl-Q8_0.gguf 4000000000
get flux1-schnell-Q8_0.gguf 10000000000
$SUDO chmod -R a+rX "$SD_DIR"

# 3. Essai : une petite image, pour mesurer la vitesse de CE serveur
if [ -z "$SKIP_TEST" ]; then
  say "Essai (petite image 512×512, 2 étapes)"
  B="$BIN_DIR/sd-cli"; [ -x "$B" ] || B="$BIN_DIR/sd"
  T0=$(date +%s)
  if "$B" --diffusion-model "$MODELS/flux1-schnell-Q8_0.gguf" --vae "$MODELS/ae.safetensors" --clip_l "$MODELS/clip_l.safetensors" --t5xxl "$MODELS/t5xxl-Q8_0.gguf" \
       -p "a red apple on a wooden table, studio light" --cfg-scale 1.0 --sampling-method euler --steps 2 -W 512 -H 512 -o /tmp/ll-test.png 2>&1 | tail -3; then
    T1=$(date +%s)
    if [ -s /tmp/ll-test.png ]; then
      echo "Image d'essai créée en $((T1 - T0)) s (chargement des modèles compris)."
      echo "Ordre de grandeur pour une image 1024×1024 : plusieurs minutes (chaque étape coûte environ 4 fois plus qu'en 512×512)."
      rm -f /tmp/ll-test.png
    else
      die "l'essai n'a produit aucune image."
    fi
  else
    die "l'essai a échoué (voir les lignes ci-dessus)."
  fi
fi

echo
echo "=== TERMINÉ ==="
echo "Le bouton 🎨 apparaît dans LL (rouvrez l'app). Rien d'autre à faire."
