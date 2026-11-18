/* =============================================================================
   TYCOON ENGINE — core.js
   Noyau SANS DOM : utilitaires, aléatoire reproductible, calendrier, formats,
   état de partie, finances, marché, événements, rivales IA, objectifs, sauvegardes.
   Extrait de « Plan de Vol » : tout ce qui n'est pas propre à l'aérien.
   Un jeu = un objet de définition (voir ENGINE.md) passé à TE.define().
   ============================================================================= */
(function (root) {
'use strict';
const TE = root.TE = root.TE || {};
TE.GAMES = TE.GAMES || {};          // registre des jeux (pour les tests et les sélecteurs)

/* ---------- Utilitaires ---------- */
TE.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
TE.sum = a => a.reduce((s, x) => s + x, 0);
TE.key = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
TE.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
TE.norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
TE.nf = (n, d) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
TE.pct = (v, d) => TE.nf(v * 100, d == null ? 0 : d) + ' %';
TE.plur = (n, w) => n + ' ' + w + (n > 1 ? 's' : '');

/* Argent : « 12,5 M€ », « 340 k€ ». Le symbole se règle par jeu (def.currency). */
TE.money = function (n) {
  const cur = (TE.def && TE.def.currency) || '€', a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return s + TE.nf(a / 1e9, 2) + ' G' + cur;
  if (a >= 1e6) return s + TE.nf(a / 1e6, a >= 1e8 ? 0 : 2) + ' M' + cur;
  if (a >= 1e3) return s + TE.nf(a / 1e3) + ' k' + cur;
  return s + TE.nf(a) + ' ' + cur;
};
TE.signed = n => (n > 0 ? '+' : '') + TE.money(n);
TE.cls = n => (n < 0 ? 'neg' : 'pos');

/* ---------- Aléatoire reproductible (mulberry32, graine stockée dans G.seed) ---------- */
TE.rng = function () {
  const G = TE.G;
  G.seed = (G.seed + 0x6D2B79F5) | 0;
  let t = G.seed;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
TE.rand = (a, b) => a + TE.rng() * (b - a);
TE.randInt = (a, b) => Math.floor(TE.rand(a, b + 1));
TE.pick = arr => arr[Math.floor(TE.rng() * arr.length)];
/* Tirage pondéré : items = [{w:2, ...}, ...] */
TE.pickW = function (items) {
  let tot = 0; for (const i of items) tot += i.w == null ? 1 : i.w;
  let x = TE.rng() * tot;
  for (const i of items) { x -= i.w == null ? 1 : i.w; if (x <= 0) return i; }
  return items[items.length - 1];
};

/* ---------- Calendrier ----------
   Le temps est un compteur de ticks (G.day). Par défaut 1 tick = 1 jour, 30 jours/mois, 12 mois/an. */
TE.cal = function () {
  const dc = TE.def && TE.def.calendar, c = (typeof dc === 'function' ? dc(TE.G) : dc) || {};
  return Object.assign({
    ticksPerMonth: 30, monthsPerYear: 12, startYear: 2027,
    months: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  }, c);
};
TE.dateParts = function (day) {
  const c = TE.cal(), tpy = c.ticksPerMonth * c.monthsPerYear;
  return { d: day % c.ticksPerMonth + 1, m: Math.floor(day / c.ticksPerMonth) % c.monthsPerYear, y: c.startYear + Math.floor(day / tpy), yi: Math.floor(day / tpy) };
};
TE.dateStr = function (day) { const p = TE.dateParts(day), c = TE.cal(); return p.d + ' ' + c.months[p.m] + ' ' + p.y; };
TE.shortDate = function (day) { const p = TE.dateParts(day), c = TE.cal(); return p.d + ' ' + c.months[p.m]; };
TE.monthStr = function (day) { const p = TE.dateParts(day), c = TE.cal(); return c.months[p.m] + ' ' + p.y; };

/* ---------- Définition d'un jeu ---------- */
TE.define = function (def) {
  TE.def = def;
  def.save = def.save || def.id || 'tycoon';
  def.version = def.version || 1;
  def.credit = Object.assign({ base: 0, earnMult: 6, assetsMult: 0.6, minLimit: 0, rates: [0.04, 0.05, 0.065, 0.085, 0.11], graceDays: 60, bankruptFloor: -8e6 }, def.credit || {});
  def.speeds = def.speeds || [0, 1 / 3, 1, 3];
  return def;
};

/* ---------- Registre d'acteurs ---------- */
TE.player = () => TE.G.actors[0];
TE.alive = () => TE.G.actors.filter(a => !a.bankrupt);
TE.rivals = () => TE.G.actors.filter(a => !a.player && !a.bankrupt);
TE.byId = id => TE.G.actors[id];

/* Un acteur = le joueur ou une rivale. Champs génériques ; le jeu ajoute les siens librement
   (tout doit rester sérialisable : nombres, chaînes, tableaux, objets simples). */
TE.newMonth = () => ({ in: {}, out: {}, vol: 0 });
TE.mkActor = function (o) {
  const G = TE.G;
  const a = Object.assign({
    id: G.actors.length, name: 'Acteur', color: '#2456a6', player: false, profile: null,
    cash: 0, debt: 0, rep: 50, bankrupt: false, negDays: 0,
    m: TE.newMonth(), last: null, hist: [], revH: [], cashH: [], shareH: [], share: 0, vol: 0
  }, o || {});
  G.actors.push(a);
  return a;
};

/* ---------- Grand livre mensuel ----------
   TE.earn(a,'billets',1200)  → encaisse (cash + recette de la catégorie)
   TE.spend(a,'salaires',800) → décaisse
   En fin de mois, a.last = ce grand livre ; l'UI standard affiche le compte de résultat. */
TE.earn = function (a, cat, v) { if (!v) return; a.cash += v; a.m.in[cat] = (a.m.in[cat] || 0) + v; };
TE.spend = function (a, cat, v) { if (!v) return; a.cash -= v; a.m.out[cat] = (a.m.out[cat] || 0) + v; };
TE.revenue = m => TE.sum(Object.values(m.in));
TE.costs = m => TE.sum(Object.values(m.out));
TE.profit = m => TE.revenue(m) - TE.costs(m);
/* Charge non cash (amortissement) : réduit le résultat sans toucher la trésorerie */
TE.accrue = function (a, cat, v) { if (!v) return; a.m.out[cat] = (a.m.out[cat] || 0) + v; a.m.noncash = (a.m.noncash || 0) + v; };

/* ---------- Crédit, notation, emprunts ---------- */
TE.assets = a => (TE.def.assets ? TE.def.assets(a) : 0);       // valeur des actifs (le jeu la fournit)
TE.annualProfit = function (a) { const h = a.hist.slice(-12); return h.length ? TE.sum(h) / h.length * 12 : 0; };
TE.creditLimit = function (a) {
  const C = TE.def.credit, earn = Math.max(0, TE.annualProfit(a)) * C.earnMult * 0.25;
  return Math.max(C.minLimit, C.base + TE.assets(a) * C.assetsMult + earn);
};
TE.RATINGS = ['AA', 'A', 'BBB', 'BB', 'B'];
TE.rating = function (a) {
  const L = a.debt / Math.max(1, TE.creditLimit(a)), h = a.hist.slice(-6);
  let i = L < 0.2 ? 0 : L < 0.4 ? 1 : L < 0.6 ? 2 : L < 0.8 ? 3 : 4;
  if (h.length >= 3 && h.slice(-3).every(x => x < 0)) i = Math.min(4, i + 1);
  return i;
};
TE.loanRate = a => TE.def.credit.rates[TE.rating(a)];
TE.borrow = function (a, x) {
  x = Math.max(0, Math.floor(x));
  if (!x || a.debt + x > TE.creditLimit(a) + 1e-6) return false;
  a.debt += x; a.cash += x; return true;
};
TE.repay = function (a, x) {
  x = Math.min(Math.round(x), a.debt, Math.max(0, a.cash));
  if (x <= 0) return false;
  a.debt -= x; a.cash -= x; return true;
};
TE.companyValue = function (a) { return a.cash - a.debt + TE.assets(a); };

/* ---------- Modificateurs de demande / de coûts ----------
   G.mods = [{tag, scope, mult, until, label}] — expirent tout seuls.
   TE.modFactor('demande', 'CMN') → produit des mult applicables (scope vide = global). */
TE.addMod = function (m) { TE.G.mods.push(Object.assign({ until: TE.G.day + 30, mult: 1, tag: 'demande' }, m)); TE.G.mut = (TE.G.mut || 0) + 1; };
TE.modFactor = function (tag, scope) {
  let f = 1;
  for (const m of TE.G.mods) if (m.tag === tag && (!m.scope || m.scope === scope || (Array.isArray(m.scope) && m.scope.includes(scope)))) f *= m.mult;
  return f;
};

/* ---------- Fil d'actualités ---------- */
TE.news = function (text, kind, ev) {
  const G = TE.G;
  G.news.unshift({ day: G.day, text, kind: kind || 'info', ev: ev || null });
  if (G.news.length > 40) G.news.pop();
};

/* ---------- Marché : répartition d'une demande entre offreurs ----------
   entries: [{id, price, quality, cap, ...}]  (cap = capacité max servable)
   opts: {priceSens:2.2, qualSens:1.6, refPrice}
   Retourne la même liste enrichie de .sold (volumes). Modèle logit + débordement :
   ce qu'un offreur ne peut pas servir (capacité) est redistribué aux autres.        */
TE.splitMarket = function (demand, entries, opts) {
  opts = opts || {};
  const ps = opts.priceSens == null ? 2.2 : opts.priceSens, qs = opts.qualSens == null ? 1.6 : opts.qualSens;
  const ref = opts.refPrice || (entries.length ? TE.sum(entries.map(e => e.price)) / entries.length : 1) || 1;
  for (const e of entries) {
    e.sold = 0;
    e.attr = Math.pow(Math.max(0.01, e.price / ref), -ps) * Math.pow(Math.max(0.05, e.quality == null ? 1 : e.quality), qs) * (e.weight == null ? 1 : e.weight);
  }
  let left = demand, open = entries.filter(e => e.cap > 0);
  for (let it = 0; it < 8 && left > 1e-6 && open.length; it++) {
    const W = TE.sum(open.map(e => e.attr));
    if (W <= 0) break;
    let used = 0;
    for (const e of open) {
      const want = left * e.attr / W, room = e.cap - e.sold, got = Math.min(want, room);
      e.sold += got; used += got;
    }
    left -= used;
    open = open.filter(e => e.cap - e.sold > 1e-6);
  }
  entries.unmet = left;
  return entries;
};

/* ---------- Effectif (personnel) générique ----------
   staff = { kind: {n, mo (moral 0-100), lv (niveau de salaire 0-4)} }  ; def.staff décrit les métiers. */
TE.SALLV = [0.85, 0.95, 1, 1.1, 1.2];
TE.staffCount = a => TE.sum(Object.values(a.staff || {}).map(s => s.n));
TE.wagesMonth = function (a) {
  let w = 0; const S = (TE.def.staff || {});
  for (const k in (a.staff || {})) w += a.staff[k].n * (S[k] ? S[k].sal : 0) * TE.SALLV[a.staff[k].lv == null ? 2 : a.staff[k].lv];
  return w;
};
TE.avgMorale = function (a) {
  let t = 0, n = 0; for (const k in (a.staff || {})) { t += a.staff[k].mo * a.staff[k].n; n += a.staff[k].n; }
  return n ? t / n : 60;
};
TE.staffInit = function (a, counts) {
  a.staff = a.staff || {};
  for (const k in (TE.def.staff || {})) a.staff[k] = { n: (counts && counts[k]) || 0, mo: 65, lv: 2 };
};
TE.hire = function (a, k, n) {
  const s = a.staff[k], S = TE.def.staff[k]; n = Math.max(-s.n, Math.round(n)); if (!n) return false;
  if (n > 0) { const c = n * (S.hire || 0); if (a.cash < c) return false; TE.spend(a, 'recrutement', c); }
  s.n += n; if (n > 0) s.mo = Math.max(40, s.mo - 2); return true;
};
/* Moral : tend vers une cible selon le niveau de salaire ; grève si trop bas (le jeu lit a.penalty). */
TE.staffTick = function (a) {
  for (const k in (a.staff || {})) {
    const s = a.staff[k], target = 50 + 12 * (s.lv - 2) + (a.rep - 50) * 0.2;
    s.mo += (target - s.mo) * 0.02;
  }
};

/* ---------- Objectifs ----------
   def.goals = { share:{label, value:(a)=>0..1+, fmt:(v)=>'..', unit:'%'}, value:{...} }
   G.cfg.goal = 'share' | 'none' ; G.cfg.gv = valeur cible (unités de l'objectif)   */
TE.goalInfo = function () {
  const G = TE.G, C = G.cfg || {}, goals = TE.def.goals || {};
  if (!C.goal || C.goal === 'none' || !goals[C.goal]) return null;
  const g = goals[C.goal], p = TE.player(), cur = g.value(p), tgt = C.gv != null ? C.gv : g.def;
  return { id: C.goal, label: g.label, cur, tgt, frac: tgt ? cur / tgt : 0, fmt: g.fmt || (v => TE.nf(v, 1)), met: cur >= tgt };
};

/* ---------- Création de partie ---------- */
TE.newGame = function (o) {
  const def = TE.def;
  const presets = def.presets || [{}];
  const cfg = Object.assign({ goal: 'none', rivals: 4, rich: 1, aggr: 1, entr: 1, safe: 0 }, presets[o.diff == null || o.diff >= presets.length ? Math.min(1, presets.length - 1) : o.diff], o.cfg || {});
  TE.G = {
    v: def.version, seed: (o.seed != null ? o.seed : Math.floor(Math.random() * 1e9)) | 0,
    day: 0, frac: 0, nid: 1, mut: 0, actors: [], mods: [], news: [], evSeen: {}, flags: {},
    won: false, over: false, diff: o.diff, cfg, opts: o.opts || {}, name: o.name || 'Joueur', game: {}
  };
  const p = TE.mkActor({ name: o.name || 'Joueur', color: o.color || '#b01f6a', player: true, cash: cfg.cash != null ? cfg.cash : 1e7 });
  TE.staffInit(p);
  const pool = def.rivalPool ? def.rivalPool(TE.G, o) : (def.rivals || []), list = pool.slice(0, TE.clamp(cfg.rivals, 0, pool.length));
  if (def.init) def.init(TE.G, o);                      // monde du jeu (carte, pistes, catalogue…)
  if (def.initActor) def.initActor(TE.G, p, null, o);   // joueur : flotte/équipe de départ
  for (const R of list) {
    const a = TE.mkActor({ name: R.name, color: R.color, profile: R.profile, cash: (R.cash || 1e7) * (cfg.rich || 1) });
    TE.staffInit(a);
    if (def.initActor) def.initActor(TE.G, a, R, o);
  }
  if (def.start) def.start(TE.G, o);
  TE.news(def.welcome ? def.welcome(TE.G, o) : 'Ta partie commence.', 'good');
  return TE.G;
};

/* ---------- Boucle de simulation : un tick ----------
   Ordre : IA hebdo → pack.onTick (le jeu simule la journée) → semaine → mois → année → événements → fin de partie. */
TE.step = function () {
  const G = TE.G, def = TE.def, c = TE.cal();
  G.day++;
  // modificateurs expirés
  if (G.mods.length) { const n = G.mods.length; G.mods = G.mods.filter(m => m.until > G.day); if (G.mods.length !== n) G.mut = (G.mut || 0) + 1; }
  // IA : chaque rivale réfléchit une fois par semaine, à tour de rôle
  if (def.ai && def.ai.week) for (const a of G.actors) if (!a.bankrupt && !a.player && (G.day + a.id) % 7 === 0) def.ai.week(G, a, def.profiles ? def.profiles[a.profile] : null);
  for (const a of G.actors) { if (a.bankrupt) continue; TE.staffTick(a); a.negDays = a.cash < 0 ? a.negDays + 1 : 0; }
  if (def.onTick) def.onTick(G);
  if (G.day % 7 === 0 && def.onWeek) def.onWeek(G);
  if (G.day % c.ticksPerMonth === 0) TE.monthStep();
  if (G.day % (c.ticksPerMonth * c.monthsPerYear) === 0 && def.onYear) def.onYear(G);
  TE.eventStep();
  // victoire / défaite
  const p = TE.player(), gi = TE.goalInfo();
  if (!G.won && gi && gi.met) { G.won = true; TE.news('Objectif atteint !', 'good'); }
  if (!G.over && p.bankrupt) { G.over = true; }
  if (def.checkEnd) def.checkEnd(G);
};

/* Clôture mensuelle : le jeu calcule recettes/charges via onMonth(G, acteur) ; le moteur gère
   intérêts, historiques, faillites, part de marché, nouveaux entrants. */
TE.monthStep = function () {
  const G = TE.G, def = TE.def, C = def.credit;
  // le joueur passe en dernier (il encaisse ce que les rivales lui versent ce mois-ci)
  const order = G.actors.slice(1).concat([G.actors[0]]);
  let tot = 0;
  for (const a of order) {
    if (a.bankrupt) continue;
    if (def.onMonth) def.onMonth(G, a);
    const interest = a.debt * (a.player ? TE.loanRate(a) : 0.006) / 12;
    TE.spend(a, 'intérêts', interest);
    const w = TE.wagesMonth(a); TE.spend(a, 'salaires', w);
    const m = a.m; m.profit = TE.profit(m);
    a.last = m; a.hist.push(Math.round(m.profit)); if (a.hist.length > 36) a.hist.shift();
    const H = (k, v) => { a[k].push(Math.round(v)); if (a[k].length > 72) a[k].shift(); };
    H('revH', TE.revenue(m)); H('cashH', a.cash);
    tot += m.vol || 0;
    a.m = TE.newMonth();
  }
  for (const a of G.actors) {
    a.share = a.bankrupt || !tot ? 0 : (a.last ? (a.last.vol || 0) / tot : 0);
    a.shareH.push(Math.round(a.share * 1e4)); if (a.shareH.length > 72) a.shareH.shift();
    // faillite des rivales (le joueur : fin de partie, sauf mode « sans faillite »)
    if (!a.bankrupt && a.negDays >= C.graceDays && a.cash < C.bankruptFloor) {
      if (a.player) { if (!G.cfg.safe) { a.bankrupt = true; } else { a.cash = 0; a.negDays = 0; TE.news('Mode sans faillite : la banque efface ton découvert.', 'info'); } }
      else {
        a.bankrupt = true; G.mut = (G.mut || 0) + 1;
        if (def.onBankrupt) def.onBankrupt(G, a);
        TE.news(a.name + ' fait faillite et quitte le marché.', 'info', 'rivalbk');
      }
    }
  }
  // nouveaux entrants : quand une rivale disparaît, une jeune structure finit par la remplacer
  if (def.entrants && G.cfg.entr !== 0) {
    const alive = G.actors.filter(a => !a.bankrupt && !a.player).length, dead = G.actors.filter(a => a.bankrupt && !a.player).length;
    if (dead && alive < (def.maxRivals || 9) && G.day - (G.lastEntry || 0) > 150 && TE.rng() < 0.35) { G.lastEntry = G.day; TE.spawnEntrant(); }
  }
  if (def.afterMonth) def.afterMonth(G, tot);
};

TE.spawnEntrant = function (R0) {
  const G = TE.G, def = TE.def, used = new Set(G.actors.map(a => a.name)), E = (def.entrantPool ? def.entrantPool(G) : def.entrants).filter(e => !used.has(e.name));
  const R = R0 && !used.has(R0.name) ? R0 : E.length ? TE.pick(E) : null;
  if (!R) return;
  const a = TE.mkActor({ name: R.name, color: R.color, profile: R.profile, cash: R.cash || 2e7, entrant: true });
  TE.staffInit(a);
  if (def.initActor) def.initActor(G, a, R, {});
  G.mut = (G.mut || 0) + 1;
  TE.news('Nouvelle concurrente : ' + R.name + ' arrive sur le marché.', 'info', 'rivalbk');
};

/* ---------- Événements ----------
   def.events.random   = [{w, name, when?(G), run(G)}]  tirés avec probabilité def.events.rate par tick
   def.events.scheduled= [{id, name, from, to, lead, scope, mult, text?}] : annoncés `lead` ticks avant,
                         et appliqués comme modificateur pendant [from,to].                          */
TE.eventStep = function () {
  const G = TE.G, E = TE.def.events;
  if (!E) return;
  for (const S of E.scheduled || []) {
    const lead = S.lead == null ? 120 : S.lead;
    if (!G.evSeen[S.id] && G.day >= S.from - lead && G.day < S.from) {
      G.evSeen[S.id] = 1;
      TE.news(S.text || ('À venir : ' + S.name + ' (' + TE.shortDate(S.from) + ').'), 'info', S.art || 'boom');
    }
    if (G.evSeen[S.id] === 1 && G.day >= S.from) {
      G.evSeen[S.id] = 2;
      TE.addMod({ tag: S.tag || 'demande', scope: S.scope, mult: S.mult, until: S.to, label: S.name });
    }
  }
  if (E.random && TE.rng() < (E.rate == null ? 0.5 : E.rate)) {
    const ok = E.random.filter(e => !e.when || e.when(G));
    if (ok.length) TE.pickW(ok).run(G);
  }
};


/* ---------- Triche / outils de test ----------
   Appelables en headless (tests) et depuis le menu 🛠 de l'interface (ui.js). Un jeu peut ajouter ses propres outils
   via def.cheats = [{ group, label, run(G, p, ctx) }].                                                              */
TE.ART = TE.ART || {};
TE.art = name => (TE.ART && TE.ART[name]) || null;     // images optionnelles : dossier games/<jeu>/art/, intégrées au build
TE.cheat = {
  cash(n) { TE.player().cash += n; },
  clearDebt() { TE.player().debt = 0; },
  safe() { const G = TE.G; G.cfg.safe = G.cfg.safe ? 0 : 1; return !!G.cfg.safe; },
  skip(days) { const G = TE.G; for (let i = 0; i < days && !G.over; i++) TE.step(); },
  event(i) { const E = TE.def.events; if (!E || !E.random || !E.random[i]) return false; E.random[i].run(TE.G); return true; },
  randomEvent() { const E = TE.def.events; if (!E || !E.random || !E.random.length) return false; TE.pickW(E.random).run(TE.G); return true; },
  kill(id) { const a = TE.G.actors.find(x => x.id === id); if (!a || a.player || a.bankrupt) return false; a.bankrupt = true; TE.G.mut = (TE.G.mut || 0) + 1; TE.news(a.name + ' disparaît du marché (test).', 'info'); return true; },
  entrant() { TE.spawnEntrant(); },
  rivalsCash(n) { for (const a of TE.rivals()) a.cash += n; },
  win() { TE.G.won = true; }
};

/* ---------- IA : aides pour écrire def.ai.week ---------- */
TE.ai = {
  /* trésorerie à garder en réserve selon le profil */
  reserve: (a, P, perUnit) => (P && P.reserve || 4e6) + (perUnit || 0),
  /* Probabilité d'agir ce tour, modulée par le tempérament de la partie */
  willing: (P) => TE.rng() < ((P && P.appetite) || 0.2) * (TE.G.cfg.aggr || 1),
  canAfford: (a, cost, P) => a.cash - cost > TE.ai.reserve(a, P)
};

/* ---------- Sauvegardes ----------
   Stockage injectable (localStorage par défaut ; objet mémoire en test). 4 emplacements : auto, auto.prev, 1, 2, 3. */
TE.store = (function () {
  try { if (root.localStorage) { root.localStorage.setItem('__t', '1'); root.localStorage.removeItem('__t'); return root.localStorage; } } catch (e) {}
  const mem = {};
  return { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
})();
TE.SLOTS = ['auto', '1', '2', '3'];
const svK = x => TE.def.save + '.save.' + x, svM = x => TE.def.save + '.meta.' + x;
const lsGet = k => { try { return TE.store.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { TE.store.setItem(k, v); return true; } catch (e) { return false; } };
const lsDel = k => { try { TE.store.removeItem(k); } catch (e) {} };
TE.saveMeta = function () {
  const G = TE.G, p = TE.player();
  const meta = TE.def.saveMeta ? TE.def.saveMeta(G, p) : {};
  return Object.assign({ name: p.name, color: p.color, day: G.day, cash: Math.round(p.cash), over: !!G.over, won: !!G.won, at: Date.now() }, meta);
};
TE.writeSlot = function (slot) {
  const G = TE.G; if (!G) return false;
  let data; try { data = JSON.stringify(G); } catch (e) { return false; }
  const meta = JSON.stringify(TE.saveMeta());
  if (slot === 'auto') {                                  // garde la sauvegarde précédente en secours
    const cur = lsGet(svK('auto'));
    if (cur) { const m = lsGet(svM('auto')); if (!m || JSON.parse(m).day !== G.day) { lsSet(svK('auto.prev'), cur); lsSet(svM('auto.prev'), m || '{}'); } }
  }
  let ok = lsSet(svK(slot), data);
  if (!ok) { lsDel(svK('auto.prev')); lsDel(svM('auto.prev')); ok = lsSet(svK(slot), data); }
  if (ok) lsSet(svM(slot), meta);
  return ok;
};
TE.parseSave = function (txt) {
  let g = JSON.parse(txt);
  if (!g || typeof g !== 'object' || !Array.isArray(g.actors) || !g.actors.length) throw new Error('format');
  const mig = TE.def.migrate || {};
  while (g.v < TE.def.version && mig[g.v]) { const from = g.v; g = mig[from](g) || g; g.v = from + 1; }
  if (g.v !== TE.def.version) throw new Error('version');
  return g;
};
TE.readSlot = function (slot) { const t = lsGet(svK(slot)); if (!t) return null; try { return TE.parseSave(t); } catch (e) { return null; } };
TE.slotMeta = function (slot) { const t = lsGet(svM(slot)); if (!t || !lsGet(svK(slot))) return null; try { return JSON.parse(t); } catch (e) { return null; } };
TE.save = () => TE.writeSlot('auto');
TE.load = function () { return TE.readSlot('auto') || TE.readSlot('auto.prev'); };
TE.exportSave = () => JSON.stringify(TE.G);
TE.importSave = function (txt) { const g = TE.parseSave(txt); TE.G = g; return g; };

})(typeof globalThis !== 'undefined' ? globalThis : this);
