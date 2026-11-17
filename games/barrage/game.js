"use strict";
/* BARRAGE — turn-based artillery. Destructible terrain, wind, ten weapons, CPU gunners that aim by
   simulating their shots, and hotseat battles for up to four players. */
const { $, $$, clamp, TAU } = K;
const SAVE = K.load("barrage.v1", { setup: { n: 2, types: ["human", "normal", "normal", "normal"], rounds: 3, terrain: "random" }, assist: true, fast: false, stats: { matches: 0, wins: 0, shots: 0, kills: 0 } });
const persist = () => K.save("barrage.v1", SAVE);
const W = 1600, H = 900, GRAV = 420, MAXV = 780, WINDK = 9, TR = 15, FUEL = 90;
const TEAM = [{ name: "Crimson", c: "#ff5a5a", d: "#a8262a" }, { name: "Azure", c: "#4ab0ff", d: "#1f5f9a" }, { name: "Jade", c: "#5fe08a", d: "#237a45" }, { name: "Amber", c: "#ffc93a", d: "#a3740e" }];
const TYPES = { human: "Human", easy: "CPU · Easy", normal: "CPU · Normal", hard: "CPU · Hard" };
const WEAPONS = [
  { id: "shell", name: "Shell", ammo: Infinity, r: 34, dmg: 36, col: "#ffd479", desc: "A dependable high-explosive shell." },
  { id: "heavy", name: "Heavy Shell", ammo: 3, r: 58, dmg: 52, col: "#ff8a3a", desc: "A huge blast that tears up the ground." },
  { id: "triple", name: "Triple Shot", ammo: 2, r: 26, dmg: 24, col: "#ffe27a", desc: "Three shells fired in a narrow fan." },
  { id: "split", name: "Splitter", ammo: 2, r: 28, dmg: 26, col: "#c39bff", desc: "Splits into three shells at the top of its arc." },
  { id: "cluster", name: "Cluster Bomb", ammo: 2, r: 22, dmg: 20, col: "#ff6a6a", desc: "Bursts into six bomblets on impact." },
  { id: "napalm", name: "Napalm", ammo: 2, r: 16, dmg: 8, col: "#ff5a1a", desc: "Spills burning fuel that flows downhill." },
  { id: "roller", name: "Roller", ammo: 2, r: 42, dmg: 40, col: "#9ad0ff", desc: "Lands and rolls downhill until it hits something." },
  { id: "digger", name: "Digger", ammo: 2, r: 28, dmg: 32, col: "#c8a070", desc: "Tunnels through the ground, then explodes." },
  { id: "dirt", name: "Dirt Ball", ammo: 2, r: 0, dmg: 0, col: "#a87a4a", desc: "Throws up a mound of earth. Great for cover." },
  { id: "tele", name: "Teleport", ammo: 1, r: 0, dmg: 0, col: "#7affd0", desc: "Moves your tank to wherever the shot lands." },
];
const THEMES = [
  { name: "Green Valley", sky: ["#2f5f9a", "#8fbfe6", "#e8eedc"], far: "#6f8fae", mid: "#527090", grass: "#79c856", dirt: ["#8a5a32", "#4f3220"], speck: "#3a2614", sun: "#fff6c8", night: false, cloudA: 0.8 },
  { name: "Ember Dunes", sky: ["#2a1d4a", "#b34a74", "#ffb45a"], far: "#6a3a64", mid: "#45284a", grass: "#e0b45a", dirt: ["#a8603a", "#4a2018"], speck: "#2a1008", sun: "#ffd08a", night: false, cloudA: 0.45 },
  { name: "Frostfall", sky: ["#04071a", "#132050", "#2c3e74"], far: "#24305a", mid: "#18203e", grass: "#dff4ff", dirt: ["#5a6a8a", "#232a40"], speck: "#151a2a", sun: "#e8f0ff", night: true, cloudA: 0.16 },
];

