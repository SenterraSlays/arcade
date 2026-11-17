"use strict";
/* STARLANCE — vertical bullet-hell shooter. Enemies and bosses are scripted with coroutines. */
const { $, $$, clamp, lerp, TAU } = K;
const FW = 480, FH = 640, COLLECT_Y = 150;
const DIFFS = { easy: { name: "Easy", s: 0.78, n: 0.6, lives: 5, desc: "Slower, sparser bullets" }, normal: { name: "Normal", s: 1, n: 1, lives: 3, desc: "The intended challenge" }, hard: { name: "Hard", s: 1.14, n: 1.4, lives: 3, desc: "Denser and faster" } };
const SAVE = K.load("starlance.v1", { diff: "normal", hi: { easy: 0, normal: 0, hard: 0 }, reached: 1, cleared: { easy: false, normal: false, hard: false }, autofire: true });
const persist = () => K.save("starlance.v1", SAVE);
const COLS = { red: "255,70,90", orange: "255,150,60", yellow: "255,225,90", green: "110,255,150", cyan: "90,230,255", blue: "90,140,255", purple: "190,110,255", pink: "255,110,210", white: "235,240,255" };
const SHR = { orb: 5, rice: 4, big: 11, star: 6, small: 3.5 };

/* ================= state ================= */
let G = null, D = DIFFS.normal;
const B = [], E = [], S = [], IT = [], LZ = [];
function newGame(stage = 1) {
  D = DIFFS[SAVE.diff];
  G = { stage, score: 0, lives: D.lives, bombs: 3, power: stage > 1 ? 2.5 : 1, graze: 0, p: { x: FW / 2, y: FH - 70, inv: 2, alive: true, focus: false, cd: 0, dead: 0, bombT: 0 }, t: 0, boss: null, phase: null, banner: null, over: false, cont: 0, extends: [1e6, 3e6, 6e6], shake: 0, flash: 0, practice: stage > 1, phaseClean: true, clear: false };
  B.length = E.length = S.length = IT.length = LZ.length = 0;
  startStage(stage);
  K.ui.hide(); $("#pauseBtn").hidden = false; touchBtns(); layout();
}
function startStage(n) { NEB = null; G.stage = n; G.stageCo = [stage1, stage2, stage3][n - 1](); G.stageWait = 0; G.t = 0; K.playSong("st" + n, 3); K.banner(`STAGE ${n}`, ["Twilight Orbit", "Nebula Drift", "Event Horizon"][n - 1], 2200); SAVE.reached = Math.max(SAVE.reached, n); persist(); }
const P = () => G.p;
const angTo = (x, y) => Math.atan2(P().y - y, P().x - x);
const RND = Math.random;

/* ================= bullets + patterns ================= */
function shot(x, y, a, spd, o = {}) {
  const sp = spd * D.s, b = { x, y, a, spd: sp, r: SHR[o.shape || "orb"], shape: o.shape || "orb", col: o.col || "red", t: 0, acc: (o.acc || 0) * D.s, av: o.av || 0, max: o.max ? o.max * D.s : 9999, min: o.min !== undefined ? o.min * D.s : 0, fn: o.fn, g: 0 };
  B.push(b); return b;
}
const cnt = (n) => Math.max(1, Math.round(n * D.n));
function ring(x, y, n, spd, o = {}) { n = cnt(n); const off = o.off ?? RND() * TAU; for (let k = 0; k < n; k++) shot(x, y, off + (k / n) * TAU, spd, o); }
function fan(x, y, a0, n, spread, spd, o = {}) { n = Math.max(1, Math.round(n * Math.sqrt(D.n))); if (n % 2 === 0 && o.odd) n++; for (let k = 0; k < n; k++) shot(x, y, a0 + (k - (n - 1) / 2) * spread, spd, o); }
function aimed(e, n, spread, spd, o = {}) { fan(e.x, e.y, angTo(e.x, e.y), n, spread, spd, { odd: true, ...o }); }
function laser(x, y, a, o = {}) { LZ.push({ x, y, a, w: o.w || 14, warn: o.warn || 0.9, life: o.life || 0.7, t: 0, col: o.col || "pink", len: 900, follow: o.follow }); K.sfx("charge"); }

