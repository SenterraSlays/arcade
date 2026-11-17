/* MOMENTUM: a pixel-art speedrun platformer.
   Fixed 120 Hz physics, millisecond timer, splits, ghosts, 10 levels, level editor, share codes. */
(() => {
"use strict";

/* ================= constants ================= */
const T = 8, VW = 320, VH = 180, HZ = 120, DT = 1 / HZ;
const MIN_W = 20, MIN_H = 12, MAX_W = 400, MAX_H = 120;
const PH = {
  W: 6, H: 10,
  MAX_RUN: 110, RUN_ACCEL: 1000, RUN_FRICTION: 1300, AIR_ACCEL: 700, AIR_FRICTION: 260,
  OVER_GROUND: 420, OVER_AIR: 90,
  GRAVITY: 900, APEX_MULT: 0.5, APEX_RANGE: 40, FALL_MAX: 250, FAST_FALL: 330, WALL_SLIDE: 70,
  JUMP_V: 250, JUMP_BOOST: 20, JUMP_CUT: 70,
  WALL_JUMP_X: 150, WALL_JUMP_Y: 235, WALL_LOCK: 0.1, WALL_REACH: 3,
  DASH_V: 260, DASH_TIME: 0.15, DASH_END_X: 0.72, DASH_END_Y: 0.5,
  SUPER_VX: 240, HYPER_VX: 290, HYPER_VY: 0.55, BOUNCE_VY: 1.35,
  SPRING_V: 380, COYOTE: 0.09, JUMP_BUF: 0.1, DASH_BUF: 0.06,
  CRUMBLE_DELAY: 0.35, CRUMBLE_RESPAWN: 2.0, CRYSTAL_RESPAWN: 2.5,
};
const VALID = new Set(".#^S*=CPG");

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function hash2(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/* ================= storage ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem("momentum." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("momentum." + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem("momentum." + k); } catch { /* ignore */ } },
};
const settings = Object.assign({ splits: true, ghost: true, touch: "auto", shake: true, sfx: true }, store.get("settings", {}));
let bests = store.get("bests", {});
let runPB = store.get("runpb", null);
let golds = store.get("golds", []);
let customs = store.get("custom", []);
const saveSettings = () => store.set("settings", settings);

/* ================= time formatting ================= */
const ms = (steps) => Math.round((steps * 1000) / HZ);
function fmt(steps) {
  if (steps == null) return "--:--.---";
  const t = ms(steps), m = Math.floor(t / 60000), s = Math.floor(t / 1000) % 60, r = t % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(r).padStart(3, "0")}`;
}
function fmtDelta(steps) {
  const t = ms(steps), a = Math.abs(t), sign = t < 0 ? "-" : "+";
  if (a >= 60000) return sign + fmt(Math.abs(steps)).replace(/\d$/, "");
  return sign + (a / 1000).toFixed(2);
}

/* ================= levels ================= */
function build(name, w, h, theme, fn) {
  const t = new Array(w * h).fill(".");
  const B = {
    rect(x, y, rw, rh, c = "#") { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) if (i >= 0 && j >= 0 && i < w && j < h) t[j * w + i] = c; },
    set(x, y, c) { if (x >= 0 && y >= 0 && x < w && y < h) t[y * w + x] = c; },
    row(x0, x1, y, c) { for (let i = x0; i <= x1; i++) B.set(i, y, c); },
  };
  fn(B);
  return { name, w, h, theme, tiles: t };
}

const BASE = [
  build("First Steps", 100, 23, 2, (b) => {
    b.rect(0, 18, 22, 5); b.rect(25, 18, 12, 5); b.rect(37, 16, 10, 7); b.rect(47, 14, 8, 9);
    b.rect(59, 14, 8, 9); b.rect(67, 18, 10, 5); b.rect(82, 18, 18, 5);
    b.set(2, 17, "P"); b.set(96, 17, "G");
  }),
  build("Wall Kick", 60, 45, 2, (b) => {
    b.rect(0, 40, 60, 5);
    b.rect(10, 6, 2, 31); b.rect(16, 10, 2, 30);
    b.row(18, 59, 39, "^");
    b.rect(16, 10, 14, 2); b.rect(34, 10, 26, 2);
    b.set(3, 39, "P"); b.set(57, 9, "G");
  }),
  build("Dash", 110, 23, 2, (b) => {
    b.rect(0, 17, 15, 6); b.rect(25, 17, 8, 6); b.rect(33, 11, 12, 12); b.rect(55, 11, 6, 12);
    b.rect(72, 14, 10, 9); b.rect(82, 17, 28, 6);
    b.set(2, 16, "P"); b.set(106, 16, "G");
  }),
  build("Spikes", 110, 23, 0, (b) => {
    b.rect(0, 17, 12, 6);
    b.rect(12, 19, 30, 4); b.row(12, 41, 18, "^");
    b.rect(17, 15, 2, 4); b.rect(24, 14, 2, 5); b.rect(31, 15, 2, 4); b.rect(37, 15, 3, 4);
    b.rect(42, 17, 35, 6);
    b.rect(52, 0, 25, 11); b.row(52, 76, 11, "^");
    [58, 59, 66, 67, 73].forEach((x) => b.set(x, 16, "^"));
    b.rect(77, 17, 5, 6);
    b.rect(82, 21, 8, 2); b.row(82, 89, 20, "^");
    b.rect(90, 17, 20, 6);
    b.set(2, 16, "P"); b.set(106, 16, "G");
  }),
  build("Springs", 100, 40, 0, (b) => {
    b.rect(0, 36, 20, 4); b.set(12, 35, "S");
    b.rect(16, 28, 12, 2); b.set(25, 27, "S");
    b.rect(29, 20, 12, 2);
    b.rect(41, 36, 10, 4); b.row(41, 50, 35, "^"); b.set(46, 35, "S"); b.set(47, 35, "S");
    b.rect(51, 27, 12, 2);
    b.rect(67, 24, 10, 2); b.set(75, 23, "S");
    b.rect(79, 15, 21, 2);
    b.set(2, 35, "P"); b.set(96, 14, "G");
  }),
  build("Crystals", 120, 30, 0, (b) => {
    b.rect(0, 22, 14, 8);
    [[19, 17], [26, 17], [33, 18], [40, 18], [47, 19]].forEach(([x, y]) => b.set(x, y, "*"));
    b.rect(52, 22, 4, 8);
    [[60, 17], [67, 17], [74, 18], [81, 18], [88, 19]].forEach(([x, y]) => b.set(x, y, "*"));
    b.rect(93, 22, 4, 8);
    b.rect(101, 22, 19, 8);
    b.set(2, 21, "P"); b.set(116, 21, "G");
  }),
  build("Crumble", 110, 26, 1, (b) => {
    b.rect(0, 20, 12, 6);
    [15, 21, 27, 33].forEach((x) => b.rect(x, 20, 3, 1, "C"));
    b.rect(38, 20, 6, 6);
    b.rect(46, 18, 3, 1, "C"); b.rect(51, 16, 3, 1, "C"); b.rect(56, 14, 3, 1, "C"); b.rect(61, 12, 3, 1, "C");
    b.rect(66, 12, 8, 2);
    b.rect(74, 20, 20, 1, "C");
    b.rect(74, 24, 20, 2); b.row(74, 93, 23, "^");
    b.rect(94, 20, 16, 6);
    b.set(2, 19, "P"); b.set(106, 19, "G");
  }),
  build("Ascent", 34, 60, 1, (b) => {
    b.rect(0, 56, 34, 4);
    b.rect(4, 53, 6, 1, "="); b.rect(12, 50, 6, 1, "="); b.rect(4, 47, 6, 1, "=");
    b.rect(12, 44, 6, 1, "="); b.rect(4, 41, 6, 1, "=");
    b.rect(10, 38, 18, 2);
    b.rect(20, 12, 2, 24); b.rect(26, 8, 2, 30);
    b.rect(4, 12, 16, 2);
    b.rect(0, 6, 8, 2);
    b.set(4, 55, "P"); b.set(2, 5, "G");
  }),
  build("Gauntlet", 150, 30, 1, (b) => {
    b.rect(0, 22, 10, 8);
    b.rect(10, 26, 40, 4); b.row(10, 49, 25, "^");
    b.rect(15, 22, 3, 1, "C"); b.rect(24, 21, 3, 1, "C"); b.rect(33, 22, 3, 1, "C");
    b.set(43, 18, "*");
    b.rect(50, 22, 6, 8); b.set(55, 21, "S");
    b.rect(58, 13, 34, 2);
    b.rect(68, 0, 24, 8); b.row(68, 91, 8, "^");
    [74, 75, 82, 83].forEach((x) => b.set(x, 12, "^"));
    b.set(102, 14, "*");
    b.rect(113, 18, 8, 12);
    b.rect(121, 18, 15, 1, "C");
    b.rect(121, 28, 15, 2); b.row(121, 135, 27, "^");
    b.rect(136, 18, 14, 12);
    b.set(2, 21, "P"); b.set(146, 17, "G");
  }),
  build("Final Rush", 200, 40, 1, (b) => {
    b.rect(0, 30, 12, 10); b.rect(15, 30, 8, 10); b.rect(26, 28, 8, 12); b.rect(37, 26, 8, 14); b.set(43, 25, "S");
    b.rect(47, 17, 12, 2);
    [[64, 14], [71, 14], [78, 15], [85, 15]].forEach(([x, y]) => b.set(x, y, "*"));
    b.rect(90, 19, 14, 21);
    b.rect(96, 0, 2, 17); b.rect(102, 6, 2, 13);
    b.rect(102, 6, 20, 2);
    b.rect(122, 0, 20, 2); b.row(122, 141, 2, "^");
    b.rect(122, 8, 20, 2); [128, 129, 135, 136].forEach((x) => b.set(x, 7, "^"));
    b.rect(142, 22, 20, 1, "C");
    b.rect(142, 38, 20, 2); b.row(142, 161, 37, "^");
    b.rect(162, 22, 10, 18); b.set(177, 19, "*"); b.rect(184, 22, 16, 18);
    b.set(2, 29, "P"); b.set(196, 21, "G");
  }),
];

/* ================= codes (levels + saves) ================= */
function rleEncode(tiles) {
  let out = "", i = 0;
  while (i < tiles.length) {
    const c = tiles[i]; let n = 1;
    while (i + n < tiles.length && tiles[i + n] === c) n++;
    out += (n > 1 ? n : "") + c; i += n;
  }
  return out;
}
function rleDecode(s, total) {
  if (!(total > 0) || total > MAX_W * MAX_H) throw new Error("Bad level size.");
  const t = []; let num = "";
  for (const ch of String(s)) {
    if (ch >= "0" && ch <= "9") { num += ch; if (num.length > 6) throw new Error("Bad level data."); continue; }
    if (!VALID.has(ch)) throw new Error("Bad level data.");
    const n = num ? parseInt(num, 10) : 1; num = "";
    if (t.length + n > total) throw new Error("Bad level data.");
    for (let k = 0; k < n; k++) t.push(ch);
  }
  if (t.length !== total) throw new Error("Bad level data.");
  return t;
}
function b64e(str) {
  const bytes = new TextEncoder().encode(str); let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64d(b) {
  const bin = atob(b), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
const LEVEL_PREFIX = "MOMENTUM-LEVEL:", SAVE_PREFIX = "MOMENTUM-SAVE:";
function levelToCode(lv) {
  const b = b64e(JSON.stringify({ v: 1, n: String(lv.name).slice(0, 40), t: lv.theme | 0, w: lv.w, h: lv.h, d: rleEncode(lv.tiles) }));
  return LEVEL_PREFIX + b + "." + hashStr(b);
}
function unwrap(code, prefix, what) {
  code = String(code || "").replace(/\s+/g, "");
  if (code.startsWith(prefix)) code = code.slice(prefix.length);
  const dot = code.lastIndexOf(".");
  if (dot < 1) throw new Error(`That doesn't look like a ${what} code.`);
  const b = code.slice(0, dot);
  if (hashStr(b) !== code.slice(dot + 1)) throw new Error("The code is incomplete or changed. Copy the whole thing.");
  try { return JSON.parse(b64d(b)); } catch { throw new Error("The code couldn't be read."); }
}
function cleanLevel(o) {
  const w = o.w | 0, h = o.h | 0;
  if (w < MIN_W || h < MIN_H || w > MAX_W || h > MAX_H) throw new Error("The level size is out of range.");
  const tiles = Array.isArray(o.tiles) ? o.tiles.slice() : rleDecode(o.d, w * h);
  let seenP = false;
  for (let i = 0; i < tiles.length; i++) {
    if (!VALID.has(tiles[i])) tiles[i] = ".";
    if (tiles[i] === "P") { if (seenP) tiles[i] = "."; seenP = true; }
  }
  return { name: String(o.name || o.n || "Untitled").slice(0, 40) || "Untitled", theme: clamp(o.theme ?? o.t ?? 2, 0, 2) | 0, w, h, tiles };
}
const codeToLevel = (code) => cleanLevel(unwrap(code, LEVEL_PREFIX, "level"));
const levelKey = (lv) => hashStr(lv.w + "x" + lv.h + ":" + rleEncode(lv.tiles));
function problems(lv) {
  let p = 0, g = 0;
  for (const c of lv.tiles) { if (c === "P") p++; else if (c === "G") g++; }
  if (!p) return "Place a Start first (tool 7).";
  if (!g) return "Place at least one Goal (tool 8).";
  return null;
}
const cloneLevel = (lv) => ({ name: lv.name, theme: lv.theme, w: lv.w, h: lv.h, tiles: lv.tiles.slice() });
const entryLevel = (e) => cleanLevel({ name: e.name, theme: e.theme, w: e.w, h: e.h, d: e.d });
function makeEntry(lv, id, mine, created) {
  return { id: id || Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), k: levelKey(lv), name: lv.name, theme: lv.theme, w: lv.w, h: lv.h, d: rleEncode(lv.tiles), mine: !!mine, created: created || Date.now() };
}
const saveCustoms = () => store.set("custom", customs);

