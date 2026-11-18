/* =============================================================================
   « Constructeur » — tycoon automobile construit sur Tycoon Engine.
   Pièces (moteur, châssis, boîte) → silhouettes + modèles → usines, réseau et image de marque par pays,
   marché dynamique (économie, carburant, électrique, droits de douane, CO2), vieillissement des produits.
   ============================================================================= */
(function (root) {
'use strict';
const TE = root.TE, H = TE.h, money = TE.money, clamp = TE.clamp, esc = TE.esc, nf = TE.nf;

/* =============================== DONNÉES =============================== */
const HAND = {   // vol = marché annuel (véhicules), wealth = pouvoir d'achat, lab = coût du travail, tariff = droits sur les importations hors zone
  FR: { n: 'France', vol: 1.8e6, wealth: 1.0, lab: 1.0, zone: 'EU', tariff: 0.10, ev: 0.35, strict: 1, taste: { cit: .30, comp: .28, ber: .12, suv: .27, spo: .03 } },
  DE: { n: 'Allemagne', vol: 2.8e6, wealth: 1.2, lab: 1.15, zone: 'EU', tariff: 0.10, ev: 0.40, strict: 1, taste: { cit: .12, comp: .26, ber: .25, suv: .30, spo: .07 } },
  IT: { n: 'Italie', vol: 1.5e6, wealth: 0.9, lab: 0.9, zone: 'EU', tariff: 0.10, ev: 0.30, strict: 1, taste: { cit: .35, comp: .27, ber: .10, suv: .24, spo: .04 } },
  ES: { n: 'Espagne', vol: 1.0e6, wealth: 0.8, lab: 0.75, zone: 'EU', tariff: 0.10, ev: 0.30, strict: 1, taste: { cit: .28, comp: .30, ber: .10, suv: .29, spo: .03 } },
  GB: { n: 'Royaume-Uni', vol: 1.9e6, wealth: 1.1, lab: 1.0, zone: 'GB', tariff: 0.10, ev: 0.40, strict: 1, taste: { cit: .15, comp: .30, ber: .15, suv: .32, spo: .08 } },
  US: { n: 'États-Unis', vol: 15e6, wealth: 1.3, lab: 1.1, zone: 'US', tariff: 0.15, ev: 0.25, strict: 0.4, taste: { cit: .03, comp: .15, ber: .22, suv: .52, spo: .08 } },
  CN: { n: 'Chine', vol: 22e6, wealth: 0.75, lab: 0.45, zone: 'CN', tariff: 0.25, ev: 0.60, strict: 0.8, taste: { cit: .17, comp: .30, ber: .20, suv: .31, spo: .02 } },
  MA: { n: 'Maroc', vol: 0.17e6, wealth: 0.5, lab: 0.3, zone: 'MA', tariff: 0.15, ev: 0.10, strict: 0.1, taste: { cit: .38, comp: .32, ber: .05, suv: .24, spo: .01 } },
  BR: { n: 'Brésil', vol: 2.2e6, wealth: 0.55, lab: 0.5, zone: 'BR', tariff: 0.20, ev: 0.10, strict: 0.2, taste: { cit: .30, comp: .34, ber: .08, suv: .26, spo: .02 } }
};
// Monde : ~170 pays générés (tools/gen-world.mjs) ; les neuf marchés d'origine gardent leurs réglages à la main.
const WRL = root.WORLD || { regions: {}, countries: {} };
const COUNTRIES = {};
for (const [k, w] of Object.entries(WRL.countries)) COUNTRIES[k] = Object.assign({}, w, { taste: { cit: w.taste[0], comp: w.taste[1], ber: w.taste[2], suv: w.taste[3], spo: w.taste[4] } });
for (const [k, h] of Object.entries(HAND)) COUNTRIES[k] = Object.assign({ reg: 'euo', cont: 'Europe', pop: 0, gdp: 0, ll: [0, 0], xy: [0, 0], nb: [] }, COUNTRIES[k] || {}, h, { g: 0.01 });
const CK = Object.keys(COUNTRIES);
const BASE9 = Object.keys(HAND);
const REGL = WRL.regions, REGK = Object.keys(REGL);
const NEAR = { FR: ['DE', 'IT', 'ES', 'GB'], DE: ['FR', 'IT'], IT: ['FR', 'ES'], ES: ['FR', 'IT', 'MA'], GB: ['FR'], US: [], CN: [], MA: ['ES', 'FR'], BR: [] };
for (const k of CK) if (!NEAR[k]) NEAR[k] = (COUNTRIES[k].nb || []).filter(x => COUNTRIES[x]).sort((x, y) => COUNTRIES[y].vol - COUNTRIES[x].vol).slice(0, 4);
const SEGK_ = ['cit', 'comp', 'ber', 'suv', 'spo'];
const SEG = { cit: 'Citadines', comp: 'Compactes', ber: 'Berlines', suv: 'SUV', spo: 'Sportives' };
const SEG_ANCHOR = { cit: 14000, comp: 22000, ber: 36000, suv: 32000, spo: 52000 };
const ATTRS = { perf: 'Performances', handling: 'Tenue de route', comfort: 'Confort', economy: 'Économie', safety: 'Sécurité', rel: 'Fiabilité', design: 'Design', space: 'Habitabilité' };
const SEG_W = {
  cit: { economy: .28, space: .14, comfort: .10, rel: .20, design: .14, perf: .03, handling: .02, safety: .09 },
  comp: { economy: .18, space: .18, comfort: .14, rel: .16, design: .12, perf: .06, handling: .06, safety: .10 },
  ber: { comfort: .22, space: .14, design: .15, safety: .12, rel: .12, perf: .10, economy: .09, handling: .06 },
  suv: { space: .20, comfort: .16, design: .16, safety: .12, rel: .12, perf: .08, economy: .10, handling: .06 },
  spo: { perf: .32, handling: .26, design: .22, comfort: .05, rel: .06, safety: .05, economy: 0, space: .04 }
};
const BODIES = {   // silhouettes
  cit: { n: 'Citadine', seg: 'cit', size: 1, kg: 330, cost: 5200, design: 50, space: 42 },
  comp: { n: 'Compacte', seg: 'comp', size: 2, kg: 380, cost: 6800, design: 52, space: 56 },
  ber: { n: 'Berline', seg: 'ber', size: 3, kg: 460, cost: 9800, design: 58, space: 68 },
  suvc: { n: 'SUV compact', seg: 'suv', size: 2, kg: 430, cost: 8200, design: 56, space: 62 },
  suvl: { n: 'SUV grand format', seg: 'suv', size: 4, kg: 560, cost: 13500, design: 55, space: 80 },
  cpe: { n: 'Coupé sportif', seg: 'spo', size: 3, kg: 400, cost: 12500, design: 70, space: 30 }
};
const BODY_DEV = [30, 45, 70, 95];         // M€ par taille de plateforme
const FINISH = ['Access', 'Confort', 'Prestige'], FIN_COST = [1, 1.12, 1.3], FIN_COMF = [0, 6, 12], FIN_SAF = [0, 3, 6];
const STYLING = ['Standard', 'Soigné', 'Signature'], STY_COST = [0, 15, 40], STY_DES = [0, 8, 16];
const NAMES = ['Alba', 'Brise', 'Cap', 'Dune', 'Éclat', 'Fjord', 'Gaïa', 'Horizon', 'Iris', 'Jade', 'Kéa', 'Lyra', 'Mistral', 'Nova', 'Orion', 'Piazza', 'Quartz', 'Rivage', 'Sierra', 'Tempo'];

const FUELS = { ess: { n: 'Essence', pw: 1, co2: 140, cost: 1, dev: 1 }, die: { n: 'Diesel', pw: .92, co2: 122, cost: 1.2, dev: 1.2 }, hyb: { n: 'Hybride', pw: 1.12, co2: 82, cost: 1.6, dev: 1.8 }, elec: { n: 'Électrique', pw: 1.25, co2: 0, cost: 2.0, dev: 2.2 } };
const SIZE_L = ['S', 'M', 'L', 'XL'], ENG_KW = [75, 115, 170, 300], ENG_COST = [1500, 2300, 3600, 6500], ENG_DEV = [25, 33, 43, 60], ENG_CO2 = [.75, .95, 1.25, 1.7], ENG_KG = [110, 130, 170, 230], BAT_KG = [180, 260, 380, 520];
const CHS_KG = [620, 760, 900, 1100], CHS_COST = [2500, 3500, 5200, 7800], CHS_DEV = [55, 80, 110, 150], CHS_KW = [110, 170, 280, 650];
const FOCUS = { conf: ['Confort', 10, -6], eq: ['Équilibré', 3, 3], sport: ['Sport', -8, 14] };
const GBX = { man: { n: 'Manuelle', ref: 42, eff: 60, cost: 900, dev: 12 }, auto: { n: 'Automatique', ref: 68, eff: 55, cost: 1900, dev: 30 }, dct: { n: 'Double embrayage', ref: 60, eff: 70, cost: 2500, dev: 40 }, red: { n: 'Réducteur électrique', ref: 80, eff: 92, cost: 700, dev: 20 } };
const GBX_KW = [120, 190, 320, 750], GBX_CM = [1, 1.2, 1.5, 2], GBX_DM = [1, 1.3, 1.7, 2.2];
const DEALER_COST = 0.4e6, DEALER_MONTH = 6000, DEALER_CAP = 70, ADS = [0, .25e6, .8e6, 2e6], DEALER_MARGIN = 0.10;

const PROFILES = {
  generaliste: { label: 'Généraliste', segs: ['cit', 'comp', 'ber', 'suv'], fuel: { ess: .4, die: .3, hyb: .2, elec: .1 }, lvl: 4, pos: 1.0, fin: 2, sty: 1, life: 66, expand: .3, ads: 2, reserve: 400e6, appetite: .5, eng: 700, nFact: 3 },
  premium: { label: 'Premium', segs: ['ber', 'suv', 'spo'], fuel: { ess: .35, die: .15, hyb: .35, elec: .15 }, lvl: 6, pos: 1.35, fin: 3, sty: 2, life: 72, expand: .2, ads: 3, reserve: 400e6, appetite: .45, eng: 600, nFact: 2 },
  sport: { label: 'Sportive', segs: ['spo', 'ber'], fuel: { ess: .55, hyb: .35, elec: .1 }, lvl: 6, pos: 1.5, fin: 3, sty: 2, life: 84, expand: .12, ads: 2, reserve: 250e6, appetite: .3, eng: 350, nFact: 1 },
  lowcost: { label: 'Low-cost', segs: ['cit', 'comp', 'suv'], fuel: { ess: .7, die: .2, hyb: .1 }, lvl: 3, pos: .86, fin: 1, sty: 0, life: 72, expand: .35, ads: 1, reserve: 200e6, appetite: .5, eng: 400, nFact: 2 },
  electrique: { label: 'Électrique', segs: ['comp', 'suv', 'ber'], fuel: { elec: .85, hyb: .15 }, lvl: 5, pos: 1.02, fin: 2, sty: 1, life: 60, expand: .4, ads: 2, reserve: 300e6, appetite: .6, eng: 600, nFact: 2 },
  americain: { label: 'Américain', segs: ['suv', 'ber', 'spo', 'comp'], fuel: { ess: .6, die: .1, hyb: .2, elec: .1 }, lvl: 4, pos: 1.1, fin: 2, sty: 1, life: 72, expand: .25, ads: 2, reserve: 400e6, appetite: .4, eng: 700, nFact: 3 }
};
const RIVALS = [
  { name: 'Lumière Automobiles', profile: 'generaliste', color: '#2456a6', cash: 2.5e9, home: 'FR', cap: 120e3 },
  { name: 'Vanguard Motoren', profile: 'generaliste', color: '#37474f', cash: 3.0e9, home: 'DE', cap: 150e3 },
  { name: 'Nordlicht', profile: 'premium', color: '#6a1b9a', cash: 2.0e9, home: 'DE', cap: 60e3 },
  { name: 'Fiorenza', profile: 'sport', color: '#c62828', cash: 1.0e9, home: 'IT', cap: 15e3 },
  { name: 'Tornado Motors', profile: 'americain', color: '#ef6c00', cash: 3.0e9, home: 'US', cap: 200e3 },
  { name: 'Jade Auto', profile: 'electrique', color: '#00897b', cash: 2.0e9, home: 'CN', cap: 140e3 },
  { name: 'Hanbit Motors', profile: 'generaliste', color: '#1565c0', cash: 2.2e9, home: 'KR', cap: 130e3 },
  { name: 'Kōgyō Heavy', profile: 'generaliste', color: '#b71c1c', cash: 3.2e9, home: 'JP', cap: 160e3 },
  { name: 'Albion & Sons', profile: 'premium', color: '#2e7d32', cash: 1.8e9, home: 'GB', cap: 50e3 },
  { name: 'Bharat Mobility', profile: 'lowcost', color: '#f9a825', cash: 1.2e9, home: 'IN', cap: 150e3 },
  { name: 'Ibérica Auto', profile: 'lowcost', color: '#ad1457', cash: 1.0e9, home: 'ES', cap: 90e3 },
  { name: 'Svea Elektrisk', profile: 'electrique', color: '#0097a7', cash: 1.5e9, home: 'SE', cap: 45e3 },
  { name: 'Prairie Motor Co.', profile: 'americain', color: '#5d4037', cash: 2.6e9, home: 'US', cap: 170e3 },
  { name: 'Stella Corsa', profile: 'sport', color: '#d84315', cash: 0.9e9, home: 'IT', cap: 12e3 },
  { name: 'Aquila Veicoli', profile: 'generaliste', color: '#00838f', cash: 1.7e9, home: 'IT', cap: 90e3 },
  { name: 'Südstern', profile: 'premium', color: '#37474f', cash: 1.9e9, home: 'DE', cap: 45e3 },
  { name: 'Helvetia Premium Group', profile: 'premium', color: '#b71c1c', cash: 1.3e9, home: 'CH', cap: 25e3 },
  { name: 'Maple Leaf Motors', profile: 'americain', color: '#c62828', cash: 2.0e9, home: 'CA', cap: 110e3 },
  { name: 'Tigre d\'Or Auto', profile: 'lowcost', color: '#ff8f00', cash: 1.4e9, home: 'CN', cap: 160e3 },
  { name: 'Kaizen Électrique', profile: 'electrique', color: '#00acc1', cash: 1.8e9, home: 'JP', cap: 80e3 },
  { name: 'Fjord Mobility', profile: 'electrique', color: '#3949ab', cash: 1.1e9, home: 'NO', cap: 35e3 },
  { name: 'Meridiano Automotores', profile: 'generaliste', color: '#2e7d32', cash: 1.5e9, home: 'BR', cap: 100e3 },
  { name: 'Anatolia Motor', profile: 'lowcost', color: '#8e24aa', cash: 1.0e9, home: 'TR', cap: 110e3 },
  { name: 'Savanna Auto', profile: 'lowcost', color: '#6d4c41', cash: 0.8e9, home: 'ZA', cap: 60e3 },
  { name: 'Ferrante Competizioni', profile: 'sport', color: '#b71c1c', cash: 0.9e9, home: 'IT', cap: 10e3 },
  { name: 'Thunder Roadsters', profile: 'sport', color: '#455a64', cash: 0.8e9, home: 'GB', cap: 9e3 },
  { name: 'Aurelia Hypercars', profile: 'sport', color: '#fbc02d', cash: 1.1e9, home: 'FR', cap: 8e3 }
];
const ENTRANTS = [{ name: 'Atlas Mobility', profile: 'lowcost', color: '#e65100', cash: 500e6, home: 'MA', cap: 12e3 }, { name: 'Sakura Volt', profile: 'electrique', color: '#d81b60', cash: 700e6, home: 'CN', cap: 20e3 }];
/* 15 entreprises supplémentaires, réparties sur tous les continents (insérées parmi les premières rivales) */
const RIVALS_NEW = [
  { name: 'Pampa Motores', profile: 'generaliste', color: '#1e88e5', cash: 0.9e9, home: 'AR', cap: 70e3 },
  { name: 'Nilo Auto', profile: 'lowcost', color: '#f4511e', cash: 0.7e9, home: 'EG', cap: 60e3 },
  { name: 'Mékong Volt', profile: 'electrique', color: '#00bfa5', cash: 1.4e9, home: 'VN', cap: 50e3 },
  { name: 'Garuda Otomotif', profile: 'lowcost', color: '#c62828', cash: 0.8e9, home: 'ID', cap: 90e3 },
  { name: 'Siam Drive', profile: 'generaliste', color: '#7b1fa2', cash: 1.0e9, home: 'TH', cap: 100e3 },
  { name: 'Vistula Auto', profile: 'lowcost', color: '#d84315', cash: 0.8e9, home: 'PL', cap: 80e3 },
  { name: 'Bohemia Cars', profile: 'generaliste', color: '#2e7d32', cash: 1.1e9, home: 'CZ', cap: 90e3 },
  { name: 'Outback Utilitaires', profile: 'americain', color: '#8d6e63', cash: 1.0e9, home: 'AU', cap: 45e3 },
  { name: 'Punjab Motors', profile: 'lowcost', color: '#ef6c00', cash: 0.9e9, home: 'PK', cap: 70e3 },
  { name: 'Sahel Mobility', profile: 'lowcost', color: '#689f38', cash: 0.6e9, home: 'NG', cap: 40e3 },
  { name: 'Aztlán Motors', profile: 'americain', color: '#00796b', cash: 1.5e9, home: 'MX', cap: 130e3 },
  { name: 'Volga Avtomobil', profile: 'generaliste', color: '#455a64', cash: 1.2e9, home: 'RU', cap: 110e3 },
  { name: 'Helsinki Elektro', profile: 'electrique', color: '#0288d1', cash: 0.9e9, home: 'FI', cap: 30e3 },
  { name: 'Lóng Premium', profile: 'premium', color: '#b71c1c', cash: 1.8e9, home: 'CN', cap: 55e3 },
  { name: 'Gulf Hypercars', profile: 'sport', color: '#fdd835', cash: 1.2e9, home: 'AE', cap: 6e3 }
];
RIVALS_NEW.forEach((r, i) => RIVALS.splice(5 + 2 * i, 0, r));
ENTRANTS.push({ name: 'Kilimanjaro Electric', profile: 'electrique', color: '#2e7d32', cash: 600e6, home: 'KE', cap: 15e3 }, { name: 'Andes Volt', profile: 'electrique', color: '#6a1b9a', cash: 800e6, home: 'CL', cap: 20e3 }, { name: 'Bosphore Mobility', profile: 'generaliste', color: '#c2185b', cash: 900e6, home: 'TR', cap: 40e3 }, { name: 'Zhongyuan Neo', profile: 'electrique', color: '#00acc1', cash: 1.5e9, home: 'CN', cap: 60e3 }, { name: 'Deccan EV', profile: 'electrique', color: '#fb8c00', cash: 900e6, home: 'IN', cap: 40e3 }, { name: 'Carpates Auto', profile: 'lowcost', color: '#5d4037', cash: 500e6, home: 'RO', cap: 30e3 }, { name: 'Lusitania Drive', profile: 'generaliste', color: '#ad1457', cash: 600e6, home: 'PT', cap: 25e3 }, { name: 'Pacific Rim Motors', profile: 'americain', color: '#37474f', cash: 1.1e9, home: 'US', cap: 70e3 });

/* =============================== OUTILS =============================== */
const yrs = G => G.day / 360;
/* ---- Époques : « Moderne » (2028) ou « Années 80 » (1980). Les prix restent en monnaie constante de l'année de départ ;
   ce qui change, c'est ce qui existe : énergies, silhouettes, technologies, poids des marchés, réglementations, concurrentes. ---- */
const ERAS = { modern: { y0: 2028, tf0: 6, st: 3 }, classic: { y0: 1980, tf0: 2, st: 7 } };
const eraOf = G => ERAS[G && G.opts && G.opts.era === 'classic' ? 'classic' : 'modern'];
const isClassic = G => eraOf(G).y0 < 2028;
const absYear = G => eraOf(G).y0 + yrs(G);
const yo = G => absYear(G) - 2028;                      // années par rapport au monde de référence (2028)
const FUEL_Y = { hyb: 1997, elec: 2010 };
const fuelOk = (G, f) => !FUEL_Y[f] || absYear(G) >= FUEL_Y[f];
const BODY_Y = { suvc: 1992, suvl: 1996 };
const bodyEra = (G, k) => !BODY_Y[k] || absYear(G) >= BODY_Y[k];
const bodyKeys = G => Object.keys(BODIES).filter(k => bodyEra(G, k));
const ENTRY_HOME = { CN: 2000, IN: 1992, VN: 2005, ID: 1995, TH: 1995, PK: 1995, NG: 2000, EG: 1990, AE: 2005, RU: 1990, PL: 1990, CZ: 1990 };
const entryYear = R => Math.max(R.profile === 'electrique' ? 2010 : 0, ENTRY_HOME[R.home] || 0);
const EMERG = { CN: 0.03, IN: 0.06, ID: 0.12, VN: 0.08, TH: 0.2, PK: 0.12, NG: 0.12, EG: 0.2, BR: 0.4, MX: 0.45, RU: 0.35, TR: 0.35, PL: 0.3, CZ: 0.35 };
let eraLast = '';
function eraApply(G) {                                  // poids des marchés et goûts selon l'année (une fois par mois)
  const k0 = G.seed + ':' + Math.floor(G.day / 30); if (k0 === eraLast) return; eraLast = k0;
  const y = absYear(G), cl = isClassic(G);
  for (const c of CK) {
    const C = COUNTRIES[c]; if (C.vol0 == null) { C.vol0 = C.vol; C.t0 = Object.assign({}, C.taste); }
    if (!cl) { C.vol = C.vol0; C.taste = Object.assign({}, C.t0); continue; }
    const f0 = EMERG[c] != null ? EMERG[c] : clamp(0.85 * C.wealth, 0.1, 0.9);
    C.vol = C.vol0 * (f0 + (1 - f0) * clamp((y - 1980) / 45, 0, 1));
    C.taste = Object.assign({}, C.t0, { suv: C.t0.suv * clamp((y - 1985) / 30, 0.12, 1) });
  }
}
function eraYear(G) {                                   // chaque 1er janvier : arrivée des constructeurs qui n'existaient pas encore
  if (!isClassic(G) || G.day % 360 !== 0 || G.day === 0) return;
  const y = Math.floor(absYear(G));
  for (const R of RIVALS) if (entryYear(R) === y) { const before = TE.G.actors.length; TE.spawnEntrant(R); if (TE.G.actors.length > before) TE.news(R.name + ' (' + (COUNTRIES[R.home] || { n: R.home }).n + ') fait son apparition sur le marché mondial.', 'info'); }
}
const mkRegs = G => isClassic(G) ? [
  { id: 'ban', kind: 'ban', c: ['FR', 'DE', 'IT', 'ES', 'GB'], ann: 360 * 50, day: 360 * 55, title: 'fin des ventes de véhicules thermiques purs (essence, diesel) en Europe' },
  { id: 'nev', kind: 'ev', c: ['CN'], ann: 360 * 29, day: 360 * 32, title: 'quotas de véhicules électriques en Chine (+50 % d\'appétit)' }] : [
  { id: 'ban', kind: 'ban', c: ['FR', 'DE', 'IT', 'ES', 'GB'], ann: 360 * 3, day: 360 * 9, title: 'fin des ventes de véhicules thermiques purs (essence, diesel) en Europe' },
  { id: 'nev', kind: 'ev', c: ['CN'], ann: 360 * 2, day: 360 * 5, title: 'quotas de véhicules électriques en Chine (+50 % d\'appétit)' }];
const infl = G => Math.pow(1.02, yrs(G));
const bar = G => 50 * Math.pow(1.025, yrs(G));                // l'exigence des clients monte : tout produit vieillit
const partOf = (a, id) => a.parts.find(p => p.id == id);
const modelOf = (a, id) => a.models.find(m => m.id == id);
const body = m => BODIES[m.body];
/* Variantes de face : chaque modèle d'une même silhouette garde sa propre tête (attribuée à la première vue) */
function lookOf(a, m) {
  const vs = []; for (let i = 1; i < 40 && TE.art('body-' + m.body + '-' + i); i++) vs.push('body-' + m.body + '-' + i); if (!vs.length) vs.push('body-' + m.body);
  if (m.look == null || m.look >= vs.length) { const used = a.models.filter(x => x !== m && x.body === m.body && x.look != null).map(x => x.look), free = vs.map((v, i) => i).filter(i => !used.includes(i)); m.look = free.length ? free[(m.id * 7) % free.length] : (m.id * 7) % vs.length; }
  return vs[m.look];
}
const live = G => G.actors.filter(a => !a.bankrupt);
const brandsOf = a => [a].concat(a.extra || []);
const brOf = (a, m) => (m.br ? ((a.extra || []).find(x => x.bid === m.br) || a) : a);
const dealersTotal = a => TE.sum(brandsOf(a).map(b => TE.sum(Object.values(b.cty).map(x => x.dealers))));
const groupImg = a => { const B = brandsOf(a); if (B.length === 1) return a.brand; const w = B.map(b => Math.max(1, TE.sum(a.models.filter(m => brOf(a, m) === b).map(m => m.sold || 0)))); return TE.sum(B.map((b, i) => b.brand * w[i])) / TE.sum(w); };
const reachG = (a, c) => Math.max.apply(null, brandsOf(a).map(b => reach(b, c)));
const selB = p => brandsOf(p).find(x => String(x.bid || 0) === String(TE.UI.sbr || 0)) || p;
const fU = k => TE.UI[k] == null ? '' : TE.UI[k];
const filtersCard = (key, n, shown, total, body, reset) => {
  const open = !!fU('fo_' + key);
  return '<div class="fsum">' + H.btn(H.ico('filtres') + ' Filtres' + (n ? ' · ' + n : ''), 'set', { k: 'fo_' + key, v: open ? '' : '1' }, { cls: 'small' }) + '<span class="muted" style="font-size:13px">' + shown + (total != null && total !== shown ? ' sur ' + total : '') + '</span><span class="grow"></span>' + (n ? H.btn('Réinitialiser', 'fclear', { k: reset }, { cls: 'small' }) : '') + '</div>' + (open ? '<div class="card fbar">' + body + '</div>' : '');
};
const STOCK_OPTS = [0.5, 1, 1.5, 2, 3, 4], STOCK_L = ['0,5', '1', '1,5', '2', '3', '4'];
const stockOf = (a, m) => (m.stT != null ? m.stT : (a.stockT == null ? 1.5 : a.stockT));
const stockU = a => TE.sum(a.models.map(m => m.stock || 0));
const acqPrice = t => Math.round((Math.max(80e6, TE.companyValue(t)) * 1.3 + TE.sum(t.u12) * 800) / 1e6) * 1e6;
const factReady = (a, G) => a.fact.filter(f => f.ready <= G.day);
const FMODE = [{ n: 'Économe', cap: 0.85, fix: 0.75, lab: 1 }, { n: 'Standard', cap: 1, fix: 1, lab: 1 }, { n: 'Intensif', cap: 1.15, fix: 1.3, lab: 1.05 }];
const fMode = f => FMODE[f.mode == null ? 1 : f.mode];
const fLab = f => COUNTRIES[f.c].lab * (1 - 0.1 * (f.auto || 0)) * fMode(f).lab;
const fFix = f => f.cap * 120 * (0.7 + 0.3 * COUNTRIES[f.c].lab) * (1 + 0.06 * (f.auto || 0)) * (1 - 0.07 * (f.eco || 0)) * fMode(f).fix;
const capOf = (a, G) => Math.max(0, TE.sum(factReady(a, G).map(f => f.cap * fMode(f).cap * (f.conv > G.day ? 0.5 : 1))) * TE.modFactor('capacite') - ctRate(a, G));
const labIdx = (a, G) => { const F = factReady(a, G), t = TE.sum(F.map(f => f.cap)); return t ? TE.sum(F.map(f => f.cap * fLab(f))) / t : 1; };
const localIn = (a, c) => a.fact.some(f => COUNTRIES[f.c].zone === COUNTRIES[c].zone);   // une usine (même en construction) dans la zone
const tariffOf = c => COUNTRIES[c].tariff * TE.modFactor('tarif', c);
const D0 = c => Math.max(8, COUNTRIES[c].vol / 9000);
const reach = (a, c) => 1 - Math.exp(-a.cty[c].dealers / D0(c));
const brandW = a => 0.6 + 0.008 * a.brand;
const awareW = (a, c) => 0.55 + 0.45 * a.cty[c].aware / 100;
const evPref = (c, G) => clamp(COUNTRIES[c].ev + 0.035 * yo(G) * (COUNTRIES[c].strict > 0.5 ? 1.4 : 0.9), 0.1, 1.8) * TE.modFactor('ev', c) * evBoost(c, G);
const icePref = (c, G) => clamp(1 - 0.012 * Math.max(0, yo(G)) * COUNTRIES[c].strict, 0.5, 1);
const fuelW = (m, c, G) => { const f = m.fuel; if ((f === 'ess' || f === 'die') && isBanned(c, G)) return 0.02; return f === 'elec' ? evPref(c, G) : f === 'hyb' ? (evPref(c, G) + icePref(c, G)) / 2 + 0.1 : icePref(c, G); };
const lifecycle = m => clamp(1.05 - 0.004 * m.age, 0.6, 1.05);
const co2At = y => { return y >= 2028 ? Math.max(25, 125 * (1 - 0.04 * (y - 2028))) : y < 1995 ? 300 : y < 2015 ? 220 - (y - 1995) * 4.5 : 130 - (y - 2015) * 0.38; };
const co2Limit = G => co2At(absYear(G)) * (G.game.rx || 1);
const SEASON = [.92, .95, 1.15, 1.05, 1.05, 1.0, .9, .7, 1.15, 1.1, 1.0, .95];

/* ---------- Mécaniques : promos, plateformes, fournisseurs, positionnement, réglementations ---------- */
const effPrice = m => Math.round(m.price * (1 - (m.discLeft > 0 ? m.disc : 0)) * (m.state === 'end' ? 0.9 : 1));
const BATT_SH = { elec: 0.30, hyb: 0.08, ess: 0, die: 0 };
const battIdx = (a, G) => (a.sup && a.sup.until > G.day) ? a.sup.idx : G.game.batt;
const shareF = (a, m) => { let nc = 0, ne = 0, ng = 0; for (const x of a.models) if (x.state !== 'end') { if (x.chs === m.chs) nc++; if (x.eng === m.eng) ne++; if (x.gbx === m.gbx) ng++; } return clamp(1 - 0.04 * (nc - 1) - 0.03 * (ne - 1) - 0.02 * (ng - 1), 0.84, 1); };
const specF = (a, m) => { let t = 0, sp = 0; const sg = body(m).seg; for (const f of a.fact) { t += f.cap; if (f.spec === sg) sp += f.cap; } return t ? 1 - 0.08 * Math.min(1, sp / t * 3) : 1; };
const costNow = (a, G, m) => m.cost * (1 - Math.min(0.5, ttFx(a, 'cost') / 100)) * shareF(a, m) * specF(a, m) * (1 + (battIdx(a, G) - 1) * (BATT_SH[m.fuel] || 0));
const stageOf = m => m.state === 'dev' ? 'dev' : m.age < 6 ? 'launch' : m.age < 42 ? 'mature' : 'decline';
const STAGE_L = { dev: 'Développement', launch: 'Lancement', mature: 'Maturité', decline: 'Déclin' };
const POS = { fiab: ['Fiabilité', 'modèles dont la fiabilité ≥ 65'], lux: ['Prestige', 'finition Prestige'], sport: ['Sportivité', 'coupés ou performances ≥ 55'], prix: ['Petits prix', 'prix ≤ 97 % de la référence du segment'], eco: ['Écologie', 'moins de 80 g/km de CO2'] };
const posFit = (G, a, m) => { switch (a.pos) { case 'fiab': return m.st.rel >= 65; case 'lux': return m.fin === 3; case 'sport': return body(m).seg === 'spo' || m.st.perf >= 55; case 'prix': return m.price <= SEG_ANCHOR[body(m).seg] * infl(G) * 0.97; case 'eco': return m.st.co2 < 80; } return null; };
const posW = (G, a, m) => { const f = posFit(G, a, m); return f == null ? 1 : f ? 1.07 : 0.95; };
const banYears = G => { const r = G.game.regs.find(x => x.kind === 'ban'); return r ? (r.day - G.day) / 360 : 99; };
const isBanned = (c, G) => BLOC[c] === 'ue' && G.game.regs.some(r => r.kind === 'ban' && G.day >= r.day);
const evBoost = (c, G) => G.game.regs.some(r => r.kind === 'ev' && r.c.indexOf(c) >= 0 && G.day >= r.day) ? 1.5 : 1;
const HYPE = [0, 0.5, 1.1], CAMP = [0, 8e6, 25e6], CAMP_L = ['Aucune', 'Campagne (8 M€)', 'Grand lancement (25 M€)'], PPF = [0.9, 1, 1.15], PP_L = ['Prix bas', 'Prix marché', 'Prix haut'];
const TESTC = [0, 0.8e6, 2.5e6, 6e6], TEST_L = ['Aucun', 'Standard', 'Poussés', 'Exhaustifs'];
const dealerCost = (a, c) => DEALER_COST * (a.cty[c].partner ? 0.6 : 1);
const partnerCost = c => 8e6 * Math.sqrt(COUNTRIES[c].vol / 1e6);

/* =============================== PIÈCES =============================== */
// Paramètres avancés : [libellé, effets, étiquette courte]. Les valeurs par défaut (équilibré, atmosphérique, NMC, acier, aéro standard, 6 rapports) sont neutres : les anciennes pièces restent identiques.
const TUNE = { eco: ['Sobriété', { kw: .88, co2: .84, rel: 3, cost: .97, dev: .95 }, 'Éco'], eq: ['Équilibré', {}, ''], perf: ['Performance', { kw: 1.15, co2: 1.2, rel: -4, cost: 1.1, dev: 1.05 }, 'Perf'] };
const AIR = { atmo: ['Atmosphérique', {}, ''], turbo: ['Turbo', { kw: 1.18, co2: .93, rel: -3, cost: 1.12, dev: 1.12 }, 'Turbo'], btur: ['Biturbo', { kw: 1.32, co2: .98, rel: -6, cost: 1.3, dev: 1.3 }, 'Biturbo'] };
const CHEM = { lfp: ['LFP · robuste et économique', { kw: .96, kg: 1.08, rel: 5, cost: .88, dev: .9 }, 'LFP'], nmc: ['NMC · équilibrée', {}, ''], ssb: ['Solide · haut de gamme', { kw: 1.06, kg: .85, rel: 2, cost: 1.45, dev: 1.4 }, 'Solide'] };
const MAT = { acier: ['Acier', {}, ''], alu: ['Aluminium', { kg: .86, cost: 1.15, saf: 1, dev: 1.1 }, 'Alu'], comp: ['Composite', { kg: .74, cost: 1.45, saf: 3, dev: 1.25 }, 'Composite'] };
const AERO = { std: ['Standard', {}, ''], sop: ['Soignée', { dr: .96, cost: 1.06, hnd: 2, dev: 1.06 }, 'Aéro+'], act: ['Active', { dr: .92, cost: 1.15, hnd: 4, dev: 1.15 }, 'Aéro active'] };
const RAT = { 5: ['5 rapports', { eff: -3, ref: -2, cost: .92, dev: .92 }, '5 rapp.'], 6: ['6 rapports', {}, ''], 8: ['8 rapports', { eff: 4, ref: 3, cost: 1.15, dev: 1.15 }, '8 rapp.'], 10: ['10 rapports', { eff: 6, ref: 5, cost: 1.3, dev: 1.3 }, '10 rapp.'] };
const PW = { '0.8': ['−20 % de puissance · sobre', { kw: .8, co2: .82, rel: 4, cost: .92, dev: .95 }, '−20 %'], '0.9': ['−10 % de puissance', { kw: .9, co2: .91, rel: 2, cost: .96, dev: .98 }, '−10 %'], '1': ['Puissance de référence', {}, ''], '1.1': ['+10 % de puissance', { kw: 1.1, co2: 1.1, rel: -2, cost: 1.06, dev: 1.03 }, '+10 %'], '1.2': ['+20 % de puissance · sportif', { kw: 1.2, co2: 1.2, rel: -4.5, cost: 1.13, dev: 1.07 }, '+20 %'], '1.3': ['+30 % de puissance · extrême', { kw: 1.3, co2: 1.32, rel: -7, cost: 1.22, dev: 1.12 }, '+30 %'] };
const CYLO = [[2, 3, 4], [3, 4, 5, 6], [4, 5, 6, 8], [6, 8, 10, 12]], CDEF = [3, 4, 6, 8];
const cylTbl = s => { const i = (s.size || 1) - 1, o = {}; for (const c of CYLO[i]) { const d = c - CDEF[i]; o[c] = [c + ' cylindres' + (d === 0 ? ' · équilibré' : d < 0 ? ' · compact' : ' · puissant'), d === 0 ? {} : { kw: 1 + .075 * d, kg: 1 + .05 * d, cost: 1 + .06 * d, co2: 1 + .022 * d, rel: -.7 * Math.max(0, d), dev: 1 + .03 * Math.abs(d) }, c + ' cyl.']; } return o; };
const HYB = { mild: ['Micro-hybride 48 V', { kw: .97, co2: 1.18, cost: .8, kg: .9, dev: .85 }, '48 V'], full: ['Hybride complet', {}, ''], plug: ['Hybride rechargeable', { kw: 1.06, co2: .55, cost: 1.4, kg: 1.18, dev: 1.3 }, 'Rechargeable'] };
const PACK = { s: ['Batterie compacte · 40 kWh', { kg: .8, cost: .82, dev: .92, rel: 1 }, '40 kWh'], m: ['Batterie standard · 60 kWh', {}, ''], l: ['Batterie longue autonomie · 85 kWh', { kg: 1.22, cost: 1.32, dev: 1.1, rel: -1 }, '85 kWh'] };
const DRV = { fwd: ['Traction', {}, ''], rwd: ['Propulsion', { hnd: 3, cmf: -1, kg: 1.02, cost: 1.04, dev: 1.04 }, 'Propulsion'], awd: ['Transmission intégrale', { hnd: 2, saf: 2, kg: 1.07, cost: 1.18, dev: 1.12 }, 'Intégrale'] };
const SUS = { std: ['Suspension classique', {}, ''], adapt: ['Suspension pilotée', { cmf: 3, hnd: 3, cost: 1.1, dev: 1.1 }, 'Pilotée'], air: ['Suspension pneumatique', { cmf: 7, hnd: 1, kg: 1.02, cost: 1.25, dev: 1.2 }, 'Pneumatique'] };
const fxo = (tbl, k, d) => (tbl[k == null ? d : k] || tbl[d])[1], fv = (o, k, d) => o[k] == null ? d : o[k], tagOf = (tbl, k, d) => k != null && k !== d && tbl[k] ? tbl[k][2] : '';
const PARAMS = {
  eng: s => s.fuel === 'elec' ? [['pw', 'Puissance cible', PW, '1'], ['chem', 'Chimie de batterie', CHEM, 'nmc'], ['pack', 'Capacité de batterie', PACK, 'm']] : s.sim ? (s.fuel === 'hyb' ? [['hyb', 'Niveau d\'hybridation', HYB, 'full']] : []) : [['cyl', 'Nombre de cylindres', cylTbl(s), String(CDEF[(s.size || 1) - 1])], ['pw', 'Puissance cible', PW, '1'], ['air', 'Admission', AIR, 'atmo']].concat(s.fuel === 'hyb' ? [['hyb', 'Niveau d\'hybridation', HYB, 'full']] : []),
  chs: s => [['drv', 'Transmission', DRV, 'fwd'], ['sus', 'Suspension', SUS, 'std'], ['mat', 'Matériaux', MAT, 'acier'], ['aero', 'Aérodynamique', AERO, 'std']],
  gbx: s => s.type === 'red' ? [] : [['rat', 'Nombre de rapports', RAT, '6']]
};

/* ---- Technologies : chaque niveau est une vraie avancée (et plus un simple « N3 ») ---- */
const TECH = {
  eng: {
    ess: [['Injection indirecte', 'Le classique fiable, sans artifice.'], ['Multisoupapes', 'Quatre soupapes par cylindre : plus de souffle.'], ['Distribution variable', 'Le calage s\'adapte au régime : couple plus rond.'], ['Injection directe', 'Combustion plus précise, moins de consommation.'], ['Downsizing turbo', 'Petite cylindrée suralimentée : puissance et sobriété.'], ['Cycle Miller + 48 V', 'Rendement thermique en hausse, micro-hybridation.'], ['Taux de compression variable', 'Le moteur change de rapport volumétrique en roulant.'], ['Préchambre de combustion', 'Mélange pauvre maîtrisé : rendement de classe diesel.']],
    die: [['Common rail', 'Injection haute pression, silencieuse.'], ['Turbo à géométrie variable', 'Du couple dès les bas régimes.'], ['Injection 2 000 bar', 'Combustion fine, moins de particules.'], ['Double SCR', 'Dépollution des NOx en sortie d\'échappement.'], ['Mild-hybrid 48 V', 'Le démarreur-alternateur soulage le diesel.'], ['Combustion pilotée', 'Capteurs dans la chambre : calibrage en temps réel.'], ['Suralimentation électrique', 'Un compresseur électrique supprime le temps de réponse.'], ['Carburants de synthèse', 'Compatible e-diesel : bilan carbone très réduit.']],
    hyb: [['Micro-hybride', 'Un petit coup de pouce électrique.'], ['Hybride série-parallèle', 'Deux moteurs qui se relaient intelligemment.'], ['Cycle Atkinson', 'Le thermique est optimisé pour l\'hybride.'], ['Rechargeable 50 km', 'Tu roules en électrique au quotidien.'], ['Rechargeable 80 km', 'Batterie plus dense, vraie polyvalence.'], ['Prolongateur d\'autonomie', 'Le thermique ne fait que produire du courant.'], ['Moteur dédié hybride', 'Un thermique conçu uniquement pour l\'hybride.'], ['Hybride intégré 800 V', 'Charge ultra-rapide et puissance cumulée.']],
    elec: [['Batterie 40 kWh', 'Autonomie de base pour la ville.'], ['Pompe à chaleur', 'Moins de perte d\'autonomie l\'hiver.'], ['Charge rapide 150 kW', 'Quinze minutes pour 200 km.'], ['Cellules haute densité', 'Plus d\'énergie pour le même poids.'], ['Architecture 800 V', 'Charge très rapide, câbles plus légers.'], ['Moteur à flux axial', 'Compact, puissant, léger.'], ['Batterie semi-solide', 'Densité et sécurité en hausse.'], ['Charge 350 kW bidirectionnelle', 'La voiture alimente aussi la maison.']]
  },
  chs: [['Acier monocoque', 'La base économique.'], ['Acier haute résistance', 'Plus rigide, plus léger.'], ['Plateforme modulaire', 'Une base commune à plusieurs modèles.'], ['Multi-matériaux', 'Acier, aluminium et composites aux bons endroits.'], ['Amortissement piloté', 'Les suspensions s\'adaptent à la route.'], ['Châssis actif 48 V', 'Anti-roulis actif, tenue bluffante.'], ['Structure mégacoulée', 'Une seule pièce coulée : rigidité et coût de série.'], ['Châssis prédictif', 'Il anticipe la route grâce aux capteurs.']],
  gbx: [['Rapports étagés', 'Mécanique classique.'], ['Synchros renforcés', 'Passages plus nets, plus durable.'], ['Gestion électronique', 'Le calculateur gère la boîte.'], ['Étagement optimisé', 'Meilleur rendement sur cycle.'], ['Commande by-wire', 'Plus de lien mécanique avec le levier.'], ['Gestion prédictive', 'La boîte lit la route avant toi.'], ['Boîte intégrée à l\'essieu', 'Plus compacte et plus efficace.'], ['Boîte adaptative', 'Elle apprend ton style de conduite.']]
};
const TECH_START = 6, TECH_STEP = 3, ADV_COST = [0, 90e6, 240e6];
const techRow = (kind, s) => { const T = kind === 'eng' ? TECH.eng[s.fuel] || TECH.eng.ess : TECH[kind]; return T[clamp((s.lvl || 1) - 1, 0, 7)]; };
const techNm = (kind, s) => techRow(kind, s)[0];
const techFront = G => Math.min(8, eraOf(G).tf0 + Math.floor(yrs(G) / eraOf(G).st));   // niveau de pointe du marché mondial
const techAvail = (G, a) => Math.min(8, techFront(G) + (a.adv || 0));
const techYear = n => { const E = eraOf(TE.G); return (TE.cal().startYear || 0) + Math.max(0, n - E.tf0) * E.st; };
const techLag = (G, lvl) => clamp(techFront(G) - 3 - lvl, 0, 3);   // 3 niveaux de retard sur le marché : la technologie est jugée dépassée
/* ---- Arbre de technologies : 8 branches, de 1980 aux technologies du futur ---- */
const TT_BR = [['mot', 'Moteur thermique'], ['ele', 'Électrification'], ['chs', 'Châssis & matériaux'], ['trs', 'Transmission'], ['sec', 'Sécurité & assistance'], ['num', 'Numérique & autonomie'], ['ind', 'Production'], ['nrj', 'Énergie & aéro']];
const TT_FX = { cost: ['Coût unitaire', '%', -1], rel: ['Fiabilité', 'pt', 1], design: ['Design perçu', 'pt', 1], safety: ['Sécurité', 'pt', 1], co2: ['CO2 / consommation', '%', -1], rd: ['Vitesse de R&D', '%', 1], batt: ['Coût batterie', '%', -1] };
const TT = [].concat(...[
  ['mot', [['Injection électronique', 1982, '', { rel: 1 }, 'Le carburateur disparaît.'], ['Catalyseur trois voies', 1987, 'mot1', { co2: 1 }, 'Les gaz d\'échappement sont enfin traités.'], ['Moteur 16 soupapes', 1990, 'mot2', { rel: 1 }, 'Plus de souffle à haut régime.'], ['Distribution variable', 1999, 'mot3', { co2: 2 }, 'Le calage suit le régime.'], ['Injection directe essence', 2004, 'mot4', { co2: 3 }, 'Combustion précise, consommation réduite.'], ['Downsizing turbo', 2010, 'mot5', { co2: 3, cost: 1 }, 'Petite cylindrée suralimentée.'], ['Cycle Miller + 48 V', 2020, 'mot6', { co2: 4 }, 'Rendement thermique au sommet.'], ['Taux de compression variable', 2029, 'mot7', { co2: 4, rel: 1 }, 'Le moteur ajuste sa géométrie en roulant.'], ['Pré-chambre de combustion', 2034, 'mot8', { co2: 4 }, 'Allumage par jet : mélanges ultra-pauvres.'], ['Combustion pilotée par IA', 2041, 'mot9', { co2: 5, rel: 2 }, 'Chaque cylindre calibré en temps réel.'], ['Moteur à hydrogène', 2048, 'mot10', { co2: 8 }, 'Un thermique qui ne rejette que de l\'eau.']]],
  ['ele', [['Hybride série-parallèle', 1997, 'mot2', { co2: 2 }, 'Deux moteurs qui se relaient.'], ['Batteries nickel-hydrure', 2001, 'ele1', { batt: 3 }, 'Premières batteries de traction fiables.'], ['Lithium-ion automobile', 2010, 'ele2', { batt: 8, co2: 2 }, 'Le saut de densité qui change tout.'], ['Charge rapide 50 kW', 2014, 'ele3', { rel: 1 }, 'Un plein en une demi-heure.'], ['Hybride rechargeable', 2016, 'ele3', { co2: 4 }, 'Le quotidien en électrique.'], ['Cellules haute densité', 2020, 'ele4', { batt: 8 }, 'Plus d\'énergie pour le même poids.'], ['Architecture 800 V', 2023, 'ele6', { batt: 4, rd: 2 }, 'Charge très rapide, câbles allégés.'], ['Batterie semi-solide', 2029, 'ele7', { batt: 10, safety: 2 }, 'Moins d\'électrolyte liquide, plus de sûreté.'], ['Batterie solide', 2034, 'ele8', { batt: 14, safety: 2 }, 'Densité record, risque d\'incendie quasi nul.'], ['Recharge en 5 minutes', 2037, 'ele9', { rel: 2, design: 2 }, 'Plus aucun frein à l\'électrique.'], ['Lithium-soufre', 2043, 'ele10', { batt: 14 }, 'Deux fois plus léger pour la même énergie.'], ['Supercondensateurs hybrides', 2056, 'ele11', { batt: 12, rel: 3 }, 'Puissance instantanée et durée de vie sans limite.']]],
  ['chs', [['Acier haute résistance', 1985, '', { safety: 1 }, 'Plus rigide, plus léger.'], ['Caisse zinguée', 1988, 'chs1', { rel: 2 }, 'La rouille recule enfin.'], ['Aluminium structurel', 1994, 'chs2', { cost: 1, safety: 1 }, 'Un châssis allégé de 40 %.'], ['Plateforme modulaire', 2012, 'chs3', { cost: 4 }, 'Une base commune à plusieurs modèles.'], ['Multi-matériaux', 2016, 'chs4', { safety: 2 }, 'Acier, alu et composites aux bons endroits.'], ['Fibre de carbone en série', 2022, 'chs5', { design: 3 }, 'Légèreté de supercar à prix d\'industrie.'], ['Mégacoulée', 2024, 'chs4', { cost: 5 }, 'Un seul moulage pour tout l\'arrière.'], ['Batterie structurelle', 2030, 'chs7', { cost: 3, safety: 2 }, 'La batterie devient le plancher.'], ['Matériaux auto-cicatrisants', 2038, 'chs8', { rel: 3, design: 2 }, 'Les rayures se referment seules.'], ['Nanocomposites', 2046, 'chs9', { safety: 4, cost: 2 }, 'Aussi dur que l\'acier, trois fois plus léger.'], ['Châssis imprimé 3D', 2054, 'chs10', { cost: 5, design: 3 }, 'Géométries impossibles à usiner.']]],
  ['trs', [['Boîte 5 rapports', 1982, '', { rel: 1 }, 'La référence mécanique.'], ['Transmission intégrale permanente', 1990, 'trs1', { safety: 1 }, 'Motricité sur toutes les routes.'], ['Boîte automatique 6 rapports', 1998, 'trs1', { rel: 1 }, 'Confort sans compromis.'], ['Double embrayage', 2003, 'trs3', { design: 1 }, 'Passages instantanés.'], ['Boîte 8 rapports', 2013, 'trs4', { co2: 2 }, 'Rendement sur cycle optimisé.'], ['Réducteur électrique monovitesse', 2014, 'ele3', { cost: 2 }, 'Une pièce là où il y en avait cent.'], ['Vectorisation de couple', 2022, 'trs6', { safety: 2, design: 1 }, 'Chaque roue reçoit son couple.'], ['Moteur à flux axial', 2028, 'trs7', { cost: 2, rel: 1 }, 'Compact, puissant, léger.'], ['Transmission by-wire', 2032, 'trs8', { rd: 3 }, 'Plus aucun lien mécanique.'], ['Moteurs-roues', 2037, 'trs9', { cost: 4, design: 2 }, 'Quatre moteurs, zéro arbre.'], ['Moteurs supraconducteurs', 2052, 'trs10', { co2: 5, rel: 2 }, 'Rendement proche de 100 %.']]],
  ['sec', [['ABS', 1985, '', { safety: 2 }, 'Freiner sans bloquer.'], ['Airbag conducteur', 1988, 'sec1', { safety: 2 }, 'Le premier coussin gonflable.'], ['Contrôle de stabilité ESP', 1997, 'sec1', { safety: 3 }, 'La voiture se rattrape seule.'], ['Airbags rideaux', 2002, 'sec2', { safety: 2 }, 'Protection latérale intégrale.'], ['Freinage d\'urgence autonome', 2012, 'sec3', { safety: 3 }, 'Le radar freine avant toi.'], ['Régulateur adaptatif', 2014, 'sec5', { design: 1, safety: 1 }, 'Distance de sécurité automatique.'], ['Maintien dans la voie', 2016, 'sec6', { safety: 2 }, 'Une aide permanente au volant.'], ['Détection des piétons', 2019, 'sec7', { safety: 2 }, 'La vision par caméra identifie les usagers.'], ['Communication V2X', 2028, 'sec8', { safety: 3, rd: 2 }, 'Les voitures se préviennent entre elles.'], ['Airbags externes', 2036, 'sec9', { safety: 3 }, 'Le piéton est protégé aussi.'], ['Prévention prédictive', 2043, 'sec10', { safety: 4, rel: 2 }, 'L\'IA anticipe l\'accident avant qu\'il n\'arrive.'], ['Zéro accident', 2050, 'sec11', { safety: 6, design: 2 }, 'Objectif ultime de la sécurité routière.']]],
  ['num', [['Ordinateur de bord', 1985, '', { design: 1 }, 'Consommation et autonomie affichées.'], ['Navigation GPS', 1998, 'num1', { design: 2 }, 'Plus besoin de cartes.'], ['Écran tactile central', 2007, 'num2', { design: 2 }, 'La planche de bord se numérise.'], ['Connectivité 4G', 2013, 'num3', { rd: 2 }, 'La voiture reste en ligne.'], ['Mises à jour à distance', 2017, 'num4', { rel: 2, rd: 2 }, 'Corriger sans passer au garage.'], ['Architecture centralisée', 2022, 'num5', { cost: 3, rd: 3 }, 'Un cerveau au lieu de cent calculateurs.'], ['Conduite autonome niveau 3', 2026, 'num6', { design: 3 }, 'Mains libres sur autoroute.'], ['Assistant IA embarqué', 2030, 'num7', { design: 3, rd: 3 }, 'Un copilote qui comprend tout.'], ['Autonomie niveau 4', 2033, 'num8', { design: 4, safety: 2 }, 'Aucune supervision en zone définie.'], ['Autonomie niveau 5', 2040, 'num9', { design: 5, safety: 3 }, 'Partout, tout le temps.'], ['Cockpit holographique', 2045, 'num10', { design: 5 }, 'L\'habitacle devient un salon.'], ['Flotte robotaxi coordonnée', 2052, 'num10', { rd: 5, cost: 2 }, 'Les véhicules s\'optimisent en réseau.']]],
  ['ind', [['Robots de soudure', 1982, '', { cost: 1, rel: 1 }, 'Régularité de la caisse.'], ['Juste-à-temps', 1985, 'ind1', { cost: 2 }, 'Le stock disparaît des usines.'], ['Plateformes communes', 1995, 'ind2', { cost: 3 }, 'Les économies d\'échelle entre modèles.'], ['Usine modulaire', 2005, 'ind3', { cost: 2, rd: 1 }, 'Les lignes se reconfigurent vite.'], ['Industrie 4.0', 2015, 'ind4', { cost: 3, rel: 1 }, 'Capteurs et données sur toute la ligne.'], ['Jumeau numérique', 2022, 'ind5', { rd: 4, rel: 1 }, 'L\'usine est simulée avant d\'être construite.'], ['Fabrication additive', 2028, 'ind6', { cost: 3, rd: 2 }, 'Les prototypes en quelques heures.'], ['Usine pilotée par IA', 2033, 'ind7', { cost: 4, rel: 2 }, 'Qualité contrôlée en continu.'], ['Micro-usines locales', 2040, 'ind8', { cost: 4 }, 'Produire au plus près du client.'], ['Assemblage autonome', 2048, 'ind9', { cost: 5, rd: 4 }, 'Des usines qui s\'auto-organisent.'], ['Recyclage circulaire total', 2058, 'ind10', { cost: 6, co2: 4 }, 'Chaque voiture alimente la suivante.']]],
  ['nrj', [['Soufflerie et CFD', 1988, '', { co2: 1, design: 1 }, 'L\'aérodynamique devient une science.'], ['Pneus basse résistance', 1995, 'nrj1', { co2: 2 }, 'Gain direct sur la consommation.'], ['Biocarburants E85', 2005, 'nrj2', { co2: 3 }, 'Du carburant venu des champs.'], ['Aéro active', 2015, 'nrj3', { co2: 2, design: 2 }, 'Volets et déflecteurs mobiles.'], ['Pile à combustible', 2018, 'nrj4', { co2: 4, batt: 2 }, 'Hydrogène en électricité.'], ['Carburants de synthèse', 2027, 'nrj5', { co2: 5 }, 'Neutres en carbone, compatibles thermique.'], ['Panneaux solaires de carrosserie', 2031, 'nrj6', { co2: 3, design: 2 }, 'Des kilomètres gratuits chaque jour.'], ['Recharge sans fil', 2035, 'nrj7', { design: 3, rd: 2 }, 'Se garer suffit à recharger.'], ['Hydrogène liquide embarqué', 2041, 'nrj8', { co2: 5, batt: 3 }, 'Grande autonomie sans batterie lourde.'], ['Récupération d\'énergie totale', 2047, 'nrj9', { co2: 5 }, 'Chaleur, vibration, freinage : tout est recyclé.'], ['Recharge ambiante', 2060, 'nrj10', { co2: 8, batt: 6 }, 'La voiture capte l\'énergie de son environnement.']]]
].map(b => b[1].map((r, i) => ({ id: b[0] + (i + 1), br: b[0], n: i + 1, nm: r[0], y: r[1], req: r[2] ? [r[2]] : [], fx: r[3], tx: r[4] })))).map(x => { const k = x.y - 1980; x.cost = Math.round(10e6 * (1 + Math.max(0, x.y - 2000) / 8) / 1e6) * 1e6; x.dur = 3 + Math.floor(k / 9); return x; });
const TTI = {}; TT.forEach(x => TTI[x.id] = x);
const ttYear = G => (TE.cal().startYear || 0) + Math.floor(yrs(G));
const ttLegacy = x => x.y <= (TE.cal().startYear || 0) - 4;   // acquis par tout le monde au départ
const ttKnown = (a, x) => ttLegacy(x) || !!(a.tech && a.tech[x.id] != null);
const ttDone = (a, x) => !!(a.tech && a.tech[x.id] != null && !ttLegacy(x));
const ttFx = (a, k) => { let s = 0; for (const x of TT) if (x.fx[k] && ttDone(a, x)) s += x.fx[k]; return s; };
const ttCost = (G, a, x) => Math.round(x.cost * Math.max(1, 1 + 0.25 * (x.y - ttYear(G))) / 1e5) * 1e5;
const ttState = (G, a, x) => ttKnown(a, x) ? 'ok' : (a.tq || []).some(q => q.id === x.id) ? 'run' : x.req.some(r => !ttKnown(a, TTI[r])) ? 'req' : x.y > ttYear(G) + 4 ? 'wait' : 'open';
const ttFxTxt = x => Object.keys(x.fx).map(k => { const f = TT_FX[k]; return (f[2] < 0 ? '−' : '+') + x.fx[k] + (f[1] === '%' ? ' %' : ' pt') + ' ' + f[0].toLowerCase(); }).join(' · ');
function panelTechList(G, p) {
  const BR = fU('ttb') || 'all', yr = ttYear(G), list = TT.filter(x => BR === 'all' || x.br === BR).sort((a, b) => a.y - b.y || a.n - b.n), q = p.tq || [], nOk = TT.filter(x => ttDone(p, x)).length, nAll = TT.filter(x => !ttLegacy(x)).length;
  const slots = 2 + (p.staff.ingenieurs.n >= 400 ? 1 : 0), top = H.kv([['Technologies maîtrisées', nOk + ' / ' + nAll], ['Laboratoires', q.length + ' / ' + slots], ['Année', String(yr)]]);
  const run = q.length ? q.map(r => { const x = TTI[r.id]; return '<div class="trl"><span><b>' + esc(x.nm) + '</b> <small class="muted">· ' + esc(TT_BR.find(b => b[0] === x.br)[1]) + '</small></span><span class="tv">' + (r.tot - r.left) + '/' + r.tot + ' mois</span></div>' + H.bar(r.tot - r.left, r.tot, ''); }).join('') : '<p class="muted" style="font-size:13px">Aucune recherche en cours. Lance une technologie : elle coûte de l\'argent et du temps (plus d\'ingénieurs = plus rapide).</p>';
  const flt = H.filter('Branche', 'ttb', BR === 'all' ? '' : BR, [['', 'Toutes']].concat(TT_BR.map(b => [b[0], b[1]])));
  const row = x => { const s = ttState(G, p, x), c = ttCost(G, p, x), dur = Math.max(2, Math.ceil(x.dur / rdSpeed(p))), br = BR === 'all' ? ' <small class="muted">· ' + esc(TT_BR.find(b => b[0] === x.br)[1]) + '</small>' : '', reqs = x.req.filter(r => !ttKnown(p, TTI[r])).map(r => TTI[r].nm).join(', ');
    const act = s === 'ok' ? H.pill(ttLegacy(x) ? 'standard' : 'maîtrisée', ttLegacy(x) ? '' : 'good') : s === 'run' ? H.pill('en cours', 'info') : s === 'req' ? '<small class="muted">requiert ' + esc(reqs) + '</small>' : s === 'wait' ? '<small class="muted">disponible en ' + (x.y - 4) + '</small>' : '<button class="btn sm" data-act="rtech" data-id="' + x.id + '">' + money(c) + ' · ' + dur + ' m</button>';
    return '<div class="ttn ' + s + '"><div class="ttd"><b>' + x.y + '</b></div><div class="ttb"><div class="trl"><span><b>' + esc(x.nm) + '</b>' + br + '</span><span class="tv">' + act + '</span></div><div class="muted" style="font-size:12.5px">' + esc(x.tx) + (ttFxTxt(x) ? ' <span class="ttfx">' + esc(ttFxTxt(x)) + '</span>' : '') + (x.y > yr && s !== 'ok' ? ' <i>(avance sur le marché : surcoût ' + Math.round(100 * (ttCost(G, p, x) / x.cost - 1)) + ' %)</i>' : '') + '</div></div></div>'; };
  return H.card('Arbre de technologies', top + '<p class="muted" style="font-size:13px">Des années 80 aux technologies du futur. Les technologies d\'avant ' + ((TE.cal().startYear || 0) - 4) + ' sont acquises ; les suivantes se recherchent, jusqu\'à 4 ans avant leur arrivée sur le marché (avec surcoût). Chaque technologie améliore durablement tes voitures.</p>') + H.card('Recherches en cours', run) + H.card('Technologies', flt + '<div class="ttl">' + list.map(row).join('') + '</div>');
}
const TT_COL = { mot: '#e5793c', ele: '#3fb8e0', chs: '#a0a8b8', trs: '#c58be0', sec: '#e0556b', num: '#5f8cf0', ind: '#d8b94a', nrj: '#58c97e' };
function panelTech(G, p) {
  const V = fU('ttv') || 'tree', sw = H.filter('Vue', 'ttv', V, [['tree', 'Arbre'], ['list', 'Liste']]);
  if (V === 'list') return sw + panelTechList(G, p);
  const yr = ttYear(G), X0 = 124, PX = 21, LH = 132, TOP = 34, W = X0 + 81 * PX + 40, Hh = TOP + TT_BR.length * LH + 10, nx = x => X0 + (x.y - 1980) * PX, ny = x => TOP + TT_BR.findIndex(b => b[0] === x.br) * LH + LH / 2;
  let sel = TTI[fU('ttsel')]; if (!sel) sel = TT.filter(x => ttState(G, p, x) === 'open').sort((a, b) => a.y - b.y)[0] || TT[0];
  const q = p.tq || [], slots = 2 + (p.staff.ingenieurs.n >= 400 ? 1 : 0), nOk = TT.filter(x => ttDone(p, x)).length, nAll = TT.filter(x => !ttLegacy(x)).length;
  let svg = '<svg class="ttsvg" width="' + W + '" height="' + Hh + '" viewBox="0 0 ' + W + ' ' + Hh + '" aria-hidden="true">';
  TT_BR.forEach((b, i) => { svg += '<rect x="0" y="' + (TOP + i * LH) + '" width="' + W + '" height="' + LH + '" fill="' + (i % 2 ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,.045)') + '"/>'; });
  for (let y = 1980; y <= 2060; y += 10) svg += '<line x1="' + (X0 + (y - 1980) * PX) + '" y1="' + TOP + '" x2="' + (X0 + (y - 1980) * PX) + '" y2="' + Hh + '" stroke="rgba(0,0,0,.08)"/><text x="' + (X0 + (y - 1980) * PX + 4) + '" y="29" fill="#7a6f66" font-size="12">' + y + '</text>';
  const xn = X0 + (yr - 1980) * PX, xm = X0 + (yr + 4 - 1980) * PX;
  svg += '<line x1="' + xn + '" y1="' + TOP + '" x2="' + xn + '" y2="' + Hh + '" stroke="#e0a030" stroke-width="2"/><text x="' + (xn + 4) + '" y="11" fill="#e0a030" font-size="11">aujourd\'hui</text><line x1="' + xm + '" y1="' + TOP + '" x2="' + xm + '" y2="' + Hh + '" stroke="#e0a030" stroke-dasharray="4 4" opacity=".6"/><text x="' + (xm + 4) + '" y="11" fill="#e0a030" opacity=".7" font-size="11">recherche possible</text>';
  for (const x of TT) for (const r of x.req) { const a = TTI[r], st = ttState(G, p, x), x1 = nx(a), y1 = ny(a), x2 = nx(x), y2 = ny(x), m = (x1 + x2) / 2, on = ttKnown(p, x), lit = ttKnown(p, a);
    svg += '<path d="M' + x1 + ' ' + y1 + ' C' + m + ' ' + y1 + ' ' + m + ' ' + y2 + ' ' + x2 + ' ' + y2 + '" fill="none" stroke="' + (on ? TT_COL[x.br] : lit ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.18)') + '" stroke-width="' + (a.br !== x.br ? 1.5 : on ? 3 : 2) + '"' + (a.br !== x.br ? ' stroke-dasharray="5 4" opacity=".55"' : on ? '' : ' stroke-dasharray="' + (lit ? '0' : '3 4') + '"') + '/>'; }
  svg += TT_BR.map((b, i) => '<text x="10" y="' + (TOP + i * LH + LH / 2 + 4) + '" fill="' + TT_COL[b[0]] + '" font-size="13" font-weight="700">' + esc(b[1]) + '</text>').join('') + '</svg>';
  const nodes = TT.map(x => { const s = ttState(G, p, x), up = x.n % 2 === 0; return '<button class="ttnode ' + s + (ttLegacy(x) ? ' leg' : '') + (x.id === sel.id ? ' sel' : '') + '" style="left:' + (nx(x) - 17) + 'px;top:' + (ny(x) - 17) + 'px;--c:' + TT_COL[x.br] + '" data-act="ttsel" data-id="' + x.id + '" aria-label="' + esc(x.nm) + ' ' + x.y + '"><span>' + (s === 'ok' ? '✓' : s === 'run' ? '…' : s === 'req' || s === 'wait' ? '🔒'.slice(0, 0) + '•' : '★') + '</span><em class="' + (up ? 'up' : 'dn') + '">' + esc(x.nm) + '<small>' + x.y + '</small></em></button>'; }).join('');
  const s = ttState(G, p, sel), c = ttCost(G, p, sel), dur = Math.max(2, Math.ceil(sel.dur / rdSpeed(p))), reqs = sel.req.map(r => TTI[r]), r0 = q.find(r => r.id === sel.id);
  const det = H.card(esc(sel.nm) + ' <small class="muted">· ' + sel.y + ' · ' + esc(TT_BR.find(b => b[0] === sel.br)[1]) + '</small>', '<p style="margin:0 0 6px">' + esc(sel.tx) + '</p><p class="ttfx" style="margin:0 0 8px">' + esc(ttFxTxt(sel)) + '</p>' + (reqs.length ? '<p class="muted" style="font-size:13px;margin:0 0 8px">Requiert : ' + reqs.map(r => (ttKnown(p, r) ? '✓ ' : '✗ ') + esc(r.nm)).join(', ') + '</p>' : '') +
    (s === 'ok' ? H.pill(ttLegacy(sel) ? 'Standard de l\'industrie' : 'Maîtrisée', 'good') : s === 'run' ? H.bar(r0.tot - r0.left, r0.tot, '') + '<small class="muted">' + (r0.tot - r0.left) + '/' + r0.tot + ' mois</small>' : s === 'req' ? H.pill('Prérequis manquants', 'warn') : s === 'wait' ? H.pill('Disponible à partir de ' + (sel.y - 4), '') : '<button class="btn" data-act="rtech" data-id="' + sel.id + '">Rechercher · ' + money(c) + ' · ' + dur + ' mois</button>' + (sel.y > yr ? '<p class="muted" style="font-size:12.5px;margin:6px 0 0">En avance sur le marché : surcoût ' + Math.round(100 * (c / sel.cost - 1)) + ' %.</p>' : '')));
  setTimeout(() => { const el = document.getElementById('ttsc'); if (!el) return; if (!el.dataset.i) { el.dataset.i = 1; el.scrollLeft = UI_ttx(xn); } el.onscroll = () => { TE.UI.ttx = el.scrollLeft; }; }, 0);
  return '<div class="ttwrap">' + sw + H.kv([['Technologies maîtrisées', nOk + ' / ' + nAll], ['Laboratoires', q.length + ' / ' + slots], ['Année', String(yr)]]) + '<div id="ttsc" class="ttsc"><div class="ttcv" style="width:' + W + 'px;height:' + Hh + 'px">' + svg + nodes + '</div></div><p class="muted" style="font-size:12.5px">Fais défiler l\'arbre horizontalement. ✓ acquise · ★ disponible · … en cours · • verrouillée.</p>' + det + '</div>';
}
const UI_ttx = xn => TE.UI.ttx != null ? TE.UI.ttx : Math.max(0, xn - 200);
/* ================= BANC D'ESSAI MOTEUR (mode expert) =================
   Un moteur thermique est défini par ses vraies grandeurs : cylindrée, cylindres, architecture, régime maxi, taux de compression, pression de suralimentation, rapport course/alésage, distribution, injection.
   Le banc calcule la courbe de couple et de puissance (pression moyenne effective × cylindrée × régime), la consommation, la masse, la fiabilité, l'agrément et le coût. */
const SIM_ARCH = { L: ['En ligne', 1, 1], V: ['En V', 1.1, 1.05], B: ['Boxer', 1.12, 1.03] }, SIM_CYL = [2, 3, 4, 5, 6, 8, 10, 12];
const SIM_VV = { n: 'Fixe', v: 'VVT', l: 'VVT + levée' }, SIM_INJ = { i: 'Indirecte', d: 'Directe' }, SIM_AGR = { L2: 30, L3: 48, L4: 55, L5: 68, L6: 92, V6: 76, B4: 68, B6: 84, V8: 78, V10: 84, V12: 97 };
const SIM_DEF = { ess: [['1.2', 3, 'L', 6200, 10.5, 0], ['1.6', 4, 'L', 6400, 10.5, 0], ['2.5', 6, 'L', 6600, 10.5, 0], ['4.5', 8, 'V', 6800, 10.5, 0]], die: [['1.4', 3, 'L', 4600, 16.5, 1], ['2.0', 4, 'L', 4600, 16.5, 1], ['3.0', 6, 'L', 4500, 16.5, 1.1], ['4.5', 8, 'V', 4400, 16.5, 1.2]] };
const simParse = str => { const a = String(str).split('|'); return { d: +a[0], c: +a[1], a: a[2], r: +a[3], cr: +a[4], bo: +a[5], bs: +a[6], vv: a[7], inj: a[8] }; };
const simClass = kw => kw < 95 ? 1 : kw < 145 ? 2 : kw < 235 ? 3 : 4;
function simRun(s, L) {      // courbes de couple et de puissance
  const q = simParse(s.sim), die = s.fuel === 'die', lv = 0.9 + 0.04 * L;
  let b0 = die ? 13.2 : 13.6; b0 *= 1 + 0.012 * (q.cr - (die ? 16.5 : 10.5)); if (q.inj === 'd') b0 *= 1.04; b0 *= q.vv === 'l' ? 1.06 : q.vv === 'v' ? 1.03 : 1;
  let b = b0 * (1 + q.bo * (die ? 0.8 : 0.68)) * lv; const knock = die ? 0 : Math.max(0, q.cr + 4.5 * q.bo - (14 + 0.3 * L)); b *= 1 - 0.05 * knock;
  const xt = clamp((die ? 0.40 : 0.52) / Math.sqrt(q.bs), 0.28, 0.7), A1 = q.vv === 'n' ? 0.5 : q.vv === 'v' ? 0.38 : 0.3, A2 = die ? 0.5 : 0.22, lag = q.bo > 0 ? 0.32 * Math.min(1, q.bo / 1.1) : 0, pts = [];
  let P = 0, T = 0, rP = 0, rT = 0;
  for (let i = 0; i <= 40; i++) { const x = 0.12 + 0.88 * i / 40, r = x * q.r; let f = x < xt ? 1 - A1 * Math.pow((xt - x) / xt, 2) : 1 - A2 * Math.pow((x - xt) / (1 - xt), 2); f *= 1 - lag * Math.exp(-Math.pow(x / 0.22, 2));
    const tq = b * f * q.d * 7.96, kw = b * f * q.d * r / 1200; pts.push([r, tq, kw]); if (kw > P) { P = kw; rP = r; } if (tq > T) { T = tq; rT = r; } }
  return { q, pts, kw: P, tq: T, rP, rT, knock };
}
function simInfo(s, L, g, mat, exp) {
  const R = simRun(s, L), q = R.q, die = s.fuel === 'die', hy = s.fuel === 'hyb', F = FUELS[s.fuel], FX = hy ? [fxo(HYB, s.hyb, 'full')] : [], m = (k, d) => FX.reduce((p, o) => p * fv(o, k, d), 1), ad = k => FX.reduce((p, o) => p + fv(o, k, 0), 0);
  const kw = R.kw * (hy ? F.pw : 1) * m('kw', 1), ch = Math.round(kw * 1.36 / 5) * 5, ci = simClass(kw) - 1, arch = SIM_ARCH[q.a];
  const co2 = (die ? 122 : hy ? F.co2 : 140) * (0.5 + 0.3 * Math.pow(kw / 115, 0.62) + 0.2 * Math.pow(q.d / 1.8, 0.75)) * (die ? 1 : 1 - 0.012 * clamp(q.cr - 10.5, -3, 4)) * (q.inj === 'd' ? 0.95 : 1) * (q.vv === 'l' ? 0.94 : q.vv === 'v' ? 0.97 : 1) * (1 + 0.03 * (q.r - (die ? 4500 : 6000)) / 1000) * (1 + 0.04 * q.bo) * (1 - 0.035 * L) * (1 + 0.012 * R.knock) * m('co2', 1);
  const cost = F.cost * (kw * 14 + 120 * q.c + 250 * q.d) * arch[1] * (1 + (q.bo > 0 ? 0.08 + 0.05 * q.bo : 0)) * (1 + Math.max(0, q.r - (die ? 4500 : 7000)) / 9000) * (q.vv === 'l' ? 1.08 : q.vv === 'v' ? 1.04 : 1) * (q.inj === 'd' ? 1.06 : 1) * (0.85 + 0.06 * L) * m('cost', 1) * exp;
  const kg = ((30 + 32 * q.d + 5 * q.c) * arch[2] + (q.bo > 0 ? 10 + 12 * q.bo : 0) + (hy ? 80 : 0)) * m('kg', 1);
  const rel = clamp(40 + 4 * L + (die ? 3 : 0) + (hy ? -3 : 0) - Math.max(0, q.r - (die ? 4500 : 6500)) / 400 - 5 * q.bo * (die ? 0.6 : 1) - 1.2 * R.knock - (q.vv === 'l' ? 2 : q.vv === 'v' ? 1 : 0) - (q.inj === 'd' ? 1 : 0) - (q.c > 8 ? 3 : 0) + ad('rel') + mat, 15, 96);
  const agr = clamp((SIM_AGR[q.a + q.c] || 55) - Math.max(0, q.r - 6500) / 130 - 4 * q.bo - (die ? 10 : 0) + (q.vv === 'n' ? 0 : 3) - Math.abs(q.bs - 1) * 10, 5, 100);
  const tg = [q.bo > 0 ? 'Turbo' : '', q.a !== 'L' ? arch[0] : '', q.vv !== 'n' ? 'VVT' : '', q.inj === 'd' ? 'Inj. directe' : '', hy ? tagOf(HYB, s.hyb, 'full') : ''].filter(Boolean);
  return { st: { kw, cost, rel, co2, kg, tq: R.tq, rpmP: R.rP, rpmT: R.rT, agr, disp: q.d, ncyl: q.c, arch: q.a }, dev: ENG_DEV[ci] * F.dev * (0.6 + 0.25 * L) * m('dev', 1) * (1 + 0.05 * (q.bo > 0) + 0.04 * (q.vv !== 'n') + 0.04 * (q.inj === 'd') + 0.05 * (q.a !== 'L')) * 1e6, days: 150 + 25 * L,
    name: F.n + ' ' + q.c + ' cyl. ' + nf(q.d, 1) + ' L · ' + ch + ' ch' + (tg.length ? ' · ' + tg.join(' ') : '') + ' · ' + techNm('eng', s) };
}
const simBounds = die => die ? { d: [1, 6.5, 0.1], r: [3500, 5500, 100], cr: [14, 20, 0.1], bo: [0, 2.2, 0.1] } : { d: [0.6, 8, 0.1], r: [4500, 9500, 100], cr: [8, 15, 0.1], bo: [0, 2, 0.1] };
function simInit(M) { const die = M.fuel === 'die', D = (SIM_DEF[die ? 'die' : 'ess'])[clamp(+M.size || 1, 1, 4) - 1]; Object.assign(M, { sd: D[0], sc: String(D[1]), sa: D[2], sr: String(D[3]), scr: String(D[4]), sb: String(D[5]), sbs: '1', sv: 'n', si: 'i' }); }
function simFix(M) {   // cohérence : l'architecture dépend du nombre de cylindres, les valeurs restent dans les bornes
  const B = simBounds(M.fuel === 'die'), c = +M.sc; if (M.sa === 'V' && c < 6) M.sa = 'L'; if (M.sa === 'B' && c !== 4 && c !== 6) M.sa = 'L'; if (M.sa === 'L' && c > 6) M.sa = 'V';
  M.sd = String(clamp(+M.sd, B.d[0], B.d[1])); M.sr = String(clamp(+M.sr, B.r[0], B.r[1])); M.scr = String(clamp(+M.scr, B.cr[0], B.cr[1])); M.sb = String(clamp(+M.sb, B.bo[0], B.bo[1])); M.sbs = String(clamp(+M.sbs, 0.8, 1.3));
}
const simStr = M => [nf(+M.sd, 1).replace(',', '.'), +M.sc, M.sa, Math.round(+M.sr / 100) * 100, (+M.scr).toFixed(1), (+M.sb).toFixed(1), (+M.sbs).toFixed(2), M.sv, M.si].join('|');
const SIM_CTL = [['sd', 'Cylindrée', v => nf(+v, 1) + ' L'], ['sr', 'Régime maximal', v => nf(+v) + ' tr/min'], ['scr', 'Taux de compression', v => nf(+v, 1) + ' : 1'], ['sb', 'Pression de suralimentation', v => +v ? nf(+v, 1) + ' bar' : 'atmosphérique'], ['sbs', 'Course / alésage', v => (+v < 0.95 ? 'carré · ' : +v > 1.05 ? 'longue course · ' : 'équilibré · ') + nf(+v, 2)]];
function simCurve(R, mx) {
  const W = 320, H_ = 150, pl = 54, pr = 42, pt = 12, pb = 24, xs = r => pl + (r - R.pts[0][0]) / (R.q.r - R.pts[0][0]) * (W - pl - pr), mt = Math.max(R.tq * 1.1, 50), mk = Math.max(R.kw * 1.1, 20), yT = v => H_ - pb - v / mt * (H_ - pb - pt), yP = v => H_ - pb - v / mk * (H_ - pb - pt);
  const lt = R.pts.map(p => xs(p[0]).toFixed(1) + ',' + yT(p[1]).toFixed(1)).join(' '), lp = R.pts.map(p => xs(p[0]).toFixed(1) + ',' + yP(p[2]).toFixed(1)).join(' '), tk = [];
  for (let r = Math.ceil(R.pts[0][0] / 1000) * 1000; r <= R.q.r; r += 1000) tk.push('<line x1="' + xs(r) + '" y1="' + pt + '" x2="' + xs(r) + '" y2="' + (H_ - pb) + '" stroke="var(--line)" stroke-width="1"/><text x="' + xs(r) + '" y="' + (H_ - 8) + '" text-anchor="middle" font-size="10.5" fill="var(--muted)">' + r / 1000 + '</text>');
  return '<svg viewBox="0 0 ' + W + ' ' + H_ + '" style="width:100%;height:auto;display:block" role="img" aria-label="Courbes de couple et de puissance">' + tk.join('') +
    '<polyline points="' + lt + '" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round"/><polyline points="' + lp + '" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round" stroke-dasharray="5 3"/>' +
    '<circle cx="' + xs(R.rT) + '" cy="' + yT(R.tq) + '" r="4" fill="var(--accent)"/><circle cx="' + xs(R.rP) + '" cy="' + yP(R.kw) + '" r="4" fill="var(--ink)"/>' +
    '<text x="' + (pl - 4) + '" y="' + (pt + 4) + '" text-anchor="end" font-size="10.5" fill="var(--accent)">' + Math.round(mt) + ' Nm</text><text x="' + (W - pr + 4) + '" y="' + (pt + 4) + '" font-size="10.5" fill="var(--ink)">' + Math.round(mk * 1.36) + ' ch</text></svg>';
}
function simTop(M, G, p) {      // courbes + chiffres clés, collés en haut de la fenêtre pendant les réglages
  simFix(M); const spec = specOf(M), I = partInfo('eng', spec), R = simRun(spec, spec.lvl), st = I.st;
  return '<div class="card" style="padding:8px 12px;margin:0;gap:2px"><div class="simkpi"><b>' + Math.round(st.kw * 1.36) + ' ch</b><b>' + nf(st.tq) + ' Nm</b><span>' + nf(st.disp, 1) + ' L · ' + st.ncyl + ' cyl.</span></div>' + simCurve(R) + '<p class="muted" style="font-size:11px;margin:0"><span style="color:var(--accent)">━</span> couple · <span>╍</span> puissance · régime en 1 000 tr/min</p></div>';
}
function simLive(M, G, p) {
  simFix(M); const spec = specOf(M), I = partInfo('eng', spec), R = simRun(spec, spec.lvl), st = I.st, ch = Math.round(st.kw * 1.36);
  const bar = (l, v, cls) => '<div class="abar"><span>' + l + '</span>' + H.bar(v, 100, cls || (v >= 65 ? 'good' : v < 35 ? 'bad' : '')) + '<b>' + Math.round(v) + '</b></div>';
  return H.kv([['Puissance', ch + ' ch · ' + nf(st.kw) + ' kW à ' + nf(Math.round(st.rpmP / 50) * 50) + ' tr/min'], ['Couple max', nf(st.tq) + ' Nm à ' + nf(Math.round(st.rpmT / 50) * 50) + ' tr/min'], ['Puissance/litre', nf(st.kw * 1.36 / st.disp) + ' ch/L'], ['Consommation', nf(st.co2) + ' g CO₂/km (base)'], ['Masse', nf(st.kg) + ' kg'], ['Coût unitaire', money(st.cost)]]) +
    '<div style="margin-top:6px">' + bar('Fiabilité', st.rel) + bar('Agrément', st.agr) + bar('Sobriété', clamp(100 - (st.co2 - 40) * 0.5, 0, 100)) + bar('Santé du moteur', clamp(100 - R.knock * 22, 0, 100), R.knock > 0.5 ? 'bad' : 'good') + '</div>' +
    (R.knock > 0.3 ? '<p class="neg fnote">Cliquetis : compression et suralimentation trop élevées, la puissance est bridée et la fiabilité chute.</p>' : '') + '<p class="muted fnote">' + esc(I.name) + '</p>';
}
function simCtl(M, G, p) {
  if (M.sd == null) simInit(M); simFix(M); const die = M.fuel === 'die', B = simBounds(die), rg = (k, lbl, lo, hi, st, fmt) => '<div class="f simr"><span>' + lbl + ' <b id="sv_' + k + '">' + fmt(M[k]) + '</b></span><input type="range" min="' + lo + '" max="' + hi + '" step="' + st + '" value="' + M[k] + '" data-lv="' + k + '" aria-label="' + lbl + '"></div>';
  const ar = Object.keys(SIM_ARCH).filter(a => a === 'L' ? +M.sc <= 6 : a === 'V' ? +M.sc >= 6 : +M.sc === 4 || +M.sc === 6);
  return rg('sd', 'Cylindrée', B.d[0], B.d[1], B.d[2], SIM_CTL[0][2]) + '<div class="f"><span>Nombre de cylindres</span>' + chips('sc', M.sc, SIM_CYL.map(n => [n, n])) + '</div>' + (ar.length > 1 ? '<div class="f"><span>Architecture</span>' + chips('sa', M.sa, ar.map(a => [a, SIM_ARCH[a][0]])) + '</div>' : '') +
    rg('sr', 'Régime maximal', B.r[0], B.r[1], B.r[2], SIM_CTL[1][2]) + rg('scr', 'Taux de compression', B.cr[0], B.cr[1], B.cr[2], SIM_CTL[2][2]) + rg('sb', 'Pression de suralimentation', B.bo[0], B.bo[1], B.bo[2], SIM_CTL[3][2]) + rg('sbs', 'Course / alésage', 0.8, 1.3, 0.01, SIM_CTL[4][2]) +
    '<div class="f"><span>Distribution</span>' + chips('sv', M.sv, Object.keys(SIM_VV).map(k => [k, SIM_VV[k]])) + '</div><div class="f"><span>Injection</span>' + chips('si', M.si, Object.keys(SIM_INJ).map(k => [k, SIM_INJ[k]])) + '</div>';
}
function engConf(M, G, p, advChips) {     // réglages d'un moteur thermique : simple (leviers) ou expert (banc d'essai)
  if (M.pk !== 'eng' || M.fuel === 'elec') return { html: advChips, expert: false };
  const xp = M.xp === '1', tog = '<div class="f"><span>Mode de réglage</span>' + chips('xp', xp ? '1' : '0', [['0', 'Simple'], ['1', 'Expert · banc d\'essai']]) + '</div>';
  if (!xp) return { html: tog + advChips, expert: false };
  return { html: tog + '<p class="muted fnote" style="margin:2px 0 6px">Règle les vraies grandeurs du moteur : le banc recalcule en direct les courbes de couple et de puissance, la consommation, la fiabilité et le coût.</p>' + '<div id="simtop" class="simsticky">' + simTop(M, G, p) + '</div>' + simCtl(M, G, p) + advChips + '<div id="simlive">' + simLive(M, G, p) + '</div>', expert: true };
}

function partInfo(kind, s, gen) {   // calcule caractéristiques, coût de développement et durée d'une spécification (gen : génération de la famille)
  const L = s.lvl, g = Math.max(1, gen || 1), mat = Math.min(6, 1.5 * (g - 1)), exp = Math.max(0.9, 1 - 0.02 * (g - 1));   // une famille mûre gagne en fiabilité et en coût
  if (kind === 'eng' && s.sim && s.fuel !== 'elec') return simInfo(s, L, g, mat, exp);
  if (kind === 'eng') {
    const F = FUELS[s.fuel], i = s.size - 1, el = s.fuel === 'elec', FX = [s.pw != null ? fxo(PW, String(s.pw), '1') : fxo(TUNE, s.tune, 'eq'), el ? fxo(CHEM, s.chem, 'nmc') : fxo(AIR, s.air, 'atmo')], cyl = el ? 0 : (s.cyl || CDEF[i]);
    if (el) FX.push(fxo(PACK, s.pack, 'm')); else { FX.push(fxo(cylTbl(s), s.cyl, String(CDEF[i]))); if (s.fuel === 'hyb') FX.push(fxo(HYB, s.hyb, 'full')); }
    const m = (k, d) => FX.reduce((p, o) => p * fv(o, k, d), 1), ad = k => FX.reduce((p, o) => p + fv(o, k, 0), 0), kw = ENG_KW[i] * F.pw * (0.9 + 0.04 * L) * m('kw', 1), ch = Math.round(kw * 1.36 / 5) * 5;
    const tg = [s.pw == null ? tagOf(TUNE, s.tune, 'eq') : '', el ? tagOf(CHEM, s.chem, 'nmc') : tagOf(AIR, s.air, 'atmo'), el ? tagOf(PACK, s.pack, 'm') : s.fuel === 'hyb' ? tagOf(HYB, s.hyb, 'full') : ''].filter(Boolean);
    return { st: { kw, cost: ENG_COST[i] * F.cost * (0.85 + 0.06 * L) * m('cost', 1) * exp, rel: 40 + 4 * L + (el ? 6 : s.fuel === 'hyb' ? -3 : 0) + ad('rel') + mat, co2: F.co2 * ENG_CO2[i] * (1 - 0.035 * L) * m('co2', 1), kg: (ENG_KG[i] + (s.fuel === 'hyb' ? 80 : 0) + (el ? BAT_KG[i] - ENG_KG[i] : 0)) * m('kg', 1) },
      dev: ENG_DEV[i] * F.dev * (0.6 + 0.25 * L) * m('dev', 1) * 1e6, days: 150 + 25 * L, name: F.n + (el ? '' : ' ' + cyl + ' cyl.') + ' · ' + ch + ' ch' + (tg.length ? ' · ' + tg.join(' ') : '') + ' · ' + techNm('eng', s) };
  }
  if (kind === 'chs') {
    const i = s.cls - 1, f = FOCUS[s.focus], FX = [fxo(MAT, s.mat, 'acier'), fxo(AERO, s.aero, 'std'), fxo(DRV, s.drv, 'fwd'), fxo(SUS, s.sus, 'std')], m = (k, d) => FX.reduce((p, o) => p * fv(o, k, d), 1), ad = k => FX.reduce((p, o) => p + fv(o, k, 0), 0);
    const tg = [tagOf(DRV, s.drv, 'fwd'), tagOf(SUS, s.sus, 'std'), tagOf(MAT, s.mat, 'acier'), tagOf(AERO, s.aero, 'std')].filter(Boolean);
    return { st: { maxKW: CHS_KW[i] * (0.9 + 0.04 * L), kg: CHS_KG[i] * (1.1 - 0.03 * L) * m('kg', 1), comfort: 36 + 3.4 * L + f[1] + ad('cmf'), handling: 32 + 3.4 * L + f[2] + ad('hnd'), safety: 40 + 4 * L + ad('saf'), rel: 45 + 3 * L + mat, cost: CHS_COST[i] * (0.85 + 0.06 * L) * m('cost', 1) * exp, dr: m('dr', 1) },
      dev: CHS_DEV[i] * (0.6 + 0.25 * L) * m('dev', 1) * 1e6, days: 180 + 25 * L, name: 'Plateforme ' + 'ABCD'[i] + ' ' + f[0].toLowerCase() + (tg.length ? ' · ' + tg.join(' ') : '') + ' · ' + techNm('chs', s) };
  }
  const T = GBX[s.type], i = s.cap - 1, R = fxo(RAT, s.rat == null ? '6' : String(s.rat), '6'), tg = s.type === 'red' ? '' : tagOf(RAT, s.rat == null ? '6' : String(s.rat), '6');
  return { st: { maxKW: GBX_KW[i] * (0.9 + 0.04 * L), refine: T.ref + 2.5 * L + fv(R, 'ref', 0), eff: T.eff + 2 * L + fv(R, 'eff', 0), rel: 42 + 4 * L + mat, cost: T.cost * GBX_CM[i] * fv(R, 'cost', 1) * exp },
    dev: T.dev * GBX_DM[i] * (0.6 + 0.25 * L) * fv(R, 'dev', 1) * 1e6, days: 120 + 25 * L, name: T.n + ' C' + s.cap + ' · ' + techNm('gbx', s) + (tg ? ' · ' + tg : '') };
}
const KIND_L = { eng: 'Moteur', chs: 'Châssis', gbx: 'Boîte de vitesses' };
const FAMN = { eng: ['Aster', 'Boréal', 'Cyclone', 'Delta', 'Étna', 'Fulgor', 'Gamma', 'Helios', 'Ionos', 'Jura', 'Kappa', 'Lumen', 'Mistral', 'Nimbus', 'Onyx', 'Pulsar'], chs: ['Atlas', 'Bastide', 'Corniche', 'Dolomite', 'Esterel', 'Fjord', 'Granit', 'Horizon', 'Ibis', 'Jaspe'], gbx: ['Tempo', 'Allegro', 'Crescendo', 'Vivace', 'Largo', 'Presto', 'Staccato', 'Legato', 'Adagio', 'Cadence'] };
function famName(a, kind, G) { const L = FAMN[kind], used = new Set(a.parts.concat(a.proj).map(x => x.fname)), free = L.filter(n => !used.has(n)); return free.length ? free[G.nid % free.length] : L[G.nid % L.length] + ' ' + (2 + Math.floor(a.parts.length / L.length)); }
const famId = x => x.fam || x.id, famParts = (a, x) => a.parts.filter(y => y.kind === x.kind && famId(y) === famId(x)), famHead = (a, x) => famParts(a, x).filter(y => !y.arch).sort((u, v) => (v.gen || 1) - (u.gen || 1) || v.born - u.born)[0] || x;
function addPart(a, G, kind, s, meta) {   // meta : { fam, gen, fname, parent } pour une nouvelle génération d'une famille existante
  meta = meta || {}; const gen = meta.gen || 1, I = partInfo(kind, s, gen), id = G.nid++, fname = meta.fname || famName(a, kind, G);
  const p = { id, kind, spec: Object.assign({}, s), st: I.st, name: fname + (gen > 1 ? ' G' + gen : '') + ' · ' + I.name, born: G.day, fam: meta.fam || id, gen, fname, parent: meta.parent || 0 };
  a.parts.push(p); return p;
}
const specKey = s => JSON.stringify(s);
function partSpecEq(a, kind, s) { return a.parts.some(p => p.kind === kind && specKey(p.spec) === specKey(s)) || a.proj.some(p => p.kind === kind && specKey(p.spec) === specKey(s)); }
const rdSpeed = a => clamp((0.55 + a.staff.ingenieurs.n / 450) * (1 + (a.tech ? ttFx(a, 'rd') / 100 : 0)), 0.55, 2.2);
const REDO_KEYS = ['lvl', 'sim', 'tune', 'pw', 'cyl', 'air', 'hyb', 'chem', 'pack', 'focus', 'drv', 'sus', 'mat', 'aero', 'rat'];
function redesignInfo(par, s) {   // un redesign reprend la base d'une pièce existante : moins cher et plus rapide qu'un développement neuf
  const gen = (par.gen || 1) + 1, I = partInfo(par.kind, s, gen), dif = REDO_KEYS.filter(k => k !== 'lvl' && (s[k] == null ? null : String(s[k])) !== (par.spec[k] == null ? null : String(par.spec[k]))).length, dl = Math.max(0, s.lvl - par.spec.lvl), r = clamp(0.30 + 0.07 * dif + 0.10 * dl, 0.30, 0.85);
  return { I, gen, dif, dl, r, dev: I.dev * r, days: Math.round(I.days * (0.5 + 0.5 * r)) };
}
function startPart(a, G, kind, s, from) {
  if (kind === 'eng' && s.fuel && !fuelOk(G, s.fuel)) return 'Cette énergie n\'existe pas encore (' + FUEL_Y[s.fuel] + ').';
  if (s.lvl > techAvail(G, a)) return 'Cette technologie n\'est pas encore disponible (' + techNm(kind, s) + ' : ' + techYear(s.lvl) + ').';
  if (partSpecEq(a, kind, s)) return 'Cette pièce existe déjà ou est en développement.';
  if (from) {
    const par = partOf(a, from); if (!par || par.kind !== kind) return 'Pièce de départ introuvable.';
    if (par.lic) return 'Une pièce sous licence ne peut pas être redessinée.';
    const R = redesignInfo(par, s); if (a.cash < R.dev * 0.25) return 'Trésorerie insuffisante (au moins 25 % du budget).';
    if (!par.fname) { par.fname = famName(a, kind, G); par.name = par.fname + ' · ' + par.name; par.fam = par.id; par.gen = 1; }
    a.proj.push({ id: G.nid++, kind, spec: Object.assign({}, s), left: R.days, total: R.days, monthly: R.dev / (R.days / 30), cost: R.dev, name: par.fname + ' G' + R.gen + ' · ' + R.I.name, fam: famId(par), gen: R.gen, fname: par.fname, parent: par.id });
    return null;
  }
  const I = partInfo(kind, s);
  if (a.cash < I.dev * 0.25) return 'Trésorerie insuffisante (au moins 25 % du budget).';
  const fname = famName(a, kind, G);
  a.proj.push({ id: G.nid++, kind, spec: Object.assign({}, s), left: I.days, total: I.days, monthly: I.dev / (I.days / 30), cost: I.dev, name: fname + ' · ' + I.name, gen: 1, fname });
  return null;
}
// Mise à jour mécanique d'un modèle : il adopte la dernière génération des familles de ses pièces
function mechUp(p, m) {
  if (m.state !== 'sale') return null; const cur = ['eng', 'chs', 'gbx'].map(k => partOf(p, m[k])); if (cur.some(x => !x)) return null;
  const up = cur.map(x => { const h = famHead(p, x); return h !== x && (h.gen || 1) > (x.gen || 1) && !h.lic ? h : x; }); let best = null;
  for (let mask = 1; mask < 8; mask++) { const t = cur.map((x, i) => (mask >> i) & 1 ? up[i] : x), n = t.filter((x, i) => x !== cur[i]).length; if (n && !compat(m.body, t[0], t[1], t[2]) && (!best || n > best.n)) best = { t, n }; }
  return best ? { eng: best.t[0], chs: best.t[1], gbx: best.t[2], n: best.n, cost: devInfo(m.body, m.fin, m.sty).dev * 0.1 * best.n, from: cur } : null;
}

// Tendances de marché : un indice mondial × un écart régional pour la motorisation, les boîtes, les carrosseries et les goûts. Ils dérivent chaque mois.
const TRK = { f_ess: ['Essence', 'Motorisation'], f_die: ['Diesel', 'Motorisation'], f_hyb: ['Hybride', 'Motorisation'], f_elec: ['Électrique', 'Motorisation'], g_man: ['Boîte manuelle', 'Boîtes'], g_auto: ['Boîte automatique', 'Boîtes'], g_dct: ['Double embrayage', 'Boîtes'], s_cit: ['Citadines', 'Carrosseries'], s_comp: ['Compactes', 'Carrosseries'], s_ber: ['Berlines', 'Carrosseries'], s_suv: ['SUV', 'Carrosseries'], s_spo: ['Sportives', 'Carrosseries'], a_economy: ['Sobriété', 'Goûts'], a_perf: ['Performances', 'Goûts'], a_design: ['Design', 'Goûts'], a_space: ['Habitabilité', 'Goûts'], a_comfort: ['Confort', 'Goûts'] };
const TRKEYS = Object.keys(TRK), TRDRIFT = { f_ess: -0.0025, f_die: -0.005, f_hyb: 0.002, f_elec: 0.006, g_man: -0.004, g_auto: 0.002, g_dct: 0.003, s_cit: -0.001, s_suv: 0.0025, s_ber: -0.001 };
const trEff = (tr, r, k) => clamp(tr.g[k] * tr.r[r][k], 0.45, 2);
function trendMonth(G, mi) {
  const g = G.game; let tr = g.tr;
  if (!tr) { tr = g.tr = { g: {}, r: {}, eff: {}, p: null, news: 0 }; for (const k of TRKEYS) tr.g[k] = 1; for (const r of REGK) { tr.r[r] = {}; for (const k of TRKEYS) tr.r[r][k] = 1 + (TE.rng() - 0.5) * 0.12; } }
  for (const k of TRKEYS) {
    let t = tr.g[k] + (TRDRIFT[k] || 0) + (TE.rng() - 0.5) * 0.012; if (k === 'a_economy') t += (1 + 0.6 * (g.fuel - 1) - t) * 0.03; else t += (1 - t) * 0.006; tr.g[k] = clamp(t, 0.55, 1.9);
    for (const r of REGK) { const v = tr.r[r][k]; tr.r[r][k] = clamp(v + (1 - v) * 0.03 + (TE.rng() - 0.5) * 0.024 + (k === 'f_elec' && REGL[r][1] === 'Europe' ? 0.001 : 0), 0.6, 1.6); }
  }
  for (const r of REGK) { tr.eff[r] = {}; for (const k of TRKEYS) tr.eff[r][k] = Math.round(trEff(tr, r, k) * 1000) / 1000; }
  if (!tr.p) tr.p = JSON.parse(JSON.stringify(tr.eff));
  if (mi === 0 || mi === 6) { if (tr.cur) tr.p = tr.cur; tr.cur = JSON.parse(JSON.stringify(tr.eff)); }
  if (mi === 11) { if (tr.gs && G.day > 400) { const mv = TRKEYS.map(k => [k, tr.g[k] / tr.gs[k]]).sort((x, y) => Math.abs(y[1] - 1) - Math.abs(x[1] - 1))[0]; if (mv && Math.abs(mv[1] - 1) > 0.04) TE.news('Tendance mondiale : ' + TRK[mv[0]][0].toLowerCase() + (mv[1] > 1 ? ' gagne du terrain.' : ' perd du terrain.'), 'info'); } tr.gs = Object.assign({}, tr.g); }
}
const trAt = (G, c, k) => { const t = G.game.tr; return t && t.eff[COUNTRIES[c].reg] ? t.eff[COUNTRIES[c].reg][k] || 1 : 1; };
const trAvg = (G, k, regs) => { const t = G.game.tr; if (!t) return { v: 1, d: 0 }; const R = regs || REGK, v = TE.sum(R.map(r => t.eff[r][k])) / R.length, p = t.p ? TE.sum(R.map(r => t.p[r][k])) / R.length : v; return { v, d: v / p - 1 }; };
const trArrow = d => d > 0.04 ? '↑' : d > 0.012 ? '↗' : d < -0.04 ? '↓' : d < -0.012 ? '↘' : '→';

/* =============================== MODÈLES =============================== */
function compat(bodyId, e, c, g) {   // retourne la raison d'incompatibilité, ou null
  const B = BODIES[bodyId];
  if (!e || !c || !g) return 'Choisis un moteur, un châssis et une boîte.';
  if (c.spec.cls < B.size || c.spec.cls > B.size + 1) return 'Plateforme ' + 'ABCD'[c.spec.cls - 1] + ' inadaptée à cette silhouette (classe ' + B.size + ' ou ' + (B.size + 1) + ' requise).';
  if (e.st.kw > c.st.maxKW) return 'Moteur trop puissant pour ce châssis (' + Math.round(e.st.kw) + ' kW > ' + Math.round(c.st.maxKW) + ').';
  if (e.st.kw > g.st.maxKW) return 'Boîte trop faible pour ce moteur (' + Math.round(e.st.kw) + ' kW > ' + Math.round(g.st.maxKW) + ').';
  if ((e.spec.fuel === 'elec') !== (g.spec.type === 'red')) return e.spec.fuel === 'elec' ? 'Un moteur électrique exige un réducteur.' : 'Le réducteur est réservé aux moteurs électriques.';
  return null;
}
function calcModel(bodyId, e, c, g, F, S) {
  const B = BODIES[bodyId], kg = B.kg + c.st.kg + e.st.kg, p2w = e.st.kw / (kg / 1000);
  const co2 = e.st.co2 * Math.pow(kg / 1200, 0.8) * (1 + (60 - g.st.eff) / 300) * (c.st.dr || 1);
  return {
    st: { perf: clamp((p2w - 40) / 1.6 + (g.spec.type === 'dct' ? 3 : 0) + (e.st.tq != null ? clamp((e.st.tq / (kg / 1000) - 140) / 35, -4, 6) : 0), 5, 100), handling: clamp(c.st.handling - Math.max(0, (kg - 1600) / 40), 5, 100), comfort: clamp(c.st.comfort * 0.7 + g.st.refine * 0.3 + (e.st.agr != null ? (e.st.agr - 60) * 0.12 : 0) + FIN_COMF[F - 1], 5, 100), safety: clamp(c.st.safety + FIN_SAF[F - 1], 5, 100),
      rel: clamp(e.st.rel * 0.5 + g.st.rel * 0.3 + c.st.rel * 0.2, 5, 100), design: B.design + STY_DES[S], space: B.space, co2, kg, kw: e.st.kw },
    cost: (B.cost + e.st.cost + c.st.cost + g.st.cost) * FIN_COST[F - 1] * 0.84
  };
}
const suggestPrice = (G, bodyId, F, cost) => Math.max(Math.round(cost * 1.12 / 100) * 100, Math.round(SEG_ANCHOR[BODIES[bodyId].seg] * infl(G) * [0.92, 1.0, 1.14][F - 1] / 100) * 100);
function devInfo(bodyId, F, S) { const B = BODIES[bodyId]; return { dev: (BODY_DEV[B.size - 1] * (1 + 0.25 * (F - 1)) + STY_COST[S]) * 1e6, days: 210 + 30 * S }; }
function startModel(a, G, d) {
  const e = partOf(a, d.eng), c = partOf(a, d.chs), g = partOf(a, d.gbx), why = compat(d.body, e, c, g); if (why) return why;
  const I = devInfo(d.body, d.fin, d.sty); if (a.cash < I.dev * 0.2) return 'Trésorerie insuffisante (au moins 20 % du budget).';
  const C = calcModel(d.body, e, c, g, d.fin, d.sty), nm = String(d.name || '').trim().slice(0, 24) || (BODIES[d.body].n + ' ' + NAMES[G.nid % NAMES.length]);
  a.models.push({ id: G.nid++, name: nm, body: d.body, eng: e.id, chs: c.id, gbx: g.id, fuel: e.spec.fuel, fin: d.fin, sty: d.sty, st: C.st, cost: C.cost, price: Math.round(suggestPrice(G, d.body, d.fin, C.cost) * PPF[d.pp == null ? 1 : d.pp] / 100) * 100, camp: d.camp || 0, br: d.br || 0, stock: 0, hype: 0, disc: 0, discLeft: 0, state: 'dev', left: I.days, total: I.days, monthly: I.dev / (I.days / 30), devCost: I.dev, age: 0, sold: 0, soldTot: 0, hist: [], cs: {} });
  return null;
}
function modelAttrs(G, m) {    // caractéristiques perçues aujourd'hui (le design se démode ; l'économie dépend du carburant)
  const f = G.game, o = G.actors.find(a => a.models && a.models.includes(m)), tf = k => o && o.tech ? ttFx(o, k) : 0, run = (m.fuel === 'elec' ? 55 * f.elec : m.st.co2 * f.fuel) * (1 - tf('co2') / 100);
  return Object.assign({}, m.st, { rel: m.st.rel + tf('rel'), safety: m.st.safety + tf('safety'), design: clamp(m.st.design + tf('design') - Math.min(20, 0.12 * m.age) - 5 * (m.tl != null ? techLag(G, m.tl) : 0), 5, 100), economy: clamp(100 - run * 0.5, 5, 100) });
}
const gtOf = (G, a, m) => { const g = partOf(a, m.gbx); return m.gt = g ? g.spec.type : 'man'; };
const quality = (G, m, seg, c) => { const A = modelAttrs(G, m), W = SEG_W[seg], T = c && G.game.tr ? G.game.tr.eff[COUNTRIES[c].reg] : null; let q = 0, wt = 0, ws = 0; for (const k in W) { const t = T ? (T['a_' + k] || 1) : 1; q += W[k] * t * A[k]; wt += W[k] * t; ws += W[k]; } return q / (wt / ws) / bar(G); };
const modelQ = (G, m) => quality(G, m, body(m).seg);
const refPrice = (G, seg, c) => SEG_ANCHOR[seg] * infl(G) * (0.55 + 0.45 * COUNTRIES[c].wealth);
const nOnSale = a => a.models.filter(m => m.state === 'sale').length;

/* ================= RÉGLEMENTATIONS PAR RÉGION =================
   Chaque pays appartient à un bloc réglementaire selon sa sévérité. Un bloc fixe : un plafond de CO2 moyen sur les ventes de la région (amende par g/km et par véhicule),
   éventuellement un quota de véhicules électrifiés, une note de sécurité minimale et un plafond d'émission par modèle (homologation : un modèle hors norme ne se vend pas du tout). */
const BLK = ['ue', 'us', 'cn', 'adv', 'mid', 'low'];
const BLN = { ue: ['Europe', 'Union européenne, Royaume-Uni, Suisse, Norvège', 3], us: ['États-Unis', 'Norme CAFE fédérale', 2], cn: ['Chine', 'Plafond CO₂ et quota de véhicules électrifiés', 2], adv: ['Pays avancés', 'Japon, Corée, Canada, Australie, Turquie…', 2], mid: ['Pays intermédiaires', 'Normes en cours de rattrapage', 1], low: ['Normes légères', 'Réglementation minimale', 0] };
const BLOC = {}; for (const c of CK) { const C = COUNTRIES[c]; BLOC[c] = C.zone === 'EU' || C.zone === 'GB' || C.strict >= 0.9 ? 'ue' : c === 'US' ? 'us' : c === 'CN' ? 'cn' : C.strict >= 0.6 ? 'adv' : C.strict >= 0.3 ? 'mid' : 'low'; }
const ramp = (y, T) => { if (y <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (y <= T[i][0]) return T[i - 1][1] + (T[i][1] - T[i - 1][1]) * (y - T[i - 1][0]) / (T[i][0] - T[i - 1][0]); return T[T.length - 1][1]; };
const SAFE_T = [[1980, 18], [1995, 30], [2010, 42], [2030, 50], [2050, 56]], NEV_T = [[2018, 0], [2020, 0.04], [2025, 0.2], [2030, 0.35], [2040, 0.6]];
function ruleAt(G, b, y) {
  const k = G.game.rx || 1, c0 = co2At(y) * k, R = { b, safety: Math.round(ramp(y, SAFE_T) * { ue: 1, us: 0.92, adv: 1, cn: 0.9, mid: 0.75, low: 0.55 }[b]) };
  if (b === 'ue') { R.co2 = c0; R.fine = 95; R.max = c0 * 2.1; }
  else if (b === 'us') { R.co2 = c0 * 1.9; R.fine = 35; R.max = c0 * 3; }
  else if (b === 'cn') { R.co2 = c0 * 1.3; R.fine = 30; R.max = c0 * 2.5; const q = ramp(y, NEV_T); if (q > 0) { R.nev = q; R.nevFine = 3500; } }
  else if (b === 'adv') { R.co2 = c0 * 1.2; R.fine = 70; R.max = c0 * 2.2; }
  else if (b === 'mid' && y >= 2030) { R.co2 = c0 * 1.8; R.fine = 30; }
  return R;
}
const homoWhy = (R, m, c, G) => { const w = []; if (m.st.safety < R.safety) w.push('sécurité ' + Math.round(m.st.safety) + ' < ' + R.safety + ' exigé'); if (R.max && m.st.co2 > R.max) w.push(nf(m.st.co2) + ' g/km > ' + nf(R.max) + ' autorisé'); if (c && (m.fuel === 'ess' || m.fuel === 'die') && isBanned(c, G)) w.push('moteurs thermiques purs interdits'); return w; };
const homoOk = (R, m) => m.st.safety >= R.safety && !(R.max && m.st.co2 > R.max);
const BAN_ST = (G, b) => b === 'ue' ? G.game.regs.find(r => r.kind === 'ban') : null;
function bloPresence(p) { const o = {}; for (const b of brandsOf(p)) for (const c of CK) if (b.cty[c] && b.cty[c].dealers > 0) o[BLOC[c]] = (o[BLOC[c]] || 0) + 1; return o; }
function panelNormes(G, p) {
  const y = absYear(G), sel = fU('rsel') || 'ue', R = ruleAt(G, sel, y), R5 = ruleAt(G, sel, y + 5), pres = bloPresence(p), rg = p.rg || {}, f12 = TE.sum(p.fineH || []), ban = BAN_ST(G, 'ue'), by = banYears(G);
  const ms = p.models.filter(m => m.state === 'sale' || (m.state === 'end' && (m.stock || 0) > 0)), RL = {}; for (const b of BLK) RL[b] = ruleAt(G, b, y);
  const blocked = []; for (const m of ms) for (const b of BLK) if (pres[b]) { const c = CK.find(x => BLOC[x] === b && brandsOf(p).some(br => br.cty[x] && br.cty[x].dealers > 0)), w = homoWhy(RL[b], m, c, G); if (w.length) blocked.push({ m, b, w }); }
  const star = n => '★'.repeat(n) + '☆'.repeat(3 - n), rl = b => BLN[b][0];
  const nextE = by > 0 && by < 30 ? 'Fin du thermique pur en Europe : ' + TE.dateStr(ban.day) : 'Plafond CO₂ Europe : ' + nf(RL.ue.co2) + ' g/km';
  const hero = '<div class="hstats">' + hsT('Amendes (12 mois)', money(f12)) + hsT('Plafond CO₂ Europe', nf(RL.ue.co2) + ' g/km') + hsT('Modèles bloqués', new Set(blocked.map(x => x.m.id)).size) + hsT('Prochaine échéance', by > 0 && by < 30 ? 'Thermique ' + Math.floor(absYear(G) + by) : 'Plafond −4 %/an') + '</div>';
  const conf = H.card('Ta conformité par région', Object.keys(rg).filter(b => rg[b].u > 0).length ? '<div class="tscroll">' + H.table([
    { h: 'Région', get: r => '<button class="lnk" data-act="set" data-k="rsel" data-v="' + r.b + '">' + esc(rl(r.b)) + '</button>' },
    { h: 'Ventes/mois', cls: 'num hm', get: r => nf(r.v.u) },
    { h: 'CO₂ moyen', cls: 'num', get: r => nf(r.v.avg) + (r.v.cap ? ' / ' + nf(r.v.cap) : '') },
    { h: 'Amende/mois', cls: 'num', get: r => r.v.fc + r.v.fn > 0 ? '<span class="pill bad">' + money(r.v.fc + r.v.fn) + '</span>' : '<span class="pill good">conforme</span>' }], BLK.filter(b => rg[b] && rg[b].u > 0).map(b => ({ b, v: rg[b] }))) + '</div><p class="muted" style="font-size:12px;margin:6px 0 0">CO₂ moyen de tes ventes dans la région / plafond. L\'amende = dépassement × ventes × tarif par g/km.' + (rg.cn && rg.cn.q ? ' Chine : quota électrifié ' + TE.pct(rg.cn.nev, 0) + ' / ' + TE.pct(rg.cn.q, 0) + ' exigé.' : '') + '</p>' : '<p class="muted">Tu ne vends dans aucune région réglementée pour l\'instant.</p>');
  const det = H.card('Règles : ' + esc(rl(sel)), H.filter('Région', 'rsel', sel, BLK.map(b => [b, BLN[b][0]])) + '<p class="muted" style="font-size:12.5px;margin:4px 0 6px">' + esc(BLN[sel][1]) + ' · ' + (CK.filter(c => BLOC[c] === sel).length) + ' pays</p>' + H.kv([['Sévérité', star(BLN[sel][2])], ['Plafond CO₂', R.co2 ? nf(R.co2) + ' g/km' : 'aucun'], ['Dans 5 ans', R5.co2 ? nf(R5.co2) + ' g/km' : 'aucun'], ['Amende', R.co2 ? R.fine + ' €/g/km/véh.' : '—'], ['Quota VE', R.nev ? TE.pct(R.nev, 0) + ' des ventes' : 'aucun'], ['Sécurité min.', R.safety + ' / 100'], ['CO₂ max/modèle', R.max ? nf(R.max) + ' g/km' : 'aucun'], ['Thermique pur', sel === 'ue' && ban ? (G.day >= ban.day ? 'interdit' : 'interdit en ' + Math.floor(absYear(G) + (ban.day - G.day) / 360)) : 'autorisé']]) +
    '<p class="muted" style="font-size:12px;margin:6px 0 0">' + (sel === 'cn' ? 'Quota : hybride rechargeable compté ½, amende 3 500 € par véhicule manquant. ' : '') + 'Pays : ' + CK.filter(c => BLOC[c] === sel).sort((a, b) => COUNTRIES[b].vol - COUNTRIES[a].vol).slice(0, 8).map(c => esc(COUNTRIES[c].n)).join(', ') + '…</p>');
  const mx = H.card('Homologation de ta gamme', ms.length ? '<div class="tscroll">' + H.table([{ h: 'Modèle', get: m => esc(m.name) }].concat(BLK.filter(b => pres[b]).map(b => ({ h: { ue: 'UE', us: 'US', cn: 'CN', adv: 'Av.', mid: 'Int.', low: 'Lég.' }[b], cls: 'num', get: m => blocked.some(x => x.m === m && x.b === b) ? '<span class="dn">✗</span>' : '<span class="up">✓</span>' }))), ms) + '</div>' +
    (blocked.length ? blocked.map(x => '<p style="margin:6px 0 0;font-size:12.5px"><b>' + esc(x.m.name) + '</b> · ' + esc(rl(x.b)) + ' : ' + esc(x.w.join(', ')) + '.</p>').join('') : '<p class="muted" style="font-size:12.5px;margin:6px 0 0">Toute ta gamme est homologuée dans les régions où tu vends.</p>') + '<p class="muted" style="font-size:12px;margin:6px 0 0">Un modèle non homologué n\'est pas vendu du tout dans la région. Légende : UE Europe · US États-Unis · CN Chine · Av. pays avancés · Int. intermédiaires · Lég. normes légères.</p>' : '<p class="muted">Aucun modèle en vente.</p>');
  const yrs4 = [0, 3, 6, 10].map(d => ({ y: Math.floor(y) + d, u: ruleAt(G, 'ue', y + d), s: ruleAt(G, 'us', y + d), c: ruleAt(G, 'cn', y + d) }));
  const cal = H.card('Calendrier prévisionnel', '<div class="tscroll">' + H.table([{ h: 'Année', get: r => r.y }, { h: 'CO₂ Europe', cls: 'num', get: r => nf(r.u.co2) }, { h: 'CO₂ US', cls: 'num', get: r => nf(r.s.co2) }, { h: 'CO₂ Chine', cls: 'num', get: r => nf(r.c.co2) }, { h: 'Quota CN', cls: 'num hm', get: r => r.c.nev ? TE.pct(r.c.nev, 0) : '—' }, { h: 'Sécurité UE', cls: 'num hm', get: r => r.u.safety }], yrs4) + '</div><p class="muted" style="font-size:12px;margin:6px 0 0">Plafonds en g/km (moyenne des ventes de la région). Des événements peuvent durcir ou assouplir toutes les régions.</p>');
  return '<div class="pw sportw">' + hero + conf + det + mx + cal + '</div>';
}

/* =============================== SIMULATION MENSUELLE DU MARCHÉ =============================== */
function marketMonth(G) {
  const g = G.game, mi = ((G.day / 30) - 1 + 120) % 12, alive = live(G);
  trendMonth(G, mi);
  for (const a of alive) for (const m of a.models) { if (m.lic) continue; const ps = [m.eng, m.chs, m.gbx].map(i => partOf(a, i)); if (ps.every(Boolean)) m.tl = Math.min.apply(null, ps.map(x => x.spec.lvl)); }
  for (const a of alive) { a.mo = { units: 0, rev: 0, ctyU: {}, cseg: {}, blk: {}, prod: 0 }; a.capNow = capOf(a, G); }
  const E = [], tot = {}, mkS = {}, RL = {}; for (const b of BLK) RL[b] = ruleAt(G, b, absYear(G));
  for (const c of CK) {
    const C = COUNTRIES[c], base = C.vol / 12 * SEASON[mi] * Math.pow(1 + (C.g || 0.01), yrs(G)) * g.econ * TE.modFactor('demande', c);
    tot[c] = 0; mkS[c] = [0, 0, 0, 0, 0];
    for (const s in SEG) {
      const Dem = base * C.taste[s] * trAt(G, c, 's_' + s), ref = refPrice(G, s, c), ents = [];
      for (const a of alive) for (const m of a.models) {
        if ((m.state !== 'sale' && !(m.state === 'end' && (m.stock || 0) > 0)) || body(m).seg !== s) continue;
        if (!brOf(a, m).cty[c].dealers) continue;
        if (!homoOk(RL[BLOC[c]], m)) continue;
        ents.push(mkEntry(G, a, m, c, s));
      }
      ents.push({ other: true, price: ref * 1.0, quality: 1, weight: g.othW[c], cap: Infinity });
      TE.splitMarket(Dem, ents, { priceSens: 2.6, qualSens: 2.2, refPrice: ref });
      tot[c] += Dem; mkS[c][SEGK_.indexOf(s)] = Dem;
      for (const e of ents) if (!e.other) E.push(e);
    }
  }
  for (const a of alive) {
    // plafond du réseau, par marque et par pays
    for (const b of brandsOf(a)) for (const c of CK) { const my = E.filter(e => e.a === a && e.b === b && e.c === c), u = TE.sum(my.map(e => e.sold)), cap = b.cty[c].dealers * DEALER_CAP * SEASON[mi]; if (u > cap && u > 0) for (const e of my) e.sold *= cap / u; }
    // production planifiée sur prévision + stock visé ; les ventes sont limitées par stock + production
    const my = E.filter(e => e.a === a), dem = {};
    for (const e of my) dem[e.m.id] = (dem[e.m.id] || 0) + e.sold;
    a.mo.demand = TE.sum(Object.values(dem));
    const plans = [];
    for (const m of a.models) {
      if (m.state === 'dev') continue;
      const d = dem[m.id] || 0, T = stockOf(a, m), on = m.state === 'sale'; let plan = 0;
      if (m.fc == null) { m.fc = d; m.stock = on ? T * d : (m.stock || 0); m._pre = m.pre ? m.stock : 0; plan = on ? d : 0; }
      else if (on) plan = Math.max(0, m.fc + (T * m.fc - (m.stock || 0)) * 0.5);
      plans.push({ m, d, plan });
    }
    const sp = TE.sum(plans.map(x => x.plan)), k = sp > a.capNow && sp > 0 ? a.capNow / sp : 1, fm = {};
    for (const x of plans) {
      const m = x.m, avail = (m.stock || 0) + x.plan * k, sold = Math.min(x.d, avail);
      m._prod = x.plan * k + (m._pre || 0); m._pre = 0; fm[m.id] = x.d > 0 ? sold / x.d : 0; m.lost = Math.max(0, x.d - sold); m.stock = avail - sold; m.fc = m.fc * 0.65 + 0.35 * x.d; a.mo.prod += x.plan * k;
    }
    for (const e of my) e.sold *= fm[e.m.id];
  }
  // encaissements et coûts
  for (const a of alive) {
    const lab = 0.8 + 0.2 * labIdx(a, G), my = E.filter(e => e.a === a);
    for (const m of a.models) { m.sold = 0; m.cs = {}; }
    for (const e of my) {
      const u = Math.round(e.sold); if (u <= 0) continue; const m = e.m, c = e.c, p = effPrice(m), part = e.b.cty[c].partner;
      TE.earn(a, 'ventes', u * p * (1 - DEALER_MARGIN));
      TE.spend(a, 'garantie', u * p * 0.03 * (100 - m.st.rel) / 50 * (1 - 0.12 * (a.test || 0)));
      const imp = !localIn(a, c); if (imp) { TE.spend(a, 'douanes', u * p * 0.7 * tariffOf(c) * (part ? 0.5 : 1)); TE.spend(a, 'transport', u * 650); } else TE.spend(a, 'transport', u * 150);
      if (part) TE.spend(a, 'partenaire', u * p * 0.04);
      m.sold += u; m.soldTot += u; m.cs[c] = (m.cs[c] || 0) + u; a.mo.units += u; a.mo.rev += u * p; a.mo.ctyU[c] = (a.mo.ctyU[c] || 0) + u; (a.mo.cseg[c] || (a.mo.cseg[c] = [0, 0, 0, 0, 0]))[SEGK_.indexOf(body(m).seg)] += u;
      { const kb = BLOC[c], k = a.mo.blk[kb] || (a.mo.blk[kb] = { u: 0, co2s: 0, nev: 0 }); k.u += u; k.co2s += u * m.st.co2; k.nev += u * (m.fuel === 'elec' ? 1 : m.fuel === 'hyb' ? 0.5 : 0); }
    }
    for (const m of a.models) if (m.state !== 'dev') {
      const cn = costNow(a, G, m);
      if (m._prod > 0) TE.spend(a, 'production', m._prod * cn * lab * Math.max(0.88, 1 - 0.00000012 * m.soldTot));
      if ((m.stock || 0) > 0) TE.spend(a, 'stockage', m.stock * cn * 0.012);
      m._prod = 0; licPay(G, a, m);
    }
    a.m.vol += a.mo.units; TE.spend(a, 'frais généraux', a.mo.rev * (1 - DEALER_MARGIN) * 0.06);
    // conformité réglementaire : CO2 moyen et quota électrifié, région par région
    { const rg = a.rg || (a.rg = {}); let fines = 0;
      for (const b of BLK) { const k = a.mo.blk[b]; if (!k || !k.u) { if (rg[b]) rg[b].u = 0; continue; } const R = RL[b], avg = k.co2s / k.u, nS = k.nev / k.u, fc = R.co2 && avg > R.co2 ? (avg - R.co2) * k.u * R.fine : 0, fn = R.nev && nS < R.nev ? (R.nev - nS) * k.u * R.nevFine : 0;
        if (fc > 0) TE.spend(a, 'amendes CO2', fc); if (fn > 0) TE.spend(a, 'amendes quotas', fn); fines += fc + fn; rg[b] = { u: k.u, avg, nev: nS, fc, fn, cap: R.co2 || 0, q: R.nev || 0 }; }
      a.fineH = (a.fineH || []).concat([fines]).slice(-12); }
    for (const m of a.models) { m.hist.push(m.sold); if (m.hist.length > 36) m.hist.shift(); }
    // image de marque et notoriété, marque par marque
    for (const b of brandsOf(a)) {
      const mods = a.models.filter(m => brOf(a, m) === b), sold = mods.filter(m => m.sold > 0), W = TE.sum(sold.map(m => m.sold)) || 1;
      const img = sold.length ? TE.sum(sold.map(m => m.sold * (0.35 * m.st.rel + 0.25 * modelAttrs(G, m).design + 0.2 * m.st.safety + 0.2 * Math.min(100, modelQ(G, m) * 50)))) / W : b.brand;
      let img2 = img + (b.halo || 0); if (b.pos && sold.length) img2 += (TE.sum(sold.filter(m => posFit(G, b, m)).map(m => m.sold)) / W - 0.5) * 14;
      const pen = sold.length ? TE.sum(sold.filter(m => m.discLeft > 0).map(m => m.sold * m.disc)) / W : 0;
      b.brand = clamp(b.brand + (clamp(img2, 20, 100) + adLv(b) * 2.5 - b.brand) * 0.04 - pen * 10, 5, 100);
      for (const c of CK) { const cs = b.cty[c], sh = TE.sum(mods.map(m => m.cs[c] || 0)) / Math.max(1, tot[c]); cs.aware = clamp(cs.aware + cs.ads * 2.2 + sh * 400 + 0.08 * spBuzz(b, c) - 0.04 * cs.aware, 0, 100); cs.share = sh; }
    }
    a.u12.push(a.mo.units); if (a.u12.length > 12) a.u12.shift(); a.unitsH.push(a.mo.units); if (a.unitsH.length > 72) a.unitsH.shift();
    a.util = a.capNow ? a.mo.prod / a.capNow : 1;
  }
  g.mkt = tot; g.totUnits = TE.sum(Object.values(tot));
  const Rp = g.rep || (g.rep = { n: 0, mk: {} }); Rp.n++;   // moyenne glissante sur 12 mois (demande par pays et segment, ventes de chaque constructeur)
  for (const c of CK) { const r = Rp.mk[c] || (Rp.mk[c] = [0, 0, 0, 0, 0]); for (let i = 0; i < 5; i++) r[i] = r[i] * 11 / 12 + mkS[c][i]; }
  for (const a of alive) { const rp = a.rp || (a.rp = {}); for (const c of CK) { const r = rp[c]; const add = a.mo.cseg[c]; if (!r && !add) continue; const q = r || (rp[c] = [0, 0, 0, 0, 0]); for (let i = 0; i < 5; i++) q[i] = q[i] * 11 / 12 + (add ? add[i] : 0); } }
  for (const a of alive) a.gshare = a.mo.units / Math.max(1, g.totUnits);
}
function dealersCapLeft(a, c) { return a.cty[c].dealers * DEALER_CAP * 1.3; }

/* =============================== ÉTAT DES ACTEURS =============================== */
function mkState(a, home) {
  a.parts = []; a.proj = []; a.models = []; a.fact = []; a.brand = 40; a.extra = []; a.stockT = 1.5; a.test = 0; a.pos = null; a.sup = null; a.awards = 0; a.recalls = 0; a.u12 = []; a.unitsH = []; a.util = 1; a.gshare = 0; a.home = home; a.cty = {};
  for (const c of CK) a.cty[c] = { dealers: 0, aware: c === home ? 35 : 5, ads: 0, share: 0 };
}
const adLv = a => TE.sum(Object.values(a.cty).map(x => x.ads)) / CK.length;
function addFactory(a, G, c, cap, ready) { a.fact.push({ id: G.nid++, c, cap, ready: ready == null ? G.day : ready }); }
const factCost = (c, cap) => cap * 38000 * (0.6 + 0.4 * COUNTRIES[c].lab);
const countOnSale = (a, seg) => a.models.filter(m => (m.state === 'sale' || m.state === 'dev') && body(m).seg === seg).length;

/* ---------- Construction instantanée (départ des rivales) et IA ---------- */
function specFor(kind, body_, fuel, lvl, seg) {
  const B = BODIES[body_];
  if (kind === 'eng') return { fuel, size: clamp(B.size + (seg === 'spo' ? 1 : 0), 1, 4), lvl };
  if (kind === 'chs') return { cls: B.size, focus: seg === 'spo' ? 'sport' : seg === 'ber' || seg === 'suv' ? 'conf' : 'eq', lvl };
  return null;
}
function gbxSpec(fuel, size, seg, lvl) { return { type: fuel === 'elec' ? 'red' : seg === 'spo' ? 'dct' : seg === 'ber' || seg === 'suv' ? 'auto' : 'man', cap: size, lvl }; }
function planModel(a, G, P, seg, instant) {
  const bodies = bodyKeys(G).filter(k => BODIES[k].seg === seg); if (!bodies.length) return;
  const bid = bodies[Math.floor(TE.rng() * bodies.length)], fk = Object.keys(P.fuel).filter(k => fuelOk(G, k));
  const fuel = TE.pickW((fk.length ? fk : ['ess']).map(k => ({ w: P.fuel[k] * (k === 'elec' ? 1 + 0.35 * yrs(G) : k === 'hyb' ? 1 + 0.2 * yrs(G) : Math.max(0.25, 1 - 0.07 * yrs(G))) * (banYears(G) <= 6 ? (k === 'elec' ? 3 : k === 'hyb' ? 2 : 0.4) : 1), k }))).k, lvl = clamp(P.lvl - (6 - eraOf(G).tf0) + Math.floor(yrs(G) / eraOf(G).st), 1, techFront(G));
  let es = specFor('eng', bid, fuel, lvl, seg), cs = specFor('chs', bid, fuel, lvl, seg), gs = gbxSpec(fuel, es.size, seg, lvl);
  let e0 = { st: partInfo('eng', es).st, spec: es }, c0 = { st: partInfo('chs', cs).st, spec: cs }, g0 = { st: partInfo('gbx', gs).st, spec: gs };
  if (compat(bid, e0, c0, g0) && seg === 'spo') { es = specFor('eng', bid, fuel, lvl, 'ber'); gs = gbxSpec(fuel, es.size, seg, lvl); e0 = { st: partInfo('eng', es).st, spec: es }; g0 = { st: partInfo('gbx', gs).st, spec: gs }; }
  if (compat(bid, e0, c0, g0)) return false;
  const need = [['eng', es], ['chs', cs], ['gbx', gs]], have = [];
  for (const [k, s] of need) {
    let p = a.parts.find(x => x.kind === k && specKey(x.spec) === specKey(s)) || a.parts.find(x => x.kind === k && Object.keys(s).every(f => f === 'lvl' || x.spec[f] === s[f]) && x.spec.lvl >= s.lvl - 1);
    if (!p) { if (instant) p = addPart(a, G, k, s); else { if (a.proj.length < 2 && TE.ai.canAfford(a, partInfo(k, s).dev * 0.4, P)) startPart(a, G, k, s); return false; } }
    have.push(p);
  }
  const d = { body: bid, eng: have[0].id, chs: have[1].id, gbx: have[2].id, fin: P.fin, sty: P.sty, pp: 1, camp: a.cash > P.reserve * 2 ? 1 : 0 };
  if (instant) {
    const C = calcModel(bid, have[0], have[1], have[2], P.fin, P.sty);
    a.models.push({ id: G.nid++, name: BODIES[bid].n + ' ' + NAMES[G.nid % NAMES.length], body: bid, eng: have[0].id, chs: have[1].id, gbx: have[2].id, fuel, fin: P.fin, sty: P.sty, st: C.st, cost: C.cost, price: suggestPrice(G, bid, P.fin, C.cost), state: 'sale', age: Math.floor(TE.rand(4, 50)), sold: 0, soldTot: 0, hist: [], cs: {}, left: 0, total: 0, monthly: 0 });
    return true;
  }
  const I = devInfo(bid, P.fin, P.sty);
  if (!TE.ai.canAfford(a, I.dev * 0.4, P)) return false;
  return !startModel(a, G, d);
}

/* ---- IA mondiale : stratégie par pays, usines locales contre la douane, R&D via l'arbre, positionnement ---- */
const aiLog = (G, a, t) => { const L = G.game.aiLog || (G.game.aiLog = []); L.unshift({ d: G.day, n: a.name, id: a.id, t }); if (L.length > 80) L.length = 80; };
const unitsIn = (a, c) => TE.sum(a.models.map(m => m.cs && m.cs[c] || 0));
const BRW = { generaliste: { ind: 2, mot: 1.5, sec: 1.2, chs: 1, num: 1, ele: 1, trs: 1, nrj: 1 }, premium: { num: 2.2, sec: 2, chs: 1.6, trs: 1.3, ele: 1.2, mot: 1, ind: .7, nrj: .8 }, sport: { mot: 2.2, trs: 2.2, chs: 2, sec: .8, num: .8, ele: 1, ind: .5, nrj: .6 }, lowcost: { ind: 3, mot: 1.3, chs: 1.2, sec: .8, trs: .8, num: .5, ele: .7, nrj: .6 }, electrique: { ele: 3, nrj: 2, num: 1.6, trs: 1.5, ind: 1.2, chs: 1.2, sec: 1, mot: .1 }, americain: { mot: 2, trs: 1.6, ind: 1.5, sec: 1, chs: 1.2, num: 1, ele: .8, nrj: .8 } };
const AI_POS = { premium: 'lux', sport: 'sport', lowcost: 'prix', electrique: 'eco', generaliste: 'fiab' };
function aiScore(G, a, c) {          // attrait d'un pays pour une entreprise : taille, goûts, richesse, proximité, douane, concurrence
  const P = PROFILES[a.profile] || PROFILES.generaliste, C = COUNTRIES[c], H0 = COUNTRIES[a.home || 'FR'] || C;
  const taste = TE.sum(P.segs.map(s => C.taste[s])), wf = P.pos >= 1.3 ? Math.pow(C.wealth, 1.6) : P.pos < 1 ? 1 / (0.35 + C.wealth) : C.wealth;
  const ev = P.fuel.elec >= 0.5 ? 0.6 + evPref(c, G) : 1, comp = 1 + 0.35 * TE.sum(live(G).filter(b => b !== a).map(b => reach(b, c)));
  const near = c === a.home ? 2.5 : C.zone === H0.zone ? 1.7 : C.reg === H0.reg ? 1.3 : 1, tar = 1 - (localIn(a, c) ? 0 : tariffOf(c)) * 0.8;
  return C.vol * taste * wf * ev * near * Math.max(0.2, tar) / comp * Math.max(0.1, 1.6 - reach(a, c)) * (a.mgmt && a.mgmt.zone && C.reg === a.mgmt.zone ? 6 : 1);
}
function aiResearch(G, a, P, K) {
  K = K || POL.equilibre; const slots = K.rd >= 1.3 ? 3 : 2; a.tq = a.tq || []; if (a.tq.length >= slots || TE.rng() > 0.35 * K.rd) return;
  const yr = ttYear(G), W = BRW[a.profile] || BRW.generaliste, opts = TT.filter(x => ttState(G, a, x) === 'open').map(x => ({ x, w: (W[x.br] || 1) / (1 + Math.max(0, x.y - yr) * 0.7) })); if (!opts.length) return;
  const x = TE.pickW(opts.map(o => ({ w: o.w, k: o.x }))).k, cost = ttCost(G, a, x); if (a.cash < P.reserve * 1.6 * K.res + cost) return;
  TE.spend(a, 'R&D', cost); const dur = Math.max(2, Math.ceil(x.dur / rdSpeed(a))); a.tq.push({ id: x.id, left: dur, tot: dur });
}
function aiGlobal(G, mi) {
  const yr = ttYear(G);
  for (const a of TE.rivals()) {
    if (a.bankrupt || !a.profile) continue;
    const P = PROFILES[a.profile] || PROFILES.generaliste, K = polOf(a), res = P.reserve, rich = a.cash > res * 1.4 * K.res, ai = a.ai || (a.ai = { tg: [], t0: -999 }), Pa = clamp(P.ads + K.ads, 0, 3);
    if (G.day - ai.t0 > 180) { ai.tg = CK.map(c => ({ c, s: aiScore(G, a, c) })).sort((x, y) => y.s - x.s).slice(0, 12).map(x => x.c); ai.t0 = G.day; }
    // 1. implantation : le meilleur pays encore sous-exploité
    if (rich && TE.rng() < (0.3 + P.expand) * K.ex) {
      const c = ai.tg.find(k => reach(a, k) < 0.7);
      if (c) { const n = clamp(Math.round(D0(c) * 0.25), 8, 60), cost = n * DEALER_COST; if (a.cash > res * 1.4 + cost) { const first = a.cty[c].dealers === 0; TE.spend(a, 'réseau', cost); a.cty[c].dealers += n; if (first) { a.cty[c].aware = Math.max(a.cty[c].aware, 8); aiLog(G, a, 's\'implante en ' + COUNTRIES[c].n + ' (' + n + ' concessions).'); if (COUNTRIES[c].vol > 3e6 && TE.rng() < 0.5) TE.news(a.name + ' fait son entrée sur le marché ' + COUNTRIES[c].n + '.', 'info'); } } }
    }
    // 2. usine locale : un marché gros et protégé par la douane
    if (rich && !a.fact.some(f => f.ready > G.day) && TE.rng() < 0.12) {
      const c = ai.tg.slice(0, 9).filter(k => !localIn(a, k) && tariffOf(k) >= 0.08 && unitsIn(a, k) > 1500).sort((x, y) => unitsIn(a, y) - unitsIn(a, x))[0];
      if (c) { const cap = clamp(Math.round(unitsIn(a, c) * 1.4 / 1000) * 1000, 4000, 40000), cost = factCost(c, cap); if (a.cash > cost + res * 1.5) { TE.spend(a, 'usines', cost); addFactory(a, G, c, cap, G.day + 270); aiLog(G, a, 'construit une usine en ' + COUNTRIES[c].n + ' (' + nf(cap) + ' véh./mois) pour éviter les droits de douane.'); if (cap >= 12000) TE.news(a.name + ' annonce une usine en ' + COUNTRIES[c].n + ' (' + nf(cap) + ' véh./mois).', 'info'); } }
    }
    // 3. publicité ciblée sur les pays prioritaires
    for (const c of CK) { const rk = ai.tg.indexOf(c); a.cty[c].ads = a.cash < res ? 0 : c === a.home ? Pa : rk >= 0 && rk < 5 && a.cty[c].dealers > 10 ? Math.min(3, Pa) : reach(a, c) > 0.25 ? Math.max(0, Pa - 1) : 0; }
    // 4. technologie
    aiResearch(G, a, P, K);
    // 5. positionnement de marque
    if (a.mgmt && a.mgmt.pos) a.pos = a.mgmt.pos; else if (!a.pos && TE.rng() < 0.15) a.pos = AI_POS[a.profile] || null;
    // 6. transition : sans modèle propre et vert alors que le thermique recule, elle en planifie un
    if (banYears(G) <= 8 && !a.models.some(m => (m.fuel === 'elec' || m.fuel === 'hyb') && m.state !== 'end') && !a.models.some(m => m.state === 'dev') && TE.rng() < 0.4) { const s = P.segs[0]; if (planModel(a, G, Object.assign({}, P, { fuel: { elec: 0.65, hyb: 0.35 } }), s, false) !== undefined) aiLog(G, a, 'prépare sa transition électrique.'); }
  }
  if (mi === 0 && TE.rivals().length < 24 && TE.rng() < 0.55 && yrs(G) > 1) TE.spawnEntrant();
}
function aiWeek(G, a, P) {
  if (!P) return;
  const reserve = P.reserve, rich = a.cash > reserve * 1.5;
  const sz = clamp(1 + TE.sum(a.u12 || []) / 120e3, 1, 10);
  if (a.cash > reserve * 5 * sz) TE.spend(a, 'dividendes', (a.cash - reserve * 5 * sz) * 0.3);   // les rivales redistribuent leurs surplus
  // 1. gamme : un modèle par segment visé, renouvelé quand il vieillit
  for (const s of P.segs) {
    const mods = a.models.filter(m => (m.state === 'sale' || m.state === 'dev') && body(m).seg === s);
    const dev = mods.some(m => m.state === 'dev'), old = mods.filter(m => m.state === 'sale').sort((x, y) => y.age - x.age)[0];
    if (!dev && (!mods.length || (old && old.age > P.life)) && a.models.filter(m => m.state === 'dev').length < 2 && TE.rng() < 0.35) { planModel(a, G, P, s, false); break; }
  }
  // 3. capacité : agrandir quand l'usine sature
  if (a.util > 0.93 && a.cash > reserve * 2 && !a.fact.some(f => f.ready > G.day) && TE.rng() < 0.3) {
    const cap = Math.round(capOf(a, G) * 0.2 / 1000) * 1000 || 3000, f = a.fact.sort((x, y) => y.cap - x.cap)[0], c = f ? f.c : a.home, cost = factCost(c, cap);
    if (a.cash > cost + reserve) { TE.spend(a, 'usines', cost); addFactory(a, G, c, cap, G.day + 270); }
  }
  // 3b. riposte : si le joueur domine un segment, la rivale renouvelle son modèle ou rogne ses prix
  const pl = TE.player();
  if (pl && !pl.bankrupt) for (const s of P.segs) {
    const pm = pl.models.filter(m => m.state === 'sale' && body(m).seg === s), mm = a.models.filter(m => m.state === 'sale' && body(m).seg === s);
    if (!pm.length || !mm.length) continue;
    const pq = Math.max.apply(null, pm.map(m => modelQ(G, m))), mq = Math.max.apply(null, mm.map(m => modelQ(G, m)));
    if (pq > mq * 1.08 && !a.models.some(m => m.state === 'dev' && body(m).seg === s) && a.models.filter(m => m.state === 'dev').length < 2 && TE.rng() < 0.2) planModel(a, G, P, s, false);
    for (const m of mm) m.rp = pq > mq ? Math.max(0.88, (m.rp || 1) - 0.01) : Math.min(1, (m.rp || 1) + 0.01);
  }
  for (const m of a.models) if (m.state === 'sale' && m.age > P.life * 0.75 && !(m.discLeft > 0) && a.util < 0.85 && TE.rng() < 0.05) { m.disc = 0.08; m.discLeft = 3; }
  a.test = a.cash > reserve ? (P.lvl >= 6 ? 2 : 1) : 0;
  // 4. marketing et prix
  for (const m of a.models) if (m.state === 'sale' || m.state === 'dev') m.price = Math.max(Math.round(m.cost * 1.1 / 100) * 100, Math.round(SEG_ANCHOR[body(m).seg] * infl(G) * P.pos * [0.92, 1.0, 1.14][m.fin - 1] * (m.rp || 1) / 100) * 100);
  const want = Math.round(P.eng * (1 + 0.3 * yrs(G) / 10)); if (a.staff.ingenieurs.n < want) a.staff.ingenieurs.n += 10;
}


const mkEntry = (G, a, m, c, s) => { const b = brOf(a, m); return { a, b, m, c, s, price: effPrice(m), quality: quality(G, m, s, c), weight: reach(b, c) * brandW(b) * awareW(b, c) * fuelW(m, c, G) * trAt(G, c, 'f_' + m.fuel) * (m.fuel === 'elec' ? 1 : trAt(G, c, 'g_' + (m.gt || gtOf(G, a, m)))) * lifecycle(m) * (1 + 0.45 * (m.hype || 0)) * posW(G, b, m), cap: dealersCapLeft(b, c) }; };
function estimate(G, a, m) {            // ventes mensuelles estimées d'un modèle hypothétique, sur le marché d'aujourd'hui
  const s = body(m).seg; let tot = 0; const rows = [];
  for (const c of CK) {
    const dc = brOf(a, m).cty[c].dealers; if (!dc) continue; const C = COUNTRIES[c];
    const Dem = C.vol / 12 * C.taste[s] * G.game.econ * TE.modFactor('demande', c), ref = refPrice(G, s, c), ents = [];
    for (const b of live(G)) for (const x of b.models) if (x.state === 'sale' && body(x).seg === s && brOf(b, x).cty[c].dealers) ents.push(mkEntry(G, b, x, c, s));
    const me = mkEntry(G, a, m, c, s); ents.push(me);
    ents.push({ other: true, price: ref, quality: 1, weight: G.game.othW[c], cap: Infinity });
    TE.splitMarket(Dem, ents, { priceSens: 2.6, qualSens: 2.2, refPrice: ref });
    const u = Math.min(me.sold || 0, dc * DEALER_CAP); tot += u; rows.push([c, u]);
  }
  rows.sort((x, y) => y[1] - x[1]); return { units: tot, rows };
}
function recallCheck(G, a) {            // un défaut sur une pièce partagée touche tous les modèles qui l'utilisent
  const lv = a.test || 0;
  for (const p of a.parts) {
    const users = a.models.filter(m => m.state === 'sale' && (m.eng == p.id || m.chs == p.id || m.gbx == p.id)); if (!users.length) continue;
    const r = p.st.rel, prob = 0.0035 * Math.pow((100 - r) / 40, 2) * (1 - 0.22 * lv);
    if (TE.rng() < prob) {
      const u12 = TE.sum(users.map(m => TE.sum(m.hist.slice(-12)))), cost = u12 * 320 * (100 - r) / 50 + 3e6;
      TE.spend(a, 'rappels', cost); for (const b of new Set(users.map(m => brOf(a, m)))) b.brand = clamp(b.brand - 1.5 - users.length, 5, 100); a.recalls = (a.recalls || 0) + 1;
      if (a.player) TE.news('Rappel de série : « ' + p.name + ' » touche ' + users.length + ' modèle' + (users.length > 1 ? 's' : '') + ' (' + users.map(m => m.name).join(', ') + '). Coût : ' + money(cost) + '.', 'bad');
      else if (TE.rng() < 0.4) TE.news('Rappel massif chez ' + a.name + ' (' + users.length + ' modèle' + (users.length > 1 ? 's' : '') + ').', 'info');
    }
  }
}
function salon(G) {                    // essais comparatifs d'automne
  const alive = live(G), all = [];
  for (const sg in SEG) {
    const c = []; for (const a of alive) for (const m of a.models) if (m.state === 'sale' && body(m).seg === sg && m.age <= 60) c.push({ a, m, q: modelQ(G, m) });
    if (c.length < 2) continue; c.sort((x, y) => y.q - x.q); const w = c[0], l = c[c.length - 1];
    { const wb = brOf(w.a, w.m); wb.brand = clamp(wb.brand + 2.5, 5, 100); } w.m.hype = (w.m.hype || 0) + 0.5; w.a.awards = (w.a.awards || 0) + 1; all.push(w);
    if (c.length >= 3) { const lb = brOf(l.a, l.m); lb.brand = clamp(lb.brand - 1, 5, 100); }
    c.forEach((e, i) => { if (e.a.player) TE.news((i === 0 ? '' : '') + 'Essai comparatif « ' + SEG[sg] + ' » : ' + e.m.name + ' termine ' + (i + 1) + (i === 0 ? 'er' : 'e') + ' sur ' + c.length + '.', i === 0 ? 'good' : i === c.length - 1 ? 'bad' : 'info'); });
  }
  if (all.length) { all.sort((x, y) => y.q - x.q); const w = all[0]; { const wb = brOf(w.a, w.m); wb.brand = clamp(wb.brand + 3, 5, 100); } w.m.hype += 0.4; TE.news('Voiture de l\'année : ' + w.m.name + ' (' + w.a.name + ').', w.a.player ? 'good' : 'info'); }
}
function acquisitions(G) {             // une rivale riche rachète une rivale en détresse
  const R = TE.rivals(); if (R.length < 3) return;
  const res = a => (PROFILES[a.profile] || PROFILES.generaliste).reserve;
  const weak = R.filter(a => a.cash < 0.35 * res(a) && !(TE.player().inv && stake(TE.player(), a) > 50)).sort((x, y) => x.cash - y.cash)[0]; if (!weak) return;
  const buyer = R.filter(b => b !== weak && b.cash > 3 * res(b)).sort((x, y) => y.cash - x.cash)[0]; if (!buyer) return;
  TE.spend(buyer, 'rachat', 150e6); const P0 = TE.player(), h0 = P0 && P0.inv && P0.inv[weak.id];
  if (h0) { const got = Math.round(acqPrice(weak) * h0.pct / 100 * 0.6); P0.cash += got; P0.m.in['plus-values'] = (P0.m.in['plus-values'] || 0) + (got - h0.cost); delete P0.inv[weak.id]; TE.news('Ta participation de ' + h0.pct + ' % dans ' + weak.name + ' est rachetée : ' + money(got) + ' encaissés.', 'info'); }
  acquireBrand(G, buyer, weak);
}
const MS = [
  ['profit', 'premier mois bénéficiaire', (G, p) => p.last && p.last.profit > 0],
  ['u50', '50 000 véhicules sur 12 mois', (G, p) => TE.sum(p.u12) >= 50000],
  ['u200', '200 000 véhicules sur 12 mois', (G, p) => TE.sum(p.u12) >= 200000],
  ['u1m', 'un million de véhicules sur 12 mois', (G, p) => TE.sum(p.u12) >= 1e6],
  ['abroad', 'première usine à l\'étranger', (G, p) => p.fact.some(f => f.c !== p.home && f.ready <= G.day)],
  ['c5', 'présent dans 5 pays (20 concessions ou plus)', (G, p) => CK.filter(c => Math.max.apply(null, brandsOf(p).map(b => b.cty[c].dealers)) >= 20).length >= 5],
  ['brand70', 'image de marque de 70/100', (G, p) => groupImg(p) >= 70],
  ['ev', 'premier modèle électrique vendu', (G, p) => p.models.some(m => m.fuel === 'elec' && m.soldTot > 0)],
  ['award', 'premier trophée d\'essai comparatif', (G, p) => (p.awards || 0) >= 1]
];
function checkMilestones(G) {
  const p = TE.player(), g = G.game; if (p.bankrupt) return;
  for (const [id, t, f] of MS) if (!g.ms[id] && f(G, p)) { g.ms[id] = G.day; p.brand = clamp(p.brand + 1, 5, 100); TE.news('Étape franchie : ' + t + '.', 'good'); }
}
function advice(G, p) {
  const out = [], g = G.game, ms = p.models;
  if ((p.util || 0) > 0.93) out.push(['warn', 'Tes usines sont saturées : des clients repartent sans voiture. Agrandis ou construis.']);
  for (const m of ms) if (m.state === 'sale' && m.age >= 36 && !ms.some(x => x.state === 'dev' && body(x).seg === body(m).seg)) out.push(['warn', m.name + ' entre dans sa phase de déclin (' + m.age + ' mois) et aucun successeur n\'est en développement.']);
  for (const m of ms) if (m.state === 'sale' && m.sold > 0 && m.price * (1 - DEALER_MARGIN) < costNow(p, G, m)) out.push(['bad', m.name + ' est vendu à perte : monte son prix ou réduis les coûts.']);
  const by = banYears(G);
  if (by <= 6 && by > 0 && !ms.some(m => (m.fuel === 'elec' || m.fuel === 'hyb') && m.state !== 'end')) out.push(['bad', 'Fin des ventes thermiques en Europe dans ' + nf(by, 1) + ' an(s) : prévois un modèle hybride ou électrique.']);
  const big = CK.slice().sort((x, y) => COUNTRIES[y].vol - COUNTRIES[x].vol).slice(0, 4).filter(c => reachG(p, c) < 0.25);
  if (big.length) out.push(['info', 'Grands marchés quasi inexploités : ' + big.map(c => COUNTRIES[c].n).join(', ') + '.']);
  if (p.last && p.last.profit < 0 && p.cash < -p.last.profit * 6) out.push(['bad', 'À ce rythme de pertes, ta trésorerie tient moins de six mois.']);
  if (p.cash > 800e6 && p.last && p.last.profit > 0) out.push(['info', 'Trésorerie abondante (' + money(p.cash) + ') : modèles, usines et réseau n\'attendent que toi.']);
  if (brandsOf(p).some(b => !b.pos)) out.push(['info', 'Choisis un positionnement pour chacune de tes marques (onglet Marque) pour orienter tes clients.']);
  if (p.mo && p.mo.demand && p.mo.demand - p.mo.units > 0.04 * p.mo.demand) out.push(['warn', 'Ventes perdues : ' + nf(Math.round(p.mo.demand - p.mo.units)) + ' véhicules ce mois-ci (ruptures de stock ou capacité). Augmente le stock visé ou la capacité.']);
  { const su = stockU(p), mu = TE.sum(p.unitsH.slice(-3)) / Math.max(1, p.unitsH.slice(-3).length); if (mu > 0 && su / mu > 4) out.push(['warn', 'Stock élevé : ' + nf(su / mu, 1) + ' mois de ventes immobilisés. Baisse le stock visé ou fais des promotions.']); }
  if (p.parts.length && TE.sum(p.parts.map(x => x.st.rel)) / p.parts.length < 62 && !(p.test > 0)) out.push(['info', 'Tes pièces sont peu fiables : des tests de fiabilité réduiraient rappels et garantie.']);
  for (const b of BLK) { const r = p.rg && p.rg[b]; if (r && r.u > 0 && r.fc + r.fn > 0) out.push(['warn', BLN[b][0] + ' : ta flotte émet ' + nf(r.avg) + ' g/km pour un plafond de ' + nf(r.cap) + (r.fn > 0 ? ' et ne respecte pas le quota électrifié' : '') + ' : ' + money(r.fc + r.fn) + ' d\'amende par mois (onglet Normes).']); }
  { const RLx = {}, pr = bloPresence(p); for (const b of BLK) RLx[b] = ruleAt(G, b, absYear(G)); for (const m of ms) if (m.state === 'sale') for (const b of BLK) if (pr[b] && !homoOk(RLx[b], m)) { out.push(['bad', m.name + ' n\'est plus homologué en ' + BLN[b][0] + ' : ' + homoWhy(RLx[b], m, null, G).join(', ') + '.']); break; } }
  if (!p.sup && g.batt > 1.25 && ms.some(m => m.fuel === 'elec' && m.state !== 'end')) out.push(['info', 'Le prix des batteries est élevé : un contrat fixe peut te protéger si la hausse continue.']);
  return out.slice(0, 6);
}


const BRAND_COL = ['#8e24aa', '#00838f', '#6d4c41', '#c2185b', '#558b2f', '#283593', '#ef6c00', '#455a64'];
const NEW_BRAND_COST = 40e6;
const BRAND_NAMES = ['Aurelia', 'Kestrel', 'Zephyr', 'Montclair', 'Halden', 'Vireo', 'Sorrel', 'Bastia', 'Norvik', 'Calypso', 'Tarvos', 'Ondine', 'Brevan', 'Lumen', 'Ostara', 'Drakar'];
const actorById = (G, id) => G.actors.find(x => x.id === id);
const cl = o => JSON.parse(JSON.stringify(o));
function newBrand(G, p, name, home) {
  const cty = {}; for (const c of CK) cty[c] = { dealers: 0, aware: c === home ? 20 : 2, ads: 0, share: 0 };
  const b = { bid: G.nid++, name, color: BRAND_COL[(p.extra.length + G.nid) % BRAND_COL.length], home, cty, brand: 30, pos: null, awards: 0 };
  p.extra.push(b); return b;
}
const brandPrice = (t, b) => Math.round((50e6 + b.brand * 1.2e6 + TE.sum(Object.values(b.cty).map(x => x.dealers)) * 0.25e6 + 12 * TE.sum(t.models.filter(m => m.br === b.bid).map(m => m.sold || 0)) * 900) / 1e6) * 1e6;
function acquireBrand(G, p, t, bid) {     // bid absent : toute l'entreprise devient une (ou plusieurs) marque(s) du groupe ; sinon une seule marque d'un groupe rival
  const mine = p.player ? 'ton groupe' : 'le groupe ' + p.name; let moved = [], mods;
  if (bid == null) {
    const nb = { bid: G.nid++, name: t.name, color: t.color, home: t.home, cty: t.cty, brand: t.brand, pos: t.pos || null, awards: t.awards || 0 };
    moved = [nb].concat(t.extra || []);
    for (const m of t.models) { if (!m.br) m.br = nb.bid; p.models.push(m); }
    for (const x of t.parts) p.parts.push(x);
    for (const x of t.proj) p.proj.push(x);
    for (const f of t.fact) p.fact.push(f);
    p.staff.ingenieurs.n += t.staff.ingenieurs.n; t.staff.ingenieurs.n = 0;
    p.cash += t.cash; p.debt += t.debt;
    for (const L of lics(G)) { if (L.from === t.id) L.from = p.id; if (L.to === t.id) L.to = p.id; }
    mods = t.models.filter(m => m.state !== 'end').length;
    t.models = []; t.parts = []; t.proj = []; t.fact = []; t.extra = []; t.cash = 0; t.debt = 0; t.bankrupt = true; t.absorbed = true;
  } else {
    const b = (t.extra || []).find(x => x.bid === bid); if (!b) return null;
    t.extra = t.extra.filter(x => x !== b); moved = [b];
    const out = t.models.filter(m => m.br === bid); mods = out.filter(m => m.state !== 'end').length;
    t.models = t.models.filter(m => m.br !== bid);
    for (const m of out) {        // les pièces sont copiées (le vendeur les garde pour ses autres marques)
      for (const k of ['eng', 'chs', 'gbx']) {
        const src = partOf(t, m[k]); if (!src) continue;
        let have = p.parts.find(x => x.kind === src.kind && specKey(x.spec) === specKey(src.spec));
        if (!have) { have = cl(src); have.id = G.nid++; delete have.lic; p.parts.push(have); }
        m[k] = have.id;
      }
      p.models.push(m);
    }
  }
  p.extra.push.apply(p.extra, moved); G.mut = (G.mut || 0) + 1;
  const n = TE.sum(moved.map(b => TE.sum(Object.values(b.cty).map(x => x.dealers))));
  TE.news('Rachat : ' + moved.map(b => b.name).join(', ') + ' rejoint' + (moved.length > 1 ? 'nent' : '') + ' ' + mine + ' (' + mods + ' modèle' + (mods > 1 ? 's' : '') + ', ' + nf(n) + ' concessions).', p.player ? 'good' : 'info');
  return moved[0];
}
/* ---------- Licences : le marché des pièces et des modèles ---------- */
const lics = G => G.game.lics || (G.game.lics = []);
const TERMS = [[0.2, 1.4, 'Redevance'], [0.5, 1, 'Équilibré'], [0.9, 0.4, 'Cash d\'abord']];
const itemOf = (a, kind, id) => kind === 'part' ? a.parts.find(x => x.id == id) : a.models.find(x => x.id == id);
function licTerms(kind, it, tm) {
  const T = TERMS[tm == null ? 1 : tm];
  if (kind === 'part') { const dev = partInfo(it.kind, it.spec).dev; return { fee: Math.round(dev * T[0] / 1e6) * 1e6, r: Math.max(20, Math.round(dev / 1.5e6 * T[1] / 10) * 10) }; }
  const dev = it.devCost || devInfo(it.body, it.fin, it.sty).dev; return { fee: Math.round(dev * 0.6 * T[0] / 0.5 / 1e6) * 1e6, r: 0.05 * T[1] };
}
const hasSpec = (a, it) => a.parts.some(x => x.kind === it.kind && specKey(x.spec) === specKey(it.spec));
function licWilling(G, t, kind, it, fee) {
  if (t.bankrupt || t.cash < fee * 2) return false;
  if (kind === 'part') return !hasSpec(t, it);
  return !t.models.some(x => x.state === 'sale' && body(x).seg === body(it).seg && x.age < 30);
}
function brOfId(a, bid) { return brandsOf(a).find(b => (b.bid || 0) === (+bid || 0)) || brandsOf(a)[0]; }
function grantLic(G, from, to, kind, it, tm, bid) {
  const T = licTerms(kind, it, tm), Ls = lics(G); bid = (brandsOf(to).some(b => (b.bid || 0) === (+bid || 0)) ? +bid : 0) || 0;
  if (Ls.some(L => L.kind === kind && L.item === it.id && L.from === from.id && L.to === to.id)) return 'Déjà sous licence.';
  if (kind === 'part' && hasSpec(to, it)) return 'Cette pièce est déjà dans le catalogue du licencié.';
  if (to.cash < T.fee) return 'Trésorerie insuffisante : ' + money(T.fee) + '.';
  const id = G.nid++, L = { id, kind, item: it.id, from: from.id, to: to.id, fee: T.fee, r: T.r, cum: 0, day: G.day, name: it.name, bid };
  if (kind === 'part') { const cp = cl(it); cp.id = G.nid++; cp.lic = id; cp.lbr = bid; to.parts.push(cp); }
  else {
    const map = {};
    for (const k of ['eng', 'chs', 'gbx']) {
      const src = partOf(from, it[k]); let have = to.parts.find(x => x.kind === src.kind && specKey(x.spec) === specKey(src.spec));
      if (!have) { have = cl(src); have.id = G.nid++; have.lic = id; have.lbr = bid; to.parts.push(have); } map[k] = have.id;
    }
    const m2 = Object.assign(cl(it), { id: G.nid++, eng: map.eng, chs: map.chs, gbx: map.gbx, lic: id, br: bid, state: 'sale', stock: 0, fc: null, pre: 1, age: 0, hype: 0.2, disc: 0, discLeft: 0, camp: 0, sold: 0, soldTot: 0, hist: [], cs: {}, left: 0, total: 0, monthly: 0 });
    to.models.push(m2);
  }
  TE.spend(to, 'licences', T.fee); TE.earn(from, 'licences', T.fee); Ls.push(L);
  if (to.player || from.player) TE.news('Licence ' + (kind === 'part' ? 'de pièce' : 'de modèle') + ' : ' + it.name + ', ' + from.name + ' → ' + to.name + (brandsOf(to).length > 1 ? ' [' + brOfId(to, bid).name + ']' : '') + ' (' + money(T.fee) + ').', 'info');
  return null;
}
function licPay(G, a, m) {
  const u = m.sold, Ls = lics(G); if (!u || !Ls.length) return;
  const pay = (L, amt) => { if (!(amt > 0)) return; TE.spend(a, 'licences', amt); L.cum += amt; const f = actorById(G, L.from); if (f && !f.bankrupt) TE.earn(f, 'licences', amt); };
  if (m.lic) { const L = Ls.find(x => x.id === m.lic); if (L) pay(L, u * effPrice(m) * (1 - DEALER_MARGIN) * L.r); return; }
  for (const k of ['eng', 'chs', 'gbx']) { const pt = partOf(a, m[k]); if (pt && pt.lic) { const L = Ls.find(x => x.id === pt.lic); if (L) pay(L, u * (L.kind === 'part' ? L.r : 400)); } }
}
function licMonth(G) {                   // les rivales se concèdent des licences entre elles ; nettoyage des contrats caducs
  G.game.lics = lics(G).filter(L => { const f = actorById(G, L.from), t = actorById(G, L.to); return f && t && !f.bankrupt && !t.bankrupt && f !== t; });
  if (TE.rng() > 0.3) return; const R = TE.rivals(); if (R.length < 2) return;
  const f = TE.pick(R), cand = f.parts.filter(x => !x.lic && x.spec.lvl >= 4); if (!cand.length) return;
  const it = TE.pick(cand), fee = licTerms('part', it, 1).fee, pool = R.filter(t => t !== f && licWilling(G, t, 'part', it, fee)); if (!pool.length) return;
  const t = TE.pick(pool); if (!grantLic(G, f, t, 'part', it, 1)) TE.news(f.name + ' concède à ' + t.name + ' une licence sur ' + it.name + '.', 'info');
}
function aiBrands(G) {                   // les rivales riches deviennent des groupes : elles lancent de nouvelles marques
  for (const a of TE.rivals()) {
    const P = PROFILES[a.profile] || PROFILES.generaliste;
    if (a.extra.length >= 3 || yrs(G) < 2 || a.cash < 3 * P.reserve || TE.rng() > 0.12) continue;
    const used = new Set(G.actors.concat(G.actors.reduce((r, x) => r.concat(x.extra || []), [])).map(x => x.name)), pool = BRAND_NAMES.filter(n => !used.has(n)); if (!pool.length) return;
    const seg = TE.pick(Object.keys(SEG)), nb = newBrand(G, a, TE.pick(pool), a.home); TE.spend(a, 'marques', NEW_BRAND_COST);
    for (const c of CK) nb.cty[c].dealers = Math.round(a.cty[c].dealers * 0.3);
    const n0 = a.models.length; if (planModel(a, G, P, seg, true) && a.models.length > n0) a.models[a.models.length - 1].br = nb.bid;
    TE.news('🆕 ' + a.name + ' lance une nouvelle marque : ' + nb.name + '.', 'info');
  }
}
const stockCard = (G, p) => {
  const su = stockU(p), n3 = p.unitsH.slice(-3), mu = TE.sum(n3) / Math.max(1, n3.length), cover = mu ? su / mu : 0, T = p.stockT == null ? 1.5 : p.stockT, val = TE.sum(p.models.map(m => (m.stock || 0) * costNow(p, G, m))), lost = p.mo ? Math.max(0, p.mo.demand - p.mo.units) : 0;
  return H.card('Stock visé', '<p class="muted" style="font-size:13px">La production vise un stock de N mois de ventes prévues. Trop bas : ruptures et ventes perdues (surtout aux pics de mars et de septembre). Trop haut : trésorerie immobilisée, 1,2 % de la valeur en frais de stockage par mois, et des modèles qui vieillissent invendus.</p>' +
    H.seg('stock', 'g', STOCK_OPTS.indexOf(T), STOCK_L.map(x => x + ' mois')) +
    H.kv([['Stock actuel', nf(Math.round(su)) + ' véh.'], ['Couverture', nf(cover, 1) + ' mois de ventes'], ['Valeur immobilisée', money(val)], ['Frais de stockage', money(val * 0.012) + '/mois'], ['Ventes perdues ce mois', nf(Math.round(lost)) + ' véh.', lost > 0.04 * (p.mo ? p.mo.demand : 1) ? 'neg' : '']]));
};
const brandChips = p => brandsOf(p).length > 1 ? '<div class="chips">' + brandsOf(p).map(b => '<button class="chip" data-act="set" data-k="sbr" data-v="' + (b.bid || 0) + '" aria-pressed="' + (selB(p) === b) + '">' + esc(b.name) + '</button>').join('') + '</div>' : '';
function panelStocks(G, p) {
  const ms = p.models.filter(m => m.state === 'sale' || (m.state === 'end' && (m.stock || 0) > 0)), cap = capOf(p, G), n3 = p.unitsH.slice(-3), mu = TE.sum(n3) / Math.max(1, n3.length);
  const val = TE.sum(p.models.map(m => (m.stock || 0) * costNow(p, G, m))), cov = mu ? stockU(p) / mu : 0;
  return '<h2>Stocks</h2>' + H.tiles([['Stock total', nf(Math.round(stockU(p))) + ' véh.'], ['Couverture', nf(cov, 1) + ' mois'], ['Valeur', money(val)], ['Usines utilisées', TE.pct(p.util || 0), (p.util || 0) > 0.93 ? 'neg' : '']]) +
    H.card('Capacité de production', H.bar(p.util || 0, 1, (p.util || 0) > 0.93 ? 'bad' : '') + H.kv([['Capacité', nf(cap) + ' véh./mois'], ['Production du mois', nf(Math.round(p.mo ? p.mo.prod : 0)) + ' véh.'], ['Demande du mois', nf(Math.round(p.mo ? p.mo.demand || 0 : 0)) + ' véh.']])) +
    stockCard(G, p) +
    (ms.length ? H.bento(ms.map(m => { const T = stockOf(p, m), cv = (m.stock || 0) / Math.max(1, m.fc || m.sold || 1);
      return H.fold('s' + m.id, { title: esc(m.name) + ' ' + (brandsOf(p).length > 1 ? H.pill(esc(brOf(p, m).name)) + ' ' : '') + (m.state === 'end' ? H.pill('retiré · liquidation', 'warn') : ''), img: lookOf(p, m), metrics: [['Stock', nf(Math.round(m.stock || 0))], ['Mois', nf(cv, 1), cv > 3 ? 'neg' : '']], body: H.bar(Math.min(cv, 4), 4, cv > 3 ? 'bad' : '') +
        '<div class="row">' + H.btn(H.ico('gamme') + ' Voir le modèle', 'goto', { tab: 'gamme', open: 'm' + m.id }, { cls: 'small' }) + '</div>' + H.kv([['Stock', nf(Math.round(m.stock || 0)) + ' véh. (' + nf(cv, 1) + ' mois)'], ['Cible', nf(T, 1) + ' mois' + (m.stT == null ? ' (auto)' : '')], ['Ventes perdues', nf(Math.round(m.lost || 0)) + ' véh.', (m.lost || 0) > 0.05 * (m.fc || 1) ? 'neg' : '']]) +
        (m.state === 'sale' ? '<div class="row"><span class="muted" style="font-size:12px">Stock visé</span>' + H.seg('stockm', m.id, m.stT == null ? 0 : STOCK_OPTS.indexOf(m.stT) + 1, ['Auto'].concat(STOCK_L)) + '</div>' : '') }); }).join('')) : '<p class="muted">Aucun modèle en vente.</p>');
}
function panelGroupe(G, p) {
  const B = brandsOf(p), R = TE.rivals(), u1 = p.unitsH[p.unitsH.length - 1] || 0, UI = TE.UI;
  const bc = b => { const mods = p.models.filter(m => brOf(p, m) === b && m.state !== 'end'), u = TE.sum(mods.map(m => m.sold || 0));
    return H.fold('b' + (b.bid || 0), { img: 'brand-' + (1 + (b.bid || 0) % 12), title: '<span class="dot" style="background:' + (b.color || p.color) + '"></span>' + esc(b.name), metrics: [['Image', Math.round(b.brand)], ['Modèles', mods.length], ['Ventes', nf(u)]], body: H.kv([['Image de marque', Math.round(b.brand) + ' / 100'], ['Modèles', mods.length], ['Ventes du mois', nf(u) + ' véh.'], ['Concessions', nf(TE.sum(Object.values(b.cty).map(x => x.dealers)))], ['Positionnement', b.pos ? POS[b.pos][0] : 'aucun']]) +
      (selB(p) === b ? '<span class="pill good">marque active (Pays, Marque)</span>' : H.btn('Gérer cette marque', 'set', { k: 'sbr', v: b.bid || 0 }, { cls: 'small' })) }); };
  const FT = fU('fgt'), rows = [];
  for (const t of R) { const n = 1 + t.extra.length; if (FT !== 'br') rows.push({ t, b: null, nm: esc(t.name) + (n > 1 ? ' <span class="muted">· groupe de ' + n + ' marques</span>' : ''), u: TE.sum(t.u12), img: t.brand, price: acqPrice(t), whole: true });
    if (FT !== 'co') for (const b of t.extra) rows.push({ t, b, nm: '↳ ' + esc(b.name), u: 12 * TE.sum(t.models.filter(m => m.br === b.bid).map(m => m.sold || 0)), img: b.brand, price: brandPrice(t, b) }); }
  return '<h2>Groupe</h2>' + H.tiles([['Marques', B.length], ['Ventes du mois', nf(u1) + ' véh.'], ['Usines', p.fact.length], ['Ingénieurs', p.staff.ingenieurs.n]]) +
    '<p class="muted" style="font-size:13px">Un groupe partage ses usines, ses ingénieurs et ses pièces (moteurs, châssis, boîtes) entre ses marques : plus de plateformes communes, donc des coûts plus bas. Chaque marque a son image, son réseau, son marketing, son positionnement et ses modèles. Deux marques sur un même segment se font concurrence.</p>' +
    H.bento(B.map(bc).join('')) +
    H.card('Créer une marque', '<p class="muted" style="font-size:12px">Lancement : ' + money(NEW_BRAND_COST) + '. Elle démarre sans concession ni notoriété, avec une image neutre : ouvre-lui un réseau, choisis son positionnement, puis dessine-lui des modèles.</p><div class="row">' + H.text('nbname', { ph: 'Nom de la nouvelle marque', max: 20 }) + '</div><div class="f"><span>Pays d\'origine</span>' + H.chips('set', 'nbhome', UI.nbhome || p.home, CK.map(c => [c, COUNTRIES[c].n])) + '</div>' + H.btn('Créer la marque (' + money(NEW_BRAND_COST) + ')', 'newbrand', {}, { cls: 'primary', off: p.cash < NEW_BRAND_COST, why: 'Trésorerie insuffisante.' })) +
    (B.length > 1 ? H.card('Vendre une marque', '<p class="muted" style="font-size:12px">Cède une marque (réseau, image, modèles) à une rivale, au prix de marché moins 10 %, ou à un fonds qui la liquide (60 % du prix, modèles retirés). La marque principale ne peut pas être vendue.</p>' + B.filter(b => b.bid).map(b => { const pr = Math.round(brandPrice(p, b) * 0.9 / 1e6) * 1e6; return H.fold('sb' + b.bid, { title: esc(b.name), metrics: [['Prix', money(pr)], ['Image', Math.round(b.brand)]], body: R.map(t => '<div class="row"><span class="grow">' + esc(t.name) + '</span>' + H.btn('Vendre ' + money(pr), 'sellbrand', { b: b.bid, to: t.id }, { cls: 'small', off: t.cash < pr * 1.2, why: 'Cette rivale n\'a pas la trésorerie.' }) + '</div>').join('') + '<div class="row"><span class="grow">Fonds (liquidation)</span>' + H.btn('Céder ' + money(Math.round(pr * 0.6 / 1e6) * 1e6), 'sellbrand', { b: b.bid, to: 'fund' }, { cls: 'small' }) + '</div>' }); }).join('')) : '') +
    (B.length > 1 ? H.card('Scinder une marque en société indépendante', '<p class="muted" style="font-size:12px">La marque devient une entreprise à part entière (modèles, réseau, une usine, des ingénieurs) dont tu détiens 100 %. Tu la pilotes avec un mandat et tu peux ensuite vendre des parts en bourse, jusqu\'à la céder entièrement, depuis l\'onglet Bourse. Tu choisis la dotation en trésorerie.</p>' + B.slice(1).map(b => '<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b>' + esc(b.name) + '</b> <span class="muted" style="font-size:12.5px">· ' + p.models.filter(m => m.br === b.bid && m.state !== 'end').length + ' modèles</span><div class="chips" style="margin-top:6px">' + [0, 100e6, 300e6, 1e9].map(v => H.btn(v ? 'Dotation ' + money(v) : 'Sans dotation', 'spin', { b: b.bid, dot: v }, { cls: 'small', off: p.cash < v, why: 'Trésorerie insuffisante' })).join('') + '</div></div>').join('')) : '') +
    H.card('Racheter une entreprise ou une marque', R.length ? H.filter('Cibles', 'fgt', FT, [['', 'Toutes'], ['co', 'Entreprises'], ['br', 'Marques seules']]) + '<p class="muted" style="font-size:12px">Entreprise entière : valeur des actifs + 30 % de prime + 800 € par véhicule vendu sur 12 mois ; tu reprends aussi sa trésorerie, ses dettes, ses usines, ses pièces, ses modèles et toutes ses marques. Une seule marque d\'un groupe rival : réseau, image et modèles, avec une copie des pièces utilisées.</p>' + H.table([{ h: 'Cible', get: r => r.nm }, { h: 'Ventes 12 m', cls: 'num', get: r => nf(r.u) }, { h: 'Image', cls: 'num', get: r => Math.round(r.img) }, { h: 'Prix', cls: 'num', get: r => money(r.price) }, { h: '', get: r => H.btn('Racheter', 'buyco', r.b ? { id: r.t.id, b: r.b.bid } : { id: r.t.id }, { cls: 'small primary', off: p.cash < r.price, why: 'Trésorerie insuffisante : emprunte dans Finances.' }) }], rows) : '<p class="muted">Plus aucune rivale à racheter.</p>');
}
/* =============================== SPORT AUTOMOBILE =============================== */
// Championnats aux règles propres : chaque série impose sa fourniture (moteur, voiture de série ou rien), un budget libre réparti en postes,
// et une grille d'écuries d'usine et d'entreprises dédiées au sport (motoristes, préparateurs, écuries indépendantes).
const SCAT = { mono: ['Monoplaces', 'Châssis de course, budgets élevés'], endu: ['Endurance & GT', 'Voitures de course dérivées de la route'], tour: ['Tourisme & ovales', 'Compétition au plus près de la série'], off: ['Rallye & tout-terrain', 'Terre, sable, boue et électrique extrême'] };
const SERIES = {
  f1: { n: 'Formule 1', sub: 'Le sommet mondial', cat: 'mono', ic: '🏎️', prest: 1, ref: 120e6, entry: 30e6, rounds: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], cap: 14, grid: 11, aff: ['sport', 'premium', 'americain'], sup: 'eng', fuel: ['ess', 'hyb'], kw: 150, ekw: 300, txt: 'Monoplaces, budgets colossaux, audience planétaire : la plus grande vitrine possible. Il faut un moteur de ta conception ou un moteur client.' },
  f2: { n: 'Formule Challenger', sub: 'Monoplaces de promotion', cat: 'mono', ic: '🏁', prest: 0.3, ref: 12e6, entry: 2e6, rounds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], cap: 18, grid: 14, aff: ['lowcost', 'generaliste', 'americain', 'sport'], sup: 'none', txt: 'Châssis et moteur uniques imposés par le promoteur : seule la qualité de ton organisation compte. Idéal pour débuter à petit prix.' },
  fe: { n: 'Formule E', sub: 'Monoplaces électriques', cat: 'mono', ic: '⚡', prest: 0.6, ref: 40e6, entry: 10e6, rounds: [0, 1, 2, 4, 5, 7, 8, 9, 10, 11], cap: 12, grid: 10, aff: ['electrique', 'premium', 'generaliste'], sup: 'eng', fuel: ['elec'], kw: 90, ekw: 190, txt: 'Vitrine technologique de l\'électrique : il faut un moteur électrique, de ton catalogue ou d\'un fournisseur.' },
  endu: { n: 'Hypercar & Endurance', sub: '24 Heures · Grandes courses', cat: 'endu', ic: '🌙', prest: 0.8, ref: 60e6, entry: 15e6, rounds: [2, 5, 8, 10], cap: 14, grid: 12, aff: ['sport', 'premium', 'americain', 'generaliste'], sup: 'car', segs: ['spo'], fuel: ['ess', 'hyb', 'elec'], ep: 62, txt: 'Quatre grandes courses par an, points doublés. La base est une de tes sportives de série : plus elle est performante et fiable, plus tu vas loin.' },
  gt: { n: 'Championnat GT', sub: 'Voitures de grand tourisme', cat: 'endu', ic: '🏆', prest: 0.45, ref: 25e6, entry: 5e6, rounds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], cap: 18, grid: 16, aff: ['sport', 'premium', 'americain', 'generaliste'], sup: 'car', segs: ['spo', 'ber'], fuel: ['ess', 'hyb'], ep: 56, txt: 'Des voitures très proches de la série : coupés, sportives et grosses berlines. Excellent pour l\'image des modèles sportifs.' },
  tcr: { n: 'Tourisme compact', sub: 'Berlines et compactes de course', cat: 'tour', ic: '🚗', prest: 0.3, ref: 8e6, entry: 1.5e6, rounds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], cap: 20, grid: 16, aff: ['lowcost', 'generaliste', 'electrique'], sup: 'car', segs: ['cit', 'comp', 'ber'], fuel: ['ess', 'die', 'hyb', 'elec'], ep: 40, txt: 'Le ticket d\'entrée : une citadine, une compacte ou une berline de ta gamme, préparée pour la piste. Peu cher, grande visibilité locale.' },
  stock: { n: 'Stock-car', sub: 'Ovales et gros V8', cat: 'tour', ic: '🔥', prest: 0.5, ref: 45e6, entry: 9e6, rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], cap: 20, grid: 18, aff: ['americain', 'generaliste', 'sport'], sup: 'eng', fuel: ['ess'], kw: 150, cyl: 6, ekw: 270, txt: 'Moteurs essence d\'au moins 6 cylindres, grille de 18 voitures : le spectacle à l\'américaine, très populaire outre-Atlantique.' },
  rally: { n: 'Rallye mondial', sub: 'Terre, neige, asphalte', cat: 'off', ic: '🌲', prest: 0.6, ref: 35e6, entry: 8e6, rounds: [0, 1, 3, 4, 6, 8, 9, 11], cap: 14, grid: 12, aff: ['generaliste', 'lowcost', 'sport'], sup: 'car', segs: ['cit', 'comp', 'suv'], fuel: ['ess', 'die', 'hyb'], ep: 48, txt: 'Citadines, compactes et petits SUV de ta gamme : une excellente image auprès du grand public.' },
  raid: { n: 'Rallye-raid', sub: 'Marathon dans le désert', cat: 'off', ic: '🏜️', prest: 0.5, ref: 30e6, entry: 6e6, rounds: [0, 1, 2, 8, 10], cap: 14, grid: 12, aff: ['generaliste', 'americain', 'lowcost'], sup: 'car', segs: ['suv'], fuel: ['ess', 'die', 'hyb'], ep: 44, txt: 'Des SUV de ta gamme : la fiabilité prime. Peu de courses mais très longues, idéal pour une image de robustesse.' },
  xe: { n: 'Extrême E', sub: 'SUV électriques tout-terrain', cat: 'off', ic: '🔋', prest: 0.45, ref: 25e6, entry: 5e6, rounds: [1, 3, 6, 9, 11], cap: 10, grid: 8, aff: ['electrique', 'premium'], sup: 'car', segs: ['suv'], fuel: ['elec'], ep: 46, txt: 'SUV électriques engagés dans des environnements extrêmes : un message fort pour une marque verte.' }
};
const SK = Object.keys(SERIES), SPTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], SPURSE = [0.3, 0.2, 0.14, 0.1, 0.07, 0.05, 0.04, 0.03, 0.02, 0.01];

/* ---- Calendriers : de vraies courses, dans de vrais pays [mois, nom, pays, poids (2 = grande course)] ---- */
const CAL0 = {
  f1: [[2, 'Bahreïn', 'BH'], [2, 'Arabie saoudite', 'SA'], [3, 'Australie', 'AU'], [3, 'Japon', 'JP'], [4, 'Chine', 'CN'], [4, 'Miami', 'US'], [4, 'Émilie-Romagne', 'IT'], [5, 'Monaco', 'FR', 2], [5, 'Espagne', 'ES'], [5, 'Canada', 'CA'], [6, 'Autriche', 'AT'], [6, 'Grande-Bretagne', 'GB', 2], [6, 'Belgique', 'BE'], [7, 'Hongrie', 'HU'], [7, 'Pays-Bas', 'NL'], [8, 'Italie', 'IT', 2], [8, 'Singapour', 'SG'], [9, 'États-Unis', 'US'], [9, 'Mexique', 'MX'], [10, 'Brésil', 'BR'], [10, 'Las Vegas', 'US'], [11, 'Qatar', 'QA'], [11, 'Abou Dhabi', 'AE']],
  f2: [[0, 'Kyalami', 'ZA'], [1, 'Portimão', 'PT'], [2, 'Jerez', 'ES'], [3, 'Zandvoort', 'NL'], [3, 'Spa', 'BE'], [4, 'Imola', 'IT'], [4, 'Barcelone', 'ES'], [5, 'Le Castellet', 'FR'], [6, 'Silverstone', 'GB'], [7, 'Spielberg', 'AT'], [7, 'Budapest', 'HU'], [8, 'Monza', 'IT'], [9, 'Austin', 'US'], [10, 'Interlagos', 'BR']],
  fe: [[0, 'Mexico', 'MX'], [0, 'Diriyah', 'SA'], [1, 'São Paulo', 'BR'], [2, 'Tokyo', 'JP'], [3, 'Berlin', 'DE'], [3, 'Monaco', 'FR', 2], [4, 'Jakarta', 'ID'], [5, 'Portland', 'US'], [6, 'Londres', 'GB'], [6, 'Séoul', 'KR'], [8, 'Shanghai', 'CN'], [9, 'Marrakech', 'MA'], [10, 'Valence', 'ES'], [11, 'Sharjah', 'AE']],
  endu: [[2, '12 Heures de Sebring', 'US'], [3, '6 Heures de Spa', 'BE'], [5, '24 Heures du Mans', 'FR', 2], [6, '6 Heures de Monza', 'IT'], [8, '6 Heures de Fuji', 'JP'], [9, '6 Heures d\'Austin', 'US'], [10, '8 Heures de Bahreïn', 'BH'], [11, '9 Heures d\'Interlagos', 'BR']],
  gt: [[0, 'Dubaï', 'AE'], [1, 'Paul Ricard', 'FR'], [2, 'Imola', 'IT'], [3, 'Barcelone', 'ES'], [4, 'Brands Hatch', 'GB'], [5, 'Nürburgring', 'DE', 2], [6, 'Spa', 'BE', 2], [7, 'Budapest', 'HU'], [8, 'Zandvoort', 'NL'], [9, 'Misano', 'IT'], [10, 'Valence', 'ES'], [11, 'Bathurst', 'AU']],
  tcr: [[0, 'Marrakech', 'MA'], [1, 'Valence', 'ES'], [2, 'Portimão', 'PT'], [3, 'Hungaroring', 'HU'], [3, 'Brno', 'CZ'], [4, 'Oschersleben', 'DE'], [5, 'Pau', 'FR'], [5, 'Zolder', 'BE'], [6, 'Salzburgring', 'AT'], [7, 'Sepang', 'MY'], [8, 'Macao', 'CN'], [9, 'Suzuka', 'JP'], [10, 'Buenos Aires', 'AR'], [11, 'Sandown', 'AU']],
  stock: [[1, 'Daytona', 'US', 2], [1, 'Atlanta', 'US'], [2, 'Las Vegas', 'US'], [2, 'Phoenix', 'US'], [3, 'Talladega', 'US'], [3, 'Martinsville', 'US'], [4, 'Darlington', 'US'], [4, 'Charlotte', 'US'], [5, 'Mexico', 'MX'], [5, 'Sonoma', 'US'], [6, 'Chicago', 'US'], [6, 'Pocono', 'US'], [7, 'Indianapolis', 'US', 2], [7, 'Michigan', 'US'], [8, 'Bristol', 'US'], [8, 'Kansas', 'US'], [9, 'Montréal', 'CA'], [9, 'Texas', 'US'], [10, 'Homestead', 'US'], [10, 'Phoenix finale', 'US']],
  rally: [[0, 'Monte-Carlo', 'FR', 2], [1, 'Suède', 'SE'], [2, 'Mexique', 'MX'], [3, 'Croatie', 'HR'], [4, 'Portugal', 'PT'], [4, 'Sardaigne', 'IT'], [5, 'Kenya', 'KE'], [6, 'Estonie', 'EE'], [6, 'Finlande', 'FI', 2], [8, 'Paraguay', 'PY'], [9, 'Chili', 'CL'], [10, 'Japon', 'JP'], [11, 'Arabie saoudite', 'SA']],
  raid: [[0, 'Dakar', 'SA', 2], [2, 'Rallye du Maroc', 'MA'], [5, 'Sonora', 'MX'], [8, 'Abou Dhabi', 'AE'], [9, 'Rallye d\'Égypte', 'EG'], [10, 'Atacama', 'CL'], [11, 'Qatar', 'QA']],
  xe: [[1, 'Désert d\'Arabie', 'SA'], [3, 'Sardaigne', 'IT'], [6, 'Norvège', 'NO'], [8, 'Chili', 'CL'], [9, 'Sénégal', 'SN'], [11, 'Uruguay', 'UY']]
};
const CAL = {};
for (const k of Object.keys(SERIES)) { CAL[k] = CAL0[k].map((r, i) => ({ m: r[0], n: r[1], c: r[2], w: r[3] || 1, i })).sort((a, b) => a.m - b.m || a.i - b.i).map((r, i) => Object.assign(r, { i })); SERIES[k].rounds = Array.from(new Set(CAL[k].map(r => r.m))); }
const spYear = G => Math.floor(G.day / 360) + (TE.cal().startYear || 0);
const cName = c => (COUNTRIES[c] || { n: c }).n, cReg = c => (COUNTRIES[c] || { reg: 'euo' }).reg;
const STR = { prud: { n: 'Prudente', dnf: 0.6, vr: 0.75, pace: -1.2, tx: 'moins d\'abandons, résultats réguliers, un peu moins de rythme' }, eq: { n: 'Équilibrée', dnf: 1, vr: 1, pace: 0, tx: 'le compromis classique' }, agr: { n: 'Offensive', dnf: 1.5, vr: 1.3, pace: 2, tx: 'plus de rythme et de coups d\'éclat, mais plus d\'abandons' } };
const PL = [['Jeunes talents', 'peu coûteux, rythme moindre, image discrète', -3, 0.01, 0.9], ['Pilotes confirmés', 'l\'équilibre prix/performance', 0, 0.07, 1], ['Stars du sport', 'rythme et notoriété maximaux, salaires élevés', 5, 0.2, 1.3]];
const plCost = t => SERIES[t.s].ref * PL[t.pl == null ? 1 : t.pl][3];
const tdef = t => { if (t.sp == null) { const D = { sp: [], pl: 1, st: 'eq', reg: 'world', sum: 0, best: 0, dnf: 0, inc: 0, exp: 0, hs: [], form: [], w0: 0 }; for (const k of Object.keys(D)) if (t[k] == null) t[k] = D[k]; } return t; };
/* image : buzz sportif mondial / régional / par pays, par marque */
const spX = b => b.spx || (b.spx = { w: 0, r: {}, c: {} });
const spBuzz = (b, c) => b.spx ? b.spx.w + (b.spx.r[cReg(c)] || 0) + (b.spx.c[c] || 0) : 0;
const spDecay = b => { const x = b.spx; if (!x) return; x.w *= 0.94; for (const k of Object.keys(x.r)) { x.r[k] *= 0.94; if (x.r[k] < 0.05) delete x.r[k]; } for (const k of Object.keys(x.c)) { x.c[k] *= 0.93; if (x.c[k] < 0.05) delete x.c[k]; } };
/* sponsors */
const SPONS = [['Banque Atlantis', 'Banque', 2], ['Voltéra Énergie', 'Énergie', 3], ['Kolibri Mobile', 'Télécoms', 2], ['Nectar Boissons', 'Boisson', 1], ['Helios Assurances', 'Assurance', 2], ['Zenith Montres', 'Luxe', 4], ['PneuPlus', 'Équipementier', 1], ['Quantum Cloud', 'Technologie', 3], ['Sahara Airlines', 'Transport', 3], ['Burger Pilote', 'Restauration', 1], ['Lumina Cosmétiques', 'Beauté', 2], ['Titan Lubrifiants', 'Énergie', 1], ['Orbit Paris', 'Paris sportifs', 3], ['Cobalt Acier', 'Industrie', 2], ['Maison Vérone', 'Luxe', 4], ['Neon Jeux Vidéo', 'Divertissement', 2], ['AquaPure', 'Boisson', 1], ['Delta Logistique', 'Transport', 1]];
const spSlots = t => clamp(1 + Math.floor(t.fame / 30), 1, 4);
const spOffer = (G, S, t) => {
  const sr = SERIES[t.s], have = new Set(t.sp.map(c => c.sp)), offs = S.off[t.id] || (S.off[t.id] = []), opts = SPONS.map((x, i) => i).filter(i => !have.has(i) && !offs.some(o => o.sp === i) && t.fame >= SPONS[i][2] * 8 - 8);
  if (!opts.length) return; const i = TE.pick(opts), tier = SPONS[i][2], reg = TE.rng() < 0.5 ? 'world' : TE.pick(REGK);
  offs.push({ id: S.oid++, sp: i, fee: Math.round(sr.ref * (0.03 + 0.045 * tier) * (0.6 + t.fame / 70) * (0.85 + TE.rng() * 0.35) / 1e5) * 1e5, bonus: Math.round(sr.ref * 0.012 * tier * (0.8 + TE.rng() * 0.5) / 1e5) * 1e5, goal: Math.max(2, Math.ceil(sr.grid * (0.35 + 0.1 * tier))), yrs: 1 + Math.floor(TE.rng() * 3), reg, until: G.day + 90 });
};
const AL_K = [['Développement', 'la voiture progresse plus vite'], ['Fiabilité et exploitation', 'moins d\'abandons, résultats plus réguliers'], ['Pilotes', 'plus de rythme en course'], ['Image et sponsors', 'plus de notoriété et de recettes de sponsoring']], AL_L = ['Minimal', 'Normal', 'Fort', 'Maximal'], AL_W = [0.4, 1, 1.7, 2.6];
const alN = a => (a || [1, 1, 1, 1]).map(x => clamp(+x || 0, 0, 3)), alSh = a => { const w = alN(a).map(l => AL_W[l]), s = TE.sum(w); return w.map(x => x / s); }, alF = a => alSh(a).map(x => x / 0.25);
// Entreprises dédiées au sport : elles n'existent que dans les paddocks. [nom, pays, rôle (m moteur · c voiture de course), niveau, championnats]
const FIRMS0 = [
  ['Cosmo Powertrain', 'GB', 'm', 80, ['f1', 'stock']], ['Veltro Motori', 'IT', 'm', 77, ['f1', 'stock']], ['Rheinwerk Antrieb', 'DE', 'm', 75, ['f1', 'stock']], ['Yamato Power', 'JP', 'm', 72, ['f1', 'fe', 'stock']],
  ['Thunderhead Engines', 'US', 'm', 70, ['stock', 'f1']], ['Voltaïc Drive', 'FR', 'm', 76, ['fe']], ['Ampère Systems', 'DE', 'm', 69, ['fe']], ['Nordkraft Racing', 'SE', 'm', 60, ['f1', 'stock']], ['Kestrel Dynamics', 'AU', 'm', 56, ['stock', 'fe']],
  ['Brightwell Customer Racing', 'GB', 'c', 74, ['gt', 'endu', 'tcr']], ['Kreuzberg Motorsport', 'DE', 'c', 76, ['gt', 'endu']], ['Sauvage Compétition', 'FR', 'c', 72, ['rally', 'raid', 'tcr']], ['Mesa Racing Cars', 'US', 'c', 66, ['gt', 'endu']],
  ['Fuji Rally Works', 'JP', 'c', 71, ['rally', 'tcr']], ['Atacama Raid Technik', 'CL', 'c', 64, ['raid', 'xe']], ['Duna Engineering', 'HU', 'c', 58, ['tcr', 'rally']], ['Okavango Offroad', 'ZA', 'c', 62, ['raid', 'xe']],
  ['Aurora Voltage', 'NO', 'c', 67, ['xe', 'endu']], ['Lombardi Corse', 'IT', 'c', 78, ['gt', 'endu']], ['Oranje Touring', 'NL', 'c', 59, ['tcr', 'gt']]
];
const mkFirms = () => FIRMS0.map((f, i) => ({ id: 'F' + (i + 1), n: f[0], home: f[1], role: f[2], lvl: f[3], ser: f[4] }));
const PN_A = ['Rossa', 'Hyperion', 'Gascogne', 'Kestrel', 'Borealis', 'Mistral', 'Raven', 'Dorata', 'Atlantic', 'Blaze', 'Titan', 'Hanami', 'Aurora', 'Ostrava', 'Phénix', 'Bastion', 'Velocità', 'Nordic', 'Cobalt', 'Rivage', 'Sirocco', 'Vulcan', 'Polare', 'Alizé', 'Iron Fox', 'Dune', 'Falcon', 'Lynx', 'Orion', 'Zéphyr', 'Granit', 'Marlin', 'Corvus', 'Équinoxe', 'Tramontane', 'Kodiak', 'Saphir', 'Ambre', 'Cèdre', 'Toundra', 'Mesa Verde', 'Fuji Blanc', 'Andes', 'Baltique', 'Helvète', 'Sahara', 'Pampa', 'Taïga', 'Lagune', 'Cascade'];
const PN_B = ['Scuderia {}', 'Team {}', 'Écurie {}', '{} Racing', '{} Motorsport', '{} GP', '{} Competición', '{} Corse', 'Équipe {}', '{} Performance', '{} Sport', 'Racing {}'];
const privName = used => { for (let i = 0; i < 60; i++) { const n = TE.pick(PN_B).replace('{}', TE.pick(PN_A)); if (!used.has(n)) { used.add(n); return n; } } return 'Écurie ' + (used.size + 1); };
const PRIVC = ['#8d6e63', '#546e7a', '#7b1fa2', '#00796b', '#c2185b', '#455a64', '#689f38', '#f57c00', '#5d4037', '#0277bd', '#9e9d24', '#6d4c41'];
const PHOME = ['IT', 'FR', 'DE', 'GB', 'ES', 'JP', 'US', 'SE', 'AU', 'BR', 'BE', 'NL', 'CH', 'AT', 'FI', 'PT'];
const engCyl = x => x.spec.sim ? simParse(x.spec.sim).c : x.spec.cyl || CDEF[(x.spec.size || 1) - 1];
const engOk = (p, sr) => sr.sup !== 'eng' ? [] : p.parts.filter(x => x.kind === 'eng' && !x.arch && sr.fuel.includes(x.spec.fuel) && x.st.kw >= (sr.kw || 0) && (x.spec.fuel === 'elec' || engCyl(x) >= (sr.cyl || 0)));
const carScore = m => m.st.perf * 0.45 + m.st.handling * 0.35 + m.st.rel * 0.2;
const carOk = (p, sr) => sr.sup !== 'car' ? [] : p.models.filter(m => m.state === 'sale' && m.st && sr.segs.includes(body(m).seg) && sr.fuel.includes(m.fuel));
const firmsFor = (S, k) => S.firms.filter(f => f.ser.includes(k) && f.role === (SERIES[k].sup === 'eng' ? 'm' : 'c'));
const firmFee = (sr, f) => Math.round(sr.ref * (f.role === 'm' ? 0.14 : 0.22) * Math.pow(f.lvl / 60, 2) / 1e5) * 1e5;
function SP(G) {
  const g = G.game; if (!g.sport) g.sport = { teams: [], hist: [], lr: {}, tid: 1, titles: {} }; const S = g.sport;
  if (!S.firms) S.firms = mkFirms();
  if (!S.v2) { S.v2 = 1; for (const k of SK) fillGrid(G, S, k); }
  if (!S.res) { S.res = []; S.off = {}; S.oid = 1; S.tot = { inc: 0, exp: 0, w: 0, pod: 0, rn: 0, ti: 0 }; }
  for (const t of S.teams) if (t.sp == null) tdef(t);
  return S;
}
function fillGrid(G, S, k) {
  const sr = SERIES[k], used = new Set(S.teams.map(t => t.name)), fm = firmsFor(S, k);
  for (let i = S.teams.filter(t => t.s === k).length; i < sr.grid; i++) {
    const r = 0.35 + TE.rng() * 0.8, f = fm.length ? TE.pick(fm) : null;
    S.teams.push({ id: S.tid++, s: k, o: null, name: privName(used), home: TE.pick(PHOME), color: TE.pick(PRIVC), bid: 0, bud: Math.round(sr.ref * r / 1e5) * 1e5, tech: clamp(30 + r * 25 + (TE.rng() - 0.5) * 10, 5, 100), al: [1, 1, 1, 1].map(x => clamp(x + Math.round((TE.rng() - 0.5) * 2), 0, 3)), sup: f ? 'firm' : '', fid: f ? f.id : '', pts: 0, w: 0, pod: 0, rn: 0, ti: 0, fame: 0, last: 0, since: G.day });
  }
}
const teamOf = (S, p, k) => S.teams.find(t => t.s === k && t.o === p.id);
const sportRank = (S, k) => S.teams.filter(t => t.s === k).sort((a, b) => b.pts - a.pts || b.w - a.w || b.fame - a.fame);
function supPw(G, t) {   // apport de la fourniture (moteur, voiture ou fournisseur) à la performance
  const sr = SERIES[t.s], S = G.game.sport, a = t.o != null ? actorById(G, t.o) : null;
  if (sr.sup === 'none' || !t.sup) return 0;
  if (t.sup === 'firm') { const f = S && S.firms.find(x => x.id === t.fid); return f ? (f.lvl - 55) * 0.35 : -6; }
  if (!a) return 0;
  if (sr.sup === 'eng') { const x = partOf(a, t.pid); if (!x || !x.st) return -10; return clamp(22 * Math.log2(Math.max(0.3, x.st.kw / sr.ekw)), -18, 18) + (x.st.rel - 65) * 0.2 + (x.spec.lvl - 4) * 1.2; }
  const m = modelOf(a, t.mid); if (!m || !m.st) return -10; return clamp((carScore(m) - sr.ep) * 0.6, -22, 24);
}
const basePerf = (G, t) => { const sr = SERIES[t.s]; return t.tech + 15 * Math.log2(Math.max(0.2, t.bud / sr.ref)) + supPw(G, t) + 7 * Math.log2(alF(t.al)[2]) + PL[t.pl == null ? 1 : t.pl][2] + STR[t.st || 'eq'].pace; };
const teamPerf = (G, t, vm) => basePerf(G, t) + (TE.rng() + TE.rng() + TE.rng() - 1.5) * 20 * clamp(1.3 - 0.3 * alF(t.al)[1], 0.6, 1.4) * (vm || 1);
function supBest(G, S, a, k) {   // fourniture choisie par une rivale : sa meilleure pièce ou voiture, sinon un fournisseur
  const sr = SERIES[k]; if (sr.sup === 'none') return { sup: '' };
  if (sr.sup === 'eng') { const e = engOk(a, sr).sort((x, y) => y.st.kw - x.st.kw)[0]; if (e) return { sup: 'own', pid: e.id }; }
  else { const m = carOk(a, sr).sort((x, y) => carScore(y) - carScore(x))[0]; if (m) return { sup: 'own', mid: m.id }; }
  const fm = firmsFor(S, k).sort((x, y) => y.lvl - x.lvl); return fm.length ? { sup: 'firm', fid: TE.pick(fm.slice(0, 4)).id } : { sup: '' };
}
function raceRun(G, S, k, R) {
  const sr = SERIES[k], mult = (k === 'endu' ? 2 : 1) * (R.w >= 2 ? 1.5 : 1), ts = S.teams.filter(t => t.s === k), y = spYear(G), me = TE.player(); if (ts.length < 2) return;
  const res = ts.map(t => { const sm = STR[t.st || 'eq'], dnf = TE.rng() < clamp(0.16 - 0.03 * (alF(t.al)[1] - 1), 0.04, 0.3) * sm.dnf; return { t, dnf, v: dnf ? -999 + TE.rng() : teamPerf(G, t, sm.vr) + (t.home === R.c ? 3 : 0) }; }).sort((x, z) => z.v - x.v), nF = res.filter(r => !r.dnf).length;
  res.forEach((r, i) => {
    const t = r.t, a = t.o != null ? actorById(G, t.o) : null, q = r.dnf ? 0 : [1, 0.65, 0.5, 0.3, 0.25, 0.2, 0.15, 0.12, 0.1, 0.08][i] || 0.03; t.rn++; t.form.push(r.dnf ? 0 : i + 1); if (t.form.length > 6) t.form.shift();
    if (r.dnf) { t.dnf++; t.last = res.length; } else { t.last = i + 1; t.sum += i + 1; t.best = t.best ? Math.min(t.best, i + 1) : i + 1; if (i < SPTS.length) t.pts += Math.round(SPTS[i] * mult); if (i === 0) t.w++; if (i < 3) t.pod++; }
    t.fame = clamp(t.fame + (i === 0 ? 7 : i === 1 ? 4.5 : i === 2 ? 3 : i < 6 ? 1 : 0) * (r.dnf ? 0 : 1) * (0.6 + 0.4 * mult) * Math.pow(alF(t.al)[3], 0.5) * PL[t.pl == null ? 1 : t.pl][4], 0, 100);
    if (a) {
      let gain = !r.dnf && i < SPURSE.length ? sr.ref * 2 / CAL[k].length * SPURSE[i] * R.w : 0;
      for (const c of t.sp) { const sp0 = c.bonus * (i === 0 ? 1 : i < 3 && !r.dnf ? 0.4 : 0); gain += sp0; }
      TE.earn(a, 'sport', gain); t.inc += gain;
      if (a === me) { S.tot.inc += gain; S.tot.rn++; if (i === 0 && !r.dnf) S.tot.w++; if (i < 3 && !r.dnf) S.tot.pod++; }
      const b = brOfId(a, t.bid), X = spX(b), bz = q * R.w * sr.prest * 6 * PL[t.pl == null ? 1 : t.pl][4] + 0.15 * sr.prest, rg = cReg(R.c), foc = t.reg || 'world';
      X.c[R.c] = Math.min(40, (X.c[R.c] || 0) + bz * 3); X.r[rg] = Math.min(30, (X.r[rg] || 0) + bz * 1.4 * (foc === rg ? 1.6 : 1)); X.w = Math.min(20, X.w + bz * 0.35 * (foc === 'world' ? 1.3 : 0.8));
    }
  });
  S.lr[k] = { mi: R.m, pod: res.slice(0, 3).map(r => r.t.id) };
  const mine = res.map((r, i) => ({ r, i })).filter(x => x.r.t.o === me.id).map(x => ({ id: x.r.t.id, n: x.r.t.name, pos: x.r.dnf ? 0 : x.i + 1 }));
  S.res.unshift({ y, k, ri: R.i, n: R.n, c: R.c, w: R.w, top: res.slice(0, 3).filter(r => !r.dnf).map(r => ({ id: r.t.id, n: r.t.name, o: r.t.o })), nF, mine }); if (S.res.length > 320) S.res.length = 320;
  for (const m of mine) if (m.pos && m.pos <= 3) TE.news((m.pos === 1 ? '🏆 Victoire' : m.pos === 2 ? '🥈 Deuxième place' : '🥉 Podium') + ' — ' + R.n + ' (' + sr.n + ') pour ' + m.n + '.', m.pos === 1 ? 'good' : 'info');
}
function sportSeasonEnd(G, S) {
  const y = spYear(G), me = TE.player();
  for (const f of S.firms) f.lvl = clamp(f.lvl + (TE.rng() - 0.46) * 4, 40, 92);
  for (const k of SK) {
    const R = sportRank(S, k); if (!R.length || !R[0].rn) continue; const c = R[0]; c.ti++; c.fame = clamp(c.fame + 15 * SERIES[k].prest, 0, 100);
    S.titles[c.name] = (S.titles[c.name] || 0) + 1; S.hist.unshift({ y, s: k, name: c.name, o: c.o, pts: c.pts, top: R.slice(0, 5).map(t => ({ n: t.name, p: t.pts, w: t.w, o: t.o })) }); if (S.hist.length > 160) S.hist.pop();
    const a = c.o != null ? actorById(G, c.o) : null; if (a && a.player) { TE.news('🏆 Champion en ' + SERIES[k].n + ' ' + y + ' : ' + c.name + ' (' + c.pts + ' pts).', 'good'); S.tot.ti++; } else if (S.teams.some(t => t.s === k && t.o === me.id)) TE.news(c.name + ' remporte le championnat ' + SERIES[k].n + ' ' + y + '.', 'info');
    R.forEach((t, i) => {
      t.hs.unshift({ y, rk: i + 1, pts: t.pts, w: t.w - (t.w0 || 0), pod: t.pod, inc: t.inc, exp: t.exp, n: t.rn }); if (t.hs.length > 12) t.hs.pop();
      if (t.o === me.id) for (const ct of t.sp.slice()) { if (i + 1 > ct.goal) { t.sp = t.sp.filter(x => x !== ct); t.fame = Math.max(0, t.fame - 3); TE.news(SPONS[ct.sp][0] + ' rompt son contrat avec ' + t.name + ' : objectif manqué (top ' + ct.goal + ').', 'bad'); } else if (--ct.yrs <= 0) { t.sp = t.sp.filter(x => x !== ct); TE.news('Le contrat de ' + SPONS[ct.sp][0] + ' arrive à son terme.', 'info'); } }
      t.pts = 0; t.w0 = t.w; t.inc = 0; t.exp = 0; t.form = [];
    });
    S.teams = S.teams.filter(t => t.s !== k || t.o != null || !(t.last > SERIES[k].grid * 0.75 && t.rn > 8 && TE.rng() < 0.25));   // des écuries indépendantes disparaissent, d'autres naissent
  }
  S.off = {};
}
function sportAI(G, S) {
  for (const a of TE.rivals()) {
    const P = PROFILES[a.profile] || PROFILES.generaliste;
    for (const t of S.teams.filter(x => x.o === a.id)) {     // arrêter si la caisse se vide ; ajuster le budget ; réévaluer la fourniture
      if (a.cash < P.reserve * 0.5 || (t.last > SERIES[t.s].cap * 0.7 && t.rn > 15 && TE.rng() < 0.3)) { S.teams = S.teams.filter(x => x !== t); TE.news(a.name + ' se retire de ' + SERIES[t.s].n + '.', 'info'); continue; }
      t.bud = Math.round(SERIES[t.s].ref * clamp(a.cash / (10 * SERIES[t.s].ref), 0.45, 1.7) / 1e5) * 1e5; Object.assign(t, { pid: 0, mid: 0, fid: '' }, supBest(G, S, a, t.s));
    }
    const mine = S.teams.filter(x => x.o === a.id).length; if (mine >= 3 || TE.rng() > 0.4) continue;
    const opts = SK.filter(k => SERIES[k].aff.includes(a.profile) && !teamOf(S, a, k) && S.teams.filter(t => t.s === k).length < SERIES[k].cap && a.cash > 3 * SERIES[k].entry + P.reserve * 1.4);
    if (!opts.length) continue; const k = TE.pick(opts), sr = SERIES[k];
    TE.spend(a, 'sport', sr.entry); S.teams.push(Object.assign({ id: S.tid++, s: k, o: a.id, name: a.name + (k === 'f1' ? ' F1' : ' Racing'), home: a.home || 'FR', color: a.color, bid: 0, bud: Math.round(sr.ref * clamp(a.cash / (10 * sr.ref), 0.45, 1.5) / 1e5) * 1e5, tech: 35, al: [1, 1, 1, 1], pts: 0, w: 0, pod: 0, rn: 0, ti: 0, fame: 0, last: 0, since: G.day, pl: P.pos >= 1.3 ? 2 : P.pos < 1 ? 0 : 1, st: a.profile === 'sport' || P.pos >= 1.35 ? 'agr' : 'eq', reg: 'world' }, supBest(G, S, a, k)));
    if (TE.rng() < 0.5) TE.news(a.name + ' engage une écurie en ' + sr.n + '.', 'info');
  }
}
const teamCost = (S, t) => { const sr = SERIES[t.s], f = t.sup === 'firm' ? S.firms.find(x => x.id === t.fid) : null; return t.bud + plCost(t) + (f ? firmFee(sr, f) : 0); };
function sportMonth(G, mi) {
  const S = SP(G), me = TE.player();
  S.teams = S.teams.filter(t => { if (t.o == null) return true; const a = actorById(G, t.o); return a && !a.bankrupt; });
  for (const b of G.actors.reduce((r, x) => r.concat(brandsOf(x)), [])) { b.halo = 0; spDecay(b); }
  for (const t of S.teams) {
    const sr = SERIES[t.s], a = t.o != null ? actorById(G, t.o) : null, ratio = t.bud / sr.ref, f = alF(t.al);
    t.tech = clamp(t.tech + 2.6 * Math.pow(Math.max(0, ratio), 0.8) * Math.pow(f[0], 0.8) - 0.05 * t.tech, 0, 100); t.fame *= 0.985;
    if (a) {
      const cost = teamCost(S, t) / 12, base = t.bud / 12 * 0.12 * Math.min(1, t.fame / 50) * Math.pow(f[3], 0.8);
      let spi = 0; for (const c of t.sp) spi += c.fee / 12 * (c.reg === 'world' || c.reg === t.reg ? 1 : 0.85);
      TE.spend(a, 'sport', cost); TE.earn(a, 'sport', base + spi); t.exp += cost; t.inc += base + spi; if (a === me) { S.tot.exp += cost; S.tot.inc += base + spi; }
      const b = brOfId(a, t.bid); b.halo = Math.min(22, (b.halo || 0) + t.fame * sr.prest * 0.14 * (t.sup === 'own' && sr.sup === 'car' ? 1.2 : 1));
      if (a === me) { const o = (S.off[t.id] || (S.off[t.id] = [])); S.off[t.id] = o.filter(x => x.until > G.day); if (S.off[t.id].length < 3 && t.sp.length < spSlots(t) + 1 && TE.rng() < (S.off[t.id].length ? 0.4 : 0.85)) spOffer(G, S, t); }
    }
  }
  for (const k of SK) for (const R of CAL[k]) if (R.m === mi) raceRun(G, S, k, R);
  if (mi === 11) { sportSeasonEnd(G, S); sportAI(G, S); for (const k of SK) fillGrid(G, S, k); }
  else if (mi === 0 && G.day < 400) sportAI(G, S);
}
const reqTxt = sr => sr.sup === 'none' ? 'Aucune : châssis et moteur fournis par le promoteur' : sr.sup === 'eng' ? 'Un moteur ' + sr.fuel.map(f => FUELS[f].n.toLowerCase()).join(' ou ') + ' d\'au moins ' + sr.kw + ' kW' + (sr.cyl ? ' et ' + sr.cyl + ' cylindres' : '') + ' — ou un moteur client' : 'Une voiture de série de ta gamme (' + sr.segs.map(s => SEG[s].toLowerCase()).join(', ') + ') — ou une voiture clé en main';
const reqShort = sr => sr.sup === 'none' ? 'Budget seul' : sr.sup === 'eng' ? 'Moteur requis' : 'Voiture de série';
/* ---- Assistant d'engagement / de gestion d'une écurie ---- */
function teamStart(G, p, k, t) {
  const S = SP(G), sr = SERIES[k], M = { s: k, tid: t ? t.id : 0, pstep: 0, bid: t ? t.bid : (selB(p).bid || 0), bud: t ? t.bud : Math.round(sr.ref / 1e5) * 1e5, sup: 'own', ref: 0, fid: '', st: t ? t.st || 'eq' : 'eq', pl: String(t && t.pl != null ? t.pl : 1), reg: t ? t.reg || 'world' : 'world' };
  const al = alN(t && t.al); al.forEach((v, i) => { M['a' + i] = String(v); });
  const own = sr.sup === 'eng' ? engOk(p, sr).sort((x, y) => y.st.kw - x.st.kw) : sr.sup === 'car' ? carOk(p, sr).sort((x, y) => carScore(y) - carScore(x)) : [];
  if (t && t.sup === 'firm') { M.sup = 'firm'; M.fid = t.fid; } else if (t && (t.pid || t.mid)) { M.ref = t.pid || t.mid; } else if (own.length) { M.ref = own[0].id; } else { M.sup = 'firm'; }
  if (!M.fid) { const fm = firmsFor(S, k).sort((x, y) => y.lvl - x.lvl); M.fid = fm.length ? fm[Math.min(1, fm.length - 1)].id : ''; }
  if (sr.sup === 'none') M.sup = '';
  return M;
}
const teamOfM = (G, p, M) => { const sr = SERIES[M.s], old = M.tid ? SP(G).teams.find(x => x.id === M.tid) : null, al = [0, 1, 2, 3].map(i => +M['a' + i]);
  return { id: M.tid || -1, s: M.s, o: p.id, bud: Math.max(sr.ref * 0.25, +M.bud), tech: old ? old.tech : 30, al, sup: sr.sup === 'none' ? '' : M.sup, pid: sr.sup === 'eng' && M.sup === 'own' ? +M.ref : 0, mid: sr.sup === 'car' && M.sup === 'own' ? +M.ref : 0, fid: M.sup === 'firm' ? M.fid : '', st: M.st || 'eq', pl: +M.pl, reg: M.reg || 'world', home: old ? old.home : p.home, fame: old ? old.fame : 0 }; };
function modalTeam(M, G, p) {
  const S = SP(G), sr = SERIES[M.s], mine = M.tid ? S.teams.find(x => x.id === M.tid && x.o === p.id) : null; if (M.tid && !mine) return '<h2>Écurie introuvable</h2>';
  const steps = (sr.sup === 'none' ? [] : ['base']).concat(['budget', 'regl', 'recap']), st = clamp(+M.pstep || 0, 0, steps.length - 1), key = steps[st], N = steps.length;
  const own = sr.sup === 'eng' ? engOk(p, sr).sort((x, y) => y.st.kw - x.st.kw) : sr.sup === 'car' ? carOk(p, sr).sort((x, y) => carScore(y) - carScore(x)) : [], fm = firmsFor(S, M.s).sort((x, y) => y.lvl - x.lvl);
  if (sr.sup !== 'none') { if (M.sup === 'own' && !own.length) M.sup = 'firm'; if (M.sup === 'own' && !own.some(x => x.id == M.ref)) M.ref = own[0].id; if (M.sup === 'firm' && !fm.some(f => f.id === M.fid)) M.fid = fm.length ? fm[0].id : ''; }
  M.bud = clamp(Math.round(+M.bud / 1e5) * 1e5, Math.round(sr.ref * 0.25 / 1e5) * 1e5, sr.ref * 3);
  const T = teamOfM(G, p, M), perf = basePerf(G, T), others = S.teams.filter(x => x.s === M.s && x.id !== T.id).map(x => basePerf(G, x)), rank = 1 + others.filter(v => v > perf).length, tot = others.length + 1;
  const fee = T.sup === 'firm' ? firmFee(sr, S.firms.find(f => f.id === T.fid) || { role: sr.sup === 'eng' ? 'm' : 'c', lvl: 55 }) : 0, entry = mine ? 0 : sr.entry, yearly = T.bud + fee + plCost(T);
  const dots = '<div class="dots">' + steps.map((x, i) => '<i class="' + (i < st ? 'done' : i === st ? 'cur' : '') + '"></i>').join('') + '</div>';
  const TTL = { base: 'Fourniture', budget: 'Budget et répartition', regl: 'Réglages de course', recap: 'Récapitulatif' }, head = '<div class="whead">' + (st ? '<button class="btn small ghost" data-act="pstep" data-v="' + (st - 1) + '">‹ Retour</button>' : '<span></span>') + '<small>Étape ' + (st + 1) + ' / ' + N + ' · ' + TTL[key] + '</small></div>' + dots;
  const title = '<h2>' + esc(sr.n) + '</h2><p class="muted" style="margin:0 0 4px;font-size:13px">' + (mine ? 'Gérer l\'écurie' : 'Engager une écurie') + '</p>', nxt = H.btn('Continuer', 'pstep', { v: st + 1 }, { cls: 'primary' });
  const sc = { eng: x => '<b>' + esc(x.name) + '</b><small class="muted">' + nf(x.st.kw) + ' kW · ' + Math.round(x.st.kw * 1.36) + ' ch · fiabilité ' + Math.round(x.st.rel) + '</small>', car: m => '<b>' + esc(m.name) + '</b><small class="muted">' + SEG[body(m).seg] + ' · perf. ' + Math.round(m.st.perf) + ' · tenue ' + Math.round(m.st.handling) + ' · fiab. ' + Math.round(m.st.rel) + '</small>' };
  const fcard = f => { const n = S.teams.filter(t => t.fid === f.id).length; return '<button class="pcard' + (M.sup === 'firm' && M.fid === f.id ? ' on' : '') + '" data-act="sfirm" data-v="' + f.id + '"><b>' + esc(f.n) + ' <span class="pill">' + f.home + '</span></b><small class="muted">Niveau ' + Math.round(f.lvl) + ' / 100 · ' + (n ? n + ' client' + (n > 1 ? 's' : '') : 'aucun client') + ' · ' + money(firmFee(sr, f)) + ' par an</small></button>'; };
  if (key === 'base') {
    const modes = H.chips('mset', 'sup', M.sup, [['own', 'Ma propre ' + (sr.sup === 'eng' ? 'motorisation' : 'voiture') + (own.length ? ' (' + own.length + ')' : ' (aucune)')], ['firm', 'Fournisseur du paddock (' + fm.length + ')']]);
    const lst = M.sup === 'own' ? (own.length ? '<div class="pcards">' + own.map(x => '<button class="pcard' + (x.id == M.ref ? ' on' : '') + '" data-act="mset" data-k="ref" data-v="' + x.id + '">' + sc[sr.sup](x) + '</button>').join('') + '</div><p class="muted fnote">' + (sr.sup === 'eng' ? 'Ton moteur fait la performance et porte ton image : plus il est puissant et fiable, mieux c\'est.' : 'La voiture de série devient la base de la voiture de course : sa tenue, ses performances et sa fiabilité comptent, et la victoire rejaillit sur le modèle.') + '</p>' : '<p class="neg fnote">Tu n\'as aucune ' + (sr.sup === 'eng' ? 'motorisation compatible. Exigence : ' : 'voiture compatible en vente. Exigence : ') + esc(reqTxt(sr)) + '. Crée-en une dans l\'Atelier, ou prends un fournisseur.</p>')
      : '<div class="pcards">' + fm.map(fcard).join('') + '</div><p class="muted fnote">Un fournisseur livre une ' + (sr.sup === 'eng' ? 'motorisation' : 'voiture clé en main') + ' contre une redevance annuelle. Fiable et sans développement, mais pas exclusif : tes rivaux peuvent la prendre aussi.</p>';
    return title + head + '<p class="muted fnote" style="margin:4px 0 2px">' + esc(reqTxt(sr)) + '.</p><div class="f"><span>Origine</span>' + modes + '</div>' + lst + nxt;
  }
  const al = [0, 1, 2, 3].map(i => +M['a' + i]), sh = alSh(al);
  const bPre = [0.4, 0.7, 1, 1.5, 2, 3].map(x => [String(Math.round(sr.ref * x / 1e5) * 1e5), money(Math.round(sr.ref * x / 1e5) * 1e5)]);
  const meter = '<div class="row"><span class="grow">Performance estimée</span><b>' + Math.round(perf) + '</b></div>' + H.bar(clamp(perf, 0, 130), 130, perf >= 70 ? 'good' : '') + '<div class="row"><span class="grow">Place visée</span><b>' + rank + ' / ' + tot + '</b></div>';
  const live = H.card('Prévision', meter + H.kv([['Coût annuel', money(yearly) + (fee ? ' (dont fourniture ' + money(fee) + ')' : '')], ['Par mois', money(yearly / 12)]].concat(entry ? [['Droit d\'entrée', money(entry)]] : [])));
  if (key === 'budget') {
    const alRows = AL_K.map((k, i) => '<div class="f"><span>' + k[0] + ' · ' + money(Math.round(T.bud * sh[i] / 1e5) * 1e5) + '</span>' + H.seg('mset', 'a' + i, al[i], AL_L) + '<small class="muted">' + k[1] + '</small></div>').join('');
    return title + head + '<div class="f"><span>Budget annuel</span></div><div class="row sbrow"><button class="btn small sq" data-act="sbm" data-v="-0.1" aria-label="Moins">−</button><b class="sbamt">' + money(T.bud) + '</b><button class="btn small sq" data-act="sbm" data-v="0.1" aria-label="Plus">+</button></div>' + H.chips('mset', 'bud', String(T.bud), bPre) +
      '<p class="muted fnote">Référence du championnat : ' + money(sr.ref) + ' par an. Plus on dépense, plus la voiture progresse vite, mais le retour dépend des résultats.</p><h3 style="margin:10px 0 2px">Répartition du budget</h3>' + alRows + live + nxt;
  }
  if (key === 'regl') {
    const sk = Object.keys(STR), reg = [['world', 'Monde entier']].concat(REGK.map(r => [r, REGL[r][0]]));
    return title + head + '<div class="f"><span>Stratégie de course</span>' + H.chips('mset', 'st', M.st || 'eq', sk.map(x => [x, STR[x].n])) + '<small class="muted">' + STR[M.st || 'eq'].tx + '.</small></div>' +
      '<div class="f"><span>Pilotes · ' + money(plCost(T)) + ' par an</span>' + H.chips('mset', 'pl', String(M.pl), PL.map((x, i) => [String(i), x[0]])) + '<small class="muted">' + PL[+M.pl][1] + '.</small></div>' +
      '<div class="f"><span>Zone d\'image visée</span>' + H.chips('mset', 'reg', M.reg || 'world', reg) + '<small class="muted">' + (M.reg && M.reg !== 'world' ? 'Ta communication se concentre sur cette région : l\'impact y est renforcé, ailleurs il est réduit. Les sponsors de la zone paient mieux.' : 'Communication mondiale : l\'impact est réparti partout, plus modeste localement.') + '</small></div>' + live + nxt;
  }
  const brandsel = brandsOf(p).length > 1 ? '<div class="f"><span>Marque représentée</span>' + H.chips('mset', 'bid', String(M.bid || 0), brandsOf(p).map(b => [String(b.bid || 0), esc(b.name)])) + '</div>' : '';
  const supTxt = sr.sup === 'none' ? 'Fournie par le promoteur' : T.sup === 'firm' ? esc((S.firms.find(f => f.id === T.fid) || { n: '?' }).n) + ' (fournisseur)' : sr.sup === 'eng' ? esc((partOf(p, T.pid) || { name: '?' }).name) : esc((modelOf(p, T.mid) || { name: '?' }).name);
  const go = mine ? H.btn('Appliquer les changements', 'steamgo', {}, { cls: 'primary' }) : H.btn('Engager l\'écurie · ' + money(entry), 'steamgo', {}, { cls: 'primary', off: p.cash < entry, why: 'Trésorerie insuffisante.' });
  return title + head + brandsel + H.card('Ton engagement', H.kv([['Championnat', esc(sr.n)], ['Fourniture', supTxt], ['Budget annuel', money(T.bud)], ['Stratégie', STR[T.st].n], ['Pilotes', PL[T.pl][0]], ['Zone d\'image', T.reg === 'world' ? 'Monde' : REGL[T.reg][0]]].concat(AL_K.map((k, i) => [k[0], AL_L[al[i]] + ' · ' + Math.round(sh[i] * 100) + ' %'])))) + live + go;
}
const spActs = {
  steam(d, c) { const S = SP(c.G), t = d.t ? S.teams.find(x => x.id == d.t && x.o === c.p.id) : null, k = t ? t.s : (SERIES[d.s] ? d.s : (SERIES[c.UI.sps] ? c.UI.sps : 'f1')); c.openModal('team', teamStart(c.G, c.p, k, t)); return false; },
  sbm(d, c) { const M = c.UI.modal, sr = SERIES[M.s]; M.bud = clamp(Math.round((+M.bud + sr.ref * +d.v) / 1e5) * 1e5, Math.round(sr.ref * 0.25 / 1e5) * 1e5, sr.ref * 3); c.reAll(); return false; },
  sfirm(d, c) { c.UI.modal.sup = 'firm'; c.UI.modal.fid = d.v; c.reAll(); return false; },
  steamgo(d, c) {
    const M = c.UI.modal, S = SP(c.G), sr = SERIES[M.s], T = teamOfM(c.G, c.p, M), old = M.tid ? S.teams.find(x => x.id === M.tid && x.o === c.p.id) : null;
    if (!old && (teamOf(S, c.p, M.s) || c.p.cash < sr.entry)) return c.toast(teamOf(S, c.p, M.s) ? 'Déjà engagé dans ce championnat.' : 'Trésorerie insuffisante (' + money(sr.entry) + ').');
    if (sr.sup === 'eng' && T.sup === 'own' && !engOk(c.p, sr).some(x => x.id === T.pid)) return c.toast('Choisis un moteur compatible.');
    if (sr.sup === 'car' && T.sup === 'own' && !carOk(c.p, sr).some(x => x.id === T.mid)) return c.toast('Choisis une voiture compatible.');
    if (sr.sup !== 'none' && T.sup === 'firm' && !S.firms.some(f => f.id === T.fid)) return c.toast('Choisis un fournisseur.');
    if (old) { Object.assign(old, { bud: T.bud, al: T.al, sup: T.sup, pid: T.pid, mid: T.mid, fid: T.fid, bid: +M.bid || 0, st: T.st, pl: T.pl, reg: T.reg }); c.toast('Écurie mise à jour.'); }
    else { const b = brandsOf(c.p).find(x => String(x.bid || 0) === String(M.bid || 0)) || selB(c.p); TE.spend(c.p, 'sport', sr.entry); S.teams.push(tdef({ id: S.tid++, s: M.s, o: c.p.id, name: b.name + (M.s === 'f1' ? ' F1' : ' Racing'), home: c.p.home || 'FR', color: c.p.color, bid: b.bid || 0, bud: T.bud, tech: 30, al: T.al, sup: T.sup, pid: T.pid, mid: T.mid, fid: T.fid, pts: 0, w: 0, pod: 0, rn: 0, ti: 0, fame: 0, last: 0, since: c.G.day })); const nt = S.teams[S.teams.length - 1]; Object.assign(nt, { st: T.st, pl: T.pl, reg: T.reg }); c.UI.sps = M.s; c.toast('Écurie engagée en ' + sr.n + '.'); }
    c.closeModal(); return false;
  },
  srd(d, c) { const S = SP(c.G), t = S.teams.find(x => x.id == d.t && x.o === c.p.id); if (!t) return; const cost = SERIES[t.s].ref * 0.15; if (c.p.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'); TE.spend(c.p, 'sport', cost); t.tech = clamp(t.tech + 7, 0, 100); c.toast('Développement terminé : niveau technique ' + Math.round(t.tech) + '.'); },
  sptab(d, c) { if (d.s) { c.UI.sps = d.s; c.UI.csr = d.s; } if (d.t) c.UI.spt = String(d.t); c.UI.tab = d.v; },
  sspon(d, c) { const S = SP(c.G), t = S.teams.find(x => x.id == d.t && x.o === c.p.id), offs = t ? S.off[t.id] || [] : [], o = offs.find(x => x.id == d.o); if (!t || !o) return c.toast('Offre expirée.'); if (t.sp.length >= spSlots(t)) return c.toast('Plus d\'emplacement : monte en notoriété.'), false; t.sp.push({ sp: o.sp, fee: o.fee, bonus: o.bonus, goal: o.goal, yrs: o.yrs, reg: o.reg }); S.off[t.id] = offs.filter(x => x !== o); c.toast(SPONS[o.sp][0] + ' signe avec ' + t.name + '.'); },
  sdrop(d, c) { const S = SP(c.G), t = S.teams.find(x => x.id == d.t && x.o === c.p.id), ct = t && t.sp.find(x => x.sp == d.sp); if (!ct) return false; TE.spend(c.p, 'sport', ct.fee * 0.25); t.sp = t.sp.filter(x => x !== ct); t.fame = Math.max(0, t.fame - 2); c.toast('Contrat rompu : indemnité ' + money(ct.fee * 0.25) + '.'); },
  squit(d, c) { const S = SP(c.G); const t = S.teams.find(x => x.id == d.t && x.o === c.p.id); if (!t) return; S.teams = S.teams.filter(x => x !== t); c.toast('Écurie retirée de ' + SERIES[t.s].n + '.'); }
};
const supName = (G, S, t) => { const sr = SERIES[t.s], a = t.o != null ? actorById(G, t.o) : null; if (sr.sup === 'none') return 'Promoteur'; if (t.sup === 'firm') { const f = S.firms.find(x => x.id === t.fid); return f ? f.n : '—'; } if (!a) return '—'; const it = sr.sup === 'eng' ? partOf(a, t.pid) : modelOf(a, t.mid); return it ? it.name : '—'; };
function panelChamps(G, p) {
  const S = SP(G), mine = S.teams.filter(t => t.o === p.id), mo = TE.cal().months, UI = TE.UI;
  const k = SERIES[UI.sps] ? UI.sps : (mine[0] ? mine[0].s : 'f1'), sr = SERIES[k], R = sportRank(S, k), me = teamOf(S, p, k), B = brandsOf(p);
  const halo = Math.round(10 * Math.max.apply(null, B.map(b => b.halo || 0).concat([0]))) / 10, cur = (G.day / 30 - 1 + 120) % 12, nexts = sr.rounds.filter(r => r > cur).concat(sr.rounds)[0];
  const lr = S.lr[k], tn = id => { const t = S.teams.find(x => x.id === id); return t ? esc(t.name) : '?'; };
  const hs = (l, v) => '<span class="hst"><small>' + l + '</small><b>' + v + '</b></span>';
  const tile = x => { const s = SERIES[x], t = teamOf(S, p, x), r = t && t.rn ? sportRank(S, x).indexOf(t) + 1 : 0; return '<button class="ptile stile' + (k === x ? ' on' : '') + '" data-act="set" data-k="sps" data-v="' + x + '" aria-pressed="' + (k === x) + '"><span class="kimg sic">' + (TE.art('sp-' + x) ? H.img('sp-' + x) : s.ic) + '</span><span class="ptx"><b>' + esc(s.n) + (t ? ' <span class="pill good">engagé</span>' : '') + '</b><small>' + esc(s.sub) + '</small><span class="pmeta"><i>' + reqShort(s) + '</i><i>' + money(s.ref) + '</i>' + (r ? '<i>' + r + 'e</i>' : '') + '</span></span><span class="ptick"></span></button>'; };
  const cats = Object.keys(SCAT).map(c => '<section class="cat"><h3>' + SCAT[c][0] + ' <small class="muted">' + SCAT[c][1] + '</small></h3><div class="ptiles">' + SK.filter(x => SERIES[x].cat === c).map(tile).join('') + '</div></section>').join('');
  const okAny = sr.sup === 'none' || (sr.sup === 'eng' ? engOk(p, sr).length : carOk(p, sr).length);
  const my = me ? H.card('Mon écurie · ' + esc(me.name), '<div class="isoimg">' + H.img('iso-d8') + '</div><div class="row"><span class="grow">Position</span><b>' + (me.rn ? (R.indexOf(me) + 1) + ' / ' + R.length : 'Pas encore de course') + '</b></div><div class="row"><span class="grow">Points · victoires · podiums</span><b>' + me.pts + ' · ' + me.w + ' · ' + me.pod + '</b></div><div class="row"><span class="grow">Fourniture</span><b>' + esc(supName(G, S, me)) + '</b></div><div class="row"><span class="grow">Niveau technique</span><b>' + Math.round(me.tech) + ' / 100</b></div><div class="row"><span class="grow">Notoriété sportive</span><b>' + Math.round(me.fame) + ' / 100</b></div><div class="row"><span class="grow">Marque représentée</span><b>' + esc(brOfId(p, me.bid).name) + '</b></div>' +
    '<p class="muted" style="font-size:12px">Coût annuel : ' + money(teamCost(S, me)) + ' (' + money(teamCost(S, me) / 12) + ' par mois). Répartition : ' + alN(me.al).map((v, i) => AL_K[i][0].split(' ')[0].toLowerCase() + ' ' + AL_L[v].toLowerCase()).join(' · ') + '.</p>' +
    '<div class="row" style="margin-top:8px">' + H.btn('Gérer budget et fourniture', 'steam', { t: me.id }, { cls: 'primary small' }) + H.btn('Développement ' + money(sr.ref * 0.15) + ' (+7)', 'srd', { t: me.id }, { cls: 'small', off: p.cash < sr.ref * 0.15 || me.tech >= 100, why: 'Trésorerie insuffisante ou niveau maximal.' }) + H.btn('Quitter', 'squit', { t: me.id }, { cls: 'small' }) + '</div>')
    : H.card('Engager une écurie', '<p class="muted" style="font-size:13px">' + esc(sr.txt) + '</p><div class="row"><span class="grow">Exigence</span><b style="text-align:right">' + esc(reqTxt(sr)) + '</b></div><div class="row"><span class="grow">Droit d\'entrée</span><b>' + money(sr.entry) + '</b></div><div class="row"><span class="grow">Budget annuel de référence</span><b>' + money(sr.ref) + '</b></div><div class="row"><span class="grow">Image visée</span><b>jusqu\'à +' + Math.round(sr.prest * 14 * 0.8) + ' pts</b></div>' +
      (sr.sup !== 'none' ? '<p class="muted" style="font-size:12px">' + (okAny ? 'Tu as de quoi engager ta propre ' + (sr.sup === 'eng' ? 'motorisation' : 'voiture') + '.' : 'Rien de compatible dans ton catalogue : un fournisseur du paddock te dépannera.') + '</p>' : '') +
      H.btn('Engager une écurie · ' + money(sr.entry), 'steam', { s: k }, { cls: 'primary', off: p.cash < sr.entry, why: 'Trésorerie insuffisante.' }));
  const tbl = H.table([{ h: '#', cls: 'num', get: t => t._i }, { h: 'Écurie', get: t => '<span style="background:' + t.color + ';display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px"></span>' + esc(t.name) + (t.o === p.id ? ' <span class="pill good">vous</span>' : t.o != null ? ' <span class="pill">usine</span>' : '') + '<br><span class="muted" style="font-size:11px">' + money(t.bud) + ' · ' + esc(supName(G, S, t)) + '</span>' }, { h: 'Pts', cls: 'num', get: t => t.pts }, { h: 'V.', cls: 'num', get: t => t.w }], R.map((t, i) => Object.assign(t, { _i: i + 1 })));
  const hist = S.hist.filter(x => x.s === k).slice(0, 8), all = Object.keys(S.titles).sort((a, b) => S.titles[b] - S.titles[a]).slice(0, 6);
  return '<div class="pw sportw">' + cats + H.card(esc(sr.n) + ' · ' + esc(sr.sub), '<p class="muted" style="font-size:13px;margin:0 0 6px">' + esc(sr.txt) + '</p><div class="row"><span class="grow">Prochaine course</span><b>' + (upcoming(G, S, [k])[0] ? mo[upcoming(G, S, [k])[0].R.m] : 'saison terminée') + '</b></div><div class="row"><span class="grow">Courses par saison</span><b>' + CAL[k].length + ' dans ' + new Set(CAL[k].map(r => r.c)).size + ' pays</b></div><div class="row"><span class="grow">Écuries engagées</span><b>' + R.length + ' / ' + sr.cap + '</b></div>' + H.btn('Voir le calendrier', 'sptab', { v: 'calsp', s: k }, { cls: 'small' })) + my + '</div>';
}
/* ---- Menu Sport : aperçu guidé, championnats, calendrier, classements, historique, sponsors & image ---- */
const spCur = G => Math.floor(G.day / 30) % 12, spMine = (S, p) => S.teams.filter(t => t.o === p.id);
const spSeries = (S, p) => { const UI = TE.UI, m = spMine(S, p); return SERIES[UI.sps] ? UI.sps : (m[0] ? m[0].s : 'f1'); };
const spSerF = (S, p, key, all, cur) => { const m = spMine(S, p).map(t => t.s); return H.filter('Championnat', key, cur, (all ? [['', 'Tous']] : []).concat(SK.map(x => [x, esc(SERIES[x].n) + (m.includes(x) ? ' ★' : '')]))); };
const hsT = (l, v) => '<span class="hst"><small>' + l + '</small><b>' + v + '</b></span>';
const formChips = t => '<span class="form">' + (t.form || []).map(x => '<i class="' + (x === 1 ? 'w' : x && x <= 3 ? 'p' : x ? '' : 'd') + '" title="' + (x ? x + 'e' : 'abandon') + '">' + (x || '×') + '</i>').join('') + '</span>';
const posTxt = x => x ? (x === 1 ? '1er' : x + 'e') : 'abandon';
const rankOf = (S, t) => sportRank(S, t.s).indexOf(t) + 1;
const avgPos = t => t.rn - t.dnf > 0 ? t.sum / (t.rn - t.dnf) : 0;
const upcoming = (G, S, ks) => { const cur = spCur(G), y = spYear(G), L = []; for (const k of ks) for (const R of CAL[k]) if (R.m >= cur && !S.res.some(x => x.y === y && x.k === k && x.ri === R.i)) L.push({ k, R }); return L.sort((a, b) => a.R.m - b.R.m); };
function panelSport(G, p) {   // aperçu guidé
  const S = SP(G), mine = spMine(S, p), mo = TE.cal().months, B = brandsOf(p), halo = Math.round(10 * Math.max.apply(null, B.map(b => b.halo || 0).concat([0]))) / 10;
  const inc = TE.sum(mine.map(t => t.inc)), exp = TE.sum(mine.map(t => t.exp)), steps = [];
  if (!mine.length) steps.push(['go', 'Engage ta première écurie', 'Commence petit : le Tourisme compact ou la Formule Challenger demandent peu de budget et donnent déjà de la visibilité.', 'Choisir un championnat', 'sptab', { v: 'champs' }]);
  for (const t of mine) {
    const sr = SERIES[t.s], offs = (S.off[t.id] || []).length, r = rankOf(S, t), n = sportRank(S, t.s).length;
    if (t.sp.length < spSlots(t) && offs) steps.push(['ok', 'Des sponsors te sollicitent (' + esc(SERIES[t.s].n) + ')', offs + ' offre' + (offs > 1 ? 's' : '') + ' en attente : chaque contrat rapporte un revenu annuel garanti.', 'Voir les offres', 'sptab', { v: 'sponsp', t: t.id }]);
    if (t.tech < 45 && p.cash > sr.ref * 0.3) steps.push(['warn', 'Voiture en retard (' + esc(SERIES[t.s].n) + ')', 'Niveau technique ' + Math.round(t.tech) + ' / 100. Un programme de développement apporte +7 pour ' + money(sr.ref * 0.15) + '.', 'Développer', 'srd', { t: t.id }]);
    if (t.rn > 3 && r > n * 0.7) steps.push(['warn', esc(t.name) + ' (' + esc(sr.n) + ') est dans le bas du classement', r + 'e sur ' + n + '. Monte le budget, passe à des pilotes confirmés ou change de fournisseur.', 'Régler l\'écurie', 'steam', { t: t.id }]);
    if (teamCost(S, t) > p.cash * 0.5) steps.push(['bad', 'Budget lourd pour ta trésorerie (' + esc(SERIES[t.s].n) + ')', 'L\'écurie coûte ' + money(teamCost(S, t)) + ' par an, plus de la moitié de ta caisse.', 'Ajuster', 'steam', { t: t.id }]);
  }
  if (mine.length && !steps.length) steps.push(['ok', 'Tout est en ordre', 'Aucune action urgente : suis le calendrier et les classements.', '', '', {}]);
  const more = Math.max(0, steps.length - 4), guide = H.card('Prochaines étapes', steps.slice(0, 4).map(x => '<div class="gstep ' + x[0] + '"><div><b>' + x[1] + '</b><small class="muted">' + x[2] + '</small></div>' + (x[3] ? H.btn(x[3], x[4], x[5], { cls: 'small' + (x[0] === 'go' ? ' primary' : '') }) : '') + '</div>').join('') + (more ? '<p class="muted" style="font-size:12.5px;margin:6px 0 0">+ ' + more + ' autre' + (more > 1 ? 's' : '') + ' à traiter ensuite.</p>' : ''));
  const card = t => { const sr = SERIES[t.s], r = rankOf(S, t), n = sportRank(S, t.s).length, nx = upcoming(G, S, [t.s])[0];
    return H.card(esc(t.name) + ' <small class="muted">· ' + esc(sr.n) + '</small>', '<div class="row"><span class="grow">Classement</span><b>' + (t.rn ? r + ' / ' + n : 'pas encore de course') + '</b></div><div class="row"><span class="grow">Points · victoires · podiums</span><b>' + t.pts + ' · ' + t.w + ' · ' + t.pod + '</b></div><div class="row"><span class="grow">Forme</span>' + (t.form.length ? formChips(t) : '<span class="muted">—</span>') + '</div>' +
      '<div class="row"><span class="grow">Niveau technique</span><b>' + Math.round(t.tech) + '</b></div>' + H.bar(t.tech, 100, t.tech >= 60 ? 'good' : '') + '<div class="row"><span class="grow">Notoriété sportive</span><b>' + Math.round(t.fame) + '</b></div>' + H.bar(t.fame, 100, '') +
      H.kv([['Recettes de la saison', money(t.inc)], ['Dépenses de la saison', money(t.exp)], ['Bilan', '<span class="' + (t.inc - t.exp >= 0 ? 'pos' : 'neg') + '">' + money(t.inc - t.exp) + '</span>'], ['Sponsors', t.sp.length + ' / ' + spSlots(t)], ['Prochaine course', nx ? esc(nx.R.n) + ' · ' + mo[nx.R.m] : 'saison terminée']]) +
      '<p class="muted" style="font-size:12px">Potentiel : primes de ' + money(sr.ref * 0.1) + ' (milieu de grille) à ' + money(sr.ref * 0.6) + ' (domination), plus les sponsors et un halo d\'image jusqu\'à +' + Math.round(sr.prest * 14 * 0.8) + ' pts.</p>' +
      '<div class="row" style="margin-top:8px">' + H.btn('Régler', 'steam', { t: t.id }, { cls: 'primary small' }) + H.btn('Développer ' + money(sr.ref * 0.15), 'srd', { t: t.id }, { cls: 'small', off: p.cash < sr.ref * 0.15 || t.tech >= 100, why: 'Trésorerie insuffisante ou niveau maximal.' }) + H.btn('Sponsors', 'sptab', { v: 'sponsp', t: t.id }, { cls: 'small' }) + H.btn('Quitter', 'squit', { t: t.id }, { cls: 'small' }) + '</div>'); };
  const nxt = upcoming(G, S, Array.from(new Set(mine.map(t => t.s)))).slice(0, 6), y = spYear(G);
  const nextC = nxt.length ? H.card('Prochaines courses', H.table([{ h: 'Mois', get: x => mo[x.R.m] }, { h: 'Course', get: x => '<b>' + esc(x.R.n) + '</b>' + (x.R.w >= 2 ? ' <span class="pill warn">grande course</span>' : '') + '<br><span class="muted" style="font-size:11px">' + esc(SERIES[x.k].n) + ' · ' + esc(cName(x.R.c)) + '</span>' }], nxt)) : '';
  const rl = S.res.filter(x => x.mine.length).slice(0, 6), last = rl.length ? H.card('Derniers résultats', H.table([{ h: 'Course', get: x => '<b>' + esc(x.n) + '</b><br><span class="muted" style="font-size:11px">' + esc(SERIES[x.k].n) + ' · ' + x.y + '</span>' }, { h: 'Résultat', get: x => x.mine.map(m => (m.pos && m.pos <= 3 ? '<b>' : '') + posTxt(m.pos) + (m.pos && m.pos <= 3 ? '</b>' : '')).join(' · ') }, { h: 'Vainqueur', get: x => x.top[0] ? esc(x.top[0].n) : '—' }], rl)) : '';
  return '<div class="pw sportw"><section class="hero"><div class="hero-tx"><small class="over">Compétition</small><h2>Sport automobile</h2><p>Vue d\'ensemble de tes engagements : résultats, finances, image et actions à mener.</p><div class="hstats">' + hsT('Écuries', mine.length) + hsT('Recettes saison', money(inc)) + hsT('Bilan saison', money(inc - exp)) + hsT('Titres', S.tot.ti) + hsT('Halo d\'image', (halo > 0 ? '+' : '') + nf(halo, 1) + ' pts') + '</div></div><div class="hero-art sportart" aria-hidden="true"><span class="fl0">🏎️</span><span class="fl1">🏆</span><span class="fl2">🏁</span></div></section>' +
    guide + mine.map(card).join('') + nextC + last + '</div>';
}
function panelCalendrier(G, p) {
  const S = SP(G), k = fU('csr') || spSeries(S, p), sr = SERIES[k], mo = TE.cal().months, y = spYear(G), cur = spCur(G), me = teamOf(S, p, k);
  const rows = CAL[k].map(R => { const r = S.res.find(x => x.y === y && x.k === k && x.ri === R.i); return { R, r }; });
  const done = rows.filter(x => x.r).length, tbl = H.table([{ h: 'Mois', get: x => mo[x.R.m] }, { h: 'Course', get: x => '<b>' + esc(x.R.n) + '</b>' + (x.R.w >= 2 ? ' <span class="pill warn">grande course</span>' : '') + '<br><span class="muted" style="font-size:11px">' + esc(cName(x.R.c)) + ' · ' + esc(REGL[cReg(x.R.c)] ? REGL[cReg(x.R.c)][0] : '') + '</span>' }, { h: 'Résultat', get: x => x.r ? '<b>' + (x.r.top[0] ? esc(x.r.top[0].n) : '—') + '</b>' + (x.r.mine.length ? '<br><span class="muted" style="font-size:11px">toi : ' + x.r.mine.map(m => posTxt(m.pos)).join(' · ') + '</span>' : '') : (x.R.m === cur ? '<span class="pill info">ce mois</span>' : '<span class="muted">à venir</span>') }], rows);
  return '<div class="pw sportw">' + spSerF(S, p, 'csr', false, k) + H.card(esc(sr.n) + ' · calendrier ' + y, '<div class="row"><span class="grow">Courses</span><b>' + CAL[k].length + ' (' + done + ' disputées)</b></div><div class="row"><span class="grow">Pays visités</span><b>' + new Set(CAL[k].map(r => r.c)).size + '</b></div><div class="row"><span class="grow">Grandes courses</span><b>' + CAL[k].filter(r => r.w >= 2).length + '</b></div>' + (me ? '<p class="muted" style="font-size:12.5px">Ton écurie est engagée : chaque course peut rapporter des primes, des points et du buzz dans le pays hôte.</p>' : '<p class="muted" style="font-size:12.5px">Tu n\'es pas engagé dans ce championnat. ' + H.btn('Voir les conditions', 'sptab', { v: 'champs', s: k }, { cls: 'small' }) + '</p>')) + H.card('Courses de la saison', tbl) + '</div>';
}
function panelClassements(G, p) {
  const S = SP(G), k = fU('csr') || spSeries(S, p), sr = SERIES[k], R = sportRank(S, k), sel = R.find(t => String(t.id) === fU('stt')) || R.find(t => t.o === p.id) || R[0];
  const tbl = H.table([{ h: '#', cls: 'num', get: t => t._i }, { h: 'Écurie', get: t => '<span style="background:' + t.color + ';display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px"></span><button class="lnk" data-act="set" data-k="stt" data-v="' + t.id + '">' + esc(t.name) + '</button>' + (t.o === p.id ? ' <span class="pill good">vous</span>' : t.o != null ? ' <span class="pill">usine</span>' : '') + '<br><span class="muted" style="font-size:11px">' + esc(cName(t.home)) + ' · ' + esc(supName(G, S, t)) + '</span>' }, { h: 'Pts', cls: 'num', get: t => t.pts }, { h: 'V', cls: 'num hm', get: t => t.w }, { h: 'Pod', cls: 'num hm', get: t => t.pod }, { h: 'Moy', cls: 'num', get: t => t.rn - t.dnf ? nf(avgPos(t), 1) : '—' }, { h: 'Ab.', cls: 'num hm', get: t => t.dnf }, { h: 'Perf', cls: 'num hm', get: t => Math.round(basePerf(G, t)) }], R.map((t, i) => Object.assign(t, { _i: i + 1 })));
  let det = '';
  if (sel) { const own = sel.o === p.id, firm = sel.sup === 'firm' ? S.firms.find(f => f.id === sel.fid) : null;
    det = H.card(esc(sel.name) + ' <small class="muted">· ' + esc(sr.n) + '</small>', H.kv([['Pays', esc(cName(sel.home))], ['Classement', rankOf(S, sel) + ' / ' + R.length], ['Fourniture', esc(supName(G, S, sel))], ['Budget', money(sel.bud)], ['Niveau technique', Math.round(sel.tech) + ' / 100'], ['Notoriété', Math.round(sel.fame) + ' / 100'], ['Performance estimée', Math.round(basePerf(G, sel))], ['Titres', sel.ti || 0], ['Victoires cette saison', sel.w - (sel.w0 || 0)], ['Meilleur résultat', sel.best ? posTxt(sel.best) : '—'], ['Position moyenne', sel.rn - sel.dnf ? nf(avgPos(sel), 1) : '—'], ['Abandons', sel.dnf + ' sur ' + sel.rn]]) + '<div class="row"><span class="grow">Forme (6 dernières)</span>' + (sel.form.length ? formChips(sel) : '<span class="muted">—</span>') + '</div>' + (sel.hs.length ? H.table([{ h: 'Saison', get: x => x.y }, { h: 'Class.', cls: 'num', get: x => x.rk + 'e' }, { h: 'Pts', cls: 'num', get: x => x.pts }, { h: 'V', cls: 'num', get: x => x.w }, { h: 'Pod', cls: 'num', get: x => x.pod }], sel.hs) : '<p class="muted" style="font-size:12.5px">Pas encore de saison complète.</p>') + (own ? '<div class="row" style="margin-top:8px">' + H.btn('Régler', 'steam', { t: sel.id }, { cls: 'primary small' }) + '</div>' : ''));
  }
  const leaders = S.teams.filter(t => t.s === k).sort((a, b) => b.w - a.w).slice(0, 3).filter(t => t.w), rec = leaders.length ? '<p class="muted" style="font-size:12.5px;margin:0">Plus de victoires cette saison : ' + leaders.map(t => esc(t.name) + ' (' + t.w + ')').join(' · ') + '</p>' : '';
  return '<div class="pw sportw">' + spSerF(S, p, 'csr', false, k) + H.card('Classement · ' + esc(sr.n), '<div class="tscroll">' + tbl + '</div>' + rec + '<p class="muted" style="font-size:11.5px;margin-top:6px">Touche une écurie pour voir sa fiche. Moy : position moyenne en course · Ab. : abandons · Perf : performance estimée de la voiture.</p>') + det + '</div>';
}
function panelHistorique(G, p) {
  const S = SP(G), k = fU('hsr') || '', mo = TE.cal().months, mine = S.teams.filter(t => t.o === p.id);
  const my = []; for (const t of mine) for (const h of t.hs) my.push(Object.assign({ t }, h)); my.sort((a, b) => b.y - a.y);
  const tot = H.card('Mon palmarès', H.kv([['Titres', S.tot.ti], ['Victoires', S.tot.w], ['Podiums', S.tot.pod], ['Courses disputées', S.tot.rn], ['Recettes cumulées', money(S.tot.inc)], ['Dépenses cumulées', money(S.tot.exp)], ['Bilan cumulé', '<span class="' + (S.tot.inc - S.tot.exp >= 0 ? 'pos' : 'neg') + '">' + money(S.tot.inc - S.tot.exp) + '</span>']]));
  const seas = H.card('Mes saisons', my.length ? H.table([{ h: 'Saison', get: x => x.y }, { h: 'Écurie', get: x => esc(x.t.name) + '<br><span class="muted" style="font-size:11px">' + esc(SERIES[x.t.s].n) + '</span>' }, { h: 'Class.', cls: 'num', get: x => x.rk + 'e' }, { h: 'Pts', cls: 'num hm', get: x => x.pts }, { h: 'V', cls: 'num hm', get: x => x.w }, { h: 'Bilan', cls: 'num', get: x => '<span class="' + (x.inc - x.exp >= 0 ? 'pos' : 'neg') + '">' + money(x.inc - x.exp) + '</span>' }], my.slice(0, 20)) : '<p class="muted">Aucune saison terminée pour le moment.</p>');
  const H2 = S.hist.filter(x => !k || x.s === k).slice(0, 24), ch = H.card('Champions', H.table([{ h: 'Saison', get: x => x.y }, { h: 'Championnat', get: x => esc(SERIES[x.s].n) }, { h: 'Champion', get: x => '<b>' + esc(x.name) + '</b>' + (x.o === p.id ? ' <span class="pill good">vous</span>' : '') + (x.top && x.top[1] ? '<br><span class="muted" style="font-size:11px">2e : ' + esc(x.top[1].n) + '</span>' : '') }, { h: 'Pts', cls: 'num hm', get: x => x.pts }], H2.length ? H2 : []) + (H2.length ? '' : '<p class="muted">Aucune saison terminée.</p>'));
  const tt = Object.keys(S.titles).sort((a, b) => S.titles[b] - S.titles[a]).slice(0, 8), rec = tt.length ? H.card('Records : titres cumulés', H.table([{ h: 'Écurie', get: n => esc(n) }, { h: 'Titres', cls: 'num', get: n => S.titles[n] }], tt)) : '';
  const fl = S.res.filter(x => !k || x.k === k).slice(0, 25), feed = H.card('Dernières courses', fl.length ? H.table([{ h: 'Course', get: x => '<b>' + esc(x.n) + '</b><br><span class="muted" style="font-size:11px">' + esc(SERIES[x.k].n) + ' · ' + esc(cName(x.c)) + ' · ' + x.y + '</span>' }, { h: 'Podium', get: x => x.top.map((t, i) => (i + 1) + '. ' + esc(t.n)).join('<br>') }, { h: 'Toi', get: x => x.mine.length ? x.mine.map(m => posTxt(m.pos)).join(' · ') : '—' }], fl) : '<p class="muted">Aucune course disputée.</p>');
  return '<div class="pw sportw">' + H.filter('Championnat', 'hsr', k, [['', 'Tous']].concat(SK.map(x => [x, esc(SERIES[x].n)]))) + tot + seas + ch + rec + feed + '</div>';
}
function panelSponsors(G, p) {
  const S = SP(G), mine = spMine(S, p), mo = TE.cal().months;
  if (!mine.length) return '<div class="pw sportw">' + H.card('Sponsors et image', '<p class="muted">Engage d\'abord une écurie : sponsors et retombées d\'image en dépendent.</p>' + H.btn('Choisir un championnat', 'sptab', { v: 'champs' }, { cls: 'primary' })) + '</div>';
  const t = mine.find(x => String(x.id) === fU('spt')) || mine[0], sr = SERIES[t.s], b = brOfId(p, t.bid), offs = (S.off[t.id] || []).filter(o => o.until > G.day), free = spSlots(t) - t.sp.length;
  const sel = mine.length > 1 ? H.filter('Écurie', 'spt', String(t.id), mine.map(x => [String(x.id), esc(x.name) + ' · ' + esc(SERIES[x.s].n)])) : '';
  const ctr = t.sp.length ? H.table([{ h: 'Sponsor', get: c => '<b>' + esc(SPONS[c.sp][0]) + '</b><br><span class="muted" style="font-size:11px">' + esc(SPONS[c.sp][1]) + ' · ' + (c.reg === 'world' ? 'monde' : esc(REGL[c.reg][0])) + '</span>' }, { h: 'Par an', cls: 'num', get: c => money(c.fee) }, { h: 'Prime V.', cls: 'num', get: c => money(c.bonus) }, { h: 'Objectif', get: c => 'top ' + c.goal + '<br><span class="muted" style="font-size:11px">' + c.yrs + ' an' + (c.yrs > 1 ? 's' : '') + '</span>' }, { h: '', get: c => H.btn('Rompre', 'sdrop', { t: t.id, sp: c.sp }, { cls: 'small' }) }], t.sp) : '<p class="muted">Aucun sponsor pour l\'instant.</p>';
  const off = offs.length ? offs.map(o => '<div class="gstep ok"><div><b>' + esc(SPONS[o.sp][0]) + ' <small class="muted">· ' + esc(SPONS[o.sp][1]) + '</small></b><small class="muted">' + money(o.fee) + ' par an · prime de victoire ' + money(o.bonus) + ' · objectif top ' + o.goal + ' · ' + o.yrs + ' an' + (o.yrs > 1 ? 's' : '') + ' · cible : ' + (o.reg === 'world' ? 'monde' : esc(REGL[o.reg][0])) + '</small></div>' + H.btn('Signer', 'sspon', { t: t.id, o: o.id }, { cls: 'small primary', off: free <= 0, why: 'Plus d\'emplacement : monte en notoriété.' }) + '</div>').join('') : '<p class="muted">Aucune offre pour l\'instant. Les sponsors apparaissent au fil des mois, d\'autant plus que ton écurie est connue.</p>';
  const spl = '<p class="muted" style="font-size:12.5px">Emplacements : ' + t.sp.length + ' / ' + spSlots(t) + ' (un de plus tous les 30 points de notoriété). Un objectif manqué en fin de saison rompt le contrat et ternit l\'image.</p>';
  // image par zone
  const X = b.spx || { w: 0, r: {}, c: {} }, halo = Math.round(10 * (b.halo || 0)) / 10;
  const regs = REGK.map(r => { const cs = CK.filter(c => COUNTRIES[c].reg === r), aw = cs.length ? TE.sum(cs.map(c => b.cty[c] ? b.cty[c].aware : 0)) / cs.length : 0; return { r, buzz: X.w + (X.r[r] || 0), aw, n: cs.length }; }).filter(x => x.n).sort((a, z) => z.buzz - a.buzz);
  const cts = CK.map(c => ({ c, bz: spBuzz(b, c), aw: b.cty[c] ? b.cty[c].aware : 0 })).filter(x => x.bz > 0.3).sort((a, z) => z.bz - a.bz).slice(0, 10);
  const img = H.card('Impact sur l\'image · ' + esc(b.name), H.kv([['Image mondiale (halo)', (halo > 0 ? '+' : '') + nf(halo, 1) + ' pts'], ['Écho mondial des courses', nf(X.w, 1)], ['Zone visée par l\'écurie', t.reg === 'world' ? 'Monde' : REGL[t.reg][0]]]) + '<p class="muted" style="font-size:12.5px">Chaque course diffuse du buzz : fort dans le pays hôte, moyen dans sa région, faible dans le monde. Il se transforme en notoriété mois après mois, puis en ventes. Règle la zone d\'image dans les réglages de l\'écurie.</p>' + H.btn('Régler l\'écurie', 'steam', { t: t.id }, { cls: 'small' }));
  const regT = H.card('Par région', H.table([{ h: 'Région', get: x => esc(REGL[x.r][0]) }, { h: 'Buzz', cls: 'num', get: x => nf(x.buzz, 1) }, { h: 'Notoriété moy.', cls: 'num', get: x => nf(x.aw, 0) + ' %' }], regs.slice(0, 10)));
  const ctT = H.card('Pays les plus touchés', cts.length ? H.table([{ h: 'Pays', get: x => esc(cName(x.c)) }, { h: 'Buzz', cls: 'num', get: x => nf(x.bz, 1) }, { h: 'Notoriété', cls: 'num', get: x => nf(x.aw, 0) + ' %' }], cts) : '<p class="muted">Aucun effet pour l\'instant : il faut courir.</p>');
  return '<div class="pw sportw">' + sel + H.card('Sponsors · ' + esc(t.name) + ' <small class="muted">· ' + esc(sr.n) + '</small>', spl + ctr) + H.card('Offres reçues', off) + img + regT + ctT + '</div>';
}
/* ---- Concurrence : classement mondial, batailles par région, fiches rivales, mouvements ---- */
const PROF_L = k => (PROFILES[k] || PROFILES.generaliste).label;
const cPres = (a, c) => Math.max.apply(null, brandsOf(a).map(b => b.cty[c].dealers));
const cShare = (a, c) => TE.sum(brandsOf(a).map(b => b.cty[c].share || 0));
/* ================= BOURSE & PARTICIPATIONS =================
   Chaque concurrente est cotée : capitalisation = actifs + bénéfices + volumes, multipliée par un sentiment de marché qui fluctue.
   Le joueur achète et vend des parts (p.inv[id] = {pct, cost, div}), touche des dividendes, et au-delà de 50 % fixe les règles de gestion
   (a.mgmt) que l'IA de l'entreprise applique, sans l'intégrer au groupe. */
const POL = { prudent: { n: 'Prudente', ex: 0.5, res: 1.7, rd: 0.7, ads: -1 }, equilibre: { n: 'Équilibrée', ex: 1, res: 1, rd: 1, ads: 0 }, offensif: { n: 'Offensive', ex: 1.9, res: 0.7, rd: 1.35, ads: 1 } };
const polOf = a => a.mgmt ? POL[a.mgmt.pol] || POL.equilibre : POL.equilibre;
const bq = G => G.game.bq || (G.game.bq = { s: {}, h: {}, hd: [] });
const stake = (p, a) => (p.inv && p.inv[a.id] && p.inv[a.id].pct) || 0;
const isCtrl = (p, a) => stake(p, a) > 50;
const fundV = a => Math.max(80e6, TE.companyValue(a) * 0.6 + Math.max(0, TE.annualProfit(a)) * 8 + TE.sum(a.u12 || []) * 500);
const mcap = (G, a) => Math.round(fundV(a) * (bq(G).s[a.id] || 1));
const payOut = a => a.mgmt ? a.mgmt.pay : 0.3;
const divYield = (G, a) => Math.max(0, TE.annualProfit(a)) * payOut(a) / Math.max(1, mcap(G, a));
const blockPrice = (G, a, n, sell, have) => {      // prix d'un bloc de n % : achat majoré au-delà de 25 % (prime de contrôle) et par l'impact sur le cours
  const base = mcap(G, a) / 100 * n; if (sell) return base * (1 - 0.004 * n);
  return base * (1 + 0.8 * Math.max(0, have + n - 25) / 100) * (1 + 0.004 * n);
};
const portVal = (G, p) => TE.sum(Object.keys(p.inv || {}).map(id => { const a = actorById(G, +id); return a && !a.bankrupt ? mcap(G, a) / 100 * p.inv[id].pct : 0; }));
const histCap = (G, a, k) => { const h = bq(G).h[a.id]; return h && h.length > k ? h[h.length - 1 - k] : 0; };
const nz = (i, d) => { const x = Math.sin(i * 127.1 + d * 311.7) * 43758.5453; return x - Math.floor(x); };
function bqMonth(G) {
  const B = bq(G), p = TE.player();
  B.hd.push(G.day); if (B.hd.length > 144) B.hd.shift();
  for (const a of G.actors) {
    if (a.player) continue;
    const arr = B.h[a.id] || (B.h[a.id] = new Array(B.hd.length - 1).fill(0));
    if (a.bankrupt) { arr.push(0); if (arr.length > 144) arr.shift(); continue; }
    const s = B.s[a.id] || 1, pr = a.last ? a.last.profit : 0;
    B.s[a.id] = clamp(1 + (s - 1) * 0.85 + (nz(a.id, G.day) + nz(a.id + 77, G.day) + nz(a.id + 191, G.day) - 1.5) * 0.05 + (pr > 0 ? 0.004 : -0.006), 0.55, 1.7);
    arr.push(mcap(G, a)); if (arr.length > 144) arr.shift();
  }
  if (!p || !p.inv) return;
  let tot = 0;
  for (const id of Object.keys(p.inv)) {
    const a = actorById(G, +id), h = p.inv[id];
    if (!a || a.bankrupt) { p.m.out['moins-values'] = (p.m.out['moins-values'] || 0) + h.cost; TE.news('Faillite de ' + (a ? a.name : 'une entreprise') + ' : ta participation de ' + h.pct + ' % est perdue.', 'bad'); delete p.inv[id]; continue; }
    const pr = a.last ? a.last.profit : 0, res = (PROFILES[a.profile] || PROFILES.generaliste).reserve, mine = pr > 0 && a.cash > 0.4 * res ? pr * payOut(a) * h.pct / 100 : 0;
    if (mine > 0) { a.cash -= mine; TE.earn(p, 'dividendes reçus', mine); h.div = (h.div || 0) + mine; tot += mine; }
  }
  p.divH = (p.divH || []).concat([tot]).slice(-12);
}
function bqNews(G, f, why) { const B = bq(G); for (const id of Object.keys(B.s)) B.s[id] = clamp(B.s[id] * f, 0.55, 1.7); TE.news(why, f < 1 ? 'bad' : 'good'); }
const stkBadge = (p, a) => { const s = stake(p, a); return s ? ' <span class="pill ' + (s > 50 ? 'good' : '') + '">' + (s > 50 ? '🤝 ' : '') + s + ' %</span>' : ''; };
function panelBourse(G, p) {
  const B = bq(G), R = TE.rivals().filter(a => !a.bankrupt), inv = p.inv || {}, flt = fU('bflt') || '';
  const rows = R.map(a => ({ a, cap: mcap(G, a), ch: histCap(G, a, 12) ? mcap(G, a) / histCap(G, a, 12) - 1 : null, dy: divYield(G, a), my: stake(p, a) }));
  const val = portVal(G, p), cost = TE.sum(Object.values(inv).map(h => h.cost)), div12 = TE.sum(p.divH || []), ctl = rows.filter(r => r.my > 50);
  const hero = '<div class="hstats">' + hsT('Valeur du portefeuille', money(val)) + hsT('Plus-value latente', (val - cost >= 0 ? '+' : '') + money(val - cost)) + hsT('Dividendes (12 mois)', money(div12)) + hsT('Sous ton contrôle', ctl.length) + '</div>';
  const list = rows.filter(r => flt === 'mine' ? r.my > 0 : flt === 'ctl' ? r.my > 50 : true).sort((x, y) => y.cap - x.cap).slice(0, 30);
  const sel = rows.find(r => String(r.a.id) === fU('bsel')) || rows.slice().sort((x, y) => y.my - x.my || y.cap - x.cap)[0];
  const mkt = H.card('Marché des constructeurs', H.filter('Afficher', 'bflt', flt, [['', 'Toutes'], ['mine', 'Mes participations'], ['ctl', 'Sous gestion']]) + '<div class="tscroll">' + H.table([
    { h: 'Entreprise', get: r => '<button class="lnk" data-act="set" data-k="bsel" data-v="' + r.a.id + '">' + esc(r.a.name) + '</button>' + stkBadge(p, r.a) + '<br><span class="muted" style="font-size:12px">' + esc(cName(r.a.home || 'FR')) + '</span>' },
    { h: 'Capitalisation', cls: 'num', get: r => money(r.cap) },
    { h: '12 mois', cls: 'num', get: r => r.ch == null ? '—' : '<span class="pill ' + (r.ch >= 0 ? 'good' : 'bad') + '">' + (r.ch >= 0 ? '+' : '') + TE.pct(r.ch, 0) + '</span>' },
    { h: 'Rendement', cls: 'num hm', get: r => TE.pct(r.dy, 1) }], list) + '</div>' + (list.length ? '' : '<p class="muted">Aucune entreprise ne correspond.</p>'));
  let fiche = '';
  if (sel) {
    const a = sel.a, have = stake(p, a), c1 = n => Math.round(blockPrice(G, a, n, false, have)), pe = TE.annualProfit(a) > 0 ? mcap(G, a) / TE.annualProfit(a) : null, h = B.h[a.id] || [], hd = B.hd, k0 = Math.max(0, h.findIndex(x => x > 0));
    const S = [{ n: a.name, c: a.color, v: h.slice(k0) }];
    const buy = [1, 5, 10, 25].map(n => H.btn('+' + n + ' % · ' + money(c1(n)), 'bbuy', { id: a.id, n }, { cls: 'small', off: have + n > 100 || p.cash < c1(n) * 1.005, why: have + n > 100 ? 'Capital insuffisant' : 'Trésorerie insuffisante' })).join('');
    const sell = have ? [1, 5, 10, 25, 49].filter(n => n < have).map(n => H.btn('−' + n + ' %', 'bsell', { id: a.id, n }, { cls: 'small' })).join('') + H.btn('Tout vendre · ' + money(blockPrice(G, a, have, true, have)), 'bsell', { id: a.id, n: have }, { cls: 'small' }) : '';
    const opa = Math.round(acqPrice(a) * (100 - have) / 100);
    fiche = H.card(esc(a.name) + ' <small class="muted">· ' + esc(PROF_L(a.profile || 'generaliste')) + '</small>',
      H.kv([['Capitalisation', money(mcap(G, a))], ['1 % du capital', money(mcap(G, a) / 100)], ['Résultat/an', money(TE.annualProfit(a))], ['Valorisation', pe ? nf(pe, 1) + ' ×' : '—'], ['Dividende', TE.pct(divYield(G, a), 1) + '/an'], ['Trésorerie', money(a.cash)], ['Dette', money(a.debt)], ['Ta part', have ? have + ' %' : 'aucune']].concat(have ? [['Valeur de ta part', money(mcap(G, a) / 100 * have)], ['Prix payé', money(p.inv[a.id].cost)], ['Dividendes reçus', money(p.inv[a.id].div || 0)]] : [])) +
      (S[0].v.length > 2 ? H.multiLine(S, { l: histYears(G, hd.slice(k0 + (hd.length - h.length))), fmt: v => money(v), h: 150, label: 'Capitalisation de ' + a.name }) : '<p class="muted" style="font-size:13px">Le cours s\'affichera après quelques mois.</p>') +
      '<p class="muted" style="font-size:12.5px;margin:6px 0 4px">Acheter (prime de contrôle au-delà de 25 %, frais 0,5 %) :</p><div class="chips">' + buy + '</div>' + (have ? '<p class="muted" style="font-size:12.5px;margin:8px 0 4px">Vendre :</p><div class="chips">' + sell + '</div>' : '') +
      (have < 100 ? '<p class="muted" style="font-size:12.5px;margin:8px 0 4px">Ou l\'intégrer au groupe (marques, usines, modèles) en rachetant le reste du capital :</p>' + H.btn('Intégrer · ' + money(opa), 'bmerge', { id: a.id }, { cls: 'small', off: p.cash < opa, why: 'Trésorerie insuffisante' }) : ''));
    if (have > 50) {
      const M = a.mgmt || (a.mgmt = { pol: 'equilibre', pay: 0.3, zone: '', rd: 1, pos: '' });
      fiche += H.card('Mandat de gestion · ' + esc(a.name), '<p class="muted" style="font-size:12.5px;margin:0 0 6px">Avec ' + have + ' % du capital, tu fixes les règles ; l\'entreprise reste indépendante, avec ses usines, ses modèles et son réseau, et applique ta ligne.</p>' +
        '<h4 style="margin:8px 0 2px">Stratégie</h4>' + H.chips('bmand', 'pol', M.pol, Object.keys(POL).map(k => [k, POL[k].n])) + '<p class="muted" style="font-size:12px;margin:2px 0 0">Prudente : peu d\'expansion, grosse réserve. Offensive : s\'implante vite, investit plus, quitte à s\'endetter.</p>' +
        '<h4 style="margin:10px 0 2px">Dividende versé</h4>' + H.chips('bmand', 'pay', String(M.pay), [['0', 'Aucun'], ['0.3', '30 %'], ['0.6', '60 %'], ['1', '100 %']]) + '<p class="muted" style="font-size:12px;margin:2px 0 0">Part du résultat distribuée ; tu en reçois ' + have + ' %. Trop élevé, l\'entreprise ne peut plus investir.</p>' +
        '<h4 style="margin:10px 0 2px">Région prioritaire</h4>' + H.chips('bmand', 'zone', M.zone, [['', 'Aucune']].concat(REGK.map(r => [r, esc(REGL[r][0])]))) +
        '<h4 style="margin:10px 0 2px">Effort de recherche</h4>' + H.chips('bmand', 'rd', String(M.rd), [['0.7', 'Faible'], ['1', 'Normal'], ['1.5', 'Fort']]) +
        '<h4 style="margin:10px 0 2px">Positionnement de la marque</h4>' + H.chips('bmand', 'pos', M.pos || '', [['', 'Libre']].concat(Object.keys(POS).map(k => [k, POS[k][0]]))));
    }
  }
  const mine = rows.filter(r => r.my > 0).sort((x, y) => y.my - x.my);
  const port = H.card('Mon portefeuille', mine.length ? '<div class="tscroll">' + H.table([
    { h: 'Entreprise', get: r => '<button class="lnk" data-act="set" data-k="bsel" data-v="' + r.a.id + '">' + esc(r.a.name) + '</button>' }, { h: 'Part', cls: 'num', get: r => r.my + ' %' },
    { h: 'Valeur', cls: 'num', get: r => money(r.cap / 100 * r.my) }, { h: 'Gain latent', cls: 'num', get: r => { const g = r.cap / 100 * r.my - inv[r.a.id].cost; return '<span class="' + (g >= 0 ? 'up' : 'dn') + '">' + (g >= 0 ? '+' : '') + money(g) + '</span>'; } },
    { h: 'Dividendes', cls: 'num hm', get: r => money(inv[r.a.id].div || 0) }], mine) + '</div>' : '<p class="muted">Tu ne détiens aucune participation. Choisis une entreprise dans le marché et achète tes premiers pour cent : au-delà de 50 %, tu fixes ses règles de gestion.</p>');
  const gov = ctl.length ? H.card('Entreprises sous gestion', ctl.map(r => { const a = r.a, M = a.mgmt || {}; return '<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b>' + esc(a.name) + '</b> <span class="pill good">' + r.my + ' %</span>' + H.kv([['Ventes', nf(TE.sum(a.u12)) + ' véh./an'], ['Résultat', money(TE.annualProfit(a))], ['Stratégie', esc((POL[M.pol] || POL.equilibre).n)], ['Dividende', TE.pct(M.pay == null ? 0.3 : M.pay, 0)]]) + '<div style="margin-top:6px">' + H.btn('Gérer le mandat', 'set', { k: 'bsel', v: a.id }, { cls: 'small' }) + '</div></div>'; }).join('')) : '';
  return '<div class="pw sportw">' + hero + gov + mkt + fiche + port + '</div>';
}

/* ================= CONTRATS SPÉCIAUX =================
   Des clients (armées, flottes, ministères, écuries…) proposent des contrats de livraison : volume mensuel, durée et prix fixés à l'avance.
   Le volume est prélevé sur la capacité des usines ; chaque mois manqué coûte une pénalité et ternit ta réputation. */
const ctS = G => G.game.ct || (G.game.ct = { off: [], act: [], done: 0, fail: 0, rep: 10, seq: 0 });
const chsDrv = (p, m) => { const c = partOf(p, m.chs); return c && c.spec ? c.spec.drv || 'fwd' : 'fwd'; };
const CT = {
  armee: { ic: '🪖', cl: ['Armée de terre', 'Gendarmerie nationale', 'Forces spéciales', 'Sécurité civile'], t: 'Flotte tout-terrain', seg: 'suv', frac: 0.10, prem: 1.14, pen: 0.25, need: 'SUV à transmission intégrale', f: (p, m) => BODIES[m.body].seg === 'suv' && chsDrv(p, m) === 'awd' },
  flotte: { ic: '🚕', cl: ['Poste nationale', 'Taxis Express', 'Loueur Rapido', 'Mairie de la capitale'], t: 'Flotte de services', seg: 'comp', frac: 0.14, prem: 0.94, pen: 0.15, need: 'citadine, compacte ou berline (finition Access ou Confort)', f: (p, m) => ['cit', 'comp', 'ber'].includes(BODIES[m.body].seg) && m.fin <= 2 },
  vert: { ic: '🌿', cl: ['Ministère de la Transition', 'Métropole verte', 'Réseau de bus-taxis électriques'], t: 'Flotte zéro émission', seg: 'comp', frac: 0.08, prem: 1.10, pen: 0.2, need: 'véhicule électrique', f: (p, m) => m.fuel === 'elec', gate: G => fuelOk(G, 'elec') },
  proto: { ic: '🏛️', cl: ['Chancellerie', 'Palais présidentiel', 'Cour royale', 'Ministère des Affaires étrangères'], t: 'Parc de prestige', seg: 'ber', frac: 0.012, prem: 1.38, pen: 0.3, need: 'berline ou coupé en finition Prestige, image de marque ≥ 50', f: (p, m) => ['ber', 'spo'].includes(BODIES[m.body].seg) && m.fin === 3 && p.brand >= 50 },
  ecurie: { ic: '🏁', cl: ['Écurie Apex Racing', 'Scuderia Valle', 'Team Nordkurve', 'Écurie Kōsei'], t: 'Fourniture de moteurs de course', eng: true, frac: 0.003, pen: 0.2, need: 'moteur' }
};
const ctRate = (a, G) => a.player && G.game.ct ? TE.sum(G.game.ct.act.filter(c => c.t0 <= G.day).map(c => c.rate * (c.eng ? 0.25 : 1))) : 0;
function ctPick(p, G, o) {
  const K = CT[o.k];
  if (K.eng) { const L = p.parts.filter(x => x.kind === 'eng' && x.spec.fuel === o.req.fuel).map(x => ({ x, st: partInfo('eng', x.spec).st })).filter(r => r.st.kw >= o.req.kw).sort((a, b) => a.st.cost - b.st.cost)[0]; return L ? { part: L.x, cost: L.st.cost, name: partInfo('eng', L.x.spec).name } : null; }
  const m = p.models.filter(m => m.state === 'sale' && K.f(p, m)).sort((a, b) => costNow(p, G, a) - costNow(p, G, b))[0]; return m ? { m, cost: costNow(p, G, m), name: m.name } : null;
}
function ctGen(G, p) {
  const S = ctS(G); S.off = S.off.filter(o => o.exp > G.day); if (S.off.length >= 4) return;
  const cap = capOf(p, G) + ctRate(p, G); if (cap < 2000) return;
  const r = j => nz(G.day + S.seq * 13, j); if (r(1) > 0.4 + S.rep / 400) return; S.seq++;
  const keys = Object.keys(CT).filter(k => !CT[k].gate || CT[k].gate(G)), k = keys[Math.floor(r(2) * keys.length)], K = CT[k], q = 1 + S.rep / 400;
  const o = { id: G.nid++, k, cl: K.cl[Math.floor(r(3) * K.cl.length)], exp: G.day + 90, mo: [12, 18, 24, 36][Math.floor(r(5) * 4)], pen: K.pen };
  const sz = 0.6 + 0.8 * r(4);
  if (K.eng) {
    const fl = ['ess', 'hyb'].concat(fuelOk(G, 'elec') ? ['elec'] : []).filter(f => fuelOk(G, f)), fuel = fl[Math.floor(r(6) * fl.length)] || 'ess', kw = [150, 220, 300][Math.floor(r(7) * 3)];
    o.eng = true; o.req = { fuel, kw }; o.rate = Math.max(6, Math.round(cap * K.frac * sz / 2) * 2); o.price = Math.round(kw * 220 * infl(G) * (fuel === 'hyb' ? 1.2 : fuel === 'elec' ? 1.15 : 1) * q / 1000) * 1000;
    o.txt = 'Moteurs ' + FUELS[fuel].n.toLowerCase() + ' d\'au moins ' + kw + ' kW (' + Math.round(kw * 1.36) + ' ch)';
  } else { o.rate = Math.max(K === CT.proto ? 8 : 20, Math.round(cap * K.frac * sz / 10) * 10); o.price = Math.round(SEG_ANCHOR[K.seg] * infl(G) * K.prem * q / 100) * 100; o.txt = K.need.charAt(0).toUpperCase() + K.need.slice(1); }
  o.total = o.rate * o.mo; S.off.push(o);
  TE.news('Appel d\'offres : ' + o.cl + ' recherche ' + (K.eng ? 'des moteurs' : 'une flotte') + ' (' + o.rate + '/mois pendant ' + o.mo + ' mois).', 'info');
}
function ctMonth(G) {
  const p = TE.player(); if (!p) return; const S = ctS(G); ctGen(G, p);
  for (const c of S.act.slice()) {
    if (c.t0 > G.day) continue;
    const pk = ctPick(p, G, c); let sh = c.rate;
    if (pk) { sh = 0; TE.earn(p, 'contrats', c.rate * c.price); TE.spend(p, 'production contrats', Math.round(c.rate * pk.cost)); c.done += c.rate; c.last = c.rate; }
    else { c.miss++; c.last = 0; const pen = Math.round(c.rate * c.price * c.pen); TE.spend(p, 'pénalités contrats', pen); S.rep = Math.max(0, S.rep - 4); TE.news('Contrat ' + c.cl + ' : livraison manquée, pénalité de ' + money(pen) + '.', 'bad'); }
    c.left--;
    if (c.miss >= 3) { S.act = S.act.filter(x => x !== c); S.fail++; const pen = Math.round(c.left * c.rate * c.price * 0.1); TE.spend(p, 'pénalités contrats', pen); S.rep = Math.max(0, S.rep - 8); TE.news('Contrat ' + c.cl + ' résilié après trois livraisons manquées (' + money(pen) + ' de pénalité).', 'bad'); }
    else if (c.left <= 0) { S.act = S.act.filter(x => x !== c); S.done++; const bonus = Math.round(c.total * c.price * 0.05); TE.earn(p, 'contrats', bonus); S.rep = Math.min(100, S.rep + 6); TE.news('Contrat ' + c.cl + ' honoré : prime de fin de contrat ' + money(bonus) + '.', 'good'); }
  }
}
function panelContrats(G, p) {
  const S = ctS(G), act = S.act, rate = ctRate(p, G), cap = capOf(p, G) + rate;
  const mrev = TE.sum(act.filter(c => c.t0 <= G.day).map(c => c.rate * c.price));
  const hero = '<div class="hstats">' + hsT('Contrats en cours', act.length + ' / 4') + hsT('Recettes / mois', money(mrev)) + hsT('Capacité réservée', cap ? TE.pct(rate / cap, 0) : '0 %') + hsT('Réputation', Math.round(S.rep) + ' / 100') + '</div>';
  const offer = o => { const K = CT[o.k], pk = ctPick(p, G, o), full = act.length >= 4;
    return H.card(K.ic + ' ' + esc(o.cl) + ' <small class="muted">· ' + esc(K.t) + '</small>', '<p style="margin:0 0 6px;font-weight:600">' + esc(o.txt) + '</p>' + H.kv([['Volume', nf(o.rate) + '/mois × ' + o.mo], ['Prix/unité', money(o.price)], ['Total', money(o.price * o.total)], ['Pénalité', TE.pct(o.pen, 0) + ' du prix'], ['Éligible', pk ? '<span class="up">✓ oui</span>' : '<span class="dn">✗ non</span>'], ['Valable', Math.max(0, Math.ceil((o.exp - G.day) / 30)) + ' mois']]) + (pk ? '<p class="muted" style="font-size:12.5px;margin:4px 0 0">Produit retenu : ' + esc(pk.name) + '</p>' : '') +
      '<div class="chips" style="margin-top:8px">' + H.btn('Accepter', 'ctok', { id: o.id }, { off: !pk || full || o.rate * (o.eng ? 0.25 : 1) > cap * 0.5, why: !pk ? 'Aucun produit adapté' : full ? '4 contrats maximum' : 'Dépasse la moitié de ta capacité' }) + H.btn('Refuser', 'ctno', { id: o.id }, { cls: 'ghost' }) + '</div>'); };
  const cur = c => { const K = CT[c.k], pc = Math.round(100 * (c.mo - c.left) / c.mo);
    return H.card(K.ic + ' ' + esc(c.cl) + ' <small class="muted">· ' + esc(K.t) + '</small>', '<div style="height:8px;border-radius:6px;background:var(--line);overflow:hidden;margin:2px 0 8px"><i style="display:block;height:100%;width:' + pc + '%;background:var(--accent)"></i></div>' +
      H.kv([['Avancement', c.mo - c.left + ' / ' + c.mo + ' mois'], ['Livré', nf(c.done) + ' / ' + nf(c.total)], ['Prix/unité', money(c.price)], ['Recettes/mois', money(c.rate * c.price)], ['Dernier mois', c.t0 > G.day ? 'à venir' : c.last ? '<span class="up">livré</span>' : c.miss ? '<span class="dn">manqué</span>' : '—'], ['Manqués', c.miss + ' / 3']])); };
  return '<div class="pw sportw">' + hero + (act.length ? '<h3 style="margin:14px 0 6px">En cours</h3>' + act.map(cur).join('') : '') + '<h3 style="margin:14px 0 6px">Appels d\'offres</h3>' + (S.off.length ? S.off.map(offer).join('') : '<p class="muted">Aucun appel d\'offres pour le moment : les clients se manifestent régulièrement, plus souvent avec une bonne réputation.</p>') +
    H.card('Bilan', H.kv([['Contrats honorés', S.done], ['Contrats résiliés', S.fail], ['Capacité totale', nf(cap) + ' véh./mois']]) + '<p class="muted" style="font-size:12.5px;margin:6px 0 0">Les livraisons sont produites dans tes usines : le volume réservé n\'est plus disponible pour la vente au détail. Les moteurs d\'écurie ne comptent que pour un quart de véhicule.</p>') + '</div>';
}

/* ---- Historique mondial (graphiques) : ventes, parts par région, énergies vendues ; résolution qui s'adapte à la durée de la partie ---- */
const HX_CAP = 240, FUEL_K = ['ess', 'die', 'hyb', 'elec'], FUEL_C = { ess: '#8d6e63', die: '#607d8b', hyb: '#7cb342', elec: '#1e88e5' };
const decim = arr => { const o = []; for (let i = 0; i < arr.length; i += 2) o.push(arr[i]); return o; };
function recHist(G) {
  const X = G.game.hx || (G.game.hx = { d: [], st: 1, u: {}, fm: { ess: [], die: [], hyb: [], elec: [] }, rq: [], rs: {}, rn: 0 }), mo = Math.floor(G.day / 30);
  if (mo % X.st) return;
  const n0 = X.d.length; X.d.push(G.day);
  for (const a of G.actors) (X.u[a.id] || (X.u[a.id] = new Array(n0).fill(0))).push(a.bankrupt ? 0 : Math.round(TE.sum(a.u12)));
  const fu = { ess: 0, die: 0, hyb: 0, elec: 0 }; for (const a of G.actors) for (const m of a.models) { const u = TE.sum(Object.values(m.cs || {})); if (u && fu[m.fuel] != null) fu[m.fuel] += u; }
  for (const k of FUEL_K) X.fm[k].push(fu[k]);
  if (X.rn++ % 3 === 0) {
    const m0 = X.rq.length; X.rq.push(G.day);
    for (const r of REGK) { const cs = CK.filter(c => COUNTRIES[c].reg === r), vol = Math.max(1, TE.sum(cs.map(c => COUNTRIES[c].vol))), R = X.rs[r] || (X.rs[r] = {});
      for (const a of G.actors) (R[a.id] || (R[a.id] = new Array(m0).fill(0))).push(a.bankrupt ? 0 : Math.round(TE.sum(cs.map(c => TE.sum(brandsOf(a).map(b => b.cty[c].share || 0)) * COUNTRIES[c].vol)) / vol * 1000)); }
  }
  if (X.d.length >= HX_CAP) { X.d = decim(X.d); for (const k in X.u) X.u[k] = decim(X.u[k]); for (const k of FUEL_K) X.fm[k] = decim(X.fm[k]); X.st *= 2; X.rq = decim(X.rq); for (const r in X.rs) for (const k in X.rs[r]) X.rs[r][k] = decim(X.rs[r][k]); }
}
const histYears = (G, days) => days.map(d => TE.dateParts(d).y);
function chartConc(G, p, al) {
  const X = G.game.hx; if (!X || X.d.length < 2) return H.card('Évolution', '<p class="muted" style="font-size:13px">Les courbes apparaissent après quelques mois de jeu.</p>');
  const mt = fU('cm') || 'u', rg = fU('cr') || '10', reg = mt === 's' ? (fU('crg') || '') : '', src = reg ? X.rs[reg] : X.u, days = reg ? X.rq : X.d, tot0 = Object.keys(X.u).length ? X.d.map((_, i) => TE.sum(Object.keys(X.u).map(k => X.u[k][i] || 0)) || 1) : [];
  const cut = rg === 'all' ? 0 : days.findIndex(d => d >= G.day - 360 * +rg), i0 = Math.max(0, cut < 0 ? 0 : cut);
  const val = (id, i) => reg ? (src[id] ? (src[id][i] || 0) / 1000 : 0) : mt === 's' ? ((src[id] || [])[i] || 0) / (tot0[i] || 1) : ((src[id] || [])[i] || 0);
  const ids = al.map(a => a.id), last = days.length - 1, sc = id => val(id, last);
  const top = ids.slice().sort((x, y) => sc(y) - sc(x)).filter(id => id !== p.id).slice(0, 5), sel = String(fU('cst') || ''), pick = [p.id].concat(top);
  if (sel && !pick.includes(+sel) && src[+sel]) pick.push(+sel);
  const S = pick.map(id => { const a = G.actors.find(x => x.id === id); return { n: id === p.id ? 'Vous' : a.name, c: a.color, me: id === p.id, v: days.slice(i0).map((_, k) => val(id, i0 + k)) }; });
  const fmt = mt === 's' ? (v => TE.pct(v, v < 0.1 ? 1 : 0)) : (v => v >= 1e6 ? nf(v / 1e6, 1) + ' M' : v >= 1e3 ? nf(v / 1e3, v < 1e4 ? 1 : 0) + ' k' : nf(v));
  const L = histYears(G, days.slice(i0));
  return H.card('Évolution dans le temps', H.filter('Mesure', 'cm', mt, [['u', 'Ventes (12 mois)'], ['s', 'Part de marché']]) + H.filter('Période', 'cr', rg, [['5', '5 ans'], ['10', '10 ans'], ['25', '25 ans'], ['all', 'Tout']]) +
    (mt === 's' ? '<p class="muted" style="font-size:12.5px;margin:2px 0 6px">' + (reg ? 'Part du marché de la région choisie (filtre « Région » plus bas).' : 'Part des ventes entre constructeurs ; choisis une région plus bas pour la détailler.') + '</p>' : '') + H.multiLine(S, { l: L, fmt, label: 'Courbes de ' + (mt === 's' ? 'part de marché' : 'ventes') + ' des principaux constructeurs' }));
}
function chartMix(G) {
  const X = G.game.hx; if (!X || X.d.length < 2) return '';
  const i0 = Math.max(0, X.d.findIndex(d => d >= G.day - 360 * (+(fU('cr') || 10) || 10)));
  const rg = fU('cr') === 'all' ? 0 : i0, S = FUEL_K.map(k => ({ n: FUELS[k].n, c: FUEL_C[k], v: X.fm[k].slice(rg) }));
  return H.card('Énergies vendues dans le monde', '<p class="muted" style="font-size:12.5px;margin:0 0 6px">Répartition des ventes de tous les constructeurs par type de motorisation.</p>' + H.areaShare(S, { l: histYears(G, X.d.slice(rg)), label: 'Répartition des ventes par énergie' }));
}

function panelConc(G, p) {
  const al = live(G), S = SP(G), tot = Math.max(1, TE.sum(al.map(a => TE.sum(a.u12)))), rg = fU('crg') || '';
  const rows = al.map(a => ({ a, u: TE.sum(a.u12), n: CK.filter(c => cPres(a, c) >= 20).length, f: a.fact.filter(x => x.ready <= G.day).length, t: TT.filter(x => ttDone(a, x)).length, ti: TE.sum(S.teams.filter(x => x.o === a.id).map(x => x.ti || 0)) })).sort((x, y) => y.u - x.u);
  const me = rows.findIndex(r => r.a === p) + 1, top = rows.find(r => r.a !== p), sel = (rows.find(r => String(r.a.id) === fU('cst')) || rows.find(r => r.a !== p) || rows[0]).a;
  const hero = '<div class="hstats">' + hsT('Entreprises', al.length) + hsT('Ton rang mondial', me + ' / ' + al.length) + hsT('Ta part', TE.pct(TE.sum(p.u12) / tot, 1)) + hsT('Leader', top ? esc(top.a.name) : '—') + '</div>';
  const lb = H.card('Classement mondial', '<div class="tscroll">' + H.table([{ h: '#', cls: 'num', get: r => r._i }, { h: 'Entreprise', get: r => '<button class="lnk" data-act="set" data-k="cst" data-v="' + r.a.id + '">' + esc(r.a.name) + '</button>' + (r.a === p ? ' <span class="pill good">vous</span>' : stkBadge(p, r.a)) + '<br><span class="muted" style="font-size:11px">' + esc(cName(r.a.home || 'FR')) + ' · ' + esc(PROF_L(r.a.profile || 'generaliste')) + '</span>' }, { h: 'Ventes 12 mois', cls: 'num hm', get: r => nf(r.u) }, { h: 'Part', cls: 'num', get: r => TE.pct(r.u / tot, 1) }, { h: 'Pays', cls: 'num', get: r => r.n }, { h: 'Usines', cls: 'num hm', get: r => r.f }, { h: 'Techno', cls: 'num hm', get: r => r.t }, { h: 'Titres', cls: 'num hm', get: r => r.ti }], rows.map((r, i) => Object.assign(r, { _i: i + 1 })).slice(0, 25)) + '</div><p class="muted" style="font-size:11.5px;margin-top:6px">Pays : marchés où l\'entreprise a au moins 20 concessions. Touche une entreprise pour sa fiche.</p>');
  // bataille régionale
  const cs = CK.filter(c => !rg || COUNTRIES[c].reg === rg), vol = Math.max(1, TE.sum(cs.map(c => COUNTRIES[c].vol)));
  const br = al.map(a => ({ a, sh: TE.sum(cs.map(c => cShare(a, c) * COUNTRIES[c].vol)) / vol, pr: cs.filter(c => cPres(a, c) >= 10).length })).filter(x => x.sh > 0.0005 || x.pr).sort((x, y) => y.sh - x.sh).slice(0, 10);
  const battle = H.card('Bataille ' + (rg ? 'en ' + esc(REGL[rg][0]) : 'mondiale'), H.filter('Région', 'crg', rg, [['', 'Monde']].concat(REGK.map(r => [r, esc(REGL[r][0])]))) + '<p class="muted" style="font-size:12.5px;margin:0 0 6px">Marché de la zone : ' + nf(vol / 1e6, 1) + ' M de véhicules par an, ' + cs.length + ' pays.</p>' + H.table([{ h: 'Entreprise', get: x => esc(x.a.name) + (x.a === p ? ' <span class="pill good">vous</span>' : '') }, { h: 'Part', cls: 'num', get: x => TE.pct(x.sh, 1) }, { h: 'Pays présents', cls: 'num', get: x => x.pr + ' / ' + cs.length }], br));
  // fiche
  let fiche = '';
  { const a = sel, ai = a.ai || { tg: [] }, fx = a.fact.map(f => esc(f.c) + ' ' + nf(f.cap / 1000, 0) + ' k').join(' · ') || '—', run = (a.tq || []).map(q => esc(TTI[q.id].nm)).join(', ');
    const mv = (G.game.aiLog || []).filter(x => x.id === a.id).slice(0, 4);
    fiche = H.card(esc(a.name) + ' <small class="muted">· ' + esc(PROF_L(a.profile || 'generaliste')) + '</small>', H.kv([['Siège', esc(cName(a.home || 'FR'))], ['Trésorerie', money(a.cash)], ['Marques', brandsOf(a).map(b => esc(b.name)).join(', ')], ['Image', Math.round(groupImg(a)) + ' / 100'], ['Modèles en vente', a.models.filter(m => m.state === 'sale').length], ['Usines (capacité/mois)', fx], ['Technologies maîtrisées', TT.filter(x => ttDone(a, x)).length], ['Recherche en cours', run || '—'], ['Écuries de course', S.teams.filter(x => x.o === a.id).length]].concat(a === p ? [] : [['Marchés prioritaires', ai.tg.slice(0, 5).map(c => esc(cName(c))).join(', ') || 'en cours d\'analyse']])) + (mv.length ? '<p class="muted" style="font-size:12.5px;margin:8px 0 0">' + mv.map(x => '• ' + TE.dateStr(x.d) + ' : ' + esc(x.t)).join('<br>') + '</p>' : ''));
  }
  const log = (G.game.aiLog || []).slice(0, 14), mvC = H.card('Derniers mouvements', log.length ? log.map(x => '<div class="row"><span class="grow"><b>' + esc(x.n) + '</b> ' + esc(x.t) + '</span><small class="muted">' + TE.dateStr(x.d) + '</small></div>').join('') : '<p class="muted">Les concurrents n\'ont encore rien annoncé.</p>');
  return '<div class="pw sportw">' + hero + chartConc(G, p, al) + lb + battle + chartMix(G) + fiche + mvC + '</div>';
}
function panelPaddock(G, p) {
  const S = SP(G), UI = TE.UI, f = SERIES[UI.psr] ? UI.psr : '', cn = c => (COUNTRIES[c] || { n: c }).n;
  const inF = t => !f || t.s === f, priv = S.teams.filter(t => t.o == null && inF(t)), works = S.teams.filter(t => t.o != null && inF(t)), fms = S.firms.filter(x => !f || x.ser.includes(f));
  const hs = (l, v) => '<span class="hst"><small>' + l + '</small><b>' + v + '</b></span>', top = S.firms.slice().sort((a, b) => b.lvl - a.lvl)[0];
  const cl = x => S.teams.filter(t => t.fid === x.id && inF(t)).length;
  const ft = H.table([{ h: 'Entreprise', get: x => '<b>' + esc(x.n) + '</b><br><span class="muted" style="font-size:11px">' + esc(cn(x.home)) + ' · ' + (x.role === 'm' ? 'Motoriste' : 'Constructeur de voitures de course') + '</span>' }, { h: 'Niveau', cls: 'num', get: x => Math.round(x.lvl) }, { h: 'Clients', cls: 'num hm', get: cl }, { h: 'Séries', cls: 'hm', get: x => x.ser.map(s => esc(SERIES[s].n)).join(', ') }], fms.sort((a, b) => b.lvl - a.lvl));
  const pt = H.table([{ h: 'Écurie indépendante', get: t => '<span style="background:' + t.color + ';display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px"></span><b>' + esc(t.name) + '</b><br><span class="muted" style="font-size:11px">' + esc(cn(t.home)) + ' · ' + esc(SERIES[t.s].n) + ' · ' + esc(supName(G, S, t)) + '</span>' }, { h: 'Budget', cls: 'num', get: t => money(t.bud) }, { h: 'Titres', cls: 'num hm', get: t => S.titles[t.name] || 0 }, { h: 'Fame', cls: 'num', get: t => Math.round(t.fame) }], priv.sort((a, b) => b.fame - a.fame || b.bud - a.bud).slice(0, 30));
  const wt = works.length ? H.table([{ h: 'Écurie d\'usine', get: t => '<b>' + esc(t.name) + '</b><br><span class="muted" style="font-size:11px">' + esc(SERIES[t.s].n) + ' · ' + esc(supName(G, S, t)) + '</span>' }, { h: 'Budget', cls: 'num', get: t => money(t.bud) }, { h: 'Titres', cls: 'num', get: t => t.ti }], works.sort((a, b) => b.fame - a.fame)) : '<p class="muted">Aucun constructeur engagé' + (f ? ' dans ce championnat.' : '.') + '</p>';
  return '<div class="pw sportw"><section class="hero"><div class="hero-tx"><small class="over">Coulisses</small><h2>Paddock</h2><p>Des entreprises qui n\'existent que dans les courses : motoristes, constructeurs de voitures de course et écuries indépendantes. Tu peux leur acheter une motorisation ou une voiture, ou les affronter.</p><div class="hstats">' + hs('Fournisseurs', S.firms.length) + hs('Écuries indépendantes', S.teams.filter(t => t.o == null).length) + hs('Écuries d\'usine', S.teams.filter(t => t.o != null).length) + hs('Meilleur fournisseur', top ? esc(top.n) : '—') + '</div></div><div class="hero-art sportart" aria-hidden="true"><span class="fl0">⚙️</span><span class="fl1">🔧</span><span class="fl2">🏁</span></div></section>' +
    '<div class="pstrip">' + [['pad-eng', 'Motoristes', S.firms.filter(x => x.role === 'm').length], ['pad-chs', 'Constructeurs', S.firms.filter(x => x.role === 'c').length], ['pad-team', 'Écuries indépendantes', S.teams.filter(t => t.o == null).length], ['pad-pit', 'Écuries d\'usine', S.teams.filter(t => t.o != null).length]].map(x => '<div class="pst">' + H.img(x[0]) + '<span><b>' + x[2] + '</b><small>' + x[1] + '</small></span></div>').join('') + '</div>' +
    H.filter('Championnat', 'psr', f, [['', 'Tous']].concat(SK.map(x => [x, esc(SERIES[x].n)]))) +
    H.card('Motoristes et constructeurs de voitures de course', ft) + H.card('Écuries d\'usine', wt) + H.card('Écuries indépendantes' + (priv.length > 30 ? ' · 30 premières sur ' + priv.length : ''), pt) + '</div>';
}
function panelLicences(G, p) {
  const R = TE.rivals(), B = brandsOf(p), lbr = B.some(b => (b.bid || 0) === +TE.UI.lbr) ? +TE.UI.lbr : (selB(p).bid || 0), Ls = lics(G), mine = Ls.filter(x => x.from === p.id), taken = Ls.filter(x => x.to === p.id), tm = TE.UI.lterm == null ? 1 : +TE.UI.lterm;
  const nm = id => esc((actorById(G, id) || { name: '?' }).name), rt = L => L.kind === 'part' ? nf(L.r) + ' €/véh.' : TE.pct(L.r) + ' du CA net';
  const FK = fU('flk'), FR = fU('flr'), nA = [FK, FR].filter(Boolean).length, RR = R.filter(t => !FR || String(t.id) === FR);
  const flt = H.filter('Objet', 'flk', FK, [['', 'Tout'], ['part', 'Pièces'], ['model', 'Modèles']]) + H.filter('Constructeur', 'flr', FR, [['', 'Tous']].concat(R.map(t => [String(t.id), esc(t.name)])));
  const sellable = [].concat(FK === 'model' ? [] : p.parts.filter(x => !x.lic).map(x => ['part', x]), FK === 'part' ? [] : p.models.filter(m => m.state === 'sale' && !m.lic).map(m => ['model', m]));
  const wills = (kind, it, T) => RR.filter(t => licWilling(G, t, kind, it, T.fee));
  const deals = sellable.map(([k, it]) => { const T = licTerms(k, it, tm), W = wills(k, it, T); return { n: W.length, fee: W.length * T.fee }; }), nDeals = TE.sum(deals.map(x => x.n)), sumDeals = TE.sum(deals.map(x => x.fee));
  const sellBlock = ([kind, it]) => { const T = licTerms(kind, it, tm), W = wills(kind, it, T);
    return '<details class="setup"><summary>' + (kind === 'part' ? H.ico('pieces') + ' ' : H.ico('gamme') + ' ') + esc(it.name) + ' · ' + money(T.fee) + ' + ' + rt({ kind, r: T.r }) + '</summary>' +
      H.btn(W.length ? 'Ouvrir à toutes les rivales intéressées (' + W.length + ' · +' + money(W.length * T.fee) + ')' : 'Aucune rivale intéressée', 'selllic', { to: 'all', kind, id: it.id }, { cls: 'small primary', off: !W.length, why: 'Aucune rivale n\'est intéressée pour l\'instant.' }) +
      H.table([{ h: 'Rivale', get: t => esc(t.name) }, { h: 'Intérêt', get: t => licWilling(G, t, kind, it, T.fee) ? '<span class="pill good">oui</span>' : '<span class="pill">non</span>' }, { h: '', get: t => H.btn('Concéder', 'selllic', { to: t.id, kind, id: it.id }, { cls: 'small', off: !licWilling(G, t, kind, it, T.fee), why: 'Cette rivale n\'est pas intéressée.' }) }], RR) + '</details>'; };
  const buyBlock = t => { const T0 = (k, it) => licTerms(k, it, 1);
    const ps = (FK === 'model' ? [] : t.parts).filter(x => !x.lic && !hasSpec(p, x)).sort((x, y) => y.spec.lvl - x.spec.lvl).slice(0, 6), ms = (FK === 'part' ? [] : t.models).filter(m => m.state === 'sale' && !m.lic && !Ls.some(L => L.item === m.id && L.to === p.id)).slice(0, 5);
    const row = (k, it) => { const T = T0(k, it); return { nm: (k === 'part' ? H.ico('pieces') + ' ' : H.ico('gamme') + ' ') + esc(it.name), fee: T.fee, r: rt({ kind: k, r: T.r }), k, id: it.id }; };
    const rows = ps.map(x => row('part', x)).concat(ms.map(x => row('model', x)));
    return '<details class="setup"><summary>' + esc(t.name) + ' · ' + rows.length + ' offre' + (rows.length > 1 ? 's' : '') + '</summary>' + (rows.length ? H.table([{ h: 'Offre', get: r => r.nm }, { h: 'Prix', cls: 'num', get: r => money(r.fee) }, { h: 'Redevance', get: r => r.r }, { h: '', get: r => H.btn('Acheter', 'buylic', { from: t.id, kind: r.k, id: r.id }, { cls: 'small primary', off: p.cash < r.fee, why: 'Trésorerie insuffisante.' }) }], rows) : '<p class="muted">Rien d\'intéressant à acheter.</p>') + '</details>'; };
  return '<h2>Licences</h2>' + H.tiles([['Contrats vendus', mine.length], ['Contrats achetés', taken.length], ['Redevances reçues', money(TE.sum(mine.map(x => x.cum)))], ['Redevances versées', money(TE.sum(taken.map(x => x.cum)))]]) +
    '<p class="muted" style="font-size:13px">Une licence donne le droit d\'utiliser la pièce ou de vendre le modèle d\'un autre constructeur. Le licencié paie un droit d\'entrée, puis une redevance sur chaque véhicule vendu. Une pièce sous licence se partage ensuite entre toutes les marques du groupe licencié ; un modèle sous licence est vendu sous la marque que tu choisis à l\'achat.</p>' +
    filtersCard('lic', nA, RR.length, R.length, flt, 'flk,flr') + H.card('Acheter une licence', (B.length > 1 ? '<div class="f"><span>Marque bénéficiaire</span>' + H.chips('set', 'lbr', lbr, B.map(b => [b.bid || 0, esc(b.name)])) + '</div><p class="muted" style="font-size:12px">La licence sera allouée à <b>' + esc(brOfId(p, lbr).name) + '</b> : un modèle sera vendu sous cette marque, une pièce lui sera réservée.</p>' : '') + (RR.length ? RR.map(buyBlock).join('') : '<p class="muted">Aucune rivale.</p>')) +
    H.card('Vendre une licence', '<p class="muted" style="font-size:12px">Conditions proposées :</p>' + H.seg('set', 'lterm', tm, TERMS.map(x => x[2])) + '<p class="muted" style="font-size:12px">Redevance : peu d\'argent tout de suite, beaucoup à long terme. Cash d\'abord : l\'inverse. Une rivale n\'est intéressée que si elle a la trésorerie et ne possède pas déjà l\'équivalent.</p>' + (sellable.length ? H.btn(nDeals ? 'Tout vendre d\'un coup (' + nDeals + ' contrat' + (nDeals > 1 ? 's' : '') + ' · jusqu\'à +' + money(sumDeals) + ')' : 'Tout vendre d\'un coup (aucune rivale intéressée)', 'selllic', { to: 'all', kind: 'all', id: 'all' }, { cls: 'primary', off: !nDeals, why: 'Aucune rivale n\'est intéressée pour l\'instant.' }) + '<p class="muted" style="font-size:12px">Concède chaque pièce et chaque modèle ci-dessous à toutes les rivales intéressées, avec les conditions choisies et les filtres actifs. Un contrat ne s\'annule pas. Un modèle ne peut être cédé qu\'à une rivale sans modèle récent dans le même segment.</p>' + sellable.map(sellBlock).join('') : '<p class="muted">Aucune pièce ni aucun modèle à concéder pour l\'instant.</p>')) +
    H.card('Contrats en cours', Ls.filter(x => x.from === p.id || x.to === p.id).length ? H.table([{ h: 'Objet', get: L => esc(L.name) }, { h: 'Concédant → licencié', get: L => nm(L.from) + ' → ' + nm(L.to) }, { h: 'Marque', get: L => L.to === p.id ? '<span class="pill info">' + esc(brOfId(p, L.bid).name) + '</span>' : '<span class="muted">' + esc(brOfId(actorById(G, L.to) || p, L.bid).name) + '</span>' }, { h: 'Redevance', get: L => rt(L) }, { h: 'Cumul', cls: 'num', get: L => money(L.cum) }], Ls.filter(x => x.from === p.id || x.to === p.id)) : '<p class="muted">Aucun contrat.</p>');
}

/* =============================== DÉFINITION =============================== */
const DEF = {
  id: 'constructeur', title: 'Constructeur', icon: 'gamme', subtitle: 'Tycoon automobile', currency: '€',
  titleHTML: 'Con<span>structeur</span>',
  lede: 'Développe moteurs, châssis et boîtes, dessine tes silhouettes et tes modèles, ouvre usines et concessions dans plus de 160 pays, et impose ta marque face à des rivales qui, elles, ne dorment jamais.',
  startLabel: 'Lancer la marque',
  theme: { accent: '#1d5f82', accent2: '#d9480f' },
  calendar: G => ({ startYear: eraOf(G).y0 }),
  setup: [{ k: 'name', type: 'text', label: 'Nom de la marque', def: 'Atlas Motors' }, { k: 'color', type: 'color', label: 'Couleur', def: '#0f5f7a' },
    { k: 'home', type: 'select', label: 'Pays d\'origine', def: 'MA', options: CK.slice().sort((x, y) => COUNTRIES[x].n.localeCompare(COUNTRIES[y].n, 'fr')).map(c => [c, COUNTRIES[c].n]) },
    { k: 'era', type: 'select', label: 'Époque de départ', def: 'modern', options: [['modern', 'Aujourd\'hui · 2028'], ['classic', 'Années 80 · 1980']] },
    { k: 'scen', type: 'select', label: 'Scénario', def: 'maroc', options: [['maroc', 'Petite marque : tout à construire'], ['redress', 'Redressement : constructeur historique endetté'], ['volt', 'Start-up électrique : tout à prouver']] }],
  presets: [{ label: 'Découverte : 600 M€, rivales calmes', cash: 600e6, rich: 0.8, aggr: 0.6 }, { label: 'Classique : 400 M€', cash: 400e6, rich: 1, aggr: 1 }, { label: 'Coriace : 250 M€, rivales riches', cash: 250e6, rich: 1.3, aggr: 1.4 }],
  rivals: RIVALS, rivalPool: G => isClassic(G) ? RIVALS.filter(R => entryYear(R) <= 1980) : RIVALS, entrants: ENTRANTS, entrantPool: G => isClassic(G) ? RIVALS.concat(ENTRANTS).filter(R => entryYear(R) <= absYear(G)) : ENTRANTS, profiles: PROFILES, maxRivals: 18, rivalDefault: 12,
  staff: { ingenieurs: { label: 'Ingénieurs', sal: 6500, hire: 8000 } },
  credit: { base: 60e6, assetsMult: 0.5, minLimit: 40e6, bankruptFloor: -150e6, graceDays: 90, rates: [0.035, 0.045, 0.06, 0.08, 0.11] },
  ledger: { in: { ventes: 'Ventes (net réseau)', licences: 'Licences (revenus)', 'dividendes reçus': 'Dividendes de participations', contrats: 'Contrats spéciaux', 'plus-values': 'Plus-values boursières', sport: 'Sport (gains et sponsors)' }, out: { sport: 'Sport automobile', production: 'Coût de production', 'R&D': 'Recherche & développement', réseau: 'Réseau de distribution', usines: 'Usines', marketing: 'Marketing', garantie: 'Garantie', licences: 'Licences', marques: 'Création de marques', rachat: 'Rachats', stockage: 'Stockage des véhicules', 'frais généraux': 'Frais généraux', 'frais de bourse': 'Frais de bourse', 'amendes quotas': 'Amendes (quotas électrifiés)', 'production contrats': 'Production des contrats', 'pénalités contrats': 'Pénalités de contrats', 'moins-values': 'Moins-values boursières', dividendes: 'Dividendes', douanes: 'Droits de douane', transport: 'Transport', 'amendes CO2': 'Amendes CO2', rappels: 'Rappels de série', partenaire: 'Partenaires locaux', rachat: 'Rachats', salaires: 'Ingénieurs', 'intérêts': 'Intérêts' } },
  assets: a => TE.sum(a.fact.map(f => f.cap * 30000)) + dealersTotal(a) * 0.3e6 + (a.inv && TE.G ? portVal(TE.G, a) : 0),
  goals: {
    units: { label: 'Ventes annuelles', unit: 'véhicules/an', def: 200000, value: a => TE.sum(a.u12), fmt: v => nf(v) },
    brand: { label: 'Image de marque', unit: '/100', def: 80, value: a => groupImg(a), fmt: v => nf(v) + ' / 100' },
    value: { label: 'Valeur de l\'entreprise', unit: 'M€', def: 3000, value: a => TE.companyValue(a) / 1e6, fmt: v => nf(v) + ' M€' }
  },

  init(G) { G.game = { fuel: 1, elec: 1, econ: 1, batt: 1, mkt: {}, totUnits: 0, othW: {}, ms: {}, regs: mkRegs(G) }; for (const c of CK) G.game.othW[c] = 4; eraLast = ''; eraApply(G); },
  initActor(G, a, R, o) {
    if (!R) {                                                           // joueur : petite marque
      const home = (o.opts && o.opts.home) || 'MA'; mkState(a, home); a.staff.ingenieurs.n = 120; a.brand = 35;
      const e = addPart(a, G, 'eng', { fuel: 'ess', size: 1, lvl: 2 }), c = addPart(a, G, 'chs', { cls: 1, focus: 'eq', lvl: 2 }), g = addPart(a, G, 'gbx', { type: 'man', cap: 1, lvl: 2 });
      const C = calcModel('cit', e, c, g, 1, 0);
      a.models.push({ id: G.nid++, name: 'Citadine Alba', body: 'cit', eng: e.id, chs: c.id, gbx: g.id, fuel: 'ess', fin: 1, sty: 0, st: C.st, cost: C.cost, price: suggestPrice(G, 'cit', 1, C.cost), state: 'sale', age: 20, sold: 0, soldTot: 0, hist: [], cs: {}, left: 0, total: 0, monthly: 0 });
      a.cty[home].dealers = 140; a.cty[home].aware = 42; addFactory(a, G, home, 9000);
      for (const c of NEAR[home] || []) { a.cty[c].dealers = 40; a.cty[c].aware = 14; }
      let sc = (o.opts && o.opts.scen) || 'maroc'; if (isClassic(G) && sc === 'volt') sc = 'maroc';
      if (sc === 'redress') {
        a.models = []; a.parts = []; a.staff.ingenieurs.n = 300; a.brand = 55; a.fact = []; addFactory(a, G, home, 40000);
        for (const [b, i, l] of [['cit', 1, 2], ['comp', 2, 2], ['ber', 3, 3]]) {
          const e1 = addPart(a, G, 'eng', { fuel: b === 'ber' ? 'die' : 'ess', size: i, lvl: l }), c1 = addPart(a, G, 'chs', { cls: i, focus: 'eq', lvl: l }), g1 = addPart(a, G, 'gbx', { type: b === 'ber' ? 'auto' : 'man', cap: i, lvl: l }), C1 = calcModel(b, e1, c1, g1, 2, 0);
          a.models.push({ id: G.nid++, name: BODIES[b].n + ' ' + NAMES[G.nid % NAMES.length], body: b, eng: e1.id, chs: c1.id, gbx: g1.id, fuel: e1.spec.fuel, fin: 2, sty: 0, st: C1.st, cost: C1.cost, price: suggestPrice(G, b, 2, C1.cost), state: 'sale', age: 56 + i * 4, sold: 0, soldTot: 0, hist: [], cs: {}, left: 0, total: 0, monthly: 0 });
        }
        a.cty[home].dealers = 200; a.cty[home].aware = 70; for (const c of NEAR[home] || []) { a.cty[c].dealers = 60; a.cty[c].aware = 35; }
        a.debt = 300e6; a.cash += 300e6;
      } else if (sc === 'volt') {
        a.models = []; a.parts = []; a.staff.ingenieurs.n = 160; a.brand = 28; a.fact = []; addFactory(a, G, home, 3000);
        const e2 = addPart(a, G, 'eng', { fuel: 'elec', size: 1, lvl: 3 }), c2 = addPart(a, G, 'chs', { cls: 1, focus: 'eq', lvl: 3 }), g2 = addPart(a, G, 'gbx', { type: 'red', cap: 1, lvl: 3 }), C2 = calcModel('cit', e2, c2, g2, 1, 1);
        a.models.push({ id: G.nid++, name: 'Citadine Volt', body: 'cit', eng: e2.id, chs: c2.id, gbx: g2.id, fuel: 'elec', fin: 1, sty: 1, st: C2.st, cost: C2.cost, price: suggestPrice(G, 'cit', 1, C2.cost), state: 'sale', age: 3, sold: 0, soldTot: 0, hist: [], cs: {}, left: 0, total: 0, monthly: 0 });
        a.cty[home].dealers = 40; a.cty[home].aware = 25; a.cash += 200e6;   // levée de fonds de départ
      }
      return;
    }
    const P = PROFILES[R.profile]; mkState(a, R.home); a.staff.ingenieurs.n = P.eng; a.brand = 45 + (P.pos - 1) * 40;
    addFactory(a, G, R.home, Math.round(R.cap * 0.5 / 1000) * 1000);
    for (const c of CK) a.cty[c].dealers = c === R.home ? Math.round(D0(c) * 0.55) : COUNTRIES[c].zone === COUNTRIES[R.home].zone ? Math.round(D0(c) * 0.22) : BASE9.includes(c) ? Math.round(D0(c) * 0.05) : 0;
    a.cty[R.home].aware = 70;
    for (const s of P.segs) for (let k = 0; k < 6 && countOnSale(a, s) < 1; k++) planModel(a, G, P, s, true);
    for (const s of P.segs) if (TE.rng() < 0.5) planModel(a, G, P, s, true);
    for (const c of CK) a.cty[c].ads = c === R.home ? P.ads : 0;
  },
  welcome: G => isClassic(G) ? 'Nous sommes en 1980. Ta citadine Alba est en vente : l\'électrique et les SUV n\'existent pas encore, les marchés émergents sont minuscules. Prépare les décennies à venir.' : 'Ta marque est créée. Ta citadine est en vente : développe de nouvelles pièces et de nouveaux modèles avant qu\'elle ne vieillisse.',

  onTick(G) {
    const g = G.game; eraApply(G); eraYear(G);
    for (const r of g.regs) { if (G.day === r.ann) TE.news('Réglementation annoncée : ' + r.title + ' (' + TE.dateStr(r.day) + ').', 'info'); if (G.day === r.day) TE.news('Entrée en vigueur : ' + r.title + '.', 'bad'); }
    for (const a of G.actors) {                                           // avancement des projets
      if (a.bankrupt) continue; const sp = rdSpeed(a);
      for (const p of a.proj.slice()) { p.left -= sp; if (p.left <= 0) { a.proj.splice(a.proj.indexOf(p), 1); addPart(a, G, p.kind, p.spec, p.parent ? p : p.fname ? { fname: p.fname } : null); if (a.player) TE.news('Développement terminé : ' + KIND_L[p.kind].toLowerCase() + ' « ' + p.name + ' ».', 'good'); } }
      for (const m of a.models) if (m.state === 'dev') { m.left -= sp; if (m.left <= 0) { m.state = 'sale'; m.age = 0; m.pre = 1; m.fc = null; m.hype = 0.35 + HYPE[m.camp || 0]; if (m.camp) TE.spend(a, 'marketing', CAMP[m.camp]); if (a.player) TE.news('Lancement commercial : ' + m.name + ' !', 'good'); else {
        const old = a.models.filter(x => x !== m && x.state === 'sale' && body(x).seg === body(m).seg && x.age > 40).sort((x, y) => y.age - x.age)[0]; if (old && countOnSale(a, body(m).seg) > 1) old.state = 'end'; } } }
      for (const f of a.fact) if (f.exp && f.exp.ready <= G.day) { f.cap += f.exp.cap; if (a.player) TE.news('Extension terminée à ' + COUNTRIES[f.c].n + ' : +' + nf(f.exp.cap) + ' véh./mois.', 'good'); delete f.exp; }
      for (const f of a.fact) if (f.ready === G.day && a.player) TE.news('L\'usine de ' + COUNTRIES[f.c].n + ' est opérationnelle (' + nf(f.cap) + ' véh./mois).', 'good');
    }
    if (G.day % 30 === 0) {
      g.econ = clamp(g.econ + (1 - g.econ) * 0.08 + (TE.rng() - 0.5) * 0.03, 0.8, 1.15);
      g.fuel = clamp(g.fuel + (1 - g.fuel) * 0.06 + (TE.rng() - 0.5) * 0.08, 0.7, 1.8);
      g.elec = clamp(g.elec + (1 - g.elec) * 0.05 + (TE.rng() - 0.5) * 0.04, 0.7, 1.5);
      for (const a of G.actors) if (!a.bankrupt) for (const m of a.models) if (m.state === 'sale') m.age++;
      const mi = (G.day / 30 - 1 + 120) % 12;
      g.batt = clamp(g.batt + (Math.max(0.6, 1 - 0.02 * yrs(G)) - g.batt) * 0.05 + (TE.rng() - 0.5) * 0.10, 0.6, 1.9);
      marketMonth(G);
      if (mi === 9) salon(G);
      if (mi === 5 || mi === 11) acquisitions(G);
      if (mi === 2) aiBrands(G);
      aiGlobal(G, mi);
      licMonth(G);
      sportMonth(G, mi);
      if (G.day > 60) checkMilestones(G);
    }
  },
  onMonth(G, a) {
    for (const p of a.proj) TE.spend(a, 'R&D', p.monthly);
    for (const m of a.models) if (m.state === 'dev') TE.spend(a, 'R&D', m.monthly);
    TE.spend(a, 'réseau', dealersTotal(a) * DEALER_MONTH);
    TE.spend(a, 'usines', TE.sum(a.fact.filter(f => f.ready <= G.day).map(fFix)));
    TE.spend(a, 'marketing', TE.sum(brandsOf(a).map(b => TE.sum(CK.map(c => ADS[b.cty[c].ads] * Math.sqrt(COUNTRIES[c].vol / 1e6))))));
    for (const m of a.models) if (m.state === 'end' && (m.stock || 0) > 0) { m.endM = (m.endM || 0) + 1; if (m.endM > 12) { TE.spend(a, 'stockage', m.stock * m.cost * 0.5); m.stock = 0; } }
    TE.spend(a, 'R&D', TESTC[a.test || 0]);
    if (a.tq && a.tq.length) { for (const r of a.tq) r.left--; for (const r of a.tq.filter(r => r.left <= 0)) { (a.tech = a.tech || {})[r.id] = G.day; if (a === TE.player()) TE.toast('Technologie maîtrisée : ' + TTI[r.id].nm); } a.tq = a.tq.filter(r => r.left > 0); }
    for (const m of a.models) { m.hype = (m.hype || 0) * 0.88; if (m.discLeft > 0) m.discLeft--; }
    recallCheck(G, a);
    a.models = a.models.filter(m => m.state !== 'end' || (m.stock || 0) > 0 || m.hist.some(x => x > 0));
  },
  cheats: [
    { group: 'Constructeur', label: 'Pièces de pointe (N8)', run(G, p) { let n = 0; const add = (k, sp) => { if (!p.parts.some(x => x.kind === k && specKey(x.spec) === specKey(sp))) { addPart(p, G, k, sp); n++; } };
      for (let i = 1; i <= 4; i++) { for (const f of Object.keys(FUELS)) add('eng', { fuel: f, size: i, lvl: 8 }); for (const f of Object.keys(FOCUS)) add('chs', { cls: i, focus: f, lvl: 8 }); for (const t of Object.keys(GBX)) add('gbx', { type: t, cap: i, lvl: 8 }); }
      return n + ' pièces ajoutées.'; } },
    { group: 'Constructeur', label: 'Terminer les projets R&D', run(G, p) { p.proj.forEach(x => { x.left = 0; }); p.models.forEach(m => { if (m.state === 'dev') m.left = 0; }); return 'Projets terminés au prochain jour.'; } },
    { group: 'Constructeur', label: 'Image de marque 100', run(G, p) { brandsOf(p).forEach(b => { b.brand = 100; }); } },
    { group: 'Constructeur', label: '+100 concessions partout (marque active)', run(G, p) { const b = selB(p); CK.forEach(c => { b.cty[c].dealers += 100; }); } },
    { group: 'Constructeur', label: 'Notoriété 100 partout (marque active)', run(G, p) { const b = selB(p); CK.forEach(c => { b.cty[c].aware = 100; }); } },
    { group: 'Constructeur', label: 'Usine +20 000 véh./mois (pays d\'origine)', run(G, p) { addFactory(p, G, p.home, 20000); } },
    { group: 'Constructeur', label: 'Vieillir tous les modèles de 24 mois', run(G, p) { p.models.forEach(m => { if (m.state === 'sale') m.age += 24; }); } },
    { group: 'Constructeur', label: 'Stocks : tout vider', run(G, p) { p.models.forEach(m => { m.stock = 0; }); } },
    { group: 'Constructeur', label: 'Stocks : tout remplir (4 mois)', run(G, p) { p.models.forEach(m => { if (m.state === 'sale') m.stock = 4 * (m.fc || m.sold || 100); }); } },
    { group: 'Marché', label: 'Batteries −30 %', run(G) { G.game.batt = Math.max(0.6, G.game.batt * 0.7); } },
    { group: 'Marché', label: 'Carburant ×1,5', run(G) { G.game.fuel = Math.min(1.8, G.game.fuel * 1.5); } },
    { group: 'Marché', label: 'Avancer la réglementation thermique de 5 ans', run(G) { const r = G.game.regs.find(x => x.kind === 'ban'); if (r) { r.day -= 360 * 5; r.ann = Math.min(r.ann, G.day); } } },
    { group: 'Groupe', label: 'Racheter gratuitement la plus petite rivale', run(G, p) { const R = TE.rivals().sort((x, y) => TE.sum(x.u12) - TE.sum(y.u12)); if (!R.length) return 'Aucune rivale.'; const nm = R[0].name; acquireBrand(G, p, R[0]); return nm + ' rachetée.'; } }
  ],
  autoPause: () => false,
  afterMonth(G) { if (G.day > 0 && Math.round(G.day / 30) % 12 === 0) { const R = ruleAt(G, 'ue', absYear(G)); TE.news('Réglementation ' + Math.floor(absYear(G)) + ' : plafond CO₂ européen ' + nf(R.co2) + ' g/km (' + R.fine + ' € par g/km et véhicule), sécurité minimale ' + R.safety + '.', 'info'); } bqMonth(G); ctMonth(G); recHist(G); const p = TE.player(); if (p && !p.bankrupt) { autopilot(G, p); makeBilan(G); } },
  popup(G) { const g = G.game, b = g.bilan; if (!b || !b.unseen) return null; b.unseen = false; const m = g.bilanMode || 'm'; if (m === 'off' || (m === 'q' && Math.round(G.day / 30) % 3)) return null; return { kind: 'bilan' }; },
  ai: { week: aiWeek },
  rankingSort: a => TE.sum(a.u12),
  rankingTitle: 'Constructeurs',
  rankingCols: [{ h: 'Marques', cls: 'num', get: a => brandsOf(a).length }, { h: 'Ventes 12 mois', cls: 'num', get: a => nf(TE.sum(a.u12)) }, { h: 'Marque', cls: 'num', get: a => Math.round(groupImg(a)) }, { h: 'Modèles', cls: 'num', get: a => nOnSale(a) }, { h: 'Trésorerie', cls: 'num', get: a => money(a.cash) }],
  saveMeta: (G, p) => ({ units: TE.sum(p.u12) }),
  endText: (G, p, win) => win ? 'Ta marque a atteint son objectif : ' + nf(TE.sum(p.u12)) + ' véhicules sur les 12 derniers mois.' : 'Ta marque n\'a plus les moyens de continuer.',

  events: {
    rate: 0.03,
    random: [
      { w: 0.45, name: 'Durcissement des normes', when: G => (G.game.rx || 1) > 0.7, run(G) { G.game.rx = (G.game.rx || 1) * 0.92; TE.news('Les régulateurs durcissent les objectifs d\'émissions : plafonds CO₂ −8 % dans toutes les régions.', 'bad'); } },
      { w: 0.3, name: 'Assouplissement des normes', when: G => (G.game.rx || 1) < 1.15, run(G) { G.game.rx = (G.game.rx || 1) * 1.06; TE.news('Sous la pression des industriels, les plafonds CO₂ sont assouplis de 6 %.', 'good'); } },
      { w: 0.5, name: 'Krach boursier', run(G) { bqNews(G, 0.72, 'Krach boursier : les valeurs automobiles perdent près d\'un tiers de leur cours.'); } },
      { w: 0.5, name: 'Euphorie boursière', run(G) { bqNews(G, 1.25, 'Euphorie en bourse : les valeurs automobiles s\'envolent.'); } },
      { w: 0.9, name: 'Lithium +35 %', when: G => fuelOk(G, 'elec'), run(G) { G.game.batt = clamp(G.game.batt * 1.35, 0.6, 1.9); TE.news('Tension sur le lithium : le prix des batteries bondit de 35 %.', 'bad'); } },
      { w: 0.7, name: 'Batteries −20 %', when: G => fuelOk(G, 'elec'), run(G) { G.game.batt = clamp(G.game.batt * 0.8, 0.6, 1.9); TE.news('Surcapacité de production de batteries : les prix chutent de 20 %.', 'good'); } },
      { w: 1.2, name: 'Récession (pays)', run(G) { const c = TE.pick(CK); TE.addMod({ tag: 'demande', scope: c, mult: 0.85, until: G.day + 300 }); TE.news('Récession en ' + COUNTRIES[c].n + ' : le marché recule de 15 % pendant dix mois.', 'bad'); } },
      { w: 1.2, name: 'Reprise (pays)', run(G) { const c = TE.pick(CK); TE.addMod({ tag: 'demande', scope: c, mult: 1.12, until: G.day + 240 }); TE.news('Reprise économique en ' + COUNTRIES[c].n + ' : le marché progresse de 12 % pendant huit mois.', 'good'); } },
      { w: 1, name: 'Carburants en flambée', run(G) { G.game.fuel = clamp(G.game.fuel * 1.3, 0.7, 1.8); TE.news('Flambée des carburants : les motorisations sobres et l\'électrique gagnent en attrait.', 'info'); } },
      { w: 0.8, name: 'Carburants en baisse', run(G) { G.game.fuel = clamp(G.game.fuel * 0.8, 0.7, 1.8); TE.news('Les prix des carburants reculent : les gros moteurs reviennent en grâce.', 'info'); } },
      { w: 1, name: 'Pénurie de composants', run(G) { TE.addMod({ tag: 'capacite', mult: 0.75, until: G.day + 90 }); TE.news('Pénurie de composants : la production mondiale est limitée à 75 % pendant trois mois.', 'bad'); } },
      { w: 1, name: 'Prime électrique (pays)', run(G) { const c = TE.pick(CK); TE.addMod({ tag: 'ev', scope: c, mult: 1.35, until: G.day + 360 }); TE.news('Nouvelle prime à l\'électrique en ' + COUNTRIES[c].n + ' pendant un an.', 'info'); } },
      { w: 0.8, name: 'Guerre commerciale', when: G => true, run(G) { const c = TE.pick(['US', 'CN', 'BR', 'MA', 'GB']); TE.addMod({ tag: 'tarif', scope: c, mult: 1.8, until: G.day + 360 }); TE.news('Guerre commerciale : les droits de douane sur les importations en ' + COUNTRIES[c].n + ' sont presque doublés pour un an.', 'bad'); } },
      { w: 0.8, name: 'Rappel chez une rivale', run(G) { const R = TE.rivals(); if (!R.length) return; const a = TE.pick(R); a.brand = clamp(a.brand - 8, 5, 100); TE.news('Rappel massif chez ' + a.name + ' : son image de marque en souffre.', 'info'); } },
      { w: 0.6, name: 'Rappel de série (toi)', run(G) { const a = TE.player(); if (a.models.filter(m => m.state === 'sale').length) { const m = TE.pick(a.models.filter(x => x.state === 'sale')); if (m.st.rel < 65) { a.brand = clamp(a.brand - 5, 5, 100); TE.spend(a, 'garantie', 2e6 + m.soldTot * 20); TE.news('Rappel de série sur ' + m.name + ' (fiabilité insuffisante) : coût et image de marque touchés.', 'bad'); } } } }
    ]
  },

  kpis: [
    { label: 'Date', get: (p, G) => TE.dateStr(G.day) },
    { label: 'Trésorerie', get: p => money(p.cash), cls: p => (p.cash < 0 ? 'neg' : '') },
    { label: 'Ventes (mois)', get: p => (p.unitsH.length ? nf(p.unitsH[p.unitsH.length - 1]) : '--') },
    { label: 'Marque', get: p => Math.round(groupImg(p)) + ' / 100' }
  ],

  nav: [
    { id: 'pilotage', label: 'Campus', icon: 'campus', tabs: ['campus', 'tableau', 'rapport', 'autopilote', 'classement', 'actus'] },
    { id: 'produits', label: 'Production', icon: 'gamme', tabs: ['gamme', 'pieces', 'tech', 'usines', 'stocks'] },
    { id: 'marches', label: 'Marchés', icon: 'pays', tabs: ['carte', 'pays', 'marque', 'conc'] },
    { id: 'holding', label: 'Groupe', icon: 'groupe', tabs: ['groupe', 'bourse', 'contrats', 'normes', 'licences', 'finances'] },
    { id: 'sport', label: 'Sport', icon: 'succes', tabs: ['sport', 'champs', 'calsp', 'clsp', 'histsp', 'sponsp', 'paddock'] }
  ],
  badges(G, p) {
    const k = G.seed + ':' + G.day + ':' + G.mut; if (DEF._bk !== k) { DEF._bk = k; const ad = advice(G, p).filter(a => a[0] === 'bad' || a[0] === 'warn'), o = {};
      if (ad.length) o.tableau = { n: ad.length, cls: ad.some(a => a[0] === 'bad') ? 'bad' : 'warn' };
      if ((p.util || 0) > 0.93) o.usines = { n: 1, cls: 'warn' };
      if (p.mo && p.mo.demand && p.mo.demand - p.mo.units > 0.04 * p.mo.demand) o.stocks = { n: 1, cls: 'warn' };
      DEF._bv = o; }
    return DEF._bv;
  },
  tabs: [
    { id: 'campus', label: 'Vue d\'ensemble', icon: 'campus', render: panelCampus },
    { id: 'sport', label: 'Aperçu', icon: 'succes', render: panelSport },
    { id: 'champs', label: 'Championnats', icon: 'succes', render: panelChamps, fab: () => [{ label: 'Engager une écurie', icon: 'succes', act: 'steam', data: { s: '' } }] },
    { id: 'calsp', label: 'Calendrier', icon: 'succes', render: panelCalendrier },
    { id: 'clsp', label: 'Classements', icon: 'succes', render: panelClassements },
    { id: 'histsp', label: 'Historique', icon: 'succes', render: panelHistorique },
    { id: 'sponsp', label: 'Sponsors & image', icon: 'succes', render: panelSponsors },
    { id: 'paddock', label: 'Paddock', icon: 'succes', render: panelPaddock },
    { id: 'tableau', label: 'Tableau', icon: 'tableau', render: panelTableau },
    { id: 'rapport', label: 'Rapport', icon: 'qualite', render: panelRapport },
    { id: 'autopilote', label: 'Autopilote', icon: 'reglages', render: panelAuto },
    { id: 'tech', label: 'Technologies', icon: 'pieces', render: panelTech },
    { id: 'pieces', label: 'Pièces', icon: 'pieces', render: panelPieces, fab: () => [{ label: 'Nouvelle famille', icon: 'pieces', act: 'newpart', data: { k: '' } }] },
    { id: 'gamme', label: 'Modèles', icon: 'gamme', render: panelGamme, fab: () => [{ label: 'Nouveau modèle', act: 'newmodel' }] },
    { id: 'usines', label: 'Usines', icon: 'usines', render: panelUsines, fab: () => [{ label: 'Nouvelle usine', act: 'newfact' }] },
    { id: 'stocks', label: 'Stocks', icon: 'stocks', render: panelStocks },
    { id: 'carte', label: 'Carte', icon: 'pays', render: panelCarte },
    { id: 'pays', label: 'Pays', icon: 'pays', render: panelPays },
    { id: 'marque', label: 'Marque', icon: 'marque', render: panelMarque },
    { id: 'conc', label: 'Concurrence', icon: 'pays', render: panelConc },
    { id: 'groupe', label: 'Groupe', icon: 'groupe', render: panelGroupe },
    { id: 'bourse', label: 'Bourse', icon: 'finances', render: panelBourse },
    { id: 'contrats', label: 'Contrats', icon: 'licences', render: panelContrats },
    { id: 'normes', label: 'Normes', icon: 'licences', render: panelNormes },
    { id: 'licences', label: 'Licences', icon: 'licences', render: panelLicences },
    { id: 'finances', label: 'Finances', icon: 'finances', render: '@finance' },
    { id: 'classement', label: 'Concurrence', icon: 'classement', render: '@ranking' },
    { id: 'actus', label: 'Actus', icon: 'actus', render: '@news' }
  ],

  modals: { team: modalTeam, part: modalPart, design: modalDesign, fact: modalFact, pays: modalPays, bilan: modalBilan },

  actions: {
    newpart(d, c) { const M = partM(d.k || 'eng'); M.pk = d.k || ''; M.lvl = String(Math.max(1, techAvail(c.G, c.p) - 1)); M.pstep = d.k ? 1 : 0; c.openModal('part', M); return false; },
    pkind(d, c) { const M = c.UI.modal; Object.assign(M, partM(d.k), { pk: d.k, lvl: String(Math.max(1, techAvail(c.G, c.p) - 1)), pstep: 1 }); },
    pstep(d, c) { c.UI.modal.pstep = Math.max(0, +d.v); },
    rtech(d, c) { const a = c.p, x = TTI[d.id]; if (!x) return false; const s = ttState(c.G, a, x), slots = 2 + (a.staff.ingenieurs.n >= 400 ? 1 : 0); if (s !== 'open') return c.toast('Recherche impossible pour le moment.'), false; if ((a.tq || []).length >= slots) return c.toast('Tous les laboratoires sont occupés.'), false; const cost = ttCost(c.G, a, x); if (a.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'), false; TE.spend(a, 'R&D', cost); const dur = Math.max(2, Math.ceil(x.dur / rdSpeed(a))); (a.tq = a.tq || []).push({ id: x.id, left: dur, tot: dur }); c.toast('Recherche lancée : ' + x.nm + ' (' + dur + ' mois).'); },
    ttsel(d, c) { c.UI.ttsel = d.id; },
    advtech(d, c) { const a = c.p, adv = a.adv || 0, cost = ADV_COST[adv + 1]; if (adv >= 2 || techFront(c.G) + adv >= 8) return c.toast('Plus d\'avance possible.'), false; if (a.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'), false; TE.spend(a, 'R&D', cost); a.adv = adv + 1; c.toast('Programme de recherche terminé : une génération technologique d\'avance.'); },
    redesign(d, c) { const x = partOf(c.p, +d.id); if (!x || x.lic) return false; const M = partM(x.kind, x); M.lvl = String(Math.min(techAvail(c.G, c.p), x.spec.lvl + 1)); c.openModal('part', M); return false; },
    archpart(d, c) { const x = partOf(c.p, +d.id); if (!x) return; if (c.p.models.some(m => m.state !== 'end' && (m.eng == x.id || m.chs == x.id || m.gbx == x.id)) && !x.arch) return c.toast('Cette pièce équipe encore un modèle.'); x.arch = !x.arch; c.toast(x.arch ? 'Pièce archivée : elle n\'est plus proposée à la création.' : 'Pièce restaurée.'); },
    migrate(d, c) { const m = modelOf(c.p, +d.m), u = m && mechUp(c.p, m); if (!u) return c.toast('Aucune mise à jour disponible.'); if (c.p.cash < u.cost) return c.toast('Trésorerie insuffisante (' + money(u.cost) + ').');
      const C = calcModel(m.body, u.eng, u.chs, u.gbx, m.fin, m.sty); TE.spend(c.p, 'R&D', u.cost); m.eng = u.eng.id; m.chs = u.chs.id; m.gbx = u.gbx.id; m.gt = u.gbx.spec.type; m.fuel = u.eng.spec.fuel; C.st.design = m.st.design; m.st = C.st; m.cost = C.cost; m.age = Math.max(0, m.age - 12); m.hype = Math.max(m.hype || 0, 0.3); c.toast(m.name + ' : mise à jour mécanique terminée.'); },
    startpart(d, c) { const M = c.UI.modal, err = startPart(c.p, c.G, M.pk, specOf(M), M.from || 0); if (err) return c.toast(err); c.closeModal(); c.toast('Développement lancé.'); },
    newmodel(d, c) { const p = c.p, f = k => (p.parts.filter(x => x.kind === k)[0] || {}).id, M = { step: BODIES[d.body] ? 1 : 0, body: BODIES[d.body] ? d.body : 'cit', fuel: d.fuel || 'ess', pre: 'eq', eng: f('eng'), chs: f('chs'), gbx: f('gbx'), fin: '2', sty: '0', pp: '1', camp: '1', br: String(selB(p).bid || 0) };
      c.openModal('design', M); autoParts(c.G, p, c.UI.modal); c.reAll(); return false; },
    wbody(d, c) { const M = c.UI.modal; if (!BODIES[d.b]) return false; M.body = d.b; M.step = 1; autoParts(c.G, c.p, M); },
    wpre(d, c) { const M = c.UI.modal; if (!PRE[d.v]) return false; M.pre = d.v; autoParts(c.G, c.p, M); },
    wfuel(d, c) { const M = c.UI.modal; M.fuel = d.v; if (+M.step >= 2) { const ch = partOf(c.p, M.chs), e = partOf(c.p, M.eng); if (ch && !(e && e.spec.fuel === d.v && e.st.kw <= ch.st.maxKW)) { const r = pickParts(c.G, c.p, M, M.pre || 'eq', { chs: M.chs }); if (r) { M.eng = r.e.id; repair(c.G, c.p, M, 'eng'); } } } else autoParts(c.G, c.p, M); },
    wpart(d, c) { const M = c.UI.modal, k = d.k, x = partOf(c.p, +d.id); if (!x || !['chs', 'eng', 'gbx'].includes(k) || !candidates(c.p, M, k).includes(x)) return false; M[k] = x.id; if (k === 'eng') M.fuel = x.spec.fuel; repair(c.G, c.p, M, k); },
    wauto(d, c) { const M = c.UI.modal; if (!BODIES[d.b]) return false; M.body = d.b; autoParts(c.G, c.p, M); M.step = NST - 1; },
    wfin(d, c) { const M = c.UI.modal, P = PRE[d.v]; if (!P) return false; M.fin = P.fin; M.sty = P.sty; M.pp = P.pp; M.camp = P.camp; },
    wbr(d, c) { const M = c.UI.modal; M.br = String(d.v); autoParts(c.G, c.p, M); },
    wstep(d, c) { c.UI.modal.step = Math.max(0, Math.min(NST - 1, +d.v)); c.UI.txt = c.UI.txt || {}; },
    fiche(d, c) { if (!COUNTRIES[d.c]) return false; c.UI.selc = d.c; c.openModal('pays', { c: d.c, t: d.t || 'apercu' }); return false; },
    fixprice(d, c) { const m = modelOf(c.p, d.m); if (!m) return; const lab = 0.8 + 0.2 * labIdx(c.p, c.G); m.price = Math.round(Math.max(suggestPrice(c.G, m.body, m.fin, m.cost), costNow(c.p, c.G, m) * lab * 1.2 / (1 - DEALER_MARGIN)) / 100) * 100; c.toast('Prix de ' + m.name + ' relevé à ' + money(m.price) + '.'); },
    openbilan(d, c) { c.openModal('bilan'); return false; },
    bmode(d, c) { c.G.game.bilanMode = d.v; },
    aset(d, c) { const A = AU(c.G), ks = String(d.k).split('.'); let o = A; for (let i = 0; i < ks.length - 1; i++) { o = o[ks[i]]; if (!o) return false; } const k = ks[ks.length - 1], cur = o[k]; o[k] = typeof cur === 'boolean' ? d.v === '1' : k === 'keep' ? (+d.v) / 100 : +d.v; },
    startmodel(d, c) { const M = c.UI.modal, err = startModel(c.p, c.G, { body: M.body, eng: M.eng, chs: M.chs, gbx: M.gbx, fin: +M.fin, sty: +M.sty, pp: +M.pp, camp: +M.camp, br: +M.br || 0, name: c.UI.txt.mname }); if (err) return c.toast(err); c.UI.txt.mname = ''; c.closeModal(); c.toast('Développement du modèle lancé.'); },
    rename(d, c) { const m = modelOf(c.p, d.m), v = String(c.UI.txt['rn' + d.m] || '').trim().slice(0, 24); if (!m || !v) return c.toast('Saisis un nom.'); m.name = v; c.UI.txt['rn' + d.m] = undefined; c.toast('Modèle renommé : ' + v + '.'); },
    setprice(d, c) { const m = modelOf(c.p, d.m); if (m) m.price = Math.round(c.UI.amt[d.k] / 100) * 100; },
    facelift(d, c) { const m = modelOf(c.p, d.m), cost = restyleCost(m); if (c.p.cash < cost) return c.toast('Trésorerie insuffisante.'); TE.spend(c.p, 'R&D', cost); m.age = Math.max(0, m.age - 24); m.st.design = Math.min(100, m.st.design + 6); c.toast('Restylage terminé : ' + m.name + ' rajeunit.'); },
    stopmodel(d, c) { const m = modelOf(c.p, d.m); if (m) { m.state = 'end'; c.toast(m.name + ' retiré de la vente.'); } },
    newfact(d, c) { const k = COUNTRIES[d.c] ? d.c : c.p.home; c.openModal('fact', { c: k, r: COUNTRIES[k].reg, cap: 5000 }); c.UI.amt.fcap = 5000; return false; },
    fregion(d, c) { const M = c.UI.modal; M.r = d.v; M.c = CK.filter(k => COUNTRIES[k].reg === d.v).sort((x, y) => COUNTRIES[y].vol - COUNTRIES[x].vol)[0]; },
    startfact(d, c) { const M = c.UI.modal, cap = c.UI.amt.fcap, cost = factCost(M.c, cap); if (c.p.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'); TE.spend(c.p, 'usines', cost); addFactory(c.p, c.G, M.c, cap, c.G.day + 270); c.closeModal(); c.toast('Usine en construction : prête dans 9 mois.'); },
    dealers(d, c) { const b = selB(c.p), n = +d.n, cost = n * dealerCost(b, d.c); if (c.p.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'); TE.spend(c.p, 'réseau', cost); b.cty[d.c].dealers += n; c.toast(n + ' concessions ouvertes en ' + COUNTRIES[d.c].n + '.'); },
    msel(d, c) { if (Date.now() - (c.UI.mapSkip || 0) < 280) return false; const k = d.c, U = c.UI; if (!COUNTRIES[k]) return false; const cur = U.msel || [];
      U.msel = U.mmode === 'multi' ? (cur.includes(k) ? cur.filter(x => x !== k) : cur.concat(k)) : (cur.length === 1 && cur[0] === k ? [] : [k]); U.selc = k; if (U.mmode !== 'multi' && U.msel.length === 1) c.openModal('pays', { c: k, t: 'apercu' }); },
    pmore(d, c) { c.UI.pmore = (c.UI.pmore || 12) + 20; },
    mclear(d, c) { if (Date.now() - (c.UI.mapSkip || 0) < 280) return false; c.UI.msel = []; },
    mdrop(d, c) { c.UI.msel = (c.UI.msel || []).filter(x => x !== d.c); },
    mreg(d, c) { const U = c.UI, codes = CK.filter(k => d.r ? COUNTRIES[k].reg === d.r : COUNTRIES[k].cont === d.ct), cur = U.msel || [];
      if (U.mmode !== 'multi') { U.mmode = 'multi'; U.msel = codes; } else U.msel = codes.every(k => cur.includes(k)) ? cur.filter(k => !codes.includes(k)) : Array.from(new Set(cur.concat(codes)));
      fitView(U.msel.length < CK.length ? U.msel : []); },
    mall(d, c) { c.UI.mmode = 'multi'; c.UI.msel = CK.slice(); fitView([]); },
    mnone(d, c) { c.UI.msel = []; },
    mpres(d, c) { const b = selB(c.p); c.UI.mmode = 'multi'; c.UI.msel = CK.filter(k => b.cty[k].dealers > 0); },
    mabs(d, c) { const b = selB(c.p); c.UI.mmode = 'multi'; c.UI.msel = CK.filter(k => !b.cty[k].dealers); },
    mzoom(d, c) { const v = MV(); if (d.v === 'fit') fitView(selList().length && selList().length < CK.length ? selList() : []); else { const f = d.v === 'in' ? 1.5 : 1 / 1.5, k0 = v.k; v.k = clamp(v.k * f, 1, 14); const r = v.k / k0; v.x = 500 - (500 - v.x) * r; v.y = 253 - (253 - v.y) * r; clampView(v); } },
    camp(d, c) { const t = CAMPS.find(x => x.id === d.t), b = selB(c.p); if (!t || !COUNTRIES[d.c]) return; const cost = campCost(d.c, t); if (c.p.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'); TE.spend(c.p, 'marketing', cost); applyCamp(b, d.c, t, 1); c.toast(t.n + ' en ' + COUNTRIES[d.c].n + ' : notoriété ' + Math.round(b.cty[d.c].aware) + ' / 100.'); },
    mcamp(d, c) { const t = CAMPS.find(x => x.id === d.t), b = selB(c.p), sel = selList(); if (!t || !sel.length) return; const cost = TE.sum(sel.map(k => campCost(k, t))); if (c.p.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'); TE.spend(c.p, 'marketing', cost); sel.forEach(k => applyCamp(b, k, t, sel.length)); c.toast(t.n + ' lancée dans ' + sel.length + ' pays (' + money(cost) + ').'); },
    mdeal(d, c) { const b = selB(c.p), n = +d.n, sel = selList(); if (!sel.length) return; if (n > 0) { const cost = TE.sum(sel.map(k => n * dealerCost(b, k))); if (c.p.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'); TE.spend(c.p, 'réseau', cost); sel.forEach(k => { b.cty[k].dealers += n; }); c.toast(n + ' concessions de plus dans ' + sel.length + ' pays (' + money(cost) + ').'); } else { sel.forEach(k => { b.cty[k].dealers = Math.max(0, b.cty[k].dealers + n); }); c.toast('Réseau réduit dans ' + sel.length + ' pays.'); } },
    mads(d, c) { const b = selB(c.p); selList().forEach(k => { b.cty[k].ads = +d.v; }); },
    mpart(d, c) { const b = selB(c.p), l = selList().filter(k => !b.cty[k].partner), cost = TE.sum(l.map(partnerCost)); if (!l.length) return; if (c.p.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'); TE.spend(c.p, 'réseau', cost); l.forEach(k => { b.cty[k].partner = true; }); c.toast('Partenaires locaux signés dans ' + l.length + ' pays.'); },
    mfact(d, c) { const cap = TE.amtVal('mfcap', 3000), l = selList().sort((x, y) => COUNTRIES[y].vol - COUNTRIES[x].vol).slice(0, 12), cost = TE.sum(l.map(k => factCost(k, cap))); if (!l.length) return; if (c.p.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'); TE.spend(c.p, 'usines', cost); l.forEach(k => addFactory(c.p, c.G, k, cap, c.G.day + 270)); c.toast(l.length + ' usines en construction : prêtes dans 9 mois.'); },
    closed(d, c) { const x = selB(c.p).cty[d.c]; x.dealers = Math.max(0, x.dealers - (+d.n)); },
    ads(d, c) { selB(c.p).cty[d.k].ads = +d.v; },
    hire(d, c) { if (!TE.hire(c.p, 'ingenieurs', +d.n)) c.toast('Impossible (trésorerie ou effectif).'); },
    promo(d, c) { const m = modelOf(c.p, d.m); if (!m || m.state !== 'sale') return; m.disc = +d.v; m.discLeft = 3; c.toast('Promotion de ' + Math.round(m.disc * 100) + ' % sur ' + m.name + ' pendant 3 mois (image de marque légèrement touchée).'); },
    tests(d, c) { c.p.test = +d.v; },
    fclear(d, c) { for (const k of String(d.k).split(',')) c.UI[k] = ''; },
    stock(d, c) { c.p.stockT = STOCK_OPTS[+d.v]; },
    stockm(d, c) { const m = modelOf(c.p, d.k); if (m) m.stT = +d.v ? STOCK_OPTS[+d.v - 1] : null; },
    bbuy(d, c) {
      const p = c.p, G = c.G, a = actorById(G, +d.id), n = +d.n; if (!a || a.player || a.bankrupt || !(n > 0)) return;
      const have = stake(p, a); if (have + n > 100) return c.toast('Il ne reste que ' + (100 - have) + ' % du capital.');
      const cost = Math.round(blockPrice(G, a, n, false, have)), fee = Math.round(cost * 0.005); if (p.cash < cost + fee) return c.toast('Trésorerie insuffisante : ' + money(cost + fee) + '.');
      p.cash -= cost; TE.spend(p, 'frais de bourse', fee); const inv = p.inv || (p.inv = {}), h = inv[a.id] || (inv[a.id] = { pct: 0, cost: 0, div: 0 }); h.pct += n; h.cost += cost;
      const B = bq(G); B.s[a.id] = clamp((B.s[a.id] || 1) * (1 + 0.004 * n), 0.55, 1.7);
      if (have <= 50 && h.pct > 50) { a.mgmt = { pol: 'equilibre', pay: 0.3, zone: '', rd: 1, pos: '' }; if (a.ai) a.ai.t0 = -999; c.UI.bsel = String(a.id); TE.news('Tu contrôles désormais ' + a.name + ' (' + h.pct + ' %) : fixe ses règles de gestion.', 'good'); }
      c.toast(n + ' % de ' + a.name + ' achetés pour ' + money(cost) + '.');
    },
    bsell(d, c) {
      const p = c.p, G = c.G, a = actorById(G, +d.id), h = p.inv && p.inv[+d.id], n = Math.min(+d.n, h ? h.pct : 0); if (!a || !h || !(n > 0)) return;
      const got = Math.round(blockPrice(G, a, n, true, h.pct)), fee = Math.round(got * 0.005), basis = h.cost * n / h.pct, gain = got - fee - basis;
      p.cash += got - fee; if (gain >= 0) p.m.in['plus-values'] = (p.m.in['plus-values'] || 0) + gain; else p.m.out['moins-values'] = (p.m.out['moins-values'] || 0) - gain;
      h.cost -= basis; h.pct -= n; const B = bq(G); B.s[a.id] = clamp((B.s[a.id] || 1) * (1 - 0.003 * n), 0.55, 1.7);
      if (h.pct <= 0) delete p.inv[a.id]; if (h.pct <= 50 && a.mgmt) { a.mgmt = null; TE.news('Tu ne contrôles plus ' + a.name + ' : elle reprend sa gestion libre.', 'info'); }
      c.toast(n + ' % de ' + a.name + ' vendus : ' + money(got - fee) + (gain >= 0 ? ' (plus-value ' : ' (moins-value ') + money(Math.abs(gain)) + ').');
    },
    bmerge(d, c) {
      const p = c.p, G = c.G, t = actorById(G, +d.id); if (!t || t.player || t.bankrupt) return; const have = stake(p, t), price = Math.round(acqPrice(t) * (100 - have) / 100);
      if (p.cash < price) return c.toast('Trésorerie insuffisante : ' + money(price) + '.');
      TE.spend(p, 'rachat', price); TE.earn(t, 'rachat', price); if (p.inv) delete p.inv[t.id]; t.mgmt = null; const nb = acquireBrand(G, p, t, null); c.toast((nb ? nb.name : t.name) + ' rejoint ton groupe.');
    },
    bmand(d, c) {
      const p = c.p, a = actorById(c.G, +c.UI.bsel); if (!a || !isCtrl(p, a) || !a.mgmt) return;
      a.mgmt[d.k] = ['pay', 'rd'].includes(d.k) ? parseFloat(d.v) : d.v; if (a.ai) a.ai.t0 = -999; c.toast('Règle de gestion mise à jour pour ' + a.name + '.');
    },
    buyco(d, c) {
      const p = c.p, t = actorById(c.G, +d.id); if (!t || t.player || t.bankrupt) return; const b = d.b ? t.extra.find(x => x.bid === +d.b) : null; if (d.b && !b) return;
      const price = b ? brandPrice(t, b) : acqPrice(t);
      if (p.cash < price) return c.toast('Trésorerie insuffisante : ' + money(price) + ' (emprunte dans Finances).');
      TE.spend(p, 'rachat', price); if (b) TE.earn(t, 'rachat', price); const nb = acquireBrand(c.G, p, t, b ? b.bid : null); c.toast((nb ? nb.name : 'La marque') + ' rejoint ton groupe.');
    },
    newbrand(d, c) {
      const p = c.p, nm = String(c.UI.txt.nbname || '').trim().slice(0, 20), home = c.UI.nbhome || p.home;
      if (!nm) return c.toast('Choisis un nom de marque.');
      if (c.G.actors.concat(c.G.actors.reduce((r, x) => r.concat(x.extra || []), [])).some(x => x.name.toLowerCase() === nm.toLowerCase())) return c.toast('Ce nom est déjà pris.');
      if (p.cash < NEW_BRAND_COST) return c.toast('Trésorerie insuffisante (' + money(NEW_BRAND_COST) + ').');
      TE.spend(p, 'marques', NEW_BRAND_COST); const b = newBrand(c.G, p, nm, home); c.UI.txt.nbname = ''; c.UI.sbr = b.bid; c.toast('Marque « ' + nm + ' » créée : ouvre-lui des concessions (onglet Pays).');
    },
    buylic(d, c) {
      const f = actorById(c.G, +d.from), it = f && itemOf(f, d.kind, +d.id); if (!it) return; const T = licTerms(d.kind, it, 1);
      if (c.p.cash < T.fee) return c.toast('Trésorerie insuffisante : ' + money(T.fee) + '.');
      const bid = (brandsOf(c.p).some(b => (b.bid || 0) === +c.UI.lbr) ? +c.UI.lbr : selB(c.p).bid || 0), err = grantLic(c.G, f, c.p, d.kind, it, 1, bid); c.toast(err || 'Licence acquise : ' + it.name + (brandsOf(c.p).length > 1 ? ' → marque ' + brOfId(c.p, bid).name : '') + '.');
    },
    selllic(d, c) {
      const tm = c.UI.lterm == null ? 1 : +c.UI.lterm, FK = fU('flk'), FR = fU('flr'), rv = TE.rivals().filter(t => !FR || String(t.id) === FR);
      if (d.to === 'all') {   // vente groupée : un objet à toutes les rivales intéressées, ou tout le catalogue
        const items = d.kind === 'all' ? [].concat(FK === 'model' ? [] : c.p.parts.filter(x => !x.lic).map(x => ['part', x]), FK === 'part' ? [] : c.p.models.filter(m => m.state === 'sale' && !m.lic).map(m => ['model', m])) : [[d.kind, itemOf(c.p, d.kind, +d.id)]].filter(x => x[1]);
        let n = 0, sum = 0, objs = 0;
        for (const [kind, it] of items) { const T = licTerms(kind, it, tm); let k = 0; for (const t of rv) { if (!licWilling(c.G, t, kind, it, T.fee)) continue; if (!grantLic(c.G, c.p, t, kind, it, tm)) { k++; n++; sum += T.fee; } } if (k) objs++; }
        return c.toast(n ? n + ' contrat' + (n > 1 ? 's' : '') + ' de licence conclu' + (n > 1 ? 's' : '') + (objs > 1 ? ' (' + objs + ' objets)' : '') + ' : +' + money(sum) + '.' : 'Aucune rivale intéressée pour l\'instant.');
      }
      const t = actorById(c.G, +d.to), it = itemOf(c.p, d.kind, +d.id); if (!t || !it) return;
      const T = licTerms(d.kind, it, tm); if (!licWilling(c.G, t, d.kind, it, T.fee)) return c.toast(t.name + ' n\'est pas intéressée.');
      const err = grantLic(c.G, c.p, t, d.kind, it, tm); c.toast(err || 'Licence concédée à ' + t.name + ' : +' + money(T.fee) + '.');
    },
    pos(d, c) { const p = c.p, b = selB(p), v = d.v || null; if ((b.pos || null) === v) return; if (b.pos && v) { if (p.cash < 20e6) return c.toast('Changer de positionnement coûte 20 M€.'); TE.spend(p, 'marketing', 20e6); b.brand = clamp(b.brand - 5, 5, 100); } b.pos = v; },
    supply(d, c) { const p = c.p; if (p.sup && p.sup.until > c.G.day) return; p.sup = { idx: Math.round(c.G.game.batt * 1.04 * 100) / 100, until: c.G.day + 720 }; c.toast('Contrat batteries signé à ' + nf(p.sup.idx * 100) + ' % pour deux ans.'); },
    partner(d, c) { const cost = partnerCost(d.c), x = selB(c.p).cty[d.c]; if (x.partner) return; if (c.p.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'); TE.spend(c.p, 'réseau', cost); x.partner = true; c.toast('Partenaire local signé en ' + COUNTRIES[d.c].n + '.'); },
    fexp(d, c) { const f = c.p.fact.find(x => x.id == d.f), n = +d.n; if (!f || f.exp || !n) return; const cost = Math.round(factCost(f.c, n) * 0.7); if (c.p.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'); TE.spend(c.p, 'usines', cost); f.exp = { cap: n, ready: c.G.day + 150 }; c.toast('Extension lancée : +' + nf(n) + ' véh./mois dans 5 mois.'); },
    fup(d, c) { const f = c.p.fact.find(x => x.id == d.f); if (!f) return; const k = d.k === 'eco' ? 'eco' : 'auto', mx = k === 'eco' ? 2 : 3, lv = f[k] || 0; if (lv >= mx) return; const cost = f.cap * (k === 'eco' ? 600 : 5000) * (1 + lv); if (c.p.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'); TE.spend(c.p, 'usines', cost); f[k] = lv + 1; c.toast((k === 'eco' ? 'Efficacité énergétique' : 'Automatisation') + ' niveau ' + (lv + 1) + ' : ' + COUNTRIES[f.c].n + '.'); },
    fmode(d, c) { const f = c.p.fact.find(x => x.id == d.k); if (f) f.mode = +d.v; },
    sellbrand(d, c) {
      const p = c.p, b = (p.extra || []).find(x => x.bid === +d.b); if (!b) return; const price = Math.round(brandPrice(p, b) * 0.9 / 1e6) * 1e6, mods = p.models.filter(m => m.br === b.bid && m.state !== 'end').length;
      if (d.to === 'fund') { const fp = Math.round(price * 0.6 / 1e6) * 1e6; TE.earn(p, 'rachat', fp); p.extra = p.extra.filter(x => x !== b); for (const m of p.models) if (m.br === b.bid) { m.br = 0; m.state = 'end'; } for (const x of p.parts) if (x.lbr === b.bid) x.lbr = 0; c.UI.sbr = 0; return c.toast('Marque « ' + b.name + ' » cédée à un fonds : +' + money(fp) + ' (modèles retirés).'); }
      const t = actorById(c.G, +d.to); if (!t || t.player || t.bankrupt || t.cash < price * 1.2) return c.toast('Cet acheteur n\'a pas la trésorerie.');
      TE.spend(t, 'rachat', price); TE.earn(p, 'rachat', price); for (const x of p.parts) if (x.lbr === b.bid) x.lbr = 0; acquireBrand(c.G, t, p, b.bid); c.UI.sbr = 0; c.toast('« ' + b.name + ' » vendue à ' + t.name + ' : +' + money(price) + ' (' + mods + ' modèle' + (mods > 1 ? 's' : '') + ' transférés).');
    },
    ctok(d, c) {
      const p = c.p, G = c.G, S = ctS(G), o = S.off.find(x => x.id === +d.id); if (!o) return; const pk = ctPick(p, G, o), cap = capOf(p, G) + ctRate(p, G);
      if (S.act.length >= 4) return c.toast('4 contrats maximum en parallèle.'); if (!pk) return c.toast('Aucun de tes produits ne répond au cahier des charges.'); if (o.rate * (o.eng ? 0.25 : 1) > cap * 0.5) return c.toast('Volume trop élevé pour ta capacité.');
      S.off = S.off.filter(x => x !== o); S.act.push({ id: o.id, k: o.k, cl: o.cl, eng: o.eng, req: o.req, rate: o.rate, price: o.price, pen: o.pen, mo: o.mo, left: o.mo, total: o.total, done: 0, miss: 0, last: 0, t0: G.day + 20 });
      c.toast('Contrat accepté : ' + o.cl + ', livraisons dès le mois prochain.');
    },
    ctno(d, c) { const S = ctS(c.G); S.off = S.off.filter(x => x.id !== +d.id); },
    spin(d, c) {      // scission : une marque du groupe devient une société indépendante, détenue à 100 % et gérée via son mandat
      const p = c.p, G = c.G, b = (p.extra || []).find(x => x.bid === +d.b), dot = +d.dot; if (!b || !(dot >= 0)) return;
      if (p.cash < dot) return c.toast('Trésorerie insuffisante : ' + money(dot) + '.');
      const mods = p.models.filter(m => m.br === b.bid), u = 12 * TE.sum(mods.map(m => m.sold || 0)), el = mods.filter(m => m.fuel === 'elec').length * 2 > mods.length;
      const prof = el ? 'electrique' : b.pos === 'lux' ? 'premium' : b.pos === 'sport' ? 'sport' : b.pos === 'prix' ? 'lowcost' : 'generaliste';
      const a = TE.mkActor({ name: b.name, color: b.color, profile: prof, cash: dot, entrant: true }); TE.staffInit(a); mkState(a, b.home);
      a.brand = b.brand; a.pos = b.pos || null; a.awards = b.awards || 0; a.cty = b.cty;
      const eng = Math.max(40, Math.round(p.staff.ingenieurs.n * 0.15)); a.staff.ingenieurs.n = eng; p.staff.ingenieurs.n = Math.max(30, p.staff.ingenieurs.n - eng);
      for (const m of mods) {
        for (const k of ['eng', 'chs', 'gbx']) { const src = partOf(p, m[k]); if (!src) continue; let have = a.parts.find(x => x.kind === src.kind && specKey(x.spec) === specKey(src.spec)); if (!have) { have = cl(src); have.id = G.nid++; delete have.lic; delete have.lbr; a.parts.push(have); } m[k] = have.id; }
        delete m.br; a.models.push(m);
      }
      p.models = p.models.filter(m => m.br !== b.bid && !mods.includes(m)); for (const x of p.parts) if (x.lbr === b.bid) x.lbr = 0;
      const need = Math.max(3000, Math.round(u / 12 * 1.5 / 1000) * 1000), big = p.fact.slice().sort((x, y) => y.cap - x.cap)[0], take = big ? Math.min(need, Math.floor(big.cap * 0.5)) : 0; if (big) big.cap -= take;
      addFactory(a, G, b.home, Math.max(need, take));
      p.extra = p.extra.filter(x => x !== b); p.cash -= dot; (p.inv || (p.inv = {}))[a.id] = { pct: 100, cost: 0, div: 0 };
      a.mgmt = { pol: 'equilibre', pay: 0.3, zone: '', rd: 1, pos: b.pos || '' }; c.UI.sbr = 0; c.UI.bsel = String(a.id); G.mut = (G.mut || 0) + 1;
      TE.news('« ' + b.name + ' » devient une société indépendante (' + mods.filter(m => m.state !== 'end').length + ' modèles), détenue à 100 % par ton groupe.', 'good'); c.toast('« ' + b.name + ' » scindée : retrouve-la dans Bourse (mandat, cession de parts).');
    },
    fspec(d, c) { const f = c.p.fact.find(x => x.id == d.f); if (!f) return; const v = d.v || null; if ((f.spec || null) === v) return; const cost = f.cap * 600; if (c.p.cash < cost) return c.toast('Trésorerie insuffisante (' + money(cost) + ').'); TE.spend(c.p, 'usines', cost); f.spec = v; f.conv = c.G.day + 60; c.toast('Reconversion lancée : capacité réduite de moitié pendant deux mois.'); }
  }
};
const restyleCost = m => devInfo(m.body, m.fin, m.sty).dev * 0.35;
function specOf(M) {   // les paramètres par défaut sont omis : une spécification neutre reste identique aux anciennes pièces
  const lvl = +M.lvl, no = (v, d) => v == null || v === '' || String(v) === String(d);
  if (M.pk === 'eng') {
    const el = M.fuel === 'elec', size = +M.size, x = { fuel: M.fuel, size, lvl };
    if (!el && M.xp === '1') { if (M.sd == null) simInit(M); simFix(M); x.sim = simStr(M); if (M.fuel === 'hyb' && !no(M.hyb, 'full')) x.hyb = M.hyb; if (!M.from) x.size = simClass(partInfo('eng', x).st.kw); return x; }
    if (!no(M.pw, 1)) x.pw = String(M.pw); else if (M.tune && M.tune !== 'eq') x.tune = M.tune;
    if (el) { if (!no(M.chem, 'nmc')) x.chem = M.chem; if (!no(M.pack, 'm')) x.pack = M.pack; }
    else { if (!no(M.air, 'atmo')) x.air = M.air; if (!no(M.cyl, CDEF[size - 1]) && CYLO[size - 1].indexOf(+M.cyl) >= 0) x.cyl = +M.cyl; if (M.fuel === 'hyb' && !no(M.hyb, 'full')) x.hyb = M.hyb; }
    return x;
  }
  if (M.pk === 'chs') { const x = { cls: +M.cls, focus: M.focus, lvl }; if (!no(M.mat, 'acier')) x.mat = M.mat; if (!no(M.aero, 'std')) x.aero = M.aero; if (!no(M.drv, 'fwd')) x.drv = M.drv; if (!no(M.sus, 'std')) x.sus = M.sus; return x; }
  const x = { type: M.type, cap: +M.cap, lvl }; if (M.type !== 'red' && M.rat && String(M.rat) !== '6') x.rat = +M.rat; return x;
}
const PART_DEF = { xp: '0', tune: 'eq', pw: '1', cyl: '', pack: 'm', hyb: 'full', air: 'atmo', chem: 'nmc', mat: 'acier', aero: 'std', drv: 'fwd', sus: 'std', rat: '6' };
const partM1 = (pk, x) => Object.assign({ pk, fuel: 'ess', size: '1', lvl: '3', cls: '1', focus: 'eq', type: 'man', cap: '1' }, PART_DEF, x ? Object.assign({}, x.spec, { size: String(x.spec.size), lvl: String(x.spec.lvl), cls: String(x.spec.cls), cap: String(x.spec.cap), rat: String(x.spec.rat == null ? 6 : x.spec.rat), cyl: x.spec.cyl == null ? '' : String(x.spec.cyl), pw: x.spec.pw == null ? '1' : String(x.spec.pw) }) : {}, x ? { from: x.id } : {});
const partM = (pk, x) => { const M = partM1(pk, x); if (M.sim) { const q = simParse(M.sim); Object.assign(M, { xp: '1', sd: String(q.d), sc: String(q.c), sa: q.a, sr: String(q.r), scr: String(q.cr), sb: String(q.bo), sbs: String(q.bs), sv: q.vv, si: q.inj }); delete M.sim; } return M; };
function fxText(o) {
  const L = [], pc = x => (x > 1 ? '+' : '−') + Math.round(Math.abs(x - 1) * 100) + ' %', sg = x => (x > 0 ? '+' : '') + x;
  if (o.kw != null) L.push(pc(o.kw) + ' de puissance'); if (o.co2 != null) L.push(pc(o.co2) + ' de CO2'); if (o.kg != null) L.push(pc(o.kg) + ' de masse'); if (o.dr != null) L.push(pc(o.dr) + ' de traînée');
  if (o.hnd) L.push('tenue ' + sg(o.hnd)); if (o.cmf) L.push('confort ' + sg(o.cmf)); if (o.saf) L.push('sécurité ' + sg(o.saf)); if (o.eff) L.push('rendement ' + sg(o.eff)); if (o.ref) L.push('agrément ' + sg(o.ref)); if (o.rel) L.push('fiabilité ' + sg(o.rel)); if (o.cost != null) L.push(pc(o.cost) + ' de coût'); if (o.dev != null) L.push(pc(o.dev) + ' de développement');
  return L.join(' · ') || 'neutre';
}
const trKeysOf = (pk, s) => pk === 'eng' ? ['f_' + s.fuel] : pk === 'gbx' ? (s.type === 'red' ? [] : ['g_' + s.type]) : (s.focus === 'conf' ? ['a_comfort'] : s.focus === 'sport' ? ['a_perf'] : []);
const pctS = v => (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + ' %';
function trendLines(G, p, keys) {
  const cs = (p.mo && p.mo.ctyU && Object.keys(p.mo.ctyU).length ? Object.keys(p.mo.ctyU).sort((x, y) => p.mo.ctyU[y] - p.mo.ctyU[x]) : CK.slice().sort((x, y) => COUNTRIES[y].vol - COUNTRIES[x].vol)).slice(0, 3);
  return keys.map(k => { const w = trAvg(G, k), T = G.game.tr; return '<div class="trl"><span><b>' + TRK[k][0] + '</b> · monde</span><span class="tv">' + trArrow(w.d) + ' ' + pctS(w.v) + '</span></div>' + cs.map(c => { const v = trAt(G, c, k), pv = T && T.p && T.p[COUNTRIES[c].reg] ? T.p[COUNTRIES[c].reg][k] : v; return '<div class="trl sub"><span>' + esc(COUNTRIES[c].n) + '</span><span class="tv">' + trArrow(v / pv - 1) + ' ' + pctS(v) + '</span></div>'; }).join(''); }).join('');
}

/* =============================== INTERFACE =============================== */
const chips = (key, cur, opts) => H.chips('mset', key, String(cur), opts.map(o => [String(o[0]), o[1]]));
const attrBars = (A, keys) => (keys || Object.keys(ATTRS)).map(k => '<div class="abar"><span>' + ATTRS[k] + '</span>' + H.bar(A[k], 100, A[k] >= 65 ? 'good' : A[k] < 35 ? 'bad' : '') + '<b>' + Math.round(A[k]) + '</b></div>').join('');

function modalPart(M, G, p) {
  if (!M.from && !M.pk) return partKindStep(M, G, p);
  { const av = techAvail(G, p), pr = M.from ? partOf(p, M.from) : null, lo = pr ? Math.min(pr.spec.lvl, av) : Math.max(1, av - 2); M.lvl = String(clamp(+M.lvl, lo, av)); }
  const spec = specOf(M), par = M.from ? partOf(p, M.from) : null, R = par ? redesignInfo(par, spec) : null, I = R ? R.I : partInfo(M.pk, spec), dev = R ? R.dev : I.dev, days = R ? R.days : I.days;
  const same = par ? (R.dif + R.dl === 0 || partSpecEq(p, M.pk, spec)) : partSpecEq(p, M.pk, spec), lock = (lbl, txt) => '<div class="f"><span>' + lbl + '</span><b class="lk">' + txt + '</b></div>';
  let sel = '', stats = [];
  if (M.pk === 'eng') {
    sel = par ? lock('Énergie · taille', FUELS[spec.fuel].n + ' · ' + SIZE_L[spec.size - 1] + ' (famille)') : '<div class="f"><span>Énergie</span>' + chips('fuel', M.fuel, Object.keys(FUELS).map(k => [k, FUELS[k].n])) + '</div><div class="f"><span>Taille</span>' + chips('size', M.size, [1, 2, 3, 4].map(n => [n, SIZE_L[n - 1] + ' · ' + ENG_KW[n - 1] + ' kW'])) + '</div>';
    stats = [['Puissance', nf(I.st.kw) + ' kW · ' + Math.round(I.st.kw * 1.36) + ' ch']].concat(spec.fuel === 'elec' ? [] : spec.sim ? [['Cylindrée', nf(I.st.disp, 1) + ' L · ' + I.st.ncyl + ' cyl.'], ['Couple max', nf(I.st.tq) + ' Nm']] : [['Cylindrée', nf(I.st.kw / (spec.air === 'btur' ? 95 : spec.air === 'turbo' ? 80 : 58) * (spec.fuel === 'die' ? 1.15 : 1), 1) + ' L · ' + (spec.cyl || CDEF[spec.size - 1]) + ' cyl.']]).concat([ ['Fiabilité', Math.round(I.st.rel) + ' / 100'], ['CO2 (base)', nf(I.st.co2) + ' g/km'], ['Masse', nf(I.st.kg) + ' kg'], ['Coût unitaire', money(I.st.cost)]]);
  } else if (M.pk === 'chs') {
    sel = (par ? lock('Classe', 'ABCD'[spec.cls - 1] + ' · classe ' + spec.cls + ' (famille)') : '<div class="f"><span>Classe de plateforme</span>' + chips('cls', M.cls, [1, 2, 3, 4].map(n => [n, 'ABCD'[n - 1] + ' · classe ' + n])) + '</div>') + '<div class="f"><span>Réglage</span>' + chips('focus', M.focus, Object.keys(FOCUS).map(k => [k, FOCUS[k][0]])) + '</div>';
    stats = [['Puissance max', nf(I.st.maxKW) + ' kW'], ['Masse', nf(I.st.kg) + ' kg'], ['Confort / Tenue', Math.round(I.st.comfort) + ' / ' + Math.round(I.st.handling)], ['Sécurité', Math.round(I.st.safety)], ['Traînée', 'indice ' + nf(I.st.dr || 1, 2)], ['Coût unitaire', money(I.st.cost)]];
  } else {
    sel = par ? lock('Type · capacité', GBX[spec.type].n + ' · C' + spec.cap + ' (famille)') : '<div class="f"><span>Type</span>' + chips('type', M.type, Object.keys(GBX).map(k => [k, GBX[k].n])) + '</div><div class="f"><span>Capacité (couple)</span>' + chips('cap', M.cap, [1, 2, 3, 4].map(n => [n, 'C' + n + ' · ' + GBX_KW[n - 1] + ' kW'])) + '</div>';
    stats = [['Puissance max', nf(I.st.maxKW) + ' kW'], ['Agrément', Math.round(I.st.refine)], ['Rendement', Math.round(I.st.eff)], ['Fiabilité', Math.round(I.st.rel)], ['Coût unitaire', money(I.st.cost)]];
  }
  const pm = PARAMS[M.pk](spec), kw0 = M.pk === 'eng' ? (() => { const s0 = Object.assign({}, spec); delete s0.pw; delete s0.tune; return partInfo('eng', s0).st.kw; })() : 0, optsOf = (k, T) => Object.keys(T).map(o => [o, k === 'pw' ? Math.round(kw0 * +o * 1.36 / 5) * 5 + ' ch' + (o === '1' ? ' · référence' : '') : T[o][0]]);
  const adv0 = pm.map(([k, lbl, T, d]) => '<div class="f"><span>' + lbl + '</span>' + chips(k, M[k] == null || M[k] === '' ? d : M[k], optsOf(k, T)) + '</div>').join('');
  const adv = engConf(M, G, p, adv0).html;
  const eff = pm.map(([k, lbl, T, d]) => { const v = M[k] == null || M[k] === '' ? d : String(M[k]); return '<div class="row" style="font-size:12.5px;gap:8px"><b>' + esc(T[v] ? T[v][0] : v) + '</b><span class="muted grow" style="text-align:right">' + esc(fxText(T[v] ? T[v][1] : {})) + '</span></div>'; }).join('');
  const fr = specFrontier(M.pk, spec), tk = trKeysOf(M.pk, spec), cost0 = partInfo(M.pk, spec).dev, mois = Math.round(days / rdSpeed(p) / 30 * 10) / 10;
  const title = par ? 'Redesign · ' + esc(par.fname || par.name) + ' → G' + R.gen : 'Nouveau : ' + KIND_L[M.pk].toLowerCase();
  const note = par ? '<p class="muted" style="font-size:12.5px">Un redesign reprend la base de ' + esc(par.name) + ' : ' + Math.round(R.r * 100) + ' % du coût d\'un développement neuf (' + money(cost0) + ') et ' + Math.round((0.5 + 0.5 * R.r) * 100) + ' % de sa durée. La nouvelle génération gagne en maturité (fiabilité, coût de série). Tes modèles gardent l\'ancienne pièce tant qu\'ils ne passent pas en mise à jour mécanique.</p>' + (R.dif + R.dl === 0 ? '<p class="neg">Change au moins un paramètre ou monte le niveau technologique.</p>' : '') : '';
  if (!par) return partWizard({ M, G, p, spec, I, dev, days, same, sel, stats, pm, adv, eff, fr, tk, mois });
  return '<h2>' + title + '</h2>' + note + sel + techBlock(G, p, M, spec) + (adv ? '<p class="muted fnote" style="margin:6px 0 2px">Paramètres avancés</p>' + adv : '') +
    H.card(esc(I.name), H.kv(stats)) + (pm.length ? H.card('Effet de tes choix', eff) : '') + (tk.length ? H.card('Tendances du marché', '<p class="muted" style="font-size:12px;margin:0 0 6px">Demande pour ce type de pièce (100 % = niveau de départ). La flèche montre la direction récente ; tes principaux marchés sont détaillés.</p>' + trendLines(G, p, tk)) : '') +
    H.card('Projet', H.kv([['Budget', money(dev)], ['Durée', mois + ' mois (' + nf(rdSpeed(p), 2) + ' j/j)'], ['Par mois', money(dev / (days / 30))]]) + (fr ? '<p class="muted" style="font-size:12px">' + fr + '</p>' : '')) +
    H.btn((par ? 'Lancer le redesign · ' : 'Lancer · ') + money(dev) + ' · ' + mois + ' mois', 'startpart', {}, { cls: 'primary', off: same || p.cash < dev * 0.25, why: same ? (par ? 'Change au moins un paramètre.' : 'Cette pièce existe déjà.') : 'Trésorerie insuffisante.' });
}
function techBlock(G, p, M, spec) {   // choix de la maturité technologique : technologies nommées, sans numéro
  const av = techAvail(G, p), fr = techFront(G), par = M.from ? partOf(p, M.from) : null, lo = par ? Math.min(par.spec.lvl, av) : Math.max(1, av - 2), cur = clamp(+M.lvl, lo, av), nx = av < 8 ? av + 1 : 0, adv = p.adv || 0, canAdv = nx && adv < 2 && fr + adv < 8, cost = ADV_COST[adv + 1];
  const tag = n => n >= fr ? H.pill('pointe', 'good') : n === fr - 1 ? H.pill('moderne', 'info') : H.pill('éprouvée', '');
  const rows = []; for (let n = av; n >= lo; n--) { const r = techRow(M.pk, Object.assign({}, spec, { lvl: n })); rows.push('<button class="pcard' + (n === cur ? ' on' : '') + '" data-act="mset" data-k="lvl" data-v="' + n + '"><b>' + esc(r[0]) + ' ' + tag(n) + '</b><small class="muted">' + esc(r[1]) + '</small></button>'); }
  const lag = techLag(G, cur);
  return '<div class="f"><span>Technologie embarquée</span></div><div class="pcards">' + rows.join('') + '</div>' + (lag ? '<p class="neg fnote">Cette technologie est déjà dépassée : les modèles qui l\'utilisent paraîtront datés.</p>' : '<p class="muted fnote">Plus la technologie est récente, plus la pièce est performante, chère et longue à développer ; une technologie éprouvée est moins chère mais vieillit plus vite.</p>') +
    (nx ? '<p class="muted fnote" style="margin:6px 0">Prochaine : <b>' + esc(techRow(M.pk, Object.assign({}, spec, { lvl: nx }))[0]) + '</b> (marché mondial : ' + techYear(nx) + ').</p>' + (canAdv ? H.btn('Avance technologique · ' + money(cost), 'advtech', {}, { cls: 'small', off: p.cash < cost, why: 'Trésorerie insuffisante.' }) : '') : '');
}

/* ---- Assistant de création d'une pièce : on choisit la pièce, puis pas à pas, avec la compatibilité du catalogue ---- */

/* ---- Illustrations variées (pièces, usines) ---- */
function partArt(x) {
  const s = x.spec || {}, i = x.id || 0, pick = L => L[i % L.length];
  if (x.kind === 'eng') { if (s.fuel === 'elec') return pick(['pv-eng-6', 'part-eng-elec']); if (s.fuel === 'hyb') return pick(['pv-eng-4', 'part-eng-hyb']); if (s.fuel === 'die') return pick(['part-eng-die', 'pv-eng-2']); const cy = s.cyl || CDEF[(s.size || 1) - 1]; return cy >= 8 ? pick(['pv-eng-5', 'pv-eng-3']) : s.air ? pick(['pv-eng-2', 'pv-eng-5']) : cy >= 6 ? pick(['pv-eng-3', 'pv-eng-1']) : pick(['pv-eng-1', 'part-eng-ess']); }
  if (x.kind === 'chs') return s.focus === 'sport' ? pick(['pv-chs-4', 'part-chs-sport']) : s.focus === 'conf' ? pick(['pv-chs-2', 'pv-chs-5', 'part-chs-conf']) : pick(['pv-chs-1', 'pv-chs-6', 'pv-chs-3', 'part-chs-eq']);
  return s.type === 'man' ? pick(['pv-gbx-1', 'part-gbx-man']) : s.type === 'dct' ? pick(['pv-gbx-3', 'part-gbx-dct']) : s.type === 'red' ? pick(['pv-gbx-4', 'pv-gbx-6', 'part-gbx-red']) : pick(['pv-gbx-2', 'pv-gbx-5', 'part-gbx-auto']);
}
const kindArt = (p, k) => { const L = p.parts.filter(x => x.kind === k && !x.arch); return L.length ? partArt(L[L.length - 1]) : PK_INFO[k][2]; };
const facArt = f => 'iso-c' + [5, 6, 7, 9, 12, 11][((f.c || 'FR').charCodeAt(0) + (f.c || 'FR').charCodeAt(1) + (f.id || 0)) % 6];
const PK_INFO = { eng: ['Moteur', 'Il fournit la puissance. Il doit tenir dans un châssis et être encaissé par une boîte.', 'part-eng-ess'], chs: ['Châssis', 'Il fixe la taille, la masse, la tenue et la puissance maximale supportée.', 'part-chs-eq'], gbx: ['Boîte de vitesses', 'Elle transmet la puissance. Un moteur électrique exige un réducteur.', 'part-gbx-man'] };
const PLU = { eng: 'Moteurs', chs: 'Châssis', gbx: 'Boîtes' };
function compatInfo(p, kind, st, spec) {   // pièces du catalogue (et projets en cours) compatibles ou non avec la pièce en préparation
  const dv = x => x.proj ? '' : '', rows = [], add = (lbl, items) => rows.push([lbl, items]);
  const live = k => p.parts.filter(x => x.kind === k && !x.arch).map(x => ({ x, st: x.st, dev: 0 })).concat(p.proj.filter(x => x.kind === k).map(x => ({ x, st: partInfo(k, x.spec, x.gen).st, dev: 1 })));
  const test = (k, o) => {
    const sp = o.x.spec, t = o.st;
    if (kind === 'eng') { if (k === 'chs') return t.maxKW >= st.kw ? null : 'plafonné à ' + Math.round(t.maxKW) + ' kW'; if ((spec.fuel === 'elec') !== (sp.type === 'red')) return spec.fuel === 'elec' ? 'il faut un réducteur' : 'réducteur réservé à l\'électrique'; return t.maxKW >= st.kw ? null : 'plafonnée à ' + Math.round(t.maxKW) + ' kW'; }
    if (kind === 'chs') return st.maxKW >= t.kw ? null : 'moteur de ' + Math.round(t.kw) + ' kW (max ' + Math.round(st.maxKW) + ')';
    if ((t.kw == null)) return null; if ((sp.fuel === 'elec') !== (spec.type === 'red')) return sp.fuel === 'elec' ? 'a besoin d\'un réducteur' : 'moteur thermique : pas de réducteur'; return st.maxKW >= t.kw ? null : 'moteur de ' + Math.round(t.kw) + ' kW (max ' + Math.round(st.maxKW) + ')';
  };
  const others = kind === 'eng' ? ['chs', 'gbx'] : kind === 'chs' ? ['eng'] : ['eng'];
  const nm = (o) => esc(o.x.fname ? o.x.name.replace(/ · .*$/, '') + (o.x.gen > 1 ? '' : '') : o.x.name) + (o.dev ? ' <small class="muted">(en développement)</small>' : '');
  let h = '', okN = 0, allN = 0;
  for (const k of others) {
    const L = live(k).map(o => ({ o, why: test(k, o) })); if (!L.length) { h += '<h4 class="trh">' + PLU[k] + '</h4><p class="muted" style="font-size:12.5px;margin:2px 0 6px">Aucun dans ton catalogue.</p>'; continue; }
    const good = L.filter(r => !r.why), bad = L.filter(r => r.why); okN += good.length; allN += L.length;
    h += '<h4 class="trh">' + PLU[k] + ' · ' + good.length + ' / ' + L.length + ' compatibles</h4>' + good.slice(0, 5).map(r => '<div class="trl"><span class="pos">✓ ' + nm(r.o) + '</span><span class="tv muted">' + esc(r.o.x.name.split(' · ').slice(-1)[0]) + '</span></div>').join('') + (good.length > 5 ? '<p class="muted" style="font-size:12px;margin:2px 0">+ ' + (good.length - 5) + ' autres compatibles</p>' : '') + bad.slice(0, 4).map(r => '<div class="trl"><span class="neg">✗ ' + nm(r.o) + '</span><span class="tv muted">' + esc(r.why) + '</span></div>').join('') + (bad.length > 4 ? '<p class="muted" style="font-size:12px;margin:2px 0">+ ' + (bad.length - 4) + ' autres incompatibles</p>' : '');
  }
  if (kind === 'chs') { const bs = Object.keys(BODIES).filter(b => BODIES[b].size === spec.cls || BODIES[b].size === spec.cls - 1); h += '<h4 class="trh">Silhouettes possibles</h4><p style="font-size:13px;margin:2px 0 6px">' + bs.map(b => BODIES[b].n).join(' · ') + '</p>'; }
  const hint = !allN ? 'Rien dans ton catalogue ne pourra encore l\'accompagner : prévois aussi les autres pièces.' : okN === 0 ? 'Aucune pièce de ton catalogue ne sera compatible : change la puissance ou développe aussi le complément.' : okN + ' pièce' + (okN > 1 ? 's' : '') + ' du catalogue compatible' + (okN > 1 ? 's' : '') + ' sur ' + allN + '.';
  return H.card('Compatibilité avec ton catalogue', '<p class="' + (okN ? 'pos' : 'neg') + '" style="font-size:13px;margin:0 0 6px"><b>' + hint + '</b></p>' + h);
}
function partKindStep(M, G, p) {
  const cnt = k => p.parts.filter(x => x.kind === k && !x.arch).length, dev = k => p.proj.filter(x => x.kind === k).length, mn = Math.min(cnt('eng') + dev('eng'), cnt('chs') + dev('chs'), cnt('gbx') + dev('gbx')), rec = ['gbx', 'chs', 'eng'].find(k => cnt(k) + dev(k) === mn);
  return '<h2>Nouvelle pièce</h2><p class="muted" style="font-size:13px">Quelle pièce veux-tu développer ? Un modèle réunit un moteur, un châssis et une boîte compatibles ; je te montrerai à chaque étape ce qui va avec ton catalogue.</p><div class="kcards">' +
    ['eng', 'chs', 'gbx'].map(k => { const I = PK_INFO[k]; return '<button class="kcard" data-act="pkind" data-k="' + k + '"><span class="kimg">' + H.img(kindArt(p, k)) + '</span><span class="ktx"><b>' + I[0] + (k === rec ? ' <span class="pill good">conseillé</span>' : '') + '</b><small>' + I[1] + '</small><small class="kn">' + cnt(k) + ' en catalogue' + (dev(k) ? ' · ' + dev(k) + ' en développement' : '') + '</small></span></button>'; }).join('') + '</div>';
}
function partWizard(X) {
  const { M, G, p, spec, I, dev, days, same, sel, stats, pm, adv, eff, fr, tk, mois } = X;
  const steps = ['kind', 'base'].concat(pm.length || (M.pk === 'eng' && M.fuel !== 'elec') ? ['conf'] : []).concat(['tech', 'recap']), st = clamp(+M.pstep || 0, 0, steps.length - 1), key = steps[st], N = steps.length;
  const BASE_T = { eng: 'Énergie et taille', chs: 'Classe et réglage', gbx: 'Type et capacité' }, TT = { base: BASE_T[M.pk], conf: 'Configuration', tech: 'Technologie', recap: 'Récapitulatif' };
  const dots = '<div class="wdots">' + steps.map((n, i) => '<i class="' + (i < st ? 'done' : i === st ? 'cur' : '') + '"></i>').join('') + '</div>';
  const head = '<div class="whead"><button class="btn small ghost" data-act="pstep" data-v="' + (st - 1) + '">‹ Retour</button><small>Étape ' + (st + 1) + ' / ' + N + ' · ' + TT[key] + '</small></div>' + dots;
  const nxt = H.btn('Continuer', 'pstep', { v: st + 1 }, { cls: 'primary' }), cmp = compatInfo(p, M.pk, I.st, spec), live = H.card(esc(I.name), H.kv(stats));
  const title = '<h2>' + KIND_L[M.pk] + ' · ' + TT[key].toLowerCase() + '</h2>';
  if (key === 'base') return title + head + '<p class="muted fnote">' + PK_INFO[M.pk][1] + '</p>' + sel + live + cmp + nxt;
  if (key === 'tech') return title + head + techBlock(G, p, M, spec) + live + cmp + nxt;
  if (key === 'conf') return title + head + '<p class="muted fnote" style="margin:4px 0 2px">Chaque choix change les caractéristiques, le coût et la durée de développement : tu vois le résultat en direct.</p>' + adv + (pm.length ? H.card('Effet de tes choix', eff) : '') + (M.pk === 'eng' && M.fuel !== 'elec' && M.xp === '1' ? '' : live) + cmp + nxt;
  return title + head + live + cmp + (tk.length ? H.card('Tendances du marché', '<p class="muted" style="font-size:12px;margin:0 0 6px">Demande pour ce type de pièce (100 % = niveau de départ).</p>' + trendLines(G, p, tk)) : '') +
    H.card('Projet', H.kv([['Budget', money(dev)], ['Durée', mois + ' mois (' + nf(rdSpeed(p), 2) + ' j/j)'], ['Par mois', money(dev / (days / 30))]]) + (fr ? '<p class="muted" style="font-size:12px">' + fr + '</p>' : '')) +
    H.btn('Lancer · ' + money(dev) + ' · ' + mois + ' mois', 'startpart', {}, { cls: 'primary', off: same || p.cash < dev * 0.25, why: same ? 'Cette pièce existe déjà.' : 'Trésorerie insuffisante.' });
}
function specFrontier(kind, s) { return s.lvl >= 7 ? 'Technologie de pointe : coûteuse, mais elle restera compétitive plusieurs années.' : s.lvl <= 2 ? 'Niveau d\'entrée : peu cher, mais vieillira vite face à des clients de plus en plus exigeants.' : ''; }

/* =============================== ASSISTANT DE CRÉATION DE MODÈLE =============================== */
const PRE = { eco: { n: 'Économique', d: 'Coût minimal et prix bas : pour gagner des volumes.', fin: '1', sty: '0', pp: '0', camp: '0' }, eq: { n: 'Équilibré', d: 'Le meilleur rapport qualité / coût du marché.', fin: '2', sty: '0', pp: '1', camp: '1' }, prem: { n: 'Premium', d: 'Qualité maximale, finition soignée : marges élevées.', fin: '3', sty: '1', pp: '2', camp: '1' } };
const okPart = (p, M, k) => p.parts.filter(x => x.kind === k && !x.arch && (!x.lic || (x.lbr || 0) === (+M.br || 0)));
function pickParts(G, p, M, pre, fix) {   // meilleure combinaison moteur / châssis / boîte pour la silhouette, l'énergie et le positionnement
  fix = fix || {}; const es = okPart(p, M, 'eng').filter(x => !fix.eng || x.id == fix.eng), cs = okPart(p, M, 'chs').filter(x => !fix.chs || x.id == fix.chs), gs = okPart(p, M, 'gbx').filter(x => !fix.gbx || x.id == fix.gbx); if (!es.length || !cs.length || !gs.length) return null;
  const B = BODIES[M.body], sg = B.seg, F = +PRE[pre].fin, S = +PRE[pre].sty, ef = es.filter(x => x.spec.fuel === M.fuel), L = [];
  for (const e of (ef.length ? ef : es)) for (const c of cs) { if (c.spec.cls < B.size || c.spec.cls > B.size + 1 || e.st.kw > c.st.maxKW) continue;
    for (const g of gs) { if (compat(M.body, e, c, g)) continue; const C = calcModel(M.body, e, c, g, F, S); L.push({ e, c, g, C, q: quality(G, { st: C.st, fuel: e.spec.fuel, age: 0 }, sg) }); } }
  if (!L.length) return null; const mq = Math.max.apply(null, L.map(x => x.q)); let r;
  if (pre === 'prem') r = L.slice().sort((x, y) => y.q - x.q || x.C.cost - y.C.cost)[0];
  else if (pre === 'eco') r = L.filter(x => x.q >= 0.72 * mq).sort((x, y) => x.C.cost - y.C.cost)[0] || L[0];
  else r = L.slice().sort((x, y) => (y.q * y.q / y.C.cost) - (x.q * x.q / x.C.cost))[0];
  return r;
}
function autoParts(G, p, M) {
  const r = pickParts(G, p, M, M.pre || 'eq'), P = PRE[M.pre || 'eq']; M.fin = P.fin; M.sty = P.sty; M.pp = P.pp; M.camp = P.camp;
  if (r) { M.eng = r.e.id; M.chs = r.c.id; M.gbx = r.g.id; M.fuel = r.e.spec.fuel; }
}
function presetCard(G, p, M, k) {
  const r = pickParts(G, p, M, k), P = PRE[k]; if (!r) return '<div class="pcard off"><b>' + P.n + '</b><small>Aucune combinaison de pièces compatible pour cette silhouette.</small></div>';
  const F = +P.fin, S = +P.sty, pr = Math.round(suggestPrice(G, M.body, F, r.C.cost) * PPF[+P.pp] / 100) * 100;
  const E = estimate(G, p, { br: +M.br || 0, body: M.body, fuel: r.e.spec.fuel, st: r.C.st, cost: r.C.cost, price: pr, fin: F, age: 0, hype: 0.35 + HYPE[+P.camp], state: 'sale', hist: [] });
  return '<button class="pcard' + ((M.pre || 'eq') === k ? ' on' : '') + '" data-act="wpre" data-v="' + k + '"><b>' + P.n + '</b><small>' + P.d + '</small><div class="pk"><span>Prix<b>' + money(pr) + '</b></span><span>Coût<b>' + money(r.C.cost) + '</b></span><span>Qualité<b>×' + nf(r.q, 2) + '</b></span><span>Ventes<b>~' + nf(Math.round(E.units)) + '/m</b></span></div></button>';
}
const WSTEPS = ['Silhouette', 'Châssis', 'Moteur', 'Boîte', 'Finition', 'Lancement'], NST = WSTEPS.length;
const bodyOk = (B, c) => c.spec.cls >= B.size && c.spec.cls <= B.size + 1;
function candidates(p, M, k) {      // pièces proposées à chaque étape : seulement celles compatibles avec les choix précédents
  const B = BODIES[M.body], c = partOf(p, M.chs), e = partOf(p, M.eng);
  if (k === 'chs') return okPart(p, M, 'chs').filter(x => bodyOk(B, x));
  if (k === 'eng') return c ? okPart(p, M, 'eng').filter(x => x.st.kw <= c.st.maxKW) : [];
  return c && e ? okPart(p, M, 'gbx').filter(g => !compat(M.body, e, c, g)) : [];
}
function repair(G, p, M, from) {    // après un choix, garde une configuration cohérente en réajustant les pièces suivantes
  const pre = M.pre || 'eq'; let e = partOf(p, M.eng), c = partOf(p, M.chs), g = partOf(p, M.gbx);
  if (from === 'chs' && !(e && c && e.st.kw <= c.st.maxKW)) { const r = pickParts(G, p, M, pre, { chs: M.chs }); if (r) { M.eng = r.e.id; M.fuel = r.e.spec.fuel; e = r.e; } }
  if (!(e && c && g && !compat(M.body, e, c, g))) { const r = pickParts(G, p, M, pre, { chs: M.chs, eng: M.eng }); if (r) M.gbx = r.g.id; }
}
function autoProposal(G, p, M, pre) {   // la meilleure silhouette + pièces + finition pour ce positionnement
  let best = null; const P = PRE[pre], F = +P.fin;
  for (const k of bodyKeys(G)) { const m2 = { body: k, fuel: M.fuel, br: M.br }, r = pickParts(G, p, m2, pre); if (!r) continue;
    const pr = Math.round(suggestPrice(G, k, F, r.C.cost) * PPF[+P.pp] / 100) * 100, E = estimate(G, p, { br: +M.br || 0, body: k, fuel: r.e.spec.fuel, st: r.C.st, cost: r.C.cost, price: pr, fin: F, age: 0, hype: 0.35 + HYPE[+P.camp], state: 'sale', hist: [] }), sc = E.units * Math.max(1, pr * (1 - DEALER_MARGIN) - r.C.cost);
    if (!best || sc > best.sc) best = { k, r, pr, E, sc }; }
  return best;
}
function partCard(k, x, sel, rec) {
  const st = x.st, S = k === 'chs' ? [['Masse', nf(st.kg) + ' kg'], ['Puiss. max', nf(st.maxKW) + ' kW'], ['Conf./Tenue', Math.round(st.comfort) + '/' + Math.round(st.handling)], ['Coût', money(st.cost)]]
    : k === 'eng' ? [['Puissance', nf(st.kw) + ' kW'], ['Fiabilité', Math.round(st.rel)], ['CO2', nf(st.co2) + ' g'], ['Coût', money(st.cost)]]
    : [['Type', GBX[x.spec.type].n.split(' ')[0]], ['Max', nf(st.maxKW) + ' kW'], ['Agrément', Math.round(st.refine)], ['Coût', money(st.cost)]];
  return '<button class="pcard' + (sel ? ' on' : '') + '" data-act="wpart" data-k="' + k + '" data-id="' + x.id + '"><b>' + esc(x.name) + (rec ? ' <span class="pill good">conseillé</span>' : '') + (x.lic ? ' <span class="pill info">licence</span>' : '') + '</b><div class="pk">' + S.map(a => '<span>' + a[0] + '<b>' + a[1] + '</b></span>').join('') + '</div></button>';
}
function wsum(M, G, p, e, c, g, why) {
  const nm = (x, k) => x ? '<b>' + esc(x.name) + '</b>' : '<span class="muted">—</span>', C = !why && e && c && g ? calcModel(M.body, e, c, g, +M.fin, +M.sty) : null;
  return '<div class="wsum"><span>' + BODIES[M.body].n + '</span> · ' + nm(c) + ' · ' + nm(e) + ' · ' + nm(g) + (C ? '<br><small class="muted">Coût unitaire ' + money(C.cost) + ' · ' + nf(C.st.kw) + ' kW · ' + nf(C.st.kg) + ' kg · ' + nf(C.st.co2) + ' g/km</small>' : '') + '</div>';
}
function modalDesign(M, G, p) {
  const st = +M.step || 0, dots = '<div class="wdots">' + WSTEPS.map((n, i) => '<i class="' + (i < st ? 'done' : i === st ? 'cur' : '') + '"></i>').join('') + '</div>';
  const head = '<div class="whead">' + (st > 0 ? '<button class="btn small ghost" data-act="wstep" data-v="' + (st - 1) + '">‹ Retour</button>' : '<span></span>') + '<small>Étape ' + (st + 1) + ' / ' + NST + ' · ' + WSTEPS[st] + '</small></div>' + dots;
  const e = partOf(p, M.eng), c = partOf(p, M.chs), g = partOf(p, M.gbx), why = compat(M.body, e, c, g), F = +M.fin, S = +M.sty, pre = M.pre || 'eq';
  const noPart = k => !okPart(p, M, k).length, missing = noPart('eng') || noPart('chs') || noPart('gbx');
  const next = (lbl, off, whyoff) => H.btn(lbl, 'wstep', { v: st + 1 }, { cls: 'primary', off, why: whyoff });
  if (st === 0) {
    const fuels = Array.from(new Set(okPart(p, M, 'eng').map(x => x.spec.fuel))), A = missing ? null : autoProposal(G, p, M, pre);
    const auto = !A ? '' : '<div class="autoc"><div class="atop"><b>✨ Configuration automatique</b><small>L\'assistant choisit la silhouette, le châssis, le moteur, la boîte et la finition les plus rentables.</small></div><div class="f"><span>Style visé</span>' + H.chips('wpre', 'x', pre, Object.keys(PRE).map(k => [k, PRE[k].n])) + '</div>' +
      '<div class="aprop"><div class="aimg">' + (H.img('body-' + A.k + '-1') || H.img('body-' + A.k)) + '</div><div><b>' + BODIES[A.k].n + ' · ' + FUELS[A.r.e.spec.fuel].n + '</b><small class="muted">' + esc(A.r.c.name) + ' · ' + esc(A.r.e.name) + ' · ' + esc(A.r.g.name) + '</small></div></div>' +
      '<div class="pk"><span>Prix<b>' + money(A.pr) + '</b></span><span>Coût<b>' + money(A.r.C.cost) + '</b></span><span>Qualité<b>×' + nf(A.r.q, 2) + '</b></span><span>Ventes<b>~' + nf(Math.round(A.E.units)) + '/m</b></span></div>' +
      H.btn('Utiliser cette configuration', 'wauto', { b: A.k }, { cls: 'primary' }) + '</div>';
    return '<h2>Quel type de voiture ?</h2>' + head + (fuels.length > 1 ? '<div class="f"><span>Énergie</span>' + H.chips('wfuel', 'x', M.fuel, fuels.map(f => [f, FUELS[f].n])) + '</div>' : '') + auto + '<p class="muted fnote" style="margin:10px 0 6px">Ou choisis toi-même, pas à pas :</p><div class="bodies">' + bodyKeys(G).map(k => { const B = BODIES[k], I = devInfo(k, 1, 0), im = H.img('body-' + k + '-1') || H.img('body-' + k);
      const ok = !!pickParts(G, p, { body: k, fuel: M.fuel, br: M.br }, 'eq');
      return '<button class="bcard' + (M.body === k ? ' on' : '') + (ok ? '' : ' lock') + '" data-act="wbody" data-b="' + k + '"><span class="bimg">' + im + '</span><b>' + B.n + '</b><small>' + SEG[B.seg] + ' · dev. ' + money(I.dev) + (ok ? '' : ' · pièces à développer') + '</small></button>'; }).join('') + '</div>' + (Object.keys(BODIES).some(k => !pickParts(G, p, { body: k, fuel: M.fuel, br: M.br }, 'eq')) ? '<p class="muted fnote">Les silhouettes grisées demandent un châssis ou un moteur que tu n\'as pas encore : développe-les dans l\'onglet Pièces.</p>' : '');
  }
  if (missing) return '<h2>Il te manque des pièces</h2>' + head + '<p class="neg">Un modèle a besoin d\'un moteur, d\'un châssis et d\'une boîte. Développe-les d\'abord.</p>' + H.btn('Aller aux pièces', 'goto', { tab: 'pieces' }, { cls: 'primary' });
  const toParts = msg => '<p class="neg">' + msg + '</p>' + H.btn('Aller aux pièces', 'goto', { tab: 'pieces' }, { cls: 'primary' });
  const list = (k, lst, rec, hidden) => '<div class="pcards">' + lst.map(x => partCard(k, x, M[k] == x.id, rec && rec.id === x.id)).join('') + '</div>' + (hidden > 0 ? '<p class="muted fnote">' + hidden + ' autre' + (hidden > 1 ? 's' : '') + ' pièce' + (hidden > 1 ? 's' : '') + ' exclue' + (hidden > 1 ? 's' : '') + ' car incompatible' + (hidden > 1 ? 's' : '') + ' avec ton choix.</p>' : '');
  if (st === 1) {
    const L = candidates(p, M, 'chs').filter(x => pickParts(G, p, M, pre, { chs: x.id })), rec = pickParts(G, p, M, pre);
    if (!L.length) return '<h2>Quel châssis ?</h2>' + head + toParts('Aucun châssis de classe ' + BODIES[M.body].size + ' ou ' + (BODIES[M.body].size + 1) + ' (compatible avec un moteur et une boîte que tu possèdes) pour cette silhouette.');
    return '<h2>Quel châssis ?</h2>' + head + '<p class="muted fnote">Le châssis fixe la taille, la masse, la tenue de route et la puissance maximale supportée. Seuls les châssis adaptés à la silhouette sont proposés.</p>' + list('chs', L, rec && rec.c, okPart(p, M, 'chs').length - L.length) + wsum(M, G, p, e, c, g, why) + next('Continuer', !c || !L.includes(c), 'Choisis un châssis.');
  }
  if (st === 2) {
    const fuels = Array.from(new Set(candidates(p, M, 'eng').map(x => x.spec.fuel))), all = candidates(p, M, 'eng'), L = all.filter(x => !M.fuel || fuels.length < 2 || x.spec.fuel === M.fuel), rec = pickParts(G, p, M, pre, { chs: M.chs });
    if (!c) return '<h2>Quel moteur ?</h2>' + head + toParts('Choisis d\'abord un châssis.');
    if (!all.length) return '<h2>Quel moteur ?</h2>' + head + toParts('Aucun de tes moteurs n\'est compatible avec ce châssis (puissance maximale ' + Math.round(c.st.maxKW) + ' kW).');
    return '<h2>Quel moteur ?</h2>' + head + '<p class="muted fnote">Moteurs compatibles avec ce châssis (puissance max. ' + Math.round(c.st.maxKW) + ' kW).</p>' + (fuels.length > 1 ? '<div class="f"><span>Énergie</span>' + H.chips('wfuel', 'x', M.fuel, fuels.map(f => [f, FUELS[f].n])) + '</div>' : '') + list('eng', L, rec && rec.e, okPart(p, M, 'eng').length - all.length) + wsum(M, G, p, e, c, g, why) + next('Continuer', !e || !L.includes(e), 'Choisis un moteur.');
  }
  if (st === 3) {
    const L = candidates(p, M, 'gbx'), rec = pickParts(G, p, M, pre, { chs: M.chs, eng: M.eng });
    if (!e) return '<h2>Quelle boîte ?</h2>' + head + toParts('Choisis d\'abord un moteur.');
    if (!L.length) return '<h2>Quelle boîte ?</h2>' + head + toParts('Aucune boîte compatible avec ce moteur (' + Math.round(e.st.kw) + ' kW' + (e.spec.fuel === 'elec' ? ', réducteur électrique requis' : '') + ').');
    return '<h2>Quelle boîte de vitesses ?</h2>' + head + '<p class="muted fnote">Boîtes capables d\'encaisser ce moteur' + (e.spec.fuel === 'elec' ? ' (un moteur électrique exige un réducteur)' : '') + '.</p>' + list('gbx', L, rec && rec.g, okPart(p, M, 'gbx').length - L.length) + wsum(M, G, p, e, c, g, why) + next('Continuer', !g || !L.includes(g), 'Choisis une boîte.');
  }
  if (st === 4) {
    return '<h2>Finition et lancement</h2>' + head + wsum(M, G, p, e, c, g, why) + '<div class="f"><span>Nom du modèle</span>' + H.text('mname', { ph: BODIES[M.body].n + ' ' + NAMES[G.nid % NAMES.length] + ' (nom libre)', max: 24 }) + '</div>' +
      (brandsOf(p).length > 1 ? '<div class="f"><span>Marque</span>' + H.chips('wbr', 'x', String(M.br), brandsOf(p).map(b => [String(b.bid || 0), b.name])) + '</div>' : '') +
      '<div class="f"><span>Réglages rapides</span>' + H.chips('wfin', 'x', '', Object.keys(PRE).map(k => [k, PRE[k].n])) + '</div>' +
      '<div class="f"><span>Finition</span>' + chips('fin', M.fin, FINISH.map((n, i) => [i + 1, n])) + '</div><div class="f"><span>Style</span>' + chips('sty', M.sty, STYLING.map((n, i) => [i, n + (STY_COST[i] ? ' (+' + STY_COST[i] + ' M€)' : '')])) + '</div>' +
      '<div class="f"><span>Positionnement prix</span>' + chips('pp', M.pp, PP_L.map((n, i) => [i, n])) + '</div><div class="f"><span>Lancement commercial</span>' + chips('camp', M.camp, CAMP_L.map((n, i) => [i, n])) + '</div>' +
      (why ? '<p class="neg">' + esc(why) + '</p>' : '') + next('Voir le récapitulatif', !!why, why);
  }
  const I = devInfo(M.body, F, S); let summary = '';
  if (!why) {
    const C = calcModel(M.body, e, c, g, F, S), A = Object.assign({}, C.st, { economy: clamp(100 - (e.spec.fuel === 'elec' ? 55 * G.game.elec : C.st.co2 * G.game.fuel) * 0.5, 5, 100) }), sg = BODIES[M.body].seg, W = SEG_W[sg], q = Object.keys(W).reduce((s, k) => s + W[k] * A[k], 0) / bar(G);
    summary = H.card('Aperçu : ' + BODIES[M.body].n + ' · ' + FUELS[e.spec.fuel].n, attrBars(A) + H.kv([['Indice de qualité (segment)', nf(q, 2) + (q >= 1 ? ' · au-dessus du marché' : ' · en dessous du marché'), q >= 1 ? 'pos' : 'neg'], ['Coût unitaire', money(C.cost)], ['Prix conseillé', money(suggestPrice(G, M.body, F, C.cost))], ['CO2', nf(C.st.co2) + ' g/km'], ['Masse', nf(C.st.kg) + ' kg']]));
  }
  return '<h2>Récapitulatif</h2>' + head + '<div class="chips" style="margin-bottom:8px">' + ['Silhouette', 'Châssis', 'Moteur', 'Boîte', 'Finition'].map((n, i) => '<button class="chip" data-act="wstep" data-v="' + i + '">' + n + ' ✎</button>').join('') + '</div>' + (why ? '<p class="neg">' + esc(why) + '</p>' : summary) + cahier(M, G, p, e, c, g, why, F, S, I) +
    H.card('Projet', H.kv([['Budget de développement', money(I.dev)], ['Durée', Math.round(I.days / rdSpeed(p) / 30 * 10) / 10 + ' mois']])) +
    H.btn('Lancer · ' + money(I.dev) + (M._est ? ' · ~' + nf(M._est) + ' véh./mois' : ''), 'startmodel', {}, { cls: 'primary', off: !!why || p.cash < I.dev * 0.2, why: why || 'Trésorerie insuffisante.' });
}

function cahier(M, G, p, e, c, g, why, F, S, I) {
  M._est = null;
  const opts = '<div class="f"><span>Positionnement prix</span>' + chips('pp', M.pp, PP_L.map((n, i) => [i, n])) + '</div><div class="f"><span>Lancement commercial</span>' + chips('camp', M.camp, CAMP_L.map((n, i) => [i, n])) + '</div>';
  if (why) return H.card('Cahier des charges', opts);
  const C2 = calcModel(M.body, e, c, g, F, S), pr = Math.round(suggestPrice(G, M.body, F, C2.cost) * PPF[+M.pp] / 100) * 100, cp = +M.camp;
  const hypo = { br: +M.br || 0, body: M.body, fuel: e.spec.fuel, st: C2.st, cost: C2.cost, price: pr, fin: F, age: 0, hype: 0.35 + HYPE[cp], state: 'sale', hist: [] };
  const E = estimate(G, p, hypo); M._est = Math.round(E.units); const unit = pr * (1 - DEALER_MARGIN) - C2.cost * (0.8 + 0.2 * labIdx(p, G)) * (1 + (battIdx(p, G) - 1) * (BATT_SH[e.spec.fuel] || 0)) - pr * 0.03, mm = E.units * 0.7 * unit;
  const pay = mm > 0 ? (I.dev + CAMP[cp]) / mm : 0;
  return H.card('Cahier des charges', opts + H.kv([['Prix catalogue', money(pr)], ['Ventes estimées au lancement', nf(Math.round(E.units)) + ' véh./mois'], ['Ventes estimées en régime', nf(Math.round(E.units * 0.7)) + ' véh./mois'],
    ['Marge par véhicule', money(unit), TE.cls(unit)], ['Retour sur investissement', mm > 0 ? nf(pay / 12, 1) + ' an(s)' : 'jamais à ce prix', mm > 0 && pay < 60 ? 'pos' : 'neg']]) +
    '<p class="muted" style="font-size:12px">Principaux pays : ' + (E.rows.slice(0, 3).filter(r => r[1] > 0).map(r => COUNTRIES[r[0]].n + ' (' + nf(Math.round(r[1])) + ')').join(', ') || 'aucun : développe ton réseau') + '. Estimation sur le marché et les rivales d\'aujourd\'hui, avant vieillissement.</p>');
}
function modalFact(M, G, p) {
  const cap = TE.amtVal('fcap', 5000), cost = factCost(M.c, cap), C = COUNTRIES[M.c];
  return '<h2>Nouvelle usine</h2><div class="f"><span>Région</span>' + H.chips('fregion', 'r', M.r || C.reg, REGK.map(r => [r, REGL[r][0]])) + '</div><div class="f"><span>Pays</span>' + chips('c', M.c, CK.filter(k => COUNTRIES[k].reg === (M.r || C.reg)).sort((x, y) => COUNTRIES[y].vol - COUNTRIES[x].vol).map(k => [k, C0(k)])) + '</div>' +
    H.card(esc(C.n), H.kv([['Coût du travail', 'indice ' + nf(C.lab, 2)], ['Droits de douane évités', COUNTRIES[M.c].zone === 'EU' ? 'France, Allemagne, Italie, Espagne' : COUNTRIES[M.c].n + ' (' + TE.pct(tariffOf(M.c)) + ')']])) +
    H.amt({ k: 'fcap', min: 1000, max: 30000, step: 1000, def: 5000, fmt: v => nf(v) + ' véh./mois · ' + money(factCost(M.c, v)), lbl: 'Capacité' }) +
    H.card('Investissement', H.kv([['Coût', money(cost)], ['Construction', '9 mois'], ['Frais fixes', money(cap * 120 * (0.7 + 0.3 * C.lab)) + '/mois']].concat((() => { const sv = factSaving(G, p, M.c); return sv > 0 ? [['Économie estimée (douanes, transport)', money(sv) + '/mois', 'pos'], ['Retour sur investissement', cost / sv > 120 ? 'plus de 10 ans' : nf(Math.max(1, Math.round(cost / sv))) + ' mois']] : []; })()))) +
    H.btn('Construire pour ' + money(cost), 'startfact', {}, { cls: 'primary', off: p.cash < cost, why: 'Trésorerie insuffisante.' });
}
const C0 = k => COUNTRIES[k].n;

/* =============================== IMPACT ESTIMÉ =============================== */
const unitGain = (a, G, m, c, b) => {   // marge d'un véhicule vendu dans le pays c (hors frais fixes)
  const pr = effPrice(m), part = b.cty[c].partner, imp = !localIn(a, c), cn = costNow(a, G, m) * (0.8 + 0.2 * labIdx(a, G));
  return pr * (1 - DEALER_MARGIN) * 0.94 - pr * 0.03 * (100 - m.st.rel) / 50 - (imp ? pr * 0.7 * tariffOf(c) * (part ? 0.5 : 1) + 650 : 150) - (part ? pr * 0.04 : 0) - cn;
};
function cSim(G, a, b, c, ov) {   // ventes mensuelles et marge de la marque b dans le pays c, avec des réglages hypothétiques
  const x = b.cty[c], sv = [x.dealers, x.aware, x.partner];
  if (ov) { if (ov.dealers != null) x.dealers = ov.dealers; if (ov.aware != null) x.aware = ov.aware; if (ov.partner != null) x.partner = ov.partner; }
  let u = 0, k = 0;
  try {
    if (x.dealers > 0) {
      const C = COUNTRIES[c], mine = [];
      for (const s in SEG) {
        const Dem = C.vol / 12 * C.taste[s] * G.game.econ * TE.modFactor('demande', c), ref = refPrice(G, s, c), ents = [];
        for (const r of live(G)) for (const m of r.models) { if (m.state !== 'sale' || body(m).seg !== s || !brOf(r, m).cty[c].dealers) continue; const e = mkEntry(G, r, m, c, s); ents.push(e); if (r === a && brOf(r, m) === b) mine.push(e); }
        ents.push({ other: true, price: ref, quality: 1, weight: G.game.othW[c], cap: Infinity });
        TE.splitMarket(Dem, ents, { priceSens: 2.6, qualSens: 2.2, refPrice: ref });
      }
      u = TE.sum(mine.map(e => e.sold)); const cap = x.dealers * DEALER_CAP, f = u > cap ? cap / u : 1; u *= f;
      k = TE.sum(mine.map(e => e.sold * f * unitGain(a, G, e.m, c, b)));
    }
  } finally { x.dealers = sv[0]; x.aware = sv[1]; x.partner = sv[2]; }
  return { u, k };
}
function impact(G, p, b, c, ov, up, fee, hz) {
  const base = cSim(G, p, b, c), now = cSim(G, p, b, c, ov), du = (now.u - base.u) * (hz || 1), dk = (now.k - base.k) * (hz || 1) - (fee || 0);
  return { du, dk, up, pay: dk > 0 ? up / dk : null, base: base.u };
}
const dealImpact = (G, p, b, c, n) => impact(G, p, b, c, { dealers: b.cty[c].dealers + n }, n * dealerCost(b, c), n * DEALER_MONTH);
const campImpact = (G, p, b, c, t) => { const x = b.cty[c]; return impact(G, p, b, c, { aware: clamp(x.aware + t.gain * (1 - x.aware / 110), 0, 100) }, campCost(c, t), 0, 0.75); };
const partImpact = (G, p, b, c) => impact(G, p, b, c, { partner: true }, partnerCost(c), 0);
const impU = i => (i.du >= 0.5 ? '+' + nf(Math.round(i.du)) : '±0') + ' véh./m';
const impPay = i => i.pay == null ? 'non rentable' : i.pay > 120 ? 'plus de 10 ans' : nf(Math.max(1, Math.round(i.pay))) + ' mois';
const impCls = i => i.pay == null ? 'neg' : i.pay <= 24 ? 'pos' : i.pay <= 48 ? '' : 'neg';
function factSaving(G, p, c) {   // économie mensuelle (douanes, transport) d'une usine dans la zone du pays c, sur les ventes actuelles
  const z = COUNTRIES[c].zone; if (localIn(p, c)) return 0; let s = 0;
  for (const m of p.models) for (const k in (m.cs || {})) { if (COUNTRIES[k].zone !== z || localIn(p, k)) continue; const part = brOf(p, m).cty[k].partner; s += m.cs[k] * (effPrice(m) * 0.7 * tariffOf(k) * (part ? 0.5 : 1) + 500); }
  return s;
}

/* =============================== À FAIRE =============================== */
const dAttr = d => Object.keys(d || {}).map(k => ' data-' + k + '="' + esc(d[k]) + '"').join('');
function todoList(G, p) {
  const key = [G.day, G.mut, Math.round(p.cash / 1e6), dealersTotal(p), p.models.length, p.fact.length, p.models.filter(m => m.disc > 0).length].join('|');
  if (DEF._td && DEF._td.k === key) return DEF._td.v;
  const T = [], b = selB(p), mk = (tone, ico, t, label, act, data, sub) => T.push({ tone, ico, t, label, act, data: data || {}, sub });
  const lab = 0.8 + 0.2 * labIdx(p, G);
  for (const m of p.models) if (m.state === 'sale' && m.sold > 0 && effPrice(m) * (1 - DEALER_MARGIN) < costNow(p, G, m) * lab) { mk('bad', 'alerte', esc(m.name) + ' est vendu à perte', 'Corriger le prix', 'fixprice', { m: m.id }); break; }
  const by = banYears(G); if (by <= 6 && by > 0 && !p.models.some(m => (m.fuel === 'elec' || m.fuel === 'hyb') && m.state !== 'end')) mk('bad', 'electrique', 'Fin des ventes thermiques en Europe dans ' + nf(by, 1) + ' an(s) : il te faut un hybride ou un électrique', 'Créer le modèle', 'newmodel', { body: 'comp', fuel: 'elec' });
  if (p.mo && p.mo.demand && p.mo.demand - p.mo.units > 0.04 * p.mo.demand) { const lost = Math.round(p.mo.demand - p.mo.units), sat = (p.util || 0) > 0.93; mk('warn', sat ? 'usines' : 'stocks', sat ? 'Usines saturées : ' + nf(lost) + ' ventes perdues ce mois-ci' : nf(lost) + ' ventes perdues : stocks trop justes', sat ? 'Voir les usines' : 'Voir les stocks', 'goto', { tab: sat ? 'usines' : 'stocks' }); }
  { const su = stockU(p), mu = TE.sum(p.unitsH.slice(-3)) / Math.max(1, p.unitsH.slice(-3).length);
    if (mu > 0 && su / mu > 4) { const m = p.models.filter(x => x.state === 'sale' && !(x.discLeft > 0)).sort((x, y) => (y.stock || 0) / Math.max(1, y.fc || 1) - (x.stock || 0) / Math.max(1, x.fc || 1))[0]; if (m) mk('warn', 'stocks', 'Stock élevé : ' + nf(su / mu, 1) + ' mois de ventes. Surtout ' + esc(m.name), 'Promotion −8 % · 3 mois', 'promo', { m: m.id, v: 0.08 }); } }
  for (const m of p.models) if (m.state === 'sale' && m.age >= 36 && !p.models.some(x => x.state === 'dev' && body(x).seg === body(m).seg)) { mk('warn', 'gamme', esc(m.name) + ' vieillit (' + m.age + ' mois) et n\'a pas de successeur', 'Préparer le successeur', 'newmodel', { body: m.body, fuel: m.fuel }); break; }
  // meilleures occasions de réseau
  const cand = CK.filter(c => !isBanned(c, G)).map(c => ({ c, s: ctyStat(G, p, b, c) })).sort((x, y) => y.s.score - x.s.score).slice(0, 8), opp = [];
  for (const o of cand) { const n = o.s.on ? 50 : 10, i = dealImpact(G, p, b, o.c, n); if (i.pay != null && i.pay <= 36 && i.up <= p.cash * 0.5 && i.du >= 5) opp.push({ c: o.c, n, i }); }
  opp.sort((x, y) => x.i.pay - y.i.pay); for (const o of opp.slice(0, 2)) mk('go', 'pays', 'Ouvrir ' + o.n + ' concessions : ' + esc(COUNTRIES[o.c].n), 'Voir la fiche', 'fiche', { c: o.c, t: 'reseau' }, impU(o.i) + ' · rentable en ' + impPay(o.i));
  if (brandsOf(p).some(x => !x.pos)) mk('info', 'marque', 'Choisis un positionnement pour chaque marque', 'Ouvrir', 'goto', { tab: 'marque' });
  if (!AU(G).on && G.day > 360 && p.cash > 150e6) mk('info', 'reglages', 'Beaucoup de gestion à la main : l\'autopilote peut s\'occuper du réseau et des stocks', 'Configurer', 'goto', { tab: 'autopilote' });
  const R = { bad: 0, warn: 1, go: 2, info: 3 }; T.sort((x, y) => R[x.tone] - R[y.tone]);
  DEF._td = { k: key, v: T.slice(0, 5) }; return DEF._td.v;
}
function todoCard(G, p, n) {
  const T = todoList(G, p).slice(0, n || 5);
  return '<section class="todo"><div class="todoh"><h3>À faire</h3>' + (G.game.bilan ? '<button class="linkbtn" data-act="openbilan">Dernier bilan</button>' : '') + '</div>' +
    (T.length ? T.map(t => '<button class="tdo ' + t.tone + '" data-act="' + t.act + '"' + dAttr(t.data) + '><span class="ti">' + H.ico(t.ico) + '</span><span class="tt">' + t.t + (t.sub ? '<small>' + t.sub + '</small>' : '') + '</span><span class="tg">' + t.label + '</span></button>').join('') : '<p class="muted" style="margin:6px 0 2px">Rien d\'urgent : ton entreprise tourne bien.</p>') + '</section>';
}

/* =============================== AUTOPILOTE =============================== */
const AUTO_DEF = { on: false, keep: 0.4, rules: { aware: { on: true, min: 45 }, net: { on: true, pay: 30 }, price: { on: true }, stock: { on: true } }, log: [] };
const AU = G => { const g = G.game; if (!g.auto) g.auto = JSON.parse(JSON.stringify(AUTO_DEF)); return g.auto; };
function autopilot(G, p) {
  const A = AU(G); if (!A.on || p.bankrupt || p.cash <= 0) return;
  const L = [], say = t => { L.push(t); }, R = A.rules; let budget = Math.max(0, p.cash * (1 - A.keep)) * 0.3, spent = 0;
  const buy = (cost, cat) => { if (spent + cost > budget) return false; spent += cost; TE.spend(p, cat, cost); return true; };
  const lab = 0.8 + 0.2 * labIdx(p, G);
  if (R.price.on) for (const m of p.models) if (m.state === 'sale' && m.sold > 0 && effPrice(m) * (1 - DEALER_MARGIN) < costNow(p, G, m) * lab) { const np = Math.round(Math.max(suggestPrice(G, m.body, m.fin, m.cost), costNow(p, G, m) * lab * 1.2 / (1 - DEALER_MARGIN)) / 100) * 100; if (np > m.price) { m.price = np; say('Prix de ' + m.name + ' relevé à ' + money(np) + ' (il était vendu à perte).'); } }
  if (R.stock.on) for (const m of p.models) if (m.state === 'sale') {
    const dm = m.sold + (m.lost || 0), cur = stockOf(p, m);
    if ((m.lost || 0) > 0.04 * dm && cur < 3) { const nx = STOCK_OPTS.find(v => v > cur); if (nx) { m.stT = nx; say('Stock visé de ' + m.name + ' porté à ' + STOCK_L[STOCK_OPTS.indexOf(nx)] + ' mois (ventes perdues).'); } }
    else if (m.fc > 0 && (m.stock || 0) / m.fc > 4 && !(m.discLeft > 0)) { m.disc = 0.05; m.discLeft = 3; say('Promotion de 5 % sur ' + m.name + ' (sur-stock).'); }
  }
  const brs = brandsOf(p);
  if (R.aware.on) { let n = 0; for (const b of brs) for (const c of CK.slice().sort((x, y) => COUNTRIES[y].vol - COUNTRIES[x].vol)) { const x = b.cty[c]; if (n >= 4) break; if (x.dealers >= 5 && x.aware < R.aware.min) { const t = CAMPS[0], cost = campCost(c, t); if (buy(cost, 'marketing')) { applyCamp(b, c, t, 1); n++; say(t.n + ' en ' + COUNTRIES[c].n + ' (notoriété ' + Math.round(x.aware) + ' → ' + Math.round(b.cty[c].aware) + ').'); } } } }
  if (R.net.on) {
    const opts = []; for (const b of brs) { const cand = CK.filter(c => !isBanned(c, G)).map(c => ({ c, s: ctyStat(G, p, b, c) })).sort((x, y) => y.s.score - x.s.score).slice(0, 25);
      for (const o of cand) { const n = o.s.on ? 50 : 10, i = dealImpact(G, p, b, o.c, n); if (i.pay != null && i.pay <= R.net.pay && i.du >= 5) opts.push({ b, c: o.c, n, i }); } }
    opts.sort((x, y) => x.i.pay - y.i.pay); let k = 0;
    for (const o of opts) { if (k >= 3) break; const cost = o.n * dealerCost(o.b, o.c); if (buy(cost, 'réseau')) { o.b.cty[o.c].dealers += o.n; k++; say(o.n + ' concessions en ' + COUNTRIES[o.c].n + ' (' + impU(o.i) + ', rentable en ' + impPay(o.i) + ').'); } }
  }
  if (L.length) { A.log = L.map(t => ({ day: G.day, t })).concat(A.log).slice(0, 30); G.game.autoM = (G.game.autoM || []).concat(L); TE.news('Autopilote : ' + L.length + ' décision(s) ce mois-ci (' + money(spent) + ').', 'info'); }
}

/* =============================== BILAN DU MOIS =============================== */
function makeBilan(G) {
  const p = TE.player(), g = G.game; if (!p || p.bankrupt || !p.mo || !p.last) return;
  const prev = g.bilan, cty = Object.entries(p.mo.ctyU || {}).sort((x, y) => y[1] - x[1])[0], best = p.models.filter(m => m.sold > 0).sort((x, y) => y.sold - x.sold)[0];
  const rk = 1 + TE.rivals().filter(r => TE.sum(r.u12) > TE.sum(p.u12)).length, pd = prev ? prev.day : 0;
  g.bilan = { day: G.day, units: p.mo.units, prevU: prev ? prev.units : null, profit: Math.round(p.last.profit), prevP: prev ? prev.profit : null, cash: Math.round(p.cash), prevCash: prev ? prev.cash : null,
    share: p.gshare || 0, prevShare: prev ? prev.share : null, rank: rk, prevRank: prev ? prev.rank : null, best: best ? [best.name, best.sold] : null, cty: cty ? [cty[0], cty[1]] : null,
    lost: Math.max(0, Math.round((p.mo.demand || 0) - p.mo.units)), ev: G.news.filter(n => n.day > pd && n.day <= G.day && !/^Autopilote/.test(n.text)).slice(0, 3).map(n => n.text), auto: (g.autoM || []).slice(0, 2), autoN: (g.autoM || []).length, unseen: true };
  g.autoM = [];
}
const dlt = (v, pv, f) => { if (pv == null) return ''; const d = v - pv; if (!d) return '<em>stable</em>'; return '<em class="' + (d > 0 ? 'pos' : 'neg') + '">' + (d > 0 ? '▲ ' : '▼ ') + f(Math.abs(d)) + '</em>'; };
function modalBilan(M, G, p) {
  const b = G.game.bilan; if (!b) return '<h2>Bilan du mois</h2><p class="muted">Pas encore de bilan : reviens après le premier mois.</p>';
  const T = (l, v, d) => '<div class="bt"><small>' + l + '</small><b>' + v + '</b>' + d + '</div>', L = [];
  if (b.best) L.push(['gamme', 'Meilleure vente : <b>' + esc(b.best[0]) + '</b> (' + nf(b.best[1]) + ' véh.)']);
  if (b.cty) L.push(['pays', 'Premier pays : <b>' + esc(COUNTRIES[b.cty[0]].n) + '</b> (' + nf(b.cty[1]) + ' véh.)']);
  if (b.prevRank != null && b.rank !== b.prevRank) L.push(['classement', b.rank < b.prevRank ? 'Tu gagnes ' + (b.prevRank - b.rank) + ' place(s) : <b>n° ' + b.rank + '</b> des constructeurs.' : 'Tu perds ' + (b.rank - b.prevRank) + ' place(s) : <b>n° ' + b.rank + '</b>.']);
  if (b.lost > 0 && b.units && b.lost > 0.04 * (b.units + b.lost)) L.push(['alerte', '<b>' + nf(b.lost) + ' ventes perdues</b> (stocks ou capacité).']);
  for (const t of b.ev) L.push(['actus', esc(t)]);
  for (const t of b.auto) L.push(['reglages', 'Autopilote : ' + esc(t)]);
  if ((b.autoN || 0) > b.auto.length) L.push(['reglages', '… et ' + (b.autoN - b.auto.length) + ' autre(s) décision(s) de l\'autopilote (voir le journal).']);
  const todo = todoList(G, p).slice(0, 2);
  return '<h2>Bilan · ' + TE.dateStr(b.day) + '</h2><div class="btiles">' + T('Ventes', nf(b.units), dlt(b.units, b.prevU, v => nf(Math.round(v)))) + T('Résultat', TE.signed(b.profit), dlt(b.profit, b.prevP, v => money(v))) + T('Trésorerie', money(b.cash), dlt(b.cash, b.prevCash, v => money(v))) + T('Part mondiale', TE.pct(b.share, 2), dlt(b.share, b.prevShare, v => nf(v * 100, 2) + ' pt')) + '</div>' +
    (L.length ? '<div class="blist">' + L.map(x => '<div class="bi"><span class="ti">' + H.ico(x[0]) + '</span><span>' + x[1] + '</span></div>').join('') + '</div>' : '') +
    (todo.length ? '<h3 class="fh">À faire maintenant</h3>' + todo.map(t => '<button class="tdo ' + t.tone + '" data-act="' + t.act + '"' + dAttr(t.data) + '><span class="ti">' + H.ico(t.ico) + '</span><span class="tt">' + t.t + (t.sub ? '<small>' + t.sub + '</small>' : '') + '</span><span class="tg">' + t.label + '</span></button>').join('') : '') +
    '<div class="f"><span>Afficher le bilan</span>' + H.chips('bmode', 'x', G.game.bilanMode || 'm', [['m', 'Chaque mois'], ['q', 'Chaque trimestre'], ['off', 'Jamais']]) + '</div>' +
    H.btn('Continuer', 'close', {}, { cls: 'primary' });
}

/* ---------- Campus : l'entreprise comme un lieu, chaque lieu mène à son écran ---------- */
function panelAuto(G, p) {
  const A = AU(G), R = A.rules, sw = (path, on) => '<button class="sw' + (on ? ' on' : '') + '" role="switch" aria-checked="' + on + '" data-act="aset" data-k="' + path + '" data-v="' + (on ? 0 : 1) + '"><i></i></button>';
  const ch = (path, cur, opts) => H.chips('aset', path, String(cur), opts.map(o => [String(o[0]), o[1]]));
  const rule = (ico, title, desc, path, on, extra) => '<div class="arule' + (on ? ' on' : '') + '"><div class="ah"><span class="ti">' + H.ico(ico) + '</span><div><b>' + title + '</b><small>' + desc + '</small></div>' + sw(path, on) + '</div>' + (on && extra ? '<div class="ax">' + extra + '</div>' : '') + '</div>';
  const free = Math.max(0, p.cash * (1 - A.keep)) * 0.3;
  return '<div class="auto"><h2>Autopilote</h2><p class="muted" style="font-size:13px;margin:-4px 0 0">Chaque mois, il prend à ta place les décisions simples et rentables. Tout est réglable, et chaque décision est écrite dans le journal.</p>' +
    '<div class="abig' + (A.on ? ' on' : '') + '"><div><b>' + (A.on ? 'Autopilote activé' : 'Autopilote arrêté') + '</b><small>' + (A.on ? 'Dépense maximale ce mois-ci : ' + money(free) : 'Active-le pour déléguer le réseau, les prix et les stocks.') + '</small></div>' + sw('on', A.on) + '</div>' +
    rule('pays', 'Réseau rentable', 'Ouvre des concessions là où l\'investissement se rembourse vite (estimation d\'impact incluse).', 'rules.net.on', R.net.on, '<div class="f"><span>Rembourser en moins de</span>' + ch('rules.net.pay', R.net.pay, [[18, '18 mois'], [30, '30 mois'], [48, '4 ans']]) + '</div>') +
    rule('marque', 'Notoriété', 'Lance une campagne presse quand un pays où tu vends connaît mal ta marque.', 'rules.aware.on', R.aware.on, '<div class="f"><span>Notoriété minimale</span>' + ch('rules.aware.min', R.aware.min, [[30, '30'], [45, '45'], [60, '60']]) + '</div>') +
    rule('finances', 'Prix et marges', 'Relève le prix d\'un modèle vendu à perte.', 'rules.price.on', R.price.on) +
    rule('stocks', 'Stocks', 'Monte le stock visé quand des ventes sont perdues, lance une promotion de 5 % en cas de sur-stock.', 'rules.stock.on', R.stock.on) +
    H.card('Budget', '<p class="muted" style="font-size:12.5px;margin:0">L\'autopilote ne touche jamais à la part de trésorerie mise de côté, et dépense au plus 30 % du reste chaque mois.</p><div class="f"><span>Trésorerie mise de côté</span>' + ch('keep', Math.round(A.keep * 100), [[20, '20 %'], [40, '40 %'], [60, '60 %']]) + '</div>') +
    H.card('Journal', A.log.length ? A.log.slice(0, 12).map(l => '<div class="alog"><small>' + TE.dateStr(l.day) + '</small><span>' + esc(l.t) + '</span></div>').join('') : '<p class="muted" style="margin:0">Aucune décision pour l\'instant.</p>') + '</div>';
}

function panelCampus(G, p) {
  const al = advice(G, p).filter(a => a[0] === 'bad' || a[0] === 'warn'), bad = al.some(a => a[0] === 'bad');
  const onSale = p.models.filter(m => m.state === 'sale'), dev = p.models.filter(m => m.state === 'dev').length + p.proj.length;
  const stock = Math.round(TE.sum(p.models.map(m => m.stock || 0))), sold = p.unitsH[p.unitsH.length - 1] || 0;
  const present = new Set(); for (const b of brandsOf(p)) for (const c of CK) if (b.cty[c].dealers > 0) present.add(c);
  const Ls = lics(G), nl = Ls.filter(x => x.from === p.id || x.to === p.id).length;
  const val = TE.companyValue(p), rank = 1 + TE.rivals().filter(t => TE.companyValue(t) > val).length, tot = TE.rivals().length + 1;
  const prof = p.last ? p.last.profit : 0;
  const P = [
    { id: 'siege', n: 'Siège', ico: 'campus', tab: 'tableau', c: '#1d5f82', wide: 1, st: [['Trésorerie', money(p.cash)], ['Résultat du mois', TE.signed(prof), prof < 0 ? 'warn' : ''], ['Alertes', al.length ? al.length : 'aucune', bad ? 'warn' : '']], ln: [['tableau', 'Tableau', 'tableau'], ['rapport', 'Rapport', 'qualite'], ['autopilote', 'Autopilote', 'reglages']] },
    { id: 'bureau', n: 'Bureau d\'études', ico: 'gamme', tab: 'gamme', c: '#7a4fa3', st: [['En vente', onSale.length], ['En projet', dev], ['Ingénieurs', nf(p.staff.ingenieurs.n)]], ln: [['gamme', 'Modèles', 'gamme'], ['pieces', 'Pièces', 'pieces']] },
    { id: 'usine', n: 'Usines', ico: 'usines', tab: 'usines', c: '#b8481b', st: [['Capacité', nf(capOf(p, G)) + '/m'], ['Utilisation', TE.pct(p.util || 0), (p.util || 0) > 0.93 ? 'warn' : '']], ln: [['usines', 'Usines', 'usines']] },
    { id: 'stocks', n: 'Parc de stocks', ico: 'stocks', tab: 'stocks', c: '#2f7a6b', st: [['Stock', nf(stock) + ' véh.'], ['Ventes du mois', nf(sold)]], ln: [['stocks', 'Stocks', 'stocks']] },
    { id: 'reseau', n: 'Réseau', ico: 'pays', tab: 'carte', c: '#c7792a', st: [['Concessions', nf(dealersTotal(p))], ['Pays', present.size + ' / ' + CK.length]], ln: [['carte', 'Carte', 'pays'], ['pays', 'Pays', 'pays'], ['marque', 'Marque', 'marque']] },
    { id: 'groupe', n: 'Groupe', ico: 'groupe', tab: 'groupe', c: '#34506b', st: [['Marques', brandsOf(p).length], ['Licences', nl]], ln: [['groupe', 'Marques', 'groupe'], ['licences', 'Licences', 'licences']] },
    { id: 'presse', n: 'Presse et palmarès', ico: 'classement', tab: 'classement', c: '#a83a52', st: [['Rang', rank + ' / ' + tot], ['Image', Math.round(groupImg(p)) + ' / 100']], ln: [['classement', 'Concurrence', 'classement']] },
    { id: 'banque', n: 'Banque', ico: 'finances', tab: 'finances', c: '#556b2f', wide: 1, st: [['Dette', money(p.debt || 0), (p.debt || 0) > p.cash * 2 ? 'warn' : ''], ['Trésorerie', money(p.cash)]], ln: [['finances', 'Finances', 'finances']] }
  ];
  const bd = DEF._bv || {};
  return '<h2>Campus</h2><p class="muted" style="font-size:13px;margin-top:-4px">Ton entreprise, lieu par lieu. Touche un lieu pour y entrer.</p>' + todoCard(G, p) + '<div class="campus">' + P.map(x => {
    const u = TE.art('scene-' + x.id), bg = u ? '<img class="pbg" src="' + u + '" alt="" loading="lazy" decoding="async">' : '<span class="pfb">' + H.ico(x.ico) + '</span>';
    return '<article class="place p-' + x.id + (x.wide ? ' wide' : '') + '" style="--pc:' + x.c + '">' + bg +
      '<button class="ph" data-act="goto" data-tab="' + x.tab + '"><span class="pn">' + H.ico(x.ico) + esc(x.n) + '</span><span class="ps">' + x.st.map(s => '<span>' + s[0] + '<b class="' + (s[2] || '') + '">' + s[1] + '</b></span>').join('') + '</span></button>' +
      '<div class="pl">' + x.ln.map(l => '<button data-act="goto" data-tab="' + l[0] + '">' + H.ico(l[2]) + l[1] + (bd[l[0]] && bd[l[0]].n ? ' · ' + bd[l[0]].n : '') + '</button>').join('') + '</div></article>';
  }).join('') + '</div>';
}

function panelTableau(G, p) {
  const sold = p.unitsH[p.unitsH.length - 1] || 0, prof = p.last ? p.last.profit : 0, g = G.game;
  return '<h2>Tableau de bord</h2>' + H.tiles([['Ventes du mois', nf(sold) + ' véh.'], ['Part mondiale', TE.pct(p.gshare || 0, 2)], ['Marque', Math.round(groupImg(p)) + ' / 100'], ['Capacité', nf(capOf(p, G)) + '/mois · ' + TE.pct(p.util || 0) + ' utilisée'], ['Résultat du mois', TE.signed(prof), TE.cls(prof)], ['Concessions', nf(dealersTotal(p))], ['Stock', nf(Math.round(stockU(p))) + ' véh.'], ['Ventes perdues', nf(Math.round(p.mo ? Math.max(0, p.mo.demand - p.mo.units) : 0)) + ' véh.']]) + TE.panels.goal() + adviceCard(G, p) + (brandsOf(p).length > 1 ? H.card('Marques du groupe', H.table([{ h: 'Marque', get: b => '<span class="dot" style="background:' + (b.color || p.color) + '"></span>' + esc(b.name) }, { h: 'Ventes', cls: 'num', get: b => nf(TE.sum(p.models.filter(m => brOf(p, m) === b).map(m => m.sold || 0))) }, { h: 'Image', cls: 'num', get: b => Math.round(b.brand) }, { h: 'Concess.', cls: 'num', get: b => nf(TE.sum(Object.values(b.cty).map(x => x.dealers))) }], brandsOf(p))) : '') +
    (p.unitsH.length >= 2 ? H.card('Ventes mensuelles', H.barChart(p.unitsH.slice(-24), { fmt: v => nf(v) })) : '') +
    H.card('Marché mondial', H.kv([['Conjoncture', (g.econ >= 1 ? '+' : '') + nf((g.econ - 1) * 100, 1) + ' %', g.econ < 1 ? 'neg' : 'pos'], ['Carburant (indice)', nf(g.fuel * 100) + ' %', g.fuel > 1.15 ? 'neg' : ''], ['Batteries (indice)', nf(g.batt * 100) + ' %' + (p.sup && p.sup.until > G.day ? ' (ton contrat : ' + nf(p.sup.idx * 100) + ' %)' : ''), g.batt > 1.25 ? 'neg' : ''], ['Appétit pour l\'électrique (France)', TE.pct(evPref('FR', G) / 1.8)], ['Plafond CO2 Europe', nf(co2Limit(G)) + ' g/km' + (p.mo && p.mo.co2avg ? ' (ta flotte : ' + nf(p.mo.co2avg) + ')' : '')]])) +
    regsCard(G) + msCard(G, p) + H.card('Ta gamme', p.models.filter(m => m.state !== 'end').length ? H.table([{ h: 'Modèle', get: m => esc(m.name) + (m.state === 'dev' ? ' <span class="pill info">en développement</span>' : '') }, { h: 'Âge', cls: 'num', get: m => m.state === 'sale' ? m.age + ' m' : '–' }, { h: 'Ventes', cls: 'num', get: m => nf(m.sold) }, { h: 'Marge/véh.', cls: 'num', get: m => { const mg = m.price * (1 - DEALER_MARGIN) - m.cost; return '<span class="' + TE.cls(mg) + '">' + money(mg) + '</span>'; } }], p.models.filter(m => m.state !== 'end')) : '<p class="muted">Aucun modèle.</p>');
}

const adviceCard = (G, p) => { const A = advice(G, p); return A.length ? H.card('Conseiller', A.map(a => '<p class="' + (a[0] === 'bad' ? 'neg' : a[0] === 'warn' ? '' : 'muted') + '" style="margin:4px 0;font-size:13px">' + (a[0] === 'bad' ? '⛔ ' : a[0] === 'warn' ? '' : '') + esc(a[1]) + '</p>').join('')) : ''; };
const msCard = (G, p) => H.card('Étapes (' + MS.filter(m => G.game.ms[m[0]]).length + '/' + MS.length + ')', MS.map(m => '<div class="row" style="font-size:13px"><span>' + (G.game.ms[m[0]] ? H.ico('qualite') : '○') + '</span><span class="grow ' + (G.game.ms[m[0]] ? '' : 'muted') + '">' + esc(m[1][0].toUpperCase() + m[1].slice(1)) + '</span></div>').join(''));
const regsCard = G => { const R = G.game.regs.filter(r => G.day >= r.ann); return R.length ? H.card('Réglementation', R.map(r => '<p style="margin:4px 0;font-size:13px">' + (G.day >= r.day ? 'En vigueur' : 'Dans ' + nf((r.day - G.day) / 360, 1) + ' an(s)') + ' : ' + esc(r.title) + '.</p>').join('')) : ''; };
function panelMarque(G, p) {
  const b = selB(p), g = G.game, act = p.sup && p.sup.until > G.day, sale = p.models.filter(m => m.state === 'sale' && brOf(p, m) === b);
  return '<h2>Marque & fiabilité</h2>' + brandChips(p) + H.tiles([['Image de marque', Math.round(b.brand) + ' / 100'], ['Trophées', p.awards || 0], ['Rappels de série', p.recalls || 0]]) +
    H.card('Positionnement', '<p class="muted" style="font-size:13px">Un axe clair attire les clients concernés (+7 % d\'attractivité des modèles conformes, −5 % pour les autres) et nourrit l\'image de marque. En changer coûte 20 M€ et 5 points de marque.</p><div class="chips">' +
      [['', 'Aucun']].concat(Object.keys(POS).map(k => [k, POS[k][0]])).map(o => '<button class="chip" data-act="pos" data-v="' + o[0] + '" aria-pressed="' + ((b.pos || '') === o[0]) + '">' + o[1] + '</button>').join('') + '</div>' +
      (b.pos ? '<p class="muted" style="font-size:12px">Critère : ' + POS[b.pos][1] + '. Modèles conformes : ' + sale.filter(m => posFit(G, b, m)).length + ' sur ' + sale.length + '.</p>' : '')) +
    H.card('Tests de fiabilité', '<p class="muted" style="font-size:13px">Chaque niveau réduit les rappels de 22 % et la garantie de 12 %. Un défaut sur une pièce partagée touche tous les modèles qui l\'utilisent.</p>' + H.seg('tests', 'lvl', p.test || 0, TEST_L.map((n, i) => n + (TESTC[i] ? ' · ' + money(TESTC[i]) + '/mois' : '')))) +
    H.card('Batteries : contrat fournisseur', H.kv([['Prix spot (indice)', nf(g.batt * 100) + ' %', g.batt > 1.25 ? 'neg' : ''], ['Ton contrat', act ? nf(p.sup.idx * 100) + ' % jusqu\'en ' + TE.dateStr(p.sup.until).split(' ').slice(-2).join(' ') : 'aucun (tu paies le spot)']]) +
      '<p class="muted" style="font-size:12px">Les batteries pèsent environ 30 % du coût d\'un modèle électrique, 8 % d\'un hybride. Un contrat fixe te protège de la hausse, mais tu paieras plus cher si le marché baisse.</p>' + (act ? '' : H.btn('Fixer le prix 2 ans (+4 %)', 'supply', {}, { cls: 'small' }))) +
    H.card('Fiabilité des pièces', p.parts.length ? H.table([{ h: 'Pièce', get: x => esc(x.name) }, { h: 'Fiabilité', cls: 'num', get: x => '<span class="' + (x.st.rel < 55 ? 'neg' : x.st.rel >= 70 ? 'pos' : '') + '">' + Math.round(x.st.rel) + '</span>' }, { h: 'Modèles', cls: 'num', get: x => p.models.filter(m => m.state !== 'end' && (m.eng == x.id || m.chs == x.id || m.gbx == x.id)).length }], p.parts) : '<p class="muted">Aucune pièce.</p>');
}
function trendBody(G) {
  const sc = fU('trs') || '', R = sc ? REGK.filter(r => REGL[r][1] === sc) : REGK;
  const row = k => { const t = trAvg(G, k, R); return '<div class="trr"><span>' + TRK[k][0] + '</span><div class="trb"><i class="' + (t.v >= 1 ? 'up' : 'dn') + '" style="width:' + clamp(t.v * 50, 6, 100) + '%"></i></div><span class="tv">' + trArrow(t.d) + ' ' + pctS(t.v) + '</span></div>'; };
  return H.chips('set', 'trs', sc, [['', 'Monde']].concat(CONTS.map(c => [c, c]))) + '<p class="muted" style="font-size:12px">100 % = niveau de départ de la partie. Un indice de +20 % signifie que la demande pour ce type est 20 % plus forte que prévu ; la flèche donne la direction depuis six mois. Ces tendances jouent sur les ventes de tous les constructeurs.</p>' +
    ['Motorisation', 'Boîtes', 'Carrosseries', 'Goûts'].map(gr => '<h4 class="trh">' + gr + '</h4>' + TRKEYS.filter(k => TRK[k][1] === gr).map(row).join('')).join('');
}
function techBody(G, p) {
  const av = techAvail(G, p), fr = techFront(G), best = k => Math.max.apply(null, p.parts.filter(x => x.kind === k && !x.lic && !x.arch).map(x => x.spec.lvl).concat([0]));
  const lad = (title, kind, fuel) => '<h4 class="trh">' + title + '</h4>' + TECH_LVL.map(n => { const r = techRow(kind, { fuel: fuel, lvl: n }), st = n > av ? 'lock' : n === fr ? 'front' : techLag(G, n) ? 'old' : '', b = kind === 'eng' ? Math.max.apply(null, p.parts.filter(x => x.kind === 'eng' && x.spec.fuel === fuel && !x.lic && !x.arch).map(x => x.spec.lvl).concat([0])) : best(kind);
    return '<div class="trl"><span>' + esc(r[0]) + (n > av ? ' <small class="muted">· ' + techYear(n) + '</small>' : n === fr ? ' ' + H.pill('pointe', 'good') : techLag(G, n) ? ' ' + H.pill('dépassée', 'warn') : '') + '</span><span class="tv">' + (b === n ? H.pill('ta meilleure pièce', 'info') : '') + '</span></div>'; }).join('');
  return '<p class="muted" style="font-size:13px">Chaque technologie est une avancée réelle. Le marché progresse avec le temps : la pointe actuelle est <b>' + esc(techNm('eng', { fuel: 'ess', lvl: fr })) + '</b> (moteur essence)' + (p.adv ? ', tu as une génération d\'avance grâce à tes programmes de recherche' : '') + '. Une pièce en retard de plus de 3 niveaux rend tes modèles datés (design perçu en baisse) : fais un redesign pour la moderniser.</p>' + lad('Moteurs essence', 'eng', 'ess') + lad('Moteurs diesel', 'eng', 'die') + lad('Hybrides', 'eng', 'hyb') + lad('Électriques', 'eng', 'elec') + lad('Châssis', 'chs') + lad('Boîtes', 'gbx');
}
const TECH_LVL = [1, 2, 3, 4, 5, 6, 7, 8];
function panelPieces(G, p) {
  const FK = fU('fpk') || 'eng', FF = fU('fpf'), FU = fU('fpu'), FS = fU('fps') || 'lvl', famUse = fp => TE.sum(fp.map(x => p.models.filter(m => m.state !== 'end' && (m.eng == x.id || m.chs == x.id || m.gbx == x.id)).length));
  const fams = k => { const seen = new Set(), L = []; for (const x of p.parts.filter(y => y.kind === k)) { const f = famId(x); if (seen.has(f)) continue; seen.add(f); const fp = famParts(p, x), h = famHead(p, x); L.push({ h, fp, use: famUse(fp), arch: fp.every(y => y.arch) }); } return L; };
  const PF = list => list.filter(f => (FU === 'arch' ? f.arch : !f.arch) && (!FF || f.h.kind !== 'eng' || f.h.spec.fuel === FF) && (!FU || FU === 'arch' || (FU === 'used') === (f.use > 0))).sort(FS === 'name' ? (x, y) => x.h.name.localeCompare(y.h.name) : FS === 'new' ? (x, y) => y.h.born - x.h.born : (x, y) => (y.h.spec.lvl || 0) - (x.h.spec.lvl || 0));
  const nA = [FF, FU].filter(Boolean).length, shownN = PF(fams(FK)).length;
  const flt = (FK === 'eng' ? H.filter('Motorisation', 'fpf', FF, [['', 'Toutes']].concat(Object.keys(FUELS).filter(f => p.parts.some(x => x.kind === 'eng' && x.spec.fuel === f)).map(f => [f, FUELS[f].n]))) : '') +
    H.filter('Utilisation', 'fpu', FU, [['', 'Toutes'], ['used', 'Utilisées'], ['free', 'Inutilisées'], ['arch', 'Archivées']]) + H.filter('Trier par', 'fps', FS, [['lvl', 'Niveau'], ['new', 'Récentes'], ['name', 'Nom']]);
  const rowsOf = (k, st) => k === 'eng' ? [['Puissance', nf(st.kw) + ' kW'], ['Fiabilité', Math.round(st.rel)], ['CO2 (base)', nf(st.co2) + ' g/km'], ['Coût', money(st.cost)]] : k === 'chs' ? [['Puissance max', nf(st.maxKW) + ' kW'], ['Confort / tenue', Math.round(st.comfort) + ' / ' + Math.round(st.handling)], ['Sécurité', Math.round(st.safety)], ['Coût', money(st.cost)]] : [['Puissance max', nf(st.maxKW) + ' kW'], ['Agrément', Math.round(st.refine)], ['Rendement', Math.round(st.eff)], ['Coût', money(st.cost)]];
  const genRow = (x, head) => { const u = famUse([x]); return '<div class="gen' + (x.arch ? ' arch' : '') + '"><div><b>G' + (x.gen || 1) + (head ? ' · actuelle' : '') + '</b> · ' + esc(techNm(x.kind, x.spec)) + (techLag(G, x.spec.lvl) ? ' <span class="neg">· dépassée</span>' : '') + (x.arch ? ' · archivée' : '') + '<br><small class="muted">' + esc(x.name.replace(/^.*? · /, '')) + ' · ' + (u ? u + ' modèle' + (u > 1 ? 's' : '') : 'inutilisée') + '</small></div>' + (u && !x.arch ? '' : H.btn(x.arch ? 'Restaurer' : 'Archiver', 'archpart', { id: x.id }, { cls: 'small' })) + '</div>'; };
  const sect = k => 
    (p.proj.filter(x => x.kind === k).map(x => H.card((x.parent ? 'Redesign : ' : 'En développement : ') + esc(x.name), H.bar(x.total - x.left, x.total) + '<div class="row muted" style="font-size:12px"><span class="grow">Reste ' + Math.ceil(x.left / rdSpeed(p) / 30 * 10) / 10 + ' mois</span><span>' + money(x.monthly) + '/mois</span></div>')).join('')) +
    H.bento(PF(fams(k)).map(f => {
      const x = f.h, age = Math.floor((G.day - x.born) / 360), rows = rowsOf(k, x.st), busy = p.proj.some(y => y.parent === x.id);
      const gens = f.fp.slice().sort((u, v) => (v.gen || 1) - (u.gen || 1));
      return H.fold('p' + x.id, { img: partArt(x), title: esc(x.name) + ' ' + H.pill('G' + (x.gen || 1), 'info') + ' ' + H.pill(f.use ? f.use + ' modèle' + (f.use > 1 ? 's' : '') : 'inutilisée', f.use ? 'good' : '') + (age >= 4 ? ' ' + H.pill('vieillissante', 'warn') : '') + (x.lic ? ' ' + H.pill(H.ico('licences') + ' ' + (brandsOf(p).find(b => (b.bid || 0) === (x.lbr || 0)) || p).name, 'info') : ''), img: 'part-' + k + '-' + (k === 'eng' ? x.spec.fuel : k === 'chs' ? x.spec.focus : x.spec.type), metrics: rows.slice(0, 3).map(r => [r[0], r[1]]), body: H.kv(rows) +
        (x.lic ? '' : '<p class="muted" style="font-size:12.5px;margin:10px 0 4px">Une famille évolue de génération en génération : un redesign coûte bien moins cher qu\'un développement neuf et améliore la maturité de la pièce.</p>' + H.btn(busy ? 'Redesign en cours' : 'Redesign → G' + ((x.gen || 1) + 1), 'redesign', { id: x.id }, { cls: 'primary', off: busy, why: 'Un redesign de cette pièce est déjà en cours.' })) +
        (gens.length > 1 || x.arch ? '<h4 class="trh" style="margin-top:12px">Générations</h4>' + gens.map(y => genRow(y, y === x)).join('') : (f.use ? '' : '<div style="margin-top:10px">' + H.btn(x.arch ? 'Restaurer' : 'Archiver', 'archpart', { id: x.id }, { cls: 'small' }) + '</div>')) });
    }).join(''));
  const best = k => { const L = p.parts.filter(x => x.kind === k && !x.arch && !x.lic); if (!L.length) return ''; return k === 'eng' ? 'jusqu\'à ' + nf(Math.max.apply(null, L.map(x => x.st.kw))) + ' kW' : 'jusqu\'à ' + nf(Math.max.apply(null, L.map(x => x.st.maxKW))) + ' kW'; };
  const tile = k => { const I = PK_INFO[k], n = fams(k).filter(f => !f.arch).length, dv = p.proj.filter(x => x.kind === k).length, tp = p.parts.filter(x => x.kind === k && !x.arch && !x.lic).sort((u, v) => v.spec.lvl - u.spec.lvl)[0]; return '<button class="ptile' + (FK === k ? ' on' : '') + '" data-act="set" data-k="fpk" data-v="' + k + '" aria-pressed="' + (FK === k) + '"><span class="kimg">' + H.img(tp ? partArt(tp) : I[2]) + '</span><span class="ptx"><b>' + PLU[k] + '</b><small>' + n + ' famille' + (n > 1 ? 's' : '') + (dv ? ' · ' + dv + ' en dév.' : '') + '</small><span class="pmeta">' + (best(k) ? '<i>' + best(k) + '</i>' : '') + (tp ? '<i>' + esc(techNm(k, tp.spec)) + '</i>' : '') + '</span></span><span class="ptick"></span></button>'; };
  const tops = [['f_elec', 'Électrique'], ['s_suv', 'SUV'], ['g_auto', 'Boîte auto']].map(([k, n]) => { const t = trAvg(G, k); return [n, trArrow(t.d) + ' ' + pctS(t.v)]; });
  const nFam = TE.sum(['eng', 'chs', 'gbx'].map(k => fams(k).filter(f => !f.arch).length));
  const hs = (l, v) => '<span class="hst"><small>' + l + '</small><b>' + v + '</b></span>';
  return '<div class="pw pieces"><section class="hero"><div class="hero-tx"><small class="over">Bureau d\'études</small><h2>Pièces</h2><p>Moteurs, châssis et boîtes se développent une fois puis se partagent entre tes modèles. Une famille évolue de génération en génération, sans repartir de zéro.</p>' +
    '<div class="hstats">' + hs('Ingénieurs', p.staff.ingenieurs.n) + hs('Vitesse', '×' + nf(rdSpeed(p), 2)) + hs('Familles', nFam) + hs('Pointe techno', techNm('eng', { fuel: 'ess', lvl: techFront(G) })) + '</div>' +
    '<div class="hbtns">' + [[-20, '−20'], [20, '+20'], [50, '+50']].map(x => '<button class="btn small" data-act="hire" data-n="' + x[0] + '">' + x[1] + ' ingénieurs' + (x[0] > 0 ? ' · ' + money(x[0] * 8000) : '') + '</button>').join('') + '</div></div>' +
    '<div class="hero-art" aria-hidden="true">' + ['eng', 'chs', 'gbx'].map((k, i) => '<span class="fl' + i + '">' + H.img(kindArt(p, k)) + '</span>').join('') + '</div></section>' +
    '<div class="ptiles">' + ['eng', 'chs', 'gbx'].map(tile).join('') + '</div>' +
    '<div class="pdesc"><b>' + PLU[FK] + '</b> · ' + PK_INFO[FK][1] + '</div>' +
    filtersCard('pieces', nA, shownN, fams(FK).filter(f => !f.arch).length, flt, 'fpf,fpu') + '<div class="cat">' + sect(FK) + '</div>' +
    '<div class="duo">' + H.fold('trends', { title: 'Tendances du marché', metrics: tops, body: trendBody(G) }) + H.fold('tech', { title: 'Technologies', metrics: [['Pointe du marché', techNm('eng', { fuel: 'ess', lvl: techFront(G) })], ['Accessible', techNm('eng', { fuel: 'ess', lvl: techAvail(G, p) })]], body: techBody(G, p) }) + '</div></div>';
}
function panelGamme(G, p) {
  const A = m => modelAttrs(G, m), UI = TE.UI, F = { br: fU('sgb'), body: fU('fbody'), seg: fU('fseg'), fuel: fU('ffuel'), st: fU('fst'), sort: fU('fsort') || 'new' };
  const base = p.models.filter(m => (F.st === 'end' ? m.state === 'end' : F.st === 'sale' ? m.state === 'sale' : F.st === 'dev' ? m.state === 'dev' : m.state !== 'end'));
  const mg = m => effPrice(m) * (1 - DEALER_MARGIN) - costNow(p, G, m), mgOf = mg;
  let ms = base.filter(m => (!F.br || String(brOf(p, m).bid || 0) === F.br) && (!F.body || m.body === F.body) && (!F.seg || body(m).seg === F.seg) && (!F.fuel || m.fuel === F.fuel));
  ms = ms.slice().sort(F.sort === 'sales' ? (x, y) => (y.sold || 0) - (x.sold || 0) : F.sort === 'margin' ? (x, y) => mg(y) - mg(x) : F.sort === 'age' ? (x, y) => y.age - x.age : F.sort === 'name' ? (x, y) => x.name.localeCompare(y.name) : (x, y) => y.id - x.id);
  const cnt = (f) => base.filter(f).length, nAct = ['br', 'body', 'seg', 'fuel', 'st'].filter(k => F[k]).length;
  const fb = F.br;
  const flt = (brandsOf(p).length > 1 ? H.filter('Marque', 'sgb', F.br, [['', 'Toutes']].concat(brandsOf(p).map(b => [String(b.bid || 0), esc(b.name) + ' · ' + cnt(m => brOf(p, m) === b)]))) : '') +
    H.filter('Silhouette', 'fbody', F.body, [['', 'Toutes']].concat(Object.keys(BODIES).filter(k => cnt(m => m.body === k)).map(k => [k, BODIES[k].n + ' · ' + cnt(m => m.body === k)]))) +
    H.filter('Segment', 'fseg', F.seg, [['', 'Tous']].concat(Object.keys(SEG).filter(k => cnt(m => body(m).seg === k)).map(k => [k, SEG[k] + ' · ' + cnt(m => body(m).seg === k)]))) +
    H.filter('Motorisation', 'ffuel', F.fuel, [['', 'Toutes']].concat(Object.keys(FUELS).filter(k => cnt(m => m.fuel === k)).map(k => [k, FUELS[k].n + ' · ' + cnt(m => m.fuel === k)]))) +
    H.filter('État', 'fst', F.st, [['', 'Actifs'], ['sale', 'En vente'], ['dev', 'En développement'], ['end', 'Retirés']]) +
    H.filter('Trier par', 'fsort', F.sort, [['new', 'Récents'], ['sales', 'Ventes'], ['margin', 'Marge'], ['age', 'Âge'], ['name', 'Nom']]);
  return '<h2>Modèles</h2><p class="muted" style="font-size:12px">Cycle de vie : lancement (6 premiers mois, effet de nouveauté), maturité (jusqu\'à 42 mois), puis déclin. Un restylage fait rajeunir le modèle de deux ans.</p>' +
    filtersCard('gamme', nAct, ms.length, base.length, flt, 'sgb,fbody,fseg,ffuel,fst') +
    (ms.length ? H.bento(ms.map(m => {
      const a = A(m), key = 'pr' + m.id, lo = Math.round(m.cost * 0.95 / 100) * 100, hi = Math.round(SEG_ANCHOR[body(m).seg] * infl(G) * 2.2 / 100) * 100, q = modelQ(G, m), mg = effPrice(m) * (1 - DEALER_MARGIN) - costNow(p, G, m);
      const e = partOf(p, m.eng), c = partOf(p, m.chs), g = partOf(p, m.gbx);
      return H.fold('m' + m.id, { title: esc(m.name) + ' ' + H.pill(SEG[body(m).seg], 'info') + ' ' + (brandsOf(p).length > 1 ? H.pill(esc(brOf(p, m).name)) + ' ' : '') + (m.state === 'dev' ? H.pill('lancement dans ' + Math.ceil(m.left / rdSpeed(p) / 30) + ' mois', 'warn') : H.pill(FUELS[m.fuel].n)) + ' ' + H.pill(STAGE_L[stageOf(m)], stageOf(m) === 'decline' ? 'warn' : stageOf(m) === 'launch' ? 'good' : '') + (m.discLeft > 0 ? ' ' + H.pill('promo −' + Math.round(m.disc * 100) + ' %', 'info') : ''), img: lookOf(p, m), metrics: m.state === 'dev' ? [['Lancement', Math.ceil(m.left / rdSpeed(p) / 30) + ' mois'], ['Budget', money(m.devCost || 0)]] : [['Ventes', nf(m.sold || 0)], ['Marge/véh.', TE.signed(Math.round(mgOf(m))), mgOf(m) < 0 ? 'neg' : 'pos'], ['Âge', m.age + ' m']], body: '<div class="muted" style="font-size:12px">' + esc(e ? e.name : '') + ' · ' + esc(c ? c.name : '') + ' · ' + esc(g ? g.name : '') + ' · ' + FINISH[m.fin - 1] + '</div>' +
        H.kv([['Âge', m.state === 'sale' ? m.age + ' mois' : '–'], ['Indice de qualité', nf(q, 2), q >= 1 ? 'pos' : 'neg'], ['Coût unitaire', money(costNow(p, G, m)) + (shareF(p, m) < 1 ? ' (plateformes partagées −' + Math.round((1 - shareF(p, m)) * 100) + ' %)' : '')], ['Effet de lancement', (m.hype || 0) > 0.05 ? '+' + Math.round(m.hype * 45) + ' % d\'attractivité' : '–'], ['Marge par véhicule', money(mg), TE.cls(mg)], ['Ventes du mois', nf(m.sold)], ['Total vendu', nf(m.soldTot)], ['Stock', nf(Math.round(m.stock || 0)) + ' véh. (' + nf((m.stock || 0) / Math.max(1, m.fc || m.sold || 1), 1) + ' mois)'], ['Ventes perdues', nf(Math.round(m.lost || 0)), (m.lost || 0) > 0.05 * (m.fc || 1) ? 'neg' : '']]) +
        (m.hist.length >= 2 ? H.spark(m.hist.slice(-24), { zero: true }) : '') +
        '<div class="row">' + H.btn(H.ico('stocks') + ' Stock', 'goto', { tab: 'stocks', open: 's' + m.id }, { cls: 'small' }) + H.btn(H.ico('usines') + ' Usines', 'goto', { tab: 'usines' }, { cls: 'small' }) + '</div>' +
        '<div class="row">' + H.text('rn' + m.id, { ph: 'Renommer : ' + m.name, max: 24 }) + H.btn('Renommer', 'rename', { m: m.id }, { cls: 'small' }) + '</div>' + (m.lic ? '<p class="muted" style="font-size:12px">Sous licence : redevance de ' + TE.pct((lics(G).find(x => x.id === m.lic) || { r: 0 }).r) + ' du chiffre d\'affaires net à ' + esc((actorById(G, (lics(G).find(x => x.id === m.lic) || {}).from) || { name: '?' }).name) + '.</p>' : '') +
        '<details class="setup"><summary>Caractéristiques</summary>' + attrBars(a) + '</details>' +
        H.amt({ k: key, min: lo, max: hi, step: 100, def: m.price, act: 'setprice', attrs: ' data-m="' + m.id + '"', cls: 'primary', fmt: v => 'Prix : ' + money(v) + (v !== m.price ? ' (appliquer)' : ''), lbl: 'Prix catalogue' }) +
        (m.state === 'sale' && m.tl != null && techLag(G, m.tl) ? '<p class="neg" style="font-size:12.5px">Retard technologique : ses pièces sont dépassées de ' + techLag(G, m.tl) + ' niveau' + (techLag(G, m.tl) > 1 ? 'x' : '') + ' — design perçu −' + 5 * techLag(G, m.tl) + '. Fais un redesign de la pièce en retard puis une mise à jour mécanique.</p>' : '') +
        (m.state === 'sale' && mechUp(p, m) ? (u => '<div class="row"><span class="muted grow" style="font-size:12px">Nouvelle génération disponible : ' + u.from.map((x, i) => [u.eng, u.chs, u.gbx][i] !== x ? esc((x.fname || '') + ' G' + (x.gen || 1)) + ' → G' + ([u.eng, u.chs, u.gbx][i].gen || 1) : '').filter(Boolean).join(', ') + '</span>' + H.btn('Mise à jour mécanique (' + money(u.cost) + ')', 'migrate', { m: m.id }, { cls: 'small primary', off: p.cash < u.cost, why: 'Trésorerie insuffisante.' }) + '</div>')(mechUp(p, m)) : '') + (m.state === 'sale' ? '<div class="row">' + H.btn('Restyler (' + money(restyleCost(m)) + ')', 'facelift', { m: m.id }, { cls: 'small' }) + H.btn('Retirer de la vente', 'stopmodel', { m: m.id }, { cls: 'small' }) + '</div><div class="row"><span class="muted" style="font-size:12px">Promotion 3 mois :</span>' + [5, 10, 15].map(v => H.btn('−' + v + ' %', 'promo', { m: m.id, v: v / 100 }, { cls: 'small' })).join('') + '</div>' : '') });
    }).join('')) : '<p class="muted">Aucun modèle pour l\'instant.</p>');
}
function panelUsines(G, p) {
  const ready = factReady(p, G), pend = p.fact.filter(f => f.ready > G.day), cap = capOf(p, G);
  return '<div class="row"><h2 class="grow">Usines</h2>' + H.btn('Construire', 'newfact', {}, { cls: 'primary' }) + '</div>' +
    H.tiles([['Capacité', nf(cap) + ' /mois'], ['Utilisation', TE.pct(p.util || 0)], ['Demande non servie', nf(Math.max(0, (p.mo ? p.mo.demand : 0) - (p.mo ? p.mo.units : 0))) + ' véh.'], ['Coût du travail', 'indice ' + nf(labIdx(p, G), 2)]]) +
    ((p.util || 0) > 0.95 ? '<p class="neg">Tes usines sont saturées : des clients repartent sans voiture. Pense à augmenter la capacité.</p>' : '') +
    H.bento(ready.map(f => { const lv = f.auto || 0, ev = f.eco || 0, ex = f.exp, step = n => { const cost = Math.round(factCost(f.c, n) * 0.7); return H.btn('+' + nf(n), 'fexp', { f: f.id, n }, { cls: 'small', off: !!ex || p.cash < cost, why: ex ? 'Extension déjà en cours.' : 'Trésorerie insuffisante : ' + money(cost) + '.' }); };
      return H.fold('f' + f.id, { img: facArt(f), title: esc(COUNTRIES[f.c].n) + (f.spec ? ' ' + H.pill('spécialisée ' + SEG[f.spec], 'info') : '') + (f.conv > G.day ? ' ' + H.pill('reconversion', 'warn') : '') + (ex ? ' ' + H.pill('extension en cours', 'info') : ''), metrics: [['Capacité', nf(f.cap * fMode(f).cap) + '/m'], ['Frais fixes', money(fFix(f))], ['Régime', fMode(f).n]], body:
        H.kv([['Zone sans douane', COUNTRIES[f.c].zone === 'EU' ? 'UE' : COUNTRIES[f.c].n], ['Capacité nominale', nf(f.cap) + ' véh./mois'], ['Travail (effectif)', 'indice ' + nf(fLab(f), 2)], ['Frais fixes', money(fFix(f)) + '/mois'], ['Automatisation', lv + ' / 3'], ['Efficacité énergétique', ev + ' / 2']]) +
        '<h3>Régime d\'exploitation</h3><p class="muted">Économe : −25 % de frais fixes, −15 % de capacité. Intensif : +15 % de capacité, +30 % de frais, main-d\'œuvre +5 %. Changement immédiat et gratuit.</p>' + H.seg('fmode', f.id, f.mode == null ? 1 : f.mode, FMODE.map(x => x.n)) +
        '<h3>Améliorer</h3><div class="row">' + H.btn('Automatisation ' + (lv + 1) + (lv < 3 ? ' · ' + money(f.cap * 5000 * (1 + lv)) : ''), 'fup', { f: f.id, k: 'auto' }, { cls: 'small', off: lv >= 3 || p.cash < f.cap * 5000 * (1 + lv), why: lv >= 3 ? 'Niveau maximal.' : 'Trésorerie insuffisante.' }) + H.btn('Énergie ' + (ev + 1) + (ev < 2 ? ' · ' + money(f.cap * 600 * (1 + ev)) : ''), 'fup', { f: f.id, k: 'eco' }, { cls: 'small', off: ev >= 2 || p.cash < f.cap * 600 * (1 + ev), why: ev >= 2 ? 'Niveau maximal.' : 'Trésorerie insuffisante.' }) + '</div>' +
        '<p class="muted">Chaque niveau d\'automatisation : −10 % de main-d\'œuvre (donc de coût unitaire) mais +6 % de frais fixes. Chaque niveau d\'énergie : −7 % de frais fixes.</p>' +
        '<h3>Extension de capacité (5 mois)</h3><div class="row">' + [1000, 5000, 10000].map(step).join('') + '</div>' + (ex ? '<p class="muted">En cours : +' + nf(ex.cap) + ' dans ' + Math.max(1, Math.ceil((ex.ready - G.day) / 30)) + ' mois.</p>' : '<p class="muted">Coût : 70 % d\'une usine neuve de même taille.</p>') +
        '<h3>Spécialisation</h3><p class="muted">−8 % de coût sur le segment (jusqu\'au tiers de la capacité). Reconversion : ' + money(f.cap * 600) + ', capacité divisée par deux pendant deux mois.</p><div class="chips">' +
        [['', 'Polyvalente']].concat(Object.keys(SEG).map(k => [k, SEG[k]])).map(o => '<button class="chip" data-act="fspec" data-f="' + f.id + '" data-v="' + o[0] + '" aria-pressed="' + ((f.spec || '') === o[0]) + '">' + o[1] + '</button>').join('') + '</div>' }); }).join('')) +
    pend.map(f => H.card('En construction : ' + COUNTRIES[f.c].n, '<div class="muted">' + nf(f.cap) + ' véh./mois · prête dans ' + Math.ceil((f.ready - G.day) / 30) + ' mois</div>')).join('');
}
/* =============================== CARTE DU MONDE =============================== */
const WM = root.WORLDMAP;
const LAYERS = [['part', 'Ma part'], ['conc', 'Réseau'], ['notor', 'Notoriété'], ['marche', 'Marché'], ['riche', 'Richesse'], ['ads', 'Marketing'], ['douane', 'Douanes']];
const LAYER_LEG = { part: ['0 %', '12 % et plus'], conc: ['aucun point de vente', 'couverture complète'], notor: ['inconnue', 'très connue'], marche: ['moins de 50 k véh./an', 'plus de 20 M'], riche: ['faible', 'élevée'], ads: ['aucun', 'intense'], douane: ['libre', '40 %'] };
const CAMPS = [
  { id: 'presse', n: 'Presse et salons', cost: 1.5e6, gain: 6 },
  { id: 'tv', n: 'TV et affichage', cost: 6e6, gain: 15 },
  { id: 'sponsor', n: 'Parrainage sportif', cost: 20e6, gain: 28 }];
const applyCamp = (b, k, t, n) => { const x = b.cty[k]; x.aware = clamp(x.aware + t.gain * (1 - x.aware / 110), 0, 100); if (t.id === 'sponsor') b.brand = clamp(b.brand + Math.min(3, 0.25 * (n || 1)) / (n || 1), 5, 100); };
const campCost = (c, t) => t.cost * clamp(Math.sqrt(COUNTRIES[c].vol / 1.5e6), 0.3, 3.5);
const selList = () => (TE.UI.msel || []).filter(c => COUNTRIES[c]);
const MV = () => TE.UI.mapv || (TE.UI.mapv = { x: 0, y: 0, k: 1 });
function clampView(v) { v.k = clamp(v.k, 1, 14); v.x = clamp(v.x, 1000 * (1 - v.k), 0); v.y = clamp(v.y, 506 * (1 - v.k), 0); }
function fitView(codes) {
  const v = MV(); if (!codes.length) { v.x = 0; v.y = 0; v.k = 1; return; }
  const xs = codes.map(c => COUNTRIES[c].xy[0]), ys = codes.map(c => COUNTRIES[c].xy[1]);
  const x0 = Math.min.apply(null, xs) - 40, x1 = Math.max.apply(null, xs) + 40, y0 = Math.min.apply(null, ys) - 28, y1 = Math.max.apply(null, ys) + 28;
  v.k = clamp(Math.min(1000 / (x1 - x0), 506 / (y1 - y0)), 1, 6); v.x = -(x0 + x1) / 2 * v.k + 500; v.y = -(y0 + y1) / 2 * v.k + 253; clampView(v);
}
function layerVal(p, b, c, k) {
  const C = COUNTRIES[c], x = b.cty[c];
  switch (k) {
    case 'part': return clamp(Math.sqrt((x.share || 0) / 0.12), 0, 1);
    case 'conc': return reach(b, c);
    case 'notor': return x.aware / 100;
    case 'marche': return clamp((Math.log10(C.vol) - 4.6) / 2.8, 0, 1);
    case 'riche': return clamp(C.wealth / 1.35, 0, 1);
    case 'ads': return x.ads / 3;
    default: return localIn(p, c) ? 0 : clamp(tariffOf(c) / 0.4, 0, 1);
  }
}
function mapSVG(G, p, b) {
  if (!WM) return '<p class="muted">Carte indisponible.</p>';
  const UI = TE.UI, v = MV(), sel = new Set(selList()), lay = UI.mlayer || 'marche', fac = {};
  for (const f of p.fact) fac[f.c] = (fac[f.c] || 0) + 1;
  const tip = c => { const C = COUNTRIES[c], x = b.cty[c]; return '<title>' + esc(C.n) + ' · marché ' + nf(C.vol / 1e6, 2) + ' M · part ' + TE.pct(x.share || 0, 1) + ' · ' + x.dealers + ' conc. · notoriété ' + Math.round(x.aware) + '</title>'; };
  const cls = c => 'c v' + Math.min(6, Math.floor(layerVal(p, b, c, lay) * 6.99)) + (sel.has(c) ? ' sel' : '');
  let s = '<svg viewBox="0 0 1000 506" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Carte du monde"><rect class="sea" width="1000" height="506" data-act="mclear"/>' +
    '<g class="mg" transform="translate(' + v.x.toFixed(1) + ' ' + v.y.toFixed(1) + ') scale(' + v.k.toFixed(3) + ')"><path class="o" d="' + WM.other + '"/>';
  for (const c of CK) { const d = WM.paths[c]; if (d) s += '<path class="' + cls(c) + '" data-act="msel" data-c="' + c + '" d="' + d + '">' + tip(c) + '</path>'; }
  for (const c of CK) { const d = WM.dots[c]; if (d) s += '<circle class="' + cls(c) + '" data-act="msel" data-c="' + c + '" cx="' + d[0] + '" cy="' + d[1] + '" r="' + (3.6 / Math.sqrt(v.k)).toFixed(2) + '">' + tip(c) + '</circle>'; }
  const hx = COUNTRIES[p.home].xy;
  s += '<g class="mk home" data-x="' + hx[0] + '" data-y="' + hx[1] + '" transform="translate(' + hx[0] + ' ' + hx[1] + ') scale(' + (1 / v.k).toFixed(3) + ')"><path d="M0-9 L2.6-3 L9-3 L4-0.5 L6-7.5 L0-3.6 L-6-7.5 L-4-0.5 L-9-3 L-2.6-3Z"/></g>';
  for (const c in fac) { const xy = COUNTRIES[c].xy; s += '<g class="mk fac" data-x="' + xy[0] + '" data-y="' + xy[1] + '" transform="translate(' + xy[0] + ' ' + (xy[1] + 7) + ') scale(' + (1 / v.k).toFixed(3) + ')"><rect x="-6" y="-6" width="12" height="12" rx="3"/><text y="3.6" text-anchor="middle">' + fac[c] + '</text></g>'; }
  return s + '</g></svg>';
}
function countryCard(G, p, b, c) {
  const C = COUNTRIES[c], x = b.cty[c], mine = p.models.filter(m => m.state === 'sale'), facs = p.fact.filter(f => f.c === c);
  const extras = '<div class="wsub">Usines</div>' + (facs.length ? H.table([{ h: 'Capacité', cls: 'num', get: f => nf(f.cap) + ' véh./mois' }, { h: 'État', get: f => f.ready > G.day ? 'en construction (' + Math.ceil((f.ready - G.day) / 30) + ' mois)' : 'en service' }], facs) : '<p class="muted" style="font-size:12px">Aucune usine ici.</p>') +
    '<div class="row">' + H.btn('Construire une usine ici', 'newfact', { c }, { cls: 'small' }) + '</div>' +
    '<div class="wsub">Campagnes de notoriété</div><div class="row">' + CAMPS.map(t => H.btn(t.n + ' · ' + money(campCost(c, t)), 'camp', { c, t: t.id }, { cls: 'small', off: p.cash < campCost(c, t), why: 'Trésorerie insuffisante.' })).join('') + '</div>' +
    '<p class="muted" style="font-size:12px">Une campagne gagne de la notoriété tout de suite (de moins en moins quand le pays te connaît déjà) ; elle s\'érode ensuite lentement. Le parrainage améliore aussi l\'image de marque.</p>';
  return H.card(C.n, H.img('country-' + c) + H.tiles([['Marché / an', nf(C.vol / 1e6, 2) + ' M'], ['Pouvoir d\'achat', nf(C.wealth, 2)], ['Électrique', TE.pct(clamp(evPref(c, G), 0, 1.8) / 1.8)], ['Notoriété', Math.round(x.aware) + ' / 100'], ['Portée du réseau', TE.pct(reach(b, c))], ['Notre part', TE.pct(x.share || 0, 2)]]) +
      '<p class="muted" style="font-size:12px">Goûts : ' + Object.keys(SEG).map(s => SEG[s] + ' ' + Math.round(C.taste[s] * 100) + ' %').join(' · ') + '</p>' +
      H.kv([['Concessions', x.dealers + ' (plafond ' + nf(x.dealers * DEALER_CAP) + ' véh./mois)'], ['Droits de douane', localIn(p, c) ? 'aucun : usine dans la zone' : TE.pct(tariffOf(c)) + ' sur les importations'], ['Pouvoir d\'achat vs ton prix moyen', mine.length ? '× ' + nf(TE.sum(mine.map(m => m.price)) / mine.length / (14000 * infl(G) * (0.55 + 0.45 * C.wealth)), 2) : '–']]) +
      '<div class="row">' + [10, 50, 200].map(n => H.btn('+' + n + ' concessions (' + money(n * dealerCost(b, c)) + ')', 'dealers', { c, n }, { cls: 'small' })).join('') + (x.dealers >= 10 ? H.btn('−10', 'closed', { c, n: 10 }, { cls: 'small' }) : '') + '</div>' +
      (x.partner ? '<p class="muted" style="font-size:12px">Partenaire local actif : concessions −40 %, droits de douane divisés par deux, 4 % du chiffre d\'affaires reversé.</p>' : '<div class="row">' + H.btn('Partenaire local (' + money(partnerCost(c)) + ')', 'partner', { c }, { cls: 'small' }) + '<span class="muted" style="font-size:12px">concessions −40 %, douanes ÷2, 4 % du CA reversé</span></div>') +
      '<div class="row"><span class="muted" style="font-size:12px">Marketing</span>' + H.seg('ads', c, x.ads, ['Aucun', 'Léger', 'Fort', 'Intense']) + '<span class="muted" style="font-size:12px">' + money(ADS[x.ads] * Math.sqrt(C.vol / 1e6)) + '/mois</span></div>' +
      extras + (mine.length ? H.table([{ h: 'Modèle', get: m => esc(m.name) }, { h: 'Ventes ce mois', cls: 'num', get: m => nf(m.cs[c] || 0) }], mine) : ''));
}
function ctyCompact(G, p, b, c) {
  const S = ctyStat(G, p, b, c);
  return '<div class="crow lg">' + cAv(c, 1) + '<span class="cm"><b>' + esc(S.C.n) + '</b><small>Marché ' + mShort(S.vol) + ' · ' + (S.on ? S.x.dealers + ' concessions · part ' + TE.pct(S.sh, 2) : 'pas présent') + '</small></span></div>' + H.btn('Ouvrir la fiche pays', 'fiche', { c }, { cls: 'primary' });
}
function massPanel(G, p, b, sel) {
  const UI = TE.UI, vol = TE.sum(sel.map(c => COUNTRIES[c].vol)), dl = TE.sum(sel.map(c => b.cty[c].dealers)), aw = TE.sum(sel.map(c => b.cty[c].aware)) / sel.length;
  const sh = TE.sum(sel.map(c => (b.cty[c].share || 0) * COUNTRIES[c].vol)) / vol, nfc = p.fact.filter(f => sel.includes(f.c)).length;
  const cD = n => TE.sum(sel.map(c => n * dealerCost(b, c))), ads = lv => TE.sum(sel.map(c => ADS[lv] * Math.sqrt(COUNTRIES[c].vol / 1e6)));
  const noP = sel.filter(c => !b.cty[c].partner), cP = TE.sum(noP.map(partnerCost));
  const cap = TE.amtVal('mfcap', 3000), fl = sel.slice().sort((x, y) => COUNTRIES[y].vol - COUNTRIES[x].vol).slice(0, 12), cF = TE.sum(fl.map(c => factCost(c, cap)));
  const lvl = Array.from(new Set(sel.map(c => b.cty[c].ads)));
  const names = sel.slice().sort((x, y) => COUNTRIES[y].vol - COUNTRIES[x].vol).slice(0, 40).map(c => '<button class="chip" data-act="mdrop" data-c="' + c + '">' + esc(COUNTRIES[c].n) + ' ×</button>').join('') + (sel.length > 40 ? '<span class="muted"> +' + (sel.length - 40) + '</span>' : '');
  const ok = (cost) => ({ cls: 'small', off: p.cash < cost, why: 'Trésorerie insuffisante.' });
  return H.card(sel.length + ' pays sélectionnés', H.tiles([['Marché / an', nf(vol / 1e6, 1) + ' M'], ['Ma part', TE.pct(sh, 2)], ['Concessions', nf(dl)], ['Notoriété moyenne', Math.round(aw) + ' / 100'], ['Usines', nfc]]) + '<div class="chips wsel">' + names + '</div>') +
    H.card('Concessions (partout dans la sélection)', '<div class="row">' + [10, 50].map(n => H.btn('+' + n + ' chacun · ' + money(cD(n)), 'mdeal', { n }, ok(cD(n)))).join('') + H.btn('−10 chacun', 'mdeal', { n: -10 }, { cls: 'small' }) + '</div>' +
      '<div class="row">' + (noP.length ? H.btn('Partenaire local · ' + noP.length + ' pays · ' + money(cP), 'mpart', {}, ok(cP)) : '<span class="muted" style="font-size:12px">Partenaire local déjà actif partout.</span>') + '</div>') +
    H.card('Marketing continu', '<div class="row">' + [0, 1, 2, 3].map(lv => H.btn(['Aucun', 'Léger', 'Fort', 'Intense'][lv] + ' · ' + money(ads(lv)) + '/mois', 'mads', { v: lv }, { cls: 'small' + (lvl.length === 1 && lvl[0] === lv ? ' on' : '') })).join('') + '</div>' +
      '<div class="wsub">Campagnes de notoriété</div><div class="row">' + CAMPS.map(t => { const c = TE.sum(sel.map(k => campCost(k, t))); return H.btn(t.n + ' · ' + money(c), 'mcamp', { t: t.id }, ok(c)); }).join('') + '</div>') +
    H.card('Usines', '<p class="muted" style="font-size:12px">Une usine par pays, dans les ' + fl.length + ' plus gros marchés de la sélection (12 maximum à la fois), prête dans 9 mois.</p>' +
      H.amt({ k: 'mfcap', min: 1000, max: 20000, step: 1000, def: 3000, fmt: v => nf(v) + ' véh./mois par usine', lbl: 'Capacité' }) +
      H.btn('Construire ' + fl.length + ' usines · ' + money(cF), 'mfact', {}, { cls: 'primary', off: p.cash < cF, why: 'Trésorerie insuffisante.' }));
}
function panelCarte(G, p) {
  const b = selB(p), UI = TE.UI, sel = selList(), lay = UI.mlayer || 'marche', multi = UI.mmode === 'multi', S = new Set(sel);
  const leg = '<div class="wleg"><span>' + LAYER_LEG[lay][0] + '</span>' + [0, 1, 2, 3, 4, 5, 6].map(i => '<i class="v' + i + '"></i>').join('') + '<span>' + LAYER_LEG[lay][1] + '</span></div>';
  const regs = ['Europe', 'Amériques', 'Afrique', 'Asie', 'Océanie'].map(ct => {
    const codes = CK.filter(k => COUNTRIES[k].cont === ct), all = codes.length && codes.every(k => S.has(k));
    return '<div class="wrg"><button class="chip cont" data-act="mreg" data-ct="' + ct + '" aria-pressed="' + all + '">' + ct + ' (tout)</button>' +
      REGK.filter(r => REGL[r][1] === ct).map(r => { const cs = CK.filter(k => COUNTRIES[k].reg === r); if (!cs.length) return ''; return '<button class="chip" data-act="mreg" data-r="' + r + '" aria-pressed="' + cs.every(k => S.has(k)) + '">' + esc(REGL[r][0]) + '</button>'; }).join('') + '</div>';
  }).join('');
  const todo = CK.filter(c => !b.cty[c].dealers).sort((x, y) => COUNTRIES[y].vol - COUNTRIES[x].vol).slice(0, 8);
  const side = !sel.length ? H.card('Par où commencer ?', '<p class="muted" style="font-size:13px">Touche un pays pour le gérer : concessions, marketing, usines, campagnes. Pour agir sur plusieurs pays d\'un coup, passe en mode « Plusieurs » ou choisis une région.</p>' +
      (todo.length ? '<div class="wsub">Grands marchés où tu n\'as aucune concession</div><div class="chips">' + todo.map(c => '<button class="chip" data-act="msel" data-c="' + c + '">' + esc(COUNTRIES[c].n) + ' · ' + nf(COUNTRIES[c].vol / 1e6, 1) + ' M</button>').join('') + '</div>' : '')) :
    sel.length === 1 ? ctyCompact(G, p, b, sel[0]) : massPanel(G, p, b, sel);
  return '<h2>Carte du monde</h2>' + brandChips(p) + '<div class="wlayout"><div class="wmain">' +
    '<div class="wmap"><div class="wzoom"><button data-act="mzoom" data-v="in" aria-label="Zoom avant">+</button><button data-act="mzoom" data-v="out" aria-label="Zoom arrière">−</button><button data-act="mzoom" data-v="fit" aria-label="Recentrer">⌂</button></div>' + mapSVG(G, p, b) + leg + '</div>' +
    '<div class="wtools"><div class="wtl"><span>Afficher</span>' + H.chips('set', 'mlayer', lay, LAYERS) + '</div>' +
    '<div class="wtl"><span>Sélection</span>' + H.chips('set', 'mmode', multi ? 'multi' : 'one', [['one', 'Un pays'], ['multi', 'Plusieurs']]) + '<div class="chips"><button class="chip" data-act="mall">Tous</button><button class="chip" data-act="mpres">Où je vends</button><button class="chip" data-act="mabs">Où je ne vends pas</button><button class="chip" data-act="mnone">Aucun</button></div></div>' +
    '<details class="wreg" open><summary>Sélection par région</summary>' + regs + '</details></div></div><div class="wside">' + side + '</div></div>';
}

/* =============================== RAPPORT DE MARCHÉ =============================== */
const SEGK = Object.keys(SEG), CONTS = ['Europe', 'Amériques', 'Afrique', 'Asie', 'Océanie'];
function repCalc(G, p) {
  const R = G.game.rep, n = R ? R.n : 0, K = n ? 1 / (1 - Math.pow(11 / 12, Math.min(n, 400))) : 0, alive = live(G);
  const mkS = {}, mk = {}; for (const c of CK) { const a = R && R.mk[c] ? R.mk[c].map(v => v * K) : [0, 0, 0, 0, 0]; mkS[c] = a; mk[c] = TE.sum(a); }
  const cu = {};   // cu[id] = { c: [5] }
  for (const a of alive) { cu[a.id] = {}; for (const c of CK) { const r = a.rp && a.rp[c]; cu[a.id][c] = r ? r.map(v => v * K) : [0, 0, 0, 0, 0]; } }
  const ids = alive.map(a => a.id), byId = {}; for (const a of alive) byId[a.id] = a;
  // agrégation : fn(c) -> clé ; renvoie { clé: { mk, mkS, co: {id: units}, coS: {id: [5]} } }
  const agg = fn => { const o = {}; for (const c of CK) { const k = fn(c); if (k == null) continue; const e = o[k] || (o[k] = { mk: 0, mkS: [0, 0, 0, 0, 0], co: {}, coS: {}, cs: [] }); e.cs.push(c); e.mk += mk[c]; for (let i = 0; i < 5; i++) e.mkS[i] += mkS[c][i];
      for (const id of ids) { const v = cu[id][c]; e.co[id] = (e.co[id] || 0) + TE.sum(v); const s = e.coS[id] || (e.coS[id] = [0, 0, 0, 0, 0]); for (let i = 0; i < 5; i++) s[i] += v[i]; } } return o; };
  const rank = (e, id) => 1 + ids.filter(o => (e.co[o] || 0) > (e.co[id] || 0)).length;
  return { n, K, alive, ids, byId, mk, mkS, cu, agg, rank, me: p.id };
}
const pc = (v, d) => TE.pct(v, d == null ? (v > 0 && v < 0.01 ? 2 : 1) : d);
const heat = (v, mx) => 'background:color-mix(in srgb,var(--accent) ' + Math.round(clamp(v / Math.max(1e-9, mx), 0, 1) * 85) + '%,var(--card));' + (v / Math.max(1e-9, mx) > 0.55 ? 'color:#fff' : '');
const rbar = (v, mx, cls) => '<span class="rbar ' + (cls || '') + '"><i style="width:' + Math.round(clamp(v / Math.max(1e-9, mx), 0, 1) * 100) + '%"></i></span>';
function panelRapport(G, p) {
  const D = repCalc(G, p), me = p.id;
  if (!D.n) return '<h2>Rapport de marché</h2>' + H.card('Pas encore de données', '<p class="muted">Le rapport se construit avec les ventes : reviens après le premier mois de jeu.</p>');
  const fz = fU('rfc'), fs = fU('rfs') || 'u';
  const world = D.agg(() => 'w').w, myW = TE.sum(Object.values(world.coS[me])), shW = myW / Math.max(1, world.mk), rkW = D.rank(world, me);
  // modèles : tous les constructeurs
  const allM = []; for (const a of D.alive) for (const m of a.models) { if (m.state === 'dev') continue; const u12 = TE.sum(m.hist.slice(-12)), um = m.hist.length ? m.hist[m.hist.length - 1] : 0; if (u12 <= 0 && um <= 0) continue; allM.push({ a, m, s: body(m).seg, u12, um, price: m.price, br: brOf(a, m).name }); }
  const segRank = {}; for (const s of SEGK) { const l = allM.filter(x => x.s === s).sort((x, y) => y.u12 - x.u12); l.forEach((x, i) => { x.rk = i + 1; x.n = l.length; }); segRank[s] = l; }
  const mine = allM.filter(x => x.a.id === me).sort((x, y) => y.u12 - x.u12);
  const segTot = i => world.mkS[i];
  // segments
  const segRows = SEGK.map((s, i) => { const myU = world.coS[me][i], mkU = world.mkS[i], lead = D.ids.slice().sort((x, y) => (world.coS[y][i]) - (world.coS[x][i]))[0]; return { s, i, myU, mkU, sh: myU / Math.max(1, mkU), rk: 1 + D.ids.filter(o => world.coS[o][i] > myU).length, lead: D.byId[lead].name, leadSh: world.coS[lead][i] / Math.max(1, mkU) }; });
  // pays
  const ctyAgg = D.agg(c => c), ctyRows = CK.map(c => { const e = ctyAgg[c], u = e.co[me] || 0; return { c, u, mk: e.mk, sh: u / Math.max(1, e.mk), rk: D.rank(e, me), cont: COUNTRIES[c].cont }; });
  const present = ctyRows.filter(r => r.u > 1);
  // continents / régions
  const contAgg = D.agg(c => COUNTRIES[c].cont), regAgg = D.agg(c => COUNTRIES[c].reg);
  const contRows = CONTS.filter(k => contAgg[k]).map(k => { const e = contAgg[k], u = e.co[me] || 0; return { k, u, mk: e.mk, sh: u / Math.max(1, e.mk), rk: D.rank(e, me), e }; });
  const regRows = REGK.filter(k => regAgg[k]).map(k => { const e = regAgg[k], u = e.co[me] || 0; return { k, n: REGL[k][0], u, mk: e.mk, sh: u / Math.max(1, e.mk), rk: D.rank(e, me) }; }).sort((x, y) => y.u - x.u);
  const nTop = present.filter(r => r.rk === 1).length, nCo = D.ids.length;
  // --- synthèse automatique
  const ins = [];
  if (mine[0]) ins.push('Ton modèle le plus vendu est <b>' + esc(mine[0].m.name) + '</b> (' + nf(mine[0].u12) + ' véh. sur 12 mois), n° ' + mine[0].rk + ' sur ' + mine[0].n + ' en ' + SEG[mine[0].s].toLowerCase() + '.');
  const bestC = present.slice().sort((x, y) => y.u - x.u)[0]; if (bestC) ins.push('Premier pays : <b>' + COUNTRIES[bestC.c].n + '</b> (' + nf(bestC.u) + ' véh., ' + pc(bestC.sh, 2) + ' du marché, n° ' + bestC.rk + ').');
  if (nTop) ins.push('Tu es n° 1 dans <b>' + nTop + ' pays</b>.');
  const bestS = segRows.filter(r => r.myU > 0).sort((x, y) => y.sh - x.sh)[0]; if (bestS) ins.push('Segment le plus fort : <b>' + SEG[bestS.s] + '</b> (' + pc(bestS.sh, 2) + ', n° ' + bestS.rk + ').');
  const pot = ctyRows.filter(r => r.mk > 0.4e6 && r.sh < 0.01).sort((x, y) => y.mk - x.mk)[0]; if (pot) ins.push('Plus gros marché sous-exploité : <b>' + COUNTRIES[pot.c].n + '</b> (' + nf(pot.mk / 1e6, 1) + ' M de véhicules par an, ta part : ' + pc(pot.sh, 2) + ').');
  // --- sections
  const tiles = H.tiles([['Ventes sur 12 mois', nf(myW) + ' véh.'], ['Part mondiale', pc(shW, 2)], ['Rang constructeurs', rkW + ' / ' + nCo], ['Pays où je vends', present.length], ['Pays n° 1', nTop], ['Marché mondial', nf(world.mk / 1e6, 1) + ' M']]);
  const tbModels = H.table([
    { h: '#', cls: 'num', get: r => r._i }, { h: 'Modèle', get: r => esc(r.m.name) + (r.m.state === 'end' ? ' <span class="pill">fin de vie</span>' : '') }, { h: 'Segment', get: r => SEG[r.s] },
    { h: 'Ventes 12 m', cls: 'num', get: r => nf(r.u12) }, { h: 'Dernier mois', cls: 'num', get: r => nf(r.um) }, { h: 'Part du segment', cls: 'num', get: r => pc(r.u12 / Math.max(1, segTot(SEGK.indexOf(r.s))), 2) },
    { h: 'Rang', cls: 'num', get: r => r.rk + ' / ' + r.n }, { h: 'Prix', cls: 'num', get: r => money(r.price) }, { h: '1er pays (mois)', get: r => { const e = Object.entries(r.m.cs || {}).sort((x, y) => y[1] - x[1])[0]; return e ? COUNTRIES[e[0]].n : '–'; } }], mine.slice(0, 15).map((r, i) => Object.assign({ _i: i + 1 }, r)));
  const mxC = present.length ? Math.max.apply(null, present.map(r => r.u)) : 1;
  const topC = present.slice().sort((x, y) => y.u - x.u).slice(0, 15);
  const tbCountries = H.table([{ h: '#', cls: 'num', get: r => r._i }, { h: 'Pays', get: r => esc(COUNTRIES[r.c].n) }, { h: 'Continent', get: r => r.cont }, { h: 'Ventes 12 m', cls: 'num', get: r => nf(r.u) + rbar(r.u, mxC) }, { h: 'Marché 12 m', cls: 'num', get: r => nf(r.mk) }, { h: 'Part', cls: 'num', get: r => pc(r.sh, 2) }, { h: 'Rang', cls: 'num', get: r => r.rk + ' / ' + nCo }], topC.map((r, i) => Object.assign({ _i: i + 1 }, r)));
  const mxK = Math.max(1, Math.max.apply(null, contRows.map(r => r.u)));
  const tbCont = H.table([{ h: 'Continent', get: r => r.k }, { h: 'Ventes 12 m', cls: 'num', get: r => nf(r.u) + rbar(r.u, mxK) }, { h: 'Marché 12 m', cls: 'num', get: r => nf(r.mk) }, { h: 'Part', cls: 'num', get: r => pc(r.sh, 2) }, { h: 'Rang', cls: 'num', get: r => r.rk + ' / ' + nCo }], contRows);
  const tbReg = H.table([{ h: 'Région', get: r => esc(r.n) }, { h: 'Ventes 12 m', cls: 'num', get: r => nf(r.u) }, { h: 'Marché 12 m', cls: 'num', get: r => nf(r.mk) }, { h: 'Part', cls: 'num', get: r => pc(r.sh, 2) }, { h: 'Rang', cls: 'num', get: r => r.rk + ' / ' + nCo }], regRows);
  const tbSeg = H.table([{ h: 'Segment', get: r => SEG[r.s] }, { h: 'Mes ventes 12 m', cls: 'num', get: r => nf(r.myU) }, { h: 'Marché 12 m', cls: 'num', get: r => nf(r.mkU) }, { h: 'Ma part', cls: 'num', get: r => pc(r.sh, 2) }, { h: 'Rang', cls: 'num', get: r => r.rk + ' / ' + nCo }, { h: 'Leader', get: r => esc(r.lead) + ' · ' + pc(r.leadSh, 1) }], segRows);
  const mxH = Math.max(1e-9, Math.max.apply(null, [].concat.apply([], contRows.map(r => SEGK.map((s, i) => r.e.coS[me][i] / Math.max(1, r.e.mkS[i]))))));
  const matrix = '<div class="tbl"><table class="mx"><thead><tr><th>Ma part de marché</th>' + SEGK.map(s => '<th class="num">' + SEG[s] + '</th>').join('') + '<th class="num">Tous</th></tr></thead><tbody>' +
    contRows.map(r => '<tr><td>' + r.k + '</td>' + SEGK.map((s, i) => { const v = (r.e.coS[me][i]) / Math.max(1, r.e.mkS[i]); return '<td class="num" style="' + heat(v) + '">' + pc(v, 1) + '</td>'; }).join('') + '<td class="num" style="' + heat(r.sh, mxH) + '">' + pc(r.sh) + '</td></tr>').join('') +
    '<tr><td><b>Monde</b></td>' + SEGK.map((s, i) => { const v = world.coS[me][i] / Math.max(1, world.mkS[i]); return '<td class="num" style="' + heat(v, mxH) + '"><b>' + pc(v) + '</b></td>'; }).join('') + '<td class="num" style="' + heat(shW, mxH) + '"><b>' + pc(shW) + '</b></td></tr></tbody></table></div>';
  const folds = SEGK.map((s, i) => { const l = segRank[s], top = l.slice(0, 10), mySeg = l.filter(x => x.a.id === me && x.rk > 10), sr = segRows[i];
    const tb = H.table([{ h: '#', cls: 'num', get: r => r.rk }, { h: 'Modèle', get: r => esc(r.m.name) }, { h: 'Constructeur / marque', get: r => esc(r.br) }, { h: 'Ventes 12 m', cls: 'num', get: r => nf(r.u12) }, { h: 'Part du segment', cls: 'num', get: r => pc(r.u12 / Math.max(1, sr.mkU), 2) }, { h: 'Prix', cls: 'num', get: r => money(r.price) }].map(c => c), top.map(r => Object.assign({ _cls: r.a.id === me ? 'me' : '' }, r)).concat(mySeg.map(r => Object.assign({ _cls: 'me' }, r))));
    const bestMine = l.find(x => x.a.id === me);
    return H.fold('rk' + s, { title: SEG[s], metrics: [['Ma part', pc(sr.sh, 2)], ['Mon rang', sr.rk + ' / ' + nCo], ['Mon meilleur modèle', bestMine ? 'n° ' + bestMine.rk : '–']], body: '<p class="muted" style="font-size:12px">Marché mondial : ' + nf(sr.mkU) + ' véh. sur 12 mois · ' + l.length + ' modèles en vente · leader : ' + esc(sr.lead) + '.</p>' + tb });
  }).join('');
  const rows = ctyRows.filter(r => (!fz || r.cont === fz)).sort(fs === 'sh' ? (x, y) => y.sh - x.sh : fs === 'mk' ? (x, y) => y.mk - x.mk : (x, y) => y.u - x.u);
  const flt = H.filter('Continent', 'rfc', fz, [['', 'Tous']].concat(CONTS.map(c => [c, c]))) + H.filter('Trier par', 'rfs', fs, [['u', 'Mes ventes'], ['sh', 'Ma part'], ['mk', 'Marché']]);
  const tbAll = H.table([{ h: 'Pays', get: r => esc(COUNTRIES[r.c].n) }, { h: 'Mes ventes 12 m', cls: 'num', get: r => nf(r.u) }, { h: 'Marché 12 m', cls: 'num', get: r => nf(r.mk) }, { h: 'Ma part', cls: 'num', get: r => pc(r.sh, 2) }, { h: 'Rang', cls: 'num', get: r => r.u > 1 ? r.rk + ' / ' + nCo : '–' }], rows.slice(0, 200));
  const upd = G.day;
  return '<div class="rpt"><h2>Rapport de marché</h2><p class="muted" style="font-size:13px;margin-top:-4px">Chiffres sur 12 mois glissants, tous constructeurs confondus' + (D.n < 12 ? ' (la période se complète : ' + D.n + ' mois de données)' : '') + '. « Marché » = demande totale du pays, y compris les autres marques non détaillées.</p>' +
    tiles + H.card('Ce qu\'il faut retenir', '<ul class="ins">' + ins.map(x => '<li>' + x + '</li>').join('') + '</ul>') +
    '<h3 class="rh">Mes modèles les plus vendus</h3>' + (mine.length ? tbModels : '<p class="muted">Aucun modèle vendu pour l\'instant.</p>') +
    '<h3 class="rh">Où je vends le plus</h3>' + tbCountries +
    '<h3 class="rh">Ma part de marché par segment</h3>' + tbSeg +
    '<h3 class="rh">Continents et régions</h3>' + tbCont + tbReg +
    '<h3 class="rh">Part de marché : segment × continent</h3>' + matrix +
    '<h3 class="rh">Classement des modèles par catégorie</h3><p class="muted" style="font-size:12px">Tous les modèles vendus dans le monde, constructeurs rivaux compris. Tes modèles sont surlignés.</p><div class="bento">' + folds + '</div>' +
    '<h3 class="rh">Tous les pays</h3>' + filtersCard('rapport', [fz].filter(Boolean).length, rows.length, CK.length, flt, 'rfc,rfs') + tbAll + '</div>';
}

/* =============================== PAYS : liste guidée + fiche en feuille =============================== */
const CCOL = { Europe: '#1d5f82', 'Amériques': '#b8481b', Afrique: '#c7792a', Asie: '#7a4fa3', 'Océanie': '#2f7a6b' };
const noAcc = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mShort = v => v >= 1e6 ? nf(v / 1e6, v >= 1e7 ? 0 : 1) + ' M' : nf(Math.round(v / 1e3)) + ' k';
function ctyStat(G, p, b, c) {
  const C = COUNTRIES[c], x = b.cty[c], r = reach(b, c), tar = localIn(p, c) ? 0 : tariffOf(c);
  return { C, x, r, tar, vol: C.vol, sh: x.share || 0, on: x.dealers > 0, score: C.vol * (0.4 + C.wealth) * (1 - tar) * (1 - r) };
}
function ctyAdvice(G, p, b, c) {
  const r = ctyAdvice0(G, p, b, c); if (r.act) { try { if (r.act[1] === 'dealers') r.imp = dealImpact(G, p, b, c, r.act[2].n); else if (r.act[1] === 'camp') r.imp = campImpact(G, p, b, c, CAMPS.find(t => t.id === r.act[2].t)); else if (r.act[1] === 'partner') r.imp = partImpact(G, p, b, c); } catch (e) { r.imp = null; } } return r;
}
function ctyAdvice0(G, p, b, c) {
  const S = ctyStat(G, p, b, c), x = S.x, C = S.C, camp = CAMPS[0], cc = campCost(c, camp);
  if (!S.on) return { tone: 'go', t: 'Marché de ' + mShort(C.vol) + ' véhicules par an où tu n\'as aucun point de vente' + (S.tar > 0.15 ? '. Les droits de douane sont de ' + TE.pct(S.tar) + ' : un partenaire local les divise par deux.' : '.'), act: ['Ouvrir 10 concessions · ' + money(10 * dealerCost(b, c)), 'dealers', { c, n: 10 }, p.cash < 10 * dealerCost(b, c)] };
  if (x.aware < 30) return { tone: 'warn', t: 'Peu de clients te connaissent ici (' + Math.round(x.aware) + ' / 100). Les concessions ne suffisent pas sans notoriété.', act: [camp.n + ' · ' + money(cc), 'camp', { c, t: camp.id }, p.cash < cc] };
  if (S.r < 0.5) return { tone: 'go', t: 'Ton réseau ne couvre que ' + TE.pct(S.r) + ' du marché. Chaque concession ajoute des ventes possibles.', act: ['+50 concessions · ' + money(50 * dealerCost(b, c)), 'dealers', { c, n: 50 }, p.cash < 50 * dealerCost(b, c)] };
  if (S.tar > 0.15 && !x.partner) return { tone: 'warn', t: 'Les droits de douane (' + TE.pct(S.tar) + ') pèsent sur tes marges. Un partenaire local ou une usine dans la zone les réduit.', act: ['Partenaire local · ' + money(partnerCost(c)), 'partner', { c }, p.cash < partnerCost(c)] };
  if (x.ads === 0 && x.aware < 70) return { tone: 'go', t: 'Sans marketing continu, ta notoriété s\'érode lentement. Un niveau léger la maintient.', act: ['Marketing léger · ' + money(ADS[1] * Math.sqrt(C.vol / 1e6)) + '/mois', 'ads', { k: c, v: 1 }, false] };
  return { tone: 'ok', t: 'Position solide ici : réseau, notoriété et coûts sont en bon état. Surveille simplement ta part face aux rivaux.' };
}
const cAv = (c, big) => '<span class="cav' + (big ? ' lg' : '') + '" style="--cc:' + (CCOL[COUNTRIES[c].cont] || '#555') + '">' + c + '</span>';
function ctyRow(G, p, b, c, why) {
  const S = ctyStat(G, p, b, c), st = S.on ? S.x.dealers + ' concessions' : 'pas présent';
  return '<button class="crow' + (S.on ? '' : ' off') + '" data-act="fiche" data-c="' + c + '">' + cAv(c) + '<span class="cm"><b>' + esc(S.C.n) + '</b><small>' + (why || ('Marché ' + mShort(S.vol) + ' · ' + st)) + '</small></span>' +
    '<span class="cs">' + (S.on ? '<b>' + TE.pct(S.sh, S.sh < 0.01 ? 2 : 1) + '</b><i class="mb"><u style="width:' + Math.round(clamp(Math.sqrt(S.sh / 0.12), 0, 1) * 100) + '%"></u></i>' : '<em>Ouvrir</em>') + '</span></button>';
}
function paysList(G, p, b) {
  const U = TE.UI, tab = U.ptab || 'mine', q = noAcc(U.psq || ''), zone = U.pzone || '', n = U.pmore || 12;
  let ids = CK.slice();
  if (tab === 'mine') ids = ids.filter(c => b.cty[c].dealers > 0).sort((x, y) => (b.cty[y].share || 0) * COUNTRIES[y].vol - (b.cty[x].share || 0) * COUNTRIES[x].vol || b.cty[y].dealers - b.cty[x].dealers);
  else if (tab === 'opp') ids = ids.filter(c => !(b.cty[c].dealers > 0 && reach(b, c) > 0.6)).sort((x, y) => ctyStat(G, p, b, y).score - ctyStat(G, p, b, x).score);
  else ids = ids.sort((x, y) => COUNTRIES[y].vol - COUNTRIES[x].vol);
  if (q) ids = ids.filter(c => noAcc(COUNTRIES[c].n).includes(q) || c.toLowerCase() === q);
  if (zone) ids = ids.filter(c => COUNTRIES[c].cont === zone);
  const lim = tab === 'opp' && !q ? Math.min(n, 20) : n, shown = ids.slice(0, lim);
  if (!ids.length) return '<p class="muted pempty">' + (tab === 'mine' && !q && !zone ? 'Tu ne vends encore nulle part. Passe à « Opportunités » pour choisir ton premier marché.' : 'Aucun pays ne correspond.') + '</p>';
  const why = c => { const S = ctyStat(G, p, b, c); return mShort(S.vol) + ' véh./an' + (S.on ? ' · réseau ' + TE.pct(S.r) : ' · aucun réseau') + (S.tar > 0.15 ? ' · douane ' + TE.pct(S.tar) : ''); };
  return shown.map(c => ctyRow(G, p, b, c, tab === 'opp' ? why(c) : null)).join('') + (ids.length > lim ? '<button class="btn small pmore" data-act="pmore">Voir plus (' + (ids.length - lim) + ')</button>' : '');
}
function panelPays(G, p) {
  const b = selB(p), U = TE.UI, tab = U.ptab || 'mine', on = CK.filter(c => b.cty[c].dealers > 0).length, dl = TE.sum(CK.map(c => b.cty[c].dealers));
  const ZN = ['Europe', 'Amériques', 'Afrique', 'Asie', 'Océanie'];
  const hero = '<div class="phero"><div><b>' + on + '</b><small>pays actifs</small></div><div><b>' + nf(dl) + '</b><small>concessions</small></div><div><b>' + TE.pct(p.gshare || 0, 2) + '</b><small>part mondiale</small></div></div>';
  const tabs = '<div class="ptabs3" role="tablist">' + [['mine', 'Mes marchés'], ['opp', 'Opportunités'], ['all', 'Tous']].map(t => '<button role="tab" data-act="set" data-k="ptab" data-v="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>').join('') + '</div>';
  const tools = '<div class="ptools"><input class="psq" type="search" data-psq="1" placeholder="Rechercher un pays" value="' + esc(U.psq || '') + '" autocomplete="off" aria-label="Rechercher un pays"><div class="zchips">' +
    [['', 'Tous']].concat(ZN.map(z => [z, z])).map(z => '<button class="chip" data-act="set" data-k="pzone" data-v="' + z[0] + '" aria-pressed="' + ((U.pzone || '') === z[0]) + '">' + z[1] + '</button>').join('') + '</div></div>';
  const intro = tab === 'opp' ? '<p class="muted pint">Classés par potentiel : taille du marché, richesse, droits de douane et place qu\'il te reste à prendre.</p>' : '';
  return '<div class="pays"><h2>Pays</h2>' + brandChips(p) + hero + tabs + tools + intro + '<div class="plist">' + paysList(G, p, b) + '</div></div>';
}
function modalPays(M, G, p) {
  const c = COUNTRIES[M.c] ? M.c : p.home, b = selB(p), S = ctyStat(G, p, b, c), C = S.C, x = S.x, t = M.t || 'apercu', adv = ctyAdvice(G, p, b, c), mine = p.models.filter(m => m.state === 'sale');
  const e = (G.game.rep && G.game.rep.n) ? null : null;
  const badge = !S.on ? '<span class="pill">Pas encore présent</span>' : '<span class="pill pos">' + TE.pct(S.sh, 2) + ' de part</span>';
  const head = '<div class="fhead">' + cAv(c, 1) + '<div><h2>' + esc(C.n) + '</h2><span class="muted">' + C.cont + ' · ' + mShort(C.vol) + ' véh./an</span>' + badge + '</div></div>';
  const tabs = '<div class="ptabs4" role="tablist">' + [['apercu', 'Aperçu', 'qualite'], ['reseau', 'Réseau', 'pays'], ['marketing', 'Marketing', 'marque'], ['usine', 'Usine', 'usines']].map(k => '<button role="tab" data-act="mset" data-k="t" data-v="' + k[0] + '" aria-selected="' + (t === k[0]) + '">' + H.ico(k[2]) + '<span>' + k[1] + '</span></button>').join('') + '</div>';
  const dc = n => n * dealerCost(b, c), adsC = lv => ADS[lv] * Math.sqrt(C.vol / 1e6);
  let body = '';
  if (t === 'apercu') {
    const q = (lbl, v, sub) => '<div class="qs"><small>' + lbl + '</small><b>' + v + '</b>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>';
    body = '<div class="advice ' + adv.tone + '"><small>' + (adv.tone === 'ok' ? 'Bilan' : 'Conseil') + '</small><p>' + adv.t + '</p>' + (adv.imp ? '<p class="imp ' + impCls(adv.imp) + '">Effet estimé : ' + impU(adv.imp) + (adv.imp.dk > 0 ? ' · ' + money(adv.imp.dk) + '/mois' : '') + ' · rentable en ' + impPay(adv.imp) + '</p>' : '') + '</div>' +
      '<div class="qgrid">' + q('Notoriété', Math.round(x.aware) + ' / 100') + q('Réseau', TE.pct(S.r), x.dealers + ' conc.') + q('Droits', S.tar ? TE.pct(S.tar) : '0 %', localIn(p, c) ? 'usine dans la zone' : (x.partner ? 'partenaire actif' : '')) + '</div>' +
      '<details class="fold2"><summary>Profil du marché</summary>' + H.kv([['Pouvoir d\'achat', nf(C.wealth, 2)], ['Électrique', TE.pct(clamp(evPref(c, G), 0, 1.8) / 1.8)], ['Coût du travail', nf(C.lab, 2)], ['Goûts', Object.keys(SEG).map(k => SEG[k] + ' ' + Math.round(C.taste[k] * 100) + ' %').join(' · ')]]) + '</details>' +
      (mine.length ? '<details class="fold2"><summary>Mes ventes ici ce mois</summary>' + H.kv(mine.map(m => [esc(m.name), nf(m.cs[c] || 0)])) + '</details>' : '');
  } else if (t === 'reseau') {
    body = '<div class="bigc"><b>' + nf(x.dealers) + '</b><span>concessions<br><small>jusqu\'à ' + nf(x.dealers * DEALER_CAP) + ' véh./mois</small></span><span class="reach"><i style="width:' + Math.round(S.r * 100) + '%"></i><small>couverture ' + TE.pct(S.r) + '</small></span></div>' +
      '<div class="opts">' + [10, 50, 200].map(n => { const i = dealImpact(G, p, b, c, n); return '<button class="opt" data-act="dealers" data-c="' + c + '" data-n="' + n + '"' + (p.cash < dc(n) ? ' disabled' : '') + '><b>+' + n + '</b><small>' + money(dc(n)) + '</small><em class="' + impCls(i) + '">' + impU(i) + '<br>' + impPay(i) + '</em></button>'; }).join('') + (x.dealers >= 10 ? '<button class="opt neg" data-act="closed" data-c="' + c + '" data-n="10"><b>−10</b><small>fermer</small></button>' : '') + '</div>' +
      '<div class="advice ' + (x.partner ? 'ok' : 'go') + '"><small>Partenaire local</small><p>' + (x.partner ? 'Actif : concessions −40 %, douanes ÷2, 4 % du chiffre d\'affaires reversé.' : 'Concessions −40 %, douanes ÷2, en échange de 4 % du chiffre d\'affaires.') + '</p>' + (x.partner ? '' : (() => { const i = partImpact(G, p, b, c); return (x.dealers && i.dk > 0 ? '<p class="imp ' + impCls(i) + '">Effet estimé : +' + money(i.dk) + '/mois de marge · rentable en ' + impPay(i) + '</p>' : '') + H.btn('Signer · ' + money(partnerCost(c)), 'partner', { c }, { cls: 'small', off: p.cash < partnerCost(c), why: 'Trésorerie insuffisante.' }); })()) + '</div>' + (mine.length ? '<p class="muted fnote">Estimations sur le marché et les rivales d\'aujourd\'hui, concessions et frais inclus.</p>' : '<p class="muted fnote">Aucun modèle en vente : les estimations sont nulles.</p>');
  } else if (t === 'marketing') {
    body = '<h3 class="fh">Marketing continu</h3><div class="opts four">' + ['Aucun', 'Léger', 'Fort', 'Intense'].map((n, lv) => '<button class="opt' + (x.ads === lv ? ' on' : '') + '" data-act="ads" data-k="' + c + '" data-v="' + lv + '"><b>' + n + '</b><small>' + (lv ? money(adsC(lv)) + '/m' : 'gratuit') + '</small></button>').join('') + '</div>' +
      '<h3 class="fh">Campagne ponctuelle <span class="muted">notoriété ' + Math.round(x.aware) + ' / 100</span></h3><div class="camps">' + CAMPS.map(k => (() => { const i = campImpact(G, p, b, c, k); return '<button class="camp" data-act="camp" data-c="' + c + '" data-t="' + k.id + '"' + (p.cash < campCost(c, k) ? ' disabled' : '') + '><span><b>' + k.n + '</b><small>+' + k.gain + ' pts · ' + money(campCost(c, k)) + '</small></span><em class="' + (x.dealers ? impCls(i) : '') + '">' + (x.dealers ? impU(i) + '<br>' + impPay(i) : 'sans réseau') + '</em></button>'; })()).join('') + '</div>' +
      '<p class="muted fnote">Une campagne agit tout de suite (moins quand le pays te connaît déjà) puis s\'érode. Le parrainage améliore aussi l\'image de marque.</p>';
  } else {
    const facs = p.fact.filter(f => f.c === c);
    body = (facs.length ? facs.map(f => '<div class="fr"><b>' + nf(f.cap) + ' véh./mois</b><span class="pill ' + (f.ready > G.day ? '' : 'pos') + '">' + (f.ready > G.day ? 'prête dans ' + Math.ceil((f.ready - G.day) / 30) + ' mois' : 'en service') + '</span></div>').join('') : '<div class="advice"><small>Aucune usine ici</small><p>' + (S.tar > 0 ? 'Produire dans la zone supprime les droits de douane de ' + TE.pct(tariffOf(c)) + ' et rapproche le coût du travail (indice ' + nf(C.lab, 2) + ').' : 'Les droits sont déjà nuls ici. Une usine servirait surtout à réduire les coûts de main-d\'œuvre (indice ' + nf(C.lab, 2) + ').') + '</p></div>') +
      (() => { const sv = factSaving(G, p, c), up = factCost(c, 5000); return sv > 0 ? '<p class="imp ' + (up / sv <= 48 ? 'pos' : '') + '">Une usine de 5 000 véh./mois ici économiserait environ ' + money(sv) + '/mois de douanes et de transport sur tes ventes actuelles dans la zone (retour : ' + (up / sv > 120 ? 'plus de 10 ans' : nf(Math.max(1, Math.round(up / sv))) + ' mois') + ').</p>' : ''; })() +
      H.btn('Construire une usine' + (facs.length ? ' de plus' : '') + ' ici', 'newfact', { c }, { cls: 'small' });
  }
  const act = adv.act && t !== 'usine' ? H.btn(adv.act[0], adv.act[1], adv.act[2], { cls: 'primary', off: adv.act[3], why: 'Trésorerie insuffisante.' }) : '';
  return head + tabs + '<div class="fbody">' + body + '</div>' + act;
}

if (typeof document !== 'undefined') {
  document.addEventListener('input', e => { const t = e.target; if (!t || !t.dataset || t.dataset.psq == null || !TE.G) return; TE.UI.psq = t.value; TE.UI.pmore = 12; const l = document.querySelector('.plist'); if (l) l.innerHTML = paysList(TE.G, TE.player(), selB(TE.player())); });
  const pts = new Map(); let drag = null, pinch = null;
  const svgOf = e => e.target && e.target.closest && e.target.closest('.wmap svg');
  const apply = svg => { const v = MV(), g = svg.querySelector('.mg'); if (!g) return; g.setAttribute('transform', 'translate(' + v.x.toFixed(1) + ' ' + v.y.toFixed(1) + ') scale(' + v.k.toFixed(3) + ')');
    svg.querySelectorAll('circle.c').forEach(d => d.setAttribute('r', (3.6 / Math.sqrt(v.k)).toFixed(2)));
    svg.querySelectorAll('.mk').forEach(m => { const x = +m.dataset.x, y = +m.dataset.y + (m.classList.contains('fac') ? 7 : 0); m.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + (1 / v.k).toFixed(3) + ')'); }); };
  const geo = svg => { const r = svg.getBoundingClientRect(), s = Math.min(r.width / 1000, r.height / 506); return { r, s, ox: (r.width - 1000 * s) / 2, oy: (r.height - 506 * s) / 2 }; };
  const zoomAt = (svg, cx, cy, f) => { const v = MV(), o = geo(svg), px = (cx - o.r.left - o.ox) / o.s, py = (cy - o.r.top - o.oy) / o.s, k = clamp(v.k * f, 1, 14), r = k / v.k; v.x = px - (px - v.x) * r; v.y = py - (py - v.y) * r; v.k = k; clampView(v); apply(svg); };
  document.addEventListener('wheel', e => { const s = svgOf(e); if (!s) return; e.preventDefault(); zoomAt(s, e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18); }, { passive: false });
  document.addEventListener('pointerdown', e => { const s = svgOf(e); if (!s) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const v = MV();
    if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, tx: v.x, ty: v.y, moved: false }; else if (pts.size === 2) { const a = Array.from(pts.values()); pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), k: v.k }; drag = null; TE.UI.mapSkip = Date.now(); } });
  document.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const s = document.querySelector('.wmap svg'); if (!s) return;
    if (pts.size === 2 && pinch) { const a = Array.from(pts.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), v = MV(); zoomAt(s, (a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2, (pinch.k * d / pinch.d) / v.k); TE.UI.mapSkip = Date.now(); return; }
    if (drag && pts.size === 1) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.hypot(dx, dy) > 5) drag.moved = true; if (drag.moved) { const o = geo(s), v = MV(); v.x = drag.tx + dx / o.s; v.y = drag.ty + dy / o.s; clampView(v); apply(s); TE.UI.mapSkip = Date.now(); } } });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
  document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
}
DEF.liveSim = (M, c) => simLive(M, c.G, c.p); DEF.liveTop = (M, c) => simTop(M, c.G, c.p); DEF.liveLab = (k, v) => ((SIM_CTL.find(x => x[0] === k) || [0, 0, x => x])[2])(v);
DEF.api = { simRun, simInfo, simParse, partInfo, specOf, partM, blocOf: c => BLOC[c], ruleAt, homoOk, capOf, blockPrice, assets: a => DEF.assets(a), brandsOf, REGK, absYear, fuelOk, techFront, co2Limit, COUNTRIES, newBrand, grantLic, licTerms, licWilling, lics, aiBrands, acquireBrand, acqPrice, brandsOf, brOf, groupImg, stockU, selB, startPart, startModel, addFactory, factCost, compat, partOf, reach, D0, dealerCost, CK, BODIES, COUNTRIES, advice, estimate, capOf, labIdx, SEG };
Object.assign(DEF.actions, spActs);
TE.GAMES.constructeur = DEF;
if (typeof document !== 'undefined' && !root.__TE_TEST) TE.boot(DEF);
})(typeof globalThis !== 'undefined' ? globalThis : this);
