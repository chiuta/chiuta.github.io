/* Adaptor pașaport de învățare FFF · comun celor 13 aplicații de educație: „Notează în pașaport” + panoul „Pașaport” (repetări scadente, export/import passport/fff, certificat tipărabil).
 * Subiectul propus la notare = secțiunea activă a aplicației (aria-current / aria-selected / primul titlu vizibil / titlul paginii); persoana îl poate modifica. Clopotel primește în plus „Încarcă repetările de azi în agendă”. */
(function () {
  if (!(window.FFF && FFF.envelope && FFF.passport)) return;
  var P = FFF.passport, slug = (FFF.app && FFF.app.slug) || '', NAMES = { atingere: 'ATINGERE', clopotel: 'Clopotel', monstrarium: 'Monstrarium', eter: 'ETER', fabrica: 'Fabrica', fascicul: 'FASCICUL', seva: 'SEVA', indicativ: 'INDICATIV', mensura: 'MENSURA', puls: 'PULS', qso: 'QSO', regexlab: 'RegexLab', seoptimum: 'SEOptimum' };
  var app = NAMES[slug] || (document.title || slug).split(/[—–|·-]/)[0].trim();
  function vis(e) { return e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'; }
  function txt(e) { return (e && (e.getAttribute('aria-label') || e.textContent) || '').replace(/\s+/g, ' ').trim(); }
  function section() {
    var sels = ['[aria-current="page"]', '[aria-current="true"]', '[role="tab"][aria-selected="true"]', 'nav .active', 'main h2', 'main h1', 'h2', 'h1:not(.sr-only):not(.sr-h1)'];
    for (var i = 0; i < sels.length; i++) { var l = document.querySelectorAll(sels[i]); for (var j = 0; j < l.length; j++) { if (vis(l[j]) && !l[j].closest('.fffp-box')) { var t = txt(l[j]); if (t && t.length < 100) return t; } } }
    return (document.title || app).slice(0, 100);
  }
  function draft() { var s = section(), a = app.toLowerCase(); return { skill: s.toLowerCase().indexOf(a) >= 0 ? s : app + ' — ' + s, level: 2 }; }
  var extras = [];
  if (slug === 'clopotel') extras.push({ id: 'fffpAgenda', text: P.tr('sess'), run: function (redraw) {
    var d = P.due(); if (!d.length) { FFF.envelope.toast(P.tr('sessz')); return; }
    var ta = document.getElementById('pasteTa'), add = document.getElementById('pAdd'); if (!ta || !add) return;
    ta.value = d.slice(0, 40).map(function (e) { return e.skill.replace(/[|;\t\r\n]+/g, ' ').slice(0, 100) + ' | ' + e.app.replace(/[|;\t\r\n]+/g, ' ') + ' | 2'; }).join('\n');
    add.click(); FFF.envelope.toast(P.tr('sessn', { n: Math.min(40, d.length) })); if (redraw) redraw();
  } });
  function go() { if (document.getElementById('fffpFab')) return; P.mount({ app: app, slug: slug, draft: draft, extras: extras }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
