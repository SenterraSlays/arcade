"use strict";
/* SUNSET DRIVE — pseudo-3D arcade racer. Segment-projected road with curves, hills, traffic and roadside sprites. */
const { $, $$, clamp, lerp, TAU } = K;
const SEG = 200, RUMBLE = 3, ROAD_W = 2000, CAM_H = 1000, DRAW = 260, FOGD = 4.5, FOV = 100;
const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180), PLAYER_Z = CAM_H * CAM_DEPTH;
const MAXV = SEG * 60, ACCEL = MAXV / 5.5, BRAKE = -MAXV, DECEL = -MAXV / 6, OFF_DECEL = -MAXV / 2, OFF_LIMIT = MAXV / 4, CENTRI = 0.32;
const THEMES = [
  { name: "Coast", sky: ["#2b1660", "#d4508f", "#ffb36b"], sun: ["#fff0a0", "#ff7a59"], ground: ["#e7c58c", "#dbb77c"], road: ["#5d6277", "#575c70"], rumble: ["#ff4f6e", "#f6f2ee"], lane: "#ffffff", fog: "#f08f8a", far: "#7b3f8f", near: "#5b2f72", sea: "#3b6fb0", sprites: ["palm", "palm", "palm", "umbrella", "palm", "sign"] },
  { name: "City Nights", sky: ["#090726", "#33196b", "#ff4f9a"], sun: ["#ffb3e0", "#ff4f9a"], ground: ["#2a2c45", "#25273d"], road: ["#3d4057", "#383a50"], rumble: ["#2ee8ff", "#16162a"], lane: "#ffe14d", fog: "#4b2a76", far: "#1d1240", near: "#140c2e", stars: true, sprites: ["building", "building", "lamp", "billboard", "building"] },
  { name: "Desert", sky: ["#3a1440", "#e2683c", "#ffd36b"], sun: ["#fff6c0", "#ffb347"], ground: ["#d98a4a", "#cf8043"], road: ["#6e5d58", "#685752"], rumble: ["#ffffff", "#b54a2a"], lane: "#fff3d6", fog: "#f2a065", far: "#a2482c", near: "#7a3420", sprites: ["cactus", "rock", "cactus", "cactus", "sign"] },
  { name: "Alpine", sky: ["#1b2a5e", "#6f6bc8", "#ffb0a6"], sun: ["#fff3dc", "#ffc4a8"], ground: ["#eef3ff", "#e0e8f8"], road: ["#5e6478", "#585e72"], rumble: ["#ff3b3b", "#ffffff"], lane: "#ffffff", fog: "#b9b5e6", far: "#5a5fa8", near: "#3e447f", snow: true, sprites: ["pine", "pine", "pine", "rock", "pine"] },
  { name: "Neon Grid", sky: ["#05010f", "#2a0a4a", "#ff2bd6"], sun: ["#ffe36b", "#ff2bd6"], ground: ["#0d0420", "#0d0420"], road: ["#140a2a", "#120826"], rumble: ["#ff2bd6", "#2ee8ff"], lane: "#2ee8ff", fog: "#3a0e5e", far: "#2a0a4a", near: "#18062e", grid: true, stars: true, sprites: ["pyramid", "neon", "neon", "pyramid"] },
];
const STAGE_SEGS = 2600, TIME_START = 62, TIME_BONUS = [0, 52, 50, 48, 46];
const SAVE = K.load("sunsetdrive.v1", { best: 0, bestTime: 0, cleared: false, autoGas: null, runs: 0 });
const persist = () => K.save("sunsetdrive.v1", SAVE);

/* ================= track ================= */
let SEGS = [], TRACK_LEN = 0, STAGE_END = [];
const ease = { in: (a, b, p) => a + (b - a) * p * p, inOut: (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5) };
function lastY() { return SEGS.length ? SEGS[SEGS.length - 1].p2.w.y : 0; }
function addSeg(curve, y, st) { const n = SEGS.length; SEGS.push({ i: n, p1: { w: { y: lastY(), z: n * SEG }, c: {}, s: {} }, p2: { w: { y, z: (n + 1) * SEG }, c: {}, s: {} }, curve, sprites: [], cars: [], st, light: Math.floor(n / RUMBLE) % 2 }); }
function addRoad(enter, hold, leave, curve, y, st) { const sy = lastY(), ey = sy + y * SEG, tot = enter + hold + leave; for (let n = 0; n < enter; n++) addSeg(ease.in(0, curve, n / enter), ease.inOut(sy, ey, n / tot), st); for (let n = 0; n < hold; n++) addSeg(curve, ease.inOut(sy, ey, (enter + n) / tot), st); for (let n = 0; n < leave; n++) addSeg(ease.inOut(curve, 0, n / leave), ease.inOut(sy, ey, (enter + hold + n) / tot), st); }
function buildTrack() {
  SEGS = []; STAGE_END = [];
  for (let st = 0; st < THEMES.length; st++) {
    const rng = K.RNG(1000 + st * 77), start = SEGS.length, endAt = start + STAGE_SEGS, R = (a, b) => a + rng() * (b - a);
    addRoad(25, 50, 25, 0, 0, st);
    while (SEGS.length < endAt - 160) {
      const k = rng(), len = (R(20, 60)) | 0, curve = (rng() < 0.5 ? -1 : 1) * R(1.5, 5.5 + st * 0.5), hill = (rng() < 0.5 ? -1 : 1) * R(10, 50 + st * 12);
      if (k < 0.18) addRoad(len, len, len, 0, 0, st);
      else if (k < 0.48) addRoad(len, len * 1.4 | 0, len, curve, rng() < 0.5 ? hill * 0.6 : 0, st);
      else if (k < 0.66) { addRoad(len, len, len, curve, 0, st); addRoad(len, len, len, -curve, 0, st); }
      else if (k < 0.84) addRoad(len, len, len, 0, hill, st);
      else { for (let i = 0; i < 3; i++) addRoad(14, 14, 14, 0, (i % 2 ? -1 : 1) * R(8, 20), st); }
    }
    // level out toward the checkpoint
    addRoad(40, Math.max(0, endAt - SEGS.length - 80), 40, 0, -lastY() / SEG * 0.6, st);
    while (SEGS.length < endAt) addSeg(0, lastY(), st);
    STAGE_END.push(SEGS.length - 1);
    // roadside sprites
    const T = THEMES[st];
    for (let i = start + 30; i < endAt - 20; i += 3 + ((rng() * 4) | 0)) { const s = SEGS[i], side = rng() < 0.5 ? -1 : 1, kind = T.sprites[(rng() * T.sprites.length) | 0]; s.sprites.push({ k: kind, off: side * (1.25 + rng() * (kind === "building" ? 1.4 : 2.2)) }); if (rng() < 0.4) s.sprites.push({ k: kind, off: -side * (1.3 + rng() * 2.2) }); }
    for (let i = start + 60; i < endAt - 30; i += 120) SEGS[i].sprites.push({ k: "post", off: -1.15 }, { k: "post", off: 1.15 });
    SEGS[endAt - 4].sprites.push({ k: st === THEMES.length - 1 ? "goal" : "gate", off: 0 });
  }
  TRACK_LEN = SEGS.length * SEG;
}
const segAt = (z) => SEGS[Math.floor(z / SEG) % SEGS.length];

