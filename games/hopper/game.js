"use strict";
/* HOPPER — hop across endless roads, rivers and rails. */
const { $, $$, clamp, lerp, TAU } = K;
const COLS = 13, MINC = 1, MAXC = 11, HOP_T = 0.13;
const CRITTERS = [
  { id: "pip", name: "Pip", price: 0, body: "#ffd23f", ears: "bunny", belly: "#fff3b0" }, { id: "mochi", name: "Mochi", price: 40, body: "#ffd6e5", ears: "round", belly: "#fff" },
  { id: "kero", name: "Kero", price: 60, body: "#6fcf5b", ears: "frog", belly: "#d8f5b0" }, { id: "tabby", name: "Tabby", price: 80, body: "#ff9a3c", ears: "cat", belly: "#ffe1b8" },
  { id: "bolt", name: "Bolt", price: 100, body: "#9aa7b8", ears: "antenna", belly: "#d6e2ef" }, { id: "boo", name: "Boo", price: 120, body: "#f4f6ff", ears: "ghost", belly: "#fff" },
  { id: "waddle", name: "Waddle", price: 150, body: "#2c2f3a", ears: "none", belly: "#fff", beak: true }, { id: "bao", name: "Bao", price: 200, body: "#ffffff", ears: "panda", belly: "#fff" },
  { id: "ember", name: "Ember", price: 250, body: "#e8473d", ears: "horns", belly: "#ffc1a8" }, { id: "nova", name: "Nova", price: 400, body: "#ffcf3f", ears: "star", belly: "#fff6c2" },
];
const SAVE = K.load("hopper.v1", { best: 0, coins: 0, owned: ["pip"], pick: "pip", daily: { date: "", best: 0 }, games: 0 });
const persist = () => K.save("hopper.v1", SAVE);

/* ================= world ================= */
let G = null;
function newGame(daily) {
  G = { daily, rng: daily ? K.RNG(K.dailySeed("hopper")) : K.RNG((Math.random() * 1e9) | 0), lanes: new Map(), gen: 0, t: 0, p: { c: 6, r: 0, x: 6, fx: 6, fr: 0, hop: 1, face: 0, dead: null, deadT: 0, idle: 0, log: null, bump: 0 }, score: 0, coins: 0, fog: -4, fogOn: false, cam: 0, over: false, queue: [], parts: [], pops: [], shake: 0 };
  SAVE.games++; persist();
  for (let r = -6; r <= 4; r++) G.lanes.set(r, grass(r, r <= 1));
  G.gen = 5; ensure(30);
  K.ui.hide(); $("#pauseBtn").hidden = false; layout(); K.playSong("hop", 2);
}
function grass(r, empty) {
  const rng = G.rng, blocks = new Set([0, 12]), d = clamp(r / 160, 0, 1);
  if (!empty) { const n = 1 + ((rng() * (2 + d * 3)) | 0); for (let k = 0; k < n; k++) { const c = MINC + ((rng() * (MAXC - MINC + 1)) | 0); if (c !== 6 || r > 8) blocks.add(c); } }
  const deco = []; for (const c of blocks) deco.push({ c, kind: rng() < 0.75 ? "tree" : "rock", s: 0.8 + rng() * 0.3 });
  const coin = !empty && rng() < 0.18 ? (() => { const free = []; for (let c = MINC; c <= MAXC; c++) if (!blocks.has(c)) free.push(c); return free[(rng() * free.length) | 0]; })() : null;
  return { type: "grass", r, blocks, deco, coin, shade: r % 2 };
}
function road(r, d) {
  const rng = G.rng, dir = rng() < 0.5 ? -1 : 1, speed = (1.6 + rng() * 1.6 + d * 2.6) * (rng() < 0.15 ? 1.5 : 1), truck = rng() < 0.3 + d * 0.2;
  const len = truck ? (rng() < 0.4 ? 3 : 2) : 1, n = clamp(Math.round(2 + d * 1.5 + rng() * 1.2 - (len - 1) * 0.6), 1, 4), span = COLS + 6, gap = span / n;
  const objs = []; for (let k = 0; k < n; k++) objs.push({ x0: k * gap + rng() * gap * 0.4, len, col: ["#e8473d", "#3d8be8", "#f2b632", "#7b5be8", "#2fb37a", "#ff7a3d", "#ecf0f5"][(rng() * 7) | 0] });
  const coin = rng() < 0.12 ? MINC + ((rng() * 11) | 0) : null;
  return { type: "road", r, dir, speed, objs, span, coin, truck, horn: 0 };
}
function river(r, d) {
  const rng = G.rng;
  if (rng() < 0.22 - d * 0.1) {
    const pads = new Set(), prev = G.lanes.get(r - 1);
    if (prev && prev.pads) { const pv = [...prev.pads]; pads.add(pv[(rng() * pv.length) | 0]); pads.add(pv[(rng() * pv.length) | 0]); } // keep a way across stacked pad lanes
    while (pads.size < 4) pads.add(MINC + ((rng() * 11) | 0));
    return { type: "river", r, pads, dir: 0, speed: 0, objs: [], span: COLS + 6 };
  }
  const dir = rng() < 0.5 ? -1 : 1, speed = 1.0 + rng() * 1.2 + d * 1.4, len = 2 + ((rng() * (d > 0.5 ? 2 : 3)) | 0), n = clamp(Math.round(3.4 - d * 1.2 + rng()), 2, 4), span = COLS + 6, gap = span / n;
  const objs = []; for (let k = 0; k < n; k++) objs.push({ x0: k * gap + rng() * Math.max(0, gap - len - 1) * 0.5, len, col: "#9c6a3c" });
  return { type: "river", r, dir, speed, objs, span, pads: null };
}
function rail(r, d) { const rng = G.rng; return { type: "rail", r, dir: rng() < 0.5 ? -1 : 1, next: 2 + rng() * 5, train: null, warn: 0, period: Math.max(3, 7 - d * 3) }; }
function ensure(upto) {
  while (G.gen <= upto) {
    const rng = G.rng, d = clamp(G.gen / 160, 0, 1), roll = rng();
    let type = roll < 0.45 ? "road" : roll < 0.75 ? "river" : roll < 0.88 + d * 0.04 ? "rail" : "grass";
    if (G.gen < 8 && type === "rail") type = "road";
    const n = type === "road" ? 1 + ((rng() * (2 + d * 3)) | 0) : type === "river" ? 1 + ((rng() * (1 + d * 2.4)) | 0) : type === "rail" ? 1 + (rng() < 0.3 ? 1 : 0) : 1 + ((rng() * 2) | 0);
    for (let k = 0; k < n; k++) { const r = G.gen++; G.lanes.set(r, type === "road" ? road(r, d) : type === "river" ? river(r, d) : type === "rail" ? rail(r, d) : grass(r)); }
    for (let k = 0; k < 1 + (rng() < 0.3 ? 1 : 0); k++) { const r = G.gen++; G.lanes.set(r, grass(r)); }
  }
  for (const r of G.lanes.keys()) if (r < G.p.r - 20) G.lanes.delete(r);
}
const lane = (r) => G.lanes.get(r);
/* moving object positions (wrap-around strip) */
function objX(L, o) { const s = L.span, raw = o.x0 + L.dir * L.speed * G.t; return ((raw % s) + s) % s - 3; }
function onObject(L, x) {
  if (L.pads) return L.pads.has(Math.round(x)) ? { pad: true } : null;
  const cx = x + 0.5; for (const o of L.objs) { const ox = objX(L, o); if (cx > ox + 0.05 && cx < ox + o.len - 0.05) return o; }
  return null;
}

