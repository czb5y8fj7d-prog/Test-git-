/* =====================================================================
   LocalLM — chat LLM 100 % local dans le navigateur (version simple)
   • Moteur principal : @mlc-ai/web-llm (WebGPU)
   • Repli sans WebGPU : @wllama/wllama (GGUF, WebAssembly)
   • JavaScript vanilla, aucun build, aucun serveur, aucun tracker.
   • Réseau : uniquement le code des moteurs (CDN) et les poids du modèle
     (Hugging Face), téléchargés une fois puis gardés en cache.
   • La conversation est enregistrée dans IndexedDB, sur l'appareil.
   ===================================================================== */

import { MODELS, ENGINES } from './models.js';

/* ---------- Valeurs par défaut des réglages (modifiables dans ⚙) ---------- */
const DEFAULT_SYSTEM = 'Tu es un assistant utile, précis et concis. Tu réponds dans la langue de l\'utilisateur.';

/* =====================================================================
   1. UTILITAIRES
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMB = (b) => Math.round(b / 1048576) + ' Mo';
const fmtSize = (mb) => (mb >= 1000 ? (mb / 1000).toFixed(1).replace('.', ',') + ' Go' : mb + ' Mo');

const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignoré */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignoré */ } },
};

/* =====================================================================
   2. STOCKAGE : une conversation dans IndexedDB
   ===================================================================== */
let dbPromise = null;
function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('locallm', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('convs', { keyPath: 'id' });
        req.result.createObjectStore('personas', { keyPath: 'id' });   // conservé pour compatibilité
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}
function idb(mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('convs', mode);
    let out;
    const rq = fn(tx.objectStore('convs'));
    if (rq) rq.onsuccess = () => { out = rq.result; };
    tx.oncomplete = () => resolve(out);
    tx.onerror = tx.onabort = () => reject(tx.error);
  }));
}

let S = { modelId: null, temperature: 0.7, top_p: 0.9, max_tokens: 512, ctx: 2048, system: DEFAULT_SYSTEM, remote: null, ...ls.get('locallm.settings', {}) };
const ctxFor = (m) => Math.min(S.ctx, m.maxCtx || 4096);   // contexte effectif pour un modèle
const saveS = () => ls.set('locallm.settings', S);
const cached = new Set(ls.get('locallm.cached', []));
function setCached(id, on) { if (on) cached.add(id); else cached.delete(id); ls.set('locallm.cached', [...cached]); }

/* =====================================================================
   3. ÉTAT
   ===================================================================== */
let chat = { id: 'main', messages: [] };   // la conversation
const gen = { phase: 'idle', stick: true, stream: null, bubble: null, stopRequested: false };   // idle | loading | generating
const gpu = { ok: false, f16: false, reason: '' };
const E = { kind: null, modelId: null, ctx: 0, inst: null, ac: null };   // moteur chargé

/* Modèles hébergés sur le serveur de l'utilisateur (API compatible OpenAI, ex. Ollama).
   La liste est récupérée via « Tester et récupérer les modèles » dans les réglages. */
const remoteModels = () => {
  const R = S.remote;
  if (!R || !R.url || !R.key) return [];
  let host = R.url; try { host = new URL(R.url).host; } catch { /* ignoré */ }
  return (R.models || []).map((n) => ({
    id: 'remote:' + n, remoteName: n, name: n.replace(/:latest$/, ''), type: 'remote',
    sizeMB: 0, maxCtx: 4096, note: 'Sur votre serveur (' + host + ') · vos messages lui sont envoyés en HTTPS',
  }));
};
const allModels = () => [...MODELS, ...remoteModels()];
const modelById = (id) => allModels().find((m) => m.id === id) || null;

/* =====================================================================
   4. WEBGPU ET COMPATIBILITÉ DES MODÈLES
   ===================================================================== */
async function detectWebGPU() {
  try {
    if (!('gpu' in navigator)) throw new Error('navigator.gpu absent');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('aucun adaptateur GPU');
    gpu.ok = true;
    gpu.f16 = adapter.features.has('shader-f16');
  } catch (e) { gpu.ok = false; gpu.reason = e.message || String(e); }
}
function usable(m) {
  if (m.type === 'remote') return { ok: true };
  if (m.type === 'mlc') {
    if (!gpu.ok) return { ok: false, why: 'WebGPU requis' };
    if (!gpu.f16 && !m.mlcIdF32) return { ok: false, why: 'shader-f16 requis' };
  }
  return { ok: true };
}
const mlcIdFor = (m) => ((gpu.f16 || !m.mlcIdF32) ? m.mlcId : m.mlcIdF32);
function memFor(m) {
  if (m.type === 'remote') return 0;
  if (m.type === 'gguf') return m.sizeMB * 1.25;
  return (gpu.f16 || !m.mlcIdF32) ? m.vramMB : (m.vramMBF32 || m.vramMB * 1.3);
}
function pickDefault() {
  const list = MODELS.filter((m) => usable(m).ok);
  return list.find((m) => m.default) || list[0] || null;
}
/* Modèle plus petit à suggérer après une erreur (strict = nettement plus léger, pour la mémoire) */
function smallerModel(m, strict = false) {
  if (!m || m.type === 'remote') return null;
  let c = MODELS.filter((x) => x.id !== m.id && usable(x).ok && x.sizeMB < m.sizeMB);
  if (strict) {
    const safe = c.filter((x) => memFor(x) <= 1900 && memFor(x) <= memFor(m) * 0.75);
    if (safe.length) c = safe;
  }
  const same = c.filter((x) => x.type === m.type);
  if (same.length) c = same;
  return c.sort((a, b) => b.sizeMB - a.sizeMB)[0] || null;
}

/* =====================================================================
   5. ERREURS
   ===================================================================== */
