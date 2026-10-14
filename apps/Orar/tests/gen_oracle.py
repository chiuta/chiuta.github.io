# Generează tests/oracle_rrule.json și tests/oracle_easter.json cu python-dateutil (parser independent de aplicație).
# Rulare (opțional, fișierele JSON sunt deja incluse): python3 gen_oracle.py  [cere: pip install python-dateutil]
# Regula RFC 5545: DTSTART este prima apariție; cazurile cu COUNT în care DTSTART nu se potrivește regulii sunt omise.
import random, json, sys
from datetime import datetime, date, timedelta
from dateutil.rrule import rrulestr
random.seed(20261014)
DAYS=['MO','TU','WE','TH','FR','SA','SU']
cases=[]
def rnd_date():
    y=random.choice([2023,2024,2025,2026,2027,2028]); m=random.randint(1,12)
    d=random.choice([1,15,28,29,30,31,random.randint(1,31)])
    while True:
        try: return date(y,m,d)
        except ValueError: d-=1
tries=0
while len(cases)<700 and tries<20000:
    tries+=1
    freq=random.choice(['DAILY','WEEKLY','MONTHLY','YEARLY'])
    st=rnd_date()
    parts=['FREQ='+freq]
    if random.random()<0.4: parts.append('INTERVAL=%d'%random.randint(2,5))
    if freq=='DAILY' and random.random()<0.3: parts.append('BYDAY='+','.join(random.sample(DAYS,random.randint(1,5))))
    if freq=='WEEKLY' and random.random()<0.8: parts.append('BYDAY='+','.join(random.sample(DAYS,random.randint(1,4))))
    if freq=='WEEKLY' and random.random()<0.3: parts.append('WKST='+random.choice(['SU','MO','SA']))
    if freq=='MONTHLY':
        r=random.random()
        if r<0.3: parts.append('BYMONTHDAY='+','.join(str(x) for x in random.sample([1,5,15,28,29,30,31,-1,-2],random.randint(1,3))))
        elif r<0.7: parts.append('BYDAY='+random.choice(['1','2','3','4','-1','-2','+1','+3'])+random.choice(DAYS))
        elif r<0.8: parts.append('BYDAY='+','.join(random.sample(DAYS,2)))
        elif r<0.9: parts.append('BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1')
    if freq=='YEARLY':
        r=random.random()
        if r<0.3: parts.append('BYMONTH=%d'%random.randint(1,12)); parts.append('BYDAY='+random.choice(['1','2','-1','3'])+random.choice(DAYS))
        elif r<0.5: parts.append('BYMONTH='+','.join(str(x) for x in sorted(random.sample(range(1,13),2)))); parts.append('BYMONTHDAY=%d'%random.choice([1,15,31,-1]))
        elif r<0.6: parts.append('BYDAY=20'+random.choice(DAYS))
    endr=random.random()
    if endr<0.35: parts.append('COUNT=%d'%random.randint(1,25))
    elif endr<0.65: parts.append('UNTIL=%s'%(st+timedelta(days=random.randint(0,900))).strftime('%Y%m%d'))
    rule=';'.join(parts)
    dt=datetime(st.year,st.month,st.day,9,0)
    try: rr=rrulestr(rule.replace('UNTIL=%s'%'', ''), dtstart=dt)
    except Exception as e:
        # UNTIL date-only with datetime dtstart: dateutil wants datetime
        rule2=rule
        import re
        rule2=re.sub(r'UNTIL=(\d{8})',r'UNTIL=\1T235959',rule)
        try: rr=rrulestr(rule2,dtstart=dt)
        except Exception as e2: continue
    import re
    rr=rrulestr(re.sub(r'UNTIL=(\d{8})(?!T)',r'UNTIL=\1T235959',rule),dtstart=dt)
    lo=dt; hi=dt+timedelta(days=random.choice([60,400,1500]))
    f=dt+timedelta(days=random.choice([0,0,30,200,700]))
    got=[x.date() for x in rr.between(f,hi,inc=True)]
    try: first=rr[0]
    except IndexError: first=None
    matches = first is not None and first.date()==st
    if 'COUNT=' in rule and not matches: continue
    # dtstart is always included (RFC 5545) -> add when in window and not present
    exp=set(got)
    if f<=dt<=hi: exp.add(st)
    cases.append({'rule':rule,'start':st.isoformat(),'from':f.date().isoformat(),'to':hi.date().isoformat(),'exp':sorted(d.isoformat() for d in exp)})
json.dump(cases,open('oracle_rrule.json','w'),separators=(',',':'))
print(len(cases))

from dateutil.easter import easter, EASTER_ORTHODOX
json.dump({str(y):easter(y,EASTER_ORTHODOX).isoformat() for y in range(1950,2101)},open('oracle_easter.json','w'),separators=(',',':'))
