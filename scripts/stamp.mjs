// Cache-busting for GitHub Pages: stamps every JS/CSS file with a content hash in index.html
// (an import map for the ES modules, ?v= on the rest). Run before committing: npm run stamp
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (file) => createHash('sha1').update(readFileSync(join(ROOT, file))).digest('hex').slice(0, 8);
const walk = (dir) => readdirSync(join(ROOT, dir)).flatMap((f) => {
  const p = join(dir, f);
  return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p];
});

const modules = walk('js').filter(f => f.endsWith('.js')).sort();
const imports = Object.fromEntries(modules.map(f => [`./${f}`, `./${f}?v=${hash(f)}`]));
const map = `<script type="importmap">${JSON.stringify({ imports }, null, 2)}</script>`;

let html = readFileSync(join(ROOT, 'index.html'), 'utf8');
html = html.replace(/<!-- stamp:start -->[\s\S]*<!-- stamp:end -->/, '').trimEnd();
const block = `<!-- stamp:start -->
  ${map}
  <link rel="stylesheet" href="css/style.css?v=${hash('css/style.css')}">
  <script src="vendor/peerjs.min.js?v=${hash('vendor/peerjs.min.js')}"></script>
  <script src="vendor/qrcode.js?v=${hash('vendor/qrcode.js')}"></script>
  <script type="module" src="js/main.js?v=${hash('js/main.js')}"></script>
  <!-- stamp:end -->`;
html = html
  .replace(/\s*<link rel="stylesheet" href="css\/style\.css[^"]*">/, '')
  .replace(/\s*<script src="vendor\/peerjs\.min\.js[^"]*"><\/script>/, '')
  .replace(/\s*<script src="vendor\/qrcode\.js[^"]*"><\/script>/, '')
  .replace(/\s*<script type="module" src="js\/main\.js[^"]*"><\/script>/, '')
  .replace('</body>', `  ${block}\n</body>`);
writeFileSync(join(ROOT, 'index.html'), html + '\n');
console.log(`stamped ${modules.length} modules`);
