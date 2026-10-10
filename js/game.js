// Honeybox game rules. Runs on the TV (host). No DOM here.
// State lives in this.S (plain JSON, so it can be saved and resumed).

import { PILE_NAMES, DANGERS, TRIVIA, DRAW_PROMPTS, POLLS } from './content.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export const SEC = 1000;
export const TIMES = {
  intro: 16, turnStart: 5, pick: 30, guess: 20, reveal: 5, safe: 6, dragged: 7,
  mgIntro: 8, triviaQ: 20, triviaA: 6, pollQ: 20, pollA: 7,
  drawDraw: 80, drawFib: 45, drawVote: 25, drawReveal: 12, mgResult: 6, scores: 7,
  finaleIntro: 8, finaleQ: 18, finaleA: 6
};

export const MINIGAMES = {
  trivia: { name: 'Bear Trivia', emoji: '🐻', rules: 'Answer 3 questions. Lost in the woods? Get 2 right to find the trail home.' },
  draw: { name: 'Sketchy Woods', emoji: '🖍️', rules: 'Draw your secret prompt. Then fib a title for the drawing and find the real one. The lost player needs someone to guess theirs.' },
  poll: { name: 'Cabin Census', emoji: '📋', rules: 'Pick the answer you think MOST people will pick. Lost in the woods? Match the crowd 2 of 3 times.' }
};

export const LENGTHS = { short: 5, normal: 7, long: 10 };

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function makeDeck() {
  const d = [];
  for (const s of SUITS) for (let v = 2; v <= 14; v++) d.push({ v, r: RANKS[v], s });
  return shuffle(d);
}

export class Game {
  constructor(code, { speed = 1, saved = null } = {}) {
    this.speed = speed;
    this.listeners = new Set();
    this.S = saved || {
      code,
      phase: 'lobby',
      phaseMs: 0,
      deadline: null,
      pausedLeft: null,
      players: [],
      length: 'normal',
      turnOrder: [],
      turnIdx: -1,
      piles: [],
      deck: [],
      watch: null,
      mg: null,
      lost: null,
      used: { trivia: [], prompts: [], polls: [] },
      bag: [],
      gains: {},
      danger: '',
      seq: 0
    };
    if (saved && saved.deadline) this.S.deadline = Date.now() + (saved.phaseMs || 10 * SEC);
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data) { for (const fn of this.listeners) fn(type, data); }
  changed() { this.S.seq++; this.emit('change'); }

  // ---------- players ----------
  player(id) { return this.S.players.find(p => p.id === id); }
  connected() { return this.S.players.filter(p => p.connected); }

  join(id, name, avatar) {
    let p = this.player(id);
    if (p) {
      p.connected = true;
      if (name) p.name = name;
      if (avatar) p.avatar = avatar;
    } else {
      if (this.S.players.length >= 8) return { error: 'Sorry, the cabin is full (8 players max).' };
      p = { id, name: name || 'Camper', avatar: avatar || '🐶', score: 0, connected: true };
      this.S.players.push(p);
      this.emit('sfx', 'join');
    }
    this.changed();
    this.checkAllDone();
    return { ok: true };
  }

  setConnected(id, on) {
    const p = this.player(id);
    if (!p || p.connected === on) return;
    p.connected = on;
    this.changed();
    if (!on) this.checkAllDone();
  }

  kick(id) {
    if (this.S.phase !== 'lobby') return;
    this.S.players = this.S.players.filter(p => p.id !== id);
    this.changed();
  }

  addScore(id, n) {
    const p = this.player(id);
    if (!p || !n) return;
    p.score = Math.max(0, p.score + n);
    this.S.gains[id] = (this.S.gains[id] || 0) + n;
  }

  // ---------- timing ----------
  go(phase, secs) {
    const ms = secs == null ? 0 : secs * SEC * this.speed;
    this.S.phase = phase;
    this.S.phaseMs = ms;
    this.S.deadline = secs == null ? null : Date.now() + ms;
    this.S.pausedLeft = null;
    this.changed();
  }

  timeLeft() {
    if (this.S.pausedLeft != null) return this.S.pausedLeft;
    return this.S.deadline ? Math.max(0, this.S.deadline - Date.now()) : null;
  }

