"use strict";
/* LAST LANTERN · game.js — one run: player, weapons, enemies, bosses, pickups, rendering */

const cv = $("#game"), ctx = cv.getContext("2d", { alpha: false });
let VW = 480, VH = 270, ZOOM = 2;
let [dk, dkx] = mkCanvas(VW, VH);
let VIGNETTE = null;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const dw = Math.max(1, Math.round(innerWidth * dpr)), dh = Math.max(1, Math.round(innerHeight * dpr));
  ZOOM = Math.max(1, Math.round(Math.min(dw, dh) / 280));
  VW = Math.ceil(dw / ZOOM); VH = Math.ceil(dh / ZOOM);
  cv.width = VW; cv.height = VH;
  cv.style.width = (VW * ZOOM) / dpr + "px"; cv.style.height = (VH * ZOOM) / dpr + "px";
  ctx.imageSmoothingEnabled = false;
  [dk, dkx] = mkCanvas(VW, VH);
  const [v, vg] = mkCanvas(VW, VH), gr = vg.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.3, VW / 2, VH / 2, Math.hypot(VW, VH) / 2);
  gr.addColorStop(0, "rgba(255,30,60,0)"); gr.addColorStop(1, "rgba(255,30,60,0.55)");
  vg.fillStyle = gr; vg.fillRect(0, 0, VW, VH); VIGNETTE = v;
}
addEventListener("resize", resize);
resize();

/* ---------- ground chunks ---------- */
let CHUNKS = [], CHUNK_STAGE = "";
function buildChunks(stage) {
  if (CHUNK_STAGE === stage.id) return;
  CHUNK_STAGE = stage.id; CHUNKS = [];
  for (let v = 0; v < 5; v++) {
    const [g, gx] = mkCanvas(128, 128), [e, ex] = mkCanvas(128, 128);
    stage.paint(gx, ex, RNG(hashStr(stage.id) + v * 977));
    CHUNKS.push({ g, e });
  }
}

/* ---------- the run ---------- */
let R = null;
const xpFor = (L) => Math.floor(5 + (L - 1) * 7 + Math.max(0, L - 20) * 9 + Math.max(0, L - 40) * 12);
const lifeKills = (r) => SAVE.stats.kills + (r && !r.banked ? r.kills : 0);

function newRun(opts) {
  const stage = STAGES[opts.stage] || STAGES.wood, ch = CHARS.find((c) => c.id === opts.char) || CHARS[0];
  const seed = opts.seed != null ? opts.seed >>> 0 : (Math.random() * 4294967296) >>> 0;
  const mod = opts.daily ? opts.mod : null;
  const sh = (id) => (opts.daily || opts.demo ? 0 : SAVE.shop[id] | 0);
  R = {
    opts, stage, ch, seed, demo: !!opts.demo, mod,
    rs: RNG(seed ^ 0x51ed27), rl: RNG(seed ^ 0x2b7f11), ru: RNG(seed ^ 0x9e3779),
    t: 0, kills: 0, gold: 0, level: 1, xp: 0, xpNext: xpFor(1), pending: 0,
    p: { x: 0, y: 0, fx: 1, fy: 0, face: 1, hp: 100, anim: 0, moving: false, inv: 0, hurtT: 0 },
    weapons: [], passives: [], banished: new Set(),
    rerolls: opts.daily ? 2 : 1 + 2 * sh("reroll"), skips: opts.daily ? 1 : 1 + sh("skip"), banishes: opts.daily ? 1 : sh("banish"), revives: sh("revival"),
    E: [], P: [], ES: [], PK: [], FX: [], PT: [], NUM: [], POOLS: [], TELE: [], LATER: [], vis: [],
    spawnAcc: 0, evIdx: 0, nextId: 1, alive: 0, endlessEv: 1050,
    boss: null, bossKilled: "", midKills: 0, dmg: {}, shake: 0, flashA: 0, flashC: "#ffffff", hurtA: 0,
    freeze: 0, noHit: 0, noHitBest: 0, dawned: false, dawnT: 0, ended: false, endT: 0, won: false, banked: false,
    propT: 1, achT: 0, overflow: null, sh, demoT: 0,
    mul: {
      hp: stage.hp * (opts.blood ? 1.5 : 1) * ((mod && mod.ehp) || 1),
      spd: (opts.blood ? 1.15 : 1) * ((mod && mod.espd) || 1),
      spawn: (mod && mod.spawn) || 1, gold: opts.blood ? 1.5 : 1,
    },
  };
  buildChunks(stage);
  GRIDMAP.clear();
  computeStats();
  R.p.hp = R.S.maxHp;
  addWeapon(ch.weapon);
  if (!R.demo) { SAVE.codex.w[ch.weapon] = 1; }
  return R;
}

function computeStats() {
  const sh = R.sh, c = R.ch.stats || {}, m = (R.mod && R.mod.stats) || {};
  const lv = (id) => { const q = R.passives.find((x) => x.id === id); return q ? q.lv : 0; };
  const S = {
    might: (1 + 0.05 * sh("might") + (c.might || 0) + 0.1 * lv("gauntlet")) * (m.mightMul || 1),
    cd: Math.max(0.3, (1 - 0.025 * sh("cooldown") + (c.cd || 0)) * (1 - 0.08 * lv("hourglass")) * (m.cdMul || 1)),
    area: 1 + 0.05 * sh("area") + (c.area || 0) + 0.1 * lv("lens"),
    pspd: (1 + 0.1 * sh("speed") + 0.1 * lv("feather")) * (m.pspdMul || 1),
    dur: 1 + 0.15 * sh("duration") + (c.dur || 0) + 0.1 * lv("candle"),
    amt: sh("amount") + lv("ring") + (m.amtAdd || 0),
    maxHp: Math.round(100 * (1 + 0.1 * sh("maxhp") + (c.maxhp || 0) + 0.2 * lv("heart")) * (m.hpMul || 1)),
    armor: sh("armor") + (c.armor || 0) + lv("plate"),
    regen: 0.1 * sh("regen") + (c.regen || 0) + 0.2 * lv("vial"),
    magnet: 30 * (1 + 0.25 * sh("magnet") + (c.magnet || 0) + 0.25 * lv("lodestone")),
    luck: 1 + 0.1 * sh("luck") + 0.1 * lv("clover") + (m.luckAdd || 0),
    growth: (1 + 0.03 * sh("growth") + 0.08 * lv("tome")) * (m.growthMul || 1),
    greed: 1 + 0.1 * sh("greed") + (m.greedAdd || 0),
    move: 64 * (1 + 0.05 * sh("move") + (c.move || 0) + 0.08 * lv("boots")) * (m.moveMul || 1),
  };
  const old = R.S;
  R.S = S;
  if (old && S.maxHp > old.maxHp) R.p.hp += S.maxHp - old.maxHp;
  if (R.p.hp > S.maxHp) R.p.hp = S.maxHp;
  for (const w of R.weapons) refreshW(w);
}
function refreshW(w) {
  const d = WEAPONS[w.id], b = { ...d.base };
  if (d.ups) for (let i = 0; i < w.lv - 1; i++) { const u = d.ups[i]; for (const k in u) b[k] = (b[k] || 0) + u[k]; }
  const S = R.S;
  w.s = {
    dmg: b.dmg * S.might, cd: Math.max(0.05, b.cd * S.cd), amt: d.noAmt ? 1 : Math.max(1, (b.amt || 1) + S.amt),
    area: (b.area || 1) * S.area, spd: (b.spd || 1) * S.pspd, dur: (b.dur || 0) * S.dur, pierce: b.pierce || 1, kb: b.kb || 0,
  };
}
function addWeapon(id) {
  const w = { id, lv: 1, t: 0.35, q: 0, qt: 0, qi: 0, s: null };
  R.weapons.push(w); refreshW(w);
  if (!R.demo) SAVE.codex.w[id] = 1;
  return w;
}
function availWeapons() {
  const set = new Set(R.opts.daily ? BASE_WEAPONS : [...STARTER_WEAPONS, ...SAVE.weapons]);
  set.add(R.ch.weapon);
  return BASE_WEAPONS.filter((id) => set.has(id));
}
function availPassives() { return Object.keys(PASSIVES).filter((id) => !PASSIVES[id].locked || R.opts.daily || SAVE.passives.includes(id)); }
const ownsW = (id) => R.weapons.some((w) => w.id === id || WEAPONS[w.id].from === id);

