// Teste Node pentru tools/fff-agenda.js (agenda comună): conversie .ics, îmbinare, CLEPSIDRA, plic.   Rulare: node tests/agenda.test.mjs
import {createRequire} from 'node:module'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
process.env.TZ = 'UTC';
const require = createRequire(import.meta.url), HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = require(path.join(HUB, 'tools/fff-agenda.js'));
let ok = 0, bad = 0; const T = (n, f) => { try { f(); ok++; console.log('ok   ' + n); } catch (e) { bad++; console.log('FAIL ' + n + '\n       ' + e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' așteptat ' + JSON.stringify(b) + ', obținut ' + JSON.stringify(a)); };
const yes = (c, m) => { if (!c) throw new Error(m); };

T('normalize: respinge fără titlu/dată, taie lungimi, dedupe uid', () => {
  const r = A.normalize([{title: 'a', start: '2026-11-05T10:00'}, {title: '', start: '2026-11-05'}, {title: 'x', start: 'mâine'}, {title: 'a', start: '2026-11-05T10:00'}, null, 5]);
  eq(r.length, 1); yes(/@fff\.agenda$/.test(r[0].uid), 'uid');
  eq(A.normalize([{title: 'x'.repeat(500), start: '2026-01-01'}])[0].title.length, 120);
});
T('normalize: rrule nesigur respins, tz invalid ignorat, kind necunoscut → event', () => {
  const r = A.normalize([{title: 'x', start: '2026-01-01', rrule: 'FREQ=WEEKLY;X=<script>', tz: 'a b', kind: 'zzz'}])[0];
  yes(!r.rrule && !r.tz && r.kind === 'event', JSON.stringify(r));
  yes(A.normalize([{title: 'x', start: '2026-01-01', rrule: 'RRULE:FREQ=MONTHLY;INTERVAL=2'}])[0].rrule === 'FREQ=MONTHLY;INTERVAL=2', 'rrule bun');
});
T('toICS → fromICS (dus-întors): titlu cu virgulă/;/nou-rând, TZID, UTC, plutitor, all-day, RRULE', () => {
  const it = A.normalize([
    {title: 'Ședință, buget; \\ final', start: '2026-11-05T10:00', end: '2026-11-05T11:30', tz: 'Europe/Bucharest', uid: 'u1'},
    {title: 'UTC', start: '2026-11-06T08:00', tz: 'UTC', uid: 'u2'},
    {title: 'Plutitor', start: '2026-11-07T09:15', uid: 'u3', rrule: 'FREQ=WEEKLY;BYDAY=MO,WE', cat: 'serviciu'},
    {title: 'Chirie', start: '2026-12-01', kind: 'due', uid: 'u4', rrule: 'FREQ=MONTHLY', amount: {minor: -250000, cur: 'RON'}}]);
  const ics = A.toICS(it, {name: 'Test'}); yes(ics.includes('\r\n') && ics.startsWith('BEGIN:VCALENDAR'), 'antet');
  yes(!ics.includes('2500'), 'suma nu pleacă în .ics fără amounts:true');
  const back = A.fromICS(ics);
  eq(back.length, 4); eq(back[0].title, 'Ședință, buget; \\ final'); eq(back[0].tz, 'Europe/Bucharest'); eq(back[1].tz, 'UTC'); eq(back[2].tz, undefined);
  eq(back[2].rrule, 'FREQ=WEEKLY;BYDAY=MO,WE'); eq(back[3].allDay, true); eq(back[3].kind, 'due'); eq(back[3].start, '2026-12-01');
});
T('EXDATE se păstrează; RECURRENCE-ID (excepții izolate) nu devine element nou', () => {
  const t = 'BEGIN:VEVENT\nUID:s\nSUMMARY:Serie\nDTSTART:20261102T090000\nRRULE:FREQ=DAILY\nEXDATE:20261104T090000,20261105T090000\nEND:VEVENT\nBEGIN:VEVENT\nUID:s\nRECURRENCE-ID:20261103T090000\nSUMMARY:Mutat\nDTSTART:20261103T100000\nEND:VEVENT';
  const r = A.fromICS(t); eq(r.length, 1); eq(r[0].ex, ['2026-11-04T09:00', '2026-11-05T09:00']);
  yes(A.toICS(r).includes('EXDATE:20261104T090000'), 'EXDATE reemis');
});
T('fromICS: pliere de linii, VALARM ignorat, \\n în titlu, VEVENT fără SUMMARY respins', () => {
  const t = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:z@x\r\nSUMMARY:Titlu lung\r\n  continuat\r\nDTSTART:20261105T100000Z\r\nBEGIN:VALARM\r\nSUMMARY:alarma\r\nDTSTART:20000101T000000Z\r\nEND:VALARM\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:w\r\nDTSTART:20261105\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const r = A.fromICS(t); eq(r.length, 1); eq(r[0].title, 'Titlu lung continuat'); eq(r[0].tz, 'UTC'); eq(r[0].start, '2026-11-05T10:00');
});
T('startMs: UTC, IANA (iarnă +2 / vară +3), plutitor = local (TZ=UTC aici)', () => {
  eq(A.startMs({start: '2026-11-05T10:00', tz: 'UTC'}), Date.UTC(2026, 10, 5, 10, 0));
  eq(A.startMs({start: '2026-01-15T10:00', tz: 'Europe/Bucharest'}), Date.UTC(2026, 0, 15, 8, 0));
  eq(A.startMs({start: '2026-07-15T10:00', tz: 'Europe/Bucharest'}), Date.UTC(2026, 6, 15, 7, 0));
  eq(A.startMs({start: '2026-03-29T04:30', tz: 'Europe/Bucharest'}), Date.UTC(2026, 2, 29, 1, 30), 'după saltul DST');
  yes(isNaN(A.startMs({start: 'x'})), 'invalid');
});
T('merge: sare peste același uid sau aceeași amprentă, păstrează ordinea', () => {
  const a = A.normalize([{title: 'A', start: '2026-01-01', uid: '1'}]), b = A.normalize([{title: 'a', start: '2026-01-01', uid: '2'}, {title: 'B', start: '2026-01-02', uid: '1'}, {title: 'C', start: '2026-01-03', uid: '3'}]);
  const m = A.merge(a, b); eq(m.added.length, 1); eq(m.skipped, 2); eq(m.items.map((x) => x.title), ['A', 'C']);
});
T('CLEPSIDRA: program + evenimente → elemente → program + evenimente (dus-întors)', () => {
  const sched = {weekday: [{start: '23:00', end: '07:00', cat: 'somn'}, {start: '09:00', end: '17:00', cat: 'serviciu'}], weekend: [{start: '00:00', end: '09:00', cat: 'somn'}]};
  const now = Date.UTC(2026, 10, 3, 12, 0), ts = Date.UTC(2026, 10, 20, 18, 30);
  const it = A.fromClepsidra(sched, [{name: 'Concert', ts}], {now});
  eq(it.length, 4); eq(it[0].kind, 'block'); eq(it[0].start.slice(11), '23:00'); eq(it[0].end.slice(0, 10), it[0].start.slice(0, 10).replace(/\d\d$/, (d) => String(+d + 1).padStart(2, '0')), 'peste miezul nopții');
  const back = A.toClepsidra(A.fromICS(A.toICS(it)), {now});
  eq(back.schedule, sched); eq(back.events, [{name: 'Concert', ts}]);
});
T('CLEPSIDRA: evenimente trecute sau recurente nu devin numărători, max 6', () => {
  const now = Date.UTC(2026, 0, 1), many = []; for (let i = 0; i < 9; i++) many.push({title: 'E' + i, start: new Date(now + (i + 1) * 864e5).toISOString().slice(0, 16), tz: 'UTC', uid: 'e' + i});
  many.push({title: 'trecut', start: '2020-01-01T10:00', tz: 'UTC', uid: 'p'}, {title: 'rec', start: '2027-01-01T10:00', tz: 'UTC', uid: 'r', rrule: 'FREQ=DAILY'});
  const r = A.toClepsidra(A.normalize(many), {now}); eq(r.events.length, 6); yes(r.events.every((e) => e.name !== 'trecut' && e.name !== 'rec'), 'filtrare'); eq(r.schedule, null);
});
T('fromEnvelope: agenda/fff, events/ics, tip străin', () => {
  eq(A.fromEnvelope({type: 'agenda/fff', payload: {v: 1, items: [{title: 'x', start: '2026-01-01'}]}}).length, 1);
  eq(A.fromEnvelope({type: 'agenda/fff', payload: {v: 2, items: [{title: 'x', start: '2026-01-01'}]}}).length, 0);
  eq(A.fromEnvelope({type: 'events/ics', payload: 'BEGIN:VEVENT\nSUMMARY:t\nDTSTART:20260101\nEND:VEVENT'}).length, 1);
  eq(A.fromEnvelope({type: 'table/csv', payload: 'a'}).length, 0);
});
T('plic real: create → serialize → parse → fromEnvelope (cu FFF.envelope)', () => {
  globalThis.window = globalThis; const E = require(path.join(HUB, 'tools/fff-envelope.js')); globalThis.FFF = {envelope: E};
  const env = A.envelope(A.normalize([{title: 'x', start: '2026-01-01T10:00'}]), {app: 'Orar'});
  yes(E.validate(E.normalize(env)).ok, 'valid'); eq(env.type, 'agenda/fff');
  eq(A.fromEnvelope(E.parse(E.serialize(env))).length, 1);
});
T('I18N: 8 limbi cu aceleași chei', () => {
  const ks = Object.keys(A.I18N.ro).sort(); eq(Object.keys(A.I18N).sort(), ['de', 'en', 'es', 'fr', 'hu', 'it', 'pt', 'ro']);
  for (const l in A.I18N) eq(Object.keys(A.I18N[l]).sort(), ks, l);
});
console.log(`\n${ok} ok, ${bad} eșuate`); process.exit(bad ? 1 : 0);