/* ================= enemies + coroutines ================= */
function enemy(x, y, o, script) {
  const e = { x, y, hp: o.hp || 4, max: o.hp || 4, r: o.r || 14, t: 0, kind: o.kind || "dart", col: o.col || "pink", pts: o.pts || 100, drop: o.drop ?? [1, 2], mv: null, vx: 0, vy: 0, wait: 0, alive: true, boss: !!o.boss, hitT: 0, inv: false };
  e.co = script ? script(e) : null; E.push(e); return e;
}
function move(e, tx, ty, T, ease = K.ease.inOutCubic) { e.mv = { x0: e.x, y0: e.y, tx, ty, t: 0, T, ease }; e.vx = e.vy = 0; }
function stepCo(o, dt, key = "co", wk = "wait") { const gen = o[key]; if (!gen) return; if (o[wk] > 0) { o[wk] -= dt; return; } const r = gen.next(); if (o[key] !== gen) return; if (r.done) o[key] = null; else o[wk] = r.value || 0; }
function* leave(e, vx = 0, vy = -160) { e.mv = null; e.vx = vx; e.vy = vy; while (e.alive && e.y > -60 && e.y < FH + 60 && e.x > -60 && e.x < FW + 60) yield 0; e.alive = false; e.silent = true; }
/* popcorn */
function dart(side, y0, delay = 0, shots = 1) {
  return enemy(side < 0 ? -20 : FW + 20, y0, { hp: 3, r: 11, kind: "dart", col: side < 0 ? "cyan" : "pink", pts: 120 }, function* (e) {
    yield delay; e.vx = -side * 190; e.vy = 50;
    for (let k = 0; k < 70; k++) { e.vy += 2.2; if (k === 22 && shots) for (let s = 0; s < shots; s++) aimed(e, 1, 0, 150 + s * 30, { col: "yellow", shape: "rice" }); yield 0; }
    yield* leave(e, e.vx, 150);
  });
}
function orb(x, delay = 0, n = 14) {
  return enemy(x, -20, { hp: 10, r: 15, kind: "orb", col: "purple", pts: 300, drop: [2, 3] }, function* (e) {
    yield delay; move(e, x, 110 + RND() * 60, 1.1); yield 1.2;
    for (let k = 0; k < 3; k++) { ring(e.x, e.y, n, 110 + k * 12, { col: k % 2 ? "blue" : "purple", off: k * 0.12 }); K.sfx("eshot"); yield 0.7; }
    yield* leave(e, 0, -110);
  });
}
function spinner(x, dir = 1, dur = 4) {
  return enemy(x, -24, { hp: 26, r: 17, kind: "spinner", col: "green", pts: 600, drop: [3, 4] }, function* (e) {
    move(e, x, 150, 1.2); yield 1.3; let a = 0;
    for (let t = 0; t < dur; t += 0.09) { for (let k = 0; k < 3; k++) shot(e.x, e.y, a + (k / 3) * TAU, 120, { col: "green", shape: "rice" }); a += 0.23 * dir; if (((t * 100) | 0) % 27 === 0) K.sfx("eshot"); yield 0.09; }
    yield* leave(e, 0, -90);
  });
}
function diver(x, delay = 0) {
  return enemy(x, -20, { hp: 4, r: 11, kind: "diver", col: "orange", pts: 150 }, function* (e) {
    yield delay; e.vy = 260; for (let k = 0; k < 40; k++) { e.vy *= 0.96; yield 0; }
    ring(e.x, e.y, 8, 95, { col: "orange", shape: "small" }); yield 0.3; e.vx = (P().x > e.x ? 1 : -1) * 60; e.vy = 230; yield* leave(e, e.vx, 230);
  });
}
function tank(x, hp, dur, pattern) {
  return enemy(x, -40, { hp, r: 26, kind: "tank", col: "red", pts: 5000, drop: [6, 10] }, function* (e) {
    move(e, x, 140, 1.6); yield 1.7; const t0 = G.t;
    while (G.t - t0 < dur) yield* pattern(e);
    yield* leave(e, 0, -70);
  });
}
/* ================= bosses ================= */
function makeBoss(name, title, col, phases) {
  const b = enemy(FW / 2, -60, { hp: 1, r: 30, kind: "boss", col, pts: 0, drop: 0, boss: true }, null); b.inv = true; b.name = name; b.title = title; b.phases = phases; G.boss = b; return b;
}
function* runBoss(b) {
  move(b, FW / 2, 130, 1.8); yield 2;
  K.banner(b.name, b.title, 2200); yield 1.6;
  for (let i = 0; i < b.phases.length; i++) {
    const ph = b.phases[i]; b.hp = b.max = Math.round(ph.hp * 1.35 * (0.85 + D.n * 0.15)); b.inv = false; G.phaseClean = true;
    G.phase = { name: ph.name, T: ph.time, t: 0, i, n: b.phases.length }; G.banner = { text: ph.name, t: 0 }; K.sfx("spell");
    b.co = ph.run(b); b.wait = 0;
    while (b.hp > 0 && G.phase.t < ph.time && G.p) yield 0;
    const timedOut = b.hp > 0; b.inv = true; b.co = null; b.mv = null;
    clearBullets(true); LZ.length = 0;
    if (!timedOut && G.phaseClean) { const bonus = 50000 * G.stage * (i + 1); addScore(bonus); pop(FW / 2, 200, `SPELL BONUS ${K.fmt(bonus)}`, "#ffe08a"); K.sfx("bonus"); }
    for (let k = 0; k < 12; k++) IT.push({ x: b.x + (RND() - 0.5) * 80, y: b.y + (RND() - 0.5) * 50, k: k < 2 ? "P" : "pt", vy: -120 - RND() * 80, auto: false });
    G.phase = null; burst(b.x, b.y, "white", 40, 300); K.sfx("phase"); G.shake = 0.3;
    if (i < b.phases.length - 1) { move(b, FW / 2, 130, 1); yield 1.4; }
  }
  b.alive = false; G.boss = null; burst(b.x, b.y, b.col, 120, 520); burst(b.x, b.y, "white", 60, 300); G.flash = 1; G.shake = 0.8; K.sfx("bossdie"); addScore(100000 * G.stage);
  yield 2.5;
}
function wander(b, sp = 0.8) { if (!b.mv && RND() < 0.02) move(b, clamp(b.x + (RND() - 0.5) * 160, 90, FW - 90), clamp(110 + RND() * 70, 80, 200), sp + RND()); }
/* ---- stage 1 ---- */
const BOSS1 = () => [
  { name: "Ember Fan", hp: 260, time: 32, *run(b) { for (let k = 0; ; k++) { wander(b); aimed(b, 7, 0.16, 170, { col: "orange", shape: "rice" }); K.sfx("eshot"); if (k % 2 === 0) ring(b.x, b.y, 22, 95, { col: "red" }); yield 0.85; } } },
  { name: "Halo Bloom", hp: 340, time: 40, *run(b) { move(b, FW / 2, 150, 1); yield 1; let a = 0; for (let k = 0; ; k++) { const n = cnt(5); for (let i = 0; i < n; i++) { shot(b.x, b.y, a + (i / n) * TAU, 130, { col: "pink", shape: "rice" }); shot(b.x, b.y, -a * 1.3 + (i / n) * TAU, 105, { col: "cyan" }); } a += 0.19; if (k % 6 === 0) K.sfx("eshot"); yield 0.11; } } },
  { name: "Starfall", hp: 380, time: 42, *run(b) { for (let k = 0; ; k++) { wander(b, 1.2); for (let i = 0; i < cnt(3); i++) shot(20 + RND() * (FW - 40), -10, Math.PI / 2 + (RND() - 0.5) * 0.4, 40, { col: ["yellow", "white", "orange"][(RND() * 3) | 0], shape: "star", acc: 70, max: 230 }); if (k % 9 === 0) { aimed(b, 3, 0.2, 200, { col: "red", shape: "big" }); K.sfx("eshot"); } yield 0.12; } } },
];
function* stage1() {
  yield 2.5;
  for (const s of [-1, 1]) { for (let k = 0; k < 5; k++) dart(s, 90 + k * 22, k * 0.35); yield 3.4; }
  orb(130); orb(350, 0.6); yield 5.5;
  for (let k = 0; k < 6; k++) diver(60 + k * 72, k * 0.25); yield 4;
  for (let k = 0; k < 6; k++) { dart(-1, 70 + k * 18, k * 0.3); dart(1, 130 + k * 18, k * 0.3); } yield 5;
  spinner(FW / 2, 1, 4.5); yield 7;
  orb(100); orb(240, 0.4); orb(380, 0.8); yield 6;
  tank(FW / 2, 160, 14, function* (e) { aimed(e, 5, 0.22, 160, { col: "red", shape: "rice" }); yield 0.5; ring(e.x, e.y, 18, 100, { col: "orange" }); K.sfx("eshot"); yield 0.9; e.x += Math.sin(G.t) * 2; });
  while (E.some((e) => e.kind === "tank" && e.alive)) yield 0;
  yield 2;
  for (let k = 0; k < 8; k++) diver(40 + k * 57, k * 0.18); yield 3.5;
  spinner(130, 1, 4); spinner(350, -1, 4); yield 8;
  for (let w = 0; w < 3; w++) { for (let k = 0; k < 5; k++) dart(w % 2 ? 1 : -1, 80 + k * 26, k * 0.25, 2); yield 2.6; }
  yield 3; clearBullets(false);
  const b = makeBoss("LUMEN", "Warden of the Lantern Stars", "orange", BOSS1()); yield* runBoss(b);
  yield* stageClear();
}
/* ---- stage 2 ---- */
const BOSS2 = () => [
  { name: "Tidal Spiral", hp: 380, time: 40, *run(b) { let a = 0; for (let k = 0; ; k++) { const arms = cnt(4); for (let i = 0; i < arms; i++) shot(b.x, b.y, a + (i / arms) * TAU, 90, { col: "blue", acc: 30, max: 180 }); a += 0.16 + Math.sin(k * 0.05) * 0.14; if (k % 8 === 0) K.sfx("eshot"); yield 0.08; } } },
  { name: "Comet Garden", hp: 420, time: 44, *run(b) { for (let k = 0; ; k++) { wander(b); const dir = k % 2 ? 1 : -1; ring(b.x, b.y, 20, 135, { col: dir > 0 ? "cyan" : "purple", shape: "rice", av: 0.75 * dir }); K.sfx("eshot"); yield 0.62; } } },
  { name: "Split Prism", hp: 420, time: 44, *run(b) { for (let k = 0; ; k++) { wander(b, 1.4); const s = shot(b.x, b.y, angTo(b.x, b.y) + (RND() - 0.5) * 0.5, 120, { col: "white", shape: "big" }); s.fn = (q) => { if (q.t > 1.1) { q.dead = true; ring(q.x, q.y, 12, 120, { col: ["red", "yellow", "green", "cyan", "purple"][k % 5], shape: "small" }); } }; K.sfx("eshot"); yield 0.5; } } },
  { name: "Crescent Waltz", hp: 480, time: 48, *run(b) { move(b, FW / 2, 140, 1); yield 1; for (let k = 0; ; k++) { const side = k % 2 ? 1 : -1, base = Math.PI / 2 - side * 1.1; for (let i = 0; i < cnt(14); i++) shot(b.x, b.y, base + side * i * 0.16, 160 - i * 4, { col: side > 0 ? "pink" : "blue", shape: "rice" }); if (k % 3 === 0) aimed(b, 3, 0.12, 210, { col: "white" }); K.sfx("eshot"); yield 0.45; } } },
];
function* stage2() {
  yield 2.5;
  for (let k = 0; k < 4; k++) { orb(80 + k * 107, k * 0.5, 16); } yield 6;
  spinner(120, 1, 3.5); yield 1.5; spinner(360, -1, 3.5); yield 6;
  for (let w = 0; w < 4; w++) { for (let k = 0; k < 6; k++) dart(w % 2 ? 1 : -1, 60 + k * 20, k * 0.22, 2); yield 2.2; }
  tank(150, 220, 12, function* (e) { let a = 0; for (let k = 0; k < 20; k++) { shot(e.x, e.y, a, 110, { col: "green", shape: "rice", av: 0.4 }); shot(e.x, e.y, a + Math.PI, 110, { col: "green", shape: "rice", av: 0.4 }); a += 0.33; yield 0.07; } aimed(e, 5, 0.15, 190, { col: "red" }); yield 0.6; });
  yield 3;
  tank(330, 220, 10, function* (e) { ring(e.x, e.y, 24, 100, { col: "purple", av: -0.3 }); K.sfx("eshot"); yield 0.7; });
  while (E.some((e) => e.kind === "tank" && e.alive)) yield 0;
  yield 1.5;
  for (let k = 0; k < 10; k++) diver(30 + k * 46, k * 0.15); yield 3;
  for (let k = 0; k < 10; k++) diver(450 - k * 46, k * 0.15); yield 4;
  spinner(FW / 2, 1, 5); orb(90, 1); orb(390, 1.5); yield 9;
  yield 2; clearBullets(false);
  const b = makeBoss("CORVINA", "Keeper of the Drift", "cyan", BOSS2()); yield* runBoss(b);
  yield* stageClear();
}
/* ---- stage 3 ---- */
const BOSS3 = () => [
  { name: "Nightglass", hp: 460, time: 44, *run(b) { let a = 0; for (let k = 0; ; k++) { const n = cnt(26), gap = (k * 0.7) % TAU; for (let i = 0; i < n; i++) { const ang = a + (i / n) * TAU; if (Math.abs(((ang - gap + Math.PI) % TAU + TAU) % TAU - Math.PI) < 0.35) continue; shot(b.x, b.y, ang, 120, { col: "purple" }); } a += 0.09; K.sfx("eshot"); yield 0.55; } } },
  { name: "Orbit Choir", hp: 500, time: 46, *run(b) { for (let k = 0; ; k++) { wander(b); const n = cnt(12), off = RND() * TAU; for (let i = 0; i < n; i++) { const ang = off + (i / n) * TAU; const s = shot(b.x + Math.cos(ang) * 50, b.y + Math.sin(ang) * 50, ang + Math.PI / 2, 120, { col: "yellow", av: 2.4 }); s.fn = (q) => { if (q.t > 0.9 && !q.freed) { q.freed = true; q.av = 0; q.a = Math.atan2(G.p.y - q.y, G.p.x - q.x); q.spd = 170 * D.s; } }; } K.sfx("eshot"); yield 1.1; } } },
  { name: "Event Horizon", hp: 520, time: 48, *run(b) { move(b, FW / 2, 200, 1); yield 1; for (let k = 0; ; k++) { const n = cnt(18), off = RND() * TAU; for (let i = 0; i < n; i++) { const ang = off + (i / n) * TAU, r = 330; shot(b.x + Math.cos(ang) * r, b.y + Math.sin(ang) * r, ang + Math.PI, 70, { col: "blue", acc: 40, max: 160 }); } if (k % 2) aimed(b, 5, 0.14, 180, { col: "red", shape: "rice" }); K.sfx("eshot"); yield 0.9; } } },
  { name: "Collapse", hp: 540, time: 48, *run(b) { let a = 0; for (let k = 0; ; k++) { wander(b, 1.6); shot(b.x, b.y, a, 100, { col: "pink", shape: "rice" }); shot(b.x, b.y, -a, 100, { col: "cyan", shape: "rice" }); a += 0.37; if (k % 4 === 0) for (let i = 0; i < cnt(2); i++) shot(b.x, b.y, RND() * TAU, 60 + RND() * 80, { col: "white", shape: "big" }); yield 0.05; } } },
  { name: "Lance of Dawn", hp: 700, time: 60, *run(b) { move(b, FW / 2, 120, 1); yield 1.2; for (let k = 0; ; k++) { const base = angTo(b.x, b.y); for (const da of k % 2 ? [-0.35, 0.35] : [-0.6, 0, 0.6]) laser(b.x, b.y, base + da, { col: "pink", w: 12 }); yield 1.0; ring(b.x, b.y, 30, 115, { col: "yellow", shape: "star" }); K.sfx("eshot"); yield 0.6; ring(b.x, b.y, 30, 95, { col: "orange", off: 0.1 }); yield 0.9; } } },
];
function* stage3() {
  yield 2.5;
  for (let w = 0; w < 4; w++) { for (let k = 0; k < 7; k++) dart(w % 2 ? 1 : -1, 60 + k * 18, k * 0.2, 2); orb(w % 2 ? 120 : 360, 0.4, 18); yield 3; }
  spinner(110, 1, 5); spinner(370, -1, 5); yield 8;
  tank(FW / 2, 320, 16, function* (e) { let a = 0; for (let k = 0; k < 24; k++) { for (let i = 0; i < 4; i++) shot(e.x, e.y, a + (i / 4) * TAU, 120, { col: "red", shape: "rice" }); a += 0.21; yield 0.06; } ring(e.x, e.y, 28, 90, { col: "white" }); K.sfx("eshot"); yield 0.8; });
  while (E.some((e) => e.kind === "tank" && e.alive)) yield 0;
  yield 1.5;
  for (let k = 0; k < 12; k++) diver(20 + k * 40, k * 0.12); yield 3;
  for (let w = 0; w < 3; w++) { orb(80, 0, 20); orb(240, 0.3, 20); orb(400, 0.6, 20); yield 4; }
  spinner(FW / 2, -1, 6); yield 9;
  yield 2; clearBullets(false);
  const b = makeBoss("NYX", "The Last Light", "purple", BOSS3()); yield* runBoss(b);
  yield* stageClear();
}
function* stageClear() {
  clearBullets(true); const bonus = 200000 * G.stage + G.graze * 100 + G.lives * 50000; addScore(bonus); K.sfx("clear");
  K.banner("STAGE CLEAR", `Bonus ${K.fmt(bonus)}`, 2600); yield 3.2;
  if (G.stage < 3) startStage(G.stage + 1); else { G.clear = true; finish(true); }
}

