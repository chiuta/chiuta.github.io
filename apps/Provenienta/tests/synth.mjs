// Generator de fișiere C2PA SINTETICE, scris de autor după descrierea specificației C2PA/JUMBF/COSE.
// NU sunt eșantioane oficiale și NU provin de la aparate sau servicii reale. Servesc doar la testarea parserului și a verificării.
// Folosește doar `node:crypto` și `node:zlib`; ASN.1/X.509, CBOR și JUMBF sunt scrise aici (independent de codul aplicației).
import crypto from 'node:crypto';
import zlib from 'node:zlib';

// ---------------------------------------------------------------- CBOR (encoder)
export class Tag { constructor(tag, value) { this.tag = tag; this.value = value; } }
function head(major, n) {
  const m = major << 5;
  if (typeof n === 'bigint') { const b = Buffer.alloc(9); b[0] = m | 27; b.writeBigUInt64BE(n, 1); return b; }
  if (n < 24) return Buffer.from([m | n]);
  if (n < 256) return Buffer.from([m | 24, n]);
  if (n < 65536) { const b = Buffer.alloc(3); b[0] = m | 25; b.writeUInt16BE(n, 1); return b; }
  if (n < 4294967296) { const b = Buffer.alloc(5); b[0] = m | 26; b.writeUInt32BE(n, 1); return b; }
  const b = Buffer.alloc(9); b[0] = m | 27; b.writeBigUInt64BE(BigInt(n), 1); return b;
}
export function cbor(v) {
  if (v === null) return Buffer.from([0xf6]);
  if (v === undefined) return Buffer.from([0xf7]);
  if (v === true) return Buffer.from([0xf5]);
  if (v === false) return Buffer.from([0xf4]);
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v >= 0 ? head(0, v) : head(1, -1 - v);
    const b = Buffer.alloc(9); b[0] = 0xfb; b.writeDoubleBE(v, 1); return b;
  }
  if (typeof v === 'bigint') return v >= 0n ? head(0, v) : head(1, -1n - v);
  if (typeof v === 'string') { const s = Buffer.from(v, 'utf8'); return Buffer.concat([head(3, s.length), s]); }
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) { const s = Buffer.from(v); return Buffer.concat([head(2, s.length), s]); }
  if (Array.isArray(v)) return Buffer.concat([head(4, v.length), ...v.map(cbor)]);
  if (v instanceof Tag) return Buffer.concat([head(6, v.tag), cbor(v.value)]);
  if (v instanceof Map) return Buffer.concat([head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
  const e = Object.entries(v).filter(([, x]) => x !== undefined);
  return Buffer.concat([head(5, e.length), ...e.flatMap(([k, x]) => [cbor(k), cbor(x)])]);
}

// ---------------------------------------------------------------- ASN.1 / X.509 (encoder)
const lenB = (n) => { if (n < 128) return Buffer.from([n]); const a = []; let x = n; while (x > 0) { a.unshift(x & 255); x = Math.floor(x / 256); } return Buffer.from([0x80 | a.length, ...a]); };
export const tlv = (tag, ...c) => { const body = Buffer.concat(c); return Buffer.concat([Buffer.from([tag]), lenB(body.length), body]); };
export const seq = (...c) => tlv(0x30, ...c);
export const set = (...c) => tlv(0x31, ...c);
export const oid = (s) => { const p = s.split('.').map(Number); const out = [p[0] * 40 + p[1]]; for (const v of p.slice(2)) { const t = [v & 127]; let x = Math.floor(v / 128); while (x > 0) { t.unshift(128 | (x & 127)); x = Math.floor(x / 128); } out.push(...t); } return tlv(6, Buffer.from(out)); };
export const int = (n) => { let b; if (Buffer.isBuffer(n)) b = n; else { let x = BigInt(n); const a = []; do { a.unshift(Number(x & 255n)); x >>= 8n; } while (x > 0n); b = Buffer.from(a); } if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]); return tlv(2, b); };
const utf8 = (s) => tlv(0x0c, Buffer.from(s, 'utf8'));
const printable = (s) => tlv(0x13, Buffer.from(s, 'ascii'));
const bitstr = (b, unused = 0) => tlv(3, Buffer.from([unused]), b);
const octet = (b) => tlv(4, b);
const boolT = (v) => tlv(1, Buffer.from([v ? 0xff : 0]));
const nul = () => Buffer.from([5, 0]);
const ctx = (n, ...c) => tlv(0xa0 | n, ...c);
const pad2 = (n) => String(n).padStart(2, '0');
const timeOf = (d) => { const y = d.getUTCFullYear(); const core = `${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`; return y < 2050 ? tlv(0x17, Buffer.from(String(y).slice(2) + core)) : tlv(0x18, Buffer.from(String(y) + core)); };

