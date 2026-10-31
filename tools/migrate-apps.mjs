#!/usr/bin/env node
/* tools/migrate-apps.mjs — mutarea aplicațiilor din apps/ ale hub-ului pe origine proprie (<slug>.chiuta.ro)
 *
 *   node tools/migrate-apps.mjs stage  --out DIR [Nume …]   pregătește câte un depozit nou per aplicație în DIR/<Nume>
 *                                                            (copie a apps/<Nume> + CNAME + .nojekyll) și scrie DIR/RUNBOOK.sh.
 *                                                            Nu modifică hub-ul. Se poate rula oricând.
 *   node tools/migrate-apps.mjs cutover --confirm [Nume …]  ABIA DUPĂ ce <slug>.chiuta.ro răspunde (DNS + Pages + HTTPS):
 *                                                            înlocuiește apps/<Nume>/ din hub cu o pagină de redirecționare
 *                                                            și un service worker „kill-switch”, scoate URL-urile din sitemap.xml.
 *                                                            Apoi: node tools/sync-catalog.mjs (cardurile trec pe depozitul-soră).
 *   node tools/migrate-apps.mjs list                         arată aplicațiile și domeniile țintă.
 *
 * Fără nume = toate cele din apps/. Aplicațiile folosesc doar căi relative (verificat), deci nu se schimbă cod.
 * ATENȚIE: datele din browser (localStorage/IndexedDB) NU se mută între origini. Înainte de cutover, utilizatorii trebuie să exporte
 * (.fff.json) și să importe pe noua adresă; pagina de redirecționare le spune asta.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPS = path.join(HUB, 'apps');
const APEX = 'chiuta.ro';
const OWNER = 'chiuta';
const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n) => argv.includes(n);
const oi = argv.indexOf('--out');
const OUT = oi >= 0 ? path.resolve(argv[oi + 1]) : null;
const names = argv.slice(1).filter((a, i) => !a.startsWith('--') && argv[i] !== '--out');
const all = fs.readdirSync(APPS).filter((d) => fs.existsSync(path.join(APPS, d, 'index.html'))).sort();
const todo = names.length ? names : all;
for (const n of todo) if (!all.includes(n)) { console.error(`necunoscut: ${n} (apps/: ${all.join(', ')})`); process.exit(2); }
const slug = (n) => n.toLowerCase();
const host = (n) => `${slug(n)}.${APEX}`;

function copyDir(src, dst) {
  fs.mkdirSync(dst, {recursive: true});
  for (const e of fs.readdirSync(src, {withFileTypes: true})) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function stub(n) {
  const url = `https://${host(n)}/`;
  const P = `fff.${slug(n)}.`;
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${n} s-a mutat · ${n} has moved</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${url}">
<noscript><meta http-equiv="refresh" content="12;url=${url}"></noscript>
<style>:root{color-scheme:light dark}body{font:1.05rem/1.55 system-ui,sans-serif;max-width:38rem;margin:12vh auto;padding:0 16px}a{color:inherit;font-weight:600}button{font:inherit;min-height:44px;padding:0 1rem;margin:.25rem 0}#bk{display:none;border:1px solid currentColor;border-radius:8px;padding:1rem;margin:1rem 0}</style>
</head>
<body>
<h1>${n} are o adresă nouă</h1>
<p><a href="${url}">${host(n)}</a></p>
<div id="bk" role="region" aria-label="Copie de siguranță">
<p><strong>Ai date salvate în acest browser sub vechea adresă (<span id="bn">0</span> înregistrări).</strong> Ele nu se mută automat. Descarcă mai întâi copia, apoi deschide noua adresă și importă fișierul <code>.fff.json</code> din aplicație.</p>
<p><button id="bd" type="button">Descarcă copia datelor (.fff.json)</button></p>
<p lang="en">You have data stored in this browser under the old address. It does not move automatically: download the backup first, then open the new address and import the <code>.fff.json</code> file in the app.</p>
<p><small>Nu sunt incluse fișierele mari păstrate în baza de date a browserului (IndexedDB), dacă aplicația folosește așa ceva; folosește exportul din aplicație pentru ele. Copia nu e criptată.</small></p>
</div>
<p>Datele salvate în browser sub vechea adresă nu se mută automat; dacă nu ai date locale, vei fi redirecționat în 12 secunde.</p>
<h2>${n} has a new address</h2>
<p>Data stored in your browser under the old address does not move automatically. If there is none, you will be redirected in 12 seconds.</p>
<script>
(function () {
  var URL_NEW = ${JSON.stringify(url)}, P = ${JSON.stringify(P)}, IK = P + '__keys', d = Object.create(null), n = 0;
  try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(P) === 0 && k !== IK) { d[k] = localStorage.getItem(k); n++; } } } catch (e) { /* stocare blocată */ }
  if (!n) { setTimeout(function () { location.replace(URL_NEW); }, 12000); return; }
  document.getElementById('bk').style.display = 'block';
  document.getElementById('bn').textContent = String(n);
  document.getElementById('bd').addEventListener('click', function () {
    var o = {format: 'fff-bundle', schema: 1, app: ${JSON.stringify(slug(n))}, version: '', updated: '', exported: new Date().toISOString(), data: d};
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(o)], {type: 'application/json'}));
    a.download = ${JSON.stringify(slug(n))} + '-' + new Date().toISOString().slice(0, 10) + '.fff.json';
    document.body.appendChild(a); a.click(); a.remove();
  });
})();
</script>
</body>
</html>
`;
}

function killSw(n) {
  return `/* ${n} — service worker de ieșire. Aplicația s-a mutat pe https://${host(n)}/ ; acest worker șterge cache-urile vechi și se dezînregistrează. */
