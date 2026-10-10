import { startTV, savedGame } from './tv.js';
import { startPhone } from './phone.js';

const root = document.getElementById('app');
const params = new URLSearchParams(location.search);

if (params.has('host')) {
  document.body.classList.add('is-tv');
  const saved = savedGame();
  if (saved) {
    root.innerHTML = `<div class="center tv-start">
      <h1 class="logo">Honey<span>box</span></h1>
      <p>A game in room <b>${saved.code}</b> is still going.</p>
      <div class="row"><button class="big-btn" id="resume">Resume game</button><button id="fresh">Start a new room</button></div>
    </div>`;
    root.querySelector('#resume').onclick = () => startTV(root, { resume: saved });
    root.querySelector('#fresh').onclick = () => startTV(root);
  } else {
    root.innerHTML = `<div class="center tv-start">
      <h1 class="logo">Honey<span>box</span></h1>
      <p class="big">Put this screen on the TV.</p>
      <button class="big-btn" id="open">Open the cabin 🔥</button>
      <p class="muted">Turn the sound up. The narrator talks.</p>
    </div>`;
    root.querySelector('#open').onclick = () => startTV(root);
  }
} else {
  document.body.classList.add('is-phone');
  startPhone(root);
}
