"use strict";
/* STARFORGE · ui.js — the sky (forge, orbits, comets), the side panel, input, saving and the main loop */

const sky = $("#sky"), g = sky.getContext("2d"), pane = $("#pane"), hudEl = $("#hud"), newsEl = $("#news"), toastsEl = $("#toasts"), modalEl = $("#modal");
const V = { W: 0, H: 0, dpr: 1, x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0, r0: 60, R: 220, t: 0, bg: null, tw: [], pulse: 0, fx: [], texts: [], comet: null, tab: "forges", paneT: 0, sel: null, novaT: -1, upSig: "", newsT: 0, saveT: 0, achSel: null };
const TILT = 0.42;
const CAPS = [40, 16, 12, 10, 8, 8, 6, 6, 5, 5, 4, 4, 3, 3];
const SIZES = [2.4, 3.2, 5, 6.5, 9, 7, 13, 4, 8, 12, 5, 12, 10, 11];

/* ================= layout ================= */
const narrow = () => matchMedia("(orientation: portrait), (max-width: 720px)").matches;
function layout() {
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight, panel = $("#panel");
  V.dpr = dpr; V.W = W; V.H = H;
  sky.width = Math.round(W * dpr); sky.height = Math.round(H * dpr); sky.style.width = W + "px"; sky.style.height = H + "px";
  if (narrow()) { V.x = 0; V.y = 0; V.w = W; V.h = H - panel.offsetHeight + 16; } else { V.x = 0; V.y = 0; V.w = W - panel.offsetWidth; V.h = H; }
  hudEl.style.left = V.x + "px"; hudEl.style.width = V.w + "px"; hudEl.style.top = "0px";
  newsEl.style.left = V.x + "px"; newsEl.style.width = V.w + "px"; newsEl.style.top = V.y + V.h - (narrow() ? 52 : 36) + "px";
  toastsEl.style.left = V.x + 12 + "px"; toastsEl.style.bottom = H - (V.y + V.h) + (narrow() ? 64 : 48) + "px";
  const hudH = hudEl.offsetHeight + 6, availH = (V.h - hudH - 48) / 2, availW = V.w / 2 - 14;
  V.cx = V.x + V.w / 2; V.cy = V.y + hudH + availH;
  V.R = Math.max(70, Math.min(availW, availH / TILT));
  V.r0 = Math.max(22, Math.min(availH * 0.36, availW * 0.17, 78));
  buildBg();
}
addEventListener("resize", layout);
function ringR(i) { const a = V.r0 * 1.8; return a + (V.R - a) * Math.pow(i / (GENS.length - 1), 0.85); }

