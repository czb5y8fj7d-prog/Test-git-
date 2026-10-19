/* =====================================================================
   LL — chat LLM : 100 % local dans le navigateur, ou sur votre propre serveur
   • Moteur principal : @mlc-ai/web-llm (WebGPU)
   • Repli sans WebGPU : @wllama/wllama (GGUF, WebAssembly)
   • JavaScript vanilla, aucun build, aucun serveur, aucun tracker.
   • Réseau : uniquement le code des moteurs (CDN) et les poids du modèle
     (Hugging Face), téléchargés une fois puis gardés en cache.
   • La conversation est enregistrée dans IndexedDB, sur l'appareil.
   ===================================================================== */

import { MODELS, ENGINES } from './models.js';
import { esc, renderMd, plainText } from './md.js';
import { ACCEPT, extractText, prepareImage, isImage, selectExcerpts } from './docs.js';
import { toolDefs, runTool, TOOL_LABEL } from './tools.js';
import * as voice from './voice.js';

/* ---------- Valeurs par défaut des réglages (modifiables dans ⚙) ---------- */
const DEFAULT_SYSTEM = 'Tu es un assistant utile, précis et concis. Tu réponds dans la langue de l\'utilisateur.';

/* Rôles : un prompt système prêt à l'emploi, choisi depuis la barre au-dessus de la saisie */
const PERSONAS = [
  { id: 'general', name: '💬 Généraliste', prompt: null },
  { id: 'analyst', name: '📊 Analyste marché', prompt: 'Tu es un analyste de marché senior, spécialisé dans l\'automobile et les deux-roues (Europe, Maroc, réglementation, benchmark concurrentiel). Tu réponds en français, de façon structurée : constats chiffrés d\'abord, puis hypothèses explicites, puis implications. Tu distingues les faits établis des estimations, tu indiques les sources et les limites, et tu signales quand une donnée demande vérification.' },
  { id: 'translator', name: '🌍 Traducteur', prompt: 'Tu es un traducteur professionnel. Tu traduis fidèlement le texte de l\'utilisateur : français ↔ anglais par défaut (ou la langue demandée), en conservant le ton, le registre et la mise en forme. Tu réponds uniquement par la traduction, sauf ambiguïté importante que tu signales en une ligne.' },
  { id: 'editor', name: '✍️ Relecteur', prompt: 'Tu es un relecteur-correcteur exigeant. Tu corriges l\'orthographe, la grammaire, la ponctuation et la clarté du texte de l\'utilisateur sans en changer le sens ni la voix. Tu renvoies d\'abord le texte corrigé, puis une courte liste des changements importants.' },
  { id: 'coder', name: '💻 Codeur', prompt: 'Tu es un ingénieur logiciel senior. Tu réponds avec du code correct, simple et commenté seulement quand c\'est utile, dans des blocs de code avec le langage indiqué. Tu expliques brièvement tes choix, tu signales les cas limites et les erreurs possibles, et tu poses une question quand la demande est ambiguë.' },
  { id: 'custom', name: '⚙ Personnalisé', prompt: undefined },
];

/* =====================================================================
   1. UTILITAIRES
   ===================================================================== */
const $ = (id) => document.getElementById(id);
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

let S = { modelId: null, temperature: 0.7, top_p: 0.9, max_tokens: 512, ctx: 2048, system: DEFAULT_SYSTEM, remote: null, hideLocal: null, ctxR: 4096, think: true, persona: 'general', web: false, tools: true, visionModel: null, img: { format: 'carre', steps: 8, improve: true }, ...ls.get('locallm.settings', {}) };
const ctxFor = (m) => (m.type === 'remote' ? Math.min(S.ctxR, m.maxCtx) : Math.min(S.ctx, m.maxCtx || 4096));   // contexte effectif pour un modèle
const saveS = () => ls.set('locallm.settings', S);
if (!S.v) { if (S.remote) S.max_tokens = Math.max(S.max_tokens, 4096); S.v = 2; saveS(); }   // migration : réponses plus longues si un serveur est configuré
if (S.v < 3) { if (S.remote && !S.remote.auth) S.remote.auth = 'key'; S.v = 3; saveS(); }
const cached = new Set(ls.get('locallm.cached', []));
function setCached(id, on) { if (on) cached.add(id); else cached.delete(id); ls.set('locallm.cached', [...cached]); }

/* =====================================================================
   3. ÉTAT
   ===================================================================== */
let chat = { id: 'main', messages: [], docs: [] };   // la conversation (docs : documents joints, texte extrait)
const caps = { image: false, chat: false };   // capacités du serveur (génération d'images installée ?)
let imgMode = false;             // mode image : le message devient une image
const pending = { docs: [], images: [], busy: 0 };   // pièces jointes du message en cours de rédaction
const gen = { phase: 'idle', stick: true, stream: null, bubble: null, stopRequested: false };   // idle | loading | generating
const gpu = { ok: false, f16: false, reason: '' };
const E = { kind: null, modelId: null, ctx: 0, inst: null, ac: null };   // moteur chargé

/* Modèles hébergés sur le serveur de l'utilisateur (Ollama).
   La liste est récupérée via « Tester et récupérer les modèles » dans les réglages. */
const remoteModels = () => {
  const R = S.remote;
  if (!R || !R.url || !R.key) return [];
  let host = R.url; try { host = new URL(R.url).host; } catch { /* ignoré */ }
  return (R.models || []).map((n) => ({
    id: 'remote:' + n, remoteName: n, name: n.replace(/:latest$/, ''), type: 'remote',
    sizeMB: 0, maxCtx: 32768, vision: ((R.vision || []).includes(n)) || /vl(?=[:_.-]|$)|vision|llava|minicpm-v|gemma3|moondream/i.test(n), note: 'Sur votre serveur (' + host + ') · vos messages lui sont envoyés en HTTPS',
  }));
};
const allModels = () => [...MODELS, ...remoteModels()];
/* Option « seulement les modèles du serveur » : masque ceux qui tournent sur l'appareil */
const hideLocalOn = () => S.hideLocal === true && remoteModels().length > 0;
const visibleModels = () => (hideLocalOn() ? remoteModels() : allModels());
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
  authsession: () => 'Session expirée ou révoquée : reconnectez-vous dans Réglages › Serveur distant.',
  remotemem: () => 'Le serveur n\'a pas assez de mémoire pour ce modèle avec cette taille de contexte. Réduisez « Taille de contexte du serveur » dans les réglages, ou choisissez un modèle plus petit.',
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
  S.modelId = id; saveS(); renderModelSel(); renderToolbar(); refreshStatus();
  const m = modelById(id);
  if (m && m.type === 'remote' && !(was && was.type === 'remote')) notice('info', 'Ce modèle tourne sur votre serveur : vos messages lui sont envoyés (HTTPS).');
  if (!chat.messages.length && gen.phase === 'idle') renderChat();
}

