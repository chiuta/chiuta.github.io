// Teste FFF.dialog (kit 1.2.0): confirm/alert/prompt/show/choice, toast/notify (aria-live), <dialog> modal, Esc, capcană de focus, restaurarea focusului,
// 8 limbi, tema prin variabile CSS, ținte ≥ 44 px (pointer:coarse), axe la 360 și 1366 px, stratul FFF.bundle.confirm, alias-uri ffAsk/ffShow/ffPrompt.
// Rulare: node test/dialog.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import {makeApp, launch, newPage, axe, check, summary, FIXTURE, HERE, chromium} from './_pw.mjs';

const I18N = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'i18n', 'dialog.json'), 'utf8'));
const LANGS = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de'];

console.log('i18n/dialog.json');
check('8 limbi, aceleași chei, fără valori goale', LANGS.every((l) => I18N[l]) && LANGS.every((l) => Object.keys(I18N[l]).sort().join() === Object.keys(I18N.ro).sort().join()) && LANGS.every((l) => Object.values(I18N[l]).every((v) => typeof v === 'string' && v.trim())));

const browser = await launch();
const app = makeApp(FIXTURE, {modules: 'core,store,dialog,label,bundle'});
const {page, errors, net} = await newPage(browser, {w: 1366, h: 800});
await page.goto(app.url);
await page.waitForTimeout(400);

console.log('API');
check('FFF.dialog: confirm/alert/prompt/show/choice/toast/notify', await page.evaluate(() => ['confirm', 'alert', 'prompt', 'show', 'choice', 'toast', 'notify', 'closeAll'].every((k) => typeof FFF.dialog[k] === 'function')));
check('alias-uri ffAsk/ffShow/ffPrompt definite', await page.evaluate(() => ['ffAsk', 'ffShow', 'ffPrompt'].every((k) => typeof window[k] === 'function')));