function exportSave() {
  const b = b64e(JSON.stringify({ v: 1, bests, runPB, golds, customs, settings }));
  return SAVE_PREFIX + b + "." + hashStr(b);
}
function importSave(code) {
  const o = unwrap(code, SAVE_PREFIX, "save");
  if (!o || typeof o !== "object") throw new Error("That save code is empty.");
  const nb = {};
  if (o.bests && typeof o.bests === "object") for (const [k, v] of Object.entries(o.bests)) if (Number.isFinite(v) && v > 0) nb[k] = Math.floor(v);
  const nc = [];
  if (Array.isArray(o.customs)) for (const e of o.customs) { try { const lv = entryLevel(e); nc.push(makeEntry(lv, String(e.id || ""), e.mine, e.created)); } catch { /* skip broken */ } }
  bests = nb; customs = nc;
  runPB = o.runPB && Number.isFinite(o.runPB.total) && Array.isArray(o.runPB.splits) ? o.runPB : null;
  golds = Array.isArray(o.golds) ? o.golds.map((v) => (Number.isFinite(v) ? v : null)) : [];
  if (o.settings && typeof o.settings === "object") Object.assign(settings, o.settings);
  store.set("bests", bests); store.set("custom", customs); store.set("runpb", runPB); store.set("golds", golds); saveSettings();
}

/* ghosts: Int16 triples (x*4, y*4, flags) every 2 physics steps */
function ghostEncode(arr) {
  const u = new Uint8Array(Int16Array.from(arr).buffer); let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function ghostDecode(b) {
  if (typeof b !== "string" || !b) return null;
  try {
    const s = atob(b); if (s.length % 2) return null;
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return new Int16Array(u.buffer);
  } catch { return null; }
}

/* ================= audio ================= */
let actx = null, noiseBuf = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { actx = null; } }
  if (actx && actx.state === "suspended") actx.resume().catch(() => {});
  return actx;
}
function tone(freq, dur, type = "square", vol = 0.06, slide = 1, delay = 0) {
  if (!settings.sfx) return; const a = audio(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.1, freq = 1800) {
  if (!settings.sfx) return; const a = audio(); if (!a) return;
  if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
  s.buffer = noiseBuf; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 0.8;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + dur + 0.02);
}
const SFX = {
  jump: () => tone(420, 0.09, "square", 0.05, 1.6),
  wall: () => tone(360, 0.1, "square", 0.05, 1.8),
  super: () => { tone(300, 0.14, "square", 0.05, 2.2); noise(0.1, 0.06, 3000); },
  dash: () => noise(0.16, 0.12, 2400),
  land: () => tone(140, 0.05, "triangle", 0.06, 0.7),
  death: () => { tone(320, 0.25, "sawtooth", 0.05, 0.25); noise(0.2, 0.08, 900); },
  spring: () => tone(220, 0.2, "square", 0.05, 3),
  crystal: () => { tone(880, 0.08, "triangle", 0.06); tone(1320, 0.12, "triangle", 0.05, 1, 0.06); },
  split: () => tone(988, 0.08, "square", 0.04),
  finish: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, "square", 0.04, 1, i * 0.07)),
  pb: () => [659, 784, 988, 1319, 1568].forEach((f, i) => tone(f, 0.16, "square", 0.045, 1, i * 0.08)),
};

/* ================= themes + art ================= */
const THEMES = [
  { sky: ["#1b1033", "#2b1850", "#46216a", "#6e2c7a", "#a23d7f", "#d9577f"], far: "#2a1747", near: "#1a0e33", farH: 78, nearH: 44, stars: true,
    fill: "#2e2350", dark: "#160f2a", light: "#5a4790", top: "#ff7eb6", top2: "#c9508f", speck: "#3d2f68", plank: "#ff9ccb" },
  { sky: ["#04050d", "#080b1e", "#0d1333", "#131b48", "#1a245c", "#22306e"], far: "#10183a", near: "#0a0f28", farH: 70, nearH: 56, stars: true, city: true,
    fill: "#18203f", dark: "#090d20", light: "#2f4a8a", top: "#4fd6e8", top2: "#2b8fb3", speck: "#223061", plank: "#7ff0ff" },
  { sky: ["#ffd88a", "#ffbe73", "#ff9d6c", "#ef7b74", "#c9638a", "#8d5292"], far: "#a65a86", near: "#6b3b6e", farH: 72, nearH: 40, sun: true,
    fill: "#6b4232", dark: "#3a221c", light: "#8e5a40", top: "#8be26b", top2: "#4fae4f", speck: "#7d4f3b", plank: "#e9c27a" },
];
function mkCanvas(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false; return [c, g];
}
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function makeBg(th, ti) {
  const [sky, s] = mkCanvas(VW, VH), n = th.sky.length, bh = Math.ceil(VH / n);
  th.sky.forEach((c, i) => { s.fillStyle = c; s.fillRect(0, i * bh, VW, bh); });
  for (let i = 1; i < n; i++) {
    const y = i * bh;
    s.fillStyle = th.sky[i]; for (let x = 0; x < VW; x += 2) s.fillRect(x, y - 1, 1, 1);
    s.fillStyle = th.sky[i - 1]; for (let x = 1; x < VW; x += 2) s.fillRect(x, y, 1, 1);
  }
  const r = rng(77 + ti * 31);
  if (th.stars) for (let i = 0; i < 80; i++) { s.fillStyle = r() < 0.2 ? "#ffffff" : "rgba(255,255,255,.45)"; s.fillRect(Math.floor(r() * VW), Math.floor(r() * VH * 0.6), 1, 1); }
  if (th.sun) { s.fillStyle = "#fff1b8"; for (let dy = -20; dy <= 20; dy++) { const w = Math.round(Math.sqrt(400 - dy * dy)); s.fillRect(232 - w, 78 + dy, w * 2, 1); } }
  const LW = 480;
  const [far, f] = mkCanvas(LW, VH); f.fillStyle = th.far;
  for (let x = 0; x < LW; x++) {
    const a = (x / LW) * Math.PI * 2;
    const h = Math.round(th.farH + 16 * Math.sin(a * 2 + ti) + 8 * Math.sin(a * 5 + 1.7) + 4 * Math.sin(a * 11 + 0.3));
    f.fillRect(x, VH - h, 1, h);
  }
  const [near, g] = mkCanvas(LW, VH);
  if (th.city) {
    let x = 0;
    while (x < LW) {
      const w = 14 + Math.floor(r() * 26), h = th.nearH + Math.floor(r() * 50);
      g.fillStyle = th.near; g.fillRect(x, VH - h, w, h);
      g.fillStyle = r() < 0.5 ? "#ff4fa3" : "#4fd6e8";
      for (let wy = VH - h + 4; wy < VH - 6; wy += 5) for (let wx = x + 3; wx < x + w - 3; wx += 4) if (r() < 0.22) g.fillRect(wx, wy, 1, 2);
      x += w + Math.floor(r() * 4);
    }
  } else {
    g.fillStyle = th.near;
    for (let x = 0; x < LW; x++) {
      const a = (x / LW) * Math.PI * 2;
      const h = Math.round(th.nearH + 12 * Math.sin(a * 3 + 2 + ti) + 6 * Math.sin(a * 7 + 0.4));
      g.fillRect(x, VH - h, 1, h);
    }
  }
  return { sky, far, near };
}
const BG = THEMES.map(makeBg);
function tileH(img, off, y) {
  let x = Math.round(off % img.width); if (x > 0) x -= img.width;
  for (; x < VW; x += img.width) ctx.drawImage(img, x, y);
}
function drawBg(ti, cx, cy) {
  const b = BG[ti];
  ctx.drawImage(b.sky, 0, 0);
  tileH(b.far, -cx * 0.12, 10 + Math.round(clamp(-cy * 0.04, -10, 10)));
  tileH(b.near, -cx * 0.3, 18 + Math.round(clamp(-cy * 0.08, -18, 18)));
}

