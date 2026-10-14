"""Referință independentă pentru FFF.ephem (nu depinde de codul JS).
Surse: JPL DE421 (pachetul PyPI „de421” 2008.1, citit cu jplephem; 1900–2050) și, pentru 2050–2100, JPL DE423 (pachetul „de423” 2010.1, 1800–2200);
ephemerida „builtin” din astropy (ERFA: epv00/plan94/moon98) e folosită doar ca verificare încrucișată.
Transformări: timp-lumină, aberație (erfa.ab) și matricea bias–precesie–nutație IAU 2006/2000A (erfa.pnm06a) → ecuator și echinocțiu adevărate ale datei.
Fără deflexie gravitațională (≤ 0,01″ în afara apropierii de limbul solar)."""
import os, sys, math, warnings
import numpy as np
import erfa
warnings.filterwarnings('ignore')

DE_DIRS = [d for d in os.environ.get('EPHEM_DE_DIRS', '').split(os.pathsep) if d]   # directoarele ce conțin pachetele de421/de423
C_KMDAY = 299792.458 * 86400.0
AU = 149597870.7
_E = {}
EMRAT = 81.3005690699153

def _eph(which):
    if which not in _E:
        for d in DE_DIRS:
            if d not in sys.path: sys.path.insert(0, d)
        import importlib
        from jplephem import Ephemeris
        _E[which] = Ephemeris(importlib.import_module(which))
    return _E[which]

def de421_covers(tt):
    return 2414992.5 + 2 <= tt <= 2433282.5 + 0 + (2469807.5 - 2433282.5) - 2   # 1899-08 … 2053-10 (DE421: 2414992.5 – 2470000)

# ---- poziții barycentrice (km) și viteze (km/zi) -------------------------------------
def _bary_de(name, tt, which):
    e = _eph(which)
    if name == 'earth':
        p, v = e.position_and_velocity('earthmoon', tt); pm, vm = e.position_and_velocity('moon', tt)
        return (p - pm / (1 + EMRAT)).ravel(), (v - vm / (1 + EMRAT)).ravel()
    if name == 'moon':
        p, v = e.position_and_velocity('earthmoon', tt); pm, vm = e.position_and_velocity('moon', tt)
        return (p + pm * EMRAT / (1 + EMRAT)).ravel(), (v + vm * EMRAT / (1 + EMRAT)).ravel()
    p, v = e.position_and_velocity(name, tt)
    return p.ravel(), v.ravel()

def _bary_builtin(name, tt):
    from astropy.time import Time
    from astropy.coordinates import get_body_barycentric_posvel, solar_system_ephemeris
    t = Time(tt, format='jd', scale='tt')
    with solar_system_ephemeris.set('builtin'):
        p, v = get_body_barycentric_posvel(name, t)
    return p.xyz.to('km').value, v.xyz.to('km/day').value

def bary(name, tt, src):
    return (_bary_builtin(name, tt) if src == 'builtin' else _bary_de(name, tt, src))

def apparent(name, tt, src=None):
    """(ra°, dec°, dist UA, vector unitar GCRS aparent) pentru corpul `name` la tt (JD TT)."""
    if src is None: src = 'de421' if de421_covers(tt) else 'de423'
    E, vE = bary('earth', tt, src)
    tau = 0.0
    for _ in range(5):
        X, _v = bary(name, tt - tau, src)
        g = X - E; d = np.linalg.norm(g); tau = d / C_KMDAY
    u = g / d
    sun_p, _ = bary('sun', tt, src)
    s_au = np.linalg.norm(E - sun_p) / AU
    vc = vE / C_KMDAY
    bm1 = math.sqrt(1 - vc @ vc)
    up = erfa.ab(u, vc, s_au, bm1)
    r = erfa.pnm06a(2400000.5, tt - 2400000.5)
    w = r @ up
    ra = math.degrees(math.atan2(w[1], w[0])) % 360; dec = math.degrees(math.asin(w[2]))
    return ra, dec, d / AU, w

