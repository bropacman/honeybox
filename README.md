# 🍯 Honeybox

A Jackbox-style party game for the family. The laptop on the TV is the cabin; everyone plays on their phone.

**Survive the night.** The family is holed up in a cabin in the New Hampshire woods. Each night one player takes the
**night watch**: they pick a spot around the cabin, then *everyone* secretly calls the next card **HIGH**, **LOW** or
**SAME** on their phone. The watcher needs **3 in a row** to get back inside (a correct SAME is a 🍯 Honey Pot — straight home).
Miss, and they're **dragged into the woods**, and everyone plays a minigame while the lost player plays for their honey:

- 🐻 **Bear Trivia** (Trivia Murder Party style)
- 🖍️ **Sketchy Woods**: a Drawful clone where you draw a secret prompt, fib fake titles, and find the real one
- 📋 **Cabin Census** (Survey Scramble style): pick what most people will pick

It ends with **Last Light**, a double-honey trivia finale. Most 🍯 wins. About 20 minutes for 3–8 players.

## Playing

1. On the laptop (Chrome), open the site with `?host=1`, e.g. `https://bropacman.github.io/honeybox/?host=1`, and put it on the TV.
   Turn the sound up; there's a narrator.
2. Everyone scans the QR code or goes to the site and types the 4-letter room code.
3. Press **Start the night**. TV shortcuts: **Space** = pause, **N** = skip the current timer.

Everyone should be on the house Wi-Fi (phones on cellular usually work too, but not always).
If the TV tab gets refreshed, reopen `?host=1` and press **Resume game**; phones reconnect on their own.

## How it works

Plain static files (no build step), hosted on GitHub Pages. Phones connect directly to the TV's browser over WebRTC
using [PeerJS](https://peerjs.com/) (vendored in `vendor/`) and its free public signaling server. The TV runs the game
(`js/game.js`), renders the big screen (`js/tv.js`) and sends each phone its own view (`js/phone.js`).

All questions, prompts, polls and danger lines live in `js/content.js`. Add more!

## Testing

```bash
npm install
npm run e2e
```

This starts a local PeerJS server, opens the TV and 3 bot phones in Chromium, plays full games at high speed through the
real UI, and writes screenshots and a `summary.json` to `test-artifacts/`.
