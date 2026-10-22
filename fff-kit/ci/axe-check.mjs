#!/usr/bin/env node
// fff-kit · ci/axe-check — axe-core pe index.html, rețeaua blocată: pagina și dialogul „Transparență” (#app-version),
// la 360×740 și 1366×800, temă luminoasă și întunecată. Cod de ieșire 1 dacă există violări.
//   node ci/axe-check.mjs <dir|index.html> [--json] [--allow rule1,rule2] [--min-impact minor|moderate|serious|critical]
// Cere `playwright` și `axe-core` rezolvabile (npm i -D playwright axe-core; sau NODE_PATH). Chromium: CHROMIUM_PATH (implicit cel din Playwright).
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const args = process.argv.slice(2);
const opt = {allow: new Set(), min: 'minor', json: false};
const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') opt.json = true;
  else if (args[i] === '--allow') (args[++i] || '').split(',').filter(Boolean).forEach((r) => opt.allow.add(r));
  else if (args[i] === '--min-impact') opt.min = args[++i];
  else pos.push(args[i]);
}
if (!pos[0]) { console.error('utilizare: node ci/axe-check.mjs <dir|index.html> [--json] [--allow reguli] [--min-impact nivel]'); process.exit(2); }
const IMPACT = ['minor', 'moderate', 'serious', 'critical'];
const target = path.resolve(pos[0]);
const file = fs.statSync(target).isDirectory() ? path.join(target, 'index.html') : target;
const cwdReq = createRequire(path.join(process.cwd(), 'noop.js'));
const here = createRequire(import.meta.url);
function need(name) {
  for (const r of [cwdReq, here, createRequire(path.join(path.dirname(file), 'noop.js'))]) { try { return r.resolve(name); } catch { /* următorul */ } }
  console.error(`lipsește ${name}: npm install --no-save playwright axe-core`); process.exit(2);
}
const {chromium} = cwdReq(need('playwright'));
const axeSrc = fs.readFileSync(process.env.FFF_AXE || process.env.AXE_PATH || need('axe-core/axe.min.js'), 'utf8');

const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
const results = [];
for (const scheme of ['light', 'dark']) for (const [w, h] of [[1366, 800], [360, 740]]) {
  const ctx = await browser.newContext({viewport: {width: w, height: h}, colorScheme: scheme, reducedMotion: 'reduce'});
  await ctx.route(/^https?:/, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + file);
  await page.waitForTimeout(1200);
  await page.evaluate(axeSrc + '\n;0');
  const run = async (label, sel) => {
    const v = await page.evaluate(async (s) => {
      const r = await window.axe.run(s ? document.querySelector(s) : document, {resultTypes: ['violations']});
      return r.violations.map((x) => ({id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.map((n) => n.target.join(' ')).slice(0, 4)}));
    }, sel);
    results.push({scheme, viewport: `${w}x${h}`, scope: label, violations: v.filter((x) => !opt.allow.has(x.id) && IMPACT.indexOf(x.impact) >= IMPACT.indexOf(opt.min)), errors: errs.slice()});
  };
  await run('pagina', null);
  const has = await page.evaluate(() => !!document.getElementById('app-version') && document.getElementById('app-version').getAttribute('role') === 'button');
  if (has) {
    await page.click('#app-version');
    await page.waitForSelector('dialog[open]', {timeout: 5000}).catch(() => null);
    if (await page.evaluate(() => !!document.querySelector('dialog[open]'))) await run('dialog Transparență', 'dialog[open]');
    await page.keyboard.press('Escape');
  }
  await ctx.close();
}
await browser.close();
const bad = results.filter((r) => r.violations.length);
if (opt.json) console.log(JSON.stringify(results, null, 1));
else {
  for (const r of results) console.log(`${r.violations.length ? 'FAIL' : 'ok  '} ${r.scheme.padEnd(5)} ${r.viewport.padEnd(9)} ${r.scope}${r.errors.length ? ` · ${r.errors.length} erori de pagină` : ''}`);
  for (const r of bad) for (const v of r.violations) console.log(`  [${r.scheme} ${r.viewport} · ${r.scope}] ${v.id} (${v.impact}): ${v.help} → ${v.nodes.join(' | ')}`);
  console.log(bad.length ? `axe: ${bad.reduce((n, r) => n + r.violations.length, 0)} violări în ${bad.length} scenarii` : `axe: 0 violări în ${results.length} scenarii`);
}
process.exit(bad.length ? 1 : 0);
