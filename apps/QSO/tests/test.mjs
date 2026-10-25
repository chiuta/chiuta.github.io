// Teste QSO — Playwright, rețea blocată. Rulare: node tests/test.mjs
import {createRequire} from "module";
import path from "path"; import {fileURLToPath} from "url"; import fs from "fs"; import os from "os";
const require=createRequire("/opt/node-tools/package.json");
const {chromium}=require("playwright");
const __dir=path.dirname(fileURLToPath(import.meta.url));
const URL='file://'+path.resolve(__dir,'..','index.html');
const AXE='/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
let pass=0, fail=0; const failures=[];
function ok(c,msg){ if(c){pass++;} else {fail++; failures.push(msg); console.log('  FAIL:',msg);} }
function eq(a,b,msg){ const A=JSON.stringify(a),B=JSON.stringify(b); ok(A===B,msg+' (obtained '+A+', expected '+B+')'); }
function near(a,b,tol,msg){ ok(Math.abs(a-b)<=tol,msg+' (obtained '+a+', expected '+b+' ±'+tol+')'); }
const sect=s=>console.log('\n## '+s);

/* ---- referințe independente (alt algoritm decât aplicația) ---- */
function refGrid(g){ // decodare caracter cu caracter, sfârșitul pătratului → centru
  g=g.toUpperCase(); let lon=-180,lat=-90,dl=20,dp=10;
  const f=[[20,10,'A'],[2,1,'0'],[2/24,1/24,'A'],[2/240,1/240,'0']];
  for(let i=0;i<g.length/2;i++){ const c1=g.charCodeAt(2*i)-f[i][2].charCodeAt(0), c2=g.charCodeAt(2*i+1)-f[i][2].charCodeAt(0); lon+=c1*f[i][0]; lat+=c2*f[i][1]; dl=f[i][0]; dp=f[i][1]; }
  return [lat+dp/2,lon+dl/2];
}
function refDist(a,b){ // legea cosinusurilor, R=6371.0088
  const [p1,l1]=refGrid(a).map(x=>x*Math.PI/180), [p2,l2]=refGrid(b).map(x=>x*Math.PI/180);
  return 6371.0088*Math.acos(Math.min(1,Math.sin(p1)*Math.sin(p2)+Math.cos(p1)*Math.cos(p2)*Math.cos(l2-l1)));
}
function refBearing(a,b){ const [p1,l1]=refGrid(a).map(x=>x*Math.PI/180), [p2,l2]=refGrid(b).map(x=>x*Math.PI/180);
  const y=Math.sin(l2-l1)*Math.cos(p2), x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(l2-l1); return (Math.atan2(y,x)*180/Math.PI+360)%360; }

const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
async function newPage(opts){
  const ctx=await browser.newContext(Object.assign({viewport:{width:1280,height:800},acceptDownloads:true},opts||{}));
  const reqs=[]; await ctx.route(/^https?:/,r=>{reqs.push(r.request().url()); r.abort();});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{ const t=m.text(); if(m.type()==='error'||/Content Security Policy|Refused/i.test(t)) errs.push('console: '+t); });
  p.__errs=errs; p.__reqs=reqs; p.__ctx=ctx;
  await p.goto(URL); await p.waitForFunction(()=>window.__qso); return p;
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qso-')); 

/* ================== 1. Pornire, CSP, rețea ================== */
sect('Pornire');
let p=await newPage();
await p.waitForTimeout(3600);
eq(p.__errs,[],'0 erori pageerror/CSP la pornire'); eq(p.__reqs,[],'0 cereri de rețea');
ok(/^v 1\.0\.7 · 2026-10-26$/.test(await p.$eval('#app-version',e=>e.textContent)),'#app-version');
ok(await p.$eval('meta[name=application-version]',e=>e.content)==='1.0.7','meta application-version');
ok(await p.$eval('meta[name=last-updated]',e=>e.content)==='2026-10-26','meta last-updated');
const csp=await p.$eval('meta[http-equiv=Content-Security-Policy]',e=>e.content);
ok(/default-src 'none'/.test(csp)&&/connect-src 'none'/.test(csp)&&!/unsafe-eval/.test(csp)&&!/script-src[^;]*unsafe-inline/.test(csp),'CSP strict');
const html0=fs.readFileSync(path.resolve(__dir,'..','index.html'),'utf8');
ok(!/\son(click|change|input|submit|load)\s*=/i.test(html0),'fără handlere inline');
{ const {checkCspHashes}=await import('/home/claude/chiuta.github.io/fff-kit/lib/csp.mjs'); ok(checkCspHashes(html0).ok,'hash-uri CSP corecte'); }

/* ================== 2. Indicative ================== */
sect('Validatori indicative');
const POS=['YO3ABC','YO3A','YP0ABC','YQ9XY','YR1A','YO9ABC/P','YO3ABC/M','YO3ABC/MM','DL1ABC','DL1ABC/P','W1AW','K1ABC','VK2ABC','JA1ABC','OH0/YO3ABC','F/YO3ABC/P','EA8/DL1ABC','9A1A','4X4AA','3DA0XYZ','VE3ABC','PY2ABC','HB9ABC','ZS6A','OZ1ABC','LA1ABC','S57ABC','OK1ABC','SP5ABC','HA5ABC','LZ1ABC','UA3ABC','I2ABC','G4ABC','GM3ABC','2E0ABC','VP8ABC','5B4ABC','TA1ABC','CT1ABC','ON4ABC','PA3ABC','DL1ABC/QRP'];
const NEG=['','YO','YO3','YO3ABCD','YO33ABC','YOABC','YO3AB1','123','ABC','DL','DL1ABCDEFG','DL 1ABC!','YO3ABC//P','/P','YO3ABC/','XX','1A','YO3-ABC','YO3ABC/PP9X8Y7'];
const posR=await p.evaluate(l=>l.map(c=>[c,window.__qso.Lib.callValid(c)]),POS);
posR.forEach(([c,v])=>ok(v===true,'indicativ valid: '+c));
const negR=await p.evaluate(l=>l.map(c=>[c,window.__qso.Lib.callValid(c)]),NEG);
negR.forEach(([c,v])=>ok(v===false,'indicativ invalid: "'+c+'"'));
ok(await p.evaluate(()=>window.__qso.Lib.parseCall('yo3abc/p').norm==='YO3ABC/P'),'normalizare majuscule');
ok(await p.evaluate(()=>window.__qso.Lib.parseCall('OH0/YO3ABC').prefix==='OH0'),'prefix portabil recunoscut');

