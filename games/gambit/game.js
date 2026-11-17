"use strict";
/* GAMBIT — chess against the built-in engine, or two players on one device. */
const { $, $$, clamp } = K;
const { Pos, mFrom, mTo, mPromo, mFlag, F_CAP, F_EP, F_CASTLE, WHITE, BLACK } = CHESS;
const CLOCKS = [null, { name: "10 min", base: 600, inc: 0 }, { name: "5 min", base: 300, inc: 0 }, { name: "3 | 2", base: 180, inc: 2 }];
const LEVEL_ELO = [400, 700, 1000, 1300, 1600, 1850, 2050, 2250];
const THEMES = [{ name: "Walnut", l: "#ecd6b0", d: "#ad7d55" }, { name: "Forest", l: "#eceed4", d: "#739552" }, { name: "Glacier", l: "#dfe6ea", d: "#7f97aa" }, { name: "Dusk", l: "#dcd3e8", d: "#7b6b9c" }];
const SAVE = K.load("gambit.v1", { opts: { theme: 0, legal: true, coords: true, autoQueen: false }, setup: { level: 2, color: "w", clock: 0, fen: "" }, two: { clock: 0, flip: true }, rating: 1200, rated: 0, stats: [], cur: null });
for (let i = 0; i < 8; i++) SAVE.stats[i] = K.merge({ w: 0, d: 0, l: 0 }, SAVE.stats[i]);
const persist = () => K.save("gambit.v1", SAVE);

/* ================= engine worker ================= */
let worker = null, wid = 0; const wq = new Map();
try { worker = new Worker("chess.js?v=1"); worker.onmessage = (e) => { const cb = wq.get(e.data.id); if (cb) { wq.delete(e.data.id); cb(e.data); } }; worker.onerror = () => { worker = null; for (const cb of wq.values()) cb(null); wq.clear(); }; } catch { worker = null; }
function ask(msg) {
  return new Promise((res) => {
    if (worker) { const id = ++wid; wq.set(id, res); worker.postMessage({ ...msg, id }); return; }
    setTimeout(() => { // fallback on the main thread
      const pos = new Pos(msg.start), played = []; for (const u of msg.moves) { const m = pos.fromUci(u); if (!m) break; pos.make(m); played.push(u); }
      const r = msg.cmd === "hint" ? CHESS.search(pos, { time: Math.min(600, msg.time || 600) }) : CHESS.think(pos, msg.level, played, Math.min(700, msg.maxTime || 700));
      res({ move: r.move ? pos.uci(r.move) : null, score: r.score });
    }, 30);
  });
}

