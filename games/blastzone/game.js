"use strict";
/* BLASTZONE — arena bomber against bots (or a friend). */
const { $, $$, clamp, lerp, TAU } = K;
const GW = 15, GH = 13, FUSE = 2.4, FLAME_T = 0.55;
const E = 0, WALL = 1, PILLAR = 2, CRATE = 3;
const BOTS = [{ name: "Blaze", col: "#ff5a4f" }, { name: "Volt", col: "#3fa9ff" }, { name: "Sunny", col: "#ffd23f" }, { name: "Pixel", col: "#f4f6ff" }];
const ARENAS = [{ id: "classic", name: "Classic", crates: 0.72, desc: "The standard grid" }, { id: "open", name: "Open Field", crates: 0.45, desc: "Fewer crates, faster fights" }, { id: "maze", name: "Maze", crates: 0.6, extra: true, desc: "Extra walls to hide behind" }];
const POWERS = { bomb: { c: "#3f3f52", l: "B" }, fire: { c: "#ff6a3d", l: "F" }, speed: { c: "#3fd8ff", l: "S" }, kick: { c: "#8a5cff", l: "K" }, shield: { c: "#5be08a", l: "+" } };
const SAVE = K.load("blastzone.v1", { arena: 0, diff: 1, humans: 1, wins: 0, matches: 0, rounds: 3 });
const persist = () => K.save("blastzone.v1", SAVE);

/* ================= match + round ================= */
let M = null, R = null;
function newMatch() {
  M = { humans: SAVE.humans, diff: SAVE.diff, arena: SAVE.arena, target: SAVE.rounds, score: [0, 0, 0, 0], round: 0 };
  K.ui.hide(); $("#pauseBtn").hidden = false; touchUI(); newRound();
}
function newRound() {
  M.round++; const A = ARENAS[M.arena], g = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x;
    if (x === 0 || y === 0 || x === GW - 1 || y === GH - 1) g[i] = WALL;
    else if (x % 2 === 0 && y % 2 === 0) g[i] = PILLAR;
    else if (A.extra && ((x === 4 || x === 10) && y % 4 === 1 && y > 1 && y < GH - 2)) g[i] = PILLAR;
    else g[i] = Math.random() < A.crates ? CRATE : E;
  }
  const spawns = [[1, 1], [GW - 2, GH - 2], [GW - 2, 1], [1, GH - 2]];
  for (const [sx0, sy0] of spawns) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) { const x = sx0 + dx, y = sy0 + dy; if (x > 0 && y > 0 && x < GW - 1 && y < GH - 1 && g[y * GW + x] === CRATE && Math.abs(dx) + Math.abs(dy) <= 1) g[y * GW + x] = E; }
  R = { g, bombs: [], flames: [], items: new Map(), players: [], t: 0, limit: 150, sudden: false, suddenK: 0, count: 3.2, over: false, endT: 0, parts: [], shake: 0, hidden: new Map() };
  // hide power-ups under some crates
  for (let i = 0; i < g.length; i++) if (g[i] === CRATE && Math.random() < 0.32) R.hidden.set(i, K.pick(["bomb", "bomb", "fire", "fire", "speed", "kick", "shield"]));
  for (let k = 0; k < 4; k++) { const [x, y] = spawns[k]; R.players.push({ id: k, x, y, alive: true, human: k < M.humans, col: BOTS[k].col, name: k < M.humans ? (M.humans > 1 ? `P${k + 1}` : "You") : BOTS[k].name, bombs: 1, fire: 2, speed: 3.6, kick: false, shield: false, inv: 0, dir: [0, 0], face: 0, ai: { t: 0, path: null, goal: null }, walkT: 0, dying: 0 }); }
  layout(); K.playSong("boom", 3); K.sfx("ready");
}
const idx = (x, y) => y * GW + x;
const cell = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH ? WALL : R.g[idx(x, y)]);
const bombAt = (x, y) => R.bombs.find((b) => b.x === x && b.y === y);
const solid = (x, y, p) => { const c = cell(x, y); if (c !== E) return true; const b = bombAt(x, y); return !!(b && !(p && b.pass.has(p.id))); };

