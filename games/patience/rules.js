"use strict";
/* PATIENCE rules: deals for Klondike, Spider and FreeCell, plus a Klondike solver used for
   winnable deals and for hints. Loaded by the page and also run as a worker. Suits: 0 ♠ 1 ♥ 2 ♦ 3 ♣. */
const RULES = (() => {
  const isRed = (s) => s === 1 || s === 2;
  function rng(seed) { let a = (seed >>> 0) || 0x9e3779b9; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const card = (uid, s, r, up = false) => ({ uid, s, r, up });

  function dealKlondike(seed) {
    const r = rng(seed), deck = shuffle([...Array(52).keys()], r).map((u) => card(u, (u / 13) | 0, u % 13));
    const tab = [...Array(7)].map(() => []); let k = 0;
    for (let row = 0; row < 7; row++) for (let p = row; p < 7; p++) tab[p].push(deck[k++]);
    for (const p of tab) p[p.length - 1].up = true;
    return { tab, stock: deck.slice(k), waste: [], found: [[], [], [], []] };
  }
  function dealSpider(seed, suits) {
    const r = rng(seed), deck = shuffle([...Array(104).keys()], r).map((u) => { const set = (u / 13) | 0; return card(u, suits === 1 ? 0 : suits === 2 ? set % 2 : set % 4, u % 13); });
    const tab = [...Array(10)].map(() => []); let k = 0;
    for (let i = 0; i < 54; i++) tab[i % 10].push(deck[k++]);
    for (const p of tab) p[p.length - 1].up = true;
    return { tab, stock: deck.slice(k), found: [] };
  }
  /* FreeCell deals use the classic numbered-deal shuffle, so deal #N here matches deal #N everywhere. */
  function dealFreecell(n) {
    let seed = n >>> 0; const rnd = () => (seed = (seed * 214013 + 2531011) % 2147483648) >>> 16;
    const t = []; for (let i = 0; i < 52; i++) t.push(51 - i);
    for (let i = 0; i < 51; i++) { const j = 51 - (rnd() % (52 - i)); const x = t[i]; t[i] = t[j]; t[j] = x; }
    const MS = [3, 2, 1, 0], tab = [...Array(8)].map(() => []);
    t.forEach((c, i) => { const s = MS[c & 3], r = c >> 2; tab[i % 8].push(card(s * 13 + r, s, r, true)); });
    return { tab, cells: [null, null, null, null], found: [[], [], [], []] };
  }

  /* ---------- Klondike solver (knows the face-down cards). Returns { solved, path, unknown }. ---------- */
  const su = (id) => (id / 13) | 0, rk = (id) => id % 13, red = (id) => isRed(su(id));
  function solveKlondike(game, draw, budget = 20000) {
    const st = { T: game.tab.map((p) => ({ d: p.filter((c) => !c.up).map((c) => c.uid), u: p.filter((c) => c.up).map((c) => c.uid) })), F: [0, 0, 0, 0], S: game.stock.map((c) => c.uid), W: game.waste.map((c) => c.uid) };
    for (const f of game.found) if (f.length) st.F[f[0].s] = f.length;
    if (draw === 1) { st.S = st.S.concat(st.W); st.W = []; }
    const fits = (c, onto) => rk(onto) === rk(c) + 1 && red(onto) !== red(c);
    const toF = (s, c) => s.F[su(c)] === rk(c);
    const safe = (s, c) => { const r = rk(c); if (r <= 1) return true; const rd = red(c); for (let x = 0; x < 4; x++) if (isRed(x) !== rd && s.F[x] < r) return false; return true; };
    const clone = (s) => ({ T: s.T.map((p) => ({ d: p.d.slice(), u: p.u.slice() })), F: s.F.slice(), S: s.S.slice(), W: s.W.slice() });
    const flip = (p) => { if (!p.u.length && p.d.length) p.u.push(p.d.pop()); };
    function talon(s) {
      if (draw === 1) return s.S.map((c, i) => ({ c, i }));
      const out = [], seen = new Set(); let S = s.S.slice(), W = s.W.slice();
      const rec = () => { const c = W[W.length - 1]; if (c !== undefined && !seen.has(c)) { seen.add(c); out.push({ c, S: S.slice(), W: W.slice(0, -1), draws: out.length }); } };
      rec();
      for (let pass = 0; pass < 2; pass++) {
        while (S.length) { for (let k = 0; k < 3 && S.length; k++) W.push(S.pop()); rec(); }
        if (!W.length) break; S = W.reverse(); W = [];
      }
      return out;
    }
    const takeTalon = (n, t) => { if (draw === 1) n.S.splice(t.i, 1); else { n.S = t.S.slice(); n.W = t.W.slice(); } };
    function auto(s, path) {
      let moved = true;
      while (moved) {
        moved = false;
        for (let i = 0; i < 7; i++) { const p = s.T[i], c = p.u[p.u.length - 1]; if (c !== undefined && toF(s, c) && safe(s, c)) { p.u.pop(); s.F[su(c)]++; flip(p); path.push({ k: "tf", i, c }); moved = true; } }
        if (draw === 1) { for (let i = 0; i < s.S.length; i++) { const c = s.S[i]; if (toF(s, c) && safe(s, c)) { s.S.splice(i, 1); s.F[su(c)]++; path.push({ k: "lf", c }); moved = true; i--; } } }
        else { const c = s.W[s.W.length - 1]; if (c !== undefined && toF(s, c) && safe(s, c)) { s.W.pop(); s.F[su(c)]++; path.push({ k: "lf", c }); moved = true; } }
      }
    }
    function gen(s) {
      const out = [], tl = talon(s);
      for (let i = 0; i < 7; i++) { const p = s.T[i], c = p.u[p.u.length - 1]; if (c !== undefined && toF(s, c)) out.push({ k: "tf", i, c, pri: 100 + (p.u.length === 1 && p.d.length ? 30 : 0) }); }
      for (const t of tl) if (toF(s, t.c)) out.push({ k: "lf", t, c: t.c, pri: 90 });
      for (let i = 0; i < 7; i++) {
        const p = s.T[i];
        for (let k = 0; k < p.u.length; k++) {
          const base = p.u[k]; if (k > 0 && !toF(s, p.u[k - 1])) continue;
          const reveal = k === 0 && p.d.length > 0; let emptyUsed = false;
          for (let j = 0; j < 7; j++) {
            if (j === i) continue; const q = s.T[j], top = q.u[q.u.length - 1];
            if (top === undefined) { if (!emptyUsed && !q.d.length && rk(base) === 12 && (k > 0 || p.d.length > 0)) { emptyUsed = true; out.push({ k: "tt", i, j, n: p.u.length - k, c: base, pri: reveal ? 70 : 35 }); } }
            else if (fits(base, top)) out.push({ k: "tt", i, j, n: p.u.length - k, c: base, pri: reveal ? 60 + p.d.length : k > 0 ? 50 : 5 });
          }
        }
      }
      for (const t of tl) { let emptyUsed = false; for (let j = 0; j < 7; j++) { const q = s.T[j], top = q.u[q.u.length - 1]; if (top === undefined ? !emptyUsed && !q.d.length && rk(t.c) === 12 : fits(t.c, top)) { if (top === undefined) emptyUsed = true; out.push({ k: "lt", t, j, c: t.c, pri: 45 - (t.draws || 0) * 0.1 }); } } }
      return out.sort((a, b) => b.pri - a.pri);
    }
    function apply(s, m) {
      const n = clone(s);
      if (m.k === "tf") { const p = n.T[m.i]; p.u.pop(); n.F[su(m.c)]++; flip(p); }
      else if (m.k === "lf") { takeTalon(n, m.t); n.F[su(m.c)]++; }
      else if (m.k === "tt") { const p = n.T[m.i], run = p.u.splice(p.u.length - m.n); n.T[m.j].u.push(...run); flip(p); }
      else if (m.k === "lt") { takeTalon(n, m.t); n.T[m.j].u.push(m.c); }
      return n;
    }
    const key = (s) => s.F.join(",") + "|" + (draw === 1 ? s.S.slice().sort((a, b) => a - b).join(",") : s.S.join(",") + ";" + s.W.join(",")) + "|" + s.T.map((p) => p.d.join(".") + ":" + p.u.join(",")).sort().join("/");
    const won = (s) => s.F[0] + s.F[1] + s.F[2] + s.F[3] === 52 || (draw === 1 && s.T.every((p) => !p.d.length));
    const seen = new Set(), path = []; let nodes = 0;
    function dfs(s) {
      const mark = path.length; auto(s, path);
      if (won(s)) return true;
      const k = key(s); if (seen.has(k)) { path.length = mark; return false; } seen.add(k);
      if (++nodes > budget) throw "budget";
      for (const m of gen(s)) { path.push({ k: m.k, i: m.i, j: m.j, n: m.n, c: m.c }); if (dfs(apply(s, m))) return true; path.pop(); }
      path.length = mark; return false;
    }
    try { const ok = dfs(st); return { solved: ok, path: ok ? path : null, nodes }; }
    catch (e) { if (e === "budget") return { solved: false, unknown: true, nodes }; throw e; }
  }
  function winnableKlondike(seed0, draw, budget = 15000, tries = 30) {
    for (let t = 0; t < tries; t++) { const seed = (seed0 + t * 7919) >>> 0, r = solveKlondike(dealKlondike(seed), draw, budget); if (r.solved) return { seed, tries: t + 1 }; }
    return { seed: seed0 >>> 0, tries, failed: true };
  }
  return { rng, shuffle, isRed, dealKlondike, dealSpider, dealFreecell, solveKlondike, winnableKlondike };
})();
if (typeof module !== "undefined") module.exports = RULES;
if (typeof window === "undefined" && typeof self !== "undefined" && typeof module === "undefined") {
  self.onmessage = (e) => {
    const m = e.data;
    if (m.cmd === "deal") self.postMessage({ id: m.id, ...RULES.winnableKlondike(m.seed, m.draw) });
    else if (m.cmd === "solve") { const r = RULES.solveKlondike(m.game, m.draw, m.budget || 30000); self.postMessage({ id: m.id, solved: r.solved, unknown: !!r.unknown, first: r.path && r.path[0], len: r.path ? r.path.length : 0 }); }
  };
}
