"use strict";
/* GRIDLOCK · ui.js — HUD, tower dock, input, menus, setup, editor and the main loop */

const ui = $("#ui"), topbar = $("#topbar"), dock = $("#dock"), infoEl = $("#info"), towerList = $("#towerList"), edbar = $("#edbar");
const U = {
  state: "boot", place: null, sel: null, hover: null, cursor: [10, 6], cursorOn: false, pend: null, sellArm: false, back: null,
  setup: null, ed: null, bg: null, padPrev: {}, navDir: 0, navRepeat: 0, curDir: 0, curRepeat: 0, bannerT: 0, speedIdx: 0, acc: 0,
  infoSig: "", infoT: 0, top: {}, previewN: -1, lastOpts: null,
};
const SPEEDS = [1, 2, 3];

/* ---------- layout ---------- */
const isNarrow = () => matchMedia("(orientation: portrait), (max-width: 760px)").matches;
function area() {
  const W = innerWidth, H = innerHeight;
  if (U.state === "editor") { const t = edbar.offsetHeight; return { x: 8, y: t + 8, w: W - 16, h: H - t - 16 }; }
  if (!topbar.hidden) {
    const t = topbar.offsetHeight;
    if (isNarrow()) { dock.style.top = "auto"; const d = dock.offsetHeight; return { x: 4, y: t + 4, w: W - 8, h: H - t - d - 8 }; }
    dock.style.top = t + "px";
    return { x: 8, y: t + 8, w: W - dock.offsetWidth - 16, h: H - t - 16 };
  }
  return { x: 0, y: 0, w: W, h: H };
}
const relayout = () => layout(area());
addEventListener("resize", relayout);

/* ---------- small helpers ---------- */
function show(html, o = {}) {
  ui.innerHTML = `<div class="screen ${o.cls || ""}">${html}</div>`;
  U.back = o.back || null;
  const s = ui.firstElementChild;
  if (IN.device !== "touch" && o.focus !== false) { const f = (o.focusSel && s.querySelector(o.focusSel)) || s.querySelector("[autofocus]") || navList(s)[0]; if (f) f.focus({ preventScroll: true }); }
  return s;
}
const hideUI = () => { ui.innerHTML = ""; U.back = null; };
const UI = {};
UI.toast = (t, s, kind = "") => {
  const el = document.createElement("div"); el.className = "toast " + kind;
  el.innerHTML = `<b>${esc(t)}</b>${s ? `<span>${esc(s)}</span>` : ""}`;
  const box = $("#toasts"); box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.style.transition = "opacity .4s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 420); }, kind === "ach" ? 4200 : 2600);
};
UI.achToast = (name, note) => { UI.toast("Achievement: " + name, note, "ach"); sfx("ach"); };
function banner(t, s, boss) { const b = $("#bannerT"); b.textContent = t; b.className = boss ? "boss" : ""; $("#bannerS").textContent = s || ""; $("#banner").classList.add("on"); U.bannerT = 2.2; }
UI.onWaveStart = (n, boss) => { banner(boss ? "OVERFLOW" : "WAVE " + n, boss ? "Boss incoming" : G.endless && n > WIN_WAVE ? "Endless" : !G.endless ? `${n} / ${WIN_WAVE}` : "", boss); U.infoSig = ""; };
UI.onWaveClear = () => { U.infoSig = ""; };
UI.onWin = () => { setTimeout(() => { if (G && G.won && !G.wonShown) { G.wonShown = true; showWin(); } }, 900); };
UI.onLose = () => { bankGame(); setTimeout(showLose, 1100); };

function miniShape(type, size = 32) {
  const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"), d = ENEMIES[type];
  drawShape(g, d.shape, size / 2, size / 2, size * (d.boss ? 0.36 : 0.3), d.shape === "chevron" ? 0 : 0.3);
  g.fillStyle = `rgba(${d.rgb},0.3)`; g.fill(); g.strokeStyle = d.color; g.lineWidth = size * 0.08; g.stroke();
  return c;
}
function towerIcon(type, size = 64, lv = 1) { const c = document.createElement("canvas"); c.width = c.height = size; drawTower(c.getContext("2d"), type, size / 2, size / 2, size * 1.1, { lv, spin: 0.6 }); return c; }
function drawMini(c, map) {
  const g = c.getContext("2d"), W = c.width, H = c.height, s = Math.min(W / COLS, H / ROWS), ox = (W - s * COLS) / 2, oy = (H - s * ROWS) / 2;
  g.fillStyle = "#070b18"; g.fillRect(0, 0, W, H);
  const col = ["#0c1430", "#1f6fd0", "#161c36", "#6b5520", "#ff5cf0", "#3ef0ff"];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const t = map.tiles[idx(x, y)]; g.fillStyle = col[t]; g.fillRect(ox + x * s + 0.5, oy + y * s + 0.5, s - 1, s - 1); }
}
/* Big previews reuse the real board art, then put the spawns and core on top. */
function boardPreview(c, map) {
  const saved = { ...LAY }, key = BOARD_KEY, b = BOARD;
  LAY.cell = Math.floor(Math.min(c.width / COLS, c.height / ROWS)); LAY.w = LAY.cell * COLS; LAY.h = LAY.cell * ROWS; LAY.dpr = 1;
  BOARD_KEY = "";
  const img = buildBoard(map), g = c.getContext("2d"), ox = (c.width - LAY.w) / 2, oy = (c.height - LAY.h) / 2, cs = LAY.cell;
  g.fillStyle = "#070b18"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, ox - 1, oy - 1);
  const info = analyze(map);
  if (info.ok) {
    for (const s of info.spawns) { g.strokeStyle = "#ff5cf0"; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(ox + ((s % COLS) + 0.5) * cs, oy + (((s / COLS) | 0) + 0.5) * cs, cs * 0.36, 0, TAU); g.stroke(); g.setLineDash([]); }
    const cx = ox + ((info.core % COLS) + 0.5) * cs, cy = oy + (((info.core / COLS) | 0) + 0.5) * cs;
    g.fillStyle = "#0a1a33"; g.strokeStyle = "#3ef0ff"; g.lineWidth = 2; poly(g, cx, cy, cs * 0.42, 6, 0); g.fill(); g.stroke();
  }
  Object.assign(LAY, saved); BOARD_KEY = key; BOARD = b;
}
function previewCanvas(map, w = 400) { const c = document.createElement("canvas"); c.width = w; c.height = Math.round((w * ROWS) / COLS); drawMini(c, map); return c; }

/* ---------- states ---------- */
function setState(s) {
  U.state = s;
  const playing = ["play", "pause", "over"].includes(s);
  topbar.hidden = !playing; dock.hidden = !playing; edbar.hidden = s !== "editor";
  if (!playing) { U.place = U.sel = U.pend = null; }
  relayout();
}
function menuBackdrop() { if (!U.bg) U.bg = randomMap((Math.random() * 4294967296) >>> 0); }

