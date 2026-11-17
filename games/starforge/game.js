"use strict";
/* STARFORGE · game.js — the economy: production, buying, clicks, golden comets, offline time, supernova.
   No DOM here; ui.js listens through HOOK. */

const HOOK = { toast() {}, ach() {}, comet() {}, buff() {}, nova() {} };
const SAVE_KEY = "starforge.v1";

function freshState() {
  return {
    v: 1, dust: 0, runTotal: 0, allTime: 0, clickDust: 0,
    owned: GENS.map(() => 0), ups: {}, tree: {}, ach: {},
    clicks: 0, clicksAll: 0, comets: 0, cometsAll: 0, novas: 0, level: 0, remnants: 0,
    runTime: 0, playTime: 0, awayBest: 0, bestCps: 0, clickBurst: 0, cometT: 120, buffs: [],
    lastSave: Date.now(), started: Date.now(), savedCps: 0, newsLevel: 0,
    settings: { music: 0.4, sfx: 0.65, fmt: "short", particles: true, flash: true, buyN: 1 },
  };
}
let S = freshState();
const D = { genMult: [], global: 1, cps: 0, baseCps: 0, click: 1, clickMult: 1, clickCps: 0, costMult: 1, upMult: 1, upgCount: 0, treeCount: 0, achCount: 0, totalOwned: 0, cometFreq: 1, cometDur: 1, cometStay: 1, offline: 0.5, offCap: 86400 };

const has = (id) => !!S.ups[id];
const lit = (id) => !!S.tree[id];

/* ---------- derived numbers ---------- */
function recalc() {
  D.achCount = Object.keys(S.ach).length;
  D.upgCount = Object.keys(S.ups).length;
  D.treeCount = Object.keys(S.tree).length;
  D.totalOwned = S.owned.reduce((a, b) => a + b, 0);
  const gm = GENS.map(() => 1);
  let clickMult = 1, clickCps = 0, chart = 0;
  for (const id in S.ups) {
    const u = UPG[id]; if (!u) continue;
    if (u.kind === "gen") { gm[u.gen] *= u.mult; if (u.gen === 0 && u.tier < 3) clickMult *= 2; }
    else if (u.kind === "click") { if (u.double) clickMult *= 2; clickCps += u.cps; }
    else if (u.kind === "chart") chart += u.per;
    else if (u.kind === "syn") { gm[u.b] *= 1 + u.per * S.owned[u.a]; gm[u.a] *= 1 + u.per * S.owned[u.b]; }
  }
  let global = (1 + PRESTIGE_BONUS * S.level) * (1 + chart * D.achCount);
  if (lit("first")) global *= 1.1;
  if (lit("momentum")) global *= 1 + Math.min(0.6, 0.02 * S.novas);
  if (lit("map")) global *= 1 + 0.01 * D.achCount;
  if (lit("sun2")) global *= 1.5;
  if (lit("infinite")) global *= 2;
  if (lit("pulse")) clickMult *= 2;
  if (lit("gravity")) clickMult *= 1.5;
  if (lit("hammer")) clickCps += 0.02;
  D.genMult = gm; D.clickMult = clickMult; D.clickCps = clickCps;
  D.costMult = (lit("nursery") ? 0.95 : 1) * (lit("infinite") ? 0.95 : 1);
  D.upMult = lit("ratio") ? 0.9 : 1;
  D.cometFreq = (has("cometup0") ? 0.85 : 1) * (lit("season") ? 0.8 : 1);
  D.cometDur = (has("cometup1") ? 1.2 : 1) * (lit("linger") ? 1.25 : 1);
  D.cometStay = has("cometup2") ? 2 : 1;
  D.offline = lit("sleep") ? 1 : lit("dream") ? 0.75 : 0.5;
  D.offCap = lit("night") ? 72 * 3600 : 24 * 3600;
  let base = 0;
  for (let i = 0; i < GENS.length; i++) base += GENS[i].prod * S.owned[i] * gm[i];
  D.global = global;
  D.baseCps = base * global;
  D.cps = D.baseCps * buffMult("flare");
  D.click = (1 * clickMult + D.cps * clickCps) * buffMult("storm");
  if (D.baseCps > S.bestCps) S.bestCps = D.baseCps;
}
function genCps(i) { return GENS[i].prod * D.genMult[i] * D.global; }
function buffMult(type) { let m = 1; for (const b of S.buffs) if (b.type === type) m *= b.mult; return m; }

