/* Locația comună FFF (fff-place) · Orar: panoul „Astea se întâmplă deasupra ta mâine” în bara laterală, fusul orar de afișare urmează locația comună, eclipsa se poate adăuga în agendă. */
(function () {
  var P = window.FFF && FFF.place; if (!P) return;
  P.configure({ corner: 'bl' });
  function mount() {
    var aside = document.querySelector('aside'); if (!aside || document.getElementById('fffPlOrarPanel')) return;
    var card = document.createElement('section'); card.className = 'card'; card.id = 'fffPlOrarPanel'; aside.appendChild(card); P.panel(card, { bare: true });
  }
  function viewTz(c) {   // „Fus orar de afișare” (Setări) urmează fusul locației comune; prin DOM, fără a atinge codul aplicației
    try {
      var sel = document.getElementById('s-tz'); if (!c || !c.tz || !sel || sel.value === c.tz) return;
      if (!Array.prototype.some.call(sel.options, function (o) { return o.value === c.tz; })) { var o = document.createElement('option'); o.value = c.tz; o.textContent = c.tz; sel.insertBefore(o, sel.firstChild); }
      sel.value = c.tz; sel.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) { /* aplicația rămâne neschimbată */ }
  }
  P.hooks.addToAgenda = function (its) {
    var A = FFF.agenda, O = window.__fffOrar; if (!A || !O || !O.imp) throw new Error('agendă indisponibilă');
    return O.imp(new TextEncoder().encode(A.toICS(A.normalize(its), { name: 'Agenda comună FFF' })));
  };
  function go() { mount(); setTimeout(function () { P.onChange(viewTz); }, 0); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
