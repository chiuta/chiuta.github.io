/* Adaptor plic FFF · AGORA (Etapa 4, laboratorul de reproducere): primește `claim/repro` (de la DataWeave / AcademiSearch) și marchează cifrele din comparatorul de state
 * „verificat” (afirmația a fost reprodusă din date atașate), „nepotrivit” (reproducerea dă alt rezultat) sau „neverificat” (nicio reproducere). Potrivirea se face pe
 * `subject.indicator` (numele indicatorului ales în comparator) și `subject.country` (codul sau numele statului). Reproducerile se țin local (`agora.repro`).
 * „Verificat” înseamnă doar că aritmetica afirmației iese din datele atașate, nu că datele sunt corecte. */
(function () {
  if (!(window.FFF && FFF.envelope && FFF.repro)) return;
  var E = FFF.envelope, KEY = 'agora.repro', MAX = 60;
  var L = {
    ro: { ok: 'verificat', no: 'nepotrivit', un: 'neverificat', sum: '{v} verificate, {n} nepotrivite, {u} neverificate', why: 'Reproducere (DataWeave / AcademiSearch): {c} — {t}', imp: 'Primește reproducere', done: 'Reproducere primită', head: 'Cifre verificate prin reproducere' },
    en: { ok: 'verified', no: 'mismatch', un: 'unverified', sum: '{v} verified, {n} mismatched, {u} unverified', why: 'Reproduction (DataWeave / AcademiSearch): {c} — {t}', imp: 'Receive a reproduction', done: 'Reproduction received', head: 'Figures verified by reproduction' },
    fr: { ok: 'vérifié', no: 'écart', un: 'non vérifié', sum: '{v} vérifiés, {n} en écart, {u} non vérifiés', why: 'Reproduction (DataWeave / AcademiSearch) : {c} — {t}', imp: 'Recevoir une reproduction', done: 'Reproduction reçue', head: 'Chiffres vérifiés par reproduction' },
    it: { ok: 'verificato', no: 'discordante', un: 'non verificato', sum: '{v} verificati, {n} discordanti, {u} non verificati', why: 'Riproduzione (DataWeave / AcademiSearch): {c} — {t}', imp: 'Ricevi una riproduzione', done: 'Riproduzione ricevuta', head: 'Cifre verificate per riproduzione' },
    es: { ok: 'verificado', no: 'discrepante', un: 'sin verificar', sum: '{v} verificadas, {n} discrepantes, {u} sin verificar', why: 'Reproducción (DataWeave / AcademiSearch): {c} — {t}', imp: 'Recibir una reproducción', done: 'Reproducción recibida', head: 'Cifras verificadas por reproducción' },
    pt: { ok: 'verificado', no: 'divergente', un: 'não verificado', sum: '{v} verificadas, {n} divergentes, {u} não verificadas', why: 'Reprodução (DataWeave / AcademiSearch): {c} — {t}', imp: 'Receber uma reprodução', done: 'Reprodução recebida', head: 'Números verificados por reprodução' },
    de: { ok: 'geprüft', no: 'abweichend', un: 'ungeprüft', sum: '{v} geprüft, {n} abweichend, {u} ungeprüft', why: 'Reproduktion (DataWeave / AcademiSearch): {c} — {t}', imp: 'Reproduktion empfangen', done: 'Reproduktion empfangen', head: 'Durch Reproduktion geprüfte Zahlen' },
    hu: { ok: 'igazolt', no: 'eltérő', un: 'nem igazolt', sum: '{v} igazolt, {n} eltérő, {u} nem igazolt', why: 'Reprodukció (DataWeave / AcademiSearch): {c} — {t}', imp: 'Reprodukció fogadása', done: 'Reprodukció megérkezett', head: 'Reprodukcióval igazolt számok' }
  };
  function tr(k, v) { var l = (document.documentElement.lang || '').slice(0, 2).toLowerCase(), s = (L[l] || L.en)[k]; if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]); return s; }
  var norm = function (x) { return String(x == null ? '' : x).trim().toLowerCase(); };
  function load() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.map(FFF.repro.cleanPayload).filter(Boolean).slice(0, MAX) : []; } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, MAX).map(function (p) { var q = JSON.parse(JSON.stringify(p)); if (q.data) delete q.data.csv; return q; }))); return true; } catch (e) { return false; } }
  function receive(env) {
    var p = FFF.repro.cleanPayload(env.payload); if (!p || !p.subject || !norm(p.subject.indicator)) throw 0;
    var a = load().filter(function (x) { return !(norm(x.subject && x.subject.indicator) === norm(p.subject.indicator) && norm(x.subject && x.subject.country) === norm(p.subject.country)); });
    a.unshift(p); if (!save(a)) throw 0; mark(); return tr('done');
  }
  var busy = false, obs = null;
  function stateOf(rep) { return rep ? (rep.verdict === 'reproduced' ? 'ok' : rep.verdict === 'not-reproduced' ? 'no' : 'un') : 'un'; }
  function mark() {
    var ul = document.getElementById('cmpRows'), sel = document.getElementById('cmpA'); if (!ul || !sel || busy) return; busy = true;
    try {
      var ind = norm(sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].textContent), idv = norm(sel.value), reps = load().filter(function (r) { var i = norm(r.subject && r.subject.indicator); return i && (i === ind || i === idv); });
      var c = { ok: 0, no: 0, un: 0 };
      Array.prototype.forEach.call(ul.querySelectorAll('li.cmp-row'), function (li) {
        var old = li.querySelector('.fffr-mark'); if (old) old.remove();
        var id = norm(li.dataset.id), nm = norm((li.querySelector('.cmp-name') || {}).textContent);
        var rep = reps.filter(function (r) { var cty = norm(r.subject.country); return cty && (cty === id || cty === nm); })[0], st = stateOf(rep); c[st]++;
        var m = document.createElement('span'); m.className = 'fffr-mark'; m.dataset.state = st; m.textContent = (st === 'ok' ? '✓ ' : st === 'no' ? '≠ ' : '') + tr(st);
        if (rep) m.title = tr('why', { c: rep.claim || '', t: rep.verdict + ' (' + (rep.result == null ? '—' : rep.result) + ')' });
        li.appendChild(m);
      });
      var s = document.getElementById('fffrSummary'); if (!s) { s = document.createElement('p'); s.id = 'fffrSummary'; s.className = 'cmp-src'; s.setAttribute('role', 'status'); var src = document.getElementById('cmpSrc'); if (src) src.insertAdjacentElement('afterend', s); }
      s.textContent = tr('head') + ': ' + tr('sum', { v: c.ok, n: c.no, u: c.un });
    } finally { busy = false; }
  }
  function add() {
    if (!document.getElementById('fffrStyle')) { var st = document.createElement('style'); st.id = 'fffrStyle'; st.textContent = '.fffr-mark{display:inline-block;margin-left:.5em;padding:0 .4em;border:1px solid currentColor;border-radius:4px;font:600 .75em system-ui;white-space:nowrap}.fffr-mark[data-state=ok]{color:var(--ok,#1a7f37)}.fffr-mark[data-state=no]{color:var(--danger,#b42318)}.fffr-mark[data-state=un]{opacity:.85}'; document.head.appendChild(st); }
    var ul = document.getElementById('cmpRows'); if (!ul || document.getElementById('fffEnvRecv')) return;
    var anchor = document.getElementById('cmpCsv'); if (anchor) { var r = E.importButton({ accepts: ['claim/repro'], text: tr('imp'), onReceive: receive, className: anchor.className }); r.id = 'fffEnvRecv'; anchor.parentNode.insertBefore(r, anchor.nextSibling); }
    obs = new MutationObserver(function () { if (!busy) mark(); }); obs.observe(ul, { childList: true }); mark();
  }
  E.mount({ accepts: ['claim/repro'], onReceive: receive });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
