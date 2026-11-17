"use strict";
/* NINEFOLD — sudoku UI: board, notes, undo, hints, timer, daily puzzle, stats, resume. */
const { $, $$, clamp } = K;
const DIFF = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };
const DIFF_DESC = { easy: "Only needs singles. A gentle start.", medium: "Needs pointing pairs and naked pairs.", hard: "Needs hidden pairs and triples.", expert: "Needs X-Wings, XY-Wings or Swordfish." };
const blankStats = () => ({ played: 0, won: 0, best: 0, total: 0 });
const SAVE = K.load("ninefold.v1", {
  dark: false, showMistakes: true, autoRemove: true, sameHL: true, current: null, pool: {},
  stats: { easy: blankStats(), medium: blankStats(), hard: blankStats(), expert: blankStats() }, daily: { date: "", time: 0, won: false },
});
const persist = () => K.save("ninefold.v1", SAVE);
document.body.classList.toggle("dark", !!SAVE.dark);

/* ---------- puzzle generation in a worker (falls back to the main thread) ---------- */
let worker = null, reqId = 0; const pending = new Map();
try { worker = new Worker("sudoku.js?v=1"); worker.onmessage = (e) => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p(e.data); } }; worker.onerror = () => { worker = null; }; } catch { worker = null; }
function gen(diff, seed) {
  return new Promise((res) => {
    if (worker) { const id = ++reqId; pending.set(id, res); worker.postMessage({ id, diff, seed }); setTimeout(() => { if (pending.has(id)) { pending.delete(id); res(SU.generate(diff, seed)); } }, 15000); }
    else setTimeout(() => res(SU.generate(diff, seed)), 30);
  });
}
function refillPool() { for (const d of Object.keys(DIFF)) if (!SAVE.pool[d]) gen(d, (Math.random() * 4294967296) >>> 0).then((r) => { if (r && r.puzzle) { SAVE.pool[d] = { puzzle: r.puzzle, solution: r.solution }; persist(); } }); }

/* ---------- state ---------- */
let G = null;
const boardEl = $("#board"), padEl = $("#pad"), hintEl = $("#hintbox");
function newGame(diff, p, daily) {
  G = { diff, daily: !!daily, puzzle: p.puzzle.slice(), solution: p.solution.slice(), grid: p.puzzle.slice(), notes: new Array(81).fill(0), sel: -1, notesMode: false, num: 0, mistakes: 0, hints: 0, time: 0, history: [], done: false, paused: false, bad: new Array(81).fill(0) };
  G.sel = G.grid.indexOf(0);
  return G;
}
function saveCurrent() { if (!G || G.done) { SAVE.current = null; persist(); return; } SAVE.current = { diff: G.diff, daily: G.daily, puzzle: G.puzzle, solution: G.solution, grid: G.grid, notes: G.notes, mistakes: G.mistakes, hints: G.hints, time: G.time, bad: G.bad }; persist(); }
function resumeGame(c) { newGame(c.diff, c, c.daily); Object.assign(G, { grid: c.grid.slice(), notes: c.notes.slice(), mistakes: c.mistakes, hints: c.hints, time: c.time, bad: (c.bad || new Array(81).fill(0)).slice() }); }

