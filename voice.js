/* =====================================================================
   voice.js — dictée (reconnaissance vocale du navigateur) et lecture à voix haute
   Sur iPhone, la dictée passe par le service de reconnaissance d'Apple (le son peut
   quitter l'appareil) ; elle fonctionne dans Safari, pas toujours en mode « écran
   d'accueil » : dans ce cas, utilisez le micro du clavier iOS.
   La lecture à voix haute est locale (voix du système).
   ===================================================================== */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const dictationSupported = !!SR;
export const speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

/* ---------- dictée ---------- */
let rec = null;
export function dictating() { return !!rec; }
export function startDictation({ lang = 'fr-FR', onText, onEnd, onError }) {
  if (!SR) { onError && onError('La dictée n\'est pas disponible dans ce navigateur.'); return; }
  stopDictation();
  const r = new SR();
  r.lang = lang; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let finalText = '';
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t; else interim += t;
    }
    onText && onText(finalText, interim);
  };
  r.onerror = (e) => {
    const m = { 'not-allowed': 'Micro refusé : autorisez-le dans les réglages du navigateur.', 'service-not-allowed': 'Dictée indisponible ici (essayez dans Safari, ou le micro du clavier).', 'no-speech': 'Aucune voix détectée.', 'audio-capture': 'Micro introuvable.', network: 'Dictée impossible sans connexion.' };
    if (e.error !== 'aborted') onError && onError(m[e.error] || 'Dictée interrompue (' + e.error + ').');
  };
  r.onend = () => { rec = null; onEnd && onEnd(); };
  rec = r;
  try { r.start(); } catch (e) { rec = null; onError && onError('Dictée impossible : ' + (e.message || e)); onEnd && onEnd(); }
}
export function stopDictation() { if (rec) { try { rec.stop(); } catch { /* ignoré */ } } }

/* ---------- lecture à voix haute ---------- */
let speaking = false, queueToken = 0;
export const isSpeaking = () => speaking;

function pickVoice(lang) {
  const vs = speechSynthesis.getVoices();
  const base = lang.slice(0, 2).toLowerCase();
  const same = vs.filter((v) => v.lang && v.lang.toLowerCase().startsWith(base));
  return same.find((v) => v.lang.toLowerCase().replace('_', '-') === lang.toLowerCase()) || same.find((v) => v.localService) || same[0] || null;
}

/* Découpe en phrases (iOS coupe les énoncés trop longs) */
function sentences(text) {
  const out = [];
  for (const part of text.split(/(?<=[.!?…])\s+|\n+/)) {
    let p = part.trim();
    while (p.length > 220) { const k = p.lastIndexOf(',', 220) > 80 ? p.lastIndexOf(',', 220) : p.lastIndexOf(' ', 220); out.push(p.slice(0, k + 1).trim()); p = p.slice(k + 1).trim(); }
    if (p) out.push(p);
  }
  return out;
}

export function speak(text, { lang = 'fr-FR', onEnd } = {}) {
  if (!speechSupported) return;
  stopSpeaking();
  const my = ++queueToken;
  const parts = sentences(text);
  if (!parts.length) { onEnd && onEnd(); return; }
  speaking = true;
  const voice = pickVoice(lang);
  let n = 0;
  const next = () => {
    if (my !== queueToken) return;
    if (n >= parts.length) { speaking = false; onEnd && onEnd(); return; }
    const u = new SpeechSynthesisUtterance(parts[n++]);
    u.lang = voice ? voice.lang : lang; if (voice) u.voice = voice;
    u.onend = next; u.onerror = () => { if (my === queueToken) { speaking = false; onEnd && onEnd(); } };
    speechSynthesis.speak(u);
  };
  next();
}
export function stopSpeaking() {
  queueToken++;
  if (speechSupported) speechSynthesis.cancel();
  speaking = false;
}
