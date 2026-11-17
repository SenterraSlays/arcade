"use strict";
/* PATIENCE — Klondike, Spider and FreeCell. */
const { $, $$, clamp } = K;
const VARIANTS = {
  k1: { game: "klondike", name: "Klondike", sub: "Draw 1", draw: 1 },
  k3: { game: "klondike", name: "Klondike", sub: "Draw 3", draw: 3 },
  s1: { game: "spider", name: "Spider", sub: "1 suit", suits: 1 },
  s2: { game: "spider", name: "Spider", sub: "2 suits", suits: 2 },
  s4: { game: "spider", name: "Spider", sub: "4 suits", suits: 4 },
  fc: { game: "freecell", name: "FreeCell", sub: "" },
};
const FELTS = [{ name: "Emerald", a: "#17795a", b: "#08372a" }, { name: "Ocean", a: "#1b6390", b: "#0a2a42" }, { name: "Wine", a: "#86283c", b: "#360c17" }, { name: "Slate", a: "#465061", b: "#171b22" }];
const blankStats = () => ({ played: 0, won: 0, streak: 0, best: 0, time: 0, moves: 0 });
const SAVE = K.load("patience.v1", { opts: { back: 0, felt: 0, four: false, autoF: true, winnable: true }, last: "k1", stats: {}, cur: null, daily: { date: "", done: {} } });
for (const v in VARIANTS) SAVE.stats[v] = K.merge(blankStats(), SAVE.stats[v]);
const persist = () => K.save("patience.v1", SAVE);
CARDS.opts.back = SAVE.opts.back; CARDS.opts.four = SAVE.opts.four;

/* ================= worker (winnable deals + solver hints) ================= */
let worker = null, wid = 0; const wq = new Map();
try { worker = new Worker("rules.js?v=1"); worker.onmessage = (e) => { const cb = wq.get(e.data.id); if (cb) { wq.delete(e.data.id); cb(e.data); } }; worker.onerror = () => { worker = null; for (const cb of wq.values()) cb(null); wq.clear(); }; } catch { worker = null; }
function ask(msg, timeout = 6000) { return new Promise((res) => { if (!worker) return res(null); const id = ++wid; wq.set(id, res); worker.postMessage({ ...msg, id }); setTimeout(() => { if (wq.has(id)) { wq.delete(id); res(null); } }, timeout); }); }
const NEXT = {};
async function winnableSeed(v, seed) {
  const V = VARIANTS[v], r = (await ask({ cmd: "deal", seed, draw: V.draw }, 9000)) || RULES.winnableKlondike(seed, V.draw, 6000, 12);
  return r.seed;
}
function prefetch(v) { if (VARIANTS[v].game !== "klondike" || !SAVE.opts.winnable || NEXT[v] || !worker) return; const seed = (Math.random() * 4294967296) >>> 0; NEXT[v] = winnableSeed(v, seed); }

/* ================= deals + state ================= */
const dailyKey = () => K.today();
function dailyFC() { let n = (K.dailySeed("patience-fc") % 1000000) + 1; if (n === 11982) n++; return n; }
async function makeDeal(v, o = {}) {
  const V = VARIANTS[v];
  if (V.game === "freecell") { let n = o.deal || (o.daily ? dailyFC() : 1 + Math.floor(Math.random() * 1000000)); if (n === 11982) n++; return { v, seed: n, deal: RULES.dealFreecell(n) }; }
  let seed = o.seed ?? (o.daily ? K.dailySeed("patience-" + v) : (Math.random() * 4294967296) >>> 0);
  if (V.game === "klondike" && o.seed === undefined && (o.daily || SAVE.opts.winnable)) {
    if (!o.daily && NEXT[v]) { seed = await NEXT[v]; delete NEXT[v]; } else seed = await winnableSeed(v, seed);
  }
  return { v, seed, deal: V.game === "klondike" ? RULES.dealKlondike(seed) : RULES.dealSpider(seed, V.suits) };
}
function cardOf(v, uid) { const V = VARIANTS[v], r = uid % 13; if (V.game !== "spider") return { uid, s: (uid / 13) | 0, r, up: false }; const set = (uid / 13) | 0; return { uid, s: V.suits === 1 ? 0 : V.suits === 2 ? set % 2 : set % 4, r, up: false }; }
let G = null;
const red = (c) => c.s === 1 || c.s === 2;
const alt = (a, b) => red(a) !== red(b) && b.r === a.r + 1;
const enc = (a) => a.map((c) => c.uid * 2 + (c.up ? 1 : 0));
function snap() { return { t: G.tab.map(enc), s: enc(G.stock), w: enc(G.waste), f: G.found.map(enc), c: G.cells ? G.cells.map(enc) : null, m: G.moves, sc: G.score, ps: G.passes }; }
function restore(S) {
  const dec = (a) => a.map((v) => { const c = G.cards[v >> 1]; c.up = !!(v & 1); return c; });
  G.tab = S.t.map(dec); G.stock = dec(S.s); G.waste = dec(S.w); G.found = S.f.map(dec); G.cells = S.c ? S.c.map(dec) : null; G.moves = S.m; G.score = S.sc; G.passes = S.ps || 0;
}
function begin(d, o = {}) {
  const V = VARIANTS[d.v];
  G = { v: d.v, V, type: V.game, seed: d.seed, daily: !!o.daily, tab: d.deal.tab, stock: d.deal.stock || [], waste: d.deal.waste || [], found: d.deal.found || [], cells: d.deal.cells ? d.deal.cells.map((c) => (c ? [c] : [])) : null,
    moves: 0, score: V.game === "spider" ? 500 : 0, time: 0, hist: [], won: false, started: false, passes: 0, undos: 0, hints: 0, stuckAt: -1 };
  G.cards = []; for (let u = 0; u < (V.game === "spider" ? 104 : 52); u++) G.cards[u] = null;
  for (const p of [...G.tab, G.stock, G.waste, ...G.found, ...(G.cells || [])]) for (const c of p) G.cards[c.uid] = c;
  SAVE.last = d.v; AUTO.on = false; CAS.on = false; CAS.hide = new Set(); CUR.held = null; clearHint();
  K.ui.hide(); $("#bar").hidden = false; layout(); dealAnim(); saveCur(); hud(); K.playSong("lounge", 1);
  if (V.game === "klondike") prefetch(d.v);
}
function resumeSaved() {
  const c = SAVE.cur, V = VARIANTS[c.v]; if (!V) return false;
  const total = V.game === "spider" ? 104 : 52;
  G = { v: c.v, V, type: V.game, seed: c.seed, daily: c.daily, tab: [], stock: [], waste: [], found: [], cells: null, moves: 0, score: 0, time: c.time || 0, hist: c.hist || [], won: false, started: !!c.started, passes: 0, undos: c.undos || 0, hints: c.hints || 0, stuckAt: -1 };
  G.cards = []; for (let u = 0; u < total; u++) G.cards[u] = cardOf(c.v, u);
  try { restore(c.state); } catch { SAVE.cur = null; persist(); G = null; return false; }
  AUTO.on = false; CAS.on = false; CAS.hide = new Set(); CUR.held = null; clearHint(); VIS.clear();
  K.ui.hide(); $("#bar").hidden = false; layout(); hud(); K.playSong("lounge", 1); scheduleAuto();
  return true;
}
function saveCur() { if (!G || G.won) { SAVE.cur = null; persist(); return; } SAVE.cur = { v: G.v, seed: G.seed, daily: G.daily, state: snap(), time: Math.round(G.time), hist: G.hist.slice(-80), started: G.started, undos: G.undos, hints: G.hints }; persist(); }