const OIDS = {
  'ecdsa-sha256': '1.2.840.10045.4.3.2', 'ecdsa-sha384': '1.2.840.10045.4.3.3', 'ecdsa-sha512': '1.2.840.10045.4.3.4',
  'rsa-sha256': '1.2.840.113549.1.1.11', 'ed25519': '1.3.101.112',
};
const RDN = { CN: '2.5.4.3', O: '2.5.4.10', OU: '2.5.4.11', C: '2.5.4.6', L: '2.5.4.7', ST: '2.5.4.8' };
const name = (o) => seq(...Object.entries(o).map(([k, v]) => set(seq(oid(RDN[k]), k === 'C' ? printable(v) : utf8(v)))));
const algId = (a) => a === 'rsa-sha256' ? seq(oid(OIDS[a]), nul()) : seq(oid(OIDS[a]));

export function genKey(kind) {
  switch (kind) {
    case 'ES256': return crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    case 'ES384': return crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
    case 'ES512': return crypto.generateKeyPairSync('ec', { namedCurve: 'secp521r1' });
    case 'PS256': case 'PS384': case 'PS512': case 'RS': return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    case 'Ed25519': return crypto.generateKeyPairSync('ed25519');
    default: throw new Error('alg necunoscut ' + kind);
  }
}
const certSigAlgFor = (key) => { const t = key.asymmetricKeyType; if (t === 'rsa') return 'rsa-sha256'; if (t === 'ed25519') return 'ed25519'; const c = key.asymmetricKeyDetails.namedCurve; return c === 'prime256v1' ? 'ecdsa-sha256' : c === 'secp384r1' ? 'ecdsa-sha384' : 'ecdsa-sha512'; };
const hashOfCertAlg = (a) => a === 'ed25519' ? null : a.endsWith('384') ? 'sha384' : a.endsWith('512') ? 'sha512' : 'sha256';

export function makeCert({ subject, issuer, pubKey, issuerKey, notBefore = new Date(Date.UTC(2026, 0, 1)), notAfter = new Date(Date.UTC(2126, 0, 1)), ca = false, serial = 1, eku = ['1.3.6.1.5.5.7.3.4'], ku = ['digitalSignature'] }) {
  const spki = pubKey.export({ type: 'spki', format: 'der' });
  const sigAlg = certSigAlgFor(issuerKey);
  const kuNames = ['digitalSignature', 'nonRepudiation', 'keyEncipherment', 'dataEncipherment', 'keyAgreement', 'keyCertSign', 'cRLSign'];
  let kbits = 0; for (const k of ku) kbits |= 0x80 >> kuNames.indexOf(k);
  const exts = [
    seq(oid('2.5.29.19'), boolT(true), octet(seq(...(ca ? [boolT(true)] : [])))),
    seq(oid('2.5.29.15'), boolT(true), octet(bitstr(Buffer.from([kbits]), 1))),
    ...(eku.length ? [seq(oid('2.5.29.37'), octet(seq(...eku.map(oid))))] : []),
    seq(oid('2.5.29.14'), octet(octet(crypto.createHash('sha1').update(spki).digest()))),
  ];
  const tbs = seq(ctx(0, int(2)), int(serial), algId(sigAlg), name(issuer), seq(timeOf(notBefore), timeOf(notAfter)), name(subject), spki, ctx(3, seq(...exts)));
  const h = hashOfCertAlg(sigAlg);
  const sig = h ? crypto.sign(h, tbs, { key: issuerKey, dsaEncoding: 'der' }) : crypto.sign(null, tbs, issuerKey);
  return seq(tbs, algId(sigAlg), bitstr(sig));
}