console.log('confirm: structură, focus, Esc, restaurare');
await page.focus('#inc');
await page.evaluate(() => { window.__r = undefined; FFF.dialog.confirm('Ștergi tot?\nA doua linie.').then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog[data-fff-dialog=confirm]');
const st = await page.evaluate(() => {
  const d = document.querySelector('dialog[data-fff-dialog=confirm]');
  const lab = document.getElementById(d.getAttribute('aria-labelledby')), desc = document.getElementById(d.getAttribute('aria-describedby'));
  return {open: d.open, modal: d.matches(':modal'), role: d.getAttribute('role'), am: d.getAttribute('aria-modal'), lab: lab && lab.textContent, desc: desc && desc.textContent, focus: document.activeElement.textContent, btns: [...d.querySelectorAll('button')].map((b) => b.textContent), h2: d.querySelectorAll('h2').length};
});
check('<dialog> modal, role=dialog, aria-modal', st.open && st.modal && st.role === 'dialog' && st.am === 'true', st);
check('aria-labelledby → titlu, aria-describedby → mesaj', st.lab === 'Confirmare' && /Ștergi tot\?/.test(st.desc || ''), st);
check('butoane: Anulează, Da; focus pe acțiunea sigură (Anulează)', st.btns.join() === 'Anulează,Da' && st.focus === 'Anulează', st);
check('capcană de focus: Tab → Da → Tab → Anulează; Shift+Tab → Da', await (async () => {
  await page.keyboard.press('Tab'); const a = await page.evaluate(() => document.activeElement.textContent);
  await page.keyboard.press('Tab'); const b = await page.evaluate(() => document.activeElement.textContent);
  await page.keyboard.press('Shift+Tab'); const c = await page.evaluate(() => document.activeElement.textContent);
  return a === 'Da' && b === 'Anulează' && c === 'Da';
})());
check('focusul nu iese din dialog nici cu mai multe Tab-uri', await (async () => { for (let i = 0; i < 7; i++) await page.keyboard.press('Tab'); return page.evaluate(() => !!document.activeElement.closest('dialog[data-fff-dialog]')); })());
await page.keyboard.press('Escape'); await page.waitForTimeout(120);
check('Esc → false, dialogul scos din DOM', await page.evaluate(() => window.__r === false && !document.querySelector('dialog')));
check('focusul revine pe elementul care a deschis dialogul', await page.evaluate(() => document.activeElement.id === 'inc'));
await page.evaluate(() => { window.__r = undefined; FFF.dialog.confirm('Continui?', {yes: 'Șterge', no: 'Nu', danger: true}).then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog[data-fff-dialog=confirm]');
check('opțiuni yes/no/danger', await page.evaluate(() => { const b = [...document.querySelectorAll('dialog button')]; return b[1].textContent === 'Șterge' && b[0].textContent === 'Nu' && b[1].classList.contains('fff-danger') && b[1].classList.contains('fff-primary'); }));
await page.click('dialog button.fff-primary'); await page.waitForTimeout(100);
check('Da → true', await page.evaluate(() => window.__r === true));
await page.evaluate(() => { window.__r = undefined; FFF.dialog.confirm('Fără titlu', {title: false}).then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog[data-fff-dialog=confirm]');
check('title:false → fără h2, aria-labelledby pe mesaj, fără describedby', await page.evaluate(() => { const d = document.querySelector('dialog'); return !d.querySelector('h2') && document.getElementById(d.getAttribute('aria-labelledby')).textContent === 'Fără titlu' && !d.hasAttribute('aria-describedby'); }));
await page.keyboard.press('Escape'); await page.waitForTimeout(80);

console.log('alert / show / choice');
await page.evaluate(() => { window.__r = 'x'; FFF.dialog.alert('Gata.').then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog[data-fff-dialog=alert]');
check('alert: un buton OK cu focus, titlu „Atenție”', await page.evaluate(() => { const d = document.querySelector('dialog'); return d.querySelectorAll('button').length === 1 && document.activeElement.textContent === 'OK' && d.querySelector('h2').textContent === 'Atenție'; }));
await page.keyboard.press('Enter'); await page.waitForTimeout(100);
check('alert: Enter închide, rezolvă undefined', await page.evaluate(() => window.__r === undefined && !document.querySelector('dialog')));
await page.evaluate(() => { window.__r = 'x'; FFF.dialog.show('Copiază:', 'ABC-123').then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog[data-fff-dialog=show]');
check('show: textarea readonly, text selectat, etichetată', await page.evaluate(() => { const t = document.querySelector('dialog textarea'); return t.readOnly && t.value === 'ABC-123' && t.selectionEnd - t.selectionStart === 7 && !!t.getAttribute('aria-labelledby') && document.activeElement === t; }));
await page.keyboard.press('Escape'); await page.waitForTimeout(100);
await page.evaluate(() => { window.__r = 'x'; FFF.dialog.choice('Alege', [{label: 'A', value: 'a'}, {label: 'B', value: 'b', primary: true}]).then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog[data-fff-dialog=choice]');
await page.click('dialog button:has-text("B")'); await page.waitForTimeout(80);
check('choice: valoarea butonului ales', await page.evaluate(() => window.__r === 'b'));
await page.evaluate(() => { window.__r = 'x'; FFF.dialog.choice('Alege', [{label: 'A', value: 'a'}]).then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog[data-fff-dialog=choice]'); await page.keyboard.press('Escape'); await page.waitForTimeout(80);
check('choice: Esc → null', await page.evaluate(() => window.__r === null));

console.log('prompt');
await page.focus('#note');
await page.evaluate(() => { window.__r = 'x'; FFF.dialog.prompt('Numele filtrului:', 'implicit').then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog[data-fff-dialog=prompt]');
check('prompt: input etichetat de mesaj, valoare implicită selectată, focus', await page.evaluate(() => { const i = document.querySelector('dialog input'); const lab = document.getElementById(i.getAttribute('aria-labelledby')); return i.value === 'implicit' && /Numele filtrului/.test(lab.textContent) && document.activeElement === i && i.selectionEnd - i.selectionStart === 8; }));
await page.keyboard.type('nou'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
check('prompt: Enter trimite valoarea (înlocuiește selecția)', await page.evaluate(() => window.__r === 'nou' && !document.querySelector('dialog')));
check('prompt: focus restaurat pe #note', await page.evaluate(() => document.activeElement.id === 'note'));
await page.evaluate(() => { window.__r = 'x'; FFF.dialog.prompt('Text:', 'a').then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog[data-fff-dialog=prompt]'); await page.keyboard.press('Escape'); await page.waitForTimeout(100);
check('prompt: Esc → null', await page.evaluate(() => window.__r === null));
await page.evaluate(() => { window.__r = 'x'; FFF.dialog.prompt('Cod:', '', {validate: (v) => (/^\d+$/.test(v) ? '' : 'Doar cifre'), required: true}).then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog[data-fff-dialog=prompt]');
await page.keyboard.press('Enter'); await page.waitForTimeout(60);
check('prompt required: câmp gol → eroare (role=alert), aria-invalid, dialogul rămâne', await page.evaluate(() => { const d = document.querySelector('dialog'), i = d.querySelector('input'), e = document.getElementById(i.getAttribute('aria-describedby')); return !!d && i.getAttribute('aria-invalid') === 'true' && e.getAttribute('role') === 'alert' && e.textContent === 'Completează acest câmp.' && window.__r === 'x'; }));
await page.keyboard.type('12a'); await page.keyboard.press('Enter'); await page.waitForTimeout(60);
check('prompt validate: „Doar cifre”', await page.evaluate(() => document.querySelector('dialog .fff-bad').textContent === 'Doar cifre'));
await page.fill('dialog input', '123'); await page.click('dialog button.fff-primary'); await page.waitForTimeout(100);
check('prompt: valoare validă → rezolvă', await page.evaluate(() => window.__r === '123' && !document.querySelector('dialog')));

console.log('dialoguri suprapuse');
await page.evaluate(() => { window.__a = undefined; window.__b = undefined; FFF.dialog.confirm('Primul').then((v) => { window.__a = v; }); FFF.dialog.alert('Al doilea').then((v) => { window.__b = 'ok'; }); });
await page.waitForTimeout(150);
check('două dialoguri deschise; Esc îl închide doar pe cel de sus', await (async () => {
  const n = await page.evaluate(() => document.querySelectorAll('dialog').length);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  const s = await page.evaluate(() => ({n: document.querySelectorAll('dialog').length, a: window.__a, b: window.__b}));
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  const s2 = await page.evaluate(() => ({n: document.querySelectorAll('dialog').length, a: window.__a}));
  return n === 2 && s.n === 1 && s.b === 'ok' && s.a === undefined && s2.n === 0 && s2.a === false;
})());
await page.evaluate(() => { FFF.dialog.confirm('x'); FFF.dialog.confirm('y'); }); await page.waitForTimeout(100);
await page.evaluate(() => FFF.dialog.closeAll()); await page.waitForTimeout(100);
check('closeAll închide tot', await page.evaluate(() => !document.querySelector('dialog') && !FFF.dialog.isOpen()));

console.log('8 limbi');
const langOk = [];
for (const l of LANGS) {
  await page.evaluate((lg) => { document.documentElement.lang = lg; FFF.dialog.confirm('x'); FFF.dialog.toast('t', {type: 'error', timeout: 0}); }, l);
  await page.waitForSelector('dialog[data-fff-dialog=confirm]'); await page.waitForSelector('.fff-toast');
  const got = await page.evaluate(() => ({h: document.querySelector('dialog h2').textContent, b: [...document.querySelectorAll('dialog button')].map((x) => x.textContent), x: document.querySelector('.fff-toast-x') && document.querySelector('.fff-toast-x').getAttribute('aria-label'), sr: document.querySelector('.fff-toast .fff-sr') && document.querySelector('.fff-toast .fff-sr').textContent}));
  const ok = got.h === I18N[l].title_confirm && got.b[0] === I18N[l].cancel && got.b[1] === I18N[l].yes && got.x === I18N[l].dismiss && got.sr === I18N[l].sr_error + ': ';
  langOk.push([l, ok]);
  if (!ok) console.log('   ', l, JSON.stringify(got));
  await page.evaluate(() => FFF.dialog.closeAll());
  await page.waitForTimeout(60);
}
check('titlu, butoane, etichetă toast și prefix SR traduse în toate cele 8 limbi', langOk.every((x) => x[1]), langOk);
await page.evaluate(() => { document.documentElement.lang = 'ro'; });
await page.waitForTimeout(1800);

console.log('toast / notify (aria-live)');
await page.evaluate(() => { FFF.dialog.toast('Salvat', {type: 'success', timeout: 0}); });
await page.waitForSelector('.fff-toast');
const tz = await page.evaluate(() => {
  const t = document.querySelector('.fff-toast'), reg = t.parentElement;
  return {role: reg.getAttribute('role'), live: reg.getAttribute('aria-live'), text: t.textContent, type: t.getAttribute('data-type')};
});
check('toast success → regiune role=status aria-live=polite', tz.role === 'status' && tz.live === 'polite' && /Salvat/.test(tz.text) && tz.type === 'success', tz);
await page.evaluate(() => { FFF.dialog.notify('Eroare de rețea', {type: 'error', timeout: 0}); });
await page.waitForTimeout(120);
const ez = await page.evaluate(() => { const t = document.querySelector('.fff-toast-error'), reg = t.parentElement; return {role: reg.getAttribute('role'), live: reg.getAttribute('aria-live')}; });
check('notify/toast error → regiune role=alert aria-live=assertive', ez.role === 'alert' && ez.live === 'assertive', ez);
check('regiunile aria-live există înainte de text (create gol)', await page.evaluate(() => document.querySelectorAll('.fff-toasts [aria-live]').length === 2));
await page.click('.fff-toast-success .fff-toast-x'); await page.waitForTimeout(80);
check('buton închidere elimină toastul', await page.evaluate(() => !document.querySelector('.fff-toast-success')));
await page.evaluate(() => { window.__act = 0; FFF.dialog.toast('Anulat', {timeout: 0, action: {label: 'Refă', onClick: () => { window.__act++; }}}); });
await page.waitForSelector('.fff-toast-act'); await page.click('.fff-toast-act'); await page.waitForTimeout(80);
check('acțiune în toast: callback + închidere', await page.evaluate(() => window.__act === 1 && !document.querySelector('.fff-toast-info')));
await page.evaluate(() => { document.querySelectorAll('.fff-toast-x').forEach((b) => b.click()); FFF.dialog.toast('Scurt', {timeout: 400}); });
await page.waitForTimeout(250);
check('toast cu timeout rămâne la hover (pauză)', await (async () => { await page.hover('.fff-toast'); await page.waitForTimeout(700); return page.evaluate(() => !!document.querySelector('.fff-toast')); })());
await page.mouse.move(2, 2); await page.waitForTimeout(3300);
check('toast se închide singur după timeout; regiunile dispar (nu rămân în DOM)', await page.evaluate(() => !document.querySelector('.fff-toast') && !document.querySelector('.fff-toasts')));
await page.evaluate(() => { FFF.dialog.toast('x1', {timeout: 0}); FFF.dialog.toast('x2', {timeout: 0}); FFF.dialog.toast('x3', {timeout: 0}); FFF.dialog.toast('x4', {timeout: 0}); FFF.dialog.toast('x5', {timeout: 0}); });
await page.waitForTimeout(250);
check('maximum 4 toasturi simultane', await page.evaluate(() => document.querySelectorAll('.fff-toast').length === 4));
await page.evaluate(() => FFF.dialog.closeAll()); await page.waitForTimeout(100);
await page.evaluate(() => { FFF.dialog.confirm('Modal deschis'); FFF.dialog.toast('Peste modal', {timeout: 0}); });
await page.waitForTimeout(300);
check('toast în stratul superior (popover) chiar și cu un <dialog> modal deschis', await page.evaluate(() => { const w = document.querySelector('.fff-toasts'); return !!w && (typeof w.showPopover !== 'function' || w.matches(':popover-open')); }));
await page.evaluate(() => FFF.dialog.closeAll()); await page.waitForTimeout(1800);

console.log('alias-uri ffAsk / ffShow / ffPrompt');
await page.evaluate(() => { window.__r = 'x'; ffAsk('Alias?', {yes: 'Gata', no: 'Nu'}).then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog');
check('ffAsk: fără titlu (ca înainte), butoane personalizate, boolean', await page.evaluate(() => { const d = document.querySelector('dialog'); return !d.querySelector('h2') && [...d.querySelectorAll('button')].map((b) => b.textContent).join() === 'Nu,Gata'; }));
await page.click('dialog button.fff-primary'); await page.waitForTimeout(80);
check('ffAsk → true', await page.evaluate(() => window.__r === true));
await page.evaluate(() => { window.__r = 'x'; ffPrompt('Nume:', 'Ana').then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog'); await page.keyboard.press('Enter'); await page.waitForTimeout(80);
check('ffPrompt(msg, def) → valoarea', await page.evaluate(() => window.__r === 'Ana'));
await page.evaluate(() => { window.__r = 'x'; ffShow('Cod', 'ZZZ').then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog textarea'); await page.keyboard.press('Escape'); await page.waitForTimeout(80);
check('ffShow(msg, text) → undefined', await page.evaluate(() => window.__r === undefined));

console.log('stratul FFF.bundle.confirm');
await page.evaluate(() => { window.__r = 'x'; FFF.bundle.confirm('Importi?', {yes: 'Importă'}).then((v) => { window.__r = v; }); });
await page.waitForSelector('dialog[data-fff-dialog=confirm]');
check('bundle.confirm folosește FFF.dialog (aceeași structură, fără titlu)', await page.evaluate(() => { const d = document.querySelector('dialog'); return d.classList.contains('fff-dlg-sm') && !d.querySelector('h2') && d.getAttribute('role') === 'dialog'; }));
await page.click('dialog button.fff-primary'); await page.waitForTimeout(80);
check('bundle.confirm → true', await page.evaluate(() => window.__r === true));
await page.evaluate(() => { localStorage.setItem('demo-fff.api_token', 'sec'); window.__e = FFF.bundle.export({}).then((r) => r, (e) => ({err: e.code})); });
await page.waitForSelector('dialog[data-fff-dialog=choice]', {timeout: 3000}).catch(() => null);
check('export cu date sensibile: dialogul cu mai multe opțiuni trece prin FFF.dialog.choice', await page.evaluate(() => { const d = document.querySelector('dialog[data-fff-dialog=choice]'); return !!d && d.querySelectorAll('button').length === 3; }));
await page.click('dialog button:has-text("Anulează")'); await page.waitForTimeout(150);
check('export anulat → {cancelled:true}', await page.evaluate(async () => (await window.__e).cancelled === true));

console.log('tema prin variabile CSS + axe');
await page.addStyleTag({content: ':root{--fff-bg:#101820;--fff-fg:#f2f2f2;--fff-accent:#ffb000;--fff-accent-fg:#101820;--fff-line:#556;--fff-btn:#26323f;--fff-bad:#ffb4ab}'});
await page.evaluate(() => { FFF.dialog.confirm('Tematic?'); });
await page.waitForSelector('dialog[data-fff-dialog=confirm]');
const th = await page.evaluate(() => { const d = document.querySelector('dialog'); const cs = getComputedStyle(d), p = getComputedStyle(d.querySelector('.fff-primary')); return {bg: cs.backgroundColor, fg: cs.color, pri: p.backgroundColor}; });
check('culorile aplicației (variabile --fff-*) sunt preluate', th.bg === 'rgb(16, 24, 32)' && th.fg === 'rgb(242, 242, 242)' && th.pri === 'rgb(255, 176, 0)', th);
let v = await axe(page, 'dialog');
check('axe: 0 violări (confirm, temă personalizată, 1366 px)', v.length === 0, v);
await page.evaluate(() => FFF.dialog.closeAll());
for (const [name, fn] of [['alert', () => { FFF.dialog.alert('Mesaj de test.'); }], ['prompt', () => { FFF.dialog.prompt('Nume:', 'x', {validate: () => 'eroare'}); }], ['show', () => { FFF.dialog.show('Cod', 'abc'); }], ['choice', () => { FFF.dialog.choice('Alege', [{label: 'A', value: 1}, {label: 'B', value: 2}]); }]]) {
  await page.evaluate(fn); await page.waitForSelector('dialog');
  if (name === 'prompt') { await page.click('dialog button.fff-primary'); }
  v = await axe(page, 'dialog');
  check(`axe: 0 violări (${name}, 1366 px)`, v.length === 0, v);
  await page.evaluate(() => FFF.dialog.closeAll()); await page.waitForTimeout(60);
}
await page.evaluate(() => { FFF.dialog.toast('Informare', {timeout: 0}); FFF.dialog.toast('Eroare', {type: 'error', timeout: 0, action: {label: 'Reîncearcă', onClick() {}}}); });
await page.waitForSelector('.fff-toast-error');
await page.waitForTimeout(700);
v = await axe(page, '.fff-toasts');
check('axe: 0 violări (toast-uri)', v.length === 0, v);
await page.evaluate(() => FFF.dialog.closeAll());

console.log('360 px');
await page.setViewportSize({width: 360, height: 740});
await page.evaluate(() => { FFF.dialog.prompt('Un mesaj destul de lung ca să treacă pe mai multe rânduri la 360 px, cu un cuvânt-foarte-lung-fără-spații-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'valoare'); });
await page.waitForSelector('dialog');
const g = await page.evaluate(() => { const d = document.querySelector('dialog'), r = d.getBoundingClientRect(); return {l: r.left, r: r.right, w: innerWidth, over: d.scrollWidth - d.clientWidth, page: document.documentElement.scrollWidth - innerWidth}; });
check('dialog încape în 360 px (fără depășire orizontală)', g.l >= 0 && g.r <= g.w && g.over <= 0 && g.page <= 0, g);
v = await axe(page, 'dialog');
check('axe: 0 violări (prompt, 360 px)', v.length === 0, v);
await page.evaluate(() => FFF.dialog.closeAll());
await page.evaluate(() => { FFF.dialog.toast('Un toast cu text lung care trebuie să se încadreze în 360 px lățime fără depășire', {type: 'warning', timeout: 0}); });
await page.waitForSelector('.fff-toast');
const tg = await page.evaluate(() => { const r = document.querySelector('.fff-toast').getBoundingClientRect(); return {l: r.left, r: r.right, w: innerWidth}; });
check('toast încape în 360 px', tg.l >= 0 && tg.r <= tg.w, tg);
await page.evaluate(() => FFF.dialog.closeAll());
check('fără erori de pagină/CSP și fără cereri de rețea', errors.length === 0 && net.length === 0, {errors, net});

console.log('pointer:coarse — ținte ≥ 44 px');
{
  const ctx = await browser.newContext({viewport: {width: 360, height: 740}, hasTouch: true, isMobile: true});
  const p = await ctx.newPage();
  await p.goto(app.url); await p.waitForTimeout(300);
  await p.evaluate(() => { FFF.dialog.prompt('Nume:', 'x'); });
  await p.waitForSelector('dialog');
  const sizes = await p.evaluate(() => [...document.querySelectorAll('dialog button, dialog input')].map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, Math.round(r.height), Math.round(r.width)]; }));
  check('butoane și câmp ≥ 44 px înălțime pe pointer:coarse', matchesCoarse(sizes) && sizes.every(([, h]) => h >= 44), sizes);
  await p.evaluate(() => FFF.dialog.closeAll());
  await p.evaluate(() => { FFF.dialog.toast('t', {timeout: 0, action: {label: 'Act', onClick() {}}}); });
  await p.waitForSelector('.fff-toast');
  const ts = await p.evaluate(() => [...document.querySelectorAll('.fff-toast button')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.height), Math.round(r.width)]; }));
  check('butoanele din toast ≥ 44×44 pe pointer:coarse', ts.length === 2 && ts.every(([h, w]) => h >= 44 && w >= 44), ts);
  await ctx.close();
}
function matchesCoarse(s) { return s.length >= 3; }

console.log('alias-uri ale aplicației nu sunt suprascrise + fără modulul dialog');
{
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { window.ffAsk = function () { return 'app-ffask'; }; });
  const p = await ctx.newPage();
  await p.goto(app.url); await p.waitForTimeout(250);
  check('ffAsk definit de aplicație rămâne neatins; ffShow/ffPrompt completate de kit', await p.evaluate(() => window.ffAsk() === 'app-ffask' && typeof window.ffShow === 'function' && typeof window.ffPrompt === 'function'));
  await ctx.close();
  const app2 = makeApp(FIXTURE, {modules: 'core,label,bundle'});
  const q = await newPage(browser);
  await q.page.goto(app2.url); await q.page.waitForTimeout(300);
  check('fără modulul dialog: FFF.dialog și ffAsk nu există', await q.page.evaluate(() => !FFF.dialog && !window.ffAsk));
  await q.page.evaluate(() => { window.__r = 'x'; FFF.bundle.confirm('Vechi?').then((v) => { window.__r = v; }); });
  await q.page.waitForSelector('dialog.fff-dlg-sm');
  check('fără dialog: bundle.confirm folosește implementarea proprie (compatibilitate)', await q.page.evaluate(() => !document.querySelector('dialog').hasAttribute('data-fff-dialog')));
  await q.page.click('dialog button.fff-primary'); await q.page.waitForTimeout(80);
  check('… și rezolvă true', await q.page.evaluate(() => window.__r === true));
  await q.ctx.close();
}

await browser.close();
summary('dialog');
