"use strict";
/* DEEPCRAWL — a turn-based roguelike. Pick a hero, descend ten floors of a freshly carved dungeon,
   level up with perks, gather loot and defeat the Lich King. Everything is drawn in code. */
const { $, $$, clamp, TAU } = K;
const SAVE = K.load("deepcrawl.v1", { run: null, cls: "warrior", best: { depth: 0, score: 0 }, wins: 0, daily: {}, stats: { runs: 0, kills: 0, deaths: 0 } });
const persist = () => K.save("deepcrawl.v1", SAVE);
const MW = 60, MH = 40, WALL = 0, FLOOR = 1, DOOR = 2, OPEN = 3, STAIRS = 4, PORTAL = 5, LAST = 10;
const D8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const idx = (x, y) => x + y * MW, inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
let R = Math.random;
const ri = (a, b) => a + Math.floor(R() * (b - a + 1)), chance = (p) => R() < p, pickR = (a) => a[Math.floor(R() * a.length)];
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
let map = new Uint8Array(MW * MH), seen = new Uint8Array(MW * MH), vis = new Uint8Array(MW * MH), deco = new Uint8Array(MW * MH), dist = new Int16Array(MW * MH);
let G = null, P = null, MODE = "title", TGT = null, PATH = null, EXPLORING = false;

/* ================= content ================= */
const CLASSES = {
  warrior: { name: "Warrior", hp: 42, atk: [3, 6], def: 2, acc: 84, eva: 5, hpLv: 8, abil: ["cleave", "wind"], art: ["hero", "#c8ccd8", "#c43a3a", "warrior"], desc: "Tough and direct. Cleaves through crowds and catches a second wind." },
  rogue: { name: "Rogue", hp: 32, atk: [2, 5], def: 1, acc: 90, eva: 18, hpLv: 7, crit: 0.25, abil: ["dagger", "vanish"], art: ["hero", "#3a6a4a", "#2a3a2a", "rogue"], desc: "Quick and deadly. Lands critical hits, throws daggers and vanishes into the shadows." },
  mage: { name: "Mage", hp: 26, atk: [1, 4], def: 0, acc: 82, eva: 10, hpLv: 5, abil: ["firebolt", "nova"], art: ["hero", "#5a4aa8", "#3b2f6e", "mage"], desc: "Fragile but fearsome. Hurls firebolts and freezes whole rooms solid." },
};
const ABIL = {
  cleave: { name: "Cleave", cd: 5, desc: "Strike every adjacent enemy at once.", icon: "cleave" },
  wind: { name: "Second Wind", cd: 24, desc: "Recover 40% of your max HP.", icon: "heart" },
  dagger: { name: "Throw Dagger", cd: 3, target: 7, desc: "Throw a dagger at an enemy you can see. Weapon damage +4, never misses.", icon: "dagger" },
  vanish: { name: "Vanish", cd: 22, desc: "Turn invisible for 6 turns. Your next attack from the shadows deals triple damage.", icon: "vanish" },
  firebolt: { name: "Firebolt", cd: 2, target: 8, desc: "Hurl fire at an enemy you can see: 6-10 damage, growing with your level.", icon: "fire" },
  nova: { name: "Frost Nova", cd: 9, desc: "Deal 5-8 damage (more as you level) and freeze every enemy within 2 tiles for 3 turns.", icon: "snow" },
};
const MON = {
  rat: { name: "Giant Rat", hp: 6, atk: [1, 3], def: 0, acc: 70, eva: 12, xp: 2, spd: 100, d: [1, 3], w: 10, art: ["rat", "#9a8270", "#5a4a3e"] },
  bat: { name: "Cave Bat", hp: 5, atk: [1, 3], def: 0, acc: 72, eva: 25, xp: 3, spd: 160, d: [1, 4], w: 7, erratic: 0.45, art: ["wing", "#7a6aa8", "#3f3466"] },
  kobold: { name: "Kobold", hp: 9, atk: [2, 4], def: 0, acc: 74, eva: 10, xp: 4, spd: 100, d: [1, 4], w: 9, flee: true, art: ["imp", "#d9a24a", "#8a5a1a"] },
  slime: { name: "Ooze", hp: 15, atk: [2, 5], def: 1, acc: 68, eva: 0, xp: 5, spd: 70, d: [2, 5], w: 6, art: ["blob", "#6fd98a", "#2f7a45"] },
  goblin: { name: "Goblin", hp: 13, atk: [3, 5], def: 1, acc: 78, eva: 12, xp: 6, spd: 110, d: [3, 6], w: 9, flee: true, art: ["imp", "#7cc85a", "#3f7a2a"] },
  archer: { name: "Skeleton Archer", hp: 11, atk: [2, 4], def: 0, acc: 76, eva: 8, xp: 7, spd: 100, d: [3, 7], w: 7, ranged: { range: 6, atk: [3, 5], keep: 3, col: "#efe6c8", cd: 0 }, art: ["skeleton", "#e8e2d0", "#8a8270", "bow"] },
  spider: { name: "Cave Spider", hp: 12, atk: [2, 4], def: 0, acc: 80, eva: 15, xp: 7, spd: 120, d: [3, 7], w: 7, poison: 4, art: ["spider", "#5a4a6a", "#2a2032"] },
  orc: { name: "Orc Brute", hp: 24, atk: [4, 8], def: 2, acc: 76, eva: 5, xp: 12, spd: 100, d: [5, 9], w: 8, art: ["humanoid", "#6a9a4a", "#3a5a2a", "tusks"] },
  cultist: { name: "Dark Cultist", hp: 18, atk: [3, 5], def: 1, acc: 78, eva: 10, xp: 12, spd: 100, d: [5, 9], w: 6, ranged: { range: 6, atk: [5, 8], keep: 2, col: "#c06aff", cd: 2 }, art: ["humanoid", "#8a3a5a", "#3d1530", "hood"] },
  ghost: { name: "Ghost", hp: 16, atk: [3, 6], def: 0, acc: 80, eva: 35, xp: 11, spd: 100, d: [5, 9], w: 5, art: ["ghost", "#c8d8ff", "#5a6a9a"] },
  troll: { name: "Cave Troll", hp: 36, atk: [5, 9], def: 2, acc: 76, eva: 4, xp: 20, spd: 90, d: [7, 10], w: 6, regen: 1, art: ["golem", "#6a9a6a", "#2a4a2a", "tusks"] },
  wraith: { name: "Wraith", hp: 26, atk: [4, 7], def: 1, acc: 82, eva: 20, xp: 18, spd: 110, d: [7, 10], w: 6, drain: true, art: ["ghost", "#6a5a8a", "#1a1430"] },
  ogre: { name: "Ogre", hp: 44, atk: [7, 12], def: 2, acc: 72, eva: 0, xp: 24, spd: 80, d: [8, 10], w: 5, art: ["golem", "#c8a070", "#6a4a2a", "horns"] },
  demon: { name: "Lesser Demon", hp: 34, atk: [6, 10], def: 2, acc: 82, eva: 12, xp: 26, spd: 130, d: [9, 10], w: 5, art: ["demon", "#e04a3a", "#6a1a10"] },
  golem: { name: "Stone Golem", hp: 50, atk: [6, 11], def: 4, acc: 74, eva: 0, xp: 28, spd: 70, d: [9, 10], w: 4, art: ["golem", "#9aa0b0", "#4a5060"] },
  skeleton: { name: "Skeleton", hp: 20, atk: [3, 6], def: 1, acc: 76, eva: 6, xp: 5, spd: 100, d: [0, 0], w: 0, art: ["skeleton", "#e8e2d0", "#8a8270"] },
  lich: { name: "The Lich King", hp: 210, atk: [6, 10], def: 3, acc: 86, eva: 10, xp: 0, spd: 100, d: [0, 0], w: 0, boss: true, ranged: { range: 8, atk: [7, 11], keep: 0, col: "#7affd0", cd: 1 }, summon: 6, art: ["lich", "#5a3a8a", "#1a0a30"] },
};
const ITEMS = {
  heal: { name: "Healing Potion", icon: ["potion", "#ff5a6a"], desc: "Restore half of your max HP.", w: 24 },
  haste: { name: "Potion of Haste", icon: ["potion", "#6fe3d9"], desc: "Act twice as fast for 12 turns.", w: 10 },
  might: { name: "Potion of Might", icon: ["potion", "#ffb347"], desc: "Permanently deal +1 damage.", w: 7 },
  fire: { name: "Fire Flask", icon: ["flask", "#ff7a3a"], desc: "Throw at an enemy you can see: 9 damage to it and everything around it.", w: 14, target: 7 },
  tele: { name: "Scroll of Teleport", icon: ["scroll", "#9ad0ff"], desc: "Teleport to a random spot on this floor.", w: 11 },
  mapping: { name: "Scroll of Mapping", icon: ["scroll", "#ffd479"], desc: "Reveal the layout of this floor.", w: 11 },
  enchant: { name: "Scroll of Enchanting", icon: ["scroll", "#c39bff"], desc: "Improve your weapon or armor by +1.", w: 12 },
};
const ITEMORDER = Object.keys(ITEMS);
const WPN = ["Rusty Blade", "Short Sword", "Longsword", "War Axe", "Runeblade"], WPNB = [0, 1, 2, 3, 5];
const ARM = ["Tattered Cloth", "Leather Armor", "Chain Mail", "Plate Armor", "Dragonscale"], ARMB = [0, 1, 2, 3, 5];
const PERKS = {
  tough: { name: "Toughness", desc: "+8 max HP.", f: () => { P.maxHp += 8; P.hp += 8; } },
  brutal: { name: "Brutality", desc: "+1 damage on every hit.", f: () => P.dmg++ },
  precise: { name: "Precision", desc: "+8% chance to hit.", f: () => (P.acc += 8) },
  nimble: { name: "Nimble", desc: "+6% chance to dodge.", f: () => (P.eva += 6) },
  iron: { name: "Iron Skin", desc: "+1 armor.", f: () => P.def++ },
  regen: { name: "Regeneration", desc: "Heal over time twice as fast.", f: () => P.regen++ },
  vamp: { name: "Bloodthirst", desc: "Heal 2 HP whenever you slay an enemy.", f: () => (P.vamp += 2) },
  focus: { name: "Focus", desc: "Ability cooldowns are 1 turn shorter.", f: () => P.cdr++, max: 2 },
  eyes: { name: "Keen Eyes", desc: "See 2 tiles farther in the dark.", f: () => (P.sight += 2), max: 1 },
  greed: { name: "Treasure Hunter", desc: "Find 50% more gold.", f: () => (P.greed += 0.5), max: 1 },
};
const xpNeed = (l) => 15 + (l - 1) * 20;

