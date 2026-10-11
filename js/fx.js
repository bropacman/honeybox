// Presentation layer for the TV: flashlight darkness, glinting eyes, film grain, screen shake,
// red scare flashes and ticket confetti. Pure DOM/CSS; the game logic never touches it.

const el = (cls, html = '') => {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  return d;
};

// eyes that blink open in the dark corners while the lights are low
const EYES = [[6, 14], [92, 10], [4, 78], [95, 70], [50, 96], [80, 92]];

export function startFx() {
  const dark = el('fx-dark', EYES.map(([x, y], i) => `<i class="fx-eyes" style="left:${x}%;top:${y}%;animation-delay:${i * 1.7}s"></i>`).join(''));
  const grain = el('fx-grain');
  const flash = el('fx-flash');
  const confetti = el('fx-confetti');
  document.body.append(dark, grain, flash, confetti);
  let retro = true;
  try { retro = localStorage.getItem('honeybox_retro') !== 'off'; } catch (e) { /* default on */ }
  grain.classList.toggle('on', retro);

  const pulse = (node, cls, ms) => {
    node.classList.remove(cls);
    void node.offsetWidth; // restart the animation
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), ms);
  };

  return {
    // charge 1 = full battery (wide light), 0 = empty (tight, flickering)
    setDark(on, charge = 1, sweep = false) {
      dark.classList.toggle('on', on);
      dark.classList.toggle('sweep', on && sweep);
      dark.classList.toggle('low', on && charge < 0.25);
      dark.style.setProperty('--r', `${Math.round(50 + 30 * Math.max(0, Math.min(1, charge)))}vmax`);
    },
    shake(big = false) { const tv = document.querySelector('.tv'); if (tv) pulse(tv, big ? 'fx-shake-big' : 'fx-shake', big ? 700 : 450); },
    scare() { pulse(flash, 'red', 600); this.shake(true); },
    punch() { const m = document.querySelector('.tv-main'); if (m) pulse(m, 'fx-punch', 400); },
    confetti(n = 24, glyph = '🎟️') {
      for (let i = 0; i < n; i++) {
        const c = el('fx-bit', glyph);
        c.style.left = `${Math.random() * 100}%`;
        c.style.setProperty('--dx', `${(Math.random() - 0.5) * 30}vw`);
        c.style.setProperty('--rot', `${(Math.random() - 0.5) * 900}deg`);
        c.style.animationDelay = `${Math.random() * 0.5}s`;
        c.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
        confetti.appendChild(c);
        setTimeout(() => c.remove(), 4000);
      }
    },
    get retro() { return retro; },
    toggleRetro() {
      retro = !retro;
      grain.classList.toggle('on', retro);
      try { localStorage.setItem('honeybox_retro', retro ? 'on' : 'off'); } catch (e) { /* ignore */ }
    }
  };
}