/* ================= game state ================= */
let G = null, thinkSeq = 0;
function newGame(cfg) {
  const start = cfg.fen || CHESS.START; let pos;
  try { pos = new Pos(start); } catch (e) { K.toast("That position can't be used", e.message); return false; }
  if (pos.status().over) { K.toast("That position is already over"); return false; }
  const you = cfg.mode === "cpu" ? (cfg.color === "r" ? (Math.random() < 0.5 ? WHITE : BLACK) : cfg.color === "b" ? BLACK : WHITE) : WHITE;
  const ck = CLOCKS[cfg.clock || 0];
  G = { mode: cfg.mode, level: cfg.level || 0, you, clock: cfg.clock || 0, start, pos, hist: [], startB: Int8Array.from(pos.b), view: 0, over: null, time: ck ? [ck.base, ck.base] : null,
    takebacks: 0, hints: 0, flipped: cfg.mode === "cpu" ? you === BLACK : pos.side === BLACK && cfg.flip, flipTwo: !!cfg.flip, thinking: false, lastEval: 0 };
  thinkSeq++; SEL = -1; PROMO = null; ARROWS = []; HINTA = null; ANIM = null;
  K.ui.hide(); $("#game").hidden = false; layoutGame(); renderMoves(); cards(); status();
  K.sfx("start"); K.playSong("calm", 0); saveCur();
  if (G.mode === "cpu" && G.pos.side !== G.you) engineMove();
  return true;
}
function resume() {
  const c = SAVE.cur; if (!c) return false;
  if (!newGameSilent(c)) { SAVE.cur = null; persist(); return false; }
  for (const u of c.moves) { const m = G.pos.fromUci(u); if (!m) break; recordMove(m); }
  G.view = G.hist.length; G.time = c.time; G.takebacks = c.takebacks || 0; G.hints = c.hints || 0; G.flipped = !!c.flipped;
  renderMoves(); cards(); status();
  if (G.mode === "cpu" && G.pos.side !== G.you) engineMove();
  return true;
}
function newGameSilent(c) {
  let pos; try { pos = new Pos(c.start); } catch { return false; }
  const ck = CLOCKS[c.clock || 0];
  G = { mode: c.mode, level: c.level || 0, you: c.you, clock: c.clock || 0, start: c.start, pos, hist: [], startB: Int8Array.from(pos.b), view: 0, over: null, time: ck ? [ck.base, ck.base] : null, takebacks: 0, hints: 0, flipped: false, flipTwo: !!c.flipTwo, thinking: false, lastEval: 0 };
  thinkSeq++; SEL = -1; PROMO = null; ARROWS = []; HINTA = null; ANIM = null;
  K.ui.hide(); $("#game").hidden = false; layoutGame(); K.playSong("calm", 0);
  return true;
}
function saveCur() {
  if (!G || G.over) { SAVE.cur = null; persist(); return; }
  SAVE.cur = { mode: G.mode, level: G.level, you: G.you, clock: G.clock, start: G.start, moves: G.hist.map((h) => h.uci), time: G.time ? G.time.map((t) => Math.round(t * 10) / 10) : null, takebacks: G.takebacks, hints: G.hints, flipped: G.flipped, flipTwo: G.flipTwo };
  persist();
}
/* apply a move to the live position and record it (no sounds or side effects) */
function recordMove(m) {
  const pos = G.pos, legal = pos.legal(), san = pos.san(m, legal), uci = pos.uci(m), mover = pos.side, before = Int8Array.from(pos.b);
  pos.make(m);
  G.hist.push({ uci, san, m, mover, b: Int8Array.from(pos.b), before, check: san.endsWith("+") || san.endsWith("#") });
}
function playMove(m, o = {}) {
  if (!G || G.over) return;
  const mover = G.pos.side;
  recordMove(m); const h = G.hist[G.hist.length - 1];
  G.view = G.hist.length; SEL = -1; ARROWS = []; HINTA = null; PROMO = null;
  ANIM = o.dragged ? null : { from: mFrom(m), to: mTo(m), m, t: 0, dur: 0.17, before: h.before, ply: G.hist.length };
  if (G.time && G.hist.length > 1) G.time[mover >> 3] += CLOCKS[G.clock].inc;
  if (h.san.includes("#")) K.sfx("check"); else if (h.check) K.sfx("check"); else if (mFlag(m) & F_CASTLE) K.sfx("castle"); else if (mPromo(m)) K.sfx("promote"); else if (mFlag(m) & F_CAP) K.sfx("capture"); else K.sfx("move");
  if (G.mode === "two" && G.flipTwo) setTimeout(() => { if (G && !G.over && G.view === G.hist.length) G.flipped = G.pos.side === BLACK; }, 380);
  const st = G.pos.status();
  renderMoves(); cards();
  if (st.over) { endGame(st.result, st.why); return; }
  status(); saveCur();
  if (G.mode === "cpu" && G.pos.side !== G.you) engineMove();
}
function engineMove() {
  if (!G || G.over) return;
  const id = ++thinkSeq, t0 = Date.now(), lvl = G.level;
  G.thinking = true; status(); cards();
  const maxTime = G.time ? Math.max(0.15, G.time[G.pos.side >> 3] / 30) * 1000 : 0;
  ask({ cmd: "go", start: G.start, moves: G.hist.map((h) => h.uci), level: lvl, maxTime }).then((r) => {
    if (!G || id !== thinkSeq || G.over) return;
    const wait = Math.max(0, (lvl < 4 ? 420 + Math.random() * 650 : 220) - (Date.now() - t0));
    setTimeout(() => {
      if (!G || id !== thinkSeq || G.over) return;
      G.thinking = false; const m = r && r.move ? G.pos.fromUci(r.move) : G.pos.legal()[0];
      if (r && typeof r.score === "number" && !r.book) G.lastEval = r.score;
      if (G.view !== G.hist.length) G.view = G.hist.length;
      playMove(m);
    }, wait);
  });
}
function endGame(result, why) {
  G.over = { result, why }; G.thinking = false; thinkSeq++; SEL = -1; PROMO = null;
  let outcome = "draw";
  if (result !== "1/2-1/2") { const winner = result === "1-0" ? WHITE : BLACK; outcome = G.mode === "cpu" ? (winner === G.you ? "win" : "loss") : winner === WHITE ? "white" : "black"; }
  G.outcome = outcome; G.rated = G.mode === "cpu" && !G.takebacks && !G.hints && G.start === CHESS.START && G.hist.length >= 2;
  if (G.mode === "cpu") {
    const st = SAVE.stats[G.level]; if (outcome === "win") st.w++; else if (outcome === "loss") st.l++; else st.d++;
    if (G.rated) { const E = 1 / (1 + Math.pow(10, (LEVEL_ELO[G.level] - SAVE.rating) / 400)), S = outcome === "win" ? 1 : outcome === "loss" ? 0 : 0.5, d = Math.round(32 * (S - E)); SAVE.rating = Math.max(100, SAVE.rating + d); SAVE.rated++; G.ratingDelta = d; }
  }
  SAVE.cur = null; persist(); renderMoves(); cards(); status();
  K.sfx(outcome === "win" || outcome === "white" || outcome === "black" ? "win" : outcome === "loss" ? "lose" : "drawn");
  const g = G; setTimeout(() => { if (G === g && !K.ui.active()) results(); }, 900);
}
function takeback() {
  if (!G || G.over) { K.sfx("deny"); return; }
  let n = G.mode === "two" ? 1 : G.thinking ? 1 : 2;
  if (G.mode === "cpu" && !G.thinking && G.pos.side !== G.you) n = 1;
  if (G.mode === "cpu") { // never take back past the engine's opening move when you play black
    while (n > 0 && G.hist.length - n < 0) n--;
    if (G.hist.length - n === 0 && G.you === BLACK && G.pos.side !== WHITE) n = Math.max(0, n - 1);
  }
  if (!n || G.hist.length < n) { K.sfx("deny"); return; }
  thinkSeq++; G.thinking = false;
  for (let i = 0; i < n; i++) { G.pos.unmake(); G.hist.pop(); }
  G.takebacks++; G.view = G.hist.length; SEL = -1; ANIM = null; PROMO = null; HINTA = null; ARROWS = [];
  if (G.mode === "two" && G.flipTwo) G.flipped = G.pos.side === BLACK;
  K.sfx("undo"); renderMoves(); cards(); status(); saveCur();
  if (G.mode === "cpu" && G.pos.side !== G.you) engineMove();
}
async function hint() {
  if (!G || G.over || G.thinking || !humanTurn()) { K.sfx("deny"); return; }
  const id = thinkSeq; $("#hintBtn").disabled = true;
  const r = await ask({ cmd: "hint", start: G.start, moves: G.hist.map((h) => h.uci), time: 1000 });
  $("#hintBtn").disabled = false;
  if (!G || id !== thinkSeq || !r || !r.move) return;
  const m = G.pos.fromUci(r.move); if (!m) return;
  G.hints++; HINTA = { from: mFrom(m), to: mTo(m), t: 0 }; K.sfx("hint"); saveCur();
}
const humanTurn = () => G && !G.over && (G.mode === "two" || G.pos.side === G.you);

/* ================= layout ================= */
const BC = $("#board"), bx = BC.getContext("2d");
const BL = { size: 400, sq: 50, dpr: 1 };
function layoutGame() {
  const W = innerWidth, H = innerHeight, portrait = W / H < 1.25;
  let size = portrait ? Math.min(W - 20, H - 2 * 46 - 170) : Math.min(H - 2 * 46 - 36, W - 320 - 60);
  size = Math.max(232, Math.floor(size / 8) * 8);
  BL.size = size; BL.sq = size / 8; BL.dpr = K.fit(BC, size, size).dpr;
  $("#side").style.height = portrait ? "" : size + 2 * 46 + 16 + "px";
  $("#boardCol").style.width = size + "px";
}
addEventListener("resize", () => { if (G) layoutGame(); });
const sqXY = (sq) => { const f = sq & 7, r = sq >> 4, c = G.flipped ? 7 - f : f, rr = G.flipped ? 7 - r : r; return [c * BL.sq, rr * BL.sq]; };
function sqAt(x, y) { const c = Math.floor(x / BL.sq), r = Math.floor(y / BL.sq); if (c < 0 || r < 0 || c > 7 || r > 7) return -1; const f = G.flipped ? 7 - c : c, rr = G.flipped ? 7 - r : r; return rr * 16 + f; }
const viewBoard = () => (G.view === 0 ? G.startB : G.hist[G.view - 1].b);
const live = () => G.view === G.hist.length;

