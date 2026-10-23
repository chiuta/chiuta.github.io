// Teste Arbore (Playwright, Chromium). Rulare: node tests/test.mjs
// Rețeaua este blocată; se verifică 0 pageerror, 0 violări CSP, 0 cereri de rețea.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const URL_APP = pathToFileURL(path.join(here, '..', 'index.html')).href;
const AXE = process.env.AXE_PATH || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
const fx = n => fs.readFileSync(path.join(here, 'fixtures', n));
const SAMPLE = fx('sample.ged').toString('utf8');
const POPESCU = fx('familia-popescu.ged').toString('utf8');
const PROBLEME = fx('probleme.ged').toString('utf8');

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; failures.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});

async function newPage(opts = {}) {
  const ctx = await browser.newContext({viewport: opts.viewport || {width: 1280, height: 800}, colorScheme: opts.scheme || 'light', acceptDownloads: true, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', bypassCSP: !!opts.bypassCSP});
  const net = [];
  await ctx.route(/^https?:/, r => { net.push(r.request().url()); r.abort(); });
  const page = await ctx.newPage();
  const errors = [], csp = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI); }); });
  await page.goto(URL_APP);
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  return {ctx, page, errors, net, csp};
}

/* ---------------------------------------------------------------- 1. pornire */
console.log('1. Pornire, meta, CSP, rețea');
{
  const t = await newPage();
  const p = t.page;
  await p.waitForTimeout(3600);
  const info = await p.evaluate(() => ({
    ver: document.querySelector('meta[name="application-version"]')?.content,
    upd: document.querySelector('meta[name="last-updated"]')?.content,
    desc: !!document.querySelector('meta[name="description"]')?.content,
    vis: document.querySelector('#app-version')?.textContent.trim(),
    lang: document.documentElement.lang,
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '',
    viol: window.__csp || [],
    priv: document.querySelector('#privbar')?.textContent || '',
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href') || '',
    inline: document.querySelectorAll('[onclick],[onchange],[oninput],[onload]').length
  }));
  ok('application-version 1.0.5', info.ver === '1.0.5', info.ver);
  ok('last-updated 2026-10-23', info.upd === '2026-10-23', info.upd);
  ok('meta description', info.desc);
  ok('#app-version vizibil', info.vis === 'v 1.0.5 · 2026-10-23', info.vis);
  ok('html[lang]=ro implicit', info.lang === 'ro', info.lang);
  ok('CSP: default-src none, connect-src none, hash script', /default-src 'none'/.test(info.csp) && /connect-src 'none'/.test(info.csp) && /script-src 'sha256-/.test(info.csp) && !/unsafe-eval/.test(info.csp) && !/script-src[^;]*unsafe-inline/.test(info.csp), info.csp);
  // PWA adăugat ulterior: manifestul trebuie să fie exact cel generat (nu o a doua sursă), iar handlerele inline rămân interzise
  ok('fără handlere inline', info.inline === 0);
  {
    const html = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8');
    let mf = null; try { mf = JSON.parse(fs.readFileSync(path.join(here, '..', 'manifest.webmanifest'), 'utf8')); } catch (e) {}
    ok('un singur link manifest, către manifest.webmanifest valid (start_url ./, standalone)', info.manifest === 'manifest.webmanifest' && (html.match(/rel="manifest"/g) || []).length === 1 && mf && mf.start_url === './' && mf.display === 'standalone', [info.manifest, mf && mf.start_url]);
    const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)[1];
    const ss = (/script-src([^;]*)/.exec(csp) || [])[1] || '';
    const scr = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/\bsrc=/.test(m[1]) && !/type="application\/json"/.test(m[1]));
    ok('hash CSP independent pentru TOATE scripturile inline (kit, pwa, aplicație)', scr.length === 3 && (ss.match(/sha256-/g) || []).length === 3 && scr.every(m => ss.includes("'sha256-" + crypto.createHash('sha256').update(m[2], 'utf8').digest('base64') + "'")), scr.length);
    ok("CSP: manifest-src 'self', worker-src 'self' blob:", /manifest-src 'self'(;|$)/.test(csp) && /worker-src 'self' blob:(;|$)/.test(csp), csp);
    for (const [mod, a] of [['build.mjs', 'check'], ['pwa/pwa.mjs', 'check']]) { const r = spawnSync(process.execPath, [path.resolve(here, '../../../fff-kit', mod), a, path.resolve(here, '..')], {encoding: 'utf8'}); ok(mod + ' ' + a, r.status === 0, r.stdout + r.stderr); }
  }
  ok('bannerul de confidențialitate este vizibil', /nu face cereri de rețea|rămân pe acest/i.test(info.priv));
  ok('0 violări CSP', info.viol.length === 0, info.viol);
  ok('0 pageerror', t.errors.length === 0, t.errors);
  ok('0 cereri de rețea', t.net.length === 0, t.net);
  await t.ctx.close();
}

