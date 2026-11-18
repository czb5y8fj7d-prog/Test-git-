/* =============================================================================
   MODÈLE DE NOUVEAU JEU — copie ce dossier (games/_modele → games/mon-jeu) puis remplis les « À FAIRE ».
   Build : node build.mjs mon-jeu   →   dist/mon-jeu.html
   Le moteur gère déjà : temps, vitesses, sauvegardes, finances/emprunts, rivales IA (hebdo), faillites,
   nouveaux entrants, événements, objectifs, fil d'actus, classement, écran de départ, fenêtres.
   ============================================================================= */
(function (root) {
'use strict';
const TE = root.TE, H = TE.h, money = TE.money;

const DEF = {
  id: 'mon-jeu', title: 'Mon Jeu', icon: '🎮', subtitle: 'Sous-titre', currency: '€',     // À FAIRE : identité
  lede: 'Une phrase qui donne envie.',
  theme: { accent: '#0a7f5a', flap: '#7ee8c1' },
  calendar: { startYear: 2030 },                          // 1 tick = 1 jour, 30 j/mois, 12 mois/an (modifiable)
  setup: [{ k: 'name', type: 'text', label: 'Nom', def: 'Ma structure' }, { k: 'color', type: 'color', label: 'Couleur', def: '#0a7f5a' }],
  presets: [{ label: 'Facile', cash: 20e6 }, { label: 'Normal', cash: 10e6 }, { label: 'Difficile', cash: 5e6, rich: 1.4, aggr: 1.4 }],

  /* À FAIRE : les concurrents (profil = personnalité de l'IA) */
  profiles: { prudent: { appetite: 0.15, reserve: 4e6 }, offensif: { appetite: 0.35, reserve: 2e6 } },
  rivals: [{ name: 'Rival A', profile: 'prudent', color: '#c62828', cash: 10e6 }, { name: 'Rival B', profile: 'offensif', color: '#1565c0', cash: 8e6 }],
  entrants: [{ name: 'Nouvelle C', profile: 'prudent', color: '#6a1b9a', cash: 8e6 }],

  /* À FAIRE : métiers du personnel (facultatif) */
  staff: { employes: { label: 'Employés', sal: 3e3, hire: 4e3 } },
  ledger: { in: { ventes: 'Ventes' }, out: { achats: 'Achats', salaires: 'Salaires', 'intérêts': 'Intérêts' } },   // libellés du compte de résultat
  assets: a => 0,                                         // valeur des actifs (sert au plafond de crédit et à la valeur d'entreprise)
  goals: { value: { label: 'Valeur de l\'entreprise', unit: 'M€', def: 100, value: a => TE.companyValue(a) / 1e6, fmt: v => TE.nf(v) + ' M€' } },

  init(G) { /* À FAIRE : monde partagé (catalogue, villes, circuits…) dans G.game */ },
  initActor(G, a, R) { /* À FAIRE : état de départ de CHAQUE acteur (joueur : R === null). Champs libres sur `a`. */ a.stock = 0; },

  onTick(G) { /* À FAIRE : simulation quotidienne (production, ventes…). Utilise TE.earn / TE.spend, TE.splitMarket, TE.modFactor */ },
  onMonth(G, a) { /* À FAIRE : recettes/charges mensuelles de l'acteur `a` (joueur ET rivales : mêmes règles) */ TE.earn(a, 'ventes', 1e6 * (1 + a.rep / 100)); TE.spend(a, 'achats', 6e5); },
  onYear(G) {},

  ai: { week(G, a, P) { if (!TE.ai.willing(P)) return; /* À FAIRE : une décision d'IA (investir, embaucher…) avec les MÊMES fonctions que le joueur */ } },
  events: { rate: 0.04, random: [{ w: 1, run(G) { TE.addMod({ tag: 'demande', mult: 1.2, until: G.day + 60 }); TE.news('Un coup de projecteur sur le secteur : demande +20 % pendant 2 mois.', 'good'); } }] },

  tabs: [
    { id: 'accueil', label: 'Accueil', icon: '🏠', render: (G, p) => '<h2>Accueil</h2>' + H.tiles([['Trésorerie', money(p.cash)], ['Réputation', Math.round(p.rep)]]) + TE.panels.goal() },
    { id: 'finances', label: 'Finances', icon: '💶', render: '@finance' },
    { id: 'classement', label: 'Marché', icon: '🏆', render: '@ranking' },
    { id: 'actus', label: 'Actus', icon: '📰', render: '@news' }
  ],
  actions: { /* nomAction(d, ctx) : appelé par <button data-act="nomAction" data-xxx="…"> ; d = data-*, ctx = {G, p, UI, toast, openModal, …} */ }
};

TE.GAMES['mon-jeu'] = DEF;
if (typeof document !== 'undefined' && !root.__TE_TEST) TE.boot(DEF);
})(typeof globalThis !== 'undefined' ? globalThis : this);
