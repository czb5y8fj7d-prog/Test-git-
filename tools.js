/* =====================================================================
   tools.js — outils que le modèle du serveur peut appeler
   (calculatrice, date/heure, documents joints, recherche web, lecture de page)
   La calculatrice n'utilise ni eval ni Function : analyseur écrit à la main.
   ===================================================================== */

/* ---------- calculatrice ---------- */
const FUNCS = {
  sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2, exp: Math.exp, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  min: Math.min, max: Math.max, pow: Math.pow,
};
const CONSTS = { pi: Math.PI, e: Math.E };

export function calc(expr) {
  const src = String(expr).toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.').replace(/\s+/g, '').replace(/\*\*/g, '^');
  if (!src) throw new Error('expression vide');
  if (src.length > 200) throw new Error('expression trop longue');
  let i = 0;
  const peek = () => src[i];
  function num() {
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length; return parseFloat(m[0]);
  }
  function primary() {
    if (peek() === '(') { i++; const v = expr0(); if (peek() !== ')') throw new Error('parenthèse manquante'); i++; return v; }
    const n = num();
    if (n !== null) return n;
    const m = /^[a-z][a-z0-9]*/.exec(src.slice(i));
    if (!m) throw new Error('caractère inattendu « ' + (peek() || 'fin') + ' »');
    i += m[0].length;
    if (peek() === '(') {
      const f = FUNCS[m[0]];
      if (!f) throw new Error('fonction inconnue : ' + m[0]);
      i++;
      const args = [expr0()];
      while (peek() === ';') { i++; args.push(expr0()); }
      if (peek() !== ')') throw new Error('parenthèse manquante');
      i++;
      return f(...args);
    }
    if (m[0] in CONSTS) return CONSTS[m[0]];
    throw new Error('inconnu : ' + m[0]);
  }
  function unary() { if (peek() === '-') { i++; return -unary(); } if (peek() === '+') { i++; return unary(); } return power(); }
  function power() {
    let b = primary();
    while (peek() === '%') { i++; b /= 100; }
    if (peek() === '^') { i++; return Math.pow(b, unary()); }
    return b;
  }
  function term() {
    let v = unary();
    for (;;) {
      if (peek() === '*') { i++; v *= unary(); }
      else if (peek() === '/') { i++; v /= unary(); }
      else if (peek() === '(' || /[a-z]/.test(peek() || '')) { v *= unary(); }   // 2(3+4), 2pi
      else return v;
    }
  }
  function expr0() {
    let v = term();
    for (;;) {
      if (peek() === '+') { i++; v += term(); }
      else if (peek() === '-') { i++; v -= term(); }
      else return v;
    }
  }
  const v = expr0();
  if (i < src.length) throw new Error('caractère inattendu « ' + src[i] + ' »');
  if (!Number.isFinite(v)) throw new Error('résultat non défini (division par zéro ?)');
  return v;
}
const fmtNum = (v) => (Number.isInteger(v) ? String(v) : String(+v.toPrecision(12)));

/* ---------- définitions (format Ollama / OpenAI) ---------- */
const def = (name, description, properties, required) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } });

