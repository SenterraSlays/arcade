"use strict";
/* SPELLSPIRE — a roguelike deckbuilder. Climb three acts of a branching spire, build a deck of spells,
   collect relics and potions, and outwit enemies whose intentions you can see. Content lives in data.js. */
const { $, $$, clamp, TAU } = K;
const SAVE = K.load("spellspire.v1", { run: null, fast: false, stats: { runs: 0, wins: 0, bestFloor: 0, bestAct: 0, kills: 0 } });
const persist = () => K.save("spellspire.v1", SAVE);
const clone = (o) => JSON.parse(JSON.stringify(o));
let SPD = 1; /* animation time scale (the test harness sets 0) */
const tm = (ms) => ms * SPD * (SAVE.fast ? 0.55 : 1);
const sleep = (ms) => (SPD ? new Promise((r) => setTimeout(r, tm(ms))) : Promise.resolve());
const later = (fn, ms) => (SPD ? setTimeout(fn, tm(ms)) : queueMicrotask(fn));
let RUN = null, B = null, SCREEN = null, PILERET = null, CARDDONE = null, PICK = null, MAPSEL = 0;
const ACTS = ["The Lower Halls", "The Overgrown Galleries", "The Starlit Crown"];
const BOSSSUB = ["Keeper of the Lower Halls", "Terror of the Galleries", "The beating heart of the Spire"];
const STATN = { burn: "Burn", frost: "Frost", expose: "Expose", might: "Might", thorns: "Thorns", tthorns: "Thorns", runic: "Runic Ward", inferno: "Inferno", trance: "Battle Trance", echo: "Echo", phoenix: "Phoenix Form", flamewall: "Ward of Flames" };
const STATI = { burn: "🔥", frost: "❄", expose: "◎", might: "⚔", thorns: "✷", tthorns: "✷", runic: "▣", inferno: "♨", trance: "◈", echo: "⟳", phoenix: "🪽", flamewall: "♨" };
const STATC = { burn: "#ff9a4a", frost: "#8ad8ff", expose: "#ff7aa8", might: "#ffd479", thorns: "#c8e870", tthorns: "#c8e870", runic: "#8ab8ff", inferno: "#ff7a4a", trance: "#ffb347", echo: "#c39bff", phoenix: "#ff9a4a", flamewall: "#ff9a4a" };
const STATD = { burn: KW.Burn, frost: KW.Frost, expose: KW.Expose, might: KW.Might, thorns: KW.Thorns, tthorns: "Deals this much damage back to attackers until your next turn.", runic: "Gain this much Block at the end of each turn.", inferno: "Apply this much Burn to ALL enemies at the start of your turn.", trance: "Gain this much extra energy every turn.", echo: "Your next card this turn is played twice.", phoenix: "At the end of your turn, deal 6 damage to ALL enemies and heal 2, per stack.", flamewall: "Enemies that attack you this turn get this much Burn." };
const PCOL = { fire: "#ff8a3a", ice: "#8ad8ff", bolt: "#c39bff", sword: "#ffd479", skull: "#9aff8a", star: "#ffe27a" };
const EVICON = { "The Whispering Fountain": ["orb", "#7ad8ff"], "Abandoned Library": ["book", "#c39bff"], "Cursed Altar": ["skull", "#ff6b8a"], "Mirror of Echoes": ["eye", "#9ad0ff"], "Wandering Merchant": ["hand", "#ffd479"], "Ember Shrine": ["fire", "#ff9a4a"], "Forgotten Campfire": ["fire", "#ffb347"], "Gambler's Den": ["star", "#ffd479"] };
const NODE = { fight: ["⚔", "#8a6a5a", "Enemy", "a fight that pays out gold and a card"], elite: ["☠", "#c43a4a", "Elite", "a dangerous foe that guards a relic"], event: ["?", "#4a8ac4", "Unknown", "something strange is waiting"], shop: ["$", "#d9a82a", "Merchant", "buy cards, relics and potions, or remove a card"], rest: ["🔥", "#e2782a", "Rest site", "heal or upgrade a card"], treasure: ["◆", "#3aa86a", "Treasure", "a free relic"], boss: ["♛", "#9a3ac4", "Boss", "the guardian of this act"] };
const kbish = () => K.device === "kb" || K.device === "pad";
const has = (r) => !!RUN && RUN.relics.includes(r);