/* ================= bombs + flames ================= */
function placeBomb(p) {
  if (!p.alive || R.count > 0 || R.over) return false;
  const x = Math.round(p.x), y = Math.round(p.y); if (bombAt(x, y) || cell(x, y) !== E) return false;
  if (R.bombs.filter((b) => b.owner === p.id).length >= p.bombs) return false;
  R.bombs.push({ x, y, t: FUSE, owner: p.id, range: p.fire, pass: new Set(R.players.filter((q) => q.alive && Math.abs(q.x - x) < 0.95 && Math.abs(q.y - y) < 0.95).map((q) => q.id)), slide: null, fx: x, fy: y });
  K.sfx("place"); return true;
}
function explode(b) {
  R.bombs = R.bombs.filter((q) => q !== b); K.sfx("boom"); R.shake = Math.max(R.shake, 0.25); K.vibrate(40);
  const add = (x, y, kind) => { R.flames.push({ x, y, t: FLAME_T, kind }); };
  add(b.x, b.y, "c");
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let k = 1; k <= b.range; k++) {
      const x = b.x + dx * k, y = b.y + dy * k, c = cell(x, y);
      if (c === WALL || c === PILLAR) break;
      if (c === CRATE) { R.g[idx(x, y)] = E; add(x, y, dx ? "h" : "v"); crate(x, y); break; }
      const ob = bombAt(x, y); if (ob) { ob.t = Math.min(ob.t, 0.06); }
      const it = R.items.get(idx(x, y)); if (it && it.age > 0.3) R.items.delete(idx(x, y));
      add(x, y, k === b.range ? (dx ? (dx > 0 ? "r" : "l") : (dy > 0 ? "d" : "u")) : dx ? "h" : "v");
    }
  }
  for (let k = 0; k < 18; k++) { const a = Math.random() * TAU, s = 2 + Math.random() * 4; R.parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.5, c: "255,190,90" }); }
}
function crate(x, y) {
  for (let k = 0; k < 8; k++) { const a = Math.random() * TAU, s = 1 + Math.random() * 3; R.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.6, c: "176,120,60", chunk: true }); }
  const pw = R.hidden.get(idx(x, y)); if (pw) { R.items.set(idx(x, y), { k: pw, age: 0 }); R.hidden.delete(idx(x, y)); }
  K.sfx("crate");
}
function hurt(p) { if (!p.alive || p.inv > 0) return; if (p.shield) { p.shield = false; p.inv = 1.4; K.sfx("shieldpop"); return; } p.alive = false; p.dying = 1; K.sfx("die"); K.vibrate(150); for (let k = 0; k < 24; k++) { const a = Math.random() * TAU, s = 2 + Math.random() * 5; R.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.8, c: hexRgb(p.col) }); } }

/* ================= movement ================= */
function move(p, dx, dy, dt) {
  if (!p.alive || (!dx && !dy)) { p.walkT = 0; return; }
  if (dx && dy) { if (Math.abs(p.x - Math.round(p.x)) < Math.abs(p.y - Math.round(p.y))) dy = 0; else dx = 0; }
  p.face = dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 0 : 2; p.walkT += dt;
  const sp = p.speed * dt;
  if (dx) {
    const ry = Math.round(p.y), off = p.y - ry;
    if (Math.abs(off) > 0.02) { // slide toward the lane if the way ahead is open
      const tx = Math.round(p.x) + dx; if (!solid(tx, ry, p)) { p.y -= Math.sign(off) * Math.min(Math.abs(off), sp); return; }
      const ny = ry + Math.sign(off); if (!solid(Math.round(p.x) + dx, ny, p) && Math.abs(off) > 0.3) { p.y += Math.sign(off) * Math.min(1 - Math.abs(off), sp); return; }
      return;
    }
    p.y = ry; const nx = p.x + dx * sp, ahead = dx > 0 ? Math.ceil(nx - 0.001) : Math.floor(nx + 0.001);
    if (ahead !== Math.round(p.x) && solid(ahead, ry, p) && Math.abs(nx - ahead) < 1) { p.x = Math.round(p.x); if (p.kick) kickBomb(ahead, ry, dx, 0); } else p.x = nx;
  } else {
    const rx = Math.round(p.x), off = p.x - rx;
    if (Math.abs(off) > 0.02) {
      const ty = Math.round(p.y) + dy; if (!solid(rx, ty, p)) { p.x -= Math.sign(off) * Math.min(Math.abs(off), sp); return; }
      const nx2 = rx + Math.sign(off); if (!solid(nx2, Math.round(p.y) + dy, p) && Math.abs(off) > 0.3) { p.x += Math.sign(off) * Math.min(1 - Math.abs(off), sp); return; }
      return;
    }
    p.x = rx; const ny = p.y + dy * sp, ahead = dy > 0 ? Math.ceil(ny - 0.001) : Math.floor(ny + 0.001);
    if (ahead !== Math.round(p.y) && solid(rx, ahead, p) && Math.abs(ny - ahead) < 1) { p.y = Math.round(p.y); if (p.kick) kickBomb(rx, ahead, 0, dy); } else p.y = ny;
  }
}
function kickBomb(x, y, dx, dy) { const b = bombAt(x, y); if (!b || b.slide) return; b.slide = [dx, dy]; K.sfx("kick"); }

