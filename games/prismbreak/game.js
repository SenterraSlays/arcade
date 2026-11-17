"use strict";
/* PRISMBREAK — neon brick breaker. */
const { $, $$, clamp, lerp } = K;
const FW = 900, FH = 700, COLS = 13, BW = 64, BH = 26, GAP = 2, BX0 = (FW - COLS * (BW + GAP) + GAP) / 2, BY0 = 70, PY = 646;
const COLORS = { r: "#ff4d6d", o: "#ff9f43", y: "#ffd43b", g: "#51e08a", c: "#3ddcff", b: "#4d7dff", p: "#b065ff", w: "#eef0ff", 2: "#c3cbe0", 3: "#ffc23d", "#": "#6f7890", "*": "#ff5a36", "^": "#ffffff" };
const LEVELS = [
  [".............", ".rrrrrrrrrrr.", ".ooooooooooo.", ".yyyyyyyyyyy.", ".ggggggggggg.", ".ccccccccccc."],
  ["......w......", ".....bbb.....", "....ccccc....", "...ggggggg...", "..yyyyyyyyy..", ".ooooooooooo.", "rrrrrrrrrrrrr"],
  ["r.o.y.g.c.b.p", ".2.2.2.2.2.2.", "p.b.c.g.y.o.r", ".2.2.2.2.2.2.", "r.o.y.g.c.b.p"],
  ["......p......", ".....pcp.....", "....pcbcp....", "...pcb^bcp...", "....pcbcp....", ".....pcp.....", "......p......"],
  ["#...........#", "#.rrrrrrrrr.#", "#.ooooooooo.#", "#.yy*yyy*yy.#", "#.ggggggggg.#", "#...........#", "###.......###"],
  ["..g.......g..", "...g.....g...", "..ggggggggg..", ".gg.ggggg.gg.", "ggggggggggggg", "g.ggggggggg.g", "g.g.......g.g", "...gg...gg..."],
  ["ccccccccccccc", "2222222222222", "*...........*", "bbbbbbbbbbbbb", "2222222222222", "*...........*", "ppppppppppppp"],
  [".#.#.#.#.#.#.", ".............", ".33333333333.", ".3rrrrrrrrr3.", ".3r^yyyyy^r3.", ".3rrrrrrrrr3.", ".33333333333.", ".............", "##.........##"],
  ["..rr.....rr..", ".rrrr...rrrr.", "rrrrrr.rrrrrr", "rrrrrrrrrrrrr", "rrrrrr^rrrrrr", ".rrrrrrrrrrr.", "..rrrrrrrrr..", "...rrrrrrr...", "....rrrrr....", ".....rrr.....", "......r......"],
  ["y...........y", "yy.........yy", "2yy.......yy2", "22yy.....yy22", ".22yy...yy22.", "..22yy.yy22..", "...22yyy22...", "....22*22....", ".....222....."],
  ["b.c.g.y.o.r.p", "b.c.g.y.o.r.p", "2.2.2.2.2.2.2", "b.c.g.y.o.r.p", "3.3.3.3.3.3.3", "b.c.g.y.o.r.p", "^.....*.....^"],
  ["...ooooooo...", "..o.......o..", ".o..c...c..o.", ".o..c...c..o.", ".o.........o.", ".o.y.....y.o.", ".o..yyyyy..o.", "..o.......o..", "...ooooooo..."],
  ["2222222222222", "#.#.#.#.#.#.#", ".............", "3333333333333", ".#.#.#.#.#.#.", ".............", "ppppppppppppp", "#...........#"],
  ["r*r*r*r*r*r*r", "o.o.o.o.o.o.o", "y*y*y*y*y*y*y", "g.g.g.g.g.g.g", "c*c*c*c*c*c*c"],
  ["^...........^", ".b.........b.", "..c.......c..", "...g..^..g...", "....y...y....", ".....o.o.....", "......r......", "2222222222222"],
  ["#############", "#33333333333#", "#3rrrrrrrrr3#", "#3r2222222r3#", "#3r2^*^*^2r3#", "#3r2222222r3#", "#3rrrrrrrrr3#", "#33333333333#", "#####...#####"],
  ["ccccccccccccc", "c...........c", "c.ggggggggg.c", "c.g.......g.c", "c.g.yyyyy.g.c", "c.g.y.^.y.g.c", "c.g.y...y.g.c", "c.g.yyy.y.g.c", "c.g.....y.g.c", "c.gggggggg..c", "c...........c", "cccccccccccc."],
  ["r...........b", ".r.........b.", "..r.......b..", "...r.....b...", "....r...b....", ".....r*b.....", "....b...r....", "...b.....r...", "..b.......r..", ".b.........r.", "b...........r"],
  [".............", "...p.........", "..ppp....c...", "..y.....ccc..", ".yyy.gg..o...", "rrr.ggo.ooo3.", "r3r22gg333333"],
  ["3.3.3.3.3.3.3", ".............", "3.3.3.3.3.3.3", ".^.........^.", "3.3.3.3.3.3.3", ".............", "3.3.3.3.3.3.3"],
  ["......w......", ".....www.....", "....wwwww....", "...ww2w2ww...", "..ww22w22ww..", ".....2w2.....", ".....2w2.....", ".....2*2.....", ".....222....."],
  [".............", ".###########.", ".#bbbbbbbbb#.", ".#b*bbbbb*b#.", ".#bbbbbbbbb#.", ".###.....###.", ".............", "2222222222222"],
  ["....rrrrr....", "..rrooooorr..", ".roooyyyooor.", "royyygggyyyor", "roygg...ggyor", "roygc...cgyor", "roygc...cgyor"],
  ["#.#.#.#.#.#.#", "3333333333333", "3^3^3^3^3^3^3", "2222222222222", "*b*c*g*y*o*r*", "2222222222222", "3333333333333", ".............", "#...........#"],
];
const NAMES = ["First Light", "Pyramid", "Checkers", "Crystal", "The Pit", "Visitor", "Fuse Lines", "Keep", "Heartbeat", "Canyon", "Pillars", "Smile", "Grates", "Minefield", "Cascade", "The Gate", "Spiral", "Helix", "Tumble", "Studs", "Arrowhead", "Bunker", "Rainbow", "The Prism"];
const PU = [
  { k: "wide", l: "W", c: "#51e08a", w: 18, t: 15 }, { k: "multi", l: "3", c: "#3ddcff", w: 15 }, { k: "laser", l: "L", c: "#ff4d6d", w: 12, t: 12 }, { k: "slow", l: "S", c: "#ff9f43", w: 13, t: 12 },
  { k: "catch", l: "C", c: "#4d7dff", w: 10, t: 15 }, { k: "fire", l: "F", c: "#ff5a36", w: 8, t: 9 }, { k: "shield", l: "B", c: "#2ee6c8", w: 8, t: 20 }, { k: "life", l: "+", c: "#ff7fd1", w: 3 },
  { k: "narrow", l: "N", c: "#8b8fa8", w: 6, t: 12, bad: true }, { k: "fast", l: "»", c: "#8b8fa8", w: 5, t: 10, bad: true },
];
const SAVE = K.load("prismbreak.v1", { unlocked: 1, lv: [], endless: 0, sens: 1 });
for (let i = 0; i < LEVELS.length; i++) SAVE.lv[i] = K.merge({ score: 0, stars: 0 }, SAVE.lv[i]);
const persist = () => K.save("prismbreak.v1", SAVE);

