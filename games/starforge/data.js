"use strict";
/* STARFORGE · data.js — forges, upgrades, achievements, constellations, news. No DOM in here. */

const GENS = [
  { id: "spark", name: "Spark", plural: "Sparks", cost: 15, prod: 0.1, hue: 48, desc: "A flicker of light, coaxed out of nothing." },
  { id: "comet", name: "Comet", plural: "Comets", cost: 100, prod: 1, hue: 190, desc: "Sweeps up loose dust on every pass." },
  { id: "moon", name: "Moon", plural: "Moons", cost: 1100, prod: 8, hue: 220, desc: "Its tides grind rock into stardust." },
  { id: "planet", name: "Planet", plural: "Planets", cost: 12000, prod: 47, hue: 150, desc: "A whole world of forges." },
  { id: "giant", name: "Gas Giant", plural: "Gas Giants", cost: 130000, prod: 260, hue: 28, desc: "Storms spin stardust out of vapor." },
  { id: "star", name: "Star", plural: "Stars", cost: 1.4e6, prod: 1400, hue: 42, desc: "Fusion, but for stardust." },
  { id: "nebula", name: "Nebula", plural: "Nebulae", cost: 2e7, prod: 7800, hue: 300, desc: "A nursery where dust is born." },
  { id: "pulsar", name: "Pulsar", plural: "Pulsars", cost: 3.3e8, prod: 44000, hue: 200, desc: "Beats out stardust like a drum." },
  { id: "hole", name: "Black Hole", plural: "Black Holes", cost: 5.1e9, prod: 260000, hue: 270, desc: "What falls in comes back out as dust." },
  { id: "galaxy", name: "Galaxy", plural: "Galaxies", cost: 7.5e10, prod: 1.6e6, hue: 320, desc: "A hundred billion forges, all yours." },
  { id: "quasar", name: "Quasar", plural: "Quasars", cost: 1e12, prod: 1e7, hue: 180, desc: "The brightest engine in the sky." },
  { id: "string", name: "Cosmic String", plural: "Cosmic Strings", cost: 1.4e13, prod: 6.5e7, hue: 90, desc: "Pluck it and dust falls out." },
  { id: "multi", name: "Multiverse", plural: "Multiverses", cost: 1.7e14, prod: 4.3e8, hue: 340, desc: "Borrows stardust from other universes." },
  { id: "bang", name: "Big Bang", plural: "Big Bangs", cost: 2.1e15, prod: 2.9e9, hue: 10, desc: "Start a universe. Keep the dust." },
];
for (const g of GENS) g.prod *= 2;
const GEN_IDX = Object.fromEntries(GENS.map((g, i) => [g.id, i]));
const COST_GROWTH = 1.15;

