"use strict";
/* GRIDLOCK · game.js — maps, routes, waves, towers, glitches, simulation and rendering */

const idx = (x, y) => y * COLS + x;
const inB = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
const walkable = (t) => t === T_PATH || t === T_SPAWN || t === T_CORE;
const buildable = (t) => t === T_EMPTY || t === T_PAD;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/* ================= maps ================= */
const TILE_CH = [".", "#", "x", "o", "S", "C"];
function rleTiles(tiles) {
  let s = "", i = 0;
  while (i < tiles.length) { const c = tiles[i]; let n = 1; while (i + n < tiles.length && tiles[i + n] === c && n < 999) n++; s += (n > 1 ? n : "") + TILE_CH[c]; i += n; }
  return s;
}
function unrleTiles(s) {
  const out = [], re = /(\d*)([.#xoSC])/g; let m;
  while ((m = re.exec(s))) { const n = m[1] ? +m[1] : 1, c = TILE_CH.indexOf(m[2]); for (let k = 0; k < n && out.length < COLS * ROWS; k++) out.push(c); }
  if (out.length !== COLS * ROWS) throw new Error("That map code has the wrong size.");
  return out;
}
const MAP_PREFIX = "GRIDLOCK-MAP:";
function mapToCode(map) { return wrapCode(MAP_PREFIX, { v: 1, n: String(map.name || "Untitled").slice(0, 40), t: rleTiles(map.tiles) }); }
function codeToMap(code) {
  const d = unwrapCode(code, MAP_PREFIX, "map");
  if (!d || typeof d.t !== "string") throw new Error("That map code is missing its tiles.");
  const map = { name: String(d.n || "Untitled").slice(0, 40), tiles: unrleTiles(d.t) };
  const a = analyze(map); if (!a.ok) throw new Error("That map can't be played: " + a.err);
  return map;
}

/* Every spawn walks the shortest path of path tiles to the core. */
function analyze(map) {
  const spawns = [], cores = [], N = COLS * ROWS;
  for (let i = 0; i < N; i++) { if (map.tiles[i] === T_SPAWN) spawns.push(i); else if (map.tiles[i] === T_CORE) cores.push(i); }
  if (!cores.length) return { ok: false, err: "Place a core." };
  if (cores.length > 1) return { ok: false, err: "Use only one core." };
  if (!spawns.length) return { ok: false, err: "Place at least one spawn." };
  if (spawns.length > 4) return { ok: false, err: "Use 4 spawns or fewer." };
  const core = cores[0], dist = new Int32Array(N).fill(-1), q = [core]; dist[core] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % COLS, cy = (c / COLS) | 0;
    for (const [dx, dy] of DIRS) { const nx = cx + dx, ny = cy + dy; if (!inB(nx, ny)) continue; const n = idx(nx, ny); if (dist[n] < 0 && walkable(map.tiles[n])) { dist[n] = dist[c] + 1; q.push(n); } }
  }
  const routes = [];
  for (const s of spawns) {
    if (dist[s] < 0) return { ok: false, err: "Every spawn needs a path to the core." };
    const cells = [s]; let c = s, pdx = 0, pdy = 0;
    while (c !== core) {
      const cx = c % COLS, cy = (c / COLS) | 0; let best = -1, bdx = 0, bdy = 0;
      for (const [dx, dy] of [[pdx, pdy], ...DIRS]) {
        if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (!inB(nx, ny)) continue;
        const n = idx(nx, ny); if (dist[n] === dist[c] - 1) { best = n; bdx = dx; bdy = dy; break; }
      }
      cells.push(best); c = best; pdx = bdx; pdy = bdy;
    }
    routes.push(cells);
  }
  if (routes.some((r) => r.length < 4)) return { ok: false, err: "Spawns need to be farther from the core." };
  return { ok: true, spawns, core, routes };
}
/* Turn a list of cells into a walkable polyline, with an off-board entry point for edge spawns. */
function makeRoute(cells, air) {
  const pts = cells.map((c) => [(c % COLS) + 0.5, ((c / COLS) | 0) + 0.5]);
  const [sx, sy] = [cells[0] % COLS, (cells[0] / COLS) | 0];
  if (sx === 0) pts.unshift([-0.6, sy + 0.5]); else if (sx === COLS - 1) pts.unshift([COLS + 0.6, sy + 0.5]);
  else if (sy === 0) pts.unshift([sx + 0.5, -0.6]); else if (sy === ROWS - 1) pts.unshift([sx + 0.5, ROWS + 0.6]);
  const P = air ? [pts[0], pts[pts.length - 1]] : pts;
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { pts: P, cum, total: cum[cum.length - 1] };
}
function routePos(r, d, hint = 0) {
  let i = Math.min(hint, r.pts.length - 2);
  while (i < r.pts.length - 2 && d > r.cum[i + 1]) i++;
  const a = r.pts[i], b = r.pts[i + 1], seg = r.cum[i + 1] - r.cum[i] || 1, k = clamp((d - r.cum[i]) / seg, 0, 1);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, i];
}

/* Random maps: carve a random spanning tree over a 10x6 lattice of nodes (one node every other cell),
   then use the tree path between spawn and core. Corridors are always a cell apart, so there is room
   to build everywhere along the route. */
function randomMap(seed, name) {
  const r = RNG(seed), NX = 10, NY = 6;
  const nodeCell = (n) => idx((n % NX) * 2 + 1, ((n / NX) | 0) * 2 + 1);
  for (let attempt = 0; attempt < 600; attempt++) {
    const adj = Array.from({ length: NX * NY }, () => []), seen = new Uint8Array(NX * NY), stack = [r.int(NX * NY)];
    seen[stack[0]] = 1;
    while (stack.length) {
      const cur = stack[stack.length - 1], cx = cur % NX, cy = (cur / NX) | 0, nb = [];
      for (const [dx, dy] of DIRS) { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < NX && ny < NY && !seen[ny * NX + nx]) nb.push(ny * NX + nx); }
      if (!nb.length) { stack.pop(); continue; }
      const nx = r.pick(nb); seen[nx] = 1; adj[cur].push(nx); adj[nx].push(cur); stack.push(nx);
    }
    const treePath = (a, b) => {
      const par = new Int32Array(NX * NY).fill(-2), q = [a]; par[a] = -1;
      for (let h = 0; h < q.length; h++) for (const n of adj[q[h]]) if (par[n] === -2) { par[n] = q[h]; q.push(n); }
      const out = []; for (let c = b; c !== -1; c = par[c]) out.push(c); return out.reverse();
    };
    const two = r() < 0.38;
    const core = (r.int(NY)) * NX + 6 + r.int(4);
    const edges = [];
    for (let j = 0; j < NY; j++) edges.push(j * NX);
    for (let i = 1; i < 6; i++) { edges.push(i); edges.push((NY - 1) * NX + i); }
    const spawnA = r.pick(edges.filter((n) => n % NX === 0)), pathA = treePath(spawnA, core);
    const lenA = pathA.length * 2 - 1;
    if (lenA < (two ? 33 : 45) || lenA > (two ? 70 : 78)) continue;
    const paths = [pathA];
    if (two) {
      const cands = r.shuffle(edges.filter((n) => n !== spawnA && Math.abs((n % NX) - (spawnA % NX)) + Math.abs(((n / NX) | 0) - ((spawnA / NX) | 0)) > 3));
      let ok = false;
      for (const s of cands) { const p = treePath(s, core), len = p.length * 2 - 1; if (len >= 30 && len <= 70) { paths.push(p); ok = true; break; } }
      if (!ok) continue;
    }
    const tiles = new Array(COLS * ROWS).fill(T_EMPTY);
    for (const p of paths) {
      for (let k = 0; k < p.length; k++) {
        tiles[nodeCell(p[k])] = T_PATH;
        if (k) { const a = nodeCell(p[k - 1]), b = nodeCell(p[k]); tiles[(a + b) / 2] = T_PATH; }
      }
      const s = p[0], sx = (s % NX) * 2 + 1, sy = ((s / NX) | 0) * 2 + 1;
      let st;
      if (s % NX === 0) st = idx(0, sy); else if (((s / NX) | 0) === 0) st = idx(sx, 0); else st = idx(sx, sy);
      if (st !== nodeCell(s)) tiles[st] = T_SPAWN; else tiles[st] = T_SPAWN;
    }
    tiles[nodeCell(core)] = T_CORE;
    const nearPath = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (inB(nx, ny) && walkable(tiles[idx(nx, ny)])) return true; } return false; };
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = idx(x, y); if (tiles[i] !== T_EMPTY) continue;
      if (r() < (nearPath(x, y) ? 0.05 : 0.2)) tiles[i] = T_BLOCK;
    }
    const padSpots = r.shuffle([...Array(COLS * ROWS).keys()].filter((i) => tiles[i] === T_EMPTY && nearPath(i % COLS, (i / COLS) | 0)));
    let pads = 0;
    for (const i of padSpots) {
      if (pads >= 3) break;
      const x = i % COLS, y = (i / COLS) | 0; let clash = false;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inB(x + dx, y + dy) && tiles[idx(x + dx, y + dy)] === T_PAD) clash = true;
      if (!clash) { tiles[i] = T_PAD; pads++; }
    }
    const map = { name: name || "Random grid", tiles, seed };
    if (analyze(map).ok) return map;
  }
  return fallbackMap();
}
function fallbackMap() {
  const tiles = new Array(COLS * ROWS).fill(T_EMPTY);
  for (let x = 0; x < COLS; x++) tiles[idx(x, 5)] = T_PATH;
  tiles[idx(0, 5)] = T_SPAWN; tiles[idx(COLS - 2, 5)] = T_CORE; tiles[idx(COLS - 1, 5)] = T_EMPTY;
  return { name: "Straight line", tiles, seed: 0 };
}

