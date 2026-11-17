"use strict";
/* STACKFALL — falling-block puzzle. SRS rotation + kicks, 7-bag, hold, ghost, lock delay with move reset,
   T-spins (3-corner rule), back-to-back, combos, perfect clears. Modes: Marathon, Sprint, Ultra, Dig, Zen, Daily. */
const { $, $$, clamp, lerp } = K;
const W = 10, H = 40, VIS = 20, TOP = H - VIS;

/* ================= settings + records ================= */
const DEFAULT_KEYS = { left: ["ArrowLeft", ""], right: ["ArrowRight", ""], soft: ["ArrowDown", ""], hard: ["Space", ""], cw: ["ArrowUp", "KeyX"], ccw: ["KeyZ", "ControlLeft"], r180: ["KeyA", ""], hold: ["KeyC", "ShiftLeft"], pause: ["Escape", "KeyP"], restart: ["KeyR", ""] };
const ACTION_NAMES = { left: "Move left", right: "Move right", soft: "Soft drop", hard: "Hard drop", cw: "Rotate right", ccw: "Rotate left", r180: "Rotate 180°", hold: "Hold", pause: "Pause", restart: "Restart" };
const SAVE = K.load("stackfall.v1", {
  das: 167, arr: 33, sdf: 20, ghost: true, grid: true, shake: true, keys: DEFAULT_KEYS,
  best: { marathon: 0, sprint: 0, ultra: 0, dig: 0, zen: 0 }, splits: [], daily: { date: "", best: 0 },
  stats: { games: 0, lines: 0, pieces: 0, quads: 0, tspins: 0, pcs: 0, time: 0 },
});
for (const a in DEFAULT_KEYS) if (!Array.isArray(SAVE.keys[a]) || SAVE.keys[a].length !== 2) SAVE.keys[a] = DEFAULT_KEYS[a].slice();
const persist = () => K.save("stackfall.v1", SAVE);