/* ---------- title + menus ---------- */
function showTitle() {
  setState("menu"); menuBackdrop(); musicPlay("title", 3);
  const saved = loadGameState();
  show(`<div class="logo">GRIDLOCK</div><div class="tagline">Hold the core. Every grid is new.</div>
    <div class="menu">
      ${saved ? `<button class="primary" data-a="continue" autofocus>Continue · wave ${saved.cleared + 1}</button>` : ""}
      <button class="${saved ? "" : "primary"}" data-a="setup" ${saved ? "" : "autofocus"}>New game</button>
      <button data-a="daily">Daily grid</button>
      <button data-a="maps">Map editor</button>
      <button data-a="ach">Achievements</button>
      <button data-a="settings">Settings</button>
    </div>
    <div class="row"><button class="small" data-a="help">How to play</button></div>`, { cls: "clear" });
}
function showSetup() {
  setState("menu"); menuBackdrop();
  const S = (U.setup = U.setup || { src: "random", seed: (Math.random() * 4294967296) >>> 0, diff: SAVE.last.diff || "normal", endless: !!SAVE.last.endless, pick: 0 });
  let map = null, err = "";
  if (S.src === "random") map = randomMap(S.seed);
  else { const m = SAVE.maps[S.pick]; if (m) { try { map = codeToMap(m.code); } catch (e) { err = e.message; } } }
  const mapsHTML = SAVE.maps.length ? SAVE.maps.map((m, i) => `<button class="small ${S.pick === i ? "on" : ""}" data-a="pickmap" data-i="${i}">${esc(m.name)}</button>`).join("") : `<span class="muted">No saved maps yet. Make one in the map editor or import a code there.</span>`;
  const sc = show(`<div class="bar"><h2>New game</h2><button data-a="title">Back</button></div>
    <div class="setup">
      <div class="col">
        <div class="seg"><button class="${S.src === "random" ? "on" : ""}" data-a="src" data-v="random">Random grid</button><button class="${S.src === "mine" ? "on" : ""}" data-a="src" data-v="mine">My maps</button></div>
        <div class="mapbox"><canvas id="setupMap" width="600" height="360"></canvas>
          <div class="cap"><span>${map ? esc(map.name) + (S.src === "random" ? ` · seed ${S.seed.toString(36)}` : "") : err || "Pick a map"}</span>
          ${S.src === "random" ? `<button class="small" data-a="reroll">New grid</button>` : ""}</div></div>
        ${S.src === "mine" ? `<div class="row" style="justify-content:flex-start">${mapsHTML}</div>` : ""}
      </div>
      <div class="col panel">
        <span class="label">Difficulty</span>
        <div class="seg">${Object.entries(DIFFS).map(([k, d]) => `<button class="${S.diff === k ? "on" : ""}" data-a="diff" data-v="${k}">${d.name}</button>`).join("")}</div>
        <span class="muted">${DIFFS[S.diff].desc}</span>
        <span class="label">Mode</span>
        <div class="seg"><button class="${!S.endless ? "on" : ""}" data-a="endless" data-v="0">30 waves</button><button class="${S.endless ? "on" : ""}" data-a="endless" data-v="1">Endless</button></div>
        <span class="muted">${S.endless ? "Waves never stop. How far can you get?" : "Survive 30 waves to win. You can keep going afterwards."}</span>
        <span class="muted">Best: ${SAVE.best[S.diff + (S.endless ? ":endless" : "")] ? "wave " + SAVE.best[S.diff + (S.endless ? ":endless" : "")] : "none yet"}</span>
        <button class="primary" data-a="start" ${map ? "" : "disabled"} autofocus>Start</button>
      </div>
    </div>`, { back: "title", cls: "top" });
  if (map) boardPreview($("#setupMap", sc), map);
  U.setupMap = map;
}
function showDaily() {
  setState("menu"); menuBackdrop();
  const date = todayStr(), map = randomMap(hashStr("gridlock:" + date), "Daily grid " + date), d = SAVE.daily, best = d.date === date ? d.wave : 0;
  const sc = show(`<div class="bar"><h2>Daily grid</h2><button data-a="title">Back</button></div>
    <div class="panel" style="width:min(100%,34em);display:flex;flex-direction:column;gap:.6em;align-items:center">
      <canvas id="dailyMap" width="600" height="360" style="width:100%;border-radius:.4em;border:1px solid var(--line2)"></canvas>
      <div class="muted">${date} · Normal · Endless</div>
      <div>Today's best: <b class="gold">${best ? "wave " + best : "not played yet"}</b></div>
    </div>
    <p class="sub">Everyone gets the same grid and the same waves today. The waves never stop, so your score is how many you clear.</p>
    <div class="row"><button class="primary" data-a="startdaily" autofocus>Start</button>${best ? `<button data-a="copydaily">Copy result</button>` : ""}</div><div class="msg" id="dmsg"></div>`, { back: "title" });
  boardPreview($("#dailyMap", sc), map);
}
function showAch() {
  setState("menu"); menuBackdrop();
  const n = ACH.filter((a) => SAVE.ach[a.id]).length;
  const rows = ACH.map((a) => { const done = !!SAVE.ach[a.id]; return `<div class="li ${done ? "done" : ""}"><span class="ck">${done ? "✓" : "·"}</span><div class="tx"><b>${a.name}</b><span>${a.desc}</span></div><div class="rw">${a.unlock ? "Unlocks " + TOWERS[a.unlock].name : ""}</div></div>`; }).join("");
  const st = SAVE.stats;
  show(`<div class="bar"><h2>Achievements</h2><span class="muted">${n} / ${ACH.length}</span><button data-a="title" autofocus>Back</button></div>
    <div class="stats"><div class="st"><small>Games</small><b>${fmt(st.games)}</b></div><div class="st"><small>Wins</small><b>${fmt(st.wins)}</b></div><div class="st"><small>Waves cleared</small><b>${fmt(st.waves)}</b></div><div class="st"><small>Glitches</small><b>${fmt(st.kills)}</b></div></div>
    <div class="list">${rows}</div>`, { back: "title", cls: "top" });
}
function showHelp() {
  setState("menu"); menuBackdrop();
  const roster = TOWER_ORDER.map((id) => `<div data-tw="${id}"><canvas width="64" height="64"></canvas><span><b>${TOWERS[id].name} · ◆${TOWERS[id].cost}</b><span>${TOWERS[id].desc}</span></span></div>`).join("");
  const foes = Object.keys(ENEMIES).map((id) => `<div data-en="${id}"><canvas width="48" height="48"></canvas><span><b>${ENEMIES[id].name}</b><span>${ENEMIES[id].desc}</span></span></div>`).join("");
  const sc = show(`<div class="bar"><h2>How to play</h2><button data-a="title" autofocus>Back</button></div>
    <div class="help">
      <div><b>Build</b>Pick a tower from the dock, then click a free tile. Towers can't go on the path. On touch screens, tap a tile once to preview and again to build.</div>
      <div><b>Upgrade</b>Click a tower to see its stats, upgrade it to level 4, change what it aims at, or sell it. Selling gives everything back until the next wave starts, 70% after that.</div>
      <div><b>Waves</b>Press Start wave when you're ready. Once a wave has fully arrived you can call the next one early for bonus credits.</div>
      <div><b>Gold tiles</b>Hexagon pads boost the tower built on them: +20% damage, +10% range.</div>
      <div class="kbonly"><b>Keys</b>1-9 towers · Space next wave · F speed · U upgrade · S sell · T target · Esc cancel / pause · arrows move the cursor, Enter builds</div>
      <div><b>Controller</b>Stick moves the cursor · A build / select · B cancel · X upgrade · Y sell · LB/RB pick tower · Start next wave · Back pause</div>
    </div>
    <h2 style="font-size:1em">Towers</h2><div class="roster">${roster}</div>
    <h2 style="font-size:1em">Glitches</h2><div class="roster">${foes}</div>`, { back: "title", cls: "top" });
  for (const el of $$("[data-tw]", sc)) { const cv2 = $("canvas", el), g = cv2.getContext("2d"); drawTower(g, el.dataset.tw, 32, 32, 70, { lv: 2, spin: 0.5 }); }
  for (const el of $$("[data-en]", sc)) { const cv2 = $("canvas", el), g = cv2.getContext("2d"); g.drawImage(miniShape(el.dataset.en, 48), 0, 0); }
}
function showSettings(back = "title") {
  U.setBack = back;
  if (back === "title") { setState("menu"); menuBackdrop(); }
  const s = SAVE.settings, oo = (v) => (v ? "On" : "Off");
  const sc = show(`<div class="bar"><h2>Settings</h2><button data-a="${back}">Back</button></div>
    <div class="panel" style="width:min(100%,32em);display:flex;flex-direction:column;align-items:center">
      <label class="opt"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-set="music"></label>
      <label class="opt"><span>Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-set="sfx"></label>
      <div class="opt"><span>Start waves automatically</span><button class="small" data-a="tog" data-k="auto">${oo(s.auto)}</button></div>
      <div class="opt"><span>Show all ranges while building</span><button class="small" data-a="tog" data-k="ranges">${oo(s.ranges)}</button></div>
      <div class="opt"><span>Screen shake</span><button class="small" data-a="tog" data-k="shake">${oo(s.shake)}</button></div>
      <div class="opt"><span>Flash when the core is hit</span><button class="small" data-a="tog" data-k="flash">${oo(s.flash)}</button></div>
      <div class="opt"><span>Fullscreen</span><button class="small" data-a="fs">Toggle</button></div>
    </div>
    ${back === "title" ? `<div class="row"><button data-a="savecode">Save code</button><button class="danger" data-a="reset">Reset progress</button></div>` : ""}
    <div class="msg" id="setmsg"></div>`, { back, cls: back === "title" ? "top" : "" });
  for (const r of $$("input[type=range]", sc)) r.addEventListener("input", () => { SAVE.settings[r.dataset.set] = +r.value; applyVolumes(); save(); });
}
function showSaveCode() {
  setState("menu");
  const code = wrapCode("GRIDLOCK-SAVE:", SAVE);
  show(`<div class="bar"><h2>Save code</h2><button data-a="settings">Back</button></div>
    <p class="sub">Copy this code to back up your progress or move it to another browser. Paste a code below to load it.</p>
    <textarea id="codeOut" readonly>${esc(code)}</textarea>
    <div class="row"><button class="primary" data-a="copysave" autofocus>Copy my code</button></div>
    <textarea id="codeIn" placeholder="Paste a GRIDLOCK-SAVE code here"></textarea>
    <div class="row"><button data-a="loadsave">Load code</button></div><div class="msg" id="codemsg"></div>`, { back: "settings", cls: "top" });
}