/* ================= art ================= */
function drawIcon(g, icon, w, h, col = "#fff") {
  g.save(); g.translate(w / 2, h / 2); const s = Math.min(w, h) * 0.36;
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.14; g.lineCap = "round"; g.lineJoin = "round";
  const P = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s))); g.closePath(); g.fill(); };
  switch (icon) {
    case "bolt": P([[0.15, -1], [-0.55, 0.15], [-0.05, 0.15], [-0.25, 1], [0.55, -0.2], [0.05, -0.2]]); break;
    case "fire": g.scale(s, s); g.beginPath(); g.moveTo(0, -1); g.bezierCurveTo(0.7, -0.3, 0.8, 0.4, 0.45, 0.8); g.quadraticCurveTo(0, 1.05, -0.45, 0.8); g.bezierCurveTo(-0.8, 0.4, -0.5, -0.1, -0.2, -0.3); g.quadraticCurveTo(-0.1, 0.1, 0.05, 0.15); g.quadraticCurveTo(0.2, -0.4, 0, -1); g.fill(); break;
    case "ice": for (let k = 0; k < 3; k++) { g.save(); g.rotate((k * Math.PI) / 3); g.beginPath(); g.moveTo(0, -s); g.lineTo(0, s); g.moveTo(-s * 0.3, -s * 0.65); g.lineTo(0, -s * 0.4); g.lineTo(s * 0.3, -s * 0.65); g.moveTo(-s * 0.3, s * 0.65); g.lineTo(0, s * 0.4); g.lineTo(s * 0.3, s * 0.65); g.stroke(); g.restore(); } break;
    case "shield": P([[0, -1], [0.8, -0.65], [0.7, 0.3], [0, 1], [-0.7, 0.3], [-0.8, -0.65]]); break;
    case "sword": g.beginPath(); g.moveTo(-0.7 * s, 0.7 * s); g.lineTo(0.75 * s, -0.75 * s); g.stroke(); g.beginPath(); g.moveTo(-0.6 * s, 0.25 * s); g.lineTo(-0.25 * s, 0.6 * s); g.stroke(); break;
    case "eye": g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(0, -0.9 * s, s, 0); g.quadraticCurveTo(0, 0.9 * s, -s, 0); g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.32, 0, TAU); g.fill(); break;
    case "star": g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? s * 0.42 : s; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); break;
    case "swirl": g.beginPath(); for (let k = 0; k < 60; k++) { const a = k * 0.2, r = s * (k / 60); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); break;
    case "book": g.fillRect(-0.8 * s, -0.6 * s, 0.75 * s, 1.2 * s); g.fillRect(0.05 * s, -0.6 * s, 0.75 * s, 1.2 * s); break;
    case "orb": g.beginPath(); g.arc(0, 0, s * 0.75, 0, TAU); g.fill(); g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.arc(s * 0.15, s * 0.15, s * 0.5, 0, TAU); g.fill(); break;
    case "hand": P([[-0.5, 1], [-0.5, -0.2], [-0.7, -0.5], [-0.45, -0.6], [-0.3, -0.3], [-0.3, -1], [0, -1], [0, -0.3], [0.05, -1.05], [0.3, -1.05], [0.3, -0.3], [0.4, -0.9], [0.65, -0.85], [0.6, 0.4], [0.4, 1]]); break;
    case "skull": g.beginPath(); g.arc(0, -0.15 * s, s * 0.75, Math.PI * 0.9, Math.PI * 0.1); g.lineTo(0.45 * s, 0.85 * s); g.lineTo(-0.45 * s, 0.85 * s); g.closePath(); g.fill(); g.fillStyle = "rgba(0,0,0,0.55)"; g.beginPath(); g.arc(-0.3 * s, -0.1 * s, s * 0.2, 0, TAU); g.arc(0.3 * s, -0.1 * s, s * 0.2, 0, TAU); g.fill(); break;
    case "heart": g.beginPath(); g.moveTo(0, s * 0.85); g.bezierCurveTo(-s * 1.2, -s * 0.1, -s * 0.5, -s * 1.1, 0, -s * 0.35); g.bezierCurveTo(s * 0.5, -s * 1.1, s * 1.2, -s * 0.1, 0, s * 0.85); g.fill(); break;
  }
  g.restore();
}
function drawMonster(g, w, h, art) {
  const [kind, a, b, acc] = art, cx = w / 2, cy = h * 0.6, s = w * 0.32;
  g.clearRect(0, 0, w, h); g.save(); g.lineJoin = "round";
  g.fillStyle = "rgba(0,0,0,0.32)"; g.beginPath(); g.ellipse(cx, h * 0.93, s * 0.95, s * 0.16, 0, 0, TAU); g.fill();
  const eyes = (y, sp = 0.32, r = 0.13) => { for (const d of [-1, 1]) { g.fillStyle = "#fff"; g.beginPath(); g.arc(cx + d * s * sp, y, s * r, 0, TAU); g.fill(); g.fillStyle = "#1a0f20"; g.beginPath(); g.arc(cx + d * s * sp, y + s * 0.02, s * r * 0.5, 0, TAU); g.fill(); } };
  const glowEyes = (y, sp = 0.28, col = "#ffe27a") => { for (const d of [-1, 1]) { g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 10; g.beginPath(); g.ellipse(cx + d * s * sp, y, s * 0.1, s * 0.06, d * 0.3, 0, TAU); g.fill(); } g.shadowBlur = 0; };
  const grad = (y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  if (kind === "blob") { g.fillStyle = grad(cy - s, cy + s); g.beginPath(); g.moveTo(cx - s, cy + s * 0.8); g.bezierCurveTo(cx - s * 1.1, cy - s * 0.4, cx - s * 0.5, cy - s * 1.05, cx, cy - s); g.bezierCurveTo(cx + s * 0.5, cy - s * 1.05, cx + s * 1.1, cy - s * 0.4, cx + s, cy + s * 0.8); g.closePath(); g.fill(); g.fillStyle = "rgba(255,255,255,0.25)"; g.beginPath(); g.ellipse(cx - s * 0.4, cy - s * 0.5, s * 0.2, s * 0.12, -0.6, 0, TAU); g.fill(); eyes(cy - s * 0.15); g.strokeStyle = "#1a0f20"; g.lineWidth = s * 0.06; g.beginPath(); g.arc(cx, cy + s * 0.15, s * 0.22, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  else if (kind === "wing") { g.fillStyle = b; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * s * 0.3, cy - s * 0.2); g.quadraticCurveTo(cx + d * s * 1.4, cy - s * 1.0, cx + d * s * 1.35, cy + s * 0.1); g.lineTo(cx + d * s * 1.0, cy - s * 0.05); g.lineTo(cx + d * s * 0.9, cy + s * 0.25); g.lineTo(cx + d * s * 0.6, cy + s * 0.05); g.closePath(); g.fill(); } g.fillStyle = grad(cy - s * 0.7, cy + s * 0.6); g.beginPath(); g.ellipse(cx, cy, s * 0.5, s * 0.62, 0, 0, TAU); g.fill(); for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * s * 0.15, cy - s * 0.5); g.lineTo(cx + d * s * (acc === "horns" ? 0.55 : 0.45), cy - s * (acc === "horns" ? 1.15 : 0.95)); g.lineTo(cx + d * s * 0.42, cy - s * 0.4); g.fill(); } glowEyes(cy - s * 0.2, 0.2, acc === "horns" ? "#ff6a4a" : "#ffe27a"); }
  else if (kind === "humanoid") {
    g.fillStyle = grad(cy - s * 0.4, cy + s); g.beginPath(); g.moveTo(cx - s * 0.75, cy + s * 0.95); g.lineTo(cx - s * 0.45, cy - s * 0.3); g.lineTo(cx + s * 0.45, cy - s * 0.3); g.lineTo(cx + s * 0.75, cy + s * 0.95); g.closePath(); g.fill();
    g.fillStyle = acc === "skull" ? "#efe8d6" : a; g.beginPath(); g.arc(cx, cy - s * 0.62, s * 0.36, 0, TAU); g.fill();
    if (acc === "hood") { g.fillStyle = b; g.beginPath(); g.arc(cx, cy - s * 0.66, s * 0.48, Math.PI, 0); g.lineTo(cx + s * 0.5, cy - s * 0.3); g.lineTo(cx - s * 0.5, cy - s * 0.3); g.closePath(); g.fill(); g.fillStyle = "#0d0710"; g.beginPath(); g.arc(cx, cy - s * 0.58, s * 0.3, 0, TAU); g.fill(); glowEyes(cy - s * 0.6, 0.13); }
    else if (acc === "hat") { g.fillStyle = b; g.beginPath(); g.moveTo(cx - s * 0.62, cy - s * 0.82); g.lineTo(cx + s * 0.62, cy - s * 0.82); g.lineTo(cx + s * 0.1, cy - s * 1.65); g.closePath(); g.fill(); eyes(cy - s * 0.6, 0.15, 0.08); }
    else if (acc === "helm") { g.fillStyle = "#c9cde0"; g.beginPath(); g.arc(cx, cy - s * 0.65, s * 0.42, Math.PI, 0); g.lineTo(cx + s * 0.42, cy - s * 0.35); g.lineTo(cx - s * 0.42, cy - s * 0.35); g.closePath(); g.fill(); g.fillStyle = "#1a0f20"; g.fillRect(cx - s * 0.3, cy - s * 0.66, s * 0.6, s * 0.08); glowEyes(cy - s * 0.62, 0.15, "#7ad7ff"); }
    else if (acc === "skull") { g.fillStyle = "#1a0f20"; for (const d of [-1, 1]) { g.beginPath(); g.arc(cx + d * s * 0.14, cy - s * 0.66, s * 0.1, 0, TAU); g.fill(); } g.fillRect(cx - s * 0.12, cy - s * 0.42, s * 0.24, s * 0.05); }
    else if (acc === "mask") { g.fillStyle = "#e8d8a0"; g.beginPath(); g.ellipse(cx, cy - s * 0.62, s * 0.3, s * 0.4, 0, 0, TAU); g.fill(); glowEyes(cy - s * 0.7, 0.13, "#ff7a4a"); }
    else eyes(cy - s * 0.62, 0.15, 0.08);
  }
  else if (kind === "plant") { g.fillStyle = b; for (let k = 0; k < 6; k++) { g.save(); g.translate(cx, cy + s * 0.3); g.rotate(-1.2 + k * 0.48); g.beginPath(); g.ellipse(0, -s * 0.7, s * 0.2, s * 0.6, 0, 0, TAU); g.fill(); g.restore(); } g.fillStyle = grad(cy - s * 0.5, cy + s * 0.6); g.beginPath(); g.arc(cx, cy + s * 0.1, s * 0.55, 0, TAU); g.fill(); eyes(cy, 0.22, 0.11); }
  else if (kind === "imp") { g.fillStyle = grad(cy - s * 0.6, cy + s * 0.7); g.beginPath(); g.ellipse(cx, cy + s * 0.15, s * 0.5, s * 0.6, 0, 0, TAU); g.fill(); g.fillStyle = b; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * s * 0.2, cy - s * 0.35); g.lineTo(cx + d * s * 0.5, cy - s * 0.95); g.lineTo(cx + d * s * 0.42, cy - s * 0.3); g.fill(); } g.strokeStyle = b; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(cx + s * 0.4, cy + s * 0.5); g.quadraticCurveTo(cx + s * 1.0, cy + s * 0.6, cx + s * 0.9, cy); g.stroke(); glowEyes(cy - s * 0.05, 0.2, "#ffe27a"); }
  else if (kind === "golem") {
    g.fillStyle = grad(cy - s, cy + s); K.roundRect(g, cx - s * 0.8, cy - s * 0.55, s * 1.6, s * 1.45, s * 0.15); g.fill(); K.roundRect(g, cx - s * 0.45, cy - s * 1.05, s * 0.9, s * 0.55, s * 0.12); g.fill(); g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(cx - s * 0.8, cy + s * 0.3, s * 1.6, s * 0.08); glowEyes(cy - s * 0.8, 0.18, acc === "lantern" ? "#ffcf6a" : "#7ad7ff");
    if (acc === "lantern") { g.fillStyle = "#3a2a10"; g.fillRect(cx - s * 0.2, cy - s * 0.25, s * 0.4, s * 0.5); g.fillStyle = "#ffcf6a"; g.shadowColor = "#ffcf6a"; g.shadowBlur = 20; g.fillRect(cx - s * 0.13, cy - s * 0.18, s * 0.26, s * 0.36); g.shadowBlur = 0; }
    if (acc === "horns") { g.fillStyle = "#e8d8b0"; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * s * 0.4, cy - s * 0.95); g.quadraticCurveTo(cx + d * s * 1.0, cy - s * 1.1, cx + d * s * 0.9, cy - s * 1.45); g.lineTo(cx + d * s * 0.35, cy - s * 0.75); g.fill(); } }
  }
  else if (kind === "ghost") { g.fillStyle = grad(cy - s, cy + s); g.globalAlpha = 0.9; g.beginPath(); g.moveTo(cx - s * 0.7, cy + s * 0.8); g.lineTo(cx - s * 0.7, cy - s * 0.2); g.arc(cx, cy - s * 0.2, s * 0.7, Math.PI, 0); g.lineTo(cx + s * 0.7, cy + s * 0.8); for (let k = 0; k < 4; k++) g.quadraticCurveTo(cx + s * 0.7 - (k + 0.5) * s * 0.35, cy + s * (k % 2 ? 0.6 : 1.05), cx + s * 0.7 - (k + 1) * s * 0.35, cy + s * 0.8); g.fill(); g.globalAlpha = 1; g.fillStyle = "#0d0a1a"; for (const d of [-1, 1]) { g.beginPath(); g.ellipse(cx + d * s * 0.25, cy - s * 0.25, s * 0.12, s * 0.2, 0, 0, TAU); g.fill(); } }
  else if (kind === "serpent") { g.strokeStyle = grad(cy - s, cy + s); g.lineWidth = s * 0.45; g.lineCap = "round"; g.beginPath(); g.moveTo(cx - s * 0.9, cy + s * 0.7); g.bezierCurveTo(cx - s * 0.2, cy + s * 1.0, cx + s * 0.9, cy + s * 0.5, cx + s * 0.2, cy - s * 0.1); g.quadraticCurveTo(cx - s * 0.3, cy - s * 0.5, cx, cy - s * 0.7); g.stroke(); const heads = acc === "crown" ? [[-0.55, -0.85], [0, -0.95], [0.55, -0.85]] : [[0, -0.85]]; for (const [hx, hy] of heads) { g.fillStyle = a; g.beginPath(); g.ellipse(cx + hx * s, cy + hy * s, s * 0.32, s * 0.24, 0, 0, TAU); g.fill(); g.fillStyle = "#ffe27a"; for (const d of [-1, 1]) { g.beginPath(); g.arc(cx + hx * s + d * s * 0.13, cy + hy * s - s * 0.05, s * 0.05, 0, TAU); g.fill(); } } }
  else if (kind === "orb") { const gr = g.createRadialGradient(cx - s * 0.2, cy - s * 0.3, s * 0.1, cx, cy - s * 0.1, s * 0.75); gr.addColorStop(0, "#fff"); gr.addColorStop(0.4, a); gr.addColorStop(1, b); g.fillStyle = gr; g.shadowColor = a; g.shadowBlur = 24; g.beginPath(); g.arc(cx, cy - s * 0.1, s * 0.65, 0, TAU); g.fill(); g.shadowBlur = 0; g.strokeStyle = a; g.lineWidth = 2; for (let k = 0; k < 5; k++) { const an = k * 1.3; g.beginPath(); g.moveTo(cx + Math.cos(an) * s * 0.7, cy - s * 0.1 + Math.sin(an) * s * 0.7); g.lineTo(cx + Math.cos(an) * s * 1.0, cy - s * 0.1 + Math.sin(an) * s * 1.0); g.stroke(); } }
  else if (kind === "eye") { g.fillStyle = grad(cy - s, cy + s); g.beginPath(); g.arc(cx, cy - s * 0.1, s * 0.8, 0, TAU); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.ellipse(cx, cy - s * 0.1, s * 0.55, s * 0.4, 0, 0, TAU); g.fill(); g.fillStyle = "#c83a3a"; g.beginPath(); g.arc(cx, cy - s * 0.1, s * 0.28, 0, TAU); g.fill(); g.fillStyle = "#0a0505"; g.beginPath(); g.arc(cx, cy - s * 0.1, s * 0.13, 0, TAU); g.fill(); }
  else if (kind === "heart") { g.fillStyle = grad(cy - s, cy + s); g.shadowColor = a; g.shadowBlur = 30; g.beginPath(); g.moveTo(cx, cy + s * 0.95); g.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.6, cy - s * 1.3, cx, cy - s * 0.45); g.bezierCurveTo(cx + s * 0.6, cy - s * 1.3, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.95); g.fill(); g.shadowBlur = 0; g.strokeStyle = "rgba(0,0,0,0.3)"; g.lineWidth = s * 0.06; g.beginPath(); g.moveTo(cx - s * 0.4, cy - s * 0.4); g.quadraticCurveTo(cx - s * 0.1, cy, cx - s * 0.3, cy + s * 0.4); g.moveTo(cx + s * 0.4, cy - s * 0.3); g.quadraticCurveTo(cx + s * 0.15, cy + s * 0.1, cx + s * 0.35, cy + s * 0.45); g.stroke(); g.fillStyle = "#fff6c0"; g.beginPath(); g.ellipse(cx, cy - s * 0.05, s * 0.28, s * 0.2, 0, 0, TAU); g.fill(); g.fillStyle = "#1a0410"; g.beginPath(); g.ellipse(cx, cy - s * 0.05, s * 0.08, s * 0.18, 0, 0, TAU); g.fill(); }
  else if (kind === "mage") { g.fillStyle = "#3b2f6e"; g.beginPath(); g.moveTo(cx - s * 0.7, cy + s * 0.95); g.lineTo(cx - s * 0.35, cy - s * 0.4); g.lineTo(cx + s * 0.35, cy - s * 0.4); g.lineTo(cx + s * 0.7, cy + s * 0.95); g.closePath(); g.fill(); g.fillStyle = "#5a4aa8"; g.beginPath(); g.moveTo(cx - s * 0.55, cy - s * 0.45); g.lineTo(cx + s * 0.55, cy - s * 0.45); g.lineTo(cx + s * 0.05, cy - s * 1.45); g.closePath(); g.fill(); g.fillStyle = "#ffd479"; for (const [sx, sy] of [[-0.15, -0.75], [0.12, -1.0], [-0.05, -1.2]]) { g.beginPath(); g.arc(cx + sx * s, cy + sy * s, s * 0.04, 0, TAU); g.fill(); } g.fillStyle = "#f2d6b8"; g.beginPath(); g.arc(cx, cy - s * 0.45, s * 0.24, 0, TAU); g.fill(); g.fillStyle = "#eee"; g.beginPath(); g.moveTo(cx - s * 0.22, cy - s * 0.38); g.quadraticCurveTo(cx, cy + s * 0.25, cx + s * 0.22, cy - s * 0.38); g.fill(); g.fillStyle = "#1a0f20"; for (const d of [-1, 1]) { g.beginPath(); g.arc(cx + d * s * 0.09, cy - s * 0.5, s * 0.035, 0, TAU); g.fill(); } g.strokeStyle = "#8a5a2a"; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(cx + s * 0.6, cy + s * 0.95); g.lineTo(cx + s * 0.75, cy - s * 0.6); g.stroke(); g.fillStyle = "#7ad7ff"; g.shadowColor = "#7ad7ff"; g.shadowBlur = 16; g.beginPath(); g.arc(cx + s * 0.78, cy - s * 0.72, s * 0.14, 0, TAU); g.fill(); g.shadowBlur = 0; }
  g.restore();
}
function drawEmblem(cv, icon, col, t = 0) {
  const g = cv.getContext("2d"), w = cv.width, h = cv.height; g.clearRect(0, 0, w, h);
  const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, col + "99"); gr.addColorStop(1, col + "00"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.save(); g.translate(w / 2, h / 2); const k = 1 + Math.sin(t * 3) * 0.04; g.scale(k, icon === "fire" ? k * (1 + Math.sin(t * 11) * 0.04) : k); g.translate(-w / 2, -h / 2);
  g.shadowColor = col; g.shadowBlur = 18; drawIcon(g, icon, w, h * 0.9, "#fff6e0"); g.restore();
}
const SPIRE = (() => {
  const st = []; for (let i = 0; i < 14; i++) st.push(`<circle cx="${(i * 53) % 200}" cy="${(i * 37) % 150}" r="${i % 3 ? 1.2 : 2}" opacity="${0.4 + (i % 4) * 0.15}"/>`);
  const win = [[100, 92], [96, 150], [106, 168], [100, 222], [88, 238], [113, 234]].map(([x, y]) => `<rect x="${x - 3}" y="${y - 5}" width="6" height="10" rx="3"/>`).join("");
  return `<svg class="spire" viewBox="0 0 200 262" aria-hidden="true"><defs><linearGradient id="spg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5a46a0"/><stop offset="1" stop-color="#1a1230"/></linearGradient><radialGradient id="spo"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ffd479"/><stop offset="1" stop-color="#ffd47900"/></radialGradient></defs><g fill="#fff">${st.join("")}</g><circle cx="100" cy="30" r="30" fill="url(#spo)"/><path d="M100 18 L114 70 L108 70 L120 130 L112 130 L128 200 L118 200 L142 260 L58 260 L82 200 L72 200 L88 130 L80 130 L92 70 L86 70 Z" fill="url(#spg)" stroke="#8f6bff" stroke-width="1.5"/><g fill="#ffd479">${win}</g></svg>`;
})();
function cardEl(id, up, o = {}) {
  const C = CARDS[id], el = document.createElement(o.button ? "button" : "div"), cost = o.cost ?? (up && C.upCost !== undefined ? C.upCost : C.cost);
  el.className = `card ${C.type} r-${C.rar}${up ? " up" : ""}`;
  if (o.button) el.type = "button"; else if (o.nav) { el.tabIndex = 0; el.dataset.nav = ""; }
  const gem = C.rar === "rare" ? `<i class="gem rare">★</i>` : C.rar === "uncommon" ? `<i class="gem unc">◆</i>` : "";
  el.innerHTML = `${cost >= 0 ? `<span class="cost${o.free ? " free" : ""}">${cost}</span>` : ""}<span class="nm">${C.name}${up ? "+" : ""}</span><span class="art"><canvas width="240" height="130"></canvas></span><span class="ty">${C.type}${C.ex ? " · exhaust" : ""}${gem}</span><span class="tx"><span>${kw(C.d(up))}</span></span>`;
  el.setAttribute("aria-label", `${C.name}${up ? " plus" : ""}${cost >= 0 ? `, cost ${cost}` : ""}. ${C.d(up)}`);
  const g = el.querySelector("canvas").getContext("2d"), gr = g.createRadialGradient(120, 65, 4, 120, 65, 115);
  gr.addColorStop(0, "rgba(255,255,255,.32)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 240, 130);
  g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = 8; g.shadowOffsetY = 3;
  drawIcon(g, C.icon, 240, 130, C.type === "status" ? "#3a3a3a" : "#fff8e8");
  return el;
}
const CARDIDS = Object.keys(CARDS);
const cardOrder = (c) => ["attack", "skill", "power", "status"].indexOf(CARDS[c.id].type) * 100 + CARDIDS.indexOf(c.id);

/* ================= run & map ================= */
function newRun() {
  RUN = { act: 1, hp: 72, maxHp: 72, gold: 99, deck: [], relics: [], potions: [], pos: null, visited: [], node: null, cleared: true, pending: null, phoenix: false, removes: 0, seen: [], stats: { kills: 0, floors: 0, dmg: 0, cards: 0, elites: 0 } };
  for (let i = 0; i < 5; i++) RUN.deck.push({ id: "bolt", up: false });
  for (let i = 0; i < 4; i++) RUN.deck.push({ id: "barrier", up: false });
  RUN.deck.push({ id: "ember", up: false });
  RUN.map = genMap(); SAVE.stats.runs++; saveRun();
  K.ui.hide(); SCREEN = null; showMap(); K.banner("Act 1", ACTS[0], 2400);
}
function saveRun() { if (RUN && !RUN.done) { SAVE.run = clone(RUN); persist(); } }
function genMap() {
  const ROWS = 9, COLS = 7, nodes = {}, key = (r, c) => r + "," + c, edges = new Set();
  const starts = []; while (starts.length < 3) { const s = 1 + K.rndi(5); if (!starts.includes(s)) starts.push(s); }
  for (let p = 0; p < 6; p++) {
    let c = starts[p % 3];
    for (let r = 0; r < ROWS; r++) {
      const k = key(r, c); if (!nodes[k]) nodes[k] = { id: k, r, c, next: [], type: null, jx: K.rnd(-10, 10), jy: K.rnd(-8, 8) };
      if (r === ROWS - 1) break;
      let nc = c;
      for (const d of K.shuffle([-1, 0, 1])) { const t = c + d; if (t < 0 || t >= COLS) continue; if (d && edges.has(key(r, t) + ">" + key(r + 1, c))) continue; nc = t; break; }
      const nk = key(r + 1, nc); edges.add(k + ">" + nk); if (!nodes[k].next.includes(nk)) nodes[k].next.push(nk); c = nc;
    }
  }
  for (const n of Object.values(nodes)) if (n.r === ROWS - 1) n.next = ["boss"];
  nodes.boss = { id: "boss", r: ROWS, c: 3, next: [], type: "boss", jx: 0, jy: 0 };
  const parents = {}; for (const n of Object.values(nodes)) for (const k of n.next) (parents[k] = parents[k] || []).push(n);
  for (const n of Object.values(nodes).sort((a, b) => a.r - b.r)) {
    if (n.type) continue;
    if (n.r === 0) { n.type = "fight"; continue; } if (n.r === ROWS - 1) { n.type = "rest"; continue; } if (n.r === 4) { n.type = "treasure"; continue; }
    const pt = (parents[n.id] || []).map((p) => p.type); let t = "fight";
    for (let tries = 0; tries < 12; tries++) {
      const x = Math.random();
      t = x < 0.45 ? "fight" : x < 0.67 ? "event" : x < 0.8 && n.r >= 3 ? "elite" : x < 0.9 && n.r >= 2 ? "shop" : x < 0.96 && n.r >= 3 && n.r < ROWS - 2 ? "rest" : "fight";
      if (!((t === "elite" || t === "shop" || t === "rest") && pt.includes(t))) break;
    }
    n.type = t;
  }
  return { nodes };
}
function nodeAvail(id) { const N = RUN.map.nodes; if (!N[id] || !RUN.cleared || RUN.pending) return false; if (!RUN.pos) return N[id].r === 0; return N[RUN.pos].next.includes(id); }
const floorNo = () => (RUN.act - 1) * 10 + (RUN.pos === "boss" ? 10 : RUN.pos ? RUN.map.nodes[RUN.pos].r + 1 : 0);
const bossImgs = {};
function bossImg(act) { if (!bossImgs[act]) { const c = document.createElement("canvas"); c.width = c.height = 200; drawMonster(c.getContext("2d"), 200, 200, ENEMIES[ENCOUNTERS[act].boss[0]].art); bossImgs[act] = c.toDataURL(); } return bossImgs[act]; }
function showMap() {
  B = null; $("#app").hidden = false; $("#battle").hidden = true; aimOff(); topbar(); K.playSong("map", 1);
  const mapEl = $("#map"); mapEl.hidden = false;
  const N = RUN.map.nodes, W = 560, rowH = 92, H = 1120, X = (n) => (n.id === "boss" ? W / 2 : 56 + n.c * ((W - 112) / 6) + n.jx), Y = (n) => H - 140 - n.r * rowH + n.jy;
  const bossD = ENEMIES[ENCOUNTERS[RUN.act].boss[0]];
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of act ${RUN.act}"><rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="26" fill="rgba(255,255,255,.025)" stroke="rgba(230,210,255,.12)"/>`;
  svg += `<text x="${W / 2}" y="46" text-anchor="middle" fill="#ffd479" font-family="Cinzel Decorative, serif" font-size="26" font-weight="900">Act ${RUN.act}</text><text x="${W / 2}" y="72" text-anchor="middle" fill="#b7a8d6" font-family="Alegreya Sans, sans-serif" font-size="17" font-weight="800">${ACTS[RUN.act - 1]}</text>`;
  for (const n of Object.values(N)) for (const k of n.next) {
    const m = N[k], taken = RUN.visited.includes(n.id) && RUN.visited.includes(k), ahead = RUN.cleared && !RUN.pending && RUN.pos === n.id;
    const x1 = X(n), y1 = Y(n), x2 = X(m), y2 = Y(m), L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, r2 = m.id === "boss" ? 50 : 29;
    svg += `<line x1="${x1 + ux * 29}" y1="${y1 + uy * 29}" x2="${x2 - ux * r2}" y2="${y2 - uy * r2}" stroke="${taken ? "#ffd479" : ahead ? "rgba(255,212,121,.8)" : "rgba(230,210,255,.24)"}" stroke-width="${taken ? 4 : 3}" stroke-linecap="round"${taken ? "" : ` stroke-dasharray="1 9"`}/>`;
  }
  for (const n of Object.values(N)) {
    const [ic, col, nm, ds] = NODE[n.type], x = X(n), y = Y(n), boss = n.id === "boss", r = boss ? 42 : 25, av = nodeAvail(n.id), done = RUN.visited.includes(n.id);
    svg += `<g class="node${av ? " avail" : ""}${done ? " done" : ""}${RUN.pos === n.id ? " cur" : ""}" data-id="${n.id}" data-x="${x}"${av ? ` tabindex="-1" role="button" aria-label="${nm}"` : ""}><title>${boss ? `${bossD.name}: ${BOSSSUB[RUN.act - 1]}` : `${nm}: ${ds}`}</title><circle class="ring" cx="${x}" cy="${y}" r="${r + 7}"/><circle class="bg" cx="${x}" cy="${y}" r="${r}" fill="${col}" stroke="#1a1230" stroke-width="3"/>${boss ? `<image href="${bossImg(RUN.act)}" x="${x - 42}" y="${y - 50}" width="84" height="84" pointer-events="none"/>` : `<text x="${x}" y="${y + 8}" text-anchor="middle" font-size="23" fill="#fff" font-weight="900" font-family="Alegreya Sans, sans-serif" pointer-events="none">${ic}</text>`}</g>`;
  }
  svg += ["fight", "elite", "event", "shop", "rest", "treasure"].map((t, i) => { const lx = 70 + (i % 3) * 165, ly = H - 70 + ((i / 3) | 0) * 36; return `<circle cx="${lx}" cy="${ly}" r="14" fill="${NODE[t][1]}"/><text x="${lx}" y="${ly + 5.5}" text-anchor="middle" font-size="14" fill="#fff" font-weight="900">${NODE[t][0]}</text><text x="${lx + 22}" y="${ly + 6}" font-size="18" fill="#b7a8d6" font-weight="800" font-family="Alegreya Sans, sans-serif">${NODE[t][2]}</text>`; }).join("");
  svg += `</svg>`; mapEl.innerHTML = svg;
  for (const g of $$(".node.avail", mapEl)) g.addEventListener("click", () => enterNode(g.dataset.id));
  MAPSEL = 0; markMapSel();
  const f = availNodes()[0] || $(".node.cur", mapEl) || $(".node", mapEl); if (f) f.scrollIntoView({ block: "center" });
}
const availNodes = () => $$("#map .node.avail").sort((a, b) => +a.dataset.x - +b.dataset.x);
function markMapSel(scroll) { const av = availNodes(); av.forEach((g, i) => g.classList.toggle("kf", i === MAPSEL && kbish())); if (scroll && av[MAPSEL]) av[MAPSEL].scrollIntoView({ block: "center", behavior: "smooth" }); }
function topbar() {
  if (!RUN) return;
  $("#tHp").textContent = `❤ ${Math.max(0, RUN.hp)}/${RUN.maxHp}`; $("#tGold").textContent = `● ${RUN.gold}`;
  const f = floorNo(); $("#tFloor").textContent = `Act ${RUN.act} · Floor ${f ? f - (RUN.act - 1) * 10 : "–"}`;
  const rel = $("#relics"), rk = RUN.relics.join(",") + RUN.phoenix;
  if (rel.dataset.k !== rk) { rel.dataset.k = rk; rel.innerHTML = RUN.relics.map((r) => `<span class="relic${r === "phoenix" && RUN.phoenix ? " used" : ""}" data-r="${r}" title="${RELICS[r].name}: ${RELICS[r].d}">${RELICS[r].icon}</span>`).join(""); }
  $("#pots").innerHTML = [0, 1, 2].map((i) => { const p = RUN.potions[i]; return p ? `<button class="pot" type="button" data-p="${i}" title="${POTIONS[p].name}: ${POTIONS[p].d}">${POTIONS[p].icon}</button>` : `<span class="pot empty">·</span>`; }).join("");
}
function flashRelic(id) { const el = $(`#relics [data-r="${id}"]`); if (el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); } }
function enterNode(id) {
  if (!RUN || !nodeAvail(id) || K.ui.active() || B) return;
  K.sfx("ok"); const n = RUN.map.nodes[id];
  RUN.pos = id; RUN.visited.push(id); RUN.stats.floors++; RUN.node = n.type; RUN.cleared = false;
  SAVE.stats.bestFloor = Math.max(SAVE.stats.bestFloor, floorNo());
  saveRun(); runNode(n.type);
}
function runNode(t) { if (t === "fight" || t === "elite" || t === "boss") startCombat(t); else if (t === "rest") rest(); else if (t === "shop") shop(); else if (t === "treasure") treasure(); else mystery(); }
function finishNode() {
  RUN.cleared = true; RUN.pending = null; RUN.reward = null; RUN.offer = null; RUN.evt = null; RUN.shop = null; RUN.enc = null; RUN.treasure = null;
  saveRun(); K.ui.hide(); SCREEN = null; showMap();
}
const R_API = {
  heal(n) { const h = Math.max(0, Math.min(n, RUN.maxHp - RUN.hp)); RUN.hp += h; K.toast(`❤ Healed ${h} HP`); K.sfx("heal"); topbar(); },
  hurt(n) { RUN.hp = Math.max(1, RUN.hp - n); K.toast(`Lost ${n} HP`); K.sfx("hurt"); topbar(); },
  gainRelic(id) {
    const pool = Object.keys(RELICS).filter((r) => !RUN.relics.includes(r)), r = id || (pool.length ? K.pick(pool) : null);
    if (!r) { RUN.gold += 50; K.toast("+50 gold", "You already carry every relic."); topbar(); return; }
    RUN.relics.push(r); if (r === "heart") { RUN.maxHp += 12; RUN.hp += 12; }
    K.toast(`${RELICS[r].icon} ${RELICS[r].name}`, RELICS[r].d, "big"); K.sfx("relic"); topbar(); flashRelic(r);
  },
  gainPotion(id) { if (RUN.potions.length >= 3) { K.toast("Your potion belt is full"); return false; } const p = id || K.pick(Object.keys(POTIONS)); RUN.potions.push(p); K.toast(`${POTIONS[p].icon} ${POTIONS[p].name}`, POTIONS[p].d); topbar(); return true; },
  note(t) { K.toast(t); },
  upgradeRandom(n) { const c = RUN.deck.filter((x) => !x.up && CARDS[x.id].rar !== "status"), got = []; for (let i = 0; i < n && c.length; i++) { const x = c.splice(K.rndi(c.length), 1)[0]; x.up = true; got.push(CARDS[x.id].name + "+"); } K.sfx("upgrade"); if (got.length) K.toast("Upgraded", got.join(", ")); },
  cardChoice(tier) { rewardCards(tier, finishNode); },
  pickCard(mode) { pickFromDeck(mode, finishNode, finishNode); },
  get gold() { return RUN.gold; }, set gold(v) { const d = v - RUN.gold; RUN.gold = Math.max(0, v); if (d) K.toast(d > 0 ? `● +${d} gold` : `● ${d} gold`); topbar(); },
  get maxHp() { return RUN.maxHp; },
};

