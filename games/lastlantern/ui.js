"use strict";
/* LAST LANTERN · ui.js — menus, HUD, level-up + chest screens, input routing and the main loop */

const ui = $("#ui"), hud = $("#hud"), joy = $("#joy"), joyKnob = $("#joyKnob");
const UI = {
  state: "boot", back: null, choices: null, banish: false, lvReady: 0, chestData: null, chestTimers: [], chestDone: false,
  endWait: 0, bannerT: 0, navDir: 0, navRepeat: 0, padPrev: {}, slotSig: "", setBack: "title", lastOpts: null, codexTab: "w",
  sel: { char: SAVE.last.char, stage: SAVE.last.stage, blood: !!SAVE.last.blood, endless: !!SAVE.last.endless },
};
const SKULL = compile([".WWW.", "W0W0W", "WWWWW", ".W.W."]);
$("#skullIc").style.backgroundImage = `url(${SKULL.c.toDataURL()})`;
$("#coinIc").style.backgroundImage = `url(${iconURL("gold")})`;

const LORE = {
  bat: "Fast and fragile. Comes in flocks.", ghoul: "Slow, hungry, never alone.", skel: "Rattles toward the light.",
  shade: "Drifts straight through the crowd.", slime: "Splits apart when it falls.", brute: "Shrugs off knockback and hits hard.",
  cultist: "Keeps its distance and casts.", imp: "Darts from side to side.", boar: "Lowers its head, then charges.",
  golem: "Heavy as a hill.", wisp: "Spits fire from afar.", king: "Raises the dead and slams the ground.",
  lich: "Rings of magic, then she vanishes.", wyrm: "A burning serpent that coils around you.",
};