const isSolidC = (c) => c === "#" || c === "C";
function tAt(lv, x, y) {
  if (x < 0 || x >= lv.w) return "#";
  if (y < 0 || y >= lv.h) return ".";
  return lv.tiles[y * lv.w + x];
}
function spikeDirOf(lv, x, y) {
  if (isSolidC(tAt(lv, x, y + 1))) return 0;
  if (isSolidC(tAt(lv, x, y - 1))) return 2;
  if (isSolidC(tAt(lv, x - 1, y))) return 1;
  if (isSolidC(tAt(lv, x + 1, y))) return 3;
  return 0;
}
function drawSolid(g, th, lv, x, y, px, py) {
  const up = isSolidC(tAt(lv, x, y - 1)), dn = isSolidC(tAt(lv, x, y + 1));
  const lf = isSolidC(tAt(lv, x - 1, y)), rt = isSolidC(tAt(lv, x + 1, y));
  const h = hash2(x, y);
  g.fillStyle = th.fill; g.fillRect(px, py, 8, 8);
  g.fillStyle = th.speck;
  if (h & 1) g.fillRect(px + 1 + ((h >>> 3) % 6), py + 2 + ((h >>> 7) % 5), 1, 1);
  if ((h >>> 2) & 1) g.fillRect(px + 1 + ((h >>> 11) % 5), py + 3 + ((h >>> 15) % 4), 2, 1);
  g.fillStyle = th.light;
  if (!lf) g.fillRect(px + 1, py + 1, 1, 6);
  g.fillStyle = th.dark;
  if (!lf) g.fillRect(px, py, 1, 8);
  if (!rt) g.fillRect(px + 7, py, 1, 8);
  if (!dn) g.fillRect(px, py + 7, 8, 1);
  if (!up) {
    g.fillStyle = th.top; g.fillRect(px, py, 8, 2);
    g.fillStyle = th.top2; g.fillRect(px, py + 2, 8, 1);
    if ((h >>> 20) & 1) g.fillRect(px + ((h >>> 21) % 7), py + 3, 1, 1);
    g.fillStyle = th.top;
    if ((h >>> 9) % 3 === 0) g.fillRect(px + ((h >>> 24) % 7), py - 1, 1, 1);
  }
}
function drawSpike(g, px, py, dir) {
  g.save(); g.translate(px + 4, py + 4); g.rotate((dir * Math.PI) / 2);
  for (const o of [-4, 0]) {
    g.fillStyle = "#d9d6ff";
    g.fillRect(o + 1, -1, 1, 2); g.fillRect(o, 1, 2, 3);
    g.fillStyle = "#8e88c4";
    g.fillRect(o + 2, -1, 1, 2); g.fillRect(o + 2, 1, 2, 3);
  }
  g.fillStyle = "#5a5490"; g.fillRect(-4, 3, 8, 1);
  g.restore();
}
function drawOneWay(g, th, px, py) {
  g.fillStyle = th.plank; g.fillRect(px, py, 8, 1);
  g.fillStyle = th.light; g.fillRect(px, py + 1, 8, 2);
  g.fillStyle = th.dark; g.fillRect(px, py + 3, 8, 1); g.fillRect(px + 1, py + 4, 1, 2); g.fillRect(px + 6, py + 4, 1, 2);
}
function drawSpring(g, px, py, squash) {
  const c = squash ? 2 : 0;
  g.fillStyle = "#3b3f5c"; g.fillRect(px + 1, py + 6, 6, 2);
  g.fillStyle = "#b8bcd6"; g.fillRect(px + 2, py + 4 + c, 1, 2 - c / 2); g.fillRect(px + 5, py + 4 + c, 1, 2 - c / 2);
  g.fillStyle = "#ff5b6e"; g.fillRect(px, py + 3 + c, 8, 2);
  g.fillStyle = "#ffb0b8"; g.fillRect(px, py + 3 + c, 8, 1);
}
function drawCrumble(g, px, py, state, n) {
  if (state === 2) {
    g.fillStyle = "rgba(240,176,112,.35)";
    for (let i = 0; i < 8; i += 2) { g.fillRect(px + i, py, 1, 1); g.fillRect(px + i + 1, py + 7, 1, 1); g.fillRect(px, py + i + 1, 1, 1); g.fillRect(px + 7, py + i, 1, 1); }
    return;
  }
  const ox = state === 1 ? (((n >> 1) & 1) ? 1 : -1) : 0;
  px += ox;
  g.fillStyle = "#a8683a"; g.fillRect(px, py, 8, 8);
  g.fillStyle = "#f0b070"; g.fillRect(px, py, 8, 2);
  g.fillStyle = "#5e3520";
  g.fillRect(px + 2, py + 3, 1, 2); g.fillRect(px + 3, py + 5, 1, 1); g.fillRect(px + 5, py + 2, 1, 2); g.fillRect(px + 6, py + 4, 1, 2);
  g.fillRect(px, py + 7, 8, 1);
}
function drawCrystal(g, cx, cy, gone) {
  if (gone) { g.fillStyle = "rgba(122,245,255,.3)"; g.fillRect(cx - 1, cy - 3, 2, 1); g.fillRect(cx - 1, cy + 2, 2, 1); g.fillRect(cx - 3, cy - 1, 1, 2); g.fillRect(cx + 2, cy - 1, 1, 2); return; }
  const rows = [2, 4, 6, 6, 4, 2];
  rows.forEach((w, i) => { g.fillStyle = i < 3 ? "#bdfbff" : "#46c8e0"; g.fillRect(cx - w / 2, cy - 3 + i, w, 1); });
  g.fillStyle = "#ffffff"; g.fillRect(cx - 1, cy - 2, 1, 1);
}
function drawGoal(g, px, py, t) {
  g.fillStyle = "#3b3f5c"; g.fillRect(px, py + 7, 4, 1);
  g.fillStyle = "#f4efff"; g.fillRect(px + 1, py - 8, 1, 16);
  const wave = Math.floor(t * 6) % 2;
  g.fillStyle = "#ffd23f"; g.fillRect(px + 2, py - 8, 5, 4);
  g.fillStyle = "#1a1235"; g.fillRect(px + 3, py - 7, 1, 1); g.fillRect(px + 5, py - 6, 1, 1);
  if (wave) { g.fillStyle = "#ffd23f"; g.fillRect(px + 7, py - 7, 1, 2); }
}

/* player sprite: rects relative to the 6x10 hitbox, drawn facing right then mirrored */
const LEGS = {
  idle: [[1, 7, 2, 3], [3, 7, 2, 3]],
  run: [[[0, 7, 2, 2], [4, 7, 2, 3]], [[2, 7, 2, 3]], [[0, 7, 2, 3], [4, 7, 2, 2]], [[2, 7, 2, 3]]],
  jump: [[1, 7, 2, 2], [3, 7, 2, 2]],
  fall: [[0, 7, 2, 3], [4, 7, 2, 3]],
  wall: [[1, 7, 2, 3], [3, 7, 2, 2]],
  dash: [[0, 7, 2, 2], [3, 7, 3, 2]],
};
function playerRects(state, frame) {
  const legs = state === 1 ? LEGS.run[frame & 3] : state === 2 ? LEGS.jump : state === 3 ? LEGS.fall : state === 4 ? LEGS.wall : state === 5 ? LEGS.dash : LEGS.idle;
  return { legs, body: [0, 4, 6, 4], head: [0, 0, 6, 4], hair: [0, -1, 6, 2], tuft: [-1, 0, 2, 3], eye: [4, 1, 1, 2] };
}
function drawPlayer(g, x, y, facing, state, frame, dashes, ghost) {
  x = Math.round(x); y = Math.round(y);
  const R = playerRects(state, frame), f = facing < 0;
  const put = (r, color) => { g.fillStyle = color; g.fillRect(x + (f ? 6 - r[0] - r[2] : r[0]), y + r[1], r[2], r[3]); };
  const hair = dashes > 0 ? "#ff4fa3" : "#4fb8ff";
  if (ghost) {
    const c = "rgba(200,230,255,.38)";
    R.legs.forEach((r) => put(r, c)); put(R.body, c); put(R.head, c); put(R.hair, c); put(R.tuft, c);
    return;
  }
  const outline = (r) => put([r[0] - 1, r[1] - 1, r[2] + 2, r[3] + 2], "#120a24");
  R.legs.forEach(outline); outline(R.body); outline(R.head); outline(R.hair); outline(R.tuft);
  R.legs.forEach((r) => put(r, "#2b2a52"));
  put(R.body, state === 5 ? "#9aa8ff" : "#5b6ee1");
  put(R.head, "#ffd9b3");
  put(R.hair, hair); put(R.tuft, hair);
  put(R.eye, "#120a24");
  const sw = (frame & 1) ? 1 : 0;
  put([-2, 4 + sw, 2, 1], hair); put([-3, 5, 1, 1], hair);
}
const animState = (p) => (p.dashTime > 0 ? 5 : p.wallSlide ? 4 : !p.onGround ? (p.vy < 0 ? 2 : 3) : Math.abs(p.vx) > 8 ? 1 : 0);
const animFrame = (p) => Math.floor(p.anim / 7) & 3;

function staticLayer(lv) {
  if (lv._st && lv._stTheme === lv.theme) return lv._st;
  const [c, g] = mkCanvas(lv.w * T, lv.h * T), th = THEMES[lv.theme];
  for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
    const ch = lv.tiles[y * lv.w + x];
    if (ch === "#") drawSolid(g, th, lv, x, y, x * T, y * T);
    else if (ch === "^") drawSpike(g, x * T, y * T, spikeDirOf(lv, x, y));
    else if (ch === "=") drawOneWay(g, th, x * T, y * T);
  }
  lv._st = c; lv._stTheme = lv.theme;
  return c;
}

/* ================= world + physics ================= */
function makeWorld(lv) {
  const w = lv.w, h = lv.h, n = w * h;
  const W = { lv, w, h, tiles: lv.tiles, spikeDir: new Int8Array(n), crumbleT: new Float32Array(n), crumbleGone: new Float32Array(n),
    crumbling: new Set(), respawning: new Set(), crystals: new Map(), springT: new Map(), start: { x: 1, y: 1 } };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, c = lv.tiles[i];
    if (c === "^") W.spikeDir[i] = spikeDirOf(lv, x, y);
    else if (c === "*") W.crystals.set(i, { gone: 0 });
    else if (c === "P") W.start = { x, y };
  }
  return W;
}
function solidAt(W, tx, ty) {
  if (tx < 0 || tx >= W.w) return true;
  if (ty < 0 || ty >= W.h) return false;
  const i = ty * W.w + tx, c = W.tiles[i];
  return c === "#" || (c === "C" && W.crumbleGone[i] <= 0);
}
function hitSolid(W, x, y, w, h) {
  const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 1e-4) / T), y0 = Math.floor(y / T), y1 = Math.floor((y + h - 1e-4) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidAt(W, tx, ty)) return true;
  return false;
}
function oneWayRow(W, x, ty) {
  if (ty < 0 || ty >= W.h) return false;
  const x0 = Math.max(0, Math.floor(x / T)), x1 = Math.min(W.w - 1, Math.floor((x + PH.W - 1e-4) / T));
  for (let tx = x0; tx <= x1; tx++) if (W.tiles[ty * W.w + tx] === "=") return true;
  return false;
}
function makePlayer(W) {
  return { x: W.start.x * T + (T - PH.W) / 2, y: (W.start.y + 1) * T - PH.H, vx: 0, vy: 0, facing: 1, onGround: true,
    coyote: 0, jumpBuf: 0, dashBuf: 0, dashes: 1, dashTime: 0, dx: 0, dy: 0, wallLock: 0, varJump: false, wallSlide: 0,
    anim: 0, dead: false, done: false };
}
function stepWorld(W, p) {
  for (const i of W.crumbling) {
    W.crumbleT[i] -= DT;
    if (W.crumbleT[i] <= 0) { W.crumbleT[i] = 0; W.crumbleGone[i] = PH.CRUMBLE_RESPAWN; W.crumbling.delete(i); W.respawning.add(i); }
  }
  for (const i of W.respawning) {
    W.crumbleGone[i] -= DT;
    if (W.crumbleGone[i] <= 0) {
      const tx = i % W.w, ty = (i / W.w) | 0;
      if (p && overlap(p.x, p.y, PH.W, PH.H, tx * T, ty * T, T, T)) W.crumbleGone[i] = 0.05;
      else { W.crumbleGone[i] = 0; W.respawning.delete(i); }
    }
  }
  for (const c of W.crystals.values()) if (c.gone > 0) c.gone -= DT;
  for (const [i, v] of W.springT) { if (v - DT <= 0) W.springT.delete(i); else W.springT.set(i, v - DT); }
}

