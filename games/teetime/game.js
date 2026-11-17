"use strict";
/* TEE TIME — mini golf. 18 holes built from walls, bumpers, sand, water, slopes, windmills and sliding gates. */
const { $, $$, clamp, lerp, TAU } = K;
const R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const HOLES = [
  { name: "First Putt", par: 2, outer: R(350, 100, 650, 900), tee: [500, 830], cup: [500, 170] },
  { name: "Dogleg", par: 3, outer: [[300, 900], [500, 900], [500, 350], [850, 350], [850, 150], [300, 150]], tee: [400, 840], cup: [780, 250] },
  { name: "Bumper Alley", par: 3, outer: R(320, 80, 680, 920), bumpers: [[430, 650, 26], [570, 500, 26], [430, 350, 26]], tee: [500, 860], cup: [570, 160] },
  { name: "Sand Trap", par: 3, outer: R(300, 100, 700, 900), sand: [R(380, 400, 620, 600)], tee: [500, 840], cup: [500, 160] },
  { name: "Windmill", par: 3, outer: R(330, 100, 670, 900), walls: [R(330, 470, 440, 530), R(560, 470, 670, 530)], spin: [[500, 500, 82, 1.4]], tee: [500, 840], cup: [500, 170] },
  { name: "The Bridge", par: 3, outer: R(250, 100, 750, 900), water: [R(250, 420, 455, 560), R(545, 420, 750, 560)], walls: [R(447, 420, 455, 560), R(545, 420, 553, 560)], tee: [500, 840], cup: [360, 200] },
  { name: "Zigzag", par: 4, outer: R(200, 100, 800, 950), walls: [R(200, 680, 620, 720), R(380, 380, 800, 420)], tee: [300, 880], cup: [640, 200] },
  { name: "Hill Climb", par: 3, outer: R(330, 100, 670, 900), slopes: [[R(330, 300, 670, 600), 0, 330]], tee: [500, 840], cup: [500, 180] },
  { name: "Island", par: 4, outer: R(200, 100, 800, 900), water: [R(200, 160, 420, 420), R(580, 160, 800, 420), R(420, 360, 536, 420), R(572, 360, 580, 420)], walls: [R(420, 560, 540, 590)], tee: [500, 840], cup: [455, 250] },
  { name: "Ricochet", par: 2, outer: R(250, 150, 750, 850), walls: [R(250, 480, 600, 520)], tee: [330, 780], cup: [330, 260] },
  { name: "Pinball", par: 3, outer: R(300, 100, 700, 900), bumpers: [[400, 700, 22], [500, 620, 22], [600, 700, 22], [440, 480, 22], [560, 480, 22], [400, 330, 22], [600, 330, 22]], tee: [500, 850], cup: [500, 160] },
  { name: "Valley", par: 3, outer: R(250, 150, 750, 850), slopes: [[R(250, 150, 450, 850), 170, 0], [R(550, 150, 750, 850), -170, 0]], walls: [R(450, 450, 550, 520)], tee: [500, 800], cup: [500, 220] },
  { name: "Moving Gates", par: 3, outer: R(320, 100, 680, 900), movers: [[330, 640, 670, 640, 130, 30, 3.2], [330, 380, 670, 380, 130, 30, 2.4]], tee: [500, 850], cup: [500, 160] },
  { name: "Double Mill", par: 4, outer: R(300, 80, 700, 920), spin: [[430, 620, 92, 1.3], [570, 380, 92, -1.6]], tee: [500, 860], cup: [500, 140] },
  { name: "Spiral", par: 4, outer: R(200, 200, 800, 800), walls: [R(300, 680, 800, 700), R(300, 300, 320, 700), R(320, 300, 700, 320), R(680, 320, 700, 600)], tee: [250, 750], cup: [500, 480] },
  { name: "Long Drive", par: 3, outer: R(380, 40, 620, 960), sand: [R(380, 700, 480, 800), R(520, 480, 620, 580), R(380, 260, 480, 360)], bumpers: [[560, 760, 18], [440, 520, 18]], tee: [500, 920], cup: [500, 90] },
  { name: "Fortress", par: 3, outer: R(250, 150, 750, 850), walls: [R(400, 460, 600, 480), R(400, 300, 420, 460), R(580, 300, 600, 460), R(420, 300, 520, 320), R(556, 300, 580, 320)], tee: [500, 780], cup: [470, 400] },
  { name: "Grand Finale", par: 5, outer: R(200, 60, 800, 940), spin: [[500, 720, 110, 1.2]], walls: [R(200, 690, 380, 750), R(620, 690, 800, 750)], water: [R(200, 450, 468, 520), R(532, 450, 800, 520)], bumpers: [[420, 220, 22], [580, 220, 22], [500, 300, 22]], slopes: [[R(200, 560, 800, 680), 0, -120]], tee: [500, 890], cup: [500, 140] },
];
const BALL_R = 7, CUP_R = 12, MAXV = 1150, COLORS = ["#ffffff", "#ff5a4f", "#2e9bff", "#ffd23f"];
const SAVE = K.load("teetime.v1", { best18: 0, best9: [0, 0], holeBest: [], aces: 0, players: 1, rounds: 0 });
const persist = () => K.save("teetime.v1", SAVE);

