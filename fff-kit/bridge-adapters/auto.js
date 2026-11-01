(function(){
  var slug=FFF.app&&FFF.app.slug, me=FFF_REG.filter(function(r){return r.slug===slug;})[0]||{};
  FFF.bridge.auto({slug:slug,registry:FFF_REG,accepts:__FFF_CUSTOM__?[]:(me.accepts||[])});
})();