def sep_arcsec(ra1, dec1, ra2, dec2):
    a = np.radians([ra1, dec1, ra2, dec2])
    c = math.sin(a[1]) * math.sin(a[3]) + math.cos(a[1]) * math.cos(a[3]) * math.cos(a[0] - a[2])
    # formă stabilă
    dl = a[2] - a[0]
    y = math.hypot(math.cos(a[3]) * math.sin(dl), math.cos(a[1]) * math.sin(a[3]) - math.sin(a[1]) * math.cos(a[3]) * math.cos(dl))
    return math.degrees(math.atan2(y, c)) * 3600

# ---- orizont ---------------------------------------------------------------------------
def gast_deg(ut1_jd, tt_jd):
    return math.degrees(erfa.gst06a(2400000.5, ut1_jd - 2400000.5, 2400000.5, tt_jd - 2400000.5)) % 360

def topo_altaz(name, tt, ut1, lat, lon, elev=0.0, src=None):
    """Altitudine geometrică (fără refracție) și azimut (de la nord spre est) ale CENTRULUI, topocentrice: paralaxă aplicată vectorial (observator WGS84),
    apoi aberație și rotația bias–precesie–nutație; plus raza unghiulară (arcsec) pentru Soare/Lună."""
    if src is None: src = 'de421' if de421_covers(tt) else 'de423'
    O, r = observer_gcrs(tt, ut1, lat, lon, elev)
    g, vE, E = astrometric_vec(name, tt, src)
    t = g - O; n = np.linalg.norm(t)
    sun_p, _ = bary('sun', tt, src); s_au = np.linalg.norm(E - sun_p) / AU; vc = vE / C_KMDAY; bm1 = math.sqrt(1 - vc @ vc)
    w = r @ erfa.ab(t / n, vc, s_au, bm1)
    phi = math.radians(lat); last = math.radians(gast_deg(ut1, tt) + lon)
    up = np.array([math.cos(phi) * math.cos(last), math.cos(phi) * math.sin(last), math.sin(phi)])
    east = np.array([-math.sin(last), math.cos(last), 0.0]); north = np.cross(up, east)
    alt = math.degrees(math.asin(float(w @ up))); az = math.degrees(math.atan2(float(w @ east), float(w @ north))) % 360
    sd = 0.0
    if name == 'sun': sd = math.degrees(math.asin(696000.0 / n)) * 3600
    if name == 'moon': sd = math.degrees(math.asin(1737.4 / n)) * 3600
    return alt, az, sd

def topo_alt(name, tt, ut1, lat, lon, elev=0.0, src=None):
    a, z, sd = topo_altaz(name, tt, ut1, lat, lon, elev, src)
    return a, sd

def ecl_lon_apparent(name, tt):
    ra, dec, d, w = apparent(name, tt)
    eps = erfa.obl06(2400000.5, tt - 2400000.5)
    # eps adevărat = mediu + Δε
    dpsi, deps = erfa.nut06a(2400000.5, tt - 2400000.5)
    eps = eps + deps
    y = w[1] * math.cos(eps) + w[2] * math.sin(eps); x = w[0]
    return math.degrees(math.atan2(y, x)) % 360

# ======================= Eclipsa: circumstanțe locale prin separare topocentrică (formulare diferită de planul Besselian) =======================
def astrometric_vec(name, tt, src):
    """Vector geocentric GCRS (km) al corpului, cu timp-lumină, fără aberație."""
    E, vE = bary('earth', tt, src); tau = 0.0
    for _ in range(5):
        X, _v = bary(name, tt - tau, src); g = X - E; tau = np.linalg.norm(g) / C_KMDAY
    return g, vE, E

def observer_gcrs(tt, ut1, lat, lon, elev):
    phi = math.radians(lat); f = 1 / 298.257223563; a = 6378.137
    e2 = 2 * f - f * f; N = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    x = (N + elev / 1000) * math.cos(phi); z = (N * (1 - e2) + elev / 1000) * math.sin(phi)
    last = math.radians(gast_deg(ut1, tt) + lon)
    O = np.array([x * math.cos(last), x * math.sin(last), z])
    r = erfa.pnm06a(2400000.5, tt - 2400000.5)
    return r.T @ O, r

