"use strict";
/* JADE logic: layouts, the 144-tile set, free-tile rules and solvable deals.
   Positions are in half-tile units: a tile at (x, y, z) covers x..x+2 and y..y+2 on layer z. */
const MJ = (() => {
  /* faces: 0-8 dots, 9-17 bamboo, 18-26 characters, 27-30 winds, 31-33 dragons, 34-37 flowers, 38-41 seasons */
  const group = (f) => (f < 34 ? f : f < 38 ? 34 : 38);
  const matches = (a, b) => group(a) === group(b);
  function allPairs() { const p = []; for (let f = 0; f < 34; f++) { p.push([f, f]); p.push([f, f]); } p.push([34, 35], [36, 37], [38, 39], [40, 41]); return p; }
  const rect = (out, x0, y0, w, h, z, step = 2) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push([x0 + i * step, y0 + j * step, z]); return out; };
  const LAYOUTS = [
    { id: "tortoise", name: "Tortoise", desc: "The classic five-layer shell", build() {
      const o = [];
      const rows = [[2, 12], [6, 8], [4, 10], [2, 12], [2, 12], [4, 10], [6, 8], [2, 12]];
      rows.forEach(([x0, n], r) => rect(o, x0, r * 2, n, 1, 0));
      o.push([0, 7, 0], [26, 7, 0], [28, 7, 0]);
      rect(o, 8, 2, 6, 6, 1); rect(o, 10, 4, 4, 4, 2); rect(o, 12, 6, 2, 2, 3); o.push([13, 7, 4]);
      return o;
    } },
    { id: "pyramid", name: "Pyramid", desc: "Four tiers, wide and steep", build() { const o = []; rect(o, 0, 0, 8, 8, 0); rect(o, 2, 2, 6, 6, 1); rect(o, 4, 4, 4, 4, 2); rect(o, 6, 6, 2, 2, 3); return o; } },
    { id: "fortress", name: "Fortress", desc: "Walls, a courtyard and four towers", build() {
      const o = []; for (let j = 0; j < 8; j++) for (let i = 0; i < 12; i++) if (!(i >= 4 && i < 8 && j >= 3 && j < 5)) o.push([i * 2, j * 2, 0]);
      for (let j = 0; j < 8; j++) for (let i = 0; i < 12; i++) if (i === 0 || j === 0 || i === 11 || j === 7) o.push([i * 2, j * 2, 1]);
      for (const [cx, cy] of [[0, 0], [20, 0], [0, 12], [20, 12]]) { rect(o, cx, cy, 2, 2, 2); o.push([cx + 1, cy + 1, 3]); }
      return o;
    } },
    { id: "peaks", name: "Twin Peaks", desc: "Two mountains joined by a ridge", build() {
      const o = []; rect(o, 0, 0, 14, 6, 0); rect(o, 2, 1, 5, 4, 1); rect(o, 16, 1, 5, 4, 1); rect(o, 4, 3, 3, 2, 2); rect(o, 18, 3, 3, 2, 2); o.push([6, 4, 3], [20, 4, 3], [12, 4, 1], [14, 4, 1]);
      return o;
    } },
    { id: "cross", name: "Crossroads", desc: "A wide cross with a raised center", build() {
      const o = []; rect(o, 0, 6, 14, 4, 0); rect(o, 10, 0, 4, 3, 0); rect(o, 10, 14, 4, 3, 0);
      rect(o, 4, 8, 10, 2, 1); rect(o, 12, 2, 2, 3, 1); rect(o, 12, 12, 2, 3, 1); rect(o, 12, 8, 2, 2, 2); rect(o, 4, 9, 2, 1, 2); rect(o, 20, 9, 2, 1, 2);
      return o;
    } },
  ];
  /* precompute blockers for a list of positions */
  function graph(pos) {
    const n = pos.length, above = [], left = [], right = [];
    for (let i = 0; i < n; i++) { above.push([]); left.push([]); right.push([]); }
    for (let i = 0; i < n; i++) {
      const [x, y, z] = pos[i];
      for (let j = 0; j < n; j++) {
        if (i === j) continue; const [x2, y2, z2] = pos[j];
        if (z2 > z && Math.abs(x2 - x) < 2 && Math.abs(y2 - y) < 2) above[i].push(j);
        else if (z2 === z && Math.abs(y2 - y) < 2) { if (x2 === x - 2) left[i].push(j); else if (x2 === x + 2) right[i].push(j); }
      }
    }
    return { above, left, right };
  }
  function isFree(g, i, alive) {
    for (const j of g.above[i]) if (alive[j]) return false;
    let l = false, r = false;
    for (const j of g.left[i]) if (alive[j]) { l = true; break; }
    if (!l) return true;
    for (const j of g.right[i]) if (alive[j]) { r = true; break; }
    return !r;
  }
  /* assign face pairs to the positions in `idx` so that a full solution exists; returns faces[] (indexed like pos) or null */
  function assign(g, n, idx, pairs, rng, tries = 300) {
    for (let t = 0; t < tries; t++) {
      const alive = new Uint8Array(n); for (const i of idx) alive[i] = 1;
      const faces = new Int8Array(n).fill(-1), order = pairs.slice(); for (let k = order.length - 1; k > 0; k--) { const j = (rng() * (k + 1)) | 0; [order[k], order[j]] = [order[j], order[k]]; }
      let left = idx.length, ok = true, p = 0;
      while (left > 0) {
        const free = []; for (const i of idx) if (alive[i] && isFree(g, i, alive)) free.push(i);
        if (free.length < 2) { ok = false; break; }
        // prefer taking tiles from higher layers first so stacks never strand single tiles
        free.sort((a, b) => g.zs[b] - g.zs[a] || rng() - 0.5);
        const a = free[(rng() * Math.min(free.length, 3 + ((rng() * free.length) | 0))) | 0];
        const rest = free.filter((i) => i !== a); const b = rest[(rng() * rest.length) | 0];
        const [fa, fb] = order[p++]; faces[a] = fa; faces[b] = fb; alive[a] = alive[b] = 0; left -= 2;
      }
      if (ok) return faces;
    }
    return null;
  }
  function deal(layoutIdx, rng) {
    const pos = LAYOUTS[layoutIdx].build(); if (pos.length % 2) pos.pop();
    const g = graph(pos); g.zs = pos.map((p) => p[2]);
    const all = allPairs(); for (let k = all.length - 1; k > 0; k--) { const j = (rng() * (k + 1)) | 0; [all[k], all[j]] = [all[j], all[k]]; }
    const pairs = all.slice(0, pos.length / 2);
    const faces = assign(g, pos.length, pos.map((_, i) => i), pairs, rng);
    return { pos, g, faces };
  }
  /* reshuffle the faces of the remaining tiles into a solvable arrangement */
  function reshuffle(g, pos, faces, alive, rng) {
    const idx = []; for (let i = 0; i < pos.length; i++) if (alive[i]) idx.push(i);
    const byGroup = new Map(); for (const i of idx) { const k = group(faces[i]); if (!byGroup.has(k)) byGroup.set(k, []); byGroup.get(k).push(faces[i]); }
    const pairs = []; for (const list of byGroup.values()) for (let k = 0; k + 1 < list.length; k += 2) pairs.push([list[k], list[k + 1]]);
    const f2 = assign(g, pos.length, idx, pairs, rng, 400);
    if (!f2) return null;
    const out = faces.slice(); for (const i of idx) out[i] = f2[i]; return out;
  }
  function freeMatches(g, faces, alive) {
    const free = []; for (let i = 0; i < faces.length; i++) if (alive[i] && isFree(g, i, alive)) free.push(i);
    const out = []; for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) if (matches(faces[free[a]], faces[free[b]])) out.push([free[a], free[b]]);
    return { free, pairs: out };
  }
  return { LAYOUTS, group, matches, graph, isFree, deal, reshuffle, freeMatches };
})();
if (typeof module !== "undefined") module.exports = MJ;
