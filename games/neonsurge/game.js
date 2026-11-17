"use strict";
/* NEON SURGE — twin-stick arena shooter. */
const { $, $$, clamp, lerp, TAU } = K;
const AW = 1600, AH = 1000;
const SAVE = K.load("neonsurge.v1", { best: { arena: 0, rush: 0 }, daily: { date: "", best: 0 }, autofire: true, bloom: true, games: 0, kills: 0 });
const persist = () => K.save("neonsurge.v1", SAVE);
const ETYPES = {
  drifter: { r: 16, hp: 1, pts: 50, col: "#2f8bff", spd: 150 }, seeker: { r: 15, hp: 1, pts: 75, col: "#3dff8a", spd: 175 }, dodger: { r: 16, hp: 1, pts: 100, col: "#b84dff", spd: 210 },
  splitter: { r: 22, hp: 3, pts: 120, col: "#ff9a2e", spd: 120 }, shard: { r: 10, hp: 1, pts: 40, col: "#ffc06b", spd: 290 }, orbiter: { r: 15, hp: 2, pts: 110, col: "#ffe14d", spd: 230 },
  snake: { r: 14, hp: 4, pts: 200, col: "#00f0ff", spd: 200 }, nest: { r: 34, hp: 26, pts: 600, col: "#ff2bd6", spd: 0 }, turret: { r: 20, hp: 6, pts: 250, col: "#f2f6ff", spd: 30 }, swarm: { r: 8, hp: 1, pts: 30, col: "#ff3b5c", spd: 330 },
};
const POWERS = { spread: { col: "#ffe14d", l: "SPREAD", t: 10 }, rapid: { col: "#00f0ff", l: "RAPID", t: 10 }, pierce: { col: "#ff2bd6", l: "PIERCE", t: 10 } };

/* ================= spring grid ================= */
const GR = { sp: 50, cols: 0, rows: 0 };
function gridInit() {
  GR.cols = AW / GR.sp + 1; GR.rows = AH / GR.sp + 1; const n = GR.cols * GR.rows;
  GR.x = new Float32Array(n); GR.y = new Float32Array(n); GR.vx = new Float32Array(n); GR.vy = new Float32Array(n); GR.ox = new Float32Array(n); GR.oy = new Float32Array(n);
  for (let j = 0; j < GR.rows; j++) for (let i = 0; i < GR.cols; i++) { const k = j * GR.cols + i; GR.x[k] = GR.ox[k] = i * GR.sp; GR.y[k] = GR.oy[k] = j * GR.sp; }
}
function gridForce(x, y, r, s) {
  const i0 = Math.max(0, ((x - r) / GR.sp) | 0), i1 = Math.min(GR.cols - 1, ((x + r) / GR.sp + 1) | 0), j0 = Math.max(0, ((y - r) / GR.sp) | 0), j1 = Math.min(GR.rows - 1, ((y + r) / GR.sp + 1) | 0);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * GR.cols + i, dx = GR.x[k] - x, dy = GR.y[k] - y, d = Math.hypot(dx, dy); if (d < r && d > 1) { const f = s * (1 - d / r) / d; GR.vx[k] += dx * f; GR.vy[k] += dy * f; } }
}
function gridStep(dt) {
  const c = GR.cols, r = GR.rows;
  for (let j = 1; j < r - 1; j++) for (let i = 1; i < c - 1; i++) {
    const k = j * c + i, dx = GR.x[k] - GR.ox[k], dy = GR.y[k] - GR.oy[k];
    const nx = (GR.x[k - 1] - GR.ox[k - 1] + GR.x[k + 1] - GR.ox[k + 1] + GR.x[k - c] - GR.ox[k - c] + GR.x[k + c] - GR.ox[k + c]) / 4, ny = (GR.y[k - 1] - GR.oy[k - 1] + GR.y[k + 1] - GR.oy[k + 1] + GR.y[k - c] - GR.oy[k - c] + GR.y[k + c] - GR.oy[k + c]) / 4;
    GR.vx[k] += (-dx * 44 + (nx - dx) * 50 - GR.vx[k] * 7.5) * dt; GR.vy[k] += (-dy * 44 + (ny - dy) * 50 - GR.vy[k] * 7.5) * dt;
  }
  for (let j = 1; j < r - 1; j++) for (let i = 1; i < c - 1; i++) { const k = j * c + i; GR.x[k] = clamp(GR.x[k] + GR.vx[k] * dt, GR.ox[k] - 38, GR.ox[k] + 38); GR.y[k] = clamp(GR.y[k] + GR.vy[k] * dt, GR.oy[k] - 38, GR.oy[k] + 38); }
}