/* ================= drawing ================= */
let SEL = -1, PROMO = null, ARROWS = [], HINTA = null, ANIM = null, DRAG = null, RDRAG = null;
const CURS = { on: false, sq: 116 };
function legalFrom(sq) { if (!live() || !humanTurn()) return []; return G.pos.legal().filter((m) => mFrom(m) === sq); }
function arrow(from, to, color, w) {
  const s = BL.sq, [x0, y0] = sqXY(from), [x1, y1] = sqXY(to), ax = x0 + s / 2, ay = y0 + s / 2, bxx = x1 + s / 2, byy = y1 + s / 2, a = Math.atan2(byy - ay, bxx - ax), len = Math.hypot(bxx - ax, byy - ay) - s * 0.3, hw = s * w;
  bx.save(); bx.translate(ax, ay); bx.rotate(a); bx.fillStyle = color; bx.beginPath(); bx.moveTo(s * 0.12, -hw / 2); bx.lineTo(len - s * 0.32, -hw / 2); bx.lineTo(len - s * 0.32, -hw * 1.6); bx.lineTo(len + s * 0.05, 0); bx.lineTo(len - s * 0.32, hw * 1.6); bx.lineTo(len - s * 0.32, hw / 2); bx.lineTo(s * 0.12, hw / 2); bx.closePath(); bx.fill(); bx.restore();
}
function drawPiece(p, x, y, size) { if (!p) return; bx.drawImage(PIECES.sprite(p & 7, !!(p & BLACK), Math.round(size), BL.dpr), x, y, size, size); }
function render(dt) {
  if (!G) return;
  const s = BL.sq, th = THEMES[SAVE.opts.theme] || THEMES[0], board = viewBoard();
  bx.setTransform(BL.dpr, 0, 0, BL.dpr, 0, 0);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { bx.fillStyle = (r + c) % 2 ? th.d : th.l; bx.fillRect(c * s, r * s, s + 0.5, s + 0.5); }
  const lastH = G.view > 0 ? G.hist[G.view - 1] : null;
  const tint = (sq, col) => { const [x, y] = sqXY(sq); bx.fillStyle = col; bx.fillRect(x, y, s, s); };
  if (lastH) { tint(mFrom(lastH.m), "rgba(255,213,74,0.38)"); tint(mTo(lastH.m), "rgba(255,213,74,0.48)"); }
  if (SEL >= 0) tint(SEL, "rgba(90,170,255,0.42)");
  if (HINTA && live()) { tint(HINTA.from, "rgba(80,160,255,0.3)"); tint(HINTA.to, "rgba(80,160,255,0.38)"); }
  // check glow
  const inCheck = live() ? !G.over || G.over.why === "checkmate" ? G.pos.inCheck() : false : lastH ? lastH.check : false;
  if (inCheck) { const side = lastH ? lastH.mover ^ BLACK : G.pos.side; let ks = -1; for (let i = 0; i < 128; i++) if (!(i & 0x88) && board[i] === (6 | side)) ks = i; if (ks >= 0) { const [x, y] = sqXY(ks), g = bx.createRadialGradient(x + s / 2, y + s / 2, 0, x + s / 2, y + s / 2, s * 0.62); g.addColorStop(0, "rgba(255,40,40,0.95)"); g.addColorStop(0.45, "rgba(230,30,30,0.55)"); g.addColorStop(1, "rgba(200,0,0,0)"); bx.fillStyle = g; bx.fillRect(x, y, s, s); } }
  // user circles
  for (const a of ARROWS) if (a.from === a.to) { const [x, y] = sqXY(a.from); bx.strokeStyle = "rgba(235,130,40,0.85)"; bx.lineWidth = s * 0.07; bx.beginPath(); bx.arc(x + s / 2, y + s / 2, s * 0.44, 0, Math.PI * 2); bx.stroke(); }
  // coordinates
  if (SAVE.opts.coords) {
    bx.font = `700 ${Math.max(9, s * 0.17)}px Inter, sans-serif`;
    for (let i = 0; i < 8; i++) {
      const fileCh = "abcdefgh"[G.flipped ? 7 - i : i], rankCh = String(G.flipped ? i + 1 : 8 - i);
      bx.fillStyle = (7 + i) % 2 ? th.l : th.d; bx.textAlign = "right"; bx.textBaseline = "bottom"; bx.fillText(fileCh, i * s + s - 3, 8 * s - 2);
      bx.fillStyle = i % 2 ? th.l : th.d; bx.textAlign = "left"; bx.textBaseline = "top"; bx.fillText(rankCh, 3, i * s + 3);
    }
  }
  // pieces
  let animP = null;
  if (ANIM && ANIM.ply !== G.view) ANIM = null;
  if (ANIM) { ANIM.t += dt; if (ANIM.t >= ANIM.dur) ANIM = null; }
  const hideTo = new Set();
  if (ANIM) {
    const m = ANIM.m, k = K.ease.outCubic(Math.min(1, ANIM.t / ANIM.dur)); hideTo.add(ANIM.to);
    animP = [{ p: ANIM.before[ANIM.from], from: ANIM.from, to: ANIM.to, promo: mPromo(m) }];
    if (mFlag(m) & F_CASTLE) { const rf = ANIM.to > ANIM.from ? ANIM.to + 1 : ANIM.to - 2, rt = ANIM.to > ANIM.from ? ANIM.to - 1 : ANIM.to + 1; hideTo.add(rt); animP.push({ p: ANIM.before[rf], from: rf, to: rt }); }
    animP.k = k;
    // captured piece fades at its square
    const capSq = mFlag(m) & F_EP ? ANIM.to + (ANIM.before[ANIM.from] & BLACK ? -16 : 16) : ANIM.to, cp = mFlag(m) & F_CAP ? ANIM.before[capSq] : 0;
    if (cp) { const [x, y] = sqXY(capSq); bx.globalAlpha = 1 - k; drawPiece(cp, x, y, s); bx.globalAlpha = 1; }
  }
  for (let i = 0; i < 128; i++) {
    if (i & 0x88) { i += 7; continue; }
    const p = board[i]; if (!p || hideTo.has(i)) continue;
    const [x, y] = sqXY(i);
    if (DRAG && DRAG.on && DRAG.sq === i) { bx.globalAlpha = 0.3; drawPiece(p, x, y, s); bx.globalAlpha = 1; continue; }
    drawPiece(p, x, y, s);
  }
  if (animP) for (const a of animP) { const [x0, y0] = sqXY(a.from), [x1, y1] = sqXY(a.to), p = a.promo && animP.k > 0.6 ? a.promo | (a.p & BLACK) : a.p; drawPiece(p, x0 + (x1 - x0) * animP.k, y0 + (y1 - y0) * animP.k, s); }
  // legal targets
  if (SEL >= 0 && SAVE.opts.legal) for (const m of legalFrom(SEL)) {
    const t = mTo(m), [x, y] = sqXY(t);
    if (board[t] || mFlag(m) & F_EP) { bx.strokeStyle = "rgba(20,30,40,0.32)"; bx.lineWidth = s * 0.08; bx.beginPath(); bx.arc(x + s / 2, y + s / 2, s * 0.44, 0, Math.PI * 2); bx.stroke(); }
    else { bx.fillStyle = "rgba(20,30,40,0.24)"; bx.beginPath(); bx.arc(x + s / 2, y + s / 2, s * 0.15, 0, Math.PI * 2); bx.fill(); }
  }
  // arrows
  for (const a of ARROWS) if (a.from !== a.to) arrow(a.from, a.to, "rgba(235,130,40,0.78)", 0.17);
  if (RDRAG && RDRAG.to >= 0 && RDRAG.to !== RDRAG.from) arrow(RDRAG.from, RDRAG.to, "rgba(235,130,40,0.5)", 0.17);
  if (HINTA && live()) { HINTA.t += dt; arrow(HINTA.from, HINTA.to, `rgba(80,160,255,${0.62 + Math.sin(HINTA.t * 5) * 0.18})`, 0.2); }
  // keyboard cursor
  if (CURS.on && (K.device === "kb" || K.device === "pad") && !G.over) { const [x, y] = sqXY(CURS.sq); bx.strokeStyle = "#ffd77a"; bx.lineWidth = Math.max(3, s * 0.06); bx.strokeRect(x + 2, y + 2, s - 4, s - 4); }
  // dragged piece
  if (DRAG && DRAG.on) { const p = board[DRAG.sq]; drawPiece(p, DRAG.x - s * 0.56, DRAG.y - s * 0.62, s * 1.12); }
  // promotion picker
  if (PROMO) {
    bx.fillStyle = "rgba(0,0,0,0.55)"; bx.fillRect(0, 0, 8 * s, 8 * s);
    const side = G.pos.side, [x0, y0] = sqXY(PROMO.to), dir = y0 < s * 4 ? 1 : -1;
    [5, 2, 4, 3].forEach((t, k) => { const y = y0 + dir * k * s; bx.fillStyle = k === PROMO.k ? "#ffe8a8" : "#f4efe4"; bx.beginPath(); bx.arc(x0 + s / 2, y + s / 2, s * 0.48, 0, Math.PI * 2); bx.fill(); drawPiece(t | side, x0 + s * 0.06, y + s * 0.06, s * 0.88); });
  }
}

