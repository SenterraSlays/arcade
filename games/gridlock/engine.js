"use strict";
/* GRIDLOCK · engine.js — helpers, seeded RNG, save data + codes, synth sound + music, input helpers */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => Math.floor(n).toLocaleString("en-US");
function fmtTime(s) { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s % 60).padStart(2, "0"); }
function todayStr(d = new Date()) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function RNG(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.int = (n) => (f() * n) | 0;
  f.pick = (arr) => arr[(f() * arr.length) | 0];
  f.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = (f() * (i + 1)) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  f.weighted = (items, w) => { let tot = 0; for (const it of items) tot += w(it); let r = f() * tot; for (const it of items) { r -= w(it); if (r <= 0) return it; } return items[items.length - 1]; };
  return f;
}
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

/* ---------- save ---------- */
const SAVE_KEY = "gridlock.v1";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
function defaultSave() {
  return {
    v: 1, unlocked: [], ach: {}, maps: [],
    best: {}, stats: { games: 0, wins: 0, kills: 0, waves: 0, credits: 0, towers: 0, leaks: 0, time: 0 },
    daily: { date: "", wave: 0, won: false },
    last: { diff: "normal", endless: false },
    settings: { music: 0.45, sfx: 0.7, auto: false, ranges: true, flash: true, shake: true },
  };
}
function mergeSave(base, over) {
  if (over === null || typeof over !== "object") return base;
  if (Array.isArray(base)) return Array.isArray(over) ? over.slice(0, 300) : base;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    if (k === "__proto__" || k === "constructor") continue;
    const b = base[k], o = over[k];
    if (b !== null && typeof b === "object") out[k] = mergeSave(b, o);
    else if (b === undefined) out[k] = o;
    else if (typeof o === typeof b) out[k] = o;
  }
  return out;
}
function sanitize(s) {
  s.unlocked = s.unlocked.filter((x) => typeof x === "string");
  s.maps = s.maps.filter((m) => m && typeof m === "object" && typeof m.code === "string").slice(0, 100);
  const st = s.settings; st.music = clamp(+st.music || 0, 0, 1); st.sfx = clamp(+st.sfx || 0, 0, 1);
  return s;
}
function loadSave() { let d = null; try { d = JSON.parse(store.get(SAVE_KEY) || "null"); } catch {} return sanitize(mergeSave(defaultSave(), d)); }
let SAVE = loadSave();
function save() { store.set(SAVE_KEY, JSON.stringify(SAVE)); }
function b64e(str) { const b = new TextEncoder().encode(str); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function b64d(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new TextDecoder().decode(u); }
function wrapCode(prefix, obj) { const b = b64e(JSON.stringify(obj)); return prefix + b + "." + hashStr(b).toString(36); }
function unwrapCode(code, prefix, what) {
  code = String(code || "").replace(/\s+/g, "");
  if (!code.startsWith(prefix)) throw new Error(`That isn't a GRIDLOCK ${what} code. It should start with ${prefix}`);
  const body = code.slice(prefix.length), dot = body.lastIndexOf(".");
  if (dot < 0) throw new Error("The code is cut off. Copy the whole thing and try again.");
  const b = body.slice(0, dot);
  if (hashStr(b).toString(36) !== body.slice(dot + 1)) throw new Error("The code is damaged. Copy the whole thing and try again.");
  try { return JSON.parse(b64d(b)); } catch { throw new Error("The code couldn't be read."); }
}

/* ---------- audio ---------- */
const AU = { ctx: null, sfxBus: null, musBus: null, noise: null, waves: {}, last: {} };
function audio() {
  if (!AU.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { AU.ctx = new AC(); } catch { return null; }
    const c = AU.ctx, comp = c.createDynamicsCompressor();
    comp.threshold.value = -15; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
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
function applyVolumes() { if (!AU.ctx) return; const s = SAVE.settings; AU.sfxBus.gain.value = s.sfx * s.sfx * 0.9; AU.musBus.gain.value = s.music * s.music * 0.6; }
function voice(freq, t, dur, o = {}) {
  const c = AU.ctx; if (!c) return;
  const osc = c.createOscillator(), g = c.createGain();
  if (o.duty) osc.setPeriodicWave(AU.waves[o.duty]); else osc.type = o.type || "square";
  osc.frequency.setValueAtTime(freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + (o.slideT || dur));
  const v = o.vol ?? 0.1, a = o.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
  if (o.hold) g.gain.setValueAtTime(v, t + Math.max(a, dur - (o.release ?? 0.06)));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc.connect(g);
  if (o.lp) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; node = node.connect(f); }
  node.connect(o.bus || AU.sfxBus); osc.start(t); osc.stop(t + dur + 0.03);
}
function noiseV(t, dur, o = {}) {
  const c = AU.ctx; if (!c) return;
  const s = c.createBufferSource(); s.buffer = AU.noise;
  const f = c.createBiquadFilter(); f.type = o.filter || "bandpass";
  const fr = o.freq || 1500; f.frequency.setValueAtTime(fr, t);
  if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, fr * o.slide), t + dur);
  f.Q.value = o.q ?? 0.9;
  const g = c.createGain(), v = o.vol ?? 0.1; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(o.bus || AU.sfxBus); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.03);
}
const arp = (t, notes, gap, o) => notes.forEach((f, i) => voice(f, t + i * gap, o.len || 0.14, o));
const SFX = {
  pulse: (t) => voice(1400 + Math.random() * 200, t, 0.05, { duty: 0.25, vol: 0.022, slide: 0.6 }),
  cannon: (t) => { noiseV(t, 0.18, { filter: "lowpass", freq: 900, slide: 0.3, vol: 0.09 }); voice(120, t, 0.12, { type: "sine", vol: 0.08, slide: 0.5 }); },
  boom: (t) => noiseV(t, 0.32, { filter: "lowpass", freq: 1300, slide: 0.18, vol: 0.1 }),
  arc: (t) => { noiseV(t, 0.12, { filter: "highpass", freq: 3000, vol: 0.05 }); voice(220, t, 0.1, { duty: 0.125, vol: 0.03, slide: 2 }); },
  rail: (t) => { voice(2400, t, 0.25, { type: "sawtooth", vol: 0.035, slide: 0.2, lp: 4000 }); noiseV(t, 0.2, { filter: "highpass", freq: 2000, vol: 0.05 }); },
  mortar: (t) => { voice(90, t, 0.2, { type: "sine", vol: 0.1, slide: 0.6 }); noiseV(t, 0.12, { filter: "lowpass", freq: 600, vol: 0.06 }); },
  freeze: (t) => voice(1800, t, 0.12, { type: "triangle", vol: 0.012, slide: 0.7 }),
  laser: (t) => voice(660, t, 0.09, { type: "sawtooth", vol: 0.012, lp: 1800 }),
  build: (t) => { voice(330, t, 0.07, { duty: 0.5, vol: 0.05 }); voice(660, t + 0.06, 0.12, { duty: 0.5, vol: 0.05 }); noiseV(t, 0.08, { filter: "lowpass", freq: 600, vol: 0.06 }); },
  upgrade: (t) => arp(t, [523, 659, 784, 1046], 0.05, { duty: 0.25, vol: 0.05, len: 0.12 }),
  sell: (t) => { voice(1046, t, 0.06, { duty: 0.5, vol: 0.04 }); voice(784, t + 0.06, 0.1, { duty: 0.5, vol: 0.04 }); },
  deny: (t) => voice(140, t, 0.16, { type: "square", vol: 0.05 }),
  kill: (t) => voice(500 + Math.random() * 300, t, 0.06, { duty: 0.5, vol: 0.022, slide: 1.8 }),
  leak: (t) => { voice(220, t, 0.25, { type: "sawtooth", vol: 0.07, slide: 0.5 }); voice(165, t + 0.12, 0.3, { type: "sawtooth", vol: 0.06, slide: 0.5 }); },
  wave: (t) => { noiseV(t, 0.5, { freq: 400, slide: 6, vol: 0.06, q: 2 }); voice(220, t, 0.4, { duty: 0.25, vol: 0.04, slide: 2 }); },
  clear: (t) => arp(t, [784, 988, 1175, 1568], 0.07, { type: "triangle", vol: 0.06, len: 0.22 }),
  boss: (t) => { for (let i = 0; i < 3; i++) { voice(440, t + i * 0.32, 0.18, { type: "square", vol: 0.05 }); voice(330, t + i * 0.32 + 0.16, 0.16, { type: "square", vol: 0.05 }); } },
  win: (t) => arp(t, [523, 659, 784, 1046, 1318, 1568], 0.1, { duty: 0.25, vol: 0.06, len: 0.5 }),
  lose: (t) => arp(t, [392, 330, 262, 196], 0.18, { type: "triangle", vol: 0.08, len: 0.5 }),
  move: (t) => voice(700, t, 0.03, { duty: 0.5, vol: 0.02 }),
  ok: (t) => voice(988, t, 0.07, { duty: 0.25, vol: 0.04 }),
  back: (t) => voice(494, t, 0.07, { duty: 0.25, vol: 0.035 }),
  ach: (t) => arp(t, [784, 988, 1175, 1568], 0.07, { type: "triangle", vol: 0.06, len: 0.2 }),
  paint: (t) => voice(880 + Math.random() * 120, t, 0.03, { type: "triangle", vol: 0.025 }),
  shield: (t) => voice(1200, t, 0.15, { type: "sine", vol: 0.03, slide: 0.5 }),
  split: (t) => voice(300, t, 0.1, { duty: 0.25, vol: 0.03, slide: 2 }),
};
const SFX_GAP = { pulse: 0.05, cannon: 0.08, boom: 0.07, arc: 0.07, rail: 0.1, mortar: 0.1, freeze: 0.25, laser: 0.12, kill: 0.035, move: 0.03, paint: 0.04, shield: 0.1, split: 0.06 };
function sfx(name) {
  if (!SAVE.settings.sfx) return;
  const c = audio(); if (!c || !SFX[name]) return;
  const now = c.currentTime;
  if (now - (AU.last[name] || -1) < (SFX_GAP[name] ?? 0.02)) return;
  AU.last[name] = now; SFX[name](now + 0.005);
}

