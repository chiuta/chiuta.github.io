/* fff-kit · dialog — un singur sistem de dialoguri: confirm/alert/prompt (promisiuni), toast/notify (aria-live), <dialog> modal accesibil. */
(function () {
  'use strict';
  var F = window.FFF;
  if (!F || F.dialog) return;
  var doc = document;
  function T(k, v) { return F.t('dialog', k, v); }

  var uid = 0;
  var stack = [];   // dialogurile deschise (ultimul = cel de sus)

  /* ---------- DOM mic ---------- */
  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(label, cls) {
    var b = el('button', 'fff-btn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    return b;
  }

  /* ---------- tema gazdei (la fel ca în label) ---------- */
  function hostDark() {
    function rgba(e) {
      var m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(e).backgroundColor || '');
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

  /* ---------- focus ---------- */
  var FOCUSABLE = 'button:not([disabled]),input:not([disabled]):not([type=hidden]),textarea:not([disabled]),select:not([disabled]),a[href],summary,[tabindex]:not([tabindex="-1"])';
  function focusables(root) {
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (n) {
      return !n.hidden && !n.closest('[hidden]') && (n.offsetWidth || n.offsetHeight || n.getClientRects().length);
    });
  }

  /**
   * Nucleul: construiește și afișează un dialog.
   * spec: {kind, title (șir|false), message, body(ctx) → {nodes, focus, value, validate}, buttons: [{label, value|fn, primary, danger}], cancel (valoarea la Esc/închidere),
   *        focus: indexul butonului focalizat implicit (dacă body nu dă un câmp), small}
   */
  function open(spec) {
    return new Promise(function (resolve) {
      var id = ++uid, prev = doc.activeElement, settled = false;
      var d = el('dialog', 'fff-dlg fff-dialog' + (spec.wide ? '' : ' fff-dlg-sm'));
      d.setAttribute('role', 'dialog');
      d.setAttribute('aria-modal', 'true');
      d.setAttribute('data-fff-dialog', spec.kind || 'custom');
      var inner = el('div', 'fff-in');
      var titleId = 'fff-dt-' + id, msgId = 'fff-dm-' + id;
      var hasTitle = spec.title !== false && spec.title !== '' && spec.title != null;
      if (hasTitle) { var h = el('h2', 'fff-dt', String(spec.title)); h.id = titleId; inner.appendChild(h); }
      var msg = null;
      if (spec.message != null && spec.message !== '') {
        msg = el('p', 'fff-msg', String(spec.message)); msg.id = msgId; inner.appendChild(msg);
      }
      if (hasTitle) {
        d.setAttribute('aria-labelledby', titleId);
        if (msg) d.setAttribute('aria-describedby', msgId);
      } else if (msg) d.setAttribute('aria-labelledby', msgId);
      else d.setAttribute('aria-label', T('title_alert'));
      var ctx = {id: id, msgId: msg ? msgId : titleId, finish: null};
      var body = spec.body ? spec.body(ctx) : null;
      if (body && body.nodes) body.nodes.forEach(function (n) { inner.appendChild(n); });
      var row = el('div', 'fff-row fff-end');
      var btns = [];
      function finish(v) {
        if (settled) return;
        settled = true;
        stack = stack.filter(function (x) { return x !== d; });
        try { if (d.open) d.close(); } catch (e) { /* ignorat */ }
        d.remove();
        try { doc.removeEventListener('focusin', trap, true); } catch (e) { /* ignorat */ }
        if (prev && prev !== doc.body && prev.focus && doc.contains(prev)) { try { prev.focus(); } catch (e) { /* ignorat */ } }
        resolve(v);
      }
      ctx.finish = finish;
      (spec.buttons || []).forEach(function (b) {
        var e = btn(b.label, (b.primary ? 'fff-primary' : '') + (b.danger ? ' fff-danger' : ''));
        e.addEventListener('click', function () {
          if (b.check) { var r = b.check(); if (r === false) return; }
          finish(typeof b.value === 'function' ? b.value() : b.value);
        });
        row.appendChild(e); btns.push(e);
      });
      inner.appendChild(row);
      d.appendChild(inner);
      ctx.buttons = btns;
      /* Esc (nativ: evenimentul cancel; rezervă fără showModal: keydown) + capcana de focus (Tab/Shift+Tab ciclează în dialog) */
      d.addEventListener('cancel', function (e) { e.preventDefault(); finish(spec.cancel); });
      d.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(spec.cancel); return; }
        if (e.key !== 'Tab') return;
        var f = focusables(d);
        if (!f.length) { e.preventDefault(); d.focus(); return; }
        var first = f[0], last = f[f.length - 1], a = doc.activeElement;
        if (e.shiftKey && (a === first || !d.contains(a))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (a === last || !d.contains(a))) { e.preventDefault(); first.focus(); }
      });
      function trap(e) {
        if (stack[stack.length - 1] !== d || d.contains(e.target)) return;
        var f = focusables(d); if (f.length) f[0].focus();
      }
      d.setAttribute('tabindex', '-1');
      var dark = hostDark();
      if (dark === true) d.classList.add('fff-dark'); else if (dark === false) d.classList.add('fff-light');
      (doc.body || doc.documentElement).appendChild(d);
      stack.push(d);
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      doc.addEventListener('focusin', trap, true);
      raiseToasts();
      var target = (body && body.focus) || (btns[spec.focus == null ? btns.length - 1 : spec.focus]) || d;
      try { target.focus(); if (body && body.select && target.select) target.select(); } catch (e) { /* ignorat */ }
      d._fffClose = function () { finish(spec.cancel); };
    });
  }

  function opts(o) { return o && typeof o === 'object' ? o : {}; }
  function title(o, key) { return o.title === false ? false : (o.title != null ? o.title : T(key)); }

  /* ---------- confirm / alert / prompt / show / choice ---------- */
  /** confirm(mesaj, {title, yes, no, danger, focus:'yes'|'no'}) → Promise<boolean>. Esc / Anulează → false. Focusul implicit: „Anulează” (acțiunea sigură). */
  function confirm(message, o) {
    o = opts(o);
    return open({
      kind: 'confirm', title: title(o, 'title_confirm'), message: message, cancel: false,
      buttons: [{label: o.no || T('cancel'), value: false}, {label: o.yes || T('yes'), value: true, primary: true, danger: !!o.danger}],
      focus: o.focus === 'yes' ? 1 : 0
    });
  }
  /** alert(mesaj, {title, ok}) → Promise<void>. */
  function alertDlg(message, o) {
    o = opts(o);
    return open({kind: 'alert', title: title(o, 'title_alert'), message: message, cancel: undefined, buttons: [{label: o.ok || T('ok'), value: undefined, primary: true}], focus: 0});
  }
  /** prompt(mesaj, valoareImplicită, {title, yes, no, type, multiline, placeholder, maxlength, inputmode, autocomplete, required, validate(v) → șir de eroare|falsy}) → Promise<string|null>. */
  function prompt(message, def, o) {
    if (def && typeof def === 'object') { o = def; def = o.value; }
    o = opts(o);
    var input, err, ok;
    return open({
      kind: 'prompt', title: title(o, 'title_prompt'), message: message, cancel: null,
      body: function (ctx) {
        input = o.multiline ? el('textarea', 'fff-input') : el('input', 'fff-input');
        if (!o.multiline) input.type = o.type || 'text'; else input.rows = o.rows || 4;
        input.value = def == null ? '' : String(def);
        input.setAttribute('aria-labelledby', ctx.msgId);
        if (o.placeholder) input.placeholder = o.placeholder;
        if (o.maxlength) input.maxLength = o.maxlength;
        if (o.inputmode) input.setAttribute('inputmode', o.inputmode);
        input.autocomplete = o.autocomplete || 'off';
        if (o.required) input.required = true;
        err = el('p', 'fff-res fff-sm fff-bad');
        err.id = 'fff-de-' + ctx.id; err.setAttribute('role', 'alert');
        input.setAttribute('aria-describedby', err.id);
        input.addEventListener('input', function () { err.textContent = ''; input.removeAttribute('aria-invalid'); });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey && !o.multiline) { e.preventDefault(); if (ok.check() !== false) ctx.finish(input.value); }
          else if (e.key === 'Enter' && o.multiline && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (ok.check() !== false) ctx.finish(input.value); }
        });
        var wrap = el('div', 'fff-field'); wrap.appendChild(input); wrap.appendChild(err);
        return {nodes: [wrap], focus: input, select: true};
      },
      buttons: [{label: o.no || T('cancel'), value: null}, ok = {
        label: o.yes || T('ok'), primary: true, value: function () { return input.value; },
        check: function () {
          var bad = null;
          if (o.required && !String(input.value).trim()) bad = T('err_required');
          else if (typeof o.validate === 'function') { try { bad = o.validate(input.value) || null; } catch (e) { bad = String(e && e.message || e); } }
          if (bad) { err.textContent = String(bad); input.setAttribute('aria-invalid', 'true'); input.focus(); return false; }
          return true;
        }
      }]
    });
  }
  /** show(mesaj, text, {title, ok}) → Promise<void>: text în citire, selectat (pentru copiere). */
  function showText(message, text, o) {
    o = opts(o);
    return open({
      kind: 'show', title: title(o, 'title_show'), message: message, cancel: undefined,
      body: function (ctx) {
        var ta = el('textarea', 'fff-input fff-ta');
        ta.readOnly = true; ta.rows = o.rows || 3; ta.value = String(text == null ? '' : text);
        ta.setAttribute('aria-labelledby', ctx.msgId);
        return {nodes: [ta], focus: ta, select: true};
      },
      buttons: [{label: o.ok || T('ok'), value: undefined, primary: true}]
    });
  }
  /** choice(mesaj, [{label, value, primary, danger}], {title}) → Promise<valoare|null>. Primul buton primește focusul. */
  function choice(message, buttons, o) {
    o = opts(o);
    return open({
      kind: 'choice', title: title(o, 'title_confirm'), message: message, cancel: null,
      buttons: (buttons || []).map(function (b) { return {label: b.label, value: b.value, primary: !!b.primary, danger: !!b.danger}; }), focus: 0
    });
  }

  /* ---------- toast / notify (regiuni aria-live) ---------- */
  var regions = null, regTimer = 0, toasts = [], pend = [];
  function ensureRegions(cb) {
    if (regions) return cb();
    F.ready(function () {
      if (regions) return cb();
      var wrap = el('div', 'fff-toasts');
      wrap.setAttribute('data-fff-toasts', '');
      var pol = el('div', 'fff-toast-reg'); pol.setAttribute('role', 'status'); pol.setAttribute('aria-live', 'polite'); pol.setAttribute('aria-relevant', 'additions');
      var ass = el('div', 'fff-toast-reg'); ass.setAttribute('role', 'alert'); ass.setAttribute('aria-live', 'assertive'); ass.setAttribute('aria-relevant', 'additions');
      wrap.appendChild(pol); wrap.appendChild(ass);
      if (typeof wrap.showPopover === 'function') wrap.setAttribute('popover', 'manual');   // strat superior: vizibil și deasupra unui <dialog> modal
      (doc.body || doc.documentElement).appendChild(wrap);
      if (typeof wrap.showPopover === 'function') { try { wrap.showPopover(); } catch (e) { /* ignorat */ } }
      regions = {wrap: wrap, polite: pol, assertive: ass};
      setTimeout(cb, 80);   // regiunea trebuie să existe în arborele de accesibilitate înainte de a primi text
    });
  }
  function raiseToasts() {
    if (!regions || !toasts.length || typeof regions.wrap.showPopover !== 'function') return;
    try { regions.wrap.hidePopover(); regions.wrap.showPopover(); } catch (e) { /* ignorat */ }
  }
  function dropRegionsLater() {
    clearTimeout(regTimer);
    regTimer = setTimeout(function () {
      if (toasts.length || !regions) return;
      regions.wrap.remove(); regions = null;   // nu rămâne în outerHTML-ul aplicațiilor care își serializează pagina
    }, 1500);
  }
  var TYPES = {info: 1, success: 1, warning: 1, error: 1};
  /**
   * toast(mesaj, {type:'info'|'success'|'warning'|'error', timeout (ms; 0 = rămâne până îl închizi), action:{label, onClick}}) → {close(), el}.
   * error/warning: regiune assertive (role=alert); restul: polite (role=status). Timpul se oprește la hover/focus.
   */
  function toast(message, o) {
    o = opts(o);
    var type = TYPES[o.type] ? o.type : 'info';
    var timeout = o.timeout != null ? o.timeout : (type === 'error' ? 8000 : 4500);
    var handle = {el: null, close: function () { handle._closed = true; if (handle._close) handle._close(); }};
    pend.push(handle);
    ensureRegions(function () {
      pend = pend.filter(function (x) { return x !== handle; });
      if (handle._closed) { dropRegionsLater(); return; }
      var t = el('div', 'fff-toast fff-toast-' + type);
      t.setAttribute('data-type', type);
      var sr = el('span', 'fff-sr', T('sr_' + type) + ': ');
      var tx = el('span', 'fff-toast-msg', String(message));
      t.appendChild(sr); t.appendChild(tx);
      if (o.action && o.action.label) {
        var ab = btn(String(o.action.label), 'fff-toast-act');
        ab.addEventListener('click', function () { try { if (o.action.onClick) o.action.onClick(); } finally { close(); } });
        t.appendChild(ab);
      }
      var xb = btn('×', 'fff-toast-x');
      xb.setAttribute('aria-label', T('dismiss'));
      xb.addEventListener('click', function () { close(); });
      t.appendChild(xb);
      var reg = (type === 'error' || type === 'warning') ? regions.assertive : regions.polite;
      while (toasts.length >= 4) toasts[0].close();
      reg.appendChild(t);
      var rec = {close: close}, timer = 0, paused = false, left = timeout;
      toasts.push(rec); handle.el = t;
      function arm() { clearTimeout(timer); if (timeout > 0 && !paused) { var s = Date.now(); timer = setTimeout(close, left); rec._s = s; } }
      function pause() { if (paused) return; paused = true; clearTimeout(timer); if (rec._s) left = Math.max(1000, left - (Date.now() - rec._s)); }
      function resume() { paused = false; arm(); }
      t.addEventListener('mouseenter', pause); t.addEventListener('mouseleave', resume);
      t.addEventListener('focusin', pause); t.addEventListener('focusout', resume);
      function close() {
        clearTimeout(timer);
        if (!t.parentNode) return;
        t.remove();
        toasts = toasts.filter(function (x) { return x !== rec; });
        if (!toasts.length) dropRegionsLater();
      }
      handle._close = close;
      arm();
      raiseToasts();
    });
    return handle;
  }
  function closeAll() {
    stack.slice().forEach(function (d) { if (d._fffClose) d._fffClose(); });
    toasts.slice().forEach(function (t) { t.close(); });
    pend.slice().forEach(function (h) { h.close(); });
  }

  F.dialog = {
    confirm: confirm, alert: alertDlg, prompt: prompt, show: showText, choice: choice,
    toast: toast, notify: toast, closeAll: closeAll,
    isOpen: function () { return stack.length > 0; },
    open: open
  };

  /* ---------- alias-uri (compatibilitate cu implementările proprii din aplicații: ffAsk/ffShow/ffPrompt) ---------- */
  function noTitle(o) { o = opts(o); return Object.assign({title: false}, o); }
  if (!window.ffAsk) window.ffAsk = function (msg, o) { return confirm(String(msg), noTitle(o)); };
  if (!window.ffShow) window.ffShow = function (msg, text, o) { return showText(String(msg), text, noTitle(o)); };
  if (!window.ffPrompt) window.ffPrompt = function (msg, def, o) { return prompt(String(msg), def, noTitle(o)); };
})();