/* ================= input ================= */
function boardXY(e) { const r = BC.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function promoPick(x, y) { const [x0, y0] = sqXY(PROMO.to), dir = y0 < BL.sq * 4 ? 1 : -1; if (x < x0 || x > x0 + BL.sq) return -1; const k = Math.floor(((y - y0) * dir) / BL.sq + (dir < 0 ? 1 : 0)); return k >= 0 && k < 4 ? k : -1; }
function finishPromo(k) { const t = [5, 2, 4, 3][k], m = PROMO.moves.find((mm) => mPromo(mm) === t); PROMO = null; if (m) playMove(m, { dragged: PROMO_DRAGGED }); }
let PROMO_DRAGGED = false;
function tryMove(from, to, dragged) {
  const ms = legalFrom(from).filter((m) => mTo(m) === to);
  if (!ms.length) return false;
  if (ms.length > 1) { if (SAVE.opts.autoQueen) { playMove(ms.find((m) => mPromo(m) === 5) || ms[0], { dragged }); return true; } PROMO = { to, moves: ms, k: 0 }; PROMO_DRAGGED = dragged; SEL = -1; K.sfx("pick"); return true; }
  playMove(ms[0], { dragged }); return true;
}
BC.addEventListener("contextmenu", (e) => e.preventDefault());
BC.addEventListener("pointerdown", (e) => {
  if (!G || K.ui.active()) return; K.audio(); CURS.on = false;
  const [x, y] = boardXY(e), sq = sqAt(x, y);
  if (e.button === 2) { if (sq >= 0) RDRAG = { from: sq, to: sq }; return; }
  if (PROMO) { const k = promoPick(x, y); if (k >= 0) finishPromo(k); else { PROMO = null; K.sfx("back"); } return; }
  ARROWS = [];
  if (!live()) { G.view = G.hist.length; renderMoves(); status(); return; }
  if (sq < 0 || !humanTurn() || G.thinking) return;
  const p = G.pos.b[sq];
  if (SEL >= 0 && SEL !== sq && tryMove(SEL, sq, false)) return;
  if (p && (p & BLACK) === G.pos.side) { if (SEL !== sq) K.sfx("pick"); DRAG = { sq, x, y, x0: x, y0: y, on: false, id: e.pointerId, was: SEL === sq }; SEL = sq; try { BC.setPointerCapture(e.pointerId); } catch {} }
  else { if (SEL >= 0 && sq !== SEL) K.sfx("deny"); SEL = -1; }
});
BC.addEventListener("pointermove", (e) => {
  const [x, y] = boardXY(e);
  if (RDRAG) { RDRAG.to = sqAt(x, y); return; }
  if (!DRAG || e.pointerId !== DRAG.id) return;
  if (!DRAG.on && Math.hypot(x - DRAG.x0, y - DRAG.y0) > 5) DRAG.on = true;
  DRAG.x = x; DRAG.y = y;
});
BC.addEventListener("pointerup", (e) => {
  const [x, y] = boardXY(e);
  if (RDRAG) { const to = sqAt(x, y), a = RDRAG; RDRAG = null; if (to < 0) return; const i = ARROWS.findIndex((q) => q.from === a.from && q.to === to); if (i >= 0) ARROWS.splice(i, 1); else ARROWS.push({ from: a.from, to }); return; }
  if (!DRAG || e.pointerId !== DRAG.id) return;
  const d = DRAG; DRAG = null;
  if (d.on) { const to = sqAt(x, y); if (to >= 0 && to !== d.sq && tryMove(d.sq, to, true)) return; if (to !== d.sq && to >= 0) K.sfx("deny"); }
  else if (d.was) SEL = -1;
});
BC.addEventListener("pointercancel", () => { DRAG = null; RDRAG = null; });
function curMove(dx, dy) { if (!G) return; if (!CURS.on) { CURS.on = true; const k = G.pos.kings[(G.mode === "cpu" ? G.you : G.pos.side) >> 3]; CURS.sq = SEL >= 0 ? SEL : k; return; } const f = (CURS.sq & 7) + (G.flipped ? -dx : dx), r = (CURS.sq >> 4) + (G.flipped ? -dy : dy); if (f < 0 || f > 7 || r < 0 || r > 7) return; CURS.sq = r * 16 + f; K.sfx("move"); }
function curAct() {
  if (!G || G.over) return;
  if (PROMO) { finishPromo(PROMO.k); return; }
  if (!CURS.on) { curMove(0, 0); return; }
  if (!live()) { G.view = G.hist.length; renderMoves(); status(); return; }
  if (!humanTurn() || G.thinking) return K.sfx("deny");
  const sq = CURS.sq, p = G.pos.b[sq];
  if (SEL >= 0 && SEL !== sq && tryMove(SEL, sq, false)) return;
  if (p && (p & BLACK) === G.pos.side) { SEL = SEL === sq ? -1 : sq; K.sfx(SEL >= 0 ? "pick" : "back"); } else { K.sfx("deny"); SEL = -1; }
}
function nav(where) {
  if (!G) return; const n = G.hist.length, old = G.view;
  G.view = where === "first" ? 0 : where === "last" ? n : where === "prev" ? Math.max(0, G.view - 1) : Math.min(n, G.view + 1);
  if (G.view === old) return;
  SEL = -1; PROMO = null;
  ANIM = G.view === old + 1 ? { from: mFrom(G.hist[old].m), to: mTo(G.hist[old].m), m: G.hist[old].m, t: 0, dur: 0.17, before: G.hist[old].before, ply: G.view } : null;
  K.sfx("move"); renderMoves(); status();
}
addEventListener("keydown", (e) => {
  if (!G || K.ui.active() || $("#game").hidden) return;
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); return takeback(); }
  if (PROMO) { const k = { KeyQ: 0, KeyN: 1, KeyR: 2, KeyB: 3 }[e.code]; if (k !== undefined) return finishPromo(k); if (e.code === "ArrowUp" || e.code === "ArrowDown") { PROMO.k = (PROMO.k + (e.code === "ArrowDown" ? 1 : 3)) % 4; e.preventDefault(); return; } if (e.code === "Escape") { PROMO = null; return; } }
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.code];
  if (dir) { e.preventDefault(); if (G.over) { if (dir[0]) nav(dir[0] < 0 ? "prev" : "next"); return; } curMove(dir[0], dir[1]); return; }
  if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); curAct(); }
  else if (e.code === "Home") nav("first"); else if (e.code === "End") nav("last");
  else if (e.code === "BracketLeft" || e.code === "Comma") nav("prev"); else if (e.code === "BracketRight" || e.code === "Period") nav("next");
  else if (e.code === "KeyH") hint(); else if (e.code === "KeyF") flip();
  else if (e.code === "Escape") { if (SEL >= 0) { SEL = -1; K.sfx("back"); } else menu(); }
});
function pollPad() {
  const P = K.pad; if (!P.connected || !G || K.ui.active() || $("#game").hidden) return; const pr = P.pressed;
  if (PROMO) { if (pr.du || pr.dd) PROMO.k = (PROMO.k + (pr.dd ? 1 : 3)) % 4; if (pr.a) finishPromo(PROMO.k); if (pr.b) PROMO = null; return; }
  if (pr.du) curMove(0, -1); if (pr.dd) curMove(0, 1); if (pr.dl) curMove(-1, 0); if (pr.dr) curMove(1, 0);
  if (pr.a) curAct(); if (pr.b) { SEL = -1; } if (pr.y) hint(); if (pr.x) flip(); if (pr.lb) takeback(); if (pr.lt) nav("prev"); if (pr.rt) nav("next"); if (pr.start) menu();
}
function flip() { if (!G) return; G.flipped = !G.flipped; K.sfx("click"); cards(); saveCur(); }