/* ================= AI ================= */
function dangerMap(extra) {
  const D = new Float32Array(GW * GH).fill(Infinity), list = R.bombs.map((b) => ({ x: b.x, y: b.y, t: b.t, r: b.range }));
  if (extra) list.push(extra);
  for (const f of R.flames) D[idx(f.x, f.y)] = 0;
  list.sort((a, b) => a.t - b.t);
  const timeAt = list.map((b) => b.t);
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < list.length; i++) { const b = list[i], t = timeAt[i]; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = dx || dy ? 1 : 0; k <= (dx || dy ? b.r : 0); k++) { const x = b.x + dx * k, y = b.y + dy * k, c = cell(x, y); if (c === WALL || c === PILLAR) break; D[idx(x, y)] = Math.min(D[idx(x, y)], t); for (let j = 0; j < list.length; j++) if (j !== i && list[j].x === x && list[j].y === y && timeAt[j] > t) timeAt[j] = t; if (c === CRATE) break; } }
  return D;
}
function bfs(p, D, goalFn, maxD = 40) {
  const sx = Math.round(p.x), sy = Math.round(p.y), prev = new Int16Array(GW * GH).fill(-1), dist = new Int16Array(GW * GH).fill(-1), q = [idx(sx, sy)]; dist[q[0]] = 0;
  const stepT = 1 / p.speed;
  while (q.length) {
    const c = q.shift(), cx = c % GW, cy = (c / GW) | 0;
    if (goalFn(cx, cy, dist[c])) { const path = []; let k = c; while (k !== idx(sx, sy)) { path.unshift(k); k = prev[k]; } return path; }
    if (dist[c] >= maxD) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, n = idx(nx, ny); if (dist[n] >= 0 || solid(nx, ny, p)) continue;
      const arrive = (dist[c] + 1) * stepT; if (D[n] < arrive + 0.45 && D[n] > arrive - FLAME_T - 0.1) continue; if (D[n] === 0) continue;
      dist[n] = dist[c] + 1; prev[n] = c; q.push(n);
    }
  }
  return null;
}
function think(p, dt) {
  const ai = p.ai; ai.t -= dt; const cx = Math.round(p.x), cy = Math.round(p.y);
  if (ai.t <= 0) {
    ai.t = [0.42, 0.24, 0.12][M.diff] + Math.random() * 0.1;
    const D = dangerMap(), here = D[idx(cx, cy)];
    if (here < Infinity) { ai.path = bfs(p, D, (x, y) => D[idx(x, y)] === Infinity); ai.mode = "flee"; }
    else {
      ai.mode = "hunt"; const enemies = R.players.filter((q) => q.alive && q.id !== p.id);
      const canBomb = R.bombs.filter((b) => b.owner === p.id).length < p.bombs && !bombAt(cx, cy);
      const worth = (x, y) => { let v = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 1; k <= p.fire; k++) { const c = cell(x + dx * k, y + dy * k); if (c === WALL || c === PILLAR) break; if (c === CRATE) { v += 1; break; } if (enemies.some((q) => Math.round(q.x) === x + dx * k && Math.round(q.y) === y + dy * k)) v += 3; } return v; };
      const escapeAfter = (x, y) => { const D2 = dangerMap({ x, y, t: FUSE, r: p.fire }); return bfs({ ...p, x, y }, D2, (ex, ey) => D2[idx(ex, ey)] === Infinity, 10); };
      if (canBomb && worth(cx, cy) > 0 && Math.random() < [0.55, 0.85, 1][M.diff] && escapeAfter(cx, cy)) { placeBomb(p); ai.t = 0.05; ai.path = null; return; }
      // go for items, then good bombing spots
      let path = bfs(p, D, (x, y) => R.items.has(idx(x, y)), 12);
      if (!path) path = bfs(p, D, (x, y, d) => d > 0 && worth(x, y) > 0 && !bombAt(x, y), 16);
      if (!path && enemies.length) { const e = K.pick(enemies); path = bfs(p, D, (x, y) => Math.abs(x - Math.round(e.x)) + Math.abs(y - Math.round(e.y)) <= 2, 30); }
      ai.path = path;
    }
  }
  // follow path
  let dx = 0, dy = 0;
  if (ai.path && ai.path.length) {
    const n = ai.path[0], tx = n % GW, ty = (n / GW) | 0;
    if (Math.abs(p.x - tx) < 0.06 && Math.abs(p.y - ty) < 0.06) { p.x = tx; p.y = ty; ai.path.shift(); }
    else { dx = Math.sign(tx - p.x); dy = Math.sign(ty - p.y); if (Math.abs(tx - p.x) < 0.06) dx = 0; if (Math.abs(ty - p.y) < 0.06) dy = 0; }
    const D = dangerMap(); if (ai.mode === "hunt" && ai.path.length && D[ai.path[0]] < 0.9) { ai.path = null; ai.t = 0; dx = dy = 0; }
  }
  move(p, dx, dy, dt);
}

