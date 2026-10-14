// Fixture-uri generate octet cu octet (independente de codul aplicației) + parsere independente pentru verificări.
import zlib from 'node:zlib';

export const SECRET = {
  author: 'Ion Popescu-Secret', make: 'ExempluCam', model: 'Model-X100', software: 'EditorFoto 4.2', serial: 'SN-9988776655',
  comment: 'Comentariu-confidential-JPEG', xmpCreator: 'Maria Ionescu-Xmp', iptcByline: 'Fotograf-Iptc-Gheorghe', iptcKeyword: 'cuvant-cheie-iptc',
  lat: 44.4268, lon: 26.1025
};

/* ---------- TIFF/EXIF ---------- */
export function buildTiff({ le = false, ifd0 = [], exif = [], gps = [], thumb = null }) {
  const w16 = (b, o, v) => (le ? b.writeUInt16LE(v, o) : b.writeUInt16BE(v, o));
  const w32 = (b, o, v) => (le ? b.writeUInt32LE(v >>> 0, o) : b.writeUInt32BE(v >>> 0, o));
  const secs = []; const i0 = ifd0.slice();
  if (exif.length) i0.push({ t: 0x8769, ty: 'l', v: [0] }); if (gps.length) i0.push({ t: 0x8825, ty: 'l', v: [0] });
  secs.push({ n: 'ifd0', e: i0 }); if (exif.length) secs.push({ n: 'exif', e: exif.slice() }); if (gps.length) secs.push({ n: 'gps', e: gps.slice() });
  if (thumb) { secs[0].next = 'ifd1'; secs.push({ n: 'ifd1', e: [{ t: 0x201, ty: 'l', v: [0] }, { t: 0x202, ty: 'l', v: [thumb.length] }] }); }
  for (const s of secs) s.e.sort((a, b) => a.t - b.t);
  let pos = 8; const off = {}; for (const s of secs) { off[s.n] = pos; pos += 2 + 12 * s.e.length + 4; }
  const setv = (sec, tag, v) => { const e = secs.find(s => s.n === sec).e.find(x => x.t === tag); e.v = [v]; };
  if (exif.length) setv('ifd0', 0x8769, off.exif); if (gps.length) setv('ifd0', 0x8825, off.gps);
  const data = []; let dlen = 0; const out = [];
  const dataStart = pos; let thumbOff = 0;
  const reserve = (buf) => { const o = dataStart + dlen; data.push(buf); dlen += buf.length; if (buf.length % 2) { data.push(Buffer.from([0])); dlen++; } return o; };
  if (thumb) { thumbOff = reserve(thumb); setv('ifd1', 0x201, thumbOff); }
  for (const s of secs) {
    const b = Buffer.alloc(2 + 12 * s.e.length + 4); w16(b, 0, s.e.length);
    s.e.forEach((e, i) => {
      const o = 2 + i * 12; let bytes, type, count;
      const mk = (n, f) => { const bb = Buffer.alloc(n * e.v.length); e.v.forEach((x, k) => f(bb, k, x)); return bb; };
      if (e.ty === 'a') { bytes = Buffer.from(e.v + '\0', 'utf8'); type = 2; count = bytes.length; }
      else if (e.ty === 's') { bytes = mk(2, (bb, k, x) => w16(bb, k * 2, x)); type = 3; count = e.v.length; }
      else if (e.ty === 'l') { bytes = mk(4, (bb, k, x) => w32(bb, k * 4, x)); type = 4; count = e.v.length; }
      else if (e.ty === 'r') { bytes = mk(8, (bb, k, x) => { w32(bb, k * 8, x[0]); w32(bb, k * 8 + 4, x[1]); }); type = 5; count = e.v.length; }
      else { bytes = Buffer.from(e.v); type = 7; count = bytes.length; }
      w16(b, o, e.t); w16(b, o + 2, type); w32(b, o + 4, count);
      if (bytes.length <= 4) bytes.copy(b, o + 8); else w32(b, o + 8, reserve(bytes));
    });
    if (s.next) w32(b, 2 + 12 * s.e.length, off[s.next]);
    out.push(b);
  }
  const head = Buffer.from(le ? [0x49, 0x49, 42, 0, 8, 0, 0, 0] : [0x4D, 0x4D, 0, 42, 0, 0, 0, 8]);
  return Buffer.concat([head, ...out, ...data]);
}
const R = (a, b) => [a, b];
export function secretExif({ le = false, thumb = null, orientation = 6 } = {}) {
  const d = (v, a) => Math.floor(v), m = (v) => Math.floor((v - Math.floor(v)) * 60), s = (v) => Math.round((((v - Math.floor(v)) * 60) % 1) * 60 * 100);
  const lat = SECRET.lat, lon = SECRET.lon;
  return buildTiff({
    le, thumb,
    ifd0: [{ t: 0x10F, ty: 'a', v: SECRET.make }, { t: 0x110, ty: 'a', v: SECRET.model }, { t: 0x112, ty: 's', v: [orientation] }, { t: 0x131, ty: 'a', v: SECRET.software }, { t: 0x132, ty: 'a', v: '2026:03:14 09:30:00' }, { t: 0x13B, ty: 'a', v: SECRET.author }, { t: 0x11A, ty: 'r', v: [R(72, 1)] }],
    exif: [{ t: 0x9003, ty: 'a', v: '2026:03:14 09:30:00' }, { t: 0xA431, ty: 'a', v: SECRET.serial }, { t: 0x9286, ty: 'u', v: Buffer.concat([Buffer.from('ASCII\0\0\0'), Buffer.from('nota-privata-usercomment')]) }, { t: 0x829A, ty: 'r', v: [R(1, 250)] }],
    gps: [{ t: 1, ty: 'a', v: 'N' }, { t: 2, ty: 'r', v: [R(d(lat), 1), R(m(lat), 1), R(s(lat), 100)] }, { t: 3, ty: 'a', v: 'E' }, { t: 4, ty: 'r', v: [R(d(lon), 1), R(m(lon), 1), R(s(lon), 100)] }, { t: 6, ty: 'r', v: [R(8412, 100)] }]
  });
}
export function xmpPacket() {
  return Buffer.from('<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"><dc:creator><rdf:Seq><rdf:li>' + SECRET.xmpCreator + '</rdf:li></rdf:Seq></dc:creator><xmp:CreatorTool>' + SECRET.software + '</xmp:CreatorTool><photoshop:City>Bucuresti</photoshop:City></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>', 'utf8');
}
export function iccProfile(desc = 'Profil-Test-ICC') {
  const descTag = Buffer.concat([Buffer.from('desc'), Buffer.alloc(4), (() => { const b = Buffer.alloc(4); b.writeUInt32BE(desc.length + 1); return b; })(), Buffer.from(desc + '\0'), Buffer.alloc(12 + 67)]);
  const total = 128 + 4 + 12 + descTag.length; const b = Buffer.alloc(total);
  b.writeUInt32BE(total, 0); b.write('test', 4); b.writeUInt32BE(0x02400000, 8); b.write('mntr', 12); b.write('RGB ', 16); b.write('XYZ ', 20); b.writeUInt16BE(2024, 24); b.writeUInt16BE(1, 26); b.writeUInt16BE(1, 28); b.write('acsp', 36);
  b.writeUInt32BE(1, 128); b.write('desc', 132); b.writeUInt32BE(144, 136); b.writeUInt32BE(descTag.length, 140); descTag.copy(b, 144); return b;
}
export function iptcBlock() {
  const ds = (rec, num, s) => { const v = Buffer.from(s, 'utf8'); return Buffer.concat([Buffer.from([0x1C, rec, num, v.length >> 8, v.length & 255]), v]); };
  const iptc = Buffer.concat([ds(1, 90, '\x1b%G'), ds(2, 80, SECRET.iptcByline), ds(2, 25, SECRET.iptcKeyword), ds(2, 90, 'Cluj-Napoca'), ds(2, 116, 'Copyright Secret SRL')]);
  const pad = iptc.length % 2 ? Buffer.from([0]) : Buffer.alloc(0);
  const hdr = Buffer.alloc(12); hdr.write('8BIM', 0); hdr.writeUInt16BE(0x0404, 4); hdr[6] = 0; hdr[7] = 0; hdr.writeUInt32BE(iptc.length, 8);
  return Buffer.concat([Buffer.from('Photoshop 3.0\0'), hdr, iptc, pad]);
}

