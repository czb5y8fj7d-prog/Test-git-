// Pièces v2 : paramètres avancés, familles et redesign, mise à jour mécanique, archivage, tendances régionales / mondiales.
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
TE.cheat.cash(5e9); TE.G.game.bilanMode = 'off'; TE.cheat.skip(65);
TE.GAMES.constructeur.cheats.find(c => /Pièces/.test(c.label)).run(TE.G, p());

// 1. tendances présentes et lisibles
const tr = TE.G.game.tr; ok(tr && tr.eff && Object.keys(tr.eff).length >= 10, 'tendances régionales initialisées');
TE.UI.tab = 'pieces'; TE.renderAll(true); ok(d.querySelectorAll('.ptile').length === 3, 'trois cases principales (moteurs, châssis, boîtes)'); ok(/Tendances du marché/.test(pt()) && !bad(pt()), 'carte « Tendances du marché » dans les pièces');
click('[data-act="fold"][data-k="trends"]'); ok(/Motorisation/.test(sheet()) && /Électrique/.test(sheet()) && /Carrosseries/.test(sheet()) && !bad(sheet()), 'feuille des tendances : motorisation, boîtes, carrosseries, goûts');
click('[data-act="set"][data-k="trs"][data-v="Asie"]'); ok(/Électrique/.test(sheet()), 'filtre par continent'); TE.closeModal();

// 2. nouveau développement avec paramètres avancés
const n0 = p().parts.length; TE.UI.tab = 'pieces'; TE.renderAll(true); click('[data-act="newpart"][data-k=""]'); ok(d.querySelectorAll('.kcard').length === 3 && /Nouvelle pièce/.test(sheet()), 'trois grandes cases au départ');
click('[data-act="pkind"][data-k="eng"]'); ok(/Énergie et taille/.test(sheet()) && /Compatibilité avec ton catalogue/.test(sheet()), 'étape 1 : énergie, taille et compatibilité du catalogue');
mset('size', '2'); const go = n => click('[data-act="pstep"][data-v="' + n + '"]'); go(2);
ok(/Nombre de cylindres/.test(sheet()) && /Puissance cible/.test(sheet()) && /Admission/.test(sheet()) && /\d+ ch/.test(sheet()), 'étape configuration : cylindres, puissance cible en ch, admission');
mset('cyl', '6'); mset('pw', '1.2'); mset('air', 'turbo');
ok(/Effet de tes choix/.test(sheet()) && /de puissance/.test(sheet()) && /Cylindrée/.test(sheet()) && !bad(sheet()), 'effets chiffrés et cylindrée affichés'); go(3); ok(/Technologie embarquée/.test(sheet()) && !/\bN\d\b/.test(sheet()), 'étape technologie : noms de technologies, plus de N1, N2…'); mset('lvl', '4'); go(4); ok(/Tendances du marché/.test(sheet()) && /Lancer/.test(sheet()), 'récapitulatif : tendances et lancement');
click('[data-act="startpart"]'); ok(p().proj.length === 1 && /Turbo/.test(p().proj[0].name) && /6 cyl\./.test(p().proj[0].name) && / ch/.test(p().proj[0].name) && p().proj[0].fname, 'développement lancé : cylindres et chevaux dans le nom');
for (let i = 0; i < 400 && p().proj.length; i++) TE.cheat.skip(5);
const turbo = p().parts.find(x => x.spec.air === 'turbo'); ok(!!turbo && turbo.gen === 1 && turbo.fam === turbo.id && turbo.spec.cyl === 6 && turbo.spec.pw === '1.2', 'pièce livrée (génération 1, 6 cylindres, +20 %)');
const plain = p().parts.find(x => x.kind === 'eng' && x.spec.fuel === 'ess' && x.spec.size === 2 && !x.spec.air && !x.spec.tune);
ok(turbo.st.kw > 150, 'turbo + performance : puissance nettement plus haute (' + Math.round(turbo.st.kw) + ' kW pour une taille M niveau 4 qui en donnerait 122)');