/* ================= rules ================= */
function pile(ref) { const k = ref[0], i = +ref.slice(1); return k === "t" ? G.tab[i] : k === "f" ? G.found[i] || [] : k === "c" ? G.cells[i] : k === "w" ? G.waste : G.stock; }
const tabRefs = () => G.tab.map((_, i) => "t" + i);
const foundRefs = () => (G.type === "spider" ? [] : [0, 1, 2, 3].map((i) => "f" + i));
const cellRefs = () => (G.cells ? [0, 1, 2, 3].map((i) => "c" + i) : []);
function runOK(p, i) {
  if (i < 0 || i >= p.length || !p[i].up) return false;
  for (let k = i; k < p.length - 1; k++) { const b = p[k], a = p[k + 1]; if (G.type === "spider" ? !(a.s === b.s && b.r === a.r + 1) : !alt(a, b)) return false; }
  return true;
}
function canPick(ref, i) {
  const p = pile(ref), k = ref[0]; if (!p || !p.length || i < 0 || i >= p.length) return false;
  if (k === "s") return false;
  if (k === "w" || k === "c") return i === p.length - 1;
  if (k === "f") return G.type === "klondike" && i === p.length - 1;
  return runOK(p, i);
}
const freeCells = () => (G.cells ? G.cells.filter((c) => !c.length).length : 0);
const emptyTabs = () => G.tab.filter((p) => !p.length).length;
const maxMove = (toEmpty) => (freeCells() + 1) * Math.pow(2, Math.max(0, emptyTabs() - (toEmpty ? 1 : 0)));
function canDrop(run, ref, from) {
  if (!run.length || ref === from) return false;
  const p = pile(ref), k = ref[0], c = run[0], top = p[p.length - 1];
  if (k === "t") {
    if (G.type === "freecell" && run.length > maxMove(!p.length)) return false;
    if (!p.length) return G.type === "klondike" ? c.r === 12 : true;
    if (!top.up) return false;
    return G.type === "spider" ? top.r === c.r + 1 : alt(c, top);
  }
  if (k === "f") { if (G.type === "spider" || run.length !== 1) return false; return top ? top.s === c.s && top.r === c.r - 1 : c.r === 0; }
  if (k === "c") return run.length === 1 && !p.length;
  return false;
}
function fHeight(s) { const p = G.found.find((q) => q.length && q[0].s === s); return p ? p.length : 0; }
function safeUp(c) { if (c.r <= 1) return true; for (let s = 0; s < 4; s++) if ((s === 1 || s === 2) !== red(c) && fHeight(s) < c.r) return false; return true; }
function foundFor(c) { for (let k = 0; k < 4; k++) { const p = G.found[k], t = p[p.length - 1]; if (t && t.s === c.s && t.r === c.r - 1) return "f" + k; } if (c.r === 0) { const k = G.found.findIndex((p) => !p.length); if (k >= 0) return "f" + k; } return null; }
function talonReach() {
  if (G.type !== "klondike") return [];
  if (G.V.draw === 1) return [...G.stock, ...G.waste];
  const out = [], seen = new Set(); let S = G.stock.slice(), W = G.waste.slice();
  const rec = () => { const c = W[W.length - 1]; if (c && !seen.has(c)) { seen.add(c); out.push(c); } };
  rec(); for (let pass = 0; pass < 2; pass++) { while (S.length) { for (let k = 0; k < 3 && S.length; k++) W.push(S.pop()); rec(); } if (!W.length) break; S = W.reverse(); W = []; }
  return out;
}

/* ================= moves ================= */
const AUTO = { on: false, t: 0 };
function act(fn, o = {}) {
  if (!G || G.won) return;
  G.hist.push(snap()); if (G.hist.length > 400) G.hist.shift();
  fn();
  if (!G.started) { G.started = true; SAVE.stats[G.v].played++; }
  clearHint(); if (checkWin()) return;
  if (!o.noAuto) scheduleAuto(); else AUTO.on = false;
  saveCur(); hud();
}
function flipTop(p) { const t = p[p.length - 1]; if (t && !t.up) { t.up = true; if (G.type === "klondike") G.score += 5; setTimeout(() => K.sfx("flip"), 120); return true; } return false; }
function moveCards(from, i, to) {
  const src = pile(from), run = src.splice(i), dst = pile(to);
  dst.push(...run); G.moves++;
  if (G.type === "klondike") {
    if (from === "w" && to[0] === "t") G.score += 5;
    else if (to[0] === "f" && from[0] !== "f") G.score += 10;
    else if (from[0] === "f") G.score = Math.max(0, G.score - 15);
  } else if (G.type === "spider") G.score = Math.max(0, G.score - 1);
  if (from[0] === "t") flipTop(src);
  if (G.type === "spider" && to[0] === "t") completeRun(+to.slice(1));
  if (to[0] === "f") K.sfx("found" + Math.min(12, run[0].r)); else K.sfx("place");
}
function doMove(from, i, to) { act(() => moveCards(from, i, to)); }
function completeRun(ti) {
  const p = G.tab[ti]; if (p.length < 13) return;
  const run = p.slice(-13); if (run[0].r !== 12) return;
  for (let k = 0; k < 13; k++) if (!run[k].up || run[k].s !== run[0].s || run[k].r !== 12 - k) return;
  p.splice(-13); run.reverse(); G.found.push(run); G.score += 100;
  run.forEach((c, k) => { const v = VIS.get(c.uid); if (v) v.delay = k * 0.035; });
  flipTop(p); setTimeout(() => K.sfx("complete"), 150);
}
function stockClick() {
  if (!G || G.won) return;
  if (G.type === "klondike") {
    if (G.stock.length) act(() => { const n = Math.min(G.V.draw, G.stock.length); for (let k = 0; k < n; k++) { const c = G.stock.pop(); c.up = true; G.waste.push(c); const v = VIS.get(c.uid); if (v) v.delay = k * 0.06; } G.moves++; K.sfx("draw"); });
    else if (G.waste.length) act(() => { while (G.waste.length) { const c = G.waste.pop(); c.up = false; G.stock.push(c); } G.moves++; G.passes++; G.score = Math.max(0, G.score - (G.V.draw === 1 ? 100 : 20)); K.sfx("recycle"); });
    else K.sfx("deny");
  } else if (G.type === "spider") {
    if (!G.stock.length) return K.sfx("deny");
    if (G.tab.some((p) => !p.length)) { K.sfx("deny"); K.toast("Fill every column first", "You can only deal when no column is empty."); return; }
    act(() => { for (let i = 0; i < 10; i++) { const c = G.stock.pop(); c.up = true; G.tab[i].push(c); const v = VIS.get(c.uid); if (v) v.delay = i * 0.045; } G.moves++; G.score = Math.max(0, G.score - 1); for (let i = 0; i < 10; i++) completeRun(i); K.sfx("deal"); });
  }
}
function undo() {
  if (!G || G.won || CAS.on) return;
  if (!G.hist.length) { K.sfx("deny"); return; }
  restore(G.hist.pop()); G.undos++; AUTO.on = false; CUR.held = null; clearHint(); K.sfx("undo"); saveCur(); hud();
}
function bestDest(run, from) {
  if (run.length === 1 && G.type !== "spider" && from[0] !== "f") { const f = foundFor(run[0]); if (f && canDrop(run, f, from)) return f; }
  const c = run[0], cands = tabRefs().filter((t) => canDrop(run, t, from));
  const score = (t) => { const p = pile(t), top = p[p.length - 1]; if (!top) return G.type === "klondike" ? 1 : run.length === pile(from).length && from[0] === "t" ? -9 : 0; return 10 + (G.type === "spider" && top.s === c.s ? 10 : 0); };
  cands.sort((a, b) => score(b) - score(a));
  if (cands.length && score(cands[0]) > -5) return cands[0];
  if (G.type === "freecell" && run.length === 1 && from[0] !== "c") { const cr = cellRefs().find((r) => canDrop(run, r, from)); if (cr) return cr; }
  return null;
}
function autoMove(ref, i) {
  const run = pile(ref).slice(i), d = bestDest(run, ref);
  if (d) doMove(ref, i, d); else { K.sfx("deny"); for (const c of run) { const v = VIS.get(c.uid); if (v) v.shake = 0.3; } }
}

/* ---------- auto foundation + finishing ---------- */
function scheduleAuto() { AUTO.on = true; AUTO.t = 0.16; }
function finishable() {
  if (G.type === "klondike") return G.tab.every((p) => p.every((c) => c.up)) && (G.V.draw === 1 || (!G.stock.length && !G.waste.length));
  if (G.type === "freecell") return G.tab.every((p) => p.every((c, k) => k === 0 || p[k - 1].r > c.r));
  return false;
}
function autoStep() {
  if (G.type === "spider" || G.won) return false;
  const fin = finishable(); if (!fin && !SAVE.opts.autoF) return false;
  const srcs = [...tabRefs(), ...(G.type === "klondike" ? ["w"] : cellRefs())];
  let best = null;
  for (const ref of srcs) { const p = pile(ref), c = p[p.length - 1]; if (!c || !c.up) continue; const f = foundFor(c); if (f && (fin || safeUp(c)) && (!best || c.r < best.c.r)) best = { ref, i: p.length - 1, f, c }; }
  if (best) { moveCards(best.ref, best.i, best.f); return true; }
  if (fin && G.type === "klondike" && (G.stock.length || G.waste.length)) { if (G.stock.length) { const c = G.stock.pop(); c.up = true; G.waste.push(c); } else { while (G.waste.length) { const c = G.waste.pop(); c.up = false; G.stock.push(c); } } G.moves++; K.sfx("draw"); return true; }
  return false;
}

