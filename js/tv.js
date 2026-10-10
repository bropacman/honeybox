// The TV (host) screen: owns the Game, talks to phones, renders the big picture.

import { Game, MINIGAMES, LENGTHS, CLOCK } from './game.js';
import { startHost, newRoomCode } from './net.js';
import { sfx, say, unlockAudio, setMuted, isMuted, voiceOptions, voiceSettings, setVoice, setStyle, STYLES } from './audio.js';
import { drawStrokes } from './draw.js';
import { PILE_ICONS } from './content.js';

const SAVE_KEY = 'honeybox_host_save';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const params = new URLSearchParams(location.search);
const SPEED = Number(params.get('speed')) || 1;

export function savedGame() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (raw && Date.now() - raw.at < 4 * 3600 * 1000 && raw.S.phase !== 'lobby' && raw.S.phase !== 'end') return raw.S;
  } catch (e) { /* ignore */ }
  return null;
}

export function startTV(root, { resume = null } = {}) {
  unlockAudio();
  const code = resume ? resume.code : newRoomCode();
  const game = new Game(code, { speed: SPEED, saved: resume });
  if (resume) game.S.players.forEach(p => { p.connected = false; });
  const connToPlayer = new Map();
  const playerToConn = new Map();
  let lastSent = new Map();
  let ready = false;

  const joinUrl = `${location.origin}${location.pathname}`;
  const peerParam = params.get('peer') ? `&peer=${encodeURIComponent(params.get('peer'))}` : '';

  const net = startHost(code, {
    onReady: () => { ready = true; render(); },
    onFatal: (msg) => { root.innerHTML = `<div class="center"><h1>😬</h1><p>${esc(msg)}</p></div>`; },
    onData: (connId, msg) => handle(connId, msg),
    onClose: (connId) => {
      const pid = connToPlayer.get(connId);
      connToPlayer.delete(connId);
      if (pid && playerToConn.get(pid) === connId) {
        playerToConn.delete(pid);
        game.setConnected(pid, false);
      }
    }
  });

  function handle(connId, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      const pid = String(msg.pid || '').slice(0, 40);
      if (!pid) return;
      const name = String(msg.name || '').trim().slice(0, 14);
      const avatar = String(msg.avatar || '').slice(0, 8);
      const old = playerToConn.get(pid);
      if (old && old !== connId) { connToPlayer.delete(old); net.drop(old); }
      const res = game.join(pid, name, avatar);
      if (res.error) { net.send(connId, { t: 'error', text: res.error }); return; }
      connToPlayer.set(connId, pid);
      playerToConn.set(pid, connId);
      lastSent.delete(pid);
      sendViews(true);
      return;
    }
    const pid = connToPlayer.get(connId);
    if (!pid) return;
    switch (msg.t) {
      case 'pick': game.choosePile(pid, Number(msg.i)); break;
      case 'guess': game.guess(pid, msg.choice); break;
      case 'answer':
        if (game.S.phase === 'drawVote') game.vote(pid, Number(msg.i));
        else game.answer(pid, Number(msg.i));
        break;
      case 'drawing': game.submitDrawing(pid, msg.strokes); break;
      case 'avatar': game.setAvatar(pid, String(msg.avatar || '')); break;
      case 'fib': {
        const err = game.fib(pid, msg.text);
        if (err) net.send(connId, { t: 'toast', text: err });
        break;
      }
      default: break;
    }
  }

  function sendViews(force = false) {
    for (const p of game.S.players) {
      const connId = playerToConn.get(p.id);
      if (!connId) continue;
      const v = game.viewFor(p.id);
      const key = JSON.stringify(v);
      if (!force && lastSent.get(p.id) === key) continue;
      lastSent.set(p.id, key);
      net.send(connId, { t: 'view', v, ms: game.timeLeft() });
    }
  }

  game.on((type, data) => {
    if (type === 'change') {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ at: Date.now(), S: game.S })); } catch (e) { /* full */ }
      render();
      sendViews();
    } else if (type === 'sfx') sfx[data]?.();
    else if (type === 'say') say(data);
  });

  // timers
  let lastSec = null;
  setInterval(() => {
    game.tick();
    const left = game.timeLeft();
    const el = root.querySelector('#timer');
    if (el) {
      const s = left == null ? '' : Math.ceil(left / 1000);
      el.textContent = game.isPaused() ? '⏸' : s;
      el.classList.toggle('urgent', left != null && left < 5000);
      if (left != null && left < 5000 && s !== lastSec && !game.isPaused() && s > 0) sfx.tick();
      lastSec = s;
    }
  }, 200);
  // keep phone timers in sync now and then
  setInterval(() => {
    for (const p of game.S.players) {
      const connId = playerToConn.get(p.id);
      if (connId) net.send(connId, { t: 'time', ms: game.timeLeft(), paused: game.isPaused() });
    }
  }, 3000);

  root.addEventListener('change', (e) => {
    if (e.target.id === 'voice') { setVoice(e.target.value); say(STYLES[voiceSettings().style].sample); }
  });
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => { if (game.S.phase === 'lobby') render(); });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ') { e.preventDefault(); game.togglePause(); }
    if (e.key === 'n' || e.key === 'N') game.skip();
  });

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    unlockAudio();
    const act = b.dataset.act;
    if (act === 'start') game.start();
    if (act === 'length') game.setLength(b.dataset.len);
    if (act === 'kick') game.kick(b.dataset.id);
    if (act === 'pause') game.togglePause();
    if (act === 'skip') game.skip();
    if (act === 'mute') { setMuted(!isMuted()); render(); }
    if (act === 'again') game.restart();
    if (act === 'style') { setStyle(b.dataset.style); say(STYLES[b.dataset.style].sample); render(); }
    if (act === 'testvoice') say(STYLES[voiceSettings().style].sample);
    if (act === 'new') { localStorage.removeItem(SAVE_KEY); location.href = location.pathname + location.search.replace(/[?&]host=1/, ''); }
  });

  // ---------- rendering ----------
  let drawingCleanup = null;
  let shownDrawing = null;

  function card(c, cls = '') {
    if (!c) return '<div class="card back"></div>';
    const red = c.s === '♥' || c.s === '♦';
    return `<div class="card ${red ? 'red' : ''} ${cls}"><span class="r">${c.r}</span><span class="s">${c.s}</span></div>`;
  }

  function avatar(p, extra = '') {
    if (!p) return '';
    return `<span class="who ${p.connected ? '' : 'off'}">${p.avatar} ${esc(p.name)}${extra}</span>`;
  }

  function gainTag(pid) {
    const g = game.S.gains[pid];
    if (!g) return '';
    return `<span class="gain ${g < 0 ? 'neg' : ''}">${g > 0 ? '+' : ''}${g}</span>`;
  }

  function scoreboard(big = false) {
    const ranked = game.ranked();
    const delta = (p) => {
      const d = p.score - ((game.S.board || {})[p.id] || 0);
      return d ? `<span class="gain ${d < 0 ? 'neg' : ''}">${d > 0 ? '+' : ''}${d}</span>` : '';
    };
    return `<div class="scoreboard ${big ? 'big' : ''}">${ranked.map((p, i) => `
      <div class="score-row ${p.connected ? '' : 'off'}">
        <span class="rank">${i + 1}</span><span class="av">${p.avatar}</span>
        <span class="nm">${esc(p.name)}</span><span class="pts">${p.score} 🍯${big ? delta(p) : gainTag(p.id)}</span>
      </div>`).join('')}</div>`;
  }

  function waitingStrip() {
    const ids = game.waitingOn();
    const S = game.S;
    const relevant = S.players.filter(p => p.connected);
    if (!relevant.length) return '';
    return `<div class="locks">${relevant.map(p => {
      const done = !ids.includes(p.id);
      return `<span class="lock ${done ? 'done' : ''}">${p.avatar}<small>${esc(p.name)}</small></span>`;
    }).join('')}</div>`;
  }

  // Where each pile sits on the TV map (percent of the map box). Roughly NH geography.
  const SPOTS = {
    "Santa's Village": [36, 12], 'Mt Washington': [60, 18], 'Flume Gorge': [12, 22],
    "Clark's Bears": [22, 48], 'The Kanc': [46, 48], 'Story Land': [80, 34],
    'Funspot': [14, 76], 'Weirs Beach': [36, 82], 'Lake Dock': [62, 80]
  };

  function board(highlight = null) {
    const S = game.S;
    const piles = S.piles.map((p, i) => {
      const top = p.cards[p.cards.length - 1];
      const [x, y] = SPOTS[p.name] || [12 + (i % 3) * 38, 18 + Math.floor(i / 3) * 32];
      return `<div class="spot ${i === highlight ? 'hl' : ''}" style="left:${x}%;top:${y}%">
        <div class="stack" style="--depth:${Math.min(p.cards.length, 8)}">${card(top)}</div>
        <div class="pile-name">${PILE_ICONS[p.name] || ''} ${esc(p.name)}</div>
        <div class="depth">${p.cards.length} deep · ${100 * p.cards.length}🍯</div>
      </div>`;
    }).join('');
    return `<div class="map">
      <svg class="map-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><radialGradient id="lake" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#2c6a8f"/><stop offset="100%" stop-color="#173f57"/></radialGradient></defs>
        <path d="M30 34 L40 12 L46 22 L54 4 L62 18 L68 8 L78 30 Z" fill="#1d3328"/>
        <path d="M50 12 L54 4 L57 10 L55 9" fill="none" stroke="#dfe6e2" stroke-width="0.7" opacity="0.7"/>
        <path d="M0 40 L6 22 L12 34 L18 14 L26 36 Z" fill="#1a2f25"/>
        <path d="M20 100 C 22 86, 40 74, 58 78 S 86 92, 92 100 Z" fill="url(#lake)"/>
        <path d="M2 50 C 20 46, 40 52, 60 47 S 86 46, 98 50" fill="none" stroke="#3a3a33" stroke-width="3.2"/>
        <path d="M2 50 C 20 46, 40 52, 60 47 S 86 46, 98 50" fill="none" stroke="#e8c547" stroke-width="0.4" stroke-dasharray="1.6 1.6"/>
        <path d="M88 100 C 86 80, 88 62, 86 50 S 80 30, 74 22" fill="none" stroke="#3a3a33" stroke-width="2.6"/>
        <path d="M28 100 C 26 80, 24 64, 22 50 S 14 30, 12 10" fill="none" stroke="#3a3a33" stroke-width="2.6"/>
      </svg>
      <div class="deco" style="left:6%;top:58%">🌲</div><div class="deco" style="left:34%;top:62%">🌲</div>
      <div class="deco" style="left:70%;top:60%">🌲</div><div class="deco" style="left:94%;top:70%">🌲</div>
      <div class="deco" style="left:88%;top:12%">🌲</div><div class="deco" style="left:4%;top:92%">🌲</div>
      <div class="map-label" style="left:40%;top:95%">Lake Winnipesaukee</div>
      <div class="map-label" style="left:44%;top:30%">White Mountains</div>
      <div class="map-label" style="left:88%;top:54%">Conway · Rt 16</div>
      <div class="map-label" style="left:2%;top:54%">Lincoln</div>
      <div class="map-label" style="left:56%;top:42%">Kancamagus Hwy →</div>
      ${piles}
    </div>`;
  }

  function streakDots(n) {
    return `<div class="clock"><span class="now">🕛 ${CLOCK[Math.min(3, n)]}</span><span class="steps">${CLOCK.map((t, i) => `<i class="${i <= n ? 'on' : ''}">${t}</i>`).join('')}</span></div>`;
  }

  function stage() {
    const S = game.S;
    const w = S.watch;
    const watcher = w && game.player(w.watcherId);
    const lost = S.lost && game.player(S.lost.pid);
    const mg = S.mg;

    switch (S.phase) {
      case 'lobby': {
        const url = `${joinUrl}?room=${code}${peerParam}`;
        return `<div class="lobby">
          <div class="join-box">
            <h1 class="logo">Honey<span>box</span></h1>
            <p class="tag">Five nights in the NH woods. The animatronics are awake.</p>
            <div class="qr" id="qr"></div>
            <p class="join-at">On your phone, go to<br><b>${esc(joinUrl.replace(/^https?:\/\//, ''))}</b></p>
            <div class="code">${ready ? code : '····'}</div>
            ${ready ? '' : '<p class="muted">Opening the cabin…</p>'}
          </div>
          <div class="lobby-side">
            <h2>Campers (${S.players.length}/8)</h2>
            <div class="campers">${S.players.map(p => `<button class="camper ${p.connected ? '' : 'off'}" data-act="kick" data-id="${esc(p.id)}" title="Click to remove">${p.avatar}<span>${esc(p.name)}</span></button>`).join('') || '<p class="muted">Waiting for campers to join…</p>'}</div>
            <div class="lengths">Game length:
              ${Object.keys(LENGTHS).map(l => `<button data-act="length" data-len="${l}" class="${S.length === l ? 'sel' : ''}">${l}</button>`).join('')}
            </div>
            <div class="voice-row">Narrator:
              <select id="voice">${voiceOptions().map(v => `<option value="${esc(v.name)}" ${v.name === voiceSettings().voice ? 'selected' : ''}>${esc(v.label)}</option>`).join('') || '<option>Default</option>'}</select>
              ${Object.keys(STYLES).map(k => `<button data-act="style" data-style="${k}" class="${voiceSettings().style === k ? 'sel' : ''}">${STYLES[k].label}</button>`).join('')}
              <button data-act="testvoice">▶ Test</button>
            </div>
            <button class="big-btn" data-act="start" ${S.players.length >= (params.has('dev') ? 1 : 2) ? '' : 'disabled'}>Start the night 🔥</button>
            <p class="muted small">Space = pause · N = skip · click a camper to remove them</p>
          </div>
        </div>`;
      }
      case 'intro':
        return `<div class="center story">
          <div class="emoji-xl">🏚️🌲🐕🐕🌲</div>
          <h1>Five Nights at the Cabin</h1>
          <p>The family is holed up at the cabin on Lake Winnipesaukee, with Story Land, Funspot, Clark's and Santa's Village just up the road. Everything closed hours ago… but the animatronics didn't get the memo.</p>
          <p>Each round one of you takes the <b>night shift</b>. Pick a spot, then everyone calls the next card <b>HIGH</b>, <b>LOW</b> or <b>SAME</b>.</p>
          <p>Night shift: get <b>3 in a row</b> to make it to <b>6 AM</b>. A correct SAME is a 🍯 <b>Honey Pot</b> — straight to morning.</p>
          <p>Miss, and you get <b>dragged off</b>. Everyone plays a game for honey while you play to escape.</p>
        </div>`;
      case 'turnStart':
        return `<div class="center">
          <div class="emoji-xl">🔦</div>
          <p class="muted big">NIGHT ${S.turnIdx + 1} of ${S.turnOrder.length}</p>
          <h1>${avatar(watcher)} is on the night shift</h1>
          <p class="big">12 AM. Get 3 in a row to make it to 6 AM.</p>
        </div>`;
      case 'pick':
        return `<div class="watch pick-layout">
          ${board(null)}
          <div class="pick-info">
            <h2>${avatar(watcher)} is choosing where to look…</h2>
            ${streakDots(w.streak)}
            <p class="muted">Make it to 6 AM: 3 right in a row.</p>
            <p class="muted">Deeper piles pay more honey, but cost more if you get dragged off.</p>
          </div>
        </div>`;
      case 'guess': {
        const pile = S.piles[w.pile];
        return `<div class="watch">
          <div class="watch-head"><h2>${avatar(watcher)} at the <b>${esc(pile.name)}</b></h2>${streakDots(w.streak)}</div>
          <div class="duel">
            ${card(pile.cards[pile.cards.length - 1], 'huge')}
            <div class="vs">next card is…<div class="hl-opts"><span>HIGH</span><span>LOW</span><span>SAME</span></div><p class="muted">Lock in on your phone!</p></div>
            ${card(null, 'huge')}
          </div>
          ${waitingStrip()}
        </div>`;
      }
      case 'reveal': {
        const pile = S.piles[w.pile];
        const mine = w.guesses[w.watcherId];
        const ok = w.results[w.watcherId];
        const groups = ['HIGH', 'LOW', 'SAME'].map(ch => {
          const who = Object.entries(w.guesses).filter(([, c]) => c === ch).map(([id]) => game.player(id)).filter(Boolean);
          return `<div class="guess-col ${w.actual === ch ? 'right' : ''}"><h3>${ch}</h3>${who.map(p => `<div>${p.avatar} ${esc(p.name)} ${gainTag(p.id)}</div>`).join('')}</div>`;
        }).join('');
        return `<div class="watch">
          <div class="watch-head"><h2>${avatar(watcher)} said <b>${mine}</b> at the ${esc(pile.name)}</h2>${streakDots(w.streak)}</div>
          <div class="duel">
            ${card(w.top, 'huge')}
            <div class="vs result ${ok ? 'ok' : 'bad'}">${ok ? (mine === 'SAME' ? '🍯 HONEY POT!' : 'SAFE!') : w.tie ? 'TIE! The animatronics win ties.' : 'WRONG!'}</div>
            ${card(w.drawn, 'huge flip-in')}
          </div>
          <div class="guess-cols">${groups}</div>
        </div>`;
      }
      case 'safe':
        return `<div class="center">
          <div class="emoji-xl bounce">🌅🏠🐕🐕</div>
          <h1>6 AM! ${avatar(watcher)} survived the night shift!</h1>
          <p class="big">+500 🍯 escape bonus</p>
        </div>`;
      case 'dragged':
        return `<div class="center dark">
          <div class="jumpscare">${S.danger.emoji}</div>
          <h1>${avatar(lost)} got dragged off</h1>
          <p class="big">by ${esc(S.danger.name)}.</p>
          <p>At stake: <b>${S.lost.stake} 🍯</b></p>
        </div>`;
      case 'mgIntro': {
        const m = MINIGAMES[mg.type];
        return `<div class="center">
          <div class="emoji-xl">${m.emoji}</div>
          <h1>${m.name}</h1>
          <p class="big">${esc(m.rules)}</p>
          <p>Captured: ${avatar(lost)} ${S.danger ? S.danger.emoji : ''} · ${S.lost.stake} 🍯 at stake</p>
        </div>`;
      }
      case 'triviaQ': case 'finaleQ': case 'pollQ': {
        const q = mg.questions[mg.qi];
        const poll = S.phase === 'pollQ';
        const choices = poll ? game.pollChoices(q) : q.c;
        const title = poll ? '📋 Cabin Census' : S.phase === 'finaleQ' ? '🌅 Last Light · double honey' : '🐻 Bear Trivia';
        return `<div class="quiz">
          <div class="quiz-head">${title} <span class="muted">${mg.qi + 1}/${mg.questions.length}</span>${lost && !poll && S.phase !== 'finaleQ' ? ` · captured: ${avatar(lost)}` : ''}${lost && poll ? ` · captured: ${avatar(lost)}` : ''}</div>
          <h1 class="q">${esc(q.q)}</h1>
          ${poll ? '<p class="muted">Pick what you think MOST people will pick.</p>' : ''}
          <div class="answers ${choices.length > 4 ? 'many' : ''}">${choices.map((c, i) => `<div class="ans"><span class="letter">${'ABCDEFGH'[i]}</span>${esc(c)}</div>`).join('')}</div>
          ${waitingStrip()}
        </div>`;
      }
      case 'triviaA': case 'finaleA': {
        const q = mg.questions[mg.qi];
        return `<div class="quiz">
          <div class="quiz-head">${S.phase === 'finaleA' ? '🌅 Last Light' : '🐻 Bear Trivia'} <span class="muted">${mg.qi + 1}/${mg.questions.length}</span></div>
          <h1 class="q">${esc(q.q)}</h1>
          <div class="answers">${q.c.map((c, i) => {
            const who = Object.entries(mg.answers).filter(([, a]) => a.i === i).map(([id]) => game.player(id)).filter(Boolean);
            return `<div class="ans ${i === q.a ? 'right' : 'dim'}"><span class="letter">${'ABCD'[i]}</span>${esc(c)}<span class="voters">${who.map(p => `${p.avatar}${gainTag(p.id)}`).join(' ')}</span></div>`;
          }).join('')}</div>
        </div>`;
      }
      case 'pollA': {
        const q = mg.questions[mg.qi];
        const choices = game.pollChoices(q);
        const total = Math.max(1, q.counts.reduce((a, b) => a + b, 0));
        return `<div class="quiz">
          <div class="quiz-head">📋 Cabin Census <span class="muted">${mg.qi + 1}/${mg.questions.length}</span></div>
          <h1 class="q">${esc(q.q)}</h1>
          <div class="bars">${choices.map((c, i) => {
            const who = Object.entries(mg.answers).filter(([, a]) => a.i === i).map(([id]) => game.player(id)).filter(Boolean);
            const top = q.top > 0 && q.counts[i] === q.top;
            return `<div class="bar ${top ? 'right' : ''}"><div class="fill" style="width:${(q.counts[i] / total) * 100}%"></div>
              <span class="bl">${esc(c)}</span><span class="voters">${who.map(p => `${p.avatar}${gainTag(p.id)}`).join(' ')}</span><span class="cnt">${q.counts[i]}</span></div>`;
          }).join('')}</div>
        </div>`;
      }
      case 'drawDraw':
        return `<div class="center">
          <div class="emoji-xl">🖍️</div>
          <h1>Sketchy Woods</h1>
          <p class="big">Everyone: draw your secret prompt on your phone!</p>
          <p>Captured: ${avatar(lost)} — someone needs to guess your drawing or you lose ${S.lost.stake} 🍯.</p>
          ${waitingStrip()}
        </div>`;
      case 'drawFib': case 'drawVote': case 'drawReveal': {
        const artist = game.player(game.artistId());
        let side = '';
        if (S.phase === 'drawFib') {
          side = `<h2>Write a fake title for this drawing</h2><p class="muted">Fool the others. Points for every vote your lie gets.</p>${waitingStrip()}`;
        } else if (S.phase === 'drawVote') {
          side = `<h2>Which is the real title?</h2><div class="opts">${mg.options.map(o => `<div class="opt">${esc(o.text)}</div>`).join('')}</div>${waitingStrip()}`;
        } else {
          side = `<h2>The reveal</h2><div class="opts">${mg.options.map((o, i) => {
            const voters = Object.entries(mg.votes).filter(([, v]) => v === i).map(([id]) => game.player(id)).filter(Boolean);
            const owners = o.owners.map(id => game.player(id)).filter(Boolean);
            const by = o.real ? `the truth, drawn by ${artist?.avatar} ${esc(artist?.name)}` : o.house ? 'a house lie' : `lie by ${owners.map(p => `${p.avatar} ${esc(p.name)}`).join(', ')}`;
            return `<div class="opt reveal ${o.real ? 'right' : ''}" style="animation-delay:${i * 0.6}s"><b>${esc(o.text)}</b><small>${by}</small><span class="voters">${voters.map(p => p.avatar).join(' ') || '—'}</span></div>`;
          }).join('')}</div>${Object.keys(S.gains).length ? `<div class="gains-line">${Object.keys(S.gains).map(id => `${game.player(id)?.avatar} ${gainTag(id)}`).join(' · ')}</div>` : ''}`;
        }
        return `<div class="drawful">
          <div class="art"><canvas id="art" width="640" height="640"></canvas><p>by ${avatar(artist)}${artist?.id === S.lost.pid ? ' <span class="lost-tag">captured</span>' : ''}</p></div>
          <div class="side">${side}</div>
        </div>`;
      }
      case 'mgResult':
        return `<div class="center ${mg.result ? '' : 'dark'}">
          <div class="emoji-xl ${mg.result ? 'bounce' : 'shake'}">${mg.result ? '🏠🔥' : '💀🌲'}</div>
          <h1>${avatar(lost)} ${mg.result ? 'escaped!' : 'is still captured…'}</h1>
          <p class="big">${mg.result ? '+300 🍯' : `−${S.lost.stake} 🍯 lost to the animatronics`}</p>
        </div>`;
      case 'scores':
        return `<div class="center"><div class="emoji-xl">🍯</div><h1>Honey Count</h1>${scoreboard(true)}<p class="muted">Night ${S.turnIdx + 1} of ${S.turnOrder.length} survived</p></div>`;
      case 'finaleIntro':
        return `<div class="center">
          <div class="emoji-xl">🌅</div>
          <h1>Last Light</h1>
          <p class="big">The sun is almost up. Five final questions. Double honey.</p>
        </div>`;
      case 'end': {
        const r = game.ranked();
        return `<div class="center">
          <div class="emoji-xl bounce">🌄🏆🐕🐕</div>
          <h1>${r[0] ? `${r[0].avatar} ${esc(r[0].name)} survived the night!` : 'Dawn breaks.'}</h1>
          ${scoreboard(true)}
          <div class="row"><button class="big-btn" data-act="again">Play again (same campers)</button><button data-act="new">New room</button></div>
        </div>`;
      }
      default: return '';
    }
  }

  function render() {
    const S = game.S;
    const showSide = !['lobby', 'end', 'scores', 'intro'].includes(S.phase);
    root.innerHTML = `
      <div class="tv phase-${S.phase}">
        <div class="tv-main">${stage()}</div>
        ${showSide ? `<div class="mini-code">${code}</div>` : ''}
        <div id="timer" class="timer"></div>
        <div class="host-ctl">
          <button data-act="mute" title="Sound">${isMuted() ? '🔇' : '🔊'}</button>
          ${S.phase !== 'lobby' && S.phase !== 'end' ? `<button data-act="pause" title="Pause (space)">${game.isPaused() ? '▶️' : '⏸'}</button><button data-act="skip" title="Skip (N)">⏭</button>` : ''}
        </div>
        ${game.isPaused() ? '<div class="paused">PAUSED</div>' : ''}
      </div>`;

    if (S.phase === 'lobby') {
      const el = root.querySelector('#qr');
      if (el && window.qrcode && ready) {
        const qr = window.qrcode(0, 'M');
        qr.addData(`${joinUrl}?room=${code}${peerParam}`);
        qr.make();
        el.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
      }
    }

    const canvas = root.querySelector('#art');
    if (canvas) {
      const id = `${S.turnIdx}-${S.mg.di}`;
      drawingCleanup?.();
      const strokes = S.mg.drawings[game.artistId()] || [];
      drawingCleanup = drawStrokes(canvas, strokes, { animate: shownDrawing !== id });
      shownDrawing = id;
    }
  }

  render();
  window.__honeybox = game; // handy for debugging from the console
  return game;
}