/* ================= waves ================= */
function hpScale(n) { return G.D.hp * (1 + 0.15 * (n - 1) + 0.022 * (n - 1) * (n - 1)) * (n > WIN_WAVE ? Math.pow(1.05, n - WIN_WAVE) : 1); }
function makeWave(n) {
  const r = RNG((G.waveSeed + n * 7919) >>> 0), boss = n % 10 === 0, nS = G.routes.length;
  let budget = 10 + 5.5 * n + 0.42 * n * n;
  const pool = Object.values(ENEMIES).filter((e) => !e.boss && e.from <= n);
  const groups = [];
  if (boss) { groups.push({ type: "boss", count: 1 + Math.floor((n - 10) / 30) }); budget *= 0.45; }
  const nG = n < 3 ? 1 : n < 8 ? 2 : r() < 0.5 ? 2 : 3;
  const fresh = pool.find((e) => e.from === n);
  for (let g = 0; g < nG; g++) {
    const type = g === 0 && fresh ? fresh : r.weighted(pool, (e) => (e.id === "bit" ? Math.max(0.35, 1.6 - n * 0.05) : 1) * (n - e.from < 4 ? 1.4 : 1));
    let share = (budget / (nG - g)) * (g === nG - 1 ? 1 : 0.8 + r() * 0.4);
    if (type === fresh && g === 0 && nG > 1) share = Math.min(share, budget * (type.air ? 0.14 : 0.4));
    // very large groups become fewer, tougher glitches so the grid stays readable
    const raw = Math.max(1, share / type.threat), cap = type.id === "swarm" ? 70 : 45, count = Math.min(cap, Math.max(1, Math.round(raw)));
    budget -= raw * type.threat;
    groups.push({ type: type.id, count, hm: Math.max(1, raw / count) });
  }
  const events = []; let t = 0;
  groups.forEach((gp, gi) => {
    const e = ENEMIES[gp.type], s = gp.type === "boss" ? 0 : (gi + n) % nS;
    for (let i = 0; i < gp.count; i++) { events.push({ t, type: gp.type, s: nS > 1 && gp.type === "swarm" ? (s + (i >> 3)) % nS : s, hm: gp.hm || 1 }); t += e.gap * (0.85 + r() * 0.3); }
    t += 1.8;
  });
  const summary = {};
  for (const gp of groups) summary[gp.type] = (summary[gp.type] || 0) + gp.count;
  return { n, events, boss, summary };
}

/* ================= game state ================= */
let G = null;
function newGame(o) {
  const info = analyze(o.map);
  if (!info.ok) throw new Error(info.err);
  const D = DIFFS[o.diff] || DIFFS.normal;
  G = {
    o, map: o.map, info, diff: o.diff, D, endless: !!o.endless, daily: !!o.daily, test: !!o.test,
    credits: D.credits, lives: D.lives, maxLives: D.lives, wave: 0, cleared: 0, bonusPaid: 0, queue: [], waveT: 0, running: false,
    towers: [], enemies: [], shots: [], fx: [], texts: [], parts: [], fires: [],
    nextId: 1, speed: 1, t: 0, kills: 0, earned: 0, leaked: 0, bossKills: 0, won: false, over: false, banked: false, wonShown: false,
    waveSeed: ((o.seed >>> 0) ^ 0x5bd1e995) >>> 0, autoT: -1, shake: 0, leakFlash: 0, timeLive: 0,
    routes: info.routes.map((c) => makeRoute(c)), airRoutes: info.routes.map((c) => makeRoute(c, true)),
  };
  G.preview = makeWave(1);
  return G;
}
function startWave() {
  if (!G || G.over) return false;
  if (G.running && G.queue.length) return false;
  if (G.running) { payWave(G.wave, true); }
  const n = G.wave + 1, w = G.preview && G.preview.n === n ? G.preview : makeWave(n);
  G.wave = n; G.running = true;
  const base = G.waveT;
  for (const ev of w.events) G.queue.push({ ...ev, t: ev.t + base + 0.4 });
  G.queue.sort((a, b) => a.t - b.t);
  for (const t of G.towers) t.free = false;
  G.preview = makeWave(n + 1); G.autoT = -1;
  sfx(w.boss ? "boss" : "wave");
  if (w.boss) musicPlay("boss", 3); else if (MUS.id !== "game") musicPlay("game", 3);
  UI.onWaveStart(n, w.boss);
  return true;
}
function payWave(n, early) {
  if (G.bonusPaid >= n) return;
  G.bonusPaid = n;
  let bonus = Math.round(20 + 2 * n);
  if (early) bonus += 5 + n;
  let mined = 0, interest = 0;
  for (const t of G.towers) if (t.type === "miner") { mined += TOWERS.miner.income[t.lv - 1]; if (t.lv >= 4) interest = Math.max(interest, Math.min(60, Math.floor(G.credits * 0.02))); }
  addCredits(bonus + mined + interest);
  UI.toast(`Wave ${n} ${early ? "called early" : "cleared"}: +${bonus + mined + interest}`, mined ? `Miners +${mined}${interest ? `, interest +${interest}` : ""}` : "");
}
function addCredits(v) { G.credits += v; G.earned += v; }
function waveCleared() {
  G.running = false;
  payWave(G.wave, false);
  G.cleared = G.wave;
  sfx("clear");
  if (MUS.id === "boss") musicPlay("game", 3);
  checkAch(G);
  if (!G.endless && G.cleared >= WIN_WAVE && !G.won) { G.won = true; UI.onWin(); return; }
  if (!G.test) saveGameState();
  if (SAVE.settings.auto) G.autoT = 2.5;
  UI.onWaveClear(G.cleared);
}

/* ---------- towers ---------- */
function towerAt(x, y) { return G.towers.find((t) => t.x === x && t.y === y) || null; }
function canPlace(type, x, y) {
  if (!inB(x, y)) return "Off the grid.";
  if (!buildable(G.map.tiles[idx(x, y)])) return "You can't build there.";
  if (towerAt(x, y)) return "Something is already built there.";
  if (!towerUnlocked(type)) return "That tower is still locked.";
  if (G.credits < TOWERS[type].cost) return "Not enough credits.";
  return "";
}
function towerUnlocked(type) { return START_TOWERS.includes(type) || SAVE.unlocked.includes(type) || (G && G.test); }
function placeTower(type, x, y) {
  const err = canPlace(type, x, y); if (err) return err;
  const d = TOWERS[type];
  G.credits -= d.cost;
  const t = { id: G.nextId++, type, x, y, cx: x + 0.5, cy: y + 0.5, lv: 1, spent: d.cost, target: type === "laser" ? "strong" : "first", cd: 0.2, ang: -Math.PI / 2, kills: 0, dmg: 0, free: !G.running, shots: 0, ramp: 0, beam: null, beam2: null, spin: 0 };
  G.towers.push(t);
  refreshTowers();
  for (let i = 0; i < 14; i++) G.parts.push({ x: t.cx, y: t.cy, vx: rnd(-2, 2), vy: rnd(-2, 2), life: 0.5, max: 0.5, rgb: d.rgb, s: 0.06 });
  G.fx.push({ kind: "ring", x: t.cx, y: t.cy, r0: 0.1, r1: 0.8, t: 0, max: 0.35, rgb: d.rgb });
  sfx("build");
  return "";
}
function upgradeCost(t) { return t.lv >= 4 ? 0 : TOWERS[t.type].ups[t.lv - 1]; }
function upgradeTower(t) {
  const c = upgradeCost(t); if (!c) return "Already at max level.";
  if (G.credits < c) return "Not enough credits.";
  G.credits -= c; t.spent += c; t.lv++;
  refreshTowers();
  G.fx.push({ kind: "ring", x: t.cx, y: t.cy, r0: 0.2, r1: 1.2, t: 0, max: 0.45, rgb: TOWERS[t.type].rgb });
  sfx("upgrade"); checkAch(G);
  return "";
}
const sellValue = (t) => (t.free ? t.spent : Math.floor(t.spent * 0.7));
function sellTower(t) {
  G.credits += sellValue(t);
  G.towers = G.towers.filter((x) => x !== t);
  refreshTowers();
  for (let i = 0; i < 10; i++) G.parts.push({ x: t.cx, y: t.cy, vx: rnd(-2.5, 2.5), vy: rnd(-2.5, 2.5), life: 0.45, max: 0.45, rgb: "255,225,77", s: 0.05 });
  sfx("sell");
}
/* Stats with pads and amplifiers applied (amplifiers don't stack: the strongest one counts). */
function refreshTowers() {
  const amps = G.towers.filter((t) => t.type === "amp");
  for (const t of G.towers) {
    const d = TOWERS[t.type], L = t.lv - 1;
    let dm = 1, rm = 1, fm = 1, ab = 0, ar = 0, af = 0;
    if (G.map.tiles[idx(t.x, t.y)] === T_PAD) { dm += 0.2; rm += 0.1; }
    if (!d.support) for (const a of amps) {
      const A = TOWERS.amp, al = a.lv - 1;
      if (Math.hypot(a.x - t.x, a.y - t.y) <= A.radius[al] + 0.01) { ab = Math.max(ab, A.boost[al]); ar = Math.max(ar, A.rboost[al]); if (a.lv >= 4) af = 0.15; }
    }
    dm += ab; rm += ar; fm += af;
    t.boosted = ab > 0;
    t.s = {
      dmg: (d.dmg ? d.dmg[L] : 0) * dm, dps: (d.dps ? d.dps[L] : 0) * dm, rate: (d.rate ? d.rate[L] : 0) * fm,
      range: (d.range ? d.range[L] : d.radius ? d.radius[L] : 0) * (d.support ? 1 : rm), splash: d.splash ? d.splash[L] : 0,
      slow: d.slow ? d.slow[L] : 0, chains: d.chains ? d.chains[L] : 0, min: d.minRange || 0, dmgMul: dm,
    };
  }
}