/* ================= update ================= */
const KEYS = [{ up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"], bomb: ["Space", "KeyF", "KeyE"] }, { up: ["ArrowUp"], down: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"], bomb: ["Enter", "ShiftRight", "Slash"] }];
const TOUCHV = { dx: 0, dy: 0 };
function humanInput(p, dt) {
  const k = M.humans === 1 ? { up: ["KeyW", "ArrowUp"], down: ["KeyS", "ArrowDown"], left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"] } : KEYS[p.id];
  let dx = 0, dy = 0; if (K.held(...k.left)) dx -= 1; if (K.held(...k.right)) dx += 1; if (K.held(...k.up)) dy -= 1; if (K.held(...k.down)) dy += 1;
  const gps = navigator.getGamepads ? [...navigator.getGamepads()].filter((g) => g && g.connected) : [], gp = gps[M.humans === 1 ? 0 : p.id];
  if (gp) { const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0; if (ax < -0.4 || gp.buttons[14]?.pressed) dx = -1; if (ax > 0.4 || gp.buttons[15]?.pressed) dx = 1; if (ay < -0.4 || gp.buttons[12]?.pressed) dy = -1; if (ay > 0.4 || gp.buttons[13]?.pressed) dy = 1; const pressed = gp.buttons[0]?.pressed || gp.buttons[2]?.pressed; if (pressed && !p.padHeld) placeBomb(p); p.padHeld = pressed; }
  if (p.id === 0 && (TOUCHV.dx || TOUCHV.dy)) { if (Math.abs(TOUCHV.dx) > Math.abs(TOUCHV.dy)) dx = Math.sign(TOUCHV.dx); else dy = Math.sign(TOUCHV.dy); }
  move(p, dx, dy, dt);
}
function update(dt) {
  if (!R) return;
  R.t += dt; R.shake = Math.max(0, R.shake - dt);
  for (const q of R.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * 3; q.vy *= 1 - dt * 3; q.t -= dt; } R.parts = R.parts.filter((q) => q.t > 0);
  if (R.count > 0) { const before = Math.ceil(R.count); R.count -= dt; if (Math.ceil(R.count) !== before && R.count > 0) K.sfx("tick"); if (R.count <= 0) K.sfx("go"); return; }
  if (R.over) { R.endT += dt; for (const p of R.players) if (p.dying > 0) p.dying -= dt * 2; return; }
  R.limit -= dt;
  if (R.limit <= 45 && !R.sudden) { R.sudden = true; K.sfx("siren"); K.banner("SUDDEN DEATH", "The arena is closing in", 1600); }
  if (R.sudden) { R.suddenT = (R.suddenT || 0) - dt; if (R.suddenT <= 0) { R.suddenT = 0.32; dropBlock(); } }
  for (const p of R.players) { if (!p.alive) { if (p.dying > 0) p.dying -= dt * 2; continue; } p.inv = Math.max(0, p.inv - dt); if (p.human) humanInput(p, dt); else think(p, dt); }
  // bombs
  for (const b of [...R.bombs]) {
    for (const id of [...b.pass]) { const q = R.players[id]; if (!q.alive || Math.abs(q.x - b.x) >= 0.95 || Math.abs(q.y - b.y) >= 0.95) b.pass.delete(id); }
    if (b.slide) { b.fx += b.slide[0] * 7 * dt; b.fy += b.slide[1] * 7 * dt; const nx = b.slide[0] > 0 ? Math.ceil(b.fx) : b.slide[0] < 0 ? Math.floor(b.fx) : b.x, ny = b.slide[1] > 0 ? Math.ceil(b.fy) : b.slide[1] < 0 ? Math.floor(b.fy) : b.y;
      if ((nx !== b.x || ny !== b.y) && (cell(nx, ny) !== E || bombAt(nx, ny) || R.players.some((q) => q.alive && Math.round(q.x) === nx && Math.round(q.y) === ny))) { b.slide = null; b.fx = b.x; b.fy = b.y; }
      else if (Math.abs(b.fx - b.x) >= 1 || Math.abs(b.fy - b.y) >= 1) { b.x = Math.round(b.fx); b.y = Math.round(b.fy); } }
    b.t -= dt; if (b.t <= 0) explode(b);
  }
  // flames hurt
  for (const f of R.flames) { f.t -= dt; for (const p of R.players) if (p.alive && Math.abs(p.x - f.x) < 0.62 && Math.abs(p.y - f.y) < 0.62) hurt(p); }
  R.flames = R.flames.filter((f) => f.t > 0);
  // items
  for (const [i, it] of R.items) { it.age += dt; const x = i % GW, y = (i / GW) | 0; for (const p of R.players) if (p.alive && Math.round(p.x) === x && Math.round(p.y) === y) { R.items.delete(i); grant(p, it.k); } }
  // round end
  const alive = R.players.filter((p) => p.alive);
  if (alive.length <= 1 || R.limit <= 0) { R.over = true; R.endT = 0; R.winner = alive.length === 1 && R.limit > 0 ? alive[0] : null; if (R.winner) M.score[R.winner.id]++; K.sfx(R.winner && R.winner.human ? "win" : R.winner ? "lose" : "draw"); const r0 = R; setTimeout(() => { if (R === r0) roundEnd(); }, 1600); }
}
function grant(p, k) {
  if (k === "bomb") p.bombs = Math.min(8, p.bombs + 1); else if (k === "fire") p.fire = Math.min(9, p.fire + 1); else if (k === "speed") p.speed = Math.min(6.4, p.speed + 0.5); else if (k === "kick") p.kick = true; else if (k === "shield") p.shield = true;
  K.sfx("power"); if (p.human) R.parts.push(...[...Array(10)].map(() => ({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, t: 0.4, c: hexRgb(POWERS[k].c) })));
}
let SPIRAL = null;
function dropBlock() {
  if (!SPIRAL) { SPIRAL = []; let x0 = 1, y0 = 1, x1 = GW - 2, y1 = GH - 2; while (x0 <= x1 && y0 <= y1) { for (let x = x0; x <= x1; x++) SPIRAL.push([x, y0]); for (let y = y0 + 1; y <= y1; y++) SPIRAL.push([x1, y]); if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) SPIRAL.push([x, y1]); if (x0 < x1) for (let y = y1 - 1; y > y0; y--) SPIRAL.push([x0, y]); x0++; y0++; x1--; y1--; } }
  if (R.suddenK >= SPIRAL.length) return; const [x, y] = SPIRAL[R.suddenK++];
  if (cell(x, y) === PILLAR) return dropBlock();
  R.g[idx(x, y)] = WALL; R.bombs = R.bombs.filter((b) => !(b.x === x && b.y === y)); R.items.delete(idx(x, y)); R.shake = 0.1; K.sfx("thud");
  for (const p of R.players) if (p.alive && Math.round(p.x) === x && Math.round(p.y) === y) { p.shield = false; p.inv = 0; hurt(p); }
}
function roundEnd() {
  SPIRAL = null;
  const champ = M.score.findIndex((s) => s >= M.target);
  const rows = R.players.map((p) => `<div class="k-stat" style="border-color:${p.col}"><small>${p.name}</small><b>${"★".repeat(M.score[p.id])}${"☆".repeat(Math.max(0, M.target - M.score[p.id]))}</b></div>`).join("");
  if (champ >= 0) {
    const p = R.players[champ], youWon = p.human; SAVE.matches++; if (youWon && M.humans === 1) SAVE.wins++; persist();
    K.ui.show(`<div class="logo" style="font-size:2.8em">${youWon ? (M.humans > 1 ? `${p.name} WINS!` : "YOU WIN!") : `${p.name} WINS`}</div><p class="k-sub">${ARENAS[M.arena].name} · first to ${M.target}</p><div class="k-stats">${rows}</div>
      <div class="k-row"><button class="k-btn primary" data-a="rematch" autofocus>Rematch</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "title" });
    K.sfx(youWon ? "win" : "lose");
  } else K.ui.show(`<div class="logo" style="font-size:2.4em">${R.winner ? `${R.winner.name.toUpperCase()} TAKES ROUND ${M.round}` : "DRAW"}</div><div class="k-stats">${rows}</div><button class="k-btn primary" data-a="next" autofocus>Next round</button>`, { back: "next", cls: "soft" });
}

/* ================= render ================= */
const cv = $("#cv"), ctx = cv.getContext("2d");
const V = { W: 0, H: 0, dpr: 1, T: 40, ox: 0, oy: 0 };
let FLOOR = null;
function layout() { V.W = innerWidth; V.H = innerHeight; V.dpr = K.fit(cv, V.W, V.H).dpr; const touch = K.device === "touch" && V.W < V.H; V.T = Math.floor(Math.min(V.W / (GW + 0.4), (V.H - 92 - (touch ? 170 : 0)) / (GH + 0.3))); V.ox = Math.round((V.W - GW * V.T) / 2); V.oy = Math.round(54 + (V.H - 84 - (touch ? 170 : 0) - GH * V.T) / 2); FLOOR = null; }
addEventListener("resize", layout);
const px = (x) => V.ox + x * V.T, py = (y) => V.oy + y * V.T;
function floor() {
  if (FLOOR) return FLOOR; const T = V.T, c = document.createElement("canvas"); c.width = Math.ceil(GW * T * V.dpr); c.height = Math.ceil(GH * T * V.dpr); const g = c.getContext("2d"); g.scale(V.dpr, V.dpr);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { g.fillStyle = (x + y) % 2 ? "#3d6b4a" : "#437654"; g.fillRect(x * T, y * T, T, T); }
  g.fillStyle = "rgba(255,255,255,0.04)"; for (let k = 0; k < 300; k++) g.fillRect(Math.random() * GW * T, Math.random() * GH * T, 2, 2);
  return (FLOOR = c);
}
function block(x, y, top, side, h) { const T = V.T, X = px(x), Y = py(y); ctx.fillStyle = side; ctx.fillRect(X, Y + T * 0.18, T, T * 0.82); ctx.fillStyle = top; ctx.fillRect(X, Y, T, T * (1 - h)); }
function render(dt) {
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); ctx.fillStyle = "#1d2333"; ctx.fillRect(0, 0, V.W, V.H);
  if (!R) return;
  const T = V.T; let sh = R.shake > 0 ? (Math.random() - 0.5) * 10 * R.shake : 0; ctx.save(); ctx.translate(sh, sh * 0.5);
  ctx.drawImage(floor(), V.ox, V.oy, GW * T, GH * T);
  // shadows of walls
  ctx.fillStyle = "rgba(0,0,0,0.22)"; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const c = cell(x, y); if (c !== E) ctx.fillRect(px(x) + T * 0.15, py(y) + T * 0.85, T, T * 0.2); }
  // items
  for (const [i, it] of R.items) { const x = i % GW, y = (i / GW) | 0, P = POWERS[it.k], b = Math.sin(R.t * 5 + i) * T * 0.05; ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(px(x) + T / 2, py(y) + T * 0.8, T * 0.28, T * 0.08, 0, 0, TAU); ctx.fill(); ctx.fillStyle = P.c; K.roundRect(ctx, px(x) + T * 0.18, py(y) + T * 0.14 + b, T * 0.64, T * 0.64, T * 0.16); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(2, T * 0.05); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.font = `400 ${T * 0.42}px "Lilita One"`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(P.l, px(x) + T / 2, py(y) + T * 0.48 + b); }
  // flames
  for (const f of R.flames) {
    const k = f.t / FLAME_T, X = px(f.x), Y = py(f.y), w = T * (0.55 + 0.25 * Math.sin(R.t * 40)) * Math.min(1, k * 2.5 + 0.2);
    const gr = ctx.createRadialGradient(X + T / 2, Y + T / 2, 0, X + T / 2, Y + T / 2, T * 0.75); gr.addColorStop(0, "rgba(255,255,220,0.95)"); gr.addColorStop(0.4, "rgba(255,190,60,0.9)"); gr.addColorStop(1, "rgba(255,80,30,0)"); ctx.fillStyle = gr;
    if (f.kind === "h" || f.kind === "l" || f.kind === "r") ctx.fillRect(X - 1, Y + (T - w) / 2, T + 2, w); else if (f.kind === "v" || f.kind === "u" || f.kind === "d") ctx.fillRect(X + (T - w) / 2, Y - 1, w, T + 2); else ctx.fillRect(X, Y, T, T);
  }
  // blocks, bombs and players in row order
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) { const c = cell(x, y); if (c === WALL) block(x, y, "#6c7a96", "#46516a", 0.22); else if (c === PILLAR) { block(x, y, "#8b98b5", "#55617d", 0.22); ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(px(x) + T * 0.1, py(y) + T * 0.08, T * 0.8, T * 0.08); } else if (c === CRATE) { block(x, y, "#c98f4f", "#8f5f2c", 0.2); ctx.strokeStyle = "#8f5f2c"; ctx.lineWidth = Math.max(1.5, T * 0.05); ctx.strokeRect(px(x) + T * 0.12, py(y) + T * 0.1, T * 0.76, T * 0.6); ctx.beginPath(); ctx.moveTo(px(x) + T * 0.12, py(y) + T * 0.1); ctx.lineTo(px(x) + T * 0.88, py(y) + T * 0.7); ctx.stroke(); } }
    for (const b of R.bombs) if (b.y === y) { const X = px(b.slide ? b.fx : b.x) + T / 2, Y = py(b.slide ? b.fy : b.y) + T / 2, pul = 1 + Math.sin((FUSE - b.t) * (b.t < 0.8 ? 30 : 10)) * 0.07; ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(X, Y + T * 0.3, T * 0.3, T * 0.09, 0, 0, TAU); ctx.fill(); ctx.fillStyle = b.t < 0.8 && Math.floor(b.t * 12) % 2 ? "#6b1f1f" : "#24242e"; ctx.beginPath(); ctx.arc(X, Y, T * 0.34 * pul, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.arc(X - T * 0.1, Y - T * 0.12, T * 0.09, 0, TAU); ctx.fill(); ctx.strokeStyle = "#c9a36b"; ctx.lineWidth = Math.max(2, T * 0.06); ctx.beginPath(); ctx.moveTo(X + T * 0.15, Y - T * 0.26); ctx.quadraticCurveTo(X + T * 0.3, Y - T * 0.45, X + T * 0.2, Y - T * 0.52); ctx.stroke(); ctx.fillStyle = Math.random() < 0.5 ? "#ffd166" : "#ff6a3d"; ctx.beginPath(); ctx.arc(X + T * 0.2, Y - T * 0.54, T * 0.07, 0, TAU); ctx.fill(); }
    for (const p of R.players) if (Math.round(p.y) === y && (p.alive || p.dying > 0)) drawBot(p);
  }
  for (const q of R.parts) { ctx.fillStyle = `rgba(${q.c},${Math.min(1, q.t * 2)})`; const s = q.chunk ? T * 0.14 : T * 0.08; ctx.fillRect(px(q.x) + T / 2 - s / 2, py(q.y) + T / 2 - s / 2, s, s); }
  ctx.restore();
  hud();
}
function drawBot(p) {
  const T = V.T, X = px(p.x) + T / 2, Y = py(p.y) + T / 2, a = p.alive ? 1 : Math.max(0, p.dying), bob = p.walkT ? Math.abs(Math.sin(p.walkT * 14)) * T * 0.06 : 0;
  ctx.save(); ctx.globalAlpha = a * (p.inv > 0 && Math.floor(p.inv * 12) % 2 ? 0.4 : 1); ctx.translate(X, Y - bob); if (!p.alive) ctx.scale(1 + (1 - a) * 0.6, a);
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(0, T * 0.32 + bob, T * 0.3, T * 0.09, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#e8ecf6"; K.roundRect(ctx, -T * 0.3, -T * 0.08, T * 0.6, T * 0.42, T * 0.14); ctx.fill();
  ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(0, -T * 0.12, T * 0.3, Math.PI, 0); ctx.lineTo(T * 0.3, T * 0.02); ctx.lineTo(-T * 0.3, T * 0.02); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#1d2333"; const ex = p.face === 1 ? T * 0.07 : p.face === 3 ? -T * 0.07 : 0, eyY = p.face === 2 ? -T * 0.2 : -T * 0.12;
  if (p.face !== 2) { ctx.fillRect(-T * 0.17 + ex, eyY - T * 0.05, T * 0.34, T * 0.13); ctx.fillStyle = "#7ff0ff"; ctx.fillRect(-T * 0.13 + ex, eyY - T * 0.03, T * 0.08, T * 0.08); ctx.fillRect(T * 0.05 + ex, eyY - T * 0.03, T * 0.08, T * 0.08); }
  ctx.strokeStyle = p.col; ctx.lineWidth = Math.max(1.5, T * 0.04); ctx.beginPath(); ctx.moveTo(0, -T * 0.42); ctx.lineTo(0, -T * 0.52); ctx.stroke(); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(0, -T * 0.54, T * 0.05, 0, TAU); ctx.fill();
  if (p.shield) { ctx.strokeStyle = `rgba(91,224,138,${0.6 + Math.sin(R.t * 6) * 0.3})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, T * 0.48, 0, TAU); ctx.stroke(); }
  ctx.restore();
  if (p.human && M.humans > 1 && p.alive) { ctx.fillStyle = p.col; ctx.font = `800 ${T * 0.3}px Nunito`; ctx.textAlign = "center"; ctx.fillText(p.name, X, Y - T * 0.75); }
}
function hud() {
  const T = V.T, y0 = Math.max(8, V.oy - 46);
  R.players.forEach((p, i) => { const x = V.ox + (i / 4) * GW * T + 6, w = (GW * T) / 4 - 12; ctx.globalAlpha = p.alive ? 1 : 0.4; ctx.fillStyle = "rgba(0,0,0,0.35)"; K.roundRect(ctx, x, y0, w, 38, 10); ctx.fill(); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x + 19, y0 + 19, 11, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "800 14px Nunito"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(p.name, x + 36, y0 + 12); ctx.fillStyle = "#ffd166"; ctx.font = "800 12px Nunito"; ctx.fillText("★".repeat(M.score[i]) + `  B${p.bombs} F${p.fire}${p.kick ? " K" : ""}${p.shield ? " +" : ""}`, x + 36, y0 + 28); ctx.globalAlpha = 1; });
  const tl = Math.max(0, R.limit); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = '400 20px "Lilita One"'; ctx.fillStyle = R.sudden ? "#ff5a4f" : "#fff"; ctx.fillText(K.fmtTime(tl), V.W / 2, V.oy + GH * T + 6);
  if (R.count > 0) { ctx.textBaseline = "middle"; ctx.font = `400 ${T * 2.6}px "Lilita One"`; ctx.fillStyle = "#ffb23f"; ctx.strokeStyle = "#5c2a0c"; ctx.lineWidth = 10; const s = Math.ceil(R.count); const txt = R.count > 0.2 ? String(s) : "GO!"; ctx.strokeText(txt, V.W / 2, V.oy + GH * T / 2); ctx.fillText(txt, V.W / 2, V.oy + GH * T / 2); }
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; }