/* ---------- small helpers ---------- */
function padURL(s, scale = 1, black = false) {
  const D = Math.max(s.w, s.h), [c, g] = mkCanvas(D * scale, D * scale);
  const img = black ? tint(s, "#000000")[0] : s.c;
  g.drawImage(img, Math.floor((D - s.w) / 2) * scale, Math.floor((D - s.h) / 2) * scale, s.w * scale, s.h * scale);
  return c.toDataURL();
}
const _portraits = {};
function portrait(id, black) { const k = id + (black ? "!" : ""); return _portraits[k] || (_portraits[k] = padURL(SPR[id][0], 1, black)); }
function setState(s) {
  UI.state = s;
  if (s === "menu") { if (!R || !R.demo) startDemo(); if (MUS.id !== "title") musicPlay("title", 3); }
  const inRun = R && !R.demo && ["play", "levelup", "chest", "pause", "ending", "psettings"].includes(s);
  hud.hidden = !inRun;
  $("#pauseBtn").hidden = s !== "play";
  if (s !== "play") { endJoy(); }
}
function show(html, o = {}) {
  ui.innerHTML = `<div class="screen ${o.cls || ""}">${html}</div>`;
  UI.back = o.back || null;
  const s = ui.firstElementChild;
  if (o.focus !== false && IN.device !== "touch") {
    const f = (o.focusSel && s.querySelector(o.focusSel)) || s.querySelector("[autofocus]:not([disabled])") || navList(s)[0];
    if (f) f.focus({ preventScroll: true });
  }
  return s;
}
function hideUI() { ui.innerHTML = ""; UI.back = null; }
function copyText(text, msgEl) {
  const done = () => { if (msgEl) { msgEl.textContent = "Copied to clipboard."; msgEl.className = "msg"; } sfx("ok"); };
  const fallback = () => { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch { if (msgEl) { msgEl.textContent = "Couldn't copy. Select the text and copy it yourself."; msgEl.className = "msg err"; } } t.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
}
const achFor = (type, id) => ACH.find((a) => a.reward[0] === type && a.reward[1] === id);

/* ---------- banners + toasts ---------- */
UI.banner = (t, s) => { $("#bannerT").textContent = t; $("#bannerS").textContent = s || ""; $("#banner").classList.add("on"); UI.bannerT = 3.2; };
UI.toast = (name, note) => {
  const el = document.createElement("div"); el.className = "toast";
  el.innerHTML = `<b>${esc(name)}</b><span>${esc(note || "Achievement unlocked")}</span>`;
  $("#toasts").appendChild(el); sfx("ach");
  setTimeout(() => { el.style.transition = "opacity .5s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 520); }, 4200);
};

/* ---------- title ---------- */
function showTitle() {
  setState("menu");
  const best = Math.max(0, ...Object.values(SAVE.stats.best));
  show(`
    <div class="logo"><small>LAST</small><h1>LANTERN</h1><p>Survive the night.</p></div>
    <div class="menu">
      <button class="primary" data-a="play" autofocus>Play</button>
      <button data-a="daily">Daily Night</button>
      <button data-a="shop">Upgrades</button>
      <button data-a="codex">Collection</button>
      <button data-a="ach">Achievements</button>
      <button data-a="settings">Settings</button>
    </div>
    <div class="row">
      <span class="pill"><img src="${iconURL("gold")}" alt="">${fmtInt(SAVE.gold)}</span>
      ${best ? `<span class="pill">Best ${fmtTime(best)}</span>` : ""}
      <button class="ghost small" data-a="howto">How to play</button>
    </div>`, { cls: "dim" });
}
function showHowTo() {
  show(`<div class="bar"><h2>How to play</h2><button data-a="title" autofocus>Back</button></div>
    <div class="panel" style="width:min(100%,40em);text-align:left">
      <div class="list" style="width:100%">
        <div class="li"><div class="tx"><b>Move</b><span>WASD or arrow keys, a controller stick, or drag anywhere on a touch screen.</span></div></div>
        <div class="li"><div class="tx"><b>Fight</b><span>Your weapons attack on their own. Stay alive and keep moving.</span></div></div>
        <div class="li"><div class="tx"><b>Grow</b><span>Walk over gems to level up. Each level, choose a weapon, an item or an upgrade. You can carry 6 of each.</span></div></div>
        <div class="li"><div class="tx"><b>Evolve</b><span>Raise a weapon to level 8 while holding its matching item, then open a chest from an elite enemy or boss.</span></div></div>
        <div class="li"><div class="tx"><b>Lantern posts</b><span>Break them for gold, food, magnets and other treats.</span></div></div>
        <div class="li"><div class="tx"><b>Dawn</b><span>Survive 15 minutes and the sun comes up. Gold you collect buys permanent upgrades, even if you fall.</span></div></div>
      </div>
    </div>
    <div class="keys kbonly"><span>Pause</span><span>Esc / P / Start</span><span>Level up</span><span>1-4 or arrows, R reroll, X skip, B banish</span><span>Controller</span><span>A choose, B back, X reroll, Y skip</span></div>`, { back: "title", cls: "dark" });
}

/* ---------- character + stage select ---------- */
function showChars() {
  setState("menu");
  const cards = CHARS.map((c) => {
    const un = SAVE.chars.includes(c.id), w = WEAPONS[c.weapon];
    return `<button class="card ${un ? "" : "locked"} ${UI.sel.char === c.id ? "sel" : ""}" data-a="char" data-id="${c.id}">
      <img class="portrait" src="${portrait(c.id, !un)}" alt="">
      <span class="nm">${un ? c.name : "???"}</span>
      <span class="ds">${un ? `<b>${c.title}</b><br>${c.perk}` : esc(c.unlock)}</span>
      <span class="ft">${un ? `<img src="${iconURL(c.weapon)}" alt="" style="width:1.5em;vertical-align:middle;image-rendering:pixelated"> ${w.name}` : "Locked"}</span>
    </button>`;
  }).join("");
  show(`<div class="bar"><h2>Choose a keeper</h2><button data-a="title">Back</button></div><div class="cards">${cards}</div>`,
    { back: "title", cls: "dark top", focusSel: `.card[data-id="${UI.sel.char}"]` });
}
function showStages() {
  setState("menu");
  const modes = [];
  if (SAVE.modes.includes("blood")) modes.push(`<button class="toggle ${UI.sel.blood ? "on" : ""}" data-a="mode" data-k="blood">Blood Moon ${UI.sel.blood ? "On" : "Off"}</button>`);
  if (SAVE.modes.includes("endless")) modes.push(`<button class="toggle ${UI.sel.endless ? "on" : ""}" data-a="mode" data-k="endless">Endless Night ${UI.sel.endless ? "On" : "Off"}</button>`);
  const cards = STAGE_ORDER.map((id) => {
    const st = STAGES[id], un = SAVE.stages.includes(id), best = SAVE.stats.best[id + (UI.sel.endless ? ":endless" : "")];
    return `<button class="card stagecard ${un ? "" : "locked"} ${UI.sel.stage === id ? "sel" : ""}" data-a="stage" data-id="${id}">
      <canvas class="sw" data-stage="${id}" width="96" height="24"></canvas>
      <span class="nm">${un ? st.name : "???"}</span>
      <span class="ds">${un ? st.desc : esc(STAGE_UNLOCK[id])}</span>
      <span class="ft">${un ? (best ? "Best " + fmtTime(best) : "Not survived yet") + (SAVE.dawns[id] ? " · <span class='gold'>Dawn seen</span>" : "") : "Locked"}</span>
    </button>`;
  }).join("");
  const s = show(`<div class="bar"><h2>Choose the night</h2><button data-a="chars">Back</button></div>
    ${modes.length ? `<div class="toggles">${modes.join("")}</div>` : ""}
    <div class="cards" style="width:min(100%,62em)">${cards}</div>
    ${modes.length ? `<p class="sub">Blood Moon: enemies are tougher and faster, gold is worth 50% more. Endless Night: dawn never comes.</p>` : ""}`,
    { back: "chars", cls: "dark top", focusSel: `.card[data-id="${UI.sel.stage}"]` });
  for (const c of $$("canvas.sw", s)) {
    const st = STAGES[c.dataset.stage], g = c.getContext("2d"), [tmp, tg] = mkCanvas(128, 128), [em, eg] = mkCanvas(128, 128);
    st.paint(tg, eg, RNG(hashStr(st.id)));
    g.imageSmoothingEnabled = false; g.drawImage(tmp, 0, 40, 96, 24, 0, 0, 96, 24); g.drawImage(em, 0, 40, 96, 24, 0, 0, 96, 24);
    if (!SAVE.stages.includes(st.id)) { g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(0, 0, 96, 24); }
  }
}
function startGame(opts) {
  UI.lastOpts = opts;
  newRun(opts);
  if (!opts.daily) { SAVE.last = { char: opts.char, stage: opts.stage, blood: !!opts.blood, endless: !!opts.endless }; save(); }
  hideUI(); setState("play"); UI.slotSig = "";
  musicPlay(R.stage.song, 1);
  if (SAVE.stats.runs === 0 && !opts.daily) UI.banner(R.stage.name, "Move to survive. Your weapons fire on their own.");
  else UI.banner(R.stage.name, opts.daily ? "Daily night · " + opts.mod.name : opts.blood ? "Blood Moon rises" : opts.endless ? "The night will not end" : "Survive until dawn");
  sfx("ok");
}

/* ---------- daily ---------- */
function showDaily() {
  setState("menu");
  const d = dailyConfig(), ch = CHARS.find((c) => c.id === d.char), st = STAGES[d.stage], dd = SAVE.daily, today = dd.date === d.date && dd.best >= 0;
  show(`<div class="bar"><h2>Daily Night</h2><button data-a="title">Back</button></div>
    <div class="panel" style="width:min(100%,36em);display:flex;gap:1em;align-items:center;text-align:left">
      <img class="portrait" src="${portrait(ch.id)}" alt="">
      <div style="flex:1">
        <div class="muted">${d.date}</div>
        <div style="font:.7em/1.6 var(--px)">${st.name} · ${ch.name}</div>
        <div><b class="gold">${d.mod.name}:</b> ${d.mod.desc}</div>
        <div class="muted">Today's best: ${today ? fmtTime(dd.best) + " · level " + dd.level + " · " + fmtInt(dd.kills) + " kills" : "not played yet"}</div>
      </div>
    </div>
    <p class="sub">Everyone gets the same stage, keeper, twist and waves today. Permanent upgrades are switched off so results are fair to compare.</p>
    <div class="row"><button class="primary" data-a="startdaily" autofocus>Start</button>${today ? `<button data-a="copydaily">Copy result</button>` : ""}</div>
    <div class="msg" id="dmsg"></div>`, { back: "title", cls: "dark" });
}
function dailyText() {
  const d = dailyConfig(), dd = SAVE.daily, ch = CHARS.find((c) => c.id === d.char);
  return `Last Lantern · Daily ${d.date}\n${STAGES[d.stage].name} · ${ch.name} · ${d.mod.name}\nSurvived ${fmtTime(dd.best)} · level ${dd.level} · ${fmtInt(dd.kills)} kills`;
}

/* ---------- shop ---------- */
function showShop(focusId) {
  setState("menu");
  const cards = SHOP.map((it) => {
    const r = SAVE.shop[it.id] | 0, max = r >= it.max, cost = shopCost(it);
    const pips = Array.from({ length: it.max }, (_, i) => `<i class="${i < r ? "on" : ""}"></i>`).join("");
    return `<button class="card" data-a="buy" data-id="${it.id}" ${max ? "aria-disabled=true" : ""}>
      <img class="ic" src="${iconURL(it.icon)}" alt=""><span class="nm">${it.name}</span><span class="ds">${it.desc}</span>
      <span class="pips">${pips}</span><span class="ft ${max ? "green" : SAVE.gold >= cost ? "gold" : "red"}">${max ? "Maxed" : fmtInt(cost) + " gold"}</span></button>`;
  }).join("");
  show(`<div class="bar"><h2>Upgrades</h2><span class="pill"><img src="${iconURL("gold")}" alt="">${fmtInt(SAVE.gold)}</span>
      <button class="small" data-a="refund">Refund all</button><button data-a="title">Back</button></div>
    <p class="sub">Permanent upgrades apply to every run except the Daily Night. Prices rise a little with each upgrade you own.</p>
    <div class="msg" id="smsg"></div>
    <div class="cards">${cards}</div>`, { back: "title", cls: "dark top", focusSel: focusId ? `.card[data-id="${focusId}"]` : null });
}

/* ---------- collection ---------- */
function showCodex(tab) {
  setState("menu");
  if (tab) UI.codexTab = tab; tab = UI.codexTab;
  const tabs = [["w", "Weapons"], ["p", "Items"], ["e", "Enemies"]].map(([k, n]) => `<button class="small ${tab === k ? "on" : ""}" data-a="tab" data-k="${k}">${n}</button>`).join("");
  let body = "";
  if (tab === "w") {
    for (const id of BASE_WEAPONS) {
      const d = WEAPONS[id], seen = SAVE.codex.w[id], ev = WEAPONS[d.evo], evSeen = SAVE.codex.x[d.evo];
      const unlocked = STARTER_WEAPONS.includes(id) || SAVE.weapons.includes(id) || CHARS.some((c) => c.weapon === id && SAVE.chars.includes(c.id));
      const lock = unlocked ? "" : (achFor("weapon", id) ? "Unlock: " + achFor("weapon", id).desc : "");
      body += `<div class="cx ${seen ? "" : "unk"}"><img src="${iconURL(id)}" alt=""><div><b>${seen || unlocked ? d.name : "???"}</b><span>${seen ? d.desc : lock || "Not found yet."}</span>
        <span class="rec">Evolves with ${PASSIVES[d.need].name}</span></div></div>`;
      body += `<div class="cx ${evSeen ? "" : "unk"}"><img src="${iconURL(d.evo)}" alt=""><div><b>${evSeen ? ev.name : "??? (evolution)"}</b><span>${evSeen ? ev.desc : `Max ${d.name} + ${PASSIVES[d.need].name}, then open a chest.`}</span></div></div>`;
    }
  } else if (tab === "p") {
    for (const id in PASSIVES) {
      const d = PASSIVES[id], seen = SAVE.codex.p[id], locked = d.locked && !SAVE.passives.includes(id);
      body += `<div class="cx ${seen ? "" : "unk"}"><img src="${iconURL(id)}" alt=""><div><b>${seen || !locked ? d.name : "???"}</b><span>${locked ? "Unlock: " + achFor("passive", id).desc : d.desc + " Up to level " + d.max + "."}</span></div></div>`;
    }
  } else {
    for (const id of CODEX_ENEMIES) {
      const d = ENEMIES[id], seen = SAVE.codex.e[id];
      body += `<div class="cx ${seen ? "" : "unk"}"><img src="${portrait(d.spr)}" alt=""><div><b>${seen ? d.name : "???"}</b><span>${seen ? LORE[id] : "Not met yet."}</span></div></div>`;
    }
  }
  const found = Object.keys(SAVE.codex.w).filter((k) => BASE_WEAPONS.includes(k)).length + Object.keys(SAVE.codex.x).length + Object.keys(SAVE.codex.p).length + Object.keys(SAVE.codex.e).filter((k) => CODEX_ENEMIES.includes(k)).length;
  const total = BASE_WEAPONS.length * 2 + Object.keys(PASSIVES).length + CODEX_ENEMIES.length;
  show(`<div class="bar"><h2>Collection</h2><span class="pill">${found} / ${total}</span><button data-a="title">Back</button></div>
    <div class="tabs">${tabs}</div><div class="codex">${body}</div>`, { back: "title", cls: "dark top", focusSel: ".tabs .on" });
}
function showAch() {
  setState("menu");
  const n = ACH.filter((a) => SAVE.ach[a.id]).length;
  const rows = ACH.filter((a) => !a.hidden || SAVE.ach[a.id]).map((a) => {
    const done = !!SAVE.ach[a.id], [t, v] = a.reward;
    const rw = t === "gold" ? fmtInt(v) + " gold" : t === "char" ? "Keeper: " + CHARS.find((c) => c.id === v).name : t === "stage" ? "Stage: " + STAGES[v].name
      : t === "weapon" ? "Weapon: " + WEAPONS[v].name : t === "passive" ? "Item: " + PASSIVES[v].name : t === "mode" ? (v === "blood" ? "Mode: Blood Moon" : "Mode: Endless Night") : "";
    return `<div class="li ${done ? "done" : ""}"><span class="ck">${done ? "✓" : "·"}</span><div class="tx"><b>${a.name}</b><span>${a.desc}</span></div><div class="rw">${rw}</div></div>`;
  }).join("");
  show(`<div class="bar"><h2>Achievements</h2><span class="pill">${n} / ${ACH.length}</span><button data-a="title" autofocus>Back</button></div><div class="list">${rows}</div>`, { back: "title", cls: "dark top" });
}

/* ---------- settings ---------- */
function showSettings(back) {
  if (back) UI.setBack = back;
  setState(UI.setBack === "pause" ? "psettings" : "menu");
  const s = SAVE.settings, onoff = (v) => (v ? "On" : "Off");
  const sc = show(`<div class="bar"><h2>Settings</h2><button data-a="${UI.setBack}">Back</button></div>
    <div class="panel" style="width:min(100%,34em);display:flex;flex-direction:column;align-items:center">
      <label class="opt"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-set="music" aria-label="Music volume"></label>
      <label class="opt"><span>Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-set="sfx" aria-label="Sound effects volume"></label>
      <div class="opt"><span>Screen shake</span><button class="small" data-a="tog" data-k="shake">${onoff(s.shake)}</button></div>
      <div class="opt"><span>Damage numbers</span><button class="small" data-a="tog" data-k="dmg">${onoff(s.dmg)}</button></div>
      <div class="opt"><span>Flashing effects</span><button class="small" data-a="tog" data-k="flash">${onoff(s.flash)}</button></div>
      <div class="opt"><span>Touch joystick</span><button class="small" data-a="touchmode">${{ auto: "Auto", on: "On", off: "Off" }[s.touch]}</button></div>
      <div class="opt"><span>Fullscreen</span><button class="small" data-a="fs">Toggle</button></div>
    </div>
    ${UI.setBack === "title" ? `<div class="row"><button data-a="savecode">Save code</button><button class="danger" data-a="reset">Reset progress</button></div>` : ""}
    <div class="msg" id="setmsg"></div>`, { back: UI.setBack, cls: "dark top" });
  for (const r of $$("input[type=range]", sc)) r.addEventListener("input", () => { SAVE.settings[r.dataset.set] = +r.value; applyVolumes(); save(); });
  for (const r of $$("input[type=range]", sc)) r.addEventListener("change", () => sfx("ok"));
}
function showSaveCode() {
  setState("menu");
  const code = exportSave();
  show(`<div class="bar"><h2>Save code</h2><button data-a="settings">Back</button></div>
    <p class="sub">Copy this code to back up your progress or move it to another browser. Paste a code below to load it.</p>
    <textarea id="codeOut" readonly aria-label="Your save code">${esc(code)}</textarea>
    <div class="row"><button class="primary" data-a="copysave" autofocus>Copy my code</button></div>
    <textarea id="codeIn" placeholder="Paste a LASTLANTERN-SAVE code here" aria-label="Paste a save code"></textarea>
    <div class="row"><button data-a="loadsave" id="loadBtn">Load code</button></div>
    <div class="msg" id="codemsg"></div>`, { back: "settings", cls: "dark top" });
}

/* ---------- level up ---------- */
function openLevelUp() {
  setState("levelup");
  UI.choices = genChoices(); UI.banish = false;
  sfx("level");
  renderLevelUp(true);
}
function evoHint(c) {
  if (c.kind === "w") { const d = WEAPONS[c.id]; if (d.evo) { const has = R.passives.some((q) => q.id === d.need); return `<span class="hint">${has ? "★ " : ""}Evolves with ${PASSIVES[d.need].name}</span>`; } }
  if (c.kind === "p") { const w = R.weapons.find((x) => WEAPONS[x.id].need === c.id); if (w) return `<span class="hint">★ Evolves your ${WEAPONS[w.id].name}</span>`; }
  return "";
}
function renderLevelUp(fresh) {
  const cards = UI.choices.map((c, i) => {
    const inf = choiceInfo(c);
    return `<button class="card" data-a="pick" data-i="${i}">
      <img class="ic" src="${iconURL(inf.icon)}" alt="">
      <span class="txt"><span class="nmrow"><span class="nm">${inf.name}</span>${inf.tag ? `<span class="tg ${inf.tag === "NEW" ? "new" : ""}">${inf.tag}</span>` : ""}</span>
      <span class="ds">${inf.desc}</span>${evoHint(c)}</span></button>`;
  }).join("");
  const lv = R.level - R.pending + 1;
  const s = show(`<div class="lvhead"><h2>Level ${lv}!</h2><p class="sub">${UI.banish ? "Choose one to banish for the rest of this run." : "Choose an upgrade" + (R.pending > 1 ? ` (${R.pending} to pick)` : "") + "."}</p></div>
    <div class="cards lv ${UI.banish ? "banishing" : ""}">${cards}</div>
    <div class="lvtools">
      <button class="small" data-a="reroll" ${R.rerolls > 0 ? "" : "disabled"}>Reroll · ${R.rerolls}</button>
      <button class="small" data-a="skip" ${R.skips > 0 ? "" : "disabled"}>Skip · ${R.skips}</button>
      <button class="small ${UI.banish ? "on" : ""}" data-a="banish" ${R.banishes > 0 ? "" : "disabled"}>${UI.banish ? "Cancel banish" : "Banish · " + R.banishes}</button>
    </div>`, { cls: "dim" + (fresh ? " wait" : "") });
  if (fresh) { UI.lvReady = performance.now() + 380; setTimeout(() => s.classList.remove("wait"), 380); }
}
function closeLevelUp() {
  if (R.pending > 0) { UI.choices = genChoices(); UI.banish = false; sfx("level"); renderLevelUp(true); return; }
  hideUI(); setState("play");
}

/* ---------- chest ---------- */
UI.chest = (tier) => {
  const data = rollChest(tier);
  UI.chestData = data; UI.chestDone = false;
  setState("chest");
  show(`<div class="chestbox"><div class="rays" id="rays"></div>
      <h2>${tier === 3 ? "Royal treasure" : tier === 2 ? "Boss treasure" : "Treasure"}</h2>
      <img class="chestimg shake" id="chestImg" src="${padURL(SPR.chest)}" alt="A treasure chest">
      <div class="loot" id="loot"></div><div class="msg" id="lootGold"></div>
      <div class="row"><button class="primary" data-a="chestgo" id="chestBtn" autofocus>Skip</button></div></div>`, { cls: "dim" });
  sfx("chest");
  const T = (ms, fn) => UI.chestTimers.push(setTimeout(fn, ms));
  T(780, () => openChestVisual());
  data.items.forEach((it, i) => T(1150 + i * 420, () => revealItem(it)));
  T(1150 + data.items.length * 420 + 150, () => finishChest());
};
function openChestVisual() { const im = $("#chestImg"); if (!im) return; im.classList.remove("shake"); im.src = padURL(SPR.chestOpen); $("#rays").classList.add("on"); flash("#fff2a8", 0.3); }
function revealItem(it) {
  const box = $("#loot"); if (!box) return;
  const el = document.createElement("div");
  let name = "", sub = "";
  if (it.kind === "evo") { name = WEAPONS[it.id].name; sub = "EVOLVED!"; sfx("evolve"); }
  else if (it.kind === "w") { name = WEAPONS[it.id].name; sub = "Level " + it.lv; sfx("reveal"); }
  else if (it.kind === "p") { name = PASSIVES[it.id].name; sub = "Level " + it.lv; sfx("reveal"); }
  else { name = "Gold"; sub = "+25"; sfx("coin"); }
  el.className = "lootit" + (it.kind === "evo" ? " evo" : "");
  el.innerHTML = `<img src="${iconURL(it.kind === "gold" ? "gold" : it.id)}" alt=""><b>${esc(name)}</b><span>${sub}</span>`;
  box.appendChild(el);
}
function finishChest() {
  if (UI.chestDone) return;
  UI.chestDone = true;
  for (const t of UI.chestTimers) clearTimeout(t); UI.chestTimers = [];
  const im = $("#chestImg"); if (!im) return;
  if (!$("#rays").classList.contains("on")) openChestVisual();
  const box = $("#loot"); if (box && box.children.length < UI.chestData.items.length) { box.innerHTML = ""; UI.chestData.items.forEach(revealItem); }
  const g = $("#lootGold"); if (g) { g.textContent = "+" + fmtInt(UI.chestData.gold) + " gold"; g.className = "msg gold"; }
  sfx("coin");
  const b = $("#chestBtn"); if (b) { b.textContent = "Continue"; b.dataset.a = "chestclose"; if (IN.device !== "touch") b.focus(); }
  UI.slotSig = "";
}

/* ---------- pause ---------- */
function pauseGame() { if (UI.state === "play" && R && !R.demo && !R.ended) showPause(); }
function showPause() {
  setState("pause");
  const S = R.S, pct = (v) => (v >= 0 ? "+" : "") + Math.round(v * 100) + "%";
  const build = [...R.weapons.map((w) => slotHTML(w.id, w.lv, WEAPONS[w.id])), ...R.passives.map((q) => slotHTML(q.id, q.lv, PASSIVES[q.id]))].join("");
  show(`<h2>Paused</h2>
    <div class="panel" style="display:flex;flex-direction:column;align-items:center;gap:.9em;width:min(100%,38em)">
    <div class="muted" style="font-size:.9em">${esc(R.stage.name)} · ${esc(R.ch.name)} · ${fmtTime(R.t)}${R.opts.blood ? " · Blood Moon" : ""}${R.opts.daily ? " · Daily" : ""}</div>
    <div class="build">${build}</div>
    <div class="kv">
      <span><i>Health</i>${Math.ceil(R.p.hp)} / ${S.maxHp}</span><span><i>Armor</i>${S.armor}</span>
      <span><i>Damage</i>${pct(S.might - 1)}</span><span><i>Area</i>${pct(S.area - 1)}</span>
      <span><i>Fire rate</i>${pct(1 / S.cd - 1)}</span><span><i>Projectiles</i>+${S.amt}</span>
      <span><i>Move speed</i>${pct(S.move / 64 - 1)}</span><span><i>Recovery</i>${S.regen.toFixed(1)}/s</span>
      <span><i>Pickup range</i>${pct(S.magnet / 30 - 1)}</span><span><i>Luck</i>${pct(S.luck - 1)}</span>
      <span><i>Experience</i>${pct(S.growth - 1)}</span><span><i>Gold</i>${pct(S.greed - 1)}</span>
    </div></div>
    <div class="row"><button class="primary" data-a="resume" autofocus>Resume</button><button data-a="settings" data-from="pause">Settings</button><button class="danger" data-a="quit">Quit run</button></div>
    <div class="msg" id="pmsg"></div>`, { back: "resume", cls: "dark" });
}
function slotHTML(id, lv, d) {
  const max = lv >= d.max, evo = d.evolved;
  return `<div class="slot ${max ? "max" : ""} ${evo ? "evo" : ""}" title="${esc(d.name)}"><img src="${iconURL(id)}" alt="${esc(d.name)}"><b>${evo ? "★" : max ? "M" : lv}</b></div>`;
}

/* ---------- results ---------- */
UI.runOver = (won) => { setState("ending"); hud.hidden = false; UI.endWait = R.quit ? 0 : won ? 0.6 : 2.4; };
function showResults() {
  setState("results");
  const r = R, won = r.won, tot = Object.values(r.dmg).reduce((a, b) => a + b, 0) || 1;
  const rows = r.weapons.map((w) => {
    const d = WEAPONS[w.id], dm = (r.dmg[w.id] || 0) + (d.from ? r.dmg[d.from] || 0 : 0);
    return `<tr><td><img src="${iconURL(w.id)}" alt="">${d.name}</td><td>${d.evolved ? "★" : "Lv " + w.lv}</td><td>${fmtInt(dm)}</td><td>${Math.round((dm / tot) * 100)}%</td></tr>`;
  }).join("");
  const unl = (r.newAch || []).map((x) => `<div class="unl"><b>${esc(x.a.name)}</b>${esc(x.note)}</div>`).join("");
  const title = won ? "Dawn breaks" : r.quit ? "You walked away" : "The lantern goes out";
  const sub = won ? `You survived the night in ${r.stage.name}.` : r.opts.endless ? `The endless night took you after ${fmtTime(r.t)}.` : `You lasted ${fmtTime(r.t)} in ${r.stage.name}.`;
  const newBest = !r.opts.daily && !won && r.prevBest > 0 && Math.floor(r.t) > r.prevBest;
  show(`<div class="bigt ${won ? "" : "dead"}">${title}</div><p class="sub">${sub}${newBest ? ` <b class="gold">New best!</b>` : ""}</p>
    <div class="stats">
      <div class="stat"><small>Time</small><b>${fmtTime(r.t)}</b></div>
      <div class="stat"><small>Level</small><b>${r.level}</b></div>
      <div class="stat"><small>Defeated</small><b>${fmtInt(r.kills)}</b></div>
      <div class="stat"><small>Gold</small><b class="gold">+${fmtInt(r.gold)}</b></div>
    </div>
    <table class="dmg"><tr><th>Weapon</th><th></th><th>Damage</th><th>Share</th></tr>${rows}</table>
    ${unl ? `<div class="unlocks">${unl}</div>` : ""}
    <div class="row">
      <button class="primary" data-a="again" autofocus>${r.opts.daily ? "Retry daily" : "Play again"}</button>
      ${r.opts.daily ? `<button data-a="copydaily">Copy result</button>` : `<button data-a="chars">Change keeper</button>`}
      <button data-a="title">Title</button>
    </div><div class="msg" id="dmsg"></div>`, { back: "title", cls: "dark" });
  musicPlay(won ? "dawn" : "over", won ? 3 : 1);
}

/* ---------- actions ---------- */
function act(a, d = {}, el) {
  switch (a) {
    case "title": sfx("back"); return showTitle();
    case "play": sfx("ok"); return showChars();
    case "howto": sfx("ok"); return showHowTo();
    case "chars": sfx("back"); return showChars();
    case "char": {
      if (!SAVE.chars.includes(d.id)) { sfx("deny"); return; }
      UI.sel.char = d.id; sfx("ok"); return showStages();
    }
    case "mode": UI.sel[d.k] = !UI.sel[d.k]; sfx("ok"); showStages(); { const f = $(`[data-k="${d.k}"]`, ui); if (f && IN.device !== "touch") f.focus(); } return;
    case "stage": {
      if (!SAVE.stages.includes(d.id)) { sfx("deny"); return; }
      UI.sel.stage = d.id;
      return startGame({ char: UI.sel.char, stage: d.id, blood: UI.sel.blood && SAVE.modes.includes("blood"), endless: UI.sel.endless && SAVE.modes.includes("endless") });
    }
    case "daily": sfx("ok"); return showDaily();
    case "startdaily": { const dc = dailyConfig(); return startGame({ daily: true, date: dc.date, seed: dc.seed, stage: dc.stage, char: dc.char, mod: dc.mod }); }
    case "copydaily": return copyText(dailyText(), $("#dmsg"));
    case "shop": sfx("ok"); return showShop();
    case "buy": {
      const it = SHOP.find((x) => x.id === d.id), r = SAVE.shop[it.id] | 0;
      if (r >= it.max) { sfx("deny"); return; }
      const cost = shopCost(it);
      if (SAVE.gold < cost) { sfx("deny"); const m = $("#smsg"); if (m) { m.textContent = `You need ${fmtInt(cost - SAVE.gold)} more gold.`; m.className = "msg err"; } return; }
      SAVE.gold -= cost; SAVE.spent += cost; SAVE.shop[it.id] = r + 1; save(); sfx("buy");
      return showShop(it.id);
    }
    case "refund": if (el) { el.textContent = "Refund everything?"; el.dataset.a = "refund2"; el.classList.add("danger"); } sfx("back"); return;
    case "refund2": SAVE.gold += SAVE.spent; SAVE.spent = 0; SAVE.shop = {}; save(); sfx("coin"); return showShop();
    case "codex": sfx("ok"); return showCodex();
    case "tab": sfx("move"); return showCodex(d.k);
    case "ach": sfx("ok"); return showAch();
    case "settings": sfx("ok"); return showSettings(d.from === "pause" ? "pause" : UI.state === "psettings" ? "pause" : "title");
    case "tog": SAVE.settings[d.k] = !SAVE.settings[d.k]; save(); sfx("ok"); if (el) el.textContent = SAVE.settings[d.k] ? "On" : "Off"; return;
    case "touchmode": { const o = ["auto", "on", "off"], s = SAVE.settings; s.touch = o[(o.indexOf(s.touch) + 1) % 3]; save(); sfx("ok"); if (el) el.textContent = { auto: "Auto", on: "On", off: "Off" }[s.touch]; return; }
    case "fs": { sfx("ok"); const de = document.documentElement; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (de.requestFullscreen) de.requestFullscreen().catch(() => {}); return; }
    case "savecode": sfx("ok"); return showSaveCode();
    case "copysave": return copyText($("#codeOut").value, $("#codemsg"));
    case "loadsave": {
      const m = $("#codemsg");
      try {
        const data = importSave($("#codeIn").value);
        if (el && el.dataset.armed !== "1") { el.dataset.armed = "1"; el.textContent = "Replace my progress?"; el.classList.add("danger"); m.textContent = `That code has ${fmtInt(data.gold)} gold and ${Object.keys(data.ach).length} achievements.`; m.className = "msg"; return; }
        SAVE = data; save(); applyVolumes(); sfx("buy"); m.textContent = "Loaded."; m.className = "msg";
        setTimeout(showTitle, 500);
      } catch (err) { m.textContent = err.message; m.className = "msg err"; sfx("deny"); }
      return;
    }
    case "reset": if (el) { el.textContent = "Erase all progress?"; el.dataset.a = "reset2"; } sfx("back"); return;
    case "reset2": { const keep = SAVE.settings; SAVE = defaultSave(); SAVE.settings = keep; save(); sfx("back"); UI.sel = { char: "wren", stage: "wood", blood: false, endless: false }; return showTitle(); }
    case "pause": return showPause();
    case "resume": hideUI(); setState("play"); sfx("ok"); return;
    case "quit": if (el) { el.textContent = "Quit? Gold is kept"; el.dataset.a = "quit2"; } sfx("back"); return;
    case "quit2": R.quit = true; hideUI(); endRun(false); return;
    case "pick": {
      if (UI.state !== "levelup" || performance.now() < UI.lvReady) return;
      const c = UI.choices[+d.i]; if (!c) return;
      if (UI.banish) {
        if (c.kind === "gold" || c.kind === "heal") { sfx("deny"); return; }
        R.banished.add(c.id); R.banishes--; UI.banish = false; UI.choices = genChoices(); sfx("back"); return renderLevelUp(true);
      }
      applyChoice(c); UI.slotSig = ""; return closeLevelUp();
    }
    case "reroll": if (UI.state === "levelup" && R.rerolls > 0) { R.rerolls--; UI.banish = false; UI.choices = genChoices(); sfx("move"); renderLevelUp(true); } return;
    case "skip": if (UI.state === "levelup" && R.skips > 0 && performance.now() >= UI.lvReady) { R.skips--; R.pending = Math.max(0, R.pending - 1); sfx("back"); closeLevelUp(); } return;
    case "banish": if (UI.state === "levelup" && R.banishes > 0) { UI.banish = !UI.banish; sfx("move"); renderLevelUp(false); const f = $(".card", ui); if (f && IN.device !== "touch") f.focus(); } return;
    case "chestgo": return finishChest();
    case "chestclose": hideUI(); setState("play"); return;
    case "again": return startGame(UI.lastOpts);
  }
}
ui.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]");
  if (!b || b.disabled) return;
  act(b.dataset.a, b.dataset, b);
});
$("#pauseBtn").addEventListener("click", () => pauseGame());
function goBack() {
  if (UI.state === "levelup") { if (UI.banish) act("banish"); return; }
  if (UI.state === "chest") { act(UI.chestDone ? "chestclose" : "chestgo"); return; }
  if (UI.back) act(UI.back);
}
function confirmFocused() {
  const el = document.activeElement;
  if (el && ui.contains(el) && (el.tagName === "BUTTON")) { el.click(); return; }
  const f = navList(ui)[0]; if (f) f.focus();
}