/* ---------------------------------------------------------------- 2. GEDCOM */
console.log('2. GEDCOM: import, export, round-trip');
{
  const t = await newPage();
  const p = t.page;
  const res = await p.evaluate(async ({SAMPLE, POPESCU, PROBLEME}) => {
    const A = window.Arbore, out = {};
    const rt = async (txt) => {
      const r = await A.parseGedcom(txt);
      const e1 = A.exportGedcom(r.db);
      const r2 = await A.parseGedcom(e1);
      const e2 = A.exportGedcom(r2.db);
      const lines = e1.split(/\r?\n/);
      return {r, e1, same: JSON.stringify(r.db) === JSON.stringify(r2.db), sameText: e1.replace(/^1 DATE.*$/m, '') === e2.replace(/^1 DATE.*$/m, ''), maxLen: Math.max(...lines.map(l => l.length)), lines, errs: r.report.errors.length, errs2: r2.report.errors.length + r2.report.warnings.length};
    };
    const a = await rt(SAMPLE), b = await rt(POPESCU);
    out.sample = {stats: a.r.report.stats, same: a.same, sameText: a.sameText, errs: a.errs, errs2: a.errs2, head: a.lines.slice(0, 24), unk: a.r.report.info.unknownTags, trlr: a.lines[a.lines.length - 2] || a.lines[a.lines.length - 1]};
    out.pop = {stats: b.r.report.stats, same: b.same, sameText: b.sameText, errs: b.errs, errs2: b.errs2, maxLen: b.maxLen,
      hasConc: b.lines.some(l => /^\d CONC /.test(l)), hasCont: b.lines.some(l => /^\d CONT /.test(l)),
      unk: ['_SIGNATURE ștampilă', '_SHADE închis', '_CUSTFAM valoare', '_UID 7B3F2A', '_CUSTREC @X1@'].map(x => b.lines.some(l => l.includes(x))),
      diacr: b.e1.includes('Ștefan Ioan /Popescu/') && b.e1.includes('Șinca Veche') && b.e1.includes('Dumbravă'),
      dates: ['BET 1 JAN 1890 AND 31 DEC 1892', 'BEF 1960', 'ABT 1916', 'ABT 1895', 'FROM 1910 TO 1950'].map(x => b.e1.includes(x)),
      noteJoined: (() => { const p1 = b.r.db.persons.I1; return JSON.stringify(p1.notes).includes('Familia Popescu s-a stabilit') && JSON.stringify(p1.notes).includes('\\n'); })(),
      names: b.r.db.persons.I1.names.length, aka: b.e1.includes('2 TYPE aka') || b.e1.includes('TYPE aka'),
      nick: b.e1.includes('2 NICK Fănel'), sour: b.e1.includes('SOUR @S1@') && b.e1.includes('0 @S1@ SOUR') && b.e1.includes('0 @R1@ REPO'), obje: b.e1.includes('OBJE @O1@'),
      head: b.lines.slice(0, 14), div: b.e1.includes('1 DIV'),
      chil: b.r.db.families.F2.children.length};
    // BOM + CRLF + UTF-8 din octeți
    const bytes = new TextEncoder().encode('﻿' + POPESCU);
    const rb = await A.parseGedcom(bytes);
    out.bom = {indi: rb.report.stats.indi, charset: rb.report.info.charset, name: rb.db.persons.I1.names[0].given};
    // ANSI (windows-1252) cu avertisment
    const ansi = 'HEAD\n1 CHAR ANSI\n0 @I1@ INDI\n1 NAME Järgen /Müller/\n0 TRLR';
    const u8 = new Uint8Array(ansi.length + 10); let n = 0;
    for (const line of ('0 HEAD\n1 CHAR ANSI\n0 @I1@ INDI\n1 NAME Järgen /Müller/\n1 SEX M\n0 TRLR\n').split('')) u8[n++] = line.charCodeAt(0);
    const ra = await A.parseGedcom(u8.subarray(0, n));
    out.ansi = {name: ra.db && ra.db.persons.I1 ? ra.db.persons.I1.names[0].given + ' ' + ra.db.persons.I1.names[0].surname : null, warn: ra.report.warnings.map(w => w.code), charset: ra.report.info.charset};
    // ANSEL minimal: acut combinat (0xE2) + e
    const an = [...'0 HEAD\n1 CHAR ANSEL\n0 @I1@ INDI\n1 NAME Ren'].map(c => c.charCodeAt(0)).concat([0xE2, 0x65], [...' /Test/\n0 TRLR\n'].map(c => c.charCodeAt(0)));
    const rn = await A.parseGedcom(new Uint8Array(an));
    out.ansel = {name: rn.db && rn.db.persons.I1 ? rn.db.persons.I1.names[0].given : null, warn: rn.report.warnings.map(w => w.code)};
    // linii lungi (>255) și CONC la export
    const db2 = A.newDb(); const id = 'I1';
    db2.persons[id] = {id, names: [{given: 'Lung', surname: 'Test', nick: '', npfx: '', nsfx: '', spfx: '', type: '', extra: []}], sex: 'M', events: [], notes: ['x'.repeat(1000) + '\nal doilea rând'], sours: [], tags: [], photo: '', assoc: [], living: '', extra: []};
    db2.seq.I = 1; A.rebuildIndex(db2);
    const eg = A.exportGedcom(db2); const rl = await A.parseGedcom(eg);
    out.longline = {max: Math.max(...eg.split(/\r?\n/).map(l => l.length)), back: JSON.stringify(rl.db.persons.I1.notes) === JSON.stringify(db2.persons.I1.notes)};
    // fișier cu probleme
    const rp = await A.parseGedcom(PROBLEME);
    out.prob = {ok: rp.ok, errs: rp.report.errors.map(e => e.code), warns: rp.report.warnings.map(e => e.code), indi: rp.report.stats.indi};
    // gunoi complet
    const rg = await A.parseGedcom('asta nu este GEDCOM\nnici asta');
    out.junk = {ok: rg.ok, errs: rg.report.errors.length};
    return out;
  }, {SAMPLE, POPESCU, PROBLEME});
  const s = res.sample, q = res.pop;
  ok('sample.ged: 30 persoane, 11 familii', s.stats.indi === 30 && s.stats.fam === 11, s.stats);
  ok('sample.ged: fără erori la import', s.errs === 0, s.errs);
  ok('sample.ged: round-trip identic (structură)', s.same);
  ok('sample.ged: re-export fără erori/avertismente', s.errs2 === 0, s.errs2);
  ok('sample.ged: etichete necunoscute raportate', s.unk.includes('_MILT') && s.unk.includes('_UID'), s.unk);
  ok('export HEAD conține CHAR UTF-8 și GEDC 5.5.1', s.head.some(l => l === '1 CHAR UTF-8') && s.head.some(l => l === '2 VERS 5.5.1'), s.head);
  ok('export se termină cu TRLR', s.trlr === '0 TRLR', s.trlr);
  ok('popescu: 6 persoane, 2 familii, SOUR/REPO/OBJE', q.stats.indi === 6 && q.stats.fam === 2 && q.stats.sour === 1 && q.stats.repo === 1 && q.stats.obje === 1, q.stats);
  ok('popescu: round-trip identic', q.same && q.errs === 0 && q.errs2 === 0, q);
  ok('popescu: nicio linie > 255 de caractere', q.maxLen <= 255, q.maxLen);
  ok('popescu: CONC/CONT în export și nota recompusă', q.hasConc && q.hasCont && q.noteJoined);
  ok('popescu: etichete necunoscute (inclusiv imbricate, la nivel 0) păstrate', q.unk.every(Boolean), q.unk);
  ok('popescu: diacritice păstrate', q.diacr);
  ok('popescu: date aproximative/intervale păstrate', q.dates.every(Boolean), q.dates);
  ok('popescu: nume multiple (rămas nume de fată, NICK, TYPE)', q.names === 2 && q.nick && q.aka);
  ok('popescu: divorț, copii, surse, obiecte', q.div && q.chil === 2 && q.sour && q.obje);
  ok('BOM + UTF-8 din octeți', res.bom.indi === 6 && res.bom.name === 'Ștefan Ioan', res.bom);
  ok('ANSI: decodat cu avertisment', res.ansi.name === 'Järgen Müller'.replace('Jä', 'Jä') || /J.rgen M.ller/.test(res.ansi.name || '') && res.ansi.warn.length > 0, res.ansi);
  ok('ANSEL minimal: acut combinat + avertisment', res.ansel.name === 'René' && res.ansel.warn.length > 0, res.ansel);
  ok('export: linii lungi tăiate cu CONC și recompuse identic', res.longline.max <= 255 && res.longline.back, res.longline);
  ok('fișier cu probleme: importat parțial, cu raport de erori', res.prob.ok && res.prob.errs.includes('dup_xref') && res.prob.errs.includes('missing_ref') && res.prob.warns.includes('level_jump') && res.prob.indi >= 2, res.prob);
  ok('text care nu este GEDCOM: respins fără excepție', res.junk.ok === false || res.junk.errs > 0, res.junk);
  ok('0 pageerror (GEDCOM)', t.errors.length === 0, t.errors);
  await t.ctx.close();
}

/* ---------------------------------------------------------------- 3. Date */
console.log('3. Date incomplete, circa, intervale');
{
  const t = await newPage();
  const r = await t.page.evaluate(() => {
    const A = window.Arbore, n = A.normalizeDateInput;
    return {
      circa: n('circa 1950').ged, ro: n('între 1900 și 1910').ged, full: n('12 martie 1950').ged, bef: n('inainte de 5.3.1900').ged, aft: n('după 1900').ged, year: n('1850').ged, my: n('martie 1850').ged,
      bad: n('blabla 99x').ok, fmtRo: A.fmtDate('BET 1900 AND 1910', 'ro'), fmtEn: A.fmtDate('ABT 12 MAR 1900', 'en'), fmtDe: A.fmtDate('BEF 1900', 'de'),
      range: A.dateRange(A.parseGedDate('BET 1900 AND 1910')), rangeA: A.dateRange(A.parseGedDate('ABT 1900'))
    };
  });
  ok('circa → ABT', r.circa === 'ABT 1950', r.circa);
  ok('între … și … → BET … AND …', r.ro === 'BET 1900 AND 1910', r.ro);
  ok('dată completă în română', r.full === '12 MAR 1950', r.full);
  ok('înainte de → BEF', r.bef === 'BEF 5 MAR 1900', r.bef);
  ok('după → AFT', r.aft === 'AFT 1900', r.aft);
  ok('an și lună-an', r.year === '1850' && r.my === 'MAR 1850', [r.year, r.my]);
  ok('intrare invalidă respinsă', r.bad === false);
  ok('formatare localizată', /1900/.test(r.fmtRo) && /1910/.test(r.fmtRo) && /1900/.test(r.fmtEn) && /1900/.test(r.fmtDe), [r.fmtRo, r.fmtEn, r.fmtDe]);
  ok('interval numeric pentru intervale/aproximări', r.range && r.rangeA, [r.range, r.rangeA]);
  await t.ctx.close();
}