/* ---------- board DOM ---------- */
function buildBoard() {
  boardEl.innerHTML = "";
  for (let i = 0; i < 81; i++) {
    const b = document.createElement("button"); b.className = "c"; b.dataset.i = i; b.setAttribute("role", "gridcell");
    const r = (i / 9) | 0, c = i % 9; if (c === 2 || c === 5) b.classList.add("b-r"); if (r === 2 || r === 5) b.classList.add("b-b");
    boardEl.appendChild(b);
  }
  padEl.innerHTML = [...Array(9)].map((_, k) => `<button class="n" data-n="${k + 1}">${k + 1}<small></small></button>`).join("");
}
function draw() {
  if (!G) return;
  const sel = G.sel, sv = sel >= 0 ? G.grid[sel] : 0, hlNum = G.num || sv, cells = boardEl.children;
  const counts = new Array(10).fill(0); for (const v of G.grid) if (v && (!SAVE.showMistakes || true)) counts[v]++;
  for (let i = 0; i < 81; i++) {
    const el = cells[i], v = G.grid[i], given = G.puzzle[i] !== 0;
    const peer = sel >= 0 && i !== sel && (SU.ROW(i) === SU.ROW(sel) || SU.COL(i) === SU.COL(sel) || SU.BOX(i) === SU.BOX(sel));
    el.classList.toggle("given", given); el.classList.toggle("sel", i === sel); el.classList.toggle("peer", peer && !G.done);
    el.classList.toggle("same", SAVE.sameHL && !!hlNum && v === hlNum && i !== sel);
    const bad = SAVE.showMistakes && v && v !== G.solution[i] && !given;
    el.classList.toggle("bad", !!bad); el.classList.toggle("badbg", !!bad && i === sel);
    const key = v ? "v" + v : "n" + G.notes[i] + ":" + hlNum;
    if (el.dataset.k !== key) {
      el.dataset.k = key;
      if (v) { el.textContent = v; el.setAttribute("aria-label", `Row ${SU.ROW(i) + 1} column ${SU.COL(i) + 1}: ${v}`); }
      else if (G.notes[i]) { el.innerHTML = `<div class="notes">${[...Array(9)].map((_, k) => `<span class="${hlNum === k + 1 && G.notes[i] & SU.bit(k + 1) ? "hl" : ""}">${G.notes[i] & SU.bit(k + 1) ? k + 1 : ""}</span>`).join("")}</div>`; el.setAttribute("aria-label", `Row ${SU.ROW(i) + 1} column ${SU.COL(i) + 1}: notes ${SU.digits(G.notes[i]).join(" ")}`); }
      else { el.textContent = ""; el.setAttribute("aria-label", `Row ${SU.ROW(i) + 1} column ${SU.COL(i) + 1}: empty`); }
    }
  }
  for (const b of padEl.children) {
    const n = +b.dataset.n, left = 9 - G.grid.filter((v, i) => v === n && v === G.solution[i]).length;
    b.classList.toggle("done", left <= 0); b.classList.toggle("selnum", G.num === n);
    b.querySelector("small").textContent = left > 0 ? left : "";
  }
  $("#dname").textContent = (G.daily ? "Daily · " : "") + DIFF[G.diff];
  $("#mist").textContent = G.mistakes === 1 ? "1 mistake" : G.mistakes + " mistakes";
  $$(".t").forEach((t) => t.classList.toggle("on", t.dataset.t === "notes" && G.notesMode));
}
function flashCells(list, cls) { for (const i of list) { const el = boardEl.children[i]; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); } }