/* ---------- maps hub + editor ---------- */
function showMaps() {
  setState("menu"); menuBackdrop();
  const rows = SAVE.maps.map((m, i) => `<div class="li"><canvas width="100" height="60" data-mi="${i}"></canvas><div class="tx"><b>${esc(m.name)}</b><span>${m.mine ? "Made by you" : "Imported"}</span></div>
    <button class="small primary" data-a="mplay" data-i="${i}">Play</button><button class="small" data-a="medit" data-i="${i}">Edit</button><button class="small" data-a="mshare" data-i="${i}">Share</button><button class="small danger" data-a="mdel" data-i="${i}">Delete</button></div>`).join("");
  const sc = show(`<div class="bar"><h2>Map editor</h2><button data-a="title">Back</button></div>
    <div class="row"><button class="primary" data-a="newmap" autofocus>New map</button><button data-a="importmap">Import code</button></div>
    <div class="list">${rows || `<p class="sub">Your maps will show up here. Make one, test it, then share it as a code.</p>`}</div>`, { back: "title", cls: "top" });
  for (const c of $$("canvas[data-mi]", sc)) { try { drawMini(c, codeToMap(SAVE.maps[+c.dataset.mi].code)); } catch {} }
}
function showImport() {
  setState("menu");
  show(`<div class="bar"><h2>Import a map</h2><button data-a="maps">Back</button></div>
    <p class="sub">Paste a GRIDLOCK-MAP code someone shared with you.</p>
    <textarea id="mapIn" placeholder="GRIDLOCK-MAP:..." autofocus></textarea>
    <div class="row"><button class="primary" data-a="doimport">Import</button></div><div class="msg" id="impmsg"></div>`, { back: "maps", cls: "top" });
}
function showShare(i) {
  setState("menu");
  const m = SAVE.maps[i];
  show(`<div class="bar"><h2>Share "${esc(m.name)}"</h2><button data-a="maps">Back</button></div>
    <p class="sub">Send this code to a friend. They can paste it in Map editor → Import code.</p>
    <textarea id="shareOut" readonly>${esc(m.code)}</textarea>
    <div class="row"><button class="primary" data-a="copyshare" autofocus>Copy code</button></div><div class="msg" id="sharemsg"></div>`, { back: "maps", cls: "top" });
}
const ED_TOOLS = [["path", "Path", T_PATH], ["erase", "Erase", T_EMPTY], ["block", "Block", T_BLOCK], ["pad", "Boost pad", T_PAD], ["spawn", "Spawn", T_SPAWN], ["core", "Core", T_CORE]];
function openEditor(i) {
  const m = i != null ? codeToMapLoose(SAVE.maps[i].code) : { name: "My map", tiles: new Array(COLS * ROWS).fill(T_EMPTY) };
  U.ed = { map: m, tool: "path", idx: i != null && SAVE.maps[i].mine ? i : null, undo: [], down: false, dirty: false, exitArm: false };
  hideUI(); setState("editor");
  edbar.innerHTML = ED_TOOLS.map(([k, n], j) => `<button class="small tool" data-ed="tool" data-k="${k}" title="${n} (${j + 1})"><canvas width="24" height="24" data-tile="${k}"></canvas>${n}</button>`).join("") +
    `<input type="text" id="edName" maxlength="40" value="${esc(m.name)}" aria-label="Map name" spellcheck="false">
     <button class="small" data-ed="random">Random</button><button class="small" data-ed="clear">Clear</button><button class="small" data-ed="undo">Undo</button>
     <span id="edmsg"></span><span class="sp" style="flex:1"></span>
     <button class="small primary" data-ed="test">Test</button><button class="small" data-ed="save">Save</button><button class="small" data-ed="share">Share</button><button class="small" data-ed="exit">Exit</button>`;
  for (const c of $$("canvas[data-tile]", edbar)) { const g = c.getContext("2d"), t = ED_TOOLS.find((x) => x[0] === c.dataset.tile)[2]; g.fillStyle = ["#0c1430", "#1f6fd0", "#2a3156", "#ffc14d", "#ff5cf0", "#3ef0ff"][t]; g.fillRect(2, 2, 20, 20); g.strokeStyle = "#8fa3c9"; g.strokeRect(2.5, 2.5, 19, 19); if (c.dataset.tile === "erase") { g.strokeStyle = "#ff3e5e"; g.beginPath(); g.moveTo(5, 5); g.lineTo(19, 19); g.stroke(); } }
  $("#edName").addEventListener("input", (e) => { U.ed.map.name = e.target.value; U.ed.dirty = true; });
  edSync(); relayout(); musicPlay("title", 1);
}
function codeToMapLoose(code) { const d = unwrapCode(code, MAP_PREFIX, "map"); return { name: String(d.n || "Untitled").slice(0, 40), tiles: unrleTiles(d.t) }; }
function edSync() {
  for (const b of $$("[data-ed=tool]", edbar)) b.classList.toggle("on", b.dataset.k === U.ed.tool);
  const a = analyze(U.ed.map), m = $("#edmsg");
  m.textContent = a.ok ? `Ready: ${a.spawns.length} spawn${a.spawns.length > 1 ? "s" : ""}, route${a.routes.length > 1 ? "s" : ""} ${a.routes.map((r) => r.length).join(" / ")} tiles` : a.err;
  m.className = a.ok ? "" : "err";
}
function edPaint(cell, first) {
  if (!cell) return;
  const E = U.ed, [x, y] = cell, i = idx(x, y), T = E.map.tiles;
  const tool = ED_TOOLS.find((t) => t[0] === E.tool), val = tool[2];
  if (first) { E.undo.push(T.slice()); if (E.undo.length > 60) E.undo.shift(); }
  if (E.tool === "core") { for (let k = 0; k < T.length; k++) if (T[k] === T_CORE) T[k] = T_PATH; }
  if (T[i] === val) return;
  T[i] = val; E.dirty = true; E.exitArm = false; sfx("paint"); edSync();
}
function edAction(a, el) {
  const E = U.ed;
  switch (a) {
    case "tool": E.tool = el.dataset.k; sfx("move"); return edSync();
    case "random": E.undo.push(E.map.tiles.slice()); E.map.tiles = randomMap((Math.random() * 4294967296) >>> 0).tiles; E.dirty = true; sfx("ok"); return edSync();
    case "clear": E.undo.push(E.map.tiles.slice()); E.map.tiles = new Array(COLS * ROWS).fill(T_EMPTY); E.dirty = true; sfx("back"); return edSync();
    case "undo": if (E.undo.length) { E.map.tiles = E.undo.pop(); sfx("back"); edSync(); } return;
    case "test": { const an = analyze(E.map); if (!an.ok) { sfx("deny"); UI.toast("Can't test yet", an.err, "err"); return; } return startGame({ map: { name: E.map.name, tiles: E.map.tiles.slice() }, diff: "normal", test: true, seed: (Math.random() * 4294967296) >>> 0 }); }
    case "save": {
      const an = analyze(E.map); if (!an.ok) { sfx("deny"); UI.toast("Can't save yet", an.err, "err"); return; }
      const entry = { name: (E.map.name || "My map").trim() || "My map", code: mapToCode(E.map), mine: true, created: Date.now() };
      if (E.idx != null && SAVE.maps[E.idx]) SAVE.maps[E.idx] = entry; else { SAVE.maps.unshift(entry); E.idx = 0; }
      save(); E.dirty = false; sfx("upgrade"); UI.toast("Map saved", entry.name); checkAch({ towers: [], test: false });
      return;
    }
    case "share": { const an = analyze(E.map); if (!an.ok) { sfx("deny"); UI.toast("Can't share yet", an.err, "err"); return; } copyText(mapToCode(E.map)); UI.toast("Map code copied", "Paste it anywhere to share your map."); return; }
    case "exit":
      if (E.dirty && !E.exitArm) { E.exitArm = true; UI.toast("Unsaved changes", "Press Exit again to leave without saving.", "err"); sfx("deny"); return; }
      U.ed = null; edbar.innerHTML = ""; sfx("back"); return showMaps();
  }
}
edbar.addEventListener("click", (e) => { const b = e.target.closest("[data-ed]"); if (b) edAction(b.dataset.ed, b); });

