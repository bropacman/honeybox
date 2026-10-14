// The phone controller.

import { spritify } from './sprites.js';
import { startClient } from './net.js';
import { AVATARS, ANIME_AVATARS, ANIME_MARK } from './content.js';
import { drawingPad, INK } from './draw.js';
import { unlockAudio, characterSound } from './audio.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const params = new URLSearchParams(location.search);
const BOT = params.has('bot');
const SESSION_KEY = 'honeybox_phone';
const store = BOT ? sessionStorage : localStorage;

function myId() {
  let id = store.getItem('honeybox_pid');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    store.setItem('honeybox_pid', id);
  }
  return id;
}

function savedSession() {
  try {
    const s = JSON.parse(store.getItem(SESSION_KEY) || 'null');
    if (s && Date.now() - s.at < 4 * 3600 * 1000) return s;
  } catch (e) { /* ignore */ }
  return null;
}

export function startPhone(root) {
  let pid = myId();
  let client = null;
  let session = null;
  let view = null;
  let viewKey = '';
  let deadline = null;
  let paused = false;
  let pad = null;
  let status = 'idle';

  // ---------- character picker: Classic / Anime tabs over two grids ----------
  let avStyle = 'classic';
  function avatarPicker(selected, attr, taken = []) {
    if (selected) avStyle = String(selected).includes(ANIME_MARK) ? 'anime' : 'classic';
    const grid = (list, style) => `<div class="avatars av-${style}">${list.map(a => `<button class="av ${a === selected ? 'sel' : ''}" ${attr}="${a}" ${taken.includes(a) && a !== selected ? 'disabled' : ''}>${a}</button>`).join('')}</div>`;
    return `<div class="avpick" data-style="${avStyle}">
      <div class="av-tabs"><button data-avstyle="classic">Classic</button><button data-avstyle="anime">Anime</button></div>
      ${grid(AVATARS, 'classic')}${grid(ANIME_AVATARS, 'anime')}</div>`;
  }
  function wirePicker() {
    root.querySelectorAll('[data-avstyle]').forEach(b => b.addEventListener('click', () => {
      avStyle = b.dataset.avstyle;
      root.querySelector('.avpick').dataset.style = avStyle;
    }));
  }

  // ---------- join ----------
  function showJoin(error = '') {
    const prev = savedSession() || {};
    const code = (params.get('room') || prev.code || '').toUpperCase();
    let chosen = prev.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)];
    root.innerHTML = `
      <div class="phone join">
        <h1 class="logo">Honey<span>box</span></h1>
        ${error ? `<p class="error">${esc(error)}</p>` : ''}
        <label>Room code<input id="code" maxlength="4" autocapitalize="characters" autocomplete="off" value="${esc(code)}" placeholder="ABCD"></label>
        <label>Your name<input id="name" maxlength="14" autocomplete="off" value="${esc(prev.name || '')}" placeholder="Name"></label>
        ${avatarPicker(chosen, 'data-av')}
        <button class="big-btn" id="go">Enter the cabin</button>
        <p class="muted small">Hosting on the TV? <a href="?host=1${params.get('peer') ? `&peer=${esc(params.get('peer'))}` : ''}">Open the host screen</a></p>
      </div>`;
    spritify(root);
    wirePicker();
    root.querySelectorAll('[data-av]').forEach(b => b.addEventListener('click', () => {
      unlockAudio();
      chosen = b.dataset.av;
      characterSound(chosen, 'happy');
      root.querySelectorAll('[data-av]').forEach(x => x.classList.toggle('sel', x === b));
    }));
    root.querySelector('#go').addEventListener('click', () => {
      unlockAudio();
      const c = root.querySelector('#code').value.trim().toUpperCase();
      const n = root.querySelector('#name').value.trim();
      if (c.length !== 4) return showJoin('Enter the 4-letter room code from the TV.');
      if (!n) return showJoin('Enter your name.');
      connect({ code: c, name: n, avatar: chosen });
    });
    if (BOT) {
      root.querySelector('#name').value = `Bot${Math.floor(Math.random() * 90 + 10)}`;
      root.querySelector('#go').click();
    }
  }

  function connect(s) {
    session = s;
    store.setItem(SESSION_KEY, JSON.stringify({ ...s, at: Date.now() }));
    client?.stop();
    status = 'connecting';
    renderStatus();
    client = startClient(s.code, {
      onOpen: () => client.send({ t: 'hello', pid, name: s.name, avatar: s.avatar, fresh: s.fresh }),
      onData: onMessage,
      onStatus: (st) => { status = st; renderStatus(); }
    });
  }

  function leave() {
    client?.stop();
    client = null;
    store.removeItem(SESSION_KEY);
    view = null;
    viewKey = '';
    showJoin();
  }

  function send(msg) {
    if (!client?.send(msg)) toast('Not connected… reconnecting');
  }

  function onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    // the TV moved us into an existing seat (rejoining on a new device): remember it for next time
    if (msg.t === 'adopt') { pid = String(msg.pid); store.setItem('honeybox_pid', pid); return; }
    // joined mid-game while someone is offline: are we them?
    if (msg.t === 'whoareyou') {
      view = null;
      viewKey = '';
      root.innerHTML = `<div class="phone join"><h1 class="logo">Honey<span>box</span></h1>
        <h2>Welcome back?</h2><p class="muted">A game is going. If your phone dropped out, tap who you are to pick up where you left off.</p>
        <div class="choices">${msg.options.map(o => `<button class="choice" data-claim="${esc(o.id)}">${o.avatar} ${esc(o.name)}</button>`).join('')}</div>
        <button id="fresh">I'm new, join as a new player</button></div>`;
      root.querySelectorAll('[data-claim]').forEach(b => b.addEventListener('click', () => send({ t: 'claim', id: b.dataset.claim })));
      root.querySelector('#fresh').addEventListener('click', () => { session.fresh = true; send({ t: 'hello', pid, name: session.name, avatar: session.avatar, fresh: true }); });
      if (BOT) (params.has('botclaim') ? root.querySelector('[data-claim]') : root.querySelector('#fresh')).click();
      return;
    }
    if (msg.t === 'view') {
      setTime(msg.ms, false);
      const key = JSON.stringify(msg.v);
      view = msg.v;
      if (session && view.me && session.avatar !== view.me.avatar) {
        session.avatar = view.me.avatar;
        store.setItem(SESSION_KEY, JSON.stringify({ ...session, at: Date.now() }));
      }
      if (key !== viewKey) { viewKey = key; render(); }
    } else if (msg.t === 'time') {
      setTime(msg.ms, msg.paused);
    } else if (msg.t === 'mood') {
      if (view?.me) characterSound(view.me.avatar, msg.mood, msg.delay || 0);
    } else if (msg.t === 'toast') {
      toast(msg.text);
      if (view?.screen === 'fib') { const b = root.querySelector('#send'); if (b) b.disabled = false; }
    } else if (msg.t === 'error') {
      client?.stop();
      client = null;
      showJoin(msg.text);
    }
  }

  function setTime(ms, p) {
    paused = p;
    deadline = ms == null ? null : Date.now() + ms;
  }

  setInterval(() => {
    const el = root.querySelector('#ptimer');
    if (!el) return;
    if (deadline == null) { el.textContent = ''; return; }
    const s = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    el.textContent = paused ? '⏸' : view?.story ? '' : s;
    const pb = root.querySelector('#vip-pause');
    if (pb) pb.textContent = paused ? '▶️ Resume' : '⏸ Pause';
    el.classList.toggle('urgent', s <= 5);
  }, 250);

  function toast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function renderStatus() {
    let bar = document.getElementById('netbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'netbar';
      document.body.appendChild(bar);
    }
    const msg = status === 'notfound' ? `Can't find room ${session?.code}. Is the TV on?` : status === 'connecting' ? 'Connecting to the cabin…' : '';
    bar.textContent = msg;
    bar.className = msg ? 'show' : '';
    if (msg && !view) {
      root.innerHTML = `<div class="phone center"><div class="emoji-xl pulse">🏕️</div><p>${esc(msg)}</p><button id="cancel">Cancel</button></div>`;
      root.querySelector('#cancel').addEventListener('click', leave);
    }
  }

  // ---------- screens ----------
  function cardHtml(c, cls = '') {
    if (!c) return `<div class="card back ${cls}"></div>`;
    const red = c.s === '♥' || c.s === '♦';
    return `<div class="card ${red ? 'red' : ''} ${cls}"><span class="r">${c.r}</span><span class="s">${c.s}</span></div>`;
  }

  function header() {
    const g = view.gain ? `<span class="gain ${view.gain < 0 ? 'neg' : ''} ${view.suspense ? 'late' : ''}">${view.gain > 0 ? '+' : ''}${view.gain}</span>` : '';
    return `<header class="ph-head"><span>${view.me.avatar}${view.me.ghost ? '👻' : ''} ${esc(view.me.name)}</span><span id="ptimer" class="ptimer"></span><span>${g}</span></header>`;
  }

  function render() {
    pad = null;
    const v = view;
    let body = '';
    switch (v.screen) {
      case 'gone':
        body = '<div class="center"><p>You were removed from this room.</p><button id="leave">Back</button></div>';
        break;
      case 'lobby':
        body = `<div class="center-sm lobby-ph"><div class="emoji-xl">${v.me.avatar}</div><h2>You're in!</h2>${v.vip ? `<div class="vip-start"><p class="vip-badge">⭐ You're the VIP</p>
            <div class="lengths-ph">${['short', 'normal', 'long'].map(l => `<button data-vip="length" data-len="${l}" class="${v.length === l ? 'sel' : ''}">${l}</button>`).join('')}</div>
            <button class="big-btn" data-vip="start" ${v.count >= 2 ? '' : 'disabled'}>Start the night 🔥</button>
            ${v.count >= 2 ? '' : '<p class="muted small">Need at least 2 players.</p>'}</div>` : '<p>Waiting for everyone. The ⭐ VIP starts the game.</p>'}
          <p class="muted">Change your character:</p>
          ${avatarPicker(v.me.avatar, 'data-switch', v.taken || [])}
          <button class="link" id="leave">Leave room</button></div>`;
        break;
      case 'wait':
        body = v.spin
          ? `<div class="center"><div class="suspense-ph spin-ph">🎡</div><div class="late spin-late"><div class="emoji-xl">${v.emoji}</div><h2>${esc(v.title)}</h2>${v.sub ? `<p>${esc(v.sub)}</p>` : ''}</div></div>`
          : v.suspense
          ? `<div class="center"><div class="suspense-ph" ${v.revealMs ? `style="animation-duration:${v.revealMs}ms"` : ''}>🥁</div><div class="late" ${v.revealMs ? `style="animation-delay:${v.revealMs}ms"` : ''}><div class="emoji-xl">${v.emoji}</div><h2>${esc(v.title)}</h2>${v.sub ? `<p>${esc(v.sub)}</p>` : ''}</div></div>`
          : `<div class="center"><div class="emoji-xl">${v.emoji}</div><h2>${esc(v.title)}</h2>${v.sub ? `<p>${esc(v.sub)}</p>` : ''}</div>`;
        break;
      case 'pick':
        body = `<h2>Pick a category</h2>
          <p class="muted">${v.streak}/3 · pot <b>${v.pot} 🎟️</b> · next right answer <b class="win">+${v.win}</b></p>
          ${v.event ? `<p class="event-chip">${v.event.emoji} ${esc(v.event.name)}</p>` : ''}
          <p class="small">${v.monster.emoji} lurks at <b>${esc(v.spots[v.monster.spot].name)}</b>: miss there = double stake, right = <b class="win">+${v.spots[v.monster.spot].banish}</b></p>
          <div class="pick-grid">${v.spots.map((p, i) => `<button class="pick ${p.haunted ? 'haunted' : ''}" data-pick="${i}">${p.haunted ? `<span class="lurk-ph">${v.monster.emoji}</span>` : ''}<span class="cat-em">${p.emoji}</span><b>${esc(p.cat)}</b><small>${p.golden ? '⭐ golden ticket' : esc(p.name)}</small></button>`).join('')}</div>`;
        break;
      case 'tot':
        body = `<p class="role">${v.watcher ? `🔦 Your night shift · ${v.streak}/3` : `${esc(v.watcherName)}'s night shift`} · ${v.catEmoji} ${esc(v.catName)}</p>
          ${v.watcher
            ? `<div class="risk-box">${v.haunted ? `${v.monster.emoji} Haunted! ` : ''}Right = <b>+${v.win}</b> into your pot (${v.pot} 🎟️)${v.haunted ? ` + <b>${v.banish}</b> banish` : ''}${v.golden ? ` + <b>${v.golden}</b> golden ticket` : ''} · Miss = lose the pot & get caught</div>`
            : `<div class="safe-box">No risk for you · right answer <b>+${v.side}</b></div>`}
          <h2 class="q">${esc(v.q)}</h2>
          <div class="tot-btns">${v.opts.map((o, i) => `<button class="tot-btn ${v.locked === i ? 'sel' : ''}" data-tot="${i}" ${v.locked != null ? 'disabled' : ''}><span class="letter">${'AB'[i]}</span>${esc(o)}</button>`).join('<div class="or">or</div>')}</div>
          ${v.locked != null ? '<p class="center-sm muted">Locked in! Watch the TV.</p>' : ''}`;
        break;
      case 'decide':
        body = `<p class="role">🔦 Your night shift</p>
            <div class="shift-dots">${[0, 1, 2].map(i => `<i class="${i < v.streak ? 'on' : ''}">${i < v.streak ? '✅' : '⬜'}</i>`).join('')}</div>
            <p class="center-sm">${v.streak} of 3 right · ${3 - v.streak} more to reach 6 AM</p>
            <h2>Your pot: ${v.pot} 🎟️</h2>
            <div class="tot-btns">
              <button class="tot-btn keep ${v.locked === 'keep' ? 'sel' : ''}" data-decide="keep" ${v.locked ? 'disabled' : ''}>🔦 Keep going<small>Right: pot grows to ${v.pot + v.next} 🎟️${v.sixAm ? ` + ${v.sixAm} 6 AM bonus` : ''}<br>Miss: lose all ${v.pot} 🎟️ and get caught</small></button>
              <button class="tot-btn bank ${v.locked === 'bank' ? 'sel' : ''}" data-decide="bank" ${v.locked ? 'disabled' : ''}>🛏️ Hide till morning<small>Keep your ${v.pot} 🎟️ safe. Ends your shift.</small></button>
            </div>`;
        break;
      case 'finale':
        body = `<p class="role">🌅 You're in last place…</p><h2>Choose how the night ends!</h2>
          <div class="choices">${v.options.map(o => `<button class="choice finale-choice" data-finale="${o.key}"><span class="f-emoji">${o.emoji}</span><span><b>${esc(o.name)}</b><br><small>${esc(o.blurb)}</small></span></button>`).join('')}</div>`;
        break;
      case 'stakes':
        body = `<p class="role">🌅 Sunrise Stakes · ${v.round} · ${v.catEmoji} ${esc(v.catName)}${v.boosted ? ' · <span class="boost">1.5× boost</span>' : ''}</p>
          <div class="safe-box">Right = <b>+${v.value}</b> · wrong = <b class="risk">−${v.value}</b></div>
          <h2 class="q">${esc(v.q)}</h2>
          <div class="tot-btns">${v.opts.map((o, i) => `<button class="tot-btn ${v.locked === i ? 'sel' : ''}" data-stake="${i}" ${v.locked != null ? 'disabled' : ''}><span class="letter">${'AB'[i]}</span>${esc(o)}</button>`).join('<div class="or">or</div>')}</div>
          ${v.locked != null ? '<p class="center-sm muted">Locked in! Watch the TV.</p>' : ''}`;
        break;
      case 'choices':
        body = `<p class="role">${esc(v.title)} ${v.num ? `· ${v.num}` : ''}</p><h2 class="q">${esc(v.q)}</h2>${v.sub ? `<p class="muted">${esc(v.sub)}</p>` : ''}
          <div class="choices">${v.choices.map((c, i) => `<button class="choice ${v.locked === i ? 'sel' : ''}" data-answer="${i}" ${v.locked != null || c.disabled ? 'disabled' : ''}><span class="letter">${'ABCDEFGH'[i]}</span>${esc(c.text)}${c.disabled ? ' <small>(yours)</small>' : ''}</button>`).join('')}</div>
          ${v.locked != null ? '<p class="center-sm muted">Locked in!</p>' : ''}`;
        break;
      case 'number':
        body = `<p class="role">${esc(v.title)} · ${v.num}</p><h2 class="q">${esc(v.q)}</h2>
          ${v.locked != null
            ? `<div class="center"><div class="emoji-xl">🔒</div><h2>${Number(v.locked).toLocaleString('en-US')} ${esc(v.unit)}</h2><p class="muted">Locked in! Watch the TV.</p></div>`
            : `<div class="num-row"><input id="num" inputmode="decimal" autocomplete="off" placeholder="Your guess">${v.unit ? `<span class="unit">${esc(v.unit)}</span>` : ''}</div>
              <button class="big-btn" id="num-send">Lock it in</button>`}`;
        break;
      case 'draw':
        if (v.done) {
          body = '<div class="center"><div class="emoji-xl">🖼️</div><h2>Masterpiece submitted</h2><p>Waiting for the other artists…</p></div>';
        } else {
          body = `<p class="role">Draw this (keep it secret!)</p><h2 class="prompt">${esc(v.prompt)}</h2>
            <canvas id="pad" width="600" height="600"></canvas>
            <div class="tools">${INK.map((c, i) => `<button class="ink ${i === 0 ? 'sel' : ''}" data-ink="${c}" style="background:${c}"></button>`).join('')}
              <button data-w="5">✏️</button><button data-w="22">🖌️</button><button id="undo">↩️</button><button id="clear">🗑️</button></div>
            <button class="big-btn" id="submit">Done drawing</button>`;
        }
        break;
      case 'fib':
        if (v.done) {
          body = '<div class="center"><div class="emoji-xl">🤥</div><h2>Lie submitted</h2><p>Waiting for the others…</p></div>';
        } else {
          body = `<p class="role">Look at the drawing on the TV</p><h2>Write a fake title</h2>
            <p class="muted">Something believable that could fool everyone.</p>
            <input id="lie" maxlength="45" autocomplete="off" placeholder="A bear doing taxes">
            <button class="big-btn" id="send">Submit lie</button>`;
        }
        break;
      case 'end':
        body = `<div class="center"><div class="emoji-xl">${v.rank === 1 ? '🏆' : v.rank === v.total ? '💀' : '🌄'}</div><h2>You finished #${v.rank} of ${v.total}</h2><p>${v.me.score} 🎟️</p>${v.prize ? `<p class="big">You won the grand prize: ${v.prize.emoji} <b>${esc(v.prize.name)}</b>!</p>` : ''}${v.vip ? '<button class="big-btn" data-vip="again">Play again 🔁</button>' : '<p class="muted">The VIP can start another round.</p>'}</div>`;
        break;
      default:
        body = '<div class="center"><p>Look at the TV</p></div>';
    }
    const vipBar = v.vip && !['lobby', 'end'].includes(v.screen)
      ? `<div class="vip-bar"><span>⭐ VIP</span><button data-vip="pause" id="vip-pause">${paused ? '▶️ Resume' : '⏸ Pause'}</button><button data-vip="skip">⏭ Skip</button><button data-vip="lobby">🏠 End</button></div>`
      : '';
    root.innerHTML = `<div class="phone screen-${v.screen} ${vipBar ? 'has-vip' : ''}">${header()}<main>${body}</main>${vipBar}</div>`;
    spritify(root);
    wire();
    if (BOT) botAct();
  }

  function wire() {
    wirePicker();
    root.querySelector('#leave')?.addEventListener('click', leave);
    root.querySelectorAll('[data-vip]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.vip;
      if (a === 'lobby' && !confirm('End this game and go back to the lobby?')) return;
      if (a === 'length') root.querySelectorAll('[data-vip="length"]').forEach(x => x.classList.toggle('sel', x === b));
      send({ t: 'vip', a, len: b.dataset.len });
    }));
    root.querySelectorAll('[data-switch]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('[data-switch]').forEach(x => x.classList.toggle('sel', x === b));
      unlockAudio();
      characterSound(b.dataset.switch, 'happy');
      session.avatar = b.dataset.switch;
      store.setItem(SESSION_KEY, JSON.stringify({ ...session, at: Date.now() }));
      send({ t: 'avatar', avatar: b.dataset.switch });
    }));
    root.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('[data-pick]').forEach(x => { x.disabled = true; });
      send({ t: 'pick', i: Number(b.dataset.pick) });
    }));
    const once = (sel, send1) => root.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll(sel).forEach(x => { x.disabled = true; });
      b.classList.add('sel');
      send1(b);
    }));
    once('[data-tot]', b => send({ t: 'answer', i: Number(b.dataset.tot) }));
    once('[data-decide]', b => send({ t: 'decide', choice: b.dataset.decide }));
    root.querySelectorAll('[data-finale]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('[data-finale]').forEach(x => { x.disabled = true; });
      b.classList.add('sel');
      send({ t: 'finale', choice: b.dataset.finale });
    }));
    once('[data-stake]', b => send({ t: 'stake', i: Number(b.dataset.stake) }));
    root.querySelectorAll('[data-answer]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('[data-answer]').forEach(x => { x.disabled = true; });
      b.classList.add('sel');
      send({ t: 'answer', i: Number(b.dataset.answer) });
    }));
    const canvas = root.querySelector('#pad');
    if (canvas) {
      // send the work in progress after each stroke, so a half-finished drawing still counts when time runs out
      let draftTimer = null;
      pad = drawingPad(canvas, () => {
        clearTimeout(draftTimer);
        draftTimer = setTimeout(() => send({ t: 'drawDraft', strokes: pad.strokes }), 400);
      });
      root.querySelectorAll('[data-ink]').forEach(b => b.addEventListener('click', () => {
        pad.setColor(b.dataset.ink);
        root.querySelectorAll('[data-ink]').forEach(x => x.classList.toggle('sel', x === b));
      }));
      root.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => pad.setWidth(Number(b.dataset.w))));
      root.querySelector('#undo').addEventListener('click', () => pad.undo());
      root.querySelector('#clear').addEventListener('click', () => pad.clear());
      root.querySelector('#submit').addEventListener('click', (e) => {
        e.target.disabled = true;
        send({ t: 'drawing', strokes: pad.strokes });
      });
    }
    const num = root.querySelector('#num');
    if (num) {
      const submitNum = () => {
        const n = Number(num.value.replace(/[^0-9.]/g, ''));
        if (!num.value.trim() || !Number.isFinite(n)) return toast('Type a number');
        root.querySelector('#num-send').disabled = true;
        send({ t: 'guess', n });
      };
      root.querySelector('#num-send').addEventListener('click', submitNum);
      num.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitNum(); });
      if (!BOT) num.focus();
    }
    const lie = root.querySelector('#lie');
    if (lie) {
      const submit = () => {
        const text = lie.value.trim();
        if (!text) return;
        root.querySelector('#send').disabled = true;
        send({ t: 'fib', text });
      };
      root.querySelector('#send').addEventListener('click', submit);
      lie.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    }
  }

  // ---------- test bot: plays randomly through the real UI ----------
  function botAct() {
    const delay = (params.has('fastbot') ? 60 : 400) + Math.random() * (params.has('fastbot') ? 120 : 500);
    setTimeout(() => {
      const enabled = (sel) => [...root.querySelectorAll(sel)].filter(b => !b.disabled);
      const choose = (list) => list[Math.floor(Math.random() * list.length)];
      if (view.screen === 'draw' && pad) { pad.scribble(); root.querySelector('#submit')?.click(); return; }
      const num = root.querySelector('#num');
      if (num) { num.value = String(Math.floor(Math.random() * 3000)); root.querySelector('#num-send').click(); return; }
      const lie = root.querySelector('#lie');
      if (lie) { lie.value = choose(['A moose doing karate', 'Grandpa at the beach', 'A haunted toaster', 'Dog vs vacuum']) + ' ' + Math.floor(Math.random() * 99); root.querySelector('#send').click(); return; }
      const btns = enabled('[data-pick], [data-tot], [data-decide], [data-answer], [data-stake], [data-finale]');
      if (btns.length) choose(btns).click();
    }, delay);
  }

  // phones only allow sound after a tap
  document.addEventListener('pointerdown', unlockAudio, { once: true });

  // ---------- boot ----------
  const prev = savedSession();
  const urlCode = (params.get('room') || '').toUpperCase();
  if (prev && (!urlCode || urlCode === prev.code) && !BOT) connect(prev);
  else showJoin();
}