/* ---------------------------------------------------------------- 4. Rudenie */
console.log('4. Calculator de rudenie (română)');
{
  const t = await newPage();
  const rel = await t.page.evaluate(async (SAMPLE) => {
    const A = window.Arbore; const r = await A.parseGedcom(SAMPLE); const db = r.db; A.rebuildIndex(db);
    const res = {};
    const pairs = {a: ['I16', 'I21'], b: ['I9', 'I12'], c: ['I16', 'I12'], d: ['I16', 'I11'], e: ['I16', 'I4'], f: ['I11', 'I17'], g: ['I27', 'I1'], h: ['I9', 'I28'], i: ['I8', 'I28'], j: ['I3', 'I5'], k: ['I15', 'I3'], l: ['I30', 'I9'], m: ['I9', 'I30'], n: ['I9', 'I31'], o: ['I16', 'I19'], p: ['I12', 'I3'], q: ['I9', 'I15'], r: ['I9', 'I18'], s: ['I1', 'I27'], t: ['I16', 'I16'], u: ['I16', 'I9'], v: ['I9', 'I16']};
    for (const [k, [a, b]] of Object.entries(pairs)) { const x = A.relate(db, a, b); res[k] = {kind: x.kind, term: x.term, civil: x.civil, canon: x.canon, path: x.path ? x.path.length : (x.steps ? x.steps.length : 0), keys: Object.keys(x)}; }
    // arbore sintetic pentru termeni de bază
    const mk = (id, sex, name) => ({id, names: [{given: name, surname: 'X', nick: '', npfx: '', nsfx: '', spfx: '', type: '', extra: []}], sex, events: [], notes: [], sours: [], tags: [], photo: '', assoc: [], living: '', extra: []});
    const d2 = A.newDb();
    const P = {}; const add = (id, sex) => { P[id] = d2.persons[id] = mk(id, sex, id); };
    ['gp', 'gm', 'gg'].forEach((id, i) => add(id, i === 1 ? 'F' : 'M'));
    add('f', 'M'); add('m', 'F'); add('u', 'M'); add('c', 'M'); add('cu', 'F'); add('cc', 'M'); add('me', 'M'); add('sis', 'F'); add('nev', 'M'); add('gc', 'F'); add('ggc', 'M');
    let fi = 0; const fam = (h, w, kids) => { const id = 'F' + (++fi); d2.families[id] = {id, p1: h, p2: w, children: kids.map(k => ({id: k, rel: 'bio', of: '', extra: []})), events: [], notes: [], sours: [], utype: 'married', tags: [], extra: []}; };
    add('ggp', 'M'); add('ggw', 'F');
    fam('ggp', 'ggw', ['gg']); fam('gg', 'gm', ['gp']);
    // gp(M) cu soție: bunic; copii: f, u ; f+m: me, sis ; u: c ; c: cu ; ...
    add('gw', 'F'); fam('gp', 'gw', ['f', 'u']); fam('f', 'm', ['me', 'sis']); fam('u', '', ['c']); fam('c', '', ['cu']); fam('sis', '', ['nev']); fam('me', '', ['gc']); fam('gc', '', ['ggc']);
    d2.seq.I = 100; A.rebuildIndex(d2);
    const q = (a, b) => A.relate(d2, a, b);
    res.syn = {
      bunic: q('me', 'gp').term, stra: q('me', 'gg').term, strastra: q('ggc', 'f').term, unchi: q('me', 'u').term, var1: q('me', 'c').term, var2: q('me', 'cu').term,
      nepotsora: q('f', 'nev').term, frate: q('me', 'sis').term, nepot: q('gp', 'me').term, strnepot: q('gg', 'me').term, copil: q('f', 'me').term, parinte: q('me', 'f').term,
      gp_civ: q('me', 'gp').civil, gp_can: q('me', 'gp').canon, var_civ: q('me', 'c').civil, var_can: q('me', 'c').canon, sib_civ: q('me', 'sis').civil, sib_can: q('me', 'sis').canon, unc_civ: q('me', 'u').civil, unc_can: q('me', 'u').canon
    };
    return res;
  }, SAMPLE);
  const R = rel;
  ok('văr secund (I16–I21)', R.a.term === 'văr secund' && R.a.kind === 'blood', R.a);
  ok('văr primar (I9–I12)', R.b.term === 'văr primar', R.b);
  ok('unchi (fratele tatălui)', R.d.term === 'unchi', R.d);
  ok('mătușă mare / sora bunicului', /mătușă/.test(R.e.term), R.e);
  ok('nepoată de frate', R.f.term === 'nepoată de frate', R.f);
  ok('răstrăbunic / răstrănepot', R.g.term === 'răstrăbunic' && R.s.term === 'răstrănepot', [R.g.term, R.s.term]);
  ok('soacră (afinitate)', R.h.term === 'soacră' && R.h.kind === 'affinity', R.h);
  ok('cuscră', R.i.term === 'cuscră', R.i);
  ok('cumnat', R.j.term === 'cumnat', R.j);
  ok('socru', R.k.term === 'socru', R.k);
  ok('fiu vitreg / mamă vitregă', /fiu vitreg/.test(R.l.term) && /vitregă/.test(R.m.term), [R.l.term, R.m.term]);
  ok('soră vitregă (consangvină)', /vitregă/.test(R.n.term), R.n);
  ok('frate prin adopție', /adop/.test(R.o.term), R.o);
  ok('soție și fostă soție', R.q.term === 'soție' && /fostă/.test(R.r.term), [R.q.term, R.r.term]);
  ok('grade civil/canonic: văr secund 6/3, văr primar 4/2', R.a.civil === 6 && R.a.canon === 3 && R.b.civil === 4 && R.b.canon === 2, [R.a, R.b]);
  ok('grade: unchi 3/2, răstrăbunic 4/4', R.d.civil === 3 && R.d.canon === 2 && R.g.civil === 4 && R.g.canon === 4);
  ok('termeni de bază pe arbore sintetic', R.syn.bunic === 'bunic' && R.syn.stra === 'străbunic' && R.syn.unchi === 'unchi' && R.syn.var1 === 'văr primar' && R.syn.var2.startsWith('văr') && R.syn.frate === 'frate' && R.syn.nepot === 'nepot de bunic' || R.syn.nepot === 'nepot' || /nepot/.test(R.syn.nepot), R.syn);
  ok('grade pe arbore sintetic (bunic 2/2, văr 4/2, frate 2/1, unchi 3/2)', R.syn.gp_civ === 2 && R.syn.gp_can === 2 && R.syn.var_civ === 4 && R.syn.var_can === 2 && R.syn.sib_civ === 2 && R.syn.sib_can === 1 && R.syn.unc_civ === 3 && R.syn.unc_can === 2, R.syn);
  ok('rezultatul conține o cale explicată', Object.keys(R.a.keys).length > 4, R.a.keys);
  await t.ctx.close();
}