/* ================= side panel ================= */
function renderMoves() {
  const el = $("#moves"); if (!G) return;
  if (!G.hist.length) { el.innerHTML = `<div class="empty">${G.start === CHESS.START ? "No moves yet." : "Custom position."}</div>`; return; }
  const blackFirst = G.hist[0].mover === BLACK; let html = "", num = new Pos(G.start).full;
  let i = 0;
  if (blackFirst) { html += `<span class="n">${num}.</span><span></span>${btn(0)}`; i = 1; num++; }
  for (; i < G.hist.length; i += 2) html += `<span class="n">${num++}.</span>${btn(i)}${G.hist[i + 1] ? btn(i + 1) : "<span></span>"}`;
  if (G.over) html += `<div class="empty" style="grid-column:1/-1;color:var(--gold);font-weight:700">${G.over.result.replace("1/2", "½").replace("1/2", "½")}</div>`;
  el.innerHTML = html;
  const cur = el.querySelector(".cur"); if (cur) cur.scrollIntoView({ block: "nearest", inline: "nearest" }); else el.scrollTop = el.scrollHeight;
  function btn(k) { return `<button data-ply="${k + 1}" class="${G.view === k + 1 ? "cur" : ""}">${G.hist[k].san}</button>`; }
}
$("#moves").addEventListener("click", (e) => { const b = e.target.closest("[data-ply]"); if (!b || !G) return; G.view = +b.dataset.ply; SEL = -1; ANIM = null; renderMoves(); status(); K.sfx("move"); });
for (const b of $$("#nav [data-nav]")) b.onclick = () => nav(b.dataset.nav);
function material(board) {
  const cnt = [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]], base = [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]];
  for (let i = 0; i < 128; i++) { if (i & 0x88) continue; const p = board[i], q = G.startB[i]; if (p) cnt[p >> 3][p & 7]++; if (q) base[q >> 3][q & 7]++; }
  const val = [0, 1, 3, 3, 5, 9, 0]; let diff = 0; for (let t = 1; t <= 5; t++) diff += (cnt[0][t] - cnt[1][t]) * val[t];
  const caps = [[], []]; // pieces captured BY side
  for (const side of [0, 1]) for (const t of [5, 4, 3, 2, 1]) { const lost = Math.max(0, base[1 - side][t] - cnt[1 - side][t]); for (let k = 0; k < lost; k++) caps[side].push(t | ((1 - side) << 3)); }
  return { caps, diff };
}
function cards() {
  if (!G) return;
  const mat = material(viewBoard()), top = G.flipped ? WHITE : BLACK, bot = top ^ BLACK;
  const fill = (el, side) => {
    const isYou = G.mode === "cpu" && side === G.you, isCpu = G.mode === "cpu" && side !== G.you, lv = CHESS.LEVELS[G.level];
    const name = isCpu ? `GAMBIT <small>Level ${G.level + 1} · ${lv.name}</small>` : isYou ? `You <small>${G.over && G.rated ? SAVE.rating + " rating" : SAVE.rated ? SAVE.rating : ""}</small>` : side === WHITE ? "White" : "Black";
    const my = mat.caps[side >> 3], adv = side === WHITE ? mat.diff : -mat.diff;
    const turn = !G.over && live() && G.pos.side === side, t = G.time ? G.time[side >> 3] : null;
    el.innerHTML = `<div class="av"><canvas width="64" height="64" data-pc="${(isCpu ? 2 : 6) | side}"></canvas></div><div class="who"><div class="nm">${name}</div><div class="caps">${my.map((p) => `<canvas width="40" height="40" data-pc="${p}"></canvas>`).join("")}${adv > 0 ? `<b>+${adv}</b>` : ""}${isCpu && G.thinking ? `<span class="think" style="margin-left:.6em">thinking…</span>` : ""}</div></div>${t !== null ? `<div class="clock ${turn ? "on" : ""} ${t < 20 ? "low" : ""}" data-clock="${side >> 3}">${fmtClock(t)}</div>` : ""}`;
    for (const c of $$("canvas[data-pc]", el)) { const p = +c.dataset.pc; c.getContext("2d").drawImage(PIECES.sprite(p & 7, !!(p & BLACK), c.width, 1), 0, 0); }
  };
  fill($("#topCard"), top); fill($("#botCard"), bot);
}
const fmtClock = (t) => { t = Math.max(0, t); return t < 10 ? t.toFixed(1) : K.fmtTime(Math.ceil(t)); };
function status() {
  if (!G) return; const el = $("#status");
  let t, sub = "";
  if (G.over) { t = resultText().title; sub = resultText().sub; }
  else if (!live()) { t = `Reviewing move ${G.view} of ${G.hist.length}`; sub = "Click the board or press End to go back to the game."; }
  else if (G.thinking) t = "GAMBIT is thinking…";
  else if (G.mode === "cpu") { t = G.pos.side === G.you ? "Your move" : "…"; if (G.pos.inCheck()) t = "Check! " + t; }
  else { t = (G.pos.side === WHITE ? "White" : "Black") + " to move"; if (G.pos.inCheck()) t = "Check! " + t; }
  el.innerHTML = `${t}${sub ? `<small>${sub}</small>` : ""}`;
  $("#undoBtn").disabled = !!G.over; $("#hintBtn").disabled = !!G.over || G.thinking;
}
function resultText() {
  const o = G.over, why = { checkmate: "by checkmate", stalemate: "by stalemate", "50-move rule": "by the 50-move rule", "threefold repetition": "by repetition", "insufficient material": "by insufficient material", resign: "by resignation", time: "on time", agreement: "by agreement", "time vs insufficient material": "on time (not enough material to win)" }[o.why] || "";
  if (G.outcome === "draw") return { title: "Draw", sub: why };
  if (G.mode === "cpu") return G.outcome === "win" ? { title: "You win!", sub: why } : { title: "GAMBIT wins", sub: why };
  return { title: (G.outcome === "white" ? "White" : "Black") + " wins", sub: why };
}

