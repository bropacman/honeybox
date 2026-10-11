// Honeybox game rules. Runs on the TV (host). No DOM here.
// State lives in this.S (plain JSON, so it can be saved and resumed).

import { PILE_NAMES, DANGERS, TRIVIA, DRAW_PROMPTS, POLLS, AVATARS, TOT, isLocal } from './content.js';

export const CLOCK = ['12 AM', '2 AM', '4 AM', '6 AM'];

export const SEC = 1000;
export const TIMES = {
  intro: 26, turnStart: 11, pick: 12, tot: 20, totReveal: 7, decide: 15, decideReveal: 6, safe: 6, dragged: 7,
  mgIntro: 8, triviaQ: 20, triviaA: 8, pollQ: 20, pollA: 9,
  drawDraw: 80, drawFib: 35, drawVote: 20, drawReveal: 14, drawGallery: 9, mgResult: 6, scores: 5,
  finaleIntro: 9, finalePick: 20, finaleQ: 18, finaleA: 8,
  stakesIntro: 14, stakesBet: 20, stakesReveal: 7
};

export const MINIGAMES = {
  trivia: { name: 'Bear Trivia', emoji: '🐻', rules: 'Answer 3 questions. Dragged off? Get 2 right to escape.' },
  draw: { name: 'Sketchy Woods', emoji: '🖍️', rules: 'Draw your secret prompt. Then fib a title for the drawing and find the real one. The captured player needs someone to guess theirs.' },
  poll: { name: 'Cabin Census', emoji: '📋', rules: 'Pick the answer you think MOST people will pick. Dragged off? Match the crowd 2 of 3 times to escape.' }
};

export const LENGTHS = { short: 5, normal: 7, long: 10 };
// answer timers: short / medium / long
export const TIMERS = { short: 0.7, medium: 1, long: 1.4 };

// Finale choices for last place
export const FINALES = {
  stakes: { name: 'Sunrise Stakes', emoji: '🌅', blurb: '5 This or That questions for everyone, worth 200 up to 1,000. Right wins it, wrong loses it.' },
  trivia: { name: 'Trivia Blitz', emoji: '🐻', blurb: '5 questions, double honey.' },
  draw: { name: 'Sketchy Woods', emoji: '🖍️', blurb: 'Everyone draws a secret prompt, then fib and guess. Double honey.' },
  poll: { name: 'Cabin Census', emoji: '📋', blurb: 'Pick what most people will pick. Double honey.' }
};

// This or That categories. Each map spot is one category.
export const CATEGORIES = {
  nature: { name: 'Nature', emoji: '🌿' },
  science: { name: 'Science & Space', emoji: '🔬' },
  animals: { name: 'Animals', emoji: '🐾' },
  geo: { name: 'Geography', emoji: '🌍' },
  history: { name: 'History', emoji: '📜' },
  movies: { name: 'Movies', emoji: '🎬' },
  cartoons: { name: 'Cartoons', emoji: '🐭' },
  tv: { name: 'TV', emoji: '📺' },
  games: { name: 'Games & Toys', emoji: '🕹️' },
  tech: { name: 'Tech', emoji: '💻' },
  music: { name: 'Music', emoji: '🎵' },
  sports: { name: 'Sports', emoji: '🏆' },
  food: { name: 'Food', emoji: '🍔' },
  brands: { name: 'Brands', emoji: '🏷️' },
  wild: { name: 'Wild Card', emoji: '🎲' }
};
export const SPOT_CATEGORIES = {
  'Mt Washington': 'nature', 'Discovery Center': 'science', "Clark's Bears": 'animals', 'Flume Gorge': 'geo', 'The Kanc': 'history',
  'Weirs Drive-In': 'movies', 'Story Land': 'cartoons', 'Castle in the Clouds': 'tv', 'Funspot': 'games', 'Cog Railway': 'tech',
  'Meadowbrook': 'music', 'Loudon Speedway': 'sports', "Santa's Village": 'food', 'Settlers Green': 'brands', 'Lake Dock': 'wild'
};

