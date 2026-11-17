"use strict";
/* LAST LANTERN · data.js — palette, pixel art, weapons, items, enemies, stages, music, unlocks */

const PAL = {
  "0": "#0d0b17", "1": "#1e1b33", "2": "#3b3555", "3": "#6b6488", "4": "#a69fc2", "5": "#efe9ff",
  r: "#7a1f3d", R: "#d6304f", o: "#e8762d", O: "#ffa34d", y: "#ffd25e", Y: "#fff2a8",
  g: "#2f6b3a", G: "#5fbf4a", l: "#b6e86a", t: "#1f4d5c", c: "#3fb3c9", C: "#a8f0ff",
  b: "#2a3f8f", B: "#4f7cff", p: "#5b2a86", P: "#a35ce0", m: "#ff6ab0", M: "#ffc2e0",
  n: "#4a2f25", N: "#8f5a3a", s: "#d9946b", S: "#f6cfa8", w: "#bdb29a", W: "#f1e8d0",
  k: "#2b2238", K: "#4a3a5c", e: "#ff3355", E: "#7dffb0", v: "#556b33", V: "#8fae4f",
};

const SPR = {};
const walker = (top, a, b, pal) => [compile(top.concat(a), pal), compile(top.concat(b), pal)];
const frames = (list, pal, o) => list.map((rows) => compile(rows, pal, o));

/* ================= characters (facing right) ================= */
SPR.wren = walker([
  "...ttttt......",
  "..tccccct.....",
  ".tccccccct....",
  ".tctttttct....",
  ".ttSSSSSSt....",
  ".ttS0SS0St....",
  ".ttSSSSSSt....",
  "..tttssttt....",
  ".tccccccctss..",
  "tcccccccct..N.",
  "tcccccccct.NyN",
  "tcccccccct.yYy",
  ".tccccccct.NyN",
  "..tttttttt....",
], ["...nn..nn.....", "..nn....nn...."], ["....nn.nn.....", "....nn.nn....."]);
SPR.brann = walker([
  "...RRRRR......",
  "..RRRRRRR.....",
  ".rRRRRRRRr....",
  ".rrrrrrrrr....",
  "..SSSSSSS.....",
  "..S0SSS0S.....",
  "..SSSsSSS.....",
  ".NNNNNNNNN....",
  ".rNNNNNNNrSS..",
  "rRrNNNNNrRr...",
  "rRrRrRrRrRr...",
  "SrRrRrRrRrS...",
  ".rRrRrRrRr....",
  ".bbbbbbbbb....",
], ["..bb...bb.....", ".nn.....nn...."], ["...bb.bb......", "...nn.nn......"]);
SPR.sela = walker([
  "...mmmmmm.....",
  "..mMMmmmmm....",
  ".mMmmmmmmmm...",
  ".mmmSSSSSmm...",
  ".mmSS0SS0Sm...",
  ".mmSSSSSSSm...",
  ".mm.SSsSS.m...",
  ".m..PPPPP..m..",
  "...pPPyPPPSS..",
  "..pPPPyPPPp...",
  "..pPPPyPPPp...",
  "..SpPPyPPpS...",
  "...pPPPPPp....",
  "...kkkkkkk....",
], ["...kk..kk.....", "..nn....nn...."], ["....kk.kk.....", "....nn.nn....."]);
SPR.pip = walker([
  "...ggggg......",
  "..gGGGGGg.....",
  ".gGGGGGGGg....",
  ".gGyyyGyyy....",
  ".gGyCyGyCy....",
  ".gGSyySyyS....",
  ".gGSSSsSSS....",
  "..ggSSSSg.....",
  ".gGGGGGGGSS...",
  "gGGNNNGGGg.P..",
  "gGGNoNGGGgPCP.",
  "gGGNNNGGGgPCP.",
  ".gGGGGGGGg.P..",
  "..ggggggg.....",
], ["...nn..nn.....", "..nn....nn...."], ["....nn.nn.....", "....nn.nn....."]);
SPR.morrow = walker([
  "......b.......",
  ".....bBb......",
  "....bBByb.....",
  "...bBBBBBb....",
  ".bbbbbbbbbbb..",
  "...SSSSSSS....",
  "...S0SSS0S....",
  "...WWWWWWW....",
  "..bWWWWWWWbSS.",
  ".bBBWWWWWBBb..",
  ".bBBBWWWBBBb..",
  ".SBBBBWBBBBS..",
  "..bBBBBBBBb...",
  "..bbbbbbbbb...",
], ["...nn..nn.....", "..nn....nn...."], ["....nn.nn.....", "....nn.nn....."]);
SPR.ivy = walker([
  "...yyyyy......",
  "..yYYYYYy.....",
  ".yYYYYYYYy....",
  ".yYVVVVVYy....",
  ".yVSSSSSVy....",
  ".yVS0SS0Vy....",
  ".yVSSSSSVy....",
  "..yVVVVVy.....",
  ".vVVyyyVVvSS..",
  "vVVVVyVVVVv...",
  "vVVVVyVVVVv...",
  "SvVVVyVVVvS...",
  ".vVVVVVVVv....",
  ".vvvvvvvvv....",
], ["...nn..nn.....", "..nn....nn...."], ["....nn.nn.....", "....nn.nn....."]);

/* ================= enemies ================= */
SPR.bat = frames([[
  "P.........P",
  "PP.......PP",
  ".PPp.p.pPP.",
  "..PpppppP..",
  "...pepep...",
  "....ppp....",
  ".....p.....",
], [
  "...........",
  "....p.p....",
  "...ppppp...",
  "..PpepepP..",
  ".PPPpppPPP.",
  "PP...p...PP",
  "P.........P",
]]);
SPR.ghoul = walker([
  "...vvvv....",
  "..vVVVVv...",
  "..vVVeVe...",
  "..vVVVVVv..",
  "...vVnnv...",
  "..kkKKKkk..",
  ".kKKKKKKVVV",
  ".kKKKKKk...",
  ".kKKKKKKVVV",
  "..kKKKKk...",
  "..kkkkkk...",
], ["..kk..kk...", "..vv...vv.."], ["...kk.kk...", "...vv.vv..."]);
SPR.skel = walker([
  "...WWWW...",
  "..WWWWWW..",
  "..W0WW0W..",
  "..WWWWWW..",
  "...W0W0...",
  "....ww....",
  "..wWWWWw..",
  ".w.wWWw.w.",
  ".w.WWWW.w.",
  "...wWWw...",
  "....ww....",
], ["...w..w...", "..ww...ww."], ["....ww....", "...ww.ww.."]);
SPR.shade = walker([
  "....pppp....",
  "..pPPPPPPp..",
  ".pPPPPPPPPp.",
  ".pPP5PPP5Pp.",
  ".pPP0PPP0Pp.",
  ".pPPPPPPPPp.",
  ".pPPPPMMPPp.",
  ".pPPPPPPPPp.",
  ".pPPPPPPPPp.",
  ".pPPPPPPPPp.",
], [".pPP.pPP.Pp.", ".pP...p...p."], [".pPPpPPPpPp.", "..p..pP..p.."]);
SPR.slime = frames([[
  "....GGGG....",
  "..GGlllGGG..",
  ".GGlGGGGGGG.",
  ".GG0GGG0GGG.",
  "GGG0GGG0GGGG",
  "GGGGGGGGGGGG",
  "GGGGGGGGGGGG",
  ".gGGGGGGGGg.",
  "..gggggggg..",
], [
  "............",
  "...GGGGGG...",
  ".GGlllGGGGG.",
  "GGlGGGGGGGGG",
  "GG0GGGG0GGGG",
  "GG0GGGG0GGGG",
  "GGGGGGGGGGGG",
  "gGGGGGGGGGGg",
  ".gggggggggg.",
]]);
SPR.slimelet = frames([[
  "..GGG..",
  ".GlGGG.",
  "G0GG0GG",
  "GGGGGGG",
  "gGGGGGg",
  ".ggggg.",
], [
  ".......",
  ".GGGGG.",
  "GlGGGGG",
  "G0GG0GG",
  "gGGGGGg",
  "ggggggg",
]]);
SPR.brute = walker([
  ".....vvvvv......",
  "....vVVVVVv.....",
  "...vVVeVVeVv....",
  "...vVVVVVVVv....",
  "...vVWnnnWVv....",
  "....vVVVVVv.....",
  "..vvVVVVVVVvv...",
  ".vVVVVVVVVVVVv.n",
  ".vVVVVVVVVVVVvnN",
  "vVV.vVVVVVv.VVNn",
  "vVV.vVVVVVv.VVn.",
  ".v..NNNNNNN..v..",
  "....NnNnNnN.....",
  "....vVV.vVV.....",
], ["...vVV...vVV....", "...nnn...nnn...."], ["....vVVvVV......", "....nnnnnn......"]);
SPR.cultist = walker([
  "....rrr....",
  "...rRRRr...",
  "..rRRRRRr..",
  "..rR000Rr..",
  "..rR0y0yr..",
  "..rR000Rr..",
  "...rRRRr...",
  "..rRRRRRr..",
  ".rRRrRrRRPP",
  ".rRRRrRRRPM",
  ".rRRRrRRRr.",
  ".rRRRrRRRr.",
  "..rRRrRRr..",
], ["..rrRrRrr.."], ["...rRrRr..."]);
SPR.imp = walker([
  ".r......r.",
  ".rr....rr.",
  "..rRRRRr..",
  "..RyRRyRR.",
  "..RRRRRRR.",
  ".rrRRnRRrr",
  "rr.RRRRR.r",
  "...RRRRR..",
], ["...R...R..", "..RR...RR."], ["....R.R...", "...RR.RR.."]);
SPR.boar = walker([
  "...nnnnnnnn.....",
  "..nNNNNNNNNnn...",
  ".nNNNNNNNNNNNn..",
  ".nNNNNNNNNNeNNn.",
  "nNNNNNNNNNNNNNNn",
  "nNNNNNNNNNNNNNWW",
  ".nNNNNNNNNNNNnW.",
  "..nNNNNNNNNNn...",
], ["..nn.nn..nn.nn..", "..n...n..n...n.."], ["...nnn....nnn...", "...n.n....n.n..."]);
SPR.golem = walker([
  ".....3333333.....",
  "....344444443....",
  "...34O4444O443...",
  "...34444444443...",
  "....3444o4443....",
  "..33343444343333.",
  ".3444434444344443",
  ".344o434444344o43",
  ".3443.3o443.3443.",
  ".333..3444o3.333.",
  "......3444443....",
  ".....33333333....",
], [".....344..443....", "....3333..3333..."], ["......344443.....", ".....33333333...."]);
SPR.wisp = frames([[
  "...y....",
  "..yO....",
  "..yOO.y.",
  ".yOOOyO.",
  ".OOYYOO.",
  "OOYYYYOO",
  "OoY00YoO",
  ".ooYYoo.",
  "..oooo..",
], [
  "....y...",
  "...Oy...",
  ".y.OOy..",
  ".OyOOOy.",
  ".OOYYOO.",
  "OOYYYYOO",
  "OoY00YoO",
  ".ooYYoo.",
  "..oooo..",
]]);
SPR.brazier = frames([[
  "..2222..",
  ".2yYYy2.",
  ".2yYOy2.",
  ".2yOOy2.",
  "..2222..",
  "...22...",
  "...22...",
  "...22...",
  "...22...",
  "...22...",
  "..2222..",
  ".222222.",
], [
  "..2222..",
  ".2yYyy2.",
  ".2yOYy2.",
  ".2yOOy2.",
  "..2222..",
  "...22...",
  "...22...",
  "...22...",
  "...22...",
  "...22...",
  "..2222..",
  ".222222.",
]]);

