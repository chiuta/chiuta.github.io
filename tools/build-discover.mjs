#!/usr/bin/env node
// build-discover — insere (idempotent) modulul „Descoperire” (Etapa 3) în index.html din tools/discover/*:
//   discover.css → <style>, discover.html → secțiunea #discover, dialog.html → <dialog id="cs-dlg">, i18n.js + discover.js → <script> final.
// Apoi rulează `node fff-kit/build.mjs fixcsp index.html` (hash-ul noului script intră în CSP). Folosire: node tools/build-discover.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = path.join(HUB, 'tools', 'discover');
const rd = (f) => fs.readFileSync(path.join(D, f), 'utf8').replace(/\s+$/, '');
const file = path.join(HUB, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const check = process.argv.includes('--check');
const js = rd('discover.js').replace('/*@@I18N@@*/', () => rd('i18n.js'));
if (/<\/script>/i.test(js)) throw new Error('discover.js conține </script>');
function region(name, anchorRe, where, body) {
  const s = `<!--DISC:${name}:START-->`, e = `<!--DISC:${name}:END-->`;
  const block = `${s}\n${body}\n${e}`;
  const re = new RegExp(`${s}[\\s\\S]*?${e}`);
  if (re.test(html)) html = html.replace(re, () => block);
  else {
    const m = anchorRe.exec(html);
    if (!m) throw new Error('ancora lipsește pentru ' + name);
    html = where === 'before' ? html.slice(0, m.index) + block + '\n' + html.slice(m.index) : html.slice(0, m.index + m[0].length) + '\n' + block + html.slice(m.index + m[0].length);
  }
}
const css = `/*DISC:CSS:START*/\n${rd('discover.css')}\n/*DISC:CSS:END*/`;
{
  const re = /\/\*DISC:CSS:START\*\/[\s\S]*?\/\*DISC:CSS:END\*\//;
  if (re.test(html)) html = html.replace(re, () => css);
  else { const a = '@media print{a.card-link.live-link{background:none;color:#000;box-shadow:none;border:1px solid #000}}\n</style>'; if (!html.includes(a)) throw new Error('ancora CSS lipsește'); html = html.replace(a, () => a.replace('\n</style>', '\n') + css + '\n</style>'); }
}
region('SECTION', /<div class="apps-header">/, 'before', rd('discover.html'));
region('DIALOG', /<dialog id="vlight"/, 'before', rd('dialog.html'));
region('JS', /<\/body>/, 'before', `<script>\n${js}\n</script>`);
if (check) { const cur = fs.readFileSync(file, 'utf8'); if (cur !== html) { console.error('index.html nu e la zi cu tools/discover/ (rulează node tools/build-discover.mjs)'); process.exit(1); } console.log('discover: la zi'); process.exit(0); }
fs.writeFileSync(file, html);
execFileSync('node', [path.join(HUB, 'fff-kit', 'build.mjs'), 'fixcsp', file], {stdio: 'inherit'});
console.log('discover: inserat în index.html');
