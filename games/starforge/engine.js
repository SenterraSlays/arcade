"use strict";
/* STARFORGE · engine.js — number formatting, storage + save codes, synth sound and ambient music */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

/* ---------- numbers ---------- */
const SHORT = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc", "SpDc", "OcDc", "NoDc", "Vg", "UVg", "DVg", "TVg", "QaVg", "QiVg", "SxVg", "SpVg", "OcVg", "NoVg", "Tg"];
const LONG = ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion", "sextillion", "septillion", "octillion", "nonillion", "decillion", "undecillion", "duodecillion", "tredecillion", "quattuordecillion", "quindecillion", "sexdecillion", "septendecillion", "octodecillion", "novemdecillion", "vigintillion", "unvigintillion", "duovigintillion", "trevigintillion", "quattuorvigintillion", "quinvigintillion", "sexvigintillion", "septenvigintillion", "octovigintillion", "novemvigintillion", "trigintillion"];
function fmtNum(n, style) {
  style = style || (typeof S !== "undefined" ? S.settings.fmt : "short");
  if (!isFinite(n)) return "∞";
  if (n < 0) return "-" + fmtNum(-n, style);
  if (n < 10) return (Math.floor(n * 10) / 10).toString();
  if (n < 1e6) return Math.floor(n).toLocaleString("en-US");
  if (style === "sci") return n.toExponential(3).replace("e+", "e");
  const k = Math.floor(Math.log10(n) / 3);
  if (k >= SHORT.length) return n.toExponential(3).replace("e+", "e");
  const v = n / Math.pow(10, k * 3), s = v >= 100 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v.toFixed(3);
  return style === "long" ? `${s} ${LONG[k]}` : s + SHORT[k];
}
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