/* ================= state ================= */
let G = null;
function newRun(mode, level = 0) {
  G = { mode, level, score: 0, lives: 3, balls: [], bricks: [], drops: [], shots: [], fx: { wide: 0, laser: 0, slow: 0, catch: 0, fire: 0, shield: 0, narrow: 0, fast: 0 }, px: FW / 2, pw: 120, tpw: 120, combo: 0, t: 0, lvT: 0, lostLife: false, state: "play", shake: 0, flash: 0, laserCd: 0, pops: [], nextLife: 25000, rng: K.RNG((Math.random() * 1e9) | 0) };
  loadLevel(); K.ui.hide(); $("#pauseBtn").hidden = false; document.body.classList.remove("menu"); layout(); K.playSong(mode === "endless" ? "drive" : ["neon", "drive", "neon"][Math.min(2, (level / 8) | 0)], 3);
}
function levelRows() {
  if (G.mode === "campaign") return LEVELS[G.level];
  // endless: symmetric procedural pattern, harder each level
  const r = G.rng, d = G.level, rows = 5 + Math.min(6, (d / 2) | 0), half = 7, keys = "roygcbpw", out = [];
  const style = (r() * 4) | 0, pal = [keys[(r() * 8) | 0], keys[(r() * 8) | 0], keys[(r() * 8) | 0]];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < half; x++) {
      let ch = ".";
      const on = style === 0 ? true : style === 1 ? (x + y) % 2 === 0 : style === 2 ? Math.abs(x - 6) + Math.abs(y - rows / 2) < rows * 0.8 + 2 : r() < 0.72;
      if (on) { const q = r(); ch = q < 0.04 + d * 0.004 ? "*" : q < 0.07 + d * 0.003 ? "^" : q < 0.12 + d * 0.02 ? "2" : q < 0.14 + d * 0.012 ? "3" : q < 0.16 + d * 0.008 ? "#" : pal[y % 3]; }
      line += ch;
    }
    out.push(line + line.slice(0, 6).split("").reverse().join(""));
  }
  return out;
}
function loadLevel() {
  let rows = levelRows(); for (let k = 0; k < 20 && !rows.join("").replace(/[.#]/g, "").length; k++) rows = levelRows();
  G.bricks = [];
  rows.forEach((row, y) => { for (let x = 0; x < COLS; x++) { const ch = (row[x] || "."); if (ch === ".") continue; const hp = ch === "2" ? 2 : ch === "3" ? 3 : ch === "#" ? 99 : 1; G.bricks.push({ x: BX0 + x * (BW + GAP), y: BY0 + y * (BH + GAP), ch, hp, max: hp, hit: 0, alive: true, gx: x, gy: y }); } });
  G.balls = []; G.drops = []; G.shots = []; for (const k in G.fx) G.fx[k] = 0; G.combo = 0; G.lvT = 0; G.lostLife = false; G.tpw = 120;
  G.base = (G.mode === "campaign" ? 400 + G.level * 9 : 420 + G.level * 12);
  serveBall(); G.state = "play";
  K.banner(G.mode === "campaign" ? `LEVEL ${G.level + 1}` : `STAGE ${G.level + 1}`, G.mode === "campaign" ? NAMES[G.level] : "Endless", 1600);
}
function serveBall() { G.balls.push({ x: G.px, y: PY - 14, vx: 0, vy: 0, r: 8, stuck: true, off: 0, trail: [], spd: G.base, stuckT: 0 }); }
function launch() {
  for (const b of G.balls) if (b.stuck) { const a = -Math.PI / 2 + clamp(b.off / (G.pw / 2), -1, 1) * 0.6 + (b.off === 0 ? (Math.random() - 0.5) * 0.3 : 0); b.vx = Math.cos(a) * b.spd; b.vy = Math.sin(a) * b.spd; b.stuck = false; K.sfx("launch"); }
}
function fire() {
  if (G.fx.laser > 0 && G.laserCd <= 0) { G.laserCd = 0.22; for (const s of [-1, 1]) G.shots.push({ x: G.px + s * (G.pw / 2 - 10), y: PY - 12 }); K.sfx("laser"); }
}
function act() { if (!G || G.state !== "play") return; if (G.balls.some((b) => b.stuck)) launch(); else fire(); }

/* ================= simulation ================= */
function speedOf(b) { let s = b.spd; if (G.fx.slow > 0) s *= 0.68; if (G.fx.fast > 0) s *= 1.3; return s; }
function setSpeed(b) { const v = Math.hypot(b.vx, b.vy) || 1, s = speedOf(b); b.vx = (b.vx / v) * s; b.vy = (b.vy / v) * s; }
function fixAngle(b) { const a = Math.atan2(b.vy, b.vx), mn = 0.32; let ax = Math.abs(Math.sin(a)); if (ax < mn) { const sx = Math.sign(b.vx) || 1, sy = Math.sign(b.vy) || -1, s = Math.hypot(b.vx, b.vy); b.vy = sy * s * mn; b.vx = sx * s * Math.sqrt(1 - mn * mn); } }
function hitBrick(br, b, dmg = 1) {
  if (!br.alive) return;
  br.hit = 0.15;
  if (br.ch === "#") { K.sfx("steel"); return; }
  br.hp -= dmg; if (br.hp > 0) { K.sfx("tough"); spark(br.x + BW / 2, br.y + BH / 2, COLORS[br.ch], 6); return; }
  breakBrick(br, b);
}
function breakBrick(br, b) {
  br.alive = false; G.combo++;
  const base = br.ch === "3" ? 120 : br.ch === "2" ? 80 : br.ch === "*" ? 60 : br.ch === "^" ? 100 : 50, mult = Math.min(3, 1 + G.combo * 0.1), pts = Math.round(base * mult);
  addScore(pts); spark(br.x + BW / 2, br.y + BH / 2, COLORS[br.ch], 16); K.sfx("break" + Math.min(7, (G.combo / 3) | 0));
  if (G.combo >= 5 && G.combo % 5 === 0) pop(br.x + BW / 2, br.y, `COMBO ×${mult.toFixed(1)}`, "#ffd43b");
  if (br.ch === "*") { G.shake = Math.max(G.shake, 0.3); K.sfx("boom"); G.flash = 0.4; spark(br.x + BW / 2, br.y + BH / 2, "#ffb03b", 40, 2);
    for (const o of G.bricks) if (o.alive && o !== br && Math.abs(o.gx - br.gx) <= 1 && Math.abs(o.gy - br.gy) <= 1 && o.ch !== "#") setTimeout(() => { if (G && o.alive) { o.hp = 0; breakBrick(o, null); } }, 90); }
  if (br.ch === "^") { const src = b || G.balls[0]; if (src) for (const da of [-0.42, 0.42]) { const a = Math.atan2(src.vy, src.vx) + da, s = Math.hypot(src.vx, src.vy) || G.base; G.balls.push({ x: src.x, y: src.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 8, stuck: false, off: 0, trail: [], spd: src.spd }); } K.sfx("prism"); pop(br.x + BW / 2, br.y, "PRISM!", "#ffffff"); }
  if (G.rng() < (br.ch === "^" ? 0 : 0.13)) dropPU(br.x + BW / 2, br.y + BH / 2);
  if (!G.bricks.some((o) => o.alive && o.ch !== "#")) setTimeout(() => { if (G && G.state === "play") clearLevel(); }, 350);
}
function dropPU(x, y) { let tot = 0; for (const p of PU) tot += p.w; let r = G.rng() * tot, pick = PU[0]; for (const p of PU) { r -= p.w; if (r <= 0) { pick = p; break; } } if (pick.k === "life" && G.lives >= 5) pick = PU[0]; G.drops.push({ x, y, p: pick, rot: 0 }); }
function addScore(n) { G.score += n; if (G.score >= G.nextLife) { G.nextLife += 25000; G.lives = Math.min(6, G.lives + 1); K.sfx("life"); pop(FW / 2, FH / 2, "EXTRA LIFE", "#ff7fd1"); } }
function collect(p) {
  const f = G.fx; K.sfx(p.bad ? "bad" : "power"); pop(G.px, PY - 30, { wide: "WIDE", multi: "MULTIBALL", laser: "LASER", slow: "SLOW", catch: "CATCH", fire: "FIREBALL", shield: "SHIELD", life: "+1 LIFE", narrow: "NARROW", fast: "FAST" }[p.k], p.c);
  addScore(100);
  if (p.k === "wide") { f.wide = p.t; f.narrow = 0; }
  else if (p.k === "narrow") { f.narrow = p.t; f.wide = 0; }
  else if (p.k === "multi") { const src = G.balls.filter((b) => !b.stuck); for (const s of src.slice(0, 3)) for (const da of [-0.5, 0.5]) { const a = Math.atan2(s.vy, s.vx) + da, sp = Math.hypot(s.vx, s.vy); G.balls.push({ x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 8, stuck: false, off: 0, trail: [], spd: s.spd }); } if (!src.length) launch(); }
  else if (p.k === "life") G.lives = Math.min(6, G.lives + 1);
  else if (p.k === "slow") { f.slow = p.t; f.fast = 0; } else if (p.k === "fast") { f.fast = p.t; f.slow = 0; }
  else f[p.k] = p.t;
  for (const b of G.balls) if (!b.stuck) setSpeed(b);
}
function step(h) {
  const f = G.fx;
  for (const k in f) if (f[k] > 0 && k !== "shield") f[k] = Math.max(0, f[k] - h);
  if (f.shield > 0) f.shield = Math.max(0, f.shield - h);
  G.tpw = f.wide > 0 ? 180 : f.narrow > 0 ? 78 : 120; G.pw += (G.tpw - G.pw) * Math.min(1, h * 10);
  G.laserCd -= h; G.lvT += h;
  // paddle
  let ax = 0; if (K.held("ArrowLeft", "KeyA")) ax -= 1; if (K.held("ArrowRight", "KeyD")) ax += 1; if (K.pad.connected) { ax += K.pad.ax || 0; if (K.pad.held.dl) ax -= 1; if (K.pad.held.dr) ax += 1; }
  if (ax) { G.px += clamp(ax, -1, 1) * 980 * SAVE.sens * h; AIM.mouse = false; } else if (AIM.mouse && AIM.tx !== null) G.px += (AIM.tx - G.px) * Math.min(1, h * 30);
  G.px = clamp(G.px, G.pw / 2 + 4, FW - G.pw / 2 - 4);
  // balls
  for (const b of G.balls) {
    if (b.stuck) { b.x = G.px + b.off; b.y = PY - 9 - b.r; b.stuckT = (b.stuckT || 0) + h; if (b.off !== 0 && b.stuckT > 3) launch(); continue; }
    const s = speedOf(b), steps = Math.ceil((s * h) / 4);
    for (let k = 0; k < steps; k++) { moveBall(b, h / steps); if (b.dead) break; }
    b.trail.push(b.x, b.y); if (b.trail.length > 20) b.trail.splice(0, 2);
    b.spd = Math.min(780, b.spd + h * 3.2);
  }
  const fell = G.balls.filter((b) => b.dead); if (fell.length) { G.balls = G.balls.filter((b) => !b.dead); if (!G.balls.length) loseLife(); }
  // drops
  for (const d of G.drops) { d.y += 170 * h; d.rot += h * 3; if (d.y > PY - 10 && d.y < PY + 14 && Math.abs(d.x - G.px) < G.pw / 2 + 16) { d.got = true; collect(d.p); } }
  G.drops = G.drops.filter((d) => !d.got && d.y < FH + 30);
  // lasers
  for (const s of G.shots) { s.y -= 900 * h; for (const br of G.bricks) if (br.alive && s.x > br.x && s.x < br.x + BW && s.y < br.y + BH && s.y > br.y - 10) { hitBrick(br, null); s.dead = true; break; } if (s.y < 0) s.dead = true; }
  G.shots = G.shots.filter((s) => !s.dead);
  for (const br of G.bricks) if (br.hit > 0) br.hit -= h;
}
function moveBall(b, h) {
  const s = speedOf(b), v = Math.hypot(b.vx, b.vy) || 1; b.vx = (b.vx / v) * s; b.vy = (b.vy / v) * s;
  b.x += b.vx * h; b.y += b.vy * h;
  if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); K.sfx("wall"); } else if (b.x > FW - b.r) { b.x = FW - b.r; b.vx = -Math.abs(b.vx); K.sfx("wall"); }
  if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); K.sfx("wall"); }
  // paddle
  if (b.vy > 0 && b.y + b.r >= PY - 8 && b.y - b.r <= PY + 8 && Math.abs(b.x - G.px) <= G.pw / 2 + b.r) {
    const off = clamp((b.x - G.px) / (G.pw / 2), -1, 1), a = -Math.PI / 2 + off * 1.05;
    b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s; b.y = PY - 8 - b.r; G.combo = 0; K.sfx("paddle"); G.pbounce = 0.12;
    if (G.fx.catch > 0) { b.stuck = true; b.off = b.x - G.px; b.stuckT = 0; }
  }
  if (b.y > FH + 20) {
    if (G.fx.shield > 0) { b.y = FH - b.r - 2; b.vy = -Math.abs(b.vy); G.fx.shield = 0; K.sfx("shield"); spark(b.x, FH - 4, "#2ee6c8", 24); }
    else b.dead = true;
  }
  // bricks
  for (const br of G.bricks) {
    if (!br.alive) continue;
    const cx = clamp(b.x, br.x, br.x + BW), cy = clamp(b.y, br.y, br.y + BH), dx = b.x - cx, dy = b.y - cy;
    if (dx * dx + dy * dy > b.r * b.r) continue;
    const pierce = G.fx.fire > 0 && br.ch !== "#";
    if (!pierce) {
      if (dx === 0 && dy === 0) { b.vy = -b.vy; }
      else if (Math.abs(dx) > Math.abs(dy)) { b.vx = Math.sign(dx) * Math.abs(b.vx); b.x = cx + Math.sign(dx) * b.r; }
      else { b.vy = Math.sign(dy) * Math.abs(b.vy); b.y = cy + Math.sign(dy) * b.r; }
      fixAngle(b);
    }
    hitBrick(br, b, pierce ? 3 : 1);
    if (!pierce) break;
  }
}
function loseLife() {
  G.lives--; G.lostLife = true; G.shake = 0.5; K.sfx("lose"); K.vibrate(120); for (const k in G.fx) G.fx[k] = 0; G.drops = []; G.shots = [];
  if (G.lives <= 0) { G.state = "over"; const g = G; setTimeout(() => { if (G === g) gameOver(); }, 1100); return; }
  setTimeout(() => { if (G && G.state === "play") serveBall(); }, 700);
}
function clearLevel() {
  G.state = "clear"; const bonus = 1000 + G.lives * 400 + Math.max(0, Math.round((120 - G.lvT) * 10)); addScore(bonus);
  K.sfx("clear"); K.banner("LEVEL CLEAR", `+${K.fmt(bonus)} bonus`, 1800);
  if (G.mode === "campaign") { const L = SAVE.lv[G.level], stars = 1 + (G.lostLife ? 0 : 1) + (G.lvT < 90 ? 1 : 0); L.stars = Math.max(L.stars, stars); L.score = Math.max(L.score, G.score); SAVE.unlocked = Math.max(SAVE.unlocked, Math.min(LEVELS.length, G.level + 2)); persist(); }
  const g = G; setTimeout(() => {
    if (G !== g) return;
    if (G.mode === "campaign" && G.level === LEVELS.length - 1) { G.state = "won"; gameOver(true); return; }
    G.level++; loadLevel(); if (G.mode === "campaign") K.playSong(["neon", "drive", "neon"][Math.min(2, (G.level / 8) | 0)], 3);
  }, 2100);
}
function gameOver(won) {
  if (G.mode === "endless") { G.pb = G.score > SAVE.endless; SAVE.endless = Math.max(SAVE.endless, G.score); } persist();
  K.ui.show(`<div class="logo" style="font-size:2.6em">${won ? "ALL CLEAR" : "GAME OVER"}</div><p class="k-sub">${won ? "You broke every prism. Well played." : G.mode === "campaign" ? `Reached level ${G.level + 1} · ${NAMES[G.level]}` : `Reached stage ${G.level + 1}`}</p>
    <div class="k-stats"><div class="k-stat"><small>Score</small><b>${K.fmt(G.score)}</b></div>${G.mode === "endless" ? `<div class="k-stat"><small>Best</small><b>${K.fmt(SAVE.endless)}</b></div>` : ""}</div>${G.pb ? `<b style="color:var(--gold)">New best!</b>` : ""}
    <div class="k-row"><button class="k-btn primary" data-a="${G.mode === "endless" ? "endless" : "retry"}" autofocus>${G.mode === "endless" ? "Play again" : "Retry level"}</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "title" });
  document.body.classList.add("menu"); $("#pauseBtn").hidden = true; K.sfx(won ? "win" : "over");
}
function spark(x, y, col, n, big = 1) { const rgb = hexRgb(col); PARTS.burst(sx(x), sy(y), n, { speed: 260 * big * L.s, life: 0.6, size: 5 * L.s * big, color: [rgb, "255,255,255"], g: 500 * L.s, drag: 1.4 }); }
function pop(x, y, text, col) { G.pops.push({ x, y, text, col, t: 0 }); }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; }

/* ================= render ================= */
const cv = $("#cv"), ctx = cv.getContext("2d"), PARTS = new K.Particles(900);
const L = { W: 0, H: 0, dpr: 1, s: 1, ox: 0, oy: 0 };
let BG = null; const SPR = new Map();
function layout() { L.W = innerWidth; L.H = innerHeight; L.dpr = K.fit(cv, L.W, L.H).dpr; L.s = Math.min(L.W / (FW + 20), (L.H - 8) / (FH + 74)); L.ox = (L.W - FW * L.s) / 2; L.oy = (L.H - (FH + 74) * L.s) / 2 + 42 * L.s; BG = null; SPR.clear(); }
addEventListener("resize", layout);
const sx = (x) => L.ox + x * L.s, sy = (y) => L.oy + y * L.s;
function bg() {
  if (BG) return BG; const c = document.createElement("canvas"), w = Math.round(L.W * L.dpr), h = Math.round(L.H * L.dpr); c.width = w; c.height = h; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#120c38"); gr.addColorStop(1, "#05040f"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(120,110,255,0.06)"; g.lineWidth = L.dpr; const st = 34 * L.s * L.dpr;
  for (let x = 0; x < w + h; x += st) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x - h * 0.58, h); g.stroke(); g.beginPath(); g.moveTo(x - h * 0.58, 0); g.lineTo(x, h); g.stroke(); }
  // field frame
  g.fillStyle = "rgba(8,6,24,0.75)"; g.fillRect(L.ox * L.dpr, (L.oy - 4 * L.s) * L.dpr, FW * L.s * L.dpr, (FH + 4) * L.s * L.dpr);
  g.strokeStyle = "rgba(160,150,255,0.35)"; g.lineWidth = 2 * L.dpr; g.strokeRect(L.ox * L.dpr, (L.oy - 4 * L.s) * L.dpr, FW * L.s * L.dpr, (FH + 30) * L.s * L.dpr);
  return (BG = c);
}
function brickSpr(ch, crack) {
  const key = ch + crack; if (SPR.has(key)) return SPR.get(key);
  const w = Math.ceil(BW * L.s * L.dpr), h = Math.ceil(BH * L.s * L.dpr), c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"), r = h * 0.22;
  const col = COLORS[ch], rgb = hexRgb(col).split(",").map(Number);
  if (ch === "^") { const gr = g.createLinearGradient(0, 0, w, h); ["#ff4d6d", "#ffd43b", "#51e08a", "#3ddcff", "#b065ff"].forEach((cc, i) => gr.addColorStop(i / 4, cc)); g.fillStyle = gr; }
  else { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, `rgb(${rgb.map((v) => Math.min(255, v + 60))})`); gr.addColorStop(0.5, col); gr.addColorStop(1, `rgb(${rgb.map((v) => v * 0.6 | 0)})`); g.fillStyle = gr; }
  K.roundRect(g, 1, 1, w - 2, h - 2, r); g.fill();
  g.fillStyle = "rgba(255,255,255,0.35)"; K.roundRect(g, w * 0.06, h * 0.14, w * 0.88, h * 0.22, r * 0.5); g.fill();
  if (ch === "#") { g.fillStyle = "rgba(0,0,0,0.3)"; for (const x of [0.12, 0.88]) { g.beginPath(); g.arc(w * x, h / 2, h * 0.12, 0, Math.PI * 2); g.fill(); } g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 1; for (let x = w * 0.25; x < w * 0.8; x += w * 0.12) { g.beginPath(); g.moveTo(x, h * 0.25); g.lineTo(x + w * 0.06, h * 0.75); g.stroke(); } }
  if (ch === "*") { g.fillStyle = "#2a0a05"; g.beginPath(); g.arc(w / 2, h * 0.55, h * 0.26, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#ffd43b"; g.lineWidth = Math.max(1, h * 0.07); g.beginPath(); g.moveTo(w / 2 + h * 0.15, h * 0.35); g.quadraticCurveTo(w / 2 + h * 0.35, h * 0.1, w / 2 + h * 0.5, h * 0.2); g.stroke(); }
  if (ch === "^") { g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = Math.max(1, h * 0.06); g.beginPath(); g.moveTo(w / 2, h * 0.15); g.lineTo(w / 2 + h * 0.4, h * 0.82); g.lineTo(w / 2 - h * 0.4, h * 0.82); g.closePath(); g.stroke(); }
  if (ch === "2" || ch === "3") { g.fillStyle = "rgba(0,0,0,0.35)"; g.font = `800 ${h * 0.55}px Orbitron`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch === "3" ? "◆◆◆".slice(0, 3) : "◆◆", w / 2, h * 0.58); }
  if (crack) { g.strokeStyle = "rgba(20,10,30,0.7)"; g.lineWidth = Math.max(1, h * 0.06); g.beginPath(); g.moveTo(w * 0.3, 0); g.lineTo(w * 0.38, h * 0.45); g.lineTo(w * 0.3, h * 0.6); g.lineTo(w * 0.42, h); g.moveTo(w * 0.38, h * 0.45); g.lineTo(w * 0.55, h * 0.4); if (crack > 1) { g.moveTo(w * 0.72, 0); g.lineTo(w * 0.66, h * 0.5); g.lineTo(w * 0.78, h); } g.stroke(); }
  g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 1; K.roundRect(g, 1, 1, w - 2, h - 2, r); g.stroke();
  SPR.set(key, c); return c;
}
function render(dt) {
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0); ctx.drawImage(bg(), 0, 0, L.W, L.H);
  if (!G) { PARTS.update(dt); PARTS.draw(ctx); return; }
  let shx = 0, shy = 0; if (G.shake > 0) { G.shake -= dt; shx = (Math.random() - 0.5) * 14 * G.shake * L.s; shy = (Math.random() - 0.5) * 14 * G.shake * L.s; }
  ctx.save(); ctx.translate(shx, shy);
  // bricks
  for (const br of G.bricks) { if (!br.alive) continue; const crack = br.max > 1 && br.max < 99 ? br.max - br.hp : 0; const x = sx(br.x), y = sy(br.y), k = br.hit > 0 ? 1 + br.hit : 1; ctx.drawImage(brickSpr(br.ch, crack), x - (k - 1) * BW * L.s / 2, y - (k - 1) * BH * L.s / 2, BW * L.s * k, BH * L.s * k); if (br.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${br.hit * 3})`; ctx.fillRect(x, y, BW * L.s, BH * L.s); } }
  // shield
  if (G.fx.shield > 0) { const a = 0.45 + Math.sin(G.t * 8) * 0.2; ctx.fillStyle = `rgba(46,230,200,${a})`; ctx.fillRect(sx(0), sy(FH) - 4 * L.s, FW * L.s, 5 * L.s); ctx.shadowColor = "#2ee6c8"; ctx.shadowBlur = 16; ctx.fillRect(sx(0), sy(FH) - 4 * L.s, FW * L.s, 2 * L.s); ctx.shadowBlur = 0; }
  // drops
  for (const d of G.drops) { const x = sx(d.x), y = sy(d.y), w = 40 * L.s, h = 18 * L.s; ctx.save(); ctx.translate(x, y); ctx.scale(Math.cos(d.rot) * 0.25 + 0.75, 1); ctx.fillStyle = d.p.c; ctx.shadowColor = d.p.c; ctx.shadowBlur = 14; K.roundRect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,0.35)"; K.roundRect(ctx, -w / 2 + 3, -h / 2 + 2, w - 6, h * 0.3, h * 0.2); ctx.fill(); ctx.fillStyle = "#0b0820"; ctx.font = `900 ${h * 0.75}px Orbitron`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(d.p.l, 0, 1); ctx.restore(); }
  // lasers
  ctx.fillStyle = "#ff4d6d"; ctx.shadowColor = "#ff4d6d"; ctx.shadowBlur = 10; for (const s of G.shots) ctx.fillRect(sx(s.x) - 2 * L.s, sy(s.y), 4 * L.s, 18 * L.s); ctx.shadowBlur = 0;
  // paddle
  const pw = G.pw * L.s, ph = 16 * L.s, px = sx(G.px) - pw / 2, py = sy(PY) - ph / 2 + (G.pbounce > 0 ? G.pbounce * 20 * L.s : 0); G.pbounce = Math.max(0, (G.pbounce || 0) - dt);
  const pc = G.fx.fire > 0 ? "#ff5a36" : G.fx.catch > 0 ? "#4d7dff" : G.fx.laser > 0 ? "#ff4d6d" : "#3ddcff";
  ctx.shadowColor = pc; ctx.shadowBlur = 18; const pg = ctx.createLinearGradient(0, py, 0, py + ph); pg.addColorStop(0, "#ffffff"); pg.addColorStop(0.4, pc); pg.addColorStop(1, "#14104a"); ctx.fillStyle = pg; K.roundRect(ctx, px, py, pw, ph, ph / 2); ctx.fill(); ctx.shadowBlur = 0;
  if (G.fx.laser > 0) { ctx.fillStyle = "#ff4d6d"; for (const s of [-1, 1]) ctx.fillRect(sx(G.px + s * (G.pw / 2 - 10)) - 3 * L.s, py - 8 * L.s, 6 * L.s, 9 * L.s); }
  // balls
  for (const b of G.balls) {
    const fire = G.fx.fire > 0, col = fire ? "255,120,60" : "120,230,255";
    for (let i = 0; i < b.trail.length; i += 2) { const k = i / b.trail.length; ctx.fillStyle = `rgba(${col},${k * 0.35})`; ctx.beginPath(); ctx.arc(sx(b.trail[i]), sy(b.trail[i + 1]), b.r * L.s * (0.4 + k * 0.6), 0, Math.PI * 2); ctx.fill(); }
    K.drawGlow(ctx, sx(b.x), sy(b.y), b.r * L.s * 4, col, 0.7);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y), b.r * L.s, 0, Math.PI * 2); ctx.fill();
  }
  if (G.balls.some((b) => b.stuck) && G.state === "play") { const b = G.balls.find((q) => q.stuck); ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(b.x), sy(b.y)); const a = -Math.PI / 2 + clamp(b.off / (G.pw / 2), -1, 1) * 0.6; ctx.lineTo(sx(b.x + Math.cos(a) * 90), sy(b.y + Math.sin(a) * 90)); ctx.stroke(); ctx.setLineDash([]); }
  PARTS.update(dt); PARTS.draw(ctx);
  for (const p of G.pops) { p.t += dt; const k = p.t / 1.1; ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.font = `800 ${18 * L.s}px Orbitron`; ctx.textAlign = "center"; ctx.fillStyle = p.col; ctx.fillText(p.text, sx(p.x), sy(p.y) - k * 40 * L.s); ctx.globalAlpha = 1; }
  G.pops = G.pops.filter((p) => p.t < 1.1);
  ctx.restore();
  if (G.flash > 0) { G.flash -= dt; ctx.fillStyle = `rgba(255,200,120,${G.flash * 0.4})`; ctx.fillRect(0, 0, L.W, L.H); }
  // HUD
  const hy = sy(-30), fs = Math.max(12, 20 * L.s); ctx.font = `800 ${fs}px Orbitron`; ctx.textBaseline = "middle";
  ctx.textAlign = "left"; ctx.fillStyle = "#f2f0ff"; ctx.fillText(K.fmt(G.score), sx(4), hy);
  ctx.textAlign = "center"; ctx.fillStyle = "#aaa4dd"; ctx.fillText(G.mode === "campaign" ? `LEVEL ${G.level + 1}` : `STAGE ${G.level + 1}`, sx(FW / 2), hy);
  ctx.textAlign = "right"; for (let i = 0; i < G.lives; i++) { ctx.fillStyle = "#3ddcff"; K.roundRect(ctx, sx(FW - 60) - i * 30 * L.s - 40 * L.s, hy - 4 * L.s, 26 * L.s, 8 * L.s, 4 * L.s); ctx.fill(); }
  // active power-up timers
  let ix = sx(6); const iy = sy(FH) + 14 * L.s;
  for (const p of PU) { const t = G.fx[p.k]; if (!(t > 0) || !p.t) continue; ctx.fillStyle = p.c; K.roundRect(ctx, ix, iy, 30 * L.s, 14 * L.s, 7 * L.s); ctx.fill(); ctx.fillStyle = "#0b0820"; ctx.font = `900 ${10 * L.s}px Orbitron`; ctx.textAlign = "center"; ctx.fillText(p.l, ix + 15 * L.s, iy + 7.5 * L.s); ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(ix, iy + 16 * L.s, 30 * L.s * Math.min(1, t / p.t), 2 * L.s); ix += 36 * L.s; }
}

