"use strict";
/* NINEFOLD · sudoku.js — grids, a backtracking generator, and a solver that works like a person:
   it uses named techniques in order of difficulty, which grades puzzles and powers the hints.
   Loaded as a normal script it defines SU; loaded as a Worker it answers generate requests. */
const SU = (() => {
  const ROW = (i) => (i / 9) | 0, COL = (i) => i % 9, BOX = (i) => ((ROW(i) / 3) | 0) * 3 + ((COL(i) / 3) | 0);
  const UNITS = [];
  for (let r = 0; r < 9; r++) UNITS.push([...Array(9)].map((_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) UNITS.push([...Array(9)].map((_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) { const br = ((b / 3) | 0) * 3, bc = (b % 3) * 3, u = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) u.push((br + r) * 9 + bc + c); UNITS.push(u); }
  const UNIT_NAME = (u) => (u < 9 ? "row " + (u + 1) : u < 18 ? "column " + (u - 8) : "box " + (u - 17));
  const UNIT_KIND = (u) => (u < 9 ? "row" : u < 18 ? "column" : "box");
  const PEERS = [...Array(81)].map((_, i) => { const s = new Set(); for (const u of UNITS) if (u.includes(i)) for (const j of u) if (j !== i) s.add(j); return [...s]; });
  const PEERSET = PEERS.map((p) => new Set(p));
  const ALL = 0x3fe;
  const bit = (d) => 1 << d;
  const pc = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const digits = (m) => { const o = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) o.push(d); return o; };
  function combos(arr, k, start = 0, cur = [], out = []) { if (cur.length === k) { out.push(cur.slice()); return out; } for (let i = start; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, out); cur.pop(); } return out; }
  function RNG(seed) { let a = (seed >>> 0) || 0x9e3779b9; const f = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.shuffle = (x) => { for (let i = x.length - 1; i > 0; i--) { const j = (f() * (i + 1)) | 0; [x[i], x[j]] = [x[j], x[i]]; } return x; }; return f; }

  const candMask = (g, i) => { let m = ALL; for (const j of PEERS[i]) if (g[j]) m &= ~bit(g[j]); return m; };
  function initCand(g) { const c = new Uint16Array(81); for (let i = 0; i < 81; i++) c[i] = g[i] ? 0 : candMask(g, i); return c; }
  function place(g, c, i, d) { g[i] = d; c[i] = 0; for (const j of PEERS[i]) c[j] &= ~bit(d); }

  /* ---------- backtracking ---------- */
  function fullGrid(rng) {
    const g = new Int8Array(81);
    const fill = () => {
      let best = -1, bm = 0, bc = 10;
      for (let i = 0; i < 81; i++) if (!g[i]) { const m = candMask(g, i), c = pc(m); if (c < bc) { bc = c; best = i; bm = m; if (c <= 1) break; } }
      if (best < 0) return true; if (!bc) return false;
      for (const d of rng.shuffle(digits(bm))) { g[best] = d; if (fill()) return true; }
      g[best] = 0; return false;
    };
    fill(); return g;
  }
  function countSolutions(p, limit = 2) {
    const g = Int8Array.from(p); let n = 0;
    const go = () => {
      let best = -1, bm = 0, bc = 10;
      for (let i = 0; i < 81; i++) if (!g[i]) { const m = candMask(g, i), c = pc(m); if (c < bc) { bc = c; best = i; bm = m; if (c <= 1) break; } }
      if (best < 0) { n++; return n >= limit; } if (!bc) return false;
      for (const d of digits(bm)) { g[best] = d; if (go()) return true; }
      g[best] = 0; return false;
    };
    go(); return n;
  }

  /* ---------- techniques: each returns a step or null ---------- */
  function nakedSingle(g, c) {
    for (let i = 0; i < 81; i++) if (!g[i] && pc(c[i]) === 1) { const d = digits(c[i])[0]; return { place: [i, d], cells: [i], digit: d, text: `Only ${d} fits here. Every other number is already in this cell's row, column or box.` }; }
    return null;
  }
  function hiddenSingle(g, c) {
    for (const order of [[18, 27], [0, 9], [9, 18]]) for (let u = order[0]; u < order[1]; u++) for (let d = 1; d <= 9; d++) {
      let pos = -1, n = 0;
      for (const i of UNITS[u]) { if (g[i] === d) { n = -9; break; } if (!g[i] && c[i] & bit(d)) { n++; pos = i; } }
      if (n === 1) return { place: [pos, d], cells: [pos], unit: u, digit: d, text: `In ${UNIT_NAME(u)}, ${d} has only one place it can go.` };
    }
    return null;
  }
  function pointing(g, c) {
    for (let b = 18; b < 27; b++) for (let d = 1; d <= 9; d++) {
      const pos = UNITS[b].filter((i) => !g[i] && c[i] & bit(d)); if (pos.length < 2 || pos.length > 3) continue;
      for (const [line, key] of [[ROW, 0], [COL, 9]]) {
        const l = line(pos[0]); if (!pos.every((i) => line(i) === l)) continue;
        const el = UNITS[key + l].filter((i) => !UNITS[b].includes(i) && !g[i] && c[i] & bit(d));
        if (el.length) return { elim: el.map((i) => [i, d]), cells: pos, digit: d, text: `In ${UNIT_NAME(b)}, every ${d} sits in ${UNIT_NAME(key + l)}, so ${d} can't go anywhere else in that ${key ? "column" : "row"}.` };
      }
    }
    return null;
  }
  function claiming(g, c) {
    for (let u = 0; u < 18; u++) for (let d = 1; d <= 9; d++) {
      const pos = UNITS[u].filter((i) => !g[i] && c[i] & bit(d)); if (pos.length < 2 || pos.length > 3) continue;
      const b = BOX(pos[0]); if (!pos.every((i) => BOX(i) === b)) continue;
      const el = UNITS[18 + b].filter((i) => !UNITS[u].includes(i) && !g[i] && c[i] & bit(d));
      if (el.length) return { elim: el.map((i) => [i, d]), cells: pos, digit: d, text: `In ${UNIT_NAME(u)}, every ${d} sits inside ${UNIT_NAME(18 + b)}, so ${d} can't go anywhere else in that box.` };
    }
    return null;
  }
  function nakedSubset(g, c, k) {
    for (let u = 0; u < 27; u++) {
      const cells = UNITS[u].filter((i) => !g[i] && pc(c[i]) >= 2 && pc(c[i]) <= k);
      for (const cb of combos(cells, k)) {
        let m = 0; for (const i of cb) m |= c[i]; if (pc(m) !== k) continue;
        const el = []; for (const i of UNITS[u]) if (!g[i] && !cb.includes(i)) for (const d of digits(c[i] & m)) el.push([i, d]);
        if (el.length) return { elim: el, cells: cb, text: `These ${k} cells in ${UNIT_NAME(u)} can only hold ${digits(m).join(", ")}, so those numbers can't go anywhere else in that ${UNIT_KIND(u)}.` };
      }
    }
    return null;
  }
  function hiddenSubset(g, c, k) {
    for (let u = 0; u < 27; u++) {
      const ds = []; const where = {};
      for (let d = 1; d <= 9; d++) { if (UNITS[u].some((i) => g[i] === d)) continue; const pos = UNITS[u].filter((i) => !g[i] && c[i] & bit(d)); if (pos.length >= 1 && pos.length <= k) { ds.push(d); where[d] = pos; } }
      for (const cb of combos(ds, k)) {
        const cellSet = new Set(); for (const d of cb) for (const i of where[d]) cellSet.add(i); if (cellSet.size !== k) continue;
        const keep = cb.reduce((m, d) => m | bit(d), 0), el = [];
        for (const i of cellSet) for (const d of digits(c[i] & ~keep)) el.push([i, d]);
        if (el.length) return { elim: el, cells: [...cellSet], text: `In ${UNIT_NAME(u)}, ${cb.join(" and ")} can only go in these ${k} cells, so nothing else can go there.` };
      }
    }
    return null;
  }
  function fish(g, c, k) {
    const name = k === 2 ? "X-Wing" : "Swordfish";
    for (let d = 1; d <= 9; d++) for (const [base, cover] of [[0, 9], [9, 0]]) {
      const lines = [];
      for (let l = 0; l < 9; l++) {
        if (UNITS[base + l].some((i) => g[i] === d)) continue;
        const pos = UNITS[base + l].filter((i) => !g[i] && c[i] & bit(d)).map((i) => (base === 0 ? COL(i) : ROW(i)));
        if (pos.length >= 2 && pos.length <= k) lines.push({ l, pos });
      }
      for (const cb of combos(lines, k)) {
        const cov = new Set(); for (const x of cb) for (const p of x.pos) cov.add(p); if (cov.size !== k) continue;
        const ls = new Set(cb.map((x) => x.l)), el = [];
        for (const p of cov) for (const i of UNITS[cover + p]) { const l = base === 0 ? ROW(i) : COL(i); if (!ls.has(l) && !g[i] && c[i] & bit(d)) el.push([i, d]); }
        if (el.length) { const cells = []; for (const x of cb) for (const i of UNITS[base + x.l]) if (!g[i] && c[i] & bit(d)) cells.push(i); return { elim: el, cells, digit: d, text: `${name} on ${d}: in ${k} ${base === 0 ? "rows" : "columns"}, ${d} fits only in the same ${k} ${base === 0 ? "columns" : "rows"}, so it can't go elsewhere in those ${base === 0 ? "columns" : "rows"}.` }; }
      }
    }
    return null;
  }
  function xyWing(g, c) {
    for (let p = 0; p < 81; p++) {
      if (g[p] || pc(c[p]) !== 2) continue;
      const [a, b] = digits(c[p]);
      const wings = PEERS[p].filter((i) => !g[i] && pc(c[i]) === 2 && pc(c[i] & c[p]) === 1);
      for (const w1 of wings) for (const w2 of wings) {
        if (w1 >= w2) continue;
        const s1 = c[w1] & c[p], s2 = c[w2] & c[p]; if (s1 === s2) continue;
        const z1 = c[w1] & ~c[p], z2 = c[w2] & ~c[p]; if (z1 !== z2 || pc(z1) !== 1) continue;
        const z = digits(z1)[0], el = [];
        for (let i = 0; i < 81; i++) if (i !== p && i !== w1 && i !== w2 && !g[i] && c[i] & bit(z) && PEERSET[w1].has(i) && PEERSET[w2].has(i)) el.push([i, z]);
        if (el.length) return { elim: el, cells: [p, w1, w2], digit: z, text: `XY-Wing: whichever number the middle cell (${a} or ${b}) takes, one of the two wing cells becomes ${z}, so ${z} can't go where both wings see.` };
      }
    }
    return null;
  }
  const TECH = [
    ["Naked single", 1, nakedSingle], ["Hidden single", 1, hiddenSingle],
    ["Pointing", 2, pointing], ["Claiming", 2, claiming], ["Naked pair", 2, (g, c) => nakedSubset(g, c, 2)],
    ["Hidden pair", 3, (g, c) => hiddenSubset(g, c, 2)], ["Naked triple", 3, (g, c) => nakedSubset(g, c, 3)], ["Hidden triple", 3, (g, c) => hiddenSubset(g, c, 3)],
    ["X-Wing", 4, (g, c) => fish(g, c, 2)], ["XY-Wing", 4, xyWing], ["Swordfish", 4, (g, c) => fish(g, c, 3)],
  ];
  function nextStep(g, c, maxLevel = 4) { for (const [name, level, fn] of TECH) { if (level > maxLevel) break; const s = fn(g, c); if (s) { s.tech = name; s.level = level; return s; } } return null; }
  function applyStep(g, c, s) { if (s.place) place(g, c, s.place[0], s.place[1]); if (s.elim) for (const [i, d] of s.elim) c[i] &= ~bit(d); }
  function logicSolve(p, maxLevel = 4) {
    const g = Int8Array.from(p), c = initCand(g); let maxUsed = 0, steps = 0;
    for (;;) {
      let empty = 0; for (let i = 0; i < 81; i++) if (!g[i]) { empty++; if (!c[i]) return { solved: false, level: maxUsed, broken: true }; }
      if (!empty) return { solved: true, level: maxUsed, grid: g, steps };
      const s = nextStep(g, c, maxLevel); if (!s) return { solved: false, level: maxUsed };
      applyStep(g, c, s); if (s.level > maxUsed) maxUsed = s.level; steps++;
    }
  }

  /* ---------- generator ---------- */
  const LEVEL = { easy: 1, medium: 2, hard: 3, expert: 4 };
  const MAXHOLES = { easy: 45, medium: 53, hard: 58, expert: 64 };
  function generate(diff, seed, budgetMs = 6000) {
    const rng = RNG(seed), target = LEVEL[diff] || 1, t0 = Date.now();
    let best = null;
    for (let attempt = 0; attempt < 3000; attempt++) {
      const sol = fullGrid(rng), puz = Int8Array.from(sol);
      let holes = 0;
      for (const i of rng.shuffle([...Array(41).keys()])) {
        const j = 80 - i, a = puz[i], b = puz[j], add = i === j ? 1 : 2;
        if (holes + add > MAXHOLES[diff]) continue;
        puz[i] = 0; puz[j] = 0;
        if (logicSolve(puz, target).solved) holes += add; else { puz[i] = a; puz[j] = b; }
      }
      const r = logicSolve(puz, target);
      const cand = { puzzle: Array.from(puz), solution: Array.from(sol), level: r.level, holes };
      if (r.solved && r.level === target) return cand;
      if (r.solved && (!best || r.level > best.level || (r.level === best.level && holes > best.holes))) best = cand;
      if (Date.now() - t0 > budgetMs) break;
    }
    return best;
  }
  /* A hint for the current grid: points out a wrong number first, otherwise the next logical placement. */
  function hint(grid, solution) {
    const wrong = []; for (let i = 0; i < 81; i++) if (grid[i] && grid[i] !== solution[i]) wrong.push(i);
    if (wrong.length) return { kind: "mistake", cells: wrong, text: wrong.length === 1 ? "This number doesn't belong here." : "These numbers don't belong where they are." };
    const g = Int8Array.from(grid), c = initCand(g); let used = null;
    for (let k = 0; k < 200; k++) {
      const s = nextStep(g, c, 4); if (!s) break;
      if (s.place) { const [i, d] = s.place; return { kind: "place", cell: i, digit: d, cells: s.cells, tech: s.tech, text: used ? `${used.tech}: ${used.text} After that, this cell must be ${d}.` : `${s.tech}: ${s.text}` }; }
      if (!used) used = s;
      applyStep(g, c, s);
    }
    const empty = [...Array(81).keys()].filter((i) => !grid[i]);
    if (!empty.length) return null;
    const i = empty[0];
    return { kind: "place", cell: i, digit: solution[i], cells: [i], tech: "Reveal", text: `This one is tricky. It's a ${solution[i]}.` };
  }
  return { UNITS, PEERS, ROW, COL, BOX, bit, pc, digits, initCand, candMask, logicSolve, generate, countSolutions, hint, nextStep, RNG };
})();

if (typeof window === "undefined" && typeof self !== "undefined") {
  self.onmessage = (e) => { const { id, diff, seed } = e.data; const r = SU.generate(diff, seed); self.postMessage({ id, diff, seed, ...r }); };
}