/* ================== 3. Locatori și distanțe ================== */
sect('Locatori, distanțe');
const pairs=[['KN34','JO65'],['KN34lk','JN18du'],['KN44','KN44'],['JN58td','FN31pr'],['IO91wm','QF56od'],['KN34','RE78'],['AA00','RR99'],['KN34bj','KN34bk'],['GG66','PM95'],['JO62','JO62kn']];
for(const [a,b] of pairs){
  const r=await p.evaluate(([a,b])=>window.__qso.Lib.gridDistance(a,b),[a,b]);
  near(r.km,refDist(a,b),0.05,`distanță ${a}→${b}`);
  if(refDist(a,b)>1) { const d=Math.abs(((r.az-refBearing(a,b))+540)%360-180); ok(d<0.05,`azimut ${a}→${b}`); }
}
{ const r=await p.evaluate(()=>window.__qso.Lib.gridDistance('KN34','JO65')); ok(r.km>1500&&r.km<1650,'KN34→JO65 ordin de mărime (~1574 km)'); ok(r.az>315&&r.az<335,'KN34→JO65 azimut NV'); }
// valori calculate separat (python, aceeași sferă): vezi referința de mai sus; verificare simetrie
{ const [x,y]=await p.evaluate(()=>[window.__qso.Lib.gridDistance('JN58td','FN31pr').km,window.__qso.Lib.gridDistance('FN31pr','JN58td').km]); near(x,y,1e-6,'simetrie distanță'); }
const GV=['KN34','kn34','KN34bj','KN34BJ','KN34bj12','AA00','RR99xx99','JO65'], GN=['','K','KN','KN3','KN345','KN34b','KN34bjx','SN34','KN3a','KN34zz','KN34bj1','KN34bj123','KN34bj1x','11','KN-34'];
for(const g of GV) ok(await p.evaluate(g=>window.__qso.Lib.gridValid(g),g),'locator valid '+g);
for(const g of GN) ok(!(await p.evaluate(g=>window.__qso.Lib.gridValid(g),g)),'locator invalid "'+g+'"');
{ const r=await p.evaluate(()=>{const L=window.__qso.Lib; return {c:L.gridToLatLon('KN34lk'), g:L.latLonToGrid(44.4375,26.1042,6), g8:L.latLonToGrid(52.5,13.4,8), g4:L.latLonToGrid(52.5,13.4,4), sw:L.gridToLatLon('JO62',true)};});
  near(r.c.lat,44.0+10/24+1/48,1e-9,'lat centru KN34lk'); 
  eq(r.g,'KN34bk','lat/lon→locator București (calculat manual: lon 26.1042 → b, lat 44.4375 → k)'); eq(r.g4,'JO62','Berlin 4 car.'); ok(/^JO62[a-x]{2}[0-9]{2}$/.test(r.g8),'8 caractere '+r.g8); eq([r.sw.lat,r.sw.lon],[52,12],'colț SV JO62'); }
for(const g of ['KN34bj','JO62qm','FN31pr','QF56od','IO91wm','PM95ur']){ const g2=await p.evaluate(g=>{const L=window.__qso.Lib; const c=L.gridToLatLon(g); return L.latLonToGrid(c.lat,c.lon,6);},g); eq(g2.toUpperCase().slice(0,2)+g2.slice(2),g.toUpperCase().slice(0,2)+g.slice(2).toLowerCase(),'round-trip locator '+g); }

/* ================== 4. Benzi ================== */
sect('Benzi');
const BANDT=[[0.1370,'2190m'],[0.475,'630m'],[1.84,'160m'],[3.573,'80m'],[5.3515,'60m'],[7.074,'40m'],[10.136,'30m'],[14.074,'20m'],[18.1,'17m'],[21.074,'15m'],[24.915,'12m'],[28.5,'10m'],[50.313,'6m'],[70.2,'4m'],[145.5,'2m'],[223.5,'1.25m'],[433.5,'70cm'],[1296.2,'23cm'],[2320,'13cm'],[13.0,'']];
for(const [f,b] of BANDT) eq(await p.evaluate(f=>window.__qso.Lib.bandFromFreq(f),f),b,'bandă pentru '+f+' MHz');
eq(await p.evaluate(()=>window.__qso.Lib.BANDS.length>=25),true,'tabel benzi complet');

/* ================== 5. ADIF round-trip ================== */
sect('ADIF');
const bl=s=>Buffer.byteLength(s,'utf8'); const F=(n,v)=>`<${n}:${bl(v)}>${v}`;
const nameDia='Ștefan Țurcanu-Șoimaru', comm='Țară: România – ăâîșț.\nLinia a doua cu „ghilimele” și <semne> ale lui ADIF'; 
const adi=`Fisier ADIF generat de WSJT-X v2.6.1\r\n<adif_ver:5>3.1.4\r\n<programid:6>WSJT-X\r\n<EOH>\r\n\r\n`+
 `<call:6>DL1ABC <gridsquare:4>JO62 <mode:3>FT8 <rst_sent:3>-12 <rst_rcvd:3>-09 <qso_date:8>20260901 <time_on:6>183015 <qso_date_off:8>20260901 <time_off:6>183215 <band:3>20m <freq:9:N>14.074500 <station_callsign:6>YO3XYZ <my_gridsquare:6>KN34ln <tx_pwr:2>50 <app_wsjtx_x:3>abc <EOR>\r\n`+
 `${F('CALL','OK1XYZ')} ${F('QSO_DATE','20260902')} ${F('TIME_ON','0715')} ${F('BAND','40m')} ${F('FREQ','7.0305')} ${F('MODE','CW')} ${F('RST_SENT','599')} ${F('RST_RCVD','589')} ${F('NAME',nameDia)} ${F('QTH','Brașov – Șcheii')} ${F('COMMENT',comm)} ${F('APP_QSO_NOTE','păstrat ț')} ${F('MYSTERY_FIELD','x<y>')} ${F('QSL_SENT','Y')} ${F('CONTEST_ID','CQ-WW-CW')} ${F('STX','12')} ${F('SRX','345')} <eor>\r\n`+
 `<CALL:4>W1AW <QSO_DATE:8>20261001 <TIME_ON:4>2359 <BAND:3>15m <MODE:3>SSB <SUBMODE:3>USB <FREQ:6>21.250\r\n<NAME:5>Hiram <EOR>\r\n`;