/* ================= update ================= */
let FOCUS_T = false;
function update(dt) {
  if (!G || G.over) return;
  G.t += dt;
  stepCo(G, dt, "stageCo", "stageWait");
  const p = G.p;
  // player
  let mx = 0, my = 0; if (K.held("ArrowLeft", "KeyA")) mx -= 1; if (K.held("ArrowRight", "KeyD")) mx += 1; if (K.held("ArrowUp", "KeyW")) my -= 1; if (K.held("ArrowDown", "KeyS")) my += 1;
  const Pd = K.pad; if (Pd.connected) { mx += Pd.ax; my += Pd.ay; if (Pd.held.dl) mx -= 1; if (Pd.held.dr) mx += 1; if (Pd.held.du) my -= 1; if (Pd.held.dd) my += 1; if (Pd.pressed.x || Pd.pressed.lb) bomb(); if (Pd.pressed.start) pause(); }
  p.focus = K.held("ShiftLeft", "ShiftRight") || (Pd.connected && (Pd.held.b || Pd.rt > 0.4 || Pd.held.rb)) || FOCUS_T;
  if (p.alive) {
    const sp = p.focus ? 140 : 300, ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    p.x += mx * sp * dt; p.y += my * sp * dt;
    if (TOUCH.id !== null) { p.x += TOUCH.dx; p.y += TOUCH.dy; TOUCH.dx = TOUCH.dy = 0; }
    p.x = clamp(p.x, 10, FW - 10); p.y = clamp(p.y, 16, FH - 14); p.inv = Math.max(0, p.inv - dt); p.cd -= dt;
    const firing = SAVE.autofire || K.held("KeyZ", "KeyJ", "Space") || (Pd.connected && Pd.held.a) || TOUCH.id !== null;
    if (firing && p.cd <= 0) fire();
  } else if (!G.over) { p.dead -= dt; if (p.dead <= 0) { p.alive = true; p.inv = 3; p.x = FW / 2; p.y = FH - 70; G.bombs = 3; } }
  if (p.bombT > 0) { p.bombT -= dt; for (const e of E) if (e.alive && !e.inv) damage(e, 40 * dt); clearBullets(true); }
  // enemies
  for (const e of E) {
    if (!e.alive) continue; e.t += dt; e.hitT = Math.max(0, e.hitT - dt);
    if (e.mv) { const m = e.mv; m.t += dt; const k = Math.min(1, m.t / m.T), q = m.ease(k); e.x = lerp(m.x0, m.tx, q); e.y = lerp(m.y0, m.ty, q); if (k >= 1) e.mv = null; } else { e.x += e.vx * dt; e.y += e.vy * dt; }
    stepCo(e, dt);
    if (p.alive && !p.inv && !e.boss && Math.hypot(e.x - p.x, e.y - p.y) < e.r * 0.7 + 3) die();
  }
  for (let i = E.length - 1; i >= 0; i--) if (!E[i].alive) E.splice(i, 1);
  // bullets
  const hx = p.x, hy = p.y;
  for (const b of B) {
    b.t += dt; if (b.av) b.a += b.av * dt; if (b.acc) b.spd = clamp(b.spd + b.acc * dt, b.min, b.max); if (b.fn) b.fn(b, dt);
    b.x += Math.cos(b.a) * b.spd * dt; b.y += Math.sin(b.a) * b.spd * dt;
    if (b.x < -40 || b.x > FW + 40 || b.y < -60 || b.y > FH + 40) b.dead = true;
    if (p.alive && !b.dead) { const d2 = (b.x - hx) ** 2 + (b.y - hy) ** 2; if (d2 < (b.r + 2.5) ** 2) { if (!p.inv) { die(); b.dead = true; } } else if (!b.g && d2 < (b.r + 18) ** 2) { b.g = 1; G.graze++; addScore(60); K.sfx("graze"); GRZ.push({ x: (b.x + hx) / 2, y: (b.y + hy) / 2, t: 0.25 }); } }
  }
  for (let i = B.length - 1; i >= 0; i--) if (B[i].dead) B.splice(i, 1);
  // lasers
  for (const z of LZ) { z.t += dt; if (z.t > z.warn && z.t < z.warn + z.life && p.alive && !p.inv) { const dx = hx - z.x, dy = hy - z.y, along = dx * Math.cos(z.a) + dy * Math.sin(z.a), perp = Math.abs(-dx * Math.sin(z.a) + dy * Math.cos(z.a)); if (along > 0 && perp < z.w / 2) die(); } if (Math.abs(z.t - z.warn) < dt) K.sfx("laser"); }
  for (let i = LZ.length - 1; i >= 0; i--) if (LZ[i].t > LZ[i].warn + LZ[i].life) LZ.splice(i, 1);
  // player shots
  for (const s of S) { s.y += s.vy * dt; s.x += s.vx * dt; if (s.home && E.length) { let t = null, td = 1e9; for (const e of E) { if (!e.alive || e.inv) continue; const d = Math.hypot(e.x - s.x, e.y - s.y); if (d < td) { td = d; t = e; } } if (t) { const a = Math.atan2(t.y - s.y, t.x - s.x), cur = Math.atan2(s.vy, s.vx), na = cur + clamp(((a - cur + Math.PI * 3) % TAU) - Math.PI, -6 * dt, 6 * dt), v = Math.hypot(s.vx, s.vy); s.vx = Math.cos(na) * v; s.vy = Math.sin(na) * v; } }
    if (s.y < -20 || s.x < -20 || s.x > FW + 20) s.dead = true;
    for (const e of E) { if (!e.alive || s.dead) continue; if (Math.abs(s.x - e.x) < e.r + 4 && Math.abs(s.y - e.y) < e.r + 8) { s.dead = true; if (!e.inv) { damage(e, s.dmg); HIT.push({ x: s.x, y: s.y, t: 0.12 }); } } } }
  for (let i = S.length - 1; i >= 0; i--) if (S[i].dead) S.splice(i, 1);
  // items
  const autoAll = p.alive && p.y < COLLECT_Y;
  for (const it of IT) { if (it.auto || autoAll) { it.auto = true; const a = Math.atan2(p.y - it.y, p.x - it.x); it.x += Math.cos(a) * 620 * dt; it.y += Math.sin(a) * 620 * dt; } else { it.vy = Math.min(140, it.vy + 260 * dt); it.y += it.vy * dt; if (p.alive && Math.hypot(it.x - p.x, it.y - p.y) < (p.focus ? 60 : 40)) it.auto = true; }
    if (p.alive && Math.hypot(it.x - p.x, it.y - p.y) < 14) { it.dead = true; collect(it, autoAll); } if (it.y > FH + 20) it.dead = true; }
  for (let i = IT.length - 1; i >= 0; i--) if (IT[i].dead) IT.splice(i, 1);
  if (G.phase) { G.phase.t += dt; if (G.phase.T - G.phase.t < 5 && Math.floor(G.phase.t) !== Math.floor(G.phase.t - dt)) K.sfx("tick"); }
  for (const q of FX) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * 2.5; q.vy *= 1 - dt * 2.5; q.t -= dt; } FX = FX.filter((q) => q.t > 0);
  for (const q of HIT) q.t -= dt; HIT = HIT.filter((q) => q.t > 0); for (const q of GRZ) q.t -= dt; GRZ = GRZ.filter((q) => q.t > 0);
  for (const q of POPS) q.t += dt; POPS = POPS.filter((q) => q.t < 1.4);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > 2.6) G.banner = null; }
  G.shake = Math.max(0, G.shake - dt); G.flash = Math.max(0, G.flash - dt * 1.5);
  STARS.forEach((s) => { s.y += s.v * dt * (G.boss ? 0.5 : 1); if (s.y > FH) { s.y -= FH; s.x = Math.random() * FW; } });
}
let FX = [], HIT = [], GRZ = [], POPS = [];
function fire() {
  const p = G.p, lv = Math.floor(G.power); p.cd = 0.07; const dmg = p.focus ? 1.5 : 1;
  const add = (dx, a, home) => S.push({ x: p.x + dx, y: p.y - 12, vx: Math.sin(a) * 900, vy: -Math.cos(a) * 900, dmg: home ? 0.7 : dmg, home });
  if (p.focus) { add(-5, 0); add(5, 0); if (lv >= 2) { add(-12, 0); add(12, 0); } if (lv >= 3) { add(-2, 0); add(2, 0); } if (lv >= 4 && (G.t * 14 | 0) % 2) { add(-16, -0.05, true); add(16, 0.05, true); } }
  else { add(-6, 0); add(6, 0); if (lv >= 2) { add(-10, -0.14); add(10, 0.14); } if (lv >= 3) { add(-14, -0.28); add(14, 0.28); } if (lv >= 4 && (G.t * 14 | 0) % 2) { add(-18, -0.42, true); add(18, 0.42, true); } }
  K.sfx("pshot");
}
function damage(e, d) {
  e.hp -= d; e.hitT = 0.05; addScore(Math.round(d * 10));
  if (e.hp <= 0 && !e.boss) {
    e.alive = false; addScore(e.pts); burst(e.x, e.y, e.col, e.kind === "tank" ? 50 : 18, e.kind === "tank" ? 300 : 180); K.sfx(e.kind === "tank" ? "bigboom" : "edie");
    if (e.drop) { for (let k = 0; k < e.drop[0]; k++) IT.push({ x: e.x + (RND() - 0.5) * 20, y: e.y, k: "P", vy: -140 - RND() * 60 }); for (let k = 0; k < e.drop[1]; k++) IT.push({ x: e.x + (RND() - 0.5) * 24, y: e.y, k: "pt", vy: -140 - RND() * 60 }); }
    if (e.kind === "tank") G.shake = 0.3;
  }
}
function collect(it, top) {
  if (it.k === "P") { const before = Math.floor(G.power); G.power = Math.min(4, G.power + 0.05); addScore(10); if (Math.floor(G.power) > before) { pop(G.p.x, G.p.y - 30, G.power >= 4 ? "FULL POWER" : "POWER UP", "#ff7ad9"); K.sfx("powerup"); } else K.sfx("item"); }
  else if (it.k === "pt") { const v = top || it.y < COLLECT_Y ? 1000 * G.stage : Math.round((300 + (1 - it.y / FH) * 600) * G.stage / 10) * 10; addScore(v); K.sfx("item"); }
  else if (it.k === "b") { addScore(20); }
}
function clearBullets(toItems) { for (const b of B) { if (toItems && IT.length < 400) IT.push({ x: b.x, y: b.y, k: "b", vy: 0, auto: true }); FX.push({ x: b.x, y: b.y, vx: 0, vy: -30, t: 0.3, c: COLS[b.col] }); } B.length = 0; }
function die() {
  const p = G.p; if (!p.alive || p.inv) return;
  p.alive = false; p.dead = 1.4; G.lives--; G.phaseClean = false; burst(p.x, p.y, "white", 70, 420); burst(p.x, p.y, "pink", 40, 300); G.shake = 0.6; G.flash = 0.5; K.sfx("die"); K.vibrate(200);
  const lost = Math.min(1, G.power - 1); G.power = Math.max(1, G.power - 1); for (let k = 0; k < Math.ceil(lost / 0.05 / 3); k++) IT.push({ x: p.x + (RND() - 0.5) * 80, y: p.y - 20, k: "P", vy: -260 - RND() * 120 });
  clearBullets(false); LZ.length = 0;
  if (G.lives < 0) { G.lives = 0; const g = G; setTimeout(() => { if (G === g) continueScreen(); }, 1500); G.over = true; }
}
function bomb() {
  const p = G && G.p; if (!G || G.over || !p.alive || p.bombT > 0) return; if (G.bombs <= 0) { K.sfx("deny"); return; }
  G.bombs--; p.bombT = 2.2; p.inv = Math.max(p.inv, 3.2); G.phaseClean = false; G.flash = 0.6; G.shake = 0.4; K.sfx("bomb"); K.vibrate(80); BOMBFX = { x: p.x, y: p.y, t: 0 };
}
let BOMBFX = null;
function addScore(n) { G.score += n; while (G.extends.length && G.score >= G.extends[0]) { G.extends.shift(); G.lives++; K.sfx("extend"); pop(FW / 2, FH / 2, "EXTEND", "#8affc1"); } }
function burst(x, y, col, n, sp) { const c = COLS[col] || col; for (let k = 0; k < n; k++) { const a = RND() * TAU, s = sp * (0.2 + RND() * 0.9); FX.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.3 + RND() * 0.6, c }); } if (FX.length > 1500) FX.splice(0, FX.length - 1500); }
function pop(x, y, text, col) { POPS.push({ x, y, text, col, t: 0 }); }
function finish(won) {
  G.over = true; const hiKey = SAVE.diff, best = SAVE.hi[hiKey]; G.pb = !G.cont && !G.practice && G.score > best;
  if (G.pb) SAVE.hi[hiKey] = G.score; if (won && !G.cont && !G.practice) SAVE.cleared[hiKey] = true; persist();
  K.sfx(won ? "win" : "over"); K.musicLevel(1);
  setTimeout(() => results(won), won ? 600 : 300);
}