/* ================= pieces ================= */
const TYPES = "IJLOSTZ";
const SHAPE = { I: ["....", "####", "....", "...."], J: ["#..", "###", "..."], L: ["..#", "###", "..."], O: [".##", ".##", "..."], S: [".##", "##.", "..."], T: [".#.", "###", "..."], Z: ["##.", ".##", "..."] };
const COLOR = { I: 1, J: 2, L: 3, O: 4, S: 5, T: 6, Z: 7 };
const PALETTE = [null, [79, 230, 255], [79, 125, 255], [255, 160, 64], [255, 216, 74], [94, 240, 138], [176, 108, 255], [255, 90, 110], [110, 116, 140]];
const CELLS = {};
for (const t of TYPES) {
  let m = SHAPE[t].map((r) => [...r].map((c) => c === "#")); const n = m.length; CELLS[t] = [];
  for (let s = 0; s < 4; s++) {
    const cells = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) cells.push([x, y]);
    CELLS[t].push(cells);
    if (t !== "O") m = m.map((row, y) => row.map((_, x) => m[n - 1 - x][y]));
  }
}
/* SRS kick tables, written y-up like the standard tables; applied as (x + kx, y - ky). */
const KICK_JLSTZ = { "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]] };
const KICK_I = { "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]] };
const KICK_180 = { "0>2": [[0, 0], [0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]], "2>0": [[0, 0], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]], "1>3": [[0, 0], [1, 0], [1, 2], [1, 1], [0, 2], [0, 1]], "3>1": [[0, 0], [-1, 0], [-1, 2], [-1, 1], [0, 2], [0, 1]] };

/* ================= modes ================= */
const MODES = {
  marathon: { name: "Marathon", desc: "Clear 150 lines as the speed climbs. Highest score wins.", goal: "150 lines", score: true },
  sprint: { name: "Sprint", desc: "Clear 40 lines as fast as you can.", goal: "40 lines", time: true },
  ultra: { name: "Ultra", desc: "Score as much as you can in 2 minutes.", goal: "2 minutes", score: true },
  dig: { name: "Dig", desc: "Clear 10 lines of garbage from the bottom as fast as you can.", goal: "10 garbage", time: true },
  zen: { name: "Zen", desc: "No speed-up and no game over. Just stack.", goal: "endless" },
  daily: { name: "Daily Sprint", desc: "40 lines with today's piece order. Same for everyone.", goal: "40 lines", time: true },
};

/* ================= game state ================= */
let G = null;
function newGame(mode) {
  const seed = mode === "daily" ? K.dailySeed("stackfall") : (Math.random() * 4294967296) >>> 0;
  G = {
    mode, seed, rng: K.RNG(seed), board: new Uint8Array(W * H), garbageRow: new Uint8Array(H), queue: [], bag: [],
    piece: null, hold: null, holdUsed: false, score: 0, lines: 0, level: 1, combo: -1, b2b: false, pieces: 0,
    time: 0, started: false, countdown: mode === "zen" ? 0 : 2.4, over: false, won: false, endT: 0,
    lockT: 0, resets: 0, lowest: 0, lastRot: false, lastKick: 0, grav: 0, soft: false,
    stats: { single: 0, double: 0, triple: 0, quad: 0, tspin: 0, pc: 0, maxCombo: 0, b2b: 0 },
    garbageLeft: 0, splits: [], fx: { pops: [], flashes: [], trails: [], shake: 0, lockFlash: [] }, inputs: 0,
  };
  if (mode === "dig") makeGarbage(10);
  for (let i = 0; i < 6; i++) refill();
  spawn();
  return G;
}
function refill() { if (!G.bag.length) G.bag = G.rng.shuffle([...TYPES]); G.queue.push(G.bag.pop()); }
function makeGarbage(n) {
  let hole = G.rng.int(W);
  for (let r = 0; r < n; r++) {
    if (G.rng() < 0.7 || r === 0) { let h; do { h = G.rng.int(W); } while (h === hole && W > 1); hole = h; }
    const y = H - 1 - r;
    for (let x = 0; x < W; x++) G.board[y * W + x] = x === hole ? 0 : 8;
    G.garbageRow[y] = 1;
  }
  G.garbageLeft = n;
}
const cellAt = (x, y) => (x < 0 || x >= W || y >= H ? 9 : y < 0 ? 0 : G.board[y * W + x]);
function collide(type, rot, x, y) { for (const [cx, cy] of CELLS[type][rot]) if (cellAt(x + cx, y + cy)) return true; return false; }
function spawn(type) {
  type = type || G.queue.shift(); refill();
  const p = { type, rot: 0, x: 3, y: TOP - 2 };
  if (collide(type, 0, p.x, p.y)) { G.piece = p; topOut(); return; }
  if (!collide(type, 0, p.x, p.y + 1)) p.y++;
  G.piece = p; G.lockT = 0; G.resets = 0; G.lowest = p.y; G.lastRot = false; G.grav = 0;
}
function gravityRate() {
  if (G.mode === "zen" || G.mode === "sprint" || G.mode === "daily" || G.mode === "dig") return 1;
  const L = G.level; return 1 / Math.pow(Math.max(0.0001, 0.8 - (L - 1) * 0.007), L - 1);
}
function grounded() { const p = G.piece; return collide(p.type, p.rot, p.x, p.y + 1); }
function afterMove() {
  const p = G.piece;
  if (p.y > G.lowest) { G.lowest = p.y; G.resets = 0; }
  if (grounded()) { if (G.resets < 15) { G.lockT = 0; G.resets++; } }
}
function tryMove(dx) {
  const p = G.piece; if (!p || G.over) return false;
  if (collide(p.type, p.rot, p.x + dx, p.y)) return false;
  p.x += dx; G.lastRot = false; afterMove(); K.sfx("move"); G.inputs++; return true;
}
function tryRotate(dir) {
  const p = G.piece; if (!p || G.over) return false;
  if (p.type === "O") { K.sfx("rotate"); return true; }
  const to = (p.rot + dir + 4) % 4, key = p.rot + ">" + to;
  const table = dir === 2 ? KICK_180[key] : p.type === "I" ? KICK_I[key] : KICK_JLSTZ[key];
  for (let i = 0; i < table.length; i++) {
    const [kx, ky] = table[i];
    if (!collide(p.type, to, p.x + kx, p.y - ky)) {
      p.x += kx; p.y -= ky; p.rot = to; G.lastRot = true; G.lastKick = i; afterMove(); K.sfx("rotate"); G.inputs++; return true;
    }
  }
  return false;
}
function ghostY() { const p = G.piece; let y = p.y; while (!collide(p.type, p.rot, p.x, y + 1)) y++; return y; }
function softStep() { const p = G.piece; if (!collide(p.type, p.rot, p.x, p.y + 1)) { p.y++; G.lastRot = false; afterMove(); if (MODES[G.mode].score) G.score += 1; return true; } return false; }
function hardDrop() {
  const p = G.piece; if (!p || G.over || !G.started) return;
  const gy = ghostY(), dist = gy - p.y;
  if (dist > 0) { G.lastRot = false; for (const [cx, cy] of CELLS[p.type][p.rot]) G.fx.trails.push({ x: p.x + cx, y0: p.y + cy, y1: gy + cy, t: 0, c: COLOR[p.type] }); }
  p.y = gy;
  if (MODES[G.mode].score) G.score += 2 * dist;
  if (SAVE.shake) G.fx.shake = Math.min(1, G.fx.shake + 0.25 + dist * 0.02);
  K.sfx("hard"); G.inputs++;
  lock();
}
function holdPiece() {
  if (!G.piece || G.holdUsed || G.over || !G.started) return;
  const cur = G.piece.type; G.holdUsed = true; K.sfx("hold"); G.inputs++;
  if (G.hold) { const h = G.hold; G.hold = cur; spawn(h); } else { G.hold = cur; spawn(); }
}

/* ---------- locking, clears, scoring ---------- */
function tspinKind() {
  const p = G.piece; if (p.type !== "T" || !G.lastRot) return "";
  const c = [[0, 0], [2, 0], [0, 2], [2, 2]].map(([dx, dy]) => !!cellAt(p.x + dx, p.y + dy));
  if (c.filter(Boolean).length < 3) return "";
  const front = [[0, 1], [1, 3], [2, 3], [0, 2]][p.rot];
  if (c[front[0]] && c[front[1]]) return "full";
  return G.lastKick === 4 ? "full" : "mini";
}
function lock() {
  const p = G.piece, ts = tspinKind();
  let above = true;
  for (const [cx, cy] of CELLS[p.type][p.rot]) { const x = p.x + cx, y = p.y + cy; if (y >= 0) G.board[y * W + x] = COLOR[p.type]; if (y >= TOP) above = false; G.fx.lockFlash.push({ x, y, t: 0 }); }
  G.pieces++; G.piece = null; G.holdUsed = false;
  K.sfx("lock");
  // clears
  const full = [];
  for (let y = 0; y < H; y++) { let f = true; for (let x = 0; x < W; x++) if (!G.board[y * W + x]) { f = false; break; } if (f) full.push(y); }
  const n = full.length;
  let digCleared = 0;
  if (n) {
    for (const y of full) {
      if (G.garbageRow[y]) digCleared++;
      G.fx.flashes.push({ y, t: 0 });
      for (let x = 0; x < W; x++) burstCell(x, y, G.board[y * W + x]);
    }
    const nb = new Uint8Array(W * H), ng = new Uint8Array(H); let dst = H - 1;
    for (let y = H - 1; y >= 0; y--) { if (full.includes(y)) continue; nb.set(G.board.subarray(y * W, y * W + W), dst * W); ng[dst] = G.garbageRow[y]; dst--; }
    G.board = nb; G.garbageRow = ng;
  }
  const pc = n > 0 && G.board.every((v) => v === 0);
  score(n, ts, pc);
  G.lines += n;
  if (G.mode === "dig") G.garbageLeft = Math.max(0, G.garbageLeft - digCleared);
  if (MODES[G.mode].score || G.mode === "zen") { const nl = Math.min(G.mode === "zen" ? 1 : 15, 1 + Math.floor(G.lines / 10)); if (nl > G.level) { G.level = nl; K.banner("LEVEL " + nl, "", 1200); K.sfx("level"); } }
  if ((G.mode === "sprint" || G.mode === "daily") && n) { const tens = Math.floor(G.lines / 10); while (G.splits.length < Math.min(4, tens)) G.splits.push(G.time); }
  // finish conditions
  if ((G.mode === "sprint" || G.mode === "daily") && G.lines >= 40) return finish(true);
  if (G.mode === "dig" && G.garbageLeft === 0) return finish(true);
  if (G.mode === "marathon" && G.lines >= 150) return finish(true);
  if (above && G.mode !== "zen") return topOut();
  spawn();
}
function score(n, ts, pc) {
  const L = G.level, S = G.stats;
  let base = 0, label = "", difficult = false;
  if (ts === "full") { base = [400, 800, 1200, 1600][n]; label = ["T-SPIN", "T-SPIN SINGLE", "T-SPIN DOUBLE", "T-SPIN TRIPLE"][n]; difficult = n > 0; S.tspin++; }
  else if (ts === "mini") { base = [100, 200, 400][Math.min(2, n)]; label = n ? "MINI T-SPIN " + ["", "SINGLE", "DOUBLE"][Math.min(2, n)] : "MINI T-SPIN"; difficult = n > 0; S.tspin++; }
  else { base = [0, 100, 300, 500, 800][n]; label = ["", "SINGLE", "DOUBLE", "TRIPLE", "QUAD"][n]; difficult = n === 4; }
  if (n === 1 && !ts) S.single++; if (n === 2 && !ts) S.double++; if (n === 3 && !ts) S.triple++; if (n === 4) S.quad++;
  let pts = base * L, b2bNow = false;
  if (n > 0) {
    if (difficult) { if (G.b2b) { pts *= 1.5; b2bNow = true; S.b2b++; } G.b2b = true; } else G.b2b = false;
    G.combo++; if (G.combo > 0) pts += 50 * G.combo * L;
    S.maxCombo = Math.max(S.maxCombo, G.combo);
  } else G.combo = -1;
  if (pc) { pts += [0, 800, 1200, 1800, 2000][n] * L * (n === 4 && b2bNow ? 1.6 : 1); S.pc++; }
  if (MODES[G.mode].score || G.mode === "zen") G.score += Math.round(pts);
  // feedback
  if (label) pop(label, ts ? "tspin" : n === 4 ? "quad" : "line", n);
  if (b2bNow) pop("BACK-TO-BACK", "b2b");
  if (G.combo > 0) pop("COMBO " + G.combo, "combo");
  if (pc) { pop("PERFECT CLEAR", "pc"); K.sfx("pc"); K.vibrate(80); }
  if (n) {
    K.sfx(ts ? "tspin" : ["", "clear1", "clear2", "clear3", "quad"][n]);
    if (G.combo > 0) setTimeout(() => K.sfx("combo"), 60);
    if (SAVE.shake && (n >= 3 || ts)) G.fx.shake = Math.min(1.2, G.fx.shake + n * 0.18);
    if (n === 4 || ts) K.vibrate(35);
  } else if (ts) K.sfx("tspin");
}
function topOut() { if (G.mode === "zen") { K.sfx("topout"); zenReset(); return; } G.over = true; G.won = false; G.endT = 0; K.sfx("topout"); K.vibrate(120); const g = G; setTimeout(() => { if (G === g) results(); }, 1300); }
function zenReset() { for (let y = 0; y < H; y++) G.fx.flashes.push({ y, t: 0 }); G.board.fill(0); G.garbageRow.fill(0); pop("FRESH START", "pc"); spawn(); }
function finish(won) { G.over = true; G.won = won; G.endT = 0; G.piece = null; K.sfx("win"); K.banner(G.mode === "marathon" ? "COMPLETE" : "FINISH", "", 1400); const g = G; setTimeout(() => { if (G === g) results(); }, 1200); }

/* ================= input ================= */
const IN = { left: false, right: false, dir: 0, das: 0, arr: 0, soft: false, padDas: 0 };
function actionFor(code) { for (const a in SAVE.keys) if (SAVE.keys[a].includes(code)) return a; return null; }
function press(a) {
  if (!G) return;
  if (a === "pause") return pause();
  if (a === "restart") return restart();
  if (!G.started || G.over) { if (a === "left") IN.left = true; if (a === "right") IN.right = true; if (a === "left" || a === "right") IN.dir = a === "left" ? -1 : 1; if (a === "soft") IN.soft = true; return; }
  switch (a) {
    case "left": IN.left = true; IN.dir = -1; IN.das = 0; IN.arr = 0; tryMove(-1); break;
    case "right": IN.right = true; IN.dir = 1; IN.das = 0; IN.arr = 0; tryMove(1); break;
    case "soft": IN.soft = true; break;
    case "hard": hardDrop(); break;
    case "cw": tryRotate(1); break;
    case "ccw": tryRotate(-1); break;
    case "r180": tryRotate(2); break;
    case "hold": holdPiece(); break;
  }
}
function release(a) {
  if (a === "left") { IN.left = false; if (IN.dir === -1) { IN.dir = IN.right ? 1 : 0; IN.das = 0; IN.arr = 0; } }
  if (a === "right") { IN.right = false; if (IN.dir === 1) { IN.dir = IN.left ? -1 : 0; IN.das = 0; IN.arr = 0; } }
  if (a === "soft") IN.soft = false;
}
let rebinding = null;
addEventListener("keydown", (e) => {
  if (rebinding) { e.preventDefault(); finishRebind(e.code); return; }
  if (K.ui.active()) return;
  const a = actionFor(e.code); if (!a) return;
  e.preventDefault();
  if (e.repeat) return;
  press(a);
});
addEventListener("keyup", (e) => { const a = actionFor(e.code); if (a) release(a); });
addEventListener("blur", () => { IN.left = IN.right = IN.soft = false; IN.dir = 0; });
function pollPadGame() {
  const P = K.pad; if (!P.connected || K.ui.active()) return;
  const pr = P.pressed, h = P.held;
  if (pr.start) return press("pause");
  if (pr.back) return press("restart");
  if (h.dl && !IN.padL) { IN.padL = true; press("left"); } else if (!h.dl && IN.padL) { IN.padL = false; release("left"); }
  if (h.dr && !IN.padR) { IN.padR = true; press("right"); } else if (!h.dr && IN.padR) { IN.padR = false; release("right"); }
  if (h.dd && !IN.padD) { IN.padD = true; press("soft"); } else if (!h.dd && IN.padD) { IN.padD = false; release("soft"); }
  if (pr.du) press("hard");
  if (pr.a) press("cw"); if (pr.b) press("ccw"); if (pr.y) press("r180"); if (pr.x || pr.lb || pr.rb) press("hold");
}
/* touch: drag to move, drag down to soft drop, flick down to hard drop, flick up to hold, tap to rotate */
const T = { id: null, x: 0, y: 0, ax: 0, ay: 0, t: 0, moved: false };
const cv = $("#cv"), ctx = cv.getContext("2d");
cv.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" || !G || K.ui.active()) return;
  T.id = e.pointerId; T.x = T.ax = e.clientX; T.y = T.ay = e.clientY; T.t = performance.now(); T.moved = false; cv.setPointerCapture(e.pointerId);
});
cv.addEventListener("pointermove", (e) => {
  if (e.pointerId !== T.id || !G || !G.started || G.over) return;
  const c = L.cell * 0.9;
  while (e.clientX - T.ax >= c) { tryMove(1); T.ax += c; T.moved = true; }
  while (T.ax - e.clientX >= c) { tryMove(-1); T.ax -= c; T.moved = true; }
  while (e.clientY - T.ay >= c) { if (G.piece) softStep(); T.ay += c; T.moved = true; }
  if (Math.abs(e.clientY - T.y) > c * 0.6 || Math.abs(e.clientX - T.x) > c * 0.6) T.moved = true;
});
cv.addEventListener("pointerup", (e) => {
  if (e.pointerId !== T.id) return; T.id = null;
  if (!G || !G.started || G.over) return;
  const dt = performance.now() - T.t, dy = e.clientY - T.y, dx = e.clientX - T.x, v = dy / Math.max(1, dt);
  if (dy > L.cell * 2 && v > 0.9) { hardDrop(); return; }
  if (dy < -L.cell * 2 && v < -0.7) { holdPiece(); return; }
  if (!T.moved && dt < 300 && Math.hypot(dx, dy) < 14) tryRotate(e.clientX < innerWidth / 3 ? -1 : 1);
});
for (const b of $$("#touchbar button")) b.addEventListener("pointerdown", (e) => { e.preventDefault(); K.audio(); const t = b.dataset.t; if (t === "pause") pause(); else if (t === "drop") hardDrop(); else if (t === "hold") holdPiece(); else tryRotate(t === "cw" ? 1 : -1); });