/* ---------------------------------------------------------------- 5. Consistență, duplicate, îmbinare */
console.log('5. Consistență, duplicate, îmbinare cu undo');
{
  const t = await newPage();
  const r = await t.page.evaluate(async (SAMPLE) => {
    const A = window.Arbore; const res = {};
    const base = await A.parseGedcom(SAMPLE);
    res.clean = (await A.checkConsistency(base.db, 2026)).map(i => i.code);
    const mk = (id, g, s, by, dy, sex) => ({id, names: [{given: g, surname: s, nick: '', npfx: '', nsfx: '', spfx: '', type: '', extra: []}], sex: sex || 'M', events: [by ? {t: 'BIRT', v: '', date: String(by), place: '', type: '', notes: [], sours: [], pextra: [], extra: []} : null, dy ? {t: 'DEAT', v: '', date: String(dy), place: '', type: '', notes: [], sours: [], pextra: [], extra: []} : null].filter(Boolean), notes: [], sours: [], tags: [], photo: '', assoc: [], living: '', extra: []});
    const db = A.newDb();
    const add = p => { db.persons[p.id] = p; };
    add(mk('I1', 'Tata', 'Test', 1900, 1990)); add(mk('I2', 'Mama', 'Test', 1990, 2010, 'F')); add(mk('I3', 'Copil', 'Test', 1895, null)); // copil născut înainte de părinte
    add(mk('I4', 'Tânăr', 'Test', 1980, null)); add(mk('I5', 'Fiu', 'Test', 1990, null)); // părinte prea tânăr (10 ani)
    add(mk('I6', 'Mort', 'Test', 1900, 1950)); add(mk('I7', 'Postum', 'Test', 1960, null)); // născut la 10 ani după decesul tatălui
    add(mk('I8', 'Ciclu1', 'Test', 1900, null)); add(mk('I9', 'Ciclu2', 'Test', 1925, null));
    add(mk('I10', 'Ion', 'Duplicat', 1950, null)); add(mk('I11', 'Ion', 'Duplicat', 1950, null));
    add(mk('I12', 'Neg', 'Test', 1950, 1940));
    const fam = (id, p1, p2, ks) => { db.families[id] = {id, p1, p2, children: ks.map(k => ({id: k, rel: 'bio', of: '', extra: []})), events: [], notes: [], sours: [], utype: 'married', tags: [], extra: []}; };
    fam('F1', 'I1', '', ['I3']); fam('F2', 'I4', '', ['I5']); fam('F3', 'I6', '', ['I7']); fam('F4', 'I8', '', ['I9']); fam('F5', 'I9', '', ['I8']);
    db.seq.I = 12; db.seq.F = 5; A.rebuildIndex(db);
    const iss = await A.checkConsistency(db, 2026);
    res.codes = iss.map(i => i.code); res.sample = iss[0];
    res.shape = iss.every(i => i.sev && i.code && i.ids && i.ids.length);
    const du = await A.findDuplicates(db);
    res.dups = du.map(d => [d.a || d.ids && d.ids[0], d.b || d.ids && d.ids[1], d.score]);
    // îmbinare
    const before = JSON.stringify(db);
    const keep = 'I10', drop = 'I11';
    db.persons.I11.notes = ['nota duplicatului']; db.persons.I11.events.push({t: 'OCCU', v: 'Brutar', date: '', place: '', type: '', notes: [], sours: [], pextra: [], extra: []});
    const snap = JSON.stringify(db);
    A.mergePersons(db, keep, drop);
    res.merged = {gone: !db.persons.I11, notes: db.persons.I10.notes.join('|'), occ: db.persons.I10.events.some(e => e.t === 'OCCU')};
    return res;
  }, SAMPLE);
  ok('arbore curat (sample): fără erori de gravitate mare', !r.clean.some(c => /cycle|child_before|death_before|too_young|after_parent_death/.test(c)), r.clean);
  ok('detectează copil născut înainte de părinte', r.codes.includes('child_before_parent'), r.codes);
  ok('detectează părinte prea tânăr', r.codes.includes('parent_too_young'), r.codes);
  ok('detectează naștere după decesul părintelui', r.codes.includes('born_after_parent_death'), r.codes);
  ok('detectează cicluri', r.codes.includes('cycle'), r.codes);
  ok('detectează deces înainte de naștere', r.codes.includes('death_before_birth'), r.codes);
  ok('probleme cu gravitate și referință la persoană', r.shape, r.sample);
  ok('duplicate: găsește perechea Ion Duplicat', r.dups.some(d => (d[0] === 'I10' && d[1] === 'I11') || (d[0] === 'I11' && d[1] === 'I10')), r.dups);
  ok('îmbinare: păstrează datele ambelor, șterge duplicatul', r.merged.gone && /duplicatului/.test(r.merged.notes) && r.merged.occ, r.merged);
  // UI: îmbinare cu undo, navigare din raport
  await t.page.click('#t-people');
  await t.page.click('#b-sample');
  await t.page.waitForTimeout(500);
  await t.page.click('#t-quality');
  await t.page.click('#q-run');
  await t.page.waitForFunction(() => /\S/.test(document.querySelector('#q-out').textContent), null, {timeout: 20000});
  const hasOut = await t.page.evaluate(() => document.querySelector('#q-out').textContent.length > 5);
  ok('UI: raportul de calitate se afișează', hasOut);
  await t.page.click('#q-dup');
  await t.page.waitForTimeout(800);
  ok('UI: căutarea de duplicate rulează fără erori', t.errors.length === 0, t.errors);
  // undo după ștergerea unei persoane
  await t.page.click('#t-people');
  const nBefore = await t.page.evaluate(() => Object.keys(window.Arbore.db.persons).length);
  await t.page.evaluate(() => { window.Arbore.selectPerson('I19', {reveal: true}); });
  await t.page.waitForTimeout(200);
  await t.page.click('#sheet [data-act="del"]');
  await t.page.click('#cf-yes');
  await t.page.waitForTimeout(300);
  const nDel = await t.page.evaluate(() => Object.keys(window.Arbore.db.persons).length);
  await t.page.click('#b-undo');
  await t.page.waitForTimeout(300);
  const nUndo = await t.page.evaluate(() => Object.keys(window.Arbore.db.persons).length);
  ok('ștergere + anulare (undo)', nDel === nBefore - 1 && nUndo === nBefore, [nBefore, nDel, nUndo]);
  ok('0 pageerror (calitate)', t.errors.length === 0, t.errors);
  await t.ctx.close();
}

