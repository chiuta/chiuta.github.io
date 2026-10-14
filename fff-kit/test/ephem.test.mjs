// Teste FFF.ephem: comparație cu referințe INDEPENDENTE (test/ref/ephem-ref.json, generat de test/ref/make_ephem_ref.py din JPL DE421/DE423 + ERFA,
// astropy/IERS și pyephem), cu praguri documentate în docs/ephem.md. Rulare: node test/ephem.test.mjs  (opțional: EPHEM_REPORT=cale.json scrie tabelul erorilor).
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import {loadKit, ok, eq, done, kitDir} from './_node.mjs';
const F = loadKit(['ephem']); const E = F.ephem;
vm.runInThisContext(fs.readFileSync(path.join(kitDir, 'src', 'ephem-stars.js'), 'utf8'), {filename: 'ephem-stars.js'});
const REF = JSON.parse(fs.readFileSync(path.join(kitDir, 'test', 'ref', 'ephem-ref.json'), 'utf8'));
const D2R = Math.PI / 180;
const report = {generated: new Date().toISOString().slice(0, 10), refs: REF.meta, sections: {}};

// ---------- utilitare de statistică ----------
const stat = {};   // nume → {n, max, sum, thr, unit}
function rec(name, value, thr, unit, info) {
  const s = stat[name] || (stat[name] = {n: 0, max: 0, sum: 0, thr, unit, worst: null});
  const v = Math.abs(value); s.n++; s.sum += v; if (v > s.max) { s.max = v; s.worst = info || null; }
  if (!(v <= thr)) ok(false, `${name}: ${v.toPrecision(4)} ${unit} > prag ${thr} ${unit} (${JSON.stringify(info)})`); else ok(true, name);
}
function sep(a1, d1, a2, d2) {   // arcsec
  const x = [a1, d1, a2, d2].map(v => v * D2R), dl = x[2] - x[0];
  const y = Math.hypot(Math.cos(x[3]) * Math.sin(dl), Math.cos(x[1]) * Math.sin(x[3]) - Math.sin(x[1]) * Math.cos(x[3]) * Math.cos(dl));
  const c = Math.sin(x[1]) * Math.sin(x[3]) + Math.cos(x[1]) * Math.cos(x[3]) * Math.cos(dl);
  return Math.atan2(y, c) / D2R * 3600;
}
const wrap = x => ((x + 540) % 360) - 180;

// ---------- 1. timp ----------
{
  eq(E.jdFromCalendar(2000, 1, 1, 12), 2451545.0, 'JD J2000');
  eq(E.jdFromCalendar(1987, 4, 10, 0), 2446895.5, 'JD Meeus 7.a');
  eq(E.jdFromCalendar(1957, 10, 4, 19, 26, 24), 2436116.31, 'JD Sputnik (Meeus 7.a)');
  eq(E.jdFromCalendar(333, 1, 27, 12), 1842713.0, 'JD 333-01-27 (Meeus 7.b, calendar iulian)');
  eq(E.jdFromCalendar(1582, 10, 15, 0), 2299160.5, 'JD 1582-10-15');
  eq(E.jdFromCalendar(1582, 10, 4, 0), 2299159.5, 'JD 1582-10-04 (iulian)');
  const c = E.calendarFromJd(2436116.31); ok(c.y === 1957 && c.mo === 10 && c.d === 4 && c.h === 19 && c.mi === 26 && Math.abs(c.s - 24) < 0.01, 'calendarFromJd roundtrip ' + JSON.stringify(c));
  ok(E.dateFromJd(2451545.0).toISOString() === '2000-01-01T12:00:00.000Z', 'dateFromJd');
  ok(Math.abs(E.jdFromDate(new Date(Date.UTC(2027, 7, 2, 10, 0, 0))) - 2461619.9166667) < 1e-6, 'jdFromDate(Date)');
  for (let y = 1700; y <= 2200; y += 7) { const jd = E.jdFromCalendar(y, (y % 12) + 1, (y % 27) + 1, 13.5); const q = E.calendarFromJd(jd); ok(q.y === y && q.mo === (y % 12) + 1 && q.d === (y % 27) + 1, 'roundtrip calendar ' + y); }
  for (const r of REF.deltaT) rec('ΔT față de IERS (1973–2026)', E.deltaT(r.jd) - r.deltaT, 0.15, 's', r);
  // valori de control ale polinoamelor Espenak–Meeus (NASA): 1900 → −2,79 s; 1950 → 29,07 s; 1700 → 8,83 s; 1800 → 13,72 s
  ok(Math.abs(E.deltaT(E.jdFromCalendar(1900, 1, 1)) + 2.79) < 0.01, 'ΔT 1900'); ok(Math.abs(E.deltaT(E.jdFromCalendar(1950, 1, 1)) - 29.07) < 0.01, 'ΔT 1950');
  ok(Math.abs(E.deltaT(E.jdFromCalendar(1700, 1, 1)) - 8.83) < 0.01, 'ΔT 1700'); ok(Math.abs(E.deltaT(E.jdFromCalendar(1800, 1, 1)) - 13.72) < 0.02, 'ΔT 1800');
  ok(E.deltaT(E.jdFromCalendar(2100, 1, 1)) > 150 && E.deltaT(E.jdFromCalendar(2100, 1, 1)) < 210, 'ΔT 2100 plauzibil');
  E.setDeltaT(70); eq(E.deltaT(2461000), 70, 'setDeltaT constant'); E.setDeltaT(null);
  const tt = 2461000.123; ok(Math.abs(E.tt(E.ut(tt)) - tt) < 1e-9, 'ut/tt inverse');
}

