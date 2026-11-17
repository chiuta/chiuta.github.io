/* fff-kit · compat — strat de compatibilitate cu browsere mai vechi.
 * ES5 pur (fără let/const/săgeți/șabloane, fără sintaxă nouă): rulează ca script separat, ÎNAINTEA restului kitului, ca să poată
 * semnala problema și în browsere care nu pot rula kitul. Fără rețea, fără eval/new Function, fără stiluri inline (doar CSSOM).
 * Prag garantat (verificat în CI, vezi tools/compat/compat.config.json): Chrome/Edge 55+, Firefox 52+, Safari/iOS 10.1+ (sintaxă ES2017).
 * Ce face:
 *   1. rezerve (polyfill) pentru API-uri lipsă, definite DOAR dacă lipsesc: Object.entries/values/fromEntries, padStart/padEnd, trimStart/trimEnd,
 *      replaceAll, matchAll, at, flat/flatMap, findLast, Promise.finally/allSettled/any, structuredClone, queueMicrotask, requestIdleCallback,
 *      globalThis, crypto.randomUUID, AbortController, MediaQueryList.addEventListener, replaceChildren, toggleAttribute, Blob.arrayBuffer/text,
 *      canvas.toBlob, ctx.roundRect, scrollTo/scrollBy/scrollIntoView cu opțiuni, navigator.clipboard (execCommand), IntersectionObserver/ResizeObserver;
 *   2. <dialog>: show/showModal/close + atributul open când elementul nu există nativ (stilurile: clasa html.fff-no-dialog);
 *   3. FFF.compat.rx(sursa, flaguri[, rezervă]): RegExp construit la rulare — proprietăți Unicode \p{…}, steagul s, lookbehind (emulat) și rezervă;
 *   4. FFF.compat.imp(url): import() dinamic fără sintaxă nouă în scriptul clasic (printr-un mic script type=module, ignorat de browserele vechi);
 *   5. avertisment tradus (8 limbi) dacă lipsesc elemente de bază (Promise, Symbol, Map, Set, Object.assign, Array.from, variabile CSS);
 *   6. clase pe <html> pentru stiluri de rezervă: fff-no-dialog, fff-oldsel (fără :where/:not(listă)), fff-no-flexgap (fără gap în flex). */
