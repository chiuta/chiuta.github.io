/* fff-kit · FFF.a11y — accesibilitate la fel în toate aplicațiile (modelul vine din BRAZDA):
 * (1) buton „Aa” (jos, în dreapta) care deschide panoul „Opțiuni de accesibilitate”: mărimea textului (A− / A+), contrast ridicat, fără animații, text lizibil
 *     (spațiere mărită), linkuri subliniate + focus accentuat, citire cu voce (textul selectat sau cel vizibil pe ecran), resetare, închidere;
 * (2) săgeată „Înapoi sus” (apare după derulare; găsește singură zona derulabilă: pagina sau un panou mare al aplicației);
 * (3) legătura „Sari la conținut” (doar dacă pagina are <main>/[role=main]/<h1> și nu are deja una).
 * Fereastra se potrivește mereu ecranului: lățimea, înălțimea și poziția panoului se recalculează din fereastra vizibilă (visualViewport) la fiecare schimbare
 * (rotire, tastatură, redimensionare), panoul se derulează în el însuși, iar zoom-ul paginii (FFF.view) e compensat, deci panoul nu se mărește peste ecran.
 * Butoanele își caută un loc liber pe marginea din dreapta (bara de zoom cu lupă / „potrivire ecran” a lui FFF.view stă pe marginea din stânga).
 * Mărimea textului: proprietatea CSS `zoom` pe <body> (merge la fel și în aplicațiile cu dimensiuni în px); dacă browserul nu o știe, se scalează fontul elementului <html>.
 * O aplicație cu text în rem își poate scala singură textul: <meta name="fff-a11y" content="textvar"> + html{font-size:calc(16px*var(--fff-fs,1))} (kitul doar pune --fff-fs).
 * Setările se rețin în stocarea locală (fff.<slug>.a11y); la prima vizită se respectă „mișcare redusă” și „contrast mai mare” din sistem.
 * Nu apare în iframe, în modul chioșc/încorporat (?kiosk=1, ?embed=1, ?noa11y=1) și în browsere automatizate (navigator.webdriver; se forțează cu ?fffa11y=1),
 * ca testele să vadă pagina neschimbată. Se oprește cu <meta name="fff-a11y" content="off"> sau FFF.a11y.hide().
 * API: FFF.a11y.{open, close, toggle, get, set, reset, speak, stop, up, refit, mount, show, hide, element}. Evenimentul „a11y” pe FFF.bus. */
