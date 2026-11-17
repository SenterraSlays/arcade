"use strict";
/* GRIDLOCK · data.js — towers, enemies, difficulty, achievements, music */

const COLS = 20, ROWS = 12;
const T_EMPTY = 0, T_PATH = 1, T_BLOCK = 2, T_PAD = 3, T_SPAWN = 4, T_CORE = 5;
const WIN_WAVE = 30;

/* Towers: per-level arrays are levels 1..4. ups = upgrade prices to reach levels 2, 3 and 4. */
const TOWERS = {
  pulse: {
    name: "Pulse", rgb: "62,240,255", cost: 50, ups: [60, 110, 220], air: true,
    desc: "Fast single-target shots. Cheap and dependable.",
    dmg: [8, 13, 20, 32], rate: [2.5, 2.8, 3.2, 4.0], range: [2.6, 2.8, 3.0, 3.3],
    perk: "Every 6th shot fires a burst of 3.",
  },
  cannon: {
    name: "Cannon", rgb: "255,177,59", cost: 90, ups: [80, 150, 300], air: false,
    desc: "Explosive shells hurt everything near the target. Can't hit drones.",
    dmg: [24, 38, 60, 100], rate: [0.75, 0.8, 0.9, 1.0], range: [2.4, 2.6, 2.8, 3.0], splash: [0.85, 0.95, 1.05, 1.2],
    perk: "Shells burst into 4 bomblets.",
  },
  cryo: {
    name: "Cryo", rgb: "143,216,255", cost: 70, ups: [70, 130, 250], air: true,
    desc: "Chills everything in range, slowing it down and dealing light damage.",
    dps: [4, 8, 14, 24], slow: [0.3, 0.38, 0.45, 0.55], range: [1.8, 2.0, 2.2, 2.5],
    perk: "Chilled enemies take 20% more damage from every tower.",
  },
  arc: {
    name: "Arc", rgb: "179,136,255", cost: 110, ups: [100, 190, 360], air: true,
    desc: "Lightning jumps between enemies and cuts through half their armor.",
    dmg: [16, 26, 40, 64], rate: [1.1, 1.2, 1.35, 1.5], range: [2.2, 2.4, 2.6, 2.8], chains: [3, 3, 4, 6],
    perk: "Jumps 6 times and can stun.",
  },
  laser: {
    name: "Laser", rgb: "255,62,142", cost: 140, ups: [130, 240, 450], air: true,
    desc: "A beam that grows stronger the longer it holds one target. Triple damage to shields.",
    dps: [22, 36, 58, 95], range: [2.8, 3.0, 3.2, 3.5],
    perk: "The beam splits onto a second target.",
  },
  mortar: {
    name: "Mortar", rgb: "255,106,61", cost: 150, ups: [120, 230, 420], air: false,
    desc: "Long-range artillery with a big blast. Can't fire up close or at drones.",
    dmg: [45, 75, 120, 200], rate: [0.4, 0.45, 0.5, 0.55], range: [5, 5.5, 6, 7], splash: [1.1, 1.2, 1.35, 1.5], minRange: 1.5,
    perk: "Blasts leave burning ground behind.",
  },
  rail: {
    name: "Railgun", rgb: "232,246,255", cost: 200, ups: [180, 330, 600], air: true,
    desc: "Pierces every enemy in a line and ignores armor.",
    dmg: [90, 150, 240, 400], rate: [0.35, 0.38, 0.42, 0.5], range: [5, 5.5, 6, 7],
    perk: "Hits stun enemies for a moment.",
  },
  amp: {
    name: "Amplifier", rgb: "125,255,154", cost: 120, ups: [120, 220, 400], support: true, air: true,
    desc: "Boosts the damage and range of towers next to it.",
    radius: [1.5, 1.6, 1.8, 2.1], boost: [0.2, 0.3, 0.4, 0.55], rboost: [0.1, 0.12, 0.15, 0.2],
    perk: "Nearby towers also fire 15% faster.",
  },
  miner: {
    name: "Miner", rgb: "255,225,77", cost: 100, ups: [100, 180, 320], support: true, air: true,
    desc: "Mines credits at the end of every wave.",
    income: [25, 50, 85, 140],
    perk: "Also pays 2% interest on your credits each wave (up to 60).",
  },
};
const TOWER_ORDER = ["pulse", "cannon", "cryo", "arc", "laser", "mortar", "rail", "amp", "miner"];
const START_TOWERS = ["pulse", "cannon", "cryo", "arc", "amp"];
for (const id in TOWERS) { TOWERS[id].id = id; TOWERS[id].color = `rgb(${TOWERS[id].rgb})`; }
const TARGETS = [["first", "First"], ["last", "Last"], ["strong", "Strong"], ["close", "Close"]];