// ---------- 2. timp sideral ----------
for (const r of REF.gast) rec('timp sideral aparent (GAST) față de ERFA gst06a', wrap(E.gast(r.ut1) - r.gast) * 3600, 0.3, '″', r);
ok(Math.abs(E.gmst(E.jdFromCalendar(1987, 4, 10, 0)) / 15 - 13.1795463) < 1e-6, 'GMST Meeus 12.a');
ok(Math.abs(E.gmst(E.jdFromCalendar(1987, 4, 10, 19, 21, 0)) / 15 - 8.5825248) < 1e-6, 'GMST Meeus 12.b');

// ---------- 3. poziții aparente ----------
const BODIES = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const POS_THR = {sun: 1.5, moon: 1.5, mercury: 2, venus: 3, mars: 3, jupiter: 2, saturn: 2, uranus: 3, neptune: 5, pluto: 7};    // ″
const DIST_THR = {sun: 5e-6, moon: 2e-5, mercury: 1e-5, venus: 2e-5, mars: 2e-5, jupiter: 5e-6, saturn: 5e-6, uranus: 1e-5, neptune: 1e-5, pluto: 2e-5};
for (const r of REF.positions) {
  const ut = E.ut(r.tt);
  for (const b of BODIES) {
    const o = E.planet(b, ut);
    rec(`poziție aparentă ${b} (ra/dec) față de DE421/423`, sep(o.ra, o.dec, r[b][0], r[b][1]), POS_THR[b], '″', {tt: r.tt, src: r.src});
    rec(`distanță ${b} (eroare relativă)`, o.dist / r[b][2] - 1, DIST_THR[b], '', {tt: r.tt});
  }
  const o = E.sun(ut); ok(Math.abs(wrap(o.lon - (E.eqToEcl(o.ra, o.dec, ut).lon)) ) < 0.01, 'coerență lon/ra Soare (oblicitate adevărată vs medie ≤ 0,01°)');
}
// ELP/MPP02 (folosit) față de Meeus cap. 47 (verificare încrucișată internă)
for (let i = 0; i < 60; i++) {
  const jd = 2415020.5 + i * 1217.3, a = E.moonMeeus(jd), tt = E.tt(jd), o = E.moon(jd);
  // aceeași mărime geometrică: comparăm lon (mediu al datei) — ELP vs Meeus trebuie să difere sub 12″
  const dl = Math.abs(wrap(o.lon - (a.lon + E.nutation(jd).dpsi))) * 3600; rec('Lună: ELP/MPP02 față de Meeus 47 (longitudine, inclusiv ~0,7″ timp-lumină)', dl, 14, '″', {jd});
}
// constrângeri de coerență
{
  const o = E.moon(2461000.5); ok(o.illum >= 0 && o.illum <= 1 && o.angle >= 0 && o.angle < 360, 'Lună: iluminare/unghi în domeniu');
  const v = E.planet('venus', 2461000.5); ok(v.mag < -3 && v.mag > -5, 'Venus: mărime plauzibilă (' + v.mag.toFixed(2) + ')');
  let threw = false; try { E.planet('xyz', 2461000.5); } catch (e) { threw = true; } ok(threw, 'corp necunoscut → eroare');
  eq(E.planet('marte', 2461000.5).name, 'mars', 'alias românesc Marte');
}