/* ---------- music (same tracker as the other arcade games) ---------- */
const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
function midi(n) { const m = /^([a-g])(#|b)?(-?\d)$/.exec(n); if (!m) return 60; return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); }
const mhz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function chordOf(name) { const m = /^([A-G])(#|b)?(m)?(7)?$/.exec(name) || [0, "C"]; const root = (NOTE[m[1].toLowerCase()] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12; return { root, third: m[3] ? 3 : 4, seventh: m[4] ? 10 : 12 }; }
function compileSong(d) {
  if (d._c) return d._c;
  const bars = d.chords.length, N = bars * 16, lead = new Array(N).fill(null); let last = -1;
  d.lead.forEach((bar, bi) => { const tok = bar.trim().split(/\s+/), per = 16 / tok.length; tok.forEach((tk, i) => { const s = bi * 16 + Math.round(i * per); if (tk === "-") { if (last >= 0) lead[last].len += per; } else if (tk === ".") last = -1; else { lead[s] = { m: midi(tk), len: per }; last = s; } }); });
  return (d._c = { bpm: d.bpm, N, lead, chords: d.chords.map(chordOf), bass: d.bass.trim().split(/\s+/), drums: d.drums ? d.drums.trim().split(/\s+/) : null, arp: !!d.arp, pad: !!d.pad, leadVol: d.leadVol || 0.05, arpVol: d.arpVol || 0.028 });
}
const MUS = { id: "", song: null, step: 0, next: 0, level: 3 };
function musicPlay(id, level) { if (level !== undefined) MUS.level = level; if (MUS.id === id) return; MUS.id = id; MUS.song = SONGS[id] ? compileSong(SONGS[id]) : null; MUS.step = 0; const c = audio(); if (c) MUS.next = c.currentTime + 0.1; }
function playStep(S, step, t, sd) {
  const bar = (step / 16) | 0, s = step & 15, ch = S.chords[bar], L = MUS.level, bus = AU.musBus;
  const b = S.bass[s];
  if (b && b !== ".") { let m = 36 + ch.root + (b === "O" ? 12 : b === "F" ? 7 : b === "T" ? ch.third : 0); if (m < 40) m += 12; voice(mhz(m), t, sd * 1.6, { type: "sawtooth", vol: 0.07, bus, lp: 700, attack: 0.003 }); }
  if (S.pad && s === 0) for (const iv of [0, ch.third, 7]) voice(mhz(48 + ch.root + iv), t, sd * 16, { type: "sawtooth", vol: 0.012, bus, attack: 0.4, hold: true, release: 0.5, lp: 1200 });
  if (L >= 2 && S.drums) { const k = S.drums[s] || "."; const bb = AU.musBus;
    if (k.includes("k")) voice(150, t, 0.18, { type: "sine", vol: 0.3, slide: 0.25, slideT: 0.12, bus: bb });
    if (k.includes("s")) { noiseV(t, 0.14, { freq: 2000, vol: 0.09, q: 0.6, bus: bb }); }
    if (k.includes("h")) noiseV(t, 0.03, { filter: "highpass", freq: 8000, vol: 0.04, bus: bb }); }
  if (L >= 1 && S.arp) { const iv = [0, 7, ch.third + 12, 12, 7, ch.third, 12, 7][s % 8]; voice(mhz(60 + ch.root + iv), t, sd * 0.8, { duty: 0.125, vol: S.arpVol, bus }); }
  if (L >= 3) { const n = S.lead[step]; if (n) voice(mhz(n.m), t, n.len * sd * 0.94, { duty: 0.25, vol: S.leadVol, bus, hold: true, release: 0.05, attack: 0.008 }); }
}
function musicTick() {
  const c = AU.ctx; if (!c || !MUS.song || c.state !== "running") return;
  const S = MUS.song, sd = 60 / S.bpm / 4;
  if (MUS.next < c.currentTime - 0.25) MUS.next = c.currentTime + 0.05;
  while (MUS.next < c.currentTime + 0.15) { playStep(S, MUS.step, MUS.next, sd); MUS.next += sd; MUS.step = (MUS.step + 1) % S.N; }
}
setInterval(musicTick, 30);

/* ---------- input helpers ---------- */
const IN = { device: "mouse" };
function readPad() {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of gps) {
    if (!g || !g.connected || !g.buttons || !g.buttons.length) continue;
    const b = (i) => !!(g.buttons[i] && g.buttons[i].pressed);
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
    return { a: b(0), b: b(1), x: b(2), y: b(3), lb: b(4), rb: b(5), lt: b(6), rt: b(7), back: b(8), start: b(9),
      up: b(12) || ay < -0.55, down: b(13) || ay > 0.55, left: b(14) || ax < -0.55, right: b(15) || ax > 0.55 };
  }
  return null;
}
function navList(root) { return $$("button:not([disabled]), input, select, textarea, [data-nav]", root).filter((el) => el.offsetParent !== null && !el.closest("[hidden]")); }
function navMove(root, dx, dy) {
  const list = navList(root); if (!list.length) return false;
  const cur = document.activeElement;
  if (cur && cur.type === "range" && dx && list.includes(cur)) { cur.value = clamp(+cur.value + dx * (+cur.step || 0.05), +cur.min, +cur.max); cur.dispatchEvent(new Event("input", { bubbles: true })); return true; }
  if (!list.includes(cur)) { (root.querySelector("[autofocus]:not([disabled])") || list[0]).focus(); return true; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bs = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const q = el.getBoundingClientRect(), ex = q.left + q.width / 2, ey = q.top + q.height / 2;
    const along = dx ? (ex - cx) * dx : (ey - cy) * dy; if (along <= 2) continue;
    const perp = dx ? (q.bottom < r.top ? r.top - q.bottom : q.top > r.bottom ? q.top - r.bottom : 0) : (q.right < r.left ? r.left - q.right : q.left > r.right ? q.left - r.right : 0);
    const score = along + perp * 3; if (score < bs) { bs = score; best = el; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: "nearest", inline: "nearest" }); return true; }
  return false;
}
function copyText(text, msgEl) {
  const done = () => { if (msgEl) { msgEl.textContent = "Copied to clipboard."; msgEl.className = "msg"; } sfx("ok"); };
  const fallback = () => { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch { if (msgEl) { msgEl.textContent = "Couldn't copy. Select the text and copy it yourself."; msgEl.className = "msg err"; } } t.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
}
/* soft glow sprites, drawn with "lighter" */
const _glow = {};
function glow(r, color) {
  r = Math.max(2, Math.round(r)); const k = r + color; if (_glow[k]) return _glow[k];
  const c = document.createElement("canvas"); c.width = c.height = r * 2; const g = c.getContext("2d");
  const gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, color); gr.addColorStop(0.35, color.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * 0.45).toFixed(3) + ")")); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return (_glow[k] = c);
}
