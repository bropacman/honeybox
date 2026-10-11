// The TV (host) screen: owns the Game, talks to phones, renders the big picture.

import { Game, MINIGAMES, LENGTHS, TIMERS, CLOCK, STAKES, NARRATED, ANSWER_PHASES, FINALES, EVENTS, CATEGORIES, POT, SIX_AM, STAKE, CHIP_MS, REVEAL_STEP, SPIN_MS, revealAt } from './game.js';
import { startHost, newRoomCode } from './net.js';
import { sfx, say, unlockAudio, setMuted, isMuted, characterSound, setMusic, isSpeaking, stopSpeaking, voiceOptions, voiceSettings, setVoice, setStyle, STYLES } from './audio.js';
import { drawStrokes } from './draw.js';
import { PILE_ICONS } from './content.js';

const SAVE_KEY = 'honeybox_host_save';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const params = new URLSearchParams(location.search);
const SPEED = Number(params.get('speed')) || 1;
const MIN_PLAYERS = params.has('dev') ? 1 : 2;
// background music mood for each phase (anything missing is silence)
const MUSIC = {
  intro: 'dread', turnStart: 'tense', pick: 'tense', tot: 'tense', totReveal: 'tense', decide: 'tense', decideReveal: 'tense',
  dragged: 'dread', mgIntro: 'dread', mgResult: 'dread',
  triviaQ: 'quiz', triviaA: 'quiz', pollQ: 'quiz', pollA: 'quiz', drawDraw: 'quiz', drawFib: 'quiz', drawVote: 'quiz', drawReveal: 'quiz', drawGallery: 'quiz',
  finalePick: 'tense', finaleIntro: 'sunrise', finaleQ: 'sunrise', finaleA: 'sunrise', stakesIntro: 'sunrise', stakesBet: 'sunrise', stakesReveal: 'sunrise'
};

