"use strict";
/* GAMBIT piece set: vector pieces drawn in a 100-unit box and cached as sprites. */
const PIECES = (() => {
  const cache = new Map();
  function base(g, w = 27) { K.roundRect(g, 50 - w, 79, w * 2, 10, 4); g.fill(); g.stroke(); }
  function collar(g, y, w) { K.roundRect(g, 50 - w, y, w * 2, 8, 3.5); g.fill(); g.stroke(); }
  const SHAPES = {
    1(g, dl) { // pawn
      g.beginPath(); g.moveTo(41, 47); g.quadraticCurveTo(39, 63, 29, 75); g.lineTo(71, 75); g.quadraticCurveTo(61, 63, 59, 47); g.closePath(); g.fill(); g.stroke();
      collar(g, 41, 13); g.beginPath(); g.arc(50, 29, 12.5, 0, Math.PI * 2); g.fill(); g.stroke();
      base(g, 25);
    },
    2(g, dl) { // knight
      g.beginPath(); g.moveTo(68, 79);
      g.bezierCurveTo(72, 60, 74, 40, 63, 26); g.lineTo(62, 12); g.lineTo(53, 21);
      g.bezierCurveTo(40, 21, 27, 31, 21, 47); g.lineTo(18, 55);
      g.bezierCurveTo(19, 62, 28, 64, 33, 59); g.bezierCurveTo(37, 56, 43, 54, 47, 51);
      g.bezierCurveTo(40, 61, 33, 70, 33, 79); g.closePath(); g.fill(); g.stroke();
      g.save(); g.strokeStyle = dl; g.lineWidth = 2.6; g.lineCap = "round";
      g.beginPath(); g.moveTo(62, 30); g.bezierCurveTo(68, 44, 68, 60, 63, 74); g.stroke();
      g.beginPath(); g.moveTo(47, 51); g.quadraticCurveTo(43, 49, 40, 51); g.stroke();
      g.fillStyle = dl; g.beginPath(); g.ellipse(41, 35, 3.2, 2.4, -0.5, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(24, 54, 1.8, 0, Math.PI * 2); g.fill();
      g.restore(); base(g, 27);
    },
    3(g, dl) { // bishop
      g.beginPath(); g.moveTo(40, 61); g.lineTo(37, 71); g.lineTo(63, 71); g.lineTo(60, 61); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(50, 17); g.bezierCurveTo(67, 28, 71, 47, 62, 61); g.lineTo(38, 61); g.bezierCurveTo(29, 47, 33, 28, 50, 17); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.arc(50, 13, 5, 0, Math.PI * 2); g.fill(); g.stroke();
      g.save(); g.strokeStyle = dl; g.lineWidth = 3; g.lineCap = "round"; g.beginPath(); g.moveTo(56, 31); g.lineTo(46, 45); g.stroke(); g.restore();
      collar(g, 69, 18); base(g, 26);
    },
    4(g, dl) { // rook
      g.beginPath(); g.moveTo(34, 38); g.lineTo(66, 38); g.lineTo(64, 71); g.lineTo(36, 71); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(27, 39); g.lineTo(27, 17); g.lineTo(36, 17); g.lineTo(36, 24); g.lineTo(45, 24); g.lineTo(45, 17); g.lineTo(55, 17); g.lineTo(55, 24); g.lineTo(64, 24); g.lineTo(64, 17); g.lineTo(73, 17); g.lineTo(73, 39); g.closePath(); g.fill(); g.stroke();
      g.save(); g.strokeStyle = dl; g.lineWidth = 2.4; g.beginPath(); g.moveTo(36, 50); g.lineTo(64, 50); g.moveTo(36, 61); g.lineTo(64, 61); g.stroke(); g.restore();
      collar(g, 70, 20); base(g, 28);
    },
    5(g, dl) { // queen
      g.beginPath(); g.moveTo(31, 70); g.lineTo(19, 33); g.lineTo(32, 49); g.lineTo(35, 25); g.lineTo(43, 46); g.lineTo(50, 20); g.lineTo(57, 46); g.lineTo(65, 25); g.lineTo(68, 49); g.lineTo(81, 33); g.lineTo(69, 70); g.closePath(); g.fill(); g.stroke();
      for (const [x, y] of [[19, 30], [35, 22], [50, 16], [65, 22], [81, 30]]) { g.beginPath(); g.arc(x, y, 4.6, 0, Math.PI * 2); g.fill(); g.stroke(); }
      g.save(); g.strokeStyle = dl; g.lineWidth = 2.4; g.beginPath(); g.moveTo(32, 62); g.quadraticCurveTo(50, 57, 68, 62); g.stroke(); g.restore();
      collar(g, 70, 21); base(g, 29);
    },
    6(g, dl) { // king
      g.beginPath(); g.moveTo(31, 70); g.bezierCurveTo(16, 54, 20, 34, 36, 37); g.bezierCurveTo(43, 38, 47, 44, 50, 51); g.bezierCurveTo(53, 44, 57, 38, 64, 37); g.bezierCurveTo(80, 34, 84, 54, 69, 70); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(43, 46); g.lineTo(44, 30); g.quadraticCurveTo(50, 26, 56, 30); g.lineTo(57, 46); g.quadraticCurveTo(50, 52, 43, 46); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(47, 26); g.lineTo(47, 19); g.lineTo(41.5, 19); g.lineTo(41.5, 13); g.lineTo(47, 13); g.lineTo(47, 7); g.lineTo(53, 7); g.lineTo(53, 13); g.lineTo(58.5, 13); g.lineTo(58.5, 19); g.lineTo(53, 19); g.lineTo(53, 26); g.closePath(); g.fill(); g.stroke();
      g.save(); g.strokeStyle = dl; g.lineWidth = 2.4; g.beginPath(); g.moveTo(32, 62); g.quadraticCurveTo(50, 57, 68, 62); g.stroke(); g.restore();
      collar(g, 70, 21); base(g, 29);
    },
  };
  /* draw piece type 1-6, black true/false, into ctx at x,y with size s */
  function sprite(type, black, s, dpr = 1) {
    const key = type + (black ? "b" : "w") + s + "@" + dpr; if (cache.has(key)) return cache.get(key);
    const c = document.createElement("canvas"), px = Math.max(8, Math.round(s * dpr)); c.width = c.height = px; const g = c.getContext("2d");
    g.scale(px / 100, px / 100); g.lineJoin = "round"; g.lineCap = "round"; g.lineWidth = 3.2;
    const gr = g.createLinearGradient(0, 10, 0, 90);
    if (black) { gr.addColorStop(0, "#4a4a52"); gr.addColorStop(1, "#1b1b20"); g.strokeStyle = "#0d0d10"; }
    else { gr.addColorStop(0, "#fffdf7"); gr.addColorStop(1, "#ddd3bf"); g.strokeStyle = "#1f1c18"; }
    g.fillStyle = gr; g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = px * 0.04; g.shadowOffsetY = px * 0.015;
    // draw once with shadow (body), then redraw without for crisp edges
    SHAPES[type](g, black ? "#9a9aa6" : "#3a342c"); g.shadowColor = "transparent"; SHAPES[type](g, black ? "#9a9aa6" : "#3a342c");
    if (black) { g.save(); g.globalCompositeOperation = "source-atop"; const hl = g.createLinearGradient(0, 0, 100, 0); hl.addColorStop(0, "rgba(255,255,255,0.10)"); hl.addColorStop(0.45, "rgba(255,255,255,0)"); g.fillStyle = hl; g.fillRect(0, 0, 100, 100); g.restore(); }
    cache.set(key, c); return c;
  }
  return { sprite, clear: () => cache.clear() };
})();
