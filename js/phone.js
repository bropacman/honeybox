// The phone controller.

import { startClient } from './net.js';
import { AVATARS } from './content.js';
import { drawingPad, INK } from './draw.js';

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
  const pid = myId();
  let client = null;
  let session = null;
  let view = null;
  let viewKey = '';
  let deadline = null;
  let paused = false;
  let pad = null;
  let status = 'idle';

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
        <div class="avatars">${AVATARS.map(a => `<button class="av ${a === chosen ? 'sel' : ''}" data-av="${a}">${a}</button>`).join('')}</div>
        <button class="big-btn" id="go">Enter the cabin</button>
        <p class="muted small">Hosting on the TV? <a href="?host=1${params.get('peer') ? `&peer=${esc(params.get('peer'))}` : ''}">Open the host screen</a></p>
      </div>`;
    root.querySelectorAll('[data-av]').forEach(b => b.addEventListener('click', () => {
      chosen = b.dataset.av;
      root.querySelectorAll('[data-av]').forEach(x => x.classList.toggle('sel', x === b));
    }));
    root.querySelector('#go').addEventListener('click', () => {
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
      onOpen: () => client.send({ t: 'hello', pid, name: s.name, avatar: s.avatar }),
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
    if (msg.t === 'view') {
      setTime(msg.ms, false);
      const key = JSON.stringify(msg.v);
      view = msg.v;
      if (key !== viewKey) { viewKey = key; render(); }
    } else if (msg.t === 'time') {
      setTime(msg.ms, msg.paused);
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
    el.textContent = paused ? '⏸' : s;
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
    const red = c.s === '♥' || c.s === '♦';
    return `<div class="card ${red ? 'red' : ''} ${cls}"><span class="r">${c.r}</span><span class="s">${c.s}</span></div>`;
  }

  function header() {
    const g = view.gain ? `<span class="gain ${view.gain < 0 ? 'neg' : ''}">${view.gain > 0 ? '+' : ''}${view.gain}</span>` : '';
    return `<header class="ph-head"><span>${view.me.avatar} ${esc(view.me.name)}</span><span id="ptimer" class="ptimer"></span><span>${g}</span></header>`;
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
        body = `<div class="center-sm lobby-ph"><div class="emoji-xl">${v.me.avatar}</div><h2>You're in!</h2><p>Waiting for everyone. Start the game on the TV.</p>
          <p class="muted">Change your character:</p>
          <div class="avatars">${AVATARS.map(a => `<button class="av ${a === v.me.avatar ? 'sel' : ''}" data-switch="${a}">${a}</button>`).join('')}</div>
          <button class="link" id="leave">Leave room</button></div>`;
        break;
      case 'wait':
        body = `<div class="center"><div class="emoji-xl">${v.emoji}</div><h2>${esc(v.title)}</h2>${v.sub ? `<p>${esc(v.sub)}</p>` : ''}</div>`;
        break;
      case 'pick':
        body = `<h2>Where do you look?</h2><p class="muted">Streak ${v.streak}/3 · deeper = more honey, bigger stakes</p>
          <div class="pick-grid">${v.piles.map((p, i) => `<button class="pick" data-pick="${i}">${cardHtml(p.top, 'sm')}<b>${esc(p.name)}</b><small>${p.depth} deep</small></button>`).join('')}</div>`;
        break;
      case 'guess':
        body = `<p class="role">${v.watcher ? `🔦 You're on watch · streak ${v.streak}/3` : `Betting on ${esc(v.watcherName)}'s card`}</p>
          <div class="center-sm">${cardHtml(v.top)}<p>${esc(v.pileName)} · ${v.depth} deep · the next card is…</p></div>
          <div class="hls">${['HIGH', 'LOW', 'SAME'].map(c => `<button class="hl ${c.toLowerCase()} ${v.locked === c ? 'sel' : ''}" data-guess="${c}" ${v.locked ? 'disabled' : ''}>${c === 'HIGH' ? '⬆️' : c === 'LOW' ? '⬇️' : '🍯'} ${c}</button>`).join('')}</div>
          ${v.locked ? '<p class="center-sm muted">Locked in! Watch the TV.</p>' : v.watcher ? '' : '<p class="center-sm muted small">Right = +100 · SAME = +400</p>'}`;
        break;
      case 'stakes': {
        const amt = (pct) => Math.max(10, Math.round(v.base * pct / 1000) * 10);
        body = `<p class="role">🌅 Sunrise Stakes · card ${v.round}${v.boosted ? ' · <span class="boost">1.5× boost</span>' : ''}</p>
          <div class="center-sm">${cardHtml(v.top, 'sm')}<p>${esc(v.pileName)} · you have <b>${v.bank} 🍯</b></p></div>
          ${v.locked ? `<div class="center-sm"><h2>${v.locked.choice} · ${v.locked.pct === 100 ? 'ALL IN 🔥' : v.locked.pct + '%'}</h2><p>${v.locked.amount} 🍯 on the line. Watch the TV!</p></div>` : `
          <p class="muted small">1. How much?</p>
          <div class="pcts">${v.pcts.map(p => `<button class="pct ${p === 25 ? 'sel' : ''}" data-pct="${p}">${p === 100 ? 'ALL IN 🔥' : p + '%'}<small>${amt(p)} 🍯</small></button>`).join('')}</div>
          <p class="muted small">2. The next card is…</p>
          <div class="hls">${['HIGH', 'LOW', 'SAME'].map(c => `<button class="hl ${c.toLowerCase()}" data-stake="${c}">${c === 'HIGH' ? '⬆️' : c === 'LOW' ? '⬇️' : '🍯'} ${c}${c === 'SAME' ? ' <small>(4×)</small>' : ''}</button>`).join('')}</div>`}`;
        break;
      }
      case 'choices':
        body = `<p class="role">${esc(v.title)} ${v.num ? `· ${v.num}` : ''}</p><h2 class="q">${esc(v.q)}</h2>${v.sub ? `<p class="muted">${esc(v.sub)}</p>` : ''}
          <div class="choices">${v.choices.map((c, i) => `<button class="choice ${v.locked === i ? 'sel' : ''}" data-answer="${i}" ${v.locked != null || c.disabled ? 'disabled' : ''}><span class="letter">${'ABCDEFGH'[i]}</span>${esc(c.text)}${c.disabled ? ' <small>(yours)</small>' : ''}</button>`).join('')}</div>
          ${v.locked != null ? '<p class="center-sm muted">Locked in!</p>' : ''}`;
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
        body = `<div class="center"><div class="emoji-xl">${v.rank === 1 ? '🏆' : v.rank === v.total ? '💀' : '🌄'}</div><h2>You finished #${v.rank} of ${v.total}</h2><p>${v.me.score} 🍯</p><p class="muted">Play again from the TV.</p></div>`;
        break;
      default:
        body = '<div class="center"><p>Look at the TV</p></div>';
    }
    root.innerHTML = `<div class="phone screen-${v.screen}">${header()}<main>${body}</main></div>`;
    wire();
    if (BOT) botAct();
  }

  function wire() {
    root.querySelector('#leave')?.addEventListener('click', leave);
    root.querySelectorAll('[data-switch]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('[data-switch]').forEach(x => x.classList.toggle('sel', x === b));
      session.avatar = b.dataset.switch;
      store.setItem(SESSION_KEY, JSON.stringify({ ...session, at: Date.now() }));
      send({ t: 'avatar', avatar: b.dataset.switch });
    }));
    root.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('[data-pick]').forEach(x => { x.disabled = true; });
      send({ t: 'pick', i: Number(b.dataset.pick) });
    }));
    root.querySelectorAll('[data-guess]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('[data-guess]').forEach(x => { x.disabled = true; });
      b.classList.add('sel');
      send({ t: 'guess', choice: b.dataset.guess });
    }));
    let pct = 25;
    root.querySelectorAll('[data-pct]').forEach(b => b.addEventListener('click', () => {
      pct = Number(b.dataset.pct);
      root.querySelectorAll('[data-pct]').forEach(x => x.classList.toggle('sel', x === b));
    }));
    root.querySelectorAll('[data-stake]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('[data-stake], [data-pct]').forEach(x => { x.disabled = true; });
      b.classList.add('sel');
      send({ t: 'stake', choice: b.dataset.stake, pct });
    }));
    root.querySelectorAll('[data-answer]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('[data-answer]').forEach(x => { x.disabled = true; });
      b.classList.add('sel');
      send({ t: 'answer', i: Number(b.dataset.answer) });
    }));
    const canvas = root.querySelector('#pad');
    if (canvas) {
      pad = drawingPad(canvas);
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
    const delay = 400 + Math.random() * 500;
    setTimeout(() => {
      const enabled = (sel) => [...root.querySelectorAll(sel)].filter(b => !b.disabled);
      const choose = (list) => list[Math.floor(Math.random() * list.length)];
      if (view.screen === 'draw' && pad) { pad.scribble(); root.querySelector('#submit')?.click(); return; }
      const lie = root.querySelector('#lie');
      if (lie) { lie.value = choose(['A moose doing karate', 'Grandpa at the beach', 'A haunted toaster', 'Dog vs vacuum']) + ' ' + Math.floor(Math.random() * 99); root.querySelector('#send').click(); return; }
      const pcts = enabled('[data-pct]');
      if (pcts.length) choose(pcts).click();
      const btns = enabled('[data-pick], [data-guess], [data-answer], [data-stake]');
      if (btns.length) choose(btns).click();
    }, delay);
  }

  // ---------- boot ----------
  const prev = savedSession();
  const urlCode = (params.get('room') || '').toUpperCase();
  if (prev && (!urlCode || urlCode === prev.code) && !BOT) connect(prev);
  else showJoin();
}