/* ---------- storage + codes ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
function b64e(str) { const b = new TextEncoder().encode(str); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function b64d(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new TextDecoder().decode(u); }
const CODE_PREFIX = "STARFORGE-SAVE:";
function toCode(json) { const b = b64e(json); return CODE_PREFIX + b + "." + hashStr(b).toString(36); }
function fromCode(code) {
  code = String(code || "").replace(/\s+/g, "");
  if (!code.startsWith(CODE_PREFIX)) throw new Error("That isn't a STARFORGE save code. It should start with " + CODE_PREFIX);
  const body = code.slice(CODE_PREFIX.length), dot = body.lastIndexOf(".");
  if (dot < 0) throw new Error("The code is cut off. Copy the whole thing and try again.");
  const b = body.slice(0, dot);
  if (hashStr(b).toString(36) !== body.slice(dot + 1)) throw new Error("The code is damaged. Copy the whole thing and try again.");
  try { return b64d(b); } catch { throw new Error("The code couldn't be read."); }
}
function copyText(text, msgEl) {
  const done = () => { if (msgEl) { msgEl.textContent = "Copied to clipboard."; msgEl.className = "msg"; } };
  const fallback = () => { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch { if (msgEl) { msgEl.textContent = "Couldn't copy. Select the text and copy it yourself."; msgEl.className = "msg err"; } } t.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
}

/* ---------- audio ---------- */
const AU = { ctx: null, sfxBus: null, musBus: null, noise: null, last: {}, rev: null };
function audio() {
  if (!AU.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { AU.ctx = new AC(); } catch { return null; }
    const c = AU.ctx, comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(c.destination);
    // a simple feedback-delay "space" for the music and chimes
    const dl = c.createDelay(1), fb = c.createGain(), wet = c.createGain(), lp = c.createBiquadFilter();
    dl.delayTime.value = 0.33; fb.gain.value = 0.38; wet.gain.value = 0.32; lp.type = "lowpass"; lp.frequency.value = 2400;
    dl.connect(lp).connect(fb).connect(dl); lp.connect(wet).connect(comp);
    AU.rev = dl;
    AU.sfxBus = c.createGain(); AU.sfxBus.connect(comp); AU.sfxBus.connect(dl);
    AU.musBus = c.createGain(); AU.musBus.connect(comp); AU.musBus.connect(dl);
    const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = n;
    applyVolumes();
  }
  if (AU.ctx.state === "suspended" && !document.hidden) AU.ctx.resume().catch(() => {});
  return AU.ctx;
}
function applyVolumes() { if (!AU.ctx || typeof S === "undefined") return; AU.sfxBus.gain.value = S.settings.sfx * S.settings.sfx * 0.8; AU.musBus.gain.value = S.settings.music * S.settings.music * 0.55; }
function voice(freq, t, dur, o = {}) {
  const c = AU.ctx; if (!c) return;
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type || "sine"; osc.frequency.setValueAtTime(freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + dur);
  const v = o.vol ?? 0.1, a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
  if (o.hold) g.gain.setValueAtTime(v, t + Math.max(a, dur - (o.release ?? 0.3)));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc.connect(g);
  if (o.lp) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; node = node.connect(f); }
  node.connect(o.bus || AU.sfxBus); osc.start(t); osc.stop(t + dur + 0.05);
}
function noiseV(t, dur, o = {}) {
  const c = AU.ctx; if (!c) return;
  const s = c.createBufferSource(); s.buffer = AU.noise;
  const f = c.createBiquadFilter(); f.type = o.filter || "bandpass"; const fr = o.freq || 1500; f.frequency.setValueAtTime(fr, t);
  if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, fr * o.slide), t + dur);
  f.Q.value = o.q ?? 0.8;
  const g = c.createGain(), v = o.vol ?? 0.1; g.gain.setValueAtTime(o.attack ? 0.0001 : v, t); if (o.attack) g.gain.linearRampToValueAtTime(v, t + o.attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(o.bus || AU.sfxBus); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.05);
}
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const SFX = {
  click: (t) => { const n = PENTA[(Math.random() * 7) | 0], f = 523 * Math.pow(2, n / 12); voice(f, t, 0.35, { type: "triangle", vol: 0.07 }); voice(f * 2, t, 0.2, { type: "sine", vol: 0.025 }); },
  crit: (t) => { [0, 4, 7, 12].forEach((n, i) => voice(784 * Math.pow(2, n / 12), t + i * 0.035, 0.4, { type: "triangle", vol: 0.06 })); },
  buy: (t) => { voice(660, t, 0.12, { type: "triangle", vol: 0.06 }); voice(990, t + 0.06, 0.25, { type: "triangle", vol: 0.05 }); },
  upgrade: (t) => [0, 4, 7, 11, 14].forEach((n, i) => voice(659 * Math.pow(2, n / 12), t + i * 0.05, 0.5, { type: "triangle", vol: 0.05 })),
  deny: (t) => voice(180, t, 0.18, { type: "sine", vol: 0.07, slide: 0.7 }),
  ach: (t) => [0, 7, 12, 16].forEach((n, i) => voice(784 * Math.pow(2, n / 12), t + i * 0.08, 0.7, { type: "sine", vol: 0.06 })),
  comet: (t) => { noiseV(t, 1.6, { freq: 3000, slide: 0.4, vol: 0.05, attack: 0.4, q: 2 }); [0, 7, 12].forEach((n, i) => voice(1046 * Math.pow(2, n / 12), t + 0.2 + i * 0.12, 0.9, { type: "sine", vol: 0.035 })); },
  catch: (t) => { [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => voice(523 * Math.pow(2, n / 12), t + i * 0.045, 0.8, { type: "triangle", vol: 0.055 })); noiseV(t, 0.6, { filter: "highpass", freq: 5000, vol: 0.04 }); },
  nova: (t) => { noiseV(t, 3.5, { filter: "lowpass", freq: 300, slide: 8, vol: 0.25, attack: 0.9 }); voice(55, t, 4, { type: "sawtooth", vol: 0.08, lp: 400, attack: 0.8, slide: 2 }); [0, 7, 12, 16, 19, 24].forEach((n, i) => voice(262 * Math.pow(2, n / 12), t + 1.2 + i * 0.12, 2.5, { type: "sine", vol: 0.05 })); },
  node: (t) => [0, 5, 9, 12].forEach((n, i) => voice(880 * Math.pow(2, n / 12), t + i * 0.06, 0.8, { type: "sine", vol: 0.05 })),
  tab: (t) => voice(1200, t, 0.06, { type: "sine", vol: 0.03 }),
};
const SFX_GAP = { click: 0.03, buy: 0.05, tab: 0.03 };
function sfx(name) {
  if (typeof S === "undefined" || !S.settings.sfx) return;
  const c = audio(); if (!c || !SFX[name]) return;
  const now = c.currentTime; if (now - (AU.last[name] || -1) < (SFX_GAP[name] ?? 0.02)) return;
  AU.last[name] = now; SFX[name](now + 0.005);
}
/* Ambient music: slow evolving chords with a soft arpeggio, generated forever. */
const MUS = { next: 0, step: 0, chord: 0, on: true };
const PROG = [[57, 60, 64, 67], [53, 57, 60, 64], [60, 64, 67, 71], [55, 59, 62, 67], [57, 60, 64, 69], [50, 53, 57, 60], [52, 55, 59, 64], [55, 59, 62, 65]];
const mhz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function musicTick() {
  const c = AU.ctx; if (!c || c.state !== "running" || typeof S === "undefined" || !S.settings.music) return;
  const beat = 60 / 64 / 2;
  if (MUS.next < c.currentTime - 0.3) MUS.next = c.currentTime + 0.05;
  while (MUS.next < c.currentTime + 0.2) {
    const t = MUS.next, s = MUS.step % 16, ch = PROG[MUS.chord % PROG.length];
    if (s === 0) {
      for (const m of ch) voice(mhz(m - 12), t, beat * 16, { type: "sine", vol: 0.035, attack: 1.2, hold: true, release: 1.4, bus: AU.musBus });
      voice(mhz(ch[0] - 24), t, beat * 16, { type: "triangle", vol: 0.05, attack: 0.6, hold: true, release: 1.2, bus: AU.musBus, lp: 500 });
    }
    if (s % 2 === 0 && Math.random() < 0.7) { const m = ch[(s / 2 + MUS.chord) % 4] + 12 + (Math.random() < 0.3 ? 12 : 0); voice(mhz(m), t, beat * 3, { type: "triangle", vol: 0.018, bus: AU.musBus }); }
    MUS.next += beat; MUS.step++;
    if (MUS.step % 16 === 0) MUS.chord++;
  }
}
setInterval(musicTick, 40);