/* ---------- level ups ---------- */
function genChoices() {
  const rng = R.ru, c = [];
  for (const w of R.weapons) { const d = WEAPONS[w.id]; if (!d.evolved && w.lv < d.max && !R.banished.has(w.id)) c.push({ kind: "w", id: w.id, wt: 1.5 }); }
  for (const q of R.passives) if (q.lv < PASSIVES[q.id].max && !R.banished.has(q.id)) c.push({ kind: "p", id: q.id, wt: 1.2 });
  if (R.weapons.length < 6) for (const id of availWeapons()) if (!ownsW(id) && !R.banished.has(id)) c.push({ kind: "w", id, wt: 1 });
  if (R.passives.length < 6) for (const id of availPassives()) if (!R.passives.some((q) => q.id === id) && !R.banished.has(id)) c.push({ kind: "p", id, wt: 0.85 });
  const n = rng() < Math.min(0.6, (R.S.luck - 1) * 1.2) ? 4 : 3, out = [];
  while (out.length < n && c.length) { const x = rng.weighted(c, (q) => q.wt); out.push(x); c.splice(c.indexOf(x), 1); }
  if (!out.length) out.push({ kind: "gold" }, { kind: "heal" });
  return out;
}
function choiceInfo(c) {
  if (c.kind === "gold") return { icon: "gold", name: "Gold Pouch", tag: "", desc: "+25 gold." };
  if (c.kind === "heal") return { icon: "heal", name: "Warm Bread", tag: "", desc: "Recover 30 health." };
  if (c.kind === "w") {
    const d = WEAPONS[c.id], w = R.weapons.find((x) => x.id === c.id);
    if (!w) return { icon: c.id, name: d.name, tag: "NEW", desc: d.desc, weapon: true };
    return { icon: c.id, name: d.name, tag: "LV " + (w.lv + 1), desc: upDesc(d, d.ups[w.lv - 1]), weapon: true };
  }
  const d = PASSIVES[c.id], q = R.passives.find((x) => x.id === c.id);
  return { icon: c.id, name: d.name, tag: q ? "LV " + (q.lv + 1) : "NEW", desc: d.desc };
}
function upDesc(d, u) {
  const parts = [], unit = d.unit || "projectile", units = d.units || unit + "s";
  if (u.amt) parts.push(`+${u.amt} ${u.amt > 1 ? units : unit}`);
  if (u.dmg) parts.push(`+${u.dmg} damage`);
  if (u.cd) parts.push(`fires ${(-u.cd).toFixed(2).replace(/0$/, "")}s sooner`);
  if (u.area) parts.push(`+${Math.round(u.area * 100)}% area`);
  if (u.spd) parts.push(`+${Math.round(u.spd * 100)}% speed`);
  if (u.dur) parts.push(`lasts +${u.dur}s`);
  if (u.pierce) parts.push(`passes through ${u.pierce} more ${u.pierce > 1 ? "enemies" : "enemy"}`);
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}
function applyChoice(c) {
  if (c.kind === "gold") addGold(25, true);
  else if (c.kind === "heal") heal(30);
  else if (c.kind === "w") { const w = R.weapons.find((x) => x.id === c.id); if (w) { w.lv++; refreshW(w); } else addWeapon(c.id); }
  else { const q = R.passives.find((x) => x.id === c.id); if (q) q.lv++; else R.passives.push({ id: c.id, lv: 1 }); if (!R.demo) SAVE.codex.p[c.id] = 1; computeStats(); }
  R.pending = Math.max(0, R.pending - 1);
  sfx("pick");
}
function evolvable() {
  for (const w of R.weapons) {
    const d = WEAPONS[w.id];
    if (!d.evolved && d.evo && w.lv >= d.max && R.passives.some((q) => q.id === d.need)) return w;
  }
  return null;
}
function evolve(w) {
  const into = WEAPONS[w.id].evo; w.id = into; w.lv = 1; w.t = 0.2; w.q = 0; w.on = false;
  refreshW(w);
  if (!R.demo) { SAVE.codex.x[into] = 1; SAVE.codex.w[into] = 1; }
  return into;
}
/* Chest: tier 1 elite, 2 mid-boss, 3 final boss. Rolls now, the UI shows the reveal. */
function rollChest(tier) {
  const L = R.S.luck, r = R.rl();
  let n = 1;
  if (tier === 1) n = r < 0.03 * L ? 5 : r < 0.13 * L ? 3 : 1;
  else if (tier === 2) n = r < 0.15 * L ? 5 : 3;
  else n = 5;
  const items = [];
  let extraGold = 0;
  for (let i = 0; i < n; i++) {
    const ev = evolvable();
    if (ev) { const from = ev.id, into = evolve(ev); items.push({ kind: "evo", from, id: into }); continue; }
    const opts = [];
    for (const w of R.weapons) { const d = WEAPONS[w.id]; if (!d.evolved && w.lv < d.max) opts.push({ k: "w", ref: w, wt: 2 }); }
    for (const q of R.passives) if (q.lv < PASSIVES[q.id].max) opts.push({ k: "p", ref: q, wt: 1 });
    if (!opts.length) { extraGold += 25; items.push({ kind: "gold", id: "gold" }); continue; }
    const pk = R.rl.weighted(opts, (o) => o.wt);
    pk.ref.lv++;
    if (pk.k === "w") refreshW(pk.ref);
    items.push({ kind: pk.k, id: pk.ref.id, lv: pk.ref.lv });
  }
  computeStats();
  const min = R.t / 60;
  const gold = Math.round((tier === 1 ? 25 + 6 * min : tier === 2 ? 80 + 10 * min : 300) + extraGold);
  addGold(gold, true);
  return { tier, items, gold: Math.round(gold * R.S.greed * R.mul.gold) };
}

/* ---------- helpers used by weapons ---------- */
const GRID = 24, GRIDMAP = new Map();
const cellKey = (gx, gy) => ((gx + 32768) << 16) | (gy + 32768);
function gridBuild() {
  GRIDMAP.clear();
  for (const e of R.E) {
    if (e.dead) continue;
    const k = cellKey(Math.floor(e.x / GRID), Math.floor(e.y / GRID));
    const cell = GRIDMAP.get(k); if (cell) cell.push(e); else GRIDMAP.set(k, [e]);
  }
}
function forEnemiesIn(x, y, r, fn) {
  r += 18;
  const x0 = Math.floor((x - r) / GRID), x1 = Math.floor((x + r) / GRID), y0 = Math.floor((y - r) / GRID), y1 = Math.floor((y + r) / GRID);
  for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
    const cell = GRIDMAP.get(cellKey(gx, gy)); if (!cell) continue;
    for (let i = 0; i < cell.length; i++) { const e = cell[i]; if (!e.dead && e.burn < 0 && fn(e) === true) return; }
  }
}
function nearest(x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const e of R.vis) { const d2 = (e.x - x) ** 2 + (e.y - y) ** 2; if (d2 < bd) { bd = d2; best = e; } }
  return best;
}
function proj(o) {
  const q = { x: R.p.x, y: R.p.y, vx: 0, vy: 0, r: 3, dmg: 1, pierce: 1, life: 2, t: 0, kb: 0.5, rot: 0, va: 0, src: "", dead: false, scale: 1, ...o };
  q.hit = new Set(); R.P.push(q); return q;
}
function volley(w, dt, gap, fire) {
  w.t -= dt;
  if (w.t <= 0) { w.t = w.s.cd; w.q = w.s.amt; w.qt = 0; w.qi = 0; }
  if (w.q > 0) { w.qt -= dt; while (w.q > 0 && w.qt <= 0) { fire(w.qi++); w.q--; w.qt += gap; } }
}
const later = (delay, fn) => R.LATER.push({ t: R.t + delay, fn });

/* ---------- weapons ---------- */
const WK = {
  wand(w, dt) {
    const s = w.s, evo = w.id === "starfall";
    volley(w, dt, evo ? 0.05 : 0.09, (i) => {
      const t = nearest(R.p.x, R.p.y, 320);
      let a = t ? Math.atan2(t.y - R.p.y, t.x - R.p.x) : Math.atan2(R.p.fy, R.p.fx);
      if (evo || i > 0) a += (Math.random() - 0.5) * (evo ? 0.3 : 0.12);
      const sp = 170 * s.spd;
      proj({ kind: "bolt", spr: evo ? SPR.star : SPR.spark, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: (evo ? 4 : 3) * Math.sqrt(s.area), dmg: s.dmg, pierce: s.pierce, life: s.dur, kb: s.kb, src: w.id, light: evo ? 14 : 10, trail: evo ? "#a8f0ff" : "#ffd25e" });
      sfx("wand");
    });
  },
  blade(w, dt) {
    const s = w.s, evo = w.id === "crimson";
    volley(w, dt, 0.11, (i) => {
      const side = (i % 2 === 0 ? 1 : -1) * R.p.face, W = 54 * s.area, H = 17 * s.area;
      const cx = R.p.x + side * (W / 2 + 1), cy = R.p.y - 2 - Math.floor(i / 2) * 9 * s.area;
      let healed = 0;
      forEnemiesIn(cx, cy, W / 2, (e) => {
        if (Math.abs(e.x - cx) < W / 2 + e.r && Math.abs(e.y - cy) < H / 2 + e.r) {
          hurtEnemy(e, s.dmg, side, 0, s.kb, w.id);
          if (evo && healed < 4) healed += 1;
        }
      });
      if (healed) heal(healed, true);
      R.FX.push({ kind: "slash", x: cx, y: cy, w: W, h: H, side, t: 0, max: 0.2, evo });
      sfx("slash");
    });
  },
  knives(w, dt) {
    const s = w.s, evo = w.id === "edges";
    const fire = (i, n) => {
      let a = Math.atan2(R.p.fy, R.p.fx), ox = 0, oy = 0;
      if (evo) a += (i - (n - 1) / 2) * 0.13 + (Math.random() - 0.5) * 0.06;
      else { const pp = a + Math.PI / 2, off = ((i % 3) - 1) * 4; ox = Math.cos(pp) * off; oy = Math.sin(pp) * off; a += (Math.random() - 0.5) * 0.06; }
      const sp = 250 * s.spd;
      proj({ kind: "bolt", rots: evo ? SPR.edgeRot : SPR.knifeRot, rot: a, x: R.p.x + ox, y: R.p.y + oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3, dmg: s.dmg, pierce: s.pierce, life: s.dur, kb: s.kb, src: w.id });
    };
    if (evo) {
      w.t -= dt;
      if (w.t <= 0) { w.t = s.cd; const n = Math.min(9, s.amt + 2); for (let i = 0; i < n; i++) fire(i, n); sfx("knife"); }
    } else volley(w, dt, 0.07, (i) => { fire(i, s.amt); sfx("knife"); });
  },
  orbs(w, dt) {
    const s = w.s, perm = w.id === "halo";
    w.ang = (w.ang || 0) + dt * 3.1 * s.spd;
    if (perm) { if (!w.on) { w.on = true; w.life = 1; } }
    else {
      w.t -= dt;
      if (!w.on && w.t <= 0) { w.on = true; w.life = s.dur; w.full = s.dur; sfx("orb"); }
      if (w.on) { w.life -= dt; if (w.life <= 0) { w.on = false; w.t = s.cd; } }
    }
    if (!w.on) { w.orbs = null; return; }
    const n = s.amt + (perm ? 0 : 0), rad = 34 * s.area, orr = 4 * Math.min(1.8, s.area);
    w.orbs = w.orbs || []; w.orbs.length = 0;
    for (let i = 0; i < n; i++) {
      const a = w.ang + (i / n) * TAU, x = R.p.x + Math.cos(a) * rad, y = R.p.y + Math.sin(a) * rad * 0.92;
      w.orbs.push(x, y);
      forEnemiesIn(x, y, orr, (e) => {
        const rr = orr + e.r; if ((e.x - x) ** 2 + (e.y - y) ** 2 > rr * rr) return;
        if ((e.cd[w.id] || 0) > R.t) return;
        e.cd[w.id] = R.t + 0.32;
        hurtEnemy(e, s.dmg, e.x - R.p.x, e.y - R.p.y, s.kb, w.id);
      });
    }
  },
  aura(w, dt) {
    const s = w.s, evo = w.id === "sanctum", rad = 26 * s.area;
    w.rad = rad; w.t -= dt; if (w.pulse > 0) w.pulse -= dt;
    if (w.t > 0) return;
    w.t = s.cd; w.pulse = 0.16;
    let healed = 0;
    forEnemiesIn(R.p.x, R.p.y, rad, (e) => {
      if (Math.hypot(e.x - R.p.x, e.y - R.p.y) >= rad + e.r) return;
      hurtEnemy(e, s.dmg, e.x - R.p.x, e.y - R.p.y, s.kb, w.id);
      if (evo && healed < 3) healed += 0.4;
    });
    if (healed) heal(healed, true);
  },
  axe(w, dt) {
    const s = w.s;
    if (w.id === "executioner") {
      w.t -= dt;
      if (w.t <= 0) {
        w.t = s.cd; const n = s.amt, base = Math.random() * TAU;
        for (let i = 0; i < n; i++) {
          const a = base + (i / n) * TAU, sp = 105 * s.spd;
          proj({ kind: "spin", rots: SPR.bigaxeRot, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, va: 13, curl: 1.1, r: 8 * s.area / 1.7, dmg: s.dmg, pierce: 999, life: s.dur, kb: s.kb, src: w.id, scale: 2 });
        }
        sfx("axe");
      }
      return;
    }
    volley(w, dt, 0.13, (i) => {
      const dir = (i % 2 === 0 ? 1 : -1) * R.p.face;
      proj({ kind: "arc", rots: SPR.axeRot, vx: dir * (22 + Math.random() * 30 + i * 9), vy: -(178 + Math.random() * 22) * Math.sqrt(s.spd), g: 255, va: 14 * dir, r: 5 * s.area, dmg: s.dmg, pierce: s.pierce, life: s.dur, kb: s.kb, src: w.id, scale: s.area > 1.3 ? 1.5 : 1 });
      sfx("axe");
    });
  },
  boomer(w, dt) {
    const s = w.s, evo = w.id === "comet";
    volley(w, dt, 0.13, (i) => {
      const t = nearest(R.p.x, R.p.y, 260);
      const a = (t ? Math.atan2(t.y - R.p.y, t.x - R.p.x) : Math.atan2(R.p.fy, R.p.fx)) + (i ? (Math.random() - 0.5) * 0.5 : 0);
      for (const aa of evo ? [a, a + Math.PI] : [a]) {
        const sp = 190 * s.spd;
        proj({ kind: "boomer", rots: evo ? SPR.cometRot : SPR.boomerRot, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, ax: Math.cos(aa), ay: Math.sin(aa), dec: sp * 1.45, va: 18, r: 5 * s.area, dmg: s.dmg, pierce: 999, life: 5, kb: s.kb, src: w.id, light: evo ? 12 : 0, scale: evo ? 1.5 : 1 });
      }
      sfx("boomer");
    });
  },
  rune(w, dt) {
    const s = w.s, evo = w.id === "tempest";
    w.t -= dt; if (w.t > 0) return;
    if (!R.vis.length) { w.t = 0.25; return; }
    w.t = s.cd;
    for (let i = 0; i < s.amt; i++) {
      const e = R.vis[(Math.random() * R.vis.length) | 0], x = e.x, y = e.y;
      later(i * 0.08, () => strike(x, y, s, w.id, evo, 0, null));
    }
  },
  bomb(w, dt) {
    const s = w.s, evo = w.id === "inferno";
    volley(w, dt, 0.1, () => {
      let tx, ty;
      if (R.vis.length && Math.random() < 0.8) { const e = R.vis[(Math.random() * R.vis.length) | 0]; tx = e.x + rnd(-6, 6); ty = e.y + rnd(-6, 6); }
      else { const a = Math.random() * TAU, d = 30 + Math.random() * 70; tx = R.p.x + Math.cos(a) * d; ty = R.p.y + Math.sin(a) * d; }
      proj({ kind: "flask", spr: SPR.flask, sx: R.p.x, sy: R.p.y - 4, tx, ty, max: 0.45, life: 9, noHit: true, src: w.id, pool: { r: 16 * s.area, dmg: s.dmg, life: s.dur, evo } });
    });
  },
};
function strike(x, y, s, src, evo, chain, from) {
  const rad = 18 * s.area;
  R.FX.push({ kind: "bolt", x, y, fx: from ? from[0] : x + rnd(-24, 24), fy: from ? from[1] : y - VH * 0.7, t: 0, max: 0.24, seed: (Math.random() * 1e9) | 0, w: chain ? 1 : 2 });
  R.FX.push({ kind: "ring", x, y, t: 0, max: 0.25, r0: 3, r1: rad, c: "#a8f0ff" });
  const hits = [];
  forEnemiesIn(x, y, rad, (e) => { if (Math.hypot(e.x - x, e.y - y) < rad + e.r) hits.push(e); });
  for (const e of hits) hurtEnemy(e, s.dmg * (chain ? 0.7 : 1), 0, 0, 0, src);
  sfx("zap");
  if (evo && chain < 3) {
    let best = null, bd = 1e9;
    for (const e of R.vis) { const d = Math.hypot(e.x - x, e.y - y); if (d > 14 && d < 80 && d < bd && !hits.includes(e)) { bd = d; best = e; } }
    if (best) { const nx = best.x, ny = best.y; later(0.07, () => strike(nx, ny, s, src, evo, chain + 1, [x, y])); }
  }
}
function makePool(q) {
  const o = q.pool;
  R.POOLS.push({ x: q.tx, y: q.ty, r: o.r, r0: o.r, dmg: o.dmg, life: o.life, max: o.life, src: q.src, evo: o.evo, t: 0 });
  sfx("glass");
  for (let i = 0; i < 8; i++) part(q.tx, q.ty, rnd(-60, 60), rnd(-90, -20), rnd(0.3, 0.5), pickr(["#ffa34d", "#ffd25e", "#d6304f"]), 1, 260);
}