/* ---------- starting games ---------- */
function startGame(opts) {
  try { newGame(opts); } catch (e) { UI.toast("Can't start", e.message, "err"); return; }
  U.lastOpts = opts; U.place = U.sel = U.pend = null; U.speedIdx = 0; G.speed = 1; U.acc = 0; U.previewN = -1; U.infoSig = "";
  if (!opts.test) clearGameState();
  hideUI(); setState("play"); buildDock(); relayout(); renderInfo(true);
  musicPlay("game", 1);
  banner(opts.daily ? "DAILY GRID" : opts.test ? "TEST RUN" : "GRID ONLINE", opts.test ? "Towers are all unlocked while testing" : "Build towers, then start the first wave");
  portraitHint();
}
function portraitHint() {
  if (matchMedia("(orientation: portrait)").matches && (IN.device === "touch" || matchMedia("(pointer: coarse)").matches)) UI.toast("Turn your phone sideways", "The grid is much bigger in landscape.");
}
function resume() {
  const s = loadGameState(); if (!s) return showTitle();
  try { resumeGame(s); } catch { clearGameState(); return showTitle(); }
  U.lastOpts = { map: G.map, diff: G.diff, endless: G.endless, daily: G.daily, date: G.o.date, seed: G.o.seed, mode: G.o.mode };
  U.place = U.sel = U.pend = null; U.speedIdx = 0; G.speed = 1; U.acc = 0; U.previewN = -1; U.infoSig = "";
  hideUI(); setState("play"); buildDock(); relayout(); renderInfo(true); musicPlay("game", 1);
  banner("WAVE " + (G.cleared + 1), "Picking up where you left off");
}

