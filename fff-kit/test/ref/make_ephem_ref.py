#!/usr/bin/env python3
"""Generează test/ref/ephem-ref.json — valori de referință pentru test/ephem.test.mjs, calculate INDEPENDENT de codul JS:
  - poziții aparente (Soare, Lună, planete, Pluto): JPL DE421 (1900–2050) / DE423 (2050–2100) + ERFA (aberație, bias–precesie–nutație IAU 2006/2000A);
  - ΔT și timp sideral aparent: astropy + IERS (valori reale 1973–2026);
  - altitudine/azimut topocentrice, răsărit/apus/trecere/crepuscule (calcul propriu din DE421, vezi ephem_ref_lib.py);
  - momentele fazelor lunare (elongație ecliptică aparentă) din DE421;
  - eclipsa totală de Soare din 2 august 2027: elemente Besselian din DE421, contacte prin separare topocentrică (formulare diferită), puncte ale benzii.
Cerințe: pip install astropy pyerfa jplephem de421 de423 numpy (pachetele de421/de423 sunt în formatul vechi „jplephem 1.x”; dacă pip nu le poate instala, dezarhivați sdist-urile și
indicați directoarele prin EPHEM_DE_DIRS=cale1:cale2).  Rulare: node test/ref/dump_js_inputs.mjs > /tmp/js_inputs.json && python3 test/ref/make_ephem_ref.py /tmp/js_inputs.json
Durată: ~10–25 min (jplephem în Python pur)."""
import sys, os, json, math, time, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, erfa, warnings
warnings.filterwarnings('ignore')
import ephem_ref_lib as R
from astropy.time import Time

inp = json.load(open(sys.argv[1]))
out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ephem-ref.json')
rng = np.random.default_rng(20271014)
log = lambda *a: print(*a, file=sys.stderr, flush=True)
out = {'meta': {'generated': datetime.date.today().isoformat(), 'ephemerides': 'JPL DE421 (1900-2050), DE423 (2050-2100)', 'erfa': erfa.__version__,
                'note': 'referință independentă; vezi make_ephem_ref.py'}}

# 1. poziții aparente
names = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']
N = 240; a, b = 2415020.5, 2488069.5
pos = []
for i in range(N):
    tt = round(a + (b - a) * (i + rng.random()) / N, 6); row = {'tt': tt, 'src': 'de421' if R.de421_covers(tt) else 'de423'}
    for n in names:
        ra, dec, d, _ = R.apparent(n, tt, row['src']); row[n] = [round(ra, 7), round(dec, 7), round(d, 9)]
    pos.append(row)
out['positions'] = pos; log('poziții', len(pos))

# 2. ΔT real (IERS), 1973–2026, la 1 iulie și 1 ianuarie
dts = []
for y in range(1973, 2027):
    for mo in (1, 7):
        t = Time(f'{y}-{mo:02d}-01T00:00:00', scale='utc')
        dts.append({'jd': float(t.ut1.jd), 'deltaT': round(float(((t.tt.jd1 - t.ut1.jd1) + (t.tt.jd2 - t.ut1.jd2)) * 86400), 4)})
out['deltaT'] = dts

# 3. timp sideral aparent (ERFA gst06a) la momente 1975–2026
gs = []
for i in range(120):
    ut1 = float(2442413.5 + rng.random() * (2461041.5 - 2442413.5)); t = Time(ut1, format='jd', scale='ut1')
    tt = float(t.tt.jd); gs.append({'ut1': ut1, 'tt': tt, 'gast': R.gast_deg(ut1, tt)})
out['gast'] = gs

# 4. altitudine/azimut topocentrice
SITES = [('București', 44.4268, 26.1025, 2), ('Cluj-Napoca', 46.7712, 23.6236, 2), ('Reykjavik', 64.1466, -21.9426, 0), ('Sydney', -33.8688, 151.2093, 10), ('Quito', -0.1807, -78.4678, -5),
         ('Tromsø', 69.6492, 18.9553, 1), ('Honolulu', 21.3069, -157.8583, -10), ('Tokyo', 35.6762, 139.6503, 9), ('Cape Town', -33.9249, 18.4241, 2), ('New York', 40.7128, -74.0060, -5)]
hz = []
for i in range(100):
    s = SITES[int(rng.integers(len(SITES)))]; body = ['sun', 'moon', 'mars', 'jupiter', 'venus', 'saturn'][int(rng.integers(6))]
    ut1 = float(2451544.5 + rng.random() * (2461041.5 - 2451544.5)); t = Time(ut1, format='jd', scale='ut1'); tt = float(t.tt.jd)
    elev = float(rng.choice([0, 100, 800]))
    alt, az, sd = R.topo_altaz(body, tt, ut1, s[1], s[2], elev)
    hz.append({'site': s[0], 'lat': s[1], 'lon': s[2], 'elev': elev, 'body': body, 'ut1': ut1, 'tt': tt, 'alt': alt, 'az': az})
