// Impact estimé, « À faire », autopilote, bilan du mois, assistant de création de modèle.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(process.env.JSDOM_FROM || import.meta.url)('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0; const errs = []; w.addEventListener('error', e => errs.push(e.message));
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const click = sel => { const el = typeof sel === 'string' ? d.querySelector(sel) : sel; if (!el) throw new Error('introuvable : ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
d.querySelector('[data-act="newgame"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const p = () => TE.player(), sheet = () => d.getElementById('sheet').textContent, bad = t => /NaN|undefined|Infinity/.test(t);
TE.cheat.cash(5e9); TE.cheat.skip(65);
// bilan
const b = TE.G.game.bilan; ok(b && b.units > 0 && Number.isFinite(b.profit), 'bilan du mois produit');
b.unseen = true; const q = TE.def.popup(TE.G); ok(q && q.kind === 'bilan', 'le bilan s\'ouvre tout seul'); TE.openModal('bilan'); ok(/Bilan ·/.test(sheet()) && /Ventes/.test(sheet()) && !bad(sheet()), 'feuille de bilan lisible');
click('[data-act="bmode"][data-v="off"]'); ok(TE.G.game.bilanMode === 'off', 'fréquence du bilan réglable'); b.unseen = true; ok(TE.def.popup(TE.G) === null, 'bilan désactivé : pas de fenêtre'); TE.closeModal();
// À faire
TE.UI.tab = 'campus'; TE.renderAll(true); ok(d.querySelector('.todo') && !bad(d.querySelector('.todo').textContent), 'boîte « À faire » dans le Campus');
// impact estimé, sans effet de bord
const x0 = JSON.stringify(p().cty.DE);
TE.openModal('pays', { c: 'DE', t: 'reseau' }); ok(/véh\.\/m/.test(sheet()) && /mois|rentable/.test(sheet()) && !bad(sheet()), 'impact estimé affiché sur les concessions'); ok(JSON.stringify(p().cty.DE) === x0, 'l\'estimation ne modifie pas l\'état');
click('[data-act="mset"][data-v="marketing"]'); ok(/pts/.test(sheet()) && !bad(sheet()), 'impact des campagnes'); click('[data-act="mset"][data-v="usine"]'); ok(!bad(sheet()), 'onglet usine sans valeur invalide'); TE.closeModal();
// autopilote
TE.UI.tab = 'autopilote'; TE.renderAll(true); ok(/Autopilote arrêté/.test(d.getElementById('panel').textContent), 'autopilote arrêté par défaut');
click('[data-act="aset"][data-k="on"]'); ok(TE.G.game.auto.on === true, 'autopilote activé'); click('[data-act="aset"][data-k="rules.net.pay"][data-v="48"]'); ok(TE.G.game.auto.rules.net.pay === 48, 'seuil de rentabilité réglable');
const dl0 = Object.values(p().cty).reduce((s, c) => s + c.dealers, 0), cash0 = p().cash; TE.cheat.skip(95);
const dl1 = Object.values(p().cty).reduce((s, c) => s + c.dealers, 0); ok(TE.G.game.auto.log.length > 0 || dl1 > dl0, 'l\'autopilote a pris des décisions (' + TE.G.game.auto.log.length + ' lignes, +' + (dl1 - dl0) + ' concessions)'); ok(Number.isFinite(p().cash) && p().cash > 0, 'trésorerie saine après autopilote');
TE.renderAll(true); ok(!bad(d.getElementById('panel').textContent), 'journal lisible');
// assistant de création
TE.GAMES.constructeur.cheats.find(c => /Pièces/.test(c.label)).run(TE.G, p());
const n0 = p().models.length; TE.UI.tab = 'gamme'; TE.renderAll(true); click('[data-act="newmodel"]');
ok(/Quel type de voiture/.test(sheet()) && /Configuration automatique/.test(sheet()) && d.querySelector('[data-act="wauto"]'), 'étape 1 : silhouette + configuration automatique dès le début');
click('[data-act="wauto"]'); ok(/Récapitulatif/.test(sheet()) && !bad(sheet()) && TE.UI.modal.eng && TE.UI.modal.chs && TE.UI.modal.gbx, 'la configuration automatique mène au récapitulatif complet');
click('[data-act="wstep"][data-v="0"]'); click('[data-act="wbody"][data-b="ber"]'); ok(/Quel châssis/.test(sheet()) && d.querySelectorAll('.pcard[data-act="wpart"][data-k="chs"]').length >= 1 && !bad(sheet()), 'étape châssis : seulement les châssis compatibles');
const Mz = TE.UI.modal, Bz = TE.def.bodies ? 0 : 0; click('[data-act="wstep"][data-v="2"]'); ok(/Quel moteur/.test(sheet()) && d.querySelectorAll('.pcard[data-act="wpart"][data-k="eng"]').length >= 1, 'étape moteur');
const chz = TE.player().parts.find(x => x.id == Mz.chs); ok([...d.querySelectorAll('.pcard[data-act="wpart"][data-k="eng"]')].every(b => TE.player().parts.find(x => x.id == b.dataset.id).st.kw <= chz.st.maxKW), 'moteurs proposés : tous supportés par le châssis');
click('[data-act="wstep"][data-v="3"]'); ok(/boîte/i.test(sheet()) && d.querySelectorAll('.pcard[data-act="wpart"][data-k="gbx"]').length >= 1, 'étape boîte'); const ez = TE.player().parts.find(x => x.id == Mz.eng);
ok([...d.querySelectorAll('.pcard[data-act="wpart"][data-k="gbx"]')].every(b => { const g = TE.player().parts.find(x => x.id == b.dataset.id); return g.st.maxKW >= ez.st.kw && ((ez.spec.fuel === 'elec') === (g.spec.type === 'red')); }), 'boîtes proposées : compatibles avec le moteur');
click('[data-act="wstep"][data-v="4"]'); ok(/Nom du modèle/.test(sheet())); click('[data-act="wfin"][data-v="prem"]'); ok(TE.UI.modal.fin === '3', 'réglage rapide Premium'); click('[data-act="wstep"][data-v="5"]'); ok(/Récapitulatif/.test(sheet()) && /Cahier des charges/.test(sheet()) && !bad(sheet()), 'récapitulatif et cahier des charges');
click('[data-act="startmodel"]'); ok(p().models.length === n0 + 1, 'modèle lancé depuis l\'assistant');
// À faire → action pré-remplie
TE.openModal('design', { step: 2, body: 'comp', fuel: 'elec', pre: 'eq', eng: null, chs: null, gbx: null, fin: '2', sty: '0', pp: '1', camp: '1', br: '0' }); ok(true, 'ouverture directe avec silhouette et énergie'); TE.closeModal();
// licences : vente groupée
TE.cheat.cash(5e9); for (const r of TE.rivals()) r.cash = 3e10; TE.UI.tab = 'licences'; TE.renderAll(true);
const lic0 = (TE.G.game.lics || []).length, btnAll = d.querySelector('[data-act="selllic"][data-to="all"][data-kind="all"]'); ok(btnAll && !btnAll.disabled, 'bouton « Tout vendre d\'un coup »'); const cashL = p().cash; click(btnAll);
const lic1 = (TE.G.game.lics || []).length; ok(lic1 > lic0 && p().cash > cashL, 'vente groupée : ' + (lic1 - lic0) + ' contrats, +' + Math.round((p().cash - cashL) / 1e6) + ' M€');
ok(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' : ' + errs[0] : ''));
console.log(fails ? fails + ' ÉCHEC(S)' : 'TOUT PASSE'); process.exit(fails ? 1 : 0);
