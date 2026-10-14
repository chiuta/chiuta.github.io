# Verificare independentă a unui fișier .ics exportat de Orar, cu `icalendar` + `python-dateutil` (BSD).
# Folosire: python3 ics_check.py fisier.ics 2026-10-01 2027-03-31   -> JSON pe stdout
#   * validează fiecare VTIMEZONE (decalajele din fus comparate cu zoneinfo în intervalul cerut)
#   * extinde RRULE/EXDATE/RECURRENCE-ID cu dateutil și întoarce aparițiile pe UID
# Dacă `icalendar` nu e instalat, scriptul iese cu codul 3 (testul din test.mjs sare peste această parte).
import sys, json, re
from datetime import datetime, date, time, timedelta, timezone
try:
    from icalendar import Calendar
    from dateutil.rrule import rrulestr
except ImportError:
    sys.exit(3)
import zoneinfo

path, d0, d1 = sys.argv[1], sys.argv[2], sys.argv[3]
lo = datetime.fromisoformat(d0).replace(tzinfo=None)
hi = datetime.fromisoformat(d1).replace(tzinfo=None) + timedelta(days=1)
cal = Calendar.from_ical(open(path, 'rb').read())
out = {'vtz': [], 'events': {}, 'count': 0}

for tzc in cal.walk('VTIMEZONE'):
    tzid = str(tzc['TZID'])
    try:
        tz = tzc.to_tz()
    except Exception as e:
        out['vtz'].append({'tzid': tzid, 'error': 'to_tz: ' + str(e)})
        continue
    zi = zoneinfo.ZoneInfo(tzid)
    bad, n = [], 0
    t = datetime.fromisoformat(d0).replace(tzinfo=timezone.utc)
    end = datetime.fromisoformat(d1).replace(tzinfo=timezone.utc)
    while t < end:
        n += 1
        a = t.astimezone(tz).utcoffset()
        b = t.astimezone(zi).utcoffset()
        if a != b:
            bad.append(t.isoformat())
        t += timedelta(hours=7)
    out['vtz'].append({'tzid': tzid, 'samples': n, 'mismatches': len(bad), 'first': bad[:3]})


def to_utc_iso(v):
    if isinstance(v, datetime):
        if v.tzinfo is None:
            return v.strftime('%Y-%m-%dT%H:%M') + 'F'  # flotant
        return v.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%MZ')
    return v.isoformat()  # data


def dts(prop):
    if prop is None:
        return []
    items = prop if isinstance(prop, list) else [prop]
    res = []
    for it in items:
        for x in it.dts:
            res.append(x.dt)
    return res


masters, overrides = {}, []
for ev in cal.walk('VEVENT'):
    out['count'] += 1
    if ev.get('RECURRENCE-ID') is not None:
        overrides.append(ev)
    else:
        masters.setdefault(str(ev['UID']), []).append(ev)

for uid, evs in masters.items():
    ev = evs[0]
    st = ev['DTSTART'].dt
    allday = not isinstance(st, datetime)
    st_dt = datetime.combine(st, time(0, 0)) if allday else st
    rr = ev.get('RRULE')
    ex = set()
    for x in dts(ev.get('EXDATE')):
        ex.add(to_utc_iso(x if isinstance(x, datetime) else datetime.combine(x, time(0, 0))))
    insts = []
    if rr is not None:
        rule = rr.to_ical().decode()
        if allday:
            rule = re.sub(r'UNTIL=(\d{8})(?!T)', r'UNTIL=\1T235959', rule)
        elif st_dt.tzinfo is None:
            rule = re.sub(r'UNTIL=(\d{8})(?!T)', r'UNTIL=\1T235959', rule)
        r = rrulestr(rule, dtstart=st_dt)
        lo_c = lo.replace(tzinfo=st_dt.tzinfo) if st_dt.tzinfo else lo
        hi_c = hi.replace(tzinfo=st_dt.tzinfo) if st_dt.tzinfo else hi
        insts = [x for x in r.between(lo_c - timedelta(days=2), hi_c, inc=True)]
        if lo_c - timedelta(days=2) <= st_dt <= hi_c and st_dt not in insts:
            insts.append(st_dt)
    else:
        insts = [st_dt]
    for x in dts(ev.get('RDATE')):
        if isinstance(x, tuple):
            x = x[0]
        x = x if isinstance(x, datetime) else datetime.combine(x, time(0, 0))
        if x not in insts:
            insts.append(x)
    keyed = {}
    for i in insts:
        if allday:
            k = i.date().isoformat()
        else:
            k = to_utc_iso(i)
        if k in ex or (allday and (k + 'T00:00F') in ex):
            continue
        keyed[k] = i
    out['events'][uid] = {'summary': str(ev.get('SUMMARY', '')), 'keyed': keyed, 'allday': allday, 'floating': (not allday and st_dt.tzinfo is None)}

for ov in overrides:
    uid = str(ov['UID'])
    rid = ov['RECURRENCE-ID'].dt
    ridk = rid.isoformat() if not isinstance(rid, datetime) else to_utc_iso(rid)
    if uid in out['events']:
        m = out['events'][uid]
        m['keyed'].pop(ridk, None)
        ns = ov['DTSTART'].dt
        k = ns.isoformat() if not isinstance(ns, datetime) else to_utc_iso(ns)
        m['keyed'][k] = ns

final = {}
for uid, m in out['events'].items():
    ks = []
    for k, v in m['keyed'].items():
        vv = v if isinstance(v, datetime) else datetime.combine(v, time(0, 0))
        naive = vv.replace(tzinfo=None) if vv.tzinfo is None else vv.astimezone(timezone.utc).replace(tzinfo=None)
        if lo <= naive < hi:
            ks.append(k)
    final[uid] = {'summary': m['summary'], 'starts': sorted(ks), 'allday': m['allday'], 'floating': m['floating']}
out['events'] = final
print(json.dumps(out))