'use strict';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try { var ks = await caches.keys(); await Promise.all(ks.filter(function (k) { return k.indexOf('fff-${slug(n)}-') === 0; }).map(function (k) { return caches.delete(k); })); } catch (x) { /* ignorat */ }
    try { await self.registration.unregister(); } catch (x) { /* ignorat */ }
  })());
});
`;
}

if (cmd === 'list') {
  for (const n of all) console.log(`${n.padEnd(14)} → https://${host(n)}/   (depozit nou: ${OWNER}/${n})`);
} else if (cmd === 'stage') {
  if (!OUT) { console.error('lipsește --out DIR'); process.exit(2); }
  fs.mkdirSync(OUT, {recursive: true});
  const sh = ['#!/usr/bin/env bash', '# Generat de tools/migrate-apps.mjs stage. Rulează pas cu pas; necesită `gh auth login` cu drept de creare depozite în contul chiuta.', 'set -euo pipefail', 'cd "$(dirname "$0")"', ''];
  for (const n of todo) {
    const d = path.join(OUT, n);
    fs.rmSync(d, {recursive: true, force: true});
    copyDir(path.join(APPS, n), d);
    fs.writeFileSync(path.join(d, 'CNAME'), host(n) + '\n');
    fs.writeFileSync(path.join(d, '.nojekyll'), '');
    sh.push(`# ${n} → https://${host(n)}/`,
      `gh repo create ${OWNER}/${n} --public --description "${n} — aplicație single-file, offline, fără telemetrie" || true`,
      `( cd ${n} && git init -q -b main && git add -A && git commit -q -m "Prima versiune pe origine proprie (mutată din chiuta.github.io/apps/${n})" && git remote add origin https://github.com/${OWNER}/${n}.git && git push -u origin main )`,
      `gh api -X POST repos/${OWNER}/${n}/pages -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || true`,
      `gh api -X PUT repos/${OWNER}/${n}/pages -f cname=${host(n)} >/dev/null 2>&1 || true`,
      `# după ce DNS-ul propagă: gh api -X PUT repos/${OWNER}/${n}/pages -F https_enforced=true`, '');
    console.log(`pregătit: ${d}  (CNAME ${host(n)})`);
  }
  fs.writeFileSync(path.join(OUT, 'RUNBOOK.sh'), sh.join('\n'), {mode: 0o755});
  fs.writeFileSync(path.join(OUT, 'DNS.txt'), todo.map((n) => `${slug(n)}\tCNAME\tchiuta.github.io.`).join('\n') + '\n');
  console.log(`\n${todo.length} depozite în ${OUT}\nDNS de adăugat: ${path.join(OUT, 'DNS.txt')}\nPași GitHub: ${path.join(OUT, 'RUNBOOK.sh')}`);
} else if (cmd === 'cutover') {
  if (!flag('--confirm')) { console.error('cutover rescrie apps/<Nume>/ în hub. Rulează doar după ce <slug>.chiuta.ro răspunde. Adaugă --confirm.'); process.exit(2); }
  for (const n of todo) {
    const d = path.join(APPS, n);
    for (const e of fs.readdirSync(d)) fs.rmSync(path.join(d, e), {recursive: true, force: true});
    fs.writeFileSync(path.join(d, 'index.html'), stub(n));
    fs.writeFileSync(path.join(d, 'sw.js'), killSw(n));
    console.log(`comutat: apps/${n}/ → redirect către https://${host(n)}/`);
  }
  const smp = path.join(HUB, 'sitemap.xml');
  if (fs.existsSync(smp)) {
    let x = fs.readFileSync(smp, 'utf8');
    for (const n of todo) x = x.replace(new RegExp(`\\s*<url>\\s*<loc>https://${APEX.replace(/\./g, '\\.')}/apps/${n}/</loc>[\\s\\S]*?</url>`), '');
    fs.writeFileSync(smp, x);
    console.log('sitemap.xml: URL-urile vechi scoase');
  }
  console.log('\nUrmează: depozitele-surori trebuie să fie pe disc lângă hub, apoi `node tools/sync-catalog.mjs` (cardurile trec pe depozite) și commit.');
  console.log('Notă: sync-catalog preferă depozitul-soră (<root>/<Nume>/index.html) față de apps/<Nume>/, deci stub-ul de redirect nu interferează.');
} else {
  console.error('comenzi: list | stage --out DIR [Nume…] | cutover --confirm [Nume…]');
  process.exit(2);
}
