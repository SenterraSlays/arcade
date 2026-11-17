"use strict";
/* JADE — mahjong solitaire. */
const { $, $$, clamp } = K;
const SAVE = K.load("jade.v1", { opts: { dim: true, labels: true }, stats: {}, cur: null, daily: { date: "", time: 0 } });
for (const L of MJ.LAYOUTS) SAVE.stats[L.id] = K.merge({ played: 0, won: 0, best: 0 }, SAVE.stats[L.id]);
const persist = () => K.save("jade.v1", SAVE);
const CJK = '"Noto Serif SC", "Songti SC", "SimSun", serif';

/* ================= tile art ================= */
const T = { ux: 20, uy: 26, dz: 4, th: 4, dpr: 1, cache: new Map() };
const NUMS = "一二三四五六七八九", WINDS = "東南西北", WL = "ESWN";
const DOTC = { b: "#2559b5", g: "#2a8a50", r: "#c62f3a" };
const DOTS = {
  1: [[0.5, 0.5, "b"]], 2: [[0.5, 0.28, "g"], [0.5, 0.72, "b"]], 3: [[0.25, 0.2, "b"], [0.5, 0.5, "r"], [0.75, 0.8, "g"]],
  4: [[0.3, 0.28, "b"], [0.7, 0.28, "g"], [0.3, 0.72, "g"], [0.7, 0.72, "b"]], 5: [[0.28, 0.24, "b"], [0.72, 0.24, "g"], [0.5, 0.5, "r"], [0.28, 0.76, "g"], [0.72, 0.76, "b"]],
  6: [[0.3, 0.2, "g"], [0.7, 0.2, "g"], [0.3, 0.5, "r"], [0.7, 0.5, "r"], [0.3, 0.8, "r"], [0.7, 0.8, "r"]],
  7: [[0.22, 0.15, "g"], [0.5, 0.27, "g"], [0.78, 0.39, "g"], [0.3, 0.63, "r"], [0.7, 0.63, "r"], [0.3, 0.86, "r"], [0.7, 0.86, "r"]],
  8: [[0.3, 0.14, "b"], [0.7, 0.14, "b"], [0.3, 0.38, "b"], [0.7, 0.38, "b"], [0.3, 0.62, "b"], [0.7, 0.62, "b"], [0.3, 0.86, "b"], [0.7, 0.86, "b"]],
  9: [[0.22, 0.18, "b"], [0.5, 0.18, "b"], [0.78, 0.18, "b"], [0.22, 0.5, "r"], [0.5, 0.5, "r"], [0.78, 0.5, "r"], [0.22, 0.82, "g"], [0.5, 0.82, "g"], [0.78, 0.82, "g"]],
};
const BAMB = {
  2: [[0.5, 0.3], [0.5, 0.7]], 3: [[0.5, 0.3], [0.3, 0.7], [0.7, 0.7]], 4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]], 5: [[0.25, 0.3], [0.75, 0.3], [0.5, 0.5, 1], [0.25, 0.7], [0.75, 0.7]],
  6: [[0.22, 0.3], [0.5, 0.3], [0.78, 0.3], [0.22, 0.7], [0.5, 0.7], [0.78, 0.7]], 7: [[0.5, 0.19, 1], [0.22, 0.52], [0.5, 0.52], [0.78, 0.52], [0.22, 0.82], [0.5, 0.82], [0.78, 0.82]],
  8: [[0.2, 0.3, 0, -0.3], [0.4, 0.3, 0, 0.3], [0.6, 0.3, 0, -0.3], [0.8, 0.3, 0, 0.3], [0.2, 0.7, 0, 0.3], [0.4, 0.7, 0, -0.3], [0.6, 0.7, 0, 0.3], [0.8, 0.7, 0, -0.3]],
  9: [[0.22, 0.2], [0.5, 0.2, 1], [0.78, 0.2], [0.22, 0.5], [0.5, 0.5, 1], [0.78, 0.5], [0.22, 0.8], [0.5, 0.8, 1], [0.78, 0.8]],
};
function circle(g, x, y, r, col) {
  g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fbf6ea"; g.beginPath(); g.arc(x, y, r * 0.68, 0, Math.PI * 2); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(x, y, r * 0.42, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.85)"; g.beginPath(); g.arc(x - r * 0.12, y - r * 0.12, r * 0.13, 0, Math.PI * 2); g.fill();
}
function stick(g, x, y, w, h, red, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); const col = red ? "#c62f3a" : "#2a8a50", dk = red ? "#8e1c25" : "#1b5e36";
  K.roundRect(g, -w / 2, -h / 2, w, h, w * 0.45); g.fillStyle = col; g.fill();
  g.fillStyle = dk; for (const k of [0.18, 0.5, 0.82]) g.fillRect(-w / 2, -h / 2 + h * k - w * 0.12, w, w * 0.24);
  g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(-w * 0.18, -h / 2 + w * 0.3, w * 0.16, h - w * 0.6);
  g.restore();
}
function bird(g, w, h) {
  g.save(); g.translate(w / 2, h * 0.52); const s = w * 0.36;
  g.fillStyle = "#2a8a50"; for (let k = -2; k <= 2; k++) { g.save(); g.rotate(k * 0.32 + 0.2); g.beginPath(); g.ellipse(s * 0.75, 0, s * 0.6, s * 0.16, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#2559b5"; g.beginPath(); g.arc(s * 1.25, 0, s * 0.1, 0, Math.PI * 2); g.fill(); g.fillStyle = "#2a8a50"; g.restore(); }
  g.fillStyle = "#c62f3a"; g.beginPath(); g.ellipse(-s * 0.1, 0, s * 0.5, s * 0.36, -0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#2a8a50"; g.beginPath(); g.arc(-s * 0.5, -s * 0.42, s * 0.24, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#d39a1f"; g.beginPath(); g.moveTo(-s * 0.72, -s * 0.46); g.lineTo(-s * 0.98, -s * 0.36); g.lineTo(-s * 0.7, -s * 0.32); g.fill();
  g.fillStyle = "#fff"; g.beginPath(); g.arc(-s * 0.55, -s * 0.47, s * 0.06, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#c62f3a"; g.lineWidth = s * 0.07; g.beginPath(); g.moveTo(-s * 0.45, -s * 0.64); g.lineTo(-s * 0.35, -s * 0.85); g.moveTo(-s * 0.52, -s * 0.66); g.lineTo(-s * 0.55, -s * 0.88); g.stroke();
  g.strokeStyle = "#7a5a2a"; g.lineWidth = s * 0.07; g.beginPath(); g.moveTo(-s * 0.1, s * 0.34); g.lineTo(-s * 0.15, s * 0.7); g.moveTo(s * 0.12, s * 0.3); g.lineTo(s * 0.12, s * 0.7); g.stroke();
  g.restore();
}
function glyph(g, ch, x, y, size, col) { g.font = `700 ${size}px ${CJK}`; g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch, x, y); }
function icon(g, kind, x, y, s, col) {
  g.save(); g.translate(x, y); g.fillStyle = col; g.strokeStyle = col;
  if (kind === "petal") { for (let k = 0; k < 5; k++) { g.save(); g.rotate((k * Math.PI * 2) / 5); g.beginPath(); g.ellipse(0, -s * 0.45, s * 0.28, s * 0.42, 0, 0, Math.PI * 2); g.fill(); g.restore(); } g.fillStyle = "#f6d36b"; g.beginPath(); g.arc(0, 0, s * 0.2, 0, Math.PI * 2); g.fill(); }
  else if (kind === "sun") { g.beginPath(); g.arc(0, 0, s * 0.42, 0, Math.PI * 2); g.fill(); g.lineWidth = s * 0.12; for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.beginPath(); g.moveTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6); g.lineTo(Math.cos(a) * s * 0.9, Math.sin(a) * s * 0.9); g.stroke(); } }
  else if (kind === "leaf") { g.beginPath(); g.moveTo(0, -s * 0.9); g.quadraticCurveTo(s * 0.8, -s * 0.2, 0, s * 0.8); g.quadraticCurveTo(-s * 0.8, -s * 0.2, 0, -s * 0.9); g.fill(); g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(0, -s * 0.6); g.lineTo(0, s * 0.9); g.stroke(); }
  else if (kind === "snow") { g.lineWidth = s * 0.13; g.lineCap = "round"; for (let k = 0; k < 3; k++) { g.save(); g.rotate((k * Math.PI) / 3); g.beginPath(); g.moveTo(0, -s * 0.85); g.lineTo(0, s * 0.85); g.moveTo(-s * 0.25, -s * 0.6); g.lineTo(0, -s * 0.4); g.lineTo(s * 0.25, -s * 0.6); g.moveTo(-s * 0.25, s * 0.6); g.lineTo(0, s * 0.4); g.lineTo(s * 0.25, s * 0.6); g.stroke(); g.restore(); } }
  else if (kind === "sprout") { g.lineWidth = s * 0.12; g.beginPath(); g.moveTo(0, s * 0.85); g.lineTo(0, -s * 0.2); g.stroke(); g.beginPath(); g.ellipse(-s * 0.32, -s * 0.3, s * 0.36, s * 0.18, -0.5, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(s * 0.32, -s * 0.45, s * 0.36, s * 0.18, 0.5, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
function drawFace(g, f, w, h) {
  const small = w < 34;
  if (f < 9) { const n = f + 1, r = w * (n === 1 ? 0.36 : n <= 4 ? 0.17 : n === 5 ? 0.15 : 0.125); for (const [x, y, c] of DOTS[n]) circle(g, w * (0.12 + x * 0.76), h * (0.1 + y * 0.8), r, DOTC[c]); if (n === 1) { g.strokeStyle = DOTC.g; g.lineWidth = w * 0.03; g.beginPath(); g.arc(w / 2, h / 2, w * 0.41, 0, Math.PI * 2); g.stroke(); } }
  else if (f < 18) { const n = f - 8; if (n === 1) bird(g, w, h); else { const many = n >= 6, sw = w * (many ? 0.12 : 0.14), sh = h * (n === 7 ? 0.22 : many ? 0.26 : 0.3); for (const [x, y, red, rot] of BAMB[n]) stick(g, w * (0.1 + x * 0.8), h * (0.08 + y * 0.84), sw, sh, red, rot || 0); } }
  else if (f < 27) { glyph(g, NUMS[f - 18], w / 2, h * 0.3, h * 0.36, "#1d2c63"); glyph(g, "萬", w / 2, h * 0.7, h * 0.42, "#c0262e"); }
  else if (f < 31) { glyph(g, WINDS[f - 27], w / 2, h * 0.53, h * 0.58, "#1f2430"); }
  else if (f === 31) glyph(g, "中", w / 2, h * 0.53, h * 0.62, "#c0262e");
  else if (f === 32) glyph(g, "發", w / 2, h * 0.53, h * 0.58, "#1f7a45");
  else if (f === 33) { g.strokeStyle = "#2b4f9e"; g.lineWidth = w * 0.06; K.roundRect(g, w * 0.18, h * 0.16, w * 0.64, h * 0.68, w * 0.05); g.stroke(); g.lineWidth = w * 0.025; K.roundRect(g, w * 0.27, h * 0.24, w * 0.46, h * 0.52, w * 0.03); g.stroke(); }
  else if (f < 38) { const k = f - 34, col = ["#c0262e", "#8a3fb0", "#c9800f", "#1f7a45"][k]; icon(g, k === 3 ? "leaf" : "petal", w / 2, h * 0.26, w * 0.2, col); glyph(g, "梅蘭菊竹"[k], w / 2, h * 0.66, h * 0.4, col); }
  else { const k = f - 38, col = ["#2f9e57", "#d9472b", "#c47a12", "#2b6fb0"][k]; icon(g, ["sprout", "sun", "leaf", "snow"][k], w / 2, h * 0.26, w * 0.2, col); glyph(g, "春夏秋冬"[k], w / 2, h * 0.66, h * 0.4, col); }
  // corner labels
  if (SAVE.opts.labels || f >= 27 && f < 31) {
    let t = "", col = "#3b3b3b";
    if (f < 9) { t = f + 1 + "●"; col = DOTC.b; } else if (f < 18) { t = String(f - 8) + "|"; col = DOTC.g; } else if (f < 27) { t = String(f - 17); col = "#c0262e"; } else if (f < 31) { t = WL[f - 27]; col = "#1f2430"; } else if (f >= 34) t = String((f - 34) % 4 + 1);
    if (t) { g.font = `800 ${Math.max(7, w * (small ? 0.26 : 0.2))}px Nunito, sans-serif`; g.textAlign = "left"; g.textBaseline = "top"; g.fillStyle = "rgba(251,247,236,0.85)"; const tw = g.measureText(t).width; g.fillRect(w * 0.04, h * 0.03, tw + w * 0.06, w * 0.24); g.fillStyle = col; g.fillText(t, w * 0.07, h * 0.035); }
  }
}
function tileSprite(f) {
  const key = f + (SAVE.opts.labels ? "L" : "") + "@" + T.ux.toFixed(2); if (T.cache.has(key)) return T.cache.get(key);
  const w = T.ux * 2, h = T.uy * 2, th = T.th, c = document.createElement("canvas"); c.width = Math.ceil((w + th + 2) * T.dpr); c.height = Math.ceil((h + th + 2) * T.dpr);
  const g = c.getContext("2d"); g.scale(T.dpr, T.dpr); const r = w * 0.12;
  // body (thickness) toward the lower right
  const gb = g.createLinearGradient(0, 0, w + th, h + th); gb.addColorStop(0, "#3aa57c"); gb.addColorStop(1, "#14523d");
  K.roundRect(g, th, th, w - 1, h - 1, r); g.fillStyle = gb; g.fill();
  K.roundRect(g, th * 0.5, th * 0.5, w - 1, h - 1, r); g.fillStyle = "#e9e1cb"; g.fill();
  // face
  const gf = g.createLinearGradient(0, 0, 0, h); gf.addColorStop(0, "#fffcf3"); gf.addColorStop(1, "#efe6cf");
  K.roundRect(g, 0.5, 0.5, w - 1.5, h - 1.5, r); g.fillStyle = gf; g.fill(); g.strokeStyle = "rgba(60,50,30,0.35)"; g.lineWidth = 1; g.stroke();
  g.save(); g.translate(0.5, 0.5); K.roundRect(g, 0, 0, w - 1.5, h - 1.5, r); g.clip(); drawFace(g, f, w - 1.5, h - 1.5); g.restore();
  T.cache.set(key, c); return c;
}

/* ================= game state ================= */
let G = null;
function start(li, o = {}) {
  const seed = o.seed ?? ((Math.random() * 4294967296) >>> 0), d = MJ.deal(li, K.RNG(seed));
  if (!d.faces) { K.toast("Couldn't deal that layout"); return; }
  G = { li, L: MJ.LAYOUTS[li], seed, daily: !!o.daily, pos: d.pos, g: d.g, faces: Array.from(d.faces), alive: new Uint8Array(d.pos.length).fill(1), sel: -1, undo: [], time: 0, hints: 0, shuffles: 0, won: false, anims: [], hint: null, cursor: -1, started: false };
  d.g.zs = d.pos.map((p) => p[2]);
  SAVE.stats[G.L.id].played++; persist();
  enter(); intro(); saveCur();
}
function enter() {
  K.ui.hide(); $("#bar").hidden = false; layout(); hud(); K.playSong("garden", 2);
  if (innerHeight > innerWidth * 1.2 && T.ux < 16 && !enter.tipped) { enter.tipped = true; setTimeout(() => K.toast("Tip", "Turn your phone sideways for bigger tiles."), 900); }
}
function resume() {
  const c = SAVE.cur; if (!c || !MJ.LAYOUTS[c.li]) return false;
  const pos = MJ.LAYOUTS[c.li].build(); if (pos.length % 2) pos.pop();
  if (c.faces.length !== pos.length) return false;
  const g = MJ.graph(pos); g.zs = pos.map((p) => p[2]);
  G = { li: c.li, L: MJ.LAYOUTS[c.li], seed: c.seed, daily: c.daily, pos, g, faces: c.faces.slice(), alive: Uint8Array.from(c.alive.split(""), Number), sel: -1, undo: c.undo || [], time: c.time || 0, hints: c.hints || 0, shuffles: c.shuffles || 0, won: false, anims: [], hint: null, cursor: -1, started: true };
  enter(); return true;
}
function saveCur() {
  if (!G || G.won) { SAVE.cur = null; persist(); return; }
  SAVE.cur = { li: G.li, seed: G.seed, daily: G.daily, faces: G.faces, alive: Array.from(G.alive).join(""), undo: G.undo.slice(-200), time: Math.round(G.time), hints: G.hints, shuffles: G.shuffles }; persist();
}
const freeOf = (i) => G.alive[i] && MJ.isFree(G.g, i, G.alive);
function info() { return MJ.freeMatches(G.g, G.faces, G.alive); }
function pick(i) {
  if (!G || G.won || i < 0) return;
  if (!freeOf(i)) { K.sfx("blocked"); shake(i); return; }
  G.hint = null;
  if (G.sel === i) { G.sel = -1; K.sfx("back"); return; }
  if (G.sel >= 0 && MJ.matches(G.faces[G.sel], G.faces[i])) { match(G.sel, i); return; }
  if (G.sel >= 0) K.sfx("deny");
  G.sel = i; K.sfx("select");
}
function match(a, b) {
  G.alive[a] = G.alive[b] = 0; G.sel = -1; G.started = true;
  G.undo.push({ k: "m", a, b });
  const pa = tileXY(a), pb = tileXY(b);
  G.anims.push({ i: a, t: 0, x: pa.x, y: pa.y, tx: (pa.x + pb.x) / 2, ty: Math.min(pa.y, pb.y) - T.uy }, { i: b, t: 0, x: pb.x, y: pb.y, tx: (pa.x + pb.x) / 2, ty: Math.min(pa.y, pb.y) - T.uy });
  const combo = G.lastMatch && G.time - G.lastMatch < 2.5; G.lastMatch = G.time;
  K.sfx(combo ? "match2" : "match"); K.vibrate(15);
  setTimeout(() => { for (const p of [pa, pb]) PARTS.burst(p.x + T.ux, p.y + T.uy, 14, { speed: 220, life: 0.7, size: T.ux * 0.18, color: ["95,211,165", "232,196,108", "255,255,255"] }); }, 200);
  hud(); saveCur();
  if (G.alive.every((v) => !v)) { win(); return; }
  if (!info().pairs.length) setTimeout(() => { if (G && !G.won && !info().pairs.length) stuck(); }, 450);
}
function undo() {
  if (!G || G.won) return; const u = G.undo.pop(); if (!u) { K.sfx("deny"); return; }
  if (u.k === "m") { G.alive[u.a] = G.alive[u.b] = 1; for (const i of [u.a, u.b]) G.anims.push({ i, t: 0, back: true }); }
  else if (u.k === "s") G.faces = u.faces;
  G.sel = -1; G.hint = null; K.sfx("undo"); hud(); saveCur();
}
function hint() {
  if (!G || G.won) return; const p = info().pairs;
  if (!p.length) { stuck(); return; }
  const best = p[(Math.random() * p.length) | 0]; G.hint = { a: best[0], b: best[1], t: 0 }; G.hints++; G.sel = -1; K.sfx("hint"); saveCur();
}
function shuffle(free) {
  if (!G || G.won) return;
  const f2 = MJ.reshuffle(G.g, G.pos, G.faces, G.alive, K.RNG((Math.random() * 1e9) | 0));
  if (!f2) { K.toast("These tiles can't be rearranged into a solvable layout", "Try undoing a few moves."); K.sfx("deny"); return; }
  G.undo.push({ k: "s", faces: G.faces.slice() }); G.faces = Array.from(f2); if (!free) G.shuffles++;
  G.sel = -1; G.hint = null; G.shufT = 0; K.sfx("shuffle"); hud(); saveCur();
}
function stuck() {
  if (!G || G.won) return;
  K.sfx("deny");
  K.confirm({ title: "No more matches", text: "There are no free pairs left. Shuffle the remaining tiles (they'll stay solvable), or undo.", yes: "Shuffle", no: "Undo" }).then((y) => { if (!G) return; if (y) shuffle(); else undo(); });
}
function win() {
  G.won = true; G.sel = -1; const st = SAVE.stats[G.L.id], ms = Math.round(G.time * 1000), clean = !G.hints && !G.shuffles;
  st.won++; G.pb = clean && ms > 0 && (!st.best || ms < st.best); if (G.pb) st.best = ms;
  if (G.daily) SAVE.daily = { date: K.today(), time: Math.round(G.time) };
  SAVE.cur = null; persist(); hud(); K.sfx("win"); K.vibrate(80);
  for (let k = 0; k < 6; k++) setTimeout(() => PARTS.burst(L.W * (0.2 + Math.random() * 0.6), L.H * (0.25 + Math.random() * 0.4), 40, { speed: 380, life: 1.3, size: 5, color: ["95,211,165", "232,196,108", "255,255,255", "255,140,120"], g: 220 }), k * 220);
  const g = G; setTimeout(() => { if (G === g) results(); }, 1900);
}

/* ================= layout + render ================= */
const cv = $("#cv"), ctx = cv.getContext("2d"), PARTS = new K.Particles(900);
const L = { W: 0, H: 0, dpr: 1, ox: 0, oy: 0 };
let BG = null;
function layout() {
  L.W = innerWidth; L.H = innerHeight; L.dpr = K.fit(cv, L.W, L.H).dpr; BG = null; T.dpr = L.dpr;
  if (!G) return;
  const top = $("#bar").hidden ? 12 : $("#bar").offsetHeight + 6, pad = 14;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, maxZ = 0;
  for (const [x, y, z] of G.pos) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z); }
  const wu = maxX - minX + 2, hu = maxY - minY + 2, aw = L.W - pad * 2, ah = L.H - top - pad;
  const ux = Math.min(aw / (wu + maxZ * 0.24 + 0.3), ah / (hu * 1.3 + maxZ * 0.24 + 0.3));
  T.ux = Math.max(6, ux); T.uy = T.ux * 1.3; T.dz = T.ux * 0.24; T.th = T.ux * 0.22; T.cache.clear();
  const tw = wu * T.ux + maxZ * T.dz + T.th, th = hu * T.uy + maxZ * T.dz + T.th;
  L.ox = (L.W - tw) / 2 - minX * T.ux + maxZ * T.dz; L.oy = top + (ah - th) / 2 - minY * T.uy + maxZ * T.dz;
}
addEventListener("resize", layout);
const tileXY = (i) => { const [x, y, z] = G.pos[i]; return { x: L.ox + x * T.ux - z * T.dz, y: L.oy + y * T.uy - z * T.dz }; };
function bg() {
  if (BG) return BG; const c = document.createElement("canvas"), w = Math.round(L.W * L.dpr), h = Math.round(L.H * L.dpr); c.width = w; c.height = h; const g = c.getContext("2d");
  const gr = g.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h / 2, Math.max(w, h) * 0.8); gr.addColorStop(0, "#14594a"); gr.addColorStop(1, "#04201b"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(180,255,220,0.05)"; g.lineWidth = 2 * L.dpr; const R = 46 * L.dpr;
  for (let y = 0; y < h + R; y += R) for (let x = (y / R) % 2 ? R : 0; x < w + R; x += R * 2) { g.beginPath(); g.arc(x, y, R, Math.PI, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(x, y, R * 0.6, Math.PI, Math.PI * 2); g.stroke(); }
  return (BG = c);
}
let order = null;
function drawOrder() { if (order && order.n === G.pos.length) return order.list; const list = G.pos.map((_, i) => i).sort((a, b) => G.pos[a][2] - G.pos[b][2] || G.pos[a][0] + G.pos[a][1] - G.pos[b][0] - G.pos[b][1] || G.pos[a][1] - G.pos[b][1]); order = { n: G.pos.length, list }; return list; }
function render(dt) {
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.drawImage(bg(), 0, 0, L.W, L.H);
  if (!G) { PARTS.update(dt); PARTS.draw(ctx); return; }
  const w = T.ux * 2, h = T.uy * 2, anim = new Map(); for (const a of G.anims) anim.set(a.i, a);
  if (G.hint) G.hint.t += dt;
  const shufK = G.shufT !== undefined ? clamp(G.shufT / 0.5, 0, 1) : 1; if (G.shufT !== undefined) { G.shufT += dt; if (G.shufT > 0.6) G.shufT = undefined; }
  for (const i of drawOrder()) {
    const a = anim.get(i); if (!G.alive[i] && !(a && !a.back)) continue;
    let { x, y } = tileXY(i), alpha = 1, sc = 1;
    if (a) { a.t += dt; const k = clamp(a.t / 0.32, 0, 1); if (a.back) { sc = 0.8 + 0.2 * K.ease.outBack(k); alpha = k; } else { const e = K.ease.inOutCubic(k); x += (a.tx - x) * e; y += (a.ty - y) * e - Math.sin(k * Math.PI) * T.uy * 0.6; alpha = 1 - k * k; sc = 1 + k * 0.15; } }
    if (G.shake && G.shake.i === i) { x += Math.sin(G.shake.t * 60) * 4 * (1 - G.shake.t / 0.3); }
    const free = G.alive[i] && MJ.isFree(G.g, i, G.alive);
    ctx.save(); ctx.globalAlpha = alpha; if (sc !== 1) { ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-x - w / 2, -y - h / 2); }
    if (shufK < 1) { const s = Math.abs(Math.cos(shufK * Math.PI)); ctx.translate(x + w / 2, 0); ctx.scale(Math.max(0.05, s), 1); ctx.translate(-x - w / 2, 0); }
    ctx.drawImage(tileSprite(G.faces[i]), x, y, w + T.th + 2, h + T.th + 2);
    if (SAVE.opts.dim && !free && G.alive[i]) { ctx.fillStyle = "rgba(10,30,24,0.28)"; K.roundRect(ctx, x, y, w - 1, h - 1, w * 0.12); ctx.fill(); }
    if (i === G.sel) { ctx.fillStyle = "rgba(255,214,90,0.35)"; K.roundRect(ctx, x, y, w - 1, h - 1, w * 0.12); ctx.fill(); ctx.strokeStyle = "#ffcf4a"; ctx.lineWidth = Math.max(2, T.ux * 0.12); ctx.stroke(); }
    if (G.hint && (i === G.hint.a || i === G.hint.b)) { ctx.strokeStyle = `rgba(95,211,255,${0.6 + Math.sin(G.hint.t * 7) * 0.35})`; ctx.lineWidth = Math.max(2, T.ux * 0.14); K.roundRect(ctx, x - 1, y - 1, w + 1, h + 1, w * 0.13); ctx.stroke(); }
    if (i === G.cursor && (K.device === "kb" || K.device === "pad")) { ctx.strokeStyle = "#ffffff"; ctx.setLineDash([5, 4]); ctx.lineWidth = 2.5; K.roundRect(ctx, x - 2, y - 2, w + 3, h + 3, w * 0.13); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  }
  G.anims = G.anims.filter((a) => a.t < 0.34);
  if (G.shake) { G.shake.t += dt; if (G.shake.t > 0.3) G.shake = null; }
  PARTS.update(dt); PARTS.draw(ctx);
}
function shake(i) { G.shake = { i, t: 0 }; }
function hitTile(px, py) {
  if (!G) return -1; const list = drawOrder(), w = T.ux * 2, h = T.uy * 2;
  for (let k = list.length - 1; k >= 0; k--) { const i = list[k]; if (!G.alive[i]) continue; const { x, y } = tileXY(i); if (px >= x && px < x + w && py >= y && py < y + h) return i; }
  return -1;
}

/* ================= input ================= */
cv.addEventListener("pointerdown", (e) => { if (!G || K.ui.active()) return; K.audio(); G.cursor = -1; const i = hitTile(e.clientX, e.clientY); if (i >= 0) pick(i); else if (G.sel >= 0) { G.sel = -1; } });
function moveCursor(dx, dy) {
  if (!G || G.won) return;
  const free = []; for (let i = 0; i < G.pos.length; i++) if (freeOf(i)) free.push(i);
  if (!free.length) return;
  if (G.cursor < 0 || !G.alive[G.cursor]) { G.cursor = free[0]; K.sfx("move"); return; }
  const c = tileXY(G.cursor); let best = -1, bs = Infinity;
  for (const i of free) { if (i === G.cursor) continue; const p = tileXY(i), vx = p.x - c.x, vy = p.y - c.y, along = vx * dx + vy * dy; if (along <= 2) continue; const perp = Math.abs(vx * dy) + Math.abs(vy * dx), s = along + perp * 2.2; if (s < bs) { bs = s; best = i; } }
  if (best >= 0) { G.cursor = best; K.sfx("move"); }
}
addEventListener("keydown", (e) => {
  if (!G || K.ui.active()) return;
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); return undo(); }
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.code];
  if (dir) { e.preventDefault(); moveCursor(dir[0], dir[1]); return; }
  if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); if (G.cursor >= 0) pick(G.cursor); else moveCursor(1, 0); }
  else if (e.code === "KeyH") hint(); else if (e.code === "KeyS") shuffle(); else if (e.code === "KeyU") undo();
  else if (e.code === "Escape") { if (G.sel >= 0) { G.sel = -1; K.sfx("back"); } else menu(); }
});
function pollPad() {
  const P = K.pad; if (!P.connected || !G || K.ui.active()) return; const pr = P.pressed;
  if (pr.du) moveCursor(0, -1); if (pr.dd) moveCursor(0, 1); if (pr.dl) moveCursor(-1, 0); if (pr.dr) moveCursor(1, 0);
  if (pr.a) { if (G.cursor >= 0) pick(G.cursor); else moveCursor(1, 0); } if (pr.b) G.sel = -1; if (pr.y) hint(); if (pr.x) shuffle(); if (pr.lb) undo(); if (pr.start) menu();
}
$("#menuBtn").onclick = () => menu(); $("#hintBtn").onclick = () => hint(); $("#undoBtn").onclick = () => undo(); $("#shufBtn").onclick = () => shuffle();