/* ================= combat ================= */
function makeEnemy(id) { const D = ENEMIES[id], hp = D.hp[0] + K.rndi(D.hp[1] - D.hp[0] + 1); return { id, D, moves: D.moves, name: D.name, hp, maxHp: hp, blk: 0, st: {}, turn: 0, intent: null, dead: false, last: [] }; }
function startCombat(kind) {
  const E = ENCOUNTERS[RUN.act], row = RUN.pos === "boss" ? 9 : RUN.map.nodes[RUN.pos].r;
  if (!RUN.enc) { RUN.enc = kind === "boss" ? E.boss : kind === "elite" ? K.pick(E.elite) : K.pick(row < 2 || (row < 5 && Math.random() < 0.3) ? E.easy : E.hard); saveRun(); }
  B = { kind, enemies: RUN.enc.map(makeEnemy), p: { blk: 0, st: {}, energy: 0, maxEnergy: 3 }, draw: K.shuffle(RUN.deck.map((c, i) => ({ id: c.id, up: c.up, uid: i + 1 }))), hand: [], disc: [], exh: [], turn: 0, busy: true, over: false, sel: null, tsel: 0, focus: 0, firstAttack: true, free: new Set(), fresh: {}, newCards: new Set(), uid: 1000 };
  if (has("ring")) B.p.st.might = 1; if (has("bracer")) B.p.st.thorns = 2;
  B.enemies.forEach((e, i) => { const prev = B.enemies[i - 1]; if (prev && prev.id === e.id && e.D.ai) e.turn = prev.turn + 1; }); /* twins act out of step */
  for (const e of B.enemies) { if (has("emberstone")) e.st.burn = 2; if (has("snowglobe")) e.st.frost = 1; e.intent = pickIntent(e); }
  K.ui.hide(); SCREEN = null; $("#map").hidden = true; $("#battle").hidden = false; $("#battle").className = "act" + RUN.act; buildField(); render();
  for (const r of ["ring", "bracer", "emberstone", "snowglobe", "tome"]) if (has(r)) flashRelic(r);
  K.playSong(kind === "boss" ? "boss" : "fight", 3);
  if (kind === "boss") K.banner(B.enemies[0].name, BOSSSUB[RUN.act - 1], 2400);
  else if (kind === "elite") K.banner("Elite", B.enemies.map((e) => e.name).join(" & "), 1600);
  startTurn(true);
}
function pickIntent(e) {
  if (e.D.ai) return e.D.ai(e, e.turn);
  let m, n = 0; do { m = K.pick(e.moves); } while (e.moves.length > 1 && e.last[0] === m && e.last[1] === m && n++ < 20);
  e.last = [m, e.last[0]]; return m;
}
const alive = () => (B ? B.enemies.filter((e) => !e.dead) : []);
async function startTurn(first) {
  if (!B || B.over) return; const p = B.p; B.turn++; B.busy = true;
  p.blk = first && has("feather") ? 8 : 0; if (first && has("feather")) flashRelic("feather");
  showTurn(B.turn === 1 ? "Battle!" : "Your turn");
  if (p.st.burn) { hitPlayer(p.st.burn, null, true); p.st.burn--; renderUnits(); await sleep(320); if (RUN.hp <= 0 && !revive()) return lose(); }
  if (p.st.inferno) for (const e of alive()) applyE(e, "burn", p.st.inferno);
  let en = p.maxEnergy + (p.st.trance || 0);
  if (first && has("crystal")) { en++; flashRelic("crystal"); }
  if (has("hourglass") && B.turn % 3 === 0) { en++; flashRelic("hourglass"); }
  p.energy = en;
  draw(5 + (first && has("quill") ? 2 : 0)); if (first && has("quill")) flashRelic("quill");
  B.busy = false; B.focus = clamp(B.focus, 0, Math.max(0, B.hand.length - 1)); render();
}
function draw(n, free) {
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (!B.draw.length) { if (!B.disc.length) break; B.draw = K.shuffle(B.disc); B.disc = []; K.sfx("shuffle"); }
    const c = B.draw.pop();
    if (B.hand.length >= 10) { B.disc.push(c); floatAt(playerEl(), "Hand full", "#c39bff"); continue; }
    if (free) B.free.add(c.uid); B.hand.push(c); B.newCards.add(c.uid); got++;
  }
  if (got) K.sfx("draw");
}
const baseCost = (c) => (c.up && CARDS[c.id].upCost !== undefined ? CARDS[c.id].upCost : CARDS[c.id].cost);
const costOf = (c) => (B.free.has(c.uid) ? 0 : baseCost(c));
const cardOk = (c) => CARDS[c.id].type !== "status" && costOf(c) <= B.p.energy;
/* the effect API that card scripts in data.js call */
function api() {
  return {
    dmg: (t, base, hits = 1, raw) => { for (let i = 0; i < hits; i++) { if (!t || t.dead) { t = alive()[0]; if (!t) return; } attackE(t, base, raw); } },
    dmgAll: (base) => { for (const e of alive()) attackE(e, base); },
    dmgRandom: (base, hits) => { for (let i = 0; i < hits; i++) { const a = alive(); if (!a.length) return; attackE(K.pick(a), base); } },
    block: (n) => gainBlock(n),
    apply: (t, k, n) => applyE(t, k, n),
    applyAll: (k, n) => { for (const e of alive()) applyE(e, k, n); },
    self: (k, n) => { B.p.st[k] = (B.p.st[k] || 0) + n; K.sfx(k === "might" || k === "thorns" || k === "tthorns" ? "buff" : "power"); floatAt(playerEl(), `+${n} ${STATN[k] || k}`, STATC[k] || "#ffd479"); renderUnits(); },
    draw: (n, free) => draw(n, free),
    energy: (n) => { B.p.energy += n; K.sfx("energy"); pulse($("#energy")); },
    heal: (n) => healP(n),
  };
}
function attackE(e, base, raw) {
  let d = base;
  if (!raw) { d += B.p.st.might || 0; if (B.p.st.frost) d *= 0.75; if (e.st.expose) d *= 1.5; if (B.firstAttack && has("tome")) d *= 2; }
  damageE(e, Math.max(0, Math.floor(d)));
}
function damageE(e, d, burn) {
  if (!e || e.dead) return 0;
  let left = d; if (!burn && e.blk > 0) { const ab = Math.min(e.blk, left); e.blk -= ab; left -= ab; }
  e.hp -= left; RUN.stats.dmg += left;
  const el = enemyEl(e); if (el) { shake(el); floatAt(el, left ? `-${left}` : d ? "Blocked" : "0", burn ? "#ff9a4a" : left ? "#ff6b6b" : "#8ab8ff", left >= 15); }
  K.sfx(burn ? "burn" : left >= 15 ? "hitBig" : left ? "hit" : "blocked");
  if (left >= 22) shakeStage();
  if (e.hp <= 0) { e.hp = 0; e.dead = true; RUN.stats.kills++; SAVE.stats.kills++; K.sfx("kill"); B.tsel = clamp(B.tsel, 0, Math.max(0, alive().length - 1)); }
  renderUnits(); return left;
}
function applyE(e, k, n) { if (!e || e.dead || !n) return; e.st[k] = (e.st[k] || 0) + n; K.sfx(k === "burn" ? "burn" : k === "frost" ? "frost" : "debuff"); floatAt(enemyEl(e), `+${n} ${STATN[k]}`, STATC[k]); renderUnits(); }
function gainBlock(n) { B.p.blk += n; floatAt(playerEl(), `+${n} Block`, "#8ab8ff"); K.sfx("block"); renderUnits(); }
function healP(n) { const h = Math.max(0, Math.min(n, RUN.maxHp - RUN.hp)); RUN.hp += h; floatAt(playerEl(), `+${h}`, "#6fe39a"); K.sfx("heal"); topbar(); renderUnits(); }
async function playCard(c, target) {
  if (!B || B.busy || B.over) return;
  if (!cardOk(c)) { deny(c); return; }
  const C = CARDS[c.id];
  if (C.tgt === "one" && (!target || target.dead)) { const a = alive(); if (a.length === 1) target = a[0]; else { B.sel = c; render(); return; } }
  B.busy = true; B.sel = null; aimOff(); B.p.energy -= costOf(c); B.free.delete(c.uid);
  const i = B.hand.indexOf(c); if (i >= 0) B.hand.splice(i, 1);
  B.focus = clamp(i, 0, Math.max(0, B.hand.length - 1));
  const el = $(`#hand [data-uid="${c.uid}"]`); if (el) el.classList.add(el.classList.contains("drag") ? "fade" : "fly");
  K.sfx(C.type === "attack" ? "cast" : C.type === "power" ? "power" : "skill");
  $("#energy").textContent = `${B.p.energy}/${B.p.maxEnergy + (B.p.st.trance || 0)}`; hint();
  await sleep(150);
  const times = B.p.st.echo && c.id !== "echo" ? 2 : 1; if (times > 1) B.p.st.echo = 0;
  for (let k = 0; k < times; k++) {
    if (!alive().length) break;
    const t = target && !target.dead ? target : alive()[0];
    if (C.type === "attack") { lunge(playerEl(), 1); await projectile(C, C.tgt === "all" ? alive() : [t]); }
    C.p(api(), c.up, t);
    if (k + 1 < times) { floatAt(playerEl(), "Echo!", "#c39bff"); await sleep(280); }
  }
  if (C.type === "attack" && B.firstAttack) { B.firstAttack = false; if (has("tome")) flashRelic("tome"); }
  if (C.type !== "power") (C.ex ? B.exh : B.disc).push(c);
  RUN.stats.cards++;
  render(); await sleep(110);
  if (checkEnd()) return;
  B.busy = false; render();
}
async function endTurn() {
  if (!B || B.busy || B.over) return; B.busy = true; B.sel = null; aimOff(); K.sfx("endturn");
  const p = B.p;
  for (const el of $$("#hand .card")) el.classList.add("out");
  $("#endBtn").disabled = true; $("#endBtn").classList.remove("glow"); hint();
  await sleep(220);
  for (const c of B.hand) (CARDS[c.id].eth ? B.exh : B.disc).push(c);
  B.hand = []; B.free.clear(); p.st.echo = 0;
  if (p.st.runic) gainBlock(p.st.runic);
  if (has("charm") && p.blk === 0) { gainBlock(5); flashRelic("charm"); }
  if (p.st.phoenix) { for (const e of alive()) damageE(e, 6 * p.st.phoenix); healP(2 * p.st.phoenix); await sleep(260); }
  render(); if (checkEnd()) return;
  showTurn("Enemy turn"); await sleep(480);
  B.fresh = {};
  for (const e of B.enemies) {
    if (e.dead || B.over) continue;
    e.blk = 0; renderUnits();
    if (e.st.burn) { damageE(e, e.st.burn, true); e.st.burn--; renderUnits(); await sleep(300); if (e.dead) { if (checkEnd()) return; continue; } }
    await enemyAct(e); renderUnits();
    if (RUN.hp <= 0 && !revive()) return lose();
    if (checkEnd()) return;
    await sleep(240);
  }
  p.st.tthorns = 0; p.st.flamewall = 0;
  for (const k of ["frost", "expose"]) if (p.st[k] && !B.fresh[k]) p.st[k]--;
  for (const e of alive()) { for (const k of ["frost", "expose"]) if (e.st[k]) e.st[k]--; e.turn++; e.intent = pickIntent(e); }
  render(); if (checkEnd()) return;
  startTurn(false);
}
const enemyDmg = (e, m) => { let d = m.atk + (e.st.might || 0); if (e.st.frost) d *= 0.75; if (B.p.st.expose) d *= 1.5; return Math.max(0, Math.floor(d)); };
async function enemyAct(e) {
  const m = e.intent, el = enemyEl(e); if (!m) return;
  say(el, m.n); if (m.atk) lunge(el, -1); else bob(el);
  await sleep(240);
  if (m.blk) { e.blk += m.blk; floatAt(el, `+${m.blk} Block`, "#8ab8ff"); K.sfx("block"); }
  if (m.buf) for (const k in m.buf) { e.st[k] = (e.st[k] || 0) + m.buf[k]; floatAt(el, `+${m.buf[k]} ${STATN[k]}`, "#ffd479"); K.sfx("buff"); }
  if (m.heal) { const h = Math.min(m.heal, e.maxHp - e.hp); e.hp += h; floatAt(el, `+${h}`, "#6fe39a"); K.sfx("heal"); }
  if (m.healAll) for (const o of alive()) { const h = Math.min(m.healAll, o.maxHp - o.hp); o.hp += h; floatAt(enemyEl(o), `+${h}`, "#6fe39a"); K.sfx("heal"); }
  renderUnits();
  if (m.atk) for (let h = 0; h < (m.hits || 1); h++) {
    if (e.dead) break;
    hitPlayer(enemyDmg(e, m), e); if (RUN.hp <= 0) return;
    await sleep(180);
  }
  if (!e.dead && m.deb) for (const k in m.deb) { B.p.st[k] = (B.p.st[k] || 0) + m.deb[k]; B.fresh[k] = 1; floatAt(playerEl(), `+${m.deb[k]} ${STATN[k]}`, STATC[k]); K.sfx(k === "burn" ? "burn" : "debuff"); }
  if (!e.dead && m.add) { for (let i = 0; i < m.add; i++) B.disc.push({ id: "daze", up: false, uid: ++B.uid }); floatAt(playerEl(), `+${m.add} Daze`, "#c39bff"); }
  render();
}
function hitPlayer(d, src, burn) {
  const p = B.p; let left = d;
  if (!burn && p.blk > 0) { const ab = Math.min(p.blk, left); p.blk -= ab; left -= ab; }
  RUN.hp -= left;
  const el = playerEl(); if (el) { shake(el); floatAt(el, left ? `-${left}` : "Blocked", burn ? "#ff9a4a" : left ? "#ff6b6b" : "#8ab8ff", left >= 15); }
  K.sfx(burn ? "burn" : left ? "hurt" : "blocked");
  if (left) { K.vibrate(left >= 12 ? 70 : 35); if (SPD) $("#hurt").animate([{ opacity: Math.min(0.9, 0.35 + left / 25) }, { opacity: 0 }], { duration: 460, easing: "ease-out" }); if (left >= 20) shakeStage(); }
  if (src && !burn && !src.dead) { const th = (p.st.thorns || 0) + (p.st.tthorns || 0); if (th) damageE(src, th); if (p.st.flamewall) applyE(src, "burn", p.st.flamewall); }
  topbar(); renderUnits();
}
function revive() {
  if (RUN.hp > 0) return true;
  if (has("phoenix") && !RUN.phoenix) { RUN.phoenix = true; RUN.hp = Math.round(RUN.maxHp * 0.4); K.toast("🪽 Phoenix Plume", "You rise from the ashes!", "big"); K.sfx("revive"); topbar(); flashRelic("phoenix"); renderUnits(); return true; }
  return false;
}
function checkEnd() {
  if (!B || B.over) return true;
  if (RUN.hp <= 0 && !revive()) { lose(); return true; }
  if (!alive().length) { B.over = true; B.busy = true; aimOff(); hint(); for (const el of $$("#hand .card")) el.classList.add("out"); $("#endBtn").disabled = true; $("#endBtn").classList.remove("glow"); later(win, 700); return true; }
  return false;
}
function win() {
  if (!B || !RUN || RUN.done) return; const kind = B.kind; K.sfx("victory"); K.musicLevel(1);
  if (has("moss")) { RUN.hp = Math.min(RUN.maxHp, RUN.hp + 5); flashRelic("moss"); }
  let gold = kind === "boss" ? 95 : kind === "elite" ? 32 + K.rndi(12) : 12 + K.rndi(9); if (has("coin")) { gold = Math.round(gold * 1.25); flashRelic("coin"); }
  RUN.gold += gold; RUN.enc = null; RUN.cleared = true; if (kind === "elite") RUN.stats.elites++;
  SAVE.stats.bestAct = Math.max(SAVE.stats.bestAct, RUN.act);
  if (kind === "boss") {
    if (RUN.act >= 3) return victory();
    RUN.hp = RUN.maxHp; RUN.bossGold = gold; RUN.pending = "boss"; saveRun(); topbar(); return bossReward();
  }
  const items = [["●", `${gold} gold`, has("coin") ? "Lucky Coin added a little extra." : ""]];
  if (Math.random() < (kind === "elite" ? 0.6 : 0.38) && RUN.potions.length < 3) { const p = K.pick(Object.keys(POTIONS)); RUN.potions.push(p); items.push([POTIONS[p].icon, POTIONS[p].name, POTIONS[p].d]); }
  if (kind === "elite") { const pool = Object.keys(RELICS).filter((r) => !RUN.relics.includes(r)); if (pool.length) { const r = K.pick(pool); R_API.gainRelic(r); items.push([RELICS[r].icon, RELICS[r].name, RELICS[r].d]); } }
  RUN.reward = { items, tier: kind === "elite" ? "elite" : "common" }; RUN.pending = "reward"; RUN.offer = null; saveRun(); topbar();
  rewardPanel();
}
function rewardPanel() {
  SCREEN = rewardPanel; const R = RUN.reward;
  K.ui.show(`<div class="logo sm">Victory!</div><div class="k-list" style="width:min(100%,25em)">${R.items.map(([ic, t, d]) => `<div class="k-li"><span style="font-size:1.4em">${ic}</span><div class="tx"><b>${t}</b>${d ? `<span>${d}</span>` : ""}</div></div>`).join("")}</div><div class="k-menu"><button class="k-btn primary" data-a="cardreward" autofocus>Choose a card</button><button class="k-btn ghost" data-a="done">Skip the card</button></div>`, { cls: "soft" });
}
function cardPick(tier) {
  const out = [], n = has("lens") ? 4 : 3; let guard = 0;
  while (out.length < n && guard++ < 200) {
    const x = Math.random(), rar = tier === "uncommon+" ? (x < 0.68 ? "uncommon" : "rare") : tier === "elite" ? (x < 0.4 ? "common" : x < 0.85 ? "uncommon" : "rare") : x < 0.58 ? "common" : x < 0.92 ? "uncommon" : "rare";
    const id = K.pick(POOL[rar]); if (!out.includes(id)) out.push(id);
  }
  return out;
}
function rewardCards(tier, done) {
  if (!RUN.offer) { RUN.offer = cardPick(tier).map((id) => ({ id, up: Math.random() < (RUN.act - 1) * 0.12 })); saveRun(); }
  SCREEN = () => rewardCards(tier, done); CARDDONE = done;
  const s = K.ui.show(`<h2 class="hd">Choose a card</h2><p class="k-sub">Add one spell to your deck, or skip to keep it lean.</p><div class="cardrow" id="cr"></div><div class="k-row"><button class="k-btn" data-a="deck">View deck (${RUN.deck.length})</button><button class="k-btn ghost" data-a="skipcard">Skip</button></div>`);
  const row = $("#cr", s);
  for (const o of RUN.offer) {
    const el = cardEl(o.id, o.up, { button: true });
    el.onclick = () => { RUN.deck.push({ id: o.id, up: o.up }); RUN.offer = null; CARDDONE = null; K.sfx("pick"); K.toast(`${CARDS[o.id].name}${o.up ? "+" : ""} joins your deck`); done(); };
    row.appendChild(el);
  }
  if (K.device !== "touch" && row.firstChild) row.firstChild.focus({ preventScroll: true });
}
function bossReward() {
  if (!RUN.bossRelics) { RUN.bossRelics = K.shuffle(Object.keys(RELICS).filter((r) => !RUN.relics.includes(r))).slice(0, 3); saveRun(); }
  if (!RUN.bossRelics.length) { RUN.bossRelics = null; RUN.pending = "bosscard"; saveRun(); return rewardCards("uncommon+", nextAct); }
  SCREEN = bossReward;
  K.ui.show(`<div class="logo sm">${ENEMIES[ENCOUNTERS[RUN.act].boss[0]].name} falls!</div><p class="k-sub">+${RUN.bossGold || 0} gold, and your wounds are fully healed. Choose a relic to carry upward.</p><div class="k-row">${RUN.bossRelics.map((r) => `<button class="k-btn relicpick" data-a="bossrelic" data-r="${r}"><span class="ri">${RELICS[r].icon}</span><b>${RELICS[r].name}</b><small>${RELICS[r].d}</small></button>`).join("")}</div>`, { cls: "soft" });
}
function nextAct() {
  RUN.act++; RUN.pos = null; RUN.visited = []; RUN.map = genMap(); RUN.pending = null; RUN.offer = null; RUN.bossRelics = null; RUN.cleared = true;
  saveRun(); K.ui.hide(); SCREEN = null; showMap(); K.banner(`Act ${RUN.act}`, ACTS[RUN.act - 1], 2400);
}
const statsHtml = () => { const s = RUN.stats; return `<div class="k-stats" style="width:min(100%,34em)">${[["Floors", s.floors], ["Enemies", s.kills], ["Elites", s.elites], ["Damage", K.fmt(s.dmg)], ["Cards played", s.cards], ["Deck", RUN.deck.length], ["Relics", RUN.relics.length], ["Gold", RUN.gold]].map(([a, b]) => `<div class="k-stat"><small>${a}</small><b>${b}</b></div>`).join("")}</div>`; };
function lose() {
  if (!B || B.over) return; B.over = true; B.busy = true; RUN.done = true; aimOff(); hint(); K.sfx("defeat"); K.musicLevel(0);
  SAVE.run = null; persist();
  const killers = B.enemies.filter((e) => !e.dead).map((e) => e.name).join(" & "), fl = floorNo() - (RUN.act - 1) * 10;
  later(() => { SCREEN = null; K.ui.show(`<div class="logo">You have fallen</div><p class="k-sub">Slain by ${killers || "your own wounds"} on act ${RUN.act}, floor ${fl}.</p>${statsHtml()}<div class="k-row"><button class="k-btn primary" data-a="newrun" autofocus>Climb again</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "title" }); }, 900);
}
function victory() {
  if (B) { B.over = true; B.busy = true; } RUN.done = true; SAVE.stats.wins++; SAVE.run = null; persist(); SCREEN = null; K.sfx("triumph"); K.playSong("map", 1);
  later(() => K.ui.show(`${SPIRE}<div class="logo">The Spire is yours</div><p class="k-sub">The Spire Heart falls silent and the tower grows still. You reach the top with ${RUN.hp}/${RUN.maxHp} HP and a deck of ${RUN.deck.length} spells.</p>${statsHtml()}<p class="k-sub">Victories: ${SAVE.stats.wins}</p><div class="k-row"><button class="k-btn primary" data-a="newrun" autofocus>Climb again</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "title" }), 700);
}
function usePotion(i) {
  const p = RUN && RUN.potions[i]; if (!p || RUN.done) return;
  if (B && (B.busy || B.over)) return K.sfx("deny");
  if (!B && p !== "heal") { K.toast(`${POTIONS[p].icon} ${POTIONS[p].name}`, "Save that one for a fight."); return; }
  if (p === "fire" && alive().length > 1) { B.sel = { potion: i }; B.tsel = clamp(B.tsel, 0, alive().length - 1); K.sfx("click"); render(); return; }
  drinkPotion(i, B ? alive()[0] : null);
}
function drinkPotion(i, t) {
  const p = RUN.potions.splice(i, 1)[0]; if (!p) return; K.sfx("potion");
  if (p === "heal") { if (B) healP(20); else R_API.heal(20); }
  else if (p === "fire") { if (t) damageE(t, Math.floor(20 * (t.st.expose ? 1.5 : 1))); }
  else if (p === "iron") gainBlock(12);
  else if (p === "swift") draw(3);
  else if (p === "mana") { B.p.energy += 2; pulse($("#energy")); }
  topbar();
  if (B) { render(); checkEnd(); } else saveRun();
}
function potionMenu() {
  if (!RUN || RUN.done || K.ui.active() || (B && (B.busy || B.over))) return;
  if (!RUN.potions.length) { K.toast("No potions", "Win fights or visit a merchant to find some."); return; }
  SCREEN = potionMenu;
  K.ui.show(`<h2 class="hd">Potions</h2><div class="k-menu">${RUN.potions.map((p, i) => `<button class="k-btn" data-a="drink" data-i="${i}" ${!B && p !== "heal" ? "disabled" : ""}>${POTIONS[p].icon} ${POTIONS[p].name}<small>${POTIONS[p].d}</small></button>`).join("")}<button class="k-btn ghost" data-a="close">Close</button></div>`, { back: "close" });
}