/* bosses */
SPR.king = frames([[
  "........y..y..y.........",
  "........yyyyyyy.........",
  ".......yYyyYyyYy........",
  ".......WWWWWWWWW........",
  "......WWWWWWWWWWW.......",
  "......WW00WWW00WW.......",
  "......WWE0WWWE0WW.......",
  "......WWWWW0WWWWW.......",
  ".......WW0W0W0WW........",
  "........WWWWWWW.........",
  ".....pppPwWWWwPppp......",
  "....pPPPPwWWWwPPPPp...y.",
  "...pPPPPwWwWwWwPPPPp.yYy",
  "...pPPPPwWwWwWwPPPPpWWy.",
  "..pPPPPP.wWWWw.PPPPPW...",
  "..pPPPPP.wWwWw.PPPPPW...",
  "..pPPPPP.wWWWw.PPPPPW...",
  ".pPPPPPP..www..PPPPPW...",
  ".pPPPPPP.wWWWw.PPPPPPW..",
  ".pPPPPPP.ww.ww.PPPPPPW..",
  "pPPPPPPP.ww.ww.PPPPPPPW.",
  "pPPPPPPP.ww.ww.PPPPPPPp.",
  "pPPPPPPPwww.wwwPPPPPPPp.",
  "ppppppppppppppppppppppp.",
], [
  "........y..y..y.........",
  "........yyyyyyy.........",
  ".......yYyyYyyYy........",
  ".......WWWWWWWWW........",
  "......WWWWWWWWWWW.......",
  "......WW00WWW00WW.......",
  "......WWE0WWWE0WW.......",
  "......WWWWW0WWWWW.......",
  ".......WW0W0W0WW........",
  "........WWWWWWW.........",
  ".....pppPwWWWwPppp......",
  "....pPPPPwWWWwPPPPp...y.",
  "...pPPPPwWwWwWwPPPPp.yYy",
  "...pPPPPwWwWwWwPPPPpWWy.",
  "..pPPPPP.wWWWw.PPPPPW...",
  "..pPPPPP.wWwWw.PPPPPW...",
  "..pPPPPP.wWWWw.PPPPPW...",
  ".pPPPPPP..www..PPPPPW...",
  ".pPPPPPP.wWWWw.PPPPPPW..",
  ".pPPPPPP.ww.ww.PPPPPPW..",
  "pPPPPPPPP.w.w.PPPPPPPPW.",
  "pPPPPPPPP.w.w.PPPPPPPPp.",
  "pPPPPPPPPww.wwPPPPPPPPp.",
  ".ppppppppppppppppppppp..",
]]);
SPR.lich = frames([[
  "..........tt..........",
  ".........tCCt.........",
  "........tCWWCt........",
  ".......tCWWWWCt.......",
  ".......tW0WW0Wt.......",
  ".......tWE0WE0t.......",
  ".......tWWW0WWt.......",
  "........tW0W0t........",
  "......tttWWWWttt......",
  ".....tccctcctccct.....",
  "....tccccctcccccct.E..",
  "...tcccctccccctccctEE.",
  "...tccccWccccccWccc4..",
  "..tcccccctccccctccc4..",
  "..tccccccctcccctcct4..",
  "..tcccccccctcctcccc4..",
  ".tcccccccccttccccct4..",
  ".tccccccccccccccccc4..",
  ".tcccctccccccctcccc4..",
  "..tcct.tccccct.tcct...",
  "...tt...tcct....tt....",
  ".........tt...........",
], [
  "..........tt..........",
  ".........tCCt.........",
  "........tCWWCt........",
  ".......tCWWWWCt.......",
  ".......tW0WW0Wt.......",
  ".......tWE0WE0t.......",
  ".......tWWW0WWt.......",
  "........tW0W0t........",
  "......tttWWWWttt......",
  ".....tccctcctccct.....",
  "....tccccctcccccct.E..",
  "...tcccctccccctccctEE.",
  "...tccccWccccccWccc4..",
  "..tcccccctccccctccc4..",
  "..tccccccctcccctcct4..",
  "..tcccccccctcctcccc4..",
  ".tcccccccccttccccct4..",
  ".tccccccccccccccccc4..",
  "..tcccctccccctcccc.4..",
  "...tct.tcccct.tct.....",
  "....t...tcct...t......",
  "..........t...........",
]]);
SPR.wyrm = frames([[
  "....rrrr........",
  "..rrRRRRrr......",
  ".rRRRRRRRRrr....",
  "rRRoooRRRRRRr...",
  "rRoOOOoRRRYRRr..",
  "rRoOYOoRRRRRRRr.",
  "rRoOOOoRRRRRRRRW",
  "rRRoooRRRRRRRR..",
  "rRRRRRRRRRRRRRW.",
  ".rRRRRRRRRRRRRR.",
  "..rRRRRRRRRRRr..",
  "...rrRRRRRrr....",
  ".....rrrrr......",
], [
  "....rrrr........",
  "..rrRRRRrr......",
  ".rRRRRRRRRrr....",
  "rRRoooRRRRRRr...",
  "rRoOOOoRRRYRRr..",
  "rRoOYOoRRRRRRRr.",
  "rRoOOOoRRRRRRRr.",
  "rRRoooRRRRRRRRR.",
  "rRRRRRRRRRRRRRRW",
  ".rRRRRRRRRRRRR..",
  "..rRRRRRRRRRRr..",
  "...rrRRRRRrr....",
  ".....rrrrr......",
]]);
SPR.wyrmseg = frames([[
  "....rrrr....",
  "..rrRRRRrr..",
  ".rRRoOOoRRr.",
  ".rRoOYYOoRr.",
  "rRRoOYYOoRRr",
  "rRRRoOOoRRRr",
  "rRRRRooRRRRr",
  "rRRRRRRRRRRr",
  ".rRRRRRRRRr.",
  ".rrRRRRRRrr.",
  "...rrrrrr...",
]]);

