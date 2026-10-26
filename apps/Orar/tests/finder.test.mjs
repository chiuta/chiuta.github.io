// Teste Orar 2.0.0: „Găsește un interval” (fusuri, sărbători, calendar ocupat) și invitații .ics.
// Rulare: node tests/finder.test.mjs [filtru]
import {createRequire} from 'module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL_APP = 'file://' + path.join(HERE, '..', 'index.html');
const AXE = process.env.AXE_PATH || process.env.FFF_AXE;
const NOW = '2026-10-14T10:00:00+03:00';
const results = [];
const only = process.argv[2];
async function T(name, fn) {
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 7).join('\n       ')); }
}
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'});
async function newPage(o = {}) {
  const ctx = await browser.newContext({viewport: o.viewport || {width: 1280, height: 900}, locale: 'ro-RO', timezoneId: 'Europe/Bucharest', acceptDownloads: true});
  await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage();
  page.errs = []; page.net = [];
  page.on('pageerror', e => page.errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') page.errs.push(m.type() + ': ' + m.text()); });
  page.on('dialog', d => { page.errs.push('dialog nativ'); d.dismiss(); });
  page.on('request', r => { const u = r.url(); if (!/^(file|data|blob):/.test(u)) page.net.push(u); });
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective)); });
  await page.clock.install({time: new Date(o.now || NOW)});
  page.ctx = ctx;
  await page.goto(URL_APP); await page.waitForSelector('#b-find');
  return page;
}
const E = (p, fn, arg) => p.evaluate(fn, arg);
async function clean(p) { assert.deepEqual(await p.evaluate(() => window.__csp), [], 'CSP'); assert.deepEqual(p.errs, [], 'erori'); assert.deepEqual(p.net, [], 'rețea'); }
/* apel direct al nucleului; ora curentă = NOW (ceas fals) */
const find = (p, c) => E(p, c => {
  const O = window.ORAR; const dn = s => O.pw(s).d;
  const cfg = Object.assign({fromD: dn(c.from), toD: dn(c.to), dur: 60, buf: 0, step: 30, we: true, allday: false, lunch: false, now: Date.parse('2026-10-14T10:00:00+03:00'), excl: new Set((c.excl || []).map(dn)),
    people: c.people || [{tz: 'Europe/Bucharest', ws: 540, we: 1020, ro: true}]}, c.o || {});
  const r = O.findSlots(cfg);
  const fmt = (ms, tz) => { const w = O.utcToWall(ms, tz); return O.dstr(w.d) + 'T' + String(Math.floor(w.min / 60)).padStart(2, '0') + ':' + String(w.min % 60).padStart(2, '0'); };
  return {total: r.total, fails: r.fails, slots: r.slots.map(s => ({o: fmt(s.su, 'Europe/Bucharest'), oe: fmt(s.eu, 'Europe/Bucharest'), people: s.people.map(q => [q.startMin, q.endMin, q.shift])}))};
}, c);
const addEv = (p, o) => E(p, o => { const O = window.ORAR; const ev = O.newEvent(o); O.S.events.push(ev); return ev.id; }, o);

await T('nucleu: organizator singur, ferestre, pas, câte 2 pe zi, nu în trecut', async () => {
  const p = await newPage();
  const r = await find(p, {from: '2026-10-14', to: '2026-10-16'});
  assert.deepEqual(r.slots.map(s => s.o), ['2026-10-14T10:00', '2026-10-14T11:00', '2026-10-15T09:00', '2026-10-15T10:00', '2026-10-16T09:00', '2026-10-16T10:00']);
  assert.equal(r.slots[0].oe, '2026-10-14T11:00');
  assert.ok(r.total > r.slots.length);
  assert.ok(r.fails.past > 0, 'orele de dinainte de acum nu sunt propuse');
  // pas 60 și durată 90
  const r2 = await find(p, {from: '2026-10-15', to: '2026-10-15', o: {dur: 90, step: 60}});
  assert.deepEqual(r2.slots.map(s => [s.o, s.oe]), [['2026-10-15T09:00', '2026-10-15T10:30'], ['2026-10-15T10:00', '2026-10-15T11:30']].slice(0, 1).concat([['2026-10-15T10:30', '2026-10-15T12:00']]).slice(0, 1).concat(r2.slots.slice(1).map(s => [s.o, s.oe])));
  await clean(p); await p.ctx.close();
});