/* ================= combat UI ================= */
const enemyEl = (e) => (B ? $(`#field [data-e="${B.enemies.indexOf(e)}"]`) : null);
const playerEl = () => $("#field [data-p]");
function floatAt(el, text, col, big) {
  if (!el || !text) return; const f = document.createElement("div"), n = el.querySelectorAll(".float").length;
  f.className = "float" + (big ? " big" : ""); f.textContent = text; f.style.color = col;
  f.style.left = 50 + ((n % 3) - 1) * 22 + K.rnd(-6, 6) + "%"; f.style.top = 8 + (n % 4) * 9 + "%";
  el.appendChild(f); setTimeout(() => f.remove(), 1150);
}
function say(el, text) { if (!el) return; const s = document.createElement("div"); s.className = "say"; s.textContent = text; el.appendChild(s); setTimeout(() => s.remove(), 1200); }
function shake(el) { el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit"); }
function lunge(el, dir) { const cv = el && el.querySelector("canvas"); if (cv && SPD) cv.animate([{ transform: "none" }, { transform: `translateX(${dir * 28}px) scale(1.06)` }, { transform: "none" }], { duration: tm(280), easing: "ease-out" }); }
function bob(el) { const cv = el && el.querySelector("canvas"); if (cv && SPD) cv.animate([{ transform: "none" }, { transform: "translateY(-12px) scale(1.04)" }, { transform: "none" }], { duration: tm(320), easing: "ease-out" }); }
function shakeStage() { if (SPD) $("#stage").animate([{ transform: "none" }, { transform: "translate(-6px,3px)" }, { transform: "translate(5px,-4px)" }, { transform: "translate(-3px,2px)" }, { transform: "none" }], { duration: 300 }); }
function pulse(el) { el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); }
function deny(c) { K.sfx("deny"); const en = $("#energy"); en.classList.remove("shake"); void en.offsetWidth; en.classList.add("shake"); if (c && CARDS[c.id].type === "status") K.toast("Daze can't be played", "It vanishes at the end of your turn."); }
function showTurn(t) { const el = $("#turn"); el.textContent = t; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); }
function projectile(C, targets) {
  const pe = playerEl(); if (!pe || !SPD) return Promise.resolve();
  const col = PCOL[C.icon] || "#c39bff", pr = pe.querySelector("canvas").getBoundingClientRect(), fx = $("#fx"), dur = tm(260);
  return Promise.all(targets.map((t) => {
    const el = enemyEl(t); if (!el) return null;
    const r = el.querySelector("canvas").getBoundingClientRect(), b = document.createElement("div");
    b.className = "bolt"; b.style.background = `radial-gradient(circle, #fff 0 22%, ${col} 48%, transparent 72%)`; b.style.boxShadow = `0 0 18px 6px ${col}`; fx.appendChild(b);
    const x0 = pr.left + pr.width * 0.78, y0 = pr.top + pr.height * 0.3, x1 = r.left + r.width / 2 + K.rnd(-10, 10), y1 = r.top + r.height / 2 + K.rnd(-10, 10);
    const a = b.animate([{ transform: `translate(${x0}px,${y0}px) scale(.5)` }, { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 70}px) scale(1)`, offset: 0.5 }, { transform: `translate(${x1}px,${y1}px) scale(1.4)` }], { duration: dur, easing: "ease-in" });
    return Promise.race([a.finished, sleep(320)]).catch(() => {}).then(() => b.remove());
  }).filter(Boolean));
}
function buildField() {
  const f = $("#field"); f.innerHTML = "";
  const pu = unitEl("You"); pu.dataset.p = 1; drawMonster(pu.querySelector("canvas").getContext("2d"), 220, 220, ["mage"]); f.appendChild(pu);
  const side = document.createElement("div"); side.className = "foes"; f.appendChild(side);
  B.enemies.forEach((e, i) => { const u = unitEl(e.name); u.dataset.e = i; if (e.D.boss) u.classList.add("boss"); drawMonster(u.querySelector("canvas").getContext("2d"), 220, 220, e.D.art); u.addEventListener("click", (ev) => { ev.stopPropagation(); clickEnemy(e); }); side.appendChild(u); });
}
function unitEl(name) { const u = document.createElement("div"); u.className = "unit"; u.innerHTML = `<div class="intent none"></div><canvas width="220" height="220"></canvas><div class="bar"><i></i><b></b></div><div class="stat"></div><div class="uname">${name}</div>`; return u; }
function statHtml(st) { return Object.entries(st).filter(([k, v]) => v > 0 && STATN[k]).map(([k, v]) => `<span style="color:${STATC[k]}" title="${STATN[k]} ${v}: ${STATD[k] || ""}">${STATI[k]}${v}</span>`).join(""); }
function describeMove(e, m) {
  const p = [];
  if (m.atk) p.push(`attack for ${enemyDmg(e, m)}${m.hits > 1 ? ` × ${m.hits}` : ""}`);
  if (m.blk) p.push(`gain ${m.blk} Block`);
  if (m.buf) for (const k in m.buf) p.push(`gain ${m.buf[k]} ${STATN[k]}`);
  if (m.heal) p.push(`heal ${m.heal}`); if (m.healAll) p.push(`heal every enemy ${m.healAll}`);
  if (m.deb) for (const k in m.deb) p.push(`give you ${m.deb[k]} ${STATN[k]}`);
  if (m.add) p.push(`shuffle ${m.add} Daze into your discard pile`);
  return `${m.n}: will ${p.join(", ")}.`;
}
function intentHtml(e) {
  const m = e.intent; if (!m || e.dead) return `<div class="intent none"></div>`;
  let s = "", cls = "buf";
  if (m.atk) { s += `⚔ ${enemyDmg(e, m)}${m.hits > 1 ? "×" + m.hits : ""} `; cls = "atk"; }
  if (m.blk) { s += "🛡 "; if (!m.atk) cls = "def"; }
  if (m.buf || m.heal || m.healAll) s += "▲ ";
  if (m.deb || m.add) { s += "✦ "; if (!m.atk) cls = "deb"; }
  return `<div class="intent ${cls}" title="${describeMove(e, m)}">${s.trim()}</div>`;
}
function setBar(u, hp, max, blk) {
  const bar = u.querySelector(".bar"); bar.querySelector("i").style.width = (100 * Math.max(0, hp)) / max + "%"; bar.querySelector("b").textContent = `${Math.max(0, hp)}/${max}`; bar.classList.toggle("blocked", blk > 0);
  let bk = bar.querySelector(".blk"); if (blk > 0) { if (!bk) { bk = document.createElement("div"); bk.className = "blk"; bar.appendChild(bk); } bk.textContent = blk; } else if (bk) bk.remove();
}
function renderUnits() {
  if (!B) return; const pe = playerEl();
  if (pe) { setBar(pe, RUN.hp, RUN.maxHp, B.p.blk); pe.querySelector(".stat").innerHTML = statHtml(B.p.st); }
  const a = alive(), tgt = !!B.sel && !B.busy && (B.sel.potion !== undefined || CARDS[B.sel.id].tgt === "one");
  B.enemies.forEach((e) => {
    const u = enemyEl(e); if (!u) return;
    u.classList.toggle("dead", e.dead); u.classList.toggle("target", tgt && !e.dead); u.classList.toggle("tk", tgt && kbish() && a[B.tsel] === e);
    setBar(u, e.hp, e.maxHp, e.blk); u.querySelector(".stat").innerHTML = statHtml(e.st); u.querySelector(".intent").outerHTML = intentHtml(e);
    u.title = `${e.name}${e.D.elite ? " (elite)" : e.D.boss ? " (boss)" : ""}`;
  });
}
function render() {
  if (!B) return; renderUnits(); topbar();
  const p = B.p, maxE = p.maxEnergy + (p.st.trance || 0), en = $("#energy");
  en.textContent = `${p.energy}/${maxE}`; en.classList.toggle("empty", p.energy <= 0);
  $("#drawPile b").textContent = B.draw.length; $("#discPile b").textContent = B.disc.length;
  const hand = $("#hand"); hand.innerHTML = ""; let d = 0;
  B.hand.forEach((c, i) => {
    const cost = costOf(c), el = cardEl(c.id, c.up, { cost, free: cost < baseCost(c) }); el.dataset.uid = c.uid; el.tabIndex = -1;
    if (!cardOk(c)) el.classList.add("na");
    if (B.sel === c) el.classList.add("sel");
    if (kbish() && i === B.focus && !B.busy && !B.sel) el.classList.add("kf");
    if (B.newCards.has(c.uid)) { el.classList.add("new"); el.style.setProperty("--d", tm(d++ * 70) + "ms"); }
    el.addEventListener("pointerdown", (ev) => dragStart(ev, c, el));
    hand.appendChild(el);
  });
  B.newCards.clear(); layoutHand();
  $("#endBtn").disabled = B.busy || B.over; $("#endBtn").classList.toggle("glow", !B.busy && !B.over && !B.hand.some(cardOk));
  if (!B.sel) aimOff(); hint();
}
function layoutHand() {
  const hand = $("#hand"), cards = $$("#hand .card"), n = cards.length; if (!n) return;
  const W = hand.clientWidth, cw = cards[0].offsetWidth, room = W - cw * 0.36, step = n > 1 ? Math.min(cw * 0.86, (room - cw) / (n - 1)) : 0, x0 = W / 2 - ((n - 1) * step) / 2 - cw / 2;
  const hl = hand.getBoundingClientRect().left, grow = document.body.classList.contains("touch") ? 0.16 : 0.05;
  cards.forEach((el, i) => {
    const off = i - (n - 1) / 2; let x = x0 + i * step;
    if (el.classList.contains("sel") || el.classList.contains("kf")) x = clamp(x, grow * cw + 6 - hl, innerWidth - hl - cw * (1 + grow) - 6); /* keep the raised card on screen */
    el.style.left = x + "px"; el.style.setProperty("--rot", off * Math.min(4, 22 / n) + "deg"); el.style.setProperty("--dy", off * off * 1.8 + "px"); el.style.zIndex = i + 1;
  });
}
function hint() {
  let t = "";
  if (B && !B.busy && !B.over && B.sel) {
    if (B.sel.potion !== undefined) t = `Choose a target for the ${POTIONS[RUN.potions[B.sel.potion]].name}`;
    else { const multi = CARDS[B.sel.id].tgt === "one" && alive().length > 1; t = multi ? (K.device === "touch" ? "Tap an enemy to target it" : "Choose a target") : "Tap the card again to play it"; }
  }
  $("#hint").textContent = t;
}
function clickCard(c) {
  if (!B || B.busy || B.over || !c) return;
  const C = CARDS[c.id], multi = C.tgt === "one" && alive().length > 1;
  if (B.sel === c) { if (!multi && K.device === "touch") return playCard(c, alive()[0]); B.sel = null; K.sfx("back"); render(); return; }
  if (!cardOk(c)) { deny(c); return; }
  B.focus = Math.max(0, B.hand.indexOf(c));
  if (multi || K.device === "touch") { B.sel = c; B.tsel = clamp(B.tsel, 0, alive().length - 1); K.sfx("click"); render(); return; }
  playCard(c, alive()[0]);
}
function clickEnemy(e) {
  if (!B || B.busy || B.over || !e || e.dead || !B.sel) return;
  const s = B.sel; B.sel = null; aimOff();
  if (s.potion !== undefined) drinkPotion(s.potion, e); else if (CARDS[s.id].tgt === "one") playCard(s, e); else playCard(s, alive()[0]);
}
function cancelSel() { if (B && B.sel) { B.sel = null; K.sfx("back"); render(); } }
function dragStart(ev, c, el) {
  if (!B || B.busy || B.over || ev.button > 0) return;
  ev.preventDefault();
  const id = ev.pointerId, x0 = ev.clientX, y0 = ev.clientY; let moved = false;
  const tgtOne = CARDS[c.id].tgt === "one";
  const move = (e) => {
    if (e.pointerId !== id || !B) return; const dx = e.clientX - x0, dy = e.clientY - y0;
    if (!moved && Math.hypot(dx, dy) > 12 && cardOk(c) && !B.busy) { moved = true; el.classList.add("drag"); if (B.sel) { B.sel = null; renderUnits(); hint(); } aimOff(); }
    if (!moved) return;
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${clamp(dx * 0.03, -12, 12)}deg) scale(1.06)`;
    const t = tgtOne ? enemyAt(e.clientX, e.clientY) : null;
    for (const e2 of B.enemies) { const u = enemyEl(e2); if (u) u.classList.toggle("target", t === e2); }
    el.classList.toggle("ready", tgtOne ? !!t || (alive().length === 1 && above(e.clientY)) : above(e.clientY));
  };
  const up = (e) => {
    if (e.pointerId !== id) return; removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
    if (!B) return;
    if (!moved) { if (e.type === "pointerup") clickCard(c); return; }
    const t = enemyAt(e.clientX, e.clientY);
    const ok = !B.busy && !B.over && cardOk(c) && (tgtOne ? !!t || (alive().length === 1 && above(e.clientY)) : above(e.clientY));
    if (ok) playCard(c, t || alive()[0]); else { K.sfx("back"); render(); }
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
}
const above = (y) => y < $("#hud").getBoundingClientRect().top + 8;
function enemyAt(x, y) { for (const e of alive()) { const u = enemyEl(e); if (!u) continue; const r = u.getBoundingClientRect(); if (x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8) return e; } return null; }
function aimOff() { $("#aim").classList.remove("on"); }
function drawAim(x, y) {
  if (!B || !B.sel || B.busy || B.over || K.device !== "mouse") return aimOff();
  const pot = B.sel.potion !== undefined;
  if (!pot && CARDS[B.sel.id].tgt !== "one") return aimOff();
  const src = pot ? $(`#pots [data-p="${B.sel.potion}"]`) : $("#hand .card.sel"); if (!src) return aimOff();
  const r = src.getBoundingClientRect(), x0 = r.left + r.width / 2, y0 = pot ? r.bottom + 4 : r.top + 12, cx = (x0 + x) / 2, cy = Math.min(y0, y) - 70;
  const tx = x - cx, ty = y - cy, L = Math.hypot(tx, ty) || 1, ux = tx / L, uy = ty / L;
  $("#aimPath").setAttribute("d", `M${x0} ${y0} Q${cx} ${cy} ${x - ux * 12} ${y - uy * 12}`);
  $("#aimHead").setAttribute("d", `M${x} ${y} L${x - ux * 20 - uy * 10} ${y - uy * 20 + ux * 10} L${x - ux * 20 + uy * 10} ${y - uy * 20 - ux * 10} Z`);
  const aim = $("#aim"); aim.classList.add("on"); aim.classList.toggle("ok", !!enemyAt(x, y));
}
addEventListener("pointermove", (e) => { if (B && B.sel) drawAim(e.clientX, e.clientY); });
$("#endBtn").onclick = () => endTurn();
$("#menuBtn").onclick = () => menu();
$("#deckBtn").onclick = () => { if (!RUN || RUN.done || document.querySelector(".k-modal") || $("#dv") || (B && B.busy && !K.ui.active())) return; viewDeck(); };
$("#drawPile").onclick = () => { if (B && !K.ui.active()) viewPile("Draw pile (shown in random order)", K.shuffle(B.draw.slice()), null); };
$("#discPile").onclick = () => { if (B && !K.ui.active()) viewPile("Discard pile", B.disc.slice(), null); };
$("#pots").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) usePotion(+b.dataset.p); });
$("#relics").addEventListener("click", (e) => { const r = e.target.closest("[data-r]"); if (r && K.device === "touch") K.toast(`${RELICS[r.dataset.r].icon} ${RELICS[r.dataset.r].name}`, RELICS[r.dataset.r].d); });
$("#field").addEventListener("click", (e) => { if (B && B.sel && !e.target.closest(".unit[data-e]")) cancelSel(); });
$("#battle").addEventListener("contextmenu", (e) => { if (B && B.sel) { e.preventDefault(); cancelSel(); } });
function viewPile(title, list, ret = SCREEN) {
  PILERET = ret;
  const s = K.ui.show(`<div class="k-bar"><h2>${title}</h2><button class="k-btn" data-a="closepile" autofocus>Close</button></div><div class="deckview" id="dv"></div>`, { back: "closepile", cls: "top" });
  const dv = $("#dv", s); for (const c of list) dv.appendChild(cardEl(c.id, c.up, { nav: true }));
  if (!list.length) dv.innerHTML = `<p class="k-sub">Empty.</p>`;
}
function viewDeck() { if (!RUN) return; viewPile(`Your deck · ${RUN.deck.length} cards`, RUN.deck.slice().sort((a, b) => cardOrder(a) - cardOrder(b) || b.up - a.up)); }

/* ================= input ================= */
function moveTarget(dir) { const a = alive(); if (!a.length) return; B.tsel = (B.tsel + dir + a.length) % a.length; K.sfx("move"); renderUnits(); }
function confirmTarget() { const a = alive(); clickEnemy(a[clamp(B.tsel, 0, a.length - 1)]); }
function moveFocus(dir) { if (!B.hand.length) return; B.focus = (B.focus + dir + B.hand.length) % B.hand.length; K.sfx("move"); render(); }
function confirmSel() { const C = B.sel.potion === undefined && CARDS[B.sel.id]; if (C && C.tgt !== "one") playCard(B.sel, alive()[0]); else confirmTarget(); }
function mapKey(code) {
  const av = availNodes(); if (!av.length) return false;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(code)) { MAPSEL = (MAPSEL + (code === "ArrowRight" || code === "ArrowUp" ? 1 : av.length - 1)) % av.length; markMapSel(true); K.sfx("move"); return true; }
  if (code === "Enter" || code === "Space") { enterNode(av[MAPSEL % av.length].dataset.id); return true; }
  return false;
}
addEventListener("keydown", (e) => {
  if (e.defaultPrevented || K.ui.active() || !RUN || RUN.done) return;
  if (e.repeat && e.code !== "ArrowLeft" && e.code !== "ArrowRight") return;
  if (!B) {
    if ($("#map").hidden) return;
    if (mapKey(e.code)) { e.preventDefault(); return; }
    if (e.code === "Escape") menu(); else if (e.code === "KeyD") viewDeck(); else if (e.code === "KeyP") potionMenu();
    return;
  }
  if (B.over) return;
  const n = e.key === "0" ? 10 : +e.key;
  if (n >= 1 && n <= 10 && B.hand[n - 1]) { clickCard(B.hand[n - 1]); return; }
  if (B.sel) {
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") { moveTarget(e.code === "ArrowRight" ? 1 : -1); e.preventDefault(); return; }
    if (e.code === "Enter" || e.code === "Space") { confirmSel(); e.preventDefault(); return; }
    if (e.code === "Escape") { cancelSel(); return; }
  } else {
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") { moveFocus(e.code === "ArrowRight" ? 1 : -1); e.preventDefault(); return; }
    if (e.code === "Enter" || e.code === "Space") { clickCard(B.hand[B.focus]); e.preventDefault(); return; }
    if (e.code === "Escape") { menu(); return; }
  }
  if (e.code === "KeyE") endTurn(); else if (e.code === "KeyD") viewDeck(); else if (e.code === "KeyP") potionMenu();
});
function pollPad() {
  const P = K.pad, pr = P.pressed; if (!P.connected || !RUN || RUN.done) return;
  if (!B) {
    if ($("#map").hidden) return;
    if (pr.dl || pr.lb) mapKey("ArrowLeft"); else if (pr.dr || pr.rb || pr.du || pr.dd) mapKey("ArrowRight");
    if (pr.a) mapKey("Enter"); if (pr.start) menu(); else if (pr.back) viewDeck(); else if (pr.y) potionMenu();
    return;
  }
  if (B.over) return;
  if (pr.start) return menu();
  if (B.sel) {
    if (pr.dl || pr.lb) moveTarget(-1); if (pr.dr || pr.rb) moveTarget(1);
    if (pr.a) confirmSel(); else if (pr.b) cancelSel();
    return;
  }
  if (pr.dl || pr.lb) moveFocus(-1); if (pr.dr || pr.rb) moveFocus(1);
  if (pr.a) clickCard(B.hand[B.focus]);
  if (pr.x) endTurn(); else if (pr.y) potionMenu(); else if (pr.back) viewDeck();
}