function classify(e) {
  if (e && e.kind) return e.kind;
  const msg = String((e && e.message) || e || '');
  const name = (e && e.name) || '';
  if (/shader-f16/i.test(msg)) return 'f16';
  if (/ContextWindowSizeExceeded|context window/i.test(msg) || name === 'ContextWindowSizeExceededError') return 'ctx';
  if (/QuotaExceeded|quota/i.test(msg) || name === 'QuotaExceededError') return 'quota';
  if (/maxStorageBufferBindingSize|maxBufferSize|exceeds the maximum/i.test(msg)) return 'gpulimit';
  if (/out of memory|\bOOM\b|allocation|createBuffer|device (was )?lost|DeviceLost|Invalid array length/i.test(msg) || name === 'RangeError') return 'memory';
  if (/Load failed|Failed to fetch|NetworkError|network|ERR_|timeout|fetch/i.test(msg) || name === 'NetworkError') return 'network';
  return 'unknown';
}
const ERR_TEXT = {
  f16: () => 'Ce navigateur n\'expose pas le format f16 requis par ce modèle. Essayez un autre modèle.',
  gpulimit: () => 'Le GPU refuse un tampon aussi gros que celui demandé par ce modèle. Choisissez un modèle plus petit.',
  memory: () => 'Mémoire insuffisante pour ce modèle (Safari limite fortement la mémoire d\'un onglet). Choisissez un modèle plus petit et fermez les autres onglets et applications.',
  quota: () => 'Espace de stockage insuffisant pour ce modèle. Libérez de la place (Réglages iOS › Général › Stockage) ou choisissez un modèle plus petit.',
  network: () => 'Téléchargement interrompu ou connexion indisponible. Ce qui est déjà téléchargé est conservé : relancez pour reprendre. Restez sur l\'app au premier plan.',
  ctx: () => 'La conversation dépasse la taille de contexte. Démarrez une nouvelle conversation (＋).',
  unknown: (e) => 'Erreur : ' + String((e && e.message) || e).slice(0, 220),
  /* serveur distant */
  server: () => 'Serveur injoignable. Vérifiez la connexion, l\'adresse (https://…) et que le serveur est démarré.',
  auth: () => 'Le serveur a refusé la clé d\'accès. Vérifiez-la dans Réglages › Serveur distant.',
  remote404: () => 'Le serveur ne trouve pas ce modèle. Sur le serveur : « ollama pull <nom> », puis « Tester et récupérer les modèles » dans les réglages.',
  servererr: (e) => 'Erreur du serveur : ' + String((e && e.message) || e).slice(0, 220),
};

let noticeTimer = 0;
let pendingConfirm = null;   // résolveur d'une confirmation en cours
function hideNotice() { $('notice').hidden = true; clearTimeout(noticeTimer); }
function notice(kind, text, actions = []) {
  if (pendingConfirm) { const r = pendingConfirm; pendingConfirm = null; r(false); }   // un autre message annule la question en cours
  const n = $('notice');
  n.className = kind; n.hidden = false; n.textContent = '';
  const p = document.createElement('div'); p.textContent = text; n.append(p);
  if (actions.length) {
    const row = document.createElement('div'); row.className = 'n-actions';
    for (const a of actions) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = a.label;
      b.onclick = () => { hideNotice(); a.fn(); }; row.append(b);
    }
    n.append(row);
  }
  const x = document.createElement('button'); x.type = 'button'; x.className = 'n-close'; x.textContent = '✕';
  x.setAttribute('aria-label', 'Fermer'); x.onclick = hideNotice; n.append(x);
  clearTimeout(noticeTimer);
  if (kind === 'info') noticeTimer = setTimeout(hideNotice, 7000);
}

/* Question oui/non dans le bandeau (remplace confirm()) */
function askConfirm(text, okLabel = 'Continuer') {
  return new Promise((resolve) => {
    notice('warn', text, [
      { label: okLabel, fn: () => { pendingConfirm = null; resolve(true); } },
      { label: 'Annuler', fn: () => { pendingConfirm = null; resolve(false); } },
    ]);
    pendingConfirm = resolve;
    $('notice').querySelector('.n-close').onclick = () => { pendingConfirm = null; hideNotice(); resolve(false); };
  });
}

function selectModel(id) {
  const was = modelById(S.modelId);
  S.modelId = id; saveS(); renderModelSel();
  const m = modelById(id);
  if (m && m.type === 'remote' && !(was && was.type === 'remote')) notice('info', 'Ce modèle tourne sur votre serveur : vos messages lui sont envoyés (HTTPS).');
  if (!chat.messages.length && gen.phase === 'idle') renderChat();
}

function reportError(e, m) {
  console.error('[LocalLM]', e);
  const kind = classify(e);
  const actions = [];
  if (kind === 'network' || kind === 'unknown') actions.push({ label: 'Réessayer', fn: () => { loadModelUI(); } });
  if (kind === 'server') actions.push({ label: 'Réessayer', fn: () => { regenerate(); } });
  if (['server', 'auth', 'remote404'].includes(kind)) actions.push({ label: 'Ouvrir les réglages', fn: openSheet });
  const small = smallerModel(m, ['memory', 'gpulimit'].includes(kind));
  if (small && ['memory', 'gpulimit', 'quota', 'unknown', 'f16'].includes(kind)) {
    actions.push({ label: 'Essayer « ' + small.name + ' »', fn: () => { selectModel(small.id); loadModelUI(); } });
  }
  notice('err', (ERR_TEXT[kind] || ERR_TEXT.unknown)(e), actions);
}

/* =====================================================================
   6. MOTEURS (web-llm / wllama) derrière une interface commune
   ===================================================================== */
let webllmP = null;
let wllamaP = null;
function importWebLLM() {
  if (!webllmP) webllmP = import(ENGINES.webllm).catch((e) => {
    webllmP = null;
    throw Object.assign(new Error('Impossible de charger le moteur WebGPU (' + (e.message || e) + ')'), { kind: 'network' });
  });
  return webllmP;
}
function importWllama() {
  if (!wllamaP) wllamaP = import(ENGINES.wllama).catch((e) => {
    wllamaP = null;
    throw Object.assign(new Error('Impossible de charger le moteur WASM (' + (e.message || e) + ')'), { kind: 'network' });
  });
  return wllamaP;
}

