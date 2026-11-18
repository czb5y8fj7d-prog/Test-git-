// Bourse & participations : cours, achat/vente, dividendes, contrôle > 50 % et mandat de gestion appliqué à l'IA.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(process.env.JSDOM_FROM || import.meta.url)('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0; const errs = []; w.addEventListener('error', e => errs.push(e.message));
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
TE.newGame({ name: 'Test', diff: 1, seed: 31, cfg: { rivals: 10 } });
for (let i = 0; i < 360 * 3; i++) TE.step();
let G = TE.G, p = TE.player(); const act = (n, dd) => TE.GAMES.constructeur.actions[n](dd, { G: TE.G, p: TE.player(), UI: TE.UI, TE, toast: m => { last = m; } }); let last = '';
const pt = () => d.getElementById('panel').textContent, tgt = TE.rivals().filter(a => !a.bankrupt).sort((x, y) => TE.sum(y.u12) - TE.sum(x.u12))[2];
TE.UI.tab = 'bourse'; TE.renderAll(true);
ok(/Marché des constructeurs/.test(pt()) && /Mon portefeuille/.test(pt()) && !/NaN|undefined|Infinity/.test(pt()), 'onglet Bourse lisible');
ok(d.querySelectorAll('.pw .tscroll tr').length >= 8, 'marché : ' + d.querySelectorAll('.pw .tscroll tr').length + ' lignes');
p.cash = 80e9; const c0 = p.cash;
act('bbuy', { id: tgt.id, n: 10 }); ok(p.inv && p.inv[tgt.id] && p.inv[tgt.id].pct === 10 && p.cash < c0, 'achat de 10 % : ' + last.slice(0, 60));
act('bbuy', { id: tgt.id, n: 95 }); ok(p.inv[tgt.id].pct === 10 && /capital/.test(last), 'plafond de 100 % du capital');
// la prime de contrôle rend l'achat en bloc plus cher que l'accumulation progressive
const A = TE.GAMES.constructeur.api; ok(A.blockPrice(G, tgt, 41, false, 10) > A.blockPrice(G, tgt, 5, false, 10) * 41 / 5 * 1.05, 'prime de contrôle sur les gros blocs');
act('bbuy', { id: tgt.id, n: 41 }); ok(p.inv[tgt.id].pct === 51 && tgt.mgmt && !!TE.G.news.find(n => /contrôles désormais/.test(JSON.stringify(n))), 'plus de 50 % : contrôle et mandat ouverts');
TE.UI.bsel = String(tgt.id); TE.renderAll(true); ok(/Mandat de gestion/.test(pt()) && /Entreprises sous gestion/.test(pt()), 'panneau de mandat affiché');
act('bmand', { k: 'pol', v: 'offensif' }); act('bmand', { k: 'pay', v: '0.6' }); act('bmand', { k: 'zone', v: A.REGK[2] }); act('bmand', { k: 'rd', v: '1.5' }); act('bmand', { k: 'pos', v: 'prix' });
ok(tgt.mgmt.pol === 'offensif' && tgt.mgmt.pay === 0.6 && tgt.mgmt.zone === A.REGK[2] && tgt.mgmt.rd === 1.5 && tgt.mgmt.pos === 'prix', 'règles enregistrées');
const sc = tgt.ai && tgt.ai.tg; const cashBefore = p.cash, divBefore = p.inv[tgt.id].div || 0;
for (let i = 0; i < 360 * 2; i++) TE.step();
ok(tgt.pos === 'prix', 'positionnement imposé appliqué');
ok(tgt.ai && tgt.ai.tg.slice(0, 6).filter(c => A.COUNTRIES[c].reg === A.REGK[2]).length >= 2, 'cibles orientées vers la région prioritaire : ' + tgt.ai.tg.slice(0, 6).join(','));
ok((p.inv[tgt.id].div || 0) > divBefore, 'dividendes reçus : ' + Math.round((p.inv[tgt.id].div || 0) / 1e6) + ' M€');
ok(TE.G.game.bq.h[tgt.id].length >= 36 && new Set(TE.G.game.bq.h[tgt.id]).size > 10, 'cours qui fluctuent (historique ' + TE.G.game.bq.h[tgt.id].length + ' mois)');
ok(!TE.G.actors.some(a => a.absorbed && a.id === tgt.id), 'une filiale contrôlée n\'est pas rachetée par une rivale');
// vente
act('bbuy', { id: tgt.id, n: 9 }); const pc = p.inv[tgt.id].pct; act('bsell', { id: tgt.id, n: 5 }); ok(p.inv[tgt.id].pct === pc - 5 && p.inv[tgt.id].pct > 50 && !!tgt.mgmt, 'vente partielle, contrôle conservé');
act('bsell', { id: tgt.id, n: 5 }); ok(!tgt.mgmt, 'sous 50 % : fin du mandat');
ok(Math.abs(TE.companyValue(p) - (p.cash - p.debt + A.assets(p))) < 1, 'portefeuille compté dans la valeur de l\'entreprise');
// intégration
const t2 = TE.rivals().filter(a => !a.bankrupt && a !== tgt)[0]; act('bbuy', { id: t2.id, n: 20 }); const n0 = A.brandsOf(p).length; p.cash = 300e9; act('bmerge', { id: t2.id });
ok(A.brandsOf(p).length > n0 && !(p.inv && p.inv[t2.id]) && t2.absorbed, 'intégration au groupe après rachat du reste');
// krach
const B = TE.G.game.bq, s0 = Object.values(B.s).reduce((x, y) => x + y, 0) / Object.keys(B.s).length; TE.GAMES.constructeur.events && 0;
ok(errs.length === 0, 'aucune erreur JS ' + errs.join('|')); process.exit(fails ? 1 : 0);