const ENEMIES = {
  bit: { name: "Bit", hp: 32, spd: 1.25, bounty: 4, lives: 1, threat: 1, rgb: "62,240,255", shape: "square", size: 0.26, from: 1, gap: 0.62, desc: "A basic glitch." },
  runner: { name: "Runner", hp: 22, spd: 2.2, bounty: 4, lives: 1, threat: 1.1, rgb: "255,225,77", shape: "tri", size: 0.25, from: 3, gap: 0.5, desc: "Fast and fragile." },
  swarm: { name: "Swarm", hp: 11, spd: 1.65, bounty: 1, lives: 1, threat: 0.36, rgb: "255,92,240", shape: "dot", size: 0.15, from: 5, gap: 0.16, desc: "Comes in dense clusters. Blast them." },
  splitter: { name: "Splitter", hp: 70, spd: 1.1, bounty: 6, lives: 1, threat: 2.4, rgb: "200,107,255", shape: "diamond", size: 0.3, from: 6, gap: 0.9, split: "bit", desc: "Breaks into two Bits." },
  brute: { name: "Brute", hp: 150, spd: 0.75, bounty: 12, lives: 2, threat: 4, armor: 3, rgb: "255,138,61", shape: "hex", size: 0.36, from: 7, gap: 1.4, desc: "Armored: every hit does 3 less damage." },
  drone: { name: "Drone", hp: 26, spd: 1.3, bounty: 7, lives: 1, threat: 2.3, rgb: "255,62,94", shape: "chevron", size: 0.27, from: 8, gap: 0.75, air: true, desc: "Flies straight to the core. Cannons and mortars can't hit it." },
  shield: { name: "Warden", hp: 60, shield: 60, spd: 1.0, bounty: 9, lives: 1, threat: 3, rgb: "93,255,138", shape: "circle", size: 0.3, from: 11, gap: 1.0, desc: "A shield soaks up damage first. Lasers tear through it." },
  medic: { name: "Medic", hp: 80, spd: 1.0, bounty: 10, lives: 1, threat: 3, rgb: "255,255,255", shape: "cross", size: 0.3, from: 14, gap: 1.2, heal: 0.08, desc: "Repairs nearby glitches." },
  boss: { name: "Overflow", hp: 1250, spd: 0.48, bounty: 120, lives: 5, threat: 60, armor: 4, rgb: "255,42,106", shape: "oct", size: 0.62, boss: true, gap: 3, desc: "Every 10th wave. Armored, and it bursts into Bits as it takes damage." },
};
for (const id in ENEMIES) { ENEMIES[id].id = id; ENEMIES[id].color = `rgb(${ENEMIES[id].rgb})`; ENEMIES[id].armor = ENEMIES[id].armor || 0; }

const DIFFS = {
  easy: { name: "Easy", lives: 30, credits: 260, hp: 0.8, bounty: 1.1, desc: "30 lives, more credits, weaker glitches." },
  normal: { name: "Normal", lives: 20, credits: 200, hp: 1, bounty: 1, desc: "20 lives. The intended challenge." },
  hard: { name: "Hard", lives: 10, credits: 170, hp: 1.3, bounty: 0.95, desc: "10 lives, tougher glitches, tighter budget." },
};

