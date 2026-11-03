/* Adaptor agendă comună FFF · Orar: calendarele active → agenda/fff (prin .ics-ul propriu al aplicației); primește agenda/fff sau events/ics prin importul .ics existent (previzualizare, fără dubluri, anulabil). */
(function () {
  if (!(window.FFF && FFF.envelope && FFF.agenda && window.__fffOrar)) return;
  var A = FFF.agenda;
  function items() { return A.fromICS(window.__fffOrar.ics(), 'Orar'); }
  function add(its) { return window.__fffOrar.imp(new TextEncoder().encode(A.toICS(its, { name: 'Agenda comună FFF' }))); }
  function go() {
    var a = document.getElementById('b-print'); if (!a || document.getElementById('fffAgSend')) return;
    A.mount({ slug: 'orar', app: 'Orar', className: a.className, getItems: items, addItems: add, before: a.nextSibling });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
