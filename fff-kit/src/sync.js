/* fff-kit · FFF.sync — sincronizare între dispozitivele tale, fără server și fără cont.
 * Folosește FFF.p2p (WebRTC cu semnalizare manuală, cod QR/text) pentru canal și FFF.bundle.import pentru aplicare,
 * deci primește toate protecțiile importului (chei permise, confirmare, rollback, fără prototip).
 * Protocol: hello{app,manifest} ↔ hello → fiecare parte calculează ce îi lipsește/ce e mai nou la celălalt → want{keys}
 *   → data (bucăți ≤ 40 KiB) → aplicare printr-un bundle cu doar acele chei, după confirmare.
 * Reguli de îmbinare: cheie doar la celălalt → se adoptă; identică (hash) → nimic; diferită → câștigă cea mai recentă
 *   (FFF.mtime), iar la egalitate/necunoscut se păstrează valoarea locală și se numără ca „conflict”.
 * NU se sincronizează: ștergerile; cheile cu nume de secret (api key, token, parolă…), decât cu {secrets:true}.
 * Limite oneste: ceasurile celor două dispozitive trebuie să fie aproximativ corecte; identitatea celuilalt nu e verificată
 *   dincolo de canalul prin care ai transmis codul — de aceea se afișează lista cheilor înainte de aplicare. */
