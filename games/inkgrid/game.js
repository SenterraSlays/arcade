"use strict";
/* INKGRID — nonograms. Drag to ink cells, cross out the rest, reveal the picture. */
const { $, $$, clamp } = K;
const SAVE = K.load("inkgrid.v1", { solved: {}, best: {}, prog: {}, check: true, autoCross: true, current: null, daily: { date: "", time: 0 }, stats: { solved: 0, time: 0 } });
const persist = () => K.save("inkgrid.v1", SAVE);
const ALL = [];
PACKS.forEach((pk) => pk.puzzles.forEach(([name, rows], i) => ALL.push({ key: pk.id + ":" + i, pack: pk.id, name, rows })));
const byKey = (k) => ALL.find((x) => x.key === k);

/* ================= state ================= */
let G = null;
function makeGame(meta, p) {
  G = { key: meta.key, name: meta.name, pack: meta.pack || "", seed: meta.seed, size: meta.size, p, w: p.w, h: p.h, cells: new Uint8Array(p.w * p.h), time: 0, mistakes: 0, hints: 0, history: [], done: false, revealT: -1, cursor: [0, 0], flash: [] };
  return G;
}
function loadPuzzle(key) {
  if (key.startsWith("rand:") || key.startsWith("daily:")) {
    const [kind, a, b] = key.split(":"), size = kind === "daily" ? 15 : +a, seed = kind === "daily" ? K.dailySeed("inkgrid", a) : +b;
    const p = randomPuzzle(size, K.RNG(seed), (seed % 360)); return { meta: { key, name: kind === "daily" ? "Daily ink" : `Random ${size} × ${size}`, size, seed }, p };
  }
  const m = byKey(key); return { meta: m, p: puzzleFromRows(m.rows) };
}
function saveCurrent() {
  if (!G || G.done) SAVE.current = null;
  else { SAVE.current = { key: G.key, cells: G.cells.join(""), time: Math.round(G.time * 10) / 10, mistakes: G.mistakes, hints: G.hints }; if (isPack(G.key)) SAVE.prog[G.key] = SAVE.current; }
  persist();
}