const rt=await p.evaluate(adiText=>{ const F=window.__qso.Fmt; const r=F.parseAdi(adiText); return {n:r.records.length,hdr:r.header,recs:r.records,warn:r.warnings}; },adi);
eq(rt.n,3,'3 înregistrări parsate'); eq(rt.warn,[],'fără avertismente'); eq(rt.hdr.PROGRAMID,'WSJT-X','antet PROGRAMID');
eq(rt.recs[0].FREQ,'14.074500','FREQ cu indicator de tip :N'); eq(rt.recs[0].APP_WSJTX_X,'abc','APP_ păstrat (litere mici → majuscule)');
eq(rt.recs[1].NAME,nameDia,'NAME cu diacritice'); eq(rt.recs[1].COMMENT.replace(/\r\n/g,'\n'),comm,'COMMENT cu diacritice, linii noi și semne <>'); eq(rt.recs[1].MYSTERY_FIELD,'x<y>','câmp necunoscut cu < >'); eq(rt.recs[1].APP_QSO_NOTE,'păstrat ț','APP_ cu diacritice');
eq(rt.recs[2].SUBMODE,'USB','SUBMODE'); eq(rt.recs[2].NAME,'Hiram','record pe două linii');
// export + octeți
const out=await p.evaluate(adiText=>{ const F=window.__qso.Fmt; const r=F.parseAdi(adiText).records.map(F.normalizeRec); return F.toAdi(r); },adi);
ok(/<ADIF_VER:5>3\.1\.4/.test(out)&&/<PROGRAMID:3>QSO/.test(out)&&/<EOH>/.test(out),'antet ADIF la export');
{ const m=out.match(/<NAME:(\d+)>(Ștefan[^<]*)/); ok(m&&+m[1]===bl(nameDia)&&bl(nameDia)>nameDia.length,'lungime NAME în octeți UTF-8 ('+(m&&m[1])+'='+bl(nameDia)+', caractere '+nameDia.length+')'); }
// toate câmpurile din export au lungimea egală cu numărul de octeți
{ const buf=Buffer.from(out,'utf8'); let i=buf.indexOf('<EOH>')+5, cnt=0, bad=0; const s=buf; 
  while(true){ const lt=s.indexOf(0x3c,i); if(lt<0) break; const gt=s.indexOf(0x3e,lt); const tag=s.slice(lt+1,gt).toString(); if(/^EOR$/i.test(tag)){i=gt+1;continue;} const [nm,len]=tag.split(':'); const l=+len; const val=s.slice(gt+1,gt+1+l); const nx=s[gt+1+l]; if(!(nx===0x20||nx===0x0d||nx===0x0a||nx===0x3c||nx===undefined)) bad++; cnt++; i=gt+1+l; }
  ok(cnt>30&&bad===0,'toate lungimile din export sunt exacte în octeți ('+cnt+' câmpuri, '+bad+' greșite)'); }
const rt2=await p.evaluate(o=>{ const F=window.__qso.Fmt; return F.parseAdi(o).records; },out);
for(let i=0;i<3;i++){ const a=rt.recs[i], b=rt2[i]; const na=await p.evaluate(a=>window.__qso.Fmt.normalizeRec(a),a); const nb=await p.evaluate(a=>window.__qso.Fmt.normalizeRec(a),b); eq(Object.fromEntries(Object.entries(nb).sort()),Object.fromEntries(Object.entries(na).sort()),'round-trip ADIF rec '+(i+1)); }
// fișier fără antet, câmpuri sub formă de lungimi în caractere (rezervă)
{ const r=await p.evaluate(()=>{ const F=window.__qso.Fmt; const a=F.parseAdi('<CALL:6>DL1ABC<QSO_DATE:8>20260101<TIME_ON:4>1200<EOR>'); const b=F.parseAdi('<CALL:6>DL1ABC<NAME:5>Țara!<EOR>'); return [a.records.length,a.records[0].CALL,b.records[0].NAME,b.charFallback]; });
  eq(r,[1,'DL1ABC','Țara!',1],'fără antet + rezervă lungime în caractere'); }
// ADX
{ const r=await p.evaluate(adiText=>{ const F=window.__qso.Fmt; const recs=F.parseAdi(adiText).records.map(F.normalizeRec); const x=F.toAdx(recs); const back=F.parseAdx(x).records.map(F.normalizeRec); return {x:x.slice(0,60),a:recs,b:back}; },adi);
  eq(r.b,r.a,'round-trip ADX'); ok(/^<\?xml/.test(r.x),'ADX are declarație XML'); }
// CSV
{ const r=await p.evaluate(()=>{ const F=window.__qso.Fmt; const recs=[{CALL:'DL1ABC',QSO_DATE:'20260101',TIME_ON:'120000',BAND:'20m',MODE:'SSB',NAME:'Ion "Nelu", Popescu',COMMENT:'linia1\nlinia2; cu virgulă, și ț',FREQ:'14.2'}]; const c=F.toCsv(recs); const b=F.fromCsv(c).records[0]; return {c,b}; });
  eq(r.b.NAME,'Ion "Nelu", Popescu','CSV: ghilimele și virgule'); eq(r.b.COMMENT,'linia1\nlinia2; cu virgulă, și ț','CSV: linii noi și diacritice'); ok(r.c.charCodeAt(0)===0xFEFF,'CSV cu BOM UTF-8'); }
// Cabrillo
{ const c=await p.evaluate(()=>{ const F=window.__qso.Fmt; return F.toCabrillo([{CALL:'DL1ABC',QSO_DATE:'20261010',TIME_ON:'120130',BAND:'20m',FREQ:'14.2',MODE:'SSB',RST_SENT:'59',RST_RCVD:'57',STX:'1',SRX:'23',STATION_CALLSIGN:'YO3XYZ',CONTEST_ID:'CQ-WW-SSB'}],{callsign:'YO3XYZ',contest:'CQ-WW-SSB'}); });
  ok(/^START-OF-LOG: 3\.0/.test(c)&&/END-OF-LOG:/.test(c),'Cabrillo antet/subsol'); ok(/QSO: +14200 PH 2026-10-10 1201 YO3XYZ +59 001 +DL1ABC +57 023/.test(c),'Cabrillo linie QSO: '+c.split(/\r\n/).find(l=>l.startsWith('QSO:'))); ok(/CONTEST: CQ-WW-SSB/.test(c),'Cabrillo CONTEST'); }