/* ================= state ================= */
let G = null;
function newGame(mode) {
  const daily = mode === "daily";
  G = { mode, daily, rng: daily ? K.RNG(K.dailySeed("neonsurge")) : K.RNG((Math.random() * 1e9) | 0), t: 0, score: 0, mult: 1, sparksN: 0, lives: daily ? 3 : mode === "rush" ? 99 : 3, bombs: 3, timeLeft: mode === "rush" ? 180 : 0,
    p: { x: AW / 2, y: AH / 2, vx: 0, vy: 0, a: -Math.PI / 2, aim: -Math.PI / 2, inv: 2.5, alive: true, cd: 0, power: null, powerT: 0, dead: 0 }, en: [], bul: [], eb: [], sparks: [], pows: [], warn: [],
    spawnT: 1.2, heat: 0, nextLife: 75000, nextBomb: 100000, over: false, kills: 0, cam: { x: AW / 2, y: AH / 2 }, shake: 0, flash: 0, pops: [], bombWave: null };
  gridInit(); SAVE.games++; persist();
  K.ui.hide(); $("#pauseBtn").hidden = false; $("#bombBtn").hidden = K.device !== "touch"; layout(); K.playSong("surge", 3); K.sfx("start");
}
const R = () => G.rng();
function spawn(type, x, y, o = {}) { const T = ETYPES[type], a = R() * TAU; const e = { type, x, y, vx: Math.cos(a) * T.spd, vy: Math.sin(a) * T.spd, r: T.r, hp: T.hp + (type === "nest" ? Math.floor(G.t / 60) * 6 : 0), t: 0, warm: 0.7, rot: R() * TAU, ...o }; if (type === "snake") e.body = Array.from({ length: 10 }, () => ({ x, y })); G.en.push(e); return e; }
function spawnAround(type, n, minD = 340) { for (let k = 0; k < n; k++) { let x, y, tries = 0; do { x = 60 + R() * (AW - 120); y = 60 + R() * (AH - 120); tries++; } while (Math.hypot(x - G.p.x, y - G.p.y) < minD && tries < 30); spawn(type, x, y); } }
function director(dt) {
  G.spawnT -= dt; if (G.spawnT > 0) return;
  const t = G.t, lvl = Math.min(1, t / 360), cap = 22 + t * 0.5; if (G.en.length > cap) { G.spawnT = 0.6; return; }
  const pool = [["drifter", 3, 0], ["seeker", 3, 8], ["dodger", 2, 30], ["splitter", 2, 45], ["orbiter", 2, 70], ["snake", 1, 100], ["turret", 1, 130], ["nest", 1, 170], ["swarm", 2, 55]].filter((q) => t >= q[2]);
  const pick = pool[(R() * pool.length) | 0], type = pick[0], pattern = R();
  const count = Math.max(1, Math.round((type === "nest" || type === "turret" || type === "snake" ? 1 : 3 + lvl * 7) * (0.6 + R() * 0.8)));
  if (type === "swarm") { const cx = R() < 0.5 ? 60 : AW - 60, cy = 60 + R() * (AH - 120); for (let k = 0; k < 6 + lvl * 10; k++) spawn("swarm", cx + (R() - 0.5) * 80, cy + (R() - 0.5) * 80); }
  else if (pattern < 0.3 && type !== "nest") { const cs = [[50, 50], [AW - 50, 50], [50, AH - 50], [AW - 50, AH - 50]]; for (let k = 0; k < count; k++) { const c = cs[k % 4]; spawn(type, c[0] + (R() - 0.5) * 40, c[1] + (R() - 0.5) * 40); } }
  else if (pattern < 0.5 && type !== "nest" && type !== "turret") { const n = count + 2; for (let k = 0; k < n; k++) { const a = (k / n) * TAU, d = 380; spawn(type, clamp(G.p.x + Math.cos(a) * d, 40, AW - 40), clamp(G.p.y + Math.sin(a) * d, 40, AH - 40)); } }
  else spawnAround(type, count);
  K.sfx("spawn"); G.spawnT = Math.max(0.9, 3.6 - lvl * 2.4) * (0.7 + R() * 0.6);
}