const ACH = [
  { id: "w5", name: "Boot Sequence", desc: "Clear wave 5.", test: (g) => g.cleared >= 5 },
  { id: "w10", name: "Laser Focus", desc: "Clear wave 10.", test: (g) => g.cleared >= 10, unlock: "laser" },
  { id: "w15", name: "Long Range", desc: "Clear wave 15.", test: (g) => g.cleared >= 15, unlock: "mortar" },
  { id: "credits", name: "Dividends", desc: "Earn 5,000 credits in total.", test: (g) => SAVE.stats.credits + (g && !g.banked ? g.earned : 0) >= 5000, unlock: "miner" },
  { id: "win", name: "System Secure", desc: "Survive all 30 waves.", test: (g) => g.won, unlock: "rail" },
  { id: "boss", name: "Stack Overflow", desc: "Destroy an Overflow boss.", test: (g) => g.bossKills > 0 },
  { id: "max", name: "Overclocked", desc: "Upgrade a tower to level 4.", test: (g) => g.towers.some((t) => t.lv >= 4) },
  { id: "hard", name: "Hardened", desc: "Survive all 30 waves on Hard.", test: (g) => g.won && g.diff === "hard" },
  { id: "flawless", name: "Zero Leaks", desc: "Survive all 30 waves without losing a life.", test: (g) => g.won && g.leaked === 0 },
  { id: "e40", name: "Deep Stack", desc: "Clear wave 40 in Endless.", test: (g) => g.endless && g.cleared >= 40 },
  { id: "e60", name: "Heap Exhaustion", desc: "Clear wave 60 in Endless.", test: (g) => g.endless && g.cleared >= 60 },
  { id: "kills", name: "Garbage Collector", desc: "Destroy 10,000 glitches in total.", test: (g) => SAVE.stats.kills + (g && !g.banked ? g.kills : 0) >= 10000 },
  { id: "daily", name: "Daily Build", desc: "Clear 10 waves on a daily map.", test: (g) => g.daily && g.cleared >= 10 },
  { id: "architect", name: "Architect", desc: "Save a map you made in the editor.", test: () => SAVE.maps.some((m) => m.mine) },
  { id: "lean", name: "Lean Build", desc: "Survive all 30 waves with 10 towers or fewer.", test: (g) => g.won && g.towers.length <= 10 },
];

const SONGS = {
  title: {
    bpm: 92, chords: ["Am", "F", "C", "G", "Am", "F", "G", "Em"], pad: true, arp: true, arpVol: 0.022,
    bass: "R . . . . . . . R . . . O . . .",
    lead: ["e5 - - - - - c5 -", "a4 - - - - - - -", "g4 - c5 - e5 - g5 -", "f5 - e5 - d5 - - -", "e5 - - - a5 - g5 -", "f5 - e5 - c5 - a4 -", "b4 - d5 - g5 - f5 -", "e5 - - - - - - -"],
  },
  game: {
    bpm: 118, chords: ["Em", "C", "G", "D", "Em", "C", "Am", "B"], arp: true, drums: "k . h . s . h . k . h k s . h h",
    bass: "R . R O R . R O R . R O R . F O",
    lead: ["e5 - - - g5 - b5 -", "a5 - g5 - e5 - - -", "d5 - - - g5 - b5 -", "a5 - f#5 - d5 - - -", "e5 - - - g5 - b5 -", "c6 - b5 - g5 - e5 -", "a5 - - - c6 - e6 -", "d#6 - - - b5 - - -"],
  },
  boss: {
    bpm: 140, chords: ["Am", "Am", "F", "E", "Am", "Am", "G", "E"], arp: true, drums: "k . k h s . k h k . k h s h s s", leadVol: 0.045,
    bass: "R R O R R R O R R R O R F F O F",
    lead: ["a4 a4 c5 a4 e5 a4 d5 c5", "a4 a4 c5 a4 g5 - e5 -", "f5 - e5 - c5 - a4 -", "g#4 - b4 - e5 - g#5 -", "a5 - e5 - c5 - a4 -", "c5 b4 a4 g4 a4 - e4 -", "g4 - b4 - d5 - g5 -", "g#5 - e5 - b4 - g#4 -"],
  },
  win: {
    bpm: 104, chords: ["C", "G", "Am", "F", "C", "G", "F", "C"], pad: true, arp: true, drums: "k . . . h . . . k . . . h . . h",
    bass: "R . . . F . . . O . . . F . . .",
    lead: ["e5 - g5 - c6 - - -", "b5 - g5 - d5 - - -", "c5 - e5 - a5 - - -", "a5 - g5 - f5 - - -", "e5 - g5 - c6 - e6 -", "d6 - b5 - g5 - - -", "a5 - c6 - f5 - a5 -", "g5 - - - c6 - - -"],
  },
  lose: {
    bpm: 72, chords: ["Am", "F", "Dm", "E"], pad: true,
    bass: "R . . . . . . . . . . . . . . .",
    lead: ["e5 - - - c5 - - -", "a4 - - - - - - -", "f4 - - - a4 - d5 -", "b4 - - - g#4 - - -"],
  },
};
