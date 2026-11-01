(function(){
  if(typeof tryImport!=='function') return;
  FFF.bridge.mount({accepts:['quiz/undava','cards/qa'],onReceive:function(env){
    var d=env.data, quiz;
    if(env.type==='cards/qa'){            // [{q,a}] -> quiz cu răspuns scris
      quiz={title:env.title||'Quiz',desc:'',questions:(Array.isArray(d)?d:[]).slice(0,100).map(function(c){
        return {text:String(c.q||''),type:'type',answers:[{text:String(c.a||''),correct:true}],time:30};})};
    } else quiz=d;
    tryImport(JSON.stringify(Array.isArray(quiz)?quiz:[quiz]));
    return '';
  }});
})();
