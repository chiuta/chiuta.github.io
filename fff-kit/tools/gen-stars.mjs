// Generator pentru src/ephem-stars.js (catalog stelar compact + figurile constelațiilor). Rulare:
//   node tools/gen-stars.mjs <dir-d3-celestial> <hip2.dat> [mag-limită=5.0]
// Surse (vezi THIRD-PARTY.md):
//  - d3-celestial (BSD-3-Clause, © Olaf Frohn): stars.6.json (HIP, V, B−V), starnames.json (denumiri IAU/Bayer/Flamsteed), constellations*.json (figuri, centre, nume)
//  - Hipparcos, noua reducere (van Leeuwen 2007; ESA, CDS I/311, hip2.dat — public) prin pachetul PyPI „hipparcos-catalog” (MIT): poziții (ep. 1991,25) și mișcări proprii
//  - denumirile românești ale constelațiilor și ale câtorva stele: scrise de autorul kitului (vezi RO_CON / RO_STAR)
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), kit = path.join(here, '..');
const d3 = path.resolve(process.argv[2] || 'node_modules/d3-celestial'), hipFile = path.resolve(process.argv[3] || 'hip2.dat'), MAG = +(process.argv[4] || 5.0);
const J = f => JSON.parse(fs.readFileSync(path.join(d3, 'data', f), 'utf8'));
const stars = J('stars.6.json').features, names = J('starnames.json'), cons = J('constellations.json').features, lines = J('constellations.lines.json').features;

// --- hip2.dat: HIP, Sn, So, Nc, RA(rad), DE(rad), Plx(mas), pmRA*(mas/an), pmDE(mas/an) ---
const hip = new Map();
for (const ln of fs.readFileSync(hipFile, 'latin1').split('\n')) {
  const p = ln.trim().split(/\s+/); if (p.length < 9) continue;
  hip.set(+p[0], {ra: +p[4] * 180 / Math.PI, dec: +p[5] * 180 / Math.PI, plx: +p[6], pmra: +p[7], pmde: +p[8]});
}
const RO_STAR = {Polaris: 'Steaua Polară', 'Rigil Kentaurus': 'Alfa Centauri (Rigil Kentaurus)', Toliman: 'Alfa Centauri B (Toliman)', Capella: 'Capella', Algol: 'Algol'};
const RO_CON = {And: 'Andromeda', Ant: 'Pompa', Aps: 'Pasărea Paradisului', Aqr: 'Vărsătorul', Aql: 'Vulturul', Ara: 'Altarul', Ari: 'Berbecul', Aur: 'Vizitiul', Boo: 'Văcarul', Cae: 'Dalta', Cam: 'Girafa', Cnc: 'Racul',
  CVn: 'Câinii de Vânătoare', CMa: 'Câinele Mare', CMi: 'Câinele Mic', Cap: 'Capricornul', Car: 'Carena', Cas: 'Casiopeea', Cen: 'Centaurul', Cep: 'Cefeu', Cet: 'Balena', Cha: 'Cameleonul', Cir: 'Compasul', Col: 'Porumbelul',
  Com: 'Părul Berenicei', CrA: 'Coroana Australă', CrB: 'Coroana Boreală', Crv: 'Corbul', Crt: 'Cupa', Cru: 'Crucea Sudului', Cyg: 'Lebăda', Del: 'Delfinul', Dor: 'Peștele de Aur', Dra: 'Dragonul', Equ: 'Calul Mic',
  Eri: 'Eridan', For: 'Cuptorul', Gem: 'Gemenii', Gru: 'Cocorul', Her: 'Hercule', Hor: 'Ceasornicul', Hya: 'Hidra', Hyi: 'Hidra Mascul', Ind: 'Indianul', Lac: 'Șopârla', Leo: 'Leul', LMi: 'Leul Mic', Lep: 'Iepurele',
  Lib: 'Balanța', Lup: 'Lupul', Lyn: 'Râsul', Lyr: 'Lira', Men: 'Masa', Mic: 'Microscopul', Mon: 'Licornul', Mus: 'Musca', Nor: 'Echerul', Oct: 'Octantul', Oph: 'Ophiuchus (Șerparul)', Ori: 'Orion', Pav: 'Păunul',
  Peg: 'Pegas', Per: 'Perseu', Phe: 'Phoenix', Pic: 'Pictorul', Psc: 'Peștii', PsA: 'Peștele Austral', Pup: 'Pupa', Pyx: 'Busola', Ret: 'Reticulul', Sge: 'Săgeata', Sgr: 'Săgetătorul', Sco: 'Scorpionul',
  Scl: 'Sculptorul', Sct: 'Scutul', Ser: 'Șarpele', Sex: 'Sextantul', Tau: 'Taurul', Tel: 'Telescopul', Tri: 'Triunghiul', TrA: 'Triunghiul Austral', Tuc: 'Tucanul', UMa: 'Ursa Mare', UMi: 'Ursa Mică',
  Vel: 'Velele', Vir: 'Fecioara', Vol: 'Peștele Zburător', Vul: 'Vulpea'};
