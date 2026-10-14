// Screenshots of key TV moments for design review: node tools/preview.mjs <outdir>
// Joins 3 idle phones (they don't play), then drives the game from the TV page.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'test-artifacts', 'preview');
mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
const web = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/index.html';
  try { const body = await readFile(join(ROOT, path)); res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); }
}).listen(5179, '127.0.0.1');
const peerSrv = spawn(process.execPath, [join(ROOT, 'node_modules/peer/dist/bin/peerjs.js'), '--port', '9001', '--host', '127.0.0.1'], { stdio: 'ignore' });
// wait until the PeerJS server is actually accepting connections (a fixed sleep was flaky on busy machines)
for (let i = 0; i < 100 && !(await new Promise(r => { const c = connect(9001, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); })); i++) await new Promise(r => setTimeout(r, 100));
const browser = await chromium.launch();
const tv = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
tv.on('pageerror', e => console.log('tv error:', e.message));
const base = 'http://127.0.0.1:5179/';
await tv.goto(`${base}?host=1&peer=127.0.0.1:9001`);
await tv.click('#open');
await tv.waitForFunction(() => /^[A-Z]{4}$/.test(document.querySelector('.code')?.textContent || ''));
const code = await tv.textContent('.code');
const phones = [];
for (const name of ['Jon', 'Sue', 'Gramps']) {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  await p.goto(`${base}?room=${code}&peer=127.0.0.1:9001`);
  await p.fill('#name', name);
  await p.click('#go');
  phones.push(p);
}
await tv.waitForFunction(() => window.__honeybox.S.players.length === 3);
const G = (fn, arg) => tv.evaluate(fn, arg);
const shot = async (name, wait = 1200) => { await tv.waitForTimeout(wait); await tv.screenshot({ path: join(OUT, `${name}.png`) }); console.log('shot', name); };
const waitPhase = (ph) => tv.waitForFunction(p => window.__honeybox.S.phase === p, ph, { timeout: 60000 });
await G(() => { const g = window.__honeybox; g.S.players[0].score = 800; g.S.players[1].score = 1200; });
await tv.click('[data-act="start"]');
await G(() => window.__honeybox.skip());          // past the intro
await waitPhase('turnStart'); await G(() => window.__honeybox.skip());
await waitPhase('pick'); await shot('1-pick-dark', 2500);
await G(() => { const g = window.__honeybox; g.chooseSpot(g.S.watch.watcherId, 1); });
await waitPhase('tot'); await shot('2-question', 1500);
await G(() => { const g = window.__honeybox; g.S.deadline = Date.now() + 4000; });
await shot('3-question-low-battery', 1200);
await G(() => { const g = window.__honeybox; g.answer(g.S.watch.watcherId, g.S.watch.q.ans); for (const p of g.S.players) g.answer(p.id, 0); g.skip(); });
await waitPhase('totReveal'); await shot('4-reveal-confetti', 4300);
await G(() => window.__honeybox.skip());
await tv.waitForFunction(() => ['decide', 'decideReveal'].includes(window.__honeybox.S.phase));
if (await G(() => window.__honeybox.S.phase) === 'decide') { await shot('5-decide', 1500); await G(() => { const g = window.__honeybox; g.decide(g.S.watch.watcherId, 'keep'); g.skip(); }); }
await waitPhase('decideReveal'); await G(() => window.__honeybox.skip());
await waitPhase('pick'); await G(() => { const g = window.__honeybox; g.chooseSpot(g.S.watch.watcherId, 2); });
await waitPhase('tot');
await G(() => { const g = window.__honeybox; g.answer(g.S.watch.watcherId, 1 - g.S.watch.q.ans); g.skip(); });
await waitPhase('totReveal'); await tv.waitForTimeout(4000); await G(() => window.__honeybox.skip());
await waitPhase('dragged'); await shot('6-dragged-scare', 250);
await shot('7-phone', 10);
await phones[0].screenshot({ path: join(OUT, '7-phone.png') });
await browser.close(); peerSrv.kill(); web.close();
