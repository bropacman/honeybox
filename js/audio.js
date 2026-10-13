// Procedural sound effects + a text-to-speech narrator for the TV.

let ctx = null;
let muted = false;

export function unlockAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
  }
  ctx?.resume?.();
}

export function setMuted(m) {
  muted = m;
  if (m) { stopSpeaking(); setMusic('none'); }
}
export const isMuted = () => muted;

function tone(freq, dur, { type = 'sine', vol = 0.15, delay = 0, slide = 0 } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

let clockFlip = false;
export const sfx = {
  join() { tone(660, 0.12); tone(880, 0.15, { delay: 0.1 }); },
  // spooky countdown: a low heartbeat "lub-dub"
  tick() {
    tone(62, 0.16, { type: 'sine', vol: 0.5, slide: -20 });
    tone(55, 0.14, { type: 'sine', vol: 0.38, delay: 0.2, slide: -18 });
    tone(180, 0.05, { type: 'triangle', vol: 0.05 });
  },
  flip() { tone(300, 0.08, { type: 'triangle', slide: 400 }); },
  good() { [523, 659, 784].forEach((f, i) => tone(f, 0.18, { delay: i * 0.09, type: 'triangle' })); },
  great() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { delay: i * 0.08, type: 'triangle', vol: 0.18 })); },
  bad() { tone(220, 0.5, { type: 'sawtooth', vol: 0.08, slide: -120 }); },
  howl() {
    tone(380, 1.6, { type: 'sine', vol: 0.12, slide: 260 });
    tone(640, 1.2, { type: 'sine', vol: 0.08, delay: 0.5, slide: -300 });
  },
  lock() { tone(500, 0.06, { type: 'square', vol: 0.05 }); },
  // the Cyclone light stepping to the next bulb
  blip() { tone(1180, 0.035, { type: 'square', vol: 0.035 }); },
  // swoosh for title cards
  whoosh() {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(300, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.5);
    g.gain.value = 0.18;
    src.buffer = buf;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  },
  // wheel spin: clicks that slow down over ~3.8 seconds
  spin() {
    if (!ctx || muted) return;
    let t = 0;
    for (let i = 0; i < 34; i++) {
      t += 0.03 + Math.pow(i / 34, 2.6) * 0.32;
      if (t > 3.8) break;
      tone(i % 2 ? 1300 : 1100, 0.03, { type: 'square', vol: 0.06, delay: t });
    }
  },
  // last-10-seconds clock: alternating tick… tock…
  clock() {
    clockFlip = !clockFlip;
    tone(clockFlip ? 1500 : 1100, 0.05, { type: 'square', vol: 0.07 });
  },
  // snare-ish roll that builds while the card shakes
  drumroll() {
    if (!ctx || muted) return;
    const hits = 22;
    for (let i = 0; i < hits; i++) {
      const t = ctx.currentTime + i * 0.07;
      const len = Math.floor(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      f.type = 'bandpass';
      f.frequency.value = 1800;
      g.gain.value = 0.04 + 0.22 * (i / hits);
      src.buffer = buf;
      src.connect(f).connect(g).connect(ctx.destination);
      src.start(t);
    }
  },
  scare() {
    // jumpscare screech: noise burst + detuned shriek
    if (ctx && !muted) {
      const len = ctx.sampleRate * 0.9;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = 0.25;
      src.buffer = buf;
      src.connect(g).connect(ctx.destination);
      src.start();
    }
    tone(900, 0.9, { type: 'sawtooth', vol: 0.12, slide: 700 });
    tone(950, 0.9, { type: 'square', vol: 0.06, slide: -500 });
  }
};

// ---------- background music ----------
// Procedural, quiet, and mood-based: a detuned drone, a slow pulse, and an uneasy high whine.
const MOODS = {
  tense: { root: 55, bpm: 76, whine: 0.5, cutoff: 380, vol: 0.07 },
  quiz: { root: 65.4, bpm: 100, whine: 0, cutoff: 520, vol: 0.05 },
  dread: { root: 41.2, bpm: 0, whine: 1, cutoff: 260, vol: 0.08 },
  sunrise: { root: 73.4, bpm: 88, whine: 0.25, cutoff: 700, vol: 0.06 },
  // final standings: a slow, low heartbeat building to the winner
  standings: { root: 49, bpm: 56, whine: 0.35, cutoff: 480, vol: 0.07 },
  // the last 10 seconds: higher, faster, more whine
  panic: { root: 82.4, bpm: 150, whine: 1, cutoff: 900, vol: 0.08 }
};
let music = null;