/* ---------- buying ---------- */
function genCost(i, n = 1) {
  const g = GENS[i], first = g.cost * Math.pow(COST_GROWTH, S.owned[i]) * D.costMult;
  return n === 1 ? Math.ceil(first) : Math.ceil((first * (Math.pow(COST_GROWTH, n) - 1)) / (COST_GROWTH - 1));
}
function maxBuy(i) {
  const g = GENS[i], first = g.cost * Math.pow(COST_GROWTH, S.owned[i]) * D.costMult;
  if (S.dust < first) return 0;
  return Math.max(0, Math.floor(Math.log((S.dust * (COST_GROWTH - 1)) / first + 1) / Math.log(COST_GROWTH)));
}
function buyGen(i, n) {
  if (n === "max") n = maxBuy(i);
  n = Math.max(0, n | 0); if (!n) return 0;
  const c = genCost(i, n); if (S.dust < c) return 0;
  S.dust -= c; S.owned[i] += n; recalc(); return n;
}
function upCost(u) { return Math.ceil(u.cost * D.upMult); }
function upAvailable(u) { return !S.ups[u.id] && u.req(S); }
function availableUps() { return UPGRADES.filter(upAvailable).sort((a, b) => upCost(a) - upCost(b)); }
function buyUpgrade(id) {
  const u = UPG[id]; if (!u || S.ups[id] || !u.req(S)) return false;
  const c = upCost(u); if (S.dust < c) return false;
  S.dust -= c; S.ups[id] = 1; recalc(); return true;
}

/* ---------- clicks ---------- */
const clickTimes = [];
function forgeClick(now) {
  let v = D.click, crit = false;
  if (lit("crit") && Math.random() < 0.1) { v *= 10; crit = true; }
  gain(v); S.clickDust += v; S.clicks++; S.clicksAll++;
  clickTimes.push(now); while (clickTimes.length && now - clickTimes[0] > 1000) clickTimes.shift();
  if (clickTimes.length > S.clickBurst) S.clickBurst = clickTimes.length;
  return { v, crit };
}
function gain(v) { S.dust += v; S.runTotal += v; S.allTime += v; }

/* ---------- golden comets ---------- */
let COMET = null; /* { t, stay, x0, y0, x1, y1 } in screen-fraction units, owned by the UI */
function cometInterval() { return (90 + Math.random() * 120) * D.cometFreq; }
function cometReward() {
  const r = Math.random(); S.comets++; S.cometsAll++;
  let res;
  if (r < 0.5) { const dur = 77 * D.cometDur; addBuff("flare", 7, dur); res = { kind: "flare", title: "Stellar Flare", text: `Stardust ×7 for ${Math.round(dur)} seconds!` }; }
  else if (r < 0.9) { const v = Math.min(S.dust * 0.15, D.baseCps * 900) + 13; gain(v); res = { kind: "haul", title: "Lucky Haul", text: "+" + fmtNum(v) + " stardust!", v }; }
  else { const dur = 13 * D.cometDur; addBuff("storm", 777, dur); res = { kind: "storm", title: "Click Storm", text: `Clicks ×777 for ${Math.round(dur)} seconds!` }; }
  if (lit("starfall") && Math.random() < 0.12) res.starfall = true;
  recalc();
  return res;
}
function addBuff(type, mult, dur) {
  const ex = S.buffs.find((b) => b.type === type);
  if (ex) { ex.left = Math.max(ex.left, dur); ex.max = Math.max(ex.max, dur); }
  else S.buffs.push({ type, mult, left: dur, max: dur });
  HOOK.buff();
}