/* ---------- keyboard ---------- */
const MOVE_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD", "Space"]);
addEventListener("keydown", (e) => {
  audio(); IN.device = "kb"; document.body.classList.remove("touch");
  const tg = e.target, typing = tg && (tg.tagName === "TEXTAREA" || (tg.tagName === "INPUT" && tg.type !== "range"));
  if (typing) { if (e.code === "Escape") tg.blur(); return; }
  IN.keys.add(e.code);
  const st = UI.state;
  if (st === "play") {
    if (e.code === "Escape" || e.code === "KeyP") { pauseGame(); e.preventDefault(); }
    else if (MOVE_KEYS.has(e.code)) e.preventDefault();
    return;
  }
  if (st === "ending" || st === "boot") return;
  if (st === "levelup" && !e.repeat) {
    const n = +e.key;
    if (n >= 1 && n <= (UI.choices || []).length) { act("pick", { i: n - 1 }); e.preventDefault(); return; }
    if (e.code === "KeyR") { act("reroll"); return; }
    if (e.code === "KeyX") { act("skip"); return; }
    if (e.code === "KeyB") { act("banish"); return; }
  }
  const root = ui.firstElementChild;
  const arrows = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  const wasd = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
  const dir = arrows[e.code] || (!e.repeat && wasd[e.code]);
  if (dir && root) { if (navMove(root, dir[0], dir[1])) sfx("move"); e.preventDefault(); return; }
  if (e.code === "Escape" || (e.code === "KeyP" && st === "pause")) { goBack(); e.preventDefault(); return; }
  if ((e.code === "Enter" || e.code === "Space") && root) {
    const el = document.activeElement;
    if (!el || !ui.contains(el)) { confirmFocused(); e.preventDefault(); }
  }
});
addEventListener("keyup", (e) => IN.keys.delete(e.code));
addEventListener("blur", () => { IN.keys.clear(); pauseGame(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { pauseGame(); if (AU.ctx && AU.ctx.state === "running") AU.ctx.suspend().catch(() => {}); }
  else audio();
});

/* ---------- touch / pointer joystick ---------- */
let joyId = null, joyX = 0, joyY = 0;
const touchAllowed = () => SAVE.settings.touch !== "off";
addEventListener("pointerdown", (e) => {
  audio();
  if (e.pointerType === "touch") { IN.device = "touch"; IN.usedTouch = true; document.body.classList.add("touch"); }
  else if (e.pointerType === "mouse") IN.device = "mouse";
  if (UI.state !== "play" || joyId !== null) return;
  if (e.target.closest("button, #ui .screen")) return;
  if (e.pointerType === "touch" && !touchAllowed()) return;
  joyId = e.pointerId; joyX = e.clientX; joyY = e.clientY;
  joy.style.left = joyX + "px"; joy.style.top = joyY + "px"; joyKnob.style.transform = ""; joy.hidden = false;
  try { cv.setPointerCapture(e.pointerId); } catch {}
  e.preventDefault();
}, true);
addEventListener("pointermove", (e) => {
  if (e.pointerId !== joyId) return;
  const R0 = joy.offsetWidth / 2 || 60, dx = e.clientX - joyX, dy = e.clientY - joyY, l = Math.hypot(dx, dy);
  if (l > R0) { joyX += (dx / l) * (l - R0); joyY += (dy / l) * (l - R0); joy.style.left = joyX + "px"; joy.style.top = joyY + "px"; }
  const k = Math.min(1, l / R0);
  IN.touch[0] = l > R0 * 0.12 ? (dx / (l || 1)) * k : 0; IN.touch[1] = l > R0 * 0.12 ? (dy / (l || 1)) * k : 0;
  const kx = (dx / (l || 1)) * Math.min(l, R0), ky = (dy / (l || 1)) * Math.min(l, R0);
  joyKnob.style.transform = `translate(${kx}px, ${ky}px)`;
}, true);
function endJoy(e) {
  if (e && e.pointerId !== joyId) return;
  joyId = null; IN.touch[0] = IN.touch[1] = 0; joy.hidden = true;
}
addEventListener("pointerup", endJoy, true);
addEventListener("pointercancel", endJoy, true);

/* ---------- gamepad ---------- */
function pollPad(dt) {
  const s = readPad();
  if (!s) { IN.pad[0] = IN.pad[1] = 0; UI.padPrev = {}; return; }
  const prev = UI.padPrev, edge = (k) => s[k] && !prev[k];
  if (s.ax || s.ay || s.a || s.b || s.x || s.y || s.start || s.back) { if (IN.device !== "pad") { IN.device = "pad"; document.body.classList.remove("touch"); } }
  if (UI.state === "play") {
    IN.pad[0] = s.ax; IN.pad[1] = s.ay;
    if (edge("start") || edge("back")) pauseGame();
  } else {
    IN.pad[0] = IN.pad[1] = 0;
    const vy = s.up ? -1 : s.down ? 1 : 0, vx = vy ? 0 : s.left ? -1 : s.right ? 1 : 0, nd = vy * 3 + vx, root = ui.firstElementChild;
    if (nd !== UI.navDir) { UI.navDir = nd; UI.navRepeat = 0.38; if (nd && root && navMove(root, vx, vy)) sfx("move"); }
    else if (nd) { UI.navRepeat -= dt; if (UI.navRepeat <= 0) { UI.navRepeat = 0.11; if (root && navMove(root, vx, vy)) sfx("move"); } }
    if (UI.state === "levelup") {
      if (edge("x")) act("reroll"); else if (edge("y")) act("skip"); else if (edge("lb") || edge("rb")) act("banish");
    }
    if (edge("a")) confirmFocused();
    else if (edge("b")) goBack();
    else if (edge("start") && UI.state === "pause") act("resume");
  }
  UI.padPrev = s;
}

/* ---------- HUD ---------- */
const H = { xp: $("#xpfill"), lvl: $("#lvl"), time: $("#time"), kills: $("#kills"), gold: $("#goldc"), boss: $("#bossbar"), bossName: $("#bossname"), bossFill: $("#bossfill"), slots: $("#slots"), last: {} };
function setText(el, key, v) { if (H.last[key] !== v) { H.last[key] = v; if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.nodeValue = v + " "; else el.textContent = v; } }
function updateHud(dt) {
  if (UI.bannerT > 0) { UI.bannerT -= dt; if (UI.bannerT <= 0) $("#banner").classList.remove("on"); }
  if (hud.hidden || !R || R.demo) return;
  H.xp.style.width = Math.min(100, (R.xp / R.xpNext) * 100).toFixed(1) + "%";
  setText(H.lvl, "lvl", "LV " + R.level);
  const tt = fmtTime(R.t); if (H.last.time !== tt) { H.last.time = tt; H.time.textContent = tt; H.time.classList.toggle("late", !R.opts.endless && R.t >= 840); }
  setText(H.kills, "kills", fmtInt(R.kills));
  setText(H.gold, "gold", fmtInt(R.gold));
  const b = R.boss && !R.boss.dead ? R.boss : null;
  H.boss.hidden = !b;
  if (b) { if (H.last.bn !== b.name) { H.last.bn = b.name; H.bossName.textContent = b.name; } H.bossFill.style.width = Math.max(0, (b.hp / b.maxHp) * 100).toFixed(1) + "%"; }
  const sig = R.weapons.map((w) => w.id + w.lv).join() + "|" + R.passives.map((q) => q.id + q.lv).join();
  if (sig !== UI.slotSig) {
    UI.slotSig = sig;
    const ws = R.weapons.map((w) => slotHTML(w.id, w.lv, WEAPONS[w.id])), ps = R.passives.map((q) => slotHTML(q.id, q.lv, PASSIVES[q.id]));
    while (ws.length < 6) ws.push(`<div class="slot"></div>`); while (ps.length < 6) ps.push(`<div class="slot"></div>`);
    H.slots.innerHTML = ws.join("") + ps.join("");
  }
}

/* ---------- main loop ---------- */
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
  pollPad(dt);
  if (R) {
    const live = () => UI.state === "play" || UI.state === "ending" || (R.demo && UI.state === "menu");
    let t = dt;
    while (t > 1e-6 && R && live()) { const s = Math.min(t, 1 / 60); update(s); t -= s; }
    if (UI.state === "play" && !R.demo) {
      if (R.pending > 0 && !R.ended && !R.dawned) openLevelUp();
      if (MUS.id === R.stage.song) musicLevel(R.t < 60 ? 1 : R.t < 180 ? 2 : 3);
    }
    if (UI.state === "ending") { UI.endWait -= dt; if (UI.endWait <= 0) showResults(); }
    render();
  }
  updateHud(dt);
  requestAnimationFrame(frame);
}
showTitle();
requestAnimationFrame(frame);