// ---------- 4. orizontale ----------
for (const r of REF.horizontal) {
  const o = E.observe(r.body, r.ut1, r.lat, r.lon, r.elev);
  const dalt = (o.altGeom - r.alt) * 3600, daz = wrap(o.az - r.az) * 3600 * Math.cos(Math.max(-89, Math.min(89, r.alt)) * D2R);
  rec('altitudine topocentrică față de DE421', dalt, 2, '″', {b: r.body, site: r.site}); rec('azimut topocentric față de DE421 (×cos alt)', daz, 2, '″', {b: r.body, site: r.site, alt: r.alt});
}
{   // refracție: valori Sæmundsson/Bennett cunoscute (1010 hPa, 10 °C)
  ok(Math.abs(E.refraction(0) * 60 - 28.8) < 1.5, 'refracție la 0° ≈ 29′ (' + (E.refraction(0) * 60).toFixed(1) + '′)');
  ok(Math.abs(E.refraction(45) * 60 - 0.98) < 0.1, 'refracție la 45° ≈ 1′'); ok(Math.abs(E.refraction(90)) < 0.002, 'refracție la zenit ≈ 0');
  ok(E.refraction(-5) === 0 && E.refraction(-1.5) >= 0, 'refracție sub orizont limitată');
  const h = E.toHorizontal(0, 0, 2451545.0, 0, 0, {refraction: true}); ok(h.alt >= h.altGeom, 'refracția ridică altitudinea');
}