/* ================= audio ================= */
K.defineSfx({
  select: (t) => { K.noise(t, 0.04, { filter: "bandpass", freq: 2600, q: 2, vol: 0.09 }); K.voice(1046, t, 0.05, { type: "sine", vol: 0.03 }); },
  match: (t) => { K.noise(t, 0.05, { filter: "bandpass", freq: 2200, q: 2, vol: 0.1 }); K.notes(t + 0.02, [784, 1175], 0.07, { type: "triangle", vol: 0.05, len: 0.3 }); },
  match2: (t) => { K.noise(t, 0.05, { filter: "bandpass", freq: 2200, q: 2, vol: 0.1 }); K.notes(t + 0.02, [880, 1318, 1760], 0.06, { type: "triangle", vol: 0.05, len: 0.32 }); },
  blocked: (t) => K.noise(t, 0.08, { filter: "lowpass", freq: 600, vol: 0.12 }),
  shuffle: (t) => { for (let i = 0; i < 16; i++) K.noise(t + i * 0.025, 0.035, { filter: "bandpass", freq: 1800 + Math.random() * 1500, q: 2, vol: 0.05 }); },
  undo: (t) => K.voice(600, t, 0.1, { type: "sine", vol: 0.04, slide: 0.7 }),
  hint: (t) => K.notes(t, [988, 1318], 0.07, { type: "sine", vol: 0.045, len: 0.25 }),
  intro: (t) => { for (let i = 0; i < 10; i++) K.noise(t + i * 0.05, 0.04, { filter: "bandpass", freq: 2400, q: 2, vol: 0.05 }); },
}, { select: 0.03 });
K.songs({ garden: { bpm: 72, chords: ["C", "Am", "F", "G", "C", "Em", "F", "G"], pad: true, padVol: 0.02, arp: true, arpVol: 0.016, arpPat: [0, 2, 1, 2], arpWave: "triangle", bass: "R . . . . . . . F . . . . . . .", bassVol: 0.08,
  leadWave: "triangle", leadVol: 0.035, lead: ["e5 - g5 - a5 - - -", "c6 - a5 - g5 - - -", "a5 - g5 - e5 - d5 -", "d5 - - - - - - -", "e5 - g5 - c6 - a5 -", "g5 - e5 - d5 - - -", "c5 - d5 - e5 - g5 -", "d5 - - - - - . ."] } });

