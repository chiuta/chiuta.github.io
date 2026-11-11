/* fff-kit · FFF.view — vedere comodă pe orice ecran: (1) antete de tabel fixe la derulare, (2) bară de jos cu zoom − / + / automat,
 * (3) zoom automat la încărcare, ca textul să fie mare și conținutul să ocupe spațiul util al ecranului.
 * Antete fixe: regulile CSS (specificitate 0) fac antetul de tabel „lipicios”; pentru tabelele aflate într-un container care taie sau derulează
 * pe orizontală (overflow), containerul primește o înălțime maximă ca antetul să rămână fix în el. Stilul propriu al aplicației are prioritate.
 * Zoom: proprietatea CSS `zoom` pe elementul rădăcină (html), înmulțită din doi factori: cel automat (calculat din mărimea textului și din lățimea ocupată) și cel ales
 * de utilizator (butoanele, păstrat în stocarea locală sub fff.<slug>.view). Automatul se verifică singur: dacă ar apărea derulare orizontală
 * nouă (sau o pagină care încăpea pe verticală ar începe să se derulească), factorul se înjumătățește și, în ultimă instanță, rămâne 1.
 * Nu se aplică la aplicații dominate de un <canvas>/<video>/<iframe> (zoom-ul automat ar strica calculele lor în pixeli).
 * Bara și zoom-ul automat nu apar în iframe, în modul chioșc/încorporat (?kiosk=1, ?embed=1, ?noview=1) și în browsere automatizate
 * (navigator.webdriver), ca testele să vadă pagina neschimbată. Se opresc cu <meta name="fff-view" content="off"> (totul),
 * "sticky" (doar antetele fixe) sau "noauto" (fără zoom automat, bara rămâne). API: FFF.view.{zoomIn, zoomOut, reset, get, set, refit, hide, show, mount}. */
