// Contrats spéciaux : offres, acceptation, livraisons mensuelles, capacité réservée, pénalités et résiliation.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(process.env.JSDOM_FROM || import.meta.url)('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0; const errs = []; w.addEventListener('error', e => errs.push(e.message));
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
TE.newGame({ name: 'Test', diff: 1, seed: 21, cfg: { rivals: 8 } });
let last = ''; const A = TE.GAMES.constructeur.actions, act = (n, dd) => A[n](dd, { G: TE.G, p: TE.player(), UI: TE.UI, TE, toast: m => { last = m; } });
let offers = 0; for (let m = 0; m < 48; m++) { for (let i = 0; i < 30; i++) TE.step(); offers = Math.max(offers, TE.G.game.ct ? TE.G.game.ct.off.length : 0); }
const p = TE.player(), S = TE.G.game.ct; ok(!!S && offers > 0, 'des appels d\'offres apparaissent (max ' + offers + ' simultanés)');
TE.UI.tab = 'contrats'; TE.renderAll(true); const pt = () => d.getElementById('panel').textContent;
ok(/Appels d'offres/.test(pt()) && !/NaN|undefined|Infinity/.test(pt()), 'onglet Contrats lisible');
// offres fabriquées : flotte (citadine) + moteurs d'écurie
const cap0 = TE.GAMES.constructeur.api.capOf(p, TE.G);
S.off.push({ id: 9001, k: 'flotte', cl: 'Poste nationale', exp: TE.G.day + 90, mo: 6, pen: 0.15, rate: 100, price: 15000, total: 600, txt: 'Citadine' });
S.off.push({ id: 9002, k: 'ecurie', cl: 'Écurie Test', exp: TE.G.day + 90, mo: 6, pen: 0.2, rate: 10, price: 40000, total: 60, eng: true, req: { fuel: 'ess', kw: 20 }, txt: 'Moteurs essence' });
S.off.push({ id: 9003, k: 'armee', cl: 'Armée', exp: TE.G.day + 90, mo: 6, pen: 0.25, rate: 100, price: 40000, total: 600, txt: 'SUV intégrale' });
act('ctok', { id: 9003 }); ok(/Aucun/.test(last) && !S.act.some(c => c.id === 9003), 'refus : aucun produit adapté (SUV intégrale)');
act('ctok', { id: 9001 }); act('ctok', { id: 9002 }); ok(S.act.length === 2, 'deux contrats acceptés');
const cash0 = p.cash; for (let i = 0; i < 70; i++) TE.step();
const c1 = S.act.find(c => c.id === 9001); ok(c1 && c1.done >= 100 && c1.done % 100 === 0, 'livraisons mensuelles : ' + (c1 && c1.done));
{ const w1 = TE.GAMES.constructeur.api.capOf(p, TE.G), sv = S.act; S.act = []; const w0 = TE.GAMES.constructeur.api.capOf(p, TE.G); S.act = sv; ok(w0 - w1 >= 100, 'capacité réservée aux contrats : ' + Math.round(w0 - w1) + ' véh./mois'); }
ok(Object.keys(p.m.in).includes('contrats') || Object.keys(p.last ? p.last : {}).length > 0, 'recettes comptabilisées');
// manquer des livraisons : on retire le modèle éligible → pénalités puis résiliation
for (const m of p.models) m.state = 'end'; const f0 = S.fail, r0 = S.rep;
for (let i = 0; i < 130; i++) TE.step(); ok(S.fail > f0 && !S.act.some(c => c.id === 9001) && S.rep < r0, 'trois livraisons manquées : contrat résilié, réputation en baisse');
act('ctno', { id: 9003 }); ok(true, 'refus sans erreur');
ok(!!JSON.parse(JSON.stringify(TE.G)), 'état sérialisable');
ok(errs.length === 0, 'aucune erreur JS ' + errs.join('|')); process.exit(fails ? 1 : 0);
