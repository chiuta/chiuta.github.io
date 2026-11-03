/* Adaptor motor A/B FFF · Cadraj, Surveyor, ScryVeil, FreeDetect: butonul „A/B” (panou „Ce variantă e mai bună?”), rezultate în plicul `experiment/ab`.
 * Variantele propuse se preiau din pagină (Cadraj: clipurile din caiete; Surveyor: adresele din rezultate; ScryVeil: verificările din raport;
 * FreeDetect: instrumentele din listă) și pot fi oricând înlocuite cu text scris de persoană. Nu atinge codul aplicației: doar citește DOM-ul. */
(function () {
  if (!(window.FFF && FFF.envelope && FFF.ab)) return;
  var slug = (FFF.app && FFF.app.slug) || '', NAMES = { cadraj: 'Cadraj', surveyor: 'Surveyor', scryveil: 'ScryVeil', freedetect: 'FreeDetect' };
  var SEL = {
    cadraj: ['.nb-clip h3', '#nb-list summary'],
    surveyor: ['.results-list .result-url', '.results-list a'],
    scryveil: ['.panel__results h3', '.panel__results h2', '#reportBar ~ * h3'],
    freedetect: ['#grid .card h3', '.card h3']
  };
  function items() {
    var s = SEL[slug] || [], out = [];
    for (var i = 0; i < s.length && out.length < 12; i++) {
      var l = document.querySelectorAll(s[i]);
      for (var j = 0; j < l.length && out.length < 12; j++) {
        var t = (l[j].textContent || '').replace(/\s+/g, ' ').trim(); if (t && t.length < 160 && l[j].getClientRects().length) out.push(t);
      }
    }
    return out;
  }
  function go() { if (document.getElementById('fffabFab')) return; FFF.ab.mount({ app: NAMES[slug] || (document.title || slug).split(/[—–|·-]/)[0].trim(), slug: slug, getItems: items }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
