/* FFF.ephem — efemeride astronomice locale (fără rețea, fără dependențe). Depinde doar de FFF.core (FFF.t, opțional).
   Soare, Lună, planete (Mercur … Neptun, Pluto opțional), timp (JD, ΔT, timp sideral), nutație, coordonate,
   răsărit/apus/trecere, crepuscule, faze lunare, mărimi aparente, elongații și eclipsa totală de Soare din 2 august 2027.

   Algoritmi (referințe):
   - VSOP87D truncat (Bretagnon & Francou 1988), serii heliocentrice sferice, echinocțiul datei; vezi @@VSOPINFO@@
   - Luna: ELP/MPP02 (Chapront & Francou 2002; succesorul ELP-2000/82, ajustat pe DE405) truncat: @@ELPINFO@@; rezervă/verificare: Meeus cap. 47 (60+60 termeni)
   - Pluto: Meeus cap. 37 (43 termeni, 1885–2099)
   - Nutație: IAU 1980 (63 termeni, Meeus tabelul 22.A); oblicitate medie: IAU 2006
   - ΔT: tabel anual IERS 1973–2027 (valori obținute din UT1−UTC publicat) + polinoamele Espenak–Meeus (2004) în rest
   - Eclipsa: elemente Besselian calculate direct din efemeridele de mai sus (fără polinoame), contacte prin rezolvare numerică
   Unități publice: unghiuri în GRADE (longitudine geografică pozitivă spre EST, azimut de la NORD spre EST), distanțe în UA (sau km unde e scris),
   `jd` = zi iuliană pe scara UT (UT1≈UTC); ΔT se aplică intern. Rezultatele sunt „aparente” (nutație, aberație, timp-lumină) în echinocțiul adevărat al datei.
   Precizie și limite: vezi docs/ephem.md. NU e potrivit pentru navigație, astrofotografie de precizie sau seturi legale de timp. */
