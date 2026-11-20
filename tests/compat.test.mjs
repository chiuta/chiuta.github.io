// Consecvența datelor și a documentației de compatibilitate cu browsere vechi (fără clone, fără browser).
//   data/compat.json (scris de `node tools/compat/audit.mjs --json data/compat.json --smoke …`) trebuie să coincidă cu pragul din
//   tools/compat/compat.config.json și cu stratul din fff-kit/src/compat.js; nicio țintă „fail”; fiecare card din catalog are o țintă;
//   documentația citează pragul curent. Regenerare: vezi docs/COMPATIBILITATE.md § 3.
//   Rulare: node tests/compat.test.mjs
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import {fileURLToPath} from 'node:url';
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(HUB, p), 'utf8');
const cfg = JSON.parse(rd('tools/compat/compat.config.json'));
const data = JSON.parse(rd('data/compat.json'));

let ok = 0, bad = 0;
const T = async (n, f) => { try { await f(); ok++; console.log('ok   ' + n); } catch (e) { bad++; console.log('FAIL ' + n + '\n       ' + e.message); } };
const yes = (c, m) => { if (!c) throw new Error(m); };
const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
const ids = Object.keys(data.apps || {});
// `C.version` din fff-kit/src/compat.js = ultima versiune de kit în care s-a schimbat stratul. Stratul e copiat în fiecare pagină ca script inline cu hash CSP,
// deci o modificare cere re-ștampilarea tuturor paginilor și NU urmează automat KIT_VERSION (kit 1.8.1 nu l-a schimbat: paginile cu kit 1.8.1 raportează 1.8.0).
// Suma fixează conținutul fiecărei versiuni: dacă compat.js se schimbă, testul cere ridicarea lui C.version și adăugarea sumei noi aici.
const LAYER_SHA = {'1.8.0': '186b812b71a8826bbff155788bfa5021f56fac2750cbf881a5b82d70fe723c46'};

await T('data/compat.json: structură (prag, kit minim, rezumat, ținte)', () => {
  yes(data.floor && data.summary && data.apps, 'lipsesc câmpuri');
  yes(/^\d{4}-\d{2}-\d{2}$/.test(data.generated || ''), 'generated lipsește sau nu e dată ISO');
  yes(ids.length > 100, 'prea puține ținte: ' + ids.length);
  for (const [id, a] of Object.entries(data.apps)) yes(['ok', 'warn', 'fail'].includes(a.status) && typeof a.file === 'string', 'țintă fără stare/fișier: ' + id);
});

await T('pragul din data/compat.json = compat.config.json (un singur loc de schimbat)', () => {
  yes(JSON.stringify(data.floor) === JSON.stringify(cfg.floor), 'prag diferit: ' + JSON.stringify(data.floor) + ' ≠ ' + JSON.stringify(cfg.floor));
  yes(data.kitMinVersion === cfg.kitMinVersion, 'kitMinVersion diferit');
});

await T('rezumatul se potrivește cu țintele (apps = ok + warn + fail)', () => {
  const c = {ok: 0, warn: 0, fail: 0}; for (const a of Object.values(data.apps)) c[a.status]++;
  yes(c.ok === data.summary.ok && c.warn === data.summary.warn && c.fail === data.summary.fail && ids.length === data.summary.apps, 'rezumat ' + JSON.stringify(data.summary) + ' ≠ ' + JSON.stringify(c));
});

await T('nicio țintă nu depășește pragul: 0 eșecuri, fără erori de sintaxă', () => {
  const bads = ids.filter((i) => data.apps[i].status === 'fail' || (data.apps[i].syntaxErrors || []).length);
  yes(!bads.length, 'eșuate: ' + bads.slice(0, 8).join(', '));
});

await T('fiecare pagină cu kit are stratul fff-compat și kitul ≥ kitMinVersion', () => {
  const bads = ids.filter((i) => data.apps[i].kit && (!data.apps[i].compatLayer || cmpVer(data.apps[i].kit, cfg.kitMinVersion) < 0));
  yes(!bads.length, 'fără strat/kit vechi: ' + bads.slice(0, 8).join(', '));
});