/* ================= pickups ================= */
const GEM_ROWS = ["..C..", ".CBC.", "CBBBC", "CBBBb", "bBBBb", ".bBb.", "..b.."];
SPR.gem1 = compile(GEM_ROWS);
SPR.gem2 = compile(GEM_ROWS, { C: "#d9ff9a", B: "#5fbf4a", b: "#2f6b3a" });
SPR.gem3 = compile(GEM_ROWS, { C: "#ffc2e0", B: "#d6304f", b: "#7a1f3d" });
SPR.coin = compile([".yyyy.", "yYYyyo", "yYyyyo", "yyyyyo", "yyyyoo", ".oooo."]);
SPR.bag = compile(["..nnnn..", "...nn...", "..NNNN..", ".NNyyNN.", "NNyNNyNN", "NNNyyNNN", "NNyNNyNN", ".NNyyNN.", "..NNNN.."]);
SPR.bread = compile(["..oOOOo..", ".oOYOYOo.", "oOOOOOOOo", "oOYOOYOOo", "ooOOOOOoo", ".ooooooo."]);
SPR.lodestar = compile([".WW..WW.", "RRR..RRR", "RR....RR", "RR....RR", "RRR..RRR", ".RRRRRR.", "..RRRR.."]);
SPR.flare = compile(["...yy...", "y..YY..y", ".yYYYYy.", "..YY5Y..", "yyY55Yyy", "..YYYY..", ".yYYYYy.", "y..YY..y", "...yy..."]);
SPR.clock = compile(["NNNNNNN", ".C...C.", ".CYYYC.", "..CYC..", "...C...", "..CYC..", ".CYYYC.", ".CYYYC.", "NNNNNNN"]);
SPR.chest = compile([
  "..nnnnnnnnnn..",
  ".nNNNNNNNNNNn.",
  "nNNNNNNNNNNNNn",
  "nyyyyyyyyyyyyn",
  "nNNNNNyyNNNNNn",
  "nNNNNNyYNNNNNn",
  "nNNNNNNNNNNNNn",
  "nNNNNNNNNNNNNn",
  "nyyyyyyyyyyyyn",
  ".nnnnnnnnnnnn.",
]);
SPR.chestOpen = compile([
  "..nnnnnnnnnn..",
  ".nNNNNNNNNNNn.",
  "nNNyyyyyyyyNNn",
  "nNNNNNNNNNNNNn",
  ".n0000000000n.",
  "nYyYyYYyYyYyYn",
  "nyyyyyyyyyyyyn",
  "nNNNNNyyNNNNNn",
  "nNNNNNyYNNNNNn",
  "nNNNNNNNNNNNNn",
  "nyyyyyyyyyyyyn",
  ".nnnnnnnnnnnn.",
]);

/* ================= projectiles ================= */
SPR.spark = compile(["..Y..", ".YyY.", "YyYyY", ".YyY.", "..Y.."], {}, { outlineColor: "#7a3b10" });
SPR.star = compile(["...C...", "..C5C..", "CC555CC", ".C555C.", ".C5C5C.", "C.C.C.C"], {}, { outlineColor: "#1f2a6b" });
SPR.knife = compile(["nN44445"], {}, { outlineColor: "#1e1b33" });
SPR.edge = compile(["oyYYYY5"], {}, { outlineColor: "#5b2a00" });
SPR.axe = compile([".44......", "4454.....", "44544....", ".445N....", "...NN....", "....NN...", ".....NN..", "......NN.", ".......N."]);
SPR.bigaxe = compile([".RR......", "RRMR.....", "RRMRR....", ".RRMk....", "...kk....", "....kk...", ".....kk..", "......kk.", ".......k."]);
SPR.boomer = compile(["Oo......", "OOo.....", ".OOo....", "..OOo...", "...OOoo.", "....OOOO", ".....ooo"]);
SPR.comet = compile(["Cc......", "CCc.....", ".CCc....", "..CCc...", "...CCcc.", "....CCCC", ".....ccc"], {}, { outlineColor: "#1f2a6b" });
SPR.orb = compile(["..CCC..", ".C555C.", "C55555C", "C55555C", "C55555C", ".C555C.", "..CCC.."], {}, { outlineColor: "#1f4d5c" });
SPR.halo = compile(["..yyy..", ".yYYYy.", "yYY5YYy", "yY555Yy", "yYY5YYy", ".yYYYy.", "..yyy.."], {}, { outlineColor: "#7a3b10" });
SPR.flask = compile([".n.", ".4.", "RoR", "RRR", "rRr"]);
SPR.shot = compile([".mm.", "mMMm", "mMMm", ".mm."], {}, { outlineColor: "#5b0f2a" });
SPR.fireball = compile([".oo.", "oYYo", "oYYo", ".oo."], {}, { outlineColor: "#5b1a00" });
SPR.knifeRot = rotations(SPR.knife, 16);
SPR.edgeRot = rotations(SPR.edge, 16);
SPR.axeRot = rotations(SPR.axe, 16);
SPR.bigaxeRot = rotations(SPR.bigaxe, 16);
SPR.boomerRot = rotations(SPR.boomer, 16);
SPR.cometRot = rotations(SPR.comet, 16);

/* ================= icons (12x12-ish, outlined) ================= */
const ICON_ROWS = {
  wand: ["........YY..", ".......YyyY.", "......YyYyyY", ".......YyyY.", "......NNYY..", ".....NNN....", "....NNN.....", "...NNN......", "..NNN.......", ".NNN........", "NNN.........", "NN.........."],
  blade: ["...5544.....", ".....4544...", "......4544..", ".......454..", ".......4544.", "........454.", "........454.", ".......4544.", ".......454..", "......4544..", ".....4544...", "...5544....."],
  knives: ["..........55", ".........545", "........545.", ".......545..", "......545...", ".....545....", "..y.545.....", "..yy45......", "...yN.......", "..nNy.......", ".nNn........", "nNn........."],
  orbs: ["....cCCc....", "...cC55Cc...", "...cC55Cc...", "....cCCc....", "............", ".cCc....cCc.", "cC5Cc..cC5Cc", "cC5Cc..cC5Cc", ".cCc....cCc."],
  aura: ["....yyyy....", "..yy....yy..", ".y..YYYY..y.", ".y.Y....Y.y.", "y.Y..yy..Y.y", "y.Y.yYYy.Y.y", "y.Y.yYYy.Y.y", "y.Y..yy..Y.y", ".y.Y....Y.y.", ".y..YYYY..y.", "..yy....yy..", "....yyyy...."],
  axe: ["..444.......", ".44444......", "4445444.....", "44454NN.....", ".444NNN.....", "..44.NNN....", "......NNN...", ".......NNN..", "........NNN.", ".........NN."],
  boomer: ["OOo.........", "OOOo........", ".OOOo.......", "..OOOo......", "...OOOo.....", "....OOOooooo", ".....OOOOOOO", "......ooooo."],
  rune: ["..333333..", ".34444443.", ".34444y43.", ".3444yy43.", ".344yy443.", ".34yyyy43.", ".3444yy43.", ".344yy443.", ".34y44443.", ".34444443.", "..333333.."],
  bomb: ["....nn....", "....44....", "....44....", "...4RR4...", "..4RRoR4..", ".4RRRRoR4.", ".4RRRRRR4.", ".4RRRRRR4.", "..4RRRR4..", "...4444..."],
  gauntlet: ["..3434....", ".3444443..", ".34444443.", ".344444443", "..3444443.", "..34444R3.", "..3333RR3.", "...RRRRR..", "...rrrrr.."],
  hourglass: ["NNNNNNNN", ".C....C.", ".CYYYYC.", "..CYYC..", "...CC...", "..C..C..", ".C.YY.C.", ".CYYYYC.", "NNNNNNNN"],
  lens: ["....C.......", "...CCC......", "..C5CCC.....", ".C5CCCCC.RR.", "CCCCCCCCCoo.", "CCCCCCCCCyy.", "..........G."],
  feather: ["........55..", "......5545..", ".....54445..", "....54445...", "...54445....", "..54445.....", "..5445......", ".545........", ".44.........", "4..........."],
  candle: ["....y.....", "...yYy....", "...yYy....", "....o.....", "...WWW....", "...WWW....", "...WWW....", "...WWW....", "..NNNNN...", ".NNNNNNN.."],
  ring: ["....CC....", "...C5CC...", "..yyCCyy..", ".yy....yy.", "yy......yy", "yy......yy", ".yy....yy.", "..yyyyyy.."],
  heart: [".RR...RR.", "RMMR.RRRR", "RMRRRRRRR", "RRRRRRRRR", ".RRRRRRR.", "..RRRRR..", "...RRR...", "....R...."],
  plate: [".vv....vv.", "vVVvvvvVVv", "vVVVVVVVVv", ".vVVyVVVv.", ".vVVyVVVv.", ".vVVVVVVv.", "..vVVVVv..", "...vvvv..."],
  vial: ["...B...", "..BB...", "..BCB..", ".BCCBB.", "BCCBBBB", "BCBBBBB", "BBBBBBb", ".BBBBb.", "..bbb.."],
  lodestone: [".WW..WW.", "RRR..RRR", "RR....RR", "RR....RR", "RRR..RRR", ".RRRRRR.", "..RRRR.."],
  clover: ["..GG..GG..", ".GllG.GlG.", ".GGlGGlGG.", "..GGGGGG..", ".GGGGgGGG.", "GlGGgGGlG.", ".GGG.GGG..", "....g.....", "....g....."],
  boots: ["..nnnn....", "..NNNN....", "..NNNN....", "..NNNN....", "..NNNNNN..", ".NNNNNNNNN", ".NNNNNNNNN", ".nnnnnnnnn"],
  tome: [".pppppppp.", "pPPPPPPPpW", "pPPyyPPPpW", "pPyPPyPPpW", "pPPyyPPPpW", "pPPPPPPPpW", "pPPPPPPPpW", "ppppppppWW"],
  gold: [".yyyy.", "yYYyyo", "yYyyyo", "yyyyyo", "yyyyoo", ".oooo."],
  heal: ["..oOOOo..", ".oOYOYOo.", "oOOOOOOOo", "oOYOOYOOo", "ooOOOOOoo", ".ooooooo."],
};
const EVO_ICON = {
  starfall: ["wand", { N: "#5b2a86", y: "#3fb3c9", Y: "#efe9ff" }],
  crimson: ["blade", { "4": "#d6304f", "5": "#ffc2e0" }],
  edges: ["knives", { "4": "#ffd25e", "5": "#fff2a8" }],
  halo: ["orbs", { C: "#ffd25e", c: "#e8762d", "5": "#fff2a8" }],
  sanctum: ["aura", { y: "#5fbf4a", Y: "#b6e86a" }],
  executioner: ["axe", { "4": "#d6304f", "5": "#ffc2e0", N: "#2b2238" }],
  comet: ["boomer", { O: "#a8f0ff", o: "#4f7cff" }],
  tempest: ["rune", { y: "#a8f0ff", "3": "#2a3f8f", "4": "#4f7cff" }],
  inferno: ["bomb", { R: "#e8762d", o: "#ffd25e", "4": "#ffa34d" }],
};
const ICONS = {};
for (const k in ICON_ROWS) ICONS[k] = compile(ICON_ROWS[k]);
for (const k in EVO_ICON) ICONS[k] = compile(ICON_ROWS[EVO_ICON[k][0]], EVO_ICON[k][1], { outlineColor: "#ffd25e" });
const _iconURL = {};
function iconURL(id) {
  if (_iconURL[id]) return _iconURL[id];
  const s = ICONS[id]; if (!s) return "";
  const [c, g] = mkCanvas(16, 16); g.drawImage(s.c, Math.floor((16 - s.w) / 2), Math.floor((16 - s.h) / 2));
  return (_iconURL[id] = c.toDataURL());
}
function spriteURL(s, scale = 1) {
  const [c, g] = mkCanvas(s.w * scale, s.h * scale); g.drawImage(s.c, 0, 0, s.w * scale, s.h * scale); return c.toDataURL();
}

