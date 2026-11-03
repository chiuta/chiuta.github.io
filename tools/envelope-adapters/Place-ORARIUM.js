/* Locația comună FFF (fff-place) · ORARIUM: fusul orar al locației comune devine fusul de referință al aplicației (setRef). */
(function () {
  var P = window.FFF && FFF.place; if (!P) return;
  P.configure({ corner: 'br' }); /* bl e ocupat de butonul „înapoi” (from=) */
  function push(c) { try { if (c && c.tz && typeof window.setRef === 'function' && typeof REF !== 'undefined' && REF !== c.tz) window.setRef(c.tz); } catch (e) { /* aplicația rămâne neschimbată */ } }
  function go() { setTimeout(function () { P.onChange(push); }, 0); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