/* ================= loop ================= */
function step(dt) {
  if (!G || G.over) { if (G) G.endT += dt; return; }
  if (!G.started) { G.countdown -= dt; if (G.countdown <= 0) { G.started = true; K.sfx("go"); } else { const c = Math.ceil(G.countdown / 0.8); if (c !== G.lastCount) { G.lastCount = c; K.sfx("count"); } } return; }
  G.time += dt * 1000;
  if (G.mode === "ultra" && G.time >= 120000) { G.time = 120000; return finish(true); }
  // auto shift
  if (IN.dir) {
    IN.das += dt * 1000;
    if (IN.das >= SAVE.das) {
      if (SAVE.arr <= 0) { while (tryMove(IN.dir)); }
      else { IN.arr += IN.das - Math.max(SAVE.das, IN.das - dt * 1000); IN.das = SAVE.das; while (IN.arr >= SAVE.arr) { if (!tryMove(IN.dir)) { IN.arr = 0; break; } IN.arr -= SAVE.arr; } }
    }
  }
  const p = G.piece; if (!p) return;
  // gravity
  const rate = gravityRate() * (IN.soft ? (SAVE.sdf >= 41 ? 1e6 : SAVE.sdf) : 1);
  if (IN.soft && SAVE.sdf >= 41) { while (softStep()); }
  else {
    G.grav += rate * dt;
    if (G.grav >= 20) { while (!grounded()) { p.y++; } G.grav = 0; afterMove(); }
    while (G.grav >= 1) { G.grav -= 1; if (IN.soft) { if (!softStep()) { G.grav = 0; break; } } else if (!grounded()) { p.y++; G.lastRot = false; afterMove(); } else { G.grav = 0; break; } }
  }
  if (grounded()) { G.lockT += dt; if (G.lockT >= 0.5) lock(); }
  else G.lockT = 0;
}
function restart() { if (!G) return; K.ui.hide(); start(G.mode); }
function pause() {
  if (!G || G.over || K.ui.active()) return;
  K.sfx("back");
  const s = K.ui.show(`<h2 class="logo" style="font-size:2.4em">PAUSED</h2><div class="k-sub">${MODES[G.mode].name} · ${statusText()}</div>
    <div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="restart">Restart <span class="k-kbonly" style="opacity:.6">(R)</span></button>
    <button class="k-btn" data-a="settings" data-from="pause">Settings</button><button class="k-btn" data-a="modes">Quit to menu</button></div>`, { back: "resume" });
  return s;
}
function statusText() { if (!G) return ""; return MODES[G.mode].time ? K.fmtMs(G.time) + " · " + G.lines + " lines" : K.fmt(G.score) + " points · " + G.lines + " lines"; }
document.addEventListener("visibilitychange", () => { if (document.hidden && G && G.started && !G.over && !K.ui.active()) pause(); });
K.onPause((why) => { if (why === "blur" && G && G.started && !G.over && !K.ui.active()) pause(); });

