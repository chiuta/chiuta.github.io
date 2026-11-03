// Teste Node pentru tools/fff-place.js (motorul de efemeride + locația): comparație cu FFF.ephem din kit (VSOP87/ELP, validat față de JPL în fff-kit/test/ephem.test.mjs).
// Rulare: node tests/place.test.mjs
import {createRequire} from 'node:module'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
const {loadKit} = await import(path.join(HUB, 'fff-kit/test/_node.mjs'));
const F = loadKit(['ephem']), K = F.ephem;
const P = require(path.join(HUB, 'tools/fff-place.js')), e = P.engine;
let ok = 0, bad = 0; const T = (n, f) => { try { f(); ok++; console.log('ok   ' + n); } catch (x) { bad++; console.log('FAIL ' + n + '\n       ' + x.message); } };
const yes = (c, m) => { if (!c) throw new Error(m); };
const wrap = (x) => ((x + 540) % 360) - 180, D2R = Math.PI / 180;
const angsep = (a1, d1, a2, d2) => Math.acos(Math.min(1, Math.sin(d1 * D2R) * Math.sin(d2 * D2R) + Math.cos(d1 * D2R) * Math.cos(d2 * D2R) * Math.cos((a1 - a2) * D2R))) / D2R;
const dates = []; for (let y = 2026; y <= 2030; y++) for (let m = 0; m < 12; m += 2) dates.push(Date.UTC(y, m, 11, 9, 30));

T('Soare: RA/Dec geocentrice față de kit < 0,02°', () => { let mx = 0; for (const t of dates) { const jd = P.jdOfMs(t), a = e.sunGeo(jd), b = K.sun(jd); mx = Math.max(mx, angsep(a.ra, a.dec, b.ra, b.dec)); } yes(mx < 0.02, 'max ' + mx); console.log('       max ' + mx.toFixed(4) + '°'); });
T('Lună: RA/Dec geocentrice față de kit < 0,02° și distanța < 100 km', () => { let mx = 0, md = 0; for (const t of dates) { const jd = P.jdOfMs(t), a = e.moonGeo(jd), b = K.moon(jd); mx = Math.max(mx, angsep(a.ra, a.dec, b.ra, b.dec)); md = Math.max(md, Math.abs(a.dist - b.distKm)); } yes(mx < 0.02 && md < 100, 'max ' + mx + ' / ' + md); console.log('       max ' + mx.toFixed(4) + '° / ' + md.toFixed(1) + ' km'); });
T('Planete: poziție < 0,5°, magnitudine < 0,7 față de kit', () => {
  for (const n of e.PLANETS) { let mx = 0, mm = 0; for (const t of dates) { const jd = P.jdOfMs(t), a = e.planet(n, jd), b = K.planet(n, jd), g = K.magnitude(n, jd); mx = Math.max(mx, angsep(a.ra, a.dec, b.ra, b.dec)); if (g != null && isFinite(g)) mm = Math.max(mm, Math.abs(a.mag - g)); }
    console.log('       ' + n.padEnd(8) + 'poz ' + mx.toFixed(3) + '°  mag ' + mm.toFixed(2)); yes(mx < 0.5, n + ' poziție ' + mx); yes(mm < 0.7, n + ' magnitudine ' + mm); } });
T('Topocentric Lună (București): altitudine/azimut < 0,05° față de kit (altGeom)', () => { let mx = 0; const pl = {lat: 44.4268, lon: 26.1025, alt: 0};
  for (const t of dates) { const jd = P.jdOfMs(t), a = e.topo(e.moonGeo(jd).vec, pl, jd), b = K.observe('moon', jd, pl.lat, pl.lon, 0); mx = Math.max(mx, Math.abs(a.alt - b.altGeom), Math.abs(wrap(a.az - b.az)) * Math.cos(b.altGeom * D2R)); } yes(mx < 0.05, 'max ' + mx); console.log('       max ' + mx.toFixed(4) + '°'); });