/* ================= input ================= */
addEventListener("keydown", (e) => {
  if (!R || K.ui.active()) return;
  if (e.code === "Escape" || e.code === "KeyP") { pause(); return; }
  for (const p of R.players) if (p.human) { const keys = M.humans === 1 ? ["Space", "KeyF", "KeyE", "Enter"] : KEYS[p.id].bomb; if (keys.includes(e.code) && !e.repeat) { e.preventDefault(); placeBomb(p); } }
  if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
});
const padEl = $("#pad"), knob = $("#pad i");
padEl.addEventListener("pointerdown", (e) => { padEl.setPointerCapture(e.pointerId); padMove(e); });
padEl.addEventListener("pointermove", (e) => { if (e.buttons || e.pointerType === "touch") padMove(e); });
const padEnd = () => { TOUCHV.dx = TOUCHV.dy = 0; knob.style.transform = ""; };
padEl.addEventListener("pointerup", padEnd); padEl.addEventListener("pointercancel", padEnd);
function padMove(e) { const r = padEl.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy); if (d < 12) { TOUCHV.dx = TOUCHV.dy = 0; return; } TOUCHV.dx = dx / d; TOUCHV.dy = dy / d; const m = Math.min(d, r.width * 0.3); knob.style.transform = `translate(${(dx / d) * m}px,${(dy / d) * m}px)`; }
$("#bombBtn").addEventListener("pointerdown", (e) => { e.preventDefault(); if (R) placeBomb(R.players[0]); });
function touchUI() { const on = !!R && !R.over && (K.device === "touch" || matchMedia("(pointer: coarse)").matches); padEl.hidden = !on; $("#bombBtn").hidden = !on; }
$("#pauseBtn").onclick = () => pause();
function pollPad() { const P = K.pad; if (!P.connected || !R || K.ui.active()) return; if (P.pressed.start) pause(); }