/* ---------- JPEG ---------- */
export function jpegSegs(buf) { // parser independent: [{m, s, e, name, data}]
  const out = []; let p = 2; if (buf[0] !== 0xFF || buf[1] !== 0xD8) throw new Error('not jpeg');
  for (;;) {
    if (p >= buf.length) break; if (buf[p] !== 0xFF) throw new Error('bad marker at ' + p);
    const m = buf[p + 1]; if (m === 0xD9) { out.push({ m, s: p, e: p + 2, name: 'EOI' }); out.trailing = buf.length - (p + 2); break; }
    const len = buf.readUInt16BE(p + 2); const seg = { m, s: p, e: p + 2 + len, data: buf.subarray(p + 4, p + 2 + len), name: m === 0xDA ? 'SOS' : m >= 0xE0 && m <= 0xEF ? 'APP' + (m - 0xE0) : m === 0xFE ? 'COM' : 'M' + m.toString(16) };
    if (m === 0xDA) { let q = seg.e; for (;;) { q = buf.indexOf(0xFF, q); const n = buf[q + 1]; if (n === 0 || (n >= 0xD0 && n <= 0xD7)) { q += 2; continue; } break; } seg.e = q; seg.scan = buf.subarray(p, q); }
    out.push(seg); p = seg.e;
  }
  return out;
}
export function jpegInject(base, { exif, xmp, iptc, com, icc, trailing, thumbExif }) {
  const segs = jpegSegs(base); const parts = [base.subarray(0, 2)]; let i = 0;
  if (segs[0].name === 'APP0') { parts.push(base.subarray(segs[0].s, segs[0].e)); i = 1; }
  const seg = (m, d) => { const b = Buffer.alloc(4); b[0] = 0xFF; b[1] = m; b.writeUInt16BE(d.length + 2, 2); return Buffer.concat([b, d]); };
  if (exif) parts.push(seg(0xE1, Buffer.concat([Buffer.from('Exif\0\0'), exif])));
  if (xmp) parts.push(seg(0xE1, Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0'), xmp])));
  if (icc) parts.push(seg(0xE2, Buffer.concat([Buffer.from('ICC_PROFILE\0'), Buffer.from([1, 1]), icc])));
  if (iptc) parts.push(seg(0xED, iptc));
  if (com) parts.push(seg(0xFE, Buffer.from(com)));
  for (; i < segs.length; i++) parts.push(base.subarray(segs[i].s, i === segs.length - 1 ? base.length : segs[i].e));
  if (trailing) parts.push(trailing);
  return Buffer.concat(parts);
}

/* ---------- PNG ---------- */
export function pngChunks(buf) {
  const out = []; let p = 8; if (buf.subarray(0, 8).toString('latin1') !== '\x89PNG\r\n\x1a\n') throw new Error('not png');
  while (p < buf.length) { const len = buf.readUInt32BE(p); const type = buf.toString('latin1', p + 4, p + 8); const data = buf.subarray(p + 8, p + 8 + len); const crc = buf.readUInt32BE(p + 8 + len); const ok = zlib.crc32(buf.subarray(p + 4, p + 8 + len)) === crc; out.push({ type, data, ok, s: p, e: p + 12 + len }); p += 12 + len; if (type === 'IEND') break; }
  out.trailing = buf.length - p; return out;
}
export function pngChunk(type, data) { const t = Buffer.from(type, 'latin1'); const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); t.copy(b, 4); data.copy(b, 8); b.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])), 8 + data.length); return b; }
export function pngInject(base, chunks, trailing) {
  const cs = pngChunks(base); const first = cs.find(c => c.type === 'IDAT');
  const parts = [base.subarray(0, first.s), ...chunks, base.subarray(first.s)]; if (trailing) parts.push(trailing); return Buffer.concat(parts);
}