/* ---------- actions ---------- */
function select(i) { if (!G || G.done) return; G.sel = i; G.num = 0; draw(); }
function input(d) {
  if (!G || G.done || G.paused) return;
  const i = G.sel;
  if (i < 0) { G.num = G.num === d ? 0 : d; K.sfx("click"); draw(); return; }
  if (G.puzzle[i]) { G.num = G.num === d ? 0 : d; draw(); return; }
  if (G.notesMode || K.keys.has("ShiftLeft") || K.keys.has("ShiftRight")) {
    if (G.grid[i]) return;
    G.history.push({ type: "note", i, prev: G.notes[i] });
    G.notes[i] ^= SU.bit(d); K.sfx("note"); draw(); saveCurrent(); return;
  }
  if (G.grid[i] === d) return erase();
  const h = { type: "set", i, prevV: G.grid[i], prevN: G.notes[i], peers: [] };
  G.grid[i] = d; G.notes[i] = 0;
  if (SAVE.autoRemove) for (const j of SU.PEERS[i]) if (G.notes[j] & SU.bit(d)) { h.peers.push([j, G.notes[j]]); G.notes[j] &= ~SU.bit(d); }
  G.history.push(h);
  if (d !== G.solution[i]) { G.mistakes++; G.bad[i] = 1; K.sfx(SAVE.showMistakes ? "wrong" : "place"); if (SAVE.showMistakes) { flashCells([i], "badbg"); K.vibrate(40); } }
  else {
    K.sfx("place"); flashCells([i], "pop");
    // completed units ripple
    for (const u of [SU.ROW(i), 9 + SU.COL(i), 18 + SU.BOX(i)]) {
      const cells = SU.UNITS[u]; if (cells.every((j) => G.grid[j] === G.solution[j])) { cells.forEach((j, k) => setTimeout(() => flashCells([j], "wave"), k * 35)); K.sfx("unit"); }
    }
  }
  draw(); saveCurrent(); checkWin();
}
function erase() {
  if (!G || G.done) return; const i = G.sel; if (i < 0 || G.puzzle[i]) return;
  if (!G.grid[i] && !G.notes[i]) return;
  G.history.push({ type: "set", i, prevV: G.grid[i], prevN: G.notes[i], peers: [] });
  G.grid[i] = 0; G.notes[i] = 0; K.sfx("erase"); draw(); saveCurrent();
}
function undo() {
  if (!G || G.done) return; const h = G.history.pop(); if (!h) { K.sfx("deny"); return; }
  if (h.type === "note") G.notes[h.i] = h.prev;
  else if (h.type === "set") { G.grid[h.i] = h.prevV; G.notes[h.i] = h.prevN; for (const [j, n] of h.peers) G.notes[j] = n; }
  else if (h.type === "batch") for (const [j, n] of h.notes) G.notes[j] = n;
  if (h.i !== undefined) G.sel = h.i;
  K.sfx("undo"); draw(); saveCurrent();
}
function autoNotes() {
  if (!G || G.done) return;
  const g = Int8Array.from(G.grid), prev = [];
  for (let i = 0; i < 81; i++) if (!G.grid[i]) { prev.push([i, G.notes[i]]); G.notes[i] = SU.candMask(g, i); }
  G.history.push({ type: "batch", notes: prev }); K.sfx("auto"); draw(); saveCurrent();
}
function hint() {
  if (!G || G.done) return;
  const h = SU.hint(G.grid, G.solution); if (!h) return;
  G.hints++;
  if (h.kind === "mistake") { flashCells(h.cells, "hint"); hintEl.innerHTML = `<b>Check these:</b> ${K.esc(h.text)}`; G.sel = h.cells[0]; K.sfx("hint"); draw(); saveCurrent(); return; }
  hintEl.innerHTML = `<b>${K.esc(h.tech)}.</b> ${K.esc(h.text.replace(/^[^:]+: /, ""))}`;
  G.sel = h.cell; flashCells([h.cell], "hint");
  const wasNotes = G.notesMode; G.notesMode = false; input(h.digit); G.notesMode = wasNotes;
  K.sfx("hint");
}
function checkWin() {
  if (!G.grid.every((v, i) => v === G.solution[i])) return;
  G.done = true; G.sel = -1; draw();
  for (let i = 0; i < 81; i++) setTimeout(() => flashCells([i], "wave"), (SU.ROW(i) + SU.COL(i)) * 45);
  K.sfx("win"); K.vibrate(80);
  const st = SAVE.stats[G.diff]; st.won++; st.total += G.time;
  let pb = false;
  if (!G.hints) { if (!st.best || G.time < st.best) { st.best = G.time; pb = true; } }
  if (G.daily) { SAVE.daily = { date: K.today(), time: G.time, won: true }; }
  SAVE.current = null; persist();
  const g = G; setTimeout(() => { if (G === g) results(pb); }, 1400);
}
function togglePause(force) {
  if (!G || G.done) return;
  G.paused = force !== undefined ? force : !G.paused;
  let b = $("#blur");
  if (G.paused && !b) { b = document.createElement("div"); b.id = "blur"; b.textContent = "Paused · tap to continue"; b.onclick = () => togglePause(false); boardEl.appendChild(b); }
  if (!G.paused && b) b.remove();
  $("#pauseBtn").textContent = G.paused ? "▶" : "❚❚";
}