/* ================= rest / shop / treasure / event ================= */
function rest() {
  SCREEN = rest; const heal = Math.round(RUN.maxHp * 0.3), canUp = RUN.deck.some((c) => !c.up && CARDS[c.id].rar !== "status");
  K.ui.show(`<canvas class="emb" data-icon="fire" data-col="#ff9a4a" width="130" height="130"></canvas><div class="logo sm">Rest Site</div><p class="k-sub">The fire crackles. For a moment, the spire is quiet.</p><div class="k-menu"><button class="k-btn primary" data-a="restheal" autofocus>Rest<small>Heal ${Math.min(heal, RUN.maxHp - RUN.hp)} HP</small></button><button class="k-btn" data-a="restup" ${canUp ? "" : "disabled"}>Study<small>${canUp ? "Upgrade a card" : "Every card is already upgraded"}</small></button></div>`);
}
const PRICE = { common: 50, uncommon: 78, rare: 150 };
function shop() {
  const disc = has("map") ? 0.75 : 1, pr = (b) => Math.round(b * disc * (0.9 + Math.random() * 0.2));
  if (!RUN.shop) {
    const ids = [], take = (rar, n) => { for (const id of K.shuffle(POOL[rar].filter((x) => !ids.includes(x))).slice(0, n)) ids.push(id); };
    take("common", 2); take("uncommon", 2); take(Math.random() < 0.55 ? "rare" : "uncommon", 1);
    RUN.shop = { cards: ids.map((id) => ({ id, price: pr(PRICE[CARDS[id].rar]), sold: false })), relics: K.shuffle(Object.keys(RELICS).filter((r) => !RUN.relics.includes(r))).slice(0, 2).map((id) => ({ id, price: pr(160), sold: false })), pots: [K.pick(Object.keys(POTIONS)), K.pick(Object.keys(POTIONS))].map((id) => ({ id, price: pr(48), sold: false })), remove: Math.round((75 + RUN.removes * 25) * disc), removed: false };
    saveRun();
  }
  SCREEN = shop; K.playSong("map", 1); const S = RUN.shop, g = RUN.gold;
  const priceTag = (it) => (it.sold ? `<span class="price sold">Sold</span>` : `<span class="price${g < it.price ? " no" : ""}">● ${it.price}</span>`);
  const s = K.ui.show(`<div class="k-bar"><h2>$ Wandering Bazaar</h2><span style="color:var(--gold);font-weight:900;font-size:1.15em">● ${g}</span><button class="k-btn" data-a="done">Leave</button></div><div class="shopwrap"><div class="shopcards" id="sc"></div><div class="k-row shopitems">
    ${S.relics.map((r, i) => `<button class="k-btn ${r.sold || g < r.price ? "dim" : ""}" data-a="buyrelic" data-i="${i}" title="${RELICS[r.id].d}">${RELICS[r.id].icon} ${RELICS[r.id].name}<small>${r.sold ? "Sold" : "● " + r.price}</small></button>`).join("")}
    ${S.pots.map((p, i) => `<button class="k-btn ${p.sold || g < p.price || RUN.potions.length >= 3 ? "dim" : ""}" data-a="buypot" data-i="${i}" title="${POTIONS[p.id].d}">${POTIONS[p.id].icon} ${POTIONS[p.id].name}<small>${p.sold ? "Sold" : "● " + p.price}</small></button>`).join("")}
    <button class="k-btn ${g < S.remove || S.removed ? "dim" : ""}" data-a="buyremove" title="Remove a card from your deck">✂ Remove a card<small>${S.removed ? "Done" : "● " + S.remove}</small></button></div></div>`, { back: "done", cls: "top", focusSel: "#sc .card" });
  const sc = $("#sc", s);
  S.cards.forEach((c) => {
    const wrap = document.createElement("div"), el = cardEl(c.id, false, { button: true });
    if (c.sold || g < c.price) el.classList.add("dim");
    el.onclick = () => { if (c.sold || RUN.gold < c.price) return K.sfx("deny"); RUN.gold -= c.price; c.sold = true; RUN.deck.push({ id: c.id, up: false }); K.sfx("coin"); K.toast(`${CARDS[c.id].name} joins your deck`); saveRun(); topbar(); shop(); };
    wrap.appendChild(el); wrap.insertAdjacentHTML("beforeend", priceTag(c)); sc.appendChild(wrap);
  });
}
function treasure() {
  if (!RUN.cleared) { const pool = Object.keys(RELICS).filter((r) => !RUN.relics.includes(r)); RUN.treasure = pool.length ? K.pick(pool) : "gold"; if (RUN.treasure === "gold") RUN.gold += 60; else R_API.gainRelic(RUN.treasure); RUN.cleared = true; saveRun(); }
  SCREEN = treasure; const r = RUN.treasure;
  K.ui.show(`<canvas class="emb" data-icon="star" data-col="#3aa86a" width="130" height="130"></canvas><div class="logo sm">Treasure</div>${r && r !== "gold" ? `<p class="k-sub"><span style="font-size:1.6em">${RELICS[r].icon}</span><br><b style="color:var(--text)">${RELICS[r].name}</b><br>${RELICS[r].d}</p>` : `<p class="k-sub">A pouch of 60 gold.</p>`}<button class="k-btn primary" data-a="done" autofocus>Continue</button>`);
}
function mystery() {
  if (RUN.evt == null) { let pool = EVENTS.map((_, i) => i).filter((i) => !RUN.seen.includes(i)); if (!pool.length) pool = EVENTS.map((_, i) => i); RUN.evt = K.pick(pool); RUN.seen.push(RUN.evt); saveRun(); }
  SCREEN = mystery; const ev = EVENTS[RUN.evt], [ic, col] = EVICON[ev.title] || ["swirl", "#8f6bff"];
  K.ui.show(`<div class="event k-panel"><canvas class="emb" data-icon="${ic}" data-col="${col}" width="130" height="130"></canvas><h2>${ev.title}</h2><p>${ev.text}</p>${ev.opts.map((o, i) => `<button class="k-btn choice${o.if && !o.if(R_API) ? " dim" : ""}" data-a="evopt" data-i="${i}" ${i === 0 ? "autofocus" : ""}><b>${o.l}</b>${o.d ? `<small>${o.d}</small>` : ""}</button>`).join("")}</div>`);
}
function pickFromDeck(mode, done, cancel) {
  SCREEN = () => pickFromDeck(mode, done, cancel); PICK = { cancel };
  const T = { upgrade: ["Upgrade a card", "Choose a card to upgrade. Upgraded versions are shown."], remove: ["Remove a card", "Choose a card to remove from your deck for good."], copy: ["Copy a card", "Choose a card to duplicate."] }[mode];
  const list = RUN.deck.map((c, i) => ({ c, i })).filter(({ c }) => mode !== "upgrade" || (!c.up && CARDS[c.id].rar !== "status")).sort((a, b) => cardOrder(a.c) - cardOrder(b.c));
  const s = K.ui.show(`<div class="k-bar"><h2>${T[0]}</h2><button class="k-btn" data-a="pickcancel">Cancel</button></div><p class="k-sub">${T[1]}</p><div class="deckview" id="dv"></div>`, { cls: "top", back: "pickcancel", focusSel: "#dv .card" });
  const dv = $("#dv", s);
  for (const { c, i } of list) {
    const el = cardEl(c.id, mode === "upgrade" || c.up, { button: true });
    el.onclick = () => {
      if (mode === "upgrade") { c.up = true; K.sfx("upgrade"); K.toast(`${CARDS[c.id].name}+`, "Upgraded"); }
      else if (mode === "remove") { RUN.deck.splice(i, 1); K.sfx("remove"); K.toast(`${CARDS[c.id].name} removed`); }
      else { RUN.deck.push({ id: c.id, up: c.up }); K.sfx("pick"); K.toast(`${CARDS[c.id].name}${c.up ? "+" : ""} copied`); }
      PICK = null; saveRun(); done(true);
    };
    dv.appendChild(el);
  }
  if (!list.length) dv.innerHTML = `<p class="k-sub">Nothing to choose.</p>`;
}