function reportError(e, m, resume = null) {
  console.error('[LocalLM]', e);
  const kind = classify(e);
  const actions = [];
  if (kind === 'network' || kind === 'unknown') actions.push({ label: 'Réessayer', fn: () => { loadModelUI(); } });
  if (kind === 'server') actions.push(...(resume || [{ label: 'Réessayer', fn: () => { regenerate(); } }]));
  if (['server', 'auth', 'authsession', 'remote404', 'remotemem'].includes(kind)) actions.push({ label: 'Ouvrir les réglages', fn: openSheet });
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
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (gen.phase === 'loading' || gen.phase === 'generating') keepAwake(true);
  refreshStatus(); tickGens();
  const last = chat.messages[chat.messages.length - 1];
  if (gen.phase === 'idle' && last && last.interrupted) notice('warn', 'La réponse a été coupée pendant que l\'app était en arrière-plan.', [{ label: 'Reprendre', fn: continueGeneration }]);
});

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
async function ensureLoaded(forceId = null) {
  let m = modelById(forceId || S.modelId);
  if (!m || !usable(m).ok) {
    m = pickDefault();
    if (!m) { notice('err', 'Aucun modèle utilisable sur cet appareil. Ajoutez un modèle dans models.js.'); return false; }
    if (!forceId) selectModel(m.id);
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
function httpErrorFrom(status, text) {
  let detail = '';
  try { const j = JSON.parse(text); detail = (j.error && (j.error.message || j.error)) || text; } catch { detail = text; }
  detail = String(detail || '').slice(0, 200);
  const typed = (kind, msg) => Object.assign(new Error(msg), { kind, status });
  if (status === 401 || status === 403) return typed(S.remote && S.remote.auth === 'session' ? 'authsession' : 'auth', detail);
  if (status === 404) return typed('remote404', detail);
  if (/memory/i.test(detail)) return typed('remotemem', detail);
  return typed('servererr', 'HTTP ' + status + (detail ? ' — ' + detail : ''));
}
async function remoteHttpError(res) {
  let t = '';
  try { t = await res.text(); } catch { /* ignoré */ }
  return httpErrorFrom(res.status, t);
}

const noThink = new Set();   // modèles du serveur qui refusent le mode « réflexion »
const noTools = new Set();   // … ou les outils
const stripThink = (s) => String(s).replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();

/* Génération via Ollama (API native /api/chat) : fixe le contexte réel (num_ctx) et reçoit la
   réflexion à part du texte. Le flux est une suite de lignes JSON. La réflexion est insérée dans
   le message entre <think>…</think> (affichée dans un bloc repliable, retirée de l'historique).
   Renvoie { tps, toolCalls } : toolCalls = appels d'outils demandés par le modèle (le cas échéant).
   Deux voies : « tâche serveur » (la réponse continue même si l'app passe en arrière-plan) quand le
   serveur la propose, sinon flux direct. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const serverDown = (e) => Object.assign(new Error(String((e && e.message) || e)), { kind: 'server' });

/* Flux direct : lignes JSON renvoyées par Ollama */
async function* directLines(R, body, ac) {
  let res;
  try {
    res = await fetch(R.url + '/api/chat', {
      method: 'POST', signal: ac.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + R.key },
      body: JSON.stringify(body),
    });
  } catch (e) { if (ac.signal.aborted) return; throw serverDown(e); }
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
      while ((i = buf.indexOf('\n')) >= 0) { yield buf.slice(0, i); buf = buf.slice(i + 1); }
    }
  } catch (e) { if (!ac.signal.aborted) throw serverDown(e); return; }
  if (buf.trim()) yield buf;
}

/* Lecture d'une tâche du serveur par sondage long. Après une coupure (iPhone en veille, réseau),
   on réessaie et on reprend au bon décalage : rien n'est perdu ni lu deux fois. */
async function* pollLines(R, id, ac) {
  let n = 0, since = 0;
  for (;;) {
    let j;
    try {
      const res = await fetch(R.url + '/_ll/chat/' + id + '?from=' + n + '&wait=20', { headers: { Authorization: 'Bearer ' + R.key }, signal: ac.signal, cache: 'no-store' });
      if (res.status === 404 || res.status === 401 || res.status === 403) throw Object.assign(await remoteHttpError(res), { fatal: true, kind: res.status === 404 ? 'server' : undefined });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      j = await res.json();
      since = 0;
    } catch (e) {
      if (ac.signal.aborted) return;
      if (e && e.fatal) { if (e.kind === 'server') e.message = 'La réponse n\'est plus disponible sur le serveur (redémarrage ?).'; throw e; }
      since = since || Date.now();
      if (Date.now() - since > 180000) throw serverDown(e);
      await sleep(document.visibilityState === 'visible' ? 800 : 3000);
      continue;
    }
    for (const l of j.lines || []) yield l;
    n = j.next;
    if (j.state === 'http') throw httpErrorFrom((j.http && j.http.status) || 502, (j.http && j.http.body) || '');
    if (j.state === 'cut') throw serverDown(new Error('flux interrompu côté serveur'));
    if (j.state === 'done' || j.state === 'cancel') return;
  }
}

/* Crée la tâche (le serveur appelle Ollama) puis la lit. « link » reçoit l'identifiant, pour pouvoir la retrouver. */
async function* jobLines(R, body, ac, link) {
  let res;
  try {
    res = await fetch(R.url + '/_ll/chat', { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + R.key }, body: JSON.stringify(body) });
  } catch (e) { if (ac.signal.aborted) return; throw serverDown(e); }
  if (res.status === 404) { caps.chat = false; yield* directLines(R, body, ac); return; }   // serveur ancien : flux direct
  if (!res.ok) throw await remoteHttpError(res);
  const { id } = await res.json();
  link(id);
  yield* pollLines(R, id, ac);
}

/* Décodage des lignes JSON d'Ollama vers le texte du message */
function makeFeeder(onToken) {
  const st = { n: 0, t1: 0, inThink: false, tps: null, toolCalls: [] };
  const tick = () => { if (!st.n) st.t1 = performance.now(); st.n++; };
  st.feed = (line) => {
    line = String(line).trim();
    if (!line) return;
    let j; try { j = JSON.parse(line); } catch { return; }
    if (j.error) throw Object.assign(new Error(String(j.error)), { kind: /memory/i.test(String(j.error)) ? 'remotemem' : 'servererr' });
    const msg = j.message || {};
    if (msg.thinking) { if (!st.inThink) { st.inThink = true; onToken('<think>'); } tick(); onToken(msg.thinking); }
    if (msg.content) { if (st.inThink) { st.inThink = false; onToken('</think>'); } tick(); onToken(msg.content); }
    if (Array.isArray(msg.tool_calls)) for (const c of msg.tool_calls) if (c && c.function && c.function.name) st.toolCalls.push({ name: c.function.name, args: c.function.arguments });
    if (j.done && j.eval_count && j.eval_duration) st.tps = j.eval_count / (j.eval_duration / 1e9);
  };
  st.end = () => {
    if (st.inThink) { st.inThink = false; onToken('</think>'); }   // réflexion jamais suivie d'une réponse : on referme le bloc
    if (st.tps == null && st.n > 1) { const dt = (performance.now() - st.t1) / 1000; if (dt > 0.2) st.tps = (st.n - 1) / dt; }
    return { tps: st.tps, toolCalls: st.toolCalls };
  };
  return st;
}

async function generateRemote(m, messages, maxGen, onToken, tools) {
  const R = S.remote || {};
  const ac = E.ac || new AbortController();
  E.ac = ac;
  for (let attempt = 0; attempt < 3; attempt++) {
    const body = {
      model: m.remoteName, messages, stream: true, keep_alive: '30m',
      options: { temperature: S.temperature, top_p: S.top_p, num_predict: maxGen, num_ctx: E.ctx },
    };
    if (!noThink.has(m.remoteName)) body.think = S.think !== false;
    if (tools && tools.length && !noTools.has(m.remoteName)) body.tools = tools;

    const msg = gen.stream;
    const link = (id) => { if (msg) { msg.job = { id, base: msg.content.length }; persist(); } };
    const lines = caps.chat ? jobLines(R, body, ac, link) : directLines(R, body, ac);
    const fx = makeFeeder(onToken);
    try {
      for await (const line of lines) fx.feed(line);
    } catch (e) {
      if (!ac.signal.aborted) {
        if (!fx.n && e.status === 400 && /think/i.test(e.message) && 'think' in body) { noThink.add(m.remoteName); continue; }   // modèle sans mode réflexion : on réessaie sans
        if (!fx.n && e.status === 400 && /tool/i.test(e.message) && 'tools' in body) { noTools.add(m.remoteName); continue; }   // modèle sans outils
        throw e.kind ? e : serverDown(e);
      }
    }
    return fx.end();
  }
  return { tps: null };
}

/* Après un rechargement de la page (iOS a fermé l'app en arrière-plan) : on retrouve la réponse
   que le serveur a continué d'écrire et on la remet dans la conversation. */