/* ---------- hints ---------- */
function legalMoves() {
  const out = [], srcs = [...tabRefs(), ...(G.type === "klondike" ? ["w", ...foundRefs()] : []), ...cellRefs()];
  const dsts = [...foundRefs(), ...tabRefs(), ...cellRefs()];
  for (const from of srcs) {
    const p = pile(from);
    for (let i = p.length - 1; i >= 0; i--) {
      if (!canPick(from, i)) break;
      const run = p.slice(i); let emptyT = false, emptyC = false;
      for (const to of dsts) {
        const q = pile(to); if (!q.length) { if (to[0] === "t") { if (emptyT) continue; } if (to[0] === "c") { if (emptyC) continue; } }
        if (canDrop(run, to, from)) { if (!q.length && to[0] === "t") emptyT = true; if (to[0] === "c") emptyC = true; out.push({ from, i, to, n: run.length }); }
      }
    }
  }
  return out;
}
function rate(m) {
  const src = pile(m.from), base = src[m.i], below = src[m.i - 1], dst = pile(m.to), top = dst[dst.length - 1], k = m.to[0];
  let s = 0;
  if (k === "f") s += 100 - base.r;
  if (m.from[0] === "f") s -= 120;
  if (m.from[0] === "t") {
    if (below && !below.up) s += 60 + src.filter((c) => !c.up).length;
    else if (!below && k === "t" && !dst.length) s -= 200;
    else if (!below && k !== "f") s += G.type === "klondike" ? 2 : 35;
    if (below && below.up && k !== "f") {
      const sits = G.type === "spider" ? below.r === base.r + 1 : alt(base, below);
      if (sits) s += G.type === "spider" && below.s !== base.s && top && top.s === base.s ? 25 : -200;
    }
  }
  if (m.from === "w" && k === "t") s += 40;
  if (m.from[0] === "c" && k !== "c") s += 30;
  if (k === "c") s -= 25;
  if (k === "t" && top && G.type === "spider" && top.s === base.s) s += 20;
  if (k === "t" && !dst.length) s -= 12;
  return s;
}
function heuristicHint() {
  const ms = legalMoves().map((m) => ({ ...m, s: rate(m) })).filter((m) => m.s > -60).sort((a, b) => b.s - a.s);
  if (ms.length) return { move: ms[0] };
  if (G.type === "klondike" && (G.stock.length || G.waste.length)) { const tal = talonReach(), top = G.waste[G.waste.length - 1]; if (tal.some((c) => c !== top && (foundFor(c) || tabRefs().some((t) => canDrop([c], t, "w"))))) return { draw: true }; }
  if (G.type === "spider" && G.stock.length) return { draw: true };
  return null;
}
let HINT = null;
function clearHint() { HINT = null; }
function showHint(h, note) {
  if (!h) { K.toast("No useful moves", G.hist.length ? "Try undoing a few moves." : "This deal is stuck."); K.sfx("deny"); return; }
  G.hints++;
  if (h.draw) { HINT = { uids: [], ref: G.type === "klondike" ? "s" : "s", t: 0 }; K.toast(G.type === "spider" ? "Deal a new row" : "Draw from the stock", note || ""); }
  else { const p = pile(h.move.from); HINT = { uids: p.slice(h.move.i).map((c) => c.uid), ref: h.move.to, t: 0 }; if (note) K.toast(note); }
  K.sfx("hint");
}
async function hint() {
  if (!G || G.won || CAS.on) return;
  const h = heuristicHint();
  if (G.type === "klondike" && worker) {
    const game = { tab: G.tab, stock: G.stock, waste: G.waste, found: G.found };
    const r = await ask({ cmd: "solve", game, draw: G.V.draw, budget: 30000 }, 1600);
    if (r && r.solved && r.first) { const m = r.first, top = G.waste[G.waste.length - 1];
      if (m.k === "tf") { const f = foundFor(G.cards[m.c]); return showHint({ move: { from: "t" + m.i, i: G.tab[m.i].length - 1, to: f } }); }
      if (m.k === "tt") { const i = G.tab[m.i].findIndex((c) => c.uid === m.c); if (i >= 0) return showHint({ move: { from: "t" + m.i, i, to: "t" + m.j } }); }
      if ((m.k === "lf" || m.k === "lt") && top && top.uid === m.c) return showHint({ move: { from: "w", i: G.waste.length - 1, to: m.k === "lf" ? foundFor(top) : "t" + m.j } });
      if (m.k === "lf" || m.k === "lt") return showHint({ draw: true });
    }
    if (r && !r.solved && !r.unknown) return showHint(h, "No winning line from here. Undo may help.");
  }
  showHint(h);
}
function checkStuck() {
  if (!G || G.won || G.hist.length === G.stuckAt) return;
  if (heuristicHint()) return;
  G.stuckAt = G.hist.length;
  K.confirm({ title: "No more moves", text: "Nothing useful is left to play here. You can undo, or deal again.", yes: "New deal", no: "Keep playing", focusNo: true }).then((y) => { if (y) newGame(G.v, { force: true }); });
}
function checkWin() {
  const done = G.type === "spider" ? G.found.length === 8 : G.found.reduce((a, p) => a + p.length, 0) === 52;
  if (!done) return false;
  G.won = true; AUTO.on = false; CUR.held = null;
  const st = SAVE.stats[G.v]; st.won++; st.streak++; st.best = Math.max(st.best, st.streak);
  const ms = Math.round(G.time * 1000); G.pbTime = !st.time || ms < st.time; G.pbMoves = !st.moves || G.moves < st.moves;
  if (G.pbTime) st.time = ms; if (G.pbMoves) st.moves = G.moves;
  if (G.type === "klondike" && G.time >= 30) G.score += Math.round(700000 / G.time);
  if (G.daily) { if (SAVE.daily.date !== dailyKey()) SAVE.daily = { date: dailyKey(), done: {} }; SAVE.daily.done[G.v] = { time: Math.round(G.time), moves: G.moves }; }
  SAVE.cur = null; persist(); hud(); K.sfx("win"); K.vibrate(80);
  const g = G; setTimeout(() => { if (G === g) startCascade(); }, 500); setTimeout(() => { if (G === g && !K.ui.active()) results(); }, 4200);
  return true;
}

