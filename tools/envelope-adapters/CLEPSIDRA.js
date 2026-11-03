/* Adaptor agendă comună FFF · CLEPSIDRA: programul săptămânal (zi lucrătoare / weekend) și numărătorile inverse → agenda/fff; primește blocuri săptămânale și evenimente viitoare (cel mult 6) și reîncarcă pagina. */
(function () {
  if (!(window.FFF && FFF.envelope && FFF.agenda)) return;
  var A = FFF.agenda;
  function rd(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function items() { return A.fromClepsidra(rd('clepsidra.schedule', null), rd('clepsidra.events', []), {}); }
  function add(its) {
    var r = A.toClepsidra(its, {}), added = 0, skipped = 0, sch = rd('clepsidra.schedule', null) || { weekday: [], weekend: [] }, evs = rd('clepsidra.events', []);
    if (r.schedule) ['weekday', 'weekend'].forEach(function (g) {
      sch[g] = sch[g] || [];
      r.schedule[g].forEach(function (b) { if (sch[g].some(function (x) { return x.start === b.start && x.end === b.end && x.cat === b.cat; }) || sch[g].length >= 40) skipped++; else { sch[g].push(b); added++; } });
    });
    r.events.forEach(function (e) { if (evs.some(function (x) { return x.name === e.name && x.ts === e.ts; }) || evs.length >= 6) skipped++; else { evs.push(e); added++; } });
    try { if (added) { localStorage.setItem('clepsidra.schedule', JSON.stringify(sch)); localStorage.setItem('clepsidra.events', JSON.stringify(evs)); } } catch (e) { return { added: 0, skipped: its.length }; }
    if (added) setTimeout(function () { location.reload(); }, 900);   // starea CLEPSIDRA e într-un IIFE: se reîncarcă din localStorage
    return { added: added, skipped: skipped };
  }
  function go() {
    var a = document.getElementById('icsEventsBtn'); if (!a || document.getElementById('fffAgSend')) return;
    A.mount({ slug: 'clepsidra', app: 'CLEPSIDRA', className: a.className, getItems: items, addItems: add, before: a.nextSibling });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