KP, KU = 0.2725076, 0.272281   # raza Lunii/Re: penumbră (IAU 1976) și umbră (convenția NASA/Espenak)

def topo_state(tt, dt, lat, lon, elev, k, src, rsun_km=696000.0):
    ut1 = tt - dt / 86400.0
    O, r = observer_gcrs(tt, ut1, lat, lon, elev)
    gs, vE, E = astrometric_vec('sun', tt, src); gm, _, _ = astrometric_vec('moon', tt, src)
    ts, tm = gs - O, gm - O
    sun_p, _ = bary('sun', tt, src)
    s_au = np.linalg.norm(E - sun_p) / AU; vc = vE / C_KMDAY; bm1 = math.sqrt(1 - vc @ vc)
    us = erfa.ab(ts / np.linalg.norm(ts), vc, s_au, bm1); um = erfa.ab(tm / np.linalg.norm(tm), vc, s_au, bm1)
    cr = np.linalg.norm(np.cross(us, um)); dd = float(us @ um)
    d = math.atan2(cr, dd)
    rs = math.asin(rsun_km / np.linalg.norm(ts)); rm = math.asin(k * 6378.137 / np.linalg.norm(tm))
    # altitudine/azimut geometric al Soarelui (direcția aberată, în echinocțiul adevărat al datei)
    w = r @ us
    phi = math.radians(lat); last = math.radians(gast_deg(ut1, tt) + lon)
    up = np.array([math.cos(phi) * math.cos(last), math.cos(phi) * math.sin(last), math.sin(phi)])
    east = np.array([-math.sin(last), math.cos(last), 0.0]); north = np.cross(up, east)
    alt = math.degrees(math.asin(float(w @ up))); az = math.degrees(math.atan2(float(w @ east), float(w @ north))) % 360
    return d, rs, rm, alt, az, 0.0

def _lens(r1, r2, d):
    if d >= r1 + r2: return 0.0
    if d <= abs(r1 - r2): return math.pi * min(r1, r2) ** 2
    a1 = math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1)); a2 = math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2))
    return r1 * r1 * (a1 - math.sin(2 * a1) / 2) + r2 * r2 * (a2 - math.sin(2 * a2) / 2)

def _bisect(f, a, b, tol=2e-9):
    fa = f(a)
    for _ in range(80):
        m = 0.5 * (a + b); fm = f(m)
        if (fm > 0) == (fa > 0): a, fa = m, fm
        else: b = m
        if b - a < tol: break
    return 0.5 * (a + b)

def _golden(f, a, b, tol=1e-8):
    tol = max(tol, 3e-9)   # JD ≈ 2,4e6 are rezoluție de ~5e-10 zile; fără plafon bucla ar putea să nu se oprească
    gr = (math.sqrt(5) - 1) / 2; c = b - gr * (b - a); d = a + gr * (b - a); fc = f(c); fd = f(d)
    for _ in range(200):
        if b - a <= tol: break
        if fc < fd: b, d, fd = d, c, fc; c = b - gr * (b - a); fc = f(c)
        else: a, c, fc = c, d, fd; d = a + gr * (b - a); fd = f(d)
    return 0.5 * (a + b)