async function resumePendingJob() {
  const msg = chat.messages[chat.messages.length - 1];
  const R = S.remote;
  if (!msg || msg.role !== 'assistant' || !msg.job || !R || gen.phase !== 'idle') return;
  const job = msg.job;
  gen.phase = 'generating'; gen.stopRequested = false; gen.stream = msg; gen.stick = true;
  const ac = new AbortController(); E.ac = ac;
  keepAwake(true); setSendMode();
  msg.content = msg.content.slice(0, job.base);
  renderChat();
  let err = null, res = null;
  const fx = makeFeeder((d) => { msg.content += d; scheduleStreamRender(); });
  try { for await (const line of pollLines(R, job.id, ac)) fx.feed(line); res = fx.end(); }
  catch (e) { err = e; }
  keepAwake(false); E.ac = null;
  gen.phase = 'idle'; gen.stream = null; gen.bubble = null;
  delete msg.job;
  if (err) {
    msg.stopped = true;
    if (stripThink(msg.content)) { msg.interrupted = true; msg.content = closeThink(msg.content); }
    else if (!(msg.steps && msg.steps.length)) chat.messages.pop();
    reportError(err, modelById(S.modelId), msg.interrupted ? [{ label: 'Reprendre', fn: continueGeneration }] : null);
  } else if (res && res.toolCalls.length) {
    msg.interrupted = true; msg.content = closeThink(msg.content);
    notice('warn', 'La réponse s\'est arrêtée sur une demande d\'outil pendant que l\'app était fermée.', [{ label: 'Reprendre', fn: continueGeneration }]);
  } else if (!msg.content.trim()) {
    chat.messages.pop();
  } else { msg.stats = { tps: res && res.tps }; }
  await persist();
  setSendMode(); renderChat(); refreshStatus();
}

async function generate(messages, maxGen, onToken, tools) {
  const m = modelById(E.modelId);
  const opts = { temperature: S.temperature, top_p: S.top_p, max_tokens: maxGen };
  if (E.kind === 'demo') return demoGenerate(messages, onToken);
  if (E.kind === 'remote') return generateRemote(m, messages, maxGen, onToken, tools);
  /* moteurs locaux : le format OpenAI n'accepte pas nos champs « images » / « tool » */
  messages = messages.filter((x) => x.role !== 'tool' && !x.tool_calls).map((x) => ({ role: x.role, content: x.content }));
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

function cancelChatJob(job) {
  const R = S.remote;
  if (job && R) { try { fetch(R.url + '/_ll/chat/' + job.id + '/cancel', { method: 'POST', headers: { Authorization: 'Bearer ' + R.key }, keepalive: true }).catch(() => {}); } catch { /* ignoré */ } }
}
function stopGeneration() {
  gen.stopRequested = true;
  if (gen.stream && gen.stream.job) cancelChatJob(gen.stream.job);
  try { if (E.kind === 'mlc') E.inst && E.inst.interruptGenerate(); else if (E.ac) E.ac.abort(); }
  catch (e) { console.warn('[LocalLM] stop', e); }
}

/* =====================================================================
   7. PROMPT ET TRONCATURE AUTOMATIQUE DE L'HISTORIQUE
   ===================================================================== */
const estTok = (s) => Math.ceil(String(s).length / 3) + 4;   // ≈ 3 caractères / token (estimation prudente)

const persona = () => PERSONAS.find((p) => p.id === S.persona) || PERSONAS[0];
function toolsActive(m) { return !!m && m.type === 'remote' && (S.tools || S.web); }
function toolList(m) {
  if (!toolsActive(m)) return [];
  return toolDefs({ base: !!S.tools, docs: !!S.tools && chat.docs.length > 0, web: !!S.web, image: caps.image && !!S.tools });
}

/* Prompt système effectif : rôle choisi + date + consignes sur les outils */
function systemText(m) {
  const p = persona();
  let t = (p.prompt === undefined ? S.system : (p.prompt || DEFAULT_SYSTEM)).trim();
  const d = new Date();
  t += '\n\nDate et heure actuelles : ' + d.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' }) + '.';
  if (toolList(m).length) t += '\nTu disposes d\'outils : utilise-les quand ils sont utiles (calcul exact, informations récentes, documents joints) et ne devine jamais un résultat que tu peux obtenir. Après un résultat d\'outil, réponds à l\'utilisateur.';
  if (toolList(m).some((x) => x.function.name === 'generer_image')) t += '\nPour créer une image, appelle generer_image avec une description détaillée en anglais ; la génération dure plusieurs minutes et l\'image s\'affiche seule : dis-le brièvement à l\'utilisateur, sans la redemander.';
  return t;
}

/* Documents joints : tout le texte s'il tient, sinon les extraits les plus proches de la question */
function docsContext(query, ctxTokens) {
  if (!chat.docs || !chat.docs.length) return '';
  let remaining = Math.max(1500, Math.floor(ctxTokens * 0.45 * 3));   // en caractères
  const order = [...chat.docs].sort((a, b) => a.text.length - b.text.length);
  const share = new Map();
  order.forEach((d, i) => { const take = Math.min(d.text.length, Math.floor(remaining / (order.length - i))); share.set(d, take); remaining -= take; });
  const parts = chat.docs.map((d) => {
    const r = selectExcerpts(d.text, query, share.get(d));
    return '### ' + d.name + (r.partial ? ' (extraits les plus pertinents)' : '') + '\n' + r.text;
  });
  return 'Documents joints par l\'utilisateur (à utiliser seulement s\'ils sont utiles à la question) :\n\n' + parts.join('\n\n');
}

/* tail : messages éphémères ajoutés à la fin (appels d'outils et leurs résultats, « continue… ») */
function buildPrompt(history, m, maxGen, scale = 1, tail = []) {
  const lastUser = [...history].reverse().find((h) => h.role === 'user');
  history = history.map((h) => (h.role === 'assistant' ? { ...h, content: stripThink(h.content) } : h)).filter((h) => h.content || (h.images && h.images.length));
  /* images : seulement celles des 2 derniers messages qui en portent (le reste coûterait trop cher) */
  let withImg = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].images && history[i].images.length) { if (++withImg > 2) history[i] = { ...history[i], images: [] }; }
  }
  let sys = systemText(m);
  const ctxTok = E.ctx || ctxFor(m);
  const dc = docsContext(lastUser ? lastUser.content : '', ctxTok);
  if (dc) sys += '\n\n' + dc;
  const tailTok = tail.reduce((n, t) => n + estTok(t.content || '') + 20, 0);
  const budget = Math.max(128, Math.floor((ctxTok - maxGen - 64 - estTok(sys) - tailTok) * scale));
  const kept = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const t = estTok(history[i].content) + ((history[i].images || []).length ? 800 : 0);
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
    const imgs = (k.images || []).length ? k.images : null;
    if (last && last.role === k.role) { last.content += '\n\n' + k.content; if (imgs) last.images = [...(last.images || []), ...imgs]; }
    else msgs.push(imgs ? { role: k.role, content: k.content, images: imgs } : { role: k.role, content: k.content });
  }
  if (sys) {
    if (m.noSystem && msgs.length) msgs[0] = { role: 'user', content: sys + '\n\n' + msgs[0].content };
    else msgs.unshift({ role: 'system', content: sys });
  }
  return { messages: [...msgs, ...tail], dropped };
}

/* =====================================================================
   8. RENDU
   ===================================================================== */
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

/* Contenu d'une bulle : le message de l'utilisateur (pièces jointes + texte) ou celui de l'assistant (outils + Markdown) */
function bubbleHTML(msg) {
  if (msg.role === 'user') {
    let h = '';
    if (msg.images && msg.images.length) h += '<div class="thumbs">' + msg.images.map((b) => '<img alt="photo jointe" src="data:image/jpeg;base64,' + b.replace(/[^A-Za-z0-9+/=]/g, '') + '">').join('') + '</div>';
    if (msg.docs && msg.docs.length) h += '<div class="fchips">' + msg.docs.map((n) => '<span>📄 ' + esc(n) + '</span>').join('') + '</div>';
    return h + '<div class="txt">' + esc(msg.content) + '</div>';
  }
  const steps = (msg.steps || []).map((st) => {
    const label = (TOOL_LABEL[st.name] ? TOOL_LABEL[st.name](st.args || {}) : st.name);
    return '<details class="tool"><summary>' + esc(label) + (st.result == null ? ' …' : '') + '</summary>' + (st.result != null ? '<pre>' + esc(st.result) + '</pre>' : '') + '</details>';
  }).join('');
  const gens = (msg.gen || []).map(genHTML).join('');
  return steps + renderMd(msg.content) + gens;
}