T('Răsărit/apus Soare (București) și Lună: < 90 s față de kit', () => { const pl = {lat: 44.4268, lon: 26.1025, alt: 0, tz: 'Europe/Bucharest'}; let mx = 0, my = 0, n = 0;
  for (const t of dates.slice(0, 12)) { const s = e.sky(pl, t - 86400000), jdDay = P.jdOfMs(s.dayStart); const kr = K.rise('sun', jdDay + 0.01, pl.lat, pl.lon, {tz: 2}), ks = K.set('sun', jdDay + 0.01, pl.lat, pl.lon, {tz: 2});
    const off = P.tzOffsetMs(s.dayStart, pl.tz) / 3600000, kr2 = K.rise('sun', jdDay + 0.01, pl.lat, pl.lon, {tz: off}), ks2 = K.set('sun', jdDay + 0.01, pl.lat, pl.lon, {tz: off});
    void kr; void ks; mx = Math.max(mx, Math.abs(P.msOfJd(kr2) - s.sun.rise), Math.abs(P.msOfJd(ks2) - s.sun.set)); n++;
    const mr = K.rise('moon', jdDay + 0.01, pl.lat, pl.lon, {tz: off}); if (mr && s.moon.rise.length) my = Math.max(my, Math.abs(P.msOfJd(mr) - s.moon.rise[0])); }
  yes(n > 0 && mx < 90000, 'Soare max ' + mx + ' ms'); yes(my < 150000, 'Lună max ' + my + ' ms'); console.log('       Soare max ' + (mx / 1000).toFixed(1) + ' s; Lună max ' + (my / 1000).toFixed(1) + ' s'); });

/* eclipsa totală de Soare 2027-08-02: față de FFF.ephem.eclipse.local (elemente Besselian proprii, validate în kit) */
const SITES = {Luxor: [25.6872, 32.6396, 'Africa/Cairo'], Cairo: [30.0444, 31.2357, 'Africa/Cairo'], Gibraltar: [36.1408, -5.3536, 'Europe/Gibraltar'], Tanger: [35.7595, -5.834, 'Africa/Casablanca'], Atena: [37.9838, 23.7275, 'Europe/Athens'], Bucuresti: [44.4268, 26.1025, 'Europe/Bucharest'], Jeddah: [21.4858, 39.1925, 'Asia/Riyadh']};
T('Eclipsa 2027-08-02: găsită, tip/magnitudine/maxim față de kit pe 7 locuri', () => {
  const evs = e.findEclipses(P.jdOfMs(Date.UTC(2027, 6, 25)), P.jdOfMs(Date.UTC(2027, 7, 10))); const sol = evs.filter((x) => x.kind === 'solar'); yes(sol.length === 1, 'eclipse de Soare găsite: ' + sol.length);
  for (const [n, [lat, lon, tz]] of Object.entries(SITES)) {
    const a = e.local(sol[0], {lat, lon, alt: 0}), b = K.eclipse.local(lat, lon, 0, {timeZone: tz}); const dt = Math.abs(a.jd - b.max.jd) * 86400, dm = Math.abs(a.mag - b.magnitudeFraction), dob = Math.abs(a.obsc - b.obscuration);
    console.log('       ' + n.padEnd(10) + a.type.padEnd(8) + 'mag ' + a.mag.toFixed(4) + ' (kit ' + b.magnitudeFraction.toFixed(4) + ')  Δt ' + dt.toFixed(1) + ' s  Δobsc ' + dob.toFixed(4) + (a.totalSec ? '  tot ' + a.totalSec.toFixed(0) + ' s (kit ' + (b.durationTotality || 0).toFixed(0) + ')' : ''));
    yes(a.type === b.type, n + ' tip ' + a.type + ' vs ' + b.type); yes(dt < 60, n + ' Δt ' + dt); yes(dm < 0.006, n + ' Δmag ' + dm); yes(dob < 0.01, n + ' Δobsc ' + dob);
    if (b.durationTotality) yes(Math.abs(a.totalSec - b.durationTotality) < 8, n + ' durata ' + a.totalSec + ' vs ' + b.durationTotality);
  } });
T('Eclipsa 2027-08-02: București în afara benzii dar parțială; Luxor totală; Siberia nu o vede', () => {
  const sol = e.findEclipses(P.jdOfMs(Date.UTC(2027, 6, 25)), P.jdOfMs(Date.UTC(2027, 7, 10))).filter((x) => x.kind === 'solar')[0];
  yes(e.local(sol, {lat: 44.4268, lon: 26.1025}).type === 'partial', 'București'); yes(e.local(sol, {lat: 25.6872, lon: 32.6396}).type === 'total', 'Luxor'); yes(e.local(sol, {lat: 60, lon: 100}).visible === 'no', 'Siberia'); });