def eclipse_local_ref(lat, lon, elev, dt, tt_guess, src='de421'):
    """Contacte (JD TT), magnitudine, obscurare — prin separarea unghiulară topocentrică a centrelor Soare–Lună.
    Penumbră/partial: raza Lunii cu k = 0,2725076; totalitate (C2/C3, durată, raport diametre): k = 0,272281 (convenția NASA)."""
    S = lambda tt: topo_state(tt, dt, lat, lon, elev, KP, src)
    lo, hi = tt_guess - 0.17, tt_guess + 0.17; n = int((hi - lo) * 720)
    ts = [lo + i * (hi - lo) / n for i in range(n + 1)]
    fs = []
    for t in ts:
        s_ = S(t); fs.append(s_[0] - (s_[1] + s_[2]))
    imin = int(np.argmin(fs))
    if fs[imin] >= 0: return {'type': 'none'}
    sepf = lambda tt: S(tt)[0]
    tmax = _golden(sepf, ts[max(0, imin - 1)], ts[min(n, imin + 1)], 1e-8)
    d, rs, rm, alt, az, _ = S(tmax)
    f1 = lambda t: (lambda q: q[0] - (q[1] + q[2]))(S(t))
    j = imin
    while j > 0 and fs[j] < 0: j -= 1
    t1 = _bisect(f1, ts[j], ts[j + 1])
    j = imin
    while j < n and fs[j] < 0: j += 1
    t4 = _bisect(f1, ts[j - 1], ts[j])
    out = {'type': 'partial', 'tmax': tmax, 't1': t1, 't4': t4, 'sunAlt': alt, 'sunAz': az}
    out['magnitudeFraction'] = (rs + rm - d) / (2 * rs); out['obscuration'] = min(1.0, _lens(rs, rm, d) / (math.pi * rs * rs))
    Su = lambda tt: topo_state(tt, dt, lat, lon, elev, KU, src)
    du, rsu, rmu, _, _, _ = Su(tmax)
    out['ratio'] = rmu / rsu
    if du < rmu - rsu:
        out['type'] = 'total'
        f2 = lambda t: (lambda q: q[0] - (q[2] - q[1]))(Su(t))
        out['t2'] = _bisect(f2, t1, tmax); out['t3'] = _bisect(f2, tmax, t4)
        out['magnitude'] = rmu / rsu
    else: out['magnitude'] = out['magnitudeFraction']
    return out

def bessel_ref(tt, dt, src='de421', rsun_km=696000.0):
    """Elemente Besselian din DE421 (aceleași formule geometrice ca în JS, alte efemeride): x, y, d, μ, l1 (kp), l2 (ku), tanf1 (kp), tanf2 (ku)."""
    gs, vE, E = astrometric_vec('sun', tt, src); gm, _, _ = astrometric_vec('moon', tt, src)
    sun_p, _ = bary('sun', tt, src); s_au = np.linalg.norm(E - sun_p) / AU; vc = vE / C_KMDAY; bm1 = math.sqrt(1 - vc @ vc)
    r = erfa.pnm06a(2400000.5, tt - 2400000.5)
    S = r @ (erfa.ab(gs / np.linalg.norm(gs), vc, s_au, bm1) * np.linalg.norm(gs)); M = r @ (erfa.ab(gm / np.linalg.norm(gm), vc, s_au, bm1) * np.linalg.norm(gm))
    g = S - M; D = np.linalg.norm(g); z = g / D; a = math.atan2(z[1], z[0]); d = math.asin(z[2])
    ex = np.array([-math.sin(a), math.cos(a), 0.0]); ey = np.array([-math.sin(d) * math.cos(a), -math.sin(d) * math.sin(a), math.cos(d)])
    Re = 6378.137
    x = (M @ ex) / Re; y = (M @ ey) / Re; zm = (M @ z) / Re
    def cone(k):
        sf1 = (rsun_km + k * Re) / D; sf2 = (rsun_km - k * Re) / D; c1 = math.sqrt(1 - sf1 ** 2); c2 = math.sqrt(1 - sf2 ** 2)
        return sf1 / c1, sf2 / c2, zm * sf1 / c1 + k / c1, zm * sf2 / c2 - k / c2
    tf1, _, l1, _ = cone(KP); _, tf2, _, l2 = cone(KU)
    ut1 = tt - dt / 86400.0
    mu = (math.radians(gast_deg(ut1, tt)) - a) % (2 * math.pi)
    return {'x': x, 'y': y, 'd': math.degrees(d), 'mu': math.degrees(mu), 'l1': l1, 'l2': l2, 'tanf1': tf1, 'tanf2': tf2}
