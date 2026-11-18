/* =============================================================================
   TYCOON ENGINE — ui.js
   Kit d'interface : coque (en-tête, onglets, panneau, fenêtres), rendu incrémental (morph),
   composants HTML (tuiles, graphiques, jauges, curseurs), écran de départ, sauvegardes,
   boucle d'animation. Dépend de core.js. Le jeu ne fournit que du HTML pour ses onglets.
   ============================================================================= */
(function (root) {
'use strict';
const TE = root.TE;
const $ = id => document.getElementById(id);
const esc = TE.esc, nf = TE.nf, money = TE.money, clamp = TE.clamp;

TE.ICONS = {"campus": "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6", "tableau": "M4 17a8 8 0 1 1 16 0M12 17l4-5M12 17h.01M6 11l1 1M12 7v1.5M18 11l-1 1", "classement": "M3 20h18M5 20v-6h4v6M10 20V8h4v12M15 20v-4h4v4M12 4l.6 1.4 1.4.2-1 1 .2 1.4L12 7.3l-1.2.7.2-1.4-1-1 1.4-.2z", "actus": "M5 5h12v14H6a1 1 0 0 1-1-1zM17 9h3v9a1 1 0 0 1-1 1M8 9h6M8 12h6M8 15h4", "gamme": "M3 15l1.5-4.5A2 2 0 0 1 6.4 9h11.2a2 2 0 0 1 1.9 1.5L21 15v3H3zM3 15h18M7 18v1.5M17 18v1.5M7.5 15.5h.01M16.5 15.5h.01", "pieces": "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1", "usines": "M3 20V10l5 3v-3l5 3V6h3v14zM3 20h18M17 6V3M9 17h.01M13 17h.01", "stocks": "M3 20v-7h8v7zM13 20v-7h8v7zM7 13V5h10v8M3 20h18", "pays": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18", "marque": "M4 10v4h3l7 4V6L7 10zM17 9a4 4 0 0 1 0 6M7 14l1 5h2l-1-4", "groupe": "M6 20V5h8v15M14 10h4v10M9 8h2M9 11h2M9 14h2M4 20h16M16 13h.01M16 16h.01", "licences": "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h4", "finances": "M5 7c0-1.4 3-2.5 7-2.5S19 5.6 19 7s-3 2.5-7 2.5S5 8.4 5 7zM5 7v5c0 1.4 3 2.5 7 2.5s7-1.1 7-2.5V7M5 12v5c0 1.4 3 2.5 7 2.5s7-1.1 7-2.5v-5", "nouveau": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8", "ingenieurs": "M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 20c0-3.3 2.7-5 6-5s6 1.7 6 5M7 7.5h10M9 6.5a3 3 0 0 1 6 0", "concession": "M4 10l1-5h14l1 5M4 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0M5 12v8h14v-8M10 20v-5h4v5", "extension": "M4 20V10l8-6 8 6v10zM12 9v7M8.5 12.5h7", "automatisation": "M4 20h7M8 20v-5l6-6M14 9l3 3M17 12l3-2M14 9l1-3", "energie": "M13 3L6 13h5l-1 8 8-11h-5z", "vente": "M3 12V4h8l9 9-8 8zM7.5 7.5h.01", "rachat": "M8 15a4 4 0 1 1 3-3l9 9M17 20l2-2M14 17l2-2", "fonds": "M4 5h16v14H4zM8 9h8v6H8zM12 12h.01M4 19v1.5M20 19v1.5", "reglages": "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4", "sauvegarde": "M5 4h12l2 2v14H5zM8 4v5h7V4M8 20v-6h8v6", "filtres": "M4 5h16l-6 8v6l-4-2v-4z", "tresorerie": "M9 4h6l-1 3h-4zM10 7c-5 3-5 11-3 14h10c2-3 2-11-3-14M12 12v5", "dette": "M9 15l6-6M7 13l-2 2a3 3 0 0 0 4 4l2-2M17 11l2-2a3 3 0 0 0-4-4l-2 2", "image": "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z", "qualite": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l3 3 5-6", "alerte": "M12 4l9 16H3zM12 10v4M12 17h.01", "succes": "M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8M10 17h4", "temps": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2", "vitesse": "M5 6l7 6-7 6zM13 6l7 6-7 6z", "co2": "M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4.8 4.8 0 0 1 17.5 18z", "electrique": "M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5", "carburant": "M5 20V5h8v15M4 20h10M13 9h3l2 2v6a1.5 1.5 0 0 0 3 0V9l-3-3M7 8h4", "rappel": "M14 6a4 4 0 0 0 4 4l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 0-1-1zM17 3l4 4"};
TE.ico = (name, cls) => { const u = TE.art && TE.art('ico-' + name); if (u) return '<img class="ic art ' + (cls || '') + '" src="' + u + '" alt="" loading="lazy" decoding="async">';
  const d = TE.ICONS[name]; return d ? '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>' : ''; };
const ic = x => (/^[a-z0-9]+$/.test(x || '') && TE.ICONS[x]) ? TE.ico(x) : (x || '');
const UI = TE.UI = { txt: {}, open: {}, hubTab: {}, fabOpen: false,
  tab: null, sub: {}, speed: 0, lastSpeed: 2, modal: null, acc: 0, dirty: true, lastRender: 0,
  holding: false, amt: {}, scr: {}, pkey: null, endShown: 0, lastSave: 0
};

/* =============================== Composants HTML =============================== */
const H = TE.h = {};
H.tile = (l, v, c) => '<div class="tile"><small>' + l + '</small><b class="' + (c || '') + '">' + v + '</b></div>';
H.tiles = arr => '<div class="tiles">' + arr.map(t => H.tile(t[0], t[1], t[2])).join('') + '</div>';
H.pill = (t, c) => '<span class="pill ' + (c || '') + '">' + t + '</span>';
H.card = (title, body, cls) => '<div class="card ' + (cls || '') + '">' + (title ? '<h3>' + title + '</h3>' : '') + body + '</div>';
H.kv = rows => '<div class="kv">' + rows.map(r => '<span>' + r[0] + '</span><b class="' + (r[2] || '') + '">' + r[1] + '</b>').join('') + '</div>';
H.btn = (label, act, data, o) => {
  o = o || {}; let at = '';
  for (const k in (data || {})) at += ' data-' + k + '="' + esc(data[k]) + '"';
  return '<button class="btn ' + (o.cls || '') + '" data-act="' + act + '"' + at + (o.off ? ' aria-disabled="true" data-why="' + esc(o.why || '') + '"' : '') + '>' + label + '</button>';
};
H.seg = (act, key, cur, labels) => '<div class="seg">' + labels.map((l, i) => '<button data-act="' + act + '" data-k="' + key + '" data-v="' + i + '" aria-pressed="' + (i === cur) + '">' + l + '</button>').join('') + '</div>';
H.chips = (act, key, cur, opts) => '<div class="chips">' + opts.map(o => '<button class="chip" data-act="' + act + '" data-k="' + key + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (o[0] === cur) + '">' + o[1] + '</button>').join('') + '</div>';
H.text = (k, o) => { o = o || {}; const v = UI.txt && UI.txt[k] != null ? UI.txt[k] : (o.def || ''); return '<input class="txt" type="text" data-txt="' + k + '" maxlength="' + (o.max || 24) + '" placeholder="' + esc(o.ph || '') + '" value="' + esc(v) + '" aria-label="' + esc(o.lbl || o.ph || 'Texte') + '" autocomplete="off" autocapitalize="words">'; };
H.filter = (label, key, cur, opts) => '<div class="fl"><small>' + label + '</small><div class="chips scroll">' + opts.map(o => '<button class="chip" data-act="set" data-k="' + key + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (String(o[0]) === String(cur == null ? '' : cur)) + '">' + o[1] + '</button>').join('') + '</div></div>';
H.ico = TE.ico;
H.img = (name, cls) => { const u = TE.art(name); return u ? '<img class="art ' + (/^body-[a-z]+-\d/.test(name) ? 'look ' : '') + (cls || '') + '" src="' + u + '" alt="" loading="lazy" decoding="async">' : ''; };
H.metric = (l, v, c) => '<span class="mt"><small>' + l + '</small><b class="' + (c || '') + '">' + v + '</b></span>';
/* Bento : carte-résumé qui se déploie au toucher. o = { title, img, metrics:[[label, valeur, classe]], body, cls } */
H.fold = (id, o) => { const open = false, im = o.img ? H.img(o.img) : ''; (UI.foldReg || (UI.foldReg = {}))[id] = o;
  let t = o.title, pills = ''; const ip = t.indexOf('<span class="pill'); if (ip > 0) { pills = '<span class="fp">' + t.slice(ip) + '</span>'; t = t.slice(0, ip); }
  return '<div class="fold' + (open ? ' open' : '') + (o.cls ? ' ' + o.cls : '') + (im ? '' : ' noimg') + '"><button class="foldh" data-act="fold" data-k="' + esc(id) + '" aria-haspopup="dialog">' + (im ? '<span class="fimg">' + im + '</span>' : '') + '<span class="fn">' + t + pills + '</span><i class="chev"></i>' +
    (o.metrics && o.metrics.length ? '<span class="fm">' + o.metrics.map(m => H.metric(m[0], m[1], m[2])).join('') + '</span>' : '') + '</button></div>'; };
H.bento = html => '<div class="bento">' + html + '</div>';
H.bar = (v, max, c) => '<div class="bar"><i class="' + (c || '') + '" style="width:' + clamp(max ? v / max * 100 : 0, 0, 100) + '%"></i></div>';
H.table = (cols, rows) => '<div class="tbl"><table><thead><tr>' + cols.map(c => '<th class="' + (c.cls || '') + '">' + c.h + '</th>').join('') + '</tr></thead><tbody>' +
  rows.map(r => '<tr' + (r._cls ? ' class="' + r._cls + '"' : '') + '>' + cols.map(c => '<td class="' + (c.cls || '') + '">' + c.get(r) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';

/* Courbe minuscule */
H.spark = function (vals, o) {
  o = o || {}; const h = o.h || 46, W = 300, color = o.color || 'var(--accent)';
  if (vals.length < 2) return '<p class="muted" style="font-size:12px">Pas encore assez de données.</p>';
  const mn = Math.min(...vals, o.zero ? 0 : Infinity), mx = Math.max(...vals, o.zero ? 0 : -Infinity), rg = mx - mn || 1;
  const pts = vals.map((v, i) => (i / (vals.length - 1) * W).toFixed(1) + ',' + (h - 3 - (v - mn) / rg * (h - 6)).toFixed(1)).join(' ');
  return '<svg class="spark" viewBox="0 0 ' + W + ' ' + h + '" preserveAspectRatio="none" role="img"><polyline fill="none" stroke="' + color + '" stroke-width="2" points="' + pts + '"/></svg>';
};
/* Courbes multiples : series=[{name,color,vals}] */
H.lineChart = function (series, o) {
  o = o || {}; const W = 320, Hh = o.h || 130, pl = 42, pr = 8, pt = 8, pb = 18, n = Math.max(...series.map(s => s.vals.length));
  if (n < 2) return '<p class="muted" style="font-size:12px">Pas encore assez de données.</p>';
  const all = [].concat(...series.map(s => s.vals)), mn = Math.min(...all, 0), mx = Math.max(...all, 1), rg = mx - mn || 1;
  const X = i => pl + i / (n - 1) * (W - pl - pr), Y = v => pt + (1 - (v - mn) / rg) * (Hh - pt - pb), f = o.fmt || (v => nf(v));
  let g = '';
  for (let k = 0; k <= 3; k++) { const v = mn + rg * k / 3, y = Y(v); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/><text x="' + (pl - 4) + '" y="' + (y + 3) + '" text-anchor="end" font-size="10.5" fill="var(--muted)">' + f(v) + '</text>'; }
  const lines = series.map(s => '<polyline fill="none" stroke="' + s.color + '" stroke-width="2" points="' + s.vals.map((v, i) => X(i + n - s.vals.length).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ') + '"/>').join('');
  const leg = series.length > 1 ? '<div class="legend">' + series.map(s => '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '';
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + Hh + '" role="img">' + g + lines + '</svg>' + leg;
};
/* Graphique multi-séries lisible sur téléphone : axes datés, légende en valeurs, lecture au toucher.
   S = [{n, c, v:[…], me?}] ; o = {l:[années par point], fmt, h, zero, stack} */
const DASH = ['', '7 3', '2 3', '9 3 2 3', '4 2'];
H.multiLine = function (S, o) {
  o = o || {}; S = S.filter(s => s.v && s.v.length); const n = Math.max.apply(null, S.map(s => s.v.length).concat([0]));
  if (n < 2) return '<p class="muted" style="font-size:13px">Pas encore assez de données : reviens dans quelques mois.</p>';
  const W = 360, Hh = o.h || 190, pl = 48, pr = 12, pt = 12, pb = 26, f = o.fmt || (v => nf(v)), L = o.l || [];
  const vs = [].concat.apply([], S.map(s => s.v)).filter(v => v != null), mx0 = Math.max.apply(null, vs.concat([1e-9])), mn = o.zero === false ? Math.min.apply(null, vs) : 0, mx = mx0 * 1.06, rg = (mx - mn) || 1;
  const X = i => pl + i / (n - 1) * (W - pl - pr), Y = v => pt + (1 - (v - mn) / rg) * (Hh - pt - pb), gx = (s, i) => i + n - s.v.length;
  let g = '';
  for (let k = 0; k <= 3; k++) { const v = mn + rg * k / 3, y = Y(v); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="var(--line)" stroke-width="1"/><text x="' + (pl - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="var(--muted)">' + esc(f(v)) + '</text>'; }
  if (L.length) { const idx = []; let last = null; L.forEach((y, i) => { if (y !== last) { idx.push(i); last = y; } }); const st = Math.max(1, Math.ceil(idx.length / 5)); idx.forEach((i, k) => { if (k % st === 0 && X(i) < W - pr - 8) g += '<line x1="' + X(i).toFixed(1) + '" x2="' + X(i).toFixed(1) + '" y1="' + (Hh - pb) + '" y2="' + (Hh - pb + 4) + '" stroke="var(--line2)"/><text x="' + X(i).toFixed(1) + '" y="' + (Hh - 7) + '" text-anchor="middle" font-size="10.5" fill="var(--muted)">' + L[i] + '</text>'; }); }
  const col = s => s.me ? 'var(--ink)' : s.c;
  const ord = S.slice().sort((a, b) => (a.me ? 1 : 0) - (b.me ? 1 : 0));
  const lines = ord.map(s => { const i0 = S.indexOf(s); return '<polyline fill="none" stroke="' + col(s) + '" stroke-width="' + (s.me ? 3.2 : 2) + '" stroke-linejoin="round" stroke-linecap="round"' + (DASH[i0 % DASH.length] && !s.me ? ' stroke-dasharray="' + DASH[i0 % DASH.length] + '"' : '') + ' points="' + s.v.map((v, i) => X(gx(s, i)).toFixed(1) + ',' + Y(v || 0).toFixed(1)).join(' ') + '"/><circle cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(s.v[s.v.length - 1] || 0).toFixed(1) + '" r="' + (s.me ? 4 : 3) + '" fill="' + col(s) + '"/>'; }).join('');
  const data = { l: L, f: S.map(s => ({ n: s.n, c: s.me ? 'currentColor' : s.c, v: s.v.map(v => v == null ? null : f(v)), a: gx(s, 0) })) };
  const leg = '<div class="mll">' + S.map((s, i) => '<span class="mli' + (s.me ? ' me' : '') + '"><svg width="22" height="10" aria-hidden="true"><line x1="1" x2="21" y1="5" y2="5" stroke="' + col(s) + '" stroke-width="' + (s.me ? 3.2 : 2) + '"' + (DASH[i % DASH.length] && !s.me ? ' stroke-dasharray="' + DASH[i % DASH.length] + '"' : '') + ' stroke-linecap="round"/></svg><b>' + esc(s.n) + '</b><em>' + esc(f(s.v[s.v.length - 1] || 0)) + '</em></span>').join('') + '</div>';
  return '<div class="mlc" data-ml="' + esc(JSON.stringify(data)) + '" data-pl="' + pl + '" data-pr="' + pr + '" data-w="' + W + '"><div class="mlr" aria-live="polite">Touche le graphique pour lire les valeurs.</div><svg class="chart" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="' + esc(o.label || 'Graphique d\'évolution') + '">' + g + lines + '<line class="mlx" x1="0" x2="0" y1="' + pt + '" y2="' + (Hh - pb) + '" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 3" visibility="hidden"/><rect class="mlh" x="' + pl + '" y="' + pt + '" width="' + (W - pl - pr) + '" height="' + (Hh - pt - pb) + '" fill="transparent"/></svg>' + leg + '</div>';
};
/* Aires empilées à 100 % (mix énergétique, parts de marché) */
H.areaShare = function (S, o) {
  o = o || {}; const n = Math.max.apply(null, S.map(s => s.v.length).concat([0])); if (n < 2) return '<p class="muted" style="font-size:13px">Pas encore assez de données.</p>';
  const W = 360, Hh = o.h || 170, pl = 40, pr = 12, pt = 8, pb = 26, L = o.l || [], X = i => pl + i / (n - 1) * (W - pl - pr), Y = v => pt + (1 - v) * (Hh - pt - pb);
  const tot = Array.from({ length: n }, (_, i) => S.reduce((t, s) => t + (s.v[i] || 0), 0) || 1); let cum = new Array(n).fill(0), g = '';
  for (let k = 0; k <= 4; k++) { const v = k / 4; g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--line)"/><text x="' + (pl - 6) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="var(--muted)">' + Math.round(v * 100) + ' %</text>'; }
  const areas = S.map(s => { const lo = cum.slice(), hi = lo.map((c, i) => c + (s.v[i] || 0) / tot[i]); cum = hi; return '<path d="M' + hi.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' L') + ' L' + lo.map((v, i) => X(n - 1 - i).toFixed(1) + ',' + Y(lo[n - 1 - i]).toFixed(1)).join(' L') + ' Z" fill="' + s.c + '" fill-opacity=".88" stroke="var(--card)" stroke-width=".6"/>'; }).join('');
  if (L.length) { const idx = []; let last = null; L.forEach((y, i) => { if (y !== last) { idx.push(i); last = y; } }); const st = Math.max(1, Math.ceil(idx.length / 5)); idx.forEach((i, k) => { if (k % st === 0 && X(i) < W - pr - 8) g += '<text x="' + X(i).toFixed(1) + '" y="' + (Hh - 7) + '" text-anchor="middle" font-size="10.5" fill="var(--muted)">' + L[i] + '</text>'; }); }
  const last = S.map(s => ({ n: s.n, c: s.c, p: (s.v[n - 1] || 0) / tot[n - 1] })).filter(x => x.p > 0.004);
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="' + esc(o.label || 'Répartition dans le temps') + '">' + g + areas + '</svg><div class="mll">' + last.map(x => '<span class="mli"><i style="background:' + x.c + '"></i><b>' + esc(x.n) + '</b><em>' + Math.round(x.p * 100) + ' %</em></span>').join('') + '</div>';
};
const MLC = {};
function mlRead(svg, clientX) {
  const box = svg.closest('.mlc'), r = svg.getBoundingClientRect(); if (!box || !r.width) return;
  const D = MLC[box.dataset.ml] || (MLC[box.dataset.ml] = JSON.parse(box.dataset.ml)), W = +box.dataset.w, pl = +box.dataset.pl, pr = +box.dataset.pr, n = Math.max.apply(null, D.f.map(s => s.a + s.v.length));
  const x = (clientX - r.left) / r.width * W, i = clamp(Math.round((x - pl) / (W - pl - pr) * (n - 1)), 0, n - 1), px = pl + i / (n - 1) * (W - pl - pr), ln = svg.querySelector('.mlx');
  ln.setAttribute('x1', px); ln.setAttribute('x2', px); ln.setAttribute('visibility', 'visible');
  box.querySelector('.mlr').innerHTML = '<b>' + esc(D.l[i] != null ? D.l[i] : '') + '</b> · ' + D.f.map(s => { const v = s.v[i - s.a]; return v == null ? '' : '<span style="color:' + s.c + '">●</span> ' + esc(s.n) + ' <b>' + esc(v) + '</b>'; }).filter(Boolean).join(' &nbsp; ');
}
document.addEventListener('pointerdown', e => { const h = e.target.closest && e.target.closest('.mlh'); if (h) mlRead(h.ownerSVGElement, e.clientX); });
document.addEventListener('pointermove', e => { const h = e.target.closest && e.target.closest('.mlh'); if (h && (e.buttons || e.pointerType === 'mouse')) mlRead(h.ownerSVGElement, e.clientX); });

H.barChart = function (vals, o) {
  o = o || {}; const W = 320, Hh = o.h || 110, pl = 42, pb = 16, pt = 6, n = vals.length; if (!n) return '';
  const mx = Math.max(...vals, 1), mn = Math.min(...vals, 0), rg = mx - mn || 1, bw = (W - pl - 6) / n, Y = v => pt + (1 - (v - mn) / rg) * (Hh - pt - pb), f = o.fmt || (v => nf(v));
  let s = '<line x1="' + pl + '" x2="' + (W - 6) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="var(--line)"/><text x="' + (pl - 4) + '" y="' + (Y(mx) + 3) + '" text-anchor="end" font-size="10.5" fill="var(--muted)">' + f(mx) + '</text>';
  vals.forEach((v, i) => { const y0 = Y(0), y1 = Y(v); s += '<rect x="' + (pl + i * bw + 1).toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + Math.max(1, Math.abs(y1 - y0)).toFixed(1) + '" fill="' + (v < 0 ? 'var(--bad)' : (o.color || 'var(--accent)')) + '" rx="1.5"><title>' + (o.labels ? o.labels[i] + ' : ' : '') + f(v) + '</title></rect>'; });
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + Hh + '" role="img">' + s + '</svg>';
};
/* Jauge demi-cercle 0-100 */
H.gauge = function (v, label) {
  v = clamp(v, 0, 100); const a = -180 + 180 * v / 100, r = 46, cx = 60, cy = 56, P = t => [cx + r * Math.cos(t * Math.PI / 180), cy + r * Math.sin(t * Math.PI / 180)];
  const p0 = P(-180), p1 = P(a), big = (a + 180) > 180 ? 1 : 0, col = v < 35 ? 'var(--bad)' : v < 60 ? 'var(--warn)' : 'var(--good)';
  return '<div class="gauge"><svg viewBox="0 0 120 66"><path d="M ' + (cx - r) + ' ' + cy + ' A ' + r + ' ' + r + ' 0 0 1 ' + (cx + r) + ' ' + cy + '" fill="none" stroke="var(--line)" stroke-width="9" stroke-linecap="round"/>' +
    (v > 0.5 ? '<path d="M ' + p0[0] + ' ' + p0[1] + ' A ' + r + ' ' + r + ' 0 ' + big + ' 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="9" stroke-linecap="round"/>' : '') +
    '<text x="60" y="54" text-anchor="middle" font-size="18" font-weight="700" fill="var(--ink)">' + Math.round(v) + '</text></svg><small>' + (label || '') + '</small></div>';
};

/* Curseur de montant : − / + pour ajuster ; le bouton affiche le libellé calculé en direct.
   o = {k, min, max, step, def, fmt:(v)=>html, act:'borrow', cls, lbl} */
const AMTM = {};
H.amt = function (o) {
  const k = o.k; AMTM[k] = o; const mx = Math.max(o.min, o.max); let v = UI.amt[k];
  if (v == null || isNaN(v)) v = o.def; v = clamp(v, o.min, mx); UI.amt[k] = v; const off = o.max <= o.min + 1e-12;
  return '<div class="amt"><div class="row"><button class="btn small sq" data-act="amtstep" data-k="' + k + '" data-v="-1" aria-label="Moins">−</button>' +
    '<input type="range" data-amt="' + k + '" min="' + o.min + '" max="' + mx + '" step="' + o.step + '" value="' + v + '"' + (off ? ' disabled' : '') + ' aria-label="' + esc(o.lbl || 'Montant') + '">' +
    '<button class="btn small sq" data-act="amtstep" data-k="' + k + '" data-v="1" aria-label="Plus">+</button></div>' +
    (o.act ? '<button class="btn small ' + (o.cls || '') + '" data-act="' + o.act + '" data-k="' + k + '"' + (o.attrs || '') + (off && o.why ? ' aria-disabled="true" data-why="' + esc(o.why) + '"' : '') + '><span data-amtl="' + k + '">' + o.fmt(v) + '</span></button>'
      : '<div class="amtv" data-amtl="' + k + '">' + o.fmt(v) + '</div>') + '</div>';
};
function amtRefresh(k) {
  const o = AMTM[k], v = UI.amt[k];
  document.querySelectorAll('[data-amtl="' + k + '"]').forEach(x => { x.innerHTML = o ? o.fmt(v) : v; });
  document.querySelectorAll('[data-amt="' + k + '"]').forEach(x => { if (+x.value !== v) x.value = v; });
}
TE.amtVal = (k, d) => (UI.amt[k] == null ? d : UI.amt[k]);

/* =============================== Rendu incrémental =============================== */
function morph(el, html) { const t = document.createElement('div'); t.innerHTML = html; morphKids(el, t); }
function morphKids(a, b) {
  const A = a.childNodes, B = b.childNodes;
  for (let i = 0; i < B.length; i++) {
    const nb = B[i], na = A[i];
    if (!na) { a.appendChild(nb.cloneNode(true)); continue; }
    if (na.nodeType !== nb.nodeType || na.nodeName !== nb.nodeName) { a.replaceChild(nb.cloneNode(true), na); continue; }
    if (na.nodeType !== 1) { if (na.nodeValue !== nb.nodeValue) na.nodeValue = nb.nodeValue; continue; }
    morphNode(na, nb);
  }
  while (A.length > B.length) a.removeChild(a.lastChild);
}
function morphNode(a, b) {
  const tag = a.tagName;
  for (const at of Array.from(a.attributes)) if (!b.hasAttribute(at.name) && !(tag === 'DETAILS' && at.name === 'open')) a.removeAttribute(at.name);
  for (const at of Array.from(b.attributes)) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  if (tag === 'INPUT' || tag === 'TEXTAREA') { if (document.activeElement !== a) { const v = b.getAttribute('value'); if (v != null && a.value !== v) a.value = v; } return; }
  if (tag === 'SELECT') { morphKids(a, b); const o = b.querySelector('option[selected]'); if (o && document.activeElement !== a) a.value = o.value; return; }
  morphKids(a, b);
}
TE.morph = morph;

/* =============================== Panneaux intégrés =============================== */
const P = TE.panels = {};

/* Compte de résultat du dernier mois + emprunts + notation */
P.finance = function () {
  const G = TE.G, p = TE.player(), m = p.last || p.m, def = TE.def, lab = def.ledger || {};
  const rev = TE.revenue(m), cost = TE.costs(m), pr = rev - cost, lim = TE.creditLimit(p), rt = TE.rating(p), rate = TE.loanRate(p);
  const L = (cat, side) => (lab[side] && lab[side][cat]) || cat;
  const rows = [];
  for (const c in m.in) rows.push([L(c, 'in'), TE.signed(m.in[c]), 'pos']);
  for (const c in m.out) rows.push([L(c, 'out'), '-' + money(m.out[c]), '']);
  const room = Math.max(0, Math.floor((lim - p.debt) / 1e5) * 1e5), maxRep = Math.min(p.debt, Math.max(0, p.cash));
  return '<h2>Finances</h2>' +
    H.tiles([['Trésorerie', money(p.cash), p.cash < 0 ? 'neg' : ''], ['Résultat du mois', TE.signed(pr), TE.cls(pr)], ['Dette', money(p.debt)], ['Notation', TE.RATINGS[rt] + ' · ' + TE.pct(rate, 1)]]) +
    H.card('Compte de résultat (' + (p.last ? 'dernier mois' : 'mois en cours') + ')', rows.length ? H.kv(rows.concat([['<b>Résultat</b>', TE.signed(pr), TE.cls(pr)]])) : '<p class="muted">Aucun mouvement pour l\'instant.</p>') +
    (p.hist.length >= 2 ? H.card('Évolution', '<div class="muted" style="font-size:12px">Résultat mensuel</div>' + H.barChart(p.hist.slice(-18), { fmt: v => money(v) }) + '<div class="muted" style="font-size:12px;margin-top:8px">Trésorerie</div>' + H.spark(p.cashH.slice(-36), { zero: true })) : '') +
    H.card('Emprunt', '<p class="muted" style="font-size:12px">Plafond de crédit : <b>' + money(lim) + '</b>. Taux actuel ' + TE.pct(rate, 1) + ' (notation ' + TE.RATINGS[rt] + ').</p>' +
      (room >= 1e5 ? H.amt({ k: 'borrow', min: 1e5, max: room, step: 1e5, def: Math.min(room, 2e6), act: 'borrow', cls: 'primary', fmt: v => 'Emprunter ' + money(v), lbl: 'Montant à emprunter' }) : '<p class="muted">Plafond atteint.</p>') +
      (p.debt > 0 ? H.amt({ k: 'repay', min: Math.min(1e5, maxRep || 1e5), max: Math.max(maxRep, 0), step: 1e5, def: maxRep, act: 'repay', fmt: v => 'Rembourser ' + money(v), lbl: 'Montant à rembourser', why: 'Trésorerie insuffisante' }) : ''));
};

/* Classement des acteurs : def.rankingCols = [{h, get:(a)=>html, cls}] ; tri par def.rankingSort(a) */
P.ranking = function () {
  const G = TE.G, def = TE.def, sorter = def.rankingSort || (a => TE.companyValue(a));
  const list = G.actors.slice().sort((a, b) => (a.bankrupt - b.bankrupt) || (sorter(b) - sorter(a)));
  const cols = [{ h: '#', get: a => (list.indexOf(a) + 1), cls: 'num' },
    { h: 'Nom', get: a => '<i class="dot" style="background:' + a.color + '"></i>' + esc(a.name) + (a.player ? ' <small class="muted">(toi)</small>' : '') + (a.bankrupt ? ' <small class="neg">faillite</small>' : '') }]
    .concat(def.rankingCols || [{ h: 'Trésorerie', cls: 'num', get: a => money(a.cash) }, { h: 'Valeur', cls: 'num', get: a => money(TE.companyValue(a)) }]);
  const rows = list.map(a => Object.assign({ _cls: a.player ? 'me' : a.bankrupt ? 'dead' : '' }, a, { _a: a }));
  return '<h2>' + (def.rankingTitle || 'Classement') + '</h2>' + H.table(cols.map(c => ({ h: c.h, cls: c.cls, get: r => c.get(r._a || r) })), rows) +
    H.card('Trésorerie comparée', H.lineChart(TE.alive().map(a => ({ name: a.name, color: a.color, vals: a.cashH.slice(-24) })), { fmt: v => money(v) }));
};

P.news = function () {
  const G = TE.G;
  return '<h2>Actualités</h2><div class="news">' + (G.news.length ? G.news.map(n => '<div class="nw ' + n.kind + '"><small>' + TE.shortDate(n.day) + '</small><span>' + esc(n.text) + '</span></div>').join('') : '<p class="muted">Rien à signaler.</p>') + '</div>';
};
P.goal = function () {
  const gi = TE.goalInfo(); if (!gi) return '';
  return H.card('Objectif : ' + esc(gi.label), H.bar(gi.cur, gi.tgt, gi.met ? 'good' : '') + '<div class="row"><span class="grow muted">' + gi.fmt(gi.cur) + ' / ' + gi.fmt(gi.tgt) + '</span>' + (gi.met ? H.pill('Atteint', 'good') : '') + '</div>');
};

/* =============================== Coque =============================== */
TE.navOf = def => def.nav || (def.tabs || []).map(t => ({ id: t.id, label: t.label, icon: t.icon, tabs: [t.id] }));
function shellHTML(def) {
  const tabs = def.tabs || [], nav = TE.navOf(def), tb = id => tabs.find(t => t.id === id) || { id, label: id };
  return '<div id="app"><header id="board"><div class="brand"><span id="brandic">' + (ic(def.icon) || '◆') + '</span><span id="coname">' + esc(def.title || 'Tycoon') + '</span></div>' +
    '<div class="speed" role="group" aria-label="Vitesse du temps">' +
    ['❚❚', '▶', '▶▶', '▶▶▶'].map((l, i) => '<button data-act="speed" data-v="' + i + '" aria-label="Vitesse ' + i + '">' + l + '</button>').join('') + '</div>' +
    '<div id="flaps"></div><div class="hbtns"><button class="hsearch" data-act="pal" aria-label="Aller à un écran" title="Aller à… ( / )"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4 4"/></svg><span>Aller à…</span><kbd>/</kbd></button><button class="hsave" data-act="saves" aria-label="Sauvegardes" title="Sauvegardes">' + TE.ico('sauvegarde') + '</button></div></header>' +
    '<nav id="subnav" aria-label="Rubriques" hidden></nav>' +
    '<main' + (def.map ? ' class="hasmap"' : '') + '>' + (def.map ? '<section id="mapwrap"><canvas id="map"></canvas></section>' : '') + '<section id="panel"></section></main>' +
    '<div id="fab" hidden></div>' +
    '<nav id="tabs" class="' + (nav.length > 6 ? 'many' : '') + '" aria-label="Navigation"><div class="sidebrand"><small>' + esc(def.subtitle || '') + '</small><b id="sbname"></b></div>' +
    nav.map(h => '<div class="hub ' + (h.tabs.length > 1 ? 'multi' : 'single') + '" data-hub="' + h.id + '"><button class="hubbtn" data-act="hub" data-v="' + h.id + '"><span class="ti">' + (ic(h.icon) || '•') + '</span><span class="tl">' + esc(h.label) + '</span><i class="bdg" hidden></i></button><div class="subs">' +
      h.tabs.map(id => { const t = tb(id); return '<button data-act="tab" data-v="' + id + '"><span class="ti">' + (ic(t.icon) || '•') + '</span>' + esc(t.label) + '<i class="bdg" hidden></i></button>'; }).join('') + '</div></div>').join('') + '</nav></div>' +
    '<div id="pal" hidden></div><button id="cheatfab" data-act="cheats" aria-label="Menu test" hidden>' + TE.ico('reglages') + '</button><div id="modal" hidden><div class="sheet" id="sheet" role="dialog" aria-modal="true"></div></div><div id="start" hidden></div><div id="toast" role="status" aria-live="polite" hidden></div>';
}

TE.toast = function (t) {
  const el = $('toast'); el.textContent = t; el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(TE.toast._t); TE.toast._t = setTimeout(() => { el.hidden = true; }, 3200);
};

function header() {
  const G = TE.G, def = TE.def, p = TE.player(); if (!G) return;
  $('coname').textContent = p.name; $('sbname').textContent = p.name;
  const kp = def.kpis || [
    { label: 'Date', get: () => TE.dateStr(G.day) },
    { label: 'Trésorerie', get: p => money(p.cash), cls: p => (p.cash < 0 ? 'neg' : '') },
    { label: 'Dernier mois', get: p => (p.last ? TE.signed(p.last.profit) : '--'), cls: p => (p.last && p.last.profit < 0 ? 'neg' : '') }];
  const html = kp.map(k => '<div class="flap"><small>' + k.label + '</small><b class="' + (k.cls ? k.cls(p) : '') + '">' + k.get(p, G) + '</b></div>').join('');
  if ($('flaps')._h !== html) { $('flaps').innerHTML = html; $('flaps')._h = html; }
  document.querySelectorAll('.speed button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === UI.speed)));
  const nav = TE.navOf(def), tabs = def.tabs, hub = nav.find(h => h.tabs.includes(UI.tab)) || nav[0], bd = def.badges ? (def.badges(G, p) || {}) : {};
  const setB = (el, b) => { if (!el) return; if (!b || !b.n) { el.hidden = true; return; } el.hidden = false; el.textContent = b.n > 9 ? '9+' : b.n; el.className = 'bdg ' + (b.cls || ''); };
  const agg = h => { let n = 0, cls = 'info'; for (const id of h.tabs) { const b = bd[id]; if (b && b.n) { n += b.n; if (b.cls === 'bad' || (b.cls === 'warn' && cls !== 'bad')) cls = b.cls; } } return { n, cls: cls === 'info' ? '' : cls }; };
  document.querySelectorAll('#tabs .hub').forEach(el => { const h = nav.find(x => x.id === el.dataset.hub); el.classList.toggle('on', h === hub); const hb = el.querySelector('.hubbtn'); hb.setAttribute('aria-pressed', String(h === hub)); setB(hb.querySelector('.bdg'), agg(h)); });
  document.querySelectorAll('#tabs .subs button').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.v === UI.tab)); setB(b.querySelector('.bdg'), bd[b.dataset.v]); });
  const sn = $('subnav');
  if (hub && hub.tabs.length > 1) {
    const html = hub.tabs.map(id => { const t = tabs.find(x => x.id === id) || {}, b = bd[id]; return '<button data-act="tab" data-v="' + id + '" aria-pressed="' + (id === UI.tab) + '">' + ic(t.icon) + ' ' + esc(t.label || id) + (b && b.n ? '<i class="bdg ' + (b.cls || '') + '">' + (b.n > 9 ? '9+' : b.n) + '</i>' : '') + '</button>'; }).join('');
    if (sn._h !== html) { sn.innerHTML = html; sn._h = html; } sn.hidden = false;
  } else sn.hidden = true;
  const cur = tabs.find(t => t.id === UI.tab), acts = cur && cur.fab ? cur.fab(G, p, UI) || [] : [], fb = $('fab');
  if (!acts.length) { fb.hidden = true; fb._h = ''; }
  else {
    const at = a => Object.keys(a.data || {}).map(k => ' data-' + k + '="' + esc(a.data[k]) + '"').join(''), one = acts.length === 1;
    const html = one ? '<button class="fabmain" data-act="' + acts[0].act + '"' + at(acts[0]) + '><span>＋</span>' + esc(acts[0].label) + '</button>'
      : (UI.fabOpen ? '<div class="fabscrim" data-act="fabtoggle"></div><div class="fablist">' + acts.map(a => '<button data-act="' + a.act + '"' + at(a) + '>' + (a.icon ? '<span>' + ic(a.icon) + '</span>' : '') + esc(a.label) + '</button>').join('') + '</div>' : '') + '<button class="fabmain round" data-act="fabtoggle" aria-label="Actions" aria-expanded="' + !!UI.fabOpen + '">' + (UI.fabOpen ? '✕' : '＋') + '</button>';
    if (fb._h !== html) { fb.innerHTML = html; fb._h = html; } fb.hidden = false;
  }
  document.body.dataset.tab = UI.tab;
  $('cheatfab').hidden = !(UI.cheats && TE.G);
  if (UI._tabSeen !== UI.tab) { UI._tabSeen = UI.tab; const on = document.querySelector('#subnav button[aria-pressed="true"]'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' }); }
}

function tabHTML(t) {
  if (typeof t.render === 'string') return (P[t.render.replace('@', '')] || (() => ''))();
  return t.render(TE.G, TE.player(), UI);
}
function renderAll(force) {
  const G = TE.G; if (!G) return;
  const now = performance.now(), P_ = $('panel');
  if (!force && (UI.holding || now - UI.lastRender < 450 || (document.activeElement && document.activeElement.dataset && (document.activeElement.dataset.amt != null || document.activeElement.dataset.txt != null) && P_.contains(document.activeElement)))) { UI.dirty = true; return; }
  UI.lastRender = now; UI.dirty = false; header();
  { const hub = TE.navOf(TE.def).find(h => h.tabs.includes(UI.tab)), bk = hub ? hub.id : ''; if (UI.banK !== bk) { UI.banK = bk; const u = bk && TE.art('ban-' + bk); if (u) { P_.dataset.ban = '1'; P_.style.setProperty('--ban', 'url(' + u + ')'); } else { delete P_.dataset.ban; P_.style.removeProperty('--ban'); } } }
  const tab = TE.def.tabs.find(t => t.id === UI.tab) || TE.def.tabs[0], key = tab.id + ':' + (UI.sub[tab.id] || '');
  const html = '<div class="flow">' + tabHTML(tab) + '</div>';
  if (UI.pkey !== key) {
    if (UI.pkey) UI.scr[UI.pkey] = P_.scrollTop;
    P_.innerHTML = html; P_.scrollTop = UI.scr[key] || 0; P_.classList.remove('fadein'); void P_.offsetWidth; P_.classList.add('fadein'); UI.pkey = key;
  } else morph(P_, html);
  if (TE.def.map && TE.def.map.onRender) TE.def.map.onRender(G, UI);
}
TE.renderAll = renderAll;

/* =============================== Fenêtres =============================== */
function openModal(kind, data) {
  UI.modal = Object.assign({ kind, resume: UI.modal ? UI.modal.resume : UI.speed }, data || {});
  UI.speed = 0; renderModal(); $('modal').hidden = false; $('sheet').scrollTop = 0; if (TE.G) header();
}
function closeModal() {
  const m = UI.modal; UI.modal = null; $('modal').hidden = true;
  if (!TE.G || !$('start').hidden) { if (!$('start').hidden) showStart(); return; }
  if (m && m.resume && !TE.G.over) UI.speed = m.resume;
  renderAll(true);
}
TE.openModal = openModal; TE.closeModal = closeModal;

function foldSheet(M) {
  const o = UI.foldReg && UI.foldReg[M.id]; if (!o) return '<h2>Élément introuvable</h2><p class="muted">Il n\'existe plus.</p>';
  let t = o.title, pills = ''; const ip = t.indexOf('<span class="pill'); if (ip > 0) { pills = '<div class="fp">' + t.slice(ip) + '</div>'; t = t.slice(0, ip); }
  const im = o.img ? H.img(o.img) : '';
  return '<div class="fsh">' + (im ? '<span class="fimg">' + im + '</span>' : '') + '<div class="fshh"><h2>' + t + '</h2>' + pills + '</div></div>' + (o.metrics && o.metrics.length ? '<div class="fm fsm">' + o.metrics.map(m => H.metric(m[0], m[1], m[2])).join('') + '</div>' : '') + '<div class="foldb sheetb">' + o.body + '</div>';
}
function renderModal() {
  const M = UI.modal, S = $('sheet'), def = TE.def; let h = '';
  const close = '<button class="btn small xbtn" data-act="close" aria-label="Fermer">✕</button>';
  if (M.kind === 'saves') h = savesHTML();
  else if (M.kind === 'end') h = endHTML(M);
  else if (M.kind === 'cheats') h = cheatsHTML();
  else if (M.kind === 'fold') h = foldSheet(M);
  else if (def.modals && def.modals[M.kind]) h = def.modals[M.kind](M, TE.G, TE.player());
  S.dataset.kind = M.kind;
  S.innerHTML = (M.kind === 'end' ? '' : close) + h;
}
function reAll() { renderAll(true); if (UI.modal && !$('modal').hidden) { const st = $('sheet').scrollTop; renderModal(); $('sheet').scrollTop = st; } }
TE.reAll = reAll;


/* --- Menu triche (tests) : déverrouillé par 5 appuis rapides sur la marque, ou #cheat dans l'URL --- */
function cheatsHTML() {
  const G = TE.G, def = TE.def, p = TE.player(), b = (l, d) => '<button class="btn small" data-act="cheat"' + d + '>' + l + '</button>';
  const sec = (t, body) => '<div class="card"><h3>' + t + '</h3><div class="row">' + body + '</div></div>';
  const gc = def.cheats || [], groups = []; gc.forEach((c, i) => { let g = groups.find(x => x.n === (c.group || 'Jeu')); if (!g) groups.push(g = { n: c.group || 'Jeu', h: '' }); g.h += b(esc(c.label), ' data-k="game" data-i="' + i + '"'); });
  const ev = (def.events && def.events.random) || [];
  return '<h2>Menu test</h2><p class="muted" style="font-size:12px">Outils de test : ils modifient la partie en cours. Jour ' + G.day + ' · graine ' + G.seed + '.</p>' +
    sec('Argent', [1e6, 1e7, 1e8, 1e9, 1e10].map(n => b('+' + money(n), ' data-k="cash" data-n="' + n + '"')).join('') + b('−' + money(1e8), ' data-k="cash" data-n="-100000000"') + b('Effacer la dette', ' data-k="debt"')) +
    sec('Temps', [[30, '+1 mois'], [90, '+3 mois'], [360, '+1 an'], [1800, '+5 ans']].map(x => b(x[1], ' data-k="skip" data-n="' + x[0] + '"')).join('')) +
    sec('Partie', b((G.cfg.safe ? '✓ ' : '') + 'Faillite désactivée', ' data-k="safe"') + b('Déclencher la victoire', ' data-k="win"')) +
    sec('Concurrence', b('Nouvelle entrante', ' data-k="entrant"') + b('+' + money(1e9) + ' aux rivales', ' data-k="rcash"') + TE.rivals().map(a => b('✕ ' + esc(a.name), ' data-k="kill" data-id="' + a.id + '"')).join('')) +
    (ev.length ? sec('Événements', b('Événement aléatoire', ' data-k="rev"') + ev.map((e, i) => b(esc(e.name || ('#' + (i + 1))), ' data-k="event" data-i="' + i + '"')).join('')) : '') +
    groups.map(g => sec(esc(g.n), g.h)).join('');
}

/* --- Sauvegardes --- */
function savesHTML() {
  const G = TE.G, rows = TE.SLOTS.map(s => {
    const mt = TE.slotMeta(s), name = s === 'auto' ? 'Automatique' : 'Emplacement ' + s;
    return '<div class="slot"><div><b>' + name + '</b><div class="muted" style="font-size:12px">' + (mt ? esc(mt.name) + ' · ' + TE.dateStr(mt.day) + ' · ' + money(mt.cash) + (mt.over ? ' · terminée' : '') : 'vide') + '</div></div><div class="row">' +
      (G && s !== 'auto' ? '<button class="btn small" data-act="saveslot" data-v="' + s + '">Sauver</button>' : '') +
      (mt ? '<button class="btn small primary" data-act="loadslot" data-v="' + s + '">Charger</button><button class="btn small" data-act="delslot" data-v="' + s + '" aria-label="Supprimer">🗑</button>' : '') + '</div></div>';
  }).join('');
  return '<h2>Sauvegardes</h2>' + rows + '<div class="row" style="margin-top:12px">' + (G ? '<button class="btn" data-act="export">Exporter un fichier</button>' : '') + '<button class="btn" data-act="import">Importer un fichier</button></div>' +
    '<input type="file" id="fileIn" accept=".json,application/json" hidden>';
}
function endHTML(M) {
  const G = TE.G, p = TE.player(), def = TE.def;
  const body = def.endText ? def.endText(G, p, M.win) : (M.win ? 'Objectif atteint, bravo !' : 'La partie est terminée.');
  return '<div class="endwrap">' + H.img(M.win ? 'end-win' : 'end-lose') + '<h2>' + (M.win ? 'Victoire' : 'Fin de partie') + '</h2><p>' + body + '</p><div class="row">' +
    (M.win ? '<button class="btn primary" data-act="close">Continuer à jouer</button>' : '') + '<button class="btn ' + (M.win ? '' : 'primary') + '" data-act="menu">Nouvelle partie</button></div></div>';
}

/* =============================== Écran de départ =============================== */
function field(f) {
  const id = 'in_' + f.k;
  if (f.type === 'color') return '<label class="f" for="' + id + '" style="flex:0 0 auto"><span>' + f.label + '</span><input type="color" id="' + id + '" value="' + (f.def || '#b01f6a') + '"></label>';
  if (f.type === 'select') return '<label class="f" for="' + id + '"><span>' + f.label + '</span><select id="' + id + '">' + f.options.map(o => '<option value="' + esc(o[0]) + '"' + (o[0] === f.def ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>';
  if (f.type === 'range') return '<label class="f"><span>' + f.label + ' : <b id="v_' + f.k + '">' + (f.fmt ? f.fmt(f.def) : f.def) + '</b></span><input type="range" id="' + id + '" min="' + f.min + '" max="' + f.max + '" step="' + (f.step || 1) + '" value="' + f.def + '"></label>';
  if (f.type === 'checkbox') return '<label class="chk"><input type="checkbox" id="' + id + '"' + (f.def ? ' checked' : '') + '> ' + f.label + '</label>';
  return '<label class="f" for="' + id + '"><span>' + f.label + '</span><input type="text" id="' + id + '" maxlength="' + (f.max || 24) + '" value="' + esc(f.def || '') + '"></label>';
}
function startHTML() {
  const def = TE.def, S = def.setup || [], mt = TE.slotMeta('auto') || TE.slotMeta('auto.prev');
  const top = S.filter(f => !f.adv), adv = S.filter(f => f.adv);
  const pre = def.presets || [];
  const std = (pre.length ? '<label class="f" for="in_diff"><span>Difficulté</span><select id="in_diff">' + pre.map((x, i) => '<option value="' + i + '"' + (i === Math.min(1, pre.length - 1) ? ' selected' : '') + '>' + esc(x.label || ('Niveau ' + (i + 1))) + '</option>').join('') + '</select></label>' : '') +
    '<label class="f"><span>Rivales : <b id="v_rivals">' + Math.min(def.rivalDefault || 7, (def.rivals || []).length) + '</b></span><input type="range" id="in_rivals" min="0" max="' + (def.rivals || []).length + '" step="1" value="' + Math.min(def.rivalDefault || 7, (def.rivals || []).length) + '"></label>' +
    (def.goals ? '<label class="f" for="in_goal"><span>Objectif</span><select id="in_goal"><option value="none">Aucun : partie libre</option>' + Object.keys(def.goals).map(k => '<option value="' + k + '">' + esc(def.goals[k].label) + '</option>').join('') + '</select></label><label class="f" id="fGoalV" hidden><span id="lGoalV">Cible</span><input type="number" id="in_gv" min="1" step="any" value="10"></label>' : '') +
    '<label class="chk"><input type="checkbox" id="in_entr" checked> Nouvelles concurrentes quand une rivale disparaît</label>' +
    '<label class="chk"><input type="checkbox" id="in_safe"> Faillite désactivée (pour apprendre)</label>';
  return '<div class="title"><h1>' + (def.titleHTML || esc(def.title)) + '</h1><p class="lede">' + esc(def.lede || '') + '</p><div class="card">' +
    top.map(field).join('') + '<details class="setup"><summary>Réglages de la partie</summary><div class="sgrid">' + adv.map(field).join('') + std + '</div></details>' +
    '<div class="row"><button class="btn primary" data-act="newgame">' + esc(def.startLabel || 'Commencer') + '</button><button class="btn" data-act="continue"' + (mt ? '' : ' hidden') + '>Reprendre la partie</button><button class="btn" data-act="saves">Charger ou importer</button></div>' +
    '<div class="muted" style="font-size:12px;margin-top:6px">' + (mt ? 'Dernière sauvegarde : ' + esc(mt.name) + ', ' + TE.dateStr(mt.day) + ', ' + money(mt.cash) : '') + '</div></div></div>';
}
function showStart() {
  const S = $('start'); S.innerHTML = startHTML(); S.hidden = false; UI.speed = 0;
  { const hero = (typeof matchMedia === 'function' && matchMedia('(max-width:700px)').matches && TE.art('hero-portrait')) || TE.art('hero'); S.classList.toggle('hasart', !!hero); S.style.backgroundImage = hero ? 'linear-gradient(180deg,color-mix(in srgb,var(--bg) 8%,transparent),color-mix(in srgb,var(--bg) 82%,transparent) 70%),url(' + hero + ')' : ''; }
  const g = $('in_goal'), upd = () => {
    const def = TE.def; if (!g) return; const k = g.value, has = k !== 'none' && def.goals[k];
    $('fGoalV').hidden = !has; if (has) { $('lGoalV').textContent = 'Cible (' + (def.goals[k].unit || '') + ')'; $('in_gv').value = def.goals[k].def; }
  };
  if (g) { g.onchange = upd; upd(); }
  const rv = $('in_rivals'); if (rv) rv.oninput = () => { $('v_rivals').textContent = rv.value; };
  for (const f of TE.def.setup || []) if (f.type === 'range') { const el = $('in_' + f.k); if (el) el.oninput = () => { $('v_' + f.k).textContent = f.fmt ? f.fmt(+el.value) : el.value; }; }
}
function readSetup() {
  const def = TE.def, o = { opts: {}, cfg: {} };
  for (const f of def.setup || []) {
    const el = $('in_' + f.k); if (!el) continue;
    const v = f.type === 'checkbox' ? el.checked : f.type === 'range' ? +el.value : el.value;
    if (f.k === 'name') o.name = v || 'Joueur'; else if (f.k === 'color') o.color = v; else o.opts[f.k] = v;
  }
  if ($('in_diff')) o.diff = +$('in_diff').value;
  o.cfg.rivals = +$('in_rivals').value;
  if ($('in_goal')) { o.cfg.goal = $('in_goal').value; o.cfg.gv = +$('in_gv').value; }
  o.cfg.entr = $('in_entr').checked ? 1 : 0; o.cfg.safe = $('in_safe').checked ? 1 : 0;
  return o;
}

/* =============================== Actions =============================== */
const ctx = () => ({ get G() { return TE.G; }, get p() { return TE.G ? TE.player() : null; }, UI, TE, toast: TE.toast, openModal, closeModal, reAll });
const ACT = {
  speed(d) { if (TE.G.over) return; const i = +d.v; if (i) UI.lastSpeed = i; UI.speed = i; header(); },
  pal() { openPal(); return false; }, palclose() { closePal(); return false; }, palgo(d) { closePal(); ACT.tab({ v: d.v }); return false; },
  hub(d) { const h = TE.navOf(TE.def).find(x => x.id === d.v); if (!h) return false; const t = UI.hubTab[h.id]; ACT.tab({ v: t && h.tabs.includes(t) ? t : h.tabs[0] }); return false; },
  goto(d) { if (UI.modal && !$('modal').hidden) closeModal(); if (d.tab) ACT.tab({ v: d.tab }); if (d.open && UI.foldReg && UI.foldReg[d.open]) openModal('fold', { id: d.open }); return false; },
  fold(d) { if (!UI.foldReg || !UI.foldReg[d.k]) return false; openModal('fold', { id: d.k }); return false; },
  fabtoggle() { UI.fabOpen = !UI.fabOpen; header(); return false; },
  tab(d) { UI.tab = d.v; UI.fabOpen = false; const h = TE.navOf(TE.def).find(x => x.tabs.includes(d.v)); if (h) UI.hubTab[h.id] = d.v; renderAll(true); const t = TE.def.tabs.find(x => x.id === d.v); if (t && t.onOpen) t.onOpen(ctx()); },
  sub(d) { UI.sub[d.k] = d.v; renderAll(true); },
  set(d) { UI[d.k] = d.v; renderAll(true); },
  mset(d) { UI.modal[d.k] = d.v; renderModal(); },
  close() { closeModal(); },
  amtstep(d) { const o = AMTM[d.k]; if (!o) return; const v = clamp((UI.amt[d.k] == null ? o.def : UI.amt[d.k]) + (+d.v) * o.step, o.min, Math.max(o.min, o.max)); UI.amt[d.k] = v; amtRefresh(d.k); },
  borrow(d) { const p = TE.player(), x = UI.amt[d.k]; if (TE.borrow(p, x)) TE.toast('Emprunt de ' + money(x) + ' accordé à ' + TE.pct(TE.loanRate(p), 1) + '.'); else TE.toast('Plafond de crédit dépassé.'); },
  repay(d) { const p = TE.player(), x = UI.amt[d.k]; if (TE.repay(p, x)) TE.toast(money(x) + ' remboursés.'); else TE.toast('Trésorerie insuffisante.'); },
  saves() { openModal('saves'); },
  cheats() { openModal('cheats'); },
  cheat(d) {
    const C = TE.cheat, G = TE.G, p = TE.player();
    switch (d.k) {
      case 'cash': C.cash(+d.n); break; case 'debt': C.clearDebt(); break;
      case 'safe': TE.toast(C.safe() ? 'Faillite désactivée.' : 'Faillite réactivée.'); break;
      case 'skip': C.skip(+d.n); break; case 'win': C.win(); break;
      case 'entrant': C.entrant(); break; case 'rcash': C.rivalsCash(1e9); break; case 'kill': C.kill(+d.id); break;
      case 'rev': C.randomEvent(); break; case 'event': C.event(+d.i); break;
      case 'game': { const c = (TE.def.cheats || [])[+d.i]; if (c) { const r = c.run(G, p, ctx()); if (typeof r === 'string') TE.toast(r); } break; }
    }
  },
  saveslot(d) { TE.writeSlot(d.v) ? TE.toast('Partie sauvegardée.') : TE.toast('Espace de stockage plein : exporte un fichier.'); renderModal(); },
  loadslot(d) { const g = TE.readSlot(d.v); if (!g) return TE.toast('Sauvegarde illisible.'); TE.G = g; UI.modal = null; $('modal').hidden = true; begin(); },
  delslot(d) { try { TE.store.removeItem(TE.def.save + '.save.' + d.v); TE.store.removeItem(TE.def.save + '.meta.' + d.v); } catch (e) {} renderModal(); if (!$('start').hidden) showStart(); },
  export() { const b = new Blob([TE.exportSave()], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = TE.def.save + '-' + TE.player().name.replace(/\W+/g, '-') + '-j' + TE.G.day + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); },
  import() { const f = $('fileIn'); if (!f) return; f.onchange = () => { const r = new FileReader(); r.onload = () => { try { TE.importSave(r.result); UI.modal = null; $('modal').hidden = true; begin(); } catch (e) { TE.toast('Fichier invalide.'); } }; if (f.files[0]) r.readAsText(f.files[0]); }; f.click(); },
  newgame() { const o = readSetup(); TE.newGame(o); begin(); },
  continue() { const g = TE.load(); if (g) { TE.G = g; begin(); } },
  menu() { UI.modal = null; $('modal').hidden = true; TE.G = null; showStart(); }
};
let _tap = [];
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('#board .brand, .title h1')) { const t = Date.now(); _tap = _tap.filter(x => t - x < 3000).concat(t); if (_tap.length >= 5 && !UI.cheats) { UI.cheats = true; _tap = []; TE.toast('Menu test déverrouillé (🛠).'); if (TE.G) { header(); openModal('cheats'); } } }
  const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return;
  if (el.getAttribute('aria-disabled') === 'true') { TE.toast(el.dataset.why || 'Action impossible pour l\'instant.'); return; }
  const a = el.dataset.act, def = TE.def, fn = (def.actions && def.actions[a]) || ACT[a]; if (!fn) return;
  if (a !== 'fabtoggle') UI.fabOpen = false;
  const r = fn.call(ACT, el.dataset, ctx(), el);
  if (r !== false && TE.G && $('start').hidden) reAll();
});
let _sw = null;
document.addEventListener('touchstart', e => { const t = e.touches[0]; _sw = e.target.closest && e.target.closest('#panel') && !e.target.closest('.tbl,.chips,.seg,input,textarea,select,.abar,.wmap') ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
document.addEventListener('touchend', e => {
  if (!_sw || !TE.G || UI.modal) return; const t = e.changedTouches[0], dx = t.clientX - _sw.x, dy = t.clientY - _sw.y; _sw = null;
  if (Math.abs(dx) < 80 || Math.abs(dy) > 50 || Math.abs(dx) < 2 * Math.abs(dy)) return;
  const hub = TE.navOf(TE.def).find(h => h.tabs.includes(UI.tab)); if (!hub || hub.tabs.length < 2) return;
  const i = hub.tabs.indexOf(UI.tab) + (dx < 0 ? 1 : -1); if (i < 0 || i >= hub.tabs.length) return; ACT.tab({ v: hub.tabs[i] });
}, { passive: true });
document.addEventListener('input', e => { const lv = e.target.dataset && e.target.dataset.lv; if (lv != null && UI.modal) { UI.modal[lv] = e.target.value; const T = $('simtop'); if (T && TE.def.liveTop) T.innerHTML = TE.def.liveTop(UI.modal, ctx()); const L = $('simlive'); if (L && TE.def.liveSim) L.innerHTML = TE.def.liveSim(UI.modal, ctx()); const o = $('sv_' + lv); if (o && TE.def.liveLab) o.textContent = TE.def.liveLab(lv, e.target.value); return; } const tx = e.target.dataset && e.target.dataset.txt; if (tx != null) { UI.txt[tx] = e.target.value; return; } const k = e.target.dataset && e.target.dataset.amt; if (k == null) return; UI.amt[k] = +e.target.value; amtRefresh(k); });
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.lv != null && UI.modal) renderModal(); });

/* =============================== Palette « Aller à… » + raccourcis =============================== */
const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function palItems() {
  const def = TE.def, q = nrm(UI.pal.q).split(/\s+/).filter(Boolean), bd = def.badges ? (def.badges(TE.G, TE.player()) || {}) : {}, out = [];
  TE.navOf(def).forEach(h => h.tabs.forEach(id => { const t = (def.tabs || []).find(x => x.id === id) || { label: id }, hay = nrm(h.label + ' ' + t.label + ' ' + (t.kw || '')); if (q.every(w => hay.includes(w))) out.push({ id, hub: h.label, label: t.label || id, icon: t.icon, n: bd[id] && bd[id].n, cur: id === UI.tab }); }));
  return out;
}
function palList() {
  const L = palItems(); UI.pal.i = Math.max(0, Math.min(UI.pal.i, L.length - 1));
  $('pall').innerHTML = L.length ? L.map((x, i) => '<button class="palit' + (i === UI.pal.i ? ' on' : '') + '" data-act="palgo" data-v="' + x.id + '"><span class="ti">' + (ic(x.icon) || '•') + '</span><span class="pt"><b>' + esc(x.label) + '</b><small>' + esc(x.hub) + '</small></span>' + (x.n ? '<i class="bdg">' + x.n + '</i>' : '') + (x.cur ? '<em>ici</em>' : '') + '</button>').join('') : '<p class="muted palno">Aucun écran ne correspond.</p>';
  const on = $('pall').querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
}
function openPal() { if (!TE.G) return; UI.pal = { q: '', i: 0 }; const el = $('pal'); el.innerHTML = '<div class="palscrim" data-act="palclose"></div><div class="palbox" role="dialog" aria-label="Aller à un écran"><input id="palq" type="search" placeholder="Aller à… (bourse, pièces, usines)" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"><div id="pall" role="listbox"></div><p class="palhint muted">↑ ↓ choisir · Entrée ouvrir · Échap fermer · 1–5 pôles · [ ] rubriques</p></div>'; el.hidden = false; palList(); setTimeout(() => { const q = $('palq'); if (q) q.focus(); }, 30); }
function closePal() { const el = $('pal'); if (el) { el.hidden = true; el.innerHTML = ''; } }
document.addEventListener('input', e => { if (e.target && e.target.id === 'palq') { UI.pal.q = e.target.value; UI.pal.i = 0; palList(); } });
document.addEventListener('keydown', e => {
  const pal = $('pal'), inp = /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '');
  if (pal && !pal.hidden) {
    const L = palItems();
    if (e.key === 'Escape') { e.preventDefault(); closePal(); } else if (e.key === 'ArrowDown') { e.preventDefault(); UI.pal.i = Math.min(L.length - 1, UI.pal.i + 1); palList(); } else if (e.key === 'ArrowUp') { e.preventDefault(); UI.pal.i = Math.max(0, UI.pal.i - 1); palList(); } else if (e.key === 'Enter' && L[UI.pal.i]) { e.preventDefault(); closePal(); ACT.tab({ v: L[UI.pal.i].id }); }
    return;
  }
  if (!TE.G || UI.modal || !$('start').hidden) return;
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !inp)) { e.preventDefault(); openPal(); return; }
  if (inp || e.metaKey || e.ctrlKey || e.altKey) return;
  const nav = TE.navOf(TE.def);
  if (/^[1-9]$/.test(e.key) && nav[+e.key - 1]) ACT.hub({ v: nav[+e.key - 1].id });
  else if (e.key === '[' || e.key === ']') { const hub = nav.find(h => h.tabs.includes(UI.tab)); if (!hub) return; const i = hub.tabs.indexOf(UI.tab) + (e.key === ']' ? 1 : -1); if (i >= 0 && i < hub.tabs.length) ACT.tab({ v: hub.tabs[i] }); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && UI.modal && UI.modal.kind !== 'end') closeModal(); if (e.key === ' ' && !UI.modal && TE.G && $('start').hidden && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { e.preventDefault(); ACT.speed({ v: UI.speed ? 0 : UI.lastSpeed }); } });
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('#panel')) UI.holding = true; });
addEventListener('pointerup', () => { setTimeout(() => { UI.holding = false; }, 60); });
addEventListener('pointercancel', () => { UI.holding = false; });

/* =============================== Boucle =============================== */
function begin() {
  $('start').hidden = true; UI.tab = TE.def.tabs[0].id; UI.speed = 0; UI.acc = 0; UI.endShown = 0; UI.pkey = null; UI.lastSave = TE.G.day; UI.amt = {};
  if (TE.def.onBegin) TE.def.onBegin(TE.G);
  renderAll(true); if (TE.G.over) UI.endShown = 2;
}
let lastT = 0;
function frame(t) {
  const dt = Math.min(0.25, (t - lastT) / 1000 || 0); lastT = t; const G = TE.G, def = TE.def;
  if (G && !G.over && UI.speed && !UI.modal && $('start').hidden) {
    UI.acc += dt * def.speeds[UI.speed]; let n = 0; const t0 = performance.now();
    while (UI.acc >= 1 && n < 4 && (n === 0 || performance.now() - t0 < 12)) { TE.step(); UI.acc -= 1; n++; if (TE.G.over) break; }
    UI.acc = Math.min(UI.acc, 4); G.frac = UI.acc;
    if (n) { renderAll(); if (G.day - UI.lastSave >= 30 || G.day < UI.lastSave) { UI.lastSave = G.day; TE.save(); } }
    // pause automatique si le jeu le demande (course, choix à faire…)
    if (def.autoPause && def.autoPause(G) && !UI.modal) { UI.speed = 0; header(); }
  } else if (G && UI.dirty && $('start').hidden) renderAll();
  if (G && $('start').hidden && !UI.modal) {
    if (G.over && UI.endShown < 2) { UI.endShown = 2; UI.speed = 0; TE.save(); openModal('end', { win: false }); }
    else if (G.won && !UI.endShown) { UI.endShown = 1; openModal('end', { win: true }); }
    else if (def.popup && !G.over) { const q = def.popup(G); if (q) openModal(q.kind, q.data); }
  }
  if (def.map && G && $('start').hidden && def.map.draw) { const cv = $('map'); if (cv) def.map.draw(cv, G, UI); }
  requestAnimationFrame(frame);
}
const bgSave = () => { if (TE.G && $('start').hidden && !TE.G.over) TE.save(); };

/* Point d'entrée : TE.boot(definition) */
TE.boot = function (def) {
  TE.define(def);
  document.title = def.title;
  const th = def.theme || {}, r = document.documentElement.style;
  for (const k in th) r.setProperty('--' + k, th[k]);
  document.body.innerHTML = shellHTML(def);
  if (/cheat/.test((location.hash || '') + (location.search || ''))) UI.cheats = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') bgSave(); });
  addEventListener('pagehide', bgSave);
  showStart();
  requestAnimationFrame(frame);
};

})(typeof globalThis !== 'undefined' ? globalThis : this);