// The night shift: each right answer adds to the pot (question 1, 2, 3). Bank it any time; 3 in a row = 6 AM bonus.
export const POT = [200, 300, 500];
export const SIX_AM = 500;
export const STAKE = 300;                    // lost if you stay captured; doubled on the animatronic's spot
export const SIDE = { right: 100, predict: 100 };
export const BANISH = 300;                   // bonus for a right answer on the animatronic's spot

// Night events: one is drawn at the start of each night shift and lasts for that shift
export const EVENTS = {
  calm: { name: 'A Quiet Night', emoji: '🌌', text: 'Nothing strange tonight… too quiet.' },
  outage: { name: 'Power Outage', emoji: '🔦', text: 'The map goes dark: categories stay hidden until you pick a spot.' },
  dogs: { name: 'Archie & Honey on Patrol', emoji: '🐕', text: 'The dogs will save the night shift from one miss.' },
  jackpot: { name: 'Jackpot Night', emoji: '🎰', text: 'The pot is doubled tonight.' },
  fever: { name: 'Funspot Fever', emoji: '🎪', text: 'Everyone else\'s side bets pay double tonight.' },
  wind: { name: 'Mount Washington Wind', emoji: '🌪️', text: 'The categories blew around the map!' },
  witching: { name: 'Witching Hour', emoji: '🕛', text: 'Only 10 seconds to answer tonight.' },
  moon: { name: 'Full Moon', emoji: '🌕', text: 'Banishing the animatronic pays triple tonight.' }
};

// Sketchy Woods: how many drawings get the full fib-and-vote treatment
export const DRAW_JUDGED = 4;

// story screens that wait for the narrator before moving on
export const NARRATED = ['intro', 'turnStart', 'safe', 'dragged', 'mgIntro', 'mgResult', 'finaleIntro', 'stakesIntro'];

// phases where players are answering on their phones (the last-10-seconds hurry-up applies)
export const ANSWER_PHASES = ['pick', 'tot', 'decide', 'triviaQ', 'finaleQ', 'pollQ', 'drawDraw', 'drawFib', 'drawVote', 'stakesBet', 'finalePick'];

// Sunrise Stakes: 5 This or That questions for everyone, each worth more
export const STAKES = { values: [200, 300, 400, 500, 1000], diff: [1, 2, 2, 3, 3], boost: 1.5 };