/* ================= audio ================= */
K.defineSfx({
  move: (t) => { K.noise(t, 0.05, { filter: "bandpass", freq: 1700, q: 1.4, vol: 0.13 }); K.voice(330, t, 0.06, { type: "sine", vol: 0.05, slide: 0.65 }); },
  capture: (t) => { K.noise(t, 0.08, { filter: "lowpass", freq: 2600, vol: 0.17 }); K.voice(220, t, 0.09, { type: "sine", vol: 0.07, slide: 0.5 }); K.noise(t + 0.045, 0.04, { filter: "bandpass", freq: 1400, vol: 0.08 }); },
  castle: (t) => { K.SFX.move(t); K.SFX.move(t + 0.09); },
  check: (t) => { K.SFX.move(t); K.voice(988, t + 0.02, 0.16, { type: "triangle", vol: 0.05 }); K.voice(1480, t + 0.06, 0.18, { type: "triangle", vol: 0.035 }); },
  promote: (t) => { K.SFX.move(t); K.notes(t + 0.03, [784, 988, 1318], 0.06, { type: "triangle", vol: 0.045, len: 0.2 }); },
  pick: (t) => K.noise(t, 0.03, { filter: "highpass", freq: 3000, vol: 0.03 }),
  start: (t) => K.notes(t, [392, 523, 659], 0.08, { type: "triangle", vol: 0.04, len: 0.35 }),
  drawn: (t) => K.notes(t, [523, 494, 523], 0.14, { type: "triangle", vol: 0.05, len: 0.3 }),
  undo: (t) => K.voice(500, t, 0.09, { type: "sine", vol: 0.04, slide: 0.65 }),
  hint: (t) => K.notes(t, [880, 1175], 0.07, { type: "sine", vol: 0.045, len: 0.25 }),
  tick: (t) => K.voice(1500, t, 0.03, { type: "square", vol: 0.02 }),
}, { move: 0.03 });
K.songs({ calm: { bpm: 58, chords: ["Am", "F", "C", "G", "Am", "F", "Dm", "E"], pad: true, padVol: 0.02, bass: "R . . . . . . . . . . . . . . .", bassVol: 0.06, arp: true, arpVol: 0.012, arpPat: [0, 2, 1, 2], arpWave: "sine" } });

