import os,re,sys
sys.argv_=sys.argv
# Adaugă linia „Limbile interfeței” în README-uri (refolosește funcțiile din ver.py). Rulare: python3 tools/lang.py [--apply]
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'ver.py'),encoding='utf8').read().split("apply='--apply'")[0])
LBL={'en':'Interface languages','ro':'Limbile interfeței','fr':"Langues de l'interface",'it':"Lingue dell'interfaccia",'es':'Idiomas de la interfaz','pt':'Idiomas da interface','de':'Oberflächensprachen','hu':'A felület nyelvei'}
NAMES='**Română, English, Français, Italiano, Español, Português (PT), Deutsch, Magyar**'
SKIP={'OmniHost','AI-Liber','FreeDetect'}
apply='--apply' in sys.argv; n=0
for d in dirs():
    if os.path.basename(d) in SKIP: continue
    for l in LBL:
        f=d+('/README.md' if l=='en' else f'/README.{l}.md')
        if not os.path.exists(f): continue
        t=open(f,encoding='utf8').read()
        if re.search(r'^(?:%s)\s?:'%'|'.join(re.escape(x) for x in LBL.values()),t,flags=re.M): continue
        sp=' ' if l=='fr' else ''
        lines=t.split('\n')
        i=next((k for k,x in enumerate(lines[:14]) if re.match(r'\*\*(?:%s)\s?:\*\*'%ALLV,x)),None)
        if i is None: print('fara versiune',f); continue
        lines[i+1:i+1]=['',f'{LBL[l]}{sp}: {NAMES}']
        out=re.sub(r'\n{3,}','\n\n','\n'.join(lines))
        if apply: open(f,'w',encoding='utf8').write(out)
        n+=1
print(n)
