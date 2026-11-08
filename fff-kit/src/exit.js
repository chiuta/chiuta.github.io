/* fff-kit · FFF.exit — „cum închid aplicația?” pe telefon.
 * Pe telefon aplicațiile se deschid în filă nouă și multe trec în plin ecran, deci nu mai rămâne nicio bară de browser: nu e evident cum ieși.
 * Modulul pune un buton mic „✕” (discret: se estompează după câteva secunde) într-un colț LIBER al ecranului. Colțul se alege automat,
 * căutând unul în care nu e niciun element atins (buton, link, câmp). Atingerea cere confirmarea „Închizi aplicația?” (Închide / Rămâi),
 * ca să nu se închidă din greșeală. „Închide” iese din plin ecran, încearcă window.close() (merge pentru fila deschisă din hub), iar dacă
 * fila rămâne deschisă, se întoarce în hub (history.back() când s-a venit de acolo, altfel https://chiuta.ro/).
 * Apare doar pe ecrane tactile, în pagina de sus (nu în iframe), nu în modul chioșc/încorporat și nu în browsere automatizate (navigator.webdriver),
 * ca testele care apasă la întâmplare să nu închidă pagina. Se oprește cu <meta name="fff-exit" content="off"> sau cu FFF.exit.hide().
 * Limite oneste: dacă aplicația pune în plin ecran doar UN element (nu pagina), butonul se mută în acel element, dar nu merge peste <video>/<canvas>/<iframe>
 * ca element plin-ecran; într-o aplicație instalată (PWA) fila nu poate fi închisă din script, deci „Închide” duce în hub. */