out['horizontal'] = hz; log('orizont', len(hz))

# 5. răsărit / apus / trecere / crepuscule
def find_events(body, lat, lon, tz, date_str, h0fun, step=10 / 1440.):
    y, m, d = map(int, date_str.split('-'))
    t0 = Time(f'{y}-{m:02d}-{d:02d}T00:00:00', scale='utc'); jd0 = float(t0.ut1.jd) - tz / 24.0   # începutul zilei civile locale (UT1≈UTC)
    t_mid = Time(jd0 + 0.5, format='jd', scale='ut1'); dT = float(((t_mid.tt.jd1 - t_mid.ut1.jd1) + (t_mid.tt.jd2 - t_mid.ut1.jd2)) * 86400)
    def g(ut1):
        alt, sd = R.topo_alt(body, ut1 + dT / 86400.0, ut1, lat, lon)
        return alt - h0fun(sd)
    n = int(round(1 / step)); ts = [jd0 + i * step for i in range(n + 1)]; gv = [g(t) for t in ts]
    rise = setv = None
    for i in range(n):
        if (gv[i] > 0) != (gv[i + 1] > 0):
            r = R._bisect(g, ts[i], ts[i + 1], 2e-9)
            if gv[i + 1] > 0 and rise is None: rise = r
            elif gv[i + 1] <= 0 and setv is None: setv = r
    return {'rise': rise, 'set': setv, 'dT': dT, 'jd0': jd0, 'status': ('normal' if (rise or setv) else ('alwaysUp' if gv[0] > 0 else 'alwaysDown'))}

def transit(body, lat, lon, tz, date_str):
    y, m, d = map(int, date_str.split('-'))
    t0 = Time(f'{y}-{m:02d}-{d:02d}T00:00:00', scale='utc'); jd0 = float(t0.ut1.jd) - tz / 24.0
    t_mid = Time(jd0 + 0.5, format='jd', scale='ut1'); dT = float(((t_mid.tt.jd1 - t_mid.ut1.jd1) + (t_mid.tt.jd2 - t_mid.ut1.jd2)) * 86400)
    def ha(ut1):
        tt = ut1 + dT / 86400.0; ra, dec, dd, w = R.apparent(body, tt)
        h = (R.gast_deg(ut1, tt) + lon - ra) % 360
        return h - 360 if h > 180 else h
    step = 30 / 1440.; ts = [jd0 + i * step for i in range(50)]; hv = [ha(t) for t in ts]
    for i in range(49):
        if hv[i] < 0 <= hv[i + 1] and abs(hv[i + 1] - hv[i]) < 120:
            r = R._bisect(ha, ts[i], ts[i + 1], 2e-9)
            if jd0 <= r < jd0 + 1: return r
    return None

DATES = ['2003-03-20', '2011-06-21', '2017-09-22', '2022-12-21', '2026-10-14']
rs = []
for s in SITES:
    for ds in DATES:
        row = {'site': s[0], 'lat': s[1], 'lon': s[2], 'tz': s[3], 'date': ds}
        sun_h0 = lambda sd: -(34 / 60.) - sd / 3600.0
        row['sun'] = find_events('sun', s[1], s[2], s[3], ds, sun_h0); row['sun']['transit'] = transit('sun', s[1], s[2], s[3], ds)
        row['moon'] = find_events('moon', s[1], s[2], s[3], ds, sun_h0); row['moon']['transit'] = transit('moon', s[1], s[2], s[3], ds)
        row['jupiter'] = find_events('jupiter', s[1], s[2], s[3], ds, lambda sd: -(34 / 60.)); row['jupiter']['transit'] = transit('jupiter', s[1], s[2], s[3], ds)
        row['venus'] = find_events('venus', s[1], s[2], s[3], ds, lambda sd: -(34 / 60.))
        for nm, h in (('civil', -6.0), ('nautical', -12.0), ('astronomical', -18.0)):
            row['tw_' + nm] = find_events('sun', s[1], s[2], s[3], ds, lambda sd, h=h: h, step=10 / 1440.)
        rs.append(row)
    log('răsărit/apus', s[0])
out['riseSet'] = rs

# 6. faze lunare
def elong(tt):
    return (R.ecl_lon_apparent('moon', tt) - R.ecl_lon_apparent('sun', tt)) % 360
def phase_time(tt0, target):
    t = tt0
    for _ in range(14):
        d = ((elong(t) - target + 180) % 360) - 180
        dt = -d / 12.190749; t += dt
        if abs(dt) < 1e-9: break
    return t