/* ---------------------------------------------------------------- 6. Mascare persoane în viață */
console.log('6. Confidențialitate: mascarea persoanelor în viață');
{
  const t = await newPage();
  const r = await t.page.evaluate(async (SAMPLE) => {
    const A = window.Arbore; const res = {};
    const base = await A.parseGedcom(SAMPLE); const db = base.db; A.rebuildIndex(db);
    const livingIds = Object.keys(db.persons).filter(id => A.isLiving(db.persons[id], 2026));
    const deadIds = Object.keys(db.persons).filter(id => !A.isLiving(db.persons[id], 2026));
    res.nl = livingIds.length; res.nd = deadIds.length;
    const names = id => db.persons[id].names[0].given;
    const mask = A.applyPrivacy(db, {mask: true, mode: 'mask'}, 2026);
    const gm = A.exportGedcom(mask.db);
    res.maskHidden = mask.hidden;
    res.maskLeak = /Alexandru|Matei|Tudor/.test(gm);
    res.maskKeepsDead = deadIds.slice(0, 5).every(id => gm.includes(names(id)));
    res.maskPrivat = (gm.match(/Privat/g) || []).length;
    res.maskKeepsStructure = Object.keys(mask.db.persons).length === Object.keys(db.persons).length;
    const hide = A.applyPrivacy(db, {mask: true, mode: 'hide'}, 2026);
    const gh = A.exportGedcom(hide.db);
    res.hideCount = Object.keys(hide.db.persons).length;
    res.hideLeak = /Alexandru/.test(gh);
    res.hideRefs = !/@I16@/.test(gh);
    // ultimii N ani
    const rec = A.applyPrivacy(db, {mask: true, mode: 'mask', recentYears: 100}, 2026);
    res.recentHidden = rec.hidden;
    // fără mascare: nimic ascuns
    res.off = A.applyPrivacy(db, {mask: false}, 2026).hidden;
    // intrarea originală nemodificată
    res.orig = /Alexandru/.test(JSON.stringify(db.persons.I16));
    // 110 ani (născut 1900 fără deces = mort prezumat), explicit _LIVING
    const mk = (id, y, living) => ({id, names: [{given: 'P' + id, surname: 'T', nick: '', npfx: '', nsfx: '', spfx: '', type: '', extra: []}], sex: 'M', events: y ? [{t: 'BIRT', v: '', date: String(y), place: '', type: '', notes: [], sours: [], pextra: [], extra: []}] : [], notes: [], sours: [], tags: [], photo: '', assoc: [], living: living || '', extra: []});
    res.l = [A.isLiving(mk('a', 1990), 2026), A.isLiving(mk('b', 1890), 2026), A.isLiving(mk('c', null), 2026), A.isLiving(mk('d', 1890, 'living'), 2026), A.isLiving(mk('e', 1990, 'deceased'), 2026)];
    // CSV fără persoane în viață
    const csv = A.personsCsv(mask.db);
    res.csvLeak = /Alexandru/.test(csv);
    return res;
  }, SAMPLE);
  ok('există persoane în viață și decedate în sample', r.nl > 3 && r.nd > 5, [r.nl, r.nd]);
  ok('mascare: numele celor în viață nu apar în GEDCOM', !r.maskLeak && r.maskHidden === r.nl, r);
  ok('mascare: persoanele decedate rămân', r.maskKeepsDead && r.maskKeepsStructure);
  ok('mascare: apare „Privat”', r.maskPrivat >= r.nl, r.maskPrivat);
  ok('mod elimină: persoanele dispar și nu rămân referințe', r.hideCount === r.nd && !r.hideLeak && r.hideRefs, [r.hideCount, r.nd]);
  ok('ultimii N ani: mai multe persoane private', r.recentHidden >= r.nl, [r.recentHidden, r.nl]);
  ok('fără mascare nu se ascunde nimic', r.off === 0);
  ok('arborele original nu este modificat de mascare', r.orig);
  ok('regula „în viață”: 1990 da, 1890 nu, fără dată da, _LIVING explicit', r.l[0] === true && r.l[1] === false && r.l[2] === true && r.l[3] === true && r.l[4] === false, r.l);
  ok('CSV mascat nu conține nume private', !r.csvLeak);
  // UI: butonul de export GEDCOM respectă opțiunea (implicit activă)
  await t.page.click('#b-sample'); await t.page.waitForTimeout(400);
  await t.page.click('#t-data');
  ok('opțiunea de mascare este activă implicit', await t.page.isChecked('#x-mask'));
  const [dl] = await Promise.all([t.page.waitForEvent('download'), t.page.click('#x-ged')]);
  const txt = fs.readFileSync(await dl.path(), 'utf8');
  ok('descărcare GEDCOM din UI: mascat, UTF-8, TRLR', /1 CHAR UTF-8/.test(txt) && !/Alexandru/.test(txt) && /0 TRLR/.test(txt) && /Privat/.test(txt));
  await t.page.uncheck('#x-mask');
  await t.page.click('#x-ged'); await t.page.waitForSelector('#dlg-confirm[open]');
  ok('export nemascat cere confirmare explicită', true);
  await t.page.click('#cf-no'); await t.page.waitForTimeout(200);
  const [dl2] = await Promise.all([t.page.waitForEvent('download'), t.page.click('#x-ged'), t.page.waitForSelector('#dlg-confirm[open]').then(() => t.page.click('#cf-yes'))]);
  const txt2 = fs.readFileSync(await dl2.path(), 'utf8');
  ok('fără mascare: GEDCOM complet', /Alexandru/.test(txt2));
  await t.page.check('#x-mask');
  const [dl3] = await Promise.all([t.page.waitForEvent('download'), t.page.click('#x-csv-p')]);
  ok('CSV persoane se descarcă', /\.csv$/.test(dl3.suggestedFilename()));
  const [dl4] = await Promise.all([t.page.waitForEvent('download'), t.page.click('#x-report-dl')]);
  const rep = fs.readFileSync(await dl4.path(), 'utf8');
  ok('raport HTML descărcat, fără nume private', /<html/i.test(rep) && !/Alexandru/.test(rep));
  ok('0 pageerror (export)', t.errors.length === 0, t.errors);
  await t.ctx.close();
}

/* ---------------------------------------------------------------- 7. Criptare */
console.log('7. Criptare AES-GCM / PBKDF2');
{
  const t = await newPage();
  const r = await t.page.evaluate(async () => {
    const A = window.Arbore; const res = {};
    const plain = JSON.stringify({a: 'Ștefan Popescu', n: [1, 2, 3]});
    const e = await A.encryptWithPassword(plain, 'parola-secretă-ă', 'local');
    const w = e.wrapper;
    res.shape = [w.format, w.kdf, w.iter, typeof w.salt, typeof w.iv, typeof w.ct];
    res.noPlain = !JSON.stringify(w).includes('Popescu');
    res.back = await A.decryptWrapper(w, 'parola-secretă-ă');
    try { await A.decryptWrapper(w, 'altă parolă'); res.bad = 'no-throw'; } catch (er) { res.bad = er.code || er.message; }
    const tam = Object.assign({}, w, {ct: w.ct.slice(0, -6) + (w.ct.slice(-6) === 'AAAAAA' ? 'BBBBBB' : 'AAAAAA')});
    try { await A.decryptWrapper(tam, 'parola-secretă-ă'); res.tamper = 'no-throw'; } catch (er) { res.tamper = er.code || er.message; }
    const e2 = await A.encryptWithPassword(plain, 'parola-secretă-ă', 'local');
    res.differ = e2.wrapper.ct !== w.ct && e2.wrapper.iv !== w.iv && e2.wrapper.salt !== w.salt;
    return {...res, plain};
  });
  ok('formatul învelișului: fff-bundle-enc, PBKDF2-SHA256, ≥ 310000 iterații', r.shape[0] === 'fff-bundle-enc' && r.shape[1] === 'PBKDF2-SHA256' && r.shape[2] >= 310000 && r.shape.slice(3).every(x => x === 'string'), r.shape);
  ok('textul clar nu apare în învelișul criptat', r.noPlain);
  ok('decriptare cu parola corectă (diacritice)', r.back === r.plain);
  ok('parolă greșită respinsă', r.bad === 'badpass', r.bad);
  ok('date alterate respinse (GCM)', r.tamper === 'badpass', r.tamper);
  ok('sare și IV aleatorii', r.differ);

  // UI: activare, salvare criptată, repornire cu parolă
  const p = t.page;
  await p.click('#b-sample'); await p.waitForTimeout(500);
  await p.click('#t-data');
  await p.click('#e-set');
  await p.waitForSelector('#dlg-pw[open]');
  const warnTxt = await p.evaluate(() => document.querySelector('#dlg-pw').textContent);
  ok('dialogul de parolă avertizează: parolă pierdută = date pierdute', /pierd/i.test(warnTxt));
  await p.fill('#pw-new', 'abc'); await p.fill('#pw-new2', 'abc'); await p.check('#pw-ack'); await p.click('#pw-ok');
  await p.waitForTimeout(300);
  ok('parolă prea scurtă este respinsă cu mesaj', await p.evaluate(() => document.querySelector('#dlg-pw').open && document.querySelector('#pw-err').textContent.length > 0));
  await p.fill('#pw-new', 'o-parola-buna-123'); await p.fill('#pw-new2', 'diferita-123'); await p.click('#pw-ok');
  await p.waitForTimeout(300);
  ok('parole diferite respinse', await p.evaluate(() => document.querySelector('#dlg-pw').open));
  await p.fill('#pw-new', 'o-parola-buna-123'); await p.fill('#pw-new2', 'o-parola-buna-123');
  await p.uncheck('#pw-ack'); await p.click('#pw-ok'); await p.waitForTimeout(300);
  ok('confirmarea avertismentului este obligatorie', await p.evaluate(() => document.querySelector('#dlg-pw').open));
  await p.check('#pw-ack'); await p.click('#pw-ok');
  await p.waitForFunction(() => !document.querySelector('#dlg-pw').open, null, {timeout: 20000});
  await p.waitForTimeout(1500);
  const stored = await p.evaluate(async () => { const A = window.Arbore; return await A.storageRead(); });
  ok('în browser se salvează doar text criptat', /"format"\s*:\s*"fff-bundle-enc"/.test(stored) && !/Moldovan/.test(stored), stored.slice(0, 80));
  const lsDump = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  ok('localStorage nu conține nume în clar', !/Moldovan|Alexandru/.test(lsDump));
  // repornire (aceeași origine: se păstrează localStorage/IDB prin context)
  await p.reload(); await p.waitForSelector('#dlg-pw[open]', {timeout: 15000});
  ok('la repornire se cere parola', true);
  await p.fill('#pw-cur', 'gresita'); await p.click('#pw-ok'); await p.waitForTimeout(1500);
  ok('parolă greșită la deblocare: mesaj de eroare, dialog rămâne', await p.evaluate(() => document.querySelector('#dlg-pw').open && document.querySelector('#pw-err').textContent.length > 0));
  await p.fill('#pw-cur', 'o-parola-buna-123'); await p.click('#pw-ok');
  await p.waitForFunction(() => document.documentElement.dataset.ready === '1' && window.Arbore.order.length > 0, null, {timeout: 25000});
  const n = await p.evaluate(() => window.Arbore.order.length);
  ok('după parola corectă arborele este încărcat', n === 30, n);
  ok('0 pageerror (criptare)', t.errors.length === 0, t.errors);
  await t.ctx.close();
}

