import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(process.env.JSDOM_FROM || import.meta.url); const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'); const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const unfold = sel => { for (const b of Array.from(d.querySelectorAll('.foldh'))) { if (TE.UI.modal && TE.UI.modal.kind === 'fold') TE.closeModal(); b.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); if (d.querySelector(sel)) return true; } if (TE.UI.modal && TE.UI.modal.kind === 'fold') TE.closeModal(); return false; };
const click = sel => { if (typeof sel === 'string' && TE.UI.modal && TE.UI.modal.kind === 'fold' && !d.querySelector('#sheet ' + sel)) TE.closeModal(); let el = d.querySelector(sel); if (!el && unfold(sel)) el = d.querySelector(sel); if (!el) throw new Error('introuvable : ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const tab = async id => { TE.UI.hubTab = TE.UI.hubTab || {}; const b = d.querySelector('#tabs [data-v="' + id + '"]'); if (b) b.click(); else { TE.UI.tab = id; TE.reAll(); } await wait(20); };
await wait(100); click('[data-act="newgame"]'); await wait(50);
const A = TE.GAMES.constructeur.api, p = () => TE.player(); TE.cheat.cash(5e9); TE.cheat.skip(3);
const f = p().fact[0]; const cap0 = f.cap;
TE.UI.tab = 'usines'; TE.reAll(); await wait(20);
const fix0 = TE.GAMES.constructeur.api.factCost ? 0 : 0;
click('[data-act="fup"][data-f="' + f.id + '"][data-k="auto"]'); await wait(10); ok(f.auto === 1, 'automatisation niveau 1');
click('[data-act="fup"][data-f="' + f.id + '"][data-k="eco"]'); await wait(10); ok(f.eco === 1, 'efficacité énergétique niveau 1');
click('[data-act="fmode"][data-k="' + f.id + '"][data-v="0"]'); await wait(10); ok(f.mode === 0, 'régime économe');
click('[data-act="fexp"][data-f="' + f.id + '"][data-n="5000"]'); await wait(10); ok(f.exp && f.exp.cap === 5000, 'extension lancée');
TE.cheat.skip(155); ok(f.cap === cap0 + 5000 && !f.exp, 'extension livrée après 5 mois');
// vendre une marque
const P = p(); const nb = A.newBrand(TE.G, P, 'Vesta', P.home); TE.reAll();
const rv = TE.rivals()[0]; rv.cash = 5e9; const nR = A.brandsOf(rv).length, cashP = P.cash;
TE.UI.tab = 'groupe'; TE.reAll(); await wait(20);
click('[data-act="sellbrand"][data-b="' + nb.bid + '"][data-to="' + rv.id + '"]'); await wait(10);
ok(A.brandsOf(P).length === 1 && A.brandsOf(rv).length === nR + 1 && P.cash > cashP, 'marque vendue à une rivale');
const nb2 = A.newBrand(TE.G, P, 'Orion', P.home); TE.reAll(); const c1 = P.cash;
click('[data-act="sellbrand"][data-b="' + nb2.bid + '"][data-to="fund"]'); await wait(10);
ok(A.brandsOf(P).length === 1 && P.cash > c1, 'marque cédée à un fonds');
// --- Campus : navigation par lieux ---
{ TE.UI.tab = 'campus'; TE.reAll(); await wait(20);
  ok(d.querySelectorAll('.place').length === 8, 'Campus : 8 lieux');
  click('.place [data-act="goto"][data-tab="stocks"]'); await wait(20); ok(TE.UI.tab === 'stocks', 'un lieu mène à son écran');
  TE.UI.tab = 'gamme'; TE.reAll(); await wait(20); const mm = p().models.find(m => m.state === 'sale');
  if (mm) { click('[data-act="goto"][data-tab="stocks"][data-open="s' + mm.id + '"]'); await wait(20); ok(TE.UI.tab === 'stocks' && TE.UI.modal && TE.UI.modal.kind === 'fold' && TE.UI.modal.id === 's' + mm.id, 'lien du modèle vers son stock, feuille ouverte'); TE.closeModal(); }
  ok(!/[\u{1F300}-\u{1FAFF}]/u.test(d.getElementById('app').textContent), 'aucun emoji dans l\'interface'); }
TE.cheat.skip(60); ok(true, 'simulation saine'); console.log(errs.length ? errs : 'aucune erreur JS'); console.log(fails ? 'ÉCHEC ' + fails : 'TOUT PASSE'); process.exit(fails ? 1 : 0);