/* ---------- dock + info panel ---------- */
function buildDock() {
  towerList.innerHTML = TOWER_ORDER.map((id, i) => {
    const d = TOWERS[id], un = towerUnlocked(id), ach = ACH.find((a) => a.unlock === id);
    return `<button class="tb ${un ? "" : "lock"}" data-t="${id}" title="${un ? d.name + " · " + d.desc : "Locked. " + (ach ? ach.desc : "")}"><span class="hk">${i + 1}</span><canvas width="72" height="72"></canvas><span class="nm">${d.name}</span><span class="co">${un ? "◆" + d.cost : "🔒"}</span></button>`;
  }).join("");
  for (const b of $$(".tb", towerList)) { const g = $("canvas", b).getContext("2d"); drawTower(g, b.dataset.t, 36, 36, 78, { lv: 1, spin: 0.6 }); }
}
towerList.addEventListener("click", (e) => { const b = e.target.closest(".tb"); if (b) choosePlace(b.dataset.t); });
towerList.addEventListener("pointerover", (e) => { const b = e.target.closest(".tb"); if (b && !U.place && !U.sel && e.pointerType === "mouse") { U.hoverType = b.dataset.t; U.infoSig = ""; } });
towerList.addEventListener("pointerout", () => { if (U.hoverType) { U.hoverType = null; U.infoSig = ""; } });
function choosePlace(id) {
  if (!G || G.over) return;
  if (!towerUnlocked(id)) { const a = ACH.find((x) => x.unlock === id); UI.toast(TOWERS[id].name + " is locked", a ? "Unlock: " + a.desc : "", "err"); sfx("deny"); return; }
  if (U.place === id) { U.place = null; sfx("back"); }
  else { U.place = id; U.sel = null; U.pend = null; sfx("move"); if (G.credits < TOWERS[id].cost) UI.toast("Not enough credits", `${TOWERS[id].name} costs ◆${TOWERS[id].cost}`, "err"); }
  U.sellArm = false; U.infoSig = ""; renderInfo(true);
}
function select(t) { U.sel = t; U.place = null; U.pend = null; U.sellArm = false; U.infoSig = ""; sfx("move"); renderInfo(true); }
function deselect() { if (U.sel || U.place) { U.sel = null; U.place = null; U.pend = null; U.sellArm = false; U.infoSig = ""; renderInfo(true); } }
function statRows(type, L, t) {
  const d = TOWERS[type], dm = t ? t.s.dmgMul : 1, rr = t && d.range ? t.s.range / d.range[t.lv - 1] : 1, nxt = L < 4 && t ? L + 1 : 0;
  const pair = (f, digits = 0) => { const a = f(L).toFixed(digits); if (!nxt) return a; const b = f(nxt).toFixed(digits); return a === b ? a : `${a} <span class="up">→ ${b}</span>`; };
  const rows = [];
  if (d.dmg) rows.push(["Damage", pair((l) => d.dmg[l - 1] * dm)]);
  if (d.dps) rows.push([type === "laser" ? "Damage/s" : "Damage/s", pair((l) => d.dps[l - 1] * dm) + (type === "laser" ? " <span class='muted'>(up to ×3)</span>" : "")]);
  if (d.rate) rows.push(["Fire rate", pair((l) => d.rate[l - 1], 2) + "/s"]);
  if (d.range) rows.push(["Range", pair((l) => d.range[l - 1] * rr, 1)]);
  if (d.splash) rows.push(["Blast", pair((l) => d.splash[l - 1], 2)]);
  if (d.slow) rows.push(["Slow", pair((l) => d.slow[l - 1] * 100) + "%"]);
  if (d.chains) rows.push(["Jumps", pair((l) => d.chains[l - 1])]);
  if (d.boost) { rows.push(["Damage boost", "+" + pair((l) => d.boost[l - 1] * 100) + "%"]); rows.push(["Range boost", "+" + pair((l) => d.rboost[l - 1] * 100) + "%"]); rows.push(["Radius", pair((l) => d.radius[l - 1], 1)]); }
  if (d.income) rows.push(["Credits/wave", pair((l) => d.income[l - 1])]);
  if (!d.air) rows.push(["Drones", "<span class='red'>can't hit</span>"]);
  return rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join("");
}
function renderInfo(force) {
  if (!G) return;
  const t = U.sel && G.towers.includes(U.sel) ? U.sel : null; if (!t) U.sel = null;
  const type = t ? null : U.place || U.hoverType;
  const sig = [t ? t.id + ":" + t.lv + ":" + t.target + ":" + t.kills + ":" + U.sellArm : "", type, Math.floor(G.credits), G.running].join("|");
  if (!force && sig === U.infoSig) return;
  U.infoSig = sig;
  if (t) {
    const d = TOWERS[t.type], up = upgradeCost(t), can = up && G.credits >= up, sv = sellValue(t);
    infoEl.innerHTML = `<h3 style="color:${d.color}">${d.name} · Level ${t.lv}</h3>
      <div class="rows">${statRows(t.type, t.lv, t)}<span>Kills</span><span>${fmt(t.kills)}</span><span>Damage dealt</span><span>${fmt(t.dmg)}</span></div>
      ${!d.support ? `<div class="tgt">${TARGETS.map(([k, n]) => `<button class="small ${t.target === k ? "on" : ""}" data-i="target" data-k="${k}">${n}</button>`).join("")}</div>` : ""}
      <div class="perk">${t.lv >= 4 ? "★ " : "Level 4: "}${d.perk}</div>
      <div class="act"><button class="${can ? "primary" : ""}" data-i="upgrade" ${up ? (can ? "" : "disabled") : "disabled"}>${up ? `Upgrade ◆${up}` : "Max level"}<kbd>U</kbd></button>
      <button class="${U.sellArm ? "danger" : ""}" data-i="sell">${U.sellArm ? "Confirm sell" : `Sell ◆${sv}`}<kbd>S</kbd></button></div>`;
  } else if (type) {
    const d = TOWERS[type], ok = G.credits >= d.cost;
    infoEl.innerHTML = `<h3 style="color:${d.color}">${d.name} <span class="${ok ? "gold" : "red"}">◆${d.cost}</span></h3><p>${d.desc}</p>
      <div class="rows">${statRows(type, 1, null)}</div><div class="perk">Level 4: ${d.perk}</div>
      <div class="hint">${U.place ? (document.body.classList.contains("touch") ? "Tap a free tile, then tap it again to build." : "Click a free tile to build. Hold Shift to build more. Right-click or Esc to cancel.") : "Click to select."}</div>`;
  } else {
    infoEl.innerHTML = `<h3>${G.map.name}</h3><p>${G.running ? "Glitches are on the grid." : "Build phase. Place towers, then start the wave."}</p>
      <div class="hint">Pick a tower above${document.body.classList.contains("touch") ? "" : " or press 1-9"}. Click a built tower to upgrade or sell it.</div>
      <div class="rows"><span>Difficulty</span><span>${G.D.name}${G.endless ? " · Endless" : ""}</span><span>Glitches destroyed</span><span>${fmt(G.kills)}</span><span>Lives lost</span><span>${G.leaked}</span></div>`;
  }
}
infoEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-i]"); if (!b || !U.sel) return;
  const t = U.sel;
  if (b.dataset.i === "target") { t.target = b.dataset.k; sfx("move"); U.infoSig = ""; renderInfo(true); }
  else if (b.dataset.i === "upgrade") doUpgrade();
  else if (b.dataset.i === "sell") doSell();
});
function doUpgrade() { const t = U.sel; if (!t) return; const err = upgradeTower(t); if (err) { sfx("deny"); UI.toast(err, "", "err"); } else if (!G.running) saveGameState(); U.sellArm = false; renderInfo(true); }
function doSell() {
  const t = U.sel; if (!t) return;
  if (!U.sellArm) { U.sellArm = true; sfx("move"); renderInfo(true); return; }
  sellTower(t); U.sel = null; U.sellArm = false; if (!G.running) saveGameState(); renderInfo(true);
}

/* ---------- top bar ---------- */
$("#btnWave").addEventListener("click", () => callWave());
$("#btnSpeed").addEventListener("click", () => cycleSpeed());
$("#btnPause").addEventListener("click", () => pauseGame());
function callWave() {
  if (!G || G.over || U.state !== "play") return;
  if (G.running && G.queue.length) { sfx("deny"); return; }
  startWave(); U.infoSig = "";
}
function cycleSpeed() { if (!G) return; U.speedIdx = (U.speedIdx + 1) % SPEEDS.length; G.speed = SPEEDS[U.speedIdx]; sfx("move"); }
function setTop(id, v, cls) { if (U.top[id] !== v) { U.top[id] = v; const el = $("#" + id); el.textContent = v; } }
function updateTop() {
  if (!G || topbar.hidden) return;
  setTop("credits", fmt(G.credits));
  setTop("lives", String(G.lives)); $("#lives").classList.toggle("low", G.lives <= Math.ceil(G.maxLives * 0.25));
  setTop("wave", G.endless || G.won ? String(G.wave) : `${G.wave}/${WIN_WAVE}`);
  const btn = $("#btnWave"), n = G.wave + 1;
  const label = G.over ? "Game over" : !G.running ? `Start wave ${n}` : G.queue.length ? `Wave ${G.wave} arriving` : `Call wave ${n} early`;
  if (U.top.btn !== label) { U.top.btn = label; btn.innerHTML = esc(label) + (G.over || (G.running && G.queue.length) ? "" : "<kbd>Space</kbd>"); }
  btn.disabled = G.over || (G.running && G.queue.length > 0);
  const sp = SPEEDS[U.speedIdx] + "×"; if (U.top.sp !== sp) { U.top.sp = sp; $("#btnSpeed").innerHTML = sp + "<kbd>F</kbd>"; }
  if (G.preview && U.previewN !== G.preview.n) {
    U.previewN = G.preview.n;
    const pv = $("#preview"); pv.innerHTML = `<span class="muted" style="font-size:.85em">Next:</span>`;
    for (const [type, n2] of Object.entries(G.preview.summary)) {
      const chip = document.createElement("span"); chip.className = "chip" + (type === "boss" ? " boss" : ""); chip.title = ENEMIES[type].name + ": " + ENEMIES[type].desc;
      chip.appendChild(miniShape(type, 32)); chip.appendChild(document.createTextNode("×" + n2)); pv.appendChild(chip);
    }
  }
  for (const b of towerList.children) b.classList.toggle("poor", G.credits < TOWERS[b.dataset.t].cost), b.classList.toggle("sel", U.place === b.dataset.t);
}