/* ---------- upgrades ---------- */
const TIER_OWN = [1, 5, 25, 50, 100, 150, 200, 250];
const TIER_COST = [10, 50, 500, 5e4, 5e6, 5e8, 5e10, 5e12];
const TIER_ADJ = ["Kindled", "Polished", "Resonant", "Radiant", "Celestial", "Eternal", "Mythic", "Transcendent"];
const UPGRADES = [];
GENS.forEach((g, gi) => {
  TIER_OWN.forEach((own, t) => {
    UPGRADES.push({
      id: `${g.id}${t}`, name: `${TIER_ADJ[t]} ${g.plural}`, cost: g.cost * TIER_COST[t], kind: "gen", gen: gi, mult: 2,
      desc: `${g.plural} are twice as productive.` + (gi === 0 && t < 3 ? " Clicking is twice as strong too." : ""),
      req: (s) => s.owned[gi] >= own, tier: t, icon: g.id,
    });
  });
});
const CLICK_UPS = [
  ["Steady Hand", 100, 0, "Clicking is twice as strong."],
  ["Forge Gloves", 5e4, 0.01, "Each click also gives 1% of your stardust per second."],
  ["Stellar Gauntlet", 5e6, 0.01, "Each click gives another 1% of your stardust per second."],
  ["Hammer of Dawn", 5e8, 0.01, "Each click gives another 1% of your stardust per second."],
  ["Anvil of Night", 5e10, 0.01, "Each click gives another 1% of your stardust per second."],
  ["Starstrike", 5e12, 0.01, "Each click gives another 1% of your stardust per second."],
  ["Fist of Creation", 5e14, 0.01, "Each click gives another 1% of your stardust per second."],
];
CLICK_UPS.forEach(([name, cost, cps, desc], i) => UPGRADES.push({ id: "click" + i, name, cost, kind: "click", cps, double: i === 0, desc, req: (s) => s.clicks >= [15, 300, 1500, 4000, 9000, 15000, 25000][i] || s.runTotal >= cost * 4, icon: "click" }));
const CHART_UPS = [
  ["Star Chart I", 9e4, 10, 0.01], ["Star Chart II", 9e6, 25, 0.015], ["Star Chart III", 9e8, 40, 0.02], ["Star Chart IV", 9e10, 55, 0.025],
  ["Star Chart V", 9e12, 70, 0.03], ["Star Chart VI", 9e14, 85, 0.035], ["Star Chart VII", 9e16, 100, 0.04],
];
CHART_UPS.forEach(([name, cost, need, per], i) => UPGRADES.push({ id: "chart" + i, name, cost, kind: "chart", per, desc: `+${(per * 100).toFixed(1).replace(/\.0$/, "")}% stardust per second for every achievement you have.`, req: (s) => s.achCount >= need, icon: "chart" }));
const SYNERGY_UPS = [
  ["Comet Trails", 2.5e5, 1, 0, 0.02, 15, 15],
  ["Tidal Forges", 3e7, 2, 3, 0.01, 25, 25],
  ["Ring Harvest", 4e9, 4, 3, 0.01, 25, 25],
  ["Stellar Winds", 6e11, 5, 6, 0.01, 50, 50],
  ["Event Horizon", 9e13, 8, 9, 0.005, 50, 50],
  ["Quasar Lens", 2e16, 10, 11, 0.005, 75, 75],
];
SYNERGY_UPS.forEach(([name, cost, a, b, per, na, nb], i) => UPGRADES.push({
  id: "syn" + i, name, cost, kind: "syn", a, b, per,
  desc: `${GENS[b].plural} gain +${(per * 100).toFixed(1).replace(/\.0$/, "")}% for every ${GENS[a].name}, and ${GENS[a].plural} gain +${(per * 100).toFixed(1).replace(/\.0$/, "")}% for every ${GENS[b].name}.`,
  req: (s) => s.owned[a] >= na && s.owned[b] >= nb, icon: GENS[b].id,
}));
const COMET_UPS = [
  ["Comet Lure", 7.7e6, 7, "Golden comets appear 15% more often."],
  ["Long Tail", 7.7e8, 27, "Golden comet effects last 20% longer."],
  ["Comet Net", 7.7e10, 77, "Golden comets stay on screen twice as long."],
];
COMET_UPS.forEach(([name, cost, need, desc], i) => UPGRADES.push({ id: "cometup" + i, name, cost, kind: "comet", n: i, desc, req: (s) => s.comets >= need, icon: "goldcomet" }));
const UPG = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

/* ---------- constellations (prestige tree, paid with remnants) ---------- */
const TREE = [
  { id: "first", name: "First Light", cost: 1, x: 50, y: 52, desc: "+10% stardust per second.", parent: null },
  { id: "twins", name: "Twin Sparks", cost: 3, x: 36, y: 40, desc: "Start every run with 10 Sparks and 5 Comets.", parent: "first" },
  { id: "nursery", name: "Stellar Nursery", cost: 10, x: 24, y: 30, desc: "Forges cost 5% less.", parent: "twins" },
  { id: "ratio", name: "Golden Ratio", cost: 30, x: 14, y: 18, desc: "Upgrades cost 10% less.", parent: "nursery" },
  { id: "momentum", name: "Momentum", cost: 75, x: 8, y: 34, desc: "+2% stardust per second for every supernova (up to +60%).", parent: "ratio" },
  { id: "pulse", name: "Steady Pulse", cost: 2, x: 64, y: 40, desc: "Clicking is twice as strong.", parent: "first" },
  { id: "hammer", name: "Star Hammer", cost: 8, x: 76, y: 30, desc: "Each click also gives 2% of your stardust per second.", parent: "pulse" },
  { id: "crit", name: "Critical Strike", cost: 25, x: 86, y: 18, desc: "1 click in 10 is a critical hit worth 10 times as much.", parent: "hammer" },
  { id: "season", name: "Comet Season", cost: 3, x: 64, y: 66, desc: "Golden comets appear 20% more often.", parent: "first" },
  { id: "linger", name: "Lingering Light", cost: 12, x: 76, y: 76, desc: "Golden comet effects last 25% longer.", parent: "season" },
  { id: "starfall", name: "Starfall", cost: 40, x: 88, y: 86, desc: "Golden comets can trigger a Starfall: a shower of small comets.", parent: "linger" },
  { id: "dream", name: "Dreaming Forges", cost: 2, x: 36, y: 66, desc: "Forges work at 75% while you're away (up from 50%).", parent: "first" },
  { id: "sleep", name: "Deep Sleep", cost: 15, x: 24, y: 76, desc: "Forges work at 100% while you're away.", parent: "dream" },
  { id: "night", name: "Long Night", cost: 45, x: 12, y: 86, desc: "Time away counts for up to 72 hours (up from 24).", parent: "sleep" },
  { id: "echo", name: "Echoes", cost: 6, x: 50, y: 30, desc: "Keep your first upgrade for every forge after a supernova.", parent: "first" },
  { id: "recall", name: "Recollection", cost: 20, x: 50, y: 16, desc: "Start every run with stardust equal to 10 minutes of your best production rate.", parent: "echo" },
  { id: "map", name: "Constellation Map", cost: 60, x: 50, y: 4, desc: "Every achievement gives +1% stardust per second, always.", parent: "recall" },
  { id: "sun2", name: "Second Sun", cost: 120, x: 36, y: 8, desc: "+50% stardust per second.", parent: "map" },
  { id: "infinite", name: "Infinite Forge", cost: 400, x: 64, y: 8, desc: "+100% stardust per second, and forges cost 5% less again.", parent: "map" },
  { id: "gravity", name: "Gravity Well", cost: 150, x: 50, y: 86, desc: "Clicking also pulls in 5% of a golden comet's power: clicks are 50% stronger.", parent: "season" },
];
const TREE_IDX = Object.fromEntries(TREE.map((n) => [n.id, n]));