/* ================= layout + drawing ================= */
const cv = $("#cv"), ctx = cv.getContext("2d");
const L = { W: 0, H: 0, full: 0, dpr: 1, cw: 60, ch: 84, gap: 8, pad: 10, P: {}, fu: 0.28, fd: 0.1 };
let FELT = null;
function layout() {
  const bar = $("#bar"), bh = bar.hidden ? 0 : bar.offsetHeight;
  const d = K.fit(cv, innerWidth, innerHeight); L.dpr = d.dpr; L.W = innerWidth; L.full = innerHeight; L.H = innerHeight - bh; FELT = null;
  if (!G) return;
  const cols = G.type === "klondike" ? 7 : G.type === "spider" ? 10 : 8, gx = G.type === "spider" ? 0.1 : 0.14;
  L.pad = Math.max(8, Math.min(L.W, L.H) * 0.022);
  let cw = (L.W - L.pad * 2) / (cols + (cols - 1) * gx);
  cw = Math.floor(Math.min(cw, (L.H - L.pad * 2) / (1.4 * (G.type === "spider" ? 3.25 : 2.85))));
  const ch = Math.round(cw * 1.4), gap = Math.round(cw * gx);
  L.cw = cw; L.ch = ch; L.gap = gap;
  const total = cols * cw + (cols - 1) * gap, x0 = Math.round((L.W - total) / 2), colX = (i) => x0 + i * (cw + gap);
  const y0 = Math.round(L.pad), y1 = Math.round(y0 + ch + Math.max(L.pad, ch * 0.16));
  L.P = {}; for (let i = 0; i < cols; i++) L.P["t" + i] = { x: colX(i), y: y1 };
  if (G.type === "klondike") { L.P.s = { x: colX(0), y: y0 }; L.P.w = { x: colX(1), y: y0 }; for (let i = 0; i < 4; i++) L.P["f" + i] = { x: colX(3 + i), y: y0 }; }
  else if (G.type === "freecell") for (let i = 0; i < 4; i++) { L.P["c" + i] = { x: colX(i), y: y0 }; L.P["f" + i] = { x: colX(4 + i), y: y0 }; }
  else { L.P.s = { x: colX(9), y: y0 }; for (let i = 0; i < 8; i++) L.P["f" + i] = { x: colX(0) + i * cw * 0.18, y: y0 }; }
  CARDS.setSize(cw, ch, L.dpr);
}
addEventListener("resize", () => { layout(); });
function felt() {
  if (FELT) return FELT;
  const F = FELTS[SAVE.opts.felt] || FELTS[0], c = document.createElement("canvas"), w = Math.round(L.W * L.dpr), h = Math.round(L.full * L.dpr); c.width = w; c.height = h; const g = c.getContext("2d");
  const gr = g.createRadialGradient(w / 2, h * 0.38, 0, w / 2, h * 0.45, Math.max(w, h) * 0.75); gr.addColorStop(0, F.a); gr.addColorStop(1, F.b); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const r = K.RNG(3); for (let i = 0; i < (w * h) / 90; i++) { g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.04)"; g.fillRect(r() * w, r() * h, 1.2, 1.2); }
  return (FELT = c);
}
/* target positions for every card */
function targets() {
  const T = new Map(), { cw, ch } = L; let z = 0;
  const put = (c, x, y, flat) => T.set(c.uid, { x, y, up: c.up, z: z++, flat });
  if (G.type === "klondike") {
    G.stock.forEach((c, i) => put(c, L.P.s.x - Math.floor(i / 8), L.P.s.y - Math.floor(i / 8), i < G.stock.length - 1));
    const n = G.waste.length, fan = G.V.draw === 3 ? Math.min(3, n) : 1;
    G.waste.forEach((c, i) => { const k = i - (n - fan); put(c, L.P.w.x + (k > 0 ? k * cw * 0.26 : 0) - (k < 0 ? Math.floor(i / 8) : 0), L.P.w.y, k < 0); });
  }
  if (G.type === "spider") {
    const groups = Math.ceil(G.stock.length / 10); G.stock.forEach((c, i) => { const g = (i / 10) | 0; put(c, L.P.s.x - (groups - 1 - g) * cw * 0.2, L.P.s.y, i % 10 !== 9); });
    G.found.forEach((run, k) => run.forEach((c, i) => put(c, L.P["f" + k].x, L.P["f" + k].y, i < 12)));
  } else G.found.forEach((p, k) => p.forEach((c, i) => put(c, L.P["f" + k].x - Math.floor(i / 6) * 0.5, L.P["f" + k].y - Math.floor(i / 6) * 0.5, i < p.length - 1)));
  if (G.cells) G.cells.forEach((p, k) => p.forEach((c) => put(c, L.P["c" + k].x, L.P["c" + k].y)));
  const avail = L.H - L.pad - (L.P.t0 ? L.P.t0.y : 0);
  L.offs = [];
  G.tab.forEach((p, i) => {
    const sp = G.type === "spider", P = L.P["t" + i]; let fd = ch * (avail > ch * 6 ? 0.14 : 0.1), fu = ch * clamp((avail - ch) / (sp ? 18 : 14) / ch, sp ? 0.24 : 0.27, sp ? 0.36 : 0.42);
    const nd = p.filter((c, k) => k < p.length - 1 && !c.up).length, nu = p.filter((c, k) => k < p.length - 1 && c.up).length;
    const need = () => nd * fd + nu * fu + ch;
    if (need() > avail) { fu = Math.max(ch * 0.12, (avail - ch - nd * fd) / Math.max(1, nu)); if (need() > avail) fd = Math.max(ch * 0.03, (avail - ch - nu * fu) / Math.max(1, nd)); }
    L.offs[i] = { fd, fu }; let y = P.y; for (const c of p) { put(c, P.x, y); y += c.up ? fu : fd; }
  });
  return T;
}
const VIS = new Map(); let TGT = new Map();
function dealAnim() {
  VIS.clear(); TGT = targets();
  const ox = G.type === "freecell" ? L.W / 2 - L.cw / 2 : L.P.s.x, oy = G.type === "freecell" ? L.H + 20 : L.P.s.y;
  const order = []; const maxLen = Math.max(...G.tab.map((p) => p.length));
  for (let r = 0; r < maxLen; r++) G.tab.forEach((p) => { if (p[r]) order.push(p[r]); });
  order.forEach((c, k) => VIS.set(c.uid, { x: ox, y: oy, face: false, flip: 0, delay: 0.25 + k * (G.type === "spider" ? 0.014 : 0.022), shake: 0 }));
  K.sfx("shuffle");
}
function updateVis(dt) {
  TGT = targets();
  const k = 1 - Math.exp(-dt * 16);
  if (CUR.held && !DRAG.on) { const run = pile(CUR.held.ref).slice(CUR.held.i), a = attachPoint(CUR.ref, CUR.held); run.forEach((c, j) => { const t = TGT.get(c.uid); if (t) { t.x = a.x + L.cw * 0.06; t.y = a.y - L.ch * 0.1 + j * L.ch * 0.24; t.z = 5000 + j; } }); }
  for (const [uid, t] of TGT) {
    let v = VIS.get(uid); if (!v) { v = { x: t.x, y: t.y, face: t.up, flip: 0, delay: 0, shake: 0 }; VIS.set(uid, v); }
    if (v.delay > 0) { v.delay -= dt; if (v.delay <= 0 && G && !G.won) K.sfx("tick"); continue; }
    if (DRAG.on && DRAG.uids.has(uid)) { const o = DRAG.off.get(uid); v.x += (DRAG.px + o.x - v.x) * Math.min(1, k * 2.4); v.y += (DRAG.py + o.y - v.y) * Math.min(1, k * 2.4); }
    else { v.x += (t.x - v.x) * k; v.y += (t.y - v.y) * k; if (Math.abs(t.x - v.x) < 0.25) v.x = t.x; if (Math.abs(t.y - v.y) < 0.25) v.y = t.y; }
    if (v.face !== t.up && (v.flip > 0 || Math.abs(t.x - v.x) + Math.abs(t.y - v.y) < L.cw * 0.8)) { v.flip += dt / 0.2; if (v.flip >= 1) { v.flip = 0; v.face = t.up; } }
    if (v.shake > 0) v.shake = Math.max(0, v.shake - dt);
  }
}
function drawCard(c, v, lifted, flat) {
  const { cw, ch } = L; let x = v.x; if (v.shake > 0) x += Math.sin(v.shake * 70) * v.shake * 22;
  const f = v.flip, sx = f > 0 ? Math.max(0.02, Math.abs(1 - 2 * f)) : 1, up = f > 0 ? (f < 0.5 ? v.face : !v.face) : v.face, sh = CARDS.shadow(), p = sh.pad;
  ctx.save(); ctx.translate(x + cw / 2, v.y + ch / 2); ctx.scale(sx, 1);
  if (lifted) { ctx.globalAlpha = 0.9; ctx.drawImage(sh, -cw / 2 - p + 3, -ch / 2 - p + 7, cw + p * 2, ch + p * 2); ctx.globalAlpha = 1; } else if (!flat) ctx.drawImage(sh, -cw / 2 - p, -ch / 2 - p, cw + p * 2, ch + p * 2);
  ctx.drawImage(up ? CARDS.face(c) : CARDS.back(), -cw / 2, -ch / 2, cw, ch);
  ctx.restore();
}
function slot(ref, label) {
  const P = L.P[ref]; if (!P) return; const { cw, ch } = L;
  K.roundRect(ctx, P.x + 1, P.y + 1, cw - 2, ch - 2, cw * 0.075); ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fill(); ctx.strokeStyle = "rgba(255,245,220,0.22)"; ctx.lineWidth = 1.5; ctx.stroke();
  if (label === "A") { ctx.fillStyle = "rgba(255,245,220,0.22)"; ctx.font = `700 ${cw * 0.42}px Cinzel, Georgia, serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("A", P.x + cw / 2, P.y + ch / 2); }
  else if (label === "↻") { ctx.strokeStyle = "rgba(255,245,220,0.35)"; ctx.lineWidth = Math.max(2, cw * 0.05); ctx.beginPath(); ctx.arc(P.x + cw / 2, P.y + ch / 2, cw * 0.22, -Math.PI * 0.3, Math.PI * 1.4); ctx.stroke(); const a = Math.PI * 1.4, ax = P.x + cw / 2 + Math.cos(a) * cw * 0.22, ay = P.y + ch / 2 + Math.sin(a) * cw * 0.22; ctx.beginPath(); ctx.moveTo(ax - cw * 0.08, ay - cw * 0.02); ctx.lineTo(ax + cw * 0.03, ay + cw * 0.08); ctx.lineTo(ax + cw * 0.07, ay - cw * 0.07); ctx.closePath(); ctx.fillStyle = "rgba(255,245,220,0.35)"; ctx.fill(); }
  else if (label === "cell") { ctx.fillStyle = "rgba(255,245,220,0.1)"; ctx.fillRect(P.x + cw * 0.3, P.y + ch / 2 - 1, cw * 0.4, 2); }
}
function refRect(ref) {
  const P = L.P[ref]; if (!P) return null; const { cw, ch } = L;
  if (ref[0] === "t") { const p = pile(ref); let y1 = P.y + ch; if (p.length) { const t = TGT.get(p[p.length - 1].uid); if (t) y1 = t.y + ch; } return { x: P.x, y: P.y, w: cw, h: y1 - P.y }; }
  if (ref === "w") { const p = G.waste, t = p.length && TGT.get(p[p.length - 1].uid); return t ? { x: t.x, y: t.y, w: cw, h: ch } : { x: P.x, y: P.y, w: cw, h: ch }; }
  if (ref === "s" && G.type === "spider") { const groups = Math.max(1, Math.ceil(G.stock.length / 10)); return { x: P.x - (groups - 1) * cw * 0.2, y: P.y, w: cw + (groups - 1) * cw * 0.2, h: ch }; }
  return { x: P.x, y: P.y, w: cw, h: ch };
}
function attachPoint(ref, held) {
  const P = L.P[ref], p = pile(ref); if (!P) return { x: 0, y: 0 };
  if (ref[0] === "t" && p.length) { const last = p[p.length - 1], t = TGT.get(last.uid), same = held && held.ref === ref; if (t) return { x: P.x, y: same ? (TGT.get(p[held.i].uid) || t).y : t.y + (L.offs[+ref.slice(1)] || { fu: L.ch * 0.27 }).fu }; }
  return { x: P.x, y: P.y };
}
let T = 0;
function render(dt) {
  T += dt;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.drawImage(felt(), 0, 0, L.W, L.full);
  if (!G) return;
  updateVis(dt);
  // slots
  for (const r of tabRefs()) slot(r);
  for (const r of foundRefs()) slot(r, "A");
  for (const r of cellRefs()) slot(r, "cell");
  if (G.type === "klondike") slot("s", !G.stock.length && G.waste.length ? "↻" : "");
  if (G.type === "spider") { slot("f0"); if (!G.stock.length) slot("s"); }
  // cards, with flying/dragged ones on top
  const list = [];
  for (const [uid, t] of TGT) { const v = VIS.get(uid); if (CAS.hide.has(uid)) continue; const fly = v.delay > 0 ? 0 : Math.abs(v.x - t.x) + Math.abs(v.y - t.y) > 3 ? 1 : 0, dr = DRAG.on && DRAG.uids.has(uid); list.push({ c: G.cards[uid], v, k: (dr || t.z >= 5000 ? 2e6 : fly ? 1e6 : 0) + t.z, dr: dr || t.z >= 5000, flat: t.flat && !fly && v.delay <= 0 }); }
  list.sort((a, b) => a.k - b.k);
  for (const o of list) drawCard(o.c, o.v, o.dr, o.flat);
  // hint glow
  if (HINT) {
    HINT.t += dt; const a = 0.55 + Math.sin(HINT.t * 7) * 0.35; ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,215,122,${a})`; ctx.shadowColor = "rgba(255,215,122,0.8)"; ctx.shadowBlur = 12;
    for (const u of HINT.uids) { const v = VIS.get(u); if (v) { K.roundRect(ctx, v.x - 1, v.y - 1, L.cw + 2, L.ch + 2, L.cw * 0.08); ctx.stroke(); } }
    const r = refRect(HINT.ref); if (r) { ctx.strokeStyle = `rgba(143,227,168,${a})`; ctx.shadowColor = "rgba(143,227,168,0.8)"; K.roundRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, L.cw * 0.09); ctx.stroke(); }
    ctx.shadowBlur = 0; if (HINT.t > 2.6) HINT = null;
  }
  // keyboard / controller cursor
  if (CUR.on && !G.won && (K.device === "kb" || K.device === "pad")) {
    const p = pile(CUR.ref), c = CUR.i >= 0 && p[CUR.i], v = c && VIS.get(c.uid), P = L.P[CUR.ref];
    if (P) { let r; if (v && !CUR.held) { const last = p[p.length - 1], vl = VIS.get(last.uid); r = { x: v.x, y: v.y, w: L.cw, h: vl.y - v.y + L.ch }; } else r = CUR.ref === "s" ? refRect("s") : { x: P.x, y: P.y, w: L.cw, h: L.ch };
      ctx.lineWidth = 3; ctx.strokeStyle = CUR.held ? "#8fe3a8" : "#ffd77a"; K.roundRect(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, L.cw * 0.1); ctx.stroke(); }
  }
  if (CAS.on) drawCascade(dt);
}

