// Drawing pad (phones) and stroke playback (TV). Strokes use 0-1000 coordinates.

export const INK = ['#1b1b1b', '#d63b2f', '#2f6fd6', '#2e9e4f', '#8a5a2b', '#f2b134'];

export function drawStrokes(canvas, strokes, { animate = false, onDone } = {}) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const s = W / 1000;
  g.fillStyle = '#fbf6ea';
  g.fillRect(0, 0, W, canvas.height);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const segment = (st, upto) => {
    g.strokeStyle = st.c;
    g.lineWidth = st.w * s;
    g.beginPath();
    const p = st.p;
    g.moveTo(p[0] * s, p[1] * s);
    if (p.length === 2) g.lineTo(p[0] * s + 0.1, p[1] * s);
    for (let i = 2; i < Math.min(p.length, upto * 2); i += 2) g.lineTo(p[i] * s, p[i + 1] * s);
    g.stroke();
  };

  if (!animate) {
    for (const st of strokes || []) segment(st, Infinity);
    onDone?.();
    return () => {};
  }

  const total = (strokes || []).reduce((n, st) => n + st.p.length / 2, 0);
  const durMs = Math.min(4000, 800 + total * 4);
  const start = performance.now();
  let raf = 0;
  const frame = (now) => {
    const shown = Math.floor(total * Math.min(1, (now - start) / durMs));
    g.fillStyle = '#fbf6ea';
    g.fillRect(0, 0, W, canvas.height);
    let left = shown;
    for (const st of strokes) {
      const n = st.p.length / 2;
      if (left <= 0) break;
      segment(st, Math.min(n, left));
      left -= n;
    }
    if (shown < total) raf = requestAnimationFrame(frame);
    else onDone?.();
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

// Attaches a drawing pad to a canvas. Returns { strokes, undo, clear, setColor, setWidth }.
export function drawingPad(canvas) {
  const strokes = [];
  let color = INK[0];
  let width = 10;
  let current = null;
  const redraw = () => drawStrokes(canvas, strokes);
  redraw();

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return [
      Math.round(Math.max(0, Math.min(1000, ((e.clientX - r.left) / r.width) * 1000))),
      Math.round(Math.max(0, Math.min(1000, ((e.clientY - r.top) / r.height) * 1000)))
    ];
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    current = { c: color, w: width, p: pos(e) };
    strokes.push(current);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    e.preventDefault();
    const [x, y] = pos(e);
    const p = current.p;
    const dx = x - p[p.length - 2];
    const dy = y - p[p.length - 1];
    if (dx * dx + dy * dy < 16) return;
    p.push(x, y);
    redraw();
  });
  const end = () => { current = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);

  return {
    strokes,
    undo() { strokes.pop(); redraw(); },
    clear() { strokes.length = 0; redraw(); },
    setColor(c) { color = c; },
    setWidth(w) { width = w; },
    // used by the test bot
    scribble() {
      for (let k = 0; k < 4; k++) {
        const st = { c: INK[k % INK.length], w: 10, p: [] };
        let x = 200 + Math.random() * 600, y = 200 + Math.random() * 600;
        for (let i = 0; i < 30; i++) {
          x = Math.max(0, Math.min(1000, x + (Math.random() - 0.5) * 120));
          y = Math.max(0, Math.min(1000, y + (Math.random() - 0.5) * 120));
          st.p.push(Math.round(x), Math.round(y));
        }
        strokes.push(st);
      }
      redraw();
    }
  };
}