function showProgress(on, label = '', frac = 0, sub = '') {
  $('progress').hidden = !on;
  if (!on) return;
  const f = Math.max(0, Math.min(1, frac || 0));
  $('pLabel').textContent = label;
  $('pPct').textContent = Math.round(f * 100) + ' %';
  $('pBar').style.width = (f * 100) + '%';
  $('pSub').textContent = sub;
}

/* Écran allumé pendant le téléchargement (iOS suspend la page sinon) */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* non supporté */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && gen.phase === 'loading') keepAwake(true); });

async function loadMLC(m) {
  const webllm = await importWebLLM();
  const id = mlcIdFor(m);
  let appConfig = webllm.prebuiltAppConfig;
  if (!appConfig.model_list.some((x) => x.model_id === id)) {
    if (!m.modelLib) throw new Error('Identifiant MLC inconnu dans web-llm ' + ENGINES.webllmVersion + ' : ' + id);
    appConfig = { ...appConfig, model_list: [...appConfig.model_list, { model: m.hf, model_id: id, model_lib: m.modelLib, vram_required_MB: m.vramMB, low_resource_required: true }] };
  }
  E.inst = await webllm.CreateMLCEngine(id, {
    appConfig,
    initProgressCallback: (r) => {
      const t = r.text || '';
      let label = 'Chargement du modèle';
      if (/fetch/i.test(t)) label = 'Téléchargement du modèle';
      else if (/cache/i.test(t)) label = 'Lecture depuis le cache';
      else if (/shader|gpu|compil/i.test(t)) label = 'Initialisation du GPU';
      showProgress(true, label, r.progress, t);
    },
  }, { context_window_size: ctxFor(m) });
}

async function loadGGUF(m) {
  const mod = await importWllama();
  const w = new mod.Wllama({ default: ENGINES.wllamaWasm }, { allowOffline: true, suppressNativeLog: true });
  await w.loadModelFromHF({ repo: m.hfRepo, file: m.hfFile }, {
    n_ctx: ctxFor(m),
    useCache: true,
    progressCallback: ({ loaded, total }) => {
      const frac = total ? loaded / total : 0;
      showProgress(true, frac >= 1 ? 'Initialisation du modèle' : 'Téléchargement du modèle', frac, total ? fmtMB(loaded) + ' / ' + fmtMB(total) : fmtMB(loaded));
    },
  });
  E.inst = w;
}

async function unloadEngine() {
  try { if (E.inst) { if (E.kind === 'mlc') await E.inst.unload(); else if (E.kind === 'gguf') await E.inst.exit(); } }
  catch (e) { console.warn('[LocalLM] unload', e); }
  E.inst = null; E.modelId = null; E.kind = null; E.ctx = 0;
}

/* S'assure que le modèle choisi est chargé. Le verrou gen.phase est posé par l'appelant. */
async function ensureLoaded() {
  let m = modelById(S.modelId);
  if (!m || !usable(m).ok) {
    m = pickDefault();
    if (!m) { notice('err', 'Aucun modèle utilisable sur cet appareil. Ajoutez un modèle dans models.js.'); return false; }
    selectModel(m.id);
  }
  if (E.inst && E.modelId === m.id && E.ctx === ctxFor(m)) return true;

  /* Mode démo (aperçu) : rien à télécharger */
  if (m.type === 'demo') {
    await unloadEngine();
    E.inst = { demo: true }; E.modelId = m.id; E.kind = 'demo'; E.ctx = ctxFor(m);
    return true;
  }

  /* Serveur distant : rien à télécharger ni à charger côté appareil */
  if (m.type === 'remote') {
    await unloadEngine();
    E.inst = { remote: true }; E.modelId = m.id; E.kind = 'remote'; E.ctx = ctxFor(m);
    return true;
  }

  if (!cached.has(m.id) && E.modelId !== m.id) {
    const ok = await askConfirm('Télécharger « ' + m.name + ' » (≈ ' + fmtSize(m.sizeMB) + ') ?\n\nUtilisez le Wi-Fi et gardez l\'app au premier plan. Le modèle sera ensuite conservé sur l\'appareil.', 'Télécharger');
    if (!ok) return false;
  }
  await unloadEngine();
  /* Témoin : s'il reste au prochain démarrage, Safari a tué la page (mémoire) */
  ls.set('locallm.loading', { id: m.id, t: Date.now() });
  keepAwake(true);
  showProgress(true, 'Préparation…', 0, '');
  try {
    if (m.type === 'mlc') await loadMLC(m); else await loadGGUF(m);
    E.modelId = m.id; E.kind = m.type; E.ctx = ctxFor(m);
    setCached(m.id, true);
    ls.del('locallm.loading');
    requestPersist();
    return true;
  } catch (e) {
    ls.del('locallm.loading');
    E.inst = null; E.modelId = null; E.kind = null;
    reportError(e, m);
    return false;
  } finally {
    showProgress(false);
    keepAwake(false);
  }
}

async function loadModelUI() {
  if (gen.phase !== 'idle') return false;
  gen.phase = 'loading'; setSendMode();
  try { return await ensureLoaded(); }
  finally { gen.phase = 'idle'; setSendMode(); }
}

const dget = (ch) => ch.choices && ch.choices[0] && ch.choices[0].delta && ch.choices[0].delta.content;

/* Erreur HTTP du serveur distant → erreur typée */
async function remoteHttpError(res) {
  let detail = '';
  try {
    const t = await res.text();
    try { const j = JSON.parse(t); detail = (j.error && (j.error.message || j.error)) || t; } catch { detail = t; }
  } catch { /* ignoré */ }
  detail = String(detail).slice(0, 160);
  if (res.status === 401 || res.status === 403) return Object.assign(new Error(detail), { kind: 'auth' });
  if (res.status === 404) return Object.assign(new Error(detail), { kind: 'remote404' });
  return Object.assign(new Error('HTTP ' + res.status + (detail ? ' — ' + detail : '')), { kind: 'servererr' });
}

