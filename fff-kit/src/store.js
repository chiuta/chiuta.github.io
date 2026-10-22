/* fff-kit · store — stocare cu prefix de slug: <slug>.<cheie> (JSON sigur, cote/erori prinse, migrare idempotentă a cheilor vechi).
   Extinde FFF.store din core: get/set/remove/keys lucrează acum pe `<slug>.`; datele kitului din `fff.<slug>.*` (srs, tts) rămân citibile (rezervă la citire). */
(function () {
  'use strict';
  var F = window.FFF;
  if (!F || !F.store || !F.core || F.store.migrate) return;
  var S = F.store, SLUG = F.core.slug, PFX = SLUG + '.', LEG = S.prefix;   // LEG = 'fff.<slug>.' (spațiul kitului, din core)
  var old = {get: S.get, set: S.set, remove: S.remove, keys: S.keys, indexKeys: S.indexKeys};
  var mem = Object.create(null);

  function lsOk() { return S.available(); }
  function fail(op, key, e) {
    var q = !!(e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014));
    S.lastError = {op: op, key: key, quota: q, message: String(e && e.message || e)};
    try { F.bus.emit('store:error', S.lastError); } catch (x) { /* ignorat */ }
    return S.lastError;
  }
  function okKey(k) { return k != null && String(k) !== ''; }
  function parse(raw, d) {
    if (raw == null) return d;
    try { return JSON.parse(raw); } catch (e) { return raw; }   // valoare migrată fără JSON (ex. „dark”): se întoarce ca șir
  }

  S.appPrefix = PFX;
  S.lastError = null;

  /** get(cheie, implicit): citește `<slug>.<cheie>`, apoi (rezervă) `fff.<slug>.<cheie>`, apoi memoria (dacă stocarea a fost indisponibilă la scriere). */
  S.get = function (k, d) {
    if (!okKey(k)) return d;
    k = String(k);
    if (lsOk()) {
      try {
        var v = S.raw.get(PFX + k);
        if (v == null) v = S.raw.get(LEG + k);
        if (v != null) return parse(v, d);
      } catch (e) { fail('get', k, e); }
    }
    return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : d;
  };
  /** set(cheie, valoare) → true dacă a ajuns în localStorage; false dacă e înghețat, JSON invalid (circular, BigInt…), cotă depășită sau stocare indisponibilă (valoarea rămâne în memorie). `undefined` = remove. */
  S.set = function (k, v) {
    if (!okKey(k)) return false;
    k = String(k);
    if (S.frozen()) return false;
    if (v === undefined) { S.remove(k); return true; }
    var str;
    try { str = JSON.stringify(v); } catch (e) { fail('set', k, e); return false; }
    if (str === undefined) { fail('set', k, new Error('valoare neserializabilă')); return false; }
    if (lsOk()) {
      try { S.raw.set(PFX + k, str); delete mem[k]; return true; } catch (e) { fail('set', k, e); }
    }
    mem[k] = v;
    return false;
  };
  S.remove = function (k) {
    if (!okKey(k) || S.frozen()) return;
    k = String(k);
    if (lsOk()) { try { S.raw.remove(PFX + k); S.raw.remove(LEG + k); } catch (e) { fail('remove', k, e); } }
    delete mem[k];
  };
  S.has = function (k) {
    if (!okKey(k)) return false;
    try { if (lsOk() && (S.raw.get(PFX + k) != null || S.raw.get(LEG + k) != null)) return true; } catch (e) { /* ignorat */ }
    return Object.prototype.hasOwnProperty.call(mem, String(k));
  };
  S.keys = function () {
    var out = Object.create(null);
    try {
      var ls = window.localStorage;
      for (var i = 0; i < ls.length; i++) {
        var n = ls.key(i);
        if (n && n.indexOf(PFX) === 0 && n !== S.indexKey) out[n.slice(PFX.length)] = 1;
      }
    } catch (e) { /* ignorat */ }
    old.keys.call(S).forEach(function (k) { if (k !== '__keys') out[k] = 1; });
    Object.keys(mem).forEach(function (k) { out[k] = 1; });
    return Object.keys(out).sort();
  };
  /** Cheile cu nume complet ale aplicației: indexate, `<slug>.*` și `fff.<slug>.*`. */
  S.indexKeys = function () {
    var out = Object.create(null);
    old.indexKeys.call(S).forEach(function (k) { out[k] = 1; });
    try {
      var ls = window.localStorage;
      for (var i = 0; i < ls.length; i++) { var n = ls.key(i); if (n && n.indexOf(PFX) === 0) out[n] = 1; }
    } catch (e) { /* ignorat */ }
    return Object.keys(out).sort();
  };
  /** Este `nume` (complet, din localStorage) o cheie a spațiului aplicației? */
  S.owns = function (name) { name = String(name); return name.indexOf(PFX) === 0 || name.indexOf(LEG) === 0; };

  /**
   * migrate({'cheieVeche': 'cheieNouă', 'prefix_*': 'nou.*'}, {wrap, dryRun, dropOld}) → {moved, same, conflicts, missing, errors, frozen}.
   *  - cheia veche = numele brut din localStorage; cheia nouă = relativă la prefix (FFF.store.get('cheieNouă')); dacă începe deja cu `<slug>.` e luată ca atare.
   *  - copiază valoarea EXACTĂ (șirul brut), verifică citirea înapoi, abia apoi șterge cheia veche. Nu suprascrie niciodată o valoare nouă existentă:
   *    dacă ambele există și sunt identice → doar șterge cheia veche; dacă diferă → conflict (rămân ambele; `dropOld:true` șterge totuși cheia veche).
   *  - idempotentă: a doua rulare nu mai găsește nimic de mutat. Un șablon cu `*` (la sfârșit, în ambele chei) mută toate cheile cu acel prefix.
   *  - wrap: 'keep' (implicit; valoarea brută e copiată, iar get() întoarce JSON-ul parsat sau șirul brut) | 'string' (valoarea veche este împachetată ca șir JSON: get() întoarce exact șirul vechi).
   *  - nu face nimic cât timp stocarea e înghețată (restaurare în curs). Emite `store:migrated` pe FFF.bus dacă a mutat ceva. */
  S.migrate = function (map, opt) {
    opt = opt || {};
    var rep = {moved: [], same: [], conflicts: [], missing: [], errors: [], frozen: false};
    if (S.frozen()) { rep.frozen = true; return rep; }
    if (!lsOk() || !map || typeof map !== 'object') { if (map && typeof map === 'object') rep.errors.push({key: '*', message: 'stocare indisponibilă'}); return rep; }
    var ls = window.localStorage, names = [];
    try { for (var i = 0; i < ls.length; i++) names.push(ls.key(i)); } catch (e) { /* ignorat */ }
    var pairs = [];
    Object.keys(map).forEach(function (from) {
      var to = String(map[from]);
      if (from.charAt(from.length - 1) === '*') {
        var fp = from.slice(0, -1), tp = to.charAt(to.length - 1) === '*' ? to.slice(0, -1) : to;
        names.forEach(function (n) { if (n.indexOf(fp) === 0 && n.indexOf('fff.') !== 0) pairs.push([n, tp + n.slice(fp.length)]); });
      } else pairs.push([from, to]);
    });
    pairs.forEach(function (p) {
      var from = p[0], full = p[1].indexOf(PFX) === 0 ? p[1] : PFX + p[1];
      if (!from || from === full || from.indexOf('fff.') === 0 || full === PFX) return;
      try {
        var oldV = S.raw.get(from);
        if (oldV == null) { rep.missing.push(from); return; }
        var cur = S.raw.get(full), val = opt.wrap === 'string' ? JSON.stringify(oldV) : oldV;
        if (cur != null) {
          if (cur === val || cur === oldV) { if (!opt.dryRun) { S.raw.remove(from); S.forget(from); } rep.same.push(from); }
          else if (opt.dropOld) { if (!opt.dryRun) { S.raw.remove(from); S.forget(from); } rep.conflicts.push({key: from, to: full, dropped: true}); }
          else rep.conflicts.push({key: from, to: full});
          return;
        }
        if (opt.dryRun) { rep.moved.push(from); return; }
        S.raw.set(full, val);
        if (S.raw.get(full) !== val) throw new Error('verificarea citirii înapoi a eșuat');
        S.raw.remove(from); S.forget(from);
        rep.moved.push(from);
      } catch (e) { rep.errors.push({key: from, message: fail('migrate', from, e).message, quota: S.lastError.quota}); }
    });
    if (rep.moved.length && !opt.dryRun) { try { F.bus.emit('store:migrated', rep); } catch (e) { /* ignorat */ } }
    return rep;
  };
})();
