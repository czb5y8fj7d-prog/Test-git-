// Arbre de technologies : affichage, recherche payante, effets, prérequis.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(process.env.JSDOM_FROM || import.meta.url)('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0; const errs = []; w.addEventListener('error', e => errs.push(e.message));
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const click = sel => { const el = typeof sel === 'string' ? d.querySelector(sel) : sel; if (!el) throw new Error('introuvable : ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
d.querySelector('[data-act="newgame"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const p = () => TE.player(), pt = () => d.getElementById('panel').textContent, bad = t => /NaN|undefined|Infinity/.test(t);
TE.cheat.cash(5e9);
TE.UI.tab = 'tech'; TE.renderAll(true);
ok(d.querySelectorAll('.ttnode').length >= 90 && d.querySelectorAll('.ttsvg path').length > 80 && !bad(pt()), 'vue arbre : nœuds et liaisons SVG');
click('.ttnode.open'); ok(!!d.querySelector('[data-act="rtech"]'), 'sélection d\'un nœud : bouton Rechercher');
click('[data-act="set"][data-k="ttv"][data-v="list"]');
ok(/Arbre de technologies/.test(pt()) && /1982/.test(pt()) && /Injection électronique/.test(pt()) && !bad(pt()), 'arbre affiché, commence dans les années 80');
click('[data-act="set"][data-k="ttb"][data-v="num"]'); ok(/Autonomie niveau 5/.test(pt()) && !/Injection électronique/.test(pt()), 'filtre par branche');
click('[data-act="set"][data-k="ttb"][data-v="ele"]');
const btn = () => d.querySelector('[data-act="rtech"]');
ok(/Lithium-ion automobile/.test(pt()) && /Charge rapide|requiert/.test(pt()), 'prérequis visibles');
const cash0 = p().cash; ok(!!btn(), 'une technologie est disponible'); const id = btn().dataset.id; click(btn());
ok(p().tq && p().tq.length === 1 && p().cash < cash0, 'recherche payante lancée (' + id + ')');
for (let i = 0; i < 40 && p().tq.length; i++) TE.cheat.skip(30);
ok(p().tech && p().tech[id] != null, 'technologie maîtrisée après les mois de recherche');
// effets : la baisse de coût s'applique
p().tech = Object.assign(p().tech || {}, { ind2: 1, ind3: 1, ind1: 1 });
TE.UI.tab = 'tech'; TE.renderAll(true); ok(!bad(pt()), 'pas de NaN après acquisition');
ok(TE.G.actors.length > 0 && errs.length === 0, 'aucune erreur JS ' + errs.join('|'));
process.exit(fails ? 1 : 0);
