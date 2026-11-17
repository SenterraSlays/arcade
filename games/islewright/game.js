"use strict";
/* ISLEWRIGHT — a calm island builder. Place buildings where their neighbours make them score,
   reach score goals to unlock new building packs, and sail on to fresh islands. */
const { $, $$, clamp, TAU } = K;
const SAVE = K.load("islewright.v1", { cur: null, best: 0, games: 0, islands: 0 });
const persist = () => K.save("islewright.v1", SAVE);
const N = 22, WATER = 0, SAND = 1, GRASS = 2, FOREST = 3, ROCK = 4;
const BLD = {
  house: { name: "House", rules: [["house", 2, 1], ["market", 3, 3], ["tavern", 2, 2], ["garden", 2, 2], ["mill", 2, -3], ["quarry", 2, -3]], desc: "Likes neighbours, markets and gardens. Dislikes noisy mills and quarries." },
  market: { name: "Market", rules: [["house", 3, 2], ["fish", 3, 2], ["market", 4, -6]], desc: "Thrives among houses and fishing huts. Hates other markets nearby." },
  mill: { name: "Lumber Mill", rules: [["forest", 2, 2], ["mill", 3, -4]], desc: "Scores for every forest tile around it." },
  farm: { name: "Farm", rules: [["grass", 1, 1], ["windmill", 2, 4], ["farm", 1, 1]], desc: "Wants open grass, other farms and a windmill close by." },
  windmill: { name: "Windmill", rules: [["farm", 2, 3], ["windmill", 3, -5]], desc: "Grinds grain for every farm nearby." },
  quarry: { name: "Quarry", rules: [["rock", 2, 3], ["house", 2, -2]], req: ["rock", 1, "Needs rock right next to it."], desc: "Cuts stone from nearby rock. Must touch rock." },
  fish: { name: "Fishing Hut", rules: [["water", 1, 2], ["fish", 3, -3], ["market", 3, 2]], req: ["water", 1, "Needs water right next to it."], desc: "Scores for adjacent water. Must be on the shore." },
  lighthouse: { name: "Lighthouse", base: 2, rules: [["water", 3, 1], ["lighthouse", 7, -12]], req: ["water", 1, "Needs water right next to it."], desc: "Scores for all the sea it can see. Must be on the shore." },
  temple: { name: "Temple", rules: [["house", 3, 3], ["garden", 2, 3], ["rock", 1, 2], ["temple", 5, -10]], desc: "Draws worshippers from houses. Loves gardens and high ground." },
  tavern: { name: "Tavern", rules: [["house", 2, 2], ["fish", 3, 3], ["tavern", 4, -8]], desc: "Serves houses and thirsty fishermen." },
  garden: { name: "Garden", rules: [["house", 2, 2], ["temple", 2, 3], ["forest", 1, 1], ["mill", 2, -4], ["quarry", 2, -4]], desc: "A quiet park. Loves houses and temples, hates industry." },
  statue: { name: "Statue", rules: [["any", 2, 2], ["statue", 6, -12]], desc: "Scores for every building around it. One per district." },
};
const KINDS = Object.keys(BLD);
const PACKS = [
  { name: "Hamlet", items: { house: 3, market: 1 } }, { name: "Timber", items: { mill: 2, house: 2 } }, { name: "Harvest", items: { farm: 3, windmill: 1 } },
  { name: "Harbour", items: { fish: 2, lighthouse: 1, tavern: 1 } }, { name: "Highlands", items: { quarry: 2, temple: 1, house: 1 } }, { name: "Leisure", items: { garden: 2, tavern: 1, house: 1 } },
  { name: "Monuments", items: { statue: 1, temple: 1, garden: 1 } }, { name: "Township", items: { house: 4, market: 1 } }, { name: "Coastline", items: { fish: 2, market: 1, house: 1 } },
];
const STARTER = { house: 3, mill: 1, fish: 1, farm: 2 };
const TCOL = { [SAND]: ["#f4e2a8", "#ddc485", "#cbb074"], [GRASS]: ["#94d36c", "#6faa4e", "#5f9542"], [FOREST]: ["#7cc25c", "#6faa4e", "#5f9542"], [ROCK]: ["#b4ada3", "#948d84", "#827b73"] };

/* ================= island generation ================= */
function valueNoise(rng, cells) {
  const g = Array.from({ length: (cells + 1) * (cells + 1) }, () => rng()), at = (x, y) => g[y * (cells + 1) + x], sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi), a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
}
function genIsland(seed) {
  for (let tries = 0; ; tries++) {
    const rng = K.RNG(K.hash(seed + ":" + tries)), n1 = valueNoise(rng, 8), n2 = valueNoise(rng, 8), n3 = valueNoise(rng, 8), tiles = new Uint8Array(N * N), hts = new Uint8Array(N * N);
    const ox = rng() * 2, oy = rng() * 2; let land = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (x - (N - 1) / 2) / (N / 2), dy = (y - (N - 1) / 2) / (N / 2), d = Math.hypot(dx, dy) * (0.9 + 0.2 * n3((x / N) * 3 + 4, (y / N) * 3 + 4));
      const h = n1((x / N) * 4 + ox, (y / N) * 4 + oy) * 0.55 + (1 - d) * 0.8 - 0.12, i = y * N + x;
      let t = h < 0.32 || d > 0.98 ? WATER : h < 0.39 ? SAND : h > 0.7 ? ROCK : GRASS;
      if (t === GRASS && n2((x / N) * 5, (y / N) * 5) > 0.6) t = FOREST;
      tiles[i] = t; hts[i] = t === WATER ? 0 : t === SAND ? 1 : t === ROCK ? 2 + (h > 0.78 ? 1 : 0) + (h > 0.86 ? 1 : 0) : 1 + (h > 0.55 ? 1 : 0);
      if (t !== WATER) land++;
    }
    const rock = tiles.filter((t) => t === ROCK).length, forest = tiles.filter((t) => t === FOREST).length;
    if ((land >= 150 && land <= 300 && rock >= 4 && forest >= 10) || tries > 40) return { tiles, hts };
  }
}

/* ================= state ================= */
let G = null, MODE = "title", T = 0, cursor = null, hover = null, pending = [], fx = [], dirty = true, demoT = 0;
const tAt = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? WATER : G.tiles[y * N + x]);
const hAt = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : G.hts[y * N + x]);
const bAt = (x, y) => G.blds.find((b) => b.x === x && b.y === y);
function newGame() {
  SAVE.games++; const seed = String((Math.random() * 1e9) | 0);
  G = { seed, island: 1, ...genIsland(seed), blds: [], hand: { ...STARTER }, score: 0, next: 20, step: 22, unlocks: 0, islandUnlocks: 0, sel: "house", undo: null, done: false };
  start(); persistGame(); K.banner("Island 1", "Place buildings where their neighbours make them shine", 2600);
}
function persistGame() { if (!G || G.done) return; SAVE.cur = { ...G, tiles: Array.from(G.tiles).join(""), hts: Array.from(G.hts).join(""), undo: null }; persist(); }
function loadGame() { const c = SAVE.cur; G = { ...c, tiles: Uint8Array.from(c.tiles, Number), hts: Uint8Array.from(c.hts, Number), undo: null }; start(); if (G.pending) showPack(); }
function start() {
  MODE = "play"; K.ui.hide(); $("#top").hidden = false; $("#hand").hidden = false; $("#menuBtn").hidden = false; fitView(); cursor = { x: N >> 1, y: N >> 1 }; hover = null;
  if (!G.hand[G.sel]) G.sel = KINDS.find((k) => G.hand[k]) || null; buildHand(); hud(); K.playSong("calm", 1); tip();
}

