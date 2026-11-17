"use strict";
/* LAST LANTERN · engine.js
   Shared helpers: math + seeded RNG, save data and save codes, sound effects and the
   chiptune music player, keyboard / gamepad / touch input, menu navigation, pixel sprites. */

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rndi = (n) => (Math.random() * n) | 0;
const pickr = (a) => a[(Math.random() * a.length) | 0];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtInt = (n) => Math.floor(n).toLocaleString("en-US");
function fmtTime(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function todayStr(d = new Date()) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

/* Seeded RNG (mulberry32) with a few conveniences. Daily runs use these so everyone gets the same night. */
function RNG(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const f = () => {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.int = (n) => (f() * n) | 0;
  f.pick = (arr) => arr[(f() * arr.length) | 0];
  f.weighted = (items, w) => {
    let tot = 0; for (const it of items) tot += w(it);
    let r = f() * tot; for (const it of items) { r -= w(it); if (r <= 0) return it; }
    return items[items.length - 1];
  };
  return f;
}
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* ================= save data ================= */
const SAVE_KEY = "lastlantern.v1";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};
function defaultSave() {
  return {
    v: 1, gold: 0, spent: 0, shop: {},
    chars: ["wren"], stages: ["wood"], weapons: [], passives: [], modes: [],
    ach: {}, codex: { w: {}, p: {}, e: {}, x: {} }, dawns: {},
    stats: { runs: 0, kills: 0, time: 0, gold: 0, deaths: 0, bestLevel: 0, best: {}, bestKills: 0, bosses: 0 },
    daily: { date: "", best: -1, kills: 0, level: 0, done: false },
    last: { char: "wren", stage: "wood", blood: false, endless: false },
    settings: { music: 0.5, sfx: 0.7, shake: true, dmg: true, flash: true, touch: "auto" },
  };
}
function mergeSave(base, over) {
  if (over === null || typeof over !== "object") return base;
  if (Array.isArray(base)) return Array.isArray(over) ? over.filter((x) => typeof x === "string").slice(0, 200) : base;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    if (k === "__proto__" || k === "constructor") continue;
    const b = base[k], o = over[k];
    if (b !== null && typeof b === "object") out[k] = mergeSave(b, o);
    else if (b === undefined) { if (o === null || typeof o !== "object") out[k] = o; else if (!Array.isArray(o)) out[k] = mergeSave({}, o); }
    else if (typeof o === typeof b) out[k] = o;
  }
  return out;
}
function sanitize(s) {
  s.gold = Math.max(0, Math.floor(+s.gold || 0)); s.spent = Math.max(0, Math.floor(+s.spent || 0));
  for (const k of Object.keys(s.shop)) s.shop[k] = Math.max(0, Math.floor(+s.shop[k] || 0));
  if (!s.chars.includes("wren")) s.chars.unshift("wren");
  if (!s.stages.includes("wood")) s.stages.unshift("wood");
  const st = s.settings;
  st.music = clamp(+st.music || 0, 0, 1); st.sfx = clamp(+st.sfx || 0, 0, 1);
  if (!["auto", "on", "off"].includes(st.touch)) st.touch = "auto";
  return s;
}
function loadSave() {
  let d = null; try { d = JSON.parse(store.get(SAVE_KEY) || "null"); } catch { d = null; }
  return sanitize(mergeSave(defaultSave(), d));
}
let SAVE = loadSave();
function save() { store.set(SAVE_KEY, JSON.stringify(SAVE)); }