export function setMusic(mode) {
  if (!ctx) return;
  if ((music?.mode || 'none') === mode) return;
  if (music) {
    const old = music;
    old.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
    clearInterval(old.timer);
    setTimeout(() => old.oscs.forEach(o => { try { o.stop(); } catch (e) { /* stopped */ } }), 2500);
  }
  music = null;
  if (mode === 'anthem' && !muted) { music = anthem(); return; }
  const m = MOODS[mode];
  if (!m || muted) return;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.setTargetAtTime(m.vol, ctx.currentTime, 1.2);
  master.connect(ctx.destination);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = m.cutoff;
  filter.connect(master);
  const oscs = [];
  const add = (type, freq, vol, dest = filter) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    if (dest) g.connect(dest);
    o.start();
    oscs.push(o);
    return o;
  };
  add('sawtooth', m.root, 0.5);
  add('sawtooth', m.root * 1.007, 0.5);
  add('sine', m.root * 1.5, 0.25);
  // slow filter sweep so the drone breathes
  const lfo = add('sine', 0.08, 0, null);
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = m.cutoff * 0.4;
  lfo.disconnect();
  lfo.connect(lfoGain).connect(filter.frequency);
  if (m.whine) {
    const w = add('sine', m.root * 16 * 1.06, 0.035 * m.whine, master);
    const trem = add('sine', 5.5, 0, null);
    const tg = ctx.createGain();
    tg.gain.value = 6;
    trem.disconnect();
    trem.connect(tg).connect(w.frequency);
  }
  let timer = null;
  if (m.bpm) {
    timer = setInterval(() => {
      if (muted) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(m.root * 2, t);
      o.frequency.exponentialRampToValueAtTime(m.root, t + 0.25);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(m.vol * 3, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.35);
    }, 60000 / m.bpm);
  }
  music = { mode, master, oscs, timer };
}

// The winner's anthem: a bright brassy fanfare loop (I - IV - V - I in D major) with a marching drum.
function anthem() {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.setTargetAtTime(0.09, ctx.currentTime, 0.3);
  master.connect(ctx.destination);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  filter.connect(master);
  const chords = [[146.83, 185.0, 220.0], [196.0, 246.94, 293.66], [220.0, 277.18, 329.63], [146.83, 185.0, 220.0]];
  const tune = [[293.66, 369.99, 440.0, 587.33], [392.0, 493.88, 587.33, 493.88], [440.0, 554.37, 659.25, 554.37], [587.33, 440.0, 369.99, 293.66]];
  const note = (f, t, len, type, vol) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(vol * 0.5, t + len * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(filter);
    o.start(t);
    o.stop(t + len + 0.05);
  };
  let bar = 0;
  const playBar = () => {
    if (muted) return;
    const t = ctx.currentTime + 0.05;
    const n = bar % 4;
    chords[n].forEach(f => { note(f, t, 1.9, 'sawtooth', 0.05); note(f / 2, t, 1.9, 'triangle', 0.07); });
    tune[n].forEach((f, i) => note(f, t + i * 0.5, 0.42, 'square', 0.035));
    [0, 0.5, 1, 1.5].forEach((d, i) => tone(i % 2 ? 160 : 90, 0.18, { delay: t - ctx.currentTime + d, type: 'sine', vol: i % 2 ? 0.05 : 0.12, slide: -40 }));
    bar++;
  };
  playBar();
  return { mode: 'anthem', master, oscs: [], timer: setInterval(playBar, 2000) };
}

// ---------- character voices ----------
// Every avatar has a little synthesized call. Happy = two rising calls, sad = one slow droopy call.
const CALLS = {
  bark: { type: 'sawtooth', base: 380, len: 0.12, slide: -0.4, filter: 1300, noise: 0.25 },
  meow: { type: 'triangle', base: 650, len: 0.32, slide: 0.45, vib: [6, 12] },
  squeak: { type: 'sine', base: 1900, len: 0.07, slide: 0.35 },
  growl: { type: 'sawtooth', base: 105, len: 0.42, slide: 0.15, vib: [28, 14], filter: 700 },
  yip: { type: 'sawtooth', base: 850, len: 0.1, slide: 0.6, filter: 2500 },
  chitter: { type: 'triangle', base: 1500, len: 0.04, slide: 0.2, repeat: 5 },
  oink: { type: 'square', base: 210, len: 0.18, slide: -0.3, filter: 900, noise: 0.08 },
  ribbit: { type: 'square', base: 170, len: 0.07, slide: 0.1, filter: 800, repeat: 2 },
  ooh: { type: 'sine', base: 380, len: 0.22, slide: 0.9 },
  hoot: { type: 'sine', base: 420, len: 0.3, slide: -0.08, vib: [5, 6] },
  quack: { type: 'sawtooth', base: 470, len: 0.15, slide: -0.25, filter: 1100, q: 6 },
  blip: { type: 'triangle', base: 280, len: 0.22, slide: 0.2 },
  neigh: { type: 'sawtooth', base: 720, len: 0.5, slide: -0.45, vib: [13, 60], filter: 2200 },
  buzz: { type: 'sawtooth', base: 210, len: 0.5, slide: 0.05, vib: [32, 18], filter: 900 },
  bleat: { type: 'sine', base: 520, len: 0.42, slide: -0.1, vib: [9, 45] },
  bellow: { type: 'sawtooth', base: 120, len: 0.7, slide: -0.25, filter: 600, vib: [4, 5] }
};