/* ---------- glitches ---------- */
function spawnEnemy(type, s, at) {
  const d = ENEMIES[type], route = d.air ? G.airRoutes[s] : G.routes[s], n = G.wave;
  const hp = d.hp * hpScale(n) * (d.boss ? 1 + Math.max(0, n - 10) * 0.02 : 1);
  const e = {
    id: G.nextId++, type, d, route, dist: at ? at.dist : 0, seg: at ? at.seg : 0, x: 0, y: 0, hp, maxHp: hp,
    shield: d.shield ? d.shield * hpScale(n) : 0, maxShield: d.shield ? d.shield * hpScale(n) : 0, armor: d.armor * (1 + Math.max(0, n - 20) * 0.03),
    spd: d.spd * (0.95 + Math.random() * 0.1), slowT: 0, slowAmt: 0, chill: 0, stunT: 0, hitT: -9, healT: 1 + Math.random(), spawnT: 3, rot: Math.random() * TAU,
    air: !!d.air, dead: false, flash: 0, wob: Math.random() * TAU, bursts: d.boss ? [0.75, 0.5, 0.25] : [],
  };
  const [x, y, seg] = routePos(route, e.dist, e.seg); e.x = x; e.y = y; e.seg = seg;
  G.enemies.push(e);
  return e;
}
function damage(e, amount, src, o = {}) {
  if (e.dead || amount <= 0) return 0;
  let dmg = amount;
  if (e.chill > 0) dmg *= 1.2;
  e.hitT = G.t; e.flash = 0.06;
  if (e.shield > 0) {
    const sm = o.shieldMul || 1, sd = dmg * sm;
    if (sd < e.shield) { e.shield -= sd; if (src) src.dmg += sd / sm; return sd / sm; }
    dmg -= e.shield / sm; e.shield = 0; sfx("shield");
    G.fx.push({ kind: "ring", x: e.x, y: e.y, r0: 0.2, r1: 0.7, t: 0, max: 0.3, rgb: "93,255,138" });
  }
  if (e.armor && !o.pierce) dmg = Math.max(dmg * 0.2, dmg - e.armor * (o.half ? 0.5 : 1));
  e.hp -= dmg;
  if (src) src.dmg += dmg;
  if (o.stun) e.stunT = Math.max(e.stunT, o.stun);
  if (e.hp <= 0) kill(e, src);
  return dmg;
}
function kill(e, src) {
  if (e.dead) return;
  e.dead = true; G.kills++;
  if (src) src.kills++;
  const b = Math.max(1, Math.round(e.d.bounty * G.D.bounty));
  addCredits(b);
  G.texts.push({ x: e.x, y: e.y - 0.3, s: "+" + b, t: 0, rgb: "255,225,77" });
  const n = e.d.boss ? 40 : 8;
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = rnd(0.6, e.d.boss ? 4 : 2.4); G.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.25, 0.6), max: 0.6, rgb: e.d.rgb, s: e.d.boss ? 0.09 : 0.05 }); }
  G.fx.push({ kind: "ring", x: e.x, y: e.y, r0: 0.05, r1: e.d.boss ? 2.2 : 0.55, t: 0, max: e.d.boss ? 0.6 : 0.25, rgb: e.d.rgb });
  sfx("kill");
  if (e.d.split) { for (const off of [-0.25, 0.25]) { const c = spawnEnemy(e.d.split, G.routes.indexOf(e.route) >= 0 ? G.routes.indexOf(e.route) : 0, { dist: Math.max(0, e.dist + off), seg: 0 }); c.hp = c.maxHp *= 0.6; } sfx("split"); }
  if (e.d.boss) { G.bossKills++; G.shake = Math.max(G.shake, 0.4); sfx("boom"); UI.toast("Overflow destroyed!", "+" + b + " credits"); }
}
function leak(e) {
  e.dead = true;
  G.lives -= e.d.lives; G.leaked += e.d.lives; G.leakFlash = 1; G.shake = Math.max(G.shake, 0.25);
  sfx("leak");
  const [cx, cy] = coreCenter();
  G.fx.push({ kind: "ring", x: cx, y: cy, r0: 0.3, r1: 1.6, t: 0, max: 0.5, rgb: "255,62,94" });
  if (G.lives <= 0 && !G.over) { G.lives = 0; gameOver(); }
}
const coreCenter = () => [(G.info.core % COLS) + 0.5, ((G.info.core / COLS) | 0) + 0.5];
function gameOver() {
  G.over = true; G.running = false; G.queue.length = 0;
  sfx("lose"); musicPlay("lose", 3);
  clearGameState();
  UI.onLose();
}

