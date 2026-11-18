// Technologies : niveaux nommés, déblocage par année, avance technologique, retard technologique.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(process.env.JSDOM_FROM || import.meta.url)('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0; const errs = []; w.addEventListener('error', e => errs.push(e.message));
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const click = sel => { const el = typeof sel === 'string' ? d.querySelector(sel) : sel; if (!el) throw new Error('introuvable : ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
d.querySelector('[data-act="newgame"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const p = () => TE.player(), sheet = () => d.getElementById('sheet').textContent, pt = () => d.getElementById('panel').textContent, bad = t => /NaN|undefined|Infinity/.test(t);
const mset = (k, v) => click('[data-act="mset"][data-k="' + k + '"][data-v="' + v + '"]');
TE.cheat.cash(5e9); TE.G.game.bilanMode = 'off';
const G = () => TE.G;
// 1. tableau des technologies
TE.UI.tab = 'pieces'; TE.renderAll(true); ok(/Technologies/.test(pt()) && /Pointe du marché/.test(pt()), 'carte « Technologies » dans les pièces');
click('[data-act="fold"][data-k="tech"]'); ok(/Injection directe/.test(sheet()) && /Architecture 800 V/.test(sheet()) && /Châssis/.test(sheet()) && !bad(sheet()), 'échelle des technologies nommées (moteurs, châssis, boîtes)');
ok(/2031/.test(sheet()), 'année de déblocage affichée pour les niveaux futurs'); TE.closeModal();
// 2. nouveau moteur : niveaux limités par le marché, nom technologique
click('#fab .fabmain'); click('[data-act="pkind"][data-k="eng"]'); click('[data-act="pstep"][data-v="2"]'); click('[data-act="pstep"][data-v="3"]'); const lv = () => [...d.querySelectorAll('#sheet [data-act="mset"][data-k="lvl"]')].map(b => +b.dataset.v);
ok(Math.max.apply(null, lv()) === 6 && !lv().includes(7), 'au départ, les deux technologies de pointe ne sont pas accessibles (max ' + Math.max.apply(null, lv()) + ')');
ok(/Prochaine/.test(sheet()) && /Avance technologique/.test(sheet()), 'la prochaine technologie et l’avance payante sont proposées');
mset('lvl', '4'); ok(/Injection directe/.test(sheet()), 'le niveau 4 s’appelle « Injection directe »');
const cash0 = p().cash; click('[data-act="advtech"]'); ok(p().adv === 1 && p().cash < cash0 - 8e7, 'avance technologique payée (' + Math.round((cash0 - p().cash) / 1e6) + ' M€)');
ok(Math.max.apply(null, lv()) === 7, 'la technologie de pointe devient accessible grâce à la recherche');
mset('lvl', '7'); click('[data-act="pstep"][data-v="4"]'); click('[data-act="startpart"]'); ok(p().proj.some(x => x.spec.lvl === 7 && /Taux de compression variable/.test(x.name)), 'moteur N7 lancé, nom = technologie');
TE.closeModal(); for (let i = 0; i < 500 && p().proj.length; i++) TE.cheat.skip(5);
// 3. le calendrier fait avancer la pointe
const f0 = TE.G.game && 0; TE.cheat.skip(360 * 3 + 10); TE.UI.tab = 'pieces'; TE.renderAll(true); click('[data-act="fold"][data-k="tech"]');
ok(/pointe/.test(sheet()), 'après trois ans, une nouvelle technologie de pointe'); TE.closeModal();
// 4. retard technologique : un modèle aux pièces N2 perd du design perçu
const e = p().parts.find(x => x.kind === 'eng' && !x.lic && x.spec.lvl <= 3), cc = p().parts.find(x => x.kind === 'chs' && !x.lic && x.spec.lvl <= 3), gg = p().parts.find(x => x.kind === 'gbx' && !x.lic && x.spec.lvl <= 3);
ok(!!e && !!cc && !!gg, 'pièces anciennes disponibles');
p().models.push({ id: 99100, name: 'Vieux', body: 'cit', eng: e.id, chs: cc.id, gbx: gg.id, fuel: e.spec.fuel, fin: 2, sty: 0, st: { perf: 50, handling: 50, comfort: 50, safety: 50, rel: 50, design: 60, space: 56, co2: 120, kg: 1200, kw: e.st.kw }, cost: 12000, price: 22000, camp: 0, br: 0, stock: 0, hype: 0, disc: 0, discLeft: 0, state: 'sale', left: 0, total: 1, monthly: 0, devCost: 60e6, age: 0, sold: 0, soldTot: 0, hist: [], cs: {} });
TE.cheat.skip(35); const vm = p().models.find(m => m.id === 99100), lagv = Math.max(0, TE.G.game && 0);
ok(vm.tl != null && vm.tl <= 3, 'le niveau technologique du modèle est suivi (N' + vm.tl + ')');
TE.UI.tab = 'gamme'; TE.renderAll(true); click('[data-act="fold"][data-k="m99100"]'); ok(/Retard technologique/.test(sheet()) && !bad(sheet()), 'la fiche du modèle signale le retard technologique'); TE.closeModal();
// 5. no NaN, no error
ok(!bad(pt()), 'pas de NaN'); ok(errs.length === 0, 'aucune erreur JS ' + errs.slice(0, 2));
console.log(fails ? 'ÉCHECS ' + fails : 'TOUT PASSE'); process.exit(fails ? 1 : 0);
