// The TV (host) screen: owns the Game, talks to phones, renders the big picture.

import { Game, MINIGAMES, LENGTHS, TIMERS, CLOCK, STAKES, NARRATED, ANSWER_PHASES, FINALES, EVENTS, CATEGORIES, POT, SIX_AM, STAKE, CHIP_MS, REVEAL_STEP, SPIN_MS, SEARCH_MS, GUESS_STEP, DOOR_STEP, ZOOM_POINTS, revealAt } from './game.js';
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
  triviaQ: 'quiz', triviaA: 'quiz', pollQ: 'quiz', pollA: 'quiz', hideQ: 'tense', hideA: 'dread', doorQ: 'tense', doorA: 'tense', zoomQ: 'quiz', zoomA: 'quiz', guessQ: 'quiz', guessA: 'quiz', drawDraw: 'quiz', drawFib: 'quiz', drawVote: 'quiz', drawReveal: 'quiz', drawGallery: 'quiz',
  finalePick: 'tense', end: 'standings', finaleIntro: 'sunrise', finaleQ: 'sunrise', finaleA: 'sunrise', stakesIntro: 'sunrise', stakesBet: 'sunrise', stakesReveal: 'sunrise'
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

  // point a phone connection at a player seat and tell the phone to remember that id
  function seat(connId, id) {
    const prev = connToPlayer.get(connId);
    if (prev && prev !== id) playerToConn.delete(prev);
    const old = playerToConn.get(id);
    if (old && old !== connId) { connToPlayer.delete(old); net.drop(old); }
    connToPlayer.set(connId, id);
    playerToConn.set(id, connId);
    net.send(connId, { t: 'adopt', pid: id });
    lastSent.delete(id);
    sendViews(true);
  }

  // host menu: someone rejoined as a new player -> merge them back into their old seat
  function mergeInto(newId, oldId) {
    const conn = playerToConn.get(newId);
    if (!game.mergePlayer(newId, oldId)) return;
    playerToConn.delete(newId);
    if (conn) seat(conn, oldId);
    toastTV(`Merged: welcome back, ${game.player(oldId)?.name}!`);
  }

  function handle(connId, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      const pid = String(msg.pid || '').slice(0, 40);
      if (!pid) return;
      const name = String(msg.name || '').trim().slice(0, 14);
      const avatar = String(msg.avatar || '').slice(0, 8);
      // a phone we don't know, mid-game, while someone is offline: probably them on a new device. Ask first.
      const offline = game.S.players.filter(p => !p.connected);
      if (!game.player(pid) && game.S.phase !== 'lobby' && !msg.fresh && offline.length) {
        net.send(connId, { t: 'whoareyou', options: offline.map(p => ({ id: p.id, name: p.name, avatar: p.avatar })) });
        return;
      }
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
    if (msg.t === 'claim') {
      // "I'm Jon": take over Jon's offline seat
      const p = game.player(String(msg.id || ''));
      if (!p || p.connected) {
        const offline = game.S.players.filter(x => !x.connected);
        net.send(connId, { t: 'whoareyou', options: offline.map(x => ({ id: x.id, name: x.name, avatar: x.avatar })) });
        return;
      }
      seat(connId, p.id);
      game.setConnected(p.id, true);
      game.emit('mood', { pid: p.id, mood: 'happy', tv: true });
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
      case 'drawDraft': game.draftDrawing(pid, msg.strokes); break;
      case 'guess': game.guess(pid, Number(msg.n)); break;
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

  // Narrated reveals (How to Play, final standings): elements with data-step="i" appear as line i starts.
  // data-fx on a step plays an effect the moment it appears.
  let stepShown = 99;
  let musicOverride = null;
  const FX = {
    drumroll: () => sfx.drumroll(),
    winner: () => {
      sfx.great();
      musicOverride = 'anthem';
      setMusic('anthem');
      const w = game.ranked()[0];
      if (w) characterSound(w.avatar, 'happy', 300);
    },
    done: () => game.revealEnd()
  };
  function showSteps(still = false) {
    document.querySelectorAll('.tv-main [data-step]').forEach(el => {
      const on = Number(el.dataset.step) < stepShown;
      if (on && !el.classList.contains('shown')) {
        if (still) el.classList.add('still');
        else if (el.dataset.fx) FX[el.dataset.fx]?.();
      }
      if (on && el.dataset.fx === 'done') FX.done();
      el.classList.toggle('shown', on);
    });
  }
  function cueLines(lines) {
    stepShown = 0;
    const cue = (i) => { stepShown = Math.max(stepShown, i + 1); showSteps(); };
    if (say(lines, cue)) return;
    // no voice: reveal on a timer instead (pauses count, lines get 3 seconds each)
    let t = 0;
    lines.forEach((line, i) => { setTimeout(() => cue(i), t); t += typeof line === 'number' ? line : 3000; });
  }

  game.on((type, data) => {
    if (type === 'change') {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ at: Date.now(), S: game.S })); } catch (e) { /* full */ }
      render();
      sendViews();
    } else if (type === 'sfx') sfx[data]?.();
    else if (type === 'say') {
      if (Array.isArray(data)) {
        cueLines(data);
      } else say(data);
    }
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
    const worth = root.querySelector('#zoom-worth');
    if (worth && game.S.mg?.startedAt && game.S.deadline) {
      const f = (Date.now() - game.S.mg.startedAt) / Math.max(1, game.S.deadline - game.S.mg.startedAt);
      worth.textContent = `Worth ${ZOOM_POINTS[Math.min(2, Math.max(0, Math.floor(f * 3)))]} 🎟️ right now`;
    }
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
      if (S.phase !== 'end') musicOverride = null;
    setMusic(hurryOn ? 'panic' : (musicOverride || MUSIC[S.phase] || 'none'));
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
    if (e.target.dataset.merge && e.target.value) { mergeInto(e.target.dataset.merge, e.target.value); playersOpen = false; render(); return; }
    if (e.target.id === 'voice') { setVoice(e.target.value); stopSpeaking(); say(STYLES[voiceSettings().style].sample); }
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
    if (act === 'players') { playersOpen = !playersOpen; render(); }
    if (act === 'pause') game.togglePause();
    if (act === 'skip') { stopSpeaking(); game.skip(); }
    if (act === 'mute') { setMuted(!isMuted()); if (isMuted()) stepShown = 99; render(); }
    if (act === 'again') game.restart();
    if (act === 'style') { setStyle(b.dataset.style); stopSpeaking(); say(STYLES[b.dataset.style].sample); render(); }
    if (act === 'testvoice') { stopSpeaking(); say(STYLES[voiceSettings().style].sample); }
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
        <span class="nm">${esc(p.name)}</span><span class="pts">${p.score} 🎟️${big ? delta(p) : gainTag(p.id)}</span>
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
    'Cog Railway': [11, 15], 'Mt Washington': [30, 13], "Santa's Village": [50, 15], 'Discovery Center': [70, 13], 'Story Land': [89, 15],
    'Flume Gorge': [11, 46], "Clark's Bears": [30, 44], 'The Kanc': [50, 46], 'Castle in the Clouds': [70, 44], 'Settlers Green': [89, 46],
    'Funspot': [11, 77], 'Weirs Drive-In': [30, 75], 'Lake Dock': [50, 77], 'Meadowbrook': [70, 75], 'Loudon Speedway': [89, 77]
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
        ${st.golden ? '<div class="golden-tag">⭐ +' + st.golden + '</div>' : ''}
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
      <div class="map-label" style="left:2%;top:54%">Lincoln</div>
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
    return `<div class="pot-meter">🎟️ Pot: <b>${w.pot}</b> · next right answer: <b class="win">+${game.potValue(w.streak)}</b></div>`;
  }

  // a quick full-screen title card when a category, minigame or finale begins
  let lastSplash = null;
  function splashFor(S) {
    const card = (emoji, title, sub = '', cls = '') => `<div class="splash ${cls}"><div class="splash-in"><span class="sp-emoji">${emoji}</span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;
    if (S.phase === 'tot') { const c = CATEGORIES[S.watch.q.cat]; return card(c.emoji, c.name, S.watch.st?.haunted ? `${S.monster.emoji} haunted!` : '', `cat-${S.watch.q.cat}`); }
    if (S.phase === 'stakesBet') { const c = CATEGORIES[S.mg.q.cat]; return card('🌅', `For ${STAKES.values[S.mg.round - 1]} tickets`, `${c.emoji} ${c.name}`, 'sunrise'); }
    if (S.phase === 'mgIntro') { const m = S.mg.finale ? FINALES[S.mg.type] : MINIGAMES[S.mg.type]; return card(m.emoji, m.name, S.mg.finale ? 'Finale · double tickets' : 'Into the woods…', `mg-${S.mg.type}`); }
    if (S.phase === 'finalePick') return card('🌅', '5 AM', 'Last light…', 'sunrise');
    if (S.phase === 'decide') return card('🤔', 'Keep going… or hide?', '', 'decide-sp');
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
      <div class="wheel ${fresh ? 'spinning' : ''}" style="--end:${end}deg; transform: rotate(${end}deg); background: conic-gradient(${stops})">${labels}<div class="wheel-hub">🎟️</div></div>
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
            <div class="voice-row"><b>Narrator</b> <span class="muted">reads the game out loud.</span> Voice:
              <select id="voice">${voiceOptions().map(v => `<option value="${esc(v.name)}" ${v.name === voiceSettings().voice ? 'selected' : ''}>${esc(v.label)}</option>`).join('') || '<option>Default</option>'}</select>
              <button data-act="testvoice">▶ Hear it</button>
            </div>
            <div class="voice-row">Style:
              ${Object.keys(STYLES).map(k => `<button data-act="style" data-style="${k}" class="${voiceSettings().style === k ? 'sel' : ''}">${STYLES[k].label}</button>`).join('')}
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
          <p class="muted" data-step="0">Sneak out of the cabin and win 🎟️ tickets all night. At sunrise, whoever has the most claims the 🏆 grand prize at the arcade counter… if the animatronics don't get you first.</p>
          <ol class="steps">
            <li data-step="1"><span>🔦</span><div><b>Take turns sneaking out on the night shift.</b> Each round, one player is up.</div></li>
            <li data-step="2"><span>🗺️</span><div><b>Pick a category, answer This or That.</b> The night shift picks a spot on the map and answers on their phone. <b>Everyone else answers too</b>: +${game.sideRight()} if right, no risk.</div></li>
            <li data-step="3"><span>🎟️</span><div><b>Right answers fill your pot</b> (+${POT.join(', +')}). After each one: <b>🔦 keep going</b> for more, or <b>🛏️ hide till morning</b> and keep what you have. <b>👑 The leader</b> needs 2 right before they can hide.</div></li>
            <li data-step="4"><span>🌅</span><div><b>3 in a row = 6 AM</b>: you keep the pot plus a +${SIX_AM} bonus.</div></li>
            <li data-step="5"><span>💀</span><div><b>Miss and you drop the pot</b> and get dragged off. Everyone plays a mini-game; you have to do well in it to escape.</div></li>
            <li data-step="6"><span>🏆</span><div><b>Sunrise finale:</b> last place picks the final game. Most tickets wins the grand prize!</div></li>
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
                <div class="medal same-m"><span class="m-icon">🎟️</span><span class="m-big">${w.pot}</span><span class="m-sub">pot so far</span></div>
                <div class="medal risk-m"><span class="m-icon">💀</span><span class="m-big">−${w.pot}</span><span class="m-sub">${w.st.haunted ? `${S.monster.emoji} haunted: dragged off, ${w.st.risk} at stake` : 'miss = drop the pot, dragged off'}</span></div>
                ${w.st.golden ? `<div class="medal golden-m"><span class="m-icon">⭐</span><span class="m-big">+${w.st.golden}</span><span class="m-sub">golden ticket</span></div>` : ''}
                ${w.st.haunted ? `<div class="medal banish-m"><span class="m-icon">⚡</span><span class="m-big">+${w.st.banish}</span><span class="m-sub">banish ${S.monster.emoji}</span></div>` : ''}
              </div>
              <div class="side-note">Everyone else: right answer <b class="win">+${game.sideRight()}</b> ${eventCard(false)}</div>
              ${waitingStrip()}`}
        </div>`;
      }
      case 'decide': case 'decideReveal': {
        const reveal = S.phase === 'decideReveal';
        const bank = w.decision === 'bank';
        return `<div class="center decide">
          <h2>${avatar(watcher)} has <span class="pot-big">${w.pot} 🎟️</span> in the pot</h2>
          ${streakDots(w.streak)}
          <p class="risk-line">${w.streak} of 3 right · ${3 - w.streak} more to 6 AM · <b class="bad-t">risking ${w.pot} 🎟️</b></p>
          <div class="choice-cards">
            <div class="choice-card keep ${reveal && !bank ? 'chosen' : ''} ${reveal && bank ? 'faded' : ''}">
              <span class="emoji-xl">🔦</span><b>KEEP GOING</b><small>Next right: +${game.potValue(w.streak)} · miss: lose it all</small>
            </div>
            <div class="choice-card bank ${reveal && bank ? 'chosen' : ''} ${reveal && !bank ? 'faded' : ''}">
              <span class="emoji-xl">🛏️</span><b>HIDE TILL MORNING</b><small>Keep ${w.pot} 🎟️, end the shift safely</small>
            </div>
          </div>
          ${reveal ? `<p class="big">${bank ? `🛏️ ${esc(watcher?.name)} hides till morning!` : w.forced === 'leader' ? `👑 ${esc(watcher?.name)} is in the lead: no hiding yet!` : w.forced === 'lockdown' ? '🔒 Lockdown: no hiding tonight!' : `🔦 ${esc(watcher?.name)} keeps going!`}</p>` : `<p class="muted">${esc(watcher?.name)} is deciding…</p>`}
        </div>`;
      }
      case 'safe':
        return `<div class="center">
          <div class="emoji-xl bounce">🌅🏠🐕🐕</div>
          <h1>6 AM! ${avatar(watcher)} survived the night shift!</h1>
          <p class="big">${w.pot} 🎟️ pot + ${SIX_AM} bonus</p>
        </div>`;
      case 'dragged':
        return `<div class="center dark">
          <div class="jumpscare">${S.danger.emoji}</div>
          <h1>${avatar(lost)} got dragged off</h1>
          <p class="big">by ${esc(S.danger.name)}.</p>
          <p>At stake: <b>${S.lost.stake} 🎟️</b></p>
        </div>`;
      case 'mgIntro': {
        const m = MINIGAMES[mg.type];
        return `<div class="center">
          <div class="emoji-xl">${m.emoji}</div>
          <h1>${m.name}</h1>
          <p class="big">${esc(m.rules)}</p>
          ${mg.finale ? '<p class="big win">🌅 FINALE · DOUBLE HONEY</p>' : `<p>Captured: ${avatar(lost)} ${S.danger ? S.danger.emoji : ''} · ${S.lost.stake} 🎟️ at stake</p>`}
        </div>`;
      }
      case 'triviaQ': case 'finaleQ': case 'pollQ': {
        const q = mg.questions[mg.qi];
        const poll = S.phase === 'pollQ';
        const choices = poll ? game.pollChoices(q) : q.c;
        const title = poll ? '📋 Cabin Census' : S.phase === 'finaleQ' ? '🐻 Trivia Blitz · double tickets' : '🐻 Bear Trivia';
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
      case 'hideQ': case 'hideA': {
        // four hiding spots; on the reveal everyone's hiding place shows, then the seeker checks two spots
        const spots = mg.rounds[mg.qi];
        const reveal = S.phase === 'hideA';
        const cards = spots.map((sp, i) => {
          const order = reveal ? mg.search.indexOf(i) : -1;
          const hiders = reveal ? Object.entries(mg.answers).filter(([, a]) => a.i === i).map(([id]) => game.player(id)).filter(Boolean) : [];
          const at = 1200 + order * SEARCH_MS;
          return `<div class="hide-spot ${order >= 0 ? 'searched' : reveal ? 'safe-spot' : ''}" style="--at:${at}ms;--end:${1200 + 2 * SEARCH_MS}ms">
            ${order >= 0 ? `<div class="seeker">${mg.seeker}</div>` : ''}
            <div class="hs-name">${esc(sp)}</div>
            <div class="hs-who">${hiders.map(p => `<span>${p.avatar}</span>`).join('')}</div>
            ${order >= 0 ? `<div class="hs-tag">${hiders.length ? 'FOUND!' : 'empty'}</div>` : ''}
          </div>`;
        }).join('');
        const exposed = reveal ? game.connected().filter(p => !mg.answers[p.id]) : [];
        return `<div class="quiz hide-game">
          <div class="quiz-head">🙈 Hide and Seek <span class="muted">${mg.qi + 1}/${mg.rounds.length}</span>${lost ? ` · captured: ${avatar(lost)}` : ''}</div>
          <h1 class="q">${reveal ? 'Ready or not…' : 'Where will you hide?'}</h1>
          ${reveal ? '' : '<p class="muted">The animatronic checks the most crowded spot first, then one more. Unfound = +200</p>'}
          <div class="hide-grid">${cards}</div>
          ${exposed.length ? `<p class="muted">Caught in the open: ${exposed.map(p => p.avatar).join(' ')}</p>` : ''}
          ${reveal ? '' : waitingStrip()}
        </div>`;
      }
      case 'zoomQ': case 'zoomA': {
        // the photo starts zoomed way in and eases out; the animation's negative delay keeps it in place across re-renders
        const q = mg.questions[mg.qi];
        const reveal = S.phase === 'zoomA';
        const total = Math.max(1, (S.deadline || Date.now()) - mg.startedAt);
        const elapsed = Math.min(total, Date.now() - mg.startedAt);
        const img = `<img src="${esc(q.file)}" alt="" style="transform-origin:${q.fx * 100}% ${q.fy * 100}%;${reveal ? '' : `animation:zoomOut ${total}ms linear -${elapsed}ms both;`}${game.isPaused() ? 'animation-play-state:paused;' : ''}">`;
        return `<div class="quiz zoom-game">
          <div class="quiz-head">🔍 Zoom In <span class="muted">${mg.qi + 1}/${mg.questions.length}</span>${lost ? ` · captured: ${avatar(lost)}` : ''}</div>
          <div class="zoom-row">
            <div class="zoom-frame ${reveal ? 'revealed' : ''}">${img}</div>
            <div class="zoom-side">
              ${reveal ? '' : '<h2>What is it?</h2><p class="zoom-worth" id="zoom-worth"></p>'}
              <div class="answers">${q.c.map((c, i) => {
                const who = reveal ? Object.entries(mg.answers).filter(([, a]) => a.i === i).map(([id]) => game.player(id)).filter(Boolean) : [];
                return `<div class="ans ${reveal ? (i === q.a ? 'right-n' : 'wrong-n') : ''}" style="--at:0ms"><span class="letter">${'ABCD'[i]}</span>${esc(c)}<span class="voters">${who.map(p => `${p.avatar}${gainTag(p.id)}`).join(' ')}</span></div>`;
              }).join('')}</div>
              ${reveal ? '' : waitingStrip()}
            </div>
          </div>
        </div>`;
      }
      case 'doorQ': case 'doorA': {
        // three doors; on the reveal everyone's pick shows, then the doors swing open one at a time
        const reveal = S.phase === 'doorA';
        const doors = mg.rounds[mg.qi].map((d, i) => {
          const pickers = reveal ? Object.entries(mg.answers).filter(([, a]) => a.i === i).map(([id]) => game.player(id)).filter(Boolean) : [];
          const b = reveal ? mg.behind[i] : null;
          const at = reveal ? 1000 + mg.openOrder.indexOf(i) * DOOR_STEP : 0;
          return `<div class="door-wrap ${b ? `opens ${b.kind}` : ''}" style="--at:${at}ms">
            <div class="door-inside">${b ? (b.kind === 'monster' ? `<span class="behind">${mg.seeker}</span><b>CAUGHT</b>` : `<span class="behind">${b.emoji}</span><b>+${b.tickets}</b>`) : ''}</div>
            <div class="door-panel"><span class="door-knob"></span><span class="door-label">${esc(d)}</span></div>
            <div class="door-who">${pickers.map(p => p.avatar).join(' ')}</div>
          </div>`;
        }).join('');
        const froze = reveal ? game.connected().filter(p => !mg.answers[p.id]) : [];
        return `<div class="quiz door-game">
          <div class="quiz-head">🚪 Pick a Door <span class="muted">${mg.qi + 1}/${mg.rounds.length}</span>${lost ? ` · captured: ${avatar(lost)}` : ''}</div>
          <h1 class="q">${reveal ? 'Let\'s open them up…' : 'Which door?'}</h1>
          ${reveal ? '' : '<p class="muted">🎁 +300 · 🍬 +100 · one hides an animatronic</p>'}
          <div class="doors">${doors}</div>
          ${froze.length ? `<p class="muted">Froze and didn't pick: ${froze.map(p => p.avatar).join(' ')}</p>` : ''}
          ${reveal ? '' : waitingStrip()}
        </div>`;
      }
      case 'guessQ': case 'guessA': {
        const q = mg.questions[mg.qi];
        const reveal = S.phase === 'guessA';
        const fmt = (x) => Number(x).toLocaleString('en-US');
        const rows = reveal ? mg.order.map((id, k) => {
          const p = game.player(id);
          const won = mg.winners.includes(id);
          return p ? `<div class="guess-row ${won ? 'won' : ''}" style="--at:${k * GUESS_STEP}ms;--end:${mg.revealMs}ms"><span>${p.avatar} ${esc(p.name)}</span><b>${fmt(mg.answers[id].n)}</b><small>${fmt(Math.abs(mg.answers[id].n - q.a))} off</small>${gainTag(id)}</div>` : '';
        }).join('') : '';
        return `<div class="quiz guess-game">
          <div class="quiz-head">📏 Closest Guess <span class="muted">${mg.qi + 1}/${mg.questions.length}</span>${lost ? ` · captured: ${avatar(lost)}` : ''}</div>
          <h1 class="q">${esc(q.q)}</h1>
          ${reveal
            ? `<div class="guess-rows">${rows}</div><div class="guess-answer late-n" style="--at:${mg.revealMs}ms">${fmt(q.a)} ${esc(q.unit)}</div>`
            : `<p class="big">Type your best guess${q.unit ? ` (in ${esc(q.unit)})` : ''} on your phone. Closest wins!</p>${waitingStrip()}`}
        </div>`;
      }
      case 'drawDraw':
        return `<div class="center">
          <div class="emoji-xl">🖍️</div>
          <h1>Sketchy Woods</h1>
          <p class="big">Everyone: draw your secret prompt on your phone!</p>
          ${mg.finale ? '<p class="big win">🌅 Finale · double tickets</p>' : `<p>Captured: ${avatar(lost)} — someone needs to guess your drawing or you lose ${S.lost.stake} 🎟️.</p>`}
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
            return `<div class="opt reveal ${o.real ? 'right' : ''}" style="animation-delay:${mg.revealAt?.[i] ?? k * REVEAL_STEP}ms"><b>${esc(o.text)}</b><small>${by}</small><span class="voters">${voters.length ? `${o.real ? '✅ found it' : 'fooled'}: ${voters.map(p => p.avatar).join(' ')}` : '—'}</span></div>`;
          }).join('')}</div>${Object.keys(S.gains).length ? `<div class="gains-line late-n" style="--at:${mg.revealEnd ?? order.length * REVEAL_STEP}ms">${Object.keys(S.gains).map(id => `${game.player(id)?.avatar} ${gainTag(id)}`).join(' · ')}</div>` : ''}`;
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
          <p class="big">${mg.result ? '+300 🎟️' : `−${S.lost.stake} 🎟️ lost to the animatronics`}</p>
        </div>`;
      case 'scores':
        return `<div class="center"><div class="emoji-xl">🎟️</div><h1>Ticket Count</h1>${scoreboard(true)}<p class="muted">Night ${S.turnIdx + 1} of ${S.turnOrder.length} survived</p></div>`;
      case 'finaleIntro':
        return `<div class="center">
          <div class="emoji-xl">🌅</div>
          <h1>🐻 Trivia Blitz</h1>
          <p class="big">Chosen by ${avatar(game.player(mg.chosenBy))}. Five questions. Double tickets.</p>
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
          <div class="ladder">${STAKES.values.map((v, i) => `<span class="${i === STAKES.values.length - 1 ? 'big-card' : ''}">🎟️ ${v}</span>`).join('')}</div>
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
          <div class="watch-head"><h2>🌅 Sunrise Stakes · question ${mg.round} of ${mg.rounds} · <span class="cat-chip">${c.emoji} ${esc(c.name)}</span></h2><div class="stake-val">±${STAKES.values[mg.round - 1]} 🎟️</div></div>
          ${totBoard(q, reveal ? mg.order : null, answers, null)}
          ${reveal ? (q.note ? `<p class="fact late-n" style="--at:${revealAt(mg.order.length) + 400}ms">💡 ${esc(q.note)}</p>` : '') : waitingStrip()}
        </div>`;
      }
      case 'end': {
        // final standings, revealed last place to first in step with the narrator
        const r = game.ranked();
        const st = S.endSteps || { rows: {} };
        const last = st.prize ?? 0;
        const rows = r.slice().reverse().map(p => {
          const rank = r.indexOf(p) + 1;
          return `<div class="final-row ${rank === 1 ? 'winner' : ''}" data-step="${st.rows[p.id] ?? 0}" ${rank === 1 ? 'data-fx="winner"' : ''}>
            <span class="f-rank">#${rank}</span><span class="f-av">${p.avatar}</span><span class="f-nm">${esc(p.name)}</span><span class="f-pts">${p.score} 🎟️</span></div>`;
        });
        // the drumroll line sits right above the winner's row
        if (st.drum != null) rows.splice(rows.length - 1, 0, `<p class="drum-line" data-step="${st.drum}" data-fx="drumroll">🥁 And the winner of the grand prize is…</p>`);
        return `<div class="center finale-end">
          <div data-step="0"><p class="muted big">🌅 Sunrise</p><h1 class="final-title">FINAL STANDINGS</h1></div>
          <div class="final-rows">${rows.join('')}</div>
          ${r[0] && S.prize ? `<div class="grand-prize" data-step="${last}" data-fx="done"><span class="emoji-xl">${S.prize.emoji}</span><div><small>🎟️ ${esc(r[0].name)} wins the grand prize</small><b>${esc(S.prize.name)}</b></div></div>` : ''}
          <div class="row" data-step="${last}"><button class="big-btn" data-act="again">Play again (same campers)</button><button data-act="new">New room</button></div>
        </div>`;
      }
      default: return '';
    }
  }

  // Each round event gets its own effect layer for the whole turn (kept outside the re-rendered DOM)
  const EV_FX = {
    calm: ['twinkle', '✨', 10], outage: ['dark', '⚡', 4], dogs: ['walk', '🐾', 10], jackpot: ['fall', '🎟️', 16],
    fever: ['rise fever', '🎈', 12], wind: ['blow', '🍂', 16], witching: ['pulse', '🕛', 6], moon: ['moon', '🦇', 7],
    golden: ['fall gold', '⭐', 12], nohide: ['lock', '🔒', 8], freeze: ['fall frost', '❄️', 16]
  };
  const TURN_PHASES = ['turnStart', 'pick', 'tot', 'totReveal', 'decide', 'decideReveal'];
  let evKey = null;
  function eventFx(S) {
    let layer = document.getElementById('ev-fx');
    if (!layer) { layer = document.createElement('div'); layer.id = 'ev-fx'; document.body.appendChild(layer); }
    const fx = TURN_PHASES.includes(S.phase) && EV_FX[S.event];
    const key = fx ? `${S.turnIdx}:${S.event}` : null;
    if (key === evKey) return;
    evKey = key;
    layer.className = fx ? fx[0] : '';
    if (!fx) { layer.innerHTML = ''; return; }
    const [, emoji, n] = fx;
    layer.innerHTML = Array.from({ length: n }, (_, i) => {
      const r = (k) => ((i * 7919 + k * 104729) % 1000) / 1000;
      return `<i style="--x:${Math.round(r(1) * 100)}%;--y:${Math.round(r(2) * 90)}%;--d:-${(r(3) * 9).toFixed(1)}s;--dur:${(7 + r(4) * 6).toFixed(1)}s;--sz:${(1.6 + r(5) * 1.6).toFixed(1)}em">${emoji}</i>`;
    }).join('');
  }

  // 👥 host menu: everyone's connection status; merge a re-joined player into their old seat
  let playersOpen = false;
  function playersPanel() {
    const S = game.S;
    const offline = S.players.filter(p => !p.connected);
    return `<div class="players-panel"><h2>👥 Players</h2>
      <p class="muted small">Someone's phone dropped and they rejoined as a new player? Pick who they really are to merge them back. Pause first with ⏸ if you need time.</p>
      ${S.players.map(p => `<div class="pp-row ${p.connected ? '' : 'off'}">
        <span>${p.connected ? '🟢' : '📵'} ${p.avatar} <b>${esc(p.name)}</b> · ${p.score} 🎟️</span>
        ${p.connected && S.players.length > 1 ? `<select data-merge="${esc(p.id)}"><option value="">This is really…</option>${[...offline, ...S.players.filter(o => o.connected && o.id !== p.id)].map(o => `<option value="${esc(o.id)}">${o.connected ? '' : '📵 '}${o.avatar} ${esc(o.name)}</option>`).join('')}</select>` : ''}
      </div>`).join('')}
      <button data-act="players">Close</button></div>`;
  }
  function toastTV(text) {
    const t = document.createElement('div');
    t.className = 'tv-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function render() {
    const S = game.S;
    eventFx(S);
    const splashKey = `${S.phase}:${S.turnIdx}:${S.watch?.streak}:${S.watch?.spot}:${S.mg?.type}:${S.mg?.round}:${S.mg?.qi}`;
    const splash = splashKey !== lastSplash ? splashFor(S) : '';
    if (splash) { lastSplash = splashKey; sfx.whoosh(); }
    if (S.phase !== 'end') musicOverride = null;
    setMusic(hurryOn ? 'panic' : (musicOverride || MUSIC[S.phase] || 'none'));
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
          ${S.phase !== 'lobby' ? '<button data-act="players" title="Players">👥</button>' : ''}
          ${S.phase !== 'lobby' && S.phase !== 'end' ? `<button data-act="pause" title="Pause (space)">${game.isPaused() ? '▶️' : '⏸'}</button><button data-act="skip" title="Skip (N)">⏭</button>` : ''}
        </div>
        ${game.isPaused() ? '<div class="paused">PAUSED</div>' : ''}
        ${S.phase !== 'lobby' && S.players.some(p => !p.connected) ? `<div class="dc-banner">📵 ${S.players.filter(p => !p.connected).map(p => `${p.avatar} ${esc(p.name)}`).join(', ')} disconnected · rejoin with code <b>${code}</b> · 👥 to fix</div>` : ''}
        ${playersOpen && S.phase !== 'lobby' ? playersPanel() : ''}
      </div>`;
    if (S.phase === 'intro' || S.phase === 'end') showSteps(true);

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
