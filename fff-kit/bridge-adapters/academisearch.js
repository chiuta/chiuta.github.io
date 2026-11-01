(function(){
  function toCsl(){ return _lib.map(function(x){ var c={id:x.k,type:'article-journal',title:x.title};
    if(x.authors) c.author=[{literal:x.authors}]; if(+x.year) c.issued={'date-parts':[[+x.year]]};
    if(x.journal) c['container-title']=x.journal; if(x.doi) c.DOI=x.doi; if(x.url) c.URL=x.url; if(x.abstract) c.abstract=x.abstract; return c; }); }
  FFF.bridge.mount({accepts:['citation/csl'],onReceive:function(env){
    libLoad(); var n=0; (env.data||[]).forEach(function(c){ if(!c||typeof c.title!=='string') return;
      var a=(c.author||[]).map(function(p){return p.literal||((p.family||'')+(p.given?', '+p.given:''));}).join('; ');
      var y=c.issued&&c.issued['date-parts']&&c.issued['date-parts'][0]&&c.issued['date-parts'][0][0];
      var it={title:c.title,authors:a,year:y||'',journal:c['container-title']||'',doi:c.DOI||'',url:c.URL||'',abstract:c.abstract||'',src:'fff'};
      if(libHas(it)||_lib.length>=LIB_MAX) return; var x=libClean(it); x.k=libKeyOf(it); x.saved=new Date().toISOString().slice(0,10); _lib.unshift(x); n++; });
    if(!libPersist()){ libLoad(); throw 0; } libCountUpdate(); return n+' ✓'; }});
  function addBtn(){ var f=document.getElementById('libFootBtn'); if(!f||document.getElementById('fffSend')) return;
    var b=FFF.bridge.sendButton({slug:'academisearch',registry:FFF_REG,className:f.className,getEnv:function(){ libLoad(); if(!_lib.length) return null;
      return FFF.bridge.make({type:'citation/csl',src:'AcademiSearch',title:'AcademiSearch',data:toCsl()}); }});
    b.id='fffSend'; f.parentNode.insertBefore(b,f.nextSibling); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addBtn); else addBtn();
})();