/* ---------- tower behaviour ---------- */
function pickTarget(t, range, o = {}) {
  let best = null, bs = -Infinity; const r2 = range * range, m2 = (o.min || 0) ** 2;
  for (const e of G.enemies) {
    if (e.dead || (e.air && !o.air) || (o.skip && o.skip.has(e))) continue;
    const dx = e.x - (o.x ?? t.cx), dy = e.y - (o.y ?? t.cy), d2 = dx * dx + dy * dy;
    if (d2 > r2 || d2 < m2) continue;
    const rem = e.route.total - e.dist;
    let s;
    switch (o.mode || t.target) {
      case "last": s = rem; break;
      case "strong": s = e.hp + e.shield; break;
      case "close": s = -d2; break;
      default: s = -rem;
    }
    if (s > bs) { bs = s; best = e; }
  }
  return best;
}
function predict(e, sec) {
  const spd = e.stunT > 0 ? 0 : e.spd * (e.slowT > 0 ? 1 - e.slowAmt : 1);
  const [x, y] = routePos(e.route, Math.min(e.route.total, e.dist + spd * sec), e.seg); return [x, y];
}
function aim(t, e, dt) { const want = Math.atan2(e.y - t.cy, e.x - t.cx); let da = want - t.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; t.ang += clamp(da, -12 * dt, 12 * dt); }
function explode(x, y, r, dmg, src, o = {}) {
  for (const e of G.enemies) { if (e.dead || e.air) continue; if (Math.hypot(e.x - x, e.y - y) <= r + e.d.size * 0.5) damage(e, dmg, src, o); }
  G.fx.push({ kind: "boom", x, y, r, t: 0, max: 0.35, rgb: o.rgb || "255,177,59" });
  for (let i = 0; i < 10; i++) { const a = Math.random() * TAU, v = rnd(1, 3.5) * r; G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.2, 0.45), max: 0.45, rgb: o.rgb || "255,177,59", s: 0.05 }); }
  sfx("boom");
}
const TB = {
  pulse(t, dt) {
    t.cd -= dt;
    const e = pickTarget(t, t.s.range, { air: true }); if (!e) return;
    aim(t, e, dt);
    if (t.cd > 0) return;
    t.cd = 1 / t.s.rate; t.shots++;
    const burst = t.lv >= 4 && t.shots % 6 === 0 ? 3 : 1;
    for (let i = 0; i < burst; i++) G.shots.push({ kind: "bullet", x: t.cx + Math.cos(t.ang) * 0.35, y: t.cy + Math.sin(t.ang) * 0.35, tg: e, tx: e.x, ty: e.y, spd: 13, dmg: t.s.dmg, src: t, rgb: TOWERS.pulse.rgb, delay: i * 0.06 });
    t.kick = 0.08; sfx("pulse");
  },
  cannon(t, dt) {
    t.cd -= dt;
    const e = pickTarget(t, t.s.range); if (!e) return;
    aim(t, e, dt);
    if (t.cd > 0) return;
    t.cd = 1 / t.s.rate;
    G.shots.push({ kind: "shell", x: t.cx + Math.cos(t.ang) * 0.4, y: t.cy + Math.sin(t.ang) * 0.4, tg: e, tx: e.x, ty: e.y, spd: 7.5, dmg: t.s.dmg, splash: t.s.splash, src: t, cluster: t.lv >= 4 });
    t.kick = 0.12; sfx("cannon");
  },
  cryo(t, dt) {
    t.spin += dt * 1.5; t.cd -= dt;
    if (t.cd > 0) return;
    t.cd = 0.5;
    let any = false;
    for (const e of G.enemies) {
      if (e.dead || Math.hypot(e.x - t.cx, e.y - t.cy) > t.s.range) continue;
      any = true;
      e.slowAmt = Math.max(e.slowAmt, t.s.slow); e.slowT = 0.65;
      if (t.lv >= 4) e.chill = 0.65;
      damage(e, TOWERS.cryo.dps[t.lv - 1] * t.s.dmgMul * 0.5, t);
    }
    if (any) { t.pulse = 0.3; sfx("freeze"); }
  },
  arc(t, dt) {
    t.cd -= dt; t.spin += dt * 3;
    if (t.cd > 0) return;
    const e = pickTarget(t, t.s.range, { air: true }); if (!e) return;
    t.cd = 1 / t.s.rate;
    const hit = new Set([e]), pts = [[t.cx, t.cy - 0.15], [e.x, e.y]];
    let cur = e, dmg = t.s.dmg;
    damage(e, dmg, t, { half: true, stun: t.lv >= 4 && Math.random() < 0.15 ? 0.5 : 0 });
    for (let k = 1; k < t.s.chains; k++) {
      const nx = pickTarget(t, 1.7, { air: true, x: cur.x, y: cur.y, mode: "close", skip: hit }); if (!nx) break;
      dmg *= 0.8; hit.add(nx); pts.push([nx.x, nx.y]); damage(nx, dmg, t, { half: true, stun: t.lv >= 4 && Math.random() < 0.15 ? 0.5 : 0 }); cur = nx;
    }
    G.fx.push({ kind: "zap", pts, t: 0, max: 0.18, rgb: TOWERS.arc.rgb, seed: Math.random() * 1e6 });
    sfx("arc");
  },
  laser(t, dt) {
    const keep = t.beam && !t.beam.dead && Math.hypot(t.beam.x - t.cx, t.beam.y - t.cy) <= t.s.range ? t.beam : null;
    const e = keep || pickTarget(t, t.s.range, { air: true });
    if (e !== t.beam) { t.ramp = 0; if (e) sfx("laser"); }
    t.beam = e;
    if (!e) { t.beam2 = null; return; }
    aim(t, e, dt);
    t.ramp = Math.min(2.5, t.ramp + dt);
    const mul = 1 + 2 * (t.ramp / 2.5), dps = t.s.dps * mul;
    damage(e, dps * dt, t, { shieldMul: 3 });
    if (t.lv >= 4) {
      const skip = new Set([e]); const e2 = t.beam2 && !t.beam2.dead && t.beam2 !== e && Math.hypot(t.beam2.x - e.x, t.beam2.y - e.y) < 2 ? t.beam2 : pickTarget(t, 2, { air: true, x: e.x, y: e.y, mode: "close", skip });
      t.beam2 = e2; if (e2) damage(e2, dps * 0.6 * dt, t, { shieldMul: 3 });
    }
  },
  mortar(t, dt) {
    t.cd -= dt;
    const e = pickTarget(t, t.s.range, { min: t.s.min }); if (!e) return;
    aim(t, e, dt);
    if (t.cd > 0) return;
    t.cd = 1 / t.s.rate;
    const fl = 0.9, [px, py] = predict(e, fl);
    G.shots.push({ kind: "lob", sx: t.cx, sy: t.cy, x: t.cx, y: t.cy, tx: px, ty: py, t: 0, fl, dmg: t.s.dmg, splash: t.s.splash, src: t, napalm: t.lv >= 4 });
    t.kick = 0.15; sfx("mortar");
  },
  rail(t, dt) {
    t.cd -= dt;
    const e = pickTarget(t, t.s.range, { air: true }); if (!e) return;
    aim(t, e, dt);
    if (t.cd > 0) return;
    const want = Math.atan2(e.y - t.cy, e.x - t.cx); let da = Math.abs(want - t.ang); if (da > Math.PI) da = TAU - da; if (da > 0.15) return;
    t.cd = 1 / t.s.rate;
    const L = t.s.range + 0.5, ex = t.cx + Math.cos(t.ang) * L, ey = t.cy + Math.sin(t.ang) * L;
    for (const q of G.enemies) {
      if (q.dead) continue;
      const vx = ex - t.cx, vy = ey - t.cy, wx = q.x - t.cx, wy = q.y - t.cy, k = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1);
      if (Math.hypot(q.x - (t.cx + vx * k), q.y - (t.cy + vy * k)) <= 0.22 + q.d.size * 0.5) damage(q, t.s.dmg, t, { pierce: true, stun: t.lv >= 4 ? 0.4 : 0 });
    }
    G.fx.push({ kind: "rail", x0: t.cx, y0: t.cy, x1: ex, y1: ey, t: 0, max: 0.35 });
    t.kick = 0.2; G.shake = Math.max(G.shake, 0.06); sfx("rail");
  },
  amp(t, dt) { t.spin += dt; },
  miner(t, dt) { t.spin += dt * (G.running ? 3 : 1); },
};