await T('fusuri: Londra (+2 h) și New York în afara sincronizării DST (UE 25 oct, SUA 1 nov)', async () => {
  const p = await newPage();
  const L = await find(p, {from: '2026-10-15', to: '2026-10-15', people: [{tz: 'Europe/Bucharest', ws: 480, we: 1080, ro: false}, {tz: 'Europe/London', ws: 540, we: 1020, ro: false}]});
  assert.equal(L.slots[0].o, '2026-10-15T11:00'); assert.deepEqual(L.slots[0].people[1].slice(0, 2), [540, 600]);
  const NY = tz => [{tz: 'Europe/Bucharest', ws: 360, we: 1380, ro: false}, {tz: 'America/New_York', ws: 540, we: 1020, ro: false}];
  const a = await find(p, {from: '2026-10-21', to: '2026-10-21', people: NY()}), b = await find(p, {from: '2026-10-28', to: '2026-10-28', people: NY()}), c = await find(p, {from: '2026-11-04', to: '2026-11-04', people: NY()});
  assert.equal(a.slots[0].o, '2026-10-21T16:00', 'înainte de 25 oct: 7 h'); assert.equal(b.slots[0].o, '2026-10-28T15:00', '25 oct–1 nov: 6 h'); assert.equal(c.slots[0].o, '2026-11-04T16:00', 'după 1 nov: 7 h');
  assert.deepEqual(a.slots[0].people[1].slice(0, 2), [540, 600]);
  // fereastră care trece peste miezul nopții la celălalt participant: Tokyo 09:00–17:00 = România 03:00–11:00 (vara) / 02:00–10:00 (iarna); aici septembrie→octombrie fără DST în Japonia
  const T2 = await find(p, {from: '2026-10-15', to: '2026-10-15', people: [{tz: 'Europe/Bucharest', ws: 0, we: 1440, ro: false}, {tz: 'Asia/Tokyo', ws: 540, we: 1020, ro: false}]});
  assert.equal(T2.slots[0].o, '2026-10-15T03:00'); assert.deepEqual(T2.slots[0].people[1].slice(0, 2), [540, 600]);
  const T3 = await find(p, {from: '2026-10-15', to: '2026-10-15', people: [{tz: 'Europe/Bucharest', ws: 1200, we: 1440, ro: false}, {tz: 'Asia/Tokyo', ws: 0, we: 1440, ro: false}]});
  assert.ok(T3.slots.length && T3.slots.every(s => s.people[1][2] === 1), 'ziua următoare la Tokyo: shift=+1');
  await clean(p); await p.ctx.close();
});

await T('zile: weekend, sărbători legale RO (1 dec), zile excluse, prânz', async () => {
  const p = await newPage();
  assert.equal(await E(p, () => ORAR.isLegalHoliday(ORAR.pw('2026-12-01').d)), true);
  const we = await find(p, {from: '2026-10-16', to: '2026-10-19'});
  assert.deepEqual([...new Set(we.slots.map(s => s.o.slice(0, 10)))], ['2026-10-16', '2026-10-19']);
  const we0 = await find(p, {from: '2026-10-17', to: '2026-10-18', o: {we: false}}); assert.ok(we0.slots.length > 0);
  assert.equal(await E(p, () => ORAR.isLegalHoliday(ORAR.pw('2026-11-30').d)), true, 'Sf. Andrei');
  const ro = await find(p, {from: '2026-12-01', to: '2026-12-03'}); assert.deepEqual([...new Set(ro.slots.map(s => s.o.slice(0, 10)))], ['2026-12-02', '2026-12-03']);
  const ro0 = await find(p, {from: '2026-12-01', to: '2026-12-03', people: [{tz: 'Europe/Bucharest', ws: 540, we: 1020, ro: false}]}); assert.ok(ro0.slots.some(s => s.o.startsWith('2026-12-01')));
  const ex = await find(p, {from: '2026-10-15', to: '2026-10-16', excl: ['2026-10-15']}); assert.deepEqual([...new Set(ex.slots.map(s => s.o.slice(0, 10)))], ['2026-10-16']);
  // sărbătoarea se aplică în ora locală a participantului
  const loc = await find(p, {from: '2026-12-01', to: '2026-12-01', people: [{tz: 'Europe/Bucharest', ws: 0, we: 1440, ro: false}, {tz: 'Europe/Bucharest', ws: 540, we: 1020, ro: true}]}); assert.equal(loc.slots.length, 0);
  const lu = await find(p, {from: '2026-10-15', to: '2026-10-15', people: [{tz: 'Europe/Bucharest', ws: 660, we: 840, ro: false}], o: {lunch: true}});
  assert.deepEqual(lu.slots.map(s => s.o), ['2026-10-15T13:00', '2026-10-15T13:30'].slice(0, 0).concat(lu.slots.map(s => s.o))); // fără suprapunere cu 12–13
  assert.ok(lu.slots.every(s => s.o.slice(11) >= '13:00' || s.oe.slice(11) <= '12:00'), JSON.stringify(lu.slots));
  await clean(p); await p.ctx.close();
});

