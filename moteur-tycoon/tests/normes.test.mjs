// Réglementations par région : blocs, plafonds CO2, amendes, quotas, homologation (sécurité / émission) et onglet Normes.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(process.env.JSDOM_FROM || import.meta.url)('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = w.document, TE = w.TE; let fails = 0; const errs = []; w.addEventListener('error', e => errs.push(e.message));
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
TE.newGame({ name: 'Test', diff: 1, seed: 17, cfg: { rivals: 6 } });
for (let i = 0; i < 360 * 2; i++) TE.step();
const G = TE.G, p = TE.player(), A = TE.GAMES.constructeur.api, pt = () => d.getElementById('panel').textContent;
TE.UI.tab = 'normes'; TE.renderAll(true);
ok(/Règles : Europe/.test(pt()) && /Homologation de ta gamme/.test(pt()) && /Calendrier prévisionnel/.test(pt()) && !/NaN|undefined|Infinity/.test(pt()), 'onglet Normes lisible');
ok(A.blocOf('FR') === 'ue' && A.blocOf('US') === 'us' && A.blocOf('CN') === 'cn' && A.blocOf('JP') === 'adv' && A.blocOf('MA') === 'low', 'pays rattachés au bon bloc réglementaire');
const y = A.absYear(G), Rue = A.ruleAt(G, 'ue', y), Rus = A.ruleAt(G, 'us', y), Rlow = A.ruleAt(G, 'low', y);
ok(Rue.co2 < Rus.co2 && Rue.safety > Rlow.safety && Rue.fine > Rus.fine && !Rlow.co2, 'Europe plus sévère que les États-Unis, marchés légers sans plafond');
ok(A.ruleAt(G, 'ue', y + 8).co2 < Rue.co2 && A.ruleAt(G, 'cn', 2032).nev > 0.3, 'plafonds qui se resserrent, quota électrifié chinois');
// homologation : un modèle sous la note de sécurité exigée ne se vend plus dans la région
const m = p.models.find(x => x.state === 'sale'); const s0 = m.st.safety; m.st.safety = Rue.safety - 5;
ok(!A.homoOk(Rue, m) && A.homoOk(Rlow, m), 'modèle trop peu sûr : refusé en Europe, accepté en marché léger'); m.st.safety = s0;
// amendes : on force un plafond impossible puis on laisse tourner un mois
G.game.rx = 0.3; for (let i = 0; i < 90; i++) TE.step();
const rv = TE.rivals().filter(a => a.rg && Object.values(a.rg).some(r => r.fc > 0)); ok(rv.length > 0, 'les concurrentes paient aussi des amendes (' + rv.length + ')');
G.game.rx = 1; TE.renderAll(true); ok(/Ta conformité par région/.test(pt()), 'tableau de conformité');
TE.UI.rsel = 'cn'; TE.renderAll(true); ok(/Règles : Chine/.test(pt()) && /Quota VE/.test(pt()), 'bascule sur la Chine');
const adv = TE.GAMES.constructeur.advice ? 1 : 1; ok(!!JSON.parse(JSON.stringify(G)), 'état sérialisable');
ok(errs.length === 0, 'aucune erreur JS ' + errs.join('|')); process.exit(fails ? 1 : 0);