function stepPlayer(W, p, inp, ev) {
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const vdir = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  p.jumpBuf = inp.jumpP ? PH.JUMP_BUF : Math.max(0, p.jumpBuf - DT);
  p.dashBuf = inp.dashP ? PH.DASH_BUF : Math.max(0, p.dashBuf - DT);
  if (p.onGround) { p.coyote = PH.COYOTE; if (p.dashTime <= 0) p.dashes = 1; } else p.coyote = Math.max(0, p.coyote - DT);
  if (p.wallLock > 0) p.wallLock -= DT;
  p.wallSlide = 0;

  const wallR = hitSolid(W, p.x + PH.W, p.y + 1, PH.WALL_REACH, PH.H - 2);
  const wallL = hitSolid(W, p.x - PH.WALL_REACH, p.y + 1, PH.WALL_REACH, PH.H - 2);
  const touchR = hitSolid(W, p.x + PH.W, p.y + 1, 1, PH.H - 2);
  const touchL = hitSolid(W, p.x - 1, p.y + 1, 1, PH.H - 2);

  // start a dash
  if (p.dashBuf > 0 && p.dashes > 0 && p.dashTime <= 0) {
    let dx = dir, dy = vdir;
    if (!dx && !dy) dx = p.facing;
    const k = dx && dy ? Math.SQRT1_2 : 1;
    p.dx = dx * k; p.dy = dy * k; p.dashes = 0; p.dashTime = PH.DASH_TIME; p.dashBuf = 0; p.varJump = false;
    if (dx) p.facing = dx > 0 ? 1 : -1;
    ev.push("dash");
  }

  if (p.dashTime > 0) {
    if (p.jumpBuf > 0) {
      if ((p.onGround || p.coyote > 0) && p.dx !== 0 && p.dy >= 0) {
        const s = p.dx > 0 ? 1 : -1;
        if (p.dy > 0) { p.vx = s * PH.HYPER_VX; p.vy = -PH.JUMP_V * PH.HYPER_VY; ev.push("hyper"); }
        else { p.vx = s * PH.SUPER_VX; p.vy = -PH.JUMP_V; ev.push("super"); }
        p.dashTime = 0; p.dashes = 1; p.jumpBuf = 0; p.coyote = 0; p.varJump = true; p.onGround = false;
      } else if (!p.onGround && (wallL || wallR)) {
        const wd = wallR ? 1 : -1;
        if (p.dy < 0 && p.dx === 0) { p.vy = -PH.JUMP_V * PH.BOUNCE_VY; p.vx = -wd * 60; ev.push("bounce"); }
        else { p.vx = -wd * PH.WALL_JUMP_X; p.vy = -PH.WALL_JUMP_Y; ev.push("walljump"); }
        p.facing = -wd; p.dashTime = 0; p.jumpBuf = 0; p.wallLock = PH.WALL_LOCK; p.varJump = true;
      } else if (p.onGround || p.coyote > 0) {
        p.vy = -PH.JUMP_V; p.dashTime = 0; p.jumpBuf = 0; p.coyote = 0; p.varJump = true; p.onGround = false; ev.push("jump");
      }
    }
    if (p.dashTime > 0) {
      p.vx = p.dx * PH.DASH_V; p.vy = p.dy * PH.DASH_V;
      p.dashTime -= DT;
      if (p.dashTime <= 0) {
        p.dashTime = 0;
        p.vx = p.dx * PH.DASH_V * PH.DASH_END_X;
        p.vy = p.dy * PH.DASH_V * (p.dy < 0 ? PH.DASH_END_Y : 0.6);
      }
    }
  } else {
    if (p.wallLock <= 0) {
      if (dir !== 0) {
        if (Math.abs(p.vx) > PH.MAX_RUN && Math.sign(p.vx) === dir) p.vx = approach(p.vx, dir * PH.MAX_RUN, (p.onGround ? PH.OVER_GROUND : PH.OVER_AIR) * DT);
        else p.vx = approach(p.vx, dir * PH.MAX_RUN, (p.onGround ? PH.RUN_ACCEL : PH.AIR_ACCEL) * DT);
        p.facing = dir;
      } else p.vx = approach(p.vx, 0, (p.onGround ? PH.RUN_FRICTION : PH.AIR_FRICTION) * DT);
    }
    let g = PH.GRAVITY;
    if (Math.abs(p.vy) < PH.APEX_RANGE && inp.jump) g *= PH.APEX_MULT;
    p.vy += g * DT;
    let maxFall = inp.down ? PH.FAST_FALL : PH.FALL_MAX;
    if (!p.onGround && p.vy > 0 && ((touchR && dir > 0) || (touchL && dir < 0))) { maxFall = PH.WALL_SLIDE; p.wallSlide = touchR ? 1 : -1; }
    if (p.vy > maxFall) p.vy = approach(p.vy, maxFall, 1800 * DT);

    if (p.jumpBuf > 0) {
      if (p.onGround || p.coyote > 0) {
        p.vy = -PH.JUMP_V; if (dir) p.vx += dir * PH.JUMP_BOOST;
        p.jumpBuf = 0; p.coyote = 0; p.varJump = true; p.onGround = false; ev.push("jump");
      } else if (wallL || wallR) {
        const wd = wallL && wallR ? p.facing : wallR ? 1 : -1;
        p.vx = -wd * PH.WALL_JUMP_X; p.vy = -PH.WALL_JUMP_Y; p.facing = -wd; p.wallLock = PH.WALL_LOCK;
        p.jumpBuf = 0; p.varJump = true; ev.push("walljump");
      }
    }
    if (p.varJump) {
      if (p.vy >= 0) p.varJump = false;
      else if (!inp.jump) { p.vy = Math.max(p.vy, -PH.JUMP_CUT); p.varJump = false; }
    }
  }

  // move X
  let nx = p.x + p.vx * DT;
  if (hitSolid(W, nx, p.y, PH.W, PH.H)) {
    nx = p.vx > 0 ? Math.floor((nx + PH.W - 1e-4) / T) * T - PH.W : Math.floor(nx / T) * T + T;
    if (hitSolid(W, nx, p.y, PH.W, PH.H)) nx = p.x;
    p.vx = 0;
  }
  p.x = nx;

  // move Y
  const wasGround = p.onGround;
  let ny = p.y + p.vy * DT;
  if (p.vy > 0) {
    if (hitSolid(W, p.x, ny, PH.W, PH.H)) {
      ny = Math.floor((ny + PH.H - 1e-4) / T) * T - PH.H;
      if (hitSolid(W, p.x, ny, PH.W, PH.H)) ny = p.y;
      p.vy = 0;
    } else if (!inp.down) {
      const oldB = p.y + PH.H, newB = ny + PH.H, ty = Math.floor((newB - 1e-4) / T), top = ty * T;
      if (oldB <= top + 1e-4 && newB > top && oneWayRow(W, p.x, ty)) { ny = top - PH.H; p.vy = 0; }
    }
  } else if (p.vy < 0 && hitSolid(W, p.x, ny, PH.W, PH.H)) {
    let fixed = false;
    if (p.dashTime <= 0 || p.dx === 0) {
      for (const off of [1, -1, 2, -2, 3, -3]) {
        if (!hitSolid(W, p.x + off, ny, PH.W, PH.H) && !hitSolid(W, p.x + off, p.y, PH.W, PH.H)) { p.x += off; fixed = true; break; }
      }
    }
    if (!fixed) {
      ny = Math.floor(ny / T) * T + T;
      if (hitSolid(W, p.x, ny, PH.W, PH.H)) ny = p.y;
      p.vy = 0; p.varJump = false;
    }
  }
  p.y = ny;

  const foot = p.y + PH.H, fty = Math.round(foot / T);
  p.onGround = p.vy >= 0 && (hitSolid(W, p.x, foot, PH.W, 0.5) || (!inp.down && Math.abs(foot - fty * T) < 0.01 && oneWayRow(W, p.x, fty)));
  if (p.onGround && !wasGround) ev.push("land");
  if (p.onGround) {
    p.anim += Math.abs(p.vx) * DT;
    const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + PH.W - 1e-4) / T);
    if (fty >= 0 && fty < W.h) for (let tx = Math.max(0, x0); tx <= Math.min(W.w - 1, x1); tx++) {
      const i = fty * W.w + tx;
      if (W.tiles[i] === "C" && W.crumbleGone[i] <= 0 && !W.crumbling.has(i)) { W.crumbleT[i] = PH.CRUMBLE_DELAY; W.crumbling.add(i); }
    }
  } else p.anim += DT * 40;

  // hazards + triggers
  const x0 = Math.max(0, Math.floor(p.x / T) - 1), x1 = Math.min(W.w - 1, Math.floor((p.x + PH.W) / T) + 1);
  const y0 = Math.max(0, Math.floor(p.y / T) - 1), y1 = Math.min(W.h - 1, Math.floor((p.y + PH.H) / T) + 2);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const i = ty * W.w + tx, c = W.tiles[i], bx = tx * T, by = ty * T;
    if (c === "^") {
      const d = W.spikeDir[i];
      const r = d === 0 ? [bx + 1, by + 4, 6, 4] : d === 2 ? [bx + 1, by, 6, 4] : d === 1 ? [bx, by + 1, 4, 6] : [bx + 4, by + 1, 4, 6];
      if (overlap(p.x, p.y, PH.W, PH.H, r[0], r[1], r[2], r[3])) p.dead = true;
    } else if (c === "S") {
      if (p.vy >= 0 && overlap(p.x, p.y, PH.W, PH.H, bx, by + 4, T, 4)) {
        p.vy = -PH.SPRING_V; p.dashes = 1; p.dashTime = 0; p.varJump = false; p.coyote = 0; p.jumpBuf = 0; p.onGround = false;
        W.springT.set(i, 0.18); ev.push("spring");
      }
    } else if (c === "*") {
      const cr = W.crystals.get(i);
      if (cr && cr.gone <= 0 && p.dashes < 1 && overlap(p.x, p.y, PH.W, PH.H, bx - 2, by - 2, 12, 12)) {
        p.dashes = 1; cr.gone = PH.CRYSTAL_RESPAWN; ev.push("crystal");
      }
    } else if (c === "G") {
      if (overlap(p.x, p.y, PH.W, PH.H, bx + 1, by - 8, 6, 16)) p.done = true;
    }
  }
  if (p.y > W.h * T + 24) p.dead = true;
}

/* ================= game session ================= */
const canvas = $("#game"), ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const ui = $("#ui"), hud = $("#hud"), timerEl = $("#timer"), subEl = $("#sub"), bannerEl = $("#banner"), splitsEl = $("#splits");

const G = {
  state: "menu", mode: null, idx: 0, lv: null, key: null, W: null, p: null,
  steps: 0, started: false, runSteps: 0, levelSteps: 0, splits: [], goldHit: [], runGhosts: [],
  deadT: 0, rec: [], ghost: null, cam: { x: 0, y: 0 }, shake: 0, parts: [], trail: [], simN: 0, bannerT: 0, back: "title", customId: null,
};
const DEMO = { W: null, t: 0 };

function setBanner(top, name) { bannerEl.innerHTML = `<small>${esc(top)}</small>${esc(name)}`; G.bannerT = 2.2; }
function loadLevel(lv) {
  G.lv = lv; G.W = makeWorld(lv); G.p = makePlayer(G.W);
  G.rec = []; G.deadT = 0; G.trail = []; G.parts = [];
  staticLayer(lv); syncHeld(); updateCamera(0, true);
}
function respawn() {
  G.W = makeWorld(G.lv); G.p = makePlayer(G.W); G.rec = []; G.trail = []; G.deadT = 0;
  if (G.mode === "run") G.levelSteps = 0; else { G.steps = 0; G.started = false; }
  syncHeld(); updateCamera(0, true);
}
function play() { G.state = "play"; hideUI(); setTouch(); canvas.focus({ preventScroll: true }); }

function startIL(i) {
  G.mode = "il"; G.idx = i; G.key = "b" + i; G.back = "levels";
  loadLevel(BASE[i]); G.steps = 0; G.started = false;
  G.ghost = settings.ghost ? ghostDecode(store.get("g." + G.key, null)) : null;
  setBanner("LEVEL " + (i + 1), BASE[i].name); play();
}
function startCustom(entry) {
  let lv; try { lv = entryLevel(entry); } catch { showCustom("That level couldn't be loaded."); return; }
  if (problems(lv)) { showCustom("That level has no start or goal yet. Edit it first."); return; }
  G.mode = "custom"; G.customId = entry.id; G.key = "c" + entry.k; G.back = "custom";
  loadLevel(lv); G.steps = 0; G.started = false;
  G.ghost = settings.ghost ? ghostDecode(store.get("g." + G.key, null)) : null;
  setBanner("CUSTOM", lv.name); play();
}
function startTest(lv) {
  G.mode = "test"; G.key = null; G.back = "edreturn"; G.ghost = null;
  loadLevel(lv); G.steps = 0; G.started = false;
  setBanner("TEST PLAY", lv.name); showEdBars(false); play();
}
function startRun() {
  G.mode = "run"; G.back = "title"; G.runSteps = 0; G.started = false; G.splits = []; G.goldHit = []; G.runGhosts = [];
  startRunLevel(0); play();
}
function startRunLevel(i) {
  G.idx = i; loadLevel(BASE[i]); G.levelSteps = 0;
  G.ghost = settings.ghost && runPB ? ghostDecode(store.get("rg." + i, null)) : null;
  setBanner(`LEVEL ${i + 1} / ${BASE.length}`, BASE[i].name); renderSplits();
}
function restartLevel() {
  if (!G.mode || G.state === "runend") return;
  respawn(); play();
}
function die() {
  const p = G.p; SFX.death();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    G.parts.push({ x: p.x + 3, y: p.y + 5, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.45, max: 0.45, c: i & 1 ? "#ff4fa3" : "#5b6ee1", s: 2, g: 0 });
  }
  if (settings.shake) G.shake = 0.25;
  G.deadT = 18;
}
function finish() {
  const p = G.p;
  for (let i = 0; i < 18; i++) G.parts.push({ x: p.x + 3, y: p.y, vx: (Math.random() - 0.5) * 140, vy: -60 - Math.random() * 120, life: 0.8, max: 0.8, c: ["#ffd23f", "#ff4fa3", "#4fd6e8", "#8be26b"][i & 3], s: 1, g: 300 });
  if (G.mode === "run") {
    const i = G.idx, t = G.runSteps;
    G.splits.push(t);
    const seg = t - (i ? G.splits[i - 1] : 0);
    G.goldHit[i] = golds[i] == null || seg < golds[i];
    if (G.goldHit[i]) { golds[i] = seg; store.set("golds", golds); }
    G.runGhosts[i] = G.rec.slice();
    if (i < BASE.length - 1) { SFX.split(); startRunLevel(i + 1); return; }
    const prev = runPB, pb = !prev || t < prev.total;
    if (pb) {
      runPB = { total: t, splits: G.splits.slice() }; store.set("runpb", runPB);
      G.runGhosts.forEach((r, k) => store.set("rg." + k, ghostEncode(r)));
      SFX.pb();
    } else SFX.finish();
    G.state = "runend"; renderSplits(); showRunEnd(pb, prev);
    return;
  }
  G.state = "result";
  const t = G.steps;
  if (G.mode === "test") { SFX.finish(); showResult(t, null, false); return; }
  const prev = bests[G.key], nb = prev == null || t < prev;
  if (nb) {
    bests[G.key] = t; store.set("bests", bests);
    store.set("g." + G.key, ghostEncode(G.rec));
    G.ghost = Int16Array.from(G.rec);
    if (prev != null) SFX.pb(); else SFX.finish();
  } else SFX.finish();
  showResult(t, prev, nb);
}