/* ================= terrain ================= */
const CLOUD = (() => { const c = document.createElement("canvas"); c.width = 220; c.height = 110; const g = c.getContext("2d"); g.shadowColor = "#fff"; g.shadowBlur = 14; g.fillStyle = "#fff"; g.beginPath(); for (const [x, y, r] of [[60, 62, 30], [92, 46, 34], [128, 52, 30], [156, 66, 24], [96, 72, 28]]) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } g.fill(); return c; })();
const tcv = document.createElement("canvas"); tcv.width = W; tcv.height = H; const tctx = tcv.getContext("2d", { willReadFrequently: true });
const bgc = document.createElement("canvas"); bgc.width = W; bgc.height = H; const bgx = bgc.getContext("2d");
let mask = new Uint8Array(W * H), theme = THEMES[0], clouds = [];
const solidAt = (x, y) => { x |= 0; y |= 0; return x >= 0 && x < W && y >= 0 && y < H && mask[y * W + x] === 1; };
function genTerrain(kind) {
  theme = THEMES[(Math.random() * THEMES.length) | 0];
  if (kind === "random") kind = K.pick(["hills", "mountains", "canyons"]);
  const oct = kind === "mountains" ? [[0.0021, 190], [0.0062, 70], [0.017, 18]] : kind === "canyons" ? [[0.0026, 110], [0.0085, 95], [0.021, 12]] : [[0.0024, 105], [0.0066, 42], [0.016, 14]];
  const ph = oct.map(() => Math.random() * 1000), base = kind === "mountains" ? 560 : 600, hs = new Float32Array(W);
  for (let x = 0; x < W; x++) { let h = base; oct.forEach(([f, a], i) => { const s = Math.sin(x * f + ph[i]); h += kind === "canyons" && i === 1 ? a * (Math.abs(s) * 2 - 1) : a * s; }); hs[x] = clamp(h, 250, H - 80); }
  /* sky and distant hills */
  const g = bgx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, theme.sky[0]); g.addColorStop(0.62, theme.sky[1]); g.addColorStop(1, theme.sky[2]); bgx.fillStyle = g; bgx.fillRect(0, 0, W, H);
  if (theme.night) for (let i = 0; i < 220; i++) { bgx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.7})`; const r = Math.random() < 0.1 ? 1.6 : 0.9; bgx.beginPath(); bgx.arc(Math.random() * W, Math.random() * H * 0.6, r, 0, TAU); bgx.fill(); }
  const sx = 200 + Math.random() * 1200, sy = 120 + Math.random() * 90; K.drawGlow(bgx, sx, sy, 160, theme.night ? "200,215,255" : "255,230,170", 0.8);
  { const mc = document.createElement("canvas"); mc.width = mc.height = 120; const m = mc.getContext("2d"); m.fillStyle = theme.sun; m.beginPath(); m.arc(60, 60, theme.night ? 34 : 44, 0, TAU); m.fill(); if (theme.night) { m.globalCompositeOperation = "destination-out"; m.beginPath(); m.arc(76, 50, 30, 0, TAU); m.fill(); } bgx.drawImage(mc, sx - 60, sy - 60); }
  for (const [col, amp, off, fr] of [[theme.far, 120, 380, 0.004], [theme.mid, 90, 470, 0.007]]) { const p = Math.random() * 100; bgx.fillStyle = col; bgx.beginPath(); bgx.moveTo(0, H); for (let x = 0; x <= W; x += 8) bgx.lineTo(x, off + Math.sin(x * fr + p) * amp * 0.6 + Math.sin(x * fr * 2.7 + p * 2) * amp * 0.3); bgx.lineTo(W, H); bgx.closePath(); bgx.fill(); }
  clouds = Array.from({ length: 7 }, () => ({ x: Math.random() * W, y: 60 + Math.random() * 260, s: 0.6 + Math.random() * 0.9 }));
  /* the ground itself */
  tctx.clearRect(0, 0, W, H); tctx.globalCompositeOperation = "source-over";
  const path = () => { tctx.beginPath(); tctx.moveTo(0, H); for (let x = 0; x < W; x += 2) tctx.lineTo(x, hs[x]); tctx.lineTo(W, hs[W - 1]); tctx.lineTo(W, H); tctx.closePath(); };
  const dg = tctx.createLinearGradient(0, 250, 0, H); dg.addColorStop(0, theme.dirt[0]); dg.addColorStop(1, theme.dirt[1]); path(); tctx.fillStyle = dg; tctx.fill();
  tctx.save(); path(); tctx.clip();
  for (let k = 1; k <= 6; k++) { tctx.strokeStyle = `rgba(0,0,0,${0.06 + (k % 2) * 0.05})`; tctx.lineWidth = 16 + k * 3; tctx.beginPath(); for (let x = 0; x < W; x += 4) tctx[x ? "lineTo" : "moveTo"](x, hs[x] + k * 58 + Math.sin(x * 0.01 + k) * 8); tctx.stroke(); }
  for (let i = 0; i < 1400; i++) { const x = Math.random() * W, y = hs[x | 0] + 14 + Math.random() * (H - hs[x | 0]); tctx.fillStyle = Math.random() < 0.5 ? theme.speck + "88" : "rgba(255,255,255,.07)"; tctx.beginPath(); tctx.arc(x, y, 1 + Math.random() * 3.5, 0, TAU); tctx.fill(); }
  tctx.restore();
  tctx.strokeStyle = theme.grass; tctx.lineWidth = 9; tctx.lineJoin = "round"; tctx.beginPath(); for (let x = 0; x < W; x += 2) tctx[x ? "lineTo" : "moveTo"](x, hs[x] + 3); tctx.stroke();
  tctx.strokeStyle = "rgba(255,255,255,.25)"; tctx.lineWidth = 2; tctx.beginPath(); for (let x = 0; x < W; x += 2) tctx[x ? "lineTo" : "moveTo"](x, hs[x] - 0.5); tctx.stroke();
  rebuildMask(0, 0, W, H);
}
function rebuildMask(x0, y0, w, h) {
  x0 = clamp(x0 | 0, 0, W); y0 = clamp(y0 | 0, 0, H); w = clamp(Math.ceil(w), 0, W - x0); h = clamp(Math.ceil(h), 0, H - y0); if (!w || !h) return;
  const d = tctx.getImageData(x0, y0, w, h).data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[(y0 + y) * W + x0 + x] = d[(y * w + x) * 4 + 3] > 110 ? 1 : 0;
}
function carve(x, y, r, scorch = true) {
  tctx.save(); tctx.globalCompositeOperation = "destination-out"; tctx.beginPath(); tctx.arc(x, y, r, 0, TAU); tctx.fill();
  if (scorch) tctx.globalCompositeOperation = "source-atop"; else tctx.globalAlpha = 0; const g = tctx.createRadialGradient(x, y, r * 0.85, x, y, r * 1.4); g.addColorStop(0, "rgba(18,10,4,.6)"); g.addColorStop(1, "rgba(18,10,4,0)"); tctx.fillStyle = g; tctx.beginPath(); tctx.arc(x, y, r * 1.4, 0, TAU); tctx.fill(); tctx.restore();
  rebuildMask(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4);
}
function addDirt(x, y, r) {
  tctx.save(); const g = tctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); g.addColorStop(0, theme.dirt[0]); g.addColorStop(1, theme.dirt[1]); tctx.fillStyle = g; tctx.beginPath(); tctx.arc(x, y, r, 0, TAU); tctx.fill();
  for (let i = 0; i < 60; i++) { const a = Math.random() * TAU, d = Math.random() * r * 0.9; tctx.fillStyle = theme.speck + "77"; tctx.beginPath(); tctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + Math.random() * 3, 0, TAU); tctx.fill(); }
  tctx.restore(); rebuildMask(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4);
}
function surfaceY(x, from = 0) { x = clamp(x | 0, 0, W - 1); for (let y = Math.max(0, from | 0); y < H; y++) if (mask[y * W + x]) return y; return H + 100; }

/* ================= match state ================= */
let M = null, tanks = [], cur = 0, phase = "idle", wind = 0, shots = [], fires = [], parts = [], texts = [], booms = [], settleT = 0, shake = 0, T = 0, msgT = 0, aiT = 0, firedBy = null;
function newMatch(setup, demo) {
  M = { demo: !!demo, rounds: setup.rounds, round: 0, terrain: setup.terrain, players: Array.from({ length: setup.n }, (_, i) => ({ i, type: setup.types[i], team: TEAM[i], wins: 0, dmg: 0, kills: 0 })) };
  if (!demo) { SAVE.stats.matches++; persist(); }
  nextRound();
}
function nextRound() {
  M.round++; genTerrain(M.terrain); shots = []; fires = []; parts = []; texts = []; booms = [];
  const n = M.players.length, xs = K.shuffle(Array.from({ length: n }, (_, i) => 130 + ((W - 260) * (i + 0.5)) / n + (Math.random() - 0.5) * 120));
  tanks = M.players.map((p, i) => { const x = xs[i] | 0, t = { i, x, y: 0, hp: 100, angle: x < W / 2 ? 50 : 130, power: 62, fuel: FUEL, ammo: Object.fromEntries(WEAPONS.map((w) => [w.id, w.ammo])), w: 0, alive: true, vy: 0, falling: false, fy: 0, flash: 0, drove: 0 }; t.y = surfaceY(x) - 1; return t; });
  wind = Math.round((Math.random() * 2 - 1) * 7); cur = (M.round - 1) % n; if (!tanks[cur].alive) cur = 0;
  phase = "idle"; M.firstTurn = true; renderTop(); startTurn();
}
const team = (t) => M.players[t.i].team;
const isCpu = (t) => M.players[t.i].type !== "human";
function startTurn() {
  const t = tanks[cur]; t.fuel = FUEL; t.drove = 0; phase = isCpu(t) ? "ai" : "aim"; aiT = 0; t.plan = null;
  renderTop(); syncPanel();
  if (!M.demo) say(`${team(t).name}${isCpu(t) ? "" : " · your turn"}`, M.firstTurn ? `Round ${M.round} of ${M.rounds} · ${theme.name}` : isCpu(t) ? TYPES[M.players[t.i].type] : "", M.firstTurn ? 2 : 1.4); M.firstTurn = false;
  if (!isCpu(t) && !M.demo) K.sfx("turn");
}
function endTurn() {
  const alive = tanks.filter((t) => t.alive);
  if (new Set(alive.map((t) => t.i)).size <= 1) return endRound(alive[0]);
  let n = cur; do { n = (n + 1) % tanks.length; } while (!tanks[n].alive);
  cur = n; wind = clamp(wind + Math.round((Math.random() * 2 - 1) * 3), -10, 10); startTurn();
}
function endRound(winner) {
  phase = "round"; syncPanel(); renderTop();
  if (winner) M.players[winner.i].wins++;
  const need = Math.ceil(M.rounds / 2), ranked = [...M.players].sort((a, b) => b.wins - a.wins || b.dmg - a.dmg), champ = M.players.find((p) => p.wins >= need) || (M.round >= M.rounds ? ranked[0] : null), tiebreak = champ && ranked[1] && ranked[1].wins === champ.wins;
  if (M.demo) { setTimeout(() => { if (M && M.demo && phase === "round") (champ ? newMatch(demoSetup(), true) : nextRound()); }, 2600); return; }
  K.sfx(winner && !isCpu(winner) ? "win" : "roundend");
  const board = M.players.map((p) => `<div class="prow"><span class="sw" style="background:${p.team.c}"></span><b style="color:${p.team.c}">${p.team.name}</b><span class="hint">${TYPES[p.type]}</span><b style="flex:none;color:var(--gold)">${"★".repeat(p.wins)}${"☆".repeat(Math.max(0, need - p.wins))}</b></div>`).join("");
  if (champ) {
    const humanWon = champ.type === "human", humans = M.players.filter((p) => p.type === "human").length;
    if (humanWon && M.players.some((p) => p.type !== "human")) { SAVE.stats.wins++; persist(); }
    setTimeout(() => K.ui.show(`<div class="logo">${champ.team.name} wins!</div><p class="k-sub">${humans === 1 ? (humanWon ? "Victory is yours, commander." : "Defeat. Regroup and try again.") : "The match is decided."}${tiebreak ? " Tied on rounds, so the most damage dealt decides it." : ""}</p><div class="setup">${board}</div><div class="k-row"><button class="k-btn primary" data-a="rematch" autofocus>Rematch</button><button class="k-btn" data-a="setup">New setup</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "title" }), 1400);
  } else setTimeout(() => K.ui.show(`<div class="logo sm">${winner ? `${team(winner).name} takes round ${M.round}` : `Round ${M.round} is a draw`}</div><div class="setup">${board}</div><button class="k-btn primary" data-a="nextround" autofocus>Next round</button>`, { cls: "soft" }), 1300);
}