/* ================= drawing helpers ================= */
const _glow = {};
function glowSprite(rgb) {
  if (_glow[rgb]) return _glow[rgb];
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.25, `rgba(${rgb},0.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return (_glow[rgb] = c);
}
function glow(ctx, x, y, r, rgb, a = 1) { ctx.globalAlpha = a; ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); }
function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }
function shade(ctx, x, y, r, h, s, l) { const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); gr.addColorStop(0, hsl(h, s, Math.min(95, l + 25))); gr.addColorStop(0.7, hsl(h, s, l)); gr.addColorStop(1, hsl(h, s, Math.max(5, l - 25))); ctx.fillStyle = gr; circle(ctx, x, y, r); ctx.fill(); }
const seedRand = (k) => { const v = Math.sin(k * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/* One drawer per forge type. (x, y) center, s size in px, t time, k instance number, dir motion angle. */
const OBJ = [
  (c, x, y, s, t, k) => { const f = 0.7 + 0.3 * Math.sin(t * 9 + k * 3); c.globalCompositeOperation = "lighter"; glow(c, x, y, s * 4, "255,214,120", 0.55 * f); c.globalCompositeOperation = "source-over"; c.fillStyle = "#fff6d2"; circle(c, x, y, s * 0.55 * f); c.fill(); },
  (c, x, y, s, t, k, dir) => {
    const tx = -Math.cos(dir), ty = -Math.sin(dir), L = s * 6;
    const gr = c.createLinearGradient(x, y, x + tx * L, y + ty * L); gr.addColorStop(0, "rgba(160,240,255,0.75)"); gr.addColorStop(1, "rgba(160,240,255,0)");
    c.strokeStyle = gr; c.lineWidth = s * 1.1; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + tx * L, y + ty * L); c.stroke();
    c.globalCompositeOperation = "lighter"; glow(c, x, y, s * 3, "170,240,255", 0.7); c.globalCompositeOperation = "source-over";
    c.fillStyle = "#e9fdff"; circle(c, x, y, s * 0.6); c.fill();
  },
  (c, x, y, s, t, k) => { shade(c, x, y, s, 230, 8, 62); c.fillStyle = "rgba(90,95,120,0.45)"; for (let i = 0; i < 3; i++) { const a = seedRand(k * 7 + i) * TAU, d = s * 0.5 * seedRand(k + i * 3); circle(c, x + Math.cos(a) * d, y + Math.sin(a) * d, s * 0.2); c.fill(); } },
  (c, x, y, s, t, k) => { const h = [150, 200, 30, 280, 110, 0][k % 6]; shade(c, x, y, s, h, 55, 45); c.strokeStyle = hsl(h, 40, 75, 0.35); c.lineWidth = s * 0.18; c.beginPath(); c.ellipse(x, y - s * 0.2, s * 0.8, s * 0.22, 0.3, 0, Math.PI); c.stroke(); },
  (c, x, y, s, t, k) => {
    c.save(); c.translate(x, y); c.rotate(-0.35);
    c.strokeStyle = "rgba(255,220,170,0.55)"; c.lineWidth = s * 0.16; c.beginPath(); c.ellipse(0, 0, s * 1.75, s * 0.45, 0, Math.PI, TAU); c.stroke();
    shade(c, 0, 0, s, 30, 65, 55); c.save(); circle(c, 0, 0, s); c.clip();
    for (let i = -2; i <= 2; i++) { c.fillStyle = i % 2 ? "rgba(140,70,30,0.35)" : "rgba(255,230,190,0.25)"; c.fillRect(-s, i * s * 0.32 - s * 0.08, s * 2, s * 0.16); }
    c.restore();
    c.beginPath(); c.ellipse(0, 0, s * 1.75, s * 0.45, 0, 0, Math.PI); c.stroke();
    c.restore();
  },
  (c, x, y, s, t, k) => { c.globalCompositeOperation = "lighter"; glow(c, x, y, s * 4.5, "255,226,150", 0.8); c.globalCompositeOperation = "source-over"; shade(c, x, y, s, 45, 100, 72); c.strokeStyle = "rgba(255,250,220,0.6)"; c.lineWidth = 1; c.beginPath(); c.moveTo(x - s * 2.2, y); c.lineTo(x + s * 2.2, y); c.moveTo(x, y - s * 2.2); c.lineTo(x, y + s * 2.2); c.stroke(); },
  (c, x, y, s, t, k) => { c.globalCompositeOperation = "lighter"; const hs = [[300, 80, 60], [200, 80, 60], [330, 80, 65]]; hs.forEach(([h, sa, l], i) => { const a = t * 0.2 + i * 2.1 + k; glow(c, x + Math.cos(a) * s * 0.35, y + Math.sin(a) * s * 0.25, s * (0.9 + i * 0.15), hslRgb(h, sa, l), 0.45); }); c.globalCompositeOperation = "source-over"; },
  (c, x, y, s, t, k) => { const a = t * 6 + k; c.globalCompositeOperation = "lighter"; for (const sg of [1, -1]) { const gr = c.createLinearGradient(x, y, x + Math.cos(a) * s * 6 * sg, y + Math.sin(a) * s * 6 * sg); gr.addColorStop(0, "rgba(180,230,255,0.7)"); gr.addColorStop(1, "rgba(180,230,255,0)"); c.strokeStyle = gr; c.lineWidth = s * 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * s * 6 * sg, y + Math.sin(a) * s * 6 * sg); c.stroke(); } glow(c, x, y, s * 3, "190,235,255", 0.8); c.globalCompositeOperation = "source-over"; c.fillStyle = "#fff"; circle(c, x, y, s * 0.6); c.fill(); },
  (c, x, y, s, t, k) => { c.save(); c.translate(x, y); c.rotate(0.3); c.strokeStyle = "rgba(255,160,70,0.85)"; c.lineWidth = s * 0.35; c.beginPath(); c.ellipse(0, 0, s * 1.7, s * 0.55, 0, 0, TAU); c.stroke(); c.globalCompositeOperation = "lighter"; glow(c, 0, 0, s * 2.4, "255,140,60", 0.45); c.globalCompositeOperation = "source-over"; c.fillStyle = "#000"; circle(c, 0, 0, s * 0.85); c.fill(); c.strokeStyle = "rgba(255,210,150,0.9)"; c.lineWidth = 1; circle(c, 0, 0, s * 0.88); c.stroke(); c.restore(); },
  (c, x, y, s, t, k) => { c.globalCompositeOperation = "lighter"; glow(c, x, y, s * 1.5, "255,180,230", 0.5); const rot = t * 0.4 + k; for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 16; i++) { const u = i / 16, a = rot + arm * Math.PI + u * 3.4, r = s * 0.2 + u * s * 1.1; c.fillStyle = `rgba(255,${200 + i * 3},240,${0.75 - u * 0.5})`; c.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 1.6, 1.6); } c.globalCompositeOperation = "source-over"; c.fillStyle = "#fff4fb"; circle(c, x, y, s * 0.22); c.fill(); },
  (c, x, y, s, t, k) => { c.globalCompositeOperation = "lighter"; const L = s * (4 + Math.sin(t * 3 + k)); for (const sg of [1, -1]) { const gr = c.createLinearGradient(x, y, x, y + L * sg); gr.addColorStop(0, "rgba(130,255,240,0.9)"); gr.addColorStop(1, "rgba(130,255,240,0)"); c.strokeStyle = gr; c.lineWidth = s * 0.45; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + L * sg); c.stroke(); } glow(c, x, y, s * 3.5, "160,255,240", 0.9); c.globalCompositeOperation = "source-over"; c.fillStyle = "#fff"; circle(c, x, y, s * 0.5); c.fill(); },
  (c, x, y, s, t, k) => { c.globalCompositeOperation = "lighter"; c.strokeStyle = "rgba(190,255,140,0.85)"; c.lineWidth = 1.6; c.beginPath(); for (let i = 0; i <= 24; i++) { const u = i / 24 - 0.5, px = x + u * s * 2.4, py = y + Math.sin(u * 9 + t * 4 + k) * s * 0.3; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); glow(c, x, y, s * 1.3, "190,255,140", 0.35); c.globalCompositeOperation = "source-over"; },
  (c, x, y, s, t, k) => { c.globalCompositeOperation = "lighter"; [[0, "255,140,190"], [2.1, "140,200,255"], [4.2, "200,255,170"]].forEach(([o, rgb]) => { const a = t * 0.5 + o + k; const bx = x + Math.cos(a) * s * 0.45, by = y + Math.sin(a) * s * 0.3; glow(c, bx, by, s * 1.1, rgb, 0.35); c.strokeStyle = `rgba(${rgb},0.7)`; c.lineWidth = 1.2; circle(c, bx, by, s * 0.55); c.stroke(); }); c.globalCompositeOperation = "source-over"; },
  (c, x, y, s, t, k) => { c.globalCompositeOperation = "lighter"; const p = (t * 0.6 + k * 0.37) % 1; c.strokeStyle = `rgba(255,170,120,${1 - p})`; c.lineWidth = 2; circle(c, x, y, s * (0.3 + p * 1.4)); c.stroke(); glow(c, x, y, s * 1.6, "255,200,150", 0.7); c.globalCompositeOperation = "source-over"; c.fillStyle = "#fff8ec"; circle(c, x, y, s * 0.35); c.fill(); },
];
function hslRgb(h, s, l) { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return `${Math.round(f(0) * 255)},${Math.round(f(8) * 255)},${Math.round(f(4) * 255)}`; }

/* ================= background ================= */
function buildBg() {
  const c = document.createElement("canvas"), dpr = V.dpr; c.width = Math.round(V.W * dpr); c.height = Math.round(V.H * dpr);
  const x = c.getContext("2d"); x.scale(dpr, dpr);
  const gr = x.createLinearGradient(0, 0, 0, V.H); gr.addColorStop(0, "#0b0726"); gr.addColorStop(1, "#04020f"); x.fillStyle = gr; x.fillRect(0, 0, V.W, V.H);
  const neb = [[0.2, 0.25, "120,60,220"], [0.75, 0.35, "220,70,170"], [0.4, 0.8, "60,110,230"], [0.85, 0.85, "160,60,200"]];
  for (const [nx, ny, rgb] of neb) { const r = Math.max(V.w, V.h) * 0.55; const g2 = x.createRadialGradient(V.x + nx * V.w, V.y + ny * V.h, 0, V.x + nx * V.w, V.y + ny * V.h, r); g2.addColorStop(0, `rgba(${rgb},0.16)`); g2.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g2; x.fillRect(0, 0, V.W, V.H); }
  for (let i = 0; i < 420; i++) { const sx = seedRand(i * 3.1) * V.W, sy = seedRand(i * 7.7) * V.H, b = seedRand(i * 1.3); x.fillStyle = `rgba(${b > 0.8 ? "255,230,200" : b > 0.6 ? "200,220,255" : "255,255,255"},${0.15 + b * 0.5})`; x.fillRect(sx, sy, b > 0.92 ? 2 : 1, b > 0.92 ? 2 : 1); }
  V.bg = c;
  V.tw = Array.from({ length: 70 }, (_, i) => ({ x: seedRand(i * 9.3) * V.W, y: seedRand(i * 4.9) * V.H, p: seedRand(i * 2.2) * TAU, s: 0.6 + seedRand(i * 5.5) * 1.4 }));
}

/* ================= the sky ================= */
function objects(t) {
  const list = [];
  for (let i = 0; i < GENS.length; i++) {
    const n = S.owned[i]; if (!n) continue;
    const vis = Math.min(n, CAPS[i]), rr = ringR(i), w = (0.32 / Math.sqrt(1 + i)) * (i % 2 ? -1 : 1), base = i * 1.7;
    for (let k = 0; k < vis; k++) {
      const a = base + t * w + (k / vis) * TAU + seedRand(i * 31 + k) * (0.9 / vis);
      const x = V.cx + Math.cos(a) * rr, y = V.cy + Math.sin(a) * rr * TILT, z = Math.sin(a);
      const dir = Math.atan2(Math.cos(a) * TILT * Math.sign(w), -Math.sin(a) * Math.sign(w));
      list.push({ i, k, x, y, z, dir });
    }
  }
  return list.sort((a, b) => a.z - b.z);
}
function drawCore(t, k) {
  const { cx, cy } = V, r = V.r0 * (1 + Math.sin(t * 1.7) * 0.02 + V.pulse * 0.08) * k;
  g.globalCompositeOperation = "lighter";
  glow(g, cx, cy, r * 3.6, "255,160,70", 0.5); glow(g, cx, cy, r * 2, "255,220,160", 0.7);
  for (let i = 0; i < 14; i++) {
    const a = t * 0.07 + (i / 14) * TAU, len = r * (1.5 + 0.28 * Math.sin(t * 1.3 + i * 1.7)), w = 0.07;
    g.fillStyle = "rgba(255,210,140,0.13)"; g.beginPath(); g.moveTo(cx + Math.cos(a - w) * r * 0.9, cy + Math.sin(a - w) * r * 0.9); g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.lineTo(cx + Math.cos(a + w) * r * 0.9, cy + Math.sin(a + w) * r * 0.9); g.fill();
  }
  g.globalCompositeOperation = "source-over";
  const gr = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.08, cx, cy, r);
  gr.addColorStop(0, "#fffef7"); gr.addColorStop(0.35, "#ffeab0"); gr.addColorStop(0.75, "#ffb44c"); gr.addColorStop(1, "#ff7b2c");
  g.fillStyle = gr; circle(g, cx, cy, r); g.fill();
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) { const a = t * (0.2 + i * 0.05) + i * 1.3, d = r * 0.45; glow(g, cx + Math.cos(a) * d, cy + Math.sin(a * 1.3) * d * 0.8, r * 0.45, "255,250,220", 0.18); }
  g.globalCompositeOperation = "source-over";
}
function cometPos(cm, u) { const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u; return [a * cm.x0 + b * cm.cx + c * cm.x1, a * cm.y0 + b * cm.cy + c * cm.y1]; }
function spawnComet() {
  const L = Math.random() < 0.5, top = V.y + 30;
  V.comet = { t: 0, stay: (14 + Math.random() * 4) * D.cometStay, x0: L ? V.x - 40 : V.x + V.w + 40, y0: top + Math.random() * V.h * 0.5, x1: L ? V.x + V.w + 40 : V.x - 40, y1: top + Math.random() * V.h * 0.75,
    cx: V.x + V.w * (0.3 + Math.random() * 0.4), cy: top + Math.random() * V.h * 0.45, trail: [] };
  sfx("comet");
}
function drawSky(dt) {
  const t = V.t;
  g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  g.drawImage(V.bg, 0, 0, V.W, V.H);
  for (const s of V.tw) { const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * s.s * 1.7 + s.p)); g.fillStyle = `rgba(255,255,255,${a * 0.8})`; g.fillRect(s.x, s.y, s.s, s.s); }
  let shake = 0;
  const novaK = V.novaT >= 0 ? V.novaT : -1;
  if (novaK >= 0 && novaK < 1.6) shake = novaK * 6;
  if (shake) g.translate(rnd(-shake, shake), rnd(-shake, shake));
  // orbits
  g.lineWidth = 1;
  for (let i = 0; i < GENS.length; i++) {
    if (!S.owned[i]) continue;
    const rr = ringR(i); g.strokeStyle = `rgba(${hslRgb(GENS[i].hue, 70, 75)},0.11)`; g.beginPath(); g.ellipse(V.cx, V.cy, rr, rr * TILT, 0, 0, TAU); g.stroke();
  }
  const objs = objects(t), sc = clamp(V.r0 / 60, 0.55, 1.4), coreK = novaK >= 0 ? (novaK < 1.6 ? 1 + novaK * 0.6 : novaK < 2.2 ? Math.max(0.05, 1 - (novaK - 1.6) * 1.6) : Math.min(1, (novaK - 2.2) * 0.8)) : 1;
  let coreDrawn = false;
  for (const o of objs) {
    if (!coreDrawn && o.z >= 0) { drawCore(t, coreK); coreDrawn = true; }
    const depth = 0.78 + 0.22 * (o.z + 1) / 2;
    g.globalAlpha = 0.55 + 0.45 * (o.z + 1) / 2;
    OBJ[o.i](g, o.x, o.y, SIZES[o.i] * sc * depth, t, o.k, o.dir);
    g.globalAlpha = 1;
  }
  if (!coreDrawn) drawCore(t, coreK);
  // first-time hint
  if (S.clicksAll < 8 && !S.owned[0] && V.novaT < 0) { g.textAlign = "center"; g.font = "800 16px Nunito, sans-serif"; g.fillStyle = `rgba(255,236,200,${0.55 + 0.4 * Math.sin(t * 3)})`; g.fillText("Click the star to forge stardust", V.cx, V.cy + V.r0 * 1.9 + 12); }
  // particles
  g.globalCompositeOperation = "lighter";
  for (const p of V.fx) { const a = p.life / p.max; g.fillStyle = `rgba(${p.rgb},${a})`; g.beginPath(); g.arc(p.x, p.y, p.s * (0.5 + a * 0.5), 0, TAU); g.fill(); }
  g.globalCompositeOperation = "source-over";
  // golden comet
  const cm = V.comet;
  if (cm) {
    const u = cm.t / cm.stay, [x, y] = cometPos(cm, u);
    cm.trail.unshift([x, y]); if (cm.trail.length > 26) cm.trail.pop();
    g.globalCompositeOperation = "lighter";
    for (let i = 1; i < cm.trail.length; i++) { const [px, py] = cm.trail[i], a = 1 - i / cm.trail.length; glow(g, px, py, 16 * a + 4, "255,200,90", 0.35 * a); }
    glow(g, x, y, 44, "255,210,110", 0.9); glow(g, x, y, 18, "255,250,220", 1);
    for (let i = 0; i < 4; i++) { const a = t * 3 + (i / 4) * TAU; g.strokeStyle = "rgba(255,240,200,0.6)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26); g.stroke(); }
    g.globalCompositeOperation = "source-over";
    cm.x = x; cm.y = y;
  }
  // floating numbers
  g.textAlign = "center";
  for (const f of V.texts) { const k = f.t / 1.1; g.globalAlpha = 1 - k * k; g.font = `900 ${f.crit ? 24 : 17}px Nunito, sans-serif`; g.fillStyle = f.crit ? "#ffd27a" : "#fff3dc"; g.fillText(f.s, f.x, f.y - k * 46); }
  g.globalAlpha = 1;
  // supernova shockwave
  if (novaK >= 1.6 && novaK < 3.4) { const k = (novaK - 1.6) / 1.8; g.strokeStyle = `rgba(255,240,220,${1 - k})`; g.lineWidth = 6 * (1 - k) + 1; circle(g, V.cx, V.cy, k * Math.max(V.w, V.h)); g.stroke(); }
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function burst(x, y, n, rgb, speed = 140, size = 2.2) {
  if (!S.settings.particles) return;
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = speed * (0.4 + Math.random() * 0.8); V.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.5, max: 1, rgb, s: size * (0.6 + Math.random() * 0.8) }); }
  if (V.fx.length > 500) V.fx.splice(0, V.fx.length - 500);
}

/* ================= icons ================= */
function genIcon(i, size = 64) {
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d");
  const s = size * [0.14, 0.13, 0.3, 0.32, 0.26, 0.12, 0.42, 0.14, 0.26, 0.38, 0.16, 0.36, 0.34, 0.36][i];
  OBJ[i](x, size / 2, size / 2, s, 1.3, 1, -0.6); return c;
}
const _upIcon = {};
function upIcon(u, size = 52) {
  const key = u.id; if (_upIcon[key]) return _upIcon[key].toDataURL ? _upIcon[key] : _upIcon[key];
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d"), m = size / 2;
  const frame = ["#c9b8ff", "#8ff0ff", "#8dffb8", "#ffd27a", "#ff8fc8", "#ffb347", "#ffffff", "#ffe9a8"];
  if (u.kind === "gen" || u.kind === "syn") {
    const i = u.kind === "gen" ? u.gen : u.b;
    OBJ[i](x, m, m, size * [0.13, 0.11, 0.25, 0.27, 0.21, 0.21, 0.36, 0.13, 0.21, 0.32, 0.15, 0.3, 0.28, 0.3][i], 1.3, 1, -0.6);
    x.strokeStyle = u.kind === "gen" ? frame[u.tier] : "#8ff0ff"; x.lineWidth = 2; x.globalAlpha = 0.85; x.beginPath(); x.arc(m, m, m - 2, 0, TAU); x.stroke(); x.globalAlpha = 1;
    if (u.kind === "gen") { x.fillStyle = frame[u.tier]; for (let k = 0; k <= u.tier; k++) { const a = -Math.PI / 2 + (k - u.tier / 2) * 0.32; x.beginPath(); x.arc(m + Math.cos(a) * (m - 2), m + Math.sin(a) * (m - 2), 2.4, 0, TAU); x.fill(); } }
  } else if (u.kind === "click") {
    x.globalCompositeOperation = "lighter"; glow(x, m, m, m * 0.9, "255,200,110", 0.8); x.globalCompositeOperation = "source-over";
    x.fillStyle = "#ffe9b0"; x.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? m * 0.25 : m * 0.6, a = -Math.PI / 2 + (k / 10) * TAU; x.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r); } x.closePath(); x.fill();
  } else if (u.kind === "chart") {
    const pts = [[0.25, 0.3], [0.45, 0.22], [0.62, 0.42], [0.78, 0.3], [0.55, 0.7], [0.3, 0.65]];
    x.strokeStyle = "rgba(200,190,255,0.7)"; x.lineWidth = 1.2; x.beginPath(); pts.forEach(([a, b], k) => (k ? x.lineTo(a * size, b * size) : x.moveTo(a * size, b * size))); x.stroke();
    x.globalCompositeOperation = "lighter"; for (const [a, b] of pts) glow(x, a * size, b * size, 6, "255,240,200", 1); x.globalCompositeOperation = "source-over";
  } else if (u.kind === "comet") {
    const gr = x.createLinearGradient(m * 0.3, m * 1.7, m * 1.3, m * 0.7); gr.addColorStop(0, "rgba(255,200,90,0)"); gr.addColorStop(1, "rgba(255,210,110,0.9)");
    x.strokeStyle = gr; x.lineWidth = 6; x.lineCap = "round"; x.beginPath(); x.moveTo(m * 0.35, m * 1.65); x.lineTo(m * 1.25, m * 0.75); x.stroke();
    x.globalCompositeOperation = "lighter"; glow(x, m * 1.25, m * 0.75, 14, "255,220,130", 1); x.globalCompositeOperation = "source-over";
  }
  return (_upIcon[key] = c);
}
const ACH_RGB = { tot: "255,210,122", cps: "143,240,255", clk: "255,143,200", clkd: "255,143,200", own: "141,255,184", bld: "201,184,255", cmt: "255,200,90", nova: "255,160,100", lvl: "255,160,100", upg: "201,184,255", tree: "255,240,200", away: "160,180,255", fast: "143,240,255", storm: "255,143,200", frugal: "141,255,184" };
function achIcon(a, got, size = 40) {
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d"), m = size / 2;
  const key = Object.keys(ACH_RGB).find((k) => a.id.startsWith(k)) || "tot", rgb = got ? ACH_RGB[key] : "110,100,150";
  if (got) { x.globalCompositeOperation = "lighter"; glow(x, m, m, m, rgb, 0.6); x.globalCompositeOperation = "source-over"; }
  x.fillStyle = `rgb(${rgb})`; x.beginPath();
  for (let k = 0; k < 10; k++) { const r = k % 2 ? m * 0.32 : m * 0.75, ang = -Math.PI / 2 + (k / 10) * TAU; x.lineTo(m + Math.cos(ang) * r, m + Math.sin(ang) * r); }
  x.closePath(); x.globalAlpha = got ? 1 : 0.5; x.fill(); return c;
}

/* ================= panel ================= */
const tipEl = document.createElement("div"); tipEl.className = "tip"; tipEl.hidden = true; document.body.appendChild(tipEl);
function showTip(html, x, y) { tipEl.innerHTML = html; tipEl.hidden = false; const w = tipEl.offsetWidth, h = tipEl.offsetHeight; tipEl.style.left = clamp(x - w - 14, 6, innerWidth - w - 6) + "px"; tipEl.style.top = clamp(y - h / 2, 6, innerHeight - h - 6) + "px"; }
function hideTip() { tipEl.hidden = true; }
pane.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse") return; const el = e.target.closest("[data-tip]"); if (!el) return hideTip(); showTip(tipFor(el), e.clientX, e.clientY); });
pane.addEventListener("pointerleave", hideTip);
function tipFor(el) {
  const k = el.dataset.tip;
  if (k.startsWith("gen")) {
    const i = +k.slice(3), d = GENS[i], each = genCps(i), tot = each * S.owned[i], share = D.cps > 0 ? (tot * buffMult("flare")) / D.cps : 0;
    return `<b>${d.name}</b><span>${d.desc}<br>Each makes ${fmtNum(each)}/s.${S.owned[i] ? `<br>Your ${S.owned[i]} make ${fmtNum(tot)}/s (${(share * 100).toFixed(1)}% of the total).` : ""}</span>`;
  }
  if (k.startsWith("ach")) { const a = ACH_IDX[k.slice(3)]; return `<b>${a.name}${S.ach[a.id] ? " ✓" : ""}</b><span>${a.desc}</span>`; }
  return "";
}
$("#tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; setTab(b.dataset.tab); });
function setTab(t) { V.tab = t; for (const b of $$("#tabs [data-tab]")) b.classList.toggle("on", b.dataset.tab === t); hideTip(); sfx("tab"); renderPane(true); pane.scrollTop = 0; }
function renderPane(force) {
  if (V.tab === "forges") paneForges(force);
  else if (V.tab === "upgrades") paneUpgrades(force);
  else if (V.tab === "nova") paneNova(force);
  else if (V.tab === "ach") paneAch(force);
  else if (V.tab === "stats") paneStats(force);
  else if (V.tab === "settings") { if (force) paneSettings(); }
}
function highestOwned() { let h = -1; S.owned.forEach((n, i) => { if (n > 0) h = i; }); return h; }
function buyCount(i) { const n = S.settings.buyN; return n === "max" ? Math.max(1, maxBuy(i)) : n; }
function paneForges(force) {
  const shown = Math.min(GENS.length - 1, Math.max(1, highestOwned() + 2));
  if (force || pane.dataset.view !== "forges" || +pane.dataset.shown !== shown) {
    pane.dataset.view = "forges"; pane.dataset.shown = shown;
    pane.innerHTML = `<div class="bar"><span class="muted">Buy</span><div class="seg" id="buyN">${[1, 10, 100, "max"].map((n) => `<button data-n="${n}" class="${S.settings.buyN === n ? "on" : ""}">${n === "max" ? "Max" : "×" + n}</button>`).join("")}</div></div>` +
      GENS.slice(0, shown + 1).map((d, i) => `<button class="gen" data-gen="${i}" data-tip="gen${i}"><canvas width="64" height="64"></canvas><span><span class="nm"></span><br><span class="co"></span> <span class="ea"></span></span><span class="own"></span></button>`).join("");
    $$(".gen canvas", pane).forEach((c, i) => c.getContext("2d").drawImage(genIcon(i), 0, 0));
  }
  const hi = highestOwned();
  $$(".gen", pane).forEach((el) => {
    const i = +el.dataset.gen, d = GENS[i], known = i <= hi + 1, n = buyCount(i), cost = genCost(i, n), can = S.dust >= cost && known;
    el.classList.toggle("hidden-gen", !known); el.classList.toggle("can", can);
    el.querySelector(".nm").textContent = known ? d.name + (n > 1 ? ` ×${n}` : "") : "???";
    const co = el.querySelector(".co"); co.textContent = "✦ " + fmtNum(cost); co.classList.toggle("no", !can);
    el.querySelector(".ea").textContent = known ? `· +${fmtNum(genCps(i) * n)}/s` : "";
    el.querySelector(".own").textContent = S.owned[i] || "";
  });
}
function paneUpgrades(force) {
  const list = availableUps(), sig = list.map((u) => u.id).join();
  if (force || pane.dataset.view !== "upgrades" || V.upSig !== sig) {
    pane.dataset.view = "upgrades"; V.upSig = sig;
    pane.innerHTML = list.length
      ? `<div class="bar"><span class="muted">${list.length} available</span><span class="sp"></span><button class="small" id="buyAll">Buy all I can afford</button></div>` +
        list.map((u) => `<button class="up" data-up="${u.id}"><canvas width="52" height="52"></canvas><span><span class="nm">${esc(u.name)}</span><br><span class="ds">${esc(u.desc)}</span></span><span class="co"></span></button>`).join("")
      : `<div class="empty">No upgrades right now.<br>New ones appear as your forges grow.</div>`;
    $$(".up canvas", pane).forEach((c, k) => c.getContext("2d").drawImage(upIcon(list[k]), 0, 0));
  }
  for (const el of $$(".up", pane)) { const u = UPG[el.dataset.up], c = upCost(u), can = S.dust >= c; el.classList.toggle("can", can); const co = el.querySelector(".co"); co.textContent = "✦ " + fmtNum(c); co.classList.toggle("no", !can); }
}
function paneNova(force) {
  const gain = novaGain(), nextNeed = allTimeFor(S.level + gain + 1) - S.allTime;
  if (force || pane.dataset.view !== "nova") {
    pane.dataset.view = "nova";
    pane.innerHTML = `<div class="card"><h3>Supernova</h3><p>Reset your stardust, forges and upgrades in exchange for <b class="gold">remnants</b>. Each remnant you have ever earned gives +4% stardust per second, forever. Spend them to light constellations.</p>
      <div class="kv" style="margin:.5em 0"><span>Remnants earned</span><span id="nvLevel"></span><span>Bonus</span><span id="nvBonus"></span><span>To spend</span><span id="nvRem" class="gold"></span><span>Supernova now</span><span id="nvGain"></span></div>
      <p id="nvNext" style="font-size:.9em"></p>
      <button class="primary" id="novaBtn" style="width:100%;margin-top:.3em"></button></div>
      <div class="card"><h3>Constellations</h3><div id="tree"></div><div id="nodeInfo" style="margin-top:.6em;min-height:4.2em"></div></div>`;
    buildTree();
  }
  $("#nvLevel").textContent = fmtNum(S.level); $("#nvBonus").textContent = "+" + fmtNum(S.level * 4) + "%"; $("#nvRem").textContent = fmtNum(S.remnants);
  $("#nvGain").innerHTML = gain >= 1 ? `<b class="gold">+${fmtNum(gain)}</b> remnants` : "nothing yet";
  $("#nvNext").textContent = `Forge ${fmtNum(Math.max(0, nextNeed))} more stardust (all time) for ${gain >= 1 ? "another" : "your first"} remnant.`;
  const b = $("#novaBtn"); b.disabled = gain < 1; b.textContent = gain >= 1 ? `Go supernova (+${fmtNum(gain)})` : "Not ready yet";
  for (const el of $$(".node", pane)) { const n = TREE_IDX[el.dataset.node]; el.classList.toggle("lit", !!S.tree[n.id]); el.classList.toggle("avail", !S.tree[n.id] && (!n.parent || !!S.tree[n.parent])); el.classList.toggle("sel", V.sel === n.id); }
  nodeInfo();
}
function buildTree() {
  const T = $("#tree");
  const lines = TREE.filter((n) => n.parent).map((n) => { const p = TREE_IDX[n.parent]; return `<line x1="${p.x}" y1="${p.y * 0.95 + 2.5}" x2="${n.x}" y2="${n.y * 0.95 + 2.5}" stroke="${S.tree[n.id] ? "rgba(255,210,122,.75)" : "rgba(170,150,255,.25)"}" stroke-width="${S.tree[n.id] ? 0.7 : 0.45}"/>`; }).join("");
  T.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>` + TREE.map((n) => `<button class="node" data-node="${n.id}" style="left:${n.x}%;top:${n.y * 0.95 + 2.5}%" aria-label="${esc(n.name)}">✦</button>`).join("");
}
function nodeInfo() {
  const el = $("#nodeInfo"); if (!el) return;
  const n = V.sel && TREE_IDX[V.sel];
  if (!n) { el.innerHTML = `<p class="muted" style="margin:0">Tap a star to read it. Light stars connected to ones you've already lit.</p>`; return; }
  const litNow = !!S.tree[n.id], open = !n.parent || !!S.tree[n.parent], can = !litNow && open && S.remnants >= n.cost;
  el.innerHTML = `<b class="gold">${esc(n.name)}</b> <span class="muted">· ${n.cost} remnant${n.cost > 1 ? "s" : ""}</span><p style="margin:.2em 0 .45em">${esc(n.desc)}</p>` +
    (litNow ? `<span class="green">Lit</span>` : open ? `<button class="${can ? "primary" : ""}" id="lightBtn" ${can ? "" : "disabled"}>${can ? "Light it" : `Need ${n.cost - S.remnants} more remnant${n.cost - S.remnants > 1 ? "s" : ""}`}</button>` : `<span class="muted">Light ${esc(TREE_IDX[n.parent].name)} first.</span>`);
}
function paneAch(force) {
  const n = Object.keys(S.ach).length;
  if (force || pane.dataset.view !== "ach" || +pane.dataset.n !== n) {
    pane.dataset.view = "ach"; pane.dataset.n = n;
    pane.innerHTML = `<div class="card"><h3>Feats · ${n} / ${ACHS.length}</h3><p>Every feat makes your Star Chart upgrades stronger.</p></div><div class="ach">${ACHS.map((a) => `<button class="badge2 ${S.ach[a.id] ? "got" : ""}" data-ach="${a.id}" data-tip="ach${a.id}" aria-label="${esc(a.name)}"></button>`).join("")}</div><div id="achInfo" class="card" style="min-height:3.5em"><p class="muted" style="margin:0">Tap a feat to read it.</p></div>`;
    for (const b of $$(".badge2", pane)) { const a = ACH_IDX[b.dataset.ach]; b.appendChild(achIcon(a, !!S.ach[a.id])); }
  }
}
function paneStats(force) {
  const rows = [
    ["Stardust", fmtNum(S.dust)], ["Forged this run", fmtNum(S.runTotal)], ["Forged all time", fmtNum(S.allTime)], ["Per second", fmtNum(D.baseCps)],
    ["Per click", fmtNum(D.click)], ["Forges owned", fmtNum(D.totalOwned)], ["Upgrades owned", fmtNum(D.upgCount)], ["Clicks this run", fmtNum(S.clicks)], ["Clicks all time", fmtNum(S.clicksAll)],
    ["Made by clicking", fmtNum(S.clickDust)], ["Golden comets caught", fmtNum(S.cometsAll)], ["Supernovas", fmtNum(S.novas)], ["Remnants earned", fmtNum(S.level)],
    ["This run", fmtTime(S.runTime)], ["Total play time", fmtTime(S.playTime)], ["Away earnings", Math.round(D.offline * 100) + "%, up to " + fmtTime(D.offCap)], ["Started", new Date(S.started).toLocaleDateString()],
  ];
  if (force || pane.dataset.view !== "stats") { pane.dataset.view = "stats"; pane.innerHTML = `<div class="card"><h3>Statistics</h3><div class="kv" id="statKv"></div></div>`; }
  $("#statKv").innerHTML = rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join("");
}
function paneSettings() {
  pane.dataset.view = "settings";
  const s = S.settings;
  pane.innerHTML = `<div class="card"><h3>Settings</h3>
    <div class="opt"><span>Numbers</span><select id="fmtSel"><option value="short">Short (1.23M)</option><option value="long">Words (1.23 million)</option><option value="sci">Scientific (1.23e6)</option></select></div>
    <label class="opt"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-set="music"></label>
    <label class="opt"><span>Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-set="sfx"></label>
    <div class="opt"><span>Particles</span><button class="small" data-tog="particles">${s.particles ? "On" : "Off"}</button></div>
    <div class="opt"><span>Bright flashes</span><button class="small" data-tog="flash">${s.flash ? "On" : "Off"}</button></div></div>
    <div class="card"><h3>Save</h3><p>The game saves itself every few seconds in this browser. Use a save code to back up or move your progress.</p>
      <textarea id="codeOut" readonly></textarea><div class="bar" style="margin:.4em 0"><button id="copyCode" class="primary">Copy my save code</button></div>
      <textarea id="codeIn" placeholder="Paste a STARFORGE-SAVE code here"></textarea><div class="bar" style="margin-top:.4em"><button id="loadCode">Load code</button><span class="sp"></span><button id="wipe" class="danger">Wipe save</button></div>
      <div class="msg" id="setMsg"></div></div>`;
  $("#fmtSel").value = s.fmt;
  $("#codeOut").value = toCode(serialize());
}
pane.addEventListener("input", (e) => { const r = e.target.closest("[data-set]"); if (r) { S.settings[r.dataset.set] = +r.value; applyVolumes(); } });
pane.addEventListener("change", (e) => { if (e.target.id === "fmtSel") { S.settings.fmt = e.target.value; persist(); } });
pane.addEventListener("click", (e) => {
  audio();
  const b = e.target.closest("button"); if (!b) return;
  if (b.closest("#buyN")) { const v = b.dataset.n; S.settings.buyN = v === "max" ? "max" : +v; sfx("tab"); renderPane(true); return; }
  if (b.dataset.gen !== undefined) {
    const i = +b.dataset.gen; if (i > highestOwned() + 1) return;
    const got = buyGen(i, S.settings.buyN === "max" ? "max" : S.settings.buyN);
    if (got) { sfx("buy"); const r = b.getBoundingClientRect(); floatText(r.left + 40, r.top + r.height / 2, "+" + got, false, true); } else sfx("deny");
    renderPane(false); return;
  }
  if (b.dataset.up) { if (buyUpgrade(b.dataset.up)) { sfx("upgrade"); toast("Upgrade bought", UPG[b.dataset.up].name); renderPane(true); } else sfx("deny"); return; }
  if (b.id === "buyAll") { let n = 0; for (const u of availableUps()) if (S.dust >= upCost(u)) { buyUpgrade(u.id); n++; } if (n) { sfx("upgrade"); toast(`Bought ${n} upgrade${n > 1 ? "s" : ""}`, ""); } else sfx("deny"); renderPane(true); return; }
  if (b.id === "novaBtn") return confirmNova();
  if (b.dataset.node) { V.sel = b.dataset.node; sfx("tab"); renderPane(false); return; }
  if (b.id === "lightBtn") { if (buyNode(V.sel)) { sfx("node"); toast("Constellation lit", TREE_IDX[V.sel].name); persist(); buildTree(); } else sfx("deny"); renderPane(false); return; }
  if (b.dataset.ach) { const a = ACH_IDX[b.dataset.ach], el = $("#achInfo"); el.innerHTML = `<b class="gold">${esc(a.name)}</b> ${S.ach[a.id] ? `<span class="green">✓</span>` : `<span class="muted">· not yet</span>`}<p style="margin:.2em 0 0">${esc(a.desc)}</p>`; return; }
  if (b.dataset.tog) { S.settings[b.dataset.tog] = !S.settings[b.dataset.tog]; b.textContent = S.settings[b.dataset.tog] ? "On" : "Off"; persist(); return; }
  if (b.id === "copyCode") { $("#codeOut").value = toCode(serialize()); copyText($("#codeOut").value, $("#setMsg")); return; }
  if (b.id === "loadCode") {
    const m = $("#setMsg");
    try {
      const json = fromCode($("#codeIn").value), next = deserialize(json);
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Replace my game?"; b.classList.add("danger"); m.textContent = `That save has ${fmtNum(next.allTime)} stardust forged all time.`; m.className = "msg"; return; }
      S = next; S.lastSave = Date.now(); recalc(); persist(); m.textContent = "Loaded."; m.className = "msg"; applyVolumes(); setTab("forges");
    } catch (err) { m.textContent = err.message; m.className = "msg err"; sfx("deny"); }
    return;
  }
  if (b.id === "wipe") {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Really wipe everything?"; return; }
    const keep = S.settings; S = freshState(); S.settings = keep; recalc(); persist(); setTab("forges"); toast("Fresh start", "Your save was wiped.");
  }
});

