// Teste FFF.label (dialogul „Transparență”). Rulare: node test/label.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {makeApp, launch, newPage, axe, check, summary, FIXTURE, HERE} from './_pw.mjs';

const browser = await launch();
const app = makeApp(FIXTURE, {config: {egressNote: 'Nota demo de rețea.', selfModifying: true}});
const {page, errors, net} = await newPage(browser);
await page.goto(app.url);
await page.waitForTimeout(600);

console.log('buton #app-version');
const el = await page.evaluate(() => { const e = document.getElementById('app-version'); return {role: e.getAttribute('role'), tab: e.getAttribute('tabindex'), pop: e.getAttribute('aria-haspopup'), title: e.getAttribute('title'), text: e.textContent, state: FFF.label.state}; });
check('role=button, tabindex=0, aria-haspopup=dialog, title, text păstrat', el.role === 'button' && el.tab === '0' && el.pop === 'dialog' && /transparen/i.test(el.title) && el.text === 'v 1.2.3 · 2026-10-14' && el.state === 'button', el);
await page.click('#inc'); await page.fill('#note', 'abc');
await page.click('#app-version');
check('click deschide <dialog> modal', await page.evaluate(() => { const d = document.querySelector('dialog.fff-dlg'); return !!d && d.open && d.matches(':modal') && d.getAttribute('aria-labelledby') === 'fff-lbl-title'; }));
const txt = await page.evaluate(() => document.querySelector('dialog.fff-dlg').innerText);
check('conține secțiunile cerute', ['Transparență', 'Demo FFF', 'Rețea', 'Stocare', 'Permisiuni', 'Fișier', 'Copie de siguranță'].every((s) => txt.includes(s)), txt.slice(0, 200));
check('rețea: gazda declarată + nota din fff.config.json', txt.includes('example.org') && txt.includes('Nota demo de rețea.'));
check('stocare: chei + octeți', /fx\.count\s+\d+ B/.test(txt) && txt.includes('chei'), txt.match(/Stocare[\s\S]{0,200}/)?.[0]);
check('permisiuni: localStorage listat', txt.includes('localStorage'));
check('fișier: SHA-256 declarat + dimensiune', txt.includes(await page.evaluate(() => document.documentElement.getAttribute('data-fff-hash'))) && /Dimensiune: [\d.]+ KB/.test(txt));
check('selfModifying din fff.config.json → avertisment în dialog', txt.includes('își poate salva propria copie'));
check('kit: versiune și module', txt.includes('fff-kit v1.1.4') && txt.includes('core, label, bundle'));
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
check('Esc închide și elimină dialogul din DOM', await page.evaluate(() => document.querySelectorAll('dialog').length === 0));
check('focusul revine pe #app-version', await page.evaluate(() => document.activeElement && document.activeElement.id === 'app-version'));
await page.keyboard.press('Enter'); await page.waitForTimeout(150);
check('Enter pe buton deschide', await page.evaluate(() => FFF.label.isOpen()));
await page.evaluate(() => FFF.label.close()); await page.waitForTimeout(100);
await page.focus('#app-version'); await page.keyboard.press('Space'); await page.waitForTimeout(150);
check('Space pe buton deschide', await page.evaluate(() => FFF.label.isOpen()));
await page.mouse.click(5, 5); await page.waitForTimeout(150); // click pe fundal
check('click pe fundal închide', !(await page.evaluate(() => FFF.label.isOpen())));

console.log('stocare live');
await page.click('#app-version');
await page.evaluate(() => localStorage.setItem('fx.big', 'x'.repeat(5000)));
await page.waitForTimeout(1800);
const live = await page.evaluate(() => document.querySelector('dialog.fff-dlg').innerText);
check('lista de stocare se actualizează live (fx.big ≈ 4.9 KB)', /fx\.big\s+4\.9 KB/.test(live), live.match(/fx\.big.*/)?.[0]);
await page.evaluate(() => FFF.label.close());

