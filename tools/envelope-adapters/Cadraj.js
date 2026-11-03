/* Adaptor plic FFF · Cadraj: colecțiile (clipurile adăugate) → table/csv; primește table/csv sau text cu linkuri TikTok și le trece prin formularul „Adaugă”. */
(function () {
  if (!(window.FFF && window.FFF.envelope)) return;
  var E = FFF.envelope;
  function receive(env) {
    var t = typeof env.payload === 'string' ? env.payload : '';
    var urls = (t.match(/https:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s",;<>]+/g) || []).filter(function (u, i, a) { return a.indexOf(u) === i; }).slice(0, 200);
    if (!urls.length) throw 0;
    var inp = document.getElementById('url-input'), form = document.getElementById('add-form'); if (!inp || !form) throw 0;
    inp.value = urls.join('\n'); if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    return urls.length + ' ✓';
  }
  function add() {
    var a = document.getElementById('csv-btn'); if (!a || document.getElementById('fffEnvSend')) return;
    var b = E.sendButton({ slug: 'cadraj', className: a.className, getEnv: function () {
      return E.capture(function () { a.click(); }).then(function (f) {
        if (!f.text || f.text.split(/\r?\n/).filter(Boolean).length < 2) return null;
        return E.create({ type: 'table/csv', title: 'Cadraj · colecții', payload: f.text, app: 'Cadraj', source: { label: 'Cadraj (clipuri adăugate manual)' }, lang: document.documentElement.lang });
      });
    } });
    b.id = 'fffEnvSend'; a.parentNode.insertBefore(b, a.nextSibling);
    var r = E.importButton({ accepts: ['table/csv', 'text/plain'], onReceive: receive, className: a.className }); r.id = 'fffEnvRecv'; b.parentNode.insertBefore(r, b.nextSibling);
  }
  E.mount({ accepts: ['table/csv', 'text/plain'], onReceive: receive });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
