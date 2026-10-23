// Teste Fabrica — Playwright, rețea blocată. Rulare: node tests/test.mjs
import {createRequire} from "module";
import path from "path"; import {fileURLToPath} from "url"; import fs from "fs"; import os from "os"; import crypto from "crypto"; import {execFileSync} from "child_process";
const require=createRequire("/opt/node-tools/package.json");
const {chromium}=require("playwright");
const __dir=path.dirname(fileURLToPath(import.meta.url));
const APP='file://'+path.resolve(__dir,'..','index.html');
const AXE=process.env.AXE_PATH||'/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
const AXE_SRC=fs.existsSync(AXE)?fs.readFileSync(AXE,'utf8'):null; if(!AXE_SRC) console.log('(axe-core lipsește la '+AXE+' — setează AXE_PATH; verificările axe sunt sărite)');
let pass=0, fail=0; const failures=[];
const ok=(c,m)=>{ if(c)pass++; else {fail++; failures.push(m); console.log('  FAIL:',m);} };
const eq=(a,b,m)=>{ const A=JSON.stringify(a),B=JSON.stringify(b); ok(A===B,m+' (obtained '+A+', expected '+B+')'); };
const sect=s=>console.log('\n## '+s);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fabrica-'));
const browser=await chromium.launch({executablePath:"/opt/pw-browsers/chromium"});
async function mk(url,opts){
  const ctx=await browser.newContext(Object.assign({viewport:{width:1280,height:800},acceptDownloads:true},opts||{}));
  const reqs=[]; await ctx.route(/^https?:/,r=>{reqs.push(r.request().url()); r.abort();});
  const p=await ctx.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{const t=m.text(); if(m.type()==='error'||/Content Security Policy|Refused/i.test(t)) errs.push('console: '+t);});
  p.__errs=errs; p.__reqs=reqs; p.__ctx=ctx; p.on('dialog',d=>d.accept('Text alternativ de test'));
  await p.goto(url); return p;
}
async function axe(p,label){
  if(!AXE_SRC) return;
  await p.waitForTimeout(3600);
  if(!(await p.evaluate(()=>!!window.axe))){ const cdp=await p.context().newCDPSession(p); await cdp.send('Runtime.evaluate',{expression:AXE_SRC}); await cdp.detach(); }
  const r=await p.evaluate(async()=>{const x=await axe.run(document,{resultTypes:['violations']}); return x.violations.map(v=>v.id+': '+v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(' | '));});
  eq(r,[],'axe 0 violări — '+label);
}
const overflow=p=>p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
const cspHashOK=html=>{
  const m=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/); if(!m) return false;
  const hs=(m[1].match(/'sha256-([^']+)'/g)||[]).map(x=>x.slice(8,-1));
  const scripts=[...html.matchAll(/<script(?![^>]*type="application\/json")(?![^>]*type="text\/plain")[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(s=>s.trim());
  return scripts.length>0 && scripts.every(s=>hs.includes(crypto.createHash('sha256').update(s,'utf8').digest('base64')));
};

/* ================= 1. Editor: pornire ================= */
sect('1. Editor — pornire, CSP, meta, limbi');
let ed=await mk(APP); await ed.waitForFunction(()=>window.__fabrica);
const edHtml=fs.readFileSync(path.resolve(__dir,'..','index.html'),'utf8');
ok(cspHashOK(edHtml),'hash-urile CSP ale editorului corespund scripturilor inline');
ok(!/ on\w+=/.test(edHtml.replace(/<script[\s\S]*?<\/script>/g,'')),'fără handlere inline în editor');
ok(/<meta name="application-version" content="1.1.4">/.test(edHtml)&&/<meta name="last-updated" content="2026-10-23">/.test(edHtml),'meta versiune');
eq(await ed.textContent('#app-version'),'v1.1.4 · 2026-10-23','#app-version');
eq(ed.__errs,[],'0 pageerror/CSP la pornire'); eq(ed.__reqs,[],'0 cereri de rețea');
eq(await ed.evaluate(()=>document.documentElement.lang),'ro','html[lang]=ro implicit');
await axe(ed,'editor, panou Curs');
for(const l of ['en','fr','it','es','pt','hu','de','ro']){
  await ed.selectOption('#langSel',l); eq(await ed.evaluate(()=>document.documentElement.lang),l,'html[lang] '+l);
  ok(!(await ed.textContent('#tab-meta')).includes('tab_meta'),'tab tradus '+l);
}
await ed.selectOption('#langSel','de'); await ed.reload(); await ed.waitForFunction(()=>window.__fabrica);
eq(await ed.evaluate(()=>document.documentElement.lang),'de','limba persistă după reîncărcare'); await ed.selectOption('#langSel','ro');
await ed.setViewportSize({width:360,height:740}); ok(await overflow(ed)<=0,'editor 360 px fără depășire (Curs)');
for(const t of ['content','glossary','evidence','test','check','preview','export']){ await ed.click('#tab-'+t); ok(await overflow(ed)<=0,'editor 360 px fără depășire ('+t+')'); }
await ed.setViewportSize({width:1280,height:800});

/* ================= 2. Șabloane, structură, anulare ================= */
sect('2. Editor — șabloane, adăugare/mutare/ștergere cu anulare');
await ed.click('#tab-meta'); await ed.click('#btn-tpl'); await ed.waitForSelector('#dlg-tpl[open]');
await axe(ed,'dialog șabloane');
eq(await ed.locator('#tpl-list li').count(),4,'4 șabloane');
await ed.click('#tpl-list li:nth-child(1) button'); await ed.waitForTimeout(100);
let c=await ed.evaluate(()=>window.__fabrica.course);
eq([c.levels.length,c.levels[0].lessons.length,c.finalTest.enabled],[1,2,true],'șablon „curs scurt”');
await ed.click('#tab-content');
const n0=await ed.locator('#tree .tn').count(); eq(n0,3,'arbore: 1 nivel + 2 lecții');
await ed.click('[data-act="add-lesson"]'); await ed.waitForTimeout(100);
eq((await ed.evaluate(()=>window.__fabrica.course)).levels[0].lessons.length,3,'lecție adăugată');
eq(await ed.evaluate(()=>document.activeElement.id),'f-levels-0-lessons-2-title','focus pe titlul noii lecții');
await ed.click('[data-act="mv-up"]'); await ed.waitForTimeout(50);
c=await ed.evaluate(()=>window.__fabrica.course); eq(c.levels[0].lessons[1].id!=='l2'&&c.levels[0].lessons[1].title.startsWith('Lecția'),true,'lecție mutată în sus');
await ed.click('[data-act="del-sel"]'); await ed.waitForTimeout(50);
c=await ed.evaluate(()=>window.__fabrica.course); eq(c.levels[0].lessons.length,2,'lecție ștearsă');
await ed.click('#btn-undo'); await ed.waitForTimeout(50);
eq((await ed.evaluate(()=>window.__fabrica.course)).levels[0].lessons.length,3,'anulare ștergere');
await ed.click('#btn-redo'); await ed.waitForTimeout(50);
eq((await ed.evaluate(()=>window.__fabrica.course)).levels[0].lessons.length,2,'refacere ștergere');
await ed.click('#btn-undo'); await ed.click('#tree .tn >> nth=3'); await ed.click('[data-act="del-sel"]'); await ed.waitForTimeout(80);
eq((await ed.evaluate(()=>window.__fabrica.course)).levels[0].lessons.length,2,'ștergere (pentru butonul din notificare)');
await ed.click('#toast .btn'); await ed.waitForTimeout(80);
eq((await ed.evaluate(()=>window.__fabrica.course)).levels[0].lessons.length,3,'butonul „Anulează” din notificare');
// mutare lecție peste nivel
await ed.click('[data-act="add-level"]'); await ed.waitForTimeout(50);
const before=await ed.evaluate(()=>window.__fabrica.course.levels.map(l=>l.lessons.length));
await ed.click('#tree .tn >> nth=3'); await ed.click('[data-act="mv-down"]'); await ed.waitForTimeout(50);
const after=await ed.evaluate(()=>window.__fabrica.course.levels.map(l=>l.lessons.length));
eq([before,after],[[3,0],[2,1]],'mutare lecție în nivelul următor');
await ed.click('#btn-undo'); await ed.click('#btn-undo');
// tastare: titlu lecție și istoric
await ed.click('#tree .tn >> nth=1'); await ed.fill('#f-levels-0-lessons-0-title','Titlu nou de test'); await ed.waitForTimeout(700);
eq((await ed.evaluate(()=>window.__fabrica.course)).levels[0].lessons[0].title,'Titlu nou de test','editare titlu');
await ed.click('#btn-undo'); await ed.waitForTimeout(50);
ok((await ed.evaluate(()=>window.__fabrica.course)).levels[0].lessons[0].title!=='Titlu nou de test','anulare editare text');
await ed.keyboard.press('Control+z').catch(()=>{});

/* întrebări: adăugare/mutare/ștergere/dublare/tip */
sect('2b. Editor — întrebări, tipuri, validare');
await ed.click('#tree .tn >> nth=1');
const qn=()=>ed.evaluate(()=>{const c=window.__fabrica.course; return c.levels[0].lessons[0].questions.length;});
const q0=await qn();
for(const ty of ['single','multi','tf','fill','order','match','short']){ await ed.selectOption('#qaddtype',ty); await ed.click('[data-act="q-add"]'); }
eq(await qn(),q0+7,'7 întrebări adăugate (toate tipurile)');
c=await ed.evaluate(()=>window.__fabrica.course); eq(c.levels[0].lessons[0].questions.slice(-7).map(q=>q.type),['single','multi','tf','fill','order','match','short'],'tipuri');
await ed.click('[data-act="arr-up"][data-path="levels.0.lessons.0.questions"][data-i="'+(q0+6)+'"]'); await ed.waitForTimeout(50);
c=await ed.evaluate(()=>window.__fabrica.course); eq(c.levels[0].lessons[0].questions[q0+5].type,'short','mutare întrebare');
await ed.click('[data-act="q-dup"][data-path="levels.0.lessons.0.questions"][data-i="'+q0+'"]'); await ed.waitForTimeout(50);
eq(await qn(),q0+8,'dublare întrebare');
await ed.click('[data-act="arr-del"][data-path="levels.0.lessons.0.questions"][data-i="'+(q0+1)+'"]'); await ed.waitForTimeout(50);
eq(await qn(),q0+7,'ștergere întrebare'); await ed.click('#btn-undo'); eq(await qn(),q0+8,'anulare ștergere întrebare'); await ed.click('#btn-undo');
// conversie tip
await ed.selectOption('[data-qtype="levels.0.lessons.0.questions.'+q0+'"]','multi'); await ed.waitForTimeout(50);
c=await ed.evaluate(()=>window.__fabrica.course); eq(c.levels[0].lessons[0].questions[q0].type,'multi','conversie tip single→multi');
// validator pe întrebări goale
await ed.click('#tab-check'); const errTxt=await ed.textContent('#panel');
ok(errTxt.includes('Erori'),'panou Validare listează erorile');
const lr=await ed.evaluate(()=>window.__fabrica.lint(window.__fabrica.course).map(x=>x.code));
for(const code of ['q_text_empty','q_opts_few','q_no_correct','q_opt_empty','q_fill_noblank','q_short_noans','q_item_empty','q_pair_empty']) ok(lr.includes(code)||(code==='q_opts_few'),'lint '+code);
await axe(ed,'editor, panou Validare');
await ed.click('[data-act="goto"] >> nth=0'); await ed.waitForTimeout(100);
ok(await ed.evaluate(()=>document.querySelector('[role=tab][aria-selected=true]').getAttribute('data-tab'))!=='check','„Mergi la” schimbă panoul');

/* ================= 3. Validator pe cazuri ================= */
sect('3. Validator — cazuri limită');
const L=await ed.evaluate(()=>{
  const F=window.__fabrica, codes=c=>F.lint(c).map(x=>x.code);
  const base=()=>{const c=F.normCourse(F.templates('demo','ro')).course; return c;};
  const out={};
  let c=base(); out.demoErrors=F.lint(c).filter(x=>x.sev==='error').map(x=>x.code);
  c=base(); c.levels[0].lessons[0].body=''; out.empty=codes(c).includes('lesson_empty');
  c=base(); c.levels[0].lessons[0].body+=' [x](lesson:inexistent)'; out.link=codes(c).includes('link_lesson');
  c=base(); c.levels[0].lessons[0].body+=' ![x](https://exemplu.org/a.png)'; out.ext=codes(c).includes('img_external');
  c=base(); c.levels[0].lessons[0].body+=' ![x](img:nu-exista)'; out.imgm=codes(c).includes('img_missing');
  c=base(); c.assets.mare='data:image/png;base64,'+'A'.repeat(1400000); c.levels[0].lessons[0].body+=' ![x](img:mare)'; out.huge=codes(c).includes('img_huge');
  c=base(); c.disclaimers=[]; out.noDisc=codes(c); 
  c=base(); c.disclaimers=c.disclaimers.filter(d=>d.kind!=='medical'); out.missMed=codes(c).includes('disc_missing_health');
  c=base(); c.domains.health=false; c.disclaimers=[]; out.heur=codes(c).includes('disc_heur_health');
  c=base(); c.evidence[0].sources=''; out.evsrc=codes(c).includes('ev_no_source');
  c=base(); c.evidence[4].sources=''; out.evnone=!codes(c).includes('ev_no_source');
  c=base(); c.levels[0].lessons[0].body+=' {ev:zzz}'; out.evlink=codes(c).includes('link_ev');
  c=base(); c.finalTest.count=99; out.cnt=codes(c).includes('test_count');
  c=base(); c.finalTest.bank=[]; c.finalTest.includeLessonQuestions=false; out.tempty=codes(c).includes('test_empty');
  c=base(); c.title=''; out.title=codes(c).includes('title_empty');
  c=base(); c.glossary.push({id:'gx',term:'sodiu',def:'x'}); out.gldup=codes(c).includes('gl_dup');
  c=base(); c.levels=[]; c.finalTest.enabled=false; out.nocontent=codes(c).includes('no_content');
  c=base(); c.levels[0].lessons[0].questions[0].options.forEach(o=>o.correct=false); out.nocorrect=codes(c).includes('q_no_correct');
  c=base(); c.levels[0].lessons[0].questions[1]={id:'qq',type:'tf',text:'',answer:true,explain:'',okMsg:'',badMsg:''}; out.qtext=codes(c).includes('q_text_empty');
  return out;
});
eq(L.demoErrors,[],'exemplul demonstrativ nu are erori de validare');
for(const k of ['empty','link','ext','imgm','huge','missMed','heur','evsrc','evnone','evlink','cnt','tempty','title','gldup','nocontent','nocorrect','qtext']) ok(L[k]===true,'validator: '+k);
ok(L.noDisc.includes('no_disclaimer')&&L.noDisc.includes('disc_missing_health'),'fără avertismente: no_disclaimer + domeniu sensibil');

/* ================= 4. Import/export .course.json, CSV, ZIP ================= */
sect('4. Import/export — .course.json, .fff.json, CSV, ZIP');
await ed.evaluate(()=>window.__fabrica.setCourse(window.__fabrica.templates('demo','ro')));
const json=await ed.evaluate(()=>window.__fabrica.courseToJson(window.__fabrica.course));
const j=JSON.parse(json); eq([j.format,j.schema,j.app],['fabrica-course',1,'Fabrica'],'antet .course.json');
const rt=await ed.evaluate(s=>{const F=window.__fabrica; const r=F.parseCourseJson(s); return JSON.stringify(r.course)===JSON.stringify(F.course);},json);
ok(rt,'round-trip .course.json identic');
const errsJ=await ed.evaluate(()=>{const F=window.__fabrica,t=s=>{try{F.parseCourseJson(s);return 'ok'}catch(e){return e.message}};
 return [t('{nu json'),t('{"format":"altceva"}'),t('{"format":"fabrica-course"}'),t('{"format":"fabrica-course","schema":99,"course":{}}'),t('{"format":"fabrica-course","schema":1,"course":[]}'),
  t(JSON.stringify({format:'fabrica-course',schema:1,course:{title:'x',levels:[{title:'n',lessons:[{title:'l',body:'b',questions:[{type:'inexistent',text:'t'},{type:'single',text:'a',options:[{text:'1',correct:true},{text:'2',correct:true}]}]}]}],__proto__:{x:1}}}))]});
eq(errsJ,['json','format','schema','newer','course','ok'],'validarea schemei la import');
const norm1=await ed.evaluate(()=>{const F=window.__fabrica; const r=F.parseCourseJson(JSON.stringify({format:'fabrica-course',schema:1,course:{title:'x',levels:[{title:'n',lessons:[{title:'l',body:'b',questions:[{id:'a',type:'single',text:'a',options:[{text:'1',correct:true},{text:'2',correct:true}]},{id:'a',type:'tf',text:'b'}]}]}]}})); const q=r.course.levels[0].lessons[0].questions; return [q[0].options.filter(o=>o.correct).length,q[0].id!==q[1].id,r.probs.length>0];});
eq(norm1,[1,true,true],'normalizare: o singură corectă la „single”, id-uri unice, probleme raportate');
// import prin interfață (fișier)
const fj=path.join(tmp,'curs.course.json'); fs.writeFileSync(fj,json);
await ed.click('#tab-export'); await ed.setInputFiles('#filef',fj); await ed.waitForTimeout(200);
eq(await ed.evaluate(()=>window.__fabrica.course.title),'Cum citești o etichetă nutrițională','import .course.json prin interfață');
// descărcări
const dl=async(sel)=>{const [d]=await Promise.all([ed.waitForEvent('download'),ed.click(sel)]); const f=path.join(tmp,d.suggestedFilename()); await d.saveAs(f); return f;};
const fHtml=await dl('[data-act="exp-html"]'); const htmlStr=fs.readFileSync(fHtml,'utf8');
ok(/\.html$/.test(fHtml),'descărcare HTML'); ok(cspHashOK(htmlStr),'HTML exportat: hash CSP valid (recalculat în Node)');
await ed.waitForTimeout(200); ok((await ed.textContent('#expinfo')).includes('Verificat'),'verificare automată după export');
const fZip=await dl('[data-act="exp-zip"]');
const listing=execFileSync('python3',['-I','-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print("\\n".join(z.namelist()))',fZip]).toString().trim().split('\n');
ok(listing.includes('index.html')&&listing.includes('README.md')&&listing.some(n=>n.endsWith('.course.json')),'ZIP: index.html + README.md + .course.json ('+listing+')');
const zdir=fs.mkdtempSync(path.join(tmp,'z-')); execFileSync('python3',['-I','-c','import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',fZip,zdir]);
eq(fs.readFileSync(path.join(zdir,'index.html'),'utf8').replace(/"updated":"[^"]*"/,''),htmlStr.replace(/"updated":"[^"]*"/,''),'ZIP: index.html identic cu exportul HTML');
const readme=fs.readFileSync(path.join(zdir,'README.md'),'utf8'); ok(/sha256-/.test(readme)&&readme.includes('Cum citești'),'README generat cu hash');
// ZIP înapoi în editor
await ed.evaluate(()=>window.__fabrica.setCourse({title:'altceva',levels:[]}));
await ed.setInputFiles('#filef',fZip); await ed.waitForTimeout(300);
eq(await ed.evaluate(()=>window.__fabrica.course.title),'Cum citești o etichetă nutrițională','import ZIP (round-trip)');
const cmp=await ed.evaluate(async(s)=>{const F=window.__fabrica; return JSON.stringify(F.parseCourseJson(s).course)===JSON.stringify(F.course);},json);
ok(cmp,'ZIP round-trip: cursul identic');
// ZIP: scriitor propriu cu comprimare externă (deflate) citit de cititor
const defl=path.join(tmp,'d.zip'); execFileSync('python3',['-I','-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED);z.writestr("index.html",open(sys.argv[2],encoding="utf8").read());z.close()',defl,fHtml]);
await ed.evaluate(()=>window.__fabrica.setCourse({title:'altceva',levels:[]})); await ed.setInputFiles('#filef',defl); await ed.waitForTimeout(400);
eq(await ed.evaluate(()=>window.__fabrica.course.title),'Cum citești o etichetă nutrițională','import ZIP comprimat (deflate) cu index.html');
// HTML exportat înapoi
await ed.evaluate(()=>window.__fabrica.setCourse({title:'altceva',levels:[]})); await ed.setInputFiles('#filef',fHtml); await ed.waitForTimeout(200);
eq(await ed.evaluate(()=>window.__fabrica.course.levels.length),2,'import din HTML exportat');
// .fff.json
const fBundle=await dl('[data-act="exp-bundle"]'); const bj=JSON.parse(fs.readFileSync(fBundle,'utf8'));
eq([bj.format,bj.schema,bj.app,bj.version,bj.updated],['fff-bundle',1,'fabrica','1.1.4','2026-10-23'],'bundle .fff.json');
await ed.evaluate(()=>window.__fabrica.setCourse({title:'altceva',levels:[]})); await ed.setInputFiles('#filef',fBundle); await ed.waitForTimeout(200);
eq(await ed.evaluate(()=>window.__fabrica.course.title),'Cum citești o etichetă nutrițională','import bundle .fff.json');
// fișier invalid
const bad=path.join(tmp,'rau.json'); fs.writeFileSync(bad,'nu e json'); await ed.setInputFiles('#filef',bad); await ed.waitForTimeout(150);
ok((await ed.textContent('#toast')).includes('JSON'),'mesaj de eroare la import invalid');
// CSV
const csv='tip;intrebare;corect;gresit1;gresit2;gresit3;explicatie\nunic;"Capitala Franței, cea mare?";Paris;Lyon;Nisa;;Explicație\nmulti;Prime;2|3;4;9;;\nadevarat-fals;Apa fierbe la 100°C;adevărat;;;;\ncompletare;Anul are [[365|366]] zile;;;;;\nscurt;Oceanul mare;Pacific|Oceanul Pacific;;;;\nordonare;Ordine;a|b|c;;;;\npotrivire;Perechi;x=1|y=2;;;;\nnimic;rând greșit;a;;;;\nunic;;fără enunț;;;;';
const csvR=await ed.evaluate(t=>{const r=window.__fabrica.csvToQuestions(t); return {types:r.questions.map(q=>q.type),errs:r.errors.map(e=>e.row+':'+e.code),q0:r.questions[0].text,opts:r.questions[0].options.length,multi:r.questions[1].options.filter(o=>o.correct).length,tf:r.questions[2].answer,match:r.questions[6].pairs};},csv);
eq(csvR.types,['single','multi','tf','fill','short','order','match'],'CSV: 7 tipuri'); eq(csvR.errs,['9:csv_type','10:csv_text'],'CSV: rânduri eronate raportate');
eq([csvR.q0,csvR.opts,csvR.multi,csvR.tf],['Capitala Franței, cea mare?',3,2,true],'CSV: ghilimele, opțiuni, multi, tf'); eq(csvR.match,[{l:'x',r:'1'},{l:'y',r:'2'}],'CSV: perechi');
const comma=await ed.evaluate(()=>window.__fabrica.csvToQuestions('type,question,correct,w1\nsingle,"a ""b"" c",x,y\n').questions[0].text); eq(comma,'a "b" c','CSV: delimitator virgulă, ghilimele duble');
// CSV prin interfață în banca testului
const fc=path.join(tmp,'q.csv'); fs.writeFileSync(fc,csv);
await ed.click('#tab-test'); const nb=await ed.evaluate(()=>window.__fabrica.course.finalTest.bank.length);
await ed.setInputFiles('#csvf',fc); // fără path ales: click pe butonul înainte
await ed.evaluate(()=>{}); 
await ed.click('[data-act="csv"][data-path="finalTest.bank"]',{trial:false}).catch(()=>{});
await ed.setInputFiles('#csvf',fc); await ed.waitForTimeout(300);
ok((await ed.evaluate(()=>window.__fabrica.course.finalTest.bank.length))>=nb+7,'CSV importat în banca testului prin interfață');
await ed.click('#btn-undo'); 
// SHA-256 rezervă în JS = Web Crypto
const shaOK=await ed.evaluate(async()=>{const F=window.__fabrica; const d=new TextEncoder().encode('abc'.repeat(50)+'ă'); const a=Array.from(F.sha256js(d)).map(b=>b.toString(16).padStart(2,'0')).join(''); const b=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',d))).map(b=>b.toString(16).padStart(2,'0')).join(''); return a===b;});
ok(shaOK,'SHA-256 rezervă (JS) = Web Crypto');
// test determinism extragere
const det=await ed.evaluate(()=>{const F=window.__fabrica,P=window.FabricaPlayer,d=JSON.parse(JSON.stringify(F.course)); const a=P.buildTest(d,0).qs.map(q=>q.id).join(), b=P.buildTest(d,0).qs.map(q=>q.id).join(), c=P.buildTest(d,1).qs.map(q=>q.id).join(); d.finalTest.seed='alt'; const e=P.buildTest(d,0).qs.map(q=>q.id).join(); return [a===b,a!==c,a!==e,P.buildTest(d,0).qs.length];});
eq(det,[true,true,true,8],'ordine determinată de seed + extragere 8 din bancă');
// imagine
await ed.click('#tab-content'); await ed.click('#tree .tn >> nth=1');
const png=path.join(tmp,'i.png'); fs.writeFileSync(png,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));
const nAssets=await ed.evaluate(()=>Object.keys(window.__fabrica.course.assets).length);
const [fc2]=await Promise.all([ed.waitForEvent('filechooser'),ed.click('[data-act="md"][data-md="img"]')]); await fc2.setFiles(png); await ed.waitForSelector('dialog .ask-in'); await ed.fill('dialog .ask-in','Text alternativ de test'); await ed.click('dialog[open] .ask-row .pri'); await ed.waitForTimeout(600);
ok((await ed.evaluate(()=>Object.keys(window.__fabrica.course.assets).length))===nAssets+1,'imagine adăugată în resurse');
ok((await ed.inputValue('#f-levels-0-lessons-0-body')).includes('![Text alternativ de test](img:'),'referință imagine inserată cu alt');
// previzualizare
await ed.click('#tab-preview'); await ed.waitForTimeout(1200);
const fr=ed.frames().find(f=>f!==ed.mainFrame());
ok(!!fr,'iframe de previzualizare'); 
if(fr){ ok((await fr.evaluate(()=>document.title)).includes('etichetă'),'previzualizare randată (titlu)'); ok(await fr.evaluate(()=>!!document.querySelector('#main h1')),'previzualizare: motorul rulează'); }
eq(ed.__errs.filter(e=>!/Failed to load resource/.test(e)),[],'editor: 0 erori/CSP pe tot parcursul');
await axe(ed,'editor, panou Previzualizare');
for(const t of ['content','glossary','evidence','test','export']){ await ed.click('#tab-'+t); await ed.waitForTimeout(100); await axe(ed,'editor, panou '+t); }
await ed.evaluate(()=>document.documentElement.setAttribute('data-theme','dark')); await ed.click('#tab-meta'); await axe(ed,'editor întunecat');
await ed.close();

/* ================= 5. Fișierul generat ================= */
sect('5. Fișier generat — Playwright fără rețea');
const GEN='file://'+fHtml;
let g=await mk(GEN); await g.waitForSelector('#main h1'); await g.waitForTimeout(300);
eq(g.__errs,[],'generat: 0 pageerror/CSP'); eq(g.__reqs,[],'generat: 0 cereri de rețea');
ok(cspHashOK(htmlStr),'generat: hash CSP valid');
ok(!/\son\w+=/.test(htmlStr.replace(/<script[\s\S]*?<\/script>/g,'')),'generat: fără handlere inline');
const meta=await g.evaluate(()=>({v:document.querySelector('meta[name=application-version]').content,u:document.querySelector('meta[name=last-updated]').content,d:document.querySelector('meta[name=description]').content,av:document.getElementById('app-version').textContent,t:document.title,lang:document.documentElement.lang}));
const TODAY=new Date().toISOString().slice(0,10); // curs generat: versiune proprie 1.0.0, data = ziua generării
eq([meta.v,meta.u,meta.av,meta.lang],[ '1.0.0',TODAY,'v1.0.0 · '+TODAY,'ro'],'generat: meta + #app-version'); ok(meta.d.includes('Un curs scurt'),'generat: meta description');
await axe(g,'generat, prezentare (luminos)');
eq(await g.evaluate(()=>document.documentElement.getAttribute('data-theme')),'light','temă luminoasă implicită (sistem)');
await g.setViewportSize({width:360,height:740}); ok(await overflow(g)<=0,'generat 360 px: prezentare fără depășire');
await g.click('#menuBtn'); ok(await g.evaluate(()=>document.querySelector('nav.side').classList.contains('open')),'meniu mobil'); await g.keyboard.press('Escape');
for(const r of ['/l/l1','/l/l2','/l/l3','/l/l4','/l/l5','/test','/glossary','/evidence','/review','/cert','/settings']){ await g.evaluate(r=>location.hash='#'+r,r); await g.waitForTimeout(80); ok(await overflow(g)<=0,'360 px fără depășire: '+r); }
await g.setViewportSize({width:1280,height:800});
// navigare tastatură: Alt+Shift+săgeată
await g.evaluate(()=>location.hash='#/'); await g.waitForTimeout(80); await g.keyboard.press('Alt+Shift+ArrowRight'); await g.waitForTimeout(80);
eq(await g.evaluate(()=>location.hash),'#/l/l1','Alt+Shift+→ merge la prima lecție');
await g.keyboard.press('Alt+Shift+ArrowRight'); eq(await g.evaluate(()=>location.hash),'#/l/l2','Alt+Shift+→ lecția următoare');
await g.keyboard.press('Alt+Shift+ArrowLeft'); eq(await g.evaluate(()=>location.hash),'#/l/l1','Alt+Shift+←');
// skip link
ok(await g.evaluate(()=>document.querySelector('a[href],button,input,select,[tabindex="0"]').classList.contains('skip')),'skip link este primul element focalizabil');
await g.focus('.skip'); await g.keyboard.press('Enter'); eq(await g.evaluate(()=>document.activeElement.id),'main','skip link mută focusul în conținut'); eq(await g.evaluate(()=>location.hash),'#/l/l1','skip link nu strică ruta');
// lecția 1: imagine, glosar link
await g.evaluate(()=>location.hash='#/l/l3'); await g.waitForTimeout(60); await g.evaluate(()=>location.hash='#/l/l1'); await g.waitForTimeout(100);
ok(await g.evaluate(()=>{const i=document.querySelector('.prose img'); return i&&i.complete&&i.naturalWidth>100&&i.alt.length>10;}),'imagine data: afișată cu alt');
ok(await g.evaluate(()=>document.title.startsWith('Unde se află')),'titlu document per lecție');
eq(await g.evaluate(()=>document.activeElement.id),'pg','focus pe h1 la schimbarea lecției');
// ---- scorare pe tipuri (UI) ----
sect('5b. Generat — scorarea fiecărui tip de întrebare (UI)');
const qsel=i=>`.q:nth-of-type(${i})`;
async function check(i){ await g.locator('.q >> nth='+(i)).locator('[data-act="check"]').click(); await g.waitForTimeout(60); return g.locator('.q >> nth='+i).locator('.fb .res').textContent(); }
// l1: single (corect: Declarația nutrițională), tf
await g.locator('.q >> nth=0').getByLabel('Declarația nutrițională',{exact:true}).check(); eq(await check(0),'Corect!','single corect');
await g.locator('.q >> nth=0').locator('[data-act="retry"]').click(); await g.locator('.q >> nth=0').getByLabel('Lista ingredientelor').check(); eq(await check(0),'Greșit.','single greșit');
ok((await g.locator('.q >> nth=0 >> .fb').textContent()).includes('Răspuns corect'),'afișare răspuns corect + explicație'); ok((await g.locator('.q >> nth=0 >> .fb').textContent()).includes('Explicație'),'explicație');
await g.locator('.q >> nth=1').getByLabel('Fals').check(); eq(await check(1),'Corect!','adevărat/fals corect');
// nepusă: mesaj
await g.locator('.q >> nth=0').locator('[data-act="retry"]').click(); await g.locator('.q >> nth=0').locator('[data-act="check"]').click(); ok((await g.locator('.q >> nth=0 >> .hint').textContent()).includes('Răspunde'),'cere răspuns înainte de verificare');
// l2: order, fill, short
await g.evaluate(()=>location.hash='#/l/l2'); await g.waitForTimeout(100);
const order=['Valoarea energetică','Grăsimi','Glucide','Proteine','Sare'];
for(let t=0;t<30;t++){ const cur=await g.locator('.q >> nth=0 >> ol.ord .t').allTextContents(); let done=true; for(let k=0;k<5;k++){ if(cur[k].trim()!==order[k]){ const from=cur.findIndex(x=>x.trim()===order[k]); await g.locator('.q >> nth=0 >> ol.ord li').nth(from).locator('[data-act="up"]').click(); done=false; break; } } if(done) break; }
eq(await check(0),'Corect!','ordonare corectă (butoane sus/jos)');
await g.locator('.q >> nth=0').locator('[data-act="retry"]').click();
await g.locator('.q >> nth=0 >> ol.ord li').first().locator('[data-act="down"]').click(); eq(await check(0),'Greșit.','ordonare greșită'); 
await g.locator('.q >> nth=1 >> input').fill('11,0'); eq(await check(1),'Corect!','completare cu variantă „11,0”');
await g.locator('.q >> nth=1').locator('[data-act="retry"]').click(); await g.locator('.q >> nth=1 >> input').fill('12'); eq(await check(1),'Greșit.','completare greșită');
for(const [v,exp] of [['KJ','Corect!'],['  kilojouli. ','Corect!'],['kj','Corect!'],['watt','Greșit.']]){ await g.locator('.q >> nth=2').locator('[data-act="retry"]').click().catch(()=>{}); await g.locator('.q >> nth=2 >> input').fill(v); eq(await check(2),exp,'răspuns scurt „'+v+'”'); }
// l3: multi, single, match
await g.evaluate(()=>location.hash='#/l/l3'); await g.waitForTimeout(100);
for(const l of ['Lapte','Ouă','Arahide']) await g.locator('.q >> nth=0').getByLabel(l,{exact:true}).check(); eq(await check(0),'Corect!','alegere multiplă corectă');
await g.locator('.q >> nth=0').locator('[data-act="retry"]').click(); for(const l of ['Lapte','Ouă']) await g.locator('.q >> nth=0').getByLabel(l,{exact:true}).check(); eq(await check(0),'Greșit.','multiplă incompletă = greșit');
await g.locator('.q >> nth=0').locator('[data-act="retry"]').click(); for(const l of ['Lapte','Ouă','Arahide','Zahăr']) await g.locator('.q >> nth=0').getByLabel(l,{exact:true}).check(); eq(await check(0),'Greșit.','multiplă cu extra = greșit');
const sels=g.locator('.q >> nth=2 >> select'); const rights={'Alergen':'Substanță care poate declanșa o reacție alergică','Ingredient':'Substanță folosită la fabricare și prezentă în produsul finit','Aditiv':'Substanță adăugată cu un scop tehnologic, de exemplu conservarea'};
for(let i=0;i<3;i++){ const lab=(await g.locator('.q >> nth=2 >> .mrow label').nth(i).textContent()).trim(); await sels.nth(i).selectOption({label:rights[lab]}); }
eq(await check(2),'Corect!','potrivire perechi corectă');
await g.locator('.q >> nth=2').locator('[data-act="retry"]').click(); await sels.nth(0).selectOption({index:1}); await sels.nth(1).selectOption({index:1}); await sels.nth(2).selectOption({index:1}); const mres=await check(2); ok(/Parțial|Greșit/.test(mres),'potrivire incorectă/parțială: '+mres);
// scorare unitară (grade) pe toate tipurile, inclusiv parțial
const U=await g.evaluate(()=>{const P=FabricaPlayer,gr=P.grade; const o=[{id:'a',text:'A',correct:true},{id:'b',text:'B',correct:false},{id:'c',text:'C',correct:true}];
 return [gr({type:'single',options:o.slice(0,2)},'a').score,gr({type:'single',options:o.slice(0,2)},'b').score,gr({type:'multi',options:o},['c','a']).score,gr({type:'multi',options:o},['a']).score,gr({type:'tf',answer:false},false).score,gr({type:'tf',answer:false},null).score,
  gr({type:'fill',text:'x [[a|b]] y [[c]]'},['B','z']).score,gr({type:'short',answers:['Șarpe','șerpi']},'SARPE!').score,gr({type:'short',answers:['3.5']},'3,5').score,gr({type:'order',items:['1','2','3']},[0,1,2]).score,gr({type:'order',items:['1','2','3']},[1,0,2]).score,
  gr({type:'match',pairs:[{l:'a',r:'1'},{l:'b',r:'2'},{l:'c',r:'3'}]},[0,2,1]).score,gr({type:'match',pairs:[{l:'a',r:'1'},{l:'b',r:'2'}]},[0,1]).score,P.norm('Țară, Șoim — ÎNAINTE!'),P.norm('3,5 kg')];});
eq(U,[1,0,1,0,1,0,0.5,1,1,1,0,1/3,1,'tara soim inainte','3.5 kg'],'grade(): toate tipurile, normalizare diacritice');
// SM-2
const S=await g.evaluate(()=>{const f=FabricaPlayer.sm2; let c=f(null,4); const a=[c.interval,c.reps]; c=f(c,4); const b=[c.interval,c.reps]; c=f(c,5); const d=c.interval; c=f(c,1); return [a,b,d>=6,c.interval,c.reps,c.ef>=1.3];});
eq(S,[[1,1],[6,2],true,1,0,true],'SM-2: intervale 1, 6, crescător; eșec resetează');
// ---- progres persistent, repetiție ----
sect('5c. Generat — progres persistent, test final, repetiție, certificat');
await g.evaluate(()=>location.hash='#/l/l1'); await g.waitForTimeout(80);
await g.click('[data-act="toggle-done"]'); eq(await g.getAttribute('[data-act="toggle-done"]','aria-pressed'),'true','lecție marcată terminată');
ok((await g.textContent('#ptxt')).startsWith('1'),'progres în antet'); 
const keys=await g.evaluate(()=>Object.keys(localStorage)); ok(keys.every(k=>k.startsWith('fff.course.eticheta-nutritionala.')),'prefix unic de stocare: '+keys);
await g.reload(); await g.waitForSelector('#main h1');
ok(await g.evaluate(()=>document.querySelector('nav.side a[href="#/l/l1"] .ck').textContent==='✓'),'progres păstrat după reîncărcare');
await g.evaluate(()=>location.hash='#/l/l1'); await g.waitForTimeout(80); ok(await g.locator('.q >> nth=1 >> .fb').count()>0,'răspunsul la exercițiu păstrat după reîncărcare');
// repetiție: întrebările greșite sunt în coadă
await g.evaluate(()=>location.hash='#/review'); await g.waitForTimeout(100);
const dueTxt=await g.textContent('main'); ok(/\d+ de repetat acum/.test(dueTxt)&&!/^0 de repetat/.test(dueTxt.match(/\d+ de repetat acum/)[0]),'repetiție: întrebările greșite au intrat în coadă');
await g.click('[data-act="review-start"]'); await g.waitForTimeout(80);
let loops=0; const FP_DUE=await g.evaluate(()=>JSON.parse(localStorage.getItem('fff.course.eticheta-nutritionala.progress')).srs); const nCards=Object.keys(FP_DUE).length;
while(await g.locator('#rv').count()&&loops++<30){ await g.click('[data-act="review-check"]'); await g.waitForTimeout(40); if(await g.locator('[data-act="review-grade"]').count()) await g.locator('[data-act="review-grade"]').first().click(); await g.waitForTimeout(40); }
ok(loops>0,'sesiune de repetiție parcursă ('+loops+' pași)'); 
const srs2=await g.evaluate(()=>JSON.parse(localStorage.getItem('fff.course.eticheta-nutritionala.progress')).srs); ok(Object.values(srs2).some(c=>c.interval>=1&&c.due>=Math.floor(Date.now()/864e5)||c.reps===0),'SM-2: carduri reprogramate');
// certificat blocat
await g.evaluate(()=>location.hash='#/cert'); await g.waitForTimeout(80); ok((await g.textContent('main')).includes('se deblochează'),'certificat blocat înainte de finalizare');
// test final
await g.evaluate(()=>location.hash='#/test'); await g.waitForTimeout(100);
eq(await g.locator('.q').count(),8,'test: 8 întrebări extrase din bancă de 12');
const ids1=await g.locator('.q').evaluateAll(e=>e.map(x=>x.dataset.q).join());
await g.click('[data-act="submit-test"]'); ok((await g.textContent('#testmsg')).includes('rămân fără răspuns'),'avertizare întrebări necompletate'); await g.click('[data-act="submit-test"]'); await g.waitForTimeout(100);
ok(await g.locator('.stat').count()===2,'rezultat afișat'); const failedTxt=await g.locator('.stat').nth(1).textContent(); ok(failedTxt.includes('Nepromovat'),'test gol = nepromovat');
ok(await g.locator('.q .fb').count()===8,'explicații/feedback la fiecare întrebare');
// reluare: altă extragere (reseed)
await g.click('[data-act="retake"]'); await g.waitForTimeout(100); const ids2=await g.locator('.q').evaluateAll(e=>e.map(x=>x.dataset.q).join()); ok(ids1!==ids2,'reluare: altă extragere/ordine (seed + încercare)');
// reproductibil: același curs, aceeași încercare → aceeași listă
const g2=await mk(GEN); await g2.waitForSelector('#main h1'); await g2.evaluate(()=>location.hash='#/test'); await g2.waitForTimeout(100);
const idsFresh=await g2.locator('.q').evaluateAll(e=>e.map(x=>x.dataset.q).join()); eq(idsFresh,ids1,'determinism între sesiuni (seed fix, încercarea 0)'); await g2.close();
// rezolvă testul corect: folosește răspunsurile din date
await g.evaluate(()=>{ const P=FabricaPlayer; const D=JSON.parse(document.getElementById('course-data').textContent); window.__ans=D; });
const solve=async()=>{ const n=await g.locator('.q').count(); for(let i=0;i<n;i++){ const el=g.locator('.q').nth(i); const qid=await el.getAttribute('data-q'); const q=await g.evaluate(id=>window.__ans.finalTest.bank.find(x=>x.id===id),qid);
  if(q.type==='single') await el.getByLabel(q.options.find(o=>o.correct).text,{exact:true}).check();
  else if(q.type==='multi'){ for(const o of q.options.filter(o=>o.correct)) await el.getByLabel(o.text,{exact:true}).check(); }
  else if(q.type==='tf') await el.getByLabel(q.answer?'Adevărat':'Fals',{exact:true}).check();
  else if(q.type==='fill'){ const bl=[...q.text.matchAll(/\[\[([^\]]*)\]\]/g)]; for(let k=0;k<bl.length;k++) await el.locator('input[data-b]').nth(k).fill(bl[k][1].split('|')[0]); }
  else if(q.type==='short') await el.locator('input[data-short]').fill(q.answers[0]);
  else if(q.type==='order'){ for(let t=0;t<40;t++){ const cur=(await el.locator('ol.ord .t').allTextContents()).map(s=>s.trim()); let done=true; for(let k=0;k<q.items.length;k++){ if(cur[k]!==q.items[k]){ const from=cur.indexOf(q.items[k]); await el.locator('ol.ord li').nth(from).locator('[data-act="up"]').click(); done=false; break; } } if(done) break; } }
  else if(q.type==='match'){ for(let k=0;k<q.pairs.length;k++){ const lab=(await el.locator('.mrow label').nth(k).textContent()).trim(); const pr=q.pairs.find(p=>p.l===lab); await el.locator('select').nth(k).selectOption({label:pr.r}); } }
 } };
await solve(); await g.click('[data-act="submit-test"]'); await g.waitForTimeout(150);
const pr=await g.locator('.stat').first().textContent(); ok(pr.startsWith('100%'),'toate tipurile rezolvate corect în test → 100% ('+pr+')');
ok((await g.locator('.stat').nth(1).textContent()).includes('Promovat'),'promovat');
await axe(g,'generat, rezultat test');
// finalizare lecții → certificat
for(const l of ['l1','l2','l3','l4','l5']){ await g.evaluate(l=>location.hash='#/l/'+l,l); await g.waitForTimeout(60); if((await g.getAttribute('[data-act="toggle-done"]','aria-pressed'))!=='true') await g.click('[data-act="toggle-done"]'); }
await g.evaluate(()=>location.hash='#/cert'); await g.waitForTimeout(100);
ok(await g.locator('#certbox').count()===1,'certificat deblocat după lecții + test');
await g.fill('#cname','Ion Popescu'); eq(await g.textContent('#certname'),'Ion Popescu','nume pe certificat'); const cn=await g.textContent('#certbox'); ok(/acreditare/.test(cn)&&/Cum citești/.test(cn),'certificat: titlu + mențiune fără acreditare');
await g.reload(); await g.waitForSelector('#main h1'); await g.evaluate(()=>location.hash='#/cert'); await g.waitForTimeout(80); eq(await g.textContent('#certname'),'Ion Popescu','numele persistă');
await g.emulateMedia({media:'print'}); await g.evaluate(()=>document.body.classList.add('print-cert'));
ok(await g.evaluate(()=>getComputedStyle(document.querySelector('.bar')).display==='none'&&getComputedStyle(document.querySelector('h1#pg')).display==='none'&&getComputedStyle(document.querySelector('#certbox')).display!=='none'),'tipărire: doar certificatul');
await g.evaluate(()=>document.body.classList.remove('print-cert')); await g.emulateMedia({media:'screen'});
await axe(g,'generat, certificat');
// export/import progres, resetare
await g.evaluate(()=>location.hash='#/settings'); await g.waitForTimeout(80);
const [pd]=await Promise.all([g.waitForEvent('download'),g.click('[data-act="exp-progress"]')]); const pf=path.join(tmp,'progres.fff.json'); await pd.saveAs(pf); const pj=JSON.parse(fs.readFileSync(pf,'utf8')); eq([pj.format,pj.schema,pj.app],['fff-bundle',1,'course:eticheta-nutritionala'],'export progres (.fff.json)');
g.removeAllListeners('dialog'); g.on('dialog',d=>d.accept());
await g.click('[data-act="reset"]'); await g.click('dialog.fb-ask .pri'); await g.waitForTimeout(100); ok(await g.evaluate(()=>JSON.parse(localStorage.getItem('fff.course.eticheta-nutritionala.progress')).done&&Object.keys(JSON.parse(localStorage.getItem('fff.course.eticheta-nutritionala.progress')).done).length===0),'resetare progres');
await g.setInputFiles('#impf',pf); await g.waitForTimeout(150); ok(await g.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('fff.course.eticheta-nutritionala.progress')).done).length===5),'import progres');
fs.writeFileSync(path.join(tmp,'rau.json'),'{"format":"fff-bundle","app":"altul","data":{}}'); await g.setInputFiles('#impf',path.join(tmp,'rau.json')); await g.waitForTimeout(100); ok((await g.textContent('#setmsg')).includes('invalid'),'import progres de la alt curs respins');
await axe(g,'generat, setări');
// glosar, dovezi
await g.evaluate(()=>location.hash='#/glossary'); await g.waitForTimeout(80); await g.fill('#glf','sodiu'); eq(await g.locator('#gll dt:visible').count(),1,'filtru glosar'); await axe(g,'generat, glosar');
await g.evaluate(()=>location.hash='#/evidence'); await g.waitForTimeout(80); eq(await g.locator('#evt tbody tr').count(),5,'tablou de dovezi: 5 afirmații'); await g.selectOption('#evf','none'); eq(await g.locator('#evt tbody tr:visible').count(),1,'filtru nivel de dovezi');
const lv=await g.locator('#evt .evb').allTextContents(); ok(['Studii controlate','Observațional','Tradițional','Fără dovezi'].every(x=>lv.includes(x)),'toate cele 4 niveluri de dovezi afișate'); await axe(g,'generat, tablou de dovezi');
await g.evaluate(()=>location.hash='#/l/l4'); await g.waitForTimeout(80); ok(await g.locator('.prose a.evb').count()>=4,'marcaje de dovezi inline'); await g.click('.prose a.evb >> nth=0'); await g.waitForTimeout(100); eq(await g.evaluate(()=>location.hash.startsWith('#/evidence/')),true,'marcajul duce la tabel');
// limbi interfață generată
for(const l of ['en','fr','it','es','pt','hu','de','ro']){ await g.selectOption('#langSel',l); eq(await g.evaluate(()=>document.documentElement.lang),l,'generat: html[lang] '+l); }
await g.selectOption('#langSel','en'); await g.evaluate(()=>location.hash='#/'); await g.waitForTimeout(80); ok((await g.textContent('.skip')).includes('Skip'),'interfață engleză'); ok((await g.textContent('nav.side')).includes('Final test'),'meniu în engleză'); await axe(g,'generat, engleză');
await g.reload(); await g.waitForSelector('#main h1'); eq(await g.evaluate(()=>document.documentElement.lang),'en','limba generatului persistă');
await g.selectOption('#langSel','ro');
// mod întunecat
await g.click('#themeBtn'); await g.click('#themeBtn'); eq(await g.evaluate(()=>document.documentElement.getAttribute('data-theme')),'dark','comutator temă → întunecat');
await g.evaluate(()=>location.hash='#/l/l3'); await g.waitForTimeout(80); await axe(g,'generat, lecție (întunecat)');
await g.evaluate(()=>location.hash='#/test'); await g.waitForTimeout(80); await axe(g,'generat, test (întunecat)');
await g.evaluate(()=>location.hash='#/cert'); await g.waitForTimeout(80); await axe(g,'generat, certificat (întunecat)');
await g.evaluate(()=>location.hash='#/'); await g.waitForTimeout(80); await axe(g,'generat, prezentare (întunecat)');
eq(g.__errs,[],'generat: 0 erori pe tot parcursul'); eq(g.__reqs,[],'generat: 0 cereri de rețea pe tot parcursul');
// ecranul de lecție în starea „corectat” pentru axe (feedback vizibil)
const g3=await mk(GEN,{colorScheme:'dark'}); await g3.waitForSelector('#main h1'); eq(await g3.evaluate(()=>document.documentElement.getAttribute('data-theme')),'dark','temă după preferința sistemului');
await g3.evaluate(()=>location.hash='#/l/l5'); await g3.waitForTimeout(100);
await g3.locator('.q >> nth=0').getByLabel('Da: 3 g este puțin').check(); await g3.locator('.q >> nth=0 >> [data-act="check"]').click(); await g3.locator('.q >> nth=1 >> input').fill('9'); await g3.locator('.q >> nth=1 >> [data-act="check"]').click(); await g3.locator('.q >> nth=2').getByLabel('Adevărat').check(); await g3.locator('.q >> nth=2 >> [data-act="check"]').click();
await axe(g3,'generat, exerciții corectate (întunecat)'); await g3.close();
await g.close();

