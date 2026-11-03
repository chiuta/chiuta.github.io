/* Adaptor plic FFF · Arhiva fără frontiere: favoritele → citation/csl (CSL-JSON, tip „webpage”); primește citation/csl cu adrese archive.org/details/… */
(function () {
  if (!(window.FFF && window.FFF.envelope)) return;
  var E = FFF.envelope, KEY = 'arhiva-ff-favorite-v1';
  function favs() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function toCsl() {
    return favs().filter(function (f) { return f && typeof f.identifier === 'string'; }).map(function (f) {
      var c = { id: f.identifier, type: 'webpage', title: f.title || f.identifier, URL: 'https://archive.org/details/' + encodeURIComponent(f.identifier), publisher: 'Internet Archive' };
      var cr = [].concat(f.creator || []).filter(Boolean); if (cr.length) c.author = cr.map(function (n) { return { literal: String(n) }; });
      var y = parseInt(String(f.date || '').slice(0, 4), 10); if (y) c.issued = { 'date-parts': [[y]] };
      if (f.mediatype) c.genre = f.mediatype; return c;
    });
  }
  function receive(env) {
    var items = [];
    (Array.isArray(env.payload) ? env.payload : []).forEach(function (c) {
      var m = c && typeof c.URL === 'string' && c.URL.match(/^https:\/\/archive\.org\/details\/([A-Za-z0-9][A-Za-z0-9._@-]{0,199})/);
      if (!m) return; var id = decodeURIComponent(m[1]);
      items.push({ identifier: id, title: c.title, mediatype: c.genre, creator: (c.author || []).map(function (p) { return p.literal || p.family || ''; }).filter(Boolean), date: c.issued && c.issued['date-parts'] ? String(c.issued['date-parts'][0][0]) : undefined });
    });
    if (!items.length) throw 0;
    var inp = document.getElementById('importFavInput'); if (!inp || typeof DataTransfer === 'undefined') throw 0;
    var dt = new DataTransfer(); dt.items.add(new File([JSON.stringify({ favorites: items })], 'fff-favorite.json', { type: 'application/json' }));
    inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));   // aceeași cale ca „Importă favorite”: validare și contor ale aplicației
    return items.length + ' ✓';
  }
  function add() {
    var a = document.getElementById('exportFavMdBtn'); if (!a || document.getElementById('fffEnvSend')) return;
    var b = E.sendButton({ slug: 'arhiva-fara-frontiere', className: a.className, getEnv: function () {
      var c = toCsl(); if (!c.length) return null;
      return E.create({ type: 'citation/csl', title: 'Arhiva fără frontiere · favorite', payload: c, app: 'Arhiva fără frontiere', source: { label: 'Internet Archive (archive.org)', url: 'https://archive.org/' }, lang: document.documentElement.lang });
    } });
    b.id = 'fffEnvSend'; a.parentNode.insertBefore(b, a.nextSibling);
    var r = E.importButton({ accepts: ['citation/csl'], onReceive: receive, className: a.className }); r.id = 'fffEnvRecv'; b.parentNode.insertBefore(r, b.nextSibling);
  }
  E.mount({ accepts: ['citation/csl'], onReceive: receive });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