export function savedGame() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (raw && raw.S.spots && Date.now() - raw.at < 4 * 3600 * 1000 && raw.S.phase !== 'lobby' && raw.S.phase !== 'end') return raw.S;
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
      if (res.swapped) net.send(connId, { t: 'toast', text: `${avatar} was taken, so you're ${res.avatar} now. Change it in the lobby!` });
      connToPlayer.set(connId, pid);
      playerToConn.set(pid, connId);
      lastSent.delete(pid);
      sendViews(true);
      return;
    }
    const pid = connToPlayer.get(connId);
    if (!pid) return;
    switch (msg.t) {
      case 'pick': game.chooseSpot(pid, Number(msg.i)); break;
      case 'decide': game.decide(pid, String(msg.choice || '')); break;
      case 'answer':
        if (game.S.phase === 'drawVote') game.vote(pid, Number(msg.i));
        else game.answer(pid, Number(msg.i));
        break;
      case 'drawing': game.submitDrawing(pid, msg.strokes); break;
      case 'stake': game.stake(pid, Number(msg.i)); break;
      case 'finale': game.chooseFinale(pid, String(msg.choice || '')); break;
      case 'vip': {
        if (game.vipId() !== pid) break;
        const S = game.S;
        if (msg.a === 'start' && S.phase === 'lobby' && S.players.length >= MIN_PLAYERS) { unlockAudio(); game.start(); }
        if (msg.a === 'length') game.setLength(msg.len);
        if (msg.a === 'pause') game.togglePause();
        if (msg.a === 'skip') { stopSpeaking(); game.skip(); }
        if (msg.a === 'again' && S.phase === 'end') game.restart();
        if (msg.a === 'lobby' && S.phase !== 'lobby') { stopSpeaking(); game.restart(); }
        break;
      }
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
    else if (type === 'mood') {
      const p = game.player(data.pid);
      if (!p) return;
      if (data.tv) characterSound(p.avatar, data.mood, (data.delay || 0) * Math.min(1, SPEED * 4));
      const connId = playerToConn.get(p.id);
      if (connId) net.send(connId, { t: 'mood', mood: data.mood, delay: data.delay || 0 });
    }
  });

  // timers, plus the last-10-seconds hurry-up: faster music, a ticking clock, red edges, big final numbers
  let lastSec = null;
  let hurriedPhase = null;
  let hurryOn = false;
  setInterval(() => {
    game.speaking = SPEED >= 1 && isSpeaking();
    game.tick();
    const left = game.timeLeft();
    const S = game.S;
    const answering = ANSWER_PHASES.includes(S.phase) && !game.isPaused() && left != null;
    const hurry = answering && left < 10000 && left > 0 && game.waitingOn().length > 0;
    hurryOn = hurry;
    const tv = root.querySelector('.tv');
    tv?.classList.toggle('hurry', hurry);
    const el = root.querySelector('#timer');
    const s = left == null ? '' : Math.ceil(left / 1000);
    if (el) {
      el.textContent = game.isPaused() ? '⏸' : game.isNarrated() ? '' : s;
      el.classList.toggle('urgent', hurry);
    }
    const big = root.querySelector('#final-count');
    if (big) big.textContent = hurry && s <= 3 ? s : '';
    if (hurry) {
      if (hurriedPhase !== `${S.phase}:${S.deadline}`) {
        hurriedPhase = `${S.phase}:${S.deadline}`;
        setMusic('panic');
        if (!isSpeaking()) say('Ten seconds!');
      }
      if (s !== lastSec && s > 0) (s <= 3 ? sfx.tick() : sfx.clock());
    } else if (hurriedPhase && !answering) {
      hurriedPhase = null;
      setMusic(hurryOn ? 'panic' : (MUSIC[S.phase] || 'none'));
    }
    lastSec = s;
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
    if (act === 'timers') game.setTimers(b.dataset.t);
    if (act === 'cat') game.toggleCategory(b.dataset.cat);
    if (act === 'kick') game.kick(b.dataset.id);
    if (act === 'pause') game.togglePause();
    if (act === 'skip') { stopSpeaking(); game.skip(); }
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
      <div class="score-row ${p.connected ? '' : 'off'}" style="animation-delay:${big ? (ranked.length - 1 - i) * 0.7 : 0}s">
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
    const piles = S.spots.map((sp, i) => {
      const hidden = S.event === 'outage' && i !== highlight;
      const c = CATEGORIES[sp.cat];
      const st = game.stakesNow(i);
      const [x, y] = SPOTS[sp.name] || [12 + (i % 3) * 38, 18 + Math.floor(i / 3) * 32];
      return `<div class="spot cat-spot ${i === highlight ? 'hl' : ''} ${st.haunted ? 'haunted' : ''}" style="left:${x}%;top:${y}%">
        ${st.haunted ? `<div class="lurker" title="${esc(S.monster.name)}">${S.monster.emoji}</div>` : ''}
        <div class="cat-badge">${hidden ? '❓' : c.emoji}</div>
        <div class="cat-name">${hidden ? 'Mystery' : esc(c.name)}</div>
        <div class="pile-name">${PILE_ICONS[sp.name] || ''} ${esc(sp.name)}</div>
      </div>`;
    }).join('');
    return `<div class="map ${S.event === 'outage' ? 'outage' : ''}">
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

  // This or That: two big options; on reveal, each player's pick pops in one by one, then the right one lights up
  function totBoard(q, order, answers, starId) {
    const at = order ? revealAt(order.length) : 0;
    const chips = (i) => !order ? '' : order.map((id, k) => {
      if (answers[id] !== i) return '';
      const p = game.player(id);
      if (!p) return '';
      return `<span class="pick-chip ${id === starId ? 'star' : ''}" style="animation-delay:${k * CHIP_MS}ms">${p.avatar} ${esc(p.name)}</span>`;
    }).join('');
    return `<h1 class="tot-q">${esc(q.q)}</h1>
      <div class="tot">${q.opts.map((o, i) => `
        <div class="tot-opt ${order ? (i === q.ans ? 'right-n' : 'wrong-n') : ''}" style="--at:${at}ms">
          <span class="letter">${'AB'[i]}</span><span class="tot-text">${esc(o)}</span>
          <div class="chips">${chips(i)}</div>
        </div>${i === 0 ? '<div class="tot-or">or</div>' : ''}`).join('')}
      </div>`;
  }

  function potMeter(w) {
    return `<div class="pot-meter">🍯 Pot: <b>${w.pot}</b> · next right answer: <b class="win">+${game.potValue(w.streak)}</b></div>`;
  }

  // a quick full-screen title card when a category, minigame or finale begins
  let lastSplash = null;
  function splashFor(S) {
    const card = (emoji, title, sub = '', cls = '') => `<div class="splash ${cls}"><div class="splash-in"><span class="sp-emoji">${emoji}</span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;
    if (S.phase === 'tot') { const c = CATEGORIES[S.watch.q.cat]; return card(c.emoji, c.name, S.watch.st?.haunted ? `${S.monster.emoji} haunted!` : '', `cat-${S.watch.q.cat}`); }
    if (S.phase === 'stakesBet') { const c = CATEGORIES[S.mg.q.cat]; return card('🌅', `For ${STAKES.values[S.mg.round - 1]} honey`, `${c.emoji} ${c.name}`, 'sunrise'); }
    if (S.phase === 'mgIntro') { const m = S.mg.finale ? FINALES[S.mg.type] : MINIGAMES[S.mg.type]; return card(m.emoji, m.name, S.mg.finale ? 'Finale · double honey' : 'Into the woods…', `mg-${S.mg.type}`); }
    if (S.phase === 'finalePick') return card('🌅', '5 AM', 'Last light…', 'sunrise');
    if (S.phase === 'decide') return card('🤔', 'Bank it… or keep going?', '', 'decide-sp');
    return '';
  }

  // the turn wheel: spins once per turn (re-renders show it already stopped)
  let spunFor = null;
  function wheel(wh, winnerId) {
    const ids = (wh?.ids?.length ? wh.ids : [winnerId]).filter(id => game.player(id));
    const n = ids.length;
    const seg = 360 / n;
    const win = Math.max(0, ids.indexOf(winnerId));
    const jitter = ((wh?.spin ?? 0.5) - 0.5) * seg * 0.6;
    const end = 360 * 6 - (win * seg + seg / 2) + jitter;
    const key = `${game.S.turnIdx}`;
    const fresh = spunFor !== key;
    spunFor = key;
    const colors = ['#2e5c43', '#6b4a24', '#24425c', '#5c2e45', '#4a5c24', '#5c4a24', '#2e3f5c', '#5c3a24'];
    const stops = ids.map((_, i) => `${colors[i % colors.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ');
    const labels = ids.map((id, i) => {
      const p = game.player(id);
      return `<div class="wl" style="transform: rotate(${i * seg + seg / 2}deg) translateY(-34vh)"><span style="transform: rotate(${-(i * seg + seg / 2)}deg)">${p.avatar}<small>${esc(p.name)}</small></span></div>`;
    }).join('');
    return `<div class="wheel-wrap"><div class="wheel-pointer">▼</div>
      <div class="wheel ${fresh ? 'spinning' : ''}" style="--end:${end}deg; transform: rotate(${end}deg); background: conic-gradient(${stops})">${labels}<div class="wheel-hub">🍯</div></div>
    </div>`;
  }

  function eventCard(big) {
    const ev = EVENTS[game.S.event];
    if (!ev) return '';
    return big
      ? `<div class="event-card"><span class="ev-emoji">${ev.emoji}</span><div><b>${esc(ev.name)}</b><p>${esc(ev.text)}</p></div></div>`
      : `<span class="event-chip">${ev.emoji} ${esc(ev.name)}</span>`;
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
            <div class="cat-toggles">Categories:
              ${Object.keys(CATEGORIES).filter(c => c !== 'wild').map(c => `<button data-act="cat" data-cat="${c}" class="${(S.offCats || []).includes(c) ? 'off' : 'sel'}">${CATEGORIES[c].emoji} ${CATEGORIES[c].name}</button>`).join('')}
            </div>
            <div class="lengths">Timers:
              ${Object.keys(TIMERS).map(t => `<button data-act="timers" data-t="${t}" class="${S.timers === t ? 'sel' : ''}">${t}</button>`).join('')}
            </div>
            <div class="lengths">Game length:
              ${Object.keys(LENGTHS).map(l => `<button data-act="length" data-len="${l}" class="${S.length === l ? 'sel' : ''}">${l}</button>`).join('')}
            </div>
            <div class="voice-row">Narrator:
              <select id="voice">${voiceOptions().map(v => `<option value="${esc(v.name)}" ${v.name === voiceSettings().voice ? 'selected' : ''}>${esc(v.label)}</option>`).join('') || '<option>Default</option>'}</select>
              ${Object.keys(STYLES).map(k => `<button data-act="style" data-style="${k}" class="${voiceSettings().style === k ? 'sel' : ''}">${STYLES[k].label}</button>`).join('')}
              <button data-act="testvoice">▶ Test</button>
            </div>
            <button class="big-btn" data-act="start" ${S.players.length >= MIN_PLAYERS ? '' : 'disabled'}>Start the night 🔥</button>
            <p class="muted small">Best with 3–8 players. ${S.players[0] ? `⭐ VIP ${esc(game.player(game.vipId())?.name || '')} can also start, pause and skip from their phone.` : 'The first player to join becomes the ⭐ VIP.'}</p>
            <p class="muted small">Space = pause · N = skip · click a camper to remove them</p>
          </div>
        </div>`;
      }
      case 'intro':
        return `<div class="center howto">
          <h1>How to Play</h1>
          <p class="muted">The cabin is surrounded. The animatronics are awake. Survive until sunrise with the most 🍯 honey.</p>
          <ol class="steps">
            <li><span>🔦</span><div><b>Take turns on the night shift.</b> Each round, one player is up.</div></li>
            <li><span>🗺️</span><div><b>Pick a category, answer This or That.</b> The night shift picks a spot on the map and answers on their phone. <b>Everyone else answers too</b>: +${game.sideRight()} if right, no risk.</div></li>
            <li><span>🍯</span><div><b>Right answers fill your pot</b> (+${POT.join(', +')}). After each one: <b>🏠 bank it</b> and end your turn safely, or <b>🔦 keep going</b>. Everyone else guesses which you'll pick.</div></li>
            <li><span>🌅</span><div><b>3 in a row = 6 AM</b>: you keep the pot plus a +${SIX_AM} bonus.</div></li>
            <li><span>💀</span><div><b>Miss and you drop the pot</b> and get dragged off. Everyone plays a mini-game; you have to do well in it to escape.</div></li>
            <li><span>🏆</span><div><b>Sunrise finale:</b> last place picks the final game. Most honey wins!</div></li>
          </ol>
        </div>`;
      case 'turnStart':
        return `<div class="center turn-start">
          <p class="muted big">NIGHT ${S.turnIdx + 1} of ${S.turnOrder.length}</p>
          ${wheel(S.wheel, w.watcherId)}
          <div class="late-n" style="--at:${SPIN_MS}ms">
            <h1>${avatar(watcher)} is on the night shift!</h1>
            ${eventCard(true)}
          </div>
        </div>`;
      case 'pick':
        return `<div class="watch pick-layout">
          ${board(null)}
          <div class="pick-info">
            <h2>${avatar(watcher)} is picking a category…</h2>
            ${streakDots(w.streak)}
            ${potMeter(w)}
            ${eventCard(false)}
            <p class="lurk-note">${S.monster.emoji} <b>${esc(S.monster.name)}</b> lurks at ${esc(S.spots[S.monster.spot].name)}: miss there = double stake, right = <b class="win">+${game.stakesNow(S.monster.spot).banish} banish!</b></p>
          </div>
        </div>`;
      case 'tot': case 'totReveal': {
        const reveal = S.phase === 'totReveal';
        const q = w.q;
        const c = CATEGORIES[q.cat];
        const mine = w.answers[w.watcherId];
        const ok = reveal && w.results[w.watcherId];
        const verdict = !reveal ? '' : w.saved ? '🐕 SAVED BY THE DOGS!' : w.banished ? `⚡ BANISHED ${S.monster.emoji}!` : ok ? (w.streak >= 3 ? '🌅 6 AM!' : '✅ RIGHT!') : '💀 WRONG!';
        return `<div class="watch">
          <div class="watch-head"><h2>${avatar(watcher)} at ${esc(S.spots[w.spot].name)} · <span class="cat-chip">${c.emoji} ${esc(c.name)}</span></h2>${streakDots(w.streak - (ok ? 1 : 0))}</div>
          ${totBoard(q, reveal ? w.order : null, w.answers, w.watcherId)}
          ${reveal
            ? `<div class="vs result late-n ${ok || w.saved ? 'ok' : 'bad'}" style="--at:${revealAt(w.order.length)}ms">${verdict}</div>${q.note ? `<p class="fact late-n" style="--at:${revealAt(w.order.length) + 400}ms">💡 ${esc(q.note)}</p>` : ''}`
            : `<div class="medals">
                <div class="medal win-m"><span class="m-icon">✅</span><span class="m-big">+${w.st.win}</span><span class="m-sub">into the pot</span></div>
                <div class="medal same-m"><span class="m-icon">🍯</span><span class="m-big">${w.pot}</span><span class="m-sub">pot so far</span></div>
                <div class="medal risk-m"><span class="m-icon">💀</span><span class="m-big">−${w.pot}</span><span class="m-sub">${w.st.haunted ? `${S.monster.emoji} haunted: dragged off, ${w.st.risk} at stake` : 'miss = drop the pot, dragged off'}</span></div>
                ${w.st.haunted ? `<div class="medal banish-m"><span class="m-icon">⚡</span><span class="m-big">+${w.st.banish}</span><span class="m-sub">banish ${S.monster.emoji}</span></div>` : ''}
              </div>
              <div class="side-note">Everyone else: right answer <b class="win">+${game.sideRight()}</b> ${eventCard(false)}</div>
              ${waitingStrip()}`}
        </div>`;
      }
      case 'decide': case 'decideReveal': {
        const reveal = S.phase === 'decideReveal';
        const bank = w.decision === 'bank';
        const preds = (choice) => Object.entries(w.preds).filter(([, p]) => p === choice).map(([id]) => game.player(id)).filter(Boolean);
        return `<div class="center decide">
          <h2>${avatar(watcher)} has <span class="pot-big">${w.pot} 🍯</span> in the pot</h2>
          ${streakDots(w.streak)}
          <div class="choice-cards">
            <div class="choice-card bank ${reveal && bank ? 'chosen' : ''} ${reveal && !bank ? 'faded' : ''}">
              <span class="emoji-xl">🏠</span><b>BANK IT</b><small>Keep ${w.pot} 🍯, end the shift safely</small>
              ${reveal ? `<div class="pred">${preds('bank').map(p => `${p.avatar}${gainTag(p.id)}`).join(' ')}</div>` : ''}
            </div>
            <div class="choice-card keep ${reveal && !bank ? 'chosen' : ''} ${reveal && bank ? 'faded' : ''}">
              <span class="emoji-xl">🔦</span><b>KEEP GOING</b><small>Next right: +${game.potValue(w.streak)} · miss: lose it all</small>
              ${reveal ? `<div class="pred">${preds('keep').map(p => `${p.avatar}${gainTag(p.id)}`).join(' ')}</div>` : ''}
            </div>
          </div>
          ${reveal ? `<p class="big">${bank ? `🏠 ${esc(watcher?.name)} banks it!` : `🔦 ${esc(watcher?.name)} keeps going!`}</p>` : `<p class="muted">Everyone else: predict what they'll do (+${game.sidePredict()})</p>${waitingStrip()}`}
        </div>`;
      }
      case 'safe':
        return `<div class="center">
          <div class="emoji-xl bounce">🌅🏠🐕🐕</div>
          <h1>6 AM! ${avatar(watcher)} survived the night shift!</h1>
          <p class="big">${w.pot} 🍯 pot + ${SIX_AM} bonus</p>
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
          ${mg.finale ? '<p class="big win">🌅 FINALE · DOUBLE HONEY</p>' : `<p>Captured: ${avatar(lost)} ${S.danger ? S.danger.emoji : ''} · ${S.lost.stake} 🍯 at stake</p>`}
        </div>`;
      }
      case 'triviaQ': case 'finaleQ': case 'pollQ': {
        const q = mg.questions[mg.qi];
        const poll = S.phase === 'pollQ';
        const choices = poll ? game.pollChoices(q) : q.c;
        const title = poll ? '📋 Cabin Census' : S.phase === 'finaleQ' ? '🐻 Trivia Blitz · double honey' : '🐻 Bear Trivia';
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
          <div class="quiz-head">${S.phase === 'finaleA' ? '🐻 Trivia Blitz' : '🐻 Bear Trivia'} <span class="muted">${mg.qi + 1}/${mg.questions.length}</span></div>
          <h1 class="q">${esc(q.q)}</h1>
          <div class="answers reveal-q2" style="--at:${revealAt((mg.order || []).length)}ms">${q.c.map((c, i) => {
            const chips = (mg.order || []).map((id, k) => {
              const p = game.player(id);
              return p && mg.answers[id].i === i ? `<span class="pick-chip" style="animation-delay:${k * CHIP_MS}ms">${p.avatar}${gainTag(p.id)}</span>` : '';
            }).join('');
            return `<div class="ans ${i === q.a ? 'right-n' : 'wrong-n'}"><span class="letter">${'ABCD'[i]}</span>${esc(c)}<span class="voters">${chips}</span></div>`;
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
          <div class="bars reveal-poll" style="--last:${choices.length}">${choices.map((c, i) => {
            const who = Object.entries(mg.answers).filter(([, a]) => a.i === i).map(([id]) => game.player(id)).filter(Boolean);
            const top = q.top > 0 && q.counts[i] === q.top;
            const rank = choices.map((_, j) => j).sort((a, b) => q.counts[a] - q.counts[b]).indexOf(i);
            return `<div class="bar ${top ? 'right' : ''}" style="--i:${rank}"><div class="fill" style="width:${(q.counts[i] / total) * 100}%"></div>
              <span class="bl">${esc(c)}</span><span class="voters">${who.map(p => `${p.avatar}${gainTag(p.id)}`).join(' ')}</span><span class="cnt">${q.counts[i]}</span></div>`;
          }).join('')}</div>
        </div>`;
      }
      case 'drawDraw':
        return `<div class="center">
          <div class="emoji-xl">🖍️</div>
          <h1>Sketchy Woods</h1>
          <p class="big">Everyone: draw your secret prompt on your phone!</p>
          ${mg.finale ? '<p class="big win">🌅 Finale · double honey</p>' : `<p>Captured: ${avatar(lost)} — someone needs to guess your drawing or you lose ${S.lost.stake} 🍯.</p>`}
          ${waitingStrip()}
        </div>`;
      case 'drawFib': case 'drawVote': case 'drawReveal': {
        const artist = game.player(game.artistId());
        let side = '';
        if (S.phase === 'drawFib') {
          side = `<h2>What is this masterpiece? 🤔</h2><p class="big">Write a <b>fake title</b> on your phone.</p><p class="muted">Fool the others: points for every vote your lie gets.</p>${waitingStrip()}`;
        } else if (S.phase === 'drawVote') {
          side = `<h2>Which is the real title?</h2><div class="opts">${mg.options.map(o => `<div class="opt">${esc(o.text)}</div>`).join('')}</div>${waitingStrip()}`;
        } else {
          const order = (mg.revealSeq || mg.options.map((_, i) => i)).map(i => [mg.options[i], i]);
          side = `<h2>The reveal</h2><div class="opts">${order.map(([o, i], k) => {
            const voters = Object.entries(mg.votes).filter(([, v]) => v === i).map(([id]) => game.player(id)).filter(Boolean);
            const owners = o.owners.map(id => game.player(id)).filter(Boolean);
            const by = o.real ? `the truth, drawn by ${artist?.avatar} ${esc(artist?.name)}` : o.house ? 'a house lie' : `lie by ${owners.map(p => `${p.avatar} ${esc(p.name)}`).join(', ')}`;
            return `<div class="opt reveal ${o.real ? 'right' : ''}" style="animation-delay:${k * REVEAL_STEP}ms"><b>${esc(o.text)}</b><small>${by}</small><span class="voters">${voters.length ? `fooled: ${voters.map(p => p.avatar).join(' ')}` : '—'}</span></div>`;
          }).join('')}</div>${Object.keys(S.gains).length ? `<div class="gains-line late-n" style="--at:${order.length * REVEAL_STEP}ms">${Object.keys(S.gains).map(id => `${game.player(id)?.avatar} ${gainTag(id)}`).join(' · ')}</div>` : ''}`;
        }
        return `<div class="drawful">
          <div class="art"><canvas id="art" width="640" height="640"></canvas><p>by ${avatar(artist)}${S.lost && artist?.id === S.lost.pid ? ' <span class="lost-tag">captured</span>' : ''}</p></div>
          <div class="side">${side}</div>
        </div>`;
      }
      case 'drawGallery':
        return `<div class="center"><h1>🖼️ The Gallery</h1><p class="muted">No time to judge these masterpieces, but they deserve to be seen.</p>
          <div class="gallery">${mg.gallery.map(id => {
            const p = game.player(id);
            return `<div class="frame"><canvas data-artist="${esc(id)}" width="320" height="320"></canvas><b>${esc(mg.prompts[id])}</b><small>${p ? `${p.avatar} ${esc(p.name)}` : ''}</small></div>`;
          }).join('')}</div></div>`;
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
          <h1>🐻 Trivia Blitz</h1>
          <p class="big">Chosen by ${avatar(game.player(mg.chosenBy))}. Five questions. Double honey.</p>
        </div>`;
      case 'finalePick': {
        const picker = game.player(mg.picker);
        return `<div class="center">
          <div class="emoji-xl">🌅</div>
          <h1>5 AM · Last Light</h1>
          <p class="big">${avatar(picker)} is in last place… so they choose how the night ends.</p>
          <div class="finale-opts">${mg.options.map(k => `<div class="finale-opt"><span class="emoji-xl">${FINALES[k].emoji}</span><b>${FINALES[k].name}</b><small>${esc(FINALES[k].blurb)}</small></div>`).join('')}</div>
        </div>`;
      }
      case 'stakesIntro': {
        const boosted = mg.boosted.map(id => game.player(id)).filter(Boolean);
        return `<div class="center story">
          <div class="emoji-xl">🌅🎰🌅</div>
          <h1>Sunrise Stakes</h1>
          <p>Five last <b>This or That</b> questions before dawn, for everyone. Each one is worth more:</p>
          <div class="ladder">${STAKES.values.map((v, i) => `<span class="${i === STAKES.values.length - 1 ? 'big-card' : ''}">🍯 ${v}</span>`).join('')}</div>
          <p>Right = win it. Wrong = lose it.</p>
          ${boosted.length ? `<p>Comeback boost (1.5× on wins): ${boosted.map(p => avatar(p)).join(' ')}</p>` : ''}
          <p class="muted">Scores stay secret until sunrise.</p>
        </div>`;
      }
      case 'stakesBet': case 'stakesReveal': {
        const reveal = S.phase === 'stakesReveal';
        const q = mg.q;
        const c = CATEGORIES[q.cat];
        const answers = Object.fromEntries(Object.entries(mg.bets).map(([id, b]) => [id, b.i]));
        return `<div class="watch">
          <div class="watch-head"><h2>🌅 Sunrise Stakes · question ${mg.round} of ${mg.rounds} · <span class="cat-chip">${c.emoji} ${esc(c.name)}</span></h2><div class="stake-val">±${STAKES.values[mg.round - 1]} 🍯</div></div>
          ${totBoard(q, reveal ? mg.order : null, answers, null)}
          ${reveal ? (q.note ? `<p class="fact late-n" style="--at:${revealAt(mg.order.length) + 400}ms">💡 ${esc(q.note)}</p>` : '') : waitingStrip()}
        </div>`;
      }
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
    const splashKey = `${S.phase}:${S.turnIdx}:${S.watch?.streak}:${S.watch?.spot}:${S.mg?.type}:${S.mg?.round}:${S.mg?.qi}`;
    const splash = splashKey !== lastSplash ? splashFor(S) : '';
    if (splash) { lastSplash = splashKey; sfx.whoosh(); }
    setMusic(hurryOn ? 'panic' : (MUSIC[S.phase] || 'none'));
    const showSide = !['lobby', 'end', 'scores', 'intro'].includes(S.phase);
    root.innerHTML = `
      <div class="tv phase-${S.phase} ${hurryOn ? 'hurry' : ''}">
        <div id="final-count" class="final-count"></div>
        ${splash}
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

    root.querySelectorAll('canvas[data-artist]').forEach(c => drawStrokes(c, S.mg?.drawings?.[c.dataset.artist] || []));
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