/* input */
const KEYMAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  Space: "jump", KeyZ: "jump", KeyK: "jump", KeyC: "jump", KeyX: "dash", KeyJ: "dash", ShiftLeft: "dash", ShiftRight: "dash", KeyL: "dash" };
const ACTS = ["left", "right", "up", "down", "jump", "dash"];
const kb = {}, pad = {}, tch = {}, tap = { jump: false, dash: false }, prevHeld = { jump: false, dash: false };
ACTS.forEach((k) => { kb[k] = pad[k] = tch[k] = false; });
const held = (k) => kb[k] || pad[k] || tch[k];
function syncHeld() { prevHeld.jump = held("jump"); prevHeld.dash = held("dash"); tap.jump = tap.dash = false; }
function readInput() {
  const i = {};
  for (const k of ACTS) i[k] = held(k);
  i.jumpP = (i.jump && !prevHeld.jump) || tap.jump;
  i.dashP = (i.dash && !prevHeld.dash) || tap.dash;
  tap.jump = tap.dash = false; prevHeld.jump = i.jump; prevHeld.dash = i.dash;
  return i;
}

function simStep() {
  const inp = readInput();
  G.simN++;
  if (G.deadT > 0) {
    if (G.mode === "run" && G.started) G.runSteps++;
    stepWorld(G.W, null);
    if (--G.deadT === 0) respawn();
    return;
  }
  if (!G.started && (inp.left || inp.right || inp.up || inp.down || inp.jump || inp.dash)) G.started = true;
  let tick = -1;
  if (G.started) {
    if (G.mode === "run") { G.runSteps++; tick = G.levelSteps++; } else tick = G.steps++;
  }
  stepWorld(G.W, G.p);
  const ev = [];
  stepPlayer(G.W, G.p, inp, ev);
  const p = G.p;
  if (tick >= 0 && (tick & 1) === 0 && G.rec.length < 3 * 36000) {
    G.rec.push(Math.round(p.x * 4), Math.round(p.y * 4), (p.facing > 0 ? 1 : 0) | (animState(p) << 1) | (animFrame(p) << 4) | ((p.dashes > 0 ? 1 : 0) << 6));
  }
  if (p.dashTime > 0 && G.simN % 3 === 0) G.trail.push({ x: p.x, y: p.y, f: p.facing, st: 5, fr: 0, life: 0.22 });
  for (const e of ev) effect(e);
  if (p.dead) die();
  else if (p.done) finish();
}
function dust(x, y, n) { for (let i = 0; i < n; i++) G.parts.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 30, life: 0.3, max: 0.3, c: "rgba(255,255,255,.7)", s: 1, g: 60 }); }
function sparks(x, y, c, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; G.parts.push({ x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 0.35, max: 0.35, c, s: 1, g: 0 }); } }
function effect(e) {
  const p = G.p, fx = p.x + 3, fy = p.y + PH.H;
  if (e === "jump") { SFX.jump(); dust(fx, fy, 4); }
  else if (e === "walljump" || e === "bounce") { SFX.wall(); dust(p.facing > 0 ? p.x : p.x + PH.W, p.y + 6, 4); }
  else if (e === "super" || e === "hyper") { SFX.super(); dust(fx, fy, 9); }
  else if (e === "dash") { SFX.dash(); if (settings.shake) G.shake = Math.max(G.shake, 0.05); }
  else if (e === "land") { SFX.land(); dust(fx, fy, 3); }
  else if (e === "spring") { SFX.spring(); sparks(fx, fy, "#ff9aa5", 8); }
  else if (e === "crystal") { SFX.crystal(); sparks(fx, p.y + 5, "#7af5ff", 10); }
}

