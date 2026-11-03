#!/usr/bin/env node
// make-fixtures — generează tests/fixtures/apps/<Nume>/ (fixturi minimale) din depozitele reale de aplicații.
//
//   node tools/make-fixtures.mjs --root DIR [--check]     DIR = părintele depozitelor (clonele aplicațiilor)
//   node tools/make-fixtures.mjs --check                  fără clone: verifică DOAR că fixturile se potrivesc cu cardurile din index.html (versiune, dată), cu mesaj clar „regenerează”
//   Fără --root nu se șterge și nu se scrie nimic (o rulare fără clone ar goli fixturile; hub-test ar cădea).
//
// De ce: tests/hub.test.mjs, tools/sync-catalog.mjs --check și tools/cname-inventory.mjs --check citesc, pentru fiecare card,
// depozitul aplicației (versiune, dată, limbi, egress, sw.js, README, CNAME). În CI nu există clone locale, așa că testele
// rulează pe aceste fixturi: păstrează EXACT ce citesc uneltele (nimic altceva) și nu conțin cod de aplicație.
// Regenerează după fiecare `sync-catalog` făcut pe clone reale (versiunile din carduri se schimbă).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {EXTERNAL} from './catalog-meta-lib.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const ri = argv.indexOf('--root');
const CHECK = argv.includes('--check');
const ROOT = ri >= 0 ? path.resolve(argv[ri + 1]) : null;
const FIX = path.join(HUB, 'tests', 'fixtures', 'apps');
const read = (p) => fs.readFileSync(p, 'utf8');
const ex = (p) => fs.existsSync(p);

