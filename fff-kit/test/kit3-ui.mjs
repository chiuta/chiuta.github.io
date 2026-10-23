// Teste UI (Playwright, rețea blocată): FFF.srs.panel, FFF.tts.picker, FFF.pii.guard — tastatură, axe, CSP, depășire orizontală.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {createRequire} from 'node:module'; import {fileURLToPath, pathToFileURL} from 'node:url';
const require = createRequire('/opt/node-tools/package.json'); const {chromium} = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), kit = path.join(here, '..');
const S = fs.mkdtempSync(path.join(os.tmpdir(), 'fff-kit3-'));
const AXE = fs.readFileSync((await import('./_axe.mjs')).AXE, 'utf8');
const tmp = fs.mkdtempSync(path.join(S, 'tmp_k3-')); // șters la final
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };

// i18n ca script extern (compatibil cu CSP fără 'unsafe-inline')
const mods = ['srs', 'tts', 'pii', 'search'];
fs.writeFileSync(tmp + '/i18n.js', mods.map(m => `FFF.registerI18n(${JSON.stringify(m)},${fs.readFileSync(path.join(kit, 'i18n', m + '.json'), 'utf8')});`).join('\n'));
const mock = `(()=>{const V=[{name:'Ioana',lang:'ro-RO',voiceURI:'ioana',localService:true,default:false},{name:'Google RO',lang:'ro-RO',voiceURI:'g-ro',localService:false,default:false},{name:'Alex',lang:'en-US',voiceURI:'alex',localService:true,default:true}];
window.__spoken=[];let q=[],cur=null,paused=false;const ev={};
const s={getVoices:()=>V,speaking:false,addEventListener(t,f){(ev[t]=ev[t]||[]).push(f)},removeEventListener(){},cancel(){q=[];cur=null},pause(){paused=true;window.__paused=true},resume(){paused=false;window.__paused=false},
speak(u){q.push(u);setTimeout(function pump(){if(paused)return setTimeout(pump,5);const x=q.shift();if(!x)return;window.__spoken.push({t:x.text,v:x.voice&&x.voice.name,r:x.rate});x.onstart&&x.onstart({});setTimeout(()=>{x.onend&&x.onend({});pump()},5)},1)}};
Object.defineProperty(window,'speechSynthesis',{value:s,configurable:true});window.SpeechSynthesisUtterance=class{constructor(t){this.text=t;this.voice=null;this.rate=1;this.lang=''}};})();`;
fs.writeFileSync(tmp + '/mock.js', mock);
const html = csp => `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1><title>Fixture kit3</title>
${csp ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src file:; style-src 'unsafe-inline'; connect-src 'none'; img-src data:; base-uri 'none'; form-action 'none'">` : ''}
<style>:root{color-scheme:light dark}body{font:16px system-ui;margin:0;padding:16px;background:Canvas;color:CanvasText}</style></head><body>
<main><h1>Fixture</h1><div id="srs"></div><div id="tts"></div><label for="ta">Text</label><br><textarea id="ta" rows="4" style="width:100%;box-sizing:border-box"></textarea><button id="send" type="button">Trimite</button><output id="out" aria-live="polite"></output></main>
<script src="${pathToFileURL(path.join(process.env.CORE === 'real' ? path.join(kit, 'src', 'core.js') : path.join(here, 'core-shim.js')))}"></script><script src="i18n.js"></script>
${mods.map(m => `<script src="${pathToFileURL(path.join(kit, 'src', m + '.js'))}"></script>`).join('')}
<script src="page.js"></script></body></html>`.replace('initial-scale=1>', 'initial-scale=1">');
fs.writeFileSync(tmp + '/page.js', `
FFF.registerI18n; // modulele își iau textele din FFF.t
window.__guardLog=[];
FFF.srs.panel(document.getElementById('srs'),{deckId:'ui',items:[{front:'Capitala României?',back:'București'},{front:'2+2',back:'4'},{front:'H2O',back:'apă'}]});
FFF.tts.picker(document.getElementById('tts'),{lang:'ro'});
const g=FFF.pii.guard({getText:()=>document.getElementById('ta').value,setText:v=>document.getElementById('ta').value=v,onSend:t=>{window.__guardLog.push(t);document.getElementById('out').textContent=t}});
document.getElementById('send').addEventListener('click',()=>{g.run().then(r=>window.__guardResult=r)});
`);
fs.writeFileSync(tmp + '/fixture.html', html(false)); fs.writeFileSync(tmp + '/fixture-csp.html', html(true));

const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
async function newPage(file, {bypass = false, w = 1280, h = 800} = {}) {
  const ctx = await browser.newContext({viewport: {width: w, height: h}, bypassCSP: bypass, acceptDownloads: true});
  await ctx.route(/^https?:/, r => r.abort());
  await ctx.addInitScript(mock);
  const page = await ctx.newPage(); const errs = {pageerror: [], csp: [], net: [], console: []};
  page.on('pageerror', e => errs.pageerror.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.console.push(m.text()); });
  page.on('request', r => { if (/^https?:/.test(r.url())) errs.net.push(r.url()); });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI)));
  await page.goto(pathToFileURL(path.join(tmp, file)).href); await page.waitForTimeout(300);
  return {ctx, page, errs};
}
async function axe(page, label) {
  await page.evaluate(AXE); await page.waitForTimeout(3500);
  const r = await page.evaluate(async () => { const x = await axe.run(document, {runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']}); return x.violations.map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).join(' | ')); });
  ok(r.length === 0, `axe ${label}: ${r.join(' ;; ')}`);
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ===================== CSP + încărcare =====================
{
  const {ctx, page, errs} = await newPage('fixture-csp.html');
  ok(await page.locator('.fff-srs').count() === 1 && await page.locator('.fff-tts').count() === 1, 'UI randat sub CSP strict');
  await page.fill('#ta', 'Scrie-mi la ion@exemplu.ro'); await page.click('#send'); await page.waitForSelector('dialog.fff-pii[open]');
  const csp = await page.evaluate(() => window.__csp || []);
  ok(csp.length === 0, 'violări CSP: ' + csp.join(',')); ok(errs.pageerror.length === 0, 'pageerror: ' + errs.pageerror.join(';')); ok(errs.net.length === 0, 'cereri rețea: ' + errs.net.join(',')); ok(errs.console.length === 0, 'console.error: ' + errs.console.join(';'));
  await ctx.close();
}

// ===================== SRS: tastatură =====================
{
  const {ctx, page, errs} = await newPage('fixture.html', {bypass: true});
  const focusTxt = () => page.evaluate(() => document.activeElement && (document.activeElement.textContent || '').trim());
  ok((await focusTxt()).startsWith('Arată răspunsul'), 'focus pe „Arată răspunsul” la început: ' + await focusTxt());
  ok(await page.locator('.fff-srs-front').textContent() === 'Capitala României?', 'față primul card');
  ok(await page.locator('.fff-srs-back').count() === 0, 'răspunsul ascuns');
  await page.keyboard.press('Space');
  ok(await page.locator('.fff-srs-back').textContent() === 'București', 'Space arată răspunsul');
  ok(await page.locator('.fff-srs-row[role=group]').isVisible(), 'butoane de notă vizibile');
  await axe(page, 'srs după răspuns (ro)');
  await page.keyboard.press('3');                       // Bine -> q=4
  ok(await page.locator('.fff-srs-front').textContent() === '2+2', '3 notează și trece la următorul');
  await page.keyboard.press('Space'); await page.keyboard.press('1');   // Din nou -> rămâne azi
  ok(await page.locator('.fff-srs-front').textContent() === 'H2O' || await page.locator('.fff-srs-front').textContent() === '2+2', 'după „Din nou” continuă');
  // restul cardurilor: arată + Bine
  for (let i = 0; i < 6; i++) { if (await page.locator('.fff-srs-front').count() === 0) break; await page.keyboard.press('Space'); await page.keyboard.press('4'); }
  const txt = await page.locator('.fff-srs-card').textContent();
  ok(/Nimic de învățat/.test(txt), 'final: ' + txt);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem((FFF.store.prefix || 'fff.test.') + 'srs.ui')));
  ok(st && st.cards.length === 3 && st.cards.every(c => c.rev >= 1) && st.log.rev >= 4, 'stare persistată în store');
  const cap = st.cards.find(c => c.f === 'Capitala României?'); ok(cap.n === 1 && cap.i === 1 && cap.ef === 2.5, 'primul card: o notă 4 -> n=1, i=1, EF 2.5: ' + JSON.stringify(cap));
  ok(/mature|retenți/i.test(await page.locator('.fff-srs-stats').textContent()), 'statistici afișate');
  // Space/cifre nu fac nimic fără card
  await page.keyboard.press('Space'); await page.keyboard.press('2');
  // export
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name: /Exportă/}).click()]);
  const name = dl.suggestedFilename(); const body = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok(name === 'ui.fff.json' && body.format === 'fff-srs-deck' && body.cards.length === 3, 'export .fff.json: ' + name);
  // import într-un pachet nou după ștergerea stării
  fs.writeFileSync(tmp + '/deck.fff.json', JSON.stringify(body));
  await page.evaluate(() => { localStorage.removeItem((FFF.store.prefix || 'fff.test.') + 'srs.ui'); });
  await page.reload(); await page.waitForTimeout(200);
  await page.evaluate(() => { localStorage.removeItem((FFF.store.prefix || 'fff.test.') + 'srs.ui'); });
  await page.reload(); await page.waitForTimeout(200);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', {name: /Importă/}).click()]);
  await fc.setFiles(tmp + '/deck.fff.json'); await page.waitForTimeout(300);
  ok(/Nimic de învățat|carduri importate|cards/i.test(await page.locator('.fff-srs').textContent()), 'import: ' + (await page.locator('.fff-srs-hint[role=status]').textContent()));
  ok(/3 carduri importate/.test(await page.locator('.fff-srs-hint[role=status]').textContent()), 'mesaj import: ' + await page.locator('.fff-srs-hint[role=status]').textContent());
  ok(errs.pageerror.length === 0, 'srs pageerror ' + errs.pageerror.join(';'));
  await ctx.close();
}
// SRS mobil + depășire + axe în alte limbi + mod întunecat
for (const [lang, scheme] of [['en', 'dark'], ['de', 'light'], ['hu', 'dark']]) {
  const {ctx, page} = await newPage('fixture.html', {bypass: true, w: 360, h: 740});
  await page.emulateMedia({colorScheme: scheme, reducedMotion: 'reduce'});
  await page.evaluate(l => { document.documentElement.lang = l; }, lang);
  await page.reload(); await page.evaluate(l => { document.documentElement.lang = l; localStorage.clear(); }, lang); await page.reload(); await page.evaluate(l => document.documentElement.lang = l, lang);
  await page.evaluate(() => { document.getElementById('srs').textContent = ''; FFF.srs.panel(document.getElementById('srs'), {deckId: 'm' + Math.random(), items: [{front: 'Q', back: 'A'}]}); });
  await page.keyboard.press('Space');
  ok(await overflow(page) <= 0, `fără depășire orizontală 360px (${lang}): ${await overflow(page)}`);
  await axe(page, `srs+tts ${lang}/${scheme}`);
  await ctx.close();
}

// ===================== TTS picker =====================
{
  const {ctx, page, errs} = await newPage('fixture.html', {bypass: true});
  const opts = () => page.locator('.fff-tts select option').allTextContents();
  let o = await opts(); ok(o.length === 2 && /Ioana/.test(o[1]) && !o.some(x => /Google/.test(x)), 'doar vocea locală ro la început: ' + o.join('|'));
  await page.check('.fff-tts input[type=checkbox]'); o = await opts(); ok(o.length === 3 && o.some(x => /Google RO.*online/.test(x)), 'voci online la cerere: ' + o.join('|'));
  await page.uncheck('.fff-tts input[type=checkbox]');
  await page.selectOption('.fff-tts select', {index: 1});
  await page.locator('.fff-tts input[type=range]').fill('1.5');
  await page.getByRole('button', {name: 'Ascultă'}).click(); await page.waitForTimeout(150);
  const sp = await page.evaluate(() => window.__spoken);
  ok(sp.length === 1 && sp[0].v === 'Ioana' && sp[0].r === 1.5 && /probă de voce/.test(sp[0].t), 'proba: ' + JSON.stringify(sp));
  const saved = await page.evaluate(() => [localStorage.getItem((FFF.store.prefix || 'fff.test.') + 'tts.voice.ro'), localStorage.getItem((FFF.store.prefix || 'fff.test.') + 'tts.rate')]);
  ok(saved[0] === '"ioana"' && saved[1] === '1.5', 'preferințe păstrate: ' + saved.join(','));
  await page.evaluate(() => { window.__long = FFF.tts.speak(Array.from({length: 300}, (_, i) => 'Propoziția numărul ' + i + '.').join(' '), {lang: 'ro'}); });
  await page.waitForTimeout(50);
  await page.getByRole('button', {name: 'Pauză'}).click(); ok(await page.evaluate(() => window.__paused === true), 'pauză'); ok(await page.getByRole('button', {name: 'Reia'}).count() === 1, 'buton Reia');
  await page.getByRole('button', {name: 'Reia'}).click(); await page.evaluate(() => FFF.tts.stop());
  ok(errs.pageerror.length === 0, 'tts pageerror');
  await ctx.close();
}
{ // fără suport: mesaj tradus, fără crăpare
  const ctx = await browser.newContext({bypassCSP: true}); const page = await ctx.newPage(); const pe = []; page.on('pageerror', e => pe.push(String(e)));
  await page.addInitScript(() => { delete window.speechSynthesis; Object.defineProperty(window, 'speechSynthesis', {value: undefined, configurable: true}); delete window.SpeechSynthesisUtterance; });
  await page.goto(pathToFileURL(path.join(tmp, 'fixture.html')).href); await page.waitForTimeout(300);
  ok(/nu este disponibilă/.test(await page.locator('.fff-tts-msg').textContent()), 'mesaj „indisponibil”: ' + await page.locator('.fff-tts-msg').textContent());
  ok(await page.locator('.fff-tts select').isDisabled(), 'selector dezactivat'); ok(pe.length === 0, 'fără pageerror fără suport: ' + pe.join(';'));
  await ctx.close();
}

// ===================== PII guard =====================
{
  const {ctx, page, errs} = await newPage('fixture.html', {bypass: true});
  const TXT = 'Scrie la ion.popescu@exemplu.ro sau sună 0722 123 456. Mulțumesc!';
  await page.fill('#ta', 'Salut, ce mai faci?'); await page.click('#send'); await page.waitForTimeout(150);
  ok(await page.locator('dialog.fff-pii').count() === 0, 'text curat: fără dialog'); ok(await page.evaluate(() => window.__guardResult) === 'clean', 'rezultat clean');
  await page.fill('#ta', TXT); await page.focus('#send'); await page.click('#send'); await page.waitForSelector('dialog.fff-pii[open]');
  const lab = await page.evaluate(() => { const d = document.querySelector('dialog.fff-pii'); return [d.getAttribute('aria-labelledby'), document.getElementById(d.getAttribute('aria-labelledby')).textContent, d.querySelectorAll('input[type=checkbox]').length, document.activeElement.textContent]; });
  ok(lab[1] === 'Date personale detectate' && lab[2] === 2, 'dialog titlu/2 detectări: ' + lab.join('|')); ok(/Maschează/.test(lab[3]), 'focus pe butonul principal');
  const shown = await page.locator('dialog.fff-pii').textContent(); ok(!shown.includes('ion.popescu@exemplu.ro') && !shown.includes('0722 123 456'), 'valorile complete nu se afișează în dialog (doar mascate parțial)');
  await axe(page, 'dialog PII (ro)');
  ok(await overflow(page) <= 0, 'dialog fără depășire');
  // capcană de focus: Tab ciclează în dialog
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  ok(await page.evaluate(() => !!document.activeElement.closest('dialog')), 'focus rămâne în dialog');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  ok(await page.locator('dialog.fff-pii').count() === 0 && await page.evaluate(() => window.__guardResult) === 'cancelled', 'Esc anulează');
  ok(await page.evaluate(() => document.activeElement.id) === 'send', 'focusul revine pe butonul Trimite');
  ok(await page.evaluate(() => window.__guardLog.length) === 1, 'anularea nu trimite (rămâne doar trimiterea textului curat)');
  await page.click('#send'); await page.waitForSelector('dialog.fff-pii[open]'); await page.getByRole('button', {name: /Maschează/}).click(); await page.waitForTimeout(100);
  ok(await page.inputValue('#ta') === 'Scrie la [EMAIL] sau sună [PHONE]. Mulțumesc!', 'mascare: ' + await page.inputValue('#ta'));
  ok(await page.evaluate(() => window.__guardLog.at(-1)) === 'Scrie la [EMAIL] sau sună [PHONE]. Mulțumesc!', 'onSend primește textul mascat');
  await page.fill('#ta', TXT); await page.click('#send'); await page.waitForSelector('dialog.fff-pii[open]');
  await page.locator('dialog.fff-pii input[type=checkbox]').nth(1).uncheck();          // nu masca telefonul
  await page.getByRole('button', {name: /Maschează/}).click(); await page.waitForTimeout(100);
  ok(await page.inputValue('#ta') === 'Scrie la [EMAIL] sau sună 0722 123 456. Mulțumesc!', 'mascare selectivă: ' + await page.inputValue('#ta'));
  await page.fill('#ta', TXT); await page.click('#send'); await page.waitForSelector('dialog.fff-pii[open]'); await page.getByRole('button', {name: 'Continuă fără mascare'}).click(); await page.waitForTimeout(100);
  ok(await page.evaluate(() => window.__guardLog.at(-1)) === TXT && await page.evaluate(() => window.__guardResult) === 'continued', 'continuă fără mascare trimite originalul');
  ok(errs.pageerror.length === 0, 'pii pageerror ' + errs.pageerror.join(';'));
  await ctx.close();
}
for (const lang of ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de']) {   // dialog în toate cele 8 limbi: axe, titlu tradus, mobil
  for (const scheme of ['light', 'dark']) {
    const {ctx, page} = await newPage('fixture.html', {bypass: true, w: 360, h: 740});
    await page.emulateMedia({colorScheme: scheme}); await page.evaluate(l => document.documentElement.lang = l, lang);
    await page.fill('#ta', 'Mail ion@exemplu.ro, IBAN RO49 AAAA 1B31 0075 9384 0000, CNP 1800101221144, ' + 'http://x.ro/?token=abcdef123456'); await page.click('#send'); await page.waitForSelector('dialog.fff-pii[open]');
    const title = await page.locator('dialog.fff-pii h2').textContent();
    ok(title && title.length > 3 && (lang === 'en' || title !== 'Personal data detected'), `titlu ${lang}: ${title}`);
    if (scheme === 'light' || lang === 'ro') await axe(page, `dialog PII ${lang}/${scheme}`);
    ok(await overflow(page) <= 0, `dialog ${lang}/${scheme} 360px fără depășire`);
    await ctx.close();
  }
}
await browser.close();
fs.rmSync(tmp, {recursive: true, force: true});
console.log(`kit3-ui: ${pass} ok, ${fail} eșuate`); process.exit(fail ? 1 : 0);
