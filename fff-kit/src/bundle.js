/* fff-kit · bundle — export/import/ștergere .fff.json, criptare AES-GCM. Totul local. */
(function () {
  'use strict';
  var F = window.FFF;
  if (!F || F.bundle) return;
  var doc = document;
  var SCHEMA = 1, ITER = 600000, ITER_MIN = 100000, ITER_MAX = 5000000, PW_MIN = 12, MAX_BYTES = 64 * 1048576, MAX_KEYS = 20000;
  var SENSITIVE_RE = /api[-_]?key|token|secret|password|passwd|totp/i;
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
  /** Dialog cu mai multe butoane: [{label, value, primary, danger}] → valoarea aleasă sau null (anulare). Ultimul buton = implicit evidențiat. */
  function choiceDlg(message, buttons) {
    return new Promise(function (res) {
      var d = doc.createElement('dialog');
      d.className = 'fff-dlg fff-dlg-sm';
      d.setAttribute('aria-labelledby', 'fff-cf-msg');
      var inner = doc.createElement('div'); inner.className = 'fff-in';
      var p = doc.createElement('p'); p.id = 'fff-cf-msg'; p.className = 'fff-msg'; p.textContent = message;
      var row = doc.createElement('div'); row.className = 'fff-row fff-end';
      var val = null, first = null;
      function fin() { try { d.close(); } catch (e) { /* ignorat */ } }
      buttons.forEach(function (b) {
        var el = doc.createElement('button'); el.type = 'button'; el.className = 'fff-btn' + (b.primary ? ' fff-primary' : ''); el.textContent = b.label;
        el.addEventListener('click', function () { val = b.value; fin(); });
        row.appendChild(el); if (!first) first = el;
      });
      inner.appendChild(p); inner.appendChild(row); d.appendChild(inner);
      d.addEventListener('cancel', function () { val = null; });
      d.addEventListener('close', function () { d.remove(); res(val); });
      (doc.body || doc.documentElement).appendChild(d);
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      if (first) first.focus();
    });
  }
  /** 0 = slabă (< PW_MIN caractere sau foarte puține caractere distincte), 1 = acceptabilă, 2 = bună. */
  function strength(pw) {
    pw = String(pw == null ? '' : pw);
    if (pw.length < PW_MIN) return 0;
    var uniq = {}, u = 0, i;
    for (i = 0; i < pw.length; i++) if (!uniq[pw.charAt(i)]) { uniq[pw.charAt(i)] = 1; u++; }
    if (u < 5) return 0;
    var cls = (/[a-z]/.test(pw) ? 1 : 0) + (/[A-Z]/.test(pw) ? 1 : 0) + (/[0-9]/.test(pw) ? 1 : 0) + (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
    return (pw.length >= 16 || (cls >= 3 && pw.length >= 14)) ? 2 : 1;
  }
  function strengthLabel(pw) { return T(['pw_weak', 'pw_fair', 'pw_strong'][strength(pw)]); }
  /** Cere o parolă nouă (2 câmpuri, min. PW_MIN caractere, indicator de tărie). Rezolvă cu parola sau null. */
  function passwordDlg() {
    return new Promise(function (res) {
      var d = doc.createElement('dialog');
      d.className = 'fff-dlg fff-dlg-sm';
      d.setAttribute('aria-labelledby', 'fff-pw-h');
      var inner = doc.createElement('div'); inner.className = 'fff-in';
      var hd = doc.createElement('p'); hd.id = 'fff-pw-h'; hd.className = 'fff-msg'; hd.textContent = T('pw_prompt', {n: PW_MIN});
      function fld(id, label) {
        var w = doc.createElement('div'); w.className = 'fff-field';
        var l = doc.createElement('label'); l.setAttribute('for', id); l.textContent = label;
        var i = doc.createElement('input'); i.id = id; i.type = 'password'; i.className = 'fff-input'; i.autocomplete = 'new-password';
        w.appendChild(l); w.appendChild(i); return {w: w, i: i};
      }
      var a = fld('fff-pw-1', T('pw_label', {n: PW_MIN})), b = fld('fff-pw-2', T('pw_label2'));
      var st = doc.createElement('p'); st.setAttribute('role', 'status'); st.className = 'fff-res fff-sm';
      var row = doc.createElement('div'); row.className = 'fff-row fff-end';
      var no = doc.createElement('button'); no.type = 'button'; no.className = 'fff-btn'; no.textContent = T('no');
      var go = doc.createElement('button'); go.type = 'button'; go.className = 'fff-btn fff-primary'; go.textContent = T('pw_go');
      row.appendChild(no); row.appendChild(go);
      inner.appendChild(hd); inner.appendChild(a.w); inner.appendChild(b.w); inner.appendChild(st); inner.appendChild(row); d.appendChild(inner);
      var val = null;
      function fin() { try { d.close(); } catch (e) { /* ignorat */ } }
      a.i.addEventListener('input', function () { st.className = 'fff-res fff-sm'; st.textContent = a.i.value ? strengthLabel(a.i.value) : ''; });
      go.addEventListener('click', function () {
        if (a.i.value.length < PW_MIN) { st.className = 'fff-res fff-sm fff-bad'; st.textContent = T('err_pw_short', {n: PW_MIN}); return; }
        if (a.i.value !== b.i.value) { st.className = 'fff-res fff-sm fff-bad'; st.textContent = T('pw_mismatch'); return; }
        val = a.i.value; fin();
      });
      no.addEventListener('click', fin);
      d.addEventListener('cancel', function () { val = null; });
      d.addEventListener('close', function () { d.remove(); res(val); });
      (doc.body || doc.documentElement).appendChild(d);
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      a.i.focus();
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
    var keys = F.store.indexKeys(), data = Object.create(null);   // fără prototip: chei ca __proto__/constructor/toString sunt chei obișnuite
    keys.forEach(function (k) {
      if (k === F.store.indexKey) return;
      var v = F.store.raw.get(k);
      if (typeof v !== 'string') return;
      if (redact) redactors.forEach(function (f) { try { var r = f(k, v); if (typeof r === 'string') v = r; else v = ''; } catch (e) { /* un redactor defect nu oprește exportul, dar nici nu lasă valoarea originală: */ v = ''; } });
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
    if (typeof iter !== 'number' || !isFinite(iter) || Math.floor(iter) !== iter) throw BErr('iter', {min: ITER_MIN, max: ITER_MAX});
    if (iter < ITER_MIN || iter > ITER_MAX) throw BErr('iter', {min: ITER_MIN, max: ITER_MAX});
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

  /* ---------- chei permise la import ---------- */
  var allowed = [];
  function declaredKeys() {
    var out = allowed.slice();
    try {
      var el = doc.getElementById('fff-info');
      if (el) {
        var j = JSON.parse(el.textContent || '{}');
        [j.storageKeys, j.bundleKeys].forEach(function (a) { if (Array.isArray(a)) a.forEach(function (x) { if (typeof x === 'string' && x) out.push(x); }); });
      }
    } catch (e) { /* fff-info absent sau invalid */ }
    return out;
  }
  /** Chei cunoscute: fff.<slug>.*, cheile deja indexate în acest browser, cele declarate (fff-info storageKeys/bundleKeys, bundle.allow);
   *  o declarație care se termină în „*”, „_”, „.”, „:” sau „-” e prefix. Restul sunt „necunoscute” (avertisment la import, nu refuz). */
  function unknownKeys(keys) {
    var decl = declaredKeys(), idx = Object.create(null);
    F.store.indexKeys().forEach(function (k) { idx[k] = 1; });
    var pfx = F.store.prefix;
    return keys.filter(function (k) {
      if (k.indexOf(pfx) === 0 || idx[k] === 1) return false;
      return !decl.some(function (d) {
        if (d.charAt(d.length - 1) === '*') return k.indexOf(d.slice(0, -1)) === 0;
        if (/[_.:-]$/.test(d)) return k.indexOf(d) === 0;
        return d === k;
      });
    });
  }
  function keyList(keys, max) {
    max = max || 8;
    var shown = keys.slice(0, max).map(function (k) { return k.length > 60 ? k.slice(0, 57) + '…' : k; }).join(', ');
    return shown + (keys.length > max ? ' … (+' + (keys.length - max) + ')' : '');
  }
  function sensitiveKeys(obj) {
    var full = plain(false).data;
    return Object.keys(obj.data).filter(function (k) { return SENSITIVE_RE.test(k) && obj.data[k] !== '' && obj.data[k] === full[k]; });
  }

  /* ---------- API ---------- */
  var bundle = F.bundle = {
    schema: SCHEMA,
    iterations: ITER,
    minPassword: PW_MIN,
    passwordStrength: strength,
    sensitivePattern: SENSITIVE_RE,
    /** Declară chei (sau prefixe: „prefix_*”) pe care importul le consideră ale aplicației. */
    allow: function (list) { [].concat(list || []).forEach(function (x) { if (typeof x === 'string' && x) allowed.push(x); }); },
    build: function () { return plain(false); },
    /** Înregistrează fn(cheie, valoare) -> valoare curățată (șir); se aplică doar exportului necriptat. */
    redact: function (fn) { if (typeof fn === 'function') redactors.push(fn); },
    confirm: confirmDlg,

    /** Descarcă un .fff.json. Cu {encrypt:true, password} produce varianta criptată. Exportul necriptat cu chei sensibile
     *  (api key, token, secret, parolă…) cere confirmare și propune criptarea ({confirm:false} sau {sensitive:false} o omit). */
    export: function (opt) {
      opt = opt || {};
      return Promise.resolve().then(function () {
        var enc = !!opt.encrypt, pw = opt.password;
        var obj = plain(!enc && !opt.secrets);   // exportul necriptat trece prin redactori (secrete scoase); cel criptat sau {secrets:true} e complet
        var step = Promise.resolve();
        if (!enc && opt.confirm !== false && opt.sensitive !== false) {
          var sens = sensitiveKeys(obj);
          if (sens.length) {
            step = choiceDlg(T('sens_msg', {list: keyList(sens)}), [
              {label: T('no'), value: null},
              {label: T('sens_plain'), value: 'plain'},
              {label: T('sens_enc'), value: 'enc', primary: true}
            ]).then(function (c) {
              if (c === null) return {cancelled: true};
              if (c === 'plain') return null;
              enc = true; obj = plain(false);
              if (typeof pw === 'string' && pw.length >= PW_MIN) return null;
              return passwordDlg().then(function (p) { if (p == null) return {cancelled: true}; pw = p; return null; });
            });
          }
        }
        return step.then(function (stop) {
          if (stop && stop.cancelled) return {cancelled: true};
          var n = Object.keys(obj.data).length;
          if (enc) {
            if (typeof pw !== 'string' || pw.length < PW_MIN) throw BErr('pw_short', {n: PW_MIN});
            return encrypt(obj, pw).then(function (env) { return {payload: env, n: n, enc: true}; });
          }
          return {payload: obj, n: n, enc: false};
        });
      }).then(function (r) {
        if (r.cancelled) return {filename: null, size: 0, keys: 0, encrypted: false, cancelled: true};
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
        var unknown = unknownKeys(keys);
        var msg = T('confirm_import', {n: keys.length, app: slug, ver: o.version || '?', date: (o.exported || '').slice(0, 10) || '?'}) +
          '\n\n' + T('import_keys', {list: keyList(keys)}) +
          (unknown.length ? '\n\n' + T('import_unknown', {n: unknown.length, list: keyList(unknown)}) : '');
        return ask(msg, opt.confirm)
          .then(function (ok) {
            if (!ok) return {keys: 0, cancelled: true};
            var undo = new Map();   // Map: numele cheilor din Object.prototype (constructor, toString, __proto__) nu mai sunt „deja prezente”
            try {
              keys.forEach(function (k) {
                if (!undo.has(k)) undo.set(k, F.store.raw.get(k));
                F.store.raw.set(k, o.data[k]);
                if (k.indexOf('fff.') !== 0) F.store.remember(k);
              });
            } catch (e) {
              undo.forEach(function (v, k) { try { if (v == null) F.store.raw.remove(k); else F.store.raw.set(k, v); } catch (e2) { /* ignorat */ } });
              throw BErr('quota');
            }
            if (opt.reload === true) F.store.freeze();   // înainte de reload: handlerele pagehide/beforeunload ale aplicației nu mai pot suprascrie importul
            F.bus.emit('bundle:imported', {keys: keys.length, file: fname, unknown: unknown});
            if (opt.reload === true) setTimeout(function () { location.reload(); }, opt.delay == null ? 900 : opt.delay);
            return {keys: keys.length, cancelled: false, unknown: unknown};
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
        if (opt.reload === true) F.store.freeze();
        F.bus.emit('bundle:wiped', {keys: keys.length});
        if (opt.reload === true) setTimeout(function () { location.reload(); }, opt.delay == null ? 900 : opt.delay);
        return {keys: keys.length, cancelled: false};
      });
    }
  };
})();
