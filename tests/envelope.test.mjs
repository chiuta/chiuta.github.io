// Teste pentru tools/fff-envelope.js și tools/fff-seif.js (Node, fără browser): schemă, validare, compat fff:1 ↔ canonic fff:2,
// interoperare cu FFF.bridge din kit, semnătură HMAC, pachet link/QR, BroadcastChannel, paritate i18n, seif criptat (PBKDF2 + AES-GCM).
// Rulare: node tests/envelope.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const E = require(path.join(HUB, 'tools', 'fff-envelope.js'));
const S = require(path.join(HUB, 'tools', 'fff-seif.js'));
const LANGS = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
let pass = 0, fail = 0;
const ok = (c, n, i) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (i === undefined ? '' : ' :: ' + JSON.stringify(i).slice(0, 300))); } };
const throws = async (fn) => { try { await fn(); return false; } catch { return true; } };

console.log('plic: creare și validare');
const env = E.create({type: 'table/csv', title: 'Măsurători', payload: 'a,b\n1,2\n', source: {label: 'FieldObserver', url: 'https://example.org/x'}, evidence: {level: 2, note: 'mostre mici'}, app: 'fieldobserver'});
ok(env.fff === 2 && env.type === 'table/csv' && env.payload === 'a,b\n1,2\n' && env.app === 'fieldobserver' && !Number.isNaN(Date.parse(env.created)), 'create → canonic fff:2 cu toate câmpurile');
ok(E.validate(env).ok, 'validate(ok)');
ok(!E.validate({...env, type: 'nu-e-tip'}).ok && !E.validate({...env, evidence: {level: 5}}).ok && !E.validate({...env, created: 'ieri'}).ok && !E.validate({fff: 2, type: 'a/b', created: env.created, app: 'x'}).ok, 'validate respinge type/evidence/created/payload invalide');
ok(await throws(() => E.create({type: 'x', payload: 1})) && await throws(() => E.create({type: 'a/b', payload: 1, evidence: {level: 9}})), 'create aruncă la date invalide');
ok(!E.validate({...env, payload: 'x'.repeat(E.MAX_BYTES)}).ok, 'plic peste 8 MB respins');
ok(E.create({type: 'text/plain', payload: 'x', app: 'a'}).evidence === undefined && E.create({type: 'text/plain', payload: 'x', app: 'a', evidence: 0}).evidence.level === 0, 'evidence opțional; nivel 0 acceptat');

console.log('compat fff:1 ↔ canonic');
const compat = E.toCompat(env);
ok(compat.fff === 1 && compat.data === env.payload && compat.ts === env.created && compat.src === 'fieldobserver' && compat.evidence.level === 2 && compat.source.label === 'FieldObserver', 'toCompat păstrează datele și câmpurile noi');
const back = E.normalize(compat);
ok(JSON.stringify(back) === JSON.stringify({...env, lang: back.lang}) || (back.payload === env.payload && back.created === env.created && back.evidence.level === 2 && back.app === 'fieldobserver'), 'compat → canonic fără pierderi');
const legacy = {fff: 1, type: 'text/markdown', src: 'Akasha', title: 'Notă', lang: 'ro', theme: '', ts: '2026-11-01T10:00:00.000Z', data: '# Salut'};
const nl = E.normalize(legacy);
ok(nl.fff === 2 && nl.payload === '# Salut' && nl.app === 'Akasha' && nl.created === legacy.ts && nl.evidence === undefined, 'plic fff:1 vechi (FFF.bridge) se citește');
ok(await throws(() => E.normalize({fff: 3, type: 'a/b'})) && await throws(() => E.parse('nu e json')) && await throws(() => E.normalize({fff: 1, type: 'a/b'})), 'plicuri invalide respinse');
const poll = E.parse('{"fff":2,"type":"text/plain","payload":{"__proto__":{"x":1},"constructor":{"y":2},"ok":1},"created":"2026-11-01T10:00:00Z","app":"a"}');
ok(poll.payload.ok === 1 && !('x' in poll.payload) && !Object.prototype.hasOwnProperty.call(poll.payload, 'constructor') && ({}).x === undefined, 'poluare de prototip eliminată');

