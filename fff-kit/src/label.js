/* fff-kit · label — dialogul „Transparență”: rețea, stocare, permisiuni, fișier + hash, copie de siguranță. */
(function () {
  'use strict';
  var F = window.FFF;
  if (!F || F.label) return;
  var doc = document;
  var DISABLED = F.core && F.core.disabled;
  function T(k, v) { return F.t('label', k, v); }

  var PERM = {
    getUserMedia: 'cam', geolocation: 'geo', RTCPeerConnection: 'rtc', 'navigator.share': 'share', Notification: 'notif',
    speechSynthesis: 'tts', SpeechRecognition: 'stt', clipboard: 'clip', serviceWorker: 'sw', indexedDB: 'idb',
    localStorage: 'ls', 'Web Crypto': 'crypto', WebGL: 'webgl', WebGPU: 'webgpu', Worker: 'worker', BroadcastChannel: 'bc'
  };
  var SHELL = "LC_ALL=C sed -E 's/data-fff-hash=\"[0-9a-f]*\"/data-fff-hash=\"\"/g; s/\"sha256\":\"[0-9a-f]*\"/\"sha256\":\"\"/g' index.html | sha256sum";

  /* ---------- info ---------- */
  var infoCache;
  function info() {
    if (infoCache) return infoCache;
    var el = doc.getElementById('fff-info'), o = null;
    if (el) { try { o = JSON.parse(el.textContent || '{}'); } catch (e) { o = null; } }
    infoCache = o || {};
    infoCache._present = !!o;
    return infoCache;
  }

  /* ---------- DOM mic ---------- */
  function h(tag, attrs) {
    var e = doc.createElement(tag);
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) {
      if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
    }
    return e;
  }
  function btn(text, cls, fn) {
    var b = h('button', {type: 'button', class: 'fff-btn' + (cls ? ' ' + cls : ''), text: text});
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  var uid = 0;
  function field(label, type, ac) {
    var id = 'fff-f' + (++uid);
    var i = h('input', {id: id, type: type, class: 'fff-input', autocomplete: ac || 'off'});
    return {wrap: h('div', {class: 'fff-field'}, h('label', {for: id, text: label}), i), input: i};
  }

  /* ---------- tema gazdei ---------- */
  function hostDark() {
    function rgba(el) {
      var m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(el).backgroundColor || '');
      if (!m) return null;
      var p = m[1].split(/[ ,\/]+/).map(parseFloat);
      if (p.length > 3 && p[3] === 0) return null;
      return p;
    }
    var p = (doc.body && rgba(doc.body)) || rgba(doc.documentElement);
    if (!p) return null;
    function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return (0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2])) < 0.18;
  }

  /* ---------- hash canonic ---------- */
  function canonBytes(buf) {
    var u = new Uint8Array(buf), s = '';
    for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    s = s.replace(/data-fff-hash="[0-9a-f]*"/g, 'data-fff-hash=' + '"' + '"').replace(/"sha256":"[0-9a-f]*"/g, '"sha256":' + '"' + '"');
    var out = new Uint8Array(s.length);
    for (var j = 0; j < s.length; j++) out[j] = s.charCodeAt(j);
    return out;
  }
  function declaredHash() {
    var a = doc.documentElement.getAttribute('data-fff-hash');
    return /^[0-9a-f]{64}$/.test(a || '') ? a : (/^[0-9a-f]{64}$/.test(info().sha256 || '') ? info().sha256 : '');
  }

  /* ---------- dialog ---------- */
  var dlg = null, timer = 0, lastFocus = null;

  function section(id, title) {
    var hid = 'fff-h-' + id;
    var sec = h('section', {class: 'fff-sec', 'aria-labelledby': hid}, h('h3', {id: hid, text: title}));
    return sec;
  }

  function storageRows(tbody, sum) {
    var keys = F.store.indexKeys(), rows = [], total = 0;
    var enc = new TextEncoder();
    keys.forEach(function (k) {
      var v = F.store.raw.get(k) || '';
      var n = enc.encode(k).length + enc.encode(v).length;
      total += n; rows.push([k, n]);
    });
    rows.sort(function (a, b) { return b[1] - a[1]; });
    var sig = rows.length + ':' + total;
    if (tbody._sig === sig) return;
    tbody._sig = sig;
    tbody.textContent = '';
    rows.slice(0, 25).forEach(function (r) {
      tbody.appendChild(h('tr', null, h('td', {class: 'fff-mono', text: r[0]}), h('td', {class: 'fff-num', text: F.fmtBytes(r[1])})));
    });
    if (rows.length > 25) tbody.appendChild(h('tr', null, h('td', {colspan: '2', text: T('store_more', {n: rows.length - 25})})));
    sum.textContent = rows.length ? T('store_sum', {n: rows.length, size: F.fmtBytes(total)}) : T('store_none');
    tbody.parentNode.hidden = !rows.length;
  }

  function build() {
    var I = info(), a = F.app;
    var name = I.name || a.name, ver = I.version || a.version, upd = I.updated || a.updated;
    var d = h('dialog', {class: 'fff-dlg', 'aria-labelledby': 'fff-lbl-title', lang: F.lang()});
    var dark = hostDark();
    if (dark === true) d.classList.add('fff-dark'); else if (dark === false) d.classList.add('fff-light');
    var inner = h('div', {class: 'fff-in'});
    var closeB = btn('×', 'fff-x', function () { api.close(); });
    closeB.setAttribute('aria-label', T('close'));
    inner.appendChild(h('div', {class: 'fff-hd'}, h('h2', {id: 'fff-lbl-title', text: T('title')}), closeB));
    inner.appendChild(h('p', {class: 'fff-lead'}, h('strong', {text: name}), ' ', h('span', {class: 'fff-mut', text: 'v ' + (ver || '?') + (upd ? ' · ' + upd : '')})));
    if (I.description) inner.appendChild(h('p', {class: 'fff-mut', text: I.description}));
    if (DISABLED) inner.appendChild(h('p', {class: 'fff-note', role: 'note', text: T('disabled', {reason: DISABLED})}));
    if (I.selfModifying) inner.appendChild(h('p', {class: 'fff-note', role: 'note', text: T('self_mod')}));

    /* Rețea */
    var net = section('net', T('net_h'));
    if (!I._present) net.appendChild(h('p', {class: 'fff-mut', text: T('net_unknown')}));
    else {
      var eg = I.egress || [];
      if (!eg.length) net.appendChild(h('p', null, h('strong', {text: T('net_none')})));
      else {
        net.appendChild(h('p', {text: T('net_list')}));
        var ul = h('ul', {class: 'fff-list'});
        eg.forEach(function (e) {
          var host = typeof e === 'string' ? e : e.host, via = typeof e === 'string' ? '' : (e.via || []).join(', ');
          ul.appendChild(h('li', null, h('span', {class: 'fff-mono', text: host}), via ? h('span', {class: 'fff-mut', text: ' — ' + via}) : null));
        });
        net.appendChild(ul);
      }
      if (I.egressNote) net.appendChild(h('p', {class: 'fff-mut', text: I.egressNote}));
      net.appendChild(h('p', {class: 'fff-mut fff-sm', text: T('net_note')}));
    }
    inner.appendChild(net);

    /* Stocare */
    var st = section('store', T('store_h'));
    var sum = h('p', {role: 'status'});
    var tb = h('tbody');
    var tbl = h('table', {class: 'fff-tbl'}, h('caption', {class: 'fff-sr', text: T('store_h')}),
      h('thead', null, h('tr', null, h('th', {scope: 'col', text: T('store_key')}), h('th', {scope: 'col', class: 'fff-num', text: T('store_size')}))), tb);
    st.appendChild(sum); st.appendChild(tbl);
    if ((I.permissions || []).indexOf('indexedDB') >= 0) st.appendChild(h('p', {class: 'fff-mut fff-sm', text: T('store_idb')}));
    st.appendChild(h('p', {class: 'fff-mut fff-sm', text: T('store_note')}));
    inner.appendChild(st);
    storageRows(tb, sum);
    d._tick = function () { storageRows(tb, sum); };

    /* Permisiuni */
    var pm = section('perm', T('perm_h'));
    if (!I._present) pm.appendChild(h('p', {class: 'fff-mut', text: T('net_unknown')}));
    else {
      var ps = I.permissions || [];
      if (!ps.length) pm.appendChild(h('p', {text: T('perm_none')}));
      else {
        var pl = h('ul', {class: 'fff-list fff-cols'});
        ps.forEach(function (p) { pl.appendChild(h('li', {text: PERM[p] ? T('perm_' + PERM[p]) : p})); });
        pm.appendChild(pl);
      }
      pm.appendChild(h('p', {class: 'fff-mut fff-sm', text: T('perm_note')}));
    }
    inner.appendChild(pm);

    /* Fișier */
    var fl = section('file', T('file_h'));
    var dh = declaredHash();
    if (I.sizeBytes) fl.appendChild(h('p', {text: T('file_size', {size: F.fmtBytes(I.sizeBytes)})}));
    if (dh) {
      fl.appendChild(h('p', {class: 'fff-sm'}, T('file_hash') + ' ', h('code', {class: 'fff-mono fff-break', text: dh})));
      var res = h('p', {role: 'status', class: 'fff-res'});
      var vb = btn(T('verify_btn'), '', function () {
        res.className = 'fff-res'; res.textContent = '';
        F.pickFile('.html,.htm,text/html').then(function (f) {
          if (!f) return null;
          return f.arrayBuffer().then(function (buf) { return F.sha256(canonBytes(buf)); }).then(function (got) {
            if (got === dh) { res.className = 'fff-res fff-ok'; res.textContent = '✔ ' + T('verify_ok'); }
            else { res.className = 'fff-res fff-bad'; res.textContent = '✖ ' + T('verify_bad', {got: got}); }
          });
        }).catch(function () { res.className = 'fff-res fff-bad'; res.textContent = T('verify_err'); });
      });
      fl.appendChild(h('p', null, vb));
      fl.appendChild(res);
      fl.appendChild(h('details', {class: 'fff-det'}, h('summary', {text: T('file_how_h')}),
        h('p', {class: 'fff-sm', text: T('file_how')}), h('pre', {class: 'fff-pre fff-mono', tabindex: '0', 'aria-label': T('verify_cmd'), text: SHELL})));
    } else fl.appendChild(h('p', {class: 'fff-mut', text: T('file_nohash')}));
    inner.appendChild(fl);

    /* Copie de siguranță */
    if (F.bundle && !DISABLED) inner.appendChild(backup());

    /* Kit + instalare */
    var foot = h('div', {class: 'fff-foot'});
    var mods = (I.kit && I.kit.modules) || F.core.modules();
    foot.appendChild(h('p', {class: 'fff-mut fff-sm', text: T('kit_line', {v: F.version, mods: mods.join(', ') || 'core'})}));
    if (F.core.installEvent) {
      var ib = btn(T('install'), 'fff-primary', function () {
        var ev = F.core.installEvent;
        if (!ev) return;
        ev.prompt(); F.core.installEvent = null; ib.hidden = true;
      });
      foot.appendChild(ib);
    }
    inner.appendChild(foot);

    d.appendChild(inner);
    d.addEventListener('click', function (e) { if (e.target === d) api.close(); });
    d.addEventListener('keydown', function (e) { if (e.key !== 'Escape') e.stopPropagation(); });
    d.addEventListener('keyup', function (e) { e.stopPropagation(); });
    d.addEventListener('keypress', function (e) { e.stopPropagation(); });
    d.addEventListener('close', function () { if (dlg === d) cleanup(); });
    return d;
  }

  function backup() {
    var bk = section('bk', T('bk_h'));
    var status = h('p', {role: 'status', class: 'fff-res'});
    function say(msg, kind) { status.className = 'fff-res' + (kind ? ' fff-' + kind : ''); status.textContent = msg; }
    function fail(e) { say((e && e.message) || String(e), 'bad'); }
    bk.appendChild(h('p', {class: 'fff-mut fff-sm', text: T('bk_hint')}));

    /* export criptat */
    var encRow = h('div', {class: 'fff-box', hidden: ''});
    var pw1 = field(T('bk_pw'), 'password', 'new-password'), pw2 = field(T('bk_pw2'), 'password', 'new-password');
    var goEnc = btn(T('bk_go'), 'fff-primary', function () {
      if (pw1.input.value !== pw2.input.value) return say(T('pw_mismatch'), 'bad');
      F.bundle.export({encrypt: true, password: pw1.input.value}).then(function (r) {
        say(T('ok_export_enc', {file: r.filename, n: r.keys}), 'ok'); pw1.input.value = pw2.input.value = ''; encRow.hidden = true; encBtn.setAttribute('aria-expanded', 'false');
      }).catch(fail);
    });
    encRow.appendChild(pw1.wrap); encRow.appendChild(pw2.wrap); encRow.appendChild(h('div', {class: 'fff-row'}, goEnc));

    /* import */
    var impRow = h('div', {class: 'fff-box', hidden: ''});
    var impPw = field(T('bk_pw_file'), 'password', 'current-password');
    var pending = null;
    var impGo = btn(T('bk_import_go'), 'fff-primary', function () { doImport(pending, impPw.input.value); });
    impRow.appendChild(impPw.wrap); impRow.appendChild(h('div', {class: 'fff-row'}, impGo));
    function doImport(file, pw) {
      F.bundle.import(file, {password: pw, reload: true}).then(function (r) {
        if (r.cancelled) return say(T('cancelled'));
        impRow.hidden = true; impPw.input.value = '';
        say(T('ok_import', {n: r.keys}), 'ok');
      }).catch(function (e) {
        if (e && e.code === 'bad_password') { impRow.hidden = false; impPw.input.focus(); }
        fail(e);
      });
    }

    var expB = btn(T('bk_export'), '', function () {
      F.bundle.export().then(function (r) { say(T('ok_export', {file: r.filename, n: r.keys}), 'ok'); }).catch(fail);
    });
    var encBtn = btn(T('bk_export_enc'), '', function () {
      var open = encRow.hidden;
      encRow.hidden = !open; encBtn.setAttribute('aria-expanded', String(open));
      if (open) pw1.input.focus();
    });
    encBtn.setAttribute('aria-expanded', 'false');
    var impBtn = btn(T('bk_import'), '', function () {
      F.pickFile('.json,application/json').then(function (f) {
        if (!f) return;
        pending = f; impRow.hidden = true;
        return F.bundle.inspect(f).then(function (m) {
          if (m.encrypted) { impRow.hidden = false; impPw.input.focus(); say(T('enter_pw', {file: f.name})); }
          else doImport(f);
        });
      }).catch(fail);
    });
    var wipeB = btn(T('bk_wipe'), 'fff-danger-o', function () {
      F.bundle.wipe({reload: true}).then(function (r) {
        if (r.cancelled) return say(T('cancelled'));
        say(r.keys ? T('ok_wipe', {n: r.keys}) : T('nothing_to_wipe'), 'ok');
      }).catch(fail);
    });
    bk.appendChild(h('div', {class: 'fff-row'}, expB, encBtn, impBtn, wipeB));
    bk.appendChild(encRow); bk.appendChild(impRow); bk.appendChild(status);
    return bk;
  }

  function cleanup() {
    clearInterval(timer); timer = 0;
    if (dlg) { dlg.remove(); dlg = null; }
    if (lastFocus && lastFocus.isConnected && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignorat */ } }
    lastFocus = null;
  }

  var api = F.label = {
    state: 'init',
    open: function () {
      if (dlg) return dlg;
      infoCache = null;
      lastFocus = doc.activeElement;
      dlg = build();
      (doc.body || doc.documentElement).appendChild(dlg);
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      timer = setInterval(function () { if (dlg && dlg._tick) dlg._tick(); }, 1500);
      F.bus.emit('label:open');
      return dlg;
    },
    close: function () {
      if (!dlg) return;
      var d = dlg;
      try { d.close(); } catch (e) { /* ignorat */ }
      if (dlg === d) cleanup();
    },
    isOpen: function () { return !!dlg; },
    canon: canonBytes,
    shellCommand: SHELL
  };

  /* ---------- transformarea #app-version în buton ---------- */
  var fallback = null;
  function rgba(str) {
    var m = /rgba?\(([^)]+)\)/.exec(str || '');
    if (!m) return null;
    var p = m[1].split(/[ ,\/]+/).map(parseFloat);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function lum(c) {
    function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  /** Fundalul efectiv (amestecă straturile semitransparente peste primul fundal opac; implicit alb). */
  function effBg(el) {
    var layers = [], n = el;
    while (n && n.nodeType === 1) {
      var c = rgba(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
      n = n.parentElement;
    }
    var base = layers.length && layers[layers.length - 1][3] >= 1 ? layers.pop() : [255, 255, 255, 1];
    while (layers.length) {
      var t = layers.pop();
      base = [t[0] * t[3] + base[0] * (1 - t[3]), t[1] * t[3] + base[1] * (1 - t[3]), t[2] * t[3] + base[2] * (1 - t[3]), 1];
    }
    return base;
  }
  /** Butonul de rezervă din footer moștenește culoarea gazdei; dacă nu atinge 4,5:1, alege negru/alb. */
  function fitContrast(el) {
    try {
      var fg = rgba(getComputedStyle(el).color), bg = effBg(el);
      if (!fg || ratio(fg, bg) >= 4.6) return;
      el.style.color = ratio([0, 0, 0], bg) >= ratio([255, 255, 255], bg) ? '#000' : '#fff';
    } catch (e) { /* ignorat */ }
  }
  function visibleFooter() {
    var fs = doc.querySelectorAll('footer');
    for (var i = 0; i < fs.length; i++) if (fs[i].getClientRects().length && getComputedStyle(fs[i]).visibility !== 'hidden') return fs[i];
    return null;
  }
  function decorate() {
    var el = doc.getElementById('app-version');
    if (el) {
      if (fallback) { fallback.remove(); fallback = null; }
      if (el.getAttribute('data-fff-label')) { api.state = 'button'; return; }
      if (el.closest('a,button,[role="button"],[role="link"],summary,label,input,select,textarea')) { api.state = 'nested'; return; }
      el.setAttribute('data-fff-label', '1');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-haspopup', 'dialog');
      el.setAttribute('title', T('open_hint'));
      api.state = 'button';
      return;
    }
    if (!fallback && doc.readyState === 'complete') {
      var ft = visibleFooter();
      if (ft) {
        fallback = h('button', {type: 'button', class: 'fff-chip', 'data-fff-chip': '1', 'aria-haspopup': 'dialog', title: T('open_hint'), text: T('title')});
        fallback.addEventListener('click', function () { api.open(); });
        ft.appendChild(fallback);
        fitContrast(fallback);
        api.state = 'footer';
      } else api.state = 'none';
    }
  }
  function onClick(e) {
    var t = e.target && e.target.closest && e.target.closest('#app-version[data-fff-label]');
    if (t) { e.preventDefault(); api.open(); }
  }
  function onKey(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target && e.target.closest && e.target.closest('#app-version[data-fff-label]');
    if (t) { e.preventDefault(); api.open(); }
  }
  function init() {
    // resturi dintr-o copie salvată de aplicație (outerHTML): le curățăm înainte de a le recrea
    [].slice.call(doc.querySelectorAll('dialog.fff-dlg, [data-fff-chip]')).forEach(function (n) { n.remove(); });
    if (DISABLED) { api.state = 'disabled'; return; }
    decorate();
    doc.addEventListener('click', onClick);
    doc.addEventListener('keydown', onKey);
    if (window.MutationObserver) {
      var pend = false;
      new MutationObserver(function () {
        if (pend) return;
        pend = true;
        setTimeout(function () { pend = false; decorate(); }, 200);
      }).observe(doc.body || doc.documentElement, {childList: true, subtree: true});
    }
    window.addEventListener('load', function () { setTimeout(decorate, 800); });
    F.onLang(function () {
      var el = doc.querySelector('#app-version[data-fff-label]');
      if (el) el.setAttribute('title', T('open_hint'));
      if (dlg) { api.close(); api.open(); }
    });
  }
  F.ready(init);
})();
