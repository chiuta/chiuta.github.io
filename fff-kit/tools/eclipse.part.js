  var EC = {kPenumbra: 0.2725076, kUmbra: 0.272281, Rs: 696000};   // raza Lunii / Re: IAU 1976 pentru penumbră, valoare „umbrală” (limb mediu) pentru umbră — convenția NASA/Espenak; Rs = raza Soarelui (km)
  function kPair(k) { if (k == null) return [EC.kPenumbra, EC.kUmbra]; if (typeof k === 'number') return [k, k]; return [k.penumbra != null ? k.penumbra : EC.kPenumbra, k.umbra != null ? k.umbra : EC.kUmbra]; }
  var ECL_GUESS_UT = jdFromCalendar(2027, 8, 2, 10, 7, 0);   // aproximare pentru căutarea momentului maxim global

  function kset(b, k) {   // parametrii conului pentru o rază lunară dată (în Re)
    var sf1 = (EC.Rs + k * RE) / b.D, sf2 = (EC.Rs - k * RE) / b.D, cf1 = sqrt(1 - sf1 * sf1), cf2 = sqrt(1 - sf2 * sf2);
    return {tf1: sf1 / cf1, tf2: sf2 / cf2, l1: b.zm * sf1 / cf1 + k / cf1, l2: b.zm * sf2 / cf2 - k / cf2};
  }
  function eclBess(tt, kk) {   // elemente Besselian instantanee din efemeridele proprii (Re = 1); kk: număr sau {penumbra, umbra}
    var kp = kPair(kk);
    var s = sunTT(tt), m = moonTT(tt);
    var Sv = [s.distKm * cos(s._dec) * cos(s._ra), s.distKm * cos(s._dec) * sin(s._ra), s.distKm * sin(s._dec)];
    var Mv = [m.distKm * cos(m._dec) * cos(m._ra), m.distKm * cos(m._dec) * sin(m._ra), m.distKm * sin(m._dec)];
    var g = [Sv[0] - Mv[0], Sv[1] - Mv[1], Sv[2] - Mv[2]], D = norm(g), z = [g[0] / D, g[1] / D, g[2] / D];
    var a = atan2(z[1], z[0]), d = asin(z[2]);
    var ex = [-sin(a), cos(a), 0], ey = [-sin(d) * cos(a), -sin(d) * sin(a), cos(d)];
    var dot = function (u, v) { return u[0] * v[0] + u[1] * v[1] + u[2] * v[2]; };
    var b = {tt: tt, D: D, x: dot(Mv, ex) / RE, y: dot(Mv, ey) / RE, zm: dot(Mv, z) / RE, d: d, a: a, ex: ex, ey: ey, z: z, sunRa: s._ra, sunDec: s._dec, sunDist: s.dist, k: kp};
    var ut = utFromTt(tt); b.ut = ut; b.mu = mod(gast(ut) * D2R - a, TAU);
    b.p = kset(b, kp[0]); b.u = kset(b, kp[1]);
    b.l1 = b.p.l1; b.tf1 = b.p.tf1; b.l2 = b.u.l2; b.tf2 = b.u.tf2;   // elementele tabelate (stil NASA): penumbra cu kp, umbra cu ku
    return b;
  }
  function eclObs(b, lat, lon, elev) {   // coordonatele observatorului în planul fundamental (ξ, η, ζ), m și razele conurilor
    var o = observerVec(lat, elev), th = b.mu + lon * D2R, sd = sin(b.d), cd = cos(b.d);
    var xi = o.c * sin(th), eta = o.s * cd - o.c * sd * cos(th), zeta = o.s * sd + o.c * cd * cos(th);
    var u = b.x - xi, v = b.y - eta, m = sqrt(u * u + v * v);
    return {xi: xi, eta: eta, zeta: zeta, u: u, v: v, m: m, L1: b.p.l1 - zeta * b.p.tf1, L2: b.p.l2 - zeta * b.p.tf2, L1u: b.u.l1 - zeta * b.u.tf1, L2u: b.u.l2 - zeta * b.u.tf2};
  }
  function lens(r1, r2, dd) {   // aria de intersecție a două discuri
    if (dd >= r1 + r2) return 0;
    if (dd <= abs(r1 - r2)) { var rm = Math.min(r1, r2); return PI * rm * rm; }
    var a1 = acos((dd * dd + r1 * r1 - r2 * r2) / (2 * dd * r1)), a2 = acos((dd * dd + r2 * r2 - r1 * r1) / (2 * dd * r2));
    return r1 * r1 * (a1 - sin(2 * a1) / 2) + r2 * r2 * (a2 - sin(2 * a2) / 2);
  }
  function eclMag(st) {
    var L1 = st.L1, L2 = st.L2, m = st.m, Rs = (L1 + L2) / 2, Rm = (L1 - L2) / 2;   // raze aparente în planul fundamental (cu kp)
    var frac = (L1 - m) / (L1 + L2), obsc = 0;   // frac: fracția din diametrul Soarelui acoperită (Meeus)
    if (m < L1) obsc = Math.min(1, lens(Rs, Rm, m) / (PI * Rs * Rs));
    var ratio = (st.L1u - st.L2u) / (st.L1u + st.L2u);   // Lună/Soare (cu ku), convenția NASA pentru faze totale/inelare
    var inUmbra = (st.L2u < 0 && m < -st.L2u) || (st.L2u > 0 && m < st.L2u);
    return {frac: Math.max(0, frac), ratio: ratio, mag: inUmbra ? ratio : Math.max(0, frac), obsc: obsc};
  }
  function golden(f, a, b, tol) {   // minim
    var gr = 0.6180339887498949, c = b - gr * (b - a), d = a + gr * (b - a), fc = f(c), fd = f(d);
    for (var i = 0; i < 80 && (b - a) > tol; i++) {
      if (fc < fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = f(c); } else { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = f(d); }
    }
    return 0.5 * (a + b);
  }
  var globalCache = {};
  function eclGlobal(opts) {   // momentul de maxim global (cea mai mică distanță axă–centrul Pământului), în TT
    var k = opts && opts.k, key = 'g' + JSON.stringify(kPair(k));
    if (globalCache[key]) return globalCache[key];
    var t0 = ttFromUt(ECL_GUESS_UT);
    var f = function (tt) { var b = eclBess(tt, k); return b.x * b.x + b.y * b.y; };
    var tg = golden(f, t0 - 0.1, t0 + 0.1, 1e-8), b = eclBess(tg, k);
    var gamma = sqrt(b.x * b.x + b.y * b.y) * (b.y >= 0 ? 1 : -1);
    var r = {tt: tg, ut: utFromTt(tg), gamma: gamma, bess: b};
    globalCache[key] = r; return r;
  }
  function plane2geo(b, xi, eta, zeta) {   // (ξ,η,ζ) pe suprafața elipsoidului → lat/lon geodezice (grade)
    var X = xi * b.ex[0] + eta * b.ey[0] + zeta * b.z[0], Y = xi * b.ex[1] + eta * b.ey[1] + zeta * b.z[1], Z = xi * b.ex[2] + eta * b.ey[2] + zeta * b.z[2];
    var e2 = 2 * FLAT - FLAT * FLAT, p = sqrt(X * X + Y * Y), phi = atan2(Z, p * (1 - e2)), i, Nn;
    for (i = 0; i < 6; i++) { Nn = 1 / sqrt(1 - e2 * sin(phi) * sin(phi)); phi = atan2(Z + e2 * Nn * sin(phi), p); }
    var lon = atan2(Y, X) - gast(b.ut) * D2R;
    return {lat: phi * R2D, lon: wrap180(lon * R2D)};
  }
  function zetaOn(b, xi, eta) {   // rădăcina mare ζ pe elipsoid pentru (ξ,η) dat; null dacă punctul nu intersectează Pământul
    var ep = 1 / ((1 - FLAT) * (1 - FLAT)) - 1, sd = sin(b.d), cd = cos(b.d);
    var A = 1 + ep * sd * sd, B = 2 * ep * eta * cd * sd, C = xi * xi + eta * eta + ep * eta * eta * cd * cd - 1, disc = B * B - 4 * A * C;
    if (disc < 0) return null;
    return (-B + sqrt(disc)) / (2 * A);
  }
  function centralPoint(b) {
    var zt = zetaOn(b, b.x, b.y);
    if (zt == null) return null;
    var g = plane2geo(b, b.x, b.y, zt);
    g.zeta = zt; return g;
  }
  function limitPoints(b, dtSec) {   // limitele nordică/sudică ale umbrei (planul perpendicular pe deplasarea la sol)
    var c = centralPoint(b); if (!c) return null;
    var b2 = eclBess(b.tt + (dtSec || 60) / 86400), c2 = centralPoint(b2); if (!c2) return null;
    var o0 = eclObs(b, c.lat, c.lon, 0), o1 = eclObs(b, c2.lat, c2.lon, 0);
    var tx = o1.xi - o0.xi, ty = o1.eta - o0.eta, tl = sqrt(tx * tx + ty * ty); if (tl < 1e-12) return null;
    var nx = -ty / tl, ny = tx / tl, out = [];
    [1, -1].forEach(function (sg) {
      var zeta = c.zeta, pt = null, i, R2;
      for (i = 0; i < 12; i++) {
        R2 = abs(b.l2 - zeta * b.tf2);
        var xi = b.x + sg * R2 * nx, eta = b.y + sg * R2 * ny, zn = zetaOn(b, xi, eta);
        if (zn == null) { pt = null; break; }
        if (abs(zn - zeta) < 1e-10) { zeta = zn; pt = plane2geo(b, xi, eta, zn); break; }
        zeta = zn; pt = plane2geo(b, xi, eta, zn);
      }
      out.push(pt);
    });
    if (!out[0] || !out[1]) return null;
    return out[0].lat >= out[1].lat ? {north: out[0], south: out[1]} : {north: out[1], south: out[0]};
  }
  function haversineKm(la1, lo1, la2, lo2) {
    var p1 = la1 * D2R, p2 = la2 * D2R, dl = (lo2 - lo1) * D2R, a = sin((p2 - p1) / 2) * sin((p2 - p1) / 2) + cos(p1) * cos(p2) * sin(dl / 2) * sin(dl / 2);
    return 2 * 6371.0088 * asin(sqrt(a));
  }
  function sunAltAz(b, lat, lon) {   // altitudine/azimut topocentrice ale Soarelui (geometrice și refractate)
    var lst = (gast(b.ut) + lon) * D2R, s = parallaxShift(b.sunRa, b.sunDec, b.sunDist, lst, lat, 0);
    var h = toHorizontal(s.ra * R2D, s.dec * R2D, b.ut, lat, lon, {refraction: true});
    return {alt: h.altGeom, altApparent: h.alt, az: h.az};
  }
  function fmtTime(jdUT, zone) {   // {iso, local, offsetMin}
    var d = dateFromJd(jdUT), iso = d.toISOString(), out = {iso: iso};
    if (typeof zone === 'string') {
      try {
        var f = new Intl.DateTimeFormat('en-GB', {timeZone: zone, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit'});
        var parts = {}; f.formatToParts(d).forEach(function (p) { parts[p.type] = p.value; });
        out.local = parts.hour.replace('24', '00') + ':' + parts.minute + ':' + parts.second; out.localDate = parts.year + '-' + parts.month + '-' + parts.day;
        var asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
        out.offsetMin = Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
        return out;
      } catch (e) { /* revine la decalaj numeric */ }
    }
    var offH = typeof zone === 'number' ? zone : 0, ld = new Date(d.getTime() + offH * 3600000);
    out.local = ld.toISOString().slice(11, 19); out.localDate = ld.toISOString().slice(0, 10); out.offsetMin = Math.round(offH * 60);
    return out;
  }
  function contact(label, tt, lat, lon, elev, zone, k) {
    var b = eclBess(tt, k), aa = sunAltAz(b, lat, lon), t = fmtTime(b.ut, zone);
    return {label: label, jd: b.ut, utc: t.iso, local: t.local, localDate: t.localDate, offsetMin: t.offsetMin, sunAlt: aa.alt, sunAltApparent: aa.altApparent, sunAz: aa.az, visible: aa.alt > -0.8333};
  }
  function eclipseLocal(lat, lon, elev, opts) {
    if (lat !== null && typeof lat === 'object') {   // acceptă și (elemente, lat, lon, elev, opts)
      return eclipseLocal(arguments[1], arguments[2], arguments[3], arguments[4]);
    }
    opts = opts || {}; elev = elev || 0;
    var k = opts.k, zone = opts.timeZone != null ? opts.timeZone : (opts.tz != null ? opts.tz : Math.round(lon / 15));
    var g = eclGlobal({k: k}), tc = g.tt;
    var st = function (tt) { var b = eclBess(tt, k); return eclObs(b, lat, lon, elev); };
    var f1 = function (tt) { var s = st(tt); return s.m - s.L1; };
    var lo = tc - 0.17, hi = tc + 0.17, step = 2 / 1440, n = Math.round((hi - lo) / step), i, ts = [], fs = [];
    for (i = 0; i <= n; i++) { ts.push(lo + i * step); fs.push(f1(ts[i])); }
    var imin = 0; for (i = 1; i <= n; i++) if (fs[i] < fs[imin]) imin = i;
    if (fs[imin] >= 0 && !opts.force) {
      // minimul m − L1 peste pas; rafinare locală pentru cazuri la limită
      var tm0 = golden(f1, ts[Math.max(0, imin - 1)], ts[Math.min(n, imin + 1)], 1e-7);
      if (f1(tm0) >= 0) return {type: 'none', magnitude: 0, magnitudeFraction: 0, obscuration: 0, lat: lat, lon: lon, elev: elev, inBand: false, k: kPair(k), gamma: g.gamma};
    }
    var tmax = golden(function (tt) { return st(tt).m; }, ts[Math.max(0, imin - 1)], ts[Math.min(n, imin + 1)], 1e-8);
    var sx = st(tmax), mg = eclMag(sx), root = function (f, a, bb) { var fa = f(a); for (var j = 0; j < 60 && (bb - a) > 2e-8; j++) { var mm = 0.5 * (a + bb), fm = f(mm); if ((fm > 0) === (fa > 0)) { a = mm; fa = fm; } else bb = mm; } return 0.5 * (a + bb); };
    // C1, C4: m = L1
    var a1 = lo, a4 = hi;
    var j; for (j = imin; j > 0 && fs[j] < 0; j--); var t1 = root(f1, ts[j], ts[Math.min(j + 1, n)]);
    for (j = imin; j < n && fs[j] < 0; j++); var t4 = root(f1, ts[Math.max(j - 1, 0)], ts[j]);
    var r = {type: 'partial', magnitude: mg.mag, magnitudeFraction: mg.frac, magnitudeRatio: mg.ratio, obscuration: mg.obsc, lat: lat, lon: lon, elev: elev, k: kPair(k), gamma: g.gamma, zone: zone, inBand: false};
    r.c1 = contact('C1', t1, lat, lon, elev, zone, k); r.max = contact('max', tmax, lat, lon, elev, zone, k); r.c4 = contact('C4', t4, lat, lon, elev, zone, k);
    r.c2 = r.c3 = null; r.durationTotality = 0;
    r.minSeparation = sx.m * RE;   // km în planul fundamental
    var L2m = sx.L2u;
    if (L2m < 0 && sx.m < -L2m) {   // totalitate (conul umbral, ku)
      r.type = 'total'; r.inBand = true;
      var f2 = function (tt) { var s = st(tt); return s.m + s.L2u; };   // m − |L2|
      var t2 = root(f2, t1, tmax), t3 = root(f2, tmax, t4);
      r.c2 = contact('C2', t2, lat, lon, elev, zone, k); r.c3 = contact('C3', t3, lat, lon, elev, zone, k);
      r.durationTotality = (utFromTt(t3) - utFromTt(t2)) * 86400;
      r.marginKm = (-L2m - sx.m) * RE;
    } else if (L2m > 0 && sx.m < L2m) {
      r.type = 'annular';
      var f2a = function (tt) { var s = st(tt); return s.m - s.L2u; };
      var t2a = root(f2a, t1, tmax), t3a = root(f2a, tmax, t4);
      r.c2 = contact('C2', t2a, lat, lon, elev, zone, k); r.c3 = contact('C3', t3a, lat, lon, elev, zone, k);
      r.durationAnnularity = (utFromTt(t3a) - utFromTt(t2a)) * 86400;
    } else r.marginKm = (-L2m - sx.m) * RE;   // negativ: la câți km (în plan) în afara benzii
    r.durationPartial = (utFromTt(t4) - utFromTt(t1)) * 86400;
    r.visibleAtMax = r.max.visible;
    if (!r.c1.visible && !r.max.visible && !r.c4.visible && !(r.c2 && r.c2.visible)) {   // Soarele sub orizont pe tot intervalul: nimic de văzut
      r.type = 'none'; r.reason = 'sun-below-horizon'; r.inBand = false; r.magnitude = 0; r.magnitudeFraction = 0; r.obscuration = 0; r.c2 = r.c3 = null; r.durationTotality = 0;
    }
    // magnitudine/obscurare raportate la maxim; pentru totalitate magnitudinea poate depăși 1
    return r;
  }
  function eclipseInBand(lat, lon, elev, opts) {
    var r = eclipseLocal(lat, lon, elev, opts);
    return {inBand: r.type === 'total' || r.type === 'annular', type: r.type, magnitude: r.magnitude, obscuration: r.obscuration, marginKm: r.marginKm == null ? null : r.marginKm, local: r};
  }
  function eclipseGreatest(opts) {   // circumstanțele globale: momentul maxim, gamma, punct, magnitudine, durată
    var g = eclGlobal(opts), b = g.bess, cp = centralPoint(b), r = {tt: g.tt, jd: g.ut, utc: dateFromJd(g.ut).toISOString(), gamma: g.gamma, x: b.x, y: b.y, d: b.d * R2D, mu: b.mu * R2D, l1: b.l1, l2: b.l2, tanf1: b.tf1, tanf2: b.tf2};
    if (cp) {
      r.lat = cp.lat; r.lon = cp.lon;
      var loc = eclipseLocal(cp.lat, cp.lon, 0, {k: opts && opts.k, tz: 0});
      r.magnitude = loc.magnitude; r.magnitudeFraction = loc.magnitudeFraction; r.obscuration = loc.obscuration; r.durationTotality = loc.durationTotality; r.sunAlt = loc.max.sunAlt; r.sunAz = loc.max.sunAz;
      r.type = loc.type;
      var lp = limitPoints(b); if (lp) r.pathWidthKm = haversineKm(lp.north.lat, lp.north.lon, lp.south.lat, lp.south.lon);
    }
    return r;
  }
  function eclipseElements(opts) {   // polinoame cubice în t = (TT − t0)/oră, t0 = 10:00 TT (stil Espenak), ajustate pe ±3 h
    var k = opts && opts.k, t0 = jdFromCalendar(2027, 8, 2, 10, 0, 0), N = 36, rows = [], i;
    for (i = 0; i <= N; i++) { var h = -3 + 6 * i / N, b = eclBess(t0 + h / 24, k); rows.push([h, b.x, b.y, b.d, b.mu, b.l1, b.l2]); }
    var fit = function (col) {   // cele mai mici pătrate, grad 3 (ecuații normale 4×4)
      var A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], Bv = [0, 0, 0, 0], p, q;
      var unwrap = col === 4, prev = null, off = 0;
      rows.forEach(function (r) {
        var y = r[col]; if (unwrap) { if (prev != null && y - prev < -PI) off += TAU; prev = y; y += off; }
        var pw = [1, r[0], r[0] * r[0], r[0] * r[0] * r[0]];
        for (p = 0; p < 4; p++) { Bv[p] += pw[p] * y; for (q = 0; q < 4; q++) A[p][q] += pw[p] * pw[q]; }
      });
      for (p = 0; p < 4; p++) { var piv = A[p][p]; for (q = p + 1; q < 4; q++) { var fct = A[q][p] / piv; for (var c = p; c < 4; c++) A[q][c] -= fct * A[p][c]; Bv[q] -= fct * Bv[p]; } }
      var cf = [0, 0, 0, 0]; for (p = 3; p >= 0; p--) { var s2 = Bv[p]; for (q = p + 1; q < 4; q++) s2 -= A[p][q] * cf[q]; cf[p] = s2 / A[p][p]; }
      return cf;
    };
    var b0 = eclBess(t0, k), mu0 = fit(4); mu0[0] = mod(mu0[0], TAU);
    return {t0TT: t0, t0: 'TT 2027-08-02 10:00', unit: 'ore', k: kPair(k), x: fit(1), y: fit(2), d: fit(3).map(function (v, j) { return j === 0 ? v * R2D : v * R2D; }), mu: mu0.map(function (v) { return v * R2D; }),
            l1: fit(5), l2: fit(6), tanf1: b0.tf1, tanf2: b0.tf2, note: 'x,y,l1,l2 în raze ecuatoriale terestre; d și μ în grade (μ în grade/oră pentru termenul liniar)'};
  }
  function eclipsePath(opts) {
    opts = opts || {}; var stepMin = opts.stepMin || 5, k = opts.k, g = eclGlobal({k: k}), tc = g.tt;
    var ex = function (tt) { var b = eclBess(tt, k); return zetaOn(b, b.x, b.y) != null; };
    var lo = tc - 0.2, hi = tc + 0.2, step = 1 / 1440, tStart = null, tEnd = null, tt, prev = false;
    for (tt = lo; tt <= hi; tt += step) {
      var cur = ex(tt);
      if (cur && !prev && tStart == null) { var a = tt - step, bb = tt; for (var j = 0; j < 40; j++) { var mm = 0.5 * (a + bb); if (ex(mm)) bb = mm; else a = mm; } tStart = bb; }
      if (!cur && prev) { var a2 = tt - step, b2 = tt; for (var j2 = 0; j2 < 40; j2++) { var m2 = 0.5 * (a2 + b2); if (ex(m2)) a2 = m2; else b2 = m2; } tEnd = a2; }
      prev = cur;
    }
    if (tStart == null || tEnd == null) return {type: 'FeatureCollection', features: []};
    var times = [tStart], u0 = utFromTt(tStart), u1 = utFromTt(tEnd), u = Math.ceil((u0 - 0.5) * 1440 / stepMin) * stepMin / 1440 + 0.5;
    for (; u < u1; u += stepMin / 1440) if (u > u0 + 1e-6) times.push(ttFromUt(u));
    times.push(tEnd);
    var cl = [], nl = [], sl = [], stamps = [], samples = [];
    times.forEach(function (tt2) {
      var b = eclBess(tt2, k), c = centralPoint(b); if (!c) return;
      var lp = limitPoints(b);
      cl.push([c.lon, c.lat]); stamps.push(dateFromJd(b.ut).toISOString().slice(11, 19));
      if (lp) { nl.push([lp.north.lon, lp.north.lat]); sl.push([lp.south.lon, lp.south.lat]); } else { nl.push(null); sl.push(null); }
      samples.push({utc: dateFromJd(b.ut).toISOString(), tt: tt2, central: [c.lon, c.lat], north: lp ? [lp.north.lon, lp.north.lat] : null, south: lp ? [lp.south.lon, lp.south.lat] : null});
    });
    var clean = function (a) { return a.filter(function (p) { return p; }); };
    var N = clean(nl), S = clean(sl), r5 = function (p) { return [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4]; };
    var polyRing = N.map(r5).concat(S.slice().reverse().map(r5)); if (polyRing.length) polyRing.push(polyRing[0]);
    var gr = eclipseGreatest({k: k});
    var feats = [
      {type: 'Feature', properties: {kind: 'central-line', times: stamps, stepMin: stepMin}, geometry: {type: 'LineString', coordinates: cl.map(r5)}},
      {type: 'Feature', properties: {kind: 'north-limit'}, geometry: {type: 'LineString', coordinates: N.map(r5)}},
      {type: 'Feature', properties: {kind: 'south-limit'}, geometry: {type: 'LineString', coordinates: S.map(r5)}},
      {type: 'Feature', properties: {kind: 'totality-band'}, geometry: {type: 'Polygon', coordinates: [polyRing]}}
    ];
    if (gr.lat != null) feats.push({type: 'Feature', properties: {kind: 'greatest-eclipse', utc: gr.utc, durationTotality: gr.durationTotality, magnitude: gr.magnitude, gamma: gr.gamma, pathWidthKm: gr.pathWidthKm}, geometry: {type: 'Point', coordinates: r5([gr.lon, gr.lat])}});
    return {type: 'FeatureCollection', properties: {eclipse: '2027-08-02', source: 'FFF.ephem (calcul propriu; vezi docs/ephem.md pentru precizie)', startUtc: dateFromJd(utFromTt(tStart)).toISOString(), endUtc: dateFromJd(utFromTt(tEnd)).toISOString(), samples: samples}, features: feats};
  }
  var ECL_PLACES = {
    'București': {lat: 44.4268, lon: 26.1025, tz: 'Europe/Bucharest'}, 'Constanța': {lat: 44.1598, lon: 28.6348, tz: 'Europe/Bucharest'},
    'Cluj-Napoca': {lat: 46.7712, lon: 23.6236, tz: 'Europe/Bucharest'}, 'Iași': {lat: 47.1585, lon: 27.6014, tz: 'Europe/Bucharest'},
    'Timișoara': {lat: 45.7489, lon: 21.2087, tz: 'Europe/Bucharest'}, 'Brașov': {lat: 45.6427, lon: 25.5887, tz: 'Europe/Bucharest'},
    'Craiova': {lat: 44.3302, lon: 23.7949, tz: 'Europe/Bucharest'}, 'Sulina': {lat: 45.1597, lon: 29.6586, tz: 'Europe/Bucharest'},
    'Luxor': {lat: 25.6872, lon: 32.6396, tz: 'Africa/Cairo'}, 'Cairo': {lat: 30.0444, lon: 31.2357, tz: 'Africa/Cairo'},
    'Gibraltar': {lat: 36.1408, lon: -5.3536, tz: 'Europe/Gibraltar'}, 'Tanger': {lat: 35.7595, lon: -5.834, tz: 'Africa/Casablanca'},
    'Atena': {lat: 37.9838, lon: 23.7275, tz: 'Europe/Athens'}, 'Jeddah': {lat: 21.4858, lon: 39.1925, tz: 'Asia/Riyadh'}, 'Mogadiscio': {lat: 2.0469, lon: 45.3182, tz: 'Africa/Mogadishu'}
  };