await T('smoke (motor vechi simulat): fără regresii și fără ținte lipsă', () => {
  yes(data.summary.smoke, 'data/compat.json fără rezultate smoke (regenerează cu --smoke)');
  const s = data.summary.smoke;
  yes(!s.fail && !s.missing, 'smoke: ' + JSON.stringify(s));
  for (const i of ids) yes(data.apps[i].smoke && ['ok', 'warn'].includes(data.apps[i].smoke.status) && !data.apps[i].smoke.newErrors, 'smoke ' + i + ': ' + JSON.stringify(data.apps[i].smoke));
});

await T('excepțiile din config au motiv scris și apar în date', () => {
  for (const [k, v] of Object.entries(cfg.exceptions || {})) {
    yes(typeof v.because === 'string' && v.because.length > 20, 'excepție fără «because»: ' + k);
    if (data.apps[k]) yes(data.apps[k].exception && data.apps[k].exception.because === v.because, 'excepția ' + k + ' lipsește din data/compat.json');
  }
});

await T('fiecare card din catalog are o țintă auditată (fără diferențe de literă)', () => {
  const meta = JSON.parse(rd('data/catalog-meta.json'));
  const lower = ids.map((i) => i.toLowerCase());
  const missing = Object.keys(meta.apps || {}).filter((n) => !lower.some((i) => i === n.toLowerCase() || i.startsWith(n.toLowerCase() + ':')));
  yes(!missing.length, 'fără țintă în data/compat.json: ' + missing.join(', ') + ' (rulează auditul pe depozitul lor)');
});

await T('stratul din kit: versiunea stratului între kitMinVersion și KIT_VERSION, conținut fixat de sumă; prag = compat.config.json', () => {
  const core = rd('fff-kit/src/core.js'), compat = rd('fff-kit/src/compat.js');
  const kv = (core.match(/KIT_VERSION\s*=\s*'([^']+)'/) || [])[1];
  const lv = (compat.match(/C\.version = '([^']+)'/) || [])[1];
  yes(kv && lv && cmpVer(lv, kv) <= 0 && cmpVer(lv, cfg.kitMinVersion) >= 0, 'C.version ' + lv + ' trebuie să fie între kitMinVersion ' + cfg.kitMinVersion + ' și KIT_VERSION ' + kv);
  const sha = crypto.createHash('sha256').update(compat).digest('hex');
  yes(LAYER_SHA[lv] === sha, 'compat.js s-a schimbat față de versiunea ' + lv + ' a stratului: ridică C.version la ' + kv + ' și adaugă în LAYER_SHA suma ' + sha + ' (apoi re-ștampilează paginile cu `build.mjs release --bump none`)');
  const fl = (compat.match(/C\.floor = (\{[^}]*\})/) || [])[1];
  yes(fl, 'C.floor lipsește');
  const f = Function('return (' + fl + ')')();
  yes(f.chrome === cfg.floor.chrome && f.firefox === cfg.floor.firefox && f.safari === cfg.floor.safari && f.ecma === cfg.floor.ecma, 'C.floor ' + fl + ' ≠ config ' + JSON.stringify(cfg.floor));
});

await T('documentația citează pragul curent (COMPATIBILITATE.md, SPEC.md, README kit, ghid autori)', () => {
  const f = cfg.floor, doc = rd('docs/COMPATIBILITATE.md');
  for (const v of [f.chrome, f.firefox, f.safari, f.ios, f.edge]) yes(new RegExp('\\b' + String(v).replace('.', '\\.') + '\\b').test(doc), 'COMPATIBILITATE.md nu citează ' + v);
  yes(/ES2017/.test(doc) && /ES2017/.test(rd('fff-kit/SPEC.md')) && /ES2017/.test(rd('docs/GHID-AUTORI.md')), 'ES2017 lipsește dintr-un document');
  const kv = (rd('fff-kit/src/core.js').match(/KIT_VERSION\s*=\s*'([^']+)'/) || [])[1];
  yes(rd('fff-kit/README.md').includes('**Versiune:** ' + kv), 'README kit nu are versiunea ' + kv);
  yes(rd('fff-kit/README.md').includes('Novități în ' + kv), 'README kit fără secțiunea „Novități în ' + kv + '”');
  yes(/COMPATIBILITATE\.md/.test(rd('README.md')), 'README hub nu leagă COMPATIBILITATE.md');
});

console.log(`\n${ok} reușite, ${bad} eșuate`);
process.exit(bad ? 1 : 0);
