#!/usr/bin/env node
// make-fixtures — generează tests/fixtures/apps/<Nume>/ (fixturi minimale) din depozitele reale de aplicații.
//
//   node tools/make-fixtures.mjs [--root DIR]     DIR = părintele depozitelor (implicit: părintele hub-ului)
//
// De ce: tests/hub.test.mjs, tools/sync-catalog.mjs --check și tools/cname-inventory.mjs --check citesc, pentru fiecare card,
// depozitul aplicației (versiune, dată, limbi, egress, sw.js, README, CNAME). În CI nu există clone locale, așa că testele
// rulează pe aceste fixturi: păstrează EXACT ce citesc uneltele (nimic altceva) și nu conțin cod de aplicație.
// Regenerează după fiecare `sync-catalog` făcut pe clone reale (versiunile din carduri se schimbă).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const ri = argv.indexOf('--root');
const ROOT = path.resolve(ri >= 0 ? argv[ri + 1] : path.join(HUB, '..'));
const OUT = path.join(HUB, 'tests', 'fixtures', 'apps');
const read = (p) => fs.readFileSync(p, 'utf8');
const ex = (p) => fs.existsSync(p);

const html = read(path.join(HUB, 'index.html'));
const keys = html.split('<div class="app-card"').slice(1).map((c) => (c.match(/data-c="apps\|([^|"]+)\|title"/) || [])[1]).filter(Boolean);
const metaOf = (h, name) => { const m = h.match(new RegExp(`<meta\\b[^>]*\\bname=["']${name}["'][^>]*>`, 'i')); const c = m && m[0].match(/\bcontent=("([^"]*)"|'([^']*)')/i); return c ? (c[2] ?? c[3]) : ''; };

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
console.log(`${n} fixturi în ${path.relative(HUB, OUT)}` + (skipped.length ? ` · fără depozit (omise): ${skipped.join(', ')}` : ''));