/* ================= rules ================= */
const lineCells = (isRow, n) => (isRow ? [...Array(G.w)].map((_, x) => n * G.w + x) : [...Array(G.h)].map((_, y) => y * G.w + n));
function lineMatches(isRow, n) { const cl = isRow ? G.p.rowClues[n] : G.p.colClues[n]; const cur = cluesOf(lineCells(isRow, n).map((i) => (G.cells[i] === 1 ? 1 : 0))); return cur.length === cl.length && cur.every((v, i) => v === cl[i]); }
/* cells: 0 empty, 1 inked, 2 crossed, 3 wrong ink (locked red cross) */
function setCell(i, v, batch) {
  if (G.cells[i] === v || G.cells[i] === 3) return false;
  if (v === 1 && SAVE.check && !G.p.sol[i]) { G.cells[i] = 3; G.mistakes++; G.flash.push({ i, t: 0 }); K.sfx("mistake"); K.vibrate(40); return "mistake"; }
  batch.push([i, G.cells[i]]); G.cells[i] = v; return true;
}
function afterChange(batch) {
  if (batch.length) {
    if (SAVE.autoCross) {
      const rows = new Set(), cols = new Set(); for (const [i] of batch) { rows.add((i / G.w) | 0); cols.add(i % G.w); }
      for (const y of rows) if (lineMatches(true, y)) for (const i of lineCells(true, y)) if (G.cells[i] === 0) { batch.push([i, 0]); G.cells[i] = 2; }
      for (const x of cols) if (lineMatches(false, x)) for (const i of lineCells(false, x)) if (G.cells[i] === 0) { batch.push([i, 0]); G.cells[i] = 2; }
    }
    G.history.push(batch); if (G.history.length > 300) G.history.shift();
  }
  saveCurrent(); checkWin();
}
const isPack = (k) => !!byKey(k);
function checkWin() {
  for (let i = 0; i < G.cells.length; i++) if ((G.cells[i] === 1) !== !!G.p.sol[i]) return;
  G.done = true; G.revealT = 0; K.sfx("win"); K.vibrate(70); K.musicLevel(1);
  SAVE.stats.solved++; SAVE.stats.time += G.time;
  const ms = Math.round(G.time * 1000), daily = G.key.startsWith("daily:");
  const prev = isPack(G.key) ? SAVE.solved[G.key] : daily ? undefined : SAVE.best["r" + G.w];
  G.pb = !G.hints && !daily && (!prev || ms < prev);
  if (isPack(G.key)) { if (G.pb) SAVE.solved[G.key] = ms; else if (prev === undefined) SAVE.solved[G.key] = 0; }
  else if (!daily && G.pb) SAVE.best["r" + G.w] = ms;
  if (daily) SAVE.daily = { date: G.key.slice(6), time: G.time, hints: G.hints, mistakes: G.mistakes };
  SAVE.current = null; delete SAVE.prog[G.key]; persist(); $("#pname").textContent = G.name;
  const g = G; setTimeout(() => { if (G === g) results(); }, 1900);
}
function undo() { if (!G || G.done) return; const b = G.history.pop(); if (!b) { K.sfx("deny"); return; } for (let k = b.length - 1; k >= 0; k--) { const [i, v] = b[k]; if (G.cells[i] !== 3) G.cells[i] = v; } K.sfx("undo"); saveCurrent(); }
function hint() {
  if (!G || G.done) return;
  const wrong = []; for (let i = 0; i < G.cells.length; i++) { const v = G.cells[i]; if ((v === 1 && !G.p.sol[i]) || (v === 2 && G.p.sol[i])) wrong.push(i); }
  if (wrong.length) { for (const i of wrong) G.flash.push({ i, t: 0, hint: true }); K.toast("Something's off", wrong.length === 1 ? "The highlighted square isn't right. Undo or change it." : `${wrong.length} highlighted squares aren't right.`); G.hints++; K.sfx("hint"); return; }
  const state = new Uint8Array(G.cells.length); for (let i = 0; i < state.length; i++) state[i] = G.cells[i] === 1 ? 1 : G.cells[i] ? 2 : 0;
  // pick the line whose clue forces the most new squares, then fill in just those
  let best = null;
  for (const isRow of [true, false]) for (let n = 0; n < (isRow ? G.h : G.w); n++) {
    const idx = lineCells(isRow, n), line = idx.map((i) => state[i]), r = solveLine(isRow ? G.p.rowClues[n] : G.p.colClues[n], line); if (!r) continue;
    const forced = []; for (let k = 0; k < idx.length; k++) if (line[k] === 0 && r[k] !== 0) forced.push([idx[k], r[k]]);
    if (forced.length && (!best || forced.length > best.forced.length)) best = { isRow, n, forced };
  }
  if (!best) return;
  const batch = [], fills = best.forced.filter((f) => f[1] === 1).length; G.hints++;
  for (const [i, v] of best.forced) { setCell(i, v === 1 ? 1 : 2, batch); G.flash.push({ i, t: 0, hint: true }); }
  const [fi] = best.forced[0]; G.cursor = [fi % G.w, (fi / G.w) | 0]; hintLine = { isRow: best.isRow, n: best.n, t: 0 };
  const empties = best.forced.length - fills, what = [fills ? `${fills} square${fills > 1 ? "s" : ""} must be inked` : "", empties ? `${empties} must stay empty` : ""].filter(Boolean).join(" and ");
  K.toast(`${best.isRow ? "Row" : "Column"} ${best.n + 1}`, `From its clue alone, ${what}.`); K.sfx("hint");
  afterChange(batch);
}
let hintLine = null;

