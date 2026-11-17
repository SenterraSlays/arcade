"use strict";
/* VORTEX — orbit the core and slip through the closing walls. */
const { $, $$, clamp, lerp, TAU } = K;
const RC = 64, RP = RC + 20, RSPAWN = 980, OMEGA = 9.6;
const LEVELS = [
  { name: "DRIFT", desc: "Gentle. Learn the moves.", spd: 430, rot: 1.2, hue: 190, pats: ["gap", "gap", "alt", "pair"], song: "v1", bpm: 128 },
  { name: "SPIN", desc: "The world turns faster.", spd: 520, rot: 2.0, hue: 300, pats: ["gap", "alt", "pair", "triple", "spiral"], song: "v1", bpm: 136 },
  { name: "SURGE", desc: "Quicker walls, trickier gaps.", spd: 600, rot: 2.4, hue: 25, pats: ["gap", "alt", "pair", "triple", "spiral", "ladder"], song: "v2", bpm: 150 },
  { name: "RIFT", desc: "Corridors that twist.", spd: 690, rot: 2.8, hue: 120, pats: ["alt", "pair", "triple", "spiral", "ladder", "tunnel"], song: "v2", bpm: 158 },
  { name: "MAELSTROM", desc: "Everything, all at once.", spd: 790, rot: 3.3, hue: 350, pats: ["gap", "alt", "pair", "triple", "spiral", "ladder", "tunnel", "whirl"], song: "v3", bpm: 168 },
  { name: "SINGULARITY", desc: "Only for the brave.", spd: 920, rot: 3.9, hue: 265, pats: ["alt", "triple", "spiral", "ladder", "tunnel", "whirl", "pair"], song: "v3", bpm: 178 },
];
const RANKS = [[10, "SPARK"], [20, "FLARE"], [30, "NOVA"], [40, "PULSAR"], [50, "QUASAR"], [60, "ECLIPSE"], [90, "SUPERNOVA"], [120, "INFINITY"]];
const SAVE = K.load("vortex.v1", { best: [0, 0, 0, 0, 0, 0], unlocked: 1, last: 0, deaths: 0 });
const persist = () => K.save("vortex.v1", SAVE);

/* ================= state ================= */
let G = null, MENU_T = 0;
function start(li) {
  const Lv = LEVELS[li];
  G = { li, Lv, t: 0, sides: 6, tsides: 6, morph: 0, theta: -Math.PI / 2, walls: [], nextR: RSPAWN + 200, spd: Lv.spd, wrot: 0, rotSpd: Lv.rot, rotT: 4, rank: 0, dead: false, deadT: 0, pulse: 0, zoom: 1, flash: 0, shake: 0, beat: 0, sideT: 14 + Math.random() * 8, hueOff: 0 };
  SAVE.last = li; persist(); K.ui.hide(); K.playSong(Lv.song, 3); K.sfx("go");
  K.banner(Lv.name, "Survive 60 seconds to unlock the next level", 1600);
}
const secW = () => TAU / G.sides;
const sectorOf = (th) => { const w = secW(); return ((Math.floor(((th % TAU) + TAU) % TAU / w)) % G.sides + G.sides) % G.sides; };