/* ---------- WebP ---------- */
export function webpChunks(buf) { const out = []; let p = 12; while (p + 8 <= buf.length) { const t = buf.toString('latin1', p, p + 4); const len = buf.readUInt32LE(p + 4); out.push({ t, data: buf.subarray(p + 8, p + 8 + len), s: p }); p += 8 + len + (len & 1); } return out; }
export function webpWithMeta(base, { exif, xmp, icc }) {
  const ch = webpChunks(base); const img = ch.filter(c => c.t === 'VP8 ' || c.t === 'VP8L' || c.t === 'ALPH');
  // dimensiuni
  let w, h; const im = ch.find(c => c.t === 'VP8 ' || c.t === 'VP8L'); if (im.t === 'VP8 ') { w = im.data.readUInt16LE(6) & 0x3fff; h = im.data.readUInt16LE(8) & 0x3fff; } else { const d = im.data; w = 1 + (((d[2] & 0x3f) << 8) | d[1]); h = 1 + (((d[4] & 0xf) << 10) | (d[3] << 2) | ((d[2] & 0xc0) >> 6)); }
  const mk = (t, d) => { const b = Buffer.alloc(8); b.write(t, 0, 'latin1'); b.writeUInt32LE(d.length, 4); return Buffer.concat([b, d, d.length & 1 ? Buffer.from([0]) : Buffer.alloc(0)]); };
  let flags = 0; if (icc) flags |= 0x20; if (exif) flags |= 0x08; if (xmp) flags |= 0x04; if (ch.some(c => c.t === 'ALPH')) flags |= 0x10;
  const vp8x = Buffer.alloc(10); vp8x[0] = flags; vp8x.writeUIntLE(w - 1, 4, 3); vp8x.writeUIntLE(h - 1, 7, 3);
  const body = Buffer.concat([mk('VP8X', vp8x), icc ? mk('ICCP', icc) : Buffer.alloc(0), ...img.map(c => mk(c.t, c.data)), exif ? mk('EXIF', exif) : Buffer.alloc(0), xmp ? mk('XMP ', xmp) : Buffer.alloc(0)]);
  const hdr = Buffer.alloc(12); hdr.write('RIFF', 0); hdr.writeUInt32LE(4 + body.length, 4); hdr.write('WEBP', 8); return { buf: Buffer.concat([hdr, body]), w, h };
}

