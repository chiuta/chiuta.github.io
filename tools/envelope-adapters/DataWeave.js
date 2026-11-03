/* Adaptor plic FFF · DataWeave: tabelul vizibil → table/csv; primește table/csv (se încarcă în DataWeave ca și cum ar fi fost deschis un fișier).
 * Etapa 4: primește și `experiment/ab` (clasamentul Elo din motorul A/B, ca tabel) și `claim/repro` (deschide Laboratorul de reproducere cu afirmația și o re-rulează);
 * butonul „Reproducere” re-rulează o afirmație pe tabelul vizibil sau pe un CSV lipit. */
(function () {
  if (!(window.FFF && window.FFF.envelope)) return;
  var E = FFF.envelope;
  function tableCsv() {
    var cols = visibleColumns(), rows = visibleRows(); if (!cols.length || !rows.length) return null;
    return toCSV(cols.map(function (c) { return c.name; }), rows.map(function (o) { return cols.map(function (c) { return o.r[c.key]; }); }));
  }
  function receive(env) {
    if (env.type === 'claim/repro') {
      var cp = FFF.repro && FFF.repro.cleanPayload(env.payload); if (!cp) throw 0;
      FFF.repro.panel({ app: 'DataWeave', slug: 'dataweave', getTable: tableCsv }, cp); return 'claim ✓';
    }
    if (env.type === 'experiment/ab') {
      var p = env.payload; if (!p || typeof p.csv !== 'string' || !p.csv) throw 0;
      loadText(p.csv, ('A-B ' + (p.question || env.title || '')).replace(/[^\w.\- ]+/g, '_').slice(0, 60) + '.csv'); return 'A/B ✓';
    }
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
    var r = E.importButton({ accepts: ['table/csv', 'experiment/ab', 'claim/repro'], onReceive: receive, className: p.className }); r.id = 'fffEnvRecv'; p.parentNode.insertBefore(r, p.nextSibling);
  }
  E.mount({ accepts: ['table/csv', 'experiment/ab', 'claim/repro'], onReceive: receive });
  if (FFF.repro) { var mountRepro = function () { FFF.repro.mount({ app: 'DataWeave', slug: 'dataweave', getTable: tableCsv }); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountRepro); else mountRepro(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