/* ================= patterns ================= */
function rows(name, n, rnd) {
  const s = (rnd() * n) | 0, out = [], all = (except) => [...Array(n).keys()].filter((k) => !except.includes(k));
  const st = (k) => Math.abs(k) * (TAU / n) / OMEGA; // seconds to rotate k sectors
  switch (name) {
    case "gap": { let g = s; const reps = 1 + ((rnd() * 3) | 0); for (let i = 0; i < reps; i++) { const ng = i ? (g + ((rnd() * (n - 1)) | 0) + 1) % n : g, d = Math.min(Math.abs(ng - g), n - Math.abs(ng - g)); out.push({ b: all([ng]), th: 34, dt: 0.34 + st(d) }); g = ng; } break; }
    case "alt": { const reps = 3 + ((rnd() * 3) | 0); for (let i = 0; i < reps; i++) out.push({ b: [...Array(n).keys()].filter((k) => (k + i + s) % 2 === 0), th: 34, dt: 0.3 + st(1) }); break; }
    case "pair": { const opp = (s + Math.floor(n / 2)) % n; out.push({ b: all([s]), th: 34, dt: 0.36 + st(Math.floor(n / 2)) }, { b: all([opp]), th: 34, dt: 0.36 + st(Math.floor(n / 2)) }); if (rnd() < 0.5) out.push({ b: all([s]), th: 34, dt: 0.36 + st(Math.floor(n / 2)) }); break; }
    case "triple": { const dir = rnd() < 0.5 ? 1 : -1; for (let i = 0; i < 4; i++) { const base = (s + i * 2 * dir + n * 4) % n; out.push({ b: [base, (base + 1) % n, (base + 3) % n].filter((v, k, a) => a.indexOf(v) === k), th: 34, dt: 0.3 + st(2) }); } break; }
    case "spiral": { const dir = rnd() < 0.5 ? 1 : -1, len = n * 2 + ((rnd() * n) | 0); for (let i = 0; i < len; i++) out.push({ b: [(s + i * dir + n * 10) % n], th: 34, dt: 0.09 }); out.push({ b: [], th: 0, dt: 0.25 }); break; }
    case "ladder": { for (let i = 0; i < 5; i++) out.push({ b: i % 2 ? [s, (s + 1) % n, (s + 3) % n, (s + 4) % n] : [(s + 2) % n, (s + 5) % n], th: 30, dt: 0.32 + st(1) }); break; }
    case "tunnel": { let g = s; const dir = rnd() < 0.5 ? 1 : -1; for (let i = 0; i < 7; i++) { out.push({ b: all([g]), th: 60, dt: 0.16 + st(1) }); if (i % 2) g = (g + dir + n) % n; } break; }
    case "whirl": { const dir = rnd() < 0.5 ? 1 : -1; for (let i = 0; i < n * 2; i++) out.push({ b: [(s + i * dir + n * 10) % n, (s + i * dir + Math.floor(n / 2) + n * 10) % n], th: 34, dt: 0.12 }); out.push({ b: [], th: 0, dt: 0.3 }); break; }
  }
  return out;
}
function spawnPatterns() {
  while (G.nextR < RSPAWN + 220) {
    if (G.tsides !== G.sides) { if (G.walls.length) { G.nextR += 200; break; } G.sides = G.tsides; G.morph = 1; }
    // each row's dt is the time needed to get from the previous row's gap to this one, counted after the previous row has passed
    const name = K.pick(G.Lv.pats), list = rows(name, G.sides, Math.random), sp = G.spd * (1 + Math.min(0.35, G.t / 400));
    let prevTh = 0;
    list.forEach((r, i) => { if (i > 0) G.nextR += prevTh + Math.max(26, r.dt * sp); for (const b of r.b) G.walls.push({ s: b, r: G.nextR, th: r.th }); if (r.b.length) prevTh = r.th; });
    G.nextR += prevTh + (0.24 + Math.ceil(G.sides / 2) * (TAU / G.sides) / OMEGA) * sp;
  }
}