  togglePause() {
    if (this.S.pausedLeft != null) {
      this.S.deadline = Date.now() + this.S.pausedLeft;
      this.S.pausedLeft = null;
    } else if (this.S.deadline) {
      this.S.pausedLeft = Math.max(0, this.S.deadline - Date.now());
    }
    this.changed();
  }
  isPaused() { return this.S.pausedLeft != null; }

  tick() {
    if (this.S.pausedLeft != null || !this.S.deadline) return;
    if (Date.now() >= this.S.deadline) {
      this.S.deadline = null;
      this.timeout();
    }
  }

  skip() {
    if (this.S.pausedLeft != null) this.S.pausedLeft = null;
    if (this.S.phase === 'lobby' || this.S.phase === 'end') return;
    this.S.deadline = null;
    this.timeout();
  }

  // ---------- flow ----------
  setLength(len) {
    if (LENGTHS[len] && this.S.phase === 'lobby') { this.S.length = len; this.changed(); }
  }

  start() {
    const S = this.S;
    if (S.players.length < 1) return;
    const n = S.players.length;
    const rounds = Math.max(1, Math.min(4, Math.round(LENGTHS[S.length] / n)));
    const order = shuffle(S.players.map(p => p.id));
    S.turnOrder = [];
    for (let r = 0; r < rounds; r++) S.turnOrder.push(...order);
    S.turnIdx = -1;
    S.deck = makeDeck();
    S.piles = PILE_NAMES.map(name => ({ name, cards: [S.deck.pop()] }));
    S.bag = [];
    S.players.forEach(p => { p.score = 0; });
    this.emit('say', 'Welcome to the cabin. Keep the fire going, keep the dogs close, and whatever you do, do not go into the woods.');
    this.go('intro', TIMES.intro);
  }

  restart() {
    const S = this.S;
    S.phase = 'lobby';
    S.deadline = null;
    S.watch = null;
    S.mg = null;
    S.lost = null;
    S.gains = {};
    S.players = S.players.filter(p => p.connected);
    S.players.forEach(p => { p.score = 0; });
    this.changed();
  }

  timeout() {
    const S = this.S;
    switch (S.phase) {
      case 'intro': return this.nextTurn();
      case 'turnStart': return this.go('pick', TIMES.pick);
      case 'pick': return this.choosePile(S.watch.watcherId, this.bestPile());
      case 'guess': return this.resolveGuess();
      case 'reveal': return this.afterReveal();
      case 'safe': return this.nextTurn();
      case 'dragged': return this.startMinigame();
      case 'mgIntro': return this.beginMinigame();
      case 'triviaQ': case 'finaleQ': return this.revealTrivia();
      case 'triviaA': case 'finaleA': return this.nextTrivia();
      case 'pollQ': return this.revealPoll();
      case 'pollA': return this.nextPoll();
      case 'drawDraw': return this.startFibs();
      case 'drawFib': return this.startVote();
      case 'drawVote': return this.revealVote();
      case 'drawReveal': return this.nextDrawing();
      case 'mgResult': this.S.gains = {}; return this.go('scores', TIMES.scores);
      case 'scores': return this.nextTurn();
      case 'finaleIntro': return this.askTrivia();
      default: return undefined;
    }
  }

  nextTurn() {
    const S = this.S;
    S.gains = {};
    S.mg = null;
    S.lost = null;
    S.turnIdx++;
    while (S.turnIdx < S.turnOrder.length && !this.player(S.turnOrder[S.turnIdx])) S.turnIdx++;
    if (S.turnIdx >= S.turnOrder.length) return this.startFinale();
    const w = this.player(S.turnOrder[S.turnIdx]);
    S.watch = { watcherId: w.id, streak: 0, pile: null, guesses: {}, drawn: null, results: null, depth: 0 };
    this.emit('say', `${w.name}, you're on night watch. Three in a row gets you back to the cabin.`);
    this.go('turnStart', TIMES.turnStart);
  }

  // ---------- night watch ----------
  bestPile() {
    // closest-to-the-edge top card = easiest call
    let best = 0, score = -1;
    this.S.piles.forEach((p, i) => {
      const v = p.cards[p.cards.length - 1].v;
      const s = Math.abs(v - 8);
      if (s > score) { score = s; best = i; }
    });
    return best;
  }

  choosePile(pid, i) {
    const S = this.S;
    if (S.phase !== 'pick' || pid !== S.watch.watcherId || !S.piles[i]) return;
    S.watch.pile = i;
    S.watch.guesses = {};
    S.watch.depth = S.piles[i].cards.length;
    this.emit('sfx', 'lock');
    this.go('guess', TIMES.guess);
  }

