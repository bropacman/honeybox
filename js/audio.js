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
  lock() { tone(500, 0.06, { type: 'square', vol: 0.05 }); }
};

let voice = null;
function pickVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  voice = voices.find(v => /en-US/i.test(v.lang) && /Google|Samantha|Daniel|Alex/i.test(v.name))
    || voices.find(v => /^en/i.test(v.lang)) || null;
}
if (window.speechSynthesis) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function say(text) {
  if (muted || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 1.05;
  u.pitch = 0.9;
  window.speechSynthesis.speak(u);
}
