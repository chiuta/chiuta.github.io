/* fff-kit · FFF.share — bară verticală de distribuire pe rețele sociale, pe marginea din STÂNGA, centrată pe verticală.
 * Fără scripturi sau pixeli de la rețele: fiecare buton e un simplu link către adresa oficială de „share”, deschis doar la clic (target=_blank, rel=noopener noreferrer);
 * pe telefon apare și „Distribuie…” din sistem (navigator.share). Nu trimite nimic înainte de clic și nu reține nimic în afară de starea strânsă/desfăcută (fff.<slug>.share).
 * Distribuie adresa canonică a aplicației (<link rel=canonical> / og:url, altfel adresa paginii, altfel https://chiuta.ro/) și titlul paginii.
 * Elementul stă sub <html> (ca FFF.a11y) și compensează zoom-ul paginii (FFF.view) prin --fff-zinv. Nu apare în iframe, în modul chioșc/încorporat (?kiosk=1, ?embed=1, ?noshare=1),
 * la tipărire și în browsere automatizate (navigator.webdriver; se forțează cu ?fffshare=1). Se oprește cu <meta name="fff-share" content="off">.
 * API: FFF.share.{show, hide, toggle, collapse, expand, url, element}. */
(function () {
  'use strict';
  var F = window.FFF;
  if (!F || F.share) return;
  var doc = document, de = doc.documentElement;
  var root = null, list = null, tog = null, live = null, idleT = 0, copyT = 0, OFF = false, wanted = true, forced = false, collapsed = false, moZ = null;
  function T(k) { return F.t('share', k); }
  function meta(n) { var m = doc.querySelector('meta[name="' + n + '"]'); return m ? (m.getAttribute('content') || '') : ''; }
  function RAW() { return F.store && F.store.raw ? F.store.raw : null; }
  function KEY() { return ((F.store && F.store.prefix) || ('fff.' + (F.slug || 'app') + '.')) + 'share'; }

  function eligible() {
    if (OFF) return false;
    if (forced) return true;
    if (!wanted) return false;
    if (window.top !== window.self) return false;
    if (navigator.webdriver && !/[?&]fffshare=1\b/.test(location.search)) return false;
    if (/[?&](kiosk|embed|noshare)=(1|true)\b/.test(location.search) || de.classList.contains('kiosk') || (doc.body && doc.body.classList.contains('kiosk'))) return false;
    return true;
  }
  function pageUrl() {
    var c = doc.querySelector('link[rel="canonical"]'), u = c && c.getAttribute('href') || meta('og:url') || (doc.querySelector('meta[property="og:url"]') || {getAttribute: function () { return ''; }}).getAttribute('content');
    try { if (u) return new URL(u, location.href).href; } catch (e) { /* ignorat */ }
    if (/^https?:$/.test(location.protocol)) return location.href.split('#')[0];
    return 'https://chiuta.ro/';
  }
  function pageTitle() { return (doc.title || '').trim() || 'chiuta.ro'; }
  function enc(x) { return encodeURIComponent(x); }
  var NETS = [
    {id: 'wa', label: 'WA', href: function (u, t) { return 'https://wa.me/?text=' + enc(t + ' ' + u); }},
    {id: 'tg', icon: 'M21.5 3.2 2.6 10.6c-.9.4-.9 1.1-.2 1.3l4.8 1.5 1.8 5.6c.2.6.4.8.8.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.2-.4-1.7-1.2-1.4zM8.3 13.1l9.5-6c.4-.3.9-.1.5.2l-7.9 7.1-.3 3.3z', href: function (u, t) { return 'https://t.me/share/url?url=' + enc(u) + '&text=' + enc(t); }},
    {id: 'fb', label: 'f', href: function (u) { return 'https://www.facebook.com/sharer/sharer.php?u=' + enc(u); }},
    {id: 'x', label: 'X', href: function (u, t) { return 'https://x.com/intent/post?url=' + enc(u) + '&text=' + enc(t); }},
    {id: 'in', label: 'in', href: function (u) { return 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(u); }},
    {id: 'mail', icon: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1.6 2 7.4 5.6L19.4 7zM4 9.1V17h16V9.1l-8 6.1z', href: function (u, t) { return 'mailto:?subject=' + enc(t) + '&body=' + enc(t + '\n' + u); }}
  ];
  function svg(d, extra) {
    var s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '20'); s.setAttribute('height', '20'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    var p = doc.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); p.setAttribute('fill', extra === 'stroke' ? 'none' : 'currentColor'); if (extra === 'stroke') { p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); }
    s.appendChild(p); return s;
  }
  function netName(id) { return T('n_' + id); }
  function mkItem(tag, cls) { var e = doc.createElement(tag); e.className = 'fff-share-btn' + (cls ? ' ' + cls : ''); return e; }
  function say(msg) { if (live) { live.textContent = ''; setTimeout(function () { if (live) live.textContent = msg; }, 30); } }

  function build() {
    root = doc.createElement('div'); root.className = 'fff-share'; root.setAttribute('data-fff-share', ''); root.setAttribute('role', 'toolbar'); root.hidden = true;
    live = doc.createElement('span'); live.className = 'fff-share-sr'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
    tog = mkItem('button', 'fff-share-tog'); tog.type = 'button'; tog.addEventListener('click', function () { api.toggle(); });
    list = doc.createElement('div'); list.className = 'fff-share-list';
    root.appendChild(tog); root.appendChild(list); root.appendChild(live);
    ['pointerdown', 'click', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, function (e) { e.stopPropagation(); }, {passive: true}); });
    fill();
  }
  function fill() {
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    var u = pageUrl(), t = pageTitle();
    if (typeof navigator.share === 'function') {
      var n = mkItem('button', 'fff-share-native'); n.type = 'button'; n.setAttribute('data-net', 'native'); n.appendChild(svg('M18 8a3 3 0 1 0-2.8-4M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4', 'stroke'));
      n.addEventListener('click', function () { try { navigator.share({title: pageTitle(), text: pageTitle(), url: pageUrl()}).catch(function () { /* anulat */ }); } catch (e) { /* ignorat */ } });
      list.appendChild(n);
    }
    NETS.forEach(function (net) {
      var a = mkItem('a'); a.setAttribute('data-net', net.id); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.href = net.href(u, t);
      if (net.icon) a.appendChild(svg(net.icon)); else { var sp = doc.createElement('span'); sp.className = 'fff-share-txt'; sp.textContent = net.label; a.appendChild(sp); }
      list.appendChild(a);
    });
    var c = mkItem('button'); c.type = 'button'; c.setAttribute('data-net', 'copy'); c.appendChild(svg('M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1', 'stroke'));
    c.addEventListener('click', function () { copy(c); });
    list.appendChild(c);
    labels();
  }
  function copy(btn) {
    var u = pageUrl(), done = function (ok) { say(ok ? T('copied') : T('copyfail')); btn.classList.add(ok ? 'fff-share-ok' : 'fff-share-no'); clearTimeout(copyT); copyT = setTimeout(function () { btn.classList.remove('fff-share-ok', 'fff-share-no'); }, 1600); };
    var fallback = function () { try { var ta = doc.createElement('textarea'); ta.value = u; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; doc.body.appendChild(ta); ta.select(); var ok = doc.execCommand && doc.execCommand('copy'); doc.body.removeChild(ta); done(!!ok); } catch (e) { done(false); } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(function () { done(true); }, fallback); else fallback(); } catch (e) { fallback(); }
  }
  function labels() {
    if (!root) return;
    root.setAttribute('aria-label', T('bar'));
    var items = list.querySelectorAll('[data-net]');
    for (var i = 0; i < items.length; i++) {
      var id = items[i].getAttribute('data-net'), nm = id === 'native' ? T('native') : id === 'copy' ? T('copy') : id === 'mail' ? T('n_mail') : T('share').replace('{n}', netName(id));
      if (id === 'mail') nm = T('share').replace('{n}', T('n_mail'));
      items[i].setAttribute('aria-label', nm); items[i].title = nm;
    }
    if (tog) { tog.setAttribute('aria-expanded', collapsed ? 'false' : 'true'); tog.setAttribute('aria-label', collapsed ? T('open') : T('close')); tog.title = collapsed ? T('open') : T('close'); }
  }
  function paintTog() {
    if (!tog) return; while (tog.firstChild) tog.removeChild(tog.firstChild);
    tog.appendChild(collapsed ? svg('M18 8a3 3 0 1 0-2.8-4M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4', 'stroke') : svg('M15 6l-6 6 6 6', 'stroke'));
    root.classList.toggle('fff-share-closed', collapsed); labels();
  }
  function load() { try { var R = RAW(), v = R ? R.get(KEY()) : null; if (v === '1') collapsed = true; else if (v === '0') collapsed = false; else collapsed = (innerHeight || 800) < 520; } catch (e) { /* ignorat */ } }
  function save() { try { var R = RAW(); if (R) R.set(KEY(), collapsed ? '1' : '0'); } catch (e) { /* ignorat */ } }
  function zoomFix() { if (!root) return; var z = parseFloat(de.style.zoom); root.style.zoom = (z && Math.abs(z - 1) > 0.005) ? String(Math.round(1e4 / z) / 1e4) : ''; }
  function wake() { if (!root) return; root.classList.remove('fff-share-idle'); clearTimeout(idleT); idleT = setTimeout(function () { if (root) root.classList.add('fff-share-idle'); }, 5000); }
  function mount() {
    if (!root) { build(); load(); }
    if (!root.isConnected) de.appendChild(root);
    paintTog(); zoomFix(); root.hidden = false; wake();
    if (!moZ && typeof MutationObserver === 'function') { try { moZ = new MutationObserver(zoomFix); moZ.observe(de, {attributes: true, attributeFilter: ['style']}); } catch (e) { /* ignorat */ } }
    return true;
  }
  var api = {
    show: function () { wanted = true; if (eligible()) mount(); },
    hide: function () { wanted = false; if (root) root.hidden = true; },
    toggle: function () { collapsed = !collapsed; save(); paintTog(); wake(); },
    collapse: function () { collapsed = true; save(); paintTog(); },
    expand: function () { collapsed = false; save(); paintTog(); },
    url: pageUrl,
    element: function () { return root; }
  };
  F.share = api;
  function init() {
    if (meta('fff-share').toLowerCase() === 'off' || /[?&]noshare=(1|true)\b/.test(location.search)) { OFF = true; return; }
    if (eligible()) mount();
  }
  F.onLang && F.onLang(function () { if (root) { fill(); paintTog(); } });
  ['pointerdown', 'touchstart', 'scroll', 'mousemove'].forEach(function (ev) { doc.addEventListener(ev, wake, {passive: true, capture: true}); });
  window.addEventListener('load', function () { if (root && !root.hidden) { fill(); paintTog(); } });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