/* ================= audio ================= */
K.defineSfx({
  place: (t) => K.voice(180, t, 0.08, { type: "triangle", vol: 0.08, slide: 0.7 }),
  boom: (t) => { K.noise(t, 0.5, { filter: "lowpass", freq: 1200, slide: 0.25, vol: 0.22 }); K.voice(80, t, 0.35, { type: "sine", vol: 0.18, slide: 0.45 }); },
  crate: (t) => K.noise(t, 0.15, { filter: "bandpass", freq: 1400, vol: 0.08 }),
  kick: (t) => K.voice(300, t, 0.06, { type: "square", vol: 0.04, lp: 1500 }),
  power: (t) => K.notes(t, [659, 880, 1175], 0.05, { duty: 0.25, vol: 0.045, len: 0.12 }),
  shieldpop: (t) => K.voice(900, t, 0.25, { type: "sine", vol: 0.06, slide: 0.4 }),
  die: (t) => { K.voice(500, t, 0.5, { type: "sawtooth", vol: 0.06, slide: 0.2, lp: 1800 }); K.noise(t, 0.3, { filter: "highpass", freq: 2000, vol: 0.06 }); },
  ready: (t) => K.notes(t, [392, 523], 0.1, { duty: 0.25, vol: 0.04, len: 0.2 }), tick: (t) => K.voice(660, t, 0.1, { duty: 0.25, vol: 0.05 }), go: (t) => K.voice(1046, t, 0.3, { duty: 0.25, vol: 0.06 }),
  siren: (t) => { for (let k = 0; k < 3; k++) K.voice(600, t + k * 0.4, 0.38, { type: "sawtooth", vol: 0.04, slide: 1.6, lp: 2000 }); },
  thud: (t) => K.voice(110, t, 0.12, { type: "triangle", vol: 0.07 }),
  draw: (t) => K.notes(t, [523, 494], 0.15, { type: "triangle", vol: 0.05, len: 0.3 }),
}, { boom: 0.04, crate: 0.03, thud: 0.08 });
K.songs({ boom: { bpm: 142, chords: ["Cm", "Ab", "Eb", "Bb", "Cm", "Ab", "Fm", "G"], bass: "R . R O R . R O R . R O R . F O", bassWave: 0.25, bassVol: 0.1, drums: "k . h . s . h k k . h . s . h h", arp: true, arpVol: 0.017, arpPat: [0, 1, 2, 1],
  lead: ["c5 eb5 g5 . c6 . g5 .", "ab5 - - . eb5 - c5 .", "eb5 g5 bb5 . eb6 . bb5 .", "d6 - - . bb5 - f5 .", "c5 eb5 g5 . c6 . eb6 .", "d6 c6 ab5 . eb5 - - .", "f5 ab5 c6 . f6 . c6 .", "b5 - - - d6 - - -"], leadVol: 0.034, leadWave: 0.25 } });