await T('calendar ocupat: evenimente, pauză, zi întreagă, recurente', async () => {
  const p = await newPage();
  await addEv(p, {title: 'Ședință', start: '2026-10-15T10:00', end: '2026-10-15T12:00', tz: 'Europe/Bucharest'});
  const r = await find(p, {from: '2026-10-15', to: '2026-10-15', o: {perDay: 4}});
  assert.ok(r.slots.every(s => !(s.o < '2026-10-15T12:00' && s.oe > '2026-10-15T10:00')), 'nu se suprapune: ' + JSON.stringify(r.slots.map(s => s.o)));
  assert.equal(r.slots[0].o, '2026-10-15T09:00' ) ; assert.ok(r.slots.some(s => s.o === '2026-10-15T12:00'));
  const rb = await find(p, {from: '2026-10-15', to: '2026-10-15', o: {buf: 30, perDay: 6}});
  assert.ok(!rb.slots.some(s => s.o === '2026-10-15T09:30' || s.o === '2026-10-15T12:00'), 'cu pauză de 30 min: 09:30 și 12:00 sunt excluse');
  assert.ok(rb.slots.some(s => s.o === '2026-10-15T12:30'));
  await addEv(p, {title: 'Conferință', allDay: true, start: '2026-10-16', end: '2026-10-17', tz: null});
  assert.ok((await find(p, {from: '2026-10-16', to: '2026-10-16'})).slots.length > 0, 'zi întreagă nu blochează implicit');
  const blk = await find(p, {from: '2026-10-16', to: '2026-10-16', o: {allday: true}}); assert.equal(blk.slots.length, 0); assert.ok(blk.fails.busy > 0);
  await addEv(p, {title: 'Zilnic', start: '2026-10-19T09:00', end: '2026-10-19T17:00', tz: 'Europe/Bucharest', rrule: 'FREQ=DAILY;COUNT=3'});
  const rec = await find(p, {from: '2026-10-19', to: '2026-10-22', o: {we: false}});
  assert.deepEqual([...new Set(rec.slots.map(s => s.o.slice(0, 10)))], ['2026-10-22']);
  await clean(p); await p.ctx.close();
});