// ---------- 5. răsărit / apus / trecere / crepuscule ----------
const J2 = jd => (jd == null ? null : jd);
for (const r of REF.riseSet) {
  const when = r.sun.jd0 + 0.5;   // oricând în ziua locală
  const chk = (label, jsEv, refEv, thrS, info) => {
    if (refEv == null && jsEv == null) { ok(true, label + ' (ambele lipsesc)'); return; }
    if ((refEv == null) !== (jsEv == null)) { ok(false, `${label}: eveniment prezent doar într-una (JS=${jsEv}, ref=${refEv}) ${JSON.stringify(info)}`); return; }
    rec(label, (jsEv - refEv) * 86400, thrS, 's', info);
  };
  const info = {site: r.site, date: r.date};
  const s = E.riseSetTransit('sun', when, r.lat, r.lon, {tz: r.tz});
  if (r.sun.status !== 'normal' && r.sun.status !== s.status && !(s.status === 'noRise' || s.status === 'noSet')) ok(false, `stare Soare ${r.site} ${r.date}: JS=${s.status}, ref=${r.sun.status}`); else ok(true, 'stare Soare');
  chk('răsărit Soare', s.rise, r.sun.rise, 1, info); chk('apus Soare', s.set, r.sun.set, 1, info); chk('trecere Soare', s.transit, r.sun.transit, 1, info);
  const m = E.riseSetTransit('moon', when, r.lat, r.lon, {tz: r.tz});
  chk('răsărit Lună', m.rise, r.moon.rise, 2, info); chk('apus Lună', m.set, r.moon.set, 2, info); chk('trecere Lună', m.transit, r.moon.transit, 2, info);
  const j = E.riseSetTransit('jupiter', when, r.lat, r.lon, {tz: r.tz});
  chk('răsărit Jupiter', j.rise, r.jupiter.rise, 2, info); chk('apus Jupiter', j.set, r.jupiter.set, 2, info); chk('trecere Jupiter', j.transit, r.jupiter.transit, 2, info);
  const v = E.riseSetTransit('venus', when, r.lat, r.lon, {tz: r.tz});
  chk('răsărit Venus', v.rise, r.venus.rise, 2, info); chk('apus Venus', v.set, r.venus.set, 2, info);
  const tw = E.twilight(when, r.lat, r.lon, {tz: r.tz});
  for (const k of ['civil', 'nautical', 'astronomical']) { chk(`crepuscul ${k} (dimineața)`, tw[k].dawn, r['tw_' + k].rise, 1.5, info); chk(`crepuscul ${k} (seara)`, tw[k].dusk, r['tw_' + k].set, 1.5, info); }
}
{   // cazuri polare, evenimente absente
  const mid = E.riseSetTransit('sun', E.jdFromCalendar(2026, 6, 21, 12), 69.6492, 18.9553, {tz: 2}); eq(mid.status, 'alwaysUp', 'Tromsø: Soarele de la miezul nopții');
  const win = E.riseSetTransit('sun', E.jdFromCalendar(2026, 12, 21, 12), 69.6492, 18.9553, {tz: 1}); eq(win.status, 'alwaysDown', 'Tromsø: noaptea polară');
  const eq0 = E.riseSetTransit('sun', E.jdFromCalendar(2026, 3, 20, 12), 0, 0, {tz: 0}); ok(eq0.rise != null && eq0.set != null && Math.abs((eq0.set - eq0.rise) * 24 - 12.1) < 0.2, 'Ecuator la echinocțiu: zi ≈ 12 h');
  ok(typeof E.rise('sun', E.jdFromCalendar(2026, 10, 14, 12), 44.4268, 26.1025, {tz: 3}) === 'number', 'rise() → număr');
}

// ---------- 6. faze lunare ----------
const PUB = [   // momente publicate (UTC; surse uzuale: USNO/NASA, precizie la minut) — comparație cu ±3 min
  ['new', '2000-01-06T18:14'], ['full', '2000-01-21T04:40'], ['full', '2018-01-31T13:27'], ['new', '2017-08-21T18:30'], ['full', '2019-01-21T05:16'], ['full', '2021-05-26T11:14'],
  ['new', '2023-10-14T17:55'], ['new', '2024-04-08T18:21'], ['new', '2026-08-12T17:37'], ['new', '2027-08-02T10:05']];
for (const [k, iso] of PUB) { const t = Date.parse(iso + ':00Z') / 86400000 + 2440587.5; const f = E.nextPhase(t - 3, k, 1); rec('fază lunară față de valori publicate (minut)', (f - t) * 86400, 200, 's', {k, iso}); }
for (const r of REF.phases) {
  const ttj = r.tt, ut0 = E.ut(ttj);
  const js = E.nextPhase(ut0 - 4, r.kind, 1), jsTT = E.tt(js);
  rec(`fază lunară ${r.kind} față de DE421 (TT)`, (jsTT - ttj) * 86400, 5, 's', {tt: ttj});
}
{
  const ph = E.moonPhases(E.jdFromCalendar(2026, 1, 1), E.jdFromCalendar(2026, 12, 31));
  ok(ph.length >= 48 && ph.length <= 50, 'moonPhases: ~49 faze în 2026 (' + ph.length + ')');
  ok(ph.every((p, i) => i === 0 || p.jd > ph[i - 1].jd), 'moonPhases cronologic');
  const kinds = ph.map(p => p.kind).join(','); ok(/^(new,first,full,last,)+/.test(kinds + ',') || /^(first|full|last|new)/.test(kinds), 'moonPhases succesiune');
  for (let i = 1; i < ph.length; i++) { const d = ph[i].jd - ph[i - 1].jd; ok(d > 5.8 && d < 9.5, 'interval între faze 5,8–9,5 zile'); }
  const f = E.moonPhase(ph.find(p => p.kind === 'full').jd); ok(f.illum > 0.998 && f.name === 'full', 'la luna plină iluminare > 0,998');
  const n = E.moonPhase(ph.find(p => p.kind === 'new').jd); ok(n.illum < 0.002 && n.name === 'new', 'la luna nouă iluminare < 0,002');
  const q = E.moonPhase(ph.find(p => p.kind === 'first').jd); ok(Math.abs(q.illum - 0.5) < 0.02 && q.name === 'firstQuarter', 'primul pătrar iluminare ≈ 0,5');
}