/* ---------- damage ---------- */
function hurtEnemy(e, dmg, kx, ky, kb, src) {
  let tgt = e;
  if (e.head) { tgt = e.head; e.flash = 0.08; if (tgt.dead) return; }
  if (tgt.dead || tgt.burn >= 0) return;
  dmg = Math.max(1, Math.round(dmg * (0.92 + Math.random() * 0.16)));
  tgt.hp -= dmg; tgt.flash = 0.07;
  if (kb && tgt.kbRes > 0 && (kx || ky)) {
    const l = Math.hypot(kx, ky) || 1, f = (95 * kb * tgt.kbRes) / Math.sqrt(tgt.mass);
    tgt.kbx += (kx / l) * f; tgt.kby += (ky / l) * f;
  }
  R.dmg[src] = (R.dmg[src] || 0) + dmg;
  // damage numbers: hits on the same enemy within a short window are summed into one number
  if (SAVE.settings.dmg && !R.demo && !tgt.d.prop) {
    tgt.numAcc = (tgt.numAcc || 0) + dmg;
    if (R.t - (tgt.numT ?? -1) >= 0.25 || tgt.hp <= 0) {
      addNum(e.x + rnd(-3, 3), e.y - e.r - 6, tgt.numAcc, tgt.numAcc >= 100 ? "#ffd25e" : "#ffffff");
      tgt.numAcc = 0; tgt.numT = R.t;
    }
  }
  sfx("hit");
  if (tgt.hp <= 0) killEnemy(tgt);
}
function addNum(x, y, v, c) { if (R.NUM.length > 56) R.NUM.shift(); R.NUM.push({ x, y, v, c, t: 0 }); }
function part(x, y, vx, vy, life, c, s = 1, g = 0) { if (R.PT.length > 900) return; R.PT.push({ x, y, vx, vy, life, max: life, c, s, g }); }
function burst(e, n) {
  const f = frameOf(e), sc = e.scale || 1, px = f.px; if (!px.length) return;
  for (let i = 0; i < n; i++) {
    const q = px[(Math.random() * px.length) | 0], x = e.x + (q[0] - f.w / 2) * sc, y = e.y + (q[1] - f.h / 2) * sc;
    part(x, y, (x - e.x) * 4 + rnd(-30, 30), (y - e.y) * 3 - rnd(30, 80), rnd(0.35, 0.7), q[2], sc > 1 ? 2 : 1, 240);
  }
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  if (e.d.prop) { burst(e, 10); sfx("glass"); dropProp(e.x, e.y); return; }
  R.kills++;
  burst(e, e.boss ? 70 : e.elite ? 26 : 10);
  sfx("kill");
  if (e.xp > 0 && !R.dawned) dropGem(e.x, e.y, e.xp);
  if (!e.elite && !e.boss && R.rl() < 0.011 * R.S.luck) mkPick("coin", e.x, e.y, 1);
  if (e.elite) { mkPick("chest", e.x, e.y, 0, { tier: 1 }); flash("#ffffff", 0.15); }
  if (e.boss === "mid") { mkPick("chest", e.x, e.y, 0, { tier: 2 }); R.midKills++; shake(5); flash("#ffd25e", 0.3); sfx("boom"); }
  if (e.boss === "final") {
    R.bossKilled = e.type; shake(8); flash("#ffffff", 0.6); sfx("boom");
    mkPick("chest", e.x, e.y, 0, { tier: 3 });
    for (let i = 0; i < 12; i++) mkPick("bag", e.x + rnd(-30, 30), e.y + rnd(-30, 30), 25);
    for (const s of R.E) if (s.head === e && !s.dead) { s.dead = true; burst(s, 20); }
    if (!R.dawned) musicPlay(R.stage.song, 3);
    UI.banner(e.name + " falls", "Hold on until dawn");
  }
  if (R.boss === e) R.boss = null;
  if (e.d.split) {
    const n = e.boss ? 8 : e.elite ? 4 : 2;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const s = makeEnemy(e.d.split, e.x + Math.cos(a) * 5, e.y + Math.sin(a) * 5); s.kbx = Math.cos(a) * 80; s.kby = Math.sin(a) * 80; }
    sfx("split");
  }
}
function dropProp(x, y) {
  const r = R.rl(), L = R.S.luck;
  const t = r < 0.34 ? "coin" : r < 0.46 ? "bag" : r < 0.62 ? "bread" : r < 0.72 ? "lodestar" : r < 0.79 + 0.02 * L ? "flare" : r < 0.87 ? "clock" : null;
  if (t) mkPick(t, x, y, t === "coin" ? 3 : t === "bag" ? 15 + R.rl.int(16) : 0);
}
function mkPick(type, x, y, val = 0, o = {}) {
  const k = { type, x, y, val, z: 0, vz: type === "gem" ? 0 : 70, mag: false, sp: 0, dead: false, t: 0, ...o };
  R.PK.push(k); return k;
}
/* Too many gems on the ground: fold the one farthest from the player into the new drop,
   so no experience is lost and the big gem lands where the fighting is. */
function dropGem(x, y, v) {
  let gems = 0, far = null, fd = -1;
  for (const k of R.PK) {
    if (k.dead || k.type !== "gem") continue;
    gems++;
    if (!k.mag) { const d = (k.x - R.p.x) ** 2 + (k.y - R.p.y) ** 2; if (d > fd) { fd = d; far = k; } }
  }
  if (gems > 360 && far) { far.dead = true; v += far.val; }
  mkPick("gem", x + rnd(-2, 2), y + rnd(-2, 2), v, v >= 40 ? { big: true } : {});
}
function addGold(v, quiet) { R.gold += v * R.S.greed * R.mul.gold; if (!quiet) sfx("coin"); }
function heal(n, quiet) {
  const p = R.p, before = p.hp;
  p.hp = Math.min(R.S.maxHp, p.hp + n);
  const got = p.hp - before;
  if (!quiet && got >= 1 && !R.demo) { addNum(p.x, p.y - 16, Math.round(got), "#7dffb0"); sfx("heal"); }
}
function addXP(v) {
  R.xp += v * R.S.growth;
  while (R.xp >= R.xpNext) { R.xp -= R.xpNext; R.level++; R.xpNext = xpFor(R.level); R.pending++; }
}
const shake = (n) => { R.shake = Math.max(R.shake, n); };
const flash = (c, a) => { if (!SAVE.settings.flash) a *= 0.35; R.flashC = c; R.flashA = Math.max(R.flashA, a); };
function hurtPlayer(d) {
  const p = R.p;
  if (p.inv > 0 || R.ended || R.dawned || R.demo) return;
  d = Math.max(1, Math.round(d - R.S.armor));
  p.hp -= d; p.hurtT = 0.22; p.inv = 0.1; R.noHit = 0;
  R.hurtA = Math.min(0.5, R.hurtA + 0.22); shake(2);
  sfx("hurt"); addNum(p.x, p.y - 14, d, "#ff4d5e");
  if (p.hp <= 0) {
    if (R.revives > 0) {
      R.revives--; p.hp = R.S.maxHp * 0.5; p.inv = 2.5; sfx("revive"); flash("#fff2a8", 0.7);
      forEnemiesIn(p.x, p.y, 90, (e) => { if (!e.boss) { const dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1; e.kbx += (dx / l) * 400; e.kby += (dy / l) * 400; } });
      UI.banner("Revived", "The lantern flares back to life");
    } else { p.hp = 0; endRun(false); }
  }
}
function flare() {
  sfx("flare"); flash("#fff2a8", 0.8); shake(5);
  for (const e of R.vis) { if (e.boss) hurtEnemy(e, e.maxHp * 0.05, 0, 0, 0, "flare"); else if (e.elite) hurtEnemy(e, e.maxHp * 0.3, 0, 0, 0, "flare"); else killEnemy(e); }
}