const wrapRa = x => ((x % 360) + 360) % 360;
const fx = (x, n) => { const s = x.toFixed(n); return s.replace(/\.?0+$/, '') || '0'; };

// --- stele ---
const rows = [], nmap = {}; let missing = 0, maxDiff = 0;
const sel = stars.filter(f => f.properties.mag <= MAG).sort((a, b) => a.properties.mag - b.properties.mag);
for (const f of sel) {
  const id = f.id; let h = hip.get(id);
  if (!h) { missing++; h = {ra: wrapRa(f.geometry.coordinates[0]), dec: f.geometry.coordinates[1], pmra: 0, pmde: 0}; }   // rezervă: coordonatele din d3-celestial, fără mișcare proprie
  const dy = h.pmra || h.pmde ? 8.75 : 0;   // 1991,25 → 2000,0
  const dec0 = h.dec, ra = wrapRa(h.ra + h.pmra * dy / 3.6e6 / Math.cos(dec0 * Math.PI / 180)), dec = h.dec + h.pmde * dy / 3.6e6;
  const d3ra = wrapRa(f.geometry.coordinates[0]), d3dec = f.geometry.coordinates[1];
  maxDiff = Math.max(maxDiff, Math.hypot((ra - d3ra + 540) % 360 - 180, dec - d3dec) * 3600);
  const bv = parseFloat(f.properties.bv);
  const nm = names[id] || {};
  const desig = nm.bayer ? (nm.bayer + ' ' + (nm.c || '')) : (nm.flam ? (nm.flam + ' ' + (nm.c || '')) : (nm.var ? (nm.var + ' ' + (nm.c || '')) : ''));
  const en = (f.properties.mag <= 3.0 && nm.name) ? nm.name : '';
  const ro = en ? (RO_STAR[en] || en) : '';
  rows.push([id, fx(ra, 4), fx(dec, 4), Math.round(h.pmra), Math.round(h.pmde), Math.round(f.properties.mag * 100), Number.isFinite(bv) ? Math.round(bv * 100) : '', desig.trim(), en, ro === en ? '' : ro].join(','));
}
// --- constelații ---
const conMap = new Map();
for (const c of cons) {
  const id = c.id; const p = c.properties;
  if (conMap.has(id)) continue;
  conMap.set(id, {id, la: p.la || p.name, gen: p.gen, en: p.en, ro: RO_CON[id] || '', ra: wrapRa(c.geometry.coordinates[0]), dec: c.geometry.coordinates[1], lines: []});
}
for (const l of lines) {
  const c = conMap.get(l.id); if (!c) continue;
  for (const pl of l.geometry.coordinates) c.lines.push(pl.map(([lo, la]) => [Math.round(wrapRa(lo) * 100), Math.round(la * 100)]));
}
const conOut = [...conMap.values()].map(c => [c.id, c.la, c.gen, c.en, c.ro, fx(c.ra, 1), fx(c.dec, 1), c.lines.map(pl => pl.map(p => p.join(' ')).join('>')).join('|')].join('~'));
const missingRo = [...conMap.values()].filter(c => !c.ro).map(c => c.id);
if (conMap.size !== 88 || missingRo.length) throw new Error(`constelații: ${conMap.size}, fără nume RO: ${missingRo}`);