/* ---------- prestige ---------- */
const PRESTIGE_DIV = 1e8, PRESTIGE_BONUS = 0.04;
const levelFor = (allTime) => Math.floor(Math.sqrt(Math.max(0, allTime) / PRESTIGE_DIV));
const allTimeFor = (level) => level * level * PRESTIGE_DIV;

/* ---------- achievements ---------- */
const ACHS = [];
const big = (n) => n;
[[1e3, "First Light"], [1e6, "Million Motes"], [1e9, "Billion Glimmers"], [1e12, "Trillion Twinkles"], [1e15, "Bright Horizon"], [1e18, "Starsea"], [1e21, "Cosmic Weaver"], [1e24, "Forge of Ages"], [1e27, "Beyond Counting"], [1e30, "The Last Number"]]
  .forEach(([v, name], i) => ACHS.push({ id: "tot" + i, name, desc: `Forge ${v.toExponential(0).replace("e+", "e")} stardust in total.`, test: (s) => s.allTime >= v, v }));
[[10, "Warm Glow"], [1e3, "Steady Flow"], [1e5, "River of Light"], [1e7, "Stellar Engine"], [1e9, "Galactic Output"], [1e11, "Unbound"], [1e13, "Overflowing"], [1e15, "Infinite Furnace"]]
  .forEach(([v, name], i) => ACHS.push({ id: "cps" + i, name, desc: `Make ${v.toExponential(0).replace("e+", "e")} stardust per second.`, test: (s) => s.cps >= v, v }));
[[100, "Tap Tap"], [1000, "Busy Hands"], [5000, "Tireless"], [25000, "Hammerfall"]]
  .forEach(([v, name], i) => ACHS.push({ id: "clk" + i, name, desc: `Click the forge ${v.toLocaleString("en-US")} times.`, test: (s) => s.clicksAll >= v }));
[[1e3, "Handmade"], [1e6, "Forged by Hand"], [1e9, "Iron Grip"], [1e12, "Stardust Smith"]]
  .forEach(([v, name], i) => ACHS.push({ id: "clkd" + i, name, desc: `Make ${v.toExponential(0).replace("e+", "e")} stardust by clicking.`, test: (s) => s.clickDust >= v }));
GENS.forEach((g, gi) => {
  [[1, "First"], [50, "A Few"], [100, "Hundred"], [200, "Fleet of"]].forEach(([n, word], k) => {
    const names = [`First ${g.name}`, `${g.plural} Galore`, `Hundred ${g.plural}`, `${g.name} Empire`];
    ACHS.push({ id: `own${g.id}${k}`, name: names[k], desc: `Own ${n} ${n === 1 ? g.name : g.plural}.`, test: (s) => s.owned[gi] >= n });
  });
});
[[100, "Workshop"], [500, "Foundry"], [1000, "Forgeworks"], [2500, "Industrial Cosmos"]]
  .forEach(([v, name], i) => ACHS.push({ id: "bld" + i, name, desc: `Own ${v.toLocaleString("en-US")} forges at once.`, test: (s) => s.totalOwned >= v }));
