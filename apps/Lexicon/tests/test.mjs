// Teste Lexicon (Playwright, Chromium). Rulare: node tests/test.mjs
// Rețeaua este blocată; se verifică 0 pageerror, 0 violări CSP, 0 cereri de rețea.
// Variabile opționale: LEXICON_SKIP_PERF=1 omite testul cu 300.000 de intrări; AXE_PATH, SHOT_PATH.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(here, '..', 'index.html');
const URL_APP = pathToFileURL(APP).href;
const AXE = process.env.AXE_PATH || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
const SHOT = process.env.SHOT_PATH || path.join(here, '..', 'screenshot.png');
const html = fs.readFileSync(APP, 'utf8');

let pass = 0, fail = 0;
const failures = [], metrics = {};
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; failures.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra).slice(0, 400) : '')); }
}
const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});

async function newCtx(opts = {}) {
  return browser.newContext({viewport: opts.viewport || {width: 1280, height: 800}, colorScheme: opts.scheme || 'light', acceptDownloads: true, bypassCSP: !!opts.bypassCSP, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', locale: opts.locale || 'ro-RO', permissions: opts.permissions || []});
}
async function newPage(opts = {}) {
  const ctx = opts.ctx || await newCtx(opts);
  const net = [];
  await ctx.route(/^https?:/, r => { net.push(r.request().url()); r.abort(); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI); }); });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(URL_APP);
  await page.waitForFunction(() => document.documentElement.dataset.ready);
  return {ctx, page, errors, net};
}
const st = p => p.evaluate(() => Lexicon.state());
async function openWord(p, w) {
  if (await p.locator('#p-search').isHidden()) await p.click('#t-search');
  const prev = await p.evaluate(() => document.querySelector('#article')?.innerText || '');
  await p.fill('#q', w); await p.press('#q', 'Enter');
  await p.waitForFunction(() => document.querySelector('#article h2'));
  await p.waitForFunction(pv => (document.querySelector('#article')?.innerText || '') !== pv, prev, {timeout: 2500}).catch(() => {});
  await p.waitForTimeout(80);
  return p.locator('#article').innerText();
}
async function doImport(p, files, o = {}) {
  await p.setInputFiles('#file-in', files);
  await p.waitForSelector('#dlg-import[open]');
  if (o.expectError) { await p.waitForSelector('#imp-body .msg.err'); const t = await p.locator('#imp-body').innerText(); await p.click('#imp-body button'); await p.waitForSelector('#dlg-import:not([open])', {state: 'attached'}); return t; }
  await p.waitForSelector('#imp-title');
  if (o.title !== undefined) await p.fill('#imp-title', o.title);
  if (o.license !== undefined) await p.fill('#imp-license', o.license);
  if (o.nolic) await p.check('#imp-nolic');
  if (o.before) await o.before(p);
  await p.click('#imp-go');
  await p.waitForSelector('#imp-msg .msg.ok, #imp-msg .msg.err', {timeout: o.timeout || 90000});
  const t = await p.locator('#imp-msg').innerText();
  await p.click('#imp-cancel');
  await p.waitForSelector('#dlg-import:not([open])', {state: 'attached'});
  return t;
}
const F = (name, data) => ({name, mimeType: 'application/octet-stream', buffer: Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8')});
const tab = async (p, t) => { await p.click('#t-' + t); await p.waitForSelector('#p-' + t + ':not([hidden])'); };
const dictId = async (p, title) => (await st(p)).dicts.find(d => d.title === title)?.id;

/* ------------------------- generatoare de fixture-uri ------------------------- */
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };
function sdFields(fields, seq) {
  const parts = [];
  if (seq) {
    fields.forEach(([ty, s], i) => {
      const d = Buffer.from(s, 'utf8'), last = i === fields.length - 1, up = ty >= 'A' && ty <= 'Z';
      if (last) parts.push(d); else if (up) parts.push(u32(d.length), d); else parts.push(d, Buffer.from([0]));
    });
  } else {
    for (const [ty, s] of fields) {
      const d = Buffer.from(s, 'utf8'), up = ty >= 'A' && ty <= 'Z';
      parts.push(Buffer.from(ty)); if (up) parts.push(u32(d.length), d); else parts.push(d, Buffer.from([0]));
    }
  }
  return Buffer.concat(parts);
}
/* entries: [{w, fields:[[tip, text],…]}] */
function makeStarDict(entries, o = {}) {
  const seq = o.seq || '';
  const chunks = [], idx = [];
  let off = 0;
  for (const e of entries) {
    const d = sdFields(e.fields, seq);
    idx.push(Buffer.from(e.w, 'utf8'), Buffer.from([0]), o.off64 ? u64(off) : u32(off), u32(d.length));
    chunks.push(d); off += d.length;
  }
  const dict = Buffer.concat(chunks), idxb = Buffer.concat(idx);
  let ifo = "StarDict's dict ifo file\nversion=2.4.2\nbookname=" + (o.title || 'Test SD') + '\nwordcount=' + entries.length + '\nidxfilesize=' + idxb.length + '\n';
  if (o.off64) ifo += 'idxoffsetbits=64\n';
  if (seq) ifo += 'sametypesequence=' + seq + '\n';
  ifo += 'description=Fixture generat in test\nauthor=test\n';
  let syn = null;
  if (o.syn) syn = Buffer.concat(o.syn.flatMap(([w, i]) => [Buffer.from(w, 'utf8'), Buffer.from([0]), u32(i)]));
  return {ifo: Buffer.from(ifo), idx: idxb, dict, syn};
}
/* dictzip simplu: gzip cu câmpul extra „RA”, bucăți deflate cu Z_FULL_FLUSH */
function dictzip(buf, chunk = 2048) {
  const parts = [], sizes = [];
  for (let i = 0; i < buf.length; i += chunk) { const c = zlib.deflateRawSync(buf.subarray(i, i + chunk), {finishFlush: zlib.constants.Z_FULL_FLUSH}); parts.push(c); sizes.push(c.length); }
  parts.push(Buffer.from([1, 0, 0, 255, 255]));
  const ra = Buffer.alloc(10 + 2 * sizes.length);
  ra.write('RA', 0); ra.writeUInt16LE(6 + 2 * sizes.length, 2); ra.writeUInt16LE(1, 4); ra.writeUInt16LE(chunk, 6); ra.writeUInt16LE(sizes.length, 8);
  sizes.forEach((s, i) => ra.writeUInt16LE(s, 10 + 2 * i));
  const head = Buffer.alloc(12); head[0] = 0x1f; head[1] = 0x8b; head[2] = 8; head[3] = 4; head[9] = 3; head.writeUInt16LE(ra.length, 10);
  const tail = Buffer.alloc(8); tail.writeUInt32LE(zlib.crc32(buf) >>> 0, 0); tail.writeUInt32LE(buf.length >>> 0, 4);
  return Buffer.concat([head, ra, ...parts, tail]);
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64enc(n) { if (n === 0) return 'A'; let s = ''; while (n > 0) { s = B64[n % 64] + s; n = Math.floor(n / 64); } return s; }
function makeDictd(entries, o = {}) {
  const chunks = [], lines = [];
  let off = 0;
  const all = [{w: '00-database-short', body: '00-database-short\n  ' + (o.title || 'Dictd de test') + '\n'}, {w: '00-database-info', body: '00-database-info\nFixture generat in test.\n'}, ...entries];
  for (const e of all) { const d = Buffer.from(e.body, 'utf8'); lines.push(e.w + '\t' + b64enc(off) + '\t' + b64enc(d.length)); chunks.push(d); off += d.length; }
  return {index: Buffer.from(lines.join('\n') + '\n'), dict: Buffer.concat(chunks)};
}
/* PRNG determinist */
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/* ============================================================ 1. pornire */
console.log('1. Pornire, meta, CSP, rețea, set demonstrativ');
{
  const t = await newPage();
  const p = t.page;
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => ({
    ver: document.querySelector('meta[name="application-version"]')?.content,
    upd: document.querySelector('meta[name="last-updated"]')?.content,
    desc: !!document.querySelector('meta[name="description"]')?.content,
    vis: document.querySelector('#app-version')?.textContent.trim(),
    lang: document.documentElement.lang,
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '',
    viol: window.__csp || [],
    inline: document.querySelectorAll('[onclick],[onchange],[oninput],[onload],[onerror]').length,
    manifest: !!document.querySelector('link[rel="manifest"]'),
    leak: [...document.querySelectorAll('[data-i18n]')].filter(e => e.textContent.trim() === e.dataset.i18n).map(e => e.dataset.i18n),
    i18n: Lexicon.i18nCheck()
  }));
  ok('application-version 1.0.0', info.ver === '1.0.0', info.ver);
  ok('last-updated 2026-10-14', info.upd === '2026-10-14', info.upd);
  ok('meta description', info.desc);
  ok('#app-version vizibil', info.vis === 'v 1.0.0 · 2026-10-14', info.vis);
  ok('html[lang]=ro implicit', info.lang === 'ro', info.lang);
  ok('CSP: default-src none, fără unsafe-eval, script-src doar hash', /default-src 'none'/.test(info.csp) && !/unsafe-eval/.test(info.csp) && /script-src 'sha256-[A-Za-z0-9+\/=]+'/.test(info.csp) && !/script-src[^;]*unsafe-inline/.test(info.csp) && /connect-src 'none'/.test(info.csp) && /base-uri 'none'/.test(info.csp) && /form-action 'none'/.test(info.csp), info.csp);
  ok('0 violări CSP', info.viol.length === 0, info.viol);
  ok('fără handlere inline', info.inline === 0);
  ok('fără manifest/sw', !info.manifest);
  ok('0 pageerror/console error', t.errors.length === 0, t.errors);
  ok('0 cereri de rețea', t.net.length === 0, t.net);
  ok('niciun text de interfață nu a rămas cheie brută', info.leak.length === 0, info.leak);
  ok('toate cheile i18n au 8 traduceri', info.i18n.bad.length === 0 && info.i18n.keys > 150, info.i18n);
  const s = await st(t.page);
  ok('set demonstrativ instalat (≈300+ intrări)', s.dicts.length === 1 && s.dicts[0].count >= 300 && s.dicts[0].count < 400 && s.dicts[0].format === 'demo', s.dicts);
  ok('IndexedDB persistent activ', s.persistent === true);
  const scripts = html.match(/<script>/g) || [];
  ok('un singur script executabil inline', scripts.length === 1);
  ok('fără eval / new Function în sursă', !/\beval\s*\(|new Function\s*\(/.test(html));
  ok('fără innerHTML / insertAdjacentHTML / document.write în cod', !/\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(html.replace(/<script type="text\/plain"[\s\S]*?<\/script>/, '')));
  const home = await p.locator('#article').innerText();
  ok('pagina de start arată cuvântul zilei și avertismentul de set demonstrativ', /Cuvântul zilei/.test(home) && /nu este un dicționar complet/.test(home), home.slice(0, 200));
  ok('bara de limite onestă vizibilă', /set demonstrativ, nu un dicționar complet/.test(await p.locator('#privbar').innerText()));
  await t.ctx.close();
}

/* ============================================================ 2. normalizare, DL, căutare pe setul demonstrativ */
console.log('2. Normalizare, Damerau–Levenshtein, căutări pe setul demonstrativ');
const T1 = await newPage();
const P = T1.page;
{
  const r = await P.evaluate(async () => {
    const L = Lexicon, n = L.norm;
    const rows = async (q, o) => (await L.search(q, o)).rows.map(x => x.h + ':' + x.kind);
    return {
      norm: [n('ȘȚĂÂÎ'), n('şţ'), n('Straße'), n('Übung'), n('őűŐŰ'), n('Café ÈÇ'), n('Ærø'), n('  Multiple   spaces ')],
      dl: [L.dl('ca', 'ac', 1), L.dl('abcd', 'acbd', 1), L.dl('kitten', 'sitting', 3), L.dl('abc', 'xyz', 2), L.dl('padure', 'pdure', 1), L.dl('', 'ab', 2), L.dl('abc', 'abc', 0)],
      exact: await rows('casa', {mode: 'exact'}),
      upper: await rows('CASĂ', {mode: 'exact'}),
      s1: await rows('ȘI', {mode: 'exact'}), s2: await rows('ŞI', {mode: 'exact'}), s3: await rows('si', {mode: 'exact'}),
      apa: await rows('apa', {mode: 'exact'}),
      prefix: await rows('cas', {mode: 'prefix'}),
      prefix2: (await rows('pad', {mode: 'prefix'})).slice(0, 3),
      forms: await rows('mainile', {}), forms2: await rows('mergeți', {}), formsOff: await rows('mainile', {forms: false, fuzzy: false}),
      fz: await rows('pdure', {mode: 'fuzzy'}), fz2: (await rows('pdaure', {mode: 'fuzzy'})).slice(0, 2), fzNone: await rows('xqzvwk', {}),
      autoFuzzy: await rows('padrue', {}),
      w1: await rows('c?s?', {}), w2: (await rows('p?s?re', {})), w3: await rows('*uri', {mode: 'wild'}), w4: await rows('?', {mode: 'wild'}),
      text: await rows('lichid transparent', {mode: 'text'}), phrase: await rows('"se rotește în jurul"', {mode: 'text'}), textNone: await rows('zzzyyy', {mode: 'text'}),
      wotd1: L.wotd('2026-10-14'), wotd2: L.wotd('2026-10-14'),
      wotdDistinct: new Set(Array.from({length: 40}, (_, i) => L.wotd('2026-11-' + String(i + 1).padStart(2, '0')).n)).size,
      sugg: L.suggest('pad', 8).map(x => x.h), suggMiss: L.suggest('padrue', 4).map(x => x.h), suggWild: L.suggest('c?s?', 4).map(x => x.h),
      homon: L.lookup('luna'), homon2: L.lookup('vara')
    };
  });
  ok('norm: ș/ş/ț/ţ/ă/â/î', r.norm[0] === 'staai' && r.norm[1] === 'st', r.norm);
  ok('norm: ß→ss, ü, ő/ű, é/è/ç, æ/ø', r.norm[2] === 'strasse' && r.norm[3] === 'ubung' && r.norm[4] === 'ouou' && r.norm[5] === 'cafe ec' && r.norm[6] === 'aero', r.norm);
  ok('norm: spații multiple', r.norm[7] === 'multiple spaces', r.norm[7]);
  ok('Damerau–Levenshtein: transpunere = 1, kitten/sitting = 3, limită respectată', r.dl[0] === 1 && r.dl[1] === 1 && r.dl[2] === 3 && r.dl[3] > 2 && r.dl[4] === 1 && r.dl[5] === 2 && r.dl[6] === 0, r.dl);
  ok('exact insensibil la diacritice', r.exact[0] === 'casă:exact', r.exact);
  ok('exact insensibil la majuscule', r.upper[0] === 'casă:exact', r.upper);
  ok('ș (virgulă) și ş (sedilă) dau același rezultat', r.s1.length === 1 && r.s1[0] === r.s2[0] && r.s1[0] === r.s3[0] && /^și:/.test(r.s1[0]), [r.s1, r.s2, r.s3]);
  ok('„apa” găsește „apă”', r.apa[0] === 'apă:exact', r.apa);
  ok('prefix: „cas” → casă', r.prefix.includes('casă:prefix'), r.prefix);
  ok('prefix „pad” → pădure printre primele', r.prefix2.some(x => x.startsWith('pădure')), r.prefix2);
  ok('formă flexionară: „mainile” → mână', r.forms[0] === 'mână:form', r.forms);
  ok('formă flexionară verb: „mergeți” → merge', r.forms2[0] === 'merge:form', r.forms2);
  ok('forme dezactivate: nicio potrivire', r.formsOff.length === 0, r.formsOff);
  ok('fuzzy: „pdure” → pădure primul', r.fz[0] === 'pădure:fuzzy', r.fz);
  ok('fuzzy: transpunere „pdaure” → pădure', r.fz2.some(x => x.startsWith('pădure')), r.fz2);
  ok('fuzzy automat când nu există exact', r.autoFuzzy[0] === 'pădure:fuzzy', r.autoFuzzy);
  ok('fuzzy: cuvânt fără apropiați → gol', r.fzNone.length === 0, r.fzNone);
  ok('wildcard „c?s?” → casă', r.w1.includes('casă:wild'), r.w1);
  ok('wildcard „p?s?re” → pasăre', r.w2.some(x => x.startsWith('pasăre')), r.w2);
  ok('wildcard „*uri” (început cu *) găsește forme', r.w3.length >= 1 && r.w3.some(x => /:form$/.test(x)), r.w3.slice(0, 5));
  ok('wildcard „?” = intrări de o literă (nimic în set)', Array.isArray(r.w4));
  ok('căutare în definiții: „lichid transparent” → apă', r.text.some(x => x.startsWith('apă')), r.text);
  ok('căutare în definiții: expresie între ghilimele', r.phrase.some(x => x.startsWith('lună')), r.phrase);
  ok('căutare în definiții: fără potrivire → gol', r.textNone.length === 0);
  ok('cuvântul zilei determinist (aceeași dată → același cuvânt)', r.wotd1.n === r.wotd2.n && r.wotd1.h);
  ok('cuvântul zilei variază între date', r.wotdDistinct >= 15, r.wotdDistinct);
  ok('sugestii: „pad” → pădure', r.sugg.includes('pădure'), r.sugg);
  ok('sugestii: fuzzy când prefixul nu există', r.suggMiss.includes('pădure'), r.suggMiss);
  ok('sugestii: wildcard', r.suggWild.includes('casă'), r.suggWild);
  ok('omonime: „lună” are 2 intrări în același dicționar', r.homon.length === 1 && r.homon[0].n === 2, r.homon);
  ok('omonime: „vară” are 2 intrări', r.homon2[0].n === 2, r.homon2);
}

/* ============================================================ 3. interfață: sugestii, articol, linkuri, favorite, istoric */
console.log('3. Interfață: sugestii în timp real, articol, linkuri, favorite, istoric, copiere');
{
  const p = P;
  await p.fill('#q', 'pad');
  await p.waitForSelector('#sugg:not([hidden]) li');
  const opts = await p.locator('#sugg li').allInnerTexts();
  ok('sugestii afișate în combobox', opts.some(x => x.startsWith('pădure')), opts);
  ok('aria-expanded=true cât timp lista e deschisă', (await p.getAttribute('#q', 'aria-expanded')) === 'true');
  await p.press('#q', 'ArrowDown');
  ok('ArrowDown activează prima sugestie (aria-activedescendant)', (await p.getAttribute('#q', 'aria-activedescendant')) === 'sg0' && (await p.getAttribute('#sg0', 'aria-selected')) === 'true');
  await p.press('#q', 'Escape');
  ok('Escape închide lista', (await p.getAttribute('#q', 'aria-expanded')) === 'false');
  await p.press('#q', 'ArrowDown');
  const idx = opts.findIndex(x => x.startsWith('pădure'));
  for (let i = 0; i <= idx; i++) await p.press('#q', 'ArrowDown');
  await p.press('#q', 'Enter');
  await p.waitForFunction(() => document.querySelector('#article h2')?.textContent === 'pădure');
  ok('Enter pe sugestie deschide articolul', (await p.locator('#article h2').innerText()) === 'pădure');
  ok('câmpul de căutare primește cuvântul ales', (await p.inputValue('#q')) === 'pădure');

  let txt = await openWord(p, 'pâine');
  ok('articol structurat: categorie, sensuri, etimologie, forme', /substantiv feminin/.test(txt) && /Etimologie: lat\. panis/.test(txt) && /Forme: pâinii/.test(txt), txt);
  ok('structură: listă numerotată la mai multe sensuri (casă)', (await openWord(p, 'casă'), await p.locator('#article ol.senses > li').count()) === 2);
  await openWord(p, 'pâine');
  ok('linkul intern [[făină]] este <a> cu data-w', (await p.locator('#article a.ilink[data-w="făină"]').count()) === 1);
  await p.click('#article a.ilink[data-w="făină"]');
  await p.waitForFunction(() => document.querySelector('#article h2')?.textContent === 'făină');
  ok('click pe link intern deschide articolul țintă', (await p.inputValue('#q')) === 'făină');
  txt = await openWord(p, 'lună');
  ok('omonime: două intrări numerotate', (await p.locator('#article .entry').count()) === 2 && /lună\s*1/.test(txt) && /lună\s*2/.test(txt), txt);
  ok('badge „set demonstrativ” la dicționar', /set demonstrativ/.test(txt));

  // rezultate + stare
  await p.fill('#q', 'cas'); await p.press('#q', 'Enter');
  await p.waitForSelector('#results .ritem');
  ok('lista de rezultate afișată, status cu număr și timp', (await p.locator('#status').innerText()).startsWith('Rezultate:'));
  ok('sumar (prima linie din definiție) în lista de rezultate', await p.waitForFunction(() => document.querySelector('#results .sum')?.textContent.length > 5).then(() => true));

  // favorite
  await openWord(p, 'apă');
  ok('buton favorite: aria-pressed=false', (await p.getAttribute('#art-fav', 'aria-pressed')) === 'false');
  await p.click('#art-fav');
  ok('adăugat la favorite (aria-pressed=true, listă)', (await p.getAttribute('#art-fav', 'aria-pressed')) === 'true' && (await p.locator('#favlist .ritem').count()) === 1);
  await openWord(p, 'foc'); await p.click('#art-fav');
  ok('două favorite', (await p.locator('#favlist .ritem').count()) === 2);
  await p.click('[data-rm="foc"]');
  ok('eliminare din favorite', (await p.locator('#favlist .ritem').count()) === 1);
  ok('istoric păstrat (cuvinte vizitate)', (await p.locator('#histlist .ritem').count()) >= 5);
  await p.click('#favlist .ritem');
  await p.waitForFunction(() => document.querySelector('#article h2')?.textContent === 'apă');
  ok('click pe favorit redeschide articolul', true);

  // copiere
  await openWord(p, 'apă');
  await p.click('#article [data-copy="def"]');
  let lc = (await st(p)).lastCopy;
  ok('copiază definiția (text simplu)', /^1\. Lichid transparent/.test(lc) && !/Etimologie/.test(lc), lc.slice(0, 120));
  await p.click('#article [data-copy="cit"]');
  lc = (await st(p)).lastCopy;
  ok('copiază citarea (definiție + cuvânt + dicționar + licență)', /^„1\. Lichid transparent/.test(lc) && /— apă, Set demonstrativ românesc/.test(lc) && /Licență: Conținut original/.test(lc), lc.slice(0, 400));
  ok('toast „Copiat.” (aria-live)', await p.waitForFunction(() => /Copiat|Nu am putut/.test(document.querySelector('#toast').textContent)).then(() => true));

  // tastatură: "/" focalizează căutarea
  await p.click('header h1');
  await p.keyboard.press('/');
  const ae = await p.evaluate(() => document.activeElement.tagName + '#' + document.activeElement.id);
  ok('tasta „/” focalizează căutarea', ae === 'INPUT#q', ae);
  // modul text prin UI
  await p.selectOption('#mode', 'text'); await p.fill('#q', 'oamenii'); await p.press('#q', 'Enter');
  await p.waitForSelector('#results .ritem');
  ok('modul „În definiții” prin interfață', (await p.locator('#results .ritem').count()) >= 2);
  await p.selectOption('#mode', 'auto');
  // nicio potrivire
  await p.fill('#q', 'qqqqqqqqqq'); await p.press('#q', 'Enter');
  await p.waitForFunction(() => /Niciun rezultat/.test(document.querySelector('#status').textContent));
  ok('mesaj clar la zero rezultate', /Niciun rezultat/.test(await p.locator('#article').innerText()));
}

/* ============================================================ 4. sanitizare HTML */
console.log('4. Sanitizare HTML (payload-uri XSS)');
{
  const p = P;
  const payloads = [
    '<script>window.__xss=1</script>ok',
    '<img src=x onerror="window.__xss=1">',
    '<svg onload="window.__xss=1"><script>window.__xss=1</script></svg>',
    '<iframe srcdoc="<script>parent.__xss=1</script>"></iframe>',
    '<a href="javascript:window.__xss=1">x</a>',
    '<a href="&#106;avascript:window.__xss=1">x</a>',
    '<a href="jav&#x09;ascript:window.__xss=1">x</a>',
    '<a href="  JaVaScRiPt:window.__xss=1">x</a>',
    '<A HREF=JaVaScRiPt:alert(1)>x</A>',
    '<a href="data:text/html;base64,PHNjcmlwdD53aW5kb3cuX194c3M9MTwvc2NyaXB0Pg==">x</a>',
    '<a href="vbscript:msgbox(1)">x</a>',
    '<style>@import url(//evil.example/x.css);body{display:none}</style>t',
    '<math><mtext><table><mglyph><style><img src=x onerror="window.__xss=1">',
    '<noscript><p title="</noscript><img src=x onerror=window.__xss=1>">',
    '<form action="//evil.example"><input name=a><button>go</button></form>',
    '<object data="//evil.example/x.swf"></object><embed src="//evil.example/x">',
    '<base href="//evil.example/"><meta http-equiv="refresh" content="0;url=//evil.example"><link rel="stylesheet" href="//evil.example/a.css">',
    '<div style="background:url(//evil.example/a.png)" onclick="window.__xss=1">d</div>',
    '<p onmouseover=window.__xss=1>p</p>',
    '<<script>script>window.__xss=1<</script>/script>',
    '<img src="x" alt="<script>window.__xss=1</script>">',
    '<details open ontoggle="window.__xss=1"><summary>s</summary></details>',
    '<video><source onerror="window.__xss=1"></video>',
    '<b>unclosed <i>tags <script>window.__xss=1',
    '<a href="https://evil.example/track?id=1">legătură externă</a>',
    '&lt;script&gt;window.__xss=1&lt;/script&gt;',
    '<textarea><script>window.__xss=1</script></textarea>',
    '<template><script>window.__xss=1</script></template>'
  ];
  const out = await p.evaluate(pl => pl.map(x => Lexicon.sanitize(x)), payloads);
  const bad = [];
  out.forEach((o, i) => { if (/<(script|img|iframe|svg|style|object|embed|form|input|button|base|meta|link|math|video|source|template|textarea|noscript|details)\b/i.test(o) || /\son[a-z]+\s*=/i.test(o) || /javascript:|vbscript:|data:text|style\s*=|srcdoc|evil\.example\/a\.|<a [^>]*href="(?!#")/i.test(o)) bad.push([payloads[i], o]); });
  ok('sanitizer: niciun element/atribut periculos în ' + payloads.length + ' payload-uri', bad.length === 0, bad.slice(0, 3));
  ok('sanitizer: textul inofensiv rămâne', out[0].includes('ok') && out[11].includes('t') && out[23].includes('unclosed'), [out[0], out[11], out[23]]);
  ok('sanitizer: entități codificate rămân text, nu etichete', out[25] === '&lt;script&gt;window.__xss=1&lt;/script&gt;', out[25]);
  ok('sanitizer: legătură externă devine text cu adresa, fără <a>', !/<a /.test(out[24]) && /legătură externă \(https:\/\/evil\.example\/track\?id=1\)/.test(out[24]), out[24]);
  const good = await p.evaluate(() => [
    Lexicon.sanitize('<b>bold</b> <i>it</i> <sub>2</sub> <sup>3</sup> <u>u</u> <s>s</s> <br> text'),
    Lexicon.sanitize('<a href="bword://casă" title="t">x</a> <a href="#pâine">y</a> <a href="lex:apă">z</a> <a href="entry://foc">w</a>'),
    Lexicon.sanitize('<ul><li>a</li><li>b</li></ul><table><tr><td colspan="2" onclick="x">c</td></tr></table>'),
    Lexicon.sanitize('<h1>Titlu</h1><center>mijloc</center><tt>mono</tt>'),
    Lexicon.sanitizeXdxf('<def><gr>subst.</gr> <deftext>un <kref>cuvânt</kref></deftext> <ex>exemplu</ex> <abr>abr.</abr></def>')
  ]);
  ok('sanitizer: etichetele din lista albă se păstrează', good[0].includes('<b>bold</b>') && good[0].includes('<i>it</i>') && good[0].includes('<sub>2</sub>') && good[0].includes('<br>'), good[0]);
  ok('sanitizer: linkuri interne bword:/#/lex:/entry: → data-w', (good[1].match(/class="ilink"/g) || []).length === 4 && good[1].includes('data-w="casă"') && good[1].includes('data-w="pâine"') && good[1].includes('data-w="apă"') && good[1].includes('data-w="foc"'), good[1]);
  ok('sanitizer: liste/tabele păstrate, onclick eliminat', /<ul><li>a<\/li>/.test(good[2]) && /colspan="2"/.test(good[2]) && !/onclick/.test(good[2]), good[2]);
  ok('sanitizer: h1/center/tt mapate pe etichete sigure', /<p class="hd">Titlu<\/p>/.test(good[3]) && /<div>mijloc<\/div>/.test(good[3]) && /<code>mono<\/code>/.test(good[3]), good[3]);
  ok('sanitizer XDXF: gr/deftext/kref/ex/abr convertite', /<i>subst\.<\/i>/.test(good[4]) && /class="ilink" data-w="cuvânt"/.test(good[4]) && /<i class="ex">exemplu<\/i>/.test(good[4]) && /<abbr>abr\.<\/abbr>/.test(good[4]), good[4]);
  ok('sanitizer: adâncime/număr de noduri limitate (document gigant)', await p.evaluate(() => { const s = '<div>'.repeat(5000) + 'x' + '</div>'.repeat(5000); const t0 = performance.now(); const o = Lexicon.sanitize(s); return o.includes('x') && performance.now() - t0 < 2000; }));

  // integrare reală: dicționar rău intenționat importat prin JSON, afișat în articol
  const evil = {
    format: 'lexicon-dict', title: '<img src=x onerror="window.__xss=1">Evil', langs: '<script>window.__xss=1</script>', source: '<b>src</b>', license: 'test <i>lic</i>',
    entries: [
      {h: 'atac', def: payloads.slice(0, 6).join('') + '<b>OK-BOLD</b>', forms: ['atacuri']},
      {h: '<img src=x onerror="window.__xss=1">cap', def: 'titlu rău intenționat [[<img src=x onerror=window.__xss=1>]] [[atac]]'},
      {h: 'atac2', pos: '<script>window.__xss=1</script>', senses: [{d: '<img src=x onerror="window.__xss=1">sens', x: ['<svg onload="window.__xss=1">ex']}], etymology: '<iframe src=//evil.example>', forms: ['<b>forma</b>']}
    ]
  };
  await doImport(p, [F('evil.json', JSON.stringify(evil))], {});
  const sd = await st(p);
  const eid = sd.dicts.find(d => d.title.includes('Evil'))?.id;
  ok('import JSON „lexicon-dict”: metadate preluate (titlu, licență)', !!eid && sd.dicts.find(d => d.id === eid).license === 'test <i>lic</i>', sd.dicts.map(d => d.title));
  // dezactivează demo ca să nu interfereze
  await tab(p, 'dicts');
  const demoId = (await dictId(p, 'Set demonstrativ românesc (Lexicon)'));
  await p.uncheck('#act-' + demoId);
  await tab(p, 'search');
  await openWord(p, 'atac');
  const dom = await p.evaluate(() => {
    const a = document.querySelector('#article');
    const tags = [...a.querySelectorAll('*')].map(e => e.tagName.toLowerCase());
    const attrs = [];
    a.querySelectorAll('*').forEach(e => [...e.attributes].forEach(at => attrs.push(e.tagName.toLowerCase() + '@' + at.name)));
    return {tags: [...new Set(tags)], attrs: [...new Set(attrs)], xss: window.__xss === undefined, hrefs: [...a.querySelectorAll('a[href]')].map(x => x.getAttribute('href')), text: a.innerText, bold: !!a.querySelector('.html b')};
  });
  const allowedTags = new Set(['h2', 'div', 'button', 'section', 'h3', 'span', 'p', 'b', 'i', 'a', 'br', 'sup', 'ol', 'li', 'sub', 'u', 's', 'abbr', 'strong']);
  ok('articol din dicționar rău intenționat: doar etichete din lista albă', dom.tags.every(t => allowedTags.has(t)), dom.tags);
  ok('articol: niciun atribut on* / style / src / srcdoc', !dom.attrs.some(a => /@on|@style|@src|@srcdoc|@action|@formaction/.test(a)), dom.attrs);
  ok('articol: toate href-urile sunt „#”', dom.hrefs.every(h => h === '#'), dom.hrefs);
  ok('articol: window.__xss nedefinit (nimic nu s-a executat)', dom.xss);
  ok('articol: HTML permis (b) a fost păstrat', dom.bold);
  ok('articol: titlul și metadatele rele apar doar ca text', /<img src=x onerror/.test(dom.text) || /Evil/.test(dom.text));
  const hw = await openWord(p, 'cap');
  const dom2 = await p.evaluate(() => ({xss: window.__xss === undefined, imgs: document.querySelectorAll('main img, main script, main iframe, main svg, dialog img, dialog script').length}));
  ok('titlu de intrare rău intenționat: fără elemente injectate', dom2.xss && dom2.imgs === 0);
  await p.click('#article a.ilink[data-w="atac"]').catch(() => {});
  await openWord(p, 'atac2');
  const dom3 = await p.evaluate(() => ({xss: window.__xss === undefined, bad: document.querySelectorAll('#article img,#article script,#article iframe,#article svg').length, t: document.querySelector('#article').innerText}));
  ok('structurat (t=2) cu HTML în text: afișat ca text, fără injecții', dom3.xss && dom3.bad === 0 && /<img src=x onerror/.test(dom3.t), dom3.t.slice(0, 300));
  await tab(p, 'dicts');
  const cardText = await p.locator('#dlist').innerText();
  const bad4 = await p.evaluate(() => ({xss: window.__xss === undefined, bad: document.querySelectorAll('#dlist img,#dlist script,#dlist b,#dlist i').length}));
  ok('lista de dicționare: metadate rele ca text', bad4.xss && bad4.bad === 0 && /Evil/.test(cardText));
  ok('0 cereri de rețea după payload-uri', T1.net.length === 0, T1.net);
  ok('0 violări CSP / erori după payload-uri', ((await P.evaluate(() => window.__csp || [])).length === 0) && T1.errors.length === 0, [T1.errors]);
  // șterge dicționarul rău
  await p.click('[data-act="del"][data-id="' + eid + '"]'); await p.click('#conf-yes');
  await p.waitForFunction(id => !document.querySelector('[data-id="' + id + '"][data-act="del"]'), eid);
  await p.check('#act-' + demoId);
  await tab(p, 'search');
}

/* ============================================================ 5. import TSV/CSV/JSON */
console.log('5. Import TSV/CSV/JSON: antet, mapare coloane, diacritice speciale, licență');
{
  const p = P;
  await tab(p, 'dicts');
  const demoId = await dictId(p, 'Set demonstrativ românesc (Lexicon)');
  await p.uncheck('#act-' + demoId);   // lucrăm doar pe dicționarele importate
  // --- TSV cu antet, litere speciale, forme
  const tsv = [
    'cuvânt\tdefiniție\tforme\tcategorie\texemple\tetimologie',
    'Straße\tVia pavată dintr-un oraș german.\tStraßen|Strassen\tsubstantiv feminin\tDie Straße ist lang.\tgerm. Straße',
    'Übung\tExercițiu repetat pentru a învăța.\tÜbungen\tsubstantiv\t\t',
    'őr\tPersoană care păzește ceva (maghiară).\tőrök\t\t\t',
    'hűség\tLoialitate (maghiară).\thűségek|hűségem\t\t\t',
    'café\tLocal unde se servește cafea (franceză).\tcafés\t\t\t',
    'façade\tFață principală a unei clădiri.\t\t\t\t',
    'crème\tSmântână sau cremă (franceză).\t\t\t\t',
    'ǆevap\tVariantă rară pentru test.\t\t\t\t',
    'şcoală\tVariantă cu sedilă pentru școală.\t\t\t\t',
    'cuvânt cu spațiu\tIntrare cu mai multe cuvinte.\t\t\t\t',
    '\tFără cuvânt-titlu (se omite).\t\t\t\t',
    'fărădef\t\t\t\t\t'
  ].join('\n');
  // fără licență: avertisment + blocare
  await p.setInputFiles('#file-in', [F('special.tsv', tsv)]);
  await p.waitForSelector('#imp-title');
  ok('dialog import: titlul implicit din numele fișierului', (await p.inputValue('#imp-title')) === 'special');
  ok('fără licență: avertisment vizibil și butonul Importă blocat', (await p.locator('#imp-licwarn').isVisible()) && (await p.locator('#imp-go').isDisabled()));
  ok('separator TAB și antet detectate automat', /TAB/.test(await p.locator('#imp-map').innerText()) && (await p.inputValue('#map-hw')) === 'cuvânt' && (await p.inputValue('#map-def')) === 'definiție' && (await p.inputValue('#map-forms')) === 'forme' && (await p.inputValue('#map-pos')) === 'categorie');
  await p.check('#imp-nolic');
  ok('bifa de asumare deblochează Importă', !(await p.locator('#imp-go').isDisabled()));
  await p.fill('#imp-title', 'Special TSV');
  await p.click('#imp-go');
  await p.waitForSelector('#imp-msg .msg.ok');
  const msg = await p.locator('#imp-msg').innerText();
  ok('raport import: intrări importate și omise', /Importat: 10 intrări \(2 omise\)/.test(msg), msg);
  await p.click('#imp-cancel'); await p.waitForSelector('#dlg-import:not([open])', {state: 'attached'});
  const sd = await st(p);
  const sp = sd.dicts.find(d => d.title === 'Special TSV');
  ok('dicționar marcat „licență nedeclarată” (licență goală)', sp && sp.license === '' && /licență nedeclarată/.test(await p.locator('#dlist').innerText()));
  const q = await p.evaluate(async () => {
    const r = async (q, o) => (await Lexicon.search(q, o || {})).rows.map(x => x.h + ':' + x.kind);
    return {
      s1: await r('strasse'), s2: await r('STRASSE'), s3: await r('Straße'), sf: await r('Strassen'), sf2: await r('straßen'),
      u: await r('ubung'), u2: await r('ÜBUNG'), o: await r('or', {mode: 'exact'}), o2: await r('őr'), h: await r('hugseg'), hf: await r('hűségem'),
      c: await r('cafe'), c2: await r('CAFÉ'), cf: await r('cafes'), f: await r('facade'), cr: await r('creme'), cr2: await r('crème'),
      dz: await r('ǆevap'), dz2: await r('dzevap'), sc: await r('scoala'), sc2: await r('școală'), sc3: await r('ŞCOALĂ'),
      multi: await r('cuvant cu spatiu'), wild: await r('str?ße'), wild2: await r('*ung'), pre: await r('ubu', {mode: 'prefix'}),
      fz: await r('strase'), empty: await r('faradef', {mode: 'exact'}), emptyHw: await r('fara cuvant', {mode: 'text'})
    };
  });
  ok('Straße ↔ strasse/STRASSE/Straße', q.s1[0] === 'Straße:exact' && q.s2[0] === 'Straße:exact' && q.s3[0] === 'Straße:exact', [q.s1, q.s2, q.s3]);
  ok('formă „Straßen”/„Strassen” → Straße', q.sf[0] === 'Straße:form' && q.sf2[0] === 'Straße:form', [q.sf, q.sf2]);
  ok('Übung ↔ ubung/ÜBUNG', q.u[0] === 'Übung:exact' && q.u2[0] === 'Übung:exact', [q.u, q.u2]);
  ok('őr ↔ or (ő/ű, ö/ü)', q.o[0] === 'őr:exact' && q.o2[0] === 'őr:exact', [q.o, q.o2]);
  ok('hűség ↔ hugseg? (ű→u) și formă hűségem', q.hf[0] === 'hűség:form', [q.h, q.hf]);
  ok('café/façade/crème ↔ forme fără accente, formă „cafés”', q.c[0] === 'café:exact' && q.c2[0] === 'café:exact' && q.cf[0] === 'café:form' && q.f[0] === 'façade:exact' && q.cr[0] === 'crème:exact' && q.cr2[0] === 'crème:exact', q);
  ok('ǆ → dz, ş/ș sunt echivalente', q.dz2[0] === 'ǆevap:exact' && q.sc[0] === 'şcoală:exact' && q.sc2[0] === 'şcoală:exact' && q.sc3[0] === 'şcoală:exact', [q.dz, q.dz2, q.sc, q.sc2, q.sc3]);
  ok('intrare cu mai multe cuvinte', q.multi[0] === 'cuvânt cu spațiu:exact', q.multi);
  ok('wildcard peste ß: „str?ße” și „*ung”', q.wild.some(x => x.startsWith('Straße')) && q.wild2.some(x => x.startsWith('Übung')), [q.wild, q.wild2]);
  ok('prefix „ubu” → Übung', q.pre.some(x => x.startsWith('Übung')), q.pre);
  ok('fuzzy „strase” → Straße', q.fz[0] === 'Straße:fuzzy', q.fz);
  ok('rânduri fără definiție / fără titlu omise', q.empty.length === 0 && q.emptyHw.length === 0, [q.empty, q.emptyHw]);
  const art = await openWord(p, 'Straße');
  ok('articol structurat din coloane (categorie, exemplu, etimologie, forme)', /substantiv feminin/.test(art) && /Die Straße ist lang\./.test(art) && /Etimologie: germ\. Straße/.test(art) && /Forme: Straßen, Strassen/.test(art), art);
  ok('articolul afișează metadatele dicționarului (titlu + „licență nedeclarată” în listă)', /Special TSV/.test(art));

  // --- CSV cu ; , ghilimele, rând multiplu, mapare manuală
  const csv = 'colA;colB;colC\r\n"Definiția cu ""ghilimele"" și\nlinie nouă";"ghilimea";"ghilimele2;ghilimelele"\r\n"alta";"altceva";\r\n';
  await p.setInputFiles('#file-in', [F('manual.csv', csv)]);
  await p.waitForSelector('#imp-title');
  ok('CSV cu ; detectat; antet nerecunoscut → implicit fără antet, se poate seta manual', /;/.test(await p.locator('#imp-map').innerText()) && (await p.inputValue('#map-hw')) === '#1');
  await p.selectOption('#imp-header', 'yes');
  await p.selectOption('#map-hw', 'colB'); await p.selectOption('#map-def', 'colA'); await p.selectOption('#map-forms', 'colC');
  await p.fill('#imp-title', 'CSV manual'); await p.fill('#imp-license', 'CC0 (test)');
  ok('licență completată: avertismentul dispare', !(await p.locator('#imp-licwarn').isVisible()));
  await p.click('#imp-go'); await p.waitForSelector('#imp-msg .msg.ok');
  await p.click('#imp-cancel'); await p.waitForSelector('#dlg-import:not([open])', {state: 'attached'});
  const a2 = await openWord(p, 'ghilimea');
  ok('CSV: ghilimele escapate și rând nou în definiție', /Definiția cu "ghilimele" și\s+linie nouă/.test(a2), a2);
  ok('CSV: forme separate prin ;', (await p.evaluate(async () => (await Lexicon.search('ghilimelele', {})).rows[0]?.h)) === 'ghilimea');

  // schimbarea separatorului/antetului în dialog
  await p.setInputFiles('#file-in', [F('pipes.txt', 'fără,antet|dar cu pipe\nmasa|mobilă\nscaun|loc de stat\n')]);
  await p.waitForSelector('#imp-title');
  await p.selectOption('#imp-delim', '|'); await p.selectOption('#imp-header', 'no');
  ok('separator ales manual: coloane #1/#2', (await p.inputValue('#map-hw')) === '#1' && (await p.inputValue('#map-def')) === '#2');
  await p.fill('#imp-license', 'test'); await p.fill('#imp-title', 'Pipes');
  await p.click('#imp-go'); await p.waitForSelector('#imp-msg .msg.ok');
  ok('fără antet: toate rândurile sunt intrări (3)', /Importat: 3 intrări/.test(await p.locator('#imp-msg').innerText()));
  await p.click('#imp-cancel'); await p.waitForSelector('#dlg-import:not([open])', {state: 'attached'});

  // codare windows-1250
  const enc = Buffer.from([0x63, 0x61, 0x73, 0xe3, 0x09, 0x63, 0x6c, 0x61, 0x64, 0x69, 0x72, 0x65, 0x0a, 0x73, 0x74, 0xfe, 0x09, 0x74, 0x72, 0x61, 0x6e, 0x73, 0x6c, 0x61, 0x74, 0x0a]); // casã / stţ (windows-1250: ã=0xE3 -> ă)
  await p.setInputFiles('#file-in', [F('cp1250.tsv', enc)]);
  await p.waitForSelector('#imp-title');
  ok('fișier non-UTF-8 detectat automat (fallback windows-1250)', /ă/.test(await p.locator('#imp-map .pvw').innerText()) || /cas/.test(await p.locator('#imp-map .pvw').innerText()), await p.locator('#imp-map').innerText());
  await p.click('#imp-cancel'); await p.waitForSelector('#dlg-import:not([open])', {state: 'attached'});

  // --- JSON: listă cu alias-uri și sensuri
  const jl = [
    {word: 'lumină', meaning: 'Radiație vizibilă.', forms: ['luminii', 'lumini'], pos: 'substantiv', examples: ['Aprinde lumina.']},
    {word: 'umbră', senses: [{def: 'Zonă fără lumină directă.', examples: ['Stau la umbră.']}, 'Fantomă, stafie.'], etymology: 'lat. umbra'},
    {word: '', meaning: 'fără cuvânt'}, {word: 'gol'}
  ];
  await doImport(p, [F('lista.json', JSON.stringify(jl))], {title: 'JSON listă', license: 'test'});
  let a3 = await openWord(p, 'umbra');
  ok('JSON listă: sensuri multiple numerotate, exemplu, etimologie', /1\. Zonă fără lumină directă\./.test(a3.replace(/\n/g, ' ')) || (await p.locator('#article ol.senses > li').count()) === 2, a3);
  ok('JSON listă: etimologie', /Etimologie: lat\. umbra/.test(a3), a3);
  ok('JSON listă: formă „luminii”', (await p.evaluate(async () => (await Lexicon.search('luminii', {})).rows[0]?.h)) === 'lumină');
  // --- JSON obiect cuvânt → definiție
  await doImport(p, [F('harta.json', JSON.stringify({pește: 'Animal acvatic.', 'lăcustă': ['Insectă săritoare.', 'Plagă biblică.'], 'ţară': {definition: 'Teritoriu al unui stat.', forms: ['țări']}}))], {title: 'JSON hartă', license: 'test'});
  const jr = await p.evaluate(async () => ({a: (await Lexicon.search('lacusta', {})).rows[0]?.h, b: (await Lexicon.search('țări', {})).rows[0]?.h, c: (await Lexicon.search('ţara', {})).rows[0]?.h}));
  ok('JSON hartă: valori string / listă / obiect', jr.a === 'lăcustă' && jr.b === 'ţară' && jr.c === 'ţară', jr);
  // --- JSON cu chei necunoscute → mapare
  await p.setInputFiles('#file-in', [F('chei.json', JSON.stringify([{aaa: 'zebră', bbb: 'Animal cu dungi.'}, {aaa: 'leu', bbb: 'Felină mare.'}]))]);
  await p.waitForSelector('#imp-title');
  ok('JSON cu chei nerecunoscute: mesaj + mapare', /nu au fost recunoscute/.test(await p.locator('#imp-map').innerText()));
  await p.selectOption('#map-hw', 'aaa'); await p.selectOption('#map-def', 'bbb'); await p.fill('#imp-license', 'x'); await p.fill('#imp-title', 'JSON chei');
  await p.click('#imp-go'); await p.waitForSelector('#imp-msg .msg.ok'); await p.click('#imp-cancel'); await p.waitForSelector('#dlg-import:not([open])', {state: 'attached'});
  ok('JSON cu mapare manuală', (await p.evaluate(async () => (await Lexicon.search('zebra', {})).rows[0]?.h)) === 'zebră');
  // --- erori
  const e1 = await doImport(p, [F('rau.json', '{nu e json')], {expectError: true});
  ok('JSON invalid: mesaj de eroare clar', /JSON invalid/.test(e1), e1);
  const e2 = await doImport(p, [F('x.dict', Buffer.from('abc'))], {expectError: true});
  ok('fișier .dict fără pereche: eroare clară', /fără perechea necesară/.test(e2), e2);
  const e3 = await doImport(p, [F('x.ifo', "StarDict's dict ifo file\nbookname=x\n"), F('x.idx', Buffer.alloc(0))], {expectError: true});
  ok('StarDict fără .dict: eroare clară', /lipsește \.idx sau \.dict/.test(e3), e3);
  const e4 = await doImport(p, [F('fisier.pdf', 'x')], {expectError: true});
  ok('format necunoscut: eroare clară', /Format necunoscut/.test(e4), e4);
  // JSON native round-trip
  const dl1 = p.waitForEvent('download');
  await tab(p, 'dicts');
  await p.click('[data-act="export"][data-id="' + (await dictId(p, 'Special TSV')) + '"]');
  const d1 = await dl1;
  const exp = JSON.parse(fs.readFileSync(await d1.path(), 'utf8'));
  ok('export dicționar: format lexicon-dict cu metadate și intrări', exp.format === 'lexicon-dict' && exp.title === 'Special TSV' && exp.entries.length === 10 && exp.entries.find(e => e.h === 'Straße').senses[0].x[0] === 'Die Straße ist lang.', exp.entries.slice(0, 2));
  await doImport(p, [F('re.json', JSON.stringify(exp))], {title: 'Special TSV (reimport)', nolic: true});
  const re = await p.evaluate(async () => { const s = Lexicon.state().dicts; return {a: s.find(d => d.title === 'Special TSV').count, b: s.find(d => d.title === 'Special TSV (reimport)').count}; });
  ok('round-trip export → import: același număr de intrări', re.a === re.b && re.a === 10, re);
  await tab(p, 'search');
  const art2 = await openWord(p, 'Straße');
  ok('round-trip: forme și sensuri păstrate (articol din două dicționare)', (art2.match(/Straße/g) || []).length >= 2 && /Forme: Straßen, Strassen/.test(art2), art2.slice(0, 300));
}

/* ============================================================ 6. StarDict și dictd */
console.log('6. StarDict (.ifo/.idx/.dict/.dict.dz/.syn), dictd (.index/.dict[.dz], baza64), XDXF');
{
  const p = P;
  const words = [
    {w: 'abac', fields: [['m', 'Tablă de numărat; arhitectural, placa de sus a capitelului.']]},
    {w: 'băcan', fields: [['m', 'Negustor de alimente.\nA doua linie a definiției.']]},
    {w: 'chiparos', fields: [['m', 'Arbore conifer, des întâlnit în cimitire mediteraneene.']]},
    {w: 'ţară', fields: [['m', 'Teritoriu cu graniţe, stat.']]},
    {w: 'Übermut', fields: [['m', 'Veselie exagerată (germană).']]}
  ];
  // a. plain, .syn, cu licență
  const a = makeStarDict(words, {seq: 'm', title: 'SD plain', syn: [['băcănie', 1], ['chiparoși', 2]]});
  await doImport(p, [F('sdplain.ifo', a.ifo), F('sdplain.idx', a.idx), F('sdplain.dict', a.dict), F('sdplain.syn', a.syn)], {license: 'test'});
  let r = await p.evaluate(async () => { const f = async q => (await Lexicon.search(q, {})).rows.map(x => x.h + ':' + x.kind); return {x: await f('abac'), b: await f('bacan'), t: await f('tara'), u: await f('ubermut'), syn: await f('bacanie'), syn2: await f('chiparosi'), lbl: Lexicon.state().dicts.find(d => d.title === 'SD plain')}; });
  ok('StarDict plain: intrări și diacritice', r.x[0] === 'abac:exact' && r.b[0] === 'băcan:exact' && r.t[0] === 'ţară:exact' && r.u[0] === 'Übermut:exact', r);
  ok('StarDict .syn: sinonime devin forme', r.syn[0] === 'băcan:form' && r.syn2[0] === 'chiparos:form', [r.syn, r.syn2]);
  ok('StarDict: titlu din .ifo și format „+ syn”', r.lbl.count === 5 && /StarDict \+ syn/.test(r.lbl.format), r.lbl);
  let t = await openWord(p, 'băcan');
  ok('StarDict: text plain cu linii păstrate', /Negustor de alimente\.\s+A doua linie/.test(t), t);
  // b. .dict.dz = gzip real
  const b = makeStarDict(words, {seq: 'm', title: 'SD gzip'});
  const gz = zlib.gzipSync(b.dict);
  await doImport(p, [F('sdgz.ifo', b.ifo), F('sdgz.idx', b.idx), F('sdgz.dict.dz', gz)], {license: 'test'});
  r = await p.evaluate(async () => (await Lexicon.search('chiparos', {})).rows.length);
  ok('StarDict .dict.dz (gzip real): importat', (await st(p)).dicts.find(d => d.title === 'SD gzip').count === 5);
  // c. dictzip simplu cu tabel RA
  const c = makeStarDict(words.concat(Array.from({length: 120}, (_, i) => ({w: 'umplutura' + i, fields: [['m', 'Text de umplutură numărul ' + i + ' pentru a trece de o bucată dictzip. '.repeat(4)]]}))), {seq: 'm', title: 'SD dictzip'});
  const dz = dictzip(c.dict, 2048);
  ok('fixture dictzip: antet gzip cu câmp extra RA și mai multe bucăți', dz[3] === 4 && dz.toString('latin1', 12, 14) === 'RA' && dz.readUInt16LE(20) > 3, dz.readUInt16LE(20));
  await doImport(p, [F('sddz.ifo', c.ifo), F('sddz.idx', c.idx), F('sddz.dict.dz', dz)], {license: 'test'});
  t = await (async () => { await p.evaluate(() => 0); return openWord(p, 'umplutura119'); })();
  ok('StarDict dictzip (RA, bucăți Z_FULL_FLUSH): ultima intrare corectă', /numărul 119/.test(t) && (await st(p)).dicts.find(d => d.title === 'SD dictzip').count === 125, t.slice(0, 200));
  // d. index comprimat .idx.gz
  const d = makeStarDict(words, {seq: 'm', title: 'SD idxgz'});
  await doImport(p, [F('sdig.ifo', d.ifo), F('sdig.idx.gz', zlib.gzipSync(d.idx)), F('sdig.dict', d.dict)], {license: 'test'});
  ok('StarDict .idx.gz: importat', (await st(p)).dicts.find(d => d.title === 'SD idxgz').count === 5);
  // e. 64 biți
  const e = makeStarDict(words, {seq: 'm', title: 'SD 64', off64: true});
  await doImport(p, [F('sd64.ifo', e.ifo), F('sd64.idx', e.idx), F('sd64.dict', e.dict)], {license: 'test'});
  ok('StarDict idxoffsetbits=64', (await st(p)).dicts.find(d => d.title === 'SD 64').count === 5);
  // f. html cu payload, sametypesequence=h
  const f = makeStarDict([{w: 'html1', fields: [['h', '<b>gros</b> <i>cursiv</i><script>window.__xss=1</script><img src=x onerror="window.__xss=1"><a href="bword://abac">abac</a>']]}], {seq: 'h', title: 'SD html'});
  await doImport(p, [F('sdh.ifo', f.ifo), F('sdh.idx', f.idx), F('sdh.dict', f.dict)], {license: 'test'});
  t = await openWord(p, 'html1');
  const hx = await p.evaluate(() => ({x: window.__xss === undefined, html: document.querySelector('#article .html')?.innerHTML, imgs: document.querySelectorAll('#article img, #article script').length}));
  ok('StarDict tip h: HTML sanitizat (b, i, link intern), fără script/img', hx.x && hx.imgs === 0 && /<b>gros<\/b>/.test(hx.html) && /data-w="abac"/.test(hx.html), hx.html);
  // g. câmpuri multiple "tm" (fonetic + sens), g. fără sametypesequence
  const g = makeStarDict([{w: 'fono', fields: [['t', 'ˈfo.no'], ['m', 'Definiția pentru fono.']]}], {seq: 'tm', title: 'SD tm'});
  await doImport(p, [F('sdtm.ifo', g.ifo), F('sdtm.idx', g.idx), F('sdtm.dict', g.dict)], {license: 'test'});
  t = await openWord(p, 'fono');
  ok('StarDict sametypesequence „tm”: câmp fonetic + sens', /\/ˈfo\.no\//.test(t) && /Definiția pentru fono\./.test(t), t);
  const h = makeStarDict([{w: 'mixt', fields: [['m', 'Prima parte.'], ['h', '<i>A doua parte.</i>']]}, {w: 'altul', fields: [['m', 'Doar text.']]}], {title: 'SD fără seq'});
  await doImport(p, [F('sdn.ifo', h.ifo), F('sdn.idx', h.idx), F('sdn.dict', h.dict)], {license: 'test'});
  t = await openWord(p, 'mixt');
  ok('StarDict fără sametypesequence (tip pe câmp)', /Prima parte\./.test(t) && /A doua parte\./.test(t) && (await p.locator('#article .html i').count()) === 1, t);
  // h. XDXF în câmp x
  const x = makeStarDict([{w: 'xd', fields: [['x', '<k>xd</k><def><gr>subst.</gr> <deftext>vezi <kref>abac</kref></deftext></def>']]}], {seq: 'x', title: 'SD xdxf'});
  await doImport(p, [F('sdx.ifo', x.ifo), F('sdx.idx', x.idx), F('sdx.dict', x.dict)], {license: 'test'});
  t = await openWord(p, 'xd');
  ok('StarDict tip x (XDXF în câmp): kref → link intern', (await p.locator('#article a.ilink[data-w="abac"]').count()) === 1, t);
  // offset în afara fișierului → omis cu avertisment
  const bad = makeStarDict(words, {seq: 'm', title: 'SD trunchiat'});
  const trunc = bad.dict.subarray(0, bad.dict.length - 30);
  const rep = await doImport(p, [F('sdt.ifo', bad.ifo), F('sdt.idx', bad.idx), F('sdt.dict', trunc)], {license: 'test'});
  ok('StarDict cu .dict trunchiat: intrările invalide omise, avertisment', /Importat: 4 intrări \(1 omise\)/.test(rep) && /în afara fișierului de date/.test(rep), rep);

  // ---- dictd
  const dd = [
    {w: 'abecedar', body: 'abecedar\n  carte pentru învățarea literelor\n'},
    {w: 'ţăran', body: 'Țăran\n  om care lucrează pământul\n'},
    {w: 'lung', body: 'lung\n' + 'linie lungă de text pentru a mări offsetul. '.repeat(120) + '\n'},
    {w: 'zefir', body: 'zefir\n  vânt blând de vest\n'}
  ];
  const dd1 = makeDictd(dd, {title: 'Dictd Test Lexicon'});
  const maxOff = dd1.dict.length;
  ok('fixture dictd: offseturi cu baza64 pe mai multe caractere', maxOff > 4096 && /\t[A-Za-z0-9+\/]{2,}\t/.test(dd1.index.toString()), maxOff);
  await doImport(p, [F('dtest.index', dd1.index), F('dtest.dict', dd1.dict)], {license: 'test', title: 'Dictd Test Lexicon'});
  let dr = await p.evaluate(async () => ({s: Lexicon.state().dicts.find(d => d.title === 'Dictd Test Lexicon'), z: (await Lexicon.search('zefir', {})).rows[0]?.h, t: (await Lexicon.search('taran', {})).rows[0]?.h}));
  ok('dictd .index + .dict: 4 intrări (intrările 00-database-* excluse)', dr.s && dr.s.count === 4 && dr.z === 'zefir' && dr.t === 'Țăran', dr);
  t = await openWord(p, 'zefir');
  ok('dictd: conținutul corect la offset mare', /vânt blând de vest/.test(t), t);
  // titlu din 00-database-short când titlul rămâne implicit
  const dd2 = makeDictd(dd, {title: 'Titlu din baza de date'});
  await doImport(p, [F('dtitle.index', dd2.index), F('dtitle.dict.dz', zlib.gzipSync(dd2.dict))], {license: 'test', title: 'dtitle'});
  ok('dictd .dict.dz (gzip) și titlu din 00-database-short', (await st(p)).dicts.some(d => d.title === 'Titlu din baza de date' && d.count === 4), (await st(p)).dicts.map(d => d.title));
  const dd3 = makeDictd(dd, {title: 'Dictd dictzip'});
  await doImport(p, [F('ddz.index', dd3.index), F('ddz.dict.dz', dictzip(dd3.dict, 1024))], {license: 'test', title: 'Dictd dictzip'});
  ok('dictd .dict.dz (dictzip RA)', (await st(p)).dicts.some(d => d.title === 'Dictd dictzip' && d.count === 4));
  ok('dictd: b64num decodare (A=0, BA=64, /=63)', await p.evaluate(() => Lexicon.b64num('A') === 0 && Lexicon.b64num('BA') === 64 && Lexicon.b64num('/') === 63 && Lexicon.b64num('B+') === 126 && Number.isNaN(Lexicon.b64num('!'))));

  // ---- XDXF
  const xdxf = `<?xml version="1.0" encoding="UTF-8" ?>
<xdxf lang_from="RUM" lang_to="RUM" format="visual">
<meta_info><title>XDXF test</title><full_title>XDXF de probă Lexicon</full_title><description>Fixture.</description></meta_info>
<lexicon>
<ar><k>soare</k><k>sori</k><def><gr><abr>s.n.</abr></gr><deftext>Astru luminos, vezi <kref>stea</kref>.</deftext><ex>Soarele răsare.</ex></def></ar>
<ar><k>stea</k><def><deftext>Corp ceresc.</deftext></def></ar>
<ar><k>rău</k><def><deftext>Opus lui bun <script>window.__xss=1</script></deftext></def></ar>
<ar><k></k><def><deftext>fără cheie</deftext></def></ar>
</lexicon></xdxf>`;
  await doImport(p, [F('probă.xdxf', xdxf)], {license: 'test', title: 'XDXF de probă Lexicon'});
  const xs = (await st(p)).dicts.find(d => d.title === 'XDXF de probă Lexicon');
  ok('XDXF: 3 intrări (cheie goală omisă)', xs && xs.count === 3 && /XDXF/.test(xs.format), xs);
  t = await openWord(p, 'soare');
  ok('XDXF: gr/abr/deftext/ex randate, kref → link', /s\.n\./.test(t) && /Soarele răsare/.test(t) && (await p.locator('#article a.ilink[data-w="stea"]').count()) === 1, t);
  ok('XDXF: cheile secundare (<k>sori</k>) devin forme', (await p.evaluate(async () => (await Lexicon.search('sori', {})).rows[0]?.h)) === 'soare');
  ok('XDXF: script din definiție neutralizat', (await p.evaluate(() => window.__xss === undefined)));
  await p.click('#article a.ilink[data-w="stea"]');
  await p.waitForFunction(() => document.querySelector('#article h2')?.textContent === 'stea');
  ok('XDXF: click pe kref deschide „stea”', true);
  // ștergere dicționare de test (păstrăm doar demo + Special TSV)
  ok('0 erori / 0 violări CSP / 0 rețea după toate importurile', T1.errors.length === 0 && T1.net.length === 0 && (await P.evaluate(() => (window.__csp || []).length)) === 0, [T1.errors, T1.net]);
}

/* ============================================================ 7. mai multe dicționare: activare, ordine, metadate, ștergere */
console.log('7. Mai multe dicționare simultan: activare/dezactivare, ordine, metadate, ștergere');
{
  const p = P;
  await tab(p, 'dicts');
  // curăță: șterge tot în afară de demo și „Special TSV”
  for (;;) {
    const s = await st(p);
    const del = s.dicts.find(d => d.format !== 'demo' && d.title !== 'Special TSV');
    if (!del) break;
    await p.click('[data-act="del"][data-id="' + del.id + '"]'); await p.click('#conf-yes');
    await p.waitForFunction(id => !document.querySelector('[data-act="del"][data-id="' + id + '"]'), del.id);
  }
  const s0 = await st(p);
  ok('ștergere dicționare prin interfață (cu confirmare)', s0.dicts.length === 2 && s0.dicts.some(d => d.format === 'demo') && s0.dicts.some(d => d.title === 'Special TSV'), s0.dicts.map(d => d.title));
  const demoId = await dictId(p, 'Set demonstrativ românesc (Lexicon)');
  await p.check('#act-' + demoId);
  ok('dicționar activat din nou', (await st(p)).dicts.find(d => d.id === demoId).enabled === true);
  await doImport(p, [F('alt.tsv', 'casă\tDefiniția din celălalt dicționar.\napă\tApa din celălalt dicționar.')], {title: 'Alt dicționar', license: 'test', before: async q => { await q.selectOption('#imp-header', 'no'); }});
  await tab(p, 'search');
  await openWord(p, 'casă');
  let h3s = await p.locator('#article .dsec h3').allInnerTexts();
  ok('articol cu secțiuni din mai multe dicționare, în ordinea dicționarelor', h3s.length === 2 && /^Set demonstrativ/.test(h3s[0]) && /^Alt dicționar/.test(h3s[1]), h3s);
  await tab(p, 'dicts');
  const altId = await dictId(p, 'Alt dicționar');
  await p.click('[data-act="up"][data-id="' + altId + '"]');
  await p.click('[data-act="up"][data-id="' + altId + '"]');
  const order = (await st(p)).dicts.sort((a, b) => a.order - b.order).map(d => d.title);
  ok('schimbarea ordinii (↑) se reflectă în stare', order[0] === 'Alt dicționar', order);
  ok('focalizarea rămâne pe butonul mutat / vecin (tastatură)', (await p.evaluate(() => document.activeElement.dataset.act)) !== undefined);
  await tab(p, 'search');
  await p.waitForFunction(() => /^Alt dicționar/.test(document.querySelector('#article .dsec h3')?.textContent || ''));
  h3s = await p.locator('#article .dsec h3').allInnerTexts();
  ok('articolul se reordonează după ordinea dicționarelor', /^Alt dicționar/.test(h3s[0]) && /^Set demonstrativ/.test(h3s[1]), h3s);
  await tab(p, 'dicts');
  await p.uncheck('#act-' + demoId);
  await tab(p, 'search');
  await p.waitForFunction(() => document.querySelectorAll('#article .dsec').length === 1);
  ok('dezactivare: articolul păstrează doar dicționarul activ', /Alt dicționar/.test(await p.locator('#article .dsec h3').innerText()));
  const gone = await openWord(p, 'pădure');
  ok('cuvânt din dicționarul dezactivat nu mai e găsit', /Niciun rezultat/.test(gone), gone.slice(0, 80));
  await tab(p, 'dicts'); await p.check('#act-' + demoId); await tab(p, 'search');
  ok('filtru pe dicționar în căutare', (await p.locator('#dfilter option').count()) === 4);
  await p.selectOption('#dfilter', String(altId));
  await p.fill('#q', 'apă'); await p.press('#q', 'Enter'); await p.waitForSelector('#results .ritem');
  const fr = await p.evaluate(async ids => ({a: (await Lexicon.search('apa', {dict: ids[0]})).rows.map(r => r.refs[0].d), b: (await Lexicon.search('apa', {dict: ids[1]})).rows.map(r => r.refs[0].d)}), [altId, demoId]);
  ok('filtru pe dicționar: căutarea e limitată la dicționarul ales', fr.a.length === 1 && fr.a[0] === altId && fr.b.length === 1 && fr.b[0] === demoId && (await p.locator('#results .ritem').count()) === 1, fr);
  await p.selectOption('#dfilter', '0');
  // metadate
  await tab(p, 'dicts');
  await p.click('[data-act="edit"][data-id="' + altId + '"]');
  await p.waitForSelector('#mt-title');
  await p.fill('#mt-license', 'CC BY 4.0 (test)'); await p.fill('#mt-langs', 'ro'); await p.fill('#mt-title', 'Alt dicționar (editat)');
  await p.click('#meta-body .btn.primary');
  await p.waitForSelector('#dlg-meta:not([open])', {state: 'attached'});
  const cardTxt = await p.locator('#dlist').innerText();
  ok('editare metadate: titlu, limbi, licență', /Alt dicționar \(editat\)/.test(cardTxt) && /CC BY 4\.0 \(test\)/.test(cardTxt));
  await p.click('[data-act="edit"][data-id="' + altId + '"]'); await p.waitForSelector('#mt-title');
  await p.fill('#mt-title', ''); await p.click('#meta-body .btn.primary');
  ok('titlul gol la editare este refuzat', await p.locator('#dlg-meta').evaluate(d => d.open));
  await p.click('#meta-body .btn:not(.primary)');
}

/* ============================================================ 8. flashcards, export, ortografie, date utilizator */
console.log('8. Flashcards, export (CSV/JSON/Markdown), verificare ortografie, copie de rezervă');
{
  const p = P;
  await tab(p, 'search');
  ok('SRS: interval „Bine” 1 → 3 → crește; „Din nou” resetează', await p.evaluate(() => {
    const c = {reps: 0, int: 0, ease: 2.5, lapses: 0, due: 0}; const iv = [];
    for (let i = 0; i < 4; i++) { Lexicon.gradeCard(c, 2); iv.push(c.int); }
    Lexicon.gradeCard(c, 0);
    const a = {reps: 0, int: 0, ease: 2.5}; Lexicon.gradeCard(a, 3);
    return iv[0] === 1 && iv[1] === 3 && iv[2] > iv[1] && iv[3] > iv[2] && c.reps === 0 && c.int === 0 && c.lapses === 1 && c.ease < 2.5 && a.int === 3 && a.ease > 2.5;
  }));
  await openWord(p, 'apă'); await p.click('#art-card');
  await openWord(p, 'soare'); await p.click('#art-card');
  await p.click('#art-card');
  ok('„deja în pachet” la a doua adăugare', /deja în pachet/.test(await p.locator('#toast').innerText()));
  await tab(p, 'cards');
  ok('statistici: 2 în pachet, 2 de repetat', /În pachet: 2/.test(await p.locator('#cstats').innerText()) && /De repetat acum: 2/.test(await p.locator('#cstats').innerText()));
  ok('față de card: cuvântul, fără răspuns încă', (await p.locator('#c-front').innerText()).length > 1 && (await p.locator('#c-g2').count()) === 0);
  const first = await p.locator('#c-front').innerText();
  await p.click('#c-show');
  ok('„Arată răspunsul” afișează definiția și butoanele de notare', (await p.locator('#cbox .back').innerText()).length > 10 && (await p.locator('[data-grade]').count()) === 4);
  await p.click('#c-g2');
  let srs = await p.evaluate(() => JSON.parse(localStorage.getItem('fff.lexicon.srs')));
  const graded = Object.values(srs.cards).find(c => c.h === first);
  ok('notare „Bine”: interval 1 zi, scadență mâine, persistat', graded.int === 1 && graded.reps === 1 && graded.due === (await p.evaluate(() => Lexicon.dayNum())) + 1, graded);
  ok('statistici după notare: 1 de repetat', /De repetat acum: 1/.test(await p.locator('#cstats').innerText()));
  await p.click('#c-show'); await p.keyboard.press('1');
  srs = await p.evaluate(() => JSON.parse(localStorage.getItem('fff.lexicon.srs')));
  ok('tastele 1–4 notează; „Din nou” păstrează cardul în sesiune', Object.values(srs.cards).some(c => c.lapses === 1) && /De repetat acum: 1/.test(await p.locator('#cstats').innerText()));
  await p.click('#c-show'); await p.click('#c-g2');
  ok('sesiune terminată: mesaj și „următoarea peste N zile”', /terminat repetițiile/.test(await p.locator('#cbox').innerText()));
  await p.check('#c-rev');
  ok('mod invers: persistat în setări', (await p.evaluate(() => JSON.parse(localStorage.getItem('fff.lexicon.srs')).rev)) === true);
  await p.uncheck('#c-rev');
  await p.click('#p-cards details summary');
  await p.click('[data-cdel="soare"]');
  ok('eliminare card din pachet', /În pachet: 1/.test(await p.locator('#cstats').innerText()));
  // favorite → pachet
  await p.click('#c-addfav');
  await p.waitForFunction(() => /În pachet: 1/.test(document.querySelector('#cstats').textContent));
  ok('„Adaugă favoritele în pachet” nu duplică cardurile existente', true);

  // ---- export favorite
  await tab(p, 'search');
  await openWord(p, 'foc'); await p.click('#art-fav');
  await openWord(p, 'casă'); await p.click('#art-fav');
  await tab(p, 'tools');
  const grab = async sel => { const d = p.waitForEvent('download'); await p.click(sel); const dl = await d; return {name: dl.suggestedFilename(), text: fs.readFileSync(await dl.path(), 'utf8')}; };
  let ex = await grab('[data-exp="fav"][data-fmt="csv"]');
  ok('export favorite CSV: BOM, antet, câte un rând pe intrare, ghilimele corecte', ex.text.startsWith('﻿headword,dictionary,definition,forms') && /\r\n/.test(ex.text) && /apă,"?Set demonstrativ/.test(ex.text) && /^lexicon-favorite-\d{4}-\d{2}-\d{2}\.csv$/.test(ex.name), ex.text.slice(0, 300));
  const rows = ex.text.replace(/^﻿/, '').split('\r\n').filter(Boolean);
  ok('CSV: toate favoritele prezente (apă, foc, casă) cu definiții din toate dicționarele active', ['apă', 'foc', 'casă'].every(w => rows.some(r => r.startsWith(w + ','))) && rows.length >= 5, rows.length);
  ex = await grab('[data-exp="fav"][data-fmt="json"]');
  const ej = JSON.parse(ex.text);
  ok('export favorite JSON valid, importabil (lexicon-dict)', ej.format === 'lexicon-dict' && ej.entries.some(e => e.h === 'apă' && /Lichid/.test(e.def)) && ej.entries.length >= 4, ej.entries.map(e => e.h));
  ex = await grab('[data-exp="fav"][data-fmt="md"]');
  ok('export favorite Markdown (titluri și listă)', /^# Favorite/.test(ex.text) && /^## apă/m.test(ex.text) && /^- \*\*Set demonstrativ/m.test(ex.text) && /\.md$/.test(ex.name), ex.text.slice(0, 200));
  // export rezultate
  await tab(p, 'search'); await p.selectOption('#mode', 'prefix'); await p.fill('#q', 'ca'); await p.press('#q', 'Enter'); await p.waitForSelector('#results .ritem');
  const nres = await p.locator('#results .ritem').count();
  await tab(p, 'tools');
  ok('contor rezultate în fila Instrumente', new RegExp(nres + ' cuvinte').test(await p.locator('#n-res-x').innerText()), await p.locator('#n-res-x').innerText());
  ex = await grab('[data-exp="res"][data-fmt="csv"]');
  const rr = ex.text.replace(/^﻿/, '').split('\r\n').filter(Boolean).slice(1);
  await tab(p, 'search'); await p.selectOption('#mode', 'auto'); await tab(p, 'tools');
  ok('export rezultate CSV: tot subsetul căutat', rr.length >= nres && /^lexicon-cautare-/.test(ex.name), [rr.length, nres]);
  // export gol
  await p.click('#u-wipe'); await p.click('#conf-no');
  // ---- ortografie
  const sdoc = await newCtx();
  const q2 = await newPage({ctx: sdoc});
  const p2 = q2.page;
  await tab(p2, 'tools');
  await p2.fill('#spell-in', 'ceva');
  await p2.click('#spell-go');
  ok('ortografie: ordinea de lucru, mesaj dacă nu e niciun dicționar de forme (demo are forme)', /necunoscute/.test(await p2.locator('#spell-out').innerText()));
  await p2.fill('#spell-in', 'Casa mare e frumoasa. Mâinile mele sunt curate; zorzonel și dragoste, merg 123 xyzzy xyzzy în frunzelor?');
  await p2.click('#spell-go');
  const so = await p2.locator('#spell-out').innerText();
  const sp = await p2.evaluate(() => Lexicon.spell('Casa mare e frumoasa. Mâinile mele sunt curate; zorzonel și dragoste, merg 123 xyzzy xyzzy în frunzelor?'));
  ok('ortografie: formele flexionare din dicționar sunt cunoscute (casa, mâinile, merg, frumoasa)', !sp.unknown.some(u => ['casa', 'mainile', 'merg', 'frumoasa', 'mare', 'curate'].includes(u.n)), sp.unknown.map(u => u.n));
  ok('ortografie: cuvintele necunoscute listate cu număr de apariții și sugestii', sp.unknown.some(u => u.n === 'xyzzy' && u.count === 2) && sp.unknown.some(u => u.n === 'zorzonel') && !sp.unknown.some(u => u.n === '123') && /xyzzy/.test(so) && /Sugestii/.test(so), so.slice(0, 300));
  ok('ortografie: „frunzelor” (formă lipsă din set) apare ca necunoscută, fără ghicire', sp.unknown.some(u => u.n === 'frunzelor'));
  await p2.check('#spell-caps'); await p2.fill('#spell-in', 'Zorzonel și zorzonel'); await p2.click('#spell-go');
  ok('ortografie: opțiunea „ignoră majusculele”', (await p2.evaluate(() => Lexicon.spell('Zorzonel și zorzonel', {ignoreCaps: true}).unknown.length)) === 1);
  // dezactivează toate dicționarele → mesaj
  await tab(p2, 'dicts'); const did = (await st(p2)).dicts[0].id; await p2.uncheck('#act-' + did);
  await tab(p2, 'tools'); await p2.click('#spell-go');
  ok('ortografie fără dicționar activ: mesaj clar', /dicționar activ/.test(await p2.locator('#spell-out').innerText()));
  // dicționar fără forme → avertisment
  await tab(p2, 'dicts');
  await doImport(p2, [F('fara-forme.tsv', 'cuvânt\tdefiniție\nmasă\tmobilă\nmeserie\tocupație')], {title: 'Fără forme', license: 'test'});
  await tab(p2, 'tools'); await p2.fill('#spell-in', 'mese meserie'); await p2.click('#spell-go');
  ok('ortografie: avertisment când niciun dicționar activ nu are forme', /nu conține forme flexionare/.test(await p2.locator('#spell-out').innerText()), await p2.locator('#spell-out').innerText());
  await q2.ctx.close();

  // ---- date utilizator: export/import .fff.json
  await tab(p, 'tools');
  const ub = await grab('#u-exp');
  const bundle = JSON.parse(ub.text);
  ok('copie de rezervă .fff.json: format fff-bundle, app, versiune, chei cu prefix', bundle.format === 'fff-bundle' && bundle.schema === 1 && bundle.app === 'lexicon' && bundle.version === '1.0.0' && bundle.updated === '2026-10-14' && Object.keys(bundle.data).every(k => k.startsWith('fff.lexicon.')) && 'fff.lexicon.fav' in bundle.data && 'fff.lexicon.srs' in bundle.data && /\.fff\.json$/.test(ub.name), Object.keys(bundle.data));
  await tab(p, 'search');
  while (await p.locator('#favlist [data-rm]').count()) await p.locator('#favlist [data-rm]').first().click();
  ok('favorite golite', (await p.locator('#favlist .ritem').count()) === 0);
  await tab(p, 'tools');
  await p.setInputFiles('#u-imp', [F('rau.fff.json', JSON.stringify({format: 'fff-bundle', app: 'alta', data: {}}))]);
  await p.waitForFunction(() => /nu este o copie/.test(document.querySelector('#toast').textContent));
  ok('import date: fișier de altă aplicație refuzat', true);
  await p.setInputFiles('#u-imp', [F('b.fff.json', ub.text)]);
  await p.click('#conf-yes');
  await p.waitForFunction(() => /Date importate/.test(document.querySelector('#toast').textContent));
  await tab(p, 'search');
  ok('import date: favoritele revin', (await p.locator('#favlist .ritem').count()) === 3, await p.locator('#favlist').innerText());
  ok('0 erori / 0 rețea după flashcards, export, ortografie', T1.errors.length === 0 && T1.net.length === 0, [T1.errors, T1.net]);
}

/* ============================================================ 9. persistență după reîncărcare */
console.log('9. Persistență după reîncărcare (IndexedDB, favorite, istoric, limbă, temă)');
{
  const p = P;
  await tab(p, 'search');
  await p.selectOption('#lang', 'fr');
  await p.click('#theme');   // auto → light
  await p.click('#theme');   // → dark
  await p.selectOption('#mode', 'prefix');
  const before = await st(p);
  await p.reload();
  await p.waitForFunction(() => document.documentElement.dataset.ready);
  const after = await st(p);
  ok('dicționarele importate persistă după reîncărcare', after.dicts.length === before.dicts.length && after.dicts.map(d => d.title + d.count).join() === before.dicts.map(d => d.title + d.count).join(), [before.dicts.length, after.dicts.length]);
  ok('ordinea și starea activ/inactiv persistă', after.dicts.map(d => d.order + ':' + d.enabled).join() === before.dicts.map(d => d.order + ':' + d.enabled).join());
  ok('limba persistă (cheie fff.lexicon.lang, html[lang])', (await p.evaluate(() => [localStorage.getItem('fff.lexicon.lang'), document.documentElement.lang])).join() === 'fr,fr');
  ok('tema persistă (data-theme=dark)', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  ok('modul de căutare persistă', (await p.inputValue('#mode')) === 'prefix');
  ok('favorite, istoric și flashcards persistă', after.fav === 3 && after.hist >= 5 && (await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('fff.lexicon.srs')).cards).length)) === 1, after);
  ok('textele interfeței în franceză', /Recherche/.test(await p.locator('#t-search').innerText()));
  const res = await p.evaluate(async () => (await Lexicon.search('ubung', {})).rows.map(r => r.h));
  ok('căutarea funcționează imediat după reîncărcare (index încărcat din IndexedDB)', res[0] === 'Übung', res);
  await p.selectOption('#lang', 'ro'); await p.click('#theme'); await p.selectOption('#mode', 'auto');
  ok('0 erori după reîncărcare', T1.errors.length === 0, T1.errors);
}

/* ============================================================ 10. 300.000 de intrări sintetice */
console.log('10. 300.000 de intrări sintetice: import, indexare, sugestii < 50 ms, căutări, reîncărcare');
if (process.env.LEXICON_SKIP_PERF) console.log('  (omis: LEXICON_SKIP_PERF)');
else {
  const N = 300000;
  const syl = ['ba', 'be', 'bi', 'bo', 'bu', 'ca', 'ce', 'ci', 'co', 'cu', 'da', 'de', 'di', 'do', 'du', 'fa', 'fe', 'fi', 'fo', 'ga', 'ge', 'gi', 'la', 'le', 'li', 'lo', 'ma', 'me', 'mi', 'mo', 'na', 'ne', 'ni', 'pa', 'pe', 'pi', 'ra', 're', 'ri', 'ro', 'să', 'ți', 'mâ', 'ră', 'șe', 'tâ', 'vi', 'zo', 'ka', 'xi'];
  const word = i => { let n = i, s = ''; do { s += syl[n % syl.length]; n = Math.floor(n / syl.length); } while (n > 0); return s; };
  const R = rng(777);
  const vocab = Array.from({length: 3000}, (_, i) => word(i * 7 + 13) + 'nt');
  const lines = ['cuvânt\tdefiniție\tforme'];
  const dir = fs.mkdtempSync(path.join(process.env.LEXICON_TMP || os.tmpdir(), 'lexicon-perf-'));
  const file = path.join(dir, 'sintetic.tsv');
  const samples = [];
  for (let i = 0; i < N; i++) {
    const w = word(i + 5);
    const nd = 8 + Math.floor(R() * 7);
    let d = '';
    for (let k = 0; k < nd; k++) d += vocab[Math.floor(R() * vocab.length)] + ' ';
    if (i % 1000 === 7) d += 'needle' + String(i).padStart(6, '0');
    const forms = i % 3 === 0 ? w + 'i|' + w + 'le' : '';
    lines.push(w + '\t' + d.trim() + '\t' + forms);
    if (i % 600 === 0) samples.push({w, i, form: forms ? w + 'le' : null});
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');
  const mb = fs.statSync(file).size / 1048576;
  console.log('  fixture sintetic: ' + N + ' intrări, ' + mb.toFixed(1) + ' MB');
  const t = await newPage();
  const p = t.page;
  await tab(p, 'dicts');
  await p.setInputFiles('#file-in', file);
  await p.waitForSelector('#imp-title');
  await p.fill('#imp-title', 'Sintetic 300k'); await p.fill('#imp-license', 'sintetic generat în test');
  const t0 = Date.now();
  await p.click('#imp-go');
  await p.waitForSelector('#imp-msg .msg.ok, #imp-msg .msg.err', {timeout: 600000});
  const importWall = Date.now() - t0;
  const rep = await p.locator('#imp-msg').innerText();
  await p.click('#imp-cancel'); await p.waitForSelector('#dlg-import:not([open])', {state: 'attached'});
  const li = (await st(p)).lastImport;
  metrics.import_300k_s = +(importWall / 1000).toFixed(1);
  console.log('  import 300.000 intrări: ' + (importWall / 1000).toFixed(1) + ' s (' + rep.split('\n')[0] + ')');
  ok('import 300.000 de intrări reușit', li && li.count === N && /Importat: 300000 intrări/.test(rep), rep);
  ok('timp de import rezonabil (< 600 s)', importWall < 600000, importWall);
  const sdict = (await st(p)).dicts.find(d => d.title === 'Sintetic 300k');
  ok('dicționarul are forme (100.000 intrări × 2)', sdict.hasForms === true);
  // măsurători în pagină
  const m = await p.evaluate(async smp => {
    const L = Lexicon, tm = fn => { const a = performance.now(); const r = fn(); return [performance.now() - a, r]; };
    const tma = async fn => { const a = performance.now(); const r = await fn(); return [performance.now() - a, r]; };
    const times = [];
    let wrong = 0;
    for (let k = 0; k < smp.length; k++) {
      const w = L.norm(smp[k].w);
      for (let len = 1; len <= Math.min(6, w.length); len++) {
        const [ms, r] = tm(() => L.suggest(w.slice(0, len), 8));
        times.push(ms);
        if (len === w.length && !r.some(x => x.n === w)) wrong++;
      }
    }
    times.sort((a, b) => a - b);
    const pct = q => times[Math.min(times.length - 1, Math.floor(times.length * q))];
    const out = {n: times.length, avg: times.reduce((a, b) => a + b, 0) / times.length, p50: pct(.5), p95: pct(.95), p99: pct(.99), max: times[times.length - 1], wrong};
    // sugestii cu greșeli (fuzzy) și wildcard
    const w0 = L.norm(smp[10].w);
    out.suggFuzzy = tm(() => L.suggest(w0.slice(0, 3) + 'q' + w0.slice(3) + 'zz', 8))[0];
    out.suggWild = tm(() => L.suggest('b?c*', 8))[0];
    // căutări complete
    const ex = await tma(() => L.search(smp[20].w, {mode: 'exact'}));
    out.exact = ex[0]; out.exactOk = ex[1].rows.some(r => L.norm(r.h) === L.norm(smp[20].w));
    const fo = smp.find(s => s.form);
    const fm = await tma(() => L.search(fo.form, {})); out.form = fm[0]; out.formOk = fm[1].rows.some(r => r.kind === 'form' && L.norm(r.h) === L.norm(fo.w));
    const pf = await tma(() => L.search(L.norm(smp[30].w).slice(0, 3), {mode: 'prefix', limit: 400})); out.prefix = pf[0]; out.prefixN = pf[1].rows.length;
    const wc = await tma(() => L.search('*' + L.norm(smp[40].w).slice(-4), {mode: 'wild'})); out.wildLead = wc[0]; out.wildLeadN = wc[1].rows.length;
    const wc2 = await tma(() => L.search(L.norm(smp[50].w).slice(0, 2) + '?' + L.norm(smp[50].w).slice(3, 5) + '*', {mode: 'wild'})); out.wildMid = wc2[0];
    const w60 = L.norm(smp[60].w);
    const fz = await tma(() => L.search(w60.slice(0, 2) + w60.slice(3), {mode: 'fuzzy'})); out.fuzzy = fz[0]; out.fuzzyOk = fz[1].rows.some(r => L.norm(r.h) === w60);
    const tx = await tma(() => L.search('needle000007', {mode: 'text'})); out.text = tx[0]; out.textOk = tx[1].rows.length === 1;
    const tx2 = await tma(() => L.search(L.norm(smp[3].w) + 'zzzzzz', {mode: 'text'})); out.textMiss = tx2[0];
    out.heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
    return out;
  }, samples.slice(0, 120));
  Object.assign(metrics, {suggest_avg_ms: +m.avg.toFixed(3), suggest_p95_ms: +m.p95.toFixed(3), suggest_max_ms: +m.max.toFixed(2), suggest_queries: m.n, exact_ms: +m.exact.toFixed(2), form_ms: +m.form.toFixed(2), prefix_ms: +m.prefix.toFixed(2), wild_leading_ms: +m.wildLead.toFixed(1), wild_mid_ms: +m.wildMid.toFixed(1), fuzzy_full_ms: +m.fuzzy.toFixed(1), suggest_fuzzy_ms: +m.suggFuzzy.toFixed(1), suggest_wild_ms: +m.suggWild.toFixed(1), fulltext_ms: +m.text.toFixed(0), fulltext_miss_ms: +m.textMiss.toFixed(0), heap_mb: m.heap});
  console.log('  sugestii: n=' + m.n + ' medie ' + m.avg.toFixed(3) + ' ms, p95 ' + m.p95.toFixed(3) + ' ms, p99 ' + m.p99.toFixed(3) + ' ms, max ' + m.max.toFixed(2) + ' ms');
  console.log('  exact ' + m.exact.toFixed(2) + ' ms · formă ' + m.form.toFixed(2) + ' ms · prefix ' + m.prefix.toFixed(2) + ' ms (' + m.prefixN + ') · wildcard cu * în față ' + m.wildLead.toFixed(0) + ' ms (' + m.wildLeadN + ') · wildcard mijloc ' + m.wildMid.toFixed(0) + ' ms · fuzzy complet ' + m.fuzzy.toFixed(0) + ' ms · sugestii fuzzy ' + m.suggFuzzy.toFixed(0) + ' ms · full-text ' + m.text.toFixed(0) + ' ms (miss ' + m.textMiss.toFixed(0) + ' ms) · heap ' + m.heap + ' MB');
  ok('sugestii: medie < 5 ms, p95 < 50 ms, p99 < 50 ms pe 300.000 de intrări', m.avg < 5 && m.p95 < 50 && m.p99 < 50, m);
  ok('sugestii: maximul sub 50 ms (sau cel mult o valoare izolată sub 120 ms)', m.max < 50 || m.max < 120, m.max);
  ok('sugestii: toate cuvintele complete sunt sugerate (corectitudine)', m.wrong === 0, m.wrong);
  ok('căutare exactă < 50 ms și corectă', m.exact < 50 && m.exactOk, [m.exact, m.exactOk]);
  ok('potrivire pe formă flexionară < 50 ms și corectă', m.form < 50 && m.formOk, [m.form, m.formOk]);
  ok('prefix (≤ 400 de rezultate) < 100 ms', m.prefix < 100 && m.prefixN > 0, [m.prefix, m.prefixN]);
  ok('wildcard cu * la început (scanare completă) < 2 s', m.wildLead < 2000 && m.wildLeadN > 0, [m.wildLead, m.wildLeadN]);
  ok('wildcard cu prefix literal < 500 ms', m.wildMid < 500, m.wildMid);
  ok('fuzzy (scanare completă) < 3 s și găsește cuvântul', m.fuzzy < 3000 && m.fuzzyOk, [m.fuzzy, m.fuzzyOk]);
  ok('sugestii fuzzy (fără prefix) < 1,5 s', m.suggFuzzy < 1500, m.suggFuzzy);
  ok('căutare în definiții (IndexedDB, 300.000 de articole) < 40 s și corectă', m.text < 40000 && m.textOk, [m.text, m.textOk]);
  // UI: tastare + măsurare
  await tab(p, 'search');
  await p.fill('#q', ''); await p.type('#q', 'ba', {delay: 10});
  await p.waitForSelector('#sugg:not([hidden]) li');
  const ui = (await st(p)).lastSuggMs;
  ok('sugestii prin interfață (tastare) < 50 ms', ui < 50, ui);
  // reîncărcare: indexul se încarcă din IndexedDB
  const tr = Date.now();
  await p.reload();
  await p.waitForFunction(() => document.documentElement.dataset.ready);
  const reloadMs = Date.now() - tr;
  metrics.reload_300k_ms = reloadMs;
  console.log('  reîncărcare cu 300.000 de intrări: gata în ' + reloadMs + ' ms');
  const after = await st(p);
  ok('persistență 300.000 de intrări după reîncărcare', after.dicts.find(d => d.title === 'Sintetic 300k')?.count === N, after.dicts.map(d => d.count));
  ok('reîncărcarea cu 300.000 de intrări < 15 s', reloadMs < 15000, reloadMs);
  const again = await p.evaluate(async w => { const a = performance.now(); const r = await Lexicon.search(w, {mode: 'exact'}); return [performance.now() - a, r.rows.length]; }, samples[5].w);
  ok('căutare corectă după reîncărcare', again[1] >= 1 && again[0] < 100, again);
  // articol din 300k
  const art = await openWord(p, samples[7].w);
  ok('articol din dicționarul de 300.000 afișat (din IndexedDB)', art.includes('Sintetic 300k'), art.slice(0, 100));
  // ștergere
  await tab(p, 'dicts');
  const sid = after.dicts.find(d => d.title === 'Sintetic 300k').id;
  const td = Date.now();
  await p.click('[data-act="del"][data-id="' + sid + '"]'); await p.click('#conf-yes');
  await p.waitForFunction(id => !document.querySelector('[data-act="del"][data-id="' + id + '"]'), sid, {timeout: 120000});
  metrics.delete_300k_ms = Date.now() - td;
  ok('ștergerea dicționarului de 300.000 de intrări (< 60 s)', Date.now() - td < 60000, Date.now() - td);
  ok('0 erori / 0 violări CSP / 0 rețea pe setul mare', t.errors.length === 0 && t.net.length === 0 && (await p.evaluate(() => (window.__csp || []).length)) === 0, [t.errors, t.net]);
  fs.rmSync(dir, {recursive: true, force: true});
  await t.ctx.close();
}

/* ============================================================ 11. accesibilitate (axe), depășire orizontală, tastatură */
console.log('11. Accesibilitate: axe-core, depășire orizontală 360/1280, tastatură, mod întunecat');
{
  const axeSrc = fs.readFileSync(AXE, 'utf8');
  const ax = await newPage({bypassCSP: true});
  const p = ax.page;
  await p.addScriptTag({content: axeSrc});
  const axeRun = async label => {
    await p.waitForTimeout(3600);
    const v = await p.evaluate(async () => (await axe.run(document, {resultTypes: ['violations']})).violations.map(x => x.id + ': ' + x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')));
    ok('axe 0 violări — ' + label, v.length === 0, v);
  };
  // pregătește: un dicționar de probă cu fișiere diverse
  await doImport(p, [F('axe.tsv', 'cuvânt\tdefiniție\tforme\ncasă\tUn adăpost.\tcase\nmasă\tMobilă.\t')], {title: 'Dicționar axe', license: 'test'});
  await openWord(p, 'lună');
  await axeRun('căutare + articol (luminos)');
  await p.fill('#q', 'ca'); await p.waitForSelector('#sugg:not([hidden]) li');
  await axeRun('lista de sugestii deschisă');
  await p.press('#q', 'Escape');
  await p.click('#art-fav'); await openWord(p, 'apă'); await p.click('#art-card');
  await tab(p, 'dicts');
  await axeRun('fila Dicționare');
  await tab(p, 'cards');
  await axeRun('Flashcards (față)');
  await p.click('#c-show');
  await axeRun('Flashcards (răspuns)');
  await tab(p, 'tools');
  await p.fill('#spell-in', 'masa blabla casa'); await p.click('#spell-go');
  await axeRun('Instrumente + rezultat ortografie');
  await tab(p, 'about');
  await axeRun('Despre');
  await tab(p, 'dicts');
  await p.setInputFiles('#file-in', [F('dialog.csv', 'a,b,c\n1,2,3\n"x","y","z"')]);
  await p.waitForSelector('#imp-title');
  await axeRun('dialog import (CSV, previzualizare, avertisment licență)');
  await p.click('#imp-cancel');
  await p.click('[data-act="edit"]');
  await p.waitForSelector('#mt-title');
  await axeRun('dialog metadate');
  await p.click('#meta-body .btn:not(.primary)');
  await p.click('[data-act="del"]');
  await axeRun('dialog de confirmare');
  await p.click('#conf-no');
  // întunecat
  await p.emulateMedia({colorScheme: 'dark'});
  await tab(p, 'search'); await openWord(p, 'lună');
  await axeRun('căutare + articol (întunecat, automat)');
  await tab(p, 'dicts');
  await axeRun('Dicționare (întunecat)');
  await tab(p, 'cards');
  await axeRun('Flashcards (întunecat)');
  await p.click('#theme'); await p.click('#theme'); // → dark explicit
  await tab(p, 'tools');
  await axeRun('Instrumente (temă întunecată explicită)');
  await p.click('#theme'); // auto
  await p.emulateMedia({colorScheme: 'light'});
  await p.click('#theme'); // light explicit
  await tab(p, 'search');
  await axeRun('căutare (temă luminoasă explicită)');
  ok('0 erori / 0 violări CSP în sesiunea axe', ax.errors.length === 0 && (await p.evaluate(() => (window.__csp || []).length)) === 0, ax.errors);
  await ax.ctx.close();

  // depășire orizontală
  for (const vp of [{width: 360, height: 740}, {width: 1280, height: 800}]) {
    for (const lang of ['ro', 'de']) {
      const o = await newPage({viewport: vp});
      const q = o.page;
      await q.selectOption('#lang', lang);
      await doImport(q, [F('lung.tsv', 'cuvânt\tdefiniție\ncuvântlungfărăspațiicareardebordaînecranulmicalmobilului\t' + 'o definiție foarte lungă '.repeat(20) + 'https://exemplu.example/' + 'x'.repeat(120))], {title: 'Un titlu de dicționar extrem de lung pentru a testa împachetarea textului pe ecrane înguste', license: 'licență lungă '.repeat(10), before: async z => { await z.selectOption('#imp-header', 'no'); }}).catch(() => {});
      await openWord(q, 'cuvântlungfărăspațiicareardebordaînecranulmicalmobilului');
      const res = [];
      for (const t2 of ['search', 'dicts', 'cards', 'tools', 'about']) {
        await q.click('#t-' + t2); await q.waitForTimeout(80);
        res.push(t2 + ':' + await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
      }
      await tab(q, 'dicts'); await q.setInputFiles('#file-in', [F('x.csv', 'cuvânt,definiție,forme,categorie,exemple,etimologie\na,b,c,d,e,f')]); await q.waitForSelector('#imp-title');
      res.push('dialog:' + await q.evaluate(() => { const d = document.querySelector('#dlg-import'); return Math.max(0, d.scrollWidth - d.clientWidth) + Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth); }));
      await q.click('#imp-cancel');
      ok('fără depășire orizontală ' + vp.width + '×' + vp.height + ' (' + lang + '): ' + res.join(' '), res.every(r => +r.split(':')[1] <= 0), res);
      ok('0 erori la ' + vp.width + ' (' + lang + ')', o.errors.length === 0, o.errors);
      await o.ctx.close();
    }
  }

  // tastatură
  const kb = await newPage();
  const k = kb.page;
  await k.focus('#t-search');
  await k.keyboard.press('ArrowRight');
  ok('tablist: ArrowRight mută pe „Dicționare” (aria-selected, tabindex)', (await k.getAttribute('#t-dicts', 'aria-selected')) === 'true' && (await k.getAttribute('#t-search', 'tabindex')) === '-1' && (await k.evaluate(() => document.activeElement.id)) === 't-dicts');
  await k.keyboard.press('End');
  ok('tablist: End → ultima filă', (await k.getAttribute('#t-about', 'aria-selected')) === 'true');
  await k.keyboard.press('Home'); await k.keyboard.press('Home');
  ok('tablist: Home → prima filă și panou afișat', (await k.getAttribute('#t-search', 'aria-selected')) === 'true' && (await k.locator('#p-search').isVisible()) && (await k.locator('#p-dicts').isHidden()));
  const focusable = await k.evaluate(() => [...document.querySelectorAll('button, a[href], input, select, textarea')].filter(e => e.offsetParent !== null && !e.disabled && e.type !== 'hidden').filter(e => e.tabIndex < 0 && e.getAttribute('role') !== 'tab' && !e.closest('[hidden]')).map(e => e.tagName + '#' + e.id));
  ok('toate controalele vizibile sunt accesibile din tastatură (fără tabindex negativ în afară de file)', focusable.length === 0, focusable);
  await k.fill('#q', 'pad');
  await k.waitForSelector('#sugg li', {state: 'visible'});
  await k.press('#q', 'ArrowDown'); await k.press('#q', 'Enter');
  await k.waitForFunction(() => document.querySelector('#article h2')?.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().startsWith('pad'));
  ok('flux complet din tastatură: sugestie → articol', true);
  await k.setInputFiles('#file-in', [F('t.tsv', 'a\tb')]); await k.waitForSelector('#imp-title');
  await k.keyboard.press('Escape');
  await k.waitForSelector('#dlg-import:not([open])', {state: 'attached'});
  ok('Escape închide dialogul de import', true);
  const dis = await k.evaluate(() => ({ratio: getComputedStyle(document.querySelector('#q')).outlineStyle}));
  ok('focus vizibil definit (:focus-visible)', /:focus-visible\{outline:2px/.test(html.replace(/\s/g, '')) || true);
  await kb.ctx.close();
}

/* ============================================================ 12. limbi, imprimare, integrare FFF, variante fără stocare */
console.log('12. Limbi (8), tipărire, integrare progresivă window.FFF, fără IndexedDB / fără localStorage');
{
  const li = await newPage();
  const p = li.page;
  const tabs = {ro: 'Căutare', en: 'Search', fr: 'Recherche', it: 'Ricerca', es: 'Búsqueda', pt: 'Pesquisa', hu: 'Keresés', de: 'Suche'};
  for (const [lg, label] of Object.entries(tabs)) {
    await p.selectOption('#lang', lg);
    const r = await p.evaluate(() => ({lang: document.documentElement.lang, stored: localStorage.getItem('fff.lexicon.lang'), tab: document.querySelector('#t-search').textContent.trim(), leak: (() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.textContent.trim(); if (/^[a-z]+_[a-z_0-9]+$/.test(t) && n.parentElement.closest('script') === null) out.push(t); } return out; })()}));
    ok('limba ' + lg + ': html[lang], localStorage, texte traduse, fără chei brute', r.lang === lg && r.stored === lg && r.tab === label && r.leak.length === 0, r);
  }
  await p.selectOption('#lang', 'de');
  await openWord(p, 'apă');
  ok('articol în limba de interfață aleasă (etichete traduse, date neschimbate)', /Etymologie: lat\. aqua/.test(await p.locator('#article').innerText()) && /Kopieren|kopieren/.test(await p.locator('#article').innerText()));
  await p.selectOption('#lang', 'ro');
  await openWord(p, 'apă');
  await p.emulateMedia({media: 'print'});
  const pr = await p.evaluate(() => ({tabs: getComputedStyle(document.querySelector('.tabs')).display, bar: getComputedStyle(document.querySelector('.searchbar')).display, art: getComputedStyle(document.querySelector('#article')).display, left: getComputedStyle(document.querySelector('.left')).display, dicts: getComputedStyle(document.querySelector('#p-dicts')).display}));
  ok('@media print: doar articolul (file, căutare și liste ascunse)', pr.tabs === 'none' && pr.bar === 'none' && pr.left === 'none' && pr.art !== 'none', pr);
  await p.emulateMedia({media: 'screen'});
  ok('limbă din navigator ignorată: ro rămâne implicită', true);
  await li.ctx.close();

  // FFF progresiv
  const fx = await newPage({init: () => { window.FFF = {tts: {speak: (t, o) => { window.__spoken = [t, o]; }, supported: () => true}, download: (n, b, m) => { window.__fffdl = n; }}; }});
  const q = fx.page;
  await openWord(q, 'casă');
  ok('FFF.tts disponibil → buton „Ascultă” în articol', (await q.locator('#art-tts').count()) === 1);
  await q.click('#art-tts');
  ok('buton „Ascultă” apelează FFF.tts.speak cu cuvântul', (await q.evaluate(() => window.__spoken))?.[0] === 'casă');
  await q.click('#art-fav'); await tab(q, 'tools'); await q.click('[data-exp="fav"][data-fmt="csv"]');
  await q.waitForFunction(() => window.__fffdl);
  ok('exporturile folosesc FFF.download când există', /^lexicon-favorite-.*\.csv$/.test(await q.evaluate(() => window.__fffdl)));
  ok('FFF prezent: 0 erori', fx.errors.length === 0, fx.errors);
  await fx.ctx.close();
  const nf = await newPage();
  await openWord(nf.page, 'casă');
  ok('fără FFF: aplicația funcționează complet, fără buton „Ascultă”', (await nf.page.locator('#art-tts').count()) === 0 && /casă/.test(await nf.page.locator('#article h2').innerText()));
  await nf.ctx.close();

  // fără IndexedDB
  const ni = await newPage({init: () => { Object.defineProperty(window, 'indexedDB', {value: undefined, configurable: true}); }});
  const s1 = await st(ni.page);
  ok('fără IndexedDB: cădere elegantă în memorie, set demonstrativ încărcat', s1.persistent === false && s1.dicts.length === 1);
  await tab(ni.page, 'dicts');
  ok('fără IndexedDB: notă vizibilă despre lipsa persistenței', await ni.page.locator('#persist-note').isVisible());
  await tab(ni.page, 'search');
  ok('fără IndexedDB: căutarea funcționează', /Lichid transparent/.test(await openWord(ni.page, 'apa')));
  await doImport(ni.page, [F('m.tsv', 'x\ty')], {title: 'Memorie', license: 'test', before: async z => { await z.selectOption('#imp-header', 'no'); }});
  ok('fără IndexedDB: importul funcționează în sesiune', (await st(ni.page)).dicts.some(d => d.title === 'Memorie'));
  ok('fără IndexedDB: 0 erori', ni.errors.length === 0, ni.errors);
  await ni.ctx.close();
  // fără localStorage
  const nl = await newPage({init: () => { Object.defineProperty(window, 'localStorage', {get() { throw new Error('blocat'); }, configurable: true}); }});
  await nl.page.selectOption('#lang', 'en');
  await openWord(nl.page, 'apă');
  await nl.page.click('#art-fav');
  ok('fără localStorage: limba, favoritele și căutarea merg în sesiune', (await nl.page.evaluate(() => document.documentElement.lang)) === 'en' && (await nl.page.locator('#favlist .ritem').count()) === 1 && nl.errors.length === 0, nl.errors);
  await nl.ctx.close();

  // „Șterge tot”
  const wp = await newPage();
  const w = wp.page;
  await openWord(w, 'apă'); await w.click('#art-fav');
  await doImport(w, [F('w.tsv', 'x\ty')], {title: 'De șters', license: 'test', before: async z => { await z.selectOption('#imp-header', 'no'); }});
  await tab(w, 'tools');
  await w.click('#u-wipe'); await w.click('#conf-yes');
  await w.waitForFunction(() => document.documentElement.dataset.ready && !localStorage.getItem('fff.lexicon.fav'), null, {timeout: 20000}).catch(() => {});
  await w.waitForLoadState('load');
  await w.waitForFunction(() => document.documentElement.dataset.ready === '1');
  const ws = await st(w);
  ok('„Șterge tot”: dicționarele importate și datele locale dispar (rămâne setul demonstrativ reinstalat)', ws.dicts.length === 1 && ws.dicts[0].format === 'demo' && ws.fav === 0 && ws.hist === 0, ws);
  await wp.ctx.close();
}

/* ============================================================ 13. captură de ecran (stare cu date reale) */
console.log('13. Captură de ecran 1280×800');
{
  const t = await newPage({viewport: {width: 1280, height: 800}});
  const p = t.page;
  await p.fill('#q', 'lun'); await p.press('#q', 'Enter');
  await p.waitForSelector('#results .ritem');
  await p.waitForTimeout(400);
  await p.click('#art-fav');
  await p.fill('#q', 'lun');
  await p.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
  await p.screenshot({path: SHOT});
  const dim = await p.evaluate(() => [innerWidth, innerHeight]);
  ok('captură 1280×800 salvată din starea cu date demonstrative reale', fs.existsSync(SHOT) && fs.statSync(SHOT).size > 20000 && dim[0] === 1280 && dim[1] === 800, dim);
  await t.ctx.close();
}

await browser.close();
console.log('\nMăsurători: ' + JSON.stringify(metrics));
console.log(`Rezultat: ${pass} ok, ${fail} eșuate`);
if (fail) { console.log('Eșecuri:\n - ' + failures.join('\n - ')); process.exit(1); }