/* ================= art ================= */
function drawCreature(g, s, art) {
  const [kind, a, b, acc] = art, cx = s / 2, cy = s * 0.6, u = s * 0.3;
  g.save(); g.lineJoin = "round"; g.lineCap = "round";
  g.fillStyle = "rgba(0,0,0,.38)"; g.beginPath(); g.ellipse(cx, s * 0.9, u * 0.95, u * 0.2, 0, 0, TAU); g.fill();
  const grad = (y0, y1, c0 = a, c1 = b) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; };
  const eyes = (y, sp = 0.3, r = 0.12, x = cx) => { for (const d of [-1, 1]) { g.fillStyle = "#fff"; g.beginPath(); g.arc(x + d * u * sp, y, u * r, 0, TAU); g.fill(); g.fillStyle = "#140c18"; g.beginPath(); g.arc(x + d * u * sp, y + u * 0.02, u * r * 0.55, 0, TAU); g.fill(); } };
  const glow = (y, sp = 0.26, col = "#ffe27a", x = cx) => { for (const d of [-1, 1]) { g.fillStyle = col; g.shadowColor = col; g.shadowBlur = s * 0.12; g.beginPath(); g.ellipse(x + d * u * sp, y, u * 0.11, u * 0.07, d * 0.3, 0, TAU); g.fill(); } g.shadowBlur = 0; };
  const outline = () => { g.strokeStyle = "rgba(10,6,14,.85)"; g.lineWidth = s * 0.03; g.stroke(); };
  if (kind === "rat") {
    g.strokeStyle = "#c08a80"; g.lineWidth = u * 0.1; g.beginPath(); g.moveTo(cx - u * 0.7, cy + u * 0.5); g.quadraticCurveTo(cx - u * 1.3, cy + u * 0.6, cx - u * 1.2, cy - u * 0.1); g.stroke();
    g.fillStyle = grad(cy - u * 0.4, cy + u * 0.8); g.beginPath(); g.ellipse(cx - u * 0.1, cy + u * 0.3, u * 0.85, u * 0.55, 0, 0, TAU); g.fill(); outline();
    g.beginPath(); g.ellipse(cx + u * 0.65, cy + u * 0.05, u * 0.45, u * 0.36, -0.3, 0, TAU); g.fill(); outline();
    g.fillStyle = "#e8a0a0"; for (const d of [-1, 1]) { g.beginPath(); g.arc(cx + u * (0.45 + d * 0.2), cy - u * 0.3, u * 0.16, 0, TAU); g.fill(); }
    g.fillStyle = "#ff8a9a"; g.beginPath(); g.arc(cx + u * 1.08, cy + u * 0.1, u * 0.08, 0, TAU); g.fill();
    g.fillStyle = "#ff3a3a"; g.beginPath(); g.arc(cx + u * 0.75, cy - u * 0.02, u * 0.08, 0, TAU); g.fill();
  } else if (kind === "blob") {
    g.fillStyle = grad(cy - u, cy + u); g.beginPath(); g.moveTo(cx - u, cy + u * 0.8); g.bezierCurveTo(cx - u * 1.1, cy - u * 0.4, cx - u * 0.5, cy - u * 1.05, cx, cy - u); g.bezierCurveTo(cx + u * 0.5, cy - u * 1.05, cx + u * 1.1, cy - u * 0.4, cx + u, cy + u * 0.8); g.closePath(); g.globalAlpha = 0.92; g.fill(); g.globalAlpha = 1; outline();
    g.fillStyle = "rgba(255,255,255,.3)"; g.beginPath(); g.ellipse(cx - u * 0.4, cy - u * 0.5, u * 0.2, u * 0.12, -0.6, 0, TAU); g.fill(); eyes(cy - u * 0.1);
  } else if (kind === "wing") {
    g.fillStyle = b; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * u * 0.3, cy - u * 0.2); g.quadraticCurveTo(cx + d * u * 1.45, cy - u * 1.0, cx + d * u * 1.4, cy + u * 0.1); g.lineTo(cx + d * u * 1.0, cy - u * 0.05); g.lineTo(cx + d * u * 0.9, cy + u * 0.25); g.lineTo(cx + d * u * 0.6, cy + u * 0.05); g.closePath(); g.fill(); outline(); }
    g.fillStyle = grad(cy - u * 0.7, cy + u * 0.6); g.beginPath(); g.ellipse(cx, cy, u * 0.5, u * 0.6, 0, 0, TAU); g.fill(); outline();
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * u * 0.15, cy - u * 0.5); g.lineTo(cx + d * u * 0.45, cy - u * 0.95); g.lineTo(cx + d * u * 0.42, cy - u * 0.4); g.fill(); }
    glow(cy - u * 0.2, 0.2, "#ffe27a");
  } else if (kind === "imp" || kind === "demon") {
    if (kind === "demon") { g.fillStyle = b; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * u * 0.3, cy - u * 0.1); g.quadraticCurveTo(cx + d * u * 1.5, cy - u * 1.1, cx + d * u * 1.3, cy + u * 0.3); g.lineTo(cx + d * u * 0.5, cy + u * 0.2); g.closePath(); g.fill(); outline(); } }
    g.fillStyle = grad(cy - u * 0.6, cy + u * 0.8); g.beginPath(); g.ellipse(cx, cy + u * 0.2, u * 0.55, u * 0.65, 0, 0, TAU); g.fill(); outline();
    g.fillStyle = kind === "demon" ? "#2a0a08" : b; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * u * 0.2, cy - u * 0.3); g.lineTo(cx + d * u * (kind === "demon" ? 0.55 : 0.65), cy - u * (kind === "demon" ? 1.05 : 0.75)); g.lineTo(cx + d * u * 0.45, cy - u * 0.2); g.fill(); }
    g.strokeStyle = b; g.lineWidth = u * 0.09; g.beginPath(); g.moveTo(cx + u * 0.45, cy + u * 0.6); g.quadraticCurveTo(cx + u * 1.05, cy + u * 0.7, cx + u * 0.95, cy + u * 0.1); g.stroke();
    glow(cy, 0.22, kind === "demon" ? "#ffd04a" : "#fff27a");
    g.strokeStyle = "#1a0a10"; g.lineWidth = u * 0.06; g.beginPath(); g.arc(cx, cy + u * 0.25, u * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  } else if (kind === "skeleton") {
    g.strokeStyle = a; g.lineWidth = u * 0.14;
    for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * u * 0.18, cy + u * 0.45); g.lineTo(cx + d * u * 0.3, cy + u * 0.95); g.stroke(); g.beginPath(); g.moveTo(cx + d * u * 0.35, cy - u * 0.15); g.lineTo(cx + d * u * 0.7, cy + u * 0.35); g.stroke(); }
    g.fillStyle = a; g.fillRect(cx - u * 0.08, cy - u * 0.2, u * 0.16, u * 0.7);
    for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(cx, cy - u * 0.05 + k * u * 0.18, u * 0.35, u * 0.07, 0, 0, TAU); g.fill(); }
    g.beginPath(); g.arc(cx, cy - u * 0.62, u * 0.38, 0, TAU); g.fill(); g.fillRect(cx - u * 0.22, cy - u * 0.4, u * 0.44, u * 0.22);
    g.fillStyle = "#140c18"; for (const d of [-1, 1]) { g.beginPath(); g.arc(cx + d * u * 0.15, cy - u * 0.62, u * 0.11, 0, TAU); g.fill(); }
    if (acc === "bow") { g.strokeStyle = "#8a5a2a"; g.lineWidth = u * 0.1; g.beginPath(); g.arc(cx + u * 0.75, cy + u * 0.1, u * 0.6, -1.2, 1.2); g.stroke(); g.strokeStyle = "#ddd"; g.lineWidth = u * 0.03; g.beginPath(); g.moveTo(cx + u * 0.75 + Math.cos(-1.2) * u * 0.6, cy + u * 0.1 + Math.sin(-1.2) * u * 0.6); g.lineTo(cx + u * 0.75 + Math.cos(1.2) * u * 0.6, cy + u * 0.1 + Math.sin(1.2) * u * 0.6); g.stroke(); }
  } else if (kind === "spider") {
    g.strokeStyle = b; g.lineWidth = u * 0.1;
    for (let k = 0; k < 4; k++) for (const d of [-1, 1]) { const y = cy + u * (-0.1 + k * 0.22); g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + d * u * 0.9, y - u * 0.55, cx + d * u * (1.05 + k * 0.05), y + u * 0.35); g.stroke(); }
    g.fillStyle = grad(cy - u * 0.5, cy + u * 0.8); g.beginPath(); g.ellipse(cx, cy + u * 0.35, u * 0.55, u * 0.48, 0, 0, TAU); g.fill(); outline();
    g.beginPath(); g.arc(cx, cy - u * 0.2, u * 0.33, 0, TAU); g.fill(); outline();
    g.fillStyle = "#ff3a4a"; for (const [dx, dy] of [[-0.14, -0.26], [0.14, -0.26], [-0.08, -0.12], [0.08, -0.12]]) { g.beginPath(); g.arc(cx + dx * u, cy + dy * u, u * 0.06, 0, TAU); g.fill(); }
  } else if (kind === "humanoid" || kind === "hero" || kind === "lich") {
    const robe = kind === "lich" ? a : kind === "hero" ? b : a;
    g.fillStyle = grad(cy - u * 0.4, cy + u, robe, kind === "hero" ? "#2a1a2a" : b); g.beginPath(); g.moveTo(cx - u * 0.72, cy + u * 0.95); g.lineTo(cx - u * 0.42, cy - u * 0.3); g.lineTo(cx + u * 0.42, cy - u * 0.3); g.lineTo(cx + u * 0.72, cy + u * 0.95); g.closePath(); g.fill(); outline();
    const head = kind === "lich" ? "#e8e2d0" : acc === "tusks" ? a : kind === "hero" ? "#f0c8a0" : "#c8a890";
    g.fillStyle = head; g.beginPath(); g.arc(cx, cy - u * 0.6, u * 0.34, 0, TAU); g.fill(); outline();
    if (kind === "lich") {
      g.fillStyle = b; g.beginPath(); g.arc(cx, cy - u * 0.65, u * 0.46, Math.PI, 0); g.lineTo(cx + u * 0.48, cy - u * 0.28); g.lineTo(cx - u * 0.48, cy - u * 0.28); g.closePath(); g.fill();
      g.fillStyle = "#e8e2d0"; g.beginPath(); g.arc(cx, cy - u * 0.56, u * 0.27, 0, TAU); g.fill(); glow(cy - u * 0.6, 0.12, "#7affd0");
      g.fillStyle = "#ffd479"; g.beginPath(); g.moveTo(cx - u * 0.42, cy - u * 1.0); for (let k = 0; k <= 4; k++) { g.lineTo(cx - u * 0.42 + k * u * 0.21, cy - u * (k % 2 ? 1.0 : 1.32)); } g.lineTo(cx + u * 0.42, cy - u * 0.9); g.lineTo(cx - u * 0.42, cy - u * 0.9); g.closePath(); g.fill();
      g.strokeStyle = "#6a4a2a"; g.lineWidth = u * 0.1; g.beginPath(); g.moveTo(cx + u * 0.85, cy + u * 0.95); g.lineTo(cx + u * 0.85, cy - u * 0.9); g.stroke();
      g.fillStyle = "#7affd0"; g.shadowColor = "#7affd0"; g.shadowBlur = s * 0.2; g.beginPath(); g.arc(cx + u * 0.85, cy - u * 1.0, u * 0.17, 0, TAU); g.fill(); g.shadowBlur = 0;
    } else if (acc === "hood") { g.fillStyle = b; g.beginPath(); g.arc(cx, cy - u * 0.64, u * 0.46, Math.PI, 0); g.lineTo(cx + u * 0.48, cy - u * 0.28); g.lineTo(cx - u * 0.48, cy - u * 0.28); g.closePath(); g.fill(); g.fillStyle = "#0d0710"; g.beginPath(); g.arc(cx, cy - u * 0.56, u * 0.28, 0, TAU); g.fill(); glow(cy - u * 0.58, 0.12, "#ff7aff"); }
    else if (acc === "tusks") { eyes(cy - u * 0.66, 0.15, 0.08); g.fillStyle = "#fff6e0"; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * u * 0.12, cy - u * 0.42); g.lineTo(cx + d * u * 0.2, cy - u * 0.65); g.lineTo(cx + d * u * 0.24, cy - u * 0.4); g.fill(); } }
    else if (acc === "warrior") {
      g.fillStyle = a; g.beginPath(); g.arc(cx, cy - u * 0.64, u * 0.4, Math.PI, 0); g.lineTo(cx + u * 0.4, cy - u * 0.38); g.lineTo(cx - u * 0.4, cy - u * 0.38); g.closePath(); g.fill(); outline();
      g.fillStyle = "#1a0f20"; g.fillRect(cx - u * 0.28, cy - u * 0.62, u * 0.56, u * 0.08); g.fillStyle = "#ffd479"; g.fillRect(cx - u * 0.05, cy - u * 1.05, u * 0.1, u * 0.3);
      g.strokeStyle = "#e8eef8"; g.lineWidth = u * 0.13; g.beginPath(); g.moveTo(cx + u * 0.75, cy + u * 0.5); g.lineTo(cx + u * 0.75, cy - u * 0.75); g.stroke(); g.strokeStyle = "#8a5a2a"; g.lineWidth = u * 0.12; g.beginPath(); g.moveTo(cx + u * 0.52, cy + u * 0.45); g.lineTo(cx + u * 0.98, cy + u * 0.45); g.stroke();
      g.fillStyle = "#7a8296"; g.beginPath(); g.arc(cx - u * 0.7, cy + u * 0.3, u * 0.32, 0, TAU); g.fill(); outline(); g.fillStyle = "#ffd479"; g.beginPath(); g.arc(cx - u * 0.7, cy + u * 0.3, u * 0.1, 0, TAU); g.fill();
    } else if (acc === "rogue") {
      g.fillStyle = a; g.beginPath(); g.arc(cx, cy - u * 0.64, u * 0.46, Math.PI, 0); g.lineTo(cx + u * 0.48, cy - u * 0.28); g.lineTo(cx - u * 0.48, cy - u * 0.28); g.closePath(); g.fill(); outline();
      g.fillStyle = "#f0c8a0"; g.beginPath(); g.arc(cx, cy - u * 0.56, u * 0.26, 0, TAU); g.fill(); g.fillStyle = "#1a0f20"; g.fillRect(cx - u * 0.26, cy - u * 0.5, u * 0.52, u * 0.14); eyes(cy - u * 0.62, 0.12, 0.07);
      g.strokeStyle = "#e8eef8"; g.lineWidth = u * 0.1; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * u * 0.62, cy + u * 0.45); g.lineTo(cx + d * u * 0.82, cy - u * 0.05); g.stroke(); }
    } else if (acc === "mage") {
      g.fillStyle = a; g.beginPath(); g.moveTo(cx - u * 0.55, cy - u * 0.75); g.lineTo(cx + u * 0.55, cy - u * 0.75); g.lineTo(cx + u * 0.08, cy - u * 1.6); g.closePath(); g.fill(); outline();
      g.fillStyle = "#ffd479"; g.beginPath(); g.arc(cx - u * 0.05, cy - u * 1.05, u * 0.06, 0, TAU); g.fill(); g.fillStyle = "#eee"; g.beginPath(); g.moveTo(cx - u * 0.24, cy - u * 0.5); g.quadraticCurveTo(cx, cy + u * 0.1, cx + u * 0.24, cy - u * 0.5); g.fill(); eyes(cy - u * 0.62, 0.12, 0.07);
      g.strokeStyle = "#8a5a2a"; g.lineWidth = u * 0.1; g.beginPath(); g.moveTo(cx + u * 0.75, cy + u * 0.95); g.lineTo(cx + u * 0.8, cy - u * 0.6); g.stroke(); g.fillStyle = "#7ad7ff"; g.shadowColor = "#7ad7ff"; g.shadowBlur = s * 0.15; g.beginPath(); g.arc(cx + u * 0.8, cy - u * 0.72, u * 0.15, 0, TAU); g.fill(); g.shadowBlur = 0;
    } else eyes(cy - u * 0.6, 0.15, 0.08);
  } else if (kind === "ghost") {
    g.fillStyle = grad(cy - u, cy + u); g.globalAlpha = 0.85; g.beginPath(); g.moveTo(cx - u * 0.7, cy + u * 0.8); g.lineTo(cx - u * 0.7, cy - u * 0.2); g.arc(cx, cy - u * 0.2, u * 0.7, Math.PI, 0); g.lineTo(cx + u * 0.7, cy + u * 0.8); for (let k = 0; k < 4; k++) g.quadraticCurveTo(cx + u * 0.7 - (k + 0.5) * u * 0.35, cy + u * (k % 2 ? 0.55 : 1.05), cx + u * 0.7 - (k + 1) * u * 0.35, cy + u * 0.8); g.fill(); g.globalAlpha = 1;
    g.fillStyle = "#0d0a1a"; for (const d of [-1, 1]) { g.beginPath(); g.ellipse(cx + d * u * 0.25, cy - u * 0.25, u * 0.12, u * 0.2, 0, 0, TAU); g.fill(); } g.beginPath(); g.ellipse(cx, cy + u * 0.15, u * 0.12, u * 0.16, 0, 0, TAU); g.fill();
  } else if (kind === "golem") {
    g.fillStyle = grad(cy - u, cy + u); K.roundRect(g, cx - u * 0.82, cy - u * 0.55, u * 1.64, u * 1.45, u * 0.16); g.fill(); outline(); K.roundRect(g, cx - u * 0.45, cy - u * 1.05, u * 0.9, u * 0.55, u * 0.12); g.fill(); outline();
    g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(cx - u * 0.82, cy + u * 0.3, u * 1.64, u * 0.08); glow(cy - u * 0.8, 0.18, acc === "tusks" ? "#ffe27a" : "#7ad7ff");
    if (acc === "tusks") { g.fillStyle = "#fff6e0"; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * u * 0.12, cy - u * 0.55); g.lineTo(cx + d * u * 0.2, cy - u * 0.8); g.lineTo(cx + d * u * 0.28, cy - u * 0.52); g.fill(); } }
    if (acc === "horns") { g.fillStyle = "#e8d8b0"; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx + d * u * 0.4, cy - u * 0.95); g.quadraticCurveTo(cx + d * u * 1.0, cy - u * 1.1, cx + d * u * 0.9, cy - u * 1.45); g.lineTo(cx + d * u * 0.35, cy - u * 0.75); g.fill(); } }
  }
  g.restore();
}
function drawItem(g, s, icon) {
  const [kind, col] = icon, cx = s / 2, cy = s / 2; g.save(); g.lineJoin = "round"; g.lineCap = "round";
  const ol = (w = s * 0.035) => { g.strokeStyle = "rgba(10,6,14,.9)"; g.lineWidth = w; g.stroke(); };
  if (kind === "potion" || kind === "flask") {
    g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(cx, s * 0.84, s * 0.2, s * 0.05, 0, 0, TAU); g.fill();
    g.fillStyle = "rgba(220,235,255,.35)"; g.beginPath(); g.arc(cx, cy + s * 0.12, s * 0.22, 0, TAU); g.fill(); ol();
    g.fillStyle = col; g.beginPath(); g.arc(cx, cy + s * 0.12, s * 0.19, 0.12 * Math.PI, 0.88 * Math.PI); g.closePath(); g.fill(); g.beginPath(); g.arc(cx, cy + s * 0.12, s * 0.19, 0, Math.PI); g.fill();
    g.fillStyle = "rgba(220,235,255,.45)"; g.fillRect(cx - s * 0.07, cy - s * 0.22, s * 0.14, s * 0.15); g.strokeStyle = "rgba(10,6,14,.9)"; g.lineWidth = s * 0.03; g.strokeRect(cx - s * 0.07, cy - s * 0.22, s * 0.14, s * 0.15);
    g.fillStyle = "#a0703a"; g.fillRect(cx - s * 0.08, cy - s * 0.3, s * 0.16, s * 0.09);
    g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(cx - s * 0.08, cy + s * 0.04, s * 0.04, s * 0.07, -0.5, 0, TAU); g.fill();
    if (kind === "flask") { g.fillStyle = "#ffd04a"; g.shadowColor = "#ff7a1a"; g.shadowBlur = s * 0.2; g.beginPath(); g.moveTo(cx, cy - s * 0.48); g.quadraticCurveTo(cx + s * 0.1, cy - s * 0.38, cx + s * 0.04, cy - s * 0.3); g.lineTo(cx - s * 0.04, cy - s * 0.3); g.quadraticCurveTo(cx - s * 0.1, cy - s * 0.38, cx, cy - s * 0.48); g.fill(); g.shadowBlur = 0; }
  } else if (kind === "scroll") {
    g.save(); g.translate(cx, cy); g.rotate(-0.35);
    g.fillStyle = "#efe0b8"; g.fillRect(-s * 0.26, -s * 0.16, s * 0.52, s * 0.32); g.strokeStyle = "rgba(10,6,14,.85)"; g.lineWidth = s * 0.03; g.strokeRect(-s * 0.26, -s * 0.16, s * 0.52, s * 0.32);
    g.fillStyle = "#d8c290"; for (const d of [-1, 1]) { g.beginPath(); g.ellipse(d * s * 0.27, 0, s * 0.06, s * 0.18, 0, 0, TAU); g.fill(); ol(s * 0.025); }
    g.strokeStyle = "#8a7a5a"; g.lineWidth = s * 0.02; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-s * 0.17, -s * 0.07 + k * s * 0.07); g.lineTo(s * 0.12, -s * 0.07 + k * s * 0.07); g.stroke(); }
    g.fillStyle = col; g.beginPath(); g.arc(s * 0.14, s * 0.1, s * 0.07, 0, TAU); g.fill(); g.restore();
  } else if (kind === "gold") {
    for (const [dx, dy] of [[-0.12, 0.12], [0.12, 0.12], [0, 0.02], [0.02, -0.08]]) { g.fillStyle = "#c8901a"; g.beginPath(); g.ellipse(cx + dx * s, cy + dy * s + s * 0.03, s * 0.15, s * 0.08, 0, 0, TAU); g.fill(); g.fillStyle = "#ffd85a"; g.beginPath(); g.ellipse(cx + dx * s, cy + dy * s, s * 0.15, s * 0.08, 0, 0, TAU); g.fill(); ol(s * 0.02); }
  } else if (kind === "wpn") {
    g.save(); g.translate(cx, cy); g.rotate(-0.78); g.fillStyle = "#e8eef8"; g.beginPath(); g.moveTo(-s * 0.05, -s * 0.12); g.lineTo(0, -s * 0.42); g.lineTo(s * 0.05, -s * 0.12); g.closePath(); g.fill(); g.fillRect(-s * 0.05, -s * 0.14, s * 0.1, s * 0.3); ol();
    g.fillStyle = col || "#ffd479"; g.fillRect(-s * 0.16, s * 0.14, s * 0.32, s * 0.06); g.fillStyle = "#6a4a2a"; g.fillRect(-s * 0.035, s * 0.2, s * 0.07, s * 0.16); g.restore();
  } else if (kind === "arm") {
    g.fillStyle = col || "#9aa0b8"; g.beginPath(); g.moveTo(cx - s * 0.3, cy - s * 0.22); g.lineTo(cx - s * 0.12, cy - s * 0.3); g.quadraticCurveTo(cx, cy - s * 0.2, cx + s * 0.12, cy - s * 0.3); g.lineTo(cx + s * 0.3, cy - s * 0.22); g.lineTo(cx + s * 0.22, cy - s * 0.02); g.lineTo(cx + s * 0.2, cy + s * 0.3); g.lineTo(cx - s * 0.2, cy + s * 0.3); g.lineTo(cx - s * 0.22, cy - s * 0.02); g.closePath(); g.fill(); ol();
    g.strokeStyle = "rgba(0,0,0,.3)"; g.lineWidth = s * 0.025; g.beginPath(); g.moveTo(cx, cy - s * 0.18); g.lineTo(cx, cy + s * 0.28); g.stroke();
  }
  g.restore();
}
function drawGlyph(g, s, kind, col = "#fff") {
  g.save(); g.translate(s / 2, s / 2); const u = s * 0.34; g.fillStyle = col; g.strokeStyle = col; g.lineWidth = u * 0.18; g.lineCap = "round"; g.lineJoin = "round";
  if (kind === "cleave") { for (const r of [0.55, 0.9]) { g.beginPath(); g.arc(0, u * 0.3, u * r, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); } g.beginPath(); g.moveTo(-u * 0.7, u * 0.8); g.lineTo(u * 0.7, -u * 0.8); g.stroke(); }
  else if (kind === "heart") { g.beginPath(); g.moveTo(0, u * 0.85); g.bezierCurveTo(-u * 1.2, -u * 0.1, -u * 0.5, -u * 1.1, 0, -u * 0.35); g.bezierCurveTo(u * 0.5, -u * 1.1, u * 1.2, -u * 0.1, 0, u * 0.85); g.fill(); }
  else if (kind === "dagger") { g.rotate(-0.78); g.beginPath(); g.moveTo(-u * 0.12, -u * 0.2); g.lineTo(0, -u); g.lineTo(u * 0.12, -u * 0.2); g.closePath(); g.fill(); g.fillRect(-u * 0.35, -u * 0.2, u * 0.7, u * 0.14); g.fillRect(-u * 0.08, -u * 0.08, u * 0.16, u * 0.6); }
  else if (kind === "vanish") { g.globalAlpha = 0.5; g.beginPath(); g.arc(-u * 0.25, 0, u * 0.65, 0, TAU); g.fill(); g.globalAlpha = 1; g.beginPath(); g.moveTo(-u, 0); g.quadraticCurveTo(0, -u * 0.8, u, 0); g.quadraticCurveTo(0, u * 0.8, -u, 0); g.stroke(); g.beginPath(); g.moveTo(-u * 0.9, u * 0.9); g.lineTo(u * 0.9, -u * 0.9); g.stroke(); }
  else if (kind === "fire") { g.scale(u, u); g.beginPath(); g.moveTo(0, -1); g.bezierCurveTo(0.7, -0.3, 0.8, 0.4, 0.45, 0.8); g.quadraticCurveTo(0, 1.05, -0.45, 0.8); g.bezierCurveTo(-0.8, 0.4, -0.5, -0.1, -0.2, -0.3); g.quadraticCurveTo(-0.1, 0.1, 0.05, 0.15); g.quadraticCurveTo(0.2, -0.4, 0, -1); g.fill(); }
  else if (kind === "snow") { for (let k = 0; k < 3; k++) { g.save(); g.rotate((k * Math.PI) / 3); g.beginPath(); g.moveTo(0, -u); g.lineTo(0, u); g.moveTo(-u * 0.3, -u * 0.65); g.lineTo(0, -u * 0.4); g.lineTo(u * 0.3, -u * 0.65); g.moveTo(-u * 0.3, u * 0.65); g.lineTo(0, u * 0.4); g.lineTo(u * 0.3, u * 0.65); g.stroke(); g.restore(); } }
  else if (kind === "wait") { g.beginPath(); g.arc(0, 0, u * 0.85, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(0, -u * 0.5); g.lineTo(0, 0); g.lineTo(u * 0.4, u * 0.25); g.stroke(); }
  else if (kind === "explore") { g.beginPath(); g.arc(-u * 0.15, -u * 0.15, u * 0.55, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(u * 0.25, u * 0.25); g.lineTo(u * 0.85, u * 0.85); g.stroke(); }
  else if (kind === "map") { g.beginPath(); g.moveTo(-u, -u * 0.7); g.lineTo(-u * 0.33, -u * 0.9); g.lineTo(u * 0.33, -u * 0.7); g.lineTo(u, -u * 0.9); g.lineTo(u, u * 0.7); g.lineTo(u * 0.33, u * 0.9); g.lineTo(-u * 0.33, u * 0.7); g.lineTo(-u, u * 0.9); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-u * 0.33, -u * 0.9); g.lineTo(-u * 0.33, u * 0.7); g.moveTo(u * 0.33, -u * 0.7); g.lineTo(u * 0.33, u * 0.9); g.stroke(); }
  g.restore();
}
/* tiles are cached at the current tile size */
let TS = 40, DPR = 1, TILES = {}, SPR = {};
function mkCanvas(fn, size = TS) { const c = document.createElement("canvas"), px = Math.max(8, Math.round(size * DPR)); c.width = c.height = px; fn(c.getContext("2d"), px); return c; }
function floorArt(g, s, v) {
  const r = K.RNG(101 + v * 57); g.fillStyle = "#1c1724"; g.fillRect(0, 0, s, s);
  const h = s / 2; for (const [x, y] of [[0, 0], [h, 0], [0, h], [h, h]]) { g.fillStyle = `hsl(262, 13%, ${13.5 + r() * 4}%)`; g.fillRect(x + s * 0.03, y + s * 0.03, h - s * 0.06, h - s * 0.06); g.fillStyle = "rgba(255,255,255,.035)"; g.fillRect(x + s * 0.03, y + s * 0.03, h - s * 0.06, s * 0.03); }
  for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${0.05 + r() * 0.06})`; g.fillRect(r() * s, r() * s, s * 0.05, s * 0.05); }
  if (v === 2) { g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = s * 0.025; g.beginPath(); g.moveTo(s * 0.2, s * 0.3); g.lineTo(s * 0.42, s * 0.48); g.lineTo(s * 0.38, s * 0.7); g.lineTo(s * 0.6, s * 0.85); g.stroke(); }
  if (v === 3) for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(90,${150 + r() * 60},90,${0.25 + r() * 0.25})`; g.beginPath(); g.arc(s * (0.15 + r() * 0.7), s * (0.15 + r() * 0.7), s * (0.03 + r() * 0.04), 0, TAU); g.fill(); }
}
function wallArt(g, s, front) {
  g.fillStyle = "#3d3352"; g.fillRect(0, 0, s, s);
  g.strokeStyle = "rgba(0,0,0,.28)"; g.lineWidth = Math.max(1, s * 0.03);
  const top = front ? s * 0.56 : s;
  for (let row = 0; row < 4; row++) { const y = (row * s) / 4; if (y >= top) break; g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); const off = row % 2 ? s / 4 : 0; for (let x = off; x < s; x += s / 2) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, Math.min(y + s / 4, top)); g.stroke(); } }
  g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(0, 0, s, s * 0.04);
  if (front) {
    const fy = s * 0.56; g.fillStyle = "#251e33"; g.fillRect(0, fy, s, s - fy); g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(0, fy, s, s * 0.035);
    g.strokeStyle = "rgba(0,0,0,.35)"; for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(0, fy + ((s - fy) * k) / 3); g.lineTo(s, fy + ((s - fy) * k) / 3); g.stroke(); }
    for (let x = s * 0.25; x < s; x += s * 0.5) { g.beginPath(); g.moveTo(x, fy); g.lineTo(x, fy + (s - fy) / 3); g.stroke(); }
    g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, s * 0.94, s, s * 0.06);
  }
}
function doorArt(g, s, open) {
  floorArt(g, s, 0);
  if (open) { g.fillStyle = "#120d18"; g.fillRect(s * 0.12, 0, s * 0.76, s); g.fillStyle = "#6a4426"; g.fillRect(0, 0, s * 0.14, s); g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(s * 0.1, 0, s * 0.05, s); return; }
  g.fillStyle = "#5a3a20"; g.fillRect(s * 0.06, 0, s * 0.88, s); g.fillStyle = "#7a5030"; for (let k = 0; k < 4; k++) g.fillRect(s * (0.1 + k * 0.21), s * 0.04, s * 0.17, s * 0.92);
  g.fillStyle = "#3a3a44"; g.fillRect(s * 0.06, s * 0.2, s * 0.88, s * 0.08); g.fillRect(s * 0.06, s * 0.7, s * 0.88, s * 0.08);
  g.fillStyle = "#ffd479"; g.beginPath(); g.arc(s * 0.74, s * 0.5, s * 0.05, 0, TAU); g.fill();
}
function stairsArt(g, s) {
  floorArt(g, s, 1);
  for (let k = 0; k < 5; k++) { const y = s * (0.12 + k * 0.16), inset = s * (0.08 + k * 0.05); g.fillStyle = `hsl(262, 16%, ${30 - k * 5.5}%)`; g.fillRect(inset, y, s - inset * 2, s * 0.16); g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(inset, y, s - inset * 2, s * 0.025); }
  g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(s * 0.33, s * 0.82, s * 0.34, s * 0.12);
}
function buildArt() {
  DPR = K.dpr(); TILES = { floor: [0, 1, 2, 3].map((v) => mkCanvas((g, s) => floorArt(g, s, v))), wall: mkCanvas((g, s) => wallArt(g, s, false)), wallF: mkCanvas((g, s) => wallArt(g, s, true)), door: mkCanvas((g, s) => doorArt(g, s, false)), open: mkCanvas((g, s) => doorArt(g, s, true)), stairs: mkCanvas(stairsArt) };
  SPR = {};
}
function sprite(key, fn) { if (!SPR[key]) SPR[key] = mkCanvas(fn, TS * 1.5); return SPR[key]; }
const monSprite = (type) => sprite("m:" + type, (g, s) => drawCreature(g, s, MON[type].art));
const heroSprite = (cls) => sprite("h:" + cls, (g, s) => drawCreature(g, s, CLASSES[cls].art));
const itemSprite = (icon) => sprite("i:" + icon.join(), (g, s) => drawItem(g, s, icon));
const itemIcon = (it) => (it.kind === "gold" ? ["gold"] : it.kind === "wpn" ? ["wpn", ["#c8c8d0", "#c8c8d0", "#ffd479", "#ff9a4a", "#7affd0"][it.tier]] : it.kind === "arm" ? ["arm", ["#8a7a6a", "#a0703a", "#9aa0b8", "#c8ccd8", "#e0603a"][it.tier]] : ITEMS[it.id].icon);

