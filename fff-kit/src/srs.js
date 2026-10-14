/* FFF.srs — repetiție spațiată SM-2 (local, fără rețea). Depinde doar de FFF.core. */
(function () {
  'use strict';
  var F = (window.FFF = window.FFF || {});
  var MIN_EF = 1.3, MATURE = 21, SCHEMA = 1;

  function T(k, v) { return F.t ? F.t('srs', k, v) : k; }
  function dayOf(now) {
    var d = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }
  function dateOfDay(day) { var d = new Date(day * 86400000); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

  /* SM-2 (Woźniak, 1990), ordinea din pseudocodul uzual:
     q>=3: n=0 -> I=1; n=1 -> I=6; altfel I=round(I_prec*EF) (EF-ul de DINAINTE de această notă); n++ ; apoi
           EF' = max(1.3, EF + 0.1 - (5-q)(0.08+(5-q)0.02)).
     q<3 : n=0, I=1, EF neschimbat (conform textului original: „fără a schimba E-Factor”). */
  function sm2(st, q) {
    q = Math.max(0, Math.min(5, Math.round(Number(q))));
    var ef = st.ef == null ? 2.5 : st.ef, n = st.n | 0, i = st.i | 0;
    if (q >= 3) {
      if (n === 0) i = 1; else if (n === 1) i = 6; else i = Math.round(i * ef);
      n += 1;
      ef = Math.max(MIN_EF, r2(ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    } else { n = 0; i = 1; }
    return { ef: ef, n: n, i: i, q: q };
  }

  var decks = {};
  function key(id) { return 'srs.' + id; }

  function load(id) {
    var raw = F.store.get(key(id), null);
    if (raw && raw.v === SCHEMA && Array.isArray(raw.cards)) return raw;
    return { v: SCHEMA, id: id, created: new Date().toISOString(), newPerDay: 20, cards: [], intro: { day: -1, n: 0 }, log: { rev: 0, ok: 0 } };
  }
  function registry() { return F.store.get('srs.__decks', []); }

  function Deck(id) {
    this.id = id; this.d = load(id); this._map = null; this._idx();
  }
  Deck.prototype._idx = function () { this._map = {}; for (var i = 0; i < this.d.cards.length; i++) this._map[this.d.cards[i].id] = this.d.cards[i]; };
  Deck.prototype.save = function () {
    F.store.set(key(this.id), this.d);
    var r = registry(); if (r.indexOf(this.id) < 0) { r.push(this.id); F.store.set('srs.__decks', r); }
  };
  Deck.prototype.setNewPerDay = function (n) { this.d.newPerDay = Math.max(0, n | 0); this.save(); };
  Deck.prototype.get = function (id) { var c = this._map[id]; return c ? Object.assign({}, c) : null; };
  Deck.prototype.add = function (items) {
    var added = 0, self = this;
    (items || []).forEach(function (it) {
      if (typeof it === 'string') { var p = it.split('\t'); it = { front: p[0], back: p.slice(1).join('\t') }; }
      if (!it || it.front == null) return;
      var id = it.id != null ? String(it.id) : 'c' + hash(String(it.front));
      if (self._map[id]) return;
      var c = { id: id, f: String(it.front), b: String(it.back == null ? '' : it.back), ef: 2.5, n: 0, i: 0, due: 0, rev: 0, lap: 0, ok: 0, last: 0, seq: self.d.cards.length };
      self.d.cards.push(c); self._map[id] = c; added++;
    });
    if (added) this.save();
    return added;
  };
  Deck.prototype.remove = function (id) {
    var n = this.d.cards.length;
    this.d.cards = this.d.cards.filter(function (c) { return c.id !== id; }); this._idx();
    if (this.d.cards.length !== n) this.save();
  };
  Deck.prototype._newLeft = function (today) {
    var used = this.d.intro.day === today ? this.d.intro.n : 0;
    return Math.max(0, this.d.newPerDay - used);
  };
  Deck.prototype.queue = function (now) {
    var today = dayOf(now), due = [], fresh = [], cs = this.d.cards;
    for (var k = 0; k < cs.length; k++) { var c = cs[k]; if (c.rev > 0) { if (c.due <= today) due.push(c); } else fresh.push(c); }
    due.sort(function (a, b) { return a.due - b.due || a.last - b.last || a.seq - b.seq; });
    fresh.sort(function (a, b) { return a.seq - b.seq; });
    return { due: due, fresh: fresh.slice(0, this._newLeft(today)), today: today };
  };
  Deck.prototype.next = function (now) {
    var q = this.queue(now), c = q.due[0] || q.fresh[0];
    return c ? Object.assign({}, c, { front: c.f, back: c.b, isNew: c.rev === 0 }) : null;
  };
  Deck.prototype.grade = function (id, quality, now) {
    var c = this._map[id]; if (!c) throw new Error('srs: card necunoscut ' + id);
    var today = dayOf(now), wasNew = c.rev === 0;
    var r = sm2({ ef: c.ef, n: c.n, i: c.i }, quality);
    c.ef = r.ef; c.n = r.n; c.i = r.i; c.rev += 1; c.last = (now instanceof Date ? now.getTime() : (now == null ? Date.now() : now));
    this.d.log.rev += 1;
    if (r.q >= 3) { c.ok += 1; this.d.log.ok += 1; c.due = today + r.i; }
    else { c.lap += 1; c.due = today; }            // reînvățare în aceeași zi
    if (wasNew) { if (this.d.intro.day !== today) this.d.intro = { day: today, n: 0 }; this.d.intro.n += 1; }
    this.d.log.today = this.d.log.today && this.d.log.today.day === today ? this.d.log.today : { day: today, n: 0 };
    this.d.log.today.n += 1;
    this.save();
    return { id: id, ef: c.ef, n: c.n, interval: c.i, due: c.due, dueDate: dateOfDay(c.due) };
  };
  Deck.prototype.stats = function (now) {
    var q = this.queue(now), cs = this.d.cards, nNew = 0, young = 0, mature = 0, efs = 0, seen = 0, fc = [0, 0, 0, 0, 0, 0, 0];
    cs.forEach(function (c) {
      if (c.rev === 0) { nNew++; return; }
      seen++; efs += c.ef;
      if (c.i >= MATURE) mature++; else young++;
      var d = c.due - q.today; if (d >= 0 && d < 7) fc[d]++;
    });
    var lg = this.d.log;
    return {
      total: cs.length, new: nNew, due: q.due.length, newToday: q.fresh.length, toStudy: q.due.length + q.fresh.length,
      young: young, mature: mature, maturity: seen ? mature / seen : 0,
      reviews: lg.rev, retention: lg.rev ? lg.ok / lg.rev : null,
      reviewsToday: lg.today && lg.today.day === q.today ? lg.today.n : 0,
      avgEase: seen ? r2(efs / seen) : null, forecast: fc
    };
  };
  Deck.prototype.export = function () {
    return { format: 'fff-srs-deck', schema: SCHEMA, deck: this.id, exported: new Date().toISOString(), newPerDay: this.d.newPerDay, log: this.d.log, cards: this.d.cards.map(function (c) { return Object.assign({}, c); }) };
  };
  Deck.prototype.import = function (obj, opts) {
    if (typeof obj === 'string') obj = JSON.parse(obj);
    if (!obj || obj.format !== 'fff-srs-deck' || obj.schema !== SCHEMA || !Array.isArray(obj.cards)) throw new Error('srs: format invalid');
    var replace = opts && opts.replace, merge = opts && opts.merge, n = 0, self = this;
    obj.cards.forEach(function (c) {
      if (!c || c.id == null || c.f == null) return;
      var ex = self._map[c.id];
      var nc = { id: String(c.id), f: String(c.f), b: String(c.b == null ? '' : c.b), ef: Math.max(MIN_EF, +c.ef || 2.5), n: c.n | 0, i: c.i | 0, due: c.due | 0, rev: c.rev | 0, lap: c.lap | 0, ok: c.ok | 0, last: +c.last || 0 };
      if (ex) {
        var better = replace || (merge === 'progress' && (nc.rev > ex.rev || (nc.rev === ex.rev && nc.last > ex.last)));
        if (!better) return; nc.seq = ex.seq; Object.assign(ex, nc);
      }
      else { nc.seq = self.d.cards.length; self.d.cards.push(nc); self._map[nc.id] = nc; }
      n++;
    });
    if (obj.log && replace) this.d.log = { rev: obj.log.rev | 0, ok: obj.log.ok | 0 };
    this.save(); return n;
  };
  Deck.prototype.reset = function () { this.d.cards.forEach(function (c) { c.ef = 2.5; c.n = 0; c.i = 0; c.due = 0; c.rev = 0; c.lap = 0; c.ok = 0; c.last = 0; }); this.d.log = { rev: 0, ok: 0 }; this.d.intro = { day: -1, n: 0 }; this.save(); };

  function create(deckId, opts) {
    deckId = String(deckId || 'default');
    var dk = decks[deckId] || (decks[deckId] = new Deck(deckId));
    if (opts && opts.newPerDay != null) dk.setNewPerDay(opts.newPerDay);
    return dk;
  }

  /* ---------- UI ---------- */
  function css() {
    if (document.getElementById('fff-srs-style')) return;
    var s = document.createElement('style'); s.id = 'fff-srs-style';
    s.textContent = '.fff-srs{font:inherit;color:var(--fff-fg,CanvasText);background:var(--fff-bg,Canvas);border:1px solid var(--fff-border,color-mix(in srgb,CanvasText 30%,transparent));border-radius:12px;padding:12px;max-width:42rem}' +
      '.fff-srs:focus-visible,.fff-srs button:focus-visible{outline:3px solid var(--fff-focus,Highlight);outline-offset:2px}' +
      '.fff-srs-stats{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0 0 10px;padding:0;list-style:none;font-size:.9em}' +
      '.fff-srs-card{min-height:7rem;border:1px solid var(--fff-border,color-mix(in srgb,CanvasText 30%,transparent));border-radius:10px;padding:14px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}' +
      '.fff-srs-back{border-top:1px dashed currentColor;margin-top:10px;padding-top:10px}' +
      '.fff-srs-row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}' +
      '.fff-srs button{font:inherit;min-height:44px;min-width:44px;padding:6px 14px;border-radius:8px;border:1px solid var(--fff-border,color-mix(in srgb,CanvasText 45%,transparent));background:var(--fff-btn,ButtonFace);color:var(--fff-btn-fg,ButtonText);cursor:pointer}' +
      '.fff-srs button[data-fff-primary]{background:var(--fff-accent,#0b57d0);color:var(--fff-accent-fg,#fff);border-color:transparent}' +
      '@media(prefers-color-scheme:dark){.fff-srs button[data-fff-primary]{background:var(--fff-accent,#8ab4f8);color:var(--fff-accent-fg,#101418)}}' +
      '.fff-srs-hint{font-size:.85em;opacity:.85;margin:6px 0 0}';
    document.head.appendChild(s);
  }
  function el(tag, attrs, text) { var e = document.createElement(tag); if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  function pickFile(accept) {
    if (F.pickFile) return F.pickFile(accept);
    return new Promise(function (res, rej) {
      var i = el('input', { type: 'file', accept: accept || '' }); i.style.display = 'none';
      i.addEventListener('change', function () { i.files[0] ? res(i.files[0]) : rej(new Error('cancel')); i.remove(); });
      document.body.appendChild(i); i.click();
    });
  }

  function panel(container, opts) {
    opts = opts || {}; css();
    var dk = create(opts.deckId || 'default');
    if (opts.items) dk.add(opts.items);
    var cur = null, shown = false;
    var root = el('section', { 'class': 'fff-srs', tabindex: '0', role: 'region', 'aria-label': T('region', { deck: dk.id }) });
    var stats = el('ul', { 'class': 'fff-srs-stats' });
    var card = el('div', { 'class': 'fff-srs-card', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var row = el('div', { 'class': 'fff-srs-row' });
    var showBtn = el('button', { type: 'button', 'data-fff-primary': '' }, T('show'));
    var grades = el('div', { 'class': 'fff-srs-row', role: 'group', 'aria-label': T('grade_group') });
    var GR = [[1, 'again', 1], [2, 'hard', 3], [3, 'good', 4], [4, 'easy', 5]], gBtns = [];
    GR.forEach(function (g) {
      var b = el('button', { type: 'button', 'data-q': g[2], 'data-key': g[0], 'aria-keyshortcuts': String(g[0]) }, g[0] + ' · ' + T(g[1]));
      b.addEventListener('click', function () { doGrade(g[2]); }); grades.appendChild(b); gBtns.push(b);
    });
    var tools = el('div', { 'class': 'fff-srs-row' });
    var bExp = el('button', { type: 'button' }, T('export')), bImp = el('button', { type: 'button' }, T('import'));
    tools.appendChild(bExp); tools.appendChild(bImp);
    var msg = el('p', { 'class': 'fff-srs-hint', role: 'status' });
    var hint = el('p', { 'class': 'fff-srs-hint' }, T('kbd_hint'));
    row.appendChild(showBtn);
    [stats, card, row, grades, tools, msg, hint].forEach(function (n) { root.appendChild(n); });
    container.appendChild(root);

    function pct(x) { return x == null ? '–' : Math.round(x * 100) + '%'; }
    function renderStats() {
      var s = dk.stats(), items = [
        [T('due'), s.due], [T('new'), s.newToday + '/' + s.new], [T('mature'), s.mature + ' (' + pct(s.maturity) + ')'],
        [T('retention'), pct(s.retention)], [T('total'), s.total]];
      stats.textContent = '';
      items.forEach(function (it) { var li = el('li'); var b = el('strong', null, it[1]); li.appendChild(b); li.appendChild(document.createTextNode(' ' + it[0])); stats.appendChild(li); });
    }
    function render() {
      renderStats(); shown = false; cur = dk.next(opts.now);
      card.textContent = '';
      grades.hidden = true; showBtn.hidden = false;
      if (!cur) { card.textContent = T('done'); showBtn.hidden = true; root.focus(); return; }
      var f = el('div', { 'class': 'fff-srs-front' }, cur.front);
      card.appendChild(f); showBtn.focus();
    }
    function reveal() {
      if (!cur || shown) return; shown = true;
      var bk = el('div', { 'class': 'fff-srs-back', 'aria-label': T('answer') }, cur.back);
      card.appendChild(bk); showBtn.hidden = true; grades.hidden = false; gBtns[2].focus();
    }
    function doGrade(q) { if (!cur || !shown) return; dk.grade(cur.id, q, opts.now); if (opts.onGrade) opts.onGrade(cur, q); render(); }
    showBtn.addEventListener('click', reveal);
    root.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var onBtn = e.target.closest && e.target.closest('button');
      if (e.key === ' ' || e.code === 'Space') { if (onBtn) return; if (!shown) { e.preventDefault(); reveal(); } return; }
      if (shown && /^[1-4]$/.test(e.key)) { e.preventDefault(); doGrade(GR[+e.key - 1][2]); }
    });
    bExp.addEventListener('click', function () {
      var o = JSON.stringify(dk.export(), null, 1);
      (F.download || function () {})(dk.id + '.fff.json', o, 'application/json'); msg.textContent = T('exported');
    });
    bImp.addEventListener('click', function () {
      pickFile('.json,application/json').then(function (f) { return f.text(); }).then(function (t) {
        var n = dk.import(t, { merge: 'progress' }); msg.textContent = T('imported', { n: n }); render();
      }).catch(function (e) { if (e && e.message !== 'cancel') msg.textContent = T('import_err'); });
    });
    render();
    return { deck: dk, refresh: render, reveal: reveal, grade: doGrade, el: root, destroy: function () { root.remove(); } };
  }

  F.srs = {
    create: create, panel: panel, sm2: sm2, dayOf: dayOf, MIN_EF: MIN_EF, MATURE: MATURE,
    decks: function () { return registry().slice(); },
    drop: function (id) { delete decks[id]; F.store.remove(key(id)); F.store.set('srs.__decks', registry().filter(function (x) { return x !== id; })); },
    importDeck: function (obj, opts) { var o = typeof obj === 'string' ? JSON.parse(obj) : obj; var d = create(o && o.deck || 'default'); d.import(o, opts); return d; }
  };
})();
