// Graphiques d'évolution : historique mondial, courbes multi-séries, aires d'énergies, lecture au toucher.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(process.env.JSDOM_FROM || import.meta.url)('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0; const errs = []; w.addEventListener('error', e => errs.push(e.message));
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
TE.newGame({ name: 'Test', diff: 1, seed: 11, cfg: { rivals: 10 }, opts: { era: 'classic' } });
const pt = () => d.getElementById('panel').textContent;
TE.UI.tab = 'conc'; TE.renderAll(true);
ok(/Les courbes apparaissent/.test(pt()), 'message d\'attente au démarrage');
for (let i = 0; i < 360 * 5; i++) TE.step();
const X = TE.G.game.hx; ok(X && X.d.length >= 58, 'historique mensuel : ' + (X && X.d.length) + ' points');
ok(Object.values(X.u).every(a => a.length === X.d.length), 'séries alignées sur le temps');
ok(X.rq.length >= 18 && Object.values(X.rs).every(R => Object.values(R).every(a => a.length === X.rq.length)), 'parts régionales trimestrielles alignées');
TE.renderAll(true);
ok(d.querySelectorAll('.mlc svg.chart polyline').length >= 4, 'courbes tracées : ' + d.querySelectorAll('.mlc svg.chart polyline').length);
ok(d.querySelector('.mll') && /Vous/.test(d.querySelector('.mll').textContent), 'légende avec valeurs');
ok(/198\d/.test(d.querySelector('.mlc svg').textContent), 'axe daté en années');
ok(d.querySelectorAll('svg.chart path').length >= 2, 'aires d\'énergies : ' + d.querySelectorAll('svg.chart path').length);
// lecture au toucher
const svg = d.querySelector('.mlc svg'); svg.getBoundingClientRect = () => ({ left: 0, width: 360, top: 0, height: 190 });
const hit = d.querySelector('.mlh'); hit.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: 200 }));
ok(/Vous/.test(d.querySelector('.mlr').textContent) && /19\d\d/.test(d.querySelector('.mlr').textContent), 'lecture au toucher : ' + d.querySelector('.mlr').textContent.slice(0, 70));
ok(d.querySelector('.mlx').getAttribute('visibility') === 'visible', 'repère vertical affiché');
// filtres
for (const [k, v] of [['cm', 's'], ['cr', '5'], ['cr', 'all'], ['crg', TE.GAMES.constructeur.api.REGK ? TE.GAMES.constructeur.api.REGK[0] : ''], ['cm', 'u']]) { TE.UI[k] = v; TE.renderAll(true); ok(!/NaN|undefined|Infinity/.test(pt()) && d.querySelectorAll('.mlc polyline').length >= 2, 'filtre ' + k + '=' + v + ' propre'); }
// décimation sur longue partie
for (let i = 0; i < 360 * 20; i++) TE.step();
ok(TE.G.game.hx.d.length < 240 && TE.G.game.hx.st >= 2, 'résolution adaptative : ' + TE.G.game.hx.d.length + ' points, pas ' + TE.G.game.hx.st);
ok(errs.length === 0, 'aucune erreur JS ' + errs.join('|')); process.exit(fails ? 1 : 0);