[[1, "Wish Granted"], [7, "Lucky Seven"], [27, "Comet Chaser"], [77, "Golden Touch"], [277, "Starcatcher"]]
  .forEach(([v, name], i) => ACHS.push({ id: "cmt" + i, name, desc: `Catch ${v} golden comet${v > 1 ? "s" : ""}.`, test: (s) => s.cometsAll >= v }));
[[1, "Supernova"], [5, "Star Cycle"], [15, "Rebirth"], [40, "Eternal Return"]]
  .forEach(([v, name], i) => ACHS.push({ id: "nova" + i, name, desc: `Go supernova ${v} time${v > 1 ? "s" : ""}.`, test: (s) => s.novas >= v }));
[[10, "Remnant"], [100, "Stellar Core"], [1000, "Neutron Heart"], [10000, "Singularity"]]
  .forEach(([v, name], i) => ACHS.push({ id: "lvl" + i, name, desc: `Reach ${v.toLocaleString("en-US")} remnants in total.`, test: (s) => s.level >= v }));
[[25, "Tinkerer"], [75, "Inventor"], [150, "Visionary"]]
  .forEach(([v, name], i) => ACHS.push({ id: "upg" + i, name, desc: `Own ${v} upgrades.`, test: (s) => s.upgCount >= v }));
ACHS.push({ id: "tree5", name: "Stargazer", desc: "Light 5 constellations.", test: (s) => s.treeCount >= 5 });
ACHS.push({ id: "treeall", name: "Whole Sky", desc: "Light every constellation.", test: (s) => s.treeCount >= TREE.length });
ACHS.push({ id: "away", name: "Sleeping Giant", desc: "Come back after at least an hour away.", test: (s) => s.awayBest >= 3600 });
ACHS.push({ id: "fast", name: "Quick Start", desc: "Forge a million stardust within 10 minutes of a run starting.", test: (s) => s.runTotal >= 1e6 && s.runTime <= 600 });
ACHS.push({ id: "storm", name: "Click Storm", desc: "Click 15 times in a single second.", test: (s) => s.clickBurst >= 15 });
ACHS.push({ id: "frugal", name: "Minimalist", desc: "Make 1 million stardust per second with 100 forges or fewer.", test: (s) => s.cps >= 1e6 && s.totalOwned <= 100 });
const ACH_IDX = Object.fromEntries(ACHS.map((a) => [a.id, a]));

/* ---------- news ticker (unlocks as you progress) ---------- */
const NEWS = [
  [0, "Local astronomer reports 'a weird glow' in an empty patch of sky."],
  [0, "Experts agree: stardust is not, in fact, regular dust."],
  [1, "Sparks spotted dancing in formation. Scientists call it 'showing off'."],
  [2, "Comet passes Earth, waves."],
  [2, "Tail of passing comet found to be 98% stardust, 2% enthusiasm."],
  [3, "Moon declares itself 'more of a forge, really'."],
  [3, "Tides now come in twice a day and leave a sparkly residue."],
  [4, "New planet discovered. Its only export is stardust."],
  [4, "Planetary council votes to rename the planet 'Forgey McForgeface'. Vote is overturned."],
  [5, "Gas giant's great storm now visible from three galaxies away."],
  [6, "Star goes up for sale. Comes with a warranty."],
  [6, "Sun-like star refuses to set. 'Too much work to do,' it says."],
  [7, "Nebula announces baby stars. Mother and stars doing well."],
  [8, "Pulsar keeps perfect time. Musicians furious."],
  [9, "Black hole spotted returning everything it ever ate, as dust."],
  [9, "Physicists rewrite textbooks again. Publishers thrilled."],
  [10, "Galaxy collision ends amicably. Both sides keep their stardust."],
  [11, "Quasar outshines everything. Other quasars 'not impressed'."],
  [12, "Cosmic string snaps; universe barely notices; stardust everywhere."],
  [13, "Other universes file a complaint about missing stardust. Complaint is lost."],
  [14, "A new universe begins. First words: 'more dust, please'."],
  [0, "Tip: golden comets fly by now and then. Catch them for big rewards."],
  [1, "Tip: upgrades appear in the Upgrades tab once you qualify for them."],
  [3, "Tip: each achievement brightens your Star Charts."],
  [5, "Tip: when the run slows down, a supernova trades it all for permanent power."],
];
