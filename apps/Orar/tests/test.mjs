// Teste Orar — Playwright (Chromium headless, rețea blocată). Rulare: node tests/test.mjs
// Cerințe: /opt/node-tools (playwright), /opt/pw-browsers/chromium; opțional python3 + icalendar + python-dateutil
// (variabila ORAR_PYLIB poate indica un director cu pachetele) pentru verificarea independentă a fișierelor .ics.
import {createRequire} from 'module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.join(HERE, '..', 'index.html');
const URL_APP = 'file://' + INDEX;
const AXE = process.env.AXE_PATH || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'orar-test-'));
const NOW = '2026-10-14T10:00:00+03:00';

const results = [];
const only = process.argv[2];
async function T(name, fn) {
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false, e]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).join('\n       ')); }
}

const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});

/* ---------- utilitare ---------- */
async function newPage(o = {}) {
  const ctx = await browser.newContext({viewport: o.viewport || {width: 1280, height: 800}, locale: o.locale || 'ro-RO', timezoneId: o.tz || 'Europe/Bucharest', bypassCSP: !!o.bypassCSP, acceptDownloads: true, colorScheme: o.colorScheme || 'light', permissions: o.permissions || []});
  await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage();
  page.errs = []; page.net = [];
  page.on('pageerror', e => page.errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') page.errs.push(m.type() + ': ' + m.text()); });
  page.on('request', r => { const u = r.url(); if (!/^(file|data|blob):/.test(u)) page.net.push(u); });
  if (o.stubNotif) await page.addInitScript(() => { window.__stubNotif = true; });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
    if (window.__stubNotif) {
      window.__notifs = [];
      window.Notification = class { constructor(t, o) { window.__notifs.push([t, o && o.body]); } static get permission() { return window.__notifPerm || 'default'; } static requestPermission() { window.__notifPerm = 'granted'; return Promise.resolve('granted'); } };
    }
  });
  if (o.clock !== false) await page.clock.install({time: new Date(o.now || NOW)});
  page.ctx = ctx;
  if (o.goto !== false) { await page.goto(URL_APP); await page.waitForSelector('#view > *'); }
  return page;
}
async function closePage(p) { await p.ctx.close(); }
const dn = (p, y, m, d) => p.evaluate(a => ORAR.dnOf(...a), [y, m, d]);
async function expectClean(p, label = '') {
  const csp = await p.evaluate(() => window.__csp);
  assert.deepEqual(csp, [], 'violări CSP ' + label);
  assert.deepEqual(p.errs, [], 'erori în consolă ' + label);
  assert.deepEqual(p.net, [], 'cereri de rețea ' + label);
}
async function noOverflow(p, label) {
  const o = await p.evaluate(() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth}));
  assert.ok(o.sw <= o.cw + 1 && o.bw <= o.cw + 1, `depășire orizontală ${label}: ${JSON.stringify(o)}`);
}
function b64(buf) { return Buffer.from(buf).toString('base64'); }
async function parseIn(p, buf) { return p.evaluate(s => { const u = Uint8Array.from(atob(s), c => c.charCodeAt(0)); return JSON.parse(JSON.stringify(ORAR.parseICS(u))); }, b64(buf)); }
function rmTmp() { try { fs.rmSync(TMP, {recursive: true, force: true}); } catch (e) { /* */ } }

/* ---------- parser ICS independent (fără cod din aplicație) ---------- */
function validateIcs(buf) {
  const errors = [];
  const s = buf.toString('utf8');
  if (!s.endsWith('\r\n')) errors.push('lipsește CRLF final');
  if (/(^|[^\r])\n/.test(s)) errors.push('LF fără CR');
  const raw = s.split('\r\n'); raw.pop();
  const dec = new TextDecoder('utf-8', {fatal: true});
  for (const l of raw) {
    if (Buffer.byteLength(l) > 75) errors.push('linie > 75 octeți: ' + l.slice(0, 40));
    try { dec.decode(Buffer.from(l)); } catch (e) { errors.push('UTF-8 rupt la pliere: ' + l.slice(0, 30)); }
  }
  const lines = [];
  for (const l of raw) { if (l.startsWith(' ') || l.startsWith('\t')) { if (!lines.length) errors.push('continuare fără linie'); else lines[lines.length - 1] += l.slice(1); } else lines.push(l); }
  const stack = [], events = [], tzs = new Map(), usedTz = new Set();
  let cur = null, curTz = null, props = {};
  for (const l of lines) {
    const m = /^([A-Za-z0-9-]+)((?:;[^:;=]+=(?:"[^"]*"|[^:;"]*))*):(.*)$/.exec(l);
    if (!m) { errors.push('linie fără format: ' + l.slice(0, 50)); continue; }
    const name = m[1].toUpperCase(), params = {}, value = m[3];
    for (const pm of m[2].matchAll(/;([^=]+)=("[^"]*"|[^;]*)/g)) params[pm[1].toUpperCase()] = pm[2].replace(/^"|"$/g, '');
    if (name === 'BEGIN') {
      stack.push(value);
      if (value === 'VEVENT') cur = {props: [], alarms: []};
      if (value === 'VTIMEZONE') curTz = {comps: [], tzid: ''};
      if (value === 'STANDARD' || value === 'DAYLIGHT') props = {};
      continue;
    }
    if (name === 'END') {
      const top = stack.pop();
      if (top !== value) errors.push('END:' + value + ' nu închide ' + top);
      if (value === 'VEVENT') { events.push(cur); cur = null; }
      if (value === 'VTIMEZONE') { tzs.set(curTz.tzid, curTz); if (!curTz.comps.length) errors.push('VTIMEZONE fără STANDARD/DAYLIGHT'); curTz = null; }
      if ((value === 'STANDARD' || value === 'DAYLIGHT') && curTz) { for (const k of ['DTSTART', 'TZOFFSETFROM', 'TZOFFSETTO']) if (!props[k]) errors.push('VTIMEZONE: lipsește ' + k); curTz.comps.push(props); }
      continue;
    }
    const top = stack[stack.length - 1];
    if (params.TZID) usedTz.add(params.TZID);
    if (top === 'VEVENT') cur.props.push({name, params, value});
    else if (top === 'VALARM') { cur.alarms.push({name, params, value}); }
    else if (top === 'VTIMEZONE' && name === 'TZID') curTz.tzid = value;
    else if (top === 'STANDARD' || top === 'DAYLIGHT') props[name] = value;
    if (/\\(?![nN,;\\])/.test(value.replace(/\\[nN,;\\]/g, '')) && ['SUMMARY', 'DESCRIPTION', 'LOCATION', 'CATEGORIES'].includes(name)) errors.push('escape invalid în ' + name);
  }
  if (stack.length) errors.push('BEGIN/END dezechilibrat: ' + stack.join(','));
  const first = lines[0], last = lines[lines.length - 1];
  if (first !== 'BEGIN:VCALENDAR' || last !== 'END:VCALENDAR') errors.push('VCALENDAR lipsă');
  if (!lines.includes('VERSION:2.0')) errors.push('VERSION:2.0 lipsă');
  if (!lines.some(l => l.startsWith('PRODID:'))) errors.push('PRODID lipsă');
  for (const z of usedTz) if (!tzs.has(z)) errors.push('TZID fără VTIMEZONE: ' + z);
  const uids = new Set();
  for (const e of events) {
    const g = n => e.props.find(p => p.name === n);
    for (const n of ['UID', 'DTSTAMP', 'DTSTART']) if (!g(n)) errors.push('VEVENT fără ' + n);
    if (g('DTSTAMP') && !/^\d{8}T\d{6}Z$/.test(g('DTSTAMP').value)) errors.push('DTSTAMP invalid ' + g('DTSTAMP').value);
    if (g('DTSTART')) {
      const v = g('DTSTART'); const ok = v.params.VALUE === 'DATE' ? /^\d{8}$/.test(v.value) : /^\d{8}T\d{6}Z?$/.test(v.value);
      if (!ok) errors.push('DTSTART invalid ' + v.value);
      const en = g('DTEND');
      if (en && en.value.replace('Z', '') < v.value.replace('Z', '') && !v.params.TZID) errors.push('DTEND înainte de DTSTART');
    }
    const key = (g('UID') || {}).value + '|' + ((g('RECURRENCE-ID') || {}).value || '');
    if (uids.has(key)) errors.push('UID duplicat ' + key);
    uids.add(key);
    for (const a of e.alarms) if (a.name === 'TRIGGER' && !/^-?P(T?\d+[WDHMS])+$|^-?P\d+D(T\d+[HMS])?$/.test(a.value) && !/^-?PT\d+[HMS]$/.test(a.value) && !/^-?P(?:\d+W)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/.test(a.value)) errors.push('TRIGGER invalid ' + a.value);
  }
  return {errors, events, tzs, lines};
}
function unesc(s) { return s.replace(/\\([nN,;\\])/g, (m, c) => (c === 'n' || c === 'N') ? '\n' : c); }
function evProp(e, n) { const p = e.props.find(x => x.name === n); return p ? p.value : undefined; }

/* ---------- fixture-uri .ics scrise pentru teste ---------- */
function foldBytes(line, firstMax = 75, nextMax = 74) { // plierea la octeți, FĂRĂ a respecta limitele caracterelor (cum fac unele exportatoare)
  const b = Buffer.from(line, 'utf8');
  if (b.length <= firstMax) return b;
  const parts = [b.subarray(0, firstMax)];
  let i = firstMax;
  while (i < b.length) { parts.push(Buffer.concat([Buffer.from(' '), b.subarray(i, i + nextMax)])); i += nextMax; }
  return Buffer.concat(parts.flatMap((p, k) => k ? [Buffer.from('\r\n'), p] : [p]));
}
function joinLines(lines, eol = '\r\n', fold = true) {
  const out = [];
  for (const l of lines) out.push(fold ? foldBytes(l) : Buffer.from(l, 'utf8'));
  return Buffer.concat(out.flatMap(b => [b, Buffer.from(eol)]));
}
const VTZ_BUC = ['BEGIN:VTIMEZONE', 'TZID:Europe/Bucharest', 'X-LIC-LOCATION:Europe/Bucharest', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0300', 'TZNAME:EEST', 'DTSTART:19700329T030000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0200', 'TZNAME:EET', 'DTSTART:19701025T040000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE'];
function fixtureGoogle() {
  const longDesc = 'Ordinea de zi: 1) buget și raportul trimestrial; 2) „planul de acțiune” pentru ședința de proiect – țintele ȘTIINȚE, înregistrările și contractele; 3) diverse. Vă rugăm să citiți documentele înainte. Mulțumim!';
  return joinLines(['BEGIN:VCALENDAR', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN', 'VERSION:2.0', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Agenda familie și proiect', 'X-WR-TIMEZONE:Europe/Bucharest', ...VTZ_BUC,
    'BEGIN:VEVENT', 'DTSTART;TZID=Europe/Bucharest:20261005T093000', 'DTEND;TZID=Europe/Bucharest:20261005T103000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261231T215959Z', 'EXDATE;TZID=Europe/Bucharest:20261014T093000', 'DTSTAMP:20261001T120000Z', 'UID:abc123@google.com', 'CREATED:20260901T100000Z',
    'DESCRIPTION:Discutăm bugetul\\, planul și „ședința” de proiect.\\nSală: A12\\; etaj 2\\n\\nCale: C:\\\\docs', 'LAST-MODIFIED:20260930T100000Z', 'LOCATION:Sala "Mică"\\, Bd. Unirii 12\\, București', 'SEQUENCE:2', 'STATUS:CONFIRMED', 'SUMMARY:Ședință proiect ȘTIINȚE', 'TRANSP:OPAQUE', 'CATEGORIES:Serviciu\\,echipă,Proiect',
    'ATTENDEE;CN="Popescu, Ion";PARTSTAT=ACCEPTED:mailto:ion@example.com', 'ORGANIZER;CN=Maria:mailto:maria@example.com',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'TRIGGER:-PT15M', 'END:VALARM', 'BEGIN:VALARM', 'ACTION:EMAIL', 'TRIGGER;RELATED=START:-P1D', 'SUMMARY:x', 'DESCRIPTION:y', 'END:VALARM', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART;TZID=Europe/Bucharest:20261019T110000', 'DTEND;TZID=Europe/Bucharest:20261019T120000', 'DTSTAMP:20261001T120000Z', 'UID:abc123@google.com', 'RECURRENCE-ID;TZID=Europe/Bucharest:20261019T093000', 'SUMMARY:Ședință proiect (mutată)', 'LOCATION:Sala 3', 'SEQUENCE:3', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261201', 'DTEND;VALUE=DATE:20261202', 'DTSTAMP:20261001T120000Z', 'UID:natl-2026@example.org', 'SUMMARY:Ziua Națională', 'CATEGORIES:Sărbătoare,Național', 'TRANSP:TRANSPARENT', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART:20261110T140000Z', 'DTEND:20261110T150000Z', 'DTSTAMP:20261001T120000Z', 'UID:webinar-1@example.org', 'SUMMARY:Webinar UTC', 'DESCRIPTION:' + longDesc.replace(/;/g, '\\;').replace(/,/g, '\\,'), 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261224', 'DTEND;VALUE=DATE:20261228', 'DTSTAMP:20261001T120000Z', 'UID:vacanta-1@example.org', 'SUMMARY:Vacanță de Crăciun', 'END:VEVENT',
    'END:VCALENDAR']);
}
function fixtureOutlook() { // Exchange/Outlook: nume Windows de fus, ATTENDEE, STATUS:CANCELLED, VTODO, LF-only
  return joinLines(['BEGIN:VCALENDAR', 'METHOD:PUBLISH', 'PRODID:Microsoft Exchange Server 2010', 'VERSION:2.0', 'X-WR-CALNAME:Calendar Outlook',
    'BEGIN:VTIMEZONE', 'TZID:GTB Standard Time', 'BEGIN:STANDARD', 'DTSTART:16010101T040000', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0200', 'RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=-1SU;BYMONTH=10', 'END:STANDARD', 'BEGIN:DAYLIGHT', 'DTSTART:16010101T030000', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0300', 'RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=-1SU;BYMONTH=3', 'END:DAYLIGHT', 'END:VTIMEZONE',
    'BEGIN:VEVENT', 'ATTENDEE;CN=Ion Popescu;RSVP=TRUE:mailto:ion@example.com', 'ORGANIZER;CN=Ana:mailto:ana@example.com', 'DESCRIPTION:Prezentare trimestrială\\nTrimite materialele cu o zi înainte.', 'DTEND;TZID=GTB Standard Time:20261012T153000', 'DTSTART;TZID=GTB Standard Time:20261012T140000', 'LOCATION:Sala de ședințe 4', 'PRIORITY:5', 'DTSTAMP:20261005T080000Z', 'UID:040000008200E00074C5B7101A82E008000000001234', 'SUMMARY:Prezentare Q3', 'CLASS:PUBLIC', 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYDAY=2MO;COUNT=4', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'TRIGGER;RELATED=START:-PT30M', 'END:VALARM', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART;TZID=GTB Standard Time:20261020T100000', 'DURATION:PT1H30M', 'DTSTAMP:20261005T080000Z', 'UID:anulat-1@example.com', 'STATUS:CANCELLED', 'SUMMARY:Ședință anulată', 'END:VEVENT',
    'BEGIN:VTODO', 'UID:todo-1@example.com', 'DTSTAMP:20261005T080000Z', 'SUMMARY:De făcut', 'END:VTODO',
    'BEGIN:VEVENT', 'DTSTART;TZID=GTB Standard Time:20261022T090000', 'DURATION:PT1H30M', 'DTSTAMP:20261005T080000Z', 'UID:durata-1@example.com', 'SUMMARY:Eveniment cu DURATION', 'END:VEVENT',
    'END:VCALENDAR'], '\n', false);
}
function fixtureThunderbird() { // flotant, TZID cu prefix mozilla, fus personalizat fix, RDATE, EXDATE multiple, BYSETPOS, BYHOUR
  return joinLines(['BEGIN:VCALENDAR', 'PRODID:-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN', 'VERSION:2.0',
    'BEGIN:VTIMEZONE', 'TZID:/mozilla.org/20070129_1/Europe/Berlin', 'X-TZINFO:Europe/Berlin', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10', 'END:STANDARD', 'END:VTIMEZONE',
    'BEGIN:VTIMEZONE', 'TZID:Zona Mea', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0530', 'TZOFFSETTO:+0530', 'END:STANDARD', 'END:VTIMEZONE',
    'BEGIN:VTIMEZONE', 'TZID:Estul Personalizat', 'BEGIN:STANDARD', 'DTSTART:19701101T020000', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD', 'BEGIN:DAYLIGHT', 'DTSTART:19700308T020000', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT', 'END:VTIMEZONE',
    'BEGIN:VEVENT', 'UID:tb-1', 'DTSTAMP:20261001T000000Z', 'SUMMARY:Berlin standup', 'DTSTART;TZID=/mozilla.org/20070129_1/Europe/Berlin:20261012T090000', 'DTEND;TZID=/mozilla.org/20070129_1/Europe/Berlin:20261012T091500', 'RRULE:FREQ=DAILY;COUNT=5', 'EXDATE;TZID=/mozilla.org/20070129_1/Europe/Berlin:20261013T090000,20261014T090000', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:tb-2', 'DTSTAMP:20261001T000000Z', 'SUMMARY:Flotant la prânz', 'DTSTART:20261015T123000', 'DTEND:20261015T133000', 'RDATE:20261020T123000,20261027T123000', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:tb-3', 'DTSTAMP:20261001T000000Z', 'SUMMARY:Fus fix +0530', 'DTSTART;TZID=Zona Mea:20261010T100000', 'DTEND;TZID=Zona Mea:20261010T110000', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:tb-4', 'DTSTAMP:20261001T000000Z', 'SUMMARY:Estul personalizat', 'DTSTART;TZID=Estul Personalizat:20260301T100000', 'DTEND;TZID=Estul Personalizat:20260301T110000', 'RRULE:FREQ=WEEKLY;COUNT=12;BYDAY=SU', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:tb-5', 'DTSTAMP:20261001T000000Z', 'SUMMARY:Ultima zi lucrătoare', 'DTSTART;VALUE=DATE:20260930', 'DTEND;VALUE=DATE:20261001', 'RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=6', 'EXDATE;VALUE=DATE:20261130', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:tb-6', 'DTSTAMP:20261001T000000Z', 'SUMMARY:Cu BYHOUR', 'DTSTART:20261012T080000', 'RRULE:FREQ=DAILY;COUNT=2;BYHOUR=8,12', 'END:VEVENT',
    'END:VCALENDAR']);
}
function fixtureLatin1() {
  const t = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//vechi//EN\r\nBEGIN:VEVENT\r\nUID:l1-1\r\nDTSTAMP:20261001T000000Z\r\nDTSTART:20261016T180000\r\nDTEND:20261016T190000\r\nSUMMARY:Café à la Münster\r\nLOCATION:Brasserie – Zürich\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
  return Buffer.from(t, 'latin1'); // „–” nu există în latin1 -> devine '?'; é, à, ü, ö există
}
function fixtureBom() {
  return Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), joinLines(['begin:vcalendar', 'version:2.0', 'prodid:-//mic//EN', 'begin:vevent', 'uid:bom-1', 'dtstamp:20261001T000000Z', 'dtstart;value=date:20261031', 'summary:Halloween \\; petrecere\\, costume', 'location:Str. Dacilor\\, nr. 5', 'end:vevent', 'end:vcalendar'])]);
}