/* ---------- input ---------- */
boardEl.addEventListener("click", (e) => { const c = e.target.closest(".c"); if (!c || !G || G.paused) return; const i = +c.dataset.i; if (G.num && !G.puzzle[i] && G.sel !== i) { G.sel = i; const n = G.num; input(n); G.num = n; draw(); return; } select(i); K.sfx("click"); });
padEl.addEventListener("click", (e) => { const b = e.target.closest(".n"); if (b) input(+b.dataset.n); });
$("#tools").addEventListener("click", (e) => {
  const t = e.target.closest(".t"); if (!t || !G) return;
  ({ undo, erase, hint, auto: autoNotes, notes: () => { G.notesMode = !G.notesMode; K.sfx("click"); draw(); } })[t.dataset.t]();
});
$("#pauseBtn").onclick = () => togglePause();
$("#menuBtn").onclick = () => menu();
addEventListener("keydown", (e) => {
  if (!G || K.ui.active()) return;
  if (G.paused) { if (e.code === "KeyP" || e.code === "Space" || e.code === "Escape") togglePause(false); return; }
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.code];
  if (e.code === "KeyA" && !e.repeat) return autoNotes();
  if (dir) {
    e.preventDefault(); const i = G.sel < 0 ? 40 : G.sel; const r = (SU.ROW(i) + dir[1] + 9) % 9, c = (SU.COL(i) + dir[0] + 9) % 9; select(r * 9 + c); K.sfx("move"); return;
  }
  const n = /^Digit([1-9])$/.exec(e.code) || /^Numpad([1-9])$/.exec(e.code);
  if (n) { e.preventDefault(); input(+n[1]); return; }
  if (e.code === "Backspace" || e.code === "Delete" || e.code === "Digit0" || e.code === "Numpad0") { e.preventDefault(); erase(); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); undo(); return; }
  if (e.code === "KeyN") { G.notesMode = !G.notesMode; draw(); K.sfx("click"); return; }
  if (e.code === "KeyH") return hint();
  if (e.code === "KeyU") return undo();
  if (e.code === "KeyP") return togglePause(true);
  if (e.code === "Escape") return menu();
});
function pollPadGame(dt) {
  const p = K.pad; if (!p.connected || !G || K.ui.active() || G.done) return;
  const pr = p.pressed;
  if (pr.du || pr.dd || pr.dl || pr.dr) { const i = G.sel < 0 ? 40 : G.sel, dx = pr.dl ? -1 : pr.dr ? 1 : 0, dy = pr.du ? -1 : pr.dd ? 1 : 0; select(((SU.ROW(i) + dy + 9) % 9) * 9 + ((SU.COL(i) + dx + 9) % 9)); K.sfx("move"); }
  if (pr.rb) { G.num = (G.num % 9) + 1; draw(); K.sfx("click"); }
  if (pr.lb) { G.num = G.num <= 1 ? 9 : G.num - 1; draw(); K.sfx("click"); }
  if (pr.a && G.num) { const n = G.num; input(n); G.num = n; draw(); }
  if (pr.x) { G.notesMode = !G.notesMode; draw(); }
  if (pr.b) erase();
  if (pr.y) hint();
  if (pr.back) undo();
  if (pr.start) menu();
}

/* ---------- audio ---------- */
K.defineSfx({
  place: (t) => K.voice(660 + Math.random() * 40, t, 0.09, { type: "triangle", vol: 0.06 }),
  note: (t) => K.voice(1320, t, 0.04, { type: "sine", vol: 0.03 }),
  erase: (t) => K.voice(330, t, 0.07, { type: "triangle", vol: 0.04, slide: 0.7 }),
  wrong: (t) => { K.voice(220, t, 0.14, { type: "square", vol: 0.04, lp: 1200 }); K.voice(208, t + 0.08, 0.16, { type: "square", vol: 0.035, lp: 1200 }); },
  unit: (t) => K.notes(t, [784, 988, 1175], 0.06, { type: "sine", vol: 0.05, len: 0.3 }),
  undo: (t) => K.voice(500, t, 0.06, { type: "sine", vol: 0.04, slide: 0.8 }),
  auto: (t) => K.notes(t, [880, 1046, 1318, 1568], 0.03, { type: "sine", vol: 0.03, len: 0.12 }),
  hint: (t) => K.notes(t, [1046, 1568], 0.08, { type: "sine", vol: 0.05, len: 0.35 }),
});
K.songs({ study: { bpm: 72, chords: ["Cmaj", "Am", "F", "G", "Em", "Am", "Dm", "G"].map((c) => c.replace("maj", "")), pad: true, padVol: 0.02, arp: true, arpVol: 0.016, arpPat: [0, 2, 3, 2],
  bass: "R . . . . . . . R . . . . . . .", leadVol: 0.03, lead: ["e5 - - - g5 - - -", "e5 - - - c5 - - -", "a4 - - - c5 - f5 -", "d5 - - - b4 - - -", "g4 - - - b4 - e5 -", "c5 - - - e5 - a5 -", "f5 - e5 - d5 - - -", "d5 - - - - - - -"] } });

