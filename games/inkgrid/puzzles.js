"use strict";
/* INKGRID · puzzles.js — the picture puzzles, a line solver (checks puzzles can be solved without guessing),
   and a random puzzle maker. No DOM here. */
const PAL = { k: "#2b2a33", r: "#e0454a", R: "#9e2a35", o: "#f08a3c", y: "#f4c542", g: "#7bc96f", G: "#3f8f4a", b: "#4a8fe0", B: "#2e5aa8", c: "#5fd0e0", p: "#e86fb0", P: "#9a6ad0", w: "#e9e4d8", n: "#8a5a3a", N: "#5b3a26" };
const PACKS = [
  { id: "first", name: "First Strokes", desc: "5 × 5 warm-ups", puzzles: [
    ["Heart", [".r.r.", "rrrrr", "rrrrr", ".rrr.", "..r.."]],
    ["Smile", [".yyy.", "y.y.y", "yyyyy", "y...y", ".yyy."]],
    ["Arrow", ["..b..", ".bbb.", "bbbbb", "..b..", "..b.."]],
    ["Pine", ["..G..", ".GGG.", "GGGGG", "..n..", ".nnn."]],
    ["Bell", ["..y..", ".yyy.", ".yyy.", "yyyyy", "..y.."]],
    ["Cup", [".n.n.", "n.n..", "wwww.", "wwwww", ".www."]],
  ] },
  { id: "sketch", name: "Sketchbook", desc: "10 × 10 pictures", puzzles: [
    ["Cat", ["kk.......k", "kk......kk", "kkk....kkk", "kkkkkkkkkk", "kk.kkkk.kk", "kkkkkkkkkk", "kkkk..kkkk", ".kkkkkkkk.", "..kkkkkk..", "...kkkk..."]],
    ["Cottage", ["....rr....", "...rrrr...", "..rrrrrr..", ".rrrrrrrr.", "rrrrrrrrrr", ".nnnnnnnn.", ".n..nn..n.", ".n..nn..n.", ".nnnn..nn.", ".nnnn..nn."]],
    ["Fish", ["..........", "....bbb...", "..bbbbbb.b", ".bbbbbbbbb", "bb.bbbbbb.", "bbbbbbbbbb", ".bbbbbbbbb", "..bbbbbb.b", "....bbb...", ".........."]],
    ["Star", ["....yy....", ".....y....", "...yyyy...", "yyyyyyyyyy", ".yyyyyyyy.", "..yyyyyy..", "..yyyyyy..", ".yyy..yyy.", ".yy....yy.", "y........y"]],
    ["Toadstool", ["...rrrr...", ".rr.rr.rr.", "rr..rr..rr", "rrrrrrrrrr", "r..rrrr..r", "..wwwwww..", "..w.ww.w..", "..wwwwww..", "...wwww...", "...wwww..."]],
    ["Ghost", ["...wwww...", "..wwwwww..", ".wwwwwwww.", ".w..ww..w.", ".w..ww..w.", "wwwwwwwwww", "wwwwwwwwww", "wwwwwwwwww", "wwwwwwwwww", "w.ww.ww.ww"]],
    ["Melody", ["...kkkkkkk", "...kkkkkkk", "...k.....k", "...k.....k", "...k.....k", "...k.....k", ".kkk...kkk", "kkkk..kkkk", "kkkk..kkkk", ".kk....kk."]],
    ["Apple", [".....n....", "....n.GG..", "...n.GG...", ".rrrnrrr..", "rrrrrrrrr.", "rr.rrrrrr.", "rr.rrrrrr.", "rrrrrrrrr.", ".rrrrrrr..", "..rr.rr..."]],
    ["Umbrella", ["....p.....", "..ppppp...", ".ppppppp..", "ppppppppp.", "p.p.p.p.p.", "....n.....", "....n.....", "....n.....", ".n..n.....", "..nn......"]],
    ["Rocket", ["....cc....", "...cccc...", "...c..c...", "...c..c...", "...cccc...", ".c.cccc...", "..cccccc..", ".cc.cc.cc.", ".c..oo..c.", "....oo...."]],
    ["Duckling", ["...yyy....", "..yy.yy...", "..yyyyyoo.", "..yyyy....", "y..yy.....", "yyyyyyyy..", "yyyyyyyyy.", ".yyyyyyyy.", "..yyyyyy..", ".........."]],
    ["Sailboat", ["....w.....", "....ww....", "....www...", "....wwww..", "....wwwww.", "....n.....", "nnnnnnnnnn", ".nnnnnnnn.", "..nnnnnn..", "bbbbbbbbbb"]],
  ] },
  { id: "gallery", name: "Gallery", desc: "15 × 15 pictures", puzzles: [
    ["Owl", ["..nn.......nn..", "..nnn.....nnn..", "..nnnnnnnnnnn..", ".nnnnnnnnnnnnn.", ".nn...nnn...nn.", ".nn.k.nnn.k.nn.", ".nn...nnn...nn.", ".nnnnnnonnnnnn.", ".nnnnnnnnnnnnn.", ".nnn.nnnnn.nnn.", ".nnnn.nnn.nnnn.", ".nnnnn.n.nnnnn.", "..nnnnnnnnnnn..", "...nnnnnnnnn...", "....yy...yy...."]],
    ["Sunburst", ["...y...y...y...", "..y....y....y..", "...y.......y...", ".......y.......", ".....yyyyy.....", "....yyyyyyy....", "yy.yyyyyyyyy.yy", "...yyyyyyyyy...", "....yyyyyyy....", ".....yyyyy.....", "..y....y....y..", "...y.......y...", "..y....y....y..", ".......y.......", "..............."]],
    ["Sitting Cat", ["..k.....k......", "..kk...kk......", "..kkkkkkk......", "..k.kkk.k......", "..kkkkkkk......", "...kkkkk.......", "..kkkkkkk......", ".kkkkkkkkk.....", ".kkkkkkkkk....k", ".kkkkkkkkk...kk", ".kkkkkkkkk..kk.", ".kkkkkkkkkkkk..", "..kkkkkkkkkk...", "..kk.kk.kk.....", "..............."]],
    ["Blossom", [".....ppp.......", "....ppppp......", "...pp.p.pp.....", "...ppp.ppp.....", "...pp.p.pp.....", "....ppppp......", ".....ppp.......", "......G........", "...GG.G.p......", "....GGG..GG....", "......G.GG.....", "......GG.......", "......G........", "....nnnnn......", ".....nnn......."]],
    ["Whale", ["...............", "...........b.b.", "............b..", "..bbbbbb....b..", ".bbbbbbbbb.bb..", "bbbbbbbbbbbbb..", "bb.bbbbbbbbbb..", "bbbbbbbbbbbb...", "bbbbbbbbbbb....", ".ccccccccc.....", "..ccccccc......", "...............", ".c..c..c..c..c.", "c.cc.cc.cc.cc.c", "..............."]],
    ["Snail", ["..........k....", "..........k.k..", "...........k.k.", ".....nnn...yy..", "....n...n..yy..", "...n.nnn.n.yy..", "...n.n.n.n.yy..", "...n.n...n.yy..", "...n..nnn.yyy..", "....n....yyyy..", ".yyyyyyyyyyyy..", "yyyyyyyyyyyy...", "...............", "..g..g...g..g..", "ggggggggggggggg"]],
  ] },
];

