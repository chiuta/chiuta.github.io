(function(){
  var S=window.__seva; if(!S) return;
  function env(){
    var B=S.quizBank(), F=S.quizFilter(), pool=F.size?B.filter(function(q){return F.has(q.cat);}):B;
    if(!pool.length) return null;
    var qs=pool.slice(0,100).map(function(q){return {text:q.q,type:'quiz',time:20,answers:q.opts.slice(0,4).map(function(o,i){return {text:o,correct:i===q.correct};})};});
    return FFF.bridge.make({type:'quiz/undava',src:'SEVA',title:'SEVA quiz',data:{title:'SEVA',desc:'Quiz SEVA',questions:qs}});
  }
  function add(){ var r=document.getElementById('quizResetBtn'); if(!r||document.getElementById('fffSend')) return;
    var b=FFF.bridge.sendButton({slug:'seva',registry:FFF_REG,className:'btn',getEnv:env}); b.id='fffSend'; b.style.marginInlineStart='8px'; r.parentNode.insertBefore(b,r.nextSibling); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',add); else add();
})();
