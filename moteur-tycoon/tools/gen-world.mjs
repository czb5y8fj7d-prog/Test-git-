// Génère games/constructeur/world.js (données pays) et world-map.js (tracés SVG) à partir de world-atlas / world-countries.
// Usage : (dans un dossier où sont installés world-atlas topojson-client d3-geo world-countries country-json)  node tools/gen-world.mjs <dossier_node_modules>
import fs from 'node:fs'; import { createRequire } from 'node:module';
const nm = process.argv[2] || '/tmp/wd/node_modules';
const rq = createRequire(nm + '/x.js');
const topo = rq('topojson-client'), d3 = rq('d3-geo'), WC = rq('world-countries'), POP = rq('country-json/src/country-by-population.json');
const atlas = JSON.parse(fs.readFileSync(nm + '/world-atlas/countries-110m.json', 'utf8'));
// PIB par habitant (USD, ~2023) — saisi à la main
const G = `AL:8800 AT:52000 BY:7500 BE:51000 BA:8000 BG:14000 HR:20000 CY:31000 CZ:30000 DK:67000 EE:29000 FI:53000 FR:44000 DE:52000 GR:22000 HU:21000 IS:79000 IE:100000 IT:38000 XK:6200 LV:21000 LT:26000 LU:128000 MT:36000 MD:6500 ME:11000 NL:58000 MK:7500 NO:87000 PL:22000 PT:27000 RO:18000 RU:13000 RS:10500 SK:24000 SI:31000 ES:33000 SE:56000 CH:93000 UA:5200 GB:49000
AR:13700 BO:3600 BR:10000 CA:53000 CL:17000 CO:6600 CR:14000 CU:9500 DO:10800 EC:6400 SV:5300 GT:5600 GY:18000 HT:1700 HN:3200 JM:6000 MX:13800 NI:2500 PA:18000 PY:6000 PE:7500 TT:17000 US:82000 UY:21000 VE:4000 BZ:4900 BS:32000 SR:5600 BB:19000
DZ:4300 AO:2300 BJ:1400 BW:7600 BF:900 BI:250 CM:1700 CV:4000 CF:500 TD:700 KM:1500 CG:2400 CD:700 CI:2600 DJ:3500 EG:3500 GQ:7000 ER:650 SZ:4000 ET:1000 GA:8500 GM:800 GH:2300 GN:1300 GW:850 KE:2100 LS:1000 LR:750 LY:6000 MG:500 MW:650 ML:950 MR:2000 MU:11000 MA:3900 MZ:600 NA:4900 NE:600 NG:1600 RW:1000 SN:1700 SL:450 SO:600 ZA:6300 SS:400 SD:750 TZ:1200 TG:1000 TN:3900 UG:1000 ZM:1400 ZW:1700
AF:400 AM:8000 AZ:7300 BH:29000 BD:2600 BT:3800 BN:33000 KH:1800 CN:12700 GE:8000 IN:2500 ID:4900 IR:4500 IQ:5700 IL:54000 JP:34000 JO:4500 KZ:13000 KW:36000 KG:1500 LA:2000 LB:3500 MY:12000 MV:13000 MN:5500 MM:1200 NP:1300 OM:21000 PK:1500 PH:3600 QA:88000 SA:32000 SG:88000 KR:33000 LK:3800 SY:900 TW:33000 TJ:1100 TH:7300 TL:1500 TR:13000 TM:8000 AE:50000 UZ:2200 VN:4300 YE:600
AU:65000 FJ:5500 NZ:48000 PG:2700 SB:2300 VU:3000`.split(/\s+/).reduce((o, s) => { const [k, v] = s.split(':'); o[k] = +v; return o; }, {});
const EU = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE NO IS'.split(' ');
const ZONE = { CA: 'US', MX: 'US', AR: 'BR', UY: 'BR', PY: 'BR', RU: 'EA', BY: 'EA', KZ: 'EA', AM: 'EA', KG: 'EA', ID: 'AS', MY: 'AS', TH: 'AS', VN: 'AS', PH: 'AS', SG: 'AS', KH: 'AS', LA: 'AS', MM: 'AS', BN: 'AS', SA: 'GC', AE: 'GC', QA: 'GC', KW: 'GC', BH: 'GC', OM: 'GC' };
EU.forEach(c => ZONE[c] = 'EU');
const REG = {   // sous-région → [id, libellé, continent]
  'Western Europe': ['euo', 'Europe de l\'Ouest', 'Europe'], 'Central Europe': ['euo', 'Europe de l\'Ouest', 'Europe'], 'Northern Europe': ['eun', 'Europe du Nord', 'Europe'],
  'Southern Europe': ['eus', 'Europe du Sud', 'Europe'], 'Southeast Europe': ['eus', 'Europe du Sud', 'Europe'], 'Eastern Europe': ['eue', 'Europe de l\'Est', 'Europe'],
  'North America': ['nam', 'Amérique du Nord', 'Amériques'], 'Northern America': ['nam', 'Amérique du Nord', 'Amériques'], 'Central America': ['cam', 'Amérique centrale et Caraïbes', 'Amériques'], 'Caribbean': ['cam', 'Amérique centrale et Caraïbes', 'Amériques'],
  'South America': ['sam', 'Amérique du Sud', 'Amériques'], 'Northern Africa': ['afn', 'Afrique du Nord', 'Afrique'], 'Western Africa': ['afo', 'Afrique de l\'Ouest', 'Afrique'],
  'Middle Africa': ['afc', 'Afrique centrale', 'Afrique'], 'Eastern Africa': ['afe', 'Afrique de l\'Est', 'Afrique'], 'Southern Africa': ['afs', 'Afrique australe', 'Afrique'],
  'Western Asia': ['mo', 'Moyen-Orient et Caucase', 'Asie'], 'Central Asia': ['asc', 'Asie centrale', 'Asie'], 'Southern Asia': ['ass', 'Asie du Sud', 'Asie'],
  'Eastern Asia': ['ase', 'Asie de l\'Est', 'Asie'], 'South-Eastern Asia': ['asx', 'Asie du Sud-Est', 'Asie'], 'Australia and New Zealand': ['oce', 'Océanie', 'Océanie'], 'Melanesia': ['oce', 'Océanie', 'Océanie'], 'Micronesia': ['oce', 'Océanie', 'Océanie'], 'Polynesia': ['oce', 'Océanie', 'Océanie'] };