/* ================= weapons ================= */
/* Upgrade lists hold what changes at levels 2..8. area/spd are multipliers (0.25 = +25%), cd is seconds. */
const WEAPONS = {
  wand: { name: "Spark Wand", kind: "wand", unit: "spark", desc: "Fires a spark at the nearest enemy.", base: { dmg: 10, cd: 1.15, amt: 1, pierce: 1, area: 1, spd: 1, dur: 2, kb: 0.5 }, ups: [{ amt: 1 }, { cd: -0.2 }, { amt: 1 }, { dmg: 10 }, { amt: 1 }, { pierce: 1 }, { dmg: 10 }], evo: "starfall", need: "hourglass" },
  blade: { name: "Moon Blade", kind: "blade", unit: "slash", desc: "Slashes a crescent to the side you face.", base: { dmg: 12, cd: 1.3, amt: 1, area: 1, kb: 1 }, ups: [{ amt: 1 }, { dmg: 5 }, { area: 0.1, dmg: 5 }, { dmg: 5 }, { area: 0.1, dmg: 5 }, { dmg: 5 }, { dmg: 5 }], evo: "crimson", need: "heart" },
  knives: { name: "Throwing Knives", kind: "knives", unit: "knife", units: "knives", desc: "Throws knives the way you're moving.", base: { dmg: 7, cd: 0.9, amt: 1, pierce: 1, spd: 1, dur: 1.4, kb: 0.3 }, ups: [{ amt: 1 }, { amt: 1, dmg: 5 }, { amt: 1 }, { pierce: 1 }, { amt: 1 }, { amt: 1, dmg: 5 }, { pierce: 1 }], evo: "edges", need: "feather" },
  orbs: { name: "Guardian Orbs", kind: "orbs", unit: "orb", desc: "Orbs circle you and knock enemies back.", base: { dmg: 10, cd: 3, amt: 1, area: 1, spd: 1, dur: 3, kb: 1.2 }, ups: [{ amt: 1 }, { spd: 0.3, area: 0.25 }, { dmg: 10, dur: 0.5 }, { amt: 1 }, { spd: 0.3, area: 0.25 }, { dmg: 10, dur: 0.5 }, { amt: 1 }], evo: "halo", need: "lens" },
  aura: { name: "Holy Aura", kind: "aura", noAmt: true, desc: "Burns enemies that come close.", base: { dmg: 5, cd: 0.65, area: 1, kb: 0.6 }, ups: [{ area: 0.4, dmg: 2 }, { dmg: 1, cd: -0.08 }, { area: 0.2, dmg: 1 }, { dmg: 2, cd: -0.08 }, { area: 0.2, dmg: 1 }, { dmg: 1, cd: -0.08 }, { area: 0.2, dmg: 1 }], evo: "sanctum", need: "plate" },
  axe: { name: "Hand Axe", kind: "axe", unit: "axe", desc: "Hurls axes up in a high arc.", base: { dmg: 20, cd: 3.2, amt: 1, pierce: 3, area: 1, spd: 1, dur: 3, kb: 0.8 }, ups: [{ amt: 1 }, { dmg: 20 }, { pierce: 2 }, { amt: 1 }, { dmg: 20 }, { pierce: 2 }, { dmg: 20 }], evo: "executioner", need: "gauntlet" },
  boomer: { name: "Boomerang", kind: "boomer", unit: "boomerang", desc: "Flies at an enemy, then comes back.", base: { dmg: 16, cd: 1.8, amt: 1, area: 1, spd: 1, kb: 0.6 }, ups: [{ dmg: 10 }, { area: 0.1, spd: 0.25 }, { amt: 1 }, { dmg: 10 }, { area: 0.1, spd: 0.25 }, { amt: 1 }, { dmg: 10 }], evo: "comet", need: "clover" },
  rune: { name: "Storm Rune", kind: "rune", unit: "strike", desc: "Calls lightning down on random enemies.", base: { dmg: 15, cd: 4, amt: 2, area: 1 }, ups: [{ amt: 1 }, { area: 0.25, dmg: 10 }, { amt: 1 }, { area: 0.25, dmg: 20 }, { amt: 1 }, { area: 0.25, dmg: 20 }, { amt: 1 }], evo: "tempest", need: "candle" },
  bomb: { name: "Firebomb", kind: "bomb", unit: "flask", desc: "Lobs flasks that leave burning pools.", base: { dmg: 9, cd: 4.2, amt: 1, area: 1, dur: 2.2 }, ups: [{ amt: 1, area: 0.2 }, { dmg: 10, dur: 0.5 }, { amt: 1, area: 0.2 }, { dmg: 10, dur: 0.3 }, { amt: 1, area: 0.2 }, { dmg: 5, dur: 0.3 }, { dmg: 5, area: 0.2 }], evo: "inferno", need: "lodestone" },

  starfall: { name: "Starfall Staff", kind: "wand", evolved: true, from: "wand", desc: "A storm of piercing stars with almost no cooldown.", base: { dmg: 16, cd: 0.22, amt: 1, pierce: 3, area: 1.4, spd: 1.35, dur: 2, kb: 0.4 } },
  crimson: { name: "Crimson Crescent", kind: "blade", evolved: true, from: "blade", desc: "Huge slashes on both sides. Each hit heals you a little.", base: { dmg: 32, cd: 1.05, amt: 2, area: 1.45, kb: 1.2 } },
  edges: { name: "Thousand Edges", kind: "knives", evolved: true, from: "knives", desc: "An endless fan of knives.", base: { dmg: 11, cd: 0.13, amt: 1, pierce: 3, spd: 1.25, dur: 1.4, kb: 0.25 } },
  halo: { name: "Halo of Saints", kind: "orbs", evolved: true, from: "orbs", desc: "Orbs that never stop circling.", base: { dmg: 24, cd: 1, amt: 3, area: 1.5, spd: 1.7, dur: 0, kb: 1.5 } },
  sanctum: { name: "Sanctuary", kind: "aura", evolved: true, from: "aura", noAmt: true, desc: "A wide holy ring. Burning enemies heals you.", base: { dmg: 14, cd: 0.5, area: 1.9, kb: 0.8 } },
  executioner: { name: "Executioner", kind: "axe", evolved: true, from: "axe", desc: "Giant axes spin out in every direction.", base: { dmg: 48, cd: 2.4, amt: 6, pierce: 999, area: 1.7, spd: 1, dur: 2.5, kb: 1 } },
  comet: { name: "Twin Comet", kind: "boomer", evolved: true, from: "boomer", desc: "Blazing boomerangs fly out in pairs.", base: { dmg: 36, cd: 1.2, amt: 2, area: 1.5, spd: 1.4, kb: 0.8 } },
  tempest: { name: "Tempest", kind: "rune", evolved: true, from: "rune", desc: "Lightning that leaps from enemy to enemy.", base: { dmg: 42, cd: 2.2, amt: 4, area: 1.5 } },
  inferno: { name: "Inferno Tide", kind: "bomb", evolved: true, from: "bomb", desc: "Fire pools that grow and drift after you.", base: { dmg: 22, cd: 3.4, amt: 3, area: 1.6, dur: 4.5 } },
};
for (const id in WEAPONS) { const w = WEAPONS[id]; w.id = id; w.icon = id; w.max = w.evolved ? 1 : 1 + w.ups.length; }
const BASE_WEAPONS = ["wand", "blade", "knives", "orbs", "aura", "axe", "boomer", "rune", "bomb"];
const STARTER_WEAPONS = ["wand", "blade", "knives", "orbs", "aura", "axe"];