/* Génération via un serveur compatible OpenAI (Ollama…) : flux SSE lu à la main */
async function generateRemote(m, messages, maxGen, onToken) {
  const R = S.remote || {};
  const ac = new AbortController();
  E.ac = ac;
  let n = 0, t1 = 0;
  try {
    let res;
    try {
      res = await fetch(R.url + '/v1/chat/completions', {
        method: 'POST', signal: ac.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + R.key },
        body: JSON.stringify({ model: m.remoteName, messages, stream: true, temperature: S.temperature, top_p: S.top_p, max_tokens: maxGen }),
      });
    } catch (e) {
      if (ac.signal.aborted) return { tps: null };
      throw Object.assign(new Error(String((e && e.message) || e)), { kind: 'server' });
    }
    if (!res.ok) throw await remoteHttpError(res);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          let j; try { j = JSON.parse(data); } catch { continue; }
          if (j.error) throw Object.assign(new Error(typeof j.error === 'string' ? j.error : (j.error.message || 'erreur')), { kind: 'servererr' });
          const d = dget(j);
          if (d) { if (!n) t1 = performance.now(); n++; onToken(d); }
        }
      }
    } catch (e) {
      if (ac.signal.aborted) { /* arrêt demandé */ }
      else if (e && e.kind) throw e;
      else throw Object.assign(new Error(String((e && e.message) || e)), { kind: 'server' });   // coupure en cours de route
    }
  } finally { E.ac = null; }
  const dt = (performance.now() - t1) / 1000;
  return { tps: n > 1 && dt > 0.2 ? (n - 1) / dt : null };
}

async function generate(messages, maxGen, onToken) {
  const m = modelById(E.modelId);
  const opts = { temperature: S.temperature, top_p: S.top_p, max_tokens: maxGen };
  if (E.kind === 'demo') return demoGenerate(messages, onToken);
  if (E.kind === 'remote') return generateRemote(m, messages, maxGen, onToken);
  if (E.kind === 'mlc') {
    const req = { messages, stream: true, stream_options: { include_usage: true }, ...opts };
    if (m && m.thinking === false) req.extra_body = { enable_thinking: false };
    const stream = await E.inst.chat.completions.create(req);
    let tps = null;
    for await (const chunk of stream) {
      const d = dget(chunk);
      if (d) onToken(d);
      if (chunk.usage && chunk.usage.extra && chunk.usage.extra.decode_tokens_per_s) tps = chunk.usage.extra.decode_tokens_per_s;
    }
    return { tps };
  }
  const ac = new AbortController();
  E.ac = ac;
  const t0 = performance.now();
  let n = 0;
  try {
    const stream = await E.inst.createChatCompletion({ messages, stream: true, ...opts, abortSignal: ac.signal });
    for await (const chunk of stream) { const d = dget(chunk); if (d) { n++; onToken(d); } }
  } catch (e) { if (!ac.signal.aborted) throw e; }
  finally { E.ac = null; }
  return { tps: n / Math.max(0.001, (performance.now() - t0) / 1000) };
}

/* Réponses simulées : uniquement pour l'aperçu, quand aucun vrai modèle ne peut être téléchargé */
async function demoGenerate(messages, onToken) {
  const last = messages[messages.length - 1].content;
  const text = 'Mode **démo** : aucune IA ne tourne ici, cette réponse est simulée pour montrer l\'interface.\n\n'
    + 'Vous avez écrit : « ' + last.slice(0, 120) + (last.length > 120 ? '…' : '') + ' »\n\n'
    + 'Avec un vrai modèle (Llama, Qwen…), la réponse s\'affiche mot à mot comme ici. Exemple de code :\n```js\nconsole.log(\'bonjour\');\n```';
  for (const w of text.split(/(?<=\s)/)) {
    if (gen.stopRequested) break;
    await new Promise((r) => setTimeout(r, 35));
    onToken(w);
  }
  return { tps: null };
}

function stopGeneration() {
  gen.stopRequested = true;
  try { if (E.kind === 'mlc') E.inst && E.inst.interruptGenerate(); else if (E.ac) E.ac.abort(); }
  catch (e) { console.warn('[LocalLM] stop', e); }
}

/* =====================================================================
   7. PROMPT ET TRONCATURE AUTOMATIQUE DE L'HISTORIQUE
   ===================================================================== */
const estTok = (s) => Math.ceil(String(s).length / 3) + 4;   // ≈ 3 caractères / token (estimation prudente)

function buildPrompt(history, m, maxGen, scale = 1) {
  const sys = (S.system || '').trim();
  const budget = Math.max(128, Math.floor(((E.ctx || ctxFor(m)) - maxGen - 64 - (sys ? estTok(sys) : 0)) * scale));
  const kept = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const t = estTok(history[i].content);
    if (kept.length && used + t > budget) break;
    kept.unshift(history[i]); used += t;
  }
  if (kept.length === 1 && used > budget) {
    kept[0] = { ...kept[0], content: '[…] ' + kept[0].content.slice(-Math.max(300, (budget - 8) * 3)) };
  }
  while (kept.length > 1 && kept[0].role !== 'user') kept.shift();
  const dropped = history.length - kept.length;
  const msgs = [];
  for (const k of kept) {                       // fusionne les messages consécutifs de même rôle
    const last = msgs[msgs.length - 1];
    if (last && last.role === k.role) last.content += '\n\n' + k.content;
    else msgs.push({ role: k.role, content: k.content });
  }
  if (sys) {
    if (m.noSystem && msgs.length) msgs[0] = { role: 'user', content: sys + '\n\n' + msgs[0].content };
    else msgs.unshift({ role: 'system', content: sys });
  }
  return { messages: msgs, dropped };
}

/* =====================================================================
   8. RENDU
   ===================================================================== */