/** Semnatar: { alg, key, certs: [DER...] }. chain: 'self' | 'root' | 'broken' | 'none' (fără x5chain) */
export function makeSigner({ alg = 'ES256', cn = 'Provenienta Test Signer', org = 'Provenienta Synthetic Tests', chain = 'root', notBefore, notAfter, ca = false } = {}) {
  const { publicKey, privateKey } = genKey(alg);
  const subject = { CN: cn, O: org, C: 'RO' };
  if (chain === 'self' || chain === 'none') {
    const cert = makeCert({ subject, issuer: subject, pubKey: publicKey, issuerKey: privateKey, notBefore, notAfter, ca });
    return { alg, key: privateKey, certs: chain === 'none' ? [] : [cert], leaf: cert };
  }
  const root = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const rootName = { CN: 'Provenienta Synthetic Test Root CA', O: org, C: 'RO' };
  const rootCert = makeCert({ subject: rootName, issuer: rootName, pubKey: root.publicKey, issuerKey: root.privateKey, ca: true, ku: ['keyCertSign', 'cRLSign'], eku: [], serial: 99 });
  // 'broken': frunza este semnată de o ALTĂ cheie decât cea a rădăcinii inclusă în lanț
  const other = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const leaf = makeCert({ subject, issuer: rootName, pubKey: publicKey, issuerKey: chain === 'broken' ? other.privateKey : root.privateKey, notBefore, notAfter, serial: 7 });
  return { alg, key: privateKey, certs: [leaf, rootCert], leaf };
}

// ---------------------------------------------------------------- COSE_Sign1
const COSE_ALG = { ES256: -7, ES384: -35, ES512: -36, PS256: -37, PS384: -38, PS512: -39, Ed25519: -8 };
export function coseSign1(signer, payload, { x5inProtected = false, tamperSig = false, tst = null } = {}) {
  const x5 = signer.certs.length ? signer.certs : null;
  const prot = cbor(new Map([[1, COSE_ALG[signer.alg]], ...(x5inProtected && x5 ? [[33, x5]] : [])]));
  const sigStruct = cbor(['Signature1', prot, Buffer.alloc(0), payload]);
  const a = signer.alg;
  let sig;
  if (a.startsWith('ES')) sig = crypto.sign(a === 'ES256' ? 'sha256' : a === 'ES384' ? 'sha384' : 'sha512', sigStruct, { key: signer.key, dsaEncoding: 'ieee-p1363' });
  else if (a.startsWith('PS')) { const bits = a.slice(2); sig = crypto.sign('sha' + bits, sigStruct, { key: signer.key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: bits / 8 }); }
  else sig = crypto.sign(null, sigStruct, signer.key);
  sig = Buffer.from(sig);
  if (tamperSig) sig[Math.floor(sig.length / 2)] ^= 0x01;
  const unprot = new Map(); if (!x5inProtected && x5) unprot.set(33, x5); if (tst) unprot.set('sigTst', tst);
  return cbor(new Tag(18, [prot, unprot, null, sig]));
}

// ---------------------------------------------------------------- JUMBF (writer)
const SUF = '00110010800000aa00389b71';
const U = (four) => Buffer.from(Buffer.from(four, 'ascii').toString('hex') + SUF, 'hex');
export const UUIDS = { store: U('c2pa'), manifest: U('c2ma'), assertions: U('c2as'), claim: U('c2cl'), signature: U('c2cs'), cbor: U('cbor'), json: U('json'), bfdb: Buffer.from('40CB0C32BB8A489DA70B2AD6F47F4369', 'hex') };
export const box = (type, ...p) => { const body = Buffer.concat(p); const h = Buffer.alloc(8); h.writeUInt32BE(body.length + 8, 0); h.write(type, 4, 'ascii'); return Buffer.concat([h, body]); };
export const jumd = (uuid, label) => box('jumd', uuid, Buffer.from([0x03]), Buffer.from(label + '\0', 'utf8'));
export const jumb = (uuid, label, ...children) => box('jumb', jumd(uuid, label), ...children);
const payloadOf = (b) => b.subarray(8);