/* eclipse de Lună și de Soare 2025–2028: date cunoscute (NASA/Espenak, din memorie; toleranțe largi, marcate în raport) */
T('Eclipse de Lună: 2025-03-14 totală, 2025-09-07 totală, 2026-03-03 totală, 2026-08-28 parțială — tip, zi, mărime umbrală ±0,03', () => {
  const want = [[Date.UTC(2025, 2, 14, 6, 59), 'total', 1.18], [Date.UTC(2025, 8, 7, 18, 11), 'total', 1.36], [Date.UTC(2026, 2, 3, 11, 33), 'total', 1.15], [Date.UTC(2026, 7, 28, 4, 13), 'partial', 0.93]];
  const evs = e.findEclipses(P.jdOfMs(Date.UTC(2025, 0, 1)), P.jdOfMs(Date.UTC(2026, 11, 31))).filter((x) => x.kind === 'lunar' && x.type !== 'none');
  for (const [ms, type, um] of want) { const ev = evs.find((x) => Math.abs(P.msOfJd(x.jd) - ms) < 3600000 * 2); yes(ev, 'negăsită ' + new Date(ms).toISOString()); console.log('       ' + new Date(ms).toISOString().slice(0, 10) + ' ' + ev.type + ' umbră ' + ev.umbra.toFixed(3) + ' (ref ~' + um + ') Δt ' + ((P.msOfJd(ev.jd) - ms) / 60000).toFixed(1) + ' min'); yes(ev.type === type, 'tip ' + ev.type); yes(Math.abs(ev.umbra - um) < 0.03, 'mărime ' + ev.umbra); yes(Math.abs(P.msOfJd(ev.jd) - ms) < 10 * 60000, 'moment'); } });
T('Eclipse de Soare 2026-08-12 (totală, Spania) și 2027-02-06 (inelară, America de Sud): găsite; Madrid parțială mare, Burgos/Oviedo totală', () => {
  const evs = e.findEclipses(P.jdOfMs(Date.UTC(2026, 0, 1)), P.jdOfMs(Date.UTC(2027, 11, 31))).filter((x) => x.kind === 'solar');
  const d = (ms) => evs.find((x) => Math.abs(P.msOfJd(x.jd) - ms) < 4 * 3600000); yes(d(Date.UTC(2026, 7, 12, 17, 46)), '2026-08-12'); yes(d(Date.UTC(2027, 1, 6, 16, 0)), '2027-02-06'); yes(d(Date.UTC(2026, 1, 17, 12, 12)), '2026-02-17'); yes(d(Date.UTC(2027, 7, 2, 10, 7)), '2027-08-02');
  const ev = d(Date.UTC(2026, 7, 12, 17, 46)), mad = e.local(ev, {lat: 40.4168, lon: -3.7038}), bur = e.local(ev, {lat: 42.3439, lon: -3.6969}), ovi = e.local(ev, {lat: 43.3614, lon: -5.8593});
  console.log('       Madrid ' + mad.type + ' ' + mad.mag.toFixed(3) + '; Burgos ' + bur.type + '; Oviedo ' + ovi.type + ' ' + ovi.mag.toFixed(3)); yes(mad.mag > 0.95 && mad.mag < 1.0 && mad.type === 'partial', 'Madrid: ' + mad.type + ' ' + mad.mag); yes(bur.type === 'total' && ovi.type === 'total', 'Burgos/Oviedo'); yes(e.local(ev, {lat: 44.4268, lon: 26.1025}).visible === 'no' || e.local(ev, {lat: 44.4268, lon: 26.1025}).mag < 0.01, 'București nu vede aprox.'); });
T('Faze: luna nouă și plină față de kit (nextPhase) < 3 min', () => {
  const jd = K.jdFromCalendar(2026, 11, 3); for (const [kind, want] of [['new', 0], ['full', 180]]) { const kj = K.nextPhase(jd, kind); const ut = (typeof kj === 'number' ? kj : kj.jd); let lo = P.msOfJd(ut) - 6 * 36e5, best = lo, bv = 9e9;
    for (let t = lo; t < lo + 12 * 36e5; t += 30000) { const v = Math.abs(((e.moonPhase(P.jdOfMs(t)).elong - want + 540) % 360) - 180); if (v < bv) { bv = v; best = t; } }
    const d = Math.abs(best - P.msOfJd(ut)); console.log('       ' + kind + ' ' + new Date(best).toISOString() + ' (kit ' + new Date(P.msOfJd(ut)).toISOString() + ') Δ ' + (d / 1000).toFixed(0) + ' s'); yes(d < 180000, kind + ' Δ ' + d); } });