/* ---------- screens ---------- */
function bestOf(d) { const b = SAVE.stats[d].best; return b ? "Best " + K.fmtTime(b) : "No record yet"; }
async function startGame(diff, daily) {
  K.sfx("ok");
  let p;
  if (daily) {
    K.ui.show(`<p class="k-sub">Making today's puzzle…</p>`, { focus: false });
    p = await gen("hard", K.dailySeed("ninefold"));
  } else if (SAVE.pool[diff]) { p = SAVE.pool[diff]; delete SAVE.pool[diff]; persist(); }
  else { K.ui.show(`<p class="k-sub">Making a ${DIFF[diff].toLowerCase()} puzzle…</p>`, { focus: false }); p = await gen(diff, (Math.random() * 4294967296) >>> 0); }
  if (!p || !p.puzzle) { K.toast("Couldn't make a puzzle", "Try again."); return title(); }
  newGame(daily ? "hard" : diff, p, daily);
  SAVE.stats[G.diff].played++; persist();
  enterBoard(); refillPool();
}
function enterBoard() {
  K.ui.hide(); $("#app").hidden = false; buildBoard(); hintEl.innerHTML = ""; togglePause(false); draw(); saveCurrent(); K.playSong("study", 2);
  const f = boardEl.children[G.sel >= 0 ? G.sel : 40]; if (f && K.device !== "touch") f.focus({ preventScroll: true });
}
function title() {
  if (G && !G.done) saveCurrent();
  G = null; $("#app").hidden = true; K.playSong("study", 1);
  const cur = SAVE.current, dailyDone = SAVE.daily.date === K.today() && SAVE.daily.won;
  K.ui.show(`<div class="logo">NINE<span>FOLD</span></div><p class="k-sub">Sudoku, graded by the techniques each puzzle needs.</p>
    ${cur ? `<button class="k-btn primary" data-a="continue" autofocus>Continue ${DIFF[cur.diff]}${cur.daily ? " (daily)" : ""} · ${K.fmtTime(cur.time)}</button>` : ""}
    <div class="diffs">${Object.keys(DIFF).map((d) => `<button class="k-btn diff" data-a="new" data-d="${d}" ${!cur && d === "easy" ? "autofocus" : ""}><b>${DIFF[d]}</b><span>${DIFF_DESC[d]}</span><em>${bestOf(d)}</em></button>`).join("")}</div>
    <div class="k-row"><button class="k-btn" data-a="daily">Daily puzzle${dailyDone ? " ✓ " + K.fmtTime(SAVE.daily.time) : ""}</button><button class="k-btn" data-a="stats">Stats</button><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="help">How to play</button></div>`);
}
function menu() {
  if (!G) return;
  togglePause(true);
  K.ui.show(`<div class="logo" style="font-size:2.6em">Paused</div><p class="k-sub">${(G.daily ? "Daily · " : "") + DIFF[G.diff]} · ${K.fmtTime(G.time)}</p>
    <div class="k-menu"><button class="k-btn primary" data-a="resume" autofocus>Resume</button><button class="k-btn" data-a="restart">Restart this puzzle</button><button class="k-btn" data-a="settings" data-from="menu">Settings</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "resume" });
}
function results(pb) {
  const st = SAVE.stats[G.diff];
  K.ui.show(`<div class="k-sub">${(G.daily ? "Daily puzzle · " : "") + DIFF[G.diff]}</div><div class="big">${K.fmtTime(G.time)}</div>
    ${pb ? `<b style="color:var(--gold)">New best time!</b>` : G.hints ? `<span class="k-sub">Solved with ${G.hints} hint${G.hints > 1 ? "s" : ""}.</span>` : `<span class="k-sub">${bestOf(G.diff)}</span>`}
    <div class="k-stats"><div class="k-stat"><small>Mistakes</small><b>${G.mistakes}</b></div><div class="k-stat"><small>Hints</small><b>${G.hints}</b></div><div class="k-stat"><small>Solved</small><b>${st.won}</b></div><div class="k-stat"><small>Average</small><b>${st.won ? K.fmtTime(st.total / st.won) : "–"}</b></div></div>
    <div class="k-row"><button class="k-btn primary" data-a="new" data-d="${G.diff}" autofocus>Another ${DIFF[G.diff].toLowerCase()} puzzle</button>${G.daily ? `<button class="k-btn" data-a="share">Copy result</button>` : ""}<button class="k-btn" data-a="title">Main menu</button></div><div class="k-msg" id="msg"></div>`, { back: "title" });
}
function settings(from) {
  const back = from === "menu" ? "menu" : "title";
  const row = (k, label) => `<div class="k-opt"><span>${label}</span><button class="k-btn small" data-a="tog" data-k="${k}">${SAVE[k] ? "On" : "Off"}</button></div>`;
  const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div>
    <div class="k-panel" style="width:min(100%,32em);display:flex;flex-direction:column;align-items:center">
      ${row("dark", "Dark theme")}${row("showMistakes", "Show mistakes right away")}${row("autoRemove", "Clear notes when you place a number")}${row("sameHL", "Highlight matching numbers")}
      ${K.ui.settingsRows()}</div>`, { back, cls: "top" });
  K.ui.bindSettings(s);
}
function statsScreen() {
  K.ui.show(`<div class="k-bar"><h2>Stats</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="k-list">${Object.keys(DIFF).map((d) => { const s = SAVE.stats[d]; return `<div class="k-li"><div class="tx"><b>${DIFF[d]}</b><span>Played ${s.played} · solved ${s.won}${s.won ? " · average " + K.fmtTime(s.total / s.won) : ""}</span></div><b style="color:var(--gold)">${s.best ? K.fmtTime(s.best) : "–"}</b></div>`; }).join("")}</div>`, { back: "title", cls: "top" });
}
function help() {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="title" autofocus>Back</button></div>
    <div class="k-help">
      <div><b>The rule</b>Fill every row, column and 3×3 box with the numbers 1 to 9, each exactly once.</div>
      <div><b>Notes</b>Turn on Notes to pencil in possibilities. Auto fills every cell's possibilities at once.</div>
      <div><b>Hints</b>A hint names the technique to use next and explains it, then fills in the number. Hinted solves don't set records.</div>
      <div class="k-kbonly"><b>Keys</b>Arrows move · 1-9 place · Shift+number or N for notes · A fill notes · Backspace erase · Ctrl+Z undo · H hint · P pause</div>
      <div><b>Controller</b>D-pad move · LB/RB pick a number · A place · X notes · B erase · Y hint · Back undo · Start menu</div>
    </div>`, { back: "title", cls: "top" });
}
K.ui.on((a, d, el) => {
  switch (a) {
    case "new": return startGame(d.d);
    case "daily": return startGame("hard", true);
    case "continue": { K.sfx("ok"); resumeGame(SAVE.current); return enterBoard(); }
    case "resume": K.ui.hide(); togglePause(false); return;
    case "restart": K.ui.hide(); G.grid = G.puzzle.slice(); G.notes.fill(0); G.history = []; G.time = 0; G.mistakes = 0; G.hints = 0; G.bad.fill(0); togglePause(false); hintEl.innerHTML = ""; draw(); saveCurrent(); return;
    case "menu": return menu();
    case "title": K.sfx("back"); return title();
    case "stats": K.sfx("ok"); return statsScreen();
    case "settings": K.sfx("ok"); return settings(d.from);
    case "help": K.sfx("ok"); return help();
    case "tog": SAVE[d.k] = !SAVE[d.k]; persist(); el.textContent = SAVE[d.k] ? "On" : "Off"; document.body.classList.toggle("dark", !!SAVE.dark); if (G) { for (const c of boardEl.children) c.dataset.k = ""; draw(); } K.sfx("ok"); return;
    case "share": K.copy(`NINEFOLD · Daily puzzle ${K.today()}\nSolved in ${K.fmtTime(SAVE.daily.time)}`).then((ok) => { const m = $("#msg"); if (m) m.textContent = ok ? "Copied to clipboard." : "Couldn't copy."; }); return;
  }
});
K.onPause(() => { if (G && !G.done && !K.ui.active()) menu(); });

/* ---------- boot ---------- */
title();
refillPool();
let saveT = 0;
K.loop((dt) => {
  pollPadGame(dt);
  if (G && !G.done && !G.paused && !K.ui.active() && !document.hidden) {
    G.time += dt; const t = K.fmtTime(G.time); if ($("#timer").textContent !== t) $("#timer").textContent = t;
    saveT += dt; if (saveT > 5) { saveT = 0; saveCurrent(); }
  }
});
