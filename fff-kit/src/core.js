/* fff-kit · core · v1.1.2 — fără rețea, fără dependențe. Definește window.FFF. */
(function () {
  'use strict';
  /* anti-clickjacking: GitHub Pages nu trimite X-Frame-Options; dacă pagina e încadrată de o origine străină, o ascundem. */
  try {
    if (window.top !== window.self) {
      var __cross = false;
      try { void window.top.location.href; } catch (e) { __cross = true; }
      if (__cross) {
        document.documentElement.style.display = 'none';
        try { window.top.location = window.self.location.href; } catch (e2) {}
      }
    }
  } catch (e3) {}
  var KIT_VERSION = '1.1.2';
  var F = (window.FFF = window.FFF || {});
  if (F.core && F.core.version) return; // idempotent la dublă încărcare
  var SUP = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de'];
  var doc = document;

  /* ---------- meta / app ---------- */
  function meta(name) {
    var m = doc.querySelector('meta[name="' + name + '"]');
    return m ? (m.getAttribute('content') || '') : '';
  }
  function guessSlug() {
    var p = (location.pathname || '').split('/').filter(Boolean);
    var s = p.length ? p[p.length - 1] : '';
    if (/\.html?$/i.test(s)) s = p.length > 1 ? p[p.length - 2] : '';
    s = s.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'app';
  }
  var SLUG = (meta('fff-app') || '').trim() || guessSlug();
  var DISABLED = (meta('fff-disable') || '').trim() || '';
  function computeApp() {
    return {slug: SLUG, name: doc.title || SLUG, version: meta('application-version'), updated: meta('last-updated')};
  }
  var appCache = null;
  Object.defineProperty(F, 'app', {
    enumerable: true, configurable: true,
    get: function () {
      if (doc.readyState === 'loading') return computeApp();
      return appCache || (appCache = computeApp());
    }
  });

  /* ---------- bus ---------- */
  var L = {};
  var bus = {
    on: function (ev, fn) { (L[ev] = L[ev] || []).push(fn); return function () { bus.off(ev, fn); }; },
    off: function (ev, fn) { if (L[ev]) L[ev] = L[ev].filter(function (f) { return f !== fn; }); },
    once: function (ev, fn) { var off = bus.on(ev, function (d) { off(); fn(d); }); return off; },
    emit: function (ev, data) {
      (L[ev] || []).slice().forEach(function (f) { try { f(data); } catch (e) { if (window.console) console.error('[fff] bus', ev, e); } });
    }
  };
  F.bus = bus;

  /* ---------- i18n ---------- */
  var I18N = (F._i18n = F._i18n || {});
  var i18nLoaded = false;
  function mergeLang(mod, obj) {
    var d = (I18N[mod] = I18N[mod] || {});
    for (var l in obj) if (Object.prototype.hasOwnProperty.call(obj, l)) {
      d[l] = Object.assign(d[l] || {}, obj[l]);
    }
  }
  function loadI18nJson() {
    var el = doc.getElementById('fff-i18n');
    if (!el) return;
    i18nLoaded = true;
    try {
      var j = JSON.parse(el.textContent || '{}');
      for (var m in j) if (Object.prototype.hasOwnProperty.call(j, m)) mergeLang(m, j[m]);
    } catch (e) { if (window.console) console.error('[fff] i18n', e); }
  }
  F.registerI18n = function (mod, obj) { mergeLang(mod, obj || {}); };
  function lsGetRaw(k) { try { return LS ? origGet.call(LS, k) : null; } catch (e) { return null; } }

  var LS = null;
  try { LS = window.localStorage; } catch (e) { LS = null; }
  var P = window.Storage ? window.Storage.prototype : null;
  var origGet = P && P.getItem, origSet = P && P.setItem, origRem = P && P.removeItem, origClr = P && P.clear;

  F.lang = function () {
    var l = (doc.documentElement.getAttribute('lang') || '').slice(0, 2).toLowerCase();
    if (SUP.indexOf(l) >= 0) return l;
    var ks = ['lang', 'language', 'locale'];
    for (var i = 0; i < ks.length; i++) {
      var v = lsGetRaw(ks[i]);
      if (v) { v = String(v).replace(/^"|"$/g, '').slice(0, 2).toLowerCase(); if (SUP.indexOf(v) >= 0) return v; }
    }
    var n = ((navigator.languages && navigator.languages[0]) || navigator.language || '').slice(0, 2).toLowerCase();
    return SUP.indexOf(n) >= 0 ? n : 'en';
  };
  var langObs = null, langFns = [];
  F.onLang = function (fn) {
    langFns.push(fn);
    if (!langObs && window.MutationObserver) {
      var last = F.lang();
      langObs = new MutationObserver(function () {
        var now = F.lang();
        if (now === last) return;
        last = now;
        langFns.slice().forEach(function (f) { try { f(now); } catch (e) { if (window.console) console.error(e); } });
        bus.emit('lang', now);
      });
      langObs.observe(doc.documentElement, {attributes: true, attributeFilter: ['lang']});
    }
    return function () { langFns = langFns.filter(function (f) { return f !== fn; }); };
  };
  F.t = function (mod, key, vars) {
    if (!i18nLoaded) loadI18nJson();
    var d = I18N[mod] || {};
    var s = (d[F.lang()] || {})[key];
    if (s == null) s = (d.en || {})[key];
    if (s == null) s = (d.ro || {})[key];
    if (s == null) s = key;
    if (vars) for (var k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) s = String(s).split('{' + k + '}').join(String(vars[k]));
    return s;
  };

  /* ---------- observator de stocare ---------- */
  var INDEX_KEY = 'fff.' + SLUG + '.__keys';
  var PFX = 'fff.' + SLUG + '.';
  var idx = null; // Set de chei ale aplicației (fără prefix fff.)
  function loadIdx() {
    if (idx) return idx;
    idx = new Set();
    try {
      var raw = origGet && LS ? origGet.call(LS, INDEX_KEY) : null;
      if (raw) JSON.parse(raw).forEach(function (k) { if (typeof k === 'string') idx.add(k); });
    } catch (e) { /* index corupt: se reface */ }
    return idx;
  }
  function saveIdx() {
    try { if (LS && origSet) origSet.call(LS, INDEX_KEY, JSON.stringify(Array.from(idx).sort())); } catch (e) { /* plin: ignorat */ }
  }
  function track(k) {
    k = String(k);
    if (k.indexOf('fff.') === 0) return;
    var s = loadIdx();
    if (!s.has(k)) { s.add(k); saveIdx(); }
  }
  function untrack(k) {
    k = String(k);
    var s = loadIdx();
    if (s.delete(k)) saveIdx();
  }
  var observing = false;
  if (!DISABLED && LS && P && origGet && origSet && origRem && origClr) {
    try {
      P.getItem = function getItem(k) {
        var v = origGet.apply(this, arguments);
        if (v !== null && this === LS) { try { track(k); } catch (e) { /* nu strica aplicația */ } }
        return v;
      };
      P.setItem = function setItem(k, v) {
        var r = origSet.apply(this, arguments);
        if (this === LS) { try { track(k); } catch (e) { /* idem */ } }
        return r;
      };
      P.removeItem = function removeItem(k) {
        var r = origRem.apply(this, arguments);
        if (this === LS) { try { untrack(k); } catch (e) { /* idem */ } }
        return r;
      };
      P.clear = function clear() {
        var r = origClr.apply(this, arguments);
        if (this === LS) { idx = new Set(); }
        return r;
      };
      observing = true;
    } catch (e) { observing = false; }
  }

  /* ---------- FFF.store ---------- */
  var mem = {};
  function lsOk() { return !!(LS && origGet); }
  var store = {
    get: function (k, d) {
      if (lsOk()) {
        try { var v = origGet.call(LS, PFX + k); if (v == null) return d; return JSON.parse(v); } catch (e) { /* cade în memorie */ }
      }
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : d;
    },
    set: function (k, v) {
      if (lsOk()) {
        try { origSet.call(LS, PFX + k, JSON.stringify(v)); delete mem[k]; return true; } catch (e) { /* memorie */ }
      }
      mem[k] = v; return false;
    },
    remove: function (k) {
      if (lsOk()) { try { origRem.call(LS, PFX + k); } catch (e) { /* ignorat */ } }
      delete mem[k];
    },
    keys: function () {
      var out = [];
      try {
        if (LS) for (var i = 0; i < LS.length; i++) {
          var n = LS.key(i);
          if (n && n.indexOf(PFX) === 0 && n !== INDEX_KEY) out.push(n.slice(PFX.length));
        }
      } catch (e) { /* ignorat */ }
      Object.keys(mem).forEach(function (k) { if (out.indexOf(k) < 0) out.push(k); });
      return out.sort();
    },
    /** Cheile (nume complete din localStorage) care aparțin aplicației: indexate + ale kitului (fff.<slug>.*). */
    indexKeys: function () {
      var out = new Set();
      var present = {};
      try { if (LS) for (var i = 0; i < LS.length; i++) present[LS.key(i)] = 1; } catch (e) { /* ignorat */ }
      loadIdx().forEach(function (k) { if (present[k]) out.add(k); });
      Object.keys(present).forEach(function (n) { if (n.indexOf(PFX) === 0 && n !== INDEX_KEY) out.add(n); });
      return Array.from(out).sort();
    },
    /** Citire/scriere brută pentru modulele kitului (ocolește observatorul). */
    raw: {
      get: function (k) { return lsOk() ? origGet.call(LS, k) : null; },
      set: function (k, v) { if (!lsOk()) throw new Error('no-storage'); origSet.call(LS, k, v); },
      remove: function (k) { if (lsOk()) origRem.call(LS, k); }
    },
    prefix: PFX,
    indexKey: INDEX_KEY,
    forget: function (k) { if (observing) untrack(k); },
    remember: function (k) { if (observing) track(k); },
    available: function () { return lsOk(); },
    observing: function () { return observing; }
  };
  F.store = store;

  /* ---------- sha256 ---------- */
  var K256 = null, H256 = null;
  function frac(x) { return Math.floor((x - Math.floor(x)) * 4294967296) >>> 0; }
  function initConsts() {
    K256 = []; H256 = [];
    for (var n = 2, c = 0; c < 64; n++) {
      var p = true;
      for (var d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; }
      if (p) { if (c < 8) H256.push(frac(Math.sqrt(n))); K256.push(frac(Math.cbrt(n))); c++; }
    }
  }
  function sha256js(bytes) {
    if (!K256) initConsts();
    var l = bytes.length, bl = l * 8;
    var padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    padded.set(bytes); padded[l] = 0x80;
    var dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, Math.floor(bl / 4294967296)); dv.setUint32(padded.length - 4, bl >>> 0);
    var h = H256.slice(), w = new Uint32Array(64);
    function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var o = 0; o < padded.length; o += 64) {
      for (var i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (i = 16; i < 64; i++) {
        var s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d2 = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K256[i] + w[i]) | 0;
        var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d2 + t1) | 0; d2 = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d2) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    return h.map(function (v) { return ('00000000' + (v >>> 0).toString(16)).slice(-8); }).join('');
  }
  function toBytes(x) {
    if (typeof x === 'string') return Promise.resolve(new TextEncoder().encode(x));
    if (x instanceof Uint8Array) return Promise.resolve(x);
    if (x instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(x));
    if (ArrayBuffer.isView(x)) return Promise.resolve(new Uint8Array(x.buffer, x.byteOffset, x.byteLength));
    if (x && typeof x.arrayBuffer === 'function') return x.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return Promise.reject(new TypeError('sha256: tip neacceptat'));
  }
  F.sha256 = function (x) {
    return toBytes(x).then(function (b) {
      var sub = window.crypto && window.crypto.subtle;
      if (sub) {
        return sub.digest('SHA-256', b).then(function (h) {
          return Array.prototype.map.call(new Uint8Array(h), function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
        });
      }
      return sha256js(b);
    });
  };

  /* ---------- download / pickFile ---------- */
  F.download = function (name, data, mime) {
    var blob = data instanceof Blob ? data : new Blob([data], {type: mime || 'application/octet-stream'});
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url; a.download = name; a.hidden = true;
    (doc.body || doc.documentElement).appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 4000);
    return blob.size;
  };
  /** Rezolvă cu File sau null dacă utilizatorul anulează. */
  F.pickFile = function (accept) {
    return new Promise(function (res) {
      var i = doc.createElement('input');
      i.type = 'file'; i.hidden = true;
      if (accept) i.accept = accept;
      var done = false;
      function fin(v) { if (done) return; done = true; i.remove(); res(v); }
      i.addEventListener('change', function () { fin(i.files && i.files[0] ? i.files[0] : null); });
      i.addEventListener('cancel', function () { fin(null); });
      (doc.body || doc.documentElement).appendChild(i);
      i.click();
    });
  };

  /* ---------- instalare PWA (doar reținem evenimentul, nu îl blocăm) ---------- */
  var core = F.core = {
    version: KIT_VERSION,
    slug: SLUG,
    disabled: DISABLED || false,
    installEvent: null,
    modules: function () { return (meta('fff-modules') || '').split(',').filter(Boolean); }
  };
  window.addEventListener('beforeinstallprompt', function (e) { core.installEvent = e; bus.emit('installable', e); });
  window.addEventListener('appinstalled', function () { core.installEvent = null; bus.emit('installed'); });

  F.version = KIT_VERSION;
  F.ready = function (fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { fn(); }, {once: true});
    else fn();
  };
  F.fmtBytes = function (n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  };
})();