/* ================= scoring ================= */
function match(target, x, y) {
  const b = bAt(x, y), t = tAt(x, y);
  if (target === "any") return !!b; if (BLD[target]) return !!b && b.k === target;
  if (b) return false; if (target === "water") return t === WATER; if (target === "forest") return t === FOREST; if (target === "grass") return t === GRASS; if (target === "rock") return t === ROCK; return false;
}
function within(x, y, r, fn) { for (let ty = y - r; ty <= y + r; ty++) for (let tx = x - r; tx <= x + r; tx++) { if (tx === x && ty === y) continue; if (Math.hypot(tx - x, ty - y) <= r + 0.42) fn(tx, ty); } }
function scoreAt(k, x, y) {
  const B = BLD[k]; let total = B.base || 0; const parts = [], marks = new Map();
  for (const [target, r, pts] of B.rules) { let n = 0; within(x, y, r, (tx, ty) => { if (match(target, tx, ty)) { n++; const key = tx + "," + ty; marks.set(key, (marks.get(key) || 0) + pts); } }); if (n) { total += n * pts; parts.push({ target, n, pts }); } }
  return { total, parts, marks };
}
function canPlace(k, x, y) {
  if (x < 0 || y < 0 || x >= N || y >= N || tAt(x, y) === WATER) return "Buildings need dry land.";
  if (bAt(x, y)) return "That spot is already taken.";
  const req = BLD[k].req; if (req) { let ok = false; within(x, y, req[1], (tx, ty) => { if (tAt(tx, ty) === (req[0] === "water" ? WATER : ROCK)) ok = true; }); if (!ok) return req[2]; }
  return null;
}
const TNAME = { water: "water tile", forest: "forest tile", grass: "open grass tile", rock: "rock tile", any: "building" };
const pname = (t, n) => (BLD[t] ? BLD[t].name + (n > 1 ? "s" : "") : TNAME[t] + (n > 1 ? "s" : ""));

