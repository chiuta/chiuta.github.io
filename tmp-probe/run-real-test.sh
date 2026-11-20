#!/usr/bin/env bash
# Sondă temporară: rulează testul real fff-r8 al AI-Liber cu fiecare mesaj de consolă etichetat (pas + locație).
set -u
APP="$1"
cp "$APP/tests/fff-r8.test.mjs" "$APP/tests/fff-r8.probe.mjs"
python3 - "$APP/tests/fff-r8.probe.mjs" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
a="let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;} else {fail++; console.log('FAIL:',m);} };"
assert a in s
s=s.replace(a,"let pass=0,fail=0; const ok=(c,m)=>{ globalThis.__st=String(m).slice(0,70); if(c){pass++;} else {fail++; console.log('FAIL:',m);} };")
b="p.on('console',m=>{ if(m.type()==='error'||/Content Security/i.test(m.text())) errs.push('console '+m.text()); });"
assert b in s
s=s.replace(b,"p.on('console',m=>{ const L=m.location(); console.log('[console]',m.type(),JSON.stringify(m.text()).replace(/sha256-[A-Za-z0-9+\\/=]+/g,'h').slice(0,230),'@'+String(L.url).slice(-60)+':'+L.lineNumber+':'+L.columnNumber,'| după ok:',globalThis.__st); if(m.type()==='error'||/Content Security/i.test(m.text())) errs.push('console '+m.text()); });")
open(p,'w',encoding='utf-8').write(s)
PY
node "$APP/tests/fff-r8.probe.mjs" 2>&1 | tail -n 80