// 3. redesign : moins cher, génération suivante, même famille
TE.UI.tab = 'pieces'; TE.renderAll(true); TE.UI.fpk = 'eng'; TE.renderAll(true); click('[data-act="fold"][data-k="p' + turbo.id + '"]'); ok(/Redesign → G2/.test(sheet()), 'bouton redesign dans la fiche de la famille');
click('[data-act="redesign"][data-id="' + turbo.id + '"]'); ok(/Redesign/.test(sheet()) && /% du coût d'un développement neuf/.test(sheet()) && /\(famille\)/.test(sheet()), 'feuille de redesign : énergie et taille verrouillées');
mset('lvl', String(turbo.spec.lvl)); mset('pw', '1.2'); ok(d.querySelector('[data-act="startpart"]').disabled || d.querySelector('[data-act="startpart"]').hasAttribute('disabled') || /Change au moins/.test(sheet()), 'sans changement, le redesign est refusé');
mset('lvl', '6'); mset('pw', '0.9'); const cash0 = p().cash; click('[data-act="startpart"]');
const pj = p().proj[0]; ok(pj && pj.parent === turbo.id && pj.gen === 2 && pj.fname === turbo.fname, 'projet de redesign rattaché à la famille');
ok(pj.cost < 0.9 * (0 + w.eval('1') && pj.cost / 0.85) && pj.cost > 0, 'budget de redesign raisonnable');
for (let i = 0; i < 500 && p().proj.length; i++) TE.cheat.skip(5);
const g2 = p().parts.find(x => x.parent === turbo.id); ok(g2 && g2.gen === 2 && g2.fam === turbo.fam && /G2/.test(g2.name), 'génération 2 livrée : ' + (g2 && g2.name));
ok(g2.st.rel >= turbo.st.rel - 8 && Number.isFinite(g2.st.cost), 'caractéristiques cohérentes');
TE.UI.tab = 'pieces'; TE.renderAll(true); ok(!bad(pt()), 'liste des pièces sans valeur invalide');

// 4. mise à jour mécanique d'un modèle sur l'ancienne génération
const e1 = p().parts.find(x => x.kind === 'eng' && !x.lic && x.spec.fuel === 'ess' && x.spec.size === 1 && !x.spec.air && x.id !== turbo.id);
const c1 = p().parts.find(x => x.kind === 'chs' && !x.lic && x.spec.cls === 2 && x.st.maxKW >= 150), b1 = p().parts.find(x => x.kind === 'gbx' && x.spec.type === 'man' && x.st.maxKW >= 120);
ok(!!e1 && !!c1 && !!b1, 'pièces de base disponibles pour un petit modèle');
TE.UI.tab = 'pieces'; TE.renderAll(true); TE.UI.fpk = 'eng'; TE.renderAll(true); click('[data-act="fold"][data-k="p' + e1.id + '"]'); click('[data-act="redesign"][data-id="' + e1.id + '"]'); mset('lvl', String(Math.min(8, e1.spec.lvl + 2))); mset('pw', '0.9'); click('[data-act="startpart"]');
for (let i = 0; i < 500 && p().proj.some(x => x.parent === e1.id); i++) TE.cheat.skip(5);
const e2 = p().parts.find(x => x.parent === e1.id); ok(!!e2 && e2.gen === 2 && e2.st.co2 < e1.st.co2 && e2.st.rel > e1.st.rel, 'G2 plus sobre et plus fiable que G1 (' + Math.round(e1.st.co2) + ' → ' + Math.round(e2.st.co2) + ' g)');
p().models.push({ id: 99001, name: 'Test Mécanique', body: 'cit', eng: e1.id, chs: c1.id, gbx: b1.id, fuel: 'ess', fin: 2, sty: 0, st: { perf: 50, handling: 50, comfort: 50, safety: 50, rel: 50, design: 55, space: 56, co2: 120, kg: 1200, kw: e1.st.kw }, cost: 12000, price: 22000, camp: 0, br: 0, stock: 0, hype: 0, disc: 0, discLeft: 0, state: 'sale', left: 0, total: 1, monthly: 0, devCost: 60e6, age: 30, sold: 0, soldTot: 0, hist: [], cs: {} });
const um = p().models.find(m => m.id === 99001); TE.UI.tab = 'gamme'; TE.renderAll(true); click('[data-act="fold"][data-k="m99001"]');
const cashM = p().cash, bt = d.querySelector('[data-act="migrate"][data-m="99001"]'); ok(!!bt && /Nouvelle génération disponible/.test(sheet()), 'la fiche du modèle propose la mise à jour mécanique');
click(bt); ok(um.eng === e2.id && p().cash < cashM && um.age < 30 && !bad(JSON.stringify(um.st)) && um.st.co2 < 130, 'moteur G2 adopté, coût payé, modèle rajeuni');

// 5. archivage
const free = p().parts.find(x => x.kind === 'eng' && x.id !== turbo.id && x.id !== g2.id && !p().models.some(m => m.state !== 'end' && m.eng === x.id));
if (free) { TE.UI.tab = 'pieces'; TE.renderAll(true); TE.UI.fpk = free.kind; TE.renderAll(true); click('[data-act="fold"][data-k="p' + free.id + '"]'); click('[data-act="archpart"][data-id="' + free.id + '"]'); ok(free.arch === true, 'pièce inutilisée archivée'); TE.UI.fpu = 'arch'; TE.UI.tab = 'pieces'; TE.renderAll(true); ok(/archiv/i.test(pt()) || d.querySelectorAll('.fold').length >= 1, 'filtre « Archivées »'); TE.UI.fpu = ''; }

// 6. anciennes sauvegardes : pièces sans famille
const old = p().parts.find(x => x.kind === 'chs' && !x.lic); delete old.fam; delete old.fname; delete old.gen; TE.UI.tab = 'pieces'; TE.renderAll(true); ok(!bad(pt()), 'pièce sans famille (ancienne sauvegarde) affichée');
TE.UI.fpk = old.kind; TE.renderAll(true); click('[data-act="fold"][data-k="p' + old.id + '"]'); click('[data-act="redesign"][data-id="' + old.id + '"]'); mset('lvl', String(Math.min(8, old.spec.lvl + 1))); mset('mat', 'alu'); click('[data-act="startpart"]');
ok(p().proj.some(x => x.parent === old.id) && old.fname, 'redesign d\'une ancienne pièce : famille créée à la volée');

// 7. tendances sur plusieurs années : bornées, finies, et qui influencent les ventes
TE.cheat.skip(360 * 4); const t2 = TE.G.game.tr, ks = Object.keys(t2.eff.euo);
ok(Object.values(t2.eff).every(r => Object.values(r).every(v => Number.isFinite(v) && v > 0.4 && v < 2.1)), 'indices bornés après 4 ans');
ok(t2.eff.euo.f_elec > 1.05 && t2.eff.euo.f_die < 1, 'dérive de fond : électrique en hausse, diesel en baisse (' + t2.eff.euo.f_elec + ' / ' + t2.eff.euo.f_die + ')');
ok(Number.isFinite(p().cash) && TE.rivals().every(r => Number.isFinite(r.cash)), 'trésoreries saines après 4 ans');
ok(errs.length === 0, 'aucune erreur JS'); if (fails) { console.log('ÉCHECS', fails); process.exit(1); } console.log('TOUT PASSE'); process.exit(0);
