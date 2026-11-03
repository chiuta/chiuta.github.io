/* Adaptor plic FFF · Constelar: conversația activă → text/markdown; primește text/markdown / text/plain în caseta de scris (nu se trimite nimic automat). */
(function () {
  if (!(window.FFF && window.FFF.envelope)) return;
  var E = FFF.envelope;
  function receive(env) {
    var t = typeof env.payload === 'string' ? env.payload : '', inp = document.getElementById('composerInput');
    if (!t || !inp) throw 0;
    inp.value = (inp.value ? inp.value + '\n\n' : '') + t.slice(0, 20000); inp.dispatchEvent(new Event('input', { bubbles: true })); try { inp.focus(); } catch (e) { /* fără focus */ }
    return '✓';
  }
  function add() {
    var a = document.getElementById('btnExportConvo'); if (!a || document.getElementById('fffEnvSend')) return;
    var b = E.sendButton({ slug: 'constelar', className: a.className, getEnv: function () {
      return E.capture(function () { a.click(); }).then(function (f) {
        if (!f.text || f.text.split('\n').length < 5) return null;
        return E.create({ type: 'text/markdown', title: (f.text.match(/^# (.+)$/m) || [0, 'Constelar'])[1], payload: f.text, app: 'Constelar', source: { label: 'Conversație Constelar (locală, generată de un model AI)' }, lang: document.documentElement.lang });
      });
    } });
    b.id = 'fffEnvSend'; b.setAttribute('aria-label', E.tr('send')); a.parentNode.insertBefore(b, a.nextSibling);
    var r = E.importButton({ accepts: ['text/markdown', 'text/plain'], onReceive: receive, className: a.className }); r.id = 'fffEnvRecv'; b.parentNode.insertBefore(r, b.nextSibling);
  }
  E.mount({ accepts: ['text/markdown', 'text/plain'], onReceive: receive });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