// avatar -> [call, pitch multiplier]
const CHARACTER = {
  '🐶': ['bark', 1.15], '🐕': ['bark', 0.85], '🦮': ['bark', 1.0], '🐩': ['bark', 1.45],
  '🐱': ['meow', 1.0], '🐰': ['squeak', 1.0], '🐻': ['growl', 1.0], '🐼': ['growl', 1.35],
  '🐨': ['growl', 1.7], '🦊': ['yip', 1.0], '🦝': ['chitter', 0.9], '🐷': ['oink', 1.0],
  '🐸': ['ribbit', 1.0], '🐵': ['ooh', 1.0], '🦉': ['hoot', 1.0], '🐧': ['quack', 1.3],
  '🦆': ['quack', 1.0], '🐢': ['blip', 0.9], '🦄': ['neigh', 1.15], '🐝': ['buzz', 1.0],
  '🦌': ['bleat', 1.0], '🫎': ['bellow', 1.0], '🐿️': ['chitter', 1.3], '🦔': ['squeak', 1.35],
  // anime set additions
  '🦦': ['chitter', 1.1], '🦥': ['ooh', 0.7], '🐹': ['squeak', 1.6], '🦭': ['bark', 1.3], '🐮': ['bellow', 1.3], '🐑': ['bleat', 1.25],
  '🐯': ['growl', 1.25], '🦁': ['growl', 0.9], '🐲': ['bellow', 1.6], '🐙': ['blip', 1.2], '🦎': ['squeak', 1.1]
};

function voiceTone(freq, dur, delay, spec) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * (1 + spec.slideNow)), t + dur);
  let out = osc;
  if (spec.vib) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = spec.vib[0];
    depth.gain.value = spec.vib[1];
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  if (spec.filter) {
    const f = ctx.createBiquadFilter();
    f.type = spec.q ? 'bandpass' : 'lowpass';
    f.frequency.value = spec.filter;
    if (spec.q) f.Q.value = spec.q;
    out.connect(f);
    out = f;
  }
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  if (spec.noise) {
    const len = Math.floor(ctx.sampleRate * Math.min(dur, 0.1));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = spec.noise;
    src.buffer = buf;
    src.connect(g).connect(ctx.destination);
    src.start(t);
  }
}

function call(spec, freq, delay, lenMul, slideSign) {
  const n = spec.repeat || 1;
  const len = spec.len * lenMul;
  const s = { ...spec, slideNow: Math.abs(spec.slide) * slideSign };
  for (let i = 0; i < n; i++) voiceTone(freq, len, delay + i * (len + 0.03), s);
  return n * (len + 0.03);
}

export function characterSound(avatar, mood = 'happy', delayMs = 0) {
  if (!ctx || muted) return;
  const [kind, mul] = CHARACTER[String(avatar).replace(/\uFE0E/g, '')] || ['blip', 1];
  const spec = CALLS[kind];
  const f = spec.base * mul;
  const d = delayMs / 1000;
  if (mood === 'happy') {
    const first = call(spec, f, d, 1, 1);
    call(spec, f * 1.26, d + first + 0.04, 1, 1);
  } else {
    call(spec, f * 0.72, d, 2.2, -1);
  }
}

// ---------- narrator ----------
// Browser voices only (free, offline). Quality depends on the laptop:
// Edge has very natural "Online (Natural)" voices; Chrome has "Google" voices; Macs have Siri-like ones.
export const STYLES = {
  narrator: { label: '🎙️ Normal', rate: 1.0, pitch: 0.95, sample: 'Welcome to the cabin. Survive until 6 A M.' },
  creepy: { label: '👻 Creepy', rate: 0.82, pitch: 0.35, sample: 'Story Land is closed. But we are still… awake.' },
  counselor: { label: '🏕️ Camp Counselor', rate: 1.15, pitch: 1.25, sample: 'Okay campers! Who is ready for some s’mores and screaming?' },
  animatronic: { label: '🤖 Animatronic', rate: 0.75, pitch: 0.1, sample: 'Hello. Friend. Please. Stay. Forever.' },
  chipmunk: { label: '🐿️ Chipmunk', rate: 1.3, pitch: 2.0, sample: 'I am a tiny woodland creature and I have seen things.' }
};

