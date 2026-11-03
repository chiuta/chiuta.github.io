/* Descoperire (Etapa 3). Rulează după scriptul principal al hub-ului și folosește funcțiile lui (cardKey, liveCards, gotoCard, relatedOf, normTxt, META, CONTENT).
   Totul local: fără rețea, fără stocare persistentă (fișierele alese stau doar în memorie). Sursa: tools/discover/discover.js */
(function(){
'use strict';
/*@@I18N@@*/
const $=id=>document.getElementById(id);
const L=()=>DD[curLang]?curLang:'en';
const dd=(k,...a)=>{ const s=DD[L()][k]!==undefined?DD[L()][k]:(DD.en[k]!==undefined?DD.en[k]:k); return s.replace(/\{(\d+)\}/g,(m,i)=>a[+i]!==undefined?a[+i]:''); };
function el(tag,cls,txt){ const n=document.createElement(tag); if(cls) n.className=cls; if(txt!==undefined) n.textContent=txt; return n; }
function liveHref(key){ const c=cardByKey(key), a=c&&c.querySelector('a.live-link'); return a?a.getAttribute('href'):''; }
function lineOf(key){ const C=(CONTENT[L()]||CONTENT.en).apps||{}, a=C[key]||(CONTENT.en.apps||{})[key]||{}; return a.line||''; }
function secTitle(cat){ const C=(CONTENT[L()]||CONTENT.en).sections||{}; return (C[cat]||{}).title||cat; }
function topicName(tp){ return tp.name[L()]||tp.name.en; }

/* ───────── etichete ───────── */
let lastAsk='', lastAudit=null;
function relabel(){
  document.querySelectorAll('[data-d]').forEach(n=>{ n.textContent=dd(n.dataset.d); });
  document.querySelectorAll('[data-dp]').forEach(n=>{ n.placeholder=dd(n.dataset.dp); });
  document.querySelectorAll('[data-ex]').forEach(n=>{ n.textContent=dd(n.dataset.ex); });
  if(lastAsk) ask(lastAsk,true);
  if(lastAudit) renderAudit(lastAudit);
  if(CS) csRelabel();
  const st=$('ld-status'); if(st&&LD.recs.length) st.textContent=dd('ldStatus',LD.files,LD.recs.length);
  if($('ld-q')&&$('ld-q').value) ldSearch();
}

/* ───────── asistentul „Spune-mi ce ai de făcut” ───────── */
const STOP=new Set('the and for with from that this what how want need have make can use some into about when which then them they you your are was were will would could should please vreau sunt sau pentru care cum unde mai dar este mea meu mele imi ceva fac face facut avea pot poti trebuie vrei despre peste prin nişte niste fara frontiere veux pour une des les dans avec sur mon mes que qui comment voudrais faire vorrei voglio per una uno con dei del della come che quiero para los las mis como quero uma com dos das uns ich will mochte fur und der die das ein eine mit von auf ist wie meine meinen szeretnem szeretnek hogy egy van vagy nem meg hogyan kell akarom'.split(' '));
let AI=null;
function words(str){ return normTxt(str).split(/[^a-z0-9]+/).filter(w=>w.length>=3&&!STOP.has(w)); }
function wm(a,b){ if(a===b) return true; const n=Math.min(a.length,b.length); if(n<4) return false; let i=0; while(i<n&&a[i]===b[i]) i++; return (i===n&&Math.abs(a.length-b.length)<=5)||(i>=5&&i>=n-2); }
function buildAI(){
  AI=liveCards().map(c=>{ const key=cardKey(c); const o={key,cat:c.dataset.cat,title:new Set(words(key.replace(/-?fara-frontiere/i,'').replace(/[-.]/g,' '))),tags:new Set(),text:new Set(),kw:new Set(),topics:[]};
    CONTENT_LANGS.forEach(l=>{ const a=((CONTENT[l]||{}).apps||{})[key]; if(!a) return; words(a.title||'').forEach(w=>o.title.add(w)); (a.tags||[]).forEach(g=>words(g).forEach(w=>o.tags.add(w))); words((a.line||'')+' '+(a.detail||'')).forEach(w=>o.text.add(w)); });
    (META.topics||[]).forEach(tp=>{ if(tp.members.indexOf(key)>-1){ o.topics.push(tp); words(tp.kw).forEach(w=>o.kw.add(w)); } });
    return o; });
}
function hit(set,tk){ if(set.has(tk)) return true; for(const w of set){ if(wm(w,tk)) return true; if(tk.length>=9&&w.length>=5&&tk.indexOf(w)>-1) return true; } return false; } /* a doua condiție: cuvinte compuse (de: Haushaltsbudget) */
function scoreApp(o,toks){
  let s=0; const why=new Set();
  toks.forEach(tk=>{ let b=0;
    if(hit(o.title,tk)) b=6; else if(hit(o.tags,tk)) b=4; else if(hit(o.kw,tk)){ b=3; o.topics.forEach(tp=>{ if(words(tp.kw).some(w=>wm(w,tk))) why.add(topicName(tp)); }); } else if(hit(o.text,tk)) b=1.5;
    if(b){ s+=b; if(b>=4) why.add(tk); } });
  return {o,key:o.key,score:s,why:[...why].slice(0,3)};
}
function suggest(q){
  if(!AI) buildAI();
  const toks=[...new Set(words(q))];
  const scored=AI.map(o=>scoreApp(o,toks)).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
  const plan=[]; let fallback=false;
  if(!scored.length){
    fallback=true;
    ['TranslateHub','AcademiSearch','MarkdownAtelier'].forEach(k=>{ if(cardByKey(k)) plan.push({key:k,why:[],rel:null}); });
    return {plan,fallback,toks};
  }
  const top=scored[0]; plan.push({key:top.key,why:top.why,rel:null});
  const nb=relatedOf(top.key), nbSet=new Set(nb);
  scored.slice(1).map(r=>({r,v:r.score+(nbSet.has(r.key)?2:0)})).filter(x=>x.r.score>=top.score*0.34).sort((a,b)=>b.v-a.v).slice(0,2).forEach(x=>plan.push({key:x.r.key,why:x.r.why,rel:null}));
  if(plan.length<3){
    for(const k of nb){ if(plan.length>=3) break; if(plan.some(p=>p.key===k)||!cardByKey(k)) continue;
      const tp=(META.topics||[]).filter(t=>t.members.indexOf(k)>-1&&t.members.indexOf(top.key)>-1)[0];
      plan.push({key:k,why:[],rel:{to:top.key,topic:tp?topicName(tp):''}}); }
  }
  return {plan,fallback,toks};
}
let askRes=null;
function ask(q,quiet){
  const out=$('ask-out'); out.textContent=''; q=(q||'').trim(); lastAsk=q;
  if(!q){ out.appendChild(el('p','ask-msg',dd('askEmpty'))); return; }
  const r=suggest(q); askRes=r;
  if(r.fallback) out.appendChild(el('p','ask-msg',dd('noMatch')));
  out.appendChild(el('h3','apps-title',dd('planTitle')));
  const ol=el('ol','ask-plan'); out.appendChild(ol);
  r.plan.forEach((p,i)=>{
    const li=el('li',i===0?'is-next':''); li.dataset.key=p.key;
    const n=el('span','ask-n',dd('step',i+1)); if(i===0){ n.appendChild(el('span','nx','· '+dd('nextUp'))); } li.appendChild(n);
    li.appendChild(el('span','ask-name',appTitle(p.key)));
    li.appendChild(el('span','ask-line',lineOf(p.key)));
    if(p.why.length) li.appendChild(el('span','ask-why',dd('matches',p.why.join(', '))));
    else if(p.rel) li.appendChild(el('span','ask-why',dd('relTo',appTitle(p.rel.to),p.rel.topic)));
    const bt=el('div','ask-btns'); const h=liveHref(p.key);
    if(h){ const a=el('a','disc-btn pri',dd('openApp')); a.href=h; a.target='_blank'; a.rel='noopener noreferrer'; a.setAttribute('aria-label',dd('openApp')+': '+appTitle(p.key)); a.dataset.step=String(i); bt.appendChild(a); }
    const g=el('button','disc-btn',dd('showCard')); g.type='button'; g.dataset.goto=p.key; g.dataset.noopen='1'; g.setAttribute('aria-label',dd('showCard')+': '+appTitle(p.key)); bt.appendChild(g);
    li.appendChild(bt); ol.appendChild(li);
  });
}
function markNext(i){ const lis=[...document.querySelectorAll('#ask-out .ask-plan li')]; lis.forEach((li,j)=>{ li.classList.toggle('is-next',j===i+1); const nx=li.querySelector('.nx'); if(nx) nx.remove(); if(j===i+1){ li.querySelector('.ask-n').appendChild(el('span','nx','· '+dd('nextUp'))); } }); }

/* ───────── constelația ───────── */
let CS=null, csPinned='', csZoom=1;
const SVGNS='http://www.w3.org/2000/svg';
function sv(tag,attrs){ const n=document.createElementNS(SVGNS,tag); for(const k in attrs) n.setAttribute(k,attrs[k]); return n; }
function hash(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0)/4294967296; }
function csLayout(keys,cats,edges){
  const secs=[...new Set(cats)]; const N=keys.length, W0=1300, H0=950;
  const ctr={}; secs.forEach((s,i)=>{ const a=-Math.PI/2+i*2*Math.PI/secs.length; ctr[s]=[W0/2+Math.cos(a)*W0*0.34, H0/2+Math.sin(a)*H0*0.34]; });
  const P=keys.map((k,i)=>{ const c=ctr[cats[i]]; return {x:c[0]+(hash(k)-.5)*160, y:c[1]+(hash(k+'y')-.5)*160, vx:0, vy:0}; });
  const idx=new Map(keys.map((k,i)=>[k,i])); const E=edges.map(([a,b])=>[idx.get(a),idx.get(b)]);
  const deg=keys.map(()=>0); E.forEach(([a,b])=>{ deg[a]++; deg[b]++; });
  for(let it=0;it<320;it++){
    const cool=1-it/320;
    for(let i=0;i<N;i++) for(let j=i+1;j<N;j++){ const dx=P[j].x-P[i].x, dy=P[j].y-P[i].y; let d2=dx*dx+dy*dy+.01; if(d2>22500) continue; const d=Math.sqrt(d2), f=(2600/d2)*cool+(d<34?(34-d)*.5:0); const fx=dx/d*f, fy=dy/d*f; P[i].vx-=fx; P[i].vy-=fy; P[j].vx+=fx; P[j].vy+=fy; }
    E.forEach(([a,b])=>{ const dx=P[b].x-P[a].x, dy=P[b].y-P[a].y, d=Math.sqrt(dx*dx+dy*dy)+.01, f=(d-80)*.004; const fx=dx/d*f, fy=dy/d*f; P[a].vx+=fx; P[a].vy+=fy; P[b].vx-=fx; P[b].vy-=fy; });
    for(let i=0;i<N;i++){ const c=ctr[cats[i]]; P[i].vx+=(c[0]-P[i].x)*.012+(W0/2-P[i].x)*.002; P[i].vy+=(c[1]-P[i].y)*.012+(H0/2-P[i].y)*.002; P[i].x+=P[i].vx*.55; P[i].y+=P[i].vy*.55; P[i].vx*=.6; P[i].vy*=.6; }
  }
  for(let it=0;it<60;it++) for(let i=0;i<N;i++) for(let j=i+1;j<N;j++){ const dx=P[j].x-P[i].x, dy=P[j].y-P[i].y, d=Math.sqrt(dx*dx+dy*dy)+.01; if(d<32){ const m=(32-d)/2, ux=dx/d||1, uy=dy/d; P[i].x-=ux*m; P[i].y-=uy*m; P[j].x+=ux*m; P[j].y+=uy*m; } }
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; P.forEach(p=>{ x0=Math.min(x0,p.x); y0=Math.min(y0,p.y); x1=Math.max(x1,p.x); y1=Math.max(y1,p.y); });
  const pad=60; P.forEach(p=>{ p.x=p.x-x0+pad; p.y=p.y-y0+pad; });
  return {P,W:Math.ceil(x1-x0+2*pad),H:Math.ceil(y1-y0+2*pad),deg};
}
function csBuild(){
  const cards=liveCards(); const keys=cards.map(cardKey), cats=cards.map(c=>c.dataset.cat);
  const edges=[], seen=new Set();
  keys.forEach(k=>relatedOf(k).forEach(o=>{ if(keys.indexOf(o)<0) return; const id=k<o?k+'|'+o:o+'|'+k; if(seen.has(id)) return; seen.add(id); edges.push([k,o]); }));
  const lay=csLayout(keys,cats,edges);
  const svg=sv('svg',{class:'cs-svg',role:'group',viewBox:'0 0 '+lay.W+' '+lay.H});
  const gE=sv('g',{class:'cs-edges','aria-hidden':'true'}); svg.appendChild(gE);
  const lines=new Map();
  edges.forEach(([a,b])=>{ const i=keys.indexOf(a), j=keys.indexOf(b); const ln=sv('line',{x1:lay.P[i].x.toFixed(1),y1:lay.P[i].y.toFixed(1),x2:lay.P[j].x.toFixed(1),y2:lay.P[j].y.toFixed(1)}); gE.appendChild(ln); [a,b].forEach(k=>{ if(!lines.has(k)) lines.set(k,[]); lines.get(k).push(ln); }); });
  const gS=sv('g',{'aria-hidden':'true'}); svg.appendChild(gS);
  const secLabels=[...new Set(cats)].map(cat=>{ const ids=cats.map((c,i)=>c===cat?i:-1).filter(i=>i>=0); const cx=ids.reduce((s,i)=>s+lay.P[i].x,0)/ids.length, cy=Math.min(...ids.map(i=>lay.P[i].y))-26; const t=sv('text',{class:'cs-seclabel',x:cx.toFixed(0),y:Math.max(20,cy).toFixed(0)}); gS.appendChild(t); return {cat,t}; });
  const gN=sv('g',{}); svg.appendChild(gN);
  const nodes=new Map();
  keys.forEach((k,i)=>{
    const head=document.getElementById(cats[i]); const cs=head?getComputedStyle(head):null;
    const h=cs?cs.getPropertyValue('--h').trim():'200', c=cs?cs.getPropertyValue('--c').trim():'0.16';
    const g=sv('g',{class:'cs-node',role:'button',tabindex:'-1','data-k':k,'data-cat':cats[i],transform:'translate('+lay.P[i].x.toFixed(1)+','+lay.P[i].y.toFixed(1)+')'});
    g.style.setProperty('--h',h||'200'); g.style.setProperty('--c',c||'0.16');
    g.appendChild(sv('circle',{class:'cs-hit',r:'14'}));
    g.appendChild(sv('circle',{class:'cs-dot',r:String(5.5+Math.min(lay.deg[i],14)*.35)}));
    const t=sv('text',{class:'cs-lbl',x:'12',y:'-9','aria-hidden':'true'}); g.appendChild(t);
    gN.appendChild(g); nodes.set(k,{g,t,i,cat:cats[i]});
  });
  CS={keys,cats,edges,lay,svg,lines,nodes,secLabels,cur:keys[0],secFilter:''};
  nodes.get(keys[0]).g.setAttribute('tabindex','0');
  svg.addEventListener('click',e=>{ const g=e.target.closest&&e.target.closest('.cs-node'); if(g) csGo(g.dataset.k); });
  svg.addEventListener('pointerover',e=>{ const g=e.target.closest&&e.target.closest('.cs-node'); if(g&&g.dataset.k!==csHot) csShow(g.dataset.k); });
  svg.addEventListener('pointerleave',()=>csShow(csPinned||''));
  svg.addEventListener('focusin',e=>{ const g=e.target.closest&&e.target.closest('.cs-node'); if(g){ csSetCur(g.dataset.k); csShow(g.dataset.k); } });
  svg.addEventListener('keydown',csKey);
  $('cs-scroll').appendChild(svg);
  // legendă
  const leg=$('cs-legend');
  [...new Set(cats)].forEach(cat=>{ const b=el('button',null,''); b.type='button'; b.dataset.cat=cat; b.setAttribute('aria-pressed','false'); const head=document.getElementById(cat), cs=getComputedStyle(head); b.style.setProperty('--h',cs.getPropertyValue('--h').trim()); b.style.setProperty('--c',cs.getPropertyValue('--c').trim()); b.style.setProperty('--accent','oklch(.76 var(--c) var(--h))'); leg.appendChild(b); });
  leg.addEventListener('click',e=>{ const b=e.target.closest('button[data-cat]'); if(!b) return; const on=b.getAttribute('aria-pressed')!=='true'; leg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false')); b.setAttribute('aria-pressed',on?'true':'false'); CS.secFilter=on?b.dataset.cat:''; CS.nodes.forEach((n,k)=>n.g.classList.toggle('is-dim',!!CS.secFilter&&n.cat!==CS.secFilter)); });
  csApplyZoom();
}
let csHot='';
function csSetCur(k){ if(CS.cur&&CS.nodes.get(CS.cur)) CS.nodes.get(CS.cur).g.setAttribute('tabindex','-1'); CS.cur=k; CS.nodes.get(k).g.setAttribute('tabindex','0'); }
function csRelabel(){
  CS.nodes.forEach((n,k)=>{ n.t.textContent=appTitle(k); n.g.setAttribute('aria-label',dd('csStar',appTitle(k),secTitle(n.cat),relatedOf(k).length)); });
  CS.secLabels.forEach(s=>{ s.t.textContent=secTitle(s.cat).split(/[:,—]/)[0].trim(); });
  CS.svg.setAttribute('aria-label',dd('csGraph'));
  $('cs-legend').querySelectorAll('button').forEach(b=>{ b.textContent=secTitle(b.dataset.cat); }); $('cs-legend').setAttribute('aria-label',dd('csSections'));
  const pk=$('cs-pick'); const keep=pk.value; pk.textContent=''; const o0=el('option',null,dd('csPickNone')); o0.value=''; pk.appendChild(o0);
  [...CS.keys].sort((a,b)=>appTitle(a).localeCompare(appTitle(b),L())).forEach(k=>{ const o=el('option',null,appTitle(k)); o.value=k; pk.appendChild(o); }); pk.value=keep;
  csShow(csPinned||csHot||'');
}
function csShow(k){
  csHot=k||''; const info=$('cs-info'); info.textContent='';
  CS.svg.classList.toggle('has-sel',!!k);
  CS.nodes.forEach((n,key)=>{ n.g.classList.remove('is-sel','is-nb'); });
  CS.lines.forEach(arr=>arr.forEach(l=>l.classList.remove('is-hl')));
  if(!k||!CS.nodes.has(k)){ info.appendChild(el('p','disc-small',dd('csHint'))); return; }
  const rel=relatedOf(k).filter(x=>CS.nodes.has(x));
  CS.nodes.get(k).g.classList.add('is-sel'); rel.forEach(x=>CS.nodes.get(x).g.classList.add('is-nb'));
  (CS.lines.get(k)||[]).forEach(l=>l.classList.add('is-hl'));
  info.appendChild(el('h3',null,appTitle(k)));
  info.appendChild(el('div','sec',secTitle(CS.nodes.get(k).cat)));
  info.appendChild(el('p',null,lineOf(k)));
  const go=el('button','disc-btn pri',dd('csGo')); go.type='button'; go.dataset.csgo=k; info.appendChild(go);
  info.appendChild(el('div','disc-small',dd('csRel',rel.length)));
  const rw=el('div','cs-rel'); rel.forEach(x=>{ const b=el('button',null,appTitle(x)); b.type='button'; b.dataset.csfocus=x; rw.appendChild(b); }); info.appendChild(rw);
}
function csGo(k){ const d=$('cs-dlg'); if(d.open) d.close(); gotoCard(k,true); }
function csFocusNode(k){ const n=CS.nodes.get(k); if(!n) return; csSetCur(k); n.g.focus({preventScroll:true}); const sc=$('cs-scroll'), p=CS.lay.P[n.i], z=csZoom*(sc.scrollWidth&&CS.svg.getAttribute('width')?1:1); const px=p.x*csZoom, py=p.y*csZoom; sc.scrollTo({left:Math.max(0,px-sc.clientWidth/2),top:Math.max(0,py-sc.clientHeight/2)}); }
function csKey(e){
  const g=e.target.closest&&e.target.closest('.cs-node'); if(!g) return; const k=g.dataset.k;
  if(e.key==='Enter'||e.key===' '){ e.preventDefault(); csGo(k); return; }
  const dir={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowDown:[0,1],ArrowUp:[0,-1]}[e.key]; if(!dir) return; e.preventDefault();
  const me=CS.lay.P[CS.nodes.get(k).i]; let best=null,bs=1e18;
  CS.nodes.forEach((n,o)=>{ if(o===k||n.g.classList.contains('is-dim')) return; const p=CS.lay.P[n.i], dx=p.x-me.x, dy=p.y-me.y, d=Math.hypot(dx,dy)||1, cos=(dx*dir[0]+dy*dir[1])/d; if(cos<0.5) return; const s=d*(2-cos); if(s<bs){ bs=s; best=o; } });
  if(!best) CS.nodes.forEach((n,o)=>{ if(o===k||n.g.classList.contains('is-dim')) return; const p=CS.lay.P[n.i], dx=p.x-me.x, dy=p.y-me.y, d=Math.hypot(dx,dy)||1, cos=(dx*dir[0]+dy*dir[1])/d; if(cos<0.1) return; const s=d*(2-cos); if(s<bs){ bs=s; best=o; } });
  if(best){ csFocusNode(best); }
}
function csApplyZoom(){ if(!CS) return; CS.svg.setAttribute('width',Math.round(CS.lay.W*csZoom)); CS.svg.setAttribute('height',Math.round(CS.lay.H*csZoom)); }
function csOpen(){
  if(!CS){ csBuild(); }
  csRelabel(); const d=$('cs-dlg'); csOpener=document.activeElement; d.showModal();
}
let csOpener=null;

/* ───────── auditor: triere locală pe un fișier ───────── */
const NS_HOSTS=/^(ns\.adobe\.com|www\.w3\.org|purl\.org|iptc\.org|ns\.useplus\.org|www\.iptc\.org|cipa\.jp|ns\.google\.com|ns\.microsoft\.com|schemas\.openxmlformats\.org|schemas\.microsoft\.com|www\.xmlsoft\.org|c2pa\.org|exiftool\.org|www\.aiim\.org|ns\.exiftool\.ca|www\.npes\.org|www\.apple\.com|iptc\.org)$/i;
function idxAscii(b,s,from){ const n=s.length,c0=s.charCodeAt(0); for(let i=from||0;i<=b.length-n;i++){ if(b[i]!==c0) continue; let j=1; while(j<n&&b[i+j]===s.charCodeAt(j)) j++; if(j===n) return i; } return -1; }
function lat1(b,a,z){ return new TextDecoder('latin1').decode(b.subarray(a||0,z)); }
function utf8(b,a,z){ return new TextDecoder('utf-8').decode(b.subarray(a||0,z)); }
function parseExif(t,o){
  try{
    const le=t[0]===0x49; const dv=new DataView(t.buffer,t.byteOffset,t.byteLength);
    const u16=p=>dv.getUint16(p,le), u32=p=>dv.getUint32(p,le);
    const sz={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8};
    function val(type,cnt,pos){ const n=(sz[type]||1)*cnt, at=n>4?u32(pos+8):pos+8;
      if(type===2){ let s=''; for(let i=0;i<cnt&&at+i<t.length;i++){ const c=t[at+i]; if(!c) break; s+=String.fromCharCode(c); } return s.trim(); }
      if(type===3) return u16(at); if(type===4) return u32(at);
      if(type===5){ const r=[]; for(let i=0;i<cnt&&i<3;i++) r.push(u32(at+i*8)/(u32(at+i*8+4)||1)); return r; }
      if(type===1||type===7) return t[at]; return null; }
    function ifd(off){ const m={}; if(off<8||off+2>t.length) return m; const n=u16(off); for(let i=0;i<n&&i<200;i++){ const p=off+2+i*12; if(p+12>t.length) break; const tag=u16(p), type=u16(p+2), cnt=u32(p+4); m[tag]={type,cnt,v:val(type,cnt,p),p}; } return m; }
    const i0=ifd(u32(4)); const g=k=>i0[k]&&i0[k].v;
    if(g(0x010F)) o.make=g(0x010F); if(g(0x0110)) o.model=g(0x0110); if(g(0x0131)) o.software=g(0x0131); if(g(0x013B)) o.artist=g(0x013B); if(g(0x8298)) o.copyright=g(0x8298); if(g(0x0132)) o.dates.push(g(0x0132));
    if(i0[0x8769]){ const ex=ifd(i0[0x8769].v); if(ex[0x9003]) o.dates.push(ex[0x9003].v); if(ex[0xA430]) o.owner=ex[0xA430].v; if(ex[0xA431]) o.serial=ex[0xA431].v; if(ex[0xA434]) o.lens=ex[0xA434].v; }
    if(i0[0x8825]){ const gp=ifd(i0[0x8825].v); if(gp[2]&&gp[4]&&Array.isArray(gp[2].v)&&Array.isArray(gp[4].v)){ const dm=a=>a[0]+a[1]/60+a[2]/3600; let la=dm(gp[2].v), lo=dm(gp[4].v); if(gp[1]&&gp[1].v==='S') la=-la; if(gp[3]&&gp[3].v==='W') lo=-lo; o.gps=la.toFixed(5)+', '+lo.toFixed(5); } else o.gps=o.gps||'?'; }
    o.exif=true;
  }catch(e){ /* EXIF malformat: ignorăm */ }
}
function scanXmp(txt,o){
  o.xmp=true;
  const g=re=>{ const m=re.exec(txt); return m?m[1]:''; };
  const tool=g(/CreatorTool(?:>|=")([^<"]{1,120})/); if(tool) o.software=o.software||tool;
  const cr=g(/<dc:creator>[\s\S]*?<rdf:li[^>]*>([^<]{1,120})/); if(cr) o.artist=o.artist||cr;
  const dt=g(/CreateDate(?:>|=")([^<"]{1,40})/); if(dt) o.dates.push(dt);
}
async function inflate(b){ const ds=new DecompressionStream('deflate-raw'); const w=ds.writable.getWriter(); w.write(b); w.close(); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); }
async function zipInfo(b,o,texts){
  const dv=new DataView(b.buffer,b.byteOffset,b.byteLength); let e=-1;
  for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--) if(dv.getUint32(i,true)===0x06054b50){ e=i; break; }
  if(e<0) return;
  const n=dv.getUint16(e+10,true); let p=dv.getUint32(e+16,true); const ents=[];
  for(let i=0;i<n&&p+46<=b.length;i++){ if(dv.getUint32(p,true)!==0x02014b50) break; const meth=dv.getUint16(p+10,true), cs=dv.getUint32(p+20,true), nl=dv.getUint16(p+28,true), el_=dv.getUint16(p+30,true), cl=dv.getUint16(p+32,true), lo=dv.getUint32(p+42,true); const name=utf8(b,p+46,p+46+nl); ents.push({name,meth,cs,lo}); p+=46+nl+el_+cl; }
  o.zipNames=ents.map(x=>x.name);
  const has=s=>o.zipNames.some(x=>x.indexOf(s)===0);
  o.kind=has('word/')?'docx':has('xl/')?'xlsx':has('ppt/')?'pptx':o.zipNames.indexOf('mimetype')>=0?'odf/epub':o.zipNames.some(x=>/\.class$/.test(x))?'jar':'zip';
  if(o.zipNames.some(x=>/vbaProject\.bin$/i.test(x))) o.macro=(o.macro||[]).concat('VBA');
  if(o.zipNames.some(x=>/(^|\/)(embeddings|media\/.*\.(exe|bin))/i.test(x))) (o.emb=o.emb||[]).push('embeddings');
  async function read(ent){ const q=ent.lo; if(dv.getUint32(q,true)!==0x04034b50) return null; const nl=dv.getUint16(q+26,true), xl=dv.getUint16(q+28,true), start=q+30+nl+xl, raw=b.subarray(start,start+ent.cs); if(ent.cs>4e6) return null; if(ent.meth===0) return raw; if(ent.meth===8) return await inflate(raw); return null; }
  for(const ent of ents){
    if(/^docProps\/(core|app)\.xml$/.test(ent.name)||/^meta\.xml$/.test(ent.name)){ const d=await read(ent); if(d){ const x=utf8(d); const g=re=>{ const m=re.exec(x); return m?m[1]:''; };
      const cr=g(/<dc:creator>([^<]+)/)||g(/<meta:initial-creator>([^<]+)/); if(cr) o.artist=o.artist||cr; const lm=g(/<cp:lastModifiedBy>([^<]+)/)||g(/<dc:creator>([^<]+)/); if(lm&&lm!==cr) o.owner=lm;
      const ap=g(/<Application>([^<]+)/)||g(/<meta:generator>([^<]+)/); if(ap) o.software=o.software||ap; const co=g(/<Company>([^<]+)/); if(co) o.owner=o.owner||co;
      [/<dcterms:created[^>]*>([^<]+)/,/<dcterms:modified[^>]*>([^<]+)/,/<meta:creation-date>([^<]+)/].forEach(re=>{ const m=g(re); if(m) o.dates.push(m); }); o.exif=true; } }
    if(/\.rels$/.test(ent.name)){ const d=await read(ent); if(d){ const x=utf8(d); (x.match(/Target="https?:[^"]+"[^>]*TargetMode="External"|TargetMode="External"[^>]*Target="[^"]+"/g)||[]).forEach(s=>{ const m=/Target="([^"]+)"/.exec(s); if(m){ texts.push(m[1]); if(!/^https?:/i.test(m[1])) (o.emb=o.emb||[]).push('external'); } }); } }
  }
}
function scanLinks(text){
  const urls=new Set(); let http=0, js=0;
  (text.match(/\bhttps?:\/\/[^\s<>"'`)\]\\^{}|]+/gi)||[]).forEach(u=>{ u=u.replace(/[.,;:!?]+$/,''); try{ const h=new URL(u).hostname; if(NS_HOSTS.test(h)) return; }catch(_){ return; } urls.add(u); });
  urls.forEach(u=>{ if(/^http:/i.test(u)) http++; });
  js=(text.match(/javascript:/gi)||[]).length;
  const doms={}; urls.forEach(u=>{ try{ const h=new URL(u).hostname.replace(/^www\./,''); doms[h]=(doms[h]||0)+1; }catch(_){} });
  const top=Object.entries(doms).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  return {n:urls.size,http,js,doms:top.length,top:top.slice(0,5).map(x=>x[0]).join(', ')};
}
const AIRE=/trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia|midjourney|dall[-·\s]?e|stable[\s-]?diffusion|adobe firefly|imagen|openai|generative fill|sdxl|comfyui/i;
async function analyze(file){
  const CAP=48*1024*1024, SL=6*1024*1024; const trunc=file.size>CAP;
  let b; if(!trunc) b=new Uint8Array(await file.arrayBuffer()); else { const h=new Uint8Array(await file.slice(0,SL).arrayBuffer()), t=new Uint8Array(await file.slice(file.size-SL).arrayBuffer()); b=new Uint8Array(h.length+t.length); b.set(h); b.set(t,h.length); }
  const o={dates:[],name:file.name,size:file.size,trunc,kind:'',hash:''};
  const F=[]; const add=(sec,lvl,k,...a)=>F.push({sec,lvl,k,a});
  if(!trunc && file.size<=200*1024*1024 && crypto&&crypto.subtle){ try{ const h=await crypto.subtle.digest('SHA-256',b); o.hash=[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join(''); }catch(_){} }
  const is=(...s)=>s.every((v,i)=>b[i]===v);
  let texts=[]; let text='';
  if(is(0xFF,0xD8,0xFF)) o.kind='JPEG'; else if(is(0x89,0x50,0x4E,0x47)) o.kind='PNG'; else if(is(0x25,0x50,0x44,0x46)) o.kind='PDF'; else if(is(0x50,0x4B,0x03,0x04)) o.kind='zip';
  else if(is(0x47,0x49,0x46,0x38)) o.kind='GIF'; else if(is(0x52,0x49,0x46,0x46)&&b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50) o.kind='WebP'; else if(is(0x49,0x49,0x2A,0x00)||is(0x4D,0x4D,0x00,0x2A)) o.kind='TIFF';
  else if(b[4]===0x66&&b[5]===0x74&&b[6]===0x79&&b[7]===0x70) o.kind='MP4/MOV';
  else { let nul=false; for(let i=0;i<Math.min(b.length,4096);i++) if(b[i]===0){ nul=true; break; } if(!nul){ o.kind=/<html|<!doctype html/i.test(utf8(b,0,4096))?'HTML':'text'; } else o.kind='binary'; }
  let ai=''; const metaTexts=[];
  if(o.kind==='JPEG'){
    let i=2; while(i+4<b.length){ if(b[i]!==0xFF){ break; } const m=b[i+1]; if(m===0xDA||m===0xD9) break; if(m===0x01||(m>=0xD0&&m<=0xD7)){ i+=2; continue; } const len=(b[i+2]<<8)|b[i+3]; const seg=b.subarray(i+4,i+2+len);
      if(m===0xE1){ if(lat1(seg,0,6)==='Exif\0\0') parseExif(seg.subarray(6),o); else if(lat1(seg,0,28)==='http://ns.adobe.com/xap/1.0/'){ const x=utf8(seg,29); scanXmp(x,o); metaTexts.push(x); } }
      else if(m===0xEB){ if(idxAscii(seg,'jumb')>=0||idxAscii(seg,'c2pa')>=0) o.c2pa=true; }
      else if(m===0xED&&lat1(seg,0,13)==='Photoshop 3.0'){ o.iptc=true; metaTexts.push(lat1(seg)); }
      i+=2+len; }
  } else if(o.kind==='PNG'){
    let p=8; const dv=new DataView(b.buffer,b.byteOffset,b.byteLength); let guard=0;
    while(p+12<=b.length&&guard++<5000){ const len=dv.getUint32(p), ty=lat1(b,p+4,p+8), data=b.subarray(p+8,p+8+len);
      if(ty==='tEXt'||ty==='iTXt'||ty==='zTXt'){ const s=lat1(data,0,Math.min(len,4000)); const key=s.split('\0')[0]; const val=s.slice(key.length+1,key.length+400); if(/^(Author|Artist|Creator)$/i.test(key)) o.artist=o.artist||val.replace(/\0/g,'').trim().slice(0,100); else if(/^Software$/i.test(key)) o.software=o.software||val.replace(/\0/g,'').trim().slice(0,100); else if(/^(Creation Time|date:create)$/i.test(key)) o.dates.push(val.replace(/\0/g,'').trim().slice(0,40)); else if(/^parameters$/i.test(key)) ai=ai||'Stable Diffusion'; if(/^XML:com\.adobe\.xmp$/.test(key)){ const x=utf8(data); scanXmp(x,o); metaTexts.push(x); } o.pngText=true; metaTexts.push(key+' '+val); }
      else if(ty==='eXIf') parseExif(data,o); else if(ty==='caBX') o.c2pa=true;
      if(ty==='IEND') break; p+=12+len; }
  } else if(o.kind==='WebP'){
    let p=12; const dv=new DataView(b.buffer,b.byteOffset,b.byteLength); while(p+8<=b.length){ const ty=lat1(b,p,p+4), len=dv.getUint32(p+4,true); if(ty==='EXIF') parseExif(b.subarray(p+8,p+8+len).subarray(lat1(b,p+8,p+14)==='Exif\0\0'?6:0),o); if(ty==='XMP '){ const x=utf8(b,p+8,p+8+len); scanXmp(x,o); metaTexts.push(x); } p+=8+len+(len&1); }
  } else if(o.kind==='TIFF') parseExif(b,o);
  else if(o.kind==='PDF'){
    text=lat1(b,0,Math.min(b.length,16*1024*1024)); texts.push(text);
    const g=re=>{ const m=re.exec(text); return m?m[1].replace(/\\([()\\])/g,'$1').trim().slice(0,120):''; };
    const au=g(/\/Author\s*\(([^)]{1,200})\)/), cr=g(/\/Creator\s*\(([^)]{1,200})\)/), pr=g(/\/Producer\s*\(([^)]{1,200})\)/), cd=g(/\/CreationDate\s*\(D?:?([^)]{1,40})\)/), md=g(/\/ModDate\s*\(D?:?([^)]{1,40})\)/);
    if(au) o.artist=au; if(cr||pr) o.software=[cr,pr].filter(Boolean).join(' / '); if(cd) o.dates.push(cd); if(md) o.dates.push(md); if(au||cr||pr||cd) o.exif=true;
    if(/<x:xmpmeta/.test(text)){ const x=text.slice(text.indexOf('<x:xmpmeta'),text.indexOf('<x:xmpmeta')+20000); scanXmp(x,o); metaTexts.push(x); }
    if(/\/Encrypt\b/.test(text)) o.enc=true; if(/\/(JavaScript|JS)\b/.test(text)) (o.macro=o.macro||[]).push('PDF JavaScript'); if(/\/Launch\b/.test(text)) (o.macro=o.macro||[]).push('Launch');
    if(/\/EmbeddedFile\b/.test(text)) (o.emb=o.emb||[]).push('EmbeddedFile'); if(/\/OpenAction\b/.test(text)) (o.emb=o.emb||[]).push('OpenAction');
    (text.match(/\/URI\s*\(([^)]+)\)/g)||[]).forEach(u=>texts.push(u));
  } else if(o.kind==='zip'){ await zipInfo(b,o,texts); }
  else if(o.kind==='MP4/MOV'){ const s=lat1(b,0,Math.min(b.length,4*1024*1024)); const m=/[+-]\d{1,2}\.\d{2,}[+-]\d{1,3}\.\d{2,}/.exec(s); if(m){ o.gps=m[0]; o.exif=true; } }
  else if(o.kind==='HTML'||o.kind==='text'){ text=utf8(b,0,Math.min(b.length,8*1024*1024)); texts.push(text); if(o.kind==='HTML'){ (text.match(/(?:href|src|action)\s*=\s*["']?[^"'\s>]+/gi)||[]).forEach(s=>texts.push(s.replace(/^[^=]+=\s*["']?/,''))); const au=/<meta[^>]+name=["']author["'][^>]+content=["']([^"']{1,100})/i.exec(text); if(au){ o.artist=au[1]; o.exif=true; } const gn=/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']{1,100})/i.exec(text); if(gn){ o.software=gn[1]; o.exif=true; } } }
  // C2PA generic (și pentru MP4/PDF/WebP/TIFF)
  if(!o.c2pa && o.kind!=='text' && o.kind!=='HTML' && idxAscii(b,'c2pa')>=0 && idxAscii(b,'jumb')>=0) o.c2pa=true;
  if(!ai){ const mt=metaTexts.join(' '); const m=AIRE.exec(mt); if(m) ai=m[0]; else if(o.software){ const m2=AIRE.exec(o.software); if(m2) ai=m2[0]; } }
  // constatări
  add('prov','info','fType',o.kind==='zip'||o.kind==='docx'?o.kind:o.kind);
  if(o.c2pa) add('prov','info','fC2paYes'); else add('prov','info','fC2paNo');
  if(ai) add('prov','warn','fAi',ai);
  if(o.software) add('meta','info','fSw',o.software);
  if(o.gps) add('meta','warn','fGps',o.gps);
  { const cam=[o.make,o.model].filter(Boolean).join(' ')+(o.lens?' · '+o.lens:'')+(o.serial?' · S/N '+o.serial:''); if(cam.trim()) add('meta','info','fCam',cam.trim()); }
  { const au=[o.artist,o.owner,o.copyright].filter(Boolean).join(' · '); if(au) add('meta','warn','fAuthor',au); }
  { const ds=[...new Set(o.dates)].filter(Boolean).slice(0,3).join('; '); if(ds) add('meta','info','fDates',ds); }
  if(o.xmp||o.iptc) add('meta','info','fXmp');
  if(o.macro&&o.macro.length) add('meta','warn','fMacro',[...new Set(o.macro)].join(', '));
  if(o.enc) add('meta','warn','fEnc');
  if(o.emb&&o.emb.length) add('meta','warn','fEmb',[...new Set(o.emb)].join(', '));
  if(!(o.exif||o.xmp||o.iptc||o.pngText||o.gps||o.enc||o.software||o.artist)) add('meta','ok','fNoMeta');
  { const lk=scanLinks(texts.join('\n')+' '+metaTexts.join('\n'));
    if(lk.n){ add('links','info','fLinks',lk.n,lk.doms,lk.top); if(lk.http) add('links','warn','fHttp',lk.http); } else add('links','ok','fNoLinks');
    if(lk.js) add('links','warn','fJs',lk.js); add('links','info','fNet'); }
  if(trunc) add('prov','info','fTrunc',6);
  if(!o.hash&&!trunc) add('prov','info','fNoHash'); else if(!o.hash&&trunc) add('prov','info','fNoHash');
  o.F=F; o.warn=F.filter(f=>f.lvl==='warn').length; o.when=new Date().toISOString();
  return o;
}
function fmtSize(n){ return n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB'; }
function reportMd(r){
  let s='# '+dd('fFileTitle',r.name)+'\n\n- '+dd('auType')+': '+r.kind+'\n- '+dd('auSize')+': '+fmtSize(r.size)+'\n'+(r.hash?'- SHA-256: `'+r.hash+'`\n':'')+'\n';
  [['prov','secProv'],['meta','secMeta'],['links','secLinks']].forEach(([sec,lb])=>{ s+='## '+dd(lb)+'\n\n'; r.F.filter(f=>f.sec===sec).forEach(f=>{ s+='- ['+dd(f.lvl==='warn'?'lvlWarn':f.lvl==='ok'?'lvlOk':'lvlInfo')+'] '+dd(f.k,...f.a)+'\n'; }); s+='\n'; });
  s+='**'+(r.warn?dd('sumWarn',r.warn):dd('sumOk'))+'**\n\n_'+dd('auNote')+'_\n'; return s;
}
function renderAudit(r){
  const out=$('au-out'); out.textContent=''; if(!r) return; out.dataset.keys=r.F.map(f=>f.k).join(' ');
  out.appendChild(el('h3',null,dd('fFileTitle',r.name)));
  const dl=el('dl','au-meta'); const row=(a,b,code)=>{ dl.appendChild(el('dt',null,a)); const d=el('dd'); if(code){ const c=el('code',null,b); d.appendChild(c); } else d.textContent=b; dl.appendChild(d); };
  row(dd('auType'),r.kind); row(dd('auSize'),fmtSize(r.size)); if(r.hash) row(dd('auHash'),r.hash,true); out.appendChild(dl);
  out.appendChild(el('p','au-sum',r.warn?dd('sumWarn',r.warn):dd('sumOk')));
  [['prov','secProv'],['meta','secMeta'],['links','secLinks']].forEach(([sec,lb])=>{
    out.appendChild(el('h4',null,dd(lb))); const ul=el('ul','au-list');
    r.F.filter(f=>f.sec===sec).forEach(f=>{ const li=el('li'); li.appendChild(el('span','lv lv-'+f.lvl,dd(f.lvl==='warn'?'lvlWarn':f.lvl==='ok'?'lvlOk':'lvlInfo'))); li.appendChild(document.createTextNode(dd(f.k,...f.a))); ul.appendChild(li); });
    out.appendChild(ul); });
  out.appendChild(el('p','disc-small',dd('auNote')));
  out.appendChild(el('h4',null,dd('auApps'))); out.appendChild(el('p','disc-small',dd('auAppsNote')));
  const ap=el('div','au-apps'); ['Provenienta','Curatitor','Surveyor'].forEach(k=>{ const h=liveHref(k); if(!h) return; const a=el('a','disc-btn',appTitle(k)+' ↗'); a.href=h; a.target='_blank'; a.rel='noopener noreferrer'; ap.appendChild(a); }); out.appendChild(ap);
  const act=el('div','au-apps'); const sv_=el('button','disc-btn pri',dd('auSave')); sv_.type='button'; sv_.id='au-save'; const cp=el('button','disc-btn',dd('auCopy')); cp.type='button'; cp.id='au-copy'; const cl=el('button','disc-btn',dd('auClear')); cl.type='button'; cl.id='au-clear'; act.append(sv_,cp,cl); out.appendChild(act);
  const st=el('p','disc-small'); st.id='au-st'; st.setAttribute('role','status'); out.appendChild(st);
}
function auEnvelope(r){ const md=reportMd(r), iso=r.when; return {fff:1,type:'text/markdown',title:dd('fFileTitle',r.name),lang:L(),ts:iso,data:md,src:'chiuta.ro/auditor',app:'chiuta.ro/auditor',created:iso,source:{label:'chiuta.ro — Auditor (triere locală)',url:'https://chiuta.ro/#discover'}}; }
async function auRun(file){
  const out=$('au-out'); out.textContent=dd('auWorking'); out.setAttribute('aria-busy','true');
  try{ lastAudit=await analyze(file); }catch(e){ lastAudit=null; out.textContent=String(e&&e.message||e); out.removeAttribute('aria-busy'); return; }
  out.removeAttribute('aria-busy'); renderAudit(lastAudit); out.focus({preventScroll:false});
}

/* ───────── căutare în fișierele proprii (doar în memorie, cu consimțământ) ───────── */
const LD={recs:[],files:0};
function flat(v,depth,acc){ if(acc.n>2000) return; if(v==null) return; if(typeof v==='string'||typeof v==='number'||typeof v==='boolean'){ acc.s.push(String(v)); acc.n+=String(v).length; } else if(Array.isArray(v)){ if(depth<5) v.forEach(x=>flat(x,depth+1,acc)); } else if(typeof v==='object'&&depth<5){ for(const k in v) flat(v[k],depth+1,acc); } }
function recsFromText(name,txt,out){
  const isTab=/\.(csv|tsv)$/i.test(name);
  const parts=isTab||/\.(gpx|ics)$/i.test(name)&&false?txt.split(/\r?\n/):txt.split(/\r?\n\s*\r?\n/);
  parts.forEach(p=>{ p=p.trim(); if(p) out.push(p.slice(0,2000)); });
}
async function ldAdd(files){
  for(const f of files){
    if(f.size>20*1024*1024) continue; const txt=await f.text(); const recs=[]; let done=false;
    if(/\.(json|fff|geojson)$/i.test(f.name)||/\.fff\.json$/i.test(f.name)){
      try{ const j=JSON.parse(txt); const pl=(j&&(j.payload!==undefined?j.payload:j.data!==undefined?j.data:j));
        if(j&&j.title) recs.push(String(j.title).slice(0,300));
        if(typeof pl==='string') recsFromText(/csv/i.test(j.type||'')?'x.csv':'x.txt',pl,recs);
        else if(Array.isArray(pl)) pl.forEach(x=>{ const acc={s:[],n:0}; flat(x,0,acc); const s=acc.s.join(' · ').slice(0,2000); if(s) recs.push(s); });
        else if(pl&&typeof pl==='object') for(const k in pl){ const acc={s:[k],n:0}; flat(pl[k],0,acc); recs.push(acc.s.join(' · ').slice(0,2000)); }
        done=true; }catch(_){ /* nu e JSON valid: tratat ca text */ }
    }
    if(!done) recsFromText(f.name,txt,recs);
    recs.slice(0,50000).forEach((r,i)=>LD.recs.push({f:f.name,i:i+1,t:r,n:normTxt(r)}));
    LD.files++;
  }
  $('ld-status').textContent=dd('ldStatus',LD.files,LD.recs.length);
}
function ldSearch(){
  const q=$('ld-q').value, ul=$('ld-res'); ul.textContent=''; const toks=normTxt(q).split(/\s+/).filter(Boolean); if(!toks.length) return;
  let n=0;
  for(const r of LD.recs){ if(!toks.every(t=>r.n.indexOf(t)>-1)) continue; if(++n>40) break;
    const li=el('li'); const sp=el('span','src',r.f+' · '+dd('ldRecord',r.i)); li.appendChild(sp);
    const low=r.n.length===r.t.length?r.n:normTxt(r.t); let pos=Math.max(0,low.indexOf(toks[0])-40); const snip=r.t.slice(pos,pos+220);
    const nl=normTxt(snip); const span=document.createElement('span'); let last=0; const ranges=[];
    toks.forEach(t=>{ let k=nl.indexOf(t); while(k>-1&&nl.length===snip.length){ ranges.push([k,k+t.length]); k=nl.indexOf(t,k+t.length); } });
    ranges.sort((a,b)=>a[0]-b[0]); ranges.forEach(([a,b])=>{ if(a<last) return; span.appendChild(document.createTextNode(snip.slice(last,a))); span.appendChild(el('mark',null,snip.slice(a,b))); last=b; });
    span.appendChild(document.createTextNode(snip.slice(last))); li.appendChild(span); ul.appendChild(li); }
  if(!n){ ul.appendChild(el('li',null,dd('ldNone'))); }
}

/* ───────── legături ───────── */
function init(){
  relabel();
  $('ask-form').addEventListener('submit',e=>{ e.preventDefault(); ask($('ask-q').value); });
  document.querySelectorAll('[data-ex]').forEach(b=>b.addEventListener('click',()=>{ $('ask-q').value=b.textContent; ask(b.textContent); }));
  $('ask-out').addEventListener('click',e=>{ const a=e.target.closest('a[data-step]'); if(a) markNext(+a.dataset.step); });
  $('cs-open').addEventListener('click',csOpen);
  $('cs-x').addEventListener('click',()=>$('cs-dlg').close());
  $('cs-dlg').addEventListener('close',()=>{ if(csOpener&&csOpener.focus&&document.contains(csOpener)) csOpener.focus(); });
  $('cs-dlg').addEventListener('click',e=>{ if(e.target===$('cs-dlg')) $('cs-dlg').close(); });
  $('cs-info').addEventListener('click',e=>{ const g=e.target.closest('[data-csgo]'); if(g){ csGo(g.dataset.csgo); return; } const f=e.target.closest('[data-csfocus]'); if(f){ csPinned=f.dataset.csfocus; csFocusNode(csPinned); } });
  $('cs-pick').addEventListener('change',e=>{ if(e.target.value){ csPinned=e.target.value; csFocusNode(csPinned); csShow(csPinned); } else { csPinned=''; csShow(''); } });
  $('cs-zi').addEventListener('click',()=>{ csZoom=Math.min(2.5,csZoom*1.25); csApplyZoom(); });
  $('cs-zo').addEventListener('click',()=>{ csZoom=Math.max(.4,csZoom/1.25); csApplyZoom(); });
  $('cs-fit').addEventListener('click',()=>{ csZoom=1; csApplyZoom(); });
  const f=$('au-file'); f.addEventListener('change',()=>{ if(f.files[0]) auRun(f.files[0]); f.value=''; });
  const dz=$('au-drop'); ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{ e.preventDefault(); dz.classList.add('is-over'); })); ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{ e.preventDefault(); dz.classList.remove('is-over'); }));
  dz.addEventListener('drop',e=>{ const fl=e.dataTransfer&&e.dataTransfer.files; if(fl&&fl[0]) auRun(fl[0]); });
  $('au-out').addEventListener('click',e=>{
    const id=e.target.id; if(!lastAudit) return;
    if(id==='au-save'){ const blob=new Blob([JSON.stringify(auEnvelope(lastAudit),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='audit-'+lastAudit.name.replace(/[^\w.-]+/g,'_').slice(0,60)+'.fff.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); }
    else if(id==='au-copy'){ const done=()=>{ const st=$('au-st'); if(st) st.textContent=dd('auCopied'); }; try{ navigator.clipboard.writeText(reportMd(lastAudit)).then(done,()=>{}); }catch(_){} }
    else if(id==='au-clear'){ lastAudit=null; $('au-out').textContent=''; $('au-file').focus(); }
  });
  const lf=$('ld-file'); lf.addEventListener('change',async()=>{ if(!$('ld-ok').checked){ $('ld-status').textContent=dd('ldNeed'); lf.value=''; return; } await ldAdd([...lf.files]); lf.value=''; ldSearch(); });
  $('ld-q').addEventListener('input',ldSearch);
  $('ld-clear').addEventListener('click',()=>{ LD.recs=[]; LD.files=0; $('ld-res').textContent=''; $('ld-q').value=''; $('ld-status').textContent=''; $('ld-ok').checked=false; });
  new MutationObserver(m=>{ if(m.some(x=>x.attributeName==='lang')){ AI=null; relabel(); } }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  // „nicio potrivire” în catalog → trimite cuvintele la asistent
  const nr=$('no-res'); if(nr) new MutationObserver(()=>{ const q=($('q')||{}).value||''; if(!nr.hidden&&q.trim()&&!nr.querySelector('button')){ const b=el('button','disc-btn',dd('askAgain',q.trim())); b.type='button'; b.style.marginLeft='.6rem'; b.addEventListener('click',()=>{ $('ask-q').value=q.trim(); ask(q.trim()); $('discover').scrollIntoView({block:'start'}); $('ask-q').focus({preventScroll:true}); }); nr.appendChild(b); } }).observe(nr,{attributes:true,childList:true,attributeFilter:['hidden']});
}
window.DISC={ask,suggest:q=>{ if(!AI) buildAI(); return suggest(q); },csOpen,analyze,reportMd,auEnvelope,scanLinks,relabel,dd};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