function inlineMd(s) {
  return s.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/^#{1,3} (.+)$/gm, '<strong>$1</strong>');
}
/* Le texte est échappé d'abord, puis on ajoute quelques balises sûres (code, gras, bloc <think>) */
function renderMd(src) {
  let think = '';
  src = src.replace(/<think>([\s\S]*?)(<\/think>|$)/g, (_, t, close) => {
    if (t.trim()) think += '<details class="think"' + (close ? '' : ' open') + '><summary>Réflexion</summary>' + esc(t.trim()) + '</details>';
    return '';
  });
  const body = src.split('```').map((part, i) => {
    if (i % 2 === 1) { const nl = part.indexOf('\n'); return '<pre><code>' + esc((nl >= 0 ? part.slice(nl + 1) : '').replace(/\n$/, '')) + '</code></pre>'; }
    return inlineMd(esc(i > 0 ? part.replace(/^\n/, '') : part));
  }).join('');
  return think + body;
}

const chatEl = () => $('chat');
const nearBottom = () => { const c = chatEl(); return c.scrollHeight - c.scrollTop - c.clientHeight < 90; };
const scrollBottom = () => { const c = chatEl(); c.scrollTop = c.scrollHeight; };

function toolBtn(label, fn) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = () => fn(b); return b;
}
function copyText(text, btn) {
  const done = () => { const old = btn.textContent; btn.textContent = 'Copié ✓'; setTimeout(() => { btn.textContent = old; }, 1200); };
  const legacy = () => {
    const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0';
    document.body.append(t); t.select();
    try { document.execCommand('copy'); done(); } catch { /* ignoré */ }
    t.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(legacy); else legacy();
}

function renderChat() {
  const box = $('msgs');
  box.textContent = '';
  gen.bubble = null;
  if (!chat.messages.length) {
    const cur = modelById(S.modelId);
    box.innerHTML = cur && cur.type === 'remote'
      ? '<div class="empty"><h2>LocalLM</h2><p>Le modèle tourne sur <b>votre serveur</b> : vos messages lui sont envoyés (HTTPS).</p></div>'
      : '<div class="empty"><h2>LocalLM</h2><p>Le modèle tourne <b>dans votre navigateur</b> : aucune donnée n\'est envoyée à un serveur.</p></div>';
    return;
  }
  const lastIdx = chat.messages.length - 1;
  chat.messages.forEach((msg, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + msg.role;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (msg.role === 'assistant') bubble.innerHTML = renderMd(msg.content); else bubble.textContent = msg.content;
    wrap.append(bubble);
    if (gen.phase === 'generating' && i === lastIdx && msg.role === 'assistant') {
      bubble.classList.add('streaming'); gen.bubble = bubble;
    } else {
      const tools = document.createElement('div'); tools.className = 'tools';
      tools.append(toolBtn('Copier', (b) => copyText(msg.content, b)));
      if (msg.role === 'assistant' && i === lastIdx && gen.phase === 'idle') tools.append(toolBtn('↻ Régénérer', regenerate));
      if (msg.stats && msg.stats.tps) { const s = document.createElement('span'); s.textContent = msg.stats.tps.toFixed(1) + ' tok/s'; tools.append(s); }
      if (msg.stopped) { const s = document.createElement('span'); s.textContent = 'interrompu'; tools.append(s); }
      wrap.append(tools);
    }
    box.append(wrap);
  });
  scrollBottom();
}

let rafId = 0;
function scheduleStreamRender() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    if (!gen.bubble || !gen.stream) return;
    gen.bubble.innerHTML = renderMd(gen.stream.content);
    if (gen.stick) scrollBottom();
  });
}

function setSendMode() {
  const b = $('btnSend');
  b.classList.toggle('stop', gen.phase === 'generating');
  b.classList.toggle('busy', gen.phase === 'loading');
  b.textContent = gen.phase === 'generating' ? '■' : '➤';
  b.setAttribute('aria-label', gen.phase === 'generating' ? 'Arrêter' : 'Envoyer');
}

function renderModelSel() {
  const sel = $('modelSel');
  sel.textContent = '';
  for (const m of allModels()) {
    const u = usable(m);
    const o = document.createElement('option');
    o.value = m.id;
    o.disabled = !u.ok;
    o.textContent = m.name + (m.type === 'demo' ? '' : m.type === 'remote' ? ' — serveur' : ' — ' + fmtSize(m.sizeMB)) + (u.ok ? '' : ' (' + u.why + ')');
    sel.append(o);
  }
  if (S.modelId) sel.value = S.modelId;
  renderModelCards();
}

const tierOf = (m) => { const v = memFor(m); return v <= 1900 ? ['ok', 'Léger'] : v <= 2800 ? ['warn', 'Limite mémoire'] : ['err', 'Risqué']; };