const PASSIVES = {
  gauntlet: { name: "Iron Gauntlet", desc: "+10% damage." },
  hourglass: { name: "Hourglass", desc: "Weapons fire 8% faster." },
  lens: { name: "Prism Lens", desc: "+10% area." },
  feather: { name: "Swift Feather", desc: "+10% projectile speed." },
  candle: { name: "Ember Candle", desc: "Effects last 10% longer." },
  ring: { name: "Echo Ring", desc: "Every weapon fires 1 more projectile.", max: 2, locked: true },
  heart: { name: "Heart Charm", desc: "+20% max health." },
  plate: { name: "Mossy Plate", desc: "+1 armor: take 1 less damage from every hit." },
  vial: { name: "Dew Vial", desc: "Recover 0.2 health every second." },
  lodestone: { name: "Lodestone", desc: "+25% pickup range." },
  clover: { name: "Lucky Clover", desc: "+10% luck: better chests, more gold, and a chance of a 4th choice." },
  boots: { name: "Swift Boots", desc: "+8% move speed." },
  tome: { name: "Scholar's Tome", desc: "+8% experience." },
};
for (const id in PASSIVES) { PASSIVES[id].id = id; PASSIVES[id].icon = id; PASSIVES[id].max = PASSIVES[id].max || 5; }

/* ================= characters ================= */
const CHARS = [
  { id: "wren", name: "Wren", title: "Lanternkeeper", weapon: "wand", stats: { magnet: 0.15 }, perk: "+15% pickup range.", unlock: "Unlocked from the start." },
  { id: "brann", name: "Brann", title: "Woodcutter", weapon: "axe", stats: { maxhp: 0.25, might: 0.1, move: -0.08 }, perk: "+25% max health, +10% damage, 8% slower.", unlock: "Defeat a mid-boss." },
  { id: "sela", name: "Sela", title: "Duelist", weapon: "blade", stats: { move: 0.12, armor: 1 }, perk: "+12% move speed, +1 armor.", unlock: "Reach level 30 in one run." },
  { id: "pip", name: "Pip", title: "Alchemist", weapon: "bomb", stats: { area: 0.15, dur: 0.15 }, perk: "+15% area, effects last 15% longer.", unlock: "Defeat 5,000 enemies in total." },
  { id: "morrow", name: "Morrow", title: "Stormcaller", weapon: "rune", stats: { cd: -0.1, maxhp: -0.1 }, perk: "Weapons fire 10% faster, -10% max health.", unlock: "Evolve a weapon." },
  { id: "ivy", name: "Ivy", title: "Warden", weapon: "orbs", stats: { armor: 1, regen: 0.3 }, perk: "+1 armor, recover 0.3 health per second.", unlock: "Survive until dawn." },
];

/* ================= enemies ================= */
const ENEMIES = {
  bat: { name: "Bat", spr: "bat", hp: 4, spd: 52, dmg: 3, r: 4, xp: 1, ai: "flutter", mass: 0.5, fps: 8 },
  ghoul: { name: "Ghoul", spr: "ghoul", hp: 14, spd: 27, dmg: 5, r: 5, xp: 2, mass: 1, fps: 4 },
  skel: { name: "Skeleton", spr: "skel", hp: 18, spd: 35, dmg: 6, r: 5, xp: 2, mass: 1, fps: 5 },
  shade: { name: "Shade", spr: "shade", hp: 13, spd: 42, dmg: 5, r: 5, xp: 2, ai: "float", ghost: true, mass: 0.6, fps: 4 },
  slime: { name: "Slime", spr: "slime", hp: 26, spd: 24, dmg: 6, r: 6, xp: 3, split: "slimelet", mass: 1.4, fps: 3 },
  slimelet: { name: "Slimelet", spr: "slimelet", hp: 8, spd: 36, dmg: 3, r: 3, xp: 1, mass: 0.5, fps: 5 },
  brute: { name: "Brute", spr: "brute", hp: 120, spd: 22, dmg: 12, r: 8, xp: 10, mass: 5, kb: 0.3, fps: 3 },
  cultist: { name: "Cultist", spr: "cultist", hp: 30, spd: 30, dmg: 6, r: 5, xp: 3, ai: "caster", shot: { dmg: 8, spd: 58, cd: 3.2, spr: "shot" }, mass: 1, fps: 3 },
  imp: { name: "Imp", spr: "imp", hp: 16, spd: 58, dmg: 5, r: 4, xp: 2, ai: "zigzag", mass: 0.6, fps: 8 },
  boar: { name: "Ember Boar", spr: "boar", hp: 60, spd: 30, dmg: 12, r: 7, xp: 5, ai: "charge", mass: 3, kb: 0.5, fps: 6 },
  golem: { name: "Ash Golem", spr: "golem", hp: 220, spd: 18, dmg: 15, r: 9, xp: 14, mass: 7, kb: 0.15, fps: 2 },
  wisp: { name: "Fire Wisp", spr: "wisp", hp: 20, spd: 34, dmg: 6, r: 4, xp: 3, ai: "caster", shot: { dmg: 8, spd: 70, cd: 2.6, spr: "fireball" }, light: 14, mass: 0.6, fps: 6 },
  brazier: { name: "Lantern Post", spr: "brazier", hp: 1, spd: 0, dmg: 0, r: 5, xp: 0, prop: true, light: 30, fps: 6 },
  king: { name: "The Hollow King", spr: "king", hp: 9000, spd: 30, dmg: 18, r: 12, xp: 0, ai: "king", boss: true, mass: 50, kb: 0, fps: 2 },
  lich: { name: "The Lich Matron", spr: "lich", hp: 11000, spd: 36, dmg: 16, r: 11, xp: 0, ai: "lich", boss: true, mass: 50, kb: 0, fps: 2, ghost: true },
  wyrm: { name: "The Cinder Wyrm", spr: "wyrm", hp: 14000, spd: 72, dmg: 20, r: 8, xp: 0, ai: "wyrm", boss: true, mass: 50, kb: 0, fps: 4, ghost: true },
  wyrmseg: { name: "Wyrm Coil", spr: "wyrmseg", hp: 1, spd: 0, dmg: 14, r: 6, xp: 0, ai: "seg", mass: 50, kb: 0, fps: 1, ghost: true },
};
for (const id in ENEMIES) ENEMIES[id].id = id;
const CODEX_ENEMIES = ["bat", "ghoul", "skel", "shade", "slime", "brute", "cultist", "imp", "boar", "golem", "wisp", "king", "lich", "wyrm"];

