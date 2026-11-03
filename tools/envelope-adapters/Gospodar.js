/* Adaptor agendă comună FFF · Gospodar: plățile recurente (și scadențele lor) → agenda/fff, FĂRĂ sume; primește scadențe CU sumă (de la alt dispozitiv cu Gospodar) ca recurențe noi. */
(function () {
  if (!(window.FFF && FFF.envelope && FFF.agenda && window.GOSPODAR)) return;
  var A = FFF.agenda, S = window.GOSPODAR.S, U = window.GOSPODAR.U, F = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' }, R = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' };
  function items(withAmt) {
    var d = S.data(), out = [];
    (d.recs || []).forEach(function (r) {
      if (r.paused || !F[r.freq] || !/^\d{4}-\d{2}-\d{2}$/.test(r.start || '')) return;
      var a = S.acc(r.acc), it = { kind: 'due', title: r.name, start: r.start, allDay: true, uid: 'gospodar-' + r.id + '@fff.agenda', cat: 'scadență',
        rrule: 'FREQ=' + F[r.freq] + (r.interval > 1 ? ';INTERVAL=' + r.interval : '') + (r.end && /^\d{4}-\d{2}-\d{2}$/.test(r.end) ? ';UNTIL=' + r.end.replace(/-/g, '') : '') };
      if (withAmt) it.amount = { minor: r.amt, cur: a ? a.cur : '' };
      out.push(it);
    });
    return out;
  }
  function add(its) {
    var d = S.data(), accs = (d.accounts || []).filter(function (a) { return !a.archived; }), added = 0, skipped = 0;
    if (!accs.length) return { added: 0, skipped: its.length };
    its.forEach(function (it) {
      if (!it.amount || !it.rrule || !/^\d{4}-\d{2}-\d{2}$/.test(it.start)) { skipped++; return; }   // fără sumă nu se creează plată recurentă
      var fr = (it.rrule.match(/FREQ=([A-Z]+)/) || [])[1], iv = +((it.rrule.match(/INTERVAL=(\d+)/) || [])[1] || 1), un = (it.rrule.match(/UNTIL=(\d{4})(\d{2})(\d{2})/) || []);
      if (!R[fr]) { skipped++; return; }
      var acc = accs.filter(function (a) { return a.cur === it.amount.cur; })[0] || accs[0];
      if ((d.recs || []).some(function (r) { return r.agendaUid === it.uid || (r.name === it.title && r.start === it.start && r.amt === it.amount.minor); })) { skipped++; return; }
      d.recs.push({ id: S.nid('r'), agendaUid: it.uid, name: it.title, amt: it.amount.minor, acc: acc.id, cat: '', freq: R[fr], interval: Math.max(1, Math.min(60, iv)), start: it.start, end: un[1] ? un[1] + '-' + un[2] + '-' + un[3] : '', tags: [], note: '', paused: false });
      added++;
    });
    if (added) { S.commit('rec'); try { U.render(); } catch (e) { /* */ } }
    return { added: added, skipped: skipped };
  }
  function go() {
    var a = document.getElementById('themeBtn'); if (!a || document.getElementById('fffAgSend')) return;
    var m = A.mount({ slug: 'gospodar', app: 'Gospodar', className: a.className, getItems: function () { var c = document.getElementById('fffAgAmt'); return items(!!(c && c.checked)); }, addItems: add, before: a.nextSibling });
    if (!m) return;
    var lab = document.createElement('label'); lab.className = 'chk'; lab.style.cssText = 'display:inline-flex;gap:.3rem;align-items:center;font-size:.85em';
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'fffAgAmt'; lab.appendChild(cb); lab.appendChild(document.createTextNode(A.tr('amt')));
    m.recv.parentNode.insertBefore(lab, m.recv.nextSibling);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