const html = read(path.join(HUB, 'index.html'));
const cards = html.split('<div class="app-card"').slice(1).map((c) => ({key: (c.match(/data-c="apps\|([^|"]+)\|title"/) || [])[1], ver: (c.match(/<span class="card-ver" data-ver="([^"]*)" data-upd="([^"]*)"/) || [])[1] || '', upd: (c.match(/<span class="card-ver" data-ver="([^"]*)" data-upd="([^"]*)"/) || [])[2] || ''})).filter((c) => c.key);
let ENGINES = new Set(); try { ENGINES = new Set(Object.entries(JSON.parse(fs.readFileSync(path.join(HUB, 'data', 'catalog-meta.json'), 'utf8')).kinds || {}).filter(([, v]) => v === 'engine').map(([k]) => k)); } catch { /* fără meta */ }   // programele native (OSATURA, VERIGA, TEZAUR, LegatorOCR) nu au fixturi: sync-catalog le sare
const keys = cards.map((c) => c.key);
const metaOf = (h, name) => { const m = h.match(new RegExp(`<meta\\b[^>]*\\bname=["']${name}["'][^>]*>`, 'i')); const c = m && m[0].match(/\bcontent=("([^"]*)"|'([^']*)')/i); return c ? (c[2] ?? c[3]) : ''; };
const REGEN = 'Regenerează: node tools/make-fixtures.mjs --root <folderul cu clonele aplicațiilor>, apoi node tools/sync-catalog.mjs --root <același folder> și comite tests/fixtures. NU rula make-fixtures fără --root.';

/** Scrie fixturile în OUT din clonele din ROOT. */
function generate(OUT) {
  fs.rmSync(OUT, {recursive: true, force: true});
  let n = 0; const skipped = [];
  for (const key of keys) {
    const repo = path.join(ROOT, key);
    const pub = ex(path.join(repo, 'index.html')) ? repo : ex(path.join(repo, 'docs', 'index.html')) ? path.join(repo, 'docs') : null;
    if (!pub) { skipped.push(key); continue; }
    const h = read(path.join(pub, 'index.html'));
    let app = null;
    for (const d of [pub, repo]) { try { app = JSON.parse(read(path.join(d, 'app.json'))); break; } catch { /* fără app.json */ } }
    let cfg = {};
    try { cfg = JSON.parse(read(path.join(repo, 'fff.config.json'))); } catch { /* fără fff.config.json */ }
    const dest = path.join(OUT, key), destPub = pub === repo ? dest : path.join(dest, 'docs');
    fs.mkdirSync(destPub, {recursive: true});
    const ver = metaOf(h, 'application-version') || (app && app.version) || '', upd = metaOf(h, 'last-updated') || (app && app.updated) || '';
    fs.writeFileSync(path.join(destPub, 'index.html'), `<!doctype html>\n<meta charset="utf-8">\n<title>${key} (fixtură)</title>\n<meta name="application-version" content="${ver}">\n<meta name="last-updated" content="${upd}">\n`);
    if (app) {
      const o = {version: app.version, updated: app.updated, egress: app.egress || [], features: {i18n: (app.features && app.features.i18n) || [], pwa: {serviceWorker: !!(app.features && app.features.pwa && app.features.pwa.serviceWorker)}}};
      if (app.cspSelfTest) o.cspSelfTest = app.cspSelfTest;
      fs.writeFileSync(path.join(pub === repo ? dest : destPub, 'app.json'), JSON.stringify(o, null, 2) + '\n');
    }
    if (cfg.cspSelfTest) fs.writeFileSync(path.join(dest, 'fff.config.json'), JSON.stringify({cspSelfTest: cfg.cspSelfTest}, null, 2) + '\n');
    if (ex(path.join(pub, 'sw.js'))) fs.writeFileSync(path.join(destPub, 'sw.js'), '/* fixtură: există service worker */\n');
    if (ex(path.join(repo, 'README.md'))) fs.writeFileSync(path.join(dest, 'README.md'), `# ${key}\n\nFixtură pentru teste; nu e documentația aplicației.\n`);
    if (ex(path.join(repo, 'CNAME'))) fs.writeFileSync(path.join(dest, 'CNAME'), read(path.join(repo, 'CNAME')));
    n++;
  }
  fs.writeFileSync(path.join(OUT, 'README.md'), '# Fixturi pentru teste\n\nGenerate de `node tools/make-fixtures.mjs --root <clone>`; conțin doar ce citesc `sync-catalog`, `cname-inventory` și `hub.test.mjs` (versiune, dată, limbi, egress, sw.js, README, CNAME). Nu editați de mână.\n');
  return {n, skipped};
}

/** Toate fișierele unui folder, relativ: {cale: conținut}. */
function snapshot(d) { const o = {}; const w = (x, r) => { for (const e of fs.readdirSync(x, {withFileTypes: true})) { const p = path.join(x, e.name); if (e.isDirectory()) w(p, r + e.name + '/'); else o[r + e.name] = read(p); } }; if (ex(d)) w(d, ''); return o; }

if (CHECK && !ROOT) {
  // fără clone: fixtura fiecărui card există și are versiunea/data cardului
  const bad = [];
  for (const c of cards) {
    if (ENGINES.has(c.key) || EXTERNAL.has(c.key)) continue;   // programele native n-au fixturi; cardurile EXTERNE au versiunea întreținută de mână
    const dir = path.join(FIX, c.key), pub = ex(path.join(dir, 'index.html')) ? dir : path.join(dir, 'docs');
    if (!ex(path.join(pub, 'index.html'))) { bad.push(`${c.key}: lipsește fixtura`); continue; }
    const h = read(path.join(pub, 'index.html')), v = metaOf(h, 'application-version'), u = metaOf(h, 'last-updated');
    if (c.ver && v && v !== c.ver) bad.push(`${c.key}: fixtura are v${v}, cardul v${c.ver}`);
    else if (c.upd && u && u !== c.upd) bad.push(`${c.key}: fixtura are data ${u}, cardul ${c.upd}`);
  }
  const extra = ex(FIX) ? fs.readdirSync(FIX, {withFileTypes: true}).filter((e) => e.isDirectory() && !keys.includes(e.name)).map((e) => e.name) : [];
  extra.forEach((k) => bad.push(`${k}: fixtură fără card`));
  if (bad.length) { console.log('FIXTURI ÎN URMĂ față de catalog (nu e o eroare de catalog):\n  ' + bad.join('\n  ') + '\n' + REGEN); process.exit(1); }
  console.log(`fixturi la zi: ${cards.length} carduri verificate (versiune + dată)`); process.exit(0);
}
if (!ROOT) { console.error('lipsește --root DIR (folderul cu clonele aplicațiilor). ' + REGEN); process.exit(2); }
if (!keys.some((k) => ex(path.join(ROOT, k, 'index.html')) || ex(path.join(ROOT, k, 'docs', 'index.html')))) { console.error(`în ${ROOT} nu există nicio clonă de aplicație: nu scriu nimic (ar goli fixturile). ` + REGEN); process.exit(2); }

if (CHECK) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixtures-'));
  const {skipped} = generate(tmp);
  const a = snapshot(tmp), b = snapshot(FIX);
  fs.rmSync(tmp, {recursive: true, force: true});
  const diff = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
  const ignore = new Set(skipped);
  const real = diff.filter((k) => !ignore.has(k.split('/')[0]));
  if (real.length) { console.log(`FIXTURI ÎN URMĂ: ${real.length} fișiere diferă de clonele din ${ROOT} (primele: ${real.slice(0, 6).join(', ')}).\n` + REGEN); process.exit(1); }
  console.log(`fixturi identice cu clonele (${keys.length - skipped.length} aplicații${skipped.length ? `; fără clonă: ${skipped.join(', ')}` : ''})`); process.exit(0);
}
const {n, skipped} = generate(FIX);
console.log(`${n} fixturi în ${path.relative(HUB, FIX)}` + (skipped.length ? ` · fără depozit (omise): ${skipped.join(', ')}` : ''));