/* ---------- clues + line solver ---------- */
function cluesOf(cells) { const out = []; let run = 0; for (const v of cells) { if (v) run++; else if (run) { out.push(run); run = 0; } } if (run) out.push(run); return out.length ? out : [0]; }
function puzzleFromRows(rows) {
  const h = rows.length, w = rows[0].length, sol = new Uint8Array(w * h), col = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x] || "."; if (ch !== ".") { sol[y * w + x] = 1; col[y * w + x] = PAL[ch] || "#2b2a33"; } }
  return { w, h, sol, col, rowClues: [...Array(h)].map((_, y) => cluesOf([...Array(w)].map((_, x) => sol[y * w + x]))), colClues: [...Array(w)].map((_, x) => cluesOf([...Array(h)].map((_, y) => sol[y * w + x]))) };
}
/* Given clues and a line of states (0 unknown, 1 filled, 2 empty), return the forced line or null if contradictory. */
function solveLine(clues, line) {
  const n = line.length, k = clues[0] === 0 ? 0 : clues.length, cl = k ? clues : [];
  const memo = new Map(), canFill = new Uint8Array(n), canEmpty = new Uint8Array(n);
  // ok(i, j): can clues j.. be placed in cells i.. ; records which cells can be filled/empty along valid paths
  const ok = (i, j) => {
    const key = i * 64 + j; if (memo.has(key)) return memo.get(key);
    let res = false;
    if (j === k) { res = true; for (let q = i; q < n; q++) if (line[q] === 1) { res = false; break; } if (res) for (let q = i; q < n; q++) canEmpty[q] = 1; memo.set(key, res); return res; }
    if (i >= n) { memo.set(key, false); return false; }
    // option 1: cell i empty
    if (line[i] !== 1 && ok(i + 1, j)) { canEmpty[i] = 1; res = true; }
    // option 2: block j starts at i
    const L = cl[j];
    if (i + L <= n) {
      let fits = true; for (let q = i; q < i + L; q++) if (line[q] === 2) { fits = false; break; }
      if (fits && i + L < n && line[i + L] === 1) fits = false;
      if (fits) {
        const next = i + L + (i + L < n ? 1 : 0);
        if (ok(next, j + 1)) { for (let q = i; q < i + L; q++) canFill[q] = 1; if (i + L < n) canEmpty[i + L] = 1; res = true; }
      }
    }
    memo.set(key, res); return res;
  };
  if (!ok(0, 0)) return null;
  const out = line.slice(); for (let q = 0; q < n; q++) { if (canFill[q] && !canEmpty[q]) out[q] = 1; else if (!canFill[q] && canEmpty[q]) out[q] = 2; }
  return out;
}
/* Full logic solve; returns { solved, grid } — solved means the clues pin down one picture without guessing. */
function logicSolve(p, start) {
  const { w, h } = p, g = start ? Uint8Array.from(start) : new Uint8Array(w * h);
  let changed = true, guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    for (let y = 0; y < h; y++) {
      const line = [...Array(w)].map((_, x) => g[y * w + x]), r = solveLine(p.rowClues[y], line); if (!r) return { solved: false, broken: true, grid: g };
      for (let x = 0; x < w; x++) if (r[x] !== line[x]) { g[y * w + x] = r[x]; changed = true; }
    }
    for (let x = 0; x < w; x++) {
      const line = [...Array(h)].map((_, y) => g[y * w + x]), r = solveLine(p.colClues[x], line); if (!r) return { solved: false, broken: true, grid: g };
      for (let y = 0; y < h; y++) if (r[y] !== line[y]) { g[y * w + x] = r[y]; changed = true; }
    }
  }
  return { solved: g.every((v) => v !== 0), grid: g };
}
/* Random puzzles: blobby noise, smoothed, kept only if solvable by logic. */
function randomPuzzle(size, rng, hue) {
  for (let attempt = 0; attempt < 400; attempt++) {
    let g = new Uint8Array(size * size).map(() => (rng() < 0.56 ? 1 : 0));
    for (let pass = 0; pass < 2; pass++) {
      const n = new Uint8Array(size * size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < size && yy < size) c += g[yy * size + xx]; } n[y * size + x] = c >= 5 ? 1 : c <= 3 ? 0 : g[y * size + x]; }
      g = n;
    }
    const rows = [...Array(size)].map((_, y) => [...Array(size)].map((_, x) => (g[y * size + x] ? "x" : ".")).join(""));
    const p = puzzleFromRows(rows); let filled = 0; for (const v of p.sol) filled += v;
    if (filled < size * size * 0.3 || filled > size * size * 0.75) continue;
    const r = logicSolve(p); if (!r.solved) continue;
    for (let i = 0; i < p.col.length; i++) if (p.sol[i]) { const y = (i / size) | 0, x = i % size; p.col[i] = `hsl(${(hue + (x + y) * 4) % 360},55%,${46 + ((x * 7 + y * 3) % 10)}%)`; }
    return p;
  }
  return null;
}
if (typeof module !== "undefined") module.exports = { PACKS, puzzleFromRows, logicSolve, solveLine, randomPuzzle };