/* ================= update ================= */
const IN = { mx: 0, my: 0, ax: 0, ay: 0, firing: false, mouseAim: false, lt: null, rt: null };
function update(dt) {
  if (!G || G.over) { if (G && G.over) { G.t += dt; gridStep(dt); for (const e of G.en) e.t += dt; } return; }
  G.t += dt; if (G.mode === "rush") { G.timeLeft -= dt; if (G.timeLeft <= 0) { G.timeLeft = 0; return endGame(); } }
  const p = G.p;
  // input
  let mx = 0, my = 0; if (K.held("KeyA")) mx -= 1; if (K.held("KeyD")) mx += 1; if (K.held("KeyW")) my -= 1; if (K.held("KeyS")) my += 1;
  let ax = 0, ay = 0, fire = false;
  if (K.held("ArrowLeft")) ax -= 1; if (K.held("ArrowRight")) ax += 1; if (K.held("ArrowUp")) ay -= 1; if (K.held("ArrowDown")) ay += 1; if (ax || ay) { fire = true; IN.mouseAim = false; }
  const P = K.pad; if (P.connected) { if (Math.hypot(P.ax, P.ay) > 0.2) { mx += P.ax; my += P.ay; } if (Math.hypot(P.rx, P.ry) > 0.3) { ax = P.rx; ay = P.ry; fire = true; IN.mouseAim = false; } if (P.pressed.lb || P.pressed.rb || P.pressed.lt || P.pressed.rt || P.pressed.a) bomb(); if (P.pressed.start) pause(); }
  if (IN.lt) { mx += IN.lt.dx; my += IN.lt.dy; } if (IN.rt && Math.hypot(IN.rt.dx, IN.rt.dy) > 0.15) { ax = IN.rt.dx; ay = IN.rt.dy; fire = true; }
  if (!fire && IN.mouseAim) { const w = toWorld(IN.mx, IN.my); ax = w.x - p.x; ay = w.y - p.y; fire = SAVE.autofire || IN.firing; }
  if (p.alive) {
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    const acc = 3400; p.vx += mx * acc * dt; p.vy += my * acc * dt; const dr = Math.exp(-dt * 8.5); p.vx *= dr; p.vy *= dr;
    p.x = clamp(p.x + p.vx * dt, 20, AW - 20); p.y = clamp(p.y + p.vy * dt, 20, AH - 20);
    if (ml > 0.1) p.a = Math.atan2(my, mx);
    if (ax || ay) p.aim = Math.atan2(ay, ax);
    p.inv = Math.max(0, p.inv - dt); p.cd -= dt; if (p.powerT > 0) { p.powerT -= dt; if (p.powerT <= 0) p.power = null; }
    if (fire && p.cd <= 0) shoot();
    if (ml > 0.2 && Math.random() < 0.8) TRAIL.push({ x: p.x - Math.cos(p.a) * 14, y: p.y - Math.sin(p.a) * 14, vx: -Math.cos(p.a + (Math.random() - 0.5) * 0.6) * 260 + p.vx * 0.3, vy: -Math.sin(p.a + (Math.random() - 0.5) * 0.6) * 260 + p.vy * 0.3, t: 0.35, c: "255,170,60" });
    gridForce(p.x, p.y, 80, ml > 0.1 ? 9 : 3);
  } else { p.dead -= dt; if (p.dead <= 0) respawn(); }
  director(dt);
  // bullets
  for (const b of G.bul) { b.x += b.vx * dt; b.y += b.vy * dt; b.t -= dt; if (b.x < 0 || b.x > AW || b.y < 0 || b.y > AH) { b.dead = true; sparkBurst(clamp(b.x, 0, AW), clamp(b.y, 0, AH), "120,220,255", 3, 120); } if (b.t <= 0) b.dead = true; }
  for (const b of G.eb) { b.x += b.vx * dt; b.y += b.vy * dt; if (b.x < 0 || b.x > AW || b.y < 0 || b.y > AH) b.dead = true; if (p.alive && !p.inv && Math.hypot(b.x - p.x, b.y - p.y) < 12) { b.dead = true; die(); } }
  // enemies
  for (const e of G.en) {
    e.t += dt; if (e.warm > 0) { e.warm -= dt; continue; }
    const T = ETYPES[e.type], dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (e.type === "drifter") { e.rot += dt * 2; }
    else if (e.type === "seeker" || e.type === "swarm" || e.type === "shard") { const s = T.spd * (e.type === "swarm" ? 0.85 + Math.sin(e.t * 9 + e.x) * 0.3 : 1); e.vx += (dx / d * s - e.vx) * dt * (e.type === "seeker" ? 2.2 : 3.5); e.vy += (dy / d * s - e.vy) * dt * (e.type === "seeker" ? 2.2 : 3.5); e.rot = Math.atan2(e.vy, e.vx); }
    else if (e.type === "dodger") { let fx = dx / d * T.spd, fy = dy / d * T.spd; for (const b of G.bul) { const bx = e.x - b.x, by = e.y - b.y, bd = Math.hypot(bx, by); if (bd < 110 && (b.vx * bx + b.vy * by) > 0) { const s = (110 - bd) / 110 * 900; fx += (-b.vy * Math.sign(b.vx * by - b.vy * bx)) / 700 * s; fy += (b.vx * Math.sign(b.vx * by - b.vy * bx)) / 700 * s; } } e.vx += (fx - e.vx) * dt * 4; e.vy += (fy - e.vy) * dt * 4; e.rot += dt * 3; }
    else if (e.type === "splitter") { e.vx += (dx / d * T.spd - e.vx) * dt * 0.8; e.vy += (dy / d * T.spd - e.vy) * dt * 0.8; e.rot += dt * 1.5; }
    else if (e.type === "orbiter") { e.phase = e.phase || (R() < 0.5 ? 1 : -1); if (e.charge > 0) { e.charge -= dt; } else if (d < 260 && R() < dt * 0.4) { e.charge = 0.8; e.vx = dx / d * 620; e.vy = dy / d * 620; } else { const ta = Math.atan2(-dy, -dx) + e.phase * 0.9, tx = p.x + Math.cos(ta) * 230, ty = p.y + Math.sin(ta) * 230; e.vx += ((tx - e.x) * 2.5 - e.vx) * dt * 2.2; e.vy += ((ty - e.y) * 2.5 - e.vy) * dt * 2.2; } e.rot += dt * 4; }
    else if (e.type === "snake") { const ta = Math.atan2(dy, dx) + Math.sin(e.t * 3) * 0.9, sp = T.spd; e.vx += (Math.cos(ta) * sp - e.vx) * dt * 2.5; e.vy += (Math.sin(ta) * sp - e.vy) * dt * 2.5; e.rot = Math.atan2(e.vy, e.vx); let px = e.x, py = e.y; for (const s of e.body) { const sx = s.x - px, sy = s.y - py, sd = Math.hypot(sx, sy) || 1; if (sd > 18) { s.x = px + sx / sd * 18; s.y = py + sy / sd * 18; } px = s.x; py = s.y; } }
    else if (e.type === "nest") { e.rot += dt * 0.8; e.spawnT = (e.spawnT ?? 3) - dt; if (e.spawnT <= 0) { e.spawnT = Math.max(1.6, 4 - G.t / 120); for (let k = 0; k < 3; k++) { const s = spawn("swarm", e.x + (R() - 0.5) * 30, e.y + (R() - 0.5) * 30); s.warm = 0.2; } K.sfx("nest"); } gridForce(e.x, e.y, 130, -6); }
    else if (e.type === "turret") { e.rot += dt * 0.6; e.vx *= 0.98; e.vy *= 0.98; e.fireT = (e.fireT ?? 2) - dt; if (e.fireT <= 0 && d < 900) { e.fireT = Math.max(1.1, 2.6 - G.t / 200); const a = Math.atan2(dy, dx); for (const da of G.t > 200 ? [-0.25, 0, 0.25] : [0]) G.eb.push({ x: e.x, y: e.y, vx: Math.cos(a + da) * 300, vy: Math.sin(a + da) * 300 }); K.sfx("eshot"); } }
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.x < e.r) { e.x = e.r; e.vx = Math.abs(e.vx); } if (e.x > AW - e.r) { e.x = AW - e.r; e.vx = -Math.abs(e.vx); }
    if (e.y < e.r) { e.y = e.r; e.vy = Math.abs(e.vy); } if (e.y > AH - e.r) { e.y = AH - e.r; e.vy = -Math.abs(e.vy); }
    if (p.alive && !p.inv && d < e.r + 10) die();
  }
  // bullets vs enemies
  for (const b of G.bul) {
    if (b.dead) continue;
    for (const e of G.en) {
      if (e.dead || e.warm > 0) continue;
      if (e.type === "snake") { let blocked = false; for (const s of e.body) if (Math.hypot(b.x - s.x, b.y - s.y) < 12) { blocked = true; break; } if (blocked) { b.dead = true; sparkBurst(b.x, b.y, "0,240,255", 4, 160); break; } }
      if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < (e.r + 5) ** 2) {
        e.hp -= b.dmg; e.hitT = 0.08; if (!b.pierce) b.dead = true;
        e.vx += b.vx * 0.04; e.vy += b.vy * 0.04;
        if (e.hp <= 0) kill(e); else { K.sfx("hit"); sparkBurst(b.x, b.y, hexRgb(ETYPES[e.type].col), 3, 140); }
        if (b.dead) break;
      }
    }
  }
  G.bul = G.bul.filter((b) => !b.dead); G.eb = G.eb.filter((b) => !b.dead); G.en = G.en.filter((e) => !e.dead);
  // sparks (multiplier pickups) + power-ups
  for (const s of G.sparks) { s.t -= dt; const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1; if (p.alive && d < 150) { s.vx += dx / d * 2200 * dt; s.vy += dy / d * 2200 * dt; } s.vx *= 1 - dt * 3; s.vy *= 1 - dt * 3; s.x += s.vx * dt; s.y += s.vy * dt; if (p.alive && d < 18) { s.dead = true; G.sparksN++; const nm = 1 + Math.floor(G.sparksN / 20); if (nm > G.mult) { G.mult = nm; K.sfx("multup"); pop(p.x, p.y - 30, `×${G.mult}`, "#3dff8a"); } K.sfx("spark"); } if (s.t <= 0) s.dead = true; }
  G.sparks = G.sparks.filter((s) => !s.dead);
  for (const q of G.pows) { q.t -= dt; if (p.alive && Math.hypot(p.x - q.x, p.y - q.y) < 26) { q.dead = true; p.power = q.k; p.powerT = POWERS[q.k].t; K.sfx("power"); pop(p.x, p.y - 34, POWERS[q.k].l, POWERS[q.k].col); } if (q.t <= 0) q.dead = true; }
  G.pows = G.pows.filter((q) => !q.dead);
  // bomb wave
  if (G.bombWave) { const w = G.bombWave; w.r += dt * 1700; for (const e of G.en) if (!e.dead && Math.hypot(e.x - w.x, e.y - w.y) < w.r) kill(e, true); for (const b of G.eb) if (Math.hypot(b.x - w.x, b.y - w.y) < w.r) b.dead = true; G.en = G.en.filter((e) => !e.dead); if (w.r > 2000) G.bombWave = null; }
  gridStep(dt);
  for (const q of TRAIL) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * 3; q.vy *= 1 - dt * 3; q.t -= dt; } TRAIL = TRAIL.filter((q) => q.t > 0);
  for (const q of SP) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * 2.6; q.vy *= 1 - dt * 2.6; q.t -= dt; } SP = SP.filter((q) => q.t > 0);
  for (const q of G.pops) q.t += dt; G.pops = G.pops.filter((q) => q.t < 1);
  if (G.score >= G.nextLife) { G.nextLife += 100000; if (G.mode !== "rush") { G.lives++; K.sfx("life"); pop(p.x, p.y - 50, "EXTRA LIFE", "#ff2bd6"); } }
  if (G.score >= G.nextBomb) { G.nextBomb += 100000; G.bombs++; K.sfx("life"); pop(p.x, p.y - 70, "EXTRA BOMB", "#ffe14d"); }
  const cx = clamp(p.x, L.vw / 2, AW - L.vw / 2), cy = clamp(p.y, L.vh / 2, AH - L.vh / 2); G.cam.x += ((L.vw >= AW ? AW / 2 : cx) - G.cam.x) * Math.min(1, dt * 6); G.cam.y += ((L.vh >= AH ? AH / 2 : cy) - G.cam.y) * Math.min(1, dt * 6);
  G.shake = Math.max(0, G.shake - dt); G.flash = Math.max(0, G.flash - dt);
}
function shoot() {
  const p = G.p, pw = p.power, rate = pw === "rapid" ? 0.055 : 0.1; p.cd = rate;
  const angs = pw === "spread" ? [-0.24, -0.12, 0, 0.12, 0.24] : [-0.045, 0.045], sp = 1250;
  for (const da of angs) { const a = p.aim + da + (Math.random() - 0.5) * 0.02, off = pw === "spread" ? 0 : da * 140; G.bul.push({ x: p.x + Math.cos(p.aim) * 16 - Math.sin(p.aim) * off, y: p.y + Math.sin(p.aim) * 16 + Math.cos(p.aim) * off, vx: Math.cos(a) * sp + p.vx * 0.2, vy: Math.sin(a) * sp + p.vy * 0.2, t: 1.2, dmg: 1, pierce: pw === "pierce" }); }
  K.sfx("shot");
}
function kill(e, bombed) {
  if (e.dead) return; e.dead = true; const T = ETYPES[e.type];
  G.kills++; if (!bombed) { G.score += T.pts * G.mult; }
  const rgb = hexRgb(T.col); sparkBurst(e.x, e.y, rgb, e.type === "nest" ? 70 : 26, e.type === "nest" ? 520 : 380); sparkBurst(e.x, e.y, "255,255,255", 6, 200);
  gridForce(e.x, e.y, e.type === "nest" ? 240 : 120, e.type === "nest" ? 420 : 170);
  K.sfx(e.type === "nest" ? "bigboom" : "boom");
  if (!bombed) { const n = e.type === "nest" ? 14 : e.type === "swarm" || e.type === "shard" ? 1 : 2; for (let k = 0; k < n; k++) { const a = Math.random() * TAU, s = 60 + Math.random() * 140; G.sparks.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 6 }); } }
  if (e.type === "splitter") for (let k = 0; k < 3; k++) { const s = spawn("shard", e.x, e.y); s.warm = 0; const a = (k / 3) * TAU + Math.random(); s.vx = Math.cos(a) * 300; s.vy = Math.sin(a) * 300; }
  if (!bombed && (e.type === "nest" || e.type === "turret" || Math.random() < 0.025)) { const ks = Object.keys(POWERS); G.pows.push({ x: e.x, y: e.y, k: ks[(Math.random() * ks.length) | 0], t: 9 }); }
  if (e.type === "nest") { G.shake = 0.4; pop(e.x, e.y, `+${K.fmt(T.pts * G.mult)}`, "#ff2bd6"); }
}
function die() {
  const p = G.p; if (!p.alive) return;
  p.alive = false; p.dead = 1.6; G.shake = 0.7; G.flash = 0.5; K.sfx("die"); K.vibrate(200);
  sparkBurst(p.x, p.y, "255,255,255", 80, 700); sparkBurst(p.x, p.y, "0,240,255", 60, 500); gridForce(p.x, p.y, 380, 700);
  for (const e of G.en) { sparkBurst(e.x, e.y, hexRgb(ETYPES[e.type].col), 6, 200); } G.en = []; G.eb = [];
  G.mult = Math.max(1, Math.floor(G.mult / 2)); G.sparksN = (G.mult - 1) * 20;
  if (G.mode !== "rush") { G.lives--; if (G.lives <= 0) { const g = G; setTimeout(() => { if (G === g) endGame(); }, 1500); G.over = true; return; } } else G.timeLeft = Math.max(0, G.timeLeft - 5);
}
function respawn() { const p = G.p; p.alive = true; p.inv = 2.5; p.x = AW / 2; p.y = AH / 2; p.vx = p.vy = 0; p.power = null; G.spawnT = 2; K.sfx("respawn"); }
function bomb() {
  if (!G || G.over || !G.p.alive || G.bombs <= 0 || G.bombWave) { if (G && G.bombs <= 0) K.sfx("deny"); return; }
  G.bombs--; G.bombWave = { x: G.p.x, y: G.p.y, r: 0 }; G.flash = 0.6; G.shake = 0.5; G.p.inv = Math.max(G.p.inv, 1); K.sfx("bomb"); gridForce(G.p.x, G.p.y, 600, 1200); K.vibrate(120);
}
function endGame() {
  G.over = true; const key = G.daily ? null : G.mode, best = G.daily ? (SAVE.daily.date === K.today() ? SAVE.daily.best : 0) : SAVE.best[key];
  G.pb = G.score > best; if (G.daily) SAVE.daily = { date: K.today(), best: Math.max(best, G.score) }; else SAVE.best[key] = Math.max(best, G.score);
  SAVE.kills += G.kills; persist(); K.musicLevel(0); K.sfx("over");
  const g = G; setTimeout(() => { if (G === g) results(); }, 900);
}
let TRAIL = [], SP = [];
function sparkBurst(x, y, rgb, n, speed) { for (let k = 0; k < n; k++) { const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.9); SP.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.4 + Math.random() * 0.6, c: rgb }); } if (SP.length > 1800) SP.splice(0, SP.length - 1800); }
function pop(x, y, text, col) { G.pops.push({ x, y, text, col, t: 0 }); }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; }