/* ================= placing & progression ================= */
function place(x, y) {
  if (MODE !== "play" || !G.sel || !G.hand[G.sel]) return;
  const k = G.sel, bad = canPlace(k, x, y); if (bad) { K.sfx("deny"); tip(bad); return; }
  const s = scoreAt(k, x, y), prevT = tAt(x, y);
  if (prevT === FOREST) G.tiles[y * N + x] = GRASS;
  G.blds.push({ x, y, k, t0: T }); G.hand[k]--; G.score += s.total; G.undo = { x, y, k, prevT, pts: s.total };
  floatText(x, y, (s.total >= 0 ? "+" : "") + s.total, s.total > 0 ? "#2fa866" : s.total < 0 ? "#d94a4a" : "#5a6f80", true);
  for (let i = 0; i < 14; i++) fx.push({ kind: "spark", x, y, a: Math.random() * TAU, v: 0.6 + Math.random(), t: 0, life: 0.6 + Math.random() * 0.3 });
  K.sfx(s.total >= 8 ? "great" : s.total > 0 ? "place" : "meh"); if (s.total > 0) setTimeout(() => chime(s.total), 90);
  if (!G.hand[k]) G.sel = KINDS.find((kk) => G.hand[kk]) || null;
  buildHand(); hud(); checkProgress(); persistGame(); tip();
}
function undo() {
  if (MODE !== "play" || !G.undo) return; const u = G.undo; G.undo = null;
  G.blds = G.blds.filter((b) => !(b.x === u.x && b.y === u.y)); G.tiles[u.y * N + u.x] = u.prevT; G.hand[u.k] = (G.hand[u.k] || 0) + 1; G.score -= u.pts; G.sel = u.k;
  K.sfx("undo"); buildHand(); hud(); persistGame(); tip();
}
function checkProgress() {
  if (G.score >= G.next) { G.undo = null; return unlock(); }
  const left = KINDS.reduce((s, k) => s + (G.hand[k] || 0), 0);
  if (!left) gameOver();
}
function unlock() {
  G.unlocks++; G.islandUnlocks++; const reached = G.next; G.next += G.step; G.step += 7; K.sfx("unlock");
  for (let i = 0; i < 30; i++) fx.push({ kind: "confetti", sx: Math.random(), t: 0, life: 2 + Math.random(), c: K.pick(["#ff9f43", "#2fa866", "#4ab0ff", "#e0a020", "#ff6b9a"]), r: Math.random() * TAU });
  G.pending = { reached, offer: K.shuffle(PACKS.slice()).slice(0, 2).map((p) => p.name), sail: G.islandUnlocks >= 4 }; showPack();
}
function showPack() {
  MODE = "pack"; G.undo = null; hud(); const { reached, offer, sail } = G.pending, opts = offer.map((n) => PACKS.find((p) => p.name === n)); G.offer = offer;
  const its = (items) => Object.entries(items).map(([k, n]) => `<span><img src="${iconURL(k)}" alt="" width="32" height="32">${n}× ${BLD[k].name}</span>`).join("");
  K.ui.show(`<div class="logo sm">Score ${reached} reached!</div><p class="k-sub">Choose a new pack of buildings. Next goal: ${G.next}.</p><div class="packs">${opts.map((p, i) => `<button class="k-btn pack" data-a="pack" data-i="${i}"${i ? "" : " autofocus"}><b>${p.name}</b><div class="its">${its(p.items)}</div></button>`).join("")}${sail ? `<button class="k-btn pack sail" data-a="sail"><b>⛵ Set sail</b><small>Leave for a fresh island with a new starter pack. Unplaced buildings stay behind.</small></button>` : ""}</div>`, { cls: "soft" });
}
function takePack(i) {
  const p = PACKS.find((x) => x.name === G.offer[i]); for (const [k, n] of Object.entries(p.items)) G.hand[k] = (G.hand[k] || 0) + n;
  if (!G.sel || !G.hand[G.sel]) G.sel = Object.keys(p.items)[0];
  G.pending = null; MODE = "play"; K.ui.hide(); buildHand(); hud(); persistGame(); K.sfx("ok"); if (G.score >= G.next) unlock(); else tip();
}
function setSail() {
  G.pending = null; G.island++; SAVE.islands++; G.islandUnlocks = 0; const seed = G.seed + ":" + G.island; Object.assign(G, genIsland(seed)); G.blds = []; G.hand = { ...STARTER, house: STARTER.house + 1 }; G.sel = "house"; G.undo = null;
  MODE = "play"; K.ui.hide(); fitView(); buildHand(); hud(); persistGame(); K.sfx("sail"); K.banner(`Island ${G.island}`, "A fresh shore, the same ambitions", 2400); tip();
}
function gameOver() {
  MODE = "over"; G.done = true; SAVE.cur = null; const best = G.score > SAVE.best; if (best) SAVE.best = G.score; persist(); K.sfx("over");
  setTimeout(() => K.ui.show(`<div class="logo sm">${best ? "New best score!" : "Your islands are complete"}</div><p class="k-sub">You placed every building you had, ${G.next - G.score} points short of the next pack.</p><div class="k-stats" style="width:min(100%,28em)">${[["Score", G.score], ["Islands", G.island], ["Buildings", G.blds.length], ["Best", SAVE.best]].map(([a, b]) => `<div class="k-stat"><small>${a}</small><b>${b}</b></div>`).join("")}</div><div class="k-row"><button class="k-btn primary" data-a="new" autofocus>New game</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "title", cls: "soft" }), 900);
}

/* ================= view & projection ================= */
const cv = $("#cv"), ctx = cv.getContext("2d"); let CW = 0, CH = 0, DPR = 1, Z = 1, ZFIT = 1, PX = 0, PY = 0, TW = 64, TH = 32, HZ = 10;
function resize() { CW = innerWidth; CH = innerHeight; K.fit(cv, CW, CH); DPR = K.dpr(); fitView(true); }
addEventListener("resize", resize);
function fitView(keep) { const fit = Math.min((CW * 0.94) / (N * 64), (CH - (CW < 640 ? 230 : 190)) / (N * 32 + 40)); if (!keep || !ZFIT) { Z = Math.max(fit, MODE === "play" && CW < 640 ? 0.55 : 0); PX = 0; PY = 0; } else Z *= fit / ZFIT; ZFIT = fit; setScale(); }
function setScale() { TW = 64 * Z; TH = 32 * Z; HZ = 9 * Z; }
const origin = () => [CW / 2 + PX, CH / 2 - ((N - 1) * TH) / 2 + PY + (CW < 640 ? -24 : -8)];
function tileCenter(x, y) { const [ox, oy] = origin(); return [ox + ((x - y) * TW) / 2, oy + ((x + y) * TH) / 2 - hAt(x, y) * HZ]; }
function pick(px, py) {
  let best = null;
  for (let s = 2 * N - 2; s >= 0; s--) for (let x = Math.min(N - 1, s); x >= Math.max(0, s - N + 1); x--) { const y = s - x, [cx, cy] = tileCenter(x, y); if (Math.abs(px - cx) / (TW / 2) + Math.abs(py - cy) / (TH / 2) <= 1) return { x, y }; void best; }
  return null;
}

/* ================= drawing ================= */
function poly(g, pts, fill, stroke) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } }
function isoP(x, y, u, v, h, tw = TW, th = TH) { return [x + ((u - v) * tw) / 2, y + ((u + v) * th) / 2 - h]; }
function box(g, x, y, a, b, h, z, cT, cL, cR, tw = TW, th = TH) {
  const P = (u, v, hh) => isoP(x, y, u, v, z + hh, tw, th);
  poly(g, [P(-a, b, 0), P(a, b, 0), P(a, b, h), P(-a, b, h)], cL); poly(g, [P(a, -b, 0), P(a, b, 0), P(a, b, h), P(a, -b, h)], cR); poly(g, [P(-a, -b, h), P(a, -b, h), P(a, b, h), P(-a, b, h)], cT);
}
function gable(g, x, y, a, b, z, rh, c1, c2, tw = TW, th = TH) { const P = (u, v, hh) => isoP(x, y, u, v, z + hh, tw, th); poly(g, [P(-a, b, 0), P(a, b, 0), P(a, 0, rh), P(-a, 0, rh)], c1); poly(g, [P(a, -b, 0), P(a, b, 0), P(a, 0, rh)], c2); }
function pyramid(g, x, y, a, b, z, rh, c1, c2, tw = TW, th = TH) { const P = (u, v, hh) => isoP(x, y, u, v, z + hh, tw, th), ap = P(0, 0, rh); poly(g, [P(-a, b, 0), P(a, b, 0), ap], c1); poly(g, [P(a, -b, 0), P(a, b, 0), ap], c2); }
function drawTile(x, y, ghost) {
  const t = tAt(x, y), h = hAt(x, y), [cx, cy] = tileCenter(x, y), hw = TW / 2, hh = TH / 2;
  if (t === WATER) { const s = 0.5 + 0.5 * Math.sin(T * 1.4 + x * 0.7 + y * 0.45), deep = Math.min(1, distLand(x, y) / 3); poly(ctx, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], `hsl(${196 - deep * 6}, ${62 + deep * 6}%, ${62 - deep * 14 + s * 3}%)`); if (deep < 0.4) { ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.2 * s})`; ctx.lineWidth = 1.2 * Z; ctx.beginPath(); ctx.moveTo(cx - hw * 0.5, cy + 1); ctx.lineTo(cx + hw * 0.3, cy + 1); ctx.stroke(); } return; }
  const c = TCOL[t], vary = ((x * 73 + y * 151) % 7) / 100 - 0.03, side = h * HZ;
  poly(ctx, [[cx - hw, cy], [cx, cy + hh], [cx, cy + hh + side], [cx - hw, cy + side]], c[1]);
  poly(ctx, [[cx + hw, cy], [cx, cy + hh], [cx, cy + hh + side], [cx + hw, cy + side]], c[2]);
  poly(ctx, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], shade(c[0], vary));
  if (t === ROCK) { ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.moveTo(cx - hw * 0.3, cy); ctx.lineTo(cx, cy - hh * 0.6); ctx.lineTo(cx + hw * 0.25, cy - hh * 0.1); ctx.closePath(); ctx.fill(); if (h >= 3) { poly(ctx, [[cx - hw * 0.35, cy + hh * 0.2], [cx - hw * 0.05, cy - TH * 0.7], [cx + hw * 0.3, cy + hh * 0.2]], "#c9c3ba"); poly(ctx, [[cx - hw * 0.05, cy - TH * 0.7], [cx + hw * 0.3, cy + hh * 0.2], [cx + hw * 0.05, cy + hh * 0.35]], "#a39c93"); if (h >= 4) poly(ctx, [[cx - hw * 0.15, cy - TH * 0.35], [cx - hw * 0.05, cy - TH * 0.7], [cx + hw * 0.08, cy - TH * 0.38]], "#fff"); } }
  if (t === FOREST && !bAt(x, y)) { const r = K.RNG(x * 31 + y * 97); for (let k = 0; k < 3; k++) { const ux = (r() - 0.5) * 0.5, vy = (r() - 0.5) * 0.5, [tx, ty] = isoP(cx, cy, ux, vy, 0), s = (0.55 + r() * 0.35) * Z; tree(tx, ty, s, k); } }
  if (t === SAND && ((x * 7 + y * 13) % 9 === 0)) { ctx.fillStyle = "rgba(0,0,0,.08)"; ctx.beginPath(); ctx.ellipse(cx + hw * 0.2, cy, 3 * Z, 1.5 * Z, 0, 0, TAU); ctx.fill(); }
  void ghost;
}
function tree(x, y, s, k) { ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(x, y, 7 * s, 3 * s, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#7a5030"; ctx.fillRect(x - 1.5 * s, y - 6 * s, 3 * s, 6 * s); poly(ctx, [[x - 8 * s, y - 5 * s], [x, y - 26 * s], [x + 8 * s, y - 5 * s]], k % 2 ? "#3f8f46" : "#4a9e4e"); poly(ctx, [[x, y - 26 * s], [x + 8 * s, y - 5 * s], [x + 2 * s, y - 5 * s]], k % 2 ? "#357a3b" : "#3d8842"); }
function shade(hex, d) { const n = parseInt(hex.slice(1), 16), f = (v) => clamp(Math.round(v * (1 + d)), 0, 255); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
const DL = new Map();
function distLand(x, y) { if (DL.size > 6000) DL.clear(); const key = G.seed + ":" + G.island + ":" + x + "," + y; if (DL.has(key)) return DL.get(key); let d = 9; for (let r = 1; r <= 3 && d === 9; r++) within(x, y, r, (tx, ty) => { if (tAt(tx, ty) !== WATER) d = Math.min(d, r); }); DL.set(key, d); return d; }
/* buildings, drawn at a tile centre (x, y) on the top face, scale z */
function drawBld(g, k, x, y, z, t = 0, tw = 64 * z, th = 32 * z) {
  const B = (a, b, h, zz, cT, cL, cR) => box(g, x, y, a, b, h * z, zz * z, cT, cL, cR, tw, th), Gb = (a, b, zz, rh, c1, c2) => gable(g, x, y, a, b, zz * z, rh * z, c1, c2, tw, th), Py = (a, b, zz, rh, c1, c2) => pyramid(g, x, y, a, b, zz * z, rh * z, c1, c2, tw, th);
  const P = (u, v, h) => isoP(x, y, u, v, h * z, tw, th);
  g.fillStyle = "rgba(0,0,0,.16)"; g.beginPath(); g.ellipse(x, y + 2 * z, tw * 0.3, th * 0.3, 0, 0, TAU); g.fill();
  if (k === "house") { B(0.26, 0.22, 13, 0, "#fff2dc", "#f0d8b4", "#dcc097"); poly(g, [P(-0.05, 0.22, 0), P(0.07, 0.22, 0), P(0.07, 0.22, 7), P(-0.05, 0.22, 7)], "#7a4a2a"); poly(g, [P(0.26, -0.12, 6), P(0.26, 0.0, 6), P(0.26, 0.0, 10), P(0.26, -0.12, 10)], "#8ac8e8"); Gb(0.3, 0.27, 13, 11, "#d8553f", "#b8402e"); }
  else if (k === "market") { B(0.3, 0.3, 7, 0, "#f6e4c4", "#e2c99c", "#cfb382"); for (let i = 0; i < 4; i++) { const u0 = -0.32 + i * 0.16; poly(g, [P(u0, 0.32, 11), P(u0 + 0.16, 0.32, 11), P(u0 + 0.16, 0.18, 15), P(u0, 0.18, 15)], i % 2 ? "#fff" : "#e8504a"); } for (const [u, v, c] of [[-0.12, 0.42, "#c88a4a"], [0.12, 0.42, "#e0b060"]]) box(g, ...isoP(x, y, u, v, 0, tw, th), 0.08, 0.06, 5 * z, 0, c, shade(c, -0.15), shade(c, -0.25), tw, th); }
  else if (k === "mill") { B(0.28, 0.2, 12, 0, "#a8744a", "#8a5a34", "#764a2a"); Py(0.3, 0.24, 12, 6, "#6a4a3a", "#57392b"); for (let i = 0; i < 3; i++) { const [lx, ly] = P(-0.2 + i * 0.12, 0.38, 2.5); g.fillStyle = "#c8945a"; g.beginPath(); g.ellipse(lx, ly, 4 * z, 2.6 * z, 0, 0, TAU); g.fill(); g.fillStyle = "#e8c08a"; g.beginPath(); g.ellipse(lx + 3 * z, ly, 1.6 * z, 2.2 * z, 0, 0, TAU); g.fill(); } const [sx, sy] = P(0.29, 0, 8); g.save(); g.translate(sx, sy); g.rotate(t * 3); g.strokeStyle = "#ccd"; g.lineWidth = 1.5 * z; g.beginPath(); g.arc(0, 0, 4 * z, 0, TAU); g.stroke(); for (let i = 0; i < 6; i++) { g.rotate(TAU / 6); g.beginPath(); g.moveTo(4 * z, 0); g.lineTo(5.5 * z, 0); g.stroke(); } g.restore(); }
  else if (k === "farm") { for (let i = 0; i < 5; i++) { const v0 = -0.42 + i * 0.17; poly(g, [P(-0.42, v0, 0.5), P(0.18, v0, 0.5), P(0.18, v0 + 0.13, 0.5), P(-0.42, v0 + 0.13, 0.5)], i % 2 ? "#e9c95a" : "#c8b048"); } const [bx, by] = P(0.3, 0.25, 0); box(g, bx, by, 0.13, 0.13, 10 * z, 0, "#e8604a", "#c8483a", "#a83a30", tw, th); gable(g, bx, by, 0.15, 0.15, 10 * z, 6 * z, "#8a3a2a", "#6a2a20", tw, th); }
  else if (k === "windmill") { B(0.14, 0.14, 26, 0, "#f0e2c8", "#ddc8a4", "#c8b08c"); Py(0.17, 0.17, 26, 9, "#7a4a3a", "#5a3428"); const [hx, hy] = P(0.15, 0.15, 21); g.save(); g.translate(hx, hy); g.rotate(t * 1.6); for (let i = 0; i < 4; i++) { g.rotate(TAU / 4); g.fillStyle = "#fff8ec"; g.fillRect(1 * z, -1.6 * z, 15 * z, 3.2 * z); g.strokeStyle = "#8a6a4a"; g.lineWidth = 0.8 * z; g.strokeRect(1 * z, -1.6 * z, 15 * z, 3.2 * z); } g.fillStyle = "#5a3428"; g.beginPath(); g.arc(0, 0, 2.2 * z, 0, TAU); g.fill(); g.restore(); }
  else if (k === "quarry") { poly(g, [P(-0.35, -0.3, 0.3), P(0.15, -0.3, 0.3), P(0.15, 0.2, 0.3), P(-0.35, 0.2, 0.3)], "#6a6560"); for (const [u, v, h] of [[0.25, 0.25, 6], [0.05, 0.32, 4], [0.32, 0.0, 5], [0.18, 0.12, 9]]) box(g, ...isoP(x, y, u, v, 0, tw, th), 0.08, 0.08, h * z, 0, "#d2ccc2", "#b2aba2", "#9a938a", tw, th); const [px, py] = P(-0.1, -0.05, 1); g.strokeStyle = "#8a5a2a"; g.lineWidth = 1.6 * z; g.beginPath(); g.moveTo(px - 6 * z, py + 3 * z); g.lineTo(px + 4 * z, py - 9 * z); g.stroke(); g.fillStyle = "#aab"; g.beginPath(); g.moveTo(px + 4 * z, py - 9 * z); g.lineTo(px + 9 * z, py - 6 * z); g.lineTo(px + 2 * z, py - 7 * z); g.fill(); }
  else if (k === "fish") { B(0.2, 0.17, 10, 0, "#c8a07a", "#a87e58", "#946a48"); Py(0.24, 0.2, 10, 8, "#5a7a9a", "#48647e"); for (let i = 0; i < 4; i++) box(g, ...isoP(x, y, 0.32 + i * 0.11, 0.05, 0, tw, th), 0.055, 0.12, 2 * z, 0, "#b08a5a", "#8a6a44", "#7a5a38", tw, th); const [nx, ny] = P(-0.3, 0.3, 4); g.strokeStyle = "rgba(60,60,60,.6)"; g.lineWidth = 0.8 * z; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(nx - 4 * z, ny - i * 2.5 * z); g.lineTo(nx + 4 * z, ny - i * 2.5 * z); g.stroke(); } }
  else if (k === "lighthouse") { for (let i = 0; i < 5; i++) B(0.13 - i * 0.008, 0.13 - i * 0.008, 8, i * 8, i % 2 ? "#e8e8f0" : "#e05040", i % 2 ? "#d0d0da" : "#c03a2e", i % 2 ? "#babac6" : "#a83228"); B(0.1, 0.1, 6, 40, "#ffe9a0", "#ffd860", "#f0c040"); Py(0.12, 0.12, 46, 7, "#3a3a4a", "#2a2a36"); const [lx, ly] = P(0, 0, 43); const a = 0.55 + 0.45 * Math.sin(t * 2.4); K.drawGlow(g, lx, ly, 26 * z, "255,230,140", a); }
  else if (k === "temple") { B(0.36, 0.36, 4, 0, "#f2ede4", "#dcd4c6", "#c8bfb0"); for (const [u, v] of [[-0.26, 0.26], [0, 0.26], [0.26, 0.26], [0.26, 0], [0.26, -0.26], [-0.26, -0.26], [0, -0.26], [-0.26, 0]]) box(g, ...isoP(x, y, u, v, 4 * z, tw, th), 0.035, 0.035, 14 * z, 0, "#fff", "#e6e0d6", "#d0c8bc", tw, th); B(0.34, 0.34, 3, 18, "#f2ede4", "#dcd4c6", "#c8bfb0"); Gb(0.36, 0.36, 21, 9, "#c9a86a", "#ae8f55"); }
  else if (k === "tavern") { B(0.32, 0.26, 16, 0, "#f0dcb8", "#d8bc90", "#c4a87c"); poly(g, [P(-0.08, 0.26, 0), P(0.06, 0.26, 0), P(0.06, 0.26, 8), P(-0.08, 0.26, 8)], "#6a3a1a"); for (const v of [-0.15, 0.05]) poly(g, [P(0.32, v, 8), P(0.32, v + 0.1, 8), P(0.32, v + 0.1, 12), P(0.32, v, 12)], "#ffd27a"); Gb(0.36, 0.3, 16, 12, "#6a4a8a", "#553a72"); const [sx, sy] = P(0.1, 0.4, 12); g.fillStyle = "#6a3a1a"; g.fillRect(sx, sy - 1 * z, 1.2 * z, 8 * z); g.fillStyle = "#e0a020"; g.fillRect(sx - 3 * z, sy + 2 * z, 7 * z, 5 * z); }
  else if (k === "garden") { poly(g, [P(-0.4, -0.4, 0.5), P(0.4, -0.4, 0.5), P(0.4, 0.4, 0.5), P(-0.4, 0.4, 0.5)], "#a8dc84"); for (const [u, v, a, b] of [[0, 0.36, 0.36, 0.05], [0.36, 0, 0.05, 0.36]]) box(g, ...isoP(x, y, u, v, 0, tw, th), a, b, 4 * z, 0, "#4a9e4e", "#3d8842", "#357a3b", tw, th); const r = K.RNG(7); for (let i = 0; i < 10; i++) { const [fx2, fy2] = P(-0.3 + r() * 0.55, -0.3 + r() * 0.55, 1); g.fillStyle = ["#ff6b9a", "#ffd04a", "#fff", "#c39bff"][i % 4]; g.beginPath(); g.arc(fx2, fy2, 1.6 * z, 0, TAU); g.fill(); } const [tx2, ty2] = P(-0.15, -0.15, 0); const s = 0.7 * z; g.fillStyle = "#7a5030"; g.fillRect(tx2 - 1.5 * s, ty2 - 8 * s, 3 * s, 8 * s); g.fillStyle = "#5fb55a"; g.beginPath(); g.arc(tx2, ty2 - 13 * s, 8 * s, 0, TAU); g.fill(); g.fillStyle = "#4a9e4e"; g.beginPath(); g.arc(tx2 + 3 * s, ty2 - 11 * s, 5 * s, 0, TAU); g.fill(); }
  else if (k === "statue") { B(0.18, 0.18, 6, 0, "#d8d2c8", "#bab3a8", "#a39c91"); B(0.12, 0.12, 4, 6, "#e6e0d6", "#c8c0b4", "#b0a89c"); const [sx, sy] = P(0, 0, 10); g.fillStyle = "#e0b040"; g.beginPath(); g.moveTo(sx - 4 * z, sy); g.lineTo(sx - 2.5 * z, sy - 13 * z); g.lineTo(sx + 2.5 * z, sy - 13 * z); g.lineTo(sx + 4 * z, sy); g.closePath(); g.fill(); g.beginPath(); g.arc(sx, sy - 16 * z, 3 * z, 0, TAU); g.fill(); g.strokeStyle = "#e0b040"; g.lineWidth = 1.5 * z; g.beginPath(); g.moveTo(sx + 2 * z, sy - 11 * z); g.lineTo(sx + 7 * z, sy - 19 * z); g.stroke(); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(sx - 2 * z, sy - 12 * z, 1.2 * z, 10 * z); }
}
const ICONS = {};
function iconCanvas(k, size = 96) { const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"), z = size / 80; drawBld(g, k, size / 2, size * 0.72, z, 0.6); return c; }
function iconURL(k) { if (!ICONS[k]) ICONS[k] = iconCanvas(k).toDataURL(); return ICONS[k]; }
function floatText(x, y, s, c, big) { fx.push({ kind: "text", x, y, s, c, big, t: 0, life: 1.4 }); }
function render(dt) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = "hsl(190, 68%, 49.5%)"; ctx.fillRect(0, 0, CW, CH); const vg = ctx.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * 0.3, CW / 2, CH / 2, Math.max(CW, CH) * 0.75); vg.addColorStop(0, "rgba(255,255,255,0)"); vg.addColorStop(1, "rgba(10,60,90,.25)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, CW, CH);
  ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2; for (let i = 0; i < 14; i++) { const y = ((i * 97 + T * 12) % (CH + 40)) - 20, x = (i * 211) % CW; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 18, y - 5, x + 36, y); ctx.stroke(); }
  if (!G) return;
  const sel = MODE === "play" && G.sel, hv = hover || (K.device === "kb" || K.device === "pad" ? cursor : null);
  const preview = sel && hv ? scoreAt(G.sel, hv.x, hv.y) : null, bad = sel && hv ? canPlace(G.sel, hv.x, hv.y) : null;
  for (let s = 0; s <= 2 * N - 2; s++) for (let x = Math.max(0, s - N + 1); x <= Math.min(N - 1, s); x++) {
    const y = s - x; drawTile(x, y);
    if (preview && !bad) { const m = preview.marks.get(x + "," + y); if (m) { const [cx, cy] = tileCenter(x, y); poly(ctx, [[cx, cy - TH / 2], [cx + TW / 2, cy], [cx, cy + TH / 2], [cx - TW / 2, cy]], m > 0 ? "rgba(60,200,110,.35)" : "rgba(230,70,70,.35)"); } }
    if (hv && hv.x === x && hv.y === y && sel) { const [cx, cy] = tileCenter(x, y); poly(ctx, [[cx, cy - TH / 2], [cx + TW / 2, cy], [cx, cy + TH / 2], [cx - TW / 2, cy]], bad ? "rgba(230,70,70,.45)" : "rgba(255,255,255,.45)", bad ? "#d94a4a" : "#fff"); }
    const b = bAt(x, y); if (b) { const [cx, cy] = tileCenter(x, y), age = T - b.t0, pop = age < 0.35 ? 0.6 + 0.4 * Math.sin((age / 0.35) * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1; ctx.save(); ctx.translate(cx, cy); ctx.scale(pop, pop); drawBld(ctx, b.k, 0, 0, Z, T); ctx.restore(); }
    if (hv && hv.x === x && hv.y === y && sel && !bad && !b) { const [cx, cy] = tileCenter(x, y); ctx.globalAlpha = 0.6 + 0.15 * Math.sin(T * 5); drawBld(ctx, G.sel, cx, cy, Z, T); ctx.globalAlpha = 1; }
  }
  if (preview && hv && !bad) {
    ctx.textAlign = "center"; ctx.lineJoin = "round"; ctx.font = `900 ${Math.round(Math.max(11, 13 * Z))}px Nunito, sans-serif`;
    for (const [key, v] of preview.marks) { const [mx, my] = key.split(",").map(Number); if (!bAt(mx, my) && Math.abs(v) < 2 && !BLD[G.sel].rules.some((r) => r[0] === "any")) continue; const [cx, cy] = tileCenter(mx, my), s = (v > 0 ? "+" : "") + v; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.strokeText(s, cx, cy - 16 * Z); ctx.fillStyle = v > 0 ? "#1f8a50" : "#c03030"; ctx.fillText(s, cx, cy - 16 * Z); }
    const [cx, cy] = tileCenter(hv.x, hv.y), s = (preview.total >= 0 ? "+" : "") + preview.total; ctx.font = `800 ${Math.round(Math.max(18, 24 * Z))}px Fraunces, serif`; ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.strokeText(s, cx, cy - 46 * Z); ctx.fillStyle = preview.total > 0 ? "#1f8a50" : preview.total < 0 ? "#c03030" : "#5a6f80"; ctx.fillText(s, cx, cy - 46 * Z);
  }
  for (const f of fx) {
    f.t += dt; const k = f.t / f.life;
    if (f.kind === "text") { const [cx, cy] = tileCenter(f.x, f.y); ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.font = `800 ${Math.round((f.big ? 30 : 18) * Math.max(0.8, Z))}px Fraunces, serif`; ctx.textAlign = "center"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; const yy = cy - 50 * Z - k * 40; ctx.strokeText(f.s, cx, yy); ctx.fillStyle = f.c; ctx.fillText(f.s, cx, yy); ctx.globalAlpha = 1; }
    else if (f.kind === "spark") { const [cx, cy] = tileCenter(f.x, f.y), d = k * 34 * Z * f.v; ctx.globalAlpha = 1 - k; ctx.fillStyle = "#fff6c0"; ctx.beginPath(); ctx.arc(cx + Math.cos(f.a) * d, cy - 10 * Z + Math.sin(f.a) * d * 0.5 - k * 10 * Z, 2.2 * Z, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    else if (f.kind === "confetti") { const x = f.sx * CW + Math.sin(f.t * 3 + f.r) * 30, y = -20 + f.t * CH * 0.5; ctx.save(); ctx.translate(x, y); ctx.rotate(f.r + f.t * 5); ctx.fillStyle = f.c; ctx.globalAlpha = Math.max(0, 1 - k); ctx.fillRect(-5, -3, 10, 6); ctx.restore(); }
  }
  fx = fx.filter((f) => f.t < f.life);
}

/* ================= HUD ================= */
function hud() { if (!G) return; $("#sv").textContent = G.score; const prev = G.next - G.step + 7; $("#pv").style.width = clamp(((G.score - (G.unlocks ? prev : 0)) / (G.next - (G.unlocks ? prev : 0))) * 100, 0, 100) + "%"; $("#nv").textContent = `Next pack at ${G.next}`; $("#iv").textContent = `Island ${G.island}`; $("#undoBtn").hidden = !G.undo || MODE !== "play"; }
function buildHand() {
  const h = $("#hand"); h.innerHTML = ""; let n = 1;
  for (const k of KINDS) { const c = G.hand[k]; if (!c) continue; const b = document.createElement("button"); b.className = "bc" + (G.sel === k ? " on" : ""); b.type = "button"; b.title = `${BLD[k].name}: ${BLD[k].desc}`; b.innerHTML = `${K.device === "kb" && n <= 9 ? `<span class="k">${n}</span>` : ""}<span class="n">${c}</span>`; b.prepend(iconCanvas(k, 96)); b.insertAdjacentHTML("beforeend", `<b>${BLD[k].name}</b>`); b.onclick = () => { G.sel = k; K.sfx("click"); buildHand(); tip(); }; h.appendChild(b); n++; }
}
function tip(msg) {
  const el = $("#tipbox"); if (MODE !== "play" || !G || !G.sel) { el.innerHTML = msg ? K.esc(msg) : ""; return; }
  if (msg) { el.innerHTML = `${K.esc(msg)}`; clearTimeout(tip.t); tip.t = setTimeout(() => tip(), 2200); return; }
  const B = BLD[G.sel], rules = B.rules.map(([t, r, p]) => `${p > 0 ? "+" : ""}${p} per ${pname(t, 1)} within ${r}`).join(" · ");
  el.innerHTML = `${B.name}${B.base ? ` (+${B.base} base)` : ""}<small>${rules}${B.req ? ` · ${B.req[2]}` : ""}</small>${K.device === "touch" ? "<small>Tap a spot to preview, tap it again to build.</small>" : ""}`;
}

/* ================= input ================= */
let drag = null; const ptrs = new Map();
cv.addEventListener("pointerdown", (e) => {
  K.audio(); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag = { pinch: Math.hypot(a.x - b.x, a.y - b.y), z: Z }; return; }
  drag = { x: e.clientX, y: e.clientY, px: PX, py: PY, moved: false };
});
cv.addEventListener("pointermove", (e) => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (drag && drag.pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; Z = clamp(drag.z * (Math.hypot(a.x - b.x, a.y - b.y) / drag.pinch), ZFIT * 0.8, Math.max(ZFIT * 3, 1.4)); setScale(); return; }
  if (drag && !drag.pinch) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.hypot(dx, dy) > 9) drag.moved = true; if (drag.moved) { PX = drag.px + dx; PY = drag.py + dy; return; } }
  if (e.pointerType === "mouse" && MODE === "play") hover = pick(e.clientX, e.clientY);
});
cv.addEventListener("pointerup", (e) => {
  ptrs.delete(e.pointerId); const d = drag; if (ptrs.size === 0) drag = null; if (!d || d.pinch || d.moved || MODE !== "play" || K.ui.active()) return;
  const t = pick(e.clientX, e.clientY); if (!t) return;
  if (e.pointerType === "mouse") return place(t.x, t.y);
  if (hover && hover.x === t.x && hover.y === t.y) place(t.x, t.y); else { hover = t; K.sfx("click"); }
});
cv.addEventListener("wheel", (e) => { e.preventDefault(); const f = e.deltaY < 0 ? 1.12 : 1 / 1.12, nz = clamp(Z * f, ZFIT * 0.8, Math.max(ZFIT * 3, 1.4)), k = nz / Z, mx = e.clientX - CW / 2 - PX, my = e.clientY - CH / 2 - PY; PX -= mx * (k - 1); PY -= my * (k - 1); Z = nz; setScale(); }, { passive: false });
addEventListener("keydown", (e) => {
  if (e.defaultPrevented || K.ui.active() || MODE !== "play") return;
  const mv = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }[e.code];
  if (mv) { hover = null; cursor = { x: clamp(cursor.x + mv[0], 0, N - 1), y: clamp(cursor.y + mv[1], 0, N - 1) }; K.sfx("move"); e.preventDefault(); return; }
  if (e.code === "Enter" || e.code === "Space") { place(cursor.x, cursor.y); e.preventDefault(); return; }
  if (e.code === "KeyU" || (e.code === "KeyZ" && (e.ctrlKey || e.metaKey))) return undo();
  if (e.code === "Tab") { e.preventDefault(); cycleSel(e.shiftKey ? -1 : 1); return; }
  if (e.code === "Escape") return menu();
  const n = +e.key; if (n >= 1 && n <= 9) { const ks = KINDS.filter((k) => G.hand[k]); if (ks[n - 1]) { G.sel = ks[n - 1]; K.sfx("click"); buildHand(); tip(); } }
});
function cycleSel(d) { const ks = KINDS.filter((k) => G.hand[k]); if (!ks.length) return; const i = ks.indexOf(G.sel); G.sel = ks[(i + d + ks.length) % ks.length]; K.sfx("click"); buildHand(); tip(); }
let padT = 0;
function pollPad(dt) {
  const P = K.pad; if (!P.connected || MODE !== "play" || K.ui.active()) return; const pr = P.pressed, h = P.held;
  if (pr.start) return menu(); if (pr.a) return place(cursor.x, cursor.y); if (pr.y || pr.b) return undo(); if (pr.lb) cycleSel(-1); if (pr.rb) cycleSel(1);
  const vx = (h.dr ? 1 : 0) - (h.dl ? 1 : 0) + (P.ax > 0.5 ? 1 : P.ax < -0.5 ? -1 : 0), vy = (h.dd ? 1 : 0) - (h.du ? 1 : 0) + (P.ay > 0.5 ? 1 : P.ay < -0.5 ? -1 : 0);
  if (!vx && !vy) { padT = 0; return; } padT -= dt; if (padT > 0) return; padT = padT < -1 ? 0.12 : 0.2; hover = null; cursor = { x: clamp(cursor.x + Math.sign(vx), 0, N - 1), y: clamp(cursor.y + Math.sign(vy), 0, N - 1) }; K.sfx("move");
}