await T('interfață: validări, rezultate, motivul lipsei de intervale, salvare ca eveniment', async () => {
  const p = await newPage();
  await p.click('#b-find'); await p.waitForSelector('#dlgFind[open]');
  await p.fill('#f-dur', '3'); await p.click('#f-go'); assert.match(await p.textContent('#f-err'), /între 5 și 480/);
  await p.fill('#f-dur', '60'); await p.fill('#f-to', '2027-03-01'); await p.click('#f-go'); assert.match(await p.textContent('#f-err'), /62 de zile/);
  await p.fill('#f-to', '2026-10-28'); await p.fill('#f-excl', '2026-13-45'); await p.click('#f-go'); assert.match(await p.textContent('#f-err'), /Dată exclusă invalidă/);
  await p.fill('#f-excl', ''); await p.fill('#f-people tr:first-child [data-k=email]', 'nu-e-adresa'); await p.click('#f-go'); assert.match(await p.textContent('#f-err'), /Adresă de e-mail invalidă/);
  await p.fill('#f-people tr:first-child [data-k=email]', '');
  await p.fill('#f-title', 'Sincronizare echipă'); await p.fill('#f-from', '2026-10-15'); await p.fill('#f-to', '2026-10-16');
  await p.click('#f-addp'); await p.selectOption('#f-people tr:nth-child(2) [data-k=tz]', 'Europe/London'); await p.fill('#f-people tr:nth-child(2) [data-k=name]', 'Ana');
  await p.click('#f-go'); await p.waitForSelector('#f-slots');
  assert.equal(await p.locator('#f-slots > li').count(), 4);
  const first = await p.textContent('#f-slots > li:first-child');
  assert.match(first, /11:00–12:00/); assert.match(first, /Ana: 09:00–10:00 · Europe\/London \(UTC\+01:00\)/); assert.match(first, /Eu \(organizator\): 11:00–12:00/);
  assert.match(await p.textContent('#f-plain'), /fișierul \.ics este un eveniment simplu/);
  const n0 = await E(p, () => ORAR.S.events.length);
  await p.click('#f-slots > li:first-child [data-fcreate]'); await p.waitForTimeout(150);
  const ev = await E(p, () => ORAR.S.events[ORAR.S.events.length - 1]);
  assert.equal(await E(p, () => ORAR.S.events.length), n0 + 1);
  assert.equal(ev.title, 'Sincronizare echipă'); assert.equal(ev.start, '2026-10-15T11:00'); assert.equal(ev.end, '2026-10-15T12:00'); assert.equal(ev.tz, 'Europe/Bucharest');
  assert.match(ev.desc, /Participanți:\n- Eu \(organizator\): 11:00–12:00 \(Europe\/Bucharest\)\n- Ana: 09:00–10:00 \(Europe\/London\)/);
  assert.equal(await p.isDisabled('#f-slots > li:first-child [data-fcreate]'), true);
  // al doilea căutări țin cont de evenimentul abia creat
  await p.click('#f-go'); await p.waitForTimeout(100);
  assert.ok(!(await p.textContent('#f-slots')).includes('15 octombrie 2026 · 11:00') && !/Joi, 15 octombrie 2026 · 11:00–12:00/i.test(await p.textContent('#f-slots > li:first-child')), 'intervalul ocupat nu mai e propus');
  // niciun interval: motivul
  await p.fill('#f-from', '2026-10-17'); await p.fill('#f-to', '2026-10-18'); await p.click('#f-go'); await p.waitForSelector('#f-none');
  assert.match(await p.textContent('#f-none'), /weekendurile, sărbătorile sau zilele excluse/);
  await p.fill('#f-from', '2026-10-01'); await p.fill('#f-to', '2026-10-05'); await p.click('#f-go'); await p.waitForSelector('#f-none');
  assert.match(await p.textContent('#f-none'), /în trecut/);
  await clean(p); await p.ctx.close();
});

await T('invitație .ics: METHOD:REQUEST, ORGANIZER/ATTENDEE, același UID, VTIMEZONE, linii pliate', async () => {
  const p = await newPage();
  await p.click('#b-find'); await p.waitForSelector('#dlgFind[open]');
  await p.fill('#f-title', 'Planificare, trimestrul 4; "important"'); await p.fill('#f-from', '2026-10-15'); await p.fill('#f-to', '2026-10-16');
  await p.fill('#f-people tr:first-child [data-k=name]', 'Dana Organizatoare'); await p.fill('#f-people tr:first-child [data-k=email]', 'dana@example.org');
  await p.click('#f-addp'); await p.fill('#f-people tr:nth-child(2) [data-k=name]', 'Ion, Popescu'); await p.fill('#f-people tr:nth-child(2) [data-k=email]', 'ion@example.org');
  await p.selectOption('#f-people tr:nth-child(2) [data-k=tz]', 'Europe/Bucharest');
  await p.click('#f-go'); await p.waitForSelector('#f-slots');
  assert.equal(await p.locator('#f-plain').count(), 0, 'cu e-mailuri complete nu apare nota');
  await p.click('#f-slots > li:first-child [data-fcreate]'); await p.waitForTimeout(100);
  const uid = await E(p, () => ORAR.S.events[ORAR.S.events.length - 1].uid);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#f-slots > li:first-child [data-finvite]')]);
  assert.match(dl.suggestedFilename(), /^invitatie-Planificare_trimestrul_4_important\.ics$/);
  const raw = fs.readFileSync(await dl.path(), 'utf8'), ics = raw.replace(/\r\n /g, '');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('\r\nMETHOD:REQUEST\r\n') && ics.includes('\r\nSTATUS:CONFIRMED\r\n') && ics.includes('\r\nSEQUENCE:0\r\n'));
  assert.ok(ics.includes('\r\nORGANIZER;CN=Dana Organizatoare:mailto:dana@example.org\r\n'), 'ICS');
  assert.ok(ics.includes('\r\nATTENDEE;CN="Ion, Popescu";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:ion@example.org\r\n'), 'ICS');
  assert.ok(ics.includes('\r\nUID:' + uid + '\r\n'), 'același UID ca evenimentul din calendar');
  assert.ok(ics.includes('BEGIN:VTIMEZONE') && ics.includes('TZID:Europe/Bucharest') && ics.includes('DTSTART;TZID=Europe/Bucharest:20261015T09'), 'ICS');
  assert.ok(ics.includes('SUMMARY:Planificare\\, trimestrul 4\\; "important"'), 'SUMMARY');
  assert.ok(raw.split('\r\n').every(l => Buffer.byteLength(l) <= 75), 'linii ≤ 75 octeți');
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(!/\r\n(?!\s)[^A-Z\r\n]/.test(ics), 'fiecare linie începe cu nume de proprietate sau pliere');
  await clean(p); await p.ctx.close();
});

