#!/usr/bin/env node
// Ridică versiunea (patch) unei aplicații CU kit, FĂRĂ a rescrie kitul din ea: meta application-version/last-updated, #app-version, constante din cod,
// sw.js (VERSION), README-uri, hash-uri CSP, app.json (fff-info), apoi intrarea din CHANGELOG.md. Nu face commit și nu împinge nimic.
//   node tools/texturi-qa/bump-app.mjs <dirAplicație> --date YYYY-MM-DD [--slug S] [--to X.Y.Z] [--dry-run] [--note "<text de pus în CHANGELOG>"]
// De ce nu `inject-shared.mjs --release`: acela rescrie kitul din fff-kit/src al hubului (ux v1), mai vechi decât kitul din aplicații (ux v2).
// Aplicațiile fără kit (fără <meta name="application-version">) nu intră aici: se ridică de mână, după PLAYBOOK2.md.
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {releaseApp, bumpCodeConstants} from '../../fff-kit/lib/release.mjs';
const HUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2), dir = path.resolve(argv[0] || '');
const val = (f, d) => { const i = argv.indexOf(f); return i < 0 ? d : argv[i + 1]; }, has = (f) => argv.includes(f);
if (!argv[0] || !fs.existsSync(path.join(dir, 'index.html'))) { console.error('utilizare: bump-app.mjs <dirAplicație cu index.html> --date YYYY-MM-DD [--slug S] [--dry-run]'); process.exit(2); }
const date = val('--date'); if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) { console.error('--date YYYY-MM-DD este obligatoriu (data bump-ului)'); process.exit(2); }
const rd = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
const app = (() => { try { return JSON.parse(rd(path.join(dir, 'app.json'))); } catch { return null; } })();
const slug = val('--slug') || (app && app.slug) || undefined;
const eng = ((rd(path.join(HUB, 'tools/fff-texturi.js')) || '').match(/var VERSION = '([\d.]+)'/) || [])[1] || '';

const rep = releaseApp(dir, {bump: 'patch', to: val('--to'), date, lax: true, tests: false, readme: true, kit: false, slug, dryRun: has('--dry-run')});
const out = {slug: rep.slug, from: rep.from, to: rep.to, date, ok: rep.ok, dryRun: rep.dryRun, changed: rep.changed, steps: rep.steps, warnings: rep.warnings, errors: rep.errors, extra: [], changelog: ''};
if (!rep.ok || has('--dry-run')) { out.changelog = 'omis'; console.log(JSON.stringify(out)); process.exit(rep.ok ? 0 : 1); }

// 1) constante de versiune în scripturile de construcție și package.json (doar dacă păstrează aceeași versiune ca aplicația: autorul nu le ține mereu la zi)
const oldDate = (rd(path.join(dir, 'app.json')) && app && app.updated) || '';
for (const f of ['tools/build.py', 'tools/build.js', 'tools/build.mjs', 'build.py', 'build.js', 'build.mjs', 'simulare/build.mjs']) {
  const p = path.join(dir, f), t = rd(p); if (t == null) continue;
  const r = bumpCodeConstants(t, rep.from, rep.to, oldDate, date);
  if (r.lines) { fs.writeFileSync(p, r.text); out.extra.push(`${f}: ${r.lines} linii`); }
}
{
  const p = path.join(dir, 'package.json'), t = rd(p);
  if (t != null) {
    const re = new RegExp(`("version"\\s*:\\s*")${rep.from.replace(/\./g, '\\.')}(")`);
    if (re.test(t)) { fs.writeFileSync(p, t.replace(re, `$1${rep.to}$2`)); out.extra.push('package.json: versiune'); }
  }
}

// 2) CHANGELOG.md: intrare nouă deasupra celei mai recente (limba și forma titlului după cele existente)
const cl = path.join(dir, 'CHANGELOG.md'), t = rd(cl);
if (t == null) out.changelog = 'lipsește CHANGELOG.md (nu l-am creat)';
else if (new RegExp(`^## \\[?${rep.to.replace(/\./g, '\\.')}\\b`, 'm').test(t)) out.changelog = 'există deja';
else {
  const k = t.search(/^## /m), top = k < 0 ? '' : t.slice(k, k + 1500);
  const ro = /[ăâîșțşţĂÂÎȘȚ]|\b(și|pentru|aplicați\w*|nou|acum|adăugat|corectat)\b/i.test(top);
  const note = val('--note') || (ro
    ? `- Nou: texturi fractale hiper-detaliate (fff-texturi ${eng}) — fundalul și suprafețele mari (carduri, panouri, antete, butoane; filele și dialogurile ascunse la încărcare, când se deschid) primesc un material generat local (WebGL2, fără rețea și fără imagini), care se repetă fără cusătură; culorile aplicației rămân ale ei. Se oprește din dialogul „Transparență” sau cu \`?notex=1\`.`
    : `- New: hyper-detailed fractal textures (fff-texturi ${eng}) — the background and large surfaces (cards, panels, headers, buttons; tabs and dialogs that are hidden at load, once they open) get a locally generated material (WebGL2, no network, no images) that tiles seamlessly; the app keeps its own colours. Turn it off in the "Transparency" dialog or with \`?notex=1\`.`);
  const h = (top.match(/^## (\[?)(\d+(?:\.\d+){0,2})(\]?)(\s*[—–-]\s*)(\d{4}-\d{2}-\d{2})/) || []);
  const heading = h[0] ? `## ${h[1]}${rep.to}${h[3]}${h[4]}${date}` : `## ${rep.to} — ${date}`;
  const entry = `${heading}\n\n${note}\n\n`;
  fs.writeFileSync(cl, k < 0 ? t.replace(/\n*$/, '\n\n') + entry.trimEnd() + '\n' : t.slice(0, k) + entry + t.slice(k));
  out.changelog = `intrare ${rep.to} (${ro ? 'RO' : 'EN'})`;
}
console.log(JSON.stringify(out));