/* ================= sprites (drawn once) ================= */
const SPR = {};
function makeSprites() {
  const mk = (w, h, ww, draw, solid = true) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return { c, w, h, ww, solid }; };
  SPR.palm = mk(220, 360, 0.7, (g, w, h) => { g.strokeStyle = "#7a4a2a"; g.lineWidth = 18; g.lineCap = "round"; g.beginPath(); g.moveTo(w * 0.52, h); g.quadraticCurveTo(w * 0.62, h * 0.55, w * 0.45, h * 0.22); g.stroke(); g.fillStyle = "#2f9a5a"; for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.48; g.save(); g.translate(w * 0.45, h * 0.22); g.rotate(a); g.beginPath(); g.ellipse(0, -55, 22, 70, 0, 0, TAU); g.fill(); g.restore(); } g.fillStyle = "#6b3f1f"; g.beginPath(); g.arc(w * 0.45, h * 0.24, 12, 0, TAU); g.fill(); });
  SPR.umbrella = mk(200, 200, 0.45, (g, w, h) => { g.strokeStyle = "#ddd"; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2, h * 0.3); g.lineTo(w / 2, h); g.stroke(); const cols = ["#ff4f6e", "#fff", "#2ee8ff", "#fff"]; for (let k = 0; k < 4; k++) { g.fillStyle = cols[k]; g.beginPath(); g.moveTo(w / 2, h * 0.12); g.arc(w / 2, h * 0.35, w * 0.45, Math.PI + (k * Math.PI) / 4, Math.PI + ((k + 1) * Math.PI) / 4); g.fill(); } }, false);
  SPR.sign = mk(240, 200, 0.6, (g, w, h) => { g.fillStyle = "#555"; g.fillRect(w * 0.2, h * 0.5, 10, h * 0.5); g.fillRect(w * 0.75, h * 0.5, 10, h * 0.5); g.fillStyle = "#1f6f3f"; K.roundRect(g, 4, 4, w - 8, h * 0.55, 10); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 5; g.stroke(); g.fillStyle = "#fff"; g.font = "800 40px Kanit"; g.textAlign = "center"; g.fillText("SUNSET", w / 2, h * 0.3); g.font = "700 26px Kanit"; g.fillText("→ 5 km", w / 2, h * 0.48); });
  SPR.building = mk(300, 520, 1.5, (g, w, h) => { const cols = ["#2b2450", "#33285e", "#1f2a52"]; g.fillStyle = cols[(Math.random() * 3) | 0]; g.fillRect(0, h * 0.08, w, h); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(w * 0.8, h * 0.08, w * 0.2, h); for (let y = h * 0.14; y < h - 30; y += 34) for (let x = 18; x < w - 30; x += 40) { g.fillStyle = Math.random() < 0.55 ? (Math.random() < 0.5 ? "#ffe79a" : "#7ff0ff") : "#1a1636"; g.fillRect(x, y, 22, 18); } g.fillStyle = "#ff4f9a"; g.fillRect(0, h * 0.08, w, 6); });
  SPR.lamp = mk(120, 420, 0.25, (g, w, h) => { g.fillStyle = "#3a3d55"; g.fillRect(w * 0.45, h * 0.1, 10, h); g.fillRect(w * 0.45, h * 0.1, w * 0.5, 8); const gr = g.createRadialGradient(w * 0.9, h * 0.13, 0, w * 0.9, h * 0.13, 40); gr.addColorStop(0, "rgba(255,230,150,1)"); gr.addColorStop(1, "rgba(255,230,150,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h * 0.3); });
  SPR.billboard = mk(360, 260, 1.0, (g, w, h) => { g.fillStyle = "#333"; g.fillRect(w * 0.3, h * 0.55, 12, h); g.fillRect(w * 0.66, h * 0.55, 12, h); const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#ff2bd6"); gr.addColorStop(1, "#2ee8ff"); g.fillStyle = gr; g.fillRect(6, 6, w - 12, h * 0.55); g.fillStyle = "#fff"; g.font = "800 italic 54px Kanit"; g.textAlign = "center"; g.fillText("DRIVE", w / 2, h * 0.38); });
  SPR.cactus = mk(160, 260, 0.4, (g, w, h) => { g.fillStyle = "#3f8f4f"; K.roundRect(g, w * 0.4, h * 0.15, w * 0.22, h * 0.85, 16); g.fill(); K.roundRect(g, w * 0.12, h * 0.35, w * 0.16, h * 0.35, 12); g.fill(); g.fillRect(w * 0.12, h * 0.6, w * 0.3, w * 0.12); K.roundRect(g, w * 0.72, h * 0.25, w * 0.16, h * 0.3, 12); g.fill(); g.fillRect(w * 0.6, h * 0.48, w * 0.28, w * 0.12); g.fillStyle = "rgba(255,255,255,0.15)"; g.fillRect(w * 0.45, h * 0.2, 5, h * 0.75); });
  SPR.rock = mk(260, 150, 0.6, (g, w, h) => { g.fillStyle = "#8a5a44"; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.15, h * 0.35); g.lineTo(w * 0.4, h * 0.1); g.lineTo(w * 0.75, h * 0.2); g.lineTo(w, h); g.fill(); g.fillStyle = "rgba(255,255,255,0.15)"; g.beginPath(); g.moveTo(w * 0.15, h * 0.35); g.lineTo(w * 0.4, h * 0.1); g.lineTo(w * 0.45, h * 0.5); g.fill(); });
  SPR.pine = mk(220, 380, 0.6, (g, w, h) => { g.fillStyle = "#5a3a22"; g.fillRect(w * 0.45, h * 0.8, w * 0.1, h * 0.2); for (let k = 0; k < 4; k++) { const y = h * (0.1 + k * 0.18), ww = w * (0.25 + k * 0.1); g.fillStyle = k % 2 ? "#245f45" : "#2c6f50"; g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + ww, y + h * 0.28); g.lineTo(w / 2 - ww, y + h * 0.28); g.fill(); g.fillStyle = "rgba(255,255,255,0.75)"; g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + ww * 0.4, y + h * 0.1); g.lineTo(w / 2 - ww * 0.4, y + h * 0.1); g.fill(); } });
  SPR.pyramid = mk(400, 300, 1.6, (g, w, h) => { g.fillStyle = "#12052a"; g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, 0); g.lineTo(w, h); g.fill(); g.strokeStyle = "#ff2bd6"; g.lineWidth = 6; g.stroke(); g.strokeStyle = "rgba(46,232,255,0.6)"; g.lineWidth = 3; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(w / 2 - (w / 2) * (k / 5), h * (k / 5)); g.lineTo(w / 2 + (w / 2) * (k / 5), h * (k / 5)); g.stroke(); } });
  SPR.neon = mk(100, 380, 0.22, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#2ee8ff"); gr.addColorStop(1, "#ff2bd6"); g.fillStyle = gr; g.fillRect(w * 0.4, 0, w * 0.2, h); g.fillStyle = "rgba(46,232,255,0.25)"; g.fillRect(w * 0.2, 0, w * 0.6, h); });
  SPR.post = mk(60, 200, 0.12, (g, w, h) => { g.fillStyle = "#eee"; g.fillRect(w * 0.3, 0, w * 0.4, h); g.fillStyle = "#ff3b3b"; g.fillRect(w * 0.3, h * 0.1, w * 0.4, h * 0.12); }, true);
  const gate = (label) => mk(1000, 420, 2.6, (g, w, h) => { g.fillStyle = "#222"; g.fillRect(0, h * 0.18, 50, h); g.fillRect(w - 50, h * 0.18, 50, h); const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#ff2bd6"); gr.addColorStop(0.5, "#ffcd4f"); gr.addColorStop(1, "#2ee8ff"); g.fillStyle = gr; g.fillRect(0, 0, w, h * 0.24); g.fillStyle = "#1a0b2e"; g.font = "800 italic 82px Kanit"; g.textAlign = "center"; g.fillText(label, w / 2, h * 0.19); for (let k = 0; k < 20; k++) { g.fillStyle = k % 2 ? "#fff" : "#111"; g.fillRect((w / 20) * k, h * 0.24, w / 20, 16); } }, false);
  SPR.gate = gate("CHECKPOINT"); SPR.goal = gate("GOAL");
  for (const col of ["#3fa9ff", "#ffcd4f", "#6bff9e", "#ffffff", "#ff7a3d", "#b97aff"]) SPR["car" + col] = carSprite(col, false);
  SPR.player = carSprite("#ff3b5c", true);
}
function carSprite(col, me) {
  const c = document.createElement("canvas"), w = 240, h = 130; c.width = w; c.height = h; const g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(w / 2, h - 10, w * 0.48, 12, 0, 0, TAU); g.fill();
  g.fillStyle = "#15151c"; g.fillRect(14, h - 46, 36, 34); g.fillRect(w - 50, h - 46, 36, 34);
  g.fillStyle = col; g.beginPath(); g.moveTo(10, h - 30); g.lineTo(18, h - 70); g.lineTo(54, h - 82); g.lineTo(w - 54, h - 82); g.lineTo(w - 18, h - 70); g.lineTo(w - 10, h - 30); g.closePath(); g.fill();
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(10, h - 42, w - 20, 12);
  g.fillStyle = me ? "#2a2f45" : "#1e2235"; g.beginPath(); g.moveTo(60, h - 82); g.lineTo(80, h - 112); g.lineTo(w - 80, h - 112); g.lineTo(w - 60, h - 82); g.closePath(); g.fill();
  g.fillStyle = "rgba(160,220,255,0.45)"; g.beginPath(); g.moveTo(70, h - 84); g.lineTo(86, h - 106); g.lineTo(w - 86, h - 106); g.lineTo(w - 70, h - 84); g.closePath(); g.fill();
  g.fillStyle = "#ff2a3a"; g.fillRect(20, h - 66, 42, 12); g.fillRect(w - 62, h - 66, 42, 12); g.fillStyle = "#ffd0d0"; g.fillRect(24, h - 63, 12, 6); g.fillRect(w - 36, h - 63, 12, 6);
  g.fillStyle = "#e8e8f0"; g.fillRect(w / 2 - 26, h - 52, 52, 12); g.fillStyle = "#222"; g.font = "800 10px Kanit"; g.textAlign = "center"; g.fillText(me ? "SUNSET" : "", w / 2, h - 43);
  return { c, w, h, ww: 0.36, solid: true };
}

/* ================= state ================= */
let G = null;
function newRun(mode) {
  if (!SEGS.length) buildTrack();
  if (SAVE.autoGas === null) SAVE.autoGas = K.device === "touch";
  G = { mode, pos: 0, x: 0, speed: 0, time: TIME_START, elapsed: 0, score: 0, stage: 0, over: false, finished: false, sky: 0, hills: 0, trees: 0, shake: 0, steer: 0, cars: [], passed: 0, near: 0, pops: [], count: 3.2, crashT: 0 };
  // traffic
  for (const s of SEGS) s.cars = [];
  for (let n = 0; n < 180; n++) { const z = (2000 + Math.random() * (TRACK_LEN - 4000)), off = [-0.66, 0, 0.66][(Math.random() * 3) | 0] + (Math.random() - 0.5) * 0.1, col = ["#3fa9ff", "#ffcd4f", "#6bff9e", "#ffffff", "#ff7a3d", "#b97aff"][(Math.random() * 6) | 0]; const car = { z, off, speed: MAXV * (0.28 + Math.random() * 0.32), spr: SPR["car" + col], ahead: true }; G.cars.push(car); segAt(z).cars.push(car); }
  SAVE.runs++; persist(); K.ui.hide(); $("#pauseBtn").hidden = false; touchUI(); K.playSong(mode === "cruise" ? "cruise" : "drive", 3); K.sfx("count");
}

/* ================= update ================= */
const IN = { l: false, r: false, b: false };
function update(dt) {
  if (!G) return;
  const seg = segAt(G.pos + PLAYER_Z), sp = G.speed / MAXV;
  if (G.mode === "demo") { G.x = lerp(G.x, 0.3 * Math.sin(G.pos / 9000), dt * 2) + seg.curve * 0.0004; G.pos = (G.pos + G.speed * dt) % TRACK_LEN; G.sky = (G.sky + 0.0012 * seg.curve * sp) % 1; G.hills = (G.hills + 0.002 * seg.curve * sp) % 1; G.steer = lerp(G.steer, clamp(seg.curve / 4, -1, 1), dt * 3); return; }
  if (G.count > 0) { const b = Math.ceil(G.count); G.count -= dt; if (Math.ceil(G.count) !== b) K.sfx(G.count > 0 ? "count" : "go"); engine(0.1); return; }
  if (!G.over) { G.time -= G.mode === "cruise" ? 0 : dt; G.elapsed += dt; if (G.time <= 0) { G.time = 0; endRun(false); } }
  // input
  let steer = 0, gas = false, brake = false;
  if (!G.over) {
    if (K.held("ArrowLeft", "KeyA") || IN.l) steer -= 1; if (K.held("ArrowRight", "KeyD") || IN.r) steer += 1;
    gas = K.held("ArrowUp", "KeyW", "KeyZ", "Space") || SAVE.autoGas; brake = K.held("ArrowDown", "KeyS", "KeyX") || IN.b;
    const P = K.pad; if (P.connected) { steer += P.ax; if (P.held.dl) steer -= 1; if (P.held.dr) steer += 1; if (P.held.a || P.rt > 0.2 || P.held.rb) gas = true; if (P.held.b || P.lt > 0.2 || P.held.x || P.held.lb) brake = true; if (P.pressed.start) pause(); }
    steer = clamp(steer, -1, 1);
  }
  G.steer = lerp(G.steer, steer, Math.min(1, dt * 10));
  const dx = dt * 2.1 * sp;
  G.x += G.steer * dx; G.x -= dx * sp * seg.curve * CENTRI;
  if (brake) G.speed += BRAKE * dt; else if (gas) G.speed += ACCEL * dt * (1 - sp * 0.4); else G.speed += DECEL * dt;
  if (G.over) G.speed += DECEL * 1.5 * dt;
  if (Math.abs(G.x) > 1) { if (G.speed > OFF_LIMIT) G.speed += OFF_DECEL * dt; G.shake = Math.max(G.shake, 0.06); if (Math.random() < dt * 8) K.sfx("gravel");
    for (const s of seg.sprites) { const S = SPR[s.k]; if (!S.solid) continue; const sw = S.ww, sx = s.off + (s.off > 0 ? sw / 2 : -sw / 2); if (Math.abs(G.x - sx) < (0.36 + sw) / 2 * 0.9) { crash(); G.pos = (seg.p1.w.z - PLAYER_Z + TRACK_LEN) % TRACK_LEN; break; } } }
  // traffic
  for (const car of G.cars) {
    const old = segAt(car.z); car.z = (car.z + car.speed * dt) % TRACK_LEN; const ns = segAt(car.z); if (ns !== old) { old.cars.splice(old.cars.indexOf(car), 1); ns.cars.push(car); }
    // gentle lane keeping: dodge the player if just ahead
    const dz = ((car.z - G.pos - PLAYER_Z) % TRACK_LEN + TRACK_LEN) % TRACK_LEN;
    if (dz < SEG * 12 && G.speed > car.speed && Math.abs(car.off - G.x) < 0.5 && Math.random() < dt * 0.6) car.toff = clamp(car.off + (car.off > G.x ? 0.7 : -0.7), -0.8, 0.8);
    if (car.toff !== undefined) { car.off = lerp(car.off, car.toff, dt * 1.5); if (Math.abs(car.off - car.toff) < 0.02) car.toff = undefined; }
  }
  for (const car of seg.cars) if (G.speed > car.speed && Math.abs(G.x - car.off) < 0.36 * 0.85) { G.speed = car.speed * (car.speed / G.speed); G.pos = (car.z - PLAYER_Z - 10 + TRACK_LEN) % TRACK_LEN; crash(true); break; }
  // overtakes and close calls
  for (let k = 0; k < 2; k++) { const s2 = SEGS[(seg.i - k + SEGS.length) % SEGS.length]; for (const car of s2.cars) { const behind = car.z < G.pos + PLAYER_Z - 30 || (seg.i < 5 && car.z > TRACK_LEN - 2000); if (car.ahead && behind) { car.ahead = false; G.passed++; const near = Math.abs(car.off - G.x) < 0.62; addScore(near ? 250 : 50); if (near) { G.near++; pop("CLOSE CALL! +250", "#ffcd4f"); K.sfx("near"); } } } }
  G.speed = clamp(G.speed, 0, MAXV); G.x = clamp(G.x, -3, 3);
  const before = G.pos; G.pos = (G.pos + G.speed * dt) % TRACK_LEN; if (G.pos < before && G.mode === "cruise") for (const c of G.cars) c.ahead = true;
  if (!G.over) addScore(G.speed * dt / 40);
  // checkpoints
  const si = segAt(G.pos + PLAYER_Z).i;
  if (G.mode === "arcade" && !G.over && G.stage < STAGE_END.length && si >= STAGE_END[G.stage] - 3 && si < STAGE_END[G.stage] + 60) {
    G.stage++;
    if (G.stage >= THEMES.length) { G.finished = true; endRun(true); }
    else { const bonus = TIME_BONUS[G.stage]; G.time += bonus; K.banner("CHECKPOINT", `+${bonus} seconds · ${THEMES[G.stage].name}`, 2200); K.sfx("checkpoint"); addScore(5000); }
  }
  if (G.mode === "cruise") G.stage = segAt(G.pos + PLAYER_Z).st;
  // parallax
  G.sky = (G.sky + 0.0012 * seg.curve * sp) % 1; G.hills = (G.hills + 0.002 * seg.curve * sp) % 1;
  G.shake = Math.max(0, G.shake - dt); G.crashT = Math.max(0, G.crashT - dt);
  for (const q of G.pops) q.t += dt; G.pops = G.pops.filter((q) => q.t < 1.4);
  if (Math.abs(G.steer) > 0.6 && sp > 0.75 && Math.abs(seg.curve) > 2 && Math.random() < dt * 3) K.sfx("screech");
  engine(G.over ? 0.3 : 1);
}
function crash(car) { if (G.crashT > 0) return; G.crashT = 0.6; G.shake = 0.5; K.sfx(car ? "bump" : "crash"); K.vibrate(90); if (!car) G.speed = MAXV / 6; }
function addScore(n) { G.score += n; }
function pop(text, col) { G.pops.push({ text, col, t: 0 }); }
function endRun(won) {
  if (G.over) return; G.over = true;
  if (won) { const bonus = Math.round(G.time) * 1000; addScore(bonus); K.banner("GOAL!", `Time bonus +${K.fmt(bonus)}`, 3000); K.sfx("goal"); if (!SAVE.bestTime || G.elapsed < SAVE.bestTime) SAVE.bestTime = Math.round(G.elapsed * 100) / 100; SAVE.cleared = true; }
  else { K.banner("TIME UP", "", 2000); K.sfx("timeup"); }
  G.score = Math.round(G.score); G.pb = G.score > SAVE.best; if (G.pb) SAVE.best = G.score; persist(); K.musicLevel(0);
  const g = G; setTimeout(() => { if (G === g) results(won); }, 3200);
}
/* engine drone that follows speed */
let ENG = null;
function engine(vol) {
  const ac = K.AU.ctx; if (!ac || ac.state !== "running") return;
  if (!ENG) { const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), gn = ac.createGain(); o1.type = "sawtooth"; o2.type = "square"; o2.detune.value = 7; f.type = "lowpass"; f.frequency.value = 700; gn.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(gn); gn.connect(K.AU.sfxBus); o1.start(); o2.start(); ENG = { o1, o2, f, gn }; }
  const sp = G ? G.speed / MAXV : 0, gear = Math.min(4, Math.floor(sp * 5)), rpm = (sp * 5 - gear), hz = 42 + gear * 9 + rpm * 70;
  ENG.o1.frequency.setTargetAtTime(hz, ac.currentTime, 0.05); ENG.o2.frequency.setTargetAtTime(hz * 0.5, ac.currentTime, 0.05); ENG.f.frequency.setTargetAtTime(400 + sp * 1600, ac.currentTime, 0.1);
  ENG.gn.gain.setTargetAtTime(G && !K.ui.active() && !document.hidden ? (0.02 + sp * 0.035) * vol : 0, ac.currentTime, 0.08);
}

/* ================= render ================= */
const cv = $("#cv"), ctx = cv.getContext("2d");
const V = { W: 0, H: 0, dpr: 1 };
let BG = {};
function layout() { V.W = innerWidth; V.H = innerHeight; V.dpr = K.fit(cv, V.W, V.H).dpr; BG = {}; }
addEventListener("resize", layout);
function project(p, camX, camY, camZ) { p.c.x = -camX; p.c.y = p.w.y - camY; p.c.z = p.w.z - camZ; p.s.scale = CAM_DEPTH / p.c.z; p.s.x = Math.round(V.W / 2 + (p.s.scale * p.c.x * V.W) / 2); p.s.y = Math.round(V.H / 2 - (p.s.scale * p.c.y * V.H) / 2); p.s.w = Math.round((p.s.scale * ROAD_W * V.W) / 2); }
function poly(x1, y1, x2, y2, x3, y3, x4, y4, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill(); }
function layerCanvas(st, kind) {
  const key = st + kind; if (BG[key]) return BG[key];
  const T = THEMES[st], w = Math.ceil(V.W * 2), h = Math.ceil(V.H * 0.6), c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"), rng = K.RNG(st * 13 + (kind === "far" ? 1 : 2));
  g.fillStyle = kind === "far" ? T.far : T.near; g.beginPath(); g.moveTo(0, h);
  const n = kind === "far" ? 9 : 16; let y = h * 0.5;
  for (let i = 0; i <= n * 4; i++) { const x = (i / (n * 4)) * w; const base = kind === "far" ? h * (0.35 + 0.25 * Math.sin(i * 0.37 + st) + rng() * 0.15) : h * (0.62 + 0.18 * Math.sin(i * 0.9 + st * 2) + rng() * 0.08); y = lerp(y, base, 0.5); g.lineTo(x, y); }
  g.lineTo(w, h); g.closePath(); g.fill();
  if (T.snow && kind === "far") { g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(255,255,255,0.55)"; g.fillRect(0, 0, w, h * 0.42); g.globalCompositeOperation = "source-over"; }
  if (kind === "near" && st === 1) for (let x = 0; x < w; x += 40 + rng() * 60) { const bh = h * (0.25 + rng() * 0.5); g.fillStyle = "#120a28"; g.fillRect(x, h - bh, 30 + rng() * 40, bh); g.fillStyle = "rgba(255,230,150,0.5)"; for (let k = 0; k < 6; k++) g.fillRect(x + 4 + rng() * 30, h - bh + 6 + rng() * (bh - 10), 4, 4); }
  return (BG[key] = c);
}
function background(T, st, horizon) {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, T.sky[0]); sky.addColorStop(0.6, T.sky[1]); sky.addColorStop(1, T.sky[2]); ctx.fillStyle = sky; ctx.fillRect(0, 0, V.W, horizon + 2);
  if (T.stars) { const r = K.RNG(5); ctx.fillStyle = "rgba(255,255,255,0.8)"; for (let k = 0; k < 90; k++) { const x = ((r() + G.sky * 0.3) % 1) * V.W, y = r() * horizon * 0.6; ctx.fillRect(x, y, 1.6, 1.6); } }
  // striped sun
  const sr = Math.min(V.W, V.H) * 0.22, sx = V.W / 2 - G.sky * V.W * 0.6 + ((G.sky < 0 ? 1 : 0) * 0), sy = horizon - sr * 0.35;
  const sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr); sg.addColorStop(0, T.sun[0]); sg.addColorStop(1, T.sun[1]);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, V.W, horizon); ctx.clip(); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(((sx % V.W) + V.W) % V.W, sy, sr, 0, TAU); ctx.fill();
  ctx.fillStyle = T.sky[2]; for (let k = 0; k < 7; k++) { const yy = sy + sr * (0.1 + k * 0.13), hh = sr * 0.02 * (k + 1); ctx.fillRect(0, yy, V.W, hh); }
  ctx.restore();
  const far = layerCanvas(st, "far"), near = layerCanvas(st, "near"), fy = horizon - far.height * 0.62, ny = horizon - near.height * 0.75;
  const fo = ((G.sky * 2 % 1) + 1) % 1 * V.W, no = ((G.hills * 2 % 1) + 1) % 1 * V.W;
  ctx.drawImage(far, -fo, fy); ctx.drawImage(far, -fo + far.width, fy); ctx.drawImage(near, -no, ny); ctx.drawImage(near, -no + near.width, ny);
  if (T.sea) { const sea = ctx.createLinearGradient(0, horizon - 30, 0, horizon); sea.addColorStop(0, T.sea); sea.addColorStop(1, "#7fb2e0"); ctx.fillStyle = sea; ctx.fillRect(0, horizon - 26, V.W, 26); }
}
function render(dt) {
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  if (!G) { ctx.fillStyle = "#1a0b2e"; ctx.fillRect(0, 0, V.W, V.H); return; }
  const base = segAt(G.pos), bp = (G.pos % SEG) / SEG, pseg = segAt(G.pos + PLAYER_Z), pp = ((G.pos + PLAYER_Z) % SEG) / SEG, py = lerp(pseg.p1.w.y, pseg.p2.w.y, pp);
  const st = pseg.st, T = THEMES[st];
  let sh = G.shake > 0 ? (Math.random() - 0.5) * 8 * G.shake * 2 : 0; ctx.save(); ctx.translate(sh, sh * 0.6);
  let maxy = V.H, x = 0, dx = -(base.curve * bp);
  // project + draw road front to back with clipping
  const visible = [];
  for (let n = 0; n < DRAW; n++) {
    const s = SEGS[(base.i + n) % SEGS.length], looped = s.i < base.i;
    s.fog = 1 / Math.pow(Math.E, (n / DRAW) * (n / DRAW) * FOGD); s.clip = maxy;
    project(s.p1, G.x * ROAD_W - x, py + CAM_H, G.pos - (looped ? TRACK_LEN : 0));
    project(s.p2, G.x * ROAD_W - x - dx, py + CAM_H, G.pos - (looped ? TRACK_LEN : 0));
    x += dx; dx += s.curve;
    if (s.p1.c.z <= CAM_DEPTH || s.p2.s.y >= s.p1.s.y || s.p2.s.y >= maxy) continue;
    visible.push(s); maxy = s.p1.s.y;
  }
  const horizon = Math.max(V.H * 0.2, Math.min(V.H * 0.62, maxy));
  background(T, st, horizon);
  for (let k = visible.length - 1; k >= 0; k--) drawSeg(visible[k]);
  // sprites + cars back to front
  for (let n = DRAW - 1; n > 0; n--) {
    const s = SEGS[(base.i + n) % SEGS.length]; if (!s.p1.s.scale || s.p1.c.z <= CAM_DEPTH) continue;
    for (const sp of s.sprites) { const S = SPR[sp.k], scale = s.p1.s.scale, sx2 = s.p1.s.x + (scale * sp.off * ROAD_W * V.W) / 2, sy2 = s.p1.s.y; drawSprite(S, scale, sx2, sy2, sp.off < 0 ? -1 : sp.off > 0 ? 0 : -0.5, -1, s.clip, s.fog); }
    for (const car of s.cars) { const pr = ((car.z % SEG) / SEG), scale = lerp(s.p1.s.scale, s.p2.s.scale, pr), sx2 = lerp(s.p1.s.x, s.p2.s.x, pr) + (scale * car.off * ROAD_W * V.W) / 2, sy2 = lerp(s.p1.s.y, s.p2.s.y, pr); drawSprite(car.spr, scale, sx2, sy2, -0.5, -1, s.clip, s.fog); }
  }
  // player car
  const S = SPR.player, pscale = CAM_DEPTH / PLAYER_Z, bounce = (Math.random() - 0.5) * 2 * (G.speed / MAXV) * (Math.abs(G.x) > 1 ? 4 : 1.2);
  const pw = S.ww * ROAD_W * pscale * V.W / 2, ph = pw * S.h / S.w, ux = V.W / 2, uy = V.H - 12 + bounce;
  ctx.save(); ctx.translate(ux, uy); ctx.rotate(G.steer * 0.04 + (pseg.curve * (G.speed / MAXV)) * 0.006); ctx.drawImage(S.c, -pw / 2, -ph, pw, ph);
  if (G.speed > MAXV * 0.85) { ctx.fillStyle = `rgba(255,200,120,${0.4 + Math.random() * 0.4})`; ctx.fillRect(-pw * 0.36, -ph * 0.1, pw * 0.06, ph * 0.12); ctx.fillRect(pw * 0.3, -ph * 0.1, pw * 0.06, ph * 0.12); }
  ctx.restore();
  ctx.restore();
  if (G.mode !== "demo") hud(T);
}
function drawSeg(s) {
  const T = THEMES[s.st], l = s.light, x1 = s.p1.s.x, y1 = s.p1.s.y, w1 = s.p1.s.w, x2 = s.p2.s.x, y2 = s.p2.s.y, w2 = s.p2.s.w;
  ctx.fillStyle = T.ground[l]; ctx.fillRect(0, y2, V.W, y1 - y2 + 1);
  if (T.grid && l) { ctx.fillStyle = "rgba(255,43,214,0.55)"; ctx.fillRect(0, y2, V.W, Math.max(1, (y1 - y2) * 0.12)); }
  const r1 = w1 / 7, r2 = w2 / 7, lw1 = w1 / 40, lw2 = w2 / 40;
  poly(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, T.rumble[l]); poly(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, T.rumble[l]);
  poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, T.road[l]);
  if (l) { const lanes = 3; let lx1 = x1 - w1 + (w1 * 2) / lanes, lx2 = x2 - w2 + (w2 * 2) / lanes; for (let k = 1; k < lanes; k++) { poly(lx1 - lw1 / 2, y1, lx1 + lw1 / 2, y1, lx2 + lw2 / 2, y2, lx2 - lw2 / 2, y2, T.lane); lx1 += (w1 * 2) / lanes; lx2 += (w2 * 2) / lanes; } }
  if (s.fog < 1) { ctx.globalAlpha = 1 - s.fog; ctx.fillStyle = T.fog; ctx.fillRect(0, y2, V.W, y1 - y2 + 1); ctx.globalAlpha = 1; }
}
function drawSprite(S, scale, x, y, ox, oy, clipY, fog) {
  const dw = S.ww * ROAD_W * scale * V.W / 2, dh = dw * S.h / S.w; if (dw < 1 || dw > V.W * 3) return;
  const dx = x + dw * ox, dy = y + dh * oy, clipH = clipY ? Math.max(0, dy + dh - clipY) : 0; if (clipH >= dh) return;
  ctx.globalAlpha = Math.min(1, 0.25 + fog); ctx.drawImage(S.c, 0, 0, S.w, S.h - (S.h * clipH) / dh, dx, dy, dw, dh - clipH); ctx.globalAlpha = 1;
}
function hud(T) {
  const big = Math.max(26, Math.min(48, V.W / 22));
  ctx.textBaseline = "top"; ctx.font = `800 italic ${big * 0.42}px Kanit`; ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillText(G.mode === "cruise" ? "CRUISE" : "TIME", 18, 12);
  ctx.font = `800 italic ${big}px Kanit`; ctx.lineWidth = 6; ctx.strokeStyle = "rgba(20,6,34,0.6)";
  const tt = G.mode === "cruise" ? K.fmtTime(G.elapsed) : Math.ceil(G.time).toString(); ctx.strokeText(tt, 18, 12 + big * 0.45); ctx.fillStyle = G.mode !== "cruise" && G.time < 10 && Math.floor(G.time * 4) % 2 ? "#ff5a5a" : "#ffcd4f"; ctx.fillText(tt, 18, 12 + big * 0.45);
  ctx.textAlign = "right"; ctx.font = `800 italic ${big}px Kanit`; const kmh = Math.round((G.speed / MAXV) * 290); ctx.strokeText(kmh, V.W - 18, 12 + big * 0.45); ctx.fillStyle = "#fff"; ctx.fillText(kmh, V.W - 18, 12 + big * 0.45);
  ctx.font = `800 italic ${big * 0.42}px Kanit`; ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillText("KM/H", V.W - 18, 12);
  ctx.textAlign = "center"; ctx.font = `700 ${big * 0.4}px Kanit`; ctx.fillStyle = "#fff"; ctx.fillText(`${K.fmt(Math.round(G.score))}  ·  ${T.name.toUpperCase()}`, V.W / 2, 58);
  if (G.mode === "arcade") { const total = STAGE_END[THEMES.length - 1], prog = clamp(segAt(G.pos + PLAYER_Z).i / total, 0, 1), w = Math.min(320, V.W * 0.4), x0 = V.W / 2 - w / 2; ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x0, 84, w, 6); ctx.fillStyle = "#ff4f9a"; ctx.fillRect(x0, 84, w * prog, 6); ctx.fillStyle = "#fff"; for (const e of STAGE_END) ctx.fillRect(x0 + (e / total) * w - 1, 82, 2, 10); }
  for (const q of G.pops) { ctx.globalAlpha = 1 - q.t / 1.4; ctx.font = `800 italic ${big * 0.5}px Kanit`; ctx.fillStyle = q.col; ctx.fillText(q.text, V.W / 2, V.H * 0.32 - q.t * 30); ctx.globalAlpha = 1; }
  if (G.count > 0) { ctx.font = `800 italic ${big * 2.6}px Kanit`; ctx.textBaseline = "middle"; ctx.lineWidth = 10; const c = Math.ceil(G.count); const txt = G.count > 0.15 ? String(c) : "GO!"; ctx.strokeText(txt, V.W / 2, V.H * 0.42); ctx.fillStyle = "#ffcd4f"; ctx.fillText(txt, V.W / 2, V.H * 0.42); }
}