/* ================= update ================= */
const IN = { l: false, r: false, tl: 0, tr: 0 };
function update(dt) {
  if (!G) { MENU_T += dt; return; }
  if (G.dead) { G.deadT += dt; G.zoom = lerp(G.zoom, 1.35, dt * 3); G.flash = Math.max(0, G.flash - dt * 2); return; }
  G.t += dt;
  const sp = G.spd * (1 + Math.min(0.35, G.t / 400));
  // world rotation: changes direction now and then
  G.rotT -= dt; if (G.rotT <= 0) { G.rotT = 2 + Math.random() * 4; G.rotSpd = (Math.random() < 0.5 ? -1 : 1) * G.Lv.rot * (0.8 + Math.random() * 0.5 + G.t / 200); if (Math.random() < 0.18) K.sfx("swap"); }
  G.wrot += G.rotSpd * dt;
  // beat pulse
  const beatLen = 60 / G.Lv.bpm; G.beat += dt; if (G.beat >= beatLen) { G.beat -= beatLen; G.pulse = 1; }
  G.pulse = Math.max(0, G.pulse - dt * 6); G.morph = Math.max(0, G.morph - dt * 2); G.flash = Math.max(0, G.flash - dt * 3); G.shake = Math.max(0, G.shake - dt);
  // sides change now and then (after 15s)
  G.sideT -= dt; if (G.sideT <= 0 && G.t > 12) { G.sideT = 14 + Math.random() * 10; const opts = [4, 5, 6, 6, 7].filter((n) => n !== G.sides); G.tsides = K.pick(opts); }
  // walls
  for (const w of G.walls) { w.r -= sp * dt; if (w.r < RC) { w.th -= RC - w.r; w.r = RC; } }
  G.walls = G.walls.filter((w) => w.th > 0); G.nextR -= sp * dt; spawnPatterns();
  // player
  let dir = 0; if (K.held("ArrowLeft", "KeyA") || IN.l) dir -= 1; if (K.held("ArrowRight", "KeyD") || IN.r) dir += 1;
  const P = K.pad; if (P.connected) { if (P.held.dl || P.held.lb || P.ax < -0.4) dir -= 1; if (P.held.dr || P.held.rb || P.ax > 0.4) dir += 1; }
  dir = clamp(dir, -1, 1);
  if (dir) {
    const nt = G.theta + dir * OMEGA * dt, ns = sectorOf(nt), cs = sectorOf(G.theta);
    if (ns !== cs && blocked(ns)) { const w = secW(); G.theta = dir > 0 ? (cs + 1) * w - 0.0005 : cs * w + 0.0005; } else G.theta = nt;
  }
  if (blocked(sectorOf(G.theta))) die();
  // ranks
  if (G.rank < RANKS.length && G.t >= RANKS[G.rank][0]) { const [sec, name] = RANKS[G.rank]; G.rank++; K.banner(name, `${sec} seconds`, 1400); K.sfx("rank"); if (sec === 60 && G.li + 2 > SAVE.unlocked && G.li < LEVELS.length - 1) { SAVE.unlocked = G.li + 2; persist(); const nm = LEVELS[G.li + 1].name; setTimeout(() => K.toast("New level unlocked", nm, "big"), 900); } }
}
function blocked(s) { for (const w of G.walls) if (w.s === s && w.r <= RP + 4 && w.r + w.th >= RP - 4) return true; return false; }
function die() {
  G.dead = true; G.deadT = 0; G.flash = 1; G.shake = 0.5; K.sfx("die"); K.vibrate(150); K.musicLevel(0); SAVE.deaths++;
  const prev = SAVE.best[G.li]; G.pb = G.t > prev; if (G.pb) SAVE.best[G.li] = Math.round(G.t * 100) / 100; persist();
}
function retry() { if (!G) return; start(G.li); }