/* ---------- time ---------- */
let achTimer = 0;
function tick(dt) {
  S.runTime += dt; S.playTime += dt;
  if (S.buffs.length) {
    for (const b of S.buffs) b.left -= dt;
    const before = S.buffs.length; S.buffs = S.buffs.filter((b) => b.left > 0);
    if (S.buffs.length !== before) { recalc(); HOOK.buff(); }
  }
  gain(D.cps * dt);
  S.cometT -= dt;
  achTimer -= dt; if (achTimer <= 0) { achTimer = 1; checkAch(); }
}
function view() {
  return { allTime: S.allTime, cps: D.baseCps, clicks: S.clicks, clicksAll: S.clicksAll, clickDust: S.clickDust, owned: S.owned, totalOwned: D.totalOwned, cometsAll: S.cometsAll, comets: S.comets,
    novas: S.novas, level: S.level, upgCount: D.upgCount, treeCount: D.treeCount, awayBest: S.awayBest, runTotal: S.runTotal, runTime: S.runTime, clickBurst: S.clickBurst, achCount: D.achCount };
}
function checkAch() {
  const v = view(); let got = 0;
  for (const a of ACHS) { if (S.ach[a.id]) continue; let ok = false; try { ok = a.test(v); } catch {} if (ok) { S.ach[a.id] = Date.now(); got++; HOOK.ach(a); } }
  if (got) recalc();
}

/* ---------- offline ---------- */
function applyOffline(now = Date.now()) {
  const away = Math.max(0, (now - (S.lastSave || now)) / 1000);
  if (away < 30) return null;
  const secs = Math.min(away, D.offCap), v = S.savedCps * secs * D.offline;
  gain(v); S.awayBest = Math.max(S.awayBest, away);
  S.cometT = Math.min(S.cometT, 20);
  return { away, secs, v, capped: away > D.offCap };
}

/* ---------- supernova ---------- */
function novaGain() { return Math.max(0, levelFor(S.allTime) - S.level); }
function supernova() {
  const g = novaGain(); if (g < 1) return 0;
  S.level += g; S.remnants += g; S.novas++;
  const keep = {};
  if (lit("echo")) for (const id in S.ups) if (UPG[id] && UPG[id].kind === "gen" && UPG[id].tier === 0) keep[id] = 1;
  S.ups = keep; S.owned = GENS.map(() => 0);
  if (lit("twins")) { S.owned[0] = 10; S.owned[1] = 5; }
  S.dust = 0; S.runTotal = 0; S.clicks = 0; S.comets = 0; S.runTime = 0; S.buffs = []; S.cometT = 60;
  recalc();
  if (lit("recall")) S.dust = S.bestCps * 600;
  return g;
}
function buyNode(id) {
  const n = TREE_IDX[id]; if (!n || S.tree[id]) return false;
  if (n.parent && !S.tree[n.parent]) return false;
  if (S.remnants < n.cost) return false;
  S.remnants -= n.cost; S.tree[id] = 1; recalc(); checkAch(); return true;
}

/* ---------- saving ---------- */
function serialize() { S.savedCps = D.baseCps; S.lastSave = Date.now(); return JSON.stringify(S); }
function deserialize(json) {
  const d = typeof json === "string" ? JSON.parse(json) : json;
  if (!d || typeof d !== "object" || !Array.isArray(d.owned)) throw new Error("bad save");
  const base = freshState(), out = { ...base, ...d };
  out.settings = { ...base.settings, ...(d.settings || {}) };
  out.owned = GENS.map((_, i) => Math.max(0, Math.floor(+d.owned[i] || 0)));
  for (const k of ["dust", "runTotal", "allTime", "clickDust", "clicks", "clicksAll", "comets", "cometsAll", "novas", "level", "remnants", "runTime", "playTime", "awayBest", "bestCps", "clickBurst", "cometT", "savedCps"]) out[k] = Math.max(0, +out[k] || 0);
  for (const k of ["ups", "tree", "ach"]) out[k] = d[k] && typeof d[k] === "object" ? d[k] : {};
  out.buffs = Array.isArray(d.buffs) ? d.buffs.filter((b) => b && (b.type === "flare" || b.type === "storm")).map((b) => ({ type: b.type, mult: b.type === "flare" ? 7 : 777, left: +b.left || 0, max: +b.max || 1 })) : [];
  return out;
}