/* ================= toasts, modal, news ================= */
function toast(title, text, big) {
  const el = document.createElement("div"); el.className = "toast" + (big ? " big" : "");
  el.innerHTML = `<b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ""}`;
  toastsEl.appendChild(el); while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
  setTimeout(() => { el.style.transition = "opacity .5s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 520); }, big ? 5200 : 3200);
}
function modal(html) { modalEl.innerHTML = html; modalEl.hidden = false; const f = modalEl.querySelector("button"); if (f) f.focus(); }
function closeModal() { modalEl.hidden = true; modalEl.innerHTML = ""; }
modalEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-m]"); if (!b) { if (e.target === modalEl) closeModal(); return; }
  if (b.dataset.m === "close") closeModal();
  if (b.dataset.m === "nova") { closeModal(); doNova(); }
});
function confirmNova() {
  const gain = novaGain(); if (gain < 1) { sfx("deny"); return; }
  modal(`<div class="dialog"><h2>Go supernova?</h2><p>Your stardust, forges and upgrades will reset. You keep remnants, constellations, feats and statistics.</p>
    <div class="big gold">+${fmtNum(gain)} remnants</div><p>That's +${fmtNum(gain * 4)}% stardust per second, for good.</p>
    <div class="row"><button class="primary" data-m="nova">Supernova!</button><button data-m="close">Not yet</button></div></div>`);
}
function doNova() {
  V.novaT = 0; sfx("nova");
  setTimeout(() => { if (S.settings.flash) { const f = $("#flash"); f.style.transition = "none"; f.style.opacity = "0.95"; requestAnimationFrame(() => { f.style.transition = "opacity 1.4s"; f.style.opacity = "0"; }); } const gain = supernova(); V.comet = null; persist(); toast("Supernova!", `+${fmtNum(gain)} remnants. Light some constellations.`, true); renderPane(true); }, 1600);
}
function nextNews() {
  const hi = highestOwned(), pool = NEWS.filter(([lv]) => lv <= hi + 1);
  const line = pool[(Math.random() * pool.length) | 0][1];
  newsEl.style.opacity = "0"; setTimeout(() => { newsEl.textContent = line; newsEl.style.opacity = "1"; }, 600);
}
HOOK.ach = (a) => { toast("Feat: " + a.name, a.desc); sfx("ach"); if (V.tab === "ach") renderPane(false); };
HOOK.buff = () => { buildBuffs(); };
function buildBuffs() {
  $("#buffs").innerHTML = S.buffs.map((b) => `<div class="buff ${b.type}" data-b="${b.type}"><span>${b.type === "flare" ? "Stellar Flare ×7" : "Click Storm ×777"} · <span class="bt"></span></span><i></i></div>`).join("");
}
function updateBuffs() {
  for (const el of $$("#buffs .buff")) { const b = S.buffs.find((x) => x.type === el.dataset.b); if (!b) continue; el.querySelector(".bt").textContent = Math.ceil(b.left) + "s"; el.querySelector("i").style.width = (b.left / b.max) * 100 + "%"; }
}

