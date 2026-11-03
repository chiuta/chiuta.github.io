/* Adaptor plic FFF · DataWeave: tabelul vizibil → table/csv; primește table/csv (se încarcă în DataWeave ca și cum ar fi fost deschis un fișier). */
(function () {
  if (!(window.FFF && window.FFF.envelope)) return;
  var E = FFF.envelope;
  function receive(env) {
    if (typeof env.payload !== 'string' || !env.payload) throw 0;
    loadText(env.payload, (env.title || 'fff').replace(/[^\w.\- ]+/g, '_').slice(0, 60) + '.csv'); return 'CSV ✓';
  }
  function add() {
    var a = document.getElementById('exportClean'); if (!a || document.getElementById('fffEnvSend')) return;
    var b = E.sendButton({ slug: 'dataweave', className: a.className, getEnv: function () {
      var cols = visibleColumns(), rows = visibleRows();
      if (!cols.length || !rows.length) return null;
      var csv = toCSV(cols.map(function (c) { return c.name; }), rows.map(function (o) { return cols.map(function (c) { return o.r[c.key]; }); }));
      return E.create({ type: 'table/csv', title: (state.fileName || 'DataWeave').replace(/\.[^.]+$/, ''), payload: csv, app: 'DataWeave', source: { label: state.fileName || 'DataWeave' }, lang: document.documentElement.lang });
    } });
    b.id = 'fffEnvSend'; a.parentNode.insertBefore(b, a.nextSibling);
    var p = document.getElementById('pasteBtn') || a;   // „Primește…” e disponibil și pe ecranul de pornire, unde încă nu există date
    var r = E.importButton({ accepts: ['table/csv'], onReceive: receive, className: p.className }); r.id = 'fffEnvRecv'; p.parentNode.insertBefore(r, p.nextSibling);
  }
  E.mount({ accepts: ['table/csv'], onReceive: receive });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