/* ---------- update ---------- */
function step(dt) {
  if (!G || G.over) return;
  G.t += dt;
  if (G.running) G.timeLive += dt;
  G.waveT += dt;
  while (G.queue.length && G.queue[0].t <= G.waveT) { const ev = G.queue.shift(); const e = spawnEnemy(ev.type, Math.min(ev.s, G.routes.length - 1)); if (ev.hm > 1) { e.hp *= ev.hm; e.maxHp *= ev.hm; e.shield *= ev.hm; e.maxShield *= ev.hm; e.big = true; } }
  // glitches
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.rot += dt * (e.d.boss ? 0.6 : 2); if (e.flash > 0) e.flash -= dt;
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowAmt = 0; }
    if (e.chill > 0) e.chill -= dt;
    if (e.stunT > 0) { e.stunT -= dt; continue; }
    e.dist += e.spd * (1 - e.slowAmt) * dt;
    if (e.dist >= e.route.total) { leak(e); continue; }
    const [x, y, seg] = routePos(e.route, e.dist, e.seg); e.x = x; e.y = y; e.seg = seg;
    if (e.maxShield && e.shield < e.maxShield && G.t - e.hitT > 3) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.3 * dt);
    if (e.d.heal) {
      e.healT -= dt;
      if (e.healT <= 0) {
        e.healT = 2;
        for (const o of G.enemies) if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 1.5) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * e.d.heal);
        G.fx.push({ kind: "ring", x: e.x, y: e.y, r0: 0.2, r1: 1.5, t: 0, max: 0.5, rgb: "255,255,255" });
      }
    }
    if (e.d.boss && e.bursts.length && e.hp / e.maxHp < e.bursts[0]) {
      e.bursts.shift();
      for (let k = 0; k < 6; k++) spawnEnemy("bit", Math.max(0, G.routes.indexOf(e.route)), { dist: Math.max(0, e.dist + (k - 2.5) * 0.18), seg: 0 });
      G.fx.push({ kind: "ring", x: e.x, y: e.y, r0: 0.3, r1: 1.8, t: 0, max: 0.45, rgb: e.d.rgb }); sfx("split");
    }
  }
  // towers
  for (const t of G.towers) { if (t.kick > 0) t.kick -= dt; if (t.pulse > 0) t.pulse -= dt; TB[t.type](t, dt); }
  // shots
  for (const s of G.shots) {
    if (s.dead) continue;
    if (s.delay > 0) { s.delay -= dt; continue; }
    if (s.kind === "lob") {
      s.t += dt; const k = Math.min(1, s.t / s.fl); s.x = lerp(s.sx, s.tx, k); s.y = lerp(s.sy, s.ty, k); s.z = Math.sin(Math.PI * k) * 1.4;
      if (k >= 1) {
        s.dead = true; explode(s.tx, s.ty, s.splash, s.dmg, s.src, { rgb: "255,106,61" });
        if (s.napalm) G.fires.push({ x: s.tx, y: s.ty, r: s.splash * 0.75, t: 0, max: 3, src: s.src });
      }
      continue;
    }
    if (s.tg && !s.tg.dead) { s.tx = s.tg.x; s.ty = s.tg.y; }
    const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), mv = s.spd * dt;
    if (d <= mv + 0.05) {
      s.dead = true;
      if (s.kind === "bullet") { if (s.tg && !s.tg.dead) damage(s.tg, s.dmg, s.src); G.fx.push({ kind: "spark", x: s.tx, y: s.ty, t: 0, max: 0.12, rgb: s.rgb }); }
      else {
        explode(s.tx, s.ty, s.splash, s.dmg, s.src);
        if (s.cluster) for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.random() * 0.6, bx = s.tx + Math.cos(a) * 0.6, by = s.ty + Math.sin(a) * 0.6; G.shots.push({ kind: "lob", sx: s.tx, sy: s.ty, x: s.tx, y: s.ty, tx: bx, ty: by, t: 0, fl: 0.25, dmg: s.dmg * 0.35, splash: s.splash * 0.55, src: s.src }); }
      }
    } else { s.x += (dx / d) * mv; s.y += (dy / d) * mv; }
  }
  // burning ground
  for (const f of G.fires) {
    f.t += dt;
    for (const e of G.enemies) if (!e.dead && !e.air && Math.hypot(e.x - f.x, e.y - f.y) <= f.r) damage(e, 25 * dt, f.src);
    if (Math.random() < 0.4) G.parts.push({ x: f.x + rnd(-f.r, f.r) * 0.7, y: f.y + rnd(-f.r, f.r) * 0.7, vx: 0, vy: -rnd(0.4, 1), life: 0.4, max: 0.4, rgb: pickFire(), s: 0.05 });
  }
  G.fires = G.fires.filter((f) => f.t < f.max);
  // effects
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter((f) => f.t < f.max);
  for (const p of G.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3; }
  G.parts = G.parts.filter((p) => p.life > 0);
  if (G.parts.length > 600) G.parts.splice(0, G.parts.length - 600);
  for (const x of G.texts) x.t += dt;
  G.texts = G.texts.filter((x) => x.t < 0.9);
  if (G.enemies.length > 40) G.enemies = G.enemies.filter((e) => !e.dead);
  if (G.shots.length > 40) G.shots = G.shots.filter((s) => !s.dead);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.5);
  if (G.leakFlash > 0) G.leakFlash = Math.max(0, G.leakFlash - dt * 2);
  // wave over?
  if (G.running && !G.queue.length && !G.enemies.some((e) => !e.dead) && !G.over) waveCleared();
  if (G.autoT > 0 && !G.running) { G.autoT -= dt; if (G.autoT <= 0) startWave(); }
}
const pickFire = () => ["255,106,61", "255,177,59", "255,225,77"][(Math.random() * 3) | 0];

/* ---------- saving a game in progress (between waves) ---------- */
const RUN_KEY = "gridlock.run";
function saveGameState() {
  if (!G || G.test || G.over) return;
  const s = { v: 1, map: { name: G.map.name, t: rleTiles(G.map.tiles), seed: G.map.seed || 0 }, o: { diff: G.diff, endless: G.endless, daily: G.daily, date: G.o.date || "", seed: G.o.seed, mode: G.o.mode },
    credits: G.credits, lives: G.lives, wave: G.wave, cleared: G.cleared, kills: G.kills, earned: G.earned, leaked: G.leaked, bossKills: G.bossKills, won: G.won, timeLive: G.timeLive,
    towers: G.towers.map((t) => [t.type, t.x, t.y, t.lv, t.spent, t.target, t.kills, Math.round(t.dmg)]) };
  store.set(RUN_KEY, JSON.stringify(s));
}
function loadGameState() { try { const s = JSON.parse(store.get(RUN_KEY) || "null"); return s && s.v === 1 ? s : null; } catch { return null; } }
function clearGameState() { store.del(RUN_KEY); }
function resumeGame(s) {
  const map = { name: s.map.name, tiles: unrleTiles(s.map.t), seed: s.map.seed };
  newGame({ map, diff: s.o.diff, endless: s.o.endless, daily: s.o.daily, date: s.o.date, seed: s.o.seed, mode: s.o.mode });
  Object.assign(G, { credits: s.credits, lives: s.lives, wave: s.wave, cleared: s.cleared, bonusPaid: s.wave, kills: s.kills, earned: s.earned, leaked: s.leaked, bossKills: s.bossKills, won: s.won, wonShown: s.won, timeLive: s.timeLive || 0 });
  for (const [type, x, y, lv, spent, target, kills, dmg] of s.towers) {
    if (!TOWERS[type]) continue;
    G.towers.push({ id: G.nextId++, type, x, y, cx: x + 0.5, cy: y + 0.5, lv, spent, target, cd: 0.2, ang: -Math.PI / 2, kills, dmg, free: false, shots: 0, ramp: 0, beam: null, beam2: null, spin: 0 });
  }
  refreshTowers();
  G.preview = makeWave(G.wave + 1);
}

/* ---------- end of game bookkeeping ---------- */
function bankGame() {
  if (!G || G.banked || G.test) return;
  G.banked = true;
  const st = SAVE.stats;
  st.games++; st.kills += G.kills; st.waves += G.cleared; st.credits += G.earned; st.towers += G.towers.length; st.leaks += G.leaked; st.time += G.timeLive;
  if (G.won) st.wins++;
  const key = G.daily ? "daily" : G.diff + (G.endless ? ":endless" : "");
  G.prevBest = SAVE.best[key] || 0;
  SAVE.best[key] = Math.max(SAVE.best[key] || 0, G.cleared);
  if (G.daily) { const d = SAVE.daily; if (d.date !== G.o.date) { d.date = G.o.date; d.wave = 0; d.won = false; } d.wave = Math.max(d.wave, G.cleared); d.won = d.won || G.won; }
  checkAch(G);
  save();
}
function checkAch(g) {
  if (!g || g.test) return;
  for (const a of ACH) {
    if (SAVE.ach[a.id]) continue;
    let ok = false; try { ok = !!a.test(g); } catch { ok = false; }
    if (!ok) continue;
    SAVE.ach[a.id] = Date.now();
    let note = "";
    if (a.unlock && !SAVE.unlocked.includes(a.unlock)) { SAVE.unlocked.push(a.unlock); note = "New tower: " + TOWERS[a.unlock].name; }
    UI.achToast(a.name, note || a.desc);
    save();
  }
}

/* ================= rendering ================= */
const cv = $("#board"), ctx = cv.getContext("2d");
const LAY = { cell: 40, ox: 0, oy: 0, w: 800, h: 480, dpr: 1, W: 0, H: 0 };
let BOARD = null, BOARD_KEY = "";
function layout(area) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  LAY.dpr = dpr; LAY.W = W; LAY.H = H;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px";
  const a = area || { x: 0, y: 0, w: W, h: H };
  const cell = Math.max(10, Math.floor(Math.min(a.w / COLS, a.h / ROWS)));
  LAY.cell = cell; LAY.w = cell * COLS; LAY.h = cell * ROWS;
  LAY.ox = Math.round(a.x + (a.w - LAY.w) / 2); LAY.oy = Math.round(a.y + (a.h - LAY.h) / 2);
  BOARD_KEY = "";
}
const sx = (x) => LAY.ox + x * LAY.cell, sy = (y) => LAY.oy + y * LAY.cell;
function cellAt(px, py) { const x = Math.floor((px - LAY.ox) / LAY.cell), y = Math.floor((py - LAY.oy) / LAY.cell); return inB(x, y) ? [x, y] : null; }