/* ================= win cascade ================= */
const CAS = { on: false, hide: new Set(), queue: [], live: [], t: 0, trail: null };
function startCascade() {
  CAS.on = true; CAS.done = false; CAS.hide = new Set(); CAS.live = []; CAS.t = 0; CAS.queue = [];
  const piles = G.type === "spider" ? G.found.map((r) => r) : G.found;
  for (let r = 12; r >= 0; r--) piles.forEach((p, k) => { const c = p.find((x) => x.r === r); if (c) CAS.queue.push({ c, ref: "f" + k }); });
  CAS.trail = document.createElement("canvas"); CAS.trail.width = cv.width; CAS.trail.height = cv.height;
}
function drawCascade(dt) {
  CAS.t -= dt;
  if (CAS.t <= 0 && CAS.queue.length) {
    const q = CAS.queue.shift(), v = VIS.get(q.c.uid) || { x: L.W / 2, y: 0 }; CAS.hide.add(q.c.uid); CAS.t = G.type === "spider" ? 0.07 : 0.12;
    CAS.live.push({ c: q.c, x: v.x, y: v.y, vx: (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 300), vy: -Math.random() * 380 });
  }
  const g = CAS.trail.getContext("2d"); g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  const floor = L.H;
  for (const o of CAS.live) {
    for (let s = 0; s < 3; s++) {
      const h = dt / 3; o.vy += 1500 * h; o.x += o.vx * h; o.y += o.vy * h;
      if (o.y + L.ch > floor) { o.y = floor - L.ch; o.vy *= -(0.62 + Math.random() * 0.15); if (Math.abs(o.vy) > 150) K.sfx("tick"); }
      g.drawImage(CARDS.face(o.c), o.x, o.y, L.cw, L.ch);
    }
  }
  CAS.live = CAS.live.filter((o) => o.x > -L.cw - 4 && o.x < L.W + 4);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(CAS.trail, 0, 0); ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  if (!CAS.queue.length && !CAS.live.length && G && G.won && !CAS.done) { CAS.done = true; results(); }
}