  guess(pid, choice) {
    const S = this.S;
    if (S.phase !== 'guess' || !['HIGH', 'LOW', 'SAME'].includes(choice)) return;
    if (!this.player(pid) || S.watch.guesses[pid]) return;
    S.watch.guesses[pid] = choice;
    this.emit('sfx', 'lock');
    this.changed();
    this.checkAllDone();
  }

  drawCard() {
    const S = this.S;
    if (!S.deck.length) {
      // shuffle everything under the top cards back into the deck
      for (const p of S.piles) S.deck.push(...p.cards.splice(0, p.cards.length - 1));
      S.deck = shuffle(S.deck);
      this.emit('say', 'The woodpile is empty. Restacking.');
    }
    return S.deck.pop() || makeDeck().pop();
  }

  resolveGuess() {
    const S = this.S;
    const w = S.watch;
    const pile = S.piles[w.pile];
    const top = pile.cards[pile.cards.length - 1];
    if (!w.guesses[w.watcherId]) w.guesses[w.watcherId] = top.v <= 8 ? 'HIGH' : 'LOW';
    const drawn = this.drawCard();
    const actual = drawn.v > top.v ? 'HIGH' : drawn.v < top.v ? 'LOW' : 'SAME';
    pile.cards.push(drawn);
    S.gains = {};
    const results = {};
    for (const [pid, choice] of Object.entries(w.guesses)) {
      const ok = choice === actual;
      results[pid] = ok;
      if (pid !== w.watcherId && ok) this.addScore(pid, choice === 'SAME' ? 400 : 100);
    }
    const depth = Math.max(1, w.depth);
    const mine = w.guesses[w.watcherId];
    const ok = results[w.watcherId];
    if (ok) {
      if (mine === 'SAME') { w.streak = 3; this.addScore(w.watcherId, 200 * depth); }
      else { w.streak++; this.addScore(w.watcherId, 100 * depth); }
    }
    w.drawn = drawn;
    w.top = top;
    w.actual = actual;
    w.results = results;
    w.tie = actual === 'SAME' && mine !== 'SAME';
    this.emit('sfx', 'flip');
    setTimeout(() => this.emit('sfx', ok ? (mine === 'SAME' ? 'great' : 'good') : 'bad'), 700 * Math.min(1, this.speed * 4));
    this.go('reveal', TIMES.reveal);
  }

  afterReveal() {
    const S = this.S;
    const w = S.watch;
    const name = this.player(w.watcherId)?.name || 'Someone';
    if (w.results[w.watcherId]) {
      if (w.streak >= 3) {
        S.gains = {};
        this.addScore(w.watcherId, 500);
        this.emit('sfx', 'great');
        this.emit('say', `${name} made it back to the cabin! The dogs are thrilled.`);
        return this.go('safe', TIMES.safe);
      }
      w.pile = null;
      S.gains = {};
      return this.go('pick', TIMES.pick);
    }
    S.lost = { pid: w.watcherId, stake: Math.max(200, 100 * Math.max(1, w.depth)) };
    S.danger = pick(DANGERS);
    S.gains = {};
    this.emit('sfx', 'howl');
    this.emit('say', `Oh no. ${name} was dragged into the woods by ${S.danger}.`);
    return this.go('dragged', TIMES.dragged);
  }

  // ---------- minigames ----------
  startMinigame() {
    const S = this.S;
    if (!S.bag.length) S.bag = shuffle(Object.keys(MINIGAMES));
    const type = S.bag.pop();
    S.mg = { type, lostOk: false };
    S.gains = {};
    this.emit('say', `${MINIGAMES[type].name}. ${MINIGAMES[type].rules}`);
    this.go('mgIntro', TIMES.mgIntro);
  }

  beginMinigame() {
    const mg = this.S.mg;
    if (mg.type === 'trivia') {
      mg.questions = this.takeTrivia(3);
      mg.qi = -1;
      mg.correct = {};
      return this.askTrivia();
    }
    if (mg.type === 'poll') {
      mg.questions = this.takePolls(3);
      mg.qi = -1;
      mg.hits = {};
      return this.askPoll();
    }
    return this.startDrawing();
  }