/* ================= input ================= */
function floatText(x, y, s, crit, quiet) { V.texts.push({ x, y, s, t: 0, crit }); if (V.texts.length > 40) V.texts.shift(); }
function clickForge(px, py) {
  const { v, crit } = forgeClick(performance.now());
  V.pulse = 1; sfx(crit ? "crit" : "click");
  floatText(px + rnd(-12, 12), py - 10, "+" + fmtNum(v), crit);
  burst(px, py, crit ? 18 : 7, crit ? "255,210,122" : "255,230,180", crit ? 220 : 150);
}
function catchComet() {
  const cm = V.comet; if (!cm) return;
  V.comet = null; const r = cometReward(); sfx("catch");
  burst(cm.x, cm.y, 46, "255,210,110", 260, 2.6);
  toast(r.title, r.text, true);
  if (r.starfall) { const extra = Math.min(S.dust * 0.1, D.baseCps * 300) + 13; gain(extra); setTimeout(() => toast("Starfall!", "+" + fmtNum(extra) + " more stardust", true), 600); for (let i = 0; i < 6; i++) setTimeout(() => burst(V.cx + rnd(-V.R, V.R), V.cy + rnd(-V.R * 0.4, V.R * 0.4), 18, "255,220,140", 180), i * 120); }
  persist();
}
sky.addEventListener("pointerdown", (e) => {
  audio();
  const x = e.clientX, y = e.clientY;
  if (V.novaT >= 0 && V.novaT < 3.6) return;
  if (V.comet && Math.hypot(x - V.comet.x, y - V.comet.y) < 40) { catchComet(); return; }
  if (Math.hypot(x - V.cx, y - V.cy) < V.r0 * 1.35) clickForge(x, y);
});
sky.addEventListener("pointermove", (e) => { const over = Math.hypot(e.clientX - V.cx, e.clientY - V.cy) < V.r0 * 1.35 || (V.comet && Math.hypot(e.clientX - V.comet.x, e.clientY - V.comet.y) < 40); sky.style.cursor = over ? "pointer" : "default"; });
addEventListener("keydown", (e) => {
  audio();
  const tg = e.target; if (tg && (tg.tagName === "TEXTAREA" || tg.tagName === "INPUT" || tg.tagName === "SELECT")) return;
  if (!modalEl.hidden) { if (e.code === "Escape") closeModal(); return; }
  if ((e.code === "Space" || e.code === "KeyF") && !e.repeat && !(tg && tg.tagName === "BUTTON" && e.code === "Space")) { clickForge(V.cx, V.cy); e.preventDefault(); }
  else if (e.code === "KeyC" && V.comet) catchComet();
  const tabs = ["forges", "upgrades", "nova", "ach", "stats", "settings"], n = +e.key;
  if (n >= 1 && n <= 6 && !e.repeat) setTab(tabs[n - 1]);
});
let padPrev = {};
function pollPad() {
  const gps = navigator.getGamepads ? navigator.getGamepads() : []; let gp = null;
  for (const p of gps) if (p && p.connected) { gp = p; break; }
  if (!gp) return;
  const bt = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed), s = { a: bt(0), x: bt(2), lb: bt(4), rb: bt(5) };
  if (s.a && !padPrev.a) clickForge(V.cx, V.cy);
  if (s.x && !padPrev.x && V.comet) catchComet();
  const tabs = ["forges", "upgrades", "nova", "ach", "stats", "settings"], i = tabs.indexOf(V.tab);
  if (s.rb && !padPrev.rb) setTab(tabs[(i + 1) % tabs.length]);
  if (s.lb && !padPrev.lb) setTab(tabs[(i + tabs.length - 1) % tabs.length]);
  padPrev = s;
}

