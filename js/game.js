// Honeybox game rules. Runs on the TV (host). No DOM here.
// State lives in this.S (plain JSON, so it can be saved and resumed).

import { PILE_NAMES, DANGERS, TRIVIA, DRAW_PROMPTS, POLLS, AVATARS } from './content.js';

export const CLOCK = ['12 AM', '2 AM', '4 AM', '6 AM'];

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export const SEC = 1000;
export const TIMES = {
  intro: 22, turnStart: 9, pick: 30, guess: 20, reveal: 8, safe: 6, dragged: 7,
  mgIntro: 8, triviaQ: 20, triviaA: 8, pollQ: 20, pollA: 9,
  drawDraw: 80, drawFib: 35, drawVote: 20, drawReveal: 14, drawGallery: 9, mgResult: 6, scores: 9,
  finaleIntro: 9, finalePick: 20, finaleQ: 18, finaleA: 8,
  stakesIntro: 14, stakesBet: 20, stakesShow: 5, stakesReveal: 8
};

export const MINIGAMES = {
  trivia: { name: 'Bear Trivia', emoji: '🐻', rules: 'Answer 3 questions. Dragged off? Get 2 right to escape.' },
  draw: { name: 'Sketchy Woods', emoji: '🖍️', rules: 'Draw your secret prompt. Then fib a title for the drawing and find the real one. The captured player needs someone to guess theirs.' },
  poll: { name: 'Cabin Census', emoji: '📋', rules: 'Pick the answer you think MOST people will pick. Dragged off? Match the crowd 2 of 3 times to escape.' }
};

export const LENGTHS = { short: 5, normal: 7, long: 10 };

// Finale choices for last place
export const FINALES = {
  stakes: { name: 'Sunrise Stakes', emoji: '🌅', blurb: '5 cards, worth 200 up to 1,000. Right wins it, wrong loses it.' },
  trivia: { name: 'Trivia Blitz', emoji: '🐻', blurb: '5 questions, double honey.' },
  draw: { name: 'Sketchy Woods', emoji: '🖍️', blurb: 'Everyone draws a secret prompt, then fib and guess. Double honey.' },
  poll: { name: 'Cabin Census', emoji: '📋', blurb: 'Pick what most people will pick. Double honey.' }
};

// how long the card shakes face-down before it flips
export const SUSPENSE_MS = 1600;

// What's on the line each card. Watcher: win/same pay per pile depth, a miss risks `risk` in the woods.
export const SIDE = { right: 100, same: 400 };
export const BANISH = 300; // bonus for a correct call on the animatronic's spot

// Night events: one is drawn at the start of each night shift and lasts for that shift
export const EVENTS = {
  calm: { name: 'A Quiet Night', emoji: '🌌', text: 'Nothing strange tonight… too quiet.' },
  outage: { name: 'Power Outage', emoji: '🔦', text: 'The board goes dark. You only see a card after you pick its spot.' },
  moon: { name: 'Full Moon', emoji: '🌕', text: 'SAME pays double tonight.' },
  cold: { name: 'Cold Snap', emoji: '🧊', text: 'Ties count as a win for the night shift.' },
  dogs: { name: 'Archie & Honey on Patrol', emoji: '🐕', text: 'The dogs will save the night shift from one miss.' },
  wind: { name: 'Mount Washington Wind', emoji: '🌪️', text: 'The card piles blew around the map!' },
  fever: { name: 'Funspot Fever', emoji: '🎪', text: 'Everyone else\'s side bets pay double tonight.' },
  jackpot: { name: 'Jackpot Night', emoji: '🎰', text: 'The night shift earns double for correct calls.' }
};
export function stakesFor(depth) {
  const d = Math.max(1, depth);
  return { win: 100 * d, same: 200 * d, risk: Math.max(200, 100 * d) };
}

// Sketchy Woods: how many drawings get the full fib-and-vote treatment
export const DRAW_JUDGED = 4;

