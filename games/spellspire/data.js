"use strict";
/* SPELLSPIRE content: cards, relics, potions, enemies, encounters and events. */
const KW = { Burn: "Takes this much damage at the start of its turn, then Burn goes down by 1.", Frost: "Deals 25% less attack damage. Goes down by 1 each turn.", Expose: "Takes 50% more attack damage. Goes down by 1 each turn.", Might: "Adds this much damage to every attack hit.", Thorns: "Deals this much damage back to attackers.", Exhaust: "Removed for the rest of this combat.", Block: "Stops incoming damage. Disappears at the start of your next turn.", Daze: "An unplayable card that vanishes at the end of your turn." };
const kw = (s) => s.replace(/\b(Burn|Frost|Expose|Might|Thorns|Exhaust|Block)\b/g, "<em>$1</em>");
const CARDS = {};
function card(id, o) { CARDS[id] = { id, ...o }; }
/* starters */
card("bolt", { name: "Arcane Bolt", type: "attack", cost: 1, rar: "starter", tgt: "one", icon: "bolt", d: (u) => `Deal ${u ? 9 : 6} damage.`, p: (S, u, t) => S.dmg(t, u ? 9 : 6) });
card("barrier", { name: "Barrier", type: "skill", cost: 1, rar: "starter", tgt: "self", icon: "shield", d: (u) => `Gain ${u ? 8 : 5} Block.`, p: (S, u) => S.block(u ? 8 : 5) });
card("ember", { name: "Ember", type: "attack", cost: 1, rar: "starter", tgt: "one", icon: "fire", d: (u) => `Deal ${u ? 4 : 3} damage. Apply ${u ? 5 : 3} Burn.`, p: (S, u, t) => { S.dmg(t, u ? 4 : 3); S.apply(t, "burn", u ? 5 : 3); } });
/* commons */
card("missiles", { name: "Twin Missiles", type: "attack", cost: 1, rar: "common", tgt: "one", icon: "bolt", d: (u) => `Deal ${u ? 5 : 4} damage twice.`, p: (S, u, t) => S.dmg(t, u ? 5 : 4, 2) });
card("frostbite", { name: "Frostbite", type: "attack", cost: 1, rar: "common", tgt: "one", icon: "ice", d: (u) => `Deal ${u ? 7 : 5} damage. Apply ${u ? 3 : 2} Frost.`, p: (S, u, t) => { S.dmg(t, u ? 7 : 5); S.apply(t, "frost", u ? 3 : 2); } });
card("arcblade", { name: "Arc Blade", type: "attack", cost: 0, rar: "common", tgt: "one", icon: "sword", d: (u) => `Deal ${u ? 5 : 3} damage. Draw 1 card.`, p: (S, u, t) => { S.dmg(t, u ? 5 : 3); S.draw(1); } });
card("riposte", { name: "Riposte", type: "attack", cost: 1, rar: "common", tgt: "one", icon: "sword", d: (u) => `Deal ${u ? 8 : 6} damage. Gain ${u ? 6 : 4} Block.`, p: (S, u, t) => { S.dmg(t, u ? 8 : 6); S.block(u ? 6 : 4); } });
card("thunder", { name: "Thunderclap", type: "attack", cost: 1, rar: "common", tgt: "all", icon: "bolt", d: (u) => `Deal ${u ? 7 : 5} damage to ALL enemies. Apply 1 Expose to ALL.`, p: (S, u) => { S.dmgAll(u ? 7 : 5); S.applyAll("expose", 1); } });
card("ignite", { name: "Ignite", type: "skill", cost: 0, rar: "common", tgt: "all", icon: "fire", d: (u) => `Apply ${u ? 3 : 2} Burn to ALL enemies.`, p: (S, u) => S.applyAll("burn", u ? 3 : 2) });
card("blink", { name: "Blink", type: "skill", cost: 1, rar: "common", tgt: "self", icon: "swirl", d: (u) => `Gain ${u ? 9 : 6} Block. Draw 1 card.`, p: (S, u) => { S.block(u ? 9 : 6); S.draw(1); } });
card("frostarmor", { name: "Frost Armor", type: "skill", cost: 1, rar: "common", tgt: "self", icon: "ice", d: (u) => `Gain ${u ? 10 : 7} Block. Apply ${u ? 2 : 1} Frost to ALL enemies.`, p: (S, u) => { S.block(u ? 10 : 7); S.applyAll("frost", u ? 2 : 1); } });
card("hex", { name: "Hex", type: "skill", cost: 1, rar: "common", tgt: "one", icon: "eye", d: (u) => `Apply ${u ? 3 : 2} Expose. Draw 1 card.`, p: (S, u, t) => { S.apply(t, "expose", u ? 3 : 2); S.draw(1); } });
card("insight", { name: "Insight", type: "skill", cost: 1, upCost: 0, rar: "common", tgt: "self", icon: "book", d: () => `Draw 3 cards.`, p: (S) => S.draw(3) });
card("shatter", { name: "Shatter", type: "attack", cost: 1, rar: "common", tgt: "one", icon: "ice", d: (u) => `Deal ${u ? 11 : 8} damage. Double damage if the target has Frost.`, p: (S, u, t) => S.dmg(t, (u ? 11 : 8) * (t.st.frost > 0 ? 2 : 1)) });
/* uncommons */
card("fireball", { name: "Fireball", type: "attack", cost: 2, rar: "uncommon", tgt: "one", icon: "fire", d: (u) => `Deal ${u ? 18 : 14} damage. Apply ${u ? 3 : 2} Burn.`, p: (S, u, t) => { S.dmg(t, u ? 18 : 14); S.apply(t, "burn", u ? 3 : 2); } });
card("chain", { name: "Chain Lightning", type: "attack", cost: 2, rar: "uncommon", tgt: "all", icon: "bolt", d: (u) => `Deal ${u ? 11 : 8} damage to ALL enemies.`, p: (S, u) => S.dmgAll(u ? 11 : 8) });
card("detonate", { name: "Detonate", type: "attack", cost: 1, rar: "uncommon", tgt: "one", icon: "fire", d: (u) => `Remove all Burn from the target. Deal ${u ? 4 : 3} damage for each Burn removed.`, p: (S, u, t) => { const b = t.st.burn || 0; t.st.burn = 0; S.dmg(t, b * (u ? 4 : 3), 1, true); } });
card("siphon", { name: "Soul Siphon", type: "attack", cost: 2, rar: "uncommon", tgt: "one", icon: "skull", ex: true, d: (u) => `Deal ${u ? 13 : 10} damage. Heal ${u ? 6 : 4}. Exhaust.`, p: (S, u, t) => { S.dmg(t, u ? 13 : 10); S.heal(u ? 6 : 4); } });
card("starfall", { name: "Starfall", type: "attack", cost: 2, rar: "uncommon", tgt: "all", icon: "star", d: (u) => `Deal ${u ? 4 : 3} damage to a random enemy 5 times.`, p: (S, u) => S.dmgRandom(u ? 4 : 3, 5) });
card("mirror", { name: "Mirror Shield", type: "skill", cost: 2, rar: "uncommon", tgt: "self", icon: "shield", d: (u) => `Gain ${u ? 16 : 12} Block and ${u ? 4 : 3} Thorns this turn.`, p: (S, u) => { S.block(u ? 16 : 12); S.self("tthorns", u ? 4 : 3); } });
card("flamewall", { name: "Ward of Flames", type: "skill", cost: 1, rar: "uncommon", tgt: "self", icon: "fire", d: (u) => `Gain ${u ? 6 : 4} Block. Enemies that attack you this turn get ${u ? 3 : 2} Burn.`, p: (S, u) => { S.block(u ? 6 : 4); S.self("flamewall", u ? 3 : 2); } });
card("surge", { name: "Mana Surge", type: "skill", cost: 0, rar: "uncommon", tgt: "self", icon: "orb", ex: true, d: (u) => `Gain ${u ? 2 : 1} energy. Exhaust.`, p: (S, u) => S.energy(u ? 2 : 1) });
card("echo", { name: "Arcane Echo", type: "skill", cost: 1, upCost: 0, rar: "uncommon", tgt: "self", icon: "swirl", ex: true, d: () => `Your next card this turn is played twice. Exhaust.`, p: (S) => S.self("echo", 1) });
card("empower", { name: "Empower", type: "skill", cost: 1, rar: "uncommon", tgt: "self", icon: "hand", d: (u) => `Gain ${u ? 3 : 2} Might.`, p: (S, u) => S.self("might", u ? 3 : 2) });
card("light", { name: "Healing Light", type: "skill", cost: 1, rar: "uncommon", tgt: "self", icon: "heart", ex: true, d: (u) => `Heal ${u ? 9 : 6}. Exhaust.`, p: (S, u) => S.heal(u ? 9 : 6) });
card("runic", { name: "Runic Ward", type: "power", cost: 1, rar: "uncommon", tgt: "self", icon: "shield", d: (u) => `At the end of each turn, gain ${u ? 6 : 4} Block.`, p: (S, u) => S.self("runic", u ? 6 : 4) });
card("thornaura", { name: "Thorn Aura", type: "power", cost: 1, rar: "uncommon", tgt: "self", icon: "star", d: (u) => `Gain ${u ? 5 : 3} Thorns.`, p: (S, u) => S.self("thorns", u ? 5 : 3) });
card("inferno", { name: "Inferno", type: "power", cost: 2, rar: "uncommon", tgt: "self", icon: "fire", d: (u) => `At the start of your turn, apply ${u ? 3 : 2} Burn to ALL enemies.`, p: (S, u) => S.self("inferno", u ? 3 : 2) });
/* rares */
card("meteor", { name: "Meteor", type: "attack", cost: 3, rar: "rare", tgt: "one", icon: "star", d: (u) => `Deal ${u ? 40 : 30} damage. Apply 3 Burn.`, p: (S, u, t) => { S.dmg(t, u ? 40 : 30); S.apply(t, "burn", 3); } });
card("blizzard", { name: "Blizzard", type: "attack", cost: 2, rar: "rare", tgt: "all", icon: "ice", d: (u) => `Deal ${u ? 10 : 7} damage to ALL enemies. Apply ${u ? 3 : 2} Frost to ALL.`, p: (S, u) => { S.dmgAll(u ? 10 : 7); S.applyAll("frost", u ? 3 : 2); } });
card("trance", { name: "Battle Trance", type: "power", cost: 2, upCost: 1, rar: "rare", tgt: "self", icon: "orb", d: () => `Gain 1 extra energy every turn.`, p: (S) => S.self("trance", 1) });
card("aegis", { name: "Aegis", type: "skill", cost: 2, rar: "rare", tgt: "self", icon: "shield", ex: true, d: (u) => `Gain ${u ? 30 : 22} Block. Exhaust.`, p: (S, u) => S.block(u ? 30 : 22) });
card("wildmagic", { name: "Wild Magic", type: "skill", cost: 1, rar: "rare", tgt: "self", icon: "swirl", d: (u) => `Draw ${u ? 4 : 3} cards. They cost 0 this turn.`, p: (S, u) => S.draw(u ? 4 : 3, true) });
card("phoenix", { name: "Phoenix Form", type: "power", cost: 3, upCost: 2, rar: "rare", tgt: "self", icon: "fire", d: () => `At the end of your turn, deal 6 damage to ALL enemies and heal 2.`, p: (S) => S.self("phoenix", 1) });
/* status */
card("daze", { name: "Daze", type: "status", cost: -1, rar: "status", tgt: "none", icon: "eye", eth: true, d: () => `Unplayable. Vanishes at the end of your turn.`, p: () => {} });
const POOL = { common: Object.values(CARDS).filter((c) => c.rar === "common").map((c) => c.id), uncommon: Object.values(CARDS).filter((c) => c.rar === "uncommon").map((c) => c.id), rare: Object.values(CARDS).filter((c) => c.rar === "rare").map((c) => c.id) };

