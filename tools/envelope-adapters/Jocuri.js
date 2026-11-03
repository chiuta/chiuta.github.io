/* Adaptor jocuri FFF · motorul comun (tools/fff-jocuri.js) în jocurile fără turnee proprii: buton „Turneu și Elo” → partide notate de mână (istoric local, clasament Elo pe nume),
 * turneu tur-retur hot-seat, export/import. Nu modifică jocul; nu folosește rețeaua (connect-src 'none'). */
(function () {
  if (!(window.FFF && FFF.games && FFF.games.attach)) return;
  var slug = (FFF.app && FFF.app.slug) || '', NAMES = { 'domino-fara-frontiere': 'Domino', 'table-fara-frontiere': 'Table', 'remi-fara-frontiere': 'Remi', 'belot-fara-frontiere': 'Belot', scopone: 'Scopone', profund: 'Profund', mahjong: 'Mahjong', 'carti-de-joc': 'Cărți de joc' };
  function go() { try { FFF.games.attach({ key: slug, name: NAMES[slug] || slug }); } catch (e) { /* jocul rămâne neatins */ } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