const byA2 = {}; for (const c of WC) byA2[c.cca2] = c;
byA2.XK = byA2.XK || { cca2: 'XK', cca3: 'XKX', name: { common: 'Kosovo' }, translations: { fra: { common: 'Kosovo' } }, subregion: 'Southeast Europe', borders: ['ALB', 'MKD', 'MNE', 'SRB'], latlng: [42.6, 20.9], independent: true, ccn3: '' };
const popOf = {}; for (const p of POP) popOf[p.country] = p.population;
const ALIAS = { 'United States': 'United States', 'Czechia': 'Czech Republic', 'Russia': 'Russia', 'DR Congo': 'DR Congo', 'Congo': 'Republic of the Congo', 'Ivory Coast': "Côte d'Ivoire", 'Myanmar': 'Myanmar', 'South Korea': 'South Korea', 'North Macedonia': 'Macedonia', 'Eswatini': 'Swaziland', 'Cape Verde': 'Cape Verde', 'Timor-Leste': 'East Timor', 'Brunei': 'Brunei', 'Kosovo': 'Kosovo', 'Bosnia and Herzegovina': 'Bosnia and Herzegovina', 'Palestine': 'Palestine', 'United Kingdom': 'United Kingdom', 'Laos': 'Laos', 'Syria': 'Syria', 'Vatican City': 'Vatican City', 'Trinidad and Tobago': 'Trinidad and Tobago', 'Gambia': 'Gambia', 'Bahamas': 'Bahamas', 'Taiwan': 'Taiwan', 'Moldova': 'Moldova', 'Iran': 'Iran', 'Tanzania': 'Tanzania', 'Venezuela': 'Venezuela', 'Bolivia': 'Bolivia' };
const POPFIX = { CG: 6.1e6, CD: 102e6, TR: 85e6, FJ: 0.93e6, XK: 1.8e6, TW: 23.5e6, SS: 11e6, KM: 0.85e6, CV: 0.56e6, MK: 1.8e6 };
const lerp = (a, b, t) => a + (b - a) * t, cl = (x, a, b) => Math.max(a, Math.min(b, x));
const rows = {}, missing = [];
for (const [a2, gdp] of Object.entries(G)) {
  const c = byA2[a2]; if (!c) { missing.push('wc:' + a2); continue; }
  let pop = POPFIX[a2] || popOf[c.name.common] || popOf[ALIAS[c.name.common]] || popOf[c.name.official];
  if (!pop) { missing.push('pop:' + a2 + ' ' + c.name.common); continue; }
  if (pop < 0.4e6) continue;
  const sub = c.subregion || ''; const R = REG[sub] || REG[c.region] || (missing.push('reg:' + a2 + ' ' + sub), ['oce', 'Autres', 'Autres']);
  const k = 0.045 * Math.pow(Math.min(1.3, gdp / 50000), 0.9), vol = pop * k;
  const wealth = cl(0.35 + 0.65 * Math.pow(gdp / 45000, 0.45), 0.3, 1.35), lab = cl(0.2 + 0.8 * Math.pow(gdp / 45000, 0.6), 0.15, 1.3);
  const rich = ['EU', 'GB'].includes(ZONE[a2]) || ['CH', 'GB', 'NO'].includes(a2);
  let tariff = cl(0.30 - 0.18 * wealth, 0.08, 0.30); if (EU.includes(a2) || a2 === 'CH' || a2 === 'GB') tariff = 0.10; const T = { CN: .25, IN: .40, BR: .20, TR: .30, AR: .35, US: .15, MX: .20, CA: .06, JP: .0, KR: .08, AU: .05, ZA: .25, RU: .20, ID: .30, TH: .30, VN: .30 }; if (T[a2] != null) tariff = T[a2];
  const strict = rich ? 1 : ['JP', 'KR', 'AU', 'NZ', 'CA', 'IL', 'TW', 'TR'].includes(a2) ? 0.7 : a2 === 'US' ? 0.4 : cl(wealth - 0.35, 0.05, 0.5);
  const EV = { NO: .95, SE: .55, NL: .5, DK: .5, IS: .6, CN: .6, FI: .4, DE: .4, GB: .4 }; const ev = EV[a2] || cl(0.06 + 0.3 * Math.max(0, wealth - 0.4), 0.05, 0.4);
  let taste = wealth < 0.6 ? [.38, .32, .05, .24, .01] : [.22, .30, .15, .30, .03];
  if (['US', 'CA', 'AU', 'NZ', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'MX'].includes(a2)) taste = [.04, .16, .22, .50, .08];
  if (a2 === 'JP') taste = [.32, .30, .08, .26, .04]; if (a2 === 'KR') taste = [.10, .28, .22, .36, .04]; if (a2 === 'IN') taste = [.20, .38, .05, .35, .02];
  if (R[0].startsWith('eu') && wealth >= 0.6) taste = [.20, .30, .15, .31, .04];
  const g = cl(0.008 + 0.022 * (1 - cl(wealth, 0, 1)) * 1.2, 0.006, 0.03);
  rows[a2] = { n: c.translations?.fra?.common || c.name.common, reg: R[0], cont: R[2], pop: Math.round(pop / 1e5) / 10, gdp, vol: Math.round(vol / 1e3) * 1e3, wealth: +wealth.toFixed(2), lab: +lab.toFixed(2), zone: ZONE[a2] || a2, tariff: +tariff.toFixed(2), ev: +ev.toFixed(2), strict: +strict.toFixed(2), g: +g.toFixed(3), taste, ll: c.latlng, nb: (c.borders || []).map(b => WC.find(x => x.cca3 === b)?.cca2).filter(Boolean) };
}
for (const r of Object.values(rows)) r.nb = r.nb.filter(x => rows[x]);
const regs = {}; for (const r of Object.values(rows)) regs[r.reg] = [...new Set([...(regs[r.reg] || []), r.cont])];
const REGL = {}; for (const [, v] of Object.entries(REG)) REGL[v[0]] = [v[1], v[2]];
// ---- carte
const projection = d3.geoNaturalEarth1().fitExtent([[6, 6], [994, 500]], { type: 'Sphere' });
const path = d3.geoPath(projection).digits(1);
const feats = topo.feature(atlas, atlas.objects.countries).features;
const n3 = {}; for (const c of WC) n3[c.ccn3] = c.cca2;
const paths = {}, other = [];
for (const f of feats) {
  let a2 = n3[String(f.id).padStart(3, '0')]; if (f.properties.name === 'Kosovo') a2 = 'XK'; if (f.properties.name === 'Antarctica') continue;
  const d = path(f); if (!d) continue;
  if (a2 && rows[a2]) paths[a2] = d; else other.push(d);
}
const dots = {}; for (const [a2, r] of Object.entries(rows)) { const p = projection([r.ll[1], r.ll[0]]); r.xy = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; if (!paths[a2]) dots[a2] = r.xy; }
const hdr = 'Généré par tools/gen-world.mjs — ne pas éditer à la main.';
const out = 'games/constructeur/';
fs.writeFileSync(out + 'world.js', `/* ${hdr} */\n(function(r){r.WORLD=${JSON.stringify({ regions: REGL, countries: rows })};})(typeof globalThis!=='undefined'?globalThis:this);\n`);
fs.writeFileSync(out + 'world-map.js', `/* ${hdr} */\n(function(r){r.WORLDMAP=${JSON.stringify({ vb: [0, 0, 1000, 506], paths, other: other.join(''), dots })};})(typeof globalThis!=='undefined'?globalThis:this);\n`);
console.log('pays', Object.keys(rows).length, 'dots', Object.keys(dots).join(','), 'manquants', missing.join(' | '));
console.log('tailles', fs.statSync(out + 'world.js').size, fs.statSync(out + 'world-map.js').size);