/* ---------- images générées par le serveur (FLUX) ---------- */
const fmtDur = (s) => { s = Math.max(0, Math.round(s)); return s >= 60 ? Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s' : s + ' s'; };
function genLabel(g) {
  if (g.state === 'queued') return '🎨 En attente' + (g.position ? ' (' + g.position + ' avant)' : '') + '…';
  const st = g.steps ? ' · étape ' + Math.min(g.step || 0, g.steps) + '/' + g.steps : '';
  return '🎨 ' + (g.phase || 'Génération') + st + ' · ' + fmtDur(g.elapsed || 0) + (g.eta ? ' · reste ≈ ' + fmtDur(g.eta) : '');
}
const genPct = (g) => (g.steps ? Math.round(100 * Math.min(g.step || 0, g.steps) / g.steps) : 0);
function genHTML(g) {
  const id = esc(g.id);
  if (g.state === 'queued' || g.state === 'running') {
    return '<div class="gen" data-id="' + id + '"><div class="gen-t">' + esc(genLabel(g)) + '</div><div class="gbar"><div style="width:' + genPct(g) + '%"></div></div><button type="button" class="gen-cancel" data-id="' + id + '">Annuler</button></div>';
  }
  if (g.state === 'done' && g.img && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(g.img)) {
    return '<figure class="genimg"><img alt="Image générée" src="' + g.img + '"><figcaption><a download="ll-image.jpg" href="' + g.img + '">Télécharger</a> · ' + g.w + '×' + g.h + ' · ' + fmtDur(g.elapsed || 0) + '<details><summary>Description utilisée</summary>' + esc(g.prompt || '') + '</details></figcaption></figure>';
  }
  return '<div class="gen err">🎨 ' + esc(g.error || 'Image indisponible.') + '</div>';
}
const imgApi = (path, opt = {}) => fetch(S.remote.url + '/_ll/image' + path, { ...opt, headers: { Authorization: 'Bearer ' + S.remote.key, 'Content-Type': 'application/json' } });

async function startImageJob(prompt, format) {
  if (!S.remote) throw new Error('Aucun serveur configuré.');
  const fmt = ['carre', 'portrait', 'paysage'].includes(format) ? format : S.img.format;
  let res;
  try { res = await imgApi('', { method: 'POST', body: JSON.stringify({ prompt, format: fmt, steps: S.img.steps }) }); }
  catch { throw Object.assign(new Error('Serveur injoignable.'), { kind: 'server' }); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Génération refusée (' + res.status + ').');
  return { ...j, format: fmt };
}
function addGen(msg, job, prompt) {
  msg.gen = msg.gen || [];
  const g = { id: job.id, state: job.state, phase: job.phase, prompt, w: job.width, h: job.height, steps: job.steps, step: 0, elapsed: 0, position: job.position || 0, img: null, error: null };
  msg.gen.push(g);
  pollGens();
  return g;
}
const activeGens = () => chat.messages.flatMap((m) => (m.gen || []).filter((g) => g.state === 'queued' || g.state === 'running'));
let genTimer = 0;
function pollGens() {
  if (genTimer || !activeGens().length) return;
  genTimer = setInterval(tickGens, 4000);
  tickGens();
}
async function toJpegDataUrl(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.92);
  } finally { URL.revokeObjectURL(url); }
}
let ticking = false;
async function tickGens() {
  if (ticking) return;
  ticking = true;
  try {
    const act = activeGens();
    if (!act.length) { clearInterval(genTimer); genTimer = 0; return; }
    let changed = false;
    for (const g of act) {
      try {
        const r = await imgApi('/' + g.id);
        if (r.status === 404) { g.state = 'error'; g.error = 'Tâche introuvable sur le serveur.'; changed = true; continue; }
        if (r.status === 401 || r.status === 403) { g.state = 'error'; g.error = 'Session expirée : reconnectez-vous dans les réglages.'; changed = true; continue; }
        const j = await r.json();
        Object.assign(g, { state: j.state, phase: j.phase, step: j.step, elapsed: j.elapsed, eta: j.eta, position: j.position, error: j.error });
        if (j.state === 'done') {
          const pr = await imgApi('/' + g.id + '/png');
          g.img = await toJpegDataUrl(await pr.blob());
        }
        if (g.state === 'done' || g.state === 'error') changed = true;
        else document.querySelectorAll('.gen[data-id="' + g.id + '"]').forEach((el) => { el.querySelector('.gen-t').textContent = genLabel(g); el.querySelector('.gbar > div').style.width = genPct(g) + '%'; });
      } catch (e) { /* réseau coupé : on réessaie au prochain passage */ }
    }
    if (changed) {
      await persist();
      if (gen.phase === 'idle') { const keep = chatEl().scrollTop; renderChat(); chatEl().scrollTop = keep; if (activeGens().length === 0) notice('info', '🎨 Image prête.'); } else scheduleStreamRender();
    }
  } finally { ticking = false; }
}

/* Mode image : l'IA enrichit la description (en anglais, détaillée) avant de la donner à FLUX */
const IMG_SYS = 'Tu transformes l\'idée de l\'utilisateur en description détaillée pour un générateur d\'images (FLUX). Écris en anglais, en un seul paragraphe de 60 à 120 mots : sujet, décor, composition, éclairage, ambiance, style (photographique ou artistique selon l\'idée), détails de matière et d\'optique. Respecte strictement le style et les éléments demandés par l\'utilisateur. Si un texte doit apparaître dans l\'image, mets-le entre guillemets. Réponds uniquement par la description.';
async function improvePrompt(idea) {
  const R = S.remote, cur = modelById(S.modelId);
  const m = cur && cur.type === 'remote' && !cur.vision ? cur : remoteModels().find((x) => !x.vision);
  if (!R || !m) return idea;
  const res = await fetch(R.url + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + R.key },
    body: JSON.stringify({ model: m.remoteName, stream: false, think: false, keep_alive: '30m', options: { temperature: 0.7, num_predict: 400, num_ctx: 4096 }, messages: [{ role: 'system', content: IMG_SYS }, { role: 'user', content: idea }] }),
  });
  if (!res.ok) return idea;
  const j = await res.json();
  const t = stripThink((j.message && j.message.content) || '').replace(/^["«\s]+|["»\s]+$/g, '');
  return t.length > 20 ? t.slice(0, 1500) : idea;
}

async function submitImage(text) {
  const input = $('input');
  hideNotice();
  gen.phase = 'loading'; setSendMode();
  input.value = ''; autosize();
  chat.messages.push({ role: 'user', content: text, ts: Date.now() });
  const msg = { role: 'assistant', content: '*Préparation de la description…*', ts: Date.now(), model: 'FLUX' };
  chat.messages.push(msg);
  gen.stick = true; renderChat();
  try {
    let prompt = text;
    if (S.img.improve) { try { prompt = await improvePrompt(text); } catch { prompt = text; } }
    const job = await startImageJob(prompt);
    msg.content = '**Description envoyée au générateur :**\n\n> ' + prompt.replace(/\n+/g, ' ');
    addGen(msg, job, prompt);
  } catch (e) {
    chat.messages.pop(); chat.messages.pop();
    input.value = text; autosize();
    notice('err', 'Image impossible : ' + String((e && e.message) || e));
  }
  gen.phase = 'idle'; setSendMode();
  await persist(); renderChat();
}

async function fetchCaps() {
  const R = S.remote;
  caps.image = false;
  if (!(R && R.url && R.key)) caps.chat = false;
  if (R && R.url && R.key) {
    try { const r = await fetch(R.url + '/_ll/capabilities', { headers: { Authorization: 'Bearer ' + R.key } }); if (r.ok) { const c = await r.json(); caps.image = !!c.image; caps.chat = !!c.chat; } else caps.chat = false; } catch { /* serveur ancien ou injoignable */ }
  }
  if (!caps.image) imgMode = false;
  renderToolbar(); renderImgSettings();
}
function renderImgSettings() {
  $('imgSettings').hidden = !caps.image;
  $('imgHint').hidden = caps.image || !S.remote;
  $('imgHint').textContent = 'Génération d\'images : non installée sur le serveur (script install-images.sh).';
  $('selImgFormat').value = S.img.format; $('selImgSteps').value = String(S.img.steps); $('chkImgImprove').checked = S.img.improve !== false;
}

