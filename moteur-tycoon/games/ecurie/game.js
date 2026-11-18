/* =============================================================================
   JEU DE DÉMONSTRATION — « Grand Prix Manager » (écurie de F1)
   ~250 lignes : tout le reste (temps, finances, IA, événements, sauvegarde, UI) vient du moteur.
   Sert de modèle : copier ce dossier, changer les données et les règles, c'est un nouveau jeu.
   ============================================================================= */
(function (root) {
'use strict';
const TE = root.TE, H = TE.h, money = TE.money, clamp = TE.clamp, esc = TE.esc;


/* ---------- Données du jeu ---------- */
const AREAS = { aero: ['Aérodynamique', 0.38], engine: ['Moteur', 0.34], chassis: ['Châssis', 0.28], reli: ['Fiabilité', 0] };
const DRIVERS = [{ label: 'Pilote recrue', skill: 45, sal: 0.25e6, fee: 0 }, { label: 'Pilote confirmé', skill: 62, sal: 0.8e6, fee: 3e6 }, { label: 'Champion du monde', skill: 80, sal: 2.2e6, fee: 8e6 }];
const CIRCUITS = ['Bahreïn', 'Imola', 'Monaco', 'Barcelone', 'Montréal', 'Silverstone', 'Spa', 'Monza', 'Singapour', 'Suzuka', 'Austin', 'Abu Dhabi'];
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const PRIZE = [12, 9, 7.5, 6, 5, 4, 3, 2.2, 1.5, 1, 0.6, 0.4].map(x => x * 0.5e6);
const RACE_DAY = 24;                                  // une course par mois, au 25
const isRaceDay = G => G.day % 30 === RACE_DAY;

const PROFILES = {
  usine: { label: 'Écurie d\'usine', appetite: 0.35, reserve: 8e6, spend: 2.5e6, driver: 2, logi: 1.9e6 },
  independante: { label: 'Indépendante', appetite: 0.2, reserve: 5e6, spend: 1.5e6, driver: 1, logi: 1.6e6 },
  client: { label: 'Écurie cliente', appetite: 0.12, reserve: 3e6, spend: 1e6, driver: 0, logi: 1.25e6 }
};
const RIVALS = [
  { name: 'Rossa Corsa', profile: 'usine', color: '#c62828', cash: 45e6, lv: 62 }, { name: 'Argent Racing', profile: 'usine', color: '#78909c', cash: 45e6, lv: 60 },
  { name: 'Taurus Speed', profile: 'usine', color: '#1a237e', cash: 40e6, lv: 58 }, { name: 'Oriel GP', profile: 'independante', color: '#2e7d32', cash: 28e6, lv: 52 },
  { name: 'Kestrel Motorsport', profile: 'independante', color: '#ef6c00', cash: 26e6, lv: 50 }, { name: 'Nova Corse', profile: 'independante', color: '#6a1b9a', cash: 25e6, lv: 48 },
  { name: 'Helios Racing', profile: 'client', color: '#f9a825', cash: 18e6, lv: 42 }, { name: 'Bouclier Noir', profile: 'client', color: '#37474f', cash: 18e6, lv: 40 },
  { name: 'Zéphyr GP', profile: 'client', color: '#00838f', cash: 16e6, lv: 38 }
];
const ENTRANTS = [{ name: 'Andromède Racing', profile: 'client', color: '#ad1457', cash: 20e6, lv: 40 }, { name: 'Pacifica Motorsport', profile: 'independante', color: '#00695c', cash: 24e6, lv: 46 }];

/* ---------- Règles ---------- */
const car = a => Object.keys(AREAS).reduce((s, k) => s + AREAS[k][1] * a.car[k], 0);
const carValue = a => (a.car.aero + a.car.engine + a.car.chassis + a.car.reli) * 0.25e6;
const rdEff = a => 0.6 + 0.8 * Math.min(1.5, a.staff.engineers.n / 80);
const driverOf = a => DRIVERS[a.driver];
const nextRaceIn = G => { let d = (RACE_DAY - (G.day % 30) + 30) % 30; return d === 0 ? 30 : d; };
const raceNo = G => Math.floor(G.day / 30) % 12;

function invest(a, area, cost) {
  if (a.cash < cost) return false;
  TE.spend(a, 'R&D', cost);
  a.car[area] = Math.min(100, a.car[area] + cost / 1e6 * 1.6 * Math.pow(1 - a.car[area] / 100, 1.3) * rdEff(a));
  return true;
}

function runRace(G) {
  const n = raceNo(G), rows = [];
  for (const a of G.actors) {
    if (a.bankrupt) continue;
    const reliB = (a.staff.mechanics.n / 120 - 1) * 5;
    const dnf = TE.rng() < clamp(0.22 - (a.car.reli + reliB) * 0.0018, 0.03, 0.25);
    const noise = (TE.rng() + TE.rng() + TE.rng() - 1.5) * 9;
    rows.push({ a, perf: 0.7 * car(a) + 0.3 * driverOf(a).skill + noise, dnf });
  }
  rows.sort((x, y) => (x.dnf - y.dnf) || (y.perf - x.perf));
  rows.forEach((r, i) => {
    const pts = r.dnf ? 0 : POINTS[i] || 0;
    r.pos = i + 1; r.pts = pts;
    r.a.pts += pts; r.a.ptsTotal += pts; r.a.m.vol += pts; if (i === 0 && !r.dnf) r.a.wins++;
    TE.earn(r.a, 'prize', PRIZE[i] || 0.3e6);
    r.a.rep = clamp(r.a.rep + ((rows.length + 1) / 2 - r.pos) * 0.5, 10, 100);
  });
  G.game.last = { circuit: CIRCUITS[n], no: n + 1, year: TE.dateParts(G.day).y, rows: rows.map(r => ({ id: r.a.id, pos: r.pos, pts: r.pts, dnf: r.dnf })) };
  const w = rows[0], me = rows.find(r => r.a.player);
  TE.news('GP de ' + CIRCUITS[n] + ' : victoire de ' + w.a.name + '. ' + (me ? (me.dnf ? 'Abandon pour toi.' : 'Tu termines ' + me.pos + 'e (' + me.pts + ' pts).') : ''), me && me.pos <= 3 ? 'good' : me && me.dnf ? 'bad' : 'info');
}

/* ---------- Définition ---------- */
const DEF = {
  id: 'ecurie', title: 'Grand Prix Manager', icon: '🏁', subtitle: 'Écurie de F1', currency: '€',
  titleHTML: 'Grand<br>Prix <span>Manager</span>',
  lede: 'Dirige une écurie de Formule 1 : développe ta voiture, choisis ton pilote, gère ton budget et bats des rivales gérées par l\'ordinateur.',
  startLabel: 'Lancer la saison',
  theme: { accent: '#d4351c', accent2: '#1f4e8c', board: '#14171c', flap: '#ff5a3c' },
  calendar: { startYear: 2028 },
  setup: [{ k: 'name', type: 'text', label: 'Nom de ton écurie', def: 'Atlas Racing' }, { k: 'color', type: 'color', label: 'Couleur', def: '#d4351c' }],
  presets: [{ label: 'Découverte : 60 M€, rivales modestes', cash: 60e6, rich: 0.8, aggr: 0.6 }, { label: 'Classique : 40 M€', cash: 40e6, rich: 1, aggr: 1 }, { label: 'Coriace : 25 M€, rivales riches et agressives', cash: 25e6, rich: 1.3, aggr: 1.4 }],
  rivals: RIVALS, entrants: ENTRANTS, profiles: PROFILES, maxRivals: 9,
  staff: { engineers: { label: 'Ingénieurs', sal: 9e3, hire: 15e3 }, mechanics: { label: 'Mécaniciens', sal: 5e3, hire: 6e3 } },
  credit: { base: 5e6, assetsMult: 0.3, bankruptFloor: -5e6, graceDays: 60 },
  ledger: { in: { sponsors: 'Sponsors', prize: 'Primes de course' }, out: { 'R&D': 'Développement', pilotes: 'Pilotes', logistique: 'Logistique & usine', salaires: 'Salaires', 'intérêts': 'Intérêts' } },
  assets: carValue,
  goals: {
    points: { label: 'Points cumulés', unit: 'pts', def: 500, value: a => a.ptsTotal, fmt: v => TE.nf(v) + ' pts' },
    titres: { label: 'Titres constructeurs', unit: 'titres', def: 2, value: a => a.titles, fmt: v => TE.nf(v) },
    value: { label: 'Valeur de l\'écurie', unit: 'M€', def: 150, value: a => TE.companyValue(a) / 1e6, fmt: v => TE.nf(v) + ' M€' }
  },

  init(G) { G.game = { last: null }; },
  initActor(G, a, R) {
    const lv = R ? R.lv : 42;
    a.car = { aero: lv + TE.rand(-6, 6), engine: lv + TE.rand(-6, 6), chassis: lv + TE.rand(-6, 6), reli: lv + TE.rand(-6, 6) };
    a.driver = R ? PROFILES[R.profile].driver : 0; a.pts = 0; a.ptsTotal = 0; a.wins = 0; a.titles = 0;
    a.staff.engineers.n = R ? 40 + Math.round(lv) : 60; a.staff.mechanics.n = R ? 60 + Math.round(lv) : 90;
    a.rep = R ? 30 + lv * 0.6 : 45;
  },
  welcome: () => 'Ton écurie est créée. Investis dans la voiture avant la première course.',

  /* Boucle : la course est le seul événement « jeu » du tick ; le reste est dans le moteur */
  onTick(G) { if (isRaceDay(G)) runRace(G); },
  onMonth(G, a) {
    TE.earn(a, 'sponsors', (1.2e6 + 0.05e6 * a.rep) * TE.modFactor('sponsor'));
    TE.spend(a, 'logistique', a.profile ? PROFILES[a.profile].logi : 1.8e6);
    TE.spend(a, 'pilotes', driverOf(a).sal);
    for (const k in a.car) a.car[k] = Math.max(20, a.car[k] * 0.995);      // obsolescence : il faut développer en continu
  },
  onYear(G) {
    const live = G.actors.filter(a => !a.bankrupt).sort((x, y) => y.pts - x.pts), champ = live[0];
    if (champ) { champ.titles++; TE.news('Saison terminée : ' + champ.name + ' est championne constructeurs (' + champ.pts + ' pts).', champ.player ? 'good' : 'info'); }
    for (const a of G.actors) a.pts = 0;
  },
  autoPause: G => isRaceDay(G) && TE.G.cfg.pauseRace !== 0,
  rankingSort: a => a.pts * 1e6 + a.ptsTotal,
  rankingTitle: 'Championnat constructeurs',
  rankingCols: [{ h: 'Pts', cls: 'num', get: a => a.pts }, { h: 'Total', cls: 'num', get: a => a.ptsTotal }, { h: 'Titres', cls: 'num', get: a => a.titles }, { h: 'Trésorerie', cls: 'num', get: a => money(a.cash) }],
  saveMeta: (G, p) => ({ pts: p.ptsTotal, titles: p.titles }),
  endText: (G, p, win) => win ? 'Ton écurie atteint son objectif : ' + p.ptsTotal + ' points et ' + p.titles + ' titre(s).' : 'Ton écurie n\'a plus les moyens de courir. Dernier bilan : ' + p.ptsTotal + ' points, ' + p.titles + ' titre(s).',

  ai: {
    week(G, a, P) {
      if (!TE.ai.willing(P)) return;
      if (P.driver > a.driver && TE.ai.canAfford(a, DRIVERS[P.driver].fee, P) && TE.rng() < 0.1) { TE.spend(a, 'pilotes', DRIVERS[P.driver].fee); a.driver = P.driver; return; }
      const area = Object.keys(a.car).sort((x, y) => a.car[x] - a.car[y])[0];       // renforce le point faible
      if (TE.ai.canAfford(a, P.spend, P)) invest(a, area, P.spend);
    }
  },

  events: {
    rate: 0.04,
    scheduled: [{ id: 'gala', name: 'Gala de la fédération', from: 150, to: 180, lead: 60, tag: 'sponsor', mult: 1.2, text: 'Un gala de la fédération approche : les sponsors seront généreux (+20 %).' }],
    random: [
      { w: 2, name: 'sponsor', run(G) { TE.addMod({ tag: 'sponsor', mult: 1.25, until: G.day + 90, label: 'Sponsor en quête de visibilité' }); TE.news('Un grand groupe cherche de la visibilité : sponsors +25 % pendant 3 mois.', 'good'); } },
      { w: 1.5, name: 'crise', run(G) { TE.addMod({ tag: 'sponsor', mult: 0.8, until: G.day + 120, label: 'Crise économique' }); TE.news('Crise économique : les budgets de sponsoring reculent de 20 % pendant 4 mois.', 'bad'); } },
      { w: 1, name: 'regl', when: G => G.day - (G.flags.reg || -999) > 300, run(G) { G.flags.reg = G.day; for (const a of G.actors) { a.car.aero *= 0.93; a.car.engine *= 0.96; } TE.news('Nouvelle réglementation technique : toutes les voitures perdent en aérodynamique et en moteur.', 'info'); } },
      { w: 1, name: 'espion', run(G) { const R = TE.rivals(); if (!R.length) return; const a = TE.pick(R); a.car.aero = Math.max(20, a.car.aero - 6); TE.news('Fuite technique chez ' + a.name + ' : elle perd du terrain en aérodynamique.', 'info'); } },
      { w: 1, name: 'transfert', run(G) { const R = TE.rivals().filter(a => a.driver < 2); if (!R.length) return; const a = TE.pick(R); a.driver++; TE.news(a.name + ' engage un meilleur pilote.', 'info'); } }
    ]
  },

  kpis: [
    { label: 'Date', get: (p, G) => TE.dateStr(G.day) },
    { label: 'Trésorerie', get: p => money(p.cash), cls: p => (p.cash < 0 ? 'neg' : '') },
    { label: 'Championnat', get: (p, G) => rankOf(G, p) + 'e · ' + p.pts + ' pts' },
    { label: 'Prochaine course', get: (p, G) => 'J-' + nextRaceIn(G) }
  ],

  tabs: [
    { id: 'course', label: 'Course', icon: '🏁', render: panelCourse },
    { id: 'voiture', label: 'Voiture', icon: '🔧', render: panelVoiture },
    { id: 'equipe', label: 'Équipe', icon: '👥', render: panelEquipe },
    { id: 'finances', label: 'Finances', icon: '💶', render: '@finance' },
    { id: 'classement', label: 'Classement', icon: '🏆', render: '@ranking' },
    { id: 'actus', label: 'Actus', icon: '📰', render: '@news' }
  ],

  actions: {
    rd(d, c) { const x = c.UI.amt[d.k]; if (!invest(c.p, d.area, x)) return c.toast('Trésorerie insuffisante.'); c.toast(AREAS[d.area][0] + ' : +' + TE.nf(x / 1e6 * 1.6 * Math.pow(1 - (c.p.car[d.area] / 100), 1.3) * rdEff(c.p), 1) + ' environ.'); },
    driver(d, c) { const t = +d.v, D = DRIVERS[t], p = c.p; if (p.driver === t) return; const fee = t > p.driver ? D.fee : 0; if (p.cash < fee) return c.toast('Trésorerie insuffisante pour la prime de signature.'); TE.spend(p, 'pilotes', fee); p.driver = t; c.toast(D.label + ' signé.'); },
    hire(d, c) { if (!TE.hire(c.p, d.k, +d.n)) c.toast('Impossible (trésorerie ou effectif).'); },
    wage(d, c) { c.p.staff[d.k].lv = +d.v; }
  }
};

function rankOf(G, p) { return G.actors.filter(a => !a.bankrupt).sort((x, y) => (y.pts - x.pts) || (y.ptsTotal - x.ptsTotal)).indexOf(p) + 1; }

function panelCourse(G, p) {
  const L = G.game.last, rows = G.actors.filter(a => !a.bankrupt).sort((x, y) => (y.pts - x.pts) || (y.ptsTotal - x.ptsTotal));
  let h = '<h2>Saison ' + TE.dateParts(G.day).y + '</h2>' + H.tiles([['Prochaine course', 'GP de ' + CIRCUITS[Math.floor((G.day + nextRaceIn(G)) / 30) % 12]], ['Dans', nextRaceIn(G) + ' j'], ['Championnat', rankOf(G, p) + 'e / ' + rows.length], ['Points', p.pts]]) + TE.panels.goal();
  if (L) h += H.card('Dernière course : GP de ' + L.circuit, H.table([{ h: 'Pos', cls: 'num', get: r => r.dnf ? 'Abd' : r.pos }, { h: 'Écurie', get: r => '<i class="dot" style="background:' + G.actors[r.id].color + '"></i>' + esc(G.actors[r.id].name) }, { h: 'Pts', cls: 'num', get: r => r.pts }],
    L.rows.slice(0, 10).map(r => Object.assign({ _cls: r.id === 0 ? 'me' : '' }, r))));
  h += H.card('Classement de la saison', H.table([{ h: '#', cls: 'num', get: r => r._rank }, { h: 'Écurie', get: a => '<i class="dot" style="background:' + a.color + '"></i>' + esc(a.name) }, { h: 'Pts', cls: 'num', get: a => a.pts }], rows.map((a, i) => Object.assign({ _cls: a.player ? 'me' : '', _rank: i + 1 }, a))));
  return h;
}
function panelVoiture(G, p) {
  const cost = k => Math.min(Math.max(0, p.cash), 6e6);
  return '<h2>Voiture</h2><p class="muted">Chaque investissement fait progresser la voiture, mais plus elle est développée, plus les gains diminuent. Ses performances s\'érodent un peu chaque mois. Efficacité de ton bureau d\'études : <b>' + TE.pct(rdEff(p)) + '</b>.</p>' +
    Object.keys(AREAS).map(k => H.card(AREAS[k][0] + ' <span class="pill info">' + TE.nf(p.car[k], 1) + ' / 100</span>', H.bar(p.car[k], 100) +
      H.amt({ k: 'rd_' + k, min: 5e5, max: Math.max(5e5, cost(k)), step: 5e5, def: 2e6, act: 'rd', attrs: ' data-area="' + k + '"', cls: 'primary', fmt: v => 'Investir ' + money(v), lbl: 'Montant de développement', why: 'Trésorerie insuffisante' }))).join('');
}
function panelEquipe(G, p) {
  const S = TE.def.staff;
  return '<h2>Équipe</h2>' + H.card('Pilote', '<div class="row">' + DRIVERS.map((D, i) => '<button class="btn' + (p.driver === i ? ' primary' : '') + '" data-act="driver" data-v="' + i + '">' + D.label + '<br><small>' + D.skill + ' · ' + money(D.sal) + '/mois' + (i > p.driver ? ' · prime ' + money(D.fee) : '') + '</small></button>').join('') + '</div>') +
    Object.keys(S).map(k => H.card(S[k].label + ' : ' + p.staff[k].n, H.kv([['Moral', Math.round(p.staff[k].mo) + ' / 100'], ['Salaire mensuel total', money(p.staff[k].n * S[k].sal * TE.SALLV[p.staff[k].lv])]]) +
      '<div class="row">' + [[-10, '−10'], [10, '+10'], [25, '+25']].map(x => '<button class="btn small" data-act="hire" data-k="' + k + '" data-n="' + x[0] + '">' + x[1] + (x[0] > 0 ? ' (' + money(x[0] * S[k].hire) + ')' : '') + '</button>').join('') + '</div>' +
      '<div class="row"><span class="muted" style="font-size:12px">Niveau de salaire</span>' + H.seg('wage', k, p.staff[k].lv, ['−−', '−', '=', '+', '++']) + '</div>')).join('');
}

TE.GAMES.ecurie = DEF;
if (typeof document !== 'undefined' && !root.__TE_TEST) TE.boot(DEF);
})(typeof globalThis !== 'undefined' ? globalThis : this);
