// Banc d'essai moteur : cylindrée, cylindres, architecture, régime, compression, suralimentation, courbes couple/puissance.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(process.env.JSDOM_FROM || import.meta.url)('jsdom');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'dist', 'constructeur.html'), 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, TE = w.TE; let fails = 0; const errs = []; w.addEventListener('error', e => errs.push(e.message));
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
TE.newGame({ name: 'Test', diff: 1, seed: 5, cfg: { rivals: 4 } });
const api = TE.GAMES.constructeur.api, sp = s => api.partInfo('eng', Object.assign({ fuel: 'ess', size: 2, lvl: 1 }, { sim: s }));
// sim = disp|cyl|arch|rpmMax|cr|boost|boreStroke|vvt|inj
const base = sp('2|4|L|6500|10.5|0|1|n|i'), big = sp('3|4|L|6500|10.5|0|1|n|i'), turbo = sp('2|4|L|6500|10.5|0.8|1|n|i');
ok(base.st.kw > 0 && base.st.tq > 0, 'moteur de base : ' + Math.round(base.st.kw) + ' kW / ' + Math.round(base.st.tq) + ' Nm');
ok(big.st.kw > base.st.kw && big.st.tq > base.st.tq, 'cylindrée ↑ → puissance et couple ↑');
ok(turbo.st.tq > base.st.tq, 'turbo → couple ↑ (' + Math.round(turbo.st.tq) + ' Nm)');
const hi = sp('2|4|L|8000|10.5|0|1|n|i'); ok(hi.st.rpmP > base.st.rpmP, 'régime max ↑ → régime de puissance ↑');
const knock = sp('2|4|L|6500|13|1.2|1|n|i'); ok(knock.st.kw <= sp('2|4|L|6500|13|0.9|1|n|i').st.kw * 1.2, 'cliquetis limite le gain');
const r = api.simRun(api.simParse('2|4|L|6500|10.5|0.5|1|n|i'), 4); ok(r && r.pts && r.pts.length > 10, 'courbe calculée');
ok(['V', 'B'].every(a => sp('3|6|' + a + '|6500|10.5|0|1|n|i').st.arch === a), 'architectures V / boxer');
const M = api.partM('eng', { id: 1, spec: { fuel: 'ess', size: 2, lvl: 1, cls: 1, cap: 1, sim: '2|4|L|6500|10.5|0.5|1|n|i' } });
ok(M.xp === '1' && !M.sim, 'partM décode le banc d\'essai');
const x = api.specOf(Object.assign({ pk: 'eng' }, M)); ok(x && x.sim, 'specOf ré-encode : ' + (x && x.sim));
ok(errs.length === 0, 'aucune erreur JS ' + errs.join('|')); process.exit(fails ? 1 : 0);
