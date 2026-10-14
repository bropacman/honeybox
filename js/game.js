// Honeybox game rules. Runs on the TV (host). No DOM here.
// State lives in this.S (plain JSON, so it can be saved and resumed).

import { PILE_NAMES, DANGERS, TRIVIA, DRAW_PROMPTS, POLLS, AVATARS, ALL_AVATARS, TOT, GUESSES, HIDE_SETS, isLocal } from './content.js';
import ZOOM from './packs/zoom.js';

export const CLOCK = ['12 AM', '2 AM', '4 AM', '6 AM'];

export const SEC = 1000;
export const TIMES = {
  intro: 26, turnStart: 11, pick: 12, tot: 20, totReveal: 7, decide: 15, decideReveal: 6, safe: 6, dragged: 7,
  mgIntro: 8, triviaQ: 20, triviaA: 8, pollQ: 20, pollA: 9,
  drawDraw: 80, drawFib: 35, drawVote: 20, drawReveal: 14, drawGallery: 9, mgResult: 6, scores: 5,
  finaleIntro: 9, finalePick: 20, finaleQ: 18, finaleA: 8,
  stakesIntro: 14, stakesBet: 20, stakesReveal: 7,
  hideQ: 15, hideA: 4, guessQ: 25, guessA: 6, doorQ: 15, doorA: 4, zoomQ: 21, zoomA: 6,
  seanceIntro: 7, seanceQ: 12, seanceA: 7, clawPlay: 8, clawGrab: 4.5
};

export const MINIGAMES = {
  trivia: { name: 'Bear Trivia', emoji: '🐻', rules: 'Answer 3 questions. Caught? Be the fastest right answer once to escape its grasp.' },
  draw: { name: 'Sketchy Woods', emoji: '🖍️', rules: 'Draw your secret prompt. Then fib a title for the drawing and find the real one. The captured player needs someone to guess theirs.' },
  poll: { name: 'Cabin Census', emoji: '📋', rules: 'Pick the answer you think MOST people will pick. Caught? Be the fastest to match the crowd once to escape its grasp.' },
  hide: { name: 'Hide and Seek', emoji: '🙈', rules: 'Pick a hiding spot. {Killer} checks the most crowded spot first, then one more. Caught? Stay hidden 2 of 3 times to escape its grasp.' },
  guess: { name: 'Closest Guess', emoji: '📏', rules: 'Guess the number. Closest wins, and a tie goes to the faster guess. Caught? Win a round once to escape its grasp.' },
  zoom: { name: 'Zoom In', emoji: '🔍', rules: 'A photo starts super zoomed in and slowly zooms out. The fastest right answers win 300, 200 and 100. Caught? Be the fastest right answer once to escape its grasp.' },
  door: { name: 'Pick a Door', emoji: '🚪', rules: 'Three doors: a prize, a little prize, and {killer}. Pick one. Caught? Dodge {killer} 2 of 3 times to escape its grasp.' }
};
// Pick a Door: what's behind the three doors, and the door sets for each round
export const DOOR_PRIZES = [{ kind: 'big', tickets: 300, emoji: '🎁' }, { kind: 'small', tickets: 100, emoji: '🍬' }, { kind: 'monster', tickets: 0, emoji: '' }];
export const DOOR_SETS = [
  ['🚪 Cabin door', '🚪 Shed door', '🚪 Cellar door'],
  ['🎪 Red curtain', '🎪 Blue curtain', '🎪 Gold curtain'],
  ['🌲 Left trail', '🌲 Middle trail', '🌲 Right trail'],
  ['🎠 Funhouse door', '🎟️ Prize room', '🕹️ Back room'],
  ['🛖 Outhouse', '⛺ Tent', '🛶 Boathouse']
];
export const DOOR_STEP = 2400;
// Zoom In: the fastest right answers win these, in order; slower right answers get nothing
export const ZOOM_POINTS = [300, 200, 100];

// The killer in play by its short name ("Cinderella", "the clown"): the one that caught someone, else the one on the map
export function killerName(S, cap = false) {
  const n = S.danger?.short || S.monster?.short || 'the animatronic';
  return cap ? n.charAt(0).toUpperCase() + n.slice(1) : n;
}
// fill {killer} / {Killer} in rules and event text
export const named = (S, text) => text.replace(/\{killer\}/g, killerName(S)).replace(/\{Killer\}/g, killerName(S, true));
// Hide and Seek: time between the killer's searches; Closest Guess: time between guesses popping in
export const SEARCH_MS = 2600;
export const GUESS_STEP = 1100;

export const LENGTHS = { short: 5, normal: 7, long: 10 };
// answer timers: short / medium / long
export const TIMERS = { short: 0.7, medium: 1, long: 1.4 };

// Finale choices for last place
// The winner cashes their tickets in for the top-shelf prize at the arcade counter.
export const PRIZES = [
  { name: 'a giant stuffed moose', emoji: '🫎' }, { name: 'a lava lamp', emoji: '🪔' },
  { name: 'a glow-in-the-dark yo-yo', emoji: '🪀' }, { name: 'a remote control monster truck', emoji: '🛻' },
  { name: 'a stuffed bear with one eye that follows you', emoji: '🧸' }, { name: 'a disco ball', emoji: '🪩' },
  { name: 'a giant inflatable guitar', emoji: '🎸' }, { name: 'a lifetime supply of Fun Dip', emoji: '🍬' },
  { name: 'a slightly haunted music box', emoji: '🎶' }, { name: 'a plush Archie and Honey', emoji: '🐕' }
];