/* ================= rendering ================= */
const L = { cell: 30, bx: 0, by: 0, W: 0, H: 0, dpr: 1, portrait: false, mini: 18 };
const PARTS = new K.Particles(900);
function layout() {
  const w = innerWidth, h = innerHeight, d = K.fit(cv, w, h);
  L.W = w; L.H = h; L.dpr = d.dpr;
  const touch = K.device === "touch" && $("#touchbar") && !$("#touchbar").hidden, tb = touch ? 96 : 0;
  L.portrait = w < h * 0.82;
  if (!L.portrait) {
    L.cell = Math.max(10, Math.floor(Math.min((w - 40) / 23, (h - 30 - tb) / 21.4)));
    L.bx = Math.round(w / 2 - 5 * L.cell); L.by = Math.round((h - tb - 20 * L.cell) / 2 + L.cell * 0.2);
    L.mini = Math.round(L.cell * 0.82);
  } else {
    L.cell = Math.max(10, Math.floor(Math.min((w - 20) / 10.4, (h - tb - 20) / 24.6)));
    L.bx = Math.round((w - 10 * L.cell) / 2); L.by = Math.round(h - tb - 20 * L.cell - 10);
    L.mini = Math.round(L.cell * 0.55);
  }
  SPRITES = {};
}
addEventListener("resize", layout);
let SPRITES = {};
function block(c, size, kind = "solid") {
  const key = c + ":" + size + ":" + kind; if (SPRITES[key]) return SPRITES[key];
  const cnv = document.createElement("canvas"), d = L.dpr, s = Math.max(2, Math.round(size * d));
  cnv.width = cnv.height = s; const g = cnv.getContext("2d"), [r, gg, b] = PALETTE[c], pad = Math.max(1, s * 0.04), rr = s * 0.16;
  if (kind === "ghost") {
    g.strokeStyle = `rgba(${r},${gg},${b},0.75)`; g.lineWidth = Math.max(1, s * 0.07); K.roundRect(g, pad + g.lineWidth / 2, pad + g.lineWidth / 2, s - pad * 2 - g.lineWidth, s - pad * 2 - g.lineWidth, rr); g.stroke();
    g.fillStyle = `rgba(${r},${gg},${b},0.12)`; g.fill();
  } else {
    const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, `rgb(${Math.min(255, r + 55)},${Math.min(255, gg + 55)},${Math.min(255, b + 55)})`); gr.addColorStop(0.5, `rgb(${r},${gg},${b})`); gr.addColorStop(1, `rgb(${r * 0.62 | 0},${gg * 0.62 | 0},${b * 0.62 | 0})`);
    g.fillStyle = gr; K.roundRect(g, pad, pad, s - pad * 2, s - pad * 2, rr); g.fill();
    g.fillStyle = "rgba(255,255,255,0.28)"; K.roundRect(g, pad * 2.5, pad * 2.5, s - pad * 5, s * 0.22, rr * 0.6); g.fill();
    g.strokeStyle = `rgba(${r * 0.4 | 0},${gg * 0.4 | 0},${b * 0.4 | 0},0.9)`; g.lineWidth = Math.max(1, s * 0.045); K.roundRect(g, pad, pad, s - pad * 2, s - pad * 2, rr); g.stroke();
    if (kind === "dim") { g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(20,24,40,0.6)"; g.fillRect(0, 0, s, s); }
  }
  return (SPRITES[key] = cnv);
}
function burstCell(x, y, c) {
  if (y < TOP || !c) return;
  const px = L.bx + (x + 0.5) * L.cell, py = L.by + (y - TOP + 0.5) * L.cell, col = PALETTE[c].join(",");
  PARTS.burst(px, py, 3, { speed: 260, life: 0.7, size: L.cell * 0.28, color: col, g: 600, drag: 1.2 });
}
function pop(text, kind, n = 0) {
  G.fx.pops.push({ text, kind, t: 0, n, y: G.fx.pops.filter((p) => p.t < 1.4).length });
}
let BG = { t: 0, shapes: [] };
for (let i = 0; i < 16; i++) BG.shapes.push({ type: TYPES[i % 7], x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), v: 0.01 + Math.random() * 0.02, r: Math.random() * K.TAU, vr: (Math.random() - 0.5) * 0.2 });
function drawBackground(dt) {
  BG.t += dt;
  const w = L.W, h = L.H, lvl = G ? G.level : 1, hue = (220 + lvl * 9) % 360;
  const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, `hsl(${hue},45%,8%)`); gr.addColorStop(1, `hsl(${(hue + 40) % 360},50%,4%)`);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  const u = Math.min(w, h) / 9;
  for (const s of BG.shapes) {
    s.y -= s.v * dt; s.r += s.vr * dt; if (s.y < -0.2) { s.y = 1.2; s.x = Math.random(); }
    ctx.save(); ctx.translate(s.x * w, s.y * h); ctx.rotate(s.r); ctx.globalAlpha = 0.05; ctx.fillStyle = `rgb(${PALETTE[COLOR[s.type]].join(",")})`;
    for (const [cx, cy] of CELLS[s.type][0]) ctx.fillRect((cx - 1.5) * u * s.s * 0.5, (cy - 1) * u * s.s * 0.5, u * s.s * 0.47, u * s.s * 0.47);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawPieceAt(type, px, py, size, kind = "solid", rot = 0) {
  for (const [cx, cy] of CELLS[type][rot]) ctx.drawImage(block(COLOR[type], size, kind), px + cx * size, py + cy * size, size, size);
}
function drawPreview(type, cx, cy, size, dim) {
  const cells = CELLS[type][0], xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
  const w = (Math.max(...xs) - Math.min(...xs) + 1) * size, h = (Math.max(...ys) - Math.min(...ys) + 1) * size;
  const ox = cx - w / 2 - Math.min(...xs) * size, oy = cy - h / 2 - Math.min(...ys) * size;
  for (const [x, y] of cells) ctx.drawImage(block(COLOR[type], size, dim ? "dim" : "solid"), ox + x * size, oy + y * size, size, size);
}
function panelBox(x, y, w, h, title) {
  ctx.fillStyle = "rgba(8,12,28,0.78)"; K.roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = "rgba(120,150,255,0.22)"; ctx.lineWidth = 1; ctx.stroke();
  if (title) { ctx.fillStyle = "#8a96c4"; ctx.font = `700 ${Math.max(10, L.cell * 0.42)}px Chakra Petch, sans-serif`; ctx.textAlign = "left"; ctx.fillText(title, x + 10, y + Math.max(14, L.cell * 0.62)); }
}
function render(dt) {
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  drawBackground(dt);
  if (!G) return;
  const c = L.cell, bx0 = L.bx, by0 = L.by;
  let sx = 0, sy = 0;
  if (G.fx.shake > 0) { sy = G.fx.shake * c * 0.18 * Math.sin(BG.t * 60); sx = G.fx.shake * c * 0.06 * Math.sin(BG.t * 47); G.fx.shake = Math.max(0, G.fx.shake - dt * 4); }
  const bx = bx0 + sx, by = by0 + sy;
  // board well
  ctx.fillStyle = "rgba(6,9,22,0.88)"; K.roundRect(ctx, bx - 4, by - 4, 10 * c + 8, 20 * c + 8, 8); ctx.fill();
  const danger = (() => { for (let y = TOP; y < TOP + 4; y++) for (let x = 0; x < W; x++) if (G.board[y * W + x]) return true; return false; })();
  ctx.strokeStyle = danger ? `rgba(255,90,110,${0.5 + 0.4 * Math.sin(BG.t * 8)})` : "rgba(120,150,255,0.35)"; ctx.lineWidth = 2; ctx.stroke();
  if (SAVE.grid) { ctx.strokeStyle = "rgba(120,150,255,0.07)"; ctx.lineWidth = 1; ctx.beginPath(); for (let x = 1; x < W; x++) { ctx.moveTo(bx + x * c + 0.5, by); ctx.lineTo(bx + x * c + 0.5, by + 20 * c); } for (let y = 1; y < VIS; y++) { ctx.moveTo(bx, by + y * c + 0.5); ctx.lineTo(bx + 10 * c, by + y * c + 0.5); } ctx.stroke(); }
  // locked cells
  const overK = G.over && !G.won ? Math.min(1, G.endT / 1.1) : 0;
  for (let y = TOP; y < H; y++) for (let x = 0; x < W; x++) {
    const v = G.board[y * W + x]; if (!v) continue;
    const grey = overK > 0 && (H - 1 - y) / VIS < overK;
    ctx.drawImage(block(grey ? 8 : v, c, grey ? "dim" : "solid"), bx + x * c, by + (y - TOP) * c, c, c);
  }
  // cells above the field (only the piece can be there, but show a sliver of locked blocks if any)
  // lock flashes
  for (const f of G.fx.lockFlash) { f.t += dt; if (f.y >= TOP) { ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - f.t / 0.18)})`; ctx.fillRect(bx + f.x * c, by + (f.y - TOP) * c, c, c); } }
  G.fx.lockFlash = G.fx.lockFlash.filter((f) => f.t < 0.18);
  // hard drop trails
  for (const t of G.fx.trails) {
    t.t += dt; const k = 1 - t.t / 0.25, col = PALETTE[t.c].join(",");
    const y0 = Math.max(TOP, t.y0), y1 = t.y1; if (y1 < TOP) continue;
    const g2 = ctx.createLinearGradient(0, by + (y0 - TOP) * c, 0, by + (y1 - TOP + 1) * c); g2.addColorStop(0, `rgba(${col},0)`); g2.addColorStop(1, `rgba(${col},${0.35 * k})`);
    ctx.fillStyle = g2; ctx.fillRect(bx + t.x * c + c * 0.1, by + (y0 - TOP) * c, c * 0.8, (y1 - y0 + 1) * c);
  }
  G.fx.trails = G.fx.trails.filter((t) => t.t < 0.25);
  // ghost + active piece
  const p = G.piece;
  if (p && !G.over) {
    if (SAVE.ghost) { const gy = ghostY(); for (const [cx, cy] of CELLS[p.type][p.rot]) if (gy + cy >= TOP) ctx.drawImage(block(COLOR[p.type], c, "ghost"), bx + (p.x + cx) * c, by + (gy + cy - TOP) * c, c, c); }
    const lockGlow = grounded() ? 0.35 + 0.35 * Math.sin(BG.t * 18) * (G.lockT / 0.5) : 0;
    for (const [cx, cy] of CELLS[p.type][p.rot]) {
      const y = p.y + cy; if (y < TOP - 1) continue;
      ctx.drawImage(block(COLOR[p.type], c), bx + (p.x + cx) * c, by + (y - TOP) * c, c, c);
      if (lockGlow > 0) { ctx.fillStyle = `rgba(255,255,255,${lockGlow * 0.35})`; ctx.fillRect(bx + (p.x + cx) * c, by + (y - TOP) * c, c, c); }
    }
  }
  // line flashes
  for (const f of G.fx.flashes) { f.t += dt; if (f.y >= TOP) { const k = 1 - f.t / 0.32; ctx.fillStyle = `rgba(255,255,255,${0.85 * k})`; ctx.fillRect(bx - 4 - (1 - k) * c, by + (f.y - TOP) * c + c * 0.5 * (1 - k), 10 * c + 8 + (1 - k) * c * 2, c * k); } }
  G.fx.flashes = G.fx.flashes.filter((f) => f.t < 0.32);
  // side panels
  drawSide(bx, by, c);
  PARTS.update(dt); PARTS.draw(ctx);
  // action popups
  ctx.textAlign = "center";
  for (const q of G.fx.pops) {
    q.t += dt; const k = q.t / 1.5; if (k >= 1) continue;
    const col = { tspin: "#d29bff", quad: "#4fe6ff", line: "#eef2ff", b2b: "#ffd84a", combo: "#5ef08a", pc: "#ffd84a" }[q.kind];
    const size = c * ({ quad: 1.05, tspin: 0.9, pc: 1.1, b2b: 0.62, combo: 0.62, line: 0.7 }[q.kind]);
    const sc = q.t < 0.12 ? K.ease.outBack(q.t / 0.12) : 1;
    ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
    ctx.font = `700 ${Math.round(size * sc)}px Chakra Petch, sans-serif`;
    const yy = by + 5.5 * c + q.y * c * 1.15 - k * c * 0.8;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillText(q.text, bx + 5 * c + 2, yy + 3); ctx.fillStyle = col; ctx.fillText(q.text, bx + 5 * c, yy);
  }
  ctx.globalAlpha = 1;
  G.fx.pops = G.fx.pops.filter((q) => q.t < 1.5);
  // countdown
  if (!G.started && G.countdown > 0) {
    const n = Math.ceil(G.countdown / 0.8), k = 1 - ((G.countdown / 0.8) % 1);
    ctx.font = `700 ${Math.round(c * (2.6 + (1 - k) * 0.6))}px Chakra Petch, sans-serif`; ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * (1 - k)})`;
    ctx.fillText(String(n), bx + 5 * c, by + 10 * c);
  } else if (G.started && G.time < 500 && G.mode !== "zen") { ctx.font = `700 ${Math.round(c * 2.4)}px Chakra Petch, sans-serif`; ctx.fillStyle = `rgba(79,230,255,${1 - G.time / 500})`; ctx.fillText("GO!", bx + 5 * c, by + 10 * c); }
}
function drawSide(bx, by, c) {
  const m = L.mini, font = (s, wgt = 700) => `${wgt} ${Math.round(s)}px Chakra Petch, sans-serif`;
  const label = (t, x, y, a = "left", col = "#8a96c4", s = c * 0.42) => { ctx.font = font(s); ctx.fillStyle = col; ctx.textAlign = a; ctx.fillText(t, x, y); };
  const value = (t, x, y, a = "left", s = c * 0.85, col = "#eef2ff") => { ctx.font = font(s); ctx.fillStyle = col; ctx.textAlign = a; ctx.fillText(t, x, y); };
  const md = MODES[G.mode];
  if (!L.portrait) {
    // hold
    const hx = bx - 5.2 * c, hw = 4.6 * c;
    panelBox(hx, by, hw, 3.4 * c, "HOLD");
    if (G.hold) drawPreview(G.hold, hx + hw / 2, by + 2.0 * c, m, G.holdUsed);
    // next
    const nx = bx + 10 * c + 0.6 * c, nw = 4.6 * c;
    panelBox(nx, by, nw, 13.2 * c, "NEXT");
    G.queue.slice(0, 5).forEach((t, i) => drawPreview(t, nx + nw / 2, by + 2.1 * c + i * 2.45 * c, i === 0 ? m : m * 0.82));
    // stats under hold
    let y = by + 4.4 * c; const x = hx + 0.3 * c;
    label(md.name.toUpperCase(), x, y, "left", "#4fe6ff", c * 0.5); y += c * 1.05;
    const rows = statRows();
    for (const [k, v, big] of rows) { label(k, x, y); y += c * (big ? 0.95 : 0.78); value(v, x, y, "left", big ? c * 0.95 : c * 0.7); y += c * 0.85; }
  } else {
    // compact header above the board
    const top = by - 3.2 * m - 10, hw = m * 4.6;
    panelBox(L.bx, Math.max(6, top - m * 0.4), hw, m * 3.6, "HOLD");
    if (G.hold) drawPreview(G.hold, L.bx + hw / 2, Math.max(6, top - m * 0.4) + m * 2.3, m * 0.9, G.holdUsed);
    const nx = L.bx + 10 * c - hw * 1.55;
    panelBox(nx, Math.max(6, top - m * 0.4), hw * 1.55, m * 3.6, "NEXT");
    G.queue.slice(0, 3).forEach((t, i) => drawPreview(t, nx + hw * 0.32 + i * hw * 0.48, Math.max(6, top - m * 0.4) + m * 2.3, i === 0 ? m * 0.85 : m * 0.62));
    const rows = statRows(), cx = L.bx + 10 * c / 2 - hw * 0.15;
    label(md.name.toUpperCase(), cx, Math.max(6, top - m * 0.4) + m * 1.0, "center", "#4fe6ff", m * 0.6);
    if (rows[0]) value(rows[0][1], cx, Math.max(6, top - m * 0.4) + m * 2.4, "center", m * 1.0);
    if (rows[1]) label(rows[1][0] + " " + rows[1][1], cx, Math.max(6, top - m * 0.4) + m * 3.25, "center", "#8a96c4", m * 0.62);
  }
}
function statRows() {
  const pps = G.time > 0 ? (G.pieces / (G.time / 1000)).toFixed(2) : "0.00";
  switch (G.mode) {
    case "sprint": case "daily": {
      const rows = [["TIME", K.fmtMs(G.time), true], ["LINES", Math.max(0, 40 - G.lines) + " left"], ["PIECES", G.pieces + " · " + pps + "/s"]];
      const pb = SAVE.splits; if (pb && pb.length && G.splits.length) { const i = G.splits.length - 1, d = G.splits[i] - pb[i]; rows.push(["PACE", (d <= 0 ? "-" : "+") + (Math.abs(d) / 1000).toFixed(2)]); }
      return rows;
    }
    case "dig": return [["TIME", K.fmtMs(G.time), true], ["GARBAGE", G.garbageLeft + " left"], ["PIECES", G.pieces + " · " + pps + "/s"]];
    case "ultra": return [["SCORE", K.fmt(G.score), true], ["TIME LEFT", K.fmtMs(Math.max(0, 120000 - G.time))], ["LINES", String(G.lines)]];
    case "zen": return [["SCORE", K.fmt(G.score), true], ["LINES", String(G.lines)], ["PIECES", String(G.pieces)]];
    default: return [["SCORE", K.fmt(G.score), true], ["LEVEL", String(G.level)], ["LINES", G.lines + " / 150"], ["TIME", K.fmtTime(G.time / 1000)]];
  }
}