/* ================= dungeon generation ================= */
function genFloor(depth) {
  R = K.RNG(K.hash(G.seed + ":" + depth));
  map.fill(WALL); seen.fill(0); vis.fill(0);
  for (let i = 0; i < map.length; i++) deco[i] = R() < 0.07 ? 3 : R() < 0.1 ? 2 : R() < 0.5 ? 1 : 0;
  G.mons = []; G.items = []; G.depth = depth; G.turnFloor = 0; G.bossDead = false; G.stairs = null;
  const carve = (x, y, t = FLOOR) => { if (x > 0 && y > 0 && x < MW - 1 && y < MH - 1) map[idx(x, y)] = t; };
  const rooms = [];
  if (depth === LAST) {
    const ar = { x: 18, y: 8, w: 30, h: 22 }; rooms.push({ x: 4, y: 16, w: 7, h: 7 }, ar);
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y);
    for (let x = 11; x < 18; x++) for (let y = 19; y <= 20; y++) carve(x, y);
    for (const [px, py] of [[23, 13], [42, 13], [23, 24], [42, 24], [30, 12], [35, 12], [30, 25], [35, 25]]) { map[idx(px, py)] = WALL; map[idx(px + 1, py)] = WALL; }
    map[idx(17, 19)] = DOOR;
    G.start = { x: 7, y: 19 };
    spawn("lich", 44, 19, false); spawn("skeleton", 41, 16, false); spawn("skeleton", 41, 22, false);
    for (let k = 0; k < 2; k++) G.items.push({ x: 5 + k * 3, y: 17, kind: "item", id: k ? "heal" : "fire" });
  } else {
    for (let t = 0; t < 400 && rooms.length < 12; t++) {
      const w = ri(5, 11), h = ri(4, 8), x = ri(1, MW - w - 2), y = ri(1, MH - h - 2);
      if (rooms.some((r) => x - 2 < r.x + r.w && x + w + 2 > r.x && y - 2 < r.y + r.h && y + h + 2 > r.y)) continue;
      rooms.push({ x, y, w, h });
    }
    for (const r of rooms) { r.cx = r.x + (r.w >> 1); r.cy = r.y + (r.h >> 1); for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y); }
    const corridor = (a, b) => { let x = a.cx, y = a.cy; const hf = chance(0.5); const stepX = () => { while (x !== b.cx) { carve(x, y); x += Math.sign(b.cx - x); } }, stepY = () => { while (y !== b.cy) { carve(x, y); y += Math.sign(b.cy - y); } }; if (hf) { stepX(); stepY(); } else { stepY(); stepX(); } carve(x, y); };
    const inTree = [0], edges = [];
    while (inTree.length < rooms.length) { let best = null; for (const i of inTree) for (let j = 0; j < rooms.length; j++) { if (inTree.includes(j)) continue; const d = Math.abs(rooms[i].cx - rooms[j].cx) + Math.abs(rooms[i].cy - rooms[j].cy); if (!best || d < best.d) best = { i, j, d }; } inTree.push(best.j); edges.push([best.i, best.j]); }
    for (let k = 0; k < 3; k++) { const i = ri(0, rooms.length - 1), j = ri(0, rooms.length - 1); if (i !== j) edges.push([i, j]); }
    for (const [i, j] of edges) corridor(rooms[i], rooms[j]);
    for (const r of rooms) if (r.w >= 9 && r.h >= 7 && chance(0.35)) for (const [px, py] of [[r.x + 2, r.y + 2], [r.x + r.w - 3, r.y + 2], [r.x + 2, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]]) map[idx(px, py)] = WALL;
    for (const r of rooms) for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) continue;
      if (!inb(x, y) || map[idx(x, y)] !== FLOOR) continue;
      const w = (dx, dy) => !inb(x + dx, y + dy) || map[idx(x + dx, y + dy)] === WALL;
      if (((w(-1, 0) && w(1, 0)) || (w(0, -1) && w(0, 1))) && chance(0.4)) map[idx(x, y)] = DOOR;
    }
    const s0 = rooms[0]; G.start = { x: s0.cx, y: s0.cy };
    bfs(G.start.x, G.start.y, true);
    let far = rooms[1] || s0; for (const r of rooms) if (dist[idx(r.cx, r.cy)] > dist[idx(far.cx, far.cy)] && dist[idx(r.cx, r.cy)] < 9999) far = r;
    map[idx(far.cx, far.cy)] = STAIRS; G.stairs = { x: far.cx, y: far.cy };
    const pool = Object.entries(MON).filter(([, m]) => depth >= m.d[0] && depth <= m.d[1]);
    const budget = 5 + Math.round(depth * 1.5);
    for (let n = 0, tries = 0; n < budget && tries < 500; tries++) {
      const r = rooms[ri(1, rooms.length - 1)]; if (!r) break; const x = ri(r.x, r.x + r.w - 1), y = ri(r.y, r.y + r.h - 1);
      if (map[idx(x, y)] !== FLOOR || monAt(x, y) || cheb({ x, y }, G.start) < 6) continue;
      let tot = pool.reduce((s, [, m]) => s + m.w, 0), q = R() * tot, type = pool[0][0]; for (const [k, m] of pool) { q -= m.w; if (q <= 0) { type = k; break; } }
      spawn(type, x, y, chance(0.5)); n++;
    }
    const spot = () => { for (let t = 0; t < 200; t++) { const r = pickR(rooms), x = ri(r.x, r.x + r.w - 1), y = ri(r.y, r.y + r.h - 1); if (map[idx(x, y)] === FLOOR && !itemAt(x, y) && !(x === G.start.x && y === G.start.y)) return { x, y }; } return null; };
    for (let k = ri(4, 6); k > 0; k--) { const p = spot(); if (p) G.items.push({ ...p, kind: "gold", amt: ri(4, 10) + depth * 3 }); }
    const tot = ITEMORDER.reduce((s, id) => s + ITEMS[id].w, 0);
    for (let k = ri(3, 5); k > 0; k--) { const p = spot(); if (!p) continue; let q = R() * tot, id = "heal"; for (const it of ITEMORDER) { q -= ITEMS[it].w; if (q <= 0) { id = it; break; } } G.items.push({ ...p, kind: "item", id }); }
    if (chance(depth === 1 ? 0.9 : 0.65)) { const p = spot(); if (p) G.items.push({ ...p, kind: chance(0.5) ? "wpn" : "arm", tier: clamp(Math.floor(depth / 2.4) + (chance(0.3) ? 1 : 0), 1, 4) }); }
  }
  P.x = G.start.x; P.y = G.start.y; P.dx = P.x; P.dy = P.y;
  G.cam = null; computeFov(); bfs(P.x, P.y);
}
function spawn(type, x, y, asleep) {
  const D = MON[type], over = D.boss || !D.d[0] ? 0 : Math.max(0, G.depth - D.d[0]), hp = Math.round(D.hp * (1 + 0.08 * over));
  const m = { id: ++G.uid, type, x, y, dx: x, dy: y, hp, maxHp: hp, dmgUp: Math.floor(over / 2), energy: R() * 100, asleep, alert: !asleep, frozen: 0, poison: 0, rcd: 0, scd: 3, flash: 0, bump: null, tcd: 0 };
  G.mons.push(m); return m;
}
const monAt = (x, y) => G.mons.find((m) => !m.dead && m.x === x && m.y === y);
const itemAt = (x, y) => G.items.find((it) => it.x === x && it.y === y);
const passable = (x, y) => inb(x, y) && map[idx(x, y)] !== WALL;
const opaque = (x, y) => !inb(x, y) || map[idx(x, y)] === WALL || map[idx(x, y)] === DOOR;

