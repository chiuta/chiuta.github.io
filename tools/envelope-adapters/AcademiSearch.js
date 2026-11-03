/* Adaptor plic FFF · AcademiSearch: biblioteca ★ → citation/csl; primește citation/csl (fișier, clipboard, QR, alte file, link).
 * Etapa 4: (1) lanțul de surse — nota CSL și adnotarea `custom.veriga` (VERIGA) se păstrează în nota referinței, deci un document scanat (LegatorOCR → TEZAUR → VERIGA)
 * ajunge în bibliotecă ca referință citabilă, cu amprenta scanării; (2) laboratorul de reproducere: butonul „Reproducere” și primirea plicului `claim/repro`. */
(function () {
  if (!(window.FFF && window.FFF.envelope)) return;
  var E = FFF.envelope;
  function toCsl() {
    return _lib.map(function (x) {
      var c = { id: x.k, type: 'article-journal', title: x.title };
      if (x.authors) c.author = [{ literal: x.authors }];
      if (+x.year) c.issued = { 'date-parts': [[+x.year]] };
      if (x.journal) c['container-title'] = x.journal;
      if (x.doi) c.DOI = x.doi; if (x.url) c.URL = x.url; if (x.abstract) c.abstract = x.abstract;
      return c;
    });
  }
  function chainNote(c) {
    var v = c.custom && c.custom.veriga, p = [];
    if (typeof c.note === 'string' && c.note) p.push(c.note.slice(0, 600));
    if (v && typeof v === 'object') p.push('VERIGA: ' + String(v.status || '?').slice(0, 20) + (v.checked ? '' : ' (not checked)') + (v.http ? ' HTTP ' + (+v.http || 0) : ''));
    return p.join(' · ').slice(0, 900);
  }
  function receive(env) {
    if (env.type === 'claim/repro') {
      var cp = FFF.repro && FFF.repro.cleanPayload(env.payload); if (!cp) throw 0;
      FFF.repro.panel({ app: 'AcademiSearch', slug: 'academisearch' }, cp); return 'claim ✓';
    }
    libLoad(); var n = 0;
    (Array.isArray(env.payload) ? env.payload : []).forEach(function (c) {
      if (!c || typeof c.title !== 'string') return;
      var a = (c.author || []).map(function (p) { return p.literal || ((p.family || '') + (p.given ? ', ' + p.given : '')); }).join('; ');
      var y = c.issued && c.issued['date-parts'] && c.issued['date-parts'][0] && c.issued['date-parts'][0][0];
      var it = { title: c.title, authors: a, year: y || '', journal: c['container-title'] || '', doi: c.DOI || '', url: c.URL || '', abstract: c.abstract || '', note: chainNote(c), src: 'fff' };
      if (libHas(it) || _lib.length >= LIB_MAX) return;
      var x = libClean(it); x.k = libKeyOf(it); x.saved = new Date().toISOString().slice(0, 10); _lib.unshift(x); n++;
    });
    if (!libPersist()) { libLoad(); throw 0; }
    libCountUpdate(); return n + ' ✓';
  }
  function add() {
    var f = document.getElementById('libFootBtn'); if (!f || document.getElementById('fffEnvSend')) return;
    var old = document.getElementById('fffSend'); if (old) old.remove();   // butonul vechi „Trimite la…” e înlocuit de cel cu plic (acoperă și fișier, clipboard, QR)
    var b = E.sendButton({ slug: 'academisearch', className: f.className, getEnv: function () {
      libLoad(); if (!_lib.length) return null;
      return E.create({ type: 'citation/csl', title: 'AcademiSearch', payload: toCsl(), app: 'AcademiSearch', source: { label: 'AcademiSearch · biblioteca mea', url: 'https://academisearch.chiuta.ro/' }, lang: document.documentElement.lang });
    } });
    b.id = 'fffEnvSend'; f.parentNode.insertBefore(b, f.nextSibling);
    var r = E.importButton({ accepts: ['citation/csl', 'claim/repro'], onReceive: receive, className: f.className }); r.id = 'fffEnvRecv'; b.parentNode.insertBefore(r, b.nextSibling);
  }
  E.mount({ accepts: ['citation/csl', 'claim/repro'], onReceive: receive });
  if (FFF.repro) { var mountRepro = function () { FFF.repro.mount({ app: 'AcademiSearch', slug: 'academisearch' }); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountRepro); else mountRepro(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