/* ================= screens ================= */
function knightImg(px = 96) { const c = document.createElement("canvas"); c.width = c.height = px; c.getContext("2d").drawImage(PIECES.sprite(2, false, px, 1), 0, 0); return c.toDataURL(); }
function leave() { if (G && !G.over) saveCur(); thinkSeq++; G = null; $("#game").hidden = true; }
function title() {
  leave(); K.playSong("calm", 0);
  const cur = SAVE.cur;
  K.ui.show(`<div class="logo"><img src="${knightImg()}" alt="" style="width:1em;height:1em">GAMBIT</div><p class="k-sub">Chess against an engine with eight levels, or with a friend.</p>
    ${SAVE.rated ? `<div class="rating">Your rating: ${SAVE.rating}</div>` : ""}
    <div class="k-menu">${cur ? `<button class="k-btn primary" data-a="continue" autofocus>Continue game</button>` : ""}<button class="k-btn ${cur ? "" : "primary"}" data-a="cpu" ${cur ? "" : "autofocus"}>Play the computer</button><button class="k-btn" data-a="twoSetup">Two players</button><button class="k-btn" data-a="stats">Stats</button><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>`, { cls: "clear" });
}
function cpuSetup() {
  const s = SAVE.setup, lv = CHESS.LEVELS.map((L, i) => `<button class="k-btn ${s.level === i ? "on" : ""}" data-a="lvl" data-i="${i}"><b>${i + 1}</b><small>${L.name}</small></button>`).join("");
  const seg = (key, opts) => `<div class="k-seg">${opts.map(([v, l]) => `<button class="k-btn ${s[key] === v ? "on" : ""}" data-a="set" data-k="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;
  const st = SAVE.stats[s.level];
  K.ui.show(`<div class="k-bar"><h2>Play the computer</h2><button class="k-btn" data-a="title">Back</button></div>
    <div class="setup">
      <div class="row"><span>Level</span><div class="levels">${lv}</div><small class="k-sub">Level ${s.level + 1} plays at about ${LEVEL_ELO[s.level]} rating · your record: ${st.w} won, ${st.d} drawn, ${st.l} lost</small></div>
      <div class="row"><span>Play as</span>${seg("color", [["w", "White"], ["r", "Random"], ["b", "Black"]])}</div>
      <div class="row"><span>Clock</span>${seg("clock", [[0, "None"], [1, "10 min"], [2, "5 min"], [3, "3 | 2"]])}</div>
      <div class="row"><span>Start from a position (optional)</span><textarea class="fen" id="fen" placeholder="Paste a FEN here, or leave empty for the normal start" spellcheck="false">${K.esc(s.fen || "")}</textarea></div>
      <button class="k-btn primary" data-a="startCpu" autofocus>Start game</button>
    </div>`, { back: "title", cls: "top" });
}
function twoSetup() {
  const s = SAVE.two, seg = `<div class="k-seg">${[[0, "None"], [1, "10 min"], [2, "5 min"], [3, "3 | 2"]].map(([v, l]) => `<button class="k-btn ${s.clock === v ? "on" : ""}" data-a="set2" data-v="${v}">${l}</button>`).join("")}</div>`;
  K.ui.show(`<div class="k-bar"><h2>Two players</h2><button class="k-btn" data-a="title">Back</button></div>
    <div class="setup"><p class="k-sub" style="text-align:left">Play a friend on this device. Take turns making moves.</p>
      <div class="row"><span>Clock</span>${seg}</div>
      <div class="k-opt" style="width:100%"><span>Turn the board for each player</span><button class="k-btn small" data-a="flip2">${s.flip ? "On" : "Off"}</button></div>
      <button class="k-btn primary" data-a="startTwo" autofocus>Start game</button></div>`, { back: "title", cls: "top" });
}
function menu() {
  if (!G || $("#game").hidden) return;
  if (G.over) { results(); return; }
  K.ui.show(`<div class="logo" style="font-size:2.4em">Paused</div><p class="k-sub">${G.mode === "cpu" ? `vs GAMBIT level ${G.level + 1} · ` : "Two players · "}${G.hist.length} move${G.hist.length === 1 ? "" : "s"} played</p>
    <div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button>${G.mode === "cpu" ? `<button class="k-btn" data-a="draw">Offer a draw</button>` : `<button class="k-btn" data-a="draw">Agree to a draw</button>`}<button class="k-btn danger" data-a="resign">Resign</button><button class="k-btn" data-a="pgn">Copy PGN</button><button class="k-btn" data-a="settings" data-from="menu">Settings</button><button class="k-btn" data-a="title">Main menu</button></div><div class="k-msg" id="msg"></div>`, { back: "resume" });
}
function results() {
  if (!G || !G.over) return;
  const r = resultText();
  K.ui.show(`<div class="logo" style="font-size:2.6em">${r.title}</div><p class="k-sub">${r.sub} · ${G.hist.length} move${G.hist.length === 1 ? "" : "s"}${G.mode === "cpu" ? ` · level ${G.level + 1} ${CHESS.LEVELS[G.level].name}` : ""}</p>
    ${G.mode === "cpu" ? (G.rated ? `<div class="rating">Rating ${SAVE.rating} (${G.ratingDelta >= 0 ? "+" : ""}${G.ratingDelta})</div>` : `<p class="k-sub">Unrated game${G.takebacks || G.hints ? " (takebacks or hints were used)" : ""}.</p>`) : ""}
    <div class="k-row"><button class="k-btn primary" data-a="rematch" autofocus>Play again</button><button class="k-btn" data-a="review">Review the game</button><button class="k-btn" data-a="pgn">Copy PGN</button><button class="k-btn" data-a="title">Main menu</button></div><div class="k-msg" id="msg"></div>`, { back: "review", cls: "soft" });
}
function pgn() {
  const d = new Date(), date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const nm = (side) => (G.mode === "cpu" ? (side === G.you ? "You" : `GAMBIT level ${G.level + 1}`) : side === WHITE ? "White" : "Black");
  const res = G.over ? G.over.result : "*";
  let tags = `[Event "Casual game"]\n[Site "Senterra Arcade"]\n[Date "${date}"]\n[White "${nm(WHITE)}"]\n[Black "${nm(BLACK)}"]\n[Result "${res}"]\n`;
  if (G.start !== CHESS.START) tags += `[SetUp "1"]\n[FEN "${G.start}"]\n`;
  let body = "", num = new Pos(G.start).full;
  G.hist.forEach((h, i) => { if (h.mover === WHITE) body += `${num}. `; else if (i === 0) body += `${num}... `; body += h.san + " "; if (h.mover === BLACK) num++; });
  return tags + "\n" + (body + res).trim();
}
function settings(from) {
  const back = from === "menu" ? "menu" : "title", o = SAVE.opts, row = (k, l) => `<div class="k-opt"><span>${l}</span><button class="k-btn small" data-a="tog" data-k="${k}">${o[k] ? "On" : "Off"}</button></div>`;
  const sw = THEMES.map((t, i) => `<button class="sw ${o.theme === i ? "on" : ""}" data-a="theme" data-i="${i}" title="${t.name}" style="background:linear-gradient(135deg,${t.l} 50%,${t.d} 50%)"></button>`).join("");
  const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div>
    <div class="k-panel" style="width:min(100%,32em);display:flex;flex-direction:column;align-items:center">
      <div class="k-opt"><span>Board</span><span class="themes">${sw}</span></div>${row("legal", "Show legal moves")}${row("coords", "Show coordinates")}${row("autoQueen", "Always promote to a queen")}${K.ui.settingsRows()}</div>`, { back, cls: "top" });
  K.ui.bindSettings(s); SETFROM = from;
}
let SETFROM = "";
function statsScreen() {
  const rows = CHESS.LEVELS.map((L, i) => { const s = SAVE.stats[i]; return `<tr><td>${i + 1} · ${L.name}</td><td>${s.w}</td><td>${s.d}</td><td>${s.l}</td></tr>`; }).join("");
  K.ui.show(`<div class="k-bar"><h2>Stats</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="rating">Rating ${SAVE.rating} · ${SAVE.rated} rated game${SAVE.rated === 1 ? "" : "s"}</div><p class="k-sub">Games without takebacks or hints from the normal start change your rating.</p>
    <div class="k-panel" style="width:min(100%,30em)"><table class="st"><tr><th>Level</th><th>Won</th><th>Drawn</th><th>Lost</th></tr>${rows}</table></div>
    <button class="k-btn danger" data-a="resetstats">Reset stats</button>`, { back: "title", cls: "top" });
}
function help(from) {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="${from === "menu" ? "menu" : "title"}" autofocus>Back</button></div>
    <div class="k-help">
      <div><b>Moving</b>Drag a piece, or click it and then click where it should go. Dots show legal moves. Right-click and drag to draw arrows.</div>
      <div><b>Winning</b>Checkmate the enemy king. Stalemate, repetition, the 50-move rule and bare kings are draws.</div>
      <div><b>Help</b>Hint shows a strong move. Takeback undoes your last move. Either one makes the game unrated.</div>
      <div><b>Review</b>Click any move in the list, or use ⏮ ◀ ▶ ⏭ (Home, [ ], End) to look back. Copy the game as PGN from the menu.</div>
      <div class="k-kbonly"><b>Keys</b>Arrows move a cursor · Enter picks up and drops · H hint · F flip · Ctrl+Z takeback · Esc menu</div>
      <div><b>Controller</b>D-pad cursor · A select and move · B cancel · Y hint · X flip · LB takeback · LT/RT review · Start menu</div>
    </div>`, { back: from === "menu" ? "menu" : "title", cls: "top" });
}
K.ui.on(async (a, d, el) => {
  switch (a) {
    case "title": K.sfx("back"); return title();
    case "continue": K.sfx("ok"); if (!resume()) title(); return;
    case "cpu": K.sfx("ok"); return cpuSetup();
    case "twoSetup": K.sfx("ok"); return twoSetup();
    case "lvl": SAVE.setup.level = +d.i; persist(); K.sfx("click"); { const f = $("#fen"); if (f) SAVE.setup.fen = f.value.trim(); } return cpuSetup();
    case "set": SAVE.setup[d.k] = d.k === "clock" ? +d.v : d.v; persist(); K.sfx("click"); { const f = $("#fen"); if (f) SAVE.setup.fen = f.value.trim(); } return cpuSetup();
    case "set2": SAVE.two.clock = +d.v; persist(); K.sfx("click"); return twoSetup();
    case "flip2": SAVE.two.flip = !SAVE.two.flip; persist(); K.sfx("click"); return twoSetup();
    case "startCpu": { const f = $("#fen"); SAVE.setup.fen = f ? f.value.trim() : ""; persist(); K.sfx("ok"); return newGame({ mode: "cpu", level: SAVE.setup.level, color: SAVE.setup.color, clock: SAVE.setup.clock, fen: SAVE.setup.fen }); }
    case "startTwo": K.sfx("ok"); return newGame({ mode: "two", clock: SAVE.two.clock, flip: SAVE.two.flip });
    case "resume": K.ui.hide(); return;
    case "rematch": { const g = G; K.sfx("ok"); return newGame(g.mode === "cpu" ? { mode: "cpu", level: g.level, color: SAVE.setup.color === "r" ? "r" : g.you === WHITE ? "w" : "b", clock: g.clock, fen: g.start === CHESS.START ? "" : g.start } : { mode: "two", clock: g.clock, flip: g.flipTwo }); }
    case "review": K.ui.hide(); if (G) { G.view = 0; renderMoves(); status(); } return;
    case "resign": { const ok = await K.confirm({ title: "Resign this game?", yes: "Resign", danger: true, focusNo: true }); if (ok && G && !G.over) { K.ui.hide(); const loser = G.mode === "cpu" ? G.you : G.pos.side; endGame(loser === WHITE ? "0-1" : "1-0", "resign"); } return; }
    case "draw": {
      if (G.mode === "two") { const ok = await K.confirm({ title: "Agree to a draw?", text: "Both players should agree.", yes: "Draw" }); if (ok) { K.ui.hide(); endGame("1/2-1/2", "agreement"); } return; }
      const accept = G.hist.length >= 30 && G.lastEval <= -60; const m = $("#msg");
      if (accept) { K.ui.hide(); endGame("1/2-1/2", "agreement"); } else if (m) { m.textContent = "GAMBIT declines the draw."; K.sfx("deny"); }
      return;
    }
    case "pgn": K.copy(pgn()).then((ok) => { const m = $("#msg"); if (m) m.textContent = ok ? "PGN copied to the clipboard." : "Couldn't copy."; }); return;
    case "settings": K.sfx("ok"); return settings(d.from);
    case "help": K.sfx("ok"); return help(d.from);
    case "stats": K.sfx("ok"); return statsScreen();
    case "menu": return menu();
    case "tog": SAVE.opts[d.k] = !SAVE.opts[d.k]; persist(); el.textContent = SAVE.opts[d.k] ? "On" : "Off"; K.sfx("ok"); return;
    case "theme": SAVE.opts.theme = +d.i; persist(); K.sfx("ok"); return settings(SETFROM);
    case "resetstats": { const ok = await K.confirm({ title: "Reset stats and rating?", text: "This can't be undone.", yes: "Reset", danger: true, focusNo: true }); if (ok) { for (let i = 0; i < 8; i++) SAVE.stats[i] = { w: 0, d: 0, l: 0 }; SAVE.rating = 1200; SAVE.rated = 0; persist(); } return statsScreen(); }
  }
});
$("#undoBtn").onclick = () => takeback();
$("#hintBtn").onclick = () => hint();
$("#flipBtn").onclick = () => flip();
$("#menuBtn").onclick = () => menu();
K.onPause(() => { if (G && !G.over && G.time && !K.ui.active() && !$("#game").hidden) menu(); });