/* ================= input ================= */
const AIM = { mouse: true, tx: null };
cv.addEventListener("pointerdown", (e) => { if (!G || K.ui.active()) return; K.audio(); AIM.mouse = true; AIM.tx = (e.clientX - L.ox) / L.s; if (e.pointerType === "touch") { AIM.touch = { id: e.pointerId, x0: e.clientX, t: performance.now(), p0: G.px }; } else act(); });
cv.addEventListener("pointermove", (e) => { if (!G) return; if (e.pointerType === "touch") { if (AIM.touch && e.pointerId === AIM.touch.id) { AIM.tx = AIM.touch.p0 + (e.clientX - AIM.touch.x0) / L.s * 1.4; AIM.mouse = true; } return; } AIM.mouse = true; AIM.tx = (e.clientX - L.ox) / L.s; });
cv.addEventListener("pointerup", (e) => { if (AIM.touch && e.pointerId === AIM.touch.id) { const quick = performance.now() - AIM.touch.t < 260 && Math.abs(e.clientX - AIM.touch.x0) < 12; AIM.touch = null; if (quick) act(); } });
addEventListener("keydown", (e) => { if (!G || K.ui.active()) return; if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); act(); } else if (e.code === "Escape" || e.code === "KeyP") pause(); });
function pollPad() { const P = K.pad; if (!P.connected || !G || K.ui.active()) return; if (P.pressed.a || P.pressed.rt || P.pressed.rb) act(); if (P.pressed.start) pause(); }
$("#pauseBtn").onclick = () => pause();