/* ================= input ================= */
function hold(el, key) { el.addEventListener("pointerdown", (e) => { e.preventDefault(); K.audio(); IN[key] = true; el.setPointerCapture(e.pointerId); }); const up = () => { IN[key] = false; }; el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); }
hold($("#tLeft"), "l"); hold($("#tRight"), "r"); hold($("#tBrake"), "b");
function touchUI() { const on = !!G && !G.over && G.mode !== "demo" && (K.device === "touch" || matchMedia("(pointer: coarse)").matches); for (const id of ["#tLeft", "#tRight", "#tBrake"]) $(id).hidden = !on; }
addEventListener("keydown", (e) => { if (!G || G.mode === "demo" || K.ui.active()) return; if (e.code === "Escape" || e.code === "KeyP") pause(); if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault(); });
$("#pauseBtn").onclick = () => pause();

/* ================= audio ================= */
K.defineSfx({
  count: (t) => K.voice(660, t, 0.15, { duty: 0.25, vol: 0.05 }), go: (t) => K.voice(1320, t, 0.4, { duty: 0.25, vol: 0.06 }),
  crash: (t) => { K.noise(t, 0.6, { filter: "lowpass", freq: 1200, slide: 0.3, vol: 0.22 }); K.voice(90, t, 0.4, { type: "square", vol: 0.08, slide: 0.5, lp: 600 }); },
  bump: (t) => { K.noise(t, 0.25, { filter: "bandpass", freq: 700, vol: 0.14 }); K.voice(140, t, 0.15, { type: "square", vol: 0.05, lp: 800 }); },
  screech: (t) => K.noise(t, 0.3, { filter: "bandpass", freq: 3200, q: 8, vol: 0.05 }),
  gravel: (t) => K.noise(t, 0.08, { filter: "lowpass", freq: 600, vol: 0.05 }),
  near: (t) => K.voice(880, t, 0.18, { type: "triangle", vol: 0.05, slide: 1.5 }),
  checkpoint: (t) => K.notes(t, [784, 988, 1175, 1568], 0.08, { duty: 0.25, vol: 0.05, len: 0.25 }),
  goal: (t) => K.notes(t, [523, 659, 784, 1046, 1318, 1568, 2093], 0.09, { duty: 0.25, vol: 0.055, len: 0.4 }),
  timeup: (t) => K.notes(t, [440, 392, 349, 262], 0.2, { type: "sawtooth", vol: 0.05, len: 0.4, lp: 1500 }),
}, { screech: 0.25, gravel: 0.06 });
K.songs({
  drive: { bpm: 112, chords: ["Am", "F", "C", "G", "Am", "F", "C", "E"], bass: "R R O R R R O R R R O R R R O R", bassWave: "sawtooth", bassVol: 0.07, bassLp: 700, drums: "k . . . s . . . k . k . s . . .", pad: true, padVol: 0.02, padWave: "sawtooth", arp: true, arpVol: 0.016, arpPat: [0, 1, 2, 3, 2, 1, 0, 2], arpWave: 0.25,
    lead: ["e5 - - - a5 - - -", "c6 - - - a5 - g5 -", "g5 - - - e5 - c5 -", "d5 - - - - - - -", "e5 - a5 - c6 - e6 -", "d6 - c6 - a5 - - -", "g5 - c6 - e6 - g6 -", "g#6 - - - - - - -"], leadVol: 0.035, leadWave: "sawtooth", vib: 5 },
  cruise: { bpm: 96, chords: ["Fm", "Db", "Ab", "Eb"], bass: "R . . R . . O . R . . R . . O .", bassWave: "sawtooth", bassVol: 0.07, bassLp: 600, drums: "k . . . s . . . k . . k s . . .", pad: true, padVol: 0.024, padWave: "sawtooth", arp: true, arpVol: 0.014, arpPat: [0, 2, 1, 2], arpWave: "triangle" },
  menu: { bpm: 96, chords: ["Am", "F", "C", "G"], pad: true, padVol: 0.024, padWave: "sawtooth", bass: "R . . . . . . . R . . . . . . .", bassWave: "sawtooth", bassVol: 0.06, bassLp: 600, arp: true, arpVol: 0.014, arpPat: [0, 1, 2, 1], arpWave: "triangle" },
});

