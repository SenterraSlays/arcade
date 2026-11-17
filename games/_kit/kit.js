"use strict";
/* SENTERRA ARCADE KIT (v1)
   Shared by the arcade's games: helpers, seeded RNG, saves + share codes, synth sound effects,
   a small chiptune tracker, keyboard / gamepad / touch input, menus with spatial navigation,
   toasts, banners, confirm dialogs and a frame loop. Keep changes backward compatible. */
(function (global) {
  const K = {};

  /* ================= helpers ================= */
  K.$ = (s, r = document) => r.querySelector(s);
  K.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  K.TAU = Math.PI * 2;
  K.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  K.lerp = (a, b, t) => a + (b - a) * t;
  K.rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  K.rndi = (n) => (Math.random() * n) | 0;
  K.pick = (a) => a[(Math.random() * a.length) | 0];
  K.shuffle = (a, r = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  K.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  K.fmt = (n) => Math.floor(n).toLocaleString("en-US");
  K.fmtTime = (s) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
  K.fmtMs = (ms) => { ms = Math.max(0, Math.round(ms)); const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000; return m + ":" + String(s).padStart(2, "0") + "." + String(r).padStart(3, "0"); };
  K.today = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  K.hash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  K.RNG = (seed) => {
    let a = (seed >>> 0) || 0x9e3779b9;
    const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.int = (n) => (f() * n) | 0;
    f.pick = (arr) => arr[(f() * arr.length) | 0];
    f.shuffle = (arr) => K.shuffle(arr, f);
    f.chance = (p) => f() < p;
    f.weighted = (items, w) => { let tot = 0; for (const it of items) tot += w(it); let r = f() * tot; for (const it of items) { r -= w(it); if (r <= 0) return it; } return items[items.length - 1]; };
    return f;
  };
  K.dailySeed = (game, date = K.today()) => K.hash(game + ":" + date);
  K.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3), inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    outQuad: (t) => 1 - (1 - t) * (1 - t),
  };

  /* ================= storage + codes ================= */
  K.store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  /* Deep-merges saved data over defaults, keeping only keys/types the defaults know (plus free-form maps). */
  K.merge = function merge(base, over) {
    if (over === null || typeof over !== "object") return base;
    if (Array.isArray(base)) return Array.isArray(over) ? over.slice(0, 5000) : base;
    const out = { ...base };
    for (const k of Object.keys(over)) {
      if (k === "__proto__" || k === "constructor") continue;
      const b = base[k], o = over[k];
      if (b !== null && typeof b === "object") out[k] = merge(b, o);
      else if (b === undefined) out[k] = o;
      else if (typeof o === typeof b) out[k] = o;
    }
    return out;
  };
  K.load = (key, defaults) => { let d = null; try { d = JSON.parse(K.store.get(key) || "null"); } catch {} return K.merge(defaults, d); };
  K.save = (key, obj) => K.store.set(key, JSON.stringify(obj));
  function b64e(str) { const b = new TextEncoder().encode(str); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  function b64d(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new TextDecoder().decode(u); }
  K.encode = (prefix, obj) => { const b = b64e(JSON.stringify(obj)); return prefix + b + "." + K.hash(b).toString(36); };
  K.decode = (prefix, code, what = "save") => {
    code = String(code || "").replace(/\s+/g, "");
    if (!code.startsWith(prefix)) throw new Error(`That isn't a ${what} code. It should start with ${prefix}`);
    const body = code.slice(prefix.length), dot = body.lastIndexOf(".");
    if (dot < 0) throw new Error("The code is cut off. Copy the whole thing and try again.");
    const b = body.slice(0, dot);
    if (K.hash(b).toString(36) !== body.slice(dot + 1)) throw new Error("The code is damaged. Copy the whole thing and try again.");
    try { return JSON.parse(b64d(b)); } catch { throw new Error("The code couldn't be read."); }
  };
  K.copy = (text) => new Promise((res) => {
    const fallback = () => { const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand("copy"); } catch {} t.remove(); res(ok); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => res(true), fallback); else fallback();
  });

  /* ================= audio ================= */
  K.audioSettings = K.load("arcade.audio", { music: 0.5, sfx: 0.7, vibrate: true });
  const AU = (K.AU = { ctx: null, sfxBus: null, musBus: null, noise: null, waves: {}, last: {} });
  K.audio = () => {
    if (!AU.ctx) {
      const AC = global.AudioContext || global.webkitAudioContext; if (!AC) return null;
      try { AU.ctx = new AC(); } catch { return null; }
      const c = AU.ctx, comp = c.createDynamicsCompressor();
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
      K.applyVolumes();
    }
    if (AU.ctx.state === "suspended" && !document.hidden) AU.ctx.resume().catch(() => {});
    return AU.ctx;
  };
  K.applyVolumes = () => { if (!AU.ctx) return; const s = K.audioSettings; AU.sfxBus.gain.value = s.sfx * s.sfx * 0.9; AU.musBus.gain.value = s.music * s.music * 0.6; };
  K.saveAudio = () => { K.save("arcade.audio", K.audioSettings); K.applyVolumes(); };
  /* voice(freq, startTime, duration, { type | duty, vol, slide, slideT, attack, hold, release, lp, bus }) */
  K.voice = (freq, t, dur, o = {}) => {
    const c = AU.ctx; if (!c) return;
    const osc = c.createOscillator(), g = c.createGain();
    if (o.duty) osc.setPeriodicWave(AU.waves[o.duty]); else osc.type = o.type || "square";
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + (o.slideT || dur));
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = freq * 0.012; l.connect(lg).connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
    const v = o.vol ?? 0.1, a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
    if (o.hold) g.gain.setValueAtTime(v, t + Math.max(a, dur - (o.release ?? 0.06)));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc.connect(g);
    if (o.lp) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; node = node.connect(f); }
    node.connect(o.bus || AU.sfxBus); osc.start(t); osc.stop(t + dur + 0.04);
  };
  K.noise = (t, dur, o = {}) => {
    const c = AU.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = AU.noise;
    const f = c.createBiquadFilter(); f.type = o.filter || "bandpass";
    const fr = o.freq || 1500; f.frequency.setValueAtTime(fr, t);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, fr * o.slide), t + dur);
    f.Q.value = o.q ?? 0.9;
    const g = c.createGain(), v = o.vol ?? 0.1;
    if (o.attack) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + o.attack); } else g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(o.bus || AU.sfxBus); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.04);
  };
  K.notes = (t, freqs, gap, o) => freqs.forEach((f, i) => K.voice(f, t + i * gap, o.len || 0.14, o));
  K.hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  K.SFX = {
    move: (t) => K.voice(700, t, 0.035, { duty: 0.5, vol: 0.022 }),
    ok: (t) => K.voice(988, t, 0.07, { duty: 0.25, vol: 0.04 }),
    back: (t) => K.voice(494, t, 0.07, { duty: 0.25, vol: 0.035 }),
    deny: (t) => K.voice(150, t, 0.15, { type: "square", vol: 0.045 }),
    toast: (t) => K.notes(t, [784, 988, 1175, 1568], 0.07, { type: "triangle", vol: 0.055, len: 0.2 }),
    win: (t) => K.notes(t, [523, 659, 784, 1046, 1318, 1568], 0.09, { duty: 0.25, vol: 0.055, len: 0.45 }),
    lose: (t) => K.notes(t, [392, 330, 262, 196], 0.16, { type: "triangle", vol: 0.07, len: 0.45 }),
    coin: (t) => { K.voice(1318, t, 0.05, { duty: 0.5, vol: 0.035 }); K.voice(1760, t + 0.05, 0.12, { duty: 0.5, vol: 0.035 }); },
    pop: (t) => K.voice(520 + Math.random() * 200, t, 0.08, { duty: 0.5, vol: 0.035, slide: 1.8 }),
    click: (t) => K.voice(1200, t, 0.025, { type: "triangle", vol: 0.03 }),
  };
  const SFX_GAP = { move: 0.03, click: 0.02, pop: 0.03 };
  K.defineSfx = (map, gaps = {}) => { Object.assign(K.SFX, map); Object.assign(SFX_GAP, gaps); };
  K.sfx = (name) => {
    if (!K.audioSettings.sfx) return;
    const c = K.audio(); if (!c || !K.SFX[name]) return;
    const now = c.currentTime;
    if (now - (AU.last[name] || -1) < (SFX_GAP[name] ?? 0.02)) return;
    AU.last[name] = now; K.SFX[name](now + 0.005);
  };
  K.vibrate = (ms) => { if (K.audioSettings.vibrate && navigator.vibrate && K.device === "touch") try { navigator.vibrate(ms); } catch {} };

  /* ---------- music tracker ----------
     Song: { bpm, chords: ["Am","F",...] (one per bar), bass: "R . O F ..." (16 steps), drums: "k . h s ..." (16),
             lead: ["a4 - c5 . ..." per bar], arp, pad, leadWave (duty or osc type), bassWave, leadVol, arpVol, padVol }
     Levels: 0 bass(+pad), 1 +arp, 2 +drums, 3 +lead. */
  const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function midi(n) { const m = /^([a-g])(#|b)?(-?\d)$/.exec(n); if (!m) return 60; return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); }
  function chordOf(name) { const m = /^([A-G])(#|b)?(m)?(7)?$/.exec(name) || [0, "C"]; const root = (NOTE[m[1].toLowerCase()] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12; return { root, third: m[3] ? 3 : 4, seventh: m[4] ? 10 : 12 }; }
  function compileSong(d) {
    if (d._c) return d._c;
    const bars = d.chords.length, N = bars * 16, lead = new Array(N).fill(null); let last = -1;
    (d.lead || []).forEach((bar, bi) => { const tok = bar.trim().split(/\s+/), per = 16 / tok.length; tok.forEach((tk, i) => { const s = bi * 16 + Math.round(i * per); if (tk === "-") { if (last >= 0) lead[last].len += per; } else if (tk === ".") last = -1; else { lead[s] = { m: midi(tk), len: per }; last = s; } }); });
    return (d._c = { ...d, N, leadC: lead, chordsC: d.chords.map(chordOf), bassC: (d.bass || "R . . . . . . . . . . . . . . .").trim().split(/\s+/), drumsC: d.drums ? d.drums.trim().split(/\s+/) : null });
  }
  const MUS = (K.MUS = { id: "", song: null, step: 0, next: 0, level: 3, songs: {} });
  K.songs = (map) => Object.assign(MUS.songs, map);
  K.playSong = (id, level) => { if (level !== undefined) MUS.level = level; if (MUS.id === id) return; MUS.id = id; MUS.song = MUS.songs[id] ? compileSong(MUS.songs[id]) : null; MUS.step = 0; const c = K.audio(); if (c) MUS.next = c.currentTime + 0.08; };
  K.musicLevel = (l) => { MUS.level = l; };
  K.stopMusic = () => { MUS.id = ""; MUS.song = null; };
  function waveOpt(w, fallback) { w = w ?? fallback; return typeof w === "number" ? { duty: w } : { type: w }; }
  function playStep(S, step, t, sd) {
    const bar = (step / 16) | 0, s = step & 15, ch = S.chordsC[bar], L = MUS.level, bus = AU.musBus;
    const b = S.bassC[s];
    if (b && b !== ".") { let m = 36 + ch.root + (b === "O" ? 12 : b === "F" ? 7 : b === "T" ? ch.third : 0); if (m < 40) m += 12; K.voice(K.hz(m), t, sd * (S.bassLen || 1.6), { ...waveOpt(S.bassWave, "triangle"), vol: S.bassVol || 0.14, bus, attack: 0.003, lp: S.bassLp }); }
    if (S.pad && s === 0) for (const iv of [0, ch.third, 7]) K.voice(K.hz(48 + ch.root + iv), t, sd * 16, { ...waveOpt(S.padWave, "triangle"), vol: S.padVol || 0.025, bus, attack: 0.3, hold: true, release: 0.5, lp: 1800 });
    if (L >= 2 && S.drumsC) {
      const k = S.drumsC[s] || ".";
      if (k.includes("k")) K.voice(150, t, 0.18, { type: "sine", vol: 0.32, slide: 0.25, slideT: 0.12, bus });
      if (k.includes("s")) { K.noise(t, 0.13, { freq: 1900, vol: 0.1, q: 0.6, bus }); K.voice(185, t, 0.07, { type: "triangle", vol: 0.06, bus }); }
      if (k.includes("h")) K.noise(t, 0.035, { filter: "highpass", freq: 7500, vol: 0.042, bus });
    }
    if (L >= 1 && S.arp) { const pat = S.arpPat || [0, 1, 2, 3]; const iv = [0, ch.third, 7, 12, ch.seventh][pat[s % pat.length]]; K.voice(K.hz(60 + ch.root + iv), t, sd * 0.85, { ...waveOpt(S.arpWave, 0.125), vol: S.arpVol || 0.026, bus }); }
    if (L >= 3) { const n = S.leadC[step]; if (n) K.voice(K.hz(n.m), t, n.len * sd * 0.94, { ...waveOpt(S.leadWave, 0.25), vol: S.leadVol || 0.055, bus, hold: true, release: 0.05, attack: 0.006, vib: S.vib }); }
  }
  setInterval(() => {
    const c = AU.ctx; if (!c || !MUS.song || c.state !== "running") return;
    const S = MUS.song, sd = 60 / S.bpm / 4;
    if (MUS.next < c.currentTime - 0.25) MUS.next = c.currentTime + 0.05;
    while (MUS.next < c.currentTime + 0.15) { playStep(S, MUS.step, MUS.next, sd * (S.swing && MUS.step % 2 ? 1 - S.swing : S.swing ? 1 + S.swing : 1)); MUS.next += sd * (S.swing ? (MUS.step % 2 ? 1 - S.swing : 1 + S.swing) : 1); MUS.step = (MUS.step + 1) % S.N; }
  }, 30);

  /* ================= input ================= */
  K.keys = new Set();
  K.device = "mouse";
  const touchClass = () => document.body && document.body.classList.toggle("touch", K.device === "touch");
  addEventListener("keydown", (e) => { K.audio(); K.keys.add(e.code); if (K.device !== "kb") { K.device = "kb"; touchClass(); } }, true);
  addEventListener("keyup", (e) => K.keys.delete(e.code), true);
  addEventListener("blur", () => K.keys.clear());
  addEventListener("pointerdown", (e) => { K.audio(); const d = e.pointerType === "touch" ? "touch" : e.pointerType === "pen" ? "touch" : "mouse"; if (d !== K.device) { K.device = d; touchClass(); } }, true);
  K.held = (...codes) => codes.some((c) => K.keys.has(c));
  /* Gamepad: call K.pad.poll() once per frame (K.loop does it). pressed = edges this frame. */
  K.pad = { held: {}, pressed: {}, ax: 0, ay: 0, rx: 0, ry: 0, lt: 0, rt: 0, connected: false, prev: {} };
  const PADMAP = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, ls: 10, rs: 11, up: 12, down: 13, left: 14, right: 15 };
  K.pad.poll = () => {
    const P = K.pad, gps = navigator.getGamepads ? navigator.getGamepads() : [];
    let g = null; for (const p of gps) if (p && p.connected && p.buttons && p.buttons.length) { g = p; break; }
    P.connected = !!g; const held = {};
    if (g) {
      for (const k in PADMAP) held[k] = !!(g.buttons[PADMAP[k]] && g.buttons[PADMAP[k]].pressed);
      const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
      P.ax = dz(g.axes[0] || 0); P.ay = dz(g.axes[1] || 0); P.rx = dz(g.axes[2] || 0); P.ry = dz(g.axes[3] || 0);
      P.lt = g.buttons[6] ? g.buttons[6].value || 0 : 0; P.rt = g.buttons[7] ? g.buttons[7].value || 0 : 0;
      if (held.left || P.ax < -0.55) held.dl = true; if (held.right || P.ax > 0.55) held.dr = true;
      if (held.up || P.ay < -0.55) held.du = true; if (held.down || P.ay > 0.55) held.dd = true;
      if (Object.values(held).some(Boolean) && K.device !== "pad") { K.device = "pad"; touchClass(); }
    } else { P.ax = P.ay = P.rx = P.ry = 0; }
    P.pressed = {}; for (const k in held) if (held[k] && !P.prev[k]) P.pressed[k] = true;
    P.held = held; P.prev = held;
  };

  /* ================= UI: screens, navigation, toasts ================= */
  const ui = (K.ui = { root: null, back: null, handler: null, navDir: 0, navT: 0 });
  function ensureRoot() {
    if (ui.root) return;
    ui.root = document.getElementById("ui") || Object.assign(document.createElement("div"), { id: "ui" });
    if (!ui.root.parentNode) document.body.appendChild(ui.root);
    for (const id of ["k-toasts", "k-banner"]) if (!document.getElementById(id)) { const d = document.createElement("div"); d.id = id; document.body.appendChild(d); }
    ui.root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]"); if (!b || b.disabled) return;
      if (ui.handler) ui.handler(b.dataset.a, b.dataset, b, e);
    });
  }
  ui.on = (fn) => { ensureRoot(); ui.handler = fn; };
  ui.show = (html, o = {}) => {
    ensureRoot();
    ui.root.innerHTML = `<div class="k-screen ${o.cls || ""}">${html}</div>`;
    ui.back = o.back || null;
    const s = ui.root.firstElementChild;
    if (K.device !== "touch" && o.focus !== false) { const f = (o.focusSel && s.querySelector(o.focusSel)) || s.querySelector("[autofocus]:not([disabled])") || ui.navList(s)[0]; if (f) f.focus({ preventScroll: true }); }
    return s;
  };
  ui.hide = () => { ensureRoot(); ui.root.innerHTML = ""; ui.back = null; };
  ui.active = () => !!(ui.root && ui.root.firstElementChild) || !!document.querySelector(".k-modal");
  ui.navList = (root) => K.$$("button:not([disabled]), input, select, textarea, [data-nav]", root).filter((el) => el.offsetParent !== null && !el.closest("[hidden]"));
  ui.nav = (dx, dy) => {
    const root = document.querySelector(".k-modal") || (ui.root && ui.root.firstElementChild); if (!root) return false;
    const list = ui.navList(root); if (!list.length) return false;
    const cur = document.activeElement;
    if (cur && cur.type === "range" && dx && list.includes(cur)) { cur.value = K.clamp(+cur.value + dx * (+cur.step || 0.05), +cur.min, +cur.max); cur.dispatchEvent(new Event("input", { bubbles: true })); return true; }
    if (!list.includes(cur)) { (root.querySelector("[autofocus]:not([disabled])") || list[0]).focus(); return true; }
    const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bs = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const q = el.getBoundingClientRect(), ex = q.left + q.width / 2, ey = q.top + q.height / 2;
      const along = dx ? (ex - cx) * dx : (ey - cy) * dy; if (along <= 2) continue;
      const perp = dx ? (q.bottom < r.top ? r.top - q.bottom : q.top > r.bottom ? q.top - r.bottom : 0) : (q.right < r.left ? r.left - q.right : q.left > r.right ? q.left - r.right : 0);
      const sc = along + perp * 3; if (sc < bs) { bs = sc; best = el; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: "nearest", inline: "nearest" }); K.sfx("move"); return true; }
    return false;
  };
  ui.goBack = () => { const m = document.querySelector(".k-modal"); if (m) { const no = m.querySelector("[data-no]"); if (no) no.click(); return; } if (ui.back && ui.handler) ui.handler(ui.back, {}, null); };
  ui.activate = () => {
    const root = document.querySelector(".k-modal") || (ui.root && ui.root.firstElementChild); if (!root) return;
    const el = document.activeElement;
    if (el && root.contains(el) && el.tagName === "BUTTON") el.click(); else { const f = ui.navList(root)[0]; if (f) f.focus(); }
  };
  addEventListener("keydown", (e) => {
    if (!ui.active()) return;
    const tg = e.target, typing = tg && (tg.tagName === "TEXTAREA" || (tg.tagName === "INPUT" && tg.type !== "range"));
    if (typing) { if (e.code === "Escape") tg.blur(); return; }
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.code];
    if (dir) { ui.nav(dir[0], dir[1]); e.preventDefault(); return; }
    if (e.code === "Escape") { ui.goBack(); e.preventDefault(); return; }
    if ((e.code === "Enter" || e.code === "Space") && !(document.activeElement && document.activeElement.tagName === "BUTTON")) { ui.activate(); e.preventDefault(); }
  });
  ui.padNav = (dt) => {
    if (!ui.active()) { ui.navDir = 0; return; }
    const P = K.pad.held, vy = P.du ? -1 : P.dd ? 1 : 0, vx = vy ? 0 : P.dl ? -1 : P.dr ? 1 : 0, nd = vy * 3 + vx;
    if (nd !== ui.navDir) { ui.navDir = nd; ui.navT = 0.36; if (nd) ui.nav(vx, vy); }
    else if (nd) { ui.navT -= dt; if (ui.navT <= 0) { ui.navT = 0.11; ui.nav(vx, vy); } }
    if (K.pad.pressed.a) ui.activate(); else if (K.pad.pressed.b) ui.goBack();
  };
  K.toast = (title, text = "", kind = "") => {
    ensureRoot();
    const box = document.getElementById("k-toasts"), el = document.createElement("div");
    el.className = "k-toast " + kind; el.innerHTML = `<b>${K.esc(title)}</b>${text ? `<span>${K.esc(text)}</span>` : ""}`;
    box.appendChild(el); while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 450); }, kind === "big" ? 4500 : 2800);
  };
  let bannerT = null;
  K.banner = (title, sub = "", ms = 2200, cls = "") => {
    ensureRoot();
    const b = document.getElementById("k-banner"); b.className = "on " + cls; b.innerHTML = `<b>${K.esc(title)}</b>${sub ? `<span>${K.esc(sub)}</span>` : ""}`;
    clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove("on"), ms);
  };
  /* K.confirm({ title, text, yes, no, danger }) → Promise<boolean> */
  K.confirm = (o) => new Promise((res) => {
    const m = document.createElement("div"); m.className = "k-modal";
    m.innerHTML = `<div class="k-dialog"><h2>${K.esc(o.title || "Are you sure?")}</h2>${o.text ? `<p>${o.text}</p>` : ""}<div class="k-row"><button class="k-btn ${o.danger ? "danger" : "primary"}" data-yes>${K.esc(o.yes || "Yes")}</button><button class="k-btn" data-no>${K.esc(o.no || "Cancel")}</button></div></div>`;
    document.body.appendChild(m);
    const done = (v) => { m.remove(); K.sfx(v ? "ok" : "back"); res(v); };
    m.querySelector("[data-yes]").onclick = () => done(true);
    m.querySelector("[data-no]").onclick = () => done(false);
    m.addEventListener("click", (e) => { if (e.target === m) done(false); });
    if (K.device !== "touch") m.querySelector(o.focusNo ? "[data-no]" : "[data-yes]").focus();
  });
  /* Standard audio + display settings rows. Call K.ui.bindSettings(screenEl) after showing. */
  ui.settingsRows = () => `
    <label class="k-opt"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${K.audioSettings.music}" data-kset="music" aria-label="Music volume"></label>
    <label class="k-opt"><span>Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${K.audioSettings.sfx}" data-kset="sfx" aria-label="Sound effects volume"></label>
    <div class="k-opt k-touchonly"><span>Vibration</span><button class="k-btn small" data-kvib>${K.audioSettings.vibrate ? "On" : "Off"}</button></div>
    <div class="k-opt"><span>Fullscreen</span><button class="k-btn small" data-kfs>Toggle</button></div>`;
  ui.bindSettings = (el) => {
    for (const r of K.$$("[data-kset]", el)) { r.addEventListener("input", () => { K.audioSettings[r.dataset.kset] = +r.value; K.saveAudio(); }); r.addEventListener("change", () => K.sfx("ok")); }
    const v = el.querySelector("[data-kvib]"); if (v) v.onclick = () => { K.audioSettings.vibrate = !K.audioSettings.vibrate; v.textContent = K.audioSettings.vibrate ? "On" : "Off"; K.saveAudio(); };
    const f = el.querySelector("[data-kfs]"); if (f) f.onclick = () => K.fullscreen();
  };
  K.fullscreen = () => { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (d.requestFullscreen) d.requestFullscreen().catch(() => {}); };

  /* ================= loop + lifecycle ================= */
  const pauseFns = [];
  K.onPause = (fn) => pauseFns.push(fn);
  addEventListener("blur", () => pauseFns.forEach((f) => f("blur")));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { pauseFns.forEach((f) => f("hidden")); if (AU.ctx && AU.ctx.state === "running") AU.ctx.suspend().catch(() => {}); }
    else K.audio();
  });
  /* K.loop(fn): fn(dt) every animation frame, dt clamped to 0.1s. Polls the gamepad and drives menu navigation. */
  K.loop = (fn) => {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
      K.pad.poll(); ui.padNav(dt);
      fn(dt, now);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  /* Fixed-step helper: accumulates dt and calls step(h) at a fixed rate. */
  K.fixed = (hz = 60) => { let acc = 0; const h = 1 / hz; return (dt, step) => { acc += dt; let n = 0; while (acc >= h && n < 8) { step(h); acc -= h; n++; } if (n >= 8) acc = 0; return acc / h; }; };

  /* ================= canvas helpers ================= */
  K.dpr = () => Math.min(2, global.devicePixelRatio || 1);
  /* Size a canvas to its CSS box at device resolution; returns { w, h, dpr }. */
  K.fit = (cv, w, h) => { const d = K.dpr(); cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv.style.width = w + "px"; cv.style.height = h + "px"; return { w, h, dpr: d }; };
  const _glow = {};
  K.glow = (rgb) => {
    if (_glow[rgb]) return _glow[rgb];
    const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.3, `rgba(${rgb},0.4)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return (_glow[rgb] = c);
  };
  K.drawGlow = (ctx, x, y, r, rgb, a = 1) => { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a; ctx.drawImage(K.glow(rgb), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = ga; };
  K.roundRect = (ctx, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  /* Tiny particle system. add({x,y,vx,vy,life,size,color(rgb string),g,drag,shrink}) */
  K.Particles = class {
    constructor(max = 600) { this.p = []; this.max = max; }
    add(o) { if (this.p.length >= this.max) this.p.shift(); this.p.push({ vx: 0, vy: 0, g: 0, drag: 0, size: 3, life: 0.6, shrink: true, ...o, max: o.life || 0.6 }); }
    burst(x, y, n, o = {}) { for (let i = 0; i < n; i++) { const a = Math.random() * K.TAU, v = (o.speed || 120) * (0.35 + Math.random() * 0.75); this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: (o.life || 0.6) * (0.6 + Math.random() * 0.6), size: (o.size || 3) * (0.6 + Math.random() * 0.7), color: Array.isArray(o.color) ? K.pick(o.color) : o.color || "255,255,255", g: o.g || 0, drag: o.drag ?? 1.5, shrink: o.shrink ?? true, glow: o.glow }); } }
    update(dt) { for (const q of this.p) { q.life -= dt; q.vy += q.g * dt; const d = Math.max(0, 1 - q.drag * dt); q.vx *= d; q.vy *= d; q.x += q.vx * dt; q.y += q.vy * dt; } this.p = this.p.filter((q) => q.life > 0); }
    draw(ctx, add = true) {
      if (add) ctx.globalCompositeOperation = "lighter";
      for (const q of this.p) { const k = q.life / q.max, s = q.shrink ? q.size * k : q.size; ctx.fillStyle = `rgba(${q.color},${Math.min(1, k * 1.5)})`; ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s); }
      ctx.globalCompositeOperation = "source-over";
    }
  };

  global.K = K;
})(window);