/* ---------- enemies ---------- */
function endlessLoops() { return R.opts.endless && R.t >= 900 ? 1 + Math.floor((R.t - 900) / 600) : 0; }
function makeEnemy(type, x, y, o = {}) {
  const d = ENEMIES[type], m = R.t / 60;
  const tm = (1 + 0.12 * m + 0.006 * m * m) * (1 + endlessLoops() * 0.6);
  const e = {
    id: R.nextId++, type, d, x, y, r: d.r, hp: 1, maxHp: 1,
    spd: d.spd * R.mul.spd * (d.boss ? 1 : 0.9 + R.rs() * 0.2), dmg: d.dmg * (1 + 0.06 * Math.min(m, 20)), xp: d.xp,
    ai: o.ai || d.ai || "chase", anim: Math.random() * 10, kbx: 0, kby: 0, flash: 0, face: 1, atk: 0, cd: {},
    elite: !!o.elite, boss: d.boss ? "final" : o.mid ? "mid" : "", scale: o.mid ? 2 : 1, mass: d.mass || 1, kbRes: d.kb ?? 1,
    st: 0, stT: 0, atkT: 2, mx: 0, my: 0, dead: false, burn: -1, name: o.name || d.name, alpha: 1, seed: Math.random() * 100,
  };
  let hp = d.prop ? 1 : d.hp * tm * R.mul.hp;
  if (d.boss) hp = d.hp * R.mul.hp * (1 + endlessLoops() * 0.9);
  if (e.elite) { hp *= 10; e.xp *= 8; e.mass *= 3; e.kbRes *= 0.3; e.r += 1; }
  if (o.mid) { hp *= 18; e.xp = 40; e.mass = 40; e.kbRes = 0.05; e.r = d.r * 2; e.dmg *= 1.6; e.spd *= 0.9; }
  e.hp = e.maxHp = hp;
  if (d.shot) e.shotT = 1 + Math.random() * d.shot.cd;
  R.E.push(e);
  if (!d.prop && !R.demo && type !== "wyrmseg") SAVE.codex.e[type] = 1;
  return e;
}
function spawnPos(margin = 20) {
  const p = R.p, hw = VW / 2 + margin, hh = VH / 2 + margin;
  const a = p.moving && R.rs() < 0.45 ? Math.atan2(p.fy, p.fx) + R.rs.range(-1, 1) : R.rs() * TAU;
  const c = Math.cos(a), s = Math.sin(a), k = Math.min(hw / Math.max(1e-6, Math.abs(c)), hh / Math.max(1e-6, Math.abs(s)));
  return [p.x + c * k, p.y + s * k];
}
function spawner(dt) {
  if (R.dawned) return;
  const st = R.stage, t = R.t, loops = endlessLoops();
  const wt = loops ? 300 + ((t - 900) % 600) : t;
  let wv = st.waves[0]; for (const w of st.waves) if (w.t <= wt) wv = w;
  const dens = Math.min(1.35, 1 + t / 600);
  const cap = wv.cap * dens * (1 + loops * 0.15) * (R.mul.spawn > 1 ? 1.3 : 1);
  let rate = wv.rate * dens * R.mul.spawn * (1 + loops * 0.25);
  if (R.alive < cap * 0.5) rate *= 3.5;
  R.spawnAcc += rate * dt;
  while (R.spawnAcc >= 1) {
    R.spawnAcc -= 1;
    if (R.alive >= cap) { R.spawnAcc = 0; break; }
    const pool = Object.entries(wv.pool);
    let type = R.rs.weighted(pool, (q) => q[1])[0];
    // ranged enemies hang back and pile up, so keep their numbers in check
    if (ENEMIES[type].shot && R.ranged >= 22) { const melee = pool.filter((q) => !ENEMIES[q[0]].shot); if (melee.length) type = R.rs.weighted(melee, (q) => q[1])[0]; }
    if (ENEMIES[type].shot) R.ranged++;
    const [x, y] = spawnPos(); makeEnemy(type, x, y); R.alive++;
  }
  while (R.evIdx < st.events.length && st.events[R.evIdx].t <= t) runEvent(st.events[R.evIdx++]);
  if (R.opts.endless && t >= R.endlessEv && t >= 900) {
    const k = Math.round((R.endlessEv - 900) / 150) % 4;
    if (k === 0) runEvent({ type: "boss", e: st.boss });
    else if (k === 2) runEvent({ type: "mid", e: pickr(["brute", "golem", "slime"]), name: "Nightmare" });
    else runEvent({ type: "ring", e: pickr(Object.keys(wv.pool)), n: 40 });
    R.endlessEv += 150;
  }
}
function runEvent(ev) {
  const p = R.p, D = Math.max(VW, VH);
  if (ev.type === "swarm") {
    const a = R.rs() * TAU, cx = p.x + Math.cos(a) * D * 0.72, cy = p.y + Math.sin(a) * D * 0.72, px = -Math.sin(a), py = Math.cos(a);
    for (let i = 0; i < ev.n; i++) {
      const off = (i - ev.n / 2) * 7 + rnd(-3, 3), e = makeEnemy(ev.e, cx + px * off + rnd(-6, 6), cy + py * off + rnd(-6, 6), { ai: "line" });
      e.dx = -Math.cos(a); e.dy = -Math.sin(a); e.spd *= 1.5; e.xp = Math.max(1, e.xp);
    }
  } else if (ev.type === "ring") {
    const rad = D * 0.62;
    for (let i = 0; i < ev.n; i++) { const a = (i / ev.n) * TAU; makeEnemy(ev.e, p.x + Math.cos(a) * rad, p.y + Math.sin(a) * rad * 0.8); }
    sfx("warn");
  } else if (ev.type === "elite") {
    const [x, y] = spawnPos(); makeEnemy(ev.e, x, y, { elite: true });
  } else if (ev.type === "mid") {
    const [x, y] = spawnPos(30), e = makeEnemy(ev.e, x, y, { mid: true, name: ev.name });
    R.boss = e; sfx("warn"); UI.banner(ev.name, "A mid-boss approaches");
  } else if (ev.type === "boss") {
    const [x, y] = spawnPos(40), e = makeEnemy(ev.e, x, y);
    R.boss = e; sfx("boss"); shake(4); musicPlay("boss", 3);
    UI.banner(e.name, R.opts.endless ? "The night will not end" : "Survive until dawn");
    if (ev.e === "wyrm") { e.trail = []; e.dir = Math.atan2(p.y - y, p.x - x); for (let i = 0; i < 14; i++) { const s = makeEnemy("wyrmseg", x, y); s.head = e; s.idx = i; s.r = 6; } }
  }
}