function b64e(str) {
  const b = new TextEncoder().encode(str); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64d(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new TextDecoder().decode(u); }
const SAVE_PREFIX = "LASTLANTERN-SAVE:";
function exportSave() { const b = b64e(JSON.stringify(SAVE)); return SAVE_PREFIX + b + "." + hashStr(b).toString(36); }
function importSave(code) {
  code = String(code || "").replace(/\s+/g, "");
  if (!code.startsWith(SAVE_PREFIX)) throw new Error("That isn't a Last Lantern save code. It should start with " + SAVE_PREFIX);
  const body = code.slice(SAVE_PREFIX.length), dot = body.lastIndexOf(".");
  if (dot < 0) throw new Error("The code is cut off. Copy the whole thing and try again.");
  const b = body.slice(0, dot), h = body.slice(dot + 1);
  if (hashStr(b).toString(36) !== h) throw new Error("The code is damaged. Copy the whole thing and try again.");
  let d; try { d = JSON.parse(b64d(b)); } catch { throw new Error("The code couldn't be read."); }
  return sanitize(mergeSave(defaultSave(), d));
}

/* ================= audio ================= */
const AU = { ctx: null, sfxBus: null, musBus: null, noise: null, waves: {}, last: {}, ladder: 0, ladderT: 0 };
function audio() {
  if (!AU.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { AU.ctx = new AC(); } catch { return null; }
    const c = AU.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(c.destination);
    AU.sfxBus = c.createGain(); AU.sfxBus.connect(comp);
    AU.musBus = c.createGain(); AU.musBus.connect(comp);
    const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = n;
    for (const duty of [0.125, 0.25, 0.5]) {
      const N = 32, re = new Float32Array(N), im = new Float32Array(N);
      for (let k = 1; k < N; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      AU.waves[duty] = c.createPeriodicWave(re, im);
    }
    applyVolumes();
  }
  if (AU.ctx.state === "suspended" && !document.hidden) AU.ctx.resume().catch(() => {});
  return AU.ctx;
}
function applyVolumes() {
  if (!AU.ctx) return;
  const s = SAVE.settings;
  AU.sfxBus.gain.value = s.sfx * s.sfx * 0.9;
  AU.musBus.gain.value = s.music * s.music * 0.6;
}
function voice(freq, t, dur, o = {}) {
  const c = AU.ctx; if (!c) return;
  const osc = c.createOscillator(), g = c.createGain();
  if (o.duty) osc.setPeriodicWave(AU.waves[o.duty]); else osc.type = o.type || "square";
  osc.frequency.setValueAtTime(freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + (o.slideT || dur));
  const v = o.vol ?? 0.1, a = o.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v, t + a);
  if (o.hold) g.gain.setValueAtTime(v, t + Math.max(a, dur - (o.release ?? 0.06)));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(o.bus || AU.sfxBus);
  osc.start(t); osc.stop(t + dur + 0.03);
}
function noiseV(t, dur, o = {}) {
  const c = AU.ctx; if (!c) return;
  const s = c.createBufferSource(); s.buffer = AU.noise;
  const f = c.createBiquadFilter(); f.type = o.filter || "bandpass";
  const fr = o.freq || 1500; f.frequency.setValueAtTime(fr, t);
  if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, fr * o.slide), t + dur);
  f.Q.value = o.q ?? 0.9;
  const g = c.createGain(), v = o.vol ?? 0.1;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(o.bus || AU.sfxBus);
  s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.03);
}
const arpUp = (t, notes, gap, o) => notes.forEach((f, i) => voice(f, t + i * gap, o.len || 0.14, o));
const SFX = {
  hit: (t) => noiseV(t, 0.045, { freq: 900 + Math.random() * 1100, vol: 0.05, q: 1.5 }),
  kill: (t) => voice(360 + Math.random() * 140, t, 0.07, { duty: 0.5, vol: 0.03, slide: 0.45 }),
  gem: (t) => voice(988 * Math.pow(2, AU.ladder / 12), t, 0.07, { type: "triangle", vol: 0.06 }),
  coin: (t) => { voice(1318, t, 0.05, { duty: 0.5, vol: 0.035 }); voice(1760, t + 0.05, 0.12, { duty: 0.5, vol: 0.035 }); },
  heal: (t) => arpUp(t, [523, 659, 784, 1046], 0.05, { type: "triangle", vol: 0.07, len: 0.14 }),
  level: (t) => arpUp(t, [523, 659, 784, 1046, 1318], 0.055, { duty: 0.25, vol: 0.055, len: 0.16 }),
  pick: (t) => { voice(784, t, 0.06, { duty: 0.25, vol: 0.05 }); voice(1175, t + 0.06, 0.16, { duty: 0.25, vol: 0.05 }); },
  hurt: (t) => { voice(210, t, 0.16, { type: "sawtooth", vol: 0.07, slide: 0.35 }); noiseV(t, 0.12, { filter: "lowpass", freq: 800, vol: 0.1 }); },
  wand: (t) => voice(1500, t, 0.07, { type: "triangle", vol: 0.022, slide: 0.5 }),
  knife: (t) => noiseV(t, 0.05, { filter: "highpass", freq: 4200, vol: 0.03 }),
  slash: (t) => noiseV(t, 0.14, { freq: 3200, slide: 0.3, vol: 0.055, q: 0.7 }),
  axe: (t) => noiseV(t, 0.22, { freq: 500, slide: 2.6, vol: 0.04, q: 1.2 }),
  orb: (t) => voice(520, t, 0.3, { type: "sine", vol: 0.04, slide: 1.6 }),
  zap: (t) => { noiseV(t, 0.25, { filter: "lowpass", freq: 6000, slide: 0.08, vol: 0.08 }); voice(95, t, 0.2, { type: "square", vol: 0.035, slide: 0.6 }); },
  boom: (t) => noiseV(t, 0.35, { filter: "lowpass", freq: 1300, slide: 0.15, vol: 0.11 }),
  glass: (t) => { voice(2400, t, 0.05, { type: "triangle", vol: 0.025 }); noiseV(t, 0.12, { filter: "highpass", freq: 5000, vol: 0.035 }); },
  boomer: (t) => voice(480, t, 0.12, { type: "triangle", vol: 0.03, slide: 1.6 }),
  shot: (t) => voice(330, t, 0.12, { duty: 0.25, vol: 0.028, slide: 0.6 }),
  chest: (t) => {
    for (let i = 0; i < 10; i++) noiseV(t + i * 0.06, 0.05, { freq: 300 + i * 90, vol: 0.05 });
    arpUp(t + 0.62, [523, 659, 784, 1046], 0.08, { duty: 0.25, vol: 0.06, len: 0.3 });
  },
  reveal: (t) => voice(880, t, 0.16, { duty: 0.25, vol: 0.05, slide: 1.5 }),
  evolve: (t) => arpUp(t, [392, 523, 659, 784, 1046, 1318, 1568], 0.06, { duty: 0.125, vol: 0.06, len: 0.32 }),
  boss: (t) => { noiseV(t, 1.4, { filter: "lowpass", freq: 320, slide: 0.3, vol: 0.2 }); voice(55, t, 1.4, { type: "sawtooth", vol: 0.07, slide: 0.8 }); },
  warn: (t) => { voice(440, t, 0.11, { duty: 0.5, vol: 0.045 }); voice(440, t + 0.17, 0.11, { duty: 0.5, vol: 0.045 }); },
  slam: (t) => { noiseV(t, 0.5, { filter: "lowpass", freq: 520, slide: 0.2, vol: 0.18 }); voice(70, t, 0.4, { type: "sine", vol: 0.12, slide: 0.5 }); },
  freeze: (t) => arpUp(t, [1568, 1318, 1046, 784], 0.04, { type: "triangle", vol: 0.05, len: 0.2 }),
  flare: (t) => { noiseV(t, 0.8, { filter: "lowpass", freq: 3000, slide: 0.1, vol: 0.14 }); voice(220, t, 0.8, { type: "sawtooth", vol: 0.04, slide: 3 }); },
  revive: (t) => voice(200, t, 0.9, { type: "triangle", vol: 0.09, slide: 4 }),
  die: (t) => { voice(330, t, 1.0, { type: "triangle", vol: 0.09, slide: 0.25 }); noiseV(t, 0.7, { filter: "lowpass", freq: 900, slide: 0.2, vol: 0.08 }); },
  split: (t) => voice(240, t, 0.1, { type: "square", vol: 0.035, slide: 1.8 }),
  charge: (t) => voice(110, t, 0.5, { type: "sawtooth", vol: 0.035, slide: 2.5 }),
  teleport: (t) => voice(1200, t, 0.3, { type: "sine", vol: 0.05, slide: 0.3 }),
  move: (t) => voice(660, t, 0.035, { duty: 0.5, vol: 0.022 }),
  ok: (t) => voice(988, t, 0.07, { duty: 0.25, vol: 0.04 }),
  back: (t) => voice(440, t, 0.07, { duty: 0.25, vol: 0.035 }),
  buy: (t) => { voice(784, t, 0.06, { duty: 0.5, vol: 0.04 }); voice(1568, t + 0.06, 0.18, { duty: 0.5, vol: 0.04 }); },
  deny: (t) => voice(150, t, 0.15, { type: "square", vol: 0.045 }),
  ach: (t) => arpUp(t, [784, 988, 1175, 1568], 0.07, { type: "triangle", vol: 0.06, len: 0.2 }),
  dawn: (t) => { arpUp(t, [262, 330, 392, 523, 659, 784], 0.12, { type: "triangle", vol: 0.06, len: 1.2 }); },
};
const SFX_GAP = { hit: 0.035, kill: 0.03, gem: 0.022, wand: 0.05, knife: 0.05, slash: 0.06, shot: 0.08, zap: 0.06, boom: 0.08, glass: 0.06, coin: 0.05, move: 0.03, axe: 0.08, boomer: 0.08, orb: 0.15, split: 0.05 };
function sfx(name) {
  if (!SAVE.settings.sfx) return;
  const c = audio(); if (!c || !SFX[name]) return;
  const now = c.currentTime, gap = SFX_GAP[name] ?? 0.02;
  if (now - (AU.last[name] || -1) < gap) return;
  AU.last[name] = now;
  if (name === "gem") { AU.ladder = now - AU.ladderT < 0.4 ? Math.min(AU.ladder + 1, 15) : 0; AU.ladderT = now; }
  SFX[name](now + 0.005);
}