/* ================= audio ================= */
K.defineSfx({
  draw: (t) => K.noise(t, 0.05, { filter: "highpass", freq: 3000, vol: 0.035 }),
  shuffle: (t) => { for (let i = 0; i < 6; i++) K.noise(t + i * 0.04, 0.04, { filter: "highpass", freq: 2500, vol: 0.03 }); },
  cast: (t) => { K.voice(500, t, 0.16, { type: "sawtooth", vol: 0.04, slide: 2, lp: 2600 }); K.noise(t, 0.12, { filter: "bandpass", freq: 2400, slide: 2, vol: 0.04 }); },
  skill: (t) => K.voice(660, t, 0.16, { type: "triangle", vol: 0.05, slide: 1.4 }),
  power: (t) => K.notes(t, [392, 523, 784], 0.06, { type: "triangle", vol: 0.05, len: 0.32 }),
  hit: (t) => { K.noise(t, 0.1, { filter: "lowpass", freq: 1800, vol: 0.12 }); K.voice(160, t, 0.1, { type: "square", vol: 0.04, lp: 900 }); },
  hitBig: (t) => { K.noise(t, 0.28, { filter: "lowpass", freq: 1200, vol: 0.18 }); K.voice(90, t, 0.28, { type: "sine", vol: 0.13, slide: 0.5 }); },
  blocked: (t) => K.voice(900, t, 0.07, { type: "triangle", vol: 0.045 }),
  block: (t) => K.voice(300, t, 0.13, { type: "triangle", vol: 0.05, slide: 1.5 }),
  hurt: (t) => { K.noise(t, 0.16, { filter: "lowpass", freq: 900, vol: 0.14 }); K.voice(200, t, 0.16, { type: "sawtooth", vol: 0.04, slide: 0.6, lp: 1200 }); },
  burn: (t) => K.noise(t, 0.26, { filter: "bandpass", freq: 1200, slide: 1.8, vol: 0.06 }),
  frost: (t) => K.voice(1800, t, 0.2, { type: "sine", vol: 0.04, slide: 0.6 }),
  debuff: (t) => K.voice(300, t, 0.2, { type: "sawtooth", vol: 0.03, slide: 0.5, lp: 1400 }),
  buff: (t) => K.voice(400, t, 0.2, { type: "triangle", vol: 0.045, slide: 1.8 }),
  energy: (t) => K.notes(t, [880, 1320], 0.05, { type: "sine", vol: 0.045, len: 0.16 }),
  heal: (t) => K.notes(t, [660, 880, 1100], 0.05, { type: "sine", vol: 0.04, len: 0.2 }),
  kill: (t) => { K.noise(t, 0.42, { filter: "lowpass", freq: 900, slide: 0.3, vol: 0.14 }); K.voice(400, t, 0.42, { type: "triangle", vol: 0.05, slide: 0.3 }); },
  endturn: (t) => K.voice(220, t, 0.13, { type: "triangle", vol: 0.05 }),
  victory: (t) => K.notes(t, [523, 659, 784, 1046], 0.09, { duty: 0.25, vol: 0.05, len: 0.42 }),
  triumph: (t) => K.notes(t, [523, 659, 784, 1046, 1318, 1568, 2093], 0.1, { duty: 0.25, vol: 0.05, len: 0.6 }),
  defeat: (t) => K.notes(t, [392, 330, 262, 196], 0.2, { type: "triangle", vol: 0.06, len: 0.5 }),
  potion: (t) => K.notes(t, [660, 990], 0.06, { type: "sine", vol: 0.05, len: 0.22 }),
  revive: (t) => K.notes(t, [392, 523, 659, 784, 1046], 0.08, { type: "triangle", vol: 0.06, len: 0.42 }),
  relic: (t) => K.notes(t, [784, 988, 1175, 1568], 0.06, { type: "triangle", vol: 0.05, len: 0.32 }),
  pick: (t) => K.notes(t, [523, 784], 0.06, { type: "triangle", vol: 0.05, len: 0.22 }),
  upgrade: (t) => K.notes(t, [523, 659, 784, 1046], 0.05, { type: "triangle", vol: 0.05, len: 0.26 }),
  remove: (t) => K.noise(t, 0.36, { filter: "bandpass", freq: 900, slide: 0.4, vol: 0.08 }),
}, { draw: 0.03, hit: 0.03, burn: 0.05, block: 0.04, heal: 0.05, debuff: 0.04 });
K.songs({
  map: { bpm: 76, chords: ["Dm", "Bb", "F", "C"], pad: true, padVol: 0.022, arp: true, arpVol: 0.015, arpPat: [0, 1, 2, 1], arpWave: "triangle", bass: "R . . . . . . . R . . . . . . .", bassVol: 0.08 },
  fight: { bpm: 120, chords: ["Am", "F", "G", "E"], bass: "R . R O R . R O R . R O R . F .", bassWave: 0.25, bassVol: 0.09, drums: "k . h . s . h k k . h . s . h .", arp: true, arpVol: 0.016, arpPat: [0, 1, 2, 1], lead: ["a4 - c5 - e5 - d5 c5", "f5 - - - c5 - a4 -", "g4 - b4 - d5 - g5 -", "g#5 - - - e5 - - -"], leadVol: 0.032 },
  boss: { bpm: 138, chords: ["Cm", "Ab", "Bb", "G"], bass: "R R O R R O R O R R O R R O F O", bassWave: "sawtooth", bassVol: 0.07, bassLp: 800, drums: "k . h k s . h . k k h . s . h s", arp: true, arpVol: 0.018, arpPat: [0, 2, 1, 3], lead: ["c5 - eb5 - g5 - c6 -", "ab5 - - - g5 - eb5 -", "bb4 - d5 - f5 - bb5 -", "b5 - - - d6 - - -"], leadVol: 0.036 },
});