// story screens that wait for the narrator before moving on
export const NARRATED = ['intro', 'turnStart', 'safe', 'dragged', 'mgIntro', 'mgResult', 'finaleIntro', 'stakesIntro'];

// Wager percentages, minimum bankroll for broke players, payouts
// Sunrise Stakes: each card is worth more; right wins it, wrong loses it
export const STAKES = { values: [200, 300, 400, 500, 1000], sameMult: 4, boost: 1.5 };

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
      danger: null,
      seq: 0
    };
    if (saved && saved.deadline) this.S.deadline = Date.now() + (saved.phaseMs || 10 * SEC);
    if (saved && !this.S.monster && this.S.piles?.length) this.spawnMonster();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, data) { for (const fn of this.listeners) fn(type, data); }
  changed() { this.S.seq++; this.emit('change'); }

  // ---------- players ----------
  player(id) { return this.S.players.find(p => p.id === id); }
  connected() { return this.S.players.filter(p => p.connected); }

  // one character per player
  avatarFree(avatar, id) {
    return AVATARS.includes(avatar) && !this.S.players.some(p => p.id !== id && p.avatar === avatar);
  }

  join(id, name, avatar) {
    let p = this.player(id);
    if (p) {
      p.connected = true;
      if (name) p.name = name;
      if (avatar && this.avatarFree(avatar, id)) p.avatar = avatar;
    } else {
      if (this.S.players.length >= 8) return { error: 'Sorry, the cabin is full (8 players max).' };
      const pickAvatar = this.avatarFree(avatar, id) ? avatar : AVATARS.find(a => this.avatarFree(a, id));
      p = { id, name: name || 'Camper', avatar: pickAvatar, score: 0, connected: true };
      this.S.players.push(p);
      this.emit('mood', { pid: id, mood: 'happy', tv: true });
    }
    this.changed();
    this.checkAllDone();
    return { ok: true, avatar: p.avatar, swapped: Boolean(avatar) && avatar !== p.avatar };
  }

  setConnected(id, on) {
    const p = this.player(id);
    if (!p || p.connected === on) return;
    p.connected = on;
    this.changed();
    if (!on) this.checkAllDone();
  }

  setAvatar(id, avatar) {
    const p = this.player(id);
    if (!p || !this.avatarFree(avatar, id)) return false;
    p.avatar = avatar;
    this.emit('mood', { pid: id, mood: 'happy', tv: true });
    this.changed();
    return true;
  }

  kick(id) {
    if (this.S.phase !== 'lobby') return;
    this.S.players = this.S.players.filter(p => p.id !== id);
    this.changed();
  }

  // drumroll -> flip -> verdict, matching the TV's slow card reveal
  suspense(verdict) {
    const k = Math.min(1, this.speed * 4);
    this.emit('sfx', 'drumroll');
    setTimeout(() => this.emit('sfx', 'flip'), SUSPENSE_MS * k);
    setTimeout(() => this.emit('sfx', verdict), (SUSPENSE_MS + 500) * k);
  }

  addScore(id, n) {
    if (n > 0 && this.S.mg?.finale) n *= 2; // finale minigames pay double honey
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

  // Story screens wait for the narrator to finish (the TV sets speaking), up to a safety cap.
  isNarrated() { return NARRATED.includes(this.S.phase); }

  tick() {
    if (this.S.pausedLeft != null || !this.S.deadline) return;
    if (this.speaking && this.isNarrated() && Date.now() < this.S.deadline + 15000) return;
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
    // fresh random order every round; everyone gets the same number of turns, no back-to-back across rounds
    S.turnOrder = [];
    for (let r = 0; r < rounds; r++) {
      let order = shuffle(S.players.map(p => p.id));
      if (order.length > 1 && order[0] === S.turnOrder[S.turnOrder.length - 1]) order.push(order.shift());
      S.turnOrder.push(...order);
    }
    S.turnIdx = -1;
    S.deck = makeDeck();
    S.piles = PILE_NAMES.map(name => ({ name, cards: [S.deck.pop()] }));
    S.bag = [];
    S.players.forEach(p => { p.score = 0; });
    S.board = {};
    S.event = null;
    S.lastEvent = null;
    this.spawnMonster();
    this.emit('say', 'Welcome to the cabin on Lake Winnipesaukee. Story Land, Funspot and Santa\'s Village closed hours ago. But the animatronics are still moving. Survive until 6 A M.');
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
      case 'safe': this.S.gains = {}; return this.go('scores', TIMES.scores);
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
      case 'drawGallery': return this.S.mg.finale ? this.finish() : this.finishMinigame(this.S.mg.lostOk);
      case 'finalePick': return this.chooseFinale(null, null);
      case 'mgResult': this.S.gains = {}; return this.go('scores', TIMES.scores);
      case 'scores': this.snapshotScores(); return this.nextTurn();
      case 'finaleIntro': return this.askTrivia();
      case 'stakesIntro': return this.stakesRound();
      case 'stakesBet': return this.showStakes();
      case 'stakesShow': return this.revealStakes();
      case 'stakesReveal': return this.stakesRound();
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
    const keys = Object.keys(EVENTS).filter(k => k !== S.lastEvent);
    S.event = pick(keys);
    S.lastEvent = S.event;
    if (S.event === 'wind') {
      const stacks = shuffle(S.piles.map(p => p.cards));
      S.piles.forEach((p, i) => { p.cards = stacks[i]; });
    }
    const ev = EVENTS[S.event];
    this.emit('say', `${w.name}, you're on the night shift. Tonight: ${ev.name}. ${ev.text}`);
    this.go('turnStart', TIMES.turnStart);
  }

  // ---------- the roaming animatronic & event modifiers ----------
  spawnMonster(avoid = -1) {
    const S = this.S;
    const spots = S.piles.map((_, i) => i).filter(i => i !== avoid);
    const kind = pick(DANGERS.filter(d => d.name !== S.monster?.name));
    S.monster = { pile: pick(spots), name: kind.name, emoji: kind.emoji };
  }

  moveMonster() {
    const S = this.S;
    const spots = S.piles.map((_, i) => i).filter(i => i !== S.monster.pile);
    S.monster.pile = pick(spots);
  }

  // what a pile is worth right now, including tonight's event and the animatronic
  stakesNow(i) {
    const S = this.S;
    const base = stakesFor(S.piles[i].cards.length);
    const haunted = Boolean(S.monster && S.monster.pile === i);
    const jackpot = S.event === 'jackpot' ? 2 : 1;
    return {
      win: base.win * jackpot,
      same: base.same * jackpot * (S.event === 'moon' ? 2 : 1),
      risk: base.risk * (haunted ? 2 : 1),
      haunted,
      banish: haunted ? BANISH : 0
    };
  }

  side() {
    const S = this.S;
    const fever = S.event === 'fever' ? 2 : 1;
    return { right: SIDE.right * fever, same: SIDE.same * fever * (S.event === 'moon' ? 2 : 1) };
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
    S.watch.st = this.stakesNow(i);
    S.watch.saved = false;
    S.watch.banished = false;
    S.watch.coldTie = false;
    if (S.watch.st.haunted) this.emit('say', `Careful. ${S.monster.name} is lurking there.`);
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
      this.emit('say', 'The deck is empty. Shuffling the cards back in.');
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
    const side = this.side();
    const st = w.st || this.stakesNow(w.pile);
    for (const [pid, choice] of Object.entries(w.guesses)) {
      let ok = choice === actual;
      // Cold Snap: a tie on HIGH/LOW counts as a win for the watcher
      if (pid === w.watcherId && !ok && S.event === 'cold' && actual === 'SAME') { ok = true; w.coldTie = true; }
      results[pid] = ok;
      if (pid !== w.watcherId && ok) this.addScore(pid, choice === 'SAME' ? side.same : side.right);
    }
    const mine = w.guesses[w.watcherId];
    const ok = results[w.watcherId];
    if (ok) {
      if (mine === 'SAME') { w.streak = 3; this.addScore(w.watcherId, st.same); }
      else { w.streak++; this.addScore(w.watcherId, st.win); }
      if (st.haunted) { w.banished = true; this.addScore(w.watcherId, BANISH); }
    } else if (S.event === 'dogs' && !w.dogsUsed) {
      // Archie & Honey: one free miss per shift
      w.saved = true;
      w.dogsUsed = true;
    }
    w.risk = st.risk;
    // character sounds: everyone hears their own on their phone; the TV voices the watcher
    for (const [pid, r] of Object.entries(results)) this.emit('mood', { pid, mood: r ? 'happy' : 'sad', tv: pid === w.watcherId, delay: 2100 });
    w.drawn = drawn;
    w.top = top;
    w.actual = actual;
    w.results = results;
    w.tie = actual === 'SAME' && mine !== 'SAME';
    this.suspense(ok ? (mine === 'SAME' || w.banished ? 'great' : 'good') : w.saved ? 'good' : 'bad');
    this.go('reveal', TIMES.reveal);
  }

  afterReveal() {
    const S = this.S;
    const w = S.watch;
    const name = this.player(w.watcherId)?.name || 'Someone';
    const lurker = { ...S.monster };
    if (w.banished) {
      this.emit('say', `${name} banished ${S.monster.name}! Plus ${BANISH} honey.`);
      this.spawnMonster(w.pile);
    } else {
      this.moveMonster();
    }
    if (w.saved) {
      w.pile = null;
      S.gains = {};
      this.emit('say', 'Archie and Honey chased it off! The night shift continues.');
      return this.go('pick', TIMES.pick);
    }
    if (w.results[w.watcherId]) {
      if (w.streak >= 3) {
        S.gains = {};
        this.addScore(w.watcherId, 500);
        this.emit('sfx', 'great');
        this.emit('say', `6 A M! ${name} survived the night shift. The dogs are thrilled.`);
        this.emit('mood', { pid: w.watcherId, mood: 'happy', tv: true, delay: 600 });
        return this.go('safe', TIMES.safe);
      }
      w.pile = null;
      S.gains = {};
      return this.go('pick', TIMES.pick);
    }
    S.lost = { pid: w.watcherId, stake: w.risk || stakesFor(w.depth).risk };
    S.danger = w.st?.haunted ? { name: lurker.name, emoji: lurker.emoji } : pick(DANGERS);
    S.gains = {};
    this.emit('sfx', 'scare');
    this.emit('say', `Oh no. ${name} was dragged off by ${S.danger.name}.`);
    this.emit('mood', { pid: w.watcherId, mood: 'sad', tv: true, delay: 1300 });
    return this.go('dragged', TIMES.dragged);
  }

  // ---------- minigames ----------
  startMinigame() {
    const S = this.S;
    // Cabin Census needs a crowd: skip it with fewer than 3 players
    const allowed = Object.keys(MINIGAMES).filter(t => t !== 'poll' || this.connected().length >= 3);
    S.bag = S.bag.filter(t => allowed.includes(t));
    if (!S.bag.length) S.bag = shuffle(allowed);
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
    for (const p of this.connected()) {
      const a = mg.answers[p.id];
      this.emit('mood', { pid: p.id, mood: a && a.i === q.a ? 'happy' : 'sad', tv: false, delay: 2000 });
    }
    this.emit('sfx', 'good');
    this.emit('say', 'The answer is…');
    setTimeout(() => this.emit('say', `${q.c[q.a]}.`), 1500 * Math.min(1, this.speed * 4));
    this.go(finale ? 'finaleA' : 'triviaA', finale ? TIMES.finaleA : TIMES.triviaA);
  }

  nextTrivia() {
    const mg = this.S.mg;
    if (mg.qi + 1 < mg.questions.length) return this.askTrivia();
    if (mg.type === 'finale' || mg.finale) return this.finish();
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
    for (const [pid, a] of Object.entries(mg.answers)) this.emit('mood', { pid, mood: top > 0 && counts[a.i] === top ? 'happy' : 'sad', tv: false, delay: 2600 });
    this.emit('sfx', 'good');
    this.go('pollA', TIMES.pollA);
  }

  nextPoll() {
    const mg = this.S.mg;
    if (mg.qi + 1 < mg.questions.length) return this.askPoll();
    if (mg.finale) return this.finish();
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
    const lostId = S.lost?.pid;
    const others = shuffle(Object.keys(mg.drawings).filter(id => id !== lostId && mg.drawings[id].length));
    // judge everyone's drawing (captured player first); with a big group the extras go to a gallery
    mg.judged = lostId ? [lostId, ...others.slice(0, DRAW_JUDGED - 1)] : others.slice(0, DRAW_JUDGED);
    mg.gallery = others.slice(DRAW_JUDGED - 1);
    mg.di = -1;
    return this.nextDrawing();
  }

  nextDrawing() {
    const S = this.S;
    const mg = S.mg;
    mg.di++;
    if (mg.di >= mg.judged.length) {
      if (mg.gallery?.length && S.phase !== 'drawGallery') { S.gains = {}; return this.go('drawGallery', TIMES.drawGallery); }
      return mg.finale ? this.finish() : this.finishMinigame(mg.lostOk);
    }
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
    if (S.lost && artist === S.lost.pid) mg.lostOk = found > 0;
    for (const [pid, i] of Object.entries(mg.votes)) this.emit('mood', { pid, mood: mg.options[i].real ? 'happy' : 'sad', tv: false });
    this.emit('mood', { pid: artist, mood: found ? 'happy' : 'sad', tv: true, delay: 500 });
    this.emit('sfx', found ? 'good' : 'bad');
    // the TV reveals lies first and the truth last, so hold the narration until then
    setTimeout(() => this.emit('say', `The real title was: ${mg.prompts[artist]}.`), (mg.options.length - 1) * 1300 * Math.min(1, this.speed * 4));
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
    this.emit('say', ok ? `${name} escaped the animatronics!` : `${name} is still captured, and lost some honey.`);
    this.emit('mood', { pid: lost.pid, mood: ok ? 'happy' : 'sad', tv: true, delay: 400 });
    this.go('mgResult', TIMES.mgResult);
  }

  // ---------- finale ----------
  // Last place picks how the night ends
  finaleOptions() {
    return Object.keys(FINALES).filter(k => k !== 'poll' || this.connected().length >= 3);
  }

  startFinale() {
    const S = this.S;
    S.watch = null;
    S.lost = null;
    S.gains = {};
    const pool = this.connected().length ? this.connected() : S.players;
    const low = Math.min(...pool.map(p => p.score));
    const picker = pick(pool.filter(p => p.score === low));
    S.mg = { type: 'finalePick', picker: picker?.id, options: this.finaleOptions() };
    this.emit('say', `Five A M. The sun is almost up. ${picker?.name || 'Someone'}, you're in last place, so you choose how the night ends.`);
    this.go('finalePick', TIMES.finalePick);
  }

  chooseFinale(pid, choice) {
    const S = this.S;
    if (S.phase !== 'finalePick' || (pid && pid !== S.mg.picker)) return;
    const options = S.mg.options;
    const kind = options.includes(choice) ? choice : pick(options);
    const picker = this.player(S.mg.picker);
    if (kind !== 'draw' && kind !== 'poll') this.emit('say', `${picker?.name || 'Last place'} chose ${FINALES[kind].name}.`);
    this.emit('sfx', 'great');
    if (kind === 'stakes') return this.startStakes();
    if (kind === 'trivia') {
      S.mg = { type: 'finale', questions: this.takeTrivia(5), qi: -1, chosenBy: picker?.id };
      return this.go('finaleIntro', TIMES.finaleIntro);
    }
    // a regular minigame, but nobody is captured and all honey is doubled
    S.mg = { type: kind, lostOk: false, finale: true, chosenBy: picker?.id };
    this.emit('say', `${FINALES[kind].name}. ${FINALES[kind].blurb}`);
    return this.go('mgIntro', TIMES.mgIntro);
  }

  // ---------- Sunrise Stakes: bet your honey on the last cards ----------
  startStakes() {
    const S = this.S;
    const ranked = this.ranked();
    const boosted = ranked.slice(Math.ceil(ranked.length / 2)).map(p => p.id);
    S.gains = {};
    S.mg = { type: 'stakes', round: 0, rounds: STAKES.values.length, boosted, bets: {} };
    const names = boosted.map(id => this.player(id)?.name).filter(Boolean);
    this.emit('say', `The Sunrise Stakes. Five cards, each worth more than the last. Right wins it, wrong loses it.${names.length ? ` ${names.join(' and ')}, you get a comeback boost.` : ''}`);
    this.go('stakesIntro', TIMES.stakesIntro);
  }

  stakesRound() {
    const S = this.S;
    const mg = S.mg;
    if (mg.round >= mg.rounds) return this.finish();
    mg.round++;
    mg.bets = {};
    mg.drawn = null;
    mg.pile = Math.floor(Math.random() * S.piles.length);
    S.gains = {};
    if (mg.round === mg.rounds) this.emit('say', 'Final card. One thousand honey. The sun is coming up.');
    this.go('stakesBet', TIMES.stakesBet);
  }

  cardValue() { return STAKES.values[this.S.mg.round - 1]; }

  stake(pid, choice) {
    const S = this.S;
    if (S.phase !== 'stakesBet' || !this.player(pid) || S.mg.bets[pid]) return;
    if (!['HIGH', 'LOW', 'SAME'].includes(choice)) return;
    S.mg.bets[pid] = { choice, amount: this.cardValue() };
    this.emit('sfx', 'lock');
    this.changed();
    this.checkAllDone();
  }

  showStakes() {
    const bets = this.S.mg.bets;
    const same = Object.entries(bets).filter(([, b]) => b.choice === 'SAME').map(([id]) => this.player(id)?.name);
    this.emit('say', same.length ? `${same.join(' and ')} called SAME. Bold.` : 'Calls are locked.');
    this.go('stakesShow', TIMES.stakesShow);
  }

  revealStakes() {
    const S = this.S;
    const mg = S.mg;
    const pile = S.piles[mg.pile];
    const top = pile.cards[pile.cards.length - 1];
    const drawn = this.drawCard();
    const actual = drawn.v > top.v ? 'HIGH' : drawn.v < top.v ? 'LOW' : 'SAME';
    pile.cards.push(drawn);
    mg.top = top;
    mg.drawn = drawn;
    mg.actual = actual;
    S.gains = {};
    let anyWin = false;
    for (const [pid, b] of Object.entries(mg.bets)) {
      b.won = b.choice === actual;
      if (b.won) {
        anyWin = true;
        const mult = (b.choice === 'SAME' ? STAKES.sameMult : 1) * (mg.boosted.includes(pid) ? STAKES.boost : 1);
        this.addScore(pid, Math.round(b.amount * mult / 10) * 10);
      } else {
        this.addScore(pid, -b.amount);
      }
    }
    for (const [pid, b] of Object.entries(mg.bets)) this.emit('mood', { pid, mood: b.won ? 'happy' : 'sad', tv: b.choice === 'SAME' || this.S.mg.round === this.S.mg.rounds, delay: 2100 });
    this.suspense(anyWin ? 'good' : 'bad');
    this.go('stakesReveal', TIMES.stakesReveal);
  }

  finish() {
    const S = this.S;
    S.gains = {};
    const ranked = this.ranked();
    if (ranked[0]) this.emit('say', `6 A M. The animatronics power down. ${ranked[0].name} survived with the most honey. Archie and Honey approve.`);
    if (ranked[0]) this.emit('mood', { pid: ranked[0].id, mood: 'happy', tv: true, delay: 1200 });
    if (ranked.length > 1) this.emit('mood', { pid: ranked[ranked.length - 1].id, mood: 'sad', tv: true, delay: 2200 });
    this.emit('sfx', 'great');
    this.go('end', null);
  }

  snapshotScores() { this.S.board = Object.fromEntries(this.S.players.map(p => [p.id, p.score])); }

  // The first connected player is the VIP and gets host controls on their phone
  vipId() { return this.S.players.find(p => p.connected)?.id || null; }

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
      case 'stakesBet': return ids.filter(id => !mg.bets[id]);
      case 'finalePick': return [mg.picker].filter(id => this.player(id)?.connected);
      case 'drawDraw': return ids.filter(id => mg.prompts[id] && !mg.drawings[id]);
      case 'drawFib': return ids.filter(id => id !== this.artistId() && !mg.lies[id]);
      case 'drawVote': return ids.filter(id => id !== this.artistId() && mg.votes[id] == null);
      default: return [];
    }
  }

  checkAllDone() {
    const phases = ['guess', 'triviaQ', 'finaleQ', 'pollQ', 'drawDraw', 'drawFib', 'drawVote', 'stakesBet'];
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
    const base = { me: { name: me.name, avatar: me.avatar, score: me.score }, gain: S.gains[pid] || 0, vip: this.vipId() === pid, story: this.isNarrated() };
    const wait = (title, sub = '', emoji = '🏕️') => ({ ...base, screen: 'wait', title, sub, emoji });
    const w = S.watch;
    const watcher = w && this.player(w.watcherId);
    const lostName = S.lost && this.player(S.lost.pid)?.name;
    const mg = S.mg;
    const isLost = S.lost && S.lost.pid === pid;

    switch (S.phase) {
      case 'lobby': return { ...base, screen: 'lobby', length: S.length, count: S.players.length, taken: S.players.filter(p => p.id !== pid).map(p => p.avatar) };
      case 'intro': return wait('Look at the TV', 'The night is starting…', '🌲');
      case 'turnStart': {
        const ev = EVENTS[S.event] || EVENTS.calm;
        return w.watcherId === pid ? wait(`You're on the night shift! ${ev.emoji} ${ev.name}`, ev.text, '🔦')
          : wait(`${watcher?.name} is on the night shift`, `${ev.emoji} ${ev.name}: ${ev.text}`, '🔦');
      }
      case 'pick':
        if (w.watcherId === pid) {
          return {
            ...base, screen: 'pick', streak: w.streak,
            event: EVENTS[S.event], monster: S.monster,
            piles: S.piles.map((p, i) => ({ name: p.name, top: S.event === 'outage' ? null : p.cards[p.cards.length - 1], depth: p.cards.length, ...this.stakesNow(i) }))
          };
        }
        return wait(`${watcher?.name} is choosing where to look…`, `It's ${CLOCK[w.streak]}`, '👀');
      case 'guess': {
        const pile = S.piles[w.pile];
        return {
          ...base, screen: 'guess', watcher: w.watcherId === pid, watcherName: watcher?.name,
          top: pile.cards[pile.cards.length - 1], pileName: pile.name, depth: w.depth, streak: w.streak,
          locked: w.guesses[pid] || null, ...(w.st || this.stakesNow(w.pile)), side: this.side(), event: EVENTS[S.event], monster: S.monster
        };
      }
      case 'reveal': {
        const mine = w.guesses[pid];
        if (!mine) return { ...wait(`It was ${w.drawn.r}${w.drawn.s}`, 'You didn\'t guess this one.', '🃏'), suspense: true };
        if (pid === w.watcherId && w.saved) return { ...wait('Saved by the dogs!', `It was ${w.drawn.r}${w.drawn.s}. Archie & Honey chased it off.`, '🐕'), suspense: true };
        if (pid === w.watcherId && w.banished) return { ...wait('You banished it!', `+${BANISH} bonus. It was ${w.drawn.r}${w.drawn.s}.`, '⚡'), suspense: true };
        return { ...wait(w.results[pid] ? 'Correct!' : 'Wrong!', `You said ${mine}. It was ${w.drawn.r}${w.drawn.s}.`, w.results[pid] ? '✅' : '❌'), suspense: true };
      }
      case 'safe': return wait(w.watcherId === pid ? 'You made it to 6 AM!' : `${watcher?.name} made it to 6 AM!`, 'Safe inside the cabin.', '🏠');
      case 'dragged': return wait(isLost ? "You got dragged off!" : `${lostName} got dragged off!`, `By ${S.danger.name}.`, S.danger.emoji);
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
        return { ...wait(a && a.i === q.a ? 'Correct!' : 'Nope!', `Answer: ${q.c[q.a]}`, a && a.i === q.a ? '✅' : '❌'), suspense: true };
      }
      case 'pollA': {
        const q = mg.questions[mg.qi];
        const a = mg.answers[pid];
        const hit = a && q.top > 0 && q.counts[a.i] === q.top;
        return { ...wait(hit ? 'You read the room!' : 'Not the crowd favorite', '', hit ? '✅' : '🤷'), suspense: true };
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
      case 'drawGallery': return wait('The gallery', 'Bonus masterpieces on the TV', '🖼️');
      case 'mgResult': return wait(mg.result ? `${lostName} made it home!` : `${lostName} lost honey to the animatronics`, '', mg.result ? '🏠' : '💀');
      case 'scores': {
        const rank = this.ranked().findIndex(p => p.id === pid) + 1;
        return wait(`You're #${rank}`, `${me.score} 🍯`, '📊');
      }
      case 'finaleIntro': return wait('Trivia Blitz', 'Five questions. Double honey.', '🐻');
      case 'finalePick': {
        if (pid === mg.picker) return { ...base, screen: 'finale', options: mg.options.map(k => ({ key: k, ...FINALES[k] })) };
        return wait(`${this.player(mg.picker)?.name} is choosing the finale…`, "Last place picks how the night ends.", '🌅');
      }
      case 'stakesIntro':
        return wait('Sunrise Stakes', mg.boosted.includes(pid) ? 'You get a 1.5× comeback boost on wins!' : 'Bet your honey on the last 5 cards.', '🌅');
      case 'stakesBet': {
        const pile = S.piles[mg.pile];
        return {
          ...base, screen: 'stakes', round: `${mg.round}/${mg.rounds}`, top: pile.cards[pile.cards.length - 1], pileName: pile.name,
          value: this.cardValue(), same: this.cardValue() * STAKES.sameMult, boosted: mg.boosted.includes(pid), locked: mg.bets[pid] || null
        };
      }
      case 'stakesShow': {
        const b = mg.bets[pid];
        return wait(b ? `You said ${b.choice}` : 'No call', 'Here comes the card…', '🃏');
      }
      case 'stakesReveal': {
        const b = mg.bets[pid];
        if (!b) return { ...wait(`It was ${mg.drawn.r}${mg.drawn.s}`, 'You sat this one out.', '🃏'), suspense: true };
        return { ...wait(b.won ? 'You won the bet!' : 'Lost the bet!', `It was ${mg.drawn.r}${mg.drawn.s}`, b.won ? '🤑' : '💸'), suspense: true };
      }
      case 'end': {
        const rank = this.ranked().findIndex(p => p.id === pid) + 1;
        return { ...base, screen: 'end', rank, total: S.players.length };
      }
      default: return wait('Look at the TV', '', '📺');
    }
  }
}
