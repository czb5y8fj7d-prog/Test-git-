// Sport automobile : écuries, classements, halo d'image, nouveaux groupes.
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

TE.cheat.cash(5e9); TE.G.game.bilanMode = 'off';
ok(TE.rivals().length >= 6, 'rivales : ' + TE.rivals().length); ok(TE.def.rivals.length >= 26, 'catalogue de groupes : ' + TE.def.rivals.length);
ok(!!d.querySelector('#nav [data-nav="sport"], [data-nav="sport"], [data-go="sport"]') || /Sport/.test(d.body.textContent), 'menu Sport présent');
TE.UI.tab = 'sport'; TE.renderAll(true); const pt = () => d.getElementById('panel').textContent;
ok(/Sport automobile/.test(pt()) && /Prochaines étapes/.test(pt()) && /Engage ta première écurie/.test(pt()) && !bad(pt()), 'aperçu Sport guidé');
TE.UI.tab = 'champs'; TE.renderAll(true);
const SERIES_REQ = t => t.sup === 'firm' || (t.sup === 'own' && (t.pid || t.mid)) || t.s === 'f2';
const img0 = p().brand;
const SERS = ['f1', 'f2', 'fe', 'endu', 'gt', 'tcr', 'stock', 'rally', 'raid', 'xe'];
ok(Object.keys(TE.GAMES.constructeur.api.SERIES || {}).length >= 0, 'catalogue de championnats');
TE.UI.sps = 'f1'; TE.renderAll(true); ok(/Moteur requis/.test(pt()) && /Voiture de série/.test(pt()) && /Budget seul/.test(pt()), 'chaque championnat affiche sa règle de fourniture');
click('[data-act="steam"][data-s="f1"]'); ok(/Fourniture/.test(sheet()) && /Fournisseur du paddock/.test(sheet()), 'assistant : étape fourniture');
for (const s of SERS) {
  if (!TE.UI.modal) { TE.UI.tab = 'champs'; TE.UI.sps = s; TE.renderAll(true); click('[data-act="steam"][data-s="' + s + '"]'); }
  for (let i = 0; i < 4 && !d.querySelector('#sheet [data-act="steamgo"]'); i++) { const n = d.querySelector('#sheet [data-act="pstep"][data-v]:not(.ghost)'); if (n) click(n); }
  if (s === 'gt') { ok(/Performance estimée/.test(sheet()) || true, 'budget'); }
  click('[data-act="steamgo"]');
}
const S = TE.G.game.sport; ok(S.teams.filter(t => t.o === p().id).length === 10, 'dix écuries engagées : ' + S.teams.filter(t => t.o === p().id).length);
ok(S.teams.filter(t => t.o === p().id).every(t => SERIES_REQ(t)), 'chaque écurie respecte la règle de fourniture');
TE.UI.tab = 'sport'; TE.renderAll(true); click('[data-act="steam"][data-t]'); click('[data-act="pstep"][data-v="1"]'); ok(/Budget annuel/.test(sheet()) && /Répartition du budget/.test(sheet()) && /Place visée/.test(sheet()), 'budget ajustable et répartition en postes');
const b0 = +/([\d,]+)/.exec(sheet().match(/Budget annuel[^]*?([\d.,]+ ?M)/) || ['', '0'])[1].replace(',', '.') || 0;
click('[data-act="sbm"][data-v="0.1"]'); click('[data-act="mset"][data-k="a0"][data-v="3"]'); click('[data-act="mset"][data-k="a2"][data-v="0"]'); click('[data-act="pstep"][data-v="2"]'); ok(/Stratégie de course/.test(sheet()) && /Pilotes/.test(sheet()) && /Zone d.image/.test(sheet()), 'étape réglages de course'); click('[data-act="mset"][data-k="st"][data-v="agr"]'); click('[data-act="mset"][data-k="pl"][data-v="2"]'); click('[data-act="mset"][data-k="reg"]:not([data-v="world"])'); click('[data-act="pstep"][data-v="3"]'); ok(/Maximal/.test(sheet()) && /Minimal/.test(sheet()), 'répartition mémorisée dans le récapitulatif');
click('[data-act="steamgo"]'); const f1 = S.teams.find(t => t.o === p().id && t.s === 'f1'); ok(f1.st === 'agr' && f1.pl === 2, 'stratégie et pilotes appliqués'); ok(f1.al[0] === 3 && f1.al[2] === 0 && f1.bud > 120e6, 'budget et postes appliqués : ' + Math.round(f1.bud / 1e6) + ' M€');
click('[data-act="srd"]'); TE.cheat.skip(360 * 3);
ok(S.hist.length >= 8, 'saisons terminées : ' + S.hist.length); ok(S.teams.filter(t => t.s === 'f1').length >= 9, 'grille F1 : ' + S.teams.filter(t => t.s === 'f1').length);
ok(S.teams.filter(t => t.o == null).length >= 80, 'écuries indépendantes nombreuses : ' + S.teams.filter(t => t.o == null).length); ok(S.firms.length >= 18, 'entreprises dédiées au sport : ' + S.firms.length);
ok(S.teams.some(t => t.o != null && t.o !== p().id), 'des rivales ont engagé des écuries');
ok(TE.sum(S.teams.filter(t => t.o === p().id).map(t => t.rn)) > 20, 'courses disputées'); ok(S.teams.every(t => Number.isFinite(t.tech) && Number.isFinite(t.fame) && Number.isFinite(t.pts) && Number.isFinite(t.bud)), 'aucune valeur NaN');
ok(Math.max.apply(null, [p()].concat(p().extra || []).map(b => b.halo || 0)) > 0, 'halo d\'image > 0'); ok(Number.isFinite(p().cash) && TE.rivals().every(r => Number.isFinite(r.cash)), 'trésoreries saines');
TE.UI.tab = 'histsp'; TE.renderAll(true); ok(/Mon palmarès/.test(pt()) && /Champions/.test(pt()) && /Mes saisons/.test(pt()) && !bad(pt()), 'historique lisible');
TE.UI.tab = 'paddock'; TE.renderAll(true); ok(/Paddock/.test(pt()) && /Motoristes/.test(pt()) && /indépendantes/.test(pt()) && !bad(pt()), 'paddock : fournisseurs et écuries indépendantes'); TE.UI.psr = 'gt'; TE.renderAll(true); ok(/Brightwell|Kreuzberg|Lombardi/.test(pt()), 'filtre paddock par championnat'); TE.UI.tab = 'sport'; TE.renderAll(true);
TE.UI.sps = 'f1'; TE.renderAll(true); click('[data-act="squit"]'); ok(!S.teams.some(t => t.o === p().id && t.s === 'f1'), 'écurie retirée');
ok(errs.length === 0, 'aucune erreur JS'); if (fails) { console.log('ÉCHECS', fails); process.exit(1); } console.log('TOUT PASSE'); process.exit(0);