(function (w, d) {
  'use strict';
  var F = (w.FFF = w.FFF || {});
  var C = (F.compat = F.compat || {});
  if (C.ready) return;
  C.ready = true;
  C.version = '1.8.0';
  C.floor = {chrome: 55, firefox: 52, safari: 10.1, ecma: 2017};
  C.has = {};
  var OP = Object.prototype, hasOwn = OP.hasOwnProperty, H = d.documentElement;
  var MaxU32 = 4294967295;

  function def(o, k, v) {
    if (!o) return;
    var cur; try { cur = o[k]; } catch (e) { cur = undefined; }
    if (cur !== undefined) return;
    try { Object.defineProperty(o, k, {value: v, writable: true, configurable: true}); } catch (e1) { try { o[k] = v; } catch (e2) { /* ignorat */ } }
  }
  function addCls(c) { if ((' ' + H.className + ' ').indexOf(' ' + c + ' ') < 0) H.className += (H.className ? ' ' : '') + c; }
  function onReady(fn) { if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', fn); else fn(); }
  function isNode(x) { return !!x && typeof x === 'object' && typeof x.nodeType === 'number'; }

  /* ---------- 1. Verificare minimă + mesaj ---------- */
  var miss = [];
  if (!w.Promise) miss.push('Promise');
  if (!w.Symbol) miss.push('Symbol');
  if (!(w.Map && w.Set && w.WeakMap)) miss.push('Map/Set');
  if (!Object.assign) miss.push('Object.assign');
  if (!Array.from) miss.push('Array.from');
  if (!(String.prototype.startsWith && Array.prototype.find)) miss.push('ES2015');
  if (!(w.CSS && w.CSS.supports && w.CSS.supports('--a', '0'))) miss.push('CSS variables');
  if (!(d.querySelector && w.addEventListener && w.JSON)) miss.push('DOM');
  C.missing = miss; C.tooOld = miss.length > 0;

  var MSG = {
    ro: ['Browserul dumneavoastră este prea vechi pentru această aplicație (lipsesc: %). Unele funcții pot să nu meargă. Actualizați browserul sau deschideți pagina într-un browser recent (Firefox, Chrome, Edge, Safari).', 'Am înțeles', 'Această funcție necesită % și nu e disponibilă în acest browser.'],
    en: ['Your browser is too old for this app (missing: %). Some features may not work. Update your browser or open this page in a recent one (Firefox, Chrome, Edge, Safari).', 'Dismiss', 'This feature needs % and it is not available in this browser.'],
    fr: ['Votre navigateur est trop ancien pour cette application (manque : %). Certaines fonctions peuvent ne pas marcher. Mettez-le à jour ou ouvrez la page dans un navigateur récent (Firefox, Chrome, Edge, Safari).', 'Fermer', 'Cette fonction nécessite % et n’est pas disponible dans ce navigateur.'],
    it: ['Il browser è troppo vecchio per questa applicazione (mancano: %). Alcune funzioni potrebbero non funzionare. Aggiornalo o apri la pagina in un browser recente (Firefox, Chrome, Edge, Safari).', 'Chiudi', 'Questa funzione richiede % e non è disponibile in questo browser.'],
    es: ['Su navegador es demasiado antiguo para esta aplicación (faltan: %). Algunas funciones pueden no funcionar. Actualícelo o abra la página en un navegador reciente (Firefox, Chrome, Edge, Safari).', 'Cerrar', 'Esta función requiere % y no está disponible en este navegador.'],
    pt: ['O seu navegador é demasiado antigo para esta aplicação (em falta: %). Algumas funções podem não funcionar. Atualize-o ou abra a página num navegador recente (Firefox, Chrome, Edge, Safari).', 'Fechar', 'Esta função requer % e não está disponível neste navegador.'],
    de: ['Ihr Browser ist für diese Anwendung zu alt (es fehlt: %). Einige Funktionen funktionieren eventuell nicht. Aktualisieren Sie den Browser oder öffnen Sie die Seite in einem aktuellen Browser (Firefox, Chrome, Edge, Safari).', 'Schließen', 'Diese Funktion benötigt % und ist in diesem Browser nicht verfügbar.'],
    hu: ['A böngészője túl régi ehhez az alkalmazáshoz (hiányzik: %). Egyes funkciók nem működhetnek. Frissítse a böngészőt, vagy nyissa meg az oldalt egy újabb böngészőben (Firefox, Chrome, Edge, Safari).', 'Bezár', 'Ehhez a funkcióhoz % szükséges, és ez a böngésző nem támogatja.']
  };
  function pickLang() {
    var l = '';
    try { l = (H.getAttribute('lang') || (w.navigator && (w.navigator.language || w.navigator.userLanguage)) || 'en'); } catch (e) { l = 'en'; }
    l = String(l).slice(0, 2).toLowerCase();
    return MSG[l] ? l : 'en';
  }
  var shown = {};
  function banner(kind, text) {
    if (shown[kind]) return; shown[kind] = true;
    onReady(function () {
      if (!d.body) return;
      var L = MSG[pickLang()];
      var box = d.createElement('div'), p = d.createElement('p'), b = d.createElement('button'), s;
      box.setAttribute('role', 'status'); box.setAttribute('data-fff-compat', kind);
      s = box.style; s.position = 'fixed'; s.left = '0'; s.right = '0'; s.bottom = '0'; s.zIndex = '2147483646'; s.boxSizing = 'border-box';
      s.padding = '10px 14px'; s.background = '#fff4c2'; s.color = '#1b1b1f'; s.borderTop = '2px solid #8a6d00';
      s.font = '14px/1.45 Arial,Helvetica,sans-serif'; s.textAlign = 'left';
      p.style.margin = '0 0 6px'; p.appendChild(d.createTextNode(text));
      b.type = 'button'; b.appendChild(d.createTextNode(L[1]));
      s = b.style; s.font = 'inherit'; s.padding = '6px 12px'; s.minHeight = '32px'; s.cursor = 'pointer';
      b.onclick = function () { if (box.parentNode) box.parentNode.removeChild(box); };
      box.appendChild(p); box.appendChild(b); d.body.appendChild(box);
    });
  }
  /** Afișează (o dată) că o funcție are nevoie de ceva ce browserul nu are. need('BigInt') → true dacă lipsește. */
  C.need = function (name, present) {
    var ok = present === undefined ? (typeof w[name] !== 'undefined') : !!present;
    if (!ok) banner('need-' + name, MSG[pickLang()][2].replace('%', name));
    return !ok;
  };
  if (C.tooOld) { addCls('fff-too-old'); banner('old', MSG[pickLang()][0].replace('%', miss.join(', '))); }
  if (C.tooOld) return;   // restul stratului presupune un minim ES2015; fără el nu are rost să continuăm

  /* ---------- 2. Rezerve pentru API-uri ---------- */
  function repeatTo(str, n) { var r = ''; while (r.length < n) r += str; return r.slice(0, n); }
  function sub(rep, m, pos, str) {
    return rep.replace(/\$([$&`']|\d\d?)/g, function (x, c) {
      if (c === '$') return '$'; if (c === '&') return m; if (c === '`') return str.slice(0, pos); if (c === "'") return str.slice(pos + m.length);
      return x;
    });
  }
  def(Object, 'entries', function (o) { var k = Object.keys(o), i = k.length, r = new Array(i); while (i--) r[i] = [k[i], o[k[i]]]; return r; });
  def(Object, 'values', function (o) { var k = Object.keys(o), i = k.length, r = new Array(i); while (i--) r[i] = o[k[i]]; return r; });
  def(Object, 'fromEntries', function (it) { var o = {}, a = Array.from(it), i; for (i = 0; i < a.length; i++) o[a[i][0]] = a[i][1]; return o; });
  def(Object, 'hasOwn', function (o, k) { return hasOwn.call(Object(o), k); });
  def(Object, 'getOwnPropertyDescriptors', function (o) { var r = {}; Object.getOwnPropertyNames(o).concat(Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(o) : []).forEach(function (k) { r[k] = Object.getOwnPropertyDescriptor(o, k); }); return r; });
  def(String.prototype, 'padStart', function (n, s) { var t = String(this); n = n >>> 0; s = s === undefined ? ' ' : String(s); if (t.length >= n || !s) return t; return repeatTo(s, n - t.length) + t; });
  def(String.prototype, 'padEnd', function (n, s) { var t = String(this); n = n >>> 0; s = s === undefined ? ' ' : String(s); if (t.length >= n || !s) return t; return t + repeatTo(s, n - t.length); });
  def(String.prototype, 'trimStart', function () { return String(this).replace(/^[\s﻿\xA0]+/, ''); });
  def(String.prototype, 'trimEnd', function () { return String(this).replace(/[\s﻿\xA0]+$/, ''); });
  def(String.prototype, 'at', function (i) { var s = String(this), n = Math.trunc(i) || 0; if (n < 0) n += s.length; return n < 0 || n >= s.length ? undefined : s.charAt(n); });
  def(String.prototype, 'replaceAll', function (a, b) {
    var s = String(this), from, out = '', last = 0, pos = 0, i, fn = typeof b === 'function';
    if (a instanceof RegExp) { if (!a.global) throw new TypeError('replaceAll must be called with a global RegExp'); return s.replace(a, b); }
    from = String(a); if (!fn) b = String(b);
    for (;;) {
      if (pos > s.length) break;
      i = s.indexOf(from, pos);
      if (i === -1) break;
      out += s.slice(last, i) + (fn ? String(b(from, i, s)) : sub(b, from, i, s));
      last = i + from.length; pos = i + (from.length || 1);
    }
    return out + s.slice(last);
  });
  def(String.prototype, 'matchAll', function (re) {
    var s = String(this), r, out = [], m;
    if (re instanceof RegExp) { if (!re.global) throw new TypeError('matchAll must be called with a global RegExp'); r = new RegExp(re.source, re.flags); r.lastIndex = re.lastIndex; } else r = new RegExp(re, 'g');
    while ((m = r.exec(s))) { out.push(m); if (m[0] === '') r.lastIndex++; }
    return out[Symbol.iterator]();
  });
  function flatten(a, depth, out) { var i, v; for (i = 0; i < a.length; i++) { if (!(i in a)) continue; v = a[i]; if (depth > 0 && Array.isArray(v)) flatten(v, depth - 1, out); else out.push(v); } return out; }
  def(Array.prototype, 'flat', function (dp) { return flatten(this, dp === undefined ? 1 : Math.floor(dp), []); });
  def(Array.prototype, 'flatMap', function (fn, t) { return flatten(Array.prototype.map.call(this, fn, t), 1, []); });
  def(Array.prototype, 'at', function (i) { var n = Math.trunc(i) || 0; if (n < 0) n += this.length; return n < 0 || n >= this.length ? undefined : this[n]; });
  def(Array.prototype, 'findLast', function (fn, t) { for (var i = this.length - 1; i >= 0; i--) if (fn.call(t, this[i], i, this)) return this[i]; return undefined; });
  def(Array.prototype, 'findLastIndex', function (fn, t) { for (var i = this.length - 1; i >= 0; i--) if (fn.call(t, this[i], i, this)) return i; return -1; });
  var PP = w.Promise.prototype;
  def(PP, 'finally', function (f) {
    var P = this.constructor || w.Promise;
    if (typeof f !== 'function') return this.then(f, f);
    return this.then(function (v) { return P.resolve(f()).then(function () { return v; }); }, function (e) { return P.resolve(f()).then(function () { throw e; }); });
  });
  def(w.Promise, 'allSettled', function (it) {
    return w.Promise.all(Array.from(it, function (p) { return w.Promise.resolve(p).then(function (v) { return {status: 'fulfilled', value: v}; }, function (e) { return {status: 'rejected', reason: e}; }); }));
  });
  def(w.Promise, 'any', function (it) {
    return new w.Promise(function (res, rej) {
      var arr = Array.from(it), errs = [], n = 0, er;
      function fail() { er = new Error('All promises were rejected'); er.name = 'AggregateError'; er.errors = errs; rej(er); }
      if (!arr.length) return fail();
      arr.forEach(function (p, i) { w.Promise.resolve(p).then(res, function (e) { errs[i] = e; if (++n === arr.length) fail(); }); });
    });
  });
  def(w, 'globalThis', w);
  def(w, 'queueMicrotask', function (fn) { w.Promise.resolve().then(fn).catch(function (e) { setTimeout(function () { throw e; }, 0); }); });
  def(w, 'requestIdleCallback', function (cb) { var t = Date.now(); return setTimeout(function () { cb({didTimeout: false, timeRemaining: function () { return Math.max(0, 50 - (Date.now() - t)); }}); }, 1); });
  def(w, 'cancelIdleCallback', function (id) { clearTimeout(id); });
  if (w.crypto && w.crypto.getRandomValues) def(w.crypto, 'randomUUID', function () {
    var b = new Uint8Array(16), h = '', i; w.crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    for (i = 0; i < 16; i++) { h += (b[i] < 16 ? '0' : '') + b[i].toString(16); if (i === 3 || i === 5 || i === 7 || i === 9) h += '-'; }
    return h;
  });

  function dce(msg) { try { return new w.DOMException(msg, 'DataCloneError'); } catch (e) { var er = new Error(msg); er.name = 'DataCloneError'; return er; } }
  function sclone(v, seen) {
    var t, r, i, keys;
    if (v === null || typeof v !== 'object') { if (typeof v === 'function' || typeof v === 'symbol') throw dce('el nu poate fi clonat'); return v; }
    if (seen.has(v)) return seen.get(v);
    t = OP.toString.call(v);
    if (t === '[object Date]') return new Date(v.getTime());
    if (t === '[object RegExp]') { r = new RegExp(v.source, v.flags); r.lastIndex = v.lastIndex; return r; }
    if (typeof w.ArrayBuffer !== 'undefined' && v instanceof w.ArrayBuffer) return v.slice(0);
    if (w.ArrayBuffer && w.ArrayBuffer.isView && w.ArrayBuffer.isView(v)) {
      if (t === '[object DataView]') return new w.DataView(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength));
      return new v.constructor(v);
    }
    if (w.Map && v instanceof w.Map) { r = new w.Map(); seen.set(v, r); v.forEach(function (x, k) { r.set(sclone(k, seen), sclone(x, seen)); }); return r; }
    if (w.Set && v instanceof w.Set) { r = new w.Set(); seen.set(v, r); v.forEach(function (x) { r.add(sclone(x, seen)); }); return r; }
    if (Array.isArray(v)) { r = new Array(v.length); seen.set(v, r); for (i = 0; i < v.length; i++) if (i in v) r[i] = sclone(v[i], seen); return r; }
    if (w.Blob && v instanceof w.Blob) return v;
    if (isNode(v) || t === '[object Function]' || t === '[object Promise]' || t === '[object WeakMap]' || t === '[object WeakSet]') throw dce('el nu poate fi clonat');
    r = {}; seen.set(v, r); keys = Object.keys(v);
    for (i = 0; i < keys.length; i++) r[keys[i]] = sclone(v[keys[i]], seen);
    return r;
  }
  def(w, 'structuredClone', function (v) { return sclone(v, new w.Map()); });

  if (!w.AbortController) {
    var AS = function () { this.aborted = false; this.reason = undefined; this.onabort = null; this._l = []; };
    AS.prototype.addEventListener = function (t, fn) { if (t === 'abort' && this._l.indexOf(fn) < 0) this._l.push(fn); };
    AS.prototype.removeEventListener = function (t, fn) { var i = this._l.indexOf(fn); if (i >= 0) this._l.splice(i, 1); };
    AS.prototype.throwIfAborted = function () { if (this.aborted) throw this.reason; };
    w.AbortSignal = w.AbortSignal || AS;
    w.AbortController = function () { this.signal = new AS(); };
    w.AbortController.prototype.abort = function (reason) {
      var s = this.signal, ev; if (s.aborted) return;
      s.aborted = true;
      if (reason === undefined) { reason = new Error('The operation was aborted.'); reason.name = 'AbortError'; }
      s.reason = reason; ev = {type: 'abort', target: s};
      if (typeof s.onabort === 'function') s.onabort(ev);
      s._l.slice().forEach(function (f) { f.call(s, ev); });
    };
  }
  if (w.MediaQueryList && !w.MediaQueryList.prototype.addEventListener) {
    w.MediaQueryList.prototype.addEventListener = function (t, fn) { if (t === 'change') this.addListener(fn); };
    w.MediaQueryList.prototype.removeEventListener = function (t, fn) { if (t === 'change') this.removeListener(fn); };
  }
  function replaceChildren() {
    var n, a = arguments, i;
    while ((n = this.firstChild)) this.removeChild(n);
    for (i = 0; i < a.length; i++) this.appendChild(isNode(a[i]) ? a[i] : d.createTextNode(String(a[i])));
  }
  ['Element', 'Document', 'DocumentFragment'].forEach(function (n) { if (w[n]) def(w[n].prototype, 'replaceChildren', replaceChildren); });
  if (w.Element) def(w.Element.prototype, 'toggleAttribute', function (n, force) {
    var has = this.hasAttribute(n), want = force === undefined ? !has : !!force;
    if (want && !has) this.setAttribute(n, ''); else if (!want && has) this.removeAttribute(n);
    return want;
  });
  if (w.Blob && w.FileReader) {
    def(w.Blob.prototype, 'arrayBuffer', function () { var b = this; return new w.Promise(function (res, rej) { var r = new w.FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.readAsArrayBuffer(b); }); });
    def(w.Blob.prototype, 'text', function () { var b = this; return new w.Promise(function (res, rej) { var r = new w.FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.readAsText(b); }); });
  }
  if (w.HTMLCanvasElement) def(w.HTMLCanvasElement.prototype, 'toBlob', function (cb, type, q) {
    var c = this;
    setTimeout(function () {
      var url = c.toDataURL(type, q), parts = url.split(','), mime = (parts[0].match(/:(.*?);/) || [0, 'image/png'])[1], bin = w.atob(parts[1]), arr = new Uint8Array(bin.length), i;
      for (i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      cb(new w.Blob([arr], {type: mime}));
    }, 0);
  });
  if (w.CanvasRenderingContext2D) def(w.CanvasRenderingContext2D.prototype, 'roundRect', function (x, y, wd, h, r) {
    var tl, tr, br, bl, a, m;
    function rad(v) { return typeof v === 'object' && v ? (v.x || 0) : (+v || 0); }
    if (Array.isArray(r)) {
      a = r.map(rad);
      if (a.length === 1) tl = tr = br = bl = a[0]; else if (a.length === 2) { tl = br = a[0]; tr = bl = a[1]; } else if (a.length === 3) { tl = a[0]; tr = bl = a[1]; br = a[2]; } else { tl = a[0]; tr = a[1]; br = a[2]; bl = a[3]; }
    } else tl = tr = br = bl = rad(r);
    if (wd < 0) { x += wd; wd = -wd; } if (h < 0) { y += h; h = -h; }
    m = Math.min(wd, h) / 2; tl = Math.min(tl, m); tr = Math.min(tr, m); br = Math.min(br, m); bl = Math.min(bl, m);
    this.moveTo(x + tl, y); this.lineTo(x + wd - tr, y); this.arcTo(x + wd, y, x + wd, y + tr, tr);
    this.lineTo(x + wd, y + h - br); this.arcTo(x + wd, y + h, x + wd - br, y + h, br);
    this.lineTo(x + bl, y + h); this.arcTo(x, y + h, x, y + h - bl, bl);
    this.lineTo(x, y + tl); this.arcTo(x, y, x + tl, y, tl); this.closePath();
  });
  if (w.navigator && !w.navigator.clipboard) {
    try {
      Object.defineProperty(w.navigator, 'clipboard', {configurable: true, value: {
        writeText: function (t) {
          return new w.Promise(function (res, rej) {
            var ta = d.createElement('textarea'), prev = d.activeElement, ok = false, s = ta.style;
            ta.value = String(t); ta.setAttribute('readonly', ''); s.position = 'fixed'; s.top = '0'; s.left = '0'; s.opacity = '0';
            d.body.appendChild(ta); ta.focus(); ta.select();
            try { ta.setSelectionRange(0, ta.value.length); } catch (e1) { /* ignorat */ }
            try { ok = d.execCommand('copy'); } catch (e2) { ok = false; }
            d.body.removeChild(ta);
            if (prev && prev.focus) { try { prev.focus(); } catch (e3) { /* ignorat */ } }
            if (ok) res(); else rej(new Error('copierea a eșuat'));
          });
        },
        readText: function () { return w.Promise.reject(new Error('citirea clipboardului nu e disponibilă')); }
      }});
    } catch (eC) { /* ignorat */ }
  }
  if (!w.IntersectionObserver) {
    w.IntersectionObserver = function (cb) { this._cb = cb; };
    w.IntersectionObserver.prototype.observe = function (el) { var self = this; setTimeout(function () { self._cb([{target: el, isIntersecting: true, intersectionRatio: 1, boundingClientRect: el.getBoundingClientRect(), time: Date.now()}], self); }, 0); };
    w.IntersectionObserver.prototype.unobserve = w.IntersectionObserver.prototype.disconnect = function () { /* nimic */ };
    w.IntersectionObserver.prototype.takeRecords = function () { return []; };
  }
  if (!w.ResizeObserver) {
    w.ResizeObserver = function (cb) { this._cb = cb; this._els = []; this._sz = []; this._t = 0; var self = this; this._f = function () { self._tick(); }; };
    w.ResizeObserver.prototype._tick = function () {
      var out = [], i, el, wd, h, s;
      for (i = 0; i < this._els.length; i++) {
        el = this._els[i]; wd = el.clientWidth; h = el.clientHeight; s = this._sz[i];
        if (!s || s[0] !== wd || s[1] !== h) { this._sz[i] = [wd, h]; out.push({target: el, contentRect: {x: 0, y: 0, top: 0, left: 0, width: wd, height: h, right: wd, bottom: h}}); }
      }
      if (out.length) this._cb(out, this);
    };
    w.ResizeObserver.prototype.observe = function (el) {
      var self = this;
      if (this._els.indexOf(el) >= 0) return;
      this._els.push(el); this._sz.push(null);
      if (this._els.length === 1) { w.addEventListener('resize', this._f); w.addEventListener('orientationchange', this._f); w.addEventListener('load', this._f); this._t = setInterval(this._f, 500); }
      setTimeout(function () { self._tick(); }, 0);
    };
    w.ResizeObserver.prototype.unobserve = function (el) { var i = this._els.indexOf(el); if (i >= 0) { this._els.splice(i, 1); this._sz.splice(i, 1); } if (!this._els.length) this.disconnect(); };
    w.ResizeObserver.prototype.disconnect = function () { w.removeEventListener('resize', this._f); w.removeEventListener('orientationchange', this._f); w.removeEventListener('load', this._f); clearInterval(this._t); this._els = []; this._sz = []; };
  }
  /* scrollTo/scrollBy/scrollIntoView cu obiect de opțiuni (Safari < 14 îl ignoră; „smooth” devine instant) */
  (function () {
    var EP = w.Element && w.Element.prototype, ES;
    if (w.CSS && w.CSS.supports && w.CSS.supports('scroll-behavior', 'smooth')) return;
    function fix(proto, name, isWin) {
      var orig = proto[name];
      proto[name] = function (a, b) {
        var o, x, y, cx, cy;
        if (a && typeof a === 'object') {
          o = a; cx = isWin ? (w.pageXOffset || 0) : this.scrollLeft; cy = isWin ? (w.pageYOffset || 0) : this.scrollTop;
          if (name === 'scrollBy') {
            if (isWin) { if (orig) orig.call(this, o.left || 0, o.top || 0); return; }
            this.scrollLeft = cx + (o.left || 0); this.scrollTop = cy + (o.top || 0); return;
          }
          x = o.left !== undefined ? o.left : cx; y = o.top !== undefined ? o.top : cy;
          if (isWin) { if (orig) orig.call(this, x, y); return; }
          this.scrollLeft = x; this.scrollTop = y; return;
        }
        if (orig) return orig.apply(this, arguments);
        if (name === 'scrollBy') { this.scrollLeft += a || 0; this.scrollTop += b || 0; } else { this.scrollLeft = a || 0; this.scrollTop = b || 0; }
      };
    }
    try { fix(w, 'scrollTo', true); fix(w, 'scrollBy', true); } catch (e1) { /* ignorat */ }
    if (EP) {
      try { fix(EP, 'scrollTo', false); fix(EP, 'scrollBy', false); } catch (e2) { /* ignorat */ }
      ES = EP.scrollIntoView;
      if (ES) EP.scrollIntoView = function (o) {
        var r;
        if (o && typeof o === 'object') {
          if (o.block === 'center' && w.scrollTo) { r = this.getBoundingClientRect(); w.scrollTo(w.pageXOffset || 0, (w.pageYOffset || 0) + r.top + r.height / 2 - (w.innerHeight || H.clientHeight) / 2); return; }
          return ES.call(this, o.block !== 'end' && o.block !== 'nearest');
        }
        return ES.apply(this, arguments);
      };
    }
  })();

  /* ---------- 3. <dialog> și clase pentru stiluri de rezervă ---------- */
  if (!w.HTMLDialogElement) {
    addCls('fff-no-dialog'); C.has.dialog = false;
    (function () {
      /* Firefox < 98, Safari/iOS < 15.4: elementul nu există. Ce replicăm: show/showModal/close, open, returnValue, evenimentele cancel (Esc) și close,
         <form method="dialog"> (altfel butonul ar naviga pagina), fundal (div.fff-bd), blocarea clicurilor în afara dialogului modal, focus
         în dialog și revenirea lui la închidere, centrare. Închis = ascuns prin CSS (kit.css: html.fff-no-dialog dialog:not([open])). */
      var proto = (w.HTMLUnknownElement && w.HTMLUnknownElement.prototype) || w.HTMLElement.prototype;
      var stack = [], loose = [], BASE = 2147483620, pending = null, mo = null;
      function isDlg(el) { return !!el && el.nodeType === 1 && String(el.tagName).toUpperCase() === 'DIALOG'; }
      function chk(el) { if (!isDlg(el)) throw new TypeError('Illegal invocation'); }
      function fire(el, type, cancelable) {
        var ev;
        try { ev = new w.Event(type, {bubbles: false, cancelable: !!cancelable}); } catch (e) { ev = d.createEvent('Event'); ev.initEvent(type, false, !!cancelable); }
        return el.dispatchEvent(ev);
      }
      function cs(el, k) { try { return w.getComputedStyle(el)[k]; } catch (e) { return ''; } }
      function vis(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
      function focusables(el) {
        var all = el.querySelectorAll('a[href],area[href],button,input,select,textarea,summary,[tabindex],[contenteditable=""],[contenteditable="true"],iframe'), out = [], i, e;
        for (i = 0; i < all.length; i++) {
          e = all[i];
          if (e.disabled || e.getAttribute('tabindex') === '-1' || e.type === 'hidden' || e.hasAttribute('hidden') || !vis(e)) continue;
          out.push(e);
        }
        return out;
      }
      /* centrare fără transform (nu se bate cu animațiile aplicației) și corectă sub zoom CSS: top/left 50% + margini negative din dimensiunea proprie */
      function place(el) {
        if (!el.hasAttribute('open') || el.__fffMode === 'own') return;
        var s = el.style;
        if (!el.__fffMode) {
          var pos = cs(el, 'position');
          if ((pos === 'fixed' || pos === 'absolute') && (cs(el, 'top') !== 'auto' || cs(el, 'bottom') !== 'auto')) { el.__fffMode = 'own'; return; }
          el.__fffMode = 'auto'; s.position = 'fixed'; s.right = 'auto'; s.bottom = 'auto'; s.top = '50%'; s.left = '50%'; s.marginRight = '0'; s.marginBottom = '0';
          if (cs(el, 'maxWidth') === 'none') s.maxWidth = 'calc(100% - 2em)';
          if (cs(el, 'maxHeight') === 'none') s.maxHeight = 'calc(100% - 2em)';
          if (cs(el, 'overflowY') === 'visible') s.overflow = 'auto';
        }
        s.marginLeft = '0'; s.marginTop = '0';
        var ww = el.offsetWidth, hh = el.offsetHeight;
        s.marginLeft = (-Math.round(ww / 2)) + 'px'; s.marginTop = (-Math.round(hh / 2)) + 'px';
      }
      function unplace(el) {
        if (el.__fffMode === 'auto') {
          var s = el.style, k = ['position', 'right', 'bottom', 'top', 'left', 'marginLeft', 'marginTop', 'marginRight', 'marginBottom', 'maxWidth', 'maxHeight', 'overflow', 'zIndex'], i;
          for (i = 0; i < k.length; i++) s[k[i]] = '';
        } else if (el.__fffMode === 'own') el.style.zIndex = '';
        el.__fffMode = null;
      }
      function replaceAll() { var i; for (i = 0; i < stack.length; i++) place(stack[i]); for (i = 0; i < loose.length; i++) place(loose[i]); }
      function schedule() { if (pending) return; pending = setTimeout(function () { pending = null; replaceAll(); }, 16); }
      function watch(el) {
        if (!w.MutationObserver) return;
        if (!mo) mo = new w.MutationObserver(schedule);
        try { mo.observe(el, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'open']}); } catch (e) { /* ignorat */ }
      }
      w.addEventListener('resize', schedule); w.addEventListener('orientationchange', schedule);
      function zOf(n) { return String(BASE + n); }
      function prune() {
        var i, b;
        for (i = stack.length - 1; i >= 0; i--) if (!d.documentElement.contains(stack[i]) || !stack[i].hasAttribute('open')) { b = stack[i].__fffBd; if (b && b.parentNode) b.parentNode.removeChild(b); stack[i].__fffBd = null; stack.splice(i, 1); }
      }
      function open(el, modal) {
        chk(el);
        if (el.hasAttribute('open')) { if (modal) throw new Error('InvalidStateError'); return; }
        prune();
        el.__fffPrev = d.activeElement;
        el.setAttribute('open', '');
        var z = stack.length * 2;
        if (modal) {
          var b = d.createElement('div'), bs = b.style;
          b.className = 'fff-bd'; b.setAttribute('data-fff-bd', ''); b.setAttribute('aria-hidden', 'true');
          bs.position = 'fixed'; bs.top = '0'; bs.right = '0'; bs.bottom = '0'; bs.left = '0'; bs.background = 'rgba(0,0,0,.5)'; bs.zIndex = zOf(z);
          (d.body || H).appendChild(b); el.__fffBd = b;
          el.setAttribute('data-fff-modal', ''); stack.push(el);
        } else if (loose.indexOf(el) < 0) loose.push(el);
        el.style.zIndex = zOf(z + 1);
        place(el); watch(el);
        var f = el.querySelector('[autofocus]');
        if (!f || !vis(f)) { var fs = focusables(el); f = fs.length ? fs[0] : null; }
        if (modal || f) { try { if (f) f.focus(); else { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); el.focus(); } } catch (e) { /* ignorat */ } }
        setTimeout(function () { place(el); }, 0);
      }
      function close(el, rv) {
        chk(el);
        if (!el.hasAttribute('open')) return;
        if (rv !== undefined) el.returnValue = String(rv);
        el.removeAttribute('open'); el.removeAttribute('data-fff-modal');
        var b = el.__fffBd; if (b && b.parentNode) b.parentNode.removeChild(b); el.__fffBd = null;
        var i = stack.indexOf(el); if (i >= 0) stack.splice(i, 1);
        i = loose.indexOf(el); if (i >= 0) loose.splice(i, 1);
        unplace(el);
        var prev = el.__fffPrev; el.__fffPrev = null;
        if (prev && prev !== d.body && prev.focus && d.documentElement.contains(prev)) { try { prev.focus(); } catch (e) { /* ignorat */ } }
        setTimeout(function () { fire(el, 'close', false); }, 0);
      }
      C._dlg = {show: function (el) { open(el, false); }, showModal: function (el) { open(el, true); }, close: close};
      function put(name, fn) { if (!proto[name]) { try { Object.defineProperty(proto, name, {value: fn, writable: true, configurable: true}); } catch (e) { proto[name] = fn; } } }
      put('show', function () { open(this, false); });
      put('showModal', function () { open(this, true); });
      put('close', function (rv) { close(this, rv); });
      function prop(name, get, set) {
        if (name in proto) return;
        try { Object.defineProperty(proto, name, {configurable: true, get: get, set: set}); } catch (e) { /* ignorat */ }
      }
      prop('open', function () { return isDlg(this) ? this.hasAttribute('open') : undefined; },
        function (v) { if (!isDlg(this)) return; if (v) { if (!this.hasAttribute('open')) open(this, false); } else close(this); });
      prop('returnValue', function () { return isDlg(this) ? (this.__fffRv == null ? '' : this.__fffRv) : undefined; }, function (v) { if (isDlg(this)) this.__fffRv = String(v); });
      /* Esc → cancel (anulabil) → close; capcană de focus; <form method="dialog"> */
      d.addEventListener('keydown', function (e) {
        if (!stack.length || e.defaultPrevented) return;
        var top = stack[stack.length - 1];
        if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
          if (!d.documentElement.contains(top)) { prune(); return; }
          e.preventDefault();
          if (fire(top, 'cancel', true)) close(top);
        } else if ((e.key === 'Tab' || e.keyCode === 9) && top.contains(e.target)) {
          var fs = focusables(top);
          if (!fs.length) { e.preventDefault(); return; }
          if (e.shiftKey && e.target === fs[0]) { e.preventDefault(); fs[fs.length - 1].focus(); }
          else if (!e.shiftKey && e.target === fs[fs.length - 1]) { e.preventDefault(); fs[0].focus(); }
        }
      }, false);
      d.addEventListener('focusin', function (e) {
        if (!stack.length) return;
        var top = stack[stack.length - 1];
        if (!top.contains(e.target)) { var fs = focusables(top); try { (fs[0] || top).focus(); } catch (x) { /* ignorat */ } }
      }, true);
      var lastSub = null;
      d.addEventListener('click', function (e) {
        var t = e.target, el = t && t.closest ? t.closest('button,input') : null;
        if (el && (el.type === 'submit' || (el.tagName === 'BUTTON' && !el.getAttribute('type')) || el.type === 'image')) lastSub = el; else lastSub = null;
      }, true);
      d.addEventListener('submit', function (e) {   // fază de bubble: dacă aplicația a făcut preventDefault, nu închidem (ca în nativ)
        var f = e.target;
        if (e.defaultPrevented || !f || f.nodeType !== 1 || String(f.getAttribute('method') || '').toLowerCase() !== 'dialog') return;
        e.preventDefault();
        var dlg = f.closest ? f.closest('dialog') : null;
        if (!dlg || !isDlg(dlg)) return;
        var sub = e.submitter || (lastSub && f.contains(lastSub) ? lastSub : null);
        close(dlg, sub && sub.value != null && sub.value !== '' ? sub.value : (dlg.returnValue || ''));
      }, false);
    })();
  } else C.has.dialog = true;
  (function () {
    var ok = true;
    try { d.querySelector(':where(a)'); d.querySelector(':not(a,b)'); } catch (e) { ok = false; }
    C.has.selectors4 = ok; if (!ok) addCls('fff-oldsel');
  })();
  onReady(function () {
    try {
      var f = d.createElement('fff-t'), a = d.createElement('fff-t'), b = d.createElement('fff-t'), s = f.style, g;
      s.display = 'flex'; s.flexDirection = 'column'; s.rowGap = '1px'; s.position = 'absolute'; s.visibility = 'hidden'; s.margin = '0'; s.padding = '0'; s.border = '0';
      a.style.display = 'block'; a.style.height = '1px'; a.style.margin = '0'; b.style.display = 'block'; b.style.height = '1px'; b.style.margin = '0';
      f.appendChild(a); f.appendChild(b); d.body.appendChild(f);
      g = f.offsetHeight === 3; d.body.removeChild(f);
      C.has.flexGap = g; if (!g) addCls('fff-no-flexgap');
    } catch (e) { /* ignorat */ }
  });

  /* ---------- 4. import() dinamic fără sintaxă nouă ---------- */
  C.imp = function (url) {
    if (typeof w.__fffImp === 'function') return w.__fffImp(url);
    if (d.readyState === 'loading') return new w.Promise(function (res) { d.addEventListener('DOMContentLoaded', function () { res(); }); }).then(function () { return C.imp(url); });
    return w.Promise.reject(new Error('import() dinamic nu este disponibil în acest browser'));
  };

  /* ---------- 5. RegExp construit la rulare ---------- */
  var PROPS = {"Lu":"A-Z\\xC0-\\xD6\\xD8-\\xDE\\u0100\\u0102\\u0104\\u0106\\u0108\\u010A\\u010C\\u010E\\u0110\\u0112\\u0114\\u0116\\u0118\\u011A\\u011C\\u011E\\u0120\\u0122\\u0124\\u0126\\u0128\\u012A\\u012C\\u012E\\u0130\\u0132\\u0134\\u0136\\u0139\\u013B\\u013D\\u013F\\u0141\\u0143\\u0145\\u0147\\u014A\\u014C\\u014E\\u0150\\u0152\\u0154\\u0156\\u0158\\u015A\\u015C\\u015E\\u0160\\u0162\\u0164\\u0166\\u0168\\u016A\\u016C\\u016E\\u0170\\u0172\\u0174\\u0176\\u0178\\u0179\\u017B\\u017D\\u0181\\u0182\\u0184\\u0186\\u0187\\u0189-\\u018B\\u018E-\\u0191\\u0193\\u0194\\u0196-\\u0198\\u019C\\u019D\\u019F\\u01A0\\u01A2\\u01A4\\u01A6\\u01A7\\u01A9\\u01AC\\u01AE\\u01AF\\u01B1-\\u01B3\\u01B5\\u01B7\\u01B8\\u01BC\\u01C4\\u01C7\\u01CA\\u01CD\\u01CF\\u01D1\\u01D3\\u01D5\\u01D7\\u01D9\\u01DB\\u01DE\\u01E0\\u01E2\\u01E4\\u01E6\\u01E8\\u01EA\\u01EC\\u01EE\\u01F1\\u01F4\\u01F6-\\u01F8\\u01FA\\u01FC\\u01FE\\u0200\\u0202\\u0204\\u0206\\u0208\\u020A\\u020C\\u020E\\u0210\\u0212\\u0214\\u0216\\u0218\\u021A\\u021C\\u021E\\u0220\\u0222\\u0224\\u0226\\u0228\\u022A\\u022C\\u022E\\u0230\\u0232\\u023A\\u023B\\u023D\\u023E\\u0241\\u0243-\\u0246\\u0248\\u024A\\u024C\\u024E\\u0370\\u0372\\u0376\\u037F\\u0386\\u0388-\\u038A\\u038C\\u038E\\u038F\\u0391-\\u03A1\\u03A3-\\u03AB\\u03CF\\u03D2-\\u03D4\\u03D8\\u03DA\\u03DC\\u03DE\\u03E0\\u03E2\\u03E4\\u03E6\\u03E8\\u03EA\\u03EC\\u03EE\\u03F4\\u03F7\\u03F9\\u03FA\\u03FD-\\u042F\\u0460\\u0462\\u0464\\u0466\\u0468\\u046A\\u046C\\u046E\\u0470\\u0472\\u0474\\u0476\\u0478\\u047A\\u047C\\u047E\\u0480\\u048A\\u048C\\u048E\\u0490\\u0492\\u0494\\u0496\\u0498\\u049A\\u049C\\u049E\\u04A0\\u04A2\\u04A4\\u04A6\\u04A8\\u04AA\\u04AC\\u04AE\\u04B0\\u04B2\\u04B4\\u04B6\\u04B8\\u04BA\\u04BC\\u04BE\\u04C0\\u04C1\\u04C3\\u04C5\\u04C7\\u04C9\\u04CB\\u04CD\\u04D0\\u04D2\\u04D4\\u04D6\\u04D8\\u04DA\\u04DC\\u04DE\\u04E0\\u04E2\\u04E4\\u04E6\\u04E8\\u04EA\\u04EC\\u04EE\\u04F0\\u04F2\\u04F4\\u04F6\\u04F8\\u04FA\\u04FC\\u04FE\\u1E00\\u1E02\\u1E04\\u1E06\\u1E08\\u1E0A\\u1E0C\\u1E0E\\u1E10\\u1E12\\u1E14\\u1E16\\u1E18\\u1E1A\\u1E1C\\u1E1E\\u1E20\\u1E22\\u1E24\\u1E26\\u1E28\\u1E2A\\u1E2C\\u1E2E\\u1E30\\u1E32\\u1E34\\u1E36\\u1E38\\u1E3A\\u1E3C\\u1E3E\\u1E40\\u1E42\\u1E44\\u1E46\\u1E48\\u1E4A\\u1E4C\\u1E4E\\u1E50\\u1E52\\u1E54\\u1E56\\u1E58\\u1E5A\\u1E5C\\u1E5E\\u1E60\\u1E62\\u1E64\\u1E66\\u1E68\\u1E6A\\u1E6C\\u1E6E\\u1E70\\u1E72\\u1E74\\u1E76\\u1E78\\u1E7A\\u1E7C\\u1E7E\\u1E80\\u1E82\\u1E84\\u1E86\\u1E88\\u1E8A\\u1E8C\\u1E8E\\u1E90\\u1E92\\u1E94\\u1E9E\\u1EA0\\u1EA2\\u1EA4\\u1EA6\\u1EA8\\u1EAA\\u1EAC\\u1EAE\\u1EB0\\u1EB2\\u1EB4\\u1EB6\\u1EB8\\u1EBA\\u1EBC\\u1EBE\\u1EC0\\u1EC2\\u1EC4\\u1EC6\\u1EC8\\u1ECA\\u1ECC\\u1ECE\\u1ED0\\u1ED2\\u1ED4\\u1ED6\\u1ED8\\u1EDA\\u1EDC\\u1EDE\\u1EE0\\u1EE2\\u1EE4\\u1EE6\\u1EE8\\u1EEA\\u1EEC\\u1EEE\\u1EF0\\u1EF2\\u1EF4\\u1EF6\\u1EF8\\u1EFA\\u1EFC\\u1EFE\\uFF21-\\uFF3A","Ll":"a-z\\xB5\\xDF-\\xF6\\xF8-\\xFF\\u0101\\u0103\\u0105\\u0107\\u0109\\u010B\\u010D\\u010F\\u0111\\u0113\\u0115\\u0117\\u0119\\u011B\\u011D\\u011F\\u0121\\u0123\\u0125\\u0127\\u0129\\u012B\\u012D\\u012F\\u0131\\u0133\\u0135\\u0137\\u0138\\u013A\\u013C\\u013E\\u0140\\u0142\\u0144\\u0146\\u0148\\u0149\\u014B\\u014D\\u014F\\u0151\\u0153\\u0155\\u0157\\u0159\\u015B\\u015D\\u015F\\u0161\\u0163\\u0165\\u0167\\u0169\\u016B\\u016D\\u016F\\u0171\\u0173\\u0175\\u0177\\u017A\\u017C\\u017E-\\u0180\\u0183\\u0185\\u0188\\u018C\\u018D\\u0192\\u0195\\u0199-\\u019B\\u019E\\u01A1\\u01A3\\u01A5\\u01A8\\u01AA\\u01AB\\u01AD\\u01B0\\u01B4\\u01B6\\u01B9\\u01BA\\u01BD-\\u01BF\\u01C6\\u01C9\\u01CC\\u01CE\\u01D0\\u01D2\\u01D4\\u01D6\\u01D8\\u01DA\\u01DC\\u01DD\\u01DF\\u01E1\\u01E3\\u01E5\\u01E7\\u01E9\\u01EB\\u01ED\\u01EF\\u01F0\\u01F3\\u01F5\\u01F9\\u01FB\\u01FD\\u01FF\\u0201\\u0203\\u0205\\u0207\\u0209\\u020B\\u020D\\u020F\\u0211\\u0213\\u0215\\u0217\\u0219\\u021B\\u021D\\u021F\\u0221\\u0223\\u0225\\u0227\\u0229\\u022B\\u022D\\u022F\\u0231\\u0233-\\u0239\\u023C\\u023F\\u0240\\u0242\\u0247\\u0249\\u024B\\u024D\\u024F\\u0371\\u0373\\u0377\\u037B-\\u037D\\u0390\\u03AC-\\u03CE\\u03D0\\u03D1\\u03D5-\\u03D7\\u03D9\\u03DB\\u03DD\\u03DF\\u03E1\\u03E3\\u03E5\\u03E7\\u03E9\\u03EB\\u03ED\\u03EF-\\u03F3\\u03F5\\u03F8\\u03FB\\u03FC\\u0430-\\u045F\\u0461\\u0463\\u0465\\u0467\\u0469\\u046B\\u046D\\u046F\\u0471\\u0473\\u0475\\u0477\\u0479\\u047B\\u047D\\u047F\\u0481\\u048B\\u048D\\u048F\\u0491\\u0493\\u0495\\u0497\\u0499\\u049B\\u049D\\u049F\\u04A1\\u04A3\\u04A5\\u04A7\\u04A9\\u04AB\\u04AD\\u04AF\\u04B1\\u04B3\\u04B5\\u04B7\\u04B9\\u04BB\\u04BD\\u04BF\\u04C2\\u04C4\\u04C6\\u04C8\\u04CA\\u04CC\\u04CE\\u04CF\\u04D1\\u04D3\\u04D5\\u04D7\\u04D9\\u04DB\\u04DD\\u04DF\\u04E1\\u04E3\\u04E5\\u04E7\\u04E9\\u04EB\\u04ED\\u04EF\\u04F1\\u04F3\\u04F5\\u04F7\\u04F9\\u04FB\\u04FD\\u04FF\\u1E01\\u1E03\\u1E05\\u1E07\\u1E09\\u1E0B\\u1E0D\\u1E0F\\u1E11\\u1E13\\u1E15\\u1E17\\u1E19\\u1E1B\\u1E1D\\u1E1F\\u1E21\\u1E23\\u1E25\\u1E27\\u1E29\\u1E2B\\u1E2D\\u1E2F\\u1E31\\u1E33\\u1E35\\u1E37\\u1E39\\u1E3B\\u1E3D\\u1E3F\\u1E41\\u1E43\\u1E45\\u1E47\\u1E49\\u1E4B\\u1E4D\\u1E4F\\u1E51\\u1E53\\u1E55\\u1E57\\u1E59\\u1E5B\\u1E5D\\u1E5F\\u1E61\\u1E63\\u1E65\\u1E67\\u1E69\\u1E6B\\u1E6D\\u1E6F\\u1E71\\u1E73\\u1E75\\u1E77\\u1E79\\u1E7B\\u1E7D\\u1E7F\\u1E81\\u1E83\\u1E85\\u1E87\\u1E89\\u1E8B\\u1E8D\\u1E8F\\u1E91\\u1E93\\u1E95-\\u1E9D\\u1E9F\\u1EA1\\u1EA3\\u1EA5\\u1EA7\\u1EA9\\u1EAB\\u1EAD\\u1EAF\\u1EB1\\u1EB3\\u1EB5\\u1EB7\\u1EB9\\u1EBB\\u1EBD\\u1EBF\\u1EC1\\u1EC3\\u1EC5\\u1EC7\\u1EC9\\u1ECB\\u1ECD\\u1ECF\\u1ED1\\u1ED3\\u1ED5\\u1ED7\\u1ED9\\u1EDB\\u1EDD\\u1EDF\\u1EE1\\u1EE3\\u1EE5\\u1EE7\\u1EE9\\u1EEB\\u1EED\\u1EEF\\u1EF1\\u1EF3\\u1EF5\\u1EF7\\u1EF9\\u1EFB\\u1EFD\\u1EFF\\uFF41-\\uFF5A","L":"A-Za-z\\xAA\\xB5\\xBA\\xC0-\\xD6\\xD8-\\xF6\\xF8-\\u024F\\u0370-\\u0374\\u0376\\u0377\\u037A-\\u037D\\u037F\\u0386\\u0388-\\u038A\\u038C\\u038E-\\u03A1\\u03A3-\\u03F5\\u03F7-\\u0481\\u048A-\\u04FF\\u1E00-\\u1EFF\\uFF21-\\uFF3A\\uFF41-\\uFF5A\\u0531-\\u0556\\u0561-\\u0587\\u05D0-\\u05EA\\u0620-\\u064A\\u066E-\\u06D3\\u0904-\\u0939\\u0E01-\\u0E30\\u10A0-\\u10FF\\u1100-\\u11FF\\u3041-\\u3096\\u30A1-\\u30FA\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uAC00-\\uD7A3","N":"0-9\\xB2\\xB3\\xB9\\xBC-\\xBE\\u0660-\\u0669\\u06F0-\\u06F9\\u07C0-\\u07C9\\u0966-\\u096F\\u09E6-\\u09EF\\u09F4-\\u09F9\\u0A66-\\u0A6F\\u0AE6-\\u0AEF\\u0B66-\\u0B6F\\u0B72-\\u0B77\\u0BE6-\\u0BF2\\u0C66-\\u0C6F\\u0C78-\\u0C7E\\u0CE6-\\u0CEF\\u0D58-\\u0D5E\\u0D66-\\u0D78\\u0DE6-\\u0DEF\\u0E50-\\u0E59\\u0ED0-\\u0ED9\\u0F20-\\u0F33\\u1040-\\u1049\\u1090-\\u1099\\u1369-\\u137C\\u16EE-\\u16F0\\u17E0-\\u17E9\\u17F0-\\u17F9\\u1810-\\u1819\\u1946-\\u194F\\u19D0-\\u19DA\\u1A80-\\u1A89\\u1A90-\\u1A99\\u1B50-\\u1B59\\u1BB0-\\u1BB9\\u1C40-\\u1C49\\u1C50-\\u1C59\\u2070\\u2074-\\u2079\\u2080-\\u2089\\u2150-\\u2182\\u2185-\\u2189\\u2460-\\u249B\\u24EA-\\u24FF\\u2776-\\u2793\\uFF10-\\uFF19","M":"\\u0300-\\u036F\\u0483-\\u0489\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED\\u0900-\\u0903\\u093A-\\u093C\\u093E-\\u094F\\u1AB0-\\u1ADD\\u1AE0-\\u1AEB\\u1DC0-\\u1DFF\\u20D0-\\u20F0\\uFE00-\\uFE0F\\uFE20-\\uFE2F","P":"\\x21-\\x23\\x25-\\x2A\\x2C-\\x2F\\x3A\\x3B\\x3F\\x40\\x5B-\\x5D\\x5F\\x7B\\x7D\\xA1\\xA7\\xAB\\xB6\\xB7\\xBB\\xBF\\u037E\\u0387\\u055A-\\u055F\\u0589\\u058A\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4\\u0609\\u060A\\u060C\\u060D\\u061B\\u061D-\\u061F\\u066A-\\u066D\\u06D4\\u0700-\\u070D\\u07F7-\\u07F9\\u0830-\\u083E\\u085E\\u0964\\u0965\\u0970\\u09FD\\u0A76\\u0AF0\\u0C77\\u0C84\\u0DF4\\u0E4F\\u0E5A\\u0E5B\\u0F04-\\u0F12\\u0F14\\u0F3A-\\u0F3D\\u0F85\\u0FD0-\\u0FD4\\u0FD9\\u0FDA\\u104A-\\u104F\\u10FB\\u1360-\\u1368\\u1400\\u166E\\u169B\\u169C\\u16EB-\\u16ED\\u1735\\u1736\\u17D4-\\u17D6\\u17D8-\\u17DA\\u1800-\\u180A\\u1944\\u1945\\u1A1E\\u1A1F\\u1AA0-\\u1AA6\\u1AA8-\\u1AAD\\u1B4E\\u1B4F\\u1B5A-\\u1B60\\u1B7D-\\u1B7F\\u1BFC-\\u1BFF\\u1C3B-\\u1C3F\\u1C7E\\u1C7F\\u1CC0-\\u1CC7\\u1CD3\\u2010-\\u2027\\u2030-\\u2043\\u2045-\\u2051\\u2053-\\u205E\\u207D\\u207E\\u208D\\u208E\\u2308-\\u230B\\u2329\\u232A\\u2768-\\u2775\\u27C5\\u27C6\\u27E6-\\u27EF\\u2983-\\u2998\\u29D8-\\u29DB\\u29FC\\u29FD\\u2CF9-\\u2CFC\\u2CFE\\u2CFF\\u2D70\\u2E00-\\u2E2E\\u2E30-\\u2E4F\\u2E52-\\u2E5D\\u3001-\\u3003\\u3008-\\u3011\\uFF01-\\uFF03\\uFF05-\\uFF0A\\uFF0C-\\uFF0F\\uFF1A\\uFF1B\\uFF1F\\uFF20\\uFF3B-\\uFF3D\\uFF5B\\uFF5D\\uFF5F-\\uFF65"};
  var PALIAS = {Letter: 'L', Uppercase_Letter: 'Lu', Lowercase_Letter: 'Ll', Number: 'N', Mark: 'M', Punctuation: 'P', Alphabetic: 'L', Uppercase: 'Lu', Lowercase: 'Ll', Nd: 'N', Decimal_Number: 'N'};
  var EXTPIC_CLS = '\\xA9\\xAE\\u203C\\u2049\\u2122\\u2139\\u2194-\\u21AA\\u231A-\\u23FF\\u24C2\\u25AA-\\u25FE\\u2600-\\u27BF\\u2934\\u2935\\u2B05-\\u2B55\\u3030\\u303D\\u3297\\u3299';
  var EXTPIC = '(?:[' + EXTPIC_CLS + ']|\\uD83C[\\uDC00-\\uDFFF]|\\uD83D[\\uDC00-\\uDFFF]|\\uD83E[\\uDC00-\\uDFFF])';

  /** Rescrie proprietăți Unicode \p{…} (și, la cerere, punctul cu steagul s) în ES5. Aruncă SyntaxError pentru ce nu poate rescrie. */
  function rewrite(src, dotAll) {
    var out = '', i = 0, n = src.length, inCls = false, c, nx, j, name, body;
    while (i < n) {
      c = src.charAt(i);
      if (c === '\\') {
        nx = src.charAt(i + 1);
        if ((nx === 'p' || nx === 'P') && src.charAt(i + 2) === '{') {
          j = src.indexOf('}', i + 3);
          if (j < 0) throw new SyntaxError('\\p fără }');
          name = src.slice(i + 3, j).replace(/^(?:General_Category|gc)=/, '');
          name = PALIAS[name] || name;
          if (name === 'Extended_Pictographic' && !inCls && nx === 'p') out += EXTPIC;
          else {
            body = PROPS[name];
            if (!body) throw new SyntaxError('proprietate Unicode neacceptată: ' + name);
            if (inCls) { if (nx === 'P') throw new SyntaxError('\\P în clasă neacceptat'); out += body; } else out += (nx === 'P' ? '[^' : '[') + body + ']';
          }
          i = j + 1; continue;
        }
        out += c + nx; i += 2; continue;
      }
      if (inCls) { if (c === ']') inCls = false; out += c; i++; continue; }
      if (c === '[') { inCls = true; out += c; i++; if (src.charAt(i) === '^') { out += '^'; i++; } continue; }
      if (c === '.' && dotAll) { out += '[\\s\\S]'; i++; continue; }
      out += c; i++;
    }
    return out;
  }
  function mk(src, flags) {   // fără lookbehind: doar proprietăți/dotAll; scoate steagurile necunoscute
    var f = flags.replace(/[dsuv]/g, ''), s = rewrite(src, flags.indexOf('s') >= 0);
    return new RegExp(s, f);
  }
  function skipGroup(s, i) {   // i pe „(” → indexul de după „)” corespunzător
    var depth = 0, inCls = false, c;
    for (; i < s.length; i++) {
      c = s.charAt(i);
      if (c === '\\') { i++; continue; }
      if (inCls) { if (c === ']') inCls = false; continue; }
      if (c === '[') { inCls = true; continue; }
      if (c === '(') depth++; else if (c === ')') { depth--; if (depth === 0) return i + 1; }
    }
    throw new SyntaxError('grup neînchis');
  }
  function splitTop(s) {
    var out = [], depth = 0, inCls = false, st = 0, i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      if (c === '\\') { i++; continue; }
      if (inCls) { if (c === ']') inCls = false; continue; }
      if (c === '[') inCls = true; else if (c === '(') depth++; else if (c === ')') depth--;
      else if (c === '|' && depth === 0) { out.push(s.slice(st, i)); st = i + 1; }
    }
    out.push(s.slice(st));
    return out;
  }
  function peel(b) {
    var lbs = [], m, end;
    while ((m = /^\(\?<([=!])/.exec(b))) { end = skipGroup(b, 0); lbs.push({neg: m[1] === '!', src: b.slice(m[0].length, end - 1)}); b = b.slice(end); }
    return {lbs: lbs, body: b};
  }
  function lbOk(lbs, str, idx) {
    var i, pre, hit;
    for (i = 0; i < lbs.length; i++) {
      pre = lbs[i].win ? str.slice(Math.max(0, idx - lbs[i].win), idx) : str.slice(0, idx);
      hit = lbs[i].re.test(pre);
      if (hit === lbs[i].neg) return false;
    }
    return true;
  }
  /** Emulează un RegExp cu lookbehind la începutul fiecărei alternative de nivel superior (exec/test/replace/split/match/matchAll). */
  function LB(src, flags) {
    var f = flags.replace(/[gyd]/g, ''), dotAll = flags.indexOf('s') >= 0;
    function ro(k, v) { Object.defineProperty(this, k, {value: v, writable: true, configurable: true, enumerable: false}); }
    ro.call(this, 'source', src); ro.call(this, 'flags', flags);
    ro.call(this, 'global', flags.indexOf('g') >= 0); ro.call(this, 'sticky', flags.indexOf('y') >= 0);
    ro.call(this, 'ignoreCase', flags.indexOf('i') >= 0); ro.call(this, 'multiline', flags.indexOf('m') >= 0);
    ro.call(this, 'dotAll', dotAll); ro.call(this, 'unicode', flags.indexOf('u') >= 0); ro.call(this, 'hasIndices', false);
    this.lastIndex = 0;
    this._br = splitTop(src).map(function (b) {
      var p = peel(b);
      if (/\(\?<[=!]/.test(p.body)) throw new SyntaxError('lookbehind neacceptat în această poziție');
      return {re: mk(p.body, f + 'g' + (dotAll ? 's' : '')), lbs: p.lbs.map(function (l) {
        var plain = !/\^|\\b|\\B|\$/.test(l.src);
        return {neg: l.neg, win: plain ? 128 : 0, re: mk('(?:' + l.src + ')(?![\\s\\S])', f.replace('m', '') + (dotAll ? 's' : ''))};
      })};
    });
  }
  LB.prototype = Object.create(w.RegExp.prototype, {constructor: {value: LB, writable: true, configurable: true}});
  LB.prototype._scan = function (str, from) {
    var best = null, bi, br, p, m;
    for (bi = 0; bi < this._br.length; bi++) {
      br = this._br[bi]; p = from;
      while (p <= str.length) {
        br.re.lastIndex = p; m = br.re.exec(str);
        if (!m) break;
        if (lbOk(br.lbs, str, m.index)) { if (!best || m.index < best.index) best = m; break; }
        p = m.index + 1;
      }
    }
    return best;
  };
  LB.prototype.exec = function (str) {
    var useLast = this.global || this.sticky, start = useLast ? this.lastIndex : 0, m;
    str = String(str);
    if (start > str.length) { if (useLast) this.lastIndex = 0; return null; }
    m = this._scan(str, start);
    if (m && this.sticky && m.index !== start) m = null;
    if (!m) { if (useLast) this.lastIndex = 0; return null; }
    if (useLast) this.lastIndex = m.index + m[0].length;
    m.input = str; m.groups = undefined;
    return m;
  };
  LB.prototype.test = function (str) { return this.exec(str) !== null; };
  LB.prototype.toString = function () { return '/' + this.source + '/' + this.flags; };
  LB.prototype._clone = function (flags) { return new LB(this.source, flags === undefined ? this.flags : flags); };
  function expandSub(t, m, pos, str) {
    var caps = m.length - 1;
    return t.replace(/\$(\$|&|`|'|\d\d?)/g, function (x, c) {
      var n;
      if (c === '$') return '$'; if (c === '&') return m[0]; if (c === '`') return str.slice(0, pos); if (c === "'") return str.slice(pos + m[0].length);
      n = parseInt(c, 10);
      if (c.length === 2 && (n < 1 || n > caps)) { n = parseInt(c.charAt(0), 10); return n >= 1 && n <= caps ? (m[n] === undefined ? '' : m[n]) + c.charAt(1) : x; }
      return n >= 1 && n <= caps ? (m[n] === undefined ? '' : m[n]) : x;
    });
  }
  function symReplace(str, rep) {
    var re = this, g = re.global, res = [], m, out = '', next = 0, i, pos, r, args;
    str = String(str);
    if (typeof rep !== 'function') rep = String(rep);
    if (g) re.lastIndex = 0;
    while ((m = re.exec(str))) { res.push(m); if (!g) break; if (m[0] === '') re.lastIndex++; }
    for (i = 0; i < res.length; i++) {
      m = res[i]; pos = m.index;
      if (typeof rep === 'function') { args = [m[0]].concat(Array.prototype.slice.call(m, 1), [pos, str]); r = String(rep.apply(undefined, args)); } else r = expandSub(rep, m, pos, str);
      if (pos >= next) { out += str.slice(next, pos) + r; next = pos + m[0].length; }
    }
    return out + str.slice(next);
  }
  function symMatch(str) {
    var out = [], m;
    str = String(str);
    if (!this.global) return this.exec(str);
    this.lastIndex = 0;
    while ((m = this.exec(str))) { out.push(m[0]); if (m[0] === '') this.lastIndex++; }
    return out.length ? out : null;
  }
  function symSearch(str) { var prev = this.lastIndex, m; this.lastIndex = 0; m = this._scan(String(str), 0); this.lastIndex = prev; return m ? m.index : -1; }
  function symSplit(str, limit) {
    var out = [], p = 0, q = 0, size, m, e, lim = limit === undefined ? MaxU32 : limit >>> 0, i;
    str = String(str); size = str.length;
    if (lim === 0) return out;
    if (size === 0) return this._scan(str, 0) ? out : [str];
    while (q < size) {
      m = this._scan(str, q);
      if (!m || m.index >= size) break;
      e = Math.min(m.index + m[0].length, size);
      if (e === p) { q = m.index + 1; continue; }
      out.push(str.slice(p, m.index)); if (out.length === lim) return out;
      for (i = 1; i < m.length; i++) { out.push(m[i]); if (out.length === lim) return out; }
      p = e; q = p;
    }
    out.push(str.slice(p));
    return out;
  }
  function symMatchAll(str) {
    var c = this._clone(this.flags.indexOf('g') >= 0 ? this.flags : this.flags + 'g'), out = [], m;
    str = String(str);
    while ((m = c.exec(str))) { out.push(m); if (m[0] === '') c.lastIndex++; }
    return out[Symbol.iterator]();
  }
  if (w.Symbol) {
    if (w.Symbol.replace) LB.prototype[w.Symbol.replace] = symReplace;
    if (w.Symbol.match) LB.prototype[w.Symbol.match] = symMatch;
    if (w.Symbol.search) LB.prototype[w.Symbol.search] = symSearch;
    if (w.Symbol.split) LB.prototype[w.Symbol.split] = symSplit;
    if (w.Symbol.matchAll) LB.prototype[w.Symbol.matchAll] = symMatchAll;
  }
  C._LB = LB; C._rewrite = rewrite;
  (function () {
    function probe(s, f) { try { new RegExp(s, f); return true; } catch (e) { return false; } }
    C.has.lookbehind = probe('(?<=a)b', ''); C.has.unicodeProps = probe('\\p{L}', 'u'); C.has.dotAll = probe('a.b', 's'); C.has.hasIndices = probe('a', 'd');
  })();
  /** RegExp construit la rulare. Nativ dacă se poate; altfel rescriere (\p{…}, steagul s), emulare (lookbehind) sau `fb` (rezervă dată de apelant). */
  C.rx = function (src, flags, fb) {
    flags = flags || '';
    try { return new RegExp(src, flags); } catch (e0) { /* încercăm rezerva */ }
    try { return /\(\?<[=!]/.test(src) ? new LB(src, flags) : mk(src, flags); } catch (e1) { if (fb) return fb; throw e1; }
  };
  F.rx = F.rx || C.rx; F.imp = F.imp || C.imp;
})(window, document);