/* ================= stages ================= */
function paintWood(g, em, r) {
  g.fillStyle = "#13221b"; g.fillRect(0, 0, 128, 128);
  const tones = ["#172a21", "#10201a", "#1b3026", "#0e1b15", "#192d23"];
  for (let i = 0; i < 1400; i++) { g.fillStyle = tones[r.int(tones.length)]; g.fillRect(r.int(128), r.int(128), 1, 1); }
  for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.5 ? "#21402f" : "#1d3a2a"; const x = r.int(128), y = r.int(127); g.fillRect(x, y, 1, 2); }
  const put = (rows, pal, x, y) => { const s = compile(rows, pal, { outline: false }); g.drawImage(s.c, x, y); };
  for (let i = 0; i < 6; i++) put([".G..G.", "GgGgGg", ".gggg."], { G: "#2d5a3c", g: "#20432d" }, r.int(122), r.int(125));
  for (let i = 0; i < 2; i++) put([".33.", "3443", ".22."], { "3": "#3a4848", "4": "#566565", "2": "#263232" }, r.int(124), r.int(125));
  if (r() < 0.5) put([".RR.", "RWRR", ".WW."], { R: "#8a2a3a", W: "#c9bfa8" }, r.int(124), r.int(125));
  for (let i = 0; i < 4; i++) {
    const x = r.int(126) + 1, y = r.int(126) + 1, col = r() < 0.6 ? "#7fe8ff" : "#ff9ad5";
    g.fillStyle = "#1d3a2a"; g.fillRect(x, y + 1, 1, 2);
    em.fillStyle = col; em.fillRect(x - 1, y, 1, 1); em.fillRect(x + 1, y, 1, 1); em.fillRect(x, y - 1, 1, 1);
    em.fillStyle = "#ffffff"; em.fillRect(x, y, 1, 1);
  }
}
function paintCrypt(g, em, r) {
  g.fillStyle = "#1a1726"; g.fillRect(0, 0, 128, 128);
  for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) {
    const sh = ["#1c1929", "#1f1b2d", "#191624", "#211d30"][r.int(4)];
    g.fillStyle = sh; g.fillRect(tx * 16 + 1, ty * 16 + 1, 15, 15);
    for (let i = 0; i < 14; i++) { g.fillStyle = r() < 0.5 ? "#242036" : "#15121f"; g.fillRect(tx * 16 + 1 + r.int(15), ty * 16 + 1 + r.int(15), 1, 1); }
  }
  g.fillStyle = "#100e18";
  for (let i = 0; i < 8; i++) { g.fillRect(0, i * 16, 128, 1); g.fillRect(i * 16, 0, 1, 128); }
  for (let i = 0; i < 3; i++) { let x = r.int(128), y = r.int(128); g.fillStyle = "#0e0c15"; for (let k = 0; k < 9; k++) { g.fillRect(x, y, 1, 1); x += r.int(3) - 1; y += 1; } }
  const put = (rows, pal, x, y) => { const s = compile(rows, pal, { outline: false }); g.drawImage(s.c, x, y); };
  for (let i = 0; i < 2; i++) put(["W..W", ".WW.", "W..W"], { W: "#6f6878" }, r.int(122), r.int(124));
  if (r() < 0.6) put([".WWW.", "W0W0W", ".WWW.", "..W.."], { W: "#807a8c", "0": "#0d0b17" }, r.int(120), r.int(122));
  if (r() < 0.7) {
    const x = r.int(120) + 4, y = r.int(118) + 6;
    g.fillStyle = "#cfc6b0"; g.fillRect(x, y, 2, 4); g.fillStyle = "#8a826e"; g.fillRect(x, y + 3, 2, 1);
    em.fillStyle = "#ffd25e"; em.fillRect(x, y - 2, 2, 2); em.fillStyle = "#fff2a8"; em.fillRect(x, y - 1, 1, 1);
  }
}
function paintEmber(g, em, r) {
  g.fillStyle = "#22120f"; g.fillRect(0, 0, 128, 128);
  const tones = ["#2a1612", "#1c0f0c", "#2e1a15", "#261410"];
  for (let i = 0; i < 1500; i++) { g.fillStyle = tones[r.int(tones.length)]; g.fillRect(r.int(128), r.int(128), 1, 1); }
  for (let i = 0; i < 4; i++) {
    let x = r.int(128), y = r.int(128); const dx = r() < 0.5 ? 1 : -1;
    for (let k = 0; k < 14; k++) {
      g.fillStyle = "#120806"; g.fillRect(x, y, 1, 1);
      if (r() < 0.7) { em.fillStyle = r() < 0.3 ? "#ffd25e" : "#e8762d"; em.fillRect(x, y, 1, 1); }
      x += r() < 0.6 ? dx : 0; y += r() < 0.7 ? 1 : 0;
    }
  }
  const put = (rows, pal, x, y) => { const s = compile(rows, pal, { outline: false }); g.drawImage(s.c, x, y); };
  for (let i = 0; i < 3; i++) put([".nn.", "nNNn", ".nn."], { n: "#3a221c", N: "#55332a" }, r.int(124), r.int(125));
  for (let i = 0; i < 6; i++) { em.fillStyle = r() < 0.5 ? "#ff7a2d" : "#ffb347"; em.fillRect(r.int(128), r.int(128), 1, 1); }
}

