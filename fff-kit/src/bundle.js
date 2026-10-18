/* fff-kit · bundle — export/import/ștergere .fff.json, criptare AES-GCM. Totul local. */
(function () {
  'use strict';
  var F = window.FFF;
  if (!F || F.bundle) return;
  var doc = document;
  var SCHEMA = 1, ITER = 310000, MAX_BYTES = 64 * 1048576, MAX_KEYS = 20000;
  function T(k, v) { return F.t('bundle', k, v); }

  function BErr(code, vars) {
    var e = new Error(T('err_' + code, vars));
    e.name = 'FffBundleError'; e.code = code;
    return e;
  }

  /* ---------- utilitare ---------- */
  function b64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function stamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-'); }
  function subtle() {
    var s = window.crypto && window.crypto.subtle;
    if (!s) throw BErr('nocrypto');
    return s;
  }
  function aad(app) { return new TextEncoder().encode('fff-bundle-enc|' + SCHEMA + '|' + app); }
  function deriveKey(password, salt, iter) {
    var s = subtle();
    return s.importKey('raw', new TextEncoder().encode(String(password).normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return s.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iter}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
      });
  }

  /* ---------- confirmare (dialog propriu, nu window.confirm) ---------- */
  function confirmDlg(message, opt) {
    opt = opt || {};
    return new Promise(function (res) {
      var d = doc.createElement('dialog');
      d.className = 'fff-dlg fff-dlg-sm';
      d.setAttribute('aria-labelledby', 'fff-cf-msg');
      var inner = doc.createElement('div'); inner.className = 'fff-in';
      var p = doc.createElement('p'); p.id = 'fff-cf-msg'; p.className = 'fff-msg'; p.textContent = message;
      var row = doc.createElement('div'); row.className = 'fff-row fff-end';
      var no = doc.createElement('button'); no.type = 'button'; no.className = 'fff-btn'; no.textContent = opt.no || T('no');
      var yes = doc.createElement('button'); yes.type = 'button'; yes.className = 'fff-btn fff-primary' + (opt.danger ? ' fff-danger' : ''); yes.textContent = opt.yes || T('yes');
      row.appendChild(no); row.appendChild(yes); inner.appendChild(p); inner.appendChild(row); d.appendChild(inner);
      var val = false;
      function fin() { try { d.close(); } catch (e) { /* ignorat */ } }
      yes.addEventListener('click', function () { val = true; fin(); });
      no.addEventListener('click', fin);
      d.addEventListener('cancel', function () { val = false; });
      d.addEventListener('close', function () { d.remove(); res(val); });
      (doc.body || doc.documentElement).appendChild(d);
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      no.focus();
    });
  }
  function ask(msg, c, o) {
    if (c === false) return Promise.resolve(true);
    if (typeof c === 'function') return Promise.resolve(c(msg));
    return confirmDlg(msg, o);
  }

  /* ---------- construire ---------- */
  var redactors = [];
  function plain(redact) {
    var keys = F.store.indexKeys(), data = {};
    keys.forEach(function (k) {
      if (k === F.store.indexKey) return;
      var v = F.store.raw.get(k);
      if (typeof v !== 'string') return;
      if (redact) redactors.forEach(function (f) { try { var r = f(k, v); if (typeof r === 'string') v = r; } catch (e) { /* un redactor defect nu oprește exportul, dar nici nu lasă valoarea originală: */ v = ''; } });
      data[k] = v;
    });
    var a = F.app;
    return {format: 'fff-bundle', schema: SCHEMA, app: a.slug, version: a.version || '', updated: a.updated || '', exported: new Date().toISOString(), data: data};
  }

  function encrypt(obj, password) {
    var s = subtle();
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(password, salt, ITER).then(function (key) {
      return s.encrypt({name: 'AES-GCM', iv: iv, additionalData: aad(obj.app)}, key, new TextEncoder().encode(JSON.stringify(obj)));
    }).then(function (ct) {
      return {format: 'fff-bundle-enc', schema: SCHEMA, app: obj.app, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct))};
    });
  }

  function decrypt(env, password) {
    var s = subtle();
    var iter = env.iter;
    if (typeof iter !== 'number' || iter < 100000 || iter > 5000000) throw BErr('format');
    var salt, iv, ct;
    try { salt = unb64(env.salt); iv = unb64(env.iv); ct = unb64(env.ct); } catch (e) { throw BErr('format'); }
    if (iv.length !== 12 || salt.length < 8) throw BErr('format');
    return deriveKey(password, salt, iter).then(function (key) {
      return s.decrypt({name: 'AES-GCM', iv: iv, additionalData: aad(env.app)}, key, ct);
    }).then(function (pt) {
      try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(pt)); } catch (e) { throw BErr('format'); }
    }, function () { throw BErr('bad_password'); });
  }

  function readText(file) {
    if (typeof file === 'string') return Promise.resolve(file);
    if (!file || typeof file.size !== 'number') return Promise.reject(BErr('read'));
    if (file.size > MAX_BYTES) return Promise.reject(BErr('too_big'));
    return (file.text ? file.text() : Promise.reject(new Error('x'))).catch(function () { throw BErr('read'); });
  }
  function parseEnvelope(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { throw BErr('format'); }
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw BErr('format');
    if (o.format !== 'fff-bundle' && o.format !== 'fff-bundle-enc') throw BErr('format');
    if (o.schema !== SCHEMA) throw BErr('schema', {v: String(o.schema)});
    if (typeof o.app !== 'string' || !o.app) throw BErr('format');
    return o;
  }
  function validatePlain(o, slug) {
    if (!o || o.format !== 'fff-bundle' || o.schema !== SCHEMA) throw BErr('format');
    if (o.app !== slug) throw BErr('app', {got: String(o.app), want: slug});
    if (!o.data || typeof o.data !== 'object' || Array.isArray(o.data)) throw BErr('format');
    var keys = Object.keys(o.data);
    if (keys.length > MAX_KEYS) throw BErr('too_big');
    var pfx = F.store.prefix;
    keys.forEach(function (k) {
      if (typeof o.data[k] !== 'string' || !k || k.length > 2000) throw BErr('format');
      if (k === F.store.indexKey) throw BErr('key', {k: k});
      if (k.indexOf('fff.') === 0 && k.indexOf(pfx) !== 0) throw BErr('key', {k: k});
    });
    return keys;
  }

  /* ---------- API ---------- */
  var bundle = F.bundle = {
    schema: SCHEMA,
    iterations: ITER,
    build: function () { return plain(false); },
    /** Înregistrează fn(cheie, valoare) -> valoare curățată (șir); se aplică doar exportului necriptat. */
    redact: function (fn) { if (typeof fn === 'function') redactors.push(fn); },
    confirm: confirmDlg,

    /** Descarcă un .fff.json. Cu {encrypt:true, password} produce varianta criptată. */
    export: function (opt) {
      opt = opt || {};
      return Promise.resolve().then(function () {
        var obj = plain(!opt.encrypt && !opt.secrets);   // exportul necriptat trece prin redactori (secrete scoase); cel criptat sau {secrets:true} e complet
        var n = Object.keys(obj.data).length;
        if (opt.encrypt) {
          if (typeof opt.password !== 'string' || opt.password.length < 8) throw BErr('pw_short');
          return encrypt(obj, opt.password).then(function (env) { return {payload: env, n: n, enc: true}; });
        }
        return {payload: obj, n: n, enc: false};
      }).then(function (r) {
        var name = opt.filename || (F.app.slug + '-' + stamp() + (r.enc ? '.enc' : '') + '.fff.json');
        var text = JSON.stringify(r.payload, null, 1);
        var size = F.download(name, text, 'application/json');
        F.bus.emit('bundle:exported', {filename: name, keys: r.n, encrypted: r.enc});
        return {filename: name, size: size, keys: r.n, encrypted: r.enc};
      });
    },

    /** Citește antetul fără a scrie nimic: {encrypted, app, version, exported, keys?} */
    inspect: function (file, opt) {
      opt = opt || {};
      return readText(file).then(function (t) {
        var o = parseEnvelope(t);
        if (o.format === 'fff-bundle-enc') {
          if (opt.password == null) return {encrypted: true, app: o.app};
          return decrypt(o, opt.password).then(function (p) {
            if (p.app !== o.app) throw BErr('format');
            return {encrypted: true, app: p.app, version: p.version, exported: p.exported, keys: p.data ? Object.keys(p.data).length : 0};
          });
        }
        return {encrypted: false, app: o.app, version: o.version, exported: o.exported, keys: o.data ? Object.keys(o.data).length : 0};
      });
    },

    /** Importă (îmbină) cheile din bundle. Cere confirmare; reîncarcă pagina dacă reload !== false și confirm !== false. */
    import: function (file, opt) {
      opt = opt || {};
      var slug = F.app.slug;
      var fname = (file && file.name) || '.fff.json';
      return readText(file).then(function (t) {
        var o = parseEnvelope(t);
        if (o.app !== slug) throw BErr('app', {got: o.app, want: slug});
        if (o.format === 'fff-bundle-enc') {
          if (opt.password == null || opt.password === '') throw BErr('password_required', {file: fname});
          return decrypt(o, opt.password).then(function (p) {
            if (p.app !== o.app) throw BErr('format');
            return p;
          });
        }
        return o;
      }).then(function (o) {
        var keys = validatePlain(o, slug);
        return ask(T('confirm_import', {n: keys.length, app: slug, ver: o.version || '?', date: (o.exported || '').slice(0, 10) || '?'}), opt.confirm)
          .then(function (ok) {
            if (!ok) return {keys: 0, cancelled: true};
            var undo = {};
            try {
              keys.forEach(function (k) {
                if (!(k in undo)) undo[k] = F.store.raw.get(k);
                F.store.raw.set(k, o.data[k]);
                if (k.indexOf('fff.') !== 0) F.store.remember(k);
              });
            } catch (e) {
              Object.keys(undo).forEach(function (k) { try { if (undo[k] == null) F.store.raw.remove(k); else F.store.raw.set(k, undo[k]); } catch (e2) { /* ignorat */ } });
              throw BErr('quota');
            }
            F.bus.emit('bundle:imported', {keys: keys.length, file: fname});
            if (opt.reload === true) setTimeout(function () { location.reload(); }, opt.delay == null ? 900 : opt.delay);
            return {keys: keys.length, cancelled: false};
          });
      });
    },

    /** Șterge DOAR cheile indexate ale aplicației (și cele fff.<slug>.*). */
    wipe: function (opt) {
      opt = opt || {};
      var keys = F.store.indexKeys();
      if (!keys.length) return Promise.resolve({keys: 0, cancelled: false});
      return ask(T('confirm_wipe', {n: keys.length}), opt.confirm, {danger: true, yes: T('wipe_yes')}).then(function (ok) {
        if (!ok) return {keys: 0, cancelled: true};
        keys.forEach(function (k) { try { F.store.raw.remove(k); } catch (e) { /* ignorat */ } F.store.forget(k); });
        try { F.store.raw.remove(F.store.indexKey); } catch (e) { /* ignorat */ }
        F.bus.emit('bundle:wiped', {keys: keys.length});
        if (opt.reload === true) setTimeout(function () { location.reload(); }, opt.delay == null ? 900 : opt.delay);
        return {keys: keys.length, cancelled: false};
      });
    }
  };
})();