/* ================= audio ================= */
const PENT = [523, 587, 659, 784, 880, 1046, 1175, 1318];
function chime(pts) { const n = clamp(Math.ceil(pts / 3), 1, 6), c = K.audio(); if (!c || !K.audioSettings.sfx) return; for (let i = 0; i < n; i++) K.voice(PENT[Math.min(PENT.length - 1, i + Math.floor(pts / 6))], c.currentTime + i * 0.07, 0.5, { type: "sine", vol: 0.035 }); }
K.defineSfx({
  place: (t) => { K.voice(220, t, 0.18, { type: "triangle", vol: 0.08, slide: 0.6 }); K.noise(t, 0.08, { filter: "lowpass", freq: 600, vol: 0.06 }); },
  great: (t) => { K.voice(220, t, 0.18, { type: "triangle", vol: 0.08, slide: 0.6 }); K.notes(t + 0.05, [659, 880, 1318], 0.07, { type: "sine", vol: 0.05, len: 0.5 }); },
  meh: (t) => K.voice(160, t, 0.25, { type: "triangle", vol: 0.07, slide: 0.7 }),
  undo: (t) => K.voice(500, t, 0.15, { type: "triangle", vol: 0.05, slide: 0.6 }),
  unlock: (t) => K.notes(t, [523, 659, 784, 1046, 1318], 0.08, { type: "triangle", vol: 0.06, len: 0.6 }),
  sail: (t) => { K.noise(t, 1.2, { filter: "bandpass", freq: 500, slide: 1.6, vol: 0.06 }); K.notes(t + 0.2, [392, 523, 659], 0.15, { type: "sine", vol: 0.05, len: 0.8 }); },
  over: (t) => K.notes(t, [784, 659, 523, 392], 0.18, { type: "sine", vol: 0.05, len: 0.7 }),
  wave: (t) => K.noise(t, 2.6, { filter: "lowpass", freq: 500, slide: 0.6, vol: 0.025, attack: 0.9 }),
}, { move: 0.04 });
K.songs({ calm: { bpm: 68, chords: ["C", "Am", "F", "G"], pad: true, padVol: 0.02, arp: true, arpVol: 0.012, arpPat: [0, 2, 1, 3], arpWave: "sine", bass: "R . . . . . . . . . . . . . . .", bassVol: 0.06, bassWave: "sine", lead: ["e5 - - - g5 - - -", "c5 - - - e5 - d5 -", "a4 - - - c5 - - -", "b4 - - - d5 - - -"], leadVol: 0.016, leadWave: "sine" } });
let waveT = 3;