/* ================= firing & projectiles ================= */
const muzzle = (t, ang = t.angle) => { const a = (ang * Math.PI) / 180; return { x: t.x + Math.cos(a) * 25, y: t.y - 14 - Math.sin(a) * 25, ca: Math.cos(a), sa: Math.sin(a) }; };
function tankAt(x, y, skip) { for (const t of tanks) if (t.alive && t !== skip && Math.hypot(x - t.x, y - (t.y - 9)) < TR) return t; return null; }
function fire() {
  const t = tanks[cur]; if (phase !== "aim" && phase !== "ai") return; const w = WEAPONS[t.w]; if (!t.ammo[w.id]) return;
  if (t.ammo[w.id] !== Infinity) t.ammo[w.id]--;
  const launch = (ang, pw) => { const m = muzzle(t, ang), v = (pw / 100) * MAXV; shots.push({ kind: w.id, x: m.x, y: m.y, vx: m.ca * v, vy: -m.sa * v, owner: t, age: 0, trail: [], w }); };
  if (w.id === "triple") { for (const d of [-4, 0, 4]) launch(t.angle + d, t.power); } else launch(t.angle, t.power);
  firedBy = t; phase = "flight"; settleT = 0; syncPanel(); shake = Math.max(shake, 4); K.sfx("fire"); K.vibrate(30);
  const m = muzzle(t); for (let i = 0; i < 14; i++) parts.push({ x: m.x, y: m.y, vx: m.ca * 140 + (Math.random() - 0.5) * 120, vy: -m.sa * 140 + (Math.random() - 0.5) * 120, life: 0.4 + Math.random() * 0.3, t: 0, c: i % 2 ? "#ffd479" : "#888", s: 3 + Math.random() * 4, smoke: i % 2 === 0 });
  if (!M.demo && !isCpu(t)) SAVE.stats.shots++;
}
function stepShot(s, dt) {
  s.age += dt;
  if (s.rolling) return rollStep(s, dt);
  if (s.digging) return digStep(s, dt);
  s.vx += wind * WINDK * dt; s.vy += GRAV * dt;
  const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt, n = Math.max(1, Math.ceil(Math.hypot(nx - s.x, ny - s.y) / 3));
  for (let k = 1; k <= n; k++) {
    const px = s.x + ((nx - s.x) * k) / n, py = s.y + ((ny - s.y) * k) / n;
    if (px < -260 || px > W + 260 || py > H + 40) { s.dead = true; if (px > -60 && px < W + 60) { /* fell into the void */ } return; }
    const th = tankAt(px, py, s.age < 0.08 ? s.owner : null);
    if (th || solidAt(px, py)) { s.x = px; s.y = py; return impact(s, th); }
  }
  s.x = nx; s.y = ny; s.trail.push([s.x, s.y]); if (s.trail.length > 70) s.trail.shift();
  if (s.kind === "split" && !s.split && s.vy > 0) { s.split = true; s.dead = true; for (const d of [-90, 0, 90]) shots.push({ kind: "shell", x: s.x, y: s.y, vx: s.vx + d, vy: s.vy, owner: s.owner, age: 1, trail: [], w: { ...WEAPONS[3], r: 28, dmg: 26 } }); K.sfx("split"); burst(s.x, s.y, "#c39bff", 10, 120); }
}
function impact(s, tankHit) {
  const w = s.w;
  if (s.kind === "roller" && !tankHit) { s.rolling = true; s.dir = Math.sign(s.vx) || 1; s.speed = Math.min(260, Math.abs(s.vx) * 0.6 + 40); s.rollT = 0; s.y = surfaceY(s.x, s.y - 12) - 4; return; }
  if (s.kind === "digger" && !tankHit) { s.digging = true; const v = Math.hypot(s.vx, s.vy); s.dx = s.vx / v; s.dy = s.vy / v; s.digT = 0; K.sfx("dig"); return; }
  s.dead = true;
  if (s.kind === "dirt") { addDirt(s.x, s.y, 62); K.sfx("dirt"); burst(s.x, s.y, theme.dirt[0], 24, 220); return; }
  if (s.kind === "tele") { const t = s.owner; if (t.alive) { burst(t.x, t.y - 10, "#7affd0", 24, 200); t.x = clamp(s.x, 20, W - 20); t.y = surfaceY(t.x, Math.max(0, s.y - 40)); if (t.y > H) t.y = surfaceY(t.x); burst(t.x, t.y - 10, "#7affd0", 24, 200); K.sfx("tele"); } return; }
  if (s.kind === "napalm") { explode(s.x, s.y, 16, 8, s.owner, "#ff5a1a"); for (let i = 0; i < 28; i++) fires.push({ x: s.x + (Math.random() - 0.5) * 30, y: s.y - 6, vx: (Math.random() - 0.5) * 140 + s.vx * 0.15, vy: -Math.random() * 120, life: 3 + Math.random() * 1.6, t: 0, hit: new Map(), owner: s.owner }); K.sfx("napalm"); return; }
  explode(s.x, s.y, w.r, w.dmg, s.owner, w.col);
  if (s.kind === "cluster") for (let i = 0; i < 6; i++) shots.push({ kind: "bomblet", x: s.x, y: s.y - 6, vx: (Math.random() - 0.5) * 320, vy: -160 - Math.random() * 200, owner: s.owner, age: 1, trail: [], w: { r: 22, dmg: 18, col: "#ff6a6a" } });
}
function rollStep(s, dt) {
  s.rollT += dt; const step = s.speed * dt * s.dir; let nx = s.x + step;
  if (nx < 0 || nx > W) { s.dead = true; return; }
  const ny = surfaceY(nx, s.y - 14) - 4; if (ny - s.y < -10) { return explodeRoller(s); }
  const slope = ny - s.y; s.speed = clamp(s.speed + slope * 22 - 40 * dt, 0, 340); s.x = nx; s.y = ny;
  if (tankAt(s.x, s.y - 4, s.rollT < 0.15 ? s.owner : null) || s.speed < 12 || s.rollT > 5 || s.y > H) explodeRoller(s);
  s.trail.push([s.x, s.y]); if (s.trail.length > 12) s.trail.shift();
}
function explodeRoller(s) { s.dead = true; explode(s.x, s.y, s.w.r, s.w.dmg, s.owner, s.w.col); }
function digStep(s, dt) {
  s.digT += dt; const v = 220; s.x += s.dx * v * dt; s.y += s.dy * v * dt;
  if (Math.random() < 0.6) carve(s.x, s.y, 13);
  const th = tankAt(s.x, s.y, s.owner);
  if (th || s.digT > 1.0 || s.x < 0 || s.x > W || s.y > H) { s.dead = true; explode(s.x, s.y, s.w.r, s.w.dmg, s.owner, s.w.col); }
}
function explode(x, y, r, dmg, owner, col = "#ffd479") {
  carve(x, y, r); booms.push({ x, y, r, t: 0 }); shake = Math.max(shake, Math.min(18, r * 0.28)); K.sfx(r > 45 ? "bigboom" : "boom"); K.vibrate(r > 45 ? 80 : 40);
  burst(x, y, col, Math.round(r * 0.9), r * 7); for (let i = 0; i < r * 0.5; i++) parts.push({ x: x + (Math.random() - 0.5) * r, y: y + (Math.random() - 0.5) * r, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 60, life: 1 + Math.random(), t: 0, c: "#555", s: 6 + Math.random() * 10, smoke: true });
  for (let i = 0; i < r * 0.6; i++) { const a = -Math.random() * Math.PI, v = 100 + Math.random() * 300; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.8 + Math.random() * 0.6, t: 0, c: theme.dirt[0], s: 2 + Math.random() * 3, grav: true }); }
  for (const t of tanks) {
    if (!t.alive) continue; const d = Math.hypot(t.x - x, t.y - 9 - y), reach = r + TR;
    if (d < reach) { const dm = Math.round(dmg * (1 - d / reach) * 0.85 + dmg * 0.15 * (d < r ? 1 : 0)); if (dm > 0) hurt(t, dm, owner); }
  }
  settleT = 0;
}
function hurt(t, dm, owner, quiet) {
  t.hp -= dm; t.flash = 0.3; if (quiet) { t.burn = (t.burn || 0) + dm; if (T - (t.burnT || 0) > 0.5 || t.hp <= 0) { texts.push({ x: t.x, y: t.y - 40, s: "-" + t.burn, c: "#ff9a4a", t: 0 }); t.burn = 0; t.burnT = T; } } else texts.push({ x: t.x, y: t.y - 40, s: "-" + dm, c: "#ff6b6b", t: 0 });
  const op = owner && M.players[owner.i]; if (op && owner.i !== t.i) op.dmg += dm;
  if (t.hp <= 0) killTank(t, owner);
  renderTop();
}
function killTank(t, owner) {
  if (!t.alive) return; t.alive = false; t.hp = 0;
  if (owner && owner.i !== t.i) { M.players[owner.i].kills++; if (!M.demo && !isCpu(owner)) SAVE.stats.kills++; }
  texts.push({ x: t.x, y: t.y - 60, s: `${team(t).name} destroyed!`, c: team(t).c, t: 0, big: true });
  setTimeout(() => { explode(t.x, t.y - 10, 44, 26, owner, team(t).c); for (let i = 0; i < 18; i++) parts.push({ x: t.x, y: t.y - 10, vx: (Math.random() - 0.5) * 360, vy: -200 - Math.random() * 300, life: 1.2, t: 0, c: team(t).d, s: 4 + Math.random() * 4, grav: true }); }, 120);
}
function burst(x, y, c, n, sp) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = Math.random() * sp; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, life: 0.35 + Math.random() * 0.45, t: 0, c: i % 3 ? c : "#fff3c0", s: 2 + Math.random() * 4, glow: true }); } }
function fireStep(f, dt) {
  f.t += dt; f.vy += GRAV * 0.8 * dt; f.vx *= 0.985;
  const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
  if (solidAt(nx, ny)) { if (!solidAt(nx, f.y)) { f.x = nx; f.vy = 0; } else { f.vx = -f.vx * 0.3; f.vy = 0; } const down = !solidAt(f.x - 3, f.y + 4) ? -1 : !solidAt(f.x + 3, f.y + 4) ? 1 : 0; if (down) f.vx += down * 160 * dt; }
  else { f.x = nx; f.y = ny; }
  if (f.y > H) f.t = f.life;
  for (const t of tanks) if (t.alive && Math.hypot(t.x - f.x, t.y - 9 - f.y) < 20) { const h = f.hit.get(t) || { last: -1, n: 0 }; if (f.t - h.last > 0.4 && h.n < 4) { h.last = f.t; h.n++; f.hit.set(t, h); hurt(t, 1, f.owner, true); } }
  if (Math.random() < 0.08) { tctx.save(); tctx.globalCompositeOperation = "source-atop"; tctx.fillStyle = "rgba(20,8,0,.25)"; tctx.beginPath(); tctx.arc(f.x, f.y + 4, 6, 0, TAU); tctx.fill(); tctx.restore(); }
}
function tankPhysics(t, dt) {
  if (!t.alive) return;
  const grounded = solidAt(t.x, t.y + 1) || solidAt(t.x - 6, t.y + 1) || solidAt(t.x + 6, t.y + 1);
  if (!grounded) { if (!t.falling) { t.falling = true; t.fy = t.y; t.vy = 0; } t.vy += GRAV * dt; t.y += t.vy * dt; if (t.y > H + 40) { t.falling = false; hurt(t, 999, null); return; } let k = 0; while ((solidAt(t.x, t.y) || solidAt(t.x - 6, t.y) || solidAt(t.x + 6, t.y)) && k++ < 40) t.y--; if (k) land(t); }
  else if (t.falling) land(t);
  else { let k = 0; while (solidAt(t.x, t.y) && k++ < 150) t.y--; }
}
function land(t) { const dist = t.y - t.fy; t.falling = false; t.vy = 0; if (dist > 26) { hurt(t, Math.round((dist - 26) / 5), null); K.sfx("thud"); } }

