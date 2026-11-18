// Bot « joueur actif » vs « joueur passif » : node tests/constructeur-bot.mjs
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console, performance, __TE_TEST: true }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['engine/core.js', 'games/constructeur/world.js', 'games/constructeur/game.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
const TE = ctx.TE, A = TE.GAMES.constructeur.api; TE.define(TE.GAMES.constructeur);
function bot(G, p) {
  const K = process.env.CAUTIOUS ? 1 : 0, yr = G.day / 360, L = Math.min(8, 3 + Math.floor(yr / 2));
  if (G.day % 30 === 3) {
    if (p.proj.length + (K ? p.models.filter(m => m.state === 'dev').length : 0) < (K ? 1 : 2) && p.cash > (K ? 350e6 : 150e6)) {
      const want = [['eng', { fuel: yr > 5 ? 'hyb' : 'ess', size: 2, lvl: L }], ['chs', { cls: 2, focus: 'eq', lvl: L }], ['gbx', { type: 'man', cap: 2, lvl: L }], ['eng', { fuel: 'elec', size: 2, lvl: L }], ['gbx', { type: 'red', cap: 2, lvl: L }], ['chs', { cls: 3, focus: 'conf', lvl: L }], ['eng', { fuel: 'ess', size: 3, lvl: L }], ['gbx', { type: 'auto', cap: 3, lvl: L }]];
      for (const [k, sp] of want) { if (p.proj.length >= (K ? 1 : 2)) break; A.startPart(p, G, k, sp); }
    }
    const devs = p.models.filter(m => m.state === 'dev').length, sale = p.models.filter(m => m.state === 'sale');
    if (!devs && !p.proj.length && p.cash > (K ? 350e6 : 200e6) && sale.length < 6) {
      outer: for (const b of ['suvc', 'comp', 'ber', 'cit', 'suvl', 'cpe']) for (const e of p.parts.filter(x => x.kind === 'eng')) for (const c of p.parts.filter(x => x.kind === 'chs')) for (const g of p.parts.filter(x => x.kind === 'gbx')) {
        if (A.compat(b, e, c, g)) continue; if (p.models.some(m => m.state !== 'end' && m.body === b && m.eng === e.id && m.chs === c.id)) continue;
        if (!A.startModel(p, G, { body: b, eng: e.id, chs: c.id, gbx: g.id, fin: 2, sty: 1, pp: 1, camp: 1 })) break outer;
      }
    }
    for (const m of sale) if (m.age > 72 && sale.length > 2) m.state = 'end';
    if (p.cash > (K ? 450e6 : 300e6)) { const c = A.CK.map(k => [k, A.COUNTRIES[k].vol * (1 - A.reach(p, k))]).sort((x, y) => y[1] - x[1])[0][0]; const n = 40; if (p.cash > n * A.dealerCost(p, c)) { TE.spend(p, 'réseau', n * A.dealerCost(p, c)); p.cty[c].dealers += n; } if (p.cty[c].ads < 1) p.cty[c].ads = 1; }
    if ((p.util || 0) > 0.9 && p.cash > 250e6 && !p.fact.some(f => f.ready > G.day)) { const c = p.fact[0] ? p.fact[0].c : p.home, cap = 6000; TE.spend(p, 'usines', A.factCost(c, cap)); A.addFactory(p, G, c, cap, G.day + 270); }
    if (G.day % 360 === 3) { TE.hire(p, 'ingenieurs', 20); }
  }
}
const years = +process.env.YEARS || 10; const rows = [];
for (const scen of ['maroc', 'redress', 'volt']) for (const active of [false, true]) {
  TE.newGame({ name: 'Bot', diff: 1, seed: 7, opts: { scen, home: 'MA' }, cfg: { rivals: 6 } }); const G = TE.G, p = TE.player();
  for (let i = 0; i < 360 * years && !G.over; i++) { if (active) bot(G, p); TE.step(); }
  const u = p.u12.reduce((s, x) => s + x, 0);
  rows.push(`${scen.padEnd(8)} ${active ? 'actif ' : 'passif'} : ${G.over ? 'FAILLITE jour ' + G.day : 'vivant'} | ventes 12m ${String(u).padStart(8)} | cash ${TE.money(p.cash).padStart(9)} | marque ${Math.round(p.brand)} | modèles ${p.models.filter(m => m.state === 'sale').length} | usines ${p.fact.length} | rappels ${p.recalls} | trophées ${p.awards} | étapes ${Object.keys(G.game.ms).length}`);
}
console.log(rows.join('\n')); process.exit(0);