/* ================= layout + drawing ================= */
const cv = $("#cv"), ctx = cv.getContext("2d");
const L = { W: 0, H: 0, dpr: 1, cs: 20, ox: 0, oy: 0, rcw: 0, cch: 0, clue: 14 };
let PAPER = null;
function layout() {
  const w = innerWidth, h = innerHeight, d = K.fit(cv, w, h); L.W = w; L.H = h; L.dpr = d.dpr;
  PAPER = null;
  if (!G) return;
  const top = $("#bar").hidden ? 10 : $("#bar").offsetHeight + 8, bot = K.device === "touch" ? 84 : 20;
  const mr = Math.max(...G.p.rowClues.map((c) => c.length)), mc = Math.max(...G.p.colClues.map((c) => c.length));
  const cs = Math.floor(Math.min((w - 24) / (G.w + mr * 0.62 + 0.4), (h - top - bot) / (G.h + mc * 0.62 + 0.4)));
  L.cs = Math.max(10, Math.min(cs, 76)); L.clue = L.cs * 0.62; L.rcw = mr * L.clue + L.cs * 0.3; L.cch = mc * L.clue + L.cs * 0.3;
  const tw = L.rcw + G.w * L.cs, th = L.cch + G.h * L.cs;
  L.ox = Math.round((w - tw) / 2 + L.rcw); L.oy = Math.round(top + (h - top - bot + 20 - th) / 2 + L.cch);
}
addEventListener("resize", layout);
function paper() {
  if (PAPER) return PAPER;
  const c = document.createElement("canvas"); c.width = Math.round(L.W * L.dpr); c.height = Math.round(L.H * L.dpr); const g = c.getContext("2d");
  g.fillStyle = "#efe8da"; g.fillRect(0, 0, c.width, c.height);
  const rng = K.RNG(7); for (let i = 0; i < (c.width * c.height) / 260; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? "120,100,70" : "255,255,255"},${0.03 + rng() * 0.05})`; g.fillRect(rng() * c.width, rng() * c.height, 1 + rng() * 2, 1 + rng() * 2); }
  const v = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.3, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(90,70,40,0.16)"); g.fillStyle = v; g.fillRect(0, 0, c.width, c.height);
  return (PAPER = c);
}
function inkCell(x, y, s, a = 1) {
  const p = Math.max(1, s * 0.06);
  ctx.globalAlpha = a; ctx.fillStyle = "#2b2a33"; K.roundRect(ctx, x + p, y + p, s - p * 2, s - p * 2, s * 0.12); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(x + p * 2, y + p * 2, s - p * 4, s * 0.2); ctx.globalAlpha = 1;
}
function cross(x, y, s, col) { const m = s * 0.3; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x + m, y + m); ctx.lineTo(x + s - m, y + s - m); ctx.moveTo(x + s - m, y + m); ctx.lineTo(x + m, y + s - m); ctx.stroke(); }
let T = 0;
function render(dt) {
  T += dt;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.drawImage(paper(), 0, 0, L.W, L.H);
  if (!G || (G.done && K.ui.active())) return;
  const { cs, ox, oy, clue } = L, W = G.w, H = G.h;
  const hov = drag.hover, hr = hov ? hov[1] : G.cursor[1], hc = hov ? hov[0] : G.cursor[0], showCur = !G.done;
  // clue backgrounds
  ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.fillRect(ox - L.rcw, oy, L.rcw, H * cs); ctx.fillRect(ox, oy - L.cch, W * cs, L.cch);
  if (showCur) { ctx.fillStyle = "rgba(244,197,66,0.18)"; ctx.fillRect(ox - L.rcw, oy + hr * cs, L.rcw + W * cs, cs); ctx.fillRect(ox + hc * cs, oy - L.cch, cs, L.cch + H * cs); }
  if (hintLine) { hintLine.t += dt; const a = Math.max(0, 1 - hintLine.t / 1.5) * 0.3; ctx.fillStyle = `rgba(224,69,74,${a})`; if (hintLine.isRow) ctx.fillRect(ox - L.rcw, oy + hintLine.n * cs, L.rcw + W * cs, cs); else ctx.fillRect(ox + hintLine.n * cs, oy - L.cch, cs, L.cch + H * cs); if (hintLine.t > 1.5) hintLine = null; }
  // board
  ctx.fillStyle = "#faf6ed"; ctx.fillRect(ox, oy, W * cs, H * cs);
  const rev = G.revealT >= 0 ? G.revealT : -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = G.cells[i], px = ox + x * cs, py = oy + y * cs;
    if (rev >= 0 && G.p.sol[i]) {
      const k = clamp((rev - (x + y) * 0.03) * 3, 0, 1);
      if (k < 1) inkCell(px, py, cs, 1 - k);
      if (k > 0) { ctx.globalAlpha = k; ctx.fillStyle = G.p.col[i]; ctx.fillRect(px, py, cs + 0.5, cs + 0.5); ctx.globalAlpha = 1; }
      continue;
    }
    if (v === 1) inkCell(px, py, cs);
    else if (rev >= 0) continue;
    else if (v === 2) cross(px, py, cs, "rgba(110,105,100,0.55)");
    else if (v === 3) cross(px, py, cs, "#e0454a");
  }
  // grid lines
  if (rev < 0.6) {
    ctx.globalAlpha = rev >= 0 ? 1 - rev / 0.6 : 1;
    ctx.strokeStyle = "rgba(43,42,51,0.18)"; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= W; x++) { ctx.moveTo(ox + x * cs + 0.5, oy); ctx.lineTo(ox + x * cs + 0.5, oy + H * cs); }
    for (let y = 0; y <= H; y++) { ctx.moveTo(ox, oy + y * cs + 0.5); ctx.lineTo(ox + W * cs, oy + y * cs + 0.5); }
    ctx.stroke();
    ctx.strokeStyle = "rgba(43,42,51,0.55)"; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x <= W; x += 5) { ctx.moveTo(ox + x * cs, oy - (x % W === 0 ? L.cch : 0)); ctx.lineTo(ox + x * cs, oy + H * cs); }
    for (let y = 0; y <= H; y += 5) { ctx.moveTo(ox - (y % H === 0 ? L.rcw : 0), oy + y * cs); ctx.lineTo(ox + W * cs, oy + y * cs); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  // clues
  ctx.font = `800 ${Math.round(clue * 0.82)}px Nunito, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let y = 0; y < H; y++) { const cl = G.p.rowClues[y], ok = lineMatches(true, y); ctx.fillStyle = ok ? "rgba(43,42,51,0.3)" : y === hr && showCur ? "#000" : "#2b2a33"; cl.forEach((n, k) => ctx.fillText(String(n), ox - L.cs * 0.15 - (cl.length - k - 0.5) * clue, oy + (y + 0.5) * cs)); }
  for (let x = 0; x < W; x++) { const cl = G.p.colClues[x], ok = lineMatches(false, x); ctx.fillStyle = ok ? "rgba(43,42,51,0.3)" : x === hc && showCur ? "#000" : "#2b2a33"; cl.forEach((n, k) => ctx.fillText(String(n), ox + (x + 0.5) * cs, oy - L.cs * 0.15 - (cl.length - k - 0.5) * clue)); }
  // flashes + cursor
  for (const f of G.flash) { f.t += dt; const a = Math.max(0, 1 - f.t / 1.2); ctx.strokeStyle = f.hint ? `rgba(181,118,31,${a})` : `rgba(224,69,74,${a})`; ctx.lineWidth = 3; ctx.strokeRect(ox + (f.i % W) * cs + 2, oy + ((f.i / W) | 0) * cs + 2, cs - 4, cs - 4); }
  G.flash = G.flash.filter((f) => f.t < 1.2);
  if (showCur && (K.device === "kb" || K.device === "pad")) { ctx.strokeStyle = "#b5761f"; ctx.lineWidth = 3; ctx.strokeRect(ox + G.cursor[0] * cs + 1.5, oy + G.cursor[1] * cs + 1.5, cs - 3, cs - 3); }
  if (G.revealT >= 0) G.revealT += dt;
}