/* ================= screens ================= */
function title() {
  R = null; M = null; SPIRAL = null; $("#pauseBtn").hidden = true; touchUI(); K.playSong("boom", 1);
  const seg = (key, opts) => `<div class="k-seg">${opts.map(([v, l]) => `<button class="k-btn ${SAVE[key] === v ? "on" : ""}" data-a="set" data-k="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;
  K.ui.show(`<div class="logo">BLAST<span>ZONE</span></div><p class="k-sub">Drop bombs, blast crates, grab power-ups and be the last bot standing.</p>
    <div class="setup">
      <div class="row"><span>Players</span>${seg("humans", [[1, "You vs 3 bots"], [2, "2 players + 2 bots"]])}</div>
      <div class="row"><span>Bots</span>${seg("diff", [[0, "Easy"], [1, "Normal"], [2, "Hard"]])}</div>
      <div class="row"><span>Arena</span>${seg("arena", ARENAS.map((a, i) => [i, a.name]))}</div>
      <div class="row"><span>Match</span>${seg("rounds", [[2, "First to 2"], [3, "First to 3"], [5, "First to 5"]])}</div>
      <button class="k-btn primary" data-a="play" autofocus>Start match</button>
      <div class="k-row"><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>
      ${SAVE.matches ? `<p class="k-sub">Matches won: ${SAVE.wins} of ${SAVE.matches}</p>` : ""}
    </div>`, { cls: "soft" });
}
function pause() { if (!R || R.over || K.ui.active()) return; K.ui.show(`<div class="logo" style="font-size:2.6em">PAUSED</div><div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="rematch">Restart match</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "resume" }); }
function help() {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="k-help"><div><b>Bombs</b>Bombs explode in a cross after a short fuse. Flames break crates, set off other bombs and knock out any bot they touch, including you.</div>
    <div><b>Power-ups</b>B more bombs · F longer flames · S speed · K kick bombs by walking into them · + a shield that saves you once.</div><div><b>Sudden death</b>With 45 seconds left the arena starts closing in from the edges.</div>
    <div class="k-kbonly"><b>Keys</b>One player: WASD or arrows move, Space drops a bomb. Two players: P1 WASD + Space, P2 arrows + Enter.</div><div><b>Controllers</b>Each controller drives one player. Stick or D-pad moves, A drops a bomb.</div><div class="k-touchonly"><b>Touch</b>Use the pad to move and BOMB to drop a bomb.</div></div>`, { back: "title", cls: "top" });
}
function settings() { const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="title">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center">${K.ui.settingsRows()}</div>`, { back: "title", cls: "top" }); K.ui.bindSettings(s); }
K.ui.on((a, d) => {
  switch (a) {
    case "set": SAVE[d.k] = +d.v; persist(); K.sfx("click"); return title();
    case "play": case "rematch": K.sfx("ok"); return newMatch();
    case "next": K.ui.hide(); return newRound();
    case "resume": K.ui.hide(); return;
    case "title": K.sfx("back"); return title();
    case "help": K.sfx("ok"); return help();
    case "settings": K.sfx("ok"); return settings();
  }
});
K.onPause(() => { if (R && !R.over && !K.ui.active()) pause(); });

/* ================= boot ================= */
layout(); title();
const fixed = K.fixed(60);
K.loop((dt) => { pollPad(); if (R && !K.ui.active()) fixed(dt, update); render(dt); });
