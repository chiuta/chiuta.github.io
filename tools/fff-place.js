/* fff-place · locația, ora și fusul orar comune ale suitei „cer–timp” + efemeride locale pentru „Astea se întâmplă deasupra ta mâine”.
 * Sursa canonică e ACEST fișier (tools/fff-place.js); aplicațiile îl primesc prin `node tools/inject-shared.mjs`, nu prin copiere de mână
 * (`inject-shared.mjs --check` verifică că fiecare copie e identică cu sursa). Rulează și în Node (module.exports) pentru teste; fără dependențe, fără rețea.
 *
 * 1) MOTOR (pur, fără DOM): Soare (Meeus cap. 25), Lună (Meeus cap. 47, 60+60 termeni; ~10″), planete (elemente keplerian aproximative JPL/Standish 1800–2050,
 *    precesie în longitudine, magnitudini Meeus cap. 41), paralaxă topocentrică, răsărit/apus, faze, eclipse de Soare și de Lună cu circumstanțe locale.
 *    Precizie (verificată în tests/place.test.mjs față de FFF.ephem din kit): Lună < 0,01°, Soare < 0,01°, planete < 0,5°, momentul maximului eclipsei < 2 min, mărimea < 0,01.
 *    NU e instrument de navigație, astrofotografie de precizie sau siguranță la privirea Soarelui.
 * 2) LOCAȚIE: un singur obiect {lat, lon, name, tz, alt, src, t} în localStorage (`fff.place.v1`), anunțat între file (BroadcastChannel „fff-place” + evenimentul storage)
 *    și între origini diferite prin plicul FFF `place/fff` (fișier, clipboard, QR, link `#fffplace=…` către altă aplicație). Geolocalizarea se cere DOAR la apăsarea butonului.
 * 3) INTERFAȚĂ: buton „📍 Locație” + dialog (formular, oraș, geolocalizare, trimitere către celelalte aplicații), panou „Astea se întâmplă deasupra ta mâine”, alertă la eclipsă. 8 limbi. */