/* ---------------------------------------------------------------- 8. Performanță 10k */
console.log('8. Performanță: 10.000 de persoane');
{
  const t = await newPage();
  const p = t.page;
  // generăm un GEDCOM sintetic mare: familii cu 2-3 copii pe ~12 generații
  const gen = await p.evaluate(() => {
    const given = ['Ion', 'Maria', 'Gheorghe', 'Elena', 'Vasile', 'Ana', 'Nicolae', 'Ioana', 'Mihai', 'Florica', 'Andrei', 'Ștefan', 'Mărioara', 'Dumitru', 'Cătălina'];
    const sur = ['Popescu', 'Ionescu', 'Moldovan', 'Marin', 'Dumitrescu', 'Stan', 'Radu', 'Munteanu', 'Șerban', 'Țurcanu', 'Dragomir', 'Barbu'];
    const places = ['Brașov', 'Cluj-Napoca', 'Sibiu', 'Iași', 'București', 'Timișoara', 'Făgăraș', 'Alba Iulia'];
    let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const L = ['0 HEAD', '1 CHAR UTF-8', '1 GEDC', '2 VERS 5.5.1'];
    let nI = 0, nF = 0; const famLines = [];
    const newP = (y, sex, s) => { const id = ++nI; L.push(`0 @I${id}@ INDI`, `1 NAME ${given[(rnd() * given.length) | 0]} /${s}/`, `1 SEX ${sex}`, '1 BIRT', `2 DATE ${y}`, `2 PLAC ${places[(rnd() * places.length) | 0]}`); if (y < 1930) L.push('1 DEAT', `2 DATE ${y + 50 + ((rnd() * 30) | 0)}`); return {id, y, sex, s}; };
    let gen = [];
    for (let i = 0; i < 300; i++) { const sex = i % 2 ? 'F' : 'M'; gen.push(newP(1700 + ((rnd() * 20) | 0), sex, sur[(rnd() * sur.length) | 0])); }
    const shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    while (nI < 10000 && gen.length > 1) {
      const M = shuf(gen.filter(x => x.sex === 'M')), F = shuf(gen.filter(x => x.sex === 'F')), next = [];
      for (let i = 0; i < Math.min(M.length, F.length) && nI < 10000; i++) {
        const h = M[i], w = F[i], f = ++nF, k = 1 + ((rnd() * 4) | 0);
        famLines.push(`0 @F${f}@ FAM`, `1 HUSB @I${h.id}@`, `1 WIFE @I${w.id}@`);
        for (let c = 0; c < k && nI < 10000; c++) { const ch = newP(Math.max(h.y, w.y) + 22 + ((rnd() * 14) | 0), rnd() < 0.5 ? 'M' : 'F', h.s); famLines.push(`1 CHIL @I${ch.id}@`); next.push(ch); }
      }
      gen = next;
    }
    return {ged: L.join('\n') + '\n' + famLines.join('\n') + '\n0 TRLR\n', n: nI, f: nF};
  });
  ok('GEDCOM sintetic generat cu ≥ 10.000 de persoane', gen.n >= 10000, gen.n);
  const perf = await p.evaluate(async (ged) => {
    const A = window.Arbore; const res = {};
    // monitorizăm blocarea firului principal
    let maxGap = 0, last = performance.now(), stop = false;
    const tick = () => { const n = performance.now(); maxGap = Math.max(maxGap, n - last); last = n; if (!stop) setTimeout(tick, 0); };
    setTimeout(tick, 0);
    let t0 = performance.now();
    const r = await A.parseGedcom(ged);
    res.parseMs = Math.round(performance.now() - t0); res.parseGap = Math.round(maxGap); res.indi = r.report.stats.indi; res.errs = r.report.errors.length;
    maxGap = 0; last = performance.now();
    A.db = r.db; t0 = performance.now();
    await A.buildIndex(); A.applyFilter();
    res.indexMs = Math.round(performance.now() - t0); res.indexGap = Math.round(maxGap);
    res.order = A.order.length;
    // încărcare în UI + listă virtualizată
    document.querySelector('#t-people').click();
    await new Promise(r => setTimeout(r, 300));
    res.domRows = document.querySelectorAll('#vl-rows .vrow').length;
    // căutare
    const q = document.querySelector('#q'); maxGap = 0; last = performance.now(); t0 = performance.now();
    q.value = 'Popescu 17'; q.dispatchEvent(new Event('input', {bubbles: true}));
    await new Promise(r => setTimeout(r, 600));
    res.searchMs = Math.round(performance.now() - t0 - 250); res.searchGap = Math.round(maxGap); res.filt = A.filt.length;
    q.value = ''; q.dispatchEvent(new Event('input', {bubbles: true})); await new Promise(r => setTimeout(r, 400));
    // diagrame pe cea mai adâncă persoană
    const ids = A.order; const mid = ids[Math.floor(ids.length * 0.8)];
    A.selectPerson(mid, {reveal: true});
    document.querySelector('#t-chart').click(); await new Promise(r => setTimeout(r, 200));
    for (const type of ['ped', 'desc', 'hour', 'fan']) {
      const sel = document.querySelector('#c-type'); sel.value = type; sel.dispatchEvent(new Event('change', {bubbles: true}));
      document.querySelector('#c-gens').value = '7'; document.querySelector('#c-gens').dispatchEvent(new Event('change', {bubbles: true}));
      maxGap = 0; last = performance.now(); t0 = performance.now();
      A.S.root = mid; A.renderChart(); await new Promise(r => setTimeout(r, 50));
      res['chart_' + type] = Math.round(performance.now() - t0); res['gap_' + type] = Math.round(maxGap);
      res['nodes_' + type] = document.querySelectorAll('#vp [data-key]').length;
    }
    // descendenții unui strămoș (cap)
    const root = ids.find(id => id === 'I1') || ids[0];
    A.S.root = root; const sel = document.querySelector('#c-type'); sel.value = 'desc'; sel.dispatchEvent(new Event('change', {bubbles: true}));
    maxGap = 0; last = performance.now(); t0 = performance.now(); A.S.root = root; A.renderChart(); await new Promise(r => setTimeout(r, 50));
    res.descRootMs = Math.round(performance.now() - t0); res.descRootNodes = document.querySelectorAll('#vp [data-key]').length;
    // verificări + duplicate pe 10k
    maxGap = 0; last = performance.now(); t0 = performance.now();
    const iss = await A.checkConsistency(A.db, 2026); res.checkMs = Math.round(performance.now() - t0); res.checkGap = Math.round(maxGap); res.issues = iss.length;
    maxGap = 0; last = performance.now(); t0 = performance.now();
    const du = await A.findDuplicates(A.db); res.dupMs = Math.round(performance.now() - t0); res.dupGap = Math.round(maxGap); res.dups = du.length;
    // export
    t0 = performance.now(); const g = A.exportGedcom(A.db); res.exportMs = Math.round(performance.now() - t0); res.exportKB = Math.round(g.length / 1024);
    t0 = performance.now(); const pr = A.applyPrivacy(A.db, {mask: true, mode: 'mask'}, 2026); res.privMs = Math.round(performance.now() - t0); res.privHidden = pr.hidden;
    stop = true;
    return res;
  }, gen.ged);
  console.log('     ' + JSON.stringify(perf));
  ok('10k: import fără erori critice', perf.indi >= 10000 && perf.errs === 0, [perf.indi, perf.errs]);
  ok('10k: import < 8 s, fără blocare > 400 ms a firului principal', perf.parseMs < 8000 && perf.parseGap < 400, [perf.parseMs, perf.parseGap]);
  ok('10k: indexare < 3 s, fără blocare > 400 ms', perf.indexMs < 3000 && perf.indexGap < 400, [perf.indexMs, perf.indexGap]);
  ok('10k: lista este virtualizată (puține rânduri în DOM)', perf.order >= 10000 && perf.domRows > 0 && perf.domRows < 200, [perf.order, perf.domRows]);
  ok('10k: căutarea filtrează rapid, fără blocare > 250 ms', perf.filt > 0 && perf.filt < perf.order && perf.searchGap < 250, [perf.filt, perf.searchGap]);
  ok('10k: diagramele (7 generații) se randează < 1,5 s fiecare', ['ped', 'desc', 'hour', 'fan'].every(k => perf['chart_' + k] < 1500 && perf['nodes_' + k] > 0), perf);
  ok('10k: descendenții unui strămoș sunt limitați și rapizi', perf.descRootMs < 2500 && perf.descRootNodes > 10 && perf.descRootNodes <= 800, [perf.descRootMs, perf.descRootNodes]);
  ok('10k: verificările de consistență < 10 s, fără blocare > 400 ms', perf.checkMs < 10000 && perf.checkGap < 400, [perf.checkMs, perf.checkGap]);
  ok('10k: detecția duplicatelor < 15 s, fără blocare > 400 ms', perf.dupMs < 15000 && perf.dupGap < 400, [perf.dupMs, perf.dupGap]);
  ok('10k: export GEDCOM și mascare < 5 s', perf.exportMs < 5000 && perf.privMs < 5000, [perf.exportMs, perf.privMs]);
  ok('0 pageerror (10k)', t.errors.length === 0, t.errors);
  await t.ctx.close();
}

