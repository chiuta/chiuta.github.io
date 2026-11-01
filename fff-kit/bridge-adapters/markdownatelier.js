(function(){
  var ed=function(){return document.getElementById('editor');};
  function put(txt){var e=ed(); if(!e) throw 0; e.value=(e.value&&!/\n$/.test(e.value)?e.value+'\n\n':e.value)+txt+'\n'; e.dispatchEvent(new Event('input',{bubbles:true}));}
  FFF.bridge.mount({accepts:['text/markdown','text/plain','citation/csl','note/akasha'],onReceive:function(env){
    if(env.type==='citation/csl') put('## '+({ro:'Bibliografie',fr:'Bibliographie',it:'Bibliografia',es:'Bibliografía',pt:'Bibliografia',de:'Literatur',hu:'Irodalom'}[(env.lang||'en')]||'Bibliography')+'\n\n'+fffCslToMd(env.data||[]));
    else if(env.type==='note/akasha') put('# '+(env.data.title||'')+'\n\n'+(env.data.body||''));
    else put(String(env.data));
  }});
  function addBtn(){var tb=document.getElementById('toolbar'); if(!tb||document.getElementById('fffSend')) return;
    var sep=document.createElement('div'); sep.className='fsep'; tb.appendChild(sep);
    var b=FFF.bridge.sendButton({slug:'markdownatelier',registry:FFF_REG,className:'fbtn',style:'width:auto;padding:0 10px',getEnv:function(){var e=ed(); var v=e&&e.value||''; if(!v.trim()) return null; var m=/^#\s+(.+)$/m.exec(v);
      return FFF.bridge.make({type:'text/markdown',src:'MarkdownAtelier',title:m?m[1]:'',data:v});}});
    b.id='fffSend'; tb.appendChild(b);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addBtn); else addBtn();
})();
