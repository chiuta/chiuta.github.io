import {createRequire} from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const {chromium}=createRequire(process.env.PW_ROOT||import.meta.url)('playwright');
// Cere FieldObserver și DataWeave cu bridge aplicat (APPS_ROOT, implicit ../../..).
const ROOT=process.env.APPS_ROOT||path.resolve(path.dirname(new URL(import.meta.url).pathname),'../../..');const MAP={'fieldobserver.chiuta.ro':'FieldObserver','dataweave.chiuta.ro':'DataWeave','poteca.chiuta.ro':'Poteca','urme.chiuta.ro':'URME'};
let ok=0,fail=0;const t=(n,c)=>{console.log((c?'OK  ':'FAIL')+' '+n);c?ok++:fail++};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({serviceWorkers:'block',acceptDownloads:true});const errs=[];
 await ctx.route(/.*/,r=>{const u=new URL(r.request().url());const d=MAP[u.hostname];if(!d)return r.abort();const f=path.join(ROOT,d,u.pathname==='/'?'index.html':u.pathname.slice(1));if(!fs.existsSync(f))return r.fulfill({status:404,body:''});r.fulfill({contentType:f.endsWith('.html')?'text/html':'text/plain',body:fs.readFileSync(f)})});
 const watch=p=>p.on('pageerror',e=>errs.push(e.message.slice(0,120)));
 const F=await ctx.newPage();watch(F);await F.goto('https://fieldobserver.chiuta.ro/');await F.waitForTimeout(800);
 // export real din aplicație (kit FFF.download) — conținut CSV recognoscibil
 await F.evaluate(()=>FFF.download('observatii.csv','specie,loc,nr\nalpha_rara,Buzau,3\nbeta_comuna,Rm Sarat,7\n','text/csv'));
 await F.waitForSelector('button:has-text("↗")',{timeout:5000});
 t('FieldObserver: apare butonul după export CSV',true);
 await F.click('button:has-text("↗")');
 const items=await F.$$eval('[role=menuitem]',x=>x.map(e=>e.textContent));
 t('meniu: DataWeave, nu FieldObserver',items.some(x=>/DataWeave/.test(x))&&!items.some(x=>/FieldObserver/.test(x)));
 const [D]=await Promise.all([ctx.waitForEvent('page'),F.click('[role=menuitem]:has-text("DataWeave")')]);
 watch(D);await D.waitForSelector('[role=alertdialog]',{timeout:8000});
 t('DataWeave: confirmare înainte de import',(await D.evaluate(()=>document.body.innerText)).indexOf('alpha_rara')<0);
 await D.click('[role=alertdialog] button >> nth=0');
 await D.waitForFunction(()=>document.body.innerText.includes('alpha_rara'),null,{timeout:8000}).then(()=>t('DataWeave: date importate prin câmpul de import',true),()=>t('DataWeave: date importate prin câmpul de import',false));
 // GPX real din FieldObserver
 const gl=await F.evaluate(()=>{const b=document.querySelector('[data-act=expGpx]');return !!b});
 console.log('buton GPX în FieldObserver:',gl);
 t('fără erori JS',errs.length===0);if(errs.length)console.log(errs);
 console.log(ok+' ok, '+fail+' fail');await b.close();process.exit(fail?1:0)})().catch(e=>{console.error(e);process.exit(2)});
