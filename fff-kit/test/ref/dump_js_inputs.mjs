// Scrie pe stdout intrările JS pentru make_ephem_ref.py (locuri, ΔT, momente, puncte ale benzii eclipsei din 2027).
import {loadKit, kitDir} from '../_node.mjs';
import fs from 'node:fs'; import vm from 'node:vm'; import nodePath from 'node:path';
const E = loadKit(['ephem']).ephem;
vm.runInThisContext(fs.readFileSync(nodePath.join(kitDir, 'src', 'ephem-stars.js'), 'utf8'), {filename: 'ephem-stars.js'});
const starList = FFF.ephem.stars.list.filter((s, i) => i % 53 === 0).map(s => ({hip: s.hip, ra: s.ra, dec: s.dec, pmRa: s.pmRa, pmDec: s.pmDec}));
const starTimes = [E.tt(E.jdFromCalendar(1950, 3, 1)), E.tt(E.jdFromCalendar(2026, 10, 14)), E.tt(E.jdFromCalendar(2080, 7, 1))];
const g = E.eclipse.greatest(), path = E.eclipse.path({stepMin: 10});
const pathPoints = [];
for (const s of path.properties.samples) {
  pathPoints.push({kind: 'central', tt: s.tt, lon: s.central[0], lat: s.central[1]});
  if (s.north) pathPoints.push({kind: 'north', tt: s.tt, lon: s.north[0], lat: s.north[1]});
  if (s.south) pathPoints.push({kind: 'south', tt: s.tt, lon: s.south[0], lat: s.south[1]});
}
const t0 = E.jdFromCalendar(2027, 8, 2, 8, 0, 0);
const besselTimes = []; for (let i = 0; i <= 8; i++) besselTimes.push(E.tt(t0 + i * 0.5 / 24));
console.log(JSON.stringify({stars: starList, starTimes, eclipse: {deltaT: E.deltaT(g.jd), ttGreatest: g.tt, places: E.eclipse.places, besselTimes, pathPoints}}));