(function () {
  'use strict';
  var F = window.FFF;
  if (!F || F.view) return;
  var doc = document, de = doc.documentElement;
  var MIN = 0.5, MAX = 3, STEP = 1.12;
  function T(k) { return F.t('view', k); }
  function meta(n) { var m = doc.querySelector('meta[name="' + n + '"]'); return m ? (m.getAttribute('content') || '') : ''; }
  var MODE = '', OFF = false;          // <meta> poate veni după script: se citește la DOMContentLoaded (init)
  function RAW() { return F.store && F.store.raw ? F.store.raw : null; }
  function KEY() { return ((F.store && F.store.prefix) || ('fff.' + (F.slug || 'app') + '.')) + 'view'; }

  var root = null, bar = null, live = null, bIn = null, bOut = null, bFit = null;
  var user = 1, auto = 1, total = 1, side = 'r', idleT = 0, wanted = true, forced = false, laterT = 0, stickyT = 0, trT = 0, mo = null;

  function zoomOk() { try { return !!(window.CSS && CSS.supports && CSS.supports('zoom', '1.2')); } catch (e) { return false; } }
  function eligible() {
    if (OFF) return false;
    if (forced) return zoomOk();
    if (!wanted) return false;
    if (window.top !== window.self) return false;
    if (navigator.webdriver) return false;
    if (/[?&](kiosk|embed)=(1|true)\b/.test(location.search) || de.classList.contains('kiosk') || (doc.body && doc.body.classList.contains('kiosk'))) return false;
    return zoomOk();
  }
  function clamp(z) { return Math.min(MAX, Math.max(MIN, z)); }
  function round2(z) { return Math.round(z * 100) / 100; }

  /* ---------- stare ---------- */
  function load() {
    try {
      var R = RAW(), raw = R ? R.get(KEY()) : null;
      var j = raw ? JSON.parse(raw) : null;
      if (j && typeof j.u === 'number' && j.u >= MIN && j.u <= MAX) user = j.u;
    } catch (e) { /* ignorat */ }
  }
  function save() {
    try {
      var R = RAW(); if (!R) return;
      if (Math.abs(user - 1) < 0.005) R.remove(KEY()); else R.set(KEY(), JSON.stringify({u: round2(user)}));
    } catch (e) { /* ignorat */ }
  }

  /* ---------- zoom ---------- */
  function applyZoom(z) {
    total = clamp(z);
    if (Math.abs(total - 1) < 0.005) { de.style.removeProperty('zoom'); de.style.removeProperty('--fff-zinv'); }
    else { de.style.zoom = String(round2(total)); de.style.setProperty('--fff-zinv', String(Math.round(1e4 / total) / 1e4)); }
    if (root) root.style.zoom = total === 1 ? '' : String(Math.round(1e4 / total) / 1e4);
    state();
  }
  function state() {
    if (!bar) return;
    bOut.disabled = total <= MIN + 0.001;
    bIn.disabled = total >= MAX - 0.001;
    var pct = Math.round(total * 100) + '%';
    bFit.title = T('fit') + ' (' + pct + ')';
    bFit.setAttribute('aria-label', T('fit') + ', ' + pct);
    live.textContent = T('zoom') + ' ' + pct;
  }

  /* partea „statică” a măsurătorii: mărimea textului și lățimea ocupată de text, la zoom 1 */
  function measure() {
    var body = doc.body, vw = de.clientWidth, vh = de.clientHeight, out = {vw: vw, vh: vh, font: 16, span: vw, appLike: false, over: false, scrolls: false};
    try { out.font = parseFloat(getComputedStyle(body).fontSize) || 16; } catch (e) { /* ignorat */ }
    out.over = de.scrollWidth > vw + 2;
    out.scrolls = de.scrollHeight > vh + 2;
    var left = 1e9, right = -1e9, n = 0, els = body.querySelectorAll('*'), big = 0;
    for (var i = 0; i < els.length && n < 1500; i++, n++) {
      var e = els[i], tag = e.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'META' || tag === 'TEMPLATE' || tag === 'NOSCRIPT') continue;
      if (root && root.contains(e)) continue;
      var r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (tag === 'CANVAS' || tag === 'VIDEO' || tag === 'IFRAME' || tag === 'OBJECT' || tag === 'EMBED') {
        if (r.width * r.height > 0.3 * vw * vh) big++;
        continue;
      }
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
      var hasText = false;
      for (var c = e.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3 && /\S/.test(c.nodeValue)) { hasText = true; break; } }
      if (!hasText) continue;
      if (r.left < left) left = r.left;
      if (r.right > right) right = r.right;
    }
    if (right > left) out.span = right - left;
    out.appLike = big > 0;
    return out;
  }

  function computeAuto() {
    if (MODE === 'noauto' || !doc.body) return 1;
    var prev = de.style.zoom; de.style.removeProperty('zoom');
    var m;
    try { m = measure(); } catch (e) { m = null; }
    if (!m || m.appLike || m.over) { if (prev) de.style.zoom = prev; return 1; }
    var phone = m.vw <= 560;
    var wantFont = phone ? 18 : (m.vw <= 1000 ? 19 : 20);                    // mărimea de bază dorită a textului, în px CSS
    var zFont = wantFont / Math.max(10, m.font);
    var zFill = m.span > 0 && m.span < 0.9 * m.vw ? (0.96 * m.vw) / m.span : 1;   // conținut îngust, centrat: îl lărgim la ecran
    var z = Math.max(zFont, zFill);
    z = Math.min(z, 26 / Math.max(10, m.font), 2.2);                            // text de bază cel mult ~26 px
    if (!(z > 1.04)) { if (prev) de.style.zoom = prev; return 1; }
    // autoverificare: aplicăm, măsurăm, reducem dacă apare derulare nouă
    for (var k = 0; k < 4; k++) {
      de.style.zoom = String(round2(z));
      var bad = de.scrollWidth > de.clientWidth + 2 || (!m.scrolls && de.scrollHeight > de.clientHeight + 2);
      if (!bad) { if (prev) de.style.zoom = prev; else de.style.removeProperty('zoom'); return round2(z); }
      z = 1 + (z - 1) / 2;
      if (z < 1.04) break;
    }
    if (prev) de.style.zoom = prev; else de.style.removeProperty('zoom');
    return 1;
  }

  function refit() {
    if (!root || root.hidden) return;
    auto = computeAuto();
    applyZoom(auto * user);
    place();
  }
  function setUser(u, persist) { user = clamp(auto * u) / auto; if (persist !== false) save(); applyZoom(auto * user); place(); wake(); }
  function zoomIn() { setUser(round2(user * STEP)); }
  function zoomOut() { setUser(round2(user / STEP)); }
  function reset() { setUser(1); }

  /* ---------- bara de zoom (pe margine) ---------- */
  var TOUCHY = 'a[href],button,input,select,textarea,summary,label,[role=button],[role=link],[role=tab],[role=menuitem],[onclick],[tabindex]:not([tabindex="-1"])';
  function busy(x, y) {
    var n = 0, vw = innerWidth, vh = innerHeight;
    var pts = [[x, y], [x - 22, y], [x + 22, y], [x, y - 22], [x, y + 22], [x - 22, y - 22], [x + 22, y + 22], [x + 22, y - 22], [x - 22, y + 22]];
    for (var i = 0; i < pts.length; i++) {
      var px = Math.min(Math.max(pts[i][0], 1), vw - 2), py = Math.min(Math.max(pts[i][1], 1), vh - 2);
      var e = doc.elementFromPoint(px, py);
      if (!e || root.contains(e) || e === doc.body || e === de || !e.closest) continue;
      if (e.closest(TOUCHY)) { n += 2; continue; }
      if (e.childElementCount === 0 && e.textContent && e.textContent.trim().length > 1 && !/^(CANVAS|SVG|IMG|VIDEO)$/i.test(e.tagName)) { n += 1; continue; }   // text de citit
      for (var a = e; a && a !== doc.body && a !== de; a = a.parentElement) {   // panouri fixe (meniuri, hărți, player) nu se acoperă
        var cs = getComputedStyle(a);
        if (cs.position === 'fixed' || cs.position === 'sticky') {
          var r = a.getBoundingClientRect();
          if (r.width * r.height < vw * vh * 0.6) n += 1;
          break;
        }
      }
    }
    return n;
  }
  /* coloană verticală pe marginea laterală (dreapta / stânga), la înălțimea cu cea mai puțină aglomerare */
  function place() {
    if (!root) return;
    var prev = root.style.visibility; root.style.visibility = 'hidden';
    var w = innerWidth, h = innerHeight, H = 144, best = null, score = 1e9;
    var fr = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];
    var minY = 76 + H / 2, maxY = h - 12 - H / 2;                                // sub butonul ✕, deasupra marginii de jos
    ['r', 'l'].forEach(function (c) {
      var cx = c === 'r' ? w - 30 : 30;
      fr.forEach(function (f, k) {
        var cy = Math.min(Math.max(h * f, minY), maxY), sc = 0;
        for (var d = -H / 2 + 22; d <= H / 2 - 22; d += 50) sc += busy(cx, cy + d);
        sc = sc * 10 + k + (c === side ? 0 : 0.5);
        if (sc < score) { score = sc; best = {c: c, y: cy}; }
      });
    });
    root.style.visibility = prev;
    side = best ? best.c : 'r';
    root.className = root.className.replace(/\bfff-view-(r|l|c)\b/g, '').replace(/\s+/g, ' ').trim() + ' fff-view-' + side;
    root.style.top = Math.round(best ? best.y - H / 2 : 80) + 'px';
  }
  function icon(kind) {
    var NS = 'http://www.w3.org/2000/svg', s = doc.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '22'); s.setAttribute('height', '22'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    function p(d) { var e = doc.createElementNS(NS, 'path'); e.setAttribute('d', d); e.setAttribute('fill', 'none'); e.setAttribute('stroke', 'currentColor'); e.setAttribute('stroke-width', '2'); e.setAttribute('stroke-linecap', 'round'); e.setAttribute('stroke-linejoin', 'round'); s.appendChild(e); }
    var c = doc.createElementNS(NS, 'circle'); c.setAttribute('cx', '10.5'); c.setAttribute('cy', '10.5'); c.setAttribute('r', '6.5'); c.setAttribute('fill', 'none'); c.setAttribute('stroke', 'currentColor'); c.setAttribute('stroke-width', '2');
    if (kind === 'fit') {                                                      // săgeți spre colțuri: „încadrează”
      p('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5');
    } else {
      s.appendChild(c); p('M15.5 15.5L21 21'); p(kind === 'in' ? 'M7.5 10.5h6M10.5 7.5v6' : 'M7.5 10.5h6');
    }
    return s;
  }
  function button(kind, fn) {
    var b = doc.createElement('button'); b.type = 'button'; b.className = 'fff-view-btn'; b.appendChild(icon(kind));
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    return b;
  }
  function build() {
    if (root) return;
    root = doc.createElement('div'); root.className = 'fff-view fff-view-r'; root.setAttribute('data-fff-view', ''); root.setAttribute('role', 'toolbar');
    bOut = button('out', zoomOut); bIn = button('in', zoomIn); bFit = button('fit', reset);
    live = doc.createElement('span'); live.className = 'fff-view-sr'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
    root.appendChild(bOut); root.appendChild(bIn); root.appendChild(bFit); root.appendChild(live);
    ['pointerdown', 'click', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, function (e) { e.stopPropagation(); }, {passive: true}); });
    bar = root; labels();
  }
  function labels() {
    if (!bar) return;
    root.setAttribute('aria-label', T('bar'));
    bOut.setAttribute('aria-label', T('out')); bOut.title = T('out');
    bIn.setAttribute('aria-label', T('in')); bIn.title = T('in');
    state();
  }
  function wake() {
    if (!root) return;
    root.classList.remove('fff-view-idle'); clearTimeout(idleT);
    idleT = setTimeout(function () { if (root) root.classList.add('fff-view-idle'); }, 4500);
  }

  function mount() {
    if (root && root.isConnected) return true;
    if (!doc.body) return false;
    build(); doc.body.appendChild(root); root.hidden = false;
    load();
    auto = computeAuto();
    applyZoom(auto * user);
    place(); wake();
    return true;
  }

  /* ---------- antete fixe ---------- */
  function opaque(c) { return !!c && c !== 'transparent' && !/^rgba\((?:[^,)]+,){3}\s*0(?:\.0+)?\s*\)$/.test(c) && !/^rgb\([^)]*\/\s*0(?:\.0+)?%?\s*\)$/.test(c); }
  function bgOf(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      var c = getComputedStyle(e).backgroundColor;
      if (opaque(c)) return c;
    }
    return '';
  }
  function stickyPass() {
    var tables = doc.querySelectorAll('table:not([role=presentation]):not([role=none])');
    var vh = innerHeight || de.clientHeight;
    for (var t = 0; t < tables.length && t < 150; t++) {
      var tb = tables[t];
      if (tb.getAttribute('data-fff-sticky') === 'x') continue;
      var thead = tb.tHead;
      if (!thead || !thead.rows.length) continue;
      var rows = thead.rows, top = 0;
      for (var r = 0; r < rows.length; r++) {                                 // antete pe mai multe rânduri: fiecare sub precedentul
        var cells = rows[r].cells;
        for (var c = 0; c < cells.length; c++) {
          var cell = cells[c];
          if (cell.getAttribute('data-fff-bg')) { cell.style.backgroundColor = ''; cell.removeAttribute('data-fff-bg'); }   // reevaluat: tema se poate schimba
          var cs = getComputedStyle(cell);
          if (cs.position !== 'sticky') continue;                              // aplicația și-a ales altă poziționare
          if (r > 0 && !cell.getAttribute('data-fff-top')) { cell.style.top = top + 'px'; cell.setAttribute('data-fff-top', '1'); }
          if (!opaque(cs.backgroundColor)) { var bg = bgOf(cell.parentElement) || bgOf(tb) || '#fff'; cell.style.backgroundColor = bg; cell.setAttribute('data-fff-bg', '1'); }
        }
        top += rows[r].getBoundingClientRect().height;
      }
      // containere care taie sau derulează orizontal fără să deruleze vertical: antetul nu s-ar mai lipi de pagină
      if (tb.getBoundingClientRect().height < vh * 0.8) continue;
      for (var a = tb.parentElement; a && a !== doc.body && a !== de; a = a.parentElement) {
        var ac = getComputedStyle(a);
        if (ac.overflowX === 'visible' && ac.overflowY === 'visible') continue;
        if (ac.position === 'fixed') break;
        var scrollsY = (ac.overflowY === 'auto' || ac.overflowY === 'scroll') && a.scrollHeight > a.clientHeight + 2 && a.clientHeight > 0;
        if (!scrollsY && !a.getAttribute('data-fff-vh')) {
          a.style.overflowY = 'auto';
          a.style.maxHeight = '85vh';
          a.setAttribute('data-fff-vh', '1');
          if (!a.hasAttribute('tabindex')) a.setAttribute('tabindex', '0'); // regiune derulabilă accesibilă de la tastatură
        }
        break;
      }
    }
  }
  function scheduleSticky() { if (OFF) return; clearTimeout(stickyT); stickyT = setTimeout(function () { try { stickyPass(); } catch (e) { /* ignorat */ } }, 350); }

  /* ---------- API și pornire ---------- */
  var api = {
    zoomIn: function () { if (root) zoomIn(); },
    zoomOut: function () { if (root) zoomOut(); },
    reset: function () { if (root) reset(); },
    set: function (u) { if (root) setUser(+u || 1); },
    get: function () { return {user: user, auto: auto, total: total}; },
    refit: refit,
    show: function () { wanted = true; if (eligible() && mount()) { root.hidden = false; refit(); } },
    hide: function () { wanted = false; if (root) { root.hidden = true; de.style.removeProperty('zoom'); de.style.removeProperty('--fff-zinv'); total = 1; } },
    mount: function (opt) { if (opt && opt.force) forced = true; wanted = true; if (!eligible()) return false; var ok = mount(); if (ok) { root.hidden = false; refit(); } return ok; },
    sticky: stickyPass,
    element: function () { return root; }
  };
  F.view = api;

  function init() {
    MODE = (meta('fff-view') || '').toLowerCase();
    if (MODE === 'off' || /[?&]noview=(1|true)\b/.test(location.search)) { OFF = true; de.setAttribute('data-fff-viewoff', ''); api.hide(); return; }
    scheduleSticky();
    if (doc.body && typeof MutationObserver === 'function') {
      try { mo = new MutationObserver(function (list) { for (var i = 0; i < list.length; i++) { var n = list[i].addedNodes; for (var j = 0; j < n.length; j++) { if (n[j].nodeType === 1 && (n[j].tagName === 'TABLE' || (n[j].querySelector && n[j].querySelector('table')))) { scheduleSticky(); return; } } } }); mo.observe(doc.body, {childList: true, subtree: true}); } catch (e) { /* ignorat */ }
    }
    try {
      var tm = new MutationObserver(function () { try { stickyPass(); } catch (e) { /* ignorat */ } scheduleSticky(); setTimeout(scheduleSticky, 900); });                               // schimbarea temei (clasă / atribut pe html sau body)
      tm.observe(de, {attributes: true, attributeFilter: ['class', 'data-theme', 'data-tema', 'data-mode', 'style']});
      if (doc.body) tm.observe(doc.body, {attributes: true, attributeFilter: ['class', 'data-theme', 'data-tema', 'data-mode']});
      doc.addEventListener('transitionend', function (e) { if (/background|color/.test(e.propertyName || '')) { clearTimeout(trT); trT = setTimeout(function () { try { stickyPass(); } catch (x) { /* ignorat */ } }, 60); } }, true);   // tranziții de temă: culoarea finală
      if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', scheduleSticky); }
    } catch (e) { /* ignorat */ }
    if (MODE === 'sticky') return;
    if (eligible()) mount();
  }
  F.onLang && F.onLang(labels);
  function later() { if (OFF) return; clearTimeout(laterT); laterT = setTimeout(function () { if (root) refit(); }, 300); }
  ['resize', 'orientationchange'].forEach(function (ev) { window.addEventListener(ev, later, {passive: true}); });
  window.addEventListener('resize', scheduleSticky, {passive: true});
  ['pointerdown', 'touchstart', 'scroll'].forEach(function (ev) { doc.addEventListener(ev, wake, {passive: true, capture: true}); });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', function () { scheduleSticky(); setTimeout(function () { if (root && !root.hidden) refit(); }, 700); });
  setTimeout(function () { if (root && !root.hidden) refit(); }, 2500);
})();