/* ================= screens ================= */
function title() {
  MODE = "title"; G = demoIsland(); $("#top").hidden = true; $("#hand").hidden = true; $("#menuBtn").hidden = true; $("#undoBtn").hidden = true; $("#tipbox").innerHTML = ""; fitView(); K.playSong("calm", 0);
  K.ui.show(`<div class="logo">ISLEWRIGHT</div><p class="k-sub">Build a thriving island one building at a time. Every spot matters.</p><div class="k-menu">${SAVE.cur ? `<button class="k-btn primary" data-a="resume" autofocus>Continue<small>Island ${SAVE.cur.island} · ${SAVE.cur.score} points</small></button>` : ""}<button class="k-btn${SAVE.cur ? "" : " primary"}" data-a="new"${SAVE.cur ? "" : " autofocus"}>New game</button><button class="k-btn" data-a="help">How to play</button><button class="k-btn" data-a="settings">Settings</button></div>${SAVE.best ? `<p class="k-sub">Best score ${SAVE.best} · islands settled ${SAVE.islands + SAVE.games}</p>` : ""}`, { cls: "soft" });
}
function demoIsland() {
  const seed = "demo" + ((Math.random() * 1e6) | 0), g = { seed, island: 1, ...genIsland(seed), blds: [], hand: {}, score: 0, next: 20, step: 22, unlocks: 0, sel: null, demo: true }; G = g;
  const land = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g.tiles[y * N + x] !== WATER) land.push({ x, y });
  K.shuffle(land); let n = 0; for (const p of land) { if (n >= 18) break; const ks = KINDS.filter((k) => !canPlace(k, p.x, p.y)); const k = ks.sort((a, b) => scoreAt(b, p.x, p.y).total - scoreAt(a, p.x, p.y).total)[0]; if (k && scoreAt(k, p.x, p.y).total > 3) { g.blds.push({ x: p.x, y: p.y, k, t0: -9 }); if (g.tiles[p.y * N + p.x] === FOREST) g.tiles[p.y * N + p.x] = GRASS; n++; } }
  return g;
}
function menu() { if (MODE !== "play") return; MODE = "menu"; K.ui.show(`<div class="logo sm">Paused</div><div class="k-menu"><button class="k-btn primary" data-a="close" autofocus>Resume</button><button class="k-btn" data-a="rules">Building guide</button><button class="k-btn" data-a="help">How to play</button><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="title">Save and quit</button><button class="k-btn" data-a="restart">Start over</button></div>`, { back: "close", cls: "soft" }); }
function help(back) {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="${back}" autofocus>Back</button></div><div class="k-help">
    <div><b>Place buildings</b>Pick a building from your hand at the bottom, then choose a spot on the island. Before you build, the preview shows how many points it will earn.</div>
    <div><b>Neighbours matter</b>Every building scores from what is around it. Houses love markets, mills love forests, fishing huts love the sea. Green tiles add points, red tiles take them away.</div>
    <div><b>New packs</b>Reach the score goal to choose a new pack of buildings. Each goal is a little higher than the last.</div>
    <div><b>New islands</b>After a few packs you can set sail for a fresh island. Your score carries over.</div>
    <div><b>The end</b>When you run out of buildings before reaching the next goal, the game ends. Plan ahead.</div>
    <div class="k-kbonly"><b>Keyboard</b>Mouse to aim and click to build · arrows move a cursor · Enter builds · 1-9 or Tab picks a building · U undoes · scroll to zoom · drag to pan</div>
    <div class="k-touchonly"><b>Touch</b>Tap to preview, tap again to build · drag to pan · pinch to zoom</div>
    <div><b>Controller</b>D-pad or stick moves the cursor · A builds · LB/RB picks a building · Y undoes · Start menu</div></div>`, { back, cls: "top" });
}
function rules(back) { K.ui.show(`<div class="k-bar"><h2>Building guide</h2><button class="k-btn" data-a="${back}" autofocus>Back</button></div><div class="rules">${KINDS.map((k) => `<div class="r"><img src="${iconURL(k)}" alt="" width="44" height="44"><div><b>${BLD[k].name}</b><small>${BLD[k].desc}</small><small>${(BLD[k].base ? [`+${BLD[k].base} base`] : []).concat(BLD[k].rules.map(([t, r, p]) => `${p > 0 ? "+" : ""}${p} per ${pname(t, 1)} within ${r}`)).join(" · ")}</small></div></div>`).join("")}</div>`, { back, cls: "top" }); }
function settings(back) { const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center;background:#fff">${K.ui.settingsRows()}</div>`, { back, cls: "top" }); K.ui.bindSettings(s); }
K.ui.on(async (a, d) => {
  const back = MODE === "title" ? "title" : "menu2";
  switch (a) {
    case "new": if (SAVE.cur && MODE === "title") { const ok = await K.confirm({ title: "Start a new game?", text: "Your saved islands will be replaced.", yes: "Start fresh", danger: true, focusNo: true }); if (!ok) return; } K.sfx("ok"); return newGame();
    case "resume": K.sfx("ok"); return loadGame();
    case "close": K.sfx("back"); K.ui.hide(); MODE = "play"; return;
    case "menu2": K.ui.hide(); MODE = "play"; return menu();
    case "help": K.sfx("ok"); return help(back);
    case "rules": K.sfx("ok"); return rules(back);
    case "settings": K.sfx("ok"); return settings(back);
    case "title": K.sfx("back"); if (G && !G.done && !G.demo) persistGame(); G = null; return title();
    case "restart": { const ok = await K.confirm({ title: "Start over?", text: "This game will be lost.", yes: "Start over", danger: true, focusNo: true }); if (ok) newGame(); return; }
    case "pack": return takePack(+d.i);
    case "sail": return setSail();
  }
});
$("#menuBtn").onclick = () => menu();
$("#undoBtn").onclick = () => undo();

/* ================= boot ================= */
resize();
K.loop((dt) => {
  T += dt; pollPad(dt);
  if (MODE === "title" && G) { demoT += dt; }
  waveT -= dt; if (waveT <= 0) { waveT = 5 + Math.random() * 5; if (MODE !== "title" || K.MUS.level > 0) K.sfx("wave"); }
  render(dt);
});
title();
