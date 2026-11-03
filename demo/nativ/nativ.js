/* Player pentru înregistrările de terminal (format asciicast v2, scris de noi) cu subtitrări în 8 limbi și voce sintetică opțională.
   Fără rețea: datele vin din window.NATIV (nativ-data.js sau inline în pagina offline); audio din fișiere locale sau data: URI.
   Sursa: tools/native-demos/nativ.js; build.py o copiază în demo/nativ/. */
(function () {
  'use strict';
  var D = window.NATIV; if (!D) return;
  var LANGS = {ro: 'Română', en: 'English', fr: 'Français', it: 'Italiano', es: 'Español', pt: 'Português', de: 'Deutsch', hu: 'Magyar'};
  var ORDER = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
  var COLS = D.cols, ROWS = D.rows;
  var FG = {30: '0', 31: '1', 32: '2', 33: '3', 34: '4', 35: '5', 36: '6', 37: '7', 90: '8', 97: '9'};

  function $(id) { return document.getElementById(id); }
  function safe(f, d) { try { return f(); } catch (e) { return d; } }
  var lang = safe(function () { var s = localStorage.getItem('lang'); return LANGS[s] ? s : null; }, null) ||
    (function () { var n = (navigator.language || 'ro').slice(0, 2).toLowerCase(); return LANGS[n] ? n : 'en'; })();
  if (location.search.match(/[?&]lang=(\w\w)/) && LANGS[RegExp.$1]) lang = RegExp.$1;
  function ui(k) { return (D.ui[lang] || D.ui.en)[k] || D.ui.en[k] || k; }

  /* ---- ecran de terminal (același model ca în build.py) ---- */
  function Screen() { this.reset(); }
  Screen.prototype.reset = function () { this.rows = []; for (var i = 0; i < ROWS; i++) this.rows.push([]); this.r = 0; this.c = 0; this.fg = '0'; this.bold = false; this.esc = ''; };
  Screen.prototype.lf = function () { this.r++; if (this.r >= ROWS) { this.rows.shift(); this.rows.push([]); this.r = ROWS - 1; } };
  Screen.prototype.write = function (s) {
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (this.esc) {
        this.esc += ch;
        if (this.esc.length === 2 && ch !== '[') { this.esc = ''; continue; }
        if (this.esc.length > 2 && /[@-~]/.test(ch)) { this.csi(this.esc.slice(2, -1), ch); this.esc = ''; }
        continue;
      }
      if (ch === '\x1b') { this.esc = ch; continue; }
      if (ch === '\r') { this.c = 0; continue; }
      if (ch === '\n') { this.lf(); continue; }
      if (ch < ' ') continue;
      if (this.c >= COLS) { this.c = 0; this.lf(); }
      this.rows[this.r][this.c] = [ch, this.fg, this.bold]; this.c++;
    }
  };
  Screen.prototype.csi = function (p, f) {
    if (f === 'm') {
      var a = p === '' ? ['0'] : p.split(';');
      for (var i = 0; i < a.length; i++) { var n = +a[i]; if (n === 0) { this.fg = '0'; this.bold = false; } else if (n === 1) this.bold = true; else if (FG[n] !== undefined) this.fg = FG[n]; else if (n === 39) this.fg = '0'; }
    } else if (f === 'J' && p === '2') { for (var j = 0; j < ROWS; j++) this.rows[j] = []; this.r = 0; this.c = 0; }
    else if (f === 'H') { this.r = 0; this.c = 0; }
  };
  Screen.prototype.html = function (showCursor) {
    var out = [];
    for (var y = 0; y < ROWS; y++) {
      var row = this.rows[y], line = '', cur = null, buf = '';
      var n = row.length; if (showCursor && y === this.r && this.c + 1 > n) n = this.c + 1;
      function flush() { if (buf) { line += cur === '0' ? buf : '<span class="c' + cur + '">' + buf + '</span>'; buf = ''; } }
      for (var x = 0; x < n; x++) {
        var cell = row[x] || [' ', '0', false], key = cell[1] + (cell[2] ? 'b' : '');
        var t = cell[0] === '<' ? '&lt;' : cell[0] === '>' ? '&gt;' : cell[0] === '&' ? '&amp;' : cell[0];
        if (showCursor && y === this.r && x === this.c) { flush(); line += '<span class="cur">' + (cell[0] === ' ' || !row[x] ? ' ' : t) + '</span>'; cur = null; continue; }
        if (key !== cur) { flush(); cur = key; }
        buf += t;
      }
      flush(); out.push(line);
    }
    return out.join('\n');
  };

  /* ---- player ---- */
  function Player(root, slug) {
    var P = this, d = D.progs[slug]; P.d = d; P.slug = slug; P.root = root;
    P.t = 0; P.playing = false; P.rate = 1; P.voice = false; P.subs = true; P.i = 0; P.last = 0; P.scr = new Screen(); P.raf = 0; P.audio = null;
    P.term = root.querySelector('.term'); P.sub = root.querySelector('.subline');
    var ctl = root.querySelector('.ctl');
    function btn(cls, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = cls; b.addEventListener('click', fn); return b; }
    P.bPlay = btn('b-play', function () { P.toggle(); });
    P.bRestart = btn('b-restart', function () { P.seek(0); P.play(); });
    P.range = document.createElement('input'); P.range.type = 'range'; P.range.min = 0; P.range.max = Math.round(d.dur * 10); P.range.value = 0; P.range.className = 'seek';
    P.range.addEventListener('input', function () { P.seek(P.range.value / 10); });
    P.time = document.createElement('span'); P.time.className = 'time'; P.time.setAttribute('aria-hidden', 'true');
    P.sel = document.createElement('select'); P.sel.className = 'speed';
    [0.5, 1, 1.5, 2].forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v + '×'; if (v === 1) o.selected = true; P.sel.appendChild(o); });
    P.sel.addEventListener('change', function () { P.rate = +P.sel.value; if (P.audio) P.audio.playbackRate = P.rate; if (P.playing) { P.last = performance.now(); } });
    P.chkV = document.createElement('input'); P.chkV.type = 'checkbox'; P.chkV.addEventListener('change', function () { P.voice = P.chkV.checked; P.syncAudio(true); });
    P.chkS = document.createElement('input'); P.chkS.type = 'checkbox'; P.chkS.checked = true; P.chkS.addEventListener('change', function () { P.subs = P.chkS.checked; P.drawSub(); });
    function lab(cls, el) { var l = document.createElement('label'); l.className = cls; l.appendChild(el); var s = document.createElement('span'); l.appendChild(s); return l; }
    P.lSpeed = lab('l-speed', P.sel); P.lV = lab('l-voice', P.chkV); P.lS = lab('l-subs', P.chkS);
    P.lSpeed.insertBefore(document.createElement('span'), P.sel); P.lSpeed.removeChild(P.lSpeed.lastChild);
    [P.bPlay, P.bRestart, P.time, P.range, P.lSpeed, P.lV, P.lS].forEach(function (e) { ctl.appendChild(e); });
    // scene chips
    var sc = root.querySelector('.scenes');
    P.chips = d.scenes.map(function (s, i) { var b = btn('chip', function () { P.seek(s.t0); }); b.textContent = String(i + 1); sc.appendChild(b); return b; });
    P.live = root.querySelector('.live');
    P.relabel(); P.seek(0);
  }
  Player.prototype.relabel = function () {
    var P = this;
    P.bPlay.textContent = P.playing ? ui('pause') : ui('play');
    P.bRestart.textContent = ui('restart');
    P.range.setAttribute('aria-label', ui('seek') + ' — ' + P.d.name);
    P.sel.setAttribute('aria-label', ui('speed') + ' — ' + P.d.name);
    P.lSpeed.firstChild.textContent = ui('speed') + ' ';
    P.lV.lastChild.textContent = ui('voice'); P.lS.lastChild.textContent = ui('subs');
    P.chkV.setAttribute('aria-label', ui('voice') + ' — ' + P.d.name); P.chkS.setAttribute('aria-label', ui('subs') + ' — ' + P.d.name);
    P.term.setAttribute('aria-label', ui('term') + ': ' + P.d.name);
    P.d.scenes.forEach(function (s, i) { P.chips[i].setAttribute('aria-label', ui('scene') + ' ' + (i + 1) + ' ' + ui('of') + ' ' + P.d.scenes.length); P.chips[i].title = P.chips[i].getAttribute('aria-label'); });
    if (P.audio) { var a = P.d.audio[lang]; if (a && P.audio.getAttribute('data-l') !== lang) { var was = P.playing && P.voice; P.audio.pause(); P.audio.src = a; P.audio.setAttribute('data-l', lang); if (was) P.syncAudio(true); } }
    P.drawSub();
  };
  Player.prototype.cue = function () {
    var cs = this.d.cues[lang] || [];
    for (var i = 0; i < cs.length; i++) if (this.t >= cs[i][0] && this.t < cs[i][1]) return cs[i][2];
    return '';
  };
  Player.prototype.drawSub = function () { var c = this.cue(); this.sub.textContent = this.subs ? c : ''; this.sub.setAttribute('lang', lang); this.sub.classList.toggle('empty', !c || !this.subs); };
  Player.prototype.draw = function () {
    var P = this, h = P.scr.html(true); if (h !== P._h) { P.term.innerHTML = h; P._h = h; }
    P.range.value = Math.round(P.t * 10);
    P.time.textContent = fmt(P.t) + ' / ' + fmt(P.d.dur);
    P.range.setAttribute('aria-valuetext', fmt(P.t) + ' / ' + fmt(P.d.dur));
    var cur = 0; P.d.scenes.forEach(function (s, i) { if (P.t >= s.t0) cur = i; });
    P.chips.forEach(function (c, i) { c.classList.toggle('on', i === cur); if (i === cur) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
    P.drawSub();
  };
  function fmt(t) { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }
  Player.prototype.advanceTo = function (t) {
    var ev = this.d.events;
    while (this.i < ev.length && ev[this.i][0] <= t) { this.scr.write(ev[this.i][2]); this.i++; }
  };
  Player.prototype.seek = function (t) {
    var P = this; t = Math.max(0, Math.min(P.d.dur, t));
    P.scr.reset(); P.i = 0; P.t = t; P.advanceTo(t); P.draw(); P.syncAudio(true);
  };
  Player.prototype.tick = function (now) {
    var P = this; if (!P.playing) return;
    P.t += (now - P.last) / 1000 * P.rate; P.last = now;
    if (P.t >= P.d.dur) { P.t = P.d.dur; P.advanceTo(P.t); P.draw(); P.pause(); return; }
    P.advanceTo(P.t); P.draw();
    P.raf = requestAnimationFrame(function (n) { P.tick(n); });
  };
  Player.prototype.play = function () {
    var P = this; if (P.playing) return; if (P.t >= P.d.dur) P.seek(0);
    P.playing = true; P.last = performance.now(); P.relabel();
    document.dispatchEvent(new CustomEvent('nativ-play', {detail: P}));
    P.syncAudio(true); P.raf = requestAnimationFrame(function (n) { P.tick(n); });
  };
  Player.prototype.pause = function () { var P = this; P.playing = false; cancelAnimationFrame(P.raf); P.relabel(); P.syncAudio(false); };
  Player.prototype.toggle = function () { this.playing ? this.pause() : this.play(); };
  Player.prototype.syncAudio = function (restart) {
    var P = this, src = P.d.audio[lang];
    if (!P.voice || !src) { if (P.audio) P.audio.pause(); return; }
    if (!P.audio) { P.audio = new Audio(); P.audio.preload = 'none'; }
    if (P.audio.getAttribute('data-l') !== lang) { P.audio.src = src; P.audio.setAttribute('data-l', lang); }
    P.audio.playbackRate = P.rate;
    if (!P.playing) { P.audio.pause(); return; }
    if (restart) { try { P.audio.currentTime = P.t; } catch (e) {} }
    var pr = P.audio.play(); if (pr && pr.catch) pr.catch(function () {});
  };

  /* ---- pagina ---- */
  var players = [];
  function applyLang() {
    document.documentElement.lang = lang;
    document.title = ui('title') + ' — chiuta.ro';
    var m = document.querySelector('meta[name=description]'); if (m) m.setAttribute('content', ui('lead'));
    document.querySelectorAll('[data-ui]').forEach(function (e) { e.textContent = ui(e.getAttribute('data-ui')); if (e.classList.contains('note')) e.hidden = !e.textContent; });
    document.querySelectorAll('[data-t]').forEach(function (e) { var p = D.progs[e.getAttribute('data-t')]; if (p) e.textContent = p.desc[lang] || p.desc.en; });
    document.querySelectorAll('[data-n]').forEach(function (e) { var a = e.getAttribute('data-n').split(':'), p = D.progs[a[0]]; if (p) { e.textContent = p.scenes[+a[1]].narr[lang] || p.scenes[+a[1]].narr.en; e.setAttribute('lang', lang); } });
    document.querySelectorAll('a[data-vtt]').forEach(function (a) { a.setAttribute('href', a.getAttribute('data-vtt') + '.' + lang + '.vtt'); });
    document.querySelectorAll('video[data-slug]').forEach(function (v) { for (var i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = v.textTracks[i].language === lang ? 'showing' : 'disabled'; });
    var l = $('lblLang'); if (l) l.textContent = ui('lang');
    var th = $('theme'); if (th) th.setAttribute('aria-label', 'Theme');
    players.forEach(function (p) { p.relabel(); });
  }
  function init() {
    var sel = $('lang');
    ORDER.forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = LANGS[k]; if (k === lang) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', function () { lang = sel.value; safe(function () { localStorage.setItem('lang', lang); }); applyLang(); });
    safe(function () { var m = localStorage.getItem('mode'); if (m === 'light' || m === 'dark') document.documentElement.setAttribute('data-theme', m); });
    $('theme').addEventListener('click', function () {
      var r = document.documentElement, cur = r.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'), n = cur === 'light' ? 'dark' : 'light';
      r.setAttribute('data-theme', n); safe(function () { localStorage.setItem('mode', n); });
    });
    document.querySelectorAll('.player[data-slug]').forEach(function (el) {
      var nj = el.querySelector('.nojs'); if (nj) nj.remove();
      players.push(new Player(el, el.getAttribute('data-slug')));
    });
    document.addEventListener('nativ-play', function (e) { players.forEach(function (p) { if (p !== e.detail && p.playing) p.pause(); }); });
    applyLang();
    window.__nativ = {players: players, setLang: function (l) { sel.value = l; sel.dispatchEvent(new Event('change')); }};
    var h = decodeURIComponent((location.hash || '').slice(1)); if (h && $(h)) $(h).scrollIntoView();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
