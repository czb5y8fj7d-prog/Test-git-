#!/usr/bin/env python3
"""ll-server — petit service local pour LL (connexion, recherche web, lecture de pages).

Utilisation sur le serveur (en root) :
    ll-auth passwd        définit (ou change) le mot de passe de connexion
    ll-auth rotate-key    génère une nouvelle clé d'accès (l'ancienne cesse de marcher)
    ll-auth logout-all    déconnecte tous les appareils
    ll-auth status        état de la configuration

Le service lui-même (systemd) : ll-server.py serve
Il n'écoute que sur 127.0.0.1 ; Caddy le place derrière HTTPS (/_ll/...).
Aucune dépendance obligatoire (bibliothèque standard) ; « ddgs » est utilisée si elle est installée.
"""
import getpass
import hashlib
import hmac
import html
import ipaddress
import json
import os
import re
import secrets
import queue
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CONF = os.environ.get("LL_CONF", "/var/lib/ll/auth.json")
HOST = os.environ.get("LL_HOST", "127.0.0.1")
PORT = int(os.environ.get("LL_PORT", "8787"))
SESSION_DAYS = int(os.environ.get("LL_SESSION_DAYS", "90"))
SEARXNG = os.environ.get("SEARXNG_URL", "").rstrip("/")
UA = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"
LOCK = threading.Lock()


# --------------------------------------------------------------------------- configuration
def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()


def load():
    try:
        with open(CONF, encoding="utf-8") as f:
            d = json.load(f)
        if isinstance(d, dict):
            d.setdefault("sessions", {})
            return d
    except (OSError, ValueError):
        pass
    return {"sessions": {}}


def save(d):
    os.makedirs(os.path.dirname(CONF), exist_ok=True)
    tmp = CONF + ".tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o640)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=1)
    os.replace(tmp, CONF)
    try:  # le service tourne sous l'utilisateur « ll »
        import pwd
        u = pwd.getpwnam("ll")
        os.chown(CONF, u.pw_uid, u.pw_gid)
    except Exception:
        pass


_cache = {"mtime": None, "data": None}


def conf():
    try:
        m = os.stat(CONF).st_mtime_ns
    except OSError:
        m = None
    if _cache["mtime"] != m or _cache["data"] is None:
        _cache["data"], _cache["mtime"] = load(), m
    return _cache["data"]


def hash_pw(pw, salt=None):
    salt = salt or secrets.token_hex(16)
    h = hashlib.scrypt(pw.encode(), salt=salt.encode(), n=2 ** 14, r=8, p=1, dklen=32).hex()
    return {"salt": salt, "hash": h}


def check_pw(pw, rec):
    if not rec:
        return False
    try:
        return hmac.compare_digest(hash_pw(pw, rec["salt"])["hash"], rec["hash"])
    except Exception:
        return False


def auth_kind(token):
    """'key' (clé d'accès), 'session' (connexion par mot de passe) ou None."""
    if not token:
        return None
    c = conf()
    th = sha(token)
    if c.get("key_hash") and hmac.compare_digest(th, c["key_hash"]):
        return "key"
    s = c.get("sessions", {}).get(th)
    if s and s.get("exp", 0) > time.time():
        return "session"
    return None


# --------------------------------------------------------------------------- limitation des essais
_fails = {}


def locked(ip):
    n, until = _fails.get(ip, (0, 0))
    return until > time.time()


def fail(ip):
    n, _ = _fails.get(ip, (0, 0))
    n += 1
    _fails[ip] = (n, time.time() + (min(900, 2 ** max(0, n - 3) * 15) if n >= 3 else 0))