/* ================= input ================= */
let mode = 1; // 1 fill, 2 cross
const drag = { on: false, start: null, axis: 0, target: 0, batch: null, last: null, hover: null, id: null };
function cellAt(px, py) { if (!G) return null; const x = Math.floor((px - L.ox) / L.cs), y = Math.floor((py - L.oy) / L.cs); return x >= 0 && y >= 0 && x < G.w && y < G.h ? [x, y] : null; }
function paintTo(c) {
  if (!drag.on || !c) return;
  let [x, y] = c; const [sx, sy] = drag.start;
  if (!drag.axis && (x !== sx || y !== sy)) drag.axis = Math.abs(x - sx) >= Math.abs(y - sy) ? 1 : 2;
  if (drag.axis === 1) y = sy; else if (drag.axis === 2) x = sx;
  const x0 = Math.min(sx, x), x1 = Math.max(sx, x), y0 = Math.min(sy, y), y1 = Math.max(sy, y);
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
    const i = yy * G.w + xx;
    if (drag.from.includes(G.cells[i])) {
      const r = setCell(i, drag.target, drag.batch);
      if (r === "mistake") { endDrag(); return; }
      if (r) K.sfx(drag.target === 1 ? "ink" : drag.target === 2 ? "cross" : "erase");
    }
  }
}
/* The first square decides what a stroke does: on an empty square it marks empties, on a matching mark it erases those marks, on the other mark it overwrites. */
function beginDrag(c, m) {
  if (!G || G.done || !c) return;
  const i = c[1] * G.w + c[0], cur = G.cells[i]; if (cur === 3) { K.sfx("deny"); return; }
  drag.on = true; drag.start = c; drag.axis = 0; drag.batch = [];
  if (cur === m) { drag.target = 0; drag.from = [m]; } else if (cur === 0) { drag.target = m; drag.from = [0]; } else { drag.target = m; drag.from = [0, cur]; }
  paintTo(c);
}
function endDrag() { if (!drag.on) return; drag.on = false; afterChange(drag.batch); drag.batch = null; }
cv.addEventListener("contextmenu", (e) => e.preventDefault());
cv.addEventListener("pointerdown", (e) => {
  if (!G || K.ui.active()) return; K.audio(); cv.setPointerCapture(e.pointerId); drag.id = e.pointerId;
  if (e.pointerType === "mouse" && e.button === 1) return;
  const c = cellAt(e.clientX, e.clientY); if (c) G.cursor = c;
  beginDrag(c, e.pointerType === "mouse" && e.button === 2 ? 3 - mode : mode);
});
cv.addEventListener("pointermove", (e) => { const c = cellAt(e.clientX, e.clientY); if (e.pointerType === "mouse") drag.hover = c; if (drag.on && e.pointerId === drag.id) { paintTo(c); if (c) G.cursor = c; } });
cv.addEventListener("pointerup", (e) => { if (e.pointerId === drag.id) endDrag(); });
cv.addEventListener("pointercancel", () => endDrag());
cv.addEventListener("pointerleave", () => { drag.hover = null; });
function setMode(m) { mode = m; $("#mFill").classList.toggle("on", m === 1); $("#mCross").classList.toggle("on", m === 2); }
$("#mFill").onclick = () => { setMode(1); K.sfx("click"); };
$("#mCross").onclick = () => { setMode(2); K.sfx("click"); };
$("#undoBtn").onclick = () => undo();
$("#hintBtn").onclick = () => hint();
$("#menuBtn").onclick = () => menu();
const kHeld = { fill: false, cross: false };
addEventListener("keydown", (e) => {
  if (!G || K.ui.active()) return;
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }[e.code];
  if (dir) { e.preventDefault(); moveCursor(dir[0], dir[1]); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); return undo(); }
  if (e.repeat) return;
  if (e.code === "KeyZ" || e.code === "Space" || e.code === "Enter") { e.preventDefault(); kHeld.fill = true; beginDrag(G.cursor, 1); }
  else if (e.code === "KeyX") { kHeld.cross = true; beginDrag(G.cursor, 2); }
  else if (e.code === "KeyH") hint();
  else if (e.code === "KeyU") undo();
  else if (e.code === "Escape") menu();
});
addEventListener("keyup", (e) => { if (["KeyZ", "Space", "Enter", "KeyX"].includes(e.code)) { kHeld.fill = kHeld.cross = false; endDrag(); } });
function moveCursor(dx, dy) { G.cursor = [clamp(G.cursor[0] + dx, 0, G.w - 1), clamp(G.cursor[1] + dy, 0, G.h - 1)]; K.sfx("move"); if (drag.on) paintTo(G.cursor); }
let padDir = 0, padT = 0;
function pollPadGame(dt) {
  const p = K.pad; if (!p.connected || !G || K.ui.active()) return;
  const h = p.held, vy = h.du ? -1 : h.dd ? 1 : 0, vx = vy ? 0 : h.dl ? -1 : h.dr ? 1 : 0, nd = vy * 3 + vx;
  if (nd !== padDir) { padDir = nd; padT = 0.26; if (nd) moveCursor(vx, vy); } else if (nd) { padT -= dt; if (padT <= 0) { padT = 0.08; moveCursor(vx, vy); } }
  if (p.pressed.a) beginDrag(G.cursor, 1); if (p.pressed.b) beginDrag(G.cursor, 2);
  if (drag.on && !h.a && !h.b) endDrag();
  if (p.pressed.y) hint(); if (p.pressed.x) undo(); if (p.pressed.start) menu();
}