/* ================= input ================= */
const DRAG = { pending: null, on: false, uids: new Set(), off: new Map(), px: 0, py: 0, ref: "", i: 0 };
function hit(x, y) {
  const inR = (r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  for (const ref of tabRefs()) { const p = pile(ref); for (let i = p.length - 1; i >= 0; i--) { const t = TGT.get(p[i].uid); if (t && x >= t.x && x < t.x + L.cw && y >= t.y && y < t.y + L.ch) return { ref, i }; } if (!p.length && inR(refRect(ref))) return { ref, i: -1 }; }
  if (G.type === "klondike") { if (inR(refRect("w")) && G.waste.length) return { ref: "w", i: G.waste.length - 1 }; if (inR(refRect("s"))) return { ref: "s", i: -1 }; }
  if (G.type === "spider" && inR(refRect("s"))) return { ref: "s", i: -1 };
  for (const ref of [...foundRefs(), ...cellRefs()]) if (inR(refRect(ref))) { const p = pile(ref); return { ref, i: p.length - 1 }; }
  return null;
}
cv.addEventListener("contextmenu", (e) => e.preventDefault());
cv.addEventListener("pointerdown", (e) => {
  if (!G || K.ui.active()) return;
  if (G.won) { if (CAS.on) { CAS.queue = []; } return; }
  K.audio(); clearHint(); CUR.on = false; CUR.held = null;
  if (finishable() && AUTO.on) return;
  const h = hit(e.clientX, e.clientY); if (!h) return;
  if (h.ref === "s") { stockClick(); return; }
  if (h.i < 0) return;
  if (!canPick(h.ref, h.i)) { const c = pile(h.ref)[h.i]; if (c && c.up) { const v = VIS.get(c.uid); if (v) v.shake = 0.25; K.sfx("deny"); } return; }
  DRAG.pending = { ref: h.ref, i: h.i, x0: e.clientX, y0: e.clientY, id: e.pointerId, dbl: performance.now() };
  try { cv.setPointerCapture(e.pointerId); } catch {}
});
cv.addEventListener("pointermove", (e) => {
  const pd = DRAG.pending; if (!pd || e.pointerId !== pd.id) return;
  if (!DRAG.on && Math.hypot(e.clientX - pd.x0, e.clientY - pd.y0) > 6) {
    DRAG.on = true; DRAG.ref = pd.ref; DRAG.i = pd.i; DRAG.uids = new Set(); DRAG.off = new Map(); AUTO.on = false;
    const run = pile(pd.ref).slice(pd.i), v0 = VIS.get(run[0].uid), fu = L.offs[+pd.ref.slice(1)] ? L.offs[+pd.ref.slice(1)].fu : L.ch * 0.27;
    run.forEach((c, k) => { DRAG.uids.add(c.uid); DRAG.off.set(c.uid, { x: v0.x - pd.x0, y: v0.y - pd.y0 + k * Math.min(fu, L.offs[+pd.ref.slice(1)] ? Math.max(L.offs[+pd.ref.slice(1)].fu, fu * 0.8) : fu) }); });
    K.sfx("pick");
  }
  if (DRAG.on) { DRAG.px = e.clientX; DRAG.py = e.clientY; }
});
function endPointer(e, cancel) {
  const pd = DRAG.pending; if (!pd || (e && e.pointerId !== pd.id)) return;
  DRAG.pending = null;
  if (DRAG.on) {
    DRAG.on = false; if (cancel) return;
    const run = pile(DRAG.ref).slice(DRAG.i), v = VIS.get(run[0].uid), r = { x: v.x, y: v.y, w: L.cw, h: L.ch };
    let best = null, ba = 0;
    for (const ref of [...tabRefs(), ...foundRefs(), ...cellRefs()]) {
      if (!canDrop(run, ref, DRAG.ref)) continue; const q = refRect(ref); if (!q) continue;
      const ox = Math.min(r.x + r.w, q.x + q.w) - Math.max(r.x, q.x), oy = Math.min(r.y + r.h, q.y + q.h + L.ch * 0.4) - Math.max(r.y, q.y);
      if (ox > 0 && oy > 0 && ox * oy > ba) { ba = ox * oy; best = ref; }
    }
    if (best) doMove(DRAG.ref, DRAG.i, best); else K.sfx("back");
  } else if (!cancel) autoMove(pd.ref, pd.i);
}
cv.addEventListener("pointerup", (e) => endPointer(e, false));
cv.addEventListener("pointercancel", (e) => endPointer(e, true));

/* keyboard + controller cursor */
const CUR = { on: false, ref: "t0", i: 0, held: null };
function rows() { const top = G.type === "klondike" ? ["s", "w", "f0", "f1", "f2", "f3"] : G.type === "freecell" ? [...cellRefs(), ...foundRefs()] : ["s"]; return [top, tabRefs()]; }
const topIdx = (ref) => pile(ref).length - 1;
function nearest(row, ref) { const x = (L.P[ref] || { x: 0 }).x; let b = row[0], bd = Infinity; for (const r of row) { const d = Math.abs((L.P[r] || { x: 0 }).x - x); if (d < bd) { bd = d; b = r; } } return b; }
function curMove(dx, dy) {
  if (!G || G.won) return;
  if (!CUR.on) { CUR.on = true; if (!L.P[CUR.ref]) CUR.ref = "t0"; CUR.i = topIdx(CUR.ref); return; }
  const [top, tab] = rows(), inTop = top.includes(CUR.ref);
  if (dx) { const row = inTop ? top : tab; let k = row.indexOf(CUR.ref); k = (k + dx + row.length) % row.length; CUR.ref = row[k]; CUR.i = topIdx(CUR.ref); }
  else if (dy < 0) { if (inTop) return; if (!CUR.held && CUR.i - 1 >= 0 && canPick(CUR.ref, CUR.i - 1)) CUR.i--; else { CUR.ref = nearest(top, CUR.ref); CUR.i = topIdx(CUR.ref); } }
  else if (dy > 0) { if (inTop) { CUR.ref = nearest(tab, CUR.ref); CUR.i = topIdx(CUR.ref); } else if (CUR.i < topIdx(CUR.ref)) CUR.i++; }
  K.sfx("move");
}
function curAct() {
  if (!G || G.won) return;
  if (!CUR.on) { CUR.on = true; CUR.i = topIdx(CUR.ref); return; }
  if (CUR.held) {
    const h = CUR.held; CUR.held = null;
    if (h.ref === CUR.ref) { K.sfx("back"); return; }
    const run = pile(h.ref).slice(h.i);
    if (canDrop(run, CUR.ref, h.ref)) doMove(h.ref, h.i, CUR.ref); else K.sfx("deny");
    CUR.i = topIdx(CUR.ref); return;
  }
  if (CUR.ref === "s") return stockClick();
  if (canPick(CUR.ref, CUR.i)) { CUR.held = { ref: CUR.ref, i: CUR.i }; K.sfx("pick"); } else K.sfx("deny");
}
function curQuick() { if (!CUR.on || CUR.held) return; if (CUR.ref === "s") return stockClick(); if (canPick(CUR.ref, CUR.i)) { autoMove(CUR.ref, CUR.i); CUR.i = topIdx(CUR.ref); } else K.sfx("deny"); }
addEventListener("keydown", (e) => {
  if (!G || K.ui.active()) return;
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); return undo(); }
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.code];
  if (dir) { e.preventDefault(); curMove(dir[0], dir[1]); return; }
  if (e.code === "Enter") { e.preventDefault(); curAct(); }
  else if (e.code === "Space") { e.preventDefault(); if (CUR.on && !CUR.held) curQuick(); else stockClick(); }
  else if (e.code === "KeyD") stockClick();
  else if (e.code === "KeyH") hint();
  else if (e.code === "KeyU") undo();
  else if (e.code === "KeyN") newGame(G.v);
  else if (e.code === "Escape") { if (CUR.held) { CUR.held = null; K.sfx("back"); } else menu(); }
});
function pollPad() {
  const P = K.pad; if (!P.connected || !G || K.ui.active()) return;
  const pr = P.pressed;
  if (pr.du) curMove(0, -1); if (pr.dd) curMove(0, 1); if (pr.dl) curMove(-1, 0); if (pr.dr) curMove(1, 0);
  if (pr.a) curAct(); if (pr.b) { if (CUR.held) { CUR.held = null; K.sfx("back"); } }
  if (pr.x) curQuick(); if (pr.rb) stockClick(); if (pr.y) hint(); if (pr.lb) undo(); if (pr.start) menu(); if (pr.back) newGame(G.v);
}

/* ================= audio ================= */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
const sfxMap = {
  place: (t) => { K.noise(t, 0.05, { filter: "lowpass", freq: 1100, vol: 0.11 }); K.voice(170, t, 0.06, { type: "sine", vol: 0.05, slide: 0.6 }); },
  pick: (t) => K.noise(t, 0.045, { filter: "bandpass", freq: 2400, vol: 0.035, q: 0.7 }),
  flip: (t) => K.noise(t, 0.07, { filter: "highpass", freq: 2600, vol: 0.045, slide: 0.5 }),
  tick: (t) => K.noise(t, 0.03, { filter: "highpass", freq: 3200, vol: 0.022 }),
  draw: (t) => { K.noise(t, 0.06, { filter: "highpass", freq: 2200, vol: 0.05, slide: 0.6 }); },
  deal: (t) => { for (let i = 0; i < 6; i++) K.noise(t + i * 0.045, 0.04, { filter: "highpass", freq: 2600, vol: 0.035 }); },
  recycle: (t) => K.noise(t, 0.35, { filter: "bandpass", freq: 900, slide: 2.2, vol: 0.06, attack: 0.05 }),
  shuffle: (t) => { for (let i = 0; i < 14; i++) K.noise(t + i * 0.03, 0.035, { filter: "highpass", freq: 2000 + Math.random() * 1500, vol: 0.03 }); },
  undo: (t) => K.voice(520, t, 0.09, { type: "sine", vol: 0.04, slide: 0.65 }),
  hint: (t) => K.notes(t, [880, 1175], 0.07, { type: "sine", vol: 0.045, len: 0.25 }),
  complete: (t) => K.notes(t, [523, 659, 784, 1046, 1318], 0.06, { type: "triangle", vol: 0.05, len: 0.3 }),
};
for (let r = 0; r <= 12; r++) sfxMap["found" + r] = (t) => { K.voice(K.hz(62 + PENTA[r]), t, 0.22, { type: "triangle", vol: 0.05 }); K.noise(t, 0.04, { filter: "lowpass", freq: 1200, vol: 0.06 }); };
K.defineSfx(sfxMap, { tick: 0.015, place: 0.03, flip: 0.03 });
K.songs({ lounge: { bpm: 76, chords: ["Dm7", "G7", "C", "Am", "Dm7", "G7", "Em", "A7"], pad: true, padVol: 0.022, arp: true, arpVol: 0.018, arpPat: [0, 2, 1, 4, 2, 1, 0, 2], arpWave: "triangle", bass: "R . . . . . F . O . . . F . . .", bassVol: 0.1, swing: 0.12 } });