/* ================= audio ================= */
const SC = [0, 3, 5, 7, 10, 12, 15, 17];
const sfx = {
  launch: (t) => K.voice(440, t, 0.12, { duty: 0.25, vol: 0.05, slide: 2 }), paddle: (t) => K.voice(330, t, 0.06, { duty: 0.5, vol: 0.06 }), wall: (t) => K.voice(220, t, 0.03, { type: "triangle", vol: 0.04 }),
  steel: (t) => { K.voice(1200, t, 0.05, { type: "square", vol: 0.03 }); K.voice(1800, t, 0.08, { type: "triangle", vol: 0.03 }); }, tough: (t) => K.voice(600, t, 0.05, { type: "square", vol: 0.04, lp: 2000 }),
  boom: (t) => { K.noise(t, 0.4, { filter: "lowpass", freq: 800, slide: 0.3, vol: 0.2 }); K.voice(90, t, 0.3, { type: "sine", vol: 0.15, slide: 0.4 }); },
  prism: (t) => K.notes(t, [988, 1318, 1760, 2349], 0.04, { type: "triangle", vol: 0.045, len: 0.18 }),
  power: (t) => K.notes(t, [659, 880, 1175], 0.05, { duty: 0.25, vol: 0.05, len: 0.12 }), bad: (t) => K.notes(t, [400, 300], 0.08, { type: "square", vol: 0.04, len: 0.12 }),
  laser: (t) => K.voice(1400, t, 0.08, { type: "sawtooth", vol: 0.025, slide: 0.4, lp: 3000 }), shield: (t) => K.voice(500, t, 0.25, { type: "sine", vol: 0.06, slide: 2.2 }),
  lose: (t) => K.voice(400, t, 0.5, { type: "triangle", vol: 0.08, slide: 0.25 }), life: (t) => K.notes(t, [523, 659, 784, 1046], 0.06, { duty: 0.25, vol: 0.05, len: 0.2 }),
  clear: (t) => K.notes(t, [523, 659, 784, 1046, 1318], 0.07, { duty: 0.25, vol: 0.05, len: 0.3 }), over: (t) => K.notes(t, [392, 330, 262, 196], 0.18, { type: "triangle", vol: 0.07, len: 0.5 }),
};
for (let i = 0; i < 8; i++) sfx["break" + i] = (t) => { K.voice(K.hz(72 + SC[i]), t, 0.08, { duty: 0.25, vol: 0.05 }); K.noise(t, 0.04, { filter: "highpass", freq: 3000, vol: 0.03 }); };
K.defineSfx(sfx, { wall: 0.03, tough: 0.03, steel: 0.04, laser: 0.05 });
K.songs({
  neon: { bpm: 124, chords: ["Am", "F", "C", "G"], bass: "R . R O . R O . R . R O . R O .", bassWave: 0.25, bassVol: 0.11, drums: "k . h . s . h . k k h . s . h h", arp: true, arpVol: 0.02, arpPat: [0, 1, 2, 3, 2, 1],
    lead: ["a4 . c5 . e5 - d5 .", "c5 - a4 . f4 - - .", "g4 . c5 . e5 - g5 .", "f5 - e5 . d5 - - ."], leadVol: 0.04 },
  drive: { bpm: 140, chords: ["Em", "C", "D", "Bm", "Em", "C", "D", "D"], bass: "R R O R R O R O R R O R R O R O", bassWave: 0.5, bassVol: 0.1, drums: "k . h k s . h . k . h k s . h s", arp: true, arpVol: 0.018, arpPat: [0, 2, 1, 2],
    lead: ["e5 - g5 . b5 - a5 .", "g5 - e5 . c5 - - .", "d5 . f#5 . a5 - f#5 .", "b4 - - . d5 - - .", "e5 . e5 . g5 . b5 .", "c6 - b5 . g5 - e5 .", "f#5 - a5 . d6 - c6 .", "b5 - - - a5 - - ."], leadVol: 0.04 },
});