/* Cartes détaillées du panneau de réglages */
function renderModelCards() {
  const box = $('modelList');
  box.textContent = '';
  const sel = modelById(S.modelId);
  const isRemote = !!(sel && sel.type === 'remote');
  $('btnLoad').hidden = isRemote; $('btnDelModel').hidden = isRemote;   // sans objet pour un modèle sur serveur
  for (const m of allModels()) {
    const u = usable(m);
    const card = document.createElement('div');
    card.className = 'model' + (m.id === S.modelId ? ' sel' : '') + (u.ok ? '' : ' off');
    card.setAttribute('role', 'button'); card.tabIndex = 0;
    const nm = document.createElement('div'); nm.className = 'm-name';
    nm.textContent = (m.id === S.modelId ? '● ' : '○ ') + m.name;
    card.append(nm);
    if (m.type !== 'demo' && m.type !== 'remote') {
      const meta = document.createElement('div'); meta.className = 'm-meta';
      meta.textContent = '≈ ' + fmtSize(m.sizeMB) + ' à télécharger · mémoire ≈ ' + fmtSize(Math.round(memFor(m)));
      card.append(meta);
    }
    if (m.note) { const n = document.createElement('div'); n.className = 'm-note'; n.textContent = m.note; card.append(n); }
    const badges = document.createElement('div'); badges.className = 'badges';
    const add = (cls, t) => { const b = document.createElement('span'); b.className = 'badge ' + cls; b.textContent = t; badges.append(b); };
    add('acc', m.type === 'mlc' ? 'WebGPU' : m.type === 'gguf' ? 'WASM (lent)' : m.type === 'remote' ? 'Serveur' : 'Simulation');
    if (m.type === 'mlc' || m.type === 'gguf') add(...tierOf(m));
    if (cached.has(m.id)) add('ok', 'en cache');
    if (E.inst && E.modelId === m.id) add('ok', 'chargé');
    if (!u.ok) add('err', u.why);
    card.append(badges);
    if (m.hf) {
      const w = document.createElement('div'); w.className = 'm-meta';
      const a = document.createElement('a'); a.href = m.hf; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Hugging Face ↗';
      a.onclick = (ev) => ev.stopPropagation();
      w.append(a); card.append(w);
    }
    const pick = () => { if (!u.ok) { notice('warn', m.name + ' : ' + u.why + ' sur cet appareil.'); return; } selectModel(m.id); };
    card.onclick = pick;
    card.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } };
    box.append(card);
  }
}

/* =====================================================================
   9. CONVERSATION : envoi, régénération, persistance
   ===================================================================== */
let saveWarned = false;
async function persist() {
  try { await idb('readwrite', (s) => s.put(chat)); }
  catch (e) {
    console.error('[LocalLM] sauvegarde', e);
    if (!saveWarned) { saveWarned = true; notice('warn', 'Impossible d\'enregistrer la conversation (stockage indisponible ou plein).'); }
  }
}

async function onSubmit() {
  if (gen.phase === 'generating') { stopGeneration(); return; }
  if (gen.phase !== 'idle') return;
  const input = $('input');
  const text = input.value.trim();
  if (!text) return;
  hideNotice();
  gen.phase = 'loading'; setSendMode();      // verrou : un second appui pendant le chargement est ignoré
  let ready = false;
  try {
    ready = await ensureLoaded();            // le texte reste dans la saisie si le chargement échoue
    if (ready) {
      input.value = ''; autosize();
      chat.messages.push({ role: 'user', content: text, ts: Date.now() });
      gen.stick = true;
      await persist();
    }
  } catch (e) { console.error('[LocalLM]', e); ready = false; }
  if (!ready) { gen.phase = 'idle'; setSendMode(); return; }
  await runGeneration();
}

async function regenerate() {
  if (gen.phase !== 'idle' || !chat.messages.length) return;
  hideNotice();
  gen.phase = 'loading'; setSendMode();
  let ready = false;
  try {
    ready = await ensureLoaded();
    if (ready) {
      if (chat.messages[chat.messages.length - 1].role === 'assistant') chat.messages.pop();
      ready = chat.messages.length > 0;
    }
  } catch (e) { console.error('[LocalLM]', e); ready = false; }
  if (!ready) { gen.phase = 'idle'; setSendMode(); renderChat(); return; }
  gen.stick = true;
  await runGeneration();
}

async function runGeneration() {
  const m = modelById(E.modelId);
  const maxGen = Math.max(32, Math.min(S.max_tokens, Math.floor(E.ctx / 2)));
  const history = chat.messages.slice();
  const msg = { role: 'assistant', content: '', ts: Date.now(), model: m.name };
  gen.phase = 'generating'; gen.stopRequested = false; gen.stream = msg;
  chat.messages.push(msg);
  setSendMode(); renderChat();

  let result = null, err = null, scale = 1;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { messages, dropped } = buildPrompt(history, m, maxGen, scale);
    if (attempt === 0 && dropped > 0) notice('info', dropped + ' ancien(s) message(s) ignoré(s) pour tenir dans le contexte.');
    try {
      msg.content = '';
      result = await generate(messages, maxGen, (d) => { msg.content += d; scheduleStreamRender(); });
      err = null; break;
    } catch (e) {
      err = e;
      if (classify(e) === 'ctx' && attempt < 2) { scale *= 0.6; continue; }   // contexte dépassé : on retente avec moins d'historique
      break;
    }
  }

  gen.phase = 'idle'; gen.stream = null; gen.bubble = null;
  if (err) {
    if (!msg.content.trim()) chat.messages.pop(); else msg.stopped = true;
    reportError(err, m);
    if (['memory', 'gpulimit'].includes(classify(err))) await unloadEngine();   // moteur peu fiable après un manque de mémoire
  } else if (!msg.content.trim()) {
    chat.messages.pop();
    notice('warn', 'Le modèle a renvoyé une réponse vide. Réessayez ou changez de modèle.');
  } else {
    msg.stats = { tps: result && result.tps };
    msg.stopped = gen.stopRequested;
  }
  await persist();
  setSendMode(); renderChat();
}

/* Nouvelle conversation (efface l'actuelle) */
async function clearChat() {
  if (gen.phase !== 'idle') return;
  if (chat.messages.length && !(await askConfirm('Effacer la conversation et en commencer une nouvelle ?', 'Effacer'))) return;
  chat.messages = [];
  hideNotice();
  await persist();
  renderChat();
  $('input').focus();
}

/* =====================================================================
   10. STOCKAGE PERSISTANT, CLAVIER iOS, SAISIE
   ===================================================================== */
async function requestPersist(manual) {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const ok = await navigator.storage.persist();
      if (manual) notice(ok ? 'info' : 'warn', ok ? 'Stockage persistant accordé.' : 'Stockage persistant refusé. Sur iPhone, ajoutez l\'app à l\'écran d\'accueil puis réessayez.');
    } else if (manual) notice('warn', 'Stockage persistant non supporté par ce navigateur.');
  } catch { /* ignoré */ }
  updateStorageInfo();
}