/* ================= sight & paths ================= */
const MULT = [[1, 0, 0, -1, -1, 0, 0, 1], [0, 1, -1, 0, 0, -1, 1, 0], [0, 1, 1, 0, 0, -1, -1, 0], [1, 0, 0, 1, -1, 0, 0, -1]];
function computeFov() {
  vis.fill(0); const r = P.sight + (G.depth === LAST ? 3 : 0);
  const mark = (x, y) => { if (inb(x, y)) { vis[idx(x, y)] = 1; seen[idx(x, y)] = 1; } };
  mark(P.x, P.y);
  for (let o = 0; o < 8; o++) cast(P.x, P.y, 1, 1, 0, r, MULT[0][o], MULT[1][o], MULT[2][o], MULT[3][o], mark);
}
function cast(cx, cy, row, start, end, radius, xx, xy, yx, yy, mark) {
  if (start < end) return; const r2 = (radius + 0.5) * (radius + 0.5); let newStart = 0;
  for (let j = row; j <= radius; j++) {
    let dx = -j - 1; const dy = -j; let blocked = false;
    while (dx <= 0) {
      dx++; const X = cx + dx * xx + dy * xy, Y = cy + dx * yx + dy * yy, lS = (dx - 0.5) / (dy + 0.5), rS = (dx + 0.5) / (dy - 0.5);
      if (start < rS) continue; if (end > lS) break;
      if (dx * dx + dy * dy < r2) mark(X, Y);
      if (blocked) { if (opaque(X, Y)) { newStart = rS; continue; } blocked = false; start = newStart; }
      else if (opaque(X, Y) && j < radius) { blocked = true; cast(cx, cy, j + 1, start, lS, radius, xx, xy, yx, yy, mark); newStart = rS; }
    }
    if (blocked) break;
  }
}
function los(ax, ay, bx, by) {
  let x = ax, y = ay; const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1; let err = dx + dy;
  while (!(x === bx && y === by)) { const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } if (x === bx && y === by) break; if (opaque(x, y)) return false; }
  return true;
}
function bfs(sx, sy, ignoreMons) {
  dist.fill(9999); const q = [idx(sx, sy)]; dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % MW, y = (i / MW) | 0, d = dist[i] + 1; for (const [ox, oy] of D8) { const nx = x + ox, ny = y + oy; if (!passable(nx, ny)) continue; const ni = idx(nx, ny); if (dist[ni] <= d) continue; dist[ni] = d; q.push(ni); } }
  void ignoreMons;
}
/* player paths only walk on explored ground and stop next to monsters */
function findPath(tx, ty, goal) {
  const prev = new Int32Array(MW * MH).fill(-1), start = idx(P.x, P.y), q = [start]; prev[start] = start;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MW, y = (i / MW) | 0;
    if (goal ? goal(x, y) : x === tx && y === ty) { const out = []; let c = i; while (c !== start) { out.push([c % MW, (c / MW) | 0]); c = prev[c]; } return out.reverse(); }
    for (const [ox, oy] of D8) { const nx = x + ox, ny = y + oy; if (!passable(nx, ny) || !seen[idx(nx, ny)]) continue; const ni = idx(nx, ny); if (prev[ni] !== -1) continue; const m = monAt(nx, ny); if (m && vis[ni] && !(nx === tx && ny === ty)) continue; prev[ni] = i; q.push(ni); }
  }
  return null;
}

/* ================= player ================= */
function newPlayer(cls) {
  const C = CLASSES[cls];
  return { cls, x: 0, y: 0, dx: 0, dy: 0, hp: C.hp, maxHp: C.hp, lvl: 1, xp: 0, gold: 0, acc: C.acc, eva: C.eva, def: C.def, dmg: 0, regen: 0, vamp: 0, cdr: 0, sight: 7, greed: 0, wpn: 0, wpnE: 0, arm: 0, armE: 0, inv: { heal: 1 }, cd: {}, haste: 0, invis: 0, poison: 0, kills: 0, regAcc: 0, perks: {}, flash: 0, bump: null, turns: 0 };
}
const pAtk = () => { const b = WPNB[P.wpn] + P.wpnE + P.dmg, a = CLASSES[P.cls].atk; return [a[0] + b, a[1] + b]; };
const pDef = () => P.def + ARMB[P.arm] + P.armE;
function msg(text, col = "#e8e2f4") { G.log.push({ text, col, t: performance.now() }); if (G.log.length > 40) G.log.shift(); renderLog(); }
function float(x, y, text, col, big) { FX.floats.push({ x, y, text, col, t: 0, big }); }
function burst(x, y, col, n = 12, spd = 3) { for (let i = 0; i < n; i++) { const a = R() * TAU, v = (0.4 + Math.random()) * spd; FX.parts.push({ x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, t: 0, life: 0.5 + Math.random() * 0.4, col }); } }
function shot(x0, y0, x1, y1, col, kind = "bolt") { FX.shots.push({ x0: x0 + 0.5, y0: y0 + 0.5, x1: x1 + 0.5, y1: y1 + 0.5, col, kind, t: 0, dur: Math.max(0.12, Math.hypot(x1 - x0, y1 - y0) * 0.035) }); }
function bumpAnim(e, dx, dy) { e.bump = { x: clamp(dx, -1, 1), y: clamp(dy, -1, 1), t: 0 }; }
function gainXp(n) { P.xp += n; }
function checkLevel() {
  if (P.xp < xpNeed(P.lvl) || MODE !== "play") return;
  P.xp -= xpNeed(P.lvl); P.lvl++; const C = CLASSES[P.cls];
  P.maxHp += C.hpLv; P.hp = Math.min(P.maxHp, P.hp + C.hpLv + Math.round(P.maxHp * 0.25)); P.acc += 1;
  K.sfx("level"); burst(P.x, P.y, "#ffd479", 24, 4); float(P.x, P.y, "LEVEL UP!", "#ffd479", true); msg(`You reach level ${P.lvl}!`, "#ffd479");
  perkChoice();
}
function perkChoice() {
  const avail = Object.keys(PERKS).filter((k) => !PERKS[k].max || (P.perks[k] || 0) < PERKS[k].max), opts = [];
  while (opts.length < 3 && avail.length) opts.push(avail.splice(Math.floor(Math.random() * avail.length), 1)[0]);
  MODE = "perk"; PATH = null; EXPLORING = false;
  K.ui.show(`<div class="logo sm">Level ${P.lvl}</div><p class="k-sub">Your max HP rises. Choose a perk.</p><div class="perks">${opts.map((k, i) => `<button class="k-btn perk" data-a="perk" data-k="${k}"${i ? "" : " autofocus"}><b>${PERKS[k].name}</b><small>${PERKS[k].desc}</small>${P.perks[k] ? `<small>Owned ×${P.perks[k]}</small>` : ""}</button>`).join("")}</div>`, { cls: "soft" });
}
function heal(n) { const h = Math.max(0, Math.min(n, P.maxHp - P.hp)); P.hp += h; if (h) float(P.x, P.y, "+" + h, "#6fe39a"); return h; }
function hurtP(n, src) {
  P.hp -= n; P.flash = 0.18; float(P.x, P.y, "-" + n, "#ff6b6b", n >= 10); K.sfx("hurt"); FX.shake = Math.min(10, 2 + n * 0.5); K.vibrate(n >= 8 ? 60 : 30);
  if (P.hp <= 0) G.killer = src;
  PATH = null; EXPLORING = false;
}
function hurtMon(m, n, col = "#fff", big) {
  m.hp -= n; m.flash = 0.16; float(m.x, m.y, "-" + n, col, big); wake(m);
  if (m.hp <= 0) killMon(m); else K.sfx("hit");
}
function wake(m) { if (m.asleep) { m.asleep = false; } m.alert = true; }
function killMon(m) {
  const D = MON[m.type]; m.dead = true; P.kills++; G.kills++; SAVE.stats.kills++; gainXp(m.summoned ? 1 : D.xp); K.sfx(D.boss ? "bossdie" : "kill");
  burst(m.x, m.y, D.art[1], D.boss ? 60 : 16, D.boss ? 6 : 3); if (vis[idx(m.x, m.y)]) msg(`The ${D.name} dies.`, "#c8bfe0");
  if (P.vamp) heal(P.vamp);
  if (D.boss) {
    G.bossDead = true; map[idx(m.x, m.y)] = PORTAL; msg("The Lich King crumbles. A portal opens where he stood!", "#7affd0"); K.banner("The Lich King falls", "Step into the portal to escape", 3000); FX.shake = 14;
    for (const o of G.mons) if (!o.dead && o.type === "skeleton") { o.dead = true; burst(o.x, o.y, "#e8e2d0", 10); }
  } else if (chance(0.16) && !itemAt(m.x, m.y) && map[idx(m.x, m.y)] === FLOOR) {
    if (chance(0.55)) G.items.push({ x: m.x, y: m.y, kind: "gold", amt: ri(3, 8) + G.depth * 2 }); else G.items.push({ x: m.x, y: m.y, kind: "item", id: pickR(["heal", "heal", "fire", "tele", "enchant", "haste"]) });
  }
}
function attackMon(m, opt = {}) {
  const D = MON[m.type], C = CLASSES[P.cls]; bumpAnim(P, m.x - P.x, m.y - P.y);
  const stealth = P.invis > 0;
  if (!opt.sure && !stealth && !m.asleep && !m.frozen && R() * 100 >= clamp(P.acc - D.eva, 10, 97)) { float(m.x, m.y, "miss", "#b8b0c8"); K.sfx("miss"); wake(m); return; }
  const [a, b] = pAtk(); let dmg = ri(a, b) + (opt.bonus || 0), col = "#fff", big = false;
  if (stealth) { dmg *= 3; P.invis = 0; col = "#c39bff"; big = true; msg("You strike from the shadows!", "#c39bff"); }
  else if (C.crit && R() < C.crit) { dmg *= 2; col = "#ffd479"; big = true; }
  else if (m.asleep) { dmg = Math.round(dmg * 1.5); }
  hurtMon(m, Math.max(1, dmg - D.def), col, big);
}
function monAttack(m) {
  const D = MON[m.type]; bumpAnim(m, P.x - m.x, P.y - m.y);
  if (R() * 100 >= clamp(D.acc - P.eva, 8, 95)) { float(P.x, P.y, "dodge", "#9ad0ff"); K.sfx("miss"); return; }
  const dmg = Math.max(1, ri(D.atk[0], D.atk[1]) + (m.dmgUp || 0) - pDef()); hurtP(dmg, D.name);
  if (D.poison && chance(0.45)) { P.poison = Math.max(P.poison, D.poison); msg("You are poisoned!", "#9aff6a"); }
  if (D.drain) { const h = Math.min(m.maxHp - m.hp, Math.ceil(dmg / 2)); if (h > 0) { m.hp += h; float(m.x, m.y, "+" + h, "#c39bff"); } }
}
function monShoot(m) {
  const D = MON[m.type], r = D.ranged; shot(m.x, m.y, P.x, P.y, r.col, D.boss || m.type === "cultist" ? "orb" : "arrow"); K.sfx(m.type === "archer" ? "bow" : "zap"); m.rcd = r.cd;
  if (R() * 100 >= clamp(D.acc - P.eva, 8, 95)) { float(P.x, P.y, "dodge", "#9ad0ff"); return; }
  hurtP(Math.max(1, ri(r.atk[0], r.atk[1]) - pDef()), D.name);
}