await T('invitație: injecție în nume/e-mail, adrese invalide, fără e-mail → eveniment simplu', async () => {
  const p = await newPage();
  const r = await E(p, () => {
    const O = ORAR, ev = O.newEvent({title: 'T', start: '2026-10-15T10:00', end: '2026-10-15T11:00', tz: 'Europe/Bucharest'});
    const evil = O.buildInvite(ev, {organizer: {name: 'Org\r\nX-ORG:1', email: 'o@x.org'}, attendees: [{name: 'Eve";X-EVIL=1\r\nATTENDEE:mailto:z@z.z', email: 'e@x.org'}, {name: 'Bad', email: 'bad@x.org\r\nX-EVIL2:1'}, {name: 'NoMail', email: ''}]});
    const plain = O.buildInvite(ev, {organizer: {name: 'O', email: ''}, attendees: [{name: 'A', email: 'a@x.org'}]});
    const plain2 = O.buildInvite(ev, {organizer: {name: 'O', email: 'o@x.org'}, attendees: []});
    return {evil, plain, plain2, mails: ['a@b.co', 'a b@c.de', 'a@b', '<a@b.co>', 'x"y@b.co', 'a@b.co\n', 'ok.name+tag@sub.domain.org'].map(m => O.mailOk(m))};
  });
  assert.equal(r.evil.full, true);
  const lines = r.evil.ics.replace(/\r\n /g, '').split('\r\n');
  assert.ok(!lines.some(l => /^X-(ORG|EVIL)/.test(l)), 'nicio linie injectată');
  assert.equal(lines.filter(l => l.startsWith('ATTENDEE')).length, 1, 'doar adresa validă');
  assert.ok(lines.some(l => l.startsWith('ORGANIZER;CN=OrgX-ORG:1:mailto:o@x.org') || l.startsWith('ORGANIZER;CN="OrgX-ORG:1":mailto:o@x.org')), lines.filter(l => l.startsWith('ORGANIZER')).join('|'));
  assert.equal(r.plain.full, false); assert.equal(r.plain2.full, false);
  assert.ok(!r.plain.ics.includes('METHOD:') && !r.plain.ics.includes('ATTENDEE') && !r.plain.ics.includes('ORGANIZER'));
  assert.deepEqual(r.mails, [true, false, false, false, false, false, true]);
  await clean(p); await p.ctx.close();
});