const VOICE_KEY = 'honeybox_voice';
let settings = { voice: null, style: 'narrator' };
try { settings = { ...settings, ...JSON.parse(localStorage.getItem(VOICE_KEY) || '{}') }; } catch (e) { /* ignore */ }
if (!STYLES[settings.style]) settings.style = 'narrator';

function voiceRank(v) {
  let r = 0;
  if (/natural/i.test(v.name)) r += 100;
  if (/neural|premium|enhanced/i.test(v.name)) r += 80;
  if (/google/i.test(v.name)) r += 50;
  if (/samantha|daniel|karen|moira|aria|jenny|guy/i.test(v.name)) r += 30;
  if (/en-US/i.test(v.lang)) r += 10;
  else if (/^en/i.test(v.lang)) r += 5;
  return r;
}

function englishVoices() {
  const all = window.speechSynthesis?.getVoices() || [];
  return all.filter(v => /^en/i.test(v.lang)).sort((a, b) => voiceRank(b) - voiceRank(a));
}

// short, readable voice names: "Microsoft Emma Multilingual Online (Natural) - English (United States)" -> "Emma (en-US)"
export function voiceOptions() {
  return englishVoices().map(v => {
    const short = v.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s*\(.*?\)/g, '').replace(/\s+-\s+.*$/, '')
      .replace(/\b(Online|Multilingual|Natural)\b/g, '').replace(/\s+/g, ' ').trim() || v.name;
    return { name: v.name, label: `${voiceRank(v) >= 80 ? '⭐ ' : ''}${short} (${v.lang})` };
  });
}

export function voiceSettings() {
  const list = englishVoices();
  const voice = list.find(v => v.name === settings.voice) || list[0] || null;
  return { voice: voice?.name || null, style: settings.style };
}

function persist() { try { localStorage.setItem(VOICE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }
export function setVoice(name) { settings.voice = name; persist(); }
export function setStyle(style) { if (STYLES[style]) { settings.style = style; persist(); } }

// The narrator queues lines instead of cutting itself off, and speaks one sentence-sized chunk
// at a time (Chrome silently stops utterances that run longer than ~15 seconds).
let queue = [];
let current = null;
export const isSpeaking = () => !muted && (!!current || queue.length > 0);
export function stopSpeaking() { queue = []; current = null; window.speechSynthesis?.cancel(); }

function chunks(text) {
  const out = [];
  for (const part of String(text).split(/(?<=[.!?…]['")]*)\s+/)) {
    const t = part.trim();
    if (!t) continue;
    if (out.length && out[out.length - 1].length + t.length < 110) out[out.length - 1] += ` ${t}`;
    else out.push(t);
  }
  return out;
}

// text can be a string or a list of lines; onLine(i) fires as line i starts being spoken
export function say(text, onLine) {
  if (muted || !window.speechSynthesis || !text) return false;
  // a number in the list is a pause, in milliseconds
  (Array.isArray(text) ? text : [text]).forEach((line, i) => {
    const cue = onLine ? () => onLine(i) : null;
    if (typeof line === 'number') queue.push({ pause: line, cue });
    else chunks(line).forEach((t, j) => queue.push({ text: t, cue: j === 0 ? cue : null }));
  });
  if (!current) speakNext();
  return true;
}

function speakNext() {
  const item = queue.shift();
  if (!item || muted) { current = null; return; }
  const { text, cue } = item;
  if (item.pause) {
    const token = {};
    current = token;
    cue?.();
    setTimeout(() => { if (current === token) { current = null; speakNext(); } }, item.pause);
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  const name = voiceSettings().voice;
  const v = englishVoices().find(x => x.name === name);
  if (v) { u.voice = v; u.lang = v.lang; }
  const st = STYLES[settings.style];
  u.rate = st.rate;
  u.pitch = st.pitch;
  current = u;
  const started = Date.now();
  const est = ((text.length / 14) / st.rate + 1.5) * 1000;
  const done = () => {
    if (current !== u) return;
    current = null;
    setTimeout(() => { if (!current) speakNext(); }, 150);
  };
  u.onend = done;
  u.onerror = done;
  // some browsers never fire onend: once the estimate passes, finish when the engine goes quiet (or after a hard cap)
  const watchdog = () => {
    if (current !== u) return;
    if (window.speechSynthesis.speaking && Date.now() - started < est * 2 + 4000) setTimeout(watchdog, 500);
    else done();
  };
  setTimeout(watchdog, est);
  window.speechSynthesis.speak(u);
  cue?.();
}