/* ================= audio ================= */
K.defineSfx({
  ink: (t) => K.voice(520 + Math.random() * 80, t, 0.06, { type: "triangle", vol: 0.05 }),
  cross: (t) => K.noise(t, 0.05, { freq: 3000, vol: 0.03 }),
  erase: (t) => K.voice(300, t, 0.05, { type: "sine", vol: 0.04 }),
  mistake: (t) => { K.voice(196, t, 0.18, { type: "square", vol: 0.05, lp: 900 }); K.voice(185, t + 0.09, 0.2, { type: "square", vol: 0.04, lp: 900 }); },
  undo: (t) => K.voice(440, t, 0.06, { type: "sine", vol: 0.04, slide: 0.8 }),
  hint: (t) => K.notes(t, [988, 1318], 0.07, { type: "sine", vol: 0.05, len: 0.3 }),
}, { ink: 0.025, cross: 0.025, erase: 0.025 });
K.songs({ ink: { bpm: 78, chords: ["F", "Dm", "Bb", "C", "F", "Am", "Bb", "C"], pad: true, padVol: 0.02, arp: true, arpVol: 0.017, arpPat: [0, 1, 2, 1], bass: "R . . . . . . . F . . . . . . .",
  leadVol: 0.03, lead: ["a4 - - - c5 - - -", "d5 - - - f5 - - -", "d5 - - - bb4 - - -", "c5 - - - g4 - - -", "a4 - - - c5 - f5 -", "e5 - - - c5 - - -", "d5 - - - f5 - d5 -", "c5 - - - - - - -"] } });

