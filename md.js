/* =====================================================================
   md.js — rendu Markdown sûr (tout le texte est échappé avant d'ajouter des balises)
   Gère : titres, listes (imbriquées), citations, tableaux, règles, blocs de code
   avec coloration légère et bouton « Copier », gras, italique, barré, code en ligne,
   liens http(s), et le bloc <think>…</think> (réflexion, repliable).
   ===================================================================== */

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- coloration très légère (sans bibliothèque) ---------- */
const KW = {
  js: 'const let var function return if else for while of in new class extends import from export default async await try catch throw switch case break continue typeof null true false undefined this',
  py: 'def class return if elif else for while in not and or import from as with try except finally raise lambda None True False yield pass break continue self is',
  sh: 'if then else fi for do done while case esac function echo cd ls sudo export in',
  sql: 'select from where group by order insert into values update set delete create table join left right inner on as and or not null limit having distinct union',
  json: 'true false null',
};
const ALIAS = { javascript: 'js', jsx: 'js', ts: 'js', typescript: 'js', node: 'js', python: 'py', bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh', json: 'json', sql: 'sql', js: 'js', py: 'py', sh: 'sh' };
const kwRe = {};

function highlight(code, lang) {
  const l = ALIAS[String(lang || '').toLowerCase()];
  if (!l) return esc(code);
  const kws = kwRe[l] || (kwRe[l] = new Set(KW[l].split(' ')));
  const cm = l === 'py' || l === 'sh' ? '#[^\\n]*' : l === 'sql' ? '--[^\\n]*' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const re = new RegExp('(' + cm + ')|("(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'|`(?:\\\\.|[^`\\\\])*`)|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_]\\w*)', 'g');
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const t = esc(m[0]);
    if (m[1]) out += '<span class="tk-c">' + t + '</span>';
    else if (m[2]) out += '<span class="tk-s">' + t + '</span>';
    else if (m[3]) out += '<span class="tk-n">' + t + '</span>';
    else if (kws.has(l === 'sql' ? m[4].toLowerCase() : m[4])) out += '<span class="tk-k">' + t + '</span>';
    else out += t;
    last = m.index + m[0].length;
  }
  return out + esc(code.slice(last));
}

/* ---------- inline ---------- */
function inline(raw) {
  const codes = [];
  let s = String(raw).replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = esc(s);
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + '</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, (_, p, u) => p + '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>');
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\s][^_\n]*?)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~([^~\n]+?)~~/g, '<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + esc(codes[+i]) + '</code>');
}

/* ---------- blocs ---------- */
const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('-');
const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

function codeBlock(lang, code, open) {
  const label = lang ? '<span class="code-lang">' + esc(lang) + '</span>' : '<span class="code-lang"></span>';
  return '<div class="code' + (open ? ' open' : '') + '"><div class="code-bar">' + label + '<button type="button" class="copy-code">Copier</button></div><pre><code>' + highlight(code, lang) + '</code></pre></div>';
}

function listHtml(lines, i) {
  /* lines[i] commence une liste ; retourne [html, nouvel index] */
  const re = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  const first = re.exec(lines[i]);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  let html = '<' + (ordered ? 'ol' : 'ul') + '>';
  while (i < lines.length) {
    const m = re.exec(lines[i]);
    if (!m || m[1].length < baseIndent) break;
    if (m[1].length > baseIndent) {   // sous-liste
      const [sub, ni] = listHtml(lines, i);
      html = html.replace(/<\/li>$/, '') + sub + '</li>';
      i = ni; continue;
    }
    let item = inline(m[3]);
    i++;
    while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !re.test(lines[i])) { item += ' ' + inline(lines[i].trim()); i++; }
    html += '<li>' + item + '</li>';
  }
  return [html + '</' + (ordered ? 'ol' : 'ul') + '>', i];
}

function blocks(src) {
  const lines = src.split('\n');
  let html = '', i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = /^\s*```(\S*)\s*$/.exec(line);
    if (fence) {
      const buf = []; i++;
      let closed = false;
      while (i < lines.length) { if (/^\s*```\s*$/.test(lines[i])) { closed = true; i++; break; } buf.push(lines[i]); i++; }
      html += codeBlock(fence[1], buf.join('\n'), !closed);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { const n = Math.min(6, h[1].length + 1); html += '<h' + n + '>' + inline(h[2]) + '</h' + n + '>'; i++; continue; }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { html += '<hr>'; i++; continue; }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      html += '<blockquote>' + blocks(buf.join('\n')) + '</blockquote>';
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      let t = '<div class="tbl"><table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>';
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { t += '<tr>' + cells(lines[i]).map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>'; i++; }
      html += t + '</tbody></table></div>';
      continue;
    }
    if (/^(\s*)([-*+]|\d+[.)])\s+/.test(line)) { const [l, ni] = listHtml(lines, i); html += l; i = ni; continue; }
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^\s*(```|#{1,6}\s|>|([-*+]|\d+[.)])\s)/.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) { buf.push(lines[i]); i++; }
    html += '<p>' + buf.map(inline).join('<br>') + '</p>';
  }
  return html;
}

/* Rendu complet d'un message de l'assistant (réflexion repliable + corps) */
export function renderMd(src) {
  let think = '';
  src = String(src).replace(/<think>([\s\S]*?)(<\/think>|$)/g, (_, t, close) => {
    if (t.trim()) think += '<details class="think"' + (close ? '' : ' open') + '><summary>Réflexion</summary>' + esc(t.trim()) + '</details>';
    return '';
  });
  return think + blocks(src.replace(/\r\n/g, '\n'));
}

/* Texte brut pour la lecture à voix haute / la copie : sans réflexion ni balisage */
export function plainText(src) {
  return String(src).replace(/<think>[\s\S]*?(<\/think>|$)/g, '')
    .replace(/```[\s\S]*?(```|$)/g, ' (extrait de code) ')
    .replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/[*_~>|]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
