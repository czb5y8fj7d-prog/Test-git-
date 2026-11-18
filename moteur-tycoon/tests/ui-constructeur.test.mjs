// Test d'interface sous jsdom : node tests/ui.test.mjs  (nécessite `npm i jsdom`)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(process.env.JSDOM_FROM || import.meta.url); const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = process.argv[2] || 'constructeur';
const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message)); vc.on('error', e => errs.push(String(e)));
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', game + '.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const unfold = sel => { for (const b of Array.from(d.querySelectorAll('.foldh'))) { if (TE.UI.modal && TE.UI.modal.kind === 'fold') TE.closeModal(); b.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); if (d.querySelector(sel)) return true; } if (TE.UI.modal && TE.UI.modal.kind === 'fold') TE.closeModal(); return false; };
const click = sel => { if (typeof sel === 'string' && TE.UI.modal && TE.UI.modal.kind === 'fold' && !d.querySelector('#sheet ' + sel)) TE.closeModal(); let el = typeof sel === 'string' ? d.querySelector(sel) : sel; if (!el && typeof sel === 'string' && unfold(sel)) el = d.querySelector(sel); if (!el) throw new Error('introuvable : ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
await wait(100);
ok(!d.getElementById('start').hidden && d.querySelector('#start h1'), 'écran de départ affiché');
click('[data-act="newgame"]'); await wait(50);
ok(d.getElementById('start').hidden && TE.G && TE.G.actors.length >= 2, 'nouvelle partie lancée');
const goTab = v => { for (const h of d.querySelectorAll('#tabs .hubbtn')) { if (d.querySelector('#subnav [data-v="' + v + '"]')) break; click(h); } const b = d.querySelector('#subnav [data-v="' + v + '"]'); if (b) click(b); }; const tabs = ['tableau', 'gamme', 'pieces', 'usines', 'pays', 'marque'];

const modal = () => d.querySelector('.modal, #modal');
// nouvelle pièce
goTab('pieces'); await wait(20);
click('[data-act="newpart"][data-k=""]'); await wait(30);
ok(d.querySelectorAll('.kcard').length === 3, 'trois grandes cases : moteur, châssis, boîte');
click('[data-act="pkind"][data-k="eng"]'); await wait(20);
for (const [k, v] of [['fuel', 'hyb'], ['size', '2']]) { const b = d.querySelector('[data-act="mset"][data-k="' + k + '"][data-v="' + v + '"]'); if (b) click(b); await wait(10); }
click('[data-act="pstep"][data-v="2"]'); await wait(10); { const b = d.querySelector('[data-act="mset"][data-k="lvl"][data-v="5"]'); if (b) click(b); await wait(10); }
click('[data-act="pstep"][data-v="3"]'); await wait(10); click('[data-act="pstep"][data-v="4"]'); await wait(10);
ok(d.body.textContent.includes('Lancer ·'), 'dernière étape : récapitulatif et lancement');
click('[data-act="startpart"]'); await wait(30);
ok(TE.player().proj.length === 1, 'développement de moteur lancé');
// nouveau modèle
goTab('gamme'); await wait(20);
click('[data-act="newmodel"]'); await wait(30);
ok(d.body.textContent.includes('Quel type de voiture'), 'assistant de création ouvert (étape 1)');
click('[data-act="wbody"][data-b="comp"]'); await wait(20);
if (!d.querySelector('[data-act="wpart"]') && !/Il te manque/.test(d.body.textContent)) { click('[data-act="wstep"][data-v="0"]'); click('[data-act="wbody"][data-b="cit"]'); await wait(20); }
const hasParts = TE.player().parts.length > 0;
ok(hasParts ? (d.body.textContent.includes('Quel châssis') && d.querySelectorAll('.pcard[data-act="wpart"]').length >= 1) : /Il te manque des pièces/.test(d.body.textContent), hasParts ? 'étape 2 : châssis compatibles' : 'sans pièces : l\'assistant le dit');
if (hasParts) { click('[data-act="wstep"][data-v="2"]'); click('[data-act="wstep"][data-v="3"]'); click('[data-act="wstep"][data-v="4"]'); click('[data-act="wstep"][data-v="5"]'); await wait(20); ok(/Récapitulatif/.test(d.body.textContent), 'récapitulatif affiché'); }
// pays + usine
click('[data-act="closemodal"], [data-act="close"]'); await wait(20);
goTab('pays'); await wait(20);
const nb = TE.player().cty.FR.dealers; click('.crow[data-c="FR"]'); await wait(20); click('[data-act="mset"][data-v="reseau"]'); click('[data-act="dealers"][data-c="FR"][data-n="10"]'); await wait(20); TE.closeModal();
ok(TE.player().cty.FR.dealers === nb + 10, 'ouverture de concessions');
goTab('usines'); await wait(20); click('[data-act="newfact"]'); await wait(30);
ok(d.body.textContent.includes('Nouvelle usine'), 'modale usine ouverte');
click('[data-act="startfact"]'); await wait(20);
ok(TE.player().fact.length === 2, 'usine lancée');

// --- nouvelles mécaniques ---
goTab('marque'); await wait(20);
click('[data-act="pos"][data-v="fiab"]'); await wait(20); ok(TE.player().pos === 'fiab', 'positionnement choisi');
click('[data-act="tests"][data-v="2"]'); await wait(20); ok(TE.player().test === 2, 'tests de fiabilité réglés');
click('[data-act="supply"]'); await wait(20); ok(TE.player().sup && TE.player().sup.until > TE.G.day, 'contrat batteries signé');
goTab('pays'); await wait(20); click('.crow[data-c="ES"]'); await wait(20); click('[data-act="mset"][data-v="reseau"]'); click('[data-act="partner"][data-c="ES"]'); await wait(20); TE.closeModal(); ok(TE.player().cty.ES.partner === true, 'partenaire local signé');
goTab('usines'); await wait(20); const fid = TE.player().fact[0].id;
click('[data-act="fspec"][data-f="' + fid + '"][data-v="cit"]'); await wait(20); ok(TE.player().fact[0].spec === 'cit', 'usine spécialisée');
goTab('gamme'); await wait(20);
click('[data-act="promo"][data-v="0.1"]'); await wait(20); ok(TE.player().models.some(m => m.discLeft > 0), 'promotion lancée');
click('[data-act="newmodel"]'); await wait(30); click('[data-act="wbody"][data-b="cit"]'); click('[data-act="wstep"][data-v="2"]'); click('[data-act="wstep"][data-v="3"]'); click('[data-act="wstep"][data-v="4"]'); await wait(10);
ok(/Positionnement prix/.test(d.body.textContent), 'réglages de personnalisation affichés'); click('[data-act="wstep"][data-v="5"]'); await wait(10);
ok(d.body.textContent.includes('Cahier des charges'), 'cahier des charges affiché'); click('[data-act="wstep"][data-v="4"]'); await wait(10);
click('[data-act="mset"][data-k="pp"][data-v="2"]'); await wait(20); click('[data-act="mset"][data-k="camp"][data-v="1"]'); await wait(20);
ok(/Ventes estimées|Plateforme|Moteur/.test(d.body.textContent), 'estimation ou contrôle affiché');
click('[data-act="close"]'); await wait(20);
goTab('tableau'); await wait(20); ok(d.getElementById('panel').textContent.includes('Étapes'), 'étapes affichées');
// quelques mois de simulation accélérée
for (let i = 0; i < 360 * 2; i++) TE.step(); TE.renderAll && TE.renderAll();
for (const t of tabs) { goTab(t); await wait(10); ok(d.getElementById('panel').textContent.trim().length > 30, 'après 2 ans : onglet « ' + t + ' »'); }
ok(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' : ' + errs[0] : ''));
console.log(fails ? fails + ' ÉCHEC(S)' : 'UI OK'); process.exit(fails ? 1 : 0);