(function () {
  'use strict';
  var F = (window.FFF = window.FFF || {});
  var PI = Math.PI, TAU = 2 * PI, D2R = PI / 180, R2D = 180 / PI, AS2R = D2R / 3600;
  var sin = Math.sin, cos = Math.cos, tan = Math.tan, asin = Math.asin, acos = Math.acos, atan2 = Math.atan2, sqrt = Math.sqrt, abs = Math.abs, floor = Math.floor;
  var AU = 149597870.7, CLIGHT = 299792.458, RE = 6378.137, FLAT = 1 / 298.257223563, J2000 = 2451545.0;
  var LIGHT_DAY = AU / CLIGHT / 86400; // 0,0057755183 zile pe UA

  /* ================= DATE (generate de tools/gen-ephem.mjs) ================= */
  //@@DATA@@
  /* ================= /DATE ================= */

  function mod(x, m) { x = x % m; return x < 0 ? x + m : x; }
  function wrap180(x) { x = mod(x, 360); return x > 180 ? x - 360 : x; }
  function T(mod_, key, vars) { try { return F.t ? F.t(mod_, key, vars) : key; } catch (e) { return key; } }

  /* ---------------- Timp ---------------- */
  function jdFromCalendar(y, mo, d, h, mi, s) {
    h = h || 0; mi = mi || 0; s = s || 0;
    if (mo <= 2) { y -= 1; mo += 12; }
    var a = floor(y / 100), b = 0;
    var greg = (y > 1582) || (y === 1582 && (mo > 10 || (mo === 10 && d >= 15)));
    if (greg) b = 2 - a + floor(a / 4);
    return floor(365.25 * (y + 4716)) + floor(30.6001 * (mo + 1)) + d + b - 1524.5 + (h + (mi + s / 60) / 60) / 24;
  }
  function calendarFromJd(jd) {
    var j = jd + 0.5, z = floor(j), f = j - z, a = z;
    if (z >= 2299161) { var al = floor((z - 1867216.25) / 36524.25); a = z + 1 + al - floor(al / 4); }
    var b = a + 1524, c = floor((b - 122.1) / 365.25), d = floor(365.25 * c), e = floor((b - d) / 30.6001);
    var day = b - d - floor(30.6001 * e), mo = e < 14 ? e - 1 : e - 13, y = mo > 2 ? c - 4716 : c - 4715;
    var sec = f * 86400, h = floor(sec / 3600); sec -= h * 3600; var mi = floor(sec / 60); sec -= mi * 60;
    return {y: y, mo: mo, d: day, h: h, mi: mi, s: sec};
  }
  function jdFromDate(x) {
    if (x instanceof Date) return x.getTime() / 86400000 + 2440587.5;
    if (typeof x === 'number') return x > 1e7 ? x / 86400000 + 2440587.5 : x;   // ms de la epocă sau JD
    if (Array.isArray(x)) return jdFromCalendar(x[0], x[1], x[2], x[3], x[4], x[5]);
    if (x && typeof x === 'object') return jdFromCalendar(x.y, x.mo || x.m || 1, x.d || 1, x.h, x.mi, x.s);
    throw new Error('FFF.ephem.jdFromDate: argument neacceptat');
  }
  function dateFromJd(jd) { return new Date(Math.round((jd - 2440587.5) * 86400000)); }

  var dtCustom = null;
  function dtPoly(y) {   // Espenak & Meeus (2004), secunde
    var u, t;
    if (y < -500) { u = (y - 1820) / 100; return -20 + 32 * u * u; }
    if (y < 500) { u = y / 100; return 10583.6 + u * (-1014.41 + u * (33.78311 + u * (-5.952053 + u * (-0.1798452 + u * (0.022174192 + u * 0.0090316521))))); }
    if (y < 1600) { u = (y - 1000) / 100; return 1574.2 + u * (-556.01 + u * (71.23472 + u * (0.319781 + u * (-0.8503463 + u * (-0.005050998 + u * 0.0083572073))))); }
    if (y < 1700) { t = y - 1600; return 120 + t * (-0.9808 + t * (-0.01532 + t / 7129)); }
    if (y < 1800) { t = y - 1700; return 8.83 + t * (0.1603 + t * (-0.0059285 + t * (0.00013336 - t / 1174000))); }
    if (y < 1860) { t = y - 1800; return 13.72 + t * (-0.332447 + t * (0.0068612 + t * (0.0041116 + t * (-0.00037436 + t * (0.0000121272 + t * (-0.0000001699 + t * 0.000000000875)))))); }
    if (y < 1900) { t = y - 1860; return 7.62 + t * (0.5737 + t * (-0.251754 + t * (0.01680668 + t * (-0.0004473624 + t / 233174)))); }
    if (y < 1920) { t = y - 1900; return -2.79 + t * (1.494119 + t * (-0.0598939 + t * (0.0061966 - t * 0.000197))); }
    if (y < 1941) { t = y - 1920; return 21.20 + t * (0.84493 + t * (-0.076100 + t * 0.0020936)); }
    if (y < 1961) { t = y - 1950; return 29.07 + t * (0.407 + t * (-1 / 233 + t / 2547)); }
    if (y < 1986) { t = y - 1975; return 45.45 + t * (1.067 + t * (-1 / 260 - t / 718)); }
    if (y < 2005) { t = y - 2000; return 63.86 + t * (0.3345 + t * (-0.060374 + t * (0.0017275 + t * (0.000651814 + t * 0.00002373599)))); }
    if (y < 2050) { t = y - 2000; return 62.92 + t * (0.32217 + t * 0.005589); }
    if (y < 2150) { u = (y - 1820) / 100; return -20 + 32 * u * u - 0.5628 * (2150 - y); }
    u = (y - 1820) / 100; return -20 + 32 * u * u;
  }
  function deltaT(jd) {   // secunde; jd pe scara UT (diferența UT/TT e neglijabilă aici)
    if (dtCustom != null) return typeof dtCustom === 'function' ? dtCustom(jd) : dtCustom;
    var y = 2000 + (jd - J2000) / 365.25;
    var y0 = DT_START, n = DT_OBS.length, yl = y0 + n - 1;
    if (y >= y0 && y <= yl) {
      var i = floor(y - y0), f = y - y0 - i;
      if (i >= n - 1) return DT_OBS[n - 1];
      return DT_OBS[i] + (DT_OBS[i + 1] - DT_OBS[i]) * f;
    }
    if (y > yl) {   // extrapolare: polinomul, cu decalajul din ultimul punct observat/prezis, atenuat exponențial (e-fold 50 ani)
      var off = DT_OBS[n - 1] - dtPoly(yl);
      return dtPoly(y) + off * Math.exp(-(y - yl) / 50);
    }
    return dtPoly(y);
  }
  function setDeltaT(v) { dtCustom = (v == null) ? null : v; }
  function ttFromUt(jd) { return jd + deltaT(jd) / 86400; }
  function utFromTt(tt) { var u = tt - deltaT(tt) / 86400; return tt - deltaT(u) / 86400; }

  /* ---------------- Oblicitate, nutație, timp sideral ---------------- */
  function meanObliquity(tt) {   // radiani, IAU 2006
    var t = (tt - J2000) / 36525;
    return (84381.406 + t * (-46.836769 + t * (-0.0001831 + t * (0.00200340 + t * (-5.76e-7 + t * -4.34e-8))))) * AS2R;
  }
  function nutation(tt) {   // {dpsi, deps} radiani
    var t = (tt - J2000) / 36525;
    var D = (297.85036 + t * (445267.111480 + t * (-0.0019142 + t / 189474))) * D2R;
    var M = (357.52772 + t * (35999.050340 + t * (-0.0001603 - t / 300000))) * D2R;
    var N = (134.96298 + t * (477198.867398 + t * (0.0086972 + t / 56250))) * D2R;
    var Fa = (93.27191 + t * (483202.017538 + t * (-0.0036825 + t / 327270))) * D2R;
    var O = (125.04452 + t * (-1934.136261 + t * (0.0020708 + t / 450000))) * D2R;
    var dp = 0, de = 0;
    for (var i = NUT.length - 1; i >= 0; i--) {
      var r = NUT[i], a = r[0] * D + r[1] * M + r[2] * N + r[3] * Fa + r[4] * O;
      dp += sin(a) * (r[5] + r[6] * t); de += cos(a) * (r[7] + r[8] * t);
    }
    return {dpsi: dp * 1e-4 * AS2R, deps: de * 1e-4 * AS2R};
  }
  function gmst(jdUT) {   // grade, [0,360)
    var t = (jdUT - J2000) / 36525;
    return mod(280.46061837 + 360.98564736629 * (jdUT - J2000) + t * t * (0.000387933 - t / 38710000), 360);
  }
  function gast(jdUT) {   // grade
    var tt = ttFromUt(jdUT), n = nutation(tt), eps = meanObliquity(tt) + n.deps;
    return mod(gmst(jdUT) + n.dpsi * cos(eps) * R2D, 360);
  }
  function sidereal(jd, lon, opts) {   // timp sideral local (grade); lon spre est; opts.mean=true pentru mediu
    var g = (opts && opts.mean) ? gmst(jd) : gast(jd);
    return mod(g + (lon || 0), 360);
  }

  /* ---------------- VSOP87 ---------------- */
  var vsCache = {};
  function vsLoad(name) {
    if (vsCache[name]) return vsCache[name];
    var src = VS[name], out = {};
    ['L', 'B', 'R'].forEach(function (k) {
      out[k] = src[k].map(function (s) {
        if (!s) return new Float64Array(0);
        var parts = s.split(';'), a = new Float64Array(parts.length * 3);
        for (var i = 0; i < parts.length; i++) { var q = parts[i].split(','); a[3 * i] = +q[0]; a[3 * i + 1] = +q[1]; a[3 * i + 2] = +q[2]; }
        return a;
      });
    });
    return (vsCache[name] = out);
  }
  function vsEval(name, tt) {   // heliocentric sferic [L,B,R] (rad, rad, UA), echinocțiul mediu al datei
    var d = vsLoad(name), t = (tt - J2000) / 365250, res = [0, 0, 0], ks = ['L', 'B', 'R'];
    for (var k = 0; k < 3; k++) {
      var ser = d[ks[k]], tp = 1, s = 0;
      for (var p = 0; p < ser.length; p++) {
        var a = ser[p], sp = 0;
        for (var i = 0; i < a.length; i += 3) sp += a[i] * cos(a[i + 1] + a[i + 2] * t);
        s += sp * tp; tp *= t;
      }
      res[k] = s;
    }
    res[0] = mod(res[0], TAU);
    return res;
  }
  function sph2xyz(L, B, R) { var cb = cos(B); return [R * cb * cos(L), R * cb * sin(L), R * sin(B)]; }

  /* ---------------- Precesiune (J2000 ↔ data), echinocțiu mediu ---------------- */
  function precessMatrix(tt) {   // J2000 → data (ecuatorial mediu), Meeus 21 / Lieske 1977
    var t = (tt - J2000) / 36525;
    var zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * AS2R;
    var z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * AS2R;
    var th = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * AS2R;
    var cz = cos(zeta), sz = sin(zeta), cZ = cos(z), sZ = sin(z), ct = cos(th), st = sin(th);
    return [[cZ * ct * cz - sZ * sz, -cZ * ct * sz - sZ * cz, -cZ * st],
            [sZ * ct * cz + cZ * sz, -sZ * ct * sz + cZ * cz, -sZ * st],
            [st * cz, -st * sz, ct]];
  }
  function mulv(m, v) { return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]]; }
  function tmulv(m, v) { return [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]]; }
  function ecl2equ(v, eps) { var c = cos(eps), s = sin(eps); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; }
  function equ2ecl(v, eps) { var c = cos(eps), s = sin(eps); return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c]; }
  function lonlat(v) { return [mod(atan2(v[1], v[0]), TAU), atan2(v[2], sqrt(v[0] * v[0] + v[1] * v[1]))]; }
  function norm(v) { return sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }

  /* ---------------- Pământ, Soare ---------------- */
  var EPS2000 = 84381.406 * AS2R;
  function earthXYZ(tt) { var e = vsEval('earth', tt); return sph2xyz(e[0], e[1], e[2]); }   // heliocentric, ecliptica datei
  function earthVel(tt) { var dt = 0.02, a = earthXYZ(tt), b = earthXYZ(tt - dt); return [(a[0] - b[0]) / dt, (a[1] - b[1]) / dt, (a[2] - b[2]) / dt]; } // UA/zi (în urmă; corecție mediană aplicată mai jos)
  function aberrate(u, v) {   // aberație relativistă (SOFA ab, fără termenul gravitațional); u unitate, v viteza Pământului (UA/zi)
    var k = 1 / (CLIGHT * 86400 / AU), vc = [v[0] * k, v[1] * k, v[2] * k];
    var udv = u[0] * vc[0] + u[1] * vc[1] + u[2] * vc[2], b2 = vc[0] * vc[0] + vc[1] * vc[1] + vc[2] * vc[2], g = sqrt(1 - b2), w = 1 + udv / (1 + g), den = 1 + udv;
    return [(g * u[0] + w * vc[0]) / den, (g * u[1] + w * vc[1]) / den, (g * u[2] + w * vc[2]) / den];
  }
  function toEqTrue(lon, lat, eps) {   // ecliptic (lon,lat,rad) → ecuatorial (ra,dec rad)
    var v = sph2xyz(lon, lat, 1), q = ecl2equ(v, eps), ll = lonlat(q);
    return {ra: ll[0], dec: ll[1]};
  }
  function bodyOut(name, lon, lat, dist, tt, eps) {
    var q = toEqTrue(lon, lat, eps);
    return {name: name, lon: lon * R2D, lat: lat * R2D, ra: q.ra * R2D, dec: q.dec * R2D, dist: dist, distKm: dist * AU,
            _lon: lon, _lat: lat, _ra: q.ra, _dec: q.dec, eps: eps * R2D};
  }

  function sunTT(tt) {
    var e = earthXYZ(tt), r = norm(e), u = [-e[0] / r, -e[1] / r, -e[2] / r];
    // aberație: viteza Pământului în punctul tt (diferență centrată prin tt-δ/2 → corecție de ordin 2 neglijabilă)
    var v = earthVel(tt + 0.01);   // diferență între tt-0.01 și tt+0.01, centrată pe tt
    var up = aberrate(u, v), nu = nutation(tt), eps = meanObliquity(tt) + nu.deps;
    var ll = lonlat(up), lon = mod(ll[0] + nu.dpsi, TAU);
    var o = bodyOut('sun', lon, ll[1], r, tt, eps);
    o.sd = asin(696000 / (r * AU)) * R2D * 3600;   // semi-diametru, secunde de arc
    o.mag = -26.74 + 5 * Math.log10(r);
    return o;
  }
  function sun(jd) { return sunTT(ttFromUt(jd)); }

  /* ---------------- Lună (Meeus 47) ---------------- */
  var elpCache = null;
  function elpLoad() {
    if (elpCache) return elpCache;
    var out = {};
    ['L', 'B', 'R'].forEach(function (k) {
      out[k] = ELP[k].map(function (s) {
        if (!s) return new Float64Array(0);
        var parts = s.split(';'), a = new Float64Array(parts.length * 4);
        for (var i = 0; i < parts.length; i++) { var q = parts[i].split(','); a[4 * i] = +q[0]; a[4 * i + 1] = +q[1]; a[4 * i + 2] = +q[2]; a[4 * i + 3] = +q[3]; }
        return a;
      });
    });
    return (elpCache = out);
  }
  function elpSum(ser, t) {
    var tot = 0, tp = 1;
    for (var p = 0; p < ser.length; p++) {
      var a = ser[p], s = 0;
      for (var i = 0; i < a.length; i += 4) s += a[i] * sin(a[i + 1] + t * (a[i + 2] + t * a[i + 3]));
      tot += s * tp; tp *= t;
    }
    return tot;
  }
  function moonGeo(tt) {   // geometric, ecliptica și echinocțiul mediu ale datei: {lon,lat (rad), dist (km)} — ELP/MPP02 truncat
    var t = (tt - J2000) / 36525, d = elpLoad();
    var w = ELP.W1[0] + t * (ELP.W1[1] + t * (ELP.W1[2] + t * ELP.W1[3]));
    var pa = t * (5029.0966 - 0.29965 + t * (1.1120 + t * (0.000077 - t * 0.00002353))) * AS2R;   // precesia generală în longitudine
    return {lon: mod(w + elpSum(d.L, t) * AS2R + pa, TAU), lat: elpSum(d.B, t) * AS2R, dist: elpSum(d.R, t)};
  }
  function moonGeoMeeus(tt) {   // Meeus cap. 47 (ELP-2000/82 truncat; ~10″) — rămâne pentru verificări încrucișate
    var t = (tt - J2000) / 36525;
    var Lp = mod(218.3164477 + t * (481267.88123421 + t * (-0.0015786 + t * (1 / 538841 - t / 65194000))), 360) * D2R;
    var D = mod(297.8501921 + t * (445267.1114034 + t * (-0.0018819 + t * (1 / 545868 - t / 113065000))), 360) * D2R;
    var M = mod(357.5291092 + t * (35999.0502909 + t * (-0.0001536 + t / 24490000)), 360) * D2R;
    var Mp = mod(134.9633964 + t * (477198.8675055 + t * (0.0087414 + t * (1 / 69699 - t / 14712000))), 360) * D2R;
    var Fa = mod(93.2720950 + t * (483202.0175233 + t * (-0.0036539 + t * (-1 / 3526000 + t / 863310000))), 360) * D2R;
    var A1 = (119.75 + 131.849 * t) * D2R, A2 = (53.09 + 479264.290 * t) * D2R, A3 = (313.45 + 481266.484 * t) * D2R;
    var E = 1 - 0.002516 * t - 0.0000074 * t * t, E2 = E * E;
    var sl = 3958 * sin(A1) + 1962 * sin(Lp - Fa) + 318 * sin(A2), sr = 0;
    var sb = -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - Fa) + 175 * sin(A1 + Fa) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp), i, r, a, e;
    for (i = 0; i < MOON_A.length; i++) {
      r = MOON_A[i]; a = r[0] * D + r[1] * M + r[2] * Mp + r[3] * Fa;
      e = r[1] === 0 ? 1 : (abs(r[1]) === 1 ? E : E2);
      sl += r[4] * e * sin(a); sr += r[5] * e * cos(a);
    }
    for (i = 0; i < MOON_B.length; i++) {
      r = MOON_B[i]; a = r[0] * D + r[1] * M + r[2] * Mp + r[3] * Fa;
      e = r[1] === 0 ? 1 : (abs(r[1]) === 1 ? E : E2);
      sb += r[4] * e * sin(a);
    }
    return {lon: mod(Lp + sl * 1e-6 * D2R, TAU), lat: sb * 1e-6 * D2R, dist: 385000.56 + sr / 1000};
  }
  function moonTT(tt) {
    var g0 = moonGeo(tt), tau = g0.dist / CLIGHT / 86400;
    var g = moonGeo(tt - tau);   // timp-lumină (aberația anuală se compensează aproape complet cu mișcarea Pământului)
    var cb = cos(g.lat), vE = earthVel(tt + 0.01), du = (cb * cos(g.lon) * vE[0] + cb * sin(g.lon) * vE[1] + sin(g.lat) * vE[2]);
    var dist = g.dist - du * tau * AU;   // lungimea drumului luminii: Pământul se deplasează cu ~38 km cât durează propagarea
    var nu = nutation(tt), eps = meanObliquity(tt) + nu.deps;
    var o = bodyOut('moon', mod(g.lon + nu.dpsi, TAU), g.lat, dist / AU, tt, eps);
    o.sd = asin(1737.4 / dist) * R2D * 3600;
    o.parallax = asin(RE / dist) * R2D;   // paralaxa orizontală ecuatorială, grade
    return o;
  }
  function moon(jd) {
    var tt = ttFromUt(jd), m = moonTT(tt), s = sunTT(tt);
    // faza: unghi de fază și fracție iluminată (Meeus 48)
    var cpsi = cos(m._lat) * cos(m._lon - s._lon), psi = acos(Math.max(-1, Math.min(1, cpsi)));
    var R = s.distKm, Dm = m.distKm, inc = atan2(R * sin(psi), Dm - R * cpsi);
    m.elong = psi * R2D; m.phaseAngle = inc * R2D; m.illum = (1 + cos(inc)) / 2;
    m.angle = mod((m._lon - s._lon) * R2D, 360);   // elongația ecliptică 0..360 (0 = lună nouă)
    var dec_s = s._dec, ra_s = s._ra, ch = cos(dec_s) * sin(ra_s - m._ra), ck = sin(dec_s) * cos(m._dec) - cos(dec_s) * sin(m._dec) * cos(ra_s - m._ra);
    m.brightLimb = mod(atan2(ch, ck) * R2D, 360);
    m.mag = -12.73 + 0.026 * abs(inc * R2D) + 4e-9 * Math.pow(inc * R2D, 4);
    return m;
  }

  /* ---------------- Planete ---------------- */
  var NAMES = {sun: 'sun', soare: 'sun', moon: 'moon', luna: 'moon', 'lună': 'moon', mercury: 'mercury', mercur: 'mercury', venus: 'venus', mars: 'mars', marte: 'mars',
    jupiter: 'jupiter', saturn: 'saturn', uranus: 'uranus', neptune: 'neptune', neptun: 'neptune', pluto: 'pluto', pluton: 'pluto'};
  var PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  var SD1 = {mercury: 3.36, venus: 8.34, mars: 4.68, jupiter: 98.44, saturn: 82.73, uranus: 35.02, neptune: 33.50, pluto: 1.6};   // semi-diametru ecuatorial la 1 UA, secunde de arc
  function canon(n) { var k = NAMES[String(n).toLowerCase()]; if (!k) throw new Error('FFF.ephem: corp necunoscut „' + n + '”'); return k; }

  function plutoHelioJ2000(tt) {
    var t = (tt - J2000) / 36525, J = 34.35 + 3034.9057 * t, S = 50.08 + 1222.1138 * t, P = 238.96 + 144.96 * t, l = 0, b = 0, r = 0;
    for (var i = 0; i < PLUTO.length; i++) {
      var c = PLUTO[i], a = (c[0] * J + c[1] * S + c[2] * P) * D2R, sa = sin(a), ca = cos(a);
      l += c[3] * sa + c[4] * ca; b += c[5] * sa + c[6] * ca; r += c[7] * sa + c[8] * ca;
    }
    l = (l + 238.958116 + 144.96 * t) * D2R; b = (b - 3.908239) * D2R; r += 40.7241346;
    return sph2xyz(l, b, r);   // ecliptica J2000
  }
  function helioPlanet(name, tt, tOfDate) {   // vector heliocentric în ecliptica datei `tOfDate` (UA)
    if (name === 'pluto') {
      var p = plutoHelioJ2000(tt), pm = precessMatrix(tOfDate);
      var q = mulv(pm, ecl2equ(p, EPS2000));
      return equ2ecl(q, meanObliquity(tOfDate));
    }
    var v = vsEval(name, tt); return sph2xyz(v[0], v[1], v[2]);
  }
  function planetTT(name, tt) {
    var e = earthXYZ(tt), tau = 0, p, g, dist = 0, i;
    for (i = 0; i < 4; i++) {
      p = helioPlanet(name, tt - tau, tt);
      g = [p[0] - e[0], p[1] - e[1], p[2] - e[2]]; dist = norm(g); tau = dist * LIGHT_DAY;
    }
    var u = [g[0] / dist, g[1] / dist, g[2] / dist], up = aberrate(u, earthVel(tt + 0.01));
    var nu = nutation(tt), eps = meanObliquity(tt) + nu.deps, ll = lonlat(up), lon = mod(ll[0] + nu.dpsi, TAU);
    var o = bodyOut(name, lon, ll[1], dist, tt, eps);
    // geometria de fază
    var r = norm(p), Rr = norm(e), cosi = (r * r + dist * dist - Rr * Rr) / (2 * r * dist), inc = acos(Math.max(-1, Math.min(1, cosi)));
    o.phaseAngle = inc * R2D; o.illum = (1 + cos(inc)) / 2; o.helioDist = r;
    var su = sunTT(tt), cel = sin(o._dec) * sin(su._dec) + cos(o._dec) * cos(su._dec) * cos(o._ra - su._ra);
    o.elong = acos(Math.max(-1, Math.min(1, cel))) * R2D;
    o.elongSigned = o.elong * (wrap180((o._lon - su._lon) * R2D) >= 0 ? 1 : -1);   // + = la est de Soare (seara), − = la vest (dimineața)
    o.sd = SD1[name] / dist;
    var lg = 5 * Math.log10(r * dist), i1 = o.phaseAngle, m;
    switch (name) {
      case 'mercury': m = -0.42 + lg + i1 * (0.0380 + i1 * (-0.000273 + i1 * 0.000002)); break;
      case 'venus': m = -4.40 + lg + i1 * (0.0009 + i1 * (0.000239 - i1 * 0.00000065)); break;
      case 'mars': m = -1.52 + lg + 0.016 * i1; break;
      case 'jupiter': m = -9.40 + lg + 0.005 * i1; break;
      case 'saturn': {
        var tc = (tt - J2000) / 36525, inclR = (28.075216 - 0.012998 * tc) * D2R, node = (169.508470 + 1.394681 * tc) * D2R;
        var sB = sin(inclR) * cos(o._lat) * sin(o._lon - node) - cos(inclR) * sin(o._lat);
        o.ringTilt = asin(sB) * R2D;
        m = -8.88 + lg - 2.60 * abs(sB) + 1.25 * sB * sB + 0.044 * 0; break;
      }
      case 'uranus': m = -7.19 + lg; break;
      case 'neptune': m = -6.87 + lg; break;
      default: m = -1.0 + lg;
    }
    o.mag = m;
    return o;
  }
  function planet(name, jd) {
    var k = canon(name);
    if (k === 'sun') return sun(jd);
    if (k === 'moon') return moon(jd);
    return planetTT(k, ttFromUt(jd));
  }
  function body(name, jd) { return planet(name, jd); }
  function elongation(name, jd) {
    var k = canon(name);
    if (k === 'sun') return {elong: 0, signed: 0};
    var o = planet(k, jd);
    if (k === 'moon') { var a = wrap180(o.angle); return {elong: o.elong, signed: o.elong * (a >= 0 ? 1 : -1)}; }
    return {elong: o.elong, signed: o.elongSigned};
  }
  function magnitude(name, jd) { return planet(name, jd).mag; }

  /* ---------------- Topocentric / orizontal ---------------- */
  function observerVec(lat, hEl) {   // ρ sin φ', ρ cos φ' (unități de rază ecuatorială)
    var phi = lat * D2R, u = atan2((1 - FLAT) * sin(phi), cos(phi)), h = (hEl || 0) / (RE * 1000);
    return {s: (1 - FLAT) * sin(u) + h * sin(phi), c: cos(u) + h * cos(phi)};
  }
  function parallaxShift(ra, dec, distAU, lstRad, lat, hEl) {   // Meeus 40
    var o = observerVec(lat, hEl), sinPi = sin(8.794 * AS2R) / distAU, H = lstRad - ra;
    var dra = atan2(-o.c * sinPi * sin(H), cos(dec) - o.c * sinPi * cos(H));
    var dec2 = atan2((sin(dec) - o.s * sinPi) * cos(dra), cos(dec) - o.c * sinPi * cos(H));
    return {ra: ra + dra, dec: dec2};
  }
  function refraction(altDeg, opts) {   // refracția (grade) pentru altitudinea GEOMETRICĂ; Sæmundsson cu atenuare sub −1°
    var P = (opts && opts.pressure != null) ? opts.pressure : 1010, Tm = (opts && opts.temp != null) ? opts.temp : 10;
    if (altDeg < -2) return 0;
    var h = altDeg, R = 1.02 / tan((h + 10.3 / (h + 5.11)) * D2R) / 60;
    R *= (P / 1010) * (283 / (273 + Tm));
    if (altDeg < -1) R *= (altDeg + 2);
    return R;
  }
  function toHorizontal(ra, dec, jd, lat, lon, opts) {
    var lst = sidereal(jd, lon) * D2R, H = lst - ra * D2R, phi = lat * D2R, d = dec * D2R;
    var sa = sin(phi) * sin(d) + cos(phi) * cos(d) * cos(H), alt = asin(Math.max(-1, Math.min(1, sa))) * R2D;
    var az = mod(atan2(sin(H), cos(H) * sin(phi) - tan(d) * cos(phi)) * R2D + 180, 360);
    var out = {alt: alt, az: az, altGeom: alt, ha: wrap180(H * R2D)};
    if (opts && opts.refraction) { var r = refraction(alt, opts); out.alt = alt + r; out.refraction = r; }
    return out;
  }
  function observe(name, jd, lat, lon, elev, opts) {   // poziție topocentrică (paralaxă) + orizontală
    var k = canon(name), o = planet(k, jd), lst = sidereal(jd, lon) * D2R;
    var s = parallaxShift(o._ra, o._dec, o.dist, lst, lat, elev);
    var h = toHorizontal(s.ra * R2D, s.dec * R2D, jd, lat, lon, opts);
    return {name: k, ra: mod(s.ra * R2D, 360), dec: s.dec * R2D, alt: h.alt, az: h.az, altGeom: h.altGeom, ha: h.ha, dist: o.dist, geocentric: o, mag: o.mag, sd: o.sd, illum: o.illum};
  }

  /* ---------------- Răsărit / apus / trecere ---------------- */
  function localDayStart(jd, tzH) {   // JD(UT) al începutului zilei civile locale care conține `jd`
    var l = jd + tzH / 24, d0 = floor(l + 0.5) - 0.5;
    return d0 - tzH / 24;
  }
  function altSd(k, lat, lon, elev, jd) {   // altitudine geometrică topocentrică a centrului (grade) și semi-diametrul (arcsec)
    var o = (k === 'sun') ? sun(jd) : (k === 'moon' ? moon(jd) : planetTT(k, ttFromUt(jd)));
    var ra = o._ra, dec = o._dec;
    var s = parallaxShift(ra, dec, o.dist, sidereal(jd, lon) * D2R, lat, elev); ra = s.ra; dec = s.dec;   // paralaxa diurnă (semnificativă pentru Lună, Venus, Marte…)
    return {alt: toHorizontal(ra * R2D, dec * R2D, jd, lat, lon).altGeom, sd: (k === 'sun' || k === 'moon') ? o.sd : 0};
  }
  function bisect(f, a, b, tol) {
    var fa = f(a);
    for (var i = 0; i < 60 && (b - a) > tol; i++) {
      var m = 0.5 * (a + b), fm = f(m);
      if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else { b = m; }
    }
    return 0.5 * (a + b);
  }
  function defaultTz(lon) { return Math.round(lon / 15); }
  function riseSetTransit(name, when, lat, lon, opts) {
    opts = opts || {};
    var k = canon(name), tz = (opts.tz != null) ? opts.tz : defaultTz(lon), jd0 = localDayStart(jdFromDate(when), tz);
    var step = opts.step || (k === 'moon' ? 10 : 20) / 1440, n = Math.round(1 / step), elev = opts.elev || 0;
    var dip = elev ? 0.0347 * sqrt(elev) : 0, center = opts.limb === 'center';
    var g = function (jd) {   // > 0 deasupra orizontului definit
      var as = altSd(k, lat, lon, elev, jd);
      var h0 = (opts.h0 != null) ? opts.h0 : -(34 / 60) - dip - (center ? 0 : as.sd / 3600);
      return as.alt - h0;
    };
    var res = {rise: null, set: null, transit: null, transitAlt: null, lowerTransit: null, status: 'normal', tz: tz}, i;
    var prev = g(jd0), t0 = jd0, first = prev;
    for (i = 1; i <= n; i++) {
      var t1 = jd0 + i * step, cur = g(t1);
      if ((prev > 0) !== (cur > 0)) {
        var root = bisect(g, t0, t1, 0.25 / 86400);
        if (cur > 0) { if (res.rise == null) res.rise = root; } else if (res.set == null) res.set = root;
      }
      prev = cur; t0 = t1;
    }
    var haf = function (jd) { var o = (k === 'sun') ? sun(jd) : (k === 'moon' ? moon(jd) : planetTT(k, ttFromUt(jd))); return wrap180(sidereal(jd, lon) - o.ra); };
    var stepT = 30 / 1440, nT = Math.round(1 / stepT), pa = haf(jd0), ta = jd0;
    for (i = 1; i <= nT + 1; i++) {
      var tb = jd0 + i * stepT, pb = haf(tb);
      if (pa < 0 && pb >= 0 && abs(pb - pa) < 120) { var tr = bisect(haf, ta, tb, 0.25 / 86400); if (tr >= jd0 && tr < jd0 + 1 && res.transit == null) res.transit = tr; }
      if (pa > 90 && pb < -90) { var lw = bisect(function (jj) { return mod(haf(jj), 360) - 180; }, ta, tb, 0.25 / 86400); if (lw >= jd0 && lw < jd0 + 1 && res.lowerTransit == null) res.lowerTransit = lw; }
      pa = pb; ta = tb;
    }
    if (res.transit != null) res.transitAlt = altSd(k, lat, lon, elev, res.transit).alt;
    if (res.rise == null && res.set == null) res.status = first > 0 ? 'alwaysUp' : 'alwaysDown';
    else if (res.rise == null) res.status = 'noRise'; else if (res.set == null) res.status = 'noSet';
    return res;
  }
  function rise(name, when, lat, lon, opts) { return riseSetTransit(name, when, lat, lon, opts).rise; }
  function set(name, when, lat, lon, opts) { return riseSetTransit(name, when, lat, lon, opts).set; }
  function transit(name, when, lat, lon, opts) { return riseSetTransit(name, when, lat, lon, opts).transit; }
  function twilight(when, lat, lon, opts) {
    opts = opts || {};
    var out = {}, defs = [['civil', -6], ['nautical', -12], ['astronomical', -18]];
    defs.forEach(function (d) {
      var r = riseSetTransit('sun', when, lat, lon, {tz: opts.tz, h0: d[1], step: 10 / 1440});
      out[d[0]] = {dawn: r.rise, dusk: r.set, status: r.status};
    });
    return out;
  }

  /* ---------------- Faze lunare ---------------- */
  var PHASE_ANGLE = {new: 0, first: 90, full: 180, last: 270};
  function elongAngle(jd) { var tt = ttFromUt(jd); return mod((moonTT(tt)._lon - sunTT(tt)._lon) * R2D, 360); }
  function moonPhase(jd) {
    var m = moon(jd), a = m.angle, names = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'];
    var idx = floor(mod(a + 22.5, 360) / 45) % 8;
    return {angle: a, illum: m.illum, fraction: a / 360, age: a / 360 * 29.530588861, name: names[idx], waxing: a < 180, phaseAngle: m.phaseAngle, distKm: m.distKm, brightLimb: m.brightLimb};
  }
  function phaseTime(kind, jdGuess) {   // JD(UT) al fazei celei mai apropiate de ghicire (rezolvare numerică a elongației ecliptice)
    var target = PHASE_ANGLE[kind], t = jdGuess, i;
    for (i = 0; i < 12; i++) {
      var d = wrap180(elongAngle(t) - target);
      var dt = -d / 12.190749;   // grade/zi, viteza medie a elongației
      t += dt; if (abs(dt) < 0.02 / 86400) break;
    }
    return t;
  }
  function nextPhase(jd, kind, dir) {   // următoarea (dir=1) sau precedenta (dir=-1) fază: 'new'|'first'|'full'|'last'
    dir = dir || 1;
    var a = elongAngle(jd), target = PHASE_ANGLE[kind], diff = dir > 0 ? mod(target - a, 360) : -mod(a - target, 360);
    if (abs(diff) < 1e-6) diff = dir > 0 ? 360 : -360;
    var t = phaseTime(kind, jd + diff / 12.190749);
    // corecție de siguranță: asigură ordinea
    var guard = 0;
    while (dir > 0 && t <= jd && guard++ < 3) t = phaseTime(kind, t + 29.53);
    while (dir < 0 && t >= jd && guard++ < 3) t = phaseTime(kind, t - 29.53);
    return t;
  }
  function moonPhases(from, to, kinds) {   // listă [{kind, jd}] în ordine cronologică între două date (JD sau Date)
    var j0 = jdFromDate(from), j1 = jdFromDate(to), ks = kinds || ['new', 'first', 'full', 'last'], out = [];
    ks.forEach(function (kd) {
      var t = nextPhase(j0 - 0.001, kd, 1);
      while (t <= j1) { out.push({kind: kd, jd: t}); t = nextPhase(t + 1, kd, 1); }
    });
    out.sort(function (a, b) { return a.jd - b.jd; });
    return out;
  }

  /* ---------------- Stele (poziții aparente pentru planetariu) ---------------- */
  function starPosition(ra2000, dec2000, pmRa, pmDec, jd, opts) {   // pm în mas/an (pmRa include cos δ); rezultat: coordonate aparente (echinocțiul adevărat al datei), grade
    var tt = ttFromUt(jd), yr = (tt - J2000) / 365.25, a = ra2000 * D2R, d = dec2000 * D2R;
    a += (pmRa || 0) * yr / 3.6e6 * D2R / cos(d); d += (pmDec || 0) * yr / 3.6e6 * D2R;
    var v = mulv(precessMatrix(tt), [cos(d) * cos(a), cos(d) * sin(a), sin(d)]);
    var nu = nutation(tt), eps0 = meanObliquity(tt), eps = eps0 + nu.deps, ll = lonlat(equ2ecl(v, eps0));
    var e = sph2xyz(ll[0] + nu.dpsi, ll[1], 1);   // ecliptica adevărată a datei
    if (!opts || opts.aberration !== false) e = aberrate(e, earthVel(tt + 0.01));
    var q = lonlat(ecl2equ(e, eps));
    return {ra: q[0] * R2D, dec: q[1] * R2D};
  }
  function precess(ra, dec, jdFrom, jdTo) {   // precesiune între două epoci (echinocțiu mediu); grade
    var t1 = ttFromUt(jdFrom), t2 = ttFromUt(jdTo), v = [cos(dec * D2R) * cos(ra * D2R), cos(dec * D2R) * sin(ra * D2R), sin(dec * D2R)];
    var w = mulv(precessMatrix(t2), tmulv(precessMatrix(t1), v)), q = lonlat(w);
    return {ra: q[0] * R2D, dec: q[1] * R2D};
  }
  function eqToEcl(ra, dec, jd) { var eps = meanObliquity(ttFromUt(jd)), v = equ2ecl([cos(dec * D2R) * cos(ra * D2R), cos(dec * D2R) * sin(ra * D2R), sin(dec * D2R)], eps), q = lonlat(v); return {lon: q[0] * R2D, lat: q[1] * R2D}; }

  /* ================= ECLIPSA 2027 ================= */
  //@@ECLIPSE@@

  /* ---------------- Interfață ---------------- */
  function J(x) { return typeof x === 'number' ? x : jdFromDate(x); }   // acceptă și Date / [y,m,d,…] / {y,mo,d,…}
  function wj(f, i) { i = i || 0; return function () { var a = Array.prototype.slice.call(arguments); a[i] = J(a[i]); return f.apply(null, a); }; }
  var API = {
    version: '1.0.0',
    constants: {AU: AU, c: CLIGHT, Re: RE, flattening: FLAT},
    jdFromCalendar: jdFromCalendar, calendarFromJd: calendarFromJd, jdFromDate: jdFromDate, dateFromJd: dateFromJd,
    deltaT: wj(deltaT), setDeltaT: setDeltaT, tt: wj(ttFromUt), ut: utFromTt,
    sidereal: wj(sidereal), gmst: wj(gmst), gast: wj(gast), nutation: function (jd) { var n = nutation(ttFromUt(J(jd))); return {dpsi: n.dpsi * R2D, deps: n.deps * R2D, dpsiArcsec: n.dpsi / AS2R, depsArcsec: n.deps / AS2R}; },
    obliquity: function (jd, apparent) { var tt = ttFromUt(J(jd)); return (meanObliquity(tt) + (apparent ? nutation(tt).deps : 0)) * R2D; },
    moonMeeus: function (jd) { var g = moonGeoMeeus(ttFromUt(J(jd))); return {lon: g.lon * R2D, lat: g.lat * R2D, dist: g.dist}; },
    sun: wj(sun), moon: wj(moon), planet: wj(planet, 1), body: wj(body, 1), bodies: ['sun', 'moon'].concat(PLANETS),
    elongation: wj(elongation, 1), magnitude: wj(magnitude, 1),
    toHorizontal: wj(toHorizontal, 2), observe: wj(observe, 1), refraction: refraction,
    riseSetTransit: riseSetTransit, rise: rise, set: set, transit: transit, twilight: twilight,
    moonPhase: wj(moonPhase), nextPhase: wj(nextPhase), moonPhases: moonPhases,
    starPosition: wj(starPosition, 4), precess: function (ra, dec, a, b) { return precess(ra, dec, J(a), J(b)); }, eqToEcl: wj(eqToEcl, 2),
    label: function (kind, key) { return T('ephem', kind + '.' + key); }
  };
  API.eclipseLocal = eclipseLocal;
  API.eclipse = {local: eclipseLocal, inBand: eclipseInBand, greatest: eclipseGreatest, elements: eclipseElements, path: eclipsePath, places: ECL_PLACES, bessel: function (jdTT, k) { var b = eclBess(jdTT, k); return {x: b.x, y: b.y, d: b.d * R2D, mu: b.mu * R2D, l1: b.l1, l2: b.l2, tanf1: b.tf1, tanf2: b.tf2}; }, constants: EC};
  F.ephem = Object.assign(F.ephem || {}, API);
})();