/* ---------- pause / end screens ---------- */
function pauseGame() { if (U.state !== "play" || !G || G.over) return; setState("pause"); showPause(); sfx("back"); }
function showPause() {
  const testing = G.test;
  show(`<h2>Paused</h2>
    <div class="stats"><div class="st"><small>Wave</small><b>${G.wave}</b></div><div class="st"><small>Credits</small><b class="gold">${fmt(G.credits)}</b></div><div class="st"><small>Lives</small><b>${G.lives}</b></div><div class="st"><small>Destroyed</small><b>${fmt(G.kills)}</b></div></div>
    <div class="menu">
      <button class="primary" data-a="resume" autofocus>Resume</button>
      <button data-a="settings" data-from="pause">Settings</button>
      ${testing ? `<button data-a="backed">Back to editor</button>` : `<button data-a="savequit">Save &amp; quit</button><button class="danger" data-a="giveup">End this run</button>`}
    </div>
    ${!testing && G.running ? `<p class="sub">Save &amp; quit keeps your game as it was when this wave started.</p>` : ""}`, { back: "resume" });
}
function finishStats() {
  return `<div class="stats"><div class="st"><small>Waves cleared</small><b>${G.cleared}</b></div><div class="st"><small>Destroyed</small><b>${fmt(G.kills)}</b></div><div class="st"><small>Credits earned</small><b class="gold">${fmt(G.earned)}</b></div><div class="st"><small>Time</small><b>${fmtTime(G.timeLive)}</b></div></div>`;
}
function showLose() {
  if (U.state !== "play" && U.state !== "pause") return;
  setState("over");
  const best = G.prevBest !== undefined && G.cleared > G.prevBest && !G.test;
  show(`<div class="big lose">SYSTEM CRASH</div><p class="sub">The core fell on wave ${G.wave}${G.daily ? " of today's daily grid" : ""}.${best ? ` <b class="gold">New best!</b>` : ""}</p>
    ${finishStats()}
    <div class="row">${G.test ? `<button class="primary" data-a="backed" autofocus>Back to editor</button>` : `<button class="primary" data-a="retry" autofocus>Retry this grid</button>${G.daily ? `<button data-a="copydaily">Copy result</button>` : `<button data-a="setup">New game</button>`}`}<button data-a="title">Menu</button></div>
    <div class="msg" id="dmsg"></div>`);
}
function showWin() {
  setState("over"); musicPlay("win", 3); sfx("win");
  show(`<div class="big win">GRID SECURED</div><p class="sub">You held the core for all ${WIN_WAVE} waves on ${G.D.name}${G.leaked ? "" : " without losing a single life"}.</p>
    ${finishStats()}
    <div class="row"><button class="primary" data-a="keepgoing" autofocus>Keep going (endless)</button>${G.test ? `<button data-a="backed">Back to editor</button>` : `<button data-a="finish">Finish</button>`}</div>`);
}

/* ---------- actions ---------- */
function act(a, d = {}, el) {
  switch (a) {
    case "title": sfx("back"); return showTitle();
    case "setup": sfx("ok"); return showSetup();
    case "continue": sfx("ok"); return resume();
    case "src": U.setup.src = d.v; sfx("move"); return showSetup();
    case "reroll": U.setup.seed = (Math.random() * 4294967296) >>> 0; sfx("move"); showSetup(); { const b = $("[data-a=reroll]", ui); if (b && IN.device !== "touch") b.focus(); } return;
    case "pickmap": U.setup.pick = +d.i; sfx("move"); return showSetup();
    case "diff": U.setup.diff = d.v; sfx("move"); showSetup(); { const b = $(`[data-a=diff][data-v=${d.v}]`, ui); if (b && IN.device !== "touch") b.focus(); } return;
    case "endless": U.setup.endless = d.v === "1"; sfx("move"); showSetup(); { const b = $(`[data-a=endless][data-v="${d.v}"]`, ui); if (b && IN.device !== "touch") b.focus(); } return;
    case "start": {
      const S = U.setup; if (!U.setupMap) return;
      SAVE.last = { diff: S.diff, endless: S.endless }; save();
      return startGame({ map: U.setupMap, diff: S.diff, endless: S.endless, seed: S.src === "random" ? S.seed : hashStr(rleTiles(U.setupMap.tiles)) ^ ((Math.random() * 1e9) | 0), mode: S.src });
    }
    case "daily": sfx("ok"); return showDaily();
    case "startdaily": { const date = todayStr(); return startGame({ map: randomMap(hashStr("gridlock:" + date), "Daily grid " + date), diff: "normal", endless: true, daily: true, date, seed: hashStr("gridlock-waves:" + date), mode: "daily" }); }
    case "copydaily": { const d2 = SAVE.daily; return copyText(`GRIDLOCK · Daily grid ${todayStr()}\nCleared ${d2.date === todayStr() ? d2.wave : 0} waves`, $("#dmsg")); }
    case "maps": sfx("ok"); return showMaps();
    case "newmap": sfx("ok"); return openEditor(null);
    case "medit": sfx("ok"); try { return openEditor(+d.i); } catch (e) { UI.toast("Can't open that map", e.message, "err"); return; }
    case "mplay": { try { const map = codeToMap(SAVE.maps[+d.i].code); return startGame({ map, diff: SAVE.last.diff || "normal", endless: false, seed: (Math.random() * 4294967296) >>> 0, mode: "mine" }); } catch (e) { UI.toast("Can't play that map", e.message, "err"); return; } }
    case "mshare": sfx("ok"); return showShare(+d.i);
    case "copyshare": return copyText($("#shareOut").value, $("#sharemsg"));
    case "mdel": if (el) { el.textContent = "Sure?"; el.dataset.a = "mdel2"; } sfx("back"); return;
    case "mdel2": SAVE.maps.splice(+d.i, 1); save(); sfx("sell"); return showMaps();
    case "importmap": sfx("ok"); return showImport();
    case "doimport": {
      const m = $("#impmsg");
      try { const map = codeToMap($("#mapIn").value); SAVE.maps.unshift({ name: map.name, code: mapToCode(map), mine: false, created: Date.now() }); save(); sfx("upgrade"); return showMaps(); }
      catch (e) { m.textContent = e.message; m.className = "msg err"; sfx("deny"); }
      return;
    }
    case "ach": sfx("ok"); return showAch();
    case "help": sfx("ok"); return showHelp();
    case "settings": sfx("ok"); return showSettings(d.from === "pause" || U.setBack === "pause" && U.state === "pause" ? "pause" : "title");
    case "pause": return showPause();
    case "tog": SAVE.settings[d.k] = !SAVE.settings[d.k]; save(); sfx("move"); if (el) el.textContent = SAVE.settings[d.k] ? "On" : "Off"; if (d.k === "auto" && G && !G.running && SAVE.settings.auto && G.wave > 0) G.autoT = 2.5; return;
    case "fs": { const de = document.documentElement; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (de.requestFullscreen) de.requestFullscreen().catch(() => {}); return; }
    case "savecode": sfx("ok"); return showSaveCode();
    case "copysave": return copyText($("#codeOut").value, $("#codemsg"));
    case "loadsave": {
      const m = $("#codemsg");
      try {
        const data = sanitize(mergeSave(defaultSave(), unwrapCode($("#codeIn").value, "GRIDLOCK-SAVE:", "save")));
        if (el && el.dataset.armed !== "1") { el.dataset.armed = "1"; el.textContent = "Replace my progress?"; el.classList.add("danger"); m.textContent = `That code has ${Object.keys(data.ach).length} achievements and ${data.maps.length} maps.`; m.className = "msg"; return; }
        SAVE = data; save(); applyVolumes(); sfx("upgrade"); m.textContent = "Loaded."; m.className = "msg"; setTimeout(showTitle, 500);
      } catch (e) { m.textContent = e.message; m.className = "msg err"; sfx("deny"); }
      return;
    }
    case "reset": if (el) { el.textContent = "Erase all progress?"; el.dataset.a = "reset2"; } sfx("back"); return;
    case "reset2": { const keep = SAVE.settings; SAVE = defaultSave(); SAVE.settings = keep; save(); clearGameState(); sfx("back"); return showTitle(); }
    case "resume": hideUI(); setState("play"); sfx("ok"); return;
    case "savequit": if (!G.running) saveGameState(); sfx("back"); G = null; return showTitle();
    case "giveup": if (el && el.dataset.armed !== "1") { el.dataset.armed = "1"; el.textContent = "Really end it?"; sfx("back"); return; } clearGameState(); G.over = true; bankGame(); setState("play"); showLose(); return;
    case "backed": { const E = U.ed; G = null; if (!E) return showMaps(); hideUI(); setState("editor"); edSync(); relayout(); musicPlay("title", 1); return; }
    case "retry": sfx("ok"); return startGame({ ...U.lastOpts, map: { name: G.map.name, tiles: G.map.tiles.slice(), seed: G.map.seed } });
    case "keepgoing": G.endless = true; hideUI(); setState("play"); musicPlay("game", 3); sfx("ok"); saveGameState(); return;
    case "finish": bankGame(); clearGameState(); sfx("ok"); return showTitle();
  }
}
ui.addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b && !b.disabled) act(b.dataset.a, b.dataset, b); });
function goBack() { if (U.back) act(U.back); }