/* ================= monsters ================= */
function stepMon(m, nx, ny) {
  if (!passable(nx, ny) || monAt(nx, ny) || (nx === P.x && ny === P.y)) return false;
  if (map[idx(nx, ny)] === DOOR) map[idx(nx, ny)] = OPEN;
  m.x = nx; m.y = ny; return true;
}
function monAct(m) {
  const D = MON[m.type];
  if (D.regen && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + D.regen);
  if (m.poison > 0) { m.poison--; hurtMon(m, 1, "#9aff6a"); if (m.dead) return; }
  if (m.frozen > 0) { m.frozen--; return; }
  if (m.rcd > 0) m.rcd--; if (m.tcd > 0) m.tcd--;
  const seen2 = vis[idx(m.x, m.y)] && P.invis <= 0, d = cheb(m, P);
  if (m.asleep) { if (seen2 && R() < (d <= 3 ? 0.5 : 0.18)) { m.asleep = false; m.alert = true; if (vis[idx(m.x, m.y)]) float(m.x, m.y, "!", "#ffd479", true); } return; }
  if (P.invis > 0) { if (d === 1 && chance(0.25)) return monAttack(m); const [ox, oy] = pickR(D8); stepMon(m, m.x + ox, m.y + oy); return; }
  if (seen2) m.alert = true;
  if (!m.alert) { if (chance(0.25)) { const [ox, oy] = pickR(D8); stepMon(m, m.x + ox, m.y + oy); } return; }
  if (D.erratic && chance(D.erratic)) { const [ox, oy] = pickR(D8); if (m.x + ox === P.x && m.y + oy === P.y) return monAttack(m); stepMon(m, m.x + ox, m.y + oy); return; }
  if (D.summon && seen2) { m.scd--; const sk = G.mons.filter((o) => !o.dead && o.type === "skeleton").length; if (m.scd <= 0 && sk < 3) { m.scd = D.summon; let n = 0; for (const [ox, oy] of K.shuffle(D8.slice(), R)) { if (n >= Math.min(2, 3 - sk)) break; const x = m.x + ox * 2, y = m.y + oy * 2; if (passable(x, y) && !monAt(x, y) && !(x === P.x && y === P.y)) { const s = spawn("skeleton", x, y, false); s.energy = 0; s.summoned = true; burst(x, y, "#7affd0", 12); n++; } } if (n) { K.sfx("summon"); msg("The Lich King raises the dead!", "#7affd0"); return; } } }
  if (D.boss && d === 1 && m.hp < m.maxHp * 0.6 && m.tcd <= 0 && (m.teles || 0) < 3) { m.teles = (m.teles || 0) + 1; for (let t = 0; t < 40; t++) { const x = ri(19, 46), y = ri(9, 28); if (passable(x, y) && !monAt(x, y) && Math.hypot(x - P.x, y - P.y) > 7) { burst(m.x, m.y, "#7affd0", 20); m.x = m.dx = x; m.y = m.dy = y; burst(x, y, "#7affd0", 20); m.tcd = 7; K.sfx("blink"); msg("The Lich King blinks away!", "#7affd0"); return; } } }
  if (D.flee && !seen2 && m.hp < m.maxHp && G.turnFloor % 4 === 0) m.hp++;
  if (D.flee && m.hp < m.maxHp * 0.3 && seen2 && d <= 6) { let best = null; for (const [ox, oy] of D8) { const nx = m.x + ox, ny = m.y + oy; if (!passable(nx, ny) || monAt(nx, ny)) continue; const v = dist[idx(nx, ny)]; if (v < 9999 && (!best || v > best.v)) best = { nx, ny, v }; } if (best && best.v > dist[idx(m.x, m.y)]) { stepMon(m, best.nx, best.ny); return; } }
  if (D.ranged && seen2 && d > 1 && d <= D.ranged.range && los(m.x, m.y, P.x, P.y)) {
    if (d < D.ranged.keep && chance(0.6)) { let best = null; for (const [ox, oy] of D8) { const nx = m.x + ox, ny = m.y + oy; if (!passable(nx, ny) || monAt(nx, ny)) continue; const v = dist[idx(nx, ny)]; if (v < 9999 && v > dist[idx(m.x, m.y)] && (!best || v > best.v)) best = { nx, ny, v }; } if (best) { stepMon(m, best.nx, best.ny); return; } }
    if (m.rcd <= 0) return monShoot(m);
  }
  if (d === 1) return monAttack(m);
  if (dist[idx(m.x, m.y)] > 26 && !seen2) { const [ox, oy] = pickR(D8); stepMon(m, m.x + ox, m.y + oy); return; }
  let best = null; for (const [ox, oy] of D8) { const nx = m.x + ox, ny = m.y + oy; if (!passable(nx, ny) || monAt(nx, ny)) continue; const v = dist[idx(nx, ny)] + (ox && oy ? 0.01 : 0); if (!best || v < best.v) best = { nx, ny, v }; }
  if (best && best.v < dist[idx(m.x, m.y)]) stepMon(m, best.nx, best.ny);
}

/* ================= turns ================= */
function endTurn() {
  const t = P.haste > 0 ? 0.5 : 1; P.turns++; G.turnFloor++;
  if (P.haste > 0 && --P.haste === 0) msg("Your speed returns to normal.");
  if (P.invis > 0 && --P.invis === 0) msg("You fade back into view.");
  if (P.poison > 0) { P.poison--; hurtP(1, "poison"); }
  for (const k in P.cd) if (P.cd[k] > 0) P.cd[k]--;
  P.regAcc += ((1 + P.regen) * t) / 11; while (P.regAcc >= 1) { P.regAcc--; if (P.hp > 0 && P.hp < P.maxHp) P.hp++; }
  computeFov(); bfs(P.x, P.y);
  for (const m of G.mons) { if (m.dead) continue; m.energy += MON[m.type].spd * t; while (m.energy >= 100 && !m.dead && P.hp > 0) { m.energy -= 100; monAct(m); } if (P.hp <= 0) break; }
  G.mons = G.mons.filter((m) => !m.dead);
  if (G.depth < LAST && G.turnFloor > 150 && G.turnFloor % 45 === 0 && (G.wander || 0) < 5) wanderer();
  computeFov();
  if (P.hp <= 0) return die();
  checkLevel(); hud();
  if (PATH || EXPLORING) { const vm = visibleMons(); if (vm.some((m) => (!PATHSEEN.has(m.id) && (!m.asleep || cheb(m, P) <= 2)) || (!m.asleep && cheb(m, P) <= 1))) { PATH = null; EXPLORING = false; } }
}
let PATHSEEN = new Set();
const setPath = (p, exploring) => { PATH = p; EXPLORING = !!exploring; stepT = 0; PATHSEEN = new Set(visibleMons().map((m) => m.id)); };
function wanderer() {
  const pool = Object.entries(MON).filter(([, m]) => G.depth >= m.d[0] && G.depth <= m.d[1]).map(([k]) => k);
  for (let t = 0; t < 200; t++) { const x = ri(1, MW - 2), y = ri(1, MH - 2), i = idx(x, y); if (map[i] !== FLOOR || vis[i] || monAt(x, y) || dist[i] < 14 || dist[i] > 60) continue; const m = spawn(pickR(pool), x, y, false); m.alert = true; G.wander = (G.wander || 0) + 1; if (G.wander === 1) msg("You hear something stirring in the dark...", "#c9b8ff"); return; }
}
const visibleMons = () => G.mons.filter((m) => !m.dead && vis[idx(m.x, m.y)]);
const visibleThreat = () => visibleMons().some((m) => !m.asleep || cheb(m, P) <= 2);
function tryMove(dx, dy) {
  if (MODE !== "play") return false;
  const nx = P.x + dx, ny = P.y + dy; if (!inb(nx, ny)) return false;
  const m = monAt(nx, ny);
  if (m) { attackMon(m); endTurn(); return true; }
  const t = map[idx(nx, ny)];
  if (t === WALL) { bumpAnim(P, dx * 0.3, dy * 0.3); return false; }
  if (t === DOOR) { map[idx(nx, ny)] = OPEN; K.sfx("door"); }
  P.x = nx; P.y = ny; K.sfx("step"); pickup();
  if (t === PORTAL) { victory(); return true; }
  if (t === STAIRS) { msg("Stairs lead deeper. Press Enter or tap Descend.", "#c9b8ff"); PATH = null; }
  endTurn(); return true;
}
function wait() { if (MODE !== "play") return; float(P.x, P.y, "z", "#9ad0ff"); endTurn(); }
const canTake = (it) => it.kind !== "item" || (P.inv[it.id] || 0) < 9;
function pickup() {
  const it = itemAt(P.x, P.y); if (!it) return;
  if (it.kind === "gold") { const amt = Math.round(it.amt * (1 + P.greed)); P.gold += amt; float(P.x, P.y, `+${amt}`, "#ffd479"); K.sfx("coin"); msg(`You pick up ${amt} gold.`, "#ffd479"); }
  else if (it.kind === "item") { if ((P.inv[it.id] || 0) >= 9) { msg(`You can't carry more ${ITEMS[it.id].name}s.`); return; } P.inv[it.id] = (P.inv[it.id] || 0) + 1; K.sfx("pickup"); msg(`You pick up a ${ITEMS[it.id].name}.`, "#9ad0ff"); buildBar(); }
  else {
    const cur = it.kind === "wpn" ? P.wpn : P.arm, name = (it.kind === "wpn" ? WPN : ARM)[it.tier];
    if (it.tier > cur) { if (it.kind === "wpn") P.wpn = it.tier; else P.arm = it.tier; K.sfx("equip"); msg(`You equip the ${name}.`, "#6fe39a"); float(P.x, P.y, name, "#6fe39a"); }
    else { const g2 = 8 + it.tier * 6; P.gold += g2; K.sfx("coin"); msg(`You salvage the ${name} for ${g2} gold.`, "#ffd479"); }
  }
  G.items.splice(G.items.indexOf(it), 1); hud();
}
function descend() {
  if (MODE !== "play" || map[idx(P.x, P.y)] !== STAIRS) return;
  K.sfx("stairs"); PATH = null; EXPLORING = false; TGT = null;
  const d = G.depth + 1; genFloor(d); G.best = Math.max(G.best || 0, d);
  K.banner(d === LAST ? "Floor 10 · The Throne of Bones" : `Floor ${d}`, d === LAST ? "The Lich King awaits" : FLOORNAMES[Math.min(FLOORNAMES.length - 1, (d - 1) >> 1)], 2200);
  msg(d === LAST ? "A chill runs through you. Something ancient stirs ahead." : `You descend to floor ${d}.`, "#c9b8ff");
  K.playSong(d === LAST ? "boss" : d >= 6 ? "deep" : "dungeon", 2); saveRun(); hud(); buildBar();
}
const FLOORNAMES = ["The Upper Cellars", "The Fungal Warrens", "The Bone Halls", "The Sunken Crypts", "The Abyssal Depths"];

/* ================= abilities & items ================= */
const cdOf = (id) => Math.max(1, ABIL[id].cd - P.cdr);
function useAbility(i) {
  if (MODE !== "play") return; const id = CLASSES[P.cls].abil[i]; if (!id) return; const A = ABIL[id];
  if (P.cd[id] > 0) { K.sfx("deny"); msg(`${A.name} is ready in ${P.cd[id]} turn${P.cd[id] > 1 ? "s" : ""}.`); return; }
  if (A.target) return startTarget({ kind: "abil", id, range: A.target });
  if (id === "cleave") { const adj = G.mons.filter((m) => !m.dead && cheb(m, P) === 1); if (!adj.length) { msg("There is no one next to you."); K.sfx("deny"); return; } K.sfx("cleave"); for (const m of adj) attackMon(m, { sure: true }); FX.rings.push({ x: P.x, y: P.y, r: 1.6, col: "#ffd479", t: 0 }); }
  else if (id === "wind") { if (P.hp >= P.maxHp) { msg("You are already at full health."); K.sfx("deny"); return; } heal(Math.round(P.maxHp * 0.4)); K.sfx("heal"); burst(P.x, P.y, "#6fe39a", 18); msg("You catch your second wind.", "#6fe39a"); }
  else if (id === "vanish") { P.invis = 6; K.sfx("vanish"); burst(P.x, P.y, "#c39bff", 18); msg("You melt into the shadows.", "#c39bff"); for (const m of G.mons) if (!m.dead) m.alert = false; }
  else if (id === "nova") { const hit = G.mons.filter((m) => !m.dead && cheb(m, P) <= 2); K.sfx("nova"); FX.rings.push({ x: P.x, y: P.y, r: 2.6, col: "#8ad8ff", t: 0 }); for (const m of hit) { m.frozen = 3; hurtMon(m, ri(5, 8) + Math.floor(P.lvl / 2), "#8ad8ff"); } msg(hit.length ? `Frost bursts out, freezing ${hit.length} foe${hit.length > 1 ? "s" : ""}.` : "Frost bursts out around you.", "#8ad8ff"); }
  P.cd[id] = cdOf(id); endTurn(); buildBar();
}
function useItem(id) {
  if (MODE !== "play" || !P.inv[id]) return; const I = ITEMS[id];
  if (I.target) return startTarget({ kind: "item", id, range: I.target });
  P.inv[id]--; if (!P.inv[id]) delete P.inv[id];
  if (id === "heal") { if (P.hp >= P.maxHp) { P.inv[id] = (P.inv[id] || 0) + 1; msg("You are already at full health."); return; } heal(Math.round(P.maxHp * 0.5)); P.poison = 0; K.sfx("drink"); burst(P.x, P.y, "#ff5a6a", 12); msg("You drink a Healing Potion.", "#ff8a9a"); }
  else if (id === "haste") { P.haste = 12; K.sfx("drink"); msg("Everything slows around you.", "#6fe3d9"); burst(P.x, P.y, "#6fe3d9", 12); }
  else if (id === "might") { P.dmg++; K.sfx("drink"); msg("Strength surges through you. +1 damage.", "#ffb347"); burst(P.x, P.y, "#ffb347", 12); }
  else if (id === "tele") { for (let t = 0; t < 400; t++) { const x = ri(1, MW - 2), y = ri(1, MH - 2); if (map[idx(x, y)] === FLOOR && !monAt(x, y) && Math.hypot(x - P.x, y - P.y) > 8) { burst(P.x, P.y, "#9ad0ff", 14); P.x = P.dx = x; P.y = P.dy = y; burst(x, y, "#9ad0ff", 14); break; } } K.sfx("blink"); msg("The world twists around you.", "#9ad0ff"); pickup(); }
  else if (id === "mapping") { for (let i = 0; i < map.length; i++) if (map[i] !== WALL || D8.some(([ox, oy]) => { const x = (i % MW) + ox, y = ((i / MW) | 0) + oy; return inb(x, y) && map[idx(x, y)] !== WALL; })) seen[i] = 1; K.sfx("scroll"); msg("The layout of the floor burns into your mind.", "#ffd479"); }
  else if (id === "enchant") { if (P.wpnE <= P.armE) { P.wpnE++; msg(`Your ${WPN[P.wpn]} glows. (+${P.wpnE})`, "#c39bff"); } else { P.armE++; msg(`Your ${ARM[P.arm]} glows. (+${P.armE})`, "#c39bff"); } K.sfx("scroll"); burst(P.x, P.y, "#c39bff", 14); }
  endTurn(); buildBar();
}
function startTarget(t) {
  const list = visibleMons().filter((m) => cheb(m, P) <= t.range && los(P.x, P.y, m.x, m.y)).sort((a, b) => cheb(a, P) - cheb(b, P));
  if (!list.length) { msg("No enemy in sight to target."); K.sfx("deny"); return; }
  TGT = { ...t, list, i: 0 }; MODE = "target"; PATH = null; EXPLORING = false; K.sfx("click"); tip(); buildBar();
}
function cancelTarget() { if (MODE !== "target") return; TGT = null; MODE = "play"; tip(); buildBar(); }
function fireTarget(m) {
  if (MODE !== "target") return; const t = TGT; m = m || t.list[t.i]; TGT = null; MODE = "play"; tip(); if (!m || m.dead) return;
  if (t.kind === "abil") {
    if (t.id === "dagger") { shot(P.x, P.y, m.x, m.y, "#e8eef8", "dagger"); K.sfx("throw"); attackMon(m, { sure: true, bonus: 4 }); }
    else if (t.id === "firebolt") { shot(P.x, P.y, m.x, m.y, "#ff8a3a", "fire"); K.sfx("fire"); hurtMon(m, Math.max(1, ri(6, 10) + Math.floor(P.lvl * 1.2) - Math.floor(MON[m.type].def / 2)), "#ffb347", true); burst(m.x, m.y, "#ff8a3a", 12); }
    P.cd[t.id] = cdOf(t.id);
  } else if (t.id === "fire") {
    P.inv.fire--; if (!P.inv.fire) delete P.inv.fire; shot(P.x, P.y, m.x, m.y, "#ff7a3a", "flask"); K.sfx("boom"); FX.shake = 8;
    for (const o of G.mons.slice()) if (!o.dead && cheb(o, m) <= 1) hurtMon(o, 9, "#ffb347", true);
    if (cheb(P, m) <= 1) hurtP(4, "your own fire");
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) burst(m.x + ox, m.y + oy, "#ff7a3a", 5, 2);
  }
  endTurn(); buildBar();
}