// reveal pacing: each player's answer pops in, then the right answer lights up
export const CHIP_MS = 550;
export const SPIN_MS = 3800; // the turn wheel's spin
export const REVEAL_STEP = 3600; // Sketchy Woods: time per answer in the reveal
export const revealAt = (n) => 900 + n * CHIP_MS;

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
      timers: 'medium',
      offCats: [],
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
    if (saved && !this.S.monster && this.S.spots?.length) this.spawnMonster();
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
    if (secs != null && ANSWER_PHASES.includes(phase)) secs *= TIMERS[this.S.timers] || 1;
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

  // turn This or That categories on/off in the lobby (at least 2 stay on)
  toggleCategory(cat) {
    const S = this.S;
    if (S.phase !== 'lobby' || !TOT[cat]) return;
    const off = new Set(S.offCats || []);
    if (off.has(cat)) off.delete(cat);
    else if (Object.keys(TOT).filter(c => !off.has(c)).length > 2) off.add(cat);
    S.offCats = [...off];
    this.changed();
  }

  activeCats() { return Object.keys(TOT).filter(c => !(this.S.offCats || []).includes(c)); }

  setTimers(t) {
    if (TIMERS[t] && this.S.phase === 'lobby') { this.S.timers = t; this.changed(); }
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
    const on = this.activeCats();
    // only the categories that are on get a spot on the map, plus the Wild Card
    S.spots = PILE_NAMES.map(name => ({ name, cat: SPOT_CATEGORIES[name] || 'wild' })).filter(sp => sp.cat === 'wild' || on.includes(sp.cat));
    S.bag = [];
    S.players.forEach(p => { p.score = 0; });
    S.board = {};
    S.event = null;
    S.lastEvent = null;
    this.spawnMonster();
    this.emit('say', 'Welcome to the cabin. The animatronics are awake, so here\'s how to survive. Each round, one of you takes the night shift. Pick a category and answer This or That. Everyone else answers too, risk free. Every right answer fills your pot. Then bank it, or keep going. Three in a row gets you to 6 A M and a bonus. Miss, and you drop the pot and get dragged into a mini game. Most honey at sunrise wins.');
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
      case 'pick': return this.chooseSpot(S.watch.watcherId, Math.floor(Math.random() * S.spots.length));
      case 'tot': return this.revealTot();
      case 'totReveal': return this.afterTot();
      case 'decide': return this.resolveDecide();
      case 'decideReveal': return this.afterDecide();
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
      case 'stakesBet': return this.revealStakes();
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
    S.watch = { watcherId: w.id, streak: 0, pot: 0, spot: null, q: null, answers: {}, results: null, preds: {}, decision: null, dogsUsed: false };
    const keys = Object.keys(EVENTS).filter(k => k !== S.lastEvent);
    S.event = pick(keys);
    S.lastEvent = S.event;
    if (S.event === 'wind') {
      const cats = shuffle(S.spots.map(sp => sp.cat));
      S.spots.forEach((sp, i) => { sp.cat = cats[i]; });
    }
    const ev = EVENTS[S.event];
    // the TV spins a wheel of everyone still waiting for a turn this round; it lands on the next player in the fair order
    const n = new Set(S.turnOrder).size || 1;
    const roundStart = Math.floor(S.turnIdx / n) * n;
    const round = S.turnOrder.slice(roundStart, roundStart + n).filter(id => this.player(id));
    const left = S.turnOrder.slice(S.turnIdx, roundStart + n).filter(id => this.player(id));
    S.wheel = { ids: left.length > 1 ? left : round, spin: Math.random() };
    const k = Math.min(1, this.speed * 4);
    this.emit('sfx', 'spin');
    setTimeout(() => {
      this.emit('sfx', 'great');
      this.emit('say', `${w.name}, you're on the night shift! Tonight: ${ev.name}. ${ev.text}`);
    }, SPIN_MS * k);
    this.go('turnStart', TIMES.turnStart);
  }

  // ---------- the roaming animatronic ----------
  spawnMonster(avoid = -1) {
    const S = this.S;
    const spots = S.spots.map((_, i) => i).filter(i => i !== avoid);
    const kind = pick(DANGERS.filter(d => d.name !== S.monster?.name));
    S.monster = { spot: pick(spots), name: kind.name, emoji: kind.emoji };
  }

  moveMonster() {
    const S = this.S;
    S.monster.spot = pick(S.spots.map((_, i) => i).filter(i => i !== S.monster.spot));
  }

  // ---------- money ----------
  potValue(streak) { return POT[Math.min(streak, POT.length - 1)] * (this.S.event === 'jackpot' ? 2 : 1); }
  banishValue() { return BANISH * (this.S.event === 'moon' ? 3 : 1); }
  sideRight() { return SIDE.right * (this.S.event === 'fever' ? 2 : 1); }
  sidePredict() { return SIDE.predict * (this.S.event === 'fever' ? 2 : 1); }

  // what's on the line for the watcher at a given spot right now
  stakesNow(spot) {
    const S = this.S;
    const w = S.watch;
    const haunted = S.monster?.spot === spot;
    return {
      win: this.potValue(w ? w.streak : 0),
      pot: w ? w.pot : 0,
      risk: STAKE * (haunted ? 2 : 1),
      haunted,
      banish: haunted ? this.banishValue() : 0
    };
  }

  // ---------- This or That ----------
  takeTot(cat, d) {
    const S = this.S;
    S.used.tot = S.used.tot || [];
    const cats = TOT[cat] && this.activeCats().includes(cat) ? [cat] : this.activeCats();
    const all = [];
    for (const c of cats) TOT[c].forEach((q, i) => all.push({ c, i, q }));
    let pool = all.filter(x => !S.used.tot.includes(`${x.c}:${x.i}`));
    if (!pool.length) {
      S.used.tot = S.used.tot.filter(k => !cats.includes(k.split(':')[0]));
      pool = all;
    }
    for (const dd of [d, d - 1, d + 1, d - 2, d + 2]) {
      const m = pool.filter(x => x.q.d === dd);
      if (m.length) { pool = m; break; }
    }
    const x = pick(pool);
    S.used.tot.push(`${x.c}:${x.i}`);
    const opts = shuffle([x.q.right, x.q.wrong]);
    return { cat: x.c, q: x.q.q, opts, ans: opts.indexOf(x.q.right), note: x.q.note, d: x.q.d };
  }

  totLine(q) { return `${CATEGORIES[q.cat].name}. ${q.q} ${q.opts[0]}… or ${q.opts[1]}?`; }

  // ---------- night shift ----------
  chooseSpot(pid, i) {
    const S = this.S;
    const w = S.watch;
    if (S.phase !== 'pick' || pid !== w.watcherId || !S.spots[i]) return;
    w.spot = i;
    w.st = this.stakesNow(i);
    w.q = this.takeTot(S.spots[i].cat, w.streak + 1);
    w.answers = {};
    w.results = null;
    w.saved = false;
    w.banished = false;
    this.emit('sfx', 'lock');
    this.emit('say', `${w.st.haunted ? `Careful… ${S.monster.name} is lurking here. ` : ''}${this.totLine(w.q)}`);
    this.go('tot', S.event === 'witching' ? 10 / (TIMERS[S.timers] || 1) : TIMES.tot);
  }

  answer(pid, i) {
    const S = this.S;
    if (!this.player(pid)) return;
    if (S.phase === 'tot') {
      if (S.watch.answers[pid] != null || !(i === 0 || i === 1)) return;
      S.watch.answers[pid] = i;
    } else if (S.phase === 'stakesBet') {
      return this.stake(pid, i);
    } else if (['triviaQ', 'finaleQ', 'pollQ'].includes(S.phase)) {
      const mg = S.mg;
      const q = mg.questions[mg.qi];
      const max = S.phase === 'pollQ' ? this.pollChoices(q).length : q.c.length;
      if (mg.answers[pid] || !(i >= 0 && i < max)) return;
      mg.answers[pid] = { i, at: Date.now() };
    } else {
      return;
    }
    this.emit('sfx', 'lock');
    this.changed();
    this.checkAllDone();
  }

  // answers pop in one by one on the TV, then the right one lights up
  revealOrder(ids) { return shuffle(ids); }

  revealTot() {
    const S = this.S;
    const w = S.watch;
    const q = w.q;
    const k = Math.min(1, this.speed * 4);
    S.gains = {};
    w.order = this.revealOrder(Object.keys(w.answers));
    const results = {};
    for (const [pid, a] of Object.entries(w.answers)) {
      results[pid] = a === q.ans;
      if (pid !== w.watcherId && results[pid]) this.addScore(pid, this.sideRight());
    }
    const ok = w.answers[w.watcherId] === q.ans;
    results[w.watcherId] = ok;
    if (ok) {
      w.pot += w.st.win;
      w.streak++;
      if (w.st.haunted) { w.banished = true; w.pot += w.st.banish; }
    } else if (S.event === 'dogs' && !w.dogsUsed) {
      w.saved = true;
      w.dogsUsed = true;
    }
    w.results = results;
    const at = revealAt(w.order.length);
    this.emit('sfx', 'drumroll');
    setTimeout(() => {
      this.emit('sfx', ok ? (w.banished ? 'great' : 'good') : w.saved ? 'good' : 'bad');
      this.emit('say', `It's ${q.opts[q.ans]}!`);
    }, at * k);
    for (const [pid, r] of Object.entries(results)) this.emit('mood', { pid, mood: r ? 'happy' : 'sad', tv: pid === w.watcherId, delay: at + 300 });
    this.go('totReveal', TIMES.totReveal + at / 1000);
  }

  afterTot() {
    const S = this.S;
    const w = S.watch;
    const name = this.player(w.watcherId)?.name || 'Someone';
    const lurker = { ...S.monster };
    if (w.banished) {
      this.emit('say', `${name} banished ${S.monster.name}!`);
      this.spawnMonster(w.spot);
    } else {
      this.moveMonster();
    }
    S.gains = {};
    if (w.saved) {
      this.emit('say', 'Archie and Honey chased it off! The night shift continues.');
      return this.go('pick', TIMES.pick);
    }
    if (w.results[w.watcherId]) {
      if (w.streak >= 3) {
        this.addScore(w.watcherId, w.pot + SIX_AM);
        this.emit('sfx', 'great');
        this.emit('say', `6 A M! ${name} survived the night shift with ${w.pot + SIX_AM} honey. The dogs are thrilled.`);
        this.emit('mood', { pid: w.watcherId, mood: 'happy', tv: true, delay: 600 });
        return this.go('safe', TIMES.safe);
      }
      w.decision = null;
      w.preds = {};
      this.emit('say', `${name}: bank ${w.pot} honey and go back to the cabin… or keep going for ${this.potValue(w.streak)} more?`);
      return this.go('decide', TIMES.decide);
    }
    S.lost = { pid: w.watcherId, stake: w.st.risk, pot: w.pot };
    S.danger = w.st.haunted ? { name: lurker.name, emoji: lurker.emoji } : pick(DANGERS);
    this.emit('sfx', 'scare');
    this.emit('say', `Oh no. ${name} was dragged off by ${S.danger.name}${w.pot ? `, and dropped ${w.pot} honey` : ''}.`);
    this.emit('mood', { pid: w.watcherId, mood: 'sad', tv: true, delay: 1300 });
    return this.go('dragged', TIMES.dragged);
  }

  decide(pid, choice) {
    const S = this.S;
    const w = S.watch;
    if (S.phase !== 'decide' || !['bank', 'keep'].includes(choice) || !this.player(pid)) return;
    if (pid === w.watcherId) { if (w.decision) return; w.decision = choice; }
    else { if (w.preds[pid]) return; w.preds[pid] = choice; }
    this.emit('sfx', 'lock');
    this.changed();
    this.checkAllDone();
  }

  resolveDecide() {
    const S = this.S;
    const w = S.watch;
    const name = this.player(w.watcherId)?.name || 'Someone';
    if (!w.decision) w.decision = 'bank';
    S.gains = {};
    for (const [pid, p] of Object.entries(w.preds)) if (p === w.decision) this.addScore(pid, this.sidePredict());
    if (w.decision === 'bank') {
      this.addScore(w.watcherId, w.pot);
      this.emit('sfx', 'good');
      this.emit('say', `${name} banks ${w.pot} honey and runs back to the cabin!`);
    } else {
      this.emit('sfx', 'drumroll');
      this.emit('say', `${name} keeps going! Brave… or foolish.`);
    }
    this.go('decideReveal', TIMES.decideReveal);
  }

  afterDecide() {
    const w = this.S.watch;
    if (w.decision === 'bank') return this.go('scores', TIMES.scores);
    this.S.gains = {};
    return this.go('pick', TIMES.pick);
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
    // local (Boston / New England) questions: at most one per round, and only sometimes
    const local = shuffle(pool.filter(i => isLocal(TRIVIA[i].q + ' ' + TRIVIA[i].c.join(' '))));
    const general = shuffle(pool.filter(i => !local.includes(i)));
    const chosen = general.slice(0, n);
    if (local.length && Math.random() < 0.25) chosen[Math.floor(Math.random() * n)] = local[0];
    while (chosen.length < n && local.length > chosen.length) chosen.push(local[chosen.length]);
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
    const q = mg.questions[mg.qi];
    this.emit('say', `${q.q} ${q.c.map((c, i) => `${'ABCD'[i]}: ${c}`).join('. ')}.`);
    this.go(finale ? 'finaleQ' : 'triviaQ', finale ? TIMES.finaleQ : TIMES.triviaQ);
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
    mg.order = this.revealOrder(Object.keys(mg.answers));
    const at = revealAt(mg.order.length);
    for (const p of this.connected()) {
      const a = mg.answers[p.id];
      this.emit('mood', { pid: p.id, mood: a && a.i === q.a ? 'happy' : 'sad', tv: false, delay: at + 300 });
    }
    const k = Math.min(1, this.speed * 4);
    this.emit('say', 'Let\'s see what everyone said…');
    this.emit('sfx', 'drumroll');
    setTimeout(() => { this.emit('sfx', 'good'); this.emit('say', `The answer is ${q.c[q.a]}.`); }, at * k);
    this.go(finale ? 'finaleA' : 'triviaA', (finale ? TIMES.finaleA : TIMES.triviaA) + at / 1000);
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
    const things = shuffle(pool.filter(i => !POLLS[i].players && (Math.random() < 0.2 || !isLocal(POLLS[i].q + ' ' + POLLS[i].c.join(' ')))));
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
    const q = mg.questions[mg.qi];
    this.pollChoices(q);
    this.S.gains = {};
    this.emit('say', q.players ? `${q.q}` : `${q.q} ${q.c.join('? ')}?`);
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
    const choices = this.pollChoices(q);
    const at = 900 * choices.length + 600;
    for (const [pid, a] of Object.entries(mg.answers)) this.emit('mood', { pid, mood: top > 0 && counts[a.i] === top ? 'happy' : 'sad', tv: false, delay: at });
    const k = Math.min(1, this.speed * 4);
    const winners = choices.filter((_, i) => top > 0 && counts[i] === top);
    this.emit('sfx', 'drumroll');
    setTimeout(() => {
      this.emit('sfx', 'good');
      const names = winners.map(w => (q.players ? w.replace(/^\S+\s/, '') : w));
      this.emit('say', names.length ? `The crowd says… ${names.join(' and ')}!` : 'Nobody answered!');
    }, at * k);
    this.go('pollA', TIMES.pollA + at / 1000);
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
    let pool = DRAW_PROMPTS.filter(p => !S.used.prompts.includes(p) && (Math.random() < 0.15 || !isLocal(p)));
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
    const artist = this.player(this.artistId());
    this.emit('say', mg.di === 0
      ? `Okay! Time to guess what this masterpiece is. ${artist?.name || 'Someone'}, keep quiet. Everyone else, write a fake title on your phone!`
      : `Next masterpiece, by ${artist?.name || 'someone'}! What could this be? Write a fake title.`);
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
    this.emit('say', `Which one is the real title? ${mg.options.map(o => o.text).join('? ')}?`);
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
    const k = Math.min(1, this.speed * 4);
    S.gains = {};
    let found = 0;
    for (const [pid, i] of Object.entries(mg.votes)) {
      const o = mg.options[i];
      if (o.real) { this.addScore(pid, 500); this.addScore(artist, 300); found++; }
      else for (const owner of o.owners) this.addScore(owner, 300);
    }
    if (S.lost && artist === S.lost.pid) mg.lostOk = found > 0;
    const end = (mg.options.length - 1) * REVEAL_STEP;
    for (const [pid, i] of Object.entries(mg.votes)) this.emit('mood', { pid, mood: mg.options[i].real ? 'happy' : 'sad', tv: false, delay: end });
    this.emit('mood', { pid: artist, mood: found ? 'happy' : 'sad', tv: true, delay: end + 800 });
    setTimeout(() => this.emit('sfx', found ? 'good' : 'bad'), end * k);
    // read each answer out loud, lies first and the truth last, in step with the TV
    mg.revealSeq = mg.options.map((o, i) => i).sort((a, b) => (mg.options[a].real ? 1 : 0) - (mg.options[b].real ? 1 : 0));
    mg.revealSeq.forEach((i, step) => {
      const o = mg.options[i];
      const fooled = Object.values(mg.votes).filter(v => v === i).length;
      const by = o.owners.map(id => this.player(id)?.name).filter(Boolean).join(' and ');
      const line = o.real
        ? `And the real title is… ${o.text}! Drawn by ${this.player(artist)?.name || 'our artist'}.`
        : `${o.text}. ${o.house ? 'That one was our lie' : `Written by ${by}`}. ${fooled ? `It fooled ${fooled}!` : 'Nobody fell for it.'}`;
      setTimeout(() => this.emit('say', line), step * REVEAL_STEP * k);
    });
    this.go('drawReveal', (mg.options.length * REVEAL_STEP) / 1000 + 4);
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

  // ---------- Sunrise Stakes: 5 This or That questions for everyone, each worth more ----------
  startStakes() {
    const S = this.S;
    const ranked = this.ranked();
    const boosted = ranked.slice(Math.ceil(ranked.length / 2)).map(p => p.id);
    S.gains = {};
    S.mg = { type: 'stakes', round: 0, rounds: STAKES.values.length, boosted, bets: {} };
    const names = boosted.map(id => this.player(id)?.name).filter(Boolean);
    this.emit('say', `The Sunrise Stakes. Five This or That questions, each worth more than the last. Right wins it, wrong loses it.${names.length ? ` ${names.join(' and ')}, you get a comeback boost.` : ''}`);
    this.go('stakesIntro', TIMES.stakesIntro);
  }

  cardValue() { return STAKES.values[this.S.mg.round - 1]; }

  stakesRound() {
    const S = this.S;
    const mg = S.mg;
    if (mg.round >= mg.rounds) return this.finish();
    mg.round++;
    mg.bets = {};
    mg.q = this.takeTot('wild', STAKES.diff[mg.round - 1]);
    S.gains = {};
    this.emit('say', `${mg.round === mg.rounds ? 'Final question, for one thousand honey! ' : `For ${this.cardValue()} honey. `}${this.totLine(mg.q)}`);
    this.go('stakesBet', TIMES.stakesBet);
  }

  stake(pid, i) {
    const S = this.S;
    if (S.phase !== 'stakesBet' || !this.player(pid) || S.mg.bets[pid] || !(i === 0 || i === 1)) return;
    S.mg.bets[pid] = { i, amount: this.cardValue() };
    this.emit('sfx', 'lock');
    this.changed();
    this.checkAllDone();
  }

  revealStakes() {
    const S = this.S;
    const mg = S.mg;
    const q = mg.q;
    const k = Math.min(1, this.speed * 4);
    S.gains = {};
    mg.order = this.revealOrder(Object.keys(mg.bets));
    for (const [pid, b] of Object.entries(mg.bets)) {
      b.won = b.i === q.ans;
      if (b.won) this.addScore(pid, Math.round(b.amount * (mg.boosted.includes(pid) ? STAKES.boost : 1) / 10) * 10);
      else this.addScore(pid, -b.amount);
    }
    const at = revealAt(mg.order.length);
    for (const [pid, b] of Object.entries(mg.bets)) this.emit('mood', { pid, mood: b.won ? 'happy' : 'sad', tv: mg.round === mg.rounds, delay: at + 300 });
    this.emit('sfx', 'drumroll');
    setTimeout(() => { this.emit('sfx', 'good'); this.emit('say', `It's ${q.opts[q.ans]}!`); }, at * k);
    this.go('stakesReveal', TIMES.stakesReveal + at / 1000);
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
      case 'tot': return ids.filter(id => S.watch.answers[id] == null);
      case 'decide': return ids.filter(id => (id === S.watch.watcherId ? !S.watch.decision : !S.watch.preds[id]));
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
    const phases = ['tot', 'decide', 'triviaQ', 'finaleQ', 'pollQ', 'drawDraw', 'drawFib', 'drawVote', 'stakesBet'];
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
      case 'intro': return wait('How to play', 'The rules are on the TV. Listen up!', '📖');
      case 'turnStart': {
        const ev = EVENTS[S.event] || EVENTS.calm;
        const v = w.watcherId === pid ? wait(`You're on the night shift! ${ev.emoji} ${ev.name}`, ev.text, '🔦')
          : wait(`${watcher?.name} is on the night shift`, `${ev.emoji} ${ev.name}: ${ev.text}`, '🔦');
        return { ...v, spin: true };
      }
      case 'pick':
        if (w.watcherId === pid) {
          return {
            ...base, screen: 'pick', streak: w.streak, pot: w.pot, win: this.potValue(w.streak),
            event: EVENTS[S.event], monster: S.monster,
            spots: S.spots.map((sp, i) => {
              const hidden = S.event === 'outage';
              const c = CATEGORIES[sp.cat];
              return { name: sp.name, cat: hidden ? 'Mystery' : c.name, emoji: hidden ? '❓' : c.emoji, ...this.stakesNow(i) };
            })
          };
        }
        return wait(`${watcher?.name} is picking a category…`, `It's ${CLOCK[w.streak]} · pot ${w.pot} 🍯`, '👀');
      case 'tot': {
        const c = CATEGORIES[w.q.cat];
        return {
          ...base, screen: 'tot', watcher: w.watcherId === pid, watcherName: watcher?.name,
          catName: c.name, catEmoji: c.emoji, q: w.q.q, opts: w.q.opts, locked: w.answers[pid] ?? null,
          streak: w.streak, pot: w.pot, ...w.st, side: this.sideRight(), event: EVENTS[S.event], monster: S.monster
        };
      }
      case 'totReveal': {
        const mine = w.answers[pid];
        const right = w.q.opts[w.q.ans];
        if (mine == null) return { ...wait(`It's ${right}`, 'You didn\'t answer this one.', '🤷'), suspense: true };
        if (pid === w.watcherId && w.saved) return { ...wait('Saved by the dogs!', `It was ${right}. Archie & Honey chased it off.`, '🐕'), suspense: true };
        if (pid === w.watcherId && w.banished) return { ...wait('You banished it!', `+${w.st.banish} bonus · pot ${w.pot} 🍯`, '⚡'), suspense: true };
        if (pid === w.watcherId && w.results[pid]) return { ...wait('Correct!', `Pot: ${w.pot} 🍯`, '✅'), suspense: true };
        return { ...wait(w.results[pid] ? 'Correct!' : 'Wrong!', `It's ${right}.`, w.results[pid] ? '✅' : '❌'), suspense: true };
      }
      case 'decide':
        return {
          ...base, screen: 'decide', watcher: w.watcherId === pid, watcherName: watcher?.name, pot: w.pot, next: this.potValue(w.streak),
          streak: w.streak, risk: STAKE, predict: this.sidePredict(),
          locked: w.watcherId === pid ? w.decision : (w.preds[pid] || null)
        };
      case 'decideReveal': {
        const bank = w.decision === 'bank';
        if (pid === w.watcherId) return bank ? wait(`You banked ${w.pot} 🍯!`, 'Safe in the cabin.', '🏠') : wait('You kept going!', 'Pick your next category…', '🔦');
        const p = w.preds[pid];
        return wait(bank ? `${watcher?.name} banked it!` : `${watcher?.name} kept going!`, p ? (p === w.decision ? `You called it! +${this.sidePredict()}` : 'You guessed wrong.') : '', bank ? '🏠' : '🔦');
      }
      case 'safe': return wait(w.watcherId === pid ? 'You made it to 6 AM!' : `${watcher?.name} made it to 6 AM!`, `${w.pot} 🍯 + ${SIX_AM} bonus`, '🌅');
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
        const c = CATEGORIES[mg.q.cat];
        return {
          ...base, screen: 'stakes', round: `${mg.round}/${mg.rounds}`, value: this.cardValue(), boosted: mg.boosted.includes(pid),
          catName: c.name, catEmoji: c.emoji, q: mg.q.q, opts: mg.q.opts, locked: mg.bets[pid] ? mg.bets[pid].i : null
        };
      }
      case 'stakesReveal': {
        const b = mg.bets[pid];
        const right = mg.q.opts[mg.q.ans];
        if (!b) return { ...wait(`It's ${right}`, 'You sat this one out.', '🤷'), suspense: true };
        return { ...wait(b.won ? 'You won it!' : 'Lost it!', `It's ${right}.`, b.won ? '🤑' : '💸'), suspense: true };
      }
      case 'end': {
        const rank = this.ranked().findIndex(p => p.id === pid) + 1;
        return { ...base, screen: 'end', rank, total: S.players.length };
      }
      default: return wait('Look at the TV', '', '📺');
    }
  }
}