const AI = {
  chase(e) { const dx = R.p.x - e.x, dy = R.p.y - e.y, d = Math.hypot(dx, dy) || 1; e.mx = dx / d; e.my = dy / d; },
  flutter(e) {
    const dx = R.p.x - e.x, dy = R.p.y - e.y, d = Math.hypot(dx, dy) || 1, w = Math.sin(e.anim * 5 + e.seed) * 0.75;
    let mx = dx / d - (dy / d) * w, my = dy / d + (dx / d) * w; const l = Math.hypot(mx, my) || 1; e.mx = mx / l; e.my = my / l;
  },
  float(e) { AI.chase(e); e.bob = Math.sin(e.anim * 3 + e.seed) * 1.5; },
  zigzag(e) {
    const dx = R.p.x - e.x, dy = R.p.y - e.y, a = Math.atan2(dy, dx) + (Math.floor(e.anim * 2 + e.seed) % 2 ? 0.75 : -0.75);
    e.mx = Math.cos(a); e.my = Math.sin(a);
  },
  line(e) { e.mx = e.dx; e.my = e.dy; },
  caster(e, dt) {
    const dx = R.p.x - e.x, dy = R.p.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.mx = dx / d; e.my = dy / d;
    if (d < 70) { e.mx = -e.mx * 0.8; e.my = -e.my * 0.8; }
    else if (d < 105) { const t = e.mx; e.mx = -e.my * 0.35 * (e.id % 2 ? 1 : -1); e.my = t * 0.35 * (e.id % 2 ? 1 : -1); }
    e.shotT -= dt;
    if (e.shotT <= 0 && d < 220) {
      const sh = e.d.shot; e.shotT = sh.cd * (e.boss ? 0.8 : 1) * (0.85 + Math.random() * 0.3);
      if (e.boss) { const n = 10, off = Math.random() * TAU; for (let i = 0; i < n; i++) eshot(e.x, e.y, off + (i / n) * TAU, sh.spd * 0.85, e.dmg * 0.7, sh.spr, true); sfx("shot"); }
      else if (R.shots < 34) { eshot(e.x, e.y, Math.atan2(dy, dx), sh.spd, sh.dmg * (1 + R.t / 600), sh.spr); R.shots++; sfx("shot"); }
    }
  },
  charge(e, dt) {
    const dx = R.p.x - e.x, dy = R.p.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (e.st === 0) { e.mx = dx / d; e.my = dy / d; e.stT -= dt; if (d < 115 && e.stT <= 0) { e.st = 1; e.stT = 0.55; e.cx = dx / d; e.cy = dy / d; if (onScreen(e)) sfx("charge"); } }
    else if (e.st === 1) { e.mx = e.my = 0; e.shk = 1; e.stT -= dt; if (e.stT <= 0) { e.st = 2; e.stT = 0.6; e.shk = 0; } }
    else if (e.st === 2) { e.mx = e.cx * 4.2; e.my = e.cy * 4.2; e.stT -= dt; if (e.stT <= 0) { e.st = 3; e.stT = 0.6; } }
    else { e.mx = (dx / d) * 0.3; e.my = (dy / d) * 0.3; e.stT -= dt; if (e.stT <= 0) { e.st = 0; e.stT = 1.2; } }
  },
  seg() { e_noop(); },
  king(e, dt) {
    const p = R.p, enr = e.hp < e.maxHp * 0.5;
    if (e.st === 1) { e.mx = e.my = 0; e.stT -= dt; if (e.stT <= 0) e.st = 0; return; }
    AI.chase(e); if (enr) { e.mx *= 1.35; e.my *= 1.35; }
    e.atkT -= dt;
    if (e.atkT > 0) return;
    e.atkI = (e.atkI || 0) + 1;
    if (e.atkI % 2) {
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const s = makeEnemy("skel", e.x + Math.cos(a) * 28, e.y + Math.sin(a) * 28); s.xp = 1; }
      R.FX.push({ kind: "ring", x: e.x, y: e.y, t: 0, max: 0.5, r0: 4, r1: 44, c: "#a35ce0" }); sfx("warn");
      e.atkT = enr ? 4.5 : 6.5;
    } else {
      const n = enr ? 3 : 1;
      for (let i = 0; i < n; i++) R.TELE.push({ x: p.x + (i ? rnd(-55, 55) : 0), y: p.y + (i ? rnd(-45, 45) : 0), r: 40, t: 0, max: 1.1, dmg: e.dmg * 1.4 });
      e.st = 1; e.stT = 1.2; sfx("warn"); e.atkT = enr ? 4 : 5.5;
    }
  },
  lich(e, dt) {
    const p = R.p, dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, enr = e.hp < e.maxHp * 0.5;
    e.bob = Math.sin(e.anim * 2) * 2;
    if (e.st === 2) { e.mx = e.my = 0; e.stT -= dt; e.alpha = Math.max(0, e.stT / 0.45); if (e.stT <= 0) { const a = Math.random() * TAU; e.x = p.x + Math.cos(a) * 115; e.y = p.y + Math.sin(a) * 85; e.st = 3; e.stT = 0.45; sfx("teleport"); } return; }
    if (e.st === 3) { e.mx = e.my = 0; e.stT -= dt; e.alpha = 1 - Math.max(0, e.stT / 0.45); if (e.stT <= 0) { e.st = 0; e.alpha = 1; } return; }
    e.atkT -= dt;
    if (e.atkT <= 0) {
      const k = (e.atkI = (e.atkI || 0) + 1) % 4;
      if (k === 1) { const n = enr ? 18 : 14, off = Math.random() * TAU; for (let i = 0; i < n; i++) eshot(e.x, e.y, off + (i / n) * TAU, 52, e.dmg * 0.6, "shot", true); sfx("shot"); }
      else if (k === 2) { const a = Math.atan2(dy, dx); for (let i = -2; i <= 2; i++) eshot(e.x, e.y, a + i * 0.2, 92, e.dmg * 0.6, "shot", true); sfx("shot"); }
      else if (k === 3) { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; makeEnemy("shade", p.x + Math.cos(a) * 125, p.y + Math.sin(a) * 100); } sfx("warn"); }
      else { e.st = 2; e.stT = 0.45; }
      e.atkT = enr ? 2.1 : 2.9;
    }
    let mx = dx / d, my = dy / d;
    if (d < 90) { mx = -mx; my = -my; } else if (d < 150) { const t = mx; mx = -my * 0.8; my = t * 0.8; }
    e.mx = mx; e.my = my;
  },
  wyrm(e, dt) {
    const p = R.p, dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, enr = e.hp < e.maxHp * 0.5;
    e.stT -= dt; e.atkT -= dt;
    let want;
    if (e.st === 1) { want = Math.atan2(e.ty - e.y, e.tx - e.x); if (e.stT <= 0) { e.st = 0; e.stT = enr ? 4.5 : 6; } }
    else {
      e.orb = (e.orb || Math.atan2(-dy, -dx)) + dt * 0.9;
      want = Math.atan2(p.y + Math.sin(e.orb) * 95 - e.y, p.x + Math.cos(e.orb) * 95 - e.x);
      if (e.stT <= 0) { e.st = 1; e.stT = 1.1; e.tx = p.x + dx / d * 40; e.ty = p.y + dy / d * 40; sfx("charge"); }
    }
    let da = want - e.dir; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    e.dir += clamp(da, -(e.st ? 4 : 2.6) * dt, (e.st ? 4 : 2.6) * dt);
    const sp = e.st === 1 ? 2.3 : 1;
    e.mx = Math.cos(e.dir) * sp; e.my = Math.sin(e.dir) * sp; e.face = e.mx < 0 ? -1 : 1;
    const last = e.trail[0];
    if (!last || Math.hypot(last[0] - e.x, last[1] - e.y) >= 2) { e.trail.unshift([e.x, e.y]); if (e.trail.length > 90) e.trail.pop(); }
    if (e.atkT <= 0) {
      e.atkT = enr ? 2.4 : 3.4;
      const segs = R.E.filter((s) => s.head === e && !s.dead);
      for (let i = 0; i < (enr ? 4 : 3) && segs.length; i++) { const s = segs[(Math.random() * segs.length) | 0]; eshot(s.x, s.y, Math.atan2(p.y - s.y, p.x - s.x), 70, e.dmg * 0.55, "fireball", true); }
      sfx("shot");
    }
  },
};
function e_noop() {}
function eshot(x, y, a, sp, dmg, spr, boss) { R.ES.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 3, dmg, life: boss ? 7 : 5, spr: SPR[spr] || SPR.shot, t: 0, boss: !!boss }); }
const onScreen = (e, m = 0) => Math.abs(e.x - R.p.x) < VW / 2 + m && Math.abs(e.y - R.p.y) < VH / 2 + m;
const frameOf = (e) => { const fr = SPR[e.d.spr]; return fr[Math.floor(e.anim * e.d.fps) % fr.length]; };

function updateEnemies(dt) {
  const p = R.p, frozen = R.freeze > 0, farD = Math.max(VW, VH) * 0.85 + 70;
  let alive = 0, ranged = 0, shots = 0;
  for (const s of R.ES) if (!s.dead && !s.boss) shots++;
  R.shots = shots;
  R.vis.length = 0;
  for (const e of R.E) {
    if (e.dead) continue;
    if (e.burn >= 0) { e.burn -= dt; e.anim += dt; if (e.burn < 0) { e.dead = true; burst(e, 12); } continue; }
    if (e.flash > 0) e.flash -= dt;
    if (e.d.prop) { e.anim += dt; if (Math.abs(e.x - p.x) > 700 || Math.abs(e.y - p.y) > 700) e.dead = true; continue; }
    alive++;
    if (e.d.shot && !e.boss) ranged++;
    if (onScreen(e, -2) && e.ai !== "seg") R.vis.push(e);
    if (e.ai === "seg") continue;
    const stop = frozen && !e.boss;
    if (!stop) { e.anim += dt; (AI[e.ai] || AI.chase)(e, dt); }
    const sp = stop ? 0 : e.spd;
    e.x += (e.mx * sp + e.kbx) * dt; e.y += (e.my * sp + e.kby) * dt;
    const decay = Math.max(0, 1 - dt * 9); e.kbx *= decay; e.kby *= decay;
    if (e.mx < -0.1) e.face = -1; else if (e.mx > 0.1) e.face = 1;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (!stop && d < e.r + 5 && e.atk <= R.t) { hurtPlayer(e.dmg); e.atk = R.t + 0.6; }
    if (e.ai === "line") { if (d > farD * 1.2) e.dead = true; continue; }
    if (d > farD) {
      if (e.boss) { const [x, y] = spawnPos(30); e.x = x; e.y = y; if (e.trail) e.trail.length = 0; }
      else { const [x, y] = spawnPos(); e.x = x; e.y = y; }
    }
  }
  // wyrm coils follow the head's trail
  for (const s of R.E) {
    if (s.dead || s.ai !== "seg") continue;
    const h = s.head; if (!h || h.dead) { s.dead = true; continue; }
    const tr = h.trail, pt = tr[Math.min(tr.length - 1, (s.idx + 1) * 5)];
    if (pt) { s.x = pt[0]; s.y = pt[1]; } else { s.x = h.x; s.y = h.y; }
    s.anim += dt; s.face = h.face;
    if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + 5 && s.atk <= R.t) { hurtPlayer(h.dmg * 0.8); s.atk = R.t + 0.6; }
  }
  R.alive = alive; R.ranged = ranged;
}
function separate() {
  const p = R.p;
  for (const a of R.E) {
    if (a.dead || a.d.ghost || a.d.prop || a.ai === "seg" || a.burn >= 0) continue;
    forEnemiesIn(a.x, a.y, a.r + 4, (b) => {
      if (b.id <= a.id || b.d.ghost || b.d.prop || b.ai === "seg") return;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) return;
      const d = Math.sqrt(d2), ov = (rr - d) * 0.5, tm = a.mass + b.mass, nx = dx / d, ny = dy / d;
      a.x -= nx * ov * (b.mass / tm); a.y -= ny * ov * (b.mass / tm);
      b.x += nx * ov * (a.mass / tm); b.y += ny * ov * (a.mass / tm);
    });
    const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy), min = a.r + 4;
    if (d < min && d > 0.01 && !a.boss) { a.x = p.x + (dx / d) * min; a.y = p.y + (dy / d) * min; }
  }
}

/* ---------- props: lantern posts that drop goodies ---------- */
function props(dt) {
  R.propT -= dt; if (R.propT > 0) return;
  R.propT = 4;
  let n = 0; for (const e of R.E) if (!e.dead && e.d.prop) n++;
  if (n >= 4) return;
  const a = R.rs() * TAU, d = Math.max(VW, VH) * (0.6 + R.rs() * 0.5);
  makeEnemy("brazier", R.p.x + Math.cos(a) * d, R.p.y + Math.sin(a) * d * 0.8);
}