let speakingIdx = -1;
function renderChat() {
  const box = $('msgs');
  box.textContent = '';
  gen.bubble = null;
  if (!chat.messages.length) {
    const cur = modelById(S.modelId);
    box.innerHTML = cur && cur.type === 'remote'
      ? '<div class="empty"><h2>LL</h2><p>Le modèle tourne sur <b>votre serveur</b> : vos messages lui sont envoyés (HTTPS).</p></div>'
      : '<div class="empty"><h2>LL</h2><p>Le modèle tourne <b>dans votre navigateur</b> : aucune donnée n\'est envoyée à un serveur.</p></div>';
    return;
  }
  const lastIdx = chat.messages.length - 1;
  chat.messages.forEach((msg, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + msg.role;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = bubbleHTML(msg);
    wrap.append(bubble);
    if (gen.phase === 'generating' && i === lastIdx && msg.role === 'assistant') {
      bubble.classList.add('streaming'); gen.bubble = bubble;
    } else {
      const tools = document.createElement('div'); tools.className = 'tools';
      tools.append(toolBtn('Copier', (b) => copyText(msg.role === 'assistant' ? stripThink(msg.content) : msg.content, b)));
      if (msg.role === 'assistant' && voice.speechSupported) {
        tools.append(toolBtn(speakingIdx === i ? '⏹ Arrêter' : '🔊 Lire', () => {
          if (speakingIdx === i) { voice.stopSpeaking(); speakingIdx = -1; renderChat(); return; }
          speakingIdx = i; renderChat();
          voice.speak(plainText(msg.content), { lang: 'fr-FR', onEnd: () => { if (speakingIdx === i) { speakingIdx = -1; renderChat(); } } });
        }));
      }
      if (msg.role === 'assistant' && i === lastIdx && gen.phase === 'idle') {
        if (msg.interrupted) tools.append(toolBtn('▶ Reprendre', continueGeneration));
        tools.append(toolBtn('↻ Régénérer', regenerate));
      }
      if (msg.stats && msg.stats.tps) { const s = document.createElement('span'); s.textContent = msg.stats.tps.toFixed(1) + ' tok/s'; tools.append(s); }
      if (msg.stopped) { const s = document.createElement('span'); s.textContent = msg.interrupted ? 'coupé' : 'interrompu'; tools.append(s); }
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
    gen.bubble.innerHTML = bubbleHTML(gen.stream);
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
  for (const m of visibleModels()) {
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
  for (const m of visibleModels()) {
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

/* ---------- pièces jointes ---------- */
function renderAttach() {
  const box = $('attach');
  box.textContent = '';
  const all = [
    ...pending.images.map((x, i) => ({ k: 'img', i, x })),
    ...pending.docs.map((x, i) => ({ k: 'doc', i, x })),
  ];
  for (let n = 0; n < pending.busy; n++) all.push({ k: 'busy' });
  box.hidden = !all.length;
  for (const a of all) {
    const el = document.createElement('div'); el.className = 'att' + (a.k === 'busy' ? ' busy' : '');
    if (a.k === 'img') {
      const im = document.createElement('img'); im.alt = ''; im.src = a.x.thumb; el.append(im);
    } else if (a.k === 'doc') el.append(Object.assign(document.createElement('span'), { textContent: '📄' }));
    const t = document.createElement('div'); t.className = 'a-name';
    if (a.k === 'busy') t.textContent = 'Lecture…';
    else { t.textContent = a.x.name; const sub = document.createElement('span'); sub.className = 'a-sub'; sub.textContent = a.k === 'img' ? 'photo' : (a.x.chars >= 1000 ? Math.round(a.x.chars / 1000) + ' k car.' : a.x.chars + ' car.') + (a.x.note ? ' · ' + a.x.note : ''); t.append(sub); }
    el.append(t);
    if (a.k !== 'busy') {
      const x = document.createElement('button'); x.type = 'button'; x.className = 'a-x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Retirer');
      x.onclick = () => { (a.k === 'img' ? pending.images : pending.docs).splice(a.i, 1); renderAttach(); };
      el.append(x);
    }
    box.append(el);
  }
}

async function addFiles(files) {
  files = [...files];
  for (const f of files) {
    if (isImage(f)) { if (pending.images.length >= 6) { notice('warn', '6 photos maximum par message.'); continue; } }
    else if (pending.docs.length >= 8) { notice('warn', '8 documents maximum par message.'); continue; }
    pending.busy++; renderAttach();
    try {
      if (isImage(f)) pending.images.push(await prepareImage(f));
      else {
        const d = await extractText(f);
        const dup = pending.docs.findIndex((x) => x.name === d.name);
        if (dup >= 0) pending.docs[dup] = d; else pending.docs.push(d);
      }
    } catch (e) { notice('err', String((e && e.message) || e), e && e.kind === 'network' ? [] : []); }
    finally { pending.busy--; renderAttach(); }
  }
}

/* Modèle à utiliser pour cette génération : un modèle « vision » si un message récent porte des photos */
function visionModel() {
  const list = remoteModels();
  return list.find((m) => m.remoteName === S.visionModel) || list.find((m) => m.vision) || null;
}
function routeModelId(history) {
  const recent = history.filter((h) => h.role === 'user').slice(-2);
  if (!recent.some((h) => h.images && h.images.length)) return null;
  const cur = modelById(S.modelId);
  if (cur && cur.type === 'remote' && cur.vision) return cur.id;
  const v = visionModel();
  return v ? v.id : false;   // false : aucune solution
}
function noVisionNotice() {
  notice('warn', 'Aucun modèle capable de lire des images n\'est disponible. Sur le serveur, installez-en un : « ollama pull qwen2.5vl:7b », puis « Se connecter et récupérer les modèles » dans les réglages. Vous pouvez aussi retirer la photo.', [{ label: 'Ouvrir les réglages', fn: openSheet }]);
}

/* ---------- envoi ---------- */
async function onSubmit() {
  if (gen.phase === 'generating') { stopGeneration(); return; }
  if (gen.phase !== 'idle') return;
  if (pending.busy) { notice('info', 'Lecture des pièces jointes en cours…'); return; }
  const input = $('input');
  let text = input.value.trim();
  const hasAtt = pending.docs.length || pending.images.length;
  if (!text && !hasAtt) return;
  if (!text) text = pending.images.length && !pending.docs.length ? 'Décris cette image.' : 'Résume ce document.';
  if (imgMode && caps.image && !hasAtt) { await submitImage(text); return; }
  hideNotice();
  const userMsg = { role: 'user', content: text, ts: Date.now() };
  if (pending.images.length) userMsg.images = pending.images.map((x) => x.b64);
  if (pending.docs.length) userMsg.docs = pending.docs.map((x) => x.name);
  const route = routeModelId([...chat.messages, userMsg]);
  if (route === false) { noVisionNotice(); return; }
  if (route && modelById(route).type !== 'remote') { noVisionNotice(); return; }
  voice.stopDictation();
  gen.phase = 'loading'; setSendMode();      // verrou : un second appui pendant le chargement est ignoré
  let ready = false;
  try {
    ready = await ensureLoaded(route || null);   // le texte reste dans la saisie si le chargement échoue
    if (ready) {
      input.value = ''; autosize();
      for (const d of pending.docs) {
        const k = chat.docs.findIndex((x) => x.name === d.name);
        const rec = { name: d.name, text: d.text, chars: d.chars };
        if (k >= 0) chat.docs[k] = rec; else chat.docs.push(rec);
      }
      pending.docs = []; pending.images = []; renderAttach();
      chat.messages.push(userMsg);
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
  const base = chat.messages.slice(0, chat.messages[chat.messages.length - 1].role === 'assistant' ? -1 : undefined);
  const route = routeModelId(base);
  if (route === false) { noVisionNotice(); return; }
  gen.phase = 'loading'; setSendMode();
  let ready = false;
  try {
    ready = await ensureLoaded(route || null);
    if (ready) {
      if (chat.messages[chat.messages.length - 1].role === 'assistant') chat.messages.pop();
      ready = chat.messages.length > 0;
    }
  } catch (e) { console.error('[LocalLM]', e); ready = false; }
  if (!ready) { gen.phase = 'idle'; setSendMode(); renderChat(); return; }
  gen.stick = true;
  await runGeneration();
}

/* Reprend une réponse coupée (réseau, veille de l'iPhone…) là où elle s'est arrêtée */
async function continueGeneration() {
  const last = chat.messages[chat.messages.length - 1];
  if (gen.phase !== 'idle' || !last || last.role !== 'assistant') return;
  if (!stripThink(last.content)) { regenerate(); return; }   // rien d'utile à prolonger : on recommence
  hideNotice();
  gen.phase = 'loading'; setSendMode();
  let ready = false;
  try { ready = await ensureLoaded(routeModelId(chat.messages.slice(0, -1)) || null); } catch (e) { console.error('[LocalLM]', e); }
  if (!ready) { gen.phase = 'idle'; setSendMode(); renderChat(); return; }
  gen.stick = true;
  await runGeneration(true);
}

const CONTINUE_PROMPT = 'Ta réponse précédente a été coupée. Continue exactement là où elle s\'est arrêtée, sans répéter ce qui précède et sans introduction.';
const closeThink = (s) => ((s.lastIndexOf('<think>') > s.lastIndexOf('</think>')) ? s + '</think>' : s);

async function runGeneration(cont = false) {
  const m = modelById(E.modelId);
  const maxGen = Math.max(32, Math.min(S.max_tokens, Math.floor(E.ctx / 2)));
  let msg;
  if (cont) { msg = chat.messages[chat.messages.length - 1]; msg.content = closeThink(msg.content); msg.interrupted = false; msg.stopped = false; }
  else { msg = { role: 'assistant', content: '', ts: Date.now(), model: m.name }; chat.messages.push(msg); }
  const history = chat.messages.filter((x) => x !== msg || cont);
  const tail0 = cont ? [{ role: 'user', content: CONTINUE_PROMPT }] : [];
  gen.phase = 'generating'; gen.stopRequested = false; gen.stream = msg;
  const tools = toolList(m);
  if (m.type === 'remote') E.ac = new AbortController();
  keepAwake(true);
  setSendMode(); renderChat();

  let result = null, err = null;
  const extra = [];   // messages éphémères : appels d'outils et résultats
  try {
    for (let round = 0; round < 6; round++) {
      let scale = 1;
      err = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { messages, dropped } = buildPrompt(history, m, maxGen, scale, [...tail0, ...extra]);
        if (round === 0 && attempt === 0 && dropped > 0) notice('info', dropped + ' ancien(s) message(s) ignoré(s) pour tenir dans le contexte.');
        try {
          const start = msg.content.length;
          result = await generate(messages, maxGen, (d) => { msg.content += d; scheduleStreamRender(); }, tools);
          result.start = start;
          err = null; break;
        } catch (e) {
          err = e;
          if (classify(e) === 'ctx' && attempt < 2) { scale *= 0.6; continue; }   // contexte dépassé : on retente avec moins d'historique
          break;
        }
      }
      if (err || gen.stopRequested || !result || !result.toolCalls || !result.toolCalls.length) break;

      /* le modèle demande des outils : on les exécute puis on le relance avec les résultats */
      extra.push({ role: 'assistant', content: stripThink(msg.content.slice(result.start)), tool_calls: result.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.args && typeof c.args === 'object' ? c.args : {} } })) });
      msg.steps = msg.steps || [];
      for (const c of result.toolCalls) {
        const step = { name: c.name, args: typeof c.args === 'object' ? c.args : {}, result: null };
        msg.steps.push(step); scheduleStreamRender();
        let out;
        try {
          out = await runTool(c.name, step.args, {
            remote: S.remote, docs: chat.docs, selectExcerpts, signal: E.ac && E.ac.signal,
            startImage: async (a) => {
              const prompt = String(a.description || a.prompt || '').trim().slice(0, 1500);
              if (!prompt) return 'Erreur : description vide.';
              const job = await startImageJob(prompt, a.format);
              addGen(msg, job, prompt);
              return 'Génération lancée (tâche ' + job.id + '). Elle prend plusieurs minutes ; l\'image s\'affichera seule dans la conversation. Préviens brièvement l\'utilisateur et n\'appelle pas l\'outil une seconde fois.';
            },
          });
        }
        catch (e) { out = 'Interrompu.'; }
        step.result = String(out).slice(0, 4000);
        extra.push({ role: 'tool', tool_name: c.name, content: String(out).slice(0, 8000) });
        scheduleStreamRender();
        if (gen.stopRequested) break;
      }
      if (gen.stopRequested) break;
      if (round === 5) notice('warn', 'Le modèle a enchaîné trop d\'appels d\'outils : arrêt.');
    }
  } finally { keepAwake(false); E.ac = null; }

  delete msg.job;
  gen.phase = 'idle'; gen.stream = null; gen.bubble = null;
  if (err) {
    const kind = classify(err);
    if (!stripThink(msg.content) && !(msg.steps && msg.steps.length) && !cont) chat.messages.pop();
    else { msg.stopped = true; if (kind === 'server' && stripThink(msg.content)) { msg.interrupted = true; msg.content = closeThink(msg.content); } }
    reportError(err, m, msg.interrupted ? [{ label: 'Reprendre', fn: continueGeneration }] : null);
    if (['memory', 'gpulimit'].includes(kind)) await unloadEngine();   // moteur peu fiable après un manque de mémoire
  } else if (!msg.content.trim() && !(msg.steps && msg.steps.length)) {
    chat.messages.pop();
    notice('warn', 'Le modèle a renvoyé une réponse vide. Réessayez ou changez de modèle.');
  } else {
    if (!stripThink(msg.content)) notice('warn', 'Le modèle a réfléchi sans arriver à répondre (longueur maximale atteinte). Augmentez « Longueur max. de réponse » dans les réglages.');
    msg.stats = { tps: result && result.tps };
    msg.stopped = gen.stopRequested;
  }
  await persist();
  setSendMode(); renderChat();
  refreshStatus();
}

/* Nouvelle conversation (efface l'actuelle) */
async function clearChat() {
  if (gen.phase !== 'idle') return;
  if ((chat.messages.length || chat.docs.length) && !(await askConfirm('Effacer la conversation et en commencer une nouvelle ?', 'Effacer'))) return;
  for (const g of activeGens()) { try { imgApi('/' + g.id + '/cancel', { method: 'POST' }); } catch { /* ignoré */ } }
  chat.messages = []; chat.docs = [];
  pending.docs = []; pending.images = []; renderAttach();
  voice.stopSpeaking(); speakingIdx = -1;
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
/* ----- serveur distant (Ollama) ----- */
const remoteBase = (u) => String(u || '').trim().replace(/\/+$/, '').replace(/\/v1$/, '');
function remoteUrlOk(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' || (x.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(x.hostname));
  } catch { return false; }
}
function remoteSummary() {
  const R = S.remote;
  return R && R.url ? '✓ Connecté (' + (R.auth === 'session' ? 'session' : 'clé d\'accès') + ') · ' + ((R.models || []).length ? R.models.length + ' modèle(s) : ' + R.models.join(', ') : 'aucun modèle installé') : '';
}

/* Connexion par mot de passe : renvoie le jeton de session, ou lève une erreur lisible */
async function loginWithPassword(url, password) {
  let res;
  try { res = await fetch(url + '/_ll/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); }
  catch { throw new Error('Serveur injoignable. Vérifiez l\'adresse (https://…) et la connexion.'); }
  const j = await res.json().catch(() => ({}));
  if (res.ok && j.token) return j.token;
  if (res.status === 401) throw new Error('Mot de passe incorrect.');
  if (res.status === 429) throw new Error('Trop d\'essais : réessayez dans quelques minutes.');
  if (res.status === 409) throw new Error('Aucun mot de passe défini sur le serveur. Sur le serveur : « ll-auth passwd ».');
  if (res.status === 404) throw new Error('Le serveur ne propose pas encore la connexion par mot de passe : relancez install-hub.sh, ou utilisez la clé d\'accès.');
  throw new Error('Connexion refusée (' + res.status + ').');
}

/* Modèles capables de lire des images (détectés via /api/show) */
async function detectVision(url, key, names) {
  const out = [];
  await Promise.all(names.map(async (n) => {
    try {
      const r = await fetch(url + '/api/show', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ model: n }) });
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j.capabilities) && j.capabilities.includes('vision')) out.push(n);
    } catch { /* ignoré */ }
  }));
  return out;
}

