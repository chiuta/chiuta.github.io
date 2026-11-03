/* Adaptor plic FFF · Jurnal de teren (Etapa 4): FieldObserver, VATRA, URME, Poteca, ExploratoriiEco și Arhiva fără frontiere (atlasul) scriu și citesc același jurnal geolocalizat,
 * în plicul `geo/journal`. Coordonatele propuse se iau, dacă există, din câmpurile paginii (Poteca: #dw-lat/#dw-lon; ExploratoriiEco: #sunLat/#sunLon; FieldObserver: #g-coord);
 * altfel persoana apasă „Locația mea” (permisiunea browserului) sau le scrie. Nu atinge codul aplicației: doar citește câmpuri vizibile. */
(function () {
  if (!(window.FFF && FFF.envelope && FFF.jurnal)) return;
  var slug = (FFF.app && FFF.app.slug) || '', NAMES = { fieldobserver: 'FieldObserver', vatra: 'VATRA', urme: 'URME', poteca: 'Poteca', exploratoriieco: 'ExploratoriiEco', 'arhiva-fara-frontiere': 'Arhiva fără frontiere' };
  var PAIRS = { poteca: ['dw-lat', 'dw-lon'], exploratoriieco: ['sunLat', 'sunLon'] };
  function val(id) { var e = document.getElementById(id); return e && 'value' in e ? e.value : ''; }
  function draft() {
    var d = { kind: 'obs' }, p = PAIRS[slug];
    if (p && val(p[0]) && val(p[1])) { d.lat = val(p[0]); d.lon = val(p[1]); }
    if (slug === 'fieldobserver') { var g = document.getElementById('g-coord'), m = g && (g.textContent || '').match(/(-?\d{1,2}[.,]\d+)[^\d-]+(-?\d{1,3}[.,]\d+)/); if (m) { d.lat = m[1]; d.lon = m[2]; } }
    return d;
  }
  function go() { if (document.getElementById('fffjFab')) return; FFF.jurnal.mount({ app: NAMES[slug] || (document.title || slug).split(/[—–|·-]/)[0].trim(), slug: slug, draft: draft }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