/* ================= auto-walk & explore ================= */
let stepT = 0;
function walkTo(x, y) {
  if (MODE !== "play") return;
  if (x === P.x && y === P.y) { if (map[idx(x, y)] === STAIRS) return descend(); return wait(); }
  if (cheb({ x, y }, P) === 1) { tryMove(x - P.x, y - P.y); return; }
  if (!seen[idx(x, y)] || !passable(x, y)) return;
  const p = findPath(x, y); if (p) setPath(p, false);
}
function explore() {
  if (MODE !== "play") return;
  if (visibleThreat()) { msg("Not with enemies nearby!", "#ff9a9a"); K.sfx("deny"); return; }
  const target = (x, y) => { const i = idx(x, y), it = itemAt(x, y); if (it && !(x === P.x && y === P.y) && canTake(it)) return true; if (map[i] === WALL) return false; return D8.some(([ox, oy]) => inb(x + ox, y + oy) && !seen[idx(x + ox, y + oy)] && map[idx(x + ox, y + oy)] !== WALL); };
  const p = findPath(-1, -1, (x, y) => !(x === P.x && y === P.y) && target(x, y));
  if (!p) { if (G.stairs && seen[idx(G.stairs.x, G.stairs.y)] && !(P.x === G.stairs.x && P.y === G.stairs.y)) { msg("Everything is explored. Heading for the stairs.", "#c9b8ff"); const q = findPath(G.stairs.x, G.stairs.y); if (q) setPath(q, false); return; } msg("There is nothing left to explore here.", "#c9b8ff"); return; }
  setPath(p, true);
}
function stepPath(dt) {
  if (!PATH || MODE !== "play") return; stepT -= dt; if (stepT > 0) return; stepT = 0.075;
  if (!PATH.length) { PATH = null; if (EXPLORING) explore(); return; }
  const [x, y] = PATH.shift(); if (cheb({ x, y }, P) !== 1 || monAt(x, y)) { PATH = null; if (EXPLORING) { EXPLORING = false; } return; }
  const hp = P.hp; if (!tryMove(x - P.x, y - P.y)) { PATH = null; EXPLORING = false; return; } if (P.hp < hp) { PATH = null; EXPLORING = false; }
  if (map[idx(P.x, P.y)] === STAIRS && PATH && !PATH.length) PATH = null;
}

/* ================= effects & render ================= */
const FX = { floats: [], parts: [], shots: [], rings: [], shake: 0 };
const cv = $("#cv"), ctx = cv.getContext("2d"); let CW = 0, CH = 0;
function resize() {
  CW = innerWidth; CH = innerHeight; const f = K.fit(cv, CW, CH); void f;
  const nts = clamp(Math.round(Math.min(CW, CH) / 12.5), 30, 54); if (nts !== TS || K.dpr() !== DPR) { TS = nts; buildArt(); }
}
addEventListener("resize", resize);
const light = document.createElement("canvas"); light.width = MW; light.height = MH; const lctx = light.getContext("2d"), limg = lctx.createImageData(MW, MH);
let camX = 0, camY = 0, T = 0;
function render(dt) {
  T += dt; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = "#07060b"; ctx.fillRect(0, 0, CW, CH);
  if (!G || !P) return;
  const ease = (e, k) => { e.dx += (e.x - e.dx) * Math.min(1, dt * k); e.dy += (e.y - e.dy) * Math.min(1, dt * k); if (Math.abs(e.x - e.dx) > 6 || Math.abs(e.y - e.dy) > 6) { e.dx = e.x; e.dy = e.y; } };
  ease(P, 16); for (const m of G.mons) ease(m, 14);
  const demo = MODE === "title", tx = demo ? (MW / 2 + Math.sin(T * 0.06) * MW * 0.28) * TS : (P.dx + 0.5) * TS, ty = demo ? (MH / 2 + Math.cos(T * 0.045) * MH * 0.22) * TS : (P.dy + 0.5) * TS;
  if (!G.cam) G.cam = { x: tx, y: ty }; G.cam.x += (tx - G.cam.x) * Math.min(1, dt * (demo ? 2 : 8)); G.cam.y += (ty - G.cam.y) * Math.min(1, dt * (demo ? 2 : 8));
  FX.shake = Math.max(0, FX.shake - dt * 30); const sh = FX.shake > 0.2 ? FX.shake : 0;
  const ox = Math.round(CW / 2 - G.cam.x + (Math.random() - 0.5) * sh), oy = Math.round(CH / 2 - G.cam.y - TS * 0.3 + (Math.random() - 0.5) * sh);
  const x0 = Math.max(0, Math.floor(-ox / TS) - 1), x1 = Math.min(MW - 1, Math.ceil((CW - ox) / TS)), y0 = Math.max(0, Math.floor(-oy / TS) - 1), y1 = Math.min(MH - 1, Math.ceil((CH - oy) / TS));
  ctx.imageSmoothingEnabled = true;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = idx(x, y); if (!seen[i]) continue; const t = map[i], px = ox + x * TS, py = oy + y * TS;
    let img = t === WALL ? (y + 1 < MH && map[idx(x, y + 1)] !== WALL ? TILES.wallF : TILES.wall) : t === DOOR ? TILES.door : t === OPEN ? TILES.open : t === STAIRS ? TILES.stairs : TILES.floor[deco[i]];
    if (t === PORTAL) img = TILES.floor[0];
    ctx.drawImage(img, px, py, TS, TS);
    if (t === PORTAL) { ctx.save(); ctx.translate(px + TS / 2, py + TS / 2); for (let k = 0; k < 3; k++) { ctx.rotate(T * (1.5 + k)); ctx.strokeStyle = ["#7affd0", "#c39bff", "#fff"][k]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, TS * (0.38 - k * 0.1), 0, 4.5); ctx.stroke(); } ctx.restore(); K.drawGlow(ctx, px + TS / 2, py + TS / 2, TS, "122,255,208", 0.6); }
  }
  for (const it of G.items) { const i = idx(it.x, it.y); if (!seen[i] || it.x < x0 || it.x > x1 || it.y < y0 || it.y > y1) continue; const bob = vis[i] ? Math.sin(T * 3 + it.x) * TS * 0.04 : 0; ctx.drawImage(itemSprite(itemIcon(it)), ox + it.x * TS + TS * 0.12, oy + it.y * TS + TS * 0.12 + bob, TS * 0.76, TS * 0.76); }
  const ents = G.mons.filter((m) => !m.dead && vis[idx(m.x, m.y)]).concat(demo ? [] : [P]).sort((a, b) => a.dy - b.dy);
  for (const e of ents) drawEnt(e, ox, oy, dt);
  /* light map: smooth fog of war */
  const d = limg.data, r = P.sight + (G.depth === LAST ? 3 : 0), fl = 0.03 * Math.sin(T * 7) + 0.02 * Math.sin(T * 13);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = idx(x, y), k = i * 4; let a;
    if (!seen[i]) a = 255; else if (demo) a = 120 + Math.round(40 * Math.sin(x * 0.4 + y * 0.3 + T)); else if (!vis[i]) a = 178; else { const dd = Math.hypot(x - P.x, y - P.y) / (r + 0.5); a = clamp(Math.round((Math.max(0, dd - 0.45) * 1.25 + fl) * 255), 0, 150); }
    d[k] = 6; d[k + 1] = 4; d[k + 2] = 12; d[k + 3] = a;
  }
  lctx.putImageData(limg, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(light, ox, oy, MW * TS, MH * TS);
  /* projectiles, rings, particles, floating text */
  for (const s of FX.shots) { s.t += dt; const k = Math.min(1, s.t / s.dur), x = ox + (s.x0 + (s.x1 - s.x0) * k) * TS, y = oy + (s.y0 + (s.y1 - s.y0) * k) * TS; if (s.kind === "arrow" || s.kind === "dagger") { const a = Math.atan2(s.y1 - s.y0, s.x1 - s.x0); ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = s.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-TS * 0.3, 0); ctx.lineTo(TS * 0.2, 0); ctx.stroke(); ctx.restore(); } else { K.drawGlow(ctx, x, y, TS * 0.5, hexRgb(s.col), 1); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, TS * 0.09, 0, TAU); ctx.fill(); } }
  FX.shots = FX.shots.filter((s) => s.t < s.dur);
  for (const g of FX.rings) { g.t += dt; const k = g.t / 0.4; ctx.strokeStyle = g.col; ctx.globalAlpha = Math.max(0, 1 - k); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ox + (g.x + 0.5) * TS, oy + (g.y + 0.5) * TS, g.r * TS * Math.min(1, k * 1.5), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  FX.rings = FX.rings.filter((g) => g.t < 0.4);
  for (const p of FX.parts) { p.t += dt; p.vy += 6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.col; ctx.fillRect(ox + p.x * TS - 2, oy + p.y * TS - 2, 4, 4); }
  ctx.globalAlpha = 1; FX.parts = FX.parts.filter((p) => p.t < p.life);
  ctx.textAlign = "center"; ctx.lineJoin = "round";
  for (const f of FX.floats) { f.t += dt; const k = f.t / 0.9; ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.font = `700 ${Math.round(TS * (f.big ? 0.55 : 0.4))}px "Pixelify Sans", sans-serif`; const x = ox + (f.x + 0.5) * TS, y = oy + (f.y + 0.1) * TS - k * TS * 0.7; ctx.strokeStyle = "#000"; ctx.lineWidth = 4; ctx.strokeText(f.text, x, y); ctx.fillStyle = f.col; ctx.fillText(f.text, x, y); }
  ctx.globalAlpha = 1; FX.floats = FX.floats.filter((f) => f.t < 0.9);
  if (MODE === "target" && TGT) { const m = TGT.list[TGT.i]; if (m) { const cx = ox + (m.dx + 0.5) * TS, cy = oy + (m.dy + 0.5) * TS, pr = TS * (0.55 + Math.sin(T * 8) * 0.04); ctx.strokeStyle = "#ffd479"; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(ox + (P.dx + 0.5) * TS, oy + (P.dy + 0.5) * TS); ctx.lineTo(cx, cy); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(cx, cy, pr, 0, TAU); ctx.stroke(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + T; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * pr * 0.7, cy + Math.sin(a) * pr * 0.7); ctx.lineTo(cx + Math.cos(a) * pr * 1.25, cy + Math.sin(a) * pr * 1.25); ctx.stroke(); } } }
  if (PATH && PATH.length && !EXPLORING) { const [x, y] = PATH[PATH.length - 1]; ctx.strokeStyle = "rgba(255,212,121,.6)"; ctx.lineWidth = 2; ctx.strokeRect(ox + x * TS + 4, oy + y * TS + 4, TS - 8, TS - 8); }
  drawMinimap();
}
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
function drawEnt(e, ox, oy, dt) {
  const isP = e === P; let bx = 0, by = 0;
  if (e.bump) { e.bump.t += dt; const k = e.bump.t / 0.16; if (k >= 1) e.bump = null; else { const s = Math.sin(k * Math.PI) * 0.32; bx = e.bump.x * s; by = e.bump.y * s; } }
  const x = ox + (e.dx + bx) * TS, y = oy + (e.dy + by) * TS, img = isP ? heroSprite(P.cls) : monSprite(e.type), bob = Math.sin(T * 4 + (isP ? 0 : e.id)) * TS * 0.02;
  const big = !isP && MON[e.type].boss ? 1.45 : 1, w = TS * 1.3 * big;
  ctx.save(); if (isP && P.invis > 0) ctx.globalAlpha = 0.4;
  if (!isP && e.frozen > 0) { ctx.fillStyle = "rgba(138,216,255,.25)"; ctx.fillRect(x + 2, y + 2, TS - 4, TS - 4); }
  ctx.drawImage(img, x + TS / 2 - w / 2, y + TS - w * 0.98 + bob, w, w);
  if (e.flash > 0) { e.flash -= dt; ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.6; ctx.drawImage(img, x + TS / 2 - w / 2, y + TS - w * 0.98 + bob, w, w); ctx.globalCompositeOperation = "source-over"; }
  ctx.restore();
  if (!isP) {
    if (e.hp < e.maxHp) { const bw = TS * 0.8 * (big > 1 ? 1.4 : 1); ctx.fillStyle = "#000a"; ctx.fillRect(x + TS / 2 - bw / 2, y - TS * 0.08 - (big > 1 ? TS * 0.4 : 0), bw, 5); ctx.fillStyle = e.hp > e.maxHp * 0.5 ? "#6fe39a" : e.hp > e.maxHp * 0.25 ? "#ffd479" : "#ff6b6b"; ctx.fillRect(x + TS / 2 - bw / 2, y - TS * 0.08 - (big > 1 ? TS * 0.4 : 0), (bw * e.hp) / e.maxHp, 5); }
    if (e.asleep) { ctx.font = `700 ${Math.round(TS * 0.32)}px "Pixelify Sans", sans-serif`; ctx.fillStyle = "#9ad0ff"; ctx.fillText("z", x + TS * 0.85, y + TS * 0.1 - ((T * 8 + e.id) % 6)); }
    if (e.frozen > 0) { ctx.font = `700 ${Math.round(TS * 0.3)}px sans-serif`; ctx.fillStyle = "#8ad8ff"; ctx.fillText("❄", x + TS * 0.85, y + TS * 0.2); }
  }
}
function drawMinimap() {
  if (MODE === "title") return; const big = SHOWMAP, s = big ? Math.max(4, Math.floor(Math.min((CW - 40) / MW, (CH - 160) / MH))) : CW >= 900 ? 3 : 0; if (!s) return;
  const w = MW * s, h = MH * s, mx = big ? Math.round((CW - w) / 2) : CW - w - 12, my = big ? Math.round((CH - h) / 2) : 62;
  ctx.fillStyle = big ? "rgba(6,4,10,.92)" : "rgba(6,4,10,.6)"; ctx.fillRect(mx - 6, my - 6, w + 12, h + 12);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = idx(x, y); if (!seen[i]) continue; const t = map[i]; ctx.fillStyle = t === WALL ? "#4a3f63" : t === STAIRS ? "#ffd479" : t === PORTAL ? "#7affd0" : t === DOOR || t === OPEN ? "#8a5a30" : vis[i] ? "#5a5070" : "#2e2840"; ctx.fillRect(mx + x * s, my + y * s, s, s); }
  for (const it of G.items) if (seen[idx(it.x, it.y)]) { ctx.fillStyle = it.kind === "gold" ? "#ffd479" : "#9ad0ff"; ctx.fillRect(mx + it.x * s, my + it.y * s, s, s); }
  for (const m of G.mons) if (!m.dead && vis[idx(m.x, m.y)]) { ctx.fillStyle = "#ff5a5a"; ctx.fillRect(mx + m.x * s, my + m.y * s, s, s); }
  ctx.fillStyle = "#fff"; ctx.fillRect(mx + P.x * s - 1, my + P.y * s - 1, s + 2, s + 2);
  if (big) { ctx.font = '700 18px "Pixelify Sans", sans-serif'; ctx.textAlign = "center"; ctx.fillStyle = "#c9b8ff"; ctx.fillText(`Floor ${G.depth} · press M or tap to close`, CW / 2, my - 16); }
}
let SHOWMAP = false;