async function testRemote() {
  const info = $('remoteInfo'), btn = $('btnRemoteTest');
  const url = remoteBase($('rUrl').value);
  const mode = $('rAuth').value;
  if (!remoteUrlOk(url)) { info.textContent = 'Adresse invalide : elle doit commencer par https://'; return; }
  let key = '', auth = mode === 'pw' ? 'session' : 'key';
  const pw = $('rPw').value;
  if (mode === 'pw') {
    if (!pw && !(S.remote && S.remote.auth === 'session' && S.remote.url === url && S.remote.key)) { info.textContent = 'Saisissez le mot de passe.'; return; }
  } else {
    key = $('rKey').value.trim();
    if (!key) { info.textContent = 'Saisissez la clé d\'accès.'; return; }
  }
  btn.disabled = true; btn.textContent = 'Connexion…'; info.textContent = '';
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 15000);
  try {
    if (mode === 'pw') {
      if (pw) { try { key = await loginWithPassword(url, pw); } catch (e) { info.textContent = e.message; return; } $('rPw').value = ''; }
      else key = S.remote.key;
    }
    let res;
    try { res = await fetch(url + '/api/tags', { headers: { Authorization: 'Bearer ' + key }, signal: ac.signal }); }
    catch { info.textContent = 'Serveur injoignable. Vérifiez l\'adresse (https://…), la connexion et que le serveur est démarré.'; return; }
    if (res.status === 401 || res.status === 403) { info.textContent = mode === 'pw' ? 'Session refusée : saisissez de nouveau le mot de passe.' : 'Clé refusée par le serveur.'; return; }
    if (!res.ok) { info.textContent = 'Le serveur a répondu « ' + res.status + ' ». Est-ce bien l\'adresse du serveur Ollama ?'; return; }
    const j = await res.json().catch(() => null);
    const names = j && Array.isArray(j.models) ? j.models.map((x) => x && (x.name || x.model)).filter(Boolean) : [];
    S.remote = { url, key, auth, models: names, vision: [] }; saveS();
    $('rUrl').value = url;   // adresse normalisée (sans « /v1/ » final)
    if (!names.length) { renderModelSel(); syncSettingsUI(); info.textContent = 'Connexion réussie, mais aucun modèle installé. Sur le serveur : ollama pull <nom>.'; return; }
    S.remote.vision = await detectVision(url, key, names); saveS();
    if (S.hideLocal == null) { S.hideLocal = true; S.max_tokens = Math.max(S.max_tokens, 4096); saveS(); }   // 1re connexion : seulement les modèles du serveur (décochable) et réponses longues
    const cur = modelById(S.modelId);
    if (!cur || cur.type !== 'remote') selectModel('remote:' + (names.find((n) => !S.remote.vision.includes(n)) || names[0])); else renderModelSel();
    syncSettingsUI();   // met à jour curseurs et cases (longueur de réponse relevée, etc.)
    info.textContent = remoteSummary();
    refreshStatus(); fetchCaps();
  } finally { clearTimeout(to); btn.disabled = false; btn.textContent = 'Se connecter et récupérer les modèles'; }
}
function syncHideLocalUI() {
  $('chkHideLocal').checked = S.hideLocal === true;
  $('chkHideLocal').disabled = !remoteModels().length;
}
/* Appel au service du serveur (déconnexion) ; silencieux en cas d'échec */
async function serverAuthCall(path) {
  const R = S.remote;
  if (!R || !R.url || !R.key) return false;
  try { const r = await fetch(R.url + path, { method: 'POST', headers: { Authorization: 'Bearer ' + R.key } }); return r.ok; } catch { return false; }
}
async function logoutHere() {
  closeSheet();
  if (!(await askConfirm('Se déconnecter du serveur sur cet appareil ?', 'Se déconnecter'))) return;
  await serverAuthCall('/_ll/auth/logout');
  clearRemote(true);
  notice('info', 'Déconnecté.');
}
async function logoutAll() {
  closeSheet();
  if (!(await askConfirm('Déconnecter tous les appareils (celui-ci compris) ? Il faudra se reconnecter partout.', 'Tout déconnecter'))) return;
  const ok = await serverAuthCall('/_ll/auth/logout-all');
  if (!ok) { notice('err', 'Impossible de joindre le service de connexion du serveur (relancer install-hub.sh ?).'); return; }
  if (S.remote && S.remote.auth === 'session') clearRemote(true);
  notice('info', 'Tous les appareils sont déconnectés.');
}
function clearRemote(keepUrl = false) {
  const url = S.remote && S.remote.url;
  S.remote = null; S.hideLocal = null;
  const cur = modelById(S.modelId);
  if (!cur) { const d = pickDefault(); S.modelId = d ? d.id : null; }
  saveS();
  $('rUrl').value = keepUrl === true && url ? url : ''; $('rKey').value = ''; $('rPw').value = ''; $('remoteInfo').textContent = keepUrl === true ? '' : 'Serveur retiré.';
  syncHideLocalUI(); syncSettingsUI();
  renderModelSel(); refreshStatus(); fetchCaps();
  if (!chat.messages.length && gen.phase === 'idle') renderChat();
}