/* ================= screens ================= */
function thumb(p, solved, size = 120) {
  const c = document.createElement("canvas"), s = Math.max(1, Math.floor(size / Math.max(p.w, p.h))); c.width = p.w * s; c.height = p.h * s; const g = c.getContext("2d");
  for (let i = 0; i < p.sol.length; i++) { const x = (i % p.w) * s, y = ((i / p.w) | 0) * s; if (solved) { if (p.sol[i]) { g.fillStyle = p.col[i]; g.fillRect(x, y, s, s); } } else { g.fillStyle = (x / s + y / s) % 2 ? "#e3dccd" : "#d9d1c0"; g.fillRect(x, y, s, s); } }
  return c;
}
function title() {
  if (G && !G.done) saveCurrent(); G = null; $("#bar").hidden = true; K.playSong("ink", 1);
  const cur = SAVE.current, packs = PACKS.map((pk) => { const n = pk.puzzles.filter((_, i) => SAVE.solved[pk.id + ":" + i] !== undefined).length; return `<button class="k-btn pack" data-a="pack" data-p="${pk.id}"><b>${pk.name}</b><span>${pk.desc}</span><em>${n} / ${pk.puzzles.length} solved</em></button>`; }).join("");
  const dailyDone = SAVE.daily.date === K.today();
  K.ui.show(`<div class="logo">INK<span>GRID</span></div><p class="k-sub">Use the numbers to ink in a hidden picture. No guessing needed, ever.</p>
    ${cur ? `<button class="k-btn primary" data-a="continue" autofocus>Continue ${K.esc(contLabel(cur.key))} · ${K.fmtTime(cur.time)}</button>` : ""}
    <div class="packs">${packs}<button class="k-btn pack" data-a="randoms"><b>Endless ink</b><span>Fresh random puzzles in four sizes</span><em>Always new</em></button><button class="k-btn pack" data-a="daily"><b>Daily ink</b><span>Today's 15 × 15, the same for everyone</span><em>${dailyDone ? "Solved in " + K.fmtTime(SAVE.daily.time) : "Not solved yet"}</em></button></div>
    <div class="k-row"><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>`, { cls: "clear" });
}
function contLabel(key) {
  if (key.startsWith("daily:")) return "daily ink";
  if (key.startsWith("rand:")) return `random ${key.split(":")[1]} × ${key.split(":")[1]}`;
  const [pid, i] = key.split(":"), pk = PACKS.find((p) => p.id === pid); return pk ? `${pk.name} #${+i + 1}` : "puzzle";
}
function packScreen(id) {
  const pk = PACKS.find((p) => p.id === id);
  const s = K.ui.show(`<div class="k-bar"><h2>${pk.name}</h2><button class="k-btn" data-a="title">Back</button></div>
    <div class="thumbs">${pk.puzzles.map(([name], i) => { const k = pk.id + ":" + i, sv = SAVE.solved[k]; return `<button class="k-btn thumb" data-a="play" data-k="${k}"><canvas data-k="${k}"></canvas><b>${sv !== undefined ? K.esc(name) : "???"}</b><small>${sv ? "Best " + K.fmtTime(sv / 1000) : sv === 0 ? "Solved" : SAVE.prog[k] ? "In progress" : "Not solved"}</small></button>`; }).join("")}</div>`, { back: "title", cls: "top" });
  for (const c of $$("canvas[data-k]", s)) { const m = byKey(c.dataset.k), t = thumb(puzzleFromRows(m.rows), SAVE.solved[m.key] !== undefined); c.width = t.width; c.height = t.height; c.getContext("2d").drawImage(t, 0, 0); }
}
function randomScreen() {
  K.ui.show(`<div class="k-bar"><h2>Endless ink</h2><button class="k-btn" data-a="title">Back</button></div><p class="k-sub">A fresh picture every time, always solvable by logic.</p>
    <div class="k-row">${[5, 10, 15, 20].filter((s) => s < 20 || Math.min(innerWidth, innerHeight) >= 560).map((s) => `<button class="k-btn ${s === 10 ? "primary" : ""}" data-a="rand" data-s="${s}" ${s === 10 ? "autofocus" : ""}>${s} × ${s}${SAVE.best["r" + s] ? `<small style="display:block;opacity:.7">Best ${K.fmtTime(SAVE.best["r" + s] / 1000)}</small>` : ""}</button>`).join("")}</div>`, { back: "title" });
}
function startPuzzle(key, resume) {
  const { meta, p } = loadPuzzle(key); if (!p) { K.toast("Couldn't load that puzzle"); return; }
  makeGame(meta, p);
  if (resume && typeof resume.cells === "string" && resume.cells.length === G.w * G.h) { G.cells = Uint8Array.from(resume.cells.split(""), Number); G.time = resume.time || 0; G.mistakes = resume.mistakes || 0; G.hints = resume.hints || 0; }
  $("#pname").textContent = isPack(key) && SAVE.solved[key] === undefined ? `${G.w} × ${G.h}` : meta.name;
  K.ui.hide(); $("#bar").hidden = false; setMode(1); layout(); K.playSong("ink", 2); saveCurrent();
}
function menu() {
  if (!G || G.done) return;
  K.ui.show(`<div class="logo" style="font-size:2.6em">Paused</div><p class="k-sub">${G.w} × ${G.h} · ${K.fmtTime(G.time)}</p>
    <div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="clear">Clear the grid</button><button class="k-btn" data-a="settings" data-from="menu">Settings</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "resume" });
}
function results() {
  const s = K.ui.show(`<div class="reveal"><canvas id="rv"></canvas></div><h2 style="font-size:2em">${K.esc(G.name)}</h2>
    <div class="k-stats"><div class="k-stat"><small>Time</small><b>${K.fmtTime(G.time)}</b></div><div class="k-stat"><small>Mistakes</small><b>${G.mistakes}</b></div><div class="k-stat"><small>Hints</small><b>${G.hints}</b></div></div>
    ${G.pb ? `<b style="color:var(--gold)">New best time!</b>` : ""}
    <div class="k-row">${nextKey() ? `<button class="k-btn primary" data-a="next" autofocus>Next puzzle</button>` : ""}${G.key.startsWith("rand") ? `<button class="k-btn primary" data-a="rand" data-s="${G.w}" autofocus>Another ${G.w} × ${G.w}</button>` : ""}${G.key.startsWith("daily") ? `<button class="k-btn" data-a="share">Copy result</button>` : ""}<button class="k-btn" data-a="title">Main menu</button></div><div class="k-msg" id="msg"></div>`, { back: "title", cls: "soft" });
  const t = thumb(G.p, true, 260), rv = $("#rv", s); rv.width = t.width; rv.height = t.height; rv.getContext("2d").drawImage(t, 0, 0);
  $("#bar").hidden = true;
}
function nextKey() { const i = ALL.findIndex((x) => x.key === G.key); if (i < 0) return null; for (let k = i + 1; k < ALL.length; k++) if (SAVE.solved[ALL[k].key] === undefined) return ALL[k].key; return ALL[i + 1] ? ALL[i + 1].key : null; }
function settings(from) {
  const back = from === "menu" ? "menu" : "title", row = (k, l) => `<div class="k-opt"><span>${l}</span><button class="k-btn small" data-a="tog" data-k="${k}">${SAVE[k] ? "On" : "Off"}</button></div>`;
  const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div>
    <div class="k-panel" style="width:min(100%,32em);display:flex;flex-direction:column;align-items:center">${row("check", "Point out mistakes as you go")}${row("autoCross", "Cross out finished lines automatically")}${K.ui.settingsRows()}</div>`, { back, cls: "top" });
  K.ui.bindSettings(s);
}
function help() {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="k-help">
      <div><b>Clues</b>The numbers beside each row and above each column are the lengths of the filled runs in that line, in order, with at least one gap between runs.</div>
      <div><b>Logic</b>Every puzzle can be solved by reasoning about the lines. You never need to guess.</div>
      <div><b>Crosses</b>Mark squares you know are empty with a cross. It helps you see what's left.</div>
      <div class="k-kbonly"><b>Mouse & keys</b>Left drag inks · right drag crosses · arrows move · hold Z (or Space) to ink, X to cross while moving · H hint · Ctrl+Z undo</div>
      <div><b>Controller</b>D-pad moves · hold A to ink, B to cross · Y hint · X undo · Start menu</div>
      <div class="k-touchonly"><b>Touch</b>Pick Fill or Cross at the top, then tap or drag across the grid.</div>
    </div>`, { back: "title", cls: "top" });
}
K.ui.on((a, d, el) => {
  switch (a) {
    case "title": K.sfx("back"); return title();
    case "pack": K.sfx("ok"); return packScreen(d.p);
    case "play": K.sfx("ok"); return startPuzzle(d.k, SAVE.prog[d.k]);
    case "next": { const k = nextKey(); K.sfx("ok"); return startPuzzle(k, SAVE.prog[k]); }
    case "randoms": K.sfx("ok"); return randomScreen();
    case "rand": K.sfx("ok"); return startPuzzle(`rand:${d.s}:${(Math.random() * 4294967296) >>> 0}`);
    case "daily": K.sfx("ok"); return startPuzzle(`daily:${K.today()}`, SAVE.current && SAVE.current.key === `daily:${K.today()}` ? SAVE.current : null);
    case "continue": { const c = SAVE.current; K.sfx("ok"); return startPuzzle(c.key, c); }
    case "resume": K.ui.hide(); return;
    case "clear": { const b = []; for (let i = 0; i < G.cells.length; i++) if (G.cells[i]) { b.push([i, G.cells[i]]); G.cells[i] = 0; } G.history.push(b); K.ui.hide(); saveCurrent(); return; }
    case "menu": return menu();
    case "settings": K.sfx("ok"); return settings(d.from);
    case "help": K.sfx("ok"); return help();
    case "tog": SAVE[d.k] = !SAVE[d.k]; persist(); el.textContent = SAVE[d.k] ? "On" : "Off"; K.sfx("ok"); return;
    case "share": K.copy(`INKGRID · Daily ink ${K.today()}\nSolved in ${K.fmtTime(SAVE.daily.time)}`).then((ok) => { const m = $("#msg"); if (m) m.textContent = ok ? "Copied to clipboard." : "Couldn't copy."; }); return;
  }
});
K.onPause(() => { if (G && !G.done && !K.ui.active()) menu(); });

/* ================= boot ================= */
layout(); title();
let saveT = 0;
let lastDev = K.device;
K.loop((dt) => {
  if ((K.device === "touch") !== (lastDev === "touch")) layout();
  lastDev = K.device;
  pollPadGame(dt);
  if (G && !G.done && !K.ui.active() && !document.hidden) { G.time += dt; saveT += dt; if (saveT > 5) { saveT = 0; saveCurrent(); } const t = K.fmtTime(G.time); if ($("#ptime").textContent !== t) $("#ptime").textContent = t; $("#mistakes").textContent = G.mistakes ? "✕ " + G.mistakes : ""; }
  render(dt);
});