/* ---------- per-frame update ---------- */
function demoSteer() {
  const p = R.p; let fx = 0, fy = 0;
  forEnemiesIn(p.x, p.y, 80, (e) => { const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy + 30; fx += (dx / d2) * 40; fy += (dy / d2) * 40; });
  for (const k of R.PK) { if (k.type !== "gem" && k.type !== "chest") continue; const dx = k.x - p.x, dy = k.y - p.y, d = Math.hypot(dx, dy); if (d < 120 && d > 1) { fx += (dx / d) * 0.25; fy += (dy / d) * 0.25; } }
  fx += Math.cos(R.t * 0.31) * 0.35; fy += Math.sin(R.t * 0.23) * 0.35;
  const l = Math.hypot(fx, fy); return l > 0.05 ? [fx / Math.max(1, l), fy / Math.max(1, l)] : [0, 0];
}
function update(dt) {
  const p = R.p;
  R.t += dt;
  // player
  const [mx, my] = R.demo ? demoSteer() : moveVec();
  p.moving = Math.abs(mx) + Math.abs(my) > 0.05 && !R.ended;
  if (p.moving) {
    const l = Math.hypot(mx, my); p.fx = mx / l; p.fy = my / l; p.anim += dt * (0.6 + l * 0.6);
    if (Math.abs(mx) > 0.15) p.face = mx > 0 ? 1 : -1;
    p.x += mx * R.S.move * dt; p.y += my * R.S.move * dt;
  }
  if (p.inv > 0) p.inv -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (R.S.regen && !R.ended) p.hp = Math.min(R.S.maxHp, p.hp + R.S.regen * dt);
  R.noHit += dt; if (R.noHit > R.noHitBest) R.noHitBest = R.noHit;
  if (R.freeze > 0) R.freeze -= dt;

  gridBuild();
  updateEnemies(dt);
  gridBuild();
  separate();
  if (!R.ended) for (const w of R.weapons) WK[WEAPONS[w.id].kind](w, dt);

  // delayed actions (lightning chains, staggered strikes)
  if (R.LATER.length) { const now = R.LATER.filter((x) => x.t <= R.t); R.LATER = R.LATER.filter((x) => x.t > R.t); for (const x of now) x.fn(); }

  // projectiles
  for (const q of R.P) {
    if (q.dead) continue;
    q.t += dt;
    if (q.kind === "bolt") { q.x += q.vx * dt; q.y += q.vy * dt; }
    else if (q.kind === "arc") { q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.va * dt; }
    else if (q.kind === "spin") {
      const c = Math.cos(q.curl * dt), s = Math.sin(q.curl * dt), vx = q.vx * c - q.vy * s;
      q.vy = q.vx * s + q.vy * c; q.vx = vx; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.va * dt;
    } else if (q.kind === "boomer") {
      q.rot += q.va * dt;
      if (!q.back) { const along = q.vx * q.ax + q.vy * q.ay, nv = along - q.dec * dt; if (nv <= 0) { q.back = true; q.hit.clear(); q.sp = 0; } else { q.vx = q.ax * nv; q.vy = q.ay * nv; } }
      if (q.back) { q.sp = Math.min(330, q.sp + 400 * dt); const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 1; q.vx = (dx / d) * q.sp; q.vy = (dy / d) * q.sp; if (d < 8) q.dead = true; }
      q.x += q.vx * dt; q.y += q.vy * dt;
    } else if (q.kind === "flask") {
      const k = Math.min(1, q.t / q.max); q.x = lerp(q.sx, q.tx, k); q.y = lerp(q.sy, q.ty, k); q.z = Math.sin(Math.PI * k) * 30; q.rot += dt * 10;
      if (k >= 1) { q.dead = true; makePool(q); }
      continue;
    }
    if (q.trail && Math.random() < 0.6) part(q.x, q.y, rnd(-8, 8), rnd(-8, 8), 0.25, q.trail, 1, 0);
    if (q.t >= q.life) { q.dead = true; continue; }
    if (q.noHit) continue;
    forEnemiesIn(q.x, q.y, q.r, (e) => {
      if (q.hit.has(e.id)) return;
      const rr = q.r + e.r; if ((e.x - q.x) ** 2 + (e.y - q.y) ** 2 > rr * rr) return;
      q.hit.add(e.id);
      hurtEnemy(e, q.dmg, q.vx, q.vy, q.kb, q.src);
      if (--q.pierce <= 0) { q.dead = true; return true; }
    });
  }
  // fire pools
  for (const pl of R.POOLS) {
    pl.t += dt; pl.life -= dt;
    if (pl.evo) { const dx = p.x - pl.x, dy = p.y - pl.y, d = Math.hypot(dx, dy) || 1; if (d > 10) { pl.x += (dx / d) * 22 * dt; pl.y += (dy / d) * 22 * dt; } pl.r = Math.min(pl.r0 * 1.8, pl.r + 5 * dt); }
    if (Math.random() < 0.5) part(pl.x + rnd(-pl.r, pl.r) * 0.8, pl.y + rnd(-pl.r, pl.r) * 0.6, 0, rnd(-30, -12), rnd(0.25, 0.5), pickr(["#ffa34d", "#ffd25e", "#e8762d"]), 1, -20);
    forEnemiesIn(pl.x, pl.y, pl.r, (e) => {
      if ((e.x - pl.x) ** 2 + ((e.y - pl.y) * 1.25) ** 2 > (pl.r + e.r) ** 2) return;
      if ((e.cd[pl.src] || 0) > R.t) return;
      e.cd[pl.src] = R.t + 0.45; hurtEnemy(e, pl.dmg, 0, 0, 0, pl.src);
    });
  }
  R.POOLS = R.POOLS.filter((pl) => pl.life > 0);
  // enemy shots
  for (const s of R.ES) {
    if (s.dead) continue;
    s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.t > s.life) { s.dead = true; continue; }
    if (Math.hypot(s.x - p.x, s.y - p.y) < s.r + 4) { hurtPlayer(s.dmg); s.dead = true; burstAt(s.x, s.y, "#ff6ab0", 5); }
  }
  // telegraphed slams
  for (const tg of R.TELE) {
    tg.t += dt;
    if (tg.t >= tg.max && !tg.done) {
      tg.done = true; shake(5); sfx("slam");
      if (Math.hypot(p.x - tg.x, p.y - tg.y) < tg.r) hurtPlayer(tg.dmg);
      for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; part(tg.x + Math.cos(a) * tg.r * 0.9, tg.y + Math.sin(a) * tg.r * 0.9, Math.cos(a) * 40, Math.sin(a) * 40 - 20, 0.5, pickr(["#a69fc2", "#6b6488", "#efe9ff"]), 1, 120); }
    }
  }
  R.TELE = R.TELE.filter((tg) => !tg.done);
  // pickups
  for (const k of R.PK) {
    if (k.dead) continue;
    k.t += dt;
    if (k.vz || k.z > 0) { k.z += k.vz * dt; k.vz -= 320 * dt; if (k.z <= 0) { k.z = 0; k.vz = Math.abs(k.vz) > 40 ? -k.vz * 0.35 : 0; } }
    const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy) || 1;
    if (k.type === "chest") { if (d < 12 && !R.ended && !R.dawned) { k.dead = true; if (R.demo) rollChest(k.tier); else UI.chest(k.tier); } continue; }
    if (!k.mag && (d < R.S.magnet || R.dawned)) { k.mag = true; k.sp = -45; }
    if (k.mag) { k.sp = Math.min(440, k.sp + 720 * dt); const mv = Math.min(d, k.sp * dt); k.x += (dx / d) * mv; k.y += (dy / d) * mv; }
    if (d < 7) collect(k);
  }
  // housekeeping
  if (R.P.length > 40) R.P = R.P.filter((q) => !q.dead);
  if (R.E.length > 60) R.E = R.E.filter((e) => !e.dead);
  if (R.ES.length > 30) R.ES = R.ES.filter((s) => !s.dead);
  if (R.PK.length > 50) R.PK = R.PK.filter((k) => !k.dead);
  updateFx(dt);
  if (!R.ended) { spawner(dt); props(dt); }
  if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 14);
  if (R.flashA > 0) R.flashA = Math.max(0, R.flashA - dt * 1.6);
  if (R.hurtA > 0) R.hurtA = Math.max(0, R.hurtA - dt * 1.2);
  // achievements tick
  if (!R.demo) {
    R.achT -= dt; if (R.achT <= 0) { R.achT = 0.5; checkAch(R); }
    R.saveT = (R.saveT || 0) + dt; if (R.saveT > 30) { R.saveT = 0; save(); }
  }
  // dawn
  if (!R.opts.endless && !R.dawned && R.t >= 900) beginDawn();
  if (R.dawned) { R.dawnT += dt; if (R.dawnT > 5.5 && !R.ended) endRun(true); }
  if (R.ended) R.endT += dt;
  // demo: pick upgrades on its own and restart now and then so the title scene stays lively
  if (R.demo) {
    if (R.pending > 0) { const c = genChoices(); applyChoice(c[(Math.random() * c.length) | 0]); }
    R.demoT += dt; if (R.demoT > 80) startDemo();
  }
}
function burstAt(x, y, c, n) { for (let i = 0; i < n; i++) part(x, y, rnd(-50, 50), rnd(-60, 10), rnd(0.2, 0.4), c, 1, 160); }
function collect(k) {
  k.dead = true;
  switch (k.type) {
    case "gem": addXP(k.val); sfx("gem"); break;
    case "coin": addGold(k.val || 1); break;
    case "bag": addGold(k.val || 10); break;
    case "bread": heal(30); break;
    case "lodestar": for (const g of R.PK) if (g.type === "gem" && !g.mag) { g.mag = true; g.sp = -60; } sfx("pick"); flash("#a8f0ff", 0.25); break;
    case "flare": flare(); break;
    case "clock": R.freeze = 6; sfx("freeze"); flash("#a8f0ff", 0.4); break;
  }
}
function beginDawn() {
  R.dawned = true; R.dawnT = 0; R.won = true;
  musicPlay("dawn", 3); sfx("dawn");
  for (const e of R.E) if (!e.dead && !e.d.prop) e.burn = rnd(0.2, 2.6);
  R.ES.length = 0; R.TELE.length = 0;
  UI.banner("Dawn breaks", "You kept the lantern lit");
}
function updateFx(dt) {
  for (const f of R.FX) f.t += dt;
  R.FX = R.FX.filter((f) => f.t < f.max);
  for (const q of R.PT) { q.life -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * 2; }
  R.PT = R.PT.filter((q) => q.life > 0);
  for (const n of R.NUM) n.t += dt;
  R.NUM = R.NUM.filter((n) => n.t < 0.7);
}

/* ---------- end of run ---------- */
function endRun(won) {
  if (R.ended) return;
  R.ended = true; R.won = won;
  if (!won) { sfx("die"); musicPlay("over", 1); }
  if (R.demo) return;
  const st = SAVE.stats, gold = Math.floor(R.gold);
  st.runs++; st.kills += R.kills; st.time += R.t; st.gold += gold; st.bestLevel = Math.max(st.bestLevel, R.level);
  st.bestKills = Math.max(st.bestKills, R.kills);
  if (!won && !R.quit) st.deaths++;
  if (R.bossKilled) st.bosses++;
  const key = R.stage.id + (R.opts.endless ? ":endless" : "");
  R.prevBest = st.best[key] || 0;
  if (!R.opts.daily) st.best[key] = Math.max(st.best[key] || 0, Math.floor(R.t));
  if (won) SAVE.dawns[R.stage.id] = 1;
  SAVE.gold += gold;
  if (R.opts.daily) {
    const dd = SAVE.daily;
    if (dd.date !== R.opts.date) { dd.date = R.opts.date; dd.best = -1; dd.kills = 0; dd.level = 0; }
    if (R.t > dd.best) { dd.best = Math.floor(R.t); dd.kills = R.kills; dd.level = R.level; }
    dd.done = true;
  }
  R.banked = true;
  checkAch(R);
  save();
  UI.runOver(won);
}
function checkAch(r) {
  for (const a of ACH) {
    if (SAVE.ach[a.id]) continue;
    let ok = false; try { ok = !!a.test(r); } catch { ok = false; }
    if (!ok) continue;
    SAVE.ach[a.id] = Date.now();
    const [type, v] = a.reward;
    let note = "";
    if (type === "char" && !SAVE.chars.includes(v)) { SAVE.chars.push(v); note = "New character: " + CHARS.find((c) => c.id === v).name; }
    else if (type === "stage" && !SAVE.stages.includes(v)) { SAVE.stages.push(v); note = "New stage: " + STAGES[v].name; }
    else if (type === "weapon" && !SAVE.weapons.includes(v)) { SAVE.weapons.push(v); note = "New weapon: " + WEAPONS[v].name; }
    else if (type === "passive" && !SAVE.passives.includes(v)) { SAVE.passives.push(v); note = "New item: " + PASSIVES[v].name; }
    else if (type === "mode" && !SAVE.modes.includes(v)) { SAVE.modes.push(v); note = "New mode: " + (v === "blood" ? "Blood Moon" : "Endless Night"); }
    else if (type === "gold") { SAVE.gold += v; note = "+" + fmtInt(v) + " gold"; }
    if (r) (r.newAch = r.newAch || []).push({ a, note });
    UI.toast(a.name, note);
    save();
  }
}

