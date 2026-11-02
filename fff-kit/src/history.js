/* fff-kit · FFF.history — „mașina timpului” pentru datele aplicației, local (IndexedDB), fără server.
 * Instantanee automate ale cheilor aplicației (fără secrete: api key, token, parolă…) la închiderea paginii și la pornire,
 * cu retenție: ultimele 8 + câte unul pe zi, 14 zile, max. 8 MiB. Restaurarea trece prin FFF.bundle.import (aceleași verificări)
 * și își face, înainte, un instantaneu „înainte de restaurare”, deci orice restaurare poate fi anulată.
 * Limite oneste: ce e în instantanee e în clar în IndexedDB al browserului (ca și localStorage-ul aplicației); ștergerea
 * datelor site-ului șterge și istoricul; ștergerile de chei nu sunt „anulate” de o restaurare parțială (se adaugă/suprascriu chei). */
(function () {
  'use strict';
  var F = window.FFF;
  if (!F || F.history) return;
  var KEEP_LAST = 8, KEEP_DAYS = 14, MAX_BYTES = 8 * 1048576, MIN_GAP = 10 * 60 * 1000, DAY = 86400000;
  function T(k, v) { return F.t('history', k, v); }
  var dbName = 'fffhist.' + (F.app && F.app.slug || 'app');
  var mem = [], dbP = null;

  function db() {
    if (dbP) return dbP;
    dbP = new Promise(function (res) {
      try {
        var rq = indexedDB.open(dbName, 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('s', {keyPath: 'id', autoIncrement: true}); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { res(null); };
        rq.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbP;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      if (!d) return fn(null);
      return new Promise(function (res, rej) {
        var t = d.transaction('s', mode), st = t.objectStore('s'), out;
        try { out = fn(st); } catch (e) { return rej(e); }
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  function all() {
    return db().then(function (d) {
      if (!d) return mem.slice();
      return new Promise(function (res) {
        var r = d.transaction('s', 'readonly').objectStore('s').getAll();
        r.onsuccess = function () { res(r.result || []); };
        r.onerror = function () { res([]); };
      });
    }).then(function (a) { return a.sort(function (x, y) { return y.ts - x.ts; }); });
  }
  function put(rec) {
    return db().then(function (d) {
      if (!d) { rec.id = (mem.length ? mem[mem.length - 1].id : 0) + 1; mem.push(rec); return rec; }
      return new Promise(function (res, rej) {
        var t = d.transaction('s', 'readwrite'), r = t.objectStore('s').add(rec);
        r.onsuccess = function () { rec.id = r.result; };
        t.oncomplete = function () { res(rec); }; t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  function del(ids) {
    if (!ids.length) return Promise.resolve();
    return db().then(function (d) {
      if (!d) { mem = mem.filter(function (r) { return ids.indexOf(r.id) < 0; }); return; }
      return new Promise(function (res) {
        var t = d.transaction('s', 'readwrite'), st = t.objectStore('s');
        ids.forEach(function (i) { st.delete(i); });
        t.oncomplete = res; t.onerror = t.onabort = res;
      });
    });
  }

  function current() {
    var b = F.bundle.build(), out = Object.create(null), re = F.bundle.sensitivePattern;
    Object.keys(b.data).forEach(function (k) { if (!re.test(k)) out[k] = b.data[k]; });
    return out;
  }
  function sig(data) {
    var ks = Object.keys(data).sort(), s = '';
    ks.forEach(function (k) { s += k.length + ':' + k + data[k].length + ':' + data[k]; });
    return F.sha256(s);
  }
  function size(data) { var n = 0; Object.keys(data).forEach(function (k) { n += k.length + data[k].length; }); return n; }

  /** Retenție: ultimele KEEP_LAST + primul din fiecare zi (KEEP_DAYS), apoi plafon de dimensiune (cele mai vechi pleacă primele). */
  function prune() {
    return all().then(function (list) {
      var keep = Object.create(null), now = Date.now(), days = Object.create(null);
      list.forEach(function (r, i) {
        if (i < KEEP_LAST || r.label === 'before-restore' && i < KEEP_LAST + 3) keep[r.id] = 1;
        var dk = Math.floor(r.ts / DAY);
        if (now - r.ts <= KEEP_DAYS * DAY && !days[dk]) { days[dk] = 1; keep[r.id] = 1; }
      });
      var total = 0, drop = [];
      list.forEach(function (r) {   // de la cel mai nou la cel mai vechi
        var keepIt = keep[r.id]; total += r.size || 0;
        if (!keepIt || total > MAX_BYTES && list.indexOf(r) > 0) drop.push(r.id);
      });
      return del(drop);
    });
  }

  /** Face un instantaneu; sare peste dacă datele sunt identice cu ultimul (rezolvă cu null). */
  function snapshot(label, o) {
    o = o || {};
    var data = current();
    if (!Object.keys(data).length) return Promise.resolve(null);
    return Promise.all([sig(data), all()]).then(function (r) {
      var h = r[0], list = r[1];
      if (list.length && list[0].h === h && !o.force) return null;
      if (o.minGap && list.length && Date.now() - list[0].ts < o.minGap) return null;
      return put({ts: Date.now(), label: label || 'auto', h: h, keys: Object.keys(data).length, size: size(data), data: data})
        .then(function (rec) { return prune().then(function () { return rec; }); });
    });
  }

  function list() {
    return all().then(function (a) { return a.map(function (r) { return {id: r.id, ts: r.ts, label: r.label, keys: r.keys, size: r.size}; }); });
  }
  function get(id) { return all().then(function (a) { return a.filter(function (r) { return r.id === id; })[0] || null; }); }

  /** Diferența dintre un instantaneu și starea curentă: ce ar adăuga/schimba o restaurare. */
  function diff(id) {
    return get(id).then(function (r) {
      if (!r) return null;
      var cur = current(), added = [], changed = [], same = 0;
      Object.keys(r.data).forEach(function (k) {
        if (!(k in cur)) added.push(k); else if (cur[k] !== r.data[k]) changed.push(k); else same++;
      });
      var extra = Object.keys(cur).filter(function (k) { return !(k in r.data); });
      return {added: added, changed: changed, same: same, extra: extra, ts: r.ts};
    });
  }

  /** Restaurează (total sau doar `keys`) printr-un plic aplicat de FFF.bundle.import; întâi face instantaneu „before-restore”. */
  function restore(id, o) {
    o = o || {};
    return get(id).then(function (r) {
      if (!r) throw new Error(T('err_missing'));
      var dd = Object.create(null), want = o.keys ? o.keys : Object.keys(r.data);
      want.forEach(function (k) { if (typeof r.data[k] === 'string') dd[k] = r.data[k]; });
      var a = F.app;
      var env = {format: 'fff-bundle', schema: F.bundle.schema, app: a.slug, version: a.version || '', updated: a.updated || '', exported: new Date(r.ts).toISOString(), data: dd};
      return snapshot('before-restore', {force: true}).then(function () {
        return F.bundle.import(new File([JSON.stringify(env)], 'history.fff.json', {type: 'application/json'}), {confirm: o.confirm, reload: o.reload !== false});
      });
    });
  }

  function fmt(ts) {
    try { return new Date(ts).toLocaleString(F.lang(), {dateStyle: 'medium', timeStyle: 'short'}); } catch (e) { return new Date(ts).toISOString().slice(0, 16).replace('T', ' '); }
  }
  /** Dialog: lista instantaneelor; alegerea unuia cere confirmare cu rezumatul diferențelor. */
  function dialog(o) {
    o = o || {};
    return list().then(function (items) {
      if (!items.length) { if (F.dialog) F.dialog.alert(T('empty')); return null; }
      var btns = items.slice(0, 12).map(function (r) {
        var lab = fmt(r.ts) + ' · ' + T('nkeys', {n: r.keys}) + (r.label === 'before-restore' ? ' · ' + T('before_restore') : '');
        return {label: lab, value: r.id};
      });
      btns.push({label: T('cancel'), value: null});
      return F.dialog.choice(T('pick'), btns, {title: T('title')}).then(function (id) {
        if (id == null) return null;
        return diff(id).then(function (d) {
          var msg = T('summary', {date: fmt(d.ts), added: d.added.length, changed: d.changed.length, same: d.same});
          return F.dialog.confirm(msg, {title: T('title'), yes: T('restore')}).then(function (ok) {
            if (!ok) return null;
            return restore(id, {confirm: false, reload: o.reload !== false}).then(function () { return {id: id, diff: d}; });
          });
        });
      });
    });
  }

  /** Șterge tot istoricul (se apelează automat după «Șterge datele aplicației»: instantaneele nu trebuie să supraviețuiască ștergerii). */
  function clear() {
    return db().then(function (d) {
      mem = [];
      if (!d) return;
      return new Promise(function (res) { var t = d.transaction('s', 'readwrite'); t.objectStore('s').clear(); t.oncomplete = res; t.onerror = t.onabort = res; });
    });
  }
  if (F.bus && F.bus.on) F.bus.on('bundle:wiped', function () { autoOn = false; clear(); });

  /* ---------- automat ---------- */
  var autoOn = true;
  function auto() { if (autoOn && F.bundle) snapshot('auto', {minGap: MIN_GAP}).catch(function () { }); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') auto(); });
  window.addEventListener('pagehide', auto);
  setTimeout(function () { if (autoOn && F.bundle) snapshot('start', {minGap: MIN_GAP}).catch(function () { }); }, 3000);

  F.history = {snapshot: snapshot, list: list, get: get, diff: diff, restore: restore, dialog: dialog, prune: prune, clear: clear,
    auto: function (on) { autoOn = on !== false; }, supported: function () { return !!(F.bundle && window.File); },
    _limits: {keepLast: KEEP_LAST, keepDays: KEEP_DAYS, maxBytes: MAX_BYTES}};
})();