/* ================= boot ================= */
title();
document.fonts.load("900 40px 'Playfair Display'").then(() => { if (!G && K.ui.active() && $(".logo")) title(); }).catch(() => {});
let tickT = 0;
K.loop((dt) => {
  pollPad();
  if (G && G.time && !G.over && G.hist.length && !K.ui.active() && !document.hidden) {
    const i = G.pos.side >> 3; G.time[i] -= dt;
    if (G.time[i] < 10 && G.time[i] > 0) { tickT -= dt; if (tickT <= 0) { tickT = 1; if (G.mode === "two" || G.pos.side === G.you) K.sfx("tick"); } }
    if (G.time[i] <= 0) { G.time[i] = 0; const otherCanMate = !onlyKingOrMinor(G.pos, G.pos.side ^ BLACK); endGame(otherCanMate ? (G.pos.side === WHITE ? "0-1" : "1-0") : "1/2-1/2", otherCanMate ? "time" : "time vs insufficient material"); }
    for (const c of $$("[data-clock]")) { const v = fmtClock(G.time[+c.dataset.clock]); if (c.textContent !== v) c.textContent = v; c.classList.toggle("low", G.time[+c.dataset.clock] < 20); }
  }
  if (G && !$("#game").hidden) render(dt);
});
function onlyKingOrMinor(pos, side) { let minors = 0; for (let i = 0; i < 128; i++) { if (i & 0x88) continue; const p = pos.b[i]; if (!p || (p & BLACK) !== side) continue; const t = p & 7; if (t === 6) continue; if (t === 2 || t === 3) minors++; else return false; } return minors <= 1; }