/* ================= render ================= */
const cv = $("#cv"), ctx = cv.getContext("2d"), bloomC = document.createElement("canvas"), bctx = bloomC.getContext("2d"), canFilter = "filter" in bctx;
const L = { W: 0, H: 0, dpr: 1, s: 1, vw: 1200, vh: 700 };
function layout() { L.W = innerWidth; L.H = innerHeight; L.dpr = K.fit(cv, L.W, L.H).dpr; L.s = clamp(Math.sqrt((L.W * L.H) / 820000), 0.35, 2.4); L.vw = L.W / L.s; L.vh = L.H / L.s; bloomC.width = Math.ceil(L.W / 4); bloomC.height = Math.ceil(L.H / 4); }
addEventListener("resize", layout);
function toWorld(px, py) { return { x: (px - L.W / 2) / L.s + (G ? G.cam.x : AW / 2), y: (py - L.H / 2) / L.s + (G ? G.cam.y : AH / 2) }; }
function shape(e, T) {
  const r = e.r; ctx.beginPath();
  switch (e.type) {
    case "drifter": ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.moveTo(0, -r * 0.45); ctx.lineTo(r * 0.45, 0); ctx.lineTo(0, r * 0.45); ctx.lineTo(-r * 0.45, 0); ctx.closePath(); break;
    case "seeker": case "swarm": case "shard": ctx.moveTo(r * 1.1, 0); ctx.lineTo(-r * 0.8, r * 0.75); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(-r * 0.8, -r * 0.75); ctx.closePath(); break;
    case "dodger": ctx.rect(-r, -r, r * 2, r * 2); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); break;
    case "splitter": for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } break;
    case "orbiter": ctx.arc(0, 0, r, 0, TAU); ctx.moveTo(r * 0.5, 0); ctx.arc(0, 0, r * 0.5, 0, TAU); ctx.moveTo(-r * 1.4, 0); ctx.lineTo(-r, 0); ctx.moveTo(r, 0); ctx.lineTo(r * 1.4, 0); break;
    case "snake": ctx.moveTo(r * 1.2, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.6, 0); ctx.lineTo(0, -r); ctx.closePath(); break;
    case "nest": for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, rr = k % 2 ? r * 0.62 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.moveTo(r * 0.35, 0); ctx.arc(0, 0, r * 0.35, 0, TAU); break;
    case "turret": for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); break;
  }
}
function drawScene(g, dt) {
  const s = L.s, cx = G ? G.cam.x : AW / 2, cy = G ? G.cam.y : AH / 2;
  let shx = 0, shy = 0; if (G && G.shake > 0) { shx = (Math.random() - 0.5) * 22 * G.shake; shy = (Math.random() - 0.5) * 22 * G.shake; }
  g.setTransform(L.dpr * s, 0, 0, L.dpr * s, L.dpr * (L.W / 2 - (cx + shx) * s), L.dpr * (L.H / 2 - (cy + shy) * s));
  // grid
  g.lineWidth = 1.2 / s * Math.min(1.6, s); g.strokeStyle = "rgba(40,90,220,0.32)"; g.beginPath();
  for (let j = 0; j < GR.rows; j++) { const k0 = j * GR.cols; g.moveTo(GR.x[k0], GR.y[k0]); for (let i = 1; i < GR.cols; i++) g.lineTo(GR.x[k0 + i], GR.y[k0 + i]); }
  for (let i = 0; i < GR.cols; i++) { g.moveTo(GR.x[i], GR.y[i]); for (let j = 1; j < GR.rows; j++) g.lineTo(GR.x[j * GR.cols + i], GR.y[j * GR.cols + i]); }
  g.stroke();
  g.strokeStyle = "rgba(120,180,255,0.55)"; g.lineWidth = 2 / s * Math.min(1.6, s); g.beginPath();
  for (let j = 0; j < GR.rows; j++) for (let i = 0; i < GR.cols - 1; i++) { const k = j * GR.cols + i, d = Math.abs(GR.x[k] - GR.ox[k]) + Math.abs(GR.y[k] - GR.oy[k]); if (d > 6) { g.moveTo(GR.x[k], GR.y[k]); g.lineTo(GR.x[k + 1], GR.y[k + 1]); } }
  for (let i = 0; i < GR.cols; i++) for (let j = 0; j < GR.rows - 1; j++) { const k = j * GR.cols + i, d = Math.abs(GR.x[k] - GR.ox[k]) + Math.abs(GR.y[k] - GR.oy[k]); if (d > 6) { g.moveTo(GR.x[k], GR.y[k]); g.lineTo(GR.x[k + GR.cols], GR.y[k + GR.cols]); } }
  g.stroke();
  g.strokeStyle = "#00f0ff"; g.lineWidth = 4; g.strokeRect(0, 0, AW, AH);
  if (!G) return;
  g.globalCompositeOperation = "lighter";
  // sparks + powerups
  for (const q of G.sparks) { const a = Math.min(1, q.t); g.fillStyle = `rgba(61,255,138,${0.7 * a})`; g.fillRect(q.x - 3, q.y - 3, 6, 6); }
  for (const q of G.pows) { const P = POWERS[q.k], pulse = 1 + Math.sin(G.t * 8) * 0.15; g.strokeStyle = P.col; g.lineWidth = 3; g.beginPath(); g.arc(q.x, q.y, 16 * pulse, 0, TAU); g.stroke(); g.fillStyle = P.col; g.font = "700 12px Rajdhani"; g.textAlign = "center"; g.fillText(P.l, q.x, q.y + 30); }
  // particles
  g.lineWidth = 2.2; for (const q of SP) { g.strokeStyle = `rgba(${q.c},${Math.min(1, q.t * 1.6)})`; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035); g.stroke(); }
  for (const q of TRAIL) { g.fillStyle = `rgba(${q.c},${q.t * 2})`; g.fillRect(q.x - 2, q.y - 2, 4, 4); }
  // enemies
  for (const e of G.en) {
    const T = ETYPES[e.type];
    if (e.warm > 0) { const k = e.warm / 0.7; g.strokeStyle = T.col; g.globalAlpha = 0.25 + Math.sin(e.warm * 40) * 0.25; g.lineWidth = 2; g.beginPath(); g.arc(e.x, e.y, e.r + k * 30, 0, TAU); g.stroke(); g.globalAlpha = 1; continue; }
    if (e.type === "snake") { g.strokeStyle = T.col; g.lineWidth = 2.5; for (let k = 0; k < e.body.length; k++) { const s2 = e.body[k], rr = 9 - k * 0.5; g.beginPath(); g.arc(s2.x, s2.y, rr, 0, TAU); g.stroke(); } }
    g.save(); g.translate(e.x, e.y); g.rotate(e.rot || 0); const sc = e.type === "nest" ? 1 + Math.sin(G.t * 5) * 0.06 : 1; g.scale(sc, sc);
    shape(e, T); g.strokeStyle = e.hitT > 0 ? "#ffffff" : T.col; g.lineWidth = 3; g.stroke(); g.globalAlpha = 0.12; g.fillStyle = T.col; g.fill(); g.globalAlpha = 1;
    g.restore(); if (e.hitT > 0) e.hitT -= dt;
  }
  // bullets
  g.lineWidth = 3; g.lineCap = "round";
  for (const b of G.bul) { g.strokeStyle = b.pierce ? "#ff8bf0" : "#fff3b0"; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014); g.stroke(); }
  for (const b of G.eb) { g.fillStyle = "#ff3b5c"; g.beginPath(); g.arc(b.x, b.y, 6, 0, TAU); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(b.x, b.y, 2.5, 0, TAU); g.fill(); }
  g.lineCap = "butt";
  // player
  const p = G.p;
  if (p.alive && !(p.inv > 0 && Math.floor(p.inv * 12) % 2)) {
    g.save(); g.translate(p.x, p.y); g.rotate(p.aim);
    g.strokeStyle = "#ffffff"; g.lineWidth = 3; g.beginPath(); g.moveTo(17, 0); g.lineTo(-10, 12); g.lineTo(-4, 0); g.lineTo(-10, -12); g.closePath(); g.stroke();
    g.strokeStyle = p.power ? POWERS[p.power].col : "#00f0ff"; g.beginPath(); g.moveTo(10, 0); g.lineTo(-5, 6); g.lineTo(-2, 0); g.lineTo(-5, -6); g.closePath(); g.stroke();
    g.restore();
    if (p.inv > 0) { g.strokeStyle = `rgba(0,240,255,${0.5})`; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 26, 0, TAU); g.stroke(); }
  }
  if (G.bombWave) { const w = G.bombWave; g.strokeStyle = `rgba(255,43,214,${Math.max(0, 1 - w.r / 2000)})`; g.lineWidth = 14; g.beginPath(); g.arc(w.x, w.y, w.r, 0, TAU); g.stroke(); g.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.6 - w.r / 2000)})`; g.lineWidth = 4; g.stroke(); }
  for (const q of G.pops) { g.globalAlpha = 1 - q.t; g.fillStyle = q.col; g.font = "700 22px Audiowide"; g.textAlign = "center"; g.fillText(q.text, q.x, q.y - q.t * 40); g.globalAlpha = 1; }
  g.globalCompositeOperation = "source-over";
}
function render(dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#02030a"; ctx.fillRect(0, 0, cv.width, cv.height);
  drawScene(ctx, dt);
  if (SAVE.bloom && canFilter) {
    bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, bloomC.width, bloomC.height); bctx.filter = "blur(3px)"; bctx.drawImage(cv, 0, 0, bloomC.width, bloomC.height); bctx.filter = "none";
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.85; ctx.drawImage(bloomC, 0, 0, cv.width, cv.height); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  if (G && G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.35})`; ctx.fillRect(0, 0, L.W, L.H); }
  if (!G) return;
  // HUD
  ctx.textBaseline = "top"; ctx.font = `400 ${Math.max(18, 26 * Math.min(1.3, L.s))}px Audiowide`; ctx.textAlign = "left"; ctx.fillStyle = "#eaf6ff"; ctx.fillText(K.fmt(G.score), 16, 12);
  ctx.font = `700 ${Math.max(14, 18 * Math.min(1.3, L.s))}px Rajdhani`; ctx.fillStyle = "#3dff8a"; ctx.fillText(`×${G.mult}  MULTIPLIER`, 16, 12 + 34 * Math.min(1.3, L.s));
  ctx.textAlign = "center"; ctx.fillStyle = "#8fb3d6";
  if (G.mode === "rush") { ctx.font = `400 ${Math.max(18, 26 * Math.min(1.3, L.s))}px Audiowide`; ctx.fillStyle = G.timeLeft < 15 ? "#ff3b5c" : "#eaf6ff"; ctx.fillText(K.fmtTime(G.timeLeft), L.W / 2, 12); }
  const best = G.daily ? (SAVE.daily.date === K.today() ? SAVE.daily.best : 0) : SAVE.best[G.mode]; ctx.font = `700 ${Math.max(13, 16 * Math.min(1.3, L.s))}px Rajdhani`; ctx.fillStyle = "#8fb3d6"; ctx.fillText(`BEST ${K.fmt(Math.max(best, G.score))}`, L.W / 2, G.mode === "rush" ? 46 : 14);
  ctx.textAlign = "right"; const rx = L.W - 64;
  if (G.mode !== "rush") for (let i = 0; i < Math.min(8, G.lives); i++) { ctx.save(); ctx.translate(rx - i * 22, 26); ctx.rotate(-Math.PI / 2); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, 6); ctx.lineTo(-2, 0); ctx.lineTo(-5, -6); ctx.closePath(); ctx.stroke(); ctx.restore(); }
  for (let i = 0; i < Math.min(8, G.bombs); i++) { ctx.strokeStyle = "#ff2bd6"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rx - i * 22, 54, 7, 0, TAU); ctx.stroke(); }
  if (G.p.power) { ctx.textAlign = "center"; ctx.fillStyle = POWERS[G.p.power].col; ctx.font = "700 16px Rajdhani"; ctx.fillText(`${POWERS[G.p.power].l} ${G.p.powerT.toFixed(1)}s`, L.W / 2, L.H - 30); }
  // touch sticks
  for (const st of [IN.lt, IN.rt]) if (st) { ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(st.x0, st.y0, 54, 0, TAU); ctx.stroke(); ctx.fillStyle = "rgba(0,240,255,0.3)"; ctx.beginPath(); ctx.arc(st.x0 + st.dx * 54, st.y0 + st.dy * 54, 22, 0, TAU); ctx.fill(); }
}