async function updateStorageInfo() {
  const el = $('storageInfo');
  try {
    const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
    const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
    el.textContent = (est ? 'Utilisé : ' + fmtMB(est.usage || 0) + ' sur ≈ ' + fmtMB(est.quota || 0) + '. ' : '')
      + 'Stockage persistant : ' + (persisted ? 'accordé ✓' : 'non accordé (le système peut purger le cache en cas de manque de place).');
  } catch { el.textContent = 'Informations de stockage indisponibles.'; }
}

/* Supprime du cache les fichiers du modèle sélectionné */
async function deleteModelCache() {
  const m = modelById(S.modelId);
  if (!m || m.type === 'demo' || m.type === 'remote') return;
  closeSheet();   // la question s'affiche dans le bandeau, sous le panneau sinon
  if (!(await askConfirm('Supprimer « ' + m.name + ' » du cache ? Il faudra le télécharger de nouveau.', 'Supprimer'))) return;
  try {
    if (E.modelId === m.id) await unloadEngine();
    if (m.type === 'mlc') {
      const webllm = await importWebLLM();
      for (const id of [m.mlcId, m.mlcIdF32].filter(Boolean)) { try { await webllm.deleteModelAllInfoInCache(id); } catch { /* absent */ } }
    } else {
      const mod = await importWllama();
      const w = new mod.Wllama({ default: ENGINES.wllamaWasm }, { suppressNativeLog: true });
      for (const x of await w.modelManager.getModels()) if (x.url.includes(m.hfFile)) await x.remove();
    }
    setCached(m.id, false);
    notice('info', 'Modèle supprimé du cache.');
  } catch (e) { reportError(e, m); }
  renderModelCards(); updateStorageInfo();
}

/* Supprime TOUT : conversation, réglages, modèles en cache */
async function wipeAll() {
  closeSheet();
  if (!(await askConfirm('Tout effacer ? Conversation, réglages et modèles téléchargés seront supprimés de cet appareil. Action irréversible.', 'Tout effacer'))) return;
  notice('info', 'Effacement en cours…');
  try { if (gen.phase === 'generating') stopGeneration(); await unloadEngine(); } catch { /* ignoré */ }
  try { localStorage.clear(); } catch { /* ignoré */ }
  try {
    try { (await openDB()).close(); } catch { /* ignoré */ }
    const dbs = indexedDB.databases ? await indexedDB.databases() : [{ name: 'locallm' }];
    await Promise.all(dbs.map((d) => new Promise((res) => { const r = indexedDB.deleteDatabase(d.name); r.onsuccess = r.onerror = r.onblocked = () => res(); })));
  } catch { /* ignoré */ }
  try { for (const k of await caches.keys()) if (!k.startsWith('locallm-')) await caches.delete(k); } catch { /* ignoré */ }   // modèles web-llm ; on garde le cache de l'app
  try { const root = await navigator.storage.getDirectory(); for await (const [name] of root.entries()) await root.removeEntry(name, { recursive: true }); } catch { /* OPFS absent */ }   // modèles wllama
  location.reload();
}

/* ----- panneau de réglages ----- */
/* ----- serveur distant (API compatible OpenAI : Ollama, llama.cpp…) ----- */
const remoteBase = (u) => String(u || '').trim().replace(/\/+$/, '').replace(/\/v1$/, '');
function remoteUrlOk(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' || (x.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(x.hostname));
  } catch { return false; }
}
function remoteSummary() {
  const R = S.remote;
  return R && R.url ? '✓ Configuré · ' + ((R.models || []).length ? R.models.length + ' modèle(s) : ' + R.models.join(', ') : 'aucun modèle installé') : '';
}
async function testRemote() {
  const info = $('remoteInfo'), btn = $('btnRemoteTest');
  const url = remoteBase($('rUrl').value), key = $('rKey').value.trim();
  if (!remoteUrlOk(url)) { info.textContent = 'Adresse invalide : elle doit commencer par https://'; return; }
  if (!key) { info.textContent = 'Saisissez la clé d\'accès.'; return; }
  btn.disabled = true; btn.textContent = 'Test en cours…'; info.textContent = '';
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 12000);
  try {
    let res;
    try { res = await fetch(url + '/v1/models', { headers: { Authorization: 'Bearer ' + key }, signal: ac.signal }); }
    catch { info.textContent = 'Serveur injoignable. Vérifiez l\'adresse (https://…), la connexion et que le serveur est démarré.'; return; }
    if (res.status === 401 || res.status === 403) { info.textContent = 'Clé refusée par le serveur.'; return; }
    if (!res.ok) { info.textContent = 'Le serveur a répondu « ' + res.status + ' ». Est-ce bien l\'adresse de l\'API ?'; return; }
    const j = await res.json().catch(() => null);
    const names = j && Array.isArray(j.data) ? j.data.map((x) => x && x.id).filter(Boolean) : [];
    S.remote = { url, key, models: names }; saveS();
    $('rUrl').value = url;   // adresse normalisée (sans « /v1/ » final)
    if (!names.length) { renderModelSel(); info.textContent = 'Connexion réussie, mais aucun modèle installé. Sur le serveur : ollama pull <nom>.'; return; }
    const cur = modelById(S.modelId);
    if (!cur || cur.type !== 'remote') selectModel('remote:' + names[0]); else renderModelSel();
    info.textContent = remoteSummary();
  } finally { clearTimeout(to); btn.disabled = false; btn.textContent = 'Tester et récupérer les modèles'; }
}
function clearRemote() {
  S.remote = null;
  const cur = modelById(S.modelId);
  if (!cur) { const d = pickDefault(); S.modelId = d ? d.id : null; }
  saveS();
  $('rUrl').value = ''; $('rKey').value = ''; $('remoteInfo').textContent = 'Serveur retiré.';
  renderModelSel();
  if (!chat.messages.length && gen.phase === 'idle') renderChat();
}

