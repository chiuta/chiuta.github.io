// Teste pentru builderul aplicațiilor alpha (tools/alpha/build.mjs), fără browser: extensiile CSP din src/app.json («connect», «csp»)
// sunt strict controlate, deterministe și nu pot slăbi politica; copiile builderului din aplicații sunt identice cu cel din hub.
// Rulare: node tests/alpha-build.test.mjs [--root DIR]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {applyCspExtras, missingStyleHashes} from '../tools/alpha/build.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), ri = args.indexOf('--root');
const ROOT = path.resolve(ri >= 0 ? args[ri + 1] : process.env.FFF_ROOT || path.join(HUB, '..'));
let fail = 0;
const T = (name, fn) => { try { fn(); console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n').slice(0, 4).join('\n     ')); } };

const BASE = "default-src 'none'; script-src 'sha256-AAA='; style-src 'sha256-BBB='; img-src 'self' data:; base-uri 'none'; form-action 'none'; connect-src 'none'";
const page = (csp, q = '"') => `<!doctype html><html><head><meta http-equiv=${q}Content-Security-Policy${q} content=${q}${csp}${q}></head><body></body></html>`;
const cspOf = (html) => (html.match(/content="([^"]*)"/) || html.match(/content='([^']*)'/))[1];
const dir = (csp, name) => { const d = csp.split(';').map((x) => x.trim().split(/\s+/)).find((x) => x[0] === name); return d ? d.slice(1) : null; };

T('fără «connect» și «csp», pagina rămâne neschimbată (octet cu octet)', () => {
  const h = page(BASE);
  assert.equal(applyCspExtras(h, {slug: 'x'}), h);
});

T('«connect» înlocuiește \'none\' din connect-src cu originile declarate, în ordinea dată', () => {
  const out = cspOf(applyCspExtras(page(BASE), {connect: ['https://archive.org', 'https://dns.google']}));
  assert.deepEqual(dir(out, 'connect-src'), ['https://archive.org', 'https://dns.google']);
  assert.deepEqual(dir(out, 'default-src'), ["'none'"]);
  assert.equal(dir(out, 'script-src').join(' '), "'sha256-AAA='");
});

T('connect-src lipsă se adaugă; directivele existente nu se schimbă', () => {
  const base = BASE.replace("; connect-src 'none'", '');
  const out = cspOf(applyCspExtras(page(base), {connect: ['https://cloudflare-dns.com']}));
  assert.deepEqual(dir(out, 'connect-src'), ['https://cloudflare-dns.com']);
  for (const n of ['default-src', 'script-src', 'style-src', 'img-src', 'base-uri', 'form-action']) assert.deepEqual(dir(out, n), dir(base, n), n);
});

T('«csp» adaugă jetoane la img-src și media-src, fără duplicate; este idempotent', () => {
  const cfg = {csp: {'img-src': ['blob:', 'data:'], 'media-src': ['blob:']}};
  const once = applyCspExtras(page(BASE), cfg);
  assert.deepEqual(dir(cspOf(once), 'img-src'), ["'self'", 'data:', 'blob:']);
  assert.deepEqual(dir(cspOf(once), 'media-src'), ['blob:']);
  assert.equal(applyCspExtras(once, cfg), once, 'a doua aplicare nu schimbă nimic');
});

T('«connect» și «csp» împreună; ghilimelele simple ale atributului meta sunt păstrate', () => {
  const h = page('img-src data:; form-action https://x.example', "'");
  const out = applyCspExtras(h, {connect: ['https://archive.org'], csp: {'img-src': ['blob:']}});
  assert.match(out, /content='[^']*connect-src https:\/\/archive\.org[^']*'/);
  assert.deepEqual(dir(out.match(/content='([^']*)'/)[1], 'img-src'), ['data:', 'blob:']);
  assert.deepEqual(dir(out.match(/content='([^']*)'/)[1], 'form-action'), ['https://x.example']);
});

T('origini nepermise: http, cale, wildcard, port nevalid, schemă lipsă, listă goală sau tip greșit', () => {
  for (const bad of [['http://archive.org'], ['https://archive.org/path'], ['https://*.archive.org'], ['archive.org'], ['https://localhost'], ["'unsafe-inline'"], ['https://a b.org'], [], 'https://archive.org', [5]]) {
    assert.throws(() => applyCspExtras(page(BASE), {connect: bad}), /src\/app\.json/, JSON.stringify(bad));
  }
});

T('«csp» nu poate slăbi script-src, style-src sau default-src și nu acceptă jetoane periculoase', () => {
  for (const k of ['script-src', 'style-src', 'default-src']) assert.throws(() => applyCspExtras(page(BASE), {csp: {[k]: ['blob:']}}), /nu poate fi schimbată/, k);
  for (const t of ["'unsafe-inline'", "'unsafe-eval'", '*', 'https:', "'none'", 'blob', 'javascript:alert(1)', 'a b']) {
    const ok = t === 'https:';   // schema https: este un jeton de schemă valid (permite orice https), dar nu e periculos pentru img-src/media-src; rămâne în lista acceptată
    if (ok) continue;
    assert.throws(() => applyCspExtras(page(BASE), {csp: {'img-src': [t]}}), /jeton CSP neacceptat|trebuie să fie/, t);
  }
  assert.throws(() => applyCspExtras(page(BASE), {csp: {'img-src': []}}), /listă de jetoane/);
  assert.throws(() => applyCspExtras(page(BASE), {csp: ['blob:']}), /obiect/);
  assert.throws(() => applyCspExtras(page(BASE), {csp: {foo: ['blob:']}}), /nu poate fi schimbată/);
});

T('fără eticheta CSP, extensiile cer eroare clară (nu se ignoră în tăcere)', () => {
  assert.throws(() => applyCspExtras('<html><head></head></html>', {connect: ['https://archive.org']}), /Content-Security-Policy/);
  assert.equal(applyCspExtras('<html><head></head></html>', {}), '<html><head></head></html>');
});

const sha64 = (s) => createHash('sha256').update(s, 'utf8').digest('base64');
T('missingStyleHashes: găsește stilurile fără hash în style-src; ignoră \'unsafe-inline\', <noscript> și textul din scripturi', () => {
  const css = 'p{color:red}';
  const withCsp = (csp, body) => `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}">${body}</head><body></body></html>`;
  const ok = withCsp(`default-src 'none'; style-src 'sha256-${sha64(css)}'`, `<style id="app-style">${css}</style>`);
  assert.deepEqual(missingStyleHashes(ok), []);
  assert.deepEqual(missingStyleHashes(ok.replace(sha64(css), 'AAAA')), ['app-style'], 'hash învechit');
  assert.deepEqual(missingStyleHashes(ok.replace(/ style-src[^"]*/, '')), ['app-style'], 'fără style-src, default-src \'none\' blochează stilul');
  assert.deepEqual(missingStyleHashes(ok.replace(/style-src 'sha256-[^']*'/, "style-src 'unsafe-inline'")), [], '\'unsafe-inline\' permite orice stil');
  assert.deepEqual(missingStyleHashes(withCsp("default-src 'none'; style-src 'self'", '<noscript><style>b{x:y}</style></noscript><script>var s = "<style>a{b:c}</style>";</script>')), [], 'noscript și textul din script nu sunt stiluri aplicate');
  assert.deepEqual(missingStyleHashes('<html><head></head></html>'), [], 'fără CSP');
  assert.deepEqual(missingStyleHashes(ok.replace('</head>', '<style>x{y:z}</style></head>')), ['(fără id)']);
});

const proiector = path.join(ROOT, 'proiector-fara-frontiere');
if (fs.existsSync(path.join(proiector, 'src', 'app.json')) && fs.existsSync(path.join(HUB, 'fff-kit', 'build.mjs'))) {
  T('build --check cere hash-uri de stil la zi; build le repară, inclusiv după pasul kitului (PWA readuce hash-urile primei aplicări)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-style-'));
    try {
      for (const e of fs.readdirSync(proiector)) if (e !== '.git' && e !== 'node_modules') fs.cpSync(path.join(proiector, e), path.join(tmp, e), {recursive: true});
      const run = (...a) => spawnSync(process.execPath, ['scripts/build.mjs', ...a, '--kit', path.join(HUB, 'fff-kit')], {cwd: tmp, encoding: 'utf8'});
      const styleHash = () => { const h = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8'); return sha64(h.match(/<style id="app-style">([\s\S]*?)<\/style>/)[1]); };
      const cspHas = (hash) => fs.readFileSync(path.join(tmp, 'index.html'), 'utf8').match(/style-src ([^;"]*)/)[1].includes("'sha256-" + hash + "'");
      assert.equal(run('--check').status, 0, 'punctul de plecare trebuie să fie la zi: ' + run('--check').stdout);
      // 1) un hash de stil stricat în fișier: --check eșuează cu un mesaj clar
      const f = path.join(tmp, 'index.html');
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace("'sha256-" + styleHash() + "'", "'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='"));
      let r = run('--check');
      assert.equal(r.status, 1); assert.match(r.stdout, /hash-uri CSP de stil învechite/);
      assert.equal(run().status, 0); assert.ok(cspHas(styleHash())); assert.equal(run('--check').status, 0);
      // 2) stilul aplicației se schimbă între două rulări cu kit (cazul care producea aplicații fără aspect): hash-ul nou trebuie să rămână
      fs.appendFileSync(path.join(tmp, 'src', 'app.css'), '\n.pf-test-rule { color: #123456; }\n');
      r = run(); assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.ok(cspHas(styleHash()), 'după build cu kit, hash-ul stilului curent lipsește din style-src');
      assert.equal(run('--check').status, 0);
    } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
  });
}

T('copiile builderului din aplicații sunt identice cu cel din hub (dacă depozitele sunt prezente)', () => {
  const hubCopy = fs.readFileSync(path.join(HUB, 'tools/alpha/build.mjs'), 'utf8');
  const tpl = fs.readFileSync(path.join(HUB, 'tools/alpha/pwa.test.template.mjs'), 'utf8');
  let seen = 0;
  for (const app of ['atelier-verificare', 'balanta', 'calendarium', 'glosar', 'graiul', 'indicativ-international', 'proiector-fara-frontiere', 'regula', 'vietar-packs']) {
    const b = path.join(ROOT, app, 'scripts/build.mjs');
    if (!fs.existsSync(b)) continue;
    seen++;
    assert.equal(fs.readFileSync(b, 'utf8'), hubCopy, app + ': scripts/build.mjs diferă de tools/alpha/build.mjs');
    const t = path.join(ROOT, app, 'test/pwa.test.mjs');
    if (fs.existsSync(t)) assert.equal(fs.readFileSync(t, 'utf8'), tpl, app + ': test/pwa.test.mjs diferă de șablon');
  }
  console.log('     (' + seen + ' aplicații verificate)');
});

console.log(fail ? `\n${fail} teste eșuate` : '\ntoate testele trec');
process.exit(fail ? 1 : 0);