  takeTrivia(n) {
    const S = this.S;
    let pool = TRIVIA.map((_, i) => i).filter(i => !S.used.trivia.includes(i));
    if (pool.length < n) { S.used.trivia = []; pool = TRIVIA.map((_, i) => i); }
    const chosen = shuffle(pool).slice(0, n);
    S.used.trivia.push(...chosen);
    return chosen.map(i => {
      const t = TRIVIA[i];
      const order = shuffle(t.c.map((_, k) => k));
      return { q: t.q, c: order.map(k => t.c[k]), a: order.indexOf(t.a) };
    });
  }

  askTrivia() {
    const mg = this.S.mg;
    mg.qi++;
    mg.answers = {};
    mg.askedAt = Date.now();
    this.S.gains = {};
    const finale = mg.type === 'finale';
    this.go(finale ? 'finaleQ' : 'triviaQ', finale ? TIMES.finaleQ : TIMES.triviaQ);
  }

  answer(pid, i) {
    const S = this.S;
    if (!['triviaQ', 'finaleQ', 'pollQ'].includes(S.phase) || !this.player(pid)) return;
    const mg = S.mg;
    const q = mg.questions[mg.qi];
    const max = S.phase === 'pollQ' ? this.pollChoices(q).length : q.c.length;
    if (mg.answers[pid] || !(i >= 0 && i < max)) return;
    mg.answers[pid] = { i, at: Date.now() };
    this.emit('sfx', 'lock');
    this.changed();
    this.checkAllDone();
  }

  revealTrivia() {
    const S = this.S;
    const mg = S.mg;
    const q = mg.questions[mg.qi];
    const finale = mg.type === 'finale';
    const window = (finale ? TIMES.finaleQ : TIMES.triviaQ) * SEC * this.speed;
    S.gains = {};
    for (const [pid, a] of Object.entries(mg.answers)) {
      if (a.i !== q.a) continue;
      const speedFrac = Math.max(0, 1 - (a.at - mg.askedAt) / window);
      const pts = finale ? 400 + Math.round(speedFrac * 20) * 10 : 200 + Math.round(speedFrac * 10) * 10;
      this.addScore(pid, pts);
      if (mg.correct) mg.correct[pid] = (mg.correct[pid] || 0) + 1;
    }
    this.emit('sfx', 'good');
    this.emit('say', `The answer is: ${q.c[q.a]}.`);
    this.go(finale ? 'finaleA' : 'triviaA', finale ? TIMES.finaleA : TIMES.triviaA);
  }

  nextTrivia() {
    const mg = this.S.mg;
    if (mg.qi + 1 < mg.questions.length) return this.askTrivia();
    if (mg.type === 'finale') return this.finish();
    const lost = this.S.lost;
    return this.finishMinigame((mg.correct[lost.pid] || 0) >= 2);
  }

  takePolls(n) {
    const S = this.S;
    let pool = POLLS.map((_, i) => i).filter(i => !S.used.polls.includes(i));
    if (pool.length < n) { S.used.polls = []; pool = POLLS.map((_, i) => i); }
    // at most one "about the players" question per census keeps it fresh
    const people = shuffle(pool.filter(i => POLLS[i].players));
    const things = shuffle(pool.filter(i => !POLLS[i].players));
    const chosen = [...people.slice(0, 1), ...things].slice(0, n);
    while (chosen.length < n && people.length > chosen.length) chosen.push(people[chosen.length]);
    S.used.polls.push(...chosen);
    return shuffle(chosen).map(i => {
      const p = POLLS[i];
      return p.players ? { q: p.q, players: true } : { q: p.q, c: p.c.slice() };
    });
  }

  pollChoices(q) {
    if (!q.players) return q.c;
    if (!q.c) q.c = this.S.players.map(p => `${p.avatar} ${p.name}`);
    return q.c;
  }

  askPoll() {
    const mg = this.S.mg;
    mg.qi++;
    mg.answers = {};
    this.pollChoices(mg.questions[mg.qi]);
    this.S.gains = {};
    this.go('pollQ', TIMES.pollQ);
  }

  revealPoll() {
    const S = this.S;
    const mg = S.mg;
    const q = mg.questions[mg.qi];
    const counts = this.pollChoices(q).map(() => 0);
    for (const a of Object.values(mg.answers)) counts[a.i]++;
    const top = Math.max(...counts);
    q.counts = counts;
    q.top = top;
    S.gains = {};
    if (top > 0) {
      for (const [pid, a] of Object.entries(mg.answers)) {
        if (counts[a.i] === top) {
          this.addScore(pid, 300);
          mg.hits[pid] = (mg.hits[pid] || 0) + 1;
        }
      }
    }
    this.emit('sfx', 'good');
    this.go('pollA', TIMES.pollA);
  }

