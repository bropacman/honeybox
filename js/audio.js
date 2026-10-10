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
  if (m) window.speechSynthesis?.cancel();
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

export const sfx = {
  join() { tone(660, 0.12); tone(880, 0.15, { delay: 0.1 }); },
  tick() { tone(1200, 0.05, { type: 'square', vol: 0.04 }); },
  flip() { tone(300, 0.08, { type: 'triangle', slide: 400 }); },
  good() { [523, 659, 784].forEach((f, i) => tone(f, 0.18, { delay: i * 0.09, type: 'triangle' })); },
  great() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { delay: i * 0.08, type: 'triangle', vol: 0.18 })); },
  bad() { tone(220, 0.5, { type: 'sawtooth', vol: 0.08, slide: -120 }); },
  howl() {
    tone(380, 1.6, { type: 'sine', vol: 0.12, slide: 260 });
    tone(640, 1.2, { type: 'sine', vol: 0.08, delay: 0.5, slide: -300 });
  },
  lock() { tone(500, 0.06, { type: 'square', vol: 0.05 }); },
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

// ---------- narrator ----------
// Browser voices only (free, offline). Quality depends on the laptop:
// Edge has very natural "Online (Natural)" voices; Chrome has "Google" voices; Macs have Siri-like ones.
export const STYLES = {
  narrator: { label: '🎙️ Narrator', rate: 1.0, pitch: 0.95, sample: 'Welcome to the cabin. Survive until 6 A M.' },
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

export function voiceOptions() {
  return englishVoices().map(v => ({
    name: v.name,
    label: `${voiceRank(v) >= 80 ? '⭐ ' : ''}${v.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s*\(.*?\)\s*/g, ' ').trim()} (${v.lang})`
  }));
}

export function voiceSettings() {
  const list = englishVoices();
  const voice = list.find(v => v.name === settings.voice) || list[0] || null;
  return { voice: voice?.name || null, style: settings.style };
}

function persist() { try { localStorage.setItem(VOICE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }
export function setVoice(name) { settings.voice = name; persist(); }
export function setStyle(style) { if (STYLES[style]) { settings.style = style; persist(); } }

export function say(text) {
  if (muted || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const name = voiceSettings().voice;
  const v = englishVoices().find(x => x.name === name);
  if (v) { u.voice = v; u.lang = v.lang; }
  const st = STYLES[settings.style];
  u.rate = st.rate;
  u.pitch = st.pitch;
  window.speechSynthesis.speak(u);
}