const code = `/* FFF.ephem.stars — catalog stelar compact pentru planetariu (modul opțional „ephemstars”; încărcat doar de aplicațiile care îl cer). Depinde de FFF.ephem.
   Conținut: ${rows.length} stele cu V ≤ ${MAG} (Hipparcos; ep. J2000, ICRS), mișcări proprii (mas/an), mărime V, indice B−V, denumiri: nume proprii IAU/EN pentru stelele V ≤ 3,0 (${rows.filter(r => r.split(',')[8]).length}),
   desemnare Bayer/Flamsteed, ${conOut.length} constelații cu figuri (linii) și denumiri românești.
   Surse și licențe: tools/gen-stars.mjs și THIRD-PARTY.md (Hipparcos/ESA – public; d3-celestial – BSD-3-Clause; hipparcos-catalog – MIT).
   Denumirile românești ale constelațiilor sunt uzuale/propuse și NU sunt o nomenclatură oficială; numele proprii românești ale stelelor coincid, cu rare excepții, cu cele internaționale. */
(function () {
  'use strict';
  var F = (window.FFF = window.FFF || {});
  var STAR_ROWS = ${JSON.stringify(rows.join(';'))};
  var CON_ROWS = ${JSON.stringify(conOut.join('\n'))};
  function num(s) { return s === '' ? null : +s; }
  var list = STAR_ROWS.split(';').map(function (r, i) {
    var p = r.split(',');
    return {i: i, hip: +p[0], ra: +p[1], dec: +p[2], pmRa: +p[3], pmDec: +p[4], mag: +p[5] / 100, bv: p[6] === '' ? null : +p[6] / 100, desig: p[7] || '', en: p[8] || '', ro: p[9] || p[8] || ''};
  });
  var byHip = {}; list.forEach(function (s) { byHip[s.hip] = s; });
  var constellations = CON_ROWS.split('\\n').map(function (r) {
    var p = r.split('~');
    return {id: p[0], la: p[1], gen: p[2], en: p[3], ro: p[4], label: {ra: +p[5], dec: +p[6]},
      lines: p[7] ? p[7].split('|').map(function (pl) { return pl.split('>').map(function (q) { var a = q.split(' '); return [a[0] / 100, a[1] / 100]; }); }) : []};
  });
  function plain(s) { return String(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase(); }
  function color(bv) {   // B−V → culoare sRGB aproximativă (Ballesteros 2012 pentru T; aproximare Planckiană)
    if (bv == null) bv = 0.6;
    bv = Math.max(-0.4, Math.min(2.0, bv));
    var T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)) / 100, r, g, b;
    r = T <= 66 ? 255 : 329.698727446 * Math.pow(T - 60, -0.1332047592);
    g = T <= 66 ? 99.4708025861 * Math.log(T) - 161.1195681661 : 288.1221695283 * Math.pow(T - 60, -0.0755148492);
    b = T >= 66 ? 255 : (T <= 19 ? 0 : 138.5177312231 * Math.log(T - 10) - 305.0447927307);
    var h = function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); };
    return '#' + h(r) + h(g) + h(b);
  }
  function find(q) {   // căutare după nume (EN/RO), desemnare sau constelație; fără diacritice
    var n = plain(q).trim(), out = [];
    if (!n) return out;
    list.forEach(function (s) { if (plain(s.en) === n || plain(s.ro) === n || plain(s.desig) === n || ('hip' + s.hip) === n.replace(/\\s+/g, '')) out.push({type: 'star', star: s}); });
    constellations.forEach(function (c) { if (plain(c.ro) === n || plain(c.en) === n || plain(c.la) === n || plain(c.id) === n) out.push({type: 'constellation', constellation: c}); });
    return out;
  }
  function position(star, jd, opts) { return F.ephem.starPosition(star.ra, star.dec, star.pmRa, star.pmDec, jd, opts); }
  function nearest(ra, dec, maxDeg, magLimit) {   // cea mai apropiată stea (coordonate J2000 față de J2000)
    var best = null, bd = (maxDeg == null ? 2 : maxDeg), D = Math.PI / 180, ml = magLimit == null ? 99 : magLimit;
    for (var i = 0; i < list.length; i++) {
      var s = list[i]; if (s.mag > ml) continue;
      var c = Math.sin(dec * D) * Math.sin(s.dec * D) + Math.cos(dec * D) * Math.cos(s.dec * D) * Math.cos((ra - s.ra) * D), d = Math.acos(Math.max(-1, Math.min(1, c))) / D;
      if (d < bd) { bd = d; best = s; }
    }
    return best ? {star: best, distance: bd} : null;
  }
  var stars = {count: list.length, epoch: 'J2000', magLimit: ${MAG}, list: list, byHip: byHip, constellations: constellations, color: color, find: find, position: position, nearest: nearest,
    sources: 'Hipparcos (ESA, van Leeuwen 2007; domeniu public); d3-celestial (BSD-3-Clause, Olaf Frohn); hipparcos-catalog (MIT)'};
  F.ephem = F.ephem || {};
  F.ephem.stars = stars;
})();
`;
fs.writeFileSync(path.join(kit, 'src', 'ephem-stars.js'), code);
console.log(`src/ephem-stars.js ${(code.length / 1024).toFixed(1)} kB; stele=${rows.length} (fără HIP2, mișcare proprie 0: ${missing}); diferență max d3 vs hip2 ${maxDiff.toFixed(2)}″; constelații=${conMap.size}; segmente=${[...conMap.values()].reduce((a, c) => a + c.lines.length, 0)}`);
