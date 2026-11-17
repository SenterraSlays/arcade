"use strict";
/* DEFUSE — minesweeper. No-guess boards (every board can be cleared by logic from the first click),
   chording, hints, daily board, zoom + pan, keyboard / controller / touch. */
const { $, $$, clamp } = K;

const SAVE = K.load("defuse.v1", {
  noGuess: true, qmarks: false, chordClick: true,
  best: { beginner: 0, intermediate: 0, expert: 0 }, daily: { date: "", best: 0, done: false },
  stats: { played: 0, won: 0, cleared: 0, time: 0 }, custom: { w: 20, h: 14, m: 50 },
});
const persist = () => K.save("defuse.v1", SAVE);
const DIFFS = {
  beginner: { name: "Beginner", w: 9, h: 9, m: 10, desc: "9 × 9 · 10 mines" },
  intermediate: { name: "Intermediate", w: 16, h: 16, m: 40, desc: "16 × 16 · 40 mines" },
  expert: { name: "Expert", w: 30, h: 16, m: 99, desc: "30 × 16 · 99 mines" },
  daily: { name: "Daily Board", w: 30, h: 16, m: 99, desc: "Today's expert board, the same for everyone" },
  custom: { name: "Custom", w: 20, h: 14, m: 50, desc: "Your own size" },
};
const HIDDEN = 0, OPEN = 1, FLAG = 2, QUEST = 3;

/* ================= board logic ================= */
let G = null;
const idx = (x, y) => y * G.w + x;
function neigh(w, h, i, out) { out.length = 0; const x = i % w, y = (i / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx); } return out; }
const NB = [];
function counts(w, h, mines) { const n = new Int8Array(w * h), tmp = []; for (let i = 0; i < w * h; i++) { if (mines[i]) { n[i] = -1; continue; } let c = 0; for (const j of neigh(w, h, i, tmp)) c += mines[j]; n[i] = c; } return n; }
/* Logic-only solver. Returns true when every safe cell can be opened without guessing. */
function solvable(w, h, mines, start, nums) {
  const N = w * h, known = new Int8Array(N), tmp = [], tmp2 = [];
  let safeLeft = N - mines.reduce((a, b) => a + b, 0), minesLeft = N - safeLeft;
  const open = (s) => { const st = [s]; while (st.length) { const i = st.pop(); if (known[i]) continue; known[i] = 1; safeLeft--; if (nums[i] === 0) for (const j of neigh(w, h, i, [])) if (!known[j]) st.push(j); } };
  open(start);
  let guard = 0;
  while (safeLeft > 0 && guard++ < 2000) {
    let progress = false;
    const front = [];
    for (let i = 0; i < N; i++) {
      if (known[i] !== 1 || nums[i] <= 0) continue;
      const hid = []; let fl = 0;
      for (const j of neigh(w, h, i, tmp)) { if (known[j] === 2) fl++; else if (!known[j]) hid.push(j); }
      if (!hid.length) continue;
      const r = nums[i] - fl;
      if (r === 0) { for (const j of hid) if (!known[j]) open(j); progress = true; }
      else if (r === hid.length) { for (const j of hid) if (!known[j]) { known[j] = 2; minesLeft--; } progress = true; }
      else front.push({ i, hid, r });
    }
    if (progress) continue;
    // pair rules on the frontier
    outer: for (let a = 0; a < front.length; a++) {
      const A = front[a], ax = A.i % w, ay = (A.i / w) | 0, SA = new Set(A.hid);
      for (let b = 0; b < front.length; b++) {
        if (a === b) continue;
        const B = front[b], bx = B.i % w, by = (B.i / w) | 0;
        if (Math.abs(ax - bx) > 2 || Math.abs(ay - by) > 2) continue;
        const onlyA = A.hid.filter((j) => !B.hid.includes(j)), onlyB = B.hid.filter((j) => !SA.has(j));
        if (onlyA.length === A.hid.length) continue;
        if (A.r - B.r === onlyA.length && onlyA.length) {
          for (const j of onlyA) if (!known[j]) { known[j] = 2; minesLeft--; }
          for (const j of onlyB) if (!known[j]) open(j);
          progress = true; break outer;
        }
        if (!onlyA.length && B.r - A.r === 0 && onlyB.length) { for (const j of onlyB) if (!known[j]) open(j); progress = true; break outer; }
      }
    }
    if (progress) continue;
    // global mine count
    let unknown = 0; for (let i = 0; i < N; i++) if (!known[i]) unknown++;
    if (minesLeft === 0 && unknown) { for (let i = 0; i < N; i++) if (!known[i]) open(i); continue; }
    if (minesLeft === unknown && unknown) { for (let i = 0; i < N; i++) if (!known[i]) { known[i] = 2; minesLeft--; } continue; }
    break;
  }
  return safeLeft === 0;
}
function placeMines(w, h, m, start, rng) {
  const sx = start % w, sy = (start / w) | 0, N = w * h, cand = [];
  const big = N - 9 >= m;
  for (let i = 0; i < N; i++) { const x = i % w, y = (i / w) | 0; if (big ? Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1 : i === start) continue; cand.push(i); }
  const mines = new Uint8Array(N);
  for (let k = 0; k < m && cand.length; k++) { const j = rng.int(cand.length); mines[cand[j]] = 1; cand[j] = cand[cand.length - 1]; cand.pop(); }
  return mines;
}
function generate(w, h, m, start, rng, noGuess) {
  let mines = placeMines(w, h, m, start, rng);
  if (!noGuess || m / (w * h) > 0.26) return { mines, ng: false };
  const t0 = performance.now();
  for (let a = 0; a < 4000; a++) {
    if (solvable(w, h, mines, start, counts(w, h, mines))) return { mines, ng: true, tries: a + 1, ms: performance.now() - t0 };
    if (performance.now() - t0 > 4000) break;
    mines = placeMines(w, h, m, start, rng);
  }
  return { mines, ng: false };
}

