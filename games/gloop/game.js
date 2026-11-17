"use strict";
/* GLOOP — merge-drop slimes. Two of a kind merge into the next size. */
const { $, $$, clamp, lerp } = K;
const TIERS = [
  { name: "Drip", r: 17, c: "#6fe3ff" }, { name: "Dot", r: 23, c: "#7ef0b2" }, { name: "Bean", r: 31, c: "#c6f26b" }, { name: "Puff", r: 39, c: "#ffd75e" },
  { name: "Plop", r: 48, c: "#ffaa5e" }, { name: "Mochi", r: 59, c: "#ff7b8c" }, { name: "Jelly", r: 72, c: "#ff7fd1" }, { name: "Blub", r: 87, c: "#b98aff" },
  { name: "Gumdrop", r: 103, c: "#7d8cff" }, { name: "Glooper", r: 121, c: "#3fd0c4" }, { name: "King Gloop", r: 142, c: "#ffcf3f" },
];
const PTS = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];
const W = 560, H = 720, DANGER = 132, DROP_Y = 62, GRAV = 1500;
const SAVE = K.load("gloop.v1", { best: 0, daily: { date: "", best: 0 }, top: -1, games: 0, merges: 0, kings: 0, cur: null });
const persist = () => K.save("gloop.v1", SAVE);

/* ================= state ================= */
let G = null, ID = 0;
function newGame(daily) {
  const rng = daily ? K.RNG(K.dailySeed("gloop")) : K.RNG((Math.random() * 1e9) | 0);
  G = { daily, rng, blobs: [], score: 0, x: W / 2, cur: null, next: 0, cool: 0, over: false, overT: 0, danger: 0, combo: 0, comboT: 0, best: 0, shakes: 3, merges: 0, top: 0, pops: [], time: 0, shakeT: 0, flash: 0 };
  G.next = spawnTier(); G.cur = spawnTier(); G.cool = 0.3;
  SAVE.games++; persist();
  K.ui.hide(); $("#hud").hidden = false; layout(); hudBtns(); K.playSong("bounce", 3); K.sfx("start");
}
function spawnTier() { const r = G.rng(); return r < 0.32 ? 0 : r < 0.6 ? 1 : r < 0.8 ? 2 : r < 0.94 ? 3 : 4; }
function addBlob(t, x, y, vx = 0, vy = 0, grow = false) { const T = TIERS[t], b = { id: ++ID, t, x, y, vx, vy, r: grow ? TIERS[Math.max(0, t - 1)].r : T.r, R: T.r, m: T.r * T.r, a: 0, w: 0, sq: 0, sqv: 0, sqa: 0, pop: grow ? 0 : 1, age: 0, blink: Math.random() * 4, dead: false }; G.blobs.push(b); return b; }
function drop() {
  if (!G || G.over || G.cool > 0 || G.cur === null) return;
  const t = G.cur, r = TIERS[t].r, x = clamp(G.x, r + 2, W - r - 2);
  addBlob(t, x, DROP_Y, 0, 60); G.cur = null; G.cool = 0.55; K.sfx("drop");
}

