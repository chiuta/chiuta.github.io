(function(){
 'use strict';
 var LANGS={en:'English',ro:'Română',fr:'Français',it:'Italiano',es:'Español',pt:'Português',de:'Deutsch',hu:'Magyar'};
 var UI={
  en:{reel:'Section reel',h1:'Demo videos',lead:'Short silent screen recordings of each app’s interface, with subtitles in 8 languages. Hosted here, no third-party player, nothing sent anywhere.',trailer:'Trailer',lang:'Language',search:'Search apps…',all:'All categories',open:'Open app',readme:'README',transcript:'Transcript',none:'No app matches.',foot:'Personal projects, not official services.',dur:'s'},
  ro:{reel:'Compilația secțiunii',h1:'Filmulețe demo',lead:'Înregistrări scurte, fără sunet, ale interfeței fiecărei aplicații, cu subtitrări în 8 limbi. Găzduite aici, fără player extern, nimic nu e trimis nicăieri.',trailer:'Trailer',lang:'Limbă',search:'Caută aplicații…',all:'Toate categoriile',open:'Deschide',readme:'README',transcript:'Transcriere',none:'Nicio aplicație nu se potrivește.',foot:'Proiecte personale, nu servicii oficiale.',dur:'s'},
  fr:{reel:'Compilation de la section',h1:'Vidéos de démonstration',lead:'Courts enregistrements d’écran, sans son, de l’interface de chaque application, sous-titrés en 8 langues. Hébergés ici, sans lecteur tiers, rien n’est envoyé ailleurs.',trailer:'Bande-annonce',lang:'Langue',search:'Rechercher une application…',all:'Toutes les catégories',open:'Ouvrir',readme:'README',transcript:'Transcription',none:'Aucune application ne correspond.',foot:'Projets personnels, pas des services officiels.',dur:'s'},
  it:{reel:'Raccolta della sezione',h1:'Video dimostrativi',lead:'Brevi registrazioni dello schermo, senza audio, dell’interfaccia di ogni app, con sottotitoli in 8 lingue. Ospitati qui, senza player di terzi, nulla viene inviato altrove.',trailer:'Trailer',lang:'Lingua',search:'Cerca app…',all:'Tutte le categorie',open:'Apri',readme:'README',transcript:'Trascrizione',none:'Nessuna app corrisponde.',foot:'Progetti personali, non servizi ufficiali.',dur:'s'},
  es:{reel:'Recopilación de la sección',h1:'Vídeos de demostración',lead:'Breves grabaciones de pantalla, sin sonido, de la interfaz de cada aplicación, con subtítulos en 8 idiomas. Alojados aquí, sin reproductor de terceros, no se envía nada a ningún sitio.',trailer:'Tráiler',lang:'Idioma',search:'Buscar aplicaciones…',all:'Todas las categorías',open:'Abrir',readme:'README',transcript:'Transcripción',none:'Ninguna aplicación coincide.',foot:'Proyectos personales, no servicios oficiales.',dur:'s'},
  pt:{reel:'Compilação da secção',h1:'Vídeos de demonstração',lead:'Gravações de ecrã curtas, sem som, da interface de cada aplicação, com legendas em 8 idiomas. Alojados aqui, sem leitor de terceiros, nada é enviado para lado nenhum.',trailer:'Trailer',lang:'Idioma',search:'Pesquisar aplicações…',all:'Todas as categorias',open:'Abrir',readme:'README',transcript:'Transcrição',none:'Nenhuma aplicação corresponde.',foot:'Projetos pessoais, não serviços oficiais.',dur:'s'},
  de:{reel:'Zusammenschnitt des Bereichs',h1:'Demo-Videos',lead:'Kurze stumme Bildschirmaufnahmen der Oberfläche jeder App, mit Untertiteln in 8 Sprachen. Hier gehostet, kein Fremd-Player, nichts wird irgendwohin gesendet.',trailer:'Trailer',lang:'Sprache',search:'Apps suchen…',all:'Alle Kategorien',open:'Öffnen',readme:'README',transcript:'Transkript',none:'Keine App passt.',foot:'Persönliche Projekte, keine offiziellen Dienste.',dur:'s'},
  hu:{reel:'A szakasz válogatása',h1:'Bemutató videók',lead:'Rövid, hang nélküli képernyőfelvételek minden alkalmazás felületéről, 8 nyelvű felirattal. Itt tárolva, külső lejátszó nélkül, semmit nem küldünk sehová.',trailer:'Előzetes',lang:'Nyelv',search:'Alkalmazások keresése…',all:'Minden kategória',open:'Megnyitás',readme:'README',transcript:'Átirat',none:'Nincs találat.',foot:'Személyes projektek, nem hivatalos szolgáltatások.',dur:'s'}
 };
 var $=function(id){return document.getElementById(id)};
 var data=null,lang='en';
 function pick(){
  try{var u=new URLSearchParams(location.search).get('lang');if(u&&LANGS[u])return u}catch(e){}
  try{var s=localStorage.getItem('lang');if(s&&LANGS[s])return s}catch(e){}
  var n=(navigator.language||'en').slice(0,2).toLowerCase();return LANGS[n]?n:'en';
 }
 function addTracks(v,vtt){
  while(v.firstChild)v.removeChild(v.firstChild);
  Object.keys(LANGS).forEach(function(l){
   var t=document.createElement('track');t.kind='subtitles';t.srclang=l;t.label=LANGS[l];t.src=vtt[l];
   if(l===lang)t.default=true;v.appendChild(t);
  });
  v.addEventListener('loadedmetadata',function(){setTrack(v)},{once:true});
  setTimeout(function(){setTrack(v)},300);
 }
 function setTrack(v){for(var i=0;i<v.textTracks.length;i++){v.textTracks[i].mode=v.textTracks[i].language===lang?'showing':'disabled'}}
 function render(){
  var u=UI[lang];document.documentElement.lang=lang;
  $('h1').textContent=u.h1;$('lead').textContent=u.lead;$('tt').textContent=u.trailer;$('lblLang').textContent=u.lang;
  $('q').placeholder=u.search;$('foot').textContent=u.foot;document.title=u.h1+' — A.I. Chiuță';
  var cat=$('cat'),cur=cat.value;cat.innerHTML='';var o=document.createElement('option');o.value='';o.textContent=u.all;cat.appendChild(o);
  var present={};data.items.forEach(function(i){present[i.section]=1});
  Object.keys(data.sections||{}).forEach(function(k){if(!present[k])return;var op=document.createElement('option');op.value=k;op.textContent=(data.sections[k]&&data.sections[k][lang])||k;cat.appendChild(op)});cat.value=cur;
  var tv=$('trailer');if(data.trailer){tv.poster=data.trailer.poster;tv.src=data.trailer.video;addTracks(tv,data.trailer.vtt)}
  cards();
  if(location.hash){var t=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(t)t.scrollIntoView()}
 }
 function cards(){
  var u=UI[lang],q=$('q').value.trim().toLowerCase(),c=$('cat').value,g=$('grid');g.innerHTML='';
  var rb=$('reelBox'),rv=data.reels&&data.reels[c];
  if(c&&rv){rb.hidden=false;$('rt').textContent=((data.sections[c]&&data.sections[c][lang])||c)+' — '+u.reel;var r=$('reel');if(r.getAttribute('data-sec')!==c){r.setAttribute('data-sec',c);r.poster=rv.poster;r.src=rv.video;addTracks(r,rv.vtt)}}else{rb.hidden=true;var r2=$('reel');r2.pause();r2.removeAttribute('src');r2.removeAttribute('data-sec')}
  var list=data.items.filter(function(i){return(!c||i.section===c)&&(!q||(i.title+' '+(i.line&&i.line[lang]||'')).toLowerCase().indexOf(q)>-1)});
  if(!list.length){var e=document.createElement('div');e.className='empty';e.textContent=u.none;g.appendChild(e);return}
  list.forEach(function(i){
   var a=document.createElement('article');a.className='card';a.id=i.slug;
   var h=document.createElement('h3');h.innerHTML='<span></span><span class="tag"></span>';h.firstChild.textContent=i.title;h.lastChild.textContent=(i.tags&&i.tags[lang]&&i.tags[lang][0])||i.section;a.appendChild(h);
   var v=document.createElement('video');v.controls=true;v.preload='none';v.playsInline=true;v.poster=i.poster;v.src=i.video;v.setAttribute('aria-label',i.title);v.addEventListener('play',function(){addTracks(v,i.vtt)},{once:true});a.appendChild(v);
   var ds=document.createElement('p');ds.className='desc';ds.textContent=(i.line&&i.line[lang])||'';a.appendChild(ds);
   var m=document.createElement('div');m.className='meta';m.textContent=Math.round(i.duration)+' '+u.dur+' · '+(i.size/1048576).toFixed(1)+' MB';a.appendChild(m);
   var d=document.createElement('details');var s=document.createElement('summary');s.textContent=u.transcript;d.appendChild(s);
   var ol=document.createElement('ol');d.appendChild(ol);
   d.addEventListener('toggle',function(){if(!d.open||ol.childNodes.length)return;fetch(i.transcript).then(function(r){return r.json()}).then(function(t){(t[lang]||t.en).forEach(function(x){var li=document.createElement('li');li.textContent=x;ol.appendChild(li)})})});
   a.appendChild(d);
   var l=document.createElement('div');l.className='links';
   [[i.url,u.open],[i.readme,u.readme]].forEach(function(p){var x=document.createElement('a');x.href=p[0];x.textContent=p[1];x.rel='noopener';l.appendChild(x)});
   a.appendChild(l);g.appendChild(a);
  });
 }
 var sel=$('lang');Object.keys(LANGS).forEach(function(l){var o=document.createElement('option');o.value=l;o.textContent=LANGS[l];sel.appendChild(o)});
 sel.addEventListener('change',function(){lang=sel.value;try{localStorage.setItem('lang',lang)}catch(e){}render()});
 $('q').addEventListener('input',cards);$('cat').addEventListener('change',cards);
 try{var m=localStorage.getItem('mode');if(m==='light'||m==='dark')document.documentElement.setAttribute('data-theme',m)}catch(e){}
 $('theme').addEventListener('click',function(){var r=document.documentElement,cur=r.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'),n=cur==='light'?'dark':'light';r.setAttribute('data-theme',n);try{localStorage.setItem('mode',n)}catch(e){}});
 lang=pick();sel.value=lang;
 fetch('manifest.json').then(function(r){return r.json()}).then(function(m){data=m;render()}).catch(function(){$('grid').textContent='manifest.json'});
})();