/* ================= game ================= */
function newGame(key, opts = {}) {
  const d = key === "custom" ? { ...DIFFS.custom, ...SAVE.custom } : DIFFS[key];
  G = {
    key, w: d.w, h: d.h, m: d.m, mines: null, nums: null, st: new Uint8Array(d.w * d.h), started: false, over: false, won: false,
    t0: 0, time: 0, clicks: 0, flags: 0, opened: 0, bv: 0, cursor: [d.w >> 1, d.h >> 1], fx: [], anim: new Float32Array(d.w * d.h), flagAnim: new Float32Array(d.w * d.h),
    boom: -1, hints: 0, ng: false, replay: opts.replay || null, endT: 0, daily: key === "daily",
  };
  G.anim.fill(1);
  if (opts.replay) { G.mines = opts.replay.mines; G.nums = counts(G.w, G.h, G.mines); G.ng = opts.replay.ng; G.started = false; G.bv = threeBV(); }
  if (G.daily) {
    const rng = K.RNG(K.dailySeed("defuse")), start = idx(G.w >> 1, G.h >> 1), r = generate(G.w, G.h, G.m, start, rng, true);
    G.mines = r.mines; G.nums = counts(G.w, G.h, G.mines); G.ng = r.ng; G.bv = threeBV();
    begin(); openFrom(start, start);
  }
  view.zoom = 1; view.px = view.py = 0;
  return G;
}
function threeBV() {
  const N = G.w * G.h, seen = new Uint8Array(N), tmp = []; let bv = 0;
  for (let i = 0; i < N; i++) { if (seen[i] || G.mines[i] || G.nums[i] !== 0) continue; bv++; const st = [i]; while (st.length) { const c = st.pop(); if (seen[c]) continue; seen[c] = 1; if (G.nums[c] === 0) for (const j of neigh(G.w, G.h, c, [])) if (!seen[j] && !G.mines[j]) st.push(j); } }
  for (let i = 0; i < N; i++) if (!seen[i] && !G.mines[i]) bv++;
  return bv;
}
function begin() { G.started = true; G.t0 = performance.now(); }
function firstClick(i) {
  const rng = K.RNG((Math.random() * 4294967296) >>> 0);
  const r = generate(G.w, G.h, G.m, i, rng, SAVE.noGuess);
  G.mines = r.mines; G.nums = counts(G.w, G.h, G.mines); G.ng = r.ng; G.bv = threeBV();
  if (SAVE.noGuess && !r.ng) K.toast("This board may need a guess", G.m / (G.w * G.h) > 0.26 ? "Too many mines for a no-guess board." : "Couldn't build a no-guess board this time.");
  begin();
}
function openFrom(i, origin) {
  const tmp = [], ox = origin % G.w, oy = (origin / G.w) | 0;
  const st = [[i, 0]]; let n = 0;
  while (st.length) {
    const [c, d] = st.shift();
    if (G.st[c] === OPEN || G.st[c] === FLAG) continue;
    G.st[c] = OPEN; G.opened++; n++;
    const x = c % G.w, y = (c / G.w) | 0; G.anim[c] = -Math.min(0.5, Math.hypot(x - ox, y - oy) * 0.022);
    if (G.nums[c] === 0) for (const j of neigh(G.w, G.h, c, tmp)) if (G.st[j] !== OPEN && G.st[j] !== FLAG) st.push([j, d + 1]);
  }
  return n;
}
function reveal(i) {
  if (G.over) return;
  if (!G.started && !G.mines) firstClick(i); else if (!G.started) begin();
  const s = G.st[i];
  if (s === OPEN) return chord(i);
  if (s === FLAG) return;
  G.clicks++;
  if (G.mines[i]) return lose(i);
  const n = openFrom(i, i);
  K.sfx(n > 8 ? "cascade" : "open");
  checkWin();
}
function chord(i) {
  if (G.over || G.st[i] !== OPEN || G.nums[i] <= 0) return;
  const tmp = neigh(G.w, G.h, i, []); let fl = 0, hid = 0;
  for (const j of tmp) { if (G.st[j] === FLAG) fl++; else if (G.st[j] !== OPEN) hid++; }
  if (fl !== G.nums[i] || !hid) { if (hid) { K.sfx("deny"); G.fx.push({ kind: "press", i, t: 0 }); } return; }
  G.clicks++;
  let boom = -1, n = 0;
  for (const j of tmp) { if (G.st[j] === FLAG || G.st[j] === OPEN) continue; if (G.mines[j]) { boom = j; continue; } n += openFrom(j, i); }
  if (boom >= 0) return lose(boom);
  K.sfx(n > 8 ? "cascade" : "chord");
  checkWin();
}
function toggleFlag(i) {
  if (G.over || G.st[i] === OPEN) return;
  if (!G.started && !G.mines) return; // flags before the first click would be pointless
  G.clicks++;
  if (G.st[i] === HIDDEN) { G.st[i] = FLAG; G.flags++; G.flagAnim[i] = 0; K.sfx("flag"); K.vibrate(15); }
  else if (G.st[i] === FLAG) { G.flags--; G.st[i] = SAVE.qmarks ? QUEST : HIDDEN; K.sfx("unflag"); }
  else G.st[i] = HIDDEN;
}
function checkWin() {
  if (G.opened !== G.w * G.h - G.m) return;
  G.over = true; G.won = true; G.time = performance.now() - G.t0; G.endT = 0;
  for (let i = 0; i < G.st.length; i++) if (G.mines[i] && G.st[i] !== FLAG) { G.st[i] = FLAG; G.flagAnim[i] = 0; }
  G.flags = G.m;
  K.sfx("win"); K.vibrate(60);
  for (let k = 0; k < 90; k++) PARTS.add({ x: view.ox + Math.random() * G.w * view.cs, y: view.oy - 10, vx: (Math.random() - 0.5) * 140, vy: Math.random() * 120 + 60, life: 2.2 + Math.random(), size: 6, color: K.pick(["255,159,64", "255,209,102", "110,231,168", "127,211,255", "255,107,107"]), g: 160, drag: 0.4, shrink: false });
  const g = G; setTimeout(() => { if (G === g) results(); }, 1100);
}
function lose(i) {
  G.over = true; G.won = false; G.boom = i; G.time = performance.now() - G.t0; G.endT = 0;
  G.st[i] = OPEN;
  const bx = i % G.w, by = (i / G.w) | 0, list = [];
  for (let j = 0; j < G.st.length; j++) if (G.mines[j] && j !== i && G.st[j] !== FLAG) list.push([j, Math.hypot((j % G.w) - bx, ((j / G.w) | 0) - by)]);
  list.sort((a, b) => a[1] - b[1]);
  G.chain = list.map(([j, d], k) => ({ i: j, t: 0.25 + Math.min(1.6, k * 0.035 + d * 0.012) }));
  explode(i, 1.4); K.sfx("boom"); K.vibrate(200);
  const g = G; setTimeout(() => { if (G === g) results(); }, 2100);
}
function explode(i, power = 1) {
  const x = view.ox + ((i % G.w) + 0.5) * view.cs, y = view.oy + (((i / G.w) | 0) + 0.5) * view.cs;
  PARTS.burst(x, y, Math.round(22 * power), { speed: 260 * power, life: 0.8, size: view.cs * 0.22, color: ["255,159,64", "255,209,102", "255,107,107", "255,240,200"], drag: 2.2 });
  view.shake = Math.min(1, view.shake + 0.35 * power);
}
function hint() {
  if (!G || G.over) return;
  if (!G.started || !G.mines) { K.toast("Click anywhere to start", "Your first click is always safe."); return; }
  const N = G.w * G.h, tmp = [];
  let safe = -1, sure = false;
  // look for a cell that logic proves safe
  for (let i = 0; i < N && safe < 0; i++) {
    if (G.st[i] !== OPEN || G.nums[i] <= 0) continue;
    const hid = []; let mn = 0;
    for (const j of neigh(G.w, G.h, i, tmp)) { if (G.st[j] === OPEN) continue; hid.push(j); if (G.mines[j]) mn++; }
    for (const j of hid) if (!G.mines[j] && G.st[j] !== FLAG) { const knownMines = hid.filter((q) => G.mines[q] && G.st[q] === FLAG).length; if (knownMines === G.nums[i]) { safe = j; sure = true; break; } }
  }
  if (safe < 0) {
    const cands = []; for (let i = 0; i < N; i++) if (!G.mines[i] && G.st[i] !== OPEN) { const near = neigh(G.w, G.h, i, tmp).some((j) => G.st[j] === OPEN); cands.push([i, near ? 0 : 1]); }
    cands.sort((a, b) => a[1] - b[1]); if (cands.length) safe = cands[0][0];
  }
  if (safe < 0) return;
  G.hints++; G.t0 -= 10000; K.sfx("hint");
  G.cursor = [safe % G.w, (safe / G.w) | 0];
  G.fx.push({ kind: "hint", i: safe, t: 0 });
  reveal(safe);
  K.toast("Hint used", "+10 seconds" + (sure ? "" : " · that one needed a guess"));
}