/* ================= physics ================= */
const fixed = K.fixed(120);
function step(h) {
  const bs = G.blobs;
  for (const b of bs) {
    b.vy += GRAV * h; b.vx *= 1 - 0.25 * h; b.vy *= 1 - 0.05 * h;
    b.x += b.vx * h; b.y += b.vy * h; b.a += b.w * h; b.w *= 1 - 1.5 * h; b.age += h;
    if (b.r < b.R) b.r = Math.min(b.R, b.r + (b.R - TIERS[Math.max(0, b.t - 1)].r) * h / 0.14);
    // squash spring
    b.sqv += (-b.sq * 340 - b.sqv * 16) * h; b.sq += b.sqv * h;
  }
  const merges = [];
  for (let it = 0; it < 7; it++) {
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]; if (a.dead) continue;
      // walls + floor
      if (a.x - a.r < 0) { a.x = a.r; if (a.vx < 0) { if (it === 0) bump(a, -a.vx, 0); a.vx *= -0.2; } }
      if (a.x + a.r > W) { a.x = W - a.r; if (a.vx > 0) { if (it === 0) bump(a, a.vx, 0); a.vx *= -0.2; } }
      if (a.y + a.r > H) { a.y = H - a.r; if (a.vy > 0) { if (it === 0) bump(a, a.vy, Math.PI / 2); a.vy *= -0.12; a.vx *= 0.96; a.w = a.vx / a.r; } }
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j]; if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        if (a.t === b.t && a.t < TIERS.length && !a.merging && !b.merging && a.age > 0.03 && b.age > 0.03) { a.merging = b.merging = true; merges.push([a, b]); continue; }
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = rr - d, ia = 1 / a.m, ib = 1 / b.m, is = ia + ib;
        const corr = (ov / is) * 0.55; a.x -= nx * corr * ia; a.y -= ny * corr * ia; b.x += nx * corr * ib; b.y += ny * corr * ib;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          const j1 = (-(1 + 0.12) * rv) / is; a.vx -= j1 * nx * ia; a.vy -= j1 * ny * ia; b.vx += j1 * nx * ib; b.vy += j1 * ny * ib;
          const tx = -ny, ty = nx, vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty; let jt = -vt / is * 0.5; const mx = j1 * 0.35; jt = clamp(jt, -mx, mx);
          a.vx -= jt * tx * ia; a.vy -= jt * ty * ia; b.vx += jt * tx * ib; b.vy += jt * ty * ib;
          a.w -= (vt / a.r) * 0.05; b.w += (vt / b.r) * 0.05;
          if (it === 0 && -rv > 140) { bump(a, -rv * (ib / is), Math.atan2(ny, nx)); bump(b, -rv * (ia / is), Math.atan2(ny, nx)); }
        }
      }
    }
  }
  for (const [a, b] of merges) merge(a, b);
  if (merges.length) G.blobs = G.blobs.filter((q) => !q.dead);
}
function bump(b, speed, ang) { if (speed < 90) return; const k = Math.min(0.22, speed / 2600); b.sqv -= k * 9; b.sqa = ang; if (speed > 260 && b.age > 0.1) K.sfx(b.t > 6 ? "thudBig" : "thud"); }
function merge(a, b) {
  a.dead = b.dead = true;
  const m = a.m + b.m, x = (a.x * a.m + b.x * b.m) / m, y = (a.y * a.m + b.y * b.m) / m, vx = (a.vx * a.m + b.vx * b.m) / m, vy = (a.vy * a.m + b.vy * b.m) / m;
  G.combo = G.comboT > 0 ? G.combo + 1 : 1; G.comboT = 1.1; G.merges++; SAVE.merges++;
  const mult = Math.min(5, 1 + (G.combo - 1) * 0.5);
  if (a.t === TIERS.length - 1) {
    const pts = 200 * mult | 0; G.score += pts; SAVE.kings++; G.flash = 1;
    burst(x, y, "#ffcf3f", 90, 1.4); popText(x, y, `+${pts}`, "#ffcf3f", true); K.sfx("supernova"); K.banner("SUPERNOVA!", "Two King Gloops became stardust", 1800); return;
  }
  const t = a.t + 1, pts = Math.round(PTS[t] * mult);
  const nb = addBlob(t, x, y, vx * 0.5, Math.min(vy, 0) * 0.5 - 60, true); nb.sqv = -4;
  G.score += pts; if (t > G.top) { G.top = t; if (t > SAVE.top) { SAVE.top = t; setTimeout(() => K.toast("New slime discovered!", TIERS[t].name, "big"), 250); } }
  burst(x, y, TIERS[t].c, 14 + t * 3, 0.6 + t * 0.05); popText(x, y - TIERS[t].r * 0.3, `+${pts}`, "#fff", G.combo > 1);
  if (G.combo > 1) popText(x, y - TIERS[t].r - 20, `COMBO ×${G.combo}`, "#ffd75e", true);
  K.sfx("merge" + Math.min(10, t)); if (G.combo > 1) setTimeout(() => K.sfx("combo"), 60); K.vibrate(12 + t * 2);
}
function burst(x, y, col, n, size) { const rgb = hexRgb(col); PARTS.burst(sx(x), sy(y), n, { speed: 260 * size * L.s, life: 0.75, size: 7 * size * L.s, color: [rgb, "255,255,255"], g: 900 * L.s, drag: 1.2 }); }
function popText(x, y, text, col, big) { G.pops.push({ x, y, text, col, big, t: 0 }); }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; }
function shake() {
  if (!G || G.over || G.shakes <= 0) { K.sfx("deny"); return; }
  G.shakes--; G.shakeT = 0.45; for (const b of G.blobs) { b.vx += (Math.random() - 0.5) * 520; b.vy -= 260 + Math.random() * 380; b.sqv -= 3; }
  K.sfx("shake"); K.vibrate(60); hudBtns();
}
function update(dt) {
  if (!G) return;
  G.time += dt; G.cool -= dt; G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; G.flash = Math.max(0, G.flash - dt * 1.5); G.shakeT = Math.max(0, G.shakeT - dt);
  if (!G.over) {
    if (G.cur === null && G.cool <= 0) { G.cur = G.next; G.next = spawnTier(); }
    fixed(dt, step);
    // overflow check
    let over = false; for (const b of G.blobs) if (b.age > 1.2 && b.y - b.r < DANGER && Math.abs(b.vy) < 300) { over = true; break; }
    G.danger = over ? G.danger + dt : Math.max(0, G.danger - dt * 2);
    if (G.danger > 0.4 && Math.floor(G.time * 2.5) !== Math.floor((G.time - dt) * 2.5)) K.sfx("warn");
    if (G.danger > 2.4) gameOver();
    // keyboard + pad aiming
    let ax = 0; if (K.held("ArrowLeft", "KeyA")) ax -= 1; if (K.held("ArrowRight", "KeyD")) ax += 1; if (K.pad.connected) ax += K.pad.ax || (K.pad.held.dl ? -1 : K.pad.held.dr ? 1 : 0);
    if (ax) { G.x = clamp(G.x + ax * 520 * dt, 0, W); AIM.src = "key"; }
  } else G.overT += dt;
  for (const b of G.blobs) { b.pop = Math.min(1, b.pop + dt * 3); b.blink -= dt; if (b.blink < -0.12) b.blink = 2 + Math.random() * 4; }
  for (const p of G.pops) p.t += dt; G.pops = G.pops.filter((p) => p.t < 1.1);
}
function gameOver() {
  G.over = true; G.overT = 0; const best = G.daily ? SAVE.daily.date === K.today() ? SAVE.daily.best : 0 : SAVE.best;
  G.pb = G.score > best && G.score > 0;
  if (G.daily) { if (SAVE.daily.date !== K.today()) SAVE.daily = { date: K.today(), best: 0 }; SAVE.daily.best = Math.max(SAVE.daily.best, G.score); } else SAVE.best = Math.max(SAVE.best, G.score);
  persist(); K.sfx("over"); K.vibrate(150); K.musicLevel(0);
  const g = G; setTimeout(() => { if (G === g) results(); }, 1800);
}