const sha = (alg, ...parts) => crypto.createHash(alg).update(Buffer.concat(parts)).digest();
const IPTC = 'http://cv.iptc.org/newscodes/digitalsourcetype/';
export const SRC = { ai: IPTC + 'trainedAlgorithmicMedia', composite: IPTC + 'compositeWithTrainedAlgorithmicMedia', capture: IPTC + 'digitalCapture' };

/** assertion: {label, cbor:value} | {label, json:value} | {label, bin:Buffer, mime} */
function assertionBox(a) {
  if (a.cbor !== undefined) return jumb(UUIDS.cbor, a.label, box('cbor', cbor(a.cbor)));
  if (a.json !== undefined) return jumb(UUIDS.json, a.label, box('json', Buffer.from(JSON.stringify(a.json))));
  return jumb(UUIDS.bfdb, a.label, box('bfdb', Buffer.from([0]), Buffer.from(a.mime + '\0')), box('bidb', a.bin));
}

/**
 * spec: {urn, version(1|2), title, format, generator, assertions:[…], signer, hashAlg, hashAssertion:{label,value}, tamper:{sig, assertionHash, claimByte}, x5inProtected, tst}
 * Returnează { box (manifestul jumb), payloadHash }.
 */
export function makeManifest(spec) {
  const alg = spec.hashAlg || 'sha256';
  const version = spec.version || 1;
  const all = [...spec.assertions, ...(spec.hashAssertion ? [spec.hashAssertion] : [])];
  const boxes = all.map(assertionBox);
  const uris = all.map((a, i) => ({ url: 'self#jumbf=c2pa.assertions/' + a.label, hash: sha(alg, payloadOf(boxes[i])) }));
  if (spec.tamper?.assertionHash) uris[0].hash[0] ^= 0xff;
  const claimV1 = { 'dc:title': spec.title || 'synthetic.jpg', 'dc:format': spec.format || 'image/jpeg', instanceID: 'xmp:iid:' + crypto.randomUUID(), claim_generator: spec.generator || 'Provenienta-synth/1.0', claim_generator_info: [{ name: spec.generatorName || 'Provenienta synthetic generator', version: '1.0' }], signature: 'self#jumbf=c2pa.signature', assertions: uris, alg };
  const claimV2 = { instanceID: 'xmp:iid:' + crypto.randomUUID(), claim_generator_info: { name: spec.generatorName || 'Provenienta synthetic generator', version: '1.0' }, 'dc:title': spec.title || 'synthetic.jpg', signature: 'self#jumbf=c2pa.signature', created_assertions: uris, alg };
  let claimBytes = cbor(version === 2 ? claimV2 : claimV1);
  const sigBytes = coseSign1(spec.signer, claimBytes, { x5inProtected: spec.x5inProtected, tamperSig: spec.tamper?.sig, tst: spec.tst });
  if (spec.tamper?.claimByte) { claimBytes = Buffer.from(claimBytes); claimBytes[claimBytes.length - 3] ^= 0x01; }
  const claimBox = jumb(UUIDS.claim, version === 2 ? 'c2pa.claim.v2' : 'c2pa.claim', box('cbor', claimBytes));
  const sigBox = jumb(UUIDS.signature, 'c2pa.signature', box('cbor', sigBytes));
  const asBox = jumb(UUIDS.assertions, 'c2pa.assertions', ...boxes);
  const mb = jumb(UUIDS.manifest, spec.urn || 'urn:uuid:' + crypto.randomUUID(), asBox, claimBox, sigBox);
  return { box: mb, claimBytes, sigBytes };
}
export const wrapStore = (manifestBoxes) => jumb(UUIDS.store, 'c2pa', ...manifestBoxes);