/* ================= input ================= */
cv.addEventListener("pointerdown", (e) => {
  if (!G || K.ui.active()) return; K.audio();
  if (e.pointerType === "touch") { const st = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }; if (e.clientX < L.W / 2) IN.lt = st; else IN.rt = st; try { cv.setPointerCapture(e.pointerId); } catch {} $("#bombBtn").hidden = false; return; }
  IN.mouseAim = true; IN.mx = e.clientX; IN.my = e.clientY; if (e.button === 2) bomb(); else IN.firing = true;
});
cv.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") { for (const st of [IN.lt, IN.rt]) if (st && st.id === e.pointerId) { let dx = (e.clientX - st.x0) / 54, dy = (e.clientY - st.y0) / 54; const d = Math.hypot(dx, dy); if (d > 1) { dx /= d; dy /= d; } st.dx = dx; st.dy = dy; } return; }
  IN.mouseAim = true; IN.mx = e.clientX; IN.my = e.clientY;
});
const endTouch = (e) => { if (IN.lt && IN.lt.id === e.pointerId) IN.lt = null; if (IN.rt && IN.rt.id === e.pointerId) IN.rt = null; if (e.pointerType !== "touch" && e.button !== 2) IN.firing = false; };
cv.addEventListener("pointerup", endTouch); cv.addEventListener("pointercancel", endTouch);
cv.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("keydown", (e) => { if (!G || K.ui.active()) return; if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "KeyE") { e.preventDefault(); bomb(); } else if (e.code === "Escape" || e.code === "KeyP") pause(); if (e.code.startsWith("Arrow")) e.preventDefault(); });
$("#bombBtn").addEventListener("pointerdown", (e) => { e.stopPropagation(); bomb(); });
$("#pauseBtn").onclick = () => pause();

