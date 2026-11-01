/* fff-kit · FFF.bridge — plic comun „fff” și „Trimite la…” între aplicații (fără dependențe, fără rețea).
 * Aplicațiile au origini diferite (subdomenii), deci datele circulă prin: (1) link cu fragment #fff=… (nu ajunge la server),
 * (2) fișier .fff.json (descărcare / încărcare / drag-and-drop), (3) clipboard. Compatibil cu connect-src 'none'.
 * Plic: {fff:1, type, src, title, lang, theme, ts, data}. Nimic nu se importă fără acordul utilizatorului (bandă de confirmare).
 * Depinde doar de FFF.core (FFF.t, FFF.registerI18n, FFF.lang). */
(function () {
  'use strict';
  var F = (window.FFF = window.FFF || {});
  var VERSION = 1, MAX_LINK = 24000, MAX_FILE = 8 * 1024 * 1024, PREFIX = 'fff=';
  var TYPES = ['text/markdown', 'text/plain', 'citation/csl', 'table/csv', 'quiz/undava', 'geo/gpx', 'events/ics', 'note/akasha', 'cards/qa', 'link/fff'];
  var registry = [];

  function tr(k, v) { return F.t('bridge', k, v); }

  /* ---------- base64url + compresie opțională ---------- */
  function b64u(bytes) {
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '=';
    var s = atob(str), a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a;
  }
  function pipe(bytes, Ctor, mode) {
    var st = new Blob([bytes]).stream().pipeThrough(new Ctor(mode));
    return new Response(st).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function pack(text) {
    var raw = new TextEncoder().encode(text);
    if (typeof CompressionStream === 'undefined') return Promise.resolve('p.' + b64u(raw));
    return pipe(raw, CompressionStream, 'deflate-raw').then(function (z) { return z.length < raw.length ? 'z.' + b64u(z) : 'p.' + b64u(raw); });
  }
  function unpack(s) {
    var k = s.slice(0, 2), body = unb64u(s.slice(2));
    if (k === 'p.') return Promise.resolve(new TextDecoder().decode(body));
    if (k === 'z.') {
      if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('fff: no-decompress'));
      return pipe(body, DecompressionStream, 'deflate-raw').then(function (u) { return new TextDecoder().decode(u); });
    }
    return Promise.reject(new Error('fff: format'));
  }

  /* ---------- plic ---------- */
  function make(o) {
    if (!o || !o.type || o.data === undefined) throw new Error('fff: type și data sunt obligatorii');
    return { fff: VERSION, type: o.type, src: o.src || '', title: o.title || '', lang: o.lang || F.lang(), theme: o.theme || '', ts: new Date().toISOString(), data: o.data };
  }
  function valid(e) { return !!e && typeof e === 'object' && e.fff === VERSION && typeof e.type === 'string' && 'data' in e; }
  function sanitize(e) {
    return JSON.parse(JSON.stringify(e), function (k, v) { return (k === '__proto__' || k === 'constructor' || k === 'prototype') ? undefined : v; });
  }
  function parse(t) { var e = sanitize(JSON.parse(t)); if (!valid(e)) throw new Error('fff: plic invalid'); return e; }

  /* ---------- 1) link cu fragment ---------- */
  function toLink(env, targetUrl) {
    return pack(JSON.stringify(env)).then(function (p) {
      if (p.length > MAX_LINK) { var e = new Error('fff: prea mare pentru link'); e.code = 'TOO_BIG'; throw e; }
      return String(targetUrl).split('#')[0] + '#' + PREFIX + p;
    });
  }
  function fromHash(hash) {
    hash = (hash || '').replace(/^#/, '');
    var i = hash.indexOf(PREFIX); if (i < 0) return Promise.resolve(null);
    return unpack(hash.slice(i + PREFIX.length).split('&')[0]).then(parse);
  }
  function receiveFromLocation() {
    return fromHash(window.location.hash).then(function (e) {
      if (e && window.history && window.history.replaceState) window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return e;
    });
  }

  /* ---------- 2) fișier ---------- */
  function toFile(env) { return new File([JSON.stringify(env, null, 2)], (env.title || env.type).replace(/[^\w\-]+/g, '_').slice(0, 40) + '.fff.json', { type: 'application/json' }); }
  function download(env) { var f = toFile(env); F.download(f.name, f, 'application/json'); return f.name; }
  function fromFile(file) {
    if (file.size > MAX_FILE) return Promise.reject(new Error('fff: fișier prea mare'));
    return file.text().then(parse);
  }
  function acceptDrop(el, cb) {
    el.addEventListener('dragover', function (ev) { ev.preventDefault(); });
    el.addEventListener('drop', function (ev) {
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (!f || !/\.fff\.json$|\.json$/i.test(f.name)) return;          // alte fișiere: comportamentul aplicației rămâne neschimbat
      ev.preventDefault(); fromFile(f).then(cb, function () { cb(null); });
    });
  }

  /* ---------- 3) clipboard ---------- */
  function toClipboard(env) { return navigator.clipboard.writeText(JSON.stringify(env)); }

  /* ---------- capabilități ---------- */
  function setRegistry(r) { registry = r || []; }
  function targetsFor(env, reg, selfSlug) {
    return (reg || registry).filter(function (a) { return a.slug !== (selfSlug || (F.app && F.app.slug)) && (a.accepts || []).indexOf(env.type) >= 0; });
  }
  function openIn(app, env) {
    return toLink(env, app.url).catch(function (err) { if (err.code === 'TOO_BIG') { download(env); return null; } throw err; });
  }

  /* ---------- UI (fără dialoguri native; stiluri inline, compatibile cu style-src 'unsafe-inline') ---------- */
  function toast(txt) {
    var d = document.createElement('div'); d.setAttribute('role', 'status'); d.textContent = txt;
    d.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;background:#222;color:#fff;padding:10px 16px;border-radius:8px;font:14px system-ui;box-shadow:0 4px 16px #0006';
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3500);
  }
  function btn(txt, fn, css) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.onclick = fn;
    b.style.cssText = 'min-height:44px;min-width:44px;padding:6px 14px;border-radius:6px;border:1px solid #fff8;background:#fff2;color:#fff;font:inherit;cursor:pointer;' + (css || ''); return b;
  }
  function banner(env, onAccept) {
    var d = document.createElement('div'); d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-live', 'assertive');
    d.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483000;background:#1b2a3a;color:#fff;padding:12px 14px;border-radius:10px;font:15px system-ui;display:flex;gap:10px;flex-wrap:wrap;align-items:center;box-shadow:0 4px 20px #0008';
    var m = document.createElement('span'); m.style.flex = '1 1 220px';
    m.textContent = tr('inc', { src: env.src || '?', title: String(env.title || env.type).slice(0, 80) }); d.appendChild(m);
    var ok = btn(tr('ok'), function () { d.remove(); try { var r = onAccept(env); toast(typeof r === 'string' && r ? r : tr('done')); } catch (e) { toast(tr('bad')); } });
    d.appendChild(ok); d.appendChild(btn(tr('no'), function () { d.remove(); }));
    document.body.appendChild(d); try { ok.focus(); } catch (e) {} return d;
  }
  function sendMenu(o) {   // {env, registry, selfSlug, anchor}
    var box = document.createElement('div'); box.setAttribute('role', 'menu');
    box.style.cssText = 'position:absolute;z-index:2147483000;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:8px;padding:6px;min-width:200px;box-shadow:0 4px 16px #0004;font:14px system-ui';
    function item(txt, fn) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.textContent = txt;
      b.style.cssText = 'display:block;width:100%;text-align:left;min-height:44px;padding:6px 8px;border:0;background:none;color:inherit;cursor:pointer;font:inherit';
      b.onclick = function () { fn(); box.remove(); }; box.appendChild(b);
    }
    var ts = targetsFor(o.env, o.registry, o.selfSlug);
    if (!ts.length) { var n = document.createElement('div'); n.textContent = tr('none'); n.style.padding = '6px 8px'; box.appendChild(n); }
    ts.forEach(function (a) {
      item(tr('send') + ' ' + a.name, function () {
        openIn(a, o.env).then(function (u) { if (u) { var l = document.createElement('a'); l.href = u; l.target = '_blank'; l.rel = 'noopener'; document.body.appendChild(l); l.click(); l.remove(); } });
      });
    });
    item(tr('file'), function () { download(o.env); });
    item(tr('copy'), function () { toClipboard(o.env).then(function () { toast(tr('copied')); }); });
    var r = o.anchor.getBoundingClientRect();
    box.style.left = Math.max(4, r.left + window.scrollX) + 'px'; box.style.top = (r.bottom + window.scrollY + 4) + 'px';
    document.body.appendChild(box);
    setTimeout(function () { document.addEventListener('click', function f(ev) { if (!box.contains(ev.target)) { box.remove(); document.removeEventListener('click', f); } }); });
    return box;
  }
  function sendButton(o) {   // {slug, registry, getEnv, className, style, text}
    var b = document.createElement('button'); b.type = 'button'; b.textContent = o.text || tr('btn');
    if (o.className) b.className = o.className; if (o.style) b.style.cssText = o.style;
    b.onclick = function (ev) { ev.stopPropagation(); var env = o.getEnv(); if (env) sendMenu({ env: env, registry: o.registry, selfSlug: o.slug, anchor: b }); };
    return b;
  }
  /* primire: din URL și din drag-and-drop; onReceive(env) importă (sau aruncă), întoarce opțional un text de confirmare */
  function mount(o) {   // {accepts:[tipuri], onReceive}
    function handle(env) {
      if (!env) return;
      if ((o.accepts || []).indexOf(env.type) < 0) { toast(tr('bad')); return; }
      banner(env, o.onReceive);
    }
    function go() {
      receiveFromLocation().then(handle, function () { toast(tr('bad')); });
      acceptDrop(document.body, function (e) { if (e) handle(e); else toast(tr('bad')); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }


  /* ---------- strat universal: orice export de fișier devine "Trimite la…", orice import de fișier primește plicuri ---------- */
  var EXT_TYPE = { gpx: 'geo/gpx', ics: 'events/ics', csv: 'table/csv', tsv: 'table/csv', md: 'text/markdown', markdown: 'text/markdown' };
  var TYPE_EXT = { 'geo/gpx': 'gpx', 'events/ics': 'ics', 'table/csv': 'csv', 'text/markdown': 'md' };
  var TYPE_MIME = { 'geo/gpx': 'application/gpx+xml', 'events/ics': 'text/calendar', 'table/csv': 'text/csv', 'text/markdown': 'text/markdown' };
  var MAX_AUTO = 1024 * 1024;

  function extOf(name) { var m = /\.([a-z0-9]+)$/i.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; }

  function auto(o) {   // {slug, registry, accepts:[tipuri]} — apelat o singură dată
    var blobs = new Map(), pending = null, chip = null;
    registry = o.registry || registry;
    var slug = o.slug || (F.app && F.app.slug);

    /* --- trimitere: observăm exporturile (URL.createObjectURL + clic pe <a download>) --- */
    var origCreate = URL.createObjectURL;
    URL.createObjectURL = function (b) {
      var u = origCreate.apply(URL, arguments);
      try { if (b instanceof Blob && b.size <= MAX_AUTO) { blobs.set(u, b); if (blobs.size > 20) blobs.delete(blobs.keys().next().value); } } catch (e) {}
      return u;
    };
    function seen(a) {
      try {
        if (!a || !a.hasAttribute || !a.hasAttribute('download')) return;
        var name = a.getAttribute('download') || '', ext = extOf(name), type = EXT_TYPE[ext], blob = blobs.get(a.href);
        if (!type || !blob) return;
        if (!targetsFor({ type: type }, registry, slug).length) return;
        blob.text().then(function (txt) {
          offer(make({ type: type, src: (F.app && F.app.name) || slug, title: name.replace(/\.[^.]+$/, ''), data: txt }));
        });
      } catch (e) {}
    }
    var origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { seen(this); return origClick.apply(this, arguments); };
    document.addEventListener('click', function (ev) { var a = ev.target && ev.target.closest && ev.target.closest('a[download]'); if (a) seen(a); }, true);

    function offer(env) {
      if (chip) chip.remove();
      chip = sendButton({ slug: slug, registry: registry, getEnv: function () { return env; }, text: '↗ ' + tr('btn') });
      chip.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483000;min-height:44px;min-width:44px;padding:8px 16px;border-radius:22px;border:1px solid #fff8;background:#1b2a3a;color:#fff;font:15px system-ui;cursor:pointer;box-shadow:0 4px 16px #0006';
      document.body.appendChild(chip);
      var c = chip; setTimeout(function () { if (c.parentNode) c.remove(); }, 12000);
    }

    /* --- primire: prin câmpul de import al aplicației --- */
    function matches(inp, ext) {
      var acc = (inp.getAttribute('accept') || '').toLowerCase();
      return acc.split(',').some(function (p) { p = p.trim(); return p === '.' + ext || (ext === 'csv' && p === 'text/csv') || (ext === 'ics' && p === 'text/calendar') || (ext === 'md' && p === 'text/markdown'); });
    }
    function feed(inp, file) {
      var dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files;
      inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var origInputClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {          // câmpuri create dinamic (FFF.pickFile etc.)
      if (pending && this.type === 'file' && matches(this, pending.ext)) { var f = pending.file; pending = null; feed(this, f); return; }
      return origInputClick.apply(this, arguments);
    };
    function receive(env) {
      var ext = TYPE_EXT[env.type], file = new File([String(env.data)], (env.title || 'import').replace(/[^\w\-]+/g, '_').slice(0, 40) + '.' + ext, { type: TYPE_MIME[env.type] });
      var inps = [].slice.call(document.querySelectorAll('input[type=file]')).filter(function (i) { return matches(i, ext); });
      if (inps.length) { feed(inps[0], file); return ''; }
      pending = { ext: ext, file: file };
      return tr('armed');
    }
    var types = (o.accepts || []).filter(function (t) { return TYPE_EXT[t]; });
    if (types.length) mount({ accepts: types, onReceive: receive });
    return { receive: receive };
  }

  F.bridge = { auto: auto, VERSION: VERSION, TYPES: TYPES, make: make, valid: valid, parse: parse, toLink: toLink, fromHash: fromHash,
    receiveFromLocation: receiveFromLocation, toFile: toFile, download: download, fromFile: fromFile, acceptDrop: acceptDrop,
    toClipboard: toClipboard, setRegistry: setRegistry, targetsFor: targetsFor, openIn: openIn, toast: toast, banner: banner,
    sendMenu: sendMenu, sendButton: sendButton, mount: mount };
})();
