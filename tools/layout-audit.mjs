// Layout audit: plays a game with bot phones, pauses on every new TV screen, and reports anything that runs off
// the screen, spills out of the main area into the top/bottom bars, or sits under the status pieces in those bars.
// Checks a TV (1920x1080) and a laptop (1280x720). Screenshots of problem screens go to test-artifacts/layout/.
// Run: node tools/layout-audit.mjs   (exits 1 if anything is found; SHOTS=1 also saves every screen for a look-over)
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'test-artifacts', 'layout');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const SIZES = [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }];

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
const web = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/index.html';
  try { const body = await readFile(join(ROOT, path)); res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); }
}).listen(5177, '127.0.0.1');
const peerSrv = spawn(process.execPath, [join(ROOT, 'node_modules/peer/dist/bin/peerjs.js'), '--port', '9002', '--host', '127.0.0.1'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));

const browser = await chromium.launch();
const tv = await (await browser.newContext({ viewport: SIZES[0] })).newPage();
const base = 'http://127.0.0.1:5177/';
const peer = 'peer=127.0.0.1:9002';
await tv.goto(`${base}?host=1&${peer}&speed=0.05`);
await tv.click('#open');
await tv.click('[data-act="mute"]');
await tv.waitForFunction(() => /^[A-Z]{4}$/.test(document.querySelector('.code')?.textContent || ''));
const code = await tv.textContent('.code');
for (let i = 0; i < 4; i++) {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto(`${base}?room=${code}&${peer}&bot=1`);
}
await tv.waitForFunction(() => document.querySelectorAll('.camper').length === 4, null, { timeout: 30000 });

// runs in the page: leaf elements (tight text boxes) that leave the viewport or sit under the fixed HUD
const audit = () => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const shown = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; } return true; };
  const clip = (e, r) => {
    let { left, top, right, bottom } = r;
    for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) {
      if (getComputedStyle(x).overflow === 'visible') continue;
      const c = x.getBoundingClientRect();
      left = Math.max(left, c.left); top = Math.max(top, c.top); right = Math.min(right, c.right); bottom = Math.min(bottom, c.bottom);
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };
  const box = (e) => {
    if (e.children.length === 0 && e.textContent.trim()) { const r = document.createRange(); r.selectNodeContents(e); return clip(e, r.getBoundingClientRect()); }
    return clip(e, e.getBoundingClientRect());
  };
  const name = (e) => `${(e.textContent.trim() || e.tagName.toLowerCase()).slice(0, 32)} <${typeof e.className === 'string' ? e.className : ''}>`;
  const leaves = [...document.querySelectorAll('.tv-main *')].filter(e => !e.closest('.peeker'))
    .filter(e => (e.children.length === 0 || e.matches('img, canvas, svg, .qr')) && !e.closest('svg') || e.matches('svg'))
    .filter(e => shown(e)).map(e => [e, box(e)]).filter(([, r]) => r.width > 2 && r.height > 2);
  for (const [e, r] of leaves) {
    if (r.top < -2 || r.left < -2 || r.bottom > vh + 2 || r.right > vw + 2) out.push(`offscreen: ${name(e)} [${[r.left, r.top, r.right, r.bottom].map(Math.round)}]`);
  }
  const main = document.querySelector('.tv-main').getBoundingClientRect();
  for (const [e, r] of leaves) {
    if (r.top < main.top - 2 || r.bottom > main.bottom + 2) out.push(`spills out of the main area: ${name(e)} [${[r.top, r.bottom].map(Math.round)} vs ${[main.top, main.bottom].map(Math.round)}]`);
  }
  // text running into other text (ignores decorations and anything nested inside the other)
  // (emoji-only text is skipped: a big emoji's glyph box is taller than what it draws)
  const texts = leaves.filter(([e]) => e.children.length === 0 && /[\p{L}\p{N}]/u.test(e.textContent) && !e.closest('.prowler, .nt-lurk, .nt-gain'));
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const [a, ra] = texts[i], [b, rb] = texts[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 6 && oy > 6) out.push(`text overlaps text: ${name(a)} / ${name(b)}`);
    }
  }
  const hud = ['#timer', '.host-ctl', '.mini-code', '.captive', '.dc-banner', '.top-left .quiz-head', '.top-right .locks'].flatMap(s => [...document.querySelectorAll(s)]).filter(shown);
  for (const h of hud) {
    const a = h.getBoundingClientRect();
    for (const [e, r] of leaves) {
      if (h.contains(e)) continue;
      const ox = Math.min(a.right, r.right) - Math.max(a.left, r.left), oy = Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top);
      if (ox > 4 && oy > 4) out.push(`under ${h.id ? '#' + h.id : '.' + h.className.split(' ')[0]}: ${name(e)}`);
    }
  }
  return [...new Set(out)];
};

const report = {};
const seen = new Set();
let n = 0;
await tv.evaluate(() => { window.__honeybox.S.bag = ['draw', 'poll', 'trivia', 'guess', 'hide', 'door', 'zoom']; });
await tv.click('[data-act="start"]');
const started = Date.now();
while (Date.now() - started < 300000) {
  const st = await tv.evaluate(() => ({ phase: window.__honeybox.S.phase, mg: window.__honeybox.S.mg?.type }));
  if (st.phase === 'end') break;
  const tag = `${st.phase}${st.mg ? ':' + st.mg : ''}`;
  if (!seen.has(tag)) {
    seen.add(tag);
    await tv.evaluate(() => { if (!window.__honeybox.isPaused()) window.__honeybox.togglePause(); });
    for (const size of SIZES) {
      await tv.setViewportSize(size);
      await tv.waitForTimeout(150);
      await tv.evaluate(() => {
        document.querySelector('.paused')?.remove();
        document.querySelectorAll('.splash').forEach(e => e.remove());
        document.getAnimations().forEach(a => { try { if (a.effect.getTiming().iterations !== Infinity) a.finish(); } catch (e) { /* keep going */ } });
      });
      const issues = await tv.evaluate(audit);
      const key = `${size.width}x${size.height}`;
      if (issues.length) (report[tag] ||= {})[key] = issues;
      if (issues.length || process.env.SHOTS) {
        await tv.screenshot({ path: join(OUT, `${String(++n).padStart(2, '0')}-${tag.replace(':', '-')}-${key}.png`) });
      }
    }
    await tv.setViewportSize(SIZES[0]);
    await tv.evaluate(() => window.__honeybox.togglePause());
  }
  await tv.waitForTimeout(40);
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`screens checked: ${seen.size}`);
for (const [tag, bySize] of Object.entries(report)) for (const [size, issues] of Object.entries(bySize)) {
  console.log(`\n${tag} @ ${size}`);
  issues.slice(0, 8).forEach(i => console.log('  ' + i));
  if (issues.length > 8) console.log(`  …and ${issues.length - 8} more`);
}
await browser.close();
peerSrv.kill();
web.close();
process.exit(Object.keys(report).length ? 1 : 0);