(function (root, factory) {
  var P = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = P;
  if (root && root.document && typeof root.document.createElement === 'function') { try { var F = root.FFF || {}; root.FFF = F; if (root.FFF === F) F.place = P; } catch (e) { /* inert */ } if (P.autostart) P.autostart(); }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var PI = Math.PI, R = PI / 180, DG = 180 / PI, sin = Math.sin, cos = Math.cos, asin = Math.asin, acos = Math.acos, atan2 = Math.atan2, sqrt = Math.sqrt, abs = Math.abs, floor = Math.floor;
  var AU = 149597870.7, RE = 6378.137, FL = 1 / 298.257223563, RSUN = 695990, RMOON = 1737.4, SYN = 29.530588861;
  var mod = function (x, m) { x = x % m; return x < 0 ? x + m : x; };
  var wrap180 = function (x) { x = mod(x, 360); return x > 180 ? x - 360 : x; };
  var jdOfMs = function (ms) { return ms / 86400000 + 2440587.5; }, msOfJd = function (jd) { return (jd - 2440587.5) * 86400000; };
  var MIN = 1 / 1440;

  /* ================= MOTOR ================= */
  var MOON_A = [[0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],[0,0,2,0,213618,-569925],[0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],[2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],[2,0,1,0,53322,-170733],[2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],[0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],[0,0,1,-2,10980,79661],[4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],[4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],[2,1,0,0,-6766,30824],[1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],[2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],[0,1,-2,0,-2689,-7003],[2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],[1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],[0,1,2,0,-2120,5751],[0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],[2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],[3,0,-1,0,-892,3258],[2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],[0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354],[2,1,-2,0,691,0],[2,-1,0,-2,596,0],[4,0,1,0,549,-1423],[0,0,4,0,537,-1117],[4,-1,0,0,520,-1571],[1,0,-2,0,-487,-1739],[2,1,0,-2,-399,0],[0,0,2,-2,-381,-4421],[1,1,1,0,351,0],[3,0,-2,0,-340,0],[4,0,-3,0,330,0],[2,-1,2,0,327,0],[0,2,1,0,-323,1165],[1,1,-1,0,299,0],[2,0,3,0,294,0],[2,0,-1,-2,0,8752]], MOON_B = [[0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],[0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],[0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],[4,0,0,-1,1021],[4,0,-1,1,833],[0,0,1,-3,777],[4,0,-2,1,671],[2,0,0,-3,607],[2,0,2,-1,596],[2,-1,1,-1,491],[2,0,-2,1,-451],[0,0,3,-1,439],[2,0,2,1,422],[2,0,-3,-1,421],[2,1,-1,1,-366],[2,1,0,1,-351],[4,0,0,1,331],[2,-1,1,1,315],[2,-2,0,-1,302],[0,0,1,3,-283],[2,1,1,-1,-229],[1,1,0,-1,223],[1,1,0,1,223],[0,1,-2,-1,-220],[2,1,-1,-1,-220],[1,0,1,1,-185],[2,-1,-2,-1,181],[0,1,2,1,-177],[4,0,-2,-1,176],[4,-1,-1,-1,166],[1,0,1,-1,-164],[4,0,1,-1,132],[1,0,-1,-1,-119],[4,-1,0,-1,115],[2,-2,0,1,107]];
  /* elemente [a, e, I, L, ϖ, Ω] + viteze pe secol (JPL „Keplerian elements for approximate positions of the major planets”, 1800–2050) */
  var EL = {
    mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255, 0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
    earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    mars: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
    uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503, -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
    neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]
  };
  var PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

  function deltaT(jd) { var y = 2000 + (jd - 2451545) / 365.25; return 69.2 + 0.3 * Math.max(-20, Math.min(40, y - 2026)); }   // secunde; aproximație 2006–2066
  var Tc = function (jd) { return (jd + deltaT(jd) / 86400 - 2451545) / 36525; };   // secole TT de la J2000
  function nutObl(t) {   // nutație în longitudine (grade), oblicitate adevărată (grade): termeni principali (±0,5″)
    var om = (125.04452 - 1934.136261 * t) * R, L = (280.4665 + 36000.7698 * t) * R, Lm = (218.3165 + 481267.8813 * t) * R;
    var dpsi = (-17.20 * sin(om) - 1.32 * sin(2 * L) - 0.23 * sin(2 * Lm) + 0.21 * sin(2 * om)) / 3600;
    var deps = (9.20 * cos(om) + 0.57 * cos(2 * L) + 0.10 * cos(2 * Lm) - 0.09 * cos(2 * om)) / 3600;
    return { dpsi: dpsi, eps: 23.43929111 - 0.013004167 * t - 1.64e-7 * t * t + deps };
  }
  function gast(jd) {   // timp sideral aparent la Greenwich, grade
    var d = jd - 2451545, t = d / 36525, th = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - t * t * t / 38710000;
    var n = nutObl(Tc(jd)); return mod(th + n.dpsi * cos(n.eps * R), 360);
  }
  function eclToVec(lon, lat, dist, eps) {   // longitudine/latitudine ecliptică (grade) → vector ecuatorial [x,y,z]
    var l = lon * R, b = lat * R, x = dist * cos(b) * cos(l), y = dist * cos(b) * sin(l), z = dist * sin(b), e = eps * R;
    return [x, y * cos(e) - z * sin(e), y * sin(e) + z * cos(e)];
  }
  function vecRaDec(v) { var d = sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return { ra: mod(atan2(v[1], v[0]) * DG, 360), dec: asin(v[2] / d) * DG, dist: d }; }

  function sunGeo(jd) {
    var t = Tc(jd), L0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t, M = (357.52911 + 35999.05029 * t - 0.0001537 * t * t) * R;
    var e = 0.016708634 - 0.000042037 * t, C = (1.914602 - 0.004817 * t) * sin(M) + (0.019993 - 0.000101 * t) * sin(2 * M) + 0.000289 * sin(3 * M);
    var v = M + C * R, rAU = 1.000001018 * (1 - e * e) / (1 + e * cos(v)), om = (125.04 - 1934.136 * t) * R;
    var n = nutObl(t), lon = mod(L0 + C - 0.00569 - 0.00478 * sin(om), 360);   // aparentă (aberație + nutație din formula Meeus 25)
    var vec = eclToVec(lon, 0, rAU * AU, n.eps), q = vecRaDec(vec);
    return { lon: lon, ra: q.ra, dec: q.dec, distAU: rAU, dist: rAU * AU, vec: vec, sd: asin(RSUN / (rAU * AU)) * DG };
  }
  function moonGeo(jd) {
    var t = Tc(jd), i, r, a, e;
    var Lp = mod(218.3164477 + t * (481267.88123421 + t * (-0.0015786 + t * (1 / 538841 - t / 65194000))), 360) * R;
    var D = mod(297.8501921 + t * (445267.1114034 + t * (-0.0018819 + t * (1 / 545868 - t / 113065000))), 360) * R;
    var M = mod(357.5291092 + t * (35999.0502909 + t * (-0.0001536 + t / 24490000)), 360) * R;
    var Mp = mod(134.9633964 + t * (477198.8675055 + t * (0.0087414 + t * (1 / 69699 - t / 14712000))), 360) * R;
    var Fa = mod(93.2720950 + t * (483202.0175233 + t * (-0.0036539 + t * (-1 / 3526000 + t / 863310000))), 360) * R;
    var A1 = (119.75 + 131.849 * t) * R, A2 = (53.09 + 479264.290 * t) * R, A3 = (313.45 + 481266.484 * t) * R;
    var E = 1 - 0.002516 * t - 0.0000074 * t * t, E2 = E * E;
    var sl = 3958 * sin(A1) + 1962 * sin(Lp - Fa) + 318 * sin(A2), sr = 0;
    var sb = -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - Fa) + 175 * sin(A1 + Fa) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);
    for (i = 0; i < MOON_A.length; i++) { r = MOON_A[i]; a = r[0] * D + r[1] * M + r[2] * Mp + r[3] * Fa; e = r[1] === 0 ? 1 : (abs(r[1]) === 1 ? E : E2); sl += r[4] * e * sin(a); sr += r[5] * e * cos(a); }
    for (i = 0; i < MOON_B.length; i++) { r = MOON_B[i]; a = r[0] * D + r[1] * M + r[2] * Mp + r[3] * Fa; e = r[1] === 0 ? 1 : (abs(r[1]) === 1 ? E : E2); sb += r[4] * e * sin(a); }
    var n = nutObl(t), lon = mod(Lp * DG + sl * 1e-6 + n.dpsi, 360), lat = sb * 1e-6, dist = 385000.56 + sr / 1000;
    var vec = eclToVec(lon, lat, dist, n.eps), q = vecRaDec(vec);
    return { lon: lon, lat: lat, ra: q.ra, dec: q.dec, dist: dist, vec: vec, par: asin(RE / dist) * DG, sd: asin(RMOON / dist) * DG };
  }
  function kepler(M, e) { var E = M + e * sin(M), i; for (i = 0; i < 12; i++) { var d = (E - e * sin(E) - M) / (1 - e * cos(E)); E -= d; if (abs(d) < 1e-12) break; } return E; }
  function helio(name, t) {   // heliocentric ecliptic J2000, UA
    var c = EL[name], a = c[0] + c[6] * t, e = c[1] + c[7] * t, I = (c[2] + c[8] * t) * R, L = c[3] + c[9] * t, w = c[4] + c[10] * t, N = (c[5] + c[11] * t) * R;
    var M = mod(L - w, 360); if (M > 180) M -= 360; var E = kepler(M * R, e), xo = a * (cos(E) - e), yo = a * sqrt(1 - e * e) * sin(E), om = (w * R) - N;
    var cw = cos(om), sw = sin(om), cN = cos(N), sN = sin(N), cI = cos(I), sI = sin(I);
    return [(cw * cN - sw * sN * cI) * xo + (-sw * cN - cw * sN * cI) * yo, (cw * sN + sw * cN * cI) * xo + (-sw * sN + cw * cN * cI) * yo, (sw * sI) * xo + (cw * sI) * yo];
  }
  function planet(name, jd) {
    var t = Tc(jd), p = helio(name, t), e = helio('earth', t), g = [p[0] - e[0], p[1] - e[1], p[2] - e[2]];
    var r = sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]), dl = sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]), Rr = sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
    var lon0 = mod(atan2(g[1], g[0]) * DG, 360), lat = asin(g[2] / dl) * DG, prec = 1.396971 * t + 0.0003086 * t * t;
    var n = nutObl(t), lon = mod(lon0 + prec + n.dpsi, 360), vec = eclToVec(lon, lat, dl * AU, n.eps), q = vecRaDec(vec);
    var cosi = Math.max(-1, Math.min(1, (r * r + dl * dl - Rr * Rr) / (2 * r * dl))), i = acos(cosi) * DG, rd = 5 * Math.log(r * dl) / Math.LN10, mag;
    if (name === 'mercury') mag = -0.42 + rd + 0.0380 * i - 0.000273 * i * i + 0.000002 * i * i * i;
    else if (name === 'venus') mag = -4.40 + rd + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i;
    else if (name === 'mars') mag = -1.52 + rd + 0.016 * i;
    else if (name === 'jupiter') mag = -9.40 + rd + 0.005 * i;
    else if (name === 'saturn') { var ir = 28.06 * R, Or = 169.51 * R, sB = sin(ir) * cos(lat * R) * sin(lon0 * R - Or) - cos(ir) * sin(lat * R); mag = -8.88 + rd - 2.60 * abs(sB) + 1.25 * sB * sB; }
    else if (name === 'uranus') mag = -7.19 + rd; else mag = -6.87 + rd;
    var sg = sunGeo(jd), el = acos(Math.max(-1, Math.min(1, cos(q.dec * R) * cos(sg.dec * R) * cos((q.ra - sg.ra) * R) + sin(q.dec * R) * sin(sg.dec * R)))) * DG;
    return { name: name, ra: q.ra, dec: q.dec, dist: dl, vec: vec, mag: mag, elong: el, phase: i };
  }

  /* observator + coordonate topocentrice */
  function obsVec(pl, jd) {
    var phi = pl.lat * R, h = (pl.alt || 0) / 1000, u = Math.atan((1 - FL) * Math.tan(phi)), s = (1 - FL) * sin(u) + h / RE * sin(phi), c = cos(u) + h / RE * cos(phi);
    var th = (gast(jd) + pl.lon) * R; return [RE * c * cos(th), RE * c * sin(th), RE * s];
  }
  function topo(vec, pl, jd) {
    var o = obsVec(pl, jd), v = [vec[0] - o[0], vec[1] - o[1], vec[2] - o[2]], q = vecRaDec(v), phi = pl.lat * R;
    var H = (gast(jd) + pl.lon - q.ra) * R, dec = q.dec * R, sa = sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H), alt = asin(sa);
    var az = atan2(sin(H), cos(H) * sin(phi) - Math.tan(dec) * cos(phi)) * DG + 180;   // de la Nord spre Est
    return { ra: q.ra, dec: q.dec, dist: q.dist, alt: alt * DG, az: mod(az, 360) };
  }
  var sunAlt = function (pl, jd) { return topo(sunGeo(jd).vec, pl, jd).alt; };
  var moonAlt = function (pl, jd) { return topo(moonGeo(jd).vec, pl, jd).alt; };

  /* moment de trecere prin h0 (răsărit/apus) pe [jd0, jd1] */
  function crossings(altFn, jd0, jd1, h0) {
    var out = { rise: [], set: [] }, step = 10 * MIN, a = altFn(jd0) - h0, t = jd0, b, tb, lo, hi, fa, i, mid, fm;
    for (t = jd0; t < jd1 - 1e-9; t += step) {
      tb = Math.min(jd1, t + step); b = altFn(tb) - h0; fa = a;
      if ((fa < 0) !== (b < 0)) { lo = t; hi = tb; for (i = 0; i < 24; i++) { mid = (lo + hi) / 2; fm = altFn(mid) - h0; if ((fm < 0) === (fa < 0)) lo = mid; else hi = mid; } (b > 0 ? out.rise : out.set).push((lo + hi) / 2); }
      a = b;
    }
    return out;
  }
  function moonPhase(jd) {
    var s = sunGeo(jd), m = moonGeo(jd), psi = mod(m.lon - s.lon, 360), idx = Math.round(psi / 45) % 8;
    return { elong: psi, idx: idx, illum: (1 - cos(psi * R)) / 2, waxing: psi < 180 };
  }

  /* ---------- eclipse ---------- */
  function sepVec(a, b) { var d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2], na = sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]), nb = sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]); return acos(Math.max(-1, Math.min(1, d / (na * nb)))) * DG; }
  function golden(f, a, b, tol) {
    var g = (sqrt(5) - 1) / 2, c = b - g * (b - a), d = a + g * (b - a), fc = f(c), fd = f(d);
    while (b - a > tol) { if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); } else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); } }
    return (a + b) / 2;
  }
  function bisect(f, lo, hi) { var flo = f(lo), i, m, fm; for (i = 0; i < 30; i++) { m = (lo + hi) / 2; fm = f(m); if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m; } return (lo + hi) / 2; }
  function lensFraction(d, r1, r2) {   // fracția din discul de rază r1 acoperită de discul de rază r2 (centre la distanța d)
    if (d >= r1 + r2) return 0; if (d <= abs(r1 - r2)) return r2 >= r1 ? 1 : (r2 * r2) / (r1 * r1);
    var a = r1 * r1 * acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1)), b = r2 * r2 * acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2)), c = 0.5 * sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
    return (a + b - c) / (PI * r1 * r1);
  }
  function shadowSep(jd) {   // separația Lună–axa umbrei (punctul antisolar), grade, văzută din centrul Pământului
    var s = sunGeo(jd), m = moonGeo(jd); return sepVec(m.vec, [-s.vec[0], -s.vec[1], -s.vec[2]]);
  }
  /** Eclipse (candidate) între două momente (JD UT): [{kind:'solar'|'lunar', jd, sep}] — circumstanțele locale se calculează separat. */
  function findEclipses(jd0, jd1) {
    var out = [], k, est, solar, f, tm, s, m, lim, sep;
    for (k = floor((jd0 - 2451550.09766) / SYN) - 1; ; k += 0.5) {
      est = 2451550.09766 + SYN * k; if (est > jd1 + 15) break; if (est < jd0 - 15) continue;
      solar = (k % 1 === 0);
      f = solar ? function (jd) { return sepVec(sunGeo(jd).vec, moonGeo(jd).vec); } : shadowSep;
      tm = golden(f, est - 1.6, est + 1.6, 0.2 * MIN); if (tm < jd0 || tm > jd1) continue;
      sep = f(tm); s = sunGeo(tm); m = moonGeo(tm);
      if (solar) { lim = s.sd + m.sd + m.par - 8.794 / 3600 / s.distAU; if (sep < lim) out.push({ kind: 'solar', jd: tm, sep: sep }); }
      else {
        var ps = 8.794 / 3600 / s.distAU; lim = 1.02 * (m.par + ps + s.sd) + m.sd;
        if (sep < lim) out.push(lunarGlobal({ kind: 'lunar', jd: tm, sep: sep }));
      }
    }
    return out;
  }
  function lunarGlobal(ev) {
    var jd = ev.jd, s = sunGeo(jd), m = moonGeo(jd), ps = 8.794 / 3600 / s.distAU, ru = 1.02 * (m.par + ps - s.sd), rp = 1.02 * (m.par + ps + s.sd), sep = shadowSep(jd);
    ev.umbra = (ru + m.sd - sep) / (2 * m.sd); ev.penumbra = (rp + m.sd - sep) / (2 * m.sd);
    ev.type = ev.umbra >= 1 ? 'total' : (ev.umbra > 0 ? 'partial' : (ev.penumbra > 0 ? 'penumbral' : 'none'));
    return ev;
  }
  function lunarLocal(ev, pl) {
    var jd = ev.jd, g = function (j) { var s = sunGeo(j), m = moonGeo(j), ps = 8.794 / 3600 / s.distAU; return { sep: shadowSep(j), ru: 1.02 * (m.par + ps - s.sd), rp: 1.02 * (m.par + ps + s.sd), sm: m.sd }; };
    var alt = function (j) { return moonAlt(pl, j); }, c0 = g(jd), res = { kind: 'lunar', type: ev.type, jd: jd, mag: ev.umbra > 0 ? ev.umbra : ev.penumbra, umbra: ev.umbra, penumbra: ev.penumbra, alt: alt(jd) }, h = 0.4;
    var P = function (j) { var c = g(j); return c.sep - (c.rp + c.sm); }, U = function (j) { var c = g(j); return c.sep - (c.ru + c.sm); };
    if (ev.penumbra > 0) { res.p1 = bisect(P, jd - h, jd); res.p4 = bisect(P, jd, jd + h); }
    if (ev.umbra > 0) { res.u1 = bisect(U, jd - h, jd); res.u4 = bisect(U, jd, jd + h); }
    if (ev.type === 'total') { var T2 = function (j) { var c = g(j); return c.sep - (c.ru - c.sm); }; res.u2 = bisect(T2, jd - h, jd); res.u3 = bisect(T2, jd, jd + h); }
    var first = res.p1 || jd, last = res.p4 || jd;
    res.visible = res.alt > 0 ? 'yes' : (alt(first) > 0 || alt(last) > 0 ? 'part' : 'no');
    var a = topo(moonGeo(jd).vec, pl, jd); res.az = a.az; res.start = first; res.end = last;
    return res;
  }
  function solarLocal(ev, pl) {
    var obs = function (j) {
      var s = sunGeo(j), m = moonGeo(j), ts = topo(s.vec, pl, j), tm = topo(m.vec, pl, j), o = obsVec(pl, j);
      var vs = [s.vec[0] - o[0], s.vec[1] - o[1], s.vec[2] - o[2]], vm = [m.vec[0] - o[0], m.vec[1] - o[1], m.vec[2] - o[2]];
      return { sep: sepVec(vs, vm), rs: asin(RSUN / ts.dist) * DG, rm: asin(RMOON / tm.dist) * DG, alt: ts.alt, az: ts.az };
    };
    var sepF = function (j) { return obs(j).sep; }, i, best = ev.jd, bv = Infinity, v;
    for (i = -120; i <= 120; i++) { v = sepF(ev.jd + i * 2 * MIN); if (v < bv) { bv = v; best = ev.jd + i * 2 * MIN; } }
    var tm = golden(sepF, best - 3 * MIN, best + 3 * MIN, 0.01 * MIN), o = obs(tm), mag = (o.rs + o.rm - o.sep) / (2 * o.rs);
    var res = { kind: 'solar', jd: tm, mag: Math.max(0, mag), alt: o.alt, az: o.az, obsc: lensFraction(o.sep, o.rs, o.rm), type: 'none', visible: 'no' };
    if (mag <= 0) return res;
    var g = function (j) { var q = obs(j); return q.sep - (q.rs + q.rm); };
    res.c1 = bisect(g, tm - 0.2, tm); res.c4 = bisect(g, tm, tm + 0.2);
    res.type = o.sep <= abs(o.rs - o.rm) + 1e-9 ? (o.rm >= o.rs ? 'total' : 'annular') : 'partial';
    if (res.type !== 'partial') {
      var gi = function (j) { var q = obs(j); return q.sep - abs(q.rs - q.rm); };
      res.c2 = bisect(gi, tm - 0.1, tm); res.c3 = bisect(gi, tm, tm + 0.1); res.totalSec = (res.c3 - res.c2) * 86400;
    }
    res.start = res.c1; res.end = res.c4;
    res.visible = o.alt > 0 ? 'yes' : (obs(res.c1).alt > 0 || obs(res.c4).alt > 0 ? 'part' : 'no');
    return res;
  }
  /** Circumstanțele eclipsei `ev` (din findEclipses) pentru locația `pl` {lat, lon, alt?} */
  function local(ev, pl) { return ev.kind === 'solar' ? solarLocal(ev, pl) : lunarLocal(ev, pl); }
  function nextVisible(pl, jd0, spanDays, minMag) {
    var evs = findEclipses(jd0, jd0 + (spanDays || 1100)), i, c; minMag = minMag == null ? 0.001 : minMag;
    for (i = 0; i < evs.length; i++) { c = local(evs[i], pl); if (c.visible !== 'no' && c.mag > minMag && (c.end || c.jd) > jd0) return c; }
    return null;
  }

  /* ---------- fus orar (Intl) ---------- */
  var fmtCache = {};
  function validTz(tz) { if (!tz || typeof tz !== 'string' || tz.length > 64) return false; try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; } }
  function deviceTz() { try { var z = Intl.DateTimeFormat().resolvedOptions().timeZone; return validTz(z) ? z : 'UTC'; } catch (e) { return 'UTC'; } }
  function parts(ms, tz) {
    var f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    var o = {}; f.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = +p.value; }); return o;
  }
  function tzOffsetMs(ms, tz) { var p = parts(ms, tz); return Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second) - floor(ms / 1000) * 1000; }
  function localMidnight(ymd, tz) {   // ymd = {year, month, day} → ms UTC al miezului nopții local
    var t = Date.UTC(ymd.year, ymd.month - 1, ymd.day), o = tzOffsetMs(t, tz); t -= o; o = tzOffsetMs(t, tz); return Date.UTC(ymd.year, ymd.month - 1, ymd.day) - o;
  }
  function offsetLabel(ms, tz) { var o = tzOffsetMs(ms, tz) / 60000, s = o < 0 ? '-' : '+'; o = abs(o); return 'UTC' + s + floor(o / 60) + (o % 60 ? ':' + ('0' + (o % 60)).slice(-2) : ''); }

  /** Totul pentru panou: ziua de mâine (data locală +1) la locația `pl` {lat, lon, alt?, tz}, față de `nowMs`. */
  function sky(pl, nowMs, opts) {
    opts = opts || {}; var tz = validTz(pl.tz) ? pl.tz : deviceTz(), p = parts(nowMs, tz), today = Date.UTC(p.year, p.month - 1, p.day);
    var tm = new Date(today + 86400000), ymd = { year: tm.getUTCFullYear(), month: tm.getUTCMonth() + 1, day: tm.getUTCDate() };
    var d0 = localMidnight(ymd, tz), nx = new Date(today + 2 * 86400000), d1 = localMidnight({ year: nx.getUTCFullYear(), month: nx.getUTCMonth() + 1, day: nx.getUTCDate() }, tz);
    var j0 = jdOfMs(d0), j1 = jdOfMs(d1), out = { tz: tz, date: d0, dayStart: d0, dayEnd: d1, ymd: ymd };
    var sc = crossings(function (j) { return sunAlt(pl, j); }, j0, j1, -0.8333); out.sun = { rise: sc.rise[0] != null ? msOfJd(sc.rise[0]) : null, set: sc.set[0] != null ? msOfJd(sc.set[0]) : null };
    out.sun.noon = sunAlt(pl, (j0 + j1) / 2) > -0.8333 ? 'up' : 'down';
    var mc = crossings(function (j) { return moonAlt(pl, j); }, j0, j1, -0.5667 - 0.25);
    out.moon = { rise: mc.rise.map(msOfJd), set: mc.set.map(msOfJd) }; var ph = moonPhase((j0 + j1) / 2); out.moon.idx = ph.idx; out.moon.illum = ph.illum; out.moon.waxing = ph.waxing;
    /* planete: de la apusul de mâine până la răsăritul de poimâine; „întuneric” = Soarele sub −6° (crepuscul civil) */
    var ns = j0 + 0.5, ne = j1 + 0.5, step = 15 * MIN, dark = [], j, k, pn, best = {};
    for (j = ns; j <= ne; j += step) { if (sunAlt(pl, j) < -6) dark.push(j); }
    out.dark = dark.length > 0;
    PLANETS.forEach(function (name) {
      var bestAlt = -90, bj = null, baz = 0, mg = 0, pk;
      dark.forEach(function (jj) { pk = planet(name, jj); var a = topo(pk.vec, pl, jj); if (a.alt > bestAlt) { bestAlt = a.alt; bj = jj; baz = a.az; mg = pk.mag; } });
      if (bj != null) best[name] = { name: name, alt: bestAlt, az: baz, ms: msOfJd(bj), mag: mg };
    });
    out.planets = PLANETS.filter(function (n) { return best[n] && best[n].alt >= 8 && best[n].mag <= 5.5; }).map(function (n) { return best[n]; }).sort(function (a, b) { return a.mag - b.mag; });
    out.binoc = PLANETS.filter(function (n) { return best[n] && best[n].alt >= 8 && best[n].mag > 5.5; }).map(function (n) { return best[n]; });
    /* eclipse: mâine și următoarea vizibilă */
    var evs = findEclipses(j0 - 1, j1 + 1), tomorrow = [];
    evs.forEach(function (e) { var c = local(e, pl); var t0 = c.start || c.jd, t1 = c.end || c.jd; if (c.mag > 0 && c.visible !== 'no' && t1 >= j0 && t0 < j1) tomorrow.push(c); });
    out.eclipses = tomorrow;
    out.next = tomorrow.length ? null : nextVisible(pl, j1, opts.span || 1100);
    out.generated = nowMs; return out;
  }


  /* ================= LOCAȚIE (stocare + sincronizare) ================= */
  var KEY = 'fff.place.v1', OPTK = 'fff.place.opts', CHAN = 'fff-place', DISM = 'fff.place.dismissed';
  var cur = null, subs = [], bc = null, nowOverride = null, started = false;
  var APPS = [
    { slug: 'eclipsa-2027', name: 'Eclipsa 2027', url: 'https://eclipsa-2027.chiuta.ro/' }, { slug: 'bolta', name: 'Bolta', url: 'https://bolta.chiuta.ro/' },
    { slug: 'horizons-beyondlimits', name: 'Horizons', url: 'https://horizons-beyondlimits.chiuta.ro/' }, { slug: 'universul-observabil-3d', name: 'Universul Observabil 3D', url: 'https://universul-observabil-3d.chiuta.ro/' },
    { slug: 'orarium', name: 'ORARIUM', url: 'https://orarium.chiuta.ro/' }, { slug: 'clepsidra', name: 'CLEPSIDRA', url: 'https://clepsidra.chiuta.ro/' }, { slug: 'orar', name: 'Orar', url: 'https://orar.chiuta.ro/' }
  ];
  var CITIES = [['București', 44.4268, 26.1025, 'Europe/Bucharest'], ['Cluj-Napoca', 46.7712, 23.6236, 'Europe/Bucharest'], ['Timișoara', 45.7489, 21.2087, 'Europe/Bucharest'], ['Iași', 47.1585, 27.6014, 'Europe/Bucharest'],
    ['Constanța', 44.1598, 28.6348, 'Europe/Bucharest'], ['Brașov', 45.6427, 25.5887, 'Europe/Bucharest'], ['Craiova', 44.3302, 23.7949, 'Europe/Bucharest'], ['Sibiu', 45.7983, 24.1256, 'Europe/Bucharest'],
    ['Oradea', 47.0465, 21.9189, 'Europe/Bucharest'], ['Alba Iulia', 46.0733, 23.5805, 'Europe/Bucharest'], ['Chișinău', 47.0105, 28.8638, 'Europe/Chisinau'], ['Madrid', 40.4168, -3.7038, 'Europe/Madrid'],
    ['Cádiz', 36.5271, -6.2886, 'Europe/Madrid'], ['Sevilla', 37.3891, -5.9845, 'Europe/Madrid'], ['Lisabona', 38.7223, -9.1393, 'Europe/Lisbon'], ['Paris', 48.8566, 2.3522, 'Europe/Paris'], ['London', 51.5074, -0.1278, 'Europe/London'],
    ['Berlin', 52.52, 13.405, 'Europe/Berlin'], ['Roma', 41.9028, 12.4964, 'Europe/Rome'], ['Viena', 48.2082, 16.3738, 'Europe/Vienna'], ['Budapesta', 47.4979, 19.0402, 'Europe/Budapest'], ['Atena', 37.9838, 23.7275, 'Europe/Athens'],
    ['Istanbul', 41.0082, 28.9784, 'Europe/Istanbul'], ['Reykjavík', 64.1466, -21.9426, 'Atlantic/Reykjavik'], ['Cairo', 30.0444, 31.2357, 'Africa/Cairo'], ['Luxor', 25.6872, 32.6396, 'Africa/Cairo'], ['Alger', 36.7538, 3.0588, 'Africa/Algiers'],
    ['Tunis', 36.8065, 10.1815, 'Africa/Tunis'], ['Casablanca', 33.5731, -7.5898, 'Africa/Casablanca'], ['Riyadh', 24.7136, 46.6753, 'Asia/Riyadh'], ['New York', 40.7128, -74.006, 'America/New_York'], ['Los Angeles', 34.0522, -118.2437, 'America/Los_Angeles'],
    ['Ciudad de México', 19.4326, -99.1332, 'America/Mexico_City'], ['São Paulo', -23.5505, -46.6333, 'America/Sao_Paulo'], ['Tokyo', 35.6762, 139.6503, 'Asia/Tokyo'], ['Delhi', 28.6139, 77.209, 'Asia/Kolkata'], ['Sydney', -33.8688, 151.2093, 'Australia/Sydney'],
    ['Nairobi', -1.2921, 36.8219, 'Africa/Nairobi'], ['Cape Town', -33.9249, 18.4241, 'Africa/Johannesburg']];
  var num = function (v) { if (typeof v === 'string') v = v.trim().replace(',', '.'); if (v === '' || v == null) return NaN; return +v; };
  var clean = function (s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n || 80); };
  var r4 = function (x) { return Math.round(x * 1e4) / 1e4; };
  function norm(o) {
    if (!o || typeof o !== 'object') return null; var lat = num(o.lat), lon = num(o.lon);
    if (!isFinite(lat) || !isFinite(lon) || abs(lat) > 90 || abs(lon) > 180) return null;
    var alt = num(o.alt); if (!isFinite(alt) || alt < -500 || alt > 9000) alt = 0;
    var src = { manual: 1, geo: 1, city: 1, envelope: 1 }[o.src] ? o.src : 'manual', t = num(o.t); if (!isFinite(t) || t <= 0) t = 0;
    return { v: 1, lat: r4(lat), lon: r4(lon), name: clean(o.name, 80), tz: validTz(o.tz) ? o.tz : '', alt: Math.round(alt), src: src, t: t };
  }
  var store = function () { try { return root.localStorage; } catch (e) { return null; } };
  function readStore() { var s = store(); if (!s) return null; try { return norm(JSON.parse(s.getItem(KEY))); } catch (e) { return null; } }
  function now() { return nowOverride != null ? nowOverride : Date.now(); }
  function emit() {
    subs.slice().forEach(function (f) { try { f(cur); } catch (e) { /* un abonat defect nu oprește ceilalți */ } });
    try { if (root.document && root.CustomEvent) root.dispatchEvent(new root.CustomEvent('fff-place', { detail: cur })); } catch (e) { /* */ }
  }
  function get() { if (!cur) cur = readStore(); return cur ? JSON.parse(JSON.stringify(cur)) : null; }
  function tzOf(p) { return p && validTz(p.tz) ? p.tz : deviceTz(); }
  function set(o, src) {
    var n = norm(Object.assign({}, o, { t: Date.now(), src: src || o.src || 'manual' })); if (!n) return null;
    if (!n.tz) n.tz = deviceTz(); cur = n;
    var s = store(); try { if (s) s.setItem(KEY, JSON.stringify(n)); } catch (e) { /* memorie plină/blocată: rămâne în pagină */ }
    try { if (bc) bc.postMessage({ fff: 'place', place: n }); } catch (e) { /* */ }
    emit(); return get();
  }
  function clear() {
    cur = null; var s = store(); try { if (s) s.removeItem(KEY); } catch (e) { /* */ }
    try { if (bc) bc.postMessage({ fff: 'place', clear: true, t: Date.now() }); } catch (e) { /* */ }
    emit();
  }
  function onRemote(n, clr) { if (clr) { if (cur) { cur = null; emit(); } return; } n = norm(n); if (!n) return; if (cur && cur.t >= n.t && cur.lat === n.lat && cur.lon === n.lon) return; if (!cur || n.t >= cur.t) { cur = n; emit(); } }
  function onChange(f, immediate) { subs.push(f); if (immediate !== false) { var c = get(); if (c) { try { f(c); } catch (e) { /* */ } } } return function () { subs = subs.filter(function (x) { return x !== f; }); }; }
  function opts() { var s = store(), o = {}; try { o = JSON.parse(s.getItem(OPTK)) || {}; } catch (e) { /* */ } return { alertDays: [0, 1, 7, 30].indexOf(o.alertDays) >= 0 ? o.alertDays : 7 }; }
  function setOpts(o) { var s = store(), c = opts(); if (o && o.alertDays != null) c.alertDays = o.alertDays; try { if (s) s.setItem(OPTK, JSON.stringify(c)); } catch (e) { /* */ } renderAlert(); return c; }
  function startSync() {
    if (started) return; started = true;
    try { if (typeof root.BroadcastChannel !== 'undefined') { bc = new root.BroadcastChannel(CHAN); bc.onmessage = function (m) { var d = m && m.data; if (d && d.fff === 'place') onRemote(d.place, d.clear); }; } } catch (e) { bc = null; }
    try { root.addEventListener('storage', function (ev) { if (ev.key === KEY) { var n = ev.newValue ? readStore() : null; if (n) onRemote(n, false); else onRemote(null, true); } }); } catch (e) { /* */ }
  }

  /* ---------- plicul FFF `place/fff` ---------- */
  function appSlug() {
    try { var F = root.FFF; if (F && F.app && F.app.slug) return F.app.slug; var el = root.document.getElementById('fff-info'); if (el) return JSON.parse(el.textContent).slug; } catch (e) { /* */ }
    return 'place';
  }
  function envelope() {
    var E = root.FFF && root.FFF.envelope, c = get(); if (!E || !c) return null;
    return E.create({ type: 'place/fff', title: c.name || coordText(c), payload: { v: 1, lat: c.lat, lon: c.lon, name: c.name, tz: c.tz, alt: c.alt }, app: appSlug(), source: 'fff-place' });
  }
  function accept(env) {
    var E = root.FFF && root.FFF.envelope; if (!E) throw new Error('fără plic'); env = E.normalize(env);
    if (env.type !== 'place/fff') throw new Error('tip'); var n = norm(env.payload); if (!n) throw new Error('loc'); n.src = 'envelope';
    var c = set(n, 'envelope'); return T('received', { p: placeLabel(c) });
  }
  function linkFor(app) {
    var E = root.FFF && root.FFF.envelope, env = envelope(); if (!E || !env) return Promise.resolve(null);
    return E.toLink(env, app.url).then(function (u) { return u.replace('#fff=', '#fffplace='); }, function () { return null; });
  }
  function fromHashOnce() {   // #fffplace=<plic împachetat> → banda de confirmare; fragmentul se șterge imediat din adresă (aplicațiile cu rutare pe hash nu-l văd)
    var h = ''; try { h = root.location.hash || ''; } catch (e) { return; }
    var m = /(?:^#|&)fffplace=([^&]+)/.exec(h); if (!m) return;
    try { var rest = h.replace(/(^#|&)fffplace=[^&]*/, '').replace(/^&/, '#').replace(/^#?$/, ''); if (root.history && root.history.replaceState) root.history.replaceState(null, '', root.location.pathname + root.location.search + rest); } catch (e) { /* */ }
    pending = m[1];
  }
  var pending = null;
  function handlePending() {
    var E = root.FFF && root.FFF.envelope; if (!pending || !E) return; var p = pending; pending = null;
    E.unpack(p).then(E.parse).then(function (env) { if (env && env.type === 'place/fff' && norm(env.payload)) E.banner(env, accept); else E.toast(T('bad')); }, function () { E.toast(T('bad')); });
  }

  /* ================= TEXTE (8 limbi) ================= */
  var I18N = {
    ro: { jH: "Jurnal de teren și eclipse", jNone: "Nicio observație din jurnalul de teren nu coincide cu o eclipsă vizibilă din locul ei.", jLine: "{title} — {kind}, {date}", jAdd: "Adaugă o observație în jurnal", jDraft: "{kind} · {date}", chip: 'Locație', chipSet: 'Alege locația', dlg: 'Locul și ora mele', intro: 'O singură locație pentru toată suita cer–timp (Eclipsa-2027, Bolta, Horizons, Universul Observabil 3D, ORARIUM, CLEPSIDRA, Orar). Rămâne doar în acest browser; nu se trimite nicăieri.',
      fName: 'Numele locului', fLat: 'Latitudine (−90…90, nord pozitiv)', fLon: 'Longitudine (−180…180, est pozitiv)', fTz: 'Fus orar (IANA, ex. Europe/Bucharest)', city: 'Sau alege un oraș', cityNone: '— alege —', apply: 'Salvează locul',
      geo: 'Folosește poziția dispozitivului', geoAsk: 'Citesc poziția dispozitivului o singură dată, o păstrez doar în acest browser și o poți șterge oricând. Browserul îți va cere și el acordul. Continui?', geoYes: 'Da, citește poziția', geoNo: 'Nu',
      geoWait: 'Citesc poziția…', geoDenied: 'Acces refuzat. Introdu locul manual.', geoNone: 'Browserul nu are geolocalizare. Introdu locul manual.', geoFail: 'Poziția nu e disponibilă sau a expirat timpul. Introdu locul manual.', geoName: 'Poziția mea',
      clear: 'Șterge locul', cleared: 'Locul a fost șters.', saved: 'Loc salvat: {p}.', errCoords: 'Latitudinea trebuie să fie între −90 și 90, longitudinea între −180 și 180.', errTz: 'Fus orar necunoscut; folosește un nume precum Europe/Bucharest.',
      share: 'Același loc în celelalte aplicații', shareNote: 'Aplicațiile deschise în acest browser pe aceeași adresă se actualizează singure. Cele de pe alte adrese (fiecare aplicație are adresa ei) primesc locul printr-o singură apăsare: deschide-le cu linkurile de mai jos sau trimite un fișier, un cod QR ori clipboardul.',
      open: 'Deschide {app} cu acest loc', send: 'Trimite ca fișier / QR / clipboard…', recv: 'Primește un loc…', file: 'Descarcă fișierul (.fff.json)', copy: 'Copiază în clipboard', copied: 'Copiat.', qr: 'Arată codul QR', received: 'Loc primit: {p}.', bad: 'Plic invalid sau neacceptat.',
      alertLabel: 'Alertă la eclipsă', alertOff: 'Oprită', alertDay: '1 zi', alertDays: '{n} zile', close: 'Închide', dismiss: 'Ascunde alerta',
      panelTitle: 'Astea se întâmplă deasupra ta mâine', forDay: '{date} · {p} ({tz})', noPlace: 'Alege un loc ca să vezi cerul de deasupra ta.', setPlace: 'Alege locul',
      sunLine: 'Soare: răsare la {r}, apune la {s}.', sunUp: 'Soare: nu apune (zi polară).', sunDown: 'Soare: nu răsare (noapte polară).', moonLine: 'Lună: {ph}, {pct}% luminată', moonRise: 'răsare la {t}', moonSet: 'apune la {t}', moonNone: 'nu răsare și nu apune în ziua aceea',
      phases: ['lună nouă', 'semilună crescătoare', 'primul pătrar', 'lună gibboasă crescătoare', 'lună plină', 'lună gibboasă descrescătoare', 'ultimul pătrar', 'semilună descrescătoare'],
      planetsH: 'Planete pe cerul întunecat (seara și noaptea)', planet: '{n} (mag {m}): cel mai bine la {t}, {alt}° înălțime, spre {dir}', planetsNone: 'Nicio planetă strălucitoare nu e bine plasată pe cerul întunecat.', noDark: 'La această latitudine cerul nu se întunecă destul în noaptea aceea.',
      binoc: 'Cu binoclul sau telescopul: {list}.', pn: ['Mercur', 'Venus', 'Marte', 'Jupiter', 'Saturn', 'Uranus', 'Neptun'],
      eclTomorrow: 'Eclipsă mâine', eclNone: 'Nicio eclipsă vizibilă de la tine mâine.', eclNext: 'Următoarea eclipsă vizibilă de la tine', eclLine: '{kind}, {date}: maxim la {t}, mărime {m}{extra}', eclSpan: 'de la {a} la {b}', eclObsc: 'acoperire {o}%', eclPartVis: 'doar în parte deasupra orizontului',
      kinds: { solar_total: 'Eclipsă totală de Soare', solar_annular: 'Eclipsă inelară de Soare', solar_partial: 'Eclipsă parțială de Soare', lunar_total: 'Eclipsă totală de Lună', lunar_partial: 'Eclipsă parțială de Lună', lunar_penumbral: 'Eclipsă de Lună prin penumbră (greu de observat)' },
      safety: 'Nu privi Soarele fără filtre solare certificate (ISO 12312-2).', alertText: '{kind} {when}: maxim la {t} ({p}).', whenToday: 'astăzi', whenTomorrow: 'mâine', whenDays: 'în {n} zile', agenda: 'Adaugă în agendă', agendaDone: 'Adăugat în agendă.',
      approx: 'Calculat pe acest dispozitiv, fără rețea. Precizie: Luna și eclipsele ~1 minut, planetele ~0,5°. Nu e instrument de navigație.', dirs: ['N', 'NE', 'E', 'SE', 'S', 'SV', 'V', 'NV'] },
    en: { jH: "Field journal and eclipses", jNone: "No field-journal entry coincides with an eclipse visible from its place.", jLine: "{title} — {kind}, {date}", jAdd: "Add a journal observation", jDraft: "{kind} · {date}", chip: 'Location', chipSet: 'Set location', dlg: 'My place and time', intro: 'One place for the whole sky–time suite (Eclipsa-2027, Bolta, Horizons, Universul Observabil 3D, ORARIUM, CLEPSIDRA, Orar). It stays in this browser only; nothing is sent anywhere.',
      fName: 'Place name', fLat: 'Latitude (−90…90, north positive)', fLon: 'Longitude (−180…180, east positive)', fTz: 'Time zone (IANA, e.g. Europe/Bucharest)', city: 'Or pick a city', cityNone: '— choose —', apply: 'Save place',
      geo: 'Use my device position', geoAsk: 'I will read your device position once, keep it only in this browser, and you can delete it any time. Your browser will also ask for permission. Continue?', geoYes: 'Yes, read my position', geoNo: 'No',
      geoWait: 'Reading position…', geoDenied: 'Permission denied. Enter the place manually.', geoNone: 'This browser has no geolocation. Enter the place manually.', geoFail: 'Position unavailable or timed out. Enter the place manually.', geoName: 'My position',
      clear: 'Delete place', cleared: 'Place deleted.', saved: 'Place saved: {p}.', errCoords: 'Latitude must be between −90 and 90, longitude between −180 and 180.', errTz: 'Unknown time zone; use a name such as Europe/Bucharest.',
      share: 'Same place in the other apps', shareNote: 'Apps open in this browser at the same address update by themselves. Apps at other addresses (each app has its own) receive the place with one tap: open them with the links below, or send a file, a QR code or the clipboard.',
      open: 'Open {app} with this place', send: 'Send as file / QR / clipboard…', recv: 'Receive a place…', file: 'Download file (.fff.json)', copy: 'Copy to clipboard', copied: 'Copied.', qr: 'Show QR code', received: 'Place received: {p}.', bad: 'Invalid or unsupported envelope.',
      alertLabel: 'Eclipse alert', alertOff: 'Off', alertDay: '1 day', alertDays: '{n} days', close: 'Close', dismiss: 'Dismiss alert',
      panelTitle: 'What is happening above you tomorrow', forDay: '{date} · {p} ({tz})', noPlace: 'Choose a place to see the sky above you.', setPlace: 'Choose place',
      sunLine: 'Sun: rises at {r}, sets at {s}.', sunUp: 'Sun: does not set (polar day).', sunDown: 'Sun: does not rise (polar night).', moonLine: 'Moon: {ph}, {pct}% lit', moonRise: 'rises at {t}', moonSet: 'sets at {t}', moonNone: 'neither rises nor sets that day',
      phases: ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full moon', 'waning gibbous', 'last quarter', 'waning crescent'],
      planetsH: 'Planets in the dark sky (evening and night)', planet: '{n} (mag {m}): best at {t}, {alt}° high, towards {dir}', planetsNone: 'No bright planet is well placed in the dark sky.', noDark: 'At this latitude the sky does not get dark enough that night.',
      binoc: 'With binoculars or a telescope: {list}.', pn: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'],
      eclTomorrow: 'Eclipse tomorrow', eclNone: 'No eclipse visible from your place tomorrow.', eclNext: 'Next eclipse visible from your place', eclLine: '{kind}, {date}: maximum at {t}, magnitude {m}{extra}', eclSpan: 'from {a} to {b}', eclObsc: 'obscuration {o}%', eclPartVis: 'only partly above the horizon',
      kinds: { solar_total: 'Total solar eclipse', solar_annular: 'Annular solar eclipse', solar_partial: 'Partial solar eclipse', lunar_total: 'Total lunar eclipse', lunar_partial: 'Partial lunar eclipse', lunar_penumbral: 'Penumbral lunar eclipse (hard to see)' },
      safety: 'Never look at the Sun without certified solar filters (ISO 12312-2).', alertText: '{kind} {when}: maximum at {t} ({p}).', whenToday: 'today', whenTomorrow: 'tomorrow', whenDays: 'in {n} days', agenda: 'Add to agenda', agendaDone: 'Added to the agenda.',
      approx: 'Computed on this device, offline. Accuracy: Moon and eclipse times about a minute, planets about 0.5°. Not for navigation.', dirs: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] },
    fr: { jH: "Journal de terrain et éclipses", jNone: "Aucune entrée du journal de terrain ne coïncide avec une éclipse visible de son lieu.", jLine: "{title} — {kind}, {date}", jAdd: "Ajouter une observation au journal", jDraft: "{kind} · {date}", chip: 'Lieu', chipSet: 'Choisir le lieu', dlg: 'Mon lieu et mon heure', intro: 'Un seul lieu pour toute la suite ciel–temps (Eclipsa-2027, Bolta, Horizons, Universul Observabil 3D, ORARIUM, CLEPSIDRA, Orar). Il reste dans ce navigateur ; rien n’est envoyé.',
      fName: 'Nom du lieu', fLat: 'Latitude (−90…90, nord positif)', fLon: 'Longitude (−180…180, est positif)', fTz: 'Fuseau horaire (IANA, ex. Europe/Paris)', city: 'Ou choisir une ville', cityNone: '— choisir —', apply: 'Enregistrer le lieu',
      geo: 'Utiliser la position de l’appareil', geoAsk: 'Je lirai la position de l’appareil une seule fois, la garderai seulement dans ce navigateur, et vous pouvez la supprimer à tout moment. Le navigateur demandera aussi votre accord. Continuer ?', geoYes: 'Oui, lire ma position', geoNo: 'Non',
      geoWait: 'Lecture de la position…', geoDenied: 'Accès refusé. Saisissez le lieu à la main.', geoNone: 'Ce navigateur n’a pas de géolocalisation. Saisissez le lieu à la main.', geoFail: 'Position indisponible ou délai dépassé. Saisissez le lieu à la main.', geoName: 'Ma position',
      clear: 'Supprimer le lieu', cleared: 'Lieu supprimé.', saved: 'Lieu enregistré : {p}.', errCoords: 'La latitude doit être entre −90 et 90, la longitude entre −180 et 180.', errTz: 'Fuseau inconnu ; utilisez un nom comme Europe/Paris.',
      share: 'Le même lieu dans les autres applications', shareNote: 'Les applications ouvertes dans ce navigateur à la même adresse se mettent à jour seules. Celles d’autres adresses (chaque application a la sienne) reçoivent le lieu en un geste : ouvrez-les avec les liens ci-dessous, ou envoyez un fichier, un code QR ou le presse-papiers.',
      open: 'Ouvrir {app} avec ce lieu', send: 'Envoyer en fichier / QR / presse-papiers…', recv: 'Recevoir un lieu…', file: 'Télécharger le fichier (.fff.json)', copy: 'Copier dans le presse-papiers', copied: 'Copié.', qr: 'Afficher le code QR', received: 'Lieu reçu : {p}.', bad: 'Enveloppe invalide ou non prise en charge.',
      alertLabel: 'Alerte éclipse', alertOff: 'Désactivée', alertDay: '1 jour', alertDays: '{n} jours', close: 'Fermer', dismiss: 'Masquer l’alerte',
      panelTitle: 'Ce qui se passe au-dessus de vous demain', forDay: '{date} · {p} ({tz})', noPlace: 'Choisissez un lieu pour voir le ciel au-dessus de vous.', setPlace: 'Choisir le lieu',
      sunLine: 'Soleil : se lève à {r}, se couche à {s}.', sunUp: 'Soleil : ne se couche pas (jour polaire).', sunDown: 'Soleil : ne se lève pas (nuit polaire).', moonLine: 'Lune : {ph}, {pct} % éclairée', moonRise: 'se lève à {t}', moonSet: 'se couche à {t}', moonNone: 'ni lever ni coucher ce jour-là',
      phases: ['nouvelle lune', 'croissant ascendant', 'premier quartier', 'gibbeuse croissante', 'pleine lune', 'gibbeuse décroissante', 'dernier quartier', 'croissant descendant'],
      planetsH: 'Planètes dans le ciel sombre (soir et nuit)', planet: '{n} (mag {m}) : au mieux à {t}, {alt}° de hauteur, vers {dir}', planetsNone: 'Aucune planète brillante n’est bien placée dans le ciel sombre.', noDark: 'À cette latitude, le ciel ne devient pas assez sombre cette nuit-là.',
      binoc: 'Aux jumelles ou au télescope : {list}.', pn: ['Mercure', 'Vénus', 'Mars', 'Jupiter', 'Saturne', 'Uranus', 'Neptune'],
      eclTomorrow: 'Éclipse demain', eclNone: 'Aucune éclipse visible de chez vous demain.', eclNext: 'Prochaine éclipse visible de chez vous', eclLine: '{kind}, {date} : maximum à {t}, magnitude {m}{extra}', eclSpan: 'de {a} à {b}', eclObsc: 'obscuration {o} %', eclPartVis: 'seulement en partie au-dessus de l’horizon',
      kinds: { solar_total: 'Éclipse totale de Soleil', solar_annular: 'Éclipse annulaire de Soleil', solar_partial: 'Éclipse partielle de Soleil', lunar_total: 'Éclipse totale de Lune', lunar_partial: 'Éclipse partielle de Lune', lunar_penumbral: 'Éclipse de Lune par la pénombre (difficile à voir)' },
      safety: 'Ne regardez jamais le Soleil sans filtres solaires certifiés (ISO 12312-2).', alertText: '{kind} {when} : maximum à {t} ({p}).', whenToday: 'aujourd’hui', whenTomorrow: 'demain', whenDays: 'dans {n} jours', agenda: 'Ajouter à l’agenda', agendaDone: 'Ajouté à l’agenda.',
      approx: 'Calculé sur cet appareil, hors ligne. Précision : Lune et éclipses ~1 minute, planètes ~0,5°. Pas pour la navigation.', dirs: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] },
    it: { jH: "Diario di campo ed eclissi", jNone: "Nessuna voce del diario di campo coincide con un’eclissi visibile dal suo luogo.", jLine: "{title} — {kind}, {date}", jAdd: "Aggiungi un’osservazione al diario", jDraft: "{kind} · {date}", chip: 'Luogo', chipSet: 'Scegli il luogo', dlg: 'Il mio luogo e la mia ora', intro: 'Un solo luogo per tutta la suite cielo–tempo (Eclipsa-2027, Bolta, Horizons, Universul Observabil 3D, ORARIUM, CLEPSIDRA, Orar). Resta solo in questo browser; non viene inviato da nessuna parte.',
      fName: 'Nome del luogo', fLat: 'Latitudine (−90…90, nord positivo)', fLon: 'Longitudine (−180…180, est positivo)', fTz: 'Fuso orario (IANA, es. Europe/Rome)', city: 'Oppure scegli una città', cityNone: '— scegli —', apply: 'Salva il luogo',
      geo: 'Usa la posizione del dispositivo', geoAsk: 'Leggerò la posizione del dispositivo una sola volta, la terrò solo in questo browser e potrai cancellarla in ogni momento. Anche il browser chiederà il permesso. Continuare?', geoYes: 'Sì, leggi la posizione', geoNo: 'No',
      geoWait: 'Lettura della posizione…', geoDenied: 'Accesso negato. Inserisci il luogo a mano.', geoNone: 'Questo browser non ha la geolocalizzazione. Inserisci il luogo a mano.', geoFail: 'Posizione non disponibile o tempo scaduto. Inserisci il luogo a mano.', geoName: 'La mia posizione',
      clear: 'Cancella il luogo', cleared: 'Luogo cancellato.', saved: 'Luogo salvato: {p}.', errCoords: 'La latitudine deve essere tra −90 e 90, la longitudine tra −180 e 180.', errTz: 'Fuso sconosciuto; usa un nome come Europe/Rome.',
      share: 'Lo stesso luogo nelle altre app', shareNote: 'Le app aperte in questo browser allo stesso indirizzo si aggiornano da sole. Quelle ad altri indirizzi (ogni app ha il suo) ricevono il luogo con un tocco: aprile con i link qui sotto, oppure invia un file, un codice QR o gli appunti.',
      open: 'Apri {app} con questo luogo', send: 'Invia come file / QR / appunti…', recv: 'Ricevi un luogo…', file: 'Scarica il file (.fff.json)', copy: 'Copia negli appunti', copied: 'Copiato.', qr: 'Mostra il codice QR', received: 'Luogo ricevuto: {p}.', bad: 'Busta non valida o non supportata.',
      alertLabel: 'Avviso eclissi', alertOff: 'Disattivato', alertDay: '1 giorno', alertDays: '{n} giorni', close: 'Chiudi', dismiss: 'Nascondi l’avviso',
      panelTitle: 'Cosa succede sopra di te domani', forDay: '{date} · {p} ({tz})', noPlace: 'Scegli un luogo per vedere il cielo sopra di te.', setPlace: 'Scegli il luogo',
      sunLine: 'Sole: sorge alle {r}, tramonta alle {s}.', sunUp: 'Sole: non tramonta (giorno polare).', sunDown: 'Sole: non sorge (notte polare).', moonLine: 'Luna: {ph}, {pct}% illuminata', moonRise: 'sorge alle {t}', moonSet: 'tramonta alle {t}', moonNone: 'non sorge né tramonta quel giorno',
      phases: ['luna nuova', 'luna crescente', 'primo quarto', 'gibbosa crescente', 'luna piena', 'gibbosa calante', 'ultimo quarto', 'luna calante'],
      planetsH: 'Pianeti nel cielo buio (sera e notte)', planet: '{n} (mag {m}): meglio alle {t}, {alt}° di altezza, verso {dir}', planetsNone: 'Nessun pianeta brillante è ben posizionato nel cielo buio.', noDark: 'A questa latitudine il cielo non diventa abbastanza buio quella notte.',
      binoc: 'Con binocolo o telescopio: {list}.', pn: ['Mercurio', 'Venere', 'Marte', 'Giove', 'Saturno', 'Urano', 'Nettuno'],
      eclTomorrow: 'Eclissi domani', eclNone: 'Nessuna eclissi visibile da te domani.', eclNext: 'Prossima eclissi visibile da te', eclLine: '{kind}, {date}: massimo alle {t}, magnitudine {m}{extra}', eclSpan: 'dalle {a} alle {b}', eclObsc: 'oscuramento {o}%', eclPartVis: 'solo in parte sopra l’orizzonte',
      kinds: { solar_total: 'Eclissi totale di Sole', solar_annular: 'Eclissi anulare di Sole', solar_partial: 'Eclissi parziale di Sole', lunar_total: 'Eclissi totale di Luna', lunar_partial: 'Eclissi parziale di Luna', lunar_penumbral: 'Eclissi di Luna di penombra (difficile da vedere)' },
      safety: 'Non guardare mai il Sole senza filtri solari certificati (ISO 12312-2).', alertText: '{kind} {when}: massimo alle {t} ({p}).', whenToday: 'oggi', whenTomorrow: 'domani', whenDays: 'tra {n} giorni', agenda: 'Aggiungi all’agenda', agendaDone: 'Aggiunto all’agenda.',
      approx: 'Calcolato su questo dispositivo, offline. Precisione: Luna ed eclissi ~1 minuto, pianeti ~0,5°. Non per la navigazione.', dirs: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] },
    es: { jH: "Diario de campo y eclipses", jNone: "Ninguna entrada del diario de campo coincide con un eclipse visible desde su lugar.", jLine: "{title} — {kind}, {date}", jAdd: "Añadir una observación al diario", jDraft: "{kind} · {date}", chip: 'Lugar', chipSet: 'Elegir lugar', dlg: 'Mi lugar y mi hora', intro: 'Un solo lugar para toda la suite cielo–tiempo (Eclipsa-2027, Bolta, Horizons, Universul Observabil 3D, ORARIUM, CLEPSIDRA, Orar). Se queda solo en este navegador; no se envía a ninguna parte.',
      fName: 'Nombre del lugar', fLat: 'Latitud (−90…90, norte positivo)', fLon: 'Longitud (−180…180, este positivo)', fTz: 'Zona horaria (IANA, p. ej. Europe/Madrid)', city: 'O elige una ciudad', cityNone: '— elegir —', apply: 'Guardar el lugar',
      geo: 'Usar la posición del dispositivo', geoAsk: 'Leeré la posición del dispositivo una sola vez, la guardaré solo en este navegador y puedes borrarla cuando quieras. El navegador también pedirá permiso. ¿Continuar?', geoYes: 'Sí, leer mi posición', geoNo: 'No',
      geoWait: 'Leyendo la posición…', geoDenied: 'Acceso denegado. Introduce el lugar a mano.', geoNone: 'Este navegador no tiene geolocalización. Introduce el lugar a mano.', geoFail: 'Posición no disponible o tiempo agotado. Introduce el lugar a mano.', geoName: 'Mi posición',
      clear: 'Borrar el lugar', cleared: 'Lugar borrado.', saved: 'Lugar guardado: {p}.', errCoords: 'La latitud debe estar entre −90 y 90 y la longitud entre −180 y 180.', errTz: 'Zona desconocida; usa un nombre como Europe/Madrid.',
      share: 'El mismo lugar en las demás aplicaciones', shareNote: 'Las aplicaciones abiertas en este navegador en la misma dirección se actualizan solas. Las de otras direcciones (cada aplicación tiene la suya) reciben el lugar con un toque: ábrelas con los enlaces de abajo o envía un archivo, un código QR o el portapapeles.',
      open: 'Abrir {app} con este lugar', send: 'Enviar como archivo / QR / portapapeles…', recv: 'Recibir un lugar…', file: 'Descargar el archivo (.fff.json)', copy: 'Copiar al portapapeles', copied: 'Copiado.', qr: 'Mostrar el código QR', received: 'Lugar recibido: {p}.', bad: 'Sobre no válido o no admitido.',
      alertLabel: 'Aviso de eclipse', alertOff: 'Desactivado', alertDay: '1 día', alertDays: '{n} días', close: 'Cerrar', dismiss: 'Ocultar el aviso',
      panelTitle: 'Lo que ocurre sobre ti mañana', forDay: '{date} · {p} ({tz})', noPlace: 'Elige un lugar para ver el cielo sobre ti.', setPlace: 'Elegir lugar',
      sunLine: 'Sol: sale a las {r}, se pone a las {s}.', sunUp: 'Sol: no se pone (día polar).', sunDown: 'Sol: no sale (noche polar).', moonLine: 'Luna: {ph}, {pct} % iluminada', moonRise: 'sale a las {t}', moonSet: 'se pone a las {t}', moonNone: 'ni sale ni se pone ese día',
      phases: ['luna nueva', 'luna creciente', 'cuarto creciente', 'gibosa creciente', 'luna llena', 'gibosa menguante', 'cuarto menguante', 'luna menguante'],
      planetsH: 'Planetas en el cielo oscuro (tarde y noche)', planet: '{n} (mag {m}): mejor a las {t}, {alt}° de altura, hacia {dir}', planetsNone: 'Ningún planeta brillante está bien situado en el cielo oscuro.', noDark: 'A esta latitud el cielo no oscurece lo bastante esa noche.',
      binoc: 'Con prismáticos o telescopio: {list}.', pn: ['Mercurio', 'Venus', 'Marte', 'Júpiter', 'Saturno', 'Urano', 'Neptuno'],
      eclTomorrow: 'Eclipse mañana', eclNone: 'Ningún eclipse visible desde tu lugar mañana.', eclNext: 'Próximo eclipse visible desde tu lugar', eclLine: '{kind}, {date}: máximo a las {t}, magnitud {m}{extra}', eclSpan: 'de {a} a {b}', eclObsc: 'oscurecimiento {o} %', eclPartVis: 'solo en parte sobre el horizonte',
      kinds: { solar_total: 'Eclipse total de Sol', solar_annular: 'Eclipse anular de Sol', solar_partial: 'Eclipse parcial de Sol', lunar_total: 'Eclipse total de Luna', lunar_partial: 'Eclipse parcial de Luna', lunar_penumbral: 'Eclipse penumbral de Luna (difícil de ver)' },
      safety: 'Nunca mires al Sol sin filtros solares certificados (ISO 12312-2).', alertText: '{kind} {when}: máximo a las {t} ({p}).', whenToday: 'hoy', whenTomorrow: 'mañana', whenDays: 'en {n} días', agenda: 'Añadir a la agenda', agendaDone: 'Añadido a la agenda.',
      approx: 'Calculado en este dispositivo, sin conexión. Precisión: Luna y eclipses ~1 minuto, planetas ~0,5°. No sirve para navegar.', dirs: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] },
    pt: { jH: "Diário de campo e eclipses", jNone: "Nenhuma entrada do diário de campo coincide com um eclipse visível do seu local.", jLine: "{title} — {kind}, {date}", jAdd: "Adicionar uma observação ao diário", jDraft: "{kind} · {date}", chip: 'Local', chipSet: 'Escolher o local', dlg: 'O meu local e a minha hora', intro: 'Um só local para toda a suíte céu–tempo (Eclipsa-2027, Bolta, Horizons, Universul Observabil 3D, ORARIUM, CLEPSIDRA, Orar). Fica só neste navegador; não é enviado para lado nenhum.',
      fName: 'Nome do local', fLat: 'Latitude (−90…90, norte positivo)', fLon: 'Longitude (−180…180, este positivo)', fTz: 'Fuso horário (IANA, ex. Europe/Lisbon)', city: 'Ou escolha uma cidade', cityNone: '— escolher —', apply: 'Guardar o local',
      geo: 'Usar a posição do dispositivo', geoAsk: 'Vou ler a posição do dispositivo uma só vez, guardá-la apenas neste navegador, e pode apagá-la a qualquer momento. O navegador também pedirá permissão. Continuar?', geoYes: 'Sim, ler a posição', geoNo: 'Não',
      geoWait: 'A ler a posição…', geoDenied: 'Acesso negado. Introduza o local manualmente.', geoNone: 'Este navegador não tem geolocalização. Introduza o local manualmente.', geoFail: 'Posição indisponível ou tempo esgotado. Introduza o local manualmente.', geoName: 'A minha posição',
      clear: 'Apagar o local', cleared: 'Local apagado.', saved: 'Local guardado: {p}.', errCoords: 'A latitude deve estar entre −90 e 90 e a longitude entre −180 e 180.', errTz: 'Fuso desconhecido; use um nome como Europe/Lisbon.',
      share: 'O mesmo local nas outras aplicações', shareNote: 'As aplicações abertas neste navegador no mesmo endereço atualizam-se sozinhas. As de outros endereços (cada aplicação tem o seu) recebem o local com um toque: abra-as com as ligações abaixo ou envie um ficheiro, um código QR ou a área de transferência.',
      open: 'Abrir {app} com este local', send: 'Enviar como ficheiro / QR / área de transferência…', recv: 'Receber um local…', file: 'Descarregar o ficheiro (.fff.json)', copy: 'Copiar para a área de transferência', copied: 'Copiado.', qr: 'Mostrar o código QR', received: 'Local recebido: {p}.', bad: 'Envelope inválido ou não suportado.',
      alertLabel: 'Alerta de eclipse', alertOff: 'Desativado', alertDay: '1 dia', alertDays: '{n} dias', close: 'Fechar', dismiss: 'Ocultar o alerta',
      panelTitle: 'O que acontece por cima de si amanhã', forDay: '{date} · {p} ({tz})', noPlace: 'Escolha um local para ver o céu por cima de si.', setPlace: 'Escolher o local',
      sunLine: 'Sol: nasce às {r}, põe-se às {s}.', sunUp: 'Sol: não se põe (dia polar).', sunDown: 'Sol: não nasce (noite polar).', moonLine: 'Lua: {ph}, {pct}% iluminada', moonRise: 'nasce às {t}', moonSet: 'põe-se às {t}', moonNone: 'nem nasce nem se põe nesse dia',
      phases: ['lua nova', 'lua crescente', 'quarto crescente', 'gibosa crescente', 'lua cheia', 'gibosa minguante', 'quarto minguante', 'lua minguante'],
      planetsH: 'Planetas no céu escuro (tarde e noite)', planet: '{n} (mag {m}): melhor às {t}, {alt}° de altura, para {dir}', planetsNone: 'Nenhum planeta brilhante está bem colocado no céu escuro.', noDark: 'A esta latitude o céu não escurece o suficiente nessa noite.',
      binoc: 'Com binóculos ou telescópio: {list}.', pn: ['Mercúrio', 'Vénus', 'Marte', 'Júpiter', 'Saturno', 'Urano', 'Neptuno'],
      eclTomorrow: 'Eclipse amanhã', eclNone: 'Nenhum eclipse visível do seu local amanhã.', eclNext: 'Próximo eclipse visível do seu local', eclLine: '{kind}, {date}: máximo às {t}, magnitude {m}{extra}', eclSpan: 'das {a} às {b}', eclObsc: 'obscurecimento {o}%', eclPartVis: 'só em parte acima do horizonte',
      kinds: { solar_total: 'Eclipse total do Sol', solar_annular: 'Eclipse anular do Sol', solar_partial: 'Eclipse parcial do Sol', lunar_total: 'Eclipse total da Lua', lunar_partial: 'Eclipse parcial da Lua', lunar_penumbral: 'Eclipse penumbral da Lua (difícil de ver)' },
      safety: 'Nunca olhe para o Sol sem filtros solares certificados (ISO 12312-2).', alertText: '{kind} {when}: máximo às {t} ({p}).', whenToday: 'hoje', whenTomorrow: 'amanhã', whenDays: 'dentro de {n} dias', agenda: 'Adicionar à agenda', agendaDone: 'Adicionado à agenda.',
      approx: 'Calculado neste dispositivo, offline. Precisão: Lua e eclipses ~1 minuto, planetas ~0,5°. Não serve para navegação.', dirs: ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'] },
    hu: { jH: "Terepnapló és fogyatkozások", jNone: "Egyik terepnapló-bejegyzés sem esik egy onnan látható fogyatkozásra.", jLine: "{title} — {kind}, {date}", jAdd: "Megfigyelés hozzáadása a naplóhoz", jDraft: "{kind} · {date}", chip: 'Hely', chipSet: 'Hely megadása', dlg: 'Helyem és időm', intro: 'Egyetlen hely az egész ég–idő csomaghoz (Eclipsa-2027, Bolta, Horizons, Universul Observabil 3D, ORARIUM, CLEPSIDRA, Orar). Csak ebben a böngészőben marad; sehová sem kerül elküldésre.',
      fName: 'A hely neve', fLat: 'Szélesség (−90…90, észak pozitív)', fLon: 'Hosszúság (−180…180, kelet pozitív)', fTz: 'Időzóna (IANA, pl. Europe/Budapest)', city: 'Vagy válassz várost', cityNone: '— válassz —', apply: 'Hely mentése',
      geo: 'Az eszköz pozíciójának használata', geoAsk: 'Egyszer kiolvasom az eszköz pozícióját, csak ebben a böngészőben tartom meg, és bármikor törölheted. A böngésző is engedélyt fog kérni. Folytassam?', geoYes: 'Igen, olvasd ki a pozíciót', geoNo: 'Nem',
      geoWait: 'Pozíció olvasása…', geoDenied: 'Hozzáférés megtagadva. Add meg a helyet kézzel.', geoNone: 'Ez a böngésző nem tud helymeghatározást. Add meg a helyet kézzel.', geoFail: 'A pozíció nem elérhető vagy lejárt az idő. Add meg a helyet kézzel.', geoName: 'Pozícióm',
      clear: 'Hely törlése', cleared: 'A hely törölve.', saved: 'Hely mentve: {p}.', errCoords: 'A szélesség −90 és 90, a hosszúság −180 és 180 között legyen.', errTz: 'Ismeretlen időzóna; használj ilyen nevet: Europe/Budapest.',
      share: 'Ugyanaz a hely a többi alkalmazásban', shareNote: 'Az ebben a böngészőben, ugyanazon a címen megnyitott alkalmazások maguktól frissülnek. A más címen lévők (minden alkalmazásnak saját címe van) egy koppintással kapják meg a helyet: nyisd meg őket az alábbi hivatkozásokkal, vagy küldj fájlt, QR-kódot vagy vágólapot.',
      open: '{app} megnyitása ezzel a hellyel', send: 'Küldés fájlként / QR-kóddal / vágólappal…', recv: 'Hely fogadása…', file: 'Fájl letöltése (.fff.json)', copy: 'Másolás a vágólapra', copied: 'Átmásolva.', qr: 'QR-kód mutatása', received: 'Hely fogadva: {p}.', bad: 'Érvénytelen vagy nem támogatott boríték.',
      alertLabel: 'Fogyatkozás-riasztás', alertOff: 'Ki', alertDay: '1 nap', alertDays: '{n} nap', close: 'Bezár', dismiss: 'Riasztás elrejtése',
      panelTitle: 'Mi történik holnap a fejed felett', forDay: '{date} · {p} ({tz})', noPlace: 'Válassz helyet, hogy lásd a feletted lévő eget.', setPlace: 'Hely megadása',
      sunLine: 'Nap: kel {r}-kor, nyugszik {s}-kor.', sunUp: 'Nap: nem nyugszik le (sarki nappal).', sunDown: 'Nap: nem kel fel (sarki éjszaka).', moonLine: 'Hold: {ph}, {pct}% megvilágítva', moonRise: 'kel {t}-kor', moonSet: 'nyugszik {t}-kor', moonNone: 'aznap nem kel és nem nyugszik',
      phases: ['újhold', 'növekvő sarló', 'első negyed', 'növekvő hold (dombor)', 'telihold', 'fogyó hold (dombor)', 'utolsó negyed', 'fogyó sarló'],
      planetsH: 'Bolygók a sötét égen (este és éjszaka)', planet: '{n} (mag {m}): legjobban {t}-kor, {alt}° magasan, {dir} felé', planetsNone: 'Nincs fényes bolygó jó helyen a sötét égen.', noDark: 'Ezen a szélességen aznap éjjel nem lesz elég sötét.',
      binoc: 'Távcsővel: {list}.', pn: ['Merkúr', 'Vénusz', 'Mars', 'Jupiter', 'Szaturnusz', 'Uránusz', 'Neptunusz'],
      eclTomorrow: 'Fogyatkozás holnap', eclNone: 'Holnap nem látható fogyatkozás a helyedről.', eclNext: 'A következő, a helyedről látható fogyatkozás', eclLine: '{kind}, {date}: maximum {t}-kor, nagyság {m}{extra}', eclSpan: '{a}–{b}', eclObsc: 'fedés {o}%', eclPartVis: 'csak részben van a horizont felett',
      kinds: { solar_total: 'Teljes napfogyatkozás', solar_annular: 'Gyűrűs napfogyatkozás', solar_partial: 'Részleges napfogyatkozás', lunar_total: 'Teljes holdfogyatkozás', lunar_partial: 'Részleges holdfogyatkozás', lunar_penumbral: 'Félárnyékos holdfogyatkozás (nehezen látható)' },
      safety: 'Soha ne nézz a Napba tanúsított napszűrő nélkül (ISO 12312-2).', alertText: '{kind} {when}: maximum {t}-kor ({p}).', whenToday: 'ma', whenTomorrow: 'holnap', whenDays: '{n} nap múlva', agenda: 'Hozzáadás a naplóhoz', agendaDone: 'Hozzáadva a naplóhoz.',
      approx: 'Ezen az eszközön számolva, hálózat nélkül. Pontosság: Hold és fogyatkozások ~1 perc, bolygók ~0,5°. Navigációra nem alkalmas.', dirs: ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy'] },
    de: { jH: "Feldjournal und Finsternisse", jNone: "Kein Eintrag des Feldjournals fällt auf eine von seinem Ort sichtbare Finsternis.", jLine: "{title} — {kind}, {date}", jAdd: "Beobachtung ins Journal eintragen", jDraft: "{kind} · {date}", chip: 'Ort', chipSet: 'Ort festlegen', dlg: 'Mein Ort und meine Zeit', intro: 'Ein Ort für die ganze Himmel–Zeit-Suite (Eclipsa-2027, Bolta, Horizons, Universul Observabil 3D, ORARIUM, CLEPSIDRA, Orar). Er bleibt nur in diesem Browser; nichts wird gesendet.',
      fName: 'Ortsname', fLat: 'Breite (−90…90, Norden positiv)', fLon: 'Länge (−180…180, Osten positiv)', fTz: 'Zeitzone (IANA, z. B. Europe/Berlin)', city: 'Oder eine Stadt wählen', cityNone: '— wählen —', apply: 'Ort speichern',
      geo: 'Position des Geräts verwenden', geoAsk: 'Ich lese die Position des Geräts einmalig aus, behalte sie nur in diesem Browser, und du kannst sie jederzeit löschen. Der Browser fragt zusätzlich nach der Erlaubnis. Fortfahren?', geoYes: 'Ja, Position lesen', geoNo: 'Nein',
      geoWait: 'Position wird gelesen…', geoDenied: 'Zugriff verweigert. Ort von Hand eingeben.', geoNone: 'Dieser Browser hat keine Geolokalisierung. Ort von Hand eingeben.', geoFail: 'Position nicht verfügbar oder Zeitüberschreitung. Ort von Hand eingeben.', geoName: 'Meine Position',
      clear: 'Ort löschen', cleared: 'Ort gelöscht.', saved: 'Ort gespeichert: {p}.', errCoords: 'Die Breite muss zwischen −90 und 90 liegen, die Länge zwischen −180 und 180.', errTz: 'Unbekannte Zeitzone; nutze einen Namen wie Europe/Berlin.',
      share: 'Derselbe Ort in den anderen Apps', shareNote: 'Apps, die in diesem Browser unter derselben Adresse offen sind, aktualisieren sich selbst. Apps unter anderen Adressen (jede App hat ihre eigene) erhalten den Ort mit einem Tipp: mit den Links unten öffnen oder eine Datei, einen QR-Code oder die Zwischenablage senden.',
      open: '{app} mit diesem Ort öffnen', send: 'Als Datei / QR / Zwischenablage senden…', recv: 'Einen Ort empfangen…', file: 'Datei herunterladen (.fff.json)', copy: 'In die Zwischenablage kopieren', copied: 'Kopiert.', qr: 'QR-Code zeigen', received: 'Ort empfangen: {p}.', bad: 'Ungültiger oder nicht unterstützter Umschlag.',
      alertLabel: 'Finsternis-Warnung', alertOff: 'Aus', alertDay: '1 Tag', alertDays: '{n} Tage', close: 'Schließen', dismiss: 'Warnung ausblenden',
      panelTitle: 'Was morgen über dir geschieht', forDay: '{date} · {p} ({tz})', noPlace: 'Wähle einen Ort, um den Himmel über dir zu sehen.', setPlace: 'Ort wählen',
      sunLine: 'Sonne: Aufgang {r}, Untergang {s}.', sunUp: 'Sonne: geht nicht unter (Polartag).', sunDown: 'Sonne: geht nicht auf (Polarnacht).', moonLine: 'Mond: {ph}, {pct} % beleuchtet', moonRise: 'Aufgang {t}', moonSet: 'Untergang {t}', moonNone: 'weder Auf- noch Untergang an dem Tag',
      phases: ['Neumond', 'zunehmende Sichel', 'erstes Viertel', 'zunehmender Mond (Buckel)', 'Vollmond', 'abnehmender Mond (Buckel)', 'letztes Viertel', 'abnehmende Sichel'],
      planetsH: 'Planeten am dunklen Himmel (Abend und Nacht)', planet: '{n} (mag {m}): am besten um {t}, {alt}° hoch, Richtung {dir}', planetsNone: 'Kein heller Planet steht gut am dunklen Himmel.', noDark: 'Auf dieser Breite wird der Himmel in jener Nacht nicht dunkel genug.',
      binoc: 'Mit Fernglas oder Teleskop: {list}.', pn: ['Merkur', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptun'],
      eclTomorrow: 'Finsternis morgen', eclNone: 'Morgen ist von deinem Ort keine Finsternis sichtbar.', eclNext: 'Nächste von deinem Ort sichtbare Finsternis', eclLine: '{kind}, {date}: Maximum um {t}, Größe {m}{extra}', eclSpan: 'von {a} bis {b}', eclObsc: 'Bedeckung {o} %', eclPartVis: 'nur teilweise über dem Horizont',
      kinds: { solar_total: 'Totale Sonnenfinsternis', solar_annular: 'Ringförmige Sonnenfinsternis', solar_partial: 'Partielle Sonnenfinsternis', lunar_total: 'Totale Mondfinsternis', lunar_partial: 'Partielle Mondfinsternis', lunar_penumbral: 'Halbschatten-Mondfinsternis (schwer zu sehen)' },
      safety: 'Schau nie ohne zertifizierte Sonnenfilter (ISO 12312-2) in die Sonne.', alertText: '{kind} {when}: Maximum um {t} ({p}).', whenToday: 'heute', whenTomorrow: 'morgen', whenDays: 'in {n} Tagen', agenda: 'Zur Agenda hinzufügen', agendaDone: 'Zur Agenda hinzugefügt.',
      approx: 'Auf diesem Gerät berechnet, offline. Genauigkeit: Mond und Finsternisse ~1 Minute, Planeten ~0,5°. Nicht zur Navigation.', dirs: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'] }
  };
  function lang() { var l = ''; try { l = (root.document.documentElement.lang || '').slice(0, 2).toLowerCase(); } catch (e) { /* */ } return I18N[l] ? l : 'en'; }
  function T(k, v) { var s = I18N[lang()][k]; if (s == null) s = I18N.en[k]; if (s == null) return k; if (typeof s !== 'string') return s; if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]); return s; }
  function nf(n, d) { try { return new Intl.NumberFormat(lang(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); } catch (e) { return n.toFixed(d); } }
  function fmtTime(ms, tz) { try { return new Intl.DateTimeFormat(lang(), { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms)); } catch (e) { return new Date(ms).toISOString().slice(11, 16); } }
  function fmtDate(ms, tz, long) { try { return new Intl.DateTimeFormat(lang(), { timeZone: tz, weekday: long ? 'long' : undefined, day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' }).format(new Date(ms)); } catch (e) { return new Date(ms).toISOString().slice(0, 10); } }
  function coordText(c) { return nf(Math.abs(c.lat), 2) + '°' + (c.lat < 0 ? 'S' : 'N') + ' ' + nf(Math.abs(c.lon), 2) + '°' + (c.lon < 0 ? 'W' : 'E'); }
  function placeLabel(c) { return c ? (c.name || coordText(c)) : ''; }

  /* ================= INTERFAȚĂ ================= */
  var doc = function () { return root.document; };
  function el(tag, css, txt, attrs) { var n = doc().createElement(tag); if (force && !/(^|;)\s*color:/.test(css || '')) css = (css || '') + ';color:' + pal().fg + ';'; if (css) n.style.cssText = css; if (txt != null) n.textContent = txt; if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
  /* culori explicite (paleta urmează schema sistemului): regulile CSS ale aplicației gazdă pentru h2/label/p/a nu trebuie să ajungă pe fundalul dialogului */
  var PAL = { light: { bg: '#ffffff', fg: '#16181d', bd: '#6b7280', btn: '#eef1f6', inp: '#ffffff', link: '#0b4fb3', alertBg: '#7a1f00' }, dark: { bg: '#161b26', fg: '#f1f3f7', bd: '#9aa3b5', btn: '#2a3243', inp: '#0f131b', link: '#9cc4ff', alertBg: '#7a1f00' } };
  function pal() { try { return PAL[root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light']; } catch (e) { return PAL.light; } }
  var force = true;   // implicit, elementele create primesc culori explicite; false doar cât se construiește un panou „bare” (integrat în pagina gazdă, care își pune propriile culori)
  function BTN() { var c = pal(); return 'min-height:44px;min-width:44px;padding:6px 14px;border-radius:8px;border:1px solid ' + c.bd + ';background:' + c.btn + ';color:' + c.fg + ';font:inherit;cursor:pointer;'; }
  function INP() { var c = pal(); return 'min-height:44px;padding:6px 8px;border-radius:6px;border:1px solid ' + c.bd + ';background:' + c.inp + ';color:' + c.fg + ';font:inherit;width:100%;box-sizing:border-box;'; }
  var config = { corner: 'bl', into: null, chip: true, panelInto: null };
  var chipEl = null, dlgEl = null, alertEl = null, panels = [], lastFocus = null;

  function kindKey(c) { return c.kind + '_' + c.type; }
  function eclText(c, tz) {
    var extra = [];
    if (c.kind === 'solar') extra.push(T('eclObsc', { o: nf(c.obsc * 100, 0) }));
    if (c.start != null && c.end != null) extra.push(T('eclSpan', { a: fmtTime(msOfJd(c.start), tz), b: fmtTime(msOfJd(c.end), tz) }));
    if (c.visible === 'part') extra.push(T('eclPartVis'));
    return T('eclLine', { kind: T('kinds')[kindKey(c)] || kindKey(c), date: fmtDate(msOfJd(c.jd), tz, true), t: fmtTime(msOfJd(c.jd), tz), m: nf(c.mag, 2), extra: extra.length ? ' (' + extra.join('; ') + ')' : '' });
  }
  function dirName(az) { return T('dirs')[Math.round(az / 45) % 8]; }

  function buildPanel(box) { var prev = force; force = box.getAttribute('data-bare') !== '1'; try { buildPanel0(box); } finally { force = prev; } }
  function buildPanel0(box) {
    box.textContent = ''; var c = get(), h = el('h3', 'margin:0 0 6px;font-size:1.1em;', T('panelTitle')); h.id = 'fffPlPH' + Math.floor(Math.random() * 1e6); box.setAttribute('aria-labelledby', h.id); box.appendChild(h);
    if (!c) { box.appendChild(el('p', 'margin:0 0 8px;', T('noPlace'))); var b = el('button', BTN(), T('setPlace')); b.type = 'button'; b.addEventListener('click', function () { openDialog(); }); box.appendChild(b); return; }
    var tz = tzOf(c), s;
    try { s = sky(c, now()); } catch (e) { box.appendChild(el('p', '', String(e && e.message || e))); return; }
    box.appendChild(el('p', 'margin:0 0 6px;opacity:.9;', T('forDay', { date: fmtDate(s.date, tz, true), p: placeLabel(c), tz: offsetLabel(s.date, tz) })));
    var ul = el('ul', 'margin:0;padding-left:1.2em;line-height:1.5;'), li = function (t) { var n = el('li', '', t); ul.appendChild(n); return n; };
    li(s.sun.rise != null && s.sun.set != null ? T('sunLine', { r: fmtTime(s.sun.rise, tz), s: fmtTime(s.sun.set, tz) }) : (s.sun.noon === 'up' ? T('sunUp') : T('sunDown')));
    var mp = s.moon.rise.map(function (x) { return T('moonRise', { t: fmtTime(x, tz) }); }).concat(s.moon.set.map(function (x) { return T('moonSet', { t: fmtTime(x, tz) }); }));
    li(T('moonLine', { ph: T('phases')[s.moon.idx], pct: nf(s.moon.illum * 100, 0) }) + ' — ' + (mp.length ? mp.join(', ') : T('moonNone')) + '.');
    var pl = li(T('planetsH') + (s.dark ? '' : ': ' + T('noDark')));
    if (s.dark) {
      if (!s.planets.length) pl.textContent += ': ' + T('planetsNone');
      else { var pu = el('ul', 'margin:2px 0 0;padding-left:1.1em;'); s.planets.forEach(function (p) { pu.appendChild(el('li', '', T('planet', { n: T('pn')[PLANETS.indexOf(p.name)], m: nf(p.mag, 1), t: fmtTime(p.ms, tz), alt: nf(p.alt, 0), dir: dirName(p.az) }))); }); pl.appendChild(pu); }
      if (s.binoc.length) li(T('binoc', { list: s.binoc.map(function (p) { return T('pn')[PLANETS.indexOf(p.name)] + ' (' + nf(p.mag, 1) + ')'; }).join(', ') }));
    }
    var ev = li(s.eclipses.length ? T('eclTomorrow') + ':' : T('eclNone'));
    if (s.eclipses.length) { var eu = el('ul', 'margin:2px 0 0;padding-left:1.1em;'); s.eclipses.forEach(function (e) { eu.appendChild(el('li', '', eclText(e, tz))); }); ev.appendChild(eu); }
    else if (s.next) { var nu = el('div', 'margin-top:2px;'); nu.appendChild(el('strong', '', T('eclNext') + ': ')); nu.appendChild(doc().createTextNode(eclText(s.next, tz))); ev.appendChild(nu); }
    box.appendChild(ul);
    var showEc = s.eclipses.length ? s.eclipses : (s.next ? [s.next] : []);
    if (showEc.some(function (e) { return e.kind === 'solar'; })) box.appendChild(el('p', 'margin:8px 0 0;font-weight:600;', T('safety')));
    if (showEc.length && P.hooks.addToAgenda) {
      var ab = el('button', BTN() + 'margin-top:8px;', T('agenda')); ab.type = 'button';
      ab.addEventListener('click', function () { try { P.hooks.addToAgenda(showEc.map(function (e) { return agendaItem(e, tz, c); })); toastMsg(T('agendaDone')); } catch (x) { toastMsg(T('bad')); } }); box.appendChild(ab);
    }
    journalSection(box, c, tz);
    box.appendChild(el('p', 'margin:8px 0 0;font-size:.85em;opacity:.8;', T('approx')));
  }
  /* jurnalul de teren (FFF.jurnal, Etapa 4): observațiile care coincid cu o eclipsă vizibilă de la coordonatele lor + butonul de adăugare cu titlul eclipsei */
  function journalLinks(list, max) {
    var out = [];
    for (var i = 0; i < list.length && out.length < (max || 5) && i < 40; i++) {
      var e = list[i], t = Date.parse(e.ts); if (!isFinite(t)) continue;
      var j = jdOfMs(t), evs = findEclipses(j - 1.2, j + 1.2);
      for (var k = 0; k < evs.length; k++) { var c = local(evs[k], { lat: e.lat, lon: e.lon, alt: 0 }); if (c.mag > 0 && c.visible !== 'no' && Math.abs((c.jd) - j) <= 0.5) { out.push({ entry: e, ecl: c }); break; } }
    }
    return out;
  }
  function eventDraft(c) {
    var ev = null; try { ev = nextVisible(c, jdOfMs(now()) - 1, 400, 0.02); } catch (e) { /* */ } if (!ev) return {};
    var tz = tzOf(c); return { kind: 'obs', lat: c.lat, lon: c.lon, title: T('jDraft', { kind: T('kinds')[kindKey(ev)], date: fmtDate(msOfJd(ev.jd), tz, false) }) };
  }
  function journalSection(box, c, tz) {
    var J = root.FFF && root.FFF.jurnal; if (!J || !J.load) return;
    var sec = el('div', 'margin-top:10px;border-top:1px solid ' + pal().bd + ';padding-top:8px;'); sec.setAttribute('data-fff-place-journal', '1'); sec.appendChild(el('strong', '', T('jH')));
    var links = []; try { links = journalLinks(J.load(), 5); } catch (e) { links = []; }
    if (!links.length) sec.appendChild(el('p', 'margin:4px 0;', T('jNone')));
    else { var ul = el('ul', 'margin:4px 0;padding-left:1.2em;'); links.forEach(function (x) { ul.appendChild(el('li', '', T('jLine', { title: x.entry.title, kind: T('kinds')[kindKey(x.ecl)], date: fmtDate(msOfJd(x.ecl.jd), tzOf(c), false) }))); }); sec.appendChild(ul);
      if (J.atlasSvg) { var h = el('div', 'max-width:260px;background:#fff;padding:4px;'); h.innerHTML = J.atlasSvg(links.map(function (x) { return x.entry; }), 260, 150); sec.appendChild(h); } }
    var ab = el('button', BTN() + 'margin-top:6px;', T('jAdd')); ab.type = 'button'; ab.id = 'fffPlJAdd';
    ab.addEventListener('click', function () { if (dlgEl) closeDialog(); J.panel({ app: P.hooks.appName || appSlug(), slug: appSlug(), draft: function () { return eventDraft(c); } }); }); sec.appendChild(ab); box.appendChild(sec);
  }
  function agendaItem(e, tz, c) {
    var p = function (ms) { var q = parts(ms, tz), z = function (n) { return (n < 10 ? '0' : '') + n; }; return q.year + '-' + z(q.month) + '-' + z(q.day) + 'T' + z(q.hour === 24 ? 0 : q.hour) + ':' + z(q.minute); };
    var a = msOfJd(e.start != null ? e.start : e.jd), b = msOfJd(e.end != null ? e.end : e.jd + 1 / 24);
    return { kind: 'event', title: (T('kinds')[kindKey(e)] || 'Eclipse') + ' · ' + placeLabel(c), start: p(a), end: p(b), tz: tz, cat: 'sky' };
  }
  function panel(into, o) {
    o = o || {}; var c = pal(), box = el('div', o.bare ? '' : 'border:1px solid ' + c.bd + ';border-radius:10px;padding:12px;margin:8px 0;background:' + c.bg + ';color:' + c.fg + ';'); box.setAttribute('role', 'group'); box.setAttribute('data-fff-place-panel', '1'); if (o.bare) box.setAttribute('data-bare', '1');
    if (into) into.appendChild(box); var rec = { box: box, refresh: function () { buildPanel(box); } }; panels.push(rec); rec.refresh(); return rec;
  }
  function refreshPanels() { panels = panels.filter(function (r) { return r.box.isConnected; }); panels.forEach(function (r) { r.refresh(); }); }

  function toastMsg(t) { var E = root.FFF && root.FFF.envelope; if (E && E.toast) E.toast(t); else { var d = el('div', 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;background:#222;color:#fff;padding:10px 16px;border-radius:8px;font:14px system-ui;max-width:90vw', t); d.setAttribute('role', 'status'); doc().body.appendChild(d); setTimeout(function () { d.remove(); }, 3500); } }

  function updateChip() {
    if (!chipEl) return; var c = get(); chipEl.textContent = '';
    chipEl.appendChild(el('span', '', '📍 ', null)); chipEl.lastChild.setAttribute('aria-hidden', 'true');
    chipEl.appendChild(doc().createTextNode(c ? placeLabel(c) : T('chipSet')));
    chipEl.setAttribute('aria-label', (c ? T('chip') + ': ' + placeLabel(c) + ' (' + tzOf(c) + ')' : T('chipSet')));
    chipEl.title = c ? T('dlg') : T('chipSet');
  }
  function mountChip() {
    if (chipEl || !config.chip) return;
    var css = 'z-index:2147482000;max-width:min(70vw,260px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:0 2px 10px #0005;', cor = config.corner;
    chipEl = el('button', BTN() + css + (config.into ? '' : 'position:fixed;' + (cor[0] === 't' ? 'top:8px;' : 'bottom:8px;') + (cor[1] === 'r' ? 'right:8px;' : 'left:8px;')));
    chipEl.type = 'button'; chipEl.id = 'fffPlaceChip'; chipEl.setAttribute('aria-haspopup', 'dialog');
    chipEl.addEventListener('click', function () { openDialog(); });
    (config.into || doc().body).appendChild(chipEl); updateChip();
  }

  function field(parent, id, label, val, attrs) {
    var w = el('div', 'margin:0 0 8px;'), l = el('label', 'display:block;font-size:.9em;margin-bottom:2px;', label); l.setAttribute('for', id);
    var i = el('input', INP()); i.id = id; i.value = val == null ? '' : val; if (attrs) for (var k in attrs) i.setAttribute(k, attrs[k]); w.appendChild(l); w.appendChild(i); parent.appendChild(w); return i;
  }
  function closeDialog() { if (!dlgEl) return; dlgEl.remove(); dlgEl = null; try { (lastFocus || chipEl) && (lastFocus || chipEl).focus(); } catch (e) { /* */ } }
  function openDialog() {
    if (dlgEl) return; lastFocus = doc().activeElement; var c = get();
    var ov = el('div', 'position:fixed;inset:0;z-index:2147482900;background:#0008;display:flex;align-items:center;justify-content:center;padding:8px;');
    var pc = pal(), box = el('div', 'background:' + pc.bg + ';color:' + pc.fg + ';border-radius:12px;padding:16px;width:min(560px,100%);max-height:92vh;overflow:auto;box-sizing:border-box;font:15px/1.45 system-ui,sans-serif;box-shadow:0 8px 40px #000a;');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'fffPlTitle'); box.id = 'fffPlaceDlg';
    var h = el('h2', 'margin:0 0 6px;font-size:1.25em;', T('dlg')); h.id = 'fffPlTitle'; h.tabIndex = -1; box.appendChild(h); box.appendChild(el('p', 'margin:0 0 10px;', T('intro')));
    var msg = el('p', 'min-height:1.4em;margin:0 0 8px;font-weight:600;'); msg.setAttribute('role', 'status'); msg.id = 'fffPlMsg';
    var iName = field(box, 'fffPlName', T('fName'), c ? c.name : '', { maxlength: '80', autocomplete: 'off' });
    var iLat = field(box, 'fffPlLat', T('fLat'), c ? c.lat : '', { inputmode: 'decimal', autocomplete: 'off' });
    var iLon = field(box, 'fffPlLon', T('fLon'), c ? c.lon : '', { inputmode: 'decimal', autocomplete: 'off' });
    var iTz = field(box, 'fffPlTz', T('fTz'), c ? c.tz : deviceTz(), { list: 'fffPlTzList', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    var dl = el('datalist'); dl.id = 'fffPlTzList'; var zones = []; try { zones = Intl.supportedValuesOf('timeZone'); } catch (e) { zones = CITIES.map(function (x) { return x[3]; }); } zones.forEach(function (z) { var o = el('option'); o.value = z; dl.appendChild(o); }); box.appendChild(dl);
    var cw = el('div', 'margin:0 0 8px;'), cl = el('label', 'display:block;font-size:.9em;margin-bottom:2px;', T('city')); cl.setAttribute('for', 'fffPlCity'); var cs = el('select', INP()); cs.id = 'fffPlCity';
    var o0 = el('option', '', T('cityNone')); o0.value = ''; cs.appendChild(o0); CITIES.forEach(function (x, i) { var o = el('option', '', x[0]); o.value = String(i); cs.appendChild(o); }); cw.appendChild(cl); cw.appendChild(cs); box.appendChild(cw);
    cs.addEventListener('change', function () { var x = CITIES[+cs.value]; if (x) { iName.value = x[0]; iLat.value = x[1]; iLon.value = x[2]; iTz.value = x[3]; } });
    var row = el('div', 'display:flex;gap:8px;flex-wrap:wrap;margin:0 0 8px;');
    var save = el('button', BTN() + 'font-weight:600;', T('apply')); save.type = 'button'; save.id = 'fffPlSave';
    save.addEventListener('click', function () {
      var tz = iTz.value.trim(); if (tz && !validTz(tz)) { msg.textContent = T('errTz'); iTz.focus(); return; }
      var x = CITIES[+cs.value], r = set({ lat: iLat.value, lon: iLon.value, name: iName.value, tz: tz || deviceTz(), alt: c && c.lat === num(iLat.value) && c.lon === num(iLon.value) ? c.alt : 0 }, cs.value && x && x[1] === num(iLat.value) ? 'city' : 'manual');
      if (!r) { msg.textContent = T('errCoords'); iLat.focus(); return; } msg.textContent = T('saved', { p: placeLabel(r) }); rebuild();
    });
    var clr = el('button', BTN(), T('clear')); clr.type = 'button'; clr.id = 'fffPlClear'; clr.addEventListener('click', function () { clear(); msg.textContent = T('cleared'); rebuild(); });
    row.appendChild(save); row.appendChild(clr); box.appendChild(row);
    /* geolocalizare: doar la cerere, cu acord explicit în aplicație (în plus față de cererea browserului) */
    var gw = el('div', 'margin:0 0 8px;'), gb = el('button', BTN(), T('geo')); gb.type = 'button'; gb.id = 'fffPlGeo'; gw.appendChild(gb); box.appendChild(gw);
    gb.addEventListener('click', function () {
      gw.textContent = ''; var q = el('p', 'margin:0 0 6px;', T('geoAsk')); q.id = 'fffPlGeoAsk'; gw.appendChild(q);
      var y = el('button', BTN() + 'margin-right:8px;', T('geoYes')); y.type = 'button'; y.id = 'fffPlGeoYes'; var n = el('button', BTN(), T('geoNo')); n.type = 'button'; n.id = 'fffPlGeoNo';
      n.addEventListener('click', function () { rebuild(); }); y.addEventListener('click', function () { msg.textContent = T('geoWait'); locate(function (err, r) { if (err) msg.textContent = T(err); else { msg.textContent = T('saved', { p: placeLabel(r) }); rebuild(); } }); gw.textContent = ''; });
      gw.appendChild(y); gw.appendChild(n); y.focus();
    });
    box.appendChild(msg);
    /* alertă */
    var aw = el('div', 'margin:0 0 10px;'), al = el('label', 'display:block;font-size:.9em;margin-bottom:2px;', T('alertLabel')); al.setAttribute('for', 'fffPlAlert'); var asel = el('select', INP()); asel.id = 'fffPlAlert';
    [[0, T('alertOff')], [1, T('alertDay')], [7, T('alertDays', { n: 7 })], [30, T('alertDays', { n: 30 })]].forEach(function (x) { var o = el('option', '', x[1]); o.value = String(x[0]); asel.appendChild(o); }); asel.value = String(opts().alertDays);
    asel.addEventListener('change', function () { setOpts({ alertDays: +asel.value }); }); aw.appendChild(al); aw.appendChild(asel); box.appendChild(aw);
    /* partajare */
    var sh = el('div', 'border-top:1px solid ' + pc.bd + ';padding-top:10px;margin-top:6px;'); sh.setAttribute('role', 'group'); sh.setAttribute('aria-labelledby', 'fffPlShH'); var shh = el('h3', 'margin:0 0 4px;font-size:1.05em;', T('share')); shh.id = 'fffPlShH'; sh.appendChild(shh); sh.appendChild(el('p', 'margin:0 0 8px;font-size:.92em;', T('shareNote')));
    var list = el('ul', 'list-style:none;margin:0 0 8px;padding:0;display:flex;flex-wrap:wrap;gap:6px;'); list.id = 'fffPlLinks'; sh.appendChild(list);
    var srow = el('div', 'display:flex;gap:8px;flex-wrap:wrap;');
    var sb = el('button', BTN(), T('send')); sb.type = 'button'; sb.id = 'fffPlSend'; sb.disabled = !c; sb.addEventListener('click', function () { sendMenu(sb); }); srow.appendChild(sb);
    var E = root.FFF && root.FFF.envelope; if (E && E.importButton) { var rb = E.importButton({ accepts: ['place/fff'], onReceive: function (env) { var r = accept(env); setTimeout(rebuild, 0); return r; }, text: T('recv'), style: BTN() }); rb.id = 'fffPlRecv'; srow.appendChild(rb); }
    sh.appendChild(srow); var qrBox = el('div', 'margin-top:8px;max-width:260px;'); qrBox.id = 'fffPlQr'; sh.appendChild(qrBox); box.appendChild(sh);
    fillLinks(list, c);
    /* panou */
    var pw = el('div', 'margin-top:10px;'); box.appendChild(pw); panel(pw);
    var cb = el('button', BTN() + 'margin-top:10px;', T('close')); cb.type = 'button'; cb.id = 'fffPlClose'; cb.addEventListener('click', closeDialog); box.appendChild(cb);
    ov.appendChild(box); doc().body.appendChild(ov); dlgEl = ov;
    ov.addEventListener('mousedown', function (ev) { if (ev.target === ov) closeDialog(); });
    ov.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); closeDialog(); return; }
      if (ev.key === 'Tab') { var f = Array.prototype.slice.call(box.querySelectorAll('button:not([disabled]),input,select,a[href]')).filter(function (n) { return n.offsetParent !== null || n === doc().activeElement; }); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (ev.shiftKey && doc().activeElement === a) { ev.preventDefault(); z.focus(); } else if (!ev.shiftKey && doc().activeElement === z) { ev.preventDefault(); a.focus(); } }
    });
    function rebuild() { if (!dlgEl) return; dlgEl.remove(); dlgEl = null; openDialog(); var n = doc().getElementById('fffPlMsg'); if (n && msg.textContent) n.textContent = msg.textContent; }
    try { h.focus(); } catch (e) { /* */ }
  }
  function fillLinks(list, c) {
    list.textContent = ''; var me = appSlug();
    APPS.filter(function (a) { return a.slug !== me; }).forEach(function (a) {
      var li = el('li', ''), an = el('a', 'display:inline-flex;align-items:center;min-height:44px;padding:6px 10px;border:1px solid ' + pal().bd + ';border-radius:8px;color:' + pal().link + ';text-decoration:underline;', T('open', { app: a.name }));
      an.target = '_blank'; an.rel = 'noopener'; an.href = a.url; an.setAttribute('data-app', a.slug); li.appendChild(an); list.appendChild(li);
      if (c) linkFor(a).then(function (u) { if (u) an.href = u; });
    });
  }
  function sendMenu(anchor) {
    var E = root.FFF && root.FFF.envelope, env = envelope(); if (!E || !env) return;
    var items = [{ text: T('file'), run: function () { E.download(env); } }, { text: T('copy'), run: function () { E.toClipboard(env).then(function () { toastMsg(T('copied')); }, function () { toastMsg(T('bad')); }); } }];
    if (root.FFF && root.FFF.qr) items.push({ text: T('qr'), run: function () { E.toQR(env).then(function (q) { var b = doc().getElementById('fffPlQr'); if (!b) return; b.textContent = ''; b.style.background = '#fff'; b.style.padding = '8px'; var h = el('div'); h.innerHTML = q.svg; var sv = h.querySelector('svg'); if (sv) { sv.style.width = '100%'; sv.style.height = 'auto'; sv.setAttribute('role', 'img'); sv.setAttribute('aria-label', T('qr')); b.appendChild(sv); } }, function () { toastMsg(T('bad')); }); } });
    E.menu(anchor, items);
  }
  function locate(cb) {
    var nav = root.navigator; if (!nav || !nav.geolocation) { cb('geoNone'); return; }
    nav.geolocation.getCurrentPosition(function (pos) {
      var c = pos.coords, r = set({ lat: Math.round(c.latitude * 1e3) / 1e3, lon: Math.round(c.longitude * 1e3) / 1e3, alt: c.altitude != null && isFinite(c.altitude) ? c.altitude : 0, name: T('geoName'), tz: deviceTz() }, 'geo'); cb(r ? null : 'geoFail', r);
    }, function (err) { cb(err && err.code === 1 ? 'geoDenied' : 'geoFail'); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  }

  /* ---------- alertă la eclipsă ---------- */
  function dismissed() { var s = store(), o = {}; try { o = JSON.parse(s.getItem(DISM)) || {}; } catch (e) { /* */ } return o; }
  function renderAlert() {
    if (alertEl) { alertEl.remove(); alertEl = null; } var c = get(), od = opts().alertDays; if (!c || !od || !doc() || !doc().body) return;
    var n = now(), j = jdOfMs(n), ev;
    try { ev = nextVisible(c, j - 0.25, od + 1.5, 0.02); } catch (e) { return; }
    if (!ev || (ev.kind === 'lunar' && ev.type === 'penumbral')) return;
    var a = msOfJd(ev.start != null ? ev.start : ev.jd), z = msOfJd(ev.end != null ? ev.end : ev.jd), tz = tzOf(c);
    if (z < n || a - n > od * 86400000) return;
    var id = ev.kind + ':' + Math.round(ev.jd * 24), d = dismissed(); if (d[id]) return;
    var p0 = parts(n, tz), p1 = parts(msOfJd(ev.jd), tz), days = Math.round((Date.UTC(p1.year, p1.month - 1, p1.day) - Date.UTC(p0.year, p0.month - 1, p0.day)) / 86400000);
    var when = days <= 0 ? T('whenToday') : (days === 1 ? T('whenTomorrow') : T('whenDays', { n: days }));
    var bar = el('div', 'position:fixed;top:0;left:0;right:0;z-index:2147482950;background:#7a1f00;color:#fff;padding:8px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font:15px/1.4 system-ui,sans-serif;box-shadow:0 2px 10px #0008;');
    bar.setAttribute('role', 'alert'); bar.id = 'fffPlaceAlert';
    var tx = el('div', 'flex:1 1 260px;color:#fff;'); tx.appendChild(el('strong', 'color:#fff;', '⚠ ' + T('alertText', { kind: T('kinds')[kindKey(ev)], when: when, t: fmtTime(msOfJd(ev.jd), tz), p: placeLabel(c) })));
    if (ev.kind === 'solar') tx.appendChild(el('div', 'font-size:.9em;color:#fff;', T('safety'))); bar.appendChild(tx);
    var op = el('button', BTN() + 'background:#fff;color:#7a1f00;border-color:#fff;', T('panelTitle')); op.type = 'button'; op.addEventListener('click', function () { openDialog(); }); bar.appendChild(op);
    var x = el('button', BTN() + 'background:transparent;color:#fff;border-color:#fff;', T('dismiss')); x.type = 'button'; x.addEventListener('click', function () { var s = store(), o = dismissed(); o[id] = 1; try { if (s) s.setItem(DISM, JSON.stringify(o)); } catch (e) { /* */ } bar.remove(); alertEl = null; }); bar.appendChild(x);
    doc().body.insertBefore(bar, doc().body.firstChild); alertEl = bar;
  }

  /* ---------- pornire ---------- */
  function configure(o) { if (o) for (var k in o) config[k] = o[k]; if (chipEl && (o.corner || o.into)) { chipEl.remove(); chipEl = null; mountChip(); } return config; }
  function whenReady(f) { if (doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', f); else f(); }
  function autostart() {
    if (autostart.done) return; autostart.done = true; startSync(); fromHashOnce(); cur = readStore();
    whenReady(function () {
      mountChip(); handlePending(); renderAlert();
      onChange(function () { updateChip(); refreshPanels(); renderAlert(); }, false);
      try { new root.MutationObserver(function () { updateChip(); refreshPanels(); if (dlgEl) { var o = dlgEl; closeDialog(); openDialog(); void o; } }).observe(doc().documentElement, { attributes: true, attributeFilter: ['lang'] }); } catch (e) { /* */ }
      try { root.setInterval(function () { renderAlert(); refreshPanels(); }, 600000); } catch (e) { /* */ }
    });
  }
  var P = { VERSION: 1, journalLinks: journalLinks, eventDraft: eventDraft, KEY: KEY, autostart: autostart, get: get, set: set, clear: clear, onChange: onChange, envelope: envelope, accept: accept, linkFor: linkFor, panel: panel, openDialog: openDialog, closeDialog: closeDialog, configure: configure, locate: locate,
    options: opts, setOptions: setOpts, apps: function () { return APPS; }, setApps: function (a) { APPS = a; }, hooks: {}, CITIES: CITIES, I18N: I18N, T: T, tzOf: tzOf, setNow: function (ms) { nowOverride = ms; refreshPanels(); renderAlert(); }, refresh: function () { refreshPanels(); renderAlert(); updateChip(); },
    engine: { sunGeo: sunGeo, moonGeo: moonGeo, planet: planet, topo: topo, gast: gast, moonPhase: moonPhase, crossings: crossings, findEclipses: findEclipses, local: local, nextVisible: nextVisible, sky: sky, sunAlt: sunAlt, moonAlt: moonAlt, PLANETS: PLANETS },
    jdOfMs: jdOfMs, msOfJd: msOfJd, validTz: validTz, deviceTz: deviceTz, tzOffsetMs: tzOffsetMs, offsetLabel: offsetLabel, localMidnight: localMidnight, norm: norm, _fromHash: function () { return pending; } };
  return P;
});