/* ================= HUD ================= */
function hud() {
  if (!P) return; const C = CLASSES[P.cls];
  $("#clsName").textContent = C.name; $("#lvl").textContent = `Level ${P.lvl} · ${WPN[P.wpn]}${P.wpnE ? " +" + P.wpnE : ""}`;
  $("#hpBar").style.width = (100 * Math.max(0, P.hp)) / P.maxHp + "%"; $("#hpTxt").textContent = `${Math.max(0, P.hp)} / ${P.maxHp}`; $("#hpWrap").classList.toggle("low", P.hp <= P.maxHp * 0.3);
  $("#xpBar").style.width = (100 * P.xp) / xpNeed(P.lvl) + "%"; $("#xpTxt").textContent = "";
  $("#depth").textContent = `Floor ${G.depth}`; $("#goldTxt").textContent = `● ${P.gold}`;
  const [a, b] = pAtk(), eff = [`⚔ ${a}-${b}`, `🛡 ${pDef()}`];
  if (P.haste > 0) eff.push(`<span style="color:#6fe3d9">Haste ${P.haste}</span>`); if (P.invis > 0) eff.push(`<span style="color:#c39bff">Hidden ${P.invis}</span>`); if (P.poison > 0) eff.push(`<span style="color:#9aff6a">Poison ${P.poison}</span>`);
  $("#eff").innerHTML = eff.map((x) => (x.startsWith("<span") ? x : `<span>${x}</span>`)).join("");
  for (const el of $$("#bar [data-cd]")) { const id = el.dataset.cd, c = P.cd[id] || 0; let o = el.querySelector(".cd"); if (c > 0) { if (!o) { o = document.createElement("span"); o.className = "cd"; el.appendChild(o); } o.textContent = c; } else if (o) o.remove(); }
  const onStairs = map[idx(P.x, P.y)] === STAIRS; const ds = $("#descBtn"); if (ds) ds.hidden = !onStairs;
}
function renderLog() { const now = performance.now(); $("#log").innerHTML = G.log.slice(-5).map((l, i, a) => `<div style="color:${l.col};opacity:${i === a.length - 1 ? 1 : 0.55 + i * 0.1}">${K.esc(l.text)}</div>`).join(""); void now; }
function slotCanvas(fn) { const c = document.createElement("canvas"); c.width = c.height = 72; fn(c.getContext("2d"), 72); return c; }
function buildBar() {
  const bar = $("#bar"); if (!P) return; bar.innerHTML = "";
  const add = (el) => bar.appendChild(el);
  const btn = (cls, key, title, fn) => { const b = document.createElement("button"); b.className = "slot " + cls; b.type = "button"; b.title = title; if (key) b.insertAdjacentHTML("beforeend", `<span class="k">${key}</span>`); b.addEventListener("click", (e) => { e.stopPropagation(); K.audio(); fn(); }); return b; };
  CLASSES[P.cls].abil.forEach((id, i) => { const A = ABIL[id], b = btn("abil" + (TGT && TGT.kind === "abil" && TGT.id === id ? " on" : ""), K.device === "kb" ? String(i + 1) : "", `${A.name}: ${A.desc} (cooldown ${cdOf(id)})`, () => (MODE === "target" ? cancelTarget() : useAbility(i))); b.dataset.cd = id; b.prepend(slotCanvas((g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2); gr.addColorStop(0, "#8f6bff66"); gr.addColorStop(1, "#8f6bff00"); g.fillStyle = gr; g.fillRect(0, 0, s, s); drawGlyph(g, s, A.icon, id === "firebolt" ? "#ffb347" : id === "nova" ? "#8ad8ff" : id === "wind" ? "#6fe39a" : "#f1ecfa"); })); add(b); });
  add(Object.assign(document.createElement("span"), { className: "sep" }));
  let n = 3; for (const id of ITEMORDER) { if (!P.inv[id]) continue; const I = ITEMS[id], k = n <= 9 ? String(n) : ""; n++; const b = btn(TGT && TGT.kind === "item" && TGT.id === id ? "on" : "", K.device === "kb" ? k : "", `${I.name}: ${I.desc}`, () => (MODE === "target" ? cancelTarget() : useItem(id))); b.dataset.item = id; b.prepend(slotCanvas((g, s) => drawItem(g, s, I.icon))); b.insertAdjacentHTML("beforeend", `<span class="n">${P.inv[id]}</span>`); add(b); }
  add(Object.assign(document.createElement("span"), { className: "sep" }));
  const w = btn("", K.device === "kb" ? "." : "", "Wait a turn (Space)", () => wait()); w.prepend(slotCanvas((g, s) => drawGlyph(g, s, "wait", "#b3a8c9"))); add(w);
  const ex = btn("", K.device === "kb" ? "X" : "", "Explore automatically (X)", () => explore()); ex.prepend(slotCanvas((g, s) => drawGlyph(g, s, "explore", "#b3a8c9"))); add(ex);
  const mp = btn("", K.device === "kb" ? "M" : "", "Map (M)", () => { SHOWMAP = !SHOWMAP; }); mp.prepend(slotCanvas((g, s) => drawGlyph(g, s, "map", "#b3a8c9"))); add(mp);
  const ds = btn("wide go", "", "Descend the stairs (Enter)", () => descend()); ds.id = "descBtn"; ds.textContent = "Descend ▼"; ds.hidden = map[idx(P.x, P.y)] !== STAIRS; add(ds);
  hud();
}
function tip() {
  let t = "";
  if (MODE === "target" && TGT) { const name = TGT.kind === "abil" ? ABIL[TGT.id].name : ITEMS[TGT.id].name; t = K.device === "touch" ? `${name}: tap an enemy · tap the button again to cancel` : `${name}: Tab or arrows to switch target · Enter to fire · Esc to cancel`; }
  $("#tip").textContent = t;
}
function drawFace() { const c = $("#face"), g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height); drawCreature(g, c.width, CLASSES[P.cls].art); }

