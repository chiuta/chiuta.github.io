import {createRequire} from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const {chromium}=createRequire(process.env.PW_ROOT||import.meta.url)('playwright');
// Cere depozitele aplicațiilor (APPS_ROOT, implicit ../..): Akasha, MarkdownAtelier, AcademiSearch, cu bridge aplicat.
const ROOT=process.env.APPS_ROOT||path.resolve(path.dirname(new URL(import.meta.url).pathname),'../../..');const MAP={'academisearch.chiuta.ro':'AcademiSearch','markdownatelier.chiuta.ro':'MarkdownAtelier','akasha.chiuta.ro':'Akasha'};
let ok=0,fail=0;const t=(n,c)=>{console.log((c?'OK  ':'FAIL')+' '+n);c?ok++:fail++};
(async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:1280,height:800},acceptDownloads:true});
 const errs=[];
 await ctx.route(/https:\/\/[a-z]+\.chiuta\.ro\/.*/,r=>{const u=new URL(r.request().url());const d=MAP[u.hostname];if(!d)return r.abort();
  let p=u.pathname==='/'?'index.html':u.pathname.slice(1);const f=path.join(ROOT,d,p);
  if(!fs.existsSync(f))return r.fulfill({status:404,body:''});
  const ct=f.endsWith('.html')?'text/html':f.endsWith('.json')||f.endsWith('.webmanifest')?'application/json':f.endsWith('.png')?'image/png':'text/plain';
  r.fulfill({status:200,contentType:ct,body:fs.readFileSync(f)});});
 await ctx.route(/^(?!https:\/\/[a-z]+\.chiuta\.ro).*/,r=>r.request().url().startsWith('data:')||r.request().url().startsWith('blob:')?r.continue():r.abort());
 const watch=p=>{p.on('pageerror',e=>errs.push(p.url().slice(8,20)+' '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR/.test(m.text()))errs.push(m.text().slice(0,150))});};
 // 1) AcademiSearch -> MarkdownAtelier
 const A=await ctx.newPage();watch(A);
 await A.goto('https://academisearch.chiuta.ro/');
 await A.evaluate(()=>{localStorage.setItem('academisearch.library',JSON.stringify([
  {k:'doi:10.1/x',title:'Ștefan cel Mare – Δ',authors:'Popescu, Ion; Ionescu, Maria',year:'2024',journal:'Revista Test',doi:'10.1/x',url:'',pdf:'',abstract:'',src:'crossref',saved:'2026-11-01',f:'',note:''},
  {k:'t:beta|2023',title:'Beta',authors:'Doe, J',year:'2023',journal:'',doi:'',url:'https://ex.org/b',pdf:'',abstract:'',src:'x',saved:'2026-11-01',f:'',note:''}]));});
 await A.reload();await A.waitForSelector('#fffSend',{state:'attached'});
 t('AcademiSearch: buton Trimite există',await A.locator('#fffSend').count()===1);
 await A.evaluate(()=>document.getElementById('fffSend').scrollIntoView());
 await A.click('#fffSend');
 const items=await A.$$eval('[role=menuitem]',x=>x.map(e=>e.textContent));
 t('meniu AcademiSearch: MarkdownAtelier+Akasha, fără sine',items.some(x=>/MarkdownAtelier/.test(x))&&items.some(x=>/Akasha/.test(x))&&!items.some(x=>/AcademiSearch/.test(x)));
 const [M]=await Promise.all([ctx.waitForEvent('page'),A.click('[role=menuitem]:has-text("MarkdownAtelier")')]);
 watch(M);await M.waitForLoadState('domcontentloaded');
 await M.waitForSelector('[role=alertdialog]',{timeout:8000});
 t('MarkdownAtelier: bandă de confirmare',true);
 t('hash curățat după primire',!(await M.evaluate(()=>location.hash)));
 const ed0=await M.inputValue('#editor'); t('nimic importat înainte de acord',!/Popescu/.test(ed0));
 await M.click('[role=alertdialog] button >> nth=0');
 const md=await M.inputValue('#editor');
 t('bibliografie în editor',/Popescu, Ion; Ionescu, Maria/.test(md)&&/Ștefan cel Mare – Δ/.test(md)&&/doi\.org\/10\.1\/x/.test(md)&&/Beta/.test(md));
 // 2) MarkdownAtelier -> Akasha
 await M.fill('#editor','# Notă de test\n\nCorp **markdown** ăîșț');
 await M.click('#fffSend');
 const mi=await M.$$eval('[role=menuitem]',x=>x.map(e=>e.textContent));
 t('meniu MarkdownAtelier: Akasha, nu AcademiSearch (accepts)',mi.some(x=>/Akasha/.test(x))&&!mi.some(x=>/AcademiSearch/.test(x)));
 const [K]=await Promise.all([ctx.waitForEvent('page'),M.click('[role=menuitem]:has-text("Akasha")')]);
 watch(K);await K.waitForLoadState('domcontentloaded');
 await K.waitForSelector('[role=alertdialog]',{timeout:8000});
 const before=await K.evaluate(()=>__akasha.getState().records.length);
 await K.click('[role=alertdialog] button >> nth=0');
 const rec=await K.evaluate(()=>__akasha.getState().records[0]);
 t('Akasha: notă importată',rec&&rec.title==='Notă de test'&&/ăîșț/.test(rec.body)&&(await K.evaluate(()=>__akasha.getState().records.length))===before+1);
 t('Akasha: marcat modificat (dirty)',await K.evaluate(()=>document.getElementById('unsavedChip').hidden===false));
 // 3) Akasha -> AcademiSearch CSL (bibliografie)
 const env=await K.evaluate(()=>FFF.bridge.make({type:'citation/csl',src:'t',title:'T',data:[{title:'Gamma',author:[{family:'Z',given:'Y'}],issued:{'date-parts':[[2020]]},DOI:'10.9/g'},{title:'Beta',URL:'https://ex.org/b',issued:{'date-parts':[[2023]]}}]}));
 const link=await K.evaluate(e=>FFF.bridge.toLink(e,'https://academisearch.chiuta.ro/'),env);
 const A2=await ctx.newPage();watch(A2);await A2.goto(link);await A2.waitForSelector('[role=alertdialog]');
 await A2.click('[role=alertdialog] button >> nth=0');
 const lib=await A2.evaluate(()=>JSON.parse(localStorage.getItem('academisearch.library')));
 t('AcademiSearch: referință nouă adăugată, fără dubluri',lib.filter(x=>x.title==='Gamma').length===1&&lib.filter(x=>x.title==='Beta').length===1&&lib.length===3);
 // 4) tip nepotrivit respins
 const bad=await K.evaluate(()=>FFF.bridge.toLink(FFF.bridge.make({type:'quiz/undava',data:{}}),'https://academisearch.chiuta.ro/'));
 const A3=await ctx.newPage();watch(A3);await A3.goto(bad);await A3.waitForTimeout(1500);
 t('tip neacceptat: fără bandă de import',(await A3.locator('[role=alertdialog]').count())===0);
 // 5) Akasha -> MarkdownAtelier din fișa unei înregistrări
 const sendInAk=await K.evaluate(()=>typeof __akasha.extraFoot==='function');t('Akasha: extraFoot înregistrat',sendInAk);
 await K.evaluate(()=>__akasha.openDetail(__akasha.getState().records[0].id));
 await K.waitForTimeout(500);
 const hasSend=await K.locator('.pfoot button:has-text("Trimite"), .pfoot button:has-text("Send")').count();
 t('Akasha: buton Trimite în fișa notei',hasSend>=1);
 const [M2]=await Promise.all([ctx.waitForEvent('page'),(async()=>{await K.locator('.pfoot button:has-text("Trimite"), .pfoot button:has-text("Send")').first().click();await K.click('[role=menuitem]:has-text("MarkdownAtelier")');})()]);
 watch(M2);await M2.waitForSelector('[role=alertdialog]',{timeout:8000});await M2.click('[role=alertdialog] button >> nth=0');
 t('Akasha -> MarkdownAtelier: nota ajunge în editor',/Corp \*\*markdown\*\* ăîșț/.test(await M2.inputValue('#editor')));
 console.log('erori JS:',errs.length?errs:'niciuna');t('fără erori JS',errs.length===0);
 console.log(ok+' ok, '+fail+' fail');await b.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