/* ---------- board input ---------- */
function boardClick(cell, e) {
  if (!G || G.over) return;
  if (e.button === 2) { deselect(); return; }
  if (!cell) { deselect(); return; }
  const [x, y] = cell, t = towerAt(x, y), touch = e.pointerType === "touch";
  if (U.place) {
    if (t) { select(t); return; }
    const err = canPlace(U.place, x, y);
    if (touch && !(U.pend && U.pend[0] === x && U.pend[1] === y)) { U.pend = [x, y]; if (err) UI.toast(err, "", "err"); sfx("move"); return; }
    if (err) { sfx("deny"); UI.toast(err, "", "err"); return; }
    const type = U.place;
    placeTower(type, x, y); U.pend = null; checkAch(G);
    if (!G.running) saveGameState();
    if (!(e.shiftKey && G.credits >= TOWERS[type].cost)) U.place = null;
    U.infoSig = ""; renderInfo(true);
    return;
  }
  if (t) { if (U.sel === t) deselect(); else select(t); } else deselect();
}
cv.addEventListener("contextmenu", (e) => e.preventDefault());
cv.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") { U.cursorOn = false; }
  U.hover = cellAt(e.clientX, e.clientY);
  if (U.state === "editor" && U.ed && U.ed.down) { const c = U.hover; if (c && U.ed.tool !== "spawn" && U.ed.tool !== "core") edPaint(c, false); }
});
cv.addEventListener("pointerleave", () => { U.hover = null; });
cv.addEventListener("pointerdown", (e) => {
  audio();
  const cell = cellAt(e.clientX, e.clientY);
  if (U.state === "play") { boardClick(cell, e); return; }
  if (U.state === "editor" && U.ed) {
    if (e.button === 2) { const prev = U.ed.tool; U.ed.tool = "erase"; edPaint(cell, true); U.ed.tool = prev; U.ed.down = false; return; }
    edPaint(cell, true); U.ed.down = true; try { cv.setPointerCapture(e.pointerId); } catch {}
  }
});
addEventListener("pointerup", () => { if (U.ed) U.ed.down = false; });
addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch") { IN.device = "touch"; document.body.classList.add("touch"); U.cursorOn = false; }
  else if (e.pointerType === "mouse") { IN.device = "mouse"; }
}, true);

/* ---------- keyboard ---------- */
addEventListener("keydown", (e) => {
  audio(); IN.device = "kb"; document.body.classList.remove("touch");
  const tg = e.target, typing = tg && (tg.tagName === "TEXTAREA" || (tg.tagName === "INPUT" && tg.type !== "range"));
  if (typing) { if (e.code === "Escape") tg.blur(); return; }
  const st = U.state;
  if (st === "editor" && U.ed) {
    const n = +e.key; if (n >= 1 && n <= ED_TOOLS.length) { U.ed.tool = ED_TOOLS[n - 1][0]; edSync(); sfx("move"); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { edAction("undo"); e.preventDefault(); return; }
    if (e.code === "KeyT") { edAction("test"); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") { edAction("save"); e.preventDefault(); return; }
    if (e.code === "Escape") { edAction("exit"); return; }
    return;
  }
  if (st === "play" && G) {
    const n = +e.key;
    if (n >= 1 && n <= 9 && !e.repeat) { choosePlace(TOWER_ORDER[n - 1]); return; }
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.code];
    if (dir) { moveCursor(dir[0], dir[1]); e.preventDefault(); return; }
    if (e.repeat) return;
    switch (e.code) {
      case "Space": callWave(); e.preventDefault(); return;
      case "Enter": case "KeyE": if (U.cursorOn) boardClick(U.cursor, { button: 0, pointerType: "key", shiftKey: e.shiftKey }); return;
      case "KeyF": cycleSpeed(); return;
      case "KeyU": doUpgrade(); return;
      case "KeyS": case "Delete": case "Backspace": doSell(); e.preventDefault(); return;
      case "KeyT": if (U.sel && !TOWERS[U.sel.type].support) { const i = TARGETS.findIndex((x) => x[0] === U.sel.target); U.sel.target = TARGETS[(i + 1) % TARGETS.length][0]; sfx("move"); renderInfo(true); } return;
      case "Escape": case "KeyP": if (U.place || U.sel) deselect(); else pauseGame(); return;
    }
    return;
  }
  const root = ui.firstElementChild;
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.code];
  if (dir && root) { if (navMove(root, dir[0], dir[1])) sfx("move"); e.preventDefault(); return; }
  if (e.code === "Escape" || (e.code === "KeyP" && st === "pause")) { goBack(); e.preventDefault(); }
});
function moveCursor(dx, dy) {
  if (!U.cursorOn) { U.cursorOn = true; if (U.hover) U.cursor = U.hover.slice(); }
  U.cursor = [clamp(U.cursor[0] + dx, 0, COLS - 1), clamp(U.cursor[1] + dy, 0, ROWS - 1)];
  sfx("move");
  const t = towerAt(U.cursor[0], U.cursor[1]); if (!U.place) { if (t) select(t); else if (U.sel) deselect(); }
}
addEventListener("blur", () => pauseGame());
document.addEventListener("visibilitychange", () => { if (document.hidden) { pauseGame(); if (AU.ctx && AU.ctx.state === "running") AU.ctx.suspend().catch(() => {}); } else audio(); });