/* ================= render ================= */
const cv = $("#cv"), ctx = cv.getContext("2d");
const L = { W: 0, H: 0, dpr: 1, s: 1, ox: 0, oy: 0, side: false };
const STARS = Array.from({ length: 90 }, (_, i) => ({ x: Math.random() * FW, y: Math.random() * FH, v: 20 + (i % 3) * 30 + Math.random() * 20, s: (i % 3) * 0.6 + 0.6 }));
const SPR = new Map(); let NEB = null;
function layout() {
  L.W = innerWidth; L.H = innerHeight; L.dpr = K.fit(cv, L.W, L.H).dpr; SPR.clear(); NEB = null;
  L.side = L.W / L.H > 1.0; const panel = L.side ? Math.min(300, L.W * 0.26) : 0;
  L.s = Math.min((L.W - panel - 20) / FW, (L.H - (L.side ? 16 : 70)) / FH); L.ox = L.side ? (L.W - panel - FW * L.s) / 2 + 4 : (L.W - FW * L.s) / 2; L.oy = L.side ? (L.H - FH * L.s) / 2 : 10;
  L.px = L.ox + FW * L.s + 24; L.pw = panel - 30;
}
addEventListener("resize", layout);
function bulletSpr(shape, col) {
  const key = shape + col; if (SPR.has(key)) return SPR.get(key);
  const r = SHR[shape] * L.s * L.dpr, size = Math.ceil(r * (shape === "rice" ? 3.4 : 3.2) * 2), c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"), m = size / 2, rgb = COLS[col];
  const glow = g.createRadialGradient(m, m, 0, m, m, size / 2); glow.addColorStop(0, `rgba(${rgb},0.55)`); glow.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = glow; g.fillRect(0, 0, size, size);
  g.translate(m, m);
  if (shape === "rice") { g.fillStyle = `rgb(${rgb})`; g.beginPath(); g.ellipse(0, 0, r * 1.9, r * 1.05, 0, 0, TAU); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.ellipse(0, 0, r * 1.25, r * 0.5, 0, 0, TAU); g.fill(); }
  else if (shape === "star") { g.fillStyle = `rgb(${rgb})`; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.6 : r * 1.5; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, r * 0.45, 0, TAU); g.fill(); }
  else { g.fillStyle = `rgb(${rgb})`; g.beginPath(); g.arc(0, 0, r * 1.15, 0, TAU); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, r * 0.72, 0, TAU); g.fill(); }
  SPR.set(key, c); return c;
}
function nebula() {
  if (NEB) return NEB; const c = document.createElement("canvas"), w = Math.ceil(FW * L.s * L.dpr), h = Math.ceil(FH * L.s * L.dpr); c.width = w; c.height = h; const g = c.getContext("2d");
  const pal = [["#1a0f3d", "#05030f", "255,120,200", "120,160,255"], ["#071d33", "#030612", "90,230,255", "190,110,255"], ["#2a0a22", "#07020a", "255,90,120", "255,200,90"]][(G ? G.stage : 1) - 1];
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const r = K.RNG(G ? G.stage * 7 : 3); for (let i = 0; i < 9; i++) { const x = r() * w, y = r() * h, rad = (80 + r() * 160) * L.s * L.dpr, col = i % 2 ? pal[2] : pal[3], gg = g.createRadialGradient(x, y, 0, x, y, rad); gg.addColorStop(0, `rgba(${col},0.12)`); gg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gg; g.fillRect(0, 0, w, h); }
  return (NEB = c);
}
const fx = (x) => L.ox + x * L.s, fy = (y) => L.oy + y * L.s;
function drawEnemy(e) {
  const x = fx(e.x), y = fy(e.y), r = e.r * L.s, rgb = COLS[e.col];
  ctx.save(); ctx.translate(x, y);
  if (e.boss) {
    ctx.rotate(G.t * 0.6); ctx.strokeStyle = `rgba(${rgb},0.45)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, TAU); ctx.stroke(); for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.9, Math.sin(a) * r * 1.9); ctx.lineTo(Math.cos(a + 0.4) * r * 2.4, Math.sin(a + 0.4) * r * 2.4); ctx.stroke(); }
    ctx.rotate(-G.t * 1.4); ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; ctx.lineTo(Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.7); } ctx.closePath(); ctx.stroke(); ctx.rotate(G.t * 0.8);
    K.drawGlow(ctx, 0, 0, r * 3, rgb, 0.8);
    ctx.fillStyle = e.hitT > 0 ? "#fff" : `rgb(${rgb})`; ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 4, rr = k % 2 ? r * 0.55 : r * 1.15; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, TAU); ctx.fill();
  } else {
    K.drawGlow(ctx, 0, 0, r * 2.2, rgb, 0.5); ctx.rotate(e.t * (e.kind === "spinner" ? 4 : 1.2));
    ctx.fillStyle = e.hitT > 0 ? "#fff" : `rgb(${rgb})`; ctx.beginPath();
    const pts = e.kind === "dart" ? 3 : e.kind === "orb" ? 6 : e.kind === "diver" ? 4 : e.kind === "spinner" ? 5 : 8;
    for (let k = 0; k < pts * 2; k++) { const a = (k / (pts * 2)) * TAU, rr = k % 2 ? r * 0.5 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, TAU); ctx.fill();
    if (e.kind === "tank") { ctx.rotate(-e.t * 2.4); ctx.strokeStyle = `rgba(${rgb},0.6)`; ctx.lineWidth = 2; ctx.strokeRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4); }
  }
  ctx.restore();
}
function render(dt) {
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0); ctx.fillStyle = "#04030d"; ctx.fillRect(0, 0, L.W, L.H);
  let sx = 0, sy = 0; if (G && G.shake > 0) { sx = (RND() - 0.5) * 12 * G.shake; sy = (RND() - 0.5) * 12 * G.shake; }
  ctx.save(); ctx.translate(sx, sy);
  ctx.save(); ctx.beginPath(); ctx.rect(L.ox, L.oy, FW * L.s, FH * L.s); ctx.clip();
  ctx.drawImage(nebula(), L.ox, L.oy, FW * L.s, FH * L.s);
  for (const s of STARS) { ctx.fillStyle = `rgba(255,255,255,${0.25 + s.s * 0.3})`; ctx.fillRect(fx(s.x), fy(s.y), s.s * L.s * 1.6, s.s * L.s * 1.6 + (G && !G.boss ? s.v * 0.02 : 0)); }
  if (G) {
    if (G.p.y < COLLECT_Y + 40 && G.p.alive) { ctx.strokeStyle = "rgba(255,224,138,0.25)"; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(L.ox, fy(COLLECT_Y)); ctx.lineTo(L.ox + FW * L.s, fy(COLLECT_Y)); ctx.stroke(); ctx.setLineDash([]); }
    // items
    for (const it of IT) { const x = fx(it.x), y = fy(it.y), s = 7 * L.s; if (it.k === "P") { ctx.fillStyle = "#ff4f7a"; ctx.fillRect(x - s, y - s, s * 2, s * 2); ctx.fillStyle = "#fff"; ctx.font = `800 ${s * 1.6}px Saira Semi Condensed`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("P", x, y + 1); } else if (it.k === "pt") { ctx.fillStyle = "#5aa8ff"; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillRect(x - 2, y - 2, 4, 4); } else { ctx.fillStyle = "rgba(140,255,190,0.8)"; ctx.fillRect(x - 2, y - 2, 4, 4); } }
    for (const e of E) drawEnemy(e);
    // player shots
    ctx.globalCompositeOperation = "lighter";
    for (const s of S) { ctx.fillStyle = s.home ? "rgba(255,120,220,0.85)" : G.p.focus ? "rgba(255,170,240,0.8)" : "rgba(140,220,255,0.8)"; ctx.fillRect(fx(s.x) - 1.6 * L.s, fy(s.y) - 9 * L.s, 3.2 * L.s, 18 * L.s); }
    for (const q of HIT) { ctx.fillStyle = `rgba(255,255,255,${q.t * 6})`; ctx.beginPath(); ctx.arc(fx(q.x), fy(q.y), 6 * L.s, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = "source-over";
    // lasers
    for (const z of LZ) { const x0 = fx(z.x), y0 = fy(z.y), x1 = x0 + Math.cos(z.a) * z.len * L.s, y1 = y0 + Math.sin(z.a) * z.len * L.s, rgb = COLS[z.col]; const live = z.t > z.warn; ctx.lineCap = "round";
      if (!live) { ctx.strokeStyle = `rgba(${rgb},${0.25 + Math.sin(z.t * 30) * 0.15})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
      else { const k = 1 - Math.max(0, z.t - z.warn - z.life + 0.15) / 0.15; ctx.strokeStyle = `rgba(${rgb},0.55)`; ctx.lineWidth = z.w * L.s * 1.9 * k; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = z.w * L.s * 0.6 * k; ctx.stroke(); } ctx.lineCap = "butt"; }
    // player
    const p = G.p;
    if (p.alive && !(p.inv > 0 && Math.floor(p.inv * 14) % 2)) {
      const x = fx(p.x), y = fy(p.y), s = L.s;
      ctx.fillStyle = `rgba(255,160,80,${0.6 + RND() * 0.3})`; ctx.beginPath(); ctx.moveTo(x - 4 * s, y + 9 * s); ctx.lineTo(x, y + (16 + RND() * 6) * s); ctx.lineTo(x + 4 * s, y + 9 * s); ctx.fill();
      const pg = ctx.createLinearGradient(x, y - 14 * s, x, y + 10 * s); pg.addColorStop(0, "#ffffff"); pg.addColorStop(1, "#ff7ad9"); ctx.fillStyle = pg;
      ctx.beginPath(); ctx.moveTo(x, y - 14 * s); ctx.lineTo(x + 5 * s, y - 2 * s); ctx.lineTo(x + 13 * s, y + 8 * s); ctx.lineTo(x + 4 * s, y + 6 * s); ctx.lineTo(x, y + 10 * s); ctx.lineTo(x - 4 * s, y + 6 * s); ctx.lineTo(x - 13 * s, y + 8 * s); ctx.lineTo(x - 5 * s, y - 2 * s); ctx.closePath(); ctx.fill();
      if (p.focus) { ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5; ctx.save(); ctx.translate(x, y); ctx.rotate(G.t * 2); ctx.strokeRect(-14 * s, -14 * s, 28 * s, 28 * s); ctx.restore(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 3.2 * s, 0, TAU); ctx.fill(); ctx.strokeStyle = "#ff3366"; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    // bullets
    for (const b of B) { const spr = bulletSpr(b.shape, b.col), w = spr.width / L.dpr; if (b.shape === "rice") { ctx.save(); ctx.translate(fx(b.x), fy(b.y)); ctx.rotate(b.a); ctx.drawImage(spr, -w / 2, -w / 2, w, w); ctx.restore(); } else if (b.shape === "star") { ctx.save(); ctx.translate(fx(b.x), fy(b.y)); ctx.rotate(b.t * 4); ctx.drawImage(spr, -w / 2, -w / 2, w, w); ctx.restore(); } else ctx.drawImage(spr, fx(b.x) - w / 2, fy(b.y) - w / 2, w, w); }
    ctx.globalCompositeOperation = "lighter";
    for (const q of FX) { ctx.fillStyle = `rgba(${q.c},${Math.min(1, q.t * 2)})`; const s = 2.6 * L.s; ctx.fillRect(fx(q.x) - s / 2, fy(q.y) - s / 2, s, s); }
    for (const q of GRZ) { ctx.fillStyle = `rgba(255,255,255,${q.t * 3})`; ctx.fillRect(fx(q.x) - 2, fy(q.y) - 2, 4, 4); }
    ctx.globalCompositeOperation = "source-over";
    if (BOMBFX) { BOMBFX.t += dt; const k = BOMBFX.t / 1.4; ctx.strokeStyle = `rgba(255,122,217,${Math.max(0, 1 - k)})`; ctx.lineWidth = 18 * L.s * (1 - k * 0.5); ctx.beginPath(); ctx.arc(fx(BOMBFX.x), fy(BOMBFX.y), k * 700 * L.s, 0, TAU); ctx.stroke(); if (k > 1) BOMBFX = null; }
    // boss HUD
    if (G.boss && G.phase) {
      const b = G.boss, w = FW * L.s - 24, k = clamp(b.hp / b.max, 0, 1); ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(L.ox + 12, L.oy + 10, w, 6); ctx.fillStyle = "#ff7ad9"; ctx.fillRect(L.ox + 12, L.oy + 10, w * k, 6);
      ctx.font = `700 ${12 * Math.max(1, L.s)}px Saira Semi Condensed`; ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.fillText(`${b.name}  ${"◆".repeat(G.phase.n - G.phase.i - 1)}`, L.ox + 12, L.oy + 20);
      ctx.textAlign = "right"; const left = Math.max(0, G.phase.T - G.phase.t); ctx.fillStyle = left < 6 ? "#ff6b8a" : "#fff"; ctx.fillText(left.toFixed(1), L.ox + FW * L.s - 12, L.oy + 20);
      ctx.fillStyle = "#ffe08a"; ctx.fillText(G.phase.name, L.ox + FW * L.s - 12, L.oy + 38 * Math.max(1, L.s));
    }
    if (G.banner) { const k = G.banner.t, a = k < 0.3 ? k / 0.3 : k > 2.2 ? (2.6 - k) / 0.4 : 1; ctx.globalAlpha = a; ctx.font = `400 ${16 * Math.max(0.9, L.s)}px Michroma`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#ffe08a"; ctx.fillText(G.banner.text.toUpperCase(), L.ox + FW * L.s / 2 + (1 - a) * 40, L.oy + FH * L.s * 0.42); ctx.globalAlpha = 1; }
    for (const q of POPS) { ctx.globalAlpha = 1 - q.t / 1.4; ctx.font = `800 ${15 * Math.max(1, L.s)}px Saira Semi Condensed`; ctx.textAlign = "center"; ctx.fillStyle = q.col; ctx.fillText(q.text, fx(q.x), fy(q.y) - q.t * 30); ctx.globalAlpha = 1; }
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(200,180,255,0.35)"; ctx.lineWidth = 2; ctx.strokeRect(L.ox, L.oy, FW * L.s, FH * L.s);
  ctx.restore();
  if (G && G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.5})`; ctx.fillRect(0, 0, L.W, L.H); }
  if (G) hud();
}
function hud() {
  const rows = [["HI-SCORE", K.fmt(Math.max(SAVE.hi[SAVE.diff], G.cont || G.practice ? 0 : G.score))], ["SCORE", K.fmt(G.score)]];
  if (L.side) {
    let y = L.oy + 10; const x = L.px; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = "400 18px Michroma"; ctx.fillStyle = "#fff"; ctx.fillText("STARLANCE", x, y); y += 34; ctx.font = "600 14px Saira Semi Condensed"; ctx.fillStyle = "#b3a8dc"; ctx.fillText(`${D.name} · Stage ${G.stage}${G.practice ? " · practice" : ""}`, x, y); y += 34;
    for (const [k, v] of rows) { ctx.font = "600 13px Saira Semi Condensed"; ctx.fillStyle = "#b3a8dc"; ctx.fillText(k, x, y); ctx.font = "700 24px Saira Semi Condensed"; ctx.fillStyle = "#fff"; ctx.fillText(v, x, y + 16); y += 54; }
    ctx.font = "600 13px Saira Semi Condensed"; ctx.fillStyle = "#b3a8dc"; ctx.fillText("LIVES", x, y); ctx.fillText("BOMBS", x, y + 40); ctx.fillText("POWER", x, y + 80); ctx.fillText("GRAZE", x, y + 120);
    for (let i = 0; i < G.lives; i++) star(x + 8 + i * 20, y + 26, 7, "#ff7ad9"); for (let i = 0; i < G.bombs; i++) star(x + 8 + i * 20, y + 66, 7, "#8affc1");
    ctx.font = "700 18px Saira Semi Condensed"; ctx.fillStyle = "#fff"; ctx.fillText(G.power >= 4 ? "MAX" : G.power.toFixed(2), x, y + 96); ctx.fillText(G.graze, x, y + 136);
  } else {
    ctx.textBaseline = "top"; ctx.font = "700 14px Saira Semi Condensed"; ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.fillText(K.fmt(G.score), L.ox + 8, L.oy + FH * L.s + 6);
    ctx.textAlign = "right"; ctx.fillStyle = "#b3a8dc"; ctx.fillText(`P ${G.power >= 4 ? "MAX" : G.power.toFixed(1)}  ·  ${"★".repeat(Math.max(0, G.lives))}  ·  B${G.bombs}`, L.ox + FW * L.s - 8, L.oy + FH * L.s + 6);
  }
}
function star(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

/* ================= input ================= */
const TOUCH = { id: null, x: 0, y: 0, dx: 0, dy: 0, last: 0 };
cv.addEventListener("pointerdown", (e) => {
  if (!G || K.ui.active() || G.over) return; K.audio();
  if (e.pointerType !== "touch") return;
  const now = performance.now(); if (now - TOUCH.last < 280) bomb(); TOUCH.last = now;
  TOUCH.id = e.pointerId; TOUCH.x = e.clientX; TOUCH.y = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch {} touchBtns(true);
});
cv.addEventListener("pointermove", (e) => { if (e.pointerId !== TOUCH.id) return; const k = 1.25 / L.s; TOUCH.dx += (e.clientX - TOUCH.x) * k; TOUCH.dy += (e.clientY - TOUCH.y) * k; TOUCH.x = e.clientX; TOUCH.y = e.clientY; });
const endT = (e) => { if (e.pointerId === TOUCH.id) TOUCH.id = null; };
cv.addEventListener("pointerup", endT); cv.addEventListener("pointercancel", endT);
addEventListener("keydown", (e) => { if (!G || K.ui.active()) return; if (e.code === "KeyX" || e.code === "KeyK") bomb(); else if (e.code === "Escape" || e.code === "KeyP") pause(); if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault(); });
function touchBtns(force) { const on = G && !G.over && (force || K.device === "touch"); $("#focusBtn").hidden = !on; $("#bombBtn").hidden = !on; }
$("#bombBtn").addEventListener("pointerdown", (e) => { e.stopPropagation(); bomb(); });
$("#focusBtn").addEventListener("pointerdown", (e) => { e.stopPropagation(); FOCUS_T = !FOCUS_T; $("#focusBtn").classList.toggle("on", FOCUS_T); });
$("#pauseBtn").onclick = () => pause();

/* ================= audio ================= */
K.defineSfx({
  pshot: (t) => K.noise(t, 0.025, { filter: "highpass", freq: 5000, vol: 0.012 }),
  eshot: (t) => K.voice(700, t, 0.06, { duty: 0.125, vol: 0.02, slide: 0.7 }),
  graze: (t) => K.voice(2400, t, 0.02, { type: "square", vol: 0.012 }),
  edie: (t) => { K.noise(t, 0.12, { filter: "bandpass", freq: 1800, vol: 0.07 }); K.voice(500, t, 0.08, { duty: 0.25, vol: 0.03, slide: 0.4 }); },
  bigboom: (t) => { K.noise(t, 0.5, { filter: "lowpass", freq: 1000, slide: 0.3, vol: 0.18 }); K.voice(90, t, 0.5, { type: "sine", vol: 0.14, slide: 0.4 }); },
  bossdie: (t) => { K.noise(t, 1.6, { filter: "lowpass", freq: 1400, slide: 0.15, vol: 0.25 }); K.voice(60, t, 1.4, { type: "sine", vol: 0.2, slide: 0.5 }); K.notes(t + 0.3, [523, 659, 784, 1046], 0.12, { type: "triangle", vol: 0.05, len: 0.6 }); },
  die: (t) => { K.noise(t, 0.9, { filter: "lowpass", freq: 2400, slide: 0.15, vol: 0.2 }); K.voice(880, t, 0.6, { type: "sawtooth", vol: 0.05, slide: 0.1, lp: 2000 }); },
  bomb: (t) => { K.noise(t, 1.4, { filter: "bandpass", freq: 500, slide: 4, vol: 0.18, q: 0.5 }); K.notes(t, [392, 523, 659, 784, 1046], 0.05, { type: "triangle", vol: 0.04, len: 0.4 }); },
  item: (t) => K.voice(1760, t, 0.03, { type: "triangle", vol: 0.015 }),
  powerup: (t) => K.notes(t, [784, 1046, 1318], 0.05, { duty: 0.25, vol: 0.04, len: 0.14 }),
  spell: (t) => { K.voice(220, t, 0.6, { type: "sawtooth", vol: 0.04, slide: 2, lp: 1600 }); K.noise(t, 0.5, { filter: "highpass", freq: 3000, slide: 0.5, vol: 0.04 }); },
  phase: (t) => K.notes(t, [659, 988, 1318], 0.07, { type: "triangle", vol: 0.05, len: 0.3 }),
  bonus: (t) => K.notes(t, [1046, 1318, 1568, 2093], 0.06, { duty: 0.25, vol: 0.04, len: 0.2 }),
  charge: (t) => K.voice(300, t, 0.8, { type: "sine", vol: 0.03, slide: 3 }),
  laser: (t) => K.noise(t, 0.6, { filter: "bandpass", freq: 2200, vol: 0.06, q: 2 }),
  extend: (t) => K.notes(t, [523, 784, 1046, 1568], 0.08, { duty: 0.25, vol: 0.05, len: 0.3 }),
  clear: (t) => K.notes(t, [523, 659, 784, 1046, 1318, 1568], 0.08, { duty: 0.25, vol: 0.05, len: 0.4 }),
  tick: (t) => K.voice(1200, t, 0.04, { type: "square", vol: 0.025 }),
  over: (t) => K.notes(t, [392, 330, 262, 196], 0.18, { type: "triangle", vol: 0.06, len: 0.5 }),
}, { pshot: 0.07, eshot: 0.05, graze: 0.03, item: 0.025, edie: 0.03 });
K.songs({
  st1: { bpm: 150, chords: ["Dm", "Bb", "C", "Am", "Dm", "Bb", "Gm", "A"], bass: "R . O R . O R O R . O R . O R O", bassWave: 0.5, bassVol: 0.09, drums: "k . h . s . h k k . h . s . h h", arp: true, arpVol: 0.017, arpPat: [0, 1, 2, 3, 2, 1],
    lead: ["d5 - f5 - a5 - g5 f5", "f5 - - - d5 - bb4 -", "c5 - e5 - g5 - c6 -", "a5 - - - e5 - - -", "d5 - f5 - a5 - d6 -", "c6 - bb5 - f5 - d5 -", "g5 - bb5 - d6 - c6 bb5", "a5 - - - c#6 - - -"], leadVol: 0.038 },
  st2: { bpm: 160, chords: ["Em", "C", "G", "D", "Em", "C", "Am", "B"], bass: "R R O R R O R O R R O R R O R O", bassWave: "triangle", bassVol: 0.12, drums: "k . h k s . h . k . h k s . h s", arp: true, arpVol: 0.017, arpPat: [0, 2, 1, 2, 3, 2],
    lead: ["e5 - b5 - g5 - e5 -", "c6 - - - g5 - e5 -", "d5 - g5 - b5 - d6 -", "f#5 - - - a5 - - -", "e5 - g5 - b5 - e6 -", "d6 - c6 - g5 - e5 -", "a5 - c6 - e6 - d6 c6", "b5 - - - d#6 - - -"], leadVol: 0.038 },
  st3: { bpm: 170, chords: ["Cm", "Ab", "Bb", "G", "Cm", "Ab", "Fm", "G"], bass: "R O R O R O R O R O R O R O R O", bassWave: 0.25, bassVol: 0.09, drums: "k h s h k k s h k h s h k k s s", arp: true, arpVol: 0.018, arpPat: [0, 1, 2, 3, 4, 3, 2, 1],
    lead: ["c5 - eb5 - g5 - c6 -", "ab5 - - - eb5 - c5 -", "bb4 - d5 - f5 - bb5 -", "b5 - - - g5 - - -", "c6 - - eb6 - d6 c6 -", "ab5 - - - c6 - eb6 -", "f5 - ab5 - c6 - f6 -", "g5 - - - b5 - d6 -"], leadVol: 0.04 },
  menu: { bpm: 96, chords: ["Am", "F", "C", "G"], pad: true, padVol: 0.02, arp: true, arpVol: 0.016, arpPat: [0, 1, 2, 1], bass: "R . . . . . . . R . . . . . . .", bassVol: 0.08 },
});

/* ================= screens ================= */
function title() {
  G = null; $("#pauseBtn").hidden = true; touchBtns(); K.playSong("menu", 1);
  const dset = Object.entries(DIFFS).map(([k, d]) => `<button class="k-btn diff ${SAVE.diff === k ? "on" : ""}" data-a="diff" data-k="${k}"><b>${d.name.toUpperCase()}</b><small>${d.desc}</small><em>${SAVE.hi[k] ? "Hi " + K.fmt(SAVE.hi[k]) : ""}${SAVE.cleared[k] ? " ★" : ""}</em></button>`).join("");
  K.ui.show(`<div class="logo">STARLANCE</div><p class="k-sub">Thread the needle through three stages of starlight. Your ship only dies if the tiny core is hit.</p>
    <div class="diffs">${dset}</div>
    <div class="k-menu"><button class="k-btn primary" data-a="start" autofocus>Start</button>${SAVE.reached > 1 ? `<button class="k-btn" data-a="practice">Practice a stage</button>` : ""}<button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>`, { cls: "soft" });
}
function pause() { if (!G || G.over || K.ui.active()) return; K.ui.show(`<div class="logo" style="font-size:2.2em">PAUSED</div><p class="k-sub">Stage ${G.stage} · ${K.fmt(G.score)}</p><div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="start">Restart</button><button class="k-btn" data-a="settings" data-from="menu">Settings</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "resume" }); }
function continueScreen() {
  K.ui.show(`<div class="logo" style="font-size:2.4em">GAME OVER</div><p class="k-sub">Stage ${G.stage} · ${K.fmt(G.score)} points</p><p class="k-sub">Continuing keeps your place, but the run won't count for a high score.</p>
    <div class="k-menu"><button class="k-btn primary" data-a="cont" autofocus>Continue</button><button class="k-btn" data-a="giveup">Give up</button></div>`, { back: "giveup" });
}
function results(won) {
  K.ui.show(`<div class="logo" style="font-size:2.4em">${won ? "ALL CLEAR" : "GAME OVER"}</div><p class="k-sub">${D.name}${G.practice ? " · practice" : ""}${G.cont ? ` · ${G.cont} continue${G.cont > 1 ? "s" : ""}` : ""}</p>
    <div class="k-stats"><div class="k-stat"><small>Score</small><b>${K.fmt(G.score)}</b></div><div class="k-stat"><small>Graze</small><b>${G.graze}</b></div><div class="k-stat"><small>Stage</small><b>${G.stage}</b></div></div>${G.pb ? `<b style="color:var(--gold)">New high score!</b>` : ""}
    <div class="k-row"><button class="k-btn primary" data-a="start" autofocus>Play again</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "title" });
}
function settings(from) {
  const back = from === "menu" ? "pauseback" : "title";
  const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center"><div class="k-opt"><span>Fire automatically</span><button class="k-btn small" data-a="tog">${SAVE.autofire ? "On" : "Off"}</button></div>${K.ui.settingsRows()}</div>`, { back, cls: "top" });
  K.ui.bindSettings(s);
}
function help() {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="k-help"><div><b>Dodge</b>Only the small core of your ship can be hit. Hold Shift to focus: you move slowly, see your core and fire a tighter shot.</div><div><b>Graze</b>Let bullets brush past your core for points.</div>
    <div><b>Items</b>Red P items raise your power. Blue items are worth the most when you're high up. Fly above the dotted line to pull in every item.</div><div><b>Bombs</b>X clears the screen and makes you invincible for a moment. You get three per life.</div>
    <div><b>Bosses</b>Each boss has named attacks with timers. Beat one without getting hit or bombing for a big bonus.</div><div class="k-kbonly"><b>Keys</b>Arrows or WASD move · Shift focus · Z fire (or auto) · X bomb · Esc pause</div><div class="k-touchonly"><b>Touch</b>Drag anywhere to steer. Double-tap or BOMB to bomb. FOCUS toggles focus mode.</div><div><b>Controller</b>Stick moves · B or RB focus · X or LB bomb</div></div>`, { back: "title", cls: "top" });
}
K.ui.on((a, d) => {
  switch (a) {
    case "title": K.sfx("ok"); return title();
    case "diff": SAVE.diff = d.k; persist(); K.sfx("click"); return title();
    case "start": K.sfx("ok"); return newGame(1);
    case "practice": K.sfx("ok"); return K.ui.show(`<div class="k-bar"><h2>Practice</h2><button class="k-btn" data-a="title">Back</button></div><div class="k-menu">${[1, 2, 3].filter((n) => n <= SAVE.reached).map((n) => `<button class="k-btn" data-a="stage" data-n="${n}">Stage ${n} · ${["Twilight Orbit", "Nebula Drift", "Event Horizon"][n - 1]}</button>`).join("")}</div>`, { back: "title", cls: "top" });
    case "stage": K.sfx("ok"); newGame(+d.n); G.practice = true; return;
    case "resume": K.ui.hide(); return;
    case "pauseback": K.ui.hide(); return pause();
    case "cont": K.ui.hide(); G.over = false; G.cont++; G.lives = D.lives; G.bombs = 3; G.p.alive = true; G.p.inv = 3; G.p.x = FW / 2; G.p.y = FH - 70; return;
    case "giveup": return finish(false);
    case "settings": K.sfx("ok"); return settings(d.from);
    case "help": K.sfx("ok"); return help();
    case "tog": SAVE.autofire = !SAVE.autofire; persist(); return settings(G && !G.over ? "menu" : "");
  }
});
K.onPause(() => { if (G && !G.over && !K.ui.active()) pause(); });

/* ================= boot ================= */
layout(); title();
const fixed = K.fixed(60);
K.loop((dt) => { if (G && !K.ui.active()) fixed(dt, update); else if (!G) STARS.forEach((s) => { s.y += s.v * dt; if (s.y > FH) s.y -= FH; }); render(dt); });
