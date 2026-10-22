import os,re,json,sys
# Aplică linia „Versiune · Ultima actualizare” în README-urile aplicațiilor (8 limbi) din <meta application-version / last-updated>.
# Rulare: python3 tools/ver.py [--apply]   (fără --apply doar numără). Rădăcina = 3 niveluri deasupra tools/ (sau FFF_ROOT=/cale).
# Așteaptă structura: <ROOT>/<depozit>/{README*.md,index.html} și <ROOT>/chiuta.github.io/apps/<aplicație>/...
ROOT=os.environ.get('FFF_ROOT') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
LAB={'en':('Version','Last updated'),'ro':('Versiune','Ultima actualizare'),'fr':('Version','Dernière mise à jour'),'it':('Versione','Ultimo aggiornamento'),'es':('Versión','Última actualización'),'pt':('Versão','Última atualização'),'de':('Version','Zuletzt aktualisiert'),'hu':('Verzió','Utolsó frissítés')}
ALLV='|'.join(re.escape(v[0]) for v in LAB.values())
def dirs():
    for d in sorted(os.listdir(ROOT)):
        p=f'{ROOT}/{d}'
        if d=='chiuta.github.io':
            for a in sorted(os.listdir(p+'/apps')):
                if os.path.isfile(f'{p}/apps/{a}/README.md'): yield f'{p}/apps/{a}'
        elif os.path.isfile(p+'/README.md'): yield p
def meta(d):
    if not os.path.exists(d+'/index.html'): return None,None
    t=open(d+'/index.html',encoding='utf8',errors='ignore').read()
    t=re.sub(r'<!--fff:kit:start.*?<!--fff:kit:end-->','',t,flags=re.S)
    v=re.search(r'<meta name="application-version" content="([^"]+)"',t)
    u=re.search(r'<meta name="last-updated" content="([^"]+)"',t)
    return (v and v.group(1)),(u and u.group(1))
apply='--apply' in sys.argv; miss=[];n=0
for d in dirs():
    v,u=meta(d)
    if not v or not u: miss.append((d.replace(ROOT+'/',''),v,u)); continue
    for l,(a,b) in LAB.items():
        f=d+('/README.md' if l=='en' else f'/README.{l}.md')
        if not os.path.exists(f): miss.append((f,'nofile',''));continue
        t=open(f,encoding='utf8').read()
        sp=' ' if l=='fr' else ''
        line=f'**{a}{sp}:** {v} · **{b}{sp}:** {u}'
        t2=re.sub(r'^\*\*(?:%s)\s?:\*\*[^\n]*·[^\n]*\n'%ALLV,'',t,flags=re.M)  # drop old version line(s)
        t2=re.sub(r'\n{3,}','\n\n',t2) if t2!=t else t2
        lines=t2.split('\n')
        i=next((k for k,x in enumerate(lines[:12]) if re.search(r'· \[|\*\*[A-Za-zăîâșțéç ]+\*\* ·',x) and 'README' in x),None)
        if i is None: miss.append((f,'nobar',''));continue
        lines[i+1:i+1]=['',line]
        out='\n'.join(lines)
        out=re.sub(r'\n{3,}','\n\n',out)
        if apply and out!=t: open(f,'w',encoding='utf8').write(out)
        n+= out!=t
print('modificate' if apply else 'de modificat',n); 
for m in miss: print('LIPSA',m)
