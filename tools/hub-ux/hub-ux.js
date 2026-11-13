/* hub-ux · strat de confort peste catalog (vezi hub-ux.css). Totul rămâne local: salvatele și „recent deschise”
   stau în localStorage, pe acest dispozitiv; nimic nu pleacă din pagină. Funcționează doar dacă există catalogul. */
(function(){
'use strict';
var D=document, H=D.documentElement, W=window;
function $(id){ return D.getElementById(id); }
function ls(k,v){ try{ if(v===undefined) return W.localStorage.getItem(k); W.localStorage.setItem(k,v); }catch(e){ return null; } }
function rm(k){ try{ W.localStorage.removeItem(k); }catch(e){} }
var reduce=W.matchMedia&&W.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- texte, în cele 8 limbi ---------- */
var S={
  sections:{ro:'Secțiuni',en:'Sections',fr:'Rubriques',it:'Sezioni',es:'Secciones',pt:'Secções',de:'Bereiche',hu:'Szekciók'},
  view:{ro:'Afișare',en:'View',fr:'Affichage',it:'Vista',es:'Vista',pt:'Vista',de:'Ansicht',hu:'Nézet'},
  roomy:{ro:'Detaliat',en:'Detailed',fr:'Détaillé',it:'Dettagliata',es:'Detallada',pt:'Detalhada',de:'Ausführlich',hu:'Részletes'},
  compact:{ro:'Compact',en:'Compact',fr:'Compact',it:'Compatta',es:'Compacta',pt:'Compacta',de:'Kompakt',hu:'Tömör'},
  saved:{ro:'Salvate',en:'Saved',fr:'Favoris',it:'Preferiti',es:'Guardadas',pt:'Guardadas',de:'Gemerkt',hu:'Mentettek'},
  savedHint:{ro:'Apasă ☆ pe un card ca să îl salvezi. Salvările rămân doar pe acest dispozitiv.',en:'Press ☆ on a card to save it. Saved items stay on this device only.',fr:'Appuyez sur ☆ sur une carte pour l’enregistrer. Les favoris restent sur cet appareil.',it:'Premi ☆ su una scheda per salvarla. I preferiti restano solo su questo dispositivo.',es:'Pulsa ☆ en una tarjeta para guardarla. Las guardadas permanecen solo en este dispositivo.',pt:'Prime ☆ num cartão para o guardar. As guardadas ficam só neste dispositivo.',de:'Tippe auf ☆ an einer Karte, um sie zu merken. Gemerkte Apps bleiben nur auf diesem Gerät.',hu:'Koppints a ☆ jelre egy kártyán a mentéshez. A mentések csak ezen az eszközön maradnak.'},
  save:{ro:'Salvează',en:'Save',fr:'Enregistrer',it:'Salva',es:'Guardar',pt:'Guardar',de:'Merken',hu:'Mentés'},
  unsave:{ro:'Scoate din salvate',en:'Remove from saved',fr:'Retirer des favoris',it:'Rimuovi dai preferiti',es:'Quitar de guardadas',pt:'Remover das guardadas',de:'Nicht mehr merken',hu:'Eltávolítás a mentettek közül'},
  recent:{ro:'Deschise recent',en:'Recently opened',fr:'Ouvertes récemment',it:'Aperte di recente',es:'Abiertas recientemente',pt:'Abertas recentemente',de:'Zuletzt geöffnet',hu:'Nemrég megnyitott'},
  clear:{ro:'Șterge istoricul',en:'Clear history',fr:'Effacer l’historique',it:'Cancella la cronologia',es:'Borrar el historial',pt:'Limpar o histórico',de:'Verlauf löschen',hu:'Előzmények törlése'},
  share:{ro:'Copiază linkul acestei vederi',en:'Copy link to this view',fr:'Copier le lien de cette vue',it:'Copia il link di questa vista',es:'Copiar el enlace de esta vista',pt:'Copiar a ligação desta vista',de:'Link zu dieser Ansicht kopieren',hu:'A nézet linkjének másolása'},
  copied:{ro:'Link copiat',en:'Link copied',fr:'Lien copié',it:'Link copiato',es:'Enlace copiado',pt:'Ligação copiada',de:'Link kopiert',hu:'Link másolva'},
  filters:{ro:'Filtre',en:'Filters',fr:'Filtres',it:'Filtri',es:'Filtros',pt:'Filtros',de:'Filter',hu:'Szűrők'},
  top:{ro:'Înapoi sus',en:'Back to top',fr:'Retour en haut',it:'Torna su',es:'Volver arriba',pt:'Voltar ao topo',de:'Nach oben',hu:'Vissza a tetejére'}
};
function lang(){ var l=(H.lang||'en').slice(0,2).toLowerCase(); return S.top[l]?l:'en'; }
function s(k){ var o=S[k]; return o[lang()]||o.en; }

/* ---------- stare ---------- */
var FAVK='hub.ux.fav', RECK='hub.ux.recent', DENK='hub.ux.density';
function load(k){ try{ var a=JSON.parse(ls(k)||'[]'); return Array.isArray(a)?a.filter(function(x){return typeof x==='string';}):[]; }catch(e){ return []; } }
var fav=load(FAVK), recent=load(RECK);
var mqMobile=W.matchMedia?W.matchMedia('(max-width:620px)'):{matches:false,addEventListener:function(){}};
var density=ls(DENK); if(density!=='compact'&&density!=='roomy') density=mqMobile.matches?'compact':'roomy';
H.dataset.uxDensity=density;      // înainte de construirea interfeței, ca să nu clipească
var favOnly=false;

function cards(){ return [].slice.call(D.querySelectorAll('#apps-grid .app-card:not([data-variant-of])')); }
function keyOf(c){ return c.id.replace(/^app-/,''); }
function nameOf(c){ var n=c.querySelector('.card-name'); return n?n.textContent.trim():keyOf(c); }
function cardOf(k){ return $('app-'+k); }

/* ---------- elemente ---------- */
var navEl, bar, barIn, items=[], tools, btnFilt, btnFiltN, btnSaved, btnSavedN, segBtns={}, segLbl, btnShare, live, mine, mineC, mineL, mineX, topBtn, form;
function el(tag,cls,txt){ var e=D.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }

function buildJump(){
  bar=el('nav','ux-jump'); bar.id='ux-jump'; barIn=el('div','ux-jump-in'); bar.appendChild(barIn);
  navEl.parentNode.insertBefore(bar,navEl.nextSibling);
  [].forEach.call(D.querySelectorAll('#apps-grid .sec-head'),function(h){
    var a=el('a','ux-chip'); a.href='#'+h.id; var t=el('span'); var n=el('b'); a.appendChild(t); a.appendChild(n); barIn.appendChild(a);
    items.push({head:h,a:a,t:t,n:n});
  });
}
function buildTools(){
  tools=el('div','ux-tools'); tools.id='ux-tools'; tools.setAttribute('role','group');
  btnFilt=el('button','ux-btn ux-only-mobile'); btnFilt.id='ux-filt'; btnFilt.type='button'; btnFilt.setAttribute('aria-controls','apps-filter'); btnFilt.setAttribute('aria-expanded','false');
  btnFilt.appendChild(el('span')); btnFiltN=el('b'); btnFilt.appendChild(btnFiltN);
  btnSaved=el('button','ux-btn'); btnSaved.id='ux-saved'; btnSaved.type='button'; btnSaved.setAttribute('aria-pressed','false');
  btnSaved.appendChild(el('span')); btnSavedN=el('b'); btnSaved.appendChild(btnSavedN);
  segLbl=el('span','ux-seg-l');
  var seg=el('div','ux-seg'); seg.setAttribute('role','group');
  ['roomy','compact'].forEach(function(k){ var b=el('button'); b.type='button'; b.dataset.d=k; segBtns[k]=b; seg.appendChild(b); });
  btnShare=el('button','ux-btn'); btnShare.id='ux-share'; btnShare.type='button'; btnShare.appendChild(el('span','ux-ic','⧉')); btnShare.appendChild(el('span','ux-tx'));
  live=el('span','ux-sr'); live.setAttribute('role','status'); live.setAttribute('aria-live','polite');
  [btnFilt,btnSaved,segLbl,seg,btnShare,live].forEach(function(x){ tools.appendChild(x); });
  tools._seg=seg;
  form.parentNode.insertBefore(tools,form.nextSibling);
}
function buildMine(){
  mine=el('div','ux-mine'); mine.id='ux-mine'; mine.hidden=true;
  mineL=el('span','ux-mine-l'); mineC=el('span'); mineC.style.display='contents';
  mineX=el('button','ux-clear','×'); mineX.type='button';
  mine.appendChild(mineL); mine.appendChild(mineC); mine.appendChild(mineX);
  var hdr=D.querySelector('.apps-header'); hdr.parentNode.insertBefore(mine,hdr);
}
function buildTop(){
  topBtn=el('button','ux-top','↑'); topBtn.type='button'; topBtn.hidden=true; D.body.appendChild(topBtn);
}
function addFavButtons(){
  cards().forEach(function(c){
    if(c.querySelector('.ux-fav')) return;
    var top=c.querySelector('.card-top'); if(!top) return;
    var b=el('button','ux-fav'); b.type='button'; b.textContent='☆'; b.dataset.k=keyOf(c); b.setAttribute('aria-pressed','false');
    top.appendChild(b);
  });
}

/* ---------- etichete (re-aplicate la schimbarea limbii) ---------- */
function relabel(){
  bar.setAttribute('aria-label',s('sections'));
  items.forEach(function(it){ var h=it.head.querySelector('h2'); var txt=h?h.textContent.trim():it.head.id; it.t.textContent=txt; it.a.title=txt; });
  btnFilt.firstChild.textContent=s('filters');
  btnSaved.firstChild.textContent='★ '+s('saved');
  segLbl.textContent=s('view');
  tools._seg.setAttribute('aria-label',s('view'));
  segBtns.roomy.textContent=s('roomy'); segBtns.compact.textContent=s('compact');
  btnShare.lastChild.textContent=s('share'); btnShare.setAttribute('aria-label',s('share')); btnShare.title=s('share');
  mineL.textContent=s('recent'); mineX.setAttribute('aria-label',s('clear')); mineX.title=s('clear');
  topBtn.setAttribute('aria-label',s('top')); topBtn.title=s('top');
  cards().forEach(function(c){ var b=c.querySelector('.ux-fav'); if(b) setFavLabel(b,c); });
  var q=$('q'); if(q) q.setAttribute('aria-keyshortcuts','/');
  updateSaved();
}
function setFavLabel(b,c){ var on=fav.indexOf(b.dataset.k)>-1; b.setAttribute('aria-label',(on?s('unsave'):s('save'))+' — '+nameOf(c)); b.title=on?s('unsave'):s('save'); }

/* ---------- salvate ---------- */
function persistFav(){ ls(FAVK,JSON.stringify(fav)); }
function paintFav(){
  cards().forEach(function(c){
    var on=fav.indexOf(keyOf(c))>-1; c.classList.toggle('is-fav',on);
    var b=c.querySelector('.ux-fav'); if(b){ b.textContent=on?'★':'☆'; b.setAttribute('aria-pressed',on?'true':'false'); setFavLabel(b,c); }
  });
}
function updateSaved(){
  var n=cards().filter(function(c){ return c.classList.contains('is-fav'); }).length;
  btnSavedN.textContent=n?String(n):'';
  btnSaved.disabled=!n&&!favOnly;
  btnSaved.title=n?'':s('savedHint');
  if(!n&&favOnly) setFavOnly(false);
}
function setFavOnly(on){
  favOnly=on; H.dataset.uxFav=on?'1':'0'; btnSaved.setAttribute('aria-pressed',on?'true':'false'); refreshHeads(); updateJump();
}
function toggleFav(k){
  var i=fav.indexOf(k); if(i>-1) fav.splice(i,1); else fav.push(k);
  persistFav(); paintFav(); updateSaved(); refreshHeads(); updateJump();
}

/* ---------- recent deschise ---------- */
function pushRecent(k){
  var i=recent.indexOf(k); if(i>-1) recent.splice(i,1); recent.unshift(k); recent=recent.slice(0,8); ls(RECK,JSON.stringify(recent));
}
function renderMine(){
  mineC.textContent='';
  var shown=0;
  recent.forEach(function(k){
    if(shown>=6) return; var c=cardOf(k); if(!c) return; var lk=c.querySelector('a.live-link'); if(!lk) return;
    var a=el('a',null,nameOf(c)); a.href=lk.getAttribute('href'); a.target='_blank'; a.rel='noopener noreferrer'; mineC.appendChild(a); shown++;
  });
  mine.hidden=!shown;
}

/* ---------- secțiuni: vizibilitate, numere, scrollspy ---------- */
function sectionCards(h){ var out=[],x=h.nextElementSibling; while(x&&!x.classList.contains('sec-head')){ if(x.classList.contains('app-card')&&!x.hasAttribute('data-variant-of')) out.push(x); x=x.nextElementSibling; } return out; }
function refreshHeads(){
  items.forEach(function(it){
    var any=sectionCards(it.head).some(function(c){ return c.classList.contains('is-fav'); });
    it.head.classList.toggle('ux-nofav',favOnly&&!any);
  });
}
function updateJump(){
  items.forEach(function(it){
    var n=sectionCards(it.head).filter(function(c){ return !c.hidden&&(!favOnly||c.classList.contains('is-fav')); }).length;
    it.n.textContent=n; it.a.hidden=!n||it.head.hidden;
  });
  onScroll();
}
var activeIt=null;
function spy(){
  var th=(navEl.offsetHeight||48)+(bar.offsetHeight||40)+28, cur=null;
  for(var i=0;i<items.length;i++){ var it=items[i]; if(it.a.hidden) continue; if(it.head.getBoundingClientRect().top<=th) cur=it; else break; }
  if(!cur){ for(var j=0;j<items.length;j++){ if(!items[j].a.hidden){ cur=items[j]; break; } } }
  if(cur===activeIt) return;
  if(activeIt) activeIt.a.removeAttribute('aria-current');
  activeIt=cur;
  if(cur){ cur.a.setAttribute('aria-current','true'); var l=cur.a.offsetLeft-(barIn.clientWidth-cur.a.offsetWidth)/2; barIn.scrollTo?barIn.scrollTo({left:l,behavior:reduce?'auto':'smooth'}):(barIn.scrollLeft=l); }
}
var tick=false;
function onScroll(){
  if(tick) return; tick=true;
  W.requestAnimationFrame(function(){
    tick=false;
    var y=W.pageYOffset||0, f=$('apps-filter'), top=f?f.getBoundingClientRect().top+y:1e9;
    var on=y>top-(navEl.offsetHeight||48)-40;
    bar.classList.toggle('on',on); bar.setAttribute('aria-hidden',on?'false':'true');
    topBtn.hidden=y<1400;
    if(on) spy();
  });
}
function behaviorFor(dist){ return (reduce||Math.abs(dist)>3500)?'auto':'smooth'; }
function setNavVar(){ H.style.setProperty('--ux-nav',(navEl.offsetHeight||48)+'px'); }

/* ---------- filtre: pliere pe mobil, stare în adresă ---------- */
var MAP=[['q','q'],['cat','f-cat'],['lang','f-lang'],['off','f-off'],['st','f-status']];
function activeSelects(){ return ['f-cat','f-lang','f-off','f-status'].filter(function(id){ var e=$(id); return e&&e.value; }).length; }
function updateFiltBtn(){ var n=activeSelects(); btnFiltN.textContent=n?String(n):''; }
function setFiltOpen(on){ form.classList.toggle('ux-open',on); btnFilt.setAttribute('aria-expanded',on?'true':'false'); }
function writeURL(){
  var p=new W.URLSearchParams();
  MAP.forEach(function(m){ var e=$(m[1]); var v=e?e.value.trim():''; if(v) p.set(m[0],v); });
  var qs=p.toString();
  try{ W.history.replaceState(null,'',W.location.pathname+(qs?'?'+qs:'')+W.location.hash); }catch(e){}
}
function readURL(){
  var p=new W.URLSearchParams(W.location.search), any=false;
  MAP.forEach(function(m){
    var v=p.get(m[0]); var e=$(m[1]); if(v==null||!e) return;
    if(e.tagName==='SELECT'){ if(![].some.call(e.options,function(o){ return o.value===v; })) return; e.value=v; e.dispatchEvent(new W.Event('change',{bubbles:true})); any=any||m[0]!=='q'; }
    else{ e.value=v; e.dispatchEvent(new W.Event('input',{bubbles:true})); }
  });
  if(any) setFiltOpen(true);
}
function copy(text){
  if(W.navigator.clipboard&&W.isSecureContext) return W.navigator.clipboard.writeText(text);
  return new Promise(function(res,rej){ var t=D.createElement('textarea'); t.value=text; t.setAttribute('readonly',''); t.style.cssText='position:fixed;opacity:0;top:0'; D.body.appendChild(t); t.select(); var ok=false; try{ ok=D.execCommand('copy'); }catch(e){} t.remove(); ok?res():rej(); });
}

/* ---------- legare evenimente ---------- */
function wire(){
  D.addEventListener('click',function(e){
    var t=e.target; if(!t||!t.closest) return;
    var fb=t.closest('.ux-fav'); if(fb){ e.preventDefault(); toggleFav(fb.dataset.k); return; }
    var ll=t.closest('a.live-link'); if(ll){ var c=ll.closest('.app-card'); if(c){ pushRecent(keyOf(c)); renderMine(); } }
  });
  D.addEventListener('auxclick',function(e){ var ll=e.target.closest&&e.target.closest('a.live-link'); if(ll){ var c=ll.closest('.app-card'); if(c){ pushRecent(keyOf(c)); renderMine(); } } });
  btnSaved.addEventListener('click',function(){ setFavOnly(!favOnly); if(favOnly){ var h=D.querySelector('.apps-header'); if(h&&h.getBoundingClientRect().top<0) h.scrollIntoView({block:'start',behavior:'auto'}); } });
  btnFilt.addEventListener('click',function(){ setFiltOpen(!form.classList.contains('ux-open')); });
  Object.keys(segBtns).forEach(function(k){ segBtns[k].addEventListener('click',function(){ density=k; ls(DENK,k); applyDensity(); }); });
  btnShare.addEventListener('click',function(){
    writeURL();
    copy(W.location.href).then(function(){ live.textContent=''; W.setTimeout(function(){ live.textContent=s('copied'); },30); btnShare.firstChild.textContent='✓'; btnShare.lastChild.textContent=s('copied'); W.setTimeout(function(){ btnShare.firstChild.textContent='⧉'; btnShare.lastChild.textContent=s('share'); },1800); },function(){});
  });
  mineX.addEventListener('click',function(){ recent=[]; rm(RECK); renderMine(); var q=$('q'); if(q) q.focus(); });
  topBtn.addEventListener('click',function(){ W.scrollTo({top:0,behavior:behaviorFor(W.pageYOffset)}); var l=$('nav-top'); if(l) l.focus({preventScroll:true}); });
  form.addEventListener('input',function(){ writeURL(); updateFiltBtn(); });
  form.addEventListener('change',function(){ writeURL(); updateFiltBtn(); });
  var rs=$('f-reset'); if(rs) rs.addEventListener('click',function(){ W.requestAnimationFrame(function(){ writeURL(); updateFiltBtn(); }); });
  var cnt=$('apps-count'); if(cnt) new W.MutationObserver(function(){ W.requestAnimationFrame(updateJump); }).observe(cnt,{childList:true,characterData:true,subtree:true});
  new W.MutationObserver(function(m){ if(m.some(function(x){ return x.attributeName==='lang'; })){ W.setTimeout(relabel,80); W.setTimeout(function(){ relabel(); updateJump(); },500); } }).observe(H,{attributes:true,attributeFilter:['lang']});
  W.addEventListener('scroll',onScroll,{passive:true});
  W.addEventListener('resize',function(){ setNavVar(); onScroll(); });
  D.addEventListener('keydown',function(e){
    if(e.key!=='/'||e.ctrlKey||e.metaKey||e.altKey) return;
    var t=e.target; if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var q=$('q'); if(!q) return; e.preventDefault(); q.focus(); try{ q.select(); }catch(x){}
    q.scrollIntoView({block:'center',behavior:'auto'});
  });
  if(mqMobile.addEventListener) mqMobile.addEventListener('change',function(){ if(!ls(DENK)){ density=mqMobile.matches?'compact':'roomy'; applyDensity(); } });
}
function applyDensity(){
  H.dataset.uxDensity=density;
  Object.keys(segBtns).forEach(function(k){ segBtns[k].setAttribute('aria-pressed',k===density?'true':'false'); });
}

/* ---------- pornire: așteaptă ca scriptul principal să fi populat filtrele și cardurile ---------- */
function boot(){
  form=$('apps-filter'); navEl=D.querySelector('nav');
  if(!form||!navEl||!D.querySelector('#apps-grid .app-card')||!D.querySelector('.apps-header')) return;
  buildJump(); buildTools(); buildMine(); buildTop(); addFavButtons();
  form.classList.add('ux-collapsible');
  applyDensity(); wire(); paintFav(); refreshHeads(); renderMine();
  relabel(); readURL(); updateFiltBtn();
  W.requestAnimationFrame(function(){ setNavVar(); updateJump(); });
}
function waitReady(){
  var tries=0;
  (function w(){
    var c=$('f-cat');
    if((c&&c.options.length>1&&D.querySelector('#apps-grid .app-card .card-top'))||tries++>90) boot(); else W.requestAnimationFrame(w);
  })();
}
if(D.readyState==='loading') D.addEventListener('DOMContentLoaded',waitReady); else waitReady();
})();
