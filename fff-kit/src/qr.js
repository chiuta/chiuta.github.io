/* fff-kit · FFF.qr — generator și decodor de coduri QR (fără dependențe, fără rețea).
 * Generator: versiunile 1–40, ECC L/M/Q/H, moduri numeric / alfanumeric / octet (UTF-8), mascare optimă, Reed–Solomon.
 * Decodor: localizare finder patterns, eșantionare cu omografie (aliniere), corecție Reed–Solomon (Berlekamp–Massey).
 * Scris de la zero pentru fff-kit (specificația ISO/IEC 18004 este publică); nu conține cod de terți.
 * Depinde doar de FFF.core (FFF.t / FFF.registerI18n). */
(function () {
  'use strict';
  const F = (window.FFF = window.FFF || {});

  /* ---------- tabele ISO 18004 (indexate după versiune; poziția 0 = umplutură) ---------- */
  const ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];
  const NUM_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];
  const ECC_IDX = {L: 0, M: 1, Q: 2, H: 3};
  const ECC_NAME = ['L', 'M', 'Q', 'H'];
  const ECC_FMT = [1, 0, 3, 2];                    // biții de format pentru L,M,Q,H
  const FMT_TO_ECC = [1, 0, 3, 2];                 // invers: biții de format → index ECC (simetric)
  const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

  /* ---------- GF(256), polinom 0x11D ---------- */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;
  const inv = a => EXP[255 - LOG[a]];

  function rsGen(d) {
    const r = new Uint8Array(d); r[d - 1] = 1; let root = 1;
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) { r[j] = mul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; }
      root = mul(root, 2);
    }
    return r;
  }
  function rsRem(data, gen) {
    const r = new Uint8Array(gen.length);
    for (const b of data) {
      const f = b ^ r[0]; r.copyWithin(0, 1); r[r.length - 1] = 0;
      for (let i = 0; i < r.length; i++) r[i] ^= mul(gen[i], f);
    }
    return r;
  }

  /* ---------- geometrie ---------- */
  function rawModules(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function alignPos(v) {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2;
    const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    const res = [6];
    for (let pos = v * 4 + 10; res.length < n; pos -= step) res.splice(1, 0, pos);
    return res;
  }
  function dataCodewords(v, e) { return Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[e][v] * NUM_BLOCKS[e][v]; }

  function formatBits(e, mask) {
    const data = (ECC_FMT[e] << 3) | mask; let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  }
  function versionBits(v) {
    let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    return (v << 12) | rem;
  }

  /** Simbol gol cu tiparele funcționale (fn=1 pe modulele rezervate). */
  function newSymbol(ver) {
    const size = ver * 4 + 17, m = new Uint8Array(size * size), fn = new Uint8Array(size * size);
    const set = (x, y, v) => { if (x < 0 || y < 0 || x >= size || y >= size) return; m[y * size + x] = v ? 1 : 0; fn[y * size + x] = 1; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = alignPos(ver), n = ap.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const sym = {size, m, fn, set};
    drawFormat(sym, 0, 0);
    if (ver >= 7) {
      const bits = versionBits(ver);
      for (let i = 0; i < 18; i++) { const c = (bits >>> i) & 1, a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, c); set(b, a, c); }
    }
    return sym;
  }
  function drawFormat(sym, e, mask) {
    const {size, set} = sym, bits = formatBits(e, mask), bit = i => (bits >>> i) & 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, 1);
  }
  const fnCache = {};
  function fnMask(ver) { return fnCache[ver] || (fnCache[ver] = newSymbol(ver).fn); }

  /** Aranjarea blocurilor: pentru fiecare poziție din fluxul intercalat → [bloc, index în bloc]. */
  const layCache = {};
  function layout(v, e) {
    const key = v * 4 + e; if (layCache[key]) return layCache[key];
    const nb = NUM_BLOCKS[e][v], el = ECC_PER_BLOCK[e][v], raw = Math.floor(rawModules(v) / 8);
    const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), map = [], dlen = [];
    for (let b = 0; b < nb; b++) dlen.push(shortLen - el + (b >= nShort ? 1 : 0));
    for (let i = 0; i <= shortLen - el; i++) for (let b = 0; b < nb; b++) if (i < dlen[b]) map.push([b, i]);
    for (let i = 0; i < el; i++) for (let b = 0; b < nb; b++) map.push([b, dlen[b] + i]);
    return (layCache[key] = {nb, el, raw, dlen, map});
  }

  /* ---------- codare ---------- */
  const MASKS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
  ];
  function ccBits(mode, v) { const i = v <= 9 ? 0 : v <= 26 ? 1 : 2; return ({1: [10, 12, 14], 2: [9, 11, 13], 4: [8, 16, 16]})[mode][i]; }
  function pushBits(buf, val, len) { for (let i = len - 1; i >= 0; i--) buf.push((val >>> i) & 1); }

  function chooseMode(text) {
    if (/^[0-9]*$/.test(text)) return 1;
    let ok = true; for (const ch of text) if (ALNUM.indexOf(ch) < 0) { ok = false; break; }
    return ok ? 2 : 4;
  }
  function segmentBits(text, mode, v, eci) {
    const buf = [];
    if (eci && mode === 4) { pushBits(buf, 7, 4); pushBits(buf, 26, 8); }
    pushBits(buf, mode, 4);
    if (mode === 1) {
      pushBits(buf, text.length, ccBits(1, v));
      for (let i = 0; i < text.length; i += 3) { const g = text.substr(i, 3); pushBits(buf, parseInt(g, 10), g.length * 3 + 1); }
    } else if (mode === 2) {
      pushBits(buf, text.length, ccBits(2, v));
      for (let i = 0; i < text.length; i += 2) {
        if (i + 1 < text.length) pushBits(buf, ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11);
        else pushBits(buf, ALNUM.indexOf(text[i]), 6);
      }
    } else {
      const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
      pushBits(buf, bytes.length, ccBits(4, v));
      for (const b of bytes) pushBits(buf, b, 8);
    }
    return buf;
  }

  function penalty(m, size) {
    let res = 0, dark = 0;
    const at = (a, i, dir) => (i < 0 || i >= size) ? 0 : (dir ? m[i * size + a] : m[a * size + i]);
    for (let dir = 0; dir < 2; dir++) for (let a = 0; a < size; a++) {
      let run = 1;
      for (let i = 1; i <= size; i++) {
        if (i < size && at(a, i, dir) === at(a, i - 1, dir)) run++;
        else { if (run >= 5) res += 3 + run - 5; run = 1; }
      }
      for (let i = 0; i <= size - 7; i++) {
        if (at(a, i, dir) && !at(a, i + 1, dir) && at(a, i + 2, dir) && at(a, i + 3, dir) && at(a, i + 4, dir) && !at(a, i + 5, dir) && at(a, i + 6, dir)) {
          if (!at(a, i - 1, dir) && !at(a, i - 2, dir) && !at(a, i - 3, dir) && !at(a, i - 4, dir)) res += 40;
          if (!at(a, i + 7, dir) && !at(a, i + 8, dir) && !at(a, i + 9, dir) && !at(a, i + 10, dir)) res += 40;
        }
      }
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = m[y * size + x];
      if (c === m[y * size + x + 1] && c === m[(y + 1) * size + x] && c === m[(y + 1) * size + x + 1]) res += 3;
    }
    for (let i = 0; i < size * size; i++) dark += m[i];
    const total = size * size, k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    return res + Math.max(0, k) * 10;
  }

  /** Construiește matricea QR. opts: {ecc:'M', minVersion, maxVersion, mask, mode:'auto'|'numeric'|'alnum'|'byte', eci:false, boost:false} */
  function matrix(text, opts) {
    opts = opts || {};
    text = String(text == null ? '' : text);
    let e = ECC_IDX[(opts.ecc || 'M').toString().toUpperCase()];
    if (e === undefined) throw new Error('ecc?');
    const mode = ({numeric: 1, alnum: 2, alphanumeric: 2, byte: 4, utf8: 4})[opts.mode] || chooseMode(text);
    if (mode === 1 && !/^[0-9]*$/.test(text)) throw new Error('numeric?');
    const minV = Math.max(1, opts.minVersion | 0 || 1), maxV = Math.min(40, opts.maxVersion | 0 || 40);
    let ver = 0, bits = null;
    for (let v = minV; v <= maxV; v++) {
      const b = segmentBits(text, mode, v, !!opts.eci);
      if (b.length <= dataCodewords(v, e) * 8) { ver = v; bits = b; break; }
    }
    if (!ver) { const er = new Error(F.t ? F.t('qr', 'tooLong') : 'too long'); er.code = 'qr-too-long'; throw er; }
    if (opts.boost) for (let k = 3; k > e; k--) if (bits.length <= dataCodewords(ver, k) * 8) { e = k; break; }
    const cap = dataCodewords(ver, e) * 8;
    pushBits(bits, 0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) pushBits(bits, pad, 8);
    const data = new Uint8Array(bits.length / 8);
    for (let i = 0; i < bits.length; i++) data[i >>> 3] |= bits[i] << (7 - (i & 7));
    // blocuri + ECC + intercalare
    const L = layout(ver, e), gen = rsGen(L.el), blocks = [];
    let k = 0;
    for (let b = 0; b < L.nb; b++) {
      const d = data.subarray(k, k + L.dlen[b]); k += L.dlen[b];
      const blk = new Uint8Array(L.dlen[b] + L.el); blk.set(d); blk.set(rsRem(d, gen), L.dlen[b]); blocks.push(blk);
    }
    const stream = new Uint8Array(L.raw);
    for (let p = 0; p < L.map.length; p++) stream[p] = blocks[L.map[p][0]][L.map[p][1]];
    // plasare
    const sym = newSymbol(ver), size = sym.size, m = sym.m, fn = sym.fn;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
        if (!fn[y * size + x] && i < stream.length * 8) { m[y * size + x] = (stream[i >>> 3] >>> (7 - (i & 7))) & 1; i++; }
      }
    }
    const applyMask = mk => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y * size + x] && MASKS[mk](x, y)) m[y * size + x] ^= 1; };
    let best = -1, bestPen = Infinity;
    if (opts.mask != null && opts.mask >= 0 && opts.mask < 8) best = opts.mask | 0;
    else for (let mk = 0; mk < 8; mk++) {
      applyMask(mk); drawFormat(sym, e, mk);
      const p = penalty(m, size);
      if (p < bestPen) { bestPen = p; best = mk; }
      applyMask(mk);
    }
    applyMask(best); drawFormat(sym, e, best);
    const rows = [];
    for (let y = 0; y < size; y++) rows.push(m.slice(y * size, (y + 1) * size));
    return {size, version: ver, ecc: ECC_NAME[e], mask: best, mode: ({1: 'numeric', 2: 'alnum', 4: 'byte'})[mode], eccPerBlock: L.el, blocks: L.nb, dataCodewords: dataCodewords(ver, e), rows, get: (x, y) => rows[y][x]};
  }

  /** Câți octeți încap (mod octet) la versiunea/ECC dată. */
  function capacity(version, ecc) {
    const e = ECC_IDX[ecc || 'M'], bits = dataCodewords(version, e) * 8 - 4 - ccBits(4, version);
    return Math.max(0, Math.floor(bits / 8));
  }

  /* ---------- randare ---------- */
  function svg(text, opts) {
    opts = opts || {};
    const mt = matrix(text, opts), scale = opts.scale || 4, margin = opts.margin == null ? 2 : opts.margin;
    const n = mt.size + margin * 2, dark = opts.dark || '#000', light = opts.light || '#fff';
    let d = '';
    for (let y = 0; y < mt.size; y++) {
      const r = mt.rows[y];
      for (let x = 0; x < mt.size;) {
        if (!r[x]) { x++; continue; }
        let x2 = x; while (x2 < mt.size && r[x2]) x2++;
        d += 'M' + (x + margin) + ' ' + (y + margin) + 'h' + (x2 - x) + 'v1h-' + (x2 - x) + 'z'; x = x2;
      }
    }
    const label = opts.label == null ? (F.t ? F.t('qr', 'label') : 'QR') : opts.label;
    const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" width="' + n * scale + '" height="' + n * scale +
      '" shape-rendering="crispEdges" role="img" aria-label="' + esc(label) + '"><rect width="' + n + '" height="' + n + '" fill="' + esc(light) +
      '"/><path d="' + d + '" fill="' + esc(dark) + '"/></svg>';
  }
  /** ImageData-like {width,height,data} (RGBA). */
  function render(mt, opts) {
    opts = opts || {};
    const scale = opts.scale || 4, margin = opts.margin == null ? 2 : opts.margin, n = mt.size + margin * 2, W = n * scale;
    const data = new Uint8ClampedArray(W * W * 4).fill(255);
    for (let y = 0; y < mt.size; y++) for (let x = 0; x < mt.size; x++) if (mt.rows[y][x]) {
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const p = (((y + margin) * scale + dy) * W + (x + margin) * scale + dx) * 4;
        data[p] = data[p + 1] = data[p + 2] = 0;
      }
    }
    return {width: W, height: W, data};
  }
  function canvas(text, opts) {
    opts = opts || {};
    const img = render(matrix(text, opts), opts), c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    c.setAttribute('role', 'img'); c.setAttribute('aria-label', opts.label == null ? F.t('qr', 'label') : opts.label);
    return c;
  }

  /* ======================= DECODOR ======================= */

  function popcnt(x) { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }
  const FORMAT_TABLE = [];
  for (let e = 0; e < 4; e++) for (let mk = 0; mk < 8; mk++) FORMAT_TABLE.push({bits: formatBits(e, mk), e, mask: mk});
  const VERSION_TABLE = [];
  for (let v = 7; v <= 40; v++) VERSION_TABLE.push({bits: versionBits(v), v});

  function rsDecode(blk, nsym) {
    const n = blk.length, S = new Uint8Array(nsym); let any = 0;
    for (let j = 0; j < nsym; j++) { let s = 0; const a = EXP[j]; for (let i = 0; i < n; i++) s = mul(s, a) ^ blk[i]; S[j] = s; any |= s; }
    if (!any) return 0;
    let C = [1], B = [1], L = 0, m = 1, b = 1;
    for (let nn = 0; nn < nsym; nn++) {
      let d = S[nn]; for (let i = 1; i <= L; i++) d ^= mul(C[i] || 0, S[nn - i]);
      if (d === 0) { m++; continue; }
      const T = C.slice(), coef = mul(d, inv(b));
      while (C.length < B.length + m) C.push(0);
      for (let i = 0; i < B.length; i++) C[i + m] ^= mul(coef, B[i]);
      if (2 * L <= nn) { L = nn + 1 - L; B = T; b = d; m = 1; } else m++;
    }
    if (L * 2 > nsym) return -1;
    const pos = [];
    for (let k = 0; k < n; k++) {
      const x = EXP[(255 - k % 255) % 255]; let v = 0;
      for (let i = C.length - 1; i >= 0; i--) v = mul(v, x) ^ C[i];
      if (v === 0) pos.push(k);
    }
    if (pos.length !== L) return -1;
    const omega = new Uint8Array(nsym);
    for (let i = 0; i < nsym; i++) { let v = 0; for (let j = 0; j <= i && j < C.length; j++) v ^= mul(C[j], S[i - j]); omega[i] = v; }
    for (const k of pos) {
      const xinv = EXP[(255 - k % 255) % 255], X = EXP[k % 255];
      let num = 0; for (let i = nsym - 1; i >= 0; i--) num = mul(num, xinv) ^ omega[i];
      let den = 0; for (let i = 1; i < C.length; i += 2) { let p = 1; for (let t = 0; t < i - 1; t++) p = mul(p, xinv); den ^= mul(C[i], p); }
      if (!den) return -1;
      blk[n - 1 - k] ^= mul(X, mul(num, inv(den)));
    }
    for (let j = 0; j < nsym; j++) { let s = 0; const a = EXP[j]; for (let i = 0; i < n; i++) s = mul(s, a) ^ blk[i]; if (s) return -1; }
    return pos.length;
  }

  function decodeBytes(bytes, eci) {
    if (eci === 3 || eci === 1) return new TextDecoder('iso-8859-1').decode(bytes);
    if (eci === 20) { try { return new TextDecoder('shift_jis').decode(bytes); } catch (e) { /* ignorat */ } }
    try { return new TextDecoder('utf-8', {fatal: true}).decode(bytes); } catch (e) { return new TextDecoder('iso-8859-1').decode(bytes); }
  }
  function parseStream(data, ver) {
    let p = 0; const nb = data.length * 8;
    const read = n => { let v = 0; for (let i = 0; i < n; i++, p++) v = (v << 1) | ((data[p >>> 3] >>> (7 - (p & 7))) & 1); return v; };
    let text = '', eci = 0, bytesAll = [];
    while (p + 4 <= nb) {
      const mode = read(4);
      if (mode === 0) break;
      if (mode === 1) {
        let n = read(ccBits(1, ver));
        while (n >= 3) { if (p + 10 > nb) return null; const v = read(10); if (v > 999) return null; text += String(v).padStart(3, '0'); n -= 3; }
        if (n === 2) { if (p + 7 > nb) return null; const v = read(7); if (v > 99) return null; text += String(v).padStart(2, '0'); }
        else if (n === 1) { if (p + 4 > nb) return null; const v = read(4); if (v > 9) return null; text += String(v); }
      } else if (mode === 2) {
        let n = read(ccBits(2, ver));
        while (n >= 2) { if (p + 11 > nb) return null; const v = read(11); if (v >= 2025) return null; text += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45]; n -= 2; }
        if (n === 1) { if (p + 6 > nb) return null; const v = read(6); if (v >= 45) return null; text += ALNUM[v]; }
      } else if (mode === 4) {
        const n = read(ccBits(4, ver)); if (p + n * 8 > nb) return null;
        const bs = new Uint8Array(n); for (let i = 0; i < n; i++) bs[i] = read(8);
        bytesAll.push(...bs); text += decodeBytes(bs, eci);
      } else if (mode === 7) {
        let b0 = read(8);
        if ((b0 & 0x80) === 0) eci = b0; else if ((b0 & 0xC0) === 0x80) eci = ((b0 & 0x3F) << 8) | read(8); else eci = ((b0 & 0x1F) << 16) | read(16);
      } else if (mode === 8) {
        return null;                                               // Kanji: nesuportat (documentat)
      } else if (mode === 3) { read(16); } else if (mode === 5) { /* FNC1 */ } else if (mode === 9) { read(8); } else return null;
    }
    return {text, bytes: new Uint8Array(bytesAll)};
  }

  /** Decodează o matrice de biți (dim×dim, 1 = întunecat). */
  function decodeBits(bits, dim, ver0) {
    const attempt = bt => {
      const g = (x, y) => bt[y * dim + x];
      let c1 = 0, c2 = 0;
      for (let i = 0; i <= 5; i++) c1 |= g(8, i) << i;
      c1 |= g(8, 7) << 6; c1 |= g(8, 8) << 7; c1 |= g(7, 8) << 8;
      for (let i = 9; i < 15; i++) c1 |= g(14 - i, 8) << i;
      for (let i = 0; i < 8; i++) c2 |= g(dim - 1 - i, 8) << i;
      for (let i = 8; i < 15; i++) c2 |= g(8, dim - 15 + i) << i;
      let best = null, bd = 99;
      for (const f of FORMAT_TABLE) { const d = Math.min(popcnt(f.bits ^ c1), popcnt(f.bits ^ c2)); if (d < bd) { bd = d; best = f; } }
      if (!best || bd > 3) return null;
      const ver = ver0, fn = fnMask(ver), e = best.e, L = layout(ver, e);
      const stream = new Uint8Array(L.raw); let i = 0;
      for (let right = dim - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < dim; vert++) for (let j = 0; j < 2; j++) {
          const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? dim - 1 - vert : vert;
          if (!fn[y * dim + x] && i < L.raw * 8) {
            let v = bt[y * dim + x]; if (MASKS[best.mask](x, y)) v ^= 1;
            stream[i >>> 3] |= v << (7 - (i & 7)); i++;
          }
        }
      }
      const blocks = L.dlen.map(d => new Uint8Array(d + L.el));
      for (let p = 0; p < L.map.length; p++) blocks[L.map[p][0]][L.map[p][1]] = stream[p];
      let corrected = 0; const data = [];
      for (let b = 0; b < L.nb; b++) {
        const r = rsDecode(blocks[b], L.el); if (r < 0) return null;
        corrected += r; for (let k = 0; k < L.dlen[b]; k++) data.push(blocks[b][k]);
      }
      const res = parseStream(Uint8Array.from(data), ver);
      if (!res) return null;
      return {text: res.text, bytes: res.bytes, version: ver, ecc: ECC_NAME[e], mask: best.mask, corrected};
    };
    let r = attempt(bits);
    if (r) return r;
    const tr = new Uint8Array(dim * dim);                       // oglindit (transpus)
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) tr[x * dim + y] = bits[y * dim + x];
    r = attempt(tr);
    if (r) r.mirrored = true;
    return r;
  }

  /* --- imagine → biți --- */
  function toGray(img, maxDim) {
    let {data, width: w, height: h} = img; let f = 1;
    if (Math.max(w, h) > maxDim) f = Math.ceil(Math.max(w, h) / maxDim);
    const W = Math.floor(w / f), H = Math.floor(h / f), g = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0;
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
        const p = ((y * f + dy) * w + x * f + dx) * 4, a = data[p + 3];
        s += a < 128 ? 255 : (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
      }
      g[y * W + x] = (s / (f * f)) | 0;
    }
    return {g, W, H, f};
  }
  function binAdaptive(g, W, H) {
    const I = new Uint32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += g[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
    const r = Math.max(8, Math.round(Math.max(W, H) / 16)), out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
        const s = I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0];
        const mean = s / ((x1 - x0) * (y1 - y0));
        out[y * W + x] = g[y * W + x] < mean * 0.9 - 2 ? 1 : 0;
      }
    }
    return out;
  }
  function binOtsu(g, W, H) {
    const hist = new Float64Array(256); for (let i = 0; i < g.length; i++) hist[g[i]]++;
    let total = g.length, sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sB = 0, wB = 0, best = 0, th = 127;
    for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; th = t; } }
    const out = new Uint8Array(W * H); for (let i = 0; i < g.length; i++) out[i] = g[i] <= th ? 1 : 0;
    return out;
  }

  /* --- localizare finder patterns --- */
  function findFinders(bin, W, H) {
    const cands = [];
    const dk = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? bin[y * W + x] : 0;
    function crossV(cx, cy, total) {
      const x = Math.round(cx - 0.5); let y = Math.floor(cy);
      const c = [0, 0, 0, 0, 0];
      let yy = y; while (yy >= 0 && dk(x, yy)) { c[2]++; yy--; }
      if (yy < 0) return NaN;
      while (yy >= 0 && !dk(x, yy)) { c[1]++; yy--; }
      if (yy < 0) return NaN;
      while (yy >= 0 && dk(x, yy)) { c[0]++; yy--; }
      yy = y + 1; while (yy < H && dk(x, yy)) { c[2]++; yy++; }
      if (yy >= H) return NaN;
      while (yy < H && !dk(x, yy)) { c[3]++; yy++; }
      if (yy >= H) return NaN;
      while (yy < H && dk(x, yy)) { c[4]++; yy++; }
      const t = c[0] + c[1] + c[2] + c[3] + c[4];
      if (5 * Math.abs(t - total) >= 2 * total) return NaN;
      if (!ratioOk(c)) return NaN;
      let up = 0; { let q = y; while (q >= 0 && dk(x, q)) { up++; q--; } }
      return (y - up + 1) + c[2] / 2;
    }
    function crossH(cx, cy, total) {
      const y = Math.round(cy - 0.5); let x = Math.floor(cx);
      const c = [0, 0, 0, 0, 0];
      let xx = x; while (xx >= 0 && dk(xx, y)) { c[2]++; xx--; }
      if (xx < 0) return NaN;
      while (xx >= 0 && !dk(xx, y)) { c[1]++; xx--; }
      if (xx < 0) return NaN;
      while (xx >= 0 && dk(xx, y)) { c[0]++; xx--; }
      xx = x + 1; while (xx < W && dk(xx, y)) { c[2]++; xx++; }
      if (xx >= W) return NaN;
      while (xx < W && !dk(xx, y)) { c[3]++; xx++; }
      if (xx >= W) return NaN;
      while (xx < W && dk(xx, y)) { c[4]++; xx++; }
      const t = c[0] + c[1] + c[2] + c[3] + c[4];
      if (5 * Math.abs(t - total) >= total) return NaN;
      if (!ratioOk(c)) return NaN;
      let left = 0; { let q = x; while (q >= 0 && dk(q, y)) { left++; q--; } }
      return (x - left + 1) + c[2] / 2;
    }
    function ratioOk(c) {
      const t = c[0] + c[1] + c[2] + c[3] + c[4]; if (t < 7) return false;
      const ms = t / 7, v = ms / 2;
      return Math.abs(ms - c[0]) < v && Math.abs(ms - c[1]) < v && Math.abs(3 * ms - c[2]) < 3 * v && Math.abs(ms - c[3]) < v && Math.abs(ms - c[4]) < v;
    }
    const starts = [], lens = [], cols = [];
    for (let y = 0; y < H; y++) {
      starts.length = lens.length = cols.length = 0;
      let x = 0;
      while (x < W) { const c = bin[y * W + x]; let x2 = x + 1; while (x2 < W && bin[y * W + x2] === c) x2++; starts.push(x); lens.push(x2 - x); cols.push(c); x = x2; }
      for (let k = 0; k + 4 < lens.length; k++) {
        if (!cols[k]) continue;
        const c = [lens[k], lens[k + 1], lens[k + 2], lens[k + 3], lens[k + 4]];
        if (!ratioOk(c)) continue;
        const total = c[0] + c[1] + c[2] + c[3] + c[4];
        let cx = starts[k + 2] + lens[k + 2] / 2;
        const cy = crossV(cx, y + 0.5, total); if (isNaN(cy)) continue;
        const cx2 = crossH(cx, cy, total); if (isNaN(cx2)) continue;
        const ms = total / 7;
        let merged = false;
        for (const q of cands) {
          if (Math.abs(q.x - cx2) <= Math.max(ms, q.ms) && Math.abs(q.y - cy) <= Math.max(ms, q.ms) && Math.abs(q.ms - ms) <= Math.max(ms, q.ms) * 0.5) {
            const n = q.n; q.x = (q.x * n + cx2) / (n + 1); q.y = (q.y * n + cy) / (n + 1); q.ms = (q.ms * n + ms) / (n + 1); q.n++; merged = true; break;
          }
        }
        if (!merged) cands.push({x: cx2, y: cy, ms, n: 1});
      }
    }
    return cands.filter(c => c.n >= 2).sort((a, b) => b.n - a.n);
  }
  function pickTriples(cs) {
    cs = cs.slice(0, 9); const out = [];
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) for (let k = j + 1; k < cs.length; k++) {
      const t = [cs[i], cs[j], cs[k]], ms = t.map(c => c.ms);
      if (Math.max(...ms) / Math.min(...ms) > 1.7) continue;
      const d = [dist(t[1], t[2]), dist(t[0], t[2]), dist(t[0], t[1])];   // d[i] = latura opusă vârfului i
      const a = d.indexOf(Math.max(...d)), A = t[a], P = t[(a + 1) % 3], Q = t[(a + 2) % 3];
      const ap = dist(A, P), aq = dist(A, Q);
      const cos = ((P.x - A.x) * (Q.x - A.x) + (P.y - A.y) * (Q.y - A.y)) / (ap * aq);
      if (Math.abs(cos) > 0.4) continue;
      const diff = Math.abs(ap - aq) / Math.max(ap, aq); if (diff > 0.4) continue;
      const cross = (P.x - A.x) * (Q.y - A.y) - (P.y - A.y) * (Q.x - A.x);
      const TR = cross > 0 ? P : Q, BL = cross > 0 ? Q : P;
      out.push({tl: A, tr: TR, bl: BL, score: diff + Math.abs(cos) + (Math.max(...ms) / Math.min(...ms) - 1) - 0.02 * (A.n + P.n + Q.n)});
    }
    return out.sort((a, b) => a.score - b.score).slice(0, 5);
  }

  function homography(src, dst) {                                 // 4 puncte → matrice 3×3 (h33 = 1)
    const A = [];
    for (let i = 0; i < 4; i++) {
      const [u, v] = src[i], [x, y] = dst[i];
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
    }
    for (let c = 0; c < 8; c++) {
      let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-12) return null;
      [A[c], A[p]] = [A[p], A[c]];
      for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k]; }
    }
    const h = []; for (let i = 0; i < 8; i++) h.push(A[i][8] / A[i][i]);
    return h;
  }
  const project = (h, u, v) => { const w = h[6] * u + h[7] * v + 1; return [(h[0] * u + h[1] * v + h[2]) / w, (h[3] * u + h[4] * v + h[5]) / w]; };

  /** Mărimea modulului măsurată pe direcția a→b (corectă și la rotire): din centrul unui finder până la marginea lui (3,5 module). */
  function axisModule(bin, W, H, a, b) {
    const L = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
    const walk = sgn => {
      let tr = 0, cur = 1;
      for (let d = 0; d < a.ms * 8; d += 0.2) {
        const x = Math.floor(a.x + sgn * ux * d), y = Math.floor(a.y + sgn * uy * d);
        const v = (x >= 0 && y >= 0 && x < W && y < H) ? bin[y * W + x] : 0;
        if (v !== cur) { cur = v; if (++tr === 3) return d; }
      }
      return NaN;
    };
    const d1 = walk(1), d2 = walk(-1);
    if (isNaN(d1) || isNaN(d2)) return a.ms;
    return (d1 + d2) / 7;
  }
  function tryTriple(bin, W, H, tr) {
    const {tl, tr: TR, bl} = tr;
    const dTR = Math.hypot(TR.x - tl.x, TR.y - tl.y), dBL = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const msx = (axisModule(bin, W, H, tl, TR) + axisModule(bin, W, H, TR, tl)) / 2, msy = (axisModule(bin, W, H, tl, bl) + axisModule(bin, W, H, bl, tl)) / 2;
    const dimEst = ((dTR / msx) + (dBL / msy)) / 2 + 7, vEst = (dimEst - 17) / 4;
    const vs = [];
    for (const v of [Math.round(vEst), Math.floor(vEst), Math.ceil(vEst), Math.round(vEst) + 1, Math.round(vEst) - 1]) if (v >= 1 && v <= 40 && vs.indexOf(v) < 0) vs.push(v);
    for (const ver of vs.slice(0, 4)) {
      const dim = ver * 4 + 17;
      let hm = homography([[3.5, 3.5], [dim - 3.5, 3.5], [3.5, dim - 3.5], [dim - 3.5, dim - 3.5]],
        [[tl.x, tl.y], [TR.x, TR.y], [bl.x, bl.y], [TR.x + bl.x - tl.x, TR.y + bl.y - tl.y]]);
      if (!hm) continue;
      if (ver >= 2) {                                              // caută modelul de aliniere din colțul dreapta-jos
        const [px, py] = project(hm, dim - 6.5, dim - 6.5);
        const ex = [(TR.x - tl.x) / (dim - 7), (TR.y - tl.y) / (dim - 7)], ey = [(bl.x - tl.x) / (dim - 7), (bl.y - tl.y) / (dim - 7)];
        const mpx = Math.hypot(ex[0], ex[1]);
        let best = -1, bx = px, by = py;
        for (let sy = -6; sy <= 6; sy++) for (let sx = -6; sx <= 6; sx++) {
          const cx = px + (sx * ex[0] + sy * ey[0]) * 0.5, cy = py + (sx * ex[1] + sy * ey[1]) * 0.5;
          let sc = 0;
          for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
            const want = Math.max(Math.abs(i), Math.abs(j)) !== 1 ? 1 : 0;
            for (const [a, b] of [[0, 0], [-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
              const u = i + a, v = j + b;
              const x = Math.floor(cx + u * ex[0] + v * ey[0]), y = Math.floor(cy + u * ex[1] + v * ey[1]);
              if (x >= 0 && y >= 0 && x < W && y < H && bin[y * W + x] === want) sc++;
            }
          }
          if (sc > best) { best = sc; bx = cx; by = cy; }
        }
        if (best >= 105 && Math.hypot(bx - px, by - py) < 4 * mpx + 1) {
          const h2 = homography([[3.5, 3.5], [dim - 3.5, 3.5], [3.5, dim - 3.5], [dim - 6.5, dim - 6.5]], [[tl.x, tl.y], [TR.x, TR.y], [bl.x, bl.y], [bx, by]]);
          if (h2) hm = h2;
        }
      }
      const bits = new Uint8Array(dim * dim), off = 0.25;
      let oob = 0;
      for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) {
        let votes = 0;
        for (const [du, dv] of [[0, 0], [-off, 0], [off, 0], [0, -off], [0, off]]) {
          const [sx, sy] = project(hm, x + 0.5 + du, y + 0.5 + dv), ix = Math.floor(sx), iy = Math.floor(sy);
          if (ix < 0 || iy < 0 || ix >= W || iy >= H) { oob++; continue; }
          votes += bin[iy * W + ix];
        }
        bits[y * dim + x] = votes >= 3 ? 1 : 0;
      }
      if (oob > dim * dim) continue;
      const r = decodeBits(bits, dim, ver);
      if (r) {
        const c = (u, v) => project(hm, u, v);
        r.corners = [c(0, 0), c(dim, 0), c(0, dim), c(dim, dim)];
        return r;
      }
    }
    return null;
  }

  /** Decodează un ImageData (sau {width,height,data}). Returnează {text,bytes,version,ecc,mask,corrected,corners} sau null. */
  function decode(img, opts) {
    opts = opts || {};
    if (!img || !img.data || !img.width || !img.height) return null;
    const {g, W, H, f} = toGray(img, opts.maxDim || 1600);
    if (W < 21 || H < 21) return null;
    const bins = [() => binAdaptive(g, W, H), () => binOtsu(g, W, H)];
    for (const inv of opts.invert === false ? [false] : [false, true]) {
      for (const mk of bins) {
        const bin = mk(); if (inv) for (let i = 0; i < bin.length; i++) bin[i] ^= 1;
        const cs = findFinders(bin, W, H);
        if (cs.length < 3) continue;
        for (const t of pickTriples(cs)) {
          const r = tryTriple(bin, W, H, t);
          if (r) { if (f !== 1) r.corners = r.corners.map(p => [p[0] * f, p[1] * f]); r.inverted = inv; return r; }
        }
      }
    }
    return null;
  }

  /* ======================= SCANARE (cameră / fișier) ======================= */
  let active = null;
  function err(code, key) { const e = new Error(F.t ? F.t('qr', key) : key); e.code = code; return e; }

  async function decodeFrame(src, w, h, ctx, canvasEl, opts) {
    canvasEl.width = w; canvasEl.height = h;
    ctx.drawImage(src, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    if (opts.detector) {
      try { const r = await opts.detector.detect(canvasEl); if (r && r.length && r[0].rawValue) return r[0].rawValue; } catch (e) { /* cade pe decodorul propriu */ }
    }
    const r = decode(id, {});
    return r ? r.text : null;
  }
  function makeDetector() { try { return typeof BarcodeDetector !== 'undefined' ? new BarcodeDetector({formats: ['qr_code']}) : null; } catch (e) { return null; } }

  /** scan(File|Blob|HTMLImageElement) → Promise<string|null>;  scan(videoEl,{camera:true,until,onText,interval}) → Promise<string> */
  async function scan(source, opts) {
    opts = opts || {};
    const detector = opts.noDetector ? null : makeDetector();
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d', {willReadFrequently: true});
    if (typeof Blob !== 'undefined' && source instanceof Blob) {
      const bmp = await createImageBitmap(source);
      const sc = Math.min(1, (opts.maxDim || 1600) / Math.max(bmp.width, bmp.height));
      const t = await decodeFrame(bmp, Math.max(1, Math.round(bmp.width * sc)), Math.max(1, Math.round(bmp.height * sc)), ctx, cv, {detector});
      if (bmp.close) bmp.close();
      return t;
    }
    if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
      return decodeFrame(source, source.naturalWidth, source.naturalHeight, ctx, cv, {detector});
    }
    if (typeof HTMLVideoElement === 'undefined' || !(source instanceof HTMLVideoElement)) throw err('bad-source', 'badSource');
    stopScan();
    const video = source, job = {video, stream: null, stopped: false, timer: 0, reject: null};
    active = job;
    if (opts.camera === true) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { active = null; throw err('insecure', 'insecure'); }
      try {
        job.stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}, audio: false});
      } catch (e) {
        active = null;
        throw err(e && e.name === 'NotAllowedError' ? 'denied' : e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') ? 'no-camera' : 'camera-error',
          e && e.name === 'NotAllowedError' ? 'denied' : e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') ? 'noCamera' : 'cameraError');
      }
      if (job.stopped) { job.stream.getTracks().forEach(t => t.stop()); throw err('stopped', 'stopped'); }
      video.srcObject = job.stream; video.setAttribute('playsinline', ''); video.muted = true;
      try { await video.play(); } catch (e) { /* redarea poate fi blocată; cadrele se citesc oricum */ }
    } else if (!video.srcObject && !video.currentSrc) {
      active = null; throw err('not-requested', 'notRequested');
    }
    return new Promise((resolve, reject) => {
      job.reject = reject;
      const finish = (fn, v) => { if (job.done) return; job.done = true; clearTimeout(job.timer); if (active === job) active = null; if (job.stream) { job.stream.getTracks().forEach(t => t.stop()); if (video.srcObject === job.stream) video.srcObject = null; } fn(v); };
      job.finish = finish;
      const tick = async () => {
        if (job.stopped || job.done) return;
        try {
          if (video.readyState >= 2 && video.videoWidth) {
            const sc = Math.min(1, (opts.maxDim || 800) / Math.max(video.videoWidth, video.videoHeight));
            const t = await decodeFrame(video, Math.round(video.videoWidth * sc), Math.round(video.videoHeight * sc), ctx, cv, {detector});
            if (t && !job.done) {
              if (opts.onText) opts.onText(t);
              if (!opts.until || opts.until(t) === true) return finish(resolve, t);
            }
          }
        } catch (e) { return finish(reject, e); }
        job.timer = setTimeout(tick, opts.interval || 120);
      };
      tick();
    });
  }
  function stopScan() {
    const job = active; if (!job) return;
    job.stopped = true; active = null;
    if (job.finish) job.finish(job.reject || (() => {}), err('stopped', 'stopped'));
    else if (job.stream) job.stream.getTracks().forEach(t => t.stop());
  }

  F.qr = {matrix, svg, canvas, render, capacity, decode, scan, stopScan, ECC: ECC_NAME.slice(), maxBytes: capacity(40, 'L'), _internal: {decodeBits, rsDecode, layout, fnMask}};
})();