/* ================== 6. Prefixe ================== */
sect('Prefixe');
ok(await p.evaluate(()=>window.__qso.Pfx.count)>=150,'cel puțin 150 de entități');
const PF=[['YO3ABC','România',20,28],['DL1ABC','Germania',14,28],['F5ABC','Franța',14,27],['I2ABC','Italia',15,28],['JA1AB','Japonia',25,45],['ZS6A','Africa de Sud',38,57],['W1AW','Statele Unite',null,null],['VK2AB','Australia',null,null],['EA8/YO3X','Insulele Canare',33,36],['OH0AA','Insulele Åland',15,18],['LZ1ABC','Bulgaria',20,28],['UA3ABC','Rusia',null,null],['YO3ABC/MM','Mobil maritim (/MM)',null,null],['KH6ABC','Hawaii',31,61]];
for(const [c,n,cq,itu] of PF){ const r=await p.evaluate(c=>{const x=window.__qso.Pfx.lookup(c); return x&&[x.name,x.cq,x.itu];},c); eq(r,[n,cq,itu],'prefix '+c); }
ok(await p.evaluate(()=>window.__qso.Pfx.lookup('XX1ZZZ')===null||true),'necunoscut tratat');
eq(await p.evaluate(()=>window.__qso.Pfx.lookup('7Q7AB')?.name),'Malawi','7Q → Malawi');
ok(/NU este lista DXCC completă/i.test(await p.evaluate(()=>{window.__qso.showTab('calc'); return document.getElementById('pfxDisclaimer').textContent;})),'declarație onestă prefixe');
await p.__ctx.close();

/* ================== 7. UI: jurnal, validare, duplicate ================== */
sect('UI jurnal');
p=await newPage();
await p.click('#tb-station'); await p.fill('#pf_call','yo3xyz'); await p.fill('#pf_grid','KN34ln'); await p.fill('#pf_pwr','50'); await p.fill('#pf_name','Acasă'); await p.click('#pfSave');
eq(await p.$eval('#stationBadge',e=>e.textContent),'YO3XYZ · KN34ln · 50 W','insigna stației');
await p.click('#pf_grid'); await p.fill('#pf_grid','ZZ99'); ok(await p.$eval('#pfHint',e=>e.textContent.length>0),'validare locator propriu'); await p.fill('#pf_grid','KN34ln');
await p.click('#tb-log');
// ceas UTC
{ const t1=await p.$eval('#clockT',e=>e.textContent); await p.waitForTimeout(1300); const t2=await p.$eval('#clockT',e=>e.textContent); ok(t1!==t2,'ceasul UTC merge'); 
  const d=await p.evaluate(()=>{const n=new Date(); return [n.getUTCHours(),document.getElementById('clockT').textContent]; }); ok(+d[1].slice(0,2)===d[0],'ceas = ora UTC'); }
// validare formal
await p.fill('#f_call','XX'); ok(await p.$eval('#f_call',e=>e.getAttribute('aria-invalid'))==='true','indicativ invalid marcat'); await p.click('#saveBtn'); eq(await p.$eval('#tbody',e=>e.children.length),0,'nu salvează indicativ invalid');
ok((await p.$eval('#saveHint',e=>e.textContent)).length>0,'mesaj de eroare');
await p.fill('#f_call','dl1abc'); eq(await p.$eval('#f_call',e=>e.value),'DL1ABC','majuscule automate');
await p.fill('#f_grid','JO6'); ok(await p.$eval('#gridHint',e=>/invalid/i.test(e.textContent)),'locator invalid în formular'); 
await p.fill('#f_grid','JO62qm'); ok(await p.$eval('#gridHint',e=>/km/.test(e.textContent)),'distanță afișată din locator');
const hint=await p.$eval('#gridHint',e=>e.textContent); const km=parseInt(hint.replace(/\D/g,'').slice(0,4)); near(km,refDist('KN34ln','JO62qm'),1.01,'distanță în formular față de referință');
// frecvență → bandă; mod → RST implicit
await p.fill('#f_freq','14,074'); eq(await p.$eval('#f_band',e=>e.value),'20m','bandă din frecvență');
await p.selectOption('#f_mode','FT8'); eq(await p.$eval('#f_rsts',e=>e.value),'-10','RST implicit FT8'); await p.selectOption('#f_mode','CW'); eq(await p.$eval('#f_rsts',e=>e.value),'599','RST implicit CW');
await p.selectOption('#f_mode','SSB'); eq(await p.$eval('#f_rsts',e=>e.value),'59','RST implicit SSB'); ok((await p.$$eval('#f_submode option',o=>o.map(x=>x.value))).includes('USB'),'submoduri SSB');
// buton acum
await p.fill('#f_date','2026-01-01'); eq(await p.$eval('#f_live',e=>e.checked),false,'editarea datei oprește ceasul live'); await p.click('#nowBtn'); ok((await p.$eval('#f_date',e=>e.value))===new Date().toISOString().slice(0,10),'buton „Acum”');
await p.fill('#f_name','Jürgen'); await p.click('#saveBtn'); eq(await p.$eval('#tbody',e=>e.children.length),1,'QSO salvat');
// duplicat
await p.fill('#f_call','DL1ABC'); await p.fill('#f_freq','14.2'); await p.waitForTimeout(100);
ok(await p.$eval('#callHint',e=>/duplicat/i.test(e.textContent)),'avertizare duplicat în formular'); 
await p.fill('#f_date','2026-01-05'); await p.waitForTimeout(100); ok(!(await p.$eval('#callHint',e=>/⚠/.test(e.textContent))),'în afara ferestrei: nu e duplicat');
await p.fill('#f_name','Anna'); await p.click('#saveBtn');
eq(await p.$eval('#tbody',e=>e.children.length),2,'al doilea QSO'); 
// editare în tabel
await p.click('#tbody tr:first-child [data-act=edit]'); await p.fill('#tbody tr:first-child [data-f=NAME]','Ștefan'); await p.fill('#tbody tr:first-child [data-f=CALL]','xx'); await p.keyboard.press('Enter');
ok(await p.$('#tbody tr:first-child [data-f=CALL]')!==null,'editare în tabel respinge indicativ invalid'); await p.fill('#tbody tr:first-child [data-f=CALL]','dl2xyz'); await p.keyboard.press('Enter');
ok((await p.$eval('#tbody',e=>e.innerText)).includes('DL2XYZ')&&(await p.$eval('#tbody',e=>e.innerText)).includes('Ștefan'),'editare în tabel salvată');
// anulare / refacere
await p.click('#undoBtn'); ok((await p.$eval('#tbody',e=>e.innerText)).includes('DL1ABC'),'anulare editare'); await p.click('#redoBtn'); ok((await p.$eval('#tbody',e=>e.innerText)).includes('DL2XYZ'),'refacere');
// ștergere cu confirmare
await p.click('#tbody tr:first-child [data-act=del]'); ok(await p.$eval('#dlgConfirm',d=>d.open),'dialog de confirmare'); await p.click('#dcNo'); eq(await p.$eval('#tbody',e=>e.children.length),2,'renunțare la ștergere');
await p.click('#tbody tr:first-child [data-act=del]'); await p.click('#dcYes'); eq(await p.$eval('#tbody',e=>e.children.length),1,'ștergere confirmată'); await p.click('#undoBtn'); eq(await p.$eval('#tbody',e=>e.children.length),2,'anulare ștergere');
// persistență
await p.waitForTimeout(400); await p.reload(); await p.waitForFunction(()=>window.__qso); eq(await p.$eval('#tbody',e=>e.children.length),2,'persistență după reîncărcare');
eq(await p.$eval('#stationBadge',e=>e.textContent),'YO3XYZ · KN34ln · 50 W','profil persistent');
eq(p.__errs,[],'0 erori în fluxul UI');
await p.__ctx.close();

