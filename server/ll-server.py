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

    def body(self):
        try:
            n = min(int(self.headers.get("Content-Length") or 0), 10_000)
            return json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return {}

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        p = u.path
        if p == "/_ll/auth/check":
            return self.send_json(204 if auth_kind(self.token()) else 401)
        kind = auth_kind(self.token())
        if not kind:
            return self.send_json(401, {"error": "non autorisé"})
        if p == "/_ll/auth/me":
            return self.send_json(200, {"ok": True, "kind": kind, "passwordSet": bool(conf().get("pw"))})
        if p == "/_ll/capabilities":
            return self.send_json(200, {"web": True, "image": image_ready(), "image_model": "FLUX.1 schnell (Q8)", "formats": list(FORMATS)})
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
