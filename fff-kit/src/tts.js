/* FFF.tts — Web Speech Synthesis cu coadă pe propoziții. Fără rețea: vocile „online” (localService=false)
   sunt excluse implicit, deoarece trimit textul unui server; se pot activa explicit (allowRemote). */
(function () {
  'use strict';
  var F = (window.FFF = window.FFF || {});
  function T(k, v) { return F.t ? F.t('tts', k, v) : k; }
  function synth() { try { return window.speechSynthesis || null; } catch (e) { return null; } }
  function supported() { return !!(synth() && typeof window.SpeechSynthesisUtterance === 'function'); }
  function lget(k, d) { try { return F.store ? F.store.get(k, d) : d; } catch (e) { return d; } }
  function lset(k, v) { try { if (F.store) F.store.set(k, v); } catch (e) { /* ignorat */ } }
  var SOFT_PAUSE = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');   // pause() nesuportat fiabil

  var ABBR = { dr: 1, dl: 1, dna: 1, nr: 1, str: 1, bd: 1, etc: 1, prof: 1, ing: 1, mr: 1, mrs: 1, ms: 1, vs: 1, ex: 1, fig: 1, cca: 1, pag: 1, sc: 1, ap: 1, bl: 1, jud: 1, mun: 1, tel: 1, dnei: 1, dlui: 1, mme: 1, sr: 1, sra: 1 };

  /* Împarte textul în bucăți ≤ max caractere: propoziții -> virgule/„;” -> spații. */
  function split(text, max) {
    max = max || 180;
    text = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/[ \t ]+/g, ' ');
    var out = [], sent = [], i, n = text.length, start = 0;
    function push(a, b) { var s = text.slice(a, b).replace(/\s+/g, ' ').trim(); if (/[\p{L}\p{N}]/u.test(s)) sent.push(s); }
    for (i = 0; i < n; i++) {
      var ch = text[i];
      if (ch === '\n') { push(start, i); start = i + 1; continue; }
      if (ch === '.' || ch === '!' || ch === '?' || ch === '…' || ch === '。' || ch === '！' || ch === '？') {
        var j = i + 1; while (j < n && /[.!?…"”»')\]]/.test(text[j])) j++;
        var cjk = /[。！？]/.test(ch);
        if (j < n && !cjk && !/\s/.test(text[j])) { i = j - 1; continue; }                   // 3.14, e.g.com, U.S.A
        if (ch === '.' && !cjk) {
          var m = /([\p{L}]+)$/u.exec(text.slice(Math.max(0, i - 8), i));
          if (m && ABBR[m[1].toLowerCase()] && j === i + 1) { continue; }                      // abreviere
          var k = j; while (k < n && text[k] === ' ') k++;
          if (k < n && /\p{Ll}/u.test(text[k])) { i = j - 1; continue; }                      // continuă cu literă mică
        }
        push(start, j); start = j; i = j - 1;
      }
    }
    push(start, n);
    sent.forEach(function (s) {
      if (s.length <= max) { out.push(s); return; }
      var parts = s.split(/(?<=[,;:–—])\s+/), cur = '';
      parts.forEach(function (p) {
        if ((cur + ' ' + p).trim().length <= max) { cur = (cur + ' ' + p).trim(); return; }
        if (cur) out.push(cur); cur = '';
        while (p.length > max) {                                                               // fără separatori: taie la ultimul spațiu
          var cut = p.lastIndexOf(' ', max); if (cut < max * 0.4) cut = max;
          out.push(p.slice(0, cut).trim()); p = p.slice(cut).trim();
        }
        cur = p;
      });
      if (cur) out.push(cur);
    });
    return out;
  }

  function tag(l) { return String(l || '').replace('_', '-').toLowerCase(); }
  function base(l) { return tag(l).split('-')[0]; }

  function voices(lang, opts) {
    var s = synth(); if (!s) return [];
    var all = []; try { all = Array.prototype.slice.call(s.getVoices() || []); } catch (e) { return []; }
    var remote = opts && opts.allowRemote;
    var want = lang ? tag(lang) : '', b = base(want);
    var res = all.filter(function (v) {
      if (!remote && v.localService === false) return false;
      return !b || base(v.lang) === b;
    });
    res.sort(function (x, y) {
      var sx = (tag(x.lang) === want ? 0 : 2) + (x.localService === false ? 1 : 0) + (x['default'] ? -0.5 : 0);
      var sy = (tag(y.lang) === want ? 0 : 2) + (y.localService === false ? 1 : 0) + (y['default'] ? -0.5 : 0);
      return sx - sy || String(x.name).localeCompare(String(y.name));
    });
    return res;
  }
  function whenVoices(timeout) {
    return new Promise(function (res) {
      var s = synth(); if (!s) return res([]);
      var got = false;
      function fin() { if (got) return; got = true; try { s.removeEventListener && s.removeEventListener('voiceschanged', fin); } catch (e) { /* */ } res(s.getVoices()); }
      if (s.getVoices().length) return fin();
      try { s.addEventListener && s.addEventListener('voiceschanged', fin); } catch (e) { /* */ }
      setTimeout(fin, timeout == null ? 1500 : timeout);
    });
  }
  function findVoice(v, lang, allowRemote) {
    if (v && typeof v === 'object') return v;
    var s = synth(), all = s ? s.getVoices() : [];
    if (typeof v === 'string' && v) { for (var i = 0; i < all.length; i++) if (all[i].voiceURI === v || all[i].name === v) return all[i]; }
    if (lang) { var saved = lget('tts.voice.' + base(lang), null); if (saved) for (var j = 0; j < all.length; j++) if (all[j].voiceURI === saved && (allowRemote || all[j].localService !== false)) return all[j]; }
    var l = voices(lang, { allowRemote: allowRemote }); return l[0] || null;
  }

  var S = null, rate = Math.min(2, Math.max(0.5, +lget('tts.rate', 1) || 1)), listeners = [];

  function emit(state, extra) { var d = Object.assign({ state: state }, extra || {}); if (F.bus) F.bus.emit('tts:state', d); listeners.forEach(function (f) { try { f(d); } catch (e) { /* */ } }); }
  function state() { return S ? (S.paused ? 'paused' : 'speaking') : 'idle'; }

  function finish(sess, result) {
    if (S !== sess || sess.done) return;
    sess.done = true; clearInterval(sess.keep); S = null; sess.resolve(result); emit('idle', result);
    if (sess.opts.onend) sess.opts.onend(result);
  }
  function runChunk(sess) {
    if (S !== sess || sess.done) return;
    if (sess.idx >= sess.chunks.length) return finish(sess, { ok: true, chunks: sess.chunks.length });
    var s = synth(), text = sess.chunks[sess.idx], u;
    try { u = new window.SpeechSynthesisUtterance(text); } catch (e) { return finish(sess, { ok: false, reason: 'error' }); }
    u.lang = sess.voice && sess.voice.lang || sess.lang || ''; if (sess.voice) u.voice = sess.voice;
    u.rate = sess.rate != null ? sess.rate : rate; u.pitch = sess.opts.pitch != null ? sess.opts.pitch : 1; u.volume = sess.opts.volume != null ? sess.opts.volume : 1;
    var gen = ++sess.gen;
    sess.u = u; sess.keepRefs.push(u); if (sess.keepRefs.length > 4) sess.keepRefs.shift();     // evită colectarea de către GC (bug Chromium)
    u.onstart = function () { if (sess.opts.onchunk) sess.opts.onchunk(sess.idx, sess.chunks.length, text); };
    u.onboundary = function (ev) { if (sess.opts.onboundary) sess.opts.onboundary(ev, sess.idx); };
    u.onend = function () { if (S !== sess || gen !== sess.gen || sess.softCancel) return; sess.idx++; runChunk(sess); };
    u.onerror = function (ev) {
      if (S !== sess || gen !== sess.gen || sess.softCancel) return;
      var er = ev && ev.error || 'error';
      if (er === 'interrupted' || er === 'canceled') return;
      finish(sess, { ok: false, reason: er === 'not-allowed' ? 'not-allowed' : 'error', error: er });
    };
    try { s.speak(u); } catch (e) { finish(sess, { ok: false, reason: 'error' }); }
  }

  function stop() {
    var s = synth(), sess = S;
    if (sess) { sess.done = true; clearInterval(sess.keep); S = null; sess.resolve({ ok: true, stopped: true }); }
    if (s) { try { s.cancel(); } catch (e) { /* */ } }
    if (sess) emit('idle', { stopped: true });
  }

  function speak(text, opts) {
    opts = opts || {};
    if (!supported()) return Promise.resolve({ ok: false, reason: 'unsupported', message: T('unsupported') });
    stop();
    var lang = opts.lang || (F.lang ? F.lang() : 'en');
    var chunks = split(text, opts.maxChunk || 180);
    if (!chunks.length) return Promise.resolve({ ok: true, chunks: 0 });
    return whenVoices(opts.voiceWait == null ? 600 : opts.voiceWait).then(function () {
      var voice = findVoice(opts.voice, lang, !!opts.allowRemote);
      if (!voice) return { ok: false, reason: 'no-voice', message: T('no_voice', { lang: lang }) };
      return new Promise(function (resolve) {
        var sess = S = { chunks: chunks, idx: 0, lang: lang, voice: voice, rate: opts.rate, opts: opts, resolve: resolve, paused: false, gen: 0, keepRefs: [], done: false };
        if (voice && voice.localService === false) sess.keep = setInterval(function () { var s = synth(); if (S === sess && !sess.paused && s.speaking) { s.pause(); s.resume(); } }, 10000);
        emit('speaking', { chunks: chunks.length });
        runChunk(sess);
      });
    });
  }
  function pause() {
    var s = synth(); if (!S || S.paused) return false;
    S.paused = true;
    if (SOFT_PAUSE) { S.softCancel = true; try { s.cancel(); } catch (e) { /* */ } } else { try { s.pause(); } catch (e) { /* */ } }
    emit('paused'); return true;
  }
  function resume() {
    var s = synth(); if (!S || !S.paused) return false;
    S.paused = false;
    if (S.softCancel) { S.softCancel = false; runChunk(S); } else { try { s.resume(); } catch (e) { /* */ } }
    emit('speaking'); return true;
  }
  function setRate(r) {
    rate = Math.min(2, Math.max(0.5, +r || 1)); lset('tts.rate', rate);
    if (S && !S.paused) { var sess = S; sess.rate = rate; sess.softCancel = true; try { synth().cancel(); } catch (e) { /* */ } sess.softCancel = false; runChunk(sess); }
    return rate;
  }

  /* ---- selector de voce ---- */
  function css() {
    if (document.getElementById('fff-tts-style')) return;
    var s = document.createElement('style'); s.id = 'fff-tts-style';
    s.textContent = '.fff-tts{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;color:var(--fff-fg,CanvasText)}' +
      '.fff-tts label{display:inline-flex;gap:6px;align-items:center}' +
      '.fff-tts select,.fff-tts button,.fff-tts input[type=range]{font:inherit;min-height:44px;min-width:44px}' +
      '.fff-tts button{padding:4px 12px;border-radius:8px;border:1px solid var(--fff-border,color-mix(in srgb,CanvasText 45%,transparent));background:var(--fff-btn,ButtonFace);color:var(--fff-btn-fg,ButtonText);cursor:pointer}' +
      '.fff-tts :focus-visible{outline:3px solid var(--fff-focus,Highlight);outline-offset:2px}' +
      '.fff-tts-msg{flex-basis:100%;margin:0;font-size:.9em}';
    document.head.appendChild(s);
  }
  var uid = 0;
  function picker(host, opts) {
    opts = opts || {}; css(); var id = 'fff-tts-' + (++uid);
    var lang = opts.lang || (F.lang ? F.lang() : 'en'), remote = false;
    var root = document.createElement('div'); root.className = 'fff-tts'; root.setAttribute('role', 'group'); root.setAttribute('aria-label', T('group'));
    root.innerHTML = '<label for="' + id + '-v"></label><select id="' + id + '-v"></select>' +
      '<label for="' + id + '-r"></label><input type="range" id="' + id + '-r" min="0.5" max="2" step="0.1"><output for="' + id + '-r"></output>' +
      '<button type="button" data-a="test"></button><button type="button" data-a="pause"></button><button type="button" data-a="stop"></button>' +
      '<label><input type="checkbox" id="' + id + '-o"><span></span></label><p class="fff-tts-msg" role="status"></p>';
    var q = function (s) { return root.querySelector(s); };
    var sel = q('select'), rng = q('input[type=range]'), out = q('output'), msg = q('.fff-tts-msg'), chk = q('input[type=checkbox]');
    var labs = root.querySelectorAll('label'), bTest = q('[data-a=test]'), bPause = q('[data-a=pause]'), bStop = q('[data-a=stop]');
    function texts() {
      labs[0].textContent = T('voice'); labs[1].textContent = T('rate'); q('label:last-of-type span').textContent = T('remote');
      bTest.textContent = T('test'); bStop.textContent = T('stop'); bPause.textContent = state() === 'paused' ? T('resume') : T('pause');
    }
    function fill() {
      var list = voices(lang, { allowRemote: remote }); sel.textContent = '';
      var a = document.createElement('option'); a.value = ''; a.textContent = T('auto'); sel.appendChild(a);
      list.forEach(function (v) { var o = document.createElement('option'); o.value = v.voiceURI || v.name; o.textContent = v.name + ' (' + v.lang + (v.localService === false ? ', online' : '') + ')'; sel.appendChild(o); });
      var saved = lget('tts.voice.' + base(lang), ''); if (saved && list.some(function (v) { return (v.voiceURI || v.name) === saved; })) sel.value = saved;
      msg.textContent = !supported() ? T('unsupported') : (list.length ? '' : T('no_voice', { lang: lang }));
      sel.disabled = !supported() || !list.length; bTest.disabled = !supported();
    }
    rng.value = rate; out.textContent = '×' + rate.toFixed(1);
    sel.addEventListener('change', function () { lset('tts.voice.' + base(lang), sel.value); });
    rng.addEventListener('input', function () { out.textContent = '×' + (+rng.value).toFixed(1); setRate(+rng.value); });
    chk.addEventListener('change', function () { remote = chk.checked; fill(); });
    bTest.addEventListener('click', function () {
      speak(T('sample_' + base(lang)) , { lang: lang, voice: sel.value || null, allowRemote: remote }).then(function (r) { if (!r.ok) msg.textContent = r.message || T('error'); });
    });
    bPause.addEventListener('click', function () { if (state() === 'paused') resume(); else pause(); texts(); });
    bStop.addEventListener('click', function () { stop(); texts(); });
    texts(); fill();
    var s = synth(); if (s && s.addEventListener) s.addEventListener('voiceschanged', fill);
    if (F.onLang) F.onLang(function () { texts(); fill(); });
    host.appendChild(root);
    return { el: root, refresh: fill, setLang: function (l) { lang = l; fill(); }, destroy: function () { if (s && s.removeEventListener) s.removeEventListener('voiceschanged', fill); root.remove(); } };
  }

  F.tts = {
    supported: supported, speak: speak, stop: stop, pause: pause, resume: resume, setRate: setRate, picker: picker,
    voices: voices, ready: whenVoices, state: state, split: split, rate: function () { return rate; },
    on: function (fn) { listeners.push(fn); }
  };
})();
