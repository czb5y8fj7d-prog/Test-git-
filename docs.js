/* =====================================================================
   docs.js — pièces jointes : texte, CSV, JSON, PDF, Excel, Word, images
   Tout est lu dans le navigateur : le fichier n'est envoyé nulle part ;
   seul le texte extrait (ou des extraits pertinents) part avec la question
   vers le modèle choisi (serveur ou appareil).
   ===================================================================== */

const LIBS = {
  pdf: { url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js', global: 'pdfjsLib' },
  xlsx: { url: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', global: 'XLSX' },
  docx: { url: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', global: 'mammoth' },
};
const loading = {};

function loadLib(name) {
  const L = LIBS[name];
  if (window[L.global]) return Promise.resolve(window[L.global]);
  if (!loading[name]) {
    loading[name] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = L.url; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => resolve(window[L.global]);
      s.onerror = () => { loading[name] = null; reject(Object.assign(new Error('Impossible de charger le lecteur de ' + name.toUpperCase() + ' (connexion ?)'), { kind: 'network' })); };
      document.head.append(s);
    });
  }
  return loading[name];
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_DOC_CHARS = 1_500_000;   // au-delà, le texte est tronqué (le reste n'est pas lu)
export const ACCEPT = '.pdf,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,.log,.xlsx,.xls,.docx,.js,.py,.ts,.sql,.yaml,.yml,image/*';

const ext = (n) => (String(n).toLowerCase().match(/\.([a-z0-9]+)$/) || [, ''])[1];
export const isImage = (f) => /^image\//.test(f.type) || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif'].includes(ext(f.name));

async function readPdf(file) {
  const pdfjs = await loadLib('pdf');
  pdfjs.GlobalWorkerOptions.workerSrc = LIBS.pdf.worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out = [];
  let total = 0;
  for (let p = 1; p <= doc.numPages && total < MAX_DOC_CHARS; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    let line = '', lastY = null;
    const lines = [];
    for (const it of tc.items) {
      const y = it.transform ? Math.round(it.transform[5]) : 0;
      if (lastY !== null && Math.abs(y - lastY) > 3) { lines.push(line); line = ''; }
      line += it.str + (it.hasEOL ? '\n' : ' ');
      lastY = y;
    }
    lines.push(line);
    const text = lines.join('\n').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
    out.push('[Page ' + p + ']\n' + text);
    total += text.length;
  }
  return { text: out.join('\n\n'), note: doc.numPages + ' page(s)' };
}

async function readXlsx(file) {
  const X = await loadLib('xlsx');
  const wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
  const out = [];
  for (const name of wb.SheetNames) {
    const csv = X.utils.sheet_to_csv(wb.Sheets[name], { FS: ' | ', blankrows: false });
    if (csv.trim()) out.push('[Feuille « ' + name + ' »]\n' + csv);
  }
  return { text: out.join('\n\n'), note: wb.SheetNames.length + ' feuille(s)' };
}

async function readDocx(file) {
  const m = await loadLib('docx');
  const r = await m.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return { text: r.value, note: 'document Word' };
}

/* Fichier → { name, text, chars, note } ; lève une erreur lisible */
export async function extractText(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('« ' + file.name + ' » dépasse 25 Mo.');
  const e = ext(file.name);
  let r;
  if (e === 'pdf' || file.type === 'application/pdf') r = await readPdf(file);
  else if (e === 'xlsx' || e === 'xls') r = await readXlsx(file);
  else if (e === 'docx') r = await readDocx(file);
  else {
    let t = await file.text();
    if (e === 'html' || e === 'htm') t = new DOMParser().parseFromString(t, 'text/html').body.textContent || '';
    r = { text: t, note: '' };
  }
  let text = r.text.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();
  if (!text) throw new Error('Aucun texte trouvé dans « ' + file.name + ' » (PDF scanné ? essayez de le joindre comme image).');
  let truncated = false;
  if (text.length > MAX_DOC_CHARS) { text = text.slice(0, MAX_DOC_CHARS); truncated = true; }
  return { name: file.name, text, chars: text.length, note: [r.note, truncated ? 'tronqué' : ''].filter(Boolean).join(' · ') };
}

/* Image → JPEG réduit (≤ 1280 px) en base64 sans préfixe + miniature */
export async function prepareImage(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('« ' + file.name + ' » dépasse 25 Mo.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image illisible : ' + file.name)); i.src = url; });
    const draw = (max, q) => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', q);
    };
    return { name: file.name, b64: draw(1280, 0.85).split(',')[1], thumb: draw(96, 0.7) };
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- sélection d'extraits pertinents (quand le document dépasse le budget) ---------- */
const STOP = new Set('le la les un une des de du et en à au aux ce ces que qui quoi dans pour par sur avec est sont pas plus the and for with that this from what how'.split(' '));
const words = (s) => (String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{3,}/g) || []).filter((w) => !STOP.has(w));

export function chunkText(text, size = 1200) {
  const paras = text.split(/\n{2,}|\n(?=\[(?:Page|Feuille))/);
  const chunks = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length > size) { chunks.push(cur); cur = ''; }
    if (p.length > size * 1.5) {   // paragraphe énorme (tableau, CSV) : découpe par lignes
      const ls = p.split('\n');
      for (const l of ls) { if (cur && cur.length + l.length > size) { chunks.push(cur); cur = ''; } cur += (cur ? '\n' : '') + l; }
    } else cur += (cur ? '\n\n' : '') + p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/* Choisit les extraits les plus proches de la question, dans la limite de maxChars, dans l'ordre d'origine */
export function selectExcerpts(text, query, maxChars) {
  if (text.length <= maxChars) return { text, partial: false };
  const chunks = chunkText(text);
  const q = words(query);
  const df = {};
  const toks = chunks.map((c) => { const w = new Set(words(c)); w.forEach((x) => { df[x] = (df[x] || 0) + 1; }); return w; });
  const N = chunks.length;
  const scored = chunks.map((c, i) => {
    let s = 0;
    for (const w of q) if (toks[i].has(w)) s += Math.log(1 + N / df[w]);
    return { i, s: s + (i === 0 ? 0.3 : 0) };   // le début (titre, résumé) a un petit bonus
  }).sort((a, b) => b.s - a.s || a.i - b.i);
  const keep = [];
  let used = 0;
  for (const c of scored) {
    const len = chunks[c.i].length + 6;
    if (used + len > maxChars) { if (used > maxChars * 0.6) break; else continue; }
    keep.push(c.i); used += len;
  }
  keep.sort((a, b) => a - b);
  let out = '';
  let prev = -2;
  for (const i of keep) { out += (i !== prev + 1 ? '\n[…]\n' : '\n') + chunks[i]; prev = i; }
  return { text: out.trim(), partial: true };
}