phs = []
for kind, tgt, off in (('new', 0, 0.0), ('first', 90, 0.25), ('full', 180, 0.5), ('last', 270, 0.75)):
    for kk in np.linspace(-1200, 1200, 28):
        k = math.floor(kk) + off
        jde = 2451550.09766 + 29.530588861 * k + 102.026 * 0  # aproximare Meeus 49.1 (suficientă ca punct de pornire)
        tt = phase_time(jde, tgt)
        if 2415500 < tt < 2487500: phs.append({'kind': kind, 'tt': tt})
out['phases'] = sorted(phs, key=lambda x: x['tt']); log('faze', len(phs))

# 7. eclipsa 2027
E = inp['eclipse']; dT = E['deltaT']; ttg = E['ttGreatest']
ecl = {'deltaT': dT, 'kPenumbra': R.KP, 'kUmbra': R.KU}
# 7a. elemente Besselian (DE421) în câteva momente
ecl['bessel'] = [dict(tt=t, **R.bessel_ref(t, dT)) for t in E['besselTimes']]
# 7b. maximul global (minim al x²+y²)
f = lambda tt: (lambda b: b['x'] ** 2 + b['y'] ** 2)(R.bessel_ref(tt, dT))
tg = R._golden(f, ttg - 0.02, ttg + 0.02, 1e-8); bg = R.bessel_ref(tg, dT)
ecl['greatest'] = {'tt': tg, 'ut': tg - dT / 86400.0, 'gamma': math.copysign(math.sqrt(bg['x'] ** 2 + bg['y'] ** 2), bg['y']), 'bessel': bg}
# 7c. circumstanțe locale
ecl['places'] = {}
for name, p in E['places'].items():
    t = time.time(); r = R.eclipse_local_ref(p['lat'], p['lon'], 0.0, dT, tg, src='de421'); ecl['places'][name] = dict(r, lat=p['lat'], lon=p['lon'])
    log('eclipsă', name, r['type'], round(time.time() - t, 1), 's')
# 7d. separarea la punctele benzii date de JS (la momentul respectiv): distanța centrelor și raza umbrei
ecl['pathChecks'] = []
for pc in E['pathPoints']:
    d, rs_, rm, alt, az, _ = R.topo_state(pc['tt'], dT, pc['lat'], pc['lon'], 0.0, R.KU, 'de421')
    ecl['pathChecks'].append({'kind': pc['kind'], 'tt': pc['tt'], 'sepArcsec': math.degrees(d) * 3600, 'umbraEdgeArcsec': math.degrees(rm - rs_) * 3600, 'sunAlt': alt})
out['eclipse'] = ecl

# 8. stele: poziții aparente (mișcare proprie + aberație + precesie–nutație), erfa.atci13 → RA față de echinocțiul adevărat = ri − eo
stars = []
for st in inp['stars']:
    for tt in inp['starTimes']:
        ri, di, eo = erfa.atci13(math.radians(st['ra']), math.radians(st['dec']), math.radians(st['pmRa'] / 3.6e6) / math.cos(math.radians(st['dec'])), math.radians(st['pmDec'] / 3.6e6),
                                 0.0, 0.0, 2400000.5, tt - 2400000.5)
        # NB: erfa așteaptă pr = dα/dt (rad/an, FĂRĂ cos δ) și pd = dδ/dt (rad/an)
        stars.append({'hip': st['hip'], 'tt': tt, 'ra': math.degrees(ri - eo) % 360, 'dec': math.degrees(di)})
out['stars'] = stars; log('stele', len(stars))

# 9. verificare încrucișată cu pyephem (libastro): poziții geocentrice aparente, mărimi, elongații, fază
try:
    import ephem
    pe = []
    nm = {'sun': ephem.Sun, 'moon': ephem.Moon, 'mercury': ephem.Mercury, 'venus': ephem.Venus, 'mars': ephem.Mars, 'jupiter': ephem.Jupiter, 'saturn': ephem.Saturn, 'uranus': ephem.Uranus, 'neptune': ephem.Neptune, 'pluto': ephem.Pluto}
    for i in range(40):
        ut = float(2451544.5 + rng.random() * (2462502.5 - 2451544.5)); dj = ut - 2415020.0
        row = {'ut1': ut}
        for k, cls in nm.items():
            b = cls(); b.compute(ephem.Date(dj), epoch=ephem.Date(dj))
            row[k] = {'ra': math.degrees(float(b.g_ra)), 'dec': math.degrees(float(b.g_dec)), 'mag': float(b.mag), 'elong': math.degrees(float(b.elong)) if k != 'sun' else 0.0,
                      'phase': float(b.phase) if k != 'sun' else 100.0, 'dist': float(b.earth_distance) if k != 'moon' else float(b.earth_distance)}
        pe.append(row)
    out['pyephem'] = {'version': ephem.__version__, 'rows': pe}; log('pyephem', len(pe))
except Exception as ex:
    log('pyephem indisponibil:', ex)
json.dump(out, open(out_path, 'w'), separators=(',', ':'), ensure_ascii=False)
log('scris', out_path, os.path.getsize(out_path), 'octeți')
