// Teste de interfață pentru aplicațiile alpha single-file HTML (Playwright, rețea blocată, fără așteptări pe timp real).
// Rulare: node tests/alpha-apps.test.mjs [filtru-nume] [--root DIR]
// Depozitele aplicațiilor: --root DIR, FFF_ROOT sau directorul părinte al hub-ului; o aplicație lipsă se omite cu mesaj, nu eșuează.
// Cerințe: playwright + Chromium (CHROMIUM_PATH), axe-core (FFF_AXE sau pachetul din /opt/node-tools).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {launch, newPage, axe, chromium} from '../fff-kit/test/_pw.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ri = args.indexOf('--root');
const rootArg = ri >= 0 ? args.splice(ri, 2)[1] : null;
const ROOT = path.resolve(rootArg || process.env.FFF_ROOT || path.join(HUB, '..'));
const only = args[0];
const LANGS = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
const RAW_KEY = /\b(?:nav|lbl|err|rule|reg|cal|lim|th|ro|easter|h|r|g|hint|c|ev|lang)_[a-z0-9_-]{2,}\b/;   // chei de traducere rămase în text
const BAD_TEXT = /\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b|\[object /;

const results = [];
const skipped = new Set();
async function T(name, fn) {
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).join('\n       ')); }
}
const ok = (c, m) => { if (!c) throw new Error(typeof m === 'string' ? m : JSON.stringify(m)); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || 'diferă') + ': așteptat ' + JSON.stringify(b) + ', primit ' + JSON.stringify(a)); };

const appFile = (name) => path.join(ROOT, name, 'index.html');
const present = (name) => fs.existsSync(appFile(name));
let browser;
async function open(name, o = {}) {
  const h = await newPage(browser, o);
  if (o.clock) await h.page.clock.install();
  if (o.state !== undefined) await h.ctx.addInitScript((v) => { try { localStorage.setItem(v[0], v[1]); } catch (e) { /* ignorat */ } }, [o.stateKey, o.state]);
  await h.page.goto('file://' + appFile(name));
  return h;
}
const noErr = (h, what) => { ok(h.errors.length === 0, (what || 'erori') + ': ' + h.errors.join(' | ')); ok(h.net.length === 0, 'cereri de rețea: ' + h.net.join(', ')); };
/** Așteaptă ca animațiile și tranzițiile finite pornite de pagină (apariția cardurilor, 0,6 s) să se termine: axe măsoară contrastul pe culorile de moment, nu pe cele finale. */
const settle = (p) => p.evaluate(() => Promise.race([
  Promise.all(document.getAnimations().filter((a) => { try { return !!a.effect && isFinite(a.effect.getComputedTiming().endTime); } catch (e) { return false; } }).map((a) => a.finished.catch(() => null))),   // doar cele finite: unele pagini au și animații fără sfârșit
  new Promise((r) => setTimeout(r, 4000))]).then(() => null));

/** Verificări comune oricărei aplicații alpha: opt limbi, fără chei netraduse/NaN, axe în ambele teme, fără depășire pe mobil. */
async function baseline(name, {ready, stateKey, rawKey}) {
  await T(name + ': se încarcă în toate limbile, fără erori CSP, rețea sau chei netraduse', async () => {
    const h = await open(name);
    await h.page.waitForSelector(ready);
    for (const l of LANGS) {
      await h.page.selectOption('#langsel', l);
      await h.page.waitForSelector(ready);
      const info = await h.page.evaluate(() => ({lang: document.documentElement.lang, text: document.querySelector('#content').innerText, h2: document.querySelector('#app h2') ? document.querySelector('#app h2').textContent : ''}));
      eq(info.lang, l, 'atribut lang');
      ok(info.h2.length > 3, l + ': titlul aplicației lipsește');
      const raw = info.text.match(RAW_KEY) || (rawKey ? info.text.match(rawKey) : null);
      ok(!raw, l + ': cheie netradusă «' + (raw && raw[0]) + '»');
      // meniul și butonul principal vin din window.APP.t(limbă, 'nav' | 'open' | 'title'): o cheie lipsă ar apărea ca numele ei gol («nav», «open»)
      const links = await h.page.evaluate(() => [...document.querySelectorAll('a, button')].map((a) => a.textContent.trim()).filter((x) => /^(nav|open|title)$/.test(x)));
      ok(!links.length, l + ': cheie netradusă în meniu/buton «' + links.join(', ') + '»');
      const bad = info.text.match(BAD_TEXT);
      ok(!bad, l + ': text invalid «' + (bad && bad[0]) + '»');
    }
    noErr(h);
    await h.ctx.close();
  });
  await T(name + ': stare salvată coruptă sau ostilă nu strică pagina', async () => {
    const hostile = ['not json', 'null', '[]', '{"jd":1e999}', '{"jd":"x","cal":"gregorian"}', '{"jd":2460000.5,"cal":"__proto__","other":"constructor"}', '{"jd":1e30,"cal":"hebrew"}', '{"__proto__":{"polluted":1}}', '"<img src=x onerror=alert(1)>"'];
    for (const v of hostile) {
      const h = await open(name, {stateKey, state: v});
      await h.page.waitForSelector(ready);
      const text = await h.page.evaluate(() => document.querySelector('#content').innerText);
      ok(!BAD_TEXT.test(text), 'stare «' + v + '»: ' + (text.match(BAD_TEXT) || [''])[0]);
      ok(await h.page.evaluate(() => ({}).polluted === undefined), 'poluare de prototip');
      noErr(h, 'stare «' + v + '»');
      await h.ctx.close();
    }
  });
  await T(name + ': accesibilitate (axe) în temele luminoasă și întunecată', async () => {
    for (const scheme of ['light', 'dark']) {
      const h = await open(name, {scheme});
      await h.page.waitForSelector(ready);
      for (const l of (scheme === 'light' ? LANGS : ['ro', 'en'])) {
        await h.page.selectOption('#langsel', l);
        await h.page.waitForSelector(ready);
        await settle(h.page);
        const v = await axe(h.page);
        ok(v.length === 0, scheme + '/' + l + ': ' + JSON.stringify(v));
      }
      noErr(h);
      await h.ctx.close();
    }
  });
  await T(name + ': pe mobil (360 px) nu apare defilare orizontală a paginii', async () => {
    const h = await open(name, {w: 360, h: 740});
    await h.page.waitForSelector(ready);
    for (const l of ['ro', 'de', 'hu']) {
      await h.page.selectOption('#langsel', l);
      await h.page.waitForSelector(ready);
      const w = await h.page.evaluate(() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth}));
      ok(w.sw <= w.iw + 1, l + ': scrollWidth ' + w.sw + ' > ' + w.iw);
    }
    await h.ctx.close();
  });
}

/* ================= CALENDARIUM ================= */
const CAL_IDX = {gregorian: 0, julian: 1, 'revised-julian': 2, hebrew: 3, hijri: 4, persian: 5, coptic: 6, ethiopian: 7, chinese: 8, maya: 9, mars: 10};
async function calSet(page, cal, v) {
  await page.selectOption('#cal-sel', cal);
  for (const f of ['year', 'month', 'day', 'leap', 'baktun', 'katun', 'tun', 'uinal', 'kin', 'msd']) {
    if (!(f in v)) continue;
    const sel = '#cal-f-' + f;
    if (f === 'month') await page.selectOption(sel, String(v[f]));
    else if (f === 'leap') await page.setChecked(sel, !!v[f]);
    else await page.fill(sel, String(v[f]));
  }
}
const calRows = (page) => page.$$eval('#cal-res tbody tr:not(.cal-grp)', (trs) => trs.map((tr) => tr.querySelector('.cal-val').textContent.trim()));
const calChips = (page) => page.$$eval('#cal-chips li', (l) => l.map((x) => x.textContent));

if (present('calendarium')) {
  const ready = '#appmount .cal-form';
  browser = await launch();
  await baseline('calendarium', {ready, stateKey: 'calendarium.state'});

  await T('calendarium: convertește date cunoscute în toate calendarele (valori verificate independent)', async () => {
    const h = await open('calendarium', {locale: 'en-GB'});
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    const known = [
      [{year: 2024, month: 10, day: 3}, {julian: '20 September 2024', hebrew: '1 Tishrei 5785 AM', persian: '12 Mehr 1403 AP', coptic: '23 Thout 1741 AM', ethiopian: '23 Meskerem 2017 E.C.', maya: "13.0.11.17.4 · 5 K'an · 7 Yax"}],
      [{year: 2026, month: 2, day: 17}, {chinese: '2026 丙午 Bǐngwǔ (Horse) · month 1, day 1'}],
      [{year: 2025, month: 3, day: 21}, {persian: '1 Farvardin 1404 AP'}],
      [{year: 2012, month: 12, day: 21}, {maya: "13.0.0.0.0 · 4 Ajaw · 3 K'ank'in", persian: '1 Dey 1391 AP'}],
      [{year: 2024, month: 9, day: 11}, {coptic: '1 Thout 1741 AM', ethiopian: '1 Meskerem 2017 E.C.'}],
      [{year: 2025, month: 1, day: 1}, {coptic: '23 Koiak 1741 AM', ethiopian: '23 Tahsas 2017 E.C.', hebrew: '1 Tevet 5785 AM'}]
    ];
    for (const [g, want] of known) {
      await calSet(h.page, 'gregorian', g);
      const rows = await calRows(h.page);
      for (const id of Object.keys(want)) eq(rows[CAL_IDX[id]], want[id], g.year + '-' + g.month + '-' + g.day + ' ' + id);
    }
    await calSet(h.page, 'gregorian', {year: 2024, month: 10, day: 3});
    const chips = (await calChips(h.page)).join(' | ');
    ok(chips.includes('2460586.5') && chips.includes('2460587') && chips.includes('Thursday') && chips.includes('2024-W40') && chips.includes('277') && chips.includes('19999'), chips);
    // sens invers: ebraic → gregorian, chinezesc (cu lună bisectă) → gregorian, copt → gregorian
    await calSet(h.page, 'hebrew', {year: 5785, month: 7, day: 1});
    eq((await calRows(h.page))[0], '3 October 2024', 'ebraic → gregorian');
    await calSet(h.page, 'chinese', {year: 2025, month: 6, day: 1, leap: true});
    eq((await calRows(h.page))[0], '25 July 2025', 'chinezesc, luna 6 bisectă 2025');
    await calSet(h.page, 'chinese', {year: 2025, month: 6, day: 1, leap: false});
    eq((await calRows(h.page))[0], '25 June 2025', 'chinezesc, luna 6 obișnuită 2025');
    await calSet(h.page, 'coptic', {year: 1741, month: 1, day: 1});
    eq((await calRows(h.page))[0], '11 September 2024', 'copt → gregorian');
    noErr(h);
    await h.ctx.close();
  });

  await T('calendarium: ordinea datei și numele lunilor urmează limba aleasă', async () => {
    const h = await open('calendarium');
    await h.page.waitForSelector(ready);
    await calSet(h.page, 'gregorian', {year: 2024, month: 10, day: 3});
    const want = {en: '3 October 2024', ro: '3 octombrie 2024', fr: '3 octobre 2024', it: '3 ottobre 2024', es: '3 de octubre de 2024', pt: '3 de outubro de 2024', de: '3. Oktober 2024', hu: '2024. október 3.'};
    for (const l of LANGS) {
      await h.page.selectOption('#langsel', l);
      await h.page.waitForSelector(ready);
      eq((await calRows(h.page))[0], want[l], l);
    }
    await calSet(h.page, 'gregorian', {year: -43, month: 3, day: 15});   // Idele lui martie, 44 î.Hr. (an astronomic −43)
    await h.page.selectOption('#langsel', 'ro');
    ok((await calRows(h.page))[0].includes('î.Hr.'), 'an dinaintea erei noastre: ' + (await calRows(h.page))[0]);
    noErr(h);
    await h.ctx.close();
  });

  await T('calendarium: respinge date inexistente și intrări ostile fără a se strica', async () => {
    const h = await open('calendarium');
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    // se pornește de la o dată validă și se schimbă un singur câmp: rezultatele trebuie să rămână cele ale datei valide
    const bad = async (base, field, value, label) => {
      await calSet(h.page, 'gregorian', base);
      const before = await calRows(h.page);
      ok(!(await h.page.getAttribute('#cal-msg', 'class')).includes('cal-bad'), label + ': data de pornire trebuie să fie validă');
      await calSet(h.page, 'gregorian', {[field]: value});
      const cls = await h.page.getAttribute('#cal-msg', 'class');
      ok(cls.includes('cal-bad') && (await h.page.textContent('#cal-msg')).length > 5, label + ': fără mesaj de eroare');
      eq(JSON.stringify(await calRows(h.page)), JSON.stringify(before), label + ': rezultatele s-au schimbat');
      const text = await h.page.evaluate(() => document.querySelector('#content').innerText);
      ok(!BAD_TEXT.test(text), label + ': ' + (text.match(BAD_TEXT) || [''])[0]);
    };
    await bad({year: 2026, month: 2, day: 17}, 'day', 30, '30 februarie');
    await bad({year: 2024, month: 2, day: 29}, 'year', 2023, '29 februarie 2023');
    await bad({year: 2026, month: 3, day: 31}, 'month', 4, '31 aprilie');
    await bad({year: 1900, month: 2, day: 28}, 'day', 29, '29 februarie 1900 (gregorian)');
    await calSet(h.page, 'gregorian', {year: 2026, month: 11, day: 17});
    const before = await calRows(h.page);
    for (const [y, label] of [['', 'an gol'], ['1e999', 'infinit'], ['99999999999999999999999', 'an uriaș'], ['-99999999999999', 'an uriaș negativ'], ['2026.5', 'an fracționar']]) {
      await h.page.fill('#cal-f-year', y);
      const cls = await h.page.getAttribute('#cal-msg', 'class');
      ok(cls.includes('cal-bad'), label + ': fără mesaj');
      eq(JSON.stringify(await calRows(h.page)), JSON.stringify(before), label + ': rezultatele s-au schimbat');
    }
    await h.page.fill('#cal-f-year', '2026');
    ok(!(await h.page.getAttribute('#cal-msg', 'class')).includes('cal-bad'), 'mesajul de eroare rămâne după revenirea la o dată validă');
    // calendare cu interval limitat
    await calSet(h.page, 'persian', {year: 5000, month: 1, day: 1});
    ok((await h.page.getAttribute('#cal-msg', 'class')).includes('cal-bad'), 'persan 5000');
    await calSet(h.page, 'hebrew', {year: 0, month: 7, day: 1});
    ok((await h.page.getAttribute('#cal-msg', 'class')).includes('cal-bad'), 'ebraic anul 0');
    await calSet(h.page, 'hijri', {year: 1446, month: 12, day: 30});
    ok((await h.page.getAttribute('#cal-msg', 'class')).includes('cal-bad'), 'hijri: 30 Dhu al-Hijjah 1446 (an obișnuit)');
    await calSet(h.page, 'hebrew', {year: 5785, month: 7, day: 1});   // revenire validă
    ok(!(await h.page.getAttribute('#cal-msg', 'class')).includes('cal-bad'), 'revenire validă');
    noErr(h);
    await h.ctx.close();
  });

  await T('calendarium: în afara intervalelor acoperite apar liniuțe cu explicație, nu NaN, iar panourile se adaptează', async () => {
    const h = await open('calendarium');
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    await calSet(h.page, 'gregorian', {year: 500, month: 6, day: 1});
    let rows = await calRows(h.page);
    ok(rows[CAL_IDX.persian].startsWith('—') && rows[CAL_IDX.persian].includes('outside the covered range'), 'persan 500: ' + rows[CAL_IDX.persian]);
    ok(rows[CAL_IDX.hijri].startsWith('—'), 'hijri 500: ' + rows[CAL_IDX.hijri]);
    ok(rows[CAL_IDX.hebrew].includes('AM') && rows[CAL_IDX.chinese].includes('month'), 'ebraic și chinezesc în interval');
    const ro500 = await h.page.textContent('#cal-robox');
    ok(!ro500.includes('Easter in 500') && ro500.includes('Creation'), 'panoul românesc: fără Paște înainte de 1583 și cu nota despre era bizantină');
    await calSet(h.page, 'gregorian', {year: 3500, month: 6, day: 1});
    rows = await calRows(h.page);
    ok(rows[CAL_IDX.chinese].startsWith('—') && rows[CAL_IDX.persian].startsWith('—'), 'chinezesc și persan 3500');
    ok((await h.page.textContent('#cal-termsbox')).includes('outside the covered range'), 'termeni solari 3500');
    eq(await h.page.textContent('#cal-terms-h'), 'Chinese solar terms 3500', 'titlul cardului se actualizează');
    await calSet(h.page, 'gregorian', {year: 1850, month: 6, day: 1});
    ok((await h.page.textContent('#cal-robox')).includes('Easter in 1850') && (await h.page.textContent('#cal-robox')).includes('Old Style'), 'panoul românesc 1850');
    // calendarul ales nu acoperă data curentă: câmpuri goale + mesaj
    await calSet(h.page, 'gregorian', {year: 500, month: 6, day: 1});
    await h.page.selectOption('#cal-sel', 'persian');
    eq(await h.page.inputValue('#cal-f-year'), '', 'câmp gol pentru calendar neacoperit');
    ok((await h.page.getAttribute('#cal-msg', 'class')).includes('cal-bad'), 'mesaj pentru calendar neacoperit');
    const text = await h.page.evaluate(() => document.querySelector('#content').innerText);
    ok(!BAD_TEXT.test(text), (text.match(BAD_TEXT) || [''])[0]);
    noErr(h);
    await h.ctx.close();
  });

  await T('calendarium: vederea lunară (navigare, selectarea unei zile, calendar secundar, lună bisectă chinezească)', async () => {
    const h = await open('calendarium');
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    await calSet(h.page, 'gregorian', {year: 2026, month: 11, day: 17});
    eq(await h.page.textContent('#cal-gtitle'), 'November 2026');
    eq(await h.page.locator('.cal-cell').count(), 30);
    eq(await h.page.textContent('.cal-cell[aria-current="date"] span'), '17', 'ziua selectată');
    eq(await h.page.textContent('.cal-cell >> nth=0 >> small'), '19', '1 noiembrie gregorian = 19 octombrie iulian');
    eq(await h.page.textContent('.cal-cell >> nth=13 >> small'), '1 Nov', '14 noiembrie gregorian = 1 noiembrie iulian');
    await h.page.click('[data-act="prev"]');
    eq(await h.page.textContent('#cal-gtitle'), 'October 2026');
    eq(await h.page.locator('.cal-cell').count(), 31);
    await h.page.click('[data-act="next"]');
    await h.page.click('[data-act="next"]');
    eq(await h.page.textContent('#cal-gtitle'), 'December 2026');
    await h.page.click('.cal-cell >> nth=4');   // 5 decembrie
    eq(await h.page.inputValue('#cal-f-day'), '5');
    eq(await h.page.inputValue('#cal-f-month'), '12');
    eq((await calRows(h.page))[0], '5 December 2026');
    // calendar secundar: chinezesc (lună/zi)
    await h.page.selectOption('#cal-other', 'chinese');
    await h.page.click('[data-act="prev"]');
    await h.page.click('.cal-cell >> nth=16');   // 17 noiembrie
    eq(await h.page.textContent('.cal-cell[aria-current="date"] small'), '10/9', 'chinezesc 10/9');
    // ebraic: titlul lunii și opțiunile calendarului secundar
    await calSet(h.page, 'hebrew', {year: 5787, month: 9, day: 7});
    eq(await h.page.textContent('#cal-gtitle'), 'Kislev 5787 AM');
    ok(!(await h.page.locator('#cal-other option[value="hebrew"]').count()), 'calendarul afișat nu apare ca secundar');
    // luna bisectă chineză păstrată la navigare
    await calSet(h.page, 'chinese', {year: 2025, month: 6, day: 1, leap: true});
    ok((await h.page.textContent('#cal-gtitle')).includes('leap'), 'titlu lună bisectă: ' + await h.page.textContent('#cal-gtitle'));
    await h.page.click('[data-act="next"]');
    ok(!(await h.page.textContent('#cal-gtitle')).includes('leap'), 'luna următoare nu e bisectă');
    // maya și Marte nu au vedere lunară: se revine la gregorian
    await calSet(h.page, 'maya', {baktun: 13, katun: 0, tun: 0, uinal: 0, kin: 0});
    eq(await h.page.textContent('#cal-gtitle'), 'December 2012');
    noErr(h);
    await h.ctx.close();
  });

  await T('calendarium: lipirea unei numărători lungi maya, butonul Azi și copierea', async () => {
    const h = await open('calendarium');
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    await h.page.selectOption('#cal-sel', 'maya');
    await h.page.evaluate(() => {
      const dt = new DataTransfer(); dt.setData('text/plain', '13.0.0.0.0');
      document.querySelector('#cal-f-baktun').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
    });
    eq((await calRows(h.page))[0], '21 December 2012', 'lipire 13.0.0.0.0');
    eq(await h.page.inputValue('#cal-f-katun'), '0');
    // Marte: MSD de la 00:00 UT
    await calSet(h.page, 'gregorian', {year: 2024, month: 10, day: 3});
    ok((await calRows(h.page))[CAL_IDX.mars].startsWith('MSD 53591.209'), 'MSD: ' + (await calRows(h.page))[CAL_IDX.mars]);
    // Azi
    await h.page.selectOption('#cal-sel', 'gregorian');
    await h.page.click('#cal-today');
    const t = await h.page.evaluate(() => { const d = new Date(); return [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-'); });
    eq([await h.page.inputValue('#cal-f-year'), await h.page.inputValue('#cal-f-month'), await h.page.inputValue('#cal-f-day')].join('-'), t, 'Azi');
    // copiere
    await h.page.click('.cal-copy >> nth=0');
    await h.page.waitForFunction(() => /Copied/.test(document.querySelector('.cal-copy').textContent), null, {timeout: 3000});
    noErr(h);
    await h.ctx.close();
  });

  await T('calendarium: starea (data și calendarul) se păstrează între încărcări', async () => {
    const h = await open('calendarium');
    await h.page.waitForSelector(ready);
    await calSet(h.page, 'hebrew', {year: 5785, month: 7, day: 1});
    await h.page.reload();
    await h.page.waitForSelector(ready);
    eq(await h.page.inputValue('#cal-sel'), 'hebrew');
    eq(await h.page.inputValue('#cal-f-year'), '5785');
    await h.ctx.close();
  });

  await browser.close();
} else {
  console.log('omis: calendarium (nu există ' + path.relative(HUB, appFile('calendarium')) + ')');
  skipped.add('calendarium');
}

/* ================= REGULA ================= */
const RG = {
  st: (lv, id) => JSON.stringify({id: id || 'nine-mens-morris', lv, idxs: []}),
  pt: (page, name) => page.click('#rg-ov .rg-pt[aria-label^="' + name + ':"]'),
  rec: (page) => page.$$eval('#rg-rec li', (l) => l.map((x) => x.textContent.trim())),
  status: (page) => page.textContent('#rg-status'),
  counts: (page) => page.textContent('#rg-counts')
};
const RG_CHAIN = {id: 'chain-test', name: 'Chain test', region: 'test', players: 2, board: {type: 'grid', w: 5, h: 1}, pieces: [{id: 'man', count: 2}], setup: 'a1 white; b1 and d1 black', moves: ['jump'], win: 'capture all', sources: ['https://example.org/'],
  rules: {sides: ['white', 'black'], first: 'white', mandatoryCapture: true, setup: {rows: ['wb.b.'], legend: {w: 'white:man', b: 'black:man'}}, moves: [{type: 'jump', dirs: 'all', chain: 'forced'}, {type: 'step'}], win: [{type: 'eliminate', below: 1}, {type: 'blocked'}]}};
const RG_AW = {id: 'aw-test', name: 'Approach or withdrawal', region: 'test', players: 2, board: {type: 'grid', w: 5, h: 1}, pieces: [{id: 'man', count: 2}], setup: 'b1 black, c1 white, e1 black', moves: ['approach-withdraw'], win: 'capture all', sources: ['https://example.org/'],
  rules: {sides: ['white', 'black'], first: 'white', mandatoryCapture: true, setup: {rows: ['.bw.b'], legend: {w: 'white:man', b: 'black:man'}}, moves: [{type: 'step'}, {type: 'approach-withdraw', dirs: 'all', chain: 'none'}], win: [{type: 'eliminate', below: 1}, {type: 'blocked'}]}};

if (present('regula')) {
  const ready = '#appmount .rg-bar';
  browser = await launch();
  await baseline('regula', {ready, stateKey: 'regula.state'});

  await T('regula: starea salvată ostilă (id de prototip, niveluri și mutări invalide) nu strică pagina', async () => {
    for (const v of ['{"id":"__proto__","lv":[9,"x"],"idxs":"zz"}', '{"id":"constructor"}', '{"id":"nine-mens-morris","lv":[-1,-1],"idxs":[999,-3,1.5]}', '{"id":"custom"}', '{"id":"hnefatafl","idxs":[0,0,0,0,0,0,0,0,0,0,0,0]}']) {
      const h = await open('regula', {stateKey: 'regula.state', state: v});
      await h.page.waitForSelector(ready);
      eq(await h.page.evaluate(() => ({}).polluted === undefined), true);
      ok((await RG.status(h.page)).length > 3 || (await h.page.textContent('#rg-none')).length > 3, 'stare «' + v + '»');
      noErr(h, 'stare «' + v + '»');
      await h.ctx.close();
    }
  });

  await T('regula: Moara între doi oameni — moară, scoatere obligatorie a unei piese libere, contoare și notație', async () => {
    const h = await open('regula', {stateKey: 'regula.state', state: RG.st([-1, -1])});
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    ok(/To move: White\. Place a piece/.test(await RG.status(h.page)), await RG.status(h.page));
    for (const p of ['a1', 'b2', 'd1', 'f2', 'g1']) await RG.pt(h.page, p);
    ok(/Remove an enemy piece/.test(await RG.status(h.page)), await RG.status(h.page));
    const rm = await h.page.$$eval('#rg-ov .rg-pt', (b) => b.filter((x) => /can be removed/.test(x.getAttribute('aria-label'))).map((x) => x.getAttribute('aria-label').split(':')[0]));
    eq(rm.sort().join(','), 'b2,f2');
    await RG.pt(h.page, 'a1');                                   // piesă proprie: nu face nimic
    ok(/Remove an enemy piece/.test(await RG.status(h.page)));
    await RG.pt(h.page, 'b2');
    eq((await RG.rec(h.page)).join(' | '), '1. +a1 | 2. +b2 | 3. +d1 | 4. +f2 | 5. +g1 ×b2');
    ok(/White: 3 on board · 6 in hand/.test(await RG.counts(h.page)) && /Black: 1 on board · 7 in hand/.test(await RG.counts(h.page)), await RG.counts(h.page));
    ok(/To move: Black/.test(await RG.status(h.page)));
    noErr(h);
    await h.ctx.close();
  });

  await T('regula: împotriva calculatorului — răspunde cu o mutare legală; anulare și refacere întorc rândul omului', async () => {
    const h = await open('regula', {stateKey: 'regula.state', state: RG.st([-1, 1]), clock: true});
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    await RG.pt(h.page, 'a1');
    ok(/thinking/.test(await RG.status(h.page)), await RG.status(h.page));
    await h.page.clock.runFor(1500);
    const rec = await RG.rec(h.page);
    eq(rec.length, 2, rec.join(' | '));
    ok(/^2\. \+[a-g]\d$/.test(rec[1]), rec[1]);
    ok(/To move: White/.test(await RG.status(h.page)), await RG.status(h.page));
    await h.page.click('#rg-undo');
    await h.page.clock.runFor(1500);
    ok(/White: 0 on board · 9 in hand/.test(await RG.counts(h.page)) && /Black: 0 on board · 9 in hand/.test(await RG.counts(h.page)), await RG.counts(h.page));
    eq(await h.page.$$eval('#rg-rec li.rg-fut', (l) => l.length), 2, 'mutările anulate rămân estompate pentru refacere');
    ok(await h.page.isDisabled('#rg-undo'));
    await h.page.click('#rg-redo');
    await h.page.clock.runFor(1500);
    eq(await h.page.$$eval('#rg-rec li.rg-fut', (l) => l.length), 0);
    eq((await RG.rec(h.page)).length, 2);
    ok(/To move: White/.test(await RG.status(h.page)), await RG.status(h.page));
    noErr(h);
    await h.ctx.close();
  });

  await T('regula: sugestia luminează o mutare fără s-o execute; „Joc nou” golește partida', async () => {
    const h = await open('regula', {stateKey: 'regula.state', state: RG.st([-1, -1]), clock: true});
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    await h.page.click('#rg-hint');
    await h.page.clock.runFor(200);
    ok(/^Suggestion: \+[a-g]\d$/.test(await h.page.textContent('#rg-msg')), await h.page.textContent('#rg-msg'));
    ok(await h.page.$$eval('#rg-ov .rg-pt', (b) => b.some((x) => /suggested/.test(x.getAttribute('aria-label')))));
    eq((await RG.rec(h.page)).join('|'), 'No moves yet.');
    await RG.pt(h.page, 'a1');
    eq(await h.page.textContent('#rg-msg'), '', 'mesajul se șterge după mutare');
    await h.page.click('#rg-new');
    eq((await RG.rec(h.page)).join('|'), 'No moves yet.');
    noErr(h);
    await h.ctx.close();
  });

  await T('regula: lanț de sărituri forțat — doar continuarea este permisă, apoi victoria', async () => {
    const h = await open('regula', {stateKey: 'regula.state', state: RG.st([-1, -1])});
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    await h.page.fill('#rg-json', JSON.stringify(RG_CHAIN));
    await h.page.click('#rg-play');
    await h.page.waitForSelector('#rg-ov .rg-pt >> nth=4');
    eq(await h.page.inputValue('#rg-game'), 'custom');
    await RG.pt(h.page, 'a1');
    await RG.pt(h.page, 'c1');
    ok(/must keep capturing/.test(await RG.status(h.page)), await RG.status(h.page));
    const dest = await h.page.$$eval('#rg-ov .rg-pt', (b) => b.filter((x) => /possible destination/.test(x.getAttribute('aria-label'))).map((x) => x.getAttribute('aria-label').split(':')[0]));
    eq(dest.join(','), 'e1');
    ok(await h.page.isHidden('#rg-stop'), 'captura forțată nu are buton Stop');
    await RG.pt(h.page, 'e1');
    ok(/Winner: White — the opponent has too few pieces left\./.test(await RG.status(h.page)), await RG.status(h.page));
    eq((await RG.rec(h.page)).join(' | '), '1. a1xc1 c1xe1');
    noErr(h);
    await h.ctx.close();
  });

  await T('regula: când apropierea și retragerea duc în același punct, apare alegerea; câștigă cine blochează', async () => {
    const h = await open('regula', {stateKey: 'regula.state', state: RG.st([-1, -1])});
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    await h.page.fill('#rg-json', JSON.stringify(RG_AW));
    await h.page.click('#rg-play');
    await h.page.waitForSelector('#rg-ov .rg-pt >> nth=4');
    await RG.pt(h.page, 'c1');
    await RG.pt(h.page, 'd1');
    const labels = await h.page.$$eval('#rg-choice .rg-ch', (b) => b.map((x) => x.textContent));
    eq(labels.join(' | '), 'Approach — captures 1 | Withdrawal — captures 1');
    await h.page.click('#rg-choice .rg-ch >> nth=1');
    eq((await RG.rec(h.page)).join(' | '), '1. c1-d1~1');
    ok(/Winner: White — the opponent cannot move\./.test(await RG.status(h.page)), await RG.status(h.page));
    ok(await h.page.isHidden('#rg-choice'));
    noErr(h);
    await h.ctx.close();
  });

  await T('regula: tastatura — săgețile mută focalizarea pe punctul vecin, Enter acționează, Escape renunță la selecție', async () => {
    const h = await open('regula', {stateKey: 'regula.state', state: RG.st([-1, -1], 'alquerque')});
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    const at = () => h.page.evaluate(() => document.activeElement.getAttribute('aria-label').split(':')[0]);
    await h.page.focus('#rg-ov .rg-pt[tabindex="0"]');
    eq(await at(), 'a1');
    await h.page.keyboard.press('ArrowRight'); eq(await at(), 'b1');
    await h.page.keyboard.press('ArrowUp'); eq(await at(), 'b2');
    await h.page.keyboard.press('ArrowUp'); await h.page.keyboard.press('ArrowRight'); eq(await at(), 'c3');
    await h.page.keyboard.press('ArrowLeft'); await h.page.keyboard.press('ArrowLeft'); await h.page.keyboard.press('ArrowLeft'); eq(await at(), 'a3', 'nu iese de pe tablă');
    await h.page.focus('#rg-ov .rg-pt[aria-label^="d3:"]');
    await h.page.keyboard.press('Enter');
    ok(/Choose a destination/.test(await RG.status(h.page)), await RG.status(h.page));
    eq(await at(), 'd3', 'focalizarea rămâne pe punct după redesenare');
    await h.page.keyboard.press('Escape');
    ok(/Select a piece/.test(await RG.status(h.page)), await RG.status(h.page));
    await h.page.keyboard.press('Enter');
    await h.page.keyboard.press('ArrowLeft'); await h.page.keyboard.press('Enter');
    eq((await RG.rec(h.page)).join(' | '), '1. d3-c3');
    noErr(h);
    await h.ctx.close();
  });

  await T('regula: jocul propriu — erori clare la JSON greșit, validare, apoi joc; descrierile fără reguli nu se pot juca', async () => {
    const h = await open('regula');
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    await h.page.fill('#rg-json', '{oops');
    await h.page.click('#rg-validate');
    ok(/not valid JSON/.test(await h.page.textContent('#rg-cmsg')), await h.page.textContent('#rg-cmsg'));
    const bad = JSON.parse(JSON.stringify(RG_AW)); bad.rules.moves[1].dirs = 'sideways'; bad.rules.setup.rows = ['.bw.'];
    await h.page.fill('#rg-json', JSON.stringify(bad));
    await h.page.click('#rg-validate');
    const msg = await h.page.textContent('#rg-cmsg');
    ok(/unknown direction/.test(msg) && /5 characters expected/.test(msg), msg);
    ok(await h.page.$eval('#rg-cmsg', (e) => e.classList.contains('rg-bad')));
    await h.page.fill('#rg-json', JSON.stringify({id: 'desc-only', name: 'Only text', region: 'x', players: 2, board: {type: 'grid'}, pieces: [{id: 'a', count: 1}], setup: 's', moves: ['m'], win: 'w', sources: ['https://example.org']}));
    await h.page.click('#rg-validate');
    ok(/no executable rules/.test(await h.page.textContent('#rg-cmsg')), await h.page.textContent('#rg-cmsg'));
    await h.page.fill('#rg-json', JSON.stringify(RG_AW));
    await h.page.click('#rg-validate');
    ok(/Valid: 5 points, 2 move rules\./.test(await h.page.textContent('#rg-cmsg')), await h.page.textContent('#rg-cmsg'));
    await h.page.click('#rg-play');
    ok(await h.page.isVisible('#rg-box'));
    ok(/Approach or withdrawal/.test(await h.page.textContent('#rg-rulesbox')));
    // jocul propriu supraviețuiește reîncărcării
    await h.page.reload();
    await h.page.waitForSelector(ready);
    eq(await h.page.inputValue('#rg-game'), 'custom');
    eq(await h.page.$$eval('#rg-ov .rg-pt', (b) => b.length), 5);
    // „Încarcă jocul curent” pune JSON-ul în câmp
    await h.page.selectOption('#rg-game', 'fanorona');
    await h.page.click('#rg-load');
    eq(JSON.parse(await h.page.inputValue('#rg-json')).id, 'fanorona');
    noErr(h);
    await h.ctx.close();
  });

  await T('regula: regulile generate apar în toate limbile pentru toate jocurile, fără chei netraduse și fără NaN', async () => {
    const h = await open('regula');
    await h.page.waitForSelector(ready);
    for (const l of LANGS) {
      await h.page.selectOption('#langsel', l);
      await h.page.waitForSelector(ready);
      for (const g of ['nine-mens-morris', 'alquerque', 'fanorona', 'mu-torere', 'hnefatafl']) {
        await h.page.selectOption('#rg-game', g);
        const t = await h.page.evaluate(() => ({r: document.querySelector('#rg-rulesbox').innerText, n: document.querySelectorAll('#rg-rulesbox .rg-rules li').length, a: document.querySelector('#rg-ov').getAttribute('aria-label'), s: document.querySelector('#rg-status').textContent}));
        ok(t.n >= 6, l + '/' + g + ': ' + t.n + ' reguli');
        for (const x of [t.r, t.a, t.s]) { ok(!/\br_[a-z_]+\b|\bn_[a-z]+\b|\bd_[a-z]+\b|\bc_[a-z]{2}\b|\bundefined\b|\bNaN\b/.test(x), l + '/' + g + ': ' + x.slice(0, 160)); }
      }
    }
    await h.page.selectOption('#langsel', 'ro');
    await h.page.selectOption('#rg-game', 'hnefatafl');
    const ro = await h.page.textContent('#rg-rulesbox');
    ok(/Captură prin încadrare/.test(ro) && /Atacatori/.test(ro) && /colțuri/.test(ro), ro.slice(0, 300));
    await h.page.selectOption('#rg-game', 'fanorona');
    ok(/Apropiere sau retragere/.test(await h.page.textContent('#rg-rulesbox')));
    noErr(h);
    await h.ctx.close();
  });

  await T('regula: partida și jucătorii se păstrează la reîncărcare și la schimbarea limbii; linkurile surselor sunt doar http(s)', async () => {
    const h = await open('regula');
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    await h.page.selectOption('#rg-lv1', '-1');
    await RG.pt(h.page, 'a1'); await RG.pt(h.page, 'd1');
    await h.page.reload();
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    eq((await RG.rec(h.page)).join(' | '), '1. +a1 | 2. +d1');
    await h.page.selectOption('#langsel', 'ro');
    await h.page.waitForSelector(ready);
    eq((await RG.rec(h.page)).join(' | '), '1. +a1 | 2. +d1', 'după schimbarea limbii');
    ok(/La mutare: Alb/.test(await RG.status(h.page)), await RG.status(h.page));
    const hrefs = await h.page.$$eval('#rg-rulesbox a', (a) => a.map((x) => x.getAttribute('href')));
    ok(hrefs.length >= 1 && hrefs.every((x) => /^https:\/\//.test(x)), hrefs.join(' '));
    await h.page.selectOption('#rg-lv1', '1');
    await h.page.reload();
    await h.page.waitForSelector(ready);
    eq(await h.page.inputValue('#rg-lv1'), '1');
    eq(await h.page.inputValue('#rg-lv0'), '-1');
    await h.ctx.close();
  });

  await T('regula: calculatorul joacă singur până la sfârșit (aleator contra aleator) și partida este legală de la un capăt la altul', async () => {
    const h = await open('regula', {stateKey: 'regula.state', state: RG.st([0, 0], 'mu-torere'), clock: true});
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    await h.page.clock.runFor(300);
    let end = false;
    for (let i = 0; i < 400 && !end; i++) {
      await h.page.clock.runFor(300);
      end = /Winner|Draw/.test(await RG.status(h.page));
    }
    ok(end, await RG.status(h.page));
    const rec = await RG.rec(h.page);
    ok(rec.length >= 4, rec.length + ' ture');
    ok(rec.every((x) => /^\d+\. (k\d|p)-(k\d|p)$/.test(x)), rec.slice(0, 5).join(' | '));
    ok(await h.page.isDisabled('#rg-hint'));
    noErr(h);
    await h.ctx.close();
  });

  await T('regula: tabla mare (Hnefatafl) pe mobil rămâne în interiorul paginii și poate fi parcursă', async () => {
    const h = await open('regula', {w: 360, h: 740, stateKey: 'regula.state', state: RG.st([-1, -1], 'hnefatafl')});
    await h.page.waitForSelector(ready);
    const w = await h.page.evaluate(() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth, pts: document.querySelectorAll('#rg-ov .rg-pt').length}));
    ok(w.sw <= w.iw + 1, w.sw + ' > ' + w.iw);
    eq(w.pts, 121);
    await h.ctx.close();
  });

  await browser.close();
} else {
  console.log('omis: regula (nu există ' + path.relative(HUB, appFile('regula')) + ')');
  skipped.add('regula');
}

/* ================= BALANTA ================= */
if (present('balanta')) {
  const ready = '#appmount .ba-root';
  const KEY = 'balanta.state';
  const RAW = /\b(?:tab|btn|issue|col|rp|s|a|v|p|d|e|l|line|copy|lim|err|c|r|h)_[a-z0-9_-]{2,}\b/;
  const E = await import('file://' + path.join(ROOT, 'balanta', 'src', 'engine.mjs'));
  const FIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'balanta', 'test', 'fixture-votes.json'), 'utf8'));
  const PROMPT_FILES = fs.readdirSync(path.join(ROOT, 'balanta', 'data', 'prompts')).filter((f) => f.endsWith('.json') && f !== 'example.json');
  browser = await launch();

  /** Stare salvată: n prompturi proprii (custom-1…n, fără prompturi incluse), răspunsuri „Q<j> …” pentru fiecare model, voturi opționale. */
  const bst = (o = {}) => {
    const models = o.models || ['alfa', 'beta', 'gama'];
    const n = o.prompts === undefined ? 3 : o.prompts;
    const custom = [], answers = {};
    for (let i = 1; i <= n; i++) {
      const id = 'custom-' + i;
      custom.push({id, lang: 'ro', category: 'grammar', prompt: 'Care este forma corectă din propoziția de test numărul ' + i + '?', difficulty: 'easy', notes: '', sources: []});
      answers[id] = {};
      models.forEach((m, j) => { answers[id][m] = o.answer ? o.answer(m, j, i) : 'Q' + (j + 1) + ' răspuns la ' + i; });
    }
    return JSON.stringify(Object.assign({v: 1, models, seed: 'balanta', langs: {ro: true}, cats: {}, count: 10, reveal: false, custom, answers, votes: o.votes || []}, o.over || {}));
  };
  /** Voturi pentru toate perechile de pe custom-1…n; modelul cu indice mai mare câștigă (a/b după ordinea din pereche). */
  const bvotes = (models, n) => {
    const out = [];
    for (let i = 1; i <= n; i++) for (let x = 0; x < models.length; x++) for (let y = x + 1; y < models.length; y++) out.push({v: 1, prompt: 'custom-' + i, a: models[x], b: models[y], winner: 'b', t: '2026-11-17T10:' + String(out.length % 60).padStart(2, '0') + ':00Z'});
    return out;
  };
  const tab = async (page, id) => { await page.click('#ba-t-' + id); await page.waitForSelector('#ba-p-' + id + ' .ba-box'); };
  const rows = (page, idx = 0) => page.$$eval('.ba-table', (ts, i) => Array.from(ts[i].querySelectorAll('tbody tr')).map((tr) => Array.from(tr.children).map((c) => c.textContent)), idx);
  const live = (page) => page.textContent('#ba-live');
  const dl = async (page, click) => {
    const [d] = await Promise.all([page.waitForEvent('download'), page.click(click)]);
    return {name: d.suggestedFilename(), text: fs.readFileSync(await d.path(), 'utf8')};
  };
  const file = (name, text) => ({name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8')});

  await baseline('balanta', {ready, stateKey: KEY, rawKey: RAW});

  await T('balanta: toate filele, în toate limbile, fără chei netraduse și fără text invalid', async () => {
    const votes = bvotes(['alfa', 'beta', 'gama'], 3).slice(0, 5);
    const h = await open('balanta', {stateKey: KEY, state: bst({votes})});
    await h.page.waitForSelector(ready);
    for (const l of LANGS) {
      await h.page.selectOption('#langsel', l);
      await h.page.waitForSelector(ready);
      for (const t of ['setup', 'answers', 'vote', 'results', 'prompts']) {
        await tab(h.page, t);
        const text = await h.page.evaluate(() => document.querySelector('#content').innerText);
        ok(!RAW.test(text) && !RAW_KEY.test(text), l + '/' + t + ': cheie netradusă «' + (text.match(RAW) || text.match(RAW_KEY) || [''])[0] + '»');
        ok(!BAD_TEXT.test(text), l + '/' + t + ': text invalid «' + (text.match(BAD_TEXT) || [''])[0] + '»');
        ok(text.length > 300, l + '/' + t + ': pagină aproape goală');
      }
    }
    noErr(h);
    await h.ctx.close();
  });

  await T('balanta: fluxul complet (pregătire → răspunsuri → vot orb → rezultate) dă clasamentul așteptat și supraviețuiește reîncărcării', async () => {
    const h = await open('balanta');
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'ro');
    await h.page.fill('#ba-models', 'alfa\nbeta\ngama');
    await h.page.fill('#ba-count', '3');
    for (const l of ['en', 'hu']) await h.page.setChecked('#ba-cb-l-' + l, false);
    for (const c of ['culture', 'reasoning', 'translation']) await h.page.setChecked('#ba-cb-c-' + c, false);
    await h.page.click('#ba-apply');
    eq(await live(h.page), 'Salvat: 3 modele și 3 prompturi în sesiune.');
    await tab(h.page, 'answers');
    const ids = await h.page.$$eval('#ba-pick option', (o) => o.map((x) => x.textContent.split('. ')[1].split(' · ')[0]));
    eq(ids.length, 3);
    ok(ids.every((x) => /^ro-grammar-\d{4}$/.test(x)), ids.join());
    for (let i = 0; i < 3; i++) {
      await h.page.selectOption('#ba-pick', String(i));
      for (let m = 0; m < 3; m++) await h.page.fill('#ba-ans-' + m, 'Răspuns ' + '★'.repeat(m + 1) + ' la ' + ids[i]);
      ok(/3 din 3/.test(await h.page.textContent('#ba-count-l')), await h.page.textContent('#ba-count-l'));
    }
    await tab(h.page, 'vote');
    let n = 0;
    for (let guard = 0; guard < 20 && await h.page.$('#ba-w-a'); guard++) {
      const a = (await h.page.textContent('#ba-v-a')).split('★').length, b = (await h.page.textContent('#ba-v-b')).split('★').length;
      await h.page.click(a > b ? '#ba-w-a' : '#ba-w-b');
      n++;
    }
    eq(n, 9, 'perechi votate');
    ok(/Ai votat toate perechile disponibile \(9 voturi\)/.test(await h.page.textContent('#ba-vh')), await h.page.textContent('#ba-vh'));
    await h.page.reload();
    await h.page.waitForSelector(ready);
    await tab(h.page, 'results');
    const r = await rows(h.page);
    eq(r.map((x) => x[1]).join(','), 'gama,beta,alfa');
    eq(r.map((x) => x[5]).join(','), '100%,50%,0%');
    eq(r.map((x) => x[6]).join(','), '6,6,6');
    ok(/Voturi: 9; numărate în clasament: 9/.test(await h.page.textContent('#ba-rsum')), await h.page.textContent('#ba-rsum'));
    ok(await h.page.$('#ba-rfew'), 'avertisment: sub 30 de voturi');
    ok(await h.page.$('#ba-rpos'), 'poziția A/B');
    noErr(h);
    await h.ctx.close();
  });

  await T('balanta: ordinea și pozițiile A/B depind doar de sămânță (stabile la reîncărcare, diferite între semințe)', async () => {
    const h = await open('balanta', {stateKey: KEY, state: bst({prompts: 6, answer: (m, j) => 'Q' + (j + 1)})});
    await h.page.waitForSelector(ready);
    const seq = async () => {
      await tab(h.page, 'vote');
      return h.page.evaluate(() => {
        const out = [];
        for (let i = 0; i < 6; i++) {
          out.push(document.querySelector('#ba-prompt-text').textContent + '|' + document.querySelector('#ba-v-a').textContent + document.querySelector('#ba-v-b').textContent);
          document.querySelector('#ba-skip').click();
        }
        return out.join('\n');
      });
    };
    const seen = new Set();
    for (const seed of ['s1', 's2', 's3', 's4']) {
      await tab(h.page, 'setup');
      await h.page.fill('#ba-seed', seed);
      await h.page.click('#ba-apply');
      const a = await seq();
      await tab(h.page, 'setup');
      await h.page.click('#ba-apply');
      eq(await seq(), a, 'aceeași sămânță, aceeași ordine (' + seed + ')');
      seen.add(a);
    }
    ok(seen.size >= 3, 'semințe diferite, ordini diferite: ' + seen.size);
    noErr(h);
    await h.ctx.close();
  });

  await T('balanta: anonimizarea ascunde numele modelelor din sesiune și pe cele cunoscute, dar răspunsul original rămâne neatins', async () => {
    const original = {alfa: 'Sunt alfa, creat de Anthropic; vezi Claude și GPT-4. Alfa-ul meu e bun.', beta: 'Eu sunt beta. ChatGPT e altceva; Gemini, Google și «Beta» la fel.'};
    const h = await open('balanta', {stateKey: KEY, state: bst({models: ['alfa', 'beta'], prompts: 1, answer: (m) => original[m]})});
    await h.page.waitForSelector(ready);
    await tab(h.page, 'vote');
    const t = (await h.page.textContent('#ba-v-a')) + '\n' + (await h.page.textContent('#ba-v-b'));
    ok(!/alfa|beta|claude|anthropic|chatgpt|gpt|gemini|google/i.test(t), t);
    ok(/\[model\]/.test(t), t);
    const m = (await h.page.textContent('#ba-hidden')).match(/\((\d+) înlocuiri\)/);
    ok(m && +m[1] >= 9, await h.page.textContent('#ba-hidden'));
    await tab(h.page, 'answers');
    eq(await h.page.inputValue('#ba-ans-0'), original.alfa);
    eq(await h.page.inputValue('#ba-ans-1'), original.beta);
    const ex = await dl(h.page, '#ba-aexp');
    eq(ex.name, 'answers.jsonl');
    const lines = ex.text.trim().split('\n').map((x) => JSON.parse(x));
    eq(lines.length, 2);
    eq(lines[0].answer, original.alfa);
    noErr(h);
    await h.ctx.close();
  });

  await T('balanta: tastele 1–4 și S, «Sari peste» și «Anulează» funcționează; cifrele tastate în câmpuri nu votează', async () => {
    const h = await open('balanta', {stateKey: KEY, state: bst({models: ['alfa', 'beta'], prompts: 4})});
    await h.page.waitForSelector(ready);
    await tab(h.page, 'answers');
    await h.page.click('#ba-ans-0');
    await h.page.keyboard.type('1234sS');
    await tab(h.page, 'vote');
    ok(/1 din 4 \(4 rămase\)/.test(await h.page.textContent('#ba-vh')), await h.page.textContent('#ba-vh'));
    ok(!(await h.page.$('#ba-undo')), 'fără anulare înainte de primul vot');
    const first = await h.page.textContent('#ba-prompt-text');
    await h.page.keyboard.press('s');
    const second = await h.page.textContent('#ba-prompt-text');
    ok(first !== second, 'sărirea peste trece la alt prompt');
    eq(await live(h.page), '', 'sărirea nu e vot');
    await h.page.keyboard.press('1');
    ok(/Total: 1\./.test(await live(h.page)), await live(h.page));
    await h.page.keyboard.press('2'); await h.page.keyboard.press('3'); await h.page.keyboard.press('4');
    ok(/Vot înregistrat\. Total: 4\./.test(await live(h.page)), await live(h.page));
    ok(/Ai votat toate/.test(await h.page.textContent('#ba-vh')), 'toate perechile votate');
    await tab(h.page, 'results');
    eq((await rows(h.page)).reduce((s, x) => s + +x[7], 0), 2, 'un vot «ambele slabe» se numără la ambele modele');
    await tab(h.page, 'vote');
    await h.page.click('#ba-undo');
    ok(/Vot anulat\. Total: 3\./.test(await live(h.page)), await live(h.page));
    ok(/\(1 rămase\)/.test(await h.page.textContent('#ba-vh')));
    ok(!(await h.page.$('#ba-undo')), 'un singur pas de anulare');
    await tab(h.page, 'results');
    eq((await rows(h.page)).reduce((s, x) => s + +x[7], 0), 0, 'votul «ambele slabe» a fost anulat');
    await h.ctx.close();
  });

  await T('balanta: opțiunea «arată modelele după vot» le dezvăluie doar când e bifată și se păstrează la reîncărcare', async () => {
    const h = await open('balanta');
    await h.page.waitForSelector(ready);
    await h.page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, bst({models: ['alfa', 'beta'], prompts: 2})]);
    await h.page.reload();
    await h.page.waitForSelector(ready);
    await tab(h.page, 'vote');
    await h.page.click('#ba-w-a');
    ok(!/alfa|beta/.test(await live(h.page)), await live(h.page));
    await tab(h.page, 'setup');
    await h.page.setChecked('#ba-reveal', true);
    await h.page.click('#ba-apply');
    await tab(h.page, 'vote');
    await h.page.click('#ba-w-a');
    ok(/A era «(alfa|beta)», B era «(alfa|beta)»\./.test(await live(h.page)), await live(h.page));
    await h.page.reload();
    await h.page.waitForSelector(ready);
    await tab(h.page, 'setup');
    ok(await h.page.isChecked('#ba-reveal'), 'opțiunea se păstrează');
    await h.ctx.close();
  });

  await T('balanta: importul de voturi ignoră duplicatele, raportează rândurile greșite cu număr și refuză fișierele prea mari', async () => {
    const h = await open('balanta', {stateKey: KEY, state: bst({models: ['alfa', 'beta', 'gama'], prompts: 3})});
    await h.page.waitForSelector(ready);
    await tab(h.page, 'results');
    ok(await h.page.$('#ba-rnone'));
    const v = (p, a, b, w) => JSON.stringify({v: 1, prompt: p, a, b, winner: w});
    const text = ['# voturi de probă', v('custom-1', 'alfa', 'beta', 'a'), v('custom-1', 'alfa', 'gama', 'tie'), v('custom-2', 'beta', 'gama', 'b'), v('custom-2', 'beta', 'gama', 'b'), 'nu e json', v('custom-3', 'alfa', 'beta', 'x'), '', v('custom-3', 'alfa', 'alfa', 'a')].join('\n');
    await h.page.setInputFiles('#ba-vfile', file('votes.jsonl', text));
    await h.page.waitForSelector('#ba-rsum');
    const msg = await live(h.page);
    ok(/Import voturi: 3 adăugate, 1 duplicate ignorate, 3 rânduri greșite\./.test(msg), msg);
    ok(/Rândul 6: nu este JSON valid/.test(msg) && /Rândul 7: câștigător invalid/.test(msg) && /Rândul 9: A și B sunt același model/.test(msg), msg);
    ok(/Voturi: 3; numărate în clasament: 3/.test(await h.page.textContent('#ba-rsum')));
    await h.page.setInputFiles('#ba-vfile', file('votes.jsonl', text));
    await h.page.waitForFunction(() => /0 adăugate, 4 duplicate/.test(document.querySelector('#ba-live').textContent));
    await h.page.setInputFiles('#ba-vfile', {name: 'mare.jsonl', mimeType: 'text/plain', buffer: Buffer.alloc(5000001, 0x20)});
    await h.page.waitForFunction(() => /prea mare/.test(document.querySelector('#ba-live').textContent));
    ok(/Voturi: 3;/.test(await h.page.textContent('#ba-rsum')), 'fișierul mare nu schimbă voturile');
    noErr(h);
    await h.ctx.close();
  });

  await T('balanta: importul de răspunsuri adaugă doar modele și prompturi cunoscute și raportează restul', async () => {
    const h = await open('balanta', {stateKey: KEY, state: bst({models: ['alfa', 'beta'], prompts: 2, answer: () => ''})});
    await h.page.waitForSelector(ready);
    await tab(h.page, 'answers');
    const a = (prompt, model, answer) => JSON.stringify({prompt, model, answer});
    const text = [a('custom-1', 'alfa', 'Primul răspuns'), a('custom-1', 'beta', 'Al doilea'), a('custom-9', 'alfa', 'prompt necunoscut'), a('custom-2', 'zeta', 'model necunoscut'), '{rupt', a('custom-2', 'alfa', 'x'.repeat(20001)), a('custom-2', 'beta', '   ')].join('\n');
    await h.page.setInputFiles('#ba-afile', file('answers.jsonl', text));
    await h.page.waitForFunction(() => /Import terminat/.test(document.querySelector('#ba-live').textContent));
    const msg = await live(h.page);
    ok(/Import terminat: 2 răspunsuri adăugate, 5 sărite/.test(msg), msg);
    ok(/Rândul 5: nu este JSON valid/.test(msg) && /Rândul 6: răspuns peste 20000 de caractere/.test(msg) && /Rândul 7: răspuns lipsă sau gol/.test(msg), msg);
    eq(await h.page.inputValue('#ba-ans-0'), 'Primul răspuns');
    eq(await h.page.inputValue('#ba-ans-1'), 'Al doilea');
    noErr(h);
    await h.ctx.close();
  });

  await T('balanta: votes.jsonl exportat are formatul documentat și poate fi reimportat fără pierderi', async () => {
    const models = ['alfa', 'beta', 'gama'], votes = bvotes(models, 3);
    const h = await open('balanta', {stateKey: KEY, state: bst({votes})});
    await h.page.waitForSelector(ready);
    await tab(h.page, 'results');
    const ex = await dl(h.page, '#ba-dlvotes');
    eq(ex.name, 'votes.jsonl');
    const lines = ex.text.trim().split('\n').map((x) => JSON.parse(x));
    eq(lines.length, 9);
    ok(lines.every((o) => o.v === 1 && /^custom-\d$/.test(o.prompt) && models.includes(o.a) && models.includes(o.b) && o.a !== o.b && ['a', 'b', 'tie', 'bad'].includes(o.winner) && /^\d{4}-\d{2}-\d{2}T/.test(o.t)), ex.text.slice(0, 300));
    ok(ex.text.endsWith('\n'));
    const h2 = await open('balanta');
    await h2.page.waitForSelector(ready);
    await tab(h2.page, 'results');
    await h2.page.setInputFiles('#ba-vfile', file('votes.jsonl', ex.text));
    await h2.page.waitForFunction(() => /9 adăugate, 0 duplicate/.test(document.querySelector('#ba-live').textContent));
    await h.ctx.close(); await h2.ctx.close();
  });

  await T('balanta: pagina de rezultate descărcată e statică, scapă textul și se deschide fără erori', async () => {
    const models = ['<b>x</b>', 'beta'];
    const h = await open('balanta', {stateKey: KEY, state: bst({models, votes: bvotes(models, 3)})});
    await h.page.waitForSelector(ready);
    await tab(h.page, 'results');
    const ex = await dl(h.page, '#ba-dlpage');
    eq(ex.name, 'balanta-results.html');
    ok(/^<!DOCTYPE html>/.test(ex.text) && !/<script/i.test(ex.text) && /default-src 'none'/.test(ex.text), ex.text.slice(0, 200));
    ok(ex.text.includes('&lt;b&gt;x&lt;/b&gt;') && !ex.text.includes('<b>x</b>'), 'numele modelului scăpat');
    const tmp = path.join(fs.mkdtempSync(path.join(process.env.FFF_TMP || '/tmp', 'bal-')), 'r.html');
    fs.writeFileSync(tmp, ex.text);
    const h2 = await newPage(browser, {});
    await h2.page.goto('file://' + tmp);
    eq(await h2.page.locator('tbody tr').count(), 2);
    eq(await h2.page.locator('script').count(), 0);
    eq(await h2.page.locator('b').count(), 0);
    ok(h2.errors.length === 0 && h2.net.length === 0, h2.errors.join('|'));
    const v = await axe(h2.page);
    ok(v.length === 0, JSON.stringify(v));
    await h.ctx.close(); await h2.ctx.close();
  });

  await T('balanta: tabelul din interfață coincide cu motorul (Bradley–Terry, Elo, intervale, procente, poziție) și filtrele funcționează', async () => {
    const models = ['alfa', 'beta', 'gama', 'delta', 'epsilon'];
    const h = await open('balanta', {stateKey: KEY, state: bst({models, prompts: 0, over: {langs: {ro: true}, cats: {}, custom: [], answers: {}, votes: FIX}})});
    await h.page.waitForSelector(ready);
    await tab(h.page, 'results');
    const sum = E.summarize(FIX, {rounds: 200, seed: 1});
    const rd = (x) => x === null ? '–' : String(Math.round(x));
    const want = sum.rows.map((r) => [String(r.rank), r.name, rd(r.bt), r.lo === null ? '–' : rd(r.lo) + '–' + rd(r.hi), rd(r.elo), r.winRate === null ? '–' : Math.round(r.winRate * 100) + '%', String(r.games), String(r.bad)]);
    eq(JSON.stringify(await rows(h.page)), JSON.stringify(want));
    const pos = (await h.page.textContent('#ba-rpos')).match(/(\d+)%/);
    eq(+pos[1], Math.round(sum.position.aShare * 100));
    ok(!(await h.page.$('#ba-rfew')), 'peste 30 de voturi: fără avertisment');
    const h2h = await rows(h.page, 1);
    eq(h2h.length, 5);
    await h.page.selectOption('#ba-fcat', 'grammar');
    eq(JSON.stringify(await rows(h.page)), JSON.stringify(want), 'filtrul «grammar» păstrează toate voturile');
    await h.page.selectOption('#ba-flang', 'en');
    ok(await h.page.$('#ba-rnone'), 'niciun vot în engleză');
    await h.page.selectOption('#ba-flang', 'all');
    await h.page.click('#ba-copymd');
    noErr(h);
    await h.ctx.close();
  });

  await T('balanta: verificarea prompturilor proprii blochează datele personale, cere note și surse la «cultură» și exportă JSON valid', async () => {
    const h = await open('balanta');
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'ro');
    await tab(h.page, 'prompts');
    const out = () => h.page.textContent('#ba-pout');
    const bad = async (text, re) => {
      await h.page.fill('#ba-pt', text);
      await h.page.click('#ba-padd');
      ok(re.test(await out()), re + ' ← ' + await out());
      ok(await h.page.locator('#ba-pout .ba-bad').count() >= 1, 'marcaj de eroare');
      ok(!(await h.page.$('.ba-custom')), 'nu se adaugă: ' + text);
    };
    await bad('Contactează-mă la test@example.com pentru detalii despre problema aceasta.', /De corectat: Conține o adresă de e-mail/);
    await bad('Sună la 0712 345 678 ca să afli răspunsul la această întrebare grea.', /De corectat: Conține un număr de telefon/);
    await bad('CNP-ul meu este 1800101221144 și vreau o verificare a acestuia, te rog.', /De corectat: Conține ceva ce seamănă cu un CNP/);
    await bad('Contul RO49AAAA1B31007593840000 este al firmei pentru plățile lunare.', /De corectat: Conține ceva ce seamănă cu un IBAN/);
    await bad('Prea scurt', /Prea scurt/);
    await h.page.fill('#ba-pt', 'Scrie o propozitie despre istoria Romaniei fara sa folosesti nici un cuvant strain acestei limbi.');
    await h.page.click('#ba-pcheck');
    ok(/Avertisment: Textul românesc pare scris fără diacritice/.test(await out()), await out());
    await h.page.selectOption('#ba-pc', 'culture');
    await h.page.click('#ba-padd');
    ok(/notele de referință/.test(await out()) && /o sursă https/.test(await out()), await out());
    await h.page.fill('#ba-ps', 'http://exemplu.ro/pagina');
    await h.page.click('#ba-padd');
    ok(/Sursă invalidă \(trebuie să înceapă cu https:\/\/\): http:\/\/exemplu\.ro\/pagina/.test(await out()), await out());
    await h.page.fill('#ba-pn', 'România este o țară din Europa de Sud-Est.');
    await h.page.fill('#ba-ps', 'https://ro.wikipedia.org/wiki/Rom%C3%A2nia');
    await h.page.fill('#ba-pt', 'Ce este România și unde se află ea pe harta Europei? Răspunde pe scurt.');
    await h.page.click('#ba-padd');
    eq(await live(h.page), 'Promptul custom-1 a fost adăugat.');
    await h.page.fill('#ba-pt', 'Scrie un singur cuvânt, fără nicio explicație, care rimează cu «mare» în română.');
    await h.page.selectOption('#ba-pc', 'grammar');
    await h.page.click('#ba-padd');
    eq(await h.page.locator('.ba-custom li').count(), 2);
    ok(/custom-1 → ro-culture-0021/.test(await h.page.textContent('.ba-custom')) && /custom-2 → ro-grammar-0031/.test(await h.page.textContent('.ba-custom')), await h.page.textContent('.ba-custom'));
    const j1 = await dl(h.page, '#ba-cd-0');
    eq(j1.name, 'ro-culture-0021.json');
    const o1 = JSON.parse(j1.text);
    eq(JSON.stringify(Object.keys(o1)), JSON.stringify(['id', 'lang', 'category', 'prompt', 'difficulty', 'reference_notes', 'sources']));
    eq(o1.sources[0], 'https://ro.wikipedia.org/wiki/Rom%C3%A2nia');
    const o2 = JSON.parse((await dl(h.page, '#ba-cd-1')).text);
    eq(JSON.stringify(Object.keys(o2)), JSON.stringify(['id', 'lang', 'category', 'prompt', 'difficulty']), 'fără câmpuri goale');
    await tab(h.page, 'setup');
    ok(/Prompturi proprii adăugate mereu: 2\./.test(await h.page.textContent('#ba-pool')), await h.page.textContent('#ba-pool'));
    await tab(h.page, 'prompts');
    await h.page.click('#ba-cr-0');
    eq(await h.page.locator('.ba-custom li').count(), 1);
    await h.page.reload();
    await h.page.waitForSelector(ready);
    await tab(h.page, 'prompts');
    eq(await h.page.locator('.ba-custom li').count(), 1, 'prompturile proprii se păstrează');
    noErr(h);
    await h.ctx.close();
  });

  await T('balanta: setul inclus se vede întreg în interfață (limbi × categorii) și «Șterge sesiunea» cere confirmare', async () => {
    const h = await open('balanta');
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'ro');
    for (const l of ['en', 'hu']) await h.page.setChecked('#ba-cb-l-' + l, true);
    for (const c of ['culture', 'reasoning', 'grammar', 'translation']) await h.page.setChecked('#ba-cb-c-' + c, true);
    ok(new RegExp('filtrelor: ' + PROMPT_FILES.length + '\\.').test(await h.page.textContent('#ba-pool')), await h.page.textContent('#ba-pool') + ' vs ' + PROMPT_FILES.length);
    await h.page.setChecked('#ba-cb-l-en', false); await h.page.setChecked('#ba-cb-l-hu', false);
    const ro = PROMPT_FILES.filter((f) => f.startsWith('ro-')).length;
    ok(new RegExp('filtrelor: ' + ro + '\\.').test(await h.page.textContent('#ba-pool')), await h.page.textContent('#ba-pool'));
    await h.page.fill('#ba-models', 'alfa\nbeta');
    await h.page.click('#ba-apply');
    ok(await h.page.evaluate((k) => localStorage.getItem(k) !== null, KEY));
    await h.page.click('#ba-reset');
    ok(/Sigur\?/.test(await h.page.textContent('#ba-reset')), 'prima apăsare cere confirmare');
    ok(await h.page.evaluate((k) => localStorage.getItem(k) !== null, KEY), 'nimic șters încă');
    await h.page.click('#ba-reset');
    eq(await live(h.page), 'Sesiunea a fost ștearsă.');
    ok(await h.page.evaluate((k) => localStorage.getItem(k) === null, KEY), 'cheia a fost ștearsă');
    eq(await h.page.inputValue('#ba-models'), '');
    await h.ctx.close();
  });

  await T('balanta: modelele se validează (2–8, unice, ≤ 40 de caractere) și limba schimbată în mijlocul votului păstrează perechea și voturile', async () => {
    const h = await open('balanta');
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'ro');
    const tryApply = async (text) => { await h.page.fill('#ba-models', text); await h.page.click('#ba-apply'); return live(h.page); };
    eq(await tryApply('singur'), 'Scrie cel puțin două modele.');
    eq(await tryApply('a\nb\na'), 'Nume repetat: «a».');
    ok(/începe cu «x{20}…» are peste 40/.test(await tryApply('a\n' + 'x'.repeat(41))), 'nume lung');
    eq(await tryApply('1\n2\n3\n4\n5\n6\n7\n8\n9'), 'Cel mult 8 modele.');
    eq(await tryApply('a\nb\u0007'), 'Numele modelelor nu pot conține caractere de control.');
    const h2 = await open('balanta', {stateKey: KEY, state: bst({models: ['alfa', 'beta'], prompts: 3})});
    await h2.page.waitForSelector(ready);
    await tab(h2.page, 'vote');
    await h2.page.click('#ba-w-a');
    const before = await h2.page.textContent('#ba-prompt-text');
    await h2.page.selectOption('#langsel', 'en');
    await h2.page.waitForSelector(ready);
    ok(/Comparison 2 of 3 \(2 left\)/.test(await h2.page.textContent('#ba-vh')), await h2.page.textContent('#ba-vh'));
    eq(await h2.page.textContent('#ba-prompt-text'), before, 'aceeași pereche după schimbarea limbii');
    await h2.page.click('#ba-w-b');
    ok(/Vote recorded\. Total: 2\./.test(await live(h2.page)), await live(h2.page));
    await h.ctx.close(); await h2.ctx.close();
  });

  await T('balanta: filele se navighează din tastatură (săgeți, Home, End) și au roluri ARIA corecte', async () => {
    const h = await open('balanta');
    await h.page.waitForSelector(ready);
    eq(await h.page.getAttribute('#ba-t-setup', 'aria-selected'), 'true');
    eq(await h.page.getAttribute('#ba-t-setup', 'tabindex'), '0');
    eq(await h.page.getAttribute('#ba-t-vote', 'tabindex'), '-1');
    await h.page.focus('#ba-t-setup');
    await h.page.keyboard.press('ArrowRight');
    eq(await h.page.getAttribute('#ba-t-answers', 'aria-selected'), 'true');
    ok(await h.page.evaluate(() => document.activeElement.id === 'ba-t-answers'), 'focus mutat pe fila nouă');
    await h.page.keyboard.press('End');
    eq(await h.page.getAttribute('#ba-t-prompts', 'aria-selected'), 'true');
    await h.page.keyboard.press('ArrowRight');
    eq(await h.page.getAttribute('#ba-t-setup', 'aria-selected'), 'true', 'se reia de la început');
    await h.page.keyboard.press('ArrowLeft');
    eq(await h.page.getAttribute('#ba-t-prompts', 'aria-selected'), 'true');
    await h.page.keyboard.press('Home');
    eq(await h.page.getAttribute('#ba-t-setup', 'aria-selected'), 'true');
    const panels = await h.page.$$eval('[role=tabpanel]', (p) => p.map((x) => [x.id, x.hidden, x.getAttribute('aria-labelledby')]));
    eq(panels.length, 5);
    eq(panels.filter((p) => !p[1]).length, 1, 'un singur panou vizibil');
    noErr(h);
    await h.ctx.close();
  });

  await T('balanta: stări salvate ostile (prototipuri, tipuri greșite, valori uriașe, HTML) sunt neutralizate fără erori', async () => {
    const custom = [{id: 'custom-1', lang: 'ro', category: 'grammar', difficulty: 'easy', prompt: '<img src=x onerror=alert(1)> prompt de test destul de lung', notes: '<b>n</b>', sources: ['javascript:alert(1)', 'https://exemplu.ro/ok']}, {id: '../x', lang: 'ro', category: 'grammar', difficulty: 'easy', prompt: 'respins pentru că id-ul e greșit'}, {id: 'custom-2', lang: 'xx', category: 'grammar', difficulty: 'easy', prompt: 'respins pentru limbă'}, 7, null];
    const names = Array.from({length: 30}, (_, i) => 'm' + i);
    const states = [
      JSON.stringify({models: names.concat(['m1', '  ', 5, null]), seed: 'x'.repeat(500), langs: [], cats: 'da', count: 1e9, custom, answers: 'x', votes: 'y'}),
      '{"models":["__proto__","constructor"],"langs":{"ro":true},"cats":{},"custom":' + JSON.stringify(custom) + ',"answers":{"__proto__":{"__proto__":"x"},"custom-1":{"__proto__":"y","constructor":"z","alfa":""}},"votes":[{"v":1,"prompt":"custom-1","a":"__proto__","b":"constructor","winner":"a"},{"v":2,"prompt":"custom-1","a":"x","b":"y","winner":"a"},{"prompt":"custom-1","a":"x","b":"x","winner":"a"},[],null,"text"]}',
      '{"__proto__":{"polluted":1},"models":{"0":"a"},"votes":{"length":99999999}}',
      '{"answers":{"custom-1":{"alfa":' + JSON.stringify('x'.repeat(30000)) + '}},"models":["alfa","beta"],"custom":' + JSON.stringify(custom.slice(0, 1)) + '}',
      '{"count":"3","reveal":"true","seed":42,"langs":{"zz":true,"ro":1},"cats":{"grammar":"yes"}}'
    ];
    for (const s of states) {
      const h = await open('balanta', {stateKey: KEY, state: s});
      await h.page.waitForSelector(ready);
      ok(await h.page.evaluate(() => ({}).polluted === undefined && Object.prototype.polluted === undefined), 'poluare de prototip');
      const n = (await h.page.inputValue('#ba-models')).split('\n').filter(Boolean).length;
      ok(n <= 8, n + ' modele păstrate');
      for (const t of ['answers', 'vote', 'results', 'prompts']) {
        await tab(h.page, t);
        const text = await h.page.evaluate(() => document.querySelector('#appmount').innerText);
        ok(!BAD_TEXT.test(text), t + ': ' + (text.match(BAD_TEXT) || [''])[0]);
        eq(await h.page.locator('#appmount img').count(), 0, 'HTML injectat în ' + t);
      }
      noErr(h, 'stare ' + s.slice(0, 40));
      await h.ctx.close();
    }
    const h = await open('balanta', {stateKey: KEY, state: states[1]});
    await h.page.waitForSelector(ready);
    await tab(h.page, 'results');
    eq((await rows(h.page)).map((r) => r[1]).join(','), '__proto__,constructor');
    await tab(h.page, 'prompts');
    eq(await h.page.locator('.ba-custom li').count(), 1);
    ok(/<img src=x onerror=alert\(1\)>/.test(await h.page.textContent('.ba-custom')), 'prompt afișat ca text');
    await h.ctx.close();
  });

  await T('balanta: fiecare filă, cu date, trece de axe în temele luminoasă și întunecată', async () => {
    const models = ['alfa', 'beta', 'gama'];
    for (const scheme of ['light', 'dark']) {
      const h = await open('balanta', {scheme, stateKey: KEY, state: bst({votes: bvotes(models, 3).slice(0, 4)})});
      await h.page.waitForSelector(ready);
      for (const l of (scheme === 'light' ? ['ro', 'en', 'de', 'hu'] : ['ro'])) {
        await h.page.selectOption('#langsel', l);
        await h.page.waitForSelector(ready);
        for (const t of ['setup', 'answers', 'vote', 'results', 'prompts']) {
          await tab(h.page, t);
          if (t === 'vote') await h.page.click('#ba-w-b');
          if (t === 'prompts') { await h.page.fill('#ba-pt', 'Scrie la mine la test@example.com pentru un răspuns, te rog frumos.'); await h.page.click('#ba-pcheck'); }
          const v = await axe(h.page);
          ok(v.length === 0, scheme + '/' + l + '/' + t + ': ' + JSON.stringify(v));
        }
      }
      noErr(h);
      await h.ctx.close();
    }
  });

  await T('balanta: pe mobil (360 px) toate filele rămân în pagină, inclusiv tabelele late', async () => {
    const models = ['alfa', 'beta', 'gama', 'delta', 'epsilon'];
    const h = await open('balanta', {w: 360, h: 740, stateKey: KEY, state: bst({models, prompts: 2, votes: bvotes(models, 2)})});
    await h.page.waitForSelector(ready);
    for (const l of ['ro', 'de', 'hu']) {
      await h.page.selectOption('#langsel', l);
      await h.page.waitForSelector(ready);
      for (const t of ['setup', 'answers', 'vote', 'results', 'prompts']) {
        await tab(h.page, t);
        const w = await h.page.evaluate(() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth}));
        ok(w.sw <= w.iw + 1, l + '/' + t + ': scrollWidth ' + w.sw + ' > ' + w.iw);
      }
    }
    await h.ctx.close();
  });

  await browser.close();
} else {
  console.log('omis: balanta (nu există ' + path.relative(HUB, appFile('balanta')) + ')');
  skipped.add('balanta');
}

/* ================= GLOSAR ================= */
if (present('glosar')) {
  const ready = '#appmount .gl-root';
  const KEY = 'glosar.state';
  const RAW = /\b(?:tab|s|st|pos|issue|m|b|x|gd|e|l|a)_[a-z0-9_]{2,}\b/;
  const GDIR = path.join(ROOT, 'glosar');
  const gJson = (f) => JSON.parse(fs.readFileSync(path.join(GDIR, f), 'utf8'));
  const gFix = (f) => fs.readFileSync(path.join(GDIR, 'test', 'fixtures', f));
  const GENT = fs.readdirSync(path.join(GDIR, 'data', 'dictionaries')).filter((f) => f.endsWith('.json') && f !== 'example.json')
    .map((f) => Object.assign(gJson('data/dictionaries/' + f), {id: f.replace(/\.json$/, '')}));
  const GCON = gJson('data/concepts.json').concepts;
  const GLANG = gJson('data/languages.json').languages;
  const I = (await import(pathToFileURL(path.join(GDIR, 'src', 'i18n.mjs')).href)).default;
  const F = (s, ...a) => s.replace(/\{(\d)\}/g, (m, i) => String(a[Number(i)]));
  const rx = (tpl, ...a) => new RegExp('^' + F(tpl, ...a.map(() => '@@')).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/@@/g, '\\d+') + '$');
  const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const norm = (v) => Array.isArray(v) ? v.map(norm) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])])) : v;
  const same = (a, b, m) => eq(JSON.stringify(norm(a)), JSON.stringify(norm(b)), m);
  const gHave = (code) => new Set(GENT.filter((e) => e.lang === code && GCON.some((c) => c.id === e.concept)).map((e) => e.concept)).size;
  const POS_OF = {numbers: 'numeral', family: 'noun', body: 'noun', nature: 'noun', basic: 'adjective'};
  const TABS = ['search', 'cover', 'add', 'export', 'guide'];
  const shown = (n) => Math.min(n, 30);
  const LX = 'ruo';   // limba folosită la adăugări: orice limbă din index; intrările de probă au cuvinte inventate (x…), nu cuvinte reale
  ok(GLANG.some((l) => l.code === LX), 'data/languages.json nu mai are limba ' + LX);
  const CX = GCON.find((c) => !GENT.some((e) => e.lang === LX && e.concept === c.id));
  ok(CX, 'toate conceptele au deja o intrare în ' + LX + ': alege altă limbă pentru testele de adăugare');
  const OPUS = 'data:audio/ogg;base64,' + gFix('tone.opus').toString('base64');
  const seed = (n, extra) => Object.assign({id: 'rup-s' + n, lang: 'rup', headword: 's' + n, pos: 'noun', gloss: {en: 'seed ' + n}, source: 'Seed source', status: 'draft'}, extra || {});
  const stateOf = (own) => JSON.stringify({v: 1, own: own, last: {}});

  async function gOpen(o = {}) {
    const h = await open('glosar', Object.assign({locale: 'en-GB', stateKey: KEY}, o));
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    await h.page.waitForSelector(ready);
    return h;
  }
  const gTab = async (p, id) => { await p.click('#gl-t-' + id); await p.waitForSelector('#gl-p-' + id + ':not([hidden])'); };
  const gLive = async (p) => (await p.$eval('#gl-live', (e) => (e.querySelector('p') || e).textContent)).trim();
  const gStore = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
  const gDl = async (p, sel) => {
    const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]);
    return {name: d.suggestedFilename(), buf: fs.readFileSync(await d.path())};
  };
  const gBad = (p, sel) => p.$$eval((sel || '#gl-out') + ' .gl-bad', (e) => e.map((x) => x.textContent));
  async function gFill(p, o) {
    if (o.lang) await p.selectOption('#gl-lang', o.lang);
    if (o.pos) await p.selectOption('#gl-pos', o.pos);
    if (o.status) await p.selectOption('#gl-status', o.status);
    const f = {head: o.head, var: o.variants, 'g-en': o.en, 'g-ro': o.ro, src: o.src, url: o.url, rev: o.rev, notes: o.notes, ex: o.ex, lic: o.lic};
    for (const k of Object.keys(f)) if (f[k] !== undefined) await p.fill('#gl-' + k, f[k]);
  }
  async function gWait(p, act) {   // așteaptă un mesaj nou în zona «live» după o acțiune asincronă (citire de fișier)
    await p.evaluate(() => { document.getElementById('gl-live').textContent = ''; });
    await act();
    await p.waitForFunction(() => document.getElementById('gl-live').textContent.trim() !== '');
    return gLive(p);
  }
  const gImport = (p, buffer, name) => gWait(p, () => p.setInputFiles('#gl-import', {name: name || 'x.json', mimeType: 'application/json', buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer))}));
  const gUpload = (p, buffer, name) => gWait(p, () => p.setInputFiles('#gl-upload', {name: name || 'x.opus', mimeType: 'audio/ogg', buffer: buffer}));

  browser = await launch();
  await baseline('glosar', {ready, stateKey: KEY, rawKey: RAW});

  await T('glosar: cele cinci file se deschid în toate limbile, fără chei netraduse sau text invalid', async () => {
    const h = await gOpen();
    const p = h.page;
    for (const l of LANGS) {
      await p.selectOption('#langsel', l);
      await p.waitForSelector(ready);
      for (const id of TABS) {
        await gTab(p, id);
        eq(await p.getAttribute('#gl-t-' + id, 'aria-selected'), 'true', l + '/' + id + ': aria-selected');
        eq(await p.$$eval('.gl-tab[aria-selected="true"]', (e) => e.length), 1, l + '/' + id + ': file selectate');
        eq(await p.$$eval('.gl-panel:not([hidden])', (e) => e.length), 1, l + '/' + id + ': panouri vizibile');
        const text = await p.innerText('#gl-p-' + id);
        ok(text.length > 40, l + '/' + id + ': panou gol');
        const raw = text.match(RAW) || text.match(RAW_KEY);
        ok(!raw, l + '/' + id + ': cheie netradusă «' + (raw && raw[0]) + '»');
        const bad = text.match(BAD_TEXT);
        ok(!bad, l + '/' + id + ': text invalid «' + (bad && bad[0]) + '»');
      }
    }
    noErr(h);
    await h.ctx.close();
  });

  await T('glosar: filele răspund la săgeți, Home și End, cu focusul pe fila nouă', async () => {
    const h = await gOpen();
    const p = h.page;
    const active = () => p.evaluate(() => document.activeElement && document.activeElement.id);
    await p.focus('#gl-t-search');
    for (const [key, want] of [['ArrowRight', 'cover'], ['ArrowRight', 'add'], ['End', 'guide'], ['ArrowRight', 'search'], ['ArrowLeft', 'guide'], ['Home', 'search'], ['ArrowLeft', 'guide']]) {
      await p.keyboard.press(key);
      eq(await active(), 'gl-t-' + want, key + ': focus');
      eq(await p.getAttribute('#gl-t-' + want, 'aria-selected'), 'true', key + ': fila selectată');
      eq(await p.$$eval('.gl-tab[tabindex="0"]', (e) => e.length), 1, key + ': o singură filă în ordinea Tab');
    }
    noErr(h);
    await h.ctx.close();
  });

  await T('glosar: căutarea ignoră diacriticele, caută în sensuri, se filtrează și arată mai multe rezultate cu focus', async () => {
    const h = await gOpen();
    const p = h.page;
    const words = () => p.$$eval('#gl-list .gl-word', (e) => e.map((x) => x.textContent));
    const count = () => p.textContent('#gl-count').then((t) => t.trim());
    const want = (n) => (n ? F(I.en.s_count, n, shown(n)) : I.en.s_none);
    eq(await count(), want(GENT.length), 'fără interogare se arată tot');
    const dia = GENT.find((e) => /[^\x00-\x7f]/.test(e.headword) && /^[a-z0-9 ]+$/.test(strip(e.headword)));
    ok(dia, 'datele nu au niciun cuvânt cu diacritice');
    for (const q of [strip(dia.headword), dia.headword.toUpperCase(), dia.headword]) {
      await p.fill('#gl-q', q);
      ok((await words()).includes(dia.headword), '«' + q + '» nu găsește «' + dia.headword + '»');
    }
    const ro = GENT.find((e) => e.gloss.ro && /[^\x00-\x7f]/.test(e.gloss.ro) && /^[a-z ]+$/.test(strip(e.gloss.ro)));
    if (ro) {
      await p.fill('#gl-q', strip(ro.gloss.ro));
      ok((await words()).includes(ro.headword), 'sensul «' + strip(ro.gloss.ro) + '» nu găsește «' + ro.headword + '»');
    }
    const en = GENT.find((e) => e.gloss.en && /^[a-z]{4,}$/.test(e.gloss.en));
    await p.fill('#gl-q', en.gloss.en);
    ok((await words()).includes(en.headword), 'sensul «' + en.gloss.en + '» nu găsește «' + en.headword + '»');
    await p.fill('#gl-q', 'zzzzqx');
    eq(await count(), I.en.s_none);
    eq(await p.$('#gl-list'), null, 'lista dispare când nu sunt rezultate');
    await p.fill('#gl-q', '<img src=x onerror=window.__pwned=1>');
    eq(await count(), I.en.s_none);
    ok(await p.evaluate(() => !window.__pwned && !document.querySelector('#gl-results img')), 'interogarea a fost interpretată ca HTML');
    await p.fill('#gl-q', '');
    await p.locator('#gl-q').pressSequentially('x'.repeat(100));
    eq((await p.inputValue('#gl-q')).length, 80, 'lungimea maximă a interogării');
    await p.fill('#gl-q', '');
    for (const l of GLANG) {
      await p.selectOption('#gl-flang', l.code);
      const n = GENT.filter((e) => e.lang === l.code).length;
      eq(await count(), want(n), 'filtru de limbă ' + l.code);
      if (n) ok(await p.$$eval('#gl-list .gl-meta > span:first-child', (e, name) => e.every((x) => x.textContent === name), l.name.en), l.code + ': limba din fișe');
    }
    await p.selectOption('#gl-flang', 'all');
    await p.selectOption('#gl-fstatus', 'reviewed');
    eq(await count(), want(GENT.filter((e) => e.status === 'reviewed').length), 'doar verificate');
    await p.selectOption('#gl-fstatus', 'sourced');
    eq(await count(), want(GENT.filter((e) => e.status === 'sourced' || e.status === 'reviewed').length), 'cu sursă sau verificate');
    await p.selectOption('#gl-fstatus', 'any');
    await p.check('#gl-faudio');
    eq(await count(), want(GENT.filter((e) => e.audio).length), 'doar cu sunet');
    await p.uncheck('#gl-faudio');
    const links = await p.$$eval('#gl-list a', (a) => a.map((x) => [x.getAttribute('href'), x.rel, x.target]));
    ok(links.length > 0 && links.every((x) => /^https:\/\//.test(x[0]) && /noopener/.test(x[1]) && x[2] === '_blank'), JSON.stringify(links.slice(0, 3)));
    if (GENT.length > 30) {
      eq(await p.$$eval('#gl-list .gl-entry', (e) => e.length), 30, 'prima pagină');
      await p.click('#gl-more');
      eq(await count(), F(I.en.s_count, GENT.length, GENT.length), 'toate după «mai multe»');
      const id = await p.evaluate(() => document.activeElement.id);
      ok(/^gl-e-/.test(id), 'focusul după «mai multe»: ' + id);
      eq(await p.$('#gl-more'), null, 'butonul dispare când s-au arătat toate');
    }
    noErr(h);
    await h.ctx.close();
  });

  await T('glosar: acoperirea numără din datele reale, iar «Adaugă» pregătește formularul', async () => {
    const h = await gOpen();
    const p = h.page;
    await gTab(p, 'cover');
    const have = await p.$$eval('.gl-have li', (e) => e.map((x) => x.textContent));
    eq(have.length, GLANG.length, 'limbi în listă');
    GLANG.forEach((l, i) => eq(have[i], F(I.en.c_have, l.name.en, gHave(l.code), GCON.length), l.code));
    for (const l of GLANG) eq(await p.$$eval('.gl-addbtn[id^="gl-add-' + l.code + '-"]', (e) => e.length), GCON.length - gHave(l.code), l.code + ': butoane «Adaugă»');
    eq(await p.$$eval('.gl-table', (t) => t.length), new Set(GCON.map((c) => c.group)).size, 'tabele pe grupe');
    ok(await p.$$eval('.gl-addbtn', (b) => b.every((x) => (x.getAttribute('aria-label') || '').length > 3)), 'butoanele nu au nume accesibil');
    await p.click('#gl-add-' + LX + '-' + CX.id);
    eq(await p.getAttribute('#gl-t-add', 'aria-selected'), 'true', 'fila «Adăugare»');
    eq(await p.inputValue('#gl-lang'), LX, 'limba');
    eq(await p.inputValue('#gl-pos'), POS_OF[CX.group], 'partea de vorbire');
    eq(await p.inputValue('#gl-concept'), CX.id, 'conceptul');
    eq(await p.inputValue('#gl-g-en'), CX.en, 'sensul în engleză');
    eq(await p.inputValue('#gl-g-ro'), CX.ro, 'sensul în română');
    eq(await p.evaluate(() => document.activeElement.id), 'gl-head', 'focusul pe cuvânt');
    noErr(h);
    await h.ctx.close();
  });

  await T('glosar: adăugarea validează, blochează duplicatele, salvează în browser și se șterge cu confirmare', async () => {
    const h = await gOpen();
    const p = h.page;
    await gTab(p, 'add');
    await p.click('#gl-add');
    eq((await gBad(p)).join('|'), [I.en.issue_headword, I.en.issue_gloss, I.en.issue_source].join('|'), 'formular gol');
    eq((await p.textContent('#gl-own-h')).trim(), F(I.en.m_title, 0));
    eq(await gStore(p), null, 'nimic nu se salvează din formular gol');
    await gFill(p, {lang: LX, head: 'xzi', en: 'day', src: 'Test source', status: 'sourced'});
    await p.click('#gl-check');
    eq((await gBad(p)).join('|'), I.en.issue_source_url, '«sourced» fără adresă');
    await p.fill('#gl-url', 'http://nu-este-https.example/x');
    await p.click('#gl-check');
    eq((await gBad(p)).join('|'), I.en.issue_source_url, 'adresă fără https');
    await p.fill('#gl-url', 'https://example.org/sursa');
    await p.click('#gl-check');
    eq((await p.innerText('#gl-out')).trim(), I.en.a_ok, 'adresă corectă');
    await p.selectOption('#gl-status', 'reviewed');
    await p.click('#gl-check');
    eq((await gBad(p)).join('|'), I.en.issue_reviewed_by, '«reviewed» fără nume');
    await p.fill('#gl-rev', 'Test Speaker');
    await p.click('#gl-check');
    eq((await p.innerText('#gl-out')).trim(), I.en.a_ok, 'cu numele vorbitorului');
    await p.selectOption('#gl-status', 'draft');
    await p.fill('#gl-url', '');
    await p.fill('#gl-g-ro', 'ziuă');
    await p.click('#gl-check');
    eq((await p.innerText('#gl-out')).trim(), I.en.a_ok);
    eq((await p.textContent('#gl-own-h')).trim(), F(I.en.m_title, 0), 'verificarea nu adaugă');
    await p.click('#gl-add');
    eq(await gLive(p), F(I.en.a_added, LX + '-xzi'));
    eq((await p.textContent('#gl-own-h')).trim(), F(I.en.m_title, 1));
    eq((await p.textContent('#gl-own .gl-cid')).trim(), LX + '-xzi');
    eq((await p.textContent('#gl-own .gl-cmeta')).trim(), 'xzi — day');
    eq(await p.inputValue('#gl-head'), '', 'cuvântul se golește');
    eq(await p.inputValue('#gl-g-en'), '', 'sensul se golește');
    eq(await p.inputValue('#gl-src'), 'Test source', 'sursa se păstrează pentru intrarea următoare');
    eq(await p.inputValue('#gl-lang'), LX, 'limba se păstrează');
    eq(await p.evaluate(() => document.activeElement.id), 'gl-head', 'focusul revine pe cuvânt');
    let st = await gStore(p);
    eq(st.v, 1);
    same(st.own, [{id: LX + '-xzi', lang: LX, headword: 'xzi', pos: 'noun', gloss: {ro: 'ziuă', en: 'day'}, status: 'draft', source: 'Test source'}], 'intrarea salvată');
    eq(st.last.lang, LX);
    eq(st.last.source, 'Test source');
    await gFill(p, {head: 'xzi', en: 'day', ro: 'ziuă'});
    await p.click('#gl-add');
    eq((await gBad(p)).join('|'), LX + '-xzi (xzi): ' + I.en.a_dup_same, 'același cuvânt, același sens');
    eq((await p.textContent('#gl-own-h')).trim(), F(I.en.m_title, 1), 'duplicatul nu s-a adăugat');
    await p.fill('#gl-g-en', 'sun');
    await p.fill('#gl-g-ro', '');
    await p.click('#gl-check');
    eq((await p.$$eval('#gl-out .gl-warn', (e) => e.map((x) => x.textContent))).join('|'), LX + '-xzi (xzi): ' + I.en.a_dup_other, 'același cuvânt, alt sens');
    await p.click('#gl-add');
    eq(await gLive(p), F(I.en.a_added, LX + '-xzi-2'), 'omograful primește sufix');
    eq((await p.textContent('#gl-own-h')).trim(), F(I.en.m_title, 2));
    await gTab(p, 'cover');
    await p.click('#gl-add-' + LX + '-' + CX.id);
    await p.fill('#gl-head', 'xuno');
    await p.click('#gl-add');
    eq(await gLive(p), F(I.en.a_added, LX + '-xuno'));
    await p.reload();
    await p.waitForSelector(ready);
    await p.selectOption('#langsel', 'en');
    await p.waitForSelector(ready);
    await p.fill('#gl-q', 'xzi');
    eq((await p.$$eval('#gl-list .gl-entry', (e) => e.map((x) => x.id)).then((a) => a.sort())).join(','), 'gl-e-' + LX + '-xzi,gl-e-' + LX + '-xzi-2', 'după reîncărcare');
    eq((await p.$$eval('#gl-list .gl-yours', (e) => e.map((x) => x.textContent))).join('|'), I.en.r_yours + '|' + I.en.r_yours, 'insigna «ale tale»');
    await gTab(p, 'cover');
    const li = GLANG.findIndex((l) => l.code === LX);
    eq((await p.$$eval('.gl-have li', (e) => e.map((x) => x.textContent)))[li], F(I.en.c_have, GLANG[li].name.en, gHave(LX) + 1, GCON.length), 'acoperirea include intrările tale');
    eq(await p.$('#gl-add-' + LX + '-' + CX.id), null, 'butonul «Adaugă» dispare din celula acoperită');
    ok((await p.$$eval('.gl-have-cell', (e) => e.map((x) => x.textContent))).includes('xuno'), 'celula arată cuvântul');
    await gTab(p, 'add');
    st = await gStore(p);
    eq(st.own.length, 3);
    await p.click('#gl-or-1');
    eq(await gLive(p), F(I.en.m_removed, LX + '-xzi-2'));
    eq((await gStore(p)).own.length, 2, 'ștergerea unei intrări');
    eq((await p.textContent('#gl-clear')).trim(), I.en.m_clear);
    await p.click('#gl-clear');
    eq((await p.textContent('#gl-clear')).trim(), I.en.m_clear2, 'a doua apăsare cere confirmare');
    eq((await gStore(p)).own.length, 2, 'prima apăsare nu șterge');
    await p.click('#gl-clear');
    eq(await gLive(p), I.en.m_cleared);
    eq((await gStore(p)).own.length, 0);
    eq((await p.textContent('#gl-own-h')).trim(), F(I.en.m_title, 0));
    ok((await p.isDisabled('#gl-clear')) && (await p.isDisabled('#gl-dlall')), 'butoanele de golire și descărcare sunt oprite');
    ok((await p.innerText('#gl-p-add')).includes(I.en.m_none), 'mesajul «nimic adăugat»');
    noErr(h);
    await h.ctx.close();
  });

  await T('glosar: adăugarea în bloc raportează rândurile greșite și duplicatele și respectă limitele', async () => {
    const h = await gOpen();
    const p = h.page;
    await gTab(p, 'add');
    await p.selectOption('#gl-lang', LX);
    const text = ['# comentariu', 'xalfa = alpha', 'xbeta;beta', 'xgama\tgamma', 'fără separator', '=fără cuvânt', 'xdelta =', 'xalfa = alpha', 'xalfa = another meaning'].join('\n');
    await p.fill('#gl-btext', text);
    await p.click('#gl-bcheck');
    eq((await gBad(p, '#gl-bout')).join('|'), I.en.issue_source, 'fără sursă');
    ok(await p.$eval('#gl-bgo', (b) => b.hidden), 'butonul de adăugare e ascuns');
    await p.fill('#gl-src', 'Test source');
    await p.click('#gl-bcheck');
    eq((await p.textContent('#gl-bout p')).trim(), F(I.en.b_sum, 4, 4));
    eq((await p.$$eval('#gl-bout li', (e) => e.map((x) => x.textContent))).join('|'),
      [F(I.en.b_line, 5, I.en.b_e_sep), F(I.en.b_line, 6, I.en.b_e_headword), F(I.en.b_line, 7, I.en.b_e_gloss), F(I.en.b_line, 8, 'xalfa: ' + I.en.b_e_dup)].join('|'), 'rândurile cu probleme');
    eq((await p.textContent('#gl-bgo')).trim(), F(I.en.b_go, 4));
    await p.click('#gl-bgo');
    eq(await gLive(p), F(I.en.b_added, 4, 0));
    eq((await gStore(p)).own.map((o) => o.id + ':' + o.gloss.en).join(','), [LX + '-xalfa:alpha', LX + '-xbeta:beta', LX + '-xgama:gamma', LX + '-xalfa-2:another meaning'].join(','), 'intrările adăugate, cu omograful numerotat');
    eq(await p.inputValue('#gl-btext'), '', 'caseta se golește');
    ok(await p.$eval('#gl-bgo', (b) => b.hidden), 'butonul dispare după adăugare');
    await p.fill('#gl-btext', text);
    await p.click('#gl-bcheck');
    eq((await p.textContent('#gl-bout p')).trim(), F(I.en.b_sum, 0, 8), 'a doua lipire: totul e duplicat');
    ok(await p.$eval('#gl-bgo', (b) => b.hidden), 'nimic de adăugat');
    await p.selectOption('#gl-bgl', 'ro');
    await p.fill('#gl-btext', 'xomega = omega');
    await p.click('#gl-bcheck');
    await p.click('#gl-bgo');
    same((await gStore(p)).own.pop().gloss, {ro: 'omega'}, 'sensul merge în limba aleasă');
    await p.fill('#gl-btext', Array.from({length: 201}, (_, i) => 'xw' + i + ' = m' + i).join('\n'));
    await p.click('#gl-bcheck');
    eq((await p.textContent('#gl-bout p')).trim(), F(I.en.b_sum, 200, 1), 'cel mult 200 de rânduri');
    eq((await p.$$eval('#gl-bout li', (e) => e.map((x) => x.textContent))).join('|'), F(I.en.b_line, 201, I.en.b_e_many));
    await p.fill('#gl-btext', Array.from({length: 30}, (_, i) => 'fără separator ' + i).join('\n'));
    await p.click('#gl-bcheck');
    eq((await p.textContent('#gl-bout p')).trim(), F(I.en.b_sum, 0, 30));
    eq(await p.$$eval('#gl-bout li', (e) => e.length), 20, 'cel mult 20 de rânduri afișate');
    noErr(h);
    await h.ctx.close();
  });

  await T('glosar: exportul TSV și Anki are antetul, rândurile și numele potrivite și nu lasă formule', async () => {
    const h = await gOpen();
    const p = h.page;
    await gTab(p, 'export');
    eq((await p.textContent('#gl-xcount')).trim(), F(I.en.x_count, GENT.length));
    await p.selectOption('#gl-xscope', 'mine');
    eq((await p.textContent('#gl-xcount')).trim(), I.en.x_none, 'fără intrări proprii');
    ok((await p.isDisabled('#gl-xtsv')) && (await p.isDisabled('#gl-xanki')), 'butoanele sunt oprite când nu e nimic de exportat');
    await p.selectOption('#gl-xscope', 'all');
    let d = await gDl(p, '#gl-xtsv');
    eq(d.name, 'glosar-all.tsv');
    let t = d.buf.toString('utf8');
    eq(t.charCodeAt(0), 0xfeff, 'semnul de ordine a octeților');
    let rows = t.slice(1).split('\n');
    eq(rows.pop(), '', 'rând nou la sfârșit');
    eq(rows.length, GENT.length + 1, 'rânduri');
    const head = rows[0].split('\t');
    eq(head.slice(0, 8).join(','), 'id,lang,headword,variants,pos,dialect,orthography,status');
    ok(head.includes('gloss_en') && head.includes('gloss_ro') && head[head.length - 1] === 'source', 'coloanele de sens și sursa');
    ok(rows.every((r) => r.split('\t').length === head.length), 'număr inegal de coloane');
    eq(rows.slice(1).map((r) => r.split('\t')[0]).sort().join(','), GENT.map((e) => e.id).sort().join(','), 'identificatorii');
    const lq = GLANG.find((l) => l.code !== LX && GENT.some((e) => e.lang === l.code));
    const nq = GENT.filter((e) => e.lang === lq.code).length;
    await p.selectOption('#gl-xlang', lq.code);
    eq((await p.textContent('#gl-xcount')).trim(), F(I.en.x_count, nq));
    d = await gDl(p, '#gl-xtsv');
    eq(d.name, 'glosar-' + lq.code + '.tsv');
    eq(d.buf.toString('utf8').slice(1).split('\n').length - 2, nq, 'rândurile limbii alese');
    d = await gDl(p, '#gl-xanki');
    eq(d.name, 'glosar-' + lq.code + '-anki.txt');
    rows = d.buf.toString('utf8').split('\n');
    eq(rows.pop(), '');
    eq(rows.slice(0, 3).join('|'), '#separator:tab|#html:true|#tags column:3');
    eq(rows.length, nq + 3, 'rândurile din fișierul Anki');
    ok(rows.slice(3).every((r) => r.split('\t').length === 3), 'fiecare card are trei câmpuri');
    await p.selectOption('#gl-xlang', 'all');
    await gTab(p, 'add');
    await gFill(p, {lang: LX, head: '=2+2', en: '-1', src: '@sursa'});
    await p.click('#gl-add');
    await gFill(p, {head: '<b>x&y</b>', en: '+plus'});
    await p.click('#gl-add');
    eq((await p.textContent('#gl-own-h')).trim(), F(I.en.m_title, 2));
    await gTab(p, 'export');
    await p.selectOption('#gl-xscope', 'mine');
    eq((await p.textContent('#gl-xcount')).trim(), F(I.en.x_count, 2));
    d = await gDl(p, '#gl-xtsv');
    rows = d.buf.toString('utf8').slice(1).split('\n');
    rows.pop();
    const c1 = rows[1].split('\t'), c2 = rows[2].split('\t'), col = (n) => head.indexOf(n);
    eq(c1[col('headword')], "'=2+2", 'cuvântul care începe cu «=»');
    eq(c1[col('gloss_en')], "'-1", 'sensul care începe cu «-»');
    eq(c1[col('source')], "'@sursa", 'sursa care începe cu «@»');
    eq(c2[col('gloss_en')], "'+plus", 'sensul care începe cu «+»');
    eq(c2[col('headword')], '<b>x&y</b>', 'etichetele rămân text în TSV');
    d = await gDl(p, '#gl-xanki');
    t = d.buf.toString('utf8');
    ok(t.includes('<b>&lt;b&gt;x&amp;y&lt;/b&gt;</b>'), 'HTML scăpat în fișierul Anki');
    ok(!t.includes('<b>x&y</b>'), 'HTML nescăpat în fișierul Anki');
    noErr(h);
    await h.ctx.close();
  });

  await T('glosar: fișierul de contribuție se descarcă, se reîncarcă fără pierderi și refuză fișierele greșite', async () => {
    const own = [seed(1), seed(2, {audio: OPUS}), seed(3, {variants: ['t3'], notes: 'o notă', examples: ['un exemplu'], source_url: 'https://example.org/s', status: 'sourced'})];
    const h = await gOpen({state: stateOf(own)});
    const p = h.page;
    await gTab(p, 'add');
    eq((await p.textContent('#gl-own-h')).trim(), F(I.en.m_title, 3));
    ok((await p.$('#gl-oa-0')) === null && (await p.$('#gl-oa-1')) !== null, 'butonul de sunet doar la intrarea cu sunet');
    let d = await gDl(p, '#gl-dlall');
    eq(d.name, 'glosar-contribution.json');
    const b = JSON.parse(d.buf.toString('utf8'));
    eq(b.format, 'glosar-bundle');
    eq(b.version, 1);
    ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(b.created), 'data creării: ' + b.created);
    eq(b.entries.length, 3);
    ok(b.entries.every((e) => !('id' in e)), 'identificatorii nu se exportă');
    ok(b.entries[1].audio_data.startsWith('data:audio/ogg;base64,') && !('audio' in b.entries[1]), 'sunetul merge în audio_data');
    d = await gDl(p, '#gl-oa-1');
    eq(d.name, 'rup-s2.opus');
    ok(d.buf.equals(gFix('tone.opus')), 'sunetul descărcat e identic cu cel încărcat');
    const one = await gDl(p, '#gl-od-1');
    eq(one.name, 'rup-s2.json');
    same(JSON.parse(one.buf.toString('utf8')), {lang: 'rup', headword: 's2', pos: 'noun', gloss: {en: 'seed 2'}, status: 'draft', audio: 'audio/rup-s2.opus', source: 'Seed source'}, 'fișierul unei intrări');
    d = await gDl(p, '#gl-dlall');
    const bundle = d.buf;
    await p.click('#gl-clear');
    await p.click('#gl-clear');
    eq((await gStore(p)).own.length, 0);
    eq(await gImport(p, bundle, 'glosar-contribution.json'), F(I.en.m_imported, 3, 0), 'reîncărcare după golire');
    same((await gStore(p)).own.map((o) => { const c = Object.assign({}, o); delete c.id; return c; }), own.map((o) => { const c = Object.assign({}, o); delete c.id; return c; }), 'intrările reîncărcate sunt identice');
    eq(await gImport(p, bundle), F(I.en.m_imported, 0, 3), 'a doua încărcare sare peste duplicate');
    eq(await gImport(p, 'nu este json'), I.en.e_format);
    eq(await gImport(p, '{"format":"altceva","version":1,"entries":[]}'), I.en.e_format);
    eq(await gImport(p, '{"format":"glosar-bundle","version":2,"entries":[]}'), I.en.e_format, 'versiune necunoscută');
    eq(await gImport(p, JSON.stringify({format: 'glosar-bundle', version: 1, entries: Array.from({length: 501}, () => ({}))})), I.en.e_many, 'peste 500 de intrări');
    eq(await gImport(p, Buffer.alloc(8000001, 32)), I.en.e_big, 'fișier peste 8 MB');
    const mixed = {format: 'glosar-bundle', version: 1, entries: [
      {lang: 'rup', headword: 's9', pos: 'noun', gloss: {en: 'nine'}, source: 'Seed source'},
      {lang: 'rup', headword: '', pos: 'noun', gloss: {en: 'x'}, source: 's'},
      {lang: 'zz', headword: 'q', pos: 'noun', gloss: {en: 'x'}, source: 's'},
      5,
      {lang: 'rup', headword: 'r', pos: 'noun', gloss: {en: 'x'}, source: 's', extra: 1},
      {lang: 'rup', headword: 'a', pos: 'noun', gloss: {en: 'x'}, source: 's', audio_data: 'data:audio/ogg;base64,AAAA'}
    ]};
    eq(await gImport(p, JSON.stringify(mixed)), F(I.en.m_imported, 1, 5), 'un fișier cu intrări bune și rele');
    const lines = await p.$$eval('#gl-live li', (e) => e.map((x) => x.textContent));
    eq(lines.length, 5, 'câte un rând pentru fiecare intrare respinsă');
    eq(lines[0], F(I.en.m_bad, 2, I.en.issue_headword));
    eq(lines[2], F(I.en.m_bad, 4, I.en.issue_other));
    ok(lines[1].startsWith('entry 3: ') && lines[3].startsWith('entry 5: ') && lines[4].startsWith('entry 6: '), lines.join(' | '));
    ok(lines[4].includes(I.en.issue_audio), 'sunetul care nu e Opus este refuzat: ' + lines[4]);
    eq((await gStore(p)).own.length, 4);
    const hostile = '{"format":"glosar-bundle","version":1,"entries":[{"lang":"rup","headword":"<img src=x onerror=window.__pwned=1>","pos":"noun","gloss":{"en":"<script>window.__pwned=1</script>"},"source":"<b>s</b>","__proto__":{"polluted":1}}]}';
    eq(await gImport(p, hostile), F(I.en.m_imported, 1, 0), 'intrare cu HTML în text');
    ok(await p.evaluate(() => !window.__pwned && ({}).polluted === undefined && !document.querySelector('#gl-own img, #gl-own script, #gl-live img')), 'HTML interpretat sau prototip poluat');
    eq(await p.$$eval('#gl-own .gl-cmeta', (e) => e.some((x) => x.textContent.startsWith('<img src=x'))), true, 'textul apare literal');
    noErr(h);
    await h.ctx.close();
  });

  await T('glosar: sunetul încărcat se verifică după conținut (Opus în Ogg sau WebM), cu limita de 50 KB', async () => {
    const h = await gOpen();
    const p = h.page;
    await gTab(p, 'add');
    let m = await gUpload(p, gFix('tone.opus'));
    ok(rx(I.en.a_rec_ok, 0).test(m), m);
    ok(await p.$('#gl-play-draft'), 'butonul de ascultare');
    ok(/\(\d+ KB\)$/.test((await p.textContent('#gl-play-draft')).trim()), 'mărimea în butonul de ascultare');
    m = await gUpload(p, gFix('tone.webm'), 'x.webm');
    ok(rx(I.en.a_rec_ok, 0).test(m), m);
    for (const [name, buf] of [['tone-vorbis.ogg', gFix('tone-vorbis.ogg')], ['tone-vorbis.webm', gFix('tone-vorbis.webm')], ['fals.opus', Buffer.from('acesta nu este un fișier audio')], ['mic.opus', Buffer.from('ab')]]) {
      m = await gUpload(p, buf, name);
      eq(m, I.en.a_rec_bad, name);
    }
    m = await gUpload(p, Buffer.alloc(60000, 1), 'mare.opus');
    eq(m, F(I.en.a_rec_big, Math.ceil(60000 / 1024)), 'peste limită');
    await gUpload(p, gFix('tone.opus'));
    await p.click('#gl-rec-clear');
    eq(await p.$('#gl-play-draft'), null, 'sunetul se poate scoate din ciornă');
    eq(await p.evaluate(() => document.activeElement.id), 'gl-rec', 'focusul revine pe «Înregistrează»');
    await gUpload(p, gFix('tone.opus'));
    await gFill(p, {lang: 'rup', head: 'xsunet', en: 'sound', src: 'Test source'});
    await p.click('#gl-add');
    const st = await gStore(p);
    ok(st.own[0].audio.startsWith('data:audio/ogg;base64,'), 'sunetul se salvează cu intrarea');
    await gTab(p, 'search');
    await p.check('#gl-faudio');
    eq(await p.$$eval('#gl-list .gl-entry', (e) => e.length), 1, 'filtrul «doar cu sunet»');
    const label = await p.getAttribute('.gl-play', 'aria-label');
    eq(label, F(I.en.r_play_l, 'xsunet'), 'numele accesibil al butonului de ascultare');
    await p.click('.gl-play');
    noErr(h);
    await h.ctx.close();
  });

  await T('glosar: fără acces la microfon, aplicația spune ce se întâmplă și păstrează încărcarea de fișier', async () => {
    const h = await gOpen();
    const p = h.page;
    await gTab(p, 'add');
    if (await p.$('#gl-rec')) {
      const m = await gWait(p, () => p.click('#gl-rec'));
      ok(m === I.en.a_rec_denied || m === I.en.a_rec_none, 'mesaj neașteptat: ' + m);
      ok(await p.$('#gl-rec'), 'butonul «Înregistrează» rămâne');
      eq(await p.$('#gl-stop'), null, 'nu rămâne o înregistrare pornită');
    } else eq((await p.textContent('#gl-recnone')).trim(), I.en.a_rec_none);
    ok(await p.$('#gl-upload'), 'încărcarea de fișier rămâne');
    noErr(h);
    await h.ctx.close();
  });

  await T('glosar: înregistrare cu microfon fals — pornire, oprire, oprire automată, anulare la schimbarea filei', async () => {
    const rb = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']});
    try {
      const h = await newPage(rb, {locale: 'en-GB'});
      await h.ctx.grantPermissions(['microphone']);
      await h.ctx.addInitScript(() => {
        const md = navigator.mediaDevices, orig = md.getUserMedia.bind(md);
        window.__streams = [];
        md.getUserMedia = (c) => orig(c).then((s) => { window.__streams.push(s); return s; });
      });
      const p = h.page;
      await p.goto('file://' + appFile('glosar'));
      await p.waitForSelector(ready);
      await p.selectOption('#langsel', 'en');
      await p.waitForSelector(ready);
      const live = () => p.evaluate(() => window.__streams.filter((s) => s.getTracks().some((t) => t.readyState === 'live')).length);
      await gTab(p, 'add');
      await p.click('#gl-rec');
      await p.waitForSelector('#gl-stop');
      eq(await gLive(p), F(I.en.a_rec_busy, 8), 'mesajul din timpul înregistrării');
      eq(await live(), 1, 'microfonul e deschis');
      eq(await p.evaluate(() => document.activeElement.id), 'gl-stop', 'focusul pe «Oprește»');
      await p.waitForTimeout(700);
      await p.click('#gl-stop');
      await p.waitForSelector('#gl-play-draft');
      ok(rx(I.en.a_rec_ok, 0).test(await gLive(p)), await gLive(p));
      eq(await live(), 0, 'microfonul se eliberează după oprire');
      const kb = Number((await p.textContent('#gl-play-draft')).match(/\((\d+) KB\)/)[1]);
      ok(kb >= 1 && kb <= 50, 'mărimea înregistrării: ' + kb + ' KB');
      await gFill(p, {lang: 'rup', head: 'xvoce', en: 'voice', src: 'Test source'});
      await p.click('#gl-add');
      eq(await gLive(p), F(I.en.a_added, 'rup-xvoce'));
      const a = (await gStore(p)).own[0].audio;
      ok(/^data:audio\/webm;base64,/.test(a), 'sunetul se salvează ca WebM');
      const dl = await gDl(p, '#gl-oa-0');
      eq(dl.name, 'rup-xvoce.webm');
      ok(dl.buf.length <= 51200 && dl.buf.length > 1000 && dl.buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])), 'conținut WebM: ' + dl.buf.length + ' B');
      ok(dl.buf.includes('A_OPUS'), 'codec Opus');
      await p.click('#gl-rec');
      await p.waitForSelector('#gl-stop');
      eq(await live(), 1);
      await gTab(p, 'search');
      await p.waitForFunction(() => window.__streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended')));
      await gTab(p, 'add');
      eq(await p.$('#gl-stop'), null, 'înregistrarea s-a anulat');
      eq(await p.$('#gl-play-draft'), null, 'o înregistrare anulată nu lasă sunet în ciornă');
      noErr(h);
      await h.ctx.close();
      const hc = await newPage(rb, {locale: 'en-GB'});
      await hc.ctx.grantPermissions(['microphone']);
      await hc.page.clock.install();
      await hc.ctx.addInitScript(() => {
        const md = navigator.mediaDevices, orig = md.getUserMedia.bind(md);
        window.__streams = [];
        md.getUserMedia = (c) => orig(c).then((s) => { window.__streams.push(s); return s; });
      });
      await hc.page.goto('file://' + appFile('glosar'));
      await hc.page.waitForSelector(ready);
      await hc.page.selectOption('#langsel', 'en');
      await hc.page.waitForSelector(ready);
      await gTab(hc.page, 'add');
      await hc.page.click('#gl-rec');
      await hc.page.waitForSelector('#gl-stop');
      await hc.page.waitForTimeout(500);
      await hc.page.clock.runFor(8100);
      await hc.page.waitForSelector('#gl-play-draft');
      ok(rx(I.en.a_rec_ok, 0).test(await gLive(hc.page)), 'oprirea automată după 8 s: ' + await gLive(hc.page));
      noErr(hc);
      await hc.ctx.close();
    } finally { await rb.close(); }
  });

  await T('glosar: schimbarea limbii păstrează ciorna și fila și lasă o singură secțiune «Limite»', async () => {
    const h = await gOpen();
    const p = h.page;
    await gTab(p, 'add');
    await p.fill('#gl-head', 'xdraft');
    await p.fill('#gl-g-en', 'draft meaning');
    for (const l of LANGS.concat(['en'])) {
      await p.selectOption('#langsel', l);
      await p.waitForSelector(ready);
      eq(await p.getAttribute('#gl-t-add', 'aria-selected'), 'true', l + ': fila rămâne');
      eq(await p.inputValue('#gl-head'), 'xdraft', l + ': cuvântul din ciornă');
      eq(await p.inputValue('#gl-g-en'), 'draft meaning', l + ': sensul din ciornă');
      eq(await p.$$eval('#gl-lim-card', (e) => e.length), 1, l + ': secțiuni «Limite»');
      eq((await p.textContent('#gl-lim-h')).trim(), I[l].h_limits, l + ': titlul secțiunii');
      eq(await p.$$eval('#gl-lim-card li', (e) => e.length), 6, l + ': punctele «Limite»');
      eq((await p.textContent('#gl-lim-card li:first-child')).trim(), I[l].lim_1, l + ': primul punct');
    }
    noErr(h);
    await h.ctx.close();
  });

  await T('glosar: stare salvată ostilă — intrările invalide sunt aruncate, textul rămâne text, limitele se respectă', async () => {
    const good = '{"id":"rup-ok","lang":"rup","headword":"ok","pos":"noun","gloss":{"en":"fine"},"source":"s","status":"draft"}';
    const text = '{"v":1,"own":[' + [
      good, good,
      '{"id":"rup-xss","lang":"rup","headword":"<img src=x onerror=window.__pwned=1>","pos":"noun","gloss":{"en":"<script>window.__pwned=1</script>"},"source":"<b>s</b>","status":"draft"}',
      '{"id":"rup-pp","lang":"rup","headword":"pp","pos":"noun","gloss":{"en":"q"},"source":"s","__proto__":{"polluted":1}}',
      '{"id":"rup-pc","lang":"rup","headword":"pc","pos":"noun","gloss":{"en":"q"},"source":"s","constructor":{"prototype":{"polluted":2}}}',
      '{"id":"../../etc/passwd","lang":"rup","headword":"a","pos":"noun","gloss":{"en":"b"},"source":"s"}',
      '{"id":"__proto__","lang":"rup","headword":"a","pos":"noun","gloss":{"en":"b"},"source":"s"}',
      '{"id":"rup-zz","lang":"zz","headword":"a","pos":"noun","gloss":{"en":"b"},"source":"s"}',
      '{"id":"rup-extra","lang":"rup","headword":"a","pos":"noun","gloss":{"en":"b"},"source":"s","evil":1}',
      '{"id":"rup-audio","lang":"rup","headword":"a","pos":"noun","gloss":{"en":"b"},"source":"s","audio":"data:audio/ogg;base64,AAAA"}',
      '{"id":"rup-gl","lang":"rup","headword":"a","pos":"noun","gloss":"nu e obiect","source":"s"}',
      '{"id":"rup-ctrl","lang":"rup","headword":"a\\u0000b","pos":"noun","gloss":{"en":"b"},"source":"s"}',
      '{"id":"rup-long","lang":"rup","headword":"' + 'x'.repeat(81) + '","pos":"noun","gloss":{"en":"b"},"source":"s"}',
      'null', '5', '"text"', '[]'
    ].join(',') + '],"last":{"lang":{"a":1},"source":"' + 'y'.repeat(600) + '","status":["x"],"license":5,"__proto__":{"polluted":3}}}';
    const h = await gOpen({state: text});
    const p = h.page;
    await gTab(p, 'add');
    eq((await p.textContent('#gl-own-h')).trim(), F(I.en.m_title, 3), 'rămân doar intrările valide');
    eq((await p.$$eval('#gl-own .gl-cid', (e) => e.map((x) => x.textContent))).join(','), 'rup-ok,rup-xss,rup-pp');
    eq(await p.inputValue('#gl-src'), '', 'valorile ostile din «last» sunt ignorate');
    ok(await p.evaluate(() => !window.__pwned && ({}).polluted === undefined && !document.querySelector('#appmount img, #appmount script')), 'HTML interpretat sau prototip poluat');
    await gTab(p, 'search');
    await p.fill('#gl-q', 'img');
    eq(await p.$$eval('#gl-list .gl-word', (e) => e.map((x) => x.textContent)).then((a) => a.includes('<img src=x onerror=window.__pwned=1>')), true, 'cuvântul cu HTML apare ca text');
    await gTab(p, 'export');
    await p.selectOption('#gl-xscope', 'mine');
    eq((await p.textContent('#gl-xcount')).trim(), F(I.en.x_count, 3));
    noErr(h);
    await h.ctx.close();
    const many = Array.from({length: 520}, (_, i) => seed(i, {id: 'rup-n' + i, headword: 'n' + i}));
    const h2 = await gOpen({state: stateOf(many)});
    await gTab(h2.page, 'add');
    eq((await h2.page.textContent('#gl-own-h')).trim(), F(I.en.m_title, 500), 'cel mult 500 de intrări proprii');
    noErr(h2);
    await h2.ctx.close();
    const h3 = await gOpen({state: '{"v":1,"own":"nu e listă","last":[]}'});
    await gTab(h3.page, 'add');
    eq((await h3.page.textContent('#gl-own-h')).trim(), F(I.en.m_title, 0));
    noErr(h3);
    await h3.ctx.close();
  });

  await T('glosar: accesibilitate (axe) pe toate filele, în temele luminoasă și întunecată, cu intrări proprii și sunet', async () => {
    const state = stateOf([seed(1), seed(2, {audio: OPUS}), seed(3, {status: 'reviewed', reviewed_by: 'Test Speaker'})]);
    for (const scheme of ['light', 'dark']) {
      const h = await gOpen({scheme, state});
      const p = h.page;
      for (const l of (scheme === 'light' ? ['en', 'ro', 'de', 'hu'] : ['ro', 'en'])) {
        await p.selectOption('#langsel', l);
        await p.waitForSelector(ready);
        for (const id of TABS) {
          await gTab(p, id);
          if (id === 'search') await p.fill('#gl-q', 's');
          if (id === 'add') { await p.click('#gl-add'); await p.click('#gl-bcheck'); }
          const v = await axe(p);
          ok(v.length === 0, scheme + '/' + l + '/' + id + ': ' + JSON.stringify(v));
        }
      }
      noErr(h);
      await h.ctx.close();
    }
  });

  await T('glosar: pe mobil (360 px) fiecare filă încape fără defilare orizontală a paginii', async () => {
    const state = stateOf([seed(1), seed(2, {audio: OPUS})]);
    const h = await gOpen({w: 360, h: 740, state});
    const p = h.page;
    for (const l of ['ro', 'de', 'hu']) {
      await p.selectOption('#langsel', l);
      await p.waitForSelector(ready);
      for (const id of TABS) {
        await gTab(p, id);
        const w = await p.evaluate(() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth}));
        ok(w.sw <= w.iw + 1, l + '/' + id + ': scrollWidth ' + w.sw + ' > ' + w.iw);
      }
    }
    noErr(h);
    await h.ctx.close();
  });

  await browser.close();
} else {
  console.log('omis: glosar (nu există ' + path.relative(HUB, appFile('glosar')) + ')');
  skipped.add('glosar');
}

/* ================= GRAIUL ================= */
if (present('graiul')) {
  const ready = '#appmount .gr-root';
  const KEY = 'graiul.state';
  const RAW = /\b(?:tab|t|st|cn|gd|issue|b|a|s|d|m|x|e|i|lim)_[a-z0-9_]{2,}\b/;
  const GDIR = path.join(ROOT, 'graiul');
  const gJson = (f) => JSON.parse(fs.readFileSync(path.join(GDIR, f), 'utf8'));
  const GIT = fs.readdirSync(path.join(GDIR, 'data', 'items')).filter((f) => f.endsWith('.json') && f !== 'example.json').sort()
    .map((f) => Object.assign(gJson('data/items/' + f), {id: f.replace(/\.json$/, '')}));
  const GC = gJson('data/counties.json').counties;
  const GEN = await import(pathToFileURL(path.join(GDIR, 'src', 'engine.mjs')).href);
  const I = (await import(pathToFileURL(path.join(GDIR, 'src', 'i18n.mjs')).href)).default;
  const F = (s, ...a) => s.replace(/\{(\d)\}/g, (m, i) => String(a[Number(i)]));
  const norm = (v) => Array.isArray(v) ? v.map(norm) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])])) : v;
  const same = (a, b, m) => eq(JSON.stringify(norm(a)), JSON.stringify(norm(b)), m);
  const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const TABS = ['search', 'today', 'map', 'add', 'export', 'guide'];
  const NAME = (code) => GC.find((c) => c.code === code).name;
  const WORDS = (n) => { let s = ((n + 1) * 2654435761) >>> 0, w = ''; for (let i = 0; i < 24; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; w += 'abcdefghijklmnopqrstuvwxyz'[(s >>> 16) % 26]; } return w; };
  const seed = (n, extra) => Object.assign({id: 'ro-seed-' + n, type: 'proverb', lang: 'ro', text: 'Intrare de probă ' + WORDS(n), region: 'unlocated', source: 'Seed source', status: 'draft'}, extra || {});
  const RIDDLE = {id: 'ro-ghicitoare-de-proba', type: 'riddle', lang: 'ro', text: 'Ghicitoare de probă: ce are dinți și nu mușcă?', answer: 'Pieptenele', region: 'Moldova', county: 'RO-IS', source: 'Seed source', status: 'draft'};
  const CHARM = {id: 'ro-descantec-de-proba', type: 'charm', lang: 'ro', text: 'Descântec de probă, fără nicio putere', purpose: 'doar pentru test', consent: 'informed', collector: 'T. T.', region: 'Muntenia', county: 'RO-B', source: 'Seed source', status: 'draft'};
  const REV = {id: 'ro-proverb-revizuit', type: 'proverb', lang: 'ro', text: 'Proverb revizuit de probă', translations: {en: 'A reviewed test proverb', fr: 'Un proverbe de test'}, notes: 'Notă de probă', region: 'Moldova', county: 'RO-IS', source: 'Seed source', source_url: 'https://example.org/sursa', license: 'CC0-1.0', status: 'reviewed', reviewed_by: 'Test Reviewer'};
  const RICH = [RIDDLE, CHARM, REV];
  const stateOf = (list, last) => JSON.stringify({v: 1, own: list, last: last || {}});
  const potdOf = (date) => {   // proverbul zilei după scriptul din depozit: altă cale de cod decât pagina
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graiul-potd-'));
    try {
      const r = spawnSync(process.execPath, [path.join(GDIR, 'scripts', 'potd.mjs'), '--date', date, '--out', dir, '--json'], {encoding: 'utf8'});
      if (r.status !== 0) throw new Error(r.stderr);
      return JSON.parse(fs.readFileSync(path.join(dir, 'potd.json'), 'utf8'));
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
  };

  async function gOpen(o = {}) {
    const h = await open('graiul', Object.assign({locale: 'en-GB', stateKey: KEY}, o));
    await h.page.waitForSelector(ready);
    await h.page.selectOption('#langsel', 'en');
    await h.page.waitForSelector(ready);
    return h;
  }
  const gTab = async (p, id) => { await p.click('#gr-tt-' + id); await p.waitForSelector('#gr-p-' + id + ':not([hidden])'); };
  const gLive = async (p) => (await p.$eval('#gr-live', (e) => (e.querySelector('p') || e).textContent)).trim();
  const gLines = (p) => p.$$eval('#gr-live li', (e) => e.map((x) => x.textContent));
  const gStore = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
  const gActive = (p) => p.evaluate(() => document.activeElement && document.activeElement.id);
  const gDl = async (p, sel) => {
    const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]);
    return {name: d.suggestedFilename(), buf: fs.readFileSync(await d.path())};
  };
  async function gWait(p, act) {   // așteaptă un mesaj nou în zona «live» după o acțiune (și după o citire de fișier, care e asincronă)
    await p.evaluate(() => { document.getElementById('gr-live').textContent = ''; });
    await act();
    await p.waitForFunction(() => document.getElementById('gr-live').textContent.trim() !== '');
    return gLive(p);
  }
  const gImport = (p, buffer, name) => gWait(p, () => p.setInputFiles('#gr-x-file', {name: name || 'x.json', mimeType: 'application/json', buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer))}));
  const gSet = (p, sel, v) => p.evaluate(([s, x]) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', {bubbles: true})); }, [sel, v]);
  const gIssues = (p) => p.$$eval('#gr-chk li', (e) => e.map((x) => x.textContent));
  const gOwn = (p) => p.$$eval('.gr-own-box .gr-cid', (e) => e.map((x) => x.textContent));
  const gOwnH = async (p) => (await p.textContent('#gr-own-h')).trim();
  const gTexts = (p) => p.$$eval('#gr-list .gr-text', (e) => e.map((x) => x.textContent));
  const gCount = async (p) => (await p.textContent('#gr-count')).trim();
  const want = (n) => (n ? F(I.en.s_count, n) : I.en.s_none);
  const noOwn = (e) => { const c = Object.assign({}, e); delete c.id; return c; };

  browser = await launch();
  await baseline('graiul', {ready, stateKey: KEY, rawKey: RAW});

  await T('graiul: cele șase file se deschid în toate limbile, fără chei netraduse sau text invalid', async () => {
    const h = await gOpen({state: stateOf(RICH)});
    const p = h.page;
    for (const l of LANGS) {
      await p.selectOption('#langsel', l);
      await p.waitForSelector(ready);
      for (const id of TABS) {
        await gTab(p, id);
        eq(await p.getAttribute('#gr-tt-' + id, 'aria-selected'), 'true', l + '/' + id + ': aria-selected');
        eq((await p.textContent('#gr-tt-' + id)).trim(), I[l]['tab_' + id], l + '/' + id + ': eticheta filei');
        eq(await p.$$eval('.gr-tab[aria-selected="true"]', (e) => e.length), 1, l + '/' + id + ': file selectate');
        eq(await p.$$eval('.gr-panel:not([hidden])', (e) => e.length), 1, l + '/' + id + ': panouri vizibile');
        const text = await p.innerText('#gr-p-' + id);
        ok(text.length > 40, l + '/' + id + ': panou gol');
        const raw = text.match(RAW) || text.match(RAW_KEY);
        ok(!raw, l + '/' + id + ': cheie netradusă «' + (raw && raw[0]) + '»');
        const bad = text.match(BAD_TEXT);
        ok(!bad, l + '/' + id + ': text invalid «' + (bad && bad[0]) + '»');
      }
    }
    noErr(h);
    await h.ctx.close();
  });

  await T('graiul: filele răspund la săgeți, Home și End, cu focusul pe fila nouă', async () => {
    const h = await gOpen();
    const p = h.page;
    await p.focus('#gr-tt-search');
    for (const [key, want2] of [['ArrowRight', 'today'], ['ArrowRight', 'map'], ['End', 'guide'], ['ArrowRight', 'search'], ['ArrowLeft', 'guide'], ['Home', 'search'], ['ArrowLeft', 'guide'], ['ArrowLeft', 'export']]) {
      await p.keyboard.press(key);
      eq(await gActive(p), 'gr-tt-' + want2, key + ': focus');
      eq(await p.getAttribute('#gr-tt-' + want2, 'aria-selected'), 'true', key + ': fila selectată');
      eq(await p.$$eval('.gr-tab[tabindex="0"]', (e) => e.length), 1, key + ': o singură filă în ordinea Tab');
      eq(await p.$$eval('.gr-panel:not([hidden])', (e) => e.length), 1, key + ': panouri vizibile');
    }
    eq(await p.getAttribute('.gr-tabs', 'role'), 'tablist');
    eq(await p.getAttribute('.gr-tabs', 'aria-label'), I.en.nav);
    for (const id of TABS) {
      eq(await p.getAttribute('#gr-tt-' + id, 'aria-controls'), 'gr-p-' + id);
      eq(await p.getAttribute('#gr-p-' + id, 'aria-labelledby'), 'gr-tt-' + id);
      eq(await p.getAttribute('#gr-p-' + id, 'role'), 'tabpanel');
    }
    noErr(h);
    await h.ctx.close();
  });

  await T('graiul: căutarea ignoră diacriticele, caută și în traduceri, filtrează și nu interpretează HTML', async () => {
    const h = await gOpen();
    const p = h.page;
    eq(await gCount(p), want(GIT.length), 'fără interogare se arată tot');
    eq((await gTexts(p)).slice().sort().join('|'), GIT.map((e) => e.text).sort().join('|'), 'toate proverbele, cu textul întreg');
    const dia = GIT.find((e) => /[ăâîșț]/.test(e.text));
    ok(dia, 'datele nu au niciun text cu diacritice');
    for (const q of [strip(dia.text), dia.text.toUpperCase(), dia.text, dia.text.slice(0, 12)]) {
      await p.fill('#gr-q', q);
      ok((await gTexts(p)).includes(dia.text), '«' + q + '» nu găsește «' + dia.text + '»');
    }
    const tr = GIT.find((e) => e.translations && e.translations.en);
    ok(tr, 'datele nu au nicio traducere în engleză');
    await p.fill('#gr-q', tr.translations.en);
    ok((await gTexts(p)).includes(tr.text), 'traducerea «' + tr.translations.en + '» nu găsește proverbul');
    await p.fill('#gr-q', 'zzzzqx');
    eq(await gCount(p), I.en.s_none);
    eq(await p.$('#gr-list'), null, 'lista dispare când nu sunt rezultate');
    await p.fill('#gr-q', '<img src=x onerror=window.__pwned=1>');
    eq(await gCount(p), I.en.s_none);
    ok(await p.evaluate(() => !window.__pwned && !document.querySelector('#gr-results img')), 'interogarea a fost interpretată ca HTML');
    await p.fill('#gr-q', '');
    await p.locator('#gr-q').pressSequentially('x'.repeat(120));
    eq((await p.inputValue('#gr-q')).length, 100, 'lungimea maximă a interogării');
    await p.fill('#gr-q', '');
    for (const t of GEN.TYPES) {
      await p.selectOption('#gr-ftype', t);
      eq(await gCount(p), want(GIT.filter((e) => e.type === t).length), 'tip ' + t);
    }
    await p.selectOption('#gr-ftype', 'all');
    eq(await p.$$eval('#gr-flang option', (o) => o.map((x) => x.value).join(',')), 'all,ro', 'limbile din colecție');
    await p.selectOption('#gr-flang', 'ro');
    eq(await gCount(p), want(GIT.filter((e) => e.lang === 'ro').length), 'limba ro');
    await p.selectOption('#gr-flang', 'all');
    eq(await p.$$eval('#gr-fregion option', (o) => o.map((x) => x.value).join(',')), 'all,unlocated', 'regiunile din colecție');
    eq(await p.$$eval('#gr-fregion option', (o) => o[1].textContent), I.en.s_unlocated, 'eticheta «loc nenotat»');
    await p.selectOption('#gr-fregion', 'unlocated');
    eq(await gCount(p), want(GIT.length), 'regiune nenotată');
    await p.selectOption('#gr-fregion', 'all');
    eq(await p.$$eval('#gr-fcounty option', (o) => o.length), GC.length + 1, 'județele din listă');
    await p.selectOption('#gr-fcounty', 'RO-B');
    eq(await gCount(p), I.en.s_none, 'nicio intrare de pornire nu are județ');
    await p.selectOption('#gr-fcounty', '');
    await p.selectOption('#gr-fstatus', 'sourced');
    eq(await gCount(p), want(GIT.filter((e) => e.status === 'sourced' || e.status === 'reviewed').length), 'cu sursă sau revizuite');
    await p.selectOption('#gr-fstatus', 'reviewed');
    eq(await gCount(p), want(GIT.filter((e) => e.status === 'reviewed').length), 'doar revizuite');
    await p.selectOption('#gr-fstatus', 'any');
    const links = await p.$$eval('#gr-list .gr-src a', (a) => a.map((x) => [x.getAttribute('href'), x.rel, x.target]));
    eq(links.length, GIT.filter((e) => e.source_url).length, 'câte un link pentru fiecare sursă cu adresă');
    ok(links.every((x) => /^https:\/\//.test(x[0]) && /noopener/.test(x[1]) && x[2] === '_blank'), JSON.stringify(links.slice(0, 3)));
    for (const e of GIT) {
      const s = await p.textContent('#gr-i-' + e.id + ' .gr-src');
      ok(s.includes(I.en.s_src + ': ' + e.source) && (!e.license || s.includes(I.en.s_lic + ': ' + e.license)), e.id + ': ' + s);
    }
    const meta = await p.$eval('#gr-i-' + GIT[0].id + ' .gr-meta', (m) => m.textContent);
    ok(meta.includes(I.en.t_proverb) && meta.includes('română (ro)') && meta.includes(I.en.s_unlocated) && meta.includes(I.en.st_sourced), meta);
    ok((await p.textContent('#gr-i-' + tr.id + ' .gr-tr')).includes(I.en.s_tr + ' (en): ' + tr.translations.en), 'traducerea se vede în fișă');
    noErr(h);
    await h.ctx.close();
  });

  await T('graiul: lista arată 30 de rezultate, apoi «mai multe», cu focus pe primul rezultat nou, și revine la 30 la o căutare nouă', async () => {
    const list = Array.from({length: 35}, (_, i) => seed(i));
    const h = await gOpen({state: stateOf(list)});
    const p = h.page;
    const total = GIT.length + 35;
    eq(await gCount(p), want(total));
    eq(await p.$$eval('#gr-list .gr-item', (e) => e.length), 30, 'prima pagină');
    eq((await p.textContent('#gr-more')).trim(), F(I.en.s_more, total - 30));
    await p.click('#gr-more');
    const ids = await p.$$eval('#gr-list .gr-item', (e) => e.map((x) => x.id));
    eq(ids.length, total, 'toate după «mai multe»');
    eq(await gActive(p), ids[30], 'focusul pe primul rezultat nou');
    eq(await p.$('#gr-more'), null, 'butonul dispare când s-au arătat toate');
    eq(await p.$$eval('#gr-list .gr-yours', (e) => e.length), 35, 'intrările tale sunt marcate');
    eq((await p.textContent('#gr-list .gr-yours .gr-own')).trim(), I.en.s_yours);
    await p.fill('#gr-q', 'Intrare de probă');
    eq(await gCount(p), want(35));
    eq(await p.$$eval('#gr-list .gr-item', (e) => e.length), 30, 'o căutare nouă începe iar de la prima pagină');
    eq((await p.textContent('#gr-more')).trim(), F(I.en.s_more, 5));
    noErr(h);
    await h.ctx.close();
  });

  await T('graiul: răspunsul la ghicitoare se arată la cerere (aria-expanded) și rămâne ales; descântecul poartă nota și acordul; fișa arată sursa, traducerile și numele cine a revizuit', async () => {
    const h = await gOpen({state: stateOf(RICH)});
    const p = h.page;
    await p.fill('#gr-q', 'ghicitoare');
    eq(await p.$$eval('#gr-list .gr-item', (e) => e.length), 1);
    const btn = '#gr-i-' + RIDDLE.id + ' .gr-reveal', ans = '#gr-ans-' + RIDDLE.id;
    eq(await p.getAttribute(btn, 'aria-expanded'), 'false');
    eq((await p.textContent(btn)).trim(), I.en.s_reveal);
    eq(await p.getAttribute(btn, 'aria-controls'), 'gr-ans-' + RIDDLE.id);
    ok(await p.$eval(ans, (e) => e.hidden), 'răspunsul e ascuns');
    ok(!(await p.innerText('#gr-list')).includes(RIDDLE.answer), 'răspunsul se vede înainte să fie cerut');
    await p.click(btn);
    eq(await p.getAttribute(btn, 'aria-expanded'), 'true');
    eq((await p.textContent(btn)).trim(), I.en.s_hide);
    ok(await p.isVisible(ans), 'răspunsul se vede');
    eq((await p.innerText(ans)).trim(), I.en.s_answer + ': ' + RIDDLE.answer);
    await p.fill('#gr-q', 'ghicitoare de');
    eq(await p.getAttribute(btn, 'aria-expanded'), 'true', 'după o căutare nouă');
    await p.selectOption('#langsel', 'ro');
    await p.waitForSelector(ready);
    eq(await p.getAttribute(btn, 'aria-expanded'), 'true', 'după schimbarea limbii');
    eq((await p.textContent(btn)).trim(), I.ro.s_hide);
    await p.click(btn);
    eq(await p.getAttribute(btn, 'aria-expanded'), 'false');
    eq((await p.textContent(btn)).trim(), I.ro.s_reveal);
    ok(await p.$eval(ans, (e) => e.hidden), 'răspunsul se ascunde la loc');
    await p.selectOption('#langsel', 'en');
    await p.waitForSelector(ready);
    await p.fill('#gr-q', 'descantec');
    const c = '#gr-i-' + CHARM.id;
    eq((await p.textContent(c + ' .gr-purpose')).trim(), I.en.s_purpose + ': ' + CHARM.purpose);
    eq((await p.textContent(c + ' .gr-note')).trim(), I.en.s_charm_note);
    const cs = (await p.textContent(c + ' .gr-src')).trim();
    ok(cs.includes(I.en.s_consent + ': ' + I.en.cn_informed) && cs.includes(F(I.en.s_by, CHARM.collector)), cs);
    ok((await p.textContent(c + ' .gr-meta')).includes('Muntenia · ' + NAME('RO-B')), 'regiunea și județul în fișă');
    await p.fill('#gr-q', 'revizuit');
    const r = '#gr-i-' + REV.id;
    eq((await p.textContent(r + ' .gr-st-reviewed')).trim(), I.en.st_reviewed + ' · ' + REV.reviewed_by);
    eq((await p.$$eval(r + ' .gr-tr', (e) => e.map((x) => x.textContent))).join('|'), [I.en.s_tr + ' (en): ' + REV.translations.en, I.en.s_tr + ' (fr): ' + REV.translations.fr].join('|'), 'traducerile, limba paginii întâi');
    eq((await p.textContent(r + ' .gr-notes')).trim(), I.en.s_notes + ': ' + REV.notes);
    eq(await p.getAttribute(r + ' .gr-src a', 'href'), REV.source_url);
    ok((await p.textContent(r + ' .gr-src a')).includes(REV.source) && (await p.textContent(r + ' .gr-src a')).includes(I.en.s_newtab), 'numele legăturii');
    ok((await p.textContent(r + ' .gr-meta')).includes('Moldova · ' + NAME('RO-IS')), 'regiunea și județul în fișă');
    await p.selectOption('#langsel', 'fr');
    await p.waitForSelector(ready);
    eq((await p.$$eval(r + ' .gr-tr', (e) => e.map((x) => x.textContent))).join('|'), [I.fr.s_tr + ' (fr): ' + REV.translations.fr, I.fr.s_tr + ' (en): ' + REV.translations.en].join('|'), 'limba paginii trece prima');
    noErr(h);
    await h.ctx.close();
  });

  await T('graiul: proverbul zilei depinde doar de dată, e același cu cel din potd.mjs, ciclul se repetă și datele greșite sunt refuzate', async () => {
    const own = Array.from({length: 35}, (_, i) => seed(i));
    for (const state of [undefined, stateOf(own)]) {
      const h = await gOpen(state === undefined ? {} : {state});
      const p = h.page;
      await p.clock.setFixedTime(new Date('2026-11-17T12:00:00Z'));
      await gTab(p, 'today');
      const shown = async () => (await p.textContent('#gr-potd .gr-text')).trim();
      eq(await p.inputValue('#gr-date'), '2026-11-17', 'data de azi, din ceas');
      eq(await shown(), potdOf('2026-11-17').text, 'proverbul de azi' + (state ? ' (cu intrări proprii)' : ''));
      eq(await p.$$eval('#gr-potd .gr-item', (e) => e.length), 1);
      const seen = [];
      for (let i = 0; i < GIT.length; i++) { seen.push(await shown()); await p.click('#gr-next'); }
      eq(new Set(seen).size, GIT.length, 'zece zile la rând, zece proverbe diferite');
      eq(await shown(), seen[0], 'după zece zile ciclul se repetă');
      eq(await p.inputValue('#gr-date'), '2026-11-27', 'butonul «ziua următoare»');
      eq(await shown(), potdOf('2026-11-27').text);
      await p.click('#gr-prev');
      eq(await p.inputValue('#gr-date'), '2026-11-26', 'butonul «ziua precedentă»');
      eq(await shown(), potdOf('2026-11-26').text);
      for (const d of ['2027-02-28', '2028-02-29', '2026-12-31', '2027-01-01']) {
        await p.fill('#gr-date', d);
        eq(await shown(), potdOf(d).text, 'data scrisă ' + d);
      }
      await p.fill('#gr-date', '');
      eq(await gLive(p), I.en.d_bad, 'dată goală');
      eq(await shown(), potdOf('2027-01-01').text, 'proverbul nu se schimbă la o dată greșită');
      await p.click('#gr-today');
      eq(await p.inputValue('#gr-date'), '2026-11-17', 'butonul «azi»');
      eq(await gLive(p), '', 'mesajul de eroare dispare');
      eq(await shown(), potdOf('2026-11-17').text);
      await p.fill('#gr-date', '0001-01-01');
      await p.click('#gr-prev');
      eq(await p.inputValue('#gr-date'), '0001-01-01', 'nu se trece sub anul 1');
      eq(await shown(), potdOf('0001-01-01').text);
      await p.fill('#gr-date', '9999-12-31');
      await p.click('#gr-next');
      eq(await p.inputValue('#gr-date'), '9999-12-31', 'nu se trece peste anul 9999');
      eq(await shown(), potdOf('9999-12-31').text);
      await gTab(p, 'search');
      await gTab(p, 'today');
      eq(await p.inputValue('#gr-date'), '9999-12-31', 'data rămâne după schimbarea filei');
      noErr(h);
      await h.ctx.close();
    }
  });

  await T('graiul: harta schematică numără din datele reale, filtrează căutarea și se golește fără a pierde focusul', async () => {
    const h0 = await gOpen();
    const p0 = h0.page;
    await gTab(p0, 'map');
    eq(await p0.$$eval('#gr-grid .gr-tile', (e) => e.length), GC.length, 'plăci');
    for (const c of GC) {
      eq((await p0.textContent('#gr-t-' + c.code + ' .gr-tn')).trim(), c.name, c.code + ': numele');
      eq((await p0.textContent('#gr-t-' + c.code + ' .gr-tk')).trim(), '0', c.code + ': numărul');
      eq(await p0.getAttribute('#gr-t-' + c.code, 'aria-pressed'), 'false', c.code + ': aria-pressed');
    }
    eq((await p0.textContent('#gr-nocounty')).trim(), F(I.en.m_nocounty, GIT.length, GIT.length), 'intrările fără județ');
    eq(await p0.$('#gr-allc'), null, 'fără județ ales nu apare «toate județele»');
    ok(await p0.$$eval('#gr-grid .gr-tile', (t) => t.every((x) => (x.textContent || '').trim().length > 3)), 'plăci fără nume accesibil');
    noErr(h0);
    await h0.ctx.close();
    const list = [RIDDLE, CHARM, REV, seed(1, {county: 'RO-IS', region: 'Moldova'})];
    const h = await gOpen({state: stateOf(list)});
    const p = h.page;
    await gTab(p, 'map');
    const total = GIT.length + 4;
    eq((await p.textContent('#gr-nocounty')).trim(), F(I.en.m_nocounty, total - 4, total));
    eq((await p.textContent('#gr-t-RO-IS .gr-tk')).trim(), '3', 'Iași');
    eq((await p.textContent('#gr-t-RO-B .gr-tk')).trim(), '1', 'București');
    eq((await p.textContent('#gr-t-RO-IS .gr-sr')).trim(), F(I.en.m_cnt, 3), 'textul pentru cititoarele de ecran');
    eq(await p.$$eval('#gr-grid .gr-tile.gr-d0', (e) => e.length), GC.length - 2, 'plăcile goale');
    await p.click('#gr-t-RO-IS');
    eq(await p.getAttribute('#gr-tt-search', 'aria-selected'), 'true', 'se trece la căutare');
    eq(await p.inputValue('#gr-fcounty'), 'RO-IS');
    eq(await gCount(p), want(3), 'intrările județului');
    eq(await gActive(p), 'gr-results', 'focusul pe rezultate');
    ok((await gTexts(p)).includes(RIDDLE.text) && (await gTexts(p)).includes(REV.text), 'intrările din Iași');
    await gTab(p, 'map');
    eq(await p.getAttribute('#gr-t-RO-IS', 'aria-pressed'), 'true');
    ok(await p.$eval('#gr-t-RO-IS', (e) => e.classList.contains('gr-on')));
    eq((await p.textContent('.gr-sel')).trim(), F(I.en.m_sel, NAME('RO-IS')));
    eq((await p.textContent('#gr-allc')).trim(), I.en.m_all);
    await p.click('#gr-t-RO-IS');
    eq(await p.$('#gr-allc'), null, 'a doua apăsare golește alegerea');
    eq(await gActive(p), 'gr-t-RO-IS', 'focusul rămâne pe placă');
    await p.click('#gr-t-RO-B');
    eq(await p.inputValue('#gr-fcounty'), 'RO-B');
    eq(await gCount(p), want(1));
    await gTab(p, 'map');
    await p.click('#gr-allc');
    eq(await p.$('#gr-allc'), null);
    eq(await gActive(p), 'gr-t-RO-B', 'după «toate județele» focusul trece pe placa golită');
    await gTab(p, 'search');
    eq(await p.inputValue('#gr-fcounty'), '', 'filtrul de județ e gol');
    eq(await gCount(p), want(total));
    noErr(h);
    await h.ctx.close();
  });

  await T('graiul: adăugarea validează, refuză dublurile, cere confirmare pentru cele aproape identice, păstrează valorile și salvează în browser', async () => {
    const h = await gOpen();
    const p = h.page;
    await gTab(p, 'add');
    await p.click('#gr-add');
    eq((await p.textContent('#gr-chk .gr-bad')).trim(), I.en.a_issues);
    eq((await gIssues(p)).join('|'), [F(I.en.issue_text, 20000), F(I.en.issue_source, 300)].join('|'), 'formular gol');
    eq(await gOwnH(p), F(I.en.a_own_h, 0));
    ok((await p.innerText('.gr-own-box')).includes(I.en.a_own_none), 'mesajul «nimic adăugat»');
    eq(await gStore(p), null, 'nimic nu se salvează dintr-un formular gol');
    const T1 = 'Ce-i în mână nu-i minciună, zice bătrânul xz';
    const ID1 = 'ro-ce-i-in-mana-nu-i-minciuna-zice-batranul-xz';
    eq(GEN.itemId('ro', T1), ID1, 'regula identificatorului');
    await p.fill('#gr-a-text', T1);
    await p.fill('#gr-a-source', 'Test source');
    await p.click('#gr-check');
    eq((await p.textContent('#gr-chk .gr-ok')).trim(), I.en.check_ok);
    eq(await gOwnH(p), F(I.en.a_own_h, 0), 'verificarea nu adaugă');
    await p.fill('#gr-a-lang', 'RO');
    await p.click('#gr-check');
    eq((await gIssues(p)).join('|'), I.en.issue_lang, 'cod de limbă cu majuscule');
    await p.fill('#gr-a-lang', 'ro');
    await p.press('#gr-a-source', 'Enter');
    eq(await gLive(p), F(I.en.a_added, 1), 'Enter în formular adaugă');
    eq((await gOwn(p)).join(','), ID1);
    eq(await gOwnH(p), F(I.en.a_own_h, 1));
    eq((await p.textContent('.gr-own-box .gr-cmeta')).trim(), '· ' + I.en.t_proverb + ' · ' + T1);
    eq(await p.inputValue('#gr-a-text'), '', 'textul se golește');
    eq(await p.inputValue('#gr-a-source'), 'Test source', 'sursa se păstrează pentru intrarea următoare');
    eq(await p.inputValue('#gr-a-lang'), 'ro');
    eq(await gActive(p), 'gr-a-text', 'focusul revine pe text');
    let st = await gStore(p);
    eq(st.v, 1);
    same(st.own, [{id: ID1, type: 'proverb', lang: 'ro', text: T1, region: 'unlocated', source: 'Test source', status: 'draft'}], 'intrarea salvată');
    eq(st.last.source, 'Test source');
    eq(st.last.lang, 'ro');
    await p.fill('#gr-a-text', 'CE-I ÎN MÂNĂ NU-I MINCIUNĂ, zice bătrânul xz!');
    await p.click('#gr-add');
    eq((await gIssues(p)).join('|'), F(I.en.dup_exact, T1), 'dublură exactă (alte litere, alte semne)');
    eq(await p.$('#gr-add-any'), null, 'o dublură exactă nu se adaugă nici cu confirmare');
    eq(await gOwnH(p), F(I.en.a_own_h, 1));
    await p.fill('#gr-a-text', T1 + 'z');
    await p.click('#gr-add');
    const near = await gIssues(p);
    eq(near.length, 1);
    const m = near[0].match(/^Very similar \((\d+)%\): (.*)$/);
    ok(m && m[2] === T1 && +m[1] >= 85 && +m[1] <= 99, near[0]);
    eq((await p.textContent('#gr-chk .gr-hint')).trim(), I.en.dup_hint);
    eq((await p.textContent('#gr-add-any')).trim(), I.en.a_add_any);
    eq(await gOwnH(p), F(I.en.a_own_h, 1), 'nu s-a adăugat încă');
    await p.click('#gr-add');
    eq(await gOwnH(p), F(I.en.a_own_h, 1), 'a doua apăsare pe «Adaugă» nu ocolește confirmarea');
    await p.click('#gr-add-any');
    eq(await gLive(p), F(I.en.a_added, 2));
    eq((await gOwn(p)).join(','), ID1 + ',' + GEN.itemId('ro', T1 + 'z'));
    const built = GIT.find((e) => e.id === 'ro-asteapta-murgule-sa-pasti-iarba-verde');
    await p.fill('#gr-a-text', 'asteapta murgule, sa pasti iarba verde');
    await p.click('#gr-add');
    eq((await gIssues(p)).join('|'), F(I.en.dup_exact, built.text), 'dublură față de colecția din pagină');
    await p.selectOption('#gr-a-type', 'riddle');
    eq(await gActive(p), 'gr-a-type', 'focusul rămâne pe tip');
    ok((await p.$('#gr-a-answer')) && !(await p.$('#gr-a-purpose')), 'câmpul «răspuns»');
    eq(await p.inputValue('#gr-a-text'), 'asteapta murgule, sa pasti iarba verde', 'textul din ciornă rămâne');
    await p.fill('#gr-a-text', 'Ghicitoare xq: are dinți și nu mușcă, ce e?');
    await p.click('#gr-check');
    eq((await gIssues(p)).join('|'), I.en.issue_answer, 'ghicitoare fără răspuns');
    await p.fill('#gr-a-answer', 'pieptenele');
    await p.click('#gr-add');
    eq(await gLive(p), F(I.en.a_added, 3));
    eq(await p.inputValue('#gr-a-type'), 'riddle', 'tipul se păstrează');
    eq(await p.inputValue('#gr-a-answer'), '', 'răspunsul se golește');
    await p.selectOption('#gr-a-type', 'charm');
    ok((await p.$('#gr-a-purpose')) && !(await p.$('#gr-a-answer')), 'câmpul «scop»');
    await p.fill('#gr-a-text', 'Descântec xq pentru încercare');
    await p.fill('#gr-a-purpose', 'doar de probă');
    await p.click('#gr-check');
    eq((await gIssues(p)).join('|'), I.en.issue_consent, 'descântec fără acord');
    await p.selectOption('#gr-a-consent', 'informed');
    await p.click('#gr-check');
    eq((await p.textContent('#gr-chk .gr-ok')).trim(), I.en.check_ok);
    await p.click('#gr-add');
    eq(await gLive(p), F(I.en.a_added, 4));
    await p.click('#gr-more-d summary');
    ok(await p.$eval('#gr-more-d', (d) => d.open), 'detaliile se deschid');
    await p.selectOption('#gr-a-type', 'proverb');
    ok(await p.$eval('#gr-more-d', (d) => d.open), 'detaliile rămân deschise după schimbarea tipului');
    const T4 = 'Zicală xq cu toate câmpurile';
    await p.fill('#gr-a-text', T4);
    await p.fill('#gr-a-region', 'Moldova');
    await p.selectOption('#gr-a-county', 'RO-IS');
    await p.fill('#gr-a-tr', 'fr: Traduction de test\nen: Test translation');
    await p.fill('#gr-a-notes', 'Notă de test');
    await p.fill('#gr-a-url', 'http://nu-este-https.example/x');
    await p.selectOption('#gr-a-lic', 'CC0-1.0');
    await p.fill('#gr-a-collector', 'T. T.');
    await p.selectOption('#gr-a-consent', 'published');
    await p.selectOption('#gr-a-status', 'reviewed');
    eq(await gActive(p), 'gr-a-status', 'focusul rămâne pe fiabilitate');
    ok(await p.$('#gr-a-rev'), 'câmpul «revizuit de»');
    await p.click('#gr-check');
    eq((await gIssues(p)).join('|'), [I.en.issue_source_url, I.en.issue_reviewed_by].join('|'));
    await p.fill('#gr-a-url', 'https://example.org/sursa');
    await p.fill('#gr-a-rev', 'Rev. Name');
    await p.fill('#gr-a-tr', 'fără două puncte');
    await p.click('#gr-check');
    eq((await gIssues(p)).join('|'), F(I.en.issue_translations, 12), 'traducere fără cod de limbă');
    await p.fill('#gr-a-tr', 'fr: Traduction de test\nen: Test translation');
    await p.click('#gr-check');
    eq((await p.textContent('#gr-chk .gr-ok')).trim(), I.en.check_ok);
    await p.click('#gr-add');
    eq(await gLive(p), F(I.en.a_added, 5));
    st = await gStore(p);
    same(st.own[4], {id: GEN.itemId('ro', T4), type: 'proverb', lang: 'ro', text: T4, region: 'Moldova', county: 'RO-IS', translations: {en: 'Test translation', fr: 'Traduction de test'}, notes: 'Notă de test', collector: 'T. T.', consent: 'published', source: 'Test source', source_url: 'https://example.org/sursa', license: 'CC0-1.0', status: 'reviewed', reviewed_by: 'Rev. Name'}, 'intrarea cu toate câmpurile');
    for (const [id, v] of [['gr-a-region', 'Moldova'], ['gr-a-county', 'RO-IS'], ['gr-a-consent', 'published'], ['gr-a-status', 'reviewed'], ['gr-a-rev', 'Rev. Name'], ['gr-a-url', 'https://example.org/sursa'], ['gr-a-collector', 'T. T.'], ['gr-a-lic', 'CC0-1.0'], ['gr-a-source', 'Test source']]) eq(await p.inputValue('#' + id), v, 'se păstrează ' + id);
    eq(await p.inputValue('#gr-a-tr'), '', 'traducerile se golesc');
    eq(await p.inputValue('#gr-a-notes'), '', 'notele se golesc');
    await p.click('#gr-reset');
    eq(await p.inputValue('#gr-a-text'), '');
    eq(await gActive(p), 'gr-a-text');
    await p.reload();
    await p.waitForSelector(ready);
    await p.selectOption('#langsel', 'en');
    await p.waitForSelector(ready);
    await p.fill('#gr-q', 'xq');
    eq(await gCount(p), want(3), 'după reîncărcare');
    eq(await p.$$eval('#gr-list .gr-yours', (e) => e.length), 3, 'insigna «intrarea ta»');
    ok((await p.$$eval('#gr-fregion option', (o) => o.map((x) => x.value))).includes('Moldova'), 'regiunea nouă apare în filtru');
    await gTab(p, 'add');
    eq(await p.inputValue('#gr-a-source'), 'Test source', 'sursa se păstrează și după reîncărcare');
    eq((await gOwn(p)).length, 5);
    await p.click('#gr-rm-' + ID1);
    eq((await p.textContent('#gr-rm-' + ID1)).trim(), I.en.a_remove_sure, 'prima apăsare cere confirmare');
    eq(await gActive(p), 'gr-rm-' + ID1);
    eq((await gStore(p)).own.length, 5, 'prima apăsare nu șterge');
    await p.click('#gr-rm-' + ID1);
    eq(await gLive(p), I.en.a_removed);
    eq((await gStore(p)).own.length, 4);
    eq(await gActive(p), 'gr-own-h', 'focusul trece pe titlul listei');
    eq((await p.textContent('#gr-clear')).trim(), I.en.a_clear_all);
    await p.click('#gr-clear');
    eq((await p.textContent('#gr-clear')).trim(), F(I.en.a_clear_sure, 4), 'a doua apăsare cere confirmare');
    eq((await gStore(p)).own.length, 4, 'prima apăsare nu șterge');
    await gTab(p, 'search');
    await gTab(p, 'add');
    eq((await p.textContent('#gr-clear')).trim(), I.en.a_clear_all, 'schimbarea filei anulează confirmarea');
    await p.click('#gr-clear');
    await p.click('#gr-clear');
    eq(await gLive(p), I.en.a_cleared);
    eq((await gStore(p)).own.length, 0);
    eq(await gOwnH(p), F(I.en.a_own_h, 0));
    eq(await p.$('#gr-clear'), null, 'fără intrări nu mai e buton de golire');
    noErr(h);
    await h.ctx.close();
  });

  await T('graiul: adăugarea în bloc citește «text | traducere», raportează rândurile greșite, păstrează în casetă rândurile respinse și respectă limitele', async () => {
    const h = await gOpen();
    const p = h.page;
    await gTab(p, 'add');
    const L1 = 'Prima gândire xa | First thought xa', L2 = 'A doua gândire xb\tSecond thought xb', L3 = 'Al treilea gând xc', L4 = 'Prima gândire xa', L5 = 'cu\u0007control xd';
    await gSet(p, '#gr-b-ta', ['# comentariu', L1, L2, '', L3, L4, L5].join('\n'));
    await p.click('#gr-b-go');
    eq(await gLive(p), F(I.en.b_done, 0, 5), 'fără sursă nu se adaugă nimic');
    eq((await gLines(p)).join('|'), [F(I.en.b_line, 7, I.en.b_e_text), F(I.en.b_line, 2, F(I.en.issue_source, 300)), F(I.en.b_line, 3, F(I.en.issue_source, 300)), F(I.en.b_line, 5, F(I.en.issue_source, 300)), F(I.en.b_line, 6, F(I.en.issue_source, 300))].join('|'), 'rândurile respinse');
    eq(await p.inputValue('#gr-b-ta'), [L1, L2, L3, L4, L5].join('\n'), 'rândurile respinse rămân în casetă, fără comentarii și rânduri goale');
    eq(await gActive(p), 'gr-b-ta');
    eq((await gStore(p)), null, 'nimic nu s-a salvat');
    await p.fill('#gr-a-source', 'Test source');
    await p.click('#gr-b-go');
    eq(await gLive(p), F(I.en.b_done, 3, 2));
    eq((await gLines(p)).join('|'), [F(I.en.b_line, 5, I.en.b_e_text), F(I.en.b_line, 4, I.en.b_e_dup)].join('|'));
    eq(await p.inputValue('#gr-b-ta'), [L4, L5].join('\n'), 'rămân doar rândurile respinse');
    const st = await gStore(p);
    same(st.own.map(noOwn), [
      {type: 'proverb', lang: 'ro', text: 'Prima gândire xa', translations: {en: 'First thought xa'}, region: 'unlocated', source: 'Test source', status: 'draft'},
      {type: 'proverb', lang: 'ro', text: 'A doua gândire xb', translations: {en: 'Second thought xb'}, region: 'unlocated', source: 'Test source', status: 'draft'},
      {type: 'proverb', lang: 'ro', text: 'Al treilea gând xc', region: 'unlocated', source: 'Test source', status: 'draft'}], 'intrările adăugate');
    eq(st.own.map((o) => o.id).join(','), ['Prima gândire xa', 'A doua gândire xb', 'Al treilea gând xc'].map((t) => GEN.itemId('ro', t)).join(','));
    eq(await gOwnH(p), F(I.en.a_own_h, 3));
    await gSet(p, '#gr-b-ta', 'Gând xe | traducere xe');
    await p.fill('#gr-b-lang', 'x1');
    await p.click('#gr-b-go');
    eq(await gLive(p), F(I.en.b_done, 0, 1));
    eq((await gLines(p)).join('|'), F(I.en.b_line, 1, F(I.en.issue_translations, 12)), 'cod de limbă greșit pentru traduceri');
    eq(await p.inputValue('#gr-b-ta'), 'Gând xe | traducere xe');
    await p.fill('#gr-b-lang', 'fr');
    await p.click('#gr-b-go');
    eq(await gLive(p), F(I.en.b_done, 1, 0));
    same((await gStore(p)).own[3].translations, {fr: 'traducere xe'});
    eq(await p.inputValue('#gr-b-ta'), '', 'caseta se golește când totul a fost adăugat');
    await gSet(p, '#gr-b-ta', Array.from({length: 201}, (_, i) => 'Linie ' + WORDS(100 + i)).join('\n'));
    await p.click('#gr-b-go');
    eq(await gLive(p), F(I.en.b_done, 200, 1), 'cel mult 200 de rânduri');
    eq((await gLines(p)).join('|'), F(I.en.b_line, 201, I.en.b_e_many));
    eq((await p.inputValue('#gr-b-ta')).split('\n').length, 1, 'rămâne rândul necitit');
    await gSet(p, '#gr-b-ta', Array.from({length: 30}, () => '\tx').join('\n'));
    await p.click('#gr-b-go');
    eq(await gLive(p), F(I.en.b_done, 0, 30));
    eq((await gLines(p)).length, 20, 'cel mult 20 de rânduri afișate');
    noErr(h);
    await h.ctx.close();
    const h2 = await gOpen({state: stateOf(Array.from({length: 499}, (_, i) => seed(i)))});
    const p2 = h2.page;
    await gTab(p2, 'add');
    await p2.fill('#gr-a-source', 'Test source');
    await gSet(p2, '#gr-b-ta', ['Linie xa', 'Linie xb', 'Linie xc'].join('\n'));
    await p2.click('#gr-b-go');
    eq(await gLive(p2), F(I.en.b_done, 1, 2));
    eq((await gLines(p2)).join('|'), [F(I.en.b_line, 2, F(I.en.a_full, 500)), F(I.en.b_line, 3, F(I.en.a_full, 500))].join('|'), 'lista ta are cel mult 500 de intrări');
    eq(await p2.inputValue('#gr-b-ta'), 'Linie xb\nLinie xc');
    eq(await gOwnH(p2), F(I.en.a_own_h, 500));
    await p2.fill('#gr-a-text', 'Încă una xz');
    await p2.click('#gr-add');
    eq(await gLive(p2), F(I.en.a_full, 500), 'formularul respectă aceeași limită');
    noErr(h2);
    await h2.ctx.close();
  });

  await T('graiul: exportul JSON și TSV are numele, antetul și conținutul potrivite, nu lasă formule în foile de calcul și se reîncarcă fără pierderi', async () => {
    const h0 = await gOpen();
    const p0 = h0.page;
    await gTab(p0, 'export');
    let downloads = 0;
    p0.on('download', () => downloads++);
    eq(await gWait(p0, () => p0.click('#gr-x-json')), I.en.x_none, 'nimic de exportat');
    await p0.selectOption('#gr-x-scope', 'own');
    eq(await gWait(p0, () => p0.click('#gr-x-tsv')), I.en.x_none, 'nimic de exportat din intrările tale');
    await p0.waitForTimeout(300);
    eq(downloads, 0, 'nu s-a descărcat nimic');
    await p0.selectOption('#gr-x-scope', 'all');
    let d = await gDl(p0, '#gr-x-tsv');
    ok(/^graiul-all-\d{4}-\d\d-\d\d\.tsv$/.test(d.name), d.name);
    let t = d.buf.toString('utf8');
    eq(t.charCodeAt(0), 0xfeff, 'semnul de ordine a octeților (diacriticele în foile de calcul)');
    let rows = t.slice(1).split('\n');
    eq(rows.pop(), '', 'rând nou la sfârșit');
    eq(rows.length, GIT.length + 1, 'rânduri');
    const head = rows[0].split('\t');
    eq(head.join(','), 'id,type,lang,text,region,county,answer,purpose,translations,notes,collector,consent,source,source_url,license,status,reviewed_by');
    ok(rows.every((r) => r.split('\t').length === head.length), 'număr inegal de coloane');
    eq(rows.slice(1).map((r) => r.split('\t')[0]).sort().join(','), GIT.map((e) => e.id).sort().join(','), 'identificatorii');
    eq(rows.slice(1).map((r) => r.split('\t')[3]).sort().join('|'), GIT.map((e) => e.text).sort().join('|'), 'textele');
    eq(await gLive(p0), F(I.en.x_done, d.name), 'mesajul de după descărcare');
    noErr(h0);
    await h0.ctx.close();
    const evil = [
      seed(1, {id: 'ro-eq', text: '=2+2', source: '@sursa', notes: '-1+1', translations: {en: '+cmd'}}),
      seed(2, {id: 'ro-ml', text: 'două\nrânduri', source: 'Multi-line source'}),
      seed(3, {id: 'ro-ok', text: '<b>x&y</b>', county: 'RO-IS', region: 'Moldova', source: 'S3'})];
    const h = await gOpen({state: stateOf(evil)});
    const p = h.page;
    await gTab(p, 'export');
    await p.selectOption('#gr-x-scope', 'own');
    d = await gDl(p, '#gr-x-tsv');
    ok(/^graiul-own-\d{4}-\d\d-\d\d\.tsv$/.test(d.name), d.name);
    rows = d.buf.toString('utf8').slice(1).split('\n');
    rows.pop();
    eq(rows.length, 4, 'antet și trei intrări; liniile noi din text nu rup rândurile');
    ok(rows.every((r) => r.split('\t').length === head.length), 'număr inegal de coloane');
    const c1 = rows[1].split('\t'), c2 = rows[2].split('\t'), c3 = rows[3].split('\t'), col = (n) => head.indexOf(n);
    eq(c1[col('text')], "'=2+2", 'textul care începe cu «=»');
    eq(c1[col('source')], "'@sursa", 'sursa care începe cu «@»');
    eq(c1[col('notes')], "'-1+1", 'nota care începe cu «-»');
    eq(c1[col('translations')], 'en: +cmd');
    eq(c2[col('text')], 'două rânduri', 'linia nouă din text devine spațiu');
    eq(c3[col('text')], '<b>x&y</b>', 'etichetele rămân text');
    eq(c3[col('county')], 'RO-IS');
    d = await gDl(p, '#gr-x-json');
    ok(/^graiul-contribution-\d{4}-\d\d-\d\d\.json$/.test(d.name), d.name);
    const b = JSON.parse(d.buf.toString('utf8'));
    eq(b.format, 'graiul-bundle');
    eq(b.version, 1);
    ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(b.created), 'data creării: ' + b.created);
    eq(b.entries.length, 3);
    ok(b.entries.every((e) => !('id' in e)), 'identificatorii nu se exportă');
    same(b.entries, evil.map(noOwn), 'intrările exportate');
    const bundle = d.buf;
    await gTab(p, 'add');
    await p.click('#gr-clear');
    await p.click('#gr-clear');
    eq((await gStore(p)).own.length, 0);
    await gTab(p, 'export');
    eq(await gImport(p, bundle, 'graiul-contribution.json'), F(I.en.i_ok, 3, 0), 'reîncărcare după golire');
    same((await gStore(p)).own.map(noOwn), evil.map(noOwn), 'intrările reîncărcate sunt identice');
    eq(await gImport(p, bundle), F(I.en.i_ok, 0, 3), 'a doua încărcare sare peste duplicate');
    eq(await gActive(p), 'gr-x-file', 'focusul rămâne la câmpul de fișier');
    eq(await gImport(p, 'nu este json'), I.en.e_json);
    eq(await gImport(p, '{"format":"altceva","version":1,"entries":[]}'), I.en.e_format);
    eq(await gImport(p, '{"format":"graiul-bundle","version":2,"entries":[]}'), I.en.e_format, 'versiune necunoscută');
    eq(await gImport(p, '[]'), I.en.e_format, 'o listă nu e un fișier de contribuție');
    eq(await gImport(p, JSON.stringify({format: 'graiul-bundle', version: 1, entries: Array.from({length: 501}, () => ({}))})), F(I.en.e_many, 500), 'peste 500 de intrări');
    eq(await gImport(p, Buffer.alloc(8000001, 32)), I.en.e_big, 'fișier peste 8 MB');
    const good = {type: 'proverb', lang: 'ro', text: 'Importat xa', region: 'unlocated', source: 's', status: 'draft'};
    const mixed = {format: 'graiul-bundle', version: 1, entries: [good,
      {type: 'proverb', lang: 'ro', text: '', region: 'unlocated', source: 's'}, 5,
      Object.assign({}, good, {text: 'Importat xb', extra: 1}),
      {type: 'riddle', lang: 'ro', text: 'Importat xc', region: 'unlocated', source: 's'}]};
    eq(await gImport(p, JSON.stringify(mixed)), F(I.en.i_ok, 1, 0), 'un fișier cu intrări bune și rele');
    eq((await gLines(p)).join('|'), [F(I.en.i_bad, 2, F(I.en.issue_text, 20000)), F(I.en.i_bad, 3, I.en.issue_other), F(I.en.i_bad, 4, I.en.issue_other), F(I.en.i_bad, 5, I.en.issue_answer)].join('|'), 'câte un rând pentru fiecare intrare respinsă');
    eq((await gStore(p)).own.length, 4);
    const hostile = '{"format":"graiul-bundle","version":1,"entries":[{"type":"proverb","lang":"ro","text":"<img src=x onerror=window.__pwned=1>","region":"<script>window.__pwned=1</script>","source":"<b>s</b>"},{"type":"proverb","lang":"ro","text":"Prototip","region":"unlocated","source":"s","__proto__":{"polluted":1}},{"type":"proverb","lang":"ro","text":"Constructor","region":"unlocated","source":"s","constructor":{"prototype":{"polluted":2}}}]}';
    eq(await gImport(p, hostile), F(I.en.i_ok, 1, 0), 'intrare cu HTML în text');
    eq((await gLines(p)).join('|'), [F(I.en.i_bad, 2, I.en.issue_other), F(I.en.i_bad, 3, I.en.issue_other)].join('|'), 'cheile __proto__ și constructor sunt respinse');
    await gTab(p, 'add');
    ok(await p.evaluate(() => !window.__pwned && ({}).polluted === undefined && !document.querySelector('#appmount img, #appmount script')), 'HTML interpretat sau prototip poluat');
    eq((await p.$$eval('.gr-own-box .gr-cmeta', (e) => e.some((x) => x.textContent.includes('<img src=x')))), true, 'textul apare literal');
    noErr(h);
    await h.ctx.close();
  });

  await T('graiul: când browserul nu poate păstra intrările, pagina nu pretinde că le-a salvat', async () => {
    const h = await gOpen();
    const p = h.page;
    await gTab(p, 'add');
    await p.fill('#gr-a-text', 'Prima intrare xq');
    await p.fill('#gr-a-source', 'Test source');
    await p.click('#gr-add');
    eq(await gLive(p), F(I.en.a_added, 1));
    await p.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('plin', 'QuotaExceededError'); }; });
    await p.fill('#gr-a-text', 'A doua intrare xw');
    await p.click('#gr-add');
    eq(await gLive(p), I.en.e_quota, 'o intrare');
    eq(await gOwnH(p), F(I.en.a_own_h, 1), 'intrarea nesalvată iese din listă');
    eq(await p.inputValue('#gr-a-text'), 'A doua intrare xw', 'textul rămâne în formular');
    await gSet(p, '#gr-b-ta', 'Linie xe | e\nLinie xf');
    await p.click('#gr-b-go');
    eq(await gLive(p), I.en.e_quota, 'adăugare în bloc');
    eq(await gOwnH(p), F(I.en.a_own_h, 1));
    eq(await p.inputValue('#gr-b-ta'), 'Linie xe | e\nLinie xf', 'rândurile rămân în casetă');
    await gTab(p, 'export');
    const file = {format: 'graiul-bundle', version: 1, entries: [{type: 'proverb', lang: 'ro', text: 'Importat xq', region: 'unlocated', source: 's'}]};
    eq(await gImport(p, JSON.stringify(file)), I.en.e_quota, 'import');
    await gTab(p, 'add');
    eq(await gOwnH(p), F(I.en.a_own_h, 1));
    await gTab(p, 'search');
    await p.fill('#gr-q', 'xq');
    eq(await gCount(p), want(1), 'în căutare apare doar intrarea salvată');
    noErr(h);
    await h.ctx.close();
    const h2 = await gOpen();
    const p2 = h2.page;
    await gTab(p2, 'export');
    const big = {format: 'graiul-bundle', version: 1, entries: Array.from({length: 300}, (_, i) => ({type: 'proverb', lang: 'ro', text: WORDS(i) + ' ' + 'a'.repeat(15000), region: 'unlocated', source: 's'}))};
    const txt = JSON.stringify(big);
    ok(txt.length < 8000000 && txt.length > 4000000, 'fișierul de probă: ' + txt.length);
    eq(await gImport(p2, txt), I.en.e_quota, 'peste 4 milioane de caractere nu se păstrează');
    await gTab(p2, 'add');
    eq(await gOwnH(p2), F(I.en.a_own_h, 0));
    eq(await gStore(p2), null);
    noErr(h2);
    await h2.ctx.close();
  });

  await T('graiul: căutarea de dubluri găsește perechile din colecție și din lista ta și arată cel mult 20', async () => {
    const h0 = await gOpen();
    await gTab(h0.page, 'export');
    await h0.page.click('#gr-dup-go');
    eq((await h0.page.textContent('#gr-dup')).trim(), I.en.x_dup_none, 'datele de pornire nu au dubluri');
    noErr(h0);
    await h0.ctx.close();
    const near = GIT[0].text.replace(/\.$/, '');
    const list = [seed(1, {id: 'ro-copie', text: near}), seed(2, {id: 'ro-alta-copie', text: near + 'a'})];
    for (let i = 0; i < 22; i++) { list.push(seed(100 + i, {text: 'Pereche ' + WORDS(100 + i)})); list.push(seed(200 + i, {text: 'Pereche ' + WORDS(100 + i) + 'a'})); }
    const h = await gOpen({state: stateOf(list)});
    const p = h.page;
    await gTab(p, 'export');
    await p.click('#gr-dup-go');
    const pairs = await p.$$eval('#gr-dup li', (e) => e.map((x) => x.textContent));
    const found = (await p.textContent('#gr-dup p')).trim();
    eq(found, F(I.en.x_dup_found, 25), '22 de perechi proprii și 3 între cele două copii și proverbul din colecție');
    const n = 25;
    eq(pairs.length, 20, 'cel mult 20 de perechi afișate');
    ok(pairs.every((x) => /^[a-z0-9-]+ ↔ [a-z0-9-]+ \(\d+%\)$/.test(x)), pairs.slice(0, 3).join(' / '));
    eq((await p.textContent('#gr-dup p:last-child')).trim(), F(I.en.x_dup_more, n - 20));
    noErr(h);
    await h.ctx.close();
  });

  await T('graiul: schimbarea limbii păstrează fila, ciorna și căutarea și lasă o singură secțiune «Limite»', async () => {
    const h = await gOpen();
    const p = h.page;
    await p.fill('#gr-q', 'cine');
    await p.selectOption('#gr-ftype', 'proverb');
    await gTab(p, 'add');
    await p.fill('#gr-a-text', 'Ciornă xdraft');
    await gSet(p, '#gr-b-ta', 'Rând xdraft');
    for (const l of LANGS.concat(['en'])) {
      await p.selectOption('#langsel', l);
      await p.waitForSelector(ready);
      eq(await p.getAttribute('#gr-tt-add', 'aria-selected'), 'true', l + ': fila rămâne');
      eq(await p.inputValue('#gr-a-text'), 'Ciornă xdraft', l + ': textul din ciornă');
      eq(await p.inputValue('#gr-b-ta'), 'Rând xdraft', l + ': lista din ciornă');
      eq(await p.getAttribute('html', 'lang'), l, l + ': atributul lang');
      eq(await p.$$eval('#gr-lim-card', (e) => e.length), 1, l + ': secțiuni «Limite»');
      eq((await p.textContent('#gr-lim-h')).trim(), I[l].h_limits, l + ': titlul secțiunii');
      eq(await p.$$eval('#gr-lim-card li', (e) => e.length), 6, l + ': punctele «Limite»');
      for (let i = 1; i <= 6; i++) eq((await p.textContent('#gr-lim-card li:nth-child(' + i + ')')).trim(), I[l]['lim_' + i], l + ': punctul ' + i);
    }
    await gTab(p, 'search');
    eq(await p.inputValue('#gr-q'), 'cine', 'interogarea rămâne');
    eq(await p.inputValue('#gr-ftype'), 'proverb', 'filtrul rămâne');
    noErr(h);
    await h.ctx.close();
  });

  await T('graiul: stare salvată ostilă — intrările invalide sunt aruncate, textul rămâne text, valorile din «last» nu ajung în formular, limitele se respectă', async () => {
    const good = '{"id":"ro-ok","type":"proverb","lang":"ro","text":"Bun","region":"unlocated","source":"s","status":"draft"}';
    const bad = (extra) => '{"id":"ro-x","type":"proverb","lang":"ro","text":"t","region":"unlocated","source":"s"' + (extra || '') + '}';
    const text = '{"v":1,"own":[' + [
      good, good,
      '{"id":"ro-xss","type":"proverb","lang":"ro","text":"<img src=x onerror=window.__pwned=1>","region":"<script>window.__pwned=1</script>","source":"<b>s</b>","status":"draft"}',
      '{"id":"ro-zz","type":"proverb","lang":"zz","text":"Cod de limbă liber","region":"unlocated","source":"s"}',
      bad(',"__proto__":{"polluted":1}'), bad(',"constructor":{"prototype":{"polluted":2}}'), bad(',"evil":1'),
      '{"id":"../../etc/passwd","type":"proverb","lang":"ro","text":"t","region":"unlocated","source":"s"}',
      '{"id":"__proto__","type":"proverb","lang":"ro","text":"t","region":"unlocated","source":"s"}',
      '{"id":"RO-Mare","type":"proverb","lang":"ro","text":"t","region":"unlocated","source":"s"}',
      '{"id":"ro-tip","type":"evil","lang":"ro","text":"t","region":"unlocated","source":"s"}',
      '{"id":"ro-lang","type":"proverb","lang":"RO","text":"t","region":"unlocated","source":"s"}',
      '{"id":"ro-gol","type":"proverb","lang":"ro","text":"","region":"unlocated","source":"s"}',
      '{"id":"ro-ctrl","type":"proverb","lang":"ro","text":"a\\u0000b","region":"unlocated","source":"s"}',
      '{"id":"ro-lung","type":"proverb","lang":"ro","text":"' + 'x'.repeat(20001) + '","region":"unlocated","source":"s"}',
      '{"id":"ro-judet","type":"proverb","lang":"ro","text":"t","region":"unlocated","county":"RO-ZZ","source":"s"}',
      '{"id":"ro-ghicit","type":"riddle","lang":"ro","text":"t","region":"unlocated","source":"s"}',
      '{"id":"ro-raspuns","type":"proverb","lang":"ro","text":"t","answer":"a","region":"unlocated","source":"s"}',
      '{"id":"ro-farmec","type":"charm","lang":"ro","text":"t","purpose":"p","region":"unlocated","source":"s"}',
      '{"id":"ro-acord","type":"proverb","lang":"ro","text":"t","region":"unlocated","source":"s","consent":"da"}',
      '{"id":"ro-http","type":"proverb","lang":"ro","text":"t","region":"unlocated","source":"s","source_url":"http://example.org/"}',
      '{"id":"ro-sursa","type":"proverb","lang":"ro","text":"t","region":"unlocated","source":"s","status":"sourced"}',
      '{"id":"ro-trad","type":"proverb","lang":"ro","text":"t","region":"unlocated","source":"s","translations":{"EN":"x"}}',
      '{"id":"ro-id","type":"proverb","lang":"ro","text":"t","region":"unlocated","source":"s","translations":"nu e obiect"}',
      'null', '5', '"text"', '[]'
    ].join(',') + '],"last":{"lang":"' + 'x'.repeat(400) + '","county":"RO-ZZ","license":"MIT-nu","consent":"nu","region":"' + 'r'.repeat(300) + '","source":"' + 's'.repeat(400) + '","collector":"' + 'c'.repeat(400) + '","type":"evil","status":"evil","reviewed_by":5,"__proto__":{"polluted":3}}}';
    const h = await gOpen({state: text});
    const p = h.page;
    await gTab(p, 'add');
    eq(await gOwnH(p), F(I.en.a_own_h, 3), 'rămân doar intrările valide');
    eq((await gOwn(p)).join(','), 'ro-ok,ro-xss,ro-zz');
    ok(await p.evaluate(() => !window.__pwned && ({}).polluted === undefined && !document.querySelector('#appmount img, #appmount script')), 'HTML interpretat sau prototip poluat');
    for (const [id, v] of [['gr-a-type', 'proverb'], ['gr-a-lang', 'ro'], ['gr-a-region', ''], ['gr-a-county', ''], ['gr-a-source', ''], ['gr-a-consent', ''], ['gr-a-lic', ''], ['gr-a-collector', ''], ['gr-a-status', 'draft'], ['gr-a-url', '']]) eq(await p.inputValue('#' + id), v, 'formularul pornește curat: ' + id);
    await p.fill('#gr-a-text', 'Intrare nouă xn');
    await p.fill('#gr-a-source', 'Test source');
    await p.click('#gr-add');
    eq(await gLive(p), F(I.en.a_added, 4), 'o intrare corectă se adaugă fără erori fantomă');
    await gTab(p, 'search');
    await p.fill('#gr-q', 'img');
    eq(await gTexts(p).then((a) => a.includes('<img src=x onerror=window.__pwned=1>')), true, 'textul cu HTML apare ca text');
    await gTab(p, 'export');
    await p.selectOption('#gr-x-scope', 'own');
    const d = await gDl(p, '#gr-x-tsv');
    eq(d.buf.toString('utf8').slice(1).split('\n').length - 2, 4, 'rândurile din tabelul cu intrările tale');
    noErr(h);
    await h.ctx.close();
    const many = Array.from({length: 520}, (_, i) => seed(i));
    const h2 = await gOpen({state: stateOf(many)});
    await gTab(h2.page, 'add');
    eq(await gOwnH(h2.page), F(I.en.a_own_h, 500), 'cel mult 500 de intrări proprii');
    noErr(h2);
    await h2.ctx.close();
    const h3 = await gOpen({state: '{"v":1,"own":"nu e listă","last":[]}'});
    await gTab(h3.page, 'add');
    eq(await gOwnH(h3.page), F(I.en.a_own_h, 0));
    noErr(h3);
    await h3.ctx.close();
  });

  await T('graiul: filtrele de limbă și de regiune revin la «toate» când ultima intrare cu acea valoare a fost ștearsă', async () => {
    const list = [seed(1, {id: 'hu-proba', lang: 'hu', text: 'Magyar próba xh', region: 'Erdély'})];
    const h = await gOpen({state: stateOf(list)});
    const p = h.page;
    eq(await p.$$eval('#gr-flang option', (o) => o.map((x) => x.value).join(',')), 'all,hu,ro');
    await p.selectOption('#gr-flang', 'hu');
    await p.selectOption('#gr-fregion', 'Erdély');
    eq(await gCount(p), want(1));
    await gTab(p, 'add');
    await p.click('#gr-rm-hu-proba');
    await p.click('#gr-rm-hu-proba');
    eq(await gOwnH(p), F(I.en.a_own_h, 0));
    await gTab(p, 'search');
    eq(await p.inputValue('#gr-flang'), 'all', 'limba dispărută');
    eq(await p.inputValue('#gr-fregion'), 'all', 'regiunea dispărută');
    eq(await gCount(p), want(GIT.length), 'rezultatele corespund cu ce arată filtrele');
    noErr(h);
    await h.ctx.close();
  });

  await T('graiul: accesibilitate (axe) pe toate filele, în temele luminoasă și întunecată, cu intrări proprii, erori afișate și județ ales', async () => {
    for (const scheme of ['light', 'dark']) {
      const h = await gOpen({scheme, state: stateOf(RICH.concat([seed(1, {county: 'RO-IS', region: 'Moldova'})]))});
      const p = h.page;
      for (const l of (scheme === 'light' ? ['en', 'ro', 'de', 'hu'] : ['ro', 'en'])) {
        await p.selectOption('#langsel', l);
        await p.waitForSelector(ready);
        for (const id of TABS) {
          await gTab(p, id);
          if (id === 'search') {
            await p.fill('#gr-q', 'ghicitoare');
            const btn = '#gr-i-' + RIDDLE.id + ' .gr-reveal';
            if ((await p.getAttribute(btn, 'aria-expanded')) === 'false') await p.click(btn);
          }
          if (id === 'map') { await p.click('#gr-t-RO-IS'); await gTab(p, 'map'); }
          if (id === 'add') { await p.click('#gr-more-d summary'); await p.click('#gr-add'); await p.click('#gr-b-go'); }
          if (id === 'export') await p.click('#gr-dup-go');
          const v = await axe(p);
          ok(v.length === 0, scheme + '/' + l + '/' + id + ': ' + JSON.stringify(v));
        }
        await gTab(p, 'map');
        if (await p.$('#gr-allc')) await p.click('#gr-allc');
        await gTab(p, 'search');
        await p.fill('#gr-q', '');
      }
      noErr(h);
      await h.ctx.close();
    }
  });

  await T('graiul: pe mobil (360 px) fiecare filă încape fără defilare orizontală a paginii', async () => {
    const h = await gOpen({w: 360, h: 740, state: stateOf(RICH.concat([seed(1, {county: 'RO-IS', region: 'Moldova'})]))});
    const p = h.page;
    for (const l of ['ro', 'de', 'hu']) {
      await p.selectOption('#langsel', l);
      await p.waitForSelector(ready);
      for (const id of TABS) {
        await gTab(p, id);
        if (id === 'add') { await p.click('#gr-more-d summary'); await p.click('#gr-add'); }
        const w = await p.evaluate(() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth}));
        ok(w.sw <= w.iw + 1, l + '/' + id + ': scrollWidth ' + w.sw + ' > ' + w.iw);
      }
    }
    noErr(h);
    await h.ctx.close();
  });

  await browser.close();
} else {
  console.log('omis: graiul (nu există ' + path.relative(HUB, appFile('graiul')) + ')');
  skipped.add('graiul');
}

/* ================= INDICATIV INTERNATIONAL ================= */
if (present('indicativ-international')) {
  const NAME = 'indicativ-international';
  const ready = '#appmount .in-root';
  const K = {packs: NAME + '.packs', prog: NAME + '.progress', run: NAME + '.exam'};
  const RAW = /\b(?:tab|f|m|cl|t|x|r|p|th|i|w|e|g|gd|h|lim)_[a-z0-9_]{2,}\b/;
  const IDIR = path.join(ROOT, NAME);
  const IE = await import(pathToFileURL(path.join(IDIR, 'src', 'engine.mjs')).href);
  const II = (await import(pathToFileURL(path.join(IDIR, 'src', 'i18n.mjs')).href)).default;
  const PR_TEXT = fs.readFileSync(path.join(IDIR, 'data', 'packs', 'zz-practice.json'), 'utf8');
  const PR = JSON.parse(PR_TEXT);
  const F = (s, ...a) => s.replace(/\{(\d)\}/g, (m, i) => String(a[Number(i)]));
  const rt = (t) => IE.richParts(t).map((x) => x.s).join('');                       // textul vizibil al unui text cu formule
  const plain = (s) => s.replace(/([_^])\{([^{}]+)\}/g, '$1$2');                    // cum se arată răspunsul corect în mesajul «Not quite»
  const BYTEXT = new Map(PR.questions.map((q) => [rt(q.question), q]));
  const BYID = new Map(PR.questions.map((q) => [q.id, q]));
  eq(BYTEXT.size, PR.questions.length, 'textele întrebărilor din pachetul de exersare sunt distincte (testele le recunosc după text)');
  const T0 = '2026-11-17T12:00:00Z', T1 = '2026-11-18T12:00:00Z';
  const iDay = (iso) => IE.dayOf(new Date(iso));
  const RULES = {questions: 20, minutes: 30, pass_percent: 75, wrong_penalty: 0};
  const EXAM = (seed, rules = RULES) => IE.buildExam(PR.questions, rules, seed);
  const SIG = (ids) => IE.hash32(ids.join('|'));
  // un examen salvat, ca în localStorage
  const runOf = (seed, o = {}) => JSON.stringify({pack: o.pack || 'zz-practice', seed, start: o.start, rules: o.rules || RULES, sig: o.sig !== undefined ? o.sig : SIG(EXAM(seed, o.rules || RULES).ids), answers: o.answers || {}, flags: o.flags || {}, cur: o.cur || 0});
  const progOf = (entries, hist, last) => JSON.stringify(Object.assign({format: IE.PROGRESS_FORMAT, version: 1, packs: {'zz-practice': entries || {}}, history: hist || []}, last ? {last} : {}));
  // un seed al cărui examen conține cele două întrebări cu desen (0005 și 0028)
  const FIG_SEED = (() => { for (let s = 1; s < 500; s++) { const ids = EXAM(s).ids; if (ids.includes('ZZ-practice-0005') && ids.includes('ZZ-practice-0028')) return s; } throw new Error('niciun seed cu ambele desene'); })();

  async function iOpen(o = {}) {
    const h = await newPage(browser, Object.assign({locale: 'en-GB', reduced: true}, o));   // fără mișcare: derularea lină a nucleului întârzie clicurile (Playwright așteaptă ca elementul să fie stabil)
    if (o.time) await h.page.clock.setFixedTime(new Date(o.time));
    if (o.clock) await h.page.clock.install({time: new Date(o.clock)});
    if (o.store) await h.ctx.addInitScript((kv) => {
      try { if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1'); Object.keys(kv).forEach((k) => localStorage.setItem(k, kv[k])); } catch (e) { /* ignorat */ }
    }, o.store);
    await h.page.goto('file://' + appFile(NAME));
    await h.page.waitForSelector(ready);
    await iLang(h.page, o.lang || 'en');
    h.opts = o;
    return h;
  }
  // selectOption trimite «change» chiar dacă limba e aceeași, iar schimbarea de limbă reface pagina și pierde mesajul de reluare: se schimbă doar dacă e nevoie
  async function iLang(p, lang) {
    if ((await p.inputValue('#langsel')) !== lang) { await p.selectOption('#langsel', lang); await p.waitForSelector(ready); }
  }
  // «Redeschiderea» testelor: se citește tot ce are pagina în localStorage și se deschide un context nou cu aceeași stare. O reîncărcare reală, imediat după o scriere,
  // pierde uneori scrierea în Chrome pe file:// (aproximativ 2 % din reîncărcări, măsurat cu o pagină goală de test): nu ține de aplicație, deci testele nu se bazează pe ea.
  // Ce scrie aplicația se verifică prin citire directă din pagină (iStore); ce citește la pornire, prin starea pusă de scriptul de inițializare, în același document.
  async function iFresh(h, store, over = {}) {
    noErr(h);
    await h.ctx.close();
    return iOpen(Object.assign({}, h.opts, over, {store: store}));
  }
  async function iReopen(h, over = {}) {
    const kv = await h.page.evaluate(() => { const r = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); r[k] = localStorage.getItem(k); } return r; });
    return iFresh(h, kv, over);
  }
  const iTab = async (p, id) => { await p.click('#in-tt-' + id); await p.waitForSelector('#in-p-' + id + ':not([hidden])'); };
  const iLive = async (p) => (await p.$eval('#in-live', (e) => e.innerText)).trim();
  const iStore = (p, key) => p.evaluate((k) => { const t = localStorage.getItem(k); return t === null ? null : JSON.parse(t); }, key);
  const iActive = (p) => p.evaluate(() => document.activeElement && document.activeElement.id);
  const iText = async (p, sel) => (await p.textContent(sel)).trim();
  const iDl = async (p, sel) => {
    const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]);
    return {name: d.suggestedFilename(), text: fs.readFileSync(await d.path(), 'utf8')};
  };
  const has_ = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const iPoll = (p) => p.evaluate(() => ({}).polluted === undefined && Object.prototype.polluted === undefined);
  const iShown = async (p, sel) => {                                       // întrebarea afișată, găsită după text în pachetul de exersare
    const t = (await p.$eval(sel, (e) => e.textContent)).trim();
    const q = BYTEXT.get(t);
    ok(q, 'întrebare necunoscută: ' + t);
    return q;
  };
  const iAnsTexts = (p, card) => p.$$eval(card + ' .in-at', (e) => e.map((x) => x.textContent));
  /** răspunde în exersare (corect sau greșit) și așteaptă explicația; întoarce {q, k (butonul apăsat), ri (butonul corect)} */
  async function iTrain(p, right) {
    const q = await iShown(p, '#in-qt');
    const texts = await iAnsTexts(p, '#in-card');
    eq(texts.length, q.answers.length, 'numărul de răspunsuri');
    const ri = texts.indexOf(rt(q.answers[q.correct]));
    ok(ri >= 0, 'răspunsul corect lipsește: ' + JSON.stringify(texts));
    const k = right ? ri : (ri + 1) % texts.length;
    const where = await p.$eval('.in-qn', (e) => e.textContent).catch(() => '?');
    try { await p.click('#in-ans-' + k, {timeout: 8000}); } catch (e) {
      const st = await p.evaluate((n) => { const b = document.getElementById('in-ans-' + n); const r = b && b.getBoundingClientRect(); return {exists: !!b, rect: r && [r.x, r.y, r.width, r.height].map(Math.round), dis: b && b.disabled, aria: b && b.getAttribute('aria-disabled'), vis: document.visibilityState, active: document.activeElement && document.activeElement.id}; }, k).catch((x) => 'eval: ' + x.message);
      throw new Error('iTrain ' + where + ' k=' + k + ' ' + JSON.stringify(st) + ' :: ' + String(e.message).split('\n')[0]);
    }
    await p.waitForSelector('#in-fb');
    return {q, k, ri};
  }
  /** alege în examen un răspuns (corect sau greșit) la întrebarea afișată; întoarce {q, k, ri, orig} */
  async function iExamPick(p, right) {
    const q = await iShown(p, '#in-xqt');
    const texts = await iAnsTexts(p, '#in-xcard');
    const ri = texts.indexOf(rt(q.answers[q.correct]));
    ok(ri >= 0, 'răspunsul corect lipsește din examen');
    const k = right ? ri : (ri + 1) % texts.length;
    await p.click('label[for="in-xa-' + k + '"]');
    const orig = q.answers.findIndex((a) => rt(a) === texts[k]);
    return {q, k, ri, orig};
  }
  /** indicele butonului marcat «Your answer» după un răspuns în exersare */
  const iChosen = (p) => p.$$eval('.in-ans', (e) => e.findIndex((x) => /✓ Your answer|✗ Your answer/.test(x.textContent)));
  const iRightIndex = async (p) => { const q = await iShown(p, '#in-qt'); return (await iAnsTexts(p, '#in-card')).indexOf(rt(q.answers[q.correct])); };
  const iSeedExam = async (p, seed) => { await iTab(p, 'exam'); await p.fill('#in-seed', String(seed)); await p.click('#in-xstart'); await p.waitForSelector('#in-xcard'); };
  const iGo = async (p, i, total = 20, lang = 'en') => {
    await p.click('#in-qm-' + i);
    await p.waitForFunction((w) => { const e = document.querySelector('.in-qn'); return !!e && e.textContent === w; }, F(II[lang].x_qn, i + 1, total));
  };
  /** textele de pe ecran, într-o listă (pentru verificări «conține») */
  const iAll = (p, sel) => p.$$eval(sel, (e) => e.map((x) => x.textContent.trim()));

  browser = await launch();
  await baseline(NAME, {ready, stateKey: K.prog, rawKey: RAW});

  await T(NAME + ': la pornire arată fila «Train», pachetul de exersare, numărătoarea, setările și limitele, în toate limbile', async () => {
    const h = await iOpen({time: T0});
    const p = h.page;
    for (const l of LANGS) {
      await p.selectOption('#langsel', l);
      await p.waitForSelector(ready);
      const I = II[l];
      eq((await p.$$eval('.in-tab', (e) => e.map((x) => x.textContent))).join('|'), [I.tab_train, I.tab_exam, I.tab_packs, I.tab_guide].join('|'), l + ': filele');
      eq(await p.$eval('#in-tt-train', (e) => e.getAttribute('aria-selected')), 'true', l);
      eq(await p.$$eval('.in-tab[aria-selected="true"]', (e) => e.length), 1, l);
      eq(await p.$$eval('.in-panel:not([hidden])', (e) => e.map((x) => x.id).join()), 'in-p-train', l);
      eq(await iText(p, '.in-count'), F(I.t_stats, 0, 50, 50), l + ': numărătoarea');
      eq((await p.$$eval('#in-lim-card li', (e) => e.map((x) => x.textContent))).join('\n'), [1, 2, 3, 4, 5, 6].map((i) => I['lim_' + i]).join('\n'), l + ': limitele');
      eq(await iText(p, '#in-lim-h'), I.h_limits, l);
      eq(await p.$eval('#in-live', (e) => e.getAttribute('role') + '/' + e.getAttribute('aria-live')), 'status/polite', l);
      eq(await p.$eval('html', (e) => e.lang), l);
    }
    await p.selectOption('#langsel', 'en');
    await p.waitForSelector(ready);
    eq(await p.$$eval('#in-pack option', (e) => e.map((x) => x.textContent)).then((a) => a.join('|')), PR.title);
    eq(await p.$$eval('#in-topic option', (e) => e.map((x) => x.textContent)).then((a) => a.join('|')), [II.en.f_all_topics].concat(IE.topicsOf(PR.questions)).join('|'));
    eq(await p.$$eval('#in-mode option', (e) => e.map((x) => x.value)).then((a) => a.join()), 'due,all,weak');
    eq(await p.inputValue('#in-new'), '10');
    eq(await p.$eval('#in-new', (e) => e.closest('.in-f').hidden), false, 'câmpul «întrebări noi pe zi» se vede în modul «scadente»');
    // fila «Guide»: cei cinci pași și scurtătura de tastatură
    await iTab(p, 'guide');
    eq(await p.$$eval('#in-p-guide .in-steps li', (e) => e.map((x) => x.textContent)).then((a) => a.join('\n')), [1, 2, 3, 4, 5].map((i) => II.en['gd_' + i]).join('\n'));
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': exersare: răspuns greșit și corect, explicație și sursă, reluarea la sfârșit, progres salvat, limita zilnică și întrebările scadente a doua zi', async () => {
    const h = await iOpen({time: T0});
    const p = h.page, D0 = iDay(T0), D1 = iDay(T1);
    const pst = async (id) => (await iStore(p, K.prog)).packs['zz-practice'][id];
    await p.click('#in-start');
    await p.waitForSelector('#in-card');
    eq(await iActive(p), 'in-qt', 'focalizarea trece pe întrebare');
    eq(await iText(p, '.in-qn'), F(II.en.t_qn, 1, 10));
    // prima întrebare: răspuns greșit
    const a1 = await iTrain(p, false);
    eq(await iActive(p), 'in-fb', 'focalizarea trece pe explicație');
    eq(await iText(p, '.in-res'), F(II.en.t_bad, plain(a1.q.answers[a1.q.correct])));
    ok(await p.$eval('.in-res', (e) => e.classList.contains('in-bad')));
    ok(await p.$eval('#in-ans-' + a1.k, (e) => e.classList.contains('in-wrong')), 'răspunsul greșit e marcat');
    ok(await p.$eval('#in-ans-' + a1.ri, (e) => e.classList.contains('in-right')), 'răspunsul corect e marcat');
    eq(await p.$$eval('.in-ans[aria-disabled="true"]', (e) => e.length), 4, 'răspunsurile se dezactivează');
    const expl = await iText(p, '.in-expl');
    ok(expl.startsWith(II.en.t_expl + ': ') && expl.includes(rt(a1.q.explanation)), 'explicația: ' + expl);
    const syl = PR.syllabus.find((s) => s.id === a1.q.syllabus_ref);
    eq(await iText(p, '.in-src'), II.en.t_source + ': ' + a1.q.source + ' · ' + F(II.en.w_syl, a1.q.syllabus_ref + ' ' + syl.title), 'sursa și punctul din programă');
    eq(await iText(p, '.in-note'), II.en.t_requeued);
    eq(await iText(p, '#in-next'), II.en.t_next);
    eq(JSON.stringify(await pst(a1.q.id)), JSON.stringify([1, D0, D0, 0, 1]), 'progres după un răspuns greșit: cutia 1, scadent azi');
    // un al doilea clic pe alt răspuns nu schimbă nimic
    await p.click('#in-ans-' + a1.ri, {force: true});   // aria-disabled=true: Playwright refuză clicul normal
    eq(await p.$$eval('.in-ans.in-wrong', (e) => e.length), 1);
    eq(JSON.stringify(await pst(a1.q.id)), JSON.stringify([1, D0, D0, 0, 1]), 'un clic după răspuns nu se numără');
    await p.click('#in-next');
    // a doua întrebare: corect
    await p.waitForSelector('#in-card:not(:has(#in-fb))');
    eq(await iText(p, '.in-qn'), F(II.en.t_qn, 2, 11), 'după un răspuns greșit lungimea sesiunii crește cu una (întrebarea revine la sfârșit)');
    const a2 = await iTrain(p, true);
    eq(await iText(p, '.in-res'), II.en.t_ok);
    eq(await p.$('.in-note'), null, 'un răspuns corect nu se reia');
    eq(JSON.stringify(await pst(a2.q.id)), JSON.stringify([1, D0 + 1, D0, 1, 0]), 'progres după un răspuns corect: cutia 1, scadent mâine');
    await p.click('#in-next');
    const right = [a2.q.id];
    for (let i = 3; i <= 10; i++) {
      await p.waitForSelector('#in-card:not(:has(#in-fb))');
      eq(await iText(p, '.in-qn'), F(II.en.t_qn, i, 11));
      const a = await iTrain(p, true);
      right.push(a.q.id);
      await p.click('#in-next');
    }
    // întrebarea greșită revine la sfârșit
    await p.waitForSelector('#in-card:not(:has(#in-fb))');
    eq(await iText(p, '.in-qn'), F(II.en.t_qn, 11, 11), 'a unsprezecea întrebare');
    eq((await iShown(p, '#in-qt')).id, a1.q.id, 'revine întrebarea greșită');
    await iTrain(p, true);
    eq(await iText(p, '#in-next'), II.en.t_last);
    eq(JSON.stringify(await pst(a1.q.id)), JSON.stringify([1, D0, D0, 0, 1]), 'răspunsul la reluare nu schimbă programul');
    await p.click('#in-next');
    await p.waitForSelector('#in-sum');
    eq(await iActive(p), 'in-sum');
    eq(await iText(p, '#in-sum'), II.en.t_done_h);
    eq(await iText(p, '.in-big'), F(II.en.t_done, 10, 9, 90), 'rezumat: reluarea nu se numără');
    // înapoi la setări: o întrebare scadentă, 40 noi, iar azi nu mai sunt întrebări noi de introdus
    await p.click('#in-again');
    await p.waitForSelector('#in-start');
    eq(await iActive(p), 'in-start');
    eq(await iText(p, '.in-count'), F(II.en.t_stats, 1, 40, 50));
    await p.click('#in-start');
    await p.waitForSelector('#in-card');
    eq(await iText(p, '.in-qn'), F(II.en.t_qn, 1, 1), 'doar întrebarea scadentă: cele 10 noi de azi sunt făcute');
    eq((await iShown(p, '#in-qt')).id, a1.q.id);
    await iTrain(p, true);
    eq(JSON.stringify(await pst(a1.q.id)), JSON.stringify([2, D0 + 3, D0, 1, 1]), 'a doua zi de lucru, același ceas: cutia 2');
    await p.click('#in-next');
    await p.waitForSelector('#in-sum');
    await p.click('#in-again');
    // a doua zi: cele nouă răspunse corect devin scadente, iar zece întrebări noi se pot introduce
    await p.clock.setFixedTime(new Date(T1));
    await iTab(p, 'exam');
    await iTab(p, 'train');
    eq(await iText(p, '.in-count'), F(II.en.t_stats, 9, 40, 50), 'a doua zi');
    await p.click('#in-start');
    await p.waitForSelector('#in-card');
    eq(await iText(p, '.in-qn'), F(II.en.t_qn, 1, 19), '9 scadente + 10 noi');
    const dueFirst = await iShown(p, '#in-qt');
    ok(right.includes(dueFirst.id), 'prima întrebare e una dintre cele scadente');
    const before = await pst(dueFirst.id);
    await iTrain(p, true);
    const want = IE.review({b: before[0], d: before[1], f: before[2], r: before[3], w: before[4]}, true, D1);
    eq(JSON.stringify(await pst(dueFirst.id)), JSON.stringify([want.b, want.d, want.f, want.r, want.w]), 'cutia a doua, scadent peste trei zile');
    eq(want.b, 2); eq(want.d, D1 + 3);
    noErr(h);
    ok(await iPoll(p), 'poluare de prototip');
    await h.ctx.close();
  });

  await T(NAME + ': tastatura în exersare: cifre și litere aleg răspunsul doar cât timp focalizarea e în card; Enter trece mai departe', async () => {
    const h = await iOpen({time: T0});
    const p = h.page;
    await p.click('#in-start');
    await p.waitForSelector('#in-card');
    eq(await iText(p, '.in-hint'), F(II.en.t_keys, 4, 'D'));
    let n = 10;   // o întrebare greșită se reia la sfârșit, deci lungimea sesiunii crește cu 1
    await p.keyboard.press('9');
    await p.keyboard.press('z');
    await p.keyboard.press('5');
    eq(await p.$('#in-fb'), null, 'tastele care nu sunt răspunsuri nu fac nimic');
    // litera «b» alege al doilea răspuns afișat
    if ((await iRightIndex(p)) !== 1) n++;
    await p.keyboard.press('b');
    await p.waitForSelector('#in-fb');
    eq(await iChosen(p), 1, 'litera b alege al doilea răspuns');
    await p.keyboard.press('a');
    await p.keyboard.press('3');
    eq(await iChosen(p), 1, 'după răspuns, alte taste nu mai răspund');
    await p.keyboard.press('Enter');
    await p.waitForSelector('#in-card:not(:has(#in-fb))');
    eq(await iText(p, '.in-qn'), F(II.en.t_qn, 2, n), 'Enter trece la următoarea');
    eq(await iActive(p), 'in-qt');
    // cifra «3» alege al treilea răspuns
    if ((await iRightIndex(p)) !== 2) n++;
    await p.keyboard.press('3');
    await p.waitForSelector('#in-fb');
    eq(await iChosen(p), 2, 'cifra 3 alege al treilea răspuns');
    await p.keyboard.press('Enter');
    await p.waitForSelector('#in-card:not(:has(#in-fb))');
    // litera «D» (mare) alege al patrulea răspuns
    if ((await iRightIndex(p)) !== 3) n++;
    await p.keyboard.press('D');
    await p.waitForSelector('#in-fb');
    eq(await iChosen(p), 3, 'litera D alege al patrulea răspuns');
    await p.click('#in-next');
    await p.waitForSelector('#in-card:not(:has(#in-fb))');
    // în afara cardului scurtăturile nu fac nimic (WCAG 2.1.4)
    await p.focus('#in-tt-guide');
    await p.keyboard.press('1');
    await p.keyboard.press('c');
    eq(await p.$('#in-fb'), null, 'cu focalizarea pe o filă, tastele nu răspund');
    await p.press('#in-tt-guide', 'Enter');
    await p.waitForSelector('#in-p-guide:not([hidden])');
    await p.keyboard.press('2');
    await iTab(p, 'train');
    eq(await p.$('#in-fb'), null, 'sesiunea continuă fără răspunsuri nedorite');
    eq(await iText(p, '.in-qn'), F(II.en.t_qn, 4, n), 'sesiunea rămâne la a patra întrebare după ce ai fost în alte file');
    // într-un câmp de text tastele rămân ale lui
    await iTab(p, 'packs');
    await p.fill('#in-imp-ta', 'abc 123 d');
    await p.keyboard.press('1');
    eq(await p.inputValue('#in-imp-ta'), 'abc 123 d1');
    await iTab(p, 'train');
    eq(await p.$('#in-fb'), null, 'cifra scrisă într-un câmp nu răspunde la întrebare');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': examen cu sămânță: întrebările și ordinea răspunsurilor sunt cele ale motorului; hartă, marcaj, ștergere, confirmare la terminare, rezultat, istoric, repetare', async () => {
    const h = await iOpen({time: T0});
    const p = h.page, D0 = iDay(T0), SEED = 7;
    const xam = EXAM(SEED);
    eq(xam.n, 20);
    // ecranul de pregătire
    await iTab(p, 'exam');
    eq(await iText(p, '.in-rules'), F(II.en.x_rules, 20, 30, 75));
    ok((await iAll(p, '.in-hint')).includes(II.en.x_rules_def), 'regulile de exersare sunt spuse ca atare');
    ok((await iAll(p, '.in-hint')).includes(II.en.x_hist_none), 'niciun examen încă');
    eq(await p.$('.in-note'), null, 'pachetul are destule întrebări');
    eq(await p.$('.in-hist'), null);
    await p.fill('#in-seed', String(SEED));
    await p.click('#in-xstart');
    await p.waitForSelector('#in-xcard');
    eq(await iActive(p), 'in-xqt', 'focalizarea trece pe prima întrebare');
    eq(await iText(p, '.in-meta'), F(II.en.r_seed, SEED));
    eq(await iText(p, '#in-clock'), '30:00');
    eq(await p.$eval('#in-timer', (e) => e.getAttribute('role') + '/' + e.getAttribute('aria-live')), 'timer/off');
    eq(await p.$$eval('#in-xcard input[type=radio]', (e) => e.every((x) => x.name === 'in-xa' && !x.checked)), true, 'niciun răspuns ales');
    eq(await p.$$eval('.in-map button', (e) => e.length), 20);
    eq(await p.inputValue('#in-seed').catch(() => null), null, 'câmpul de sămânță dispare în timpul examenului');
    // parcurge toate cele 20 de întrebări: textul, ordinea răspunsurilor, butoanele și harta
    for (let i = 0; i < 20; i++) {
      if (i) await p.click('#in-xnext');
      const q = BYID.get(xam.ids[i]);
      eq(await iText(p, '.in-qn'), F(II.en.x_qn, i + 1, 20));
      eq((await iShown(p, '#in-xqt')).id, q.id, 'întrebarea ' + (i + 1));
      eq(JSON.stringify(await iAnsTexts(p, '#in-xcard')), JSON.stringify(IE.answerOrder(q, SEED).map((o) => rt(q.answers[o]))), 'ordinea răspunsurilor la întrebarea ' + (i + 1));
      eq(await p.$eval('#in-xprev', (e) => e.disabled), i === 0);
      eq(await p.$eval('#in-xnext', (e) => e.disabled), i === 19);
      eq(await p.$eval('#in-xqt', (e) => e.getAttribute('lang')), PR.lang);
      eq(await p.$$eval('.in-map button[aria-current="true"]', (e) => e.map((x) => x.id).join()), 'in-qm-' + i);
      eq(await p.$eval('#in-qm-' + i, (e) => e.getAttribute('aria-label')), F(II.en.x_map_item, i + 1, II.en.x_st_open));
      eq(await p.$eval('#in-xclear', (e) => e.hidden), true, 'butonul de ștergere se ascunde cât timp nu e ales niciun răspuns');
    }
    await iGo(p, 0);
    eq(await iActive(p), 'in-xqt');
    // marcaj
    await iGo(p, 2);
    await p.click('#in-xflag');
    eq(await iText(p, '#in-xflag'), II.en.x_unflag);
    ok((await p.$eval('#in-qm-2', (e) => e.className)).includes('in-mp-flag'));
    eq(await p.$eval('#in-qm-2', (e) => e.getAttribute('aria-label')), F(II.en.x_map_item, 3, II.en.x_st_open + ', ' + II.en.x_st_flag));
    eq(await iActive(p), 'in-xflag', 'marcajul nu mută focalizarea');
    eq(JSON.stringify((await iStore(p, K.run)).flags), JSON.stringify({[xam.ids[2]]: true}), 'marcajul se salvează');
    // răspunsuri: 0..14 corecte, 15 greșit, 16..19 fără răspuns; la 3 se greșește întâi, se șterge, apoi se răspunde corect
    const picked = {};
    for (let i = 0; i <= 15; i++) {
      await iGo(p, i);
      const q = BYID.get(xam.ids[i]);
      if (i === 3) {
        const w = await iExamPick(p, false);
        ok((await p.$eval('#in-qm-3', (e) => e.className)).includes('in-mp-done'));
        eq(await p.$eval('#in-xclear', (e) => e.hidden), false, 'butonul de ștergere apare după un răspuns');
        eq(JSON.stringify((await iStore(p, K.run)).answers[q.id]), JSON.stringify(w.orig), 'răspunsul se salvează cu indicele din fișier, nu cu poziția afișată');
        await p.click('#in-xclear');
        eq(await p.$$eval('#in-xcard input:checked', (e) => e.length), 0, 'nicio opțiune bifată după ștergere');
        eq(await p.$eval('#in-xclear', (e) => e.hidden), true);
        eq(await iActive(p), 'in-xa-0', 'după ștergere focalizarea trece pe prima opțiune');
        ok(!(await p.$eval('#in-qm-3', (e) => e.className)).includes('in-mp-done'));
        eq((await iStore(p, K.run)).answers[q.id], undefined, 'răspunsul șters nu mai e salvat');
      }
      const a = await iExamPick(p, i !== 15);
      picked[q.id] = a.orig;
      eq(await p.$eval('#in-xa-' + a.k, (e) => e.checked), true, 'opțiunea aleasă e bifată');
      ok((await p.$eval('#in-qm-' + i, (e) => e.className)).includes('in-mp-done'));
      eq(await p.$eval('#in-qm-' + i, (e) => e.getAttribute('aria-label')), F(II.en.x_map_item, i + 1, II.en.x_st_done + (i === 2 ? ', ' + II.en.x_st_flag : '')));
      eq((await iStore(p, K.run)).answers[q.id], a.orig);
    }
    // schimbarea răspunsului înlocuiește alegerea
    await iGo(p, 15);
    const q15 = BYID.get(xam.ids[15]);
    const rightIdx = (await iAnsTexts(p, '#in-xcard')).indexOf(rt(q15.answers[q15.correct]));
    await p.click('label[for="in-xa-' + rightIdx + '"]');
    eq((await iStore(p, K.run)).answers[q15.id], q15.correct, 'schimbarea răspunsului se salvează');
    const w15 = await iExamPick(p, false);
    picked[q15.id] = w15.orig;
    eq((await iStore(p, K.run)).answers[q15.id], w15.orig);
    eq(await p.$$eval('#in-xcard input:checked', (e) => e.length), 1, 'o singură opțiune bifată');
    // tastatura: cifra alege opțiunea doar cu focalizarea în card
    await iGo(p, 16);
    await p.keyboard.press('2');
    eq(await p.$eval('#in-xa-1', (e) => e.checked), true, 'cifra 2 alege a doua opțiune');
    await p.click('#in-xclear');
    await p.focus('#in-xfinish');
    await p.keyboard.press('3');
    eq(await p.$$eval('#in-xcard input:checked', (e) => e.length), 0, 'în afara cardului cifra nu alege nimic');
    // terminare cu confirmare: 4 întrebări fără răspuns (16–19)
    await p.click('#in-xfinish');
    await p.waitForSelector('#in-xsure');
    eq(await iActive(p), 'in-xsure');
    eq(await iText(p, '#in-xsure .in-bad'), F(II.en.x_sure, 4));
    eq(await iText(p, '#in-xsure-go'), II.en.x_sure_go);
    await p.click('#in-xflag');                                           // orice schimbare retrage confirmarea
    eq(await p.$('#in-xsure'), null, 'confirmarea dispare când se schimbă ceva');
    await p.click('#in-xflag');
    await p.click('#in-xfinish');
    await p.waitForSelector('#in-xsure');
    await p.click('#in-xsure-go');
    await p.waitForSelector('#in-res');
    // rezultat
    const sc = IE.scoreExam(xam, picked, Object.fromEntries(PR.questions.map((q) => [q.id, q])));
    eq([sc.right, sc.wrong, sc.blank, sc.percent, sc.passed].join(), '15,1,4,75,true', 'așteptarea din motor');
    eq(await iActive(p), 'in-res');
    eq(await iText(p, '#in-res'), II.en.r_h);
    eq(await iText(p, '.in-big'), F(II.en.r_score, 15, 20, '75'));
    eq(await iText(p, 'p.in-res'), F(II.en.r_pass, '75', 75));
    ok(await p.$eval('p.in-res', (e) => e.classList.contains('in-ok')));
    ok((await iAll(p, '.in-box > p')).includes(F(II.en.r_blank, 4)));
    eq(await iText(p, '.in-meta'), F(II.en.r_seed, SEED) + ' · ' + F(II.en.r_time, '00:00'));
    eq(await p.$('.in-note'), null, 'examenul nu s-a încheiat din cauza timpului');
    const rows = await p.$$eval('.in-tbl tbody tr', (e) => e.map((r) => Array.from(r.children).map((c) => c.textContent)));
    eq(JSON.stringify(rows), JSON.stringify(sc.topics.map((t) => [t.topic, String(t.n), String(t.right), String(t.wrong), String(t.blank)])), 'tabelul pe subiecte');
    eq(await p.$$eval('.in-tbl thead th', (e) => e.map((x) => x.textContent).join('|')), ['th_topic', 'th_n', 'th_right', 'th_wrong', 'th_blank'].map((k) => II.en[k]).join('|'));
    const bad = xam.ids.filter((id) => picked[id] !== BYID.get(id).correct);
    eq(bad.length, 5);
    const items = await p.$$eval('.in-rvl > li', (e) => e.map((li) => ({n: li.querySelector('.in-qn').textContent, q: li.querySelector('.in-qt').textContent, y: li.querySelector('p.in-bad').textContent, c: li.querySelector('p.in-ok').textContent, x: (li.querySelector('.in-expl') || {textContent: ''}).textContent})));
    eq(items.length, 5, 'întrebările de revăzut: o greșită și patru fără răspuns');
    bad.forEach((id, k) => {
      const q = BYID.get(id), it = items[k];
      eq(it.n, F(II.en.x_qn, xam.ids.indexOf(id) + 1, 20));
      eq(it.q, rt(q.question));
      eq(it.y, II.en.r_yours + ': ' + (has_(picked, id) ? rt(q.answers[picked[id]]) : II.en.r_none));
      eq(it.c, II.en.r_correct + ': ' + rt(q.answers[q.correct]));
      ok(it.x.startsWith(II.en.t_expl + ': ') && it.x.includes(rt(q.explanation)));
    });
    // starea salvată: examenul s-a încheiat, rezultatul e în istoric
    eq(await iStore(p, K.run), null, 'examenul terminat nu mai e salvat');
    const st = await iStore(p, K.prog);
    eq(JSON.stringify(st.history), JSON.stringify([{pack: 'zz-practice', day: D0, n: 20, right: 15, percent: 75, passed: true, seed: SEED, secs: 0}]));
    // repetă același examen: aceleași întrebări, niciun răspuns
    await p.click('#in-xrepeat');
    await p.waitForSelector('#in-xcard');
    eq((await iShown(p, '#in-xqt')).id, xam.ids[0], 'aceeași sămânță dă aceleași întrebări');
    eq(await p.$$eval('.in-map .in-mp-done', (e) => e.length), 0);
    eq((await iStore(p, K.run)).seed, SEED);
    await p.click('#in-xfinish');
    await p.waitForSelector('#in-xsure');
    eq(await iText(p, '#in-xsure .in-bad'), F(II.en.x_sure, 20));
    await p.click('#in-xsure-go');
    await p.waitForSelector('#in-res');
    eq(await iText(p, '.in-big'), F(II.en.r_score, 0, 20, '0'));
    eq(await iText(p, 'p.in-res'), F(II.en.r_fail, '0', 75));
    ok(await p.$eval('p.in-res', (e) => e.classList.contains('in-bad')));
    eq(await p.$$eval('.in-rvl > li', (e) => e.length), 20, 'toate cele 20 de întrebări de revăzut');
    // examen nou: istoricul arată rezultatele, cele noi primele
    await p.click('#in-xnew');
    await p.waitForSelector('#in-xstart');
    eq(await iActive(p), 'in-xstart');
    const hist = await iAll(p, '.in-hist li');
    eq(hist.length, 2);
    eq(hist[0], F(II.en.x_hist, '2026-11-17', PR.title, 0, 20, '0') + ' · ' + II.en.x_failed);
    eq(hist[1], F(II.en.x_hist, '2026-11-17', PR.title, 15, 20, '75') + ' · ' + II.en.x_passed);
    noErr(h);
    ok(await iPoll(p), 'poluare de prototip');
    await h.ctx.close();
  });

  // ---------- cronometrul și reluarea examenului ----------
  const NOW = Date.parse(T0) + 20000;   // ceasul fals oprit aici: de aici timpul trece doar prin runFor, deci cifrele sunt exacte
  async function iClock(o = {}) {
    const h = await iOpen(Object.assign({clock: T0}, o));
    await h.page.clock.pauseAt(new Date(NOW));
    return h;
  }
  const iRun = (p) => iStore(p, K.run);
  const histOf = async (p) => (await iStore(p, K.prog)).history;

  await T(NAME + ': cronometrul: 30:00 → 28:59 după un minut; avertismente la 5 și 2 minute; la expirare examenul se încheie singur și se notează', async () => {
    const h = await iClock();
    const p = h.page, D0 = iDay(T0), SEED = 11;
    await iSeedExam(p, SEED);
    eq(await iText(p, '#in-clock'), '30:00');
    eq((await iRun(p)).start, NOW, 'începutul examenului e ora ceasului');
    for (let i = 0; i < 3; i++) { await iGo(p, i); await iExamPick(p, true); }   // trei răspunsuri corecte înainte de expirare
    await p.clock.runFor(61000);
    eq(await iText(p, '#in-clock'), '28:59');
    eq(await iLive(p), '', 'niciun avertisment încă');
    await p.clock.runFor(1438000);                                               // 1499 s: o secundă înainte de 5:00
    eq(await iText(p, '#in-clock'), '05:01');
    eq(await iLive(p), '');
    await p.clock.runFor(1000);
    eq(await iText(p, '#in-clock'), '05:00');
    eq(await iLive(p), F(II.en.x_warn, 5));
    await p.clock.runFor(179000);
    eq(await iText(p, '#in-clock'), '02:01');
    eq(await iLive(p), F(II.en.x_warn, 5), 'avertismentul rămâne până la următorul');
    await p.clock.runFor(1000);
    eq(await iText(p, '#in-clock'), '02:00');
    eq(await iLive(p), F(II.en.x_warn, 2));
    await p.clock.runFor(119000);
    eq(await iText(p, '#in-clock'), '00:01');
    ok(await p.$('#in-xcard'), 'cu o secundă înainte de final examenul e încă deschis');
    await p.clock.runFor(1000);
    await p.waitForSelector('#in-res');
    eq(await iLive(p), II.en.x_timeup);
    eq(await iActive(p), 'in-res');
    eq(await iText(p, '.in-note'), II.en.x_timeup);
    eq(await iText(p, '.in-big'), F(II.en.r_score, 3, 20, '15'));
    eq(await iText(p, 'p.in-res'), F(II.en.r_fail, '15', 75));
    eq(await iText(p, '.in-meta'), F(II.en.r_seed, SEED) + ' · ' + F(II.en.r_time, '30:00'));
    eq(await p.$('#in-timer'), null, 'cronometrul dispare');
    eq(await iRun(p), null, 'examenul terminat nu mai e salvat');
    eq(JSON.stringify(await histOf(p)), JSON.stringify([{pack: 'zz-practice', day: D0, n: 20, right: 3, percent: 15, passed: false, seed: SEED, secs: 1800}]));
    await p.clock.runFor(10000);                                                 // după expirare nu mai rulează nimic
    eq(await iText(p, '.in-big'), F(II.en.r_score, 3, 20, '15'));
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': examenul curge și când ești în altă filă; dacă timpul expiră acolo, rezultatul te așteaptă în fila «Exam» fără să-ți fure focalizarea', async () => {
    const h = await iClock();
    const p = h.page;
    await iSeedExam(p, 3);
    await iGo(p, 4);
    await iExamPick(p, true);
    await iTab(p, 'packs');
    await p.clock.runFor(10 * 60000);
    await iTab(p, 'exam');
    eq(await iText(p, '#in-clock'), '20:00', 'timpul a trecut și în afara filei');
    eq(await iText(p, '.in-qn'), F(II.en.x_qn, 5, 20), 'aceeași întrebare');
    ok((await p.$eval('#in-qm-4', (e) => e.className)).includes('in-mp-done'));
    await iTab(p, 'guide');
    await p.clock.runFor(21 * 60000);
    eq(await iLive(p), II.en.x_timeup, 'anunțul de timp expirat apare oriunde ai fi');
    ok((await iActive(p)) !== 'in-res', 'focalizarea nu e mutată din altă filă');
    eq(await iRun(p), null);
    await iTab(p, 'exam');
    await p.waitForSelector('#in-res');
    eq(await iText(p, '.in-note'), II.en.x_timeup);
    eq(await iText(p, '.in-big'), F(II.en.r_score, 1, 20, '5'));
    eq((await histOf(p))[0].secs, 1800);
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': examenul scurt (8 minute) are doar avertismentul de 2 minute, iar după reîncărcare cele deja trecute nu se mai repetă', async () => {
    const rules = {questions: 10, minutes: 8, pass_percent: 60, wrong_penalty: 0};
    const start = NOW - 6 * 60000 - 30000;                         // la ora ceasului au rămas 1:30
    const h0 = await iClock({store: {[K.run]: runOf(21, {rules, start: NOW - 60000})}});   // a început acum un minut: au rămas 7:00
    const p = h0.page;
    eq(await iLive(p), II.en.x_resumed);
    await p.clock.runFor(1000);
    eq(await iText(p, '#in-clock'), '06:59');
    await p.clock.runFor(4 * 60000);                               // rămân 2:59, deci cele 5 minute nu avertizează deloc (8 < 10)
    eq(await iText(p, '#in-clock'), '02:59');
    eq(await iLive(p), II.en.x_resumed, 'niciun avertisment de 5 minute la un examen de 8 minute');
    await p.clock.runFor(59000);
    eq(await iText(p, '#in-clock'), '02:00');
    eq(await iLive(p), F(II.en.x_warn, 2));
    noErr(h0);
    await h0.ctx.close();
    // examen deschis când mai are 1:30 → ambele avertismente sunt «deja date», nu se mai afișează
    const h1 = await iClock({store: {[K.run]: runOf(21, {rules, start})}});
    const q = h1.page;
    eq(await iText(q, '#in-clock'), '01:30');
    await q.clock.runFor(30000);
    eq(await iText(q, '#in-clock'), '01:00');
    eq(await iLive(q), II.en.x_resumed, 'după reluare nu se mai anunță un prag deja depășit');
    await q.clock.runFor(60000);
    await q.waitForSelector('#in-res');
    eq(await iText(q, '.in-note'), II.en.x_timeup);
    eq((await histOf(q))[0].secs, 8 * 60);
    eq((await histOf(q))[0].n, 10);
    noErr(h1);
    await h1.ctx.close();
  });

  await T(NAME + ': examenul început continuă după reîncărcare: întrebarea, răspunsurile, marcajele; cu timpul scurs, iar dacă timpul a expirat între timp, se încheie la încărcare', async () => {
    const h0 = await iOpen({time: T0});
    let p = h0.page;
    const SEED = 5, xam = EXAM(SEED);
    await iSeedExam(p, SEED);
    await iGo(p, 0); const a0 = await iExamPick(p, true);
    await iGo(p, 1); const a1 = await iExamPick(p, false);
    await iGo(p, 2); await p.click('#in-xflag');
    await iGo(p, 5);
    const before = await iRun(p);
    eq(JSON.stringify(before.answers), JSON.stringify({[xam.ids[0]]: a0.orig, [xam.ids[1]]: a1.orig}));
    noErr(h0);
    const h = await iReopen(h0);
    p = h.page;
    await p.waitForSelector('#in-xcard');
    eq(await p.$eval('#in-tt-exam', (e) => e.getAttribute('aria-selected')), 'true', 'se reia direct fila «Exam»');
    eq(await iLive(p), II.en.x_resumed);
    eq(await iText(p, '.in-qn'), F(II.en.x_qn, 6, 20));
    eq(await iText(p, '#in-clock'), '30:00');
    eq(await p.$$eval('.in-map .in-mp-done', (e) => e.map((x) => x.id).join()), 'in-qm-0,in-qm-1');
    eq(await p.$$eval('.in-map .in-mp-flag', (e) => e.map((x) => x.id).join()), 'in-qm-2');
    eq(JSON.stringify(await iRun(p)), JSON.stringify(before), 'starea salvată rămâne neschimbată');
    for (const [i, a] of [[0, a0], [1, a1]]) {
      await iGo(p, i);
      const q = BYID.get(xam.ids[i]);
      const k = IE.answerOrder(q, SEED).indexOf(a.orig);
      eq(await p.$eval('#in-xa-' + k, (e) => e.checked), true, 'răspunsul de la întrebarea ' + (i + 1) + ' e bifat după reîncărcare');
    }
    await iGo(p, 2);
    eq(await iText(p, '#in-xflag'), II.en.x_unflag);
    noErr(h);
    await h.ctx.close();
    // cu timpul scurs: începutul e cu 12 minute în urmă
    const ans = {[xam.ids[0]]: BYID.get(xam.ids[0]).correct};
    const h2 = await iOpen({time: T0, store: {[K.run]: runOf(SEED, {start: Date.parse(T0) - 12 * 60000, answers: ans, cur: 3})}});
    await h2.page.waitForSelector('#in-xcard');
    eq(await iText(h2.page, '#in-clock'), '18:00');
    eq(await iText(h2.page, '.in-qn'), F(II.en.x_qn, 4, 20));
    eq(await iLive(h2.page), II.en.x_resumed);
    noErr(h2);
    await h2.ctx.close();
    // timpul a expirat cât pagina era închisă: la încărcare examenul e deja notat
    const ans2 = {}; xam.ids.slice(0, 5).forEach((id) => { ans2[id] = BYID.get(id).correct; });
    const h3 = await iOpen({time: T0, store: {[K.run]: runOf(SEED, {start: Date.parse(T0) - 31 * 60000, answers: ans2})}});
    const r = h3.page;
    await r.waitForSelector('#in-res');
    eq(await iText(r, '.in-note'), II.en.x_timeup);
    eq(await iText(r, '.in-big'), F(II.en.r_score, 5, 20, '25'));
    eq(await iLive(r), '', 'la încărcare nu se anunță nimic: rezultatul se vede în fila «Exam»');
    ok((await iActive(r)) !== 'in-res', 'la încărcare focalizarea nu e mutată');
    eq(await iRun(r), null);
    const hs = await histOf(r);
    eq(JSON.stringify(hs), JSON.stringify([{pack: 'zz-practice', day: iDay(T0), n: 20, right: 5, percent: 25, passed: false, seed: SEED, secs: 1800}]));
    // după redeschidere rezultatul nu se mai arată, dar rămâne în istoric
    noErr(h3);
    const h4 = await iReopen(h3);
    await iTab(h4.page, 'exam');
    eq(await h4.page.$('#in-res'), null);
    eq((await iAll(h4.page, '.in-hist li')).length, 1);
    noErr(h4);
    await h4.ctx.close();
  });

  await T(NAME + ': un examen salvat care nu se potrivește (semnătură, pachet, sămânță, reguli, tipuri) se abandonează fără erori și fără urme', async () => {
    const SEED = 9, xam = EXAM(SEED), start = Date.parse(T0) - 5 * 60000;
    const base = JSON.parse(runOf(SEED, {start}));
    const mut = (f) => { const o = JSON.parse(JSON.stringify(base)); f(o); return JSON.stringify(o); };
    const CASES = {
      'semnătură greșită': mut((o) => { o.sig = (o.sig + 1) >>> 0; }),
      'semnătură lipsă': mut((o) => { delete o.sig; }),
      'pachet necunoscut': mut((o) => { o.pack = 'nu-exista'; }),
      'pachet nu e text': mut((o) => { o.pack = 5; }),
      'sămânță negativă': mut((o) => { o.seed = -1; }),
      'sămânță zecimală': mut((o) => { o.seed = 1.5; }),
      'sămânță prea mare': mut((o) => { o.seed = 4294967296; }),
      'început 0': mut((o) => { o.start = 0; }),
      'început text': mut((o) => { o.start = String(o.start); }),
      'minute 0': mut((o) => { o.rules.minutes = 0; }),
      'minute 601': mut((o) => { o.rules.minutes = 601; }),
      'minute text': mut((o) => { o.rules.minutes = '30'; }),
      'întrebări 0': mut((o) => { o.rules.questions = 0; }),
      'întrebări 201': mut((o) => { o.rules.questions = 201; }),
      'promovare 0': mut((o) => { o.rules.pass_percent = 0; }),
      'promovare 101': mut((o) => { o.rules.pass_percent = 101; }),
      'penalizare 2': mut((o) => { o.rules.wrong_penalty = 2; }),
      'penalizare negativă': mut((o) => { o.rules.wrong_penalty = -0.5; }),
      'penalizare null': mut((o) => { o.rules.wrong_penalty = null; }),
      'reguli lipsă': mut((o) => { delete o.rules; }),
      'reguli listă': mut((o) => { o.rules = [30, 20]; }),
      'altă sămânță cu aceeași semnătură': mut((o) => { o.seed = 10; }),
      'JSON rupt': '{"pack":"zz-practice","seed":9,',
      'listă': '[]',
      'număr': '5',
      'text': '"examen"',
      'null': 'null'
    };
    for (const name of Object.keys(CASES)) {
      const h = await iOpen({time: T0, store: {[K.run]: CASES[name]}});
      const p = h.page;
      await p.waitForSelector('#in-tt-train');
      eq(await p.$eval('#in-tt-train', (e) => e.getAttribute('aria-selected')), 'true', name + ': se deschide fila «Train», nu examenul');
      eq(await iLive(p), '', name + ': niciun mesaj de reluare');
      await iTab(p, 'exam');
      ok(await p.$('#in-xstart'), name + ': examenul se poate porni din nou');
      eq(await iRun(p), null, name + ': starea abandonată e ștearsă');
      noErr(h);
      await h.ctx.close();
    }
    ok(xam.n === 20);
  });

  await T(NAME + ': un examen salvat cu chei ostile (__proto__, constructor, tipuri greșite) se curăță fără poluare de prototip', async () => {
    const SEED = 9, xam = EXAM(SEED), ids = xam.ids;
    const good = BYID.get(ids[4]).correct;
    let text = runOf(SEED, {start: Date.parse(T0) - 60000, answers: {[ids[4]]: good, [ids[0]]: 99, [ids[1]]: -1, [ids[2]]: '1', [ids[3]]: 1.5, 'ZZ-practice-9999': 0}, flags: {[ids[2]]: true, [ids[1]]: 'yes', [ids[3]]: 1}, cur: 999});
    text = text.replace('"answers":{', '"answers":{"__proto__":{"polluted":1},"constructor":1,"toString":0,').replace('"flags":{', '"flags":{"__proto__":true,"hasOwnProperty":true,');
    const h = await iOpen({time: T0, store: {[K.run]: text}});
    const p = h.page;
    await p.waitForSelector('#in-xcard');
    eq(await iText(p, '.in-qn'), F(II.en.x_qn, 1, 20), '«cur» necunoscut → prima întrebare');
    eq(await p.$$eval('.in-map .in-mp-done', (e) => e.map((x) => x.id).join()), 'in-qm-4', 'doar răspunsul valid rămâne');
    eq(await p.$$eval('.in-map .in-mp-flag', (e) => e.map((x) => x.id).join()), 'in-qm-2', 'doar marcajul valid rămâne');
    await p.click('#in-xflag');                                       // forțează o scriere: ce se salvează nu mai are chei ostile
    const saved = await iRun(p);
    eq(JSON.stringify(Object.keys(saved.answers)), JSON.stringify([ids[4]]));
    eq(JSON.stringify(Object.keys(saved.flags).sort()), JSON.stringify([ids[0], ids[2]].sort()));
    ok(await iPoll(p), 'Object.prototype nu e poluat');
    noErr(h);
    await h.ctx.close();
  });

  // ---------- pachete: afișare, import, înlocuire, ștergere, copii de siguranță ----------
  const pct0 = (a, b) => b ? Math.round(a * 100 / b) : 0;
  const objsOf = (m) => { const o = {}; Object.keys(m).forEach((k) => { const a = m[k]; o[k] = {b: a[0], d: a[1], f: a[2], r: a[3], w: a[4]}; }); return o; };
  const statRows = (qs, prog, today) => IE.topicStats(qs, prog, today).map((r) => [r.topic, String(r.total), String(r.seen), r.right + r.wrong ? pct0(r.right, r.right + r.wrong) + ' %' : '–', String(r.mastered), String(r.due)]);
  const mkQ = (pid, i, o = {}) => Object.assign({id: 'ZZ-' + pid.replace(/[^a-z0-9]/gi, '') + '-' + String(i + 1).padStart(4, '0'), topic: 'Topic ' + (i % 3 + 1), question: 'What is the answer to question ' + (i + 1) + ' of ' + pid + '?', answers: ['Right ' + (i + 1), 'Wrong A ' + (i + 1), 'Wrong B ' + (i + 1), 'Wrong C ' + (i + 1)], correct: 0, explanation: 'Because ' + (i + 1) + '.', source: 'Test source'}, o);
  const mkPack = (pid, n, o = {}) => Object.assign({format: 'indicativ-pack', version: 1, id: pid, title: 'Test pack ' + pid, country: 'HU', licence_class: 'test', lang: 'en', source: 'Test source', license: 'CC0-1.0', questions: Array.from({length: n}, (_, i) => mkQ(pid, i))}, o);
  const lineOf = (code) => {                                               // ca issueLine din pagină: «Unde: ce»
    const x = IE.issueParts(code);
    const label = x.lk ? (x.la === undefined ? II.en[x.lk] : F(II.en[x.lk], x.la)) : x.la;
    return label + ': ' + (x.ta === undefined ? II.en[x.tk] : F(II.en[x.tk], x.ta));
  };
  const iImp = async (p, text) => { await p.fill('#in-imp-ta', text); await p.click('#in-imp-go'); };
  const iCards = (p) => p.$$eval('.in-pack > .in-pk-h', (e) => e.map((x) => x.id.replace('in-pk-h-', '')));
  const iFile = (p, sel, name, text) => p.setInputFiles(sel, {name: name, mimeType: 'application/json', buffer: Buffer.from(text, 'utf8')});
  const quotaOn = (p, key) => p.evaluate((k) => {                          // setItem aruncă pentru cheia dată, ca un browser cu spațiul epuizat
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, v) { if (key === k) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } return orig.apply(this, arguments); };
  }, key);

  await T(NAME + ': fila «Packs»: pachetul încorporat, tabelul pe subiecte, descărcarea identică cu fișierul din depozit, resetarea progresului în doi pași', async () => {
    const D0 = iDay(T0);
    const prog0 = {'ZZ-practice-0001': [1, D0 + 1, D0, 2, 1], 'ZZ-practice-0002': [4, D0 + 14, D0 - 3, 5, 0], 'ZZ-practice-0003': [2, D0 - 1, D0 - 5, 1, 2]};
    const hist0 = [{pack: 'zz-practice', day: D0 - 1, n: 20, right: 17, percent: 85, passed: true, seed: 3, secs: 900}];
    const h = await iOpen({time: T0, store: {[K.prog]: progOf(prog0, hist0)}});
    const p = h.page;
    await iTab(p, 'exam');
    eq((await iAll(p, '.in-hist li')).join(), F(II.en.x_hist, '2026-11-16', PR.title, 17, 20, '85') + ' · ' + II.en.x_passed, 'istoricul salvat se vede');
    await iTab(p, 'packs');
    eq((await iCards(p)).join(), 'zz-practice');
    eq(await iText(p, '#in-pk-h-zz-practice'), PR.title + ' ' + II.en.p_built);
    const metas = await iAll(p, '.in-pack .in-meta');
    eq(metas[0], F(II.en.p_meta, II.en.cl_zz, PR.licence_class, PR.lang, 50));
    eq(metas[1], F(II.en.p_src, PR.source));
    eq(metas[2], F(II.en.p_lic, PR.license));
    eq(metas.length, 3, 'pachetul încorporat nu are reguli de examen proprii');
    eq(await p.$('#in-pk-rm-zz-practice'), null, 'pachetul încorporat nu se poate șterge');
    eq(await p.$eval('.in-tblwrap', (e) => e.getAttribute('role') + '/' + e.getAttribute('tabindex') + '/' + e.getAttribute('aria-labelledby').split(' ').map((i) => (document.getElementById(i) || {}).id).join(' ')), 'region/0/in-pk-t-zz-practice in-st-h-zz-practice', 'regiunea tabelului e numită după titlul pachetului și titlul tabelului');
    eq(await p.$eval('.in-tblwrap', (e) => e.getAttribute('aria-labelledby').split(' ').map((i) => document.getElementById(i).textContent).join(' | ')), PR.title + ' | ' + II.en.p_topics_h);
    const rows = async () => p.$$eval('.in-pack .in-tbl tbody tr', (e) => e.map((r) => Array.from(r.children).map((c) => c.textContent)));
    eq(JSON.stringify(await rows()), JSON.stringify(statRows(PR.questions, objsOf(prog0), D0)), 'tabelul pe subiecte');
    eq(await p.$$eval('.in-pack .in-tbl thead th', (e) => e.map((x) => x.textContent).join('|')), ['th_topic', 'th_total', 'th_seen', 'th_acc', 'th_mast', 'th_due'].map((k) => II.en[k]).join('|'));
    // descărcarea pachetului: aceleași octeți ca fișierul din depozit
    const dl = await iDl(p, '#in-pk-dl-zz-practice');
    eq(dl.name, 'zz-practice.json');
    eq(dl.text, PR_TEXT, 'pachetul descărcat e identic cu data/packs/zz-practice.json');
    // resetarea: primul clic doar cere confirmarea
    await p.click('#in-pk-rs-zz-practice');
    eq(await iText(p, '#in-pk-rs-zz-practice'), II.en.p_reset_sure);
    ok((await p.$eval('#in-pk-rs-zz-practice', (e) => e.className)).includes('pri'));
    eq(await iActive(p), 'in-pk-rs-zz-practice');
    eq(JSON.stringify(await rows()), JSON.stringify(statRows(PR.questions, objsOf(prog0), D0)), 'primul clic nu șterge nimic');
    await iTab(p, 'guide');
    await iTab(p, 'packs');
    eq(await iText(p, '#in-pk-rs-zz-practice'), II.en.p_reset, 'confirmarea se retrage dacă pleci din filă');
    await p.click('#in-pk-rs-zz-practice');
    await p.click('#in-pk-rs-zz-practice');
    eq(await iLive(p), F(II.en.p_reset_done, PR.title));
    eq(await iActive(p), 'in-pk-h-zz-practice');
    eq(JSON.stringify(await rows()), JSON.stringify(statRows(PR.questions, {}, D0)));
    const st = await iStore(p, K.prog);
    eq(JSON.stringify(st.packs['zz-practice']), '{}');
    eq(JSON.stringify(st.history), '[]', 'rezultatele de examen ale pachetului se șterg odată cu progresul');
    await iTab(p, 'train');
    eq(await iText(p, '.in-count'), F(II.en.t_stats, 0, 50, 50));
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': import din text și din fișier, înlocuire cu progres păstrat, ștergere în doi pași, descărcare identică cu pachetul importat', async () => {
    const h = await iOpen({time: T0});
    const p = h.page;
    const pk = mkPack('imp-one', 12, {lang: 'hu', licence_class: 'HAREC', source_url: 'https://example.org/bank'});
    await iTab(p, 'packs');
    await iImp(p, JSON.stringify(pk));
    await p.waitForSelector('#in-pk-h-imp-one');
    eq(await iLive(p), F(II.en.i_done, pk.title, 12));
    eq(await iActive(p), 'in-pk-h-imp-one');
    eq((await iCards(p)).join(), 'zz-practice,imp-one');
    eq(await p.inputValue('#in-imp-ta'), '', 'câmpul de text se golește după import');
    eq(await iText(p, '#in-pk-h-imp-one'), pk.title + ' ' + II.en.p_imp);
    const metas = await p.$$eval('.in-pack:nth-of-type(2) .in-meta', (e) => e.map((x) => x.textContent));
    eq(metas[0], F(II.en.p_meta, 'HU', 'HAREC', 'hu', 12));
    eq(metas[1], F(II.en.p_src, 'Test source') + ' https://example.org/bank');
    eq(await p.$eval('.in-pack:nth-of-type(2) .in-meta a', (e) => e.getAttribute('href') + '|' + e.getAttribute('target') + '|' + e.getAttribute('rel')), 'https://example.org/bank|_blank|noopener noreferrer');
    eq(JSON.stringify(await iStore(p, K.packs)), JSON.stringify([IE.canonicalPack(pk)]), 'pachetul se salvează în formă canonică');
    // exersare în pachetul importat
    await iTab(p, 'train');
    eq(await p.inputValue('#in-pack'), 'imp-one', 'pachetul importat devine pachetul curent');
    eq(await iText(p, '.in-count'), F(II.en.t_stats, 0, 12, 12));
    await p.click('#in-start');
    await p.waitForSelector('#in-card');
    eq(await p.$eval('#in-qt', (e) => e.getAttribute('lang')), 'hu', 'limba întrebării vine din pachet');
    const no = /question (\d+) of imp-one/.exec(await iText(p, '#in-qt'))[1];
    const qid = 'ZZ-impone-' + no.padStart(4, '0');
    const texts = await iAnsTexts(p, '#in-card');
    await p.click('#in-ans-' + texts.indexOf('Right ' + no));
    await p.waitForSelector('#in-fb');
    const kept = (await iStore(p, K.prog)).packs['imp-one'][qid];
    eq(kept[0], 1);
    // înlocuirea păstrează progresul întrebărilor cu același id și oprește sesiunea
    await iTab(p, 'packs');
    const pk2 = Object.assign({}, pk, {title: 'Test pack imp-one v2', questions: pk.questions.concat([mkQ('imp-one', 12)])});
    await iImp(p, JSON.stringify(pk2));
    await p.waitForFunction(() => document.getElementById('in-live').textContent.includes('Replaced'));
    eq(await iLive(p), F(II.en.i_replaced, pk2.title, 13));
    eq((await iCards(p)).join(), 'zz-practice,imp-one', 'același id: pachetul se înlocuiește, nu se adaugă');
    eq(JSON.stringify((await iStore(p, K.prog)).packs['imp-one'][qid]), JSON.stringify(kept), 'progresul întrebării păstrate');
    eq(JSON.stringify(await iStore(p, K.packs)), JSON.stringify([IE.canonicalPack(pk2)]));
    await iTab(p, 'train');
    eq(await iText(p, '.in-count'), F(II.en.t_stats, 0, 12, 13), 'sesiunea s-a oprit; numărătoarea ține seama de înlocuire');
    // descărcarea pachetului importat
    await iTab(p, 'packs');
    const dl = await iDl(p, '#in-pk-dl-imp-one');
    eq(dl.name, 'imp-one.json');
    eq(dl.text, JSON.stringify(IE.canonicalPack(pk2), null, 2) + '\n');
    // ștergerea în doi pași
    await p.click('#in-pk-rm-imp-one');
    eq(await iText(p, '#in-pk-rm-imp-one'), II.en.p_remove_sure);
    eq((await iCards(p)).length, 2, 'primul clic nu șterge');
    await iTab(p, 'exam');
    await iTab(p, 'packs');
    eq(await iText(p, '#in-pk-rm-imp-one'), II.en.p_remove, 'confirmarea se retrage la schimbarea filei');
    await p.click('#in-pk-rm-imp-one');
    await p.click('#in-pk-rm-imp-one');
    eq(await iLive(p), F(II.en.p_removed, pk2.title));
    eq(await iActive(p), 'in-imp-h');
    eq((await iCards(p)).join(), 'zz-practice');
    eq(JSON.stringify(await iStore(p, K.packs)), '[]');
    const st = await iStore(p, K.prog);
    eq(st.packs['imp-one'], undefined, 'progresul pachetului șters dispare');
    eq(st.last.pack, '');
    await iTab(p, 'train');
    eq(await p.$$eval('#in-pack option', (e) => e.length), 1);
    // import din fișier: fișierul are prioritate față de text, iar câmpul de fișier se golește
    await iTab(p, 'packs');
    const pk3 = mkPack('file-one', 5);
    await p.fill('#in-imp-ta', 'text care nu trebuie folosit');
    await iFile(p, '#in-imp-file', 'file-one.json', JSON.stringify(pk3, null, 2));
    await p.click('#in-imp-go');
    await p.waitForSelector('#in-pk-h-file-one');
    eq(await iLive(p), F(II.en.i_done, pk3.title, 5));
    eq(await p.$eval('#in-imp-file', (e) => e.files.length), 0, 'câmpul de fișier se golește');
    eq(await p.inputValue('#in-imp-ta'), '', 'după import textul se golește');
    noErr(h);
    ok(await iPoll(p));
    await h.ctx.close();
  });

  await T(NAME + ': import respins: gol, JSON rupt, prea lung, nu e pachet, id încorporat, probleme enumerate cu locul lor, doar întrebările valide, desen cu script, fișier de peste 8 MB', async () => {
    const h = await iOpen({time: T0});
    const p = h.page;
    await iTab(p, 'packs');
    const rep = async () => ({text: await iText(p, '#in-imp-rep'), lines: await iAll(p, '#in-imp-rep li'), active: await iActive(p)});
    const none = async () => { eq(JSON.stringify(await iStore(p, K.packs)), 'null', 'nimic nu s-a salvat'); eq((await iCards(p)).join(), 'zz-practice'); };
    await iImp(p, '   ');
    eq((await rep()).text, II.en.i_err_empty);
    eq((await rep()).active, 'in-imp-rep', 'focalizarea trece pe raport');
    ok(await p.$eval('#in-imp-rep p', (e) => e.classList.contains('in-bad')));
    await iImp(p, '{nope');
    eq((await rep()).text, II.en.i_err_json);
    await iImp(p, 'x'.repeat(3000001));
    eq((await rep()).text, II.en.i_err_big);
    await p.fill('#in-imp-ta', '');
    await iImp(p, '5');
    eq((await rep()).text, II.en.i_err_pack + lineOf('pack:type'), 'textContent lipește titlul de listă (paragraf și listă, fără spațiu între ele)');
    await iImp(p, JSON.stringify(mkPack('zz-practice', 3)));
    eq((await rep()).text, II.en.i_err_builtin, 'id-ul unui pachet încorporat nu se poate folosi');
    await none();
    // probleme enumerate cu locul lor și butonul pentru întrebările valide
    const mix = mkPack('mix-one', 6);
    mix.questions[1].answers = ['only one'];
    mix.questions[2].correct = 9;
    mix.questions[4].id = mix.questions[3].id;
    const codes = IE.validatePack(mix), part = IE.validPart(mix);
    ok(codes.length >= 3 && part && part.pack.questions.length === 3 && part.dropped.length === 3, 'pregătirea probei: ' + JSON.stringify(codes));
    await iImp(p, JSON.stringify(mix));
    const r1 = await rep();
    eq(r1.text.startsWith(II.en.i_err_pack), true);
    eq(JSON.stringify(r1.lines), JSON.stringify(codes.map(lineOf)), 'fiecare problemă cu locul ei');
    eq(await iText(p, '#in-imp-valid'), F(II.en.i_valid, 3));
    await none();
    await p.click('#in-imp-valid');
    await p.waitForSelector('#in-pk-h-mix-one');
    eq(await iLive(p), F(II.en.i_partial, mix.title, 3, 3));
    const saved = (await iStore(p, K.packs))[0];
    eq(saved.questions.length, 3);
    eq(JSON.stringify(saved.questions.map((q) => q.id)), JSON.stringify(part.pack.questions.map((q) => q.id)));
    // peste 20 de probleme: se arată 20 și restul se numără; fără întrebări valide nu există buton
    const many = mkPack('many-one', 30);
    many.questions.forEach((q) => { q.answers = ['x']; });
    const mc = IE.validatePack(many);
    ok(mc.length > 20);
    await iImp(p, JSON.stringify(many));
    const r2 = await rep();
    eq(r2.lines.length, 21);
    eq(JSON.stringify(r2.lines.slice(0, 20)), JSON.stringify(mc.slice(0, 20).map(lineOf)));
    eq(r2.lines[20], F(II.en.i_more, mc.length - 20));
    eq(await p.$('#in-imp-valid'), null, 'fără nicio întrebare validă nu se oferă import parțial');
    // desen cu script: nu se acceptă
    const fig = mkPack('fig-one', 2);
    fig.questions[0].figure = '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>';
    fig.questions[0].figure_alt = 'A drawing with a script';
    const fc = IE.validatePack(fig);
    ok(fc.length >= 1 && fc.some((c) => /figure/.test(c)), JSON.stringify(fc));
    await iImp(p, JSON.stringify(fig));
    eq(JSON.stringify((await rep()).lines), JSON.stringify(fc.map(lineOf)));
    // un fișier de peste 8 MB nu se citește deloc
    await iFile(p, '#in-imp-file', 'huge.json', ' '.repeat(8000001));
    await p.click('#in-imp-go');
    await p.waitForFunction((m) => document.getElementById('in-live').textContent === m, II.en.i_err_big);
    eq(JSON.stringify((await iStore(p, K.packs)).map((x) => x.id)), '["mix-one"]');
    // un fișier cu JSON rupt arată eroarea de JSON
    await iFile(p, '#in-imp-file', 'broken.json', '{"format":');
    await p.click('#in-imp-go');
    await p.waitForFunction((m) => (document.getElementById('in-imp-rep') || {}).textContent === m, II.en.i_err_json);
    noErr(h);
    ok(await iPoll(p));
    await h.ctx.close();
  });

  await T(NAME + ': cel mult 8 pachete importate; înlocuirea unuia existent merge și când e plin; fără spațiu în browser nimic nu se pierde', async () => {
    const h = await iOpen({time: T0});
    const p = h.page;
    await iTab(p, 'packs');
    for (let i = 1; i <= 8; i++) {
      await iImp(p, JSON.stringify(mkPack('lim-' + i, 3)));
      await p.waitForSelector('#in-pk-h-lim-' + i);
    }
    eq((await iCards(p)).length, 9);
    await iImp(p, JSON.stringify(mkPack('lim-9', 3)));
    await p.waitForFunction((m) => (document.getElementById('in-imp-rep') || {}).textContent === m, F(II.en.i_err_full, 8));
    eq((await iCards(p)).length, 9, 'al nouălea nu intră');
    await iImp(p, JSON.stringify(mkPack('lim-3', 4, {title: 'Replaced three'})));
    await p.waitForFunction(() => document.getElementById('in-live').textContent.includes('Replaced'));
    eq(await iLive(p), F(II.en.i_replaced, 'Replaced three', 4));
    eq((await iStore(p, K.packs)).length, 8);
    // fără spațiu: import respins, starea rămâne cum era
    await quotaOn(p, K.packs);
    const before = await p.evaluate((k) => localStorage.getItem(k), K.packs);
    await iImp(p, JSON.stringify(mkPack('lim-3', 5, {title: 'Replaced again'})));
    await p.waitForFunction((m) => (document.getElementById('in-imp-rep') || {}).textContent === m, II.en.e_quota);
    eq(await p.evaluate((k) => localStorage.getItem(k), K.packs), before, 'spațiul epuizat nu strică ce era salvat');
    eq(await iText(p, '#in-pk-h-lim-3'), 'Replaced three ' + II.en.p_imp, 'pachetul rămâne cel de dinainte');
    noErr(h);
    await h.ctx.close();
    // progresul nu se poate salva: răspunsul se arată oricum, dar utilizatorul e anunțat
    const h2 = await iOpen({time: T0});
    const q = h2.page;
    await quotaOn(q, K.prog);
    await q.click('#in-start');
    await q.waitForSelector('#in-card');
    await iTrain(q, true);
    eq(await iLive(q), II.en.e_quota);
    noErr(h2);
    await h2.ctx.close();
  });

  await T(NAME + ': reguli de examen declarate de pachet: se arată cu sursa, penalizarea scade din punctaj, pragul e cel al pachetului', async () => {
    const h = await iOpen({time: T0});
    const p = h.page;
    const rules = {questions: 5, minutes: 10, pass_percent: 60, wrong_penalty: 0.25, source: 'Test authority notice 2026'};
    const pk = mkPack('rul-one', 12, {exam: rules});
    await iTab(p, 'packs');
    await iImp(p, JSON.stringify(pk));
    await p.waitForSelector('#in-pk-h-rul-one');
    const sum = F(II.en.x_rules, 5, 10, 60) + ' · ' + F(II.en.x_penalty, '0.25');
    ok((await iAll(p, '.in-pack:nth-of-type(2) .in-meta')).includes(F(II.en.p_rules, sum + ' (' + rules.source + ')')), 'cardul pachetului arată regulile cu sursa');
    await iTab(p, 'exam');
    eq(await p.inputValue('#in-xpack'), 'rul-one');
    eq(await iText(p, '.in-rules'), sum);
    ok((await iAll(p, '.in-hint')).includes(F(II.en.x_rules_src, rules.source)), 'sursa regulilor');
    ok(!(await iAll(p, '.in-hint')).includes(II.en.x_rules_def));
    await p.fill('#in-seed', '4');
    await p.click('#in-xstart');
    await p.waitForSelector('#in-xcard');
    eq(await iText(p, '#in-clock'), '10:00');
    const xam = IE.buildExam(pk.questions, rules, 4);
    eq(xam.n, 5);
    eq((await iRun(p)).rules.wrong_penalty, 0.25, 'regulile se salvează odată cu examenul');
    // 3 corecte și 2 greșite: 3 − 2 × 0,25 = 2,5 puncte din 5 = 50 % < 60 %
    const byId = Object.fromEntries(pk.questions.map((q) => [q.id, q]));
    const picked = {};
    for (let i = 0; i < 5; i++) {
      await iGo(p, i, 5);
      const q = byId[xam.ids[i]];
      const texts = await iAnsTexts(p, '#in-xcard');
      const k = i < 3 ? texts.indexOf(q.answers[0]) : (texts.indexOf(q.answers[0]) + 1) % texts.length;
      await p.click('label[for="in-xa-' + k + '"]');
      picked[q.id] = q.answers.indexOf(texts[k]);
    }
    const sc = IE.scoreExam(xam, picked, byId);
    eq([sc.right, sc.wrong, sc.points, sc.percent, sc.passed].join(), '3,2,2.5,50,false');
    await p.click('#in-xfinish');
    await p.waitForSelector('#in-res');
    eq(await iText(p, '.in-big'), F(II.en.r_score, 3, 5, '50'));
    eq(await iText(p, 'p.in-res'), F(II.en.r_fail, '50', 60));
    eq((await histOf(p))[0].percent, 50);
    // al doilea examen, aceeași sămânță: 4 corecte și 1 greșită = 3,75 din 5 = 75 % → promovat
    await p.click('#in-xrepeat');
    await p.waitForSelector('#in-xcard');
    for (let i = 0; i < 5; i++) {
      await iGo(p, i, 5);
      const q = byId[xam.ids[i]];
      const texts = await iAnsTexts(p, '#in-xcard');
      const k = i < 4 ? texts.indexOf(q.answers[0]) : (texts.indexOf(q.answers[0]) + 1) % texts.length;
      await p.click('label[for="in-xa-' + k + '"]');
    }
    await p.click('#in-xfinish');
    await p.waitForSelector('#in-res');
    eq(await iText(p, '.in-big'), F(II.en.r_score, 4, 5, '75'));
    eq(await iText(p, 'p.in-res'), F(II.en.r_pass, '75', 60));
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': copia de siguranță a progresului: descărcare, încărcare, fișier ostil, fișier străin, fără fișier', async () => {
    const D0 = iDay(T0);
    const prog0 = {'ZZ-practice-0001': [1, D0 + 1, D0, 2, 1], 'ZZ-practice-0002': [4, D0 + 14, D0 - 3, 5, 0]};
    const hist0 = [{pack: 'zz-practice', day: D0 - 1, n: 20, right: 17, percent: 85, passed: true, seed: 3, secs: 900}];
    const h = await iOpen({time: T0, store: {[K.prog]: progOf(prog0, hist0, {pack: 'zz-practice', topic: '', mode: 'weak', newPerDay: 7})}});
    const p = h.page;
    await iTab(p, 'packs');
    const dl = await iDl(p, '#in-pg-dl');
    eq(dl.name, 'indicativ-progress.json');
    ok(dl.text.endsWith('\n'));
    eq(JSON.stringify(JSON.parse(dl.text)), JSON.stringify({format: 'indicativ-progress', version: 1, packs: {'zz-practice': prog0}, history: hist0}), 'copia are formatul documentat, fără setările de pe ecran');
    // se șterge progresul, apoi se încarcă copia
    await p.click('#in-pk-rs-zz-practice'); await p.click('#in-pk-rs-zz-practice');
    eq(JSON.stringify((await iStore(p, K.prog)).packs['zz-practice']), '{}');
    await iFile(p, '#in-pg-file', 'indicativ-progress.json', dl.text);
    await p.click('#in-pg-load');
    await p.waitForFunction((m) => document.getElementById('in-live').textContent === m, F(II.en.g_loaded, 2));
    eq(JSON.stringify((await iStore(p, K.prog)).packs['zz-practice']), JSON.stringify(prog0));
    eq(JSON.stringify((await iStore(p, K.prog)).history), JSON.stringify(hist0));
    eq(await p.$eval('#in-pg-file', (e) => e.files.length), 0, 'câmpul de fișier se golește');
    await iTab(p, 'train');
    eq(await iText(p, '.in-count'), F(II.en.t_stats, 0, 48, 50));
    await iTab(p, 'packs');
    // un fișier ostil: doar ce e valid se încarcă
    const hostile = '{"format":"indicativ-progress","version":1,"packs":{"__proto__":{"ZZ-practice-0001":[1,5,5,1,0]},"nope":{"ZZ-nope-0001":[1,1,1,1,1]},"zz-practice":{"__proto__":[1,2,3,4,5],"constructor":[1,1,1,1,1],"ZZ-practice-0003":[2,' + (D0 - 1) + ',' + (D0 - 5) + ',1,2],"ZZ-practice-0004":[9,1,1,1,1],"ZZ-practice-0005":[1,2,3],"ZZ-practice-0006":"x","ZZ-practice-0007":[0,1,1,0,0],"ZZ-practice-9999":[1,1,1,1,1]}},"history":[{"pack":"__proto__","day":1,"n":1,"right":0,"percent":0,"passed":false,"seed":1,"secs":1},{"pack":"zz-practice","day":' + D0 + ',"n":20,"right":5,"percent":25,"passed":false,"seed":2,"secs":60},{"junk":1}]}';
    await iFile(p, '#in-pg-file', 'hostile.json', hostile);
    await p.click('#in-pg-load');
    await p.waitForFunction((m) => document.getElementById('in-live').textContent === m, F(II.en.g_loaded, 1));
    const st = await iStore(p, K.prog);
    eq(JSON.stringify(st.packs['zz-practice']), JSON.stringify({'ZZ-practice-0003': [2, D0 - 1, D0 - 5, 1, 2]}));
    eq(JSON.stringify(st.history), JSON.stringify([{pack: 'zz-practice', day: D0, n: 20, right: 5, percent: 25, passed: false, seed: 2, secs: 60}]));
    ok(await iPoll(p), 'Object.prototype nu e poluat');
    // fișiere care nu sunt copii de siguranță: mesaj de eroare, nimic nu se schimbă
    for (const bad of ['{}', '[]', '{"format":"indicativ-progress","version":2,"packs":{}}', '{"format":"altceva","version":1,"packs":{}}', 'nu e json']) {
      await iFile(p, '#in-pg-file', 'bad.json', bad);
      await p.click('#in-pg-load');
      await p.waitForFunction(() => document.getElementById('in-pg-file').files.length === 0);   // citirea s-a terminat (mesajul poate fi același ca la fișierul anterior)
      eq(await iLive(p), II.en.g_err, 'fișier greșit: ' + bad);
      eq(JSON.stringify((await iStore(p, K.prog)).packs['zz-practice']), JSON.stringify({'ZZ-practice-0003': [2, D0 - 1, D0 - 5, 1, 2]}), 'un fișier greșit nu schimbă progresul: ' + bad);
    }
    // fără fișier ales
    await p.click('#in-pg-load');
    eq(await iLive(p), II.en.i_err_empty);
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': stare salvată ostilă în toate cele trei chei (pachete, progres, examen): nimic nu strică pagina și nu se poluează prototipul', async () => {
    const D0 = iDay(T0);
    const okOne = mkPack('ok-one', 4);
    const protoKey = JSON.stringify(mkPack('proto-one', 2)).replace('{"format"', '{"__proto__":{"polluted":1},"format"');
    const packsText = '[null,5,"x",[],{"id":"__proto__"},' + JSON.stringify(mkPack('zz-practice', 2)) + ',' + JSON.stringify(okOne) + ',' + JSON.stringify(mkPack('ok-one', 3, {title: 'Duplicate'})) + ',' + JSON.stringify(mkPack('bad-one', 2, {questions: [mkQ('bad-one', 0, {answers: ['x']})]})) + ',' + protoKey + ']';
    const progText = '{"format":"indicativ-progress","version":1,"packs":{"__proto__":{"ZZ-practice-0001":[1,5,5,1,0]},"zz-practice":{"__proto__":[1,2,3,4,5],"constructor":[1,1,1,1,1],"ZZ-practice-0001":[1,' + (D0 + 1) + ',' + D0 + ',2,1],"ZZ-practice-0002":[9,1,1,1,1],"ZZ-practice-0003":[1,2,3],"ZZ-practice-0004":"x","ZZ-practice-0005":[0,1,1,0,0],"ZZ-practice-9999":[1,1,1,1,1]},"nope":{"ZZ-nope-0001":[1,1,1,1,1]}},"history":[{"pack":"__proto__","day":1,"n":1,"right":0,"percent":0,"passed":false,"seed":1,"secs":1},{"junk":1},{"pack":"zz-practice","day":' + D0 + ',"n":20,"right":5,"percent":25,"passed":false,"seed":2,"secs":60}],"last":{"pack":"__proto__","topic":5,"mode":"evil","newPerDay":-4}}';
    const runText = runOf(9, {start: Date.parse(T0) - 60000}).replace('"answers":{}', '"answers":{"__proto__":{"polluted":1},"zz":0}').replace('"flags":{}', '"flags":{"__proto__":true,"zz":true}');
    ok(runText.includes('"__proto__":{"polluted":1}') && runText.includes('"flags":{"__proto__":true'), 'proba are chei ostile');
    JSON.parse(runText);                                                      // textul rămâne JSON valid: examenul se reia, doar cheile ostile se aruncă
    const h = await iOpen({time: T0, store: {[K.packs]: packsText, [K.prog]: progText, [K.run]: runText}});
    const p = h.page;
    await p.waitForSelector('#in-xcard');
    eq(await iText(p, '.in-qn'), F(II.en.x_qn, 1, 20), 'examenul valid din cheia a treia se reia');
    await iTab(p, 'packs');
    eq((await iCards(p)).join(), 'zz-practice,ok-one', 'din prima cheie rămân doar pachetele valide și diferite de cele încorporate');
    eq(await iText(p, '#in-pk-h-ok-one'), okOne.title + ' ' + II.en.p_imp);
    await iTab(p, 'train');
    eq(await p.inputValue('#in-pack'), 'zz-practice', '«last» ostil → pachetul implicit');
    eq(await p.inputValue('#in-mode'), 'due');
    eq(await p.inputValue('#in-new'), '10');
    eq(await iText(p, '.in-count'), F(II.en.t_stats, 0, 49, 50), 'doar o înregistrare de progres e validă');
    await iTab(p, 'exam');
    eq((await iAll(p, '.in-hist li')).length, 0, 'examenul început ascunde istoricul; cel valid se vede după terminare');
    await p.click('#in-xfinish'); await p.click('#in-xsure-go');
    await p.waitForSelector('#in-res');
    await p.click('#in-xnew');
    eq((await iAll(p, '.in-hist li')).length, 2, 'istoricul valid și rezultatul nou');
    ok(await iPoll(p), 'Object.prototype nu e poluat');
    noErr(h);
    await h.ctx.close();
  });

  // ---------- setări de exersare, file, limbă, desene, ordine fixă ----------
  async function iPlay(p) {                     // răspunde corect până la sfârșitul sesiunii; întoarce ordinea întrebărilor văzute
    const seen = [];
    for (;;) {
      await p.waitForSelector('#in-card:not(:has(#in-fb)), #in-sum');
      if (await p.$('#in-sum')) break;
      const a = await iTrain(p, true);
      seen.push(a.q.id);
      await p.click('#in-next');
    }
    return seen;
  }
  const pid = (n) => 'ZZ-practice-' + String(n).padStart(4, '0');

  await T(NAME + ': setări de exersare: «scadente și noi», «orice întrebare», «punctele mele slabe», subiect, întrebări noi pe zi (limite) și salvarea lor', async () => {
    const D0 = iDay(T0);
    const prog0 = {
      [pid(1)]: [1, D0 - 2, D0 - 6, 1, 2],   // scadentă, slabă
      [pid(2)]: [2, D0 - 1, D0 - 6, 3, 1],   // scadentă, slabă
      [pid(3)]: [3, D0 + 7, D0 - 6, 4, 1],   // nescadentă, nu e slabă (cutia 3)
      [pid(4)]: [1, D0, D0, 0, 1],           // scadentă azi, slabă, introdusă azi
      [pid(5)]: [5, D0 - 3, D0 - 20, 9, 0],  // scadentă, învățată
      [pid(6)]: [2, D0 + 1, D0 - 3, 2, 0]    // nescadentă, fără greșeli
    };
    const O = objsOf(prog0), topics = IE.topicsOf(PR.questions);
    let h = await iOpen({time: T0, store: {[K.prog]: progOf(prog0, [])}});
    let p = h.page;
    eq(await iText(p, '.in-count'), F(II.en.t_stats, 4, 44, 50));
    // «scadente și noi»: întâi scadentele (după zi, cutie, id), apoi cele noi în ordinea pachetului, minus cele introduse azi
    const dueIds = [pid(5), pid(1), pid(2), pid(4)];
    const wantDue = IE.buildQueue(PR.questions, O, D0, {mode: 'due', topic: '', newPerDay: 10, max: 40, seed: 0});
    eq(JSON.stringify(wantDue.slice(0, 4)), JSON.stringify(dueIds), 'ordinea scadentelor');
    eq(wantDue.length, 4 + 9, 'nouă întrebări noi: 10 pe zi minus cea introdusă azi');
    await p.click('#in-start');
    await p.waitForSelector('#in-card');
    eq(await iText(p, '.in-qn'), F(II.en.t_qn, 1, 13));
    const seenDue = await iPlay(p);
    eq(JSON.stringify(seenDue), JSON.stringify(wantDue), 'sesiunea urmează coada calculată de motor');
    const st = (await iStore(p, K.prog)).packs['zz-practice'];
    eq(JSON.stringify(st[pid(5)]), JSON.stringify([5, D0 + 30, D0 - 20, 10, 0]), 'cutia 5 rămâne 5, scadentă peste 30 de zile');
    eq(JSON.stringify(st[pid(1)]), JSON.stringify([2, D0 + 3, D0 - 6, 2, 2]), 'cutia 1 → 2, scadentă peste 3 zile');
    eq(JSON.stringify(st[pid(7)]), JSON.stringify([1, D0 + 1, D0, 1, 0]), 'o întrebare nouă răspunsă corect intră în cutia 1');
    await p.click('#in-again');
    // «punctele mele slabe»: cutia ≤ 2 și cel puțin o greșeală, cele mai slabe întâi; câmpul pentru întrebări noi se ascunde
    await p.selectOption('#in-mode', 'weak');
    eq(await p.$eval('#in-new', (e) => e.closest('.in-f').hidden), true, 'în afara modului «scadente» nu se aplică limita pe zi');
    await p.selectOption('#in-mode', 'due');
    await p.selectOption('#in-mode', 'weak');
    // după sesiunea de mai sus cutiile s-au schimbat: se pornește din nou cu progresul inițial, pentru a avea un caz clar
    h = await iFresh(h, {[K.prog]: progOf(prog0, [], {pack: 'zz-practice', topic: '', mode: 'weak', newPerDay: 10})});
    p = h.page;
    eq(await p.inputValue('#in-mode'), 'weak', 'modul salvat se citește la pornire');
    const wantWeak = IE.buildQueue(PR.questions, O, D0, {mode: 'weak', topic: '', newPerDay: 10, max: 40, seed: 0});
    eq(JSON.stringify(wantWeak), JSON.stringify([pid(1), pid(4), pid(2)]));
    await p.click('#in-start');
    await p.waitForSelector('#in-card');
    eq(await iText(p, '.in-qn'), F(II.en.t_qn, 1, 3));
    eq(JSON.stringify(await iPlay(p)), JSON.stringify(wantWeak));
    await p.click('#in-again');
    // «orice întrebare» pe un subiect: doar întrebările subiectului, fără repetări, cel mult 40
    h = await iFresh(h, {[K.prog]: progOf(prog0, [], {pack: 'zz-practice', topic: '', mode: 'due', newPerDay: 10})});
    p = h.page;
    await p.selectOption('#in-mode', 'all');
    const topic = topics[1];
    await p.selectOption('#in-topic', topic);
    eq(await p.inputValue('#in-topic'), topic);
    const inTopic = PR.questions.filter((q) => q.topic === topic);
    await p.click('#in-start');
    await p.waitForSelector('#in-card');
    eq(await iText(p, '.in-qn'), F(II.en.t_qn, 1, Math.min(40, inTopic.length)));
    const seenAll = await iPlay(p);
    eq(new Set(seenAll).size, seenAll.length, 'fără repetări');
    ok(seenAll.every((id) => BYID.get(id).topic === topic), 'doar subiectul ales');
    eq(seenAll.length, Math.min(40, inTopic.length));
    await p.click('#in-again');
    eq(JSON.stringify((await iStore(p, K.prog)).last), JSON.stringify({pack: 'zz-practice', topic: topic, mode: 'all', newPerDay: 10}), 'setările se salvează');
    h = await iReopen(h);
    p = h.page;
    eq(await p.inputValue('#in-mode') + '|' + await p.inputValue('#in-topic'), 'all|' + topic, 'la redeschidere modul și subiectul revin');
    // întrebări noi pe zi: 3 → două noi (una e deja introdusă azi); progresul de la început, ca să fie clar câte sunt scadente
    h = await iFresh(h, {[K.prog]: progOf(prog0, [], {pack: 'zz-practice', topic: '', mode: 'due', newPerDay: 10})});
    p = h.page;
    await p.fill('#in-new', '3');
    await p.press('#in-new', 'Tab');
    eq((await iStore(p, K.prog)).last.newPerDay, 3);
    await p.click('#in-start');
    await p.waitForSelector('#in-card');
    eq(await iText(p, '.in-qn'), F(II.en.t_qn, 1, 4 + 2));
    await iPlay(p);
    await p.click('#in-again');
    // limitele câmpului: peste 100 → 100; negativ, text sau gol → 10; zecimal → partea întreagă
    for (const [typed, want] of [['500', 100], ['-5', 10], ['', 10], ['2.9', 2], ['0', 0], ['100', 100]]) {   // un câmp numeric nu primește litere
      await p.fill('#in-new', typed);
      await p.press('#in-new', 'Tab');
      eq(await p.inputValue('#in-new'), String(want), 'valoarea «' + typed + '»');
      eq((await iStore(p, K.prog)).last.newPerDay, want);
    }
    // zero întrebări noi și nicio scadentă azi: nimic de exersat
    h = await iFresh(h, {[K.prog]: progOf({}, [], {pack: 'zz-practice', topic: '', mode: 'due', newPerDay: 0})});
    p = h.page;
    eq(await p.inputValue('#in-new'), '0');
    await p.click('#in-start');
    eq(await iLive(p), II.en.t_none);
    eq(await p.$('#in-card'), null, 'nu începe nicio sesiune');
    await p.selectOption('#in-mode', 'weak');
    await p.click('#in-start');
    eq(await iLive(p), II.en.t_none, 'nicio întrebare slabă încă');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': filele se comută cu clic și cu săgeți, Home și End; focalizarea și starea filei urmează selecția', async () => {
    const h = await iOpen({time: T0});
    const p = h.page;
    const sel = () => p.$$eval('.in-tab', (e) => e.map((x) => x.getAttribute('aria-selected') + ':' + x.tabIndex).join(' '));
    eq(await sel(), 'true:0 false:-1 false:-1 false:-1');
    await p.focus('#in-tt-train');
    await p.keyboard.press('ArrowRight');
    eq(await iActive(p), 'in-tt-exam'); eq(await sel(), 'false:-1 true:0 false:-1 false:-1');
    ok(await p.$('#in-p-exam:not([hidden])'));
    await p.keyboard.press('End');
    eq(await iActive(p), 'in-tt-guide');
    await p.keyboard.press('ArrowRight');
    eq(await iActive(p), 'in-tt-train', 'după ultima filă se trece la prima');
    await p.keyboard.press('ArrowLeft');
    eq(await iActive(p), 'in-tt-guide', 'înaintea primei se trece la ultima');
    await p.keyboard.press('Home');
    eq(await iActive(p), 'in-tt-train');
    await p.keyboard.press('ArrowDown');
    eq(await iActive(p), 'in-tt-train', 'celelalte taste nu fac nimic');
    eq(await p.$$eval('.in-panel:not([hidden])', (e) => e.length), 1);
    eq(await p.$eval('.in-tabs', (e) => e.getAttribute('role') + '|' + e.getAttribute('aria-label')), 'tablist|' + II.en.tabs_l);
    eq(await p.$$eval('.in-tab', (e) => e.every((x) => document.getElementById(x.getAttribute('aria-controls')).getAttribute('aria-labelledby') === x.id)), true, 'fiecare filă își cunoaște panoul');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': schimbarea limbii păstrează sesiunea de exersare și examenul început (întrebarea, răspunsul, ceasul); textul întrebării rămâne în limba pachetului', async () => {
    const h = await iOpen({time: T0});
    const p = h.page, SEED = 7, xam = EXAM(SEED);
    await p.click('#in-start');
    await p.waitForSelector('#in-card');
    const a = await iTrain(p, false);
    for (const l of LANGS) {
      await p.selectOption('#langsel', l);
      await p.waitForSelector(ready);
      const I = II[l];
      eq(await iText(p, '.in-qn'), F(I.t_qn, 1, 11), l);
      eq((await iShown(p, '#in-qt')).id, a.q.id, l + ': aceeași întrebare');
      eq(await iText(p, '.in-res'), F(I.t_bad, plain(a.q.answers[a.q.correct])), l);
      eq(await iText(p, '#in-next'), I.t_next, l);
      eq(await p.$eval('#in-qt', (e) => e.getAttribute('lang')), PR.lang, l + ': limba întrebării e cea a pachetului');
      eq(await p.$eval('html', (e) => e.lang), l);
    }
    await p.selectOption('#langsel', 'en');
    await p.waitForSelector(ready);
    await p.click('#in-next');
    // examen: răspunsul ales, ceasul și harta rămân
    await iSeedExam(p, SEED);
    await iGo(p, 1);
    const pick = await iExamPick(p, true);
    await p.click('#in-xflag');
    for (const l of LANGS) {
      await p.selectOption('#langsel', l);
      await p.waitForSelector(ready);
      const I = II[l];
      eq(await iText(p, '.in-qn'), F(I.x_qn, 2, 20), l);
      eq(await iText(p, '#in-clock'), '30:00', l);
      eq(await iText(p, '#in-xflag'), I.x_unflag, l);
      eq(await p.$eval('#in-xa-' + pick.k, (e) => e.checked), true, l + ': răspunsul rămâne bifat');
      eq(await p.$eval('#in-qm-1', (e) => e.getAttribute('aria-label')), F(I.x_map_item, 2, I.x_st_done + ', ' + I.x_st_flag), l);
      eq(await iText(p, '#in-xfinish'), I.x_finish, l);
    }
    eq(JSON.stringify((await iRun(p)).answers), JSON.stringify({[xam.ids[1]]: pick.orig}));
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': desene și formule: desenul se construiește din arborele verificat (role=img, text alternativ, fără script/style), indicii și exponenții apar ca <sub>/<sup>', async () => {
    const h = await iOpen({time: T0});
    const p = h.page;
    const xam = EXAM(FIG_SEED);
    await iSeedExam(p, FIG_SEED);
    let figs = 0, forms = 0;
    for (let i = 0; i < xam.n; i++) {
      await iGo(p, i);
      const q = BYID.get(xam.ids[i]);
      const dom = await p.$eval('#in-xcard', (c) => {
        const svg = c.querySelector('svg.in-fig');
        return {svg: !!svg, role: svg && svg.getAttribute('role'), alt: svg && svg.getAttribute('aria-label'), focusable: svg && svg.getAttribute('focusable'), nodes: svg ? svg.querySelectorAll('*').length : 0,
          bad: svg ? Array.from(svg.querySelectorAll('*')).concat([svg]).filter((e) => /^(script|foreignobject|style|image|a|use)$/i.test(e.localName) || Array.from(e.attributes).some((a) => /^on/i.test(a.name) || a.name === 'style' || /href/i.test(a.name))).length : 0,
          subs: c.querySelectorAll('sub').length, sups: c.querySelectorAll('sup').length};
      });
      const marks = (s) => (s.match(/_\{/g) || []).length;
      const upMarks = (s) => (s.match(/\^\{/g) || []).length;
      const all = [q.question].concat(q.answers);
      eq(dom.subs, all.reduce((n, s) => n + marks(s), 0), 'indici la întrebarea ' + q.id);
      eq(dom.sups, all.reduce((n, s) => n + upMarks(s), 0), 'exponenți la întrebarea ' + q.id);
      forms += dom.subs + dom.sups;
      eq(dom.svg, q.figure !== undefined, 'desen la ' + q.id);
      if (q.figure !== undefined) {
        figs++;
        const tree = IE.parseFigure(q.figure).tree;
        const count = (n) => 1 + n.kids.reduce((s, k) => s + count(k), 0);
        eq(dom.role + '|' + dom.focusable, 'img|false');
        eq(dom.alt, q.figure_alt);
        eq(dom.nodes, count(tree) - 1, 'același număr de noduri ca arborele verificat');
        eq(dom.bad, 0, 'niciun element sau atribut interzis în desen');
      }
    }
    ok(figs >= 2, 'sămânța aleasă are cele două întrebări cu desen: ' + figs);
    ok(forms >= 1, 'și cel puțin o formulă cu indice sau exponent');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': ordinea fixă a răspunsurilor («toate cele de mai sus») se păstrează în exersare și în examen; celelalte se amestecă după sămânță', async () => {
    const h = await iOpen({time: T0});
    const p = h.page;
    const fx = mkPack('fix-one', 5);
    fx.questions.forEach((q, i) => { q.answers = ['Alpha ' + i, 'Beta ' + i, 'Gamma ' + i, 'All of the above ' + i]; q.correct = 3; q.fixed_order = true; });
    const mixed = mkPack('mix-two', 6);
    await iTab(p, 'packs');
    await iImp(p, JSON.stringify(fx));
    await p.waitForSelector('#in-pk-h-fix-one');
    await iTab(p, 'train');
    await p.selectOption('#in-mode', 'all');
    await p.click('#in-start');
    await p.waitForSelector('#in-card');
    for (let i = 0; i < 5; i++) {
      await p.waitForSelector('#in-card:not(:has(#in-fb))');
      const t = await iAnsTexts(p, '#in-card');
      const n = /question (\d+) of/.exec(await iText(p, '#in-qt'))[1] - 1;
      eq(JSON.stringify(t), JSON.stringify(['Alpha ' + n, 'Beta ' + n, 'Gamma ' + n, 'All of the above ' + n]), 'ordinea din fișier, întrebarea ' + (n + 1));
      await p.click('#in-ans-3');
      await p.click('#in-next');
    }
    await iSeedExam(p, 5);
    for (let i = 0; i < 5; i++) {
      await iGo(p, i, 5);
      const n = /question (\d+) of/.exec(await iText(p, '#in-xqt'))[1] - 1;
      eq(JSON.stringify(await iAnsTexts(p, '#in-xcard')), JSON.stringify(['Alpha ' + n, 'Beta ' + n, 'Gamma ' + n, 'All of the above ' + n]), 'în examen, întrebarea ' + (n + 1));
    }
    // fără ordine fixă: ordinea e cea a motorului pentru sămânța examenului
    await iTab(p, 'packs');
    await iImp(p, JSON.stringify(mixed));
    await p.waitForSelector('#in-pk-h-mix-two');
    await iTab(p, 'exam');
    await p.click('#in-xfinish'); await p.click('#in-xsure-go');
    await p.waitForSelector('#in-res');
    await p.click('#in-xnew');
    await p.selectOption('#in-xpack', 'mix-two');
    await p.fill('#in-seed', '12');
    await p.click('#in-xstart');
    await p.waitForSelector('#in-xcard');
    const xm = IE.buildExam(mixed.questions, RULES, 12), byId = Object.fromEntries(mixed.questions.map((q) => [q.id, q]));
    let moved = 0;
    for (let i = 0; i < xm.n; i++) {
      await iGo(p, i, xm.n);
      const q = byId[xm.ids[i]];
      const want = IE.answerOrder(q, 12).map((o) => q.answers[o]);
      eq(JSON.stringify(await iAnsTexts(p, '#in-xcard')), JSON.stringify(want), 'ordinea amestecată după sămânță, întrebarea ' + (i + 1));
      if (JSON.stringify(want) !== JSON.stringify(q.answers)) moved++;
    }
    ok(moved >= 1, 'cel puțin o întrebare are răspunsurile amestecate');
    noErr(h);
    await h.ctx.close();
  });

  // ---------- accesibilitate, ecran îngust, pachete mari ----------
  await T(NAME + ': accesibilitate (axe) în fiecare ecran (exersare, examen, rezultat, pachete cu eroare și cu import, ghid), în temele luminoasă și întunecată', async () => {
    for (const scheme of ['light', 'dark']) {
      const h = await iOpen({time: T0, scheme});
      const p = h.page;
      const chk = async (label) => { const v = await axe(p); ok(v.length === 0, scheme + ' / ' + label + ': ' + JSON.stringify(v)); };
      await chk('exersare: setări');
      await p.click('#in-start');
      await p.waitForSelector('#in-card');
      await chk('exersare: întrebare');
      await iTrain(p, false);
      await chk('exersare: răspuns greșit cu explicație');
      await p.click('#in-next');
      await p.waitForSelector('#in-card:not(:has(#in-fb))');
      await iTrain(p, true);
      await chk('exersare: răspuns corect');
      await p.click('#in-next');
      while (!(await p.$('#in-sum'))) {
        await p.waitForSelector('#in-card:not(:has(#in-fb)), #in-sum');
        if (await p.$('#in-sum')) break;
        await iTrain(p, true);
        await p.click('#in-next');
      }
      await chk('exersare: rezumat');
      await p.click('#in-again');
      await iSeedExam(p, FIG_SEED);
      await chk('examen: prima întrebare');
      const xam = EXAM(FIG_SEED);
      const fi = xam.ids.indexOf('ZZ-practice-0005');
      await iGo(p, fi);
      await chk('examen: întrebare cu desen');
      await iExamPick(p, true);
      await p.click('#in-xflag');
      await iGo(p, 3);
      await iExamPick(p, false);
      await chk('examen: răspunsuri date, marcaj');
      await p.click('#in-xfinish');
      await p.waitForSelector('#in-xsure');
      await chk('examen: confirmarea terminării');
      await p.click('#in-xsure-go');
      await p.waitForSelector('#in-res');
      await chk('examen: rezultat cu întrebări de revăzut');
      await p.click('#in-xnew');
      await chk('examen: pregătire cu istoric');
      await iTab(p, 'packs');
      await chk('pachete: pachetul încorporat');
      await iImp(p, JSON.stringify(Object.assign(mkPack('axe-one', 4), {questions: mkPack('axe-one', 4).questions.map((q, i) => (i === 1 ? Object.assign({}, q, {answers: ['x']}) : q))})));
      await p.waitForSelector('#in-imp-rep li');
      await chk('pachete: raport de erori');
      await p.click('#in-imp-valid');
      await p.waitForSelector('#in-pk-h-axe-one');
      await chk('pachete: cu pachet importat');
      await p.click('#in-pk-rm-axe-one');
      await chk('pachete: confirmare de ștergere');
      await iTab(p, 'guide');
      await chk('ghid');
      noErr(h);
      await h.ctx.close();
    }
  });

  await T(NAME + ': pe mobil (360 px) fiecare ecran încape fără defilare orizontală, în engleză, germană și maghiară', async () => {
    for (const lang of ['en', 'de', 'hu']) {
      const h = await iOpen({time: T0, w: 360, h: 740, lang});
      const p = h.page;
      const fit = async (label) => {
        const w = await p.evaluate(() => {
          const root = document.querySelector('.in-root'), over = [];
          document.querySelectorAll('.in-root *').forEach((e) => { if (e.closest('.in-tblwrap')) return; const r = e.getBoundingClientRect(); if (r.width && r.right > window.innerWidth + 1) over.push(e.tagName + '.' + e.className + ' ' + Math.round(r.right)); });
          return {sw: document.documentElement.scrollWidth, iw: window.innerWidth, rw: root.scrollWidth, rc: root.clientWidth, over: over.slice(0, 4)};
        });
        ok(w.sw <= w.iw + 1 && w.rw <= w.rc + 1 && !w.over.length, lang + ' / ' + label + ': ' + JSON.stringify(w));
      };
      await fit('exersare: setări');
      await p.click('#in-start');
      await p.waitForSelector('#in-card');
      await fit('exersare: întrebare');
      await iTrain(p, false);
      await fit('exersare: explicație');
      await iSeedExam(p, FIG_SEED);
      await fit('examen: prima întrebare');
      await iGo(p, EXAM(FIG_SEED).ids.indexOf('ZZ-practice-0028'), 20, lang);
      await fit('examen: întrebare cu desen');
      await p.click('#in-xfinish');
      await p.waitForSelector('#in-xsure');
      await fit('examen: confirmare');
      await p.click('#in-xsure-go');
      await p.waitForSelector('#in-res');
      await fit('examen: rezultat');
      await iTab(p, 'packs');
      await fit('pachete');
      await iTab(p, 'guide');
      await fit('ghid');
      noErr(h);
      await h.ctx.close();
    }
  });

  await T(NAME + ': pachete mari: 3000 de întrebări se importă, se exersează și se dau la examen; peste 3000 nu; peste limita de stocare importul e respins fără pierderi', async () => {
    const pad = (s, len) => (s + ' ' + 'lorem ipsum dolor sit amet '.repeat(Math.ceil(len / 27))).slice(0, len);
    const bigPack = (pidn, n, qlen) => mkPack(pidn, n, {questions: Array.from({length: n}, (_, i) => mkQ(pidn, i, {question: pad('Question ' + (i + 1) + ' of ' + pidn + ':', qlen), explanation: undefined}))});
    const A = bigPack('big-one', 3000, 800), B = bigPack('big-two', 3000, 250);
    const ta = JSON.stringify(A), tb = JSON.stringify(B);
    ok(IE.validatePack(A).length === 0 && IE.validatePack(B).length === 0, 'pachetele de probă sunt valide');
    ok(ta.length <= IE.LIMITS.import_chars && tb.length <= IE.LIMITS.import_chars, 'fiecare încape în limita de import: ' + ta.length + ' / ' + tb.length);
    ok(JSON.stringify([IE.canonicalPack(A)]).length <= IE.LIMITS.store_chars, 'primul încape în limita de stocare');
    ok(JSON.stringify([IE.canonicalPack(A), IE.canonicalPack(B)]).length > IE.LIMITS.store_chars, 'ambele nu încap în limita de stocare');
    const h = await iOpen({time: T0});
    const p = h.page;
    await iTab(p, 'packs');
    const t0 = Date.now();
    await iImp(p, ta);
    await p.waitForSelector('#in-pk-h-big-one', {timeout: 60000});
    ok(Date.now() - t0 < 30000, 'importul a durat ' + (Date.now() - t0) + ' ms');
    eq(await iLive(p), F(II.en.i_done, A.title, 3000));
    const size = await p.evaluate((k) => localStorage.getItem(k).length, K.packs);
    ok(size <= IE.LIMITS.store_chars && size > 2000000, 'stocat: ' + size + ' de caractere');
    eq((await iAll(p, '.in-pack:nth-of-type(2) .in-meta'))[0], F(II.en.p_meta, 'HU', 'test', 'en', 3000));
    await iTab(p, 'train');
    eq(await iText(p, '.in-count'), F(II.en.t_stats, 0, 3000, 3000));
    await p.selectOption('#in-mode', 'all');
    await p.click('#in-start');
    await p.waitForSelector('#in-card');
    eq(await iText(p, '.in-qn'), F(II.en.t_qn, 1, 40), 'cel mult 40 de întrebări într-o sesiune');
    await p.click('#in-ans-0');
    await iTab(p, 'exam');
    await p.fill('#in-seed', '1');
    await p.click('#in-xstart');
    await p.waitForSelector('#in-xcard');
    eq(await iText(p, '.in-qn'), F(II.en.x_qn, 1, 20));
    await p.click('#in-xfinish'); await p.click('#in-xsure-go');
    await p.waitForSelector('#in-res');
    await iTab(p, 'packs');
    // al doilea pachet mare nu mai încape: respins, iar primul rămâne neatins
    await iImp(p, tb);
    await p.waitForFunction((m) => (document.getElementById('in-imp-rep') || {}).textContent === m, II.en.e_quota, {timeout: 60000});
    eq(await p.evaluate((k) => localStorage.getItem(k).length, K.packs), size, 'pachetul stocat rămâne neschimbat');
    eq((await iCards(p)).join(), 'zz-practice,big-one');
    // peste 3000 de întrebări
    await p.fill('#in-imp-ta', '');
    await iImp(p, JSON.stringify(mkPack('over-one', 3001)));
    await p.waitForFunction((m) => (document.getElementById('in-imp-rep') || {}).textContent === m, II.en.i_err_pack + lineOf('pack:questions'), {timeout: 60000});
    eq((await iCards(p)).join(), 'zz-practice,big-one');
    noErr(h);
    await h.ctx.close();
  });

  await browser.close();
} else {
  console.log('omis: indicativ-international (nu există ' + path.relative(HUB, appFile('indicativ-international')) + ')');
  skipped.add('indicativ-international');
}

/* ================= VIETAR PACKS ================= */
if (present('vietar-packs')) {
  const NAME = 'vietar-packs';
  const ready = '#appmount .vp-root';
  const K = {packs: NAME + '.packs', draft: NAME + '.draft'};
  const RAW = /\b(?:tab|s|b|k|g|d|p|st|sn|i|e|v|c|gd|h|lim|th)_[a-z0-9_]{2,}\b/;
  const VDIR = path.join(ROOT, NAME);
  const VE = await import(pathToFileURL(path.join(VDIR, 'src', 'engine.mjs')).href);
  const VI = (await import(pathToFileURL(path.join(VDIR, 'src', 'i18n.mjs')).href)).default;
  VE.setSchemas(JSON.parse(fs.readFileSync(path.join(VDIR, 'schema.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(VDIR, 'pack.schema.json'), 'utf8')));
  const DIST = {};
  const DIST_TEXT = {};
  for (const f of fs.readdirSync(path.join(VDIR, 'data', 'dist')).sort()) {
    if (f === 'example.json') continue;
    DIST_TEXT[f.replace(/\.json$/, '')] = fs.readFileSync(path.join(VDIR, 'data', 'dist', f), 'utf8');
    const pk = JSON.parse(DIST_TEXT[f.replace(/\.json$/, '')]);
    DIST[pk.id] = pk;
  }
  const BUILT = Object.values(DIST).sort((a, b) => b.species.length - a.species.length || (a.id < b.id ? -1 : 1)).map((x) => x.id);
  const DEF = BUILT[0];
  eq(DEF, 'ro-plants-fungi', 'pachetul implicit: cel cu cele mai multe specii');
  const F = (s, ...a) => s.replace(/\{(\d)\}/g, (m, i) => String(a[Number(i)]));
  const T0 = '2026-11-17T12:00:00Z';
  const nameOf = (map, l) => VE.nameIn(map, l).text;
  const ids = (list) => list.map((s) => s.id);
  const sortedIds = (pack, l) => ids(VE.sortSpecies(pack.species, l));
  const LIM = VE.LIMITS;

  /* pachete generate: n specii distincte (id și nume latin doar din litere), grup «other», fără relații */
  const letters = (i) => { let s = ''; for (let k = 0; k < 3; k++) { s = String.fromCharCode(97 + (i % 26)) + s; i = Math.floor(i / 26); } return s; };
  const mkSp = (i, over) => Object.assign({id: 'zx' + letters(i) + '-testus', latin: 'Zx' + letters(i) + ' testus', kingdom: 'animalia', group: 'other', names: {en: 'Test ' + letters(i)}}, over || {});
  const mkPk = (id, n, over, spOver) => {
    const species = Array.from({length: n}, (_, i) => mkSp(i, spOver && spOver(i)));
    return Object.assign({format: VE.FORMAT, format_version: VE.FORMAT_VERSION, id, title: {en: 'Pack ' + id}, region: 'XX', version: '0.1.0', updated: '2026-11-17', licence: 'CC0-1.0', status: 'draft', count: n, species}, over || {});
  };
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';   // un PNG de 1×1 px
  const PHOTO = (over) => Object.assign({data: PNG, alt: {en: 'A tiny green square', ro: 'Un pătrat verde'}, author: 'Jane Doe', licence: 'CC-BY-4.0', source_url: 'https://commons.wikimedia.org/wiki/File:Test.png', commons_file: 'File:Test.png'}, over || {});
  const AUDIO = (over) => Object.assign({url: 'https://xeno-canto.org/123456', recordist: 'John Roe', licence: 'CC-BY-4.0'}, over || {});

  async function vOpen(o = {}) {
    const h = await newPage(browser, Object.assign({locale: 'en-GB', reduced: true}, o));
    if (o.time) await h.page.clock.setFixedTime(new Date(o.time));
    if (o.store) await h.ctx.addInitScript((kv) => {
      try { if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1'); Object.keys(kv).forEach((k) => localStorage.setItem(k, kv[k])); } catch (e) { /* ignorat */ }
    }, o.store);
    if (o.quota) await h.ctx.addInitScript(() => {
      const orig = Storage.prototype.setItem;
      window.__quota = false;
      Storage.prototype.setItem = function (k, v) { if (window.__quota && /^vietar-packs\./.test(k)) throw new DOMException('full', 'QuotaExceededError'); return orig.call(this, k, v); };
    });
    await h.page.goto('file://' + appFile(NAME));
    await h.page.waitForSelector(ready);
    await vLang(h.page, o.lang || 'en');
    h.opts = o;
    return h;
  }
  async function vLang(p, lang) {
    if ((await p.inputValue('#langsel')) !== lang) { await p.selectOption('#langsel', lang); await p.waitForSelector(ready); }
  }
  async function vFresh(h, store, over = {}) {
    noErr(h);
    await h.ctx.close();
    return vOpen(Object.assign({}, h.opts, over, {store: store}));
  }
  async function vReopen(h, over = {}) {
    const kv = await h.page.evaluate(() => { const r = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); r[k] = localStorage.getItem(k); } return r; });
    return vFresh(h, kv, over);
  }
  const vTab = async (p, id) => { await p.click('#vp-tt-' + id); await p.waitForSelector('#vp-p-' + id + ':not([hidden])'); };
  const vLive = async (p) => (await p.$eval('#vp-live', (e) => e.innerText)).trim();
  const vStore = (p, key) => p.evaluate((k) => { const t = localStorage.getItem(k); return t === null ? null : JSON.parse(t); }, key);
  const vActive = (p) => p.evaluate(() => document.activeElement && document.activeElement.id);
  const vText = async (p, sel) => (await p.textContent(sel)).trim();
  const vDl = async (p, sel) => {
    const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]);
    return {name: d.suggestedFilename(), text: fs.readFileSync(await d.path(), 'utf8')};
  };
  const vPoll = (p) => p.evaluate(() => ({}).polluted === undefined && Object.prototype.polluted === undefined);
  const vItems = (p) => p.$$eval('.vp-sp', (e) => e.map((x) => x.id.slice(6)));
  const vCount = (p) => vText(p, '#vp-count');
  const vSearch = async (p, q) => { await p.fill('#vp-q', q); };
  const vCards = (p) => p.$$eval('.vp-pack', (e) => e.map((x) => x.getAttribute('aria-labelledby').slice(8)));
  const vWaitLive = (p, txt) => p.waitForFunction((m) => (document.getElementById('vp-live') || {}).innerText === m || (document.getElementById('vp-live') || {}).textContent === m, txt, {timeout: 20000});
  const vRep = async (p) => (await p.$eval('#vp-imp-rep', (e) => e.innerText)).trim();
  const vImp = async (p, text) => { await p.fill('#vp-imp-ta', text); await p.click('#vp-imp-go'); };
  /** importă un pachet prin textarea și așteaptă fișa lui */
  const vImport = async (p, pack) => { await vTab(p, 'packs'); await vImp(p, JSON.stringify(pack)); await p.waitForSelector('#vp-pk-h-' + pack.id); };
  const vLines = (p, sel) => p.$$eval(sel + ' li', (e) => e.map((x) => x.textContent));
  const vFill = async (p, sel, v) => { await p.fill(sel, v); await p.press(sel, 'Tab'); };
  const vPick = async (p, id) => { await p.click('#vp-sp-' + id); await p.waitForSelector('#vp-detail'); };

  browser = await launch();
  await baseline(NAME, {ready, stateKey: K.packs, rawKey: RAW});

  await T(NAME + ': la pornire arată avertismentul, filele, pachetul implicit, numărătoarea și limitele, în toate limbile', async () => {
    const h = await vOpen({time: T0});
    const p = h.page, pk = DIST[DEF], st = VE.packStats(pk);
    for (const l of LANGS) {
      await p.selectOption('#langsel', l);
      await p.waitForSelector(ready);
      const I = VI[l];
      eq((await p.$$eval('.vp-tab', (e) => e.map((x) => x.textContent))).join('|'), [I.tab_browse, I.tab_packs, I.tab_build, I.tab_guide].join('|'), l + ': filele');
      eq(await p.$eval('#vp-tt-browse', (e) => e.getAttribute('aria-selected')), 'true', l);
      eq(await p.$$eval('.vp-tab[aria-selected="true"]', (e) => e.length), 1, l);
      eq(await p.$eval('#vp-safe h3', (e) => e.textContent), I.s_h, l + ': titlul avertismentului');
      eq((await p.$$eval('#vp-safe p', (e) => e.map((x) => x.textContent))).join('|'), [I.s_1, I.s_2, I.s_3].join('|'), l + ': avertismentul');
      eq((await p.$$eval('#vp-pack option', (e) => e.map((x) => x.value + '=' + x.textContent))).join('|'), BUILT.map((id) => id + '=' + nameOf(DIST[id].title, l) + ' · ' + I['st_' + DIST[id].status]).join('|'), l + ': pachetele');
      eq(await p.inputValue('#vp-pack'), DEF, l + ': pachetul implicit');
      eq(await vCount(p), F(I.b_count, pk.species.length, pk.species.length), l + ': numărătoarea');
      eq((await vItems(p)).join(), sortedIds(pk, l).join(), l + ': ordinea alfabetică în limba curentă');
      eq(await p.$eval('.vp-status', (e) => e.textContent), I['st_' + pk.status] + ' ' + I['sn_' + pk.status], l + ': starea pachetului');
      eq((await p.$$eval('.vp-box > .vp-meta', (e) => e.map((x) => x.textContent))).join('|'), F(I.p_stats, st.count, st.toxic, st.photos, st.audio), l + ': statistica');
      eq(await p.$eval('#vp-lim-card h2', (e) => e.textContent), I.h_limits, l + ': titlul limitelor');
      eq((await p.$$eval('#vp-lim-card li', (e) => e.map((x) => x.textContent))).join('|'), [1, 2, 3, 4, 5, 6].map((i) => I['lim_' + i]).join('|'), l + ': limitele');
      eq(await p.$$eval('#vp-lim-card', (e) => e.length), 1, l + ': cardul de limite apare o singură dată');
    }
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': avertismentul de siguranță rămâne vizibil pe toate filele, apăsat și fără buton de închidere', async () => {
    const h = await vOpen({time: T0});
    const p = h.page;
    for (const tab of ['browse', 'packs', 'build', 'guide']) {
      await vTab(p, tab);
      ok(await p.isVisible('#vp-safe'), tab + ': avertismentul nu se vede');
      const info = await p.evaluate(() => {
        const s = document.getElementById('vp-safe'), cs = getComputedStyle(s), sg = getComputedStyle(s.querySelector('.vp-strong'));
        return {border: cs.borderTopColor, bw: parseFloat(cs.borderTopWidth), weight: parseInt(sg.fontWeight, 10), controls: s.querySelectorAll('button,a,input,select,textarea,[role=button],[tabindex]').length, label: s.getAttribute('aria-labelledby'),
          first: !!(s.compareDocumentPosition(document.querySelector('.vp-tabs')) & Node.DOCUMENT_POSITION_FOLLOWING)};
      });
      ok(info.bw >= 2, tab + ': chenarul e prea subțire (' + info.bw + ')');
      eq(info.border, 'rgb(179, 38, 30)', tab + ': culoarea chenarului');
      ok(info.weight >= 600, tab + ': propoziția despre «nemarcată toxică» nu e îngroșată (' + info.weight + ')');
      eq(info.controls, 0, tab + ': avertismentul nu are butoane sau legături (nu poate fi închis)');
      eq(info.label, 'vp-safe-h', tab);
      ok(info.first, tab + ': avertismentul vine înaintea filelor');
    }
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': filele au rolurile și tastele corecte (săgeți, Home, End), iar panoul activ e singurul vizibil', async () => {
    const h = await vOpen({time: T0});
    const p = h.page;
    const TABS = ['browse', 'packs', 'build', 'guide'];
    const state = () => p.evaluate((ids) => ({
      sel: ids.filter((i) => document.getElementById('vp-tt-' + i).getAttribute('aria-selected') === 'true'),
      tab0: ids.filter((i) => document.getElementById('vp-tt-' + i).tabIndex === 0),
      shown: ids.filter((i) => !document.getElementById('vp-p-' + i).hidden),
      filled: ids.filter((i) => document.getElementById('vp-p-' + i).children.length > 0),
      active: document.activeElement && document.activeElement.id,
      ctl: ids.map((i) => document.getElementById('vp-tt-' + i).getAttribute('aria-controls')).join(), lab: ids.map((i) => document.getElementById('vp-p-' + i).getAttribute('aria-labelledby')).join(),
      list: document.querySelector('.vp-tabs').getAttribute('role')
    }), TABS);
    let s = await state();
    eq(s.list, 'tablist');
    eq(s.ctl, TABS.map((i) => 'vp-p-' + i).join());
    eq(s.lab, TABS.map((i) => 'vp-tt-' + i).join());
    eq(s.sel.join(), 'browse'); eq(s.tab0.join(), 'browse'); eq(s.shown.join(), 'browse'); eq(s.filled.join(), 'browse', 'doar panoul activ e construit');
    await p.focus('#vp-tt-browse');
    const steps = [['ArrowRight', 'packs'], ['ArrowRight', 'build'], ['End', 'guide'], ['ArrowRight', 'browse'], ['ArrowLeft', 'guide'], ['Home', 'browse'], ['ArrowLeft', 'guide'], ['ArrowLeft', 'build']];
    for (const [key, want] of steps) {
      await p.keyboard.press(key);
      s = await state();
      eq(s.sel.join(), want, key + ': fila selectată');
      eq(s.tab0.join(), want, key + ': singura filă în ordinea Tab');
      eq(s.shown.join(), want, key + ': panoul vizibil');
      eq(s.filled.join(), want, key + ': panourile ascunse nu sunt construite');
      eq(s.active, 'vp-tt-' + want, key + ': focalizarea urmează fila');
    }
    // alte taste nu schimbă nimic
    await p.keyboard.press('ArrowDown');
    eq((await state()).sel.join(), 'build');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': răsfoire: grupul și toxicitatea filtrează exact ca motorul, în fiecare pachet inclus', async () => {
    const h = await vOpen({time: T0});
    const p = h.page;
    for (const pid of BUILT) {
      if ((await p.inputValue('#vp-pack')) !== pid) await p.selectOption('#vp-pack', pid);
      const pk = DIST[pid];
      const groups = await p.$$eval('#vp-grp option', (e) => e.map((x) => x.value));
      eq(groups.join(), ['all'].concat(VE.GROUP_ORDER.filter((g) => pk.species.some((s) => s.group === g))).join(), pid + ': grupurile din listă');
      const labels = await p.$$eval('#vp-grp option', (e) => e.map((x) => x.textContent));
      eq(labels[0], VI.en.b_all_groups);
      groups.slice(1).forEach((g, i) => eq(labels[i + 1], VI.en['g_' + g] + ' (' + pk.species.filter((s) => s.group === g).length + ')', pid + ': eticheta grupului ' + g));
      for (const g of groups) for (const t of ['all', 'yes', 'no']) {
        await p.selectOption('#vp-grp', g);
        await p.selectOption('#vp-tox', t);
        const want = ids(VE.filterSpecies(pk.species, {q: '', group: g, toxic: t, lang: 'en'}));
        eq((await vItems(p)).join(), want.join(), pid + ' / ' + g + ' / ' + t);
        eq(await vCount(p), F(VI.en.b_count, want.length, pk.species.length), pid + ' / ' + g + ' / ' + t + ': numărătoarea');
      }
    }
    // «Marked toxic» include doar plantele și ciupercile cu toxic = true; «Not marked toxic» restul (și animalele fără indicație)
    await p.selectOption('#vp-pack', DEF);
    await p.selectOption('#vp-grp', 'all');
    await p.selectOption('#vp-tox', 'yes');
    const yes = await vItems(p);
    eq(yes.length, DIST[DEF].species.filter((s) => s.toxic === true).length);
    ok(yes.includes('amanita-phalloides') && !yes.includes('allium-ursinum') && !yes.includes('boletus-edulis'), yes.join());
    await p.selectOption('#vp-tox', 'no');
    const no = await vItems(p);
    ok(no.includes('allium-ursinum') && !no.includes('amanita-phalloides'), no.join());
    // schimbarea pachetului curăță filtrele
    await p.selectOption('#vp-pack', 'ro-mammals');
    eq(await p.inputValue('#vp-tox'), 'all'); eq(await p.inputValue('#vp-grp'), 'all'); eq(await p.inputValue('#vp-q'), '');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': căutarea ignoră diacriticele și majusculele, caută în toate numele și în numele latin și se combină cu filtrele', async () => {
    const h = await vOpen({time: T0, lang: 'ro'});
    const p = h.page, pk = DIST[DEF];
    const cases = [['brandusa', ['colchicum-autumnale']], ['BRÂNDUȘĂ', ['colchicum-autumnale']], ['leurda', ['allium-ursinum']], ['lacramioara', ['convallaria-majalis']], ['galbiori', ['cantharellus-cibarius']],
      ['barlauch', ['allium-ursinum']], ['Bärlauch', ['allium-ursinum']], ['medvehagyma', ['allium-ursinum']], ['ursinum', ['allium-ursinum']], ['allium ursinum', ['allium-ursinum']], ['ursinum allium', ['allium-ursinum']],
      ['wild garlic', ['allium-ursinum']], ['  amanita  ', ['amanita-muscaria', 'amanita-phalloides']], ['zzzz', []], ['allium colchicum', []]];
    for (const [q, want] of cases) {
      await vSearch(p, q);
      eq((await vItems(p)).join(), want.join(), 'căutare «' + q + '»');
      eq(ids(VE.filterSpecies(pk.species, {q, group: 'all', toxic: 'all', lang: 'ro'})).join(), want.join(), 'motorul pentru «' + q + '»');
      eq(await vCount(p), F(VI.ro.b_count, want.length, pk.species.length), q);
      if (!want.length) eq(await vText(p, '.vp-listbox .vp-hint'), VI.ro.b_none, q);
    }
    // se combină cu grupul și toxicitatea
    await vSearch(p, 'amanita');
    await p.selectOption('#vp-grp', 'fungus');
    eq((await vItems(p)).join(), 'amanita-muscaria,amanita-phalloides');
    await p.selectOption('#vp-tox', 'no');
    eq((await vItems(p)).join(), '');
    eq(await vCount(p), F(VI.ro.b_count, 0, pk.species.length));
    await p.selectOption('#vp-tox', 'all');
    await p.selectOption('#vp-grp', 'tree');
    eq((await vItems(p)).join(), '');
    await p.selectOption('#vp-grp', 'all');
    // căutarea rămâne la schimbarea limbii, iar rezultatele se rânduiesc în noua limbă
    await vSearch(p, 'amanita');
    await vLang(p, 'de');
    eq(await p.inputValue('#vp-q'), 'amanita');
    eq((await vItems(p)).join(), ids(VE.filterSpecies(pk.species, {q: 'amanita', group: 'all', toxic: 'all', lang: 'de'})).join());
    eq(await vCount(p), F(VI.de.b_count, 2, pk.species.length));
    // contorul e anunțat politicos
    eq(await p.$eval('#vp-count', (e) => e.getAttribute('role') + '/' + e.getAttribute('aria-live')), 'status/polite');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': lista arată câte 24 de specii; «Show more» adaugă câte 24 și mută focalizarea pe prima specie nouă; căutarea pornește de la capăt', async () => {
    const h = await vOpen({time: T0});
    const p = h.page;
    const pk = mkPk('xx-sixty', 60);
    eq(VE.validatePack(pk).length, 0);
    await vImport(p, pk);
    await p.click('#vp-pk-open-xx-sixty');
    await p.waitForSelector('#vp-more');
    const order = sortedIds(pk, 'en');
    eq(await vActive(p), 'vp-q', 'după «Open» focalizarea e pe căutare');
    eq((await vItems(p)).join(), order.slice(0, 24).join());
    eq(await vText(p, '#vp-more'), F(VI.en.b_more, 24));
    eq(await vCount(p), F(VI.en.b_count, 60, 60));
    await p.click('#vp-more');
    eq((await vItems(p)).join(), order.slice(0, 48).join());
    eq(await vActive(p), 'vp-sp-' + order[24], 'focalizarea trece pe prima specie nouă');
    eq(await vText(p, '#vp-more'), F(VI.en.b_more, 12));
    await p.click('#vp-more');
    eq((await vItems(p)).join(), order.join());
    eq(await vActive(p), 'vp-sp-' + order[48]);
    eq(await p.$$eval('#vp-more', (e) => e.length), 0, 'butonul dispare când s-au arătat toate');
    // 26 de rezultate: 24 + «Show more 2»
    await vSearch(p, 'zxaa');
    const found = ids(VE.filterSpecies(pk.species, {q: 'zxaa', group: 'all', toxic: 'all', lang: 'en'}));
    eq(found.length, 26);
    eq((await vItems(p)).join(), found.slice(0, 24).join());
    eq(await vText(p, '#vp-more'), F(VI.en.b_more, 2));
    await p.click('#vp-more');
    eq((await vItems(p)).length, 26);
    eq(await p.$$eval('#vp-more', (e) => e.length), 0);
    // o căutare nouă pornește iar de la 24
    await vSearch(p, 'zxab');
    eq((await vItems(p)).length, 24, 'căutarea nouă începe de la prima pagină');
    await vSearch(p, '');
    eq((await vItems(p)).length, 24, 'ștergerea căutării începe de la prima pagină');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': întoarcerea din fișă deschide pagina care conține specia (și o focalizează), chiar dacă fișa s-a deschis printr-o sosie ascunsă', async () => {
    const h = await vOpen({time: T0});
    const p = h.page;
    const first = mkSp(0).id, far = mkSp(40).id, note = {en: 'People confuse these two.'};
    const pk = mkPk('xx-sixty', 60, null, (i) => i === 0 ? {look_alike: [{id: far, note}]} : i === 40 ? {look_alike: [{id: first, note}]} : null);
    eq(VE.validatePack(pk).length, 0);
    await vImport(p, pk);
    await p.click('#vp-pk-open-xx-sixty');
    await p.waitForSelector('#vp-more');
    ok(!(await vItems(p)).includes(far), 'specia de la poziția 41 nu e pe prima pagină');
    await vPick(p, first);
    await p.click('#vp-look-' + far);
    await p.waitForSelector('#vp-detail');
    eq(await vActive(p), 'vp-d-h');
    eq(await vText(p, '#vp-d-h'), 'Test ' + letters(40) + ' ' + mkSp(40).latin);
    await p.click('#vp-back');
    await p.waitForSelector('#vp-list');
    ok((await vItems(p)).includes(far), 'specia a ajuns pe o pagină afișată');
    eq((await vItems(p)).length, 48);
    eq(await vActive(p), 'vp-sp-' + far, 'focalizarea e pe specia din care s-a revenit');
    // fără specie de revenire (căutarea s-a golit între timp), focalizarea merge pe câmpul de căutare
    await vPick(p, far);
    await p.click('#vp-back');
    eq(await vActive(p), 'vp-sp-' + far);
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': fișa unei plante toxice, a uneia «nemarcate toxice» și a unui animal: cuvinte potrivite, notă, nume în ordine, focalizare', async () => {
    const h = await vOpen({time: T0, lang: 'ro'});
    const p = h.page, pk = DIST[DEF], by = VE.indexById(pk), I = VI.ro;
    // plantă toxică
    let sp = by['colchicum-autumnale'];
    await vPick(p, sp.id);
    eq(await vActive(p), 'vp-d-h', 'focalizarea e pe titlul fișei');
    eq(await vText(p, '#vp-d-h'), nameOf(sp.names, 'ro') + ' ' + sp.latin);
    eq(await vText(p, '#vp-detail p.vp-meta'), F(I.d_group, I.k_plantae, I.g_herb));
    eq(await vText(p, '.vp-tox-yes .vp-tox-h'), I.d_tox_yes);
    eq(await vText(p, '.vp-tox-yes h4'), I.d_tox_note_h);
    eq(await vText(p, '.vp-tox-yes p.vp-pre'), nameOf(sp.toxic_note, 'ro'));
    eq(await p.$eval('.vp-tox-yes p.vp-pre', (e) => e.getAttribute('lang')), 'ro');
    eq(await p.$$eval('.vp-tox .vp-hint', (e) => e.length), 0, 'o plantă marcată toxică nu are avertismentul «nemarcată toxică»');
    eq(await p.$$eval('.vp-tox-no', (e) => e.length), 0);
    // numele, în ordinea: limba curentă, engleza, restul alfabetic; fiecare cu lang
    eq((await p.$$eval('.vp-names li', (e) => e.map((x) => x.firstChild.textContent))).join(), 'ro,en,de,hu');
    eq((await p.$$eval('.vp-names li', (e) => e.map((x) => x.lastChild.textContent + '/' + x.lastChild.getAttribute('lang')))).join('|'), ['ro', 'en', 'de', 'hu'].map((c) => sp.names[c] + '/' + c).join('|'));
    eq((await p.$$eval('#vp-detail > h4', (e) => e.map((x) => x.textContent))).join('|'), [I.d_names_h, I.d_look_h].join('|'), 'titlurile secțiunilor fișei');
    await p.click('#vp-back');
    eq(await vActive(p), 'vp-sp-' + sp.id, 'Back: focalizarea revine pe specie');
    // plantă «nemarcată toxică»: nicio culoare liniștitoare, avertisment mereu
    sp = by['allium-ursinum'];
    await vPick(p, sp.id);
    eq(await vText(p, '.vp-tox-no .vp-tox-h'), I.d_tox_no);
    eq(await vText(p, '.vp-tox-no .vp-hint'), I.d_tox_warn);
    eq(await p.$$eval('.vp-tox-yes', (e) => e.length), 0);
    eq(await p.$$eval('.vp-tox-no h4', (e) => e.length), 0, 'nu are notă de toxicitate');
    // sosiile: butoane către celelalte specii, cu nota fiecăreia, după un titlu și un avertisment
    eq((await p.$$eval('#vp-detail > h4', (e) => e.map((x) => x.textContent))).join('|'), [I.d_names_h, I.d_look_h].join('|'));
    eq(await p.$$eval('#vp-detail > p.vp-hint', (e, w) => e.map((x) => x.textContent).filter((t) => t === w).length, I.d_look_help), 1, 'explicația sosiilor');
    const looks = await p.$$eval('.vp-looks li', (e) => e.map((x) => [x.querySelector('button').id, x.querySelector('button').textContent, x.querySelector('.vp-pre').textContent]));
    eq(looks.length, 3);
    sp.look_alike.forEach((l, i) => {
      eq(looks[i][0], 'vp-look-' + l.id);
      eq(looks[i][1], F(I.d_look_go, nameOf(by[l.id].names, 'ro')));
      eq(looks[i][2], nameOf(l.note, 'ro'));
    });
    // salt la o sosie: titlul ei, focalizare pe titlu, iar sosia o arată înapoi
    await p.click('#vp-look-convallaria-majalis');
    await p.waitForSelector('#vp-detail');
    eq(await vText(p, '#vp-d-h'), nameOf(by['convallaria-majalis'].names, 'ro') + ' Convallaria majalis');
    eq(await vActive(p), 'vp-d-h');
    eq(await p.$$eval('#vp-look-allium-ursinum', (e) => e.length), 1, 'relația se vede și din partea cealaltă');
    // limba schimbată cu fișa deschisă: aceeași specie, în limba nouă
    await vLang(p, 'de');
    eq(await vText(p, '#vp-d-h'), nameOf(by['convallaria-majalis'].names, 'de') + ' Convallaria majalis');
    eq(await vText(p, '.vp-tox-yes .vp-tox-h'), VI.de.d_tox_yes);
    // un animal: nici «toxic», nici «nemarcat»: se spune că nu se știe, cu același avertisment
    await vLang(p, 'ro');
    await p.click('#vp-back');
    await p.selectOption('#vp-pack', 'ro-mammals');
    await vPick(p, 'lynx-lynx');
    eq(await vText(p, '.vp-tox .vp-tox-h'), I.d_tox_unk);
    eq(await vText(p, '.vp-tox .vp-hint'), I.d_tox_warn);
    eq(await p.$$eval('.vp-tox-yes, .vp-tox-no', (e) => e.length), 0);
    eq(await p.$$eval('.vp-looks', (e) => e.length), 0, 'fără sosii nu apare secțiunea');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': nume lipsă în limba aleasă: se arată cel englezesc, marcat cu limba lui, iar notele au atributul lang potrivit', async () => {
    const h = await vOpen({time: T0, lang: 'ro'});
    const p = h.page, sp = VE.indexById(DIST[DEF])['galerina-marginata'];   // nume doar în en și de; note în en și ro
    const nameAttrs = (sel) => p.$eval(sel, (e) => [e.getAttribute('lang'), e.textContent]);
    eq((await nameAttrs('#vp-sp-' + sp.id + ' .vp-n')).join('|'), 'en|' + sp.names.en + ' (en)', 'în listă, în română');
    await vLang(p, 'de');
    eq((await nameAttrs('#vp-sp-' + sp.id + ' .vp-n')).join('|'), 'de|' + sp.names.de, 'în germană nu apare marcajul');
    await vLang(p, 'ro');
    await vPick(p, sp.id);
    eq((await nameAttrs('#vp-d-h .vp-n')).join('|'), 'en|' + sp.names.en + ' (en)');
    eq((await p.$$eval('.vp-names li', (e) => e.map((x) => x.firstChild.textContent))).join(), 'en,de', 'fără «ro», ordinea e en, apoi restul');
    const notes = () => p.$$eval('#vp-detail p.vp-pre', (e) => e.map((x) => x.getAttribute('lang') + ':' + x.textContent));
    eq((await notes()).join('|'), ['ro:' + sp.toxic_note.ro, 'ro:' + sp.notes.ro].join('|'), 'notele există în română');
    await vLang(p, 'hu');
    eq((await nameAttrs('#vp-d-h .vp-n')).join('|'), 'en|' + sp.names.en + ' (en)', 'în maghiară lipsește numele: engleza');
    eq((await notes()).join('|'), ['en:' + sp.toxic_note.en, 'en:' + sp.notes.en].join('|'), 'notele cad pe engleză, cu lang="en"');
    await vLang(p, 'de');
    eq((await notes()).join('|'), ['en:' + sp.toxic_note.en, 'en:' + sp.notes.en].join('|'));
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': fotografiile și sunetele din pachete: imagini decodate, alt în limba curentă, atribuire și licență cu legături sigure, fără player și fără rețea', async () => {
    const h = await vOpen({time: T0, lang: 'ro'});
    const p = h.page, I = VI.ro;
    const note = {en: 'Song <i>loud</i>', ro: 'Cântec'};
    const pk = mkPk('xx-media', 3, null, (i) => i === 0 ? {photos: [PHOTO(), PHOTO({alt: {en: 'Second'}, author: 'Max <b>Muster</b>', licence: 'CC0-1.0'})],
      audio: [AUDIO({note}), AUDIO({url: 'https://www.xeno-canto.org/9', recordist: 'A. B.', licence: 'CC0-1.0'})]} : null);
    eq(JSON.stringify(VE.validatePack(pk)), '[]');
    await vImport(p, pk);
    eq((await p.$$eval('.vp-meta', (e) => e.map((x) => x.textContent))).filter((t) => t === F(I.p_stats, 3, 0, 2, 2)).length, 1, 'statistica pachetului numără fotografiile și sunetele');
    await p.click('#vp-pk-open-xx-media');
    await vPick(p, mkSp(0).id);
    await p.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
    const figs = await p.$$eval('#vp-detail figure.vp-fig', (e) => e.map((f) => {
      const i = f.querySelector('img'), c = f.querySelector('figcaption');
      return {alt: i.alt, w: i.naturalWidth, src: i.getAttribute('src').slice(0, 22), cap: c.textContent, b: c.querySelectorAll('b').length, links: Array.from(c.querySelectorAll('a')).map((a) => [a.href, a.textContent, a.target, a.rel].join('|'))};
    }));
    eq(figs.length, 2);
    eq(figs[0].alt, 'Un pătrat verde'); eq(figs[1].alt, 'Second', 'fără alt în română: engleza');
    figs.forEach((f) => { eq(f.w, 1, 'imaginea se decodează'); eq(f.src, 'data:image/png;base64,'); });
    const where = ' · ' + I.d_original + ' (commons.wikimedia.org)';
    eq(figs[0].cap, F(I.d_photo_cap, 'Jane Doe', 'CC-BY-4.0') + where);
    eq(figs[1].cap, F(I.d_photo_cap, 'Max <b>Muster</b>', 'CC0-1.0') + where);
    eq(figs[1].b, 0, 'marcajele din autor rămân text');
    eq(figs[0].links.join('\n'), ['https://creativecommons.org/licenses/by/4.0/|CC-BY-4.0|_blank|noopener noreferrer', 'https://commons.wikimedia.org/wiki/File:Test.png|' + I.d_original + ' (commons.wikimedia.org)|_blank|noopener noreferrer'].join('\n'));
    eq(figs[1].links[0], 'https://creativecommons.org/publicdomain/zero/1.0/|CC0-1.0|_blank|noopener noreferrer');
    const heads = await p.$$eval('#vp-detail > h4', (e) => e.map((x) => x.textContent));
    ok(heads.includes(I.d_photos_h) && heads.includes(I.d_audio_h), heads.join('|'));
    const aud = await p.$$eval('#vp-detail .vp-audio li', (e) => e.map((li) => ({text: li.textContent, i: li.querySelectorAll('i').length, span: li.querySelector('span') ? li.querySelector('span').getAttribute('lang') : null, links: Array.from(li.querySelectorAll('a')).map((a) => [a.href, a.textContent, a.target, a.rel].join('|'))})));
    eq(aud.length, 2);
    eq(aud[0].text, I.d_audio_open + ' · ' + F(I.d_audio_cap, 'John Roe', 'CC-BY-4.0') + ' · Cântec', 'nota sunetului se arată în limba curentă (nu «[object Object]»)');
    eq(aud[0].span, 'ro');
    eq(aud[0].links.join('\n'), ['https://xeno-canto.org/123456|' + I.d_audio_open + '|_blank|noopener noreferrer', 'https://creativecommons.org/licenses/by/4.0/|CC-BY-4.0|_blank|noopener noreferrer'].join('\n'));
    eq(aud[1].text, I.d_audio_open + ' · ' + F(I.d_audio_cap, 'A. B.', 'CC0-1.0'));
    eq(aud[1].links[0], 'https://www.xeno-canto.org/9|' + I.d_audio_open + '|_blank|noopener noreferrer');
    eq(await p.$$eval('#vp-detail > p.vp-hint', (e, w) => e.map((x) => x.textContent).filter((t) => t === w).length, I.d_audio_note), 1, 'se spune că pagina nu redă sunet');
    await vLang(p, 'en');
    eq((await p.$$eval('#vp-detail .vp-audio li', (e) => e[0].textContent)), VI.en.d_audio_open + ' · ' + F(VI.en.d_audio_cap, 'John Roe', 'CC-BY-4.0') + ' · Song <i>loud</i>', 'în engleză: nota englezească, ca text');
    eq(await p.$$eval('audio, video, iframe, embed, object, source', (e) => e.length), 0, 'nicio redare de sunet sau video, niciun conținut încorporat');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': texte din pachete cu marcaje HTML, adrese javascript: și entități apar ca text, niciodată ca cod', async () => {
    const h = await vOpen({time: T0});
    const p = h.page;
    const evil = '<img src=x onerror="window.__x=1">', html = '<b>bold</b> &amp; <a href="javascript:alert(1)">link</a>';
    const pk = mkPk('xx-html', 2, {title: {en: '<script>window.__y=1</script>'}, description: {en: html}, authors: ['<i>Eve</i>']}, (i) => i === 0 ? {names: {en: evil}, notes: {en: html}, source: '<u>src</u>'} : null);
    eq(JSON.stringify(VE.validatePack(pk)), '[]');
    await vImport(p, pk);
    eq(await vText(p, '#vp-pk-t-xx-html'), '<script>window.__y=1</script>');
    const facts = await p.$$eval('.vp-pack .vp-meta', (e) => e.map((x) => x.textContent));
    ok(facts.includes(html), 'descrierea pachetului ca text');
    ok(facts.includes(F(VI.en.p_by, '<i>Eve</i>')), 'autorii ca text');
    await p.click('#vp-pk-open-xx-html');
    const sp0 = mkSp(0).id;
    eq(await p.$eval('#vp-sp-' + sp0 + ' .vp-n', (e) => e.textContent), evil);
    await vPick(p, sp0);
    eq(await vText(p, '#vp-d-h'), evil + ' ' + mkSp(0).latin);
    eq(await vText(p, '#vp-detail p.vp-pre'), html);
    ok((await p.$$eval('#vp-detail p.vp-meta', (e) => e.map((x) => x.textContent))).includes(F(VI.en.d_source, '<u>src</u>')));
    eq(await p.$$eval('#appmount img, #appmount b, #appmount i, #appmount u, #appmount script, #appmount a[href^="javascript"]', (e) => e.length), 0, 'niciun element creat din text');
    ok(await p.evaluate(() => window.__x === undefined && window.__y === undefined), 'niciun cod din pachet nu s-a executat');
    noErr(h);
    await h.ctx.close();
  });

  const vLinesOf = (pk, l = 'en') => {   // rândurile pe care trebuie să le arate pagina pentru un pachet invalid (cel mult 20, apoi «…și încă N»)
    const pr = VE.validatePack(pk), out = pr.slice(0, 20).map((x) => VI[l]['v_' + x.code] + (x.path ? ' (' + x.path + ')' : ''));
    if (pr.length > 20) out.push(F(VI[l].i_more, pr.length - 20));
    return out;
  };
  const vShownLines = (p) => p.$$eval('#vp-imp-rep li', (e) => e.map((x) => x.textContent));
  const vHead = (p) => p.$eval('#vp-imp-rep p.vp-bad', (e) => e.textContent);

  await T(NAME + ': fișele pachetelor incluse: titlu, stare, statistică, metadate, licență, autori și tabelul pe grupe, în toate limbile', async () => {
    const h = await vOpen({time: T0});
    const p = h.page;
    await vTab(p, 'packs');
    for (const l of LANGS) {
      await vLang(p, l);
      const I = VI[l];
      eq((await vCards(p)).join(), BUILT.join(), l + ': ordinea pachetelor (cele mai mari întâi)');
      for (const id of BUILT) {
        const pk = DIST[id], st = VE.packStats(pk), card = 'section[aria-labelledby="vp-pk-h-' + id + '"]';
        eq(await vText(p, '#vp-pk-t-' + id), nameOf(pk.title, l), l + ' ' + id + ': titlul');
        eq(await p.$eval('#vp-pk-h-' + id + ' .vp-badge', (e) => e.textContent), I.p_built, l + ': insigna «Built in»');
        eq(await p.$eval(card + ' .vp-status', (e) => e.textContent), I['st_' + pk.status] + ' ' + I['sn_' + pk.status], l + ' ' + id + ': starea');
        const want = [F(I.p_stats, st.count, st.toxic, st.photos, st.audio)];
        if (pk.description) want.push(nameOf(pk.description, l));
        want.push(F(I.p_meta, pk.region, pk.version, pk.updated), F(I.p_lic, pk.licence), F(I.p_by, pk.authors.join(', ')));
        eq((await p.$$eval(card + ' .vp-meta', (e) => e.map((x) => x.textContent))).join('\n'), want.join('\n'), l + ' ' + id + ': metadatele');
        eq(await p.$eval(card + ' .vp-meta a', (e) => [e.href, e.textContent, e.target, e.rel].join('|')), 'https://creativecommons.org/publicdomain/zero/1.0/|CC0-1.0|_blank|noopener noreferrer', l + ': licența');
        eq(await vText(p, '#vp-pk-open-' + id), I.p_open); eq(await vText(p, '#vp-pk-dl-' + id), I.p_export);
        eq(await p.$$eval('#vp-pk-rm-' + id, (e) => e.length), 0, 'un pachet inclus nu se poate șterge');
        eq(await vText(p, '#vp-gr-h-' + id), I.p_groups_h);
        const t = await p.$eval(card + ' .vp-tblwrap', (w) => ({head: Array.from(w.querySelectorAll('th[scope=col]')).map((x) => x.textContent), rows: Array.from(w.querySelectorAll('tbody tr')).map((r) => r.textContent), lab: w.getAttribute('aria-labelledby'), role: w.getAttribute('role'), ti: w.tabIndex}));
        eq(t.head.join(), [I.th_group, I.th_count].join(), l + ': capul tabelului');
        eq(t.rows.join('|'), VE.GROUP_ORDER.filter((g) => st.groups[g]).map((g) => I['g_' + g] + st.groups[g]).join('|'), l + ' ' + id + ': rândurile tabelului');
        eq(t.lab, 'vp-pk-t-' + id + ' vp-gr-h-' + id); eq(t.role, 'region'); eq(t.ti, 0);
      }
    }
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': «Open» duce pachetul în Browse (curățând filtrele), iar «Export» dă fișierul exact, care trece de propriul validator și se poate importa din nou', async () => {
    const h = await vOpen({time: T0});
    const p = h.page;
    for (const id of BUILT) {
      await vTab(p, 'packs');
      const d = await vDl(p, '#vp-pk-dl-' + id);
      eq(d.name, VE.packFileName(id));
      eq(d.text, VE.packText(DIST[id]), id + ': conținutul exportat');
      eq(d.text, DIST_TEXT[id], id + ': identic cu fișierul din data/dist');
      eq(JSON.stringify(VE.validatePack(JSON.parse(d.text))), '[]');
    }
    await vTab(p, 'packs');
    await p.click('#vp-pk-open-bg-starter');
    await p.waitForSelector('#vp-p-browse:not([hidden])');
    eq(await p.inputValue('#vp-pack'), 'bg-starter');
    eq(await vActive(p), 'vp-q');
    eq(await p.inputValue('#vp-q'), ''); eq(await p.inputValue('#vp-grp'), 'all'); eq(await p.inputValue('#vp-tox'), 'all');
    eq((await vItems(p)).join(), sortedIds(DIST['bg-starter'], 'en').join());
    // un pachet real (cel exportat), cu alt id, intră întreg
    const copy = JSON.parse(DIST_TEXT['ro-mammals']);
    copy.id = 'xx-copy';
    await vImport(p, copy);
    eq(await vText(p, '#vp-pk-h-xx-copy .vp-badge'), VI.en.p_imp);
    eq((await p.$$eval('section[aria-labelledby="vp-pk-h-xx-copy"] .vp-meta', (e) => e[0].textContent)), F(VI.en.p_stats, 15, 0, 0, 0));
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': importul din text și din fișier adaugă pachetul, îl păstrează între vizite, îl înlocuiește la același id și îl poate șterge după confirmare', async () => {
    let h = await vOpen({time: T0});
    let p = h.page;
    const a = mkPk('xx-one', 3), b = mkPk('xx-two', 2, {title: {en: 'Second pack'}});
    await vTab(p, 'packs');
    await vImp(p, JSON.stringify(a));
    await p.waitForSelector('#vp-pk-h-xx-one');
    eq(await vLive(p), F(VI.en.i_done, 'Pack xx-one', 3));
    eq(await vActive(p), 'vp-pk-h-xx-one', 'focalizarea e pe titlul pachetului nou');
    eq(await p.inputValue('#vp-imp-ta'), '', 'textul s-a golit după import');
    eq((await vCards(p)).join(), BUILT.concat(['xx-one']).join());
    eq(await vText(p, '#vp-pk-h-xx-one .vp-badge'), VI.en.p_imp);
    eq(JSON.stringify(await vStore(p, K.packs)), JSON.stringify([a]), 'pachetul e salvat întocmai');
    // din fișier
    await p.setInputFiles('#vp-imp-file', {name: 'two.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(b))});
    await p.click('#vp-imp-go');
    await p.waitForSelector('#vp-pk-h-xx-two');
    eq(await vLive(p), F(VI.en.i_done, 'Second pack', 2));
    eq(await p.$eval('#vp-imp-file', (e) => e.value), '', 'câmpul de fișier s-a golit');
    eq((await vCards(p)).join(), BUILT.concat(['xx-one', 'xx-two']).join());
    // același id: înlocuiește, nu dublează
    const a2 = mkPk('xx-one', 5, {title: {en: 'First pack again'}});
    await vImp(p, JSON.stringify(a2));
    await p.waitForFunction(() => /again/.test(document.getElementById('vp-live').textContent));
    eq(await vLive(p), F(VI.en.i_replaced, 'First pack again', 5));
    eq((await vCards(p)).join(), BUILT.concat(['xx-one', 'xx-two']).join());
    eq(JSON.stringify((await vStore(p, K.packs)).map((x) => [x.id, x.species.length])), JSON.stringify([['xx-one', 5], ['xx-two', 2]]));
    // păstrat la o vizită nouă, în Browse apare în lista de pachete
    h = await vReopen(h);
    p = h.page;
    eq((await p.$$eval('#vp-pack option', (e) => e.map((x) => x.value))).join(), BUILT.concat(['xx-one', 'xx-two']).join());
    await vTab(p, 'packs');
    eq(await vText(p, '#vp-pk-t-xx-one'), 'First pack again');
    // ștergerea cere confirmare: prima apăsare schimbă doar textul butonului
    await p.click('#vp-pk-rm-xx-one');
    eq(await vText(p, '#vp-pk-rm-xx-one'), VI.en.p_remove_sure);
    eq(await vActive(p), 'vp-pk-rm-xx-one');
    eq((await vCards(p)).length, BUILT.length + 2, 'încă nu s-a șters nimic');
    await vTab(p, 'browse'); await vTab(p, 'packs');
    eq(await vText(p, '#vp-pk-rm-xx-one'), VI.en.p_remove, 'confirmarea se anulează la schimbarea filei');
    await p.click('#vp-pk-rm-xx-one');
    await p.click('#vp-pk-rm-xx-one');
    eq((await vCards(p)).join(), BUILT.concat(['xx-two']).join());
    eq(await vLive(p), F(VI.en.p_removed, 'First pack again'));
    eq(await vActive(p), 'vp-imp-h');
    eq(JSON.stringify((await vStore(p, K.packs)).map((x) => x.id)), '["xx-two"]');
    // ștergerea pachetului deschis în Browse revine la primul pachet
    await p.click('#vp-pk-open-xx-two');
    await vTab(p, 'packs');
    await p.click('#vp-pk-rm-xx-two'); await p.click('#vp-pk-rm-xx-two');
    eq(JSON.stringify(await vStore(p, K.packs)), '[]');
    await vTab(p, 'browse');
    eq(await p.inputValue('#vp-pack'), DEF);
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': importuri greșite: mesaje pe categorii, problemele cu locul lor (cel mult 20), nimic salvat, nimic stricat; mesajele urmează limba', async () => {
    const h = await vOpen({time: T0});
    const p = h.page, I = VI.en;
    await vTab(p, 'packs');
    eq(await vStore(p, K.packs), null);
    const cards = async () => eq((await vCards(p)).join(), BUILT.join(), 'niciun pachet nou');
    // fără conținut / nu e JSON
    for (const t of ['', '   \n  ']) { await vImp(p, t); eq(await vHead(p), I.i_err_empty, 'gol «' + t + '»'); eq(await vActive(p), 'vp-imp-rep', 'focalizarea e pe raport'); }
    for (const t of ['{', 'not json', '{"a":1,}', '<html></html>']) { await vImp(p, t); eq(await vHead(p), I.i_err_json, 'nu e JSON «' + t + '»'); eq(await p.$$eval('#vp-imp-rep li', (e) => e.length), 0); }
    await cards();
    // JSON valid, dar nu un pachet corect
    const good = mkPk('xx-bad', 3);
    const cp = (f) => { const o = JSON.parse(JSON.stringify(good)); f(o); return o; };
    const cases = {
      'matrice': [], 'null': null, 'număr': 123, 'text': 'x', 'obiect gol': {},
      'fără specii': cp((o) => { delete o.species; }), 'număr greșit de specii': cp((o) => { o.count = 5; }), 'format străin': cp((o) => { o.format = 'other'; }),
      'câmp în plus': cp((o) => { o.extra = 1; }), 'id cu majuscule': cp((o) => { o.id = 'Xx_Bad'; }), 'status «reviewed» fără recenzor': cp((o) => { o.status = 'reviewed'; }),
      'plantă fără câmpul toxic': cp((o) => { o.species[0].kingdom = 'plantae'; o.species[0].group = 'herb'; }),
      'plantă toxică fără notă': cp((o) => { o.species[0].kingdom = 'plantae'; o.species[0].group = 'herb'; o.species[0].toxic = true; }),
      'notă de toxicitate la o plantă netoxică': cp((o) => { o.species[0].kingdom = 'plantae'; o.species[0].group = 'herb'; o.species[0].toxic = false; o.species[0].toxic_note = {en: 'x'}; }),
      'grup care nu se potrivește': cp((o) => { o.species[0].group = 'tree'; }),
      'sosie spre sine': cp((o) => { o.species[0].look_alike = [{id: o.species[0].id, note: {en: 'x'}}]; }),
      'sosie necunoscută': cp((o) => { o.species[0].look_alike = [{id: 'nu-exista', note: {en: 'x'}}]; }),
      'sosie fără reciprocitate': cp((o) => { o.species[0].look_alike = [{id: o.species[1].id, note: {en: 'x'}}]; }),
      'specie dublă': cp((o) => { o.species[1] = JSON.parse(JSON.stringify(o.species[0])); })
    };
    for (const name of Object.keys(cases)) {
      const pk = cases[name];
      ok(VE.validatePack(pk).length > 0, name + ': motorul ar trebui să respingă');
      await vImp(p, JSON.stringify(pk));
      eq(await vHead(p), I.i_err_pack, name);
      eq((await vShownLines(p)).join('\n'), vLinesOf(pk).join('\n'), name + ': rândurile problemelor');
      eq(await vActive(p), 'vp-imp-rep', name);
    }
    // mai mult de 20 de probleme: primele 20, apoi «…și încă N»
    const many = mkPk('xx-many', 30, null, () => ({kingdom: 'mineral'}));
    const total = VE.validatePack(many).length;
    ok(total > 21, 'trebuie multe probleme: ' + total);
    await vImp(p, JSON.stringify(many));
    const ml = await vShownLines(p);
    eq(ml.length, 21);
    eq(ml[20], F(I.i_more, total - 20));
    eq(ml.slice(0, 20).join('\n'), vLinesOf(many).slice(0, 20).join('\n'));
    // mesajele urmează limba, iar raportul rămâne la schimbarea ei
    for (const l of ['ro', 'hu', 'de']) {
      await vLang(p, l);
      eq(await vHead(p), VI[l].i_err_pack, l);
      eq((await vShownLines(p)).join('\n'), vLinesOf(many, l).join('\n'), l + ': rândurile');
    }
    await vLang(p, 'en');
    await cards();
    eq(await vStore(p, K.packs), null, 'după importuri respinse nu s-a scris nimic');
    ok(await vPoll(p));
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': importuri ostile (chei __proto__, imagini care nu sunt imagini, adrese javascript:, sunete de pe alte site-uri, caractere de control) sunt respinse cu locul greșelii', async () => {
    const h = await vOpen({time: T0});
    const p = h.page, I = VI.en;
    await vTab(p, 'packs');
    const base = mkPk('xx-evil', 2);
    const clone = (f) => { const o = JSON.parse(JSON.stringify(base)); f(o); return o; };
    const proto = JSON.stringify(base).replace('{', '{"__proto__":{"polluted":1},');
    const texts = {
      'cheie __proto__': proto,
      'cheie constructor în nume': JSON.stringify(clone((o) => { o.species[0].names = {en: 'x', constructor: 'y'}; })),
      'fotografie «text/html»': JSON.stringify(clone((o) => { o.species[0].photos = [PHOTO({data: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='})]; })),
      'fotografie din rețea': JSON.stringify(clone((o) => { o.species[0].photos = [PHOTO({data: 'https://example.com/a.png'})]; })),
      'legătură javascript:': JSON.stringify(clone((o) => { o.species[0].photos = [PHOTO({source_url: 'javascript:alert(1)'})]; })),
      'legătură http (nu https)': JSON.stringify(clone((o) => { o.species[0].photos = [PHOTO({source_url: 'http://commons.wikimedia.org/x'})]; })),
      'licență inventată': JSON.stringify(clone((o) => { o.species[0].photos = [PHOTO({licence: 'Free-For-All'})]; })),
      'sunet de pe alt site': JSON.stringify(clone((o) => { o.species[0].audio = [AUDIO({url: 'https://evil.example/123456'})]; })),
      'sunet cu adresă care imită xeno-canto': JSON.stringify(clone((o) => { o.species[0].audio = [AUDIO({url: 'https://xeno-canto.org.evil.example/1'})]; })),
      'caracter de control în nume': JSON.stringify(clone((o) => { o.species[0].names = {en: 'a' + String.fromCharCode(7) + 'b'}; })),
      'inversare de text (bidi) în notă': JSON.stringify(clone((o) => { o.species[0].notes = {en: 'a' + String.fromCharCode(0x202e) + 'b'}; })),
      'spații la margini': JSON.stringify(clone((o) => { o.species[0].names = {en: ' padded '}; })),
      'cod de limbă greșit': JSON.stringify(clone((o) => { o.species[0].names = {'EN-us': 'x'}; })),
      'nume prea lung': JSON.stringify(clone((o) => { o.species[0].names = {en: 'x'.repeat(500)}; }))
    };
    for (const name of Object.keys(texts)) {
      const pk = JSON.parse(texts[name]);
      const want = vLinesOf(pk);
      ok(want.length > 0, name + ': motorul trebuie să respingă');
      await vImp(p, texts[name]);
      eq(await vHead(p), I.i_err_pack, name);
      eq((await vShownLines(p)).join('\n'), want.join('\n'), name);
      ok(await vPoll(p), name + ': poluare de prototip');
    }
    eq((await vCards(p)).join(), BUILT.join());
    eq(await vStore(p, K.packs), null);
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': limitele importului: text prea mare, fișier prea mare (se curăță câmpul), 12 pachete, cota de stocare, id-ul unui pachet inclus', async () => {
    const seeded = Array.from({length: 12}, (_, i) => mkPk('xx-p' + String(i + 1).padStart(2, '0'), 1));
    const h = await vOpen({time: T0, quota: true, store: {[K.packs]: JSON.stringify(seeded)}});
    const p = h.page, I = VI.en;
    await vTab(p, 'packs');
    eq((await vCards(p)).join(), BUILT.concat(seeded.map((x) => x.id)).join(), 'cele 12 pachete salvate se încarcă');
    // al 13-lea nu încape, dar unul existent se poate înlocui
    await vImp(p, JSON.stringify(mkPk('xx-p13', 1)));
    eq(await vHead(p), F(I.i_err_full, 12));
    eq((await vCards(p)).length, BUILT.length + 12);
    await vImp(p, JSON.stringify(mkPk('xx-p05', 4, {title: {en: 'Fifth'}})));
    await p.waitForFunction(() => /Fifth/.test(document.getElementById('vp-live').textContent));
    eq(await vLive(p), F(I.i_replaced, 'Fifth', 4));
    eq((await vCards(p)).length, BUILT.length + 12);
    // un pachet inclus nu poate fi suprascris
    const builtin = mkPk('ro-mammals', 1, {title: {en: 'Impostor'}});
    await vImp(p, JSON.stringify(builtin));
    eq(await vHead(p), I.i_err_builtin);
    eq(await vText(p, '#vp-pk-t-ro-mammals'), nameOf(DIST['ro-mammals'].title, 'en'), 'pachetul inclus rămâne neschimbat');
    // text prea mare
    await p.evaluate(() => { const t = document.getElementById('vp-imp-ta'); t.value = 'x'.repeat(6000001); t.dispatchEvent(new Event('input')); });
    await p.click('#vp-imp-go');
    eq(await vHead(p), I.i_err_big, 'text prea mare');
    await p.fill('#vp-imp-ta', '');
    // fișier prea mare: mesaj, iar fișierul nu rămâne ales (ca să nu umbrească textul lipit după aceea)
    await p.setInputFiles('#vp-imp-file', {name: 'big.json', mimeType: 'application/json', buffer: Buffer.alloc(8000001, 32)});
    await p.click('#vp-imp-go');
    await p.waitForFunction((m) => document.getElementById('vp-live').textContent === m, I.i_err_big);
    eq(await p.$eval('#vp-imp-file', (e) => e.files.length), 0, 'câmpul de fișier s-a golit și după eroare');
    await vImp(p, JSON.stringify(mkPk('xx-p05', 2, {title: {en: 'Fifth again'}})));
    await p.waitForFunction(() => /Fifth again/.test(document.getElementById('vp-live').textContent));
    // fișier care nu e JSON
    await p.setInputFiles('#vp-imp-file', {name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('nu e json')});
    await p.click('#vp-imp-go');
    await p.waitForSelector('#vp-imp-rep p.vp-bad');
    eq(await vHead(p), I.i_err_json);
    // spațiul de stocare plin: pachetul nu se adaugă, ce era salvat rămâne
    const stored = await p.evaluate((k) => localStorage.getItem(k), K.packs);
    await p.evaluate(() => { window.__quota = true; });
    await vImp(p, JSON.stringify(mkPk('xx-p06', 3, {title: {en: 'Sixth'}})));
    eq(await vHead(p), I.e_quota);
    eq(await p.evaluate((k) => localStorage.getItem(k), K.packs), stored, 'stocarea nu s-a schimbat');
    eq(await p.$eval('#vp-pk-t-xx-p06', (e) => e.textContent), 'Pack xx-p06', 'pachetul vechi cu acest id a rămas');
    await p.evaluate(() => { window.__quota = false; });
    await vImp(p, JSON.stringify(mkPk('xx-p06', 3, {title: {en: 'Sixth'}})));
    await p.waitForFunction(() => /Sixth/.test(document.getElementById('vp-live').textContent));
    eq(await vText(p, '#vp-pk-t-xx-p06'), 'Sixth');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': stare salvată cu pachete stricate, duplicate, cu id-uri incluse sau prea multe: se păstrează doar ce e valid', async () => {
    const ok1 = mkPk('xx-ok', 2), dup = mkPk('xx-ok', 4, {title: {en: 'Duplicate'}}), shadow = mkPk('ro-birds', 1, {title: {en: 'Shadow'}});
    const evil = JSON.parse(JSON.stringify(mkPk('xx-evil', 1))); evil.species[0].photos = [PHOTO({data: 'data:text/html;base64,AAAA'})];
    const raw = '[' + [JSON.stringify(ok1), '{"a":1}', 'null', '5', '"x"', JSON.stringify(shadow), JSON.stringify(dup), JSON.stringify(evil)].join(',') + ']';
    let h = await vOpen({time: T0, store: {[K.packs]: raw}});
    let p = h.page;
    await vTab(p, 'packs');
    eq((await vCards(p)).join(), BUILT.concat(['xx-ok']).join());
    eq(await vText(p, '#vp-pk-t-xx-ok'), 'Pack xx-ok', 'primul pachet cu un id câștigă');
    eq(await p.$eval('section[aria-labelledby="vp-pk-h-ro-birds"] .vp-meta', (e) => e.textContent), F(VI.en.p_stats, 17, 0, 0, 0), 'cel inclus rămâne cel inclus');
    noErr(h);
    await h.ctx.close();
    // peste 12 pachete: se păstrează primele 12
    const many = Array.from({length: 15}, (_, i) => mkPk('xx-m' + String(i + 1).padStart(2, '0'), 1));
    h = await vOpen({time: T0, store: {[K.packs]: JSON.stringify(many)}});
    p = h.page;
    await vTab(p, 'packs');
    eq((await vCards(p)).join(), BUILT.concat(many.slice(0, 12).map((x) => x.id)).join());
    noErr(h);
    await h.ctx.close();
    // o valoare uriașă (peste limita de stocare) e ignorată
    h = await vOpen({time: T0, store: {[K.packs]: '[' + ' '.repeat(4000001) + ']'}});
    p = h.page;
    await vTab(p, 'packs');
    eq((await vCards(p)).join(), BUILT.join());
    noErr(h);
    await h.ctx.close();
  });

  /* ---- Create: ajutoare ---- */
  const BLANK = (lang) => ({latin: '', kingdom: 'animalia', group: 'mammal', name_en: '', name_ro: '', name_hu: '', name_de: '', x_lang: '', x_name: '', toxic: '', note_lang: lang, toxic_note: '', notes: '', source: ''});
  const FIELD_OF = {latin: 'latin', name_en: 'name_en', name_ro: 'name_ro', name_hu: 'name_hu', name_de: 'name_de', x_lang: 'xlang', x_name: 'xname', toxic_note: 'tnote', notes: 'notes', source: 'source'};
  async function cFill(p, f) {
    const sel = async (id, v) => { if ((await p.inputValue(id)) !== v) await p.selectOption(id, v); };
    await sel('#vp-f-kingdom', f.kingdom); await sel('#vp-f-group', f.group); await sel('#vp-f-toxic', f.toxic);
    for (const k of Object.keys(FIELD_OF)) await p.fill('#vp-f-' + FIELD_OF[k], f[k]);
  }
  const cLinesOf = (f, l = 'en') => VE.speciesFromForm(f, null).problems.slice(0, 20).map((x) => VI[l]['v_' + x.code] + (x.path ? ' (' + x.path + ')' : ''));
  const cErr = (p) => p.$$eval('#vp-f-err li', (e) => e.map((x) => x.textContent));
  const cIds = (p) => p.$$eval('.vp-dl-row button[id^="vp-d-edit-"]', (e) => e.map((x) => x.id.slice(10)));
  const cDraft = (p) => vStore(p, K.draft);
  const cCheck = (p) => p.$eval('#vp-chk', (e) => e.innerText.trim());
  const cDisabled = (p, id) => p.$eval(id, (e) => e.getAttribute('aria-disabled'));
  const noDownload = (p) => p.waitForEvent('download', {timeout: 300}).then(() => 'a apărut o descărcare', () => 'none');
  const cMeta = async (p, o) => {
    for (const k of ['id', 'title_en', 'title_loc', 'loc_lang', 'region', 'version', 'authors']) if (o[k] !== undefined) await vFill(p, '#vp-m-' + k, o[k]);
    for (const k of ['licence', 'status']) if (o[k] !== undefined && (await p.inputValue('#vp-m-' + k)) !== o[k]) await p.selectOption('#vp-m-' + k, o[k]);
  };
  const LYNX = {latin: 'Lynx lynx', name_en: 'Eurasian lynx', name_ro: 'Râs', name_hu: 'Hiúz', x_lang: 'fr', x_name: 'Lynx boréal', kingdom: 'animalia', group: 'mammal'};
  const FELIS = {latin: 'Felis silvestris', name_en: 'Wildcat', name_ro: 'Pisică sălbatică', kingdom: 'animalia', group: 'mammal'};
  const SAFFRON = {latin: 'Colchicum autumnale', name_en: 'Meadow saffron', name_ro: 'Brândușă de toamnă', kingdom: 'plantae', group: 'herb', toxic: 'yes', toxic_note: 'All parts are poisonous.', source: 'https://example.org/saffron'};
  const addSp = async (p, o) => { await cFill(p, Object.assign(BLANK('en'), o)); await p.click('#vp-f-add'); };

  await T(NAME + ': Create: starea de pornire (câmpuri, opțiuni, ciornă goală, verificarea cere o specie) și grupurile urmează regnul', async () => {
    const h = await vOpen({time: T0, lang: 'ro'});
    const p = h.page, I = VI.ro;
    await vTab(p, 'build');
    const val = (id) => p.inputValue('#vp-' + id);
    for (const k of ['m-id', 'm-title_en', 'm-title_loc', 'm-loc_lang', 'm-region', 'm-authors', 'f-latin', 'f-name_en', 'f-name_ro', 'f-name_hu', 'f-name_de', 'f-xlang', 'f-xname', 'f-tnote', 'f-notes', 'f-source']) eq(await val(k), '', k);
    eq(await val('m-version'), '0.1.0'); eq(await val('m-licence'), 'CC0-1.0'); eq(await val('m-status'), 'draft'); eq(await val('f-toxic'), ''); eq(await val('f-nlang'), 'ro', 'limba notelor: cea a paginii');
    eq((await p.$$eval('#vp-m-licence option', (e) => e.map((x) => x.value))).join(), VE.PACK_LICENCES.join());
    eq((await p.$$eval('#vp-m-status option', (e) => e.map((x) => x.value + '=' + x.textContent))).join(), 'skeleton=' + I.st_skeleton + ',draft=' + I.st_draft, 'nu există «reviewed»: un pachet făcut aici nu se poate declara recenzat');
    eq((await p.$$eval('#vp-f-kingdom option', (e) => e.map((x) => x.value + '=' + x.textContent))).join(), VE.KINGDOMS.map((k) => k + '=' + I['k_' + k]).join());
    for (const k of VE.KINGDOMS) {
      if ((await val('f-kingdom')) !== k) await p.selectOption('#vp-f-kingdom', k);
      eq((await p.$$eval('#vp-f-group option', (e) => e.map((x) => x.value + '=' + x.textContent))).join(), VE.GROUPS[k].map((g) => g + '=' + I['g_' + g]).join(), 'grupurile regnului ' + k);
      eq(await val('f-group'), VE.GROUPS[k][0]);
    }
    eq((await p.$$eval('#vp-f-toxic option', (e) => e.map((x) => x.value + '=' + x.textContent))).join(), ['=' + I.c_tox_unk, 'yes=' + I.c_tox_yes, 'no=' + I.c_tox_no].join());
    eq(await vText(p, '#vp-d-lh'), F(I.c_list_h, 0));
    eq(await vText(p, '.vp-dlist .vp-hint'), I.c_list_none);
    eq((await p.$$eval('.vp-look .vp-hint', (e) => e.map((x) => x.textContent))).join('|'), [I.c_look_help, I.c_look_need_two].join('|'));
    eq(await cCheck(p), I.c_empty);
    eq(await cDisabled(p, '#vp-dl-pack'), 'true'); eq(await cDisabled(p, '#vp-use'), 'true');
    const nd = noDownload(p);
    await p.click('#vp-dl-pack', {force: true});
    eq(await vLive(p), I.c_empty);
    eq(await nd, 'none', 'fără specii nu se descarcă nimic');
    await p.click('#vp-use', {force: true});
    eq(await vLive(p), I.c_empty);
    eq((await vCards(p)).length, 0, 'filele ascunse nu sunt desenate');
    eq(await p.$$eval('#vp-p-json, #vp-j-ta', (e) => e.length), 0, 'editorul JSON apare doar la modificarea unei specii');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': Create: adăugarea unei specii (formular curățat, ciornă salvată, id din numele latin) și erorile de formular, cu mesaje din validatorul comun', async () => {
    const h = await vOpen({time: T0});
    const p = h.page, I = VI.en;
    await vTab(p, 'build');
    // erori: fiecare caz se compară cu ce întoarce motorul pentru aceleași valori
    const cases = {
      'formular gol': {},
      'fără nume': {latin: 'Lynx lynx'},
      'nume latin dintr-un singur cuvânt': {latin: 'Lynx', name_en: 'Lynx'},
      'plantă fără câmpul toxic': {latin: 'Atropa belladonna', kingdom: 'plantae', group: 'herb', name_en: 'Deadly nightshade'},
      'plantă toxică fără notă': {latin: 'Atropa belladonna', kingdom: 'plantae', group: 'herb', name_en: 'Deadly nightshade', toxic: 'yes'},
      'notă de toxicitate la o plantă netoxică': {latin: 'Allium ursinum', kingdom: 'plantae', group: 'herb', name_en: 'Ramsons', toxic: 'no', toxic_note: 'x'},
      'ciupercă fără câmpul toxic': {latin: 'Boletus edulis', kingdom: 'fungi', group: 'fungus', name_en: 'Porcini'},
      'cod de limbă lipsă la alt nume': {latin: 'Lynx lynx', name_en: 'Lynx', x_name: 'Luchs'},
      'cod de limbă prost la alt nume': {latin: 'Lynx lynx', name_en: 'Lynx', x_lang: 'e1', x_name: 'Luchs'}
    };
    for (const name of Object.keys(cases)) {
      const f = Object.assign(BLANK('en'), cases[name]);
      ok(cLinesOf(f).length > 0, name + ': motorul trebuie să respingă');
      await cFill(p, f);
      await p.click('#vp-f-add');
      eq(await p.$eval('#vp-f-err p.vp-bad', (e) => e.textContent), I.c_form_err, name);
      eq((await cErr(p)).join('\n'), cLinesOf(f).join('\n'), name + ': rândurile');
      eq(await vActive(p), 'vp-f-err', name + ': focalizarea e pe raport');
      const dr = await cDraft(p);
      ok(!dr || dr.species.length === 0, name + ': ciorna a rămas goală');
    }
    eq((await cIds(p)).length, 0);
    // reușită: nume latin «curățat», id derivat, formularul se golește, ciorna se salvează
    await cFill(p, Object.assign(BLANK('en'), LYNX, {latin: '  lynx   LYNX '}));
    await p.click('#vp-f-add');
    eq(await vLive(p), F(I.c_added, 'Eurasian lynx'));
    eq(await vActive(p), 'vp-f-latin');
    eq(await p.inputValue('#vp-f-latin') + await p.inputValue('#vp-f-name_en') + await p.inputValue('#vp-f-xname'), '', 'formularul s-a golit');
    eq(await p.$$eval('#vp-f-err li, #vp-f-err p', (e) => e.length), 0, 'raportul de erori s-a golit');
    eq((await cIds(p)).join(), 'lynx-lynx');
    eq(await vText(p, '#vp-d-lh'), F(I.c_list_h, 1));
    eq(await vText(p, '.vp-dl-i'), 'Eurasian lynx Lynx lynx ' + I.g_mammal);
    const d = await cDraft(p);
    eq(d.species.length, 1);
    const sp = d.species[0];
    eq(sp.id, 'lynx-lynx'); eq(sp.latin, 'Lynx lynx'); eq(sp.kingdom, 'animalia'); eq(sp.group, 'mammal');
    eq(JSON.stringify(Object.keys(sp.names).sort()), '["en","fr","hu","ro"]');
    eq(sp.names.fr, 'Lynx boréal'); eq(sp.names.ro, 'Râs');
    ok(!('toxic' in sp) && !('toxic_note' in sp), 'la un animal, toxicitatea rămâne nespecificată');
    eq(JSON.stringify(sp), JSON.stringify(VE.speciesFromForm(Object.assign(BLANK('en'), LYNX), null).species), 'specia salvată e cea făcută de motor');
    // aceeași specie a doua oară
    await cFill(p, Object.assign(BLANK('en'), LYNX));
    await p.click('#vp-f-add');
    eq(await p.$eval('#vp-f-err p.vp-bad', (e) => e.textContent), I.c_exists);
    eq((await cIds(p)).length, 1);
    // plantă toxică, cu notă și sursă; lista se sortează după nume în limba paginii
    await cFill(p, Object.assign(BLANK('en'), SAFFRON));
    await p.click('#vp-f-add');
    eq(await vLive(p), F(I.c_added, 'Meadow saffron'));
    eq((await cIds(p)).join(), 'lynx-lynx,colchicum-autumnale', 'ordinea: Eurasian lynx, Meadow saffron');
    eq(await p.$$eval('.vp-dl-i .vp-badge-tox', (e) => e.map((x) => x.textContent)).then((a) => a.join()), I.d_tox_yes, 'insigna «Marked toxic» doar la planta toxică');
    const sp2 = (await cDraft(p)).species.find((s) => s.id === 'colchicum-autumnale');
    eq(sp2.toxic, true); eq(sp2.toxic_note.en, 'All parts are poisonous.'); eq(sp2.source, 'https://example.org/saffron');
    // limba notelor = limba paginii când se adaugă (aici engleză)
    eq(await p.inputValue('#vp-f-nlang'), 'en');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': Create: sosiile se leagă în ambele sensuri cu aceeași notă, se înlocuiesc, se desfac și dispar odată cu specia; mesaje pentru greșeli', async () => {
    const h = await vOpen({time: T0});
    const p = h.page, I = VI.en;
    await vTab(p, 'build');
    await addSp(p, LYNX); await addSp(p, FELIS); await addSp(p, SAFFRON);
    eq((await cIds(p)).length, 3);
    // ordinea din liste: după numele în engleză: Eurasian lynx, Meadow saffron, Wildcat
    eq((await p.$$eval('#vp-l-a option', (e) => e.map((x) => x.value))).join(), 'lynx-lynx,colchicum-autumnale,felis-silvestris');
    eq((await p.$$eval('#vp-l-a option', (e) => e.map((x) => x.textContent))).join('|'), 'Eurasian lynx (Lynx lynx)|Meadow saffron (Colchicum autumnale)|Wildcat (Felis silvestris)');
    eq(await p.inputValue('#vp-l-lang'), 'en');
    eq(await vText(p, '.vp-look .vp-hint'), I.c_look_help);
    eq(await vText(p, '#vp-l-ph'), I.c_look_pairs_h);
    eq(await vText(p, '.vp-look .vp-hint:last-child'), I.c_look_none);
    const pairs = () => p.$$eval('.vp-pair', (e) => e.map((x) => x.querySelector('.vp-pair-t').textContent + ' #' + x.querySelector('button').id + ' #' + x.querySelector('button').textContent));
    const looks = async () => { const d = await cDraft(p); const o = {}; d.species.forEach((s) => { o[s.id] = s.look_alike ? s.look_alike.map((l) => l.id + ':' + JSON.stringify(l.note)).join(';') : null; }); return o; };
    await p.selectOption('#vp-l-a', 'lynx-lynx'); await p.selectOption('#vp-l-b', 'felis-silvestris');
    // greșeli
    await p.click('#vp-l-add');
    eq(await vLive(p), I.c_look_need_note);
    await p.fill('#vp-l-note', 'Easy to confuse at a distance.');
    await p.selectOption('#vp-l-b', 'lynx-lynx');
    await p.click('#vp-l-add');
    eq(await vLive(p), I.c_look_self);
    await p.selectOption('#vp-l-b', 'felis-silvestris');
    await p.fill('#vp-l-lang', 'E1');
    await p.click('#vp-l-add');
    eq(await vLive(p), I.c_note_lang + ': ' + I.v_pattern);
    eq(await p.$$eval('.vp-pair', (e) => e.length), 0);
    // legătura: în ambele sensuri, aceeași notă; câmpul de notă se golește, focalizarea rămâne pe el
    await p.fill('#vp-l-lang', 'en');
    await p.click('#vp-l-add');
    eq(await vLive(p), F(I.c_look_done, 'Eurasian lynx', 'Wildcat'));
    eq(await vActive(p), 'vp-l-note');
    eq(await p.inputValue('#vp-l-note'), '');
    eq((await pairs()).join('\n'), 'Eurasian lynx ↔ Wildcat: Easy to confuse at a distance. #vp-l-un-lynx-lynx-felis-silvestris #' + F(I.c_look_unlink, 'Eurasian lynx', 'Wildcat'));
    const note1 = JSON.stringify({en: 'Easy to confuse at a distance.'});
    let lk = await looks();
    eq(lk['lynx-lynx'], 'felis-silvestris:' + note1); eq(lk['felis-silvestris'], 'lynx-lynx:' + note1); eq(lk['colchicum-autumnale'], null);
    // aceeași pereche a doua oară: înlocuiește nota, nu dublează
    await p.fill('#vp-l-note', 'Mind the size.');
    await p.click('#vp-l-add');
    eq((await pairs()).length, 1);
    lk = await looks();
    eq(lk['lynx-lynx'], 'felis-silvestris:' + JSON.stringify({en: 'Mind the size.'})); eq(lk['felis-silvestris'], 'lynx-lynx:' + JSON.stringify({en: 'Mind the size.'}));
    // o a doua pereche, cu o altă limbă a notei
    await p.selectOption('#vp-l-a', 'lynx-lynx'); await p.selectOption('#vp-l-b', 'colchicum-autumnale');
    await p.fill('#vp-l-lang', 'ro'); await p.fill('#vp-l-note', 'Nu se confundă, dar pagina cere nota.');
    await p.click('#vp-l-add');
    eq((await pairs()).length, 2);
    lk = await looks();
    eq(lk['lynx-lynx'], 'felis-silvestris:' + JSON.stringify({en: 'Mind the size.'}) + ';colchicum-autumnale:' + JSON.stringify({ro: 'Nu se confundă, dar pagina cere nota.'}));
    // desfacerea: se șterge de pe ambele părți; cheia dispare când lista rămâne goală
    await p.click('#vp-l-un-lynx-lynx-felis-silvestris');
    eq(await vActive(p), 'vp-l-ph');
    lk = await looks();
    eq(lk['felis-silvestris'], null); ok(!('look_alike' in (await cDraft(p)).species.find((s) => s.id === 'felis-silvestris')), 'cheia look_alike dispare');
    eq(lk['lynx-lynx'], 'colchicum-autumnale:' + JSON.stringify({ro: 'Nu se confundă, dar pagina cere nota.'}));
    eq((await pairs()).length, 1);
    // ștergerea unei specii (cu confirmare) o scoate și din relațiile celorlalte
    await p.click('#vp-d-rm-colchicum-autumnale');
    eq(await vText(p, '#vp-d-rm-colchicum-autumnale'), I.c_remove_sure);
    eq((await cIds(p)).length, 3, 'prima apăsare doar cere confirmarea');
    await p.click('#vp-d-rm-colchicum-autumnale');
    eq(await vLive(p), F(I.c_removed, 'Meadow saffron'));
    eq(await vActive(p), 'vp-d-lh');
    eq((await cIds(p)).sort().join(), 'felis-silvestris,lynx-lynx');
    lk = await looks();
    eq(lk['lynx-lynx'], null); eq((await pairs()).length, 0);
    eq(await vText(p, '.vp-look .vp-hint:last-child'), I.c_look_none);
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': Create: verificarea, descărcarea și «Add to my packs here»: pachetul făcut e valid și identic cu cel descărcat, problemele blochează butoanele, ciorna se păstrează și se golește după confirmare', async () => {
    let h = await vOpen({time: T0});
    let p = h.page;
    const I = VI.en;
    await vTab(p, 'build');
    await addSp(p, LYNX); await addSp(p, FELIS);
    const shown = async () => ({head: await p.$eval('#vp-chk p', (e) => e.className + ':' + e.textContent), lines: await p.$$eval('#vp-chk li', (e) => e.map((x) => x.textContent))});
    const wantProblems = async () => { const d = await cDraft(p); const pr = VE.draftToPack(d, '2026-11-17').problems; return {n: pr.length, lines: pr.slice(0, 20).map((x) => I['v_' + x.code] + (x.path ? ' (' + x.path + ')' : ''))}; };
    // fără metadate: problemele se arată cu locul lor, iar butoanele sunt blocate
    let w = await wantProblems(), s = await shown();
    ok(w.n > 0);
    eq(s.head, 'vp-bad:' + F(I.c_problems, w.n)); eq(s.lines.join('\n'), w.lines.join('\n'));
    eq(await cDisabled(p, '#vp-dl-pack'), 'true'); eq(await cDisabled(p, '#vp-use'), 'true');
    let nd = noDownload(p);
    await p.click('#vp-dl-pack', {force: true});
    eq(await vLive(p), I.c_need_fix); eq(await nd, 'none');
    await p.click('#vp-use', {force: true});
    eq(await vLive(p), I.c_need_fix);
    // verificarea se actualizează la fiecare câmp de metadate (la «change»)
    await cMeta(p, {id: 'Bad_ID'});
    w = await wantProblems(); s = await shown();
    eq(s.lines.join('\n'), w.lines.join('\n'));
    ok(s.lines.some((x) => x === I.v_pattern + ' (id)'), s.lines.join('|'));
    await cMeta(p, {id: 'xx-trail', title_en: 'Trail species', title_loc: 'Specii de potecă', loc_lang: 'ro', region: 'XX', version: '0.2.0', licence: 'CC-BY-4.0', status: 'skeleton', authors: 'Ana Pop, Ion Ene'});
    s = await shown();
    eq(s.head, 'vp-ok:' + F(I.c_ok, 2)); eq(s.lines.length, 0);
    eq(await cDisabled(p, '#vp-dl-pack'), null); eq(await cDisabled(p, '#vp-use'), null);
    // descărcarea: numele fișierului, conținutul exact, validat de motor
    const d = await vDl(p, '#vp-dl-pack');
    eq(d.name, 'vietar-pack-xx-trail.json');
    const draft = await cDraft(p);
    const want = {format: 'vietar-pack', format_version: 1, id: 'xx-trail', title: {en: 'Trail species', ro: 'Specii de potecă'}, region: 'XX', version: '0.2.0', updated: '2026-11-17', licence: 'CC-BY-4.0', status: 'skeleton', authors: ['Ana Pop', 'Ion Ene'], count: 2, species: draft.species.map(VE.orderSpecies)};
    eq(d.text, VE.packText(want));
    eq(JSON.stringify(VE.validatePack(JSON.parse(d.text))), '[]');
    // «Add to my packs here»: intră în Packs, identic cu fișierul; a doua oară îl înlocuiește
    await p.click('#vp-use');
    eq(await vLive(p), F(I.c_used, 'Trail species'));
    await p.click('#vp-use');
    await vTab(p, 'packs');
    eq((await vCards(p)).join(), BUILT.concat(['xx-trail']).join());
    eq(await vText(p, '#vp-pk-h-xx-trail .vp-badge'), I.p_imp);
    eq(JSON.stringify((await vStore(p, K.packs)).map((x) => JSON.stringify(x))), JSON.stringify([JSON.stringify(JSON.parse(d.text))]));
    eq((await cDraft(p)).species.length, 2, 'ciorna rămâne');
    // un id de pachet inclus: se poate descărca, dar nu se poate pune între pachetele de aici
    await vTab(p, 'build');
    await cMeta(p, {id: 'ro-mammals'});
    eq((await shown()).head, 'vp-ok:' + F(I.c_ok, 2));
    await p.click('#vp-use');
    eq(await vLive(p), I.i_err_builtin);
    eq((await vDl(p, '#vp-dl-pack')).name, 'vietar-pack-ro-mammals.json');
    await cMeta(p, {id: 'xx-trail'});
    // ciorna se păstrează la o vizită nouă (câmpurile și speciile)
    h = await vReopen(h);
    p = h.page;
    await vTab(p, 'build');
    for (const [k, v] of Object.entries({'m-id': 'xx-trail', 'm-title_en': 'Trail species', 'm-title_loc': 'Specii de potecă', 'm-loc_lang': 'ro', 'm-region': 'XX', 'm-version': '0.2.0', 'm-licence': 'CC-BY-4.0', 'm-status': 'skeleton', 'm-authors': 'Ana Pop, Ion Ene'})) eq(await p.inputValue('#vp-' + k), v, k);
    eq((await cIds(p)).join(), 'lynx-lynx,felis-silvestris');
    eq((await cIds(p)).length, 2);
    eq((await shown()).head, 'vp-ok:' + F(I.c_ok, 2));
    // golirea cere confirmare; schimbarea filei o anulează
    await p.click('#vp-clear');
    eq(await vText(p, '#vp-clear'), I.c_clear_sure);
    await vTab(p, 'guide'); await vTab(p, 'build');
    eq(await vText(p, '#vp-clear'), I.c_clear);
    await p.click('#vp-clear'); await p.click('#vp-clear');
    eq(await vLive(p), I.c_cleared);
    eq(await vActive(p), 'vp-m-id');
    eq((await cIds(p)).length, 0);
    eq(await p.inputValue('#vp-m-id'), ''); eq(await p.inputValue('#vp-m-version'), '0.1.0'); eq(await p.inputValue('#vp-m-licence'), 'CC0-1.0'); eq(await p.inputValue('#vp-m-status'), 'draft');
    eq(JSON.stringify((await cDraft(p)).species), '[]');
    eq((await vStore(p, K.packs)).length, 1, 'pachetele din Packs nu se ating');
    eq(await cCheck(p), I.c_empty);
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': Create: modificarea unei specii (formular și editor JSON): fotografiile, sunetele și sosiile se păstrează, id-ul nou se propagă, limbile notelor se schimbă fără pierderi', async () => {
    const h = await vOpen({time: T0});
    const p = h.page, I = VI.en;
    await vTab(p, 'build');
    await addSp(p, LYNX); await addSp(p, FELIS);
    await p.selectOption('#vp-l-a', 'lynx-lynx'); await p.selectOption('#vp-l-b', 'felis-silvestris');
    await p.fill('#vp-l-note', 'Mind the size.'); await p.click('#vp-l-add');
    const spOf = async (id) => (await cDraft(p)).species.find((s) => s.id === id);
    const formState = () => p.evaluate(() => ['latin', 'name_en', 'name_ro', 'name_hu', 'name_de', 'xlang', 'xname', 'tnote', 'notes', 'source', 'nlang'].map((k) => document.getElementById('vp-f-' + k).value).concat([document.getElementById('vp-f-kingdom').value, document.getElementById('vp-f-group').value, document.getElementById('vp-f-toxic').value]).join('|'));
    // se deschide la modificare: formularul se umple, apare editorul JSON cu specia întreagă
    await p.click('#vp-d-edit-lynx-lynx');
    eq(await vActive(p), 'vp-f-latin');
    eq(await formState(), 'Lynx lynx|Eurasian lynx|Râs|Hiúz||fr|Lynx boréal||||en|animalia|mammal|');
    eq(await vText(p, '#vp-f-add'), I.c_update); eq(await vText(p, '#vp-f-cancel'), I.c_cancel);
    eq(await p.inputValue('#vp-j-ta'), JSON.stringify(VE.orderSpecies(await spOf('lynx-lynx')), null, 2));
    // anulare: formularul revine la gol, editorul JSON dispare
    await p.click('#vp-f-cancel');
    eq(await vActive(p), 'vp-f-latin'); eq(await p.$$eval('#vp-j-ta', (e) => e.length), 0); eq(await vText(p, '#vp-f-add'), I.c_add);
    eq((await formState()).replace(/\|/g, ''), 'enanimaliamammal', 'formular gol');
    // editor JSON: erori
    await p.click('#vp-d-edit-lynx-lynx');
    const sp = JSON.parse(await p.inputValue('#vp-j-ta'));
    await p.fill('#vp-j-ta', '{'); await p.click('#vp-j-apply');
    eq(await p.$eval('#vp-j-err p.vp-bad', (e) => e.textContent), I.c_json_bad); eq(await vActive(p), 'vp-j-err');
    await p.fill('#vp-j-ta', '[]'); await p.click('#vp-j-apply');
    eq(await p.$eval('#vp-j-err p.vp-bad', (e) => e.textContent), I.c_json_err);
    eq((await p.$$eval('#vp-j-err li', (e) => e.map((x) => x.textContent))).join('|'), I.v_type);
    const badPhoto = Object.assign({}, sp, {photos: [PHOTO({data: 'data:text/html;base64,AAAA'})]});
    await p.fill('#vp-j-ta', JSON.stringify(badPhoto)); await p.click('#vp-j-apply');
    eq((await p.$$eval('#vp-j-err li', (e) => e.map((x) => x.textContent))).join('\n'), VE.validateSpecies(badPhoto).map((x) => I['v_' + x.code] + (x.path ? ' (' + x.path + ')' : '')).join('\n'));
    const clash = Object.assign({}, sp, {id: 'felis-silvestris', latin: 'Felis silvestris'}); delete clash.look_alike;
    await p.fill('#vp-j-ta', JSON.stringify(clash)); await p.click('#vp-j-apply');
    eq(await p.$eval('#vp-j-err p.vp-bad', (e) => e.textContent), I.c_exists);
    eq(JSON.stringify(await spOf('lynx-lynx')), JSON.stringify(VE.orderSpecies(sp)), 'nimic nu s-a schimbat după erori');
    // editor JSON: adaug o fotografie și un sunet
    const withMedia = Object.assign({}, sp, {photos: [PHOTO()], audio: [AUDIO({note: {en: 'A call'}})]});
    await p.fill('#vp-j-ta', JSON.stringify(withMedia, null, 2)); await p.click('#vp-j-apply');
    eq(await vLive(p), F(I.c_json_ok, 'Eurasian lynx'));
    eq(await vActive(p), 'vp-f-latin');
    let cur = await spOf('lynx-lynx');
    eq(cur.photos.length, 1); eq(cur.audio.length, 1); eq(cur.audio[0].note.en, 'A call'); eq(cur.look_alike[0].id, 'felis-silvestris');
    eq(await vText(p, '#vp-f-add'), I.c_update, 'rămâne în modul de modificare');
    eq(JSON.parse(await p.inputValue('#vp-j-ta')).photos.length, 1, 'editorul JSON arată specia nouă');
    // actualizare din formular: ce nu e în formular (fotografii, sunete, sosii) se păstrează
    await p.fill('#vp-f-name_de', 'Luchs');
    await p.click('#vp-f-add');
    eq(await vLive(p), F(I.c_updated, 'Eurasian lynx'));
    cur = await spOf('lynx-lynx');
    eq(cur.names.de, 'Luchs'); eq(cur.photos.length, 1); eq(cur.audio.length, 1); eq(cur.look_alike.length, 1);
    eq(await vText(p, '#vp-f-add'), I.c_add, 'formularul se închide după actualizare');
    // id nou din numele latin: referințele din celelalte specii se actualizează
    await p.click('#vp-d-edit-lynx-lynx');
    await p.fill('#vp-f-latin', 'Lynx canadensis'); await p.click('#vp-f-add');
    eq((await cIds(p)).sort().join(), 'felis-silvestris,lynx-canadensis');
    eq((await spOf('felis-silvestris')).look_alike[0].id, 'lynx-canadensis', 'sosia din cealaltă specie arată noul id');
    eq((await spOf('lynx-canadensis')).look_alike[0].id, 'felis-silvestris');
    eq((await p.$$eval('.vp-pair-t', (e) => e.map((x) => x.textContent))).join('|'), 'Eurasian lynx ↔ Wildcat: Mind the size.');
    // modificarea unei specii spre numele alteia
    await p.click('#vp-d-edit-felis-silvestris');
    await p.fill('#vp-f-latin', 'Lynx canadensis'); await p.click('#vp-f-add');
    eq(await p.$eval('#vp-f-err p.vp-bad', (e) => e.textContent), I.c_exists);
    eq((await cIds(p)).sort().join(), 'felis-silvestris,lynx-canadensis');
    await p.click('#vp-f-cancel');
    // limba notelor: textele din fiecare limbă se păstrează la schimbare
    await p.click('#vp-d-edit-felis-silvestris');
    await p.fill('#vp-f-notes', 'English note.');
    await vFill(p, '#vp-f-nlang', 'ro');
    eq(await p.inputValue('#vp-f-notes'), '', 'nu există note în română');
    await p.fill('#vp-f-notes', 'Notă românească.'); await p.fill('#vp-f-tnote', '');
    await vFill(p, '#vp-f-nlang', 'en');
    eq(await p.inputValue('#vp-f-notes'), 'English note.');
    await vFill(p, '#vp-f-nlang', 'ro');
    eq(await p.inputValue('#vp-f-notes'), 'Notă românească.');
    await vFill(p, '#vp-f-nlang', 'e');
    eq(await p.inputValue('#vp-f-nlang'), 'ro', 'cod greșit: câmpul revine');
    eq(await vLive(p), I.c_note_lang + ': ' + I.v_pattern);
    await p.click('#vp-f-add');
    cur = await spOf('felis-silvestris');
    eq(JSON.stringify(cur.notes), JSON.stringify({en: 'English note.', ro: 'Notă românească.'}));
    // ștergerea speciei aflate în modificare închide formularul
    await p.click('#vp-d-edit-felis-silvestris');
    await p.click('#vp-d-rm-felis-silvestris'); await p.click('#vp-d-rm-felis-silvestris');
    eq(await p.$$eval('#vp-j-ta', (e) => e.length), 0);
    eq((await formState()).replace(/\|/g, ''), 'enanimaliamammal');
    eq((await cIds(p)).join(), 'lynx-canadensis');
    ok(!('look_alike' in (await spOf('lynx-canadensis'))), 'sosia ștearsă dispare din cealaltă specie');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': Create: ciorna are cel mult 400 de specii (cele salvate în plus se ignoră), iar o specie are cel mult 8 sosii', async () => {
    const mk = (n) => Array.from({length: n}, (_, i) => mkSp(i));
    let h = await vOpen({time: T0, store: {[K.draft]: JSON.stringify({meta: {id: 'xx-big'}, species: mk(450)})}});
    let p = h.page;
    const I = VI.en;
    await vTab(p, 'build');
    eq(await vText(p, '#vp-d-lh'), F(I.c_list_h, 400));
    eq((await cIds(p)).length, 400);
    eq(await p.inputValue('#vp-m-id'), 'xx-big');
    await addSp(p, {latin: 'Zzz zzzz', name_en: 'One more'});
    eq(await p.$eval('#vp-f-err p.vp-bad', (e) => e.textContent), F(I.c_full, 400));
    eq((await cIds(p)).length, 400);
    // o specie existentă se poate modifica și când ciorna e plină
    await p.click('#vp-d-edit-zxaaa-testus');
    await p.fill('#vp-f-name_ro', 'Test românesc');
    await p.click('#vp-f-add');
    eq(await vLive(p), F(I.c_updated, 'Test aaa'));
    eq((await cDraft(p)).species.find((s) => s.id === 'zxaaa-testus').names.ro, 'Test românesc');
    noErr(h);
    await h.ctx.close();
    // 8 sosii: a noua legătură e refuzată, una la altă specie merge
    const species = mk(10).map((s, i) => {
      if (i === 0) return Object.assign(s, {look_alike: mk(9).slice(1, 9).map((o) => ({id: o.id, note: {en: 'n'}}))});
      if (i >= 1 && i <= 8) return Object.assign(s, {look_alike: [{id: mkSp(0).id, note: {en: 'n'}}]});
      return s;
    });
    h = await vOpen({time: T0, store: {[K.draft]: JSON.stringify({meta: {}, species})}});
    p = h.page;
    await vTab(p, 'build');
    eq(await p.$$eval('.vp-pair', (e) => e.length), 8);
    await p.selectOption('#vp-l-a', mkSp(0).id); await p.selectOption('#vp-l-b', mkSp(9).id);
    await p.fill('#vp-l-note', 'Ninth.'); await p.click('#vp-l-add');
    eq(await vLive(p), I.c_look_full);
    eq(await p.$$eval('.vp-pair', (e) => e.length), 8);
    await p.selectOption('#vp-l-a', mkSp(1).id); await p.selectOption('#vp-l-b', mkSp(9).id);
    await p.click('#vp-l-add');
    eq(await vLive(p), F(I.c_look_done, 'Test aab', 'Test aaj'));
    eq(await p.$$eval('.vp-pair', (e) => e.length), 9);
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': Create: ciorna salvată coruptă sau ostilă se curăță: câmpurile greșite revin la valorile implicite, speciile invalide sau duplicate se ignoră', async () => {
    const good = mkSp(0), dup = Object.assign(mkSp(0), {names: {en: 'Dup'}}), bad = Object.assign(mkSp(1), {kingdom: 'mineral'});
    const hostile = {meta: {id: 'x'.repeat(301), title_en: 5, region: {}, version: '9.9.9', licence: 'GPL-3.0', status: 'reviewed', authors: null, title_loc: 'Titlu', loc_lang: 'ro', polluted: 1}, species: [good, dup, bad, null, 7, 'x', [], mkSp(2)], extra: 1};
    const raw = JSON.stringify(hostile).replace('{"meta"', '{"__proto__":{"polluted":1},"meta"');
    let h = await vOpen({time: T0, store: {[K.draft]: raw}});
    let p = h.page;
    await vTab(p, 'build');
    const val = (id) => p.inputValue('#vp-' + id);
    eq(await val('m-id'), '', 'id prea lung: revine la gol'); eq(await val('m-title_en'), ''); eq(await val('m-region'), ''); eq(await val('m-authors'), '');
    eq(await val('m-version'), '9.9.9'); eq(await val('m-title_loc'), 'Titlu'); eq(await val('m-loc_lang'), 'ro');
    eq(await val('m-licence'), 'CC0-1.0', 'licență necunoscută: implicit'); eq(await val('m-status'), 'draft', '«reviewed» nu se poate păstra într-o ciornă');
    eq((await cIds(p)).sort().join(), 'zxaaa-testus,zxaac-testus');
    eq(await p.$eval('.vp-dl-i', (e) => e.textContent.includes('Test aaa')), true, 'rămâne prima specie cu id-ul, nu duplicatul');
    ok(await vPoll(p));
    noErr(h);
    await h.ctx.close();
    for (const v of ['not json', 'null', '[]', '5', '"x"', '{"species":"x"}', '{"meta":[],"species":{}}', '{"meta":{"id":5},"species":[]}', '{"meta":{},"species":[' + ' '.repeat(4000001) + ']}']) {
      h = await vOpen({time: T0, store: {[K.draft]: v}});
      p = h.page;
      await vTab(p, 'build');
      eq(await vText(p, '#vp-d-lh'), F(VI.en.c_list_h, 0), 'valoare «' + v.slice(0, 30) + '»');
      eq(await val('m-id'), ''); eq(await val('m-version'), '0.1.0');
      ok(await vPoll(p));
      noErr(h);
      await h.ctx.close();
    }
  });

  await T(NAME + ': Create: când browserul nu mai are loc, ciorna merge mai departe în pagină, iar avertismentul rămâne lângă mesajul acțiunii; «Add to my packs here» spune că nu s-a schimbat nimic', async () => {
    const h = await vOpen({time: T0, quota: true});
    const p = h.page, I = VI.en;
    await vTab(p, 'build');
    await p.evaluate(() => { window.__quota = true; });
    await addSp(p, LYNX);
    eq((await p.$$eval('#vp-live p', (e) => e.map((x) => x.textContent))).join('|'), F(I.c_added, 'Eurasian lynx') + '|' + I.e_draft_quota);
    eq((await cIds(p)).join(), 'lynx-lynx', 'specia e în ciorna din pagină');
    eq(await cDraft(p), null, 'dar nu s-a salvat');
    await cMeta(p, {id: 'xx-quota', title_en: 'Quota', region: 'XX'});
    eq(await vLive(p), I.e_draft_quota);
    eq((await cCheck(p)), F(I.c_ok, 1));
    await p.click('#vp-use');
    eq((await p.$$eval('#vp-live p', (e) => e.map((x) => x.textContent))).join('|'), I.e_quota + '|' + I.e_draft_quota, 'pachetul nu s-a adăugat; ciorna rămâne doar în pagină');
    await vTab(p, 'packs');
    eq((await vCards(p)).join(), BUILT.join());
    await vTab(p, 'build');
    eq(await vLive(p), '', 'schimbarea filei curăță mesajul');
    // descărcarea nu depinde de spațiul de stocare
    eq((await vDl(p, '#vp-dl-pack')).name, 'vietar-pack-xx-quota.json');
    // când spațiul revine, salvarea reușește, iar avertismentul nu mai apare
    await p.evaluate(() => { window.__quota = false; });
    await addSp(p, FELIS);
    eq(await vLive(p), F(I.c_added, 'Wildcat'));
    eq((await cDraft(p)).species.length, 2);
    // fiecare specie șterge mesajele, iar o ciornă care nu poate fi salvată nu strică pagina
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': Create: limba notelor urmează limba paginii până se scrie o notă; textul scris nu se pierde la schimbarea limbii', async () => {
    const h = await vOpen({time: T0});
    const p = h.page;
    await vTab(p, 'build');
    eq(await p.inputValue('#vp-f-nlang'), 'en');
    await vLang(p, 'ro');
    eq(await p.inputValue('#vp-f-nlang'), 'ro', 'formular necompletat: urmează limba paginii');
    await p.fill('#vp-f-latin', 'Lynx lynx'); await p.fill('#vp-f-notes', 'O notă.');
    await vLang(p, 'de');
    eq(await p.inputValue('#vp-f-nlang'), 'ro', 'cu o notă scrisă, limba notelor nu se schimbă singură');
    eq(await p.inputValue('#vp-f-latin'), 'Lynx lynx', 'ce s-a scris rămâne');
    eq(await p.inputValue('#vp-f-notes'), 'O notă.');
    // limba notei de sosie
    await p.fill('#vp-f-notes', ''); await vFill(p, '#vp-f-nlang', 'de');
    await p.fill('#vp-f-latin', '');
    await addSp(p, LYNX); await addSp(p, FELIS);
    eq(await p.inputValue('#vp-l-lang'), 'de');
    await vLang(p, 'fr');
    eq(await p.inputValue('#vp-l-lang'), 'fr', 'nota sosiei urmează limba paginii cât timp e goală');
    await p.fill('#vp-l-note', 'Ceva.');
    await vLang(p, 'it');
    eq(await p.inputValue('#vp-l-lang'), 'fr'); eq(await p.inputValue('#vp-l-note'), 'Ceva.');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': Guide: pașii și exemplul de fișier, în toate limbile; exemplul are exact câmpurile fotografiilor și sunetelor din schemă', async () => {
    const h = await vOpen({time: T0});
    const p = h.page;
    await vTab(p, 'guide');
    const schema = JSON.parse(fs.readFileSync(path.join(VDIR, 'schema.json'), 'utf8'));
    const props = (name) => schema.properties[name].items;
    for (const l of LANGS) {
      await vLang(p, l);
      const I = VI[l];
      eq(await vText(p, '#vp-p-guide h3'), I.gd_h, l);
      eq((await p.$$eval('.vp-steps li', (e) => e.map((x) => x.textContent))).join('|'), [1, 2, 3, 4, 5].map((i) => I['gd_' + i]).join('|'), l + ': pașii');
      eq(await vText(p, '#vp-ex-h'), I.gd_ex_h, l);
      eq(await vText(p, '#vp-p-guide .vp-hint'), I.gd_ex_note, l);
      eq(await p.$eval('pre.vp-code', (e) => [e.getAttribute('role'), e.tabIndex, e.getAttribute('aria-labelledby')].join('|')), 'region|0|vp-ex-h', l + ': regiune defilabilă cu tastatura');
    }
    const ex = JSON.parse(await p.$eval('pre.vp-code code', (e) => e.textContent));
    eq(Object.keys(ex).sort().join(), 'audio,photos');
    for (const k of ['photos', 'audio']) {
      const keys = Object.keys(ex[k][0]).sort(), allowed = Object.keys(props(k).properties), required = props(k).required;
      ok(required.every((r) => keys.includes(r)), k + ': exemplul nu are toate câmpurile obligatorii (' + required.join() + ')');
      ok(keys.every((x) => allowed.includes(x)), k + ': exemplul are câmpuri necunoscute: ' + keys.filter((x) => !allowed.includes(x)).join());
    }
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': texte: fiecare cheie e folosită, fiecare cod de problemă are mesaj în toate limbile, iar locurile {0}… se potrivesc cu engleza', async () => {
    const ui = fs.readFileSync(path.join(VDIR, 'src', 'ui.js'), 'utf8'), eng = fs.readFileSync(path.join(VDIR, 'src', 'engine.mjs'), 'utf8');
    const keys = Object.keys(VI.en);
    // codurile de problemă emise de motor (literal «code: 'x'»)
    const codes = Array.from(new Set(Array.from(eng.matchAll(/code: '([a-z_]+)'/g)).map((m) => m[1]).concat(VE.SHAPE_CODES))).sort();
    ok(codes.length >= 20, 'coduri găsite: ' + codes.join());
    for (const l of LANGS) {
      const I = VI[l];
      eq(Object.keys(I).sort().join(), keys.slice().sort().join(), l + ': aceleași chei ca în engleză');
      for (const c of codes) ok(typeof I['v_' + c] === 'string' && I['v_' + c].length > 3, l + ': lipsește mesajul v_' + c);
      for (const k of keys) {
        ok(typeof I[k] === 'string' && I[k].trim().length > 0, l + ': ' + k + ' e gol');
        const a = (VI.en[k].match(/\{\d\}/g) || []).sort().join(), b = (I[k].match(/\{\d\}/g) || []).sort().join();
        eq(b, a, l + ': locurile {n} din ' + k);
      }
    }
    for (const k of keys.filter((x) => /^v_/.test(x))) ok(codes.includes(k.slice(2)), 'mesaj fără cod: ' + k);
    // chei folosite: literale în ui.js sau construite din prefixe cu mulțimi cunoscute
    const lit = new Set(Array.from(ui.matchAll(/'([a-z]{1,4}_[a-z0-9_]+)'/g)).map((m) => m[1]));
    const built = new Set();
    VE.GROUP_ORDER.forEach((g) => built.add('g_' + g));
    VE.KINGDOMS.forEach((k) => built.add('k_' + k));
    VE.STATUSES.forEach((s) => { built.add('st_' + s); built.add('sn_' + s); });
    ['browse', 'packs', 'build', 'guide'].forEach((t) => built.add('tab_' + t));
    codes.forEach((c) => built.add('v_' + c));
    ['en', 'ro', 'hu', 'de', 'x', 'xn'].forEach((c) => built.add('c_name_' + c));
    [1, 2, 3, 4, 5].forEach((i) => built.add('gd_' + i));
    [1, 2, 3, 4, 5, 6].forEach((i) => built.add('lim_' + i));
    const SHELL = ['nav', 'title', 'open'];   // folosite de ambalaj (navigare, titlu, buton), nu de ui.js
    const unused = keys.filter((k) => !lit.has(k) && !built.has(k) && !SHELL.includes(k));
    eq(unused.join(), '', 'chei nefolosite');
    const missing = Array.from(lit).filter((k) => !k.endsWith('_') && !(k in VI.en) && /^(?:tab|tabs|s|b|k|g|d|p|st|sn|i|e|v|c|gd|h|lim|th)_/.test(k));
    eq(missing.join(), '', 'chei folosite, dar fără text');
  });

  await T(NAME + ': siguranță: «nemarcată toxică» nu e verde, niciodată fără avertisment, iar «marcată toxică» e roșie, în ambele teme, pentru fiecare specie din pachetul implicit', async () => {
    const rgb = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c); return m ? {r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4]} : null; };
    const green = (c) => { const x = rgb(c); return !!x && x.a > 0 && x.g > x.r + 15 && x.g > x.b + 15; };
    const red = (c) => { const x = rgb(c); return !!x && x.a > 0 && x.r > x.g + 40 && x.r > x.b + 40; };
    const pk = DIST[DEF];
    for (const scheme of ['light', 'dark']) {
      const h = await vOpen({time: T0, scheme});
      const p = h.page, I = VI.en;
      const colours = (sel) => p.$eval(sel, (e) => { const c = getComputedStyle(e); return {bg: c.backgroundColor, fg: c.color, bd: c.borderTopColor, bs: c.borderTopStyle}; });
      for (const sp of pk.species) {
        // în listă
        const badge = await p.$eval('#vp-sp-' + sp.id + ' .vp-badge', (e) => e.textContent);
        eq(badge, sp.toxic ? I.d_tox_yes : I.d_tox_no, sp.id + ': insigna din listă');
        const lc = await colours('#vp-sp-' + sp.id + ' .vp-badge');
        ok(!green(lc.bg) && !green(lc.fg) && !green(lc.bd), scheme + ' ' + sp.id + ': insigna din listă are culoare verde ' + JSON.stringify(lc));
        if (sp.toxic) ok(red(lc.bg) || red(lc.bd) || red(lc.fg), scheme + ' ' + sp.id + ': insigna «toxic» nu e roșie ' + JSON.stringify(lc));
        // în fișă
        await vPick(p, sp.id);
        const box = await colours('.vp-tox'), head = await colours('.vp-tox .vp-tox-h');
        ok(!green(box.bg) && !green(box.bd) && !green(head.fg) && !green(head.bg), scheme + ' ' + sp.id + ': blocul de toxicitate are verde ' + JSON.stringify([box, head]));
        if (sp.toxic) ok(red(box.bd) || red(head.fg) || red(head.bg), scheme + ' ' + sp.id + ': blocul «toxic» nu e roșu ' + JSON.stringify([box, head]));
        else {
          eq(await vText(p, '.vp-tox .vp-hint'), I.d_tox_warn, sp.id + ': avertisment lângă «nemarcată toxică»');
          ok(await p.isVisible('.vp-tox .vp-hint'), sp.id + ': avertismentul nu se vede');
        }
        await p.click('#vp-back');
      }
      noErr(h);
      await h.ctx.close();
    }
  });

  /** Aduce pagina, pe rând, în stările cu cele mai multe elemente și mesaje (fișe, import cu erori, pachet importat, creator cu erori, editor JSON, ghid); după fiecare cheamă check(eticheta). */
  async function vWalk(p, check, long) {
    const wide = (n, c) => String(c).repeat(n);
    const media = mkPk('xx-walk', 3, long ? {title: {en: wide(70, 'T')}, description: {en: wide(290, 'd')}, authors: [wide(75, 'Z')]} : null, (i) => i === 0
      ? {names: {en: long ? wide(75, 'N') : 'Walker'}, notes: {en: long ? wide(590, 'n') : 'A note.', ro: 'O notă.'}, source: long ? 'https://example.org/' + wide(170, 'a') : 'https://example.org/walker',
        photos: [PHOTO(long ? {author: wide(100, 'A')} : {})], audio: [AUDIO(long ? {recordist: wide(100, 'R'), note: {en: wide(190, 'x')}} : {note: {en: 'A call', ro: 'Un strigăt'}})], look_alike: [{id: mkSp(1).id, note: {en: long ? wide(190, 'k') : 'Alike.'}}]}
      : i === 1 ? {look_alike: [{id: mkSp(0).id, note: {en: long ? wide(190, 'k') : 'Alike.'}}]} : null);
    eq(JSON.stringify(VE.validatePack(media)), '[]', 'pachetul de probă e valid');
    await vPick(p, 'allium-ursinum'); await check('fișă: plantă «nemarcată toxică», cu sosii');
    await p.click('#vp-look-colchicum-autumnale'); await p.waitForSelector('#vp-detail'); await check('fișă: plantă toxică, cu notă');
    await p.click('#vp-back');
    await vTab(p, 'packs'); await check('Packs: pachetele incluse');
    await vImp(p, JSON.stringify(mkPk('xx-many', 30, null, () => ({kingdom: 'mineral'})))); await check('Packs: import cu multe probleme');
    await vImp(p, '{'); await check('Packs: JSON invalid');
    await vImp(p, JSON.stringify(media)); await p.waitForSelector('#vp-pk-h-xx-walk'); await check('Packs: pachet importat');
    await p.click('#vp-pk-open-xx-walk');
    await vPick(p, mkSp(0).id);
    await p.evaluate(() => { Array.from(document.images).forEach((i) => i.scrollIntoView()); });   // imaginile sunt «lazy»: se încarcă la derulare
    await p.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
    await check('fișă: fotografie, sunet, sosie, notă');
    await p.click('#vp-back');
    await vTab(p, 'build'); await check('Create: gol');
    await p.click('#vp-f-add'); await check('Create: erori de formular');
    await addSp(p, LYNX); await addSp(p, SAFFRON);
    if (long) await addSp(p, {latin: 'Longus namus', name_en: wide(75, 'N'), kingdom: 'animalia', group: 'other'});
    await p.selectOption('#vp-l-a', 'lynx-lynx'); await p.selectOption('#vp-l-b', 'colchicum-autumnale');
    await p.fill('#vp-l-note', long ? wide(190, 'k') : 'Alike.'); await p.click('#vp-l-add');
    await vFill(p, '#vp-m-id', 'xx-walker');
    await check('Create: ciornă cu sosii, verificare cu probleme');
    await p.click('#vp-d-edit-lynx-lynx');
    await p.fill('#vp-j-ta', '{'); await p.click('#vp-j-apply');
    await check('Create: editor JSON cu eroare');
    await p.click('#vp-f-cancel');
    await vTab(p, 'guide'); await check('Guide');
  }
  const SCAN = async (p, label, l) => {
    const t = await p.evaluate(() => ({text: document.querySelector('#appmount').innerText, lang: document.documentElement.lang}));
    eq(t.lang, l, label);
    const raw = t.text.match(RAW_KEY) || t.text.match(RAW), bad = t.text.match(BAD_TEXT);
    ok(!raw, l + ' · ' + label + ': cheie netradusă «' + (raw && raw[0]) + '»');
    ok(!bad, l + ' · ' + label + ': text invalid «' + (bad && bad[0]) + '»');
  };

  await T(NAME + ': accesibilitate (axe) în toate stările cu mesaje și date (fișe, import cu erori, creator, editor JSON, ghid), în ambele teme și în patru limbi', async () => {
    for (const [scheme, l] of [['light', 'en'], ['dark', 'ro'], ['light', 'de'], ['dark', 'hu']]) {
      const h = await vOpen({time: T0, scheme, lang: l});
      await vWalk(h.page, async (label) => {
        await settle(h.page);
        const v = await axe(h.page, '#appmount');   // restul paginii (ambalajul) are propria verificare, în testele de bază
        ok(v.length === 0, scheme + '/' + l + ' · ' + label + ': ' + JSON.stringify(v));
      });
      noErr(h);
      await h.ctx.close();
    }
  });

  await T(NAME + ': toate limbile: stările cu mesaje nu arată chei netraduse, NaN sau «undefined»', async () => {
    for (const l of LANGS) {
      const h = await vOpen({time: T0, lang: l});
      await vWalk(h.page, (label) => SCAN(h.page, label, l));
      noErr(h);
      await h.ctx.close();
    }
  });

  await T(NAME + ': pe mobil (360 px), cu texte foarte lungi și fără spații, nicio stare nu are defilare orizontală', async () => {
    for (const l of ['de', 'hu', 'ro']) {
      const h = await vOpen({time: T0, lang: l, w: 360, h: 740});
      const p = h.page;
      await vWalk(p, async (label) => {
        const w = await p.evaluate(() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth,
          over: Array.from(document.querySelectorAll('#appmount *')).filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('.vp-tblwrap, pre.vp-code')).slice(0, 3).map((e) => e.tagName + '.' + e.className + '#' + e.id)}));
        ok(w.sw <= w.iw + 1, l + ' · ' + label + ': scrollWidth ' + w.sw + ' > ' + w.iw + ' · ' + w.over.join(' '));
        ok(w.over.length === 0, l + ' · ' + label + ': elemente peste margine: ' + w.over.join(' '));
      }, true);
      noErr(h);
      await h.ctx.close();
    }
  });

  await browser.close();
} else {
  console.log('omis: vietar-packs (nu există ' + path.relative(HUB, appFile('vietar-packs')) + ')');
  skipped.add('vietar-packs');
}

/* ================= ATELIER DE VERIFICARE ================= */
if (present('atelier-verificare')) {
  const NAME = 'atelier-verificare';
  const ready = '#at-text';
  const KEY = NAME + '.case';
  const ADIR = path.join(ROOT, NAME);
  const AI = (await import(pathToFileURL(path.join(ADIR, 'src', 'i18n.mjs')).href)).default;
  const AE = await import(pathToFileURL(path.join(ADIR, 'src', 'engine.mjs')).href);
  const AF = await import(pathToFileURL(path.join(ADIR, 'test', '_fixtures.mjs')).href);
  const DESC = fs.readdirSync(path.join(ADIR, 'data', 'checks')).filter((f) => f.endsWith('.json') && f !== 'example.json').map((f) => JSON.parse(fs.readFileSync(path.join(ADIR, 'data', 'checks', f), 'utf8')));
  const DBYID = new Map(DESC.map((d) => [d.id, d]));
  const NET_HOSTS = [...new Set(DESC.flatMap((d) => d.network || []))].sort();
  const ORDER = ['file-structure', 'exif-inspector', 'embedded-metadata', 'c2pa-reader', 'ela-jpeg', 'video-meta', 'video-keyframes', 'url-anatomy', 'text-hygiene', 'dns-summary', 'wayback-lookup'];
  eq(DESC.length, ORDER.length, 'descriptorii din depozit = verificările din ordinea paginii');
  const FMT = (s, ...a) => s.replace(/\{(\d+)\}/g, (m, i) => (a[Number(i)] === undefined ? m : String(a[Number(i)])));
  const sha = (u8) => AE.hex(AE.sha256(u8));
  browser = await launch();
  await baseline(NAME, {ready, stateKey: KEY, rawKey: /\b(?:f|c|st|lv|kind|skip|iptc|eth|b|r|h|net|send|art|err|real|run|arch|add|copy)_[a-z0-9_-]{2,}\b/});
  // ---------- fișiere sintetice: se generează la rulare, nu se comit binare ----------
  const EXIF_FULL = () => AF.tiff({
    thumb: AF.jpeg({w: 160, h: 120, jfif: false}),
    ifd0: [[0x010f, 'ascii', 'ACME'], [0x0110, 'ascii', 'ACME X100'], [0x0112, 'short', 6], [0x0131, 'ascii', 'Adobe Photoshop 25.0'], [0x0132, 'ascii', '2024:05:20 10:00:00'], [0x013b, 'ascii', 'Ion Popescu']],
    exif: [[0x9003, 'ascii', '2024:05:17 14:03:22'], [0x9011, 'ascii', '+03:00'], [0xa002, 'long', 640], [0xa003, 'long', 480], [0xa434, 'ascii', 'ACME 24-70'], [0xa431, 'ascii', 'SN-12345'], [0xa430, 'ascii', 'Ion'], [0x927c, 'undef', new Uint8Array(20).fill(1)]],
    gps: [[0x1, 'ascii', 'N'], [0x2, 'rational', [[44, 1], [25, 1], [3600, 100]]], [0x3, 'ascii', 'E'], [0x4, 'rational', [[26, 1], [6, 1], [900, 100]]], [0x7, 'rational', [[10, 1], [3, 1], [20, 1]]], [0x1d, 'ascii', '2024:05:17']]});
  const XMP_PS = AF.xmpPacket('<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="Adobe Photoshop 25.0"/>');
  // un JPEG decodabil, făcut de Chrome (ELA are nevoie de o imagine pe care browserul o poate decoda), cu segmentele de metadate lipite după JFIF
  const REAL_JPEG = await (async () => {
    const g = await newPage(browser);
    const b64 = await g.page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 96; c.height = 64;
      const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 96, 64);
      gr.addColorStop(0, '#d33'); gr.addColorStop(1, '#36c'); x.fillStyle = gr; x.fillRect(0, 0, 96, 64);
      x.fillStyle = '#fff'; x.fillRect(20, 14, 30, 20); x.fillStyle = '#000'; x.font = '14px sans-serif'; x.fillText('Aa', 60, 40);
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    });
    await g.ctx.close();
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  })();
  const jpegWith = (jpg, segs) => { const at = 4 + ((jpg[4] << 8) | jpg[5]); return AF.cat(jpg.subarray(0, at), ...segs, jpg.subarray(at)); };
  const FX = {
    photo: jpegWith(REAL_JPEG, [AF.seg(0xe1, AF.cat('Exif\0\0', EXIF_FULL())), AF.seg(0xe1, AF.cat('http://ns.adobe.com/xap/1.0/\0', XMP_PS))]),
    png: AF.png({text: [['parameters', 'a red fox in a forest\nNegative prompt: blurry\nSteps: 28, Sampler: Euler a, CFG scale: 7, Seed: 12345, Size: 512x512']]}),
    signed: AF.jpeg({jumbf: AF.app11(AF.c2paStore({manifests: [{generator: 'ACME Camera 1.0', title: 'IMG_0001.jpg', actions: [{action: 'c2pa.created'}],
      signer: {issuer: {C: 'US', O: 'Example Trust CA', CN: 'Example Issuing CA'}, subject: {C: 'RO', O: 'Agenția Demo', CN: 'Camera Demo'}, from: '240101000000Z', to: '20340101000000Z'}}]}))}),
    mp4: AF.mp4({created: Date.UTC(2024, 4, 17, 14, 3, 22), duration: 12.5, location: '+44.4268+026.1025/', encoder: 'Lavf58.76.100'}),
    txt: Uint8Array.from(Buffer.from('hello'))
  };
  const FILES = [['photo.jpg', 'image/jpeg', FX.photo], ['gen.png', 'image/png', FX.png], ['signed.jpg', 'image/jpeg', FX.signed], ['clip.mp4', 'video/mp4', FX.mp4], ['notes.txt', 'text/plain', FX.txt]];
  const upl = (list) => list.map(([name, mimeType, b]) => ({name, mimeType, buffer: Buffer.from(b)}));
  const LINK_BBC = 'https://www.bbc.com@secure-login.example/news?utm_source=newsletter&fbclid=abc123';
  const TEXT_BAD = 'Declarația ofi​cială: contul ‮‬va fi аctivat luni.';
  // ce verificări se aplică unui element, după descriptori (aceeași regulă ca în pagină: o intersecție între tipurile elementului și cele ale verificării)
  const checksFor = (kinds) => ORDER.filter((id) => [].concat(DBYID.get(id).input).some((k) => kinds.includes(k)));
  const KINDS = {photo: ['file', 'image'], png: ['file', 'image'], signed: ['file', 'image'], mp4: ['file', 'video'], txt: ['file'], link: ['url'], host: ['url', 'domain'], text: ['text']};

  // ---------- ajutoare ----------
  async function aOpen(o = {}) {
    const h = await newPage(browser, Object.assign({locale: 'en-GB', reduced: true}, o));
    await h.ctx.addInitScript(() => {
      window.__clip = []; window.__print = 0; window.__printed = ''; window.__fetches = [];
      try { const f0 = window.fetch; window.fetch = function (u, i) { window.__fetches.push({u: String(u), credentials: i && i.credentials, referrerPolicy: i && i.referrerPolicy, cache: i && i.cache, method: i && i.method, headers: i && i.headers ? Object.keys(i.headers) : []}); return f0.apply(this, arguments); }; } catch (e) { /* ignorat */ }
      try { Object.defineProperty(navigator, 'clipboard', {value: {writeText: (t) => { window.__clip.push(String(t)); return Promise.resolve(); }}, configurable: true}); } catch (e) { /* ignorat */ }
      window.print = function () { window.__print++; const r = document.getElementById('at-printroot'); window.__printed = r ? r.innerText : ''; window.__printedHtml = r ? r.innerHTML : ''; window.__printBody = document.body.className; if (!window.__keep) window.dispatchEvent(new Event('afterprint')); };
    });
    if (o.clock) await h.page.clock.install();
    if (o.store) await h.ctx.addInitScript((kv) => { try { Object.keys(kv).forEach((k) => localStorage.setItem(k, kv[k])); } catch (e) { /* ignorat */ } }, o.store);
    await h.page.goto('file://' + appFile(NAME));
    await h.page.waitForSelector(ready);
    h.lang = 'en';
    if (o.lang && o.lang !== 'en') await aLang(h, o.lang);
    return h;
  }
  async function aLang(h, l) {
    if ((await h.page.inputValue('#langsel')) !== l) await h.page.selectOption('#langsel', l);
    await h.page.waitForFunction((x) => document.documentElement.lang === x && !!document.querySelector('#at-text'), l);
    h.lang = l;
  }
  const aT = (h, k, ...a) => FMT(AI[h.lang][k], ...a);
  /** adaugă fișiere (prin câmpul de fișiere) și așteaptă ca fiecare să fie citit (tipuri recunoscute) și să aibă SHA-256 */
  async function aFiles(h, list, hashed = true) {
    const n0 = await h.page.$$eval('#at-items > article', (e) => e.length);
    await h.page.setInputFiles('#at-files', upl(list));
    await aReady(h, n0 + list.length, hashed);
  }
  async function aReady(h, n, hashed = true) {
    await h.page.waitForFunction((a) => { const items = [...document.querySelectorAll('#at-items > article')]; return items.length === a[0] && items.every((e) => e.querySelector('.at-checks') && (!a[1] || !e.querySelector('.at-hash') || e.querySelector('.at-hash code'))); }, [n, hashed], {timeout: 20000});
  }
  async function aText(h, text) {
    await h.page.fill('#at-text', text);
    await h.page.click('[data-act="addtext"]');
  }
  const aItems = (p) => p.$$eval('#at-items > article', (els) => els.map((e) => ({
    id: e.id, name: e.querySelector('h4').textContent, sub: e.querySelector('.at-sub').textContent, hash: (e.querySelector('.at-hash code') || {}).textContent || '', thumb: !!e.querySelector('img.at-thumb'),
    worst: (e.querySelector('.at-iact .at-badge') || {}).className || '',
    checks: [...e.querySelectorAll('.at-check')].map((c) => ({id: c.dataset.check, net: c.classList.contains('at-netcheck'), badge: c.querySelector('.at-chead .at-badge') ? c.querySelector('.at-chead .at-badge').className.replace(/^.*\blv-(\w+).*$/, '$1') : '',
      btnDisabled: c.querySelector('[data-act="run"]').disabled, err: (c.querySelector('.at-err') || {}).textContent || '', arts: c.querySelectorAll('canvas.at-art').length,
      lines: [...c.querySelectorAll('.at-findings li')].map((l) => ({lv: l.className.replace(/^lv-/, ''), text: l.textContent.replace(/^\S+\s+\S+\s/, '')}))}))})));
  const aStatus = async (h) => (await h.page.textContent('#at-status')).trim();
  async function aRun(h, sel = '[data-act="runall"]') {
    await h.page.click(sel);
    await h.page.waitForFunction((t) => document.querySelector('#at-status').textContent.trim() === t && !document.querySelector('#at-items .lv-run'), AI[h.lang].st_done, {timeout: 60000});
  }
  const aStore = (p) => p.evaluate(() => { const r = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); r[k] = localStorage.getItem(k); } return r; });
  const DNS_HOSTS = /^https:\/\/(cloudflare-dns\.com|dns\.google|archive\.org)\//;
  /** răspunsuri simulate pentru cele trei gazde; întoarce lista cererilor primite. mode: {dns: 'ok'|'500'|'big'|'junk', wb: 'ok'|'none'|'500'|'junk', gate: Promise (răspunsurile așteaptă până se rezolvă)} */
  async function aMock(h, mode = {}) {
    const calls = [];
    await h.ctx.route(DNS_HOSTS, async (r) => {
      const rq = r.request(), u = new URL(rq.url()), cors = {'access-control-allow-origin': '*'};
      calls.push({host: u.host, path: u.pathname, q: Object.fromEntries(u.searchParams), headers: rq.headers(), method: rq.method()});
      if (mode.gate) await mode.gate;
      if (u.host === 'archive.org') {
        const m = mode.wb || 'ok';
        if (m === '500') return r.fulfill({status: 500, headers: cors, contentType: 'text/plain', body: 'boom'});
        if (m === 'junk') return r.fulfill({status: 200, headers: cors, contentType: 'application/json', body: '{"archived_snapshots": '});
        const snap = m === 'none' ? {} : {closest: {available: true, status: '200', timestamp: '20240101120000', url: 'http://web.archive.org/web/20240101120000/http://example.com/'}};
        return r.fulfill({status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({archived_snapshots: snap})});
      }
      const m = mode.dns || 'ok';
      if (m === '500') return r.fulfill({status: 500, headers: cors, contentType: 'text/plain', body: 'boom'});
      if (m === 'junk') return r.fulfill({status: 200, headers: cors, contentType: 'application/dns-json', body: 'not json'});
      if (m === 'big') return r.fulfill({status: 200, headers: cors, contentType: 'application/dns-json', body: JSON.stringify({Status: 0, Answer: [{name: 'x', type: 16, TTL: 1, data: 'a'.repeat(1100000)}]})});
      const name = u.searchParams.get('name'), type = u.searchParams.get('type') || 'A';
      const ans = type === 'A' ? [{name, type: 1, TTL: 60, data: '93.184.216.34'}] : type === 'NS' ? [{name, type: 2, TTL: 60, data: 'a.iana-servers.net.'}] : [];
      return r.fulfill({status: 200, headers: cors, contentType: 'application/dns-json', body: JSON.stringify({Status: 0, AD: true, Answer: ans})});
    });
    return calls;
  }

  /* ---------- elemente: tipuri, verificări aplicabile, SHA-256 ---------- */
  await T(NAME + ': fișierele, linkurile și textul primesc verificările potrivite (după conținut, nu după nume), cu SHA-256 corect', async () => {
    const h = await aOpen();
    await aFiles(h, FILES);
    await aText(h, LINK_BBC); await aText(h, 'example.com'); await aText(h, TEXT_BAD);
    await aReady(h, 8);
    const items = await aItems(h.page);
    eq(items.length, 8);
    const want = [['photo', FX.photo, 'image'], ['png', FX.png, 'image'], ['signed', FX.signed, 'image'], ['mp4', FX.mp4, 'video'], ['txt', FX.txt, 'file'], ['link', null, 'url'], ['host', null, 'url'], ['text', null, 'text']];
    want.forEach(([k, bytes, kind], i) => {
      const it = items[i];
      eq(it.checks.map((c) => c.id).join(), checksFor(KINDS[k]).join(), it.name + ': verificările aplicabile');
      ok(it.sub.startsWith(AI.en['kind_' + kind]), it.name + ': tipul «' + it.sub + '»');
      if (bytes) { eq(it.hash, sha(bytes), it.name + ': SHA-256'); ok(it.sub.includes(FMT(AI.en.real_type, k === 'txt' ? 'x' : (k === 'png' ? 'PNG' : k === 'mp4' ? 'MP4' : 'JPEG'))) || k === 'txt', it.name + ': tipul real din conținut'); }
      else eq(it.hash, '', it.name + ': un link sau un text nu are SHA-256');
      eq(it.thumb, k === 'photo' || k === 'png' || k === 'signed', it.name + ': miniatura doar pentru imagini obișnuite');
      ok(it.checks.every((c) => c.net === !DBYID.get(c.id).offline), it.name + ': verificările cu rețea sunt marcate');
    });
    ok(!items[4].sub.includes(FMT(AI.en.real_type, 'UNKNOWN')), 'un tip necunoscut nu se afișează ca «tip real»');
    eq(items[1].checks.length, checksFor(KINDS.png).length);
    // verificările cu rețea nu pot fi pornite fără consimțământ: butoanele lor sunt dezactivate, cu explicație
    const netChecks = items.flatMap((it) => it.checks.filter((c) => c.net));
    eq(netChecks.length, 4, 'două verificări cu rețea pe fiecare dintre cele două elemente cu adresă');
    ok(netChecks.every((c) => c.btnDisabled), 'butoanele verificărilor cu rețea sunt dezactivate până la consimțământ');
    ok((await h.page.$$eval('.at-netnote', (e) => e.map((x) => x.textContent))).every((t) => t.includes(AI.en.net_need)), 'fiecare verificare cu rețea explică ce lipsește');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': text: o listă de linkuri devine elemente separate, textul amestecat rămâne unul, duplicatele și golurile nu adaugă nimic', async () => {
    const h = await aOpen();
    await aText(h, 'https://a.example/x\nhttps://b.example/y\nhttps://a.example/x');
    await aReady(h, 2);
    eq(await aStatus(h), aT(h, 'st_added', 2), 'anunț: două elemente noi (duplicatul se ignoră)');
    eq(await h.page.inputValue('#at-text'), '', 'câmpul se golește după adăugare');
    eq(await h.page.evaluate(() => document.activeElement.id), 'at-text', 'focusul se întoarce în câmpul de text');
    await aText(h, 'Vezi https://c.example/z și https://d.example/w, apoi scrie');
    await aReady(h, 3);
    let items = await aItems(h.page);
    eq(items[2].checks.map((c) => c.id).join(), checksFor(KINDS.text).join(), 'textul amestecat este un singur element de tip text');
    ok(items[2].sub.startsWith(AI.en.kind_text), 'tip: text');
    await h.page.click('[data-act="addlinks"]');                 // butonul „adaugă cele 2 linkuri găsite”
    await aReady(h, 5);
    eq(await aStatus(h), aT(h, 'st_added', 2));
    items = await aItems(h.page);
    eq(items.slice(3).map((x) => x.name).join(' '), 'https://c.example/z https://d.example/w', 'linkurile din text devin elemente (fără punctuația de la capăt)');
    await aText(h, 'https://c.example/z');
    eq(await aStatus(h), aT(h, 'st_nothing'), 'același link a doua oară nu se adaugă');
    await aText(h, '   \n  ');
    eq(await aStatus(h), aT(h, 'st_nothing'), 'textul gol nu se adaugă');
    eq((await aItems(h.page)).length, 5);
    await aText(h, 'poza.jpg');                                  // un nume de fișier nu este un domeniu
    await aReady(h, 6);
    ok((await aItems(h.page))[5].sub.startsWith(AI.en.kind_text), '«poza.jpg» este text, nu domeniu');
    for (const v of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'HTTP://EXAMPLE.COM:99999/%zz', 'ftp://user:pass@host.example/file']) { await aText(h, v); }
    await h.page.waitForTimeout(200);
    const hrefs = await h.page.$$eval('#at-items a', (a) => a.map((x) => x.getAttribute('href')));
    ok(hrefs.length > 0 && hrefs.every((x) => /^https:\/\/web\.archive\.org\//.test(x)), 'singurele linkuri din pagină duc la arhivă: ' + JSON.stringify(hrefs.filter((x) => !/^https:\/\/web\.archive\.org\//.test(x))));
    eq(await h.page.$$eval('#at-items script, #at-items [onerror], #at-items [onclick]', (e) => e.length), 0, 'nimic executabil în lista de elemente');
    noErr(h);
    await h.ctx.close();
  });

  /* ---------- rularea verificărilor offline ---------- */
  await T(NAME + ': „Rulează toate”: rezultate pe fiecare verificare offline, niveluri corecte, rezumat exact, fără rețea', async () => {
    const h = await aOpen();
    await aFiles(h, FILES);
    await aText(h, LINK_BBC); await aText(h, 'example.com'); await aText(h, TEXT_BAD);
    await aReady(h, 8);
    await aRun(h);
    const items = await aItems(h.page);
    const lines = (it, id) => it.checks.find((c) => c.id === id).lines;
    const has = (it, id, re, lv) => { const l = lines(it, id).filter((x) => re.test(x.text)); ok(l.length >= 1, it.name + ' · ' + id + ': lipsește ' + re + ' în ' + JSON.stringify(lines(it, id).map((x) => x.text))); if (lv) ok(l.some((x) => x.lv === lv), it.name + ' · ' + id + ': ' + re + ' trebuie să fie ' + lv + ', e ' + l.map((x) => x.lv)); };
    const [photo, png, signed, mp4, txt, link, host, text] = items;
    has(photo, 'file-structure', /JPEG/, 'info'); has(photo, 'file-structure', /96 × 64/);
    has(photo, 'exif-inspector', /ACME X100/, 'info'); has(photo, 'exif-inspector', /Photoshop/, 'warn'); has(photo, 'exif-inspector', /44\.426667, 26\.1025/, 'warn'); has(photo, 'exif-inspector', /SN-12345/, 'warn');
    has(photo, 'embedded-metadata', /Adobe Photoshop 25\.0/, 'warn');
    ok(photo.checks.find((c) => c.id === 'ela-jpeg').arts === 1, 'ELA: harta apare ca imagine');
    has(png, 'embedded-metadata', /Stable Diffusion/, 'warn'); eq(lines(png, 'ela-jpeg')[0].lv, 'skip'); has(png, 'ela-jpeg', /PNG/);
    has(signed, 'c2pa-reader', /ACME Camera 1\.0/, 'info'); has(signed, 'c2pa-reader', /Agenția Demo/); has(signed, 'c2pa-reader', /NOT validated/, 'warn');
    has(mp4, 'video-meta', /Duration: 12\.5 s/); has(mp4, 'video-meta', /\+44\.4268\+026\.1025/, 'warn'); has(mp4, 'video-meta', /Lavf58\.76\.100/, 'warn');
    eq(mp4.checks.find((c) => c.id === 'video-keyframes').arts, 0, 'un clip fără cadre decodabile nu produce imagini');
    ok(mp4.checks.find((c) => c.id === 'video-keyframes').lines.length === 1, 'dar explică de ce');
    has(txt, 'file-structure', /not recognised/, 'warn');
    has(link, 'url-anatomy', /www\.bbc\.com@/, 'fail'); has(link, 'url-anatomy', /utm_source, fbclid/);
    has(host, 'url-anatomy', /example\.com/, 'info');
    has(text, 'text-hygiene', /ZWSP/, 'warn'); has(text, 'text-hygiene', /RLO/, 'fail'); has(text, 'text-hygiene', /Cyrillic\+Latin/, 'warn');
    // rezumat și niveluri: calculate din ce arată pagina, nu din ce zice codul
    let ran = 0, warn = 0, fail = 0;
    for (const it of items) {
      const order = ['ok', 'info', 'warn', 'fail'];
      let worst = '';
      for (const c of it.checks) {
        if (c.net) { eq(c.badge, '', it.name + ' · ' + c.id + ': o verificare cu rețea nu rulează fără consimțământ'); continue; }
        ok(c.badge !== '' && c.badge !== 'run', it.name + ' · ' + c.id + ': fără rezultat');
        ran++; if (c.badge === 'warn') warn++; if (c.badge === 'fail') fail++;
        if (order.indexOf(c.badge) > order.indexOf(worst)) worst = c.badge;
        ok(!c.err || c.badge === 'error', it.name + ' · ' + c.id + ': eroare neașteptată: ' + c.err);
      }
      if (worst) ok(it.worst.includes('lv-' + worst), it.name + ': nivelul elementului = cel mai grav rezultat (' + worst + ' vs ' + it.worst + ')');
    }
    eq(ran, 23); ok(warn >= 5 && fail >= 2, 'warn=' + warn + ' fail=' + fail);
    eq((await h.page.textContent('#at-summary')).trim(), aT(h, 'summary', 8, ran, warn, fail), 'rezumatul numără rezultatele din pagină');
    eq((await h.page.$$eval('#at-items .at-err', (e) => e.length)), 0, 'nicio eroare de verificare');
    ok(await h.page.isDisabled('[data-act="runall-net"]'), '„Rulează verificările cu rețea” rămâne dezactivat fără consimțământ');
    noErr(h);                                                    // nici o eroare de pagină și nici o cerere de rețea (nici măcar încercată)
    await h.ctx.close();
  });

  /* ---------- rețea: consimțământ, gazde declarate, date minime ---------- */
  const aCounts = (items) => { let ran = 0, warn = 0, fail = 0; for (const it of items) for (const c of it.checks) { if (!c.badge || c.badge === 'run') continue; ran++; if (c.badge === 'warn') warn++; if (c.badge === 'fail') fail++; } return {n: items.length, ran, warn, fail}; };
  const aSummaryOk = async (h, what) => { const c = aCounts(await aItems(h.page)); eq((await h.page.textContent('#at-summary')).trim(), c.n ? aT(h, 'summary', c.n, c.ran, c.warn, c.fail) : '', (what || '') + ' rezumat'); return c; };
  const aDownload = async (h, sel) => { const [dl] = await Promise.all([h.page.waitForEvent('download'), h.page.click(sel)]); return {name: dl.suggestedFilename(), bytes: fs.readFileSync(await dl.path())}; };
  const AV = JSON.parse(fs.readFileSync(path.join(ADIR, 'src', 'app.json'), 'utf8')).version;

  await T(NAME + ': rețea: fără bifă nu pleacă nicio cerere; cu bifă pleacă doar către gazdele declarate, fără cookie/referer, cu datele minime', async () => {
    const h = await aOpen();
    const calls = await aMock(h);
    await aFiles(h, [FILES[0]]);
    await aText(h, LINK_BBC); await aText(h, 'https://example.com/a?utm_source=x'); await aText(h, 'example.org');
    await aReady(h, 4);
    eq(await h.page.isChecked('#at-consent'), false, 'bifa de consimțământ pornește debifată');
    ok(await h.page.isDisabled('[data-act="runall-net"]'), 'butonul de rețea e dezactivat fără bifă');
    await h.page.locator('[data-act="run"][data-check="dns-summary"]').first().click({force: true, timeout: 3000}).catch(() => {});
    await h.page.locator('[data-act="run"][data-check="wayback-lookup"]').first().click({force: true, timeout: 3000}).catch(() => {});
    await aRun(h);                                               // toate verificările offline, cu bifa debifată
    eq(calls.length, 0, 'fără bifă: nicio cerere, nici măcar încercată');
    let items = await aItems(h.page);
    ok(items.slice(1).every((it) => it.checks.filter((c) => c.net).length === 2 && it.checks.filter((c) => c.net).every((c) => c.badge === '' && c.btnDisabled)), 'verificările cu rețea rămân fără rezultat și dezactivate');
    ok(items[0].checks.every((c) => !c.net), 'o fotografie nu are verificări cu rețea');
    await h.page.check('#at-consent');
    eq(await aStatus(h), aT(h, 'st_consent_on'), 'anunț: consimțământ dat');
    ok(!(await h.page.isDisabled('[data-act="runall-net"]')), 'cu bifă, butonul de rețea se activează (există elemente cu adresă)');
    items = await aItems(h.page);
    ok(items.slice(1).every((it) => it.checks.filter((c) => c.net).every((c) => !c.btnDisabled)), 'butoanele verificărilor cu rețea se activează');
    eq(await h.page.$$eval('.at-netnote', (e) => e.filter((x) => x.textContent.includes('tick')).length), 0, 'nota «bifează mai întâi» dispare');
    eq(calls.length, 0, 'bifa singură nu trimite nimic');
    await aRun(h, '[data-act="runall-net"]');
    // gazde: exact cele declarate (descriptori + CSP), nimic altceva (cererile nedeclarate ar fi ajuns în h.net)
    eq([...new Set(calls.map((c) => c.host))].sort().join(), NET_HOSTS.join(), 'gazdele contactate = gazdele declarate');
    eq(calls.length, 27, '3 elemente × (7 interogări DNS + 1 a doua opinie + 1 Arhivă)');
    ok(calls.every((c) => c.method === 'GET' && !('cookie' in c.headers) && !('referer' in c.headers) && !('authorization' in c.headers) && !('x-requested-with' in c.headers)), 'doar GET, fără cookie, referer sau autorizare');
    const dns = calls.filter((c) => c.host !== 'archive.org'), wb = calls.filter((c) => c.host === 'archive.org');
    eq(dns.length, 24); eq(wb.length, 3);
    const dnsNames = [...new Set(dns.map((c) => c.q.name))].sort();
    eq(dnsNames.join(' '), ['_dmarc.example.com', '_dmarc.example.org', '_dmarc.secure-login.example', 'example.com', 'example.org', 'secure-login.example'].sort().join(' '), 'resolverele primesc doar numele de domeniu (gazda reală, nu cea din fața lui @)');
    ok(!dns.some((c) => /utm_source|fbclid|bbc|\/news|\/a$/.test(c.path + JSON.stringify(c.q))), 'calea și parametrii adresei nu ajung la resolvere');
    ok(wb.every((c) => Object.keys(c.q).join() === 'url'), 'Arhiva primește un singur parametru, adresa (codificată corect)');
    ok(wb.some((c) => c.q.url.includes('fbclid=abc123')), 'adresa trimisă la Arhivă nu e trunchiată la &');
    const fx = await h.page.evaluate(() => window.__fetches);
    eq(fx.length, 27, 'fiecare cerere trece prin fetch cu aceleași opțiuni');
    ok(fx.every((x) => x.credentials === 'omit' && x.referrerPolicy === 'no-referrer' && x.cache === 'no-store' && x.method === 'GET'), 'fetch: credentials=omit, referrerPolicy=no-referrer, cache=no-store, GET: ' + JSON.stringify(fx.find((x) => !(x.credentials === 'omit' && x.referrerPolicy === 'no-referrer' && x.cache === 'no-store' && x.method === 'GET'))));
    ok(fx.every((x) => x.headers.every((k) => k === 'accept')), 'singurul antet adăugat este accept');
    ok(fx.every((x) => x.u.startsWith('https://')), 'doar https');
    items = await aItems(h.page);
    const L = (it, id) => it.checks.find((c) => c.id === id);
    for (const it of items.slice(1)) {
      ok(L(it, 'dns-summary').badge === 'info' && L(it, 'wayback-lookup').badge === 'info', it.name + ': rezultate de rețea');
      ok(L(it, 'dns-summary').lines.some((l) => /93\.184\.216\.34/.test(l.text)), it.name + ': adresa din răspuns');
      ok(L(it, 'wayback-lookup').lines.some((l) => /Closest archived copy: 2024-01-01 12:00, HTTP status 200/.test(l.text)), it.name + ': copia din arhivă');
    }
    eq(await h.page.$$eval('#at-items .at-findings a, #at-items .at-findings [href]', (e) => e.length), 0, 'datele primite din rețea se afișează ca text, nu ca linkuri');
    await aSummaryOk(h, 'după rețea');
    // raportul cuprinde și rezultatele de rețea
    const j = JSON.parse((await aDownload(h, '[data-act="rep-json"]')).bytes.toString('utf8'));
    eq(j.items.length, 4);
    ok(j.items.slice(1).every((it) => it.checks.some((c) => c.id === 'dns-summary') && it.checks.some((c) => c.id === 'wayback-lookup')), 'JSON: rezultatele de rețea apar în raport');
    noErr(h);                                                    // nici o cerere în afara celor simulate, nici o eroare CSP
    await h.ctx.close();
  });

  await T(NAME + ': rețea: dacă bifa se scoate în timpul rulării, verificările rămase în coadă nu mai pleacă', async () => {
    const h = await aOpen();
    let release; const gate = new Promise((r) => { release = r; });
    const calls = await aMock(h, {gate});
    await aText(h, 'example.com'); await aText(h, 'example.org');
    await aReady(h, 2);
    await h.page.check('#at-consent');
    await h.page.click('[data-act="runall-net"]');
    await h.page.waitForFunction(() => !!document.querySelector('#at-items .lv-run'), null, {timeout: 10000});
    await h.page.waitForTimeout(500);
    const before = calls.length;
    ok(before >= 1, 'primul element a trimis cereri înainte de revocare (' + before + ')');
    ok(calls.every((c) => /example\.com/.test(c.q.name || c.q.url)), 'doar primul element a trimis până acum');
    await h.page.uncheck('#at-consent');
    eq(await aStatus(h), aT(h, 'st_consent_off'), 'anunț: consimțământ retras');
    ok(await h.page.isDisabled('[data-act="runall-net"]'), 'butonul de rețea se dezactivează imediat');
    ok((await aItems(h.page)).every((it) => it.checks.filter((c) => c.net).every((c) => c.btnDisabled)), 'și butoanele verificărilor cu rețea');
    release();
    await h.page.waitForFunction((t) => document.querySelector('#at-status').textContent.trim() === t && !document.querySelector('#at-items .lv-run'), AI.en.st_done, {timeout: 30000});
    eq(calls.length, before, 'după revocare nu mai pleacă nicio cerere');
    ok(!calls.some((c) => /example\.org/.test(c.q.name || c.q.url)), 'al doilea element nu a fost trimis deloc');
    ok(!calls.some((c) => c.host === 'archive.org'), 'nici verificarea Arhivei a primului element (era în coadă)');
    const items = await aItems(h.page);
    ok(items[1].checks.filter((c) => c.net).every((c) => c.badge === ''), 'al doilea element: fără rezultate de rețea');
    eq(await h.page.isChecked('#at-consent'), false);
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': rețea: HTTP 500, JSON invalid și răspuns peste 1 MiB devin erori afișate, fără a strica pagina; se poate reîncerca', async () => {
    const SC = [
      {mode: {dns: '500', wb: '500'}, dns: /failed: HTTP 500/, wb: /failed: HTTP 500/, dnsSt: 'error', wbSt: 'error'},
      {mode: {dns: 'junk', wb: 'junk'}, dns: /failed: \S/, wb: /failed: \S/, dnsSt: 'error', wbSt: 'error'},
      {mode: {dns: 'big', wb: 'none'}, dns: /failed: too-large/, wb: /No archived copy/, dnsSt: 'error', wbSt: 'info'}
    ];
    for (const [i, s] of SC.entries()) {
      const h = await aOpen();
      const calls = await aMock(h, s.mode);
      await aText(h, 'example.org');
      await aReady(h, 1);
      await h.page.check('#at-consent');
      await aRun(h, '[data-act="runall-net"]');
      const it = (await aItems(h.page))[0], d = it.checks.find((c) => c.id === 'dns-summary'), w = it.checks.find((c) => c.id === 'wayback-lookup');
      eq(d.badge, s.dnsSt, 'scenariul ' + i + ': DNS'); eq(w.badge, s.wbSt, 'scenariul ' + i + ': Arhiva');
      ok(d.lines.some((l) => s.dns.test(l.text)), 'scenariul ' + i + ': mesaj DNS ' + JSON.stringify(d.lines)); ok(w.lines.some((l) => s.wb.test(l.text)), 'scenariul ' + i + ': mesaj Arhiva ' + JSON.stringify(w.lines));
      ok(calls.length > 0 && calls.every((c) => NET_HOSTS.includes(c.host)), 'scenariul ' + i + ': doar gazde declarate');
      ok(!(await h.page.isDisabled('[data-act="run"][data-check="dns-summary"]')), 'scenariul ' + i + ': butonul rămâne activ pentru reîncercare');
      await aSummaryOk(h, 'scenariul ' + i);
      // rezultatele offline merg mai departe, nealterate de eșecul rețelei
      await aRun(h);
      ok((await aItems(h.page))[0].checks.find((c) => c.id === 'url-anatomy').badge === 'info', 'scenariul ' + i + ': verificările offline funcționează');
      // singurele erori de consolă permise sunt cele ale browserului pentru răspunsurile 5xx simulate
      ok(h.errors.every((e) => /Failed to load resource: the server responded with a status of 500/.test(e)), 'scenariul ' + i + ': erori neașteptate: ' + h.errors.filter((e) => !/status of 500/.test(e)).join(' | '));
      eq(h.net.length, 0, 'scenariul ' + i + ': nicio cerere în afara celor simulate');
      if (i === 0) {                                             // serviciul își revine: aceeași verificare, rulată din nou, reușește
        await aMock(h, {});
        await h.page.locator('[data-act="run"][data-check="dns-summary"]').first().click();
        await h.page.waitForFunction(() => !document.querySelector('#at-items .lv-run') && document.querySelector('[data-check="dns-summary"] .at-badge.lv-info'), null, {timeout: 20000});
        const d2 = (await aItems(h.page))[0].checks.find((c) => c.id === 'dns-summary');
        eq(d2.badge, 'info', 'după reîncercare verificarea reușește'); ok(d2.lines.some((l) => /93\.184\.216\.34/.test(l.text)));
        eq(d2.err, '', 'eroarea veche dispare');
      }
      await h.ctx.close();
    }
  });

  /* ---------- limbi: aceleași rezultate, text tradus ---------- */
  await T(NAME + ': schimbarea limbii păstrează elementele, rezultatele, imaginile și consimțământul; textul rezultatelor se traduce în toate cele 8 limbi', async () => {
    const h = await aOpen();
    await aMock(h);
    await aFiles(h, FILES.slice(0, 4));
    await aText(h, 'example.org'); await aText(h, TEXT_BAD);
    await aReady(h, 6);
    await h.page.check('#at-consent');
    await aRun(h); await aRun(h, '[data-act="runall-net"]');
    const base = await aItems(h.page), c0 = aCounts(base);
    ok(c0.ran >= 20 && c0.warn >= 5, 'puncte de plecare: ' + JSON.stringify(c0));
    const arts0 = await h.page.$$eval('canvas.at-art', (e) => e.map((c) => c.width + 'x' + c.height));
    ok(arts0.length >= 1, 'harta ELA există');
    const RAW = /^(?:[a-z0-9]+\.[a-z0-9_.]+)(?::|$)/;
    for (const l of ['ro', 'de', 'fr', 'es', 'it', 'hu', 'pt', 'en']) {
      await aLang(h, l);
      const items = await aItems(h.page);
      eq(items.map((i) => i.hash).join(), base.map((i) => i.hash).join(), l + ': aceleași SHA-256');
      eq(items.map((i) => i.name).join('|'), base.map((i) => i.name).join('|'), l + ': aceleași nume');
      eq(JSON.stringify(aCounts(items)), JSON.stringify(c0), l + ': aceleași rezultate');
      eq((await h.page.textContent('#at-summary')).trim(), aT(h, 'summary', c0.n, c0.ran, c0.warn, c0.fail), l + ': rezumatul în limba nouă');
      eq(await h.page.isChecked('#at-consent'), true, l + ': consimțământul rămâne');
      eq((await h.page.$$eval('canvas.at-art', (e) => e.map((c) => c.width + 'x' + c.height))).join(), arts0.join(), l + ': imaginile rămân');
      ok(items.every((it) => it.checks.every((c) => c.lines.every((ln) => !RAW.test(ln.text)))), l + ': rezultat netradus (cod brut): ' + JSON.stringify(items.flatMap((it) => it.checks.flatMap((c) => c.lines.filter((ln) => RAW.test(ln.text)).map((ln) => ln.text)))));
      ok(items[0].sub.startsWith(AI[l].kind_image), l + ': tipul elementului în limba nouă («' + items[0].sub + '»)');
      const badges = await h.page.$$eval('#at-items .at-check .at-chead .at-badge', (e) => e.map((b) => b.textContent.replace(/^\S+\s/, '').trim()));
      const labels = new Set(['ok', 'info', 'warn', 'fail', 'skip', 'error'].map((x) => AI[l]['lv_' + x]));
      ok(badges.length > 0 && badges.every((b) => labels.has(b)), l + ': etichetele de nivel: ' + JSON.stringify([...new Set(badges)]));
    }
    noErr(h);
    await h.ctx.close();
  });

  /* ---------- rapoarte, tipărire, stocare ---------- */
  const mdEsc = (s) => String(s).replace(/([\\`*_{}\[\]<>#|~])/g, '\\$1').replace(/\r?\n/g, ' ');
  const EVIL = '<img src=x onerror=alert(1)> [click](javascript:alert(2))';
  const TITLE = 'Caz de test: ȘTIRE falsă?', NOTES = 'Notă confidențială\nlinia doi <b>bold</b> & `cod` *x*';

  await T(NAME + ': rapoarte: Markdown, JSON, copiere și tipărire conțin ce se vede pe ecran, cu text ostil neutralizat; nimic din dosar nu se păstrează pe dispozitiv în afară de titlu și note', async () => {
    const h = await aOpen();
    const dialogs = []; h.page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
    ok(await h.page.isDisabled('[data-act="rep-md"]') && await h.page.isDisabled('[data-act="rep-json"]') && await h.page.isDisabled('[data-act="rep-copy"]') && await h.page.isDisabled('[data-act="rep-print"]'), 'fără elemente, butoanele de raport sunt dezactivate');
    await h.page.fill('#at-title', TITLE); await h.page.fill('#at-notes', NOTES);
    await aFiles(h, FILES.slice(0, 3));
    await aText(h, EVIL); await aText(h, LINK_BBC);
    await aReady(h, 5);
    ok(!(await h.page.isDisabled('[data-act="rep-md"]')), 'cu elemente, butoanele de raport se activează');
    await aRun(h);
    const items = await aItems(h.page), cnt = aCounts(items);
    eq(items[3].name, EVIL.replace(/\s+/g, ' ').slice(0, 60), 'numele textului ostil se afișează ca text');
    eq(await h.page.$$eval('#at-items img:not(.at-thumb)', (e) => e.length), 0, 'nicio imagine injectată din text');
    // ----- Markdown
    const md = await aDownload(h, '[data-act="rep-md"]');
    eq(md.name, 'caz-de-test-stire-falsa.md', 'numele fișierului vine din titlu, fără diacritice');
    eq(await aStatus(h), aT(h, 'st_saved'));
    const t = md.bytes.toString('utf8');
    ok(t.startsWith('# ' + TITLE + '\n'), 'titlul');
    ok(t.includes('**' + AI.en.r_generated + ':** ') && t.includes('**' + AI.en.r_tool + ':** ' + AI.en.title + ' ' + AV), 'data generării și versiunea instrumentului');
    ok(t.includes('> Notă confidențială\n> linia doi \\<b\\>bold\\</b\\> & \\`cod\\` \\*x\\*'), 'notele, citate și cu caractere speciale neutralizate: ' + JSON.stringify(t.slice(t.indexOf('## ' + AI.en.r_notes), t.indexOf('## 1.'))));
    ok(!t.split('\n').some((l) => /(?<!\\)[<>]/.test(l.replace(/^>\s?/, ''))), 'în Markdown nu rămâne niciun < sau > neprotejat');
    ok(t.includes('## 4. ' + mdEsc(items[3].name)), 'titlul elementului ostil este protejat');
    ['photo.jpg', 'gen.png', 'signed.jpg'].forEach((n, i) => ok(t.includes('## ' + (i + 1) + '. ' + n + '\n'), 'element ' + n));
    for (const [i, b] of [FX.photo, FX.png, FX.signed].entries()) ok(t.includes('**SHA-256:** `' + sha(b) + '`'), 'SHA-256 pentru elementul ' + (i + 1));
    ok(t.includes('**' + AI.en.r_url + ':** `' + LINK_BBC + '`'), 'adresa verificată apare întreagă, în cod');
    let nLines = 0;
    for (const it of items) for (const c of it.checks) { if (!c.badge) continue; ok(t.includes('### ' + mdEsc(AI.en['c_' + c.id.replace(/-/g, '_') + '_name']) + ' — ' + mdEsc(AI.en['lv_' + c.badge])), it.name + ' · ' + c.id + ': titlul verificării'); for (const ln of c.lines) { nLines++; ok(t.includes('- ' + mdEsc(ln.text) + '\n'), it.name + ' · ' + c.id + ': linia «' + ln.text.slice(0, 50) + '» lipsește din raport'); } }
    ok(nLines > 15, 'linii verificate: ' + nLines);
    ok(t.includes('## ' + AI.en.r_limits) && AI.en.lim_1 && t.includes(mdEsc(AI.en.lim_1)) && t.includes(mdEsc(AI.en.lim_3)), 'limitele raportului sunt incluse');
    // ----- JSON
    const js = await aDownload(h, '[data-act="rep-json"]');
    eq(js.name, 'caz-de-test-stire-falsa.json');
    const j = JSON.parse(js.bytes.toString('utf8'));
    eq(j.tool, NAME); eq(j.version, AV); eq(j.title, TITLE); eq(j.notes, NOTES);
    ok(Math.abs(Date.parse(j.generated) - Date.now()) < 180000, 'data generării este cea de acum');
    eq(j.items.length, 5);
    eq(j.items[0].name, 'photo.jpg'); eq(j.items[0].kind, 'file'); eq(j.items[0].size, FX.photo.length); eq(j.items[0].type, 'jpeg'); eq(j.items[0].sha256, sha(FX.photo));
    eq(j.items[1].sha256, sha(FX.png)); eq(j.items[2].sha256, sha(FX.signed));
    eq(j.items[4].kind, 'url'); eq(j.items[4].value, LINK_BBC); ok(!('sha256' in j.items[4]) && !('size' in j.items[4]), 'un link nu are SHA-256 sau mărime');
    eq(j.items[3].kind, 'text');
    eq(j.items.map((it) => it.checks.length).join(), items.map((it) => it.checks.filter((c) => c.badge).length).join(), 'JSON: aceleași verificări ca pe ecran');
    ok(j.items.every((it) => it.checks.every((c) => ['ok', 'info', 'warn', 'fail', 'skip'].includes(c.status) && c.findings.every((f) => typeof f.code === 'string' && ['ok', 'info', 'warn', 'fail'].includes(f.level) && Array.isArray(f.args) && typeof f.text === 'string' && f.text.length > 0))), 'JSON: stări și constatări valide');
    eq(JSON.stringify(j.items.map((it) => it.checks.map((c) => c.findings.map((f) => f.text)))), JSON.stringify(items.map((it) => it.checks.filter((c) => c.badge).map((c) => c.lines.map((ln) => ln.text)))), 'JSON: textele constatărilor = cele afișate');
    // ----- copiere
    await h.page.click('[data-act="rep-copy"]');
    await h.page.waitForFunction(() => window.__clip.length === 1);
    const cp = JSON.parse(await h.page.evaluate(() => window.__clip[0])); delete cp.generated; const j2 = JSON.parse(js.bytes.toString('utf8')); delete j2.generated;
    eq(JSON.stringify(cp), JSON.stringify(j2), 'textul copiat = JSON-ul descărcat');
    eq((await h.page.textContent('[data-act="rep-copy"]')).trim(), AI.en.copied, 'butonul confirmă copierea');
    await h.page.waitForFunction((t) => document.querySelector('[data-act="rep-copy"]').textContent.trim() === t, AI.en.b_rep_copy, {timeout: 5000});
    await h.page.click('[data-act="copy"][data-text="' + sha(FX.photo) + '"]');
    eq(await h.page.evaluate(() => window.__clip[1]), sha(FX.photo), 'butonul de lângă SHA-256 copiază amprenta');
    // ----- tipărire
    await h.page.evaluate(() => { window.__keep = true; });
    await h.page.click('[data-act="rep-print"]');
    await h.page.waitForFunction(() => window.__print === 1);
    const pr = await h.page.evaluate(() => ({text: window.__printed, html: window.__printedHtml, body: window.__printBody}));
    ok(/\bat-printing\b/.test(pr.body), 'corpul paginii intră în modul de tipărire');
    ok(pr.text.includes(TITLE) && pr.text.includes('photo.jpg') && pr.text.includes(sha(FX.photo)) && pr.text.includes('Notă confidențială') && pr.text.includes('linia doi <b>bold</b> & `cod` *x*'), 'raportul tipărit conține titlul, elementele, amprenta și notele (ca text)');
    const dom = await h.page.evaluate((html) => {                // raportul tipărit se analizează într-un document inert: doar etichete de text, fără niciun atribut
      const d = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html'), all = [...d.body.querySelectorAll('*')];
      return {tags: [...new Set(all.map((e) => e.tagName))].sort(), attrs: all.filter((e) => e.attributes.length).map((e) => e.tagName), text: d.body.textContent};
    }, pr.html);
    eq(dom.tags.join(), 'B,BR,CODE,H1,H2,H3,LI,P,UL', 'raportul tipărit folosește doar etichete de text');
    eq(dom.attrs.length, 0, 'și nicio etichetă nu are atribute (fără onerror, href, src, style)');
    ok(dom.text.includes(EVIL.replace(/\s+/g, ' ').slice(0, 60)), 'textul ostil apare ca text');
    ok(pr.html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'textul ostil este scris ca text');
    await h.page.emulateMedia({media: 'print'});
    const css = await h.page.evaluate(() => ({root: getComputedStyle(document.getElementById('at-printroot')).display, color: getComputedStyle(document.getElementById('at-printroot')).color, others: [...document.body.children].filter((e) => e.id !== 'at-printroot').map((e) => e.tagName + ':' + getComputedStyle(e).display)}));
    await h.page.emulateMedia({media: 'screen'});
    eq(css.root, 'block', 'la tipărire raportul se vede'); eq(css.color, 'rgb(0, 0, 0)', 'text negru');
    ok(css.others.every((x) => x.endsWith(':none')), 'la tipărire restul paginii se ascunde: ' + css.others.join(' '));
    await h.page.click('[data-act="rep-print"]'); await h.page.waitForFunction(() => window.__print === 2);
    eq(await h.page.$$eval('#at-printroot', (e) => e.length), 1, 'două tipăriri la rând nu lasă două rapoarte');
    await h.page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    eq(await h.page.$$eval('#at-printroot', (e) => e.length), 0, 'după tipărire raportul temporar dispare');
    ok(!(await h.page.evaluate(() => /\bat-printing\b/.test(document.body.className))), 'și clasa de pe corp');
    // ----- stocare: doar titlul și notele
    const st = await aStore(h.page);
    const KK = 'fff.' + NAME + '.__keys', KM = 'fff.' + NAME + '.__mt';
    ok(Object.keys(st).every((k) => [KEY, KK, KM].includes(k)) && KEY in st, 'singurele chei: dosarul și evidența kitului (' + Object.keys(st).join(', ') + ')');
    if (KK in st) eq(st[KK], JSON.stringify([KEY]), 'evidența kitului conține doar numele cheii');
    if (KM in st) ok(Object.keys(JSON.parse(st[KM])).every((k) => k === KEY) && Object.values(JSON.parse(st[KM])).every((v) => typeof v === 'number'), 'iar datele de modificare doar timpul cheii');
    eq(JSON.stringify(JSON.parse(st[KEY])), JSON.stringify({title: TITLE, notes: NOTES}));
    ok(!/photo\.jpg|gen\.png|signed\.jpg|bbc|secure-login|onerror|[0-9a-f]{64}/i.test(JSON.stringify(st)), 'în stocare nu apare niciun nume, adresă sau amprentă din dosar');
    eq(await h.page.evaluate(() => sessionStorage.length + document.cookie.length), 0, 'fără sessionStorage și fără cookie-uri');
    eq(dialogs.length, 0, 'nicio fereastră de dialog');
    noErr(h);
    // ----- după reîncărcare revin doar titlul și notele
    await h.page.reload(); await h.page.waitForSelector(ready);
    eq(await h.page.inputValue('#at-title'), TITLE); eq(await h.page.inputValue('#at-notes'), NOTES);
    eq((await h.page.textContent('#at-items')).trim(), AI.en.empty, 'elementele nu se păstrează');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': „Caz nou": prima apăsare cere confirmare și expiră, a doua golește elementele, titlul, notele și stocarea', async () => {
    const h = await aOpen();
    await h.page.fill('#at-title', 'Dosar'); await h.page.fill('#at-notes', 'note');
    await aText(h, 'example.com'); await aText(h, 'ceva text'); await aReady(h, 2);
    await aRun(h);
    await h.page.click('#at-clear');
    eq((await h.page.textContent('#at-clear')).trim(), AI.en.new_case_confirm, 'prima apăsare cere confirmarea');
    eq((await aItems(h.page)).length, 2, 'prima apăsare nu șterge nimic');
    await h.page.waitForFunction((t) => document.querySelector('#at-clear').textContent.trim() === t, AI.en.new_case, {timeout: 9000});
    eq((await aItems(h.page)).length, 2, 'după expirare elementele rămân');
    await h.page.click('#at-clear');                              // se armează din nou
    eq((await h.page.textContent('#at-clear')).trim(), AI.en.new_case_confirm);
    await h.page.click('#at-clear');                              // a doua apăsare în 5 s
    eq(await aStatus(h), aT(h, 'st_new'), 'anunț: caz nou');
    eq((await aItems(h.page)).length, 0, 'elementele s-au șters');
    eq(await h.page.inputValue('#at-title'), ''); eq(await h.page.inputValue('#at-notes'), '');
    eq((await h.page.textContent('#at-items')).trim(), AI.en.empty);
    eq(await h.page.textContent('#at-summary'), '', 'rezumatul dispare');
    eq(JSON.stringify(JSON.parse((await aStore(h.page))[KEY])), JSON.stringify({title: '', notes: ''}), 'și stocarea e golită');
    ok(await h.page.isDisabled('[data-act="rep-md"]'), 'butoanele de raport se dezactivează');
    const af = await h.page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName) : ''; });
    ok(af !== 'BODY' && af !== 'HTML', 'după „Caz nou" focusul nu se pierde (e pe: ' + af + ')');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': tastatură: butoanele rămân focalizate după ce se reface lista; la ștergerea unui element focusul trece la unul vecin', async () => {
    const h = await aOpen();
    await aText(h, 'example.com'); await aText(h, 'example.org'); await aText(h, 'text de probă'); await aReady(h, 3);
    const fk = () => h.page.evaluate(() => (document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-fk')) || (document.activeElement && document.activeElement.id) || document.activeElement.tagName);
    const first = (await aItems(h.page))[0];
    const id = first.id.replace('at-item-', '');
    // „Rulează" pe o verificare: după rezultat butonul (acum «Rulează din nou») are tot focusul
    const sel = '#at-item-' + id + ' [data-act="run"][data-check="url-anatomy"]';
    await h.page.focus(sel); await h.page.keyboard.press('Enter');
    await h.page.waitForFunction((s) => { const b = document.querySelector(s); return b && /again/i.test(b.textContent); }, sel, {timeout: 10000});
    eq(await fk(), 'run:' + id + ':url-anatomy', 'focusul rămâne pe butonul verificării');
    // „Rulează elementul"
    await h.page.focus('#at-item-' + id + ' [data-act="runitem"]'); await h.page.keyboard.press('Enter');
    await h.page.waitForFunction(() => document.querySelector('#at-status').textContent.trim() === 'Done.');
    eq(await fk(), 'ri:' + id, 'focusul rămâne pe «Rulează elementul»');
    // ștergere: focusul nu se pierde în <body>
    const rm = '#at-item-' + id + ' [data-act="remove"]';
    await h.page.focus(rm); await h.page.keyboard.press('Enter');
    eq(await aStatus(h), aT(h, 'st_removed'));
    eq((await aItems(h.page)).length, 2);
    const k2 = await fk();
    ok(k2 !== 'BODY' && k2 !== 'HTML' && k2 !== '', 'după ștergere focusul a trecut la «' + k2 + '»');
    noErr(h);
    await h.ctx.close();
  });

  /* ---------- fișiere și texte ostile ---------- */
  const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const asc = (s) => [...s].map((c) => c.charCodeAt(0));
  const nest = (depth) => { let b = Uint8Array.from([...be32(8), ...asc('moov')]); for (let i = 0; i < depth; i++) { const o = new Uint8Array(b.length + 8); o.set(be32(b.length + 8), 0); o.set(asc('moov'), 4); o.set(b, 8); b = o; } return b; };
  const HOSTILE = [
    ['empty.jpg', 'image/jpeg', new Uint8Array(0)],
    ['cut.jpg', 'image/jpeg', FX.photo.subarray(0, 300)],
    ['lenbomb.jpg', 'image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, ...asc('Exif\0\0II*\0'), 8, 0, 0, 0, 0xff, 0xff])],
    ['loop.tif', 'image/tiff', Uint8Array.from([...asc('II*\0'), 8, 0, 0, 0, 0, 0, 8, 0, 0, 0])],
    ['bigifd.tif', 'image/tiff', Uint8Array.from([...asc('II*\0'), 8, 0, 0, 0, 0xff, 0xff, 1, 2, 3])],
    ['pngbomb.png', 'image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...be32(13), ...asc('IHDR'), ...be32(0x7fffffff), ...be32(0x7fffffff), 8, 6, 0, 0, 0, 0, 0, 0, 0, ...be32(0x7fffffff), ...asc('tEXt'), 65, 66])],
    ['box.mp4', 'video/mp4', Uint8Array.from([...be32(20), ...asc('ftypisom'), ...be32(0), ...asc('isom'), ...be32(0xffffffff), ...asc('moov'), ...be32(0), ...asc('mvhd')])],
    ['nest.mp4', 'video/mp4', Uint8Array.from([...be32(20), ...asc('ftypisom'), ...be32(0), ...asc('isom'), ...nest(20000)])],
    ['ebml.webm', 'video/webm', Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0xff, 0x42, 0x82, 0x84, ...asc('webm'), 0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])],
    ['<img src=x onerror=alert(1)>.jpg', 'image/jpeg', FX.photo],
    ['‮gpj.exe', 'application/octet-stream', FX.txt],
    ['n'.repeat(300) + '.png', 'image/png', FX.png]
  ];

  await T(NAME + ': fișiere ostile (goale, tăiate, cu lungimi declarate uriașe, bucle, cutii imbricate) și nume cu HTML sau RTL: fără erori, fără blocare, fără cod executat', async () => {
    const h = await aOpen();
    const dialogs = []; h.page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
    await aFiles(h, HOSTILE);
    const t0 = Date.now();
    await aRun(h);
    ok(Date.now() - t0 < 30000, 'verificarea a durat ' + (Date.now() - t0) + ' ms');
    const items = await aItems(h.page);
    eq(items.length, HOSTILE.length);
    items.forEach((it, i) => {
      eq(it.name, HOSTILE[i][0], 'numele se afișează întocmai, ca text: ' + HOSTILE[i][0].slice(0, 30));
      for (const c of it.checks) { if (c.net) continue; ok(['ok', 'info', 'warn', 'fail', 'skip'].includes(c.badge), it.name.slice(0, 30) + ' · ' + c.id + ': stare «' + c.badge + '» ' + c.err); }
      ok(it.hash === sha(HOSTILE[i][2]), it.name.slice(0, 30) + ': SHA-256 corect și pentru fișierele stricate');
    });
    // fișierele stricate sunt spuse stricate, nu «curate»
    const L = (it, id) => it.checks.find((c) => c.id === id);
    ok(L(items[0], 'file-structure').lines.length >= 1, 'un fișier gol primește o explicație');
    ok(L(items[1], 'file-structure').lines.some((l) => l.lv === 'warn' || l.lv === 'fail'), 'un JPEG tăiat este semnalat: ' + JSON.stringify(L(items[1], 'file-structure').lines));
    ok(items.slice(2, 9).every((it) => L(it, 'file-structure').badge !== 'ok'), 'niciun fișier ostil nu primește «OK» la structură');
    eq(dialogs.length, 0, 'nicio fereastră de dialog (nimic executat)');
    eq(await h.page.$$eval('#at-items img:not(.at-thumb), #at-items script, #at-items [onerror]', (e) => e.length), 0, 'numele ostile nu injectează elemente');
    eq(await h.page.$$eval('#at-items h4', (e) => e.map((x) => x.textContent).join('|')), HOSTILE.map((x) => x[0]).join('|'));
    await aSummaryOk(h, 'fișiere ostile');
    // pagina rămâne utilizabilă după ele
    await aText(h, 'https://example.com/ok'); await aReady(h, HOSTILE.length + 1);
    await aRun(h);
    eq((await aItems(h.page))[HOSTILE.length].checks.find((c) => c.id === 'url-anatomy').badge, 'info', 'după fișierele ostile, o verificare obișnuită merge');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': fișier peste 200 MB: nu se citește în memorie, fără SHA-256, verificările se sar cu explicație', async () => {
    const big = path.join(os.tmpdir(), 'at-big-' + process.pid + '.bin');
    fs.writeFileSync(big, ''); fs.truncateSync(big, 201 * 1024 * 1024);            // fișier rar: nu ocupă disc, dar pagina vede 201 MiB
    const h = await aOpen();
    try {
      await h.page.setInputFiles('#at-files', big);
      await h.page.waitForFunction(() => document.querySelectorAll('#at-items .at-checks').length === 1, null, {timeout: 20000});
      let it = (await aItems(h.page))[0];
      ok(it.sub.includes('201 MB'), 'mărimea afișată: ' + it.sub);
      eq(it.hash, '', 'nu se calculează SHA-256');
      ok((await h.page.textContent('.at-hash')).includes(AI.en.hash_big), 'și se spune de ce');
      const t0 = Date.now();
      await aRun(h);
      ok(Date.now() - t0 < 10000, 'sărirea peste fișierul mare e imediată');
      it = (await aItems(h.page))[0];
      ok(it.checks.filter((c) => !c.net).length >= 1 && it.checks.filter((c) => !c.net).every((c) => c.badge === 'skip' && c.lines.some((l) => l.text === AI.en['skip_too-large'])), 'verificările sar cu explicația: ' + JSON.stringify(it.checks.map((c) => [c.id, c.badge, c.lines.map((l) => l.text)])));
      eq(it.checks.filter((c) => c.err).length, 0, 'fără erori');
      await aSummaryOk(h, '>200 MB');
      noErr(h);
    } finally { fs.rmSync(big, {force: true}); await h.ctx.close(); }
  });

  await T(NAME + ': text foarte lung și multe linkuri: se taie la 200 000 de caractere, pagina nu se blochează', async () => {
    const h = await aOpen();
    await h.page.fill('#at-text', 'ab '.repeat(90000));                                // 270 000 de caractere
    await h.page.click('[data-act="addtext"]');
    await aReady(h, 1);
    let it = (await aItems(h.page))[0];
    ok(it.sub.startsWith(AI.en.kind_text), 'tip text');
    ok((await h.page.textContent('#at-items .at-imeta')).includes(FMT(AI.en.chars, 200000)), 'se numără și se analizează doar primele 200000 de caractere');
    eq(it.name.length, 60, 'numele din listă se taie la 60 de caractere');
    const t0 = Date.now(); await aRun(h);
    ok(Date.now() - t0 < 15000, 'analiza textului lung a durat ' + (Date.now() - t0) + ' ms');
    ok((await aItems(h.page))[0].checks.every((c) => c.net || ['ok', 'info', 'warn', 'fail', 'skip'].includes(c.badge)), 'fără erori de verificare');
    // 300 de linkuri odată
    const links = []; for (let i = 0; i < 300; i++) links.push('https://site' + i + '.example/p?x=' + i);
    await h.page.fill('#at-text', links.join('\n'));
    const t1 = Date.now(); await h.page.click('[data-act="addtext"]');
    await aReady(h, 301);
    ok(Date.now() - t1 < 15000, '300 de elemente adăugate în ' + (Date.now() - t1) + ' ms');
    eq(await aStatus(h), aT(h, 'st_added', 300));
    const t2 = Date.now(); await aRun(h);
    ok(Date.now() - t2 < 45000, '300 de elemente verificate în ' + (Date.now() - t2) + ' ms');
    const c = await aSummaryOk(h, '300 de linkuri');
    eq(c.n, 301);
    noErr(h);
    await h.ctx.close();
  });

  /* ---------- tragere, lipire ---------- */
  await T(NAME + ': trage și lasă / lipește: se primesc doar fișierele; zona se evidențiază și se resetează; textul tras nu adaugă fișiere', async () => {
    const h = await aOpen();
    const fire = (type, kind, sel) => h.page.evaluate(([type, kind, sel]) => {
      const dt = new DataTransfer(), mkf = (n) => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])], n, {type: 'image/png'});
      if (kind === 'file') dt.items.add(mkf('dropped.png')); else if (kind === 'files') { dt.items.add(mkf('a1.png')); dt.items.add(mkf('a2.png')); dt.items.add(mkf('a3.png')); } else dt.setData('text/plain', 'doar text');
      const ev = type === 'paste' ? new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}) : new DragEvent(type, {dataTransfer: dt, bubbles: true, cancelable: true});
      (sel ? document.querySelector(sel) : document).dispatchEvent(ev);
      return {prevented: ev.defaultPrevented, over: /\bat-over\b/.test(document.querySelector('#at-drop').className)};
    }, [type, kind, sel || null]);
    let r = await fire('dragover', 'text'); eq(r.prevented, false, 'text tras: pagina nu preia evenimentul'); eq(r.over, false, 'și zona nu se evidențiază');
    r = await fire('drop', 'text'); eq(r.prevented, false); eq((await aItems(h.page)).length, 0, 'text lăsat: niciun element');
    r = await fire('dragover', 'file'); eq(r.prevented, true, 'fișier tras: se acceptă lăsarea'); eq(r.over, true, 'zona se evidențiază');
    await h.page.evaluate(() => document.dispatchEvent(new DragEvent('dragleave', {bubbles: true, relatedTarget: null})));
    eq(await h.page.$eval('#at-drop', (e) => /\bat-over\b/.test(e.className)), false, 'ieșirea din fereastră resetează zona');
    await fire('dragover', 'file');
    r = await fire('drop', 'file'); eq(r.prevented, true, 'lăsarea e preluată (browserul nu deschide fișierul)'); eq(r.over, false, 'zona se resetează');
    await aReady(h, 1);
    eq((await aItems(h.page))[0].name, 'dropped.png'); eq(await aStatus(h), aT(h, 'st_added', 1));
    r = await fire('drop', 'files'); await aReady(h, 4);
    eq((await aItems(h.page)).map((x) => x.name).join(), 'dropped.png,a1.png,a2.png,a3.png'); eq(await aStatus(h), aT(h, 'st_added', 3));
    r = await fire('paste', 'text', '#at-text'); eq(r.prevented, false, 'text lipit: rămâne comportamentul obișnuit al câmpului'); eq((await aItems(h.page)).length, 4);
    r = await fire('paste', 'file', '#at-text'); eq(r.prevented, true, 'imagine lipită: se preia'); await aReady(h, 5);
    eq((await aItems(h.page))[4].name, 'dropped.png');
    eq(await h.page.inputValue('#at-text'), '', 'câmpul de text nu primește nimic');
    noErr(h);
    await h.ctx.close();
  });

  /* ---------- ELA, cadre video, accesibilitate, mobil ---------- */
  const pngDims = (b) => ({sig: b.subarray(0, 8).toString('hex'), w: b.readUInt32BE(16), h: b.readUInt32BE(20)});
  const FFMPEG = (() => { try { const r = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], {encoding: 'utf8', cwd: os.tmpdir()}); return r.status === 0 && /libvpx/.test(r.stdout) ? 'ffmpeg' : ''; } catch (e) { return ''; } })();

  await T(NAME + ': ELA: harta apare doar pentru un JPEG decodabil, are dimensiunea imaginii așa cum o afișează browserul și se salvează ca PNG valid', async () => {
    const h = await aOpen();
    await aFiles(h, [['plain.jpg', 'image/jpeg', REAL_JPEG], FILES[1], FILES[0]]);          // JPEG simplu + PNG + JPEG stocat 96×64 cu orientarea EXIF 6
    await aRun(h);
    const items = await aItems(h.page);
    const dims = await h.page.$$eval('canvas.at-art', (e) => e.map((c) => c.width + 'x' + c.height));
    eq(dims.join(), '96x64,64x96', 'câte o hartă pentru fiecare JPEG; la cel cu orientarea EXIF 6 harta urmează imaginea afișată (rotită), nu cea stocată');
    eq(await h.page.$$eval('#' + items[1].id + ' canvas.at-art', (e) => e.length), 0, 'PNG-ul nu are hartă');
    eq(await h.page.$eval('figcaption', (e) => e.textContent), AI.en.art_ela, 'legenda hărții');
    ok((await h.page.$eval('[data-check="ela-jpeg"] .at-findings', (e) => e.textContent)).length > 0, 'harta vine cu o interpretare scrisă (nu doar imagine)');
    const dl = await aDownload(h, '[data-act="saveart"]');
    eq(dl.name, 'ela.png', 'numele fișierului salvat');
    const d = pngDims(dl.bytes);
    eq(d.sig, '89504e470d0a1a0a', 'semnătură PNG'); eq(d.w + 'x' + d.h, '96x64', 'dimensiunile PNG-ului salvat');
    // harta nu se dublează la re-rulare
    await h.page.locator('#' + items[0].id + ' [data-check="ela-jpeg"] [data-act="run"]').first().click();
    await h.page.waitForFunction(() => !document.querySelector('#at-items .lv-run'));
    eq(await h.page.$$eval('canvas.at-art', (e) => e.length), 2, 're-rularea nu dublează harta');
    noErr(h);
    await h.ctx.close();
  });

  await T(NAME + ': cadre-cheie: un clip WebM produce cadrele, în ordine, cu legendă și salvare PNG (sare dacă lipsește ffmpeg cu libvpx)', async () => {
    if (!FFMPEG) { ok(true, 'omis: ffmpeg cu libvpx lipsește'); return; }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'at-clip-')), clip = path.join(dir, 'clip.webm');
    const r = spawnSync(FFMPEG, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=4:size=160x120:rate=10', '-c:v', 'libvpx', '-b:v', '300k', '-pix_fmt', 'yuv420p', clip], {encoding: 'utf8', cwd: dir});
    if (r.status !== 0 || !fs.existsSync(clip)) { ok(true, 'omis: ffmpeg nu a produs clipul (' + String(r.stderr).slice(0, 80) + ')'); fs.rmSync(dir, {recursive: true, force: true}); return; }
    const h = await aOpen();
    try {
      await h.page.setInputFiles('#at-files', clip);
      await aReady(h, 1);
      const it0 = (await aItems(h.page))[0];
      ok(it0.sub.startsWith(AI.en.kind_video) && it0.sub.includes(FMT(AI.en.real_type, 'WEBM')), 'tip video, recunoscut din conținut: ' + it0.sub);
      eq(it0.hash, sha(fs.readFileSync(clip)), 'SHA-256');
      await aRun(h);
      const n = await h.page.$$eval('canvas.at-art', (e) => e.length);
      eq(n, 8, 'opt cadre');
      const dims = await h.page.$$eval('canvas.at-art', (e) => [...new Set(e.map((c) => c.width + 'x' + c.height))]);
      eq(dims.join(), '160x120', 'cadrele au dimensiunea clipului');
      const rx = new RegExp('^' + AI.en.art_frame.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{0\\}', '(\\d+)').replace('\\{1\\}', '([\\d.]+|—)') + '$');
      const caps = await h.page.$$eval('figcaption', (e) => e.map((x) => x.textContent));
      ok(caps.every((c) => rx.test(c)), 'legendele cadrelor: ' + JSON.stringify(caps));
      const ts = caps.map((c) => Number(rx.exec(c)[2]));
      ok(ts.every((t, i) => i === 0 || t > ts[i - 1]) && ts[0] > 0 && ts[7] < 4, 'momentele cresc și sunt în interiorul clipului: ' + ts.join(' '));
      const sig = await h.page.$$eval('canvas.at-art', (e) => e.map((c) => { const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < x.length; i += 97) s = (s * 31 + x[i]) >>> 0; return s; }));
      ok(new Set(sig).size >= 4, 'cadrele sunt diferite între ele (clipul se mișcă, nu e același cadru de opt ori): ' + sig.join(','));
      const vm = (await aItems(h.page))[0].checks.find((c) => c.id === 'video-meta');
      ok(vm.badge !== '' && vm.badge !== 'error', 'metadatele video: ' + vm.badge);
      const dl = await aDownload(h, '[data-act="saveart"]');
      ok(/^frame-\d+\.png$/.test(dl.name) || dl.name.endsWith('.png'), 'nume PNG: ' + dl.name);
      const d = pngDims(dl.bytes); eq(d.sig, '89504e470d0a1a0a'); eq(d.w + 'x' + d.h, '160x120');
      noErr(h);
    } finally { fs.rmSync(dir, {recursive: true, force: true}); await h.ctx.close(); }
  });

  await T(NAME + ': accesibilitate (axe) cu dosarul plin — rezultate, hărți, rețea, eroare, în temele luminoasă și întunecată și în mai multe limbi', async () => {
    for (const scheme of ['light', 'dark']) {
      const h = await aOpen({scheme});
      await aMock(h);
      await h.page.fill('#at-title', TITLE); await h.page.fill('#at-notes', NOTES);
      await aFiles(h, FILES);
      await aText(h, LINK_BBC); await aText(h, 'example.org'); await aText(h, TEXT_BAD);
      await aReady(h, 8);
      await h.page.check('#at-consent');
      await aRun(h); await aRun(h, '[data-act="runall-net"]');
      for (const l of (scheme === 'light' ? ['en', 'ro', 'de', 'hu'] : ['en'])) {
        await aLang(h, l);
        const v = await axe(h.page);
        ok(v.length === 0, scheme + '/' + l + ': ' + JSON.stringify(v));
      }
      eq(await h.page.getAttribute('#at-status', 'role'), 'status', 'zona de anunțuri are rolul «status»');
      eq(await h.page.getAttribute('#at-status', 'aria-live'), 'polite');
      eq(await h.page.$$eval('[style]:not([data-fff-bg])', (e) => e.length), 0, 'nicio etichetă cu atributul style în afara celor puse de kit pe antetele de tabel (CSP strict)');
      ok(await h.page.$$eval('#at-items canvas.at-art', (e) => e.length) >= 1, 'harta ELA a fost prezentă în verificare');
      noErr(h);
      await h.ctx.close();
    }
  });

  await T(NAME + ': pe mobil (360 px) cu nume, linkuri, amprente și rezultate foarte lungi nu apare defilare orizontală și nimic nu iese din card', async () => {
    const h = await aOpen({w: 360, h: 740});
    await aMock(h);
    const LONG_URL = 'https://' + 'a'.repeat(60) + '.example/' + 'p'.repeat(200) + '?q=' + 'v'.repeat(100);
    await aFiles(h, [['f'.repeat(120) + '.jpg', 'image/jpeg', FX.photo], ['x'.repeat(100) + '.png', 'image/png', FX.png]]);
    await aText(h, LONG_URL); await aText(h, LINK_BBC); await aText(h, 'Z'.repeat(59)); await aText(h, 'ab '.repeat(100));
    await aReady(h, 6);
    await h.page.check('#at-consent');
    const probe = () => h.page.evaluate(() => ({doc: document.documentElement.scrollWidth, win: innerWidth, cards: [...document.querySelectorAll('#at-items > article')].filter((a) => a.scrollWidth > a.clientWidth + 1).map((a) => a.id),
      over: [...document.querySelectorAll('#at-items *, #at-text, .at-drop')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 30)).slice(0, 6)}));
    let m = await probe();
    ok(m.doc <= m.win && m.cards.length === 0 && m.over.length === 0, 'înainte de rulare: ' + JSON.stringify(m));
    await aRun(h); await aRun(h, '[data-act="runall-net"]');
    m = await probe();
    ok(m.doc <= m.win && m.cards.length === 0 && m.over.length === 0, 'după rulare: ' + JSON.stringify(m));
    for (const l of ['ro', 'de', 'hu']) { await aLang(h, l); m = await probe(); ok(m.doc <= m.win && m.cards.length === 0 && m.over.length === 0, l + ': ' + JSON.stringify(m)); }
    const btn = await h.page.$$eval('#at-items button', (b) => b.map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    ok(btn.length > 0 && btn.every(([w, hh]) => w >= 24 && hh >= 24), 'butoanele au cel puțin 24×24 px (țintă tactilă): ' + JSON.stringify(btn.filter(([w, hh]) => w < 24 || hh < 24).slice(0, 4)));
    noErr(h);
    await h.ctx.close();
  });
  await browser.close();
} else {
  console.log('omis: atelier-verificare (nu există ' + path.relative(HUB, appFile('atelier-verificare')) + ')');
  skipped.add('atelier-verificare');
}
/* ================= SFÂRȘIT ATELIER DE VERIFICARE ================= */

const fail = results.filter((r) => !r[1]).length;
console.log(`\n${results.length - fail}/${results.length} teste trec` + (skipped.size ? ' · omise: ' + [...skipped].join(', ') : ''));
process.exit(fail ? 1 : 0);