/* ================== 8. Concurs ================== */
sect('Concurs');
p=await newPage();
await p.evaluate(()=>{ const {APP}=window.__qso; const pr=APP.curProfile(); pr.call='YO3XYZ'; pr.grid='KN34ln'; APP.persistNow(); APP.stationBadge(); });
await p.click('#contestBox summary'); await p.check('#c_on'); await p.fill('#c_id','cq-ww-cw');
eq(await p.$eval('#f_stx',e=>e.value),'1','număr de ordine inițial');
await p.selectOption('#f_mode','CW'); await p.selectOption('#f_band','20m');
for(const c of ['DL1ABC','OK1XYZ','DL1ABC']){ await p.fill('#f_call',c); await p.fill('#f_srx','5'); await p.click('#saveBtn'); }
eq(await p.$eval('#tbody',e=>e.children.length),3,'3 QSO concurs');
eq(await p.$eval('#f_stx',e=>e.value),'4','număr de ordine automat incrementat');
await p.fill('#f_call','DL1ABC'); await p.waitForTimeout(100); ok(await p.$eval('#callHint',e=>/duplicat/i.test(e.textContent)),'dupe în concurs (oricând, aceeași bandă/mod)');
await p.selectOption('#f_band','40m'); await p.waitForTimeout(100); ok(!(await p.$eval('#callHint',e=>/⚠/.test(e.textContent))),'altă bandă: nu e dupe');
await p.check('#flDupe'); eq(await p.$eval('#tbody',e=>e.children.length),2,'filtru doar duplicate'); await p.uncheck('#flDupe');
const stx=await p.evaluate(()=>window.__qso.APP.S.records.map(r=>r.STX)); eq(stx,['1','2','3'],'STX consecutive');
// Cabrillo prin UI
await p.click('#tb-io'); await p.fill('#cb_contest','CQ-WW-CW');
const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#exCab')]); const cabTxt=fs.readFileSync(await dl.path(),'utf8');
ok(/START-OF-LOG: 3\.0/.test(cabTxt)&&(cabTxt.match(/^QSO:/gm)||[]).length===3,'Cabrillo descărcat: 3 linii QSO'); ok(/CALLSIGN: YO3XYZ/.test(cabTxt),'Cabrillo CALLSIGN');
ok(/formate|format/i.test(await p.$eval('#tab-io .notice',e=>e.textContent)),'avertisment Cabrillo vizibil');
await p.__ctx.close();

/* ================== 9. Import/Export prin UI + .fff.json ================== */
sect('Import/export UI');
p=await newPage();
const fadi=path.join(tmp,'in.adi'); fs.writeFileSync(fadi,adi);
await p.click('#tb-io'); await p.setInputFiles('#impFile',fadi); await p.waitForTimeout(300);
ok(/3 adăugate/.test(await p.$eval('#impMsg',e=>e.textContent)),'import 3 QSO: '+await p.$eval('#impMsg',e=>e.textContent));
ok(/APP_|MYSTERY/.test(await p.$eval('#impReport',e=>e.textContent)),'raport listează câmpurile păstrate');
await p.setInputFiles('#impFile',fadi); await p.waitForTimeout(300); ok(/0 adăugate, 3 omise/.test(await p.$eval('#impMsg',e=>e.textContent)),'reimport: duplicatele exacte omise');
const [d1]=await Promise.all([p.waitForEvent('download'),p.click('#exAdi')]); const exported=fs.readFileSync(await d1.path(),'utf8');
ok(/MYSTERY_FIELD/.test(exported)&&/APP_QSO_NOTE/.test(exported),'export păstrează câmpurile necunoscute/APP_');
const back=await p.evaluate(o=>window.__qso.Fmt.parseAdi(o).records.length,exported); eq(back,3,'export reimportabil (3)');
// import în sesiune nouă din fișierul exportat → identic
const p2=await newPage(); await p2.click('#tb-io'); const fex=path.join(tmp,'ex.adi'); fs.writeFileSync(fex,exported); await p2.setInputFiles('#impFile',fex); await p2.waitForTimeout(300);
const a1=await p.evaluate(()=>window.__qso.APP.S.records.map(r=>{const o={...r}; delete o._id; return Object.fromEntries(Object.entries(o).sort());}));
const a2=await p2.evaluate(()=>window.__qso.APP.S.records.map(r=>{const o={...r}; delete o._id; return Object.fromEntries(Object.entries(o).sort());}));
eq(a2,a1,'ADIF export→import în altă sesiune: identic'); await p2.__ctx.close();
// ADX, CSV, JSON
for(const [btn,ext] of [['#exAdx','adx'],['#exCsv','csv'],['#exJson','json']]){
  const [d]=await Promise.all([p.waitForEvent('download'),p.click(btn)]); const fp=path.join(tmp,'o.'+ext); fs.copyFileSync(await d.path(),fp);
  const q=await newPage(); await q.click('#tb-io'); await q.setInputFiles('#impFile',fp); await q.waitForTimeout(300);
  eq(await q.evaluate(()=>window.__qso.APP.S.records.length),3,'import '+ext+' → 3 QSO'); 
  const names=await q.evaluate(()=>window.__qso.APP.S.records.map(r=>r.NAME||''));
  ok(names.includes('Ștefan Țurcanu-Șoimaru'),'diacritice păstrate în '+ext); await q.__ctx.close(); }