# --------------------------------------------------------------------------- recherche web
def _clean(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def search_web(q, n=6):
    n = max(1, min(10, n))
    if os.environ.get("LL_SEARCH_FIXTURE"):  # tests uniquement
        with open(os.environ["LL_SEARCH_FIXTURE"], encoding="utf-8") as f:
            return json.load(f)[:n]
    if SEARXNG:
        req = urllib.request.Request(SEARXNG + "/search?" + urllib.parse.urlencode({"q": q, "format": "json"}), headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            j = json.load(r)
        return [{"title": x.get("title", ""), "url": x.get("url", ""), "snippet": x.get("content", "")} for x in j.get("results", [])[:n]]
    try:
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS
        out = []
        for x in DDGS().text(q, max_results=n):
            out.append({"title": x.get("title", ""), "url": x.get("href") or x.get("url", ""), "snippet": x.get("body", "")})
        if out:
            return out
    except ImportError:
        pass
    except Exception as e:  # repli sur la page HTML
        sys.stderr.write("ddgs: %s\n" % e)
    data = urllib.parse.urlencode({"q": q}).encode()
    req = urllib.request.Request("https://html.duckduckgo.com/html/", data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=15) as r:
        page = r.read().decode("utf-8", "replace")
    out = []
    for m in re.finditer(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>(.*?)(?=<a[^>]+class="result__a"|$)', page, re.S):
        href = html.unescape(m.group(1))
        mm = re.search(r"uddg=([^&]+)", href)
        if mm:
            href = urllib.parse.unquote(mm.group(1))
        sn = re.search(r'class="result__snippet"[^>]*>(.*?)</a>', m.group(3), re.S)
        out.append({"title": _clean(m.group(2)), "url": href, "snippet": _clean(sn.group(1) if sn else "")})
        if len(out) >= n:
            break
    return out


# --------------------------------------------------------------------------- lecture d'une page
class _Text(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "head", "nav", "footer", "form", "iframe"}
    BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "pre", "blockquote"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.skip, self.title, self._in_title = [], 0, "", False

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self._in_title = True
        if tag in self.SKIP:
            self.skip += 1
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif not self.skip:
            self.parts.append(data)


def public_host(host):
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    for i in infos:
        ip = ipaddress.ip_address(i[4][0].split("%")[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def fetch_page(url, limit=14000):
    u = urllib.parse.urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        raise ValueError("adresse invalide")
    opener = urllib.request.build_opener(_NoRedirect)
    for _ in range(4):  # redirections suivies à la main, chaque saut est revérifié
        if not public_host(u.hostname):
            raise ValueError("adresse non autorisée")
        req = urllib.request.Request(u.geturl(), headers={"User-Agent": UA, "Accept": "text/html,text/plain;q=0.9,*/*;q=0.5"})
        try:
            r = opener.open(req, timeout=12)
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and e.headers.get("Location"):
                u = urllib.parse.urlparse(urllib.parse.urljoin(u.geturl(), e.headers["Location"]))
                if u.scheme not in ("http", "https") or not u.hostname:
                    raise ValueError("redirection invalide")
                continue
            raise
        ctype = r.headers.get("Content-Type", "")
        if not re.search(r"text/|html|json|xml", ctype):
            raise ValueError("type non pris en charge : " + ctype)
        raw = r.read(1_500_000)
        enc = re.search(r"charset=([\w-]+)", ctype)
        text = raw.decode(enc.group(1) if enc else "utf-8", "replace")
        if "html" in ctype:
            p = _Text()
            p.feed(text)
            body = "".join(p.parts)
            title = p.title.strip()
        else:
            body, title = text, ""
        body = re.sub(r"[ \t\r\f\v]+", " ", body)
        body = re.sub(r"\n\s*\n+", "\n\n", body).strip()
        return {"url": u.geturl(), "title": title, "text": body[:limit], "truncated": len(body) > limit}
    raise ValueError("trop de redirections")


# --------------------------------------------------------------------------- génération d'images (stable-diffusion.cpp + FLUX.1 schnell)
SD_DIR = os.environ.get("SD_DIR", "/opt/ll/sd")
IMG_DIR = os.environ.get("LL_IMG_DIR", os.path.join(os.path.dirname(CONF), "images"))
OLLAMA = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL_FILES = {  # fichiers téléchargés par install-images.sh
    "diffusion": "flux1-schnell-Q8_0.gguf", "t5": "t5xxl-Q8_0.gguf", "clip": "clip_l.safetensors", "vae": "ae.safetensors",
}
FORMATS = {"carre": (1024, 1024), "portrait": (832, 1216), "paysage": (1216, 832)}
JOBS = {}
JOB_Q = queue.Queue()
JOBS_LOCK = threading.Lock()
_sd_help = {}


def sd_paths():
    d = os.environ.get("SD_MODELS", os.path.join(SD_DIR, "models"))
    binp = os.environ.get("SD_BIN") or next((p for p in (os.path.join(SD_DIR, "bin", n) for n in ("sd-cli", "sd")) if os.path.isfile(p) and os.access(p, os.X_OK)), "")
    files = {k: os.path.join(d, v) for k, v in MODEL_FILES.items()}
    ok = bool(binp) and all(os.path.isfile(p) for p in files.values())
    return binp, files, ok


def image_ready():
    return sd_paths()[2]


def sd_supports(binp, flag):
    if binp not in _sd_help:
        try:
            r = subprocess.run([binp, "--help"], capture_output=True, text=True, timeout=30)
            _sd_help[binp] = r.stdout + r.stderr
        except Exception:
            _sd_help[binp] = ""
    return flag in _sd_help[binp]


def free_ollama():
    """Décharge les modèles texte de la mémoire (FLUX a besoin de la RAM) ; Ollama les recharge à la demande."""
    try:
        with urllib.request.urlopen(OLLAMA + "/api/ps", timeout=5) as r:
            models = [m.get("name") or m.get("model") for m in json.load(r).get("models", [])]
        for name in models:
            req = urllib.request.Request(OLLAMA + "/api/generate", data=json.dumps({"model": name, "keep_alive": 0}).encode(), headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=15).read()
        for _ in range(20):
            with urllib.request.urlopen(OLLAMA + "/api/ps", timeout=5) as r:
                if not json.load(r).get("models"):
                    break
            time.sleep(1)
    except Exception as e:
        sys.stderr.write("free_ollama: %s\n" % e)


def job_meta_path(jid):
    return os.path.join(IMG_DIR, jid + ".json")


def job_save(j):
    try:
        os.makedirs(IMG_DIR, exist_ok=True)
        pub = {k: v for k, v in j.items() if k != "proc"}
        with open(job_meta_path(j["id"]), "w", encoding="utf-8") as f:
            json.dump(pub, f)
    except OSError:
        pass


def job_get(jid):
    if not re.fullmatch(r"[0-9a-f]{16}", jid or ""):
        return None
    with JOBS_LOCK:
        j = JOBS.get(jid)
    if j:
        return j
    try:  # après un redémarrage du service : état relu depuis le disque
        with open(job_meta_path(jid), encoding="utf-8") as f:
            j = json.load(f)
        if j.get("state") in ("queued", "running"):
            j["state"], j["error"] = "error", "Le service a redémarré pendant la génération."
        return j
    except (OSError, ValueError):
        return None


def job_public(j):
    now = time.time()
    out = {k: j.get(k) for k in ("id", "state", "phase", "prompt", "width", "height", "steps", "step", "sec_per_it", "error")}
    out["elapsed"] = int((j.get("finished") or now) - j["started"]) if j.get("started") else 0
    if j["state"] == "queued":
        with JOBS_LOCK:
            ahead = [x for x in JOBS.values() if x["state"] in ("queued", "running") and x["created"] < j["created"]]
        out["position"] = len(ahead)
    if j["state"] == "running" and j.get("sec_per_it") and j.get("step") is not None:
        out["eta"] = int(max(0, (j["steps"] - j["step"]) * j["sec_per_it"]))
    return out


def job_new(prompt, width, height, steps, seed):
    j = {"id": secrets.token_hex(8), "state": "queued", "phase": "En attente", "prompt": prompt, "width": width, "height": height,
         "steps": steps, "seed": seed, "step": 0, "sec_per_it": None, "created": time.time(), "started": None, "finished": None, "error": None}
    with JOBS_LOCK:
        JOBS[j["id"]] = j
    job_save(j)
    JOB_Q.put(j["id"])
    return j


_PROG = re.compile(r"(\d+)\s*/\s*(\d+)\s*-\s*([\d.]+)\s*(s/it|it/s)")


def run_job(j):
    binp, files, ok = sd_paths()
    out = os.path.join(IMG_DIR, j["id"] + ".png")
    if not ok:
        j.update(state="error", error="Le générateur d'images n'est pas installé (install-images.sh).", finished=time.time())
        return
    j.update(state="running", phase="Libération de la mémoire", started=time.time())
    job_save(j)
    free_ollama()
    cmd = [binp, "--diffusion-model", files["diffusion"], "--vae", files["vae"], "--clip_l", files["clip"], "--t5xxl", files["t5"],
           "-p", j["prompt"], "--cfg-scale", "1.0", "--sampling-method", "euler", "--steps", str(j["steps"]),
           "-W", str(j["width"]), "-H", str(j["height"]), "-s", str(j["seed"]), "-o", out]
    if sd_supports(binp, "--diffusion-fa"):
        cmd.append("--diffusion-fa")
    if sd_supports(binp, "--clip-on-cpu"):
        cmd.append("--clip-on-cpu")
    j["phase"] = "Chargement des modèles"
    tail = ""
    try:
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=0)
        j["proc"] = p
        buf = b""
        deadline = time.time() + 3 * 3600
        while True:
            ch = p.stdout.read(1)
            if not ch:
                break
            if ch in (b"\r", b"\n"):
                line = buf.decode("utf-8", "replace")
                buf = b""
                if line.strip():
                    tail = (tail + "\n" + line)[-600:]
                    m = _PROG.search(line)
                    if m:
                        a, b, v, unit = int(m.group(1)), int(m.group(2)), float(m.group(3)), m.group(4)
                        j.update(step=a, phase="Dessin en cours", sec_per_it=(v if unit == "s/it" else (1 / v if v else None)))
                        if a >= b:
                            j["phase"] = "Finalisation"
                    elif re.search(r"decode|vae", line, re.I):
                        j["phase"] = "Finalisation"
                    elif re.search(r"sampling|generating", line, re.I):
                        j["phase"] = "Dessin en cours"
            else:
                buf += ch
            if time.time() > deadline:
                p.kill()
                break
        rc = p.wait()
        if j.get("cancel"):
            j.update(state="error", error="Annulée.")
        elif rc == 0 and os.path.isfile(out) and os.path.getsize(out) > 1000:
            j.update(state="done", phase="Terminé", step=j["steps"])
        else:
            j.update(state="error", error=("Échec du générateur (code %s). " % rc) + tail.strip()[-300:])
    except Exception as e:
        j.update(state="error", error="Erreur : %s" % str(e)[:200])
    finally:
        j["proc"] = None
        j["finished"] = time.time()
        job_save(j)
        prune_images()


def prune_images(keep=60):
    try:
        files = sorted((f for f in os.listdir(IMG_DIR) if f.endswith(".png")), key=lambda f: os.path.getmtime(os.path.join(IMG_DIR, f)))
        for f in files[:-keep]:
            for ext in (".png", ".json"):
                try:
                    os.remove(os.path.join(IMG_DIR, f[:-4] + ext))
                except OSError:
                    pass
    except OSError:
        pass


def worker():
    while True:
        jid = JOB_Q.get()
        with JOBS_LOCK:
            j = JOBS.get(jid)
        if not j or j.get("cancel"):
            if j:
                j.update(state="error", error="Annulée.", finished=time.time())
            continue
        run_job(j)


def cancel_job(j):
    j["cancel"] = True
    p = j.get("proc")
    if p:
        try:
            p.terminate()
        except Exception:
            pass
    elif j["state"] == "queued":
        j.update(state="error", error="Annulée.", finished=time.time())
        job_save(j)


# --------------------------------------------------------------------------- chats persistants
# La réponse du modèle est lue par le serveur, indépendamment de l'app : si l'iPhone met Safari en veille,
# la génération continue et l'app récupère le texte à son retour (sondage long, reprise à un décalage).
CHATS = {}
CHATS_LOCK = threading.Lock()
CHAT_KEEP = 2 * 3600
CHAT_MAX_LINES = 400_000


def chat_prune():
    now = time.time()
    with CHATS_LOCK:
        for cid in [k for k, c in CHATS.items() if c["state"] != "run" and now - c["updated"] > CHAT_KEEP]:
            CHATS.pop(cid, None)


def chat_new(payload):
    chat_prune()
    c = {"id": secrets.token_hex(8), "lines": [], "state": "run", "http": None, "cancel": False, "resp": None,
         "created": time.time(), "updated": time.time(), "cond": threading.Condition()}
    with CHATS_LOCK:
        CHATS[c["id"]] = c
    threading.Thread(target=chat_run, args=(c, payload), daemon=True).start()
    return c


def chat_finish(c, state, http=None):
    with c["cond"]:
        c["state"], c["http"], c["updated"] = state, http, time.time()
        c["resp"] = None
        c["cond"].notify_all()


def chat_run(c, payload):
    seen_done = False
    try:
        req = urllib.request.Request(OLLAMA + "/api/chat", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
        try:
            resp = urllib.request.urlopen(req, timeout=1200)
        except urllib.error.HTTPError as e:
            return chat_finish(c, "http", {"status": e.code, "body": e.read(4000).decode("utf-8", "replace")})
        except Exception as e:
            return chat_finish(c, "http", {"status": 502, "body": json.dumps({"error": "modèle injoignable : %s" % str(e)[:150]})})
        c["resp"] = resp
        for raw in resp:
            if c["cancel"]:
                break
            line = raw.decode("utf-8", "replace").strip()
            if not line:
                continue
            if '"done"' in line:
                try:
                    if json.loads(line).get("done"):
                        seen_done = True
                except ValueError:
                    pass
            with c["cond"]:
                if len(c["lines"]) < CHAT_MAX_LINES:
                    c["lines"].append(line)
                c["updated"] = time.time()
                c["cond"].notify_all()
        chat_finish(c, "cancel" if c["cancel"] else ("done" if seen_done else "cut"))
    except Exception:
        chat_finish(c, "cancel" if c["cancel"] else ("done" if seen_done else "cut"))
    finally:
        try:
            if c.get("resp"):
                c["resp"].close()
        except Exception:
            pass


def chat_poll(c, start, wait):
    """Renvoie les lignes à partir de « start » ; attend jusqu'à « wait » s si rien de neuf."""
    deadline = time.time() + wait
    with c["cond"]:
        while len(c["lines"]) <= start and c["state"] == "run":
            left = deadline - time.time()
            if left <= 0:
                break
            c["cond"].wait(left)
    if c["state"] == "run":
        time.sleep(0.06)   # regroupe les jetons qui arrivent à la suite
    with c["cond"]:
        chunk = c["lines"][start:start + 2000]
        return {"lines": chunk, "next": start + len(chunk), "state": c["state"] if start + len(chunk) >= len(c["lines"]) else "run", "http": c["http"] if c["state"] == "http" else None}


def chat_cancel(c):
    c["cancel"] = True
    r = c.get("resp")
    if r:
        try:
            r.close()   # Ollama arrête de calculer quand la connexion se ferme
        except Exception:
            pass



# --------------------------------------------------------------------------- accueil du hub (textes, éléments, ordre)
# projects.json (géré par la commande « hub ») reste la source des projets déployés ; l'administration y superpose
# ses propres réglages dans site.json (textes, titres modifiés, éléments masqués, liens ajoutés, ordre).
# « hub update » ne les écrase donc jamais.
HUB_DATA = os.environ.get("HUB_DATA", "/var/lib/hub/projects.json")
SITE_FILE = os.environ.get("LL_SITE", os.path.join(os.path.dirname(CONF), "site.json"))
SITE_LOCK = threading.Lock()
TEXT_DEFAULTS = {"title": "Mes projets", "lead": "Choisissez un projet."}
TEXT_LIMITS = {"eyebrow": 40, "title": 80, "lead": 200, "foot": 120}
ITEM_LIMITS = {"title": 80, "desc": 200, "cat": 30}
MAX_LINKS = 100
FIELDS = ("title", "desc", "icon", "cat")


def _txt(v, n):
    s = re.sub(r"[\x00-\x1f\x7f  ]", " ", str(v if v is not None else ""))
    return re.sub(r" {2,}", " ", s).strip()[:n]


def _icon(v):
    return _txt(v, 12)[:12]


def _url_ok(u):
    u = str(u or "").strip()
    if not u or len(u) > 500 or re.search(r"[\s\x00-\x1f\x7f\\]", u):
        return ""
    if u.startswith("/") and not u.startswith("//"):
        return u
    try:
        p = urllib.parse.urlparse(u)
    except ValueError:
        return ""
    return u if p.scheme in ("http", "https") and p.netloc and "@" not in p.netloc else ""


def hub_projects():
    try:
        with open(HUB_DATA, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return []
    out = []
    for p in data if isinstance(data, list) else []:
        if not isinstance(p, dict) or not (p.get("slug") or p.get("path")):
            continue
        slug = str(p.get("slug") or "")
        path = p.get("path") if isinstance(p.get("path"), str) else "/" + slug + "/"
        if not slug or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,30}", slug) or not path.startswith("/") or path.startswith("//"):
            continue
        out.append({"slug": slug, "title": _txt(p.get("title") or slug, 80), "desc": _txt(p.get("desc"), 200),
                    "icon": _icon(p.get("icon")) or "📁", "cat": _txt(p.get("cat"), 30), "path": path})
    return out


def site_load():
    try:
        with open(SITE_FILE, encoding="utf-8") as f:
            d = json.load(f)
        if not isinstance(d, dict):
            raise ValueError
    except (OSError, ValueError):
        d = {}
    d["rev"] = d["rev"] if isinstance(d.get("rev"), int) else 0
    for k, t in (("texts", dict), ("overrides", dict), ("links", list), ("order", list), ("hide", list)):
        if not isinstance(d.get(k), t):
            d[k] = t()
    return d


def site_items(site, base):
    """Éléments dans l'ordre d'affichage, masqués compris."""
    items = {}
    for p in base:
        o = site["overrides"].get(p["slug"]) or {}
        o = o if isinstance(o, dict) else {}
        it = {"key": "p:" + p["slug"], "kind": "project", "slug": p["slug"], "href": p["path"],
              "title": o.get("title") or p["title"], "icon": o.get("icon") or p["icon"],
              "desc": o["desc"] if "desc" in o else p["desc"], "cat": o["cat"] if "cat" in o else p["cat"],
              "hidden": bool(o.get("hidden")),
              "base": {k: p[k] for k in FIELDS}, "overridden": [k for k in FIELDS if k in o]}
        items[it["key"]] = it
    for l in site["links"]:
        if isinstance(l, dict) and re.fullmatch(r"[0-9a-f]{16}", str(l.get("id", ""))):
            it = {"key": "l:" + l["id"], "kind": "link", "id": l["id"], "href": l.get("url", ""), "title": l.get("title", ""),
                  "icon": l.get("icon") or "🔗", "desc": l.get("desc", ""), "cat": l.get("cat", ""), "hidden": bool(l.get("hidden"))}
            items[it["key"]] = it
    order = [k for k in site["order"] if k in items]
    seen = set(order)
    return [items[k] for k in order + [k for k in items if k not in seen]]


def site_texts(site):
    t = site["texts"]
    return {k: _txt(t.get(k), TEXT_LIMITS[k]) for k in TEXT_LIMITS}


def site_public():
    site = site_load()
    t, hide = site_texts(site), set(site["hide"])
    texts = {"title": t["title"] or TEXT_DEFAULTS["title"],
             "eyebrow": "" if "eyebrow" in hide else (t["eyebrow"] or None),     # None : nom de domaine
             "lead": "" if "lead" in hide else (t["lead"] or TEXT_DEFAULTS["lead"]),
             "foot": "" if "foot" in hide else (t["foot"] or None)}               # None : nombre de projets
    items = [{k: it[k] for k in ("key", "kind", "title", "desc", "icon", "cat", "href")} for it in site_items(site, hub_projects()) if not it["hidden"]]
    return {"texts": texts, "items": items}


def site_admin():
    site = site_load()
    return {"rev": site["rev"], "texts": site_texts(site), "hide": [h for h in site["hide"] if h in ("eyebrow", "lead", "foot")],
            "defaults": TEXT_DEFAULTS, "limits": {**TEXT_LIMITS, **{"item_" + k: v for k, v in ITEM_LIMITS.items()}, "links": MAX_LINKS},
            "items": site_items(site, hub_projects())}


class SiteError(Exception):
    def __init__(self, code, msg, field=None):
        super().__init__(msg)
        self.code, self.msg, self.field = code, msg, field


def site_save(b):
    """Valide et enregistre l'état envoyé par l'interface. Lève SiteError."""
    if not isinstance(b, dict):
        raise SiteError(400, "requête invalide")
    base = {p["slug"]: p for p in hub_projects()}
    texts_in = b.get("texts") if isinstance(b.get("texts"), dict) else {}
    texts = {k: _txt(texts_in.get(k), n) for k, n in TEXT_LIMITS.items()}
    hide = [h for h in (b.get("hide") if isinstance(b.get("hide"), list) else []) if h in ("eyebrow", "lead", "foot")]
    overrides, links, order, seen = {}, [], [], set()
    items_in = b.get("items")
    if not isinstance(items_in, list) or len(items_in) > 400:
        raise SiteError(400, "liste d'éléments invalide")
    for raw in items_in:
        if not isinstance(raw, dict):
            raise SiteError(400, "élément invalide")
        title = _txt(raw.get("title"), ITEM_LIMITS["title"])
        desc, cat, icon = _txt(raw.get("desc"), ITEM_LIMITS["desc"]), _txt(raw.get("cat"), ITEM_LIMITS["cat"]), _icon(raw.get("icon"))
        hidden = bool(raw.get("hidden"))
        if raw.get("kind") == "project":
            slug = str(raw.get("slug", ""))
            if slug not in base or ("p:" + slug) in seen:
                continue   # projet retiré du serveur entre-temps : ignoré
            seen.add("p:" + slug)
            order.append("p:" + slug)
            bp, o = base[slug], {}
            if title and title != bp["title"]:
                o["title"] = title
            if icon and icon != bp["icon"]:
                o["icon"] = icon
            if desc != bp["desc"]:
                o["desc"] = desc
            if cat != bp["cat"]:
                o["cat"] = cat
            if hidden:
                o["hidden"] = True
            if o:
                overrides[slug] = o
        elif raw.get("kind") == "link":
            lid = str(raw.get("id", ""))
            if not re.fullmatch(r"[0-9a-f]{16}", lid) or ("l:" + lid) in seen:
                raise SiteError(400, "identifiant de lien invalide")
            if not title:
                raise SiteError(422, "Un lien doit avoir un titre.", "title:" + lid)
            url = _url_ok(raw.get("url"))
            if not url:
                raise SiteError(422, "Adresse invalide : https://… ou un chemin commençant par /", "url:" + lid)
            seen.add("l:" + lid)
            order.append("l:" + lid)
            links.append({"id": lid, "title": title, "desc": desc, "cat": cat, "icon": icon or "🔗", "url": url, "hidden": hidden})
        else:
            raise SiteError(400, "type d'élément inconnu")
    if len(links) > MAX_LINKS:
        raise SiteError(422, "Trop de liens (maximum %d)." % MAX_LINKS)
    with SITE_LOCK:
        cur = site_load()
        if b.get("rev") != cur["rev"]:
            raise SiteError(409, "La page a été modifiée ailleurs. Rechargez avant d'enregistrer.")
        new = {"rev": cur["rev"] + 1, "texts": texts, "hide": hide, "overrides": overrides, "links": links, "order": order, "saved": int(time.time())}
        try:
            os.makedirs(os.path.dirname(SITE_FILE), exist_ok=True)
            if os.path.isfile(SITE_FILE):
                shutil.copyfile(SITE_FILE, SITE_FILE + ".bak")
            tmp = SITE_FILE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(new, f, ensure_ascii=False, indent=1)
            os.replace(tmp, SITE_FILE)
        except OSError as e:
            raise SiteError(500, "Écriture impossible : %s" % str(e)[:120])


# --------------------------------------------------------------------------- serveur HTTP
class H(BaseHTTPRequestHandler):
    server_version = "ll-server"

    def log_message(self, *a):
        pass

    def ip(self):
        return (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()

    def token(self):
        a = self.headers.get("Authorization", "")
        return a[7:].strip() if a.lower().startswith("bearer ") else ""

    def send_json(self, code, obj=None):
        body = b"" if obj is None else json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def body(self, limit=10_000):
        try:
            n = min(int(self.headers.get("Content-Length") or 0), limit)
            return json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return {}

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        p = u.path
        if p == "/_ll/auth/check":
            return self.send_json(204 if auth_kind(self.token()) else 401)
        if p == "/_hub/site.json":   # public : textes et éléments visibles de l'accueil
            return self.send_json(200, site_public())
        kind = auth_kind(self.token())
        if not kind:
            return self.send_json(401, {"error": "non autorisé"})
        if p == "/_ll/admin/site":
            if kind != "session":
                return self.send_json(403, {"error": "connexion par mot de passe requise"})
            return self.send_json(200, site_admin())
        if p == "/_ll/auth/me":
            return self.send_json(200, {"ok": True, "kind": kind, "passwordSet": bool(conf().get("pw"))})
        if p == "/_ll/capabilities":
            return self.send_json(200, {"web": True, "chat": True, "image": image_ready(), "image_model": "FLUX.1 schnell (Q8)", "formats": list(FORMATS)})
        m = re.fullmatch(r"/_ll/chat/([0-9a-f]{16})", p)
        if m:
            with CHATS_LOCK:
                c = CHATS.get(m.group(1))
            if not c:
                return self.send_json(404, {"error": "tâche inconnue (le service a redémarré ou elle a expiré)"})
            try:
                start = max(0, int((q.get("from") or ["0"])[0]))
                wait = max(0, min(25, float((q.get("wait") or ["0"])[0])))
            except ValueError:
                return self.send_json(400, {"error": "paramètres invalides"})
            return self.send_json(200, chat_poll(c, start, wait))
        m = re.fullmatch(r"/_ll/image/([0-9a-f]{16})(/png)?", p)
        if m:
            j = job_get(m.group(1))
            if not j:
                return self.send_json(404, {"error": "tâche inconnue"})
            if not m.group(2):
                return self.send_json(200, job_public(j))
            f = os.path.join(IMG_DIR, j["id"] + ".png")
            if j.get("state") != "done" or not os.path.isfile(f):
                return self.send_json(404, {"error": "image non disponible"})
            size = os.path.getsize(f)
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(size))
            self.send_header("Cache-Control", "private, max-age=86400")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            if self.command != "HEAD":
                with open(f, "rb") as fh:
                    shutil.copyfileobj(fh, self.wfile)
            return
        if p == "/_ll/search":
            term = (q.get("q") or [""])[0].strip()
            if not term:
                return self.send_json(400, {"error": "requête vide"})
            try:
                n = int((q.get("n") or ["6"])[0])
            except ValueError:
                n = 6
            try:
                return self.send_json(200, {"query": term, "results": search_web(term, n)})
            except Exception as e:
                return self.send_json(502, {"error": "recherche impossible : %s" % str(e)[:160]})
        if p == "/_ll/fetch":
            target = (q.get("url") or [""])[0].strip()
            try:
                return self.send_json(200, fetch_page(target))
            except Exception as e:
                return self.send_json(502, {"error": "lecture impossible : %s" % str(e)[:160]})
        self.send_json(404, {"error": "inconnu"})

    do_HEAD = do_GET

    def do_POST(self):
        p = urllib.parse.urlparse(self.path).path
        if p == "/_ll/auth/login":
            ip = self.ip()
            if locked(ip):
                return self.send_json(429, {"error": "trop d'essais, réessayez dans quelques minutes"})
            pw = str(self.body().get("password", ""))
            c = conf()
            if not c.get("pw"):
                return self.send_json(409, {"error": "aucun mot de passe défini sur le serveur (ll-auth passwd)"})
            if not check_pw(pw, c["pw"]):
                fail(ip)
                return self.send_json(401, {"error": "mot de passe incorrect"})
            _fails.pop(ip, None)
            tok = secrets.token_urlsafe(32)
            exp = int(time.time()) + SESSION_DAYS * 86400
            with LOCK:
                d = load()
                now = time.time()
                d["sessions"] = {k: v for k, v in d.get("sessions", {}).items() if v.get("exp", 0) > now}
                d["sessions"][sha(tok)] = {"exp": exp, "ip": ip, "ua": (self.headers.get("User-Agent") or "")[:80], "t": int(now)}
                save(d)
            return self.send_json(200, {"token": tok, "expires": exp})
        kind = auth_kind(self.token())
        if not kind:
            return self.send_json(401, {"error": "non autorisé"})
        if p == "/_ll/admin/site":
            if kind != "session":
                return self.send_json(403, {"error": "connexion par mot de passe requise"})
            try:
                site_save(self.body(limit=1_000_000))
            except SiteError as e:
                return self.send_json(e.code, {"error": e.msg, "field": e.field})
            return self.send_json(200, site_admin())
        if p == "/_ll/chat":
            b = self.body(limit=80_000_000)
            if not isinstance(b, dict) or not b.get("model") or not isinstance(b.get("messages"), list):
                return self.send_json(400, {"error": "requête invalide"})
            with CHATS_LOCK:
                busy = sum(1 for x in CHATS.values() if x["state"] == "run")
            if busy >= 8:
                return self.send_json(429, {"error": "trop de réponses en cours"})
            b["stream"] = True
            return self.send_json(200, {"id": chat_new(b)["id"]})
        m = re.fullmatch(r"/_ll/chat/([0-9a-f]{16})/cancel", p)
        if m:
            with CHATS_LOCK:
                c = CHATS.get(m.group(1))
            if c:
                chat_cancel(c)
            return self.send_json(200, {"ok": True})
        if p == "/_ll/image":
            if not image_ready():
                return self.send_json(503, {"error": "générateur d'images non installé sur le serveur (install-images.sh)"})
            b = self.body()
            prompt = str(b.get("prompt", "")).strip()[:1500]
            if not prompt:
                return self.send_json(400, {"error": "description vide"})
            w, h = FORMATS.get(str(b.get("format", "carre")), FORMATS["carre"])
            try:
                steps = max(1, min(20, int(b.get("steps", 8))))
                seed = int(b.get("seed")) if b.get("seed") not in (None, "") else secrets.randbelow(2 ** 31)
            except (TypeError, ValueError):
                return self.send_json(400, {"error": "paramètres invalides"})
            with JOBS_LOCK:
                busy = sum(1 for x in JOBS.values() if x["state"] in ("queued", "running"))
            if busy >= 6:
                return self.send_json(429, {"error": "trop de générations en attente"})
            return self.send_json(200, job_public(job_new(prompt, w, h, steps, seed)))
        m = re.fullmatch(r"/_ll/image/([0-9a-f]{16})/cancel", p)
        if m:
            j = job_get(m.group(1))
            if not j:
                return self.send_json(404, {"error": "tâche inconnue"})
            cancel_job(j)
            return self.send_json(200, {"ok": True})
        if p == "/_ll/auth/logout":
            with LOCK:
                d = load()
                d["sessions"].pop(sha(self.token()), None)
                save(d)
            return self.send_json(200, {"ok": True})
        if p == "/_ll/auth/logout-all":
            with LOCK:
                d = load()
                d["sessions"] = {}
                save(d)
            return self.send_json(200, {"ok": True})
        self.send_json(404, {"error": "inconnu"})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()


def serve():
    os.makedirs(IMG_DIR, exist_ok=True)
    threading.Thread(target=worker, daemon=True).start()
    srv = ThreadingHTTPServer((HOST, PORT), H)
    sys.stderr.write("ll-server sur %s:%d (conf %s)\n" % (HOST, PORT, CONF))
    srv.serve_forever()


# --------------------------------------------------------------------------- commandes d'administration
def cli(argv):
    cmd = argv[0] if argv else ""
    if cmd == "serve":
        return serve()
    d = load()
    if cmd == "init":  # init <clé> : reprend la clé existante sans écraser une configuration présente
        if d.get("key_hash"):
            print("déjà configuré")
            return
        if len(argv) < 2:
            sys.exit("usage : init <clé>")
        d["key_hash"] = sha(argv[1])
        save(d)
        print("clé d'accès enregistrée")
    elif cmd == "passwd":
        pw = os.environ.get("LL_PASSWORD") or getpass.getpass("Nouveau mot de passe : ")
        if len(pw) < 8:
            sys.exit("Trop court : 8 caractères minimum.")
        if not os.environ.get("LL_PASSWORD") and getpass.getpass("Confirmer : ") != pw:
            sys.exit("Les deux saisies ne correspondent pas.")
        d["pw"] = hash_pw(pw)
        d["sessions"] = {}  # un changement de mot de passe déconnecte tous les appareils
        save(d)
        print("Mot de passe enregistré. Les appareils connectés sont déconnectés.")
    elif cmd == "rotate-key":
        key = secrets.token_hex(24)
        d["key_hash"] = sha(key)
        d["sessions"] = {}
        save(d)
        print("Nouvelle clé d'accès (l'ancienne ne marche plus, tous les appareils sont déconnectés) :")
        print(key)
    elif cmd == "logout-all":
        d["sessions"] = {}
        save(d)
        print("Tous les appareils sont déconnectés.")
    elif cmd == "status":
        print("images       :", "prêt (FLUX.1 schnell)" if image_ready() else "non installé (install-images.sh)")
        now = time.time()
        act = [s for s in d.get("sessions", {}).values() if s.get("exp", 0) > now]
        print("clé d'accès  :", "définie" if d.get("key_hash") else "ABSENTE")
        print("mot de passe :", "défini" if d.get("pw") else "non défini (ll-auth passwd)")
        print("sessions     :", len(act))
    else:
        print(__doc__)


if __name__ == "__main__":
    cli(sys.argv[1:])