/* ================= audio ================= */
K.defineSfx({
  shot: (t) => K.voice(880 + Math.random() * 60, t, 0.04, { duty: 0.125, vol: 0.016, slide: 0.6 }),
  hit: (t) => K.voice(300, t, 0.03, { type: "square", vol: 0.025, lp: 1500 }),
  boom: (t) => { K.noise(t, 0.25, { filter: "lowpass", freq: 1600, slide: 0.25, vol: 0.09 }); K.voice(140 + Math.random() * 60, t, 0.16, { type: "triangle", vol: 0.06, slide: 0.4 }); },
  bigboom: (t) => { K.noise(t, 0.7, { filter: "lowpass", freq: 900, slide: 0.2, vol: 0.2 }); K.voice(70, t, 0.6, { type: "sine", vol: 0.16, slide: 0.4 }); },
  die: (t) => { K.noise(t, 1.1, { filter: "lowpass", freq: 2000, slide: 0.1, vol: 0.22 }); K.voice(220, t, 1, { type: "sawtooth", vol: 0.06, slide: 0.15, lp: 1400 }); },
  bomb: (t) => { K.noise(t, 1.2, { filter: "bandpass", freq: 300, slide: 6, vol: 0.2, q: 0.6 }); K.voice(55, t, 1, { type: "sine", vol: 0.2, slide: 0.5 }); },
  spark: (t) => K.voice(1600 + Math.random() * 400, t, 0.03, { type: "sine", vol: 0.02 }),
  multup: (t) => K.notes(t, [988, 1318], 0.05, { type: "triangle", vol: 0.04, len: 0.12 }),
  power: (t) => K.notes(t, [523, 784, 1046, 1568], 0.045, { duty: 0.25, vol: 0.045, len: 0.14 }),
  spawn: (t) => K.voice(200, t, 0.2, { type: "triangle", vol: 0.03, slide: 2.5 }),
  nest: (t) => K.voice(160, t, 0.25, { type: "sawtooth", vol: 0.03, slide: 1.8, lp: 900 }),
  eshot: (t) => K.voice(500, t, 0.1, { type: "square", vol: 0.025, slide: 0.5, lp: 1800 }),
  life: (t) => K.notes(t, [659, 880, 1318], 0.07, { duty: 0.25, vol: 0.05, len: 0.25 }),
  respawn: (t) => K.voice(300, t, 0.4, { type: "triangle", vol: 0.05, slide: 3 }),
  start: (t) => K.notes(t, [330, 440, 659], 0.08, { duty: 0.25, vol: 0.05, len: 0.3 }),
  over: (t) => K.notes(t, [440, 330, 247, 165], 0.18, { type: "sawtooth", vol: 0.05, len: 0.5, lp: 1500 }),
}, { shot: 0.045, hit: 0.03, spark: 0.025, boom: 0.03, spawn: 0.1 });
K.songs({ surge: { bpm: 128, chords: ["Am", "F", "C", "G", "Am", "F", "C", "E"], bass: "R R O R R R O R R R O R R R O R", bassWave: "sawtooth", bassVol: 0.08, bassLp: 900, drums: "k . h . s . h k k . h . s . h h", pad: true, padVol: 0.016, arp: true, arpVol: 0.016, arpPat: [0, 1, 2, 3, 2, 1, 0, 2],
  lead: ["a5 - - . e5 - c5 .", "f5 - - . a5 - c6 .", "e5 - - . g5 - c6 .", "b5 - - - g5 - - .", "a5 - c6 . e6 - d6 .", "c6 - a5 . f5 - - .", "g5 - e5 . c5 - e5 .", "g#5 - - - b5 - - -"], leadWave: 0.25, leadVol: 0.035 } });

