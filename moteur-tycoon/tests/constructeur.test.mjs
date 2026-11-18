// Tests headless du jeu « Constructeur » : node tests/constructeur.test.mjs
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console, performance, __TE_TEST: true }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['engine/core.js', 'games/constructeur/world.js', 'games/constructeur/game.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const TE = ctx.TE; let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
TE.define(TE.GAMES.constructeur);
const years = +process.env.YEARS || 12, verbose = !!process.env.VERBOSE;
for (const diff of [0, 1, 2]) {
  TE.newGame({ name: 'Test', diff, seed: 100 + diff, cfg: { rivals: 6 } });
  const G = TE.G, p = TE.player(); let nan = 0;
  for (let i = 0; i < 360 * years; i++) {
    TE.step();
    if (verbose && i % 360 === 359) console.log('  an', (i + 1) / 360, TE.G.actors.map(a => (a.bankrupt ? 'X' : TE.nf(a.cash / 1e6) + 'M/' + TE.nf(a.u12.reduce((s, x) => s + x, 0) / 1e3) + 'k')).join(' '));
    if (G.over) break;
  }
  for (const a of G.actors) for (const k of ['cash', 'debt', 'brand']) if (!isFinite(a[k])) nan++;
  const alive = TE.alive().length;
  console.log(`diff ${diff}: jour ${G.day}, vivants ${alive}/${G.actors.length}, joueur ${TE.money(p.cash)}, ventes 12m ${p.u12.reduce((s, x) => s + x, 0)}, modèles ${p.models.length}, over=${G.over}`);
  ok(nan === 0, 'aucun NaN'); ok(alive >= 4, '≥ 4 constructeurs vivants');
  ok(G.actors.slice(1).every(a => a.bankrupt || a.models.filter(m => m.state === 'sale').length >= 1), 'chaque rivale vivante a un modèle en vente');
  ok(G.actors.slice(1).some(a => a.u12.reduce((s, x) => s + x, 0) > 50000), 'les grandes rivales vendent des volumes réalistes');
  JSON.parse(JSON.stringify(G));
}
// Sauvegarde / déterminisme
TE.newGame({ name: 'S', diff: 1, seed: 8, cfg: { rivals: 6 } }); for (let i = 0; i < 400; i++) TE.step();
const snap = TE.exportSave(); for (let i = 0; i < 300; i++) TE.step(); const a1 = TE.exportSave(); TE.importSave(snap); for (let i = 0; i < 300; i++) TE.step();
ok(TE.exportSave() === a1, 'reprise après chargement identique');
console.log(fails ? '\n' + fails + ' ÉCHEC(S)' : '\nTOUT PASSE'); process.exit(fails ? 1 : 0);