/* ---------- PDF ---------- */
export function buildPdf({ info = true, xmp = true, extraInfoUpdate = false } = {}) {
  const xmpStr = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><dc:creator><rdf:Seq><rdf:li>' + SECRET.xmpCreator + '</rdf:li></rdf:Seq></dc:creator><pdf:Producer>ProducatorPdf-Secret</pdf:Producer></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
  const content = 'BT /F1 18 Tf 20 70 Td (Text vizibil ramane) Tj ET';
  const objs = [null, '<< /Type /Catalog /Pages 2 0 R' + (xmp ? ' /Metadata 5 0 R' : '') + ' >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 6 0 R >> >> >>',
    '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream', '<< /Type /Metadata /Subtype /XML /Length ' + xmpStr.length + ' >>\nstream\n' + xmpStr + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    "<< /Title (Titlu-Secret-PDF) /Author (" + SECRET.author + ") /Creator (CreatorPdf-Secret) /Producer (ProducatorPdf-Secret) /CreationDate (D:20260314093000+02'00') /Custom (Valoare-Custom-Secret) /Subject <FEFF0053006500630072006500740055> >>"];
  let out = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1'); const offs = [];
  const nobj = info ? objs.length : objs.length - 1;
  for (let i = 1; i < nobj; i++) { offs[i] = out.length; out = Buffer.concat([out, Buffer.from(i + ' 0 obj\n' + objs[i] + '\nendobj\n', 'latin1')]); }
  const xr = out.length; let x = 'xref\n0 ' + nobj + '\n0000000000 65535 f \n'; for (let i = 1; i < nobj; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  x += 'trailer\n<< /Size ' + nobj + ' /Root 1 0 R' + (info ? ' /Info 7 0 R' : '') + ' >>\nstartxref\n' + xr + '\n%%EOF\n'; out = Buffer.concat([out, Buffer.from(x, 'latin1')]);
  if (extraInfoUpdate) { // actualizare incrementală: nou /Info (obiect 8) cu alt autor; vechiul rămâne în fișier
    const o8 = out.length; const body = '8 0 obj\n<< /Author (Autor-Din-Actualizare-Secret) /Title (Titlu-Nou-Secret) >>\nendobj\n'; out = Buffer.concat([out, Buffer.from(body, 'latin1')]);
    const x2 = out.length; const t = 'xref\n8 1\n' + String(o8).padStart(10, '0') + ' 00000 n \ntrailer\n<< /Size 9 /Root 1 0 R /Info 8 0 R /Prev ' + xr + ' >>\nstartxref\n' + x2 + '\n%%EOF\n'; out = Buffer.concat([out, Buffer.from(t, 'latin1')]);
  }
  return out;
}

/* ---------- SVG ---------- */
export function inkscapeSvg({ imageB64 } = {}) {
  return Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!-- Created with Inkscape (http://www.inkscape.org/) de Comentariu-Svg-Secret -->\n<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="100" height="100" viewBox="0 0 100 100" version="1.1" inkscape:version="1.2.2" sodipodi:docname="plan-docname-secret.svg" inkscape:export-filename="C:\\Users\\IonSecret\\Desktop\\x.png">\n  <title id="t1">Titlu-Svg-Vizibil</title>\n  <desc>Descriere-Svg</desc>\n  <metadata id="metadata5"><rdf:RDF><cc:Work rdf:about=""><dc:format>image/svg+xml</dc:format><dc:creator><cc:Agent><dc:title>Autor-Svg-Secret</dc:title></cc:Agent></dc:creator></cc:Work></rdf:RDF></metadata>\n  <sodipodi:namedview id="base" pagecolor="#ffffff" inkscape:zoom="1" inkscape:cx="50"/>\n  <g inkscape:label="Strat-Secret" inkscape:groupmode="layer" id="layer1"><rect id="r1" x="10" y="10" width="50" height="50" fill="#ff0000"/>' + (imageB64 ? '<image id="im1" x="60" y="60" width="30" height="30" xlink:href="data:image/jpeg;base64,' + imageB64 + '"/>' : '') + '</g>\n</svg>\n', 'utf8');
}