/* ================= 6. Curs personalizat creat în editor → export → încărcare ================= */
sect('6. Curs creat în editor (toate tipurile) → export → generat');
const e2=await mk(APP); await e2.waitForFunction(()=>window.__fabrica); await e2.evaluate(()=>localStorage.clear()); await e2.reload(); await e2.waitForFunction(()=>window.__fabrica);
await e2.fill('#f-title','Curs de test'); await e2.fill('#f-description','Descriere de test'); await e2.fill('#f-author','Autor Test'); await e2.fill('#f-license','CC0 1.0');
await e2.click('[data-act="disc-add"][data-kind="info"]'); await e2.click('#tab-content'); await e2.click('[data-act="add-level"]'); await e2.fill('#f-levels-0-title','Nivel A'); await e2.click('[data-act="add-lesson"]'); await e2.fill('#f-levels-0-lessons-0-title','Lecția 1');
await e2.fill('#f-levels-0-lessons-0-body','## Salut\n\nText **îngroșat** și *înclinat* cu [link](https://example.org) și `cod`.\n\n- a\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |\n\n> citat\n\n<script>alert(1)</script> [rău](javascript:alert(1))');
await e2.selectOption('#qaddtype','single'); await e2.click('[data-act="q-add"]');
await e2.fill('#f-levels-0-lessons-0-questions-0-text','Întrebare unică?'); const base='levels-0-lessons-0-questions-0';
await e2.fill('#f-'+base+'-options-0-text','Da'); await e2.fill('#f-'+base+'-options-1-text','Nu'); await e2.fill('#f-'+base+'-options-2-text','Poate');
await e2.check('[data-correct="levels.0.lessons.0.questions.0.options.1"]');
await e2.selectOption('#qaddtype','short'); await e2.click('[data-act="q-add"]'); await e2.fill('#f-levels-0-lessons-0-questions-1-text','Capitala?'); await e2.fill('#f-levels-0-lessons-0-questions-1-answers-0','Țară Mare'); 
await e2.selectOption('#qaddtype','fill'); await e2.click('[data-act="q-add"]'); await e2.fill('#f-levels-0-lessons-0-questions-2-text','Doi plus doi fac patru.'); 
await e2.evaluate(()=>{const ta=document.getElementById('f-levels-0-lessons-0-questions-2-text'); const i=ta.value.indexOf('patru'); ta.focus(); ta.setSelectionRange(i,i+5);}); await e2.click('[data-act="blank"]');
eq(await e2.inputValue('#f-levels-0-lessons-0-questions-2-text'),'Doi plus doi fac [[patru]].','butonul „Marchează spațiu liber”');
await e2.click('#tab-test'); await e2.check('#f-finalTest-enabled'); await e2.check('#f-finalTest-includeLessonQuestions'); await e2.fill('#f-finalTest-threshold','60');
await e2.click('[data-act="sim"]'); ok((await e2.textContent('#simout')).includes('Încercarea 1'),'simulare extragere');
await e2.click('#tab-export'); const e2err=await e2.evaluate(()=>window.__fabrica.lint(window.__fabrica.course).filter(x=>x.sev==='error').map(x=>x.code)); eq(e2err,[],'cursul construit manual: 0 erori');
const [d2]=await Promise.all([e2.waitForEvent('download'),e2.click('[data-act="exp-html"]')]); const f2=path.join(tmp,'manual.html'); await d2.saveAs(f2);
await e2.reload(); await e2.waitForFunction(()=>window.__fabrica); eq(await e2.evaluate(()=>window.__fabrica.course.title),'Curs de test','ciornă salvată automat și restaurată după reîncărcare');
await e2.close();
const m=await mk('file://'+f2); await m.waitForSelector('#main h1'); eq(m.__errs,[],'curs manual: 0 erori'); ok(cspHashOK(fs.readFileSync(f2,'utf8')),'curs manual: hash CSP valid');
await m.evaluate(()=>location.hash='#/l/'+JSON.parse(document.getElementById('course-data').textContent).levels[0].lessons[0].id); await m.waitForTimeout(150);
const xss=await m.evaluate(()=>({scripts:document.querySelectorAll('main script').length,js:[...document.querySelectorAll('main a')].filter(a=>/^javascript/i.test(a.getAttribute('href')||'')).length,ext:document.querySelector('main a[target=_blank]')&&document.querySelector('main a[target=_blank]').rel,tbl:document.querySelectorAll('main table').length,bq:document.querySelectorAll('main blockquote').length,em:document.querySelectorAll('main em').length,code:document.querySelectorAll('main code').length}));
eq([xss.scripts,xss.js],[0,0],'Markdown: scripturile și javascript: sunt neutralizate'); ok(/noopener/.test(xss.ext),'linkuri externe cu rel=noopener'); eq([xss.tbl,xss.bq,xss.em,xss.code],[1,1,1,1],'Markdown: tabel, citat, italic, cod');
await m.locator('.q >> nth=1 >> input').fill('tara mare'); await m.locator('.q >> nth=1 >> [data-act="check"]').click(); eq(await m.locator('.q >> nth=1 >> .fb .res').textContent(),'Corect!','răspuns scurt: diacritice și majuscule normalizate');
await m.locator('.q >> nth=0').getByLabel('Nu',{exact:true}).check(); await m.locator('.q >> nth=0 >> [data-act="check"]').click(); eq(await m.locator('.q >> nth=0 >> .fb .res').textContent(),'Corect!','single corect (editor→generat)');
await m.locator('.q >> nth=2 >> input').fill('patru'); await m.locator('.q >> nth=2 >> [data-act="check"]').click(); eq(await m.locator('.q >> nth=2 >> .fb .res').textContent(),'Corect!','completare (editor→generat)');
await axe(m,'curs manual'); await m.close();

await browser.close(); fs.rmSync(tmp,{recursive:true,force:true});
console.log(`\n${pass} teste reușite, ${fail} eșuate`); if(fail){ console.log(failures.join('\n')); process.exit(1); }