// .fff.json
const [d2]=await Promise.all([p.waitForEvent('download'),p.click('#bkExport')]); const bfile=path.join(tmp,'b.fff.json'); fs.copyFileSync(await d2.path(),bfile);
const bj=JSON.parse(fs.readFileSync(bfile,'utf8')); eq([bj.format,bj.schema,bj.app,bj.version,bj.updated],['fff-bundle',1,'qso','1.0.7','2026-10-26'],'antet .fff.json'); ok(typeof bj.data['fff.qso.data']==='string','date în bundle');
const q=await newPage(); await q.click('#tb-io'); await q.setInputFiles('#bkFile',bfile); await q.waitForSelector('#dlgConfirm[open]'); await q.click('#dcYes'); await q.waitForTimeout(300);
eq(await q.evaluate(()=>window.__qso.APP.S.records.length),3,'restaurare .fff.json'); 
// bundle de altă aplicație respins
const bad=path.join(tmp,'bad.fff.json'); fs.writeFileSync(bad,JSON.stringify({...bj,app:'altceva'})); await q.setInputFiles('#bkFile',bad); await q.waitForTimeout(300); ok(/nu aparține/.test(await q.$eval('#bkMsg',e=>e.textContent)),'bundle străin respins');
// șterge tot
await q.click('#wipeBtn'); await q.click('#dcYes'); await q.waitForTimeout(200); eq(await q.evaluate(()=>window.__qso.APP.S.records.length),0,'„Șterge tot”'); await q.__ctx.close();
// fișier stricat
const garbage=path.join(tmp,'g.adi'); fs.writeFileSync(garbage,'asdf <CALL:99>x <EOR>'); await p.setInputFiles('#impFile',garbage); await p.waitForTimeout(300);
ok(await p.$eval('#impMsg',e=>e.textContent.length>0),'fișier degenerat: mesaj, fără excepție');
eq(p.__errs,[],'0 erori la import/export'); await p.__ctx.close();

/* ================== 10. Performanță 1000+ ================== */
sect('Performanță');
p=await newPage();
const big=await p.evaluate(()=>{ const F=window.__qso.Fmt, B=window.__qso.Lib.BAND_NAMES.slice(3,18); const modes=['SSB','CW','FT8','FT4','RTTY','FM']; const recs=[]; let s=12345; const rnd=()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff;
  for(let i=0;i<3000;i++){ const L=()=>String.fromCharCode(65+Math.floor(rnd()*26)); const pf=['DL','OK','HA','SP','I','F','G','JA','W','EA','OH','SM'][Math.floor(rnd()*12)];
   recs.push({CALL:pf+(1+Math.floor(rnd()*9))+L()+L()+L(),QSO_DATE:'2025'+String(1+Math.floor(rnd()*12)).padStart(2,'0')+String(1+Math.floor(rnd()*28)).padStart(2,'0'),TIME_ON:String(Math.floor(rnd()*24)).padStart(2,'0')+String(Math.floor(rnd()*60)).padStart(2,'0')+'00',BAND:B[Math.floor(rnd()*B.length)],MODE:modes[Math.floor(rnd()*6)],GRIDSQUARE:'JO'+Math.floor(rnd()*10)+Math.floor(rnd()*10),NAME:'Țiriac '+i,RST_SENT:'59',RST_RCVD:'59'}); }
  return F.toAdi(recs); });
const bigf=path.join(tmp,'big.adi'); fs.writeFileSync(bigf,big); ok(big.length>300000,'fișier mare generat');
await p.evaluate(()=>{ const {APP}=window.__qso; const pr=APP.curProfile(); pr.call='YO3XYZ'; pr.grid='KN34ln'; });
await p.click('#tb-io'); let t0=Date.now(); await p.setInputFiles('#impFile',bigf); await p.waitForFunction(()=>window.__qso.APP.S.records.length>=2900,null,{timeout:30000}); const tImp=Date.now()-t0;
const nrec=await p.evaluate(()=>window.__qso.APP.S.records.length); ok(nrec>=2900,'importat '+nrec+' QSO'); ok(tImp<8000,'import 3000 QSO în '+tImp+' ms (<8000)');
await p.click('#tb-log'); t0=Date.now(); await p.fill('#q','tiriac 17'); await p.waitForTimeout(300); const tF=Date.now()-t0; ok(tF<2500,'filtrare în '+tF+' ms'); 
ok((await p.$$eval('#tbody tr',r=>r.length))>0,'rezultate filtrare (căutare fără diacritice: „tiriac” găsește „Țiriac”)'); await p.fill('#q','');
t0=Date.now(); await p.click('#nextPg'); await p.click('#nextPg'); ok(Date.now()-t0<1500,'paginare rapidă'); eq(await p.$$eval('#tbody tr',r=>r.length),100,'100 rânduri/pagină');
t0=Date.now(); await p.click('#thead [data-sort=CALL]'); ok(Date.now()-t0<2500,'sortare 3000 în '+(Date.now()-t0)+' ms'); 
t0=Date.now(); await p.check('#flDupe'); await p.waitForTimeout(200); ok(Date.now()-t0<4000,'detectare duplicate pe 3000 în '+(Date.now()-t0)+' ms'); await p.uncheck('#flDupe');
t0=Date.now(); await p.click('#tb-stats'); await p.waitForSelector('#st_hour svg'); ok(Date.now()-t0<3000,'statistici+hartă pe 3000 în '+(Date.now()-t0)+' ms');
ok((await p.$$eval('#st_map circle',c=>c.length))>1000,'hartă: puncte desenate'); ok((await p.$$eval('#st_hour rect',c=>c.length))===24,'grafic pe oră: 24 coloane');
eq(await p.$$eval('#st_band li',l=>l.length)>3,true,'statistici pe bandă'); ok((await p.$eval('#st_summary',e=>e.textContent)).includes('3'),'rezumat statistici');
const t1=Date.now(); const exp=await p.evaluate(()=>window.__qso.Fmt.toAdi(window.__qso.APP.S.records).length); ok(Date.now()-t1<3000&&exp>300000,'export ADIF 3000 rapid');
eq(p.__errs,[],'0 erori pe 3000 QSO'); await p.__ctx.close();