function syncSettingsUI() {
  $('rUrl').value = (S.remote && S.remote.url) || '';
  $('rKey').value = (S.remote && S.remote.key) || '';
  $('remoteInfo').textContent = remoteSummary();
  $('rTemp').value = S.temperature; $('vTemp').textContent = (+S.temperature).toFixed(2);
  $('rTopP').value = S.top_p; $('vTopP').textContent = (+S.top_p).toFixed(2);
  $('rMax').value = S.max_tokens; $('vMax').textContent = S.max_tokens + ' tokens';
  $('selCtx').value = String(S.ctx);
  $('sysPrompt').value = S.system;
}
function openSheet() {
  syncSettingsUI(); renderModelCards(); updateStorageInfo();
  $('scrim').hidden = false;
  $('sheet').classList.add('open'); $('sheet').setAttribute('aria-hidden', 'false');
}
function closeSheet() {
  $('sheet').classList.remove('open'); $('sheet').setAttribute('aria-hidden', 'true');
  $('scrim').hidden = true;
}

/* Le clavier iOS réduit le « visual viewport » sans réduire la page : on cale l'app dessus */
function syncViewport() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  const r = document.documentElement.style;
  r.setProperty('--vvh', h + 'px');
  r.setProperty('--vvt', (vv ? vv.offsetTop : 0) + 'px');
  document.body.classList.toggle('kb', (window.innerHeight - h) > 120);
  if (gen.stick) scrollBottom();
}
function autosize() {
  const t = $('input');
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight, 140) + 'px';
}

/* =====================================================================
   11. DÉMARRAGE
   ===================================================================== */
function bindEvents() {
  $('composer').addEventListener('submit', (e) => { e.preventDefault(); onSubmit(); });
  $('input').addEventListener('input', autosize);
  $('input').addEventListener('keydown', (e) => {   // Entrée envoie sur ordinateur ; sur écran tactile = saut de ligne
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer: fine)').matches) { e.preventDefault(); onSubmit(); }
  });
  $('input').addEventListener('focus', () => setTimeout(() => { window.scrollTo(0, 0); syncViewport(); scrollBottom(); }, 300));
  chatEl().addEventListener('scroll', () => { gen.stick = nearBottom(); }, { passive: true });
  $('btnClear').onclick = clearChat;
  $('modelSel').onchange = () => selectModel($('modelSel').value);
  $('btnSettings').onclick = openSheet;
  $('btnCloseSheet').onclick = closeSheet;
  $('scrim').onclick = closeSheet;
  $('btnLoad').onclick = () => { closeSheet(); loadModelUI(); };
  $('btnDelModel').onclick = deleteModelCache;
  $('btnRemoteTest').onclick = testRemote;
  $('btnRemoteClear').onclick = clearRemote;
  $('btnPersist').onclick = () => requestPersist(true);
  $('btnWipe').onclick = wipeAll;
  const bindRange = (id, out, key, fmt) => $(id).addEventListener('input', () => { S[key] = +$(id).value; $(out).textContent = fmt(S[key]); saveS(); });
  bindRange('rTemp', 'vTemp', 'temperature', (v) => v.toFixed(2));
  bindRange('rTopP', 'vTopP', 'top_p', (v) => v.toFixed(2));
  bindRange('rMax', 'vMax', 'max_tokens', (v) => v + ' tokens');
  $('selCtx').onchange = () => { S.ctx = +$('selCtx').value; saveS(); if (E.inst) notice('info', 'Le modèle sera rechargé avec ce contexte au prochain message.'); };
  $('sysPrompt').addEventListener('input', () => { S.system = $('sysPrompt').value; saveS(); });
  $('btnSysReset').onclick = () => { S.system = DEFAULT_SYSTEM; saveS(); $('sysPrompt').value = S.system; };
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncViewport);
    window.visualViewport.addEventListener('scroll', syncViewport);
  }
  window.addEventListener('resize', syncViewport);
  window.addEventListener('orientationchange', () => setTimeout(syncViewport, 250));
}

/* Précharge le code du moteur en tâche de fond (pour l'usage hors ligne) */
async function warmEngine() {
  if (!navigator.onLine) return;
  try {
    if (gpu.ok) await importWebLLM();
    else { await importWllama(); fetch(ENGINES.wllamaWasm).catch(() => {}); }
  } catch (e) { console.warn('[LocalLM] préchargement moteur', e); }
}

async function boot() {
  syncViewport();
  bindEvents();
  try { if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {}); } catch { /* ignoré */ }
  await detectWebGPU();

  try { chat = (await idb('readonly', (s) => s.get('main'))) || chat; }
  catch (e) { console.error('[LocalLM] IndexedDB', e); notice('warn', 'Stockage local indisponible : la conversation ne sera pas conservée.'); }

  if (!modelById(S.modelId) || !usable(modelById(S.modelId)).ok) { const d = pickDefault(); S.modelId = d ? d.id : null; saveS(); }
  renderModelSel(); renderChat(); setSendMode();

  const crashed = ls.get('locallm.loading', null);
  if (crashed) {
    ls.del('locallm.loading');
    const bad = modelById(crashed.id);
    const small = smallerModel(bad, true);
    notice('warn', 'Le dernier chargement de « ' + (bad ? bad.name : crashed.id) + ' » a fait redémarrer la page (très probablement un manque de mémoire). Essayez un modèle plus petit.',
      small ? [{ label: 'Choisir « ' + small.name + ' »', fn: () => selectModel(small.id) }] : []);
  } else if (!window.isSecureContext) {
    notice('err', 'Cette page n\'est pas en HTTPS : WebGPU et le mode hors ligne sont indisponibles.');
  } else if (!gpu.ok) {
    notice('warn', 'WebGPU indisponible (' + gpu.reason + '). Moteur WASM (GGUF) utilisé : plus lent, petits modèles recommandés.');
  } else if (!gpu.f16) {
    notice('info', 'Format f16 indisponible sur ce navigateur : les variantes q4f32 (un peu plus gourmandes) seront utilisées.');
  }

  requestPersist();
  (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => { warmEngine(); });
}

boot();