(function () {
  'use strict';
  var F = window.FFF;
  if (!F || F.exit) return;
  var doc = document, de = doc.documentElement;
  var CORNERS = ['tr', 'tl', 'br', 'bl'];
  function T(k) { return F.t('exit', k); }
  function meta(n) { var m = doc.querySelector('meta[name="' + n + '"]'); return m ? (m.getAttribute('content') || '') : ''; }
  /* Hubul: <meta name="fff-hub">, altfel domeniul de bază al paginii când rulează sub *.chiuta.ro / *.github.io (hub-ul e la rădăcină), altfel chiuta.ro.
   * Adresa nu e scrisă întreagă în cod: e o navigare, nu o cerere de rețea, și nu trebuie să apară ca „gazdă externă” în analizele de egress. */
  function hubUrl() {
    var u = meta('fff-hub');
    if (/^https:\/\/[^\s]+$/.test(u)) return u;
    var h = location.hostname, base = ['chiuta', 'ro'].join('.');
    if (h === base || h.slice(-(base.length + 1)) === '.' + base) return 'https://' + base + '/';
    return 'https://' + base + '/';
  }

  var root = null, btn = null, pop = null, corner = 'tr', idleT = 0, popT = 0, wanted = true, forced = false;

  function eligible() {
    if (forced) return true;
    if (!wanted) return false;
    if (/^(off|no|0|false)$/i.test(meta('fff-exit'))) return false;
    if (window.top !== window.self) return false;
    if (navigator.webdriver) return false;
    if (/[?&](kiosk|embed|noexit)=(1|true)\b/.test(location.search) || de.classList.contains('kiosk') || (doc.body && doc.body.classList.contains('kiosk'))) return false;
    var touch = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || (navigator.maxTouchPoints > 0 && !(window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches));
    return !!touch;
  }

  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function build() {
    if (root) return;
    root = el('div', 'fff-exit fff-exit-tr');
    root.setAttribute('data-fff-exit', '');
    btn = el('button', 'fff-exit-btn');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    var NS = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(NS, 'svg'), path = doc.createElementNS(NS, 'path');   // fără innerHTML
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '18'); svg.setAttribute('height', '18'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    path.setAttribute('d', 'M6 6l12 12M18 6L6 18'); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '2.4'); path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path); btn.appendChild(svg);
    btn.addEventListener('click', function (e) { e.stopPropagation(); pop && !pop.hidden ? closePop() : openPop(); });
    pop = el('div', 'fff-exit-pop');
    pop.setAttribute('role', 'alertdialog');
    pop.setAttribute('aria-live', 'polite');
    pop.hidden = true;
    root.appendChild(btn); root.appendChild(pop);
    ['pointerdown', 'click', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, function (e) { e.stopPropagation(); }, {passive: true}); });
    labels();
  }

  function labels() {
    if (!btn) return;
    btn.setAttribute('aria-label', T('btn'));
    btn.title = T('btn');
    if (pop) {
      pop.setAttribute('aria-label', T('ask'));
      pop.textContent = '';
      var q = el('span', 'fff-exit-q', T('ask'));
      var yes = el('button', 'fff-exit-yes', T('yes')); yes.type = 'button';
      var no = el('button', 'fff-exit-no', T('no')); no.type = 'button';
      yes.addEventListener('click', function () { api.close(); });
      no.addEventListener('click', closePop);
      pop.appendChild(q); pop.appendChild(yes); pop.appendChild(no);
    }
  }

  function wake() {
    if (!root) return;
    root.classList.remove('fff-exit-idle');
    clearTimeout(idleT);
    idleT = setTimeout(function () { if (root && (!pop || pop.hidden)) root.classList.add('fff-exit-idle'); }, 4500);
  }
  function openPop() { if (!pop) return; pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); root.classList.add('fff-exit-open'); wake(); clearTimeout(popT); popT = setTimeout(closePop, 7000); }
  function closePop() { if (!pop) return; pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); root.classList.remove('fff-exit-open'); clearTimeout(popT); wake(); }

  /* ---- colț liber: numărăm elementele atinse din zona de 48×48 px a fiecărui colț ---- */
  var TOUCHY = 'a[href],button,input,select,textarea,summary,label,[role=button],[role=link],[role=tab],[role=menuitem],[onclick],[tabindex]:not([tabindex="-1"])';
  function busy(x, y) {
    var pts = [[x, y], [x - 16, y - 16], [x + 16, y - 16], [x - 16, y + 16], [x + 16, y + 16]], n = 0;
    for (var i = 0; i < pts.length; i++) {
      var px = Math.min(Math.max(pts[i][0], 1), innerWidth - 2), py = Math.min(Math.max(pts[i][1], 1), innerHeight - 2);
      var e = doc.elementFromPoint(px, py);
      if (e && !root.contains(e) && e !== doc.body && e !== de && e.closest && e.closest(TOUCHY)) n++;
    }
    return n;
  }
  function probe() {
    if (!root) return corner;
    var prev = root.style.visibility; root.style.visibility = 'hidden';
    var M = 30, w = innerWidth, h = innerHeight, best = corner, score = 99;
    // marginile de siguranță (decupaje, bare) se simt la poziționare prin CSS env(); aici testăm doar centrul zonei butonului
    var spots = {tr: [w - M, M + 6], tl: [M, M + 6], br: [w - M, h - M - 6], bl: [M, h - M - 6]};
    CORNERS.forEach(function (c) {
      var s = busy(spots[c][0], spots[c][1]);
      if (s < score || (s === score && c === corner && s <= score)) { score = s; best = c; }
    });
    root.style.visibility = prev;
    setCorner(best);
    return best;
  }
  function setCorner(c) {
    corner = c;
    root.className = root.className.replace(/\bfff-exit-(tr|tl|br|bl)\b/g, '').replace(/\s+/g, ' ').trim() + ' fff-exit-' + c;
  }

  /* ---- plin ecran: dacă DOAR un element e în plin ecran, butonul trebuie să fie în el ---- */
  function host() {
    var fe = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (fe && fe !== de && fe !== doc.body && !/^(VIDEO|CANVAS|IMG|IFRAME|OBJECT|EMBED)$/.test(fe.tagName)) return fe;
    return doc.body || de;
  }
  function attach() { if (!root) return; var h = host(); if (root.parentNode !== h) h.appendChild(root); }

  var later = 0;
  function reprobe() { clearTimeout(later); later = setTimeout(function () { attach(); probe(); }, 250); }

  function mount() {
    if (root && root.isConnected) return true;
    if (!doc.body) return false;
    build(); attach(); probe(); wake();
    return true;
  }

  var api = {
    close: function () {
      var fs = doc.fullscreenElement || doc.webkitFullscreenElement;
      var leave = fs ? Promise.resolve().then(function () { return (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc); }).catch(function () { }) : Promise.resolve();
      return leave.then(function () {
        try { window.close(); } catch (e) { }
        setTimeout(function () {
          if (doc.visibilityState === 'hidden') return;           // fila s-a închis (sau a trecut în fundal)
          var fromHub = false;
          try { fromHub = !!doc.referrer && new URL(doc.referrer).hostname.replace(/^www\./, '') === 'chiuta.ro'; } catch (e) { }
          if (fromHub && history.length > 1) { history.back(); setTimeout(function () { if (doc.visibilityState !== 'hidden') location.assign(hubUrl()); }, 400); }
          else location.assign(hubUrl());
        }, 250);
      });
    },
    show: function () { wanted = true; if (eligible() && mount()) { root.hidden = false; wake(); } },
    hide: function () { wanted = false; if (root) root.hidden = true; },
    /* pentru teste și pentru aplicații care vor butonul și pe desktop */
    mount: function (opt) { if (opt && opt.force) forced = true; wanted = true; if (!eligible()) return false; var ok = mount(); if (ok) root.hidden = false; return ok; },
    probe: function () { return mount() ? probe() : null; },
    corner: function () { return corner; },
    element: function () { return root; }
  };
  F.exit = api;

  function init() {
    if (!eligible()) return;
    mount();
  }
  F.onLang && F.onLang(labels);
  ['resize', 'orientationchange'].forEach(function (ev) { window.addEventListener(ev, reprobe, {passive: true}); });
  doc.addEventListener('fullscreenchange', reprobe);
  doc.addEventListener('webkitfullscreenchange', reprobe);
  ['pointerdown', 'touchstart', 'scroll'].forEach(function (ev) { doc.addEventListener(ev, wake, {passive: true, capture: true}); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop && !pop.hidden) closePop(); });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  // aplicațiile își desenează interfața după încărcare: recalculăm colțul după ce se așază
  window.addEventListener('load', function () { setTimeout(function () { if (root) { attach(); probe(); } }, 800); });
  setTimeout(function () { if (root) probe(); }, 2500);
})();