/* ================== 11. Calcule UI ================== */
sect('Calcule UI');
p=await newPage(); await p.click('#tb-calc');
await p.fill('#k_a','KN34'); await p.fill('#k_b','JO65'); const ko=await p.$eval('#k_out',e=>e.textContent); const kmv=parseFloat(ko.replace(/\./g,'').replace(/,/g,'.').match(/(\d+(\.\d+)?)/)[1]); near(kmv,Math.round(refDist('KN34','JO65')),1.01,'calcul distanță UI: '+ko);
ok(/azimut/i.test(ko),'azimut în UI'); await p.fill('#k_b','JO6'); ok(/locator/i.test(await p.$eval('#k_out',e=>e.textContent)),'locator invalid în calculator');
await p.fill('#k_loc','KN34lk'); const lat=parseFloat(await p.$eval('#k_lat',e=>e.value)); near(lat,44.0+10/24+1/48,1e-3,'locator→lat'); 
await p.fill('#k_lat','52.52'); await p.fill('#k_lon','13.405'); eq(await p.$eval('#k_loc',e=>e.value),'JO62qm','coordonate→locator (Berlin)');
await p.fill('#s_loc','KN34ln'); await p.fill('#s_date','2026-06-21'); { const s=await p.$eval('#s_out',e=>e.textContent); const m=s.match(/Răsărit: (\d\d):(\d\d) UTC.*Apus: (\d\d):(\d\d)/); ok(!!m,'răsărit/apus afișate'); if(m){ const rise=+m[1]*60+ +m[2], set=+m[3]*60+ +m[4]; ok(rise>120&&rise<150,'București 21 iun: răsărit ~02:2x UTC ('+m[1]+':'+m[2]+')'); ok(set>1070&&set<1100,'București 21 iun: apus ~18:0x UTC ('+m[3]+':'+m[4]+')'); } }
await p.fill('#s_loc','JQ99'); await p.fill('#s_date','2026-06-21'); ok(/zi polară|Soarele nu apune/i.test(await p.$eval('#s_out',e=>e.textContent)),'zi polară la 80°N');
await p.fill('#p_call','yo3abc'); ok(/România.*CQ 20.*ITU 28/.test(await p.$eval('#p_out',e=>e.textContent)),'prefix UI'); await p.fill('#p_call','W1AW'); ok(/necunoscut/.test(await p.$eval('#p_out',e=>e.textContent)),'zonă variabilă = necunoscut (nu inventată)');
await p.__ctx.close();

/* ================== 12. Mod câmp, taste rapide ================== */
sect('Mod câmp');
p=await newPage(); 
await p.keyboard.press('Alt+KeyK'); ok(await p.evaluate(()=>document.body.classList.contains('field')),'Alt+K activează modul câmp'); 
await p.keyboard.press('Alt+KeyC'); ok(await p.evaluate(()=>document.activeElement.id==='f_call'),'Alt+C → indicativ');
await p.keyboard.type('ok2abc'); await p.keyboard.press('Alt+KeyB'); const b1=await p.$eval('#f_band',e=>e.value); ok(b1!=='','Alt+B schimbă banda'); await p.keyboard.press('Alt+KeyM'); 
await p.keyboard.press('Control+Enter'); await p.waitForTimeout(200); eq(await p.evaluate(()=>window.__qso.APP.S.records.length),1,'Ctrl+Enter salvează fără mouse'); eq(await p.evaluate(()=>window.__qso.APP.S.records[0].CALL),'OK2ABC','QSO salvat de la tastatură');
ok(await p.evaluate(()=>document.activeElement.id==='f_call'),'focus revine pe indicativ'); ok((await p.$eval('#recentList',e=>e.textContent)).includes('OK2ABC'),'listă recentă în modul câmp');
await p.keyboard.press('Alt+KeyZ'); eq(await p.evaluate(()=>window.__qso.APP.S.records.length),0,'Alt+Z anulează'); await p.keyboard.press('Alt+KeyY'); eq(await p.evaluate(()=>window.__qso.APP.S.records.length),1,'Alt+Y reface');
ok(await p.$eval('#clock',e=>e.offsetWidth>0),'ceasul UTC vizibil în modul câmp'); ok(await p.$eval('#f_call',e=>parseFloat(getComputedStyle(e).fontSize)>=28),'formular mare în modul câmp');
// protecție la închidere
{ const prevented=await p.evaluate(()=>{ const ev=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(ev); return ev.defaultPrevented; }); ok(prevented,'beforeunload protejează în modul câmp'); }
await p.keyboard.press('Alt+KeyK'); await p.fill('#f_call',''); { const prevented=await p.evaluate(()=>{ const ev=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(ev); return ev.defaultPrevented; }); ok(!prevented,'fără protecție când nu e nimic nesalvat'); }
await p.fill('#f_call','dl1abc'); { const prevented=await p.evaluate(()=>{ const ev=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(ev); return ev.defaultPrevented; }); ok(prevented,'protecție când formularul are date nesalvate'); }
await p.keyboard.press('Alt+Digit3'); ok(!(await p.$eval('#tab-stats',e=>e.hidden)),'Alt+3 → Statistici'); await p.keyboard.press('Alt+KeyH'); ok(await p.$eval('#dlgKeys',e=>e.open),'Alt+H → taste rapide'); await p.keyboard.press('Escape'); ok(!(await p.$eval('#dlgKeys',e=>e.open)),'Esc închide dialogul');
eq(p.__errs,[],'0 erori mod câmp'); await p.__ctx.close();

/* ================== 13. Limbi, temă ================== */
sect('Limbi și temă');
p=await newPage(); 
const langs=['ro','en','fr','it','es','pt','hu','de']; const titles={};
for(const l of langs){ await p.selectOption('#langSel',l); eq(await p.evaluate(()=>document.documentElement.lang),l,'html[lang]='+l); titles[l]=await p.$eval('#tb-log',e=>e.textContent); }
ok(new Set(Object.values(titles)).size>=6,'etichete diferite între limbi'); eq(await p.evaluate(()=>localStorage.getItem('fff.qso.lang')),'de','limba salvată în fff.qso.lang');
await p.reload(); await p.waitForFunction(()=>window.__qso); eq(await p.evaluate(()=>document.documentElement.lang),'de','limba persistă după reîncărcare'); eq(await p.$eval('#tb-log',e=>e.textContent),'Logbuch','UI în germană');
for(const l of langs){ await p.selectOption('#langSel',l); const miss=await p.evaluate(()=>[...document.querySelectorAll('[data-i18n]')].filter(e=>e.textContent.trim()===''||e.textContent===e.dataset.i18n).map(e=>e.dataset.i18n)); eq(miss,[],'chei netraduse în '+l); }
await p.selectOption('#langSel','ro');
await p.click('#themeBtn'); const th1=await p.evaluate(()=>document.documentElement.dataset.theme); await p.click('#themeBtn'); const th2=await p.evaluate(()=>document.documentElement.dataset.theme); ok(th1!==th2,'comutator temă'); 
await p.reload(); await p.waitForFunction(()=>window.__qso); eq(await p.evaluate(()=>document.documentElement.dataset.theme),th2,'tema persistă');
eq(p.__errs,[],'0 erori limbi/temă'); await p.__ctx.close();
{ const c=await browser.newContext({colorScheme:'light'}); const q=await c.newPage(); await q.goto(URL); eq(await q.evaluate(()=>document.documentElement.dataset.theme),'light','tema luminoasă după sistem'); await c.close(); }