// ---------------------------------------------------------------- containere
const hashExcl = (alg, file, excl) => {
  const parts = []; let p = 0;
  for (const e of [...excl].sort((a, b) => a.start - b.start)) { parts.push(file.subarray(p, e.start)); p = e.start + e.length; }
  parts.push(file.subarray(p)); return sha(alg, ...parts);
};
export const hashRanges = hashExcl;

function insertJpeg(base, store) {
  let at = 2;
  if (base[2] === 0xff && base[3] === 0xe0) at = 4 + base.readUInt16BE(4); // după APP0
  const segs = []; let z = 1;
  const first = store.subarray(0, 65525); segs.push(first);
  let rest = store.subarray(65525);
  const hdr8 = store.subarray(0, 8);
  while (rest.length) { segs.push(Buffer.concat([hdr8, rest.subarray(0, 65517)])); rest = rest.subarray(65517); }
  const out = segs.map((d) => { const s = Buffer.alloc(12); s[0] = 0xff; s[1] = 0xeb; s.writeUInt16BE(d.length + 10, 2); s.write('JP', 4, 'ascii'); s.writeUInt16BE(1, 6); s.writeUInt32BE(z++, 8); return Buffer.concat([s, d]); });
  const all = Buffer.concat(out);
  return { file: Buffer.concat([base.subarray(0, at), all, base.subarray(at)]), range: { start: at, length: all.length } };
}
function insertPng(base, store) {
  const at = 33; const c = Buffer.alloc(8); c.writeUInt32BE(store.length, 0); c.write('caBX', 4, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([c.subarray(4), store])) >>> 0);
  const chunk = Buffer.concat([c, store, crc]);
  return { file: Buffer.concat([base.subarray(0, at), chunk, base.subarray(at)]), range: { start: at, length: chunk.length } };
}
function insertWebp(base, store) {
  const pad = store.length & 1 ? Buffer.from([0]) : Buffer.alloc(0);
  const c = Buffer.alloc(8); c.write('C2PA', 0, 'ascii'); c.writeUInt32LE(store.length, 4);
  const chunk = Buffer.concat([c, store, pad]);
  const file = Buffer.concat([base, chunk]); file.writeUInt32LE(file.length - 8, 4);
  return { file, range: { start: base.length, length: chunk.length } };
}
function insertSvg(base, store) {
  const s = base.toString('latin1'); const i = s.lastIndexOf('</svg>');
  const el = `<c2pa:manifest xmlns:c2pa="http://c2pa.org/manifest">${store.toString('base64')}</c2pa:manifest>`;
  const ins = `<metadata>${el}</metadata>`;
  const start = i + '<metadata>'.length;
  return { file: Buffer.from(s.slice(0, i) + ins + s.slice(i), 'latin1'), range: { start, length: el.length } };
}
const C2PA_BMFF_UUID = Buffer.from('d8fec3d61b0e483c92975828877ec481', 'hex');
function insertBmff(base, store) {
  const ftypLen = base.readUInt32BE(0);
  const body = Buffer.concat([C2PA_BMFF_UUID, Buffer.alloc(4), Buffer.from('manifest\0'), Buffer.alloc(8), store]);
  const b = box('uuid', body);
  return { file: Buffer.concat([base.subarray(0, ftypLen), b, base.subarray(ftypLen)]), range: { start: ftypLen, length: b.length } };
}
const INSERT = { jpeg: insertJpeg, png: insertPng, webp: insertWebp, svg: insertSvg, mp4: insertBmff };

export function topBoxes(buf) { const out = []; let p = 0; while (p + 8 <= buf.length) { let sz = buf.readUInt32BE(p); if (sz === 0) sz = buf.length - p; out.push({ type: buf.toString('latin1', p + 4, p + 8), start: p, end: p + sz }); p += sz; } return out; }

/**
 * kind: 'jpeg'|'png'|'webp'|'svg'|'mp4'. opts: {signer, version, assertions, prior:[manifestBox…], hashAlg, tamper, title…}
 * Returnează { file, store, active, range }.
 */