// ---------- 7. pyephem (verificare încrucișată) ----------
if (REF.pyephem) {
  for (const row of REF.pyephem.rows) {
    for (const b of BODIES) {
      const p = row[b], o = E.planet(b, row.ut1);
      rec(`poziție ${b} față de pyephem`, sep(o.ra, o.dec, p.ra, p.dec), b === 'moon' ? 40 : (b === 'pluto' ? 40 : 15), '″', {ut: row.ut1});
      if (b !== 'sun') {
        const tol = b === 'moon' ? 0.5 : (b === 'saturn' ? 0.6 : (b === 'mercury' ? (o.phaseAngle < 130 ? 0.4 : 0.9) : 0.25));   // Mercur: formula cubică în unghiul de fază diverge față de libastro spre conjuncție (neobservabil)
        rec(`mărime aparentă ${b} față de pyephem`, o.mag - p.mag, tol, 'mag', {ut: row.ut1, js: o.mag, pe: p.mag});
        rec(`elongație ${b} față de pyephem`, o.elong - Math.abs(p.elong), 0.02, '°', {ut: row.ut1});
        rec(`fracție iluminată ${b} față de pyephem`, o.illum * 100 - p.phase, 0.5, '%', {ut: row.ut1});
      }
    }
  }
}

// ---------- 8. stele ----------
const S = FFF.ephem.stars;
{
  ok(S.count >= 1500 && S.count <= 1700, 'catalog: ' + S.count + ' stele'); ok(S.constellations.length === 88, '88 de constelații');
  ok(S.constellations.every(c => c.ro && c.la && c.en && c.id && c.lines.length > 0), 'toate constelațiile au nume RO/EN/Latin și linii');
  ok(S.list.every(s => s.mag <= 5.0001 && s.ra >= 0 && s.ra < 360 && s.dec >= -90 && s.dec <= 90), 'domenii de valori');
  const named = S.list.filter(s => s.en); ok(named.length >= 140 && named.length <= 170, 'stele cu nume proprii: ' + named.length);
  const sir = S.byHip[32349]; ok(Math.abs(sir.ra - 101.2872) < 0.001 && Math.abs(sir.dec + 16.7161) < 0.001 && sir.mag < -1.4, 'Sirius J2000');
  eq(S.byHip[11767].ro, 'Steaua Polară', 'Polaris în română'); eq(S.find('ursa mare')[0].constellation.id, 'UMa', 'căutare constelație fără diacritice');
  eq(S.find('Betelgeuse')[0].star.hip, 27989, 'Betelgeuse HIP 27989');
  ok(S.color(-0.2) !== S.color(1.6), 'culoare după B−V');
  const nn = S.nearest(101.3, -16.7, 1); eq(nn.star.hip, 32349, 'nearest → Sirius');
  // grilă de linii: fiecare vârf de linie are o stea ≤ 6,5 la < 0,3°? (verificăm doar că liniile sunt în domenii)
  ok(S.constellations.every(c => c.lines.every(pl => pl.every(p => p[0] >= 0 && p[0] <= 360 && p[1] >= -90 && p[1] <= 90))), 'vârfuri de linii în domeniu');
  const asz = S.constellations.reduce((a, c) => a + c.lines.length, 0); ok(asz > 140, 'segmente: ' + asz);
  for (const r of (REF.stars || [])) {
    const st = S.byHip[r.hip]; const p = E.starPosition(st.ra, st.dec, st.pmRa, st.pmDec, E.ut(r.tt));
    rec('poziție aparentă stea (PM+precesie+nutație+aberație) față de ERFA atci13', sep(p.ra, p.dec, r.ra, r.dec), 1.0, '″', {hip: r.hip, tt: r.tt});
  }
}