/* ================= view + input ================= */
const cv = $("#cv"), ctx = cv.getContext("2d");
const view = { cs: 30, ox: 0, oy: 0, W: 0, H: 0, dpr: 1, zoom: 1, px: 0, py: 0, fit: 30, shake: 0, hover: -1, cursorOn: false, down: -1, downBtn: -1 };
const PARTS = new K.Particles(1200);
function layout() {
  const w = innerWidth, h = innerHeight, d = K.fit(cv, w, h); view.W = w; view.H = h; view.dpr = d.dpr;
  if (!G) return;
  const top = $("#hud").hidden ? 10 : $("#hud").offsetHeight + 6;
  view.fit = Math.max(8, Math.floor(Math.min((w - 20) / G.w, (h - top - 14) / G.h)));
  view.cs = Math.round(view.fit * view.zoom);
  const bw = G.w * view.cs, bh = G.h * view.cs;
  const cx = w / 2, cy = top + (h - top) / 2;
  if (view.zoom === 1) { view.px = view.py = 0; }
  const maxPx = Math.max(0, (bw - (w - 20)) / 2), maxPy = Math.max(0, (bh - (h - top - 14)) / 2);
  view.px = clamp(view.px, -maxPx, maxPx); view.py = clamp(view.py, -maxPy, maxPy);
  view.ox = Math.round(cx - bw / 2 + view.px); view.oy = Math.round(cy - bh / 2 + view.py);
  $("#zoomBtn").hidden = view.fit >= 26 && view.zoom === 1;
  TILES = {};
}
addEventListener("resize", layout);
function cellAtPx(px, py) { if (!G) return -1; const x = Math.floor((px - view.ox) / view.cs), y = Math.floor((py - view.oy) / view.cs); return x >= 0 && y >= 0 && x < G.w && y < G.h ? y * G.w + x : -1; }
let flagMode = false;
const P = { pts: new Map(), longT: null, moved: false, startX: 0, startY: 0, pinch: 0, panX: 0, panY: 0, fired: false };
cv.addEventListener("contextmenu", (e) => e.preventDefault());
cv.addEventListener("pointerdown", (e) => {
  if (!G || K.ui.active()) return;
  K.audio(); cv.setPointerCapture(e.pointerId);
  P.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (P.pts.size === 2) { clearTimeout(P.longT); const [a, b] = [...P.pts.values()]; P.pinch = Math.hypot(a.x - b.x, a.y - b.y); P.pinchZoom = view.zoom; P.moved = true; return; }
  P.moved = false; P.fired = false; P.startX = e.clientX; P.startY = e.clientY; P.panX = view.px; P.panY = view.py;
  const i = cellAtPx(e.clientX, e.clientY); view.cursorOn = false;
  if (e.pointerType === "mouse") {
    view.down = i; view.downBtn = e.button;
    if (e.button === 2) { if (i >= 0) { if (e.buttons === 3 && G.st[i] === OPEN) chord(i); else toggleFlag(i); } P.fired = true; }
    else if (e.button === 1) { if (i >= 0) chord(i); P.fired = true; }
    else if (e.buttons === 3) { if (i >= 0) chord(i); P.fired = true; }
  } else {
    view.down = i;
    P.longT = setTimeout(() => { if (!P.moved && i >= 0 && !G.over) { P.fired = true; if (G.st[i] === OPEN) chord(i); else toggleFlag(i); } }, 330);
  }
});
cv.addEventListener("pointermove", (e) => {
  if (!G) return;
  if (e.pointerType === "mouse") view.hover = cellAtPx(e.clientX, e.clientY);
  if (!P.pts.has(e.pointerId)) return;
  P.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (P.pts.size === 2) { const [a, b] = [...P.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (P.pinch > 0) { setZoom(clamp(P.pinchZoom * (d / P.pinch), 1, 4)); } return; }
  const dx = e.clientX - P.startX, dy = e.clientY - P.startY;
  if (Math.hypot(dx, dy) > 10) { P.moved = true; clearTimeout(P.longT); }
  if (P.moved && view.zoom > 1) { view.px = P.panX + dx; view.py = P.panY + dy; layout(); }
});
const endPointer = (e) => {
  if (!P.pts.has(e.pointerId)) return;
  P.pts.delete(e.pointerId); clearTimeout(P.longT);
  if (P.pts.size > 0) return;
  if (!G || P.fired) { view.down = -1; return; }
  const i = cellAtPx(e.clientX, e.clientY);
  if (!P.moved && i >= 0 && i === view.down) {
    if (e.pointerType === "mouse" && e.button !== 0) {}
    else if (flagMode && G.st[i] !== OPEN && G.started) toggleFlag(i);
    else reveal(i);
  }
  view.down = -1;
};
cv.addEventListener("pointerup", endPointer);
cv.addEventListener("pointercancel", (e) => { P.pts.delete(e.pointerId); clearTimeout(P.longT); view.down = -1; });
cv.addEventListener("pointerleave", () => { view.hover = -1; });
cv.addEventListener("wheel", (e) => { if (!G || K.ui.active()) return; e.preventDefault(); setZoom(clamp(view.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 4)); }, { passive: false });
function setZoom(z) { view.zoom = z; layout(); }
addEventListener("keydown", (e) => {
  if (!G || K.ui.active()) return;
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }[e.code];
  if (dir) { e.preventDefault(); moveCursor(dir[0], dir[1]); return; }
  if (e.repeat) return;
  const i = G.cursor[1] * G.w + G.cursor[0];
  if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); view.cursorOn = true; reveal(i); }
  else if (e.code === "KeyF" || e.code === "KeyE") { view.cursorOn = true; toggleFlag(i); }
  else if (e.code === "KeyH") hint();
  else if (e.code === "F2" || e.code === "KeyN") { e.preventDefault(); restart(); }
  else if (e.code === "Escape") menu();
});
function moveCursor(dx, dy) { if (!view.cursorOn) { view.cursorOn = true; if (view.hover >= 0) G.cursor = [view.hover % G.w, (view.hover / G.w) | 0]; } G.cursor = [clamp(G.cursor[0] + dx, 0, G.w - 1), clamp(G.cursor[1] + dy, 0, G.h - 1)]; K.sfx("move"); keepCursorVisible(); }
function keepCursorVisible() {
  if (view.zoom === 1) return;
  const cx = view.ox + (G.cursor[0] + 0.5) * view.cs, cy = view.oy + (G.cursor[1] + 0.5) * view.cs, m = view.cs * 2;
  if (cx < m) view.px += m - cx; if (cx > view.W - m) view.px -= cx - (view.W - m);
  if (cy < 80 + m) view.py += 80 + m - cy; if (cy > view.H - m) view.py -= cy - (view.H - m);
  layout();
}
let padRepeat = 0, padDir = 0;
function pollPadGame(dt) {
  const p = K.pad; if (!p.connected || !G || K.ui.active()) return;
  const h = p.held, vy = h.du ? -1 : h.dd ? 1 : 0, vx = h.dl ? -1 : h.dr ? 1 : 0, nd = vy * 3 + vx;
  if (nd !== padDir) { padDir = nd; padRepeat = 0.28; if (nd) moveCursor(vx, vy); } else if (nd) { padRepeat -= dt; if (padRepeat <= 0) { padRepeat = 0.07; moveCursor(vx, vy); } }
  const i = G.cursor[1] * G.w + G.cursor[0];
  if (p.pressed.a) { view.cursorOn = true; reveal(i); }
  if (p.pressed.x) { view.cursorOn = true; toggleFlag(i); }
  if (p.pressed.y) hint();
  if (p.pressed.lb) setZoom(clamp(view.zoom / 1.25, 1, 4)); if (p.pressed.rb) setZoom(clamp(view.zoom * 1.25, 1, 4));
  if (p.pressed.start) menu();
  if (p.pressed.back) restart();
}
$("#face").onclick = () => restart();
$("#menuBtn").onclick = () => menu();
$("#hintBtn").onclick = () => hint();
$("#flagMode").onclick = () => { flagMode = !flagMode; $("#flagMode").classList.toggle("on", flagMode); K.sfx("click"); };
$("#zoomBtn").onclick = () => { setZoom(view.zoom >= 2.5 ? 1 : view.zoom < 1.5 ? 1.6 : 2.6); };
function restart() { if (!G) return; K.sfx("ok"); start(G.key); }