export function signAsset(kind, base, opts) {
  const alg = opts.hashAlg || 'sha256';
  const bmff = kind === 'mp4';
  let excl = { start: 0, length: 0 }; let hash = Buffer.alloc(sha(alg, Buffer.alloc(0)).length);
  const hdName = bmff ? (opts.version === 2 ? 'c2pa.hash.bmff.v2' : 'c2pa.hash.bmff') : 'c2pa.hash.data';
  for (let it = 0; it < 8; it++) {
    const hashAssertion = bmff
      ? { label: hdName, cbor: { exclusions: [{ xpath: '/uuid', length: null, data: [{ offset: 8, value: C2PA_BMFF_UUID }], subset: null, version: null, flags: null, exact: null }, { xpath: '/ftyp', length: null, data: null, subset: null, version: null, flags: null, exact: null }, { xpath: '/mfra', length: null, data: null, subset: null, version: null, flags: null, exact: null }], alg, hash, name: 'jumbf manifest' } }
      : { label: hdName, cbor: { exclusions: [{ start: excl.start, length: excl.length }], name: 'jumbf manifest', alg, hash, pad: Buffer.alloc(0) } };
    const active = makeManifest({ ...opts, hashAssertion, format: opts.format || ({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4' })[kind] });
    const store = wrapStore([...(opts.prior || []), active.box]);
    const ins = INSERT[kind](base, store);
    let h;
    if (bmff) {
      const bx = topBoxes(ins.file).filter((b) => b.type !== 'ftyp' && b.type !== 'uuid' && b.type !== 'mfra');
      h = sha(alg, ...bx.map((b) => ins.file.subarray(b.start, b.end)));
      if (h.equals(hash)) return { file: ins.file, store, active, range: ins.range };
      hash = h; continue;
    }
    h = hashExcl(alg, ins.file, [ins.range]);
    if (excl.start === ins.range.start && excl.length === ins.range.length && h.equals(hash)) return { file: ins.file, store, active, range: ins.range };
    excl = { start: ins.range.start, length: ins.range.length }; hash = h;
  }
  throw new Error('nu converge');
}

// ---------------------------------------------------------------- baze minimale
export function baseMp4() {
  const ftyp = box('ftyp', Buffer.from('isom'), Buffer.from([0, 0, 2, 0]), Buffer.from('isomiso2mp41'));
  const mvhd = box('mvhd', Buffer.alloc(100));
  const moov = box('moov', mvhd);
  const mdat = box('mdat', Buffer.from('Provenienta synthetic media payload 0123456789'));
  return Buffer.concat([ftyp, moov, mdat]);
}
export function baseWebp() {
  const chunk = Buffer.concat([Buffer.from('VP8L'), Buffer.from([8, 0, 0, 0]), Buffer.from([0x2f, 0, 0, 0, 0, 0x88, 0x88, 0x08])]);
  const b = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), chunk]); b.writeUInt32LE(b.length - 8, 4); return b;
}
export function baseSvg() { return Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#0b5c8a"/><circle cx="32" cy="32" r="18" fill="#fff"/></svg>\n', 'latin1'); }

// ---------------------------------------------------------------- scenarii uzuale
export const actionsAssertion = ({ v2 = false, source = SRC.ai, agent = 'Provenienta synthetic editor 1.0' } = {}) => ({
  label: v2 ? 'c2pa.actions.v2' : 'c2pa.actions',
  cbor: { actions: [
    { action: 'c2pa.created', digitalSourceType: source, softwareAgent: v2 ? { name: agent, version: '1.0' } : agent, when: '2026-10-14T09:30:00Z' },
    { action: 'c2pa.edited', softwareAgent: v2 ? { name: agent, version: '1.0' } : agent, when: '2026-10-14T09:45:00Z', parameters: { 'ingredient': 'x' } },
    { action: 'c2pa.placed', description: 'element suprapus', when: '2026-10-14T09:50:00Z' },
  ] },
});
export const exifAssertion = () => ({ label: 'stds.exif', json: { '@context': { exif: 'http://ns.adobe.com/exif/1.0/' }, 'exif:Make': 'SynthCam', 'exif:Model': 'T-1 (sintetic)' } });
export const thumbAssertion = (jpeg) => ({ label: 'c2pa.thumbnail.claim.jpeg', bin: jpeg, mime: 'image/jpeg' });