  nextPoll() {
    const mg = this.S.mg;
    if (mg.qi + 1 < mg.questions.length) return this.askPoll();
    return this.finishMinigame((mg.hits[this.S.lost.pid] || 0) >= 2);
  }

  // Drawful-style
  takePrompt() {
    const S = this.S;
    let pool = DRAW_PROMPTS.filter(p => !S.used.prompts.includes(p));
    if (!pool.length) { S.used.prompts = []; pool = DRAW_PROMPTS.slice(); }
    const p = pick(pool);
    S.used.prompts.push(p);
    return p;
  }

  startDrawing() {
    const mg = this.S.mg;
    mg.prompts = {};
    mg.drawings = {};
    for (const p of this.S.players) mg.prompts[p.id] = this.takePrompt();
    this.go('drawDraw', TIMES.drawDraw);
  }

  submitDrawing(pid, strokes) {
    const S = this.S;
    if (S.phase !== 'drawDraw' || !S.mg.prompts[pid] || S.mg.drawings[pid]) return;
    if (!Array.isArray(strokes)) return;
    S.mg.drawings[pid] = strokes.slice(0, 400).map(st => ({
      c: String(st.c).slice(0, 9), w: Math.min(40, Number(st.w) || 10), p: (st.p || []).slice(0, 4000).map(Number)
    }));
    this.changed();
    this.checkAllDone();
  }

  startFibs() {
    const S = this.S;
    const mg = S.mg;
    const lostId = S.lost.pid;
    const others = shuffle(Object.keys(mg.drawings).filter(id => id !== lostId && mg.drawings[id].length));
    mg.judged = [lostId];
    if (others.length && S.players.length >= 3) mg.judged.push(others[0]);
    mg.di = -1;
    return this.nextDrawing();
  }

  nextDrawing() {
    const S = this.S;
    const mg = S.mg;
    mg.di++;
    if (mg.di >= mg.judged.length) return this.finishMinigame(mg.lostOk);
    mg.lies = {};
    mg.options = null;
    mg.votes = {};
    S.gains = {};
    this.go('drawFib', TIMES.drawFib);
  }

  artistId() { const mg = this.S.mg; return mg.judged[mg.di]; }

