"use strict";
/* PATIENCE card art: vector suits, pip layouts, framed court cards and four card backs, cached as sprites. */
const CARDS = (() => {
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const opts = { four: false, back: 0 };
  let W = 60, H = 84, D = 1, cache = new Map();
  const suitColor = (s) => (opts.four ? ["#1b1d24", "#cf2338", "#1f5fd1", "#1d8a4b"][s] : s === 1 || s === 2 ? "#cf2338" : "#1b1d24");
  function suitPath(g, s, x, y, size) {
    g.save(); g.translate(x, y); g.scale(size, size); g.beginPath();
    if (s === 1) { g.moveTo(0, 0.46); g.bezierCurveTo(-0.12, 0.34, -0.5, 0.1, -0.5, -0.16); g.bezierCurveTo(-0.5, -0.42, -0.18, -0.52, 0, -0.27); g.bezierCurveTo(0.18, -0.52, 0.5, -0.42, 0.5, -0.16); g.bezierCurveTo(0.5, 0.1, 0.12, 0.34, 0, 0.46); }
    else if (s === 2) { g.moveTo(0, -0.5); g.quadraticCurveTo(0.14, -0.2, 0.4, 0); g.quadraticCurveTo(0.14, 0.2, 0, 0.5); g.quadraticCurveTo(-0.14, 0.2, -0.4, 0); g.quadraticCurveTo(-0.14, -0.2, 0, -0.5); }
    else if (s === 0) { g.moveTo(0, -0.5); g.bezierCurveTo(-0.12, -0.36, -0.5, -0.14, -0.5, 0.1); g.bezierCurveTo(-0.5, 0.34, -0.22, 0.42, -0.05, 0.24); g.lineTo(-0.15, 0.5); g.lineTo(0.15, 0.5); g.lineTo(0.05, 0.24); g.bezierCurveTo(0.22, 0.42, 0.5, 0.34, 0.5, 0.1); g.bezierCurveTo(0.5, -0.14, 0.12, -0.36, 0, -0.5); }
    else { for (const [cx, cy] of [[0, -0.24], [-0.25, 0.08], [0.25, 0.08]]) { g.moveTo(cx + 0.21, cy); g.arc(cx, cy, 0.21, 0, Math.PI * 2); } g.moveTo(-0.1, -0.05); g.lineTo(0.1, -0.05); g.lineTo(0.1, 0.12); g.lineTo(-0.1, 0.12); g.closePath(); g.moveTo(-0.05, 0.1); g.lineTo(-0.16, 0.5); g.lineTo(0.16, 0.5); g.lineTo(0.05, 0.1); g.closePath(); }
    g.restore();
  }
  function suit(g, s, x, y, size, color) { suitPath(g, s, x, y, size); g.fillStyle = color || suitColor(s); g.fill(); }
  const PIPS = {
    2: [[0.5, 0], [0.5, 1]], 3: [[0.5, 0], [0.5, 0.5], [0.5, 1]], 4: [[0, 0], [1, 0], [0, 1], [1, 1]], 5: [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
    6: [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]], 7: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
    8: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
    9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0.5, 0.5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
    10: [[0, 0], [1, 0], [0.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0.5, 5 / 6], [0, 1], [1, 1]],
  };
  function mk() { const c = document.createElement("canvas"); c.width = Math.ceil(W * D); c.height = Math.ceil(H * D); const g = c.getContext("2d"); g.scale(D, D); return [c, g]; }
  function base(g) {
    const r = W * 0.075, gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#fffdf8"); gr.addColorStop(1, "#f1ece2");
    K.roundRect(g, 0.5, 0.5, W - 1, H - 1, r); g.fillStyle = gr; g.fill(); g.strokeStyle = "rgba(40,30,20,0.28)"; g.lineWidth = 1; g.stroke();
  }
  function index(g, s, r, small) {
    const col = suitColor(s), t = RANKS[r];
    g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "alphabetic";
    if (small) {
      const fs = W * 0.36; g.font = `700 ${fs}px "Libre Baskerville", Georgia, serif`;
      if (t === "10") { g.save(); g.translate(W * 0.25, 0); g.scale(0.78, 1); g.fillText(t, 0, fs * 0.92 + W * 0.04); g.restore(); } else g.fillText(t, W * 0.24, fs * 0.92 + W * 0.04);
      suit(g, s, W * 0.76, W * 0.2, W * 0.26);
    } else {
      const fs = W * 0.2; g.font = `700 ${fs}px "Libre Baskerville", Georgia, serif`;
      for (const flip of [false, true]) {
        g.save(); if (flip) { g.translate(W, H); g.rotate(Math.PI); }
        if (t === "10") { g.save(); g.translate(W * 0.125, 0); g.scale(0.76, 1); g.fillText(t, 0, W * 0.05 + fs * 0.92); g.restore(); } else g.fillText(t, W * 0.125, W * 0.05 + fs * 0.92);
        suit(g, s, W * 0.125, W * 0.32, W * 0.12); g.restore();
      }
    }
  }
  function crown(g, kind, cx, cy, w, col) {
    g.save(); g.translate(cx, cy); g.lineJoin = "round"; g.fillStyle = "#d9a93a"; g.strokeStyle = col; g.lineWidth = Math.max(1, w * 0.05); g.beginPath();
    if (kind === 12) { g.moveTo(-w / 2, w * 0.28); g.lineTo(-w / 2, -w * 0.12); g.lineTo(-w / 4, w * 0.08); g.lineTo(0, -w * 0.3); g.lineTo(w / 4, w * 0.08); g.lineTo(w / 2, -w * 0.12); g.lineTo(w / 2, w * 0.28); g.closePath(); }
    else if (kind === 11) { g.moveTo(-w * 0.42, w * 0.25); g.quadraticCurveTo(-w * 0.45, -w * 0.05, -w * 0.2, -w * 0.08); g.quadraticCurveTo(0, -w * 0.38, w * 0.2, -w * 0.08); g.quadraticCurveTo(w * 0.45, -w * 0.05, w * 0.42, w * 0.25); g.closePath(); }
    else { g.moveTo(-w * 0.1, w * 0.3); g.quadraticCurveTo(-w * 0.32, -w * 0.05, w * 0.1, -w * 0.36); g.quadraticCurveTo(w * 0.02, -w * 0.02, w * 0.12, w * 0.3); g.closePath(); }
    g.fill(); g.stroke();
    if (kind !== 10) for (const px of kind === 12 ? [-0.5, 0, 0.5] : [-0.2, 0.2]) { g.beginPath(); g.arc(px * w, kind === 12 ? (px ? -w * 0.12 : -w * 0.3) : -w * 0.08, w * 0.07, 0, Math.PI * 2); g.fillStyle = "#fff3d6"; g.fill(); g.stroke(); }
    g.restore();
  }
  function face(c) {
    const key = "f" + c.s + "," + c.r + (opts.four ? "4" : ""); if (cache.has(key)) return cache.get(key);
    const [cv, g] = mk(); base(g); const small = W < 88, col = suitColor(c.s), r = c.r;
    index(g, c.s, r, small);
    if (small) {
      if (r >= 10) { const x0 = W * 0.16, y0 = H * 0.42, fw = W * 0.68, fh = H * 0.5; K.roundRect(g, x0, y0, fw, fh, W * 0.06); g.fillStyle = ["#d8ecec", "#f6dbe0", "#f4e3b5"][r - 10]; g.fill(); g.strokeStyle = col; g.lineWidth = Math.max(1, W * 0.025); g.stroke(); crown(g, r, W * 0.5, y0 + fh * 0.3, W * 0.34, col); suit(g, c.s, W * 0.5, y0 + fh * 0.68, W * 0.28); }
      else suit(g, c.s, W * 0.5, H * 0.66, W * (r === 0 ? 0.58 : 0.5));
    } else if (r === 0) {
      if (c.s === 0) { g.beginPath(); g.arc(W / 2, H / 2, W * 0.3, 0, Math.PI * 2); g.strokeStyle = "rgba(27,29,36,0.25)"; g.lineWidth = W * 0.012; g.stroke(); }
      suit(g, c.s, W / 2, H / 2, W * (c.s === 0 ? 0.42 : 0.36));
    } else if (r < 10) {
      const n = r + 1, x0 = W * 0.3, x1 = W * 0.7, y0 = H * 0.2, y1 = H * 0.8, ps = W * 0.19;
      for (const [px, py] of PIPS[n]) { const x = x0 + (x1 - x0) * px, y = y0 + (y1 - y0) * py; g.save(); if (py > 0.5) { g.translate(x, y); g.rotate(Math.PI); g.translate(-x, -y); } suit(g, c.s, x, y, ps); g.restore(); }
    } else {
      const x0 = W * 0.2, y0 = H * 0.13, fw = W * 0.6, fh = H * 0.74, gr = g.createLinearGradient(0, y0, 0, y0 + fh), tint = [["#e3f1f1", "#bcdede"], ["#fae6ea", "#eebfca"], ["#f8ebc6", "#efd48a"]][r - 10];
      gr.addColorStop(0, tint[0]); gr.addColorStop(1, tint[1]); K.roundRect(g, x0, y0, fw, fh, W * 0.04); g.fillStyle = gr; g.fill(); g.strokeStyle = col; g.lineWidth = Math.max(1, W * 0.014); g.stroke();
      K.roundRect(g, x0 + W * 0.025, y0 + W * 0.025, fw - W * 0.05, fh - W * 0.05, W * 0.03); g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 1; g.stroke();
      crown(g, r, W / 2, y0 + fh * 0.24, W * 0.3, col);
      g.fillStyle = col; g.font = `700 ${W * 0.36}px Cinzel, Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(RANKS[r], W / 2, y0 + fh * 0.53);
      suit(g, c.s, W / 2, y0 + fh * 0.8, W * 0.16);
      for (const [cx, cy] of [[x0 + W * 0.08, y0 + W * 0.08], [x0 + fw - W * 0.08, y0 + fh - W * 0.08]]) suit(g, c.s, cx, cy, W * 0.07);
    }
    cache.set(key, cv); return cv;
  }
  const BACKS = [
    { name: "Ruby", a: "#9e1b32", b: "#6f0f22", line: "rgba(255,225,200,0.16)", ring: "#e6c36a" },
    { name: "Sapphire", a: "#1f428c", b: "#13295c", line: "rgba(200,220,255,0.16)", ring: "#cfd8ef" },
    { name: "Jade", a: "#17694a", b: "#0d4430", line: "rgba(210,255,230,0.15)", ring: "#e6c36a" },
    { name: "Onyx", a: "#24242c", b: "#121216", line: "rgba(230,195,106,0.22)", ring: "#e6c36a" },
  ];
  function back() {
    const key = "b" + opts.back; if (cache.has(key)) return cache.get(key);
    const B = BACKS[opts.back] || BACKS[0], [cv, g] = mk(), r = W * 0.075, m = W * 0.06;
    K.roundRect(g, 0.5, 0.5, W - 1, H - 1, r); g.fillStyle = "#fbf8f1"; g.fill(); g.strokeStyle = "rgba(40,30,20,0.3)"; g.lineWidth = 1; g.stroke();
    g.save(); K.roundRect(g, m, m, W - m * 2, H - m * 2, r * 0.6); g.clip();
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, B.a); gr.addColorStop(1, B.b); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = B.line; g.lineWidth = Math.max(1, W * 0.012); const step = W * 0.11; g.beginPath();
    if (opts.back === 1) { for (let k = 1; k < 9; k++) { K.roundRect(g, m + k * step * 0.45, m + k * step * 0.45, W - 2 * (m + k * step * 0.45), H - 2 * (m + k * step * 0.45), r * 0.4); } }
    else if (opts.back === 3) { for (let k = 0; k < 14; k++) { g.moveTo(W / 2, H * 1.05); g.arc(W / 2, H * 1.05, k * step * 0.7, Math.PI, Math.PI * 2); g.moveTo(W / 2, -H * 0.05); g.arc(W / 2, -H * 0.05, k * step * 0.7, 0, Math.PI); } }
    else { for (let d = -H; d < W + H; d += step) { g.moveTo(d, 0); g.lineTo(d + H, H); g.moveTo(d, H); g.lineTo(d + H, 0); } }
    g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, W * 0.2, 0, Math.PI * 2); g.fillStyle = B.b; g.fill(); g.strokeStyle = B.ring; g.lineWidth = Math.max(1.2, W * 0.025); g.stroke();
    g.fillStyle = B.ring; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? W * 0.05 : W * 0.12; g.lineTo(W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr); } g.closePath(); g.fill();
    g.restore();
    K.roundRect(g, m, m, W - m * 2, H - m * 2, r * 0.6); g.strokeStyle = B.ring; g.globalAlpha = 0.5; g.lineWidth = Math.max(1, W * 0.012); g.stroke(); g.globalAlpha = 1;
    cache.set(key, cv); return cv;
  }
  function shadow() {
    if (cache.has("sh")) return cache.get("sh");
    const p = Math.ceil(W * 0.18), c = document.createElement("canvas"); c.width = Math.ceil((W + p * 2) * D); c.height = Math.ceil((H + p * 2) * D); const g = c.getContext("2d"); g.scale(D, D);
    g.shadowColor = "rgba(0,0,0,0.38)"; g.shadowBlur = W * 0.09; g.shadowOffsetY = W * 0.035; g.fillStyle = "#000"; K.roundRect(g, p, p, W, H, W * 0.075); g.fill();
    g.globalCompositeOperation = "destination-out"; g.shadowColor = "transparent"; K.roundRect(g, p, p, W, H, W * 0.075); g.fill();
    c.pad = p; cache.set("sh", c); return c;
  }
  function setSize(w, h, d) { if (Math.abs(w - W) < 0.01 && Math.abs(h - H) < 0.01 && d === D) return; W = w; H = h; D = d; cache = new Map(); }
  const reset = () => { cache = new Map(); };
  return { RANKS, BACKS, opts, suit, suitColor, face, back, shadow, setSize, reset, get W() { return W; }, get H() { return H; } };
})();
