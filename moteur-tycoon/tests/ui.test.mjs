// Test d'interface sous jsdom : node tests/ui.test.mjs  (nécessite `npm i jsdom`)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(process.env.JSDOM_FROM || import.meta.url); const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = process.argv[2] || 'ecurie';
const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message)); vc.on('error', e => errs.push(String(e)));
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', game + '.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const click = sel => { const el = typeof sel === 'string' ? d.querySelector(sel) : sel; if (!el) throw new Error('introuvable : ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
await wait(100);
ok(!d.getElementById('start').hidden && d.querySelector('#start h1'), 'écran de départ affiché');
click('[data-act="newgame"]'); await wait(50);
ok(d.getElementById('start').hidden && TE.G && TE.G.actors.length >= 2, 'nouvelle partie lancée');
const tabs = [...d.querySelectorAll('#tabs button[data-v]')].map(b => b.dataset.v);
for (const t of tabs) { click('#tabs [data-v="' + t + '"]'); await wait(20); ok(d.getElementById('panel').textContent.trim().length > 30, 'onglet « ' + t + ' » rendu'); }
click('#tabs [data-v="voiture"]');
const p = TE.player(), c0 = p.car.aero, cash0 = p.cash; click('[data-act="rd"][data-area="aero"]');
ok(p.car.aero > c0 && p.cash < cash0, 'investissement R&D : voiture meilleure, trésorerie en baisse');
click('#tabs [data-v="equipe"]'); click('[data-act="driver"][data-v="1"]'); ok(p.driver === 1, 'changement de pilote');
click('[data-act="hire"][data-k="engineers"][data-n="10"]'); ok(p.staff.engineers.n === 70, 'recrutement');
click('#tabs [data-v="finances"]'); const dbt = p.debt; click('[data-act="borrow"]'); ok(p.debt > dbt, 'emprunt via l\'interface');
// temps qui s'écoule
click('[data-act="speed"][data-v="3"]'); await wait(1800);
ok(TE.G.day > 3, 'le temps avance (jour ' + TE.G.day + ')');
click('[data-act="speed"][data-v="0"]');
click('[data-act="saves"]'); ok(d.querySelector('#sheet .slot'), 'fenêtre des sauvegardes'); click('[data-act="saveslot"][data-v="1"]'); ok(TE.slotMeta('1'), 'sauvegarde manuelle');
click('[data-act="close"]'); ok(d.getElementById('modal').hidden, 'fenêtre fermée');
// recharger depuis le slot
click('[data-act="saves"]'); const day = TE.G.day; TE.G.day = 0; click('[data-act="loadslot"][data-v="1"]'); ok(TE.G.day === day, 'chargement du slot');
// avance jusqu'à une course : pause auto + résultats
TE.G.day = 22; click('#tabs [data-v="course"]'); click('[data-act="speed"][data-v="3"]'); await wait(2500);
ok(TE.G.game.last && d.getElementById('panel').textContent.includes('Dernière course'), 'course disputée et résultats affichés');
// partie terminée → fenêtre de fin
TE.player().bankrupt = true; TE.G.over = true; await wait(200); ok(d.querySelector('#sheet .endwrap'), 'fenêtre de fin de partie');
console.log('erreurs JS :', errs.length ? errs.slice(0, 5) : 'aucune'); ok(!errs.length, 'aucune erreur JavaScript');
console.log(fails ? '\n' + fails + ' ÉCHEC(S)' : '\nTOUT PASSE'); process.exit(fails ? 1 : 0);