  fib(pid, text) {
    const S = this.S;
    const mg = S.mg;
    if (S.phase !== 'drawFib' || pid === this.artistId() || !this.player(pid) || mg.lies[pid]) return null;
    const lie = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 45);
    if (!lie) return 'Type something!';
    if (norm(lie) === norm(mg.prompts[this.artistId()])) return "That's actually the real title! Write a lie instead.";
    mg.lies[pid] = lie;
    this.changed();
    this.checkAllDone();
    return null;
  }

  startVote() {
    const S = this.S;
    const mg = S.mg;
    const real = mg.prompts[this.artistId()];
    const opts = [{ text: real, owners: [], real: true }];
    for (const [pid, lie] of Object.entries(mg.lies)) {
      const same = opts.find(o => norm(o.text) === norm(lie));
      if (same && !same.real) same.owners.push(pid);
      else if (!same) opts.push({ text: lie, owners: [pid] });
    }
    while (opts.length < 4) {
      const decoy = pick(DRAW_PROMPTS);
      if (!opts.some(o => norm(o.text) === norm(decoy))) opts.push({ text: decoy, owners: [], house: true });
    }
    mg.options = shuffle(opts);
    mg.votes = {};
    this.go('drawVote', TIMES.drawVote);
  }

  vote(pid, i) {
    const S = this.S;
    const mg = S.mg;
    if (S.phase !== 'drawVote' || pid === this.artistId() || !this.player(pid) || mg.votes[pid] != null) return;
    const o = mg.options[i];
    if (!o || o.owners.includes(pid)) return;
    mg.votes[pid] = i;
    this.emit('sfx', 'lock');
    this.changed();
    this.checkAllDone();
  }

  revealVote() {
    const S = this.S;
    const mg = S.mg;
    const artist = this.artistId();
    S.gains = {};
    let found = 0;
    for (const [pid, i] of Object.entries(mg.votes)) {
      const o = mg.options[i];
      if (o.real) { this.addScore(pid, 500); this.addScore(artist, 300); found++; }
      else for (const owner of o.owners) this.addScore(owner, 300);
    }
    if (artist === S.lost.pid) mg.lostOk = found > 0;
    this.emit('sfx', found ? 'good' : 'bad');
    this.emit('say', `The real title was: ${mg.prompts[artist]}.`);
    this.go('drawReveal', TIMES.drawReveal);
  }

  finishMinigame(ok) {
    const S = this.S;
    const lost = S.lost;
    const name = this.player(lost.pid)?.name || 'Someone';
    S.gains = {};
    if (ok) this.addScore(lost.pid, 300);
    else this.addScore(lost.pid, -lost.stake);
    S.mg.result = ok;
    this.emit('sfx', ok ? 'great' : 'howl');
    this.emit('say', ok ? `${name} found the trail home!` : `${name} lost some honey to the woods.`);
    this.go('mgResult', TIMES.mgResult);
  }

  // ---------- finale ----------
  startFinale() {
    const S = this.S;
    S.watch = null;
    S.lost = null;
    S.gains = {};
    S.mg = { type: 'finale', questions: this.takeTrivia(5), qi: -1 };
    this.emit('say', 'Last light. The sun is almost up. Five final questions, double honey. Make it count.');
    this.go('finaleIntro', TIMES.finaleIntro);
  }

  finish() {
    const S = this.S;
    S.gains = {};
    const ranked = this.ranked();
    if (ranked[0]) this.emit('say', `Dawn breaks. ${ranked[0].name} survived the night with the most honey. Archie and Honey approve.`);
    this.emit('sfx', 'great');
    this.go('end', null);
  }

  ranked() { return this.S.players.slice().sort((a, b) => b.score - a.score); }

  // ---------- everyone done? ----------
  waitingOn() {
    const S = this.S;
    const ids = this.connected().map(p => p.id);
    const mg = S.mg;
    switch (S.phase) {
      case 'pick': return [S.watch.watcherId].filter(id => this.player(id)?.connected);
      case 'guess': return ids.filter(id => !S.watch.guesses[id]);
      case 'triviaQ': case 'finaleQ': case 'pollQ': return ids.filter(id => !mg.answers[id]);
      case 'drawDraw': return ids.filter(id => mg.prompts[id] && !mg.drawings[id]);
      case 'drawFib': return ids.filter(id => id !== this.artistId() && !mg.lies[id]);
      case 'drawVote': return ids.filter(id => id !== this.artistId() && mg.votes[id] == null);
      default: return [];
    }
  }

  checkAllDone() {
    const phases = ['guess', 'triviaQ', 'finaleQ', 'pollQ', 'drawDraw', 'drawFib', 'drawVote'];
    if (!phases.includes(this.S.phase)) return;
    if (this.waitingOn().length === 0 && this.S.pausedLeft == null) {
      // a short beat so the last lock-in is visible
      this.S.deadline = Math.min(this.S.deadline || Infinity, Date.now() + 600 * Math.min(1, this.speed * 4));
    }
  }

  // ---------- phone views ----------
  viewFor(pid) {
    const S = this.S;
    const me = this.player(pid);
    if (!me) return { screen: 'gone' };
    const base = { me: { name: me.name, avatar: me.avatar, score: me.score }, gain: S.gains[pid] || 0 };
    const wait = (title, sub = '', emoji = '🏕️') => ({ ...base, screen: 'wait', title, sub, emoji });
    const w = S.watch;
    const watcher = w && this.player(w.watcherId);
    const lostName = S.lost && this.player(S.lost.pid)?.name;
    const mg = S.mg;
    const isLost = S.lost && S.lost.pid === pid;

    switch (S.phase) {
      case 'lobby': return { ...base, screen: 'lobby' };
      case 'intro': return wait('Look at the TV', 'The night is starting…', '🌲');
      case 'turnStart':
        return w.watcherId === pid ? wait("You're on night watch!", 'Get 3 in a row to get back to the cabin.', '🔦')
          : wait(`${watcher?.name} is on night watch`, 'You can still bet on every card.', '🔦');
      case 'pick':
        if (w.watcherId === pid) {
          return {
            ...base, screen: 'pick', streak: w.streak,
            piles: S.piles.map(p => ({ name: p.name, top: p.cards[p.cards.length - 1], depth: p.cards.length }))
          };
        }
        return wait(`${watcher?.name} is choosing where to look…`, `Streak: ${w.streak}/3`, '👀');
      case 'guess': {
        const pile = S.piles[w.pile];
        return {
          ...base, screen: 'guess', watcher: w.watcherId === pid, watcherName: watcher?.name,
          top: pile.cards[pile.cards.length - 1], pileName: pile.name, depth: w.depth, streak: w.streak,
          locked: w.guesses[pid] || null
        };
      }
      case 'reveal': {
        const mine = w.guesses[pid];
        if (!mine) return wait(`It was ${w.drawn.r}${w.drawn.s}`, 'You didn\'t guess this one.', '🃏');
        return wait(w.results[pid] ? 'Correct!' : 'Wrong!', `You said ${mine}. It was ${w.drawn.r}${w.drawn.s}.`, w.results[pid] ? '✅' : '❌');
      }
      case 'safe': return wait(w.watcherId === pid ? 'You made it back!' : `${watcher?.name} made it back!`, 'Safe inside the cabin.', '🏠');
      case 'dragged': return wait(isLost ? "You're lost in the woods!" : `${lostName} is lost in the woods!`, `Taken by ${S.danger}.`, '🌲');
      case 'mgIntro': {
        const m = MINIGAMES[mg.type];
        return wait(m.name, isLost ? `You're the lost one! ${m.rules}` : m.rules, m.emoji);
      }
      case 'triviaQ': case 'finaleQ': case 'pollQ': {
        const q = mg.questions[mg.qi];
        const poll = S.phase === 'pollQ';
        return {
          ...base, screen: 'choices',
          title: poll ? 'Cabin Census' : S.phase === 'finaleQ' ? 'Last Light' : 'Bear Trivia',
          q: q.q, sub: poll ? 'Pick what you think MOST people will pick' : '',
          choices: (poll ? this.pollChoices(q) : q.c).map(text => ({ text })),
          locked: mg.answers[pid] ? mg.answers[pid].i : null,
          num: `${mg.qi + 1}/${mg.questions.length}`
        };
      }
      case 'triviaA': case 'finaleA': {
        const q = mg.questions[mg.qi];
        const a = mg.answers[pid];
        return wait(a && a.i === q.a ? 'Correct!' : 'Nope!', `Answer: ${q.c[q.a]}`, a && a.i === q.a ? '✅' : '❌');
      }
      case 'pollA': {
        const q = mg.questions[mg.qi];
        const a = mg.answers[pid];
        const hit = a && q.top > 0 && q.counts[a.i] === q.top;
        return wait(hit ? 'You read the room!' : 'Not the crowd favorite', '', hit ? '✅' : '🤷');
      }
      case 'drawDraw':
        if (!mg.prompts[pid]) return wait('Everyone is drawing…', '', '🖍️');
        return { ...base, screen: 'draw', prompt: mg.prompts[pid], done: Boolean(mg.drawings[pid]) };
      case 'drawFib':
        if (pid === this.artistId()) return wait('This is your drawing!', 'Everyone is writing fake titles for it…', '🖼️');
        return { ...base, screen: 'fib', done: Boolean(mg.lies[pid]), drawing: mg.di };
      case 'drawVote':
        if (pid === this.artistId()) return wait("Don't give it away!", 'Everyone is guessing the real title…', '🤐');
        return {
          ...base, screen: 'choices', title: 'Find the real title', q: 'Which one is the real title?', sub: '',
          choices: mg.options.map(o => ({ text: o.text, disabled: o.owners.includes(pid) })),
          locked: mg.votes[pid] ?? null
        };
      case 'drawReveal': return wait('Look at the TV', 'Who got fooled?', '😈');
      case 'mgResult': return wait(mg.result ? `${lostName} made it home!` : `${lostName} lost honey to the woods`, '', mg.result ? '🏠' : '💀');
      case 'scores': {
        const rank = this.ranked().findIndex(p => p.id === pid) + 1;
        return wait(`You're #${rank}`, `${me.score} 🍯`, '📊');
      }
      case 'finaleIntro': return wait('Last Light', 'Five questions. Double honey.', '🌅');
      case 'end': {
        const rank = this.ranked().findIndex(p => p.id === pid) + 1;
        return { ...base, screen: 'end', rank, total: S.players.length };
      }
      default: return wait('Look at the TV', '', '📺');
    }
  }
}