/* ================= music ================= */
/* Songs are written as chords (one per bar), a bass pattern, a drum pattern and a lead line.
   Lead bars use note names ("a4", "c#5"), "-" to hold the last note and "." for silence. */
const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
function midi(n) {
  const m = /^([a-g])(#|b)?(-?\d)$/.exec(n);
  if (!m) return 60;
  return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
const mhz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function chordOf(name) {
  const m = /^([A-G])(#|b)?(m)?(7)?$/.exec(name) || [0, "C"];
  const root = (NOTE[m[1].toLowerCase()] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  const third = m[3] ? 3 : 4;
  return { root, third, seventh: m[4] ? 10 : 12 };
}
function compileSong(d) {
  if (d._c) return d._c;
  const bars = d.chords.length, N = bars * 16, lead = new Array(N).fill(null);
  let last = -1;
  d.lead.forEach((bar, bi) => {
    const tok = bar.trim().split(/\s+/), per = 16 / tok.length;
    tok.forEach((tk, i) => {
      const s = bi * 16 + Math.round(i * per);
      if (tk === "-") { if (last >= 0) lead[last].len += per; }
      else if (tk === ".") last = -1;
      else { lead[s] = { m: midi(tk), len: per }; last = s; }
    });
  });
  return (d._c = { bpm: d.bpm, N, lead, chords: d.chords.map(chordOf), bass: d.bass.trim().split(/\s+/), drums: d.drums ? d.drums.trim().split(/\s+/) : null, arp: !!d.arp, pad: !!d.pad, leadVol: d.leadVol || 0.065 });
}
const MUS = { id: "", song: null, step: 0, next: 0, level: 3, timer: 0 };
function musicPlay(id, level) {
  if (level !== undefined) MUS.level = level;
  if (MUS.id === id) return;
  MUS.id = id; MUS.song = (typeof SONGS !== "undefined" && SONGS[id]) ? compileSong(SONGS[id]) : null; MUS.step = 0;
  const c = audio(); if (c) MUS.next = c.currentTime + 0.1;
}
function musicLevel(l) { MUS.level = l; }
function kick(t, bus) { voice(150, t, 0.18, { type: "sine", vol: 0.34, slide: 0.25, slideT: 0.12, bus }); }
function snare(t, bus) { noiseV(t, 0.13, { freq: 1900, vol: 0.11, q: 0.6, bus }); voice(185, t, 0.07, { type: "triangle", vol: 0.07, bus }); }
function hat(t, bus) { noiseV(t, 0.035, { filter: "highpass", freq: 7500, vol: 0.045, bus }); }
function playStep(S, step, t, sd) {
  const bar = (step / 16) | 0, s = step & 15, ch = S.chords[bar], L = MUS.level, bus = AU.musBus;
  const b = S.bass[s];
  if (b && b !== ".") {
    let m = 36 + ch.root + (b === "O" ? 12 : b === "F" ? 7 : b === "T" ? ch.third : 0);
    if (m < 40) m += 12;
    voice(mhz(m), t, sd * 1.7, { type: "triangle", vol: 0.15, bus, attack: 0.003 });
  }
  if (S.pad && s === 0) for (const iv of [0, ch.third, 7]) voice(mhz(48 + ch.root + iv), t, sd * 16, { type: "triangle", vol: 0.028, bus, attack: 0.25, hold: true, release: 0.4 });
  if (L >= 2 && S.drums) {
    const k = S.drums[s] || ".";
    if (k.includes("k")) kick(t, bus);
    if (k.includes("s")) snare(t, bus);
    if (k.includes("h")) hat(t, bus);
  }
  if (L >= 3 && S.arp) {
    const iv = [0, ch.third, 7, 12][s % 4] + (s >= 8 && s % 4 === 3 ? ch.seventh - 12 : 0);
    voice(mhz(60 + ch.root + iv), t, sd * 0.9, { duty: 0.125, vol: 0.026, bus });
  }
  if (L >= 1) {
    const n = S.lead[step];
    if (n) voice(mhz(n.m), t, n.len * sd * 0.94, { duty: 0.25, vol: S.leadVol, bus, hold: true, release: 0.05, attack: 0.006 });
  }
}
function musicTick() {
  const c = AU.ctx; if (!c || !MUS.song || c.state !== "running") return;
  const S = MUS.song, sd = 60 / S.bpm / 4;
  if (MUS.next < c.currentTime - 0.25) MUS.next = c.currentTime + 0.05;
  while (MUS.next < c.currentTime + 0.15) {
    playStep(S, MUS.step, MUS.next, sd);
    MUS.next += sd; MUS.step = (MUS.step + 1) % S.N;
  }
}
setInterval(musicTick, 30);

/* ================= input ================= */
const IN = { keys: new Set(), pad: [0, 0], touch: [0, 0], device: "kb", usedTouch: false };
function moveVec() {
  const k = IN.keys; let x = 0, y = 0;
  if (k.has("ArrowLeft") || k.has("KeyA")) x -= 1;
  if (k.has("ArrowRight") || k.has("KeyD")) x += 1;
  if (k.has("ArrowUp") || k.has("KeyW")) y -= 1;
  if (k.has("ArrowDown") || k.has("KeyS")) y += 1;
  if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  x += IN.pad[0] + IN.touch[0]; y += IN.pad[1] + IN.touch[1];
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  return [x, y];
}
function readPad() {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of gps) {
    if (!g || !g.connected || !g.buttons || !g.buttons.length) continue;
    const b = (i) => !!(g.buttons[i] && g.buttons[i].pressed);
    let ax = g.axes[0] || 0, ay = g.axes[1] || 0; const l = Math.hypot(ax, ay);
    if (l < 0.22) { ax = ay = 0; } else { const k = Math.min(1, (l - 0.22) / 0.7) / l; ax *= k; ay *= k; }
    if (b(14)) ax = -1; if (b(15)) ax = 1; if (b(12)) ay = -1; if (b(13)) ay = 1;
    return {
      ax, ay, a: b(0), b: b(1), x: b(2), y: b(3), lb: b(4), rb: b(5), back: b(8), start: b(9),
      up: b(12) || ay < -0.55, down: b(13) || ay > 0.55, left: b(14) || ax < -0.55, right: b(15) || ax > 0.55,
    };
  }
  return null;
}
/* Spatial menu navigation: arrow keys / d-pad move focus to the nearest control in that direction. */
function navList(root) {
  return $$("button:not([disabled]), input, select, textarea, [data-nav]", root).filter((el) => el.offsetParent !== null && !el.closest("[hidden]") && !el.closest(".nonav"));
}
function navMove(root, dx, dy) {
  const list = navList(root); if (!list.length) return false;
  const cur = document.activeElement;
  if (cur && cur.type === "range" && dx && list.includes(cur)) {
    const step = +cur.step || 0.05;
    cur.value = clamp(+cur.value + dx * step, +cur.min, +cur.max);
    cur.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  if (!list.includes(cur)) { const f = root.querySelector("[autofocus]:not([disabled])") || list[0]; f.focus({ preventScroll: false }); return true; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bs = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const q = el.getBoundingClientRect(), ex = q.left + q.width / 2, ey = q.top + q.height / 2;
    const along = dx ? (ex - cx) * dx : (ey - cy) * dy;
    if (along <= 2) continue;
    let perp;
    if (dx) perp = q.bottom < r.top ? r.top - q.bottom : q.top > r.bottom ? q.top - r.bottom : 0;
    else perp = q.right < r.left ? r.left - q.right : q.left > r.right ? q.left - r.right : 0;
    const score = along + perp * 3;
    if (score < bs) { bs = score; best = el; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: "nearest", inline: "nearest" }); return true; }
  return false;
}

/* ================= pixel sprites ================= */
function mkCanvas(w, h) {
  const c = document.createElement("canvas"); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false; return [c, g];
}
const _rgba = {};
function rgba(hex) {
  if (_rgba[hex]) return _rgba[hex];
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255];
  return (_rgba[hex] = v);
}
/* rows: array of strings, one char per pixel ("." = empty). Chars map to colors in PAL (data.js) or `pal`.
   A 1px dark outline is added unless o.outline === false. */
function compile(rows, pal = {}, o = {}) {
  const P = Object.assign({}, PAL, pal);
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), ol = o.outline === false ? 0 : 1;
  const W = w + ol * 2, H = h + ol * 2;
  const [c, g] = mkCanvas(W, H), img = g.createImageData(W, H), d = img.data, solid = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x]; if (!ch || ch === "." || ch === " ") continue;
    const col = P[ch]; if (!col) continue;
    const i = (y + ol) * W + x + ol; solid[i] = 1; d.set(rgba(col), i * 4);
  }
  if (ol) {
    const oc = rgba(o.outlineColor || "#0d0b17");
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < W - 1 && solid[i + 1]) || (y > 0 && solid[i - W]) || (y < H - 1 && solid[i + W])) d.set(oc, i * 4);
    }
  }
  g.putImageData(img, 0, 0);
  return sprite(c);
}
function sprite(c) {
  const s = { c, w: c.width, h: c.height };
  s.f = flipC(c); s.white = silC(c, "#ffffff"); s.wf = flipC(s.white);
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, px = [];
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] > 90) px.push([x, y, `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`]);
  }
  s.px = px;
  return s;
}
function flipC(c) { const [o, g] = mkCanvas(c.width, c.height); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return o; }
function silC(c, color) { const [o, g] = mkCanvas(c.width, c.height); g.drawImage(c, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); return o; }
function tint(s, color) { s.t = s.t || {}; if (!s.t[color]) { const a = silC(s.c, color); s.t[color] = [a, flipC(a)]; } return s.t[color]; }
/* Nearest-neighbour rotations so spinning pixel art stays crisp. */
function rotations(s, n) {
  const src = s.c.getContext("2d").getImageData(0, 0, s.w, s.h).data, D = Math.ceil(Math.hypot(s.w, s.h)) | 1, out = [];
  const cx = s.w / 2, cy = s.h / 2, C = D / 2;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, ca = Math.cos(a), sa = Math.sin(a);
    const [c, g] = mkCanvas(D, D), img = g.createImageData(D, D), d = img.data;
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const dx = x + 0.5 - C, dy = y + 0.5 - C;
      const sx = Math.floor(ca * dx + sa * dy + cx), sy = Math.floor(-sa * dx + ca * dy + cy);
      if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
      const si = (sy * s.w + sx) * 4, di = (y * D + x) * 4;
      d[di] = src[si]; d[di + 1] = src[si + 1]; d[di + 2] = src[si + 2]; d[di + 3] = src[si + 3];
    }
    g.putImageData(img, 0, 0); out.push(c);
  }
  out.size = D;
  return out;
}

