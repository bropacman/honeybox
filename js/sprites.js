// Pixel sprites: every emoji that has a sprite gets swapped for crisp pixel art after each render.
// Sprites are 16x16 (icons) or 24x24 (characters) text grids (see js/sprites/*.js), drawn once to a canvas and cached as data URLs.
import PAL from './sprites/palette.js';
import AVATARS_A from './sprites/avatars-a.js';
import AVATARS_B from './sprites/avatars-b.js';
import ITEMS from './sprites/items.js';
import PLACES from './sprites/places.js';
import ANIME_A from './sprites/anime-a.js';
import ANIME_B from './sprites/anime-b.js';
import { ANIME_MARK } from './content.js';

const VS = /\uFE0F/g;
const GRIDS = {};
for (const set of [PLACES, ITEMS, AVATARS_A, AVATARS_B]) for (const [k, v] of Object.entries(set)) GRIDS[k.replace(VS, '')] = v;
// anime avatars are keyed by emoji + the anime marker
for (const set of [ANIME_A, ANIME_B]) for (const [k, v] of Object.entries(set)) GRIDS[k.replace(VS, '') + ANIME_MARK] = v;

const urls = {};
function url(key) {
  if (urls[key]) return urls[key];
  const grid = GRIDS[key];
  const c = document.createElement('canvas');
  c.width = grid[0].length;
  c.height = grid.length;
  const g = c.getContext('2d');
  grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || !PAL[ch]) return;
    g.fillStyle = PAL[ch];
    g.fillRect(x, y, 1, 1);
  }));
  urls[key] = c.toDataURL();
  return urls[key];
}

export const hasSprite = (emoji) => Boolean(GRIDS[String(emoji).replace(VS, '')]);
export const spriteImg = (emoji, cls = '') => `<img class="px ${cls}" src="${url(String(emoji).replace(VS, ''))}" alt="${emoji}" draggable="false">`;

// longest keys first so multi-codepoint emoji win over their parts
const keys = Object.keys(GRIDS).sort((a, b) => b.length - a.length);
const RE = new RegExp(`(${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\uFE0F?`, 'gu');
const HAS = new RegExp(RE.source, 'u');
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CANVAS']);

// Replace sprite-able emoji in every text node under root (attributes and form fields are left alone)
export function spritify(root) {
  if (!keys.length || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (SKIP.has(n.parentNode?.nodeName) || !HAS.test(n.nodeValue) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
  });
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  for (const n of nodes) {
    RE.lastIndex = 0;
    const span = document.createElement('span');
    span.className = 'px-run';
    span.innerHTML = n.nodeValue.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(RE, (m, k) => spriteImg(k));
    n.replaceWith(...span.childNodes);
  }
}