console.log('interoperare cu FFF.bridge din kit (fff:1)');
{
  const ctx = vm.createContext({window: null, document: {}, navigator: {}, console, TextEncoder, TextDecoder, Blob, File, URL, CompressionStream, DecompressionStream, Response, btoa, atob, setTimeout});
  ctx.window = ctx; ctx.FFF = {t: (m, k) => k, registerI18n() {}, lang: () => 'ro', download() {}};
  vm.runInContext(fs.readFileSync(path.join(HUB, 'fff-kit', 'src', 'bridge.js'), 'utf8'), ctx);
  const B = ctx.FFF.bridge;
  const parsed = B.parse(E.serialize(env));
  ok(parsed.type === 'table/csv' && parsed.data === env.payload && parsed.src === 'fieldobserver', 'FFF.bridge.parse acceptă plicul în forma compat');
  ok(B.valid(JSON.parse(E.serialize(env))), 'FFF.bridge.valid');
  const hash = await E.toLink(env, 'https://x.example/app/');
  const viaBridge = await B.fromHash(new URL(hash).hash);
  ok(viaBridge && viaBridge.data === env.payload, 'linkul #fff= produs aici e citit de FFF.bridge.fromHash');
  const fromBridgeLink = await B.toLink(B.make({type: 'text/plain', src: 'Vechi', title: 'T', data: 'ceva'}), 'https://y.example/');
  const e2 = await E.fromHash(new URL(fromBridgeLink).hash);
  ok(e2 && e2.payload === 'ceva' && e2.type === 'text/plain', 'linkul produs de FFF.bridge e citit aici');
}

console.log('semnătură HMAC-SHA256 (PBKDF2)');
{
  const s = await E.sign(env, 'parola-lunga-123', {it: 2000});
  ok(s.sig && s.sig.alg === 'HMAC-SHA256' && s.sig.it === 2000 && E.validate(s).ok, 'sign adaugă sig valid');
  ok(await E.verify(s, 'parola-lunga-123') === 'ok', 'verify cu parola corectă → ok');
  ok(await E.verify(s, 'alta-parola') === 'bad', 'verify cu altă parolă → bad');
  ok(await E.verify({...s, payload: 'a,b\n9,9\n'}, 'parola-lunga-123') === 'bad', 'verify după modificarea conținutului → bad');
  ok(await E.verify(E.parse(E.serialize(s)), 'parola-lunga-123') === 'ok', 'semnătura rezistă trecerii prin forma compat (fff:1) și înapoi');
  ok(await E.verify(env, 'x') === 'none', 'plic nesemnat → none');
  ok(await E.verify({...s, sig: {...s.sig, it: 1}}, 'parola-lunga-123') === 'bad', 'iterații absurde → bad');
}

console.log('pachet link / BroadcastChannel');
{
  const big = E.create({type: 'text/plain', payload: Array.from({length: 40000}, (_, i) => 'cuvânt' + ((i * 7919) % 100003)).join(' '), app: 'a'});
  const err = await E.toLink(big, 'https://x/').then(() => null, (e) => e);
  ok(err && err.code === 'TOO_BIG', 'link prea mare → TOO_BIG (se trece pe fișier)');
  const packed = await E.pack(E.serialize(env)); ok(await E.unpack(packed) === E.serialize(env), 'pack/unpack dus-întors (Unicode)');
  const a = E.broadcast('test-fff'), b = E.broadcast('test-fff');
  const got = new Promise((res) => b.onReceive(res));
  a.send(env); const r = await Promise.race([got, new Promise((res) => setTimeout(() => res(null), 3000))]);
  ok(r && r.payload === env.payload && r.evidence.level === 2, 'BroadcastChannel: plicul ajunge în alt canal, normalizat');
  a.close(); b.close();
}

console.log('i18n: paritate în cele 8 limbi');
{
  const ref = Object.keys(E.I18N.en).sort();
  ok(LANGS.every((l) => E.I18N[l] && JSON.stringify(Object.keys(E.I18N[l]).sort()) === JSON.stringify(ref)), 'aceleași chei în ro, en, fr, it, es, pt, de, hu', LANGS.map((l) => [l, ref.filter((k) => !(k in (E.I18N[l] || {})))]));
  ok(LANGS.every((l) => Object.values(E.I18N[l]).every((v) => typeof v === 'string' && v.length > 0)), 'nicio traducere goală');
  ok(['send', 'file', 'copy', 'qr', 'imp'].every((k) => LANGS.filter((l) => l !== 'en').every((l) => E.I18N[l][k] !== E.I18N.en[k] || ['qr'].includes(k))), 'traducerile nu sunt copii ale englezei (cu excepția „QR”)');
  ok(LANGS.every((l) => /\{src\}/.test(E.I18N[l].incoming) && /\{title\}/.test(E.I18N[l].incoming) && /\{name\}/.test(E.I18N[l].toApp)), 'substituenții {src},{title},{name} există în toate limbile');
}