/* ================= run lifecycle ================= */
function newRun(cls, daily) {
  SAVE.cls = cls; SAVE.stats.runs++;
  G = { seed: daily ? "daily-" + K.today() : String((Math.random() * 1e9) | 0), daily: !!daily, depth: 1, mons: [], items: [], uid: 0, kills: 0, log: [], best: 1 };
  P = newPlayer(cls); genFloor(1); startPlay();
  K.banner("Floor 1", FLOORNAMES[0], 2200); msg(`${CLASSES[cls].name}, the dungeon awaits. Find the stairs and go deeper.`, "#c9b8ff");
  if (SAVE.stats.runs <= 2) msg(K.device === "touch" ? "Tap a tile to walk there. Tap an enemy next to you to attack." : "Move with WASD or the arrow keys (Q E Z C for diagonals). Walk into enemies to attack.", "#9ad0ff");
  saveRun();
}
function startPlay() {
  MODE = "play"; TGT = null; PATH = null; EXPLORING = false; SHOWMAP = false; K.ui.hide();
  $("#hud").hidden = false; $("#bar").hidden = false; $("#log").hidden = false; drawFace(); buildBar(); renderLog(); hud(); tip();
  K.playSong(G.depth === LAST ? "boss" : G.depth >= 6 ? "deep" : "dungeon", 2);
}
function saveRun() { if (!G || MODE === "dead") return; SAVE.run = { seed: G.seed, daily: G.daily, depth: G.depth, kills: G.kills, best: G.best, P: { ...P, dx: 0, dy: 0, bump: null, flash: 0 } }; persist(); }
function resume() {
  const r = SAVE.run; if (!r) return title();
  G = { seed: r.seed, daily: r.daily, depth: r.depth, mons: [], items: [], uid: 0, kills: r.kills, log: [], best: r.best };
  P = r.P; P.cd = P.cd || {}; genFloor(r.depth); startPlay(); msg(`You return to floor ${r.depth}.`, "#c9b8ff");
}
const score = () => G.depth * 100 + G.kills * 5 + P.gold + (MODE === "won" ? 2000 : 0) + P.lvl * 20;
function recordEnd(won) {
  SAVE.run = null; const sc = score();
  SAVE.best.depth = Math.max(SAVE.best.depth, G.depth); SAVE.best.score = Math.max(SAVE.best.score, sc); if (won) SAVE.wins++;
  if (G.daily) { const t = K.today(), prev = SAVE.daily[t]; if (!prev || sc > prev.score) SAVE.daily[t] = { depth: G.depth, score: sc, cls: P.cls, won }; }
  persist(); return sc;
}
function die() {
  if (MODE === "dead") return; MODE = "dead"; PATH = null; EXPLORING = false; TGT = null; SAVE.stats.deaths++;
  K.sfx("die"); K.musicLevel(0); burst(P.x, P.y, "#ff5a6a", 30, 4); FX.shake = 12; tip();
  const sc = recordEnd(false);
  setTimeout(() => K.ui.show(`<div class="logo">You died</div><p class="k-sub">Slain by ${K.esc(G.killer || "the dungeon")} on floor ${G.depth}.</p>${endStats(sc)}<div class="k-row"><button class="k-btn primary" data-a="again" autofocus>Try again</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "title" }), 1100);
}
function victory() {
  if (MODE === "won") return; MODE = "won"; PATH = null; K.sfx("win"); K.playSong("title", 1);
  const sc = recordEnd(true);
  K.ui.show(`<div class="logo">Victory!</div><p class="k-sub">You escape the dungeon with the Lich King's crown. The ${CLASSES[P.cls].name.toLowerCase()} of legend.</p>${endStats(sc)}<div class="k-row"><button class="k-btn primary" data-a="again" autofocus>Descend again</button><button class="k-btn" data-a="title">Main menu</button></div>`, { back: "title" });
}
const endStats = (sc) => `<div class="k-stats" style="width:min(100%,32em)">${[["Floor", G.depth], ["Level", P.lvl], ["Kills", G.kills], ["Gold", P.gold], ["Turns", P.turns], ["Score", K.fmt(sc)]].map(([a, b]) => `<div class="k-stat"><small>${a}</small><b>${b}</b></div>`).join("")}</div>${G.daily ? `<p class="k-sub">Daily Descent · ${K.today()}</p>` : ""}<p class="k-sub">Best score ${K.fmt(SAVE.best.score)} · deepest floor ${SAVE.best.depth} · victories ${SAVE.wins}</p>`;

/* ================= screens ================= */
function heroCanvas(cls, size = 120) { const c = document.createElement("canvas"); c.width = c.height = size; drawCreature(c.getContext("2d"), size, CLASSES[cls].art); return c.toDataURL(); }
const HEROIMG = {};
function title() {
  MODE = "title"; TGT = null; PATH = null; G = { seed: "title-" + ((Math.random() * 1e6) | 0), depth: 4, mons: [], items: [], uid: 0, kills: 0, log: [] }; P = newPlayer("warrior"); genFloor(4); seen.fill(1); vis.fill(1); for (const m of G.mons) m.asleep = true; $("#hud").hidden = true; $("#bar").hidden = true; $("#log").hidden = true; tip(); K.playSong("title", 1);
  for (const k in CLASSES) if (!HEROIMG[k]) HEROIMG[k] = heroCanvas(k);
  const r = SAVE.run, today = SAVE.daily[K.today()];
  K.ui.show(`<div class="logo">DEEPCRAWL</div><p class="k-sub">Ten floors down, a lich-king waits. Choose your hero.</p>
    <div class="classes">${Object.entries(CLASSES).map(([k, C]) => `<button class="k-btn cls${SAVE.cls === k ? " on" : ""}" data-a="cls" data-k="${k}"><img src="${HEROIMG[k]}" alt="" width="80" height="80"><b>${C.name}</b><span class="st">❤ ${C.hp} · ⚔ ${C.atk[0]}-${C.atk[1]} · 🛡 ${C.def}</span><small>${C.desc}</small><small style="color:#c9b8ff">${C.abil.map((a) => ABIL[a].name).join(" · ")}</small></button>`).join("")}</div>
    <div class="k-row">${r ? `<button class="k-btn primary" data-a="resume" autofocus>Continue<small>${CLASSES[r.P.cls].name} · floor ${r.depth}${r.daily ? " · daily" : ""}</small></button>` : ""}<button class="k-btn${r ? "" : " primary"}" data-a="start"${r ? "" : " autofocus"}>Descend<small>New run as ${CLASSES[SAVE.cls].name}</small></button><button class="k-btn" data-a="daily">Daily Descent<small>${today ? `Today: floor ${today.depth}, ${K.fmt(today.score)} pts` : "Same dungeon for everyone today"}</small></button></div>
    <div class="k-row"><button class="k-btn" data-a="help">How to play</button><button class="k-btn" data-a="settings">Settings</button></div>
    ${SAVE.stats.runs ? `<p class="k-sub">Best score ${K.fmt(SAVE.best.score)} · deepest floor ${SAVE.best.depth} · victories ${SAVE.wins} · ${K.fmt(SAVE.stats.kills)} monsters slain</p>` : ""}`, { cls: "soft" });
}
function menu() {
  if (MODE !== "play" && MODE !== "target") return; cancelTarget(); PATH = null; EXPLORING = false; MODE = "menu";
  K.ui.show(`<div class="logo sm">Paused</div><div class="k-menu"><button class="k-btn primary" data-a="close" autofocus>Resume</button><button class="k-btn" data-a="help">How to play</button><button class="k-btn" data-a="settings">Settings</button><button class="k-btn" data-a="quit">Save and quit</button><button class="k-btn" data-a="abandon">Abandon run</button></div><p class="k-sub">Your run is saved at the start of each floor.</p>`, { back: "close" });
}
function help(back) {
  K.ui.show(`<div class="k-bar"><h2>How to play</h2><button class="k-btn" data-a="${back}" autofocus>Back</button></div><div class="k-help">
    <div><b>Goal</b>Find the stairs on each floor and go deeper. Floor 10 holds the Lich King. Defeat him and step into his portal to win.</div>
    <div><b>Turns</b>Nothing moves until you do. Every step, attack or potion is one turn, then the monsters act. Fast monsters act twice.</div>
    <div><b>Combat</b>Walk into an enemy to attack it. Sleeping enemies take extra damage. Use your two class abilities, then wait for their cooldowns.</div>
    <div><b>Growing stronger</b>Kill monsters for experience. Each level raises your HP and lets you pick a perk. Better weapons and armor equip automatically.</div>
    <div><b>Items</b>Potions heal or empower you, scrolls teleport, map or enchant, and Fire Flasks explode. They sit in the bar at the bottom.</div>
    <div class="k-kbonly"><b>Keyboard</b>WASD or arrows move · Q E Z C diagonals · Space waits · 1 2 abilities · 3-9 items · X explores · Enter descends · M map · Esc menu</div>
    <div class="k-touchonly"><b>Touch</b>Tap a tile to walk there, tap an adjacent enemy to attack, tap yourself to wait. Use the bar for abilities and items.</div>
    <div><b>Controller</b>Stick or D-pad moves · A waits or fires · X and Y abilities · LB drinks a healing potion · RB explores · Back map · Start menu</div></div>`, { back, cls: "top" });
}
function settings(back) { const s = K.ui.show(`<div class="k-bar"><h2>Settings</h2><button class="k-btn" data-a="${back}">Back</button></div><div class="k-panel" style="width:min(100%,30em);display:flex;flex-direction:column;align-items:center">${K.ui.settingsRows()}</div>`, { back, cls: "top" }); K.ui.bindSettings(s); }
K.ui.on(async (a, d) => {
  switch (a) {
    case "cls": SAVE.cls = d.k; persist(); K.sfx("click"); for (const b of $$(".cls")) b.classList.toggle("on", b.dataset.k === d.k); { const s = $('[data-a="start"] small'); if (s) s.textContent = `New run as ${CLASSES[d.k].name}`; } return;
    case "start": case "again": if (SAVE.run && a === "start") { const ok = await K.confirm({ title: "Start a new run?", text: "Your saved run will be lost.", yes: "Start over", danger: true, focusNo: true }); if (!ok) return; } K.sfx("ok"); return newRun(SAVE.cls, a === "again" && G && G.daily);
    case "daily": if (SAVE.run) { const ok = await K.confirm({ title: "Start the Daily Descent?", text: "Your saved run will be lost.", yes: "Start", danger: true, focusNo: true }); if (!ok) return; } K.sfx("ok"); return newRun(SAVE.cls, true);
    case "resume": K.sfx("ok"); return resume();
    case "close": K.sfx("back"); K.ui.hide(); MODE = "play"; return;
    case "help": K.sfx("ok"); return help(MODE === "title" ? "title" : "menu");
    case "settings": K.sfx("ok"); return settings(MODE === "title" ? "title" : "menu");
    case "menu": K.ui.hide(); MODE = "play"; return menu();
    case "title": K.sfx("back"); return title();
    case "quit": K.sfx("back"); return title();
    case "abandon": { const ok = await K.confirm({ title: "Abandon this run?", text: "It will count as a death.", yes: "Abandon", danger: true, focusNo: true }); if (!ok) return; G.killer = "giving up"; K.ui.hide(); MODE = "play"; return die(); }
    case "perk": K.sfx("ok"); PERKS[d.k].f(); P.perks[d.k] = (P.perks[d.k] || 0) + 1; msg(`You learn ${PERKS[d.k].name}.`, "#ffd479"); K.ui.hide(); MODE = "play"; hud(); buildBar(); checkLevel(); return;
  }
});

/* ================= input ================= */
const MOVES = { ArrowUp: [0, -1], KeyW: [0, -1], Numpad8: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], Numpad2: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], Numpad4: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], Numpad6: [1, 0], KeyQ: [-1, -1], Numpad7: [-1, -1], KeyE: [1, -1], Numpad9: [1, -1], KeyZ: [-1, 1], Numpad1: [-1, 1], KeyC: [1, 1], Numpad3: [1, 1] };
let lastKey = 0;
addEventListener("keydown", (e) => {
  if (e.defaultPrevented || K.ui.active()) return;
  if (SHOWMAP && (e.code === "KeyM" || e.code === "Escape")) { SHOWMAP = false; e.preventDefault(); return; }
  if (MODE === "target") {
    const t = TGT; if (e.code === "Escape") { cancelTarget(); return; }
    if (e.code === "Tab" || e.code === "ArrowRight" || e.code === "ArrowDown" || e.code === "KeyD") { t.i = (t.i + 1) % t.list.length; K.sfx("move"); e.preventDefault(); return; }
    if (e.code === "ArrowLeft" || e.code === "ArrowUp" || e.code === "KeyA") { t.i = (t.i + t.list.length - 1) % t.list.length; K.sfx("move"); e.preventDefault(); return; }
    if (e.code === "Enter" || e.code === "Space" || e.code === "KeyF" || (e.key === "1" && t.kind === "abil" && CLASSES[P.cls].abil[0] === t.id) || (e.key === "2" && t.kind === "abil" && CLASSES[P.cls].abil[1] === t.id)) { fireTarget(); e.preventDefault(); return; }
    return;
  }
  if (MODE !== "play") return;
  const now = performance.now(); if (e.repeat && now - lastKey < 90) return; lastKey = now;
  const mv = MOVES[e.code]; if (mv) { PATH = null; EXPLORING = false; tryMove(mv[0], mv[1]); e.preventDefault(); return; }
  if (e.code === "Space" || e.code === "Period" || e.code === "Numpad5") { PATH = null; wait(); e.preventDefault(); return; }
  if (e.code === "Enter" || e.key === ">") { descend(); return; }
  if (e.key === "1" || e.key === "2") { useAbility(+e.key - 1); return; }
  const n = +e.key; if (n >= 3 && n <= 9) { const ids = ITEMORDER.filter((id) => P.inv[id]); if (ids[n - 3]) useItem(ids[n - 3]); return; }
  if (e.code === "KeyX") return explore(); if (e.code === "KeyM") { SHOWMAP = !SHOWMAP; return; } if (e.code === "Escape") return menu();
});
cv.addEventListener("pointerdown", (e) => {
  K.audio(); if (K.ui.active() || !G || !P) return;
  if (SHOWMAP) { SHOWMAP = false; return; }
  const ox = Math.round(CW / 2 - G.cam.x), oy = Math.round(CH / 2 - G.cam.y - TS * 0.3), x = Math.floor((e.clientX - ox) / TS), y = Math.floor((e.clientY - oy) / TS);
  if (MODE === "target") { const m = TGT.list.find((o) => o.x === x && o.y === y); if (m) { TGT.i = TGT.list.indexOf(m); fireTarget(m); } else cancelTarget(); return; }
  if (MODE !== "play" || !inb(x, y)) return;
  PATH = null; EXPLORING = false;
  const m = monAt(x, y); if (m && vis[idx(x, y)] && cheb(m, P) > 1) { const p = findPath(x, y); if (p && p.length > 1) setPath(p.slice(0, -1), false); return; }
  walkTo(x, y);
});
let padT = 0, padDir = -1;
function pollPad(dt) {
  const P2 = K.pad; if (!P2.connected) return; const pr = P2.pressed;
  if (SHOWMAP && (pr.back || pr.b || pr.a)) { SHOWMAP = false; return; }
  if (MODE === "target") { if (pr.dl || pr.lb || pr.du) { TGT.i = (TGT.i + TGT.list.length - 1) % TGT.list.length; K.sfx("move"); } if (pr.dr || pr.rb || pr.dd) { TGT.i = (TGT.i + 1) % TGT.list.length; K.sfx("move"); } if (pr.a || pr.x || pr.y) fireTarget(); if (pr.b) cancelTarget(); return; }
  if (MODE !== "play") return;
  if (pr.start) return menu(); if (pr.back) { SHOWMAP = !SHOWMAP; return; }
  if (pr.x) return useAbility(0); if (pr.y) return useAbility(1); if (pr.lb) { if (P.inv.heal) useItem("heal"); return; } if (pr.rb) return explore();
  if (pr.a) { if (map[idx(P.x, P.y)] === STAIRS) return descend(); return wait(); }
  const H = P2.held; let vx = (H.dr ? 1 : 0) - (H.dl ? 1 : 0), vy = (H.dd ? 1 : 0) - (H.du ? 1 : 0);
  if (!vx && !vy && Math.hypot(P2.ax, P2.ay) > 0.5) { const a = Math.atan2(P2.ay, P2.ax), oct = Math.round(a / (Math.PI / 4)); vx = Math.round(Math.cos(oct * Math.PI / 4)); vy = Math.round(Math.sin(oct * Math.PI / 4)); }
  const dir = vx || vy ? (vy + 1) * 3 + (vx + 1) : -1;
  if (dir < 0) { padDir = -1; return; }
  if (dir !== padDir) { padDir = dir; padT = 0.22; PATH = null; tryMove(vx, vy); return; }
  padT -= dt; if (padT <= 0) { padT = 0.12; tryMove(vx, vy); }
}

/* ================= audio ================= */
K.defineSfx({
  step: (t) => K.noise(t, 0.04, { filter: "lowpass", freq: 700, vol: 0.035 }),
  hit: (t) => { K.noise(t, 0.09, { filter: "lowpass", freq: 1600, vol: 0.12 }); K.voice(150, t, 0.08, { type: "square", vol: 0.04, lp: 900 }); },
  miss: (t) => K.noise(t, 0.08, { filter: "highpass", freq: 2500, slide: 0.5, vol: 0.04 }),
  hurt: (t) => { K.noise(t, 0.14, { filter: "lowpass", freq: 900, vol: 0.14 }); K.voice(190, t, 0.14, { type: "sawtooth", vol: 0.045, slide: 0.6, lp: 1200 }); },
  kill: (t) => { K.noise(t, 0.3, { filter: "lowpass", freq: 900, slide: 0.3, vol: 0.12 }); K.voice(330, t, 0.25, { type: "triangle", vol: 0.05, slide: 0.4 }); },
  bossdie: (t) => { K.noise(t, 1.2, { filter: "lowpass", freq: 700, slide: 0.2, vol: 0.2 }); K.notes(t + 0.2, [392, 330, 262, 196, 131], 0.15, { type: "triangle", vol: 0.07, len: 0.6 }); },
  coin: (t) => { K.voice(1318, t, 0.05, { duty: 0.5, vol: 0.035 }); K.voice(1760, t + 0.05, 0.1, { duty: 0.5, vol: 0.035 }); },
  pickup: (t) => K.notes(t, [660, 990], 0.05, { type: "triangle", vol: 0.05, len: 0.14 }),
  equip: (t) => K.notes(t, [392, 523, 784], 0.06, { duty: 0.25, vol: 0.05, len: 0.2 }),
  drink: (t) => { for (let i = 0; i < 4; i++) K.voice(300 + i * 90, t + i * 0.05, 0.06, { type: "sine", vol: 0.04 }); },
  scroll: (t) => { K.noise(t, 0.2, { filter: "bandpass", freq: 3000, vol: 0.04 }); K.notes(t + 0.05, [784, 1046, 1318], 0.06, { type: "sine", vol: 0.04, len: 0.3 }); },
  door: (t) => K.voice(140, t, 0.18, { type: "sawtooth", vol: 0.03, slide: 1.4, lp: 600 }),
  stairs: (t) => { for (let i = 0; i < 5; i++) K.noise(t + i * 0.09, 0.07, { filter: "lowpass", freq: 600 - i * 80, vol: 0.06 }); },
  level: (t) => K.notes(t, [523, 659, 784, 1046, 1318], 0.07, { duty: 0.25, vol: 0.05, len: 0.4 }),
  cleave: (t) => K.noise(t, 0.2, { filter: "bandpass", freq: 1800, slide: 0.4, vol: 0.12 }),
  heal: (t) => K.notes(t, [523, 659, 880], 0.06, { type: "sine", vol: 0.05, len: 0.3 }),
  vanish: (t) => K.voice(900, t, 0.4, { type: "sine", vol: 0.04, slide: 0.3 }),
  nova: (t) => { K.noise(t, 0.5, { filter: "highpass", freq: 3000, vol: 0.06 }); K.voice(1600, t, 0.4, { type: "sine", vol: 0.04, slide: 0.5 }); },
  fire: (t) => K.noise(t, 0.3, { filter: "bandpass", freq: 900, slide: 2.2, vol: 0.1 }),
  throw: (t) => K.noise(t, 0.12, { filter: "highpass", freq: 2000, slide: 1.6, vol: 0.06 }),
  boom: (t) => { K.noise(t, 0.6, { filter: "lowpass", freq: 900, slide: 0.25, vol: 0.2 }); K.voice(70, t, 0.5, { type: "sine", vol: 0.15, slide: 0.5 }); },
  bow: (t) => K.voice(500, t, 0.08, { type: "triangle", vol: 0.04, slide: 0.5 }),
  zap: (t) => K.voice(800, t, 0.18, { type: "sawtooth", vol: 0.035, slide: 0.4, lp: 2400 }),
  blink: (t) => K.voice(400, t, 0.25, { type: "sine", vol: 0.05, slide: 3 }),
  summon: (t) => K.notes(t, [196, 185, 175], 0.12, { type: "sawtooth", vol: 0.04, len: 0.3, lp: 900 }),
  die: (t) => K.notes(t, [392, 330, 262, 196, 147], 0.18, { type: "triangle", vol: 0.07, len: 0.5 }),
  win: (t) => K.notes(t, [523, 659, 784, 1046, 1318, 1568, 2093], 0.1, { duty: 0.25, vol: 0.05, len: 0.6 }),
}, { step: 0.05, hit: 0.03, miss: 0.04 });
K.songs({
  title: { bpm: 70, chords: ["Am", "F", "C", "G"], pad: true, padVol: 0.024, arp: true, arpVol: 0.014, arpPat: [0, 2, 1, 2], arpWave: "triangle", bass: "R . . . . . . . R . . . . . . .", bassVol: 0.08 },
  dungeon: { bpm: 84, chords: ["Dm", "Dm", "Bb", "A"], pad: true, padVol: 0.02, arp: true, arpVol: 0.013, arpPat: [0, 1, 2, 1], arpWave: "triangle", bass: "R . . . . . R . R . . . . . . .", bassVol: 0.08, drums: "k . . . h . . . k . . . h . . .", lead: ["d5 - - - f5 - e5 -", "d5 - - - a4 - - -", "bb4 - d5 - f5 - d5 -", "c#5 - - - e5 - - -"], leadVol: 0.022, leadWave: "triangle" },
  deep: { bpm: 76, chords: ["Em", "C", "Am", "B"], pad: true, padVol: 0.022, arp: true, arpVol: 0.012, arpPat: [0, 2, 1, 3], arpWave: "sine", bass: "R . . R . . . . R . . . . . . .", bassVol: 0.09, bassWave: "sawtooth", bassLp: 500, drums: "k . . . . . h . k . . . . . h .", lead: ["e5 - - - g5 - - -", "e5 - - - c5 - - -", "a4 - c5 - e5 - - -", "d#5 - - - f#5 - - -"], leadVol: 0.02, leadWave: "sine" },
  boss: { bpm: 132, chords: ["Cm", "Ab", "Fm", "G"], bass: "R R O R R O R O R R O R R O F O", bassWave: "sawtooth", bassVol: 0.07, bassLp: 800, drums: "k . h k s . h . k k h . s . h s", arp: true, arpVol: 0.017, arpPat: [0, 2, 1, 3], lead: ["c5 - eb5 - g5 - c6 -", "ab5 - - - g5 - eb5 -", "f5 - ab5 - c6 - f5 -", "b5 - - - d6 - - -"], leadVol: 0.034 },
});

/* ================= boot ================= */
$("#menuBtn").onclick = () => menu();
$("#tip").textContent = "";
resize();
K.loop((dt) => { if (!K.ui.active()) { pollPad(dt); stepPath(dt); } render(dt); });
document.fonts.load('700 20px "Pixelify Sans"').then(() => { if (MODE === "title") title(); }).catch(() => {});
title();