/* ================= screens ================= */
function startDemo() { G = { mode: "demo", pos: (Math.random() * TRACK_LEN) | 0, x: 0, speed: MAXV * 0.62, time: 0, elapsed: 0, score: 0, stage: 0, over: false, sky: 0, hills: 0, shake: 0, steer: 0, cars: [], passed: 0, near: 0, pops: [], count: 0, crashT: 0 }; for (const s2 of SEGS) s2.cars = []; }
function title() {
  startDemo(); $("#pauseBtn").hidden = true; touchUI(); K.playSong("menu", 2); if (ENG) ENG.gn.gain.value = 0;
  K.ui.show(`<div class="logo">SUNSET<br>DRIVE</div><p class="k-sub">Race the clock through five stages into the sunset. Weave past traffic and hit every checkpoint.</p>
    <div class="modes"><button class="k-btn mode" data-a="arcade" autofocus><b>ARCADE RUN</b><span>Five stages. Checkpoints add time.</span><em>${SAVE.best ? "Best " + K.fmt(SAVE.best) : "No score yet"}${SAVE.bestTime ? " · finished in " + K.fmtTime(SAVE.bestTime) : ""}</em></button>
    <button class="k-btn mode" data-a="cruise"><b>CRUISE</b><span>No clock. Just drive and listen.</span><em>All five stages, looping</em></button></div>
    <div class="k-row"><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>`, { cls: "soft" });
}
function pause() { if (!G || G.over || G.mode === "demo" || K.ui.active()) return; K.ui.show(`<div class="logo" style="font-size:2.6em">PAUSED</div><div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="${G.mode}">Restart</button><button class="k-btn" data-a="settings" data-from="menu">Settings</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "resume" }); }
function results(won) {
  K.ui.show(`<div class="logo" style="font-size:2.6em">${won ? "GOAL!" : "TIME UP"}</div><p class="k-sub">${won ? `Finished in ${K.fmtTime(G.elapsed)}` : `Reached ${THEMES[Math.min(G.stage, THEMES.length - 1)].name}`}</p>
    <div class="k-stats"><div class="k-stat"><small>Score</small><b>${K.fmt(G.score)}</b></div><div class="k-stat"><small>Cars passed</small><b>${G.passed}</b></div><div class="k-stat"><small>Close calls</small><b>${G.near}</b></div></div>${G.pb ? `<b style="color:var(--gold)">New best score!</b>` : ""}
    <div class="k-row"><button class="k-btn primary" data-a="arcade" autofocus>Drive again</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "title" });
}
function settings(from) {
  const back = from === "menu" ? "pauseback" : "title";
  const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center"><div class="k-opt"><span>Accelerate automatically</span><button class="k-btn small" data-a="gas">${SAVE.autoGas ? "On" : "Off"}</button></div>${K.ui.settingsRows()}</div>`, { back, cls: "top" });
  K.ui.bindSettings(s);
}
function help() {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="k-help"><div><b>Drive</b>↑ or W accelerates, ↓ or S brakes, ← → steer. Curves push you outward, so steer into them.</div><div><b>Beat the clock</b>Each checkpoint adds time. Reach the goal at the end of the fifth stage with time to spare for a bonus.</div>
    <div><b>Traffic</b>Bumping a car or a roadside object costs speed. Passing close to a car earns a close-call bonus.</div><div class="k-touchonly"><b>Touch</b>The car accelerates by itself. Hold ◀ ▶ to steer and BRAKE to slow down.</div><div><b>Controller</b>Stick steers, A or RT accelerates, B or LT brakes.</div></div>`, { back: "title", cls: "top" });
}
K.ui.on((a, d) => {
  switch (a) {
    case "arcade": K.sfx("ok"); return newRun("arcade");
    case "cruise": K.sfx("ok"); return newRun("cruise");
    case "title": K.sfx("back"); return title();
    case "resume": K.ui.hide(); return;
    case "pauseback": K.ui.hide(); return pause();
    case "settings": K.sfx("ok"); return settings(d.from);
    case "help": K.sfx("ok"); return help();
    case "gas": SAVE.autoGas = !SAVE.autoGas; persist(); return settings(G && !G.over ? "menu" : "");
  }
});
K.onPause(() => { if (G && !G.over && G.mode !== "demo" && !K.ui.active()) pause(); IN.l = IN.r = IN.b = false; });

/* ================= boot ================= */
layout(); makeSprites(); buildTrack(); title();
document.fonts.load("800 italic 40px Kanit").then(() => { makeSprites(); }).catch(() => {});
K.loop((dt) => { if (G && (!K.ui.active() || G.mode === "demo")) update(dt); if (!G || G.mode === "demo" || K.ui.active()) engine(0); render(dt); });