/* ================= screens ================= */
function thumb(li) {
  const pos = MJ.LAYOUTS[li].build(); let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, maxZ = 0; for (const [x, y, z] of pos) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z); }
  const u = 7, c = document.createElement("canvas"); c.width = (maxX - minX + 2) * u + maxZ * 2 + 4; c.height = (maxY - minY + 2) * u * 1.3 + maxZ * 2 + 4; const g = c.getContext("2d");
  pos.map((p, i) => i).sort((a, b) => pos[a][2] - pos[b][2] || pos[a][1] - pos[b][1]).forEach((i) => { const [x, y, z] = pos[i], px = (x - minX) * u - z * 2 + maxZ * 2, py = (y - minY) * u * 1.3 - z * 2 + maxZ * 2; g.fillStyle = "#1b5c45"; g.fillRect(px + 1.5, py + 1.5, u * 2 - 1, u * 2.6 - 1); g.fillStyle = `hsl(45,${30 + z * 8}%,${86 - z * 4}%)`; g.fillRect(px, py, u * 2 - 1, u * 2.6 - 1); });
  return c.toDataURL();
}
let THUMBS = null;
function title() {
  if (G && !G.won) saveCur(); G = null; $("#bar").hidden = true; K.playSong("garden", 1);
  THUMBS = THUMBS || MJ.LAYOUTS.map((_, i) => thumb(i));
  const cur = SAVE.cur && MJ.LAYOUTS[SAVE.cur.li], dd = SAVE.daily.date === K.today(), dli = K.dailySeed("jade-layout") % MJ.LAYOUTS.length;
  const tiles = MJ.LAYOUTS.map((Ly, i) => { const st = SAVE.stats[Ly.id]; return `<button class="k-btn lay" data-a="play" data-i="${i}"><img src="${THUMBS[i]}" alt=""><b>${Ly.name}</b><span>${Ly.desc}</span><em>${st.best ? "Best " + K.fmtTime(st.best / 1000) : st.won ? `Cleared ${st.won}×` : "Not cleared yet"}</em></button>`; }).join("");
  K.ui.show(`<div class="logo">J<span>A</span>DE</div><p class="k-sub">Mahjong solitaire. Match free tiles in pairs until the board is clear.</p>
    <div class="k-row">${cur ? `<button class="k-btn primary" data-a="continue" autofocus>Continue ${cur.name} · ${SAVE.cur.alive.split("").filter((v) => v === "1").length / 2} pairs left</button>` : ""}<button class="k-btn ${cur ? "" : "primary"}" data-a="daily" ${cur ? "" : "autofocus"}>Daily deal · ${MJ.LAYOUTS[dli].name}${dd ? " · solved in " + K.fmtTime(SAVE.daily.time) : ""}</button></div>
    <div class="layouts">${tiles}</div>
    <div class="k-row"><button class="k-btn" data-a="stats">Stats</button><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>`, { cls: "soft" });
}
function menu() {
  if (!G || G.won) return;
  K.ui.show(`<div class="logo" style="font-size:2.6em">Paused</div><p class="k-sub">${G.L.name} · ${K.fmtTime(G.time)} · ${pairsLeft()} pairs left</p>
    <div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="restart">Restart this deal</button><button class="k-btn" data-a="newdeal">New deal</button><button class="k-btn" data-a="settings" data-from="menu">Settings</button><button class="k-btn" data-a="help" data-from="menu">How to play</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "resume" });
}
function results() {
  const st = SAVE.stats[G.L.id];
  K.ui.show(`<div class="logo" style="font-size:2.8em">Cleared!</div><p class="k-sub">${G.L.name}${G.daily ? " · daily deal" : ""}</p>
    <div class="k-stats"><div class="k-stat"><small>Time</small><b>${K.fmtTime(G.time)}</b></div><div class="k-stat"><small>Hints</small><b>${G.hints}</b></div><div class="k-stat"><small>Shuffles</small><b>${G.shuffles}</b></div><div class="k-stat"><small>Best</small><b>${st.best ? K.fmtTime(st.best / 1000) : "–"}</b></div></div>
    ${G.pb ? `<b style="color:var(--gold)">New best time!</b>` : G.hints || G.shuffles ? `<p class="k-sub">Best times only count games without hints or shuffles.</p>` : ""}
    <div class="k-row"><button class="k-btn primary" data-a="newdeal" autofocus>Next deal</button>${G.daily ? `<button class="k-btn" data-a="share">Copy result</button>` : ""}<button class="k-btn" data-a="title">Main menu</button></div><div class="k-msg" id="msg"></div>`, { back: "title", cls: "soft" });
}
function settings(from) {
  const back = from === "menu" ? "menu" : "title", o = SAVE.opts, row = (k, l) => `<div class="k-opt"><span>${l}</span><button class="k-btn small" data-a="tog" data-k="${k}">${o[k] ? "On" : "Off"}</button></div>`;
  const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div><div class="k-panel" style="width:min(100%,32em);display:flex;flex-direction:column;align-items:center">${row("dim", "Shade tiles that can't be picked")}${row("labels", "Small labels on tile corners")}${K.ui.settingsRows()}</div>`, { back, cls: "top" });
  K.ui.bindSettings(s);
}
function statsScreen() {
  const rows = MJ.LAYOUTS.map((Ly) => { const s = SAVE.stats[Ly.id]; return `<tr><td>${Ly.name}</td><td>${s.played}</td><td>${s.won}</td><td>${s.best ? K.fmtTime(s.best / 1000) : "–"}</td></tr>`; }).join("");
  K.ui.show(`<div class="k-bar"><h2>Stats</h2><button class="k-btn" data-a="title" autofocus>Back</button></div><div class="k-panel" style="width:min(100%,32em)"><table class="st"><tr><th>Layout</th><th>Played</th><th>Cleared</th><th>Best time</th></tr>${rows}</table></div>`, { back: "title", cls: "top" });
}
function help(from) {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="${from === "menu" ? "menu" : "title"}" autofocus>Back</button></div>
    <div class="k-help">
      <div><b>Matching</b>Pick two identical tiles to remove them. Any flower matches any flower, and any season matches any season.</div>
      <div><b>Free tiles</b>A tile is free when nothing sits on top of it and its left or right side is open. Shaded tiles can't be picked yet.</div>
      <div><b>Every deal can be won</b>Deals are built so a full solution always exists. If you get stuck, shuffle the tiles that are left (they stay solvable) or undo.</div>
      <div><b>Tiles</b>Dots, bamboo and characters run 1 to 9. Winds are E S W N, plus three dragons, four flowers and four seasons.</div>
      <div class="k-kbonly"><b>Keys</b>Arrows move between free tiles · Enter picks · H hint · S shuffle · Ctrl+Z undo · Esc menu</div>
      <div><b>Controller</b>D-pad moves · A picks · Y hint · X shuffle · LB undo · Start menu</div>
    </div>`, { back: from === "menu" ? "menu" : "title", cls: "top" });
}
const pairsLeft = () => (G ? G.alive.reduce((a, v) => a + v, 0) / 2 : 0);
function hud() { if (!G) return; $("#iPairs").textContent = pairsLeft(); $("#iMoves").textContent = info().pairs.length; }
function intro() { order = null; const list = drawOrder(); list.forEach((i, k) => G.anims.push({ i, t: -k * 0.006, back: true })); K.sfx("intro"); }
K.ui.on((a, d, el) => {
  switch (a) {
    case "title": K.sfx("back"); return title();
    case "play": K.sfx("ok"); return start(+d.i);
    case "daily": K.sfx("ok"); return start(K.dailySeed("jade-layout") % MJ.LAYOUTS.length, { daily: true, seed: K.dailySeed("jade") });
    case "continue": K.sfx("ok"); if (!resume()) { SAVE.cur = null; persist(); title(); } return;
    case "resume": K.ui.hide(); return;
    case "restart": K.sfx("ok"); return start(G.li, { seed: G.seed, daily: G.daily });
    case "newdeal": K.sfx("ok"); return start(G ? G.li : 0);
    case "menu": return menu();
    case "settings": K.sfx("ok"); return settings(d.from);
    case "help": K.sfx("ok"); return help(d.from);
    case "stats": K.sfx("ok"); return statsScreen();
    case "tog": SAVE.opts[d.k] = !SAVE.opts[d.k]; persist(); el.textContent = SAVE.opts[d.k] ? "On" : "Off"; T.cache.clear(); K.sfx("ok"); return;
    case "share": K.copy(`JADE · daily deal ${K.today()}\nCleared in ${K.fmtTime(G.time)}${G.hints || G.shuffles ? ` (${G.hints} hints, ${G.shuffles} shuffles)` : ""}`).then((ok) => { const m = $("#msg"); if (m) m.textContent = ok ? "Copied to clipboard." : "Couldn't copy."; }); return;
  }
});
K.onPause(() => { if (G && !G.won && !K.ui.active()) menu(); });

/* ================= boot ================= */
document.fonts.load(`700 20px "Noto Serif SC"`, "一萬東中發").then(() => T.cache.clear()).catch(() => {});
layout(); title();
let saveT = 0;
K.loop((dt) => {
  pollPad();
  if (G && !G.won && G.started && !K.ui.active() && !document.hidden) { G.time += dt; saveT += dt; if (saveT > 5) { saveT = 0; saveCur(); } const t = K.fmtTime(G.time); if ($("#iTime").textContent !== t) $("#iTime").textContent = t; }
  render(dt);
});