/* ================= screens ================= */
function title() {
  B = null; RUN = null; SCREEN = null; $("#app").hidden = true; aimOff(); K.playSong("map", 1);
  const s = SAVE.stats, r = SAVE.run;
  K.ui.show(`${SPIRE}<div class="logo">SPELLSPIRE</div><p class="k-sub">Climb a living tower with a deck of spells. Read your enemies' intentions, build combos, and gather relics on the way to the top.</p>
    <div class="k-menu">${r ? `<button class="k-btn primary" data-a="resume" autofocus>Continue<small>Act ${r.act} · ❤ ${r.hp}/${r.maxHp} · ${r.deck.length} cards</small></button>` : ""}<button class="k-btn${r ? "" : " primary"}" data-a="newrun"${r ? "" : " autofocus"}>New climb</button><button class="k-btn" data-a="help">How to play</button><button class="k-btn" data-a="settings">Settings</button></div>
    ${s.runs ? `<p class="k-sub">Climbs ${s.runs} · Victories ${s.wins} · Highest floor ${s.bestFloor} · ${K.fmt(s.kills)} enemies defeated</p>` : ""}`, { cls: "soft" });
}
function resume() {
  if (!SAVE.run) return title();
  RUN = clone(SAVE.run); SCREEN = null; K.ui.hide(); showMap();
  if (RUN.pending === "reward") return rewardPanel();
  if (RUN.pending === "boss") return bossReward();
  if (RUN.pending === "bosscard") return rewardCards("uncommon+", nextAct);
  if (RUN.pos && !RUN.cleared) return runNode(RUN.node);
}
function menu() {
  if (!RUN || RUN.done || K.ui.active() || (B && B.over)) return;
  if (B && B.sel) { B.sel = null; render(); }
  SCREEN = menu; K.sfx("click");
  K.ui.show(`<div class="logo sm">Paused</div><div class="k-menu"><button class="k-btn primary" data-a="close" autofocus>Resume</button><button class="k-btn" data-a="deck">View deck</button><button class="k-btn" data-a="help">How to play</button><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="abandon">Abandon climb</button><button class="k-btn" data-a="title">Save and quit</button></div>${B ? `<p class="k-sub">Quitting during a fight restarts that fight when you continue.</p>` : ""}`, { back: "close" });
}
function help() {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="back2" autofocus>Back</button></div>
    <div class="k-help"><div><b>Your turn</b>You get 3 energy and draw 5 cards. Click a card to play it; attacks that need a target ask you to click an enemy. You can also drag cards onto enemies. Unplayed cards are discarded when you end your turn.</div>
    <div><b>Intents</b>The badge above each enemy shows its next move: ⚔ attack (with damage), 🛡 block, ▲ buff, ✦ debuff. Hover it for details and plan around it.</div>
    <div><b>Block</b>${KW.Block}</div><div><b>Burn</b>${KW.Burn}</div><div><b>Frost</b>${KW.Frost}</div><div><b>Expose</b>${KW.Expose}</div><div><b>Might</b>${KW.Might}</div><div><b>Thorns</b>${KW.Thorns}</div>
    <div><b>The climb</b>Pick a path on the map: fights, elites (tougher, but they guard relics), unknown events, merchants, rest sites and treasure. Defeat the boss of each act. Three acts stand between you and the top.</div>
    <div><b>Your deck</b>After fights, add a card or skip. A lean deck draws its best spells more often. Rest sites and merchants can upgrade or remove cards.</div>
    <div class="k-kbonly"><b>Keyboard</b>1-9 picks a card · ← → choose cards or targets · Enter plays · E ends the turn · P potions · D deck · Esc menu</div><div><b>Controller</b>D-pad picks cards and targets · A plays · B cancels · X ends the turn · Y potions · Start menu</div></div>`, { back: "back2", cls: "top" });
}
function settings() {
  const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="back2">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center">${K.ui.settingsRows()}<div class="k-opt"><span>Fast animations</span><button class="k-btn small" data-a="fast">${SAVE.fast ? "On" : "Off"}</button></div></div>`, { back: "back2", cls: "top" });
  K.ui.bindSettings(s);
}
K.ui.on(async (a, d) => {
  switch (a) {
    case "newrun": {
      if (SAVE.run && !(RUN && RUN.done)) { const ok = await K.confirm({ title: "Start a new climb?", text: "Your current climb will be abandoned.", yes: "Start over", danger: true, focusNo: true }); if (!ok) return; }
      K.sfx("ok"); return newRun();
    }
    case "resume": K.sfx("ok"); return resume();
    case "close": K.sfx("back"); K.ui.hide(); SCREEN = null; if (B) render(); return;
    case "closepile": { K.sfx("back"); K.ui.hide(); const f = PILERET; PILERET = null; if (f) f(); else SCREEN = null; return; }
    case "back2": K.sfx("back"); if (RUN && !RUN.done) { K.ui.hide(); return menu(); } return title();
    case "title": K.sfx("back"); if (RUN && !B && !RUN.done) saveRun(); return title();
    case "deck": K.sfx("ok"); return viewDeck();
    case "abandon": { const ok = await K.confirm({ title: "Abandon this climb?", text: "This run will end and count as a loss.", yes: "Abandon", danger: true, focusNo: true }); if (ok) { SAVE.run = null; persist(); title(); } return; }
    case "help": K.sfx("ok"); return help();
    case "settings": K.sfx("ok"); return settings();
    case "fast": SAVE.fast = !SAVE.fast; persist(); K.sfx("ok"); return settings();
    case "cardreward": K.sfx("ok"); return rewardCards(RUN.reward ? RUN.reward.tier : "common", finishNode);
    case "skipcard": { K.sfx("back"); RUN.offer = null; const f = CARDDONE; CARDDONE = null; if (f) f(); return; }
    case "done": K.sfx("ok"); return finishNode();
    case "bossrelic": K.sfx("ok"); R_API.gainRelic(d.r); RUN.bossRelics = null; RUN.pending = "bosscard"; RUN.offer = null; saveRun(); return rewardCards("uncommon+", nextAct);
    case "restheal": R_API.heal(Math.round(RUN.maxHp * 0.3)); return finishNode();
    case "restup": K.sfx("ok"); return pickFromDeck("upgrade", finishNode, rest);
    case "pickcancel": { K.sfx("back"); const p = PICK; PICK = null; if (p && p.cancel) p.cancel(); else finishNode(); return; }
    case "buyrelic": { const r = RUN.shop.relics[+d.i]; if (r.sold || RUN.gold < r.price) return K.sfx("deny"); RUN.gold -= r.price; r.sold = true; R_API.gainRelic(r.id); K.sfx("coin"); saveRun(); return shop(); }
    case "buypot": { const p = RUN.shop.pots[+d.i]; if (p.sold || RUN.gold < p.price || RUN.potions.length >= 3) return K.sfx("deny"); RUN.gold -= p.price; p.sold = true; R_API.gainPotion(p.id); K.sfx("coin"); saveRun(); return shop(); }
    case "buyremove": if (RUN.gold < RUN.shop.remove || RUN.shop.removed) return K.sfx("deny"); K.sfx("ok"); return pickFromDeck("remove", () => { RUN.gold -= RUN.shop.remove; RUN.removes++; RUN.shop.removed = true; saveRun(); shop(); }, shop);
    case "evopt": { const o = EVENTS[RUN.evt].opts[+d.i]; if (o.if && !o.if(R_API)) return K.sfx("deny"); K.sfx("ok"); K.ui.hide(); SCREEN = null; o.f(R_API); if (!K.ui.active()) finishNode(); else saveRun(); return; }
    case "drink": K.ui.hide(); SCREEN = null; return usePotion(+d.i);
  }
});

/* ================= boot ================= */
let uiPrev = false, T = 0;
K.loop((dt) => {
  T += dt; const act = K.ui.active();
  if (!act && !uiPrev) pollPad();
  uiPrev = act;
  const em = act && $("#ui .emb"); if (em) drawEmblem(em, em.dataset.icon, em.dataset.col, T);
});
addEventListener("resize", () => { if (B) layoutHand(); });
title();
