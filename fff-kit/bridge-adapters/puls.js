(function(){
  var Q=window.__fffQuiz; if(!Q) return;
  function chipsOn(){ var on=[].slice.call(document.querySelectorAll('#quizCats .chip.on')).map(function(c){return c.dataset.cat;}); return on.indexOf('toate')>=0?[]:on; }
  function env(){
    var cats=chipsOn(), B=Q.bank(), pool=cats.length?B.filter(function(q){return cats.indexOf(q.cat)>=0;}):B;
    if(!pool.length) return null;
    var qs=pool.slice(0,100).map(function(q){return {text:q.q,type:'quiz',time:20,answers:q.opts.slice(0,4).map(function(o,i){return {text:o,correct:i===q.correct};})};});
    var t=(FFF.app&&FFF.app.name)||'Quiz';
    return FFF.bridge.make({type:'quiz/undava',src:t,title:t+' quiz',data:{title:t,desc:'Quiz '+t,questions:qs}});
  }
  function add(){ var c=document.getElementById('quizCats'); if(!c||document.getElementById('fffSend')) return;
    var b=FFF.bridge.sendButton({slug:FFF.app.slug,registry:FFF_REG,className:'btn',getEnv:env}); b.id='fffSend'; b.style.margin='8px 0'; c.parentNode.insertBefore(b,c.nextSibling); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',add); else add();
})();