/* ---------- gamepad ---------- */
function pollPad(dt) {
  const s = readPad(); if (!s) { U.padPrev = {}; return; }
  const p = U.padPrev, edge = (k) => s[k] && !p[k];
  if (s.a || s.b || s.x || s.y || s.up || s.down || s.left || s.right || s.start) { if (IN.device !== "pad") { IN.device = "pad"; document.body.classList.remove("touch"); } }
  const vy = s.up ? -1 : s.down ? 1 : 0, vx = s.left ? -1 : s.right ? 1 : 0, nd = vy * 3 + vx;
  if (U.state === "play" && G) {
    if (nd !== U.curDir) { U.curDir = nd; U.curRepeat = 0.3; if (nd) moveCursor(vx, vy); }
    else if (nd) { U.curRepeat -= dt; if (U.curRepeat <= 0) { U.curRepeat = 0.09; moveCursor(vx, vy); } }
    if (edge("a")) boardClick(U.cursor, { button: 0, fromPad: true });
    if (edge("b")) deselect();
    if (edge("x")) doUpgrade();
    if (edge("y")) doSell();
    if (edge("lb") || edge("rb")) { const list = TOWER_ORDER.filter(towerUnlocked); const i = list.indexOf(U.place); choosePlace(list[(i + (edge("rb") ? 1 : -1) + list.length + (i < 0 && edge("lb") ? 1 : 0)) % list.length]); }
    if (edge("start")) callWave();
    if (edge("rt")) cycleSpeed();
    if (edge("back")) pauseGame();
  } else if (U.state === "editor" && U.ed) {
    if (nd !== U.curDir) { U.curDir = nd; U.curRepeat = 0.3; if (nd) { U.cursorOn = true; U.cursor = [clamp(U.cursor[0] + vx, 0, COLS - 1), clamp(U.cursor[1] + vy, 0, ROWS - 1)]; if (s.a) edPaint(U.cursor, false); } }
    else if (nd) { U.curRepeat -= dt; if (U.curRepeat <= 0) { U.curRepeat = 0.09; U.cursor = [clamp(U.cursor[0] + vx, 0, COLS - 1), clamp(U.cursor[1] + vy, 0, ROWS - 1)]; if (s.a) edPaint(U.cursor, false); } }
    if (edge("a")) edPaint(U.cursor, true);
    if (edge("lb") || edge("rb")) { const i = ED_TOOLS.findIndex((t) => t[0] === U.ed.tool); U.ed.tool = ED_TOOLS[(i + (edge("rb") ? 1 : ED_TOOLS.length - 1)) % ED_TOOLS.length][0]; edSync(); }
    if (edge("x")) edAction("test");
    if (edge("b")) edAction("exit");
  } else {
    const root = ui.firstElementChild;
    if (nd !== U.navDir) { U.navDir = nd; U.navRepeat = 0.35; if (nd && root && navMove(root, vy ? 0 : vx, vy)) sfx("move"); }
    else if (nd) { U.navRepeat -= dt; if (U.navRepeat <= 0) { U.navRepeat = 0.12; if (root && navMove(root, vy ? 0 : vx, vy)) sfx("move"); } }
    if (edge("a")) { const el = document.activeElement; if (el && ui.contains(el) && el.tagName === "BUTTON") el.click(); else { const f = root && navList(root)[0]; if (f) f.focus(); } }
    else if (edge("b")) goBack();
    else if (edge("start") && U.state === "pause") act("resume");
  }
  U.padPrev = s;
}

/* ---------- overlay drawn on top of the board ---------- */
function playOverlay(g) {
  const c = LAY.cell;
  const cur = U.cursorOn ? U.cursor : U.pend || U.hover;
  if (U.place && SAVE.settings.ranges) for (const t of G.towers) if (!TOWERS[t.type].support) { g.strokeStyle = `rgba(${TOWERS[t.type].rgb},0.18)`; g.lineWidth = 1; g.beginPath(); g.arc(sx(t.cx), sy(t.cy), t.s.range * c, 0, TAU); g.stroke(); }
  if (U.sel) {
    const t = U.sel, d = TOWERS[t.type];
    drawRange(g, t.cx, t.cy, t.s.range, d.rgb);
    if (d.minRange) { g.strokeStyle = "rgba(255,62,94,0.5)"; g.setLineDash([4, 4]); g.beginPath(); g.arc(sx(t.cx), sy(t.cy), d.minRange * c, 0, TAU); g.stroke(); g.setLineDash([]); }
    g.strokeStyle = "#ffe14d"; g.lineWidth = 2; g.strokeRect(sx(t.x) + 1, sy(t.y) + 1, c - 2, c - 2);
  }
  if (U.place && cur) {
    const [x, y] = cur, d = TOWERS[U.place], ok = !canPlace(U.place, x, y) || (canPlace(U.place, x, y) === "Not enough credits." && false);
    const free = inB(x, y) && buildable(G.map.tiles[idx(x, y)]) && !towerAt(x, y);
    const range = (d.range ? d.range[0] : d.radius[0]) * (inB(x, y) && G.map.tiles[idx(x, y)] === T_PAD ? 1.1 : 1);
    drawRange(g, x + 0.5, y + 0.5, range, d.rgb, ok);
    drawTower(g, U.place, sx(x + 0.5), sy(y + 0.5), c, { alpha: free ? 0.6 : 0.25 });
    if (!free) { g.strokeStyle = "rgba(255,62,94,0.9)"; g.lineWidth = 2; g.beginPath(); g.moveTo(sx(x) + c * 0.25, sy(y) + c * 0.25); g.lineTo(sx(x) + c * 0.75, sy(y) + c * 0.75); g.moveTo(sx(x) + c * 0.75, sy(y) + c * 0.25); g.lineTo(sx(x) + c * 0.25, sy(y) + c * 0.75); g.stroke(); }
    if (U.pend && U.pend[0] === x && U.pend[1] === y && free) { g.fillStyle = "rgba(255,225,77,0.95)"; g.font = `700 ${Math.max(11, c * 0.28)}px Rajdhani, sans-serif`; g.textAlign = "center"; g.fillText(ok ? "Tap again to build" : "Not enough credits", sx(x + 0.5), sy(y) - c * 0.2); }
  } else if (cur && !U.sel && U.state === "play") {
    const [x, y] = cur; if (inB(x, y)) { g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 1; g.strokeRect(sx(x) + 0.5, sy(y) + 0.5, c - 1, c - 1); }
  }
  if (U.cursorOn) { const [x, y] = U.cursor; g.strokeStyle = "#ffe14d"; g.lineWidth = 2; g.setLineDash([c * 0.15, c * 0.1]); g.strokeRect(sx(x) + 2, sy(y) + 2, c - 4, c - 4); g.setLineDash([]); }
}
function editorOverlay(g) {
  const c = LAY.cell, cur = U.cursorOn ? U.cursor : U.hover;
  g.strokeStyle = "rgba(120,150,230,0.12)"; g.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(sx(x), sy(0)); g.lineTo(sx(x), sy(ROWS)); g.stroke(); }
  for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(sx(0), sy(y)); g.lineTo(sx(COLS), sy(y)); g.stroke(); }
  if (cur) { const [x, y] = cur; g.strokeStyle = "#ffe14d"; g.lineWidth = 2; g.strokeRect(sx(x) + 1, sy(y) + 1, c - 2, c - 2); }
}

/* ---------- main loop ---------- */
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
  pollPad(dt);
  if (U.bannerT > 0) { U.bannerT -= dt; if (U.bannerT <= 0) $("#banner").classList.remove("on"); }
  if (U.state === "play" && G && !G.over) {
    U.acc += dt * G.speed; let n = 0;
    while (U.acc >= 1 / 60 && n < 12) { step(1 / 60); U.acc -= 1 / 60; n++; if (!G || G.over) break; }
    if (n >= 12) U.acc = 0;
    if (G) musicLevelSet(G.running ? 3 : 1);
  }
  if (G && (U.state === "play" || U.state === "pause" || U.state === "over")) {
    render(dt, { game: true, map: G.map, info: G.info, sel: U.sel, overlay: playOverlay });
    updateTop(); U.infoT -= dt; if (U.infoT <= 0) { U.infoT = 0.25; renderInfo(false); }
    if (U.sel && !G.towers.includes(U.sel)) { U.sel = null; renderInfo(true); }
  } else if (U.state === "editor" && U.ed) {
    render(dt, { game: false, map: U.ed.map, info: analyze(U.ed.map), overlay: editorOverlay });
  } else if (U.bg) {
    render(dt, { game: false, map: U.bg, info: analyze(U.bg) });
  }
  requestAnimationFrame(frame);
}
function musicLevelSet(l) { if (MUS.id === "game") MUS.level = l; }
relayout();
showTitle();
requestAnimationFrame(frame);
