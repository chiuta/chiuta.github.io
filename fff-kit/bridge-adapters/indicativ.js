(function(){
  if(typeof QUESTIONS==='undefined') return;
  function env(){
    var sec=null; try{ if(typeof activeQuiz!=='undefined'&&activeQuiz){ var q=(typeof currentQuizQuestion==='function')&&currentQuizQuestion(); sec=q&&q.section; } }catch(e){}
    var pool=QUESTIONS.filter(function(q){return !sec||q.section===sec;});
    // eșantion de max. 100, variat (pas constant), ca să acopere categoriile
    var step=Math.max(1,Math.floor(pool.length/100)), pick=[]; for(var i=0;i<pool.length&&pick.length<100;i+=step) pick.push(pool[i]);
    var qs=pick.map(function(q){return {text:q.question,type:'quiz',time:30,answers:q.options.slice(0,4).map(function(o,i){return {text:o,correct:i===q.correct};})};});
    return FFF.bridge.make({type:'quiz/undava',src:'INDICATIV',title:'INDICATIV quiz',data:{title:'INDICATIV',desc:'Întrebări ANCOM radioamatori',questions:qs}});
  }
  function add(){ var t=document.getElementById('themeToggle'); if(!t||document.getElementById('fffSend')) return;
    var b=FFF.bridge.sendButton({slug:'indicativ',registry:FFF_REG,className:t.className,getEnv:env}); b.id='fffSend'; b.style.marginInlineStart='6px'; t.parentNode.insertBefore(b,t); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',add); else add();
})();