/* ================= rendering ================= */
function updateCamera(dt, snap) {
  const W = G.W, p = G.p; if (!W || !p) return;
  const tx = p.x + PH.W / 2 - VW / 2 + clamp(p.vx * 0.3, -48, 48), ty = p.y + PH.H / 2 - VH / 2 + 8;
  G.cam.x += (tx - G.cam.x) * (snap ? 1 : Math.min(1, dt * 7));
  G.cam.y += (ty - G.cam.y) * (snap ? 1 : Math.min(1, dt * 5));
  const lw = W.w * T, lh = W.h * T;
  G.cam.x = lw <= VW ? (lw - VW) / 2 : clamp(G.cam.x, 0, lw - VW);
  G.cam.y = lh <= VH ? (lh - VH) / 2 : clamp(G.cam.y, 0, lh - VH);
}
function blitRegion(img, sx, sy) {
  const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(img.width, sx + VW), y1 = Math.min(img.height, sy + VH);
  if (x1 > x0 && y1 > y0) ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
}
function drawDynamic(W, cx, cy, t, n) {
  const x0 = Math.max(0, Math.floor(cx / T) - 1), x1 = Math.min(W.w - 1, Math.floor((cx + VW) / T) + 1);
  const y0 = Math.max(0, Math.floor(cy / T) - 1), y1 = Math.min(W.h - 1, Math.floor((cy + VH) / T) + 2);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W.w + x, c = W.tiles[i];
    if (c === "C") drawCrumble(ctx, x * T, y * T, W.crumbleGone[i] > 0 ? 2 : W.crumbling.has(i) ? 1 : 0, n);
    else if (c === "S") drawSpring(ctx, x * T, y * T, W.springT.has(i));
    else if (c === "*") { const cr = W.crystals.get(i); drawCrystal(ctx, x * T + 4, y * T + 4 + Math.round(Math.sin(t * 3 + x) * 1.2), cr && cr.gone > 0); }
    else if (c === "G") drawGoal(ctx, x * T, y * T, t + x);
  }
}
let renderT = 0, frameN = 0;
function renderGame(dt) {
  renderT += dt; frameN++;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const inLevel = G.W && G.mode && ["play", "paused", "result", "runend"].includes(G.state);
  let W, cx, cy;
  if (inLevel) {
    W = G.W;
    if (G.state === "play") updateCamera(dt, false);
    cx = G.cam.x; cy = G.cam.y;
  } else {
    W = DEMO.W; DEMO.t += dt;
    const lw = W.w * T, lh = W.h * T;
    cx = Math.max(0, lw - VW) * (0.5 - 0.5 * Math.cos(DEMO.t * 0.05)); cy = Math.max(0, lh - VH) * 0.85;
  }
  drawBg(W.lv.theme, cx, cy);
  let sx = 0, sy = 0;
  if (G.shake > 0 && inLevel) { G.shake = Math.max(0, G.shake - dt); const m = Math.ceil(G.shake * 10); sx = Math.round((Math.random() - 0.5) * m); sy = Math.round((Math.random() - 0.5) * m); }
  const rx = Math.round(cx), ry = Math.round(cy);
  ctx.translate(-rx + sx, -ry + sy);
  blitRegion(staticLayer(W.lv), rx, ry);
  drawDynamic(W, rx, ry, renderT, frameN);
  if (inLevel) {
    // ghost
    if (G.ghost && G.ghost.length >= 3 && settings.ghost && G.mode !== "test") {
      const tick = G.mode === "run" ? G.levelSteps : G.steps;
      const k = Math.min(Math.floor((G.started ? tick : 0) / 2), G.ghost.length / 3 - 1) * 3;
      const f = G.ghost[k + 2];
      drawPlayer(ctx, G.ghost[k] / 4, G.ghost[k + 1] / 4, f & 1 ? 1 : -1, (f >> 1) & 7, (f >> 4) & 3, (f >> 6) & 1, true);
    }
    // dash trail
    for (let i = G.trail.length - 1; i >= 0; i--) {
      const tr = G.trail[i]; tr.life -= dt;
      if (tr.life <= 0) { G.trail.splice(i, 1); continue; }
      ctx.globalAlpha = (tr.life / 0.22) * 0.5;
      drawPlayer(ctx, tr.x, tr.y, tr.f, 5, 0, 0, false);
      ctx.globalAlpha = 1;
    }
    const p = G.p;
    if (!p.dead && G.deadT === 0) drawPlayer(ctx, p.x, p.y, p.facing, animState(p), animFrame(p), p.dashes, false);
    // particles
    const pdt = G.state === "play" ? dt : 0;
    for (let i = G.parts.length - 1; i >= 0; i--) {
      const q = G.parts[i]; q.life -= pdt;
      if (q.life <= 0) { G.parts.splice(i, 1); continue; }
      q.x += q.vx * pdt; q.y += q.vy * pdt; q.vy += q.g * pdt;
      ctx.globalAlpha = Math.min(1, (q.life / q.max) * 1.5); ctx.fillStyle = q.c;
      ctx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s);
    }
    ctx.globalAlpha = 1;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/* ================= HUD ================= */
let subCache = "";
function updateHud(dt) {
  const showing = G.mode && G.state !== "menu" && G.state !== "editor";
  hud.hidden = !showing;
  if (!showing) return;
  const s = fmt(G.mode === "run" ? G.runSteps : G.steps);
  if (timerEl.textContent !== s) timerEl.textContent = s;
  timerEl.classList.toggle("stopped", G.state === "result" || G.state === "runend");
  let sub;
  if (G.mode === "run") sub = `LEVEL ${G.idx + 1}/${BASE.length}` + (runPB ? `<br>PB ${fmt(runPB.total)}` : "");
  else if (G.mode === "test") sub = "TEST PLAY";
  else sub = bests[G.key] != null ? `BEST ${fmt(bests[G.key])}` : "NO BEST YET";
  if (!G.started && G.state === "play" && (G.mode !== "run" || G.idx === 0)) sub += "<br>MOVE TO START";
  if (sub !== subCache) { subEl.innerHTML = sub; subCache = sub; }
  if (G.bannerT > 0) { G.bannerT -= dt; bannerEl.classList.toggle("on", G.bannerT > 0.4); }
  else bannerEl.classList.remove("on");
}
function sumOfBests() {
  let s = 0;
  for (let i = 0; i < BASE.length; i++) { const b = bests["b" + i]; if (b == null) return null; s += b; }
  return s;
}
function renderSplits() {
  if (G.mode !== "run" || !settings.splits) { splitsEl.hidden = true; return; }
  splitsEl.hidden = false;
  const rows = BASE.map((lv, i) => {
    let cls = "", d = "", t;
    if (i < G.splits.length) {
      cls = "done"; t = fmt(G.splits[i]);
      const pt = runPB && runPB.splits[i];
      const dc = G.goldHit[i] ? "gold" : "";
      if (pt != null && G.state !== "runend") { const dd = G.splits[i] - pt; d = `<span class="${dc || (dd < 0 ? "ahead" : "behind")}">${fmtDelta(dd)}</span>`; }
      else if (G.goldHit[i]) d = `<span class="gold">★</span>`;
    } else {
      if (i === G.idx && G.state !== "runend") cls = "cur";
      t = runPB ? fmt(runPB.splits[i]) : "-";
    }
    return `<li class="${cls}"><span>${i + 1}. ${esc(lv.name)}</span><span class="d">${d}</span><span class="t">${t}</span></li>`;
  });
  let sob = 0; for (let i = 0; i < BASE.length; i++) { if (golds[i] == null) { sob = null; break; } sob += golds[i]; }
  rows.push(`<li class="sum"><span>Best possible</span><span class="d"></span><span class="t">${sob == null ? "-" : fmt(sob)}</span></li>`);
  splitsEl.innerHTML = rows.join("");
}

/* ================= menus ================= */
let lastDevice = "kb", usedTouch = matchMedia("(pointer: coarse)").matches;
function show(html, opts = {}) {
  ui.innerHTML = `<div class="screen ${opts.cls || ""}" data-back="${opts.back || ""}">${html}</div>`;
  ui.hidden = false; setTouch();
  const el = (opts.focus && ui.querySelector(opts.focus)) || ui.querySelector("[autofocus]") || ui.querySelector("button");
  if (el && !usedTouch) el.focus({ preventScroll: true });
}
function hideUI() { ui.innerHTML = ""; ui.hidden = true; }
function menuState() { G.state = "menu"; G.mode = null; splitsEl.hidden = true; showEdBars(false); }

function showTitle() {
  menuState();
  show(`<div class="logo">MOMENTUM</div><div class="tag">a speedrun platformer</div>
    <div class="menu">
      <button class="primary" data-a="run" autofocus>Full run <span class="r">${runPB ? fmt(runPB.total) : "--"}</span></button>
      <button data-a="levels">Level select</button>
      <button data-a="custom">Custom levels</button>
      <button data-a="newlevel">Level editor</button>
      <button data-a="settings">Settings and controls</button>
      <button data-a="save">Save data</button>
    </div>
    <p class="note kbd-only"><b>Arrows/WASD</b> move · <b>Space/Z</b> jump · <b>X/Shift</b> dash · <b>R</b> restart</p>`);
}
function showLevels(focusIdx) {
  menuState();
  const cards = BASE.map((lv, i) => {
    const b = bests["b" + i];
    return `<button data-a="level" data-i="${i}"${i === (focusIdx ?? 0) ? " autofocus" : ""}><span class="n">${i + 1}</span><span class="nm">${esc(lv.name)}</span><span class="bt ${b != null ? "has" : ""}">${b != null ? fmt(b) : "--:--.---"}</span></button>`;
  }).join("");
  const sob = sumOfBests();
  show(`<h2>Level select</h2><div class="grid10">${cards}</div>
    <p class="note">Sum of best times: <b>${sob == null ? "beat every level" : fmt(sob)}</b></p>
    <div class="row"><button data-a="title">Back</button></div>`, { back: "title", cls: "solid" });
}
function showCustom(msg) {
  menuState();
  const items = customs.map((c) => {
    const b = bests["c" + c.k];
    return `<div class="item"><div class="info"><div class="nm">${esc(c.name)}</div><div class="meta">${c.w}x${c.h} · ${c.mine ? "yours" : "imported"} · best ${b != null ? fmt(b) : "--"}</div></div>
      <button class="small primary" data-a="cplay" data-id="${esc(c.id)}">Play</button><button class="small" data-a="cedit" data-id="${esc(c.id)}">Edit</button><button class="small" data-a="cshare" data-id="${esc(c.id)}">Share</button><button class="small danger" data-a="cdel" data-id="${esc(c.id)}">Delete</button></div>`;
  }).join("") || `<p class="note">No custom levels yet. Make one in the editor, or import a code a friend sent you.</p>`;
  show(`<h2>Custom levels</h2><div class="list">${items}</div>${msg ? `<div class="msg">${esc(msg)}</div>` : ""}
    <div class="row"><button class="primary" data-a="newlevel" autofocus>New level</button><button data-a="import">Import code</button><button data-a="title">Back</button></div>`, { back: "title", cls: "solid" });
}
function showImport() {
  menuState();
  show(`<h2>Import a level</h2><p class="note">Paste a level code. It starts with <b>MOMENTUM-LEVEL:</b></p>
    <textarea id="codeIn" spellcheck="false" placeholder="MOMENTUM-LEVEL:..."></textarea><div class="msg" id="impMsg"></div>
    <div class="row"><button class="primary" data-a="doimport" autofocus>Import</button><button data-a="pastein">Paste from clipboard</button><button data-a="custom">Back</button></div>`, { back: "custom", cls: "solid" });
}
function showShare(lv, back) {
  if (back === "edreturn") showEdBars(false);
  const code = levelToCode(lv);
  show(`<h2>Share "${esc(lv.name)}"</h2><p class="note">Copy this code and send it to anyone. They paste it in <b>Custom levels → Import code</b>.</p>
    <textarea id="codeOut" readonly spellcheck="false">${esc(code)}</textarea><div class="msg" id="shareMsg"></div>
    <div class="row"><button class="primary" data-a="copy" data-t="codeOut" data-m="shareMsg" autofocus>Copy code</button><button data-a="${back}">Back</button></div>`, { back, cls: "solid" });
}
function showSettings(focusKey) {
  menuState();
  const on = (v) => (v ? "ON" : "OFF");
  show(`<h2>Settings</h2><div class="menu">
      <button class="opt" data-a="toggle" data-k="splits">Splits in full run <b>${on(settings.splits)}</b></button>
      <button class="opt" data-a="toggle" data-k="ghost">Ghost <b>${on(settings.ghost)}</b></button>
      <button class="opt" data-a="toggle" data-k="touch">Touch controls <b>${settings.touch.toUpperCase()}</b></button>
      <button class="opt" data-a="toggle" data-k="shake">Screen shake <b>${on(settings.shake)}</b></button>
      <button class="opt" data-a="toggle" data-k="sfx">Sound <b>${on(settings.sfx)}</b></button>
    </div>
    <div class="keys">
      <span>Move</span><span>Arrows / WASD · stick / d-pad</span>
      <span>Jump</span><span>Space / Z / K · A</span>
      <span>Dash</span><span>X / Shift / J · B, X or RB (aim with a direction)</span>
      <span>Restart level</span><span>R · Y</span>
      <span>Reset run</span><span>Backspace · Back/Select</span>
      <span>Pause</span><span>Esc / P · Start</span>
    </div>
    <p class="note">Speed tech: dash along the ground and jump during it for a long, fast <b>super jump</b>. Dash diagonally down into the ground and jump for an even faster <b>hyper</b>. Jumping the moment you land keeps your speed. Hold jump at the top of a jump to float a little.</p>
    <div class="row"><button data-a="title">Back</button></div>`, { back: "title", cls: "solid", focus: focusKey ? `[data-k="${focusKey}"]` : null });
}
function showSave(msg) {
  menuState();
  show(`<h2>Save data</h2><p class="note">This code holds your best times, PB splits, custom levels and settings (not ghosts). Copy it to back up or move to another browser.</p>
    <textarea id="saveOut" readonly spellcheck="false">${esc(exportSave())}</textarea>
    <div class="row"><button class="primary" data-a="copy" data-t="saveOut" data-m="saveMsg" autofocus>Copy save code</button></div>
    <div class="msg" id="saveMsg">${msg ? esc(msg) : ""}</div>
    <p class="note">Load a save code. This replaces your current times and levels.</p>
    <textarea id="saveIn" spellcheck="false" placeholder="MOMENTUM-SAVE:..."></textarea>
    <div class="row"><button data-a="loadsave">Load save code</button><button data-a="title">Back</button></div>`, { back: "title", cls: "solid" });
}
function showPause() {
  if (G.state !== "play") return;
  G.state = "paused"; setTouch();
  show(`<h2>Paused</h2><div class="menu">
      <button class="primary" data-a="resume" autofocus>Resume</button>
      <button data-a="restart">Restart level<span class="r kbd-only">R</span></button>
      ${G.mode === "run" ? `<button data-a="reset">Reset run<span class="r kbd-only">Bksp</span></button>` : ""}
      <button data-a="quit">${G.mode === "test" ? "Back to editor" : "Quit"}</button></div>`, { back: "resume", cls: "dim" });
}
function showResult(t, prev, nb) {
  const next = G.mode === "il" && G.idx < BASE.length - 1;
  let info;
  if (G.mode === "test") info = `<p class="note">Test play: times are saved when you play it from Custom levels.</p>`;
  else if (prev != null) { const d = t - prev; info = `<div class="delta ${d < 0 ? "ahead" : d > 0 ? "behind" : ""}">${fmtDelta(d)} vs best ${fmt(prev)}</div>`; }
  else info = `<p class="note">First clear! Your ghost will race you next time.</p>`;
  show(`<h2 class="big">${nb && prev != null ? "New best!" : "Clear!"}</h2><div class="bigtime">${fmt(t)}</div>${info}
    <div class="row">${next ? `<button class="primary" data-a="next" autofocus>Next level</button>` : ""}
      <button data-a="retry"${next ? "" : " autofocus"}>Retry<span class="kbd-only"> (R)</span></button>
      <button data-a="quit">${G.mode === "test" ? "Back to editor" : "Back"}</button></div>`, { back: "quit", cls: "dim" });
}
function showRunEnd(pb, prev) {
  const rows = BASE.map((lv, i) => {
    const t = G.splits[i], seg = t - (i ? G.splits[i - 1] : 0), pt = prev && prev.splits[i], d = pt != null ? t - pt : null;
    const cls = G.goldHit[i] ? "gold" : d == null ? "" : d < 0 ? "ahead" : "behind";
    return `<tr><td>${i + 1}. ${esc(lv.name)}</td><td>${fmt(seg)}</td><td>${fmt(t)}</td><td class="${cls}">${d == null ? (G.goldHit[i] ? "★" : "") : fmtDelta(d)}</td></tr>`;
  }).join("");
  const d = prev ? G.runSteps - prev.total : null;
  show(`<h2 class="big">${pb && prev ? "New PB!" : "Run complete!"}</h2><div class="bigtime">${fmt(G.runSteps)}</div>
    ${prev ? `<div class="delta ${d < 0 ? "ahead" : "behind"}">${fmtDelta(d)} vs PB ${fmt(prev.total)}</div>` : ""}
    <table class="sp"><tr><th>Level</th><th>Segment</th><th>Split</th><th>vs PB</th></tr>${rows}</table>
    <div class="row"><button class="primary" data-a="run" autofocus>Run again</button><button data-a="title">Menu</button></div>`, { back: "title", cls: "solid" });
}
function quitLevel() {
  if (G.mode === "test") return returnToEditor();
  if (G.mode === "il") return showLevels(G.idx);
  if (G.mode === "custom") return showCustom();
  return showTitle();
}
function copyFrom(id, msgId) {
  const ta = document.getElementById(id), m = document.getElementById(msgId);
  const done = (ok) => { if (m) { m.textContent = ok ? "Copied!" : "Select the code and copy it yourself (Ctrl+C)."; m.classList.toggle("err", !ok); } };
  const fallback = () => { try { ta.focus(); ta.select(); done(document.execCommand("copy")); } catch { done(false); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(() => done(true), fallback);
  else fallback();
}
function findCustom(id) { return customs.find((c) => c.id === id); }

function act(a, d = {}) {
  audio();
  switch (a) {
    case "title": return showTitle();
    case "levels": return showLevels();
    case "level": return startIL(+d.i);
    case "run": return startRun();
    case "custom": return showCustom();
    case "import": return showImport();
    case "settings": return showSettings();
    case "save": return showSave();
    case "newlevel": return openEditor(null);
    case "cplay": { const e = findCustom(d.id); return e ? startCustom(e) : showCustom(); }
    case "cedit": { const e = findCustom(d.id); return e ? openEditor(e) : showCustom(); }
    case "cshare": {
      const e = findCustom(d.id); if (!e) return showCustom();
      const lv = entryLevel(e), pr = problems(lv);
      return pr ? showCustom("Can't share yet: " + pr) : showShare(lv, "custom");
    }
    case "cdel": {
      const b = ui.querySelector(`[data-a="cdel"][data-id="${CSS.escape(d.id)}"]`);
      if (b) { b.textContent = "Sure?"; b.dataset.a = "cdel2"; b.focus(); }
      return;
    }
    case "cdel2": customs = customs.filter((c) => c.id !== d.id); saveCustoms(); return showCustom("Deleted.");
    case "pastein": {
      const ta = $("#codeIn"), m = $("#impMsg");
      if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then((t) => { ta.value = t; m.textContent = ""; }, () => { m.textContent = "Paste with Ctrl+V (or long-press) instead."; });
      else m.textContent = "Paste with Ctrl+V (or long-press) instead.";
      return;
    }
    case "doimport": {
      const m = $("#impMsg");
      try {
        const lv = codeToLevel($("#codeIn").value), k = levelKey(lv);
        const dup = customs.find((c) => c.k === k);
        if (dup) return showCustom(`"${dup.name}" is already in your list.`);
        customs.unshift(makeEntry(lv, null, false)); saveCustoms();
        return showCustom(`Imported "${lv.name}".`);
      } catch (err) { m.textContent = err.message; m.classList.add("err"); return; }
    }
    case "copy": return copyFrom(d.t, d.m);
    case "toggle": {
      const k = d.k;
      if (k === "touch") settings.touch = settings.touch === "auto" ? "on" : settings.touch === "on" ? "off" : "auto";
      else settings[k] = !settings[k];
      saveSettings(); return showSettings(k);
    }
    case "loadsave": {
      const b = ui.querySelector('[data-a="loadsave"]');
      if (b && !b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Press again to replace your data"; return; }
      try { importSave($("#saveIn").value); return showSave("Save loaded."); }
      catch (err) { const m = $("#saveMsg"); m.textContent = err.message; m.classList.add("err"); if (b) { delete b.dataset.armed; b.textContent = "Load save code"; } return; }
    }
    case "resume": G.state = "play"; hideUI(); setTouch(); syncHeld(); canvas.focus({ preventScroll: true }); return;
    case "restart": case "retry": return restartLevel();
    case "reset": return startRun();
    case "next": return startIL(G.idx + 1);
    case "quit": return quitLevel();
    case "edreturn": return returnToEditor();
  }
}
ui.addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b) act(b.dataset.a, b.dataset); });

function focusables() { return [...ui.querySelectorAll("button, textarea, input, select")].filter((el) => el.offsetParent !== null); }
function moveFocus(vert, horiz) {
  const list = focusables(); if (!list.length) return;
  const cur = document.activeElement, i = list.indexOf(cur);
  if (i < 0) { list[0].focus(); return; }
  const inGrid = cur.parentElement && cur.parentElement.classList.contains("grid10");
  const step = vert ? vert * (inGrid ? 5 : 1) : horiz;
  let j = i + step;
  if (inGrid && vert && (j < 0 || j >= list.length || !list[j].parentElement.classList.contains("grid10"))) j = i + vert;
  list[(j + list.length) % list.length].focus();
}
function uiBack() { const s = ui.firstElementChild; const b = s && s.dataset.back; if (b) act(b); }

/* ================= touch ================= */
const touchEl = $("#touch"), stick = $("#stick"), knob = $("#knob");
function setTouch() {
  document.body.classList.toggle("touch", usedTouch);
  const want = settings.touch === "on" || (settings.touch === "auto" && usedTouch);
  touchEl.hidden = !(want && G.state === "play");
}
let stickId = null;
function stickMove(e) {
  const r = stick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const rad = r.width / 2, len = Math.hypot(dx, dy);
  tch.left = tch.right = tch.up = tch.down = false;
  if (len > rad * 0.22) { const nx = dx / len, ny = dy / len; tch.right = nx > 0.38; tch.left = nx < -0.38; tch.down = ny > 0.5; tch.up = ny < -0.5; }
  const k = Math.min(len, rad * 0.6) / (len || 1);
  knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
}
stick.addEventListener("pointerdown", (e) => { e.preventDefault(); stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); });
stick.addEventListener("pointermove", (e) => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = (e) => { if (e.pointerId !== stickId) return; stickId = null; tch.left = tch.right = tch.up = tch.down = false; knob.style.transform = ""; };
stick.addEventListener("pointerup", stickEnd); stick.addEventListener("pointercancel", stickEnd);
function bindTouchBtn(el, key) {
  el.addEventListener("pointerdown", (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); tch[key] = true; tap[key] = true; el.classList.add("on"); audio(); });
  const up = () => { tch[key] = false; el.classList.remove("on"); };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); el.addEventListener("lostpointercapture", up);
}
bindTouchBtn($("#tJump"), "jump"); bindTouchBtn($("#tDash"), "dash");
$("#tPause").addEventListener("pointerdown", (e) => { e.preventDefault(); showPause(); });
$("#tRestart").addEventListener("pointerdown", (e) => { e.preventDefault(); restartLevel(); });
addEventListener("pointerdown", (e) => {
  audio();
  if (e.pointerType === "touch") { if (!usedTouch) { usedTouch = true; setTouch(); } lastDevice = "touch"; }
  else if (e.pointerType === "mouse" && usedTouch && lastDevice === "touch") { lastDevice = "mouse"; }
}, true);

