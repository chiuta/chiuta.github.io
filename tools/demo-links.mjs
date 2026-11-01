#!/usr/bin/env node
// demo-links — adaugă (idempotent) în index.html linkurile către filmulețele demo:
//   • pe fiecare card: <a class="card-link demo-link" href="demo/#<Depozit>">▶ Demo</a> (doar dacă există demo/<Depozit>/video.mp4)
//   • pe fiecare antet de secțiune: <a class="sec-demo" href="demo/?sec=<id>" data-i18n="demoSec"> (doar dacă demo/manifest.json are reel pentru secțiune)
// Rulare: node tools/demo-links.mjs [--check] ; apoi node tools/sync-catalog.mjs (recalculează hash-urile CSP și sw.js).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const p = path.join(HUB, 'index.html');
let html = fs.readFileSync(p, 'utf8'); const orig = html;
const man = JSON.parse(fs.readFileSync(path.join(HUB, 'demo', 'manifest.json'), 'utf8'));
const reels = man.reels || {};
let nCard = 0, nSec = 0;
html = html.replace(/(<div class="card-links">(?:(?!<\/div>)[\s\S])*?<a class="card-link" href="https:\/\/github\.com\/chiuta\/([^"\/]+)"[^>]*>README<\/a>)(?!<a class="card-link demo-link")/g, (m, head, repo) => {
  if (!fs.existsSync(path.join(HUB, 'demo', repo, 'video.mp4'))) return m;
  const name = (m.match(/aria-label="README — ([^"]+)"/) || [])[1] || repo;
  nCard++;
  return `${head}<a class="card-link demo-link" href="demo/#${repo}" aria-label="Demo — ${name}">▶ Demo</a>`;
});
html = html.replace(/(<div class="sec-head[^"]*" id="([a-z]+)">)((?:(?!<\/div>)[\s\S])*?)(<\/div>)/g, (m, open, id, body, close) => {
  if (!reels[id] || body.includes('sec-demo')) return m;
  nSec++;
  return `${open}${body}<a class="sec-demo" href="demo/?sec=${id}" data-i18n="demoSec">▶ Section reel</a>${close}`;
});
console.log(`${nCard} linkuri pe carduri, ${nSec} pe secțiuni`);
if (check) process.exit(html === orig ? 0 : 1);
if (html !== orig) fs.writeFileSync(p, html);
