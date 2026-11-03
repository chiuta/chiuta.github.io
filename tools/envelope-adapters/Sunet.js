/* Adaptor peisaj sonor FFF · mixerul comun (tools/fff-sunet.js) în aplicațiile de sunet: buton „Peisaj sonor” → panou cu straturi, profile (dormit/studiu/preparat), oprire automată, export/import sound/profile și randare WAV.
 * Mixerul e independent de motorul propriu al aplicației (alt AudioContext); nu modifică și nu oprește nimic din aplicație. */
(function () {
  if (!(window.FFF && FFF.envelope && FFF.soundscape)) return;
  var slug = (FFF.app && FFF.app.slug) || '', NAMES = { calmwaves: 'CalmWaves', ecoulspectral: 'EcoulSpectral', decibel: 'Decibel', 'generator-frecvente': 'generator-frecvente', borderlessmelodies: 'BorderlessMelodies', asmr: 'ASMR' };
  function go() { FFF.soundscape.mount({ app: NAMES[slug] || slug, slug: slug }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