/* 3x5 pixel digits for damage numbers */
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001010010010", "111101111101111", "111101111001111"];
const _num = {};
function numGlyphs(color) {
  if (_num[color]) return _num[color];
  return (_num[color] = DIGITS.map((bits) => {
    const rows = []; for (let y = 0; y < 5; y++) rows.push(bits.slice(y * 3, y * 3 + 3).replace(/1/g, "x").replace(/0/g, "."));
    return compile(rows, { x: color }).c;
  }));
}
function drawNum(g, n, x, y, color = "#ffffff") {
  const s = String(n), gl = numGlyphs(color), w = s.length * 4 + 1;
  let px = Math.round(x - w / 2); const py = Math.round(y);
  for (let i = 0; i < s.length; i++) { const k = s.charCodeAt(i) - 48; if (k >= 0 && k <= 9) g.drawImage(gl[k], px, py); px += 4; }
}

/* Dithered light pools: cut holes in the darkness layer. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const _lights = {};
function lightSpr(r) {
  r = Math.max(4, Math.round(r / 4) * 4);
  if (_lights[r]) return _lights[r];
  const S = r * 2, [c, g] = mkCanvas(S, S), img = g.createImageData(S, S), d = img.data, steps = 6;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dd = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r; if (dd >= 1) continue;
    let v = Math.min(1, (1 - dd) * 1.7); v = v * v * (3 - 2 * v);
    const lv = v * steps, b = Math.floor(lv), fr = lv - b, th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    const q = Math.min(steps, b + (fr > th ? 1 : 0)) / steps;
    const i = (y * S + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(q * 255);
  }
  g.putImageData(img, 0, 0);
  return (_lights[r] = c);
}
/* Soft colored glow (drawn with "lighter"). */
const _glows = {};
function glowSpr(r, color) {
  r = Math.max(4, Math.round(r / 4) * 4); const key = r + color;
  if (_glows[key]) return _glows[key];
  const [c, g] = mkCanvas(r * 2, r * 2), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return (_glows[key] = c);
}
const _shadows = {};
function shadowSpr(w) {
  w = Math.max(4, Math.round(w)); if (_shadows[w]) return _shadows[w];
  const h = Math.max(2, Math.round(w * 0.36)), [c, g] = mkCanvas(w, h);
  g.fillStyle = "rgba(0,0,0,0.36)";
  for (let y = 0; y < h; y++) { const yy = ((y + 0.5) / h) * 2 - 1, half = (Math.sqrt(1 - yy * yy) * w) / 2; g.fillRect(Math.round(w / 2 - half), y, Math.max(1, Math.round(half * 2)), 1); }
  return (_shadows[w] = c);
}
/* Pixel disc / ring with optional dithered fill: auras, pools, telegraphs. */
const _discs = {};
function discSpr(r, ring, fill, density = 0.5, ringW = 1) {
  r = Math.max(2, Math.round(r)); const key = [r, ring, fill, density, ringW].join("|");
  if (_discs[key]) return _discs[key];
  const S = r * 2 + 1, [c, g] = mkCanvas(S, S), img = g.createImageData(S, S), d = img.data;
  const rc = ring ? rgba(ring) : null, fc = fill ? rgba(fill) : null;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dd = Math.hypot(x - r, y - r), i = (y * S + x) * 4;
    if (rc && dd <= r + 0.5 && dd > r - ringW - 0.5) d.set(rc, i);
    else if (fc && dd <= r - ringW) { if ((BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < density) d.set(fc, i); }
  }
  g.putImageData(img, 0, 0);
  return (_discs[key] = c);
}
