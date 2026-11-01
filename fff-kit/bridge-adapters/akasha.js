(function(){
  var A=window.__akasha; if(!A||!A.addRecord) return;
  FFF.bridge.mount({accepts:['note/akasha','text/markdown','text/plain','citation/csl'],onReceive:function(env){
    var now=new Date().toISOString(), d=env.data, raw;
    if(env.type==='note/akasha') raw={title:d.title,cat:d.cat,res:d.res,tags:d.tags,body:d.body};
    else if(env.type==='citation/csl') raw={title:env.title||'Bibliografie',cat:'cunoastere',tags:['fff'],body:fffCslToMd(d)};
    else raw={title:env.title||String(d).split('\n')[0].replace(/^#+\s*/,'').slice(0,80),cat:'cunoastere',tags:['fff'],body:String(d)};
    raw.created=now; raw.updated=now; delete raw.id;
    if(!A.addRecord(raw)) throw 0;
  }});
  A.extraFoot=function(foot,r){
    var b=FFF.bridge.sendButton({slug:'akasha',registry:FFF_REG,className:'btn',getEnv:function(){
      return FFF.bridge.make({type:'note/akasha',src:'Akasha',title:r.title,lang:A.lang(),data:{title:r.title,cat:r.cat,res:r.res,tags:r.tags,body:r.body}});}});
    foot.insertBefore(b,foot.firstChild);
  };
})();
