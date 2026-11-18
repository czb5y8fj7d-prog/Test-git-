// Navigation par pôles, bouton d'action, badges, balayage, filtres : JSDOM_FROM=/tmp/uitest/ node tests/navigation.test.mjs
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
const A = TE.GAMES.constructeur.api, p = () => TE.player(), hubs = () => [...d.querySelectorAll('#tabs .hubbtn')];
ok(hubs().length === 5 && hubs().map(h => h.textContent.replace(/\d+\+?$/, '')).join('|').includes('Campus') , '5 pôles dans le dock : ' + hubs().map(h => h.querySelector('.tl').textContent).join(', '));
ok(d.querySelector('#tabs .hubbtn[aria-pressed="true"]').dataset.v === 'pilotage' && d.getElementById('subnav').textContent.includes('Concurrence'), 'pôle Pilotage actif avec sous-rubriques');
click('#tabs .hubbtn[data-v="produits"]'); await wait(20);
ok(TE.UI.tab === 'gamme' && /Pièces/.test(d.getElementById('subnav').textContent), 'pôle Produits → Modèles, sous-rubrique Pièces');
ok(d.querySelector('#fab [data-act="newmodel"]'), 'bouton d\'action « Nouveau modèle »');
click('#subnav [data-v="pieces"]'); await wait(20); ok(TE.UI.tab === 'pieces' && !d.getElementById('fab').hidden, 'Pièces : bouton d\'action');
click('#fab .fabmain'); await wait(30); ok(TE.UI.modal && TE.UI.modal.kind === 'part' && d.querySelectorAll('.kcard').length === 3, 'bouton unique : nouvelle pièce, trois grandes cases'); click('[data-act="close"]'); await wait(10);
click('#tabs .hubbtn[data-v="marches"]'); await wait(10); click('#tabs .hubbtn[data-v="produits"]'); await wait(10); ok(TE.UI.tab === 'pieces', 'le pôle se souvient de la dernière rubrique');
// balayage
const touch = (t, x, y) => { const ev = new w.Event(t, { bubbles: true }); ev[t === 'touchstart' ? 'touches' : 'changedTouches'] = [{ clientX: x, clientY: y }]; return ev; };
const panel = d.getElementById('panel'); panel.dispatchEvent(touch('touchstart', 300, 300)); panel.dispatchEvent(touch('touchend', 100, 310)); await wait(10);
ok(TE.UI.tab === 'tech', 'balayage vers la gauche : rubrique suivante (Technologies)');
panel.dispatchEvent(touch('touchstart', 300, 300)); panel.dispatchEvent(touch('touchend', 100, 310)); await wait(10); ok(TE.UI.tab === 'usines', 'balayage vers la gauche : rubrique suivante (Usines)');
panel.dispatchEvent(touch('touchstart', 100, 300)); panel.dispatchEvent(touch('touchend', 300, 305)); await wait(10); ok(TE.UI.tab === 'tech', 'balayage vers la droite : rubrique précédente');
// palette « Aller à… » et raccourcis
click('[data-act="pal"]'); await wait(20); ok(!d.getElementById('pal').hidden && d.querySelector('#pall .palit'), 'palette ouverte, écrans listés');
const q = d.getElementById('palq'); q.value = 'bour'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(10); ok(d.querySelectorAll('#pall .palit').length === 1 && /Bourse/.test(d.getElementById('pall').textContent), 'recherche « bour » → Bourse');
d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await wait(20); ok(TE.UI.tab === 'bourse' && d.getElementById('pal').hidden, 'Entrée ouvre l\'écran et ferme la palette');
d.dispatchEvent(new w.KeyboardEvent('keydown', { key: '1', bubbles: true })); await wait(20); ok(TE.UI.tab === 'campus', 'raccourci 1 → premier pôle');
d.dispatchEvent(new w.KeyboardEvent('keydown', { key: ']', bubbles: true })); await wait(20); ok(TE.UI.tab === 'tableau', 'raccourci ] → rubrique suivante');
d.dispatchEvent(new w.KeyboardEvent('keydown', { key: '/', bubbles: true })); await wait(20); ok(!d.getElementById('pal').hidden, 'raccourci / ouvre la palette'); d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(10); ok(d.getElementById('pal').hidden, 'Échap ferme la palette');
// badges
TE.cheat.cash(3e9); TE.cheat.skip(400); TE.reAll();
const bd = TE.def.badges(TE.G, p()); console.log('  · badges :', JSON.stringify(bd));
ok(typeof bd === 'object', 'badges calculés');
// filtres de modèles
const cheats = TE.GAMES.constructeur.cheats; cheats.find(c => /Pièces/.test(c.label)).run(TE.G, p());
const pf = (k, f) => p().parts.find(x => x.kind === k && x.spec.lvl === 8 && f(x.spec)); for (const b of ['cit', 'ber', 'cpe']) { const r = A.startModel(p(), TE.G, { body: b, eng: pf('eng', s => s.fuel === 'ess' && s.size === A.BODIES[b].size).id, chs: pf('chs', s => s.cls === A.BODIES[b].size && s.focus === 'eq').id, gbx: pf('gbx', s => s.cap === A.BODIES[b].size && s.type === 'man').id, fin: 1, sty: 0, pp: 1, camp: 0, name: 'Test ' + b }); if (r) console.log('  · startModel', b, r); }
TE.cheat.skip(10); click('#tabs .hubbtn[data-v="produits"]'); click('#subnav [data-v="gamme"]'); await wait(20);
const cards = () => (d.getElementById('panel').textContent.match(/Test (cit|ber|cpe)/g) || []);
ok(cards().length >= 1, 'modèles listés (' + cards().length + ')');
click('[data-act="set"][data-k="fo_gamme"]'); await wait(10); ok(d.querySelector('.fbar [data-k="fbody"]'), 'panneau de filtres ouvert');
click('.fbar [data-act="set"][data-k="fbody"][data-v="ber"]'); await wait(10); const t1 = cards();
ok(t1.every(x => x === 'Test ber'), 'filtre silhouette : seules les berlines (' + t1.length + ')');
click('[data-act="fclear"]'); await wait(10); ok(cards().length >= t1.length, 'réinitialisation des filtres');
click('.fbar [data-act="set"][data-k="fsort"][data-v="name"]'); await wait(10); ok(true, 'tri par nom');
// filtres : pièces, pays
click('#subnav [data-v="pieces"]'); await wait(10); click('[data-act="set"][data-k="fo_pieces"]'); await wait(10); click('.ptile[data-v="gbx"]'); await wait(10);
ok(/Boîtes/.test(d.getElementById('panel').textContent) && !/<h3[^>]*>Moteurs</.test(d.getElementById("panel").innerHTML), 'filtre pièces : boîtes seulement');
click('#tabs .hubbtn[data-v="marches"]'); await wait(10); ok(TE.UI.tab === 'carte', 'pôle Réseau : la carte d\'abord'); click('#subnav [data-v="pays"]'); await wait(10); click('[data-act="set"][data-k="ptab"][data-v="all"]'); await wait(10); click('[data-act="set"][data-k="pzone"][data-v="Europe"]'); await wait(10);
ok(/France/.test(d.querySelector('.plist').textContent) && !/Brésil/.test(d.querySelector('.plist').textContent), 'filtre pays : Europe uniquement');
const si = d.querySelector('.psq'); si.value = 'alle'; si.dispatchEvent(new w.Event('input', { bubbles: true })); ok(/Allemagne/.test(d.querySelector('.plist').textContent) && !/France/.test(d.querySelector('.plist').textContent), 'recherche de pays'); TE.UI.psq = ''; TE.UI.pzone = '';
click('#tabs .hubbtn[data-v="holding"]'); await wait(10); ok(TE.UI.tab === 'bourse', 'pôle Groupe : dernière rubrique mémorisée'); click('#subnav [data-v="licences"]'); await wait(10); click('#subnav [data-v="finances"]'); await wait(10);
click('#tabs .hubbtn[data-v="produits"]'); await wait(10); click('#subnav [data-v="stocks"]'); await wait(10); ok(/Capacité de production/.test(d.getElementById('panel').textContent), 'onglet Stocks');
console.log(errs.length ? errs.slice(0, 5) : 'aucune erreur JS'); if (errs.length) fails++;
console.log(fails ? 'ÉCHEC ' + fails : 'TOUT PASSE'); process.exit(fails ? 1 : 0);