const STAGES = {
  wood: {
    id: "wood", name: "Whisperwood", desc: "A quiet forest where the lantern-flowers glow. The night here is gentle, at first.",
    paint: paintWood, dark: "#03080d", darkA: 0.74, song: "wood", hp: 1, boss: "king", tint: "#5fbf4a",
    waves: [
      { t: 0, pool: { bat: 4, ghoul: 2 }, rate: 1.3, cap: 30 },
      { t: 60, pool: { bat: 3, ghoul: 3 }, rate: 2.1, cap: 50 },
      { t: 120, pool: { ghoul: 3, skel: 2, bat: 2 }, rate: 2.6, cap: 70 },
      { t: 180, pool: { skel: 3, ghoul: 2, bat: 1 }, rate: 3.0, cap: 90 },
      { t: 240, pool: { skel: 3, ghoul: 3, brute: 0.3 }, rate: 3.4, cap: 110 },
      { t: 300, pool: { bat: 5, skel: 2 }, rate: 4.6, cap: 140 },
      { t: 360, pool: { shade: 3, skel: 2, ghoul: 1 }, rate: 4.6, cap: 150 },
      { t: 420, pool: { brute: 1, skel: 3, shade: 1 }, rate: 4.8, cap: 170 },
      { t: 480, pool: { ghoul: 6, bat: 2 }, rate: 7, cap: 220 },
      { t: 540, pool: { skel: 3, shade: 2, brute: 0.6 }, rate: 6, cap: 220 },
      { t: 600, pool: { shade: 3, brute: 1 }, rate: 6.5, cap: 240 },
      { t: 660, pool: { bat: 4, skel: 3, shade: 2 }, rate: 8, cap: 270 },
      { t: 720, pool: { brute: 1.2, skel: 3, ghoul: 2 }, rate: 8, cap: 290 },
      { t: 780, pool: { shade: 3, brute: 1.2, bat: 3 }, rate: 9.5, cap: 320 },
      { t: 840, pool: { skel: 3, shade: 3, brute: 1 }, rate: 6.5, cap: 240 },
    ],
    events: [
      { t: 75, type: "swarm", e: "bat", n: 16 }, { t: 150, type: "elite", e: "ghoul" }, { t: 200, type: "swarm", e: "bat", n: 22 },
      { t: 270, type: "ring", e: "ghoul", n: 26 }, { t: 300, type: "mid", e: "brute", name: "Thornback" },
      { t: 390, type: "swarm", e: "bat", n: 30 }, { t: 450, type: "elite", e: "skel" }, { t: 510, type: "ring", e: "skel", n: 32 },
      { t: 570, type: "elite", e: "shade" }, { t: 600, type: "mid", e: "brute", name: "Old Thornback" },
      { t: 690, type: "swarm", e: "bat", n: 40 }, { t: 750, type: "elite", e: "brute" }, { t: 810, type: "ring", e: "shade", n: 36 },
      { t: 840, type: "boss", e: "king" },
    ],
  },
  crypt: {
    id: "crypt", name: "Sunken Crypt", desc: "Cold stone, old bones and candles that never go out. Things here shoot back.",
    paint: paintCrypt, dark: "#05030b", darkA: 0.8, song: "crypt", hp: 1.15, boss: "lich", tint: "#a35ce0",
    waves: [
      { t: 0, pool: { skel: 3, shade: 2 }, rate: 1.4, cap: 34 },
      { t: 60, pool: { skel: 3, shade: 2, slime: 1 }, rate: 2.2, cap: 55 },
      { t: 120, pool: { slime: 3, shade: 2, cultist: 0.5 }, rate: 2.6, cap: 75 },
      { t: 180, pool: { skel: 3, cultist: 1, slime: 2 }, rate: 3.1, cap: 95 },
      { t: 240, pool: { shade: 4, slime: 2, cultist: 1 }, rate: 3.6, cap: 120 },
      { t: 300, pool: { skel: 5, shade: 2 }, rate: 4.8, cap: 150 },
      { t: 360, pool: { slime: 3, cultist: 1.5, skel: 2 }, rate: 4.8, cap: 160 },
      { t: 420, pool: { shade: 3, brute: 1, cultist: 1 }, rate: 5, cap: 180 },
      { t: 480, pool: { slime: 5, shade: 3 }, rate: 7, cap: 230 },
      { t: 540, pool: { skel: 3, cultist: 2, brute: 0.6 }, rate: 6.2, cap: 230 },
      { t: 600, pool: { shade: 4, brute: 1, slime: 2 }, rate: 6.8, cap: 250 },
      { t: 660, pool: { skel: 4, cultist: 2, shade: 2 }, rate: 8.2, cap: 280 },
      { t: 720, pool: { brute: 1.2, slime: 3, cultist: 1 }, rate: 8.2, cap: 300 },
      { t: 780, pool: { shade: 4, brute: 1.2, cultist: 1.5 }, rate: 9.6, cap: 330 },
      { t: 840, pool: { skel: 3, shade: 3, cultist: 1 }, rate: 6.5, cap: 250 },
    ],
    events: [
      { t: 80, type: "swarm", e: "shade", n: 14 }, { t: 150, type: "elite", e: "slime" }, { t: 210, type: "ring", e: "skel", n: 24 },
      { t: 270, type: "elite", e: "cultist" }, { t: 300, type: "mid", e: "slime", name: "Gloomgut" },
      { t: 380, type: "swarm", e: "shade", n: 26 }, { t: 450, type: "elite", e: "brute" }, { t: 520, type: "ring", e: "slime", n: 28 },
      { t: 570, type: "elite", e: "shade" }, { t: 600, type: "mid", e: "cultist", name: "The Bellringer" },
      { t: 690, type: "swarm", e: "shade", n: 36 }, { t: 750, type: "elite", e: "brute" }, { t: 810, type: "ring", e: "skel", n: 40 },
      { t: 840, type: "boss", e: "lich" },
    ],
  },
  ember: {
    id: "ember", name: "Ember Waste", desc: "Ash fields over a burning crust. Fast, hungry and very hot.",
    paint: paintEmber, dark: "#0b0302", darkA: 0.72, song: "ember", hp: 1.3, boss: "wyrm", tint: "#e8762d",
    waves: [
      { t: 0, pool: { imp: 3, bat: 2 }, rate: 1.6, cap: 36 },
      { t: 60, pool: { imp: 4, wisp: 1 }, rate: 2.4, cap: 58 },
      { t: 120, pool: { imp: 3, boar: 1, wisp: 1 }, rate: 2.8, cap: 80 },
      { t: 180, pool: { boar: 2, imp: 3, bat: 2 }, rate: 3.3, cap: 100 },
      { t: 240, pool: { wisp: 2, imp: 3, golem: 0.3 }, rate: 3.8, cap: 125 },
      { t: 300, pool: { imp: 6, bat: 2 }, rate: 5.2, cap: 160 },
      { t: 360, pool: { boar: 2, wisp: 2, imp: 2 }, rate: 5, cap: 170 },
      { t: 420, pool: { golem: 1, imp: 3, boar: 1 }, rate: 5.2, cap: 190 },
      { t: 480, pool: { imp: 6, wisp: 2 }, rate: 7.5, cap: 240 },
      { t: 540, pool: { boar: 3, golem: 0.6, wisp: 2 }, rate: 6.5, cap: 240 },
      { t: 600, pool: { golem: 1, imp: 4, wisp: 2 }, rate: 7, cap: 260 },
      { t: 660, pool: { boar: 3, imp: 4, bat: 2 }, rate: 8.5, cap: 290 },
      { t: 720, pool: { golem: 1.2, wisp: 2, imp: 3 }, rate: 8.5, cap: 310 },
      { t: 780, pool: { boar: 3, golem: 1.2, imp: 4 }, rate: 10, cap: 340 },
      { t: 840, pool: { imp: 4, wisp: 2, boar: 1 }, rate: 7, cap: 260 },
    ],
    events: [
      { t: 70, type: "swarm", e: "imp", n: 18 }, { t: 150, type: "elite", e: "boar" }, { t: 210, type: "ring", e: "imp", n: 28 },
      { t: 270, type: "elite", e: "wisp" }, { t: 300, type: "mid", e: "golem", name: "Ashen Colossus" },
      { t: 380, type: "swarm", e: "imp", n: 30 }, { t: 450, type: "elite", e: "golem" }, { t: 520, type: "ring", e: "boar", n: 20 },
      { t: 570, type: "elite", e: "boar" }, { t: 600, type: "mid", e: "boar", name: "Pyre Hound" },
      { t: 690, type: "swarm", e: "imp", n: 44 }, { t: 750, type: "elite", e: "golem" }, { t: 810, type: "ring", e: "imp", n: 44 },
      { t: 840, type: "boss", e: "wyrm" },
    ],
  },
};
const STAGE_ORDER = ["wood", "crypt", "ember"];
const STAGE_UNLOCK = { wood: "Unlocked from the start.", crypt: "Survive 10 minutes in Whisperwood.", ember: "Survive 10 minutes in the Sunken Crypt." };

/* ================= permanent upgrades ================= */
const SHOP = [
  { id: "might", name: "Might", desc: "+5% damage", max: 5, cost: 200, icon: "gauntlet" },
  { id: "armor", name: "Armor", desc: "+1 armor", max: 3, cost: 600, icon: "plate" },
  { id: "maxhp", name: "Max Health", desc: "+10% max health", max: 3, cost: 200, icon: "heart" },
  { id: "regen", name: "Recovery", desc: "+0.1 health per second", max: 5, cost: 200, icon: "vial" },
  { id: "cooldown", name: "Cooldown", desc: "Weapons fire 2.5% faster", max: 2, cost: 900, icon: "hourglass" },
  { id: "area", name: "Area", desc: "+5% area", max: 2, cost: 300, icon: "lens" },
  { id: "speed", name: "Speed", desc: "+10% projectile speed", max: 2, cost: 300, icon: "feather" },
  { id: "duration", name: "Duration", desc: "Effects last 15% longer", max: 2, cost: 300, icon: "candle" },
  { id: "amount", name: "Amount", desc: "+1 projectile for every weapon", max: 1, cost: 3000, icon: "ring" },
  { id: "move", name: "Move Speed", desc: "+5% move speed", max: 2, cost: 300, icon: "boots" },
  { id: "magnet", name: "Magnet", desc: "+25% pickup range", max: 2, cost: 300, icon: "lodestone" },
  { id: "luck", name: "Luck", desc: "+10% luck", max: 3, cost: 600, icon: "clover" },
  { id: "growth", name: "Growth", desc: "+3% experience", max: 5, cost: 300, icon: "tome" },
  { id: "greed", name: "Greed", desc: "+10% gold", max: 5, cost: 200, icon: "gold" },
  { id: "revival", name: "Revival", desc: "Come back once per run with half health", max: 1, cost: 3000, icon: "heal" },
  { id: "reroll", name: "Reroll", desc: "+2 rerolls per run", max: 5, cost: 500, icon: "wand" },
  { id: "skip", name: "Skip", desc: "+1 skip per run", max: 3, cost: 100, icon: "boots" },
  { id: "banish", name: "Banish", desc: "+1 banish per run", max: 3, cost: 100, icon: "candle" },
];
function shopTotalRanks() { let n = 0; for (const s of SHOP) n += SAVE.shop[s.id] | 0; return n; }
function shopCost(item) { const r = SAVE.shop[item.id] | 0; return item.cost * (r + 1) + Math.floor(20 * Math.pow(1.1, shopTotalRanks())); }

/* ================= daily modifiers ================= */
const DAILY_MODS = [
  { id: "glass", name: "Glass Lantern", desc: "+50% damage, half max health.", stats: { mightMul: 1.5, hpMul: 0.5 } },
  { id: "swarm", name: "Swarm Night", desc: "50% more enemies, +30% experience.", spawn: 1.5, stats: { growthMul: 1.3 } },
  { id: "lucky", name: "Lucky Night", desc: "+50% luck and +50% gold.", stats: { luckAdd: 0.5, greedAdd: 0.5 } },
  { id: "haste", name: "Quickening", desc: "Everything moves 25% faster, you included.", espd: 1.25, stats: { moveMul: 1.25, pspdMul: 1.25 } },
  { id: "giants", name: "Giants", desc: "Enemies have double health and give double experience.", ehp: 2, stats: { growthMul: 2 } },
  { id: "arcane", name: "Arcane Night", desc: "Weapons fire 20% faster and +1 projectile, but enemies are 20% faster.", espd: 1.2, stats: { cdMul: 0.8, amtAdd: 1 } },
];
function dailyConfig(date = todayStr()) {
  const r = RNG(hashStr("lantern:" + date));
  return { date, seed: hashStr("seed:" + date), stage: r.pick(STAGE_ORDER), char: r.pick(CHARS).id, mod: r.pick(DAILY_MODS) };
}