const RELICS = {
  emberstone: { name: "Ember Stone", icon: "🔥", d: "At the start of each combat, apply 2 Burn to ALL enemies." },
  feather: { name: "Ward Feather", icon: "🪶", d: "Start each combat with 8 Block." },
  moss: { name: "Healing Moss", icon: "🌿", d: "Heal 5 after each combat." },
  crystal: { name: "Mana Crystal", icon: "💎", d: "Gain 1 extra energy on your first turn." },
  quill: { name: "Scholar's Quill", icon: "🖋", d: "Draw 2 extra cards on your first turn." },
  ring: { name: "Iron Ring", icon: "💍", d: "Start each combat with 1 Might." },
  coin: { name: "Lucky Coin", icon: "🪙", d: "Gain 25% more gold." },
  snowglobe: { name: "Snow Globe", icon: "❄", d: "At the start of each combat, apply 1 Frost to ALL enemies." },
  bracer: { name: "Spiked Bracer", icon: "🦔", d: "Start each combat with 2 Thorns." },
  map: { name: "Old Map", icon: "🗺", d: "Shop prices are 25% lower." },
  phoenix: { name: "Phoenix Plume", icon: "🪽", d: "Once, when you would die, heal to 40% instead." },
  hourglass: { name: "Hourglass", icon: "⏳", d: "Every third turn, gain 1 extra energy." },
  tome: { name: "Battle Tome", icon: "📕", d: "Your first attack each combat deals double damage." },
  charm: { name: "Star Charm", icon: "⭐", d: "At the end of your turn, if you have no Block, gain 5." },
  heart: { name: "Giant's Heart", icon: "❤", d: "Raise your max HP by 12." },
  lens: { name: "Seer's Lens", icon: "🔮", d: "Card rewards offer 4 choices." },
};
const POTIONS = { heal: { name: "Healing Draught", icon: "🧪", d: "Heal 20 HP." }, fire: { name: "Fire Flask", icon: "🔥", d: "Deal 20 damage to an enemy.", tgt: true }, iron: { name: "Iron Tonic", icon: "🛡", d: "Gain 12 Block." }, swift: { name: "Swift Brew", icon: "💨", d: "Draw 3 cards." }, mana: { name: "Mana Vial", icon: "✨", d: "Gain 2 energy." } };

