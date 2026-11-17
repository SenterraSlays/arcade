"use strict";
/* GAMBIT chess core: 0x88 board, legal moves, SAN/FEN, draw rules and an alpha-beta engine
   (iterative deepening, transposition table, null move, late move reductions, quiescence, opening book).
   Square index = rank*16 + file with rank 0 = the 8th rank. Pieces: type | color (white 0, black 8). */
const CHESS = (() => {
  const WHITE = 0, BLACK = 8, P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const NDIR = [-33, -31, -18, -14, 14, 18, 31, 33], BDIR = [-17, -15, 15, 17], RDIR = [-16, -1, 1, 16], KDIR = [-17, -16, -15, -1, 1, 15, 16, 17];
  const F_CAP = 1, F_DBL = 2, F_EP = 4, F_CASTLE = 8;
  const mv = (from, to, promo = 0, fl = 0) => from | (to << 7) | (promo << 14) | (fl << 17);
  const mFrom = (m) => m & 127, mTo = (m) => (m >> 7) & 127, mPromo = (m) => (m >> 14) & 7, mFlag = (m) => m >> 17;
  const sqName = (s) => "abcdefgh"[s & 7] + (8 - (s >> 4));
  const sqOf = (n) => (8 - +n[1]) * 16 + (n.charCodeAt(0) - 97);
  const CMASK = new Int8Array(128).fill(15); CMASK[116] = 12; CMASK[119] = 14; CMASK[112] = 13; CMASK[4] = 3; CMASK[7] = 11; CMASK[0] = 7;
  /* zobrist (two 32-bit halves) */
  let seed = 0x2f6b9a31; const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
  const Z1 = [], Z2 = []; for (let p = 0; p < 16; p++) { Z1.push(new Int32Array(128)); Z2.push(new Int32Array(128)); for (let s = 0; s < 128; s++) { Z1[p][s] = rnd(); Z2[p][s] = rnd(); } }
  const ZC1 = new Int32Array(16).map(rnd), ZC2 = new Int32Array(16).map(rnd), ZE1 = new Int32Array(8).map(rnd), ZE2 = new Int32Array(8).map(rnd), ZS1 = rnd(), ZS2 = rnd();

  class Pos {
    constructor(fen) { this.b = new Int8Array(128); this.load(fen || START); }
    load(fen) {
      const [pl, side, cs, ep, half, full] = fen.trim().split(/\s+/); this.b.fill(0);
      let r = 0, f = 0; for (const ch of pl) { if (ch === "/") { r++; f = 0; } else if (/\d/.test(ch)) f += +ch; else { const t = "pnbrqk".indexOf(ch.toLowerCase()) + 1; if (t < 1 || r > 7 || f > 7) throw new Error("Bad FEN"); this.b[r * 16 + f] = t | (ch === ch.toLowerCase() ? BLACK : WHITE); f++; } }
      this.side = side === "b" ? BLACK : WHITE; this.castle = 0;
      if (cs && cs !== "-") for (const ch of cs) this.castle |= { K: 1, Q: 2, k: 4, q: 8 }[ch] || 0;
      this.ep = ep && ep !== "-" ? sqOf(ep) : -1; this.half = +half || 0; this.full = +full || 1;
      this.kings = [-1, -1]; for (let s = 0; s < 128; s++) if (!(s & 0x88) && (this.b[s] & 7) === K) this.kings[this.b[s] >> 3] = s;
      if (this.kings[0] < 0 || this.kings[1] < 0) throw new Error("Both kings are needed");
      // drop castling rights that don't match the pieces
      if (this.b[116] !== K) this.castle &= 12; if (this.b[4] !== (K | BLACK)) this.castle &= 3;
      if (this.b[119] !== R) this.castle &= ~1; if (this.b[112] !== R) this.castle &= ~2; if (this.b[7] !== (R | BLACK)) this.castle &= ~4; if (this.b[0] !== (R | BLACK)) this.castle &= ~8;
      this.stack = []; this.hashes = []; this.rehash();
    }
    rehash() { let h1 = 0, h2 = 0; for (let s = 0; s < 128; s++) if (!(s & 0x88) && this.b[s]) { h1 ^= Z1[this.b[s]][s]; h2 ^= Z2[this.b[s]][s]; } h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle]; if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; } if (this.side) { h1 ^= ZS1; h2 ^= ZS2; } this.h1 = h1; this.h2 = h2; }
    fen() {
      let s = ""; for (let r = 0; r < 8; r++) { let e = 0; for (let f = 0; f < 8; f++) { const p = this.b[r * 16 + f]; if (!p) { e++; continue; } if (e) { s += e; e = 0; } const ch = " pnbrqk"[p & 7]; s += p & BLACK ? ch : ch.toUpperCase(); } if (e) s += e; if (r < 7) s += "/"; }
      let c = ""; if (this.castle & 1) c += "K"; if (this.castle & 2) c += "Q"; if (this.castle & 4) c += "k"; if (this.castle & 8) c += "q";
      return `${s} ${this.side ? "b" : "w"} ${c || "-"} ${this.ep >= 0 ? sqName(this.ep) : "-"} ${this.half} ${this.full}`;
    }
    attacked(sq, by) {
      const b = this.b;
      if (by === WHITE) { if (!((sq + 15) & 0x88) && b[sq + 15] === P) return true; if (!((sq + 17) & 0x88) && b[sq + 17] === P) return true; }
      else { if (!((sq - 15) & 0x88) && b[sq - 15] === (P | BLACK)) return true; if (!((sq - 17) & 0x88) && b[sq - 17] === (P | BLACK)) return true; }
      for (const d of NDIR) { const t = sq + d; if (!(t & 0x88) && b[t] === (N | by)) return true; }
      for (const d of KDIR) { const t = sq + d; if (!(t & 0x88) && b[t] === (K | by)) return true; }
      for (const d of BDIR) { let t = sq + d; while (!(t & 0x88)) { const p = b[t]; if (p) { if (p === (B | by) || p === (Q | by)) return true; break; } t += d; } }
      for (const d of RDIR) { let t = sq + d; while (!(t & 0x88)) { const p = b[t]; if (p) { if (p === (R | by) || p === (Q | by)) return true; break; } t += d; } }
      return false;
    }
    inCheck(side = this.side) { return this.attacked(this.kings[side >> 3], side ^ BLACK); }
    gen(out, caps = false) {
      const b = this.b, us = this.side, them = us ^ BLACK, up = us === WHITE ? -16 : 16, startR = us === WHITE ? 6 : 1, lastR = us === WHITE ? 0 : 7;
      for (let s = 0; s < 128; s++) {
        if (s & 0x88) { s += 7; continue; }
        const p = b[s]; if (!p || (p & BLACK) !== us) continue;
        const t = p & 7;
        if (t === P) {
          const one = s + up;
          if (!(one & 0x88) && !b[one]) {
            if (one >> 4 === lastR) { out.push(mv(s, one, Q)); if (!caps) { out.push(mv(s, one, R)); out.push(mv(s, one, B)); out.push(mv(s, one, N)); } }
            else if (!caps) { out.push(mv(s, one)); const two = one + up; if (s >> 4 === startR && !b[two]) out.push(mv(s, two, 0, F_DBL)); }
          }
          for (const d of [up - 1, up + 1]) {
            const c = s + d; if (c & 0x88) continue;
            if (b[c] && (b[c] & BLACK) === them) { if (c >> 4 === lastR) { out.push(mv(s, c, Q, F_CAP)); if (!caps) { out.push(mv(s, c, R, F_CAP)); out.push(mv(s, c, B, F_CAP)); out.push(mv(s, c, N, F_CAP)); } } else out.push(mv(s, c, 0, F_CAP)); }
            else if (c === this.ep) out.push(mv(s, c, 0, F_CAP | F_EP));
          }
          continue;
        }
        if (t === N || t === K) {
          for (const d of t === N ? NDIR : KDIR) { const c = s + d; if (c & 0x88) continue; const q = b[c]; if (!q) { if (!caps) out.push(mv(s, c)); } else if ((q & BLACK) === them) out.push(mv(s, c, 0, F_CAP)); }
          if (t === K && !caps && this.castle) {
            if (us === WHITE && s === 116) {
              if (this.castle & 1 && !b[117] && !b[118] && b[119] === R && !this.attacked(116, them) && !this.attacked(117, them) && !this.attacked(118, them)) out.push(mv(116, 118, 0, F_CASTLE));
              if (this.castle & 2 && !b[115] && !b[114] && !b[113] && b[112] === R && !this.attacked(116, them) && !this.attacked(115, them) && !this.attacked(114, them)) out.push(mv(116, 114, 0, F_CASTLE));
            } else if (us === BLACK && s === 4) {
              if (this.castle & 4 && !b[5] && !b[6] && b[7] === (R | BLACK) && !this.attacked(4, them) && !this.attacked(5, them) && !this.attacked(6, them)) out.push(mv(4, 6, 0, F_CASTLE));
              if (this.castle & 8 && !b[3] && !b[2] && !b[1] && b[0] === (R | BLACK) && !this.attacked(4, them) && !this.attacked(3, them) && !this.attacked(2, them)) out.push(mv(4, 2, 0, F_CASTLE));
            }
          }
          continue;
        }
        const dirs = t === B ? BDIR : t === R ? RDIR : KDIR;
        for (const d of dirs) { let c = s + d; while (!(c & 0x88)) { const q = b[c]; if (!q) { if (!caps) out.push(mv(s, c)); } else { if ((q & BLACK) === them) out.push(mv(s, c, 0, F_CAP)); break; } c += d; } }
      }
      return out;
    }
    make(m) {
      const b = this.b, from = mFrom(m), to = mTo(m), promo = mPromo(m), fl = mFlag(m), us = this.side, pc = b[from];
      let capSq = to; if (fl & F_EP) capSq = to + (us === WHITE ? 16 : -16);
      const cap = b[capSq];
      this.stack.push([m, cap, this.castle, this.ep, this.half, this.h1, this.h2]); this.hashes.push(this.h1);
      let h1 = this.h1, h2 = this.h2;
      h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle]; if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
      if (cap) { h1 ^= Z1[cap][capSq]; h2 ^= Z2[cap][capSq]; b[capSq] = 0; }
      h1 ^= Z1[pc][from]; h2 ^= Z2[pc][from]; b[from] = 0;
      const np = promo ? promo | us : pc; b[to] = np; h1 ^= Z1[np][to]; h2 ^= Z2[np][to];
      if (fl & F_CASTLE) { const rf = to > from ? to + 1 : to - 2, rt = to > from ? to - 1 : to + 1, rk = b[rf]; b[rf] = 0; b[rt] = rk; h1 ^= Z1[rk][rf] ^ Z1[rk][rt]; h2 ^= Z2[rk][rf] ^ Z2[rk][rt]; }
      if ((pc & 7) === K) this.kings[us >> 3] = to;
      this.castle &= CMASK[from] & CMASK[to];
      this.ep = fl & F_DBL ? (from + to) >> 1 : -1;
      this.half = (pc & 7) === P || cap ? 0 : this.half + 1;
      if (us === BLACK) this.full++;
      this.side ^= BLACK;
      h1 ^= ZC1[this.castle] ^ ZS1; h2 ^= ZC2[this.castle] ^ ZS2; if (this.ep >= 0) { h1 ^= ZE1[this.ep & 7]; h2 ^= ZE2[this.ep & 7]; }
      this.h1 = h1; this.h2 = h2;
    }
    unmake() {
      const [m, cap, castle, ep, half, h1, h2] = this.stack.pop(); this.hashes.pop();
      const b = this.b, from = mFrom(m), to = mTo(m), promo = mPromo(m), fl = mFlag(m);
      this.side ^= BLACK; const us = this.side; if (us === BLACK) this.full--;
      const pc = promo ? P | us : b[to]; b[from] = pc; b[to] = 0;
      if (fl & F_EP) b[to + (us === WHITE ? 16 : -16)] = cap; else b[to] = cap;
      if (fl & F_CASTLE) { const rf = to > from ? to + 1 : to - 2, rt = to > from ? to - 1 : to + 1; b[rf] = b[rt]; b[rt] = 0; }
      if ((pc & 7) === K) this.kings[us >> 3] = from;
      this.castle = castle; this.ep = ep; this.half = half; this.h1 = h1; this.h2 = h2;
    }
    makeNull() { this.stack.push([0, 0, this.castle, this.ep, this.half, this.h1, this.h2]); this.hashes.push(this.h1); if (this.ep >= 0) { this.h1 ^= ZE1[this.ep & 7]; this.h2 ^= ZE2[this.ep & 7]; } this.ep = -1; this.side ^= BLACK; this.h1 ^= ZS1; this.h2 ^= ZS2; this.half++; }
    unmakeNull() { const [, , castle, ep, half, h1, h2] = this.stack.pop(); this.hashes.pop(); this.side ^= BLACK; this.castle = castle; this.ep = ep; this.half = half; this.h1 = h1; this.h2 = h2; }
    legal() { const out = [], all = this.gen([]), us = this.side; for (const m of all) { this.make(m); if (!this.attacked(this.kings[us >> 3], this.side)) out.push(m); this.unmake(); } return out; }
    repeats() { let n = 0; for (let i = this.hashes.length - 2, k = 0; i >= 0 && k < this.half; i -= 2, k += 2) if (this.hashes[i] === this.h1) n++; return n; }
    insufficient() {
      let minors = 0, bishops = [], other = 0;
      for (let s = 0; s < 128; s++) { if (s & 0x88) continue; const t = this.b[s] & 7; if (!t || t === K) continue; if (t === N) minors++; else if (t === B) { minors++; bishops.push(((s >> 4) + (s & 7)) & 1); } else other++; }
      if (other) return false; if (minors <= 1) return true;
      return minors === bishops.length && bishops.every((c) => c === bishops[0]);
    }
    /* game status for the side to move */
    status() {
      const legal = this.legal();
      if (!legal.length) return this.inCheck() ? { over: true, result: this.side === WHITE ? "0-1" : "1-0", why: "checkmate" } : { over: true, result: "1/2-1/2", why: "stalemate" };
      if (this.half >= 100) return { over: true, result: "1/2-1/2", why: "50-move rule" };
      if (this.repeats() >= 2) return { over: true, result: "1/2-1/2", why: "threefold repetition" };
      if (this.insufficient()) return { over: true, result: "1/2-1/2", why: "insufficient material" };
      return { over: false, legal };
    }
    san(m, legal) {
      const from = mFrom(m), to = mTo(m), fl = mFlag(m), pc = this.b[from], t = pc & 7;
      let s;
      if (fl & F_CASTLE) s = (to & 7) === 6 ? "O-O" : "O-O-O";
      else if (t === P) s = (fl & F_CAP ? "abcdefgh"[from & 7] + "x" : "") + sqName(to) + (mPromo(m) ? "=" + " PNBRQK"[mPromo(m)] : "");
      else {
        let dis = ""; const others = (legal || this.legal()).filter((o) => o !== m && mTo(o) === to && this.b[mFrom(o)] === pc);
        if (others.length) { const sf = others.some((o) => (mFrom(o) & 7) === (from & 7)), sr = others.some((o) => mFrom(o) >> 4 === from >> 4); dis = !sf ? "abcdefgh"[from & 7] : !sr ? String(8 - (from >> 4)) : sqName(from); }
        s = " PNBRQK"[t] + dis + (fl & F_CAP ? "x" : "") + sqName(to);
      }
      this.make(m); if (this.inCheck()) s += this.legal().length ? "+" : "#"; this.unmake();
      return s;
    }
    uci(m) { return sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? " pnbrqk"[mPromo(m)] : ""); }
    fromUci(u, legal) { return (legal || this.legal()).find((m) => this.uci(m) === u) || 0; }
  }
  function perft(pos, d) { if (!d) return 1; let n = 0; const ms = pos.gen([]), us = pos.side; for (const m of ms) { pos.make(m); if (!pos.attacked(pos.kings[us >> 3], pos.side)) n += perft(pos, d - 1); pos.unmake(); } return n; }

  /* ================= evaluation ================= */
  const MG = [0, 82, 337, 365, 477, 1025, 0], EG = [0, 94, 281, 297, 512, 936, 0], PHASE = [0, 0, 1, 1, 2, 4, 0];
  const T = {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    4: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    7: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };
  const PEG = [0, 0, 0, 0, 0, 0, 0, 0, 80, 80, 80, 80, 80, 80, 80, 80, 45, 45, 45, 45, 45, 45, 45, 45, 25, 25, 25, 25, 25, 25, 25, 25, 12, 12, 12, 12, 12, 12, 12, 12, 4, 4, 4, 4, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const PASS_MG = [0, 45, 28, 16, 9, 5, 2, 0], PASS_EG = [0, 120, 80, 50, 28, 15, 8, 0];
  function evaluate(pos) {
    const b = pos.b; let mg = 0, eg = 0, phase = 0;
    const wMax = [-1, -1, -1, -1, -1, -1, -1, -1], bMin = [8, 8, 8, 8, 8, 8, 8, 8], wCnt = [0, 0, 0, 0, 0, 0, 0, 0], bCnt = [0, 0, 0, 0, 0, 0, 0, 0], wMin = [8, 8, 8, 8, 8, 8, 8, 8], bMax = [-1, -1, -1, -1, -1, -1, -1, -1];
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = b[s]; if ((p & 7) !== P) continue; const r = s >> 4, f = s & 7; if (p & BLACK) { bCnt[f]++; if (r < bMin[f]) bMin[f] = r; if (r > bMax[f]) bMax[f] = r; } else { wCnt[f]++; if (r > wMax[f]) wMax[f] = r; if (r < wMin[f]) wMin[f] = r; } }
    let wb = 0, bb = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s]; if (!p) continue;
      const t = p & 7, black = p & BLACK, sq = (s >> 4) * 8 + (s & 7), i = black ? sq ^ 56 : sq, sg = black ? -1 : 1, r = s >> 4, f = s & 7;
      phase += PHASE[t];
      let m = MG[t], e = EG[t];
      if (t === K) { m += T[6][i]; e += T[7][i]; }
      else { m += T[t][i]; e += t === P ? PEG[i] : T[t][i]; }
      if (t === P) {
        const own = black ? bCnt : wCnt;
        if (own[f] > 1) { m -= 10; e -= 20; }
        if ((f === 0 || !own[f - 1]) && (f === 7 || !own[f + 1])) { m -= 10; e -= 14; }
        let passed = true;
        if (!black) { for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1); ff++) if (bMin[ff] < r) { passed = false; break; } if (passed) { m += PASS_MG[r]; e += PASS_EG[r]; } }
        else { for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1); ff++) if (wMax[ff] > r) { passed = false; break; } if (passed) { m += PASS_MG[7 - r]; e += PASS_EG[7 - r]; } }
      } else if (t === B || t === R || t === Q) {
        let mob = 0; for (const d of t === B ? BDIR : t === R ? RDIR : KDIR) { let c = s + d; while (!(c & 0x88)) { if (b[c]) { if ((b[c] & BLACK) !== black) mob++; break; } mob++; c += d; } }
        if (t === B) { m += (mob - 6) * 4; e += (mob - 6) * 4; if (black) bb++; else wb++; }
        else if (t === R) { m += (mob - 6) * 2; e += (mob - 6) * 4; const own = black ? bCnt : wCnt, opp = black ? wCnt : bCnt; if (!own[f]) { m += opp[f] ? 10 : 22; e += 8; } }
        else { m += (mob - 12); e += (mob - 12) * 2; }
      } else if (t === K) {
        // pawn shield in the middlegame
        const dir = black ? 1 : -1; let sh = 0;
        for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1); ff++) { const p1 = b[(r + dir) * 16 + ff], p2 = (r + 2 * dir) >= 0 && (r + 2 * dir) < 8 ? b[(r + 2 * dir) * 16 + ff] : 0; if ((p1 & 7) === P && (p1 & BLACK) === black) sh += 12; else if ((p2 & 7) === P && (p2 & BLACK) === black) sh += 6; else sh -= 8; }
        m += sh;
      }
      mg += m * sg; eg += e * sg;
    }
    if (wb >= 2) { mg += 30; eg += 45; } if (bb >= 2) { mg -= 30; eg -= 45; }
    if (phase > 24) phase = 24;
    let score = (mg * phase + eg * (24 - phase)) / 24;
    score = pos.side === WHITE ? score + 10 : -score + 10;
    return score | 0;
  }

  /* ================= search ================= */
  const MATE = 30000, INF = 32000, TT_BITS = 19, TT_MASK = (1 << TT_BITS) - 1;
  let ttLock = null, ttMove, ttScore, ttDepth, ttFlag;
  const VAL = [0, 100, 320, 330, 500, 900, 2000];
  function search(pos, o = {}) {
    if (!ttLock) { const n = 1 << TT_BITS; ttLock = new Int32Array(n); ttMove = new Int32Array(n); ttScore = new Int16Array(n); ttDepth = new Int8Array(n); ttFlag = new Uint8Array(n); }
    const t0 = Date.now(), timeLimit = o.time || 1000, maxDepth = o.depth || 64, deadline = t0 + timeLimit;
    let nodes = 0, stop = false, rootBest = 0, rootScore = 0;
    const killers = [], hist = new Int32Array(16 * 128);
    for (let i = 0; i < 128; i++) killers.push([0, 0]);
    const order = (moves, ttm, ply) => {
      const sc = new Array(moves.length), k = killers[ply];
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i]; let s = 0;
        if (m === ttm) s = 1e7;
        else if (mFlag(m) & F_CAP) { const v = mFlag(m) & F_EP ? P : pos.b[mTo(m)] & 7; s = 1e6 + VAL[v] * 10 - VAL[pos.b[mFrom(m)] & 7] / 10; }
        else if (mPromo(m) === Q) s = 9e5;
        else if (m === k[0]) s = 8e5; else if (m === k[1]) s = 7e5;
        else s = hist[(pos.b[mFrom(m)] & 15) * 128 + mTo(m)];
        sc[i] = s;
      }
      const idx = moves.map((_, i) => i).sort((a, b) => sc[b] - sc[a]);
      return idx.map((i) => moves[i]);
    };
    function quiesce(alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
      if (stop) return 0;
      const check = ply < 40 && pos.inCheck();
      const stand = check ? -MATE + ply : evaluate(pos);
      if (!check) { if (stand >= beta) return stand; if (stand > alpha) alpha = stand; if (ply > 60) return stand; }
      const moves = order(pos.gen([], !check), 0, Math.min(ply, 127)), us = pos.side; let legal = 0;
      for (const m of moves) {
        if (!check && !(mFlag(m) & F_EP) && !mPromo(m) && stand + VAL[pos.b[mTo(m)] & 7] + 200 < alpha) continue;
        pos.make(m); if (pos.attacked(pos.kings[us >> 3], pos.side)) { pos.unmake(); continue; }
        legal++; const s = -quiesce(-beta, -alpha, ply + 1); pos.unmake();
        if (stop) return 0;
        if (s >= beta) return s; if (s > alpha) alpha = s;
      }
      if (check && !legal) return -MATE + ply;
      return alpha;
    }
    function nonPawn(side) { for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = pos.b[s]; if (p && (p & BLACK) === side && (p & 7) !== P && (p & 7) !== K) return true; } return false; }
    function negamax(depth, alpha, beta, ply, allowNull) {
      if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
      if (stop) return 0;
      if (ply && (pos.half >= 100 || pos.repeats() >= 1)) return 0;
      const inCheck = pos.inCheck(); if (inCheck) depth++;
      if (depth <= 0) return quiesce(alpha, beta, ply);
      const idx = pos.h1 & TT_MASK, a0 = alpha; let ttm = 0;
      if (ttLock[idx] === pos.h2) {
        ttm = ttMove[idx];
        if (ply && ttDepth[idx] >= depth) {
          let s = ttScore[idx]; if (s > MATE - 200) s -= ply; else if (s < -MATE + 200) s += ply;
          const f = ttFlag[idx]; if (f === 0 || (f === 1 && s >= beta) || (f === 2 && s <= alpha)) return s;
        }
      }
      if (allowNull && !inCheck && ply && depth >= 3 && beta < MATE - 200 && nonPawn(pos.side) && evaluate(pos) >= beta) {
        pos.makeNull(); const s = -negamax(depth - 3, -beta, -beta + 1, ply + 1, false); pos.unmakeNull();
        if (stop) return 0; if (s >= beta) return beta;
      }
      const moves = order(pos.gen([]), ttm, Math.min(ply, 127)), us = pos.side;
      let legal = 0, best = -INF, bestMove = 0;
      for (const m of moves) {
        pos.make(m); if (pos.attacked(pos.kings[us >> 3], pos.side)) { pos.unmake(); continue; }
        legal++;
        const quiet = !(mFlag(m) & F_CAP) && !mPromo(m);
        let s;
        if (legal === 1) s = -negamax(depth - 1, -beta, -alpha, ply + 1, true);
        else {
          let r = 0; if (depth >= 3 && legal > 3 && quiet && !inCheck && m !== killers[Math.min(ply, 127)][0]) r = legal > 10 ? 2 : 1;
          s = -negamax(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
          if (s > alpha && (r || s < beta)) s = -negamax(depth - 1, -beta, -alpha, ply + 1, true);
        }
        pos.unmake();
        if (stop) return 0;
        if (s > best) {
          best = s; bestMove = m;
          if (s > alpha) {
            alpha = s; if (!ply) { rootBest = m; rootScore = s; }
            if (s >= beta) { if (quiet) { const k = killers[Math.min(ply, 127)]; if (k[0] !== m) { k[1] = k[0]; k[0] = m; } hist[(pos.b[mFrom(m)] & 15) * 128 + mTo(m)] += depth * depth; } break; }
          }
        }
      }
      if (!legal) return inCheck ? -MATE + ply : 0;
      let ts = best; if (ts > MATE - 200) ts += ply; else if (ts < -MATE + 200) ts -= ply;
      ttLock[idx] = pos.h2; ttMove[idx] = bestMove; ttScore[idx] = ts; ttDepth[idx] = depth; ttFlag[idx] = best >= beta ? 1 : best <= a0 ? 2 : 0;
      return best;
    }
    let done = { move: 0, score: 0, depth: 0 };
    for (let d = 1; d <= maxDepth; d++) {
      rootBest = 0; const s = negamax(d, -INF, INF, 0, false);
      if (stop && !rootBest) break;
      if (rootBest) done = { move: rootBest, score: stop ? rootScore : s, depth: d };
      if (stop) break;
      if (Math.abs(s) > MATE - 200 && d > 3) break;
      if (Date.now() - t0 > timeLimit * 0.55) break;
    }
    if (!done.move) { const l = pos.legal(); done.move = l[0] || 0; }
    return { ...done, nodes, ms: Date.now() - t0 };
  }
  /* weaker play: score every root move at a small depth and add noise */
  function noisyPick(pos, depth, noise, rng = Math.random) {
    const legal = pos.legal(); if (!legal.length) return { move: 0, score: 0 };
    let best = null;
    for (const m of legal) {
      pos.make(m); const r = depth > 1 ? search(pos, { depth: depth - 1, time: 400 }) : { score: evaluate(pos) }; pos.unmake();
      let s = -r.score;
      if (pos.san(m, legal).endsWith("#")) s = MATE;
      s += (rng() * 2 - 1) * noise;
      if (!best || s > best.s) best = { m, s };
    }
    return { move: best.m, score: best.s | 0, depth };
  }
  const LEVELS = [
    { name: "Novice", depth: 1, noise: 420, blunder: 0.2 }, { name: "Beginner", depth: 1, noise: 220, blunder: 0.08 }, { name: "Casual", depth: 2, noise: 110, blunder: 0.03 },
    { name: "Intermediate", depth: 3, noise: 45 }, { name: "Club", time: 350, depth: 5 }, { name: "Strong", time: 800, depth: 7 }, { name: "Expert", time: 1600 }, { name: "Master", time: 3200 },
  ];
  const BOOK = [
    "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7", "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4", "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8e7", "e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6",
    "e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d6d5", "e2e4 e7e5 b1c3 g8f6 g1f3 b8c6", "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6", "e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5",
    "e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6", "e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7", "e2e4 c7c5 c2c3 g8f6 e4e5 f6d5 d2d4 c5d4", "e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7",
    "e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6", "e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6", "e2e4 c7c6 d2d4 d7d5 e4e5 c8f5", "e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6",
    "e2e4 g8f6 e4e5 f6d5 d2d4 d7d6", "e2e4 d7d6 d2d4 g8f6 b1c3 g7g6", "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8", "d2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5",
    "d2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6 f1c4 c7c5", "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8", "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8", "d2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7",
    "d2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3", "d2d4 f7f5 g2g3 g8f6 f1g2 g7g6", "d2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3 c7c5", "d2d4 d7d5 g1f3 g8f6 c2c4 e7e6",
    "c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3", "c2c4 g8f6 b1c3 e7e6 e2e4 d7d5", "g1f3 d7d5 g2g3 g8f6 f1g2 e7e6 e1g1 f8e7", "g1f3 g8f6 c2c4 g7g6 b1c3 f8g7",
  ].map((l) => l.split(" "));
  function bookMove(pos, played, rng = Math.random) {
    const n = played.length, cands = new Set();
    for (const line of BOOK) { if (line.length <= n) continue; let ok = true; for (let i = 0; i < n; i++) if (line[i] !== played[i]) { ok = false; break; } if (ok) cands.add(line[n]); }
    if (!cands.size) return 0; const list = [...cands], legal = pos.legal();
    return pos.fromUci(list[(rng() * list.length) | 0], legal);
  }
  function think(pos, level, played = [], maxTime = 0) {
    const L0 = LEVELS[Math.max(0, Math.min(7, level))], L = maxTime && L0.time ? { ...L0, time: Math.max(150, Math.min(L0.time, maxTime)) } : L0;
    if (played.length < 12 && (level >= 2 || Math.random() < 0.6)) { const bm = bookMove(pos, played); if (bm) return { move: bm, score: 0, depth: 0, book: true }; }
    if (L.blunder && Math.random() < L.blunder) { const l = pos.legal(); return { move: l[(Math.random() * l.length) | 0], score: 0, depth: 0 }; }
    if (L.noise) return noisyPick(pos, L.depth, L.noise);
    return search(pos, { time: L.time, depth: L.depth });
  }
  return { WHITE, BLACK, P, N, B, R, Q, K, START, Pos, perft, evaluate, search, think, LEVELS, mFrom, mTo, mPromo, mFlag, F_CAP, F_EP, F_CASTLE, sqName, sqOf, MATE };
})();
if (typeof module !== "undefined") module.exports = CHESS;
if (typeof window === "undefined" && typeof self !== "undefined" && typeof module === "undefined") {
  self.onmessage = (e) => {
    const m = e.data, pos = new CHESS.Pos(m.start || CHESS.START), played = [];
    for (const u of m.moves || []) { const mv = pos.fromUci(u); if (!mv) break; pos.make(mv); played.push(u); }
    const r = m.cmd === "hint" ? CHESS.search(pos, { time: m.time || 900 }) : CHESS.think(pos, m.level, m.start && m.start !== CHESS.START ? ["-"] : played, m.maxTime || 0);
    self.postMessage({ id: m.id, move: r.move ? pos.uci(r.move) : null, score: r.score, depth: r.depth, book: !!r.book, nodes: r.nodes || 0 });
  };
}