/* ================= saving ================= */
function persist() { store.set(SAVE_KEY, serialize()); }
addEventListener("beforeunload", persist);
document.addEventListener("visibilitychange", () => { if (document.hidden) { persist(); if (AU.ctx && AU.ctx.state === "running") AU.ctx.suspend().catch(() => {}); } else audio(); });

/* ================= main loop ================= */
let lastT = performance.now(), badgeT = 0;
function frame(now) {
  let dt = (now - lastT) / 1000; lastT = now; if (!(dt >= 0)) dt = 0;
  if (dt > 1) { let left = Math.min(dt, D.offCap); while (left > 0) { const s = left > 600 ? left : Math.min(1, left); tick(s); left -= s; } }
  else tick(dt);
  V.t += Math.min(dt, 0.1);
  pollPad();
  if (V.novaT >= 0) { V.novaT += Math.min(dt, 0.1); if (V.novaT > 4) V.novaT = -1; }
  if (S.cometT <= 0 && !V.comet && V.novaT < 0) { spawnComet(); S.cometT = cometInterval(); }
  if (V.comet) { V.comet.t += Math.min(dt, 0.1); if (V.comet.t >= V.comet.stay) V.comet = null; }
  V.pulse = Math.max(0, V.pulse - dt * 5);
  for (const p of V.fx) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 2.2; p.vy *= 1 - dt * 2.2; }
  V.fx = V.fx.filter((p) => p.life > 0);
  for (const f of V.texts) f.t += dt;
  V.texts = V.texts.filter((f) => f.t < 1.1);
  drawSky(dt);
  // HUD
  const dustEl = $("#dust");
  dustEl.firstChild.nodeValue = fmtNum(S.dust);
  $("#persec").firstChild.textContent = fmtNum(D.cps);
  updateBuffs();
  V.paneT -= dt; if (V.paneT <= 0) { V.paneT = 0.2; renderPane(false); }
  badgeT -= dt;
  if (badgeT <= 0) {
    badgeT = 0.5;
    const n = availableUps().filter((u) => S.dust >= upCost(u)).length, tb = $('[data-tab="upgrades"]');
    let bd = tb.querySelector(".badge"); if (n && !bd) { bd = document.createElement("span"); bd.className = "badge"; tb.appendChild(bd); } if (bd) { if (n) bd.textContent = n; else bd.remove(); }
    const nb = $('[data-tab="nova"]'); nb.classList.toggle("gold", novaGain() >= Math.max(1, Math.ceil(S.level * 0.25)) && S.level + novaGain() >= 1);
  }
  V.newsT -= dt; if (V.newsT <= 0) { V.newsT = 14; nextNews(); }
  V.saveT += dt; if (V.saveT > 10) { V.saveT = 0; persist(); }
  requestAnimationFrame(frame);
}

/* ================= boot ================= */
(function boot() {
  try { const raw = store.get(SAVE_KEY); if (raw) S = deserialize(raw); } catch { S = freshState(); }
  recalc();
  const off = applyOffline();
  recalc(); checkAch();
  layout(); buildBuffs(); renderPane(true);
  if (off && off.away >= 60) {
    modal(`<div class="dialog"><h2>Welcome back</h2><p>You were away for ${fmtTime(off.away)}.${off.capped ? ` Only the first ${fmtTime(off.secs)} counted.` : ""}</p>
      <div class="big gold">+${fmtNum(off.v)}</div><p>stardust forged while you were gone (${Math.round(D.offline * 100)}% speed).</p>
      <div class="row"><button class="primary" data-m="close">Collect</button></div></div>`);
  }
  persist();
  requestAnimationFrame(frame);
})();