function syncAuthUI() {
  const mode = $('rAuth').value;
  $('authPw').hidden = mode !== 'pw'; $('authKey').hidden = mode !== 'key';
  const R = S.remote;
  const sess = !!(R && R.auth === 'session');
  $('rPw').placeholder = sess ? '•••• connecté : laissez vide' : 'Mot de passe du serveur';
  $('btnLogout').hidden = !sess; $('btnLogoutAll').hidden = !R;
}

function syncSettingsUI() {
  const R = S.remote;
  renderImgSettings();
  $('rUrl').value = (R && R.url) || '';
  $('rAuth').value = R && R.auth === 'key' ? 'key' : 'pw';
  $('rKey').value = (R && R.auth === 'key' && R.key) || '';
  syncAuthUI();
  $('remoteInfo').textContent = remoteSummary();
  syncHideLocalUI();
  $('rTemp').value = S.temperature; $('vTemp').textContent = (+S.temperature).toFixed(2);
  $('rTopP').value = S.top_p; $('vTopP').textContent = (+S.top_p).toFixed(2);
  $('rMax').value = S.max_tokens; $('vMax').textContent = S.max_tokens + ' tokens';
  $('selCtx').value = String(S.ctx);
  $('selCtxR').value = String(S.ctxR);
  $('chkThink').checked = S.think !== false;
  $('chkTools').checked = S.tools !== false;
  $('chkWeb').checked = !!S.web;
  $('sysPrompt').value = S.system;
  renderVisionSel();
  renderToolbar();
}
function renderVisionSel() {
  const sel = $('selVision'); sel.textContent = '';
  const list = remoteModels();
  const auto = document.createElement('option'); auto.value = ''; auto.textContent = 'Automatique'; sel.append(auto);
  for (const m of list) { const o = document.createElement('option'); o.value = m.remoteName; o.textContent = m.name + (m.vision ? ' (vision)' : ''); sel.append(o); }
  sel.value = S.visionModel && list.some((m) => m.remoteName === S.visionModel) ? S.visionModel : '';
  const v = visionModel();
  $('visionHint').textContent = !list.length ? 'Disponible avec un serveur configuré.' : v ? 'Les photos seront lues par « ' + v.name + ' ».' : 'Aucun modèle de vision sur le serveur. Pour en installer un : « ollama pull qwen2.5vl:7b », puis reconnectez-vous ici.';
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

/* ----- barre d'outils : rôle, réflexion, web, état du serveur ----- */
function renderToolbar() {
  const sel = $('personaSel');
  if (!sel.options.length) for (const p of PERSONAS) { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; sel.append(o); }
  sel.value = persona().id;
  const cur = modelById(S.modelId);
  const remote = !!(cur && cur.type === 'remote');
  $('chipThink').hidden = !remote; $('chipWeb').hidden = !remote;
  $('chipImg').hidden = !(remote && caps.image); $('chipImg').setAttribute('aria-pressed', String(imgMode));
  $('input').placeholder = imgMode ? 'Décrivez l\'image à créer…' : 'Écrire un message…';
  $('chipThink').setAttribute('aria-pressed', String(S.think !== false));
  $('chipWeb').setAttribute('aria-pressed', String(!!S.web));
  if (!remote) $('srvStatus').hidden = true;
}

let statusSeq = 0;
const sameModel = (a, b) => String(a).replace(/:latest$/, '') === String(b).replace(/:latest$/, '');
async function refreshStatus() {
  const cur = modelById(S.modelId), el = $('srvStatus'), R = S.remote;
  if (!cur || cur.type !== 'remote' || !R) { el.hidden = true; return; }
  const my = ++statusSeq;
  try {
    const r = await fetch(R.url + '/api/ps', { headers: { Authorization: 'Bearer ' + R.key } });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (my !== statusSeq) return;
    const loaded = (j.models || []).some((x) => sameModel(x.name || x.model, cur.remoteName));
    el.hidden = false; el.disabled = false;
    el.className = 'chip status ' + (loaded ? 'ok' : 'cold');
    el.textContent = loaded ? '● prêt' : '○ à froid';
    el.title = loaded ? 'Modèle chargé en mémoire sur le serveur' : 'Modèle non chargé : le premier message sera plus lent. Toucher pour le précharger.';
    el.dataset.loaded = loaded ? '1' : '';
  } catch { if (my === statusSeq) { el.hidden = false; el.className = 'chip status cold'; el.textContent = '⚠ injoignable'; el.dataset.loaded = ''; } }
}
async function preloadModel() {
  const cur = modelById(S.modelId), R = S.remote, el = $('srvStatus');
  if (!cur || cur.type !== 'remote' || !R || el.dataset.loaded) { refreshStatus(); return; }
  el.disabled = true; el.textContent = '… chargement';
  try {
    await fetch(R.url + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + R.key }, body: JSON.stringify({ model: cur.remoteName, prompt: '', keep_alive: '30m', options: { num_ctx: ctxFor(cur) } }) });
  } catch { /* ignoré */ }
  refreshStatus();
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
  $('btnRemoteClear').onclick = () => clearRemote();
  $('rAuth').onchange = syncAuthUI;
  $('btnLogout').onclick = logoutHere;
  $('btnLogoutAll').onclick = logoutAll;
  $('personaSel').onchange = () => { S.persona = $('personaSel').value; saveS(); if (S.persona === 'custom') notice('info', 'Rôle personnalisé : modifiez son texte dans ⚙ › Prompt système personnalisé.', [{ label: 'Ouvrir', fn: openSheet }]); };
  $('chipThink').onclick = () => { S.think = !(S.think !== false); saveS(); renderToolbar(); $('chkThink').checked = S.think; };
  $('chipWeb').onclick = () => {
    S.web = !S.web; saveS(); renderToolbar(); $('chkWeb').checked = S.web;
    if (S.web) notice('info', 'Recherche web activée : le modèle peut faire chercher le serveur sur Internet (les termes recherchés quittent votre serveur).');
  };
  $('chipImg').onclick = () => { imgMode = !imgMode; renderToolbar(); if (imgMode) notice('info', 'Mode image : votre prochain message devient une image (plusieurs minutes de calcul). Touchez 🎨 de nouveau pour revenir au chat.'); };
  $('selImgFormat').onchange = () => { S.img.format = $('selImgFormat').value; saveS(); };
  $('selImgSteps').onchange = () => { S.img.steps = +$('selImgSteps').value; saveS(); };
  $('chkImgImprove').onchange = () => { S.img.improve = $('chkImgImprove').checked; saveS(); };
  $('chkTools').onchange = () => { S.tools = $('chkTools').checked; saveS(); };
  $('chkWeb').onchange = () => { S.web = $('chkWeb').checked; saveS(); renderToolbar(); };
  $('selVision').onchange = () => { S.visionModel = $('selVision').value || null; saveS(); renderVisionSel(); };
  $('srvStatus').onclick = preloadModel;
  $('btnAttach').onclick = () => $('fileIn').click();
  $('fileIn').accept = ACCEPT;
  $('fileIn').onchange = () => { const f = [...$('fileIn').files]; $('fileIn').value = ''; addFiles(f); };
  $('input').addEventListener('paste', (e) => { const f = [...((e.clipboardData && e.clipboardData.files) || [])]; if (f.length) { e.preventDefault(); addFiles(f); } });
  const dz = $('app');
  dz.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  dz.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } });
  $('msgs').addEventListener('click', (e) => {
    const cb = e.target.closest && e.target.closest('.gen-cancel');
    if (cb) { imgApi('/' + cb.dataset.id + '/cancel', { method: 'POST' }).catch(() => {}); cb.disabled = true; cb.textContent = 'Annulation…'; return; }
    const b = e.target.closest && e.target.closest('.copy-code');
    if (b) copyText(b.closest('.code').querySelector('code').textContent, b);
  });
  if (voice.dictationSupported) {
    $('btnMic').hidden = false;
    $('btnMic').onclick = () => {
      if (voice.dictating()) { voice.stopDictation(); return; }
      const base = $('input').value ? $('input').value.replace(/\s*$/, ' ') : '';
      $('btnMic').classList.add('on');
      voice.startDictation({
        lang: 'fr-FR',
        onText: (fin, interim) => { $('input').value = base + fin + interim; autosize(); },
        onEnd: () => { $('btnMic').classList.remove('on'); },
        onError: (m) => notice('warn', m),
      });
    };
  }
  $('selCtxR').onchange = () => { S.ctxR = +$('selCtxR').value; saveS(); };
  $('chkThink').onchange = () => { S.think = $('chkThink').checked; saveS(); renderToolbar(); };
  $('chkHideLocal').onchange = () => {
    S.hideLocal = $('chkHideLocal').checked; saveS();
    const cur = modelById(S.modelId), first = remoteModels()[0];
    if (hideLocalOn() && first && (!cur || cur.type !== 'remote')) selectModel(first.id); else renderModelSel();
  };
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
  if (!navigator.onLine || hideLocalOn()) return;   // inutile si seuls les modèles du serveur sont utilisés
  try {
    if (gpu.ok) await importWebLLM();
    else { await importWllama(); fetch(ENGINES.wllamaWasm).catch(() => {}); }
  } catch (e) { console.warn('[LocalLM] préchargement moteur', e); }
}

