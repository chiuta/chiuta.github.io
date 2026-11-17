// Teste PWA fără browser: descrierea și numele din manifest sunt decodate corect (entități numerice și numite), CSP-ul primește doar
// ce trebuie, apply este idempotent, iar sw.js poartă versiunea paginii. Icoanele (Playwright) nu se generează aici (--no-icons).
// Rulare: node test/pwa.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {recomputeCspHashes} from '../lib/csp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PWA = path.join(HERE, '..', 'pwa', 'pwa.mjs');
let pass = 0, fail = 0;
const T = (name, fn) => { try { fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n')[0]); } };

const PAGE = (title, desc) => recomputeCspHashes(`<!doctype html>
<html lang="ro"><head><meta charset="utf-8">
<meta name="application-version" content="1.2.3"><meta name="last-updated" content="2026-11-17">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; base-uri 'none'">
<title>${title}</title><meta name="description" content="${desc}"><meta name="theme-color" content="#102030">
</head><body><p>test</p></body></html>
`).html;
function run(title, desc, extra = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-unit-'));
  fs.writeFileSync(path.join(dir, 'index.html'), PAGE(title, desc));
  const r = spawnSync(process.execPath, [PWA, 'apply', dir, '--slug', 'proba', '--no-icons', ...extra], {encoding: 'utf8'});
  return {dir, r, mf: fs.existsSync(path.join(dir, 'manifest.webmanifest')) ? JSON.parse(fs.readFileSync(path.join(dir, 'manifest.webmanifest'), 'utf8')) : null};
}

T('descrierea din <meta> se decodifică: &#x27; &#39; &apos; &#8217; &amp; &quot; &lt; &gt;', () => {
  const {dir, r, mf} = run('Proba — test', 'The world&#x27;s calendars &#39;a&#39; &apos;b&apos; l&#8217;atlas &amp; more &quot;q&quot; &lt;x&gt; &#x1F4C5;');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(mf.description, 'The world\'s calendars \'a\' \'b\' l’atlas & more "q" <x> 📅');
  fs.rmSync(dir, {recursive: true, force: true});
});

T('«&amp;lt;» rămâne «&lt;» (nu se decodifică de două ori) și o referință invalidă rămâne neatinsă', () => {
  const {dir, r, mf} = run('Proba', 'a &amp;lt; b &#0; c &#xD800; d &#x110000; e');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(mf.description, 'a &lt; b &#0; c &#xD800; d &#x110000; e');
  fs.rmSync(dir, {recursive: true, force: true});
});

T('numele din <title> se decodifică la fel', () => {
  const {dir, r, mf} = run('L&#x27;Atlas &#8212; test', 'd');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(mf.name, 'L\'Atlas');
  fs.rmSync(dir, {recursive: true, force: true});
});

T('apply: manifest, sw.js cu versiunea paginii, CSP doar cu manifest-src/worker-src/img-src \'self\'; a doua rulare nu schimbă nimic', () => {
  const {dir, r} = run('Proba', 'd');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
  assert.match(sw, /var SLUG = "proba", VERSION = "1\.2\.3";/);
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const csp = /Content-Security-Policy" content="([^"]*)"/.exec(html)[1].replace(/'sha256-[^']*'/g, 'H');
  assert.match(csp, /manifest-src 'self'/); assert.match(csp, /worker-src 'self'/); assert.match(csp, /img-src 'self' data:/);
  assert.match(csp, /default-src 'none'/);
  const again = spawnSync(process.execPath, [PWA, 'apply', dir, '--slug', 'proba', '--no-icons'], {encoding: 'utf8'});
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), html, 'a doua rulare a schimbat pagina');
  assert.equal(JSON.parse(again.stdout).changed, false);
  fs.rmSync(dir, {recursive: true, force: true});
});

T('a doua rulare nu readuce un hash de stil învechit: stilul aplicației se modifică între rulări, iar hash-ul curent rămâne în style-src', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-style-'));
  const sha = (s) => 'sha256-' + createHash('sha256').update(s, 'utf8').digest('base64');
  const page = (css) => PAGE('Proba', 'd').replace("style-src 'self'", `style-src '${sha(css)}'`).replace('</head>', `<style id="app-style">${css}</style></head>`);
  const css1 = 'p{color:red}', css2 = 'p{color:blue;margin:0}';
  fs.writeFileSync(path.join(dir, 'index.html'), page(css1));
  let r = spawnSync(process.execPath, [PWA, 'apply', dir, '--slug', 'proba', '--no-icons'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // constructorul aplicației rescrie stilul și hash-ul lui din style-src (ca scripts/build.mjs), apoi kitul rulează din nou
  let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  html = html.replace(css1, css2).replace(sha(css1), sha(css2));
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  r = spawnSync(process.execPath, [PWA, 'apply', dir, '--slug', 'proba', '--no-icons'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const csp = /Content-Security-Policy" content="([^"]*)"/.exec(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'))[1];
  assert.ok(csp.includes(`'${sha(css2)}'`), 'hash-ul curent lipsește din style-src: ' + csp);
  assert.ok(!csp.includes(sha(css1)), 'hash învechit în style-src: ' + csp);
  fs.rmSync(dir, {recursive: true, force: true});
});

console.log(fail ? `\n${fail} eșuate, ${pass} trec` : `\n${pass} teste pwa: toate trec`);
process.exit(fail ? 1 : 0);