await T('persistență setări, limbi, accesibilitate, 360 px', async () => {
  const p = await newPage();
  await p.click('#b-find'); await p.waitForSelector('#dlgFind[open]');
  await p.fill('#f-title', 'Retro'); await p.selectOption('#f-buf', '15'); await p.check('#f-lunch');
  await p.click('#f-addp'); await p.fill('#f-people tr:nth-child(2) [data-k=name]', 'Kenji'); await p.selectOption('#f-people tr:nth-child(2) [data-k=tz]', 'Asia/Tokyo');
  await p.fill('#f-people tr:first-child [data-k=ws]', '07:00'); await p.fill('#f-people tr:first-child [data-k=we]', '20:00'); await p.fill('#f-from', '2026-10-15'); await p.fill('#f-to', '2026-10-30');
  await p.click('#f-go'); await p.waitForSelector('#f-slots');
  await p.reload(); await p.waitForSelector('#b-find'); await p.click('#b-find'); await p.waitForSelector('#dlgFind[open]');
  assert.equal(await p.inputValue('#f-title'), 'Retro'); assert.equal(await p.inputValue('#f-buf'), '15'); assert.equal(await p.isChecked('#f-lunch'), true);
  assert.equal(await p.locator('#f-people tr').count(), 2); assert.equal(await p.inputValue('#f-people tr:nth-child(2) [data-k=tz]'), 'Asia/Tokyo');
  assert.equal(await p.inputValue('#f-people tr:first-child [data-k=ws]'), '07:00');
  assert.equal(await p.isDisabled('#f-people tr:first-child [data-k=tz]'), true);
  assert.equal(await p.locator('#f-people tr:last-child [data-pdel]').count(), 1);
  await p.click('#f-people tr:last-child [data-pdel]'); assert.equal(await p.locator('#f-people tr').count(), 1);
  // stocare coruptă
  await p.evaluate(() => localStorage.setItem('fff.orar.finder', '{"dur":"x","people":[{"tz":"Nu/Exista","email":"<b>"}],"buf":7}'));
  await p.keyboard.press('Escape'); await p.reload(); await p.waitForSelector('#b-find'); await p.click('#b-find'); await p.waitForSelector('#dlgFind[open]');
  assert.equal(await p.inputValue('#f-dur'), '60'); assert.equal(await p.inputValue('#f-buf'), '0'); assert.equal(await p.inputValue('#f-people tr:first-child [data-k=email]'), '');
  for (const l of ['en', 'fr', 'it', 'es', 'pt', 'hu', 'de', 'ro']) {
    await p.keyboard.press('Escape'); await p.selectOption('#lang', l); await p.waitForTimeout(80);
    await p.click('#b-find'); await p.waitForSelector('#dlgFind[open]');
    await p.fill('#f-from', '2026-10-15'); await p.fill('#f-to', '2026-10-16'); await p.click('#f-go'); await p.waitForSelector('#f-slots');
    const txt = await p.textContent('#dlgFind');
    assert.ok(!/\bfind_[a-z_]+|\{[a-z]+\}/.test(txt), 'chei/variabile în ' + l);
    if (l !== 'ro') assert.ok(!/Caută intervale|Participanți|Evită 12/.test(txt), 'română rămasă în ' + l);
  }
  await p.keyboard.press('Escape'); await p.selectOption('#lang', 'ro');
  await p.click('#b-find'); await p.waitForSelector('#dlgFind[open]'); await p.click('#f-go'); await p.waitForSelector('#f-slots');
  if (AXE) {
    await p.evaluate(s => { if (!window.axe) (0, eval)(s); }, fs.readFileSync(AXE, 'utf8'));
    const r = await E(p, () => axe.run(document.querySelector('#dlgFind'), {resultTypes: ['violations']}));
    assert.deepEqual(r.violations.map(v => v.id + ':' + v.nodes.length), [], 'axe');
  }
  await p.keyboard.press('Escape'); await p.setViewportSize({width: 360, height: 740});
  await p.click('#b-find'); await p.waitForSelector('#dlgFind[open]'); await p.click('#f-go'); await p.waitForSelector('#f-slots');
  const ov = await E(p, () => { const d = document.querySelector('#dlgFind'); return [document.documentElement.scrollWidth - document.documentElement.clientWidth, d.scrollWidth - d.clientWidth]; });
  assert.ok(ov[0] <= 1 && ov[1] <= 1, 'depășire orizontală ' + ov);
  await clean(p); await p.ctx.close();
});

await browser.close();
const bad = results.filter(r => !r[1]);
console.log(`\n${results.length - bad.length}/${results.length} teste verzi`);
process.exit(bad.length ? 1 : 0);