/* ================= screens ================= */
function title() {
  G = null; $("#pauseBtn").hidden = true; $("#bombBtn").hidden = true; K.playSong("surge", 1); gridInit();
  const dd = SAVE.daily.date === K.today() ? SAVE.daily.best : 0;
  K.ui.show(`<div class="logo">NEON SURGE</div><p class="k-sub">Fly, shoot, survive. Grab the green sparks to raise your multiplier.</p>
    <div class="modes"><button class="k-btn mode" data-a="play" data-m="arena" autofocus><b>ARENA</b><span>Three lives. The surge never stops.</span><em>${SAVE.best.arena ? "Best " + K.fmt(SAVE.best.arena) : "No score yet"}</em></button>
    <button class="k-btn mode" data-a="play" data-m="rush"><b>RUSH</b><span>Three minutes. Dying costs five seconds.</span><em>${SAVE.best.rush ? "Best " + K.fmt(SAVE.best.rush) : "No score yet"}</em></button>
    <button class="k-btn mode" data-a="play" data-m="daily"><b>DAILY</b><span>Today's spawn order, the same for everyone.</span><em>${dd ? "Today " + K.fmt(dd) : "Not played today"}</em></button></div>
    <div class="k-row"><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>`, { cls: "soft" });
}
function pause() { if (!G || G.over || K.ui.active()) return; K.ui.show(`<div class="logo" style="font-size:2.4em">PAUSED</div><p class="k-sub">${K.fmt(G.score)} points</p><div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="play" data-m="${G.mode}">Restart</button><button class="k-btn" data-a="settings" data-from="menu">Settings</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "resume" }); }
function results() {
  K.ui.show(`<div class="logo" style="font-size:2.6em">${G.mode === "rush" ? "TIME!" : "GAME OVER"}</div><p class="k-sub">${{ arena: "Arena", rush: "Rush", daily: "Daily" }[G.mode]} · survived ${K.fmtTime(G.t)}</p>
    <div class="k-stats"><div class="k-stat"><small>Score</small><b>${K.fmt(G.score)}</b></div><div class="k-stat"><small>Kills</small><b>${G.kills}</b></div><div class="k-stat"><small>Multiplier</small><b>×${G.mult}</b></div></div>${G.pb ? `<b style="color:var(--gold)">New best!</b>` : ""}
    <div class="k-row"><button class="k-btn primary" data-a="play" data-m="${G.mode}" autofocus>Play again</button>${G.daily ? `<button class="k-btn" data-a="share">Copy result</button>` : ""}<button class="k-btn" data-a="title">Main menu</button></div><div class="k-msg" id="msg"></div>`, { back: "title" });
}
function settings(from) {
  const back = from === "menu" ? "pauseback" : "title", row = (k, l) => `<div class="k-opt"><span>${l}</span><button class="k-btn small" data-a="tog" data-k="${k}">${SAVE[k] ? "On" : "Off"}</button></div>`;
  const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center">${row("autofire", "Fire automatically toward the mouse")}${row("bloom", "Glow effect")}${K.ui.settingsRows()}</div>`, { back, cls: "top" });
  K.ui.bindSettings(s);
}
function help() {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="k-help"><div><b>Move and shoot</b>Move with WASD and aim with the mouse. Arrow keys also shoot in 8 directions.</div><div><b>Sparks</b>Destroyed enemies drop green sparks. Every 20 raise your multiplier. Dying halves it.</div>
    <div><b>Bombs</b>Space, Shift or right-click sends out a shockwave that clears the screen. You start with three.</div><div><b>Enemies</b>Snakes only take damage on the head. Nests keep releasing swarms until destroyed. Splitters break into shards.</div>
    <div><b>Controller</b>Left stick moves, right stick aims and fires, bumpers or A bomb.</div><div class="k-touchonly"><b>Touch</b>Left thumb moves, right thumb aims and fires. Tap BOMB to clear the screen.</div></div>`, { back: "title", cls: "top" });
}
K.ui.on((a, d) => {
  switch (a) {
    case "title": K.sfx("ok"); return title();
    case "play": K.sfx("ok"); return newGame(d.m);
    case "resume": K.ui.hide(); return;
    case "pauseback": K.ui.hide(); return pause();
    case "settings": K.sfx("ok"); return settings(d.from);
    case "help": K.sfx("ok"); return help();
    case "tog": SAVE[d.k] = !SAVE[d.k]; persist(); return settings(G && !G.over ? "menu" : "");
    case "share": K.copy(`NEON SURGE · Daily ${K.today()}\nScore ${K.fmt(G.score)} · ${G.kills} kills · ×${G.mult}`).then((ok) => { const m = $("#msg"); if (m) m.textContent = ok ? "Copied to clipboard." : "Couldn't copy."; }); return;
  }
});
K.onPause(() => { if (G && !G.over && !K.ui.active()) pause(); });

/* ================= boot ================= */
layout(); gridInit(); title();
const fixed = K.fixed(60);
K.loop((dt) => {
  if (G && !K.ui.active()) fixed(dt, update); else if (!G) { gridStep(dt); if (Math.random() < dt * 1.2) gridForce(Math.random() * AW, Math.random() * AH, 200, 260); }
  render(dt);
});
