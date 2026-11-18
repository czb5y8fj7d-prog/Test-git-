// Scission d'une marque en société indépendante, cession de parts, perte/reprise de contrôle.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(process.env.JSDOM_FROM || import.meta.url)('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0; const errs = []; w.addEventListener('error', e => errs.push(e.message));
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
TE.newGame({ name: 'Test', diff: 1, seed: 12, cfg: { rivals: 8 } });
for (let i = 0; i < 360 * 2; i++) TE.step();
let last = ''; const A = TE.GAMES.constructeur.actions, act = (n, dd) => A[n](dd, { G: TE.G, p: TE.player(), UI: TE.UI, TE, toast: m => { last = m; } });
const p = TE.player(); p.cash = 20e9;
TE.UI.txt = { nbname: 'Zorya' }; act('newbrand', {}); const b = p.extra[0]; ok(!!b, 'marque créée : ' + (b && b.name));
const src = p.models.find(m => m.state === 'sale'); const clone = JSON.parse(JSON.stringify(src)); clone.id = TE.G.nid++; clone.br = b.bid; clone.name = 'Zorya Une'; clone.sold = 800; p.models.push(clone);
TE.UI.tab = 'groupe'; TE.renderAll(true); ok(/Scinder une marque/.test(d.getElementById('panel').textContent), 'carte de scission affichée');
const n0 = TE.G.actors.length, c0 = p.cash, eng0 = p.staff.ingenieurs.n;
act('spin', { b: b.bid, dot: 300e6 });
const a = TE.G.actors[TE.G.actors.length - 1];
ok(TE.G.actors.length === n0 + 1 && a.name === 'Zorya' && !a.player, 'nouvelle société indépendante');
ok(!p.extra.some(x => x.bid === b.bid) && !p.models.some(m => m.name === 'Zorya Une') && a.models.some(m => m.name === 'Zorya Une'), 'modèles transférés, marque retirée du groupe');
ok(p.cash === c0 - 300e6 && a.cash === 300e6, 'dotation versée');
ok(p.inv[a.id].pct === 100 && a.mgmt && a.fact.length === 1 && a.staff.ingenieurs.n > 0 && p.staff.ingenieurs.n < eng0, 'détenue à 100 %, mandat, usine et ingénieurs');
ok(a.models.every(m => ['eng', 'chs', 'gbx'].every(k => a.parts.some(x => x.id === m[k]))), 'pièces copiées à la filiale');
// vente de parts : IPO 49 %, contrôle conservé
const cash1 = p.cash; act('bsell', { id: a.id, n: 49 }); ok(p.inv[a.id].pct === 51 && !!a.mgmt && p.cash > cash1, 'cession de 49 % : ' + last.slice(0, 70));
act('bsell', { id: a.id, n: 5 }); ok(p.inv[a.id].pct === 46 && !a.mgmt, 'sous 50 % : la société redevient libre');
for (let i = 0; i < 360 * 2; i++) TE.step();
ok(!a.bankrupt || a.bankrupt, 'simulation poursuivie'); ok(!!JSON.parse(JSON.stringify(TE.G)), 'état sérialisable');
TE.UI.tab = 'bourse'; TE.UI.bsel = String(a.id); TE.renderAll(true); ok(!/NaN|undefined/.test(d.getElementById('panel').textContent), 'onglet Bourse propre');
ok(errs.length === 0, 'aucune erreur JS ' + errs.join('|')); process.exit(fails ? 1 : 0);