console.log('verificator de hash');
const decl = await page.evaluate(() => document.documentElement.getAttribute('data-fff-hash'));
const bad = path.join(app.dir, 'modificat.html'); fs.writeFileSync(bad, fs.readFileSync(app.file, 'utf8') + '\n<!-- x -->');
const blank = path.join(app.dir, 'golit.html'); fs.writeFileSync(blank, fs.readFileSync(app.file, 'utf8').replace(decl, '').replace(decl, ''));
async function verify(file) {
  await page.evaluate(() => FFF.label.open());
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('dialog button:has-text("Verifică un fișier")')]);
  await fc.setFiles(file);
  await page.waitForFunction(() => /Se potrivește|Nu se potrivește|nu a putut/.test(document.querySelector('.fff-res.fff-ok, .fff-res.fff-bad')?.textContent || ''), null, {timeout: 5000});
  const r = await page.evaluate(() => document.querySelector('.fff-res.fff-ok, .fff-res.fff-bad').textContent);
  await page.evaluate(() => FFF.label.close());
  return r;
}
check('fișierul descărcat identic → „Se potrivește”', /Se potrivește/.test(await verify(app.file)));
check('fișier cu atributele de hash golite (canonic) → „Se potrivește”', /Se potrivește/.test(await verify(blank)));
const vb = await verify(bad);
check('fișier modificat → „Nu se potrivește” + hash calculat', /Nu se potrivește/.test(vb) && /[0-9a-f]{64}/.test(vb), vb);
const shell = await page.evaluate(() => FFF.label.shellCommand);
const viaShell = execSync(shell.replace('index.html', JSON.stringify(app.file)), {shell: '/bin/bash', encoding: 'utf8'}).split(/\s+/)[0];
check('comanda din dialog (sed | sha256sum) dă același hash declarat', viaShell === decl, [viaShell, decl]);

console.log('instalare');
await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = 1; }; window.dispatchEvent(e); });
await page.evaluate(() => FFF.label.open());
check('buton „Instalează” apare când există beforeinstallprompt', await page.evaluate(() => /Instalează aplicația/.test(document.querySelector('dialog').innerText)));
await page.click('dialog button:has-text("Instalează aplicația")');
check('click apelează prompt()', await page.evaluate(() => window.__prompted === 1));
await page.evaluate(() => FFF.label.close());

console.log('limbi');
for (const l of ['en', 'fr', 'it', 'es', 'pt', 'hu', 'de']) {
  await page.evaluate((x) => { document.documentElement.lang = x; }, l);
  await page.evaluate(() => FFF.label.open());
  const t = await page.evaluate(() => ({h: document.querySelector('#fff-lbl-title').textContent, lang: document.querySelector('dialog').lang, title: document.getElementById('app-version').title}));
  check(`${l}: titlul tradus (${t.h}), dialog[lang], title buton`, t.h && t.h !== 'Transparență' && t.lang === l && t.title && t.title !== 'Deschide eticheta de transparență' || l === 'en' && t.h === 'Transparency', t);
  await page.evaluate(() => FFF.label.close());
}
await page.evaluate(() => { document.documentElement.lang = 'ro'; });
const J = JSON.parse(fs.readFileSync(path.join(HERE, '../i18n/label.json'), 'utf8'));
const ks = Object.keys(J.ro);
check('label.json: 8 limbi cu exact aceleași chei, fără șiruri goale', Object.keys(J).join() === 'ro,en,fr,it,es,pt,hu,de' && Object.values(J).every((o) => Object.keys(o).join() === ks.join() && Object.values(o).every((v) => v.length)));
const vars = (s) => (s.match(/\{[a-z]+\}/g) || []).sort().join();
check('label.json: aceleași {variabile} în toate limbile', ks.every((k) => Object.values(J).every((o) => vars(o[k]) === vars(J.ro[k]))));

console.log('accesibilitate / aspect');
for (const scheme of ['light', 'dark']) {
  const p = await newPage(browser, {scheme});
  await p.page.goto(app.url); await p.page.waitForTimeout(400);
  const v0 = await axe(p.page);
  await p.page.click('#app-version');
  const v1 = await axe(p.page);
  check(`axe ${scheme}: 0 violări pe pagină și cu dialogul deschis`, v0.length === 0 && v1.length === 0, {v0, v1});
  await p.ctx.close();
}
const mob = await newPage(browser, {w: 360, h: 740});
await mob.page.goto(app.url); await mob.page.waitForTimeout(400);
await mob.page.click('#app-version');
const geo = await mob.page.evaluate(() => { const d = document.querySelector('dialog'); const r = d.getBoundingClientRect(); return {sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, dw: d.scrollWidth, dcw: d.clientWidth, left: r.left, right: r.right}; });
check('360×740: fără depășire orizontală (pagină și dialog)', geo.sw <= geo.cw && geo.dw <= geo.dcw && geo.left >= 0 && geo.right <= 360, geo);
const tgt = await mob.page.evaluate(() => [...document.querySelectorAll('dialog button, dialog summary, dialog input')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }).sort((a, b) => a - b)[0]);
check('ținte tactile ≥ 24 px', tgt >= 24, tgt);
const red = await newPage(browser, {reduced: true});
await red.page.goto(app.url); await red.page.click('#app-version');
check('prefers-reduced-motion: fără animație', await red.page.evaluate(() => getComputedStyle(document.querySelector('dialog')).animationName === 'none'));
// tema gazdei are prioritate față de sistem: pagină întunecată, sistem luminos
const dk = makeApp(FIXTURE.replace('background:#fff;color:#111', 'background:#101418;color:#eee'));
const dp = await newPage(browser, {scheme: 'light'});
await dp.page.goto(dk.url); await dp.page.click('#app-version');
check('dialogul urmează tema gazdei (fundal închis → .fff-dark)', await dp.page.evaluate(() => document.querySelector('dialog').classList.contains('fff-dark')));

