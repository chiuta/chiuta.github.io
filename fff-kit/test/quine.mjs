// Aplicații care își salvează propria copie (quine): kitul trebuie să rămână inofensiv în fișierul salvat.
//   node test/quine.mjs --work <dir cu <Nume>/kit/index.html din compat.mjs> --out rezultate.json
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from './_pw.mjs';
import {checkKit} from '../build.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const W = args.work;
const CASES = [
  {name: 'Akasha', click: 'button:has-text("Reîncarnează"), button:has-text("Reincarnate")', file: 'akasha.html'},
  {name: 'OmniHost', click: 'button[onclick="saveQuine()"]', file: 'omnihost.html'},
  {name: 'ROePAS-neoficial', eval: () => window.exportQuine && window.exportQuine(), file: 'roepas-quine.html'},
];
const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
const out = [];
for (const c of CASES) {
  const rec = {nume: c.name, probleme: []};
  const dir = path.join(W, c.name, 'kit');
  const ctx = await b.newContext({viewport: {width: 1280, height: 800}, acceptDownloads: true});
  await ctx.route(/^https?:/, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) errs.push('csp: ' + m.text().slice(0, 200)); });
  await page.goto('file://' + path.join(dir, 'index.html')); await page.waitForTimeout(3000);
  let dl;
  try {
    [dl] = await Promise.all([page.waitForEvent('download', {timeout: 15000}), c.click ? page.click(c.click, {timeout: 5000}) : page.evaluate(c.eval)]);
  } catch (e) { rec.probleme.push('salvare: ' + e.message.split('\n')[0]); }
  rec.errsBeforeSave = errs.slice();
  if (dl) {
    const saved = path.join(W, c.name, 'saved'); fs.mkdirSync(saved, {recursive: true});
    const sp = path.join(saved, 'index.html'); await dl.saveAs(sp);
    const html = fs.readFileSync(sp, 'utf8');
    rec.saved = {name: dl.suggestedFilename(), kb: Math.round(html.length / 1024), kitBlocks: (html.match(/<!--fff:kit:start/g) || []).length, dialogInside: /<dialog[^>]*fff-dlg/.test(html), labelAttrs: /data-fff-label/.test(html)};
    const ck = checkKit(saved, {lax: true});
    rec.saved.check = {ok: ck.ok, errors: ck.errors.map((e) => e.slice(0, 80))};
    const ctx2 = await b.newContext({viewport: {width: 1280, height: 800}});
    await ctx2.route(/^https?:/, (r) => r.abort());
    const p2 = await ctx2.newPage();
    const e2 = [];
    p2.on('pageerror', (e) => e2.push('pageerror: ' + e.message.slice(0, 200)));
    p2.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) e2.push('csp: ' + m.text().slice(0, 200)); });
    await p2.goto('file://' + sp); await p2.waitForTimeout(3000);
    rec.reload = await p2.evaluate(() => ({fff: !!window.FFF, state: window.FFF && FFF.label.state, role: (document.getElementById('app-version') || {getAttribute() { return null; }}).getAttribute('role')}));
    await p2.evaluate(() => FFF.label.open());
    rec.reload.dialog = await p2.evaluate(() => !!document.querySelector('dialog.fff-dlg[open]'));
    rec.reload.errs = e2;
    if (e2.length) rec.probleme.push('fișierul salvat are erori: ' + e2.slice(0, 2).join(' | '));
    if (!rec.reload.fff || !rec.reload.dialog) rec.probleme.push('kitul nu funcționează în fișierul salvat');
    if (rec.saved.kitBlocks !== 1) rec.probleme.push('blocuri kit în fișierul salvat: ' + rec.saved.kitBlocks);
    if (rec.saved.dialogInside) rec.probleme.push('dialogul a ajuns în fișierul salvat');
    await ctx2.close();
  }
  if (errs.length) rec.probleme.push('erori înainte de salvare: ' + errs.slice(0, 2).join(' | '));
  out.push(rec);
  await ctx.close();
  console.log(c.name, rec.probleme.length ? 'PROBLEME ' + rec.probleme.join(' || ') : 'ok', JSON.stringify(rec.saved || {}).slice(0, 300), JSON.stringify(rec.reload || {}).slice(0, 200));
}
await b.close();
if (args.out) fs.writeFileSync(args.out, JSON.stringify(out, null, 1));
process.exit(0);
