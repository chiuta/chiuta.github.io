// Generator al datelor pentru src/ephem.js. Rulare:
//   node tools/gen-ephem.mjs <dir-astronomia> [prag]
// <dir-astronomia> = node_modules/astronomia (MIT; pachetul npm „astronomia”) din care se extrag: seriile VSOP87D, tabelele Meeus 22.A (nutație),
// 47.A/47.B (Luna) și 37 (Pluto). Tabelul ΔT anual (IERS) e în tools/dt_obs.json. Rezultatul: src/ephem.js (șablon: tools/ephem.template.js + tools/eclipse.part.js).
import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module'; import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), kit = path.join(here, '..');
const astro = path.resolve(process.argv[2] || 'node_modules/astronomia'), THR = +(process.argv[3] || 3e-7);
const require = createRequire(import.meta.url);
const names = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const rad = {mercury: .39, venus: .72, earth: 1, mars: 1.52, jupiter: 5.2, saturn: 9.6, uranus: 19.2, neptune: 30};
const f = (x, n) => { let s = x.toFixed(n); if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, ''); if (s.startsWith('0.')) s = s.slice(1); else if (s.startsWith('-0.')) s = '-' + s.slice(2); return s === '' || s === '-' ? '0' : s; };
let total = 0, kept = 0; const VS = {};
for (const n of names) {
  const m = require(path.join(astro, 'data', `vsop87D${n}.js`)); const d = m.default || m; VS[n] = {};
  for (const k of ['L', 'B', 'R']) {
    const arr = [];
    for (let p = 0; p <= 5; p++) {
      const ser = (d[k][p] || []).filter(t => t.length === 3 && t.every(Number.isFinite));
      total += ser.length;
      const keep = ser.filter(t => t[0] * (k === 'R' ? 1 : rad[n]) * Math.pow(0.15, p) >= THR);
      kept += keep.length;
      arr.push(keep.map(t => `${f(t[0], 9)},${f(t[1], 7)},${f(t[2], 6)}`).join(';'));
    }
    while (arr.length && arr[arr.length - 1] === '') arr.pop();
    VS[n][k] = arr;
  }
}
const readTable = (file, re) => { const src = fs.readFileSync(path.join(astro, 'lib', file), 'utf8'); const m = re.exec(src); return new Function('return ' + m[1])(); };
const MOON_A = readTable('moonposition.cjs', /const ta = \(function \(\) \{\s*const ta = (\[[\s\S]*?\n  \]);/);
const MOON_B = readTable('moonposition.cjs', /const tb = \(function \(\) \{\s*const tb = (\[[\s\S]*?\n  \]);/);
const NUT = readTable('nutation.cjs', /const table22A = \(function \(\) \{\s*const PROPS = [^\n]*\n\s*const tab = (\[[\s\S]*?\n  \]);/);
const pl = fs.readFileSync(path.join(astro, 'lib', 'pluto.cjs'), 'utf8');
const PLUTO = [...pl.matchAll(/new Pt\(([^)]*)\)/g)].map(m => m[1].split(',').map(Number));
// ELP/MPP02 (ajustat pe DE405), serii „A sin(φ0+φ1 T+φ2 T²)”, T în secole iuliene de la J2000; trunchiere pe amplitudine: L, B în arcsec; R în km
const ELPT = {L: +(process.env.ELP_L || 0.02), B: +(process.env.ELP_B || 0.02), R: +(process.env.ELP_R || 0.2)};
const elpSrc = require(path.join(astro, 'data', 'elpMppDe.js')); const elpD = elpSrc.default || elpSrc;
let elpKept = 0, elpTotal = 0; const ELP = {W1: elpD.W1.slice(0, 4).map(v => +v.toPrecision(12))};
for (const k of ['L', 'B', 'R']) {
  ELP[k] = [];
  for (let p = 0; p <= 3; p++) {
    const ser = elpD[k][p] || []; elpTotal += ser.length;
    const keep = ser.filter(t => Math.abs(t[0]) * Math.pow(1.0, p) >= ELPT[k]);
    elpKept += keep.length;
    ELP[k].push(keep.map(t => [f(t[0], k === 'R' ? 3 : 4), f(t[1], 6), f(t[2], 5), Math.abs(t[0]) * Math.abs(t[3]) > 0.004 ? f(t[3], 8) : '0'].join(',')).join(';'));
  }
  while (ELP[k].length && ELP[k][ELP[k].length - 1] === '') ELP[k].pop();
}
const DT = JSON.parse(fs.readFileSync(path.join(here, 'dt_obs.json'), 'utf8'));
if (MOON_A.length !== 60 || MOON_B.length !== 60 || NUT.length !== 63 || PLUTO.length !== 43) throw new Error(`tabele incomplete: ${MOON_A.length} ${MOON_B.length} ${NUT.length} ${PLUTO.length}`);
const data = `var DT_START = ${DT.start}, DT_OBS = ${JSON.stringify(DT.values)};   // ΔT anual (s) la 1 ianuarie; ${DT.start}–${DT.start + DT.values.length - 1} (ultimele valori sunt prezise de IERS)
  var NUT = ${JSON.stringify(NUT)};   // Meeus 22.A: d,m,m',F,Ω, Δψ(0,1), Δε(0,1) în 0,0001″
  var MOON_A = ${JSON.stringify(MOON_A)};   // Meeus 47.A (rezervă / verificări): longitudine (1e-6°) și distanță (1e-3 km)
  var MOON_B = ${JSON.stringify(MOON_B)};   // Meeus 47.B: latitudine (1e-6°)
  var ELP = ${JSON.stringify(ELP)};   // ELP/MPP02: W1 = polinom longitudine medie (rad); L,B (arcsec), R (km): serii „A,φ0,φ1,φ2” pe puteri de T
  var PLUTO = ${JSON.stringify(PLUTO)};   // Meeus 37: argumente J,S,P și coeficienți (lon, lat, rază) sin/cos, în grade/UA
  var VS = ${JSON.stringify(VS)};   // VSOP87D: serii „A,B,C” (amplitudine rad/UA, fază rad, frecvență rad/mileniu) pe puteri de t`;
const elpInfo = `${elpKept} din ${elpTotal} termeni (praguri: L ${ELPT.L}″, B ${ELPT.B}″, R ${ELPT.R} km)`;
const info = `${kept} din ${total} termeni (prag ${THR} UA·cos, ponderat cu 0,15^k pentru seria t^k)`;
let tpl = fs.readFileSync(path.join(here, 'ephem.template.js'), 'utf8'), ecl = fs.readFileSync(path.join(here, 'eclipse.part.js'), 'utf8');
let out = tpl.replace('  //@@DATA@@', '  ' + data).replace('  //@@ECLIPSE@@', ecl.trimEnd()).replace('@@VSOPINFO@@', info).replace('@@ELPINFO@@', elpInfo);
fs.writeFileSync(path.join(kit, 'src', 'ephem.js'), out);
console.log('src/ephem.js', (out.length / 1024).toFixed(1), 'kB; VSOP87D:', info, '; ELP/MPP02:', elpInfo);