// ---------- 9. eclipsa din 2 august 2027 ----------
const EC = REF.eclipse;
{
  const g = E.eclipse.greatest();
  // (a) față de valori publicate (NASA/Espenak, rotunjite): γ ≈ 0,1421; maxim ≈ 10:07 UT; magnitudine 1,0790; durata maximă 6 m 23 s; ~25,5°N 33,2°E; lățimea benzii ~258 km
  rec('γ față de valoarea publicată 0,1421', g.gamma - 0.1421, 0.0003, '', g);
  rec('momentul maximului față de „≈ 10:07 UT” (ordin minut)', (g.jd - E.jdFromCalendar(2027, 8, 2, 10, 7, 0)) * 86400, 90, 's', g.utc);
  rec('momentul maximului (TT) față de 10:07:50 TD (valoare publicată, la secundă)', (g.tt - E.jdFromCalendar(2027, 8, 2, 10, 7, 50)) * 86400, 20, 's', g.utc);
  rec('magnitudinea (raport diametre) față de 1,0790', g.magnitude - 1.0790, 0.0005, '', g);
  rec('durata maximă față de 6 m 23 s', g.durationTotality - 383, 1.5, 's', g);
  rec('latitudinea maximului față de 25°31,5′N', g.lat - 25.525, 0.06, '°', g); rec('longitudinea maximului față de 33°09,5′E', g.lon - 33.158, 0.06, '°', g);
  rec('lățimea benzii față de 258 km', g.pathWidthKm - 258, 0.5, 'km', g);
  ok(g.sunAlt > 80 && g.sunAlt < 83, 'altitudinea Soarelui la maxim ≈ 82°');
  // (b) față de referința DE421 (Besselian)
  for (const r of EC.bessel) {
    const b = E.eclipse.bessel(r.tt);
    rec('element Besselian x (raze ecuatoriale ×1e6)', (b.x - r.x) * 1e6, 100, '×1e-6 Re', r.tt); rec('element Besselian y (×1e6)', (b.y - r.y) * 1e6, 100, '×1e-6 Re', r.tt);
    rec('element Besselian d', (b.d - r.d) * 3600, 0.2, '″', r.tt); rec('element Besselian μ', wrap(b.mu - r.mu) * 3600, 0.05, '″', r.tt);
    rec('element Besselian l1 (×1e6)', (b.l1 - r.l1) * 1e6, 5, '×1e-6 Re', r.tt); rec('element Besselian l2 (×1e6)', (b.l2 - r.l2) * 1e6, 5, '×1e-6 Re', r.tt);
  }
  rec('γ față de DE421', g.gamma - EC.greatest.gamma, 0.0001, '', null);
  rec('momentul maximului global față de DE421', (g.jd - EC.greatest.ut) * 86400, 2, 's', null);
  // (c) circumstanțe locale față de calculul prin separare topocentrică (DE421)
  for (const [name, r] of Object.entries(EC.places)) {
    const p = E.eclipse.places[name]; const L = E.eclipse.local(p.lat, p.lon, 0, {timeZone: p.tz});
    eq(L.type, r.type, 'tip eclipsă ' + name);
    if (r.type === 'none') continue;
    const ut = t => E.ut(t);
    rec('contact C1 față de referință', (L.c1.jd - ut(r.t1)) * 86400, 3, 's', name); rec('contact C4 față de referință', (L.c4.jd - ut(r.t4)) * 86400, 3, 's', name);
    rec('momentul maximului local față de referință', (L.max.jd - ut(r.tmax)) * 86400, 3, 's', name);
    rec('magnitudine (fracție) față de referință', L.magnitudeFraction - r.magnitudeFraction, 0.0005, '', name);
    rec('obscurare față de referință', (L.obscuration - r.obscuration) * 100, 0.05, '% din disc', name);
    rec('altitudinea Soarelui la maxim față de referință', L.max.sunAlt - r.sunAlt, 0.02, '°', name);
    if (r.type === 'total') {
      rec('contact C2 față de referință', (L.c2.jd - ut(r.t2)) * 86400, 3, 's', name); rec('contact C3 față de referință', (L.c3.jd - ut(r.t3)) * 86400, 3, 's', name);
      rec('durata totalității față de referință', L.durationTotality - (ut(r.t3) - ut(r.t2)) * 86400, 1.5, 's', name);
    }
  }
  // (d) puncte ale benzii: separarea centrelor la punctul liniei centrale trebuie să fie ≈ 0, iar la limite ≈ raza umbrei
  for (const c of EC.pathChecks) {
    if (c.kind === 'central') rec('linia centrală: separarea Soare–Lună (referință DE421)', c.sepArcsec, 3, '″', c.tt);
    else rec('limita benzii: separarea − raza umbrei (referință DE421)', c.sepArcsec - c.umbraEdgeArcsec, 3, '″', c.tt);
  }
  // (e) România: valori calculate (nu din memorie) + domenii
  for (const [name, lo, hi] of [['București', 0.47, 0.56], ['Constanța', 0.45, 0.54], ['Cluj-Napoca', 0.41, 0.51], ['Iași', 0.36, 0.45], ['Timișoara', 0.47, 0.57], ['Sulina', 0.40, 0.49]]) {
    const p = E.eclipse.places[name], L = E.eclipse.local(p.lat, p.lon, 0, {timeZone: p.tz}); ok(L.type === 'partial' && L.obscuration > lo && L.obscuration < hi, `${name}: parțială, obscurare ${(L.obscuration * 100).toFixed(1)}% în [${lo * 100},${hi * 100}]`);
    ok(L.max.visible && L.max.sunAlt > 50, `${name}: Soarele sus la maxim`);
  }
  const lx = E.eclipse.local(25.6872, 32.6396, 0, {timeZone: 'Africa/Cairo'}); ok(lx.type === 'total' && lx.durationTotality > 370, 'Luxor: totală, durată ' + lx.durationTotality.toFixed(0) + ' s');
  ok(/^1[0-9]:/.test(lx.c2.local) || /^1[0-9]:/.test(lx.max.local), 'Luxor: ora locală (EEST, UTC+3) ≈ 13:05');
  ok(E.eclipse.inBand(36.14, -5.35, 0).inBand && E.eclipse.inBand(35.76, -5.83, 0).inBand, 'Gibraltar și Tanger în bandă');
  ok(!E.eclipse.inBand(44.4268, 26.1025, 0).inBand && !E.eclipse.inBand(48.85, 2.35, 0).inBand && !E.eclipse.inBand(41.9, 12.5, 0).inBand, 'București, Paris, Roma în afara benzii');
  eq(E.eclipse.local(60, 100, 0, {tz: 7}).type, 'none', 'Siberia: fără eclipsă');
  // (f) GeoJSON
  const gj = E.eclipse.path({stepMin: 5}); eq(gj.type, 'FeatureCollection', 'path: FeatureCollection');
  const kinds = gj.features.map(f => f.properties.kind); ok(['central-line', 'north-limit', 'south-limit', 'totality-band', 'greatest-eclipse'].every(k => kinds.includes(k)), 'path: toate straturile');
  const cl = gj.features[0].geometry.coordinates; ok(cl.length >= 30 && cl.length <= 50, 'linia centrală la 5 min: ' + cl.length + ' puncte');
  ok(cl[0][0] < -5 && cl[cl.length - 1][0] > 45, 'banda: de la Atlantic (' + cl[0] + ') la Oceanul Indian/Somalia (' + cl[cl.length - 1] + ')');
  const ring = gj.features[3].geometry.coordinates[0]; eq(JSON.stringify(ring[0]), JSON.stringify(ring[ring.length - 1]), 'poligon închis');
  ok(gj.features[1].geometry.coordinates.length === gj.features[2].geometry.coordinates.length, 'limite N/S de aceeași lungime');
  JSON.stringify(gj);   // serializabil
  const el = E.eclipse.elements(); ok(el.x.length === 4 && el.l1.length === 4 && Math.abs(el.tanf1 - 0.0046) < 0.0002, 'elemente polinomiale');
  // sensibilitatea la raza Lunii (informativ)
  const g2 = E.eclipse.greatest({k: 0.2725076}); ok(g2.durationTotality > g.durationTotality + 2, 'k umbral mai mare (0,2725076) → totalitate mai lungă');
  report.eclipseExtra = {kUmbra0272810: {duration: g.durationTotality, magnitude: g.magnitude, widthKm: g.pathWidthKm}, kUmbra02725076: {duration: g2.durationTotality, magnitude: g2.magnitude, widthKm: g2.pathWidthKm}};
  report.eclipseGreatest = {utc: g.utc, gamma: g.gamma, magnitude: g.magnitude, durationTotality: g.durationTotality, lat: g.lat, lon: g.lon, pathWidthKm: g.pathWidthKm, sunAlt: g.sunAlt};
  const rom = {};
  for (const name of ['București', 'Constanța', 'Cluj-Napoca', 'Iași', 'Timișoara', 'Brașov', 'Craiova', 'Sulina']) {
    const p = E.eclipse.places[name], L = E.eclipse.local(p.lat, p.lon, 0, {timeZone: p.tz}), R = EC.places[name];
    rom[name] = {obscuration: +(L.obscuration * 100).toFixed(1), magnitudeFraction: +L.magnitudeFraction.toFixed(3), c1: L.c1.local, max: L.max.local, c4: L.c4.local, refObscuration: +(R.obscuration * 100).toFixed(1)};
  }
  report.romania = rom;
}