/* ---------- drawing ---------- */
function drawSprite(s, x, y, flip, sc = 1, flashOn = false) {
  const img = flashOn ? (flip ? s.wf : s.white) : flip ? s.f : s.c;
  ctx.drawImage(img, Math.round(x - (s.w * sc) / 2), Math.round(y - (s.h * sc) / 2), s.w * sc, s.h * sc);
}
function drawGround(camX, camY, emissive) {
  const S = 128, x0 = Math.floor(camX / S), x1 = Math.floor((camX + VW) / S), y0 = Math.floor(camY / S), y1 = Math.floor((camY + VH) / S);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const v = CHUNKS[(hash2(cx, cy, 7) * CHUNKS.length) | 0];
    ctx.drawImage(emissive ? v.e : v.g, cx * S - camX, cy * S - camY);
  }
}
const _drawList = [];
function render() {
  const p = R.p, set = SAVE.settings;
  let sx = 0, sy = 0;
  if (R.shake > 0 && set.shake) { sx = (Math.random() - 0.5) * R.shake * 2; sy = (Math.random() - 0.5) * R.shake * 2; }
  const camX = Math.round(p.x - VW / 2 + sx), camY = Math.round(p.y - VH / 2 + sy);
  R.camX = camX; R.camY = camY;
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  drawGround(camX, camY, false);

  // fire pools
  for (const pl of R.POOLS) {
    const k = Math.min(1, pl.t * 6) * Math.min(1, pl.life * 2), r = Math.round(pl.r);
    const d1 = discSpr(r, "#e8762d", "#d6304f", 0.35), d2 = discSpr(Math.max(2, Math.round(r * 0.65)), null, "#ffa34d", 0.5);
    ctx.globalAlpha = 0.8 * k;
    ctx.drawImage(d1, Math.round(pl.x - camX - r), Math.round(pl.y - camY - r * 0.8), d1.width, Math.round(d1.height * 0.8));
    ctx.drawImage(d2, Math.round(pl.x - camX - d2.width / 2), Math.round(pl.y - camY - d2.height * 0.4), d2.width, Math.round(d2.height * 0.8));
    ctx.globalAlpha = 1;
  }
  // auras: a soft dithered floor glow plus a ring that pulses on every tick
  for (const w of R.weapons) {
    if (WEAPONS[w.id].kind !== "aura" || !w.rad) continue;
    const r = Math.round(w.rad + (w.pulse > 0 ? 2 : 0)), evo = w.id === "sanctum", pulse = w.pulse > 0;
    const fill = discSpr(r, null, evo ? "#5fbf4a" : "#ffa34d", 0.125), ring = discSpr(r, evo ? "#b6e86a" : "#ffd25e", null);
    ctx.globalAlpha = pulse ? 0.55 : 0.28; ctx.drawImage(fill, Math.round(p.x - camX - r), Math.round(p.y - camY - r));
    ctx.globalAlpha = pulse ? 0.95 : 0.55; ctx.drawImage(ring, Math.round(p.x - camX - r), Math.round(p.y - camY - r));
    ctx.globalAlpha = 1;
  }
  // pickups (gems are drawn after the darkness so they glow)
  for (const k of R.PK) {
    if (k.dead || k.type === "gem") continue;
    const x = k.x - camX, y = k.y - camY;
    if (x < -20 || y < -20 || x > VW + 20 || y > VH + 20) continue;
    let s;
    if (k.type === "gem") s = k.big || k.val >= 20 ? SPR.gem3 : k.val >= 5 ? SPR.gem2 : SPR.gem1;
    else s = SPR[k.type];
    if (k.type === "chest") s = SPR.chest;
    const bob = k.type === "gem" ? 0 : Math.sin(k.t * 4) * 1;
    ctx.drawImage(shadowSpr(s.w * 0.7), Math.round(x - s.w * 0.35), Math.round(y + s.h / 2 - 2));
    drawSprite(s, x, y - k.z + bob, false, k.big ? 2 : 1);
  }
  // entities, y-sorted
  const list = _drawList; list.length = 0;
  for (const e of R.E) if (!e.dead) list.push(e);
  list.sort((a, b) => a.y + a.r * (a.scale || 1) - (b.y + b.r * (b.scale || 1)));
  let playerDrawn = false;
  const drawP = () => {
    playerDrawn = true;
    const fr = SPR[R.ch.id], moving = p.moving, f = fr[moving ? Math.floor(p.anim * 7) % 2 : 0];
    const x = p.x - camX, y = p.y - camY - (moving && Math.floor(p.anim * 7) % 2 ? 1 : 0);
    ctx.drawImage(shadowSpr(12), Math.round(x - 6), Math.round(p.y - camY + f.h / 2 - 3));
    if (p.inv > 0.15 && Math.floor(R.t * 20) % 2) ctx.globalAlpha = 0.45;
    if (R.ended && !R.won) ctx.globalAlpha = Math.max(0, 1 - R.endT);
    drawSprite(f, x, y, p.face < 0, 1, p.hurtT > 0.12);
    ctx.globalAlpha = 1;
  };
  for (const e of list) {
    if (!playerDrawn && e.y + e.r * (e.scale || 1) > p.y + 6) drawP();
    const x = e.x - camX, y = e.y - camY;
    if (x < -60 || y < -60 || x > VW + 60 || y > VH + 60) continue;
    const f = frameOf(e), sc = e.scale || 1, flip = e.face < 0;
    const fy = y + (e.bob || 0) + (e.shk ? rnd(-1, 1) : 0), fx = x + (e.shk ? rnd(-1, 1) : 0);
    if (!e.d.ghost || e.boss) ctx.drawImage(shadowSpr(f.w * sc * 0.75), Math.round(x - (f.w * sc * 0.75) / 2), Math.round(y + (f.h * sc) / 2 - 2 * sc));
    if (e.elite || e.boss === "mid") {
      const [t, tf] = tint(f, e.elite ? "#ff3355" : "#ffd25e"), img = flip ? tf : t, w = f.w * sc, h = f.h * sc;
      const ox = Math.round(fx - w / 2), oy = Math.round(fy - h / 2);
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(R.t * 7);
      ctx.drawImage(img, ox - 1, oy, w, h); ctx.drawImage(img, ox + 1, oy, w, h); ctx.drawImage(img, ox, oy - 1, w, h); ctx.drawImage(img, ox, oy + 1, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = (e.d.ghost && !e.boss ? 0.85 : 1) * (e.alpha ?? 1);
    if (e.burn >= 0) { const [t, tf] = tint(f, "#ffa34d"); drawSprite(f, fx, fy, flip, sc); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(R.t * 30 + e.id); ctx.drawImage(flip ? tf : t, Math.round(fx - (f.w * sc) / 2), Math.round(fy - (f.h * sc) / 2), f.w * sc, f.h * sc); if (Math.random() < 0.3) part(e.x + rnd(-4, 4), e.y + rnd(-4, 4), 0, -30, 0.4, "#ffd25e", 1, -30); }
    else drawSprite(f, fx, fy, flip, sc, e.flash > 0);
    if (R.freeze > 0 && !e.boss && !e.d.prop) { const [t, tf] = tint(f, "#a8f0ff"); ctx.globalAlpha = 0.45; ctx.drawImage(flip ? tf : t, Math.round(fx - (f.w * sc) / 2), Math.round(fy - (f.h * sc) / 2), f.w * sc, f.h * sc); }
    ctx.globalAlpha = 1;
  }
  if (!playerDrawn) drawP();
  // orbs
  for (const w of R.weapons) {
    if (!w.orbs || !w.orbs.length) continue;
    const s = w.id === "halo" ? SPR.halo : SPR.orb, k = w.id === "halo" ? 1 : Math.min(1, (w.full - w.life) * 6, w.life * 4);
    ctx.globalAlpha = Math.max(0.2, k);
    for (let i = 0; i < w.orbs.length; i += 2) drawSprite(s, w.orbs[i] - camX, w.orbs[i + 1] - camY, false, Math.min(1.8, w.s.area) > 1.4 ? 1.5 : 1);
    ctx.globalAlpha = 1;
  }
  // projectiles
  for (const q of R.P) {
    if (q.dead) continue;
    const x = q.x - camX, y = q.y - camY;
    if (x < -30 || y < -30 || x > VW + 30 || y > VH + 30) continue;
    if (q.rots) {
      const n = q.rots.length, ang = q.kind === "bolt" ? Math.atan2(q.vy, q.vx) : q.rot;
      const idx = ((Math.round((ang / TAU) * n) % n) + n) % n, img = q.rots[idx], D = q.rots.size * q.scale;
      ctx.drawImage(img, Math.round(x - D / 2), Math.round(y - D / 2), D, D);
    } else if (q.spr) {
      if (q.kind === "flask") ctx.drawImage(shadowSpr(5), Math.round(x - 2), Math.round(y + 2));
      drawSprite(q.spr, x, y - (q.z || 0), false, q.scale);
    }
  }
  // slashes and other effects
  for (const f of R.FX) {
    const k = f.t / f.max;
    if (f.kind === "slash") drawSlash(f, camX, camY, k);
    else if (f.kind === "ring") { const r = Math.round(lerp(f.r0, f.r1, k)); const d = discSpr(r, f.c, null); ctx.globalAlpha = 1 - k; ctx.drawImage(d, Math.round(f.x - camX - r), Math.round(f.y - camY - r)); ctx.globalAlpha = 1; }
  }
  // particles
  for (const q of R.PT) {
    ctx.globalAlpha = Math.min(1, (q.life / q.max) * 1.6);
    ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), q.s, q.s);
  }
  ctx.globalAlpha = 1;

  drawDarkness(camX, camY);
  ctx.globalAlpha = R.dawned ? Math.max(0, 1 - R.dawnT / 3) : 0.9;
  drawGround(camX, camY, true);
  ctx.globalAlpha = 1;
  // experience gems glow in the dark
  for (const k of R.PK) {
    if (k.dead || k.type !== "gem") continue;
    const x = k.x - camX, y = k.y - camY;
    if (x < -12 || y < -12 || x > VW + 12 || y > VH + 12) continue;
    const s = k.big || k.val >= 20 ? SPR.gem3 : k.val >= 5 ? SPR.gem2 : SPR.gem1;
    drawSprite(s, x, y + Math.sin(k.t * 3 + k.x) * 0.6, false, k.big ? 2 : 1);
  }
  // lightning drawn on top so it pops
  for (const f of R.FX) if (f.kind === "bolt") drawBolt(f, camX, camY);
  // enemy shots glow through the dark so they're always readable
  for (const s of R.ES) { if (!s.dead) drawSprite(s.spr, s.x - camX, s.y - camY, false); }
  // slam warnings
  for (const tg of R.TELE) {
    const k = tg.t / tg.max, r = Math.round(tg.r);
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(tg.t * 25);
    ctx.drawImage(discSpr(r, "#ff3355", "#ff3355", Math.round((0.12 + k * 0.3) * 8) / 8), Math.round(tg.x - camX - r), Math.round(tg.y - camY - r));
    const ri = Math.max(2, Math.round(r * k)); ctx.globalAlpha = 0.9;
    ctx.drawImage(discSpr(ri, "#ffc2e0", null), Math.round(tg.x - camX - ri), Math.round(tg.y - camY - ri));
    ctx.globalAlpha = 1;
  }
  // lantern warmth
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.16 + Math.sin(R.t * 9) * 0.02;
  const gl = glowSpr(56, "#ffb547");
  ctx.drawImage(gl, Math.round(p.x - camX + p.face * 5 - 56), Math.round(p.y - camY + 2 - 56));
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  // health bar under the player
  if (!R.demo && !R.ended) {
    const w = 16, x = Math.round(p.x - camX - w / 2), y = Math.round(p.y - camY + 11), hp = clamp(p.hp / R.S.maxHp, 0, 1);
    ctx.fillStyle = "#0d0b17"; ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = "#3b1424"; ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = hp > 0.3 ? "#ff4d5e" : Math.floor(R.t * 6) % 2 ? "#ffffff" : "#ff4d5e"; ctx.fillRect(x, y, Math.ceil(w * hp), 2);
  }
  // elite health pips
  for (const e of R.vis) {
    if (!e.elite || e.hp >= e.maxHp) continue;
    const w = 14, x = Math.round(e.x - camX - w / 2), y = Math.round(e.y - camY - e.r - 10);
    ctx.fillStyle = "#0d0b17"; ctx.fillRect(x - 1, y - 1, w + 2, 3); ctx.fillStyle = "#ff3355"; ctx.fillRect(x, y, Math.ceil((w * e.hp) / e.maxHp), 1);
  }
  // damage numbers
  for (const n of R.NUM) {
    const k = n.t / 0.7; ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    drawNum(ctx, n.v, n.x - camX, n.y - camY - Math.min(1, k * 3) * 8, n.c);
  }
  ctx.globalAlpha = 1;
  // arrows to off-screen chests and bosses
  if (!R.demo) {
    for (const k of R.PK) if (k.type === "chest" && !k.dead) edgeArrow(k.x, k.y, camX, camY, "#ffd25e");
    if (R.boss && !R.boss.dead) edgeArrow(R.boss.x, R.boss.y, camX, camY, "#ff3355");
  }
  // screen tints
  if (R.freeze > 0) { ctx.fillStyle = "rgba(120,200,255,0.10)"; ctx.fillRect(0, 0, VW, VH); }
  if (R.dawned) { const k = Math.min(1, R.dawnT / 3); ctx.fillStyle = `rgba(255,190,120,${0.22 * k})`; ctx.fillRect(0, 0, VW, VH); }
  const low = !R.demo && !R.ended && p.hp / R.S.maxHp < 0.3;
  if ((R.hurtA > 0 || low) && set.flash !== false) { ctx.globalAlpha = Math.min(1, R.hurtA * 1.6 + (low ? 0.35 + 0.2 * Math.sin(R.t * 5) : 0)); ctx.drawImage(VIGNETTE, 0, 0); ctx.globalAlpha = 1; }
  if (R.flashA > 0) { ctx.globalAlpha = R.flashA; ctx.fillStyle = R.flashC; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  if (R.ended && !R.won) { ctx.globalAlpha = Math.min(0.85, R.endT * 0.5); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
}
function edgeArrow(x, y, camX, camY, c) {
  const sx = x - camX, sy = y - camY;
  if (sx > 6 && sy > 6 && sx < VW - 6 && sy < VH - 6) return;
  const cx = VW / 2, cy = VH / 2, a = Math.atan2(sy - cy, sx - cx), ca = Math.cos(a), sa = Math.sin(a);
  const k = Math.min((VW / 2 - 14) / Math.max(1e-6, Math.abs(ca)), (VH / 2 - 14) / Math.max(1e-6, Math.abs(sa)));
  const ax = cx + ca * k, ay = cy + sa * k, pulse = 0.65 + 0.35 * Math.sin(R.t * 8);
  for (const grow of [1, 0]) {
    ctx.fillStyle = grow ? "#0d0b17" : c; ctx.globalAlpha = grow ? 0.85 : pulse;
    for (let i = -3 - grow; i <= 5 + grow; i++) {
      const half = Math.max(0, (5 - i) * 0.5) + grow;
      for (let j = -half; j <= half; j++) ctx.fillRect(Math.round(ax + ca * i - sa * j), Math.round(ay + sa * i + ca * j), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
/* A crescent swoosh: an arc that bulges upward, thick in the middle, with a bright leading edge.
   It sweeps outward from the keeper and fades. */
function drawSlash(f, camX, camY, k) {
  const W = f.w, H = f.h, cx = f.x - camX, cy = f.y - camY;
  const edge = f.evo ? "#ffc2e0" : "#ffffff", mid = f.evo ? "#ff6ab0" : "#a8f0ff", tail = f.evo ? "#d6304f" : "#4f7cff";
  ctx.globalAlpha = 1 - k * k * 0.85;
  const steps = Math.ceil(W);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    if (u < k * 1.15 - 0.15) continue;
    const s = Math.sin(u * Math.PI), x = Math.round(cx + f.side * (u - 0.5) * W);
    const y = Math.round(cy - s * H * 0.6 + H * 0.3), th = Math.max(1, Math.round(s * H * 0.42 * (1 - k * 0.5)));
    ctx.fillStyle = tail; ctx.fillRect(x, y, 1, th);
    if (th > 2) { ctx.fillStyle = mid; ctx.fillRect(x, y, 1, Math.ceil(th * 0.55)); }
    ctx.fillStyle = edge; ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}
function drawBolt(f, camX, camY) {
  const k = f.t / f.max, r = RNG(f.seed + Math.floor(f.t * 30));
  ctx.globalAlpha = 1 - k * 0.7;
  const pts = [[f.fx, f.fy]], segs = 8;
  for (let i = 1; i < segs; i++) { const u = i / segs; pts.push([lerp(f.fx, f.x, u) + (r() - 0.5) * 14, lerp(f.fy, f.y, u) + (r() - 0.5) * 6]); }
  pts.push([f.x, f.y]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) | 0;
    for (let j = 0; j <= n; j++) {
      const u = n ? j / n : 0, x = Math.round(lerp(ax, bx, u) - camX), y = Math.round(lerp(ay, by, u) - camY);
      ctx.fillStyle = "#4f7cff"; ctx.fillRect(x - 1, y, f.w + 2, 1);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, f.w, 1);
    }
  }
  ctx.globalAlpha = 1;
}
function drawDarkness(camX, camY) {
  const st = R.stage, p = R.p;
  let a = st.darkA;
  if (!R.opts.endless && R.t > 840) a *= 1 - Math.min(1, (R.t - 840) / 60) * 0.3;
  if (R.dawned) a *= Math.max(0, 1 - R.dawnT / 3);
  if (R.opts.blood) a = Math.min(0.85, a + 0.04);
  if (a < 0.02) return;
  dkx.globalCompositeOperation = "source-over"; dkx.globalAlpha = 1;
  dkx.clearRect(0, 0, VW, VH);
  dkx.fillStyle = R.opts.blood ? "#140306" : st.dark; dkx.globalAlpha = a; dkx.fillRect(0, 0, VW, VH);
  dkx.globalCompositeOperation = "destination-out";
  const L = (x, y, r, al) => {
    const sx = x - camX, sy = y - camY; if (sx < -r || sy < -r || sx > VW + r || sy > VH + r) return;
    const s = lightSpr(r); dkx.globalAlpha = al; dkx.drawImage(s, Math.round(sx - s.width / 2), Math.round(sy - s.height / 2));
  };
  const fl = Math.sin(R.t * 9) * 2 + Math.sin(R.t * 23) * 1.2;
  L(p.x + p.face * 4, p.y, (R.ended && !R.won ? Math.max(4, 96 * (1 - R.endT * 0.6)) : 96) + fl, 1);
  for (const k of R.PK) if (!k.dead && k.type !== "gem") L(k.x, k.y, 16, 0.7);
  for (const e of R.E) {
    if (e.dead) continue;
    if (e.d.prop) L(e.x, e.y - 2, e.d.light + Math.sin(R.t * 7 + e.id) * 2, 0.95);
    else if (e.d.light) L(e.x, e.y, e.d.light * 0.75, 0.55);
    else if (e.burn >= 0) L(e.x, e.y, 14, 0.8);
    else if (e.boss) L(e.x, e.y, 26, 0.5);
  }
  for (const q of R.P) if (!q.dead && q.light) L(q.x, q.y, q.light, 0.45);
  for (const w of R.weapons) if (w.orbs) for (let i = 0; i < w.orbs.length; i += 2) L(w.orbs[i], w.orbs[i + 1], 14, 0.5);
  for (const pl of R.POOLS) L(pl.x, pl.y, pl.r * 1.3, 0.5);
  for (const f of R.FX) {
    if (f.kind === "bolt") L(f.x, f.y, 60, 1 - f.t / f.max);
    else if (f.kind === "slash") L(f.x, f.y, f.w * 0.7, 0.6 * (1 - f.t / f.max));
  }
  for (const s of R.ES) if (!s.dead) L(s.x, s.y, 10, 0.6);
  dkx.globalAlpha = 1; dkx.globalCompositeOperation = "source-over";
  ctx.drawImage(dk, 0, 0);
}

/* ---------- demo run behind the title screen ---------- */
function startDemo() {
  const stage = pickr(SAVE.stages.filter((s) => STAGES[s])) || "wood";
  const chars = SAVE.chars.filter((c) => CHARS.some((x) => x.id === c));
  newRun({ demo: true, stage, char: pickr(chars) || "wren" });
  R.t = 100 + Math.random() * 120;
  R.evIdx = R.stage.events.length;
  R.demoT = 0;
  for (let i = 0; i < 5; i++) { const c = genChoices(); applyChoice(c[(Math.random() * c.length) | 0]); }
}