/* Static board: background, traces, blocks, path channels, pads, spawns and core. */
function buildBoard(map) {
  const key = rleTiles(map.tiles) + "|" + LAY.cell + "|" + LAY.dpr;
  if (key === BOARD_KEY && BOARD) return BOARD;
  BOARD_KEY = key;
  const c = LAY.cell, dpr = LAY.dpr, cnv = document.createElement("canvas");
  cnv.width = Math.round((LAY.w + 2) * dpr); cnv.height = Math.round((LAY.h + 2) * dpr);
  const g = cnv.getContext("2d"); g.scale(dpr, dpr); g.translate(1, 1);
  const T = (x, y) => (inB(x, y) ? map.tiles[idx(x, y)] : -1);
  g.fillStyle = "#070b18"; g.fillRect(0, 0, LAY.w, LAY.h);
  const r = RNG(hashStr(rleTiles(map.tiles)));
  // circuit traces on buildable ground
  g.lineWidth = Math.max(1, c * 0.04); g.strokeStyle = "rgba(60,90,160,0.16)";
  for (let i = 0; i < 26; i++) {
    let x = r.int(COLS), y = r.int(ROWS); g.beginPath(); g.moveTo((x + 0.5) * c, (y + 0.5) * c);
    for (let k = 0; k < 4; k++) { const [dx, dy] = r.pick(DIRS); const n = 1 + r.int(3); x = clamp(x + dx * n, 0, COLS - 1); y = clamp(y + dy * n, 0, ROWS - 1); g.lineTo((x + 0.5) * c, (y + 0.5) * c); }
    g.stroke();
  }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const t = T(x, y), X = x * c, Y = y * c;
    if (buildable(t)) {
      g.fillStyle = "rgba(90,120,200,0.06)"; g.fillRect(X + c * 0.06, Y + c * 0.06, c * 0.88, c * 0.88);
      g.fillStyle = "rgba(120,150,230,0.22)"; const d = Math.max(1, c * 0.05); g.fillRect(X - d / 2, Y - d / 2, d, d);
    }
    if (t === T_BLOCK) {
      g.fillStyle = "#0d1226"; g.fillRect(X + c * 0.08, Y + c * 0.08, c * 0.84, c * 0.84);
      g.strokeStyle = "rgba(90,110,170,0.35)"; g.lineWidth = Math.max(1, c * 0.04); g.strokeRect(X + c * 0.14, Y + c * 0.14, c * 0.72, c * 0.72);
      g.fillStyle = "rgba(90,110,170,0.35)";
      for (let k = 0; k < 3; k++) { g.fillRect(X + c * (0.3 + k * 0.2), Y + c * 0.04, c * 0.06, c * 0.1); g.fillRect(X + c * (0.3 + k * 0.2), Y + c * 0.86, c * 0.06, c * 0.1); }
    }
    if (t === T_PAD) {
      g.fillStyle = "rgba(255,193,77,0.10)"; g.fillRect(X + c * 0.08, Y + c * 0.08, c * 0.84, c * 0.84);
      g.strokeStyle = "rgba(255,193,77,0.75)"; g.lineWidth = Math.max(1, c * 0.05);
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + Math.PI / 6; g.lineTo(X + c / 2 + Math.cos(a) * c * 0.38, Y + c / 2 + Math.sin(a) * c * 0.38); } g.closePath(); g.stroke();
    }
  }
  // path channels with neon edges
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!walkable(T(x, y))) continue;
    const X = x * c, Y = y * c;
    g.fillStyle = "#0b1636"; g.fillRect(X, Y, c, c);
    g.fillStyle = "rgba(62,140,255,0.08)"; g.fillRect(X + c * 0.2, Y + c * 0.2, c * 0.6, c * 0.6);
  }
  g.lineWidth = Math.max(1.5, c * 0.06); g.strokeStyle = "rgba(62,200,255,0.85)"; g.lineCap = "square";
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!walkable(T(x, y))) continue;
    const X = x * c, Y = y * c, inset = c * 0.03;
    g.beginPath();
    if (!walkable(T(x, y - 1)) && T(x, y - 1) !== -1) { g.moveTo(X, Y + inset); g.lineTo(X + c, Y + inset); }
    if (!walkable(T(x, y + 1)) && T(x, y + 1) !== -1) { g.moveTo(X, Y + c - inset); g.lineTo(X + c, Y + c - inset); }
    if (!walkable(T(x - 1, y)) && T(x - 1, y) !== -1) { g.moveTo(X + inset, Y); g.lineTo(X + inset, Y + c); }
    if (!walkable(T(x + 1, y)) && T(x + 1, y) !== -1) { g.moveTo(X + c - inset, Y); g.lineTo(X + c - inset, Y + c); }
    g.stroke();
  }
  g.strokeStyle = "rgba(62,200,255,0.18)"; g.lineWidth = Math.max(4, c * 0.22);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!walkable(T(x, y))) continue;
    const X = x * c, Y = y * c;
    g.beginPath();
    if (!walkable(T(x, y - 1)) && T(x, y - 1) !== -1) { g.moveTo(X, Y); g.lineTo(X + c, Y); }
    if (!walkable(T(x, y + 1)) && T(x, y + 1) !== -1) { g.moveTo(X, Y + c); g.lineTo(X + c, Y + c); }
    if (!walkable(T(x - 1, y)) && T(x - 1, y) !== -1) { g.moveTo(X, Y); g.lineTo(X, Y + c); }
    if (!walkable(T(x + 1, y)) && T(x + 1, y) !== -1) { g.moveTo(X + c, Y); g.lineTo(X + c, Y + c); }
    g.stroke();
  }
  // board frame
  g.strokeStyle = "rgba(100,140,255,0.35)"; g.lineWidth = 1; g.strokeRect(-0.5, -0.5, LAY.w + 1, LAY.h + 1);
  BOARD = cnv;
  return cnv;
}

function poly(g, x, y, r, n, rot) { g.beginPath(); for (let k = 0; k < n; k++) { const a = rot + (k / n) * TAU; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); }
function drawShape(g, shape, x, y, r, rot) {
  switch (shape) {
    case "square": poly(g, x, y, r * 1.15, 4, rot + Math.PI / 4); break;
    case "tri": poly(g, x, y, r * 1.2, 3, rot); break;
    case "hex": poly(g, x, y, r, 6, rot); break;
    case "oct": poly(g, x, y, r, 8, rot); break;
    case "diamond": g.beginPath(); g.moveTo(x, y - r * 1.25); g.lineTo(x + r * 0.85, y); g.lineTo(x, y + r * 1.25); g.lineTo(x - r * 0.85, y); g.closePath(); break;
    case "chevron": { const c = Math.cos(rot), s = Math.sin(rot), P = [[1.2, 0], [-0.8, 0.9], [-0.35, 0], [-0.8, -0.9]]; g.beginPath(); for (const [px, py] of P) g.lineTo(x + (px * c - py * s) * r, y + (px * s + py * c) * r); g.closePath(); break; }
    case "cross": { const w = r * 0.42; g.beginPath(); g.rect(x - w, y - r, w * 2, r * 2); g.rect(x - r, y - w, r * 2, w * 2); break; }
    default: g.beginPath(); g.arc(x, y, r, 0, TAU);
  }
}

