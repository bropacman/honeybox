// End-to-end: local PeerJS server + static server, a TV page and N bot phones
// playing complete games through the real UI. Writes screenshots + summary to test-artifacts/.
// Run: npm run e2e   (needs Playwright; uses the preinstalled Chromium if present)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'test-artifacts');
const PHONES = Number(process.env.PHONES || 3);
const GAMES = Number(process.env.GAMES || 3);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const web = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/index.html';
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(5178, '127.0.0.1');

const peerSrv = spawn(join(ROOT, 'node_modules/.bin/peerjs'), ['--port', '9000', '--host', '127.0.0.1'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));

const errors = [];
const summary0 = {};
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const ctxTV = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const tv = await ctxTV.newPage();
tv.on('pageerror', e => errors.push(`tv: ${e.message}`));
tv.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(`tv console: ${m.text()}`); });

const base = 'http://127.0.0.1:5178/';
const peer = 'peer=127.0.0.1:9000';
await tv.goto(`${base}?host=1&${peer}&speed=0.1`);
await tv.click('#open');
await tv.waitForFunction(() => /^[A-Z]{4}$/.test(document.querySelector('.code')?.textContent || ''), null, { timeout: 20000 });
const code = await tv.textContent('.code');
console.log('room', code);
await tv.screenshot({ path: join(OUT, '00-tv-lobby-empty.png') });

const phones = [];
for (let i = 0; i < PHONES; i++) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`phone${i}: ${e.message}`));
  await p.goto(`${base}?room=${code}&${peer}&bot=1`);
  phones.push(p);
}
await tv.waitForFunction(n => document.querySelectorAll('.camper').length === n, PHONES, { timeout: 30000 });
// switch character in the lobby
await phones[0].waitForSelector('[data-switch="🦄"]');
await phones[0].screenshot({ path: join(OUT, '01-phone-lobby-switch.png') });
await phones[0].click('[data-switch="🦄"]');
await tv.waitForFunction(() => window.__honeybox.S.players.some(p => p.avatar === '🦄'), null, { timeout: 10000 });
summary0.avatarSwitch = true;
await tv.screenshot({ path: join(OUT, '01-tv-lobby-full.png') });
await phones[0].screenshot({ path: join(OUT, '01-phone-lobby.png') });

const summary = { ...summary0, code, phones: PHONES, games: [], errors };
const seenAll = new Set();
const minigames = new Set();
const phoneScreens = new Set();
let shot = 2;

for (let g = 0; g < GAMES; g++) {
  await tv.click('[data-act="length"][data-len="long"]');
  if (g === 0) {
    // first phone to join is the VIP and starts the night from their phone
    await phones[0].waitForSelector('[data-vip="start"]:not([disabled])');
    await phones[0].click('[data-vip="start"]');
    await tv.waitForFunction(() => window.__honeybox.S.phase !== 'lobby');
    summary0.vipStart = true;
  } else {
    await tv.click('[data-act="start"]');
  }
  const seen = [];
  let last = '';
  const started = Date.now();
  while (Date.now() - started < 240000) {
    const st = await tv.evaluate(() => ({ phase: window.__honeybox.S.phase, mg: window.__honeybox.S.mg?.type, di: window.__honeybox.S.mg?.di }));
    const tag = `${st.phase}${st.mg ? ':' + st.mg : ''}`;
    if (tag !== last) {
      last = tag;
      seen.push(tag);
      if (st.mg && st.mg !== 'finale') minigames.add(st.mg);
      if (!seenAll.has(tag)) {
        seenAll.add(tag);
        const settle = ['stakesReveal', 'reveal', 'drawReveal'].includes(st.phase);
        if (settle) { await tv.evaluate(() => window.__honeybox.togglePause()); await tv.waitForTimeout(1200); await tv.evaluate(() => document.querySelector('.paused')?.remove()); }
        else if (st.phase !== 'pick') await tv.waitForTimeout(150);
        const n = String(shot++).padStart(2, '0');
        await tv.screenshot({ path: join(OUT, `${n}-tv-${tag.replace(':', '-')}.png`) });
        // screenshot the phone that has something to do, else phone 0
        let target = phones[0];
        for (const p of phones) {
          if (await p.$('canvas#pad, #lie, [data-pick]:not([disabled]), [data-guess]:not([disabled]), [data-answer]:not([disabled])')) { target = p; break; }
        }
        await target.screenshot({ path: join(OUT, `${n}-phone-${tag.replace(':', '-')}.png`) });
        if (settle) await tv.evaluate(() => window.__honeybox.togglePause());
      }
      // one screenshot per distinct phone screen, before the bot acts on it
      for (const p of phones) {
        const screen = await p.evaluate(() => document.querySelector('.phone')?.className.match(/screen-(\w+)/)?.[1] || null);
        if (screen && !phoneScreens.has(screen)) {
          phoneScreens.add(screen);
          await p.screenshot({ path: join(OUT, `screen-${screen}.png`) });
        }
      }
      if (st.phase === 'end') break;
    }
    await tv.waitForTimeout(60);
  }
  const final = await tv.evaluate(() => window.__honeybox.ranked().map(p => ({ name: p.name, score: p.score })));
  const endedOk = last.startsWith('end');
  summary.games.push({ phases: seen, final, endedOk });
  console.log(`game ${g + 1}: ${seen.length} phases, ended=${endedOk}`, final);
  if (!endedOk) break;
  if (minigames.size === 3 && g >= 0) break;
  await tv.click('[data-act="again"]');
  await tv.waitForFunction(() => window.__honeybox.S.phase === 'lobby');
}

// reconnect check: reload a phone mid-lobby/end and make sure it rejoins as the same player
const before = await tv.evaluate(() => window.__honeybox.S.players.length);
await phones[1].reload();
await phones[1].waitForTimeout(3000);
const after = await tv.evaluate(() => ({ n: window.__honeybox.S.players.length, connected: window.__honeybox.S.players.filter(p => p.connected).length }));

summary.minigamesSeen = [...minigames];
summary.phoneScreens = [...phoneScreens];
summary.reconnect = { playersBefore: before, after };
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

const ok = summary.games.every(g => g.endedOk) && errors.length === 0;
console.log('minigames seen:', summary.minigamesSeen.join(', '));
console.log('phone screens:', summary.phoneScreens.join(', '));
console.log('reconnect:', JSON.stringify(summary.reconnect));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
peerSrv.kill();
web.close();
process.exit(ok ? 0 : 1);
