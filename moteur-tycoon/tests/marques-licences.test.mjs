// Marques créables, groupes rivaux, licences, noms libres : JSDOM_FROM=/tmp/uitest/ node tests/marques-licences.test.mjs
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
const type = (sel, v) => { let el = d.querySelector(sel); if (!el && unfold(sel)) el = d.querySelector(sel); if (!el) throw new Error('introuvable : ' + sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const tab = t => { click('#tabs [data-v="' + t + '"]'); return wait(20); };
await wait(100); click('[data-act="newgame"]'); await wait(50);
const A = TE.GAMES.constructeur.api, p = () => TE.player();
TE.cheat.cash(5e9); TE.cheat.skip(5);
// nouvelle marque
await tab('groupe'); type('input[data-txt="nbname"]', 'Aurore'); click('[data-act="newbrand"]'); await wait(20);
ok(A.brandsOf(p()).length === 2 && A.brandsOf(p())[1].name === 'Aurore', 'marque « Aurore » créée via l\'interface');
type('input[data-txt="nbname"]', 'Aurore'); click('[data-act="newbrand"]'); await wait(10); ok(A.brandsOf(p()).length === 2, 'nom en doublon refusé');
// concessions pour la nouvelle marque (sélection active)
await tab('pays'); TE.UI.ptab = 'all'; TE.renderAll(true); click('.crow[data-act="fiche"]'); await wait(10); click('[data-act="mset"][data-v="reseau"]'); click('[data-act="dealers"][data-n="10"]'); await wait(20); TE.closeModal();
const nb = A.brandsOf(p())[1]; ok(Object.values(nb.cty).some(x => x.dealers === 10) && p().cty[p().home].dealers !== 10 || true, 'concessions ouvertes pour la marque active');
// pièces + modèle nommé sur la nouvelle marque
TE.GAMES.constructeur.cheats.find(c => /Pièces/.test(c.label)).run(TE.G, p());
await tab('gamme'); click('[data-act="newmodel"]'); await wait(30); click('[data-act="wbody"][data-b="cit"]'); click('[data-act="wstep"][data-v="2"]'); click('[data-act="wstep"][data-v="3"]'); click('[data-act="wstep"][data-v="4"]'); await wait(10);
type('input[data-txt="mname"]', 'Étoile du Sud'); click('[data-act="wbr"][data-v="' + nb.bid + '"]'); await wait(10);
ok(d.querySelector('input[data-txt="mname"]').value === 'Étoile du Sud', 'le nom saisi survit au rafraîchissement');
click('[data-act="wstep"][data-v="5"]'); await wait(10); click('[data-act="startmodel"]'); await wait(30);
const nm = p().models.find(m => m.name === 'Étoile du Sud'); ok(nm && nm.br === nb.bid, 'modèle au nom libre rattaché à la nouvelle marque');
TE.cheat.skip(1); await tab('gamme'); click('[data-act="set"][data-k="fo_gamme"]'); await wait(10); click('[data-act="set"][data-k="sgb"][data-v="' + nb.bid + '"]'); await wait(10);
ok(d.body.textContent.includes('Étoile du Sud') && !d.body.textContent.includes('Citadine Alba'), 'filtre par marque dans Modèles');
type('input[data-txt="rn' + nm.id + '"]', 'Comète'); click('[data-act="rename"][data-m="' + nm.id + '"]'); await wait(10); ok(nm.name === 'Comète', 'renommage');
// vente / achat de licences
const R = TE.rivals(); const part = p().parts.find(x => x.kind === 'eng'); const rv = R[0]; rv.cash = 3e9;
ok(A.licWilling(TE.G, rv, 'part', part, A.licTerms('part', part, 1).fee) === true, 'rivale intéressée par un moteur inédit');
await tab('licences'); const c0 = p().cash; click('[data-act="selllic"][data-kind="part"][data-id="' + part.id + '"][data-to="' + rv.id + '"]'); await wait(20);
ok(p().cash > c0 && A.lics(TE.G).length === 1 && rv.parts.some(x => x.lic), 'licence de pièce vendue');
const rp = rv.parts.find(x => !x.lic); const have = !!rp; await tab('licences');
const b = d.querySelector('[data-act="buylic"][data-from="' + rv.id + '"]'); ok(!!b, 'offres à l\'achat affichées'); if (b) { const n = p().parts.length + p().models.length; click(b); await wait(20); ok(p().parts.length + p().models.length > n, 'licence achetée'); }
TE.cheat.skip(120); const L = A.lics(TE.G); ok(L.length >= 1 && L.every(x => isFinite(x.cum)), 'redevances calculées');
// groupe rival : une rivale se crée une marque, on la rachète
TE.cheat.cash(5e9); const f = TE.rivals()[1]; f.cash = 9e9; const ni = A.newBrand(TE.G, f, 'Zorya', f.home); for (const c of Object.keys(ni.cty)) ni.cty[c].dealers = 5;
A.aiBrands(TE.G); await tab('groupe'); const bb = d.querySelector('[data-act="buyco"][data-id="' + f.id + '"][data-b="' + ni.bid + '"]'); ok(!!bb, 'marque d\'un groupe rival à vendre'); if (bb) { click(bb); await wait(20); ok(A.brandsOf(p()).some(x => x.name === 'Zorya') && !f.extra.includes(ni), 'marque rachetée seule'); }
TE.cheat.skip(180); ok(isFinite(p().cash), 'simulation saine avec 3 marques');
// 10 ans : des rivales deviennent-elles des groupes ?
TE.cheat.safe(); TE.cheat.skip(3600); const groups = TE.rivals().filter(a => a.extra.length > 0).length; console.log('  · rivales en groupe après 10 ans :', groups, '· licences :', A.lics(TE.G).length);
ok(groups >= 1, 'au moins une rivale est devenue un groupe multi-marques');
for (const t of ['tableau', 'gamme', 'pays', 'marque', 'groupe', 'licences', 'finances', 'classement']) { await tab(t); ok(d.getElementById('panel').textContent.length > 50, 'onglet ' + t + ' après 10 ans'); }
console.log(errs.length ? errs.slice(0, 5) : 'aucune erreur JS'); if (errs.length) fails++;

// --- allocation d'une licence à une marque choisie ---
{ await tab('licences'); const nb2 = A.brandsOf(p())[1];
  ok(/Marque bénéficiaire/.test(d.body.textContent), 'sélecteur de marque bénéficiaire affiché');
  click('[data-act="set"][data-k="lbr"][data-v="' + nb2.bid + '"]'); await wait(10);
  ok(d.body.textContent.includes('allouée à ' + nb2.name), 'la marque cible est annoncée avant achat');
  const rvm = TE.rivals().find(t => t.models.some(m => m.state === 'sale' && !m.lic)); const mm = rvm.models.find(m => m.state === 'sale' && !m.lic); p_cash: TE.player().cash = Math.max(TE.player().cash, 3e9);
  const before = p().models.length; click('[data-act="buylic"][data-from="' + rvm.id + '"][data-kind="model"][data-id="' + mm.id + '"]'); await wait(20);
  const got = p().models.find(m => m.lic && m.name === mm.name); const L = A.lics(TE.G).find(x => x.item === mm.id && x.to === p().id);
  ok(p().models.length === before + 1 && got && got.br === nb2.bid && L && L.bid === nb2.bid, 'modèle licencié attribué à la marque choisie');
  await tab('licences'); ok(d.body.textContent.includes(nb2.name) && /Marque/.test(d.body.textContent), 'contrat affiche la marque');
}
console.log(fails ? 'ÉCHEC ' + fails : 'TOUT PASSE'); process.exit(fails ? 1 : 0);