/* ================= geometry ================= */
function prep(H) {
  if (H._segs) return H;
  const segs = [], add = (poly) => { for (let i = 0; i < poly.length; i++) segs.push([poly[i], poly[(i + 1) % poly.length]]); };
  add(H.outer); for (const w of H.walls || []) add(w);
  H._segs = segs;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of H.outer) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } H._bb = [x0, y0, x1, y1];
  return H;
}
function inPoly(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
function moverRect(m, t) { const [ax, ay, bx, by, w, h, per] = m, k = (Math.sin((t / per) * TAU) + 1) / 2, cx = lerp(ax + w / 2, bx - w / 2, k), cy = lerp(ay, by, k); return { x: cx - w / 2, y: cy - h / 2, w, h, vx: ((bx - w - ax) * Math.cos((t / per) * TAU) * TAU) / per / 2 }; }

/* ================= state ================= */
let G = null;
function newRound(holes, players) {
  G = { holes, hi: 0, players: [...Array(players)].map((_, i) => ({ name: players > 1 ? `Player ${i + 1}` : "You", col: COLORS[i], strokes: [] })), pi: 0, ball: null, t: 0, aim: { on: false, ang: -Math.PI / 2, pow: 0.5, kb: false }, state: "aim", sinkT: 0, pops: [], parts: [], shake: 0 };
  SAVE.players = players; persist(); K.ui.hide(); $("#pauseBtn").hidden = false; startHole();
}
const H = () => prep(HOLES[G.holes[G.hi]]);
function startHole() { G.pi = 0; for (const p of G.players) p.strokes[G.hi] = 0; layout(); placeBall(); K.banner(`Hole ${G.holes[G.hi] + 1}`, `${H().name} · par ${H().par}`, 1800); K.playSong("green", 2); }
function placeBall() { const [x, y] = H().tee; G.ball = { x, y, vx: 0, vy: 0, last: [x, y], moving: false, z: 0, in: false }; G.state = "aim"; G.aim.on = false; G.aim.ang = Math.atan2(H().cup[1] - y, H().cup[0] - x); G.aim.pow = 0.45; }
const P = () => G.players[G.pi];
function shoot(ang, pow) {
  if (G.state !== "aim" || pow < 0.04) return;
  const b = G.ball, sp = MAXV * pow * pow * 0.55 + MAXV * pow * 0.45; b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.moving = true; b.last = [b.x, b.y];
  P().strokes[G.hi]++; G.state = "roll"; G.aim.on = false; K.sfx(pow > 0.6 ? "puttHard" : "putt"); K.vibrate(15);
}

/* ================= physics ================= */
function step(dt) {
  if (!G) return; G.t += dt; const Hh = H(), b = G.ball;
  for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * 3; q.vy *= 1 - dt * 3; q.t -= dt; } G.parts = G.parts.filter((q) => q.t > 0);
  for (const q of G.pops) q.t += dt; G.pops = G.pops.filter((q) => q.t < 1.5); G.shake = Math.max(0, G.shake - dt);
  if (G.state === "sink") { G.sinkT += dt; if (G.sinkT > 1.1) holeDone(); return; }
  if (G.state !== "roll") return;
  const sub = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 3));
  for (let s = 0; s < sub; s++) {
    const h = dt / sub; let sand = false;
    for (const sp of Hh.sand || []) if (inPoly(b.x, b.y, sp)) sand = true;
    for (const [poly, fx, fy] of Hh.slopes || []) if (inPoly(b.x, b.y, poly)) { b.vx += fx * h; b.vy += fy * h; }
    const v = Math.hypot(b.vx, b.vy); if (v > 0) { const dec = (sand ? 1300 + v * 3 : 230 + v * 0.45) * h, nv = Math.max(0, v - dec); b.vx *= nv / v; b.vy *= nv / v; }
    b.x += b.vx * h; b.y += b.vy * h;
    // static walls
    for (const [a, c] of Hh._segs) collideSeg(b, a[0], a[1], c[0], c[1], 0.72, 0, 0);
    // round bumpers
    for (const [x, y, r] of Hh.bumpers || []) { const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy); if (d < r + BALL_R && d > 0) { const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny; b.x = x + nx * (r + BALL_R); b.y = y + ny * (r + BALL_R); if (vn < 0) { b.vx -= 2.15 * vn * nx; b.vy -= 2.15 * vn * ny; const sp2 = Math.hypot(b.vx, b.vy); if (sp2 < 260) { b.vx *= 260 / sp2; b.vy *= 260 / sp2; } K.sfx("boing"); G.bumpT = { x, y, t: 0.2 }; } } }
    // windmills
    for (const [x, y, len, w] of Hh.spin || []) { const a = G.t * w; for (const off of [0, Math.PI / 2]) { const ca = Math.cos(a + off), sa = Math.sin(a + off); collideSeg(b, x - ca * len, y - sa * len, x + ca * len, y + sa * len, 0.7, w, 0, x, y, 6); } }
    // sliding gates
    for (const m of Hh.movers || []) { const r = moverRect(m, G.t), poly = R(r.x, r.y, r.x + r.w, r.y + r.h); for (let i = 0; i < 4; i++) collideSeg(b, poly[i][0], poly[i][1], poly[(i + 1) % 4][0], poly[(i + 1) % 4][1], 0.7, 0, r.vx); }
    // water
    for (const wp of Hh.water || []) if (inPoly(b.x, b.y, wp)) { splash(); return; }
    // cup
    const cx = Hh.cup[0], cy = Hh.cup[1], cd = Math.hypot(b.x - cx, b.y - cy), sp3 = Math.hypot(b.vx, b.vy);
    if (cd < CUP_R) { if (sp3 < 360) { sink(); return; } if (cd < CUP_R * 0.6) { const a = Math.atan2(b.vy, b.vx) + (Math.random() - 0.5) * 0.8; b.vx = Math.cos(a) * sp3 * 0.7; b.vy = Math.sin(a) * sp3 * 0.7; K.sfx("lip"); } }
    else if (cd < CUP_R + 26 && sp3 < 240) { b.vx += ((cx - b.x) / cd) * 160 * h; b.vy += ((cy - b.y) / cd) * 160 * h; }
  }
  let steep = false; for (const [poly, fx, fy] of Hh.slopes || []) if (Math.hypot(fx, fy) > 230 && inPoly(b.x, b.y, poly)) steep = true;
  if (Math.hypot(b.vx, b.vy) < 7 && !steep) { b.vx = b.vy = 0; b.moving = false; G.state = "aim"; G.aim.ang = Math.atan2(Hh.cup[1] - b.y, Hh.cup[0] - b.x); if (P().strokes[G.hi] >= 9) { pop(b.x, b.y - 30, "Picked up", "#d8443a"); P().strokes[G.hi] = 10; G.state = "sink"; G.sinkT = 0.6; G.ball.in = true; } }
}
function collideSeg(b, x1, y1, x2, y2, e, spin, mvx, cx, cy, thick = 0) {
  const vx = x2 - x1, vy = y2 - y1, L2 = vx * vx + vy * vy; let t = ((b.x - x1) * vx + (b.y - y1) * vy) / L2; t = clamp(t, 0, 1);
  const px = x1 + vx * t, py = y1 + vy * t, dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy), rr = BALL_R + thick;
  if (d >= rr || d === 0) return;
  const nx = dx / d, ny = dy / d; b.x = px + nx * rr; b.y = py + ny * rr;
  let svx = mvx || 0, svy = 0; if (spin) { svx = -spin * (py - cy); svy = spin * (px - cx); }
  const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; if (-vn > 60) K.sfx(spin || mvx ? "whack" : "wall"); }
}
function splash() {
  const b = G.ball; K.sfx("splash"); for (let k = 0; k < 16; k++) { const a = Math.random() * TAU, s = 60 + Math.random() * 140; G.parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.6, c: "120,190,255" }); }
  P().strokes[G.hi]++; pop(b.x, b.y - 20, "Splash! +1", "#2e9bff");
  b.x = b.last[0]; b.y = b.last[1]; b.vx = b.vy = 0; b.moving = false; G.state = "aim";
}
function sink() {
  const b = G.ball, s = P().strokes[G.hi], par = H().par, d = s - par; G.state = "sink"; G.sinkT = 0; b.in = true; b.vx = b.vy = 0;
  const word = s === 1 ? "HOLE IN ONE!" : d <= -3 ? "Albatross!" : d === -2 ? "Eagle!" : d === -1 ? "Birdie!" : d === 0 ? "Par" : d === 1 ? "Bogey" : d === 2 ? "Double bogey" : `+${d}`;
  pop(H().cup[0], H().cup[1] - 40, word, s === 1 ? "#ffd23f" : d < 0 ? "#2f8f3a" : "#24331c"); K.sfx(s === 1 ? "ace" : d < 0 ? "birdie" : "cup");
  if (s === 1) { SAVE.aces++; persist(); for (let k = 0; k < 40; k++) { const a = Math.random() * TAU, sp = 100 + Math.random() * 300; G.parts.push({ x: H().cup[0], y: H().cup[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 1.2, c: K.pick(["255,210,63", "255,90,79", "46,155,255", "255,255,255"]) }); } }
}
function holeDone() {
  const hb = SAVE.holeBest[G.holes[G.hi]]; const s = P().strokes[G.hi]; if (G.players.length === 1 && (!hb || s < hb)) { SAVE.holeBest[G.holes[G.hi]] = s; persist(); }
  if (G.pi < G.players.length - 1) { G.pi++; placeBall(); K.toast(`${P().name}'s turn`, "", ""); return; }
  G.state = "card"; card(G.hi === G.holes.length - 1);
}
function pop(x, y, text, col) { G.pops.push({ x, y, text, col, t: 0 }); }

/* ================= render ================= */
const cv = $("#cv"), ctx = cv.getContext("2d");
const V = { W: 0, H: 0, dpr: 1, s: 1, ox: 0, oy: 0 };
let BGC = null;
function layout() {
  V.W = innerWidth; V.H = innerHeight; V.dpr = K.fit(cv, V.W, V.H).dpr; BGC = null; if (!G) return;
  const [x0, y0, x1, y1] = H()._bb, top = 64, pad = 18, aw = V.W - pad * 2, ah = V.H - top - pad;
  V.s = Math.min(aw / (x1 - x0), ah / (y1 - y0)); V.ox = (V.W - (x1 - x0) * V.s) / 2 - x0 * V.s; V.oy = top + (ah - (y1 - y0) * V.s) / 2 - y0 * V.s;
}
addEventListener("resize", layout);
const sx = (x) => V.ox + x * V.s, sy = (y) => V.oy + y * V.s;
function path(poly) { ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y)))); ctx.closePath(); }
function course() {
  if (BGC) return BGC; const Hh = H(), c = document.createElement("canvas"); c.width = Math.ceil(V.W * V.dpr); c.height = Math.ceil(V.H * V.dpr); const keep = ctx; const g = c.getContext("2d"); g.scale(V.dpr, V.dpr);
  // rough background
  g.fillStyle = "#2f6b3a"; g.fillRect(0, 0, V.W, V.H); const r = K.RNG(G.holes[G.hi] + 1); for (let k = 0; k < 500; k++) { g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)"; g.beginPath(); g.arc(r() * V.W, r() * V.H, 1 + r() * 3, 0, TAU); g.fill(); }
  const P2 = (poly) => { g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y)))); g.closePath(); };
  // fairway with mowing stripes
  g.save(); P2(Hh.outer); g.fillStyle = "#5fbf55"; g.fill(); g.clip(); const st = 34 * V.s; for (let y = sy(Hh._bb[1]) - st; y < sy(Hh._bb[3]) + st; y += st * 2) { g.fillStyle = "rgba(255,255,255,0.07)"; g.fillRect(0, y, V.W, st); }
  for (const [poly, fx, fy] of Hh.slopes || []) { P2(poly); g.fillStyle = "rgba(255,240,180,0.12)"; g.fill(); g.strokeStyle = "rgba(40,80,30,0.25)"; g.lineWidth = 2; const a = Math.atan2(fy, fx), xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]); for (let y = Math.min(...ys) + 30; y < Math.max(...ys); y += 60) for (let x = Math.min(...xs) + 30; x < Math.max(...xs); x += 60) { const X = sx(x), Y = sy(y), L = 12 * V.s; g.beginPath(); g.moveTo(X - Math.cos(a) * L, Y - Math.sin(a) * L); g.lineTo(X + Math.cos(a) * L, Y + Math.sin(a) * L); g.lineTo(X + Math.cos(a + 2.5) * L * 0.6 + Math.cos(a) * L * 0.4, Y + Math.sin(a + 2.5) * L * 0.6 + Math.sin(a) * L * 0.4); g.moveTo(X + Math.cos(a) * L, Y + Math.sin(a) * L); g.lineTo(X + Math.cos(a - 2.5) * L * 0.6 + Math.cos(a) * L * 0.4, Y + Math.sin(a - 2.5) * L * 0.6 + Math.sin(a) * L * 0.4); g.stroke(); } }
  for (const sp of Hh.sand || []) { P2(sp); g.fillStyle = "#ead39a"; g.fill(); g.fillStyle = "rgba(160,120,60,0.25)"; for (let k = 0; k < 80; k++) { const xs = sp.map((p) => p[0]), ys = sp.map((p) => p[1]), x = Math.min(...xs) + r() * (Math.max(...xs) - Math.min(...xs)), y = Math.min(...ys) + r() * (Math.max(...ys) - Math.min(...ys)); g.fillRect(sx(x), sy(y), 2, 2); } }
  g.restore();
  // tee mat
  g.fillStyle = "#3e9a45"; g.fillRect(sx(Hh.tee[0]) - 22 * V.s, sy(Hh.tee[1]) - 14 * V.s, 44 * V.s, 28 * V.s); g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(sx(Hh.tee[0]) - 22 * V.s, sy(Hh.tee[1]) + 12 * V.s, 44 * V.s, 2);
  // walls: outer border + blocks
  g.lineJoin = "round"; P2(Hh.outer); g.strokeStyle = "#7a4e2a"; g.lineWidth = Math.max(5, 12 * V.s); g.stroke(); g.strokeStyle = "#b07a46"; g.lineWidth = Math.max(2, 5 * V.s); g.stroke();
  for (const w of Hh.walls || []) { P2(w); g.fillStyle = "#9c6a3c"; g.fill(); g.strokeStyle = "#6b4426"; g.lineWidth = 2; g.stroke(); g.fillStyle = "rgba(255,255,255,0.18)"; const xs = w.map((p) => p[0]), ys = w.map((p) => p[1]); g.fillRect(sx(Math.min(...xs)) + 2, sy(Math.min(...ys)) + 2, (Math.max(...xs) - Math.min(...xs)) * V.s - 4, 3); }
  return (BGC = c);
}
function render(dt) {
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  if (!G) { ctx.fillStyle = "#2f6b3a"; ctx.fillRect(0, 0, V.W, V.H); return; }
  const Hh = H(); ctx.drawImage(course(), 0, 0, V.W, V.H);
  // water
  for (const wp of Hh.water || []) { path(wp); ctx.fillStyle = "#3d8fe0"; ctx.fill(); ctx.save(); path(wp); ctx.clip(); ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; const xs = wp.map((p) => p[0]), ys = wp.map((p) => p[1]); for (let y = Math.min(...ys) + 14; y < Math.max(...ys); y += 26) { ctx.beginPath(); for (let x = Math.min(...xs); x <= Math.max(...xs); x += 8) { const Y = sy(y + Math.sin(x * 0.05 + G.t * 2 + y) * 3); x === Math.min(...xs) ? ctx.moveTo(sx(x), Y) : ctx.lineTo(sx(x), Y); } ctx.stroke(); } ctx.restore(); ctx.strokeStyle = "#2a6fb8"; ctx.lineWidth = 2; path(wp); ctx.stroke(); }
  // cup + flag
  const [cx, cy] = Hh.cup; ctx.fillStyle = "#1c2a16"; ctx.beginPath(); ctx.arc(sx(cx), sy(cy), CUP_R * V.s, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 2; ctx.stroke();
  const fl = G.ball && Math.hypot(G.ball.x - cx, G.ball.y - cy) < 120 ? 0.35 : 1;
  ctx.globalAlpha = fl; ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = Math.max(2, 3 * V.s); ctx.beginPath(); ctx.moveTo(sx(cx), sy(cy)); ctx.lineTo(sx(cx), sy(cy) - 70 * V.s); ctx.stroke();
  ctx.fillStyle = "#ff4f4f"; ctx.beginPath(); const w = Math.sin(G.t * 4) * 6 * V.s; ctx.moveTo(sx(cx), sy(cy) - 70 * V.s); ctx.quadraticCurveTo(sx(cx) + 22 * V.s, sy(cy) - 64 * V.s + w, sx(cx) + 40 * V.s, sy(cy) - 60 * V.s); ctx.lineTo(sx(cx), sy(cy) - 48 * V.s); ctx.fill(); ctx.globalAlpha = 1;
  // bumpers
  for (const [x, y, r] of Hh.bumpers || []) { const hit = G.bumpT && G.bumpT.x === x && G.bumpT.y === y && G.bumpT.t > 0; ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.arc(sx(x) + 3, sy(y) + 4, r * V.s, 0, TAU); ctx.fill(); const gr = ctx.createRadialGradient(sx(x) - r * V.s * 0.3, sy(y) - r * V.s * 0.3, 1, sx(x), sy(y), r * V.s * (hit ? 1.15 : 1)); gr.addColorStop(0, "#fff"); gr.addColorStop(0.4, "#ff6aa8"); gr.addColorStop(1, "#c2306f"); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx(x), sy(y), r * V.s * (hit ? 1.15 : 1), 0, TAU); ctx.fill(); }
  if (G.bumpT) G.bumpT.t -= dt;
  // sliding gates
  for (const m of Hh.movers || []) { const r = moverRect(m, G.t); ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(sx(r.x) + 3, sy(r.y) + 4, r.w * V.s, r.h * V.s); ctx.fillStyle = "#ff9a3c"; ctx.fillRect(sx(r.x), sy(r.y), r.w * V.s, r.h * V.s); ctx.fillStyle = "#c2621a"; for (let k = 0; k < r.w; k += 26) ctx.fillRect(sx(r.x + k), sy(r.y), 10 * V.s, r.h * V.s); }
  // ball (under windmill blades)
  const b = G.ball;
  if (b) { const sink = G.state === "sink" && b.in ? Math.min(1, G.sinkT * 3) : 0; if (sink < 1) { const bx = sink ? lerp(b.x, cx, sink) : b.x, by = sink ? lerp(b.y, cy, sink) : b.y, br = BALL_R * V.s * (1 - sink * 0.6); ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(sx(bx) + 2, sy(by) + 3, br, br * 0.8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = P().col; ctx.beginPath(); ctx.arc(sx(bx), sy(by), br, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.beginPath(); ctx.arc(sx(bx) - br * 0.3, sy(by) - br * 0.35, br * 0.3, 0, TAU); ctx.fill(); } }
  // windmills
  for (const [x, y, len, w] of Hh.spin || []) { const a = G.t * w; ctx.save(); ctx.translate(sx(x), sy(y)); ctx.rotate(a); for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = k % 2 ? "#f2efe6" : "#d9534f"; ctx.fillRect(0, -6 * V.s, len * V.s, 12 * V.s); ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1; ctx.strokeRect(0, -6 * V.s, len * V.s, 12 * V.s); } ctx.fillStyle = "#6b4426"; ctx.beginPath(); ctx.arc(0, 0, 12 * V.s, 0, TAU); ctx.fill(); ctx.restore(); }
  // aim
  if (G.state === "aim" && b) {
    const a = G.aim, show = a.on || a.kb || K.device === "pad";
    if (show) { const pw = a.pow, len = (40 + pw * 220) * V.s, ex = sx(b.x) + Math.cos(a.ang) * len, ey = sy(b.y) + Math.sin(a.ang) * len; ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.strokeStyle = `hsl(${120 - pw * 120},90%,45%)`; ctx.beginPath(); ctx.moveTo(sx(b.x), sy(b.y)); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, TAU); ctx.fill(); }
    else { const p = 0.5 + Math.sin(G.t * 4) * 0.5; ctx.strokeStyle = `rgba(255,255,255,${0.3 + p * 0.4})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y), (BALL_R + 8 + p * 6) * V.s, 0, TAU); ctx.stroke(); }
  }
  for (const q of G.parts) { ctx.fillStyle = `rgba(${q.c},${Math.min(1, q.t * 2)})`; ctx.fillRect(sx(q.x) - 3, sy(q.y) - 3, 6, 6); }
  for (const q of G.pops) { ctx.globalAlpha = Math.max(0, 1 - q.t / 1.5); ctx.font = `400 ${Math.max(22, 34 * V.s)}px Chewy`; ctx.textAlign = "center"; ctx.lineWidth = 6; ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.strokeText(q.text, sx(q.x), sy(q.y) - q.t * 30); ctx.fillStyle = q.col; ctx.fillText(q.text, sx(q.x), sy(q.y) - q.t * 30); ctx.globalAlpha = 1; }
  hud();
}
function hud() {
  const Hh = H(), p = P(), s = p.strokes[G.hi] || 0;
  ctx.fillStyle = "rgba(255,252,238,0.94)"; K.roundRect(ctx, 10, 8, Math.min(V.W - 80, 440), 46, 14); ctx.fill();
  ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillStyle = "#24331c"; ctx.font = '400 24px Chewy'; ctx.fillText(`Hole ${G.holes[G.hi] + 1}`, 24, 31);
  ctx.font = "800 14px Nunito"; ctx.fillStyle = "#61724f"; ctx.fillText(`${Hh.name} · par ${Hh.par}`, 104, 24);
  ctx.fillStyle = p.col === "#ffffff" ? "#24331c" : p.col; ctx.fillText(`${p.name} · stroke ${s}${total(p) !== null ? ` · ${fmtPar(total(p))}` : ""}`, 104, 41);
}
function total(p) { let st = 0, par = 0, any = false; for (let i = 0; i < G.holes.length; i++) { const s = p.strokes[i]; if (s && (i < G.hi || (i === G.hi && G.state === "card"))) { st += s; par += HOLES[G.holes[i]].par; any = true; } } return any ? st - par : null; }
const fmtPar = (d) => (d === 0 ? "E" : d > 0 ? `+${d}` : String(d));

/* ================= input ================= */
const DRAG = { on: false, x0: 0, y0: 0, id: null };
cv.addEventListener("pointerdown", (e) => { if (!G || K.ui.active() || G.state !== "aim") return; K.audio(); DRAG.on = true; DRAG.x0 = e.clientX; DRAG.y0 = e.clientY; DRAG.id = e.pointerId; G.aim.on = true; G.aim.kb = false; G.aim.pow = 0; try { cv.setPointerCapture(e.pointerId); } catch {} });
cv.addEventListener("pointermove", (e) => { if (!DRAG.on || e.pointerId !== DRAG.id) return; const dx = DRAG.x0 - e.clientX, dy = DRAG.y0 - e.clientY, d = Math.hypot(dx, dy); if (d > 4) { G.aim.ang = Math.atan2(dy, dx); G.aim.pow = clamp(d / Math.max(150, Math.min(V.W, V.H) * 0.3), 0, 1); } else G.aim.pow = 0; });
cv.addEventListener("pointerup", (e) => { if (!DRAG.on || e.pointerId !== DRAG.id) return; DRAG.on = false; G.aim.on = false; if (G.aim.pow > 0.04) shoot(G.aim.ang, G.aim.pow); });
cv.addEventListener("pointercancel", () => { DRAG.on = false; if (G) G.aim.on = false; });
addEventListener("keydown", (e) => {
  if (!G || K.ui.active()) return;
  if (e.code === "Escape") return menu();
  if (G.state !== "aim") return;
  const a = G.aim;
  if (e.code === "ArrowLeft" || e.code === "KeyA") { a.ang -= e.shiftKey ? 0.01 : 0.04; a.kb = true; e.preventDefault(); }
  else if (e.code === "ArrowRight" || e.code === "KeyD") { a.ang += e.shiftKey ? 0.01 : 0.04; a.kb = true; e.preventDefault(); }
  else if (e.code === "ArrowUp" || e.code === "KeyW") { a.pow = clamp(a.pow + 0.04, 0.05, 1); a.kb = true; e.preventDefault(); }
  else if (e.code === "ArrowDown" || e.code === "KeyS") { a.pow = clamp(a.pow - 0.04, 0.05, 1); a.kb = true; e.preventDefault(); }
  else if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); shoot(a.ang, a.pow); }
});
function pollPad(dt) {
  const P0 = K.pad; if (!P0.connected || !G || K.ui.active()) return; const a = G.aim;
  if (P0.pressed.start) return menu();
  if (G.state !== "aim") return;
  if (Math.hypot(P0.ax, P0.ay) > 0.5) a.ang = Math.atan2(P0.ay, P0.ax);
  if (P0.held.dl || P0.held.lb) a.ang -= dt * 0.8; if (P0.held.dr || P0.held.rb) a.ang += dt * 0.8;
  if (P0.held.du || P0.rt > 0.3) a.pow = clamp(a.pow + dt * 0.7, 0.05, 1); if (P0.held.dd || P0.lt > 0.3) a.pow = clamp(a.pow - dt * 0.7, 0.05, 1);
  if (P0.pressed.a) shoot(a.ang, a.pow);
}
$("#pauseBtn").onclick = () => menu();

/* ================= audio ================= */
K.defineSfx({
  putt: (t) => { K.noise(t, 0.05, { filter: "bandpass", freq: 2200, q: 2, vol: 0.12 }); K.voice(700, t, 0.05, { type: "sine", vol: 0.05 }); },
  puttHard: (t) => { K.noise(t, 0.07, { filter: "bandpass", freq: 1800, q: 2, vol: 0.16 }); K.voice(520, t, 0.07, { type: "sine", vol: 0.06 }); },
  wall: (t) => K.noise(t, 0.06, { filter: "lowpass", freq: 900, vol: 0.12 }),
  whack: (t) => { K.noise(t, 0.08, { filter: "bandpass", freq: 600, vol: 0.14 }); K.voice(160, t, 0.08, { type: "triangle", vol: 0.06 }); },
  boing: (t) => K.voice(300, t, 0.25, { type: "sine", vol: 0.08, slide: 2.4, slideT: 0.12, vib: 12 }),
  lip: (t) => K.voice(900, t, 0.05, { type: "triangle", vol: 0.05 }),
  splash: (t) => K.noise(t, 0.5, { filter: "bandpass", freq: 900, slide: 0.4, vol: 0.18 }),
  cup: (t) => { K.noise(t, 0.08, { filter: "bandpass", freq: 1500, vol: 0.1 }); K.notes(t + 0.1, [523, 659, 784], 0.07, { type: "triangle", vol: 0.05, len: 0.25 }); },
  birdie: (t) => { K.noise(t, 0.08, { filter: "bandpass", freq: 1500, vol: 0.1 }); K.notes(t + 0.1, [659, 784, 1046, 1318], 0.07, { type: "triangle", vol: 0.055, len: 0.3 }); },
  ace: (t) => { K.noise(t, 0.08, { filter: "bandpass", freq: 1500, vol: 0.1 }); K.notes(t + 0.1, [523, 659, 784, 1046, 1318, 1568, 2093], 0.08, { duty: 0.25, vol: 0.06, len: 0.45 }); },
}, { wall: 0.05, whack: 0.06, boing: 0.06 });
K.songs({ green: { bpm: 96, chords: ["C", "Am", "F", "G", "C", "Em", "F", "G"], bass: "R . . . O . . . F . . . O . . .", bassWave: "triangle", bassVol: 0.09, arp: true, arpVol: 0.016, arpPat: [0, 1, 2, 1, 3, 1, 2, 1], arpWave: "triangle", drums: "k . h . s . h . k . h . s . h .",
  lead: ["e5 - g5 - c6 - - -", "a5 - - - e5 - - -", "f5 - a5 - c6 - a5 -", "g5 - - - - - - -", "e5 - g5 - c6 - e6 -", "d6 - b5 - g5 - - -", "a5 - c6 - f6 - e6 -", "d6 - - - - - - -"], leadVol: 0.03, leadWave: "triangle" } });

/* ================= screens ================= */
function title() {
  G = null; $("#pauseBtn").hidden = true; K.playSong("green", 1); layout();
  const seg = (opts) => `<div class="k-seg">${opts.map(([v, l]) => `<button class="k-btn ${SAVE.players === v ? "on" : ""}" data-a="np" data-v="${v}">${l}</button>`).join("")}</div>`;
  K.ui.show(`<div class="logo">TEE <span>TIME</span></div><p class="k-sub">Mini golf with 18 hand-built holes. Drag back from anywhere to aim, let go to putt.</p>
    <div class="setup"><div class="row"><span>Players</span>${seg([[1, "1"], [2, "2"], [3, "3"], [4, "4"]])}</div>
      <button class="k-btn primary" data-a="r18" autofocus>Play all 18 holes${SAVE.best18 ? ` · best ${SAVE.best18}` : ""}</button>
      <div class="k-row"><button class="k-btn" data-a="r9" data-b="0">Front 9</button><button class="k-btn" data-a="r9" data-b="1">Back 9</button><button class="k-btn" data-a="practice">Practice a hole</button></div>
      <div class="k-row"><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>${SAVE.aces ? `<p class="k-sub">Holes in one: ${SAVE.aces}</p>` : ""}</div>`, { cls: "soft" });
}
function practice() {
  const b = HOLES.map((h, i) => `<button class="k-btn" data-a="one" data-i="${i}"><b>${i + 1}</b><small>par ${h.par}${SAVE.holeBest[i] ? " · " + SAVE.holeBest[i] : ""}</small></button>`).join("");
  K.ui.show(`<div class="k-bar"><h2>Practice</h2><button class="k-btn" data-a="title">Back</button></div><div class="holes">${b}</div>`, { back: "title", cls: "top" });
}
function cardHtml() {
  const hs = G.holes, head = hs.map((h) => `<th>${h + 1}</th>`).join(""), pars = hs.map((h) => `<td>${HOLES[h].par}</td>`).join(""), parT = hs.reduce((a, h) => a + HOLES[h].par, 0);
  const rows = G.players.map((p) => { let tot = 0; const cells = hs.map((h, i) => { const s = p.strokes[i]; if (s === undefined || (i > G.hi)) return "<td></td>"; tot += s; const d = s - HOLES[h].par; return `<td class="${d < 0 ? "under" : d > 0 ? "over" : ""}">${s}</td>`; }).join(""); return `<tr><td class="n" style="color:${p.col === "#ffffff" ? "inherit" : p.col}">${p.name}</td>${cells}<td><b>${tot}</b></td></tr>`; }).join("");
  return `<div class="cardwrap"><table class="card"><tr><th>Hole</th>${head}<th>Tot</th></tr><tr><td class="n">Par</td>${pars}<td>${parT}</td></tr>${rows}</table></div>`;
}
function card(final) {
  if (final) {
    const results = G.players.map((p) => ({ p, tot: p.strokes.reduce((a, s) => a + (s || 0), 0) })).sort((a, b) => a.tot - b.tot), parT = G.holes.reduce((a, h) => a + HOLES[h].par, 0);
    if (G.players.length === 1) { const t = results[0].tot; if (G.holes.length === 18 && (!SAVE.best18 || t < SAVE.best18)) SAVE.best18 = t; if (G.holes.length === 9) { const k = G.holes[0] === 0 ? 0 : 1; if (!SAVE.best9[k] || t < SAVE.best9[k]) SAVE.best9[k] = t; } }
    SAVE.rounds++; persist(); K.sfx("win");
    K.ui.show(`<div class="logo" style="font-size:2.8em">${G.players.length > 1 ? `${results[0].p.name} wins!` : "Round complete"}</div><p class="k-sub">${results.map((r) => `${r.p.name}: ${r.tot} (${fmtPar(r.tot - parT)})`).join(" · ")}</p>${cardHtml()}
      <div class="k-row"><button class="k-btn primary" data-a="again" autofocus>Play again</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "title", cls: "top" });
  } else K.ui.show(`<div class="logo" style="font-size:2.4em">Hole ${G.holes[G.hi] + 1} done</div>${cardHtml()}<button class="k-btn primary" data-a="next" autofocus>Next hole</button>`, { back: "next", cls: "soft" });
}
function menu() { if (!G || K.ui.active()) return; K.ui.show(`<div class="logo" style="font-size:2.6em">Paused</div>${cardHtml()}<div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="retee">Restart this hole</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "resume", cls: "top" }); }
function settings() { const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="title">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center">${K.ui.settingsRows()}</div>`, { back: "title", cls: "top" }); K.ui.bindSettings(s); }
function help() {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="k-help"><div><b>Putting</b>Press anywhere and drag back, like a slingshot. The further you pull, the harder the putt. Let go to shoot.</div><div><b>The course</b>Sand slows the ball, water costs a stroke, arrows push the ball downhill, and pink bumpers bounce it hard.</div>
    <div><b>Moving parts</b>Time your shots past windmill blades and sliding gates.</div><div><b>Scoring</b>Fewest strokes wins. After nine strokes on a hole the ball is picked up.</div>
    <div class="k-kbonly"><b>Keys</b>← → aim (Shift for fine aim) · ↑ ↓ power · Space putts · Esc menu</div><div><b>Controller</b>Stick aims, triggers or D-pad set power, A putts</div></div>`, { back: "title", cls: "top" });
}
let LAST = null;
K.ui.on((a, d) => {
  switch (a) {
    case "np": SAVE.players = +d.v; persist(); K.sfx("click"); return title();
    case "r18": K.sfx("ok"); LAST = [...Array(18).keys()]; return newRound(LAST, SAVE.players);
    case "r9": K.sfx("ok"); LAST = [...Array(9).keys()].map((i) => i + (+d.b) * 9); return newRound(LAST, SAVE.players);
    case "practice": K.sfx("ok"); return practice();
    case "one": K.sfx("ok"); LAST = [+d.i]; return newRound(LAST, SAVE.players);
    case "again": K.sfx("ok"); return newRound(LAST, G.players.length);
    case "next": K.ui.hide(); G.hi++; return startHole();
    case "resume": K.ui.hide(); return;
    case "retee": K.ui.hide(); P().strokes[G.hi] = 0; return placeBall();
    case "title": K.sfx("back"); return title();
    case "settings": K.sfx("ok"); return settings();
    case "help": K.sfx("ok"); return help();
  }
});

/* ================= boot ================= */
layout(); title();
const fixed = K.fixed(120);
K.loop((dt) => { pollPad(dt); if (G && !K.ui.active()) fixed(dt, step); render(dt); });
