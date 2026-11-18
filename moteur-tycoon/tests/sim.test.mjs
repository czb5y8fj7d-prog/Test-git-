// Tests headless du noyau (sans DOM) : node tests/sim.test.mjs
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console, performance, __TE_TEST: true }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['engine/core.js', 'games/ecurie/game.js', 'games/_modele/game.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const TE = ctx.TE; let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
TE.define(TE.GAMES.ecurie);

console.log('Splitting marché');
{ const E = TE.splitMarket(1000, [{ price: 100, quality: 1, cap: 900 }, { price: 100, quality: 1, cap: 100 }, { price: 100, quality: 1, cap: 1e9 }]);
  ok(Math.abs(E.reduce((s, e) => s + e.sold, 0) - 1000) < 1e-6, 'toute la demande servie quand la capacité suffit');
  ok(E[1].sold <= 100 + 1e-9, 'capacité respectée, débordement redistribué');
  const F = TE.splitMarket(1000, [{ price: 80, quality: 1, cap: 1e9 }, { price: 120, quality: 1, cap: 1e9 }]);
  ok(F[0].sold > F[1].sold, 'le moins cher capte plus de demande'); }

console.log('Partie 15 ans, 3 difficultés');
for (const diff of [0, 1, 2]) {
  TE.newGame({ name: 'Test', diff, seed: 1234 + diff, cfg: { rivals: 9 } });
  const G = TE.G; let nan = 0; const t0 = Date.now();
  for (let i = 0; i < 360 * 15; i++) {
    if (diff === 1 && i % 7 === 0) { const p = TE.player(); const area = ['aero', 'engine', 'chassis', 'reli'][(i / 7 | 0) % 4]; if (p.cash > 8e6) { TE.spend(p, 'R&D', 2e6); p.car[area] = Math.min(100, p.car[area] + 1.1); } }
    TE.step();
    if (G.over) break;
  }
  for (const a of G.actors) for (const k of ['cash', 'debt', 'rep']) if (!isFinite(a[k])) nan++;
  const alive = TE.alive().length, p = TE.player();
  console.log(`  diff ${diff}: jour ${G.day}, vivantes ${alive}/${G.actors.length}, joueur trésorerie ${TE.money(p.cash)}, pts ${p.ptsTotal}, titres ${p.titles}, over=${G.over}, ${Date.now() - t0} ms`);
  ok(nan === 0, 'aucune valeur NaN');
  ok(alive >= 4, 'le marché ne s\'effondre pas (≥4 acteurs vivants)');
  ok(G.news.length > 0 && G.game.last, 'actualités et courses générées');
  const champs = G.actors.reduce((s, a) => s + a.titles, 0);
  ok(champs >= Math.min(14, Math.floor(G.day / 360) - 1), 'un champion est désigné chaque saison (' + champs + ')');
}

console.log('Sauvegarde / chargement');
{ TE.newGame({ name: 'Save', diff: 1, seed: 7, cfg: { rivals: 5 } }); for (let i = 0; i < 400; i++) TE.step();
  const txt = TE.exportSave(), g = TE.parseSave(txt); ok(g.day === TE.G.day && g.actors.length === TE.G.actors.length, 'aller-retour JSON');
  ok(TE.save() && TE.load().day === TE.G.day, 'slot auto');
  // déterminisme : même graine → même résultat
  const run = () => { TE.newGame({ name: 'D', diff: 1, seed: 99, cfg: { rivals: 6 } }); for (let i = 0; i < 720; i++) TE.step(); return TE.G.actors.map(a => Math.round(a.cash) + ':' + a.pts).join(','); };
  ok(run() === run(), 'simulation déterministe à graine égale');
  // reprise : continuer après chargement donne la même suite que sans interruption
  TE.newGame({ name: 'R', diff: 1, seed: 5, cfg: { rivals: 6 } }); for (let i = 0; i < 300; i++) TE.step(); const snap = TE.exportSave(); for (let i = 0; i < 300; i++) TE.step(); const a1 = TE.exportSave();
  TE.importSave(snap); for (let i = 0; i < 300; i++) TE.step(); ok(TE.exportSave() === a1, 'reprise après chargement identique à la partie continue'); }

console.log('Crédit et faillite');
{ TE.newGame({ name: 'C', diff: 1, seed: 3, cfg: { rivals: 2 } }); const p = TE.player(); const lim = TE.creditLimit(p);
  ok(TE.borrow(p, lim) && !TE.borrow(p, 1e6), 'emprunt plafonné'); const d0 = p.debt; ok(TE.repay(p, 1e6) && p.debt === d0 - 1e6, 'remboursement');
  p.cash = -9e6; for (let i = 0; i < 400 && !TE.G.over; i++) { p.cash = Math.min(p.cash, -9e6); TE.step(); } ok(TE.G.over && p.bankrupt, 'faillite du joueur → fin de partie'); }

console.log(fails ? '\n' + fails + ' ÉCHEC(S)' : '\nTOUT PASSE'); process.exit(fails ? 1 : 0);
