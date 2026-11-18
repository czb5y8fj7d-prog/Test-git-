// Assemble moteur + un jeu en UN SEUL fichier HTML autonome (parfait pour un artifact ou un VPS statique).
// Usage : node build.mjs ecurie        → dist/ecurie.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const game = process.argv[2] || 'ecurie';
const gdir = path.join(root, 'games', game);
if (!fs.existsSync(path.join(gdir, 'game.js'))) { console.error('Jeu introuvable : games/' + game + '/game.js'); process.exit(1); }
const rd = f => fs.readFileSync(f, 'utf8');
const extraCss = fs.existsSync(path.join(gdir, 'game.css')) ? rd(path.join(gdir, 'game.css')) : '';
// Images optionnelles : games/<jeu>/art/*.(png|jpg|jpeg|webp) → TE.ART[nom] = data URI (le nom du fichier sans extension)
const art = {}, adir = path.join(gdir, 'art');
if (fs.existsSync(adir)) for (const f of fs.readdirSync(adir)) { const m = /^(.*)\.(png|jpe?g|webp)$/i.exec(f); if (m) art[m[1]] = 'data:image/' + (m[2].toLowerCase() === 'jpg' ? 'jpeg' : m[2].toLowerCase()) + ';base64,' + fs.readFileSync(path.join(adir, f)).toString('base64'); }
const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="color-scheme" content="light dark"><meta name="theme-color" content="#f2f4f8" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#101822" media="(prefers-color-scheme: dark)">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${game}</title>
<style>
${rd(path.join(root, 'engine/style.css'))}
${extraCss}
</style></head>
<body>
<script>
${rd(path.join(root, 'engine/core.js'))}
${rd(path.join(root, 'engine/ui.js'))}
</script>
<script>TE.ART = ${JSON.stringify(art)};</script>
<script>
${['world.js', 'world-map.js'].filter(f => fs.existsSync(path.join(gdir, f))).map(f => rd(path.join(gdir, f))).join('\n')}
${rd(path.join(gdir, 'game.js'))}
</script>
</body></html>`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', game + '.html');
fs.writeFileSync(out, html);
console.log('OK', out, (html.length / 1024).toFixed(1) + ' Ko');