// ---------- 10. API / robustețe ----------
{
  for (const f of ['sun', 'moon', 'planet', 'toHorizontal', 'rise', 'set', 'transit', 'sidereal', 'jdFromDate', 'dateFromJd', 'moonPhase', 'eclipseLocal']) ok(typeof E[f] === 'function', 'API: ' + f);
  ok(Math.abs(E.sidereal(2451545.0, 0, {mean: true}) - E.gmst(2451545.0)) < 1e-9, 'sidereal(mean)');
  ok(E.label('body', 'sun') === 'Soare' || E.label('body', 'sun') === 'Sun', 'etichetă i18n');
  for (const y of [1900, 1950, 2000, 2050, 2100]) { const o = E.sun(E.jdFromCalendar(y, 6, 21)); ok(Number.isFinite(o.ra) && Number.isFinite(o.dist), 'Soare finit în ' + y); }
  // viteză
  const t0 = Date.now(); for (let i = 0; i < 300; i++) { E.sun(2451545 + i); E.moon(2451545 + i); E.planet('saturn', 2451545 + i); } const ms = (Date.now() - t0) / 300; ok(ms < 5, `viteză: ${ms.toFixed(2)} ms pentru Soare+Lună+Saturn`);
  report.timingMsPerTriple = +ms.toFixed(3);
}

// ---------- raport ----------
const rows = Object.entries(stat).map(([name, s]) => ({name, n: s.n, max: +s.max.toPrecision(4), mean: +(s.sum / s.n).toPrecision(4), thr: s.thr, unit: s.unit}));
report.sections = rows;
if (process.env.EPHEM_TABLE) { console.log('\n' + 'măsurătoare'.padEnd(78) + 'n'.padStart(5) + 'max'.padStart(11) + 'medie'.padStart(11) + 'prag'.padStart(9) + '  unit'); for (const r of rows) console.log(r.name.padEnd(78) + String(r.n).padStart(5) + String(r.max).padStart(11) + String(r.mean).padStart(11) + String(r.thr).padStart(9) + '  ' + r.unit); }
if (process.env.EPHEM_REPORT) fs.writeFileSync(process.env.EPHEM_REPORT, JSON.stringify(report, null, 1));
done('ephem');
