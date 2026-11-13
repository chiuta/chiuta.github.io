#!/usr/bin/env node
// Injectează stratul de confort (hub-ux.css + hub-ux.js) în index.html, între marcajele UX:CSS și UX:JS,
// apoi recalculează hash-urile CSP și versiunea sw.js (aceeași formulă ca tools/sync-catalog.mjs).
// Rulare: node tools/hub-ux/apply.mjs   (idempotent: a doua rulare nu schimbă nimic)
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HUB = path.resolve(HERE, '..', '..');
const indexPath = path.join(HUB, 'index.html');
const swPath = path.join(HUB, 'sw.js');
const read = (p) => fs.readFileSync(p, 'utf8');
const css = read(path.join(HERE, 'hub-ux.css')).trimEnd();
const js = read(path.join(HERE, 'hub-ux.js')).trimEnd();
if (/<\/script>/i.test(js) || /<\/style>/i.test(css) || /UX:(CSS|JS):(START|END)/.test(js + css)) { console.error('sursa conține o etichetă de închidere sau un marcaj de injectare'); process.exit(1); }

let html = read(indexPath);
const cssBlock = `<!--UX:CSS:START-->\n<style id="hub-ux-css">\n${css}\n</style>\n<!--UX:CSS:END-->`;
const jsBlock = `<!--UX:JS:START-->\n<script id="hub-ux-js">\n${js}\n</script>\n<!--UX:JS:END-->`;
const reCss = /^<!--UX:CSS:START-->$[\s\S]*?^<!--UX:CSS:END-->$/m;
const reJs = /^<!--UX:JS:START-->$[\s\S]*?^<!--UX:JS:END-->$/m;

if (reCss.test(html)) html = html.replace(reCss, () => cssBlock);
else { const i = html.indexOf('</head>'); if (i < 0) throw new Error('lipsește </head>'); html = html.slice(0, i) + cssBlock + '\n' + html.slice(i); }
if (reJs.test(html)) html = html.replace(reJs, () => jsBlock);
else { const i = html.lastIndexOf('</body>'); if (i < 0) throw new Error('lipsește </body>'); html = html.slice(0, i) + jsBlock + '\n' + html.slice(i); }
fs.writeFileSync(indexPath, html);

// hash-urile CSP ale scripturilor inline
execFileSync(process.execPath, [path.join(HUB, 'fff-kit', 'build.mjs'), 'fixcsp', indexPath], {stdio: 'inherit'});

// versiunea service worker-ului = hash-ul paginii (ca în sync-catalog.mjs)
const final = read(indexPath);
const version = 'h' + createHash('sha256').update(final).digest('hex').slice(0, 8);
const sw = read(swPath);
const swNew = sw.replace(/var VERSION = "[^"]*";/, () => `var VERSION = "${version}";`);
if (swNew !== sw) fs.writeFileSync(swPath, swNew);
console.log(`hub-ux aplicat · sw.js → ${version}`);