/* Draws a tower (also used for menu icons and placement ghosts). */
function drawTower(g, type, X, Y, c, o = {}) {
  const d = TOWERS[type], col = d.color, rgb = d.rgb, ang = o.ang ?? -Math.PI / 2, lv = o.lv || 1, k = o.kick || 0, spin = o.spin || 0;
  const s = c * 0.39;
  g.save(); g.translate(X, Y);
  g.globalAlpha = o.alpha ?? 1;
  g.fillStyle = "#0c1328"; g.strokeStyle = col; g.lineWidth = Math.max(1.2, c * 0.05);
  const rr = s * 0.3;
  g.beginPath(); g.moveTo(-s + rr, -s); g.lineTo(s - rr, -s); g.quadraticCurveTo(s, -s, s, -s + rr); g.lineTo(s, s - rr); g.quadraticCurveTo(s, s, s - rr, s); g.lineTo(-s + rr, s); g.quadraticCurveTo(-s, s, -s, s - rr); g.lineTo(-s, -s + rr); g.quadraticCurveTo(-s, -s, -s + rr, -s); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = col;
  for (let i = 0; i < lv; i++) g.fillRect(-s * 0.7 + i * s * 0.42, s * 0.62, s * 0.26, s * 0.18);
  g.lineCap = "round";
  const recoil = -k * c * 0.8;
  switch (type) {
    case "pulse":
      g.rotate(ang); g.beginPath(); g.arc(0, 0, s * 0.42, 0, TAU); g.fillStyle = `rgba(${rgb},0.25)`; g.fill(); g.stroke();
      g.lineWidth = c * 0.1; g.beginPath(); g.moveTo(s * 0.3 + recoil, 0); g.lineTo(s * 0.95 + recoil, 0); g.stroke(); break;
    case "cannon":
      g.rotate(ang); g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.fillStyle = `rgba(${rgb},0.2)`; g.fill(); g.stroke();
      g.lineWidth = c * 0.18; g.beginPath(); g.moveTo(s * 0.35 + recoil, 0); g.lineTo(s * 0.9 + recoil, 0); g.stroke(); break;
    case "cryo":
      g.rotate(spin); g.lineWidth = c * 0.05;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * s * 0.75, Math.sin(a) * s * 0.75); g.stroke(); g.beginPath(); g.moveTo(Math.cos(a) * s * 0.45 + Math.cos(a + 0.9) * s * 0.18, Math.sin(a) * s * 0.45 + Math.sin(a + 0.9) * s * 0.18); g.lineTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45); g.lineTo(Math.cos(a) * s * 0.45 + Math.cos(a - 0.9) * s * 0.18, Math.sin(a) * s * 0.45 + Math.sin(a - 0.9) * s * 0.18); g.stroke(); }
      break;
    case "arc":
      g.beginPath(); g.arc(0, 0, s * 0.32, 0, TAU); g.fillStyle = `rgba(${rgb},0.45)`; g.fill(); g.stroke();
      g.lineWidth = c * 0.04; g.beginPath(); g.arc(0, 0, s * 0.62, spin, spin + 1.6); g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.62, spin + Math.PI, spin + Math.PI + 1.6); g.stroke(); break;
    case "laser":
      g.rotate(ang); poly(g, 0, 0, s * 0.55, 4, 0); g.fillStyle = `rgba(${rgb},0.25)`; g.fill(); g.stroke();
      g.beginPath(); g.arc(s * 0.55, 0, c * 0.05, 0, TAU); g.fillStyle = col; g.fill(); break;
    case "mortar":
      g.rotate(ang); g.beginPath(); g.arc(0, 0, s * 0.62, 0, TAU); g.fillStyle = `rgba(${rgb},0.18)`; g.fill(); g.stroke();
      g.beginPath(); g.arc(s * 0.12 + recoil * 0.5, 0, s * 0.32, 0, TAU); g.lineWidth = c * 0.07; g.stroke(); break;
    case "rail":
      g.rotate(ang); g.lineWidth = c * 0.05; g.strokeRect(-s * 0.4, -s * 0.3, s * 0.7, s * 0.6);
      g.beginPath(); g.moveTo(-s * 0.1 + recoil, -s * 0.16); g.lineTo(s * 1.05 + recoil, -s * 0.16); g.moveTo(-s * 0.1 + recoil, s * 0.16); g.lineTo(s * 1.05 + recoil, s * 0.16); g.stroke(); break;
    case "amp":
      for (let i = 0; i < 3; i++) { const p = ((spin * 0.8 + i / 3) % 1); g.globalAlpha = (o.alpha ?? 1) * (1 - p); g.beginPath(); g.arc(0, 0, s * (0.2 + p * 0.65), 0, TAU); g.stroke(); }
      g.globalAlpha = o.alpha ?? 1; g.beginPath(); g.arc(0, 0, s * 0.18, 0, TAU); g.fill(); break;
    case "miner":
      g.rotate(spin); g.lineWidth = c * 0.05;
      for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.2); g.lineTo(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7); g.stroke(); }
      g.rotate(-spin * 2); poly(g, 0, 0, s * 0.3, 4, 0); g.fillStyle = `rgba(${rgb},0.6)`; g.fill(); break;
  }
  g.restore();
}