/* ================= drawing ================= */
const NUMCOL = [null, "#6fb8ff", "#6ee7a8", "#ff7b7b", "#b49cff", "#ffb35c", "#5fe3e3", "#f2f2f2", "#9aa6b8"];
let TILES = {};
function tile(kind, n = 0) {
  const s = Math.max(4, Math.round(view.cs * view.dpr)), key = kind + n + ":" + s; if (TILES[key]) return TILES[key];
  const c = document.createElement("canvas"); c.width = c.height = s; const g = c.getContext("2d"), r = s * 0.14, p = Math.max(1, s * 0.045);
  if (kind === "hid" || kind === "hov" || kind === "prs") {
    const gr = g.createLinearGradient(0, 0, 0, s);
    if (kind === "prs") { gr.addColorStop(0, "#202c44"); gr.addColorStop(1, "#1a2539"); }
    else { gr.addColorStop(0, kind === "hov" ? "#4a6390" : "#3b5079"); gr.addColorStop(1, kind === "hov" ? "#33476c" : "#2a3a5c"); }
    g.fillStyle = gr; K.roundRect(g, p, p, s - p * 2, s - p * 2, r); g.fill();
    if (kind !== "prs") { g.fillStyle = "rgba(255,255,255,0.13)"; K.roundRect(g, p * 2, p * 2, s - p * 4, s * 0.18, r * 0.6); g.fill(); g.strokeStyle = "rgba(10,16,28,0.9)"; g.lineWidth = p; K.roundRect(g, p, p, s - p * 2, s - p * 2, r); g.stroke(); }
  } else if (kind === "open" || kind === "red") {
    g.fillStyle = kind === "red" ? "#a32135" : "#121a2b"; K.roundRect(g, p * 0.6, p * 0.6, s - p * 1.2, s - p * 1.2, r * 0.7); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.04)"; g.lineWidth = 1; g.stroke();
    if (n > 0) { g.font = `800 ${Math.round(s * 0.62)}px JetBrains Mono, monospace`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = NUMCOL[n]; g.fillText(String(n), s / 2, s / 2 + s * 0.04); }
  } else if (kind === "flag") {
    const x0 = s * 0.38, top = s * 0.2, bot = s * 0.78;
    g.fillStyle = "#c8d2e6"; g.fillRect(x0, top, Math.max(1.5, s * 0.07), bot - top);
    g.fillStyle = "#ff5a5a"; g.beginPath(); g.moveTo(x0 + s * 0.06, top); g.lineTo(x0 + s * 0.42, top + s * 0.14); g.lineTo(x0 + s * 0.06, top + s * 0.3); g.closePath(); g.fill();
    g.fillStyle = "#c8d2e6"; g.fillRect(s * 0.27, bot, s * 0.36, Math.max(1.5, s * 0.07));
  } else if (kind === "mine") {
    const cx = s / 2, cy = s / 2, R = s * 0.22;
    g.strokeStyle = "#0b0f18"; g.lineWidth = Math.max(1.5, s * 0.08); g.lineCap = "round";
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI; g.beginPath(); g.moveTo(cx - Math.cos(a) * R * 1.6, cy - Math.sin(a) * R * 1.6); g.lineTo(cx + Math.cos(a) * R * 1.6, cy + Math.sin(a) * R * 1.6); g.stroke(); }
    g.fillStyle = "#0b0f18"; g.beginPath(); g.arc(cx, cy, R, 0, K.TAU); g.fill();
    g.fillStyle = "rgba(255,255,255,0.7)"; g.beginPath(); g.arc(cx - R * 0.35, cy - R * 0.35, R * 0.28, 0, K.TAU); g.fill();
  } else if (kind === "cross") {
    g.strokeStyle = "#ff6b6b"; g.lineWidth = Math.max(2, s * 0.09); g.lineCap = "round"; g.beginPath(); g.moveTo(s * 0.22, s * 0.22); g.lineTo(s * 0.78, s * 0.78); g.moveTo(s * 0.78, s * 0.22); g.lineTo(s * 0.22, s * 0.78); g.stroke();
  } else if (kind === "q") { g.font = `800 ${Math.round(s * 0.55)}px Sora, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#dfe7f5"; g.fillText("?", s / 2, s / 2 + s * 0.03); }
  return (TILES[key] = c);
}
let bgT = 0;
function render(dt) {
  bgT += dt;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const gr = ctx.createRadialGradient(view.W / 2, view.H * 0.4, 0, view.W / 2, view.H * 0.4, Math.max(view.W, view.H) * 0.8);
  gr.addColorStop(0, "#14203a"); gr.addColorStop(1, "#070b14"); ctx.fillStyle = gr; ctx.fillRect(0, 0, view.W, view.H);
  if (!G) return;
  let sx = 0, sy = 0; if (view.shake > 0) { sx = (Math.random() - 0.5) * view.shake * 14; sy = (Math.random() - 0.5) * view.shake * 14; view.shake = Math.max(0, view.shake - dt * 2.5); }
  ctx.translate(sx, sy);
  const cs = view.cs, ox = view.ox, oy = view.oy, N = G.w * G.h;
  ctx.fillStyle = "rgba(4,8,16,0.65)"; K.roundRect(ctx, ox - 6, oy - 6, G.w * cs + 12, G.h * cs + 12, 10); ctx.fill();
  const pressSet = new Set();
  if (view.down >= 0 && !G.over && P.pts.size < 2) { const i = view.down; if (G.st[i] === OPEN) { for (const j of neigh(G.w, G.h, i, [])) if (G.st[j] === HIDDEN) pressSet.add(j); } else if (G.st[i] === HIDDEN && view.downBtn !== 2) pressSet.add(i); }
  for (const f of G.fx) if (f.kind === "press" && f.t < 0.15) for (const j of neigh(G.w, G.h, f.i, [])) if (G.st[j] === HIDDEN) pressSet.add(j);
  const minC = Math.max(0, Math.floor(-ox / cs)), maxC = Math.min(G.w - 1, Math.ceil((view.W - ox) / cs)), minR = Math.max(0, Math.floor(-oy / cs)), maxR = Math.min(G.h - 1, Math.ceil((view.H - oy) / cs));
  const chainSet = new Map(); if (G.chain) for (const c of G.chain) chainSet.set(c.i, c.t);
  for (let y = minR; y <= maxR; y++) for (let x = minC; x <= maxC; x++) {
    const i = y * G.w + x, s = G.st[i], px = ox + x * cs, py = oy + y * cs;
    if (s === OPEN) {
      let a = G.anim[i]; if (a < 1) { a += dt * 6; G.anim[i] = a; }
      const k = clamp(a, 0, 1);
      if (k < 1) ctx.drawImage(tile("hid"), px, py, cs, cs);
      if (k > 0) {
        const sc = 0.75 + 0.25 * K.ease.outBack(k), w = cs * sc;
        ctx.globalAlpha = Math.min(1, k * 1.6);
        if (G.mines && G.mines[i]) { ctx.drawImage(tile(i === G.boom ? "red" : "open"), px + (cs - w) / 2, py + (cs - w) / 2, w, w); ctx.drawImage(tile("mine"), px + (cs - w) / 2, py + (cs - w) / 2, w, w); }
        else ctx.drawImage(tile("open", G.nums[i]), px + (cs - w) / 2, py + (cs - w) / 2, w, w);
        ctx.globalAlpha = 1;
      }
    } else {
      const hov = !G.over && (i === view.hover || (view.cursorOn && i === G.cursor[1] * G.w + G.cursor[0]));
      ctx.drawImage(tile(pressSet.has(i) ? "prs" : hov ? "hov" : "hid"), px, py, cs, cs);
      if (s === FLAG) {
        let fa = G.flagAnim[i]; if (fa < 1) { fa = Math.min(1, fa + dt * 5); G.flagAnim[i] = fa; }
        const sc = K.ease.outBack(fa), w = cs * sc; ctx.drawImage(tile("flag"), px + (cs - w) / 2, py + (cs - w) / 2 - (1 - fa) * cs * 0.4, w, w);
        if (G.over && !G.won && G.mines && !G.mines[i]) ctx.drawImage(tile("cross"), px, py, cs, cs);
      } else if (s === QUEST) ctx.drawImage(tile("q"), px, py, cs, cs);
      else if (G.over && !G.won && G.mines && G.mines[i]) {
        const t = chainSet.get(i);
        if (t !== undefined && G.endT >= t) {
          if (!G.blown) G.blown = new Set();
          if (!G.blown.has(i)) { G.blown.add(i); explode(i, 0.45); K.sfx("pop2"); }
          ctx.drawImage(tile("open"), px, py, cs, cs); ctx.drawImage(tile("mine"), px, py, cs, cs);
        }
      }
    }
  }
  // cursor + hint glow
  if (view.cursorOn && !G.over) { const [x, y] = G.cursor; ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 2.5; K.roundRect(ctx, ox + x * cs + 1.5, oy + y * cs + 1.5, cs - 3, cs - 3, cs * 0.15); ctx.stroke(); }
  for (const f of G.fx) {
    f.t += dt;
    if (f.kind === "hint") { const k = f.t / 1.2; ctx.strokeStyle = `rgba(255,209,102,${1 - k})`; ctx.lineWidth = 3; const x = ox + (f.i % G.w) * cs, y = oy + ((f.i / G.w) | 0) * cs, e = k * cs * 0.6; K.roundRect(ctx, x - e, y - e, cs + e * 2, cs + e * 2, cs * 0.2); ctx.stroke(); }
  }
  G.fx = G.fx.filter((f) => f.t < 1.2);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  PARTS.update(dt); PARTS.draw(ctx);
}
function updateHud() {
  if (!G) return;
  const left = G.m - G.flags; $("#mines").textContent = String(left).padStart(3, "0");
  const t = G.over ? G.time : G.started ? performance.now() - G.t0 : 0;
  $("#time").textContent = t < 100000 ? (t / 1000).toFixed(1) : K.fmtTime(t / 1000);
  $("#face").textContent = G.over ? (G.won ? "😎" : "😵") : view.down >= 0 && P.pts.size ? "😮" : "🙂";
}

/* ================= audio ================= */
K.defineSfx({
  open: (t) => K.voice(900 + Math.random() * 120, t, 0.05, { type: "triangle", vol: 0.05 }),
  cascade: (t) => { K.notes(t, [660, 880, 1100, 1320, 1760], 0.025, { type: "triangle", vol: 0.04, len: 0.08 }); K.noise(t, 0.18, { freq: 3000, slide: 1.8, vol: 0.025 }); },
  chord: (t) => { K.voice(740, t, 0.05, { type: "triangle", vol: 0.05 }); K.voice(1110, t + 0.04, 0.06, { type: "triangle", vol: 0.04 }); },
  flag: (t) => { K.voice(420, t, 0.06, { duty: 0.5, vol: 0.04, slide: 1.6 }); K.noise(t, 0.05, { freq: 2600, vol: 0.03 }); },
  unflag: (t) => K.voice(560, t, 0.06, { duty: 0.5, vol: 0.035, slide: 0.6 }),
  boom: (t) => { K.noise(t, 1.1, { filter: "lowpass", freq: 1500, slide: 0.06, vol: 0.28 }); K.voice(90, t, 0.8, { type: "sine", vol: 0.25, slide: 0.35 }); K.noise(t, 0.25, { freq: 4000, vol: 0.08 }); },
  pop2: (t) => K.noise(t, 0.25, { filter: "lowpass", freq: 900 + Math.random() * 500, slide: 0.2, vol: 0.09 }),
  hint: (t) => K.notes(t, [1046, 1318, 1568], 0.05, { type: "sine", vol: 0.05, len: 0.3 }),
}, { open: 0.02, pop2: 0.04 });
K.songs({
  calm: { bpm: 84, chords: ["Dm", "Bb", "F", "C", "Dm", "Bb", "Gm", "A"], pad: true, padVol: 0.02, arp: true, arpVol: 0.018, arpPat: [0, 2, 1, 3],
    bass: "R . . . . . . . F . . . . . . .", lead: ["d5 - - - a4 - - -", "f5 - - - d5 - - -", "c5 - - - a4 - - -", "e5 - - - g5 - - -", "f5 - - - e5 - d5 -", "d5 - - - bb4 - - -", "d5 - - - g5 - f5 -", "e5 - - - c#5 - - -"], leadVol: 0.035 },
});

/* ================= menus ================= */
function bestOf(key) { const b = key === "daily" ? (SAVE.daily.date === K.today() ? SAVE.daily.best : 0) : SAVE.best[key]; return b ? K.fmtMs(b) : ""; }
function title() {
  G = null; $("#hud").hidden = true; K.playSong("calm", 1);
  const cards = ["beginner", "intermediate", "expert", "daily"].map((k) => `<button class="k-btn diff" data-a="start" data-k="${k}"><b>${DIFFS[k].name}</b><span>${DIFFS[k].desc}</span><em>${bestOf(k) ? "Best " + bestOf(k) : k === "daily" && SAVE.daily.date === K.today() && SAVE.daily.done ? "Played today" : "No record yet"}</em></button>`).join("");
  const s = K.ui.show(`<div class="logo">DEFUSE</div><p class="k-sub">Clear the field without touching a mine.</p>
    <div class="diffs">${cards}</div>
    <div class="k-panel custom"><b>Custom</b>
      <label>Width<input id="cw" type="number" min="5" max="50" value="${SAVE.custom.w}"></label>
      <label>Height<input id="ch" type="number" min="5" max="30" value="${SAVE.custom.h}"></label>
      <label>Mines<input id="cm" type="number" min="1" max="999" value="${SAVE.custom.m}"></label>
      <button class="k-btn" data-a="custom">Play custom</button></div>
    <div class="k-row"><button class="k-btn ${SAVE.noGuess ? "on" : ""}" data-a="ng">No-guess boards: ${SAVE.noGuess ? "On" : "Off"}</button><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>
    <p class="k-sub" style="font-size:.85em">Played ${K.fmt(SAVE.stats.played)} · won ${K.fmt(SAVE.stats.won)}</p>`, { cls: "soft" });
}
function start(key) {
  newGame(key); K.ui.hide(); $("#hud").hidden = false; flagMode = false; $("#flagMode").classList.remove("on");
  $("#flagMode").hidden = !(K.device === "touch" || matchMedia("(pointer: coarse)").matches);
  layout(); K.playSong("calm", 2);
  if (key === "daily") K.banner("DAILY BOARD", "The start is already open. Good luck.", 2000);
}
function menu() {
  if (!G) return;
  const playing = G.started && !G.over;
  K.ui.show(`<h2 class="logo" style="font-size:2.4em">${playing ? "PAUSED" : "DEFUSE"}</h2>
    <div class="k-menu">${playing ? `<button class="k-btn primary" data-a="resume" autofocus>Resume</button>` : `<button class="k-btn primary" data-a="resume" autofocus>Back to board</button>`}
    <button class="k-btn" data-a="new">New board</button><button class="k-btn" data-a="settings" data-from="menu">Settings</button><button class="k-btn" data-a="title">Change difficulty</button></div>`, { back: "resume" });
  G.pauseAt = performance.now();
}
function results() {
  const won = G.won, sec = G.time / 1000, key = G.key, st = SAVE.stats;
  st.played++; if (won) st.won++; st.time += sec; st.cleared += G.opened;
  let pb = false;
  if (won && !G.hints) {
    if (key === "daily") { if (SAVE.daily.date !== K.today()) SAVE.daily = { date: K.today(), best: 0, done: false }; if (!SAVE.daily.best || G.time < SAVE.daily.best) { SAVE.daily.best = G.time; pb = true; } }
    else if (SAVE.best[key] !== undefined && (!SAVE.best[key] || G.time < SAVE.best[key])) { SAVE.best[key] = G.time; pb = true; }
  }
  if (key === "daily") { if (SAVE.daily.date !== K.today()) SAVE.daily = { date: K.today(), best: 0, done: false }; SAVE.daily.done = true; }
  persist();
  const eff = G.clicks ? Math.round((G.bv / G.clicks) * 100) : 0;
  K.ui.show(`<div class="k-sub">${DIFFS[key].name}${G.ng ? " · no-guess" : ""}</div>
    <div class="big" style="color:${won ? "var(--good)" : "var(--bad)"}">${won ? K.fmtMs(G.time) : "BOOM"}</div>
    ${won ? (pb ? `<b style="color:var(--gold)">New best time!</b>` : G.hints ? `<span class="k-sub">Hints used, so this one doesn't count for records.</span>` : bestOf(key) ? `<span class="k-sub">Best ${bestOf(key)}</span>` : "") : `<span class="k-sub">You cleared ${Math.round((G.opened / (G.w * G.h - G.m)) * 100)}% of the field.</span>`}
    <div class="k-stats"><div class="k-stat"><small>3BV</small><b>${G.bv}</b></div><div class="k-stat"><small>3BV / s</small><b>${sec > 0 && won ? (G.bv / sec).toFixed(2) : "–"}</b></div>
    <div class="k-stat"><small>Clicks</small><b>${G.clicks}</b></div><div class="k-stat"><small>Efficiency</small><b>${won ? eff + "%" : "–"}</b></div></div>
    <div class="k-row"><button class="k-btn primary" data-a="new" autofocus>New board</button>${!won && key !== "daily" ? `<button class="k-btn" data-a="retry">Retry this board</button>` : ""}${key === "daily" && won ? `<button class="k-btn" data-a="share">Copy result</button>` : ""}<button class="k-btn" data-a="look">Look at board</button><button class="k-btn" data-a="title">Difficulty</button></div>
    <div class="k-msg" id="msg"></div>`, { back: "look" });
}
function settings(from) {
  const back = from === "menu" ? "menu" : "title";
  const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div>
    <div class="k-panel" style="width:min(100%,32em);display:flex;flex-direction:column;align-items:center">
      <div class="k-opt"><span>No-guess boards</span><button class="k-btn small" data-a="tog" data-k="noGuess">${SAVE.noGuess ? "On" : "Off"}</button></div>
      <div class="k-opt"><span>Question marks</span><button class="k-btn small" data-a="tog" data-k="qmarks">${SAVE.qmarks ? "On" : "Off"}</button></div>
      ${K.ui.settingsRows()}</div>`, { back, cls: "top" });
  K.ui.bindSettings(s);
}
function help() {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="k-help">
      <div><b>Numbers</b>Each number tells you how many mines touch that square, including diagonals.</div>
      <div><b>Flags</b>Mark squares you know are mines. Click a number with the right number of flags around it to open the rest (chording).</div>
      <div><b>No-guess</b>With no-guess boards on, every board can be cleared by logic alone. Your first click is always safe.</div>
      <div class="k-kbonly"><b>Mouse & keys</b>Left click open · right click flag · click a number to chord · arrows move · Space open · F flag · H hint · N new · scroll to zoom</div>
      <div><b>Controller</b>Stick moves · A open · X flag · Y hint · LB/RB zoom · Start menu · Back new board</div>
      <div class="k-touchonly"><b>Touch</b>Tap to open · hold to flag · tap a number to chord · pinch to zoom, drag to pan · or turn on Flag mode</div>
    </div>`, { back: "title", cls: "top" });
}
K.ui.on((a, d, el) => {
  switch (a) {
    case "start": K.sfx("ok"); return start(d.k);
    case "custom": {
      const w = clamp(+$("#cw").value | 0, 5, 50), h = clamp(+$("#ch").value | 0, 5, 30), m = clamp(+$("#cm").value | 0, 1, w * h - 1);
      SAVE.custom = { w, h, m }; persist(); K.sfx("ok"); return start("custom");
    }
    case "ng": SAVE.noGuess = !SAVE.noGuess; persist(); K.sfx("ok"); return title();
    case "title": K.sfx("back"); return title();
    case "resume": K.ui.hide(); if (G && G.pauseAt && G.started && !G.over) G.t0 += performance.now() - G.pauseAt; if (G) G.pauseAt = 0; return;
    case "new": K.ui.hide(); return restart();
    case "retry": { const rp = { mines: G.mines, ng: G.ng }; K.ui.hide(); newGame(G.key, { replay: rp }); layout(); K.sfx("ok"); return; }
    case "look": K.ui.hide(); return;
    case "menu": return menu();
    case "settings": K.sfx("ok"); return settings(d.from);
    case "help": K.sfx("ok"); return help();
    case "tog": SAVE[d.k] = !SAVE[d.k]; persist(); el.textContent = SAVE[d.k] ? "On" : "Off"; K.sfx("ok"); return;
    case "share": K.copy(`DEFUSE · Daily Board ${K.today()}\nCleared in ${K.fmtMs(SAVE.daily.best)}`).then((ok) => { const m = $("#msg"); if (m) m.textContent = ok ? "Copied to clipboard." : "Couldn't copy."; }); return;
  }
});
K.onPause(() => { if (G && G.started && !G.over && !K.ui.active()) menu(); });

/* ================= boot ================= */
layout();
title();
K.loop((dt) => { pollPadGame(dt); if (G && G.over) G.endT += dt; render(dt); updateHud(); });