/* ================= CPU gunners ================= */
function simulate(t, ang, pw, tgt) {
  const a = (ang * Math.PI) / 180, v = (pw / 100) * MAXV; let x = t.x + Math.cos(a) * 25, y = t.y - 14 - Math.sin(a) * 25, vx = Math.cos(a) * v, vy = -Math.sin(a) * v; const dt = 1 / 50;
  for (let i = 0; i < 700; i++) {
    vx += wind * WINDK * dt; vy += GRAV * dt; const nx = x + vx * dt, ny = y + vy * dt, n = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y) / 5));
    for (let k = 1; k <= n; k++) { const px = x + ((nx - x) * k) / n, py = y + ((ny - y) * k) / n; if (px < -200 || px > W + 200 || py > H + 20) return { x: px, y: py, lost: true }; const th = tankAt(px, py, i < 5 ? t : null); if (th) return { x: px, y: py, tank: th }; if (solidAt(px, py)) return { x: px, y: py }; }
    x = nx; y = ny;
  }
  return { x, y, lost: true };
}
function aiPlan(t) {
  const lvl = M.players[t.i].type, foes = tanks.filter((o) => o.alive && o.i !== t.i);
  const target = lvl === "hard" ? foes.slice().sort((a, b) => a.hp - b.hp || Math.abs(a.x - t.x) - Math.abs(b.x - t.x))[0] : lvl === "easy" ? K.pick(foes) : foes.slice().sort((a, b) => Math.abs(a.x - t.x) - Math.abs(b.x - t.x))[0];
  let best = null; const dir = target.x < t.x ? -1 : 1, step = lvl === "easy" ? 4 : 2;
  for (let ang = 12; ang <= 86; ang += step) for (let pw = 22; pw <= 100; pw += step) {
    const A = dir > 0 ? ang : 180 - ang, r = simulate(t, A, pw, target); if (r.lost) continue;
    let d = r.tank === target ? 0 : Math.hypot(r.x - target.x, r.y - (target.y - 9));
    if (r.tank && r.tank.i === t.i) d += 500; if (Math.hypot(r.x - t.x, r.y - t.y) < 75) d += 400;
    for (const o of tanks) if (o.alive && o.i === t.i && o !== t && Math.hypot(r.x - o.x, r.y - o.y) < 70) d += 300;
    if (!best || d < best.d) best = { A, pw, d };
  }
  if (!best) best = { A: dir > 0 ? 55 : 125, pw: 70, d: 999 };
  const noise = { easy: [7, 9], normal: [2.4, 3.2], hard: [0.7, 1.1] }[lvl] || [3, 4];
  const A = clamp(best.A + (Math.random() * 2 - 1) * noise[0], 0, 180), pw = clamp(best.pw + (Math.random() * 2 - 1) * noise[1], 10, 100);
  let w = 0; const avail = (id) => t.ammo[id] > 0, idx = (id) => WEAPONS.findIndex((x) => x.id === id), roll = Math.random();
  if (lvl !== "easy" || roll < 0.4) {
    if (best.d < 30 && avail("heavy") && roll < 0.55) w = idx("heavy");
    else if (best.d < 60 && avail("triple") && roll < 0.35) w = idx("triple");
    else if (best.d < 80 && avail("cluster") && roll < 0.25) w = idx("cluster");
    else if (best.d > 90 && avail("digger") && roll < 0.5) w = idx("digger");
    else if (avail("napalm") && target.y > t.y + 60 && roll < 0.4) w = idx("napalm");
    else if (avail("roller") && target.y > t.y + 40 && roll < 0.3) w = idx("roller");
    else if (avail("split") && roll < 0.2) w = idx("split");
  }
  return { A, pw, w, drive: lvl !== "easy" && t.hp < 50 && Math.random() < 0.35 ? (Math.random() < 0.5 ? -1 : 1) : 0 };
}
function aiUpdate(dt) {
  const t = tanks[cur]; aiT += dt * (SAVE.fast || M.demo ? 1.6 : 1);
  if (!t.plan && aiT > 0.5) { t.plan = aiPlan(t); t.w = t.plan.w; syncPanel(); }
  if (!t.plan) return;
  if (t.plan.drive && t.fuel > 0 && aiT < 1.4) { drive(t, t.plan.drive, dt); if (aiT > 1.3) { t.plan = aiPlan(t); t.plan.drive = 0; t.w = t.plan.w; } return; }
  const da = t.plan.A - t.angle, dp = t.plan.pw - t.power;
  t.angle += clamp(da, -90 * dt, 90 * dt); t.power += clamp(dp, -60 * dt, 60 * dt); syncPanel(true);
  if (Math.abs(da) < 0.3 && Math.abs(dp) < 0.3 && aiT > 1.6) { t.angle = t.plan.A; t.power = t.plan.pw; fire(); }
}
function drive(t, dir, dt) {
  if (t.fuel <= 0 || t.falling) return false; const sp = 60 * dt, nx = clamp(t.x + dir * sp, 14, W - 14);
  let ny = t.y; let k = 0; while (solidAt(nx, ny) && k++ < 8) ny--; if (k >= 8) return false;
  k = 0; while (!solidAt(nx, ny + 1) && k++ < 10) ny++;
  t.x = nx; t.y = ny; t.fuel = Math.max(0, t.fuel - sp); if (Math.random() < 0.3) parts.push({ x: t.x - dir * 14, y: t.y - 2, vx: -dir * 30, vy: -20, life: 0.5, t: 0, c: theme.dirt[0], s: 2 + Math.random() * 2 }); K.sfx("engine"); return true;
}