console.log('seif de chei (FFF.seif): PBKDF2-SHA256 + AES-GCM, compatibil KeyVault/1');
{
  const keys = {anthropic: 'sk-ant-TEST-1234567890', openai: 'sk-openai-TEST', google: 'AIza-TEST'};
  const blob = await S.seal(keys, 'parola de seif foarte lunga', {it: 3000});
  const o = JSON.parse(blob);
  ok(o.kv === 1 && o.kdf === 'PBKDF2-SHA256' && o.it === 3000 && o.s && o.iv && o.ct, 'format KeyVault/1 ({kv,kdf,it,s,iv,ct})');
  ok(!blob.includes('sk-ant') && !blob.includes('TEST-123'), 'nicio cheie în clar în blob');
  const dec = await S.open(blob, 'parola de seif foarte lunga', {minIt: 1000});
  ok(JSON.stringify(dec) === JSON.stringify(keys), 'open dă înapoi cheile');
  ok(await throws(() => S.open(blob, 'parola gresita 123456', {minIt: 1000})), 'parolă greșită → eroare');
  ok(await throws(() => S.seal(keys, 'scurta')), 'parolă sub 12 caractere → refuzată');
  const tampered = JSON.stringify({...o, ct: o.ct.slice(0, -4) + 'AAAA'});
  ok(await throws(() => S.open(tampered, 'parola de seif foarte lunga', {minIt: 1000})), 'blob modificat → eroare (AES-GCM autentifică)');
  ok(await throws(() => S.open(JSON.stringify({...o, it: 5}), 'parola de seif foarte lunga')), 'iterații prea mici → respins');
  // compatibilitate cu KeyVault din Nexus/AI-Liber/ARENA: aceeași AAD și aceleași valori
  const nexus = [process.env.FFF_ROOT, path.join(HUB, '..'), '/home/claude/demo/apps'].filter(Boolean).map((d) => path.join(d, 'Nexus-fara-frontiere', 'index.html')).find((f) => fs.existsSync(f));
  const code = nexus ? fs.readFileSync(nexus, 'utf8') : '';
  const m = code.match(/<script id="keyvault">([\s\S]*?)<\/script>/);
  if (m) {
    const ctx = vm.createContext({window: null, crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, Promise, JSON, Uint8Array, Error});
    ctx.globalThis = ctx; ctx.window = ctx; vm.runInContext(m[1], ctx);
    const KV = vm.runInContext('KV', ctx), strong = await S.seal(keys, 'parola de seif foarte lunga'), seen = await KV.decrypt('parola de seif foarte lunga', strong);
    ok(JSON.stringify(JSON.parse(seen)) === JSON.stringify(keys), 'KeyVault real din Nexus decriptează seiful creat aici');
    const kvBlob = await KV.encrypt('parola de seif foarte lunga', JSON.stringify(keys));
    ok(JSON.stringify(await S.open(kvBlob, 'parola de seif foarte lunga')) === JSON.stringify(keys), 'seiful deschide blob-ul creat de KeyVault real');
  } else console.log('  (omis: nu există clona Nexus; compatibilitatea KeyVault e verificată în CI doar prin format)');
  const e = S.toEnvelope(blob, {app: 'vaultcrypt', title: 'Chei API', hint: {providers: ['anthropic', 'openai', 'google']}});
  ok(e.type === 'keys/vault' && e.payload === blob && E.validate(e).ok && !JSON.stringify(e).includes('sk-ant'), 'toEnvelope: tip keys/vault, doar blobul criptat în plic');
  ok(S.fromEnvelope(E.parse(E.serialize(e))) === blob, 'fromEnvelope după dus-întors prin compat');
  ok(await throws(() => S.fromEnvelope(env)), 'fromEnvelope respinge alt tip');
  ok(JSON.stringify(S.mapProviders({anthropic: 'a', openai: 'b', 'zz-necunoscut': 'c', google: ''}, ['anthropic', 'google', 'custom'])) === JSON.stringify({anthropic: 'a'}), 'mapProviders păstrează doar furnizorii cunoscuți și nevizi');
}

console.log(`\n${pass} ok, ${fail} eșuate`);
process.exit(fail ? 1 : 0);