export const FINALES = {
  stakes: { name: 'Sunrise Stakes', emoji: '🌅', blurb: '5 This or That questions for everyone, worth 200 up to 1,000. Right wins it, wrong loses it.' },
  trivia: { name: 'Trivia Blitz', emoji: '🐻', blurb: '5 questions, double tickets.' },
  draw: { name: 'Sketchy Woods', emoji: '🖍️', blurb: 'Everyone draws a secret prompt, then fib and guess. Double tickets.' },
  poll: { name: 'Cabin Census', emoji: '📋', blurb: 'Pick what most people will pick. Double tickets.' }
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
export const STAKE = 300;                    // lost if you stay captured; doubled on the killer's spot
export const SIDE = { right: 100 };
// Hitting the killer pays hidden loot, rolled from these [tickets, weight] tables. The final blow rolls
// the bigger one. Players in the bottom half roll twice and keep the better result.
export const LOOT = [[100, 30], [200, 25], [300, 20], [500, 13], [800, 8], [1500, 4]];
export const LOOT_FINAL = [[500, 30], [800, 28], [1200, 22], [2000, 14], [3000, 6]];
export const BOSS_HP = 3;
// Landing on a spot sometimes turns up a surprise. Weights are relative; a few only show up when they make sense.
export const SURPRISE_CHANCE = 0.25;
export const CLAW_SETTLE_MS = 2000;   // capsules show, close and shuffle before the claw starts moving
export const CLAW_PERIOD_MS = 2600;   // one trip across and back
export const SURPRISES = {
  stash: { emoji: '🎟️', name: 'Ticket stash', good: true, weight: 30 },
  flashlight: { emoji: '🔦', name: 'Flashlight', good: true, weight: 18 },
  salt: { emoji: '🧂', name: 'Salt line', good: true, weight: 14 },
  claw: { emoji: '🕹️', name: 'Claw machine', good: true, weight: 6 },
  swap: { emoji: '🔄', name: 'Swap!', good: null, weight: 10 },
  ambush: { emoji: '💀', name: 'Ambush', good: false, weight: 12 },
  raccoon: { emoji: '🦝', name: 'Raccoon thief', good: false, weight: 12 },
  batteries: { emoji: '🔋', name: 'Dead batteries', good: false, weight: 12 }
};
// one line for the TV, the phones and the narrator
export function surpriseLine(S, f, who) {
  const k = killerName(S, true);
  return {
    stash: `${who} found a stash of ${f.amount} tickets!`,
    flashlight: 'A flashlight! The next move can go anywhere on the map.',
    salt: `A salt line! ${k} can't move after this one.`,
    claw: !f.prize ? `A claw machine! ${who} gets one grab: a ghost could come back…`
      : f.prize.type === 'ghost' ? `The claw grabbed ${f.prize.name}! Back from the dead!`
      : f.prize.type === 'tickets' ? `The claw grabbed ${f.prize.amount} tickets for ${who}!` : 'The claw grabbed… nothing. Just air!',
    swap: `${who} and ${killerName(S)} swapped places!`,
    ambush: `Ambush! ${k} jumps out right next to ${who}!`,
    raccoon: `A raccoon swiped ${f.amount} tickets from the pot!`,
    batteries: 'The batteries are dying: half the time on this one!'
  }[f.kind];
}
export const SURVIVOR = 200;                 // each living player at sunrise

// Night events: one is drawn at the start of each night shift and lasts for that shift
export const EVENTS = {
  calm: { name: 'A Quiet Night', emoji: '🌌', text: 'Nothing strange tonight… too quiet.' },
  outage: { name: 'Power Outage', emoji: '🔦', text: 'The map goes dark: categories stay hidden until you pick a spot.' },
  dogs: { name: 'Archie & Honey on Patrol', emoji: '🐕', text: 'The dogs will save the night shift from one miss.' },
  jackpot: { name: 'Jackpot Night', emoji: '🎰', text: 'The pot is doubled tonight.' },
  fever: { name: 'Funspot Fever', emoji: '🎪', text: 'Everyone else\'s right answers pay double tonight.' },
  wind: { name: 'Mount Washington Wind', emoji: '🌪️', text: 'The categories blew around the map!' },
  witching: { name: 'Witching Hour', emoji: '🕛', text: 'Only 10 seconds to answer tonight.' },
  moon: { name: 'Full Moon', emoji: '🌕', text: 'Hits on {killer} do double damage tonight.' },
  golden: { name: 'Golden Ticket', emoji: '⭐', text: 'A golden ticket is hidden at one spot: answer right there for +300.' },
  nohide: { name: 'Lockdown', emoji: '🔒', text: 'The cabin door is locked. No hiding tonight until 6 AM!' },
  freeze: { name: 'Brain Freeze', emoji: '🧊', text: 'Only the hardest questions tonight, but the pot pays 50% more.' }
};
export const GOLDEN = 300;
// the player in first place has to get this many right before they're allowed to hide
export const LEADER_MIN = 2;

// Sketchy Woods: how many drawings get the full fib-and-vote treatment
export const DRAW_JUDGED = 4;

// story screens that wait for the narrator before moving on
export const NARRATED = ['intro', 'turnStart', 'safe', 'dragged', 'mgIntro', 'mgResult', 'finaleIntro', 'stakesIntro'];

// phases where players are answering on their phones (the last-10-seconds hurry-up applies)
export const ANSWER_PHASES = ['pick', 'tot', 'decide', 'triviaQ', 'finaleQ', 'pollQ', 'hideQ', 'guessQ', 'doorQ', 'zoomQ', 'drawDraw', 'drawFib', 'drawVote', 'stakesBet', 'finalePick', 'seanceQ'];

// Sunrise Stakes: 5 This or That questions for everyone, each worth more
export const STAKES = { values: [200, 300, 400, 500, 1000], diff: [2, 2, 3, 3, 3], boost: 1.5 };
// This or That difficulty for questions 1, 2, 3 of a night shift. The easiest tier (1) only shows up
// if a category runs out of harder ones.
export const TOT_DIFF = [2, 3, 3];

// reveal pacing: each player's answer pops in, then the right answer lights up
export const CHIP_MS = 550;
export const SPIN_MS = 3800; // the turn wheel's spin
export const REVEAL_STEP = 3600; // Sketchy Woods: time per answer in the reveal
export const revealAt = (n) => 900 + n * CHIP_MS;

const cleanStrokes = (strokes) => strokes.slice(0, 400).map(st => ({
  c: String(st.c).slice(0, 9), w: Math.min(40, Number(st.w) || 10), p: (st.p || []).slice(0, 4000).map(Number)
}));
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
      offGames: [],
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
    return ALL_AVATARS.includes(avatar) && !this.S.players.some(p => p.id !== id && p.avatar === avatar);
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

  // A player came back on a new device and joined as someone new: fold the new player into their old seat
  // (the old seat keeps its score and turns; anything the new one earned carries over).
  mergePlayer(newId, oldId) {
    const S = this.S;
    const nw = this.player(newId);
    const old = this.player(oldId);
    if (!nw || !old || newId === oldId) return false;
    S.players = S.players.filter(p => p.id !== newId);
    old.score += nw.score;
    old.connected = true;
    this.changed();
    this.checkAllDone();
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
    if (n > 0 && this.S.mg?.finale) n *= 2; // finale minigames pay double tickets
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
      // shift the clock by however long we were paused (Zoom In times its photo from startedAt too)
      const shift = Date.now() + this.S.pausedLeft - this.S.deadline;
      this.S.deadline += shift;
      if (this.S.mg?.startedAt) this.S.mg.startedAt += shift;
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

  // lobby setting: which mini-games can come up (handy for testing one); at least one stays on
  toggleMinigame(type) {
    const S = this.S;
    if (S.phase !== 'lobby' || !MINIGAMES[type]) return;
    const off = new Set(S.offGames || []);
    if (off.has(type)) off.delete(type);
    else if (Object.keys(MINIGAMES).filter(t => !off.has(t)).length > 1) off.add(type);
    S.offGames = [...off];
    this.changed();
  }

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
    S.lastSeance = null;
    const on = this.activeCats();
    // only the categories that are on get a spot on the map, plus the Wild Card
    S.spots = PILE_NAMES.map(name => ({ name, cat: SPOT_CATEGORIES[name] || 'wild' })).filter(sp => sp.cat === 'wild' || on.includes(sp.cat));
    S.bag = [];
    S.players.forEach(p => { p.score = 0; p.ghost = false; });
    S.board = {};
    S.event = null;
    S.lastEvent = null;
    this.spawnMonster();
    // one line per How to Play step; the TV reveals each step as its line starts
    this.emit('say', [
      'Welcome to the cabin. Tonight, you sneak out to win arcade tickets. At sunrise, whoever has the most claims the grand prize… if the animatronics don\'t get you first.',
      'Take turns sneaking out on the night shift. Each round, one player is up.',
      'Sneak to a spot next to you on the map, and answer This or That. The killer follows one step at a time. Everyone else answers too, risk free.',
      'Right answers fill your pot. After each one, keep going for more, or hide till morning and keep what you have. Whoever is in the lead has to get two right before they can hide.',
      'Three in a row gets you to 6 A M, and a bonus.',
      'Miss, and the killer catches you and you drop the pot. Win the mini game to escape, or become a ghost: no more night shifts, unless a seance brings you back.',
      'At sunrise, last place picks the finale. Most tickets wins the grand prize!'
    ]);
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
    S.players.forEach(p => { p.score = 0; p.ghost = false; });
    this.changed();
  }

  timeout() {
    const S = this.S;
    switch (S.phase) {
      case 'intro': return this.nextTurn();
      case 'turnStart': return this.go('pick', TIMES.pick);
      case 'pick': return this.chooseSpot(S.watch.watcherId, pick(this.reachable()));
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
      case 'hideQ': return this.revealHide();
      case 'hideA': return this.nextHide();
      case 'guessQ': return this.revealGuess();
      case 'guessA': return this.nextGuess();
      case 'doorQ': return this.revealDoor();
      case 'doorA': return this.nextDoor();
      case 'zoomQ': return this.revealZoom();
      case 'zoomA': return this.nextZoom();
      case 'seanceIntro': return this.askSeance();
      case 'seanceQ': return this.revealSeance();
      case 'seanceA': return this.nextTurn();
      case 'clawPlay': return this.dropClaw(null);
      case 'clawGrab': return this.askTot();
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
    S.lost = null;
    // everyone's a ghost: the night is over
    if (S.players.length && S.players.every(p => p.ghost)) { S.mg = null; return this.startFinale(); }
    if (S.phase !== 'seanceA' && this.maybeSeance()) return;
    S.mg = null;
    S.turnIdx++;
    const alive = (id) => this.player(id) && !this.player(id).ghost;
    while (S.turnIdx < S.turnOrder.length && !alive(S.turnOrder[S.turnIdx])) S.turnIdx++;
    if (S.turnIdx >= S.turnOrder.length) return this.startFinale();
    const w = this.player(S.turnOrder[S.turnIdx]);
    if (S.monster && S.turnIdx > 0) this.moveMonster();
    const edge = S.spots.map((_, i) => i).filter(i => { const [c, r] = this.cell(i); return (c === 0 || c === 4 || r === 0 || r === 2) && i !== S.monster?.spot; });
    const start = pick(edge.length ? edge : S.spots.map((_, i) => i));
    S.watch = { watcherId: w.id, streak: 0, pot: 0, spot: null, q: null, answers: {}, results: null, decision: null, dogsUsed: false, at: start, used: [start], free: false };
    const keys = Object.keys(EVENTS).filter(k => k !== S.lastEvent);
    S.event = pick(keys);
    S.lastEvent = S.event;
    if (S.event === 'wind') {
      const cats = shuffle(S.spots.map(sp => sp.cat));
      S.spots.forEach((sp, i) => { sp.cat = cats[i]; });
    }
    S.golden = S.event === 'golden' ? pick(S.spots.map((_, i) => i).filter(i => i !== S.monster?.spot)) : null;
    const ev = EVENTS[S.event];
    // the TV spins a wheel of everyone still waiting for a turn this round; it lands on the next player in the fair order
    const n = new Set(S.turnOrder).size || 1;
    const roundStart = Math.floor(S.turnIdx / n) * n;
    const round = S.turnOrder.slice(roundStart, roundStart + n).filter(alive);
    const left = S.turnOrder.slice(S.turnIdx, roundStart + n).filter(alive);
    S.wheel = { ids: left.length > 1 ? left : round, spin: Math.random() };
    const k = Math.min(1, this.speed * 4);
    this.emit('sfx', 'spin');
    setTimeout(() => {
      this.emit('sfx', 'great');
      this.emit('say', `${w.name}, you're on the night shift! Tonight: ${ev.name}. ${named(S, ev.text)}`);
    }, SPIN_MS * k);
    this.go('turnStart', TIMES.turnStart);
  }

  // ---------- moving across the map ----------
  // Spots sit on a 5x3 grid (PILE_NAMES order). The night shift moves to a neighbouring spot each pick, never
  // back to one they've used this shift; a flashlight lets them go anywhere.
  cell(i) {
    const k = PILE_NAMES.indexOf(this.S.spots[i]?.name);
    return k < 0 ? [i % 5, Math.floor(i / 5)] : [k % 5, Math.floor(k / 5)];
  }
  dist(a, b) {
    const [ax, ay] = this.cell(a), [bx, by] = this.cell(b);
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  }
  reachable() {
    const S = this.S;
    const w = S.watch;
    const all = S.spots.map((_, i) => i);
    if (!w) return all;
    const open = all.filter(i => !(w.used || []).includes(i));
    if (!open.length) return all;
    if (w.at == null || w.free) return open;
    // categories turned off leave holes in the grid: reach a little further rather than strand them
    for (const r of [1, 2]) {
      const near = open.filter(i => this.dist(i, w.at) <= r);
      if (near.length) return near;
    }
    return open;
  }
  // The killer's next step: one spot toward where the night shift is standing. Deterministic (ties go to the
  // lowest spot), so the arrow the TV shows during the pick is exactly what happens. Already next to them: it waits.
  hunterStep() {
    const S = this.S;
    const w = S.watch;
    const m = S.monster;
    if (!w || w.at == null || !m) return null;
    const here = this.dist(m.spot, w.at);
    if (here <= 1) return null;
    const opts = S.spots.map((_, i) => i).filter(i => this.dist(i, m.spot) === 1);
    const best = Math.min(...opts.map(i => this.dist(i, w.at)));
    return best < here ? opts.find(i => this.dist(i, w.at) === best) : null;
  }

  // Landing on a spot: sometimes a surprise. May move the player (swap) or the killer, touch the pot or the timer.
  rollSurprise(i) {
    const S = this.S;
    const w = S.watch;
    const m = S.monster;
    if (Math.random() >= SURPRISE_CHANCE) return null;
    const allowed = { claw: S.players.some(p => p.ghost), swap: m && m.spot !== i, ambush: m && m.spot !== i, raccoon: w.pot > 0 };
    const kinds = Object.keys(SURPRISES).filter(k => allowed[k] !== false);
    let r = Math.random() * kinds.reduce((t, k) => t + SURPRISES[k].weight, 0);
    const kind = kinds.find(k => (r -= SURPRISES[k].weight) < 0) || kinds[0];
    const f = { kind };
    if (kind === 'stash') { f.amount = pick([100, 150, 200, 300]); this.addScore(w.watcherId, f.amount); }
    if (kind === 'flashlight') w.free = true;
    if (kind === 'salt') w.frozen = true;
    if (kind === 'claw') f.claw = this.loadClaw();
    if (kind === 'swap') { f.to = m.spot; m.spot = i; }
    if (kind === 'ambush') m.spot = pick(S.spots.map((_, j) => j).filter(j => j !== i && this.dist(j, i) === 1)) ?? m.spot;
    if (kind === 'raccoon') { f.amount = Math.min(w.pot, Math.max(50, Math.round(w.pot / 3 / 50) * 50)); w.pot -= f.amount; }
    return f;
  }

  // ---------- the claw machine ----------
  // Capsules go in with their contents showing, then close and get shuffled: one per ghost (two for a ghost
  // dead a while), a couple of ticket prizes and one empty. The claw swings along the top; the night shift taps
  // DROP and it grabs one of the capsules near where it was, at random. Decided the instant the tap arrives.
  loadClaw() {
    const S = this.S;
    const caps = [];
    for (const g of S.players.filter(p => p.ghost)) {
      caps.push({ type: 'ghost', pid: g.id });
      if (S.turnIdx - (g.ghostSince ?? S.turnIdx) >= 2) caps.push({ type: 'ghost', pid: g.id });
    }
    caps.push({ type: 'tickets', amount: pick([100, 150]) }, { type: 'tickets', amount: pick([200, 300]) }, { type: 'empty' });
    const n = caps.length;
    const spots = (shift) => shuffle(caps.map((_, i) => i)).map((slot, k) => ({ x: 12 + (76 * (slot + 0.5)) / n + (Math.random() - 0.5) * 4, y: k % 2 ? 72 : 82 + shift }));
    const from = spots(0), to = spots(0);
    return {
      caps: caps.map((c, i) => ({ ...c, sx: from[i].x, sy: from[i].y, x: to[i].x, y: to[i].y, hue: Math.floor(Math.random() * 360) })),
      startedAt: 0, x: null, grabbed: null
    };
  }
  // where the claw is along the top (percent across the cabinet): still while the capsules shuffle, then back and forth
  clawX(at = Date.now()) {
    const c = this.S.watch?.find?.claw;
    if (!c) return 50;
    if (c.x != null) return c.x;
    const t = Math.max(0, at - c.startedAt - CLAW_SETTLE_MS);
    const ph = (t % CLAW_PERIOD_MS) / CLAW_PERIOD_MS;
    return 12 + 76 * (ph < 0.5 ? ph * 2 : 2 - ph * 2);
  }
  dropClaw(pid) {
    const S = this.S;
    const w = S.watch;
    if (S.phase !== 'clawPlay' || (pid && pid !== w.watcherId)) return;
    const c = w.find.claw;
    c.x = this.clawX();
    // a weak claw: anything within reach could be the one it closes on, nearer is likelier
    const near = c.caps.map((cap, i) => [i, Math.abs(cap.x - c.x)]).filter(([, d]) => d < 13);
    const pool = near.length ? near : [[c.caps.map((cap, i) => [i, Math.abs(cap.x - c.x)]).sort((a, b) => a[1] - b[1])[0][0], 0]];
    let r = Math.random() * pool.reduce((t, [, d]) => t + 1 / (d + 4), 0);
    c.grabbed = (pool.find(([, d]) => (r -= 1 / (d + 4)) < 0) || pool[0])[0];
    const cap = c.caps[c.grabbed];
    const who = this.player(w.watcherId);
    if (cap.type === 'ghost') {
      const g = this.player(cap.pid);
      if (g) g.ghost = false;
      w.find.prize = { type: 'ghost', pid: cap.pid, name: g?.name || 'Someone' };
      this.emit('mood', { pid: cap.pid, mood: 'happy', tv: true, delay: 2800 });
    } else if (cap.type === 'tickets') {
      this.addScore(w.watcherId, cap.amount);
      w.find.prize = { type: 'tickets', amount: cap.amount };
    } else {
      w.find.prize = { type: 'empty' };
    }
    this.emit('sfx', 'drumroll');
    const k = Math.min(1, this.speed * 4);
    setTimeout(() => {
      this.emit('sfx', cap.type === 'empty' ? 'bad' : 'great');
      this.emit('say', surpriseLine(S, w.find, who?.name || 'Someone'));
    }, 2600 * k);
    this.go('clawGrab', TIMES.clawGrab);
  }

  // ---------- the roaming killer ----------
  spawnMonster(avoid = -1) {
    const S = this.S;
    let spots = S.spots.map((_, i) => i).filter(i => i !== avoid);
    const at = S.watch?.at;
    if (at != null && spots.some(i => this.dist(i, at) >= 2)) spots = spots.filter(i => this.dist(i, at) >= 2);
    const kind = pick(DANGERS.filter(d => d.name !== S.monster?.name));
    S.monster = { spot: pick(spots), name: kind.name, short: kind.short, emoji: kind.emoji, hp: BOSS_HP, maxHp: BOSS_HP };
  }

  moveMonster() {
    const S = this.S;
    S.monster.spot = pick(S.spots.map((_, i) => i).filter(i => i !== S.monster.spot));
  }

  // ---------- money ----------
  potValue(streak) { return POT[Math.min(streak, POT.length - 1)] * ({ jackpot: 2, freeze: 1.5 }[this.S.event] || 1); }
  // roll hidden loot for hitting the killer; trailing players get two rolls and keep the better
  rollLoot(pid, final) {
    const table = final ? LOOT_FINAL : LOOT;
    const roll = () => {
      let r = Math.random() * table.reduce((t, [, w]) => t + w, 0);
      for (const [v, w] of table) { if ((r -= w) < 0) return v; }
      return table[0][0];
    };
    const ranked = this.ranked();
    const behind = ranked.findIndex(p => p.id === pid) >= ranked.length / 2;
    return behind ? Math.max(roll(), roll()) : roll();
  }
  sideRight() { return SIDE.right * (this.S.event === 'fever' ? 2 : 1); }

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
      banish: haunted, // a right answer here hits the killer (for hidden loot)
      golden: S.event === 'golden' && S.golden === spot ? GOLDEN : 0
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
    for (const dd of [d, d + 1, d - 1, d + 2, d - 2]) {
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
    if (S.phase !== 'pick' || pid !== w.watcherId || !S.spots[i] || !this.reachable().includes(i)) return;
    w.hunt = this.hunterStep();
    w.free = false;
    w.frozen = false;
    w.used = w.used || [];
    w.find = this.rollSurprise(i);
    if (w.find?.kind === 'swap') i = w.find.to;
    // the killer already moved (or can't): no step this turn
    if (['swap', 'ambush', 'salt'].includes(w.find?.kind)) w.hunt = null;
    w.at = i;
    w.used.push(i);
    w.spot = i;
    w.st = this.stakesNow(i);
    // the killer's own spot always asks the hardest kind of question
    w.q = this.takeTot(S.spots[i].cat, S.event === 'freeze' || w.st.haunted ? 3 : TOT_DIFF[Math.min(w.streak, TOT_DIFF.length - 1)]);
    w.answers = {};
    w.results = null;
    w.saved = false;
    w.banished = false;
    w.hit = null;
    w.golden = false;
    w.forced = null;
    this.emit('sfx', 'lock');
    const who = this.player(w.watcherId)?.name || 'Someone';
    const secs = S.event === 'witching' ? 10 / (TIMERS[S.timers] || 1) : TIMES.tot;
    w.totSecs = w.find?.kind === 'batteries' ? secs / 2 : secs;
    if (w.find?.claw) {
      w.find.claw.startedAt = Date.now();
      this.emit('say', surpriseLine(S, w.find, who));
      return this.go('clawPlay', TIMES.clawPlay);
    }
    this.emit('say', `${w.find ? surpriseLine(S, w.find, who) + ' ' : ''}${this.totIntro()}`);
    this.go('tot', w.totSecs);
  }

  // the question, after any claw machine
  totIntro() {
    const S = this.S;
    return `${S.watch.st.haunted ? `Careful… ${S.monster.name} is lurking here. ` : ''}${this.totLine(S.watch.q)}`;
  }
  askTot() {
    this.emit('say', this.totIntro());
    this.go('tot', this.S.watch.totSecs);
  }

  answer(pid, i) {
    const S = this.S;
    if (!this.player(pid)) return;
    if (S.phase === 'seanceQ') {
      const mg = S.mg;
      if (!this.player(pid).ghost || mg.answers[pid] || !(i >= 0 && i < mg.questions[0].c.length)) return;
      mg.answers[pid] = { i, at: Date.now() };
      this.emit('sfx', 'lock');
      this.changed();
      return this.checkAllDone();
    }
    if (S.phase === 'tot') {
      if (S.watch.answers[pid] != null || !(i === 0 || i === 1)) return;
      S.watch.answers[pid] = i;
    } else if (S.phase === 'stakesBet') {
      return this.stake(pid, i);
    } else if (S.phase === 'zoomQ') {
      const mg = S.mg;
      if (mg.answers[pid] || !(i >= 0 && i < 4)) return;
      mg.answers[pid] = { i, at: Date.now() };
    } else if (['triviaQ', 'finaleQ', 'pollQ', 'hideQ', 'doorQ'].includes(S.phase)) {
      const mg = S.mg;
      const q = ['hideQ', 'doorQ'].includes(S.phase) ? null : mg.questions[mg.qi];
      const max = ['hideQ', 'doorQ'].includes(S.phase) ? mg.rounds[mg.qi].length : S.phase === 'pollQ' ? this.pollChoices(q).length : q.c.length;
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
      if (w.st.haunted) {
        // a hit: knock off a heart (two under a full moon) and roll hidden loot, paid straight to their tickets
        const m = S.monster;
        const dmg = S.event === 'moon' ? 2 : 1;
        m.hp = Math.max(0, (m.hp ?? BOSS_HP) - dmg);
        const final = m.hp === 0;
        w.hit = { dmg, final, loot: this.rollLoot(w.watcherId, final) };
        this.addScore(w.watcherId, w.hit.loot);
        w.banished = final;
      }
      if (w.st.golden) { w.golden = true; w.pot += w.st.golden; S.golden = null; }
    } else if (S.event === 'dogs' && !w.dogsUsed) {
      w.saved = true;
      w.dogsUsed = true;
    }
    w.results = results;
    const at = revealAt(w.order.length);
    this.emit('sfx', 'drumroll');
    setTimeout(() => {
      this.emit('sfx', ok ? (w.hit ? 'great' : 'good') : w.saved ? 'good' : 'bad');
      this.emit('say', `It's ${q.opts[q.ans]}!${w.golden ? ' And that\'s the golden ticket!' : ''}`);
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
      this.emit('say', `${name} defeated ${killerName(S)}! And ${w.hit.loot} tickets! But something else is waking up…`);
      this.spawnMonster(w.spot);
    } else {
      if (w.hit) {
        this.emit('say', `${name} hit ${killerName(S)} for ${w.hit.loot} tickets! It backs off to lick its wounds.`);
        // a hit knocks it back: you're standing on its spot, so it lands two spots away from you
        const away = S.spots.map((_, i) => i).filter(i => this.dist(i, w.at) === 2);
        if (away.length && !w.frozen) S.monster.spot = pick(away);
      } else if (w.hunt != null) {
        S.monster.spot = w.hunt;
      }
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
        this.emit('say', `6 A M! ${name} survived the night shift with ${w.pot + SIX_AM} tickets. The dogs are thrilled.`);
        this.emit('mood', { pid: w.watcherId, mood: 'happy', tv: true, delay: 600 });
        return this.go('safe', TIMES.safe);
      }
      // no hiding for the leader until 2 right (or for anyone during a Lockdown)
      const forced = this.mustKeep(w);
      if (forced) {
        w.decision = 'keep';
        w.forced = forced;
        this.emit('sfx', 'drumroll');
        this.emit('say', forced === 'leader' ? `${name} is in the lead, so no hiding yet! Keep going.` : `The cabin is locked. No hiding, ${name}! Keep going.`);
        return this.go('decideReveal', TIMES.decideReveal);
      }
      w.decision = null;
      this.emit('say', `${name}, you're risking ${w.pot} tickets. Keep going for ${this.potValue(w.streak)} more… or hide till morning?`);
      return this.go('decide', TIMES.decide);
    }
    S.lost = { pid: w.watcherId, stake: w.st.risk, pot: w.pot, lair: w.st.haunted };
    S.danger = w.st.haunted ? { name: lurker.name, short: lurker.short, emoji: lurker.emoji } : pick(DANGERS);
    this.emit('sfx', 'scare');
    const villain = S.danger.name.charAt(0).toUpperCase() + S.danger.name.slice(1);
    this.emit('say', `Oh no! ${villain} caught ${name}${w.pot ? `, and ${w.pot} tickets went flying` : ''}! ${w.st.haunted ? 'Caught in its lair, so escaping takes one extra win.' : 'Win the mini game to escape its grasp.'} Fail, and you're a ghost.`);
    this.emit('mood', { pid: w.watcherId, mood: 'sad', tv: true, delay: 1300 });
    return this.go('dragged', TIMES.dragged);
  }

  // 'leader' | 'lockdown' | null: why the night shift can't hide after this answer
  mustKeep(w) {
    if (this.S.event === 'nohide') return 'lockdown';
    const me = this.player(w.watcherId);
    const others = this.S.players.filter(p => p.id !== w.watcherId);
    const leading = me && me.score > 0 && others.length && others.every(p => me.score > p.score);
    return leading && w.streak < LEADER_MIN ? 'leader' : null;
  }

  decide(pid, choice) {
    const S = this.S;
    const w = S.watch;
    if (S.phase !== 'decide' || !['bank', 'keep'].includes(choice) || pid !== w.watcherId || w.decision) return;
    w.decision = choice;
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
    if (w.decision === 'bank') {
      this.addScore(w.watcherId, w.pot);
      this.emit('sfx', 'good');
      this.emit('say', `${name} hides till morning with ${w.pot} tickets!`);
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
    const playable = Object.keys(MINIGAMES).filter(t => (t !== 'poll' || this.connected().length >= 3) && (t !== 'zoom' || (this.S.zoomOk || []).length >= 8));
    // the lobby's picks, unless none of them can run right now (e.g. only Cabin Census with 2 players)
    const picked = playable.filter(t => !(S.offGames || []).includes(t));
    const allowed = picked.length ? picked : playable;
    S.bag = S.bag.filter(t => allowed.includes(t));
    if (!S.bag.length) S.bag = shuffle(allowed);
    const type = S.bag.pop();
    S.mg = { type, lostOk: false };
    S.gains = {};
    this.emit('say', `${MINIGAMES[type].name}. ${named(S, MINIGAMES[type].rules)}`);
    this.go('mgIntro', TIMES.mgIntro);
  }

  beginMinigame() {
    const mg = this.S.mg;
    if (mg.type === 'trivia') {
      mg.questions = this.takeTrivia(3);
      mg.qi = -1;
      mg.correct = {};
      mg.firsts = {};
      return this.askTrivia();
    }
    if (mg.type === 'poll') {
      mg.questions = this.takePolls(3);
      mg.qi = -1;
      mg.hits = {};
      mg.firsts = {};
      return this.askPoll();
    }
    if (mg.type === 'hide') {
      mg.rounds = shuffle(HIDE_SETS.slice()).slice(0, 3);
      mg.qi = -1;
      mg.safe = {};
      return this.askHide();
    }
    if (mg.type === 'zoom') {
      mg.questions = this.takeZooms(3);
      mg.qi = -1;
      mg.firsts = {};
      return this.askZoom();
    }
    if (mg.type === 'door') {
      mg.rounds = shuffle(DOOR_SETS.slice()).slice(0, 3);
      mg.qi = -1;
      mg.dodged = {};
      return this.askDoor();
    }
    if (mg.type === 'guess') {
      mg.questions = this.takeGuesses(3);
      mg.qi = -1;
      mg.firsts = {};
      return this.askGuess();
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

  // Of the players who gave the round's best answer, the fastest wins the round (that's what frees a captured
  // player). Finales don't track it. Returns the winner's id.
  creditRound(best) {
    const mg = this.S.mg;
    const top = best.slice().sort((a, b) => mg.answers[a].at - mg.answers[b].at)[0];
    if (top && mg.firsts) mg.firsts[top] = (mg.firsts[top] || 0) + 1;
    return top;
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
    this.creditRound(Object.keys(mg.answers).filter(id => mg.answers[id].i === q.a));
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
    return this.finishMinigame((mg.firsts[lost.pid] || 0) >= this.escapeNeed(1));
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
      this.creditRound(Object.keys(mg.answers).filter(id => counts[mg.answers[id].i] === top));
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
    return this.finishMinigame((mg.firsts[this.S.lost.pid] || 0) >= this.escapeNeed(1));
  }

  // ---------- Hide and Seek ----------
  askHide() {
    const mg = this.S.mg;
    mg.qi++;
    mg.answers = {};
    mg.search = null;
    this.S.gains = {};
    this.emit('say', mg.qi === 0 ? 'Quick, hide! Pick a spot on your phone.' : `Round ${mg.qi + 1}. Hide again!`);
    this.go('hideQ', TIMES.hideQ);
  }

  // The seeker goes straight for the most crowded spot, then checks one more at random.
  // Anyone who didn't pick a spot is caught standing in the open.
  revealHide() {
    const S = this.S;
    const mg = S.mg;
    const spots = mg.rounds[mg.qi];
    const k = Math.min(1, this.speed * 4);
    const counts = spots.map((_, i) => Object.values(mg.answers).filter(a => a.i === i).length);
    const most = Math.max(...counts);
    const first = pick(spots.map((_, i) => i).filter(i => counts[i] === most));
    const second = pick(spots.map((_, i) => i).filter(i => i !== first));
    mg.search = [first, second];
    mg.seeker = S.danger?.emoji || S.monster?.emoji || '🤖';
    S.gains = {};
    const ids = this.connected().map(p => p.id);
    const caught = new Set(ids.filter(id => !mg.answers[id] || mg.search.includes(mg.answers[id].i)));
    mg.caught = [...caught];
    for (const id of ids) {
      if (caught.has(id)) continue;
      this.addScore(id, 200);
      mg.safe[id] = (mg.safe[id] || 0) + 1;
    }
    const picks = { ...mg.answers };
    const names = (i) => Object.entries(picks).filter(([, a]) => a.i === i).map(([id]) => this.player(id)?.name).filter(Boolean);
    const line = (i) => { const n = names(i); return `${spots[i].replace(/^\S+\s/, '')}… ${n.length ? `found ${n.join(' and ')}!` : 'nobody there.'}`; };
    this.emit('sfx', 'drumroll');
    this.emit('say', 'Ready or not, here I come!');
    mg.search.forEach((i, n) => setTimeout(() => {
      this.emit('sfx', names(i).length ? 'scare' : 'flip');
      this.emit('say', line(i));
    }, (1200 + n * SEARCH_MS) * k));
    const end = 1200 + 2 * SEARCH_MS;
    for (const id of ids) this.emit('mood', { pid: id, mood: caught.has(id) ? 'sad' : 'happy', tv: false, delay: end });
    mg.revealMs = end;
    this.go('hideA', TIMES.hideA + end / 1000);
  }

  nextHide() {
    const mg = this.S.mg;
    if (mg.qi + 1 < mg.rounds.length) return this.askHide();
    return this.finishMinigame((mg.safe[this.S.lost.pid] || 0) >= this.escapeNeed(2));
  }

  // ---------- Zoom In ----------
  takeZooms(n) {
    const S = this.S;
    S.used.zoom = S.used.zoom || [];
    const ok = (S.zoomOk || []).filter(i => ZOOM[i]);
    let pool = ok.filter(i => !S.used.zoom.includes(i));
    if (pool.length < n) { S.used.zoom = []; pool = ok.slice(); }
    const chosen = shuffle(pool).slice(0, n);
    S.used.zoom.push(...chosen);
    return chosen.map(i => {
      const z = ZOOM[i];
      const others = shuffle(ok.map(j => ZOOM[j].name).filter(name => name !== z.name)).slice(0, 3);
      const c = shuffle([z.name, ...others]);
      // start the zoom near the photo's subject, nudged a little so it's never dead center
      const jitter = () => (Math.random() - 0.5) * 0.16;
      return { file: z.url || z.file, c, a: c.indexOf(z.name), fx: Math.min(0.85, Math.max(0.15, (z.fx ?? 0.5) + jitter())), fy: Math.min(0.85, Math.max(0.15, (z.fy ?? 0.5) + jitter())) };
    });
  }

  askZoom() {
    const mg = this.S.mg;
    mg.qi++;
    mg.answers = {};
    this.S.gains = {};
    this.emit('say', mg.qi === 0 ? 'What is it? The fastest right answers win.' : 'Next picture!');
    // set before go(): go() renders right away, and the TV times the zoom from startedAt
    mg.startedAt = Date.now();
    this.go('zoomQ', TIMES.zoomQ);
  }

  revealZoom() {
    const S = this.S;
    const mg = S.mg;
    const q = mg.questions[mg.qi];
    S.gains = {};
    const right = Object.entries(mg.answers).filter(([, a]) => a.i === q.a).sort((x, y) => x[1].at - y[1].at);
    right.forEach(([pid, a], rank) => {
      a.rank = rank;
      a.worth = ZOOM_POINTS[rank] || 0;
      this.addScore(pid, a.worth);
      if (rank === 0) mg.firsts[pid] = (mg.firsts[pid] || 0) + 1;
    });
    this.emit('sfx', 'good');
    this.emit('say', `It's ${q.c[q.a]}!`);
    for (const [pid, a] of Object.entries(mg.answers)) this.emit('mood', { pid, mood: a.i === q.a ? 'happy' : 'sad', tv: false, delay: 600 });
    this.go('zoomA', TIMES.zoomA);
  }

  nextZoom() {
    const mg = this.S.mg;
    if (mg.qi + 1 < mg.questions.length) return this.askZoom();
    return this.finishMinigame((mg.firsts[this.S.lost.pid] || 0) >= this.escapeNeed(1));
  }

  // the TV reports which Zoom In photos actually loaded (they're hosted elsewhere)
  setZoomAvailable(indices) {
    this.S.zoomOk = indices.filter(i => ZOOM[i]);
    this.changed();
  }

  // ---------- Pick a Door ----------
  askDoor() {
    const mg = this.S.mg;
    mg.qi++;
    mg.answers = {};
    mg.behind = null;
    this.S.gains = {};
    this.emit('say', mg.qi === 0 ? `Pick a door. One hides a prize, one a little prize, and one… ${killerName(this.S)}.` : `Round ${mg.qi + 1}. Pick a door!`);
    this.go('doorQ', TIMES.doorQ);
  }

  // Doors open little prize first, then the last two together-ish: prize or monster?
  revealDoor() {
    const S = this.S;
    const mg = S.mg;
    const k = Math.min(1, this.speed * 4);
    mg.behind = shuffle(DOOR_PRIZES.slice());
    mg.seeker = S.danger?.emoji || S.monster?.emoji || '🤖';
    const small = mg.behind.findIndex(b => b.kind === 'small');
    mg.openOrder = [small, ...shuffle(mg.behind.map((_, i) => i).filter(i => i !== small))];
    S.gains = {};
    const ids = this.connected().map(p => p.id);
    mg.caught = [];
    for (const id of ids) {
      const a = mg.answers[id];
      const b = a ? mg.behind[a.i] : null;
      if (!b || b.kind === 'monster') { mg.caught.push(id); continue; }
      this.addScore(id, b.tickets);
      mg.dodged[id] = (mg.dodged[id] || 0) + 1;
    }
    const doors = mg.rounds[mg.qi].map(d => d.replace(/^\S+\s/, ''));
    this.emit('sfx', 'drumroll');
    const behind = mg.behind;
    const picks = { ...mg.answers };
    const who = (i) => Object.entries(picks).filter(([, a]) => a.i === i).map(([id]) => this.player(id)?.name).filter(Boolean);
    mg.openOrder.forEach((i, n) => setTimeout(() => {
      const b = behind[i];
      const names = who(i);
      this.emit('sfx', b.kind === 'monster' ? 'scare' : b.kind === 'big' ? 'great' : 'good');
      this.emit('say', b.kind === 'monster'
        ? `The ${doors[i]}… it's ${killerName(this.S)}!${names.length ? ` Sorry, ${names.join(' and ')}.` : ''}`
        : b.kind === 'big' ? `The ${doors[i]}: the big prize!` : `The ${doors[i]}: a little prize.`);
    }, (1000 + n * DOOR_STEP) * k));
    const end = 1000 + 3 * DOOR_STEP;
    mg.revealMs = end;
    for (const id of ids) this.emit('mood', { pid: id, mood: mg.caught.includes(id) ? 'sad' : 'happy', tv: false, delay: end });
    this.go('doorA', TIMES.doorA + end / 1000);
  }

  nextDoor() {
    const mg = this.S.mg;
    if (mg.qi + 1 < mg.rounds.length) return this.askDoor();
    return this.finishMinigame((mg.dodged[this.S.lost.pid] || 0) >= this.escapeNeed(2));
  }

  // ---------- Closest Guess ----------
  takeGuesses(n) {
    const S = this.S;
    S.used.guesses = S.used.guesses || [];
    let pool = GUESSES.map((_, i) => i).filter(i => !S.used.guesses.includes(i));
    if (pool.length < n) { S.used.guesses = []; pool = GUESSES.map((_, i) => i); }
    const chosen = shuffle(pool).slice(0, n);
    S.used.guesses.push(...chosen);
    return chosen.map(i => ({ ...GUESSES[i] }));
  }

  askGuess() {
    const mg = this.S.mg;
    mg.qi++;
    mg.answers = {};
    this.S.gains = {};
    this.emit('say', mg.questions[mg.qi].q);
    this.go('guessQ', TIMES.guessQ);
  }

  guess(pid, n) {
    const S = this.S;
    if (S.phase !== 'guessQ' || !this.player(pid) || S.mg.answers[pid] || !Number.isFinite(n) || n < 0 || n > 1e12) return;
    S.mg.answers[pid] = { n: Math.round(n * 100) / 100, at: Date.now() };
    this.emit('sfx', 'lock');
    this.changed();
    this.checkAllDone();
  }

  // Guesses pop in farthest first; the closest guess wins.
  revealGuess() {
    const S = this.S;
    const mg = S.mg;
    const q = mg.questions[mg.qi];
    const k = Math.min(1, this.speed * 4);
    const off = (id) => Math.abs(mg.answers[id].n - q.a);
    const ids = Object.keys(mg.answers);
    mg.order = ids.slice().sort((a, b) => off(b) - off(a));
    const best = ids.length ? Math.min(...ids.map(off)) : null;
    // equally close guesses: the faster one wins
    const top = this.creditRound(ids.filter(id => off(id) === best));
    mg.winners = top ? [top] : [];
    S.gains = {};
    for (const id of mg.winners) this.addScore(id, 300);
    const end = mg.order.length * GUESS_STEP + 800;
    mg.revealMs = end;
    const fmt = (x) => (q.unit ? Number(x).toLocaleString('en-US') : String(x));
    this.emit('sfx', 'drumroll');
    setTimeout(() => {
      this.emit('sfx', 'good');
      const names = mg.winners.map(id => this.player(id)?.name).filter(Boolean);
      this.emit('say', `The answer is ${fmt(q.a)}${q.unit ? ` ${q.unit}` : ''}! ${names.length ? `Closest: ${names.join(' and ')}.` : ''}`);
    }, end * k);
    for (const id of ids) this.emit('mood', { pid: id, mood: mg.winners.includes(id) ? 'happy' : 'sad', tv: false, delay: end });
    this.go('guessA', TIMES.guessA + end / 1000);
  }

  nextGuess() {
    const mg = this.S.mg;
    if (mg.qi + 1 < mg.questions.length) return this.askGuess();
    return this.finishMinigame((mg.firsts[this.S.lost.pid] || 0) >= this.escapeNeed(1));
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

  // work in progress from a phone; used if the timer runs out before they hit Done
  draftDrawing(pid, strokes) {
    if (this.S.phase !== 'drawDraw' || !Array.isArray(strokes)) return;
    this.drafts = this.drafts || {};
    this.drafts[pid] = strokes;
  }

  // the TV finished revealing the final standings; phones can now show each player's place
  revealEnd() {
    if (this.S.phase !== 'end' || this.S.endRevealed) return;
    this.S.endRevealed = true;
    this.changed();
  }

  submitDrawing(pid, strokes) {
    const S = this.S;
    if (S.phase !== 'drawDraw' || !S.mg.prompts[pid] || S.mg.drawings[pid]) return;
    if (!Array.isArray(strokes)) return;
    S.mg.drawings[pid] = cleanStrokes(strokes);
    this.changed();
    this.checkAllDone();
  }

  startFibs() {
    const S = this.S;
    const mg = S.mg;
    // the timer ran out: half-finished drawings still count
    for (const [pid, strokes] of Object.entries(this.drafts || {})) {
      if (mg.prompts[pid] && !mg.drawings[pid] && strokes.length) mg.drawings[pid] = cleanStrokes(strokes);
    }
    this.drafts = {};
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
    // reveal order: lies nobody fell for flash up together in one quick line, then each lie that fooled
    // someone gets its own beat, and the truth comes last
    const fooledBy = (i) => Object.values(mg.votes).filter(v => v === i).length;
    const lies = mg.options.map((o, i) => i).filter(i => !mg.options[i].real);
    const misses = lies.filter(i => !fooledBy(i));
    const hits = shuffle(lies.filter(i => fooledBy(i)));
    const truth = mg.options.findIndex(o => o.real);
    mg.revealSeq = [...misses, ...hits, truth];
    mg.revealAt = {};
    const beats = [];
    let t = 0;
    if (misses.length) {
      misses.forEach((i, n) => { mg.revealAt[i] = n * 250; });
      beats.push([0, misses.length === 1 ? `Nobody fell for ${mg.options[misses[0]].text}.` : 'Nobody fell for these.']);
      t = 1800;
    }
    for (const i of hits) {
      const o = mg.options[i];
      const by = o.house ? 'our lie' : o.owners.map(id => this.player(id)?.name).filter(Boolean).join(' and ');
      mg.revealAt[i] = t;
      beats.push([t, `${o.text}. By ${by}. Fooled ${fooledBy(i)}!`]);
      t += REVEAL_STEP;
    }
    mg.revealAt[truth] = t;
    beats.push([t, `The real title… ${mg.options[truth].text}!`]);
    mg.revealEnd = t + 1500;
    const end = t;
    for (const [pid, i] of Object.entries(mg.votes)) this.emit('mood', { pid, mood: mg.options[i].real ? 'happy' : 'sad', tv: false, delay: end });
    this.emit('mood', { pid: artist, mood: found ? 'happy' : 'sad', tv: true, delay: end + 800 });
    setTimeout(() => this.emit('sfx', found ? 'good' : 'bad'), end * k);
    for (const [at, line] of beats) setTimeout(() => this.emit('say', line), at * k);
    this.go('drawReveal', mg.revealEnd / 1000 + 4);
  }

  finishMinigame(ok) {
    const S = this.S;
    const lost = S.lost;
    const name = this.player(lost.pid)?.name || 'Someone';
    S.gains = {};
    if (ok) this.addScore(lost.pid, 300);
    else this.addScore(lost.pid, -lost.stake);
    const p = this.player(lost.pid);
    if (!ok && p) { p.ghost = true; p.ghostSince = S.turnIdx; }
    S.mg.result = ok;
    this.emit('sfx', ok ? 'great' : 'howl');
    this.emit('say', ok ? `${name} escaped ${killerName(this.S)}!` : `${name} didn't make it. ${name} is a ghost now, and won't be picked for the night shift.`);
    this.emit('mood', { pid: lost.pid, mood: ok ? 'happy' : 'sad', tv: true, delay: 400 });
    this.go('mgResult', TIMES.mgResult);
  }

  // wins a captured player needs to escape: one more when caught in the killer's lair
  escapeNeed(base) { return base + (this.S.lost?.lair ? 1 : 0); }

  // ---------- séance ----------
  // At the start of a night, if anyone's a ghost, sometimes the ghosts get one hard question.
  // The fastest right answer comes back to life. Never two nights running.
  maybeSeance() {
    const S = this.S;
    const ghosts = S.players.filter(p => p.ghost && p.connected);
    if (!ghosts.length || S.lastSeance === S.turnIdx) return false;
    if (Math.random() >= Math.min(0.5, 0.15 + 0.1 * ghosts.length)) return false;
    S.lastSeance = S.turnIdx + 1;
    S.mg = { type: 'seance', questions: this.takeTrivia(1), qi: 0, answers: {} };
    this.emit('sfx', 'howl');
    this.emit('say', 'The candles flicker. The dead are stirring… One ghost gets a chance to come back. Fastest right answer lives again.');
    this.go('seanceIntro', TIMES.seanceIntro);
    return true;
  }

  askSeance() {
    const mg = this.S.mg;
    mg.askedAt = Date.now();
    const q = mg.questions[0];
    this.emit('say', `${q.q} ${q.c.map((c, i) => `${'ABCD'[i]}: ${c}`).join('. ')}.`);
    this.go('seanceQ', TIMES.seanceQ);
  }

  revealSeance() {
    const S = this.S;
    const mg = S.mg;
    const q = mg.questions[0];
    const right = Object.keys(mg.answers).filter(id => mg.answers[id].i === q.a && this.player(id)?.ghost);
    const top = right.sort((a, b) => mg.answers[a].at - mg.answers[b].at)[0];
    mg.revived = top || null;
    if (top) this.player(top).ghost = false;
    const name = top && this.player(top)?.name;
    this.emit('sfx', top ? 'great' : 'bad');
    this.emit('say', top ? `The answer is ${q.c[q.a]}. ${name} is back from the dead!` : `The answer is ${q.c[q.a]}. The spirits stay restless.`);
    if (top) this.emit('mood', { pid: top, mood: 'happy', tv: true, delay: 400 });
    this.go('seanceA', TIMES.seanceA);
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
    S.survivors = S.players.filter(p => !p.ghost).map(p => p.id);
    for (const id of S.survivors) this.addScore(id, SURVIVOR);
    const pool = this.connected().length ? this.connected() : S.players;
    const low = Math.min(...pool.map(p => p.score));
    const picker = pick(pool.filter(p => p.score === low));
    S.mg = { type: 'finalePick', picker: picker?.id, options: this.finaleOptions() };
    this.emit('say', `Five A M. The sun is almost up.${S.survivors.length ? ` Everyone who survived the night gets ${SURVIVOR} tickets.` : ''} ${picker?.name || 'Someone'}, you're in last place, so you choose how the night ends.`);
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
    // a regular minigame, but nobody is captured and all tickets are doubled
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
    this.emit('say', `${mg.round === mg.rounds ? 'Final question, for one thousand tickets! ' : `For ${this.cardValue()} tickets. `}${this.totLine(mg.q)}`);
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
    S.prize = pick(PRIZES);
    S.endRevealed = false;
    // Final standings, last place to first. Each narration line reveals its row on the TV (S.endSteps maps
    // rows to line numbers); numbers in the list are dramatic pauses.
    const ord = (n) => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][n - 1] || `number ${n}`;
    const lines = ['The sun is coming up. Time for the final standings.', 1500];
    const steps = { rows: {} };
    for (let r = ranked.length; r >= 2; r--) {
      const p = ranked[r - 1];
      steps.rows[p.id] = lines.length;
      lines.push(`In ${ord(r)} place… ${p.name}, with ${p.score} tickets.`, 1800);
    }
    const win = ranked[0];
    if (win) {
      steps.drum = lines.length;
      lines.push('And the winner of the grand prize is…', 2800);
      steps.rows[win.id] = lines.length;
      lines.push(`${win.name}! With ${win.score} tickets!`, 1200);
      steps.prize = lines.length;
      lines.push(`${win.name} takes home ${S.prize.name}. Archie and Honey approve.`);
    }
    S.endSteps = steps;
    this.emit('say', lines);
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
      case 'pick': case 'clawPlay': return [S.watch.watcherId].filter(id => this.player(id)?.connected);
      case 'tot': return ids.filter(id => S.watch.answers[id] == null);
      case 'decide': return ids.filter(id => id === S.watch.watcherId && !S.watch.decision);
      case 'triviaQ': case 'finaleQ': case 'pollQ': case 'hideQ': case 'guessQ': case 'doorQ': case 'zoomQ': return ids.filter(id => !mg.answers[id]);
      case 'seanceQ': return ids.filter(id => this.player(id).ghost && !mg.answers[id]);
      case 'stakesBet': return ids.filter(id => !mg.bets[id]);
      case 'finalePick': return [mg.picker].filter(id => this.player(id)?.connected);
      case 'drawDraw': return ids.filter(id => mg.prompts[id] && !mg.drawings[id]);
      case 'drawFib': return ids.filter(id => id !== this.artistId() && !mg.lies[id]);
      case 'drawVote': return ids.filter(id => id !== this.artistId() && mg.votes[id] == null);
      default: return [];
    }
  }

  checkAllDone() {
    const phases = ['tot', 'decide', 'triviaQ', 'finaleQ', 'pollQ', 'hideQ', 'guessQ', 'doorQ', 'zoomQ', 'drawDraw', 'drawFib', 'drawVote', 'stakesBet', 'seanceQ'];
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
    const base = { me: { name: me.name, avatar: me.avatar, score: me.score, ghost: !!me.ghost }, gain: S.gains[pid] || 0, vip: this.vipId() === pid, story: this.isNarrated() };
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
        const v = w.watcherId === pid ? wait(`You're on the night shift! ${ev.emoji} ${ev.name}`, named(S, ev.text), '🔦')
          : wait(`${watcher?.name} is on the night shift`, `${ev.emoji} ${ev.name}: ${named(S, ev.text)}`, '🔦');
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
              return { name: sp.name, cat: hidden ? 'Mystery' : c.name, emoji: hidden ? '❓' : c.emoji, ...this.stakesNow(i), reach: this.reachable().includes(i), here: w.at === i };
            })
          };
        }
        return wait(`${watcher?.name} is picking a category…`, `It's ${CLOCK[w.streak]} · pot ${w.pot} 🎟️`, '👀');
      case 'tot': {
        const c = CATEGORIES[w.q.cat];
        return {
          ...base, screen: 'tot', watcher: w.watcherId === pid, watcherName: watcher?.name,
          find: w.find ? `${SURPRISES[w.find.kind].emoji} ${surpriseLine(S, w.find, w.watcherId === pid ? 'You' : watcher?.name || 'Someone')}` : null,
          catName: c.name, catEmoji: c.emoji, q: w.q.q, opts: w.q.opts, locked: w.answers[pid] ?? null,
          streak: w.streak, pot: w.pot, ...w.st, side: this.sideRight(), event: EVENTS[S.event], monster: S.monster
        };
      }
      case 'totReveal': {
        const mine = w.answers[pid];
        const right = w.q.opts[w.q.ans];
        if (mine == null) return { ...wait(`It's ${right}`, 'You didn\'t answer this one.', '🤷'), suspense: true };
        if (pid === w.watcherId && w.saved) return { ...wait('Saved by the dogs!', `It was ${right}. Archie & Honey chased it off.`, '🐕'), suspense: true };
        if (pid === w.watcherId && w.hit) return { ...wait(w.hit.final ? 'You defeated it!' : 'You hit it!', `🎰 +${w.hit.loot} mystery prize · pot ${w.pot} 🎟️`, '⚔️'), suspense: true };
        if (pid === w.watcherId && w.results[pid]) return { ...wait('Correct!', `Pot: ${w.pot} 🎟️`, '✅'), suspense: true };
        return { ...wait(w.results[pid] ? 'Correct!' : 'Wrong!', `It's ${right}.`, w.results[pid] ? '✅' : '❌'), suspense: true };
      }
      case 'decide':
        if (w.watcherId !== pid) return wait(`${watcher?.name} has ${w.pot} 🎟️`, 'Keep going… or hide till morning?', '🤔');
        return {
          ...base, screen: 'decide', watcher: w.watcherId === pid, watcherName: watcher?.name, pot: w.pot, next: this.potValue(w.streak),
          streak: w.streak, risk: STAKE, locked: w.decision, sixAm: w.streak + 1 >= 3 ? SIX_AM : 0
        };
      case 'decideReveal': {
        const bank = w.decision === 'bank';
        const why = w.forced === 'leader' ? 'You\'re in the lead: no hiding until 2 right.' : w.forced === 'lockdown' ? 'Lockdown: no hiding tonight.' : 'Pick your next category…';
        if (pid === w.watcherId) return bank ? wait(`You're hiding with ${w.pot} 🎟️!`, 'Safe till morning.', '🛏️') : wait(w.forced ? 'No hiding yet!' : 'You kept going!', why, '🔦');
        return wait(bank ? `${watcher?.name} is hiding till morning!` : `${watcher?.name} kept going!`, '', bank ? '🛏️' : '🔦');
      }
      case 'safe': return wait(w.watcherId === pid ? 'You made it to 6 AM!' : `${watcher?.name} made it to 6 AM!`, `${w.pot} 🎟️ + ${SIX_AM} bonus`, '🌅');
      case 'dragged': return wait(isLost ? "You've been caught!" : `${lostName} got caught!`, isLost ? `By ${S.danger.name}. Win the mini-game to escape its grasp!` : `By ${S.danger.name}.`, S.danger.emoji);
      case 'mgIntro': {
        const m = MINIGAMES[mg.type];
        return wait(m.name, isLost ? `You're caught! ${named(S, m.rules)}` : named(S, m.rules), m.emoji);
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
      case 'hideQ':
        return {
          ...base, screen: 'choices', title: 'Hide and Seek', num: `${mg.qi + 1}/${mg.rounds.length}`,
          q: 'Where will you hide?', sub: `${killerName(S, true)} checks the most crowded spot first!`,
          choices: mg.rounds[mg.qi].map(text => ({ text })), locked: mg.answers[pid] ? mg.answers[pid].i : null
        };
      case 'hideA': {
        const caught = (mg.caught || []).includes(pid);
        return { ...wait(caught ? 'Found you!' : 'You stayed hidden!', caught ? '' : '+200 🎟️', caught ? '😱' : '🙈'), suspense: true, revealMs: mg.revealMs };
      }
      case 'zoomQ':
        return {
          ...base, screen: 'choices', title: 'Zoom In', num: `${mg.qi + 1}/${mg.questions.length}`,
          q: 'What is it?', sub: 'Fastest right answers win: 300 · 200 · 100',
          choices: mg.questions[mg.qi].c.map(text => ({ text })), locked: mg.answers[pid] ? mg.answers[pid].i : null
        };
      case 'zoomA': {
        const q = mg.questions[mg.qi];
        const a = mg.answers[pid];
        const ok = a && a.i === q.a;
        if (!ok) return wait('Nope!', `It's ${q.c[q.a]}`, '❌');
        return a.worth
          ? wait(`${['1st', '2nd', '3rd'][a.rank]}! +${a.worth}`, `It's ${q.c[q.a]}`, ['🥇', '🥈', '🥉'][a.rank])
          : wait('Right, but too slow!', `It's ${q.c[q.a]}`, '🐢');
      }
      case 'doorQ':
        return {
          ...base, screen: 'choices', title: 'Pick a Door', num: `${mg.qi + 1}/${mg.rounds.length}`,
          q: 'Which door?', sub: `🎁 +300 · 🍬 +100 · one hides ${killerName(S)}`,
          choices: mg.rounds[mg.qi].map(text => ({ text })), locked: mg.answers[pid] ? mg.answers[pid].i : null
        };
      case 'doorA': {
        const a = mg.answers[pid];
        const b = a ? mg.behind[a.i] : null;
        if (!b) return { ...wait('You froze!', 'No door, no escape.', '😱'), suspense: true, revealMs: mg.revealMs };
        return { ...wait(b.kind === 'monster' ? `${killerName(S, true)}!` : b.kind === 'big' ? 'The big prize!' : 'A little prize', b.tickets ? `+${b.tickets} 🎟️` : '', b.kind === 'monster' ? mg.seeker : b.emoji), suspense: true, revealMs: mg.revealMs };
      }
      case 'guessQ': {
        const q = mg.questions[mg.qi];
        return { ...base, screen: 'number', title: 'Closest Guess', num: `${mg.qi + 1}/${mg.questions.length}`, q: q.q, unit: q.unit, locked: mg.answers[pid]?.n ?? null };
      }
      case 'guessA': {
        const q = mg.questions[mg.qi];
        const won = (mg.winners || []).includes(pid);
        const mine = mg.answers[pid];
        return { ...wait(won ? 'Closest!' : 'Not the closest', `Answer: ${q.a.toLocaleString('en-US')}${q.unit ? ` ${q.unit}` : ''}${mine ? ` · you said ${mine.n.toLocaleString('en-US')}` : ''}`, won ? '🎯' : '📏'), suspense: true, revealMs: mg.revealMs };
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
      case 'mgResult': return isLost && !mg.result ? wait("You're a ghost now", "You won't get the night shift, but you still play everything else. Watch for a séance…", '👻')
        : wait(mg.result ? `${lostName} made it home!` : `${lostName} is a ghost now`, '', mg.result ? '🏠' : '👻');
      case 'clawPlay':
        return w.watcherId === pid
          ? { ...base, screen: 'stop', title: '🕹️ Claw machine!', sub: 'Watch the claw on the TV and drop it on a capsule. A ghost could come back!', button: 'DROP' }
          : wait('🕹️ Claw machine!', me.ghost ? `${watcher?.name} is going for the capsules… one might be you!` : `${watcher?.name} is lining up the claw…`, '🕹️');
      case 'clawGrab': {
        const prize = w.find?.prize;
        if (prize?.type === 'ghost' && prize.pid === pid) return { ...wait("You're back!", 'Back from the dead, and back in the night shift draw.', '🕹️'), suspense: true, revealMs: 2600 };
        return { ...wait('The claw is coming up…', '', '🕹️'), suspense: true, revealMs: 2600 };
      }
      case 'seanceIntro': return wait('🕯️ Séance', me.ghost ? 'Get ready: fastest right answer comes back to life!' : 'The dead are stirring…', '🕯️');
      case 'seanceQ': {
        const q = mg.questions[0];
        if (!me.ghost) return wait('The dead are stirring…', 'Only ghosts answer this one.', '🕯️');
        return { ...base, screen: 'choices', title: 'Séance', q: q.q, sub: 'Fastest right answer comes back to life', choices: q.c.map(text => ({ text })), locked: mg.answers[pid] ? mg.answers[pid].i : null };
      }
      case 'seanceA': {
        const back = mg.revived && this.player(mg.revived);
        if (mg.revived === pid) return wait("You're back!", 'Back from the dead, and back in the night shift draw.', '🕯️');
        return wait(back ? `${back.name} is back from the dead!` : 'The spirits stay restless', `Answer: ${mg.questions[0].c[mg.questions[0].a]}`, '🕯️');
      }
      case 'scores': {
        const rank = this.ranked().findIndex(p => p.id === pid) + 1;
        return wait(`You're #${rank}`, `${me.score} 🎟️`, '📊');
      }
      case 'finaleIntro': return wait('Trivia Blitz', 'Five questions. Double tickets.', '🐻');
      case 'finalePick': {
        if (pid === mg.picker) return { ...base, screen: 'finale', options: mg.options.map(k => ({ key: k, ...FINALES[k] })) };
        return wait(`${this.player(mg.picker)?.name} is choosing the finale…`, "Last place picks how the night ends.", '🌅');
      }
      case 'stakesIntro':
        return wait('Sunrise Stakes', mg.boosted.includes(pid) ? 'You get a 1.5× comeback boost on wins!' : 'Bet your tickets on the last 5 cards.', '🌅');
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
        if (!S.endRevealed) return wait('Final standings…', 'Look at the TV!', '🥁');
        const rank = this.ranked().findIndex(p => p.id === pid) + 1;
        return { ...base, screen: 'end', rank, total: S.players.length, prize: rank === 1 ? S.prize : null };
      }
      default: return wait('Look at the TV', '', '📺');
    }
  }
}