/* ================= keyboard ================= */
addEventListener("keydown", (e) => {
  audio();
  lastDevice = "kb";
  const tg = e.target, typing = tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.tagName === "SELECT");
  if (G.state === "editor" && ui.hidden) { if (typing) { if (e.code === "Escape") tg.blur(); return; } editorKey(e, true); return; }
  if (typing) { if (e.code === "Escape") tg.blur(); return; }
  const k = KEYMAP[e.code];
  if (G.state === "play") {
    if (k) { kb[k] = true; if (!e.repeat && (k === "jump" || k === "dash")) tap[k] = true; e.preventDefault(); return; }
    if (e.repeat) return;
    if (e.code === "KeyR") { restartLevel(); e.preventDefault(); }
    else if (e.code === "Backspace" && G.mode === "run") { startRun(); e.preventDefault(); }
    else if (e.code === "Escape" || e.code === "KeyP") { showPause(); e.preventDefault(); }
    return;
  }
  if (k) kb[k] = true;
  if (ui.hidden || e.repeat && !e.code.startsWith("Arrow")) return;
  if (e.code === "KeyR" && (G.state === "result" || G.state === "paused")) { restartLevel(); e.preventDefault(); return; }
  if (e.code === "Backspace" && G.mode === "run" && G.state === "paused") { startRun(); e.preventDefault(); return; }
  if (e.code === "Escape" || (e.code === "KeyP" && G.state === "paused")) { uiBack(); e.preventDefault(); return; }
  if (e.code === "ArrowUp") { moveFocus(-1, 0); e.preventDefault(); }
  else if (e.code === "ArrowDown") { moveFocus(1, 0); e.preventDefault(); }
  else if (e.code === "ArrowLeft") { moveFocus(0, -1); e.preventDefault(); }
  else if (e.code === "ArrowRight") { moveFocus(0, 1); e.preventDefault(); }
});
addEventListener("keyup", (e) => {
  const k = KEYMAP[e.code]; if (k) kb[k] = false;
  if (G.state === "editor") editorKey(e, false);
});
addEventListener("blur", () => { ACTS.forEach((k) => { kb[k] = false; }); for (const k in ED.keys) ED.keys[k] = false; if (G.state === "play") showPause(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && G.state === "play") showPause(); });

/* ================= gamepad ================= */
let padPrev = {}, navDir = 0, navRepeat = 0;
function pollPad(dt) {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const g of gps) if (g && g.connected && g.buttons && g.buttons.length) { gp = g; break; }
  const s = { left: false, right: false, up: false, down: false, jump: false, dash: false, y: false, start: false, select: false, a: false, b: false };
  if (gp) {
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    s.left = btn(14) || ax < -0.4; s.right = btn(15) || ax > 0.4; s.up = btn(12) || ay < -0.5; s.down = btn(13) || ay > 0.5;
    s.jump = btn(0); s.dash = btn(1) || btn(2) || btn(5) || btn(7);
    s.y = btn(3); s.start = btn(9); s.select = btn(8); s.a = btn(0); s.b = btn(1);
  }
  const edge = (k) => s[k] && !padPrev[k];
  if (gp && Object.values(s).some(Boolean)) lastDevice = "pad";
  for (const k of ACTS) pad[k] = s[k];
  if (G.state === "play") {
    if (edge("jump")) tap.jump = true;
    if (edge("dash")) tap.dash = true;
    if (edge("y")) restartLevel();
    else if (edge("start")) showPause();
    else if (edge("select") && G.mode === "run") startRun();
  } else if (!ui.hidden) {
    const vert = s.up ? -1 : s.down ? 1 : 0, horiz = vert ? 0 : s.left ? -1 : s.right ? 1 : 0, nd = vert * 3 + horiz;
    if (nd !== navDir) { navDir = nd; navRepeat = 0.35; if (nd) moveFocus(vert, horiz); }
    else if (nd) { navRepeat -= dt; if (navRepeat <= 0) { navRepeat = 0.12; moveFocus(vert, horiz); } }
    if (edge("a")) {
      const el = document.activeElement;
      if (el && ui.contains(el) && el.tagName === "BUTTON") el.click();
      else { const f = ui.querySelector("[autofocus]") || ui.querySelector("button"); if (f) f.focus(); }
    } else if (edge("b") || (edge("start") && G.state === "paused")) uiBack();
    else if (edge("y") && (G.state === "result" || G.state === "paused")) restartLevel();
    else if (edge("select") && G.mode === "run" && G.state === "paused") startRun();
  }
  padPrev = s;
}

/* ================= level editor ================= */
const TOOLS = [["#", "Ground"], ["^", "Spikes"], ["S", "Spring"], ["*", "Crystal"], ["=", "Platform"], ["C", "Crumble"], ["P", "Start"], ["G", "Goal"], [".", "Eraser"]];
const ED = { lv: null, id: null, created: 0, zoom: 1, tool: "#", cam: { x: 0, y: 0 }, undo: [], stroke: null, ptrs: new Map(), panMode: false, panLast: null, hover: null, dirty: false, keys: {}, exitArm: false };
const edTop = $("#edTop"), edBottom = $("#edBottom"), edMsg = $("#edMsg");

function drawTileAny(g, lv, x, y, px, py, t) {
  const th = THEMES[lv.theme], c = lv.tiles[y * lv.w + x];
  if (c === "#") drawSolid(g, th, lv, x, y, px, py);
  else if (c === "^") drawSpike(g, px, py, spikeDirOf(lv, x, y));
  else if (c === "=") drawOneWay(g, th, px, py);
  else if (c === "C") drawCrumble(g, px, py, 0, 0);
  else if (c === "S") drawSpring(g, px, py, false);
  else if (c === "*") drawCrystal(g, px + 4, py + 4, false);
  else if (c === "G") drawGoal(g, px, py, t);
  else if (c === "P") drawPlayer(g, px + 1, py - 2, 1, 0, 0, 1, false);
}
function buildEditorBar() {
  edTop.innerHTML = TOOLS.map(([c, name], i) => `<button data-tool="${c}" title="${name} (${i + 1})"><canvas width="10" height="10"></canvas>${name}</button>`).join("") +
    `<span class="sp"></span><span class="kbd-only" style="color:var(--muted)">Left: paint · Right: erase · Space+drag: pan · Ctrl+Z: undo</span>`;
  const icon = { name: "", theme: 1, w: 3, h: 3, tiles: [] };
  edTop.querySelectorAll("button").forEach((b) => {
    const c = b.dataset.tool, g = b.querySelector("canvas").getContext("2d");
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#0b0f24"; g.fillRect(0, 0, 10, 10);
    icon.tiles = [".", ".", ".", ".", c, ".", ".", c === "^" || c === "S" || c === "P" || c === "G" ? "#" : ".", "."];
    if (c === ".") { g.fillStyle = "#ff5b6e"; for (let i = 1; i < 9; i++) { g.fillRect(i, i, 1, 1); g.fillRect(9 - i, i, 1, 1); } return; }
    if (c === "G") { drawGoal(g, 1, 2, 0); return; }
    if (c === "P") { drawPlayer(g, 2, 1, 1, 0, 0, 1, false); return; }
    drawTileAny(g, icon, 1, 1, 1, 1, 0);
  });
}
edTop.addEventListener("click", (e) => { const b = e.target.closest("[data-tool]"); if (b) selectTool(b.dataset.tool); });
edBottom.addEventListener("click", (e) => { const b = e.target.closest("[data-ed]"); if (b) edAction(b.dataset.ed); });
$("#edName").addEventListener("input", (e) => { ED.lv.name = e.target.value.slice(0, 40) || "Untitled"; ED.dirty = true; ED.exitArm = false; });
$("#edTheme").addEventListener("change", (e) => { ED.lv.theme = +e.target.value; ED.dirty = true; e.target.blur(); });