async function boot() {
  syncViewport();
  bindEvents();
  try {
    if ('serviceWorker' in navigator) {
      const had = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('./sw.js').catch(() => {});
      navigator.serviceWorker.addEventListener('controllerchange', () => {   // nouvelle version de l'app installée
        if (had && gen.phase === 'idle') notice('info', 'LL a été mis à jour.', [{ label: 'Recharger', fn: () => location.reload() }]);
      });
    }
  } catch { /* ignoré */ }
  await detectWebGPU();

  try { chat = (await idb('readonly', (s) => s.get('main'))) || chat; chat.docs = chat.docs || []; }
  catch (e) { console.error('[LocalLM] IndexedDB', e); notice('warn', 'Stockage local indisponible : la conversation ne sera pas conservée.'); }

  if (hideLocalOn() && !(modelById(S.modelId) || {}).type?.startsWith('remote')) { S.modelId = remoteModels()[0].id; saveS(); }
  if (!modelById(S.modelId) || !usable(modelById(S.modelId)).ok) { const d = pickDefault(); S.modelId = d ? d.id : null; saveS(); }
  renderModelSel(); renderToolbar(); renderChat(); setSendMode(); refreshStatus(); fetchCaps().then(() => resumePendingJob()); pollGens();
  setInterval(() => { if (document.visibilityState === 'visible' && gen.phase === 'idle') refreshStatus(); }, 60000);

  const crashed = ls.get('locallm.loading', null);
  if (crashed) {
    ls.del('locallm.loading');
    const bad = modelById(crashed.id);
    const small = smallerModel(bad, true);
    notice('warn', 'Le dernier chargement de « ' + (bad ? bad.name : crashed.id) + ' » a fait redémarrer la page (très probablement un manque de mémoire). Essayez un modèle plus petit.',
      small ? [{ label: 'Choisir « ' + small.name + ' »', fn: () => selectModel(small.id) }] : []);
  } else if (!window.isSecureContext) {
    notice('err', 'Cette page n\'est pas en HTTPS : WebGPU et le mode hors ligne sont indisponibles.');
  } else if (!gpu.ok && !hideLocalOn()) {
    notice('warn', 'WebGPU indisponible (' + gpu.reason + '). Moteur WASM (GGUF) utilisé : plus lent, petits modèles recommandés.');
  } else if (!gpu.f16 && !hideLocalOn()) {
    notice('info', 'Format f16 indisponible sur ce navigateur : les variantes q4f32 (un peu plus gourmandes) seront utilisées.');
  }

  /* Astuce unique : sur iPhone, l'app installée sur l'écran d'accueil garde mieux ses données */
  if (!crashed && /iPhone|iPad/.test(navigator.userAgent) && navigator.standalone === false && !ls.get('locallm.a2hs', false)) {
    ls.set('locallm.a2hs', true);
    notice('info', 'Astuce : Partager › « Sur l\'écran d\'accueil » pour utiliser LL comme une vraie app (plein écran, données mieux conservées).');
  }
  requestPersist();
  (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => { warmEngine(); });
}

boot();