/* ================= layout + drawing ================= */
const cv = $("#cv"), ctx = cv.getContext("2d"), PARTS = new K.Particles(700);
const L = { W: 0, H: 0, dpr: 1, s: 1, ox: 0, oy: 0, side: false };
let BGC = null;
function layout() {
  L.W = innerWidth; L.H = innerHeight; L.dpr = K.fit(cv, L.W, L.H).dpr; BGC = null; SPR.clear();
  const top = 52, wide = L.W > L.H * 1.15; L.side = wide;
  const availW = wide ? L.W - 2 * Math.min(260, L.W * 0.22) : L.W - 16, availH = L.H - top - (wide ? 14 : 92);
  L.s = Math.min(availW / (W + 40), availH / (H + 30)); L.ox = (L.W - W * L.s) / 2; L.oy = top + (availH - H * L.s) / 2 + 10;
}
addEventListener("resize", layout);
const sx = (x) => L.ox + x * L.s, sy = (y) => L.oy + y * L.s;
function bgc() {
  if (BGC) return BGC; const c = document.createElement("canvas"), w = Math.round(L.W * L.dpr), h = Math.round(L.H * L.dpr); c.width = w; c.height = h; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#3b2a78"); gr.addColorStop(0.6, "#2a1d57"); gr.addColorStop(1, "#1b1238"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const r = K.RNG(5); for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, rad = (6 + r() * 40) * L.dpr; g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.04})`; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); }
  return (BGC = c);
}
const SPR = new Map();
function body(t, rpx) {
  const key = t + ":" + Math.round(rpx); if (SPR.has(key)) return SPR.get(key);
  const T = TIERS[t], size = Math.ceil(rpx * 2 + 6), c = document.createElement("canvas"); c.width = c.height = Math.ceil(size * L.dpr); const g = c.getContext("2d"); g.scale(L.dpr, L.dpr);
  const cx = size / 2, rgb = hexRgb(T.c).split(",").map(Number), dk = `rgb(${rgb.map((v) => v * 0.62 | 0)})`, lt = `rgb(${rgb.map((v) => Math.min(255, v + 70))})`;
  const gr = g.createRadialGradient(cx - rpx * 0.35, cx - rpx * 0.4, rpx * 0.1, cx, cx, rpx); gr.addColorStop(0, lt); gr.addColorStop(0.55, T.c); gr.addColorStop(1, dk);
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cx, rpx, 0, Math.PI * 2); g.fill();
  g.strokeStyle = `rgba(${rgb.map((v) => v * 0.45 | 0)},0.9)`; g.lineWidth = Math.max(1.5, rpx * 0.06); g.stroke();
  g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.ellipse(cx - rpx * 0.38, cx - rpx * 0.45, rpx * 0.3, rpx * 0.16, -0.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.arc(cx - rpx * 0.12, cx - rpx * 0.62, rpx * 0.07, 0, Math.PI * 2); g.fill();
  SPR.set(key, c); return c;
}
function face(g, b, rpx, look, scared) {
  const t = b.t, er = rpx * (t < 3 ? 0.17 : 0.14), ex = rpx * 0.3, ey = -rpx * 0.06, blink = b.blink < 0, happy = t >= 7 && !scared;
  for (const s of [-1, 1]) {
    const x = s * ex;
    if (blink || (happy && t === 10)) { g.strokeStyle = "#2a1838"; g.lineWidth = Math.max(1.5, er * 0.35); g.lineCap = "round"; g.beginPath(); g.arc(x, ey + er * 0.2, er * 0.75, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); continue; }
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(x, ey, er, er * 1.15, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#2a1838"; g.beginPath(); g.arc(x + look[0] * er * 0.38, ey + look[1] * er * 0.4 + er * 0.1, er * 0.62, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(x + look[0] * er * 0.38 - er * 0.22, ey + look[1] * er * 0.4 - er * 0.15, er * 0.22, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = "rgba(255,120,150,0.45)"; if (t >= 2) for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * rpx * 0.52, rpx * 0.16, rpx * 0.13, rpx * 0.08, 0, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = "#2a1838"; g.fillStyle = "#6b1d3a"; g.lineWidth = Math.max(1.4, rpx * 0.05); g.lineCap = "round";
  if (scared) { g.beginPath(); g.ellipse(0, rpx * 0.3, rpx * 0.1, rpx * 0.13, 0, 0, Math.PI * 2); g.fill(); }
  else if (t % 3 === 1) { g.beginPath(); g.arc(0, rpx * 0.16, rpx * 0.17, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  else if (t % 3 === 2) { g.beginPath(); g.moveTo(-rpx * 0.2, rpx * 0.2); g.quadraticCurveTo(0, rpx * 0.46, rpx * 0.2, rpx * 0.2); g.closePath(); g.fill(); g.stroke(); }
  else { g.beginPath(); g.arc(-rpx * 0.07, rpx * 0.2, rpx * 0.07, 0, Math.PI); g.arc(rpx * 0.07, rpx * 0.2, rpx * 0.07, 0, Math.PI); g.stroke(); }
  if (t === 10) { // crown
    g.save(); g.translate(0, -rpx * 0.78); const cw = rpx * 0.62; g.fillStyle = "#ffe066"; g.strokeStyle = "#b07a00"; g.lineWidth = Math.max(1.5, rpx * 0.035); g.lineJoin = "round";
    g.beginPath(); g.moveTo(-cw / 2, cw * 0.18); g.lineTo(-cw / 2, -cw * 0.22); g.lineTo(-cw / 4, 0); g.lineTo(0, -cw * 0.34); g.lineTo(cw / 4, 0); g.lineTo(cw / 2, -cw * 0.22); g.lineTo(cw / 2, cw * 0.18); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#ff5a8a"; g.beginPath(); g.arc(0, cw * 0.02, cw * 0.07, 0, Math.PI * 2); g.fill(); g.restore();
  }
}
function drawBlob(b, x, y, alpha = 1) {
  const rpx = b.r * L.s * (b.pop < 1 ? 0.7 + 0.3 * K.ease.outElastic(b.pop) : 1);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
  const q = clamp(b.sq, -0.25, 0.25); ctx.rotate(b.sqa); ctx.scale(1 - q, 1 + q); ctx.rotate(-b.sqa);
  const spr = body(b.t, Math.round(b.R * L.s)), sz = spr.width / L.dpr * (rpx / (b.R * L.s));
  ctx.drawImage(spr, -sz / 2, -sz / 2, sz, sz);
  ctx.rotate(clamp(Math.sin(b.a) * 0.35, -0.35, 0.35));
  const px = sx(G ? G.x : W / 2) - x, py = sy(DROP_Y) - y, dd = Math.hypot(px, py) || 1;
  face(ctx, b, rpx, [px / dd, py / dd], G && G.danger > 0.4 && b.y - b.r < DANGER + 80);
  ctx.restore();
}
function tank() {
  const x0 = sx(0), y0 = sy(0), w = W * L.s, h = H * L.s, r = 26 * L.s;
  ctx.fillStyle = "rgba(255,255,255,0.06)"; K.roundRect(ctx, x0 - 10 * L.s, y0, w + 20 * L.s, h + 10 * L.s, r); ctx.fill();
  const gr = ctx.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, "rgba(120,200,255,0.06)"); gr.addColorStop(1, "rgba(120,200,255,0.16)"); ctx.fillStyle = gr; K.roundRect(ctx, x0, y0, w, h, r * 0.6); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = Math.max(2, 5 * L.s); ctx.beginPath(); ctx.moveTo(x0 - 4 * L.s, y0 + 20 * L.s); ctx.lineTo(x0 - 4 * L.s, y0 + h - r); ctx.quadraticCurveTo(x0 - 4 * L.s, y0 + h + 4 * L.s, x0 + r, y0 + h + 4 * L.s); ctx.lineTo(x0 + w - r, y0 + h + 4 * L.s); ctx.quadraticCurveTo(x0 + w + 4 * L.s, y0 + h + 4 * L.s, x0 + w + 4 * L.s, y0 + h - r); ctx.lineTo(x0 + w + 4 * L.s, y0 + 20 * L.s); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(x0 + 8 * L.s, y0 + 30 * L.s, 10 * L.s, h - 80 * L.s);
  // danger line
  const d = G ? G.danger : 0, a = d > 0.3 ? 0.55 + Math.sin(performance.now() / 90) * 0.4 : 0.35;
  ctx.strokeStyle = d > 0.3 ? `rgba(255,90,110,${a})` : "rgba(255,255,255,0.28)"; ctx.setLineDash([10 * L.s, 8 * L.s]); ctx.lineWidth = Math.max(1.5, 3 * L.s); ctx.beginPath(); ctx.moveTo(x0, sy(DANGER)); ctx.lineTo(x0 + w, sy(DANGER)); ctx.stroke(); ctx.setLineDash([]);
}
function chart(x, y, size, vertical) {
  // evolution ring of tiers seen so far
  const n = TIERS.length;
  for (let i = 0; i < n; i++) {
    const cx = vertical ? x : x + i * size * 1.05, cy = vertical ? y + i * size * 1.05 : y, seen = i <= Math.max(SAVE.top, G ? G.top : 0, 4);
    const b = { t: i, r: 1, R: 1, sq: 0, sqa: 0, a: 0, pop: 1, blink: 1 };
    ctx.save(); ctx.translate(cx, cy); const rp = size * 0.42 * (0.55 + 0.45 * i / (n - 1));
    if (!seen) { ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.arc(0, 0, rp, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = `700 ${rp}px Fredoka`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", 0, 1); }
    else { const spr = body(i, Math.round(rp)), s2 = spr.width / L.dpr; ctx.drawImage(spr, -s2 / 2, -s2 / 2, s2, s2); face(ctx, b, rp, [0, 0.3], false); }
    ctx.restore();
  }
}
function render(dt) {
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0); ctx.drawImage(bgc(), 0, 0, L.W, L.H);
  if (!G) { PARTS.update(dt); PARTS.draw(ctx, false); return; }
  const shk = G.shakeT > 0 ? Math.sin(G.time * 70) * 9 * G.shakeT : 0; ctx.save(); ctx.translate(shk, 0);
  tank();
  // dropper + guide
  if (!G.over) {
    const t = G.cur, r = t !== null ? TIERS[t].r : 20, x = clamp(G.x, r + 2, W - r - 2), X = sx(x);
    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = Math.max(1, 2 * L.s); ctx.setLineDash([4 * L.s, 10 * L.s]); ctx.beginPath(); ctx.moveTo(X, sy(DROP_Y)); ctx.lineTo(X, sy(H)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.9)"; K.roundRect(ctx, X - 26 * L.s, sy(DROP_Y) - r * L.s - 26 * L.s, 52 * L.s, 14 * L.s, 7 * L.s); ctx.fill();
    if (t !== null) drawBlob({ t, r: TIERS[t].r, R: TIERS[t].r, sq: Math.sin(G.time * 3) * 0.03, sqa: 0, a: 0, pop: 1, blink: (G.time % 3.5) < 0.12 ? -1 : 1, y: 0 }, X, sy(DROP_Y));
  }
  for (const b of G.blobs) drawBlob(b, sx(b.x), sy(b.y), 1);
  if (G.over) { ctx.fillStyle = `rgba(20,10,40,${Math.min(0.55, G.overT * 0.5)})`; ctx.fillRect(sx(0), sy(0), W * L.s, H * L.s); }
  PARTS.update(dt); PARTS.draw(ctx, false);
  for (const p of G.pops) { const k = p.t / 1.1; ctx.globalAlpha = 1 - k * k; ctx.font = `700 ${(p.big ? 30 : 22) * L.s * (1 + (1 - Math.min(1, p.t * 5)) * 0.4)}px Fredoka`; ctx.textAlign = "center"; ctx.lineWidth = 5 * L.s; ctx.strokeStyle = "rgba(40,20,70,0.8)"; ctx.strokeText(p.text, sx(p.x), sy(p.y) - k * 60 * L.s); ctx.fillStyle = p.col; ctx.fillText(p.text, sx(p.x), sy(p.y) - k * 60 * L.s); ctx.globalAlpha = 1; }
  ctx.restore();
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,240,180,${G.flash * 0.45})`; ctx.fillRect(0, 0, L.W, L.H); }
  // score + next
  ctx.textBaseline = "alphabetic";
  if (L.side) {
    const px = Math.max(16, sx(0) - 24 - Math.min(220, L.W * 0.18)), pw = Math.min(220, L.W * 0.18);
    card(px, sy(0), pw, "SCORE", G.score, G.combo > 1 ? `combo ×${G.combo}` : "");
    card(px, sy(0) + 110, pw, G.daily ? "TODAY'S BEST" : "BEST", Math.max(G.daily ? (SAVE.daily.date === K.today() ? SAVE.daily.best : 0) : SAVE.best, G.score), "");
    nextCard(px, sy(0) + 220, pw);
    const cx = sx(W) + 40 + Math.min(220, L.W * 0.18) / 2, size = Math.min(54, (L.H - 140) / 11.6);
    chart(Math.min(cx, L.W - size), sy(0) + size * 0.6, size, true);
  } else {
    ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = `700 26px Fredoka`; ctx.fillText(K.fmt(G.score), L.W / 2, 36);
    ctx.font = `600 13px Fredoka`; ctx.fillStyle = "#cbbcf0"; ctx.fillText(`BEST ${K.fmt(Math.max(G.daily ? (SAVE.daily.date === K.today() ? SAVE.daily.best : 0) : SAVE.best, G.score))}${G.combo > 1 ? `  ·  COMBO ×${G.combo}` : ""}`, L.W / 2, 54);
    nextCard(L.W - 96, 60, 80, true);
    const size = Math.min(34, (L.W - 24) / 11.6); chart((L.W - size * 1.05 * 10) / 2, L.H - size * 0.8 - 8, size, false);
  }
}
function card(x, y, w, label, val, sub) {
  ctx.fillStyle = "rgba(43,30,82,0.85)"; K.roundRect(ctx, x, y, w, 96, 18); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.textAlign = "center"; ctx.fillStyle = "#cbbcf0"; ctx.font = "600 14px Fredoka"; ctx.fillText(label, x + w / 2, y + 26);
  ctx.fillStyle = "#fff"; ctx.font = `700 ${val > 99999 ? 30 : 36}px Fredoka`; ctx.fillText(K.fmt(val), x + w / 2, y + 66);
  if (sub) { ctx.fillStyle = "#ffd75e"; ctx.font = "600 14px Fredoka"; ctx.fillText(sub, x + w / 2, y + 88); }
}
function nextCard(x, y, w, small) {
  const h = small ? 74 : 120; ctx.fillStyle = "rgba(43,30,82,0.85)"; K.roundRect(ctx, x, y, w, h, 16); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.textAlign = "center"; ctx.fillStyle = "#cbbcf0"; ctx.font = `600 ${small ? 11 : 14}px Fredoka`; ctx.fillText("NEXT", x + w / 2, y + (small ? 16 : 24));
  const t = G.next, r = Math.min(TIERS[t].r * (small ? 0.6 : 0.95), small ? 22 : 38);
  drawBlobAt(t, x + w / 2, y + (small ? 46 : 74), r);
}
function drawBlobAt(t, x, y, rp) { const spr = body(t, Math.round(rp)), s2 = spr.width / L.dpr; ctx.drawImage(spr, x - s2 / 2, y - s2 / 2, s2, s2); ctx.save(); ctx.translate(x, y); face(ctx, { t, blink: 1 }, rp, [0, 0.2], false); ctx.restore(); }

/* ================= input ================= */
const AIM = { src: "mouse", down: false, id: null };
function toWorldX(px) { return (px - L.ox) / L.s; }
cv.addEventListener("pointerdown", (e) => {
  if (!G || K.ui.active() || G.over) return; K.audio();
  AIM.src = "ptr"; G.x = clamp(toWorldX(e.clientX), 0, W);
  if (e.pointerType === "touch") { AIM.down = true; AIM.id = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch {} } else drop();
});
cv.addEventListener("pointermove", (e) => { if (!G || G.over) return; if (e.pointerType === "touch" && !AIM.down) return; AIM.src = "ptr"; G.x = clamp(toWorldX(e.clientX), 0, W); });
cv.addEventListener("pointerup", (e) => { if (AIM.down && e.pointerId === AIM.id) { AIM.down = false; G.x = clamp(toWorldX(e.clientX), 0, W); drop(); } });
cv.addEventListener("pointercancel", () => { AIM.down = false; });
addEventListener("keydown", (e) => {
  if (!G || K.ui.active()) return;
  if (e.code === "Space" || e.code === "ArrowDown") { e.preventDefault(); drop(); }
  else if (e.code === "KeyX") shake();
  else if (e.code === "Escape" || e.code === "KeyP") menu();
});
function pollPad() { const P = K.pad; if (!P.connected || !G || K.ui.active()) return; if (P.pressed.a || P.pressed.dd) drop(); if (P.pressed.x || P.pressed.y) shake(); if (P.pressed.start) menu(); }
$("#menuBtn").onclick = () => menu();
$("#shakeBtn").onclick = () => shake();
function hudBtns() { const b = $("#shakeBtn"); b.textContent = `Shake ×${G.shakes}`; b.disabled = G.shakes <= 0; }

/* ================= audio ================= */
const PEN = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const sfx = {
  drop: (t) => K.voice(520, t, 0.12, { type: "sine", vol: 0.06, slide: 0.55, slideT: 0.1 }),
  thud: (t) => K.voice(140 + Math.random() * 40, t, 0.08, { type: "sine", vol: 0.06, slide: 0.6 }),
  thudBig: (t) => { K.voice(80, t, 0.16, { type: "sine", vol: 0.1, slide: 0.6 }); K.noise(t, 0.08, { filter: "lowpass", freq: 400, vol: 0.06 }); },
  combo: (t) => K.notes(t, [1046, 1318, 1568], 0.05, { type: "triangle", vol: 0.04, len: 0.16 }),
  warn: (t) => K.voice(220, t, 0.1, { type: "square", vol: 0.035, lp: 900 }),
  over: (t) => K.notes(t, [523, 392, 330, 262], 0.15, { type: "triangle", vol: 0.06, len: 0.4 }),
  shake: (t) => { K.noise(t, 0.45, { filter: "lowpass", freq: 500, vol: 0.14, slide: 0.5 }); K.voice(70, t, 0.4, { type: "sine", vol: 0.1, vib: 18 }); },
  supernova: (t) => { K.noise(t, 0.8, { filter: "bandpass", freq: 900, slide: 4, vol: 0.12 }); K.notes(t + 0.05, [523, 659, 784, 1046, 1318, 1568, 2093], 0.07, { type: "triangle", vol: 0.05, len: 0.5 }); },
  start: (t) => K.notes(t, [392, 523, 659, 784], 0.07, { type: "sine", vol: 0.05, len: 0.25 }),
};
for (let i = 1; i <= 10; i++) sfx["merge" + i] = (t) => { K.voice(K.hz(60 + PEN[i]), t, 0.16, { type: "sine", vol: 0.07, slide: 1.5, slideT: 0.06 }); K.voice(K.hz(72 + PEN[i]), t + 0.04, 0.2, { type: "triangle", vol: 0.04 }); K.noise(t, 0.05, { filter: "bandpass", freq: 1200 + i * 200, q: 3, vol: 0.06 }); };
K.defineSfx(sfx, { thud: 0.06, thudBig: 0.1, warn: 0.3 });
K.songs({ bounce: { bpm: 116, chords: ["C", "G", "Am", "F", "C", "G", "F", "G"], bass: "R . O . F . O . R . O . F . O .", bassVol: 0.1, bassWave: "triangle", arp: true, arpVol: 0.015, arpPat: [0, 1, 2, 1], drums: "k . h . s . h k . k h . s . h .", leadVol: 0.035, leadWave: 0.25,
  lead: ["e5 . g5 . c6 . g5 .", "d5 - - . b4 . d5 .", "c5 . e5 . a5 - g5 .", "f5 - - - . . . .", "e5 . g5 . c6 . e6 .", "d6 - b5 . g5 . . .", "a5 . f5 . c5 . a4 .", "b4 - - - d5 - - -"] } });

/* ================= screens ================= */
function blobImg(t, px = 84) { const c = document.createElement("canvas"); c.width = c.height = px; const g = c.getContext("2d"); const keep = L.dpr; L.dpr = 1; const spr = body(t, px * 0.44); g.drawImage(spr, (px - spr.width) / 2, (px - spr.height) / 2); g.translate(px / 2, px / 2); face(g, { t, blink: 1 }, px * 0.44, [0, 0.2], false); L.dpr = keep; SPR.clear(); return c.toDataURL(); }
let IMGS = null;
function title() {
  G = null; $("#hud").hidden = true; K.playSong("bounce", 1);
  IMGS = IMGS || TIERS.map((_, i) => blobImg(i));
  const dd = SAVE.daily.date === K.today() ? SAVE.daily.best : 0;
  K.ui.show(`<div class="logo"><span>G</span><span>L</span><span>O</span><span>O</span><span>P</span></div><p class="k-sub">Drop slimes into the tank. Two of a kind merge into something bigger.</p>
    <div class="modes"><button class="k-btn mode" data-a="play" autofocus><b>Classic</b><span>Keep merging until the tank overflows.</span><em>${SAVE.best ? "Best " + K.fmt(SAVE.best) : "No score yet"}</em></button>
    <button class="k-btn mode" data-a="daily"><b>Daily drop</b><span>Today's slime order, the same for everyone.</span><em>${dd ? "Today's best " + K.fmt(dd) : "Not played today"}</em></button></div>
    <div class="evo">${IMGS.map((u, i) => `<img src="${u}" alt="${TIERS[i].name}" title="${i <= Math.max(SAVE.top, 4) ? TIERS[i].name : "???"}" class="${i <= Math.max(SAVE.top, 4) ? "" : "no"}">`).join("")}</div>
    <div class="k-row"><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>`, { cls: "soft" });
}
function menu() {
  if (!G || G.over) return;
  K.ui.show(`<div class="logo" style="font-size:3em">Paused</div><p class="k-sub">Score ${K.fmt(G.score)}</p><div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="restart">Restart</button><button class="k-btn" data-a="settings" data-from="menu">Settings</button><button class="k-btn" data-a="help" data-from="menu">How to play</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "resume" });
}
function results() {
  const top = G.top;
  K.ui.show(`<div class="logo" style="font-size:3em">Overflow!</div><p class="k-sub">${G.daily ? "Daily drop" : "Classic"}</p>
    <div class="k-stats"><div class="k-stat"><small>Score</small><b>${K.fmt(G.score)}</b></div><div class="k-stat"><small>Merges</small><b>${G.merges}</b></div><div class="k-stat"><small>Biggest</small><b>${TIERS[top].name}</b></div></div>
    <img src="${(IMGS || (IMGS = TIERS.map((_, i) => blobImg(i))))[top]}" alt="" style="width:5em;height:5em">
    ${G.pb ? `<b style="color:var(--gold)">New best score!</b>` : ""}
    <div class="k-row"><button class="k-btn primary" data-a="${G.daily ? "daily" : "play"}" autofocus>Play again</button>${G.daily ? `<button class="k-btn" data-a="share">Copy result</button>` : ""}<button class="k-btn" data-a="title">Main menu</button></div><div class="k-msg" id="msg"></div>`, { back: "title" });
}
function settings(from) { const back = from === "menu" ? "menu" : "title"; const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center">${K.ui.settingsRows()}</div>`, { back, cls: "top" }); K.ui.bindSettings(s); }
function help(from) {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="${from === "menu" ? "menu" : "title"}" autofocus>Back</button></div>
    <div class="k-help"><div><b>Drop</b>Aim with the mouse (or drag on touch) and drop the slime into the tank.</div><div><b>Merge</b>Two slimes of the same kind merge into the next one. Quick chains of merges score combo bonuses.</div>
    <div><b>Don't overflow</b>If slimes stay above the dashed line for too long, the game ends.</div><div><b>Shake</b>Three times a game you can shake the tank to loosen things up.</div>
    <div><b>King Gloop</b>Merge two King Gloops for a supernova bonus.</div><div class="k-kbonly"><b>Keys</b>← → or A D aim · Space or ↓ drop · X shake · Esc pause</div><div><b>Controller</b>Stick aims · A drops · X shakes · Start pauses</div></div>`, { back: from === "menu" ? "menu" : "title", cls: "top" });
}
K.ui.on((a, d) => {
  switch (a) {
    case "title": K.sfx("back"); return title();
    case "play": K.sfx("ok"); return newGame(false);
    case "daily": K.sfx("ok"); return newGame(true);
    case "restart": K.sfx("ok"); return newGame(G.daily);
    case "resume": K.ui.hide(); return;
    case "menu": return menu();
    case "settings": K.sfx("ok"); return settings(d.from);
    case "help": K.sfx("ok"); return help(d.from);
    case "share": K.copy(`GLOOP · Daily drop ${K.today()}\nScore ${K.fmt(G.score)} · biggest ${TIERS[G.top].name}`).then((ok) => { const m = $("#msg"); if (m) m.textContent = ok ? "Copied to clipboard." : "Couldn't copy."; }); return;
  }
});
K.onPause(() => { if (G && !G.over && !K.ui.active()) menu(); });

/* ================= boot ================= */
layout(); title();
document.fonts.load("700 30px Fredoka").then(() => { IMGS = null; if (!G && $(".logo")) title(); }).catch(() => {});
K.loop((dt) => { pollPad(); if (G && !K.ui.active()) update(dt); render(dt); });
