// Utilitare comune pentru testele fff-kit (Playwright, rețea blocată, directoare temporare).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {applyKit, runInfo} from '../build.mjs';

const require = createRequire('/opt/node-tools/package.json');
export const {chromium} = require('playwright');
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const AXE = process.env.FFF_AXE || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
export const FIXTURE = fs.readFileSync(path.join(HERE, 'fixture.html'), 'utf8');

export function tmpDir(prefix = 'fffk-') { return fs.mkdtempSync(path.join(process.env.FFF_TMP || os.tmpdir(), prefix)); }
/** Scrie html într-un director temporar, aplică kitul (+info opțional) și întoarce {dir, file, url}. */
export function makeApp(html, {slug = 'demo-fff', modules = 'core,label,bundle', info = true, config, disable} = {}) {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  if (config) fs.writeFileSync(path.join(dir, 'fff.config.json'), JSON.stringify(config));
  applyKit(dir, {slug, modules, disable});
  if (info) runInfo(dir, {slug});
  const file = path.join(dir, 'index.html');
  return {dir, file, url: 'file://' + file};
}
export async function launch() {
  return chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
}
/** Context cu rețeaua blocată; colectează erori. */
export async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({viewport: {width: opts.w || 1280, height: opts.h || 800}, acceptDownloads: true, colorScheme: opts.scheme || 'light', reducedMotion: opts.reduced ? 'reduce' : 'no-preference', locale: opts.locale || 'ro-RO', bypassCSP: !!opts.bypassCSP, storageState: opts.storageState});
  const net = [];
  await ctx.route(/^https?:/, (r) => { net.push(r.request().url()); r.abort(); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(t)) errors.push('console: ' + t); });
  return {ctx, page, errors, net};
}
export async function axe(page, selector) {
  if (!(await page.evaluate(() => !!window.axe))) await page.evaluate(fs.readFileSync(AXE, 'utf8') + '\n;0');
  return page.evaluate(async (sel) => {
    const r = await window.axe.run(sel ? document.querySelector(sel) : document, {resultTypes: ['violations']});
    return r.violations.map((v) => ({id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5)}));
  }, selector || null);
}

let pass = 0, fail = 0;
export function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); }
}
export function summary(label) {
  console.log(`${label}: ${pass} ok, ${fail} eșuate`);
  process.exit(fail ? 1 : 0);
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