console.log('fără #app-version');
const noav = FIXTURE.replace('<span id="app-version">v 1.2.3 · 2026-10-14</span>', '');
const na = makeApp(noav, {info: false});
const n1 = await newPage(browser); await n1.page.goto(na.url); await n1.page.waitForTimeout(1500);
check('cu <footer>: buton discret în footer', await n1.page.evaluate(() => !!document.querySelector('footer button.fff-chip') && FFF.label.state === 'footer'));
await n1.page.click('footer button.fff-chip');
check('butonul din footer deschide dialogul (fără info: mesaj onest)', await n1.page.evaluate(() => /indisponibile/.test(document.querySelector('dialog').innerText)));
const nf = makeApp(noav.replace(/<footer>[\s\S]*<\/footer>/, ''), {info: false});
const n2 = await newPage(browser); await n2.page.goto(nf.url); await n2.page.waitForTimeout(1500);
check('fără footer: nu adaugă nimic, dar FFF.label.open() merge', await n2.page.evaluate(() => { const before = document.querySelectorAll('button').length; FFF.label.open(); const ok = FFF.label.isOpen(); FFF.label.close(); return ok && FFF.label.state === 'none' && before === 1; }));
// copie salvată de aplicație (outerHTML): resturile nu se dublează la reîncărcare
await n1.page.evaluate(() => FFF.label.open());
const ser = '<!DOCTYPE html>\n' + await n1.page.evaluate(() => document.documentElement.outerHTML);
const serFile = path.join(na.dir, 'serializat.html'); fs.writeFileSync(serFile, ser);
const n7 = await newPage(browser); await n7.page.goto('file://' + serFile); await n7.page.waitForTimeout(1500);
check('pagină serializată cu chip și dialog deschis: după reîncărcare 1 chip, 0 dialoguri rămase', await n7.page.evaluate(() => document.querySelectorAll('.fff-chip').length === 1 && document.querySelectorAll('dialog').length === 0 && FFF.label.state === 'footer'), ser.includes('<dialog'));
const serApp = '<!DOCTYPE html>\n' + await page.evaluate(() => document.documentElement.outerHTML);
const serFile2 = path.join(app.dir, 'serializat.html'); fs.writeFileSync(serFile2, serApp);
const n8 = await newPage(browser); await n8.page.goto('file://' + serFile2); await n8.page.waitForTimeout(800);
check('pagină serializată cu #app-version decorat: rămâne un singur buton funcțional (state=button)', await n8.page.evaluate(() => FFF.label.state === 'button' && document.querySelectorAll('[data-fff-label]').length === 1 && (document.querySelector('#app-version').click(), FFF.label.isOpen())));
const lowc = makeApp(noav.replace('footer{margin-top:24px', 'footer{color:#b0b8c0;margin-top:24px'), {info: false});
const n5 = await newPage(browser); await n5.page.goto(lowc.url); await n5.page.waitForTimeout(1500);
const ax5 = (await axe(n5.page)).filter((v) => v.nodes.some((t) => t.includes('fff-chip')));
check('butonul din footer: contrast corectat când footerul gazdei e prea deschis (axe 0 pentru .fff-chip)', ax5.length === 0 && await n5.page.evaluate(() => !!document.querySelector('.fff-chip').style.color), ax5);
const hidf = makeApp(noav.replace('footer{margin-top:24px', 'footer{display:none;margin-top:24px'), {info: false});
const n6 = await newPage(browser); await n6.page.goto(hidf.url); await n6.page.waitForTimeout(1500);
check('footer ascuns: nu se adaugă butonul de rezervă', await n6.page.evaluate(() => !document.querySelector('.fff-chip') && FFF.label.state === 'none'));
const late = makeApp(FIXTURE.replace('<span id="app-version">v 1.2.3 · 2026-10-14</span>', '<span id="slot"></span>').replace('</script>\n</body>', "setTimeout(function(){document.getElementById('slot').innerHTML='<span id=\"app-version\">v 1.2.3 · 2026-10-14</span>';},300);\n</script>\n</body>"), {info: false});
const n3 = await newPage(browser); await n3.page.goto(late.url); await n3.page.waitForTimeout(1200);
check('element #app-version creat târziu: devine buton (MutationObserver) și fără buton de rezervă', await n3.page.evaluate(() => document.getElementById('app-version').getAttribute('role') === 'button' && !document.querySelector('.fff-chip')));
const nest = makeApp(FIXTURE.replace('<span id="app-version">v 1.2.3 · 2026-10-14</span>', '<button type="button" id="about"><span id="app-version">v 1.2.3</span></button>'), {info: false});
const n4 = await newPage(browser); await n4.page.goto(nest.url); await n4.page.waitForTimeout(600);
check('#app-version în interiorul unui buton: nu se transformă (fără interactive imbricate)', await n4.page.evaluate(() => document.getElementById('app-version').getAttribute('role') === null && FFF.label.state === 'nested'));
console.log('1.1.4: dimensiuni minime (țintă ≥ 24 px, text ≥ 12 px)');
const AV = '<span id="app-version">v 1.2.3 · 2026-10-14</span>';
const dimOf = async (html, vp, info = true) => {
  const a = makeApp(html, {info}); const q = await newPage(browser, vp); await q.page.goto(a.url); await q.page.waitForTimeout(1300);
  const r = await q.page.evaluate(() => { const e = document.getElementById('app-version'), b = e && e.getBoundingClientRect(), cs = e && getComputedStyle(e); return e ? {h: b.height, w: b.width, disp: cs.display, fs: parseFloat(cs.fontSize), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, chip: !!document.querySelector('.fff-chip')} : {chip: !!document.querySelector('.fff-chip'), cf: (() => { const c = document.querySelector('.fff-chip'); return c ? parseFloat(getComputedStyle(c).fontSize) : 0; })(), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth}; });
  q.errors.length && console.log(q.errors); return r;
};
for (const vp of [{w: 360, h: 740}, {w: 1366, h: 850}]) {
  const tag = vp.w + ' px: ';
  const i1 = await dimOf(FIXTURE.replace(AV, '<span id="app-version" style="font-size:9px">v 1.2.3 · 2026-10-14</span>'), vp);
  check(tag + 'span inline 9 px → ≥ 24 px înălțime, font ≥ 12 px, inline-flex', i1.h >= 24 && i1.w >= 24 && i1.fs >= 12 && i1.disp === 'inline-flex' && i1.sw <= i1.cw, i1);
  const i2 = await dimOf(FIXTURE.replace(AV, '<p id="app-version" style="font-size:10px;margin:0">v 1.2.3 · 2026-10-14</p>'), vp);
  check(tag + 'bloc (p) rămâne bloc; ≥ 24 px, font ≥ 12 px', i2.h >= 24 && i2.disp === 'block' && i2.fs >= 12 && i2.sw <= i2.cw, i2);
  const i3 = await dimOf(FIXTURE.replace(AV, '<span id="app-version" style="font-size:18px;display:block">v 1.2.3 · 2026-10-14</span>'), vp);
  check(tag + 'display:block al aplicației păstrat, font 18 px neschimbat', i3.disp === 'block' && i3.fs === 18 && i3.h >= 24, i3);
  const i4 = await dimOf(FIXTURE.replace(AV, '<span id="app-version">v 1.2.3 <small style="font-size:8px">beta</small></span>'), vp);
  const sm = await (async () => { const a = makeApp(FIXTURE.replace(AV, '<span id="app-version">v 1.2.3 <small style="font-size:8px">beta</small></span>')); const q = await newPage(browser, vp); await q.page.goto(a.url); await q.page.waitForTimeout(1300); return q.page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#app-version small')).fontSize)); })();
  check(tag + 'descendent cu font 8 px în #app-version → 12 px', sm >= 12 && i4.h >= 24, {sm, i4});
  const i5 = await dimOf(noav.replace('footer{margin-top:24px', 'footer{font-size:10px;margin-top:24px'), vp, false);
  check(tag + 'buton de rezervă .fff-chip: font ≥ 12 px, fără depășire orizontală', i5.chip && i5.cf >= 12 && i5.sw <= i5.cw, i5);
}
const cleanErrs = [...errors, ...n1.errors, ...n2.errors, ...n3.errors, ...n4.errors, ...mob.errors];
check('0 pageerror/CSP în toate scenariile', cleanErrs.length === 0, cleanErrs);
check('0 cereri de rețea', net.length === 0 && mob.net.length === 0, net);
await browser.close();
summary('label');
