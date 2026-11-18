// Menu triche (moteur) + stocks + rachat de marque : JSDOM_FROM=/tmp/uitest/ node tests/cheats-groupe.test.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(process.env.JSDOM_FROM || import.meta.url); const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message)); vc.on('error', e => errs.push(String(e)));
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const unfold = sel => { for (const b of Array.from(d.querySelectorAll('.foldh'))) { if (TE.UI.modal && TE.UI.modal.kind === 'fold') TE.closeModal(); b.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); if (d.querySelector(sel)) return true; } if (TE.UI.modal && TE.UI.modal.kind === 'fold') TE.closeModal(); return false; };
const click = sel => { if (typeof sel === 'string' && TE.UI.modal && TE.UI.modal.kind === 'fold' && !d.querySelector('#sheet ' + sel)) TE.closeModal(); let el = typeof sel === 'string' ? d.querySelector(sel) : sel; if (!el && typeof sel === 'string' && unfold(sel)) el = d.querySelector(sel); if (!el) throw new Error('introuvable : ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
await wait(100); click('[data-act="newgame"]'); await wait(50);
const A = TE.GAMES.constructeur.api, p = () => TE.player();
ok(d.getElementById('cheatfab') && d.getElementById('cheatfab').hidden, 'bouton triche masqué par défaut');
TE.UI.cheats = true; TE.UI.render && TE.UI.render(); w.dispatchEvent(new w.Event('resize'));
const c0 = p().cash; TE.cheat.cash(5e8); ok(p().cash === c0 + 5e8, 'TE.cheat.cash');
const d0 = TE.G.day; TE.cheat.skip(45); ok(TE.G.day === d0 + 45, 'TE.cheat.skip');
const r = TE.rivals(); TE.cheat.kill(r[0].id); ok(r[0].bankrupt, 'TE.cheat.kill');
const cg = TE.GAMES.constructeur.cheats; ok(cg && cg.length > 8, 'cheats propres au jeu');
for (const ch of cg) { try { ch.run(TE.G, p(), {}); } catch (e) { ok(false, 'cheat « ' + ch.label + ' » : ' + e.message); } }
ok(p().parts.length > 20, 'pièces N8 ajoutées'); ok(p().extra.length === 1, 'rachat via cheat : 1 marque du groupe');
TE.cheat.skip(90); const q = p(); ok(isFinite(q.cash) && q.cash === q.cash, 'simulation saine après triche');
ok(A.brandsOf(q).length === 2, 'groupe à 2 marques');
// UI
TE.UI.cheats = true; TE.reAll();
const fab = d.getElementById('cheatfab'); ok(fab && !fab.hidden, 'bouton triche visible');
click('[data-act="cheats"]'); await wait(30); ok(/Argent/.test(d.body.textContent) && d.querySelector('[data-act="cheat"][data-k="cash"]'), 'modale triche ouverte');
const c1 = p().cash; click('[data-act="cheat"][data-k="cash"]'); await wait(20); ok(p().cash > c1, 'bouton +argent');
click('[data-act="close"]'); await wait(10);
// stocks
click('#tabs [data-v="stocks"]'); await wait(20); ok(/Stock visé/.test(d.body.textContent), 'carte stock visé');
const sb = d.querySelector('[data-act="stock"][data-v="3"]'); ok(!!sb, 'sélecteur de stock'); if (sb) { click(sb); await wait(10); ok(p().stockT === 2, 'stock visé global = 2 mois'); }
click('#tabs [data-v="groupe"]'); await wait(20); ok(/Racheter une entreprise/.test(d.body.textContent), 'onglet groupe');
const rv = TE.rivals()[0]; if (rv) { TE.cheat.cash(5e10); click('#tabs [data-v="groupe"]'); const b = d.querySelector('[data-act="buyco"][data-id="' + rv.id + '"]'); ok(!!b, 'bouton racheter'); if (b) { click(b); await wait(20); ok(A.brandsOf(p()).length === 3, 'rachat via UI'); } }
TE.cheat.skip(60); ok(p().cash === p().cash, 'sim saine après rachats');
console.log(errs.length ? errs.slice(0, 5) : 'aucune erreur JS'); if (errs.length) fails++;
console.log(fails ? 'ÉCHEC ' + fails : 'TOUT PASSE'); process.exit(fails ? 1 : 0);