(function () {
  'use strict';
  var F = window.FFF;
  if (!F || F.a11y) return;
  var doc = document, de = doc.documentElement;
  var KEYS = ['hc', 'rm', 'rf', 'ul'], MINF = 0.85, MAXF = 1.6, STEPF = 0.1, TOPAT = 320;
  var LOC = {ro: 'ro-RO', en: 'en-US', fr: 'fr-FR', it: 'it-IT', es: 'es-ES', pt: 'pt-PT', de: 'de-DE', hu: 'hu-HU'};
  function T(k, v) { return F.t('a11y', k, v); }
  function meta(n) { var m = doc.querySelector('meta[name="' + n + '"]'); return m ? (m.getAttribute('content') || '') : ''; }
  function RAW() { return F.store && F.store.raw ? F.store.raw : null; }
  function KEY() { return ((F.store && F.store.prefix) || ('fff.' + (F.slug || 'app') + '.')) + 'a11y'; }
  function fresh() { return {fs: 1, hc: 0, rm: 0, rf: 0, ul: 0}; }
  function r2(x) { return Math.round(x * 100) / 100; }

  var S = fresh(), saved = false, TXTVAR = false, OFF = false, forced = false, wanted = true, inited = false;
  var root = null, btnAa = null, btnUp = null, panel = null, ui = {}, msgT = 0, placeT = 0, fitT = 0, freeT = 0, target = null, mo = null, keepMo = null, keepT = 0, kept = [], gutter = false, scanned = false;

  /* ---------- eligibilitate ---------- */
  function eligible() {
    if (OFF) return false;
    if (forced) return true;
    if (!wanted) return false;
    if (window.top !== window.self) return false;
    if (navigator.webdriver && !/[?&]fffa11y=1\b/.test(location.search)) return false;
    if (/[?&](kiosk|embed|noa11y)=(1|true)\b/.test(location.search) || de.classList.contains('kiosk') || (doc.body && doc.body.classList.contains('kiosk'))) return false;
    return true;
  }

  /* ---------- stare ---------- */
  function load() {
    saved = false; S = fresh();
    try {
      var R = RAW(), raw = R ? R.get(KEY()) : null, j = raw ? JSON.parse(raw) : null;
      if (j && typeof j === 'object') {
        var f = +j.fs; if (f >= MINF - 0.001 && f <= MAXF + 0.001) S.fs = r2(f);
        KEYS.forEach(function (k) { S[k] = j[k] ? 1 : 0; });
        saved = true;
      }
    } catch (e) { /* ignorat */ }
    if (!saved) {
      try {
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) S.rm = 1;
        if (window.matchMedia && matchMedia('(prefers-contrast: more)').matches) S.hc = 1;
      } catch (e) { /* ignorat */ }
    }
  }
  function isDefault() { return S.fs === 1 && !S.hc && !S.rm && !S.rf && !S.ul; }
  function save() {
    try {
      var R = RAW(); if (!R) return;
      if (isDefault()) R.remove(KEY()); else R.set(KEY(), JSON.stringify(S));
    } catch (e) { /* ignorat */ }
  }
  function zoomOk() { try { return !!(window.CSS && CSS.supports && CSS.supports('zoom', '1.2')); } catch (e) { return false; } }

  /* ---------- efectele setărilor ---------- */
  function applyText() {
    var f = r2(S.fs), b = doc.body;
    de.classList.toggle('fff-fsz', f !== 1);
    if (f === 1) de.style.removeProperty('--fff-fs'); else de.style.setProperty('--fff-fs', String(f));
    if (b) b.style.removeProperty('zoom');
    de.style.removeProperty('font-size');
    if (f === 1 || TXTVAR) return;                                  // „textvar”: aplicația își scalează singură textul din --fff-fs (ex. html{font-size:calc(16px*var(--fff-fs,1))})
    if (zoomOk()) { if (b) b.style.zoom = String(f); }
    else de.style.setProperty('font-size', Math.round(f * 100) + '%');
  }
  function applyState(noEmit) {
    if (S.hc && !scanned) scanKeep();           // culorile originale se citesc înainte ca regulile forțate să intre în vigoare
    KEYS.forEach(function (k) { de.classList.toggle('fff-' + k, !!S[k]); });
    de.setAttribute('data-fff-a11y', KEYS.filter(function (k) { return S[k]; }).concat(S.fs !== 1 ? ['fs'] : []).join(' '));
    if (!de.getAttribute('data-fff-a11y')) de.removeAttribute('data-fff-a11y');
    applyText();
    if (S.hc) keepWatch(true); else keepWatch(false);
    sync();
    if (!noEmit) { try { F.bus && F.bus.emit && F.bus.emit('a11y', get()); } catch (e) { /* ignorat */ } }
    schedRefit();
  }
  function schedRefit() {
    clearTimeout(fitT);
    fitT = setTimeout(function () {
      try { if (F.view && F.view.refit && F.view.element && F.view.element()) F.view.refit(); } catch (e) { /* ignorat */ }
      place(); fit();
    }, 120);
  }
  function commit() { save(); applyState(); }

  /* contrast ridicat: casetele colorate mici (pătrate de tablă, ștampile, bare de progres) își păstrează culoarea; restul devine negru/alb.
     Culorile originale se citesc cu clasa oprită (altfel regulile forțate le-ar ascunde), în aceeași sarcină, deci fără clipire. */
  function rgb(s) { var m = s && s.match(/[\d.]+/g); return m && m.length >= 3 ? {r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1} : null; }
  function mark(e, c) {
    var p = e.style.getPropertyValue('color'), pr = e.style.getPropertyPriority('color');
    e.setAttribute('data-fff-keep', '1');
    if (c) e.style.setProperty('color', (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) > 150 ? '#000' : '#fff', 'important');
    kept.push({e: e, p: p, pr: pr, c: !!c});
  }
  function scanKeep() {
    if (!S.hc || !doc.body) return;
    var had = de.classList.contains('fff-hc'); de.classList.remove('fff-hc');
    try {
      var all = doc.body.querySelectorAll('*'), n = 0;
      for (var i = 0; i < all.length && n < 4000; i++, n++) {
        var e = all[i];
        if (e.hasAttribute('data-fff-keep') || /^(script|style|link|meta|template|noscript|svg|path|img|canvas|video|br|option|source)$/i.test(e.tagName) || (e.closest && e.closest('svg'))) continue;
        var cs = getComputedStyle(e), c = rgb(cs.backgroundColor), pic = cs.backgroundImage && cs.backgroundImage !== 'none';
        var colored = !!c && c.a > 0.5 && (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) > 45;
        if (!colored && !pic) continue;
        var txt = (e.textContent || '').replace(/\s+/g, '').length > 0;
        if (colored) {
          var r = e.getBoundingClientRect();
          if (!txt || (r.width > 0 && r.width <= 140 && r.height <= 140)) mark(e, c);
        } else if (!txt) mark(e, null);
      }
    } catch (x) { /* ignorat */ }
    if (had) de.classList.add('fff-hc');
    scanned = true;
  }
  function unkeep() {
    scanned = false;
    for (var i = 0; i < kept.length; i++) {
      var k = kept[i]; k.e.removeAttribute('data-fff-keep');
      if (k.c) { if (k.p) k.e.style.setProperty('color', k.p, k.pr); else k.e.style.removeProperty('color'); }
    }
    kept = [];
  }
  function keepWatch(on) {
    clearTimeout(keepT);
    if (!on) { if (keepMo) { keepMo.disconnect(); keepMo = null; } unkeep(); return; }
    if (!keepMo && doc.body && typeof MutationObserver === 'function') {
      try {
        keepMo = new MutationObserver(function (ms) {
          for (var i = 0; i < ms.length; i++) { if (ms[i].addedNodes && ms[i].addedNodes.length) { clearTimeout(keepT); keepT = setTimeout(scanKeep, 700); return; } }
        });
        keepMo.observe(doc.body, {childList: true, subtree: true});
      } catch (e) { /* ignorat */ }
    }
  }

  /* ---------- citire cu voce ---------- */
  var syn = null, queue = [], speaking = false;
  try { syn = window.speechSynthesis || null; } catch (e) { syn = null; }
  function lang4() { var l = F.lang ? F.lang() : (de.lang || 'en'); return LOC[l] || l; }
  var SKIP = 'script,style,noscript,svg,canvas,select,option,textarea,button,nav,footer,[role=navigation],[role=toolbar],[aria-hidden=true],[hidden],.fff-a11y,.fff-a11y-panel,.fff-a11y-skip,[data-fff-view],.fff-exit';
  function visibleText() {
    var sel = ''; try { sel = String(window.getSelection() || '').trim(); } catch (e) { /* ignorat */ }
    if (sel) return sel.slice(0, 8000);
    var host = doc.querySelector('main,[role=main]') || doc.body; if (!host) return '';
    var vw = innerWidth, vh = innerHeight, out = '', tw = doc.createTreeWalker(host, NodeFilter.SHOW_TEXT, null), nd, n = 0;
    while ((nd = tw.nextNode()) && out.length < 5000 && n < 6000) {
      n++;
      var t = nd.nodeValue; if (!t || !/\S/.test(t)) continue;
      var p = nd.parentElement; if (!p || (p.closest && p.closest(SKIP))) continue;
      var r = p.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
      var cs = getComputedStyle(p); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      out += t.replace(/\s+/g, ' ').trim() + ' ';
    }
    return out.trim();
  }
  function chunks(s) {
    s = s.replace(/\s+/g, ' ').trim();
    var out = [], re = /[^.!?;:…]+[.!?;:…]*\s*/g, m, cur = '';
    while ((m = re.exec(s))) {
      if (cur && (cur + m[0]).length > 200) { out.push(cur); cur = m[0]; } else cur += m[0];
    }
    if (cur) out.push(cur);
    var res = [];
    out.forEach(function (c) {
      while (c.length > 240) { var i = c.lastIndexOf(' ', 220); if (i < 60) i = 220; res.push(c.slice(0, i)); c = c.slice(i); }
      if (c.trim()) res.push(c);
    });
    return res;
  }
  function setSpeaking(v) { speaking = v; if (ui.tts2) ui.tts2.disabled = !v; }
  function stop() { queue = []; try { if (syn) syn.cancel(); } catch (e) { /* ignorat */ } setSpeaking(false); }
  function next() {
    if (!queue.length) { setSpeaking(false); return; }
    var u = new SpeechSynthesisUtterance(queue.shift());
    u.lang = lang4();
    u.onend = function () { if (speaking) next(); };
    u.onerror = function () { stop(); };
    try { syn.speak(u); } catch (e) { stop(); }
  }
  function speak() {
    if (!syn || typeof SpeechSynthesisUtterance === 'undefined') { msg(T('tt0')); return; }
    msg(''); stop();
    var txt = visibleText();
    if (!txt) { msg(T('ttn')); return; }
    queue = chunks(txt); setSpeaking(true); next();
  }
  window.addEventListener('pagehide', function () { try { if (syn) syn.cancel(); } catch (e) { /* ignorat */ } });

  /* ---------- interfața ---------- */
  function el(tag, cls, attrs) {
    var e = doc.createElement(tag); if (cls) e.className = cls;
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function btn(txt, id, key, pressed) {
    var b = el('button', '', {type: 'button'}); b.textContent = txt || ''; b.setAttribute('data-k', key || '');
    if (pressed) b.setAttribute('aria-pressed', 'false');
    ui[id] = b; return b;
  }
  function svgUp() {
    var NS = 'http://www.w3.org/2000/svg', s = doc.createElementNS(NS, 'svg'), p = doc.createElementNS(NS, 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '22'); s.setAttribute('height', '22'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    p.setAttribute('d', 'M12 19V6M6 12l6-6 6 6'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2.4'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p); return s;
  }
  function build() {
    if (root) return;
    root = el('div', 'fff-a11y', {'data-fff-a11y-ui': ''});
    btnUp = el('button', 'fff-a11y-btn fff-a11y-up', {type: 'button'}); btnUp.appendChild(svgUp()); btnUp.hidden = true;
    btnAa = el('button', 'fff-a11y-btn fff-a11y-aa', {type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'fff-a11y-panel'}); btnAa.textContent = 'Aa';
    root.appendChild(btnUp); root.appendChild(btnAa);

    panel = el('div', 'fff-a11y-panel', {id: 'fff-a11y-panel', role: 'dialog', 'aria-labelledby': 'fff-a11y-t'}); panel.hidden = true;
    ui.h = el('h2', '', {id: 'fff-a11y-t'});
    var row1 = el('div', 'fff-a11y-rw', {role: 'group', 'aria-labelledby': 'fff-a11y-sz'});
    ui.sz = el('span', 'fff-a11y-lb', {id: 'fff-a11y-sz'});
    ui.pc = el('span', 'fff-a11y-pc', {'aria-live': 'polite'});
    row1.appendChild(ui.sz); row1.appendChild(btn('A−', 'sm', 'sm')); row1.appendChild(ui.pc); row1.appendChild(btn('A+', 'lg', 'lg'));
    var row2 = el('div', 'fff-a11y-rw'); row2.appendChild(btn('', 'hc', 'hc', 1)); row2.appendChild(btn('', 'rm', 'rm', 1));
    var row3 = el('div', 'fff-a11y-rw'); row3.appendChild(btn('', 'rf', 'rf', 1)); row3.appendChild(btn('', 'ul', 'ul', 1));
    var row4 = el('div', 'fff-a11y-rw'); row4.appendChild(btn('', 'tts', 'tts')); row4.appendChild(btn('', 'tts2', 'tts2'));
    ui.msg = el('p', 'fff-a11y-msg', {'aria-live': 'polite'});
    var row5 = el('div', 'fff-a11y-rw'); row5.appendChild(btn('', 'rs', 'rs')); row5.appendChild(btn('', 'cl', 'cl'));
    [ui.h, row1, row2, row3, row4, ui.msg, row5].forEach(function (x) { panel.appendChild(x); });

    btnAa.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    btnUp.addEventListener('click', function (e) { e.stopPropagation(); toTop(); });
    panel.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target && e.target.closest ? e.target.closest('button[data-k]') : null; if (!b || b.disabled) return;
      var k = b.getAttribute('data-k');
      if (k === 'sm') { S.fs = Math.max(MINF, r2(S.fs - STEPF)); commit(); }
      else if (k === 'lg') { S.fs = Math.min(MAXF, r2(S.fs + STEPF)); commit(); }
      else if (KEYS.indexOf(k) >= 0) { S[k] = S[k] ? 0 : 1; commit(); }
      else if (k === 'tts') speak();
      else if (k === 'tts2') stop();
      else if (k === 'rs') { stop(); S = fresh(); saved = true; commit(); }
      else if (k === 'cl') close();
    });
    ['pointerdown', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, function (e) { e.stopPropagation(); }, {passive: true}); });
    labels();
  }
  function labels() {
    if (!root) return;
    btnAa.setAttribute('aria-label', T('btn')); btnAa.title = T('btn');
    btnUp.setAttribute('aria-label', T('up')); btnUp.title = T('up');
    ui.h.textContent = T('t'); ui.sz.textContent = T('sz');
    ui.sm.setAttribute('aria-label', 'A− ' + T('sm')); ui.sm.title = T('sm'); ui.lg.setAttribute('aria-label', 'A+ ' + T('lg')); ui.lg.title = T('lg');   // numele conține textul vizibil (WCAG 2.5.3)
    ['hc', 'rm', 'rf', 'ul', 'tts', 'tts2', 'rs', 'cl'].forEach(function (k) { ui[k].textContent = T(k); });
    ui.tts.title = T('tth');
    sync();
  }
  function sync() {
    if (!root) return;
    ui.pc.textContent = T('pc', {n: Math.round(S.fs * 100)});
    ui.sm.disabled = S.fs <= MINF + 0.001; ui.lg.disabled = S.fs >= MAXF - 0.001;
    KEYS.forEach(function (k) { ui[k].setAttribute('aria-pressed', S[k] ? 'true' : 'false'); });
    ui.tts2.disabled = !speaking;
  }
  function msg(t) { if (!ui.msg) return; ui.msg.textContent = t || ''; }

  /* ---------- deschidere / închidere ---------- */
  function open() {
    if (!root) return;
    panel.hidden = false; btnAa.setAttribute('aria-expanded', 'true');
    fit();
    try { ui.sm.focus({preventScroll: true}); } catch (e) { /* ignorat */ }
  }
  function close(noFocus) {
    if (!panel || panel.hidden) return;
    panel.hidden = true; btnAa.setAttribute('aria-expanded', 'false');
    if (!noFocus) { try { btnAa.focus({preventScroll: true}); } catch (e) { /* ignorat */ } }
  }
  function toggle() { if (panel && panel.hidden) open(); else close(); }
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel && !panel.hidden) { e.preventDefault(); close(); } });
  doc.addEventListener('click', function (e) { if (panel && !panel.hidden && !panel.contains(e.target) && !btnAa.contains(e.target)) close(true); });

  /* ---------- potrivirea la ecran ---------- */
  function viewport() { var v = window.visualViewport; return {w: Math.floor(v && v.width ? v.width : innerWidth), h: Math.floor(v && v.height ? v.height : innerHeight), x: v ? v.offsetLeft : 0, y: v ? v.offsetTop : 0}; }
  function fit() {
    if (!root || !panel || root.hidden) return;
    var vp = viewport(), pad = 8, w = Math.max(160, Math.min(360, vp.w - 2 * pad));
    var top = vp.y + pad, low = vp.y + vp.h - pad, rb = btnAa.getBoundingClientRect();
    var edge = Math.min(rb.height ? rb.top - 8 : low, low), room = edge - top;           // marginea de jos a panoului: deasupra lui „Aa”, în partea vizibilă a ecranului
    if (room < 220) { edge = low; room = low - top; }                                      // ecran foarte scund: panoul acoperă butoanele (are propriul „Închide”)
    panel.style.width = w + 'px';
    panel.style.maxWidth = w + 'px';
    panel.style.bottom = Math.max(pad, Math.round(innerHeight - edge)) + 'px';
    panel.style.maxHeight = Math.max(120, Math.floor(room)) + 'px';
  }
  function ctrlRects() {
    var out = [], vw = innerWidth, vh = innerHeight, q = doc.querySelectorAll('a[href],button,input,select,textarea,summary,[role=button],[role=tab],[role=menuitem],[onclick]');
    for (var i = 0; i < q.length && out.length < 600; i++) {
      var e = q[i];
      if (root.contains(e) || panel.contains(e) || (e.closest && e.closest('.fff-exit,[data-fff-view],.fff-a11y-skip'))) continue;
      var r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      var cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      out.push(r);
    }
    return out;
  }
  function hits(b, rects) {
    var n = 0;
    for (var i = 0; i < rects.length; i++) { var r = rects[i]; if (Math.min(b.right, r.right) - Math.max(b.left, r.left) > 1 && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 1) n++; }
    return n;
  }
  /* coloana de butoane caută pe marginea din dreapta cea mai de jos poziție în care nu acoperă niciun control (apoi rezervă o gutieră) */
  function place(again) {
    if (!root || root.hidden) return;
    var wasUp = btnUp.hidden; btnUp.hidden = false;                  // se măsoară coloana întreagă (cu săgeata), ca poziția să nu sară când apare
    var prevV = root.style.visibility; root.style.visibility = 'hidden';
    var rects = ctrlRects(), vp = viewport(), best = 12, bestN = 1e9;
    if (!again) { de.classList.remove('fff-apad'); gutter = false; }
    for (var k = 0; k < 9; k++) {
      var b = 12 + k * 56;
      if (b > vp.h * 0.55) break;
      root.style.bottom = b + 'px';
      var n = hits(root.getBoundingClientRect(), rects) * 10 + k * 0.1;
      if (n < bestN) { bestN = n; best = b; }
      if (n < 1) break;
    }
    root.style.bottom = best + 'px';
    root.style.visibility = prevV; btnUp.hidden = wasUp;
    if (bestN >= 10 && !again && !gutter) { gutter = true; de.classList.add('fff-apad'); void de.offsetWidth; return place(true); }
    if (bestN >= 10 && again) { de.classList.remove('fff-apad'); gutter = false; }
    fit();
  }
  function placeLater() { clearTimeout(placeT); placeT = setTimeout(function () { place(); }, 150); }
  function watchFree() {
    var kick = function () {
      clearTimeout(freeT);
      freeT = setTimeout(function () {
        if (!root || root.hidden) return;
        var wasUp = btnUp.hidden; btnUp.hidden = false;
        var hit = hits(root.getBoundingClientRect(), ctrlRects()) > 0; btnUp.hidden = wasUp;
        if (hit) place();
      }, 700);
    };
    try {
      if (doc.body && typeof MutationObserver === 'function') {
        mo = new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) { var t = ms[i].target; if (!root || !(root.contains(t) || panel.contains(t))) { kick(); return; } } });
        mo.observe(doc.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'open', 'style']});
      }
    } catch (e) { /* ignorat */ }
    window.addEventListener('load', kick);
    kick();
  }

  /* ---------- săgeata „înapoi sus” ---------- */
  function scTop(t) { return t === doc ? (window.pageYOffset || de.scrollTop || (doc.body && doc.body.scrollTop) || 0) : t.scrollTop; }
  function onScroll(e) {
    if (!btnUp) return;
    var t = e.target;
    if (t === doc || t === doc.scrollingElement || t === window) t = doc;
    else {
      if (!t || t.nodeType !== 1 || root.contains(t) || panel.contains(t)) return;
      var r = t.getBoundingClientRect();
      if (r.height < innerHeight * 0.4 || r.width < innerWidth * 0.4) return;   // doar zone mari (pagina sau panoul principal)
    }
    var y = scTop(t);
    if (y > TOPAT) { target = t; btnUp.hidden = false; }
    else if (t === target) { target = null; btnUp.hidden = true; }
  }
  function toTop() {
    var t = target, reduced = false;
    try { reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignorat */ }
    var beh = (S.rm || reduced) ? 'auto' : 'smooth';
    try {
      if (!t || t === doc) window.scrollTo({top: 0, behavior: beh}); else t.scrollTo({top: 0, behavior: beh});
    } catch (e) { try { window.scrollTo(0, 0); } catch (x) { /* ignorat */ } }
    var m = doc.querySelector('main,[role=main],h1');
    if (m) { try { if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1'); m.focus({preventScroll: true}); } catch (e) { /* ignorat */ } }
  }

  /* ---------- „Sari la conținut” ---------- */
  function skipLink() {
    if (!doc.body || doc.querySelector('.fff-a11y-skip, a.skip, a.skip-link, a.skiplink, a[href="#main"], a[href="#content"], a[href="#main-content"]')) return;
    var t = doc.querySelector('main,[role=main]') || doc.querySelector('h1');
    if (!t) return;
    if (!t.id) t.id = 'fff-main';
    var a = el('a', 'fff-a11y-skip', {href: '#' + t.id}); a.textContent = T('skip'); a.setAttribute('data-fff-skip', '');
    a.addEventListener('click', function () { try { if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); t.focus({preventScroll: false}); } catch (e) { /* ignorat */ } });
    doc.body.insertBefore(a, doc.body.firstChild);
  }

  /* ---------- API și pornire ---------- */
  function get() { var o = {fs: S.fs}; KEYS.forEach(function (k) { o[k] = S[k] ? 1 : 0; }); return o; }
  function set(o) {
    if (!o || typeof o !== 'object') return get();
    if (o.fs != null) { var f = +o.fs; if (f >= MINF - 0.001 && f <= MAXF + 0.001) S.fs = r2(f); }
    KEYS.forEach(function (k) { if (o[k] != null) S[k] = o[k] ? 1 : 0; });
    commit(); return get();
  }
  function mount() {
    if (root && root.isConnected) return true;
    if (!doc.body) return false;
    build(); de.appendChild(root); de.appendChild(panel); root.hidden = false;
    var h = function () { clearTimeout(placeT); placeT = setTimeout(function () { place(); }, 150); };
    window.addEventListener('resize', h, {passive: true}); window.addEventListener('orientationchange', h, {passive: true});
    if (window.visualViewport) { try { visualViewport.addEventListener('resize', h); } catch (e) { /* ignorat */ } }
    doc.addEventListener('scroll', onScroll, {passive: true, capture: true});
    sync(); place(); watchFree();
    onScroll({target: doc});
    return true;
  }
  var api = {
    open: open, close: close, toggle: toggle, get: get, set: set, speak: speak, stop: stop, up: toTop, refit: function () { place(); },
    reset: function () { stop(); S = fresh(); saved = true; commit(); return get(); },
    show: function () { wanted = true; if (eligible()) { if (mount()) root.hidden = false; applyState(true); place(); } },
    hide: function () { wanted = false; close(true); if (root) root.hidden = true; de.classList.remove('fff-hc', 'fff-rm', 'fff-rf', 'fff-ul', 'fff-fsz', 'fff-apad'); keepWatch(false); if (doc.body) doc.body.style.removeProperty('zoom'); de.style.removeProperty('font-size'); },
    mount: function (opt) { if (opt && opt.force) forced = true; wanted = true; if (!eligible()) return false; load(); applyState(true); skipLink(); return mount(); },
    element: function () { return root; }
  };
  F.a11y = api;

  function init() {
    if (inited) return; inited = true;
    var m = (meta('fff-a11y') || '').toLowerCase();
    TXTVAR = /\btextvar\b/.test(m);
    if (m === 'off' || m === '0' || m === 'false' || /[?&]noa11y=(1|true)\b/.test(location.search)) {
      OFF = true; de.setAttribute('data-fff-a11y', 'off');
      de.classList.remove('fff-hc', 'fff-rm', 'fff-rf', 'fff-ul', 'fff-fsz'); return;
    }
    if (!eligible()) return;
    load(); applyState(true); skipLink(); mount();
  }
  /* aplicare timpurie (fără clipire): clasele de mod se pun înainte de a se termina parsarea; <meta name="fff-a11y" content="off"> le retrage la init */
  (function early() {
    try {
      if (!eligible()) return;
      load();
      KEYS.forEach(function (k) { de.classList.toggle('fff-' + k, !!S[k]); });
    } catch (e) { /* ignorat */ }
  })();
  F.onLang && F.onLang(labels);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