function selectTool(c) { ED.tool = c; edTop.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("sel", b.dataset.tool === c)); }
function edSay(text, err) { edMsg.textContent = text || ""; edMsg.classList.toggle("err", !!err); }
function showEdBars(on) { edTop.hidden = edBottom.hidden = !on; }
function syncEdInputs() { $("#edName").value = ED.lv.name; $("#edW").value = ED.lv.w; $("#edH").value = ED.lv.h; $("#edTheme").value = String(ED.lv.theme); $("#edZoom").textContent = ED.zoom === 1 ? "Zoom out" : "Zoom in"; $("#edPan").classList.toggle("sel", ED.panMode); }
function newLevel() {
  const lv = { name: "My level", theme: 2, w: 60, h: 23, tiles: new Array(60 * 23).fill(".") };
  for (let y = 19; y < 23; y++) for (let x = 0; x < 60; x++) lv.tiles[y * 60 + x] = "#";
  lv.tiles[18 * 60 + 3] = "P"; lv.tiles[18 * 60 + 56] = "G";
  return lv;
}
function openEditor(entry) {
  let lv;
  if (entry) { try { lv = entryLevel(entry); } catch { showCustom("That level couldn't be opened."); return; } ED.id = entry.id; ED.created = entry.created; ED.dirty = false; }
  else { lv = newLevel(); ED.id = null; ED.created = 0; ED.dirty = true; }
  ED.lv = lv; ED.undo = []; ED.zoom = 1; ED.exitArm = false; ED.stroke = null; ED.ptrs.clear(); ED.panLast = null;
  const pi = lv.tiles.indexOf("P"), px = pi >= 0 ? pi % lv.w : 0, py = pi >= 0 ? (pi / lv.w) | 0 : lv.h - 1;
  ED.cam.x = px * T - VW / 3; ED.cam.y = py * T - VH / 2;
  enterEditor(); edSay(entry ? "" : "New level: paint with the tools above.");
}
function enterEditor() {
  G.state = "editor"; G.mode = null; G.W = null; hideUI(); setTouch(); splitsEl.hidden = true;
  showEdBars(true); syncEdInputs(); selectTool(ED.tool); canvas.focus({ preventScroll: true });
}
function returnToEditor() { if (!ED.lv) return showTitle(); enterEditor(); edSay(""); }
const snapLevel = () => ({ w: ED.lv.w, h: ED.lv.h, tiles: ED.lv.tiles.slice() });
function restoreSnap(s) { ED.lv.w = s.w; ED.lv.h = s.h; ED.lv.tiles = s.tiles.slice(); }
function pushUndo(s) { ED.undo.push(s); if (ED.undo.length > 80) ED.undo.shift(); }
function edUndo() { const s = ED.undo.pop(); if (!s) { edSay("Nothing to undo."); return; } restoreSnap(s); ED.dirty = true; syncEdInputs(); edSay("Undone."); }
function resizeLevel(nw, nh) {
  const lv = ED.lv;
  nw = clamp(nw | 0, MIN_W, MAX_W); nh = clamp(nh | 0, MIN_H, MAX_H);
  if (nw === lv.w && nh === lv.h) { syncEdInputs(); return; }
  pushUndo(snapLevel());
  const t = new Array(nw * nh).fill("."), dy = nh - lv.h;
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const sy = y - dy;
    if (x < lv.w && sy >= 0 && sy < lv.h) t[y * nw + x] = lv.tiles[sy * lv.w + x];
  }
  lv.w = nw; lv.h = nh; lv.tiles = t; ED.dirty = true; syncEdInputs(); edSay(`Resized to ${nw}x${nh}.`);
}
function paintTile(x, y, ch) {
  const lv = ED.lv;
  if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) return;
  const i = y * lv.w + x;
  if (lv.tiles[i] === ch) return;
  if (ch === "P") { const old = lv.tiles.indexOf("P"); if (old >= 0) lv.tiles[old] = "."; }
  lv.tiles[i] = ch; ED.stroke.changed = true; ED.dirty = true; ED.exitArm = false;
}
function pxScale() { return (canvas.getBoundingClientRect().width / VW) * ED.zoom; }
function toTile(e) {
  const r = canvas.getBoundingClientRect();
  const ix = ((e.clientX - r.left) / r.width) * VW, iy = ((e.clientY - r.top) / r.height) * VH;
  return { x: Math.floor((Math.round(ED.cam.x) + ix / ED.zoom) / T), y: Math.floor((Math.round(ED.cam.y) + iy / ED.zoom) / T) };
}
function strokeTo(e) {
  const t = toTile(e), s = ED.stroke, from = s.last || t;
  let x = from.x, y = from.y;
  const dx = Math.abs(t.x - x), dy = -Math.abs(t.y - y), sx = x < t.x ? 1 : -1, sy = y < t.y ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 2000; n++) {
    paintTile(x, y, s.ch);
    if (x === t.x && y === t.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  s.last = t;
}
const avgPtr = () => { let x = 0, y = 0; for (const p of ED.ptrs.values()) { x += p.x; y += p.y; } return { x: x / ED.ptrs.size, y: y / ED.ptrs.size }; };
canvas.addEventListener("pointerdown", (e) => {
  canvas.focus({ preventScroll: true });
  if (G.state !== "editor" || !ui.hidden) return;
  e.preventDefault(); canvas.setPointerCapture(e.pointerId);
  ED.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ED.ptrs.size >= 2) { if (ED.stroke) { restoreSnap(ED.stroke.snap); ED.stroke = null; } ED.panLast = avgPtr(); return; }
  if (e.button === 1 || ED.panMode || ED.keys.Space) { ED.panLast = { x: e.clientX, y: e.clientY }; return; }
  ED.stroke = { snap: snapLevel(), ch: e.button === 2 ? "." : ED.tool, last: null, changed: false };
  strokeTo(e);
});
canvas.addEventListener("pointermove", (e) => {
  if (G.state !== "editor") return;
  ED.hover = e.pointerType === "mouse" ? toTile(e) : null;
  if (!ED.ptrs.has(e.pointerId)) return;
  ED.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ED.panLast) {
    const p = ED.ptrs.size >= 2 ? avgPtr() : { x: e.clientX, y: e.clientY }, s = pxScale();
    ED.cam.x -= (p.x - ED.panLast.x) / s; ED.cam.y -= (p.y - ED.panLast.y) / s; ED.panLast = p;
    return;
  }
  if (ED.stroke) strokeTo(e);
});
const ptrEnd = (e) => {
  if (!ED.ptrs.has(e.pointerId)) return;
  ED.ptrs.delete(e.pointerId);
  if (ED.ptrs.size === 0) {
    if (ED.stroke) { if (ED.stroke.changed) pushUndo(ED.stroke.snap); ED.stroke = null; }
    ED.panLast = null;
  } else if (ED.panLast) ED.panLast = avgPtr();
};
canvas.addEventListener("pointerup", ptrEnd); canvas.addEventListener("pointercancel", ptrEnd);
canvas.addEventListener("pointerleave", () => { ED.hover = null; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("wheel", (e) => {
  if (G.state !== "editor" || !ui.hidden) return;
  e.preventDefault();
  if (e.ctrlKey) { ED.zoom = e.deltaY > 0 ? 0.5 : 1; syncEdInputs(); return; }
  const s = pxScale();
  ED.cam.x += (e.shiftKey ? e.deltaY : e.deltaX) / s; ED.cam.y += (e.shiftKey ? 0 : e.deltaY) / s;
}, { passive: false });

function edAction(a) {
  const lv = ED.lv;
  if (a === "resize") resizeLevel(+$("#edW").value, +$("#edH").value);
  else if (a === "zoom") { ED.zoom = ED.zoom === 1 ? 0.5 : 1; syncEdInputs(); }
  else if (a === "pan") { ED.panMode = !ED.panMode; syncEdInputs(); edSay(ED.panMode ? "Pan mode: drag to move around." : ""); }
  else if (a === "undo") edUndo();
  else if (a === "test") { const pr = problems(lv); if (pr) edSay(pr, true); else startTest(cloneLevel(lv)); }
  else if (a === "save") {
    const e = makeEntry(lv, ED.id, true, ED.created || Date.now());
    const i = customs.findIndex((c) => c.id === e.id);
    if (i >= 0) customs[i] = e; else customs.unshift(e);
    ED.id = e.id; ED.created = e.created;
    if (saveCustoms()) { ED.dirty = false; ED.exitArm = false; edSay("Saved to Custom levels."); } else edSay("Couldn't save: browser storage is full or blocked.", true);
  } else if (a === "share") { const pr = problems(lv); if (pr) edSay(pr, true); else showShare(lv, "edreturn"); }
  else if (a === "exit") {
    if (ED.dirty && !ED.exitArm) { ED.exitArm = true; edSay("Unsaved changes. Press Exit again to leave without saving.", true); return; }
    showCustom();
  }
  const f = document.activeElement; if (f && f.tagName === "BUTTON" && edBottom.contains(f)) f.blur();
}
function editorKey(e, down) {
  const c = e.code;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS", "Space"].includes(c) && !(down && (e.ctrlKey || e.metaKey))) {
    ED.keys[c] = down; e.preventDefault(); return;
  }
  if (!down || e.repeat) return;
  if ((e.ctrlKey || e.metaKey) && c === "KeyZ") { edUndo(); e.preventDefault(); return; }
  if ((e.ctrlKey || e.metaKey) && c === "KeyS") { edAction("save"); e.preventDefault(); return; }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 9) { selectTool(TOOLS[n - 1][0]); return; }
  if (c === "KeyT") edAction("test");
  else if (c === "KeyQ") edAction("zoom");
  else if (c === "Escape") edAction("exit");
}
function renderEditor(dt) {
  renderT += dt;
  const lv = ED.lv, z = ED.zoom, vw = VW / z, vh = VH / z;
  const sp = 220 / z * dt, K = ED.keys;
  if (K.ArrowLeft || K.KeyA) ED.cam.x -= sp; if (K.ArrowRight || K.KeyD) ED.cam.x += sp;
  if (K.ArrowUp || K.KeyW) ED.cam.y -= sp; if (K.ArrowDown || K.KeyS) ED.cam.y += sp;
  const lw = lv.w * T, lh = lv.h * T, m = 48;
  ED.cam.x = lw + 2 * m <= vw ? (lw - vw) / 2 : clamp(ED.cam.x, -m, lw - vw + m);
  ED.cam.y = lh + 2 * m <= vh ? (lh - vh) / 2 : clamp(ED.cam.y, -m, lh - vh + m);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBg(lv.theme, ED.cam.x, ED.cam.y);
  const cx = Math.round(ED.cam.x), cy = Math.round(ED.cam.y);
  ctx.setTransform(z, 0, 0, z, -cx * z, -cy * z);
  // outside-level shade
  ctx.fillStyle = "rgba(0,0,0,.45)";
  if (cx < 0) ctx.fillRect(cx, cy, -cx, vh);
  if (cx + vw > lw) ctx.fillRect(lw, cy, cx + vw - lw, vh);
  if (cy < 0) ctx.fillRect(Math.max(0, cx), cy, Math.min(lw, cx + vw) - Math.max(0, cx), -cy);
  if (cy + vh > lh) ctx.fillRect(Math.max(0, cx), lh, Math.min(lw, cx + vw) - Math.max(0, cx), cy + vh - lh);
  const x0 = Math.max(0, Math.floor(cx / T)), x1 = Math.min(lv.w - 1, Math.floor((cx + vw) / T));
  const y0 = Math.max(0, Math.floor(cy / T) - 1), y1 = Math.min(lv.h - 1, Math.floor((cy + vh) / T) + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (lv.tiles[y * lv.w + x] !== ".") drawTileAny(ctx, lv, x, y, x * T, y * T, renderT + x);
  if (z === 1) {
    ctx.fillStyle = "rgba(255,255,255,.06)";
    for (let x = x0; x <= x1 + 1; x++) ctx.fillRect(x * T, Math.max(0, cy), 1, Math.min(lh, cy + vh) - Math.max(0, cy));
    for (let y = Math.max(0, y0); y <= y1 + 1; y++) ctx.fillRect(Math.max(0, cx), y * T, Math.min(lw, cx + vw) - Math.max(0, cx), 1);
  }
  ctx.fillStyle = "rgba(255,210,63,.6)";
  ctx.fillRect(0, -1, lw, 1); ctx.fillRect(0, lh, lw, 1); ctx.fillRect(-1, 0, 1, lh); ctx.fillRect(lw, 0, 1, lh);
  const h = ED.hover;
  if (h && h.x >= 0 && h.y >= 0 && h.x < lv.w && h.y < lv.h && !ED.panMode) {
    ctx.globalAlpha = 0.6;
    if (ED.tool !== ".") drawTileAny(ctx, { name: "", theme: lv.theme, w: 1, h: 1, tiles: [ED.tool] }, 0, 0, h.x * T, h.y * T, renderT);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ED.tool === "." ? "#ff5b6e" : "#ffd23f";
    const px = h.x * T, py = h.y * T;
    ctx.fillRect(px, py, T, 1); ctx.fillRect(px, py + T - 1, T, 1); ctx.fillRect(px, py, 1, T); ctx.fillRect(px + T - 1, py, 1, T);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/* ================= main loop ================= */
let last = 0, acc = 0;
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  pollPad(dt);
  if (G.state === "play") {
    acc += dt; let n = 0;
    while (acc >= DT && n < 30) { simStep(); acc -= DT; n++; if (G.state !== "play") { acc = 0; break; } }
  } else acc = 0;
  if (G.state === "editor") renderEditor(dt); else renderGame(dt);
  updateHud(dt);
  requestAnimationFrame(frame);
}

DEMO.W = makeWorld(BASE[Math.floor(Math.random() * BASE.length)]);
buildEditorBar();
showTitle();
requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
})();