/* ================= HUD + screens ================= */
function hud() {
  if (!G) return;
  $("#sTime").textContent = K.fmtTime(G.time);
  $("#sMoves").innerHTML = `<b>${G.moves}</b> moves`;
  $("#sScore").innerHTML = G.daily ? `<span class="daily">Daily</span>` : G.type === "freecell" ? `Deal <b>#${G.seed}</b>` : `Score <b>${G.score}</b>`;
  if (G.daily && G.type !== "freecell") $("#sScore").innerHTML += ` · Score <b>${G.score}</b>`;
}
function thumbImg(cards, fan = 0.32) {
  CARDS.setSize(64, 90, 2); const c = document.createElement("canvas"), n = cards.length; c.width = (64 + (n - 1) * 64 * fan + 24) * 2; c.height = 120 * 2; const g = c.getContext("2d"); g.scale(2, 2);
  cards.forEach((cd, k) => { const a = (k - (n - 1) / 2) * 0.13; g.save(); g.translate(12 + 32 + k * 64 * fan, 18 + 45 + Math.abs(k - (n - 1) / 2) * 4); g.rotate(a); g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 8; g.shadowOffsetY = 3; g.drawImage(cd.back ? CARDS.back() : CARDS.face(cd), -32, -45, 64, 90); g.restore(); });
  const url = c.toDataURL(); if (G) layout(); return url;
}
let THUMBS = null;
function thumbs() {
  if (THUMBS) return THUMBS;
  return (THUMBS = { k: thumbImg([{ back: 1 }, { s: 2, r: 6 }, { s: 0, r: 0 }, { s: 1, r: 12 }]), s: thumbImg([{ s: 0, r: 12 }, { s: 0, r: 11 }, { s: 0, r: 10 }, { s: 0, r: 9 }]), f: thumbImg([{ s: 3, r: 0 }, { s: 2, r: 0 }, { s: 1, r: 0 }, { s: 0, r: 0 }]) });
}
const pct = (st) => (st.played ? Math.round((st.won / st.played) * 100) + "%" : "–");
function gameLine(vs) { let p = 0, w = 0; for (const v of vs) { p += SAVE.stats[v].played; w += SAVE.stats[v].won; } return p ? `Won ${w} of ${p}` : "Not played yet"; }
function leaveGame() { if (G && !G.won) { saveCur(); } G = null; AUTO.on = false; CAS.on = false; $("#bar").hidden = true; }
function title() {
  leaveGame(); const th = thumbs(), cur = SAVE.cur && VARIANTS[SAVE.cur.v];
  K.playSong("lounge", 1);
  K.ui.show(`<div class="logo">PATIENCE</div><p class="k-sub">Three classic solitaires, dealt fair and played smooth.</p>
    ${cur ? `<button class="k-btn primary" data-a="continue" autofocus>Continue ${cur.name}${cur.sub ? " · " + cur.sub : ""} · ${K.fmtTime(SAVE.cur.time || 0)}</button>` : ""}
    <div class="games">
      <button class="k-btn gtile" data-a="pick" data-g="klondike" ${cur ? "" : "autofocus"}><img src="${th.k}" alt=""><b>Klondike</b><span>Build four suits from Ace to King.</span><em>${gameLine(["k1", "k3"])}</em></button>
      <button class="k-btn gtile" data-a="pick" data-g="spider"><img src="${th.s}" alt=""><b>Spider</b><span>Two decks. Build runs from King to Ace.</span><em>${gameLine(["s1", "s2", "s4"])}</em></button>
      <button class="k-btn gtile" data-a="pick" data-g="freecell"><img src="${th.f}" alt=""><b>FreeCell</b><span>Every card face up. Pure skill.</span><em>${gameLine(["fc"])}</em></button>
    </div>
    <div class="k-row"><button class="k-btn" data-a="stats">Stats</button><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>`, { cls: "soft" });
}
function dailyDone(v) { return SAVE.daily.date === dailyKey() && SAVE.daily.done[v]; }
function pickScreen(game) {
  const vs = Object.keys(VARIANTS).filter((v) => VARIANTS[v].game === game), name = VARIANTS[vs[0]].name;
  const dv = game === "klondike" ? "k1" : game === "spider" ? "s2" : "fc", dd = dailyDone(dv);
  const sub = { klondike: "Winnable deals are on, so every Klondike game can be won. You can change that in Settings.", spider: "One suit is relaxed. Four suits is a real challenge.", freecell: "Deals are numbered like the classic version. Almost all of them can be won." }[game];
  const btns = vs.map((v) => { const st = SAVE.stats[v]; return `<button class="k-btn ${v === SAVE.last ? "primary" : ""}" data-a="new" data-v="${v}" ${v === SAVE.last || (!vs.includes(SAVE.last) && v === vs[0]) ? "autofocus" : ""}><b>${VARIANTS[v].sub || "Random deal"}</b><small>${st.played ? `Won ${st.won} of ${st.played}` : "New"}</small></button>`; }).join("");
  K.ui.show(`<div class="k-bar"><h2>${name}</h2><button class="k-btn" data-a="title">Back</button></div><p class="k-sub">${game === "klondike" && !SAVE.opts.winnable ? "Winnable deals are off, so some deals can't be won." : sub}</p>
    <div class="opts">${btns}<button class="k-btn" data-a="daily" data-v="${dv}"><b>Daily deal</b><small>${dd ? "Solved in " + K.fmtTime(dd.time) : VARIANTS[dv].sub ? VARIANTS[dv].sub + " · same for everyone" : "Same for everyone"}</small></button></div>
    ${game === "freecell" ? `<div class="dealrow"><span>Deal number</span><input id="dealNo" type="number" min="1" max="1000000" inputmode="numeric" placeholder="1 – 1000000"><button class="k-btn" data-a="dealno">Play deal</button></div>` : ""}`, { back: "title", cls: "soft" });
}
async function newGame(v, o = {}) {
  if (G && G.started && !G.won && !o.force && !o.skipAsk) {
    const ok = await K.confirm({ title: "Start a new deal?", text: "This game will count as a loss.", yes: "New deal", no: "Keep playing" }); if (!ok) return;
  }
  if (G && G.started && !G.won) SAVE.stats[G.v].streak = 0;
  if (o.loading !== false) K.ui.show(`<div class="logo" style="font-size:2.2em">Shuffling…</div>`, { cls: "soft" });
  const d = await makeDeal(v, o); begin(d, o);
}
function menu() {
  if (!G || G.won) return;
  K.ui.show(`<div class="logo" style="font-size:2.4em">Paused</div><p class="k-sub">${G.V.name}${G.V.sub ? " · " + G.V.sub : ""}${G.type === "freecell" ? " · Deal #" + G.seed : ""} · ${K.fmtTime(G.time)} · ${G.moves} moves</p>
    <div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="restart">Restart this deal</button><button class="k-btn" data-a="newsame">New deal</button><button class="k-btn" data-a="settings" data-from="menu">Settings</button><button class="k-btn" data-a="help" data-from="menu">How to play</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "resume" });
}
function results() {
  if (!G || !G.won || K.ui.active()) return;
  const st = SAVE.stats[G.v];
  K.ui.show(`<div class="logo" style="font-size:2.6em">Solved!</div><p class="k-sub">${G.V.name}${G.V.sub ? " · " + G.V.sub : ""}${G.type === "freecell" ? " · Deal #" + G.seed : ""}${G.daily ? " · Daily deal" : ""}</p>
    <div class="k-stats"><div class="k-stat"><small>Time</small><b>${K.fmtTime(G.time)}</b></div><div class="k-stat"><small>Moves</small><b>${G.moves}</b></div>${G.type !== "freecell" ? `<div class="k-stat"><small>Score</small><b>${G.score}</b></div>` : ""}<div class="k-stat"><small>Streak</small><b>${st.streak}</b></div></div>
    <p class="k-sub">${G.pbTime ? "<b style='color:var(--gold)'>New best time!</b> " : ""}${G.pbMoves ? "<b style='color:var(--gold)'>Fewest moves yet!</b> " : ""}Won ${st.won} of ${st.played} (${pct(st)}) · best streak ${st.best}</p>
    <div class="k-row"><button class="k-btn primary" data-a="newsame" autofocus>New deal</button>${G.daily ? `<button class="k-btn" data-a="share">Copy result</button>` : ""}<button class="k-btn" data-a="title">Main menu</button></div><div class="k-msg" id="msg"></div>`, { back: "title" });
}
function settings(from) {
  const back = from === "menu" ? "menu" : "title", o = SAVE.opts, row = (k, l) => `<div class="k-opt"><span>${l}</span><button class="k-btn small" data-a="tog" data-k="${k}">${o[k] ? "On" : "Off"}</button></div>`;
  CARDS.setSize(48, 67, 2);
  const backs = CARDS.BACKS.map((b, i) => { const keep = CARDS.opts.back; CARDS.opts.back = i; CARDS.reset(); const u = CARDS.back().toDataURL(); CARDS.opts.back = keep; return `<button class="sw ${o.back === i ? "on" : ""}" data-a="back" data-i="${i}" title="${b.name}" style="background-image:url(${u})"></button>`; }).join("");
  CARDS.reset(); if (G) layout();
  const felts = FELTS.map((f, i) => `<button class="sw felt ${o.felt === i ? "on" : ""}" data-a="felt" data-i="${i}" title="${f.name}" style="background:radial-gradient(${f.a},${f.b})"></button>`).join("");
  const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div>
    <div class="k-panel" style="width:min(100%,32em);display:flex;flex-direction:column;align-items:center">
      <div class="k-opt"><span>Card back</span><span class="swatches">${backs}</span></div>
      <div class="k-opt"><span>Table</span><span class="swatches">${felts}</span></div>
      ${row("four", "Four-color suits")}${row("autoF", "Move cards to the foundations for me")}${row("winnable", "Winnable Klondike deals")}${K.ui.settingsRows()}</div>`, { back, cls: "top" });
  K.ui.bindSettings(s); SETFROM = from;
}
let SETFROM = "";
function statsScreen() {
  const rowsHtml = Object.keys(VARIANTS).map((v) => { const st = SAVE.stats[v], V = VARIANTS[v]; return `<tr><td>${V.name}${V.sub ? " · " + V.sub : ""}</td><td>${st.played}</td><td>${st.won}</td><td>${pct(st)}</td><td>${st.best}</td><td>${st.time ? K.fmtTime(st.time / 1000) : "–"}</td><td>${st.moves || "–"}</td></tr>`; }).join("");
  K.ui.show(`<div class="k-bar"><h2>Stats</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="k-panel" style="width:min(100%,42em);overflow-x:auto"><table class="st"><tr><th>Game</th><th>Played</th><th>Won</th><th>Win %</th><th>Best streak</th><th>Best time</th><th>Fewest moves</th></tr>${rowsHtml}</table></div>
    <button class="k-btn danger" data-a="resetstats">Reset stats</button>`, { back: "title", cls: "top" });
}
function help(from) {
  const back = from === "menu" ? "menu" : "title";
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="${back}" autofocus>Back</button></div>
    <div class="k-help">
      <div><b>Klondike</b>Move every card to the four foundations, Ace to King by suit. In the columns, build down in alternating colors. Only a King can go in an empty column. Tap the stock to draw.</div>
      <div><b>Spider</b>Build down in any suit, but only runs of one suit move together. A full run from King to Ace clears itself. Deal a new row when you're stuck, but only when no column is empty.</div>
      <div><b>FreeCell</b>All cards are face up. Build down in alternating colors and use the four free cells to hold single cards. Free cells and empty columns let you move longer runs.</div>
      <div><b>Moving cards</b>Drag cards, or just click or tap one to send it to the best spot. Unlimited undo. Hints in Klondike come from a solver that looks ahead.</div>
      <div class="k-kbonly"><b>Keys</b>Arrows pick a card · Enter picks up and drops · Space sends the card to the best spot (or draws) · D draw · H hint · Ctrl+Z undo · N new deal · Esc menu</div>
      <div><b>Controller</b>D-pad moves · A pick up / drop · X send to best spot · RB draw or deal · Y hint · LB undo · Start menu</div>
    </div>`, { back, cls: "top" });
}
K.ui.on(async (a, d, el) => {
  switch (a) {
    case "title": K.sfx("back"); return title();
    case "continue": K.sfx("ok"); if (!resumeSaved()) title(); return;
    case "pick": K.sfx("ok"); return pickScreen(d.g);
    case "new": K.sfx("ok"); return newGame(d.v, { skipAsk: true });
    case "daily": K.sfx("ok"); return newGame(d.v, { daily: true, skipAsk: true });
    case "dealno": { const n = Math.floor(+($("#dealNo") || {}).value); if (!(n >= 1 && n <= 1000000)) { K.toast("Pick a deal from 1 to 1000000"); K.sfx("deny"); return; } K.sfx("ok"); return newGame("fc", { deal: n, skipAsk: true }); }
    case "newsame": K.sfx("ok"); return newGame(G ? G.v : SAVE.last, { skipAsk: !(G && !G.won) });
    case "restart": { if (!G) return; const v = G.v, seed = G.seed, daily = G.daily; if (G.started && !G.won) SAVE.stats[v].streak = 0; K.sfx("ok"); const dd = VARIANTS[v].game === "freecell" ? await makeDeal(v, { deal: seed }) : await makeDeal(v, { seed }); begin(dd, { daily }); return; }
    case "resume": K.ui.hide(); return;
    case "menu": return menu();
    case "settings": K.sfx("ok"); return settings(d.from);
    case "help": K.sfx("ok"); return help(d.from);
    case "stats": K.sfx("ok"); return statsScreen();
    case "resetstats": { const ok = await K.confirm({ title: "Reset all stats?", text: "This can't be undone.", yes: "Reset", danger: true, focusNo: true }); if (ok) { for (const v in VARIANTS) SAVE.stats[v] = blankStats(); persist(); } return statsScreen(); }
    case "tog": SAVE.opts[d.k] = !SAVE.opts[d.k]; persist(); el.textContent = SAVE.opts[d.k] ? "On" : "Off"; K.sfx("ok"); if (d.k === "four") { CARDS.opts.four = SAVE.opts.four; CARDS.reset(); THUMBS = null; } return;
    case "back": SAVE.opts.back = +d.i; CARDS.opts.back = +d.i; CARDS.reset(); THUMBS = null; persist(); K.sfx("ok"); return settings(SETFROM);
    case "felt": SAVE.opts.felt = +d.i; FELT = null; persist(); K.sfx("ok"); return settings(SETFROM);
    case "share": { const t = `PATIENCE · ${G.V.name}${G.V.sub ? " " + G.V.sub : ""} daily deal ${dailyKey()}\nSolved in ${K.fmtTime(G.time)} with ${G.moves} moves`; K.copy(t).then((ok) => { const m = $("#msg"); if (m) m.textContent = ok ? "Copied to clipboard." : "Couldn't copy."; }); return; }
  }
});
$("#menuBtn").onclick = () => menu();
$("#hintBtn").onclick = () => hint();
$("#undoBtn").onclick = () => undo();
$("#newBtn").onclick = () => newGame(G.v);
K.onPause(() => { if (G && !G.won && !K.ui.active() && G.started) menu(); });

/* ================= boot ================= */
Promise.all(["700 20px 'Libre Baskerville'", "700 20px Cinzel", "900 20px Cinzel"].map((f) => document.fonts.load(f).catch(() => {}))).then(() => { CARDS.reset(); THUMBS = null; if (!G && K.ui.active() && $(".gtile")) title(); });
layout(); title();
let saveT = 0;
K.loop((dt) => {
  pollPad();
  if (G && !G.won && G.started && !K.ui.active() && !document.hidden) { G.time += dt; saveT += dt; if (saveT > 5) { saveT = 0; saveCur(); } }
  if (G && AUTO.on && !DRAG.on && !K.ui.active()) { AUTO.t -= dt; if (AUTO.t <= 0) { if (autoStep()) { AUTO.t = finishable() ? 0.07 : 0.11; if (!checkWin()) { saveCur(); } hud(); } else { AUTO.on = false; checkStuck(); } } }
  if (G) { const t = K.fmtTime(G.time); if ($("#sTime").textContent !== t) $("#sTime").textContent = t; }
  render(dt);
});