/* ================= player ================= */
function tryHop(dc, dr) {
  const p = G.p; if (!G || G.over || p.dead) return;
  if (p.hop < 1) { if (G.queue.length < 2) G.queue.push([dc, dr]); return; }
  const tc = dr ? Math.round(p.x) + dc : Math.round(p.x) + dc, tr = p.r + dr;
  p.face = dc < 0 ? 3 : dc > 0 ? 1 : dr < 0 ? 2 : 0;
  if (tc < MINC || tc > MAXC || tr < G.fog - 1) { p.bump = 0.15; K.sfx("bump"); return; }
  const L = lane(tr); if (L && L.type === "grass" && L.blocks.has(tc)) { p.bump = 0.15; K.sfx("bump"); return; }
  p.from = { x: p.x, r: p.r }; p.c = tc; p.r = tr; p.hop = 0; p.log = null; p.idle = 0; G.fogOn = true;
  K.sfx("hop");
}
function land() {
  const p = G.p, L = lane(p.r); p.x = p.c;
  if (p.r > G.score) { G.score = p.r; }
  if (!L) return;
  if (L.type === "river") { const o = onObject(L, p.x); if (!o) return die("splash"); if (!o.pad) { p.log = o; p.logOff = p.x - objX(L, o); } else p.log = null; K.sfx(o.pad ? "pad" : "log"); }
  if (L.coin !== null && L.coin !== undefined && Math.round(p.x) === L.coin) { L.coin = null; G.coins++; SAVE.coins++; K.sfx("coin"); pop(p.x, p.r, "+1", "#e0a800"); burst(p.x, p.r, "255,210,63", 10); }
}
function die(kind) {
  const p = G.p; if (p.dead) return; p.dead = kind; p.deadT = 0; G.shake = kind === "fog" ? 0.2 : 0.4; K.vibrate(120);
  K.sfx(kind === "splash" ? "splash" : kind === "fog" ? "fogdie" : "squash");
  if (kind === "splash") burst(p.x, p.r, "120,200,255", 22); else burst(p.x, p.r, "255,255,255", 14);
  G.over = true; const best = G.daily ? (SAVE.daily.date === K.today() ? SAVE.daily.best : 0) : SAVE.best; G.pb = G.score > best;
  if (G.daily) SAVE.daily = { date: K.today(), best: Math.max(best, G.score) }; else SAVE.best = Math.max(SAVE.best, G.score);
  persist(); K.musicLevel(0);
  const g = G; setTimeout(() => { if (G === g) results(); }, 1200);
}
function update(dt) {
  if (!G) return;
  G.t += dt; const p = G.p;
  if (G.over) { p.deadT += dt; updateParts(dt); return; }
  ensure(p.r + 30);
  // hop animation
  if (p.hop < 1) { p.hop = Math.min(1, p.hop + dt / HOP_T); if (p.hop >= 1) { land(); if (G.queue.length && !p.dead) { const [dc, dr] = G.queue.shift(); tryHop(dc, dr); } } }
  p.bump = Math.max(0, p.bump - dt); p.idle += dt;
  // riding a log
  const L = lane(p.r);
  if (p.hop >= 1 && L && L.type === "river" && p.log) { p.x = objX(L, p.log) + p.logOff; if (p.x < MINC - 0.6 || p.x > MAXC + 0.6) return die("splash"); }
  // visual position
  if (p.hop < 1) { const k = K.ease.outQuad(p.hop); p.fx = lerp(p.from.x, p.c, k); p.fr = lerp(p.from.r, p.r, k); } else { p.fx = p.x; p.fr = p.r; }
  // traffic + trains
  for (let r = p.r - 2; r <= p.r + 20; r++) { const l = lane(r); if (!l) continue; if (l.type === "rail") railStep(l, dt); }
  const here = lane(Math.round(p.fr));
  if (here && (p.hop > 0.6 || p.hop >= 1)) {
    if (here.type === "road") for (const o of here.objs) { const ox = objX(here, o); if (p.fx + 0.78 > ox + 0.1 && p.fx + 0.22 < ox + o.len - 0.1) return die("squash"); }
    if (here.type === "rail" && here.train) { const tx = here.train.x; if (p.fx + 0.7 > tx && p.fx + 0.3 < tx + here.train.len) return die("squash"); }
  }
  // horns for near misses
  if (here && here.type === "road" && G.rng() < dt * 0.6) for (const o of here.objs) { const ox = objX(here, o); if (Math.abs(ox + o.len / 2 - p.fx) < 2.2) { K.sfx("horn"); break; } }
  // fog
  if (G.fogOn) { const sp = Math.min(1.15, 0.38 + G.score * 0.0045) * (p.idle > 5 ? 2.6 : 1); G.fog += sp * dt; G.fog = Math.max(G.fog, p.r - 9); if (G.fog > p.fr + 0.35) return die("fog"); }
  // camera
  G.cam = lerp(G.cam, Math.max(p.fr, G.cam - 0.5), Math.min(1, dt * 6));
  updateParts(dt);
}
function railStep(l, dt) {
  if (l.train) { l.train.x += l.dir * 30 * dt; if ((l.dir > 0 && l.train.x > COLS + 4) || (l.dir < 0 && l.train.x + l.train.len < -4)) { l.train = null; l.next = l.period * (0.6 + G.rng() * 0.8); } return; }
  l.next -= dt; if (l.next < 1.3 && !l.warned) { l.warned = true; if (Math.abs(l.r - G.p.r) < 9) K.sfx("bell"); }
  if (l.next <= 0) { l.warned = false; const len = 16; l.train = { x: l.dir > 0 ? -len - 2 : COLS + 2, len }; if (Math.abs(l.r - G.p.r) < 7) K.sfx("train"); }
}
function updateParts(dt) { for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 9 * dt; q.t -= dt; } G.parts = G.parts.filter((q) => q.t > 0); for (const q of G.pops) q.t += dt; G.pops = G.pops.filter((q) => q.t < 0.9); G.shake = Math.max(0, G.shake - dt); }
function burst(x, r, rgb, n) { for (let k = 0; k < n; k++) { const a = Math.random() * TAU, s = 2 + Math.random() * 4; G.parts.push({ x: x + 0.5, y: r + 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, t: 0.4 + Math.random() * 0.5, c: rgb }); } }
function pop(x, r, text, col) { G.pops.push({ x: x + 0.5, r, text, col, t: 0 }); }

