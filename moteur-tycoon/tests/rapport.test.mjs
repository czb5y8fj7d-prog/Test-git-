// Rapport de marché : modèles, pays, segments, continents, classements.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(process.env.JSDOM_FROM || import.meta.url)('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
d.querySelector('[data-act="newgame"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
TE.UI.tab = 'rapport'; TE.renderAll(true); ok(/Pas encore de données/.test(d.getElementById('panel').textContent), 'avant le premier mois : message d\'attente');
TE.cheat.cash(2e9); TE.cheat.skip(400); TE.UI.tab = 'rapport'; TE.renderAll(true);
const t = d.getElementById('panel').textContent, p = TE.player(), R = TE.G.game.rep;
ok(R && R.n >= 12, 'données glissantes : ' + (R && R.n) + ' mois');
for (const k of ['Mes modèles les plus vendus', 'Où je vends le plus', 'Ma part de marché par segment', 'Continents et régions', 'segment × continent', 'Classement des modèles par catégorie', 'Tous les pays', 'Ce qu\'il faut retenir']) ok(t.includes(k), 'section « ' + k + ' »');
ok(/Citadine Alba/.test(t), 'mon modèle apparaît'); ok(/Maroc/.test(t), 'mon pays apparaît');
ok(d.querySelectorAll('#panel .fold').length === 5, '5 catégories classées');
ok(d.querySelectorAll('#panel table.mx tbody tr').length >= 4, 'matrice segment × continent');
ok(!/NaN|undefined|Infinity/.test(t), 'aucune valeur invalide');
// cohérence : somme des ventes par pays ≈ ventes 12 mois
const mine12 = p.u12.reduce((a, b) => a + b, 0), sumC = Object.values(p.rp).reduce((s, r) => s + r.reduce((a, b) => a + b, 0), 0) / (1 - Math.pow(11 / 12, R.n));
ok(Math.abs(sumC - mine12) / Math.max(1, mine12) < 0.15, 'ventes par pays ≈ ventes totales (' + Math.round(sumC) + ' vs ' + mine12 + ')');
TE.UI.rfc = 'Afrique'; TE.renderAll(true); ok(!/France/.test(d.querySelector('#panel .tbl:last-of-type').textContent), 'filtre continent');
console.log(fails ? fails + ' ÉCHEC(S)' : 'TOUT PASSE'); process.exit(fails ? 1 : 0);