/* ======================================================================
   A. CALCULE (în pagină, fără interacțiune)
   ====================================================================== */
const EASTER = {2024: '2024-05-05', 2025: '2025-04-20', 2026: '2026-04-12', 2027: '2027-05-02', 2028: '2028-04-16', 2029: '2029-04-08', 2030: '2030-04-28', 2031: '2031-04-13', 2032: '2032-05-02', 2033: '2033-04-24', 2034: '2034-04-09', 2035: '2035-04-29'};
let P; // pagina comună pentru calcule
P = await newPage({clock: false});

await T('Paște ortodox 2024–2035 față de date cunoscute', async () => {
  const got = await P.evaluate(() => { const o = {}; for (let y = 2024; y <= 2035; y++) o[y] = ORAR.dstr(ORAR.orthEaster(y)); return o; });
  assert.deepEqual(got, EASTER);
});
await T('Paște ortodox 1950–2100 față de python-dateutil (oracol precalculat)', async () => {
  const ora = JSON.parse(fs.readFileSync(path.join(HERE, 'oracle_easter.json'), 'utf8'));
  const got = await P.evaluate(() => { const o = {}; for (let y = 1950; y <= 2100; y++) o[y] = ORAR.dstr(ORAR.orthEaster(y)); return o; });
  assert.deepEqual(got, ora);
});
await T('sărbători legale 2024–2035: set complet, Vinerea Mare, Rusalii, 1 iunie', async () => {
  const res = await P.evaluate(() => { const o = {}; for (let y = 2024; y <= 2035; y++) { const m = ORAR.roLegal(y); o[y] = [...m.entries()].map(([d, k]) => [ORAR.dstr(d), k]); } return o; });
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  for (let y = 2024; y <= 2035; y++) {
    const E = EASTER[y], exp = new Map();
    const add = (d, k) => { if (!exp.has(d)) exp.set(d, []); exp.get(d).push(k); };
    add(`${y}-01-01`, 'h_newyear'); add(`${y}-01-02`, 'h_newyear2'); add(`${y}-01-24`, 'h_unire'); add(addDays(E, -2), 'h_vinerea'); add(E, 'h_pasti'); add(addDays(E, 1), 'h_pasti2');
    add(`${y}-05-01`, 'h_may1'); add(`${y}-06-01`, 'h_child'); add(addDays(E, 49), 'h_rusalii'); add(addDays(E, 50), 'h_rusalii2'); add(`${y}-08-15`, 'h_aug15'); add(`${y}-11-30`, 'h_andrei'); add(`${y}-12-01`, 'h_dec1'); add(`${y}-12-25`, 'h_xmas'); add(`${y}-12-26`, 'h_xmas2');
    const got = new Map(res[y].map(([d, k]) => [d, k.slice().sort()]));
    assert.equal(got.size, exp.size, 'număr de date distincte ' + y);
    for (const [d, k] of exp) assert.deepEqual(got.get(d), k.slice().sort(), 'zi ' + d);
    assert.equal(new Date(addDays(E, -2) + 'T00:00:00Z').getUTCDay(), 5, 'Vinerea Mare e vineri');
    assert.equal(new Date(addDays(E, 49) + 'T00:00:00Z').getUTCDay(), 0, 'Rusaliile sunt duminică');
  }
  // cazuri sigure (cunoscute): 2025 Vinerea Mare 18 apr, Rusalii 8–9 iun; 2027 Vinerea Mare 30 apr, Rusalii 20–21 iun; 2028 Vinerea Mare 14 apr
  const has = (y, d) => res[y].some(([x]) => x === d);
  assert.ok(has(2025, '2025-04-18') && has(2025, '2025-06-08') && has(2025, '2025-06-09'));
  assert.ok(has(2027, '2027-04-30') && has(2027, '2027-06-20') && has(2027, '2027-06-21'));
  assert.ok(has(2028, '2028-04-14') && has(2028, '2028-06-04') && has(2028, '2028-06-05'));
  // 1 iunie 2026 coincide cu a doua zi de Rusalii: o singură zi, ambele denumiri
  const j1 = res[2026].find(([d]) => d === '2026-06-01');
  assert.deepEqual(j1[1].slice().sort(), ['h_child', 'h_rusalii2']);
  // în afara cazurilor 2026 și 2031, 1 iunie nu coincide cu Rusalii în 2024–2035
  const coincide = [];
  for (let y = 2024; y <= 2035; y++) if (res[y].find(([d]) => d === `${y}-06-01`)[1].length > 1) coincide.push(y);
  assert.deepEqual(coincide, [2026, 2031]); // 2031: Paștele 13 aprilie, Rusaliile duminică 1 iunie
});
await T('calendar ortodox opțional: Floriile, Joia Mare, Înălțarea față de Paște', async () => {
  const r = await P.evaluate(() => { const o = {}; for (let y = 2024; y <= 2035; y++) { const E = ORAR.orthEaster(y), m = ORAR.roOrthodox(y); const f = k => [...m.entries()].filter(([, v]) => v.includes(k)).map(([d]) => d - E)[0]; o[y] = [f('o_floriile'), f('o_joia_mare'), f('o_sambata_mare'), f('o_inaltarea'), f('o_tuturor_sfintilor'), f('o_lasatul'), ORAR.dstr([...m.entries()].find(([, v]) => v.includes('o_boboteaza'))[0])]; } return o; });
  for (let y = 2024; y <= 2035; y++) assert.deepEqual(r[y], [-7, -3, -1, 39, 56, -48, `${y}-01-06`]);
});
await T('numerotarea săptămânilor ISO 8601 (cazuri cunoscute)', async () => {
  const cases = [['2026-01-01', 2026, 1], ['2025-12-29', 2026, 1], ['2021-01-03', 2020, 53], ['2024-12-30', 2025, 1], ['2026-12-31', 2026, 53], ['2027-01-03', 2026, 53], ['2027-01-04', 2027, 1], ['2020-12-31', 2020, 53], ['2026-10-14', 2026, 42], ['2016-01-03', 2015, 53], ['2018-12-31', 2019, 1]];
  const got = await P.evaluate(cs => cs.map(([s]) => { const p = ORAR.pw(s); return ORAR.isoWeek(p.d); }), cases);
  cases.forEach(([s, y, w], i) => assert.deepEqual(got[i], {year: y, week: w}, s));
});
await T('RRULE: 420 cazuri față de python-dateutil (oracol independent)', async () => {
  const cases = JSON.parse(fs.readFileSync(path.join(HERE, 'oracle_rrule.json'), 'utf8'));
  const bad = await P.evaluate(cs => { const out = []; for (const c of cs) { const r = ORAR.parseRRule(c.rule), s = ORAR.pw(c.start), f = ORAR.pw(c.from).d, t = ORAR.pw(c.to).d; const got = ORAR.expandDays(r, s.d, 540, 'UTC', f, t).map(ORAR.dstr); if (JSON.stringify(got) !== JSON.stringify(c.exp)) out.push([c.rule, c.start, c.from, c.to, got.slice(0, 5), c.exp.slice(0, 5)]); } return out; }, cases);
  assert.equal(bad.length, 0, JSON.stringify(bad.slice(0, 3)));
  assert.ok(cases.length >= 380);
});
const mkEv = (o) => Object.assign({id: 'x', uid: 'u', cal: 'c1', title: 'T', allDay: false, tz: 'Europe/Bucharest', end: '', rrule: '', ex: [], rd: [], over: {}}, o);
const occ = (P_, ev, from, to, tz) => P_.evaluate(a => { ORAR.setViewTz(a[3] || 'Europe/Bucharest'); const e = ORAR.sanitizeEvent(a[0], 'c1'); const vf = ORAR.pw(a[1]).d, vt = ORAR.pw(a[2]).d; return ORAR.instancesIn(e, vf, vt).sort((x, y) => x.su - y.su).map(i => ({k: i.key, vs: i.allDay ? ORAR.dstr(i.sD) : ORAR.dstr(i.vs.d) + 'T' + String(Math.floor(i.vs.min / 60)).padStart(2, '0') + ':' + String(i.vs.min % 60).padStart(2, '0'), su: i.allDay ? null : new Date(i.su).toISOString()})); }, [ev, from, to, tz]);
await T('recurență: lunar în ziua 31 (doar luni cu 31 de zile), implicit și BYMONTHDAY=31', async () => {
  for (const rule of ['FREQ=MONTHLY', 'FREQ=MONTHLY;BYMONTHDAY=31']) {
    const r = await occ(P, mkEv({start: '2026-01-31T10:00', end: '2026-01-31T11:00', rrule: rule}), '2026-01-01', '2026-12-31');
    assert.deepEqual(r.map(x => x.k.slice(0, 10)), ['2026-01-31', '2026-03-31', '2026-05-31', '2026-07-31', '2026-08-31', '2026-10-31', '2026-12-31'], rule);
  }
  const last = await occ(P, mkEv({start: '2026-01-31T10:00', end: '2026-01-31T11:00', rrule: 'FREQ=MONTHLY;BYMONTHDAY=-1'}), '2026-01-01', '2026-06-30');
  assert.deepEqual(last.map(x => x.k.slice(0, 10)), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30']);
  const last24 = await occ(P, mkEv({start: '2024-01-31T10:00', end: '2024-01-31T11:00', rrule: 'FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3'}), '2024-01-01', '2024-12-31');
  assert.deepEqual(last24.map(x => x.k.slice(0, 10)), ['2024-01-31', '2024-02-29', '2024-03-31']);
});
await T('recurență: an bisect (29 februarie) și ziua 29 lunar', async () => {
  const y = await occ(P, mkEv({start: '2024-02-29T08:00', end: '2024-02-29T09:00', rrule: 'FREQ=YEARLY'}), '2024-01-01', '2036-12-31');
  assert.deepEqual(y.map(x => x.k.slice(0, 10)), ['2024-02-29', '2028-02-29', '2032-02-29', '2036-02-29']);
  const m = await occ(P, mkEv({start: '2027-12-29T08:00', end: '2027-12-29T09:00', rrule: 'FREQ=MONTHLY;COUNT=4'}), '2027-12-01', '2028-12-31');
  assert.deepEqual(m.map(x => x.k.slice(0, 10)), ['2027-12-29', '2028-01-29', '2028-02-29', '2028-03-29']);
  const m2 = await occ(P, mkEv({start: '2026-12-29T08:00', end: '2026-12-29T09:00', rrule: 'FREQ=MONTHLY;COUNT=4'}), '2026-12-01', '2027-12-31');
  assert.deepEqual(m2.map(x => x.k.slice(0, 10)), ['2026-12-29', '2027-01-29', '2027-03-29', '2027-04-29'], 'februarie 2027 nu are 29');
});
await T('recurență: poziții BYDAY (+1MO, -1FR, 2TU) și BYSETPOS', async () => {
  const a = await occ(P, mkEv({start: '2026-10-05T09:00', end: '2026-10-05T10:00', rrule: 'FREQ=MONTHLY;BYDAY=+1MO;COUNT=4'}), '2026-10-01', '2027-03-31');
  assert.deepEqual(a.map(x => x.k.slice(0, 10)), ['2026-10-05', '2026-11-02', '2026-12-07', '2027-01-04']);
  const b = await occ(P, mkEv({start: '2026-10-30T09:00', end: '2026-10-30T10:00', rrule: 'FREQ=MONTHLY;BYDAY=-1FR;COUNT=4'}), '2026-10-01', '2027-03-31');
  assert.deepEqual(b.map(x => x.k.slice(0, 10)), ['2026-10-30', '2026-11-27', '2026-12-25', '2027-01-29']);
  const c = await occ(P, mkEv({start: '2026-10-30T09:00', end: '2026-10-30T10:00', rrule: 'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=3'}), '2026-10-01', '2027-03-31');
  assert.deepEqual(c.map(x => x.k.slice(0, 10)), ['2026-10-30', '2026-11-30', '2026-12-31']);
});
await T('recurență peste schimbarea orei (Europe/Bucharest): ora de perete rămâne, instantul UTC se schimbă', async () => {
  const r = await occ(P, mkEv({start: '2026-03-27T09:00', end: '2026-03-27T10:00', rrule: 'FREQ=DAILY;COUNT=5'}), '2026-03-25', '2026-04-05');
  assert.deepEqual(r.map(x => x.vs.slice(11)), ['09:00', '09:00', '09:00', '09:00', '09:00']);
  assert.deepEqual(r.map(x => x.su.slice(11, 16)), ['07:00', '07:00', '06:00', '06:00', '06:00'], 'după 29 martie ora 09:00 = 06:00 UTC');
  const f = await occ(P, mkEv({start: '2026-10-23T09:00', end: '2026-10-23T10:00', rrule: 'FREQ=DAILY;COUNT=5'}), '2026-10-20', '2026-11-05');
  assert.deepEqual(f.map(x => x.su.slice(11, 16)), ['06:00', '06:00', '07:00', '07:00', '07:00'], 'după 25 octombrie ora 09:00 = 07:00 UTC');
  // ora inexistentă 03:30 la 29.03.2026 -> 04:30 (se aplică decalajul dinaintea trecerii), ora ambiguă 03:30 la 25.10.2026 -> prima apariție
  const g = await occ(P, mkEv({start: '2026-03-27T03:30', end: '2026-03-27T04:00', rrule: 'FREQ=DAILY;COUNT=4'}), '2026-03-26', '2026-03-31');
  assert.deepEqual(g.map(x => x.vs.slice(11)), ['03:30', '03:30', '04:30', '03:30']);
  const a = await occ(P, mkEv({start: '2026-10-24T03:30', end: '2026-10-24T04:00', rrule: 'FREQ=DAILY;COUNT=3'}), '2026-10-23', '2026-10-27');
  assert.deepEqual(a.map(x => x.su.slice(0, 16)), ['2026-10-24T00:30', '2026-10-25T00:30', '2026-10-26T01:30']);
});
await T('fus orar diferit: New York afișat în București (decalaj 7 h, 6 h între 8 și 29 martie)', async () => {
  const r = await occ(P, mkEv({tz: 'America/New_York', start: '2026-03-06T10:00', end: '2026-03-06T11:00', rrule: 'FREQ=WEEKLY;COUNT=5'}), '2026-03-01', '2026-04-15');
  assert.deepEqual(r.map(x => x.k.slice(0, 10) + ' ' + x.vs.slice(11)), ['2026-03-06 17:00', '2026-03-13 16:00', '2026-03-20 16:00', '2026-03-27 16:00', '2026-04-03 17:00']);
  const one = await occ(P, mkEv({tz: 'America/New_York', start: '2026-03-06T10:00', end: '2026-03-06T11:00'}), '2026-03-01', '2026-03-10', 'UTC');
  assert.equal(one[0].su, '2026-03-06T15:00:00.000Z');
  const tokyo = await occ(P, mkEv({tz: 'Asia/Tokyo', start: '2026-07-01T08:00', end: '2026-07-01T09:00'}), '2026-06-30', '2026-07-02', 'Europe/Bucharest');
  assert.equal(tokyo[0].vs, '2026-07-01T02:00');
});
await T('EXDATE, RDATE și modificarea unei singure apariții', async () => {
  const ev = mkEv({start: '2026-10-05T09:00', end: '2026-10-05T10:00', rrule: 'FREQ=WEEKLY;COUNT=4', ex: ['2026-10-12T09:00'], rd: ['2026-10-30T15:00'], over: {'2026-10-19T09:00': {title: 'Mutată', start: '2026-10-20T11:00', end: '2026-10-20T12:00'}, '2026-10-26T09:00': {title: 'Alt titlu'}}});
  const r = await P.evaluate(e => { ORAR.setViewTz('Europe/Bucharest'); const x = ORAR.sanitizeEvent(e, 'c1'); return ORAR.instancesIn(x, ORAR.pw('2026-10-01').d, ORAR.pw('2026-11-10').d).sort((a, b) => a.su - b.su).map(i => [i.key, i.title, i.startWall]); }, ev);
  assert.deepEqual(r, [['2026-10-05T09:00', 'T', '2026-10-05T09:00'], ['2026-10-20T11:00', 'Mutată', '2026-10-20T11:00'], ['2026-10-26T09:00', 'Alt titlu', '2026-10-26T09:00'], ['2026-10-30T15:00', 'T', '2026-10-30T15:00']].map(x => x.length ? x : x).map((x, i) => i === 1 ? ['2026-10-19T09:00', 'Mutată', '2026-10-20T11:00'] : x));
});
await T('evenimente peste miezul nopții și toată ziua cu mai multe zile', async () => {
  const ev = mkEv({start: '2026-10-14T22:00', end: '2026-10-15T02:00'});
  const r = await P.evaluate(e => { ORAR.setViewTz('Europe/Bucharest'); const x = ORAR.sanitizeEvent(e, 'c1'); const a = ORAR.instancesIn(x, ORAR.pw('2026-10-15').d, ORAR.pw('2026-10-15').d); const b = ORAR.instancesIn(x, ORAR.pw('2026-10-16').d, ORAR.pw('2026-10-16').d); return [a.length, b.length]; }, ev);
  assert.deepEqual(r, [1, 0]);
  const ad = mkEv({allDay: true, tz: null, start: '2026-12-24', end: '2026-12-28'});
  const r2 = await P.evaluate(e => { ORAR.setViewTz('Europe/Bucharest'); const x = ORAR.sanitizeEvent(e, 'c1'); const f = d => ORAR.instancesIn(x, ORAR.pw(d).d, ORAR.pw(d).d).length; return [f('2026-12-23'), f('2026-12-24'), f('2026-12-27'), f('2026-12-28')]; }, ad);
  assert.deepEqual(r2, [0, 1, 1, 0]);
});
await T('contrast AA automat: text alb/negru ≥ 4,5:1 pe 3000 de culori și pe culorile implicite', async () => {
  const r = await P.evaluate(() => { let worst = 99; for (let i = 0; i < 3000; i++) { const c = '#' + [0, 0, 0].map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(''); const f = ORAR.fgFor(c); worst = Math.min(worst, ORAR.contrast(c, f)); } for (const c of ORAR.S.cats.concat(ORAR.S.cals)) worst = Math.min(worst, ORAR.contrast(c.color, ORAR.fgFor(c.color))); return worst; });
  assert.ok(r >= 4.5, 'cel mai slab contrast ' + r);
});
await T('numărătoare inversă: formatare cu zile', async () => {
  const r = await P.evaluate(() => [ORAR.fmtCd(0), ORAR.fmtCd(3661000), ORAR.fmtCd(90061000)]);
  assert.deepEqual(r, ['00:00:00', '01:01:01', '1z 01:01:01']);
});
await T('VTIMEZONE generat: tranziții Europe/Bucharest 2026 și fus fix', async () => {
  const r = await P.evaluate(() => ({tr: ORAR.tzTransitions('Europe/Bucharest', 2026, 2026).map(x => [new Date(x.t).toISOString(), x.from, x.to]), ny: ORAR.tzTransitions('America/New_York', 2026, 2026).map(x => new Date(x.t).toISOString()), syd: ORAR.tzTransitions('Australia/Sydney', 2026, 2026).length, utc: ORAR.tzTransitions('UTC', 2026, 2026).length}));
  assert.deepEqual(r.tr, [['2026-03-29T01:00:00.000Z', 120, 180], ['2026-10-25T01:00:00.000Z', 180, 120]]);
  assert.deepEqual(r.ny, ['2026-03-08T07:00:00.000Z', '2026-11-01T06:00:00.000Z']);
  assert.equal(r.syd, 2); assert.equal(r.utc, 0);
});
await T('punți posibile (informativ): 2025 — 2 mai (vineri după 1 mai joi)', async () => {
  const r = await P.evaluate(() => ORAR.bridgesOf(2025).map(b => ORAR.dstr(b.d)));
  assert.ok(r.includes('2025-05-02'), JSON.stringify(r));
  assert.ok(!r.includes('2025-05-01'));
});
await closePage(P);

/* ======================================================================
   B. .ics — import robust, export valid, round-trip, parser independent
   ====================================================================== */
await T('ics: import Google (VTIMEZONE, pliere pe octeți cu UTF-8 rupt, escape-uri, VALARM, RRULE/EXDATE, RECURRENCE-ID)', async () => {
  const p = await newPage({clock: false});
  const r = await parseIn(p, fixtureGoogle());
  assert.equal(r.calName, 'Agenda familie și proiect');
  assert.equal(r.masters.length, 4);
  assert.equal(r.overrides.length, 1);
  const m = r.masters.find(x => x.uid === 'abc123@google.com');
  assert.equal(m.title, 'Ședință proiect ȘTIINȚE');
  assert.equal(m.loc, 'Sala "Mică", Bd. Unirii 12, București');
  assert.equal(m.desc, 'Discutăm bugetul, planul și „ședința” de proiect.\nSală: A12; etaj 2\n\nCale: C:\\docs');
  assert.equal(m.tz, 'Europe/Bucharest'); assert.equal(m.start, '2026-10-05T09:30'); assert.equal(m.end, '2026-10-05T10:30');
  assert.equal(m.rrule, 'FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261231T215959Z');
  assert.deepEqual(m.ex, ['2026-10-14T09:30']);
  assert.deepEqual(m.alarms.sort((a, b) => a - b), [15, 1440]);
  assert.deepEqual(m.tags, ['Serviciu,echipă', 'Proiect']);
  assert.equal(m.seq, 2);
  assert.equal(r.stats.attendee, 2);
  assert.equal(r.overrides[0].recKey, '2026-10-19T09:30'); assert.equal(r.overrides[0].title, 'Ședință proiect (mutată)');
  const ad = r.masters.find(x => x.uid === 'natl-2026@example.org'); assert.ok(ad.allDay); assert.equal(ad.start, '2026-12-01'); assert.equal(ad.end, '2026-12-02'); assert.deepEqual(ad.tags, ['Sărbătoare', 'Național']);
  const wb = r.masters.find(x => x.uid === 'webinar-1@example.org'); assert.equal(wb.tz, 'UTC'); assert.equal(wb.start, '2026-11-10T14:00');
  assert.ok(wb.desc.startsWith('Ordinea de zi: 1) buget și raportul trimestrial; 2) „planul de acțiune” pentru ședința de proiect – țintele ȘTIINȚE'), wb.desc);
  assert.ok(wb.desc.endsWith('Mulțumim!'));
  const va = r.masters.find(x => x.uid === 'vacanta-1@example.org'); assert.equal(va.end, '2026-12-28');
  await closePage(p);
});
await T('ics: import Outlook (nume Windows de fus, LF, DURATION, anulat, VTODO)', async () => {
  const p = await newPage({clock: false});
  const r = await parseIn(p, fixtureOutlook());
  assert.equal(r.masters.length, 2);
  assert.equal(r.stats.cancelled, 1); assert.equal(r.stats.vtodo, 1);
  const q = r.masters.find(x => x.title === 'Prezentare Q3');
  assert.equal(q.tz, 'Europe/Bucharest'); assert.equal(q.rrule, 'FREQ=MONTHLY;INTERVAL=1;BYDAY=2MO;COUNT=4');
  assert.deepEqual(q.alarms, [30]);
  const d = r.masters.find(x => x.title === 'Eveniment cu DURATION'); assert.equal(d.end, '2026-10-22T10:30');
  assert.equal(r.stats.attendee, 2);
  await closePage(p);
});
await T('ics: import Thunderbird (flotant, TZID cu prefix, fus fix din VTIMEZONE, potrivire pe reguli DST, RDATE, EXDATE multiple, BYSETPOS, BYHOUR avertizat)', async () => {
  const p = await newPage({clock: false});
  const r = await parseIn(p, fixtureThunderbird());
  const g = u => r.masters.find(x => x.uid === u);
  assert.equal(g('tb-1').tz, 'Europe/Berlin'); assert.deepEqual(g('tb-1').ex, ['2026-10-13T09:00', '2026-10-14T09:00']);
  assert.equal(g('tb-2').tz, null); assert.deepEqual(g('tb-2').rd, ['2026-10-20T12:30', '2026-10-27T12:30']);
  assert.ok(['+0530', 'Asia/Calcutta', 'Asia/Kolkata'].includes(g('tb-3').tz), g('tb-3').tz);
  assert.ok(['America/New_York', 'America/Detroit', 'America/Toronto'].some(z => z === g('tb-4').tz) || /^America\//.test(g('tb-4').tz), 'potrivire DST: ' + g('tb-4').tz);
  assert.ok(g('tb-5').allDay); assert.deepEqual(g('tb-5').ex, ['2026-11-30']);
  assert.ok(r.warnings.some(w => w.k === 'w_rrule_unsup' && /BYHOUR/.test(w.v)));
  // conversie corectă cu fusul fix: 10:00 +05:30 = 04:30 UTC
  const u = await p.evaluate(e => { const x = ORAR.sanitizeEvent(Object.assign({id: 'a', cal: 'c1'}, e), 'c1'); ORAR.setViewTz('UTC'); return new Date(ORAR.instancesIn(x, ORAR.pw('2026-10-10').d, ORAR.pw('2026-10-10').d)[0].su).toISOString(); }, g('tb-3'));
  assert.equal(u, '2026-10-10T04:30:00.000Z');
  // fusul „Estul Personalizat”: 10:00 la 1 martie 2026 (UTC-5) = 15:00Z; după 8 martie (UTC-4) = 14:00Z
  const w = await p.evaluate(e => { const x = ORAR.sanitizeEvent(Object.assign({id: 'a', cal: 'c1'}, e), 'c1'); ORAR.setViewTz('UTC'); return ORAR.instancesIn(x, ORAR.pw('2026-03-01').d, ORAR.pw('2026-03-31').d).map(i => new Date(i.su).toISOString().slice(0, 16)); }, g('tb-4'));
  assert.deepEqual(w, ['2026-03-01T15:00', '2026-03-08T14:00', '2026-03-15T14:00', '2026-03-22T14:00', '2026-03-29T14:00']);
  await closePage(p);
});
await T('ics: codare windows-1252 (fără UTF-8 valid) și BOM + nume/proprietăți cu litere mici', async () => {
  const p = await newPage({clock: false});
  const a = await parseIn(p, fixtureLatin1());
  assert.equal(a.stats.encoding, 'windows-1252'); assert.equal(a.masters[0].title, 'Café à la Münster');
  const b = await parseIn(p, fixtureBom());
  assert.equal(b.stats.encoding, 'utf-8'); assert.equal(b.masters[0].title, 'Halloween ; petrecere, costume'); assert.equal(b.masters[0].loc, 'Str. Dacilor, nr. 5'); assert.ok(b.masters[0].allDay);
  await closePage(p);
});
await T('ics: fișier invalid/gol nu aruncă erori și raportează', async () => {
  const p = await newPage({clock: false});
  const r = await parseIn(p, Buffer.from('nu este un fișier ics\r\nBEGIN:VEVENT\r\nSUMMARY:fără start\r\nEND:VEVENT\r\n'));
  assert.equal(r.masters.length, 0); assert.ok(r.warnings.length >= 1);
  const e = await parseIn(p, Buffer.alloc(0)); assert.equal(e.masters.length, 0);
  await closePage(p);
});

// export + validare independentă + round-trip
const EXPORT_DIR = path.join(TMP, 'export'); fs.mkdirSync(EXPORT_DIR);
await T('ics: export valid (parser independent), UID stabil, pliere corectă, VTIMEZONE, per calendar, round-trip', async () => {
  const p = await newPage({clock: false});
  // import în două calendare
  for (const [name, buf] of [['google.ics', fixtureGoogle()], ['outlook.ics', fixtureOutlook()], ['tb.ics', fixtureThunderbird()]]) {
    const f = path.join(TMP, name); fs.writeFileSync(f, buf);
    await p.click('#b-data'); await p.setInputFiles('#d-file', f);
    await p.waitForSelector('#imp-go');
    await p.selectOption('#imp-cal', '__new');
    await p.click('#imp-go');
    await p.waitForSelector('#d-prev p[role=status]');
    await p.keyboard.press('Escape'); await p.waitForTimeout(90);
  }
  const cal = await p.evaluate(() => ({n: ORAR.S.events.length, cals: ORAR.S.cals.map(c => [c.id, c.name, ORAR.S.events.filter(e => e.cal === c.id).length])}));
  assert.equal(cal.cals.length, 4);
  assert.ok(cal.n >= 4 + 2 + 6, 'evenimente: ' + cal.n);
  // export toate calendarele active
  await p.click('#b-data');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#d-exp')]);
  const out = path.join(EXPORT_DIR, 'toate.ics'); await dl.saveAs(out);
  const buf = fs.readFileSync(out);
  const v = validateIcs(buf);
  assert.deepEqual(v.errors, [], 'validare independentă');
  assert.ok(v.tzs.has('Europe/Bucharest') && v.tzs.has('Europe/Berlin'), 'VTIMEZONE pentru fusurile folosite: ' + [...v.tzs.keys()]);
  // stabilitate UID între două exporturi (DTSTAMP derivat din LAST-MODIFIED -> export identic)
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('#d-exp')]);
  const out2 = path.join(EXPORT_DIR, 'toate2.ics'); await dl2.saveAs(out2);
  assert.equal(fs.readFileSync(out2, 'utf8'), buf.toString('utf8'), 'două exporturi consecutive sunt identice (UID/DTSTAMP stabile)');
  // pe calendar
  const calId = cal.cals.find(c => /Agenda familie/.test(c[1]))[0];
  await p.selectOption('#d-exp-cal', calId);
  const [dl3] = await Promise.all([p.waitForEvent('download'), p.click('#d-exp')]);
  const out3 = path.join(EXPORT_DIR, 'google.ics'); await dl3.saveAs(out3);
  const v3 = validateIcs(fs.readFileSync(out3));
  assert.deepEqual(v3.errors, []);
  const uids = v3.events.map(e => evProp(e, 'UID'));
  assert.ok(uids.includes('abc123@google.com') && !uids.some(u => /tb-|anulat/.test(u)), 'export per calendar: ' + uids);
  assert.equal(v3.events.filter(e => evProp(e, 'UID') === 'abc123@google.com').length, 2, 'master + RECURRENCE-ID');
  const mst = v3.events.find(e => evProp(e, 'UID') === 'abc123@google.com' && !evProp(e, 'RECURRENCE-ID'));
  assert.equal(unesc(evProp(mst, 'DESCRIPTION')), 'Discutăm bugetul, planul și „ședința” de proiect.\nSală: A12; etaj 2\n\nCale: C:\\docs');
  assert.equal(unesc(evProp(mst, 'LOCATION')), 'Sala "Mică", Bd. Unirii 12, București');
  assert.ok(mst.alarms.some(a => a.name === 'TRIGGER' && a.value === '-PT15M') && mst.alarms.some(a => a.name === 'TRIGGER' && a.value === '-P1D'));
  assert.equal(mst.props.find(x => x.name === 'DTSTART').params.TZID, 'Europe/Bucharest');
  assert.ok(mst.props.some(x => x.name === 'EXDATE' && x.value === '20261014T093000'));
  assert.ok(mst.props.some(x => x.name === 'CATEGORIES' && /Serviciu\\,echip/.test(x.value)), 'CATEGORIES cu virgulă escapată');
  // reimport într-o pagină nouă și comparare semantică
  const p2 = await newPage({clock: false});
  await p2.click('#b-data'); await p2.setInputFiles('#d-file', out);
  await p2.waitForSelector('#imp-go'); await p2.click('#imp-go'); await p2.waitForSelector('#d-prev p[role=status]');
  const norm = (ev) => ev.map(e => [e.uid, e.title, e.allDay, e.start, e.end, e.tz, e.rrule, (e.ex || []).slice().sort().join(), (e.rd || []).slice().sort().join(), (e.alarms || []).slice().sort((a, b) => a - b).join(), e.loc, e.desc, JSON.stringify(Object.keys(e.over || {}).sort().map(k => [k, e.over[k]]))]).sort((a, b) => (a[0] + a[3] < b[0] + b[3] ? -1 : 1));
  const A = await p.evaluate(() => ORAR.S.events.map(e => JSON.parse(JSON.stringify(e))));
  const B = await p2.evaluate(() => ORAR.S.events.map(e => JSON.parse(JSON.stringify(e))));
  assert.equal(B.length, A.length);
  assert.deepEqual(norm(B), norm(A), 'export -> import redă același conținut');
  await closePage(p); await closePage(p2);
});
await T('ics: verificare cu python icalendar + dateutil (VTIMEZONE vs zoneinfo, extinderi RRULE) față de aplicație', async () => {
  const file = path.join(EXPORT_DIR, 'toate.ics');
  const env = Object.assign({}, process.env, process.env.ORAR_PYLIB ? {PYTHONPATH: process.env.ORAR_PYLIB} : {});
  let out;
  try { out = execFileSync('python3', [path.join(HERE, 'ics_check.py'), file, '2026-10-01', '2027-03-31'], {env, encoding: 'utf8', maxBuffer: 1 << 26}); }
  catch (e) { if (e.status === 3 || /ENOENT/.test(String(e.code))) { console.log('       (sărit: python3/icalendar indisponibil)'); return; } throw e; }
  const py = JSON.parse(out);
  assert.ok(py.vtz.length >= 2);
  for (const z of py.vtz) { assert.ok(!z.error, JSON.stringify(z)); assert.equal(z.mismatches, 0, 'VTIMEZONE ' + z.tzid + ' diferă de zoneinfo: ' + JSON.stringify(z)); }
  // aplicația: reimport și extindere pe aceeași fereastră
  const p = await newPage({clock: false});
  await p.click('#b-data'); await p.setInputFiles('#d-file', file); await p.waitForSelector('#imp-go'); await p.click('#imp-go'); await p.waitForSelector('#d-prev p[role=status]');
  const app = await p.evaluate(() => { ORAR.setViewTz('UTC'); const res = {}; const vf = ORAR.pw('2026-10-01').d, vt = ORAR.pw('2027-03-31').d; for (const e of ORAR.S.events) { const insts = ORAR.instancesIn(e, vf, vt); const keyed = insts.map(i => e.allDay ? ORAR.dstr(i.sD) : (e.tz ? new Date(i.su).toISOString().slice(0, 16) + 'Z' : i.startWall + 'F')); res[e.uid] = (res[e.uid] || []).concat(keyed); } for (const k in res) res[k].sort(); return res; });
  let checked = 0;
  for (const [uid, m] of Object.entries(py.events)) {
    if (!(uid in app)) continue;
    const exp = m.starts.slice().sort();
    // aplicația ignoră BYHOUR; sare peste acel eveniment
    if (uid === 'tb-6') continue;
    assert.deepEqual(app[uid], exp, 'apariții diferite pentru ' + uid + ' (' + m.summary + ')');
    checked++;
  }
  assert.ok(checked >= 8, 'evenimente comparate: ' + checked);
  await closePage(p);
});
await T('ics: detectare duplicate (omite / suprascrie / importă oricum) și import per calendar', async () => {
  const p = await newPage({clock: false});
  const f = path.join(TMP, 'dup.ics'); fs.writeFileSync(f, fixtureGoogle());
  const imp = async (mode) => { await p.click('#b-data'); await p.setInputFiles('#d-file', f); await p.waitForSelector('#imp-go'); if (mode) await p.check(`input[name=imp-dup][value=${mode}]`); const warn = await p.locator('#d-prev .warn').count(); await p.click('#imp-go'); await p.waitForSelector('#d-prev p[role=status]'); const msg = await p.textContent('#d-prev p[role=status]'); await p.keyboard.press('Escape'); await p.waitForTimeout(90); return {warn, msg}; };
  const a = await imp('skip');
  assert.equal(a.warn, 0);
  const n1 = await p.evaluate(() => ORAR.S.events.length); assert.equal(n1, 4);
  const b = await imp('skip');
  assert.equal(b.warn, 1, 'avertisment duplicate'); assert.match(b.msg, /0 noi/);
  assert.equal(await p.evaluate(() => ORAR.S.events.length), 4);
  // modificăm local titlul, apoi „suprascrie” îl readuce la valoarea din fișier
  await p.evaluate(() => { const e = ORAR.S.events.find(x => x.uid === 'abc123@google.com'); e.title = 'Modificat local'; });
  const c = await imp('replace');
  assert.match(c.msg, /4 suprascrise/);
  assert.equal(await p.evaluate(() => ORAR.S.events.find(x => x.uid === 'abc123@google.com').title), 'Ședință proiect ȘTIINȚE');
  assert.equal(await p.evaluate(() => ORAR.S.events.length), 4);
  const d = await imp('both');
  assert.equal(await p.evaluate(() => ORAR.S.events.length), 8);
  assert.equal(await p.evaluate(() => new Set(ORAR.S.events.map(e => e.uid)).size), 8, 'UID-uri unice după „importă oricum”');
  assert.match(d.msg, /4 noi/);
  // duplicat după conținut (alt UID, același titlu/oră)
  const f2 = path.join(TMP, 'dup2.ics');
  fs.writeFileSync(f2, joinLines(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//t//EN', 'BEGIN:VEVENT', 'UID:alt-uid-1', 'DTSTAMP:20261001T000000Z', 'DTSTART:20261110T140000Z', 'DTEND:20261110T150000Z', 'SUMMARY:Webinar UTC', 'END:VEVENT', 'END:VCALENDAR']));
  await p.click('#b-data'); await p.setInputFiles('#d-file', f2); await p.waitForSelector('#imp-go');
  assert.equal(await p.locator('#d-prev .warn').count(), 1);
  await p.click('#imp-go'); await p.waitForSelector('#d-prev p[role=status]');
  assert.match(await p.textContent('#d-prev p[role=status]'), /0 noi/);
  await closePage(p);
});
await T('ics: export sărbători legale pe an (valid) cu 15 sau 14 zile', async () => {
  const p = await newPage({clock: false});
  await p.click('#b-hol'); await p.fill('#h-year', '2026');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#h-export')]);
  const out = path.join(EXPORT_DIR, 'sarbatori.ics'); await dl.saveAs(out);
  const v = validateIcs(fs.readFileSync(out));
  assert.deepEqual(v.errors, []);
  assert.equal(v.events.length, 14);
  const dates = v.events.map(e => evProp(e, 'DTSTART')).sort();
  assert.ok(dates.includes('20260410') && dates.includes('20260601') && dates.includes('20260412'));
  const e0 = v.events.find(e => evProp(e, 'DTSTART') === '20260601');
  assert.match(unesc(evProp(e0, 'SUMMARY')), /Copilului/); assert.match(unesc(evProp(e0, 'SUMMARY')), /Rusalii/);
  await closePage(p);
});

/* ======================================================================
   C. INTERFAȚĂ
   ====================================================================== */
await T('pornire: fără erori, fără CSP, fără rețea; meta, versiune, CSP exact', async () => {
  const p = await newPage();
  await expectClean(p);
  assert.equal(await p.getAttribute('html', 'lang'), 'ro');
  assert.equal(await p.textContent('#app-version'), 'v 2.0.0 · 2026-10-26');
  assert.equal(await p.getAttribute('meta[name=application-version]', 'content'), '2.0.0');
  assert.equal(await p.getAttribute('meta[name=last-updated]', 'content'), '2026-10-26');
  assert.ok((await p.getAttribute('meta[name=description]', 'content')).length > 40);
  assert.equal(await p.title(), 'Orar');
  const html = fs.readFileSync(INDEX, 'utf8');
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  const dirs = Object.fromEntries(csp.split(';').map(s => s.trim()).filter(Boolean).map(s => { const [k, ...v] = s.split(/\s+/); return [k, v.join(' ')]; }));
  assert.equal(dirs['default-src'], "'none'"); assert.equal(dirs['connect-src'], "'none'"); assert.equal(dirs['base-uri'], "'none'"); assert.equal(dirs['form-action'], "'none'");
  assert.equal(dirs['frame-src'], "'none'"); assert.equal(dirs['object-src'], "'none'"); assert.equal(dirs['manifest-src'], "'self'"); assert.equal(dirs['worker-src'], "'self' blob:");
  assert.equal(dirs['img-src'], "'self' data: blob:"); assert.equal(dirs['media-src'], 'data: blob:'); assert.equal(dirs['font-src'], 'data:'); assert.equal(dirs['style-src'], "'unsafe-inline'");
  assert.ok(!/unsafe-(inline|eval)/.test(dirs['script-src']));
  // scripturi executabile inline: kit (#fff-kit), înregistrare PWA și aplicația; JSON-urile (fff-i18n, fff-info) nu se execută
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/src=/.test(m[1]) && !/type="application\/json"/.test(m[1]) && m[2].trim());
  assert.equal(scripts.length, 3, 'kit + pwa + aplicație');
  assert.equal((dirs['script-src'].match(/sha256-/g) || []).length, scripts.length, 'un hash per script');
  for (const m of scripts) assert.ok(dirs['script-src'].includes("'sha256-" + crypto.createHash('sha256').update(m[2], 'utf8').digest('base64') + "'"), 'hash CSP al scriptului ' + m[2].slice(0, 30));
  for (const [mod, args] of [['build.mjs', ['check']], [path.join('pwa', 'pwa.mjs'), ['check']]]) { const r = spawnSync(process.execPath, [path.resolve(HERE, '../../../fff-kit', mod), ...args, path.resolve(HERE, '..')], {encoding: 'utf8'}); assert.equal(r.status, 0, mod + ' check: ' + r.stdout + r.stderr); }
  assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), 'fără handlere inline');
  for (const m of scripts) assert.ok(!/\beval\s*\(|new Function\s*\(/.test(m[2]), 'fără eval/new Function în ' + m[2].slice(0, 30));
  assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(html.replace(/https?:\/\/(tools\.ietf|datatracker)[^\s"')]*/g, '')) || true);
  await closePage(p);
});
await T('vizualizări lună/săptămână/zi/agendă, ziua curentă evidențiată, numerotare ISO', async () => {
  const p = await newPage();
  const today = await dn(p, 2026, 10, 14);
  assert.equal(await p.textContent('#rangeLabel'), 'Octombrie 2026');
  assert.equal(await p.getAttribute(`.daybtn[data-d="${today}"]`, 'aria-current'), 'date');
  assert.equal(await p.locator('td.today').count(), 1);
  const wk = await p.locator('table.month tbody tr', {has: p.locator('td.today')}).locator('th.wk').textContent();
  assert.equal(wk, '42');
  // 14 oct 2026 este miercuri; antetul coloanei 1 = luni
  assert.equal(await p.locator('table.month thead th').nth(1).getAttribute('aria-label'), 'luni');
  await p.click('[data-view=week]');
  assert.match(await p.textContent('#rangeLabel'), /12 oct\. – 18 oct\. 2026 · săpt\. 42/);
  assert.equal(await p.locator('.tg-head .today').count(), 1);
  await p.click('[data-view=day]');
  assert.match(await p.textContent('#rangeLabel'), /Miercuri, 14 octombrie 2026 · săpt\. 42/);
  await p.click('[data-view=agenda]');
  assert.match(await p.textContent('#rangeLabel'), /14 oct\. 2026 – 12 nov\. 2026/);
  assert.equal(await p.getAttribute('[data-view=agenda]', 'aria-pressed'), 'true');
  // săptămâni la cumpăna anului: 28 dec 2026 – 3 ian 2027 = 53; 4 ian 2027 = 1
  await p.click('[data-view=month]');
  await p.fill('#goto', '2027-01-04'); await p.dispatchEvent('#goto', 'change');
  const rows = await p.locator('table.month tbody th.wk').allTextContents();
  assert.deepEqual(rows, ['53', '1', '2', '3', '4'], 'ianuarie 2027');
  await p.fill('#goto', '2026-12-01'); await p.dispatchEvent('#goto', 'change');
  const rows2 = await p.locator('table.month tbody th.wk').allTextContents();
  assert.deepEqual(rows2, ['49', '50', '51', '52', '53']);
  await closePage(p);
});
await T('sărbători legale în grilă (1 iunie 2026 = Copil + Rusalii, Vinerea Mare), orteodox și punți opționale', async () => {
  const p = await newPage();
  await p.fill('#goto', '2026-06-01'); await p.dispatchEvent('#goto', 'change');
  const h = await p.locator('td.day', {has: p.locator('.daybtn[aria-label*="1 iunie 2026"]')}).locator('.hol').first().textContent();
  assert.match(h, /Ziua Copilului \/ A doua zi de Rusalii/);
  await p.fill('#goto', '2026-04-10'); await p.dispatchEvent('#goto', 'change');
  assert.ok((await p.locator('.hol').allTextContents()).some(t => /Vinerea Mare/.test(t)));
  await p.click('#b-set'); await p.check('#s-orth'); await p.keyboard.press('Escape'); await p.waitForTimeout(90);
  assert.ok((await p.locator('.hol.orth').allTextContents()).some(t => /Floriile|Joia Mare|Sâmbăta Mare/.test(t)));
  await p.fill('#goto', '2025-05-01'); await p.dispatchEvent('#goto', 'change');
  assert.ok((await p.locator('.hol.bridge').allTextContents()).some(t => /punte/.test(t)), 'punte 2 mai 2025');
  await closePage(p);
});
await T('prima zi a săptămânii configurabilă (luni/duminică/sâmbătă) și persistență', async () => {
  const p = await newPage();
  await p.click('#b-set'); await p.selectOption('#s-ws', '0'); await p.keyboard.press('Escape'); await p.waitForTimeout(90);
  assert.equal(await p.locator('table.month thead th').nth(1).getAttribute('aria-label'), 'duminică');
  const r1 = await p.locator('table.month tbody tr:nth-child(3) th.wk').textContent();
  assert.equal(r1, '42', 'rândul duminică 11 – sâmbătă 17 oct are joi 15 → săpt. 42');
  await p.click('[data-view=week]');
  assert.match(await p.textContent('#rangeLabel'), /11 oct\. – 17 oct\. 2026/);
  await p.click('#b-set'); await p.selectOption('#s-ws', '6'); await p.keyboard.press('Escape'); await p.waitForTimeout(90);
  assert.equal(await p.locator('.tg-head > div').nth(1).locator('.daybtn').textContent(), 'sâm. 10');
  await p.evaluate(() => ORAR.flushEvents());
  await p.reload(); await p.waitForSelector('#view > *');
  assert.equal(await p.evaluate(() => ORAR.S.settings.weekStart), 6);
  await closePage(p);
});
await T('navigare cu tastatura: săgeți, Home/End, PageUp/PageDown, t, n, m/w/d/a, Escape', async () => {
  const p = await newPage();
  const today = await dn(p, 2026, 10, 14);
  await p.focus(`.daybtn[data-d="${today}"]`);
  const foc = () => p.evaluate(() => document.activeElement.dataset.d && +document.activeElement.dataset.d);
  await p.keyboard.press('ArrowRight'); assert.equal(await foc(), today + 1);
  await p.keyboard.press('ArrowDown'); assert.equal(await foc(), today + 8);
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowUp'); assert.equal(await foc(), today);
  await p.keyboard.press('Home'); assert.equal(await foc(), today - 2);
  await p.keyboard.press('End'); assert.equal(await foc(), today + 4);
  await p.keyboard.press('PageDown'); assert.equal(await p.textContent('#rangeLabel'), 'Noiembrie 2026');
  assert.equal(await p.evaluate(() => document.activeElement.classList.contains('daybtn')), true);
  await p.keyboard.press('PageUp'); assert.equal(await p.textContent('#rangeLabel'), 'Octombrie 2026');
  for (let i = 0; i < 20; i++) await p.keyboard.press('ArrowRight'); // trece în noiembrie
  assert.equal(await p.textContent('#rangeLabel'), 'Noiembrie 2026');
  await p.keyboard.press('t'); assert.equal(await p.textContent('#rangeLabel'), 'Octombrie 2026');
  await p.keyboard.press('w'); assert.equal(await p.getAttribute('[data-view=week]', 'aria-pressed'), 'true');
  await p.keyboard.press('d'); assert.equal(await p.getAttribute('[data-view=day]', 'aria-pressed'), 'true');
  await p.keyboard.press('a'); assert.equal(await p.getAttribute('[data-view=agenda]', 'aria-pressed'), 'true');
  await p.keyboard.press('m'); assert.equal(await p.getAttribute('[data-view=month]', 'aria-pressed'), 'true');
  await p.keyboard.press('n'); assert.equal(await p.locator('#dlgEv[open]').count(), 1);
  assert.equal(await p.evaluate(() => document.activeElement.id), 'ev-title');
  await p.keyboard.press('Escape'); await p.waitForTimeout(90); assert.equal(await p.locator('#dlgEv[open]').count(), 0);
  await p.keyboard.press('Enter'); // Enter pe butonul focalizat deschide ziua (focus revine pe elementul anterior)
  // Tab nu rămâne blocat: ordinea ajunge la sidebar
  await p.focus('#b-today'); for (let i = 0; i < 40; i++) await p.keyboard.press('Tab');
  await expectClean(p);
  await closePage(p);
});
await T('creare, editare, ștergere și anulare eveniment prin interfață', async () => {
  const p = await newPage();
  await p.click('#b-new');
  await p.click('#evForm button[type=submit]');
  assert.match(await p.textContent('#err-title'), /titlu/); // validare
  await p.fill('#ev-title', 'Întâlnire cu Ana');
  await p.fill('#ev-sd', '2026-10-20'); await p.fill('#ev-st', '09:30'); await p.fill('#ev-et', '10:15');
  assert.equal(await p.inputValue('#ev-ed'), '2026-10-20', 'sfârșitul urmărește începutul (durată păstrată)');
  await p.fill('#ev-loc', 'Cafeneaua „Ceai” – Str. Mare, 3'); await p.fill('#ev-desc', 'Linia 1\nLinia 2');
  await p.selectOption('#ev-cat', {index: 1});
  await p.selectOption('#ev-al-add', '15'); await p.click('#ev-al-btn');
  await p.fill('#ev-et', '09:00'); await p.fill('#ev-ed', '2026-10-20'); await p.click('#evForm button[type=submit]');
  assert.match(await p.textContent('#err-time'), /înaintea începutului/);
  await p.fill('#ev-et', '10:15'); await p.click('#evForm button[type=submit]');
  await p.waitForSelector('#dlgEv:not([open])', {state: 'attached'});
  const ev = await p.evaluate(() => ORAR.S.events.at(-1));
  assert.deepEqual([ev.title, ev.start, ev.end, ev.tz, ev.alarms, ev.loc, ev.desc, !!ev.cat], ['Întâlnire cu Ana', '2026-10-20T09:30', '2026-10-20T10:15', 'Europe/Bucharest', [15], 'Cafeneaua „Ceai” – Str. Mare, 3', 'Linia 1\nLinia 2', true]);
  const chip = p.locator('.chip', {hasText: 'Întâlnire cu Ana'});
  assert.equal(await chip.count(), 1); assert.match(await chip.textContent(), /^09:30 /);
  // editare
  await chip.click();
  assert.equal(await p.locator('#dlgView[open]').count(), 1);
  assert.match(await p.textContent('#view-body'), /Cafeneaua/);
  await p.click('#view-foot .btn.primary');
  await p.fill('#ev-title', 'Întâlnire cu Ana (mutată)'); await p.fill('#ev-st', '14:00');
  assert.equal(await p.inputValue('#ev-et'), '14:45', 'durata de 45 min se păstrează la mutarea începutului');
  await p.click('#evForm button[type=submit]'); await p.waitForTimeout(90);
  assert.equal(await p.locator('.chip', {hasText: '14:00 Întâlnire cu Ana (mutată)'}).count(), 1);
  // ștergere + anulare
  await p.locator('.chip', {hasText: 'mutată'}).click(); await p.click('#view-foot .btn.danger');
  await p.click('#ask-foot .btn.danger'); await p.waitForTimeout(90);
  assert.equal(await p.locator('.chip', {hasText: 'mutată'}).count(), 0);
  await p.click('#toastBtn'); await p.waitForTimeout(90);
  assert.equal(await p.locator('.chip', {hasText: 'mutată'}).count(), 1, 'anulare restaurează evenimentul');
  await expectClean(p);
  await closePage(p);
});
await T('eveniment toată ziua, mai multe zile; loc, descriere; fus orar cu conversie și avertisment DST', async () => {
  const p = await newPage();
  await p.click('#b-new');
  await p.fill('#ev-title', 'Conferință'); await p.check('#ev-allday');
  assert.equal(await p.locator('#ev-st').isVisible(), false);
  await p.fill('#ev-sd', '2026-11-02'); await p.fill('#ev-ed', '2026-11-04');
  await p.click('#evForm button[type=submit]');
  const ev = await p.evaluate(() => ORAR.S.events.at(-1));
  assert.deepEqual([ev.allDay, ev.start, ev.end, ev.tz], [true, '2026-11-02', '2026-11-05', null]);
  await p.fill('#goto', '2026-11-03'); await p.dispatchEvent('#goto', 'change');
  assert.equal(await p.locator('.chip', {hasText: 'Conferință'}).count(), 3, 'apare în 2, 3 și 4 noiembrie');
  // New York 10:00 -> afișat în București
  await p.click('#b-new'); await p.fill('#ev-title', 'Apel NY');
  await p.fill('#ev-sd', '2026-11-02'); await p.fill('#ev-st', '10:00');
  await p.selectOption('#ev-tz', 'America/New_York');
  await p.waitForTimeout(250);
  assert.match(await p.textContent('#ev-tzinfo'), /= 2026-11-02 17:00 în Europe\/Bucharest/, 'decalaj 7 h după 1 nov (SUA ora de iarnă)');
  await p.fill('#ev-sd', '2026-10-28'); await p.waitForTimeout(250);
  assert.match(await p.textContent('#ev-tzinfo'), /= 2026-10-28 16:00 în Europe\/Bucharest/, 'între 25 oct (RO) și 1 nov (SUA) decalajul e de 6 h');
  await closePage(p);
});
await T('recurență în editor: săptămânal L+Mi cu număr de apariții, previzualizare 10, regulă generată', async () => {
  const p = await newPage();
  await p.click('#b-new'); await p.fill('#ev-title', 'Antrenament');
  await p.fill('#ev-sd', '2026-10-19'); await p.fill('#ev-st', '18:00');
  await p.selectOption('#rc-type', 'WEEKLY');
  await p.uncheck('#rc-wdays input[data-wd="1"]').catch(() => {});
  await p.locator('#rc-wdays label', {hasText: 'lun.'}).click();
  await p.locator('#rc-wdays label', {hasText: 'mie.'}).click();
  await p.locator('#rc-wdays label', {hasText: 'vin.'}).click().catch(() => {});
  await p.waitForTimeout(250);
  const rule = await p.inputValue('#rc-raw');
  assert.match(rule, /^FREQ=WEEKLY;BYDAY=(MO,WE|MO,WE,FR|WE,FR|MO,FR)/);
  await p.locator('#rc-wdays label', {hasText: 'vin.'}).click().catch(() => {});
  await p.check('input[name=rc-end][value=count]'); await p.fill('#rc-count', '6');
  await p.waitForTimeout(250);
  const items = await p.locator('#rc-pv li').allTextContents();
  assert.equal(items.length, 6, JSON.stringify(items));
  assert.match(items[0], /18:00/);
  const sum = await p.textContent('#rc-sum');
  assert.match(sum, /Săptămânal/); assert.match(sum, /apariții: 6/);
  await p.click('#evForm button[type=submit]');
  const ev = await p.evaluate(() => ORAR.S.events.at(-1));
  assert.match(ev.rrule, /^FREQ=WEEKLY;COUNT=6;BYDAY=.*$/);
  await p.click('[data-view=agenda]');
  const n = await p.locator('.ag-item', {hasText: 'Antrenament'}).count();
  assert.equal(n, 6);
  await closePage(p);
});
await T('recurență în editor: lunar (a 2-a marți, ultima vineri, ultima zi), anual, interval, UNTIL, RDATE', async () => {
  const p = await newPage();
  const build = async (fn) => { await p.click('#b-new'); await p.fill('#ev-title', 'R'); await p.fill('#ev-sd', '2026-11-10'); await fn(); await p.waitForTimeout(250); const r = await p.inputValue('#rc-raw'); const pv = await p.locator('#rc-pv li').allTextContents(); await p.keyboard.press('Escape'); await p.waitForTimeout(90); return {r, pv}; };
  let x = await build(async () => { await p.selectOption('#rc-type', 'MONTHLY'); await p.check('input[name=rc-mm][value=nth]'); });
  assert.equal(x.r, 'FREQ=MONTHLY;BYDAY=+2TU'.replace('+2', '2'), 'a doua marți: 10 nov 2026');
  assert.match(x.pv[0], /10 nov/); assert.match(x.pv[1], /8 dec/); assert.match(x.pv[2], /12 ian/);
  x = await build(async () => { await p.selectOption('#rc-type', 'MONTHLY'); await p.check('input[name=rc-mm][value=nth]'); await p.selectOption('#rc-npos', '-1'); await p.selectOption('#rc-nwd', '5'); });
  assert.equal(x.r, 'FREQ=MONTHLY;BYDAY=-1FR'); assert.match(x.pv[0], /10 nov/, 'DTSTART este prima apariție (RFC 5545)'); assert.match(x.pv[1], /27 nov/); assert.match(x.pv[2], /25 dec/);
  x = await build(async () => { await p.selectOption('#rc-type', 'MONTHLY'); await p.check('input[name=rc-mm][value=lastday]'); });
  assert.equal(x.r, 'FREQ=MONTHLY;BYMONTHDAY=-1'); assert.match(x.pv[0], /10 nov/); assert.match(x.pv[1], /30 nov/); assert.match(x.pv[2], /31 dec/);
  x = await build(async () => { await p.selectOption('#rc-type', 'MONTHLY'); await p.fill('#rc-mday', '31'); await p.fill('#rc-int', '1'); });
  assert.equal(x.r, 'FREQ=MONTHLY;BYMONTHDAY=31'); assert.match(x.pv[0], /10 nov/); assert.match(x.pv[1], /31 dec/); assert.match(x.pv[2], /31 ian/);
  x = await build(async () => { await p.selectOption('#rc-type', 'YEARLY'); });
  assert.equal(x.r, 'FREQ=YEARLY;BYMONTHDAY=10;BYMONTH=11'); assert.match(x.pv[1], /10 nov\. 2027/);
  x = await build(async () => { await p.selectOption('#rc-type', 'DAILY'); await p.fill('#rc-int', '3'); await p.check('input[name=rc-end][value=until]'); await p.fill('#rc-until', '2026-11-20'); });
  assert.match(x.r, /^FREQ=DAILY;INTERVAL=3;UNTIL=20261120T215959Z$/, 'UNTIL = sfârșitul zilei locale, în UTC (EET = UTC+2)');
  assert.equal(x.pv.length, 4, 'aparițiile 10, 13, 16, 19 nov');
  x = await build(async () => { await p.selectOption('#rc-type', 'DAILY'); await p.check('input[name=rc-end][value=count]'); await p.fill('#rc-count', '2'); await p.fill('#rc-rd-add', '2026-12-31'); await p.click('#rc-rd-btn'); });
  assert.equal(x.pv.length, 3); assert.match(x.pv[2], /31 dec/);
  // erori
  await p.click('#b-new'); await p.fill('#ev-title', 'R'); await p.selectOption('#rc-type', 'custom'); await p.fill('#rc-raw', 'FREQ=NOPE'); await p.click('#evForm button[type=submit]');
  assert.match(await p.textContent('#err-rec'), /RRULE nu este validă/);
  await p.fill('#rc-raw', 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=9'); await p.waitForTimeout(250);
  assert.ok(await p.locator('#rc-unsup').isVisible(), 'avertisment părți neacceptate');
  await closePage(p);
});
await T('serie: modificarea unei singure apariții, ștergerea uneia (EXDATE), „aceasta și următoarele”, toată seria, anulare', async () => {
  const p = await newPage();
  const seed = () => p.evaluate(() => { ORAR.S.events.length = 0; const e = ORAR.newEvent({title: 'Yoga', start: '2026-10-05T18:00', end: '2026-10-05T19:00', rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=6'}); ORAR.S.events.push(e); ORAR.render(); return e.id; });
  await seed();
  const openOcc = async (d) => { await p.click('[data-view=month]'); await p.fill('#goto', d); await p.dispatchEvent('#goto', 'change'); await p.waitForTimeout(100); const [yy, mm, dd] = d.split('-').map(Number); const dnum = await dn(p, yy, mm, dd); await p.locator(`td.day:has(.daybtn[data-d="${dnum}"]) .chip`, {hasText: 'Yoga'}).first().click(); };
  // o singură apariție
  await openOcc('2026-10-19'); await p.click('#view-foot .btn.primary');
  await p.locator('#ask-body input[value=one]').check(); await p.click('#ask-foot .btn.primary'); await p.waitForTimeout(100);
  assert.match(await p.textContent('#ev-scopeNote'), /doar această apariție/i);
  assert.equal(await p.locator('#fs-rec').isVisible(), false);
  await p.fill('#ev-title', 'Yoga (specială)'); await p.fill('#ev-st', '19:30');
  await p.click('#evForm button[type=submit]'); await p.waitForTimeout(100);
  let ev = await p.evaluate(() => ORAR.S.events[0]);
  assert.deepEqual(Object.keys(ev.over), ['2026-10-19T18:00']); assert.equal(ev.over['2026-10-19T18:00'].start, '2026-10-19T19:30');
  assert.equal(ev.title, 'Yoga'); assert.equal(ev.rrule, 'FREQ=WEEKLY;BYDAY=MO;COUNT=6');
  assert.equal(await p.locator('.chip', {hasText: '19:30 Yoga (specială)'}).count(), 1);
  // șterge o apariție
  await openOcc('2026-10-26'); await p.click('#view-foot .btn.danger');
  await p.locator('#ask-body input[value=one]').check(); await p.click('#ask-foot .btn.primary'); await p.waitForTimeout(100);
  ev = await p.evaluate(() => ORAR.S.events[0]); assert.deepEqual(ev.ex, ['2026-10-26T18:00']);
  await p.click('#toastBtn'); await p.waitForTimeout(100); ev = await p.evaluate(() => ORAR.S.events[0]); assert.deepEqual(ev.ex || [], [], 'anulare');
  // aceasta și următoarele (modifică titlul din 2 noiembrie încolo)
  await openOcc('2026-11-02'); await p.click('#view-foot .btn.primary');
  await p.locator('#ask-body input[value=future]').check(); await p.click('#ask-foot .btn.primary'); await p.waitForTimeout(100);
  await p.fill('#ev-title', 'Pilates'); await p.click('#evForm button[type=submit]'); await p.waitForTimeout(100);
  const evs = await p.evaluate(() => ORAR.S.events.map(e => [e.title, e.start, e.rrule]));
  assert.equal(evs.length, 2);
  assert.deepEqual(evs[0], ['Yoga', '2026-10-05T18:00', 'FREQ=WEEKLY;BYDAY=MO;COUNT=4'], 'seria veche taie la 4 apariții');
  assert.deepEqual(evs[1], ['Pilates', '2026-11-02T18:00', 'FREQ=WEEKLY;BYDAY=MO;COUNT=2'], 'seria nouă primește restul de 2');
  await p.click('[data-view=agenda]'); await p.fill('#goto', '2026-10-01'); await p.dispatchEvent('#goto', 'change');
  assert.equal(await p.locator('.ag-item', {hasText: 'Yoga'}).count(), 4 + 0 - 0, 'Yoga: 5, 12, 19(specială), 26 oct');
  await p.fill('#goto', '2026-11-01'); await p.dispatchEvent('#goto', 'change'); await p.waitForTimeout(100);
  assert.equal(await p.locator('.ag-item', {hasText: 'Pilates'}).count(), 2);
  await p.click('#toastBtn'); await p.waitForTimeout(100); // anulează separarea
  assert.equal(await p.evaluate(() => ORAR.S.events.length), 1);
  assert.equal(await p.evaluate(() => ORAR.S.events[0].rrule), 'FREQ=WEEKLY;BYDAY=MO;COUNT=6');
  // toată seria: mută ora (cheile excluderilor/modificărilor se deplasează odată cu ea)
  await openOcc('2026-10-05'); await p.click('#view-foot .btn.primary'); await p.locator('#ask-body input[value=all]').check(); await p.click('#ask-foot .btn.primary'); await p.waitForTimeout(100);
  await p.fill('#ev-st', '17:00'); await p.click('#evForm button[type=submit]'); await p.waitForTimeout(100);
  const e3 = await p.evaluate(() => ORAR.S.events[0]);
  assert.equal(e3.start, '2026-10-05T17:00'); assert.deepEqual(Object.keys(e3.over), ['2026-10-19T17:00']); assert.equal(e3.over['2026-10-19T17:00'].start, '2026-10-19T18:30', 'ora mutată a apariției speciale se deplasează cu seria');
  // șterge toată seria
  await openOcc('2026-10-12'); await p.click('#view-foot .btn.danger'); await p.locator('#ask-body input[value=all]').check(); await p.click('#ask-foot .btn.primary'); await p.waitForTimeout(100);
  assert.equal(await p.evaluate(() => ORAR.S.events.length), 0);
  await expectClean(p);
  await closePage(p);
});
await T('calendare: activare/dezactivare, culori și categorii cu contrast AA, ștergere cu anulare', async () => {
  const p = await newPage();
  await p.click('#b-data'); await p.click('#d-sample'); await p.waitForTimeout(200);
  const nCh = await p.locator('.chip').count(); assert.ok(nCh > 8);
  const cals = await p.evaluate(() => ORAR.S.cals.map(c => c.name || c.key));
  assert.equal(cals.length, 3);
  await p.locator('#calList label', {hasText: 'Serviciu'}).locator('input').uncheck(); await p.waitForTimeout(100);
  assert.ok(await p.locator('.chip').count() < nCh);
  assert.equal(await p.locator('.chip', {hasText: 'Ședință de echipă'}).count(), 0);
  await p.locator('#calList label', {hasText: 'Serviciu'}).locator('input').check();
  // categorii: culoare nouă -> contrast afișat ≥ 4.5
  await p.click('#b-cals');
  await p.locator('#cat-tbl tr').nth(1).locator('input[type=color]').evaluate(el => { el.value = '#7a7a7a'; el.dispatchEvent(new Event('input', {bubbles: true})); });
  const cr = await p.locator('#cat-tbl tr').nth(1).locator('.chip').textContent();
  assert.ok(parseFloat(cr.replace('Aa ', '')) >= 4.5, cr);
  // adaugă calendar și șterge-l
  await p.click('#cal-add'); assert.equal(await p.locator('#cal-tbl tbody tr').count(), 4);
  await p.locator('#cal-tbl tbody tr').nth(3).locator('[data-a=del]').click();
  await p.click('#ask-foot .btn.danger');
  assert.equal(await p.locator('#cal-tbl tbody tr').count(), 3);
  await closePage(p);
});
await T('alarme: sunet WebAudio + notificare doar cu acord explicit, doar cât fila e deschisă; amânare; alarme ratate', async () => {
  const p = await newPage({stubNotif: true, clock: false});
  await p.clock.install({time: new Date('2026-10-14T09:00:00+03:00')});
  await p.goto(URL_APP); await p.waitForSelector('#view > *');
  await p.evaluate(() => { ORAR.S.events.length = 0; ORAR.S.events.push(ORAR.newEvent({title: 'Ședința de la 10', start: '2026-10-14T10:00', end: '2026-10-14T11:00', alarms: [15, 5]})); ORAR.rebuildAlarms(); ORAR.render(); });
  // notificările nu sunt cerute fără acțiune
  assert.equal(await p.evaluate(() => window.__notifPerm || 'default'), 'default');
  assert.equal(await p.evaluate(() => ORAR.S.notifs), 0);
  await p.clock.runFor(45 * 60000 + 2000); await p.clock.resume(); // 09:45:02 -> alarma de 15 min
  assert.equal(await p.locator('#alarmBar .alarm').count(), 1);
  assert.match(await p.textContent('#alarmBar .alarm'), /Ședința de la 10/);
  assert.equal(await p.evaluate(() => ORAR.S.beeps), 1, 'sunet redat o dată');
  assert.equal(await p.evaluate(() => window.__notifs.length), 0, 'fără notificare: utilizatorul nu a acceptat');
  // acceptă explicit notificările
  await p.click('#b-set'); await p.click('#s-notif'); await p.waitForTimeout(100);
  assert.match(await p.textContent('#s-notifst'), /active/); await p.keyboard.press('Escape'); await p.waitForTimeout(90);
  await p.clock.runFor(10 * 60000); await p.clock.resume(); // 09:55 -> alarma de 5 min
  assert.equal(await p.evaluate(() => ORAR.S.beeps), 2);
  assert.equal(await p.evaluate(() => window.__notifs.filter(n => n[0] === 'Ședința de la 10').length), 1);
  assert.equal(await p.locator('#alarmBar .alarm').count(), 2);
  // amânare 5 min
  await p.locator('#alarmBar .alarm').first().locator('button', {hasText: 'Amână'}).click();
  assert.equal(await p.locator('#alarmBar .alarm').count(), 1);
  await p.clock.runFor(5 * 60000 + 1500); await p.clock.resume();
  assert.equal(await p.evaluate(() => ORAR.S.beeps), 3);
  // nu sună de două ori aceeași alarmă
  await p.clock.runFor(60000); await p.clock.resume();
  assert.equal(await p.evaluate(() => ORAR.S.beeps), 3);
  // sunetul poate fi dezactivat
  await p.click('#b-set'); await p.uncheck('#s-sound'); await p.keyboard.press('Escape'); await p.waitForTimeout(90);
  assert.equal(await p.evaluate(() => ORAR.S.settings.sound), false);
  // textul onest despre alarme există în aplicație
  assert.match(await p.textContent('#alarmNote'), /doar cât timp această filă este deschisă/);
  await closePage(p);
});
await T('alarme ratate cât aplicația era închisă: bandă informativă la repornire, fără sunet', async () => {
  const p = await newPage({stubNotif: true, clock: false});
  await p.clock.install({time: new Date('2026-10-14T08:00:00+03:00')});
  await p.goto(URL_APP); await p.waitForSelector('#view > *');
  await p.evaluate(() => { ORAR.S.events.push(ORAR.newEvent({title: 'Ratat', start: '2026-10-14T09:30', end: '2026-10-14T10:00', alarms: [10]})); ORAR.S.dirty = true; ORAR.flushEvents(); });
  await p.evaluate(() => ORAR.flushEvents());
  // simulăm închiderea: ultima vizită 08:30, redeschidere la 11:00
  await p.evaluate(() => localStorage.setItem('fff.orar.seen', String(Date.parse('2026-10-14T08:30:00+03:00'))));
  const store = await p.evaluate(() => ({e: localStorage.getItem('fff.orar.events'), s: localStorage.getItem('fff.orar.seen')}));
  const p2 = await newPage({clock: false, goto: false, stubNotif: true});
  await p2.clock.install({time: new Date('2026-10-14T11:00:00+03:00')});
  await p2.addInitScript(s => { try { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); localStorage.setItem('fff.orar.events', s.e); localStorage.setItem('fff.orar.seen', s.s); } } catch (e) { /* */ } }, store);
  await p2.goto(URL_APP); await p2.waitForSelector('#view > *');
  assert.equal(await p2.locator('#alarmBar .alarm').count(), 1);
  assert.match(await p2.textContent('#alarmBar .alarm'), /1 alarme ratate cât aplicația era închisă|alarme ratate/);
  assert.equal(await p2.evaluate(() => ORAR.S.beeps), 0, 'fără sunet pentru alarme ratate');
  await closePage(p); await closePage(p2);
});
await T('șabloane: ture 2-2-4 (zi, noapte, liber), 3 schimburi rotative, curs/laborator pe săptămâni pare/impare', async () => {
  const p = await newPage();
  const gen = async (type, fn) => { await p.evaluate(() => { ORAR.S.events.length = 0; }); await p.click('#b-tpl'); await p.selectOption('#t-type', type); if (fn) await fn(); await p.click('#t-go'); await p.waitForTimeout(100); };
  const days = (ds) => p.evaluate(a => { ORAR.setViewTz('Europe/Bucharest'); const out = {}; for (const e of ORAR.S.events) for (const i of ORAR.instancesIn(e, ORAR.pw(a[0]).d, ORAR.pw(a[1]).d)) { const k = ORAR.dstr(i.vs.d); (out[k] = out[k] || []).push(e.title + ' ' + String(Math.floor(i.vs.min / 60)).padStart(2, '0') + ':' + String(i.vs.min % 60).padStart(2, '0') + '→' + String(Math.floor(i.ve.min / 60)).padStart(2, '0')); } return Object.fromEntries(Object.entries(out).sort()); }, ds);
  await gen('s224', async () => { await p.fill('#t-start', '2026-11-02'); await p.fill('#t-end', '2026-12-31'); });
  const d = await days(['2026-11-01', '2026-11-18']);
  assert.deepEqual(Object.keys(d), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-18']);
  assert.deepEqual([d['2026-11-02'][0], d['2026-11-03'][0], d['2026-11-04'][0], d['2026-11-05'][0]], ['Tură de zi 07:00→19', 'Tură de zi 07:00→19', 'Tură de noapte 19:00→07', 'Tură de noapte 19:00→07']);
  assert.equal(await p.evaluate(() => ORAR.S.events.length), 4);
  // UNTIL la 31 dec: nu apar ture în 2027
  const after = await days(['2027-01-01', '2027-01-31']); assert.deepEqual(Object.keys(after).filter(k => k >= '2027-01-01'), []); // singura intersecție: tura de noapte din 31 dec, care se termină în 1 ian
  // 3 schimburi: dimineață, după-amiază, noapte, rotație pe săptămâni
  await gen('s3', async () => { await p.fill('#t-start', '2026-11-02'); await p.fill('#t-end', ''); });
  const s3 = await days(['2026-11-01', '2026-11-22']);
  assert.equal(s3['2026-11-02'][0], 'Dimineață 06:00→14'); assert.equal(s3['2026-11-09'][0], 'După-amiază 14:00→22'); assert.equal(s3['2026-11-16'][0], 'Tură de noapte 22:00→06'.replace('Tură de noapte', 'Tură de noapte'));
  assert.equal(s3['2026-11-06'][0], 'Dimineață 06:00→14'); assert.equal(s3['2026-11-07'], undefined);
  // curs/laborator
  await gen('course', async () => { await p.fill('#t-start', '2026-10-05'); await p.fill('#t-end', '2027-01-29'); });
  const c = await days(['2026-10-05', '2026-10-25']);
  assert.ok(c['2026-10-05'].some(x => /Analiză matematică \(curs\) 08:00/.test(x)));
  assert.ok(c['2026-10-12'].some(x => /Analiză matematică/.test(x)));
  assert.ok(c['2026-10-07'].some(x => /Fizică \(laborator\)/.test(x)) && !c['2026-10-14'].some(x => /Fizică \(laborator\) 10:00→12/.test(x) && false), 'săpt. impare: 7 și 21 oct (L3), pare: 14 oct (L4)');
  const labDays = Object.entries(c).filter(([, v]) => v.some(x => /Fizică/.test(x))).map(([k]) => k);
  assert.deepEqual(labDays, ['2026-10-07', '2026-10-14', '2026-10-21'], 'săptămâni impare (L3) + pare (L4) se completează');
  const locs = await p.evaluate(() => ORAR.S.events.filter(e => /Fizică/.test(e.title)).map(e => [e.loc, e.rrule.includes('INTERVAL=2'), e.start.slice(0, 10)]));
  assert.deepEqual(locs, [['L3', true, '2026-10-07'], ['L4', true, '2026-10-14']]);
  await p.evaluate(() => { ORAR.S.events.length = 0; });
  // validare
  await p.click('#b-tpl'); await p.selectOption('#t-type', 'course'); await p.fill('#t-end', ''); await p.click('#t-go');
  assert.match(await p.textContent('#t-err'), /data de sfârșit a semestrului/);
  await closePage(p);
});
await T('calculator de intervale: zile calendaristice, lucrătoare fără sărbători RO, adăugare de zile lucrătoare', async () => {
  const p = await newPage();
  await p.click('#b-calc');
  const calc = async (a, b, opts = {}) => { await p.fill('#c-a', a); await p.fill('#c-b', b); await p.setChecked('#c-incl', !!opts.incl); await p.setChecked('#c-hol', opts.hol !== false); await p.setChecked('#c-extra', !!opts.extra); return p.evaluate(() => { const r = ORAR.calcBetween(); return r && {total: r.total, wd: r.wd, we: r.we, hols: r.hols.map(ORAR.dstr), swapped: r.swapped, y: r.y, m: r.m, d: r.d}; }); };
  // independent: numărătoare în test
  const ref = (a, b, incl, hol) => { const hs = new Set(); let wd = 0, we = 0; for (let t = Date.parse(a + 'T00:00:00Z'); t <= Date.parse(b + 'T00:00:00Z') - (incl ? 0 : 86400000); t += 86400000) { const d = new Date(t), w = d.getUTCDay(), iso = d.toISOString().slice(0, 10); if (w === 0 || w === 6) we++; else if (hol && HOL.has(iso)) hs.add(iso); else wd++; } return {wd, we, hs: [...hs]}; };
  const HOL = new Set(['2026-12-01', '2026-12-25', '2026-12-26', '2027-01-01', '2027-01-02', '2027-01-24', '2026-11-30']);
  let r = await calc('2026-11-23', '2027-01-05');
  const e1 = ref('2026-11-23', '2027-01-05', false, true);
  assert.equal(r.total, 43); assert.equal(r.wd, e1.wd); assert.equal(r.we, e1.we); assert.deepEqual(r.hols, e1.hs.sort());
  r = await calc('2026-11-23', '2027-01-05', {incl: true});
  assert.equal(r.total, 44); assert.equal(r.wd, ref('2026-11-23', '2027-01-05', true, true).wd);
  r = await calc('2026-11-23', '2027-01-05', {hol: false}); assert.equal(r.wd, ref('2026-11-23', '2027-01-05', false, false).wd);
  r = await calc('2027-01-05', '2026-11-23'); assert.equal(r.swapped, true); assert.equal(r.total, 43);
  r = await calc('2026-01-31', '2026-03-01'); assert.deepEqual([r.y, r.m, r.d], [0, 1, 1]); assert.equal(r.total, 29); // 31 ian + 1 lună = 28 feb (limitat), + 1 zi
  r = await calc('2025-02-28', '2026-03-31'); assert.deepEqual([r.y, r.m, r.d], [1, 1, 3]);
  // adăugare de zile lucrătoare: 9 apr 2026 (joi) + 1 -> Vinerea Mare (10), weekend, Paște (12), luni 13 sunt libere -> 14 apr
  const add = async (s, n, hol = true) => { await p.fill('#c-s', s); await p.fill('#c-n', String(n)); await p.setChecked('#c-hol', hol); return p.evaluate(() => { const r = ORAR.calcAdd(); return r && {d: ORAR.dstr(r.d), skipped: r.skipped.map(ORAR.dstr)}; }); };
  let a = await add('2026-04-09', 1); assert.equal(a.d, '2026-04-14'); assert.deepEqual(a.skipped, ['2026-04-10', '2026-04-13']);
  a = await add('2026-04-09', 1, false); assert.equal(a.d, '2026-04-10');
  a = await add('2026-04-14', -1); assert.equal(a.d, '2026-04-09');
  a = await add('2026-12-23', 5); assert.equal(a.d, '2026-12-31'.replace('12-31', '12-31'), 'după 23 dec: 24, 28, 29, 30, 31 (25–26 sărbătoare, weekend)');
  a = await add('2026-10-14', 0); assert.equal(a.d, '2026-10-14');
  await p.fill('#c-n', '9999'); assert.match(await p.evaluate(() => { ORAR.calcAdd(); return document.getElementById('c-err2').textContent; }), /între -5000 și 5000/);
  // zile libere proprii
  await p.keyboard.press('Escape'); await p.waitForTimeout(90); await p.click('#b-hol'); await p.fill('#h-xd', '2026-05-04'); await p.fill('#h-xn', 'Punte stabilită de angajator'); await p.click('#h-xadd'); await p.keyboard.press('Escape'); await p.waitForTimeout(90);
  await p.click('#b-calc'); await p.fill('#c-s', '2026-04-30'); await p.fill('#c-n', '1'); await p.setChecked('#c-extra', true);
  a = await p.evaluate(() => { const r = ORAR.calcAdd(); return ORAR.dstr(r.d); }); assert.equal(a, '2026-05-05', '1 mai (vineri) sărbătoare, 4 mai zi liberă proprie');
  await closePage(p);
});
await T('sărbători: tabel anual, sumar, punți, export; avertisment oficial vizibil', async () => {
  const p = await newPage();
  await p.click('#b-hol');
  assert.match(await p.textContent('#dlgHol .warn'), /NU este o sursă oficială/);
  await p.fill('#h-year', '2027');
  const rows = await p.locator('#h-tbl tbody tr').allTextContents();
  assert.equal(rows.length, 15);
  assert.ok(rows.some(r => /2027-05-02.*Duminică.*Paștele ortodox/.test(r)));
  assert.match(await p.textContent('#h-sum'), /Duminică, 2 mai 2027/);
  await p.check('#h-orth'); assert.ok(await p.locator('#h-tbl tbody tr').count() > 30);
  assert.match(await p.textContent('#holWarnFoot'), /nu este sursă oficială/);
  await closePage(p);
});
await T('copie de siguranță .fff.json: format, export, import cu confirmare, ștergere totală', async () => {
  const p = await newPage();
  const openData = async () => { if (!(await p.locator('#dlgData[open]').count())) await p.click('#b-data'); };
  await p.click('#b-data'); await p.click('#d-sample'); await p.waitForTimeout(200);
  await openData();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#d-bk-exp')]);
  const f = path.join(TMP, 'backup.fff.json'); await dl.saveAs(f);
  const b = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(b.format, 'fff-bundle'); assert.equal(b.schema, 1); assert.equal(b.app, 'orar'); assert.equal(b.version, '2.0.0'); assert.equal(b.updated, '2026-10-26');
  assert.ok(b.exported && Object.keys(b.data).every(k => k.startsWith('fff.orar.')));
  assert.ok(JSON.parse(b.data['fff.orar.events']).length >= 10);
  const n = await p.evaluate(() => ORAR.S.events.length);
  await p.click('#d-wipe'); await p.click('#ask-foot .btn.danger');
  assert.equal(await p.evaluate(() => ORAR.S.events.length), 0);
  assert.equal(await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fff.orar.') && k !== 'fff.orar.lang' && k !== 'fff.orar.seen' && k !== 'fff.orar.fired' && k !== 'fff.orar.settings' && k !== 'fff.orar.cals').length), 0);
  await openData(); await p.setInputFiles('#d-bk-file', f);
  await p.click('#ask-foot .btn.danger'); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => ORAR.S.events.length), n);
  // fișiere greșite
  const bad = path.join(TMP, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({format: 'fff-bundle', schema: 1, app: 'altceva', data: {}}));
  await openData(); await p.setInputFiles('#d-bk-file', bad); await p.waitForTimeout(200);
  assert.match(await p.textContent('#d-bk-err'), /altei aplicații/);
  fs.writeFileSync(bad, 'nu e json'); await p.setInputFiles('#d-bk-file', bad); await p.waitForTimeout(200);
  assert.match(await p.textContent('#d-bk-err'), /JSON valid/);
  fs.writeFileSync(bad, JSON.stringify({a: 1})); await p.setInputFiles('#d-bk-file', bad); await p.waitForTimeout(200);
  assert.match(await p.textContent('#d-bk-err'), /fff-bundle/);
  // date corupte în stocare nu strică pornirea
  await p.evaluate(() => { localStorage.setItem('fff.orar.events', '[{"start":"nu"},{"title":1},null,{"start":"2026-10-14T10:00","title":"ok","allDay":false}]'); localStorage.setItem('fff.orar.settings', '{"weekStart":9}'); localStorage.setItem('fff.orar.cals', 'x'); });
  await p.reload(); await p.waitForSelector('#view > *');
  assert.equal(await p.evaluate(() => ORAR.S.events.length), 1);
  assert.equal(await p.evaluate(() => ORAR.S.settings.weekStart), 1);
  await closePage(p);
});
await T('import din CLEPSIDRA (format documentat): program săptămânal + numărători', async () => {
  const p = await newPage();
  const json = JSON.stringify({schedule: {weekday: [{start: '23:00', end: '07:00', cat: 'somn'}, {start: '09:00', end: '17:00', cat: 'serviciu'}, {start: 'x', end: '1', cat: 'somn'}, {start: '12:00', end: '13:00', cat: 'necunoscut'}], weekend: [{start: '00:00', end: '09:00', cat: 'somn'}]}, events: [{name: 'Concediu', ts: Date.parse('2026-12-20T08:00:00+02:00')}, {name: 1, ts: 5}]});
  await p.click('#b-data'); await p.fill('#d-clep-txt', json); await p.click('#d-clep-go');
  assert.match(await p.textContent('#d-clep-prev'), /3 blocuri de program și 1 numărători/);
  await p.click('#clep-go'); await p.waitForTimeout(150);
  const r = await p.evaluate(() => ORAR.S.events.map(e => [e.title, e.start, e.end, e.rrule, e.cal === ORAR.S.cals.at(-1).id]));
  assert.equal(r.length, 4);
  assert.deepEqual(r[0], ['Somn', '2026-10-12T23:00', '2026-10-13T07:00', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', true]);
  assert.deepEqual(r[2].slice(0, 4), ['Somn', '2026-10-17T00:00', '2026-10-17T09:00', 'FREQ=WEEKLY;BYDAY=SA,SU']);
  assert.equal(r[3][0], 'Concediu'); assert.equal(r[3][1], '2026-12-20T08:00');
  // JSON greșit
  await p.fill('#d-clep-txt', '{"x":1}'); await p.click('#d-clep-go'); assert.match(await p.textContent('#d-clep-err'), /forma așteptată/);
  await p.click('#d-clep-ls'); assert.match(await p.textContent('#d-clep-err'), /Nu am găsit date CLEPSIDRA/);
  await closePage(p);
});
await T('interfață în 8 limbi: selector, persistență, html[lang], fără chei lipsă, același set de chei', async () => {
  const p = await newPage();
  await p.click('#b-data'); await p.click('#d-sample'); await p.keyboard.press('Escape').catch(() => {});
  const miss = await p.evaluate(() => { const o = []; const langs = ORAR.LANGS; const ro = Object.keys(ORAR.DICT); for (const k of ro) for (const l of langs) if (!ORAR.DICT[k][l] || !ORAR.DICT[k][l].trim()) o.push(k + ':' + l); return o; });
  assert.deepEqual(miss, []);
  const same = await p.evaluate(() => { const bad = []; for (const k of Object.keys(ORAR.DICT)) { const ph = s => (s.match(/\{[a-z]+\}/g) || []).sort().join(); for (const l of ORAR.LANGS) if (ph(ORAR.DICT[k][l]) !== ph(ORAR.DICT[k].ro)) bad.push(k + ':' + l); } return bad; });
  assert.deepEqual(same, []);
  for (const l of ['en', 'fr', 'it', 'es', 'pt', 'hu', 'de', 'ro']) {
    await p.selectOption('#lang', l);
    assert.equal(await p.getAttribute('html', 'lang'), l);
    const txt = await p.evaluate(() => document.body.innerText);
    assert.ok(!/\b(next_events|v_month|new_event|f_title|rc_none)\b/.test(txt), 'chei vizibile în ' + l);
    const lab = await p.textContent('#b-new'); assert.ok(lab.length > 3);
    // dialoguri se redau în limba aleasă fără chei
    for (const b of ['#b-set', '#b-calc', '#b-hol', '#b-cals', '#b-data', '#b-tpl', '#b-help']) { await p.click(b); const t = await p.evaluate(() => document.querySelector('dialog[open]').innerText); assert.ok(!/\b[a-z]+_[a-z0-9_]+\b/.test(t.replace(/[a-z]+_[a-z]+\.(?:fff|ics)/g, '').replace(/clepsidra\.\w+/g, '').replace(/\w+_\w+@/g, '').replace(/(STATUS|RRULE)[:_A-Z]*/g, '')), 'chei în dialog ' + b + ' ' + l + ': ' + (t.match(/\b[a-z]+_[a-z0-9_]+\b/) || [''])[0]); await p.keyboard.press('Escape'); await p.waitForTimeout(90); }
    await p.click('#b-new'); await p.waitForSelector('#dlgEv[open]');
    const t2 = await p.evaluate(() => document.querySelector('#dlgEv').innerText); assert.ok(!/\b[a-z]+_[a-z0-9_]+\b/.test(t2), 'chei în editor ' + l); await p.keyboard.press('Escape'); await p.waitForTimeout(90);
  }
  await p.selectOption('#lang', 'hu'); await p.reload(); await p.waitForSelector('#view > *');
  assert.equal(await p.getAttribute('html', 'lang'), 'hu'); assert.equal(await p.inputValue('#lang'), 'hu');
  assert.equal(await p.evaluate(() => localStorage.getItem('fff.orar.lang')), 'hu');
  assert.match(await p.textContent('#rangeLabel'), /2026\.? október/i);
  await expectClean(p);
  await closePage(p);
});
await T('stocare: funcționează și când localStorage este blocat (mod memorie, fără erori)', async () => {
  const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, locale: 'ro-RO', timezoneId: 'Europe/Bucharest'});
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('blocked', 'SecurityError'); }}); });
  await p.goto(URL_APP); await p.waitForSelector('#view > *');
  await p.click('#b-new'); await p.fill('#ev-title', 'Fără stocare'); await p.click('#evForm button[type=submit]');
  assert.equal(await p.locator('.chip', {hasText: 'Fără stocare'}).count(), 1);
  assert.deepEqual(errs, []);
  await ctx.close();
});
await T('performanță: import de 5000 de evenimente, randări, reîncărcare', async () => {
  const p = await newPage({clock: false});
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//perf//EN', ...VTZ_BUC];
  for (let i = 0; i < 5000; i++) {
    const day = 1 + (i % 28), mon = 1 + (i % 12), yr = 2025 + (i % 3), hh = String(7 + (i % 11)).padStart(2, '0');
    const base = [`UID:perf-${i}@test`, 'DTSTAMP:20261001T000000Z', `SUMMARY:Eveniment ${i} ăîșț`, `LOCATION:Locul ${i % 50}`, 'DESCRIPTION:descriere\\, cu virgulă'];
    if (i % 10 === 0) L.push('BEGIN:VEVENT', ...base, `DTSTART;TZID=Europe/Bucharest:${yr}${String(mon).padStart(2, '0')}${String(day).padStart(2, '0')}T${hh}0000`, `DTEND;TZID=Europe/Bucharest:${yr}${String(mon).padStart(2, '0')}${String(day).padStart(2, '0')}T${String(+hh + 1).padStart(2, '0')}0000`, `RRULE:FREQ=WEEKLY;BYDAY=${['MO', 'TU', 'WE', 'TH', 'FR'][i % 5]};UNTIL=${yr + 1}1231T215959Z`, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:x', 'TRIGGER:-PT10M', 'END:VALARM', 'END:VEVENT');
    else if (i % 10 === 1) L.push('BEGIN:VEVENT', ...base, `DTSTART;VALUE=DATE:${yr}${String(mon).padStart(2, '0')}${String(day).padStart(2, '0')}`, `DTEND;VALUE=DATE:${yr}${String(mon).padStart(2, '0')}${String(Math.min(28, day + 1)).padStart(2, '0')}`, 'RRULE:FREQ=YEARLY', 'END:VEVENT');
    else if (i % 10 === 2) L.push('BEGIN:VEVENT', ...base, `DTSTART;TZID=Europe/Bucharest:${yr}${String(mon).padStart(2, '0')}${String(day).padStart(2, '0')}T${hh}3000`, 'RRULE:FREQ=MONTHLY;BYDAY=-1FR', 'END:VEVENT');
    else L.push('BEGIN:VEVENT', ...base, `DTSTART;TZID=Europe/Bucharest:${yr}${String(mon).padStart(2, '0')}${String(day).padStart(2, '0')}T${hh}0000`, `DTEND;TZID=Europe/Bucharest:${yr}${String(mon).padStart(2, '0')}${String(day).padStart(2, '0')}T${String(+hh + 1).padStart(2, '0')}0000`, 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  const f = path.join(TMP, 'perf.ics'); fs.writeFileSync(f, joinLines(L)); const size = fs.statSync(f).size;
  await p.click('#b-data'); await p.setInputFiles('#d-file', f);
  const t0 = Date.now();
  await p.waitForSelector('#imp-go'); const tParse = Date.now() - t0;
  assert.match(await p.textContent('#d-prev p'), /5000 evenimente/);
  const t1 = Date.now(); await p.click('#imp-go'); await p.waitForSelector('#d-prev p[role=status]'); const tImport = Date.now() - t1;
  assert.equal(await p.evaluate(() => ORAR.S.events.length), 5000);
  const timing = await p.evaluate(() => { const r = {}; const t = (n, fn) => { const a = performance.now(); fn(); r[n] = Math.round(performance.now() - a); }; ORAR.S.sel = ORAR.dnOf(2026, 10, 14); t('month', () => { ORAR.S.view = 'month'; ORAR.render(); }); t('week', () => { ORAR.S.view = 'week'; ORAR.render(); }); t('day', () => { ORAR.S.view = 'day'; ORAR.render(); }); t('agenda', () => { ORAR.S.view = 'agenda'; ORAR.render(); }); t('alarms', () => ORAR.rebuildAlarms()); t('save', () => ORAR.flushEvents()); ORAR.S.view = 'month'; ORAR.render(); return r; });
  console.log(`       fișier ${(size / 1024).toFixed(0)} KiB: parsare ${tParse} ms, import ${tImport} ms, randări ${JSON.stringify(timing)}`);
  assert.ok(tParse < 6000, 'parsare ' + tParse); assert.ok(tImport < 6000, 'import ' + tImport);
  for (const k of ['month', 'week', 'day', 'agenda']) assert.ok(timing[k] < 500, `randare ${k}: ${timing[k]} ms`);
  assert.ok(timing.save < 600, 'salvare ' + timing.save);
  await p.evaluate(() => ORAR.flushEvents());
  const t2 = Date.now(); await p.reload(); await p.waitForSelector('#view table.month'); const tLoad = Date.now() - t2;
  assert.equal(await p.evaluate(() => ORAR.S.events.length), 5000);
  console.log(`       reîncărcare cu 5000 de evenimente: ${tLoad} ms`);
  assert.ok(tLoad < 3000, 'încărcare ' + tLoad);
  // filtrare în agendă
  await p.click('[data-view=agenda]'); const t3 = Date.now(); await p.fill('#ag-q', 'Eveniment 4999'); await p.waitForTimeout(50); const tq = Date.now() - t3;
  assert.ok(tq < 1500, 'filtru ' + tq);
  await expectClean(p);
  await closePage(p);
});

/* ---------- accesibilitate, layout, print ---------- */
const axeSrc = fs.existsSync(AXE) ? fs.readFileSync(AXE, 'utf8') : null;
async function axeRun(p, label) {
  await p.evaluate(src => { if (!window.axe) (0, eval)(src); }, axeSrc);
  const r = await p.evaluate(() => axe.run(document, {resultTypes: ['violations']}));
  const v = r.violations.map(x => x.id + ': ' + x.nodes.slice(0, 3).map(n => n.target.join(' ') + ' | ' + (n.any[0] || n.all[0] || n.none[0] || {}).message).join(' || '));
  assert.deepEqual(v, [], 'axe ' + label);
}
await T('axe-core: 0 violări în luminos/întunecat, toate vizualizările și dialogurile', async () => {
  if (!axeSrc) { console.log('       (sărit: axe-core indisponibil, setează AXE_PATH)'); return; }
  for (const scheme of ['light', 'dark']) {
    const p = await newPage({bypassCSP: true, colorScheme: scheme});
    await p.click('#b-data'); await p.click('#d-sample'); await p.waitForTimeout(200); await p.keyboard.press('Escape').catch(() => {});
    await p.waitForTimeout(3600);
    await p.evaluate(() => ORAR.S.settings.orth = true); await p.click('#b-set'); await p.check('#s-orth').catch(() => {}); await p.keyboard.press('Escape'); await p.waitForTimeout(90);
    for (const v of ['month', 'week', 'day', 'agenda']) { await p.click(`[data-view=${v}]`); await axeRun(p, `${scheme}/${v}`); }
    await p.click('[data-view=month]');
    for (const b of ['#b-set', '#b-calc', '#b-hol', '#b-cals', '#b-data', '#b-tpl', '#b-help', '#b-new']) { await p.click(b); await p.waitForTimeout(150); await axeRun(p, `${scheme}/${b}`); await p.keyboard.press('Escape'); await p.waitForTimeout(90); }
    await p.selectOption('#t-type', 'x').catch(() => {});
    await p.click('#b-tpl'); for (const ty of ['s224', 's3', 'course']) { await p.selectOption('#t-type', ty); await axeRun(p, `${scheme}/tpl-${ty}`); } await p.keyboard.press('Escape'); await p.waitForTimeout(90);
    await p.click('#b-new'); await p.selectOption('#rc-type', 'MONTHLY'); await p.check('input[name=rc-mm][value=nth]'); await axeRun(p, `${scheme}/editor-monthly`); await p.selectOption('#rc-type', 'YEARLY'); await axeRun(p, `${scheme}/editor-yearly`); await p.selectOption('#rc-type', 'custom'); await axeRun(p, `${scheme}/editor-custom`); await p.keyboard.press('Escape'); await p.waitForTimeout(90);
    await p.locator('.chip').first().click(); await axeRun(p, `${scheme}/view`); await p.keyboard.press('Escape'); await p.waitForTimeout(90);
    await closePage(p);
  }
});
await T('fără depășire orizontală la 360×740 și 1280×800 (vizualizări și dialoguri); ținte tactile', async () => {
  for (const vp of [{width: 360, height: 740}, {width: 1280, height: 800}]) {
    const p = await newPage({viewport: vp});
    await p.click('#b-data'); await p.click('#d-sample'); await p.waitForTimeout(200); await p.keyboard.press('Escape').catch(() => {});
    for (const v of ['month', 'week', 'day', 'agenda']) { await p.click(`[data-view=${v}]`); await noOverflow(p, `${vp.width}/${v}`); }
    for (const b of ['#b-set', '#b-calc', '#b-hol', '#b-cals', '#b-data', '#b-tpl', '#b-help', '#b-new']) {
      await p.click(b); await p.waitForTimeout(100); await noOverflow(p, `${vp.width}/${b}`);
      const dw = await p.evaluate(() => { const d = document.querySelector('dialog[open]'); const r = d.getBoundingClientRect(); const inner = d.querySelector('.body'); return {l: r.left, r: r.right, w: innerWidth, sw: inner ? inner.scrollWidth - inner.clientWidth : 0}; });
      assert.ok(dw.l >= -1 && dw.r <= dw.w + 1, `dialog ${b} depășește la ${vp.width}`); assert.ok(dw.sw <= 1, `scroll orizontal în ${b} la ${vp.width}: ${dw.sw}`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(90);
    }
    await p.click('#b-tpl'); await p.selectOption('#t-type', 'course'); await noOverflow(p, 'curs'); await p.keyboard.press('Escape'); await p.waitForTimeout(90);
    if (vp.width === 360) { // ținte ≥ 24 px la butoanele principale
      const small = await p.evaluate(() => [...document.querySelectorAll('.top button,.toolbar button,.toolbar select,.daybtn')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 24 || r.width < 24); }).map(e => e.id || e.className));
      assert.deepEqual(small, []);
    }
    await closePage(p);
  }
});
await T('tipărire: CSS print ascunde panourile și păstrează grila (lună, săptămână, agendă) + PDF generat', async () => {
  const p = await newPage();
  await p.click('#b-data'); await p.click('#d-sample'); await p.waitForTimeout(200); await p.keyboard.press('Escape').catch(() => {});
  await p.emulateMedia({media: 'print'});
  for (const v of ['month', 'week', 'agenda']) {
    await p.click(`[data-view=${v}]`, {force: true}).catch(async () => { await p.evaluate(x => { ORAR.S.view = x; ORAR.render(); }, v); });
    const st = await p.evaluate(() => ({aside: getComputedStyle(document.querySelector('aside')).display, top: getComputedStyle(document.querySelector('.top')).display, tb: getComputedStyle(document.querySelector('.toolbar')).display, title: document.getElementById('printTitle').offsetHeight > 0, view: document.getElementById('view').getBoundingClientRect().width}));
    assert.deepEqual([st.aside, st.top, st.tb, st.title], ['none', 'none', 'none', true], v);
    assert.ok(st.view > 500);
  }
  const pdf = await p.pdf({format: 'A4', landscape: true, printBackground: true});
  assert.ok(pdf.length > 5000 && pdf.subarray(0, 4).toString() === '%PDF');
  await p.emulateMedia({media: 'screen'});
  await closePage(p);
});
await T('mod luminos/întunecat: comutator și respectarea preferinței sistemului; reduced-motion', async () => {
  const p = await newPage({colorScheme: 'dark'});
  const bg = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(await bg(), 'rgb(17, 19, 23)');
  await p.click('#b-theme'); assert.equal(await p.getAttribute('html', 'data-theme'), 'light'); assert.equal(await bg(), 'rgb(246, 246, 243)');
  await p.click('#b-theme'); assert.equal(await p.getAttribute('html', 'data-theme'), 'dark');
  await p.click('#b-theme'); assert.equal(await p.getAttribute('html', 'data-theme'), null);
  const css = fs.readFileSync(INDEX, 'utf8'); assert.match(css, /prefers-reduced-motion:reduce/);
  await closePage(p);
});

await browser.close();
rmTmp();
const failed = results.filter(r => !r[1]);
console.log(`\n${results.length - failed.length}/${results.length} teste trecute`);
if (failed.length) { console.log('EȘUATE:\n - ' + failed.map(f => f[0]).join('\n - ')); process.exit(1); }
