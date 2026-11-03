/* fff-jocuri · Motorul comun de jocuri FFF — UN singur strat TBL (i18n 8 limbi, stocare locală, Elo, turnee tur-retur, p2p lockstep, panouri accesibile) + FFF.games (istoric, clasament Elo pe nume, hub „Turneu și Elo” atașabil oricărui joc).
 * Sursa canonică e ACEST fișier (tools/fff-jocuri.js); aplicațiile îl primesc prin `node tools/inject-shared.mjs` (plan.json „libs”), nu prin copiere de mână. Dame/Go/Șah îl foloseau lipit de trei ori; acum e o singură sursă.
 * Fără rețea, fără dependențe. Jocurile rulează cu connect-src 'none': un adversar AI în rețea (ARENA) nu are sens aici; adversarii sunt motoarele locale ale jocurilor și oamenii (hot-seat). */
(function (root, factory) {
  var G = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = G;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var self = root;
  var TBL = root.TBL = root.TBL || {};
/* ===== TBL · strat comun pentru jocuri de masă (runda 8, cluster C1a) =====
   Fără rețea, fără dependențe. Folosit de Go / Șah / Dame fără frontiere (injectat din tools/fff-jocuri.js, nu lipit de mână).
   Conține: i18n (8 limbi), stocare locală, dată/seed, anunțuri (aria-live + voce), panouri/tab-uri,
   Elo + turneu local, înveliș peste FFF.p2p.lockstep (oferte de remiză / joc nou). */
(function (root) {
  'use strict';
  var T = root.TBL = root.TBL || {};
  var doc = document;

  /* ---------- utilitare DOM ---------- */
  function el(tag, attrs, kids) {
    var e = doc.createElement(tag), k, v;
    if (attrs) for (k in attrs) {
      v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    if (kids !== undefined && kids !== null) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
    });
    return e;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  T.el = el; T.clear = clear;
  var uid = 0; T.uid = function (p) { return (p || 'c1a') + '-' + (++uid); };

  /* ---------- i18n ---------- */
  var DICT = {};
  T.addDict = function (d) { for (var l in d) { DICT[l] = DICT[l] || {}; for (var k in d[l]) DICT[l][k] = d[l][k]; } };
  T.dict = DICT;
  T.langPref = null; /* aplicațiile fără i18n propriu pot oferi o preferință de limbă pentru textele modulului (funcție -> cod sau null) */
  T.langFn = function () { var p = T.langPref && T.langPref(); if (p) return p; var l = (doc.documentElement.getAttribute('lang') || 'ro').slice(0, 2).toLowerCase(); return l; };
  T.lang = function () { return T.langFn(); };
  T.t = function (key, vars) {
    var l = T.lang(), s = DICT[l] && DICT[l][key];
    if (s === undefined) s = DICT.en && DICT.en[key];
    if (s === undefined) s = DICT.ro && DICT.ro[key];
    if (s === undefined) return key;
    if (vars) for (var k in vars) s = String(s).split('{' + k + '}').join(String(vars[k]));
    return s;
  };

  /* ---------- stocare locală (try/catch; memorie ca rezervă) ---------- */
  var mem = {}, PFX = 'c1a_';
  T.setPrefix = function (p) { PFX = p; };
  T.store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(PFX + k); if (v === null) return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : d; return JSON.parse(v); } catch (e) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : d; }
    },
    set: function (k, v) {
      mem[k] = v;
      try { localStorage.setItem(PFX + k, JSON.stringify(v)); } catch (e) { /* memorie */ }
    },
    remove: function (k) { delete mem[k]; try { localStorage.removeItem(PFX + k); } catch (e) { /* ignorat */ } }
  };

  /* ---------- dată / aleatoriu determinist ---------- */
  T.todayStr = function () {
    if (T.__today) return T.__today;
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  T.dayNumber = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || T.todayStr()); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : 0; };
  T.hash32 = function (str) { var h = 2166136261 >>> 0, i; str = String(str); for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
  T.rng = function (seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  /* serie zilnică: {last:'YYYY-MM-DD', streak:n, done:{'YYYY-MM-DD':true}} */
  T.daily = {
    key: T.todayStr, number: T.dayNumber,
    state: function (kind) { var s = T.store.get('daily.' + kind, null); return (s && typeof s === 'object') ? s : { last: '', streak: 0, best: 0, done: {} }; },
    isDone: function (kind, day) { return !!T.daily.state(kind).done[day || T.todayStr()]; },
    markDone: function (kind, day) {
      day = day || T.todayStr();
      var s = T.daily.state(kind); if (s.done[day]) return s;
      var prev = T.dayNumber(s.last), cur = T.dayNumber(day);
      s.streak = (s.last && cur - prev === 1) ? s.streak + 1 : 1;
      if (s.last && cur === prev) s.streak = Math.max(1, s.streak);
      s.best = Math.max(s.best || 0, s.streak); s.last = day; s.done[day] = true;
      var keys = Object.keys(s.done).sort(); while (keys.length > 120) delete s.done[keys.shift()];
      T.store.set('daily.' + kind, s); return s;
    },
    /* seria curentă "vie": dacă ultima zi rezolvată nu e azi sau ieri, seria e 0 */
    streak: function (kind) { var s = T.daily.state(kind); if (!s.last) return 0; var diff = T.dayNumber(T.todayStr()) - T.dayNumber(s.last); return diff <= 1 ? s.streak : 0; }
  };

  /* ---------- anunțuri: regiune aria-live + voce opțională ---------- */
  var liveNode = null;
  T.liveEl = function () {
    if (liveNode && doc.body.contains(liveNode)) return liveNode;
    liveNode = el('div', { id: 'c1a-live', class: 'c1a-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    doc.body.appendChild(liveNode); return liveNode;
  };
  T.announceFn = null; /* aplicația poate înlocui (ex. Go folosește propria regiune live) */
  T.prefAnnounce = function () { return T.store.get('acc.announce', true) !== false; };
  T.prefVoice = function () { return T.store.get('acc.voice', false) === true; };
  T.speechSupported = function () {
    if (root.FFF && root.FFF.tts && root.FFF.tts.supported) return !!root.FFF.tts.supported();
    return typeof root.speechSynthesis !== 'undefined' && typeof root.SpeechSynthesisUtterance === 'function';
  };
  T.lastSpoken = '';
  T.speak = function (text) {
    T.lastSpoken = String(text);
    if (!T.speechSupported()) return Promise.resolve({ ok: false, reason: 'unsupported' });
    try {
      if (root.FFF && root.FFF.tts && root.FFF.tts.speak) return root.FFF.tts.speak(String(text), { lang: T.lang() });
      var u = new root.SpeechSynthesisUtterance(String(text)); u.lang = T.lang(); root.speechSynthesis.cancel(); root.speechSynthesis.speak(u);
      return Promise.resolve({ ok: true });
    } catch (e) { return Promise.resolve({ ok: false, reason: 'error' }); }
  };
  /* text -> regiunea live (dacă "anunțuri" e activ) și, separat, voce (dacă "voce" e activă). force = ignoră preferințele (mesaje de eroare) */
  T.muted = false;
  T.announce = function (text, force) {
    if (!text || T.muted) return;
    if (T.prefAnnounce() || force) {
      if (T.announceFn) T.announceFn(text);
      else { var n = T.liveEl(); n.textContent = ''; setTimeout(function () { n.textContent = text; }, 20); }
    }
    if (T.prefVoice()) T.speak(text);
  };

  /* ---------- panouri: <dialog> modal + tab-uri ---------- */
  T.panel = function (o) {
    var id = T.uid('c1a-dlg');
    var dlg = el('dialog', { class: 'c1a-dlg', 'aria-labelledby': id + '-t' });
    var head = el('div', { class: 'c1a-dlg-head' });
    var h = el('h2', { id: id + '-t', text: o.title || '' });
    var closeBtn = el('button', { type: 'button', class: 'c1a-btn c1a-x', 'aria-label': T.t('close'), text: '✕' });
    head.appendChild(h); head.appendChild(closeBtn);
    var body = el('div', { class: 'c1a-dlg-body' });
    dlg.appendChild(head); dlg.appendChild(body);
    var opener = null;
    function close() { if (dlg.open) dlg.close(); }
    closeBtn.addEventListener('click', close);
    dlg.addEventListener('close', function () {
      if (o.onClose) { try { o.onClose(); } catch (e) { /* ignorat */ } }
      dlg.remove();
      if (opener && opener.focus && doc.contains(opener)) { try { opener.focus(); } catch (e) { /* ignorat */ } }
    });
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) close(); });
    return {
      dlg: dlg, body: body, title: h, close: close,
      open: function () { opener = doc.activeElement; doc.body.appendChild(dlg); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); var f = dlg.querySelector('[data-c1a-focus]') || closeBtn; try { f.focus(); } catch (e) { /* ignorat */ } return this; }
    };
  };
  /* tab-uri (role=tablist) în orice container; tabs = [{id,label,render(panelEl)}] */
  T.tabs = function (container, tabs, o) {
    o = o || {};
    var id = T.uid('c1a-tabs'), list = el('div', { class: 'c1a-tablist', role: 'tablist', 'aria-label': o.label || '' });
    var panes = {}, btns = {}, current = null;
    function show(tid, focus) {
      current = tid;
      tabs.forEach(function (tb) {
        var on = tb.id === tid;
        btns[tb.id].setAttribute('aria-selected', on ? 'true' : 'false'); btns[tb.id].tabIndex = on ? 0 : -1;
        panes[tb.id].hidden = !on;
        if (on) { clear(panes[tb.id]); try { tb.render(panes[tb.id]); } catch (e) { panes[tb.id].appendChild(el('p', { class: 'c1a-err', role: 'alert', text: String(e && e.message || e) })); if (root.console) console.error(e); } }
      });
      if (focus) btns[tid].focus();
    }
    tabs.forEach(function (tb, i) {
      var b = el('button', { type: 'button', class: 'c1a-btn c1a-tab', role: 'tab', id: id + '-b-' + tb.id, 'aria-controls': id + '-p-' + tb.id, 'aria-selected': 'false', tabindex: '-1', text: tb.label });
      b.addEventListener('click', function () { show(tb.id); });
      b.addEventListener('keydown', function (ev) {
        var j = -1;
        if (ev.key === 'ArrowRight') j = (i + 1) % tabs.length; else if (ev.key === 'ArrowLeft') j = (i + tabs.length - 1) % tabs.length;
        else if (ev.key === 'Home') j = 0; else if (ev.key === 'End') j = tabs.length - 1;
        if (j >= 0) { ev.preventDefault(); show(tabs[j].id, true); }
      });
      btns[tb.id] = b; list.appendChild(b);
      panes[tb.id] = el('div', { class: 'c1a-pane', role: 'tabpanel', id: id + '-p-' + tb.id, 'aria-labelledby': id + '-b-' + tb.id, hidden: true });
    });
    container.appendChild(list);
    tabs.forEach(function (tb) { container.appendChild(panes[tb.id]); });
    show(o.initial && panes[o.initial] ? o.initial : tabs[0].id);
    return { show: show, get current() { return current; }, pane: function (tid) { return panes[tid]; } };
  };

  /* ---------- Elo ---------- */
  T.elo = {
    expected: function (ra, rb) { return 1 / (1 + Math.pow(10, (rb - ra) / 400)); },
    k: function (games) { return games < 10 ? 40 : (games < 30 ? 28 : 20); },
    /* returnează [ra', rb'] pentru scorul s al lui A (1, 0.5, 0) */
    update: function (ra, rb, s, ga, gb) {
      var ea = T.elo.expected(ra, rb);
      return [ra + T.elo.k(ga) * (s - ea), rb + T.elo.k(gb) * ((1 - s) - (1 - ea))];
    }
  };
  /* tur-retur (metoda cercului). ids -> runde de perechi [a,b]; double = a doua jumătate cu culorile inversate */
  T.roundRobin = function (ids, double) {
    var a = ids.slice(), bye = null, rounds = [], n, r, i, pairs;
    if (a.length < 2) return rounds;
    if (a.length % 2) a.push(bye);
    n = a.length;
    for (r = 0; r < n - 1; r++) {
      pairs = [];
      for (i = 0; i < n / 2; i++) {
        var x = a[i], y = a[n - 1 - i];
        if (x === bye || y === bye) continue;
        pairs.push(r % 2 === 0 ? [x, y] : [y, x]);
      }
      rounds.push(pairs);
      a.splice(1, 0, a.pop());
    }
    if (double) { var base = rounds.length; for (r = 0; r < base; r++) rounds.push(rounds[r].map(function (p) { return [p[1], p[0]]; })); }
    return rounds;
  };

  /* Turneu local. opts: {key, aiInit(level), aiName(level)} ; starea e determinată din rezultate (recalculare completă) */
  T.tournament = function (opts) {
    var S = T.store.get('tour.' + opts.key, null);
    if (!S || typeof S !== 'object' || !Array.isArray(S.players) || !Array.isArray(S.matches)) S = null;
    function save() { T.store.set('tour.' + opts.key, S); }
    function player(id) { return S.players.filter(function (p) { return p.id === id; })[0]; }
    function recompute() {
      S.players.forEach(function (p) { p.r = p.r0; p.g = 0; p.w = 0; p.d = 0; p.l = 0; p.pts = 0; });
      var done = S.matches.filter(function (m) { return m.res !== null && m.res !== undefined; }).sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
      done.forEach(function (m) {
        var A = player(m.a), B = player(m.b); if (!A || !B) return;
        var r = T.elo.update(A.r, B.r, m.res, A.g, B.g);
        A.r = r[0]; B.r = r[1]; A.g++; B.g++; A.pts += m.res; B.pts += 1 - m.res;
        if (m.res === 1) { A.w++; B.l++; } else if (m.res === 0) { A.l++; B.w++; } else { A.d++; B.d++; }
      });
    }
    var api = {
      get state() { return S; },
      exists: function () { return !!S; },
      create: function (parts, double, name, extra) {
        var seq = 0;
        S = { v: 1, name: name || '', created: new Date().toISOString(), double: !!double, nextSeq: 1, players: [], matches: [], extra: extra || null };
        parts.forEach(function (p, i) {
          S.players.push({ id: 'p' + (i + 1), name: p.name, ai: p.ai || 0, r0: p.ai ? opts.aiInit(p.ai) : (p.r0 || 1200), r: 0, g: 0, w: 0, d: 0, l: 0, pts: 0 });
        });
        T.roundRobin(S.players.map(function (p) { return p.id; }), double).forEach(function (round, ri) {
          round.forEach(function (pr) { S.matches.push({ id: 'm' + (++seq), round: ri + 1, a: pr[0], b: pr[1], res: null, seq: 0, how: '' }); });
        });
        recompute(); save(); return api;
      },
      reset: function () { S = null; T.store.remove('tour.' + opts.key); },
      player: function (id) { return player(id); },
      match: function (id) { return S.matches.filter(function (m) { return m.id === id; })[0]; },
      /* res = scorul lui A (1 / 0.5 / 0); how = 'play' | 'sim' | 'man' */
      record: function (id, res, how, extra) {
        var m = api.match(id); if (!m) return false;
        if (res !== 1 && res !== 0 && res !== 0.5) return false;
        m.res = res; m.how = how || 'man'; m.seq = S.nextSeq++; m.at = new Date().toISOString(); if (extra) m.info = extra;
        recompute(); save(); return true;
      },
      clearResult: function (id) { var m = api.match(id); if (!m) return false; m.res = null; m.seq = 0; m.how = ''; delete m.info; recompute(); save(); return true; },
      standings: function () {
        return S.players.slice().sort(function (a, b) { return (b.pts - a.pts) || (b.r - a.r) || (a.name < b.name ? -1 : 1); });
      },
      finished: function () { return S.matches.length > 0 && S.matches.every(function (m) { return m.res !== null && m.res !== undefined; }); },
      toJSON: function () { return JSON.stringify(S, null, 1); },
      toCSV: function () {
        var rows = ['pozitie;nume;elo;puncte;jocuri;V;E;I'];
        api.standings().forEach(function (p, i) { rows.push([i + 1, '"' + p.name.replace(/"/g, '""') + '"', Math.round(p.r), p.pts, p.g, p.w, p.d, p.l].join(';')); });
        return rows.join('\n');
      },
      load: function (json) {
        var o = JSON.parse(json);
        if (!o || o.v !== 1 || !Array.isArray(o.players) || !Array.isArray(o.matches) || o.players.length > 16 || o.matches.length > 400) throw new Error('format');
        o.players.forEach(function (p) { if (typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.r0 !== 'number') throw new Error('format'); p.name = p.name.slice(0, 40); });
        o.matches.forEach(function (m) { if (typeof m.id !== 'string' || !o.players.some(function (p) { return p.id === m.a; }) || !o.players.some(function (p) { return p.id === m.b; })) throw new Error('format'); });
        S = o; S.nextSeq = S.matches.reduce(function (x, m) { return Math.max(x, (m.seq || 0) + 1); }, 1); recompute(); save(); return api;
      }
    };
    if (S) recompute();
    return api;
  };

  /* UI turneu. hooks: {firstLabel, secondLabel, aiOptions:[levels], aiName(level), canSim(), play(match, A, B), sim(match, A, B) -> Promise<res|null>} */
  T.tournamentUI = function (container, tour, hooks) {
    var busy = false;
    function fmt(r) { return String(Math.round(r)); }
    function render() {
      clear(container);
      container.appendChild(el('p', { class: 'c1a-note', text: T.t('tour.scale') }));
      if (!tour.exists()) return renderSetup();
      renderTournament();
    }
    function renderSetup() {
      var form = el('form', { class: 'c1a-form', novalidate: '' });
      form.addEventListener('submit', function (ev) { ev.preventDefault(); });
      form.appendChild(el('h3', { text: T.t('tour.new') }));
      var chosen = [], list = el('ul', { class: 'c1a-plist' });
      function addRow(name, ai, on) {
        var id = T.uid('c1a-pl');
        var cb = el('input', { type: 'checkbox', id: id, checked: on ? '' : null });
        cb.checked = !!on;
        var li = el('li', null, [cb, el('label', { for: id, text: name })]);
        li._get = function () { return cb.checked ? { name: name, ai: ai } : null; };
        list.appendChild(li); return li;
      }
      addRow(T.t('tour.me'), 0, true);
      (hooks.aiOptions || []).forEach(function (lv) { addRow(hooks.aiName(lv), lv, lv <= 3); });
      form.appendChild(list);
      var nid = T.uid('c1a-nm'), name = el('input', { type: 'text', id: nid, maxlength: '24', autocomplete: 'off' });
      var addBtn = el('button', { type: 'button', class: 'c1a-btn', text: T.t('tour.addHuman') });
      addBtn.addEventListener('click', function () {
        var v = name.value.trim().replace(/\s+/g, ' '); if (!v) { name.focus(); return; }
        var li = addRow(v.slice(0, 24), 0, true); name.value = ''; li.querySelector('input').focus();
      });
      form.appendChild(el('div', { class: 'c1a-row' }, [el('label', { for: nid, text: T.t('tour.humanName') }), name, addBtn]));
      var did = T.uid('c1a-dbl'), dbl = el('input', { type: 'checkbox', id: did });
      form.appendChild(el('div', { class: 'c1a-row' }, [dbl, el('label', { for: did, text: T.t('tour.double') })]));
      var getExtra = hooks.extraFields ? hooks.extraFields(form) : null;
      var msg = el('p', { class: 'c1a-msg', role: 'status' });
      var go = el('button', { type: 'button', class: 'c1a-btn c1a-pri', 'data-c1a-focus': '', text: T.t('tour.create') });
      go.addEventListener('click', function () {
        var parts = [].slice.call(list.children).map(function (li) { return li._get(); }).filter(Boolean);
        if (parts.length < 2) { msg.textContent = T.t('tour.min2'); return; }
        if (parts.length > 8) { msg.textContent = T.t('tour.max8'); return; }
        var seen = {}; for (var i = 0; i < parts.length; i++) { var k = parts[i].name.toLowerCase(); if (seen[k]) { msg.textContent = T.t('tour.dupName', { n: parts[i].name }); return; } seen[k] = 1; }
        tour.create(parts, dbl.checked, '', getExtra ? getExtra() : null); render(); T.announce(T.t('tour.created'));
      });
      form.appendChild(el('div', { class: 'c1a-row' }, [go]));
      form.appendChild(msg);
      var imp = el('button', { type: 'button', class: 'c1a-btn', text: T.t('tour.import') });
      imp.addEventListener('click', function () { doImport(msg); });
      form.appendChild(el('div', { class: 'c1a-row' }, [imp]));
      container.appendChild(form);
    }
    function doImport(msg) {
      var inp = el('input', { type: 'file', accept: 'application/json,.json' });
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        if (f.size > 500000) { msg.textContent = T.t('tour.badFile'); return; }
        var rd = new FileReader();
        rd.onload = function () { try { tour.load(String(rd.result)); render(); } catch (e) { msg.textContent = T.t('tour.badFile'); } };
        rd.readAsText(f);
      });
      inp.click();
    }
    function renderTournament() {
      var S = tour.state, st = tour.standings();
      container.appendChild(el('h3', { text: T.t('tour.standings') }));
      var tb = el('table', { class: 'c1a-table' });
      tb.appendChild(el('caption', { class: 'c1a-sr', text: T.t('tour.standings') }));
      tb.appendChild(el('thead', null, el('tr', null, ['#', T.t('tour.player'), 'Elo', T.t('tour.pts'), T.t('tour.games'), T.t('tour.wdl')].map(function (h) { return el('th', { scope: 'col', text: h }); }))));
      var tbd = el('tbody');
      st.forEach(function (p, i) {
        tbd.appendChild(el('tr', null, [el('td', { text: String(i + 1) }), el('th', { scope: 'row', text: p.name }), el('td', { text: fmt(p.r) }), el('td', { text: String(p.pts) }), el('td', { text: String(p.g) }), el('td', { text: p.w + '-' + p.d + '-' + p.l })]));
      });
      tb.appendChild(tbd); container.appendChild(el('div', { class: 'c1a-scroll' }, tb));
      if (hooks.extraInfo && S.extra) { var xi = hooks.extraInfo(S.extra); if (xi) container.appendChild(el('p', { class: 'c1a-note', text: xi })); }
      if (tour.finished()) container.appendChild(el('p', { class: 'c1a-ok', role: 'status', text: T.t('tour.winner', { n: st[0].name }) }));
      container.appendChild(el('h3', { text: T.t('tour.matches') }));
      var rounds = {};
      S.matches.forEach(function (m) { (rounds[m.round] = rounds[m.round] || []).push(m); });
      Object.keys(rounds).forEach(function (r) {
        container.appendChild(el('h4', { text: T.t('tour.round', { n: r }) }));
        var ul = el('ul', { class: 'c1a-matches' });
        rounds[r].forEach(function (m) {
          var A = tour.player(m.a), B = tour.player(m.b), li = el('li', { class: 'c1a-match' });
          var label = A.name + ' (' + hooks.firstLabel + ') – ' + B.name + ' (' + hooks.secondLabel + ')';
          li.appendChild(el('span', { class: 'c1a-mname', text: label }));
          if (m.res !== null && m.res !== undefined) {
            var rs = m.res === 1 ? '1–0' : (m.res === 0 ? '0–1' : '½–½');
            li.appendChild(el('strong', { class: 'c1a-mres', text: rs }));
            var un = el('button', { type: 'button', class: 'c1a-btn c1a-sm', 'aria-label': T.t('tour.clear') + ': ' + label, text: T.t('tour.clear') });
            un.addEventListener('click', function () { tour.clearResult(m.id); render(); });
            li.appendChild(un);
          } else {
            var human = !A.ai || !B.ai;
            if (hooks.play && (!A.ai || !B.ai)) {
              var pb = el('button', { type: 'button', class: 'c1a-btn c1a-sm c1a-pri', 'aria-label': T.t('tour.play') + ': ' + label, text: T.t('tour.play') });
              pb.addEventListener('click', function () { hooks.play(m, A, B); });
              li.appendChild(pb);
            }
            if (hooks.sim && A.ai && B.ai && (!hooks.canSim || hooks.canSim())) {
              var sb = el('button', { type: 'button', class: 'c1a-btn c1a-sm', 'aria-label': T.t('tour.sim') + ': ' + label, text: T.t('tour.sim') });
              sb.addEventListener('click', function () {
                if (busy) return; busy = true; sb.disabled = true; sb.textContent = T.t('tour.simulating');
                T.announce(T.t('tour.simulating'));
                Promise.resolve(hooks.sim(m, A, B)).then(function (res) {
                  busy = false;
                  if (res === 1 || res === 0 || res === 0.5) { tour.record(m.id, res, 'sim'); T.announce(T.t('tour.simDone', { r: res === 1 ? '1–0' : (res === 0 ? '0–1' : '½–½') })); }
                  render();
                }, function () { busy = false; render(); });
              });
              li.appendChild(sb);
            }
            ['1', '0.5', '0'].forEach(function (v) {
              var txt = v === '1' ? '1–0' : (v === '0' ? '0–1' : '½–½');
              var b = el('button', { type: 'button', class: 'c1a-btn c1a-sm', 'aria-label': T.t('tour.manual') + ' ' + txt + ': ' + label, text: txt });
              b.addEventListener('click', function () { tour.record(m.id, parseFloat(v), 'man'); render(); T.announce(T.t('tour.recorded', { r: txt })); });
              li.appendChild(b);
            });
          }
          ul.appendChild(li);
        });
        container.appendChild(ul);
      });
      var row = el('div', { class: 'c1a-row' });
      var ej = el('button', { type: 'button', class: 'c1a-btn', text: T.t('tour.exportJson') }), ec = el('button', { type: 'button', class: 'c1a-btn', text: T.t('tour.exportCsv') }), nw = el('button', { type: 'button', class: 'c1a-btn', text: T.t('tour.newBtn') });
      ej.addEventListener('click', function () { dl('turneu-elo.json', tour.toJSON(), 'application/json'); });
      ec.addEventListener('click', function () { dl('turneu-elo.csv', '﻿' + tour.toCSV(), 'text/csv;charset=utf-8'); });
      nw.addEventListener('click', function () {
        var ask = el('p', { class: 'c1a-confirm', role: 'alert' }, [T.t('tour.confirmNew') + ' ']);
        var y = el('button', { type: 'button', class: 'c1a-btn c1a-sm c1a-pri', text: T.t('tour.yes') }), n = el('button', { type: 'button', class: 'c1a-btn c1a-sm', text: T.t('tour.no') });
        y.addEventListener('click', function () { tour.reset(); render(); });
        n.addEventListener('click', function () { ask.remove(); nw.focus(); });
        ask.appendChild(y); ask.appendChild(n); row.after(ask); y.focus();
      });
      row.appendChild(ej); row.appendChild(ec); row.appendChild(nw); container.appendChild(row);
    }
    function dl(name, text, mime) {
      try {
        var url = URL.createObjectURL(new Blob([text], { type: mime })), a = el('a', { href: url, download: name });
        doc.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      } catch (e) { /* ignorat */ }
    }
    render();
    return { render: render };
  };

  /* ---------- rețea: înveliș peste FFF.p2p.lockstep ---------- */
  T.net = {
    available: function () { return !!(root.FFF && root.FFF.p2p && root.FFF.p2p.dialog && root.FFF.p2p.lockstep); },
    supported: function () { return T.net.available() && !!root.FFF.p2p.supported(); },
    /* adapter: {onMove(move, info)->true|false|string, validate?, snapshot?, onState?, hash?, onOffer(kind, role), onOfferResult(kind, ok, role), onStatus(kind, data), onOpen(ctrl)} */
    connect: function (o) {
      var ad = o.adapter, ctrl = null, ls = null, pending = null, closed = false;
      function roleOf(from) { return from; }
      var dlg = root.FFF.p2p.dialog({
        title: o.title,
        onOpen: function (session) {
          if (ls) return; /* kit: 'open' poate fi emis de două ori pentru oaspete (defect raportat) */
          if (ad.onSession) { try { ad.onSession(session.role, session); } catch (e) { if (root.console) console.error(e); } }
          ls = root.FFF.p2p.lockstep(session, {
            seed: o.seed,
            onMove: function (move, info) {
              if (move && move.k === 'offer') {
                if (pending) return 'offer-pending';
                if (typeof move.o !== 'string' || move.o.length > 12) return 'bad-offer';
                pending = { o: move.o, from: info.from };
                if (ad.onOffer) ad.onOffer(move.o, info.from, !!info.mine);
                return true;
              }
              if (move && move.k === 'answer') {
                if (!pending || pending.o !== move.o || pending.from === info.from) return 'no-offer';
                var p = pending; pending = null;
                if (ad.onOfferResult) ad.onOfferResult(p.o, !!move.ok, info.from, p.from);
                return true;
              }
              return ad.onMove(move, info);
            },
            validate: ad.validate ? function (m, c) { if (m && (m.k === 'offer' || m.k === 'answer')) return true; return ad.validate(m, c); } : undefined,
            snapshot: ad.snapshot ? function () { var s = ad.snapshot(); return s; } : undefined,
            hash: ad.hash,
            onState: function (state, info) { pending = null; if (ad.onState) ad.onState(state, info); },
            onChat: ad.onChat,
            onError: function (e) { if (ad.onStatus) ad.onStatus('error', { code: e.code, message: e.message }); }
          });
          ctrl = {
            session: session, lockstep: ls, role: session.role,
            get open() { return !closed && session.state === 'open'; },
            get pendingOffer() { return pending; },
            move: function (m) { return ls.move(m); },
            offer: function (kind) { return ls.move({ k: 'offer', o: kind }); },
            answer: function (kind, ok) { return ls.move({ k: 'answer', o: kind, ok: !!ok }); },
            close: function () { closed = true; try { ls.stop(); } catch (e) { /* ignorat */ } try { session.close('local'); } catch (e) { /* ignorat */ } }
          };
          session.on('close', function (why) { closed = true; if (ad.onStatus) ad.onStatus('closed', { why: why }); });
          session.on('lost', function () { if (ad.onStatus) ad.onStatus('lost'); });
          session.on('recovered', function () { if (ad.onStatus) ad.onStatus('recovered'); });
          if (ad.onOpen) ad.onOpen(ctrl);
        }
      });
      return dlg;
    }
  };

  /* ---------- bară "joc online" (în interfața jocului): stare, remiză / joc nou / renunț / închide + răspuns la oferte ---------- */
  /* ctl: {state() -> {online, side, status, pending:{o,fromMe}|null, over}, offer(kind), answer(ok), resign(), close()} */
  T.onlineBar = function (ctl) {
    var node = el('div', { class: 'c1a-online', role: 'group', 'aria-label': T.t('net.online'), hidden: true });
    var st = el('p', { class: 'c1a-ostat', role: 'status', 'aria-live': 'polite' });
    var prompt = el('div', { class: 'c1a-oprompt', role: 'alert' });
    var btns = el('div', { class: 'c1a-row' });
    node.appendChild(st); node.appendChild(prompt); node.appendChild(btns);
    var lastPrompt = '';
    function b(label, fn, cls) { var x = el('button', { type: 'button', class: 'c1a-btn c1a-sm' + (cls ? ' ' + cls : ''), text: label }); x.addEventListener('click', fn); return x; }
    function refresh() {
      var s = ctl.state();
      node.hidden = !s.online && !s.status;
      st.textContent = s.status || '';
      clear(prompt); clear(btns);
      var what = s.pending ? (ctl.what ? ctl.what(s.pending.o) : T.t('net.what.' + s.pending.o)) : '';
      if (s.pending && !s.pending.fromMe) {
        var msg = T.t('net.offerRecv', { what: what });
        prompt.appendChild(el('span', { text: msg + ' ' }));
        prompt.appendChild(b(T.t('net.accept'), function () { ctl.answer(true); }, 'c1a-pri'));
        prompt.appendChild(b(T.t('net.decline'), function () { ctl.answer(false); }));
        if (msg !== lastPrompt) { T.announce(msg, true); lastPrompt = msg; }
      } else if (s.pending) {
        prompt.appendChild(el('span', { text: T.t('net.offerSent', { what: what }) }));
        lastPrompt = '';
      } else lastPrompt = '';
      if (s.online) {
        btns.appendChild(b(T.t('net.draw'), function () { ctl.offer('draw'); }));
        btns.appendChild(b(T.t('net.newgame'), function () { ctl.offer('new'); }));
        (s.extra || []).forEach(function (x) { btns.appendChild(b(x.label, function () { ctl.offer(x.kind); })); });
        if (!s.over) btns.appendChild(b(T.t('net.resign'), function () { ctl.resign(); }));
      }
      if (s.online || s.canClose) btns.appendChild(b(T.t('net.disconnect'), function () { ctl.close(); }));
      var disable = !!s.pending || !!s.busy, nOff = 2 + (s.extra || []).length;
      [].slice.call(btns.querySelectorAll('button')).forEach(function (x, i) { if (disable && i < nOff) x.disabled = true; });
    }
    return { node: node, refresh: refresh };
  };

  /* ---------- fereastră "hub" cu tab-uri; apelantul oferă tabs ---------- */
  T.hub = function (title, tabs, initial) {
    var p = T.panel({ title: title });
    var tb = T.tabs(p.body, tabs, { initial: initial, label: title });
    p.open(); p.tabs = tb; return p;
  };

  /* ---------- pagina "Accesibilitate" comună (anunțuri / voce) ---------- */
  T.accessPane = function (container, extra) {
    clear(container);
    var a = T.uid('c1a-a'), v = T.uid('c1a-v');
    var ca = el('input', { type: 'checkbox', id: a }); ca.checked = T.prefAnnounce();
    ca.addEventListener('change', function () { T.store.set('acc.announce', ca.checked); });
    var cv = el('input', { type: 'checkbox', id: v }); cv.checked = T.prefVoice();
    var vmsg = el('p', { class: 'c1a-msg', role: 'status' });
    var test = el('button', { type: 'button', class: 'c1a-btn', text: T.t('acc.voiceTest') });
    cv.addEventListener('change', function () {
      T.store.set('acc.voice', cv.checked);
      if (cv.checked && !T.speechSupported()) vmsg.textContent = T.t('acc.voiceNo');
      else vmsg.textContent = '';
    });
    test.addEventListener('click', function () {
      T.speak(T.t('acc.voiceSample')).then(function (r) { vmsg.textContent = r && r.ok === false ? T.t('acc.voiceNo') : ''; });
    });
    container.appendChild(el('p', { text: T.t('acc.intro') }));
    container.appendChild(el('div', { class: 'c1a-row' }, [ca, el('label', { for: a, text: T.t('acc.announce') })]));
    container.appendChild(el('div', { class: 'c1a-row' }, [cv, el('label', { for: v, text: T.t('acc.voice') }), test]));
    container.appendChild(vmsg);
    if (root.FFF && root.FFF.tts && root.FFF.tts.picker && T.speechSupported()) { var holder = el('div', { class: 'c1a-ttsbox' }); container.appendChild(holder); try { root.FFF.tts.picker(holder); } catch (e) { /* ignorat */ } }
    if (extra) extra(container);
  };
})(typeof self !== 'undefined' ? self : this);

/* TBL · texte comune (8 limbi). fr/it/es/pt/hu/de: traduceri automate, neverificate nativ. */
TBL.addDict({
  ro: {
    'close': 'Închide', 'tab.net': 'Joc în doi', 'tab.analysis': 'Analiză', 'tab.daily': 'Provocarea zilei', 'tab.tour': 'Turneu Elo', 'tab.access': 'Accesibilitate',
    'net.kit': 'Modulul pentru joc în doi nu este disponibil în această copie a aplicației.', 'net.unsupported': 'Acest browser nu are WebRTC, deci jocul în doi nu este posibil aici.', 'net.disconnect': 'Închide conexiunea', 'net.declined': 'Propunerea a fost refuzată.',
    'net.lost': 'Conexiune pierdută… se așteaptă revenirea.', 'net.recovered': 'Conexiunea a revenit.', 'net.online': 'Joc online', 'net.what.draw': 'remiză', 'net.what.new': 'o partidă nouă', 'net.offerRecv': 'Adversarul propune {what}.', 'net.offerSent': 'Ai propus {what}; se așteaptă răspunsul…',
    'net.accept': 'Acceptă', 'net.decline': 'Refuză', 'net.draw': 'Propune remiză', 'net.newgame': 'Partidă nouă', 'net.resign': 'Renunță',
    'tour.scale': 'Scală Elo internă a acestui turneu local: oamenii pornesc de la 1200, nivelurile AI de la valori nominale; nu este comparabilă cu clasamentele oficiale (FIDE etc.).', 'tour.new': 'Turneu nou', 'tour.me': 'Eu', 'tour.addHuman': 'Adaugă persoană', 'tour.humanName': 'Numele altui jucător (la aceeași tablă)',
    'tour.double': 'Tur–retur (culorile se inversează)', 'tour.create': 'Creează turneul', 'tour.min2': 'Alege cel puțin doi participanți.', 'tour.max8': 'Cel mult 8 participanți.', 'tour.dupName': 'Doi participanți se numesc „{n}”; dă-le nume diferite.', 'tour.created': 'Turneul a fost creat.',
    'tour.import': 'Importă turneu (.json)', 'tour.badFile': 'Fișierul nu este un turneu valid.', 'tour.standings': 'Clasament', 'tour.player': 'Jucător', 'tour.pts': 'Puncte', 'tour.games': 'Partide', 'tour.wdl': 'V-E-Î', 'tour.winner': 'Turneu încheiat. Câștigător: {n}.',
    'tour.matches': 'Meciuri', 'tour.round': 'Runda {n}', 'tour.clear': 'Șterge rezultatul', 'tour.play': 'Joacă', 'tour.sim': 'Simulează', 'tour.simulating': 'Se simulează…', 'tour.simDone': 'Rezultat simulat: {r}.', 'tour.manual': 'Înregistrează rezultatul', 'tour.recorded': 'Rezultat înregistrat: {r}.',
    'tour.exportJson': 'Exportă JSON', 'tour.exportCsv': 'Exportă CSV', 'tour.newBtn': 'Turneu nou', 'tour.confirmNew': 'Ștergi acest turneu și începi unul nou?', 'tour.yes': 'Da', 'tour.no': 'Nu',
    'acc.intro': 'Opțiuni pentru utilizatorii de cititoare de ecran și pentru cei care preferă să audă jocul.', 'acc.announce': 'Anunțuri într-o regiune live (citite de cititoarele de ecran)', 'acc.voice': 'Anunțuri vorbite (sinteza vocală a browserului)', 'acc.voiceTest': 'Testează vocea',
    'acc.voiceNo': 'Nu există nicio voce disponibilă pe acest dispozitiv (sau browserul o blochează); anunțurile rămân disponibile ca text.', 'acc.voiceSample': 'Test de voce: masa de joc este pregătită.'
  },
  en: {
    'close': 'Close', 'tab.net': 'Two players', 'tab.analysis': 'Analysis', 'tab.daily': 'Daily challenge', 'tab.tour': 'Elo tournament', 'tab.access': 'Accessibility',
    'net.kit': 'The two-player module is not available in this copy of the app.', 'net.unsupported': 'This browser has no WebRTC, so two-player games are not possible here.', 'net.disconnect': 'Close connection', 'net.declined': 'The proposal was declined.',
    'net.lost': 'Connection lost… waiting for it to recover.', 'net.recovered': 'Connection recovered.', 'net.online': 'Online game', 'net.what.draw': 'a draw', 'net.what.new': 'a new game', 'net.offerRecv': 'Your opponent proposes {what}.', 'net.offerSent': 'You proposed {what}; waiting for the answer…',
    'net.accept': 'Accept', 'net.decline': 'Decline', 'net.draw': 'Offer a draw', 'net.newgame': 'New game', 'net.resign': 'Resign',
    'tour.scale': 'Internal Elo scale of this local tournament: people start at 1200, AI levels at nominal values; it is not comparable with FIDE or other official ratings.', 'tour.new': 'New tournament', 'tour.me': 'Me', 'tour.addHuman': 'Add person', 'tour.humanName': 'Name of another player (same board)',
    'tour.double': 'Double round-robin (colours swapped)', 'tour.create': 'Create tournament', 'tour.min2': 'Choose at least two participants.', 'tour.max8': 'At most 8 participants.', 'tour.dupName': 'Two participants are named "{n}"; give them different names.', 'tour.created': 'Tournament created.',
    'tour.import': 'Import tournament (.json)', 'tour.badFile': 'The file is not a valid tournament.', 'tour.standings': 'Standings', 'tour.player': 'Player', 'tour.pts': 'Points', 'tour.games': 'Games', 'tour.wdl': 'W-D-L', 'tour.winner': 'Tournament finished. Winner: {n}.',
    'tour.matches': 'Matches', 'tour.round': 'Round {n}', 'tour.clear': 'Clear result', 'tour.play': 'Play', 'tour.sim': 'Simulate', 'tour.simulating': 'Simulating…', 'tour.simDone': 'Simulated result: {r}.', 'tour.manual': 'Record result', 'tour.recorded': 'Result recorded: {r}.',
    'tour.exportJson': 'Export JSON', 'tour.exportCsv': 'Export CSV', 'tour.newBtn': 'New tournament', 'tour.confirmNew': 'Delete this tournament and start a new one?', 'tour.yes': 'Yes', 'tour.no': 'No',
    'acc.intro': 'Options for screen-reader users and for people who prefer to hear the game.', 'acc.announce': 'Announcements in a live region (read by screen readers)', 'acc.voice': 'Spoken announcements (browser speech synthesis)', 'acc.voiceTest': 'Test voice',
    'acc.voiceNo': 'No voice is available on this device (or the browser blocks it); announcements stay available as text.', 'acc.voiceSample': 'Voice test: the game table is ready.'
  },
  fr: {
    'close': 'Fermer', 'tab.net': 'Deux joueurs', 'tab.analysis': 'Analyse', 'tab.daily': 'Défi du jour', 'tab.tour': 'Tournoi Elo', 'tab.access': 'Accessibilité',
    'net.kit': 'Le module « deux joueurs » n\'est pas disponible dans cette copie de l\'application.', 'net.unsupported': 'Ce navigateur n\'a pas WebRTC : le jeu à deux n\'est pas possible ici.', 'net.disconnect': 'Fermer la connexion', 'net.declined': 'La proposition a été refusée.',
    'net.lost': 'Connexion perdue… en attente de reprise.', 'net.recovered': 'Connexion rétablie.', 'net.online': 'Partie en ligne', 'net.what.draw': 'la nullité', 'net.what.new': 'une nouvelle partie', 'net.offerRecv': 'Votre adversaire propose {what}.', 'net.offerSent': 'Vous avez proposé {what} ; en attente de la réponse…',
    'net.accept': 'Accepter', 'net.decline': 'Refuser', 'net.draw': 'Proposer la nullité', 'net.newgame': 'Nouvelle partie', 'net.resign': 'Abandonner',
    'tour.scale': 'Échelle Elo interne de ce tournoi local : les personnes partent de 1200, les niveaux d\'IA de valeurs nominales ; elle n\'est pas comparable aux classements officiels (FIDE, etc.).', 'tour.new': 'Nouveau tournoi', 'tour.me': 'Moi', 'tour.addHuman': 'Ajouter une personne', 'tour.humanName': 'Nom d\'un autre joueur (même plateau)',
    'tour.double': 'Aller-retour (couleurs inversées)', 'tour.create': 'Créer le tournoi', 'tour.min2': 'Choisissez au moins deux participants.', 'tour.max8': 'Huit participants au maximum.', 'tour.dupName': 'Deux participants s\'appellent « {n} » ; donnez-leur des noms différents.', 'tour.created': 'Tournoi créé.',
    'tour.import': 'Importer un tournoi (.json)', 'tour.badFile': 'Le fichier n\'est pas un tournoi valide.', 'tour.standings': 'Classement', 'tour.player': 'Joueur', 'tour.pts': 'Points', 'tour.games': 'Parties', 'tour.wdl': 'V-N-D', 'tour.winner': 'Tournoi terminé. Vainqueur : {n}.',
    'tour.matches': 'Matchs', 'tour.round': 'Ronde {n}', 'tour.clear': 'Effacer le résultat', 'tour.play': 'Jouer', 'tour.sim': 'Simuler', 'tour.simulating': 'Simulation…', 'tour.simDone': 'Résultat simulé : {r}.', 'tour.manual': 'Enregistrer le résultat', 'tour.recorded': 'Résultat enregistré : {r}.',
    'tour.exportJson': 'Exporter en JSON', 'tour.exportCsv': 'Exporter en CSV', 'tour.newBtn': 'Nouveau tournoi', 'tour.confirmNew': 'Supprimer ce tournoi et en commencer un nouveau ?', 'tour.yes': 'Oui', 'tour.no': 'Non',
    'acc.intro': 'Options pour les utilisateurs de lecteurs d\'écran et pour ceux qui préfèrent entendre la partie.', 'acc.announce': 'Annonces dans une région dynamique (lues par les lecteurs d\'écran)', 'acc.voice': 'Annonces vocales (synthèse vocale du navigateur)', 'acc.voiceTest': 'Tester la voix',
    'acc.voiceNo': 'Aucune voix n\'est disponible sur cet appareil (ou le navigateur la bloque) ; les annonces restent disponibles en texte.', 'acc.voiceSample': 'Test de voix : la table de jeu est prête.'
  },
  it: {
    'close': 'Chiudi', 'tab.net': 'Due giocatori', 'tab.analysis': 'Analisi', 'tab.daily': 'Sfida del giorno', 'tab.tour': 'Torneo Elo', 'tab.access': 'Accessibilità',
    'net.kit': 'Il modulo per due giocatori non è disponibile in questa copia dell\'app.', 'net.unsupported': 'Questo browser non ha WebRTC: il gioco in due non è possibile qui.', 'net.disconnect': 'Chiudi la connessione', 'net.declined': 'La proposta è stata rifiutata.',
    'net.lost': 'Connessione persa… in attesa del ripristino.', 'net.recovered': 'Connessione ripristinata.', 'net.online': 'Partita online', 'net.what.draw': 'la patta', 'net.what.new': 'una nuova partita', 'net.offerRecv': 'L\'avversario propone {what}.', 'net.offerSent': 'Hai proposto {what}; in attesa della risposta…',
    'net.accept': 'Accetta', 'net.decline': 'Rifiuta', 'net.draw': 'Proponi la patta', 'net.newgame': 'Nuova partita', 'net.resign': 'Abbandona',
    'tour.scale': 'Scala Elo interna di questo torneo locale: le persone partono da 1200, i livelli dell\'IA da valori nominali; non è confrontabile con le classifiche ufficiali (FIDE ecc.).', 'tour.new': 'Nuovo torneo', 'tour.me': 'Io', 'tour.addHuman': 'Aggiungi persona', 'tour.humanName': 'Nome di un altro giocatore (stessa scacchiera)',
    'tour.double': 'Andata e ritorno (colori invertiti)', 'tour.create': 'Crea il torneo', 'tour.min2': 'Scegli almeno due partecipanti.', 'tour.max8': 'Al massimo 8 partecipanti.', 'tour.dupName': 'Due partecipanti si chiamano "{n}"; dai loro nomi diversi.', 'tour.created': 'Torneo creato.',
    'tour.import': 'Importa torneo (.json)', 'tour.badFile': 'Il file non è un torneo valido.', 'tour.standings': 'Classifica', 'tour.player': 'Giocatore', 'tour.pts': 'Punti', 'tour.games': 'Partite', 'tour.wdl': 'V-P-S', 'tour.winner': 'Torneo concluso. Vincitore: {n}.',
    'tour.matches': 'Incontri', 'tour.round': 'Turno {n}', 'tour.clear': 'Cancella il risultato', 'tour.play': 'Gioca', 'tour.sim': 'Simula', 'tour.simulating': 'Simulazione…', 'tour.simDone': 'Risultato simulato: {r}.', 'tour.manual': 'Registra il risultato', 'tour.recorded': 'Risultato registrato: {r}.',
    'tour.exportJson': 'Esporta JSON', 'tour.exportCsv': 'Esporta CSV', 'tour.newBtn': 'Nuovo torneo', 'tour.confirmNew': 'Eliminare questo torneo e iniziarne uno nuovo?', 'tour.yes': 'Sì', 'tour.no': 'No',
    'acc.intro': 'Opzioni per chi usa lettori di schermo e per chi preferisce ascoltare la partita.', 'acc.announce': 'Annunci in una regione live (letti dai lettori di schermo)', 'acc.voice': 'Annunci vocali (sintesi vocale del browser)', 'acc.voiceTest': 'Prova la voce',
    'acc.voiceNo': 'Nessuna voce è disponibile su questo dispositivo (o il browser la blocca); gli annunci restano disponibili come testo.', 'acc.voiceSample': 'Prova della voce: il tavolo da gioco è pronto.'
  },
  es: {
    'close': 'Cerrar', 'tab.net': 'Dos jugadores', 'tab.analysis': 'Análisis', 'tab.daily': 'Reto del día', 'tab.tour': 'Torneo Elo', 'tab.access': 'Accesibilidad',
    'net.kit': 'El módulo de dos jugadores no está disponible en esta copia de la aplicación.', 'net.unsupported': 'Este navegador no tiene WebRTC, así que el juego de dos no es posible aquí.', 'net.disconnect': 'Cerrar la conexión', 'net.declined': 'La propuesta fue rechazada.',
    'net.lost': 'Conexión perdida… esperando a que se recupere.', 'net.recovered': 'Conexión recuperada.', 'net.online': 'Partida en línea', 'net.what.draw': 'las tablas', 'net.what.new': 'una partida nueva', 'net.offerRecv': 'Tu oponente propone {what}.', 'net.offerSent': 'Has propuesto {what}; esperando la respuesta…',
    'net.accept': 'Aceptar', 'net.decline': 'Rechazar', 'net.draw': 'Proponer tablas', 'net.newgame': 'Partida nueva', 'net.resign': 'Abandonar',
    'tour.scale': 'Escala Elo interna de este torneo local: las personas empiezan en 1200 y los niveles de IA en valores nominales; no es comparable con las clasificaciones oficiales (FIDE, etc.).', 'tour.new': 'Torneo nuevo', 'tour.me': 'Yo', 'tour.addHuman': 'Añadir persona', 'tour.humanName': 'Nombre de otro jugador (mismo tablero)',
    'tour.double': 'Ida y vuelta (colores invertidos)', 'tour.create': 'Crear el torneo', 'tour.min2': 'Elige al menos dos participantes.', 'tour.max8': 'Como máximo 8 participantes.', 'tour.dupName': 'Dos participantes se llaman «{n}»; dales nombres distintos.', 'tour.created': 'Torneo creado.',
    'tour.import': 'Importar torneo (.json)', 'tour.badFile': 'El archivo no es un torneo válido.', 'tour.standings': 'Clasificación', 'tour.player': 'Jugador', 'tour.pts': 'Puntos', 'tour.games': 'Partidas', 'tour.wdl': 'G-T-P', 'tour.winner': 'Torneo terminado. Ganador: {n}.',
    'tour.matches': 'Encuentros', 'tour.round': 'Ronda {n}', 'tour.clear': 'Borrar el resultado', 'tour.play': 'Jugar', 'tour.sim': 'Simular', 'tour.simulating': 'Simulando…', 'tour.simDone': 'Resultado simulado: {r}.', 'tour.manual': 'Registrar el resultado', 'tour.recorded': 'Resultado registrado: {r}.',
    'tour.exportJson': 'Exportar JSON', 'tour.exportCsv': 'Exportar CSV', 'tour.newBtn': 'Torneo nuevo', 'tour.confirmNew': '¿Borrar este torneo y empezar uno nuevo?', 'tour.yes': 'Sí', 'tour.no': 'No',
    'acc.intro': 'Opciones para usuarios de lectores de pantalla y para quien prefiere oír la partida.', 'acc.announce': 'Anuncios en una región en vivo (leídos por los lectores de pantalla)', 'acc.voice': 'Anuncios hablados (síntesis de voz del navegador)', 'acc.voiceTest': 'Probar la voz',
    'acc.voiceNo': 'No hay ninguna voz disponible en este dispositivo (o el navegador la bloquea); los anuncios siguen disponibles como texto.', 'acc.voiceSample': 'Prueba de voz: la mesa de juego está lista.'
  },
  pt: {
    'close': 'Fechar', 'tab.net': 'Dois jogadores', 'tab.analysis': 'Análise', 'tab.daily': 'Desafio do dia', 'tab.tour': 'Torneio Elo', 'tab.access': 'Acessibilidade',
    'net.kit': 'O módulo de dois jogadores não está disponível nesta cópia da aplicação.', 'net.unsupported': 'Este navegador não tem WebRTC, por isso o jogo a dois não é possível aqui.', 'net.disconnect': 'Fechar a ligação', 'net.declined': 'A proposta foi recusada.',
    'net.lost': 'Ligação perdida… à espera de recuperação.', 'net.recovered': 'Ligação recuperada.', 'net.online': 'Partida online', 'net.what.draw': 'o empate', 'net.what.new': 'uma nova partida', 'net.offerRecv': 'O adversário propõe {what}.', 'net.offerSent': 'Propuseste {what}; à espera da resposta…',
    'net.accept': 'Aceitar', 'net.decline': 'Recusar', 'net.draw': 'Propor empate', 'net.newgame': 'Nova partida', 'net.resign': 'Desistir',
    'tour.scale': 'Escala Elo interna deste torneio local: as pessoas começam em 1200 e os níveis de IA em valores nominais; não é comparável com as classificações oficiais (FIDE, etc.).', 'tour.new': 'Novo torneio', 'tour.me': 'Eu', 'tour.addHuman': 'Adicionar pessoa', 'tour.humanName': 'Nome de outro jogador (no mesmo tabuleiro)',
    'tour.double': 'Ida e volta (cores trocadas)', 'tour.create': 'Criar o torneio', 'tour.min2': 'Escolhe pelo menos dois participantes.', 'tour.max8': 'No máximo 8 participantes.', 'tour.dupName': 'Dois participantes chamam-se «{n}»; dá-lhes nomes diferentes.', 'tour.created': 'Torneio criado.',
    'tour.import': 'Importar torneio (.json)', 'tour.badFile': 'O ficheiro não é um torneio válido.', 'tour.standings': 'Classificação', 'tour.player': 'Jogador', 'tour.pts': 'Pontos', 'tour.games': 'Partidas', 'tour.wdl': 'V-E-D', 'tour.winner': 'Torneio terminado. Vencedor: {n}.',
    'tour.matches': 'Encontros', 'tour.round': 'Ronda {n}', 'tour.clear': 'Apagar o resultado', 'tour.play': 'Jogar', 'tour.sim': 'Simular', 'tour.simulating': 'A simular…', 'tour.simDone': 'Resultado simulado: {r}.', 'tour.manual': 'Registar o resultado', 'tour.recorded': 'Resultado registado: {r}.',
    'tour.exportJson': 'Exportar JSON', 'tour.exportCsv': 'Exportar CSV', 'tour.newBtn': 'Novo torneio', 'tour.confirmNew': 'Apagar este torneio e começar um novo?', 'tour.yes': 'Sim', 'tour.no': 'Não',
    'acc.intro': 'Opções para utilizadores de leitores de ecrã e para quem prefere ouvir a partida.', 'acc.announce': 'Anúncios numa região dinâmica (lidos pelos leitores de ecrã)', 'acc.voice': 'Anúncios falados (síntese de voz do navegador)', 'acc.voiceTest': 'Testar a voz',
    'acc.voiceNo': 'Não há nenhuma voz disponível neste dispositivo (ou o navegador bloqueia-a); os anúncios continuam disponíveis em texto.', 'acc.voiceSample': 'Teste de voz: a mesa de jogo está pronta.'
  },
  hu: {
    'close': 'Bezárás', 'tab.net': 'Két játékos', 'tab.analysis': 'Elemzés', 'tab.daily': 'A nap feladata', 'tab.tour': 'Elo-verseny', 'tab.access': 'Hozzáférhetőség',
    'net.kit': 'A kétszemélyes játék modulja nem érhető el az alkalmazás ebben a példányában.', 'net.unsupported': 'Ez a böngésző nem támogatja a WebRTC-t, ezért itt nem lehet kettesben játszani.', 'net.disconnect': 'Kapcsolat bontása', 'net.declined': 'Az ajánlatot elutasították.',
    'net.lost': 'A kapcsolat megszakadt… várakozás a helyreállásra.', 'net.recovered': 'A kapcsolat helyreállt.', 'net.online': 'Online játszma', 'net.what.draw': 'a döntetlent', 'net.what.new': 'egy új játszmát', 'net.offerRecv': 'Az ellenfél ezt javasolja: {what}.', 'net.offerSent': 'Ezt javasoltad: {what}; várakozás a válaszra…',
    'net.accept': 'Elfogad', 'net.decline': 'Elutasít', 'net.draw': 'Döntetlen ajánlása', 'net.newgame': 'Új játszma', 'net.resign': 'Feladás',
    'tour.scale': 'Ennek a helyi versenynek a belső Elo-skálája: az emberek 1200-ról, az MI-szintek névleges értékről indulnak; nem összehasonlítható a hivatalos ranglistákkal (FIDE stb.).', 'tour.new': 'Új verseny', 'tour.me': 'Én', 'tour.addHuman': 'Személy hozzáadása', 'tour.humanName': 'Másik játékos neve (ugyanazon a táblán)',
    'tour.double': 'Oda-vissza (színcserével)', 'tour.create': 'Verseny létrehozása', 'tour.min2': 'Válassz legalább két résztvevőt.', 'tour.max8': 'Legfeljebb 8 résztvevő.', 'tour.dupName': 'Két résztvevő neve „{n}”; adj nekik különböző nevet.', 'tour.created': 'A verseny létrejött.',
    'tour.import': 'Verseny importálása (.json)', 'tour.badFile': 'A fájl nem érvényes verseny.', 'tour.standings': 'Állás', 'tour.player': 'Játékos', 'tour.pts': 'Pont', 'tour.games': 'Játszma', 'tour.wdl': 'Gy-D-V', 'tour.winner': 'A verseny véget ért. Győztes: {n}.',
    'tour.matches': 'Mérkőzések', 'tour.round': '{n}. forduló', 'tour.clear': 'Eredmény törlése', 'tour.play': 'Játék', 'tour.sim': 'Szimuláció', 'tour.simulating': 'Szimuláció…', 'tour.simDone': 'Szimulált eredmény: {r}.', 'tour.manual': 'Eredmény rögzítése', 'tour.recorded': 'Eredmény rögzítve: {r}.',
    'tour.exportJson': 'Exportálás JSON-ba', 'tour.exportCsv': 'Exportálás CSV-be', 'tour.newBtn': 'Új verseny', 'tour.confirmNew': 'Törlöd ezt a versenyt és újat kezdesz?', 'tour.yes': 'Igen', 'tour.no': 'Nem',
    'acc.intro': 'Beállítások képernyőolvasót használóknak és azoknak, akik inkább hallgatják a játékot.', 'acc.announce': 'Bejelentések élő régióban (a képernyőolvasók felolvassák)', 'acc.voice': 'Felolvasott bejelentések (a böngésző beszédszintézise)', 'acc.voiceTest': 'Hang kipróbálása',
    'acc.voiceNo': 'Ezen az eszközön nincs elérhető hang (vagy a böngésző blokkolja); a bejelentések szövegként továbbra is elérhetők.', 'acc.voiceSample': 'Hangpróba: a játékasztal készen áll.'
  },
  de: {
    'close': 'Schließen', 'tab.net': 'Zwei Spieler', 'tab.analysis': 'Analyse', 'tab.daily': 'Tagesaufgabe', 'tab.tour': 'Elo-Turnier', 'tab.access': 'Barrierefreiheit',
    'net.kit': 'Das Modul für zwei Spieler ist in dieser Kopie der App nicht verfügbar.', 'net.unsupported': 'Dieser Browser hat kein WebRTC, daher ist ein Spiel zu zweit hier nicht möglich.', 'net.disconnect': 'Verbindung schließen', 'net.declined': 'Der Vorschlag wurde abgelehnt.',
    'net.lost': 'Verbindung verloren… warte auf Wiederherstellung.', 'net.recovered': 'Verbindung wiederhergestellt.', 'net.online': 'Online-Partie', 'net.what.draw': 'ein Remis', 'net.what.new': 'eine neue Partie', 'net.offerRecv': 'Dein Gegner schlägt {what} vor.', 'net.offerSent': 'Du hast {what} vorgeschlagen; warte auf die Antwort…',
    'net.accept': 'Annehmen', 'net.decline': 'Ablehnen', 'net.draw': 'Remis anbieten', 'net.newgame': 'Neue Partie', 'net.resign': 'Aufgeben',
    'tour.scale': 'Interne Elo-Skala dieses lokalen Turniers: Menschen starten bei 1200, KI-Stufen bei Nennwerten; sie ist nicht mit offiziellen Wertungen (FIDE usw.) vergleichbar.', 'tour.new': 'Neues Turnier', 'tour.me': 'Ich', 'tour.addHuman': 'Person hinzufügen', 'tour.humanName': 'Name eines weiteren Spielers (am selben Brett)',
    'tour.double': 'Hin- und Rückrunde (Farben getauscht)', 'tour.create': 'Turnier erstellen', 'tour.min2': 'Wähle mindestens zwei Teilnehmer.', 'tour.max8': 'Höchstens 8 Teilnehmer.', 'tour.dupName': 'Zwei Teilnehmer heißen „{n}“; gib ihnen verschiedene Namen.', 'tour.created': 'Turnier erstellt.',
    'tour.import': 'Turnier importieren (.json)', 'tour.badFile': 'Die Datei ist kein gültiges Turnier.', 'tour.standings': 'Tabelle', 'tour.player': 'Spieler', 'tour.pts': 'Punkte', 'tour.games': 'Partien', 'tour.wdl': 'S-R-N', 'tour.winner': 'Turnier beendet. Sieger: {n}.',
    'tour.matches': 'Begegnungen', 'tour.round': 'Runde {n}', 'tour.clear': 'Ergebnis löschen', 'tour.play': 'Spielen', 'tour.sim': 'Simulieren', 'tour.simulating': 'Simuliere…', 'tour.simDone': 'Simuliertes Ergebnis: {r}.', 'tour.manual': 'Ergebnis eintragen', 'tour.recorded': 'Ergebnis eingetragen: {r}.',
    'tour.exportJson': 'Als JSON exportieren', 'tour.exportCsv': 'Als CSV exportieren', 'tour.newBtn': 'Neues Turnier', 'tour.confirmNew': 'Dieses Turnier löschen und ein neues beginnen?', 'tour.yes': 'Ja', 'tour.no': 'Nein',
    'acc.intro': 'Optionen für Nutzer von Screenreadern und für alle, die das Spiel lieber hören.', 'acc.announce': 'Ansagen in einem Live-Bereich (von Screenreadern vorgelesen)', 'acc.voice': 'Gesprochene Ansagen (Sprachausgabe des Browsers)', 'acc.voiceTest': 'Stimme testen',
    'acc.voiceNo': 'Auf diesem Gerät ist keine Stimme verfügbar (oder der Browser blockiert sie); die Ansagen bleiben als Text verfügbar.', 'acc.voiceSample': 'Stimmtest: Der Spieltisch ist bereit.'
  }
});


  /* =====================================================================================
     FFF.games · motorul comun de jocuri: istoric local, clasament Elo pe nume, turnee hot-seat
     și un hub „Turneu & Elo” atașabil oricărui joc (fără AI în rețea: jocurile rulează cu connect-src 'none').
     Miezul pur (record/ladder/history/export/import) nu atinge DOM-ul și se testează în Node. */
  var T = TBL, doc = typeof document !== 'undefined' ? document : null, el = T.el, clear = T.clear;
  var G = {}, MAXH = 300, START = 1200;
  function key(k) { return String(k || 'joc').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 40) || 'joc'; }
  function cleanName(n) { return String(n == null ? '' : n).replace(/\s+/g, ' ').trim().slice(0, 24); }
  function ladderRaw(k) { var L = T.store.get('lad.' + key(k), null); return L && typeof L === 'object' && !Array.isArray(L) ? L : {}; }
  /** Notează o partidă: res = scorul lui A (1 / 0.5 / 0). Actualizează istoricul și clasamentul Elo (K 40/28/20 după numărul de partide). */
  G.record = function (k, a, b, res, meta) {
    a = cleanName(a); b = cleanName(b);
    if (!a || !b || a.toLowerCase() === b.toLowerCase()) throw new Error('players');
    if (res !== 1 && res !== 0 && res !== 0.5) throw new Error('result');
    var L = ladderRaw(k), A = L[a] || (L[a] = { r: START, g: 0, w: 0, d: 0, l: 0 }), B = L[b] || (L[b] = { r: START, g: 0, w: 0, d: 0, l: 0 });
    var n = T.elo.update(A.r, B.r, res, A.g, B.g), da = n[0] - A.r, db = n[1] - B.r;
    A.r = n[0]; B.r = n[1]; A.g++; B.g++;
    if (res === 1) { A.w++; B.l++; } else if (res === 0) { A.l++; B.w++; } else { A.d++; B.d++; }
    T.store.set('lad.' + key(k), L);
    var H = G.history(k); H.push({ at: new Date().toISOString(), a: a, b: b, res: res, meta: meta || null });
    if (H.length > MAXH) H = H.slice(H.length - MAXH);
    T.store.set('his.' + key(k), H);
    return { a: { name: a, r: A.r, delta: da }, b: { name: b, r: B.r, delta: db } };
  };
  G.history = function (k) { var H = T.store.get('his.' + key(k), []); return Array.isArray(H) ? H.slice() : []; };
  G.ladder = function (k) {
    var L = ladderRaw(k);
    return Object.keys(L).map(function (n) { var p = L[n]; return { name: n, r: p.r, g: p.g, w: p.w, d: p.d, l: p.l }; })
      .sort(function (x, y) { return (y.r - x.r) || (x.name < y.name ? -1 : 1); });
  };
  G.clear = function (k) { T.store.remove('lad.' + key(k)); T.store.remove('his.' + key(k)); };
  G.exportJSON = function (k) { return JSON.stringify({ fff: 'games', v: 1, game: key(k), history: G.history(k) }, null, 1); };
  /** Importă un istoric exportat: se reia calculul Elo din zero în ordinea partidelor (clasamentul decurge din istoric). Aruncă la format greșit. */
  G.importJSON = function (k, json) {
    var o = JSON.parse(json);
    if (!o || o.fff !== 'games' || o.v !== 1 || !Array.isArray(o.history) || o.history.length > MAXH) throw new Error('format');
    o.history.forEach(function (m) { if (!m || typeof m.a !== 'string' || typeof m.b !== 'string' || [0, 0.5, 1].indexOf(m.res) < 0 || !cleanName(m.a) || !cleanName(m.b) || cleanName(m.a).toLowerCase() === cleanName(m.b).toLowerCase()) throw new Error('format'); });
    G.clear(k);
    o.history.forEach(function (m) { G.record(k, m.a, m.b, m.res, m.meta); });
    return o.history.length;
  };
  G.toCSV = function (k) {
    var rows = ['pozitie;nume;elo;jocuri;V;E;I'];
    G.ladder(k).forEach(function (p, i) { rows.push([i + 1, '"' + p.name.replace(/"/g, '""') + '"', Math.round(p.r), p.g, p.w, p.d, p.l].join(';')); });
    return rows.join('\n');
  };

  /* ---------- texte (8 limbi). fr/it/es/pt/hu/de: traduceri automate, neverificate nativ. ---------- */
  TBL.addDict({
    ro: { 'jg.open': 'Turneu și Elo', 'jg.title': 'Turneu și clasament Elo', 'jg.tab.result': 'Partidă', 'jg.tab.tour': 'Turneu', 'jg.tab.ladder': 'Clasament', 'jg.tab.hist': 'Istoric',
      'jg.hint': 'Rezultatele se notează manual, la masă. Nimic nu pleacă de pe acest dispozitiv; clasamentul rămâne în acest browser.', 'jg.pa': 'Jucător 1 ({l})', 'jg.pb': 'Jucător 2 ({l})', 'jg.res': 'Rezultat', 'jg.r1': 'Câștigă jucătorul 1', 'jg.r05': 'Remiză', 'jg.r0': 'Câștigă jucătorul 2',
      'jg.note': 'Notează rezultatul', 'jg.saved': '{a} {da} · {b} {db} (Elo)', 'jg.bad': 'Alege doi jucători diferiți.', 'jg.empty': 'Nu există încă partide.', 'jg.clear': 'Șterge clasamentul și istoricul', 'jg.confirm': 'Ștergi tot istoricul și clasamentul?',
      'jg.exp': 'Exportă istoric (.json)', 'jg.csv': 'Exportă clasament (.csv)', 'jg.imp': 'Importă istoric', 'jg.impok': 'Importate {n} partide.', 'jg.impbad': 'Fișier invalid.' },
    en: { 'jg.open': 'Tournament & Elo', 'jg.title': 'Tournament and Elo ladder', 'jg.tab.result': 'Game', 'jg.tab.tour': 'Tournament', 'jg.tab.ladder': 'Ladder', 'jg.tab.hist': 'History',
      'jg.hint': 'Results are entered by hand at the table. Nothing leaves this device; the ladder stays in this browser.', 'jg.pa': 'Player 1 ({l})', 'jg.pb': 'Player 2 ({l})', 'jg.res': 'Result', 'jg.r1': 'Player 1 wins', 'jg.r05': 'Draw', 'jg.r0': 'Player 2 wins',
      'jg.note': 'Record result', 'jg.saved': '{a} {da} · {b} {db} (Elo)', 'jg.bad': 'Pick two different players.', 'jg.empty': 'No games yet.', 'jg.clear': 'Delete ladder and history', 'jg.confirm': 'Delete the whole history and ladder?',
      'jg.exp': 'Export history (.json)', 'jg.csv': 'Export ladder (.csv)', 'jg.imp': 'Import history', 'jg.impok': 'Imported {n} games.', 'jg.impbad': 'Invalid file.' },
    fr: { 'jg.open': 'Tournoi et Elo', 'jg.title': 'Tournoi et classement Elo', 'jg.tab.result': 'Partie', 'jg.tab.tour': 'Tournoi', 'jg.tab.ladder': 'Classement', 'jg.tab.hist': 'Historique',
      'jg.hint': 'Les résultats se saisissent à la main, à la table. Rien ne quitte cet appareil ; le classement reste dans ce navigateur.', 'jg.pa': 'Joueur 1 ({l})', 'jg.pb': 'Joueur 2 ({l})', 'jg.res': 'Résultat', 'jg.r1': 'Le joueur 1 gagne', 'jg.r05': 'Nulle', 'jg.r0': 'Le joueur 2 gagne',
      'jg.note': 'Noter le résultat', 'jg.saved': '{a} {da} · {b} {db} (Elo)', 'jg.bad': 'Choisissez deux joueurs différents.', 'jg.empty': 'Aucune partie pour le moment.', 'jg.clear': 'Effacer classement et historique', 'jg.confirm': 'Effacer tout l’historique et le classement ?',
      'jg.exp': 'Exporter l’historique (.json)', 'jg.csv': 'Exporter le classement (.csv)', 'jg.imp': 'Importer un historique', 'jg.impok': '{n} parties importées.', 'jg.impbad': 'Fichier invalide.' },
    it: { 'jg.open': 'Torneo ed Elo', 'jg.title': 'Torneo e classifica Elo', 'jg.tab.result': 'Partita', 'jg.tab.tour': 'Torneo', 'jg.tab.ladder': 'Classifica', 'jg.tab.hist': 'Cronologia',
      'jg.hint': 'I risultati si inseriscono a mano, al tavolo. Nulla lascia questo dispositivo; la classifica resta in questo browser.', 'jg.pa': 'Giocatore 1 ({l})', 'jg.pb': 'Giocatore 2 ({l})', 'jg.res': 'Risultato', 'jg.r1': 'Vince il giocatore 1', 'jg.r05': 'Patta', 'jg.r0': 'Vince il giocatore 2',
      'jg.note': 'Registra il risultato', 'jg.saved': '{a} {da} · {b} {db} (Elo)', 'jg.bad': 'Scegli due giocatori diversi.', 'jg.empty': 'Ancora nessuna partita.', 'jg.clear': 'Elimina classifica e cronologia', 'jg.confirm': 'Eliminare tutta la cronologia e la classifica?',
      'jg.exp': 'Esporta cronologia (.json)', 'jg.csv': 'Esporta classifica (.csv)', 'jg.imp': 'Importa cronologia', 'jg.impok': 'Importate {n} partite.', 'jg.impbad': 'File non valido.' },
    es: { 'jg.open': 'Torneo y Elo', 'jg.title': 'Torneo y clasificación Elo', 'jg.tab.result': 'Partida', 'jg.tab.tour': 'Torneo', 'jg.tab.ladder': 'Clasificación', 'jg.tab.hist': 'Historial',
      'jg.hint': 'Los resultados se anotan a mano, en la mesa. Nada sale de este dispositivo; la clasificación queda en este navegador.', 'jg.pa': 'Jugador 1 ({l})', 'jg.pb': 'Jugador 2 ({l})', 'jg.res': 'Resultado', 'jg.r1': 'Gana el jugador 1', 'jg.r05': 'Tablas', 'jg.r0': 'Gana el jugador 2',
      'jg.note': 'Anotar resultado', 'jg.saved': '{a} {da} · {b} {db} (Elo)', 'jg.bad': 'Elige dos jugadores distintos.', 'jg.empty': 'Aún no hay partidas.', 'jg.clear': 'Borrar clasificación e historial', 'jg.confirm': '¿Borrar todo el historial y la clasificación?',
      'jg.exp': 'Exportar historial (.json)', 'jg.csv': 'Exportar clasificación (.csv)', 'jg.imp': 'Importar historial', 'jg.impok': '{n} partidas importadas.', 'jg.impbad': 'Archivo no válido.' },
    pt: { 'jg.open': 'Torneio e Elo', 'jg.title': 'Torneio e classificação Elo', 'jg.tab.result': 'Partida', 'jg.tab.tour': 'Torneio', 'jg.tab.ladder': 'Classificação', 'jg.tab.hist': 'Histórico',
      'jg.hint': 'Os resultados são anotados à mão, à mesa. Nada sai deste dispositivo; a classificação fica neste navegador.', 'jg.pa': 'Jogador 1 ({l})', 'jg.pb': 'Jogador 2 ({l})', 'jg.res': 'Resultado', 'jg.r1': 'O jogador 1 vence', 'jg.r05': 'Empate', 'jg.r0': 'O jogador 2 vence',
      'jg.note': 'Anotar resultado', 'jg.saved': '{a} {da} · {b} {db} (Elo)', 'jg.bad': 'Escolha dois jogadores diferentes.', 'jg.empty': 'Ainda não há partidas.', 'jg.clear': 'Apagar classificação e histórico', 'jg.confirm': 'Apagar todo o histórico e a classificação?',
      'jg.exp': 'Exportar histórico (.json)', 'jg.csv': 'Exportar classificação (.csv)', 'jg.imp': 'Importar histórico', 'jg.impok': '{n} partidas importadas.', 'jg.impbad': 'Ficheiro inválido.' },
    hu: { 'jg.open': 'Verseny és Elo', 'jg.title': 'Verseny és Elo-ranglista', 'jg.tab.result': 'Játszma', 'jg.tab.tour': 'Verseny', 'jg.tab.ladder': 'Ranglista', 'jg.tab.hist': 'Előzmények',
      'jg.hint': 'Az eredményeket kézzel rögzítjük az asztalnál. Semmi sem hagyja el az eszközt; a ranglista ebben a böngészőben marad.', 'jg.pa': '1. játékos ({l})', 'jg.pb': '2. játékos ({l})', 'jg.res': 'Eredmény', 'jg.r1': 'Az 1. játékos nyer', 'jg.r05': 'Döntetlen', 'jg.r0': 'A 2. játékos nyer',
      'jg.note': 'Eredmény rögzítése', 'jg.saved': '{a} {da} · {b} {db} (Elo)', 'jg.bad': 'Válassz két különböző játékost.', 'jg.empty': 'Még nincs játszma.', 'jg.clear': 'Ranglista és előzmények törlése', 'jg.confirm': 'Törlöd a teljes előzményt és ranglistát?',
      'jg.exp': 'Előzmények exportja (.json)', 'jg.csv': 'Ranglista exportja (.csv)', 'jg.imp': 'Előzmények importja', 'jg.impok': '{n} játszma importálva.', 'jg.impbad': 'Érvénytelen fájl.' },
    de: { 'jg.open': 'Turnier und Elo', 'jg.title': 'Turnier und Elo-Rangliste', 'jg.tab.result': 'Partie', 'jg.tab.tour': 'Turnier', 'jg.tab.ladder': 'Rangliste', 'jg.tab.hist': 'Verlauf',
      'jg.hint': 'Ergebnisse werden von Hand am Tisch eingetragen. Nichts verlässt dieses Gerät; die Rangliste bleibt in diesem Browser.', 'jg.pa': 'Spieler 1 ({l})', 'jg.pb': 'Spieler 2 ({l})', 'jg.res': 'Ergebnis', 'jg.r1': 'Spieler 1 gewinnt', 'jg.r05': 'Remis', 'jg.r0': 'Spieler 2 gewinnt',
      'jg.note': 'Ergebnis eintragen', 'jg.saved': '{a} {da} · {b} {db} (Elo)', 'jg.bad': 'Wähle zwei verschiedene Spieler.', 'jg.empty': 'Noch keine Partien.', 'jg.clear': 'Rangliste und Verlauf löschen', 'jg.confirm': 'Gesamten Verlauf und Rangliste löschen?',
      'jg.exp': 'Verlauf exportieren (.json)', 'jg.csv': 'Rangliste exportieren (.csv)', 'jg.imp': 'Verlauf importieren', 'jg.impok': '{n} Partien importiert.', 'jg.impbad': 'Ungültige Datei.' }
  });

  var CSS = ".c1a-sr{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}\ndialog.c1a-dlg,.c1a-online,.c1a-scope{--c1a-bg:#fff;--c1a-fg:#16161a;--c1a-muted:#4d4d57;--c1a-line:#6b6b75;--c1a-accent:#1d4ed8;--c1a-on-accent:#fff;--c1a-field:#fff;--c1a-ok:#116611;--c1a-err:#a11a1a;--c1a-soft:#eef0f6}\n@media (prefers-color-scheme:dark){dialog.c1a-dlg,.c1a-online,.c1a-scope{--c1a-bg:#1c1c21;--c1a-fg:#ececf1;--c1a-muted:#b5b5c0;--c1a-line:#8d8d99;--c1a-accent:#8ab4ff;--c1a-on-accent:#0b0b10;--c1a-field:#111116;--c1a-ok:#7ee08a;--c1a-err:#ff9d9d;--c1a-soft:#26262e}}\ndialog.c1a-dlg{box-sizing:border-box;width:min(46rem,calc(100vw - 1.5rem));max-height:calc(100vh - 1.5rem);overflow:auto;padding:0;border:1px solid var(--c1a-line);border-radius:14px;background:var(--c1a-bg);color:var(--c1a-fg);font:inherit;line-height:1.5}\ndialog.c1a-dlg::backdrop{background:rgba(0,0,0,.6)}\ndialog.c1a-dlg *,.c1a-online *{box-sizing:border-box}\n.c1a-dlg-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px 6px;position:sticky;top:0;background:var(--c1a-bg);z-index:2}\n.c1a-dlg-head h2{margin:0;font-size:1.3rem;line-height:1.2}\n.c1a-dlg-body{padding:6px 16px 18px}\n.c1a-dlg h3{margin:1rem 0 .3rem;font-size:1.05rem}\n.c1a-dlg h4{margin:.8rem 0 .2rem;font-size:.95rem}\n.c1a-dlg p{margin:.4rem 0}\n.c1a-btn{font:inherit;font-size:.95rem;min-height:36px;min-width:36px;padding:6px 14px;border:1px solid var(--c1a-line);border-radius:9px;background:var(--c1a-soft);color:var(--c1a-fg);cursor:pointer}\n.c1a-btn:hover:not([disabled]){border-color:var(--c1a-accent)}\n.c1a-btn[disabled]{opacity:.55;cursor:not-allowed}\n.c1a-btn.c1a-pri{background:var(--c1a-accent);color:var(--c1a-on-accent);border-color:var(--c1a-accent);font-weight:700}\n.c1a-btn.c1a-sm{min-height:32px;padding:3px 10px;font-size:.88rem}\n.c1a-x{flex:none;width:40px;height:40px;padding:0;font-size:1.1rem}\n.c1a-dlg :focus-visible,.c1a-online :focus-visible,.c1a-scope :focus-visible{outline:3px solid #f59e0b;outline-offset:2px}\n.c1a-tablist{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px;border-bottom:1px solid var(--c1a-line);padding-bottom:8px}\n.c1a-tab[aria-selected=true]{background:var(--c1a-accent);color:var(--c1a-on-accent);border-color:var(--c1a-accent);font-weight:700}\n.c1a-pane[hidden]{display:none}\n.c1a-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:.5rem 0}\n.c1a-row input[type=checkbox]{width:24px;height:24px;flex:none}\n.c1a-row label{font-weight:600}\n.c1a-dlg input[type=text],.c1a-dlg input[type=number],.c1a-dlg select,.c1a-scope input[type=text],.c1a-scope select{font:inherit;min-height:36px;padding:4px 8px;border:1px solid var(--c1a-line);border-radius:7px;background:var(--c1a-field);color:var(--c1a-fg);max-width:100%}\n.c1a-note,.c1a-small{color:var(--c1a-muted);font-size:.88rem}\n.c1a-msg{min-height:1.4em;font-weight:600}\n.c1a-ok{color:var(--c1a-ok);font-weight:700}\n.c1a-err{color:var(--c1a-err);font-weight:700}\n.c1a-plist{list-style:none;margin:.3rem 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(12rem,1fr));gap:4px 12px}\n.c1a-plist li{display:flex;gap:8px;align-items:center}\n.c1a-plist input{width:22px;height:22px;flex:none}\n.c1a-scroll{overflow-x:auto}\n.c1a-table{border-collapse:collapse;width:100%;font-size:.92rem}\n.c1a-table th,.c1a-table td{border-bottom:1px solid var(--c1a-line);padding:5px 8px;text-align:left}\n.c1a-table thead th{font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:var(--c1a-muted)}\n.c1a-matches{list-style:none;margin:0;padding:0}\n.c1a-match{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;padding:5px 0;border-bottom:1px dashed var(--c1a-line)}\n.c1a-mname{flex:1 1 14rem;min-width:0;overflow-wrap:anywhere}\n.c1a-mres{min-width:3rem;text-align:center}\n.c1a-confirm{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-weight:600}\n.c1a-ttsbox{margin-top:.6rem}\n.c1a-online{margin:8px 0;padding:8px 10px;border:1px solid var(--c1a-line);border-radius:10px;background:var(--c1a-bg);color:var(--c1a-fg)}\n.c1a-online[hidden]{display:none}\n.c1a-ostat{margin:0 0 4px;font-weight:700}\n.c1a-oprompt{margin:4px 0}\n.c1a-oprompt:empty{display:none}\n.c1a-meter{height:14px;border-radius:7px;border:1px solid var(--c1a-line);background:#222;overflow:hidden;position:relative}\n.c1a-meter>i{position:absolute;left:0;top:0;bottom:0;background:#f2efe6;display:block}\n.c1a-list{margin:.3rem 0;padding-left:1.2rem}\n.c1a-list li{margin:.15rem 0}\n.c1a-bad{color:var(--c1a-err);font-weight:700}\n.c1a-good{color:var(--c1a-ok);font-weight:700}\n@media (max-width:480px){dialog.c1a-dlg{width:calc(100vw - 1rem)}.c1a-dlg-body{padding:6px 12px 16px}.c1a-match{flex-direction:column;align-items:stretch}.c1a-match .c1a-btn{width:100%}}\n@media (prefers-reduced-motion:reduce){dialog.c1a-dlg *,.c1a-online *{animation:none!important;transition:none!important}}";
  G.css = CSS;
  function ensureCss() {
    if (!doc || doc.getElementById('fff-jocuri-css')) return;
    var s = doc.createElement('style'); s.id = 'fff-jocuri-css'; s.textContent = CSS + '\n.fff-jg-open{position:fixed;left:12px;bottom:12px;z-index:2147483000;min-height:44px;padding:6px 14px;border-radius:22px;border:2px solid #1d4ed8;background:#fff;color:#16161a;font:600 .9rem system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){.fff-jg-open{background:#1c1c21;color:#f1f1f4;border-color:#8ab4ff}}.fff-jg-open:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}.fff-jg-form label{display:block;font-weight:600;margin:.5rem 0 .15rem}.fff-jg-form input[type=text],.fff-jg-form select{font:inherit;width:100%;max-width:22rem;min-height:36px;padding:4px 8px;box-sizing:border-box;border:1px solid var(--c1a-line);border-radius:6px;background:var(--c1a-field);color:var(--c1a-fg)}';
    (doc.head || doc.documentElement).appendChild(s);
  }
  function dlFile(name, text, mime) {
    try { var url = URL.createObjectURL(new Blob([text], { type: mime })), a = el('a', { href: url, download: name }); doc.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 3000); } catch (e) { /* ignorat */ }
  }
  /** Atașează hub-ul „Turneu și Elo” unui joc. opts: {key, name?, firstLabel?, secondLabel?, play?(match,A,B), button?:false} → {open, button, key}. */
  G.attach = function (opts) {
    opts = opts || {}; ensureCss();
    var k = key(opts.key), fl = opts.firstLabel || '1', sl = opts.secondLabel || '2';
    T.setPrefix('fffg_');
    var tour = T.tournament({ key: 'jg-' + k });
    function tabResult(p) {
      var f = el('div', { class: 'fff-jg-form' }), msg = el('p', { class: 'c1a-msg', role: 'status' });
      var ia = T.uid('jg-a'), ib = T.uid('jg-b'), ir = T.uid('jg-r');
      var A = el('input', { type: 'text', id: ia, maxlength: '24', autocomplete: 'off', list: ia + '-l' }), B = el('input', { type: 'text', id: ib, maxlength: '24', autocomplete: 'off', list: ib + '-l' });
      var names = G.ladder(k).map(function (x) { return x.name; });
      var dl1 = el('datalist', { id: ia + '-l' }, names.map(function (n) { return el('option', { value: n }); })), dl2 = el('datalist', { id: ib + '-l' }, names.map(function (n) { return el('option', { value: n }); }));
      var R = el('select', { id: ir }, [el('option', { value: '1', text: T.t('jg.r1') }), el('option', { value: '0.5', text: T.t('jg.r05') }), el('option', { value: '0', text: T.t('jg.r0') })]);
      var ok = el('button', { type: 'button', class: 'c1a-btn c1a-pri', text: T.t('jg.note') });
      ok.addEventListener('click', function () {
        try {
          var r = G.record(k, A.value, B.value, parseFloat(R.value), { how: 'man' });
          var sg = function (d) { return (d >= 0 ? '+' : '') + d.toFixed(1); };
          msg.className = 'c1a-msg c1a-ok'; msg.textContent = T.t('jg.saved', { a: r.a.name, da: sg(r.a.delta), b: r.b.name, db: sg(r.b.delta) }); T.announce(msg.textContent);
        } catch (e) { msg.className = 'c1a-msg c1a-err'; msg.textContent = T.t('jg.bad'); A.focus(); }
      });
      f.appendChild(el('p', { class: 'c1a-note', text: T.t('jg.hint') }));
      f.appendChild(el('label', { for: ia, text: T.t('jg.pa', { l: fl }) })); f.appendChild(A); f.appendChild(dl1);
      f.appendChild(el('label', { for: ib, text: T.t('jg.pb', { l: sl }) })); f.appendChild(B); f.appendChild(dl2);
      f.appendChild(el('label', { for: ir, text: T.t('jg.res') })); f.appendChild(R);
      f.appendChild(el('div', { class: 'c1a-row' }, [ok])); f.appendChild(msg); p.appendChild(f);
    }
    function tabTour(p) { T.tournamentUI(p, tour, { firstLabel: fl, secondLabel: sl, play: opts.play || null }); }
    function tabLadder(p) {
      var L = G.ladder(k);
      if (!L.length) { p.appendChild(el('p', { text: T.t('jg.empty') })); return; }
      var tb = el('table', { class: 'c1a-table' });
      tb.appendChild(el('caption', { class: 'c1a-sr', text: T.t('jg.tab.ladder') }));
      tb.appendChild(el('thead', null, el('tr', null, ['#', T.t('tour.player'), 'Elo', T.t('tour.games'), T.t('tour.wdl')].map(function (h) { return el('th', { scope: 'col', text: h }); }))));
      var tbd = el('tbody');
      L.forEach(function (x, i) { tbd.appendChild(el('tr', null, [el('td', { text: String(i + 1) }), el('th', { scope: 'row', text: x.name }), el('td', { text: String(Math.round(x.r)) }), el('td', { text: String(x.g) }), el('td', { text: x.w + '/' + x.d + '/' + x.l })])); });
      tb.appendChild(tbd); p.appendChild(el('div', { class: 'c1a-scroll' }, tb));
      var c = el('button', { type: 'button', class: 'c1a-btn', text: T.t('jg.csv') });
      c.addEventListener('click', function () { dlFile('clasament-' + k + '.csv', '﻿' + G.toCSV(k), 'text/csv;charset=utf-8'); });
      p.appendChild(el('div', { class: 'c1a-row' }, [c]));
    }
    function tabHist(p) {
      var H = G.history(k).reverse(), msg = el('p', { class: 'c1a-msg', role: 'status' }), row;
      if (!H.length) p.appendChild(el('p', { text: T.t('jg.empty') }));
      else {
        var ul = el('ul', { class: 'c1a-list' });
        H.slice(0, 60).forEach(function (m) { ul.appendChild(el('li', { text: m.a + ' – ' + m.b + ' : ' + (m.res === 1 ? '1–0' : m.res === 0 ? '0–1' : '½–½') + ' (' + String(m.at).slice(0, 10) + ')' })); });
        p.appendChild(ul);
      }
      var ex = el('button', { type: 'button', class: 'c1a-btn', text: T.t('jg.exp') }), im = el('button', { type: 'button', class: 'c1a-btn', text: T.t('jg.imp') }), cl = el('button', { type: 'button', class: 'c1a-btn', text: T.t('jg.clear') });
      ex.addEventListener('click', function () { dlFile('istoric-' + k + '.json', G.exportJSON(k), 'application/json'); });
      im.addEventListener('click', function () {
        var inp = el('input', { type: 'file', accept: 'application/json,.json' });
        inp.addEventListener('change', function () {
          var f = inp.files && inp.files[0]; if (!f) return; if (f.size > 500000) { msg.textContent = T.t('jg.impbad'); return; }
          var rd = new FileReader(); rd.onload = function () { try { var n = G.importJSON(k, String(rd.result)); clear(p); tabHist(p); p.appendChild(el('p', { class: 'c1a-msg c1a-ok', role: 'status', text: T.t('jg.impok', { n: n }) })); } catch (e) { msg.textContent = T.t('jg.impbad'); } }; rd.readAsText(f);
        }); inp.click();
      });
      cl.addEventListener('click', function () {
        var ask = el('p', { class: 'c1a-confirm', role: 'alert' }, [T.t('jg.confirm') + ' ']);
        var y = el('button', { type: 'button', class: 'c1a-btn c1a-sm c1a-pri', text: T.t('tour.yes') }), n = el('button', { type: 'button', class: 'c1a-btn c1a-sm', text: T.t('tour.no') });
        y.addEventListener('click', function () { G.clear(k); clear(p); tabHist(p); }); n.addEventListener('click', function () { ask.remove(); cl.focus(); });
        ask.appendChild(y); ask.appendChild(n); row.after(ask); y.focus();
      });
      row = el('div', { class: 'c1a-row' }, [ex, im, cl]); p.appendChild(row); p.appendChild(msg);
    }
    function open() { return T.hub((opts.name ? opts.name + ' · ' : '') + T.t('jg.title'), [
      { id: 'result', label: T.t('jg.tab.result'), render: tabResult }, { id: 'tour', label: T.t('jg.tab.tour'), render: tabTour },
      { id: 'ladder', label: T.t('jg.tab.ladder'), render: tabLadder }, { id: 'hist', label: T.t('jg.tab.hist'), render: tabHist }]); }
    var btn = null;
    if (opts.button !== false && doc) {
      btn = el('button', { type: 'button', class: 'fff-jg-open', id: 'fffJgOpen', text: T.t('jg.open') });
      btn.addEventListener('click', open); doc.body.appendChild(btn);
    }
    return { open: open, button: btn, key: k };
  };
  G.TBL = T; G.VERSION = 1; G.START = START;
  var FF = root.FFF || {}; root.FFF = FF; FF.games = G;
  return G;
});