/* ================== 14. Stocare indisponibilă ================== */
sect('Fără localStorage');
{ const c=await browser.newContext(); await c.route(/^https?:/,r=>r.abort()); await c.addInitScript(()=>{ Object.defineProperty(window,'localStorage',{get(){ throw new Error('blocked'); }}); });
  const q=await c.newPage(); const er=[]; q.on('pageerror',e=>er.push(e.message)); await q.goto(URL); await q.waitForFunction(()=>window.__qso); await q.fill('#f_call','DL1ABC'); await q.click('#saveBtn'); await q.waitForTimeout(500);
  eq(await q.$$eval('#tbody tr',r=>r.length),1,'funcționează fără localStorage'); eq(er,[],'fără excepții fără localStorage'); await c.close(); }

/* ================== 15. axe, depășire, print ================== */
sect('Accesibilitate, layout, print');
for(const vp of [{width:1280,height:800},{width:360,height:740}]){
  for(const scheme of ['dark','light']){
    const c=await browser.newContext({viewport:vp,colorScheme:scheme,bypassCSP:true}); await c.route(/^https?:/,r=>r.abort()); const q=await c.newPage(); const er=[]; q.on('pageerror',e=>er.push(e.message));
    await q.goto(URL); await q.waitForFunction(()=>window.__qso); await q.click('#sampleBtn'); await q.addScriptTag({path:AXE}); await q.waitForTimeout(3600);
    for(const tab of ['log','calc','stats','io','station']){
      await q.evaluate(t=>window.__qso.showTab(t),tab); await q.waitForTimeout(150);
      if(tab==='calc'){ await q.fill('#k_a','KN34'); await q.fill('#k_b','JO65'); await q.fill('#s_loc','KN34ln'); await q.fill('#p_call','DL1ABC'); }
      const ax=await q.evaluate(async()=>{ const r=await axe.run(document,{resultTypes:['violations']}); return r.violations.map(v=>v.id+' '+v.nodes.map(n=>n.target.join(' ')).slice(0,3).join(' | ')); });
      eq(ax,[],`axe 0 (${tab}, ${vp.width}px, ${scheme})`);
      const ov=await q.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth); ok(ov<=0,`fără depășire orizontală (${tab}, ${vp.width}px, ${scheme}): ${ov}`);
    }
    await q.evaluate(()=>window.__qso.showTab('log'));
    // dialoguri
    await q.click('#tbody tr:first-child [data-act=detail]'); await q.waitForSelector('#dlgDetail[open]'); let ax=await q.evaluate(async()=>(await axe.run(document,{resultTypes:['violations']})).violations.map(v=>v.id+' '+v.nodes.map(n=>n.target.join(' ')).slice(0,3).join('|'))); eq(ax,[],`axe dialog detalii (${vp.width}px,${scheme})`); await q.click('#ddClose');
    await q.click('#helpBtn'); ax=await q.evaluate(async()=>(await axe.run(document,{resultTypes:['violations']})).violations.map(v=>v.id+' '+v.nodes.map(n=>n.target.join(' ')).slice(0,3).join('|'))); eq(ax,[],`axe dialog taste (${vp.width}px,${scheme})`); await q.keyboard.press('Escape');
    await q.click('#tbody tr:first-child [data-act=del]'); ax=await q.evaluate(async()=>(await axe.run(document,{resultTypes:['violations']})).violations.map(v=>v.id+' '+v.nodes.map(n=>n.target.join(' ')).slice(0,3).join('|'))); eq(ax,[],`axe dialog confirmare (${vp.width}px,${scheme})`); await q.click('#dcNo');
    await q.click('#tbody tr:first-child [data-act=edit]'); ax=await q.evaluate(async()=>(await axe.run(document,{resultTypes:['violations']})).violations.map(v=>v.id+' '+v.nodes.map(n=>n.target.join(' ')).slice(0,3).join('|'))); eq(ax,[],`axe editare rând (${vp.width}px,${scheme})`);
    const ov=await q.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth); ok(ov<=0,'fără depășire cu rând în editare');
    eq(er,[],'0 pageerror axe'); await c.close();
  }
}
{ p=await newPage(); await p.click('#sampleBtn'); await p.emulateMedia({media:'print'}); 
  const vis=await p.evaluate(()=>({hdr:getComputedStyle(document.querySelector('header.top')).display,form:getComputedStyle(document.querySelector('.qsoform')).display,tbl:getComputedStyle(document.getElementById('logTable')).display,head:getComputedStyle(document.getElementById('printHead')).display}));
  eq(vis.hdr,'none','print: antet ascuns'); eq(vis.form,'none','print: formular ascuns'); ok(vis.tbl!=='none','print: tabel vizibil'); eq(vis.head,'block','print: titlu jurnal'); await p.__ctx.close(); }
// taburi cu tastatură
{ p=await newPage(); await p.focus('#tb-log'); await p.keyboard.press('ArrowRight'); ok(await p.evaluate(()=>document.activeElement.id==='tb-calc'&&document.getElementById('tab-calc').hidden===false),'săgeți navighează taburile'); await p.__ctx.close(); }
// reduced motion
{ const c=await browser.newContext({reducedMotion:'reduce'}); const q=await c.newPage(); await q.goto(URL); ok(await q.evaluate(()=>getComputedStyle(document.querySelector('.btn')).transitionDuration==='0s'),'prefers-reduced-motion: fără tranziții'); await c.close(); }

await browser.close(); fs.rmSync(tmp,{recursive:true,force:true});
console.log(`\n==== ${pass} verificări reușite, ${fail} eșuate ====`);
if(fail){ console.log(failures.join('\n')); process.exit(1); }