(function () {
  'use strict';
  var F = window.FFF;
  if (!F || F.sync) return;
  var CHUNK = 40 * 1024, MAX_KEYS = 20000, MAX_TOTAL = 32 * 1048576, TIMEOUT = 60000;
  function T(k, v) { return F.t('sync', k, v); }
  function err(code, vars) { var e = new Error(T('err_' + code, vars)); e.code = code; return e; }

  function localData(opt) {
    var b = F.bundle.build(), out = Object.create(null), re = F.bundle.sensitivePattern;
    Object.keys(b.data).forEach(function (k) {
      if (!opt.secrets && re.test(k)) return;
      out[k] = b.data[k];
    });
    return out;
  }
  function hash(v) { return F.sha256(v).then(function (h) { return h.slice(0, 16); }); }
  function manifest(data) {
    var ks = Object.keys(data), m = Object.create(null);
    return Promise.all(ks.map(function (k) {
      return hash(data[k]).then(function (h) { m[k] = {h: h, t: F.mtime ? F.mtime(k) : 0, n: data[k].length}; });
    })).then(function () { return m; });
  }

  /** Planul local: ce cer de la celălalt și câte conflicte nerezolvate rămân. */
  function plan(mine, theirs) {
    var want = [], conflicts = [], same = 0, mineOnly = 0;
    Object.keys(theirs).forEach(function (k) {
      var a = mine[k], b = theirs[k];
      if (!b || typeof b.h !== 'string' || typeof b.n !== 'number') return;
      if (!a) { want.push(k); return; }
      if (a.h === b.h) { same++; return; }
      if (b.t > a.t && b.t > 0) want.push(k);
      else if (a.t > b.t) { /* al meu e mai nou: celălalt îl va cere */ }
      else conflicts.push(k);
    });
    Object.keys(mine).forEach(function (k) { if (!theirs[k]) mineOnly++; });
    return {want: want, conflicts: conflicts, same: same, mineOnly: mineOnly};
  }

  /** Rulează protocolul pe o sesiune p2p deschisă. Rezolvă cu {adopted, conflicts, same, sent}. */
  function run(session, opt) {
    opt = opt || {};
    return new Promise(function (resolve, reject) {
      var data, mine, theirsM = null, planR = null, gotWant = null, rx = Object.create(null), rxTotal = 0;
      var received = Object.create(null), bad = 0, sentN = 0, done = false, timer, ready = false, queue = [], helloT = 0, peerAck = false;
      function fail(e) { if (done) return; done = true; clearTimeout(timer); clearInterval(helloT); off(); reject(e); }
      function ok(r) { if (done) return; done = true; clearTimeout(timer); clearInterval(helloT); off(); resolve(r); }
      var off = session.on('message', function (o) { if (!ready) queue.push(o); else onMsg(o); });
      session.on('close', function () { fail(err('closed')); });
      timer = setTimeout(function () { fail(err('timeout')); }, opt.timeout || TIMEOUT);

      function send(o) { if (!session.send(o)) throw err('send'); }
      function sendData(keys) {
        keys.forEach(function (k) {
          if (typeof data[k] !== 'string') return;
          var v = data[k], n = Math.max(1, Math.ceil(v.length / CHUNK));
          for (var i = 0; i < n; i++) send({_s: 'data', k: k, i: i, n: n, v: v.slice(i * CHUNK, (i + 1) * CHUNK)});
          sentN++;
        });
        send({_s: 'end'});
      }
      function finish() {
        // aplică prin bundle.import (toate verificările kitului)
        var keys = Object.keys(received);
        if (!keys.length) return ok({adopted: 0, conflicts: planR.conflicts.length, same: planR.same, sent: sentN});
        var dd = Object.create(null); keys.forEach(function (k) { dd[k] = received[k]; });
        var a = F.app;
        var env = {format: 'fff-bundle', schema: F.bundle.schema, app: a.slug, version: a.version || '', updated: a.updated || '', exported: new Date().toISOString(), data: dd};
        var file = new File([JSON.stringify(env)], 'sync.fff.json', {type: 'application/json'});
        F.bundle.import(file, {confirm: opt.confirm, reload: opt.reload !== false}).then(function (r) {
          ok({adopted: r && r.cancelled ? 0 : keys.length, cancelled: !!(r && r.cancelled), conflicts: planR.conflicts.length, same: planR.same, sent: sentN});
        }, fail);
      }
      var endMine = false, endTheirs = false;
      function check() { if (endMine && endTheirs && planR && Object.keys(received).length + bad >= planR.want.length) finish(); }

      function onMsg(o) {
        try {
          if (o._s === 'hello') {
            if (o.app !== F.app.slug) return fail(err('app', {got: String(o.app).slice(0, 40), want: F.app.slug}));
            if (o.ack) peerAck = true;
            if (peerAck && theirsM) clearInterval(helloT);
            if (theirsM) return;                                  // hello repetat: deja procesat
            var m = o.m; if (!m || typeof m !== 'object') return fail(err('proto'));
            var ks = Object.keys(m); if (ks.length > MAX_KEYS) return fail(err('proto'));
            theirsM = m; planR = plan(mine, m);
            send({_s: 'want', keys: planR.want});
          } else if (o._s === 'want') {
            if (!Array.isArray(o.keys) || o.keys.length > MAX_KEYS) return fail(err('proto'));
            gotWant = o.keys.filter(function (k) { return typeof k === 'string' && k in data; });
            sendData(gotWant); endMine = true; check();
          } else if (o._s === 'data') {
            if (typeof o.k !== 'string' || typeof o.v !== 'string' || !(o.n >= 1 && o.n <= 1000) || !(o.i >= 0 && o.i < o.n)) return;
            if (!planR || planR.want.indexOf(o.k) < 0) return;        // doar ce am cerut
            var slot = rx[o.k] = rx[o.k] || {n: o.n, parts: []};
            if (slot.n !== o.n) return;
            if (!slot.parts[o.i]) { slot.parts[o.i] = o.v; rxTotal += o.v.length; if (rxTotal > MAX_TOTAL) return fail(err('big')); }
            if (slot.parts.filter(Boolean).length === slot.n) {
              var full = slot.parts.join('');
              // integritate: hash-ul anunțat în manifest
              var exp = theirsM[o.k] && theirsM[o.k].h, kk = o.k;
              hash(full).then(function (h) { if (h === exp) received[kk] = full; else bad++; check(); });
            }
          } else if (o._s === 'end') {
            endTheirs = true; check();
          }
        } catch (e) { fail(e); }
      }
      localDataP().then(function (d) {
        data = d.data; mine = d.m; ready = true;
        // hello se repetă până când celălalt confirmă (ack) că l-a primit: cealaltă parte poate asculta abia mai târziu
        var sendHello = function () { try { send({_s: 'hello', app: F.app.slug, m: mine, ack: !!theirsM}); } catch (e) { fail(e); } };
        sendHello(); helloT = setInterval(sendHello, 400);
        queue.splice(0).forEach(onMsg);
      }).catch(fail);
    });
    function localDataP() { var d = localData(opt); return manifest(d).then(function (m) { return {data: d, m: m}; }); }
  }

  /** Dialog complet: conectare p2p (cod/QR) apoi sincronizare; rezolvă cu rezultatul. */
  function dialog(opt) {
    opt = opt || {};
    if (!F.p2p || !F.p2p.supported()) return Promise.reject(err('nop2p'));
    return new Promise(function (resolve, reject) {
      var d = F.p2p.dialog({
        title: T('title'),
        onOpen: function (session) {
          run(session, opt).then(function (r) { try { d.close(); } catch (e) { /* ignorat */ } resolve(r); },
            function (e) { try { d.close(); } catch (e2) { /* ignorat */ } reject(e); });
        }
      });
      d.promise && d.promise.then(function () { /* închis fără conectare */ }, function () { });
    });
  }

  F.sync = {run: run, dialog: dialog, plan: plan, manifest: manifest, supported: function () { return !!(F.p2p && F.p2p.supported() && F.bundle); }};
})();