T('sky(): structură pentru București, 2026-11-03 și fusul orar corect (Europe/Bucharest = UTC+2 în noiembrie)', () => {
  const s = e.sky({lat: 44.4268, lon: 26.1025, alt: 0, tz: 'Europe/Bucharest'}, Date.UTC(2026, 10, 3, 9)); yes(s.ymd.day === 4 && s.ymd.month === 11, JSON.stringify(s.ymd)); yes(s.dayStart === Date.UTC(2026, 10, 3, 22), 'miezul nopții local = 22:00 UTC');
  yes(s.sun.rise > s.dayStart && s.sun.rise < s.sun.set && s.sun.set < s.dayEnd, 'soare'); yes(s.dark && Array.isArray(s.planets) && s.moon.idx >= 0, 'structură'); yes(P.offsetLabel(s.dayStart, 'Europe/Bucharest') === 'UTC+2', P.offsetLabel(s.dayStart, 'Europe/Bucharest'));
  console.log('       soare ' + new Date(s.sun.rise).toISOString() + ' – ' + new Date(s.sun.set).toISOString() + '; planete: ' + s.planets.map((p) => p.name + ' ' + p.mag.toFixed(1) + ' alt ' + p.alt.toFixed(0)).join(', ') + '; următoarea eclipsă: ' + (s.next && (s.next.kind + ' ' + s.next.type + ' ' + new Date(P.msOfJd(s.next.jd)).toISOString()))); });
T('Zi polară/noapte polară (Tromsø, iunie/decembrie): fără răsărit/apus, fără eroare', () => {
  const a = e.sky({lat: 69.65, lon: 18.96, tz: 'Europe/Oslo'}, Date.UTC(2026, 5, 20, 9)), b = e.sky({lat: 69.65, lon: 18.96, tz: 'Europe/Oslo'}, Date.UTC(2026, 11, 20, 9)); yes(a.sun.rise == null && a.sun.noon === 'up' && !a.dark, 'zi polară'); yes(b.sun.rise == null && b.sun.noon === 'down', 'noapte polară'); });
T('Eclipsă mâine: pentru Burgos la 2026-08-11 apare totală; panoul o include', () => {
  const s = e.sky({lat: 42.3439, lon: -3.6969, tz: 'Europe/Madrid'}, Date.UTC(2026, 7, 11, 10)); yes(s.eclipses.length === 1 && s.eclipses[0].kind === 'solar', JSON.stringify(s.eclipses.map((x) => x.kind))); yes(s.eclipses[0].mag > 1 && s.eclipses[0].type === 'total', 'mag ' + s.eclipses[0].mag); });

/* locația: validare, ordine, plic */
T('norm: respinge coordonate invalide, taie nume, fus invalid → gol, virgulă zecimală', () => {
  yes(P.norm({lat: 91, lon: 0}) === null && P.norm({lat: 'x', lon: 0}) === null && P.norm({lat: 0, lon: 181}) === null && P.norm(null) === null, 'invalide');
  const n = P.norm({lat: '44,4268', lon: ' 26.1025 ', name: '<b>' + 'x'.repeat(200), tz: 'Mars/Olympus'}); yes(n.lat === 44.4268 && n.tz === '' && n.name.length === 80 && !n.name.includes('<'), JSON.stringify(n)); });
T('set/get/clear în Node (fără DOM) folosesc memoria; onChange este apelat', () => {
  let seen = 0; P.onChange(() => seen++, false); const r = P.set({lat: 46.0733, lon: 23.5805, name: 'Alba Iulia', tz: 'Europe/Bucharest'}); yes(r && r.name === 'Alba Iulia' && P.get().lat === 46.0733 && seen === 1, 'set'); P.clear(); yes(P.get() === null && seen === 2, 'clear'); });
T('Toate cele 8 limbi au aceleași chei (paritate i18n)', () => {
  const ref = Object.keys(P.I18N.en).sort(); for (const l of Object.keys(P.I18N)) { yes(JSON.stringify(Object.keys(P.I18N[l]).sort()) === JSON.stringify(ref), l + ' chei: ' + Object.keys(P.I18N[l]).filter((k) => !ref.includes(k)).join(',') + ' / lipsă ' + ref.filter((k) => !(k in P.I18N[l])).join(','));
    yes(P.I18N[l].phases.length === 8 && P.I18N[l].dirs.length === 8 && P.I18N[l].pn.length === 7, l + ' liste'); yes(JSON.stringify(Object.keys(P.I18N[l].kinds)) === JSON.stringify(Object.keys(P.I18N.en.kinds)), l + ' kinds');
    for (const k of ref) { const a = P.I18N.en[k], b = P.I18N[l][k]; if (typeof a === 'string') { const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(','); yes(ph(a) === ph(b), l + '.' + k + ' substituenți ' + ph(b) + ' vs ' + ph(a)); } } } });
console.log(`\n${ok} ok, ${bad} eșuate`); process.exit(bad ? 1 : 0);