let FLOW = 0;
function render(dt, view) {
  const g = ctx, c = LAY.cell, dpr = LAY.dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#04060e"; g.fillRect(0, 0, LAY.W, LAY.H);
  const map = view.map; if (!map) return;
  let shx = 0, shy = 0;
  if (G && G.shake > 0 && SAVE.settings.shake && view.game) { shx = rnd(-1, 1) * G.shake * c * 0.3; shy = rnd(-1, 1) * G.shake * c * 0.3; }
  g.translate(shx, shy);
  g.drawImage(buildBoard(map), LAY.ox - 1, LAY.oy - 1, LAY.w + 2, LAY.h + 2);
  FLOW += dt;
  const info = view.info;
  // data flowing along the routes
  if (info && info.ok) {
    const routes = view.game ? G.routes : info.routes.map((cl) => makeRoute(cl));
    g.fillStyle = "rgba(120,220,255,0.55)";
    for (const r of routes) for (let d = (FLOW * 1.4) % 1.2; d < r.total; d += 1.2) { const [x, y] = routePos(r, d); g.fillRect(sx(x) - c * 0.04, sy(y) - c * 0.04, c * 0.08, c * 0.08); }
  }
  // spawns and core
  if (info && info.ok) {
    for (const s of info.spawns) {
      const x = sx((s % COLS) + 0.5), y = sy(((s / COLS) | 0) + 0.5);
      g.strokeStyle = "rgba(255,92,240,0.9)"; g.lineWidth = Math.max(1.5, c * 0.06); g.setLineDash([c * 0.12, c * 0.09]); g.lineDashOffset = -FLOW * c * 0.6;
      g.beginPath(); g.arc(x, y, c * 0.36, 0, TAU); g.stroke(); g.setLineDash([]);
      g.drawImage(glow(c * 0.9, "rgba(255,92,240,0.35)"), x - c * 0.9, y - c * 0.9);
    }
    const cx = sx((info.core % COLS) + 0.5), cy = sy(((info.core / COLS) | 0) + 0.5), pul = 1 + Math.sin(FLOW * 3) * 0.06;
    g.globalCompositeOperation = "lighter"; g.drawImage(glow(c * 1.3, "rgba(62,240,255,0.45)"), cx - c * 1.3, cy - c * 1.3); g.globalCompositeOperation = "source-over";
    g.fillStyle = "#0a1a33"; g.strokeStyle = "#3ef0ff"; g.lineWidth = Math.max(1.5, c * 0.07);
    poly(g, cx, cy, c * 0.42 * pul, 6, FLOW * 0.5); g.fill(); g.stroke();
    poly(g, cx, cy, c * 0.2 * pul, 6, -FLOW); g.fillStyle = "rgba(62,240,255,0.8)"; g.fill();
    if (view.game) {
      const frac = G.lives / G.maxLives; g.strokeStyle = frac > 0.5 ? "#3ef0ff" : frac > 0.25 ? "#ffe14d" : "#ff3e5e"; g.lineWidth = Math.max(2, c * 0.08);
      g.beginPath(); g.arc(cx, cy, c * 0.58, -Math.PI / 2, -Math.PI / 2 + TAU * frac); g.stroke();
    }
  }
  if (!view.game) { if (view.overlay) view.overlay(g); g.setTransform(1, 0, 0, 1, 0, 0); return; }
  // drone flight lanes, shown whenever drones are coming or on the grid
  if ((G.preview && G.preview.summary.drone) || G.enemies.some((e) => e.air && !e.dead)) {
    g.strokeStyle = "rgba(255,62,94,0.35)"; g.lineWidth = Math.max(1, c * 0.04); g.setLineDash([c * 0.18, c * 0.14]); g.lineDashOffset = -FLOW * c * 0.8;
    for (const r of G.airRoutes) { g.beginPath(); g.moveTo(sx(r.pts[0][0]), sy(r.pts[0][1])); g.lineTo(sx(r.pts[1][0]), sy(r.pts[1][1])); g.stroke(); }
    g.setLineDash([]);
  }
  // fire on the ground
  for (const f of G.fires) { const a = 1 - f.t / f.max; g.fillStyle = `rgba(255,106,61,${0.18 * a})`; g.beginPath(); g.arc(sx(f.x), sy(f.y), f.r * c, 0, TAU); g.fill(); }
  // amplifier links + range of the selection
  const sel = view.sel;
  for (const t of G.towers) {
    if (t.type !== "amp") continue;
    const R = TOWERS.amp.radius[t.lv - 1];
    for (const o of G.towers) if (o !== t && !TOWERS[o.type].support && Math.hypot(o.x - t.x, o.y - t.y) <= R + 0.01) {
      g.strokeStyle = "rgba(125,255,154,0.22)"; g.lineWidth = Math.max(1, c * 0.03); g.setLineDash([c * 0.08, c * 0.08]); g.lineDashOffset = -FLOW * c;
      g.beginPath(); g.moveTo(sx(t.cx), sy(t.cy)); g.lineTo(sx(o.cx), sy(o.cy)); g.stroke(); g.setLineDash([]);
    }
  }
  // towers
  g.globalCompositeOperation = "lighter";
  for (const t of G.towers) g.drawImage(glow(c * 0.75, `rgba(${TOWERS[t.type].rgb},0.18)`), sx(t.cx) - c * 0.75, sy(t.cy) - c * 0.75);
  g.globalCompositeOperation = "source-over";
  for (const t of G.towers) {
    if (t.type === "cryo" && t.pulse > 0) { const k = 1 - t.pulse / 0.3; g.strokeStyle = `rgba(143,216,255,${0.5 * (1 - k)})`; g.lineWidth = Math.max(1, c * 0.04); g.beginPath(); g.arc(sx(t.cx), sy(t.cy), t.s.range * c * k, 0, TAU); g.stroke(); }
    drawTower(g, t.type, sx(t.cx), sy(t.cy), c, { ang: t.ang, lv: t.lv, kick: t.kick > 0 ? t.kick : 0, spin: t.spin });
    if (t.boosted) { g.fillStyle = "#7dff9a"; g.beginPath(); g.arc(sx(t.cx) + c * 0.32, sy(t.cy) - c * 0.32, c * 0.06, 0, TAU); g.fill(); }
  }
  // laser beams
  for (const t of G.towers) {
    if (t.type !== "laser" || !t.beam || t.beam.dead) continue;
    const wdt = c * (0.05 + 0.07 * (t.ramp / 2.5));
    for (const [tg, mul] of [[t.beam, 1], [t.beam2, 0.6]]) {
      if (!tg || tg.dead) continue;
      const x0 = sx(t.cx + Math.cos(t.ang) * 0.3), y0 = sy(t.cy + Math.sin(t.ang) * 0.3), x1 = sx(tg.x), y1 = sy(tg.y);
      g.strokeStyle = `rgba(255,62,142,${0.35 * mul})`; g.lineWidth = wdt * 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = `rgba(255,220,240,${0.95 * mul})`; g.lineWidth = wdt; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
  }
  // glitches
  for (const e of G.enemies) {
    if (e.dead) continue;
    const x = sx(e.x), y = sy(e.y), r = e.d.size * c * 0.5 * (e.big ? 1.2 : 1), d = e.d;
    g.globalCompositeOperation = "lighter"; g.drawImage(glow(r * 2.6, `rgba(${d.rgb},0.28)`), x - r * 2.6, y - r * 2.6); g.globalCompositeOperation = "source-over";
    if (e.air) { g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(x + c * 0.08, y + c * 0.18, r * 0.8, r * 0.4, 0, 0, TAU); g.fill(); }
    const rot = d.shape === "chevron" ? Math.atan2(e.route.pts[e.route.pts.length - 1][1] - e.y, e.route.pts[e.route.pts.length - 1][0] - e.x) : e.rot;
    drawShape(g, d.shape, x, y, r, rot);
    g.fillStyle = e.flash > 0 ? "rgba(255,255,255,0.9)" : `rgba(${d.rgb},0.28)`; g.fill();
    g.strokeStyle = e.slowAmt > 0 ? "#bfefff" : d.color; g.lineWidth = Math.max(1.2, c * (d.boss ? 0.07 : 0.045)); g.stroke();
    if (d.boss) { poly(g, x, y, r * 0.45, 8, -e.rot * 2); g.fillStyle = `rgba(${d.rgb},0.7)`; g.fill(); }
    if (e.maxShield) { const k = e.shield / e.maxShield; if (k > 0) { g.strokeStyle = `rgba(93,255,138,${0.3 + 0.6 * k})`; g.lineWidth = Math.max(1, c * 0.04); g.beginPath(); g.arc(x, y, r * 1.55, 0, TAU * k); g.stroke(); } }
    if (e.stunT > 0) { g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1; for (let i = 0; i < 3; i++) { const a = FLOW * 8 + (i / 3) * TAU; g.beginPath(); g.arc(x + Math.cos(a) * r * 1.4, y - r * 1.3 + Math.sin(a) * r * 0.4, c * 0.03, 0, TAU); g.stroke(); } }
    if (e.hp < e.maxHp) {
      const w = Math.max(c * 0.6, r * 2), h = Math.max(2, c * 0.06), bx = x - w / 2, by = y - r - c * 0.16 - h;
      g.fillStyle = "rgba(0,0,0,0.7)"; g.fillRect(bx - 1, by - 1, w + 2, h + 2);
      const k = clamp(e.hp / e.maxHp, 0, 1); g.fillStyle = k > 0.5 ? "#5dff8a" : k > 0.25 ? "#ffe14d" : "#ff3e5e"; g.fillRect(bx, by, w * k, h);
    }
  }
  // shots
  for (const s of G.shots) {
    if (s.dead || s.delay > 0) continue;
    if (s.kind === "bullet") { g.fillStyle = "#e8ffff"; g.beginPath(); g.arc(sx(s.x), sy(s.y), c * 0.06, 0, TAU); g.fill(); g.globalCompositeOperation = "lighter"; g.drawImage(glow(c * 0.25, "rgba(62,240,255,0.6)"), sx(s.x) - c * 0.25, sy(s.y) - c * 0.25); g.globalCompositeOperation = "source-over"; }
    else if (s.kind === "shell") { g.fillStyle = "#ffcf7a"; g.beginPath(); g.arc(sx(s.x), sy(s.y), c * 0.09, 0, TAU); g.fill(); }
    else if (s.kind === "lob") {
      const z = (s.z || 0) * c; g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(sx(s.x), sy(s.y), c * 0.1, c * 0.05, 0, 0, TAU); g.fill();
      g.fillStyle = "#ff9a6a"; g.beginPath(); g.arc(sx(s.x), sy(s.y) - z, c * (0.08 + (s.z || 0) * 0.04), 0, TAU); g.fill();
    }
  }
  // effects
  g.globalCompositeOperation = "lighter";
  for (const f of G.fx) {
    const k = f.t / f.max;
    if (f.kind === "ring") { g.strokeStyle = `rgba(${f.rgb},${0.8 * (1 - k)})`; g.lineWidth = Math.max(1, c * 0.05 * (1 - k)); g.beginPath(); g.arc(sx(f.x), sy(f.y), lerp(f.r0, f.r1, k) * c, 0, TAU); g.stroke(); }
    else if (f.kind === "boom") {
      const r = f.r * c * (0.4 + 0.6 * k), G0 = glow(Math.round(f.r * c * 1.4), `rgba(${f.rgb},0.5)`), gs = r * 1.4;
      g.globalAlpha = 1 - k; g.drawImage(G0, sx(f.x) - gs, sy(f.y) - gs, gs * 2, gs * 2); g.globalAlpha = 1;
      g.strokeStyle = `rgba(${f.rgb},${0.9 * (1 - k)})`; g.lineWidth = Math.max(1, c * 0.06); g.beginPath(); g.arc(sx(f.x), sy(f.y), r, 0, TAU); g.stroke();
    }
    else if (f.kind === "spark") { g.globalAlpha = 1 - k; g.drawImage(glow(Math.round(c * 0.25), `rgba(${f.rgb},0.8)`), sx(f.x) - c * 0.25, sy(f.y) - c * 0.25); g.globalAlpha = 1; }
    else if (f.kind === "zap") {
      const r = RNG(f.seed + Math.floor(f.t * 40));
      g.strokeStyle = `rgba(${f.rgb},${1 - k})`; g.lineWidth = Math.max(1.2, c * 0.05);
      g.beginPath();
      for (let i = 0; i < f.pts.length - 1; i++) {
        const [ax, ay] = f.pts[i], [bx, by] = f.pts[i + 1]; if (i === 0) g.moveTo(sx(ax), sy(ay));
        for (let k2 = 1; k2 <= 4; k2++) { const u = k2 / 4; g.lineTo(sx(lerp(ax, bx, u) + (k2 < 4 ? (r() - 0.5) * 0.3 : 0)), sy(lerp(ay, by, u) + (k2 < 4 ? (r() - 0.5) * 0.3 : 0))); }
      }
      g.stroke(); g.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`; g.lineWidth = Math.max(1, c * 0.02); g.stroke();
    } else if (f.kind === "rail") {
      g.strokeStyle = `rgba(160,220,255,${0.5 * (1 - k)})`; g.lineWidth = c * 0.22 * (1 - k); g.beginPath(); g.moveTo(sx(f.x0), sy(f.y0)); g.lineTo(sx(f.x1), sy(f.y1)); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${1 - k})`; g.lineWidth = Math.max(1, c * 0.06 * (1 - k)); g.stroke();
    }
  }
  for (const p of G.parts) { const a = p.life / p.max; g.fillStyle = `rgba(${p.rgb},${a})`; const s = p.s * c; g.fillRect(sx(p.x) - s / 2, sy(p.y) - s / 2, s, s); }
  g.globalCompositeOperation = "source-over";
  // floating credit numbers
  g.font = `600 ${Math.max(10, Math.round(c * 0.3))}px Rajdhani, sans-serif`; g.textAlign = "center";
  for (const x of G.texts) { const k = x.t / 0.9; g.fillStyle = `rgba(${x.rgb},${1 - k * k})`; g.fillText(x.s, sx(x.x), sy(x.y) - k * c * 0.6); }
  if (view.overlay) view.overlay(g);
  if (G.leakFlash > 0 && SAVE.settings.flash) { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = `rgba(255,40,80,${0.18 * G.leakFlash})`; g.fillRect(0, 0, LAY.W, LAY.H); }
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function drawRange(g, x, y, r, rgb, ok = true) {
  const c = LAY.cell;
  g.fillStyle = ok ? `rgba(${rgb},0.08)` : "rgba(255,62,94,0.08)"; g.strokeStyle = ok ? `rgba(${rgb},0.65)` : "rgba(255,62,94,0.7)";
  g.lineWidth = Math.max(1, c * 0.03); g.setLineDash([c * 0.12, c * 0.08]);
  g.beginPath(); g.arc(sx(x), sy(y), r * c, 0, TAU); g.fill(); g.stroke(); g.setLineDash([]);
}