export function toolDefs({ base, docs, web, image }) {
  const t = [];
  if (base) {
    t.push(def('calculatrice', 'Calcule une expression mathématique exacte (+ - * / ^ %, parenthèses, sqrt, sin, cos, ln, log, round, min, max, pi). À utiliser pour tout calcul non trivial.', { expression: { type: 'string', description: 'ex. : 12*(3+4)/5' } }, ['expression']));
    t.push(def('date_heure', 'Donne la date et l\'heure actuelles de l\'utilisateur.', {}, []));
  }
  if (docs) t.push(def('lire_document', 'Cherche dans les documents joints par l\'utilisateur et renvoie les passages pertinents.', { requete: { type: 'string', description: 'mots-clés ou question' }, nom: { type: 'string', description: 'nom du document (facultatif)' } }, ['requete']));
  if (web) {
    t.push(def('recherche_web', 'Cherche sur le web (informations récentes, faits à vérifier). Renvoie titres, adresses et extraits.', { requete: { type: 'string', description: 'termes de recherche' } }, ['requete']));
    t.push(def('lire_page', 'Télécharge une page web et renvoie son texte.', { url: { type: 'string', description: 'adresse complète https://…' } }, ['url']));
  }
  if (image) t.push(def('generer_image', 'Crée une image (FLUX). La génération dure plusieurs minutes et s\'affiche seule dans la conversation. À utiliser quand l\'utilisateur demande de dessiner, illustrer ou générer une image. Décris la scène en ANGLAIS, avec précision (sujet, décor, composition, lumière, ambiance, style).', { description: { type: 'string', description: 'description détaillée de l\'image, en anglais (60 à 120 mots)' }, format: { type: 'string', enum: ['carre', 'portrait', 'paysage'], description: 'format de l\'image (par défaut : celui des réglages)' } }, ['description']));
  return t;
}

export const TOOL_LABEL = {
  calculatrice: (a) => '🧮 ' + (a.expression || ''), date_heure: () => '🕐 date et heure',
  lire_document: (a) => '📄 ' + (a.requete || ''), recherche_web: (a) => '🌐 ' + (a.requete || ''), lire_page: (a) => '🔗 ' + (a.url || ''), generer_image: (a) => '🎨 ' + String(a.description || '').slice(0, 60),
};

/* ---------- exécution ---------- */
/* ctx : { remote:{url,key}, docs:[{name,text}], selectExcerpts, signal } → texte renvoyé au modèle */
export async function runTool(name, args, ctx) {
  args = args && typeof args === 'object' ? args : {};
  try {
    if (name === 'calculatrice') {
      const expression = String(args.expression ?? args.expr ?? '');
      return expression + ' = ' + fmtNum(calc(expression));
    }
    if (name === 'date_heure') {
      const d = new Date();
      return d.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'long' }) + ' (' + Intl.DateTimeFormat().resolvedOptions().timeZone + ')';
    }
    if (name === 'lire_document') {
      const q = String(args.requete ?? args.query ?? '');
      const pool = (ctx.docs || []).filter((d) => !args.nom || d.name.toLowerCase().includes(String(args.nom).toLowerCase()));
      if (!pool.length) return 'Aucun document joint' + (args.nom ? ' correspondant à « ' + args.nom + ' »' : '') + '.';
      return pool.map((d) => '## ' + d.name + '\n' + ctx.selectExcerpts(d.text, q, 5000).text).join('\n\n');
    }
    if (name === 'generer_image') {
      if (!ctx.startImage) return 'Erreur : génération d\'images indisponible.';
      return await ctx.startImage(args);
    }
    if (name === 'recherche_web' || name === 'lire_page') {
      const R = ctx.remote;
      if (!R) return 'Erreur : aucun serveur configuré.';
      const url = name === 'recherche_web'
        ? R.url + '/_ll/search?n=6&q=' + encodeURIComponent(String(args.requete ?? args.query ?? ''))
        : R.url + '/_ll/fetch?url=' + encodeURIComponent(String(args.url ?? ''));
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + R.key }, signal: ctx.signal });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return 'Erreur : ' + (j.error || 'HTTP ' + res.status) + (res.status === 404 ? ' (le service de recherche n\'est pas installé sur le serveur : relancer install-hub.sh)' : '');
      if (name === 'recherche_web') {
        const r = j.results || [];
        return r.length ? r.map((x, n) => (n + 1) + '. ' + x.title + '\n   ' + x.url + '\n   ' + x.snippet).join('\n') : 'Aucun résultat.';
      }
      return (j.title ? j.title + '\n' : '') + j.url + '\n\n' + j.text + (j.truncated ? '\n[…page tronquée]' : '');
    }
    return 'Outil inconnu : ' + name;
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    return 'Erreur : ' + String((e && e.message) || e).slice(0, 200);
  }
}