/* ================= render ================= */
const cv = $("#cv"), ctx = cv.getContext("2d");
const V = { W: 0, H: 0, dpr: 1, T: 60, ox: 0, base: 0 };
function layout() { V.W = innerWidth; V.H = innerHeight; V.dpr = K.fit(cv, V.W, V.H).dpr; V.T = Math.floor(Math.min(V.W / 11.4, V.H / 8.2)); V.ox = Math.round(V.W / 2 - 6.5 * V.T); V.base = Math.round(V.H * 0.72); SPR.clear(); }
addEventListener("resize", layout);
const sx = (x) => V.ox + x * V.T, sy = (r) => V.base - (r - (G ? G.cam : 0)) * V.T;
function critterSprite(id, size) {
  const key = id + "@" + size; if (SPR.has(key)) return SPR.get(key);
  const C = CRITTERS.find((c) => c.id === id) || CRITTERS[0], c = document.createElement("canvas"); c.width = c.height = Math.ceil(size * V.dpr); const g = c.getContext("2d"); g.scale(V.dpr, V.dpr);
  drawCritter(g, C, size); SPR.set(key, c); return c;
}
function drawCritter(g, C, s) {
  const cx = s / 2, cy = s * 0.56, r = s * 0.32, dk = shade(C.body, -0.25);
  g.lineJoin = "round";
  // ears / features behind the body
  g.fillStyle = C.body; g.strokeStyle = dk; g.lineWidth = s * 0.035;
  if (C.ears === "bunny") for (const d of [-1, 1]) { g.beginPath(); g.ellipse(cx + d * r * 0.45, cy - r * 1.15, r * 0.22, r * 0.55, d * 0.2, 0, TAU); g.fill(); g.stroke(); g.fillStyle = "#ffb3c8"; g.beginPath(); g.ellipse(cx + d * r * 0.45, cy - r * 1.12, r * 0.1, r * 0.38, d * 0.2, 0, TAU); g.fill(); g.fillStyle = C.body; }
  if (C.ears === "cat") for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * r * 0.85, cy - r * 0.4); g.lineTo(cx + d * r * 0.65, cy - r * 1.25); g.lineTo(cx + d * r * 0.15, cy - r * 0.8); g.closePath(); g.fill(); g.stroke(); }
  if (C.ears === "round" || C.ears === "panda") for (const d of [-1, 1]) { g.fillStyle = C.ears === "panda" ? "#2c2f3a" : C.body; g.beginPath(); g.arc(cx + d * r * 0.72, cy - r * 0.78, r * 0.32, 0, TAU); g.fill(); g.stroke(); }
  if (C.ears === "antenna") { g.strokeStyle = "#5c6878"; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx, cy - r * 1.5); g.stroke(); g.fillStyle = "#ff4d5e"; g.beginPath(); g.arc(cx, cy - r * 1.55, r * 0.14, 0, TAU); g.fill(); g.strokeStyle = dk; }
  if (C.ears === "horns") for (const d of [-1, 1]) { g.fillStyle = "#ffe0a8"; g.beginPath(); g.moveTo(cx + d * r * 0.5, cy - r * 0.85); g.lineTo(cx + d * r * 0.7, cy - r * 1.35); g.lineTo(cx + d * r * 0.25, cy - r * 0.95); g.closePath(); g.fill(); }
  if (C.ears === "star") { g.fillStyle = "#fff6c2"; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.16 : r * 0.38; g.lineTo(cx + Math.cos(a) * rr, cy - r * 1.35 + Math.sin(a) * rr); } g.fill(); g.strokeStyle = "#e0a800"; g.lineWidth = s * 0.02; g.stroke(); g.strokeStyle = dk; g.lineWidth = s * 0.035; }
  // body
  g.fillStyle = C.body; g.beginPath();
  if (C.ears === "ghost") { g.moveTo(cx - r, cy + r * 0.6); g.arc(cx, cy - r * 0.1, r, Math.PI, 0); g.lineTo(cx + r, cy + r * 0.6); for (let k = 0; k < 4; k++) g.quadraticCurveTo(cx + r - (k + 0.5) * r * 0.5, cy + r * (k % 2 ? 0.6 : 1.0), cx + r - (k + 1) * r * 0.5, cy + r * 0.6); g.closePath(); }
  else if (C.ears === "antenna") K.roundRect(g, cx - r, cy - r, r * 2, r * 1.9, r * 0.45);
  else g.ellipse(cx, cy, r, r * 0.95, 0, 0, TAU);
  g.fill(); g.stroke();
  g.fillStyle = C.belly; g.beginPath(); g.ellipse(cx, cy + r * 0.35, r * 0.55, r * 0.45, 0, 0, TAU); g.fill();
  // face
  if (C.ears === "panda") { g.fillStyle = "#2c2f3a"; for (const d of [-1, 1]) { g.beginPath(); g.ellipse(cx + d * r * 0.38, cy - r * 0.12, r * 0.24, r * 0.3, d * 0.4, 0, TAU); g.fill(); } }
  if (C.ears === "antenna") { g.fillStyle = "#2c3e56"; K.roundRect(g, cx - r * 0.7, cy - r * 0.45, r * 1.4, r * 0.55, r * 0.2); g.fill(); g.fillStyle = "#5ff0ff"; for (const d of [-1, 1]) { g.beginPath(); g.arc(cx + d * r * 0.32, cy - r * 0.18, r * 0.12, 0, TAU); g.fill(); } }
  else {
    const ey = C.ears === "frog" ? cy - r * 0.62 : cy - r * 0.15;
    for (const d of [-1, 1]) { if (C.ears === "frog") { g.fillStyle = C.body; g.beginPath(); g.arc(cx + d * r * 0.42, ey, r * 0.3, 0, TAU); g.fill(); g.stroke(); } g.fillStyle = "#fff"; g.beginPath(); g.arc(cx + d * r * 0.38, ey, r * 0.2, 0, TAU); g.fill(); g.fillStyle = C.ears === "panda" || C.id === "waddle" ? "#fff" : "#2a1d12"; g.fillStyle = "#2a1d12"; g.beginPath(); g.arc(cx + d * r * 0.4, ey + r * 0.03, r * 0.11, 0, TAU); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(cx + d * r * 0.36, ey - r * 0.04, r * 0.04, 0, TAU); g.fill(); }
    g.fillStyle = "rgba(255,120,150,0.45)"; for (const d of [-1, 1]) { g.beginPath(); g.ellipse(cx + d * r * 0.62, cy + r * 0.12, r * 0.15, r * 0.09, 0, 0, TAU); g.fill(); }
    if (C.beak) { g.fillStyle = "#ff9a3c"; g.beginPath(); g.moveTo(cx - r * 0.16, cy + r * 0.05); g.lineTo(cx + r * 0.16, cy + r * 0.05); g.lineTo(cx, cy + r * 0.3); g.closePath(); g.fill(); }
    else { g.strokeStyle = "#2a1d12"; g.lineWidth = s * 0.025; g.beginPath(); if (C.ears === "frog") g.arc(cx, cy + r * 0.0, r * 0.35, 0.2 * Math.PI, 0.8 * Math.PI); else { g.arc(cx - r * 0.08, cy + r * 0.12, r * 0.08, 0, Math.PI); g.arc(cx + r * 0.08, cy + r * 0.12, r * 0.08, 0, Math.PI); } g.stroke(); }
    if (C.id === "tabby") { g.strokeStyle = shade(C.body, -0.3); g.lineWidth = s * 0.03; for (const d of [-1, 0, 1]) { g.beginPath(); g.moveTo(cx + d * r * 0.25, cy - r * 0.95); g.lineTo(cx + d * r * 0.2, cy - r * 0.65); g.stroke(); } }
  }
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (v) => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255); return `rgb(${f(r)},${f(g)},${f(b)})`; }
const SPR = new Map();
function drawLane(L, y) {
  const T = V.T, x0 = sx(0), w = COLS * T;
  if (L.type === "grass") {
    ctx.fillStyle = L.shade ? "#8fd16a" : "#86c862"; ctx.fillRect(0, y, V.W, T + 1);
    ctx.fillStyle = "rgba(255,255,255,0.08)"; for (let c = 0; c < COLS; c += 2) ctx.fillRect(sx(c + ((L.r * 3) % 2) * 0.3) + T * 0.2, y + T * 0.3, T * 0.08, T * 0.18);
  } else if (L.type === "road") {
    ctx.fillStyle = "#4b5160"; ctx.fillRect(0, y, V.W, T + 1); const above = lane(L.r + 1);
    if (above && above.type === "road") { ctx.fillStyle = "rgba(255,255,255,0.55)"; for (let c = -1; c < COLS + 1; c++) ctx.fillRect(sx(c) + T * 0.25, y - 1, T * 0.5, Math.max(2, T * 0.05)); }
    ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(0, y + T - 3, V.W, 3);
  } else if (L.type === "river") {
    ctx.fillStyle = "#3aa8e8"; ctx.fillRect(0, y, V.W, T + 1);
    ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = Math.max(1.5, T * 0.04); ctx.beginPath(); for (let c = -1; c < COLS + 2; c += 1.5) { const xx = sx(c + ((G.t * 0.4 * (L.dir || 0.3) + L.r * 0.37) % 1.5)), yy = y + T * (0.3 + ((L.r * 7 + c * 3) % 5) * 0.1); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + T * 0.15, yy - T * 0.06, xx + T * 0.3, yy); } ctx.stroke();
  } else if (L.type === "rail") {
    ctx.fillStyle = "#9a8c78"; ctx.fillRect(0, y, V.W, T + 1); ctx.fillStyle = "#6b5640"; for (let c = -1; c < COLS + 2; c += 0.5) ctx.fillRect(sx(c), y + T * 0.15, T * 0.16, T * 0.7);
    ctx.fillStyle = "#c9ced8"; ctx.fillRect(0, y + T * 0.28, V.W, T * 0.07); ctx.fillRect(0, y + T * 0.65, V.W, T * 0.07);
  }
}
function drawObjects(L, y) {
  const T = V.T;
  if (L.type === "grass") {
    for (const d of L.deco) { const cx = sx(d.c) + T / 2, cy = y + T / 2; if (d.kind === "tree") { ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(cx + T * 0.08, cy + T * 0.2, T * 0.4 * d.s, T * 0.2, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#7a4e2a"; ctx.fillRect(cx - T * 0.07, cy - T * 0.05, T * 0.14, T * 0.3); ctx.fillStyle = "#2f8f3a"; ctx.beginPath(); ctx.arc(cx, cy - T * 0.18, T * 0.36 * d.s, 0, TAU); ctx.fill(); ctx.fillStyle = "#47ad4b"; ctx.beginPath(); ctx.arc(cx - T * 0.08, cy - T * 0.28, T * 0.22 * d.s, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.beginPath(); ctx.ellipse(cx + T * 0.06, cy + T * 0.18, T * 0.32, T * 0.14, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#9aa1ab"; ctx.beginPath(); ctx.ellipse(cx, cy + T * 0.02, T * 0.32 * d.s, T * 0.26 * d.s, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#c3c9d1"; ctx.beginPath(); ctx.ellipse(cx - T * 0.08, cy - T * 0.06, T * 0.14, T * 0.1, 0, 0, TAU); ctx.fill(); } }
  }
  if (L.type === "river" && L.pads) for (const c of L.pads) { const cx = sx(c) + T / 2, cy = y + T / 2; ctx.fillStyle = "#3fae4a"; ctx.beginPath(); ctx.arc(cx, cy, T * 0.4, 0.3, TAU - 0.3); ctx.lineTo(cx, cy); ctx.fill(); ctx.fillStyle = "#62c96a"; ctx.beginPath(); ctx.arc(cx - T * 0.05, cy - T * 0.05, T * 0.22, 0, TAU); ctx.fill(); }
  if (L.objs) for (const o of L.objs) {
    const ox = sx(objX(L, o)), w = o.len * T;
    if (L.type === "river") { ctx.fillStyle = "rgba(0,0,0,0.15)"; K.roundRect(ctx, ox + T * 0.08, y + T * 0.24, w - T * 0.1, T * 0.66, T * 0.3); ctx.fill(); ctx.fillStyle = "#9c6a3c"; K.roundRect(ctx, ox + T * 0.04, y + T * 0.16, w - T * 0.08, T * 0.66, T * 0.3); ctx.fill(); ctx.fillStyle = "#b9824f"; ctx.fillRect(ox + T * 0.2, y + T * 0.28, w - T * 0.4, T * 0.08); ctx.fillStyle = "#d9a874"; ctx.beginPath(); ctx.ellipse(ox + (L.dir > 0 ? w - T * 0.12 : T * 0.12), y + T * 0.49, T * 0.1, T * 0.28, 0, 0, TAU); ctx.fill(); }
    else if (L.type === "road") {
      const face = L.dir; ctx.fillStyle = "rgba(0,0,0,0.25)"; K.roundRect(ctx, ox + T * 0.1, y + T * 0.28, w - T * 0.12, T * 0.62, T * 0.18); ctx.fill();
      ctx.fillStyle = o.col; K.roundRect(ctx, ox + T * 0.06, y + T * 0.16, w - T * 0.12, T * 0.64, T * 0.18); ctx.fill();
      if (o.len > 1) { ctx.fillStyle = shade(o.col, -0.25); const cab = face > 0 ? ox + w - T * 0.86 : ox + T * 0.06; K.roundRect(ctx, cab, y + T * 0.16, T * 0.8, T * 0.64, T * 0.16); ctx.fill(); ctx.fillStyle = "#cfe8ff"; ctx.fillRect(face > 0 ? cab + T * 0.5 : cab + T * 0.1, y + T * 0.24, T * 0.2, T * 0.48); ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(face > 0 ? ox + T * 0.2 : ox + T * 1.0, y + T * 0.26, w - T * 1.3, T * 0.1); }
      else { ctx.fillStyle = "#cfe8ff"; ctx.fillRect(ox + T * (face > 0 ? 0.58 : 0.2), y + T * 0.24, T * 0.2, T * 0.48); ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(ox + T * 0.36, y + T * 0.24, T * 0.26, T * 0.48); }
      ctx.fillStyle = "#fff6b0"; const hx = face > 0 ? ox + w - T * 0.12 : ox + T * 0.06; ctx.fillRect(hx, y + T * 0.2, T * 0.06, T * 0.12); ctx.fillRect(hx, y + T * 0.64, T * 0.06, T * 0.12);
    }
  }
  if (L.type === "rail") {
    const lit = !L.train && L.next < 1.3, blink = lit && Math.floor(G.t * 6) % 2; const px = sx(L.dir > 0 ? 0.3 : COLS - 1.3);
    ctx.fillStyle = "#3a3f4a"; ctx.fillRect(px + T * 0.42, y + T * 0.1, T * 0.12, T * 0.75); ctx.fillStyle = blink ? "#ff3b3b" : "#5a1e1e"; ctx.beginPath(); ctx.arc(px + T * 0.48, y + T * 0.2, T * 0.14, 0, TAU); ctx.fill();
    if (blink) { ctx.fillStyle = "rgba(255,59,59,0.25)"; ctx.fillRect(0, y, V.W, T); }
    if (L.train) { const tx = sx(L.train.x), w = L.train.len * T; ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(tx + T * 0.1, y + T * 0.3, w, T * 0.62); ctx.fillStyle = "#d8383e"; K.roundRect(ctx, tx, y + T * 0.1, w, T * 0.74, T * 0.18); ctx.fill(); ctx.fillStyle = "#2a3140"; for (let k = 0.6; k < L.train.len - 0.5; k += 1.4) ctx.fillRect(tx + k * T, y + T * 0.24, T * 0.8, T * 0.28); ctx.fillStyle = "#f2f2f2"; ctx.fillRect(tx, y + T * 0.6, w, T * 0.08); }
  }
  if (L.coin !== null && L.coin !== undefined) { const cx = sx(L.coin) + T / 2, cy = y + T / 2 + Math.sin(G.t * 4 + L.r) * T * 0.05, sq = Math.abs(Math.cos(G.t * 3)); ctx.fillStyle = "#e0a800"; ctx.beginPath(); ctx.ellipse(cx, cy, T * 0.2 * sq + 1, T * 0.2, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#ffd84a"; ctx.beginPath(); ctx.ellipse(cx, cy, T * 0.14 * sq + 0.5, T * 0.14, 0, 0, TAU); ctx.fill(); }
}
function render(dt) {
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  ctx.fillStyle = "#86c862"; ctx.fillRect(0, 0, V.W, V.H);
  if (!G) return;
  let shk = G.shake > 0 ? (Math.random() - 0.5) * 10 * G.shake : 0; ctx.save(); ctx.translate(shk, 0);
  const T = V.T, top = Math.ceil(G.cam + V.base / T + 1), bot = Math.floor(G.cam - (V.H - V.base) / T - 1);
  for (let r = top; r >= bot; r--) { const L = lane(r); if (L) drawLane(L, sy(r)); }
  for (let r = top; r >= bot; r--) { const L = lane(r); if (L) drawObjects(L, sy(r)); if (G.p && r === Math.round(G.p.fr)) drawPlayer(); }
  // fog
  const fy = sy(G.fog) + T * 0.2, gr = ctx.createLinearGradient(0, fy - T * 2.2, 0, fy + T); gr.addColorStop(0, "rgba(240,244,255,0)"); gr.addColorStop(0.5, "rgba(240,244,255,0.75)"); gr.addColorStop(1, "rgba(240,244,255,0.97)"); ctx.fillStyle = gr; ctx.fillRect(0, fy - T * 2.2, V.W, V.H - fy + T * 2.2);
  for (let k = 0; k < 7; k++) { const x = ((k * 173 + G.t * 30 * (k % 2 ? 1 : -1)) % (V.W + 200)) - 100, y = fy - T * 0.6 + Math.sin(G.t + k) * T * 0.25; ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.ellipse(x, y, T * 1.2, T * 0.45, 0, 0, TAU); ctx.fill(); }
  // particles + pops
  for (const q of G.parts) { ctx.fillStyle = `rgba(${q.c},${Math.min(1, q.t * 2)})`; ctx.fillRect(sx(q.x) - 3, sy(q.y) + T - 3, 6, 6); }
  for (const q of G.pops) { ctx.globalAlpha = 1 - q.t / 0.9; ctx.font = `800 ${T * 0.4}px "Baloo 2"`; ctx.textAlign = "center"; ctx.fillStyle = q.col; ctx.fillText(q.text, sx(q.x), sy(q.r) - q.t * T); ctx.globalAlpha = 1; }
  ctx.restore();
  // HUD
  ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.font = `800 ${Math.max(30, T * 0.62)}px "Baloo 2"`; ctx.lineWidth = 6; ctx.strokeStyle = "rgba(58,42,18,0.55)"; ctx.strokeText(String(G.score), 16, 8); ctx.fillStyle = "#fff"; ctx.fillText(String(G.score), 16, 8);
  ctx.font = `700 ${Math.max(14, T * 0.24)}px "Baloo 2"`; ctx.lineWidth = 4; const best = G.daily ? (SAVE.daily.date === K.today() ? SAVE.daily.best : 0) : SAVE.best; const bt = `${G.daily ? "TODAY" : "BEST"} ${Math.max(best, G.score)}`; ctx.strokeText(bt, 18, 12 + Math.max(30, T * 0.62)); ctx.fillText(bt, 18, 12 + Math.max(30, T * 0.62));
  ctx.textAlign = "right"; ctx.font = `800 ${Math.max(20, T * 0.36)}px "Baloo 2"`; const ct = `● ${SAVE.coins}`; ctx.strokeText(ct, V.W - 16, 12); ctx.fillStyle = "#ffd84a"; ctx.fillText(ct, V.W - 16, 12);
  if (G.score === 0 && !G.over && G.t < 6) { ctx.textAlign = "center"; ctx.font = `800 ${Math.max(18, T * 0.3)}px "Baloo 2"`; ctx.fillStyle = "#fff"; ctx.strokeText(K.device === "touch" ? "Tap to hop · swipe to turn" : "Arrows or WASD to hop", V.W / 2, V.H * 0.86); ctx.fillText(K.device === "touch" ? "Tap to hop · swipe to turn" : "Arrows or WASD to hop", V.W / 2, V.H * 0.86); }
}
function drawPlayer() {
  const p = G.p, T = V.T; if (p.dead === "splash" && p.deadT > 0.1) return;
  const hopH = p.hop < 1 ? Math.sin(p.hop * Math.PI) * T * 0.35 : 0, cx = sx(p.fx) + T / 2, cy = sy(p.fr) + T / 2;
  ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(cx, cy + T * 0.28, T * 0.3 * (1 - hopH / T), T * 0.12, 0, 0, TAU); ctx.fill();
  const spr = critterSprite(SAVE.pick, Math.round(T * 1.05)), s = T * 1.05; let sxk = 1, syk = 1;
  if (p.hop < 1) { syk = 1 + Math.sin(p.hop * Math.PI) * 0.12; sxk = 1 - Math.sin(p.hop * Math.PI) * 0.08; } else if (p.dead === "squash") { syk = 0.25; sxk = 1.5; }
  if (p.bump > 0) { syk = 1 - p.bump * 0.8; sxk = 1 + p.bump * 0.6; }
  ctx.save(); ctx.translate(cx, cy + T * 0.22 - hopH); ctx.scale(sxk * (p.face === 3 ? -1 : 1), syk); ctx.drawImage(spr, -s / 2, -s * 0.78, s, s); ctx.restore();
}

/* ================= input ================= */
const DIRS = { ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
addEventListener("keydown", (e) => {
  if (!G || K.ui.active()) return;
  if (G.over) { if ((e.code === "Space" || e.code === "Enter") && G.p.deadT > 0.4) { e.preventDefault(); K.ui.hide(); newGame(G.daily); } return; }
  const d = DIRS[e.code]; if (d) { e.preventDefault(); if (!e.repeat) tryHop(d[0], d[1]); } else if (e.code === "Space") { e.preventDefault(); tryHop(0, 1); } else if (e.code === "Escape" || e.code === "KeyP") pause();
});
const SW = { id: null, x: 0, y: 0, t: 0 };
cv.addEventListener("pointerdown", (e) => { if (!G || K.ui.active()) return; K.audio(); if (G.over) return; SW.id = e.pointerId; SW.x = e.clientX; SW.y = e.clientY; SW.t = performance.now(); });
cv.addEventListener("pointerup", (e) => {
  if (e.pointerId !== SW.id || !G) return; SW.id = null; const dx = e.clientX - SW.x, dy = e.clientY - SW.y, d = Math.hypot(dx, dy);
  if (d < 24) return tryHop(0, 1);
  if (Math.abs(dx) > Math.abs(dy)) tryHop(dx > 0 ? 1 : -1, 0); else tryHop(0, dy < 0 ? 1 : -1);
});
let padT = 0;
function pollPad(dt) { const P = K.pad; if (!P.connected || !G || K.ui.active()) return; const pr = P.pressed; if (G.over) { if (pr.a && G.p.deadT > 0.4) newGame(G.daily); return; } if (pr.du || pr.a) tryHop(0, 1); if (pr.dd) tryHop(0, -1); if (pr.dl) tryHop(-1, 0); if (pr.dr) tryHop(1, 0); if (pr.start) pause(); }
$("#pauseBtn").onclick = () => pause();

/* ================= audio ================= */
K.defineSfx({
  hop: (t) => K.voice(420 + Math.random() * 60, t, 0.07, { type: "sine", vol: 0.06, slide: 1.6, slideT: 0.05 }),
  bump: (t) => K.voice(160, t, 0.07, { type: "triangle", vol: 0.05 }),
  coin: (t) => { K.voice(1318, t, 0.05, { duty: 0.5, vol: 0.04 }); K.voice(1760, t + 0.05, 0.14, { duty: 0.5, vol: 0.04 }); },
  log: (t) => K.voice(200, t, 0.06, { type: "triangle", vol: 0.06 }), pad: (t) => K.voice(500, t, 0.05, { type: "sine", vol: 0.05, slide: 0.8 }),
  splash: (t) => { K.noise(t, 0.4, { filter: "bandpass", freq: 900, slide: 0.4, vol: 0.18 }); K.voice(300, t, 0.3, { type: "sine", vol: 0.06, slide: 0.3 }); },
  squash: (t) => { K.noise(t, 0.2, { filter: "lowpass", freq: 900, vol: 0.2 }); K.voice(120, t, 0.25, { type: "square", vol: 0.06, slide: 0.5, lp: 800 }); },
  fogdie: (t) => K.noise(t, 0.8, { filter: "highpass", freq: 1500, slide: 0.3, vol: 0.1, attack: 0.2 }),
  horn: (t) => { K.voice(392, t, 0.2, { type: "square", vol: 0.025, lp: 1400 }); K.voice(494, t, 0.2, { type: "square", vol: 0.02, lp: 1400 }); },
  bell: (t) => { for (let k = 0; k < 4; k++) K.voice(1760, t + k * 0.22, 0.12, { type: "triangle", vol: 0.04 }); },
  train: (t) => K.noise(t, 1.2, { filter: "lowpass", freq: 600, vol: 0.12, attack: 0.2 }),
}, { hop: 0.04, horn: 0.6, log: 0.05 });
K.songs({ hop: { bpm: 122, chords: ["C", "Am", "F", "G", "C", "Am", "Dm", "G"], bass: "R . O . F . O . R . O . F . O .", bassWave: "triangle", bassVol: 0.11, drums: "k . h . s . h . k . h k s . h .", arp: true, arpVol: 0.015, arpPat: [0, 1, 2, 1],
  lead: ["e5 . g5 . c6 - g5 .", "a5 - e5 . c5 - - .", "f5 . a5 . c6 - a5 .", "g5 - - . d5 - - .", "e5 g5 c6 . e6 - d6 .", "c6 - a5 . e5 - - .", "d5 . f5 . a5 . f5 .", "g5 - - - b5 - - -"], leadVol: 0.035, leadWave: 0.25 } });

/* ================= screens ================= */
function critterImg(id) { const keep = V.dpr; V.dpr = 2; const c = document.createElement("canvas"); c.width = c.height = 160; const g = c.getContext("2d"); g.scale(2, 2); drawCritter(g, CRITTERS.find((q) => q.id === id), 80); V.dpr = keep; return c.toDataURL(); }
let IMGS = null;
function title() {
  G = null; $("#pauseBtn").hidden = true; K.playSong("hop", 1); IMGS = IMGS || Object.fromEntries(CRITTERS.map((c) => [c.id, critterImg(c.id)]));
  const dd = SAVE.daily.date === K.today() ? SAVE.daily.best : 0;
  K.ui.show(`<img src="${IMGS[SAVE.pick]}" alt="" style="width:6em;height:6em"><div class="logo">HOPPER</div><p class="k-sub">Hop as far as you can. Dodge traffic, ride the logs, mind the trains, and don't let the fog catch you.</p>
    <div class="k-menu"><button class="k-btn primary" data-a="play" autofocus>Play${SAVE.best ? " · best " + SAVE.best : ""}</button><button class="k-btn" data-a="daily">Daily path${dd ? " · today " + dd : ""}</button><button class="k-btn" data-a="shop">Critters · <span class="coins">● ${SAVE.coins}</span></button><button class="k-btn" data-a="settings">Settings</button></div>`, { cls: "soft" });
}
function shop() {
  IMGS = IMGS || Object.fromEntries(CRITTERS.map((c) => [c.id, critterImg(c.id)]));
  const items = CRITTERS.map((c) => { const own = SAVE.owned.includes(c.id); return `<button class="k-btn critter ${SAVE.pick === c.id ? "on" : ""} ${own ? "" : "locked"}" data-a="crit" data-id="${c.id}"><img src="${IMGS[c.id]}" alt=""><b>${c.name}</b><small>${own ? (SAVE.pick === c.id ? "Selected" : "Owned") : "● " + c.price}</small></button>`; }).join("");
  K.ui.show(`<div class="k-bar"><h2>Critters</h2><span class="coins">● ${SAVE.coins}</span><button class="k-btn" data-a="title">Back</button></div><p class="k-sub">Collect coins on your hops to unlock new critters.</p><div class="shop">${items}</div>`, { back: "title", cls: "top" });
}
function pause() { if (!G || G.over || K.ui.active()) return; K.ui.show(`<div class="logo" style="font-size:2.8em">Paused</div><p class="k-sub">Score ${G.score}</p><div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="play">Restart</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "resume" }); }
function results() {
  const best = G.daily ? SAVE.daily.best : SAVE.best;
  K.ui.show(`<div class="logo" style="font-size:2.8em">${{ splash: "Splash!", squash: "Squashed!", fog: "Lost in the fog!" }[G.p.dead]}</div>
    <div class="k-stats"><div class="k-stat"><small>Score</small><b>${G.score}</b></div><div class="k-stat"><small>${G.daily ? "Today's best" : "Best"}</small><b>${best}</b></div><div class="k-stat"><small>Coins</small><b>+${G.coins}</b></div></div>${G.pb ? `<b style="color:var(--gold)">New best!</b>` : ""}
    <div class="k-row"><button class="k-btn primary" data-a="${G.daily ? "daily" : "play"}" autofocus>Hop again</button>${G.daily ? `<button class="k-btn" data-a="share">Copy result</button>` : ""}<button class="k-btn" data-a="shop">Critters</button><button class="k-btn" data-a="title">Main menu</button></div><div class="k-msg" id="msg"></div>`, { back: "title", cls: "soft" });
}
function settings() { const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="title">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center">${K.ui.settingsRows()}</div>`, { back: "title", cls: "top" }); K.ui.bindSettings(s); }
K.ui.on((a, d) => {
  switch (a) {
    case "play": K.sfx("ok"); return newGame(false);
    case "daily": K.sfx("ok"); return newGame(true);
    case "title": K.sfx("back"); return title();
    case "shop": K.sfx("ok"); return shop();
    case "resume": K.ui.hide(); return;
    case "settings": K.sfx("ok"); return settings();
    case "crit": { const c = CRITTERS.find((q) => q.id === d.id); if (SAVE.owned.includes(c.id)) { SAVE.pick = c.id; K.sfx("ok"); } else if (SAVE.coins >= c.price) { SAVE.coins -= c.price; SAVE.owned.push(c.id); SAVE.pick = c.id; K.sfx("coin"); K.toast(`${c.name} unlocked!`); } else { K.sfx("deny"); K.toast("Not enough coins", `${c.name} costs ${c.price}.`); } persist(); SPR.clear(); return shop(); }
    case "share": K.copy(`HOPPER · Daily path ${K.today()}\nI hopped ${G.score} rows`).then((ok) => { const m = $("#msg"); if (m) m.textContent = ok ? "Copied to clipboard." : "Couldn't copy."; }); return;
  }
});
K.onPause(() => { if (G && !G.over && !K.ui.active()) pause(); });

/* ================= boot ================= */
layout(); title();
document.fonts.load('800 30px "Baloo 2"').catch(() => {});
K.loop((dt) => { pollPad(dt); if (G && !K.ui.active()) update(dt); render(dt); });