/* ================= audio ================= */
K.defineSfx({
  move: (t) => K.voice(880, t, 0.025, { type: "triangle", vol: 0.025 }),
  rotate: (t) => K.voice(1320, t, 0.03, { type: "triangle", vol: 0.03, slide: 1.2 }),
  hard: (t) => { K.voice(140, t, 0.12, { type: "sine", vol: 0.16, slide: 0.5 }); K.noise(t, 0.08, { filter: "lowpass", freq: 900, vol: 0.08 }); },
  lock: (t) => K.voice(420, t, 0.04, { duty: 0.5, vol: 0.03 }),
  hold: (t) => K.noise(t, 0.12, { freq: 2600, slide: 0.4, vol: 0.04, q: 1.5 }),
  clear1: (t) => K.notes(t, [784, 988], 0.05, { type: "triangle", vol: 0.07, len: 0.18 }),
  clear2: (t) => K.notes(t, [784, 988, 1175], 0.05, { type: "triangle", vol: 0.07, len: 0.2 }),
  clear3: (t) => K.notes(t, [784, 988, 1175, 1397], 0.05, { type: "triangle", vol: 0.07, len: 0.22 }),
  quad: (t) => { K.notes(t, [523, 659, 784, 1046, 1318], 0.05, { duty: 0.25, vol: 0.07, len: 0.35 }); K.noise(t, 0.4, { filter: "lowpass", freq: 2000, slide: 0.3, vol: 0.06 }); },
  tspin: (t) => { K.notes(t, [1175, 1568, 2093], 0.04, { type: "sine", vol: 0.06, len: 0.3 }); K.noise(t, 0.3, { freq: 5000, slide: 0.5, vol: 0.04, q: 2 }); },
  combo: (t) => K.voice(523 * Math.pow(2, Math.min(12, G ? G.combo : 0) / 12), t, 0.12, { duty: 0.25, vol: 0.05 }),
  pc: (t) => K.notes(t, [523, 659, 784, 1046, 1318, 1568, 2093], 0.06, { duty: 0.125, vol: 0.06, len: 0.5 }),
  level: (t) => K.notes(t, [659, 784, 988, 1318], 0.06, { duty: 0.25, vol: 0.05, len: 0.25 }),
  count: (t) => K.voice(660, t, 0.1, { duty: 0.5, vol: 0.05 }),
  go: (t) => K.voice(1320, t, 0.25, { duty: 0.5, vol: 0.06 }),
  topout: (t) => { K.voice(300, t, 0.9, { type: "sawtooth", vol: 0.07, slide: 0.25, lp: 1800 }); K.noise(t, 0.6, { filter: "lowpass", freq: 600, slide: 0.3, vol: 0.08 }); },
}, { move: 0.02, rotate: 0.02, lock: 0.03 });
K.songs({
  menu: { bpm: 96, chords: ["Em", "C", "G", "D", "Em", "C", "Am", "B"], pad: true, arp: true, arpPat: [0, 1, 2, 3, 2, 1], bass: "R . . . O . . . R . . . O . . .",
    lead: ["e5 - - - g5 - - -", "e5 - - - c5 - - -", "d5 - - - g5 - b5 -", "a5 - - - f#5 - - -", "g5 - - - e5 - - -", "e5 - g5 - c6 - - -", "b5 - a5 - g5 - e5 -", "d#5 - - - - - - -"] },
  play: { bpm: 136, chords: ["Am", "F", "C", "G", "Am", "F", "G", "E"], arp: true, drums: "k . h . s . h k k . h . s . h h", bass: "R . R O R . R O R . R O R . F O", leadVol: 0.05,
    lead: ["a4 . c5 e5 a5 - g5 e5", "f5 - e5 c5 a4 - c5 -", "e5 - g5 - c6 - b5 a5", "g5 - d5 - b4 - d5 -", "a4 . c5 e5 a5 - b5 c6", "a5 - f5 - c5 - f5 -", "g5 - b5 - d6 - b5 g5", "g#5 - - - e5 - - -"] },
  fast: { bpm: 158, chords: ["Dm", "Bb", "C", "A", "Dm", "Bb", "C", "A"], arp: true, drums: "k h s h k k s h k h s h k k s s", bass: "R R O R R R O R R R O R F F O F", leadVol: 0.045,
    lead: ["d5 f5 a5 f5 d5 f5 a5 d6", "bb5 - a5 - f5 - d5 -", "c5 e5 g5 e5 c5 e5 g5 c6", "c#6 - a5 - e5 - c#5 -", "d5 f5 a5 f5 d5 f5 a5 d6", "f6 - d6 - bb5 - f5 -", "e5 g5 c6 g5 e5 g5 c6 e6", "e6 - c#6 - a5 - - -"] },
});
function musicForGame() { if (!G) return K.playSong("menu", 3); if (G.mode === "zen") return K.playSong("menu", 3); if (G.level >= 10 || ((G.mode === "sprint" || G.mode === "daily") && G.lines >= 30) || (G.mode === "ultra" && G.time > 90000)) return K.playSong("fast", 3); K.playSong("play", 3); }

