/* fff-kit · FFF.ux — confort și satisfacție la utilizare, același în toate aplicațiile:
 * (1) CSS (ux.css): ținte de atingere ≥44 px pe ecrane tactile, câmpuri cu text ≥16 px (fără zoom-ul intempestiv din iOS), fără întârzierea de 300 ms
 *     la atingere (touch-action), apăsare vizibilă, derulare lină (respectă „mișcare redusă”), cuvinte lungi rupte în loc să iasă din ecran;
 * (2) confirmare discretă la copiere în clipboard și la salvarea unui fișier (toast), doar dacă aplicația nu și-a afișat deja propria confirmare;
 * (3) tasta „/” duce focusul în câmpul de căutare, Esc îl părăsește; (4) legăturile/etichetele mici ne-inline primesc zonă de atingere de 44 px.
 * Opriri: <meta name="fff-ux" content="off">, ?noux=1; pe element: data-fff-hit="off" nu se aplică; data-fff-nouxfont păstrează textul propriu al câmpului. */
(function () {
  'use strict';
  var F = window.FFF;
  if (!F || F.ux) return;
  var doc = document, de = doc.documentElement;
  function T(k) { return F.t('ux', k); }
  var OFF = false;
  function readOff() {
    var m = doc.querySelector('meta[name="fff-ux"]');
    OFF = (m && /^(off|0|false)$/i.test((m.getAttribute('content') || '').trim())) || /[?&]noux=(1|true)\b/.test(location.search);
    if (OFF) de.setAttribute('data-fff-ux', 'off');
  }
  function toast(msg) {
    try { if (F.dialog && F.dialog.toast) F.dialog.toast(msg, {type: 'success', timeout: 2200}); } catch (e) { /* ignorat */ }
  }

  /* confirmare doar dacă aplicația nu a afișat deja ceva similar (urmărim modificările din momentul acțiunii până la ~450 ms după încheierea ei) */
  function watch(re) {
    var w = {own: false, mo: null, stop: function () { if (w.mo) w.mo.disconnect(); }};
    try {
      w.mo = new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length && !w.own; i++) {
          var m = ms[i], t = '';
          if (m.target.closest && m.target.closest('[data-fff-toasts]')) continue;
          if (m.type === 'characterData') t = m.target.nodeValue || '';
          else if (m.type === 'attributes') t = (m.target.textContent || '') + ' ' + (m.target.getAttribute('aria-label') || '') + ' ' + (m.target.getAttribute('title') || '');
          else for (var j = 0; j < m.addedNodes.length; j++) t += ' ' + (m.addedNodes[j].textContent || '');
          if (re.test(t)) w.own = true;
        }
      });
      w.mo.observe(doc.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-label', 'title']});
    } catch (e) { /* ignorat */ }
    return w;
  }
  function finish(w, msg) { setTimeout(function () { w.stop(); if (!w.own) toast(msg); }, 450); }
  function confirmUnlessOwn(re, msg) { if (!OFF) finish(watch(re), msg); }
  var RE_COPY = /copi|cop[ií]ad|kopier|másol|copied|copy/i, RE_SAVE = /salvat|exportat|descărc|descarg|télécharg|scaric|download|saved|export|gespeichert|letölt|mentve|baixad|guardad/i;

  function patchClipboard() {
    try {
      var cb = navigator.clipboard;
      if (!cb || !cb.writeText || cb.writeText.__fffux) return;
      var orig = cb.writeText.bind(cb);
      var w = function (t) {
        var w = OFF ? null : watch(RE_COPY), p = orig(t);
        if (w) { if (p && p.then) p.then(function () { finish(w, T('copied')); }, function () { w.stop(); }); else w.stop(); }
        return p;
      };
      w.__fffux = true;
      cb.writeText = w;
    } catch (e) { /* ignorat */ }
    doc.addEventListener('copy', function () { /* copiere manuală: nimic */ }, {passive: true});
  }
  function patchDownload() {
    try {
      var proto = HTMLAnchorElement.prototype, orig = proto.click;
      if (orig.__fffux) return;
      var c = function () {
        try { if (!OFF && this.hasAttribute && this.hasAttribute('download')) { var n = this.getAttribute('download') || ''; confirmUnlessOwn(RE_SAVE, T('saved') + (n ? ': ' + n : '')); } } catch (e) { /* ignorat */ }
        return orig.apply(this, arguments);
      };
      c.__fffux = true;
      proto.click = c;
    } catch (e) { /* ignorat */ }
    doc.addEventListener('click', function (e) {                                  // clic real pe un <a download>
      var a = e.target && e.target.closest && e.target.closest('a[download]');
      if (a && !OFF) { var n = a.getAttribute('download') || ''; confirmUnlessOwn(RE_SAVE, T('saved') + (n ? ': ' + n : '')); }
    }, true);
  }

  /* „/” → căutare */
  function searchField() {
    var q = doc.querySelectorAll('input[type=search],[role=searchbox],input[placeholder*="ăut" i],input[placeholder*="earch" i],input[placeholder*="echerch" i],input[placeholder*="uscar" i],input[aria-label*="ăut" i],input[aria-label*="earch" i],input[id*="search" i],input[id*="cauta" i],input[id*="caut" i],input[name*="search" i]');
    for (var i = 0; i < q.length; i++) {
      var e = q[i], r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      if (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.disabled && !e.readOnly) return e;
    }
    return null;
  }
  function onKey(e) {
    if (OFF || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName, typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable);
    if (e.key === '/' && !typing) {
      var f = searchField();
      if (f) { e.preventDefault(); f.focus(); try { f.select(); } catch (x) { /* ignorat */ } }
    } else if (e.key === 'Escape' && typing && t.type === 'search') { t.blur(); }
  }

  /* zonă de atingere pentru legături/etichete mici, ne-inline (butoane stilizate ca <a>), doar pe ecrane tactile */
  function hitPass() {
    if (OFF || !window.matchMedia || !matchMedia('(pointer:coarse)').matches) return;
    var as = doc.querySelectorAll('a[href]:not([data-fff-hit]), [role=link]:not([data-fff-hit])'), n = 0;
    for (var i = 0; i < as.length && n < 300; i++, n++) {
      var a = as[i], cs = getComputedStyle(a);
      if (cs.display === 'inline') continue;
      var r = a.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.height >= 44) continue;
      if (cs.position === 'absolute' || cs.position === 'fixed') continue;
      a.setAttribute('data-fff-hit', '1');
    }
  }
  var hitT = 0;
  function scheduleHit() { clearTimeout(hitT); hitT = setTimeout(hitPass, 500); }

  function init() {
    readOff();
    if (OFF) return;
    patchClipboard(); patchDownload();
    doc.addEventListener('keydown', onKey);
    scheduleHit();
    try { new MutationObserver(scheduleHit).observe(doc.body, {childList: true, subtree: true}); } catch (e) { /* ignorat */ }
  }
  F.ux = {off: function () { OFF = true; de.setAttribute('data-fff-ux', 'off'); }, hitPass: hitPass, searchField: searchField, version: 1};
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