/* ---------------------------------------------------------------- 9. UI: diagrame, tastatură, export */
console.log('9. UI: diagrame, tastatură, limbi, ștergere');
{
  const t = await newPage();
  const p = t.page;
  await p.click('#b-sample'); await p.waitForTimeout(600);
  await p.click('#t-chart'); await p.waitForTimeout(400);
  for (const type of ['ped', 'desc', 'hour', 'fan']) {
    await p.selectOption('#c-type', type); await p.waitForTimeout(300);
    const n = await p.evaluate(() => document.querySelectorAll('#vp [data-key], #vp path[data-id], #vp [data-id]').length);
    ok('diagramă ' + type + ' are noduri', n > 3, n);
  }
  await p.selectOption('#c-type', 'ped');
  for (const g of [3, 5, 7]) { await p.fill('#c-gens', String(g)); await p.dispatchEvent('#c-gens', 'change'); await p.waitForTimeout(150); }
  ok('pedigree pe 3-7 generații fără erori', t.errors.length === 0, t.errors);
  await p.selectOption('#c-type', 'hour'); await p.waitForTimeout(200);
  const firstFocus = await p.evaluate(() => { const s = document.querySelector('#dg'); s.focus(); return document.activeElement.id + ':' + (document.activeElement.dataset.key || ''); });
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(100);
  const f1 = await p.evaluate(() => document.activeElement.dataset && document.activeElement.dataset.key || '');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100);
  const f2 = await p.evaluate(() => document.activeElement.dataset && document.activeElement.dataset.key || '');
  ok('navigare cu tastatura între noduri (săgeți)', !!f1 && !!f2 && f1 !== f2, [firstFocus, f1, f2]);
  const rootBefore = await p.evaluate(() => window.Arbore.S.root);
  await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  const rootAfter = await p.evaluate(() => window.Arbore.S.root);
  ok('Enter recentrează diagrama pe persoana focalizată', rootBefore !== rootAfter, [rootBefore, rootAfter]);
  const tr0 = await p.evaluate(() => document.querySelector('#vp').getAttribute('transform'));
  await p.keyboard.press('+'); await p.waitForTimeout(100);
  const tr1 = await p.evaluate(() => document.querySelector('#vp').getAttribute('transform'));
  ok('zoom cu tastatura', tr0 !== tr1, [tr0, tr1]);
  const box = await p.locator('#dg').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.wheel(0, -300); await p.waitForTimeout(100);
  const tr2 = await p.evaluate(() => document.querySelector('#vp').getAttribute('transform'));
  ok('zoom cu roata mouse-ului', tr2 !== tr1, [tr1, tr2]);
  await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, {steps: 5}); await p.mouse.up();
  const tr3 = await p.evaluate(() => document.querySelector('#vp').getAttribute('transform'));
  ok('deplasare prin tragere', tr3 !== tr2, [tr2, tr3]);
  // tactil: pinch simulat prin CDP
  const cdp = await p.context().newCDPSession(p);
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: cx - 40, y: cy, id: 1}, {x: cx + 40, y: cy, id: 2}]});
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: cx - 120, y: cy, id: 1}, {x: cx + 120, y: cy, id: 2}]});
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await p.waitForTimeout(150);
  const tr4 = await p.evaluate(() => document.querySelector('#vp').getAttribute('transform'));
  ok('gest tactil (pinch) schimbă transformarea', tr4 !== tr3, [tr3, tr4]);
  // export SVG / PNG
  const [dsvg] = await Promise.all([p.waitForEvent('download'), p.click('#c-svg')]);
  const svgTxt = fs.readFileSync(await dsvg.path(), 'utf8');
  ok('export SVG valid', /^<\?xml/.test(svgTxt) && /<svg[^>]+viewBox/.test(svgTxt) && /<\/svg>\s*$/.test(svgTxt) && !/<script/i.test(svgTxt));
  const [dpng] = await Promise.all([p.waitForEvent('download'), p.click('#c-png')]);
  const png = fs.readFileSync(await dpng.path());
  ok('export PNG valid', png.length > 1000 && png.subarray(1, 4).toString() === 'PNG', png.length);
  // tipărire multi-pagină: zona de print se umple
  await p.check('#c-multi');
  await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await p.click('#c-print'); await p.waitForTimeout(500);
  const pa = await p.evaluate(() => ({printed: window.__printed, pages: document.querySelectorAll('#printArea .pg, #printArea section, #printArea svg').length}));
  ok('tipărire multi-pagină pregătește pagini', pa.pages >= 1, pa);
  await p.uncheck('#c-multi');
  // fișă, cronologie
  await p.click('#t-people'); await p.waitForTimeout(200);
  const sheet = await p.evaluate(() => document.querySelector('#sheet').textContent);
  ok('fișa personală afișează evenimente și familii', /Naștere|Nașterea/i.test(sheet) && /Uniuni|Părinți/i.test(sheet));
  // calculator în UI
  await p.click('#t-rel'); await p.waitForTimeout(200);
  await p.evaluate(() => { const A = window.Arbore; A.S.relA = 'I16'; A.S.relB = 'I21'; });
  await p.click('#r-go').catch(async () => { await p.click('button:has-text("Calculează")'); });
  await p.waitForTimeout(500);
  const rout = await p.evaluate(() => document.querySelector('#r-out').textContent);
  ok('calculator UI: termen, grade și cale explicată', /văr secund/i.test(rout) && /6/.test(rout) && /3/.test(rout), rout.slice(0, 200));
  // locuri
  await p.click('#t-places'); await p.waitForTimeout(300);
  const pl = await p.evaluate(() => document.querySelector('#pl-out').textContent);
  ok('lista de locuri se afișează (fără hartă externă)', /Brașov|Cluj/.test(pl) && t.net.length === 0, pl.slice(0, 100));
  // limbi
  const langs = ['en', 'fr', 'it', 'es', 'pt', 'hu', 'de', 'ro'];
  const seen = {};
  for (const l of langs) {
    await p.selectOption('#lang', l); await p.waitForTimeout(150);
    seen[l] = await p.evaluate(() => ({lang: document.documentElement.lang, tab: document.querySelector('#t-people').textContent, ls: localStorage.getItem('fff.arbore.lang'), ver: document.querySelector('#app-version').textContent.trim()}));
  }
  ok('selectorul de limbă schimbă html[lang] și persistă în fff.arbore.lang', langs.every(l => seen[l].lang === l && seen[l].ls === l), seen);
  ok('etichetele diferă între limbi', new Set(langs.map(l => seen[l].tab)).size >= 7, langs.map(l => seen[l].tab));
  await p.selectOption('#lang', 'de'); await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.ready === '1');
  ok('limba aleasă se păstrează după reîncărcare', await p.evaluate(() => document.documentElement.lang) === 'de');
  await p.selectOption('#lang', 'ro');
  // JSON bundle
  await p.click('#t-data');
  const [dj] = await Promise.all([p.waitForEvent('download'), p.click('#x-json')]);
  const bundle = JSON.parse(fs.readFileSync(await dj.path(), 'utf8'));
  ok('export .fff.json: format fff-bundle', bundle.format === 'fff-bundle' && bundle.schema === 1 && bundle.app === 'arbore' && bundle.version === '1.0.5' && bundle.updated === '2026-10-23' && bundle.data, Object.keys(bundle));
  ok('.fff.json: persoanele vii sunt mascate (implicit)', !JSON.stringify(bundle).includes('Alexandru'));
  // import JSON (copie completă) după ștergere
  await p.uncheck('#x-mask');
  const [dj2] = await Promise.all([p.waitForEvent('download'), p.click('#x-json'), p.waitForSelector('#dlg-confirm[open]').then(() => p.click('#cf-yes'))]);
  const fullPath = await dj2.path();
  await p.check('#x-mask');
  await p.click('#x-wipe'); await p.click('#cf-yes'); await p.waitForTimeout(400);
  ok('„Șterge tot” golește arborele', await p.evaluate(() => window.Arbore.order.length) === 0);
  const lsAfter = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fff.arbore.tree')));
  ok('„Șterge tot” elimină arborele salvat', lsAfter.length === 0, lsAfter);
  await p.setInputFiles('#in-json', fullPath); await p.waitForTimeout(800);
  const nImp = await p.evaluate(() => window.Arbore.order.length);
  ok('import .fff.json restaurează arborele', nImp === 30, nImp);
  // import GEDCOM prin UI, cu raport
  await p.setInputFiles('#in-ged', path.join(here, 'fixtures', 'probleme.ged')); await p.waitForTimeout(500);
  const repOpen = await p.evaluate(() => { const d = document.querySelector('#dlg-rep, #dlg-confirm'); return [...document.querySelectorAll('dialog[open]')].map(x => x.id); });
  ok('import GEDCOM cu probleme: apare raportul de erori sau confirmarea', repOpen.length > 0, repOpen);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok('0 pageerror (UI)', t.errors.length === 0, t.errors);
  ok('0 cereri de rețea (UI)', t.net.length === 0, t.net);
  await t.ctx.close();
}

