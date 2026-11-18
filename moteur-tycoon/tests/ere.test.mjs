// Mode « Années 80 » : calendrier, énergies et silhouettes datées, marchés émergents, arrivée des concurrentes.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(process.env.JSDOM_FROM || import.meta.url)('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, TE = w.TE; let fails = 0; const errs = []; w.addEventListener('error', e => errs.push(e.message));
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const def = TE.GAMES.constructeur;
TE.newGame({ name: 'Test', diff: 1, seed: 77, cfg: { rivals: 14 }, opts: { era: 'classic', scen: 'maroc' } });
let G = TE.G;
ok(/1980/.test(TE.dateStr(0)), 'départ en 1980 : ' + TE.dateStr(0));
ok(/1980/.test(G.news[0].t || G.news[0].text || JSON.stringify(G.news[0])), 'message de bienvenue d\'époque');
const rv = TE.rivals();
ok(rv.length >= 8 && rv.length <= 14, 'rivales d\'époque : ' + rv.length);
ok(rv.every(a => a.profile !== 'electrique'), 'aucune marque électrique en 1980');
ok(rv.every(a => !a.models.some(m => m.fuel === 'elec' || m.fuel === 'hyb' || /suv/.test(m.body))), 'ni électrique, ni hybride, ni SUV au départ');
const p = TE.player(), A = def.api;
ok(A.techFront(G) <= 3, 'pointe technologique basse : niveau ' + A.techFront(G));
const cn0 = A.COUNTRIES.CN.vol, us0 = A.COUNTRIES.US.vol;
for (let i = 0; i < 30; i++) TE.step();
const cn1 = A.COUNTRIES.CN.vol; ok(cn1 < A.COUNTRIES.CN.vol0 * 0.5, 'marché chinois minuscule en 1980 : ' + Math.round(cn1 / 1e3) + ' k vs ' + Math.round(A.COUNTRIES.CN.vol0 / 1e3) + ' k en 2028');
ok(A.COUNTRIES.US.vol > A.COUNTRIES.US.vol0 * 0.8, 'le marché américain est déjà mûr');
ok(A.co2Limit(G) >= 250 && !A.fuelOk(G, 'elec') && !A.fuelOk(G, 'hyb'), 'pas de limite CO₂ ni d\'énergie électrique');
ok(!!A.startPart(p, G, 'eng', { fuel: 'elec', size: 1, lvl: 2 }), 'développer un moteur électrique est refusé');
const names0 = new Set(TE.G.actors.map(a => a.name)), arrive = []; let nAct = TE.G.actors.length;
const t0 = Date.now(); for (let i = 0; i < 360 * 22; i++) { TE.step(); if (TE.G.actors.length > nAct) { for (const a of TE.G.actors.slice(nAct)) arrive.push(a); nAct = TE.G.actors.length; } }
G = TE.G; ok(Math.floor(A.absYear(G)) >= 2002, 'on est en ' + Math.floor(A.absYear(G)));
ok(arrive.length >= 2, 'des constructeurs apparaissent avec le temps : ' + arrive.map(a => a.name).join(', '));
ok(A.COUNTRIES.CN.vol > cn1 * 3, 'le marché chinois a explosé : ' + Math.round(A.COUNTRIES.CN.vol / 1e3) + ' k');
ok(A.fuelOk(G, 'hyb') && !A.fuelOk(G, 'elec') === (A.absYear(G) < 2010), 'les énergies apparaissent à leur date');
ok(A.techFront(G) >= 5, 'la technologie progresse : niveau ' + A.techFront(G));
ok(TE.rivals().some(a => a.models.some(m => /suv/.test(m.body))), 'les SUV arrivent après 1992');
ok(Date.now() - t0 < 90000, '22 ans simulés en ' + Math.round((Date.now() - t0) / 1000) + ' s');
// mode moderne inchangé
TE.newGame({ name: 'Mod', diff: 1, seed: 5, cfg: { rivals: 6 }, opts: { era: 'modern' } });
ok(/2028/.test(TE.dateStr(0)) && A.fuelOk(TE.G, 'elec') && A.techFront(TE.G) === 6, 'mode moderne : 2028, tout disponible');
ok(errs.length === 0, 'aucune erreur JS ' + errs.join('|')); process.exit(fails ? 1 : 0);
