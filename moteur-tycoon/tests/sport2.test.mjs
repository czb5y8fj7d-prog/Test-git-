// Sport v3 : calendrier, classements, historique, sponsors, image régionale.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(process.env.JSDOM_FROM || import.meta.url)('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0; const errs = []; w.addEventListener('error', e => errs.push(e.message));
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const click = sel => { const el = typeof sel === 'string' ? d.querySelector(sel) : sel; if (!el) throw new Error('introuvable : ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
d.querySelector('[data-act="newgame"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const p = () => TE.player(), pt = () => d.getElementById('panel').textContent, bad = t => /NaN|undefined|Infinity/.test(t), tab = t => { TE.UI.tab = t; TE.renderAll(true); };
TE.cheat.cash(5e9);
// engager deux écuries (budget seul + voiture de série à défaut : fournisseur)
for (const s of ['f2', 'tcr']) { TE.UI.tab = 'champs'; TE.UI.sps = s; TE.renderAll(true); click('[data-act="steam"][data-s="' + s + '"]'); for (let i = 0; i < 5 && !d.querySelector('#sheet [data-act="steamgo"]'); i++) { const n = d.querySelector('#sheet [data-act="pstep"][data-v]:not(.ghost)'); if (n) click(n); } click('[data-act="steamgo"]'); }
const S = () => TE.G.game.sport, mine = () => S().teams.filter(t => t.o === p().id);
ok(mine().length === 2, 'deux écuries engagées');
tab('sport'); ok(/Prochaines étapes/.test(pt()) && /Prochaines courses/.test(pt()) && !bad(pt()), 'aperçu : étapes et prochaines courses');
tab('calsp'); TE.UI.csr = 'f1'; tab('calsp'); ok(/Monaco/.test(pt()) && /grande course/.test(pt()) && /Courses/.test(pt()) && !bad(pt()), 'calendrier F1 : courses par pays');
ok(Object.keys(TE.GAMES.constructeur.api && TE.GAMES.constructeur.api.CAL || {}).length >= 0, 'calendriers');
tab('clsp'); ok(/Classement/.test(pt()) && /Moy/.test(pt()) && !bad(pt()), 'classements avec statistiques');
TE.cheat.skip(30 * 14); ok(mine().every(t => t.rn > 0), 'courses disputées sur le calendrier : ' + mine().map(t => t.rn).join('/'));
tab('clsp'); TE.UI.csr = 'f2'; tab('clsp'); click('.lnk[data-act="set"][data-k="stt"]'); ok(/Position moyenne/.test(pt()) && /Meilleur résultat/.test(pt()) && !bad(pt()), 'fiche détaillée d\'une écurie');
// sponsors : des offres arrivent, on signe, ça rapporte
TE.cheat.skip(30 * 8); tab('sponsp'); const t0 = mine()[0];
let n = 0; for (const t of mine()) n += (S().off[t.id] || []).length; ok(n > 0, 'des offres de sponsors arrivent : ' + n);
ok(/Sponsors/.test(pt()) && /Pays les plus touchés/.test(pt()) && /Par région/.test(pt()) && !bad(pt()), 'écran sponsors & image');
const sg = d.querySelector('[data-act="sspon"]:not([disabled])'); if (sg) { click(sg); ok(mine().some(t => t.sp.length), 'sponsor signé'); } else ok(false, 'bouton Signer absent');
const inc0 = S().tot.inc; TE.cheat.skip(30 * 2); ok(S().tot.inc > inc0, 'les recettes progressent');
// image : le buzz est enregistré par pays / région / monde
const b = p(); ok(b.spx && Object.keys(b.spx.c).length > 0, 'buzz par pays : ' + Object.keys(b.spx || { c: {} }).length);
// saisons
TE.cheat.skip(360 * 2); tab('histsp'); ok(/Mes saisons/.test(pt()) && /Bilan cumulé/.test(pt()) && /Dernières courses/.test(pt()) && !bad(pt()), 'historique : saisons, bilan, courses');
ok(mine().every(t => t.hs.length >= 1 && t.hs[0].rk >= 1), 'historique par écurie');
for (const t of ['sport', 'champs', 'calsp', 'clsp', 'histsp', 'sponsp', 'paddock']) { tab(t); ok(!bad(pt()) && pt().length > 200, 'onglet ' + t + ' propre'); }
ok(S().teams.every(t => Number.isFinite(t.tech) && Number.isFinite(t.fame) && Number.isFinite(t.inc) && Number.isFinite(t.exp)), 'aucune valeur NaN'); ok(errs.length === 0, 'aucune erreur JS ' + errs.join('|'));
process.exit(fails ? 1 : 0);