/* ================= render ================= */
const cv = $("#cv"), ctx = cv.getContext("2d");
const L = { W: 0, H: 0, dpr: 1, s: 1 };
function layout() { L.W = innerWidth; L.H = innerHeight; L.dpr = K.fit(cv, L.W, L.H).dpr; L.s = Math.min(L.W, L.H) / 820; }
addEventListener("resize", layout);
function poly(n, r, rot = 0) { ctx.beginPath(); for (let k = 0; k <= n; k++) { const a = rot + (k / n) * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); }
function render(dt) {
  const t = G ? G.t : MENU_T, Lv = G ? G.Lv : LEVELS[SAVE.last] || LEVELS[0], hue = (Lv.hue + t * 6) % 360, n = G ? G.sides : 6;
  const main = `hsl(${hue},90%,62%)`, b1 = `hsl(${hue},45%,9%)`, b2 = `hsl(${hue},45%,13%)`, core = `hsl(${hue},50%,6%)`;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0); ctx.fillStyle = b1; ctx.fillRect(0, 0, L.W, L.H);
  const pulse = G ? G.pulse : (Math.sin(MENU_T * 4) * 0.5 + 0.5) * 0.4, zoom = (G ? G.zoom : 1) * (1 + pulse * 0.045), rot = G ? G.wrot : MENU_T * 0.4;
  let sx = 0, sy = 0; if (G && G.shake > 0) { sx = (Math.random() - 0.5) * 16 * G.shake; sy = (Math.random() - 0.5) * 16 * G.shake; }
  ctx.save(); ctx.translate(L.W / 2 + sx, L.H / 2 + sy); ctx.scale(L.s * zoom, L.s * zoom * 0.9); ctx.rotate(rot);
  // background sectors
  const w = TAU / n; for (let k = 0; k < n; k++) { if (k % 2) continue; ctx.fillStyle = b2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1400, k * w, (k + 1) * w); ctx.closePath(); ctx.fill(); }
  if (n % 2) { ctx.fillStyle = `hsl(${hue},45%,11%)`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1400, (n - 1) * w, n * w); ctx.closePath(); ctx.fill(); }
  // walls
  ctx.fillStyle = main;
  if (G) for (const wl of G.walls) { if (wl.r > 1300) continue; const a0 = wl.s * w, a1 = a0 + w, r0 = wl.r, r1 = wl.r + wl.th; ctx.beginPath(); ctx.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0); ctx.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0); ctx.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1); ctx.lineTo(Math.cos(a0) * r1, Math.sin(a0) * r1); ctx.closePath(); ctx.fill(); }
  else { for (let k = 0; k < 6; k++) { const rr = ((MENU_T * 260 + k * 170) % 1020) ; const r0 = 1100 - rr; if (r0 < RC) continue; for (let s2 = 0; s2 < 6; s2++) { if ((s2 + k) % 3 === 0) continue; const a0 = s2 * w, a1 = a0 + w; ctx.beginPath(); ctx.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0); ctx.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0); ctx.lineTo(Math.cos(a1) * (r0 + 30), Math.sin(a1) * (r0 + 30)); ctx.lineTo(Math.cos(a0) * (r0 + 30), Math.sin(a0) * (r0 + 30)); ctx.closePath(); ctx.fill(); } } }
  // core
  const cr = RC * (1 + pulse * 0.12) * (G && G.morph > 0 ? 1 - Math.sin(G.morph * Math.PI) * 0.35 : 1);
  ctx.fillStyle = core; poly(n, cr); ctx.fill(); ctx.strokeStyle = main; ctx.lineWidth = 6; poly(n, cr); ctx.stroke();
  // player
  if (G && !(G.dead && Math.floor(G.deadT * 10) % 2)) { const a = G.theta; ctx.save(); ctx.rotate(a); ctx.fillStyle = main; ctx.shadowColor = main; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(RP + 15, 0); ctx.lineTo(RP - 6, -12); ctx.lineTo(RP - 2, 0); ctx.lineTo(RP - 6, 12); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.restore(); }
  ctx.restore();
  if (G && G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.7})`; ctx.fillRect(0, 0, L.W, L.H); }
  if (!G) return;
  // HUD
  const best = SAVE.best[G.li], next = RANKS.find((r) => r[0] > G.t);
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(230, 0); ctx.lineTo(200, 64); ctx.lineTo(0, 64); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = '400 40px "Russo One"'; ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.fillText(G.t.toFixed(2), 16, 10);
  ctx.beginPath(); ctx.moveTo(L.W, 0); ctx.lineTo(L.W - 230, 0); ctx.lineTo(L.W - 200, 64); ctx.lineTo(L.W, 64); ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fill();
  ctx.textAlign = "right"; ctx.font = '800 15px \"Exo 2\"'; ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillText(G.Lv.name, L.W - 16, 12); ctx.fillStyle = "#ffd166"; ctx.font = '700 20px \"Exo 2\"'; ctx.fillText(`BEST ${Math.max(best, G.dead ? 0 : G.t).toFixed(2)}`, L.W - 16, 32);
  if (next && !G.dead) { const prev = RANKS[RANKS.indexOf(next) - 1], p0 = prev ? prev[0] : 0, k = (G.t - p0) / (next[0] - p0); ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(16, 60, 170, 4); ctx.fillStyle = main; ctx.fillRect(16, 60, 170 * k, 4); ctx.textAlign = "left"; ctx.font = '700 12px \"Exo 2\"'; ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillText(next[1], 16, 68); }
  if (G.dead && G.deadT > 0.35) {
    const a = Math.min(1, (G.deadT - 0.35) * 3); ctx.globalAlpha = a; ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, L.H / 2 - 92, L.W, 184);
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; ctx.font = `400 ${Math.min(64, L.W / 9)}px "Russo One"`; ctx.fillText(G.t.toFixed(2), L.W / 2, L.H / 2 - 30);
    ctx.font = '700 18px \"Exo 2\"'; ctx.fillStyle = G.pb ? "#ffd166" : "rgba(255,255,255,0.75)"; ctx.fillText(G.pb ? "NEW BEST!" : `BEST ${best.toFixed(2)}${G.rank ? "  ·  " + RANKS[G.rank - 1][1] : ""}`, L.W / 2, L.H / 2 + 18);
    ctx.font = '600 15px \"Exo 2\"'; ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillText(K.device === "touch" ? "Tap to retry · Esc for menu" : K.device === "pad" ? "A to retry · B for menu" : "Space to retry · Esc for menu", L.W / 2, L.H / 2 + 52); ctx.globalAlpha = 1;
  }
}

/* ================= input ================= */
cv.addEventListener("pointerdown", (e) => {
  if (K.ui.active()) return; K.audio();
  if (G && G.dead) { if (G.deadT > 0.5) retry(); return; }
  if (!G) return;
  if (e.clientX < L.W / 2) { IN.l = true; IN.lid = e.pointerId; } else { IN.r = true; IN.rid = e.pointerId; }
});
const up = (e) => { if (e.pointerId === IN.lid) IN.l = false; if (e.pointerId === IN.rid) IN.r = false; };
cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
addEventListener("keydown", (e) => {
  if (K.ui.active() || !G) return;
  if (G.dead && (e.code === "Space" || e.code === "Enter" || e.code === "ArrowUp") && G.deadT > 0.4) { e.preventDefault(); retry(); return; }
  if (e.code === "Escape") { if (G.dead) title(); else pause(); }
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
});
function pollPad() { const P = K.pad; if (!P.connected || !G || K.ui.active()) return; if (G.dead && G.deadT > 0.4 && P.pressed.a) retry(); else if (G.dead && P.pressed.b) title(); else if (P.pressed.start && !G.dead) pause(); }

/* ================= audio ================= */
K.defineSfx({
  go: (t) => K.notes(t, [440, 660, 880], 0.06, { type: "square", vol: 0.04, len: 0.12, lp: 3000 }),
  rank: (t) => K.notes(t, [880, 1175, 1760], 0.07, { duty: 0.25, vol: 0.05, len: 0.2 }),
  swap: (t) => K.voice(400, t, 0.18, { type: "triangle", vol: 0.04, slide: 1.8 }),
  die: (t) => { K.noise(t, 0.6, { filter: "lowpass", freq: 3000, slide: 0.1, vol: 0.2 }); K.voice(660, t, 0.5, { type: "sawtooth", vol: 0.07, slide: 0.15, lp: 2400 }); },
});
K.songs({
  v1: { bpm: 136, chords: ["Am", "F", "C", "G"], bass: "R R O R R R O R R R O R R R O R", bassWave: 0.5, bassVol: 0.1, drums: "k . h . s . h . k . h k s . h .", arp: true, arpVol: 0.02, arpPat: [0, 1, 2, 3, 2, 1, 0, 1], lead: ["a5 . e5 . a5 . c6 .", "f5 . c5 . f5 . a5 .", "e5 . g5 . c6 . e6 .", "d6 - - . b5 - g5 ."], leadVol: 0.035, leadWave: 0.25 },
  v2: { bpm: 150, chords: ["Em", "C", "G", "D", "Em", "C", "Am", "B"], bass: "R O R O R O R O R O R O R O R O", bassWave: 0.25, bassVol: 0.09, drums: "k . h k s . h . k k h . s . h s", arp: true, arpVol: 0.02, arpPat: [0, 2, 1, 3, 2, 4, 3, 2], lead: ["e5 g5 b5 . e6 . b5 .", "c6 . g5 . e5 . g5 .", "d5 g5 b5 . d6 . b5 .", "a5 . f#5 . d5 . f#5 .", "e5 . e5 g5 b5 . e6 .", "g6 - e6 . c6 . g5 .", "a5 c6 e6 . c6 . a5 .", "b5 - - - d#6 - - -"], leadVol: 0.035, leadWave: 0.25 },
  v3: { bpm: 168, chords: ["Dm", "Bb", "C", "A", "Dm", "Bb", "Gm", "A"], bass: "R R O R O R O O R R O R O R O O", bassWave: "sawtooth", bassVol: 0.08, bassLp: 1200, drums: "k h s h k k s h k h s h k k s s", arp: true, arpVol: 0.022, arpPat: [0, 1, 2, 3, 4, 3, 2, 1], lead: ["d6 . a5 . f5 . a5 .", "bb5 . f5 . d5 . f5 .", "c6 . g5 . e5 . g5 .", "c#6 - - . e6 - - .", "d6 f6 a6 . f6 . d6 .", "bb5 d6 f6 . d6 . bb5 .", "g5 bb5 d6 . g6 . d6 .", "e6 - - - a6 - - -"], leadVol: 0.036, leadWave: 0.125 },
  menu: { bpm: 110, chords: ["Am", "F", "C", "G"], pad: true, padVol: 0.02, bass: "R . . . R . . . R . . . R . . .", bassVol: 0.08, arp: true, arpVol: 0.015, arpPat: [0, 1, 2, 1] },
});

/* ================= screens ================= */
function title() {
  G = null; K.playSong("menu", 1);
  const lv = LEVELS.map((Lv, i) => `<button class="k-btn lvl" data-a="play" data-i="${i}" ${i >= SAVE.unlocked ? "disabled" : ""} ${i === Math.min(SAVE.last, SAVE.unlocked - 1) ? "autofocus" : ""}><div><b>${i < SAVE.unlocked ? Lv.name : "LOCKED"}</b><br><span>${i < SAVE.unlocked ? Lv.desc : "Survive 60 s on " + LEVELS[i - 1].name}</span></div><em>${SAVE.best[i] ? SAVE.best[i].toFixed(2) : "–"}</em></button>`).join("");
  K.ui.show(`<div class="logo">VORTEX</div><p class="k-sub">Orbit the core. Slip through the gaps. Survive.</p><div class="lvls">${lv}</div>
    <div class="k-row"><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>`, { cls: "soft" });
}
function pause() { if (!G || G.dead || K.ui.active()) return; K.ui.show(`<div class="logo" style="font-size:2.4em">PAUSED</div><p class="k-sub">${G.Lv.name} · ${G.t.toFixed(2)}</p><div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="retry">Restart</button><button class="k-btn" data-a="title">Level select</button></div>`, { back: "resume" }); }
function settings() { const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="title">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center">${K.ui.settingsRows()}</div>`, { back: "title", cls: "top" }); K.ui.bindSettings(s); }
function help() {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="k-help"><div><b>Move</b>Turn around the core with ← → (or A D). On touch, hold the left or right half of the screen.</div><div><b>Survive</b>Walls close in from every side. Find the gap and slip through. Touching a wall from the front ends the run.</div>
    <div><b>Ranks</b>Every 10 seconds earns a new rank. Last 60 seconds to unlock the next level.</div><div><b>Retry fast</b>Press Space or tap to go again right away.</div><div><b>Controller</b>D-pad, stick or the bumpers turn. A retries.</div></div>`, { back: "title", cls: "top" });
}
K.ui.on((a, d) => {
  switch (a) {
    case "play": K.sfx("ok"); return start(+d.i);
    case "retry": return retry();
    case "resume": K.ui.hide(); return;
    case "title": K.sfx("back"); return title();
    case "settings": K.sfx("ok"); return settings();
    case "help": K.sfx("ok"); return help();
  }
});
K.onPause(() => { if (G && !G.dead && !K.ui.active()) pause(); IN.l = IN.r = false; });

/* ================= boot ================= */
layout(); title();
K.loop((dt) => { pollPad(); if (!K.ui.active() || !G) update(dt); render(dt); });