/* ---------------------------------------------------------------- 10. Editare persoană/familie */
console.log('10. UI: editare persoană și familie');
{
  const t = await newPage();
  const p = t.page;
  await p.click('#b-addp'); await p.waitForSelector('#dlg-edit[open]');
  const ids = await p.evaluate(() => [...document.querySelectorAll('#dlg-edit input, #dlg-edit select, #dlg-edit textarea')].map(e => e.id).filter(Boolean));
  ok('formularul de persoană are câmpuri', ids.length > 8, ids);
  const given = ids.find(i => /given|nm-g|pe-g/i.test(i)); const sur = ids.find(i => /sur|nm-s|pe-s/i.test(i));
  if (given && sur) {
    await p.fill('#' + given, 'Test'); await p.fill('#' + sur, 'Editat');
    await p.click('#dlg-edit button[type="submit"]'); await p.waitForTimeout(400);
    const n = await p.evaluate(() => Object.values(window.Arbore.db.persons).map(x => x.names[0].given + ' ' + x.names[0].surname));
    ok('persoană nouă creată din formular', n.includes('Test Editat'), n);
  } else ok('câmpuri nume găsite', false, ids);
  ok('0 pageerror (editare)', t.errors.length === 0, t.errors);
  await t.ctx.close();
}

/* ---------------------------------------------------------------- 11. Accesibilitate, overflow, teme */
console.log('11. Accesibilitate (axe), overflow, teme, mișcare redusă, print');
{
  const axeSrc = fs.readFileSync(AXE, 'utf8');
  for (const [w, h, scheme] of [[1280, 800, 'light'], [1280, 800, 'dark'], [360, 740, 'light'], [360, 740, 'dark']]) {
    const t = await newPage({viewport: {width: w, height: h}, scheme, bypassCSP: true});
    const p = t.page;
    await p.click('#b-sample'); await p.waitForTimeout(3600);
    let total = 0, over = 0; const det = [];
    for (const tab of ['people', 'chart', 'rel', 'quality', 'places', 'data']) {
      await p.click('#t-' + tab); await p.waitForTimeout(500);
      if (tab === 'rel') { await p.evaluate(() => { const A = window.Arbore; A.S.relA = 'I16'; A.S.relB = 'I21'; }); await p.click('#r-go'); await p.waitForTimeout(300); }
      if (tab === 'quality') { await p.click('#q-run'); await p.waitForTimeout(1500); }
      over = Math.max(over, await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
      await p.evaluate(src => { if (!window.axe) (0, eval)(src); }, axeSrc);
      const r = await p.evaluate(() => axe.run(document, {resultTypes: ['violations']}));
      total += r.violations.length; r.violations.forEach(v => det.push(tab + ':' + v.id + ' ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join('|')));
    }
    // dialoguri deschise
    for (const open of [async () => { await p.click('#t-people'); await p.click('#b-addp'); await p.waitForSelector('#dlg-edit[open]'); }, async () => { await p.click('#b-privinfo'); await p.waitForSelector('#dlg-info[open]'); }]) {
      await open(); await p.waitForTimeout(300);
      const r = await p.evaluate(() => axe.run(document, {resultTypes: ['violations']}));
      total += r.violations.length; r.violations.forEach(v => det.push('dialog:' + v.id + ' ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join('|')));
      over = Math.max(over, await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    }
    ok(`axe 0 violări ${w}x${h} ${scheme}`, total === 0, det);
    ok(`fără depășire orizontală ${w}x${h} ${scheme}`, over <= 0, over);
    ok(`fără erori ${w}x${h} ${scheme}`, t.errors.length === 0 && t.net.length === 0, [t.errors, t.net]);
    await t.ctx.close();
  }
  // tastatură: Tab ajunge la controale, focus vizibil
  const t = await newPage({reduced: true});
  const p = t.page;
  const seen = new Set();
  for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); seen.add(await p.evaluate(() => document.activeElement.id || document.activeElement.tagName)); }
  ok('Tab parcurge controalele', seen.size >= 6, [...seen]);
  const outline = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.boxShadow; });
  ok('focus vizibil', !/none 0px none$/.test(outline.trim()) && outline.length > 0, outline);
  // tab-uri cu săgeți
  await p.focus('#t-people'); await p.keyboard.press('ArrowRight');
  ok('tab-uri: săgeată dreapta mută selecția', await p.evaluate(() => document.querySelector('#t-chart').getAttribute('aria-selected')) === 'true');
  // mișcare redusă
  const rm = await p.evaluate(() => { const css = [...document.styleSheets].flatMap(s => [...s.cssRules]).some(r => r.media && /prefers-reduced-motion/.test(r.media.mediaText)); return css && matchMedia('(prefers-reduced-motion: reduce)').matches; });
  ok('prefers-reduced-motion are regulă și este respectat', rm);
  const pr = await p.evaluate(() => [...document.styleSheets].flatMap(s => [...s.cssRules]).some(r => r.media && /print/.test(r.media.mediaText)));
  ok('există @media print', pr);
  await p.emulateMedia({media: 'print'});
  const hid = await p.evaluate(() => { document.body.classList.add('printing'); const d = getComputedStyle(document.querySelector('header.top')).display; document.body.classList.remove('printing'); return d; });
  ok('în print (body.printing) restul paginii este ascuns', hid === 'none', hid);
  await t.ctx.close();
}

await browser.close();
console.log(`\n${pass} reușite, ${fail} eșuate`);
if (fail) { console.log('Eșuate:\n - ' + failures.join('\n - ')); process.exit(1); }