/* ================= menus ================= */
function bestText(m) {
  const b = m === "daily" ? (SAVE.daily.date === K.today() ? SAVE.daily.best : 0) : SAVE.best[m];
  if (!b) return "No record yet";
  return MODES[m].time ? "Best " + K.fmtMs(b) : m === "zen" ? "Most lines " + K.fmt(b) : "Best " + K.fmt(b);
}
function title() {
  G = null; showTouch(false); K.playSong("menu", 3);
  const modes = ["marathon", "sprint", "ultra", "dig", "zen", "daily"].map((m) => `<button class="k-btn mode" data-a="start" data-m="${m}"><b>${MODES[m].name}</b><span>${MODES[m].desc}</span><em>${bestText(m)}</em></button>`).join("");
  K.ui.show(`<div class="logo">STACKFALL</div><p class="k-sub">Stack, spin, clear. Pick a mode.</p>
    <div class="modes">${modes}</div>
    <div class="k-row"><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button><button class="k-btn" data-a="stats">Stats</button></div>`, { cls: "soft" });
}
function start(mode) {
  newGame(mode); K.ui.hide(); showTouch(true); layout(); IN.left = IN.right = IN.soft = false; IN.dir = 0; musicForGame();
  if (mode !== "zen") K.sfx("count");
}
function showTouch(on) { const tb = $("#touchbar"); const want = on && (K.device === "touch" || matchMedia("(pointer: coarse)").matches); if (tb.hidden !== !want) { tb.hidden = !want; layout(); } }
function results() {
  if (!G) return;
  showTouch(false);
  const m = G.mode, md = MODES[m], st = SAVE.stats, sec = G.time / 1000;
  st.games++; st.lines += G.lines; st.pieces += G.pieces; st.quads += G.stats.quad; st.tspins += G.stats.tspin; st.pcs += G.stats.pc; st.time += sec;
  let main = "", isPB = false;
  if (md.time) {
    main = G.won ? K.fmtMs(G.time) : "Topped out";
    if (G.won) {
      if (m === "daily") { if (SAVE.daily.date !== K.today()) SAVE.daily = { date: K.today(), best: 0 }; if (!SAVE.daily.best || G.time < SAVE.daily.best) { SAVE.daily.best = G.time; isPB = true; } }
      else if (!SAVE.best[m] || G.time < SAVE.best[m]) { SAVE.best[m] = G.time; isPB = true; if (m === "sprint") SAVE.splits = G.splits.slice(); }
    }
  } else if (m === "zen") { main = K.fmt(G.lines) + " lines"; }
  else { main = K.fmt(G.score); if (G.score > SAVE.best[m]) { SAVE.best[m] = G.score; isPB = G.score > 0; } }
  persist();
  const S = G.stats, pps = sec > 0 ? (G.pieces / sec).toFixed(2) : "0.00";
  K.sfx(G.won || isPB ? "win" : "lose");
  K.playSong("menu", 3);
  K.ui.show(`<div class="k-sub">${md.name}${G.won ? "" : m === "marathon" || m === "ultra" ? "" : " · not finished"}</div>
    <div class="big">${main}</div>${isPB ? `<div class="pb">New personal best!</div>` : `<div class="k-sub">${bestText(m)}</div>`}
    <div class="k-stats">
      <div class="k-stat"><small>Lines</small><b>${G.lines}</b></div><div class="k-stat"><small>Pieces</small><b>${G.pieces}</b></div>
      <div class="k-stat"><small>Per second</small><b>${pps}</b></div><div class="k-stat"><small>Time</small><b>${K.fmtTime(sec)}</b></div>
      <div class="k-stat"><small>Quads</small><b>${S.quad}</b></div><div class="k-stat"><small>T-spins</small><b>${S.tspin}</b></div>
      <div class="k-stat"><small>Best combo</small><b>${Math.max(0, S.maxCombo)}</b></div><div class="k-stat"><small>Perfect clears</small><b>${S.pc}</b></div>
    </div>
    <div class="k-row"><button class="k-btn primary" data-a="retry" autofocus>Play again <span class="k-kbonly" style="opacity:.6">(R)</span></button>${m === "daily" && G.won ? `<button class="k-btn" data-a="share">Copy result</button>` : ""}<button class="k-btn" data-a="modes">Modes</button></div>
    <div class="k-msg" id="msg"></div>`, { back: "modes" });
}
function settings(from) {
  const backTo = from === "pause" ? "pause" : "modes";
  const row = (id, label, min, max, stepv, val, fmt) => `<label class="k-opt"><span>${label} <b id="v-${id}" style="color:var(--gold)">${fmt(val)}</b></span><input type="range" min="${min}" max="${max}" step="${stepv}" value="${val}" data-h="${id}"></label>`;
  const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${backTo}">Back</button></div>
    <div class="k-panel" style="width:min(100%,32em);display:flex;flex-direction:column;align-items:center">
      ${row("das", "Auto-shift delay", 50, 300, 1, SAVE.das, (v) => v + " ms")}
      ${row("arr", "Auto-shift speed", 0, 100, 1, SAVE.arr, (v) => (v == 0 ? "instant" : v + " ms"))}
      ${row("sdf", "Soft drop speed", 5, 41, 1, SAVE.sdf, (v) => (v >= 41 ? "instant" : v + "×"))}
      <div class="k-opt"><span>Ghost piece</span><button class="k-btn small" data-a="tog" data-k="ghost">${SAVE.ghost ? "On" : "Off"}</button></div>
      <div class="k-opt"><span>Grid</span><button class="k-btn small" data-a="tog" data-k="grid">${SAVE.grid ? "On" : "Off"}</button></div>
      <div class="k-opt"><span>Screen shake</span><button class="k-btn small" data-a="tog" data-k="shake">${SAVE.shake ? "On" : "Off"}</button></div>
      ${K.ui.settingsRows()}
    </div>
    <div class="k-panel k-kbonly" style="width:min(100%,32em)"><b>Keys</b><p class="k-sub" style="font-size:.9em">Click a key, then press the new one. Each action can have two keys.</p>
      <div class="keys">${Object.keys(ACTION_NAMES).map((a) => `<span>${ACTION_NAMES[a]}</span><span class="k-row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="k-btn small" data-a="bind" data-act="${a}" data-slot="0">${keyName(SAVE.keys[a][0])}</button><button class="k-btn small" data-a="bind" data-act="${a}" data-slot="1">${keyName(SAVE.keys[a][1])}</button></span>`).join("")}</div>
      <div class="k-row" style="margin-top:.6em"><button class="k-btn small" data-a="resetkeys">Reset keys</button></div></div>`, { back: backTo, cls: "top" });
  K.ui.bindSettings(s);
  for (const r of $$("[data-h]", s)) r.addEventListener("input", () => { SAVE[r.dataset.h] = +r.value; const f = r.dataset.h === "das" ? (v) => v + " ms" : r.dataset.h === "arr" ? (v) => (v == 0 ? "instant" : v + " ms") : (v) => (v >= 41 ? "instant" : v + "×"); $("#v-" + r.dataset.h).textContent = f(+r.value); persist(); });
}
function keyName(code) { if (!code) return "—"; return code.replace(/^Key/, "").replace(/^Digit/, "").replace("Arrow", "").replace("Left", " L").replace("Right", " R").replace("Control", "Ctrl").replace("Escape", "Esc"); }
function finishRebind(code) {
  const { act, slot, el } = rebinding; rebinding = null;
  if (code !== "Escape") { for (const a in SAVE.keys) SAVE.keys[a] = SAVE.keys[a].map((c) => (c === code ? "" : c)); SAVE.keys[act][slot] = code; persist(); K.sfx("ok"); }
  settings(K.ui.back === "pause" ? "pause" : "modes");
}
function help() {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="modes" autofocus>Back</button></div>
    <div class="k-help">
      <div><b>Goal</b>Fill rows from wall to wall to clear them. Don't let the stack reach the top.</div>
      <div><b>Moves</b>Move, rotate both ways (and 180°), soft drop, hard drop, and hold one piece for later.</div>
      <div><b>T-spins</b>Twist a T piece into a tight slot as your last move for big points.</div>
      <div><b>Back-to-back</b>Quads and T-spin clears in a row earn 50% extra. Clearing rows with consecutive pieces builds a combo.</div>
      <div class="k-kbonly"><b>Keyboard</b>← → move · ↓ soft drop · Space hard drop · ↑/X rotate right · Z rotate left · A 180° · C/Shift hold · R restart · Esc pause</div>
      <div><b>Controller</b>D-pad move · Down soft drop · Up hard drop · A/B rotate · Y 180° · X/LB/RB hold · Start pause · Back restart</div>
      <div class="k-touchonly"><b>Touch</b>Drag to move, drag down to soft drop, flick down to hard drop, flick up to hold, tap to rotate (left third rotates left). Buttons below too.</div>
    </div>`, { back: "modes", cls: "top" });
}
function statsScreen() {
  const s = SAVE.stats;
  K.ui.show(`<div class="k-bar"><h2>Stats</h2><button class="k-btn" data-a="modes" autofocus>Back</button></div>
    <div class="k-stats"><div class="k-stat"><small>Games</small><b>${K.fmt(s.games)}</b></div><div class="k-stat"><small>Lines</small><b>${K.fmt(s.lines)}</b></div>
    <div class="k-stat"><small>Pieces</small><b>${K.fmt(s.pieces)}</b></div><div class="k-stat"><small>Quads</small><b>${K.fmt(s.quads)}</b></div>
    <div class="k-stat"><small>T-spins</small><b>${K.fmt(s.tspins)}</b></div><div class="k-stat"><small>Perfect clears</small><b>${K.fmt(s.pcs)}</b></div>
    <div class="k-stat"><small>Time played</small><b>${K.fmtTime(s.time)}</b></div></div>
    <div class="k-list">${["marathon", "sprint", "ultra", "dig", "zen"].map((m) => `<div class="k-li"><div class="tx"><b>${MODES[m].name}</b><span>${MODES[m].desc}</span></div><b class="pb">${bestText(m).replace("No record yet", "—")}</b></div>`).join("")}</div>`, { back: "modes", cls: "top" });
}
K.ui.on((a, d, el) => {
  switch (a) {
    case "start": K.sfx("ok"); return start(d.m);
    case "modes": K.sfx("back"); return title();
    case "resume": K.ui.hide(); K.sfx("ok"); showTouch(true); return;
    case "restart": case "retry": K.sfx("ok"); return G ? start(G.mode) : title();
    case "settings": K.sfx("ok"); return settings(d.from || (G && !G.over ? "pause" : "modes"));
    case "pause": return pause();
    case "help": K.sfx("ok"); return help();
    case "stats": K.sfx("ok"); return statsScreen();
    case "tog": SAVE[d.k] = !SAVE[d.k]; persist(); el.textContent = SAVE[d.k] ? "On" : "Off"; K.sfx("ok"); return;
    case "bind": rebinding = { act: d.act, slot: +d.slot, el }; el.textContent = "Press a key…"; el.classList.add("wait"); return;
    case "resetkeys": for (const k in DEFAULT_KEYS) SAVE.keys[k] = DEFAULT_KEYS[k].slice(); persist(); K.sfx("ok"); return settings(K.ui.back === "pause" ? "pause" : "modes");
    case "share": K.copy(`STACKFALL · Daily Sprint ${K.today()}\n40 lines in ${K.fmtMs(SAVE.daily.best)}`).then((ok) => { const m = $("#msg"); if (m) m.textContent = ok ? "Copied to clipboard." : "Couldn't copy."; }); return;
  }
});
addEventListener("keydown", (e) => {
  if (!K.ui.active() || e.code !== "KeyR" || rebinding || !G || e.repeat) return;
  const s = $(".k-screen"); if (s && s.querySelector('[data-a="retry"], [data-a="restart"]')) { e.preventDefault(); start(G.mode); }
});

/* ================= boot ================= */
layout();
title();
K.loop((dt) => {
  pollPadGame();
  if (G && !K.ui.active()) step(dt);
  else if (G && G.over) G.endT += dt;
  if (G && G.started && !G.over) musicForGame();
  render(dt);
});