/* enemies: moves are picked by `ai(e, turn, rnd)`; each move describes damage/block/buffs */
const M = (n, o) => ({ n, ...o });
const ENEMIES = {
  slime: { name: "Gloom Slime", hp: [28, 32], art: ["blob", "#5fbf7a", "#2f7a45"], moves: [M("Slam", { atk: 6 }), M("Splatter", { atk: 3, hits: 2 }), M("Ooze", { atk: 4, deb: { expose: 1 } })] },
  bat: { name: "Cave Bat", hp: [16, 20], art: ["wing", "#7a6aa8", "#3f3466"], moves: [M("Bite", { atk: 4, hits: 2 }), M("Screech", { atk: 3, deb: { frost: 1 } })] },
  skeleton: { name: "Bone Guard", hp: [32, 36], art: ["humanoid", "#e8e2d0", "#8a8270", "skull"], moves: [M("Guard", { blk: 7, atk: 4 }), M("Cleave", { atk: 9 })], ai: (e, t) => e.moves[t % 2] },
  mossling: { name: "Mossling", hp: [22, 26], art: ["plant", "#7cc85a", "#3f7a2a"], moves: [M("Spores", { buf: { might: 2 } }), M("Lash", { atk: 5 })], ai: (e, t) => e.moves[t % 3 === 0 ? 0 : 1] },
  acolyte: { name: "Ash Acolyte", hp: [30, 34], art: ["humanoid", "#8a3a4a", "#3d1520", "hood"], moves: [M("Ritual", { buf: { might: 3 } }), M("Dark Bolt", { atk: 6 })], ai: (e, t) => e.moves[t === 0 ? 0 : 1] },
  imp: { name: "Ember Imp", hp: [12, 15], art: ["imp", "#ff7a4a", "#a33a1a"], moves: [M("Scratch", { atk: 5 }), M("Hex", { deb: { burn: 2 } })] },
  gargoyle: { name: "Gargoyle", hp: [70, 74], elite: true, art: ["wing", "#8f96a8", "#4a5064", "horns"], moves: [M("Stone Skin", { blk: 14 }), M("Crush", { atk: 16 }), M("Wing Buffet", { atk: 6, hits: 2 })], ai: (e, t) => e.moves[t % 3] },
  witch: { name: "Hedge Witch", hp: [60, 64], elite: true, art: ["humanoid", "#5a8a5a", "#2a3f2a", "hat"], moves: [M("Curse", { deb: { burn: 3 }, add: 2 }), M("Hex Bolt", { atk: 11 }), M("Brew", { heal: 8, buf: { might: 2 } })], ai: (e, t) => e.moves[t % 3] },
  warden: { name: "Lantern Warden", hp: [132, 132], boss: true, art: ["golem", "#c9a35a", "#5c4a2a", "lantern"], moves: [M("Lantern Flare", { atk: 5, hits: 3 }), M("Ward", { blk: 14, buf: { might: 2 } }), M("Smother", { atk: 12, deb: { frost: 1 } }), M("Kindle", { deb: { burn: 4 }, add: 1 })], ai: (e, t) => e.moves[t % 4] },
  wraith: { name: "Wraith", hp: [40, 44], art: ["ghost", "#9fb8e8", "#3a4a78"], moves: [M("Chill Touch", { atk: 8, deb: { frost: 1 } }), M("Fade", { blk: 12 }), M("Wail", { atk: 3, hits: 3 })] },
  golem: { name: "Rune Golem", hp: [60, 66], art: ["golem", "#7a8aa8", "#3a4258"], moves: [M("Slam", { atk: 13 }), M("Fortify", { blk: 12 }), M("Charge", { buf: { might: 2 } })], ai: (e, t) => e.moves[[2, 0, 1, 0][t % 4]] },
  viper: { name: "Ash Viper", hp: [36, 40], art: ["serpent", "#a8c84a", "#4a5a1a"], moves: [M("Fangs", { atk: 4, hits: 2, deb: { burn: 2 } }), M("Coil", { blk: 8, buf: { might: 2 } })] },
  shaman: { name: "Bog Shaman", hp: [44, 48], art: ["humanoid", "#6a9a8a", "#2a4a40", "mask"], moves: [M("Hex", { deb: { expose: 2 } }), M("Fire", { atk: 10 }), M("Mend", { healAll: 10 })] },
  knight: { name: "Hollow Knight", hp: [52, 56], art: ["humanoid", "#9aa0b8", "#3f4458", "helm"], moves: [M("Lance", { atk: 12 }), M("Shield Wall", { blk: 12, buf: { thorns: 3 } })], ai: (e, t) => e.moves[t % 2] },
  shadeknight: { name: "Shade Knight", hp: [100, 104], elite: true, art: ["humanoid", "#5a4a8a", "#1f1a3a", "helm"], moves: [M("Reap", { atk: 18 }), M("Flurry", { atk: 5, hits: 3 }), M("Dark Pact", { buf: { might: 3 }, blk: 10 })], ai: (e, t) => e.moves[[2, 0, 1][t % 3]] },
  wisp: { name: "Storm Wisp", hp: [36, 40], elite: true, art: ["orb", "#7ad8ff", "#2a6a9a"], moves: [M("Spark", { atk: 8 }), M("Static", { deb: { frost: 2, expose: 1 } }), M("Arc", { atk: 3, hits: 3 })] },
  hydra: { name: "Ember Hydra", hp: [200, 200], boss: true, art: ["serpent", "#e8643a", "#7a2a10", "crown"], moves: [M("Triple Bite", { atk: 5, hits: 3 }), M("Venom", { deb: { burn: 4 } }), M("Regrow", { heal: 12, buf: { might: 2 } }), M("Roar", { deb: { frost: 1, expose: 1 } }), M("Inferno Breath", { atk: 18 })], ai: (e, t) => e.moves[[0, 1, 4, 3, 0, 2][t % 6]] },
  voidling: { name: "Voidling", hp: [46, 50], art: ["blob", "#8a5ad8", "#2a1050"], moves: [M("Rend", { atk: 11 }), M("Drain", { atk: 8, heal: 8 })] },
  sentinel: { name: "Sentinel", hp: [70, 74], art: ["eye", "#e8d870", "#6a5a1a"], moves: [M("Charge", { blk: 15 }), M("Charge", { blk: 10, buf: { might: 2 } }), M("Beam", { atk: 20 })], ai: (e, t) => e.moves[t % 3] },
  seer: { name: "Pale Seer", hp: [48, 52], art: ["humanoid", "#c8b8e8", "#4a3a6a", "hood"], moves: [M("Foresee", { deb: { expose: 1 }, add: 2 }), M("Mind Spike", { atk: 14 })], ai: (e, t) => e.moves[t % 2] },
  revenant: { name: "Revenant", hp: [56, 60], art: ["humanoid", "#a8a8a0", "#3a3a34", "skull"], moves: [M("Twin Strike", { atk: 8, hits: 2 }), M("Unholy Vigor", { buf: { might: 3 } })], ai: (e, t) => e.moves[t % 3 === 2 ? 1 : 0] },
  archmage: { name: "Archmage", hp: [136, 140], elite: true, art: ["humanoid", "#5a7ae8", "#1a2a6a", "hat"], moves: [M("Arcane Barrage", { atk: 5, hits: 4 }), M("Mana Shield", { blk: 20 }), M("Pyroblast", { atk: 20, deb: { burn: 3 } }), M("Silence", { add: 3, deb: { frost: 2 } })], ai: (e, t) => e.moves[t % 4] },
  behemoth: { name: "Behemoth", hp: [160, 166], elite: true, art: ["golem", "#a86a4a", "#4a2a1a", "horns"], moves: [M("Stomp", { atk: 25 }), M("Roar", { buf: { might: 3 }, deb: { frost: 1 } }), M("Gore", { atk: 10, hits: 2 })], ai: (e, t) => e.moves[[1, 0, 2][t % 3]] },
  heart: { name: "The Spire Heart", hp: [320, 320], boss: true, art: ["heart", "#e83a6a", "#5a0a2a"], moves: [M("Pulse", { atk: 6, hits: 4 }), M("Bastion", { blk: 24, buf: { might: 2 } }), M("Corrupt", { add: 2, deb: { burn: 4, frost: 1 } }), M("Overload", { atk: 32 })], ai: (e, t) => e.moves[t % 4] },
};
const ENCOUNTERS = {
  1: { easy: [["slime"], ["bat", "bat"], ["skeleton"], ["acolyte"]], hard: [["mossling", "slime"], ["imp", "imp", "imp"], ["skeleton", "bat"], ["acolyte", "imp"]], elite: [["gargoyle"], ["witch"]], boss: ["warden"] },
  2: { easy: [["wraith"], ["viper", "viper"], ["golem"]], hard: [["shaman", "knight"], ["wraith", "viper"], ["golem", "imp", "imp"], ["knight", "knight"]], elite: [["shadeknight"], ["wisp", "wisp"]], boss: ["hydra"] },
  3: { easy: [["voidling", "voidling"], ["sentinel"], ["revenant"]], hard: [["seer", "revenant"], ["sentinel", "voidling"], ["revenant", "revenant"], ["seer", "wraith"]], elite: [["archmage"], ["behemoth"]], boss: ["heart"] },
};
/* events: each option has a label, a description and an effect function on the run (R) */
const EVENTS = [
  { title: "The Whispering Fountain", text: "Moonlight ripples across a fountain carved with old runes. The water hums softly.", opts: [{ l: "Drink", d: "Heal 25% of your max HP.", f: (R) => R.heal(Math.round(R.maxHp * 0.25)) }, { l: "Toss a coin", d: "Lose 20 gold. 50% chance to find a relic.", if: (R) => R.gold >= 20, f: (R) => { R.gold -= 20; if (Math.random() < 0.5) R.gainRelic(); else R.note("The coin sinks without a sound."); } }, { l: "Leave", d: "", f: () => {} }] },
  { title: "Abandoned Library", text: "Shelves of crumbling spellbooks lean against each other. One still glows.", opts: [{ l: "Read the glowing book", d: "Choose a powerful card.", f: (R) => R.cardChoice("uncommon+") }, { l: "Search the shelves", d: "Gain 45 gold. Lose 6 HP.", f: (R) => { R.gold += 45; R.hurt(6); } }] },
  { title: "Cursed Altar", text: "A cracked altar drinks the light around it. Something small and precious rests on top.", opts: [{ l: "Offer blood", d: "Lose 9 HP. Gain a relic.", f: (R) => { R.hurt(9); R.gainRelic(); } }, { l: "Leave it", d: "", f: () => {} }] },
  { title: "Mirror of Echoes", text: "Your reflection moves a moment later than you do, and offers to copy something.", opts: [{ l: "Copy a card", d: "Duplicate a card in your deck.", f: (R) => R.pickCard("copy") }, { l: "Walk away", d: "", f: () => {} }] },
  { title: "Wandering Merchant", text: "A hooded figure rattles a sack of bottles. \"Fair prices, mostly.\"", opts: [{ l: "Buy a potion", d: "Pay 30 gold.", if: (R) => R.gold >= 30, f: (R) => { R.gold -= 30; R.gainPotion(); } }, { l: "Sell your blood", d: "Lose 15 HP. Gain 70 gold.", f: (R) => { R.hurt(15); R.gold += 70; } }, { l: "Decline", d: "", f: () => {} }] },
  { title: "Ember Shrine", text: "A small flame burns without fuel. Holding a card to it makes the ink glow brighter.", opts: [{ l: "Temper your spells", d: "Upgrade 2 random cards. Take 5 damage.", f: (R) => { R.upgradeRandom(2); R.hurt(5); } }, { l: "Warm your hands", d: "Heal 8.", f: (R) => R.heal(8) }] },
  { title: "Forgotten Campfire", text: "Someone left in a hurry. The embers are still warm.", opts: [{ l: "Rest", d: "Heal 15.", f: (R) => R.heal(15) }, { l: "Burn a page", d: "Remove a card from your deck.", f: (R) => R.pickCard("remove") }] },
  { title: "Gambler's Den", text: "Three cups, one pebble, and a grin missing several teeth.", opts: [{ l: "Bet 30 gold", d: "50% to win 80 gold.", if: (R) => R.gold >= 30, f: (R) => { R.gold -= 30; if (Math.random() < 0.5) { R.gold += 80; R.note("You win 80 gold!"); } else R.note("The pebble was never there."); } }, { l: "Leave", d: "", f: () => {} }] },
];