/* ================= screens ================= */
function title() {
  G = null; $("#pauseBtn").hidden = true; document.body.classList.add("menu"); K.playSong("neon", 1);
  K.ui.show(`<div class="logo">PRISMBREAK</div><p class="k-sub">Break every brick. Split your ball on prisms, set off bombs, and grab power-ups.</p>
    <div class="k-menu"><button class="k-btn primary" data-a="campaign" autofocus>Campaign · ${Math.min(SAVE.unlocked, LEVELS.length)}/${LEVELS.length}</button><button class="k-btn" data-a="endless">Endless${SAVE.endless ? " · best " + K.fmt(SAVE.endless) : ""}</button><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>`, { cls: "soft" });
}
function levelSelect() {
  const worlds = ["WORLD 1 · NEON", "WORLD 2 · FACETS", "WORLD 3 · THE PRISM"];
  let html = "";
  for (let w = 0; w < 3; w++) { html += `<div class="world">${worlds[w]}</div><div class="levels">`; for (let i = w * 8; i < w * 8 + 8; i++) { const lv = SAVE.lv[i], lock = i >= SAVE.unlocked; html += `<button class="k-btn lv" data-a="lv" data-i="${i}" ${lock ? "disabled" : ""} title="${NAMES[i]}"><b>${i + 1}</b><small>${lock ? "🔒" : "★".repeat(lv.stars) + "☆".repeat(3 - lv.stars)}</small></button>`; } html += `</div>`; }
  K.ui.show(`<div class="k-bar"><h2>Campaign</h2><button class="k-btn" data-a="title">Back</button></div><p class="k-sub">★ clear · ★★ without losing a life · ★★★ also under 90 seconds</p>${html}`, { back: "title", cls: "top", focusSel: `[data-i="${Math.min(SAVE.unlocked, LEVELS.length) - 1}"]` });
}
function pause() {
  if (!G || G.state === "over" || K.ui.active()) return;
  document.body.classList.add("menu");
  K.ui.show(`<div class="logo" style="font-size:2.4em">PAUSED</div><p class="k-sub">${K.fmt(G.score)} points · ${G.lives} ${G.lives === 1 ? "life" : "lives"}</p><div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="retry">Restart level</button><button class="k-btn" data-a="settings" data-from="menu">Settings</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "resume" });
}
function settings(from) {
  const back = from === "menu" ? "pauseback" : "title";
  const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center"><label class="k-opt"><span>Paddle speed (keys and stick)</span><input type="range" min="0.5" max="1.6" step="0.05" value="${SAVE.sens}" id="sens"></label>${K.ui.settingsRows()}</div>`, { back, cls: "top" });
  K.ui.bindSettings(s); $("#sens").oninput = (e) => { SAVE.sens = +e.target.value; persist(); };
}
function help() {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="k-help"><div><b>Paddle</b>Move with the mouse, a finger, ← → or the stick. Where the ball hits the paddle sets its angle.</div><div><b>Bricks</b>Silver takes 2 hits and gold takes 3. Steel never breaks. Bombs blow up their neighbors. Prisms split your ball in three.</div>
    <div><b>Power-ups</b>W wide · 3 multiball · L laser · S slow · C catch · F fireball · B shield · + life. Grey ones (N narrow, » fast) are bad.</div><div><b>Combos</b>Break bricks without touching the paddle to raise your multiplier. Extra life every 25,000 points.</div>
    <div class="k-kbonly"><b>Keys</b>← → move · Space launches and fires lasers · Esc pauses</div><div><b>Controller</b>Stick moves · A launches and fires · Start pauses</div></div>`, { back: "title", cls: "top" });
}
K.ui.on((a, d) => {
  switch (a) {
    case "title": K.sfx("ok"); return title();
    case "campaign": K.sfx("ok"); return levelSelect();
    case "lv": K.sfx("ok"); return newRun("campaign", +d.i);
    case "endless": K.sfx("ok"); return newRun("endless", 0);
    case "retry": K.sfx("ok"); return G && G.mode === "campaign" ? newRun("campaign", G.level) : newRun("endless", 0);
    case "resume": K.ui.hide(); document.body.classList.remove("menu"); return;
    case "pauseback": return pause_reopen();
    case "settings": K.sfx("ok"); return settings(d.from);
    case "help": K.sfx("ok"); return help();
  }
});
function pause_reopen() { K.ui.hide(); pause(); }
K.onPause(() => { if (G && G.state === "play" && !K.ui.active()) pause(); });

/* ================= boot ================= */
layout(); title();
const fixed = K.fixed(120);
K.loop((dt) => {
  pollPad();
  if (G && !K.ui.active() && (G.state === "play" || G.state === "clear")) { G.t += dt; if (G.state === "play") fixed(dt, step); else { for (const b of G.balls) { b.trail.splice(0, 2); } } }
  render(dt);
});