/* ================= achievements ================= */
/* test(run) runs during and after runs; SAVE holds lifetime totals. */
const evoCount = () => Object.keys(SAVE.codex.x).length;
const ACH = [
  { id: "night5", name: "First Night", desc: "Survive 5 minutes.", test: (r) => r && r.t >= 300, reward: ["weapon", "boomer"] },
  { id: "lvl20", name: "Rising Flame", desc: "Reach level 20.", test: (r) => r && r.level >= 20, reward: ["weapon", "rune"] },
  { id: "kills2k", name: "Firestarter", desc: "Defeat 2,000 enemies in total.", test: (r) => SAVE.stats.kills + (r ? r.kills : 0) >= 2000, reward: ["weapon", "bomb"] },
  { id: "mid", name: "Thorns Cut", desc: "Defeat a mid-boss.", test: (r) => r && r.midKills > 0, reward: ["char", "brann"] },
  { id: "lvl30", name: "Duelist", desc: "Reach level 30 in one run.", test: (r) => r && r.level >= 30, reward: ["char", "sela"] },
  { id: "kills5k", name: "Exterminator", desc: "Defeat 5,000 enemies in total.", test: (r) => SAVE.stats.kills + (r ? r.kills : 0) >= 5000, reward: ["char", "pip"] },
  { id: "evolve", name: "Evolution", desc: "Evolve a weapon.", test: () => evoCount() >= 1, reward: ["char", "morrow"] },
  { id: "evolve3", name: "Alchemy", desc: "Evolve 3 different weapons.", test: () => evoCount() >= 3, reward: ["passive", "ring"] },
  { id: "dawn", name: "Dawn", desc: "Survive until dawn.", test: (r) => r && r.dawned, reward: ["char", "ivy"] },
  { id: "bloodunlock", name: "Red Sky", desc: "Survive until dawn in any stage.", test: (r) => r && r.dawned, reward: ["mode", "blood"], hidden: true },
  { id: "wood10", name: "Deeper Still", desc: "Survive 10 minutes in Whisperwood.", test: (r) => r && r.stage.id === "wood" && r.t >= 600, reward: ["stage", "crypt"] },
  { id: "crypt10", name: "Embers Below", desc: "Survive 10 minutes in the Sunken Crypt.", test: (r) => r && r.stage.id === "crypt" && r.t >= 600, reward: ["stage", "ember"] },
  { id: "dawn3", name: "The Long Night", desc: "See dawn in all three stages.", test: () => STAGE_ORDER.every((s) => SAVE.dawns[s]), reward: ["mode", "endless"] },
  { id: "blood", name: "Blood Moon", desc: "Survive until dawn under the Blood Moon.", test: (r) => r && r.dawned && r.opts.blood, reward: ["gold", 2000] },
  { id: "king", name: "Hollow Crown", desc: "Defeat the Hollow King.", test: (r) => r && r.bossKilled === "king", reward: ["gold", 500] },
  { id: "lich", name: "Lich Bane", desc: "Defeat the Lich Matron.", test: (r) => r && r.bossKilled === "lich", reward: ["gold", 600] },
  { id: "wyrm", name: "Wyrmslayer", desc: "Defeat the Cinder Wyrm.", test: (r) => r && r.bossKilled === "wyrm", reward: ["gold", 800] },
  { id: "endless20", name: "Endless", desc: "Survive 20 minutes of Endless Night.", test: (r) => r && r.opts.endless && r.t >= 1200, reward: ["gold", 1500] },
  { id: "untouched", name: "Untouchable", desc: "Go 3 minutes without taking damage.", test: (r) => r && r.noHitBest >= 180, reward: ["gold", 300] },
  { id: "arsenal", name: "Full Arsenal", desc: "Carry 6 weapons at once.", test: (r) => r && r.weapons.length >= 6, reward: ["gold", 300] },
  { id: "maxed", name: "Mastery", desc: "Raise a weapon to level 8.", test: (r) => r && r.weapons.some((w) => !WEAPONS[w.id].evolved && w.lv >= 8), reward: ["gold", 150] },
  { id: "kills1k", name: "Thousand Lights", desc: "Defeat 1,000 enemies in one run.", test: (r) => r && r.kills >= 1000, reward: ["gold", 250] },
  { id: "lvl50", name: "Blazing", desc: "Reach level 50 in one run.", test: (r) => r && r.level >= 50, reward: ["gold", 800] },
  { id: "daily", name: "Daily Devotion", desc: "Finish a daily run.", test: (r) => r && r.ended && r.opts.daily, reward: ["gold", 300] },
  { id: "rich", name: "Lantern Fund", desc: "Collect 10,000 gold in total.", test: () => SAVE.stats.gold >= 10000, reward: ["gold", 1000] },
  { id: "allchars", name: "Full Company", desc: "Unlock every character.", test: () => CHARS.every((c) => SAVE.chars.includes(c.id)), reward: ["gold", 1000] },
  { id: "evoall", name: "Master Alchemist", desc: "Evolve every weapon.", test: () => evoCount() >= BASE_WEAPONS.length, reward: ["gold", 3000] },
];

/* ================= music ================= */
const SONGS = {
  title: {
    bpm: 84, chords: ["Am", "F", "C", "G", "Am", "F", "G", "E"], pad: true, arp: true,
    bass: "R . . . . . . . F . . . . . . .",
    lead: ["e5 - - - a4 - c5 -", "a4 - - - f4 - a4 -", "g4 - c5 - e5 - g5 -", "f5 - e5 - d5 - - -", "e5 - - - a5 - g5 -", "f5 - e5 - c5 - a4 -", "b4 - d5 - g5 - f5 -", "e5 - - - g#4 - - -"],
  },
  wood: {
    bpm: 124, chords: ["Dm", "Bb", "F", "C", "Dm", "Bb", "C", "A"], arp: true,
    bass: "R . R O R . R O R . R O R . F O", drums: "k . h . s . h . k . h k s . h h",
    lead: ["d5 - a4 - d5 e5 f5 -", "f5 - e5 d5 - - bb4 -", "c5 - a4 - c5 d5 f5 -", "e5 - - d5 c5 - - -", "d5 - a4 - d5 e5 f5 g5", "a5 - g5 f5 - d5 f5 -", "g5 - e5 - c5 - e5 g5", "a5 - - - c#5 - e5 -"],
  },
  crypt: {
    bpm: 112, chords: ["Em", "C", "Am", "B", "Em", "C", "D", "B"], arp: true,
    bass: "R . . R . . R . R . . R . O F .", drums: "k . . h s . . h k . k h s . . h",
    lead: ["e5 - - b4 e5 f#5 g5 -", "e5 - - - g4 - c5 -", "a4 - c5 e5 d5 - c5 -", "b4 - - - d#5 - f#5 -", "g5 - f#5 e5 b4 - e5 -", "g5 - a5 g5 e5 - c5 -", "d5 - f#5 - a5 - f#5 d5", "d#5 - - - b4 - - -"],
  },
  ember: {
    bpm: 136, chords: ["Cm", "Ab", "Eb", "Bb", "Cm", "Ab", "Bb", "G"], arp: true,
    bass: "R R O R R R O R R R O R R R F O", drums: "k h s h k h s h k h s h k k s h",
    lead: ["c5 - g4 c5 eb5 - d5 c5", "eb5 - c5 - ab4 - c5 -", "bb4 - g4 - eb5 - g5 -", "f5 - d5 - bb4 - - -", "c5 - g4 c5 eb5 - g5 -", "ab5 - g5 - eb5 - c5 -", "d5 - f5 - bb5 - ab5 -", "g5 - - - b4 - d5 -"],
  },
  boss: {
    bpm: 146, chords: ["Am", "Am", "F", "E", "Am", "Am", "G", "E"], arp: true, leadVol: 0.06,
    bass: "R R O R R R O R R R O R F F O F", drums: "k . k h s . k h k . k h s h s s",
    lead: ["a4 a4 c5 a4 e5 a4 d5 c5", "a4 a4 c5 a4 g5 - e5 -", "f5 - e5 - c5 - a4 -", "g#4 - b4 - e5 - g#5 -", "a5 - e5 - c5 - a4 -", "c5 b4 a4 g4 a4 - e4 -", "g4 - b4 - d5 - g5 -", "g#5 - e5 - b4 - g#4 -"],
  },
  dawn: {
    bpm: 100, chords: ["C", "G", "Am", "F", "C", "G", "F", "C"], pad: true, arp: true,
    bass: "R . . . F . . . O . . . F . . .", drums: "k . . . h . . . k . . . h . . h",
    lead: ["e5 - g5 - c6 - - -", "b5 - g5 - d5 - - -", "c5 - e5 - a5 - - -", "a5 - g5 - f5 - - -", "e5 - g5 - c6 - e6 -", "d6 - b5 - g5 - - -", "a5 - c6 - f5 - a5 -", "g5 - - - c6 - - -"],
  },
  over: {
    bpm: 70, chords: ["Am", "F", "Dm", "E"], pad: true,
    bass: "R . . . . . . . . . . . . . . .",
    lead: ["e5 - - - c5 - - -", "a4 - - - - - - -", "f4 - - - a4 - d5 -", "b4 - - - g#4 - - -"],
  },
};