/* ================= update & render ================= */
const cv = $("#cv"), ctx = cv.getContext("2d"); let CW = 0, CH = 0, S = 1, OX = 0, OY = 0, DPR = 1;
function resize() { CW = innerWidth; CH = innerHeight; K.fit(cv, CW, CH); DPR = K.dpr(); S = Math.min(CW / W, CH / H); OX = (CW - W * S) / 2; OY = (CH - H * S) / 2; }
addEventListener("resize", resize);
const HOLD = new Set();
function update(dt) {
  T += dt; shake = Math.max(0, shake - dt * 30); msgT -= dt; if (msgT <= 0) $("#msg").classList.remove("on");
  for (const c of clouds) { c.x += (wind * 4 + 6) * dt; if (c.x > W + 200) c.x = -200; if (c.x < -200) c.x = W + 200; }
  if (!M) return;
  const t = tanks[cur];
  if (phase === "aim" && t && !K.ui.active()) humanInput(t, dt);
  if (phase === "ai" && (M.demo || !K.ui.active())) aiUpdate(dt);
  const sub = SAVE.fast ? 2 : 1;
  for (let k = 0; k < sub; k++) {
    const h = dt / sub;
    for (const s of shots) if (!s.dead) { const n = 3; for (let i = 0; i < n && !s.dead; i++) stepShot(s, h / n); }
    shots = shots.filter((s) => !s.dead);
    for (const f of fires) fireStep(f, h); fires = fires.filter((f) => f.t < f.life);
    for (const tk of tanks) tankPhysics(tk, h);
  }
  for (const p of parts) { p.t += dt; if (p.grav) p.vy += GRAV * dt; else if (p.smoke) { p.vy -= 20 * dt; p.vx += wind * 3 * dt; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= p.smoke ? 0.97 : 0.99; }
  parts = parts.filter((p) => p.t < p.life);
  for (const b of booms) b.t += dt; booms = booms.filter((b) => b.t < 0.5);
  for (const x of texts) x.t += dt; texts = texts.filter((x) => x.t < 1.6);
  for (const tk of tanks) if (tk.flash > 0) tk.flash -= dt;
  if (phase === "flight") { const busy = shots.length || fires.length || tanks.some((x) => x.falling); if (!busy) { settleT += dt; if (settleT > 0.7) { phase = "settle"; endTurn(); } } else settleT = 0; }
}
function humanInput(t, dt) {
  const fine = K.held("ShiftLeft", "ShiftRight") ? 0.25 : 1, P = K.pad;
  let da = 0, dp = 0, dm = 0;
  if (K.held("ArrowLeft") || HOLD.has("a+") || P.held.dl) da += 1; if (K.held("ArrowRight") || HOLD.has("a-") || P.held.dr) da -= 1;
  if (K.held("ArrowUp", "PageUp", "KeyW") || HOLD.has("p+") || P.held.du || P.rt > 0.3) dp += 1; if (K.held("ArrowDown", "PageDown", "KeyS") || HOLD.has("p-") || P.held.dd || P.lt > 0.3) dp -= 1;
  if (K.held("KeyA", "KeyZ") || HOLD.has("ml") || P.ax < -0.5) dm -= 1; if (K.held("KeyD", "KeyC") || HOLD.has("mr") || P.ax > 0.5) dm += 1;
  if (Math.abs(P.rx) > 0.3) da -= P.rx;
  if (da) t.angle = clamp(t.angle + da * 45 * fine * dt, 0, 180);
  if (dp) t.power = clamp(t.power + dp * 34 * fine * dt, 5, 100);
  if (dm) drive(t, dm, dt);
  if (da || dp || dm) syncPanel(true);
  if (P.pressed.a) fire(); if (P.pressed.lb) cycleWeapon(-1); if (P.pressed.rb) cycleWeapon(1); if (P.pressed.start) menu();
}
function cycleWeapon(d) {
  const t = tanks[cur]; if (!t || phase !== "aim") return; let w = t.w;
  for (let i = 0; i < WEAPONS.length; i++) { w = (w + d + WEAPONS.length) % WEAPONS.length; if (t.ammo[WEAPONS[w].id] > 0) break; }
  t.w = w; K.sfx("click"); syncPanel();
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = "#0b111b"; ctx.fillRect(0, 0, CW, CH);
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  ctx.setTransform(DPR * S, 0, 0, DPR * S, DPR * (OX + sx), DPR * (OY + sy));
  ctx.drawImage(bgc, 0, 0);
  ctx.globalAlpha = theme.cloudA; for (const c of clouds) ctx.drawImage(CLOUD, c.x - 60 * c.s, c.y - 50 * c.s, 220 * c.s, 110 * c.s); ctx.globalAlpha = 1;
  ctx.drawImage(tcv, 0, 0);
  for (const f of fires) { const a = 1 - f.t / f.life; K.drawGlow(ctx, f.x, f.y - 4, 18, "255,120,30", a * 0.9); ctx.fillStyle = `rgba(255,${180 + Math.random() * 70 | 0},80,${a})`; ctx.beginPath(); ctx.arc(f.x, f.y - 3, 3 + Math.random() * 3, 0, TAU); ctx.fill(); }
  if (M) {
    for (const t of tanks) drawTank(t);
    const t = tanks[cur];
    if (t && t.alive && (phase === "aim" || phase === "ai")) {
      const m = muzzle(t), y0 = t.y - 58 + Math.sin(T * 6) * 4; ctx.fillStyle = team(t).c; ctx.beginPath(); ctx.moveTo(t.x, y0 + 12); ctx.lineTo(t.x - 9, y0); ctx.lineTo(t.x + 9, y0); ctx.closePath(); ctx.fill();
      if (phase === "aim" && SAVE.assist) { ctx.fillStyle = "rgba(255,255,255,.75)"; const v = (t.power / 100) * MAXV; let x = m.x, y = m.y, vx = m.ca * v, vy = -m.sa * v; for (let i = 0; i < 40; i++) { const dt = 0.022; vy += GRAV * dt; x += vx * dt; y += vy * dt; if (i % 3 === 0) { ctx.globalAlpha = 1 - i / 40; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); } if (solidAt(x, y)) break; } ctx.globalAlpha = 1; }
    }
  }
  for (const s of shots) { ctx.strokeStyle = s.w.col; ctx.lineWidth = 3; ctx.globalAlpha = 0.5; ctx.beginPath(); s.trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.globalAlpha = 1; K.drawGlow(ctx, s.x, s.y, 16, hexRgb(s.w.col), 0.9); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.kind === "bomblet" ? 3 : 5, 0, TAU); ctx.fill(); }
  for (const b of booms) { const k = b.t / 0.5; K.drawGlow(ctx, b.x, b.y, b.r * (1.4 + k), "255,190,90", (1 - k) * 1.2); ctx.strokeStyle = `rgba(255,240,200,${1 - k})`; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.6 + k * 0.9), 0, TAU); ctx.stroke(); }
  for (const p of parts) { const a = 1 - p.t / p.life; if (p.smoke) { ctx.fillStyle = `rgba(90,90,96,${a * 0.45})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 + p.t), 0, TAU); ctx.fill(); } else { ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); ctx.globalAlpha = 1; } }
  ctx.textAlign = "center"; ctx.lineJoin = "round";
  for (const x of texts) { const a = Math.min(1, 2.2 - x.t * 1.4); ctx.globalAlpha = Math.max(0, a); ctx.font = `${x.big ? 30 : 26}px "Black Ops One", Impact, sans-serif`; const y = x.y - x.t * 40; ctx.strokeStyle = "#000"; ctx.lineWidth = 5; ctx.strokeText(x.s, x.x, y); ctx.fillStyle = x.c; ctx.fillText(x.s, x.x, y); ctx.globalAlpha = 1; }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
function drawTank(t) {
  if (!t.alive) { ctx.fillStyle = "#2a2a2a"; ctx.beginPath(); ctx.ellipse(t.x, t.y - 4, 18, 6, 0, 0, TAU); ctx.fill(); return; }
  const T0 = team(t), a = (t.angle * Math.PI) / 180, flash = t.flash > 0 && Math.sin(T * 40) > 0;
  ctx.save(); ctx.translate(t.x, t.y);
  ctx.strokeStyle = "#1a1a20"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(Math.cos(a) * 25, -14 - Math.sin(a) * 25); ctx.stroke();
  ctx.strokeStyle = flash ? "#fff" : "#c8ccd8"; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(Math.cos(a) * 24, -14 - Math.sin(a) * 24); ctx.stroke();
  ctx.fillStyle = "#24242c"; K.roundRect(ctx, -19, -8, 38, 9, 4); ctx.fill(); ctx.fillStyle = "#4a4a56"; for (let k = -14; k <= 14; k += 7) { ctx.beginPath(); ctx.arc(k, -3.5, 2.4, 0, TAU); ctx.fill(); }
  ctx.fillStyle = flash ? "#fff" : T0.c; ctx.beginPath(); ctx.moveTo(-17, -8); ctx.lineTo(-12, -16); ctx.lineTo(12, -16); ctx.lineTo(17, -8); ctx.closePath(); ctx.fill(); ctx.strokeStyle = T0.d; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = flash ? "#fff" : T0.c; ctx.beginPath(); ctx.arc(0, -15, 8, Math.PI, 0); ctx.fill(); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(-10, -14.5, 20, 2);
  ctx.restore();
  if (M && (tanks[cur] !== t || phase === "flight")) { const w = 34; ctx.fillStyle = "#0009"; ctx.fillRect(t.x - w / 2, t.y - 34, w, 5); ctx.fillStyle = T0.c; ctx.fillRect(t.x - w / 2, t.y - 34, (w * t.hp) / 100, 5); }
}

/* ================= HUD ================= */
function renderTop() {
  const top = $("#top"); $("#menuBtn").hidden = !M || M.demo; if (!M || M.demo) { top.hidden = true; return; } top.hidden = false;
  const chips = M.players.map((p) => { const t = tanks[p.i]; return `<div class="pc${tanks[cur] === t && phase !== "round" ? " on" : ""}${t && !t.alive ? " dead" : ""}" style="--c:${p.team.c}"><b>${p.team.name}<span>${"★".repeat(p.wins)}</span></b><div class="hb"><i style="width:${t ? Math.max(0, t.hp) : 0}%"></i></div></div>`; });
  const wl = Math.abs(wind), arrow = wind > 0 ? "→".repeat(Math.ceil(wl / 3.5)) : wind < 0 ? "←".repeat(Math.ceil(wl / 3.5)) : "·";
  chips.splice(Math.ceil(chips.length / 2), 0, `<div id="wind"><small>WIND</small>${wind < 0 ? arrow + " " : ""}${wl}${wind > 0 ? " " + arrow : ""}</div>`);
  top.innerHTML = chips.join("");
}
function wIcon(g, s, w) {
  g.clearRect(0, 0, s, s); g.save(); g.translate(s / 2, s / 2); K.drawGlow(g, 0, 0, s * 0.45, hexRgb(w.col), 0.6);
  g.fillStyle = w.col; g.strokeStyle = "#111"; g.lineWidth = s * 0.04;
  const ball = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); };
  if (w.id === "triple") { ball(-s * 0.16, s * 0.06, s * 0.1); ball(s * 0.16, s * 0.06, s * 0.1); ball(0, -s * 0.12, s * 0.1); }
  else if (w.id === "split") { ball(0, s * 0.1, s * 0.13); g.strokeStyle = w.col; g.lineWidth = s * 0.05; for (const d of [-1, 0, 1]) { g.beginPath(); g.moveTo(0, -s * 0.02); g.lineTo(d * s * 0.2, -s * 0.28); g.stroke(); } }
  else if (w.id === "cluster") { for (let k = 0; k < 6; k++) ball(Math.cos(k * 1.05) * s * 0.2, Math.sin(k * 1.05) * s * 0.2, s * 0.07); }
  else if (w.id === "napalm") { g.beginPath(); g.moveTo(0, -s * 0.3); g.quadraticCurveTo(s * 0.25, 0, s * 0.12, s * 0.22); g.lineTo(-s * 0.12, s * 0.22); g.quadraticCurveTo(-s * 0.25, 0, 0, -s * 0.3); g.fill(); g.stroke(); }
  else if (w.id === "roller") { ball(0, 0, s * 0.2); g.fillStyle = "#111"; g.fillRect(-s * 0.02, -s * 0.2, s * 0.04, s * 0.4); }
  else if (w.id === "digger") { g.beginPath(); g.moveTo(-s * 0.12, -s * 0.26); g.lineTo(s * 0.12, -s * 0.26); g.lineTo(0, s * 0.3); g.closePath(); g.fill(); g.stroke(); }
  else if (w.id === "dirt") { g.beginPath(); g.arc(0, s * 0.12, s * 0.26, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); }
  else if (w.id === "tele") { g.strokeStyle = w.col; g.lineWidth = s * 0.06; for (const r of [0.08, 0.17, 0.26]) { g.beginPath(); g.arc(0, 0, s * r, 0.3, Math.PI * 1.7); g.stroke(); } }
  else ball(0, 0, w.id === "heavy" ? s * 0.22 : s * 0.15);
  g.restore();
}
let lastPanel = "";
function syncPanel(light) {
  const panel = $("#panel"); const t = M && tanks[cur];
  if (!M || M.demo || !t || phase === "round") { panel.hidden = true; return; }
  panel.hidden = false; panel.classList.toggle("off", phase !== "aim");
  const shown = t.angle > 90 ? 180 - t.angle : t.angle;
  $("#vAngle").textContent = `${Math.round(shown)}°${t.angle > 90 ? "◂" : "▸"}`; $("#vPower").textContent = Math.round(t.power); $("#vFuel").style.width = (100 * t.fuel) / FUEL + "%";
  if (light) return;
  const w = WEAPONS[t.w], key = cur + ":" + t.w + ":" + t.ammo[w.id];
  if (key !== lastPanel) { lastPanel = key; $("#wName").textContent = w.name; $("#wAmmo").textContent = w.ammo === Infinity ? "Unlimited" : `${t.ammo[w.id]} left`; $("#wpn").title = w.desc; wIcon($("#wpn canvas").getContext("2d"), 64, w); }
  $("#fire").style.background = `linear-gradient(${team(t).c}, ${team(t).d})`;
}
function say(text, sub = "", dur = 1.6) { const m = $("#msg"); m.innerHTML = `${K.esc(text)}${sub ? `<small>${K.esc(sub)}</small>` : ""}`; m.classList.add("on"); msgT = dur; }

/* ================= input ================= */
addEventListener("keydown", (e) => {
  if (e.defaultPrevented || K.ui.active() || !M || M.demo) return;
  if (e.code === "Escape") return menu();
  if (phase !== "aim") return;
  if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); fire(); }
  else if (e.code === "KeyQ" || (e.code === "Tab" && e.shiftKey)) { e.preventDefault(); cycleWeapon(-1); }
  else if (e.code === "KeyE" || e.code === "Tab") { e.preventDefault(); cycleWeapon(1); }
  else if (e.key >= "1" && e.key <= "9" || e.key === "0") { const i = e.key === "0" ? 9 : +e.key - 1, t = tanks[cur]; if (t.ammo[WEAPONS[i].id] > 0) { t.w = i; K.sfx("click"); syncPanel(); } }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown"].includes(e.code)) e.preventDefault();
});
let aimDrag = null;
cv.addEventListener("pointerdown", (e) => {
  K.audio(); if (K.ui.active() || !M || M.demo || phase !== "aim") return; const t = tanks[cur];
  aimDrag = { id: e.pointerId }; cv.setPointerCapture(e.pointerId); aimAt(e, t);
});
cv.addEventListener("pointermove", (e) => { if (aimDrag && aimDrag.id === e.pointerId && phase === "aim") aimAt(e, tanks[cur]); });
cv.addEventListener("pointerup", (e) => { if (aimDrag && aimDrag.id === e.pointerId) aimDrag = null; });
function aimAt(e, t) {
  const wx = (e.clientX - OX) / S, wy = (e.clientY - OY) / S, dx = wx - t.x, dy = t.y - 14 - wy;
  if (Math.hypot(dx, dy) < 12) return;
  t.angle = clamp((Math.atan2(dy, dx) * 180) / Math.PI, 0, 180); if (dy < 0) t.angle = dx < 0 ? 180 : 0;
  t.power = clamp(Math.hypot(dx, dy) / 3.4, 5, 100); syncPanel(true);
}
for (const b of $$("#panel [data-hold]")) {
  const k = b.dataset.hold, on = (e) => { e.preventDefault(); K.audio(); if (k === "wl") return cycleWeapon(-1); if (k === "wr") return cycleWeapon(1); HOLD.add(k); }, off = () => HOLD.delete(k);
  b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off);
}
$("#fire").addEventListener("click", () => fire());

/* ================= audio ================= */
K.defineSfx({
  fire: (t) => { K.noise(t, 0.35, { filter: "lowpass", freq: 900, slide: 0.4, vol: 0.18 }); K.voice(110, t, 0.3, { type: "sine", vol: 0.12, slide: 0.5 }); },
  boom: (t) => { K.noise(t, 0.6, { filter: "lowpass", freq: 1100, slide: 0.25, vol: 0.22 }); K.voice(80, t, 0.45, { type: "sine", vol: 0.16, slide: 0.45 }); },
  bigboom: (t) => { K.noise(t, 1.1, { filter: "lowpass", freq: 800, slide: 0.2, vol: 0.28 }); K.voice(55, t, 0.9, { type: "sine", vol: 0.2, slide: 0.5 }); },
  split: (t) => K.voice(900, t, 0.15, { type: "triangle", vol: 0.05, slide: 1.6 }),
  napalm: (t) => K.noise(t, 1.2, { filter: "bandpass", freq: 700, slide: 1.5, vol: 0.12 }),
  dig: (t) => K.noise(t, 0.9, { filter: "lowpass", freq: 400, vol: 0.12 }),
  dirt: (t) => K.noise(t, 0.4, { filter: "lowpass", freq: 500, vol: 0.14 }),
  tele: (t) => K.voice(300, t, 0.4, { type: "sine", vol: 0.07, slide: 4 }),
  thud: (t) => K.voice(90, t, 0.15, { type: "sine", vol: 0.12, slide: 0.6 }),
  engine: (t) => K.voice(70 + Math.random() * 20, t, 0.07, { type: "sawtooth", vol: 0.025, lp: 400 }),
  turn: (t) => K.notes(t, [523, 784], 0.07, { duty: 0.25, vol: 0.04, len: 0.15 }),
  win: (t) => K.notes(t, [523, 659, 784, 1046, 1318], 0.09, { duty: 0.25, vol: 0.05, len: 0.5 }),
  roundend: (t) => K.notes(t, [392, 494, 587], 0.1, { type: "triangle", vol: 0.05, len: 0.4 }),
}, { engine: 0.08, boom: 0.04 });
K.songs({
  title: { bpm: 96, chords: ["Dm", "Bb", "C", "A"], bass: "R . . R . . R . R . . R . . O .", bassVol: 0.09, bassWave: 0.25, drums: "k . . . s . . . k . k . s . . .", arp: true, arpVol: 0.014, arpPat: [0, 1, 2, 1], lead: ["d5 - - - a4 - d5 -", "f5 - - - d5 - - -", "e5 - - - g5 - e5 -", "c#5 - - - a4 - - -"], leadVol: 0.026 },
  battle: { bpm: 104, chords: ["Am", "Am", "F", "E"], bass: "R . R . R . R O R . R . R . F .", bassVol: 0.08, bassWave: 0.5, drums: "k . h . s . h . k k h . s . h h", arp: true, arpVol: 0.012, arpPat: [0, 2, 1, 2], pad: true, padVol: 0.016 },
});

/* ================= screens ================= */
const demoSetup = () => ({ n: 3, types: ["hard", "normal", "hard"], rounds: 3, terrain: "random" });
function title() {
  K.playSong("title", 2); newMatch(demoSetup(), true); $("#panel").hidden = true; $("#top").hidden = true;
  const s = SAVE.stats;
  K.ui.show(`<div class="logo">BARRAGE</div><p class="k-sub">Aim, read the wind and blow holes in the landscape.</p><div class="k-menu"><button class="k-btn primary" data-a="quick" autofocus>Quick battle<small>You against a CPU gunner</small></button><button class="k-btn" data-a="setup">Custom battle<small>2-4 players, humans or CPUs</small></button><button class="k-btn" data-a="help">How to play</button><button class="k-btn" data-a="settings">Settings</button></div>${s.matches ? `<p class="k-sub">Battles ${s.matches} · won vs CPU ${s.wins} · tanks destroyed ${s.kills}</p>` : ""}`, { cls: "soft" });
}
function setupScreen() {
  const st = SAVE.setup;
  K.ui.show(`<div class="logo sm">Custom battle</div><div class="setup">
    <div class="k-row"><span class="hint">Players</span><div class="k-seg">${[2, 3, 4].map((n) => `<button class="k-btn${st.n === n ? " on" : ""}" data-a="sn" data-v="${n}">${n}</button>`).join("")}</div></div>
    ${Array.from({ length: st.n }, (_, i) => `<div class="prow"><span class="sw" style="background:${TEAM[i].c}"></span><b style="color:${TEAM[i].c}">${TEAM[i].name}</b><button class="k-btn small" data-a="st" data-i="${i}">${TYPES[st.types[i]]}</button></div>`).join("")}
    <div class="k-row"><span class="hint">Rounds</span><div class="k-seg">${[1, 3, 5].map((n) => `<button class="k-btn${st.rounds === n ? " on" : ""}" data-a="sr" data-v="${n}">${n}</button>`).join("")}</div></div>
    <div class="k-row"><span class="hint">Terrain</span><div class="k-seg">${[["random", "Random"], ["hills", "Hills"], ["mountains", "Mountains"], ["canyons", "Canyons"]].map(([k, l]) => `<button class="k-btn${st.terrain === k ? " on" : ""}" data-a="sterr" data-v="${k}">${l}</button>`).join("")}</div></div>
    </div><div class="k-row"><button class="k-btn primary" data-a="go" autofocus>Start battle</button><button class="k-btn" data-a="title">Back</button></div>`, { back: "title", cls: "top" });
}
function startMatch(setup) { K.ui.hide(); K.playSong("battle", 2); newMatch(setup, false); }
function menu() { if (!M || M.demo || K.ui.active() || phase === "round") return; K.ui.show(`<div class="logo sm">Paused</div><div class="k-menu"><button class="k-btn primary" data-a="close" autofocus>Resume</button><button class="k-btn" data-a="help">How to play</button><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="title">Quit battle</button></div>`, { back: "close" }); }
function help(back) {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="${back}" autofocus>Back</button></div><div class="k-help">
    <div><b>Goal</b>Take turns firing at the other tanks. The last tank standing wins the round. Win most rounds to win the battle.</div>
    <div><b>Aiming</b>Drag anywhere on the battlefield to aim: the direction sets the angle, the distance sets the power. Or use the buttons.</div>
    <div><b>Wind</b>Wind pushes every shot sideways. Check the wind meter at the top before you fire. It changes a little every turn.</div>
    <div><b>Terrain</b>Explosions dig craters. Tanks fall into holes and take damage from long drops. Falling off the map destroys a tank.</div>
    <div><b>Weapons</b>Shells are unlimited. Heavy Shells, Splitters, Cluster Bombs, Napalm, Rollers, Diggers, Dirt Balls and Teleports are limited each round.</div>
    <div><b>Moving</b>Each turn your tank can drive a short distance before firing. Use it to climb out of a crater or get a better angle.</div>
    <div class="k-kbonly"><b>Keyboard</b>← → aim · ↑ ↓ power (hold Shift for fine control) · A D drive · Q E or 1-9 weapon · Space fire · Esc menu</div>
    <div><b>Controller</b>D-pad left/right aim · up/down or LT/RT power · stick drives · LB/RB weapon · A fire · Start menu</div></div>`, { back, cls: "top" });
}
function settings(back) { const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center">${K.ui.settingsRows()}<div class="k-opt"><span>Aim guide</span><button class="k-btn small" data-a="assist">${SAVE.assist ? "On" : "Off"}</button></div><div class="k-opt"><span>Fast shots</span><button class="k-btn small" data-a="fast">${SAVE.fast ? "On" : "Off"}</button></div></div>`, { back, cls: "top" }); K.ui.bindSettings(s); }
const backOf = () => (M && !M.demo ? "close2" : "title");
K.ui.on((a, d) => {
  const st = SAVE.setup;
  switch (a) {
    case "quick": K.sfx("ok"); return startMatch({ n: 2, types: ["human", "normal"], rounds: 3, terrain: "random" });
    case "setup": K.sfx("ok"); if (M && !M.demo) newMatch(demoSetup(), true); return setupScreen();
    case "sn": st.n = +d.v; persist(); K.sfx("click"); return setupScreen();
    case "st": { const order = Object.keys(TYPES), i = +d.i; st.types[i] = order[(order.indexOf(st.types[i]) + 1) % order.length]; persist(); K.sfx("click"); return setupScreen(); }
    case "sr": st.rounds = +d.v; persist(); K.sfx("click"); return setupScreen();
    case "sterr": st.terrain = d.v; persist(); K.sfx("click"); return setupScreen();
    case "go": K.sfx("ok"); return startMatch({ n: st.n, types: st.types.slice(0, st.n), rounds: st.rounds, terrain: st.terrain });
    case "rematch": K.sfx("ok"); return startMatch({ n: M.players.length, types: M.players.map((p) => p.type), rounds: M.rounds, terrain: M.terrain });
    case "nextround": K.sfx("ok"); K.ui.hide(); return nextRound();
    case "close": case "close2": K.sfx("back"); K.ui.hide(); return;
    case "help": K.sfx("ok"); return help(backOf());
    case "settings": K.sfx("ok"); return settings(backOf());
    case "assist": SAVE.assist = !SAVE.assist; persist(); K.sfx("click"); return settings(backOf());
    case "fast": SAVE.fast = !SAVE.fast; persist(); K.sfx("click"); return settings(backOf());
    case "title": K.sfx("back"); return title();
  }
});

/* ================= boot ================= */
$("#menuBtn").onclick = () => menu();
resize();
K.loop((dt) => { update(Math.min(dt, 1 / 30)); render(); });
title();
document.fonts.load('400 30px "Black Ops One"').catch(() => {});
