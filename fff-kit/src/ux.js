/* fff-kit · FFF.ux — confort și satisfacție la utilizare, același în toate aplicațiile:
 * (1) CSS (ux.css): ținte de atingere ≥44 px pe ecrane tactile, câmpuri cu text ≥16 px (fără zoom-ul intempestiv din iOS), fără întârzierea de 300 ms
 *     la atingere (touch-action), apăsare vizibilă, derulare lină (respectă „mișcare redusă”), cuvinte lungi rupte în loc să iasă din ecran;
 * (2) confirmare discretă la copiere în clipboard și la salvarea unui fișier (toast), doar dacă aplicația nu și-a afișat deja propria confirmare;
 * (3) tasta „/” duce focusul în câmpul de căutare, Esc îl părăsește; (4) controalele vizibile mai mici de 44 px primesc min-height/min-width de 44 px (grupul de frați se lasă neatins dacă mărirea ar rupe lățimea paginii).
 * Opriri: <meta name="fff-ux" content="off">, ?noux=1; pe element: data-fff-nosz (nu îl mărește), data-fff-nouxfont (păstrează textul propriu al câmpului); pe elementul rădăcină: data-fff-nosz. */
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

  /* ținte de atingere: pe ecrane tactile, controalele vizibile mai mici de 44 px primesc min-height/min-width 44 px (și peste stilul propriu al aplicației,
   * care adesea fixează 26–36 px). Se sar: casetele/radio/range (se apasă prin etichetă), legăturile din text, elementele ascunse vizual, celulele de tablă/tastatură
   * (≥8 frați identici, aproape pătrați). Dacă mărirea unui grup de frați ar produce derulare orizontală nouă, grupul rămâne neatins. */
  var sized = [], hitT = 0;
  function coarse() { return !!(window.matchMedia && matchMedia('(pointer:coarse)').matches); }
  function rollback() { sized.forEach(function (e) { e.style.removeProperty('min-height'); e.style.removeProperty('min-width'); e.removeAttribute('data-fff-sz'); }); sized = []; }
  function boardLike(e, r) {
    var p = e.parentElement; if (!p || r.width / r.height < 0.65 || r.width / r.height > 1.5) return false;
    var n = 0, c = p.children; for (var i = 0; i < c.length; i++) if (c[i].tagName === e.tagName && c[i].className === e.className) n++;
    return n >= 8;
  }
  function undo(e) { e.style.removeProperty('min-height'); e.style.removeProperty('min-width'); e.removeAttribute('data-fff-sz'); }
  function sizePass() {
    if (OFF || !coarse() || doc.documentElement.hasAttribute('data-fff-nosz')) return;
    var vw = innerWidth, base = Math.max(de.scrollWidth, vw);
    var els = doc.querySelectorAll('a[href],button,input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),select,textarea,summary,[role=button],[role=tab],[role=menuitem],[role=link]');
    var groups = [], seen = [];
    for (var i = 0; i < els.length && i < 800; i++) {
      var e = els[i];
      if (e.hasAttribute('data-fff-sz') || e.hasAttribute('data-fff-nosz') || (e.closest && e.closest('[data-fff-nosz],[data-fff-view],.fff-exit,[data-fff-toasts]'))) continue;
      var r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      if (r.height >= 44 && r.width >= 44) continue;
      var cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.display === 'inline' || +cs.opacity === 0) continue;
      if (cs.position === 'absolute' && (cs.clip !== 'auto' || (r.width <= 25 && r.height <= 25 && cs.overflow === 'hidden'))) continue;       // vizibile doar pentru cititoarele de ecran
      if (boardLike(e, r)) continue;
      var k = seen.indexOf(e.parentElement); if (k < 0) { seen.push(e.parentElement); groups.push([]); k = seen.length - 1; }
      groups[k].push({e: e, h: r.height, w: r.width});
    }
    for (var g = 0; g < groups.length; g++) {                       // pe grupuri de frați: dacă mărirea lor ar lărgi pagina, doar grupul acela rămâne neatins
      var grp = groups[g];
      grp.forEach(function (o) {
        if (o.h < 44) o.e.style.setProperty('min-height', '44px', 'important');
        if (o.w < 44 && o.e.tagName !== 'INPUT' && o.e.tagName !== 'SELECT' && o.e.tagName !== 'TEXTAREA') o.e.style.setProperty('min-width', '44px', 'important');
        o.e.setAttribute('data-fff-sz', '1');
      });
      if (de.scrollWidth > base + 1) grp.forEach(function (o) { undo(o.e); o.e.setAttribute('data-fff-nosz', '1'); });
      else grp.forEach(function (o) { sized.push(o.e); });
    }
  }
  var lastRun = 0;
  function scheduleHit(fast) {                                  // cel mult o trecere la ~100 ms, prima la 40 ms după modificare
    if (hitT) return;
    hitT = setTimeout(function () { hitT = 0; lastRun = Date.now(); sizePass(); }, Math.max(40, 100 - (Date.now() - lastRun)));
  }
  function hitPass() { sizePass(); }

  function init() {
    readOff();
    if (OFF) return;
    patchClipboard(); patchDownload();
    doc.addEventListener('keydown', onKey);
    scheduleHit(true);
    try { new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) { var t = ms[i].target; if (!t.closest || !t.closest('[data-fff-toasts]')) { scheduleHit(); return; } } }).observe(doc.body, {childList: true, subtree: true}); } catch (e) { /* ignorat */ }
    var attrT = 0;                                              // elemente afișate prin clasă/hidden/style: o trecere la cel mult ~250 ms
    try {
      new MutationObserver(function (ms) {
        if (attrT) return;
        for (var i = 0; i < ms.length; i++) { var m = ms[i], t = m.target; if (t.hasAttribute && t.hasAttribute('data-fff-sz') && (m.attributeName === 'style' || m.attributeName === 'data-fff-sz')) continue; if (t.closest && t.closest('[data-fff-view],[data-fff-toasts],.fff-exit')) continue; attrT = setTimeout(function () { attrT = 0; scheduleHit(); }, 150); return; }
      }).observe(doc.body, {subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style', 'open', 'aria-hidden']});
    } catch (e) { /* ignorat */ }
    window.addEventListener('resize', function () { scheduleHit(); }, {passive: true});
    window.addEventListener('load', function () { scheduleHit(true); });
  }
  F.ux = {off: function () { OFF = true; rollback(); de.setAttribute('data-fff-ux', 'off'); }, sizePass: sizePass, hitPass: hitPass, searchField: searchField, version: 2};
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
