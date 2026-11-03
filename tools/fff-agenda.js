/* fff-agenda · agenda comună FFF (Orar · Gospodar · CLEPSIDRA) — model de elemente, conversie .ics, îmbinare fără dubluri, butoane „Trimite/Primește” prin plicul FFF.
 * Sursa canonică e ACEST fișier (tools/fff-agenda.js); aplicațiile îl primesc prin `node tools/inject-shared.mjs`, nu prin copiere de mână.
 * Plicul: type "agenda/fff", payload {v:1, items:[…]}; interoperează și cu "events/ics" (text .ics). Fără dependențe, fără rețea, compatibil cu connect-src 'none'.
 * Element: {uid, kind:"event"|"block"|"due", title, start:"YYYY-MM-DD"|"YYYY-MM-DDTHH:MM", end?, tz?:"UTC"|IANA (lipsă = oră „plutitoare”), allDay?, rrule?, cat?, amount?:{minor,cur}, app?} */
(function (root, factory) {
  var A = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = A;
  if (root) { try { var F = root.FFF || {}; root.FFF = F; if (root.FFF === F) F.agenda = A; } catch (e) { /* inert */ } }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var MAX_ITEMS = 2000, MAX_STR = 200, KINDS = { event: 1, block: 1, due: 1 };
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/, DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  var WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  var I18N = {
    ro: { send: 'Agendă comună · Trimite', recv: 'Agendă comună · Primește', done: 'Importat în agendă: {n} elemente ({s} sărite ca duplicate).', none: 'Nimic de trimis.', bad: 'Plic de agendă invalid.', cap: 'Agenda comună', amt: 'cu sume' },
    en: { send: 'Shared agenda · Send', recv: 'Shared agenda · Receive', done: 'Imported into the agenda: {n} items ({s} skipped as duplicates).', none: 'Nothing to send.', bad: 'Invalid agenda envelope.', cap: 'Shared agenda', amt: 'with amounts' },
    fr: { send: 'Agenda commun · Envoyer', recv: 'Agenda commun · Recevoir', done: 'Importé dans l’agenda : {n} éléments ({s} ignorés comme doublons).', none: 'Rien à envoyer.', bad: 'Enveloppe d’agenda invalide.', cap: 'Agenda commun', amt: 'avec montants' },
    it: { send: 'Agenda comune · Invia', recv: 'Agenda comune · Ricevi', done: 'Importati nell’agenda: {n} elementi ({s} saltati come duplicati).', none: 'Niente da inviare.', bad: 'Busta di agenda non valida.', cap: 'Agenda comune', amt: 'con importi' },
    es: { send: 'Agenda común · Enviar', recv: 'Agenda común · Recibir', done: 'Importado en la agenda: {n} elementos ({s} omitidos por duplicados).', none: 'Nada que enviar.', bad: 'Sobre de agenda no válido.', cap: 'Agenda común', amt: 'con importes' },
    pt: { send: 'Agenda comum · Enviar', recv: 'Agenda comum · Receber', done: 'Importado na agenda: {n} itens ({s} ignorados por duplicados).', none: 'Nada para enviar.', bad: 'Envelope de agenda inválido.', cap: 'Agenda comum', amt: 'com valores' },
    hu: { send: 'Közös napló · Küldés', recv: 'Közös napló · Fogadás', done: 'Beillesztve a naplóba: {n} elem ({s} kihagyva duplikátumként).', none: 'Nincs mit küldeni.', bad: 'Érvénytelen naplóboríték.', cap: 'Közös napló', amt: 'összegekkel' },
    de: { send: 'Gemeinsame Agenda · Senden', recv: 'Gemeinsame Agenda · Empfangen', done: 'In die Agenda importiert: {n} Einträge ({s} als Duplikate übersprungen).', none: 'Nichts zu senden.', bad: 'Ungültiger Agenda-Umschlag.', cap: 'Gemeinsame Agenda', amt: 'mit Beträgen' }
  };
  function lang() { var l = ''; try { l = (root.document && root.document.documentElement.lang || '').slice(0, 2).toLowerCase(); } catch (e) { /* */ } return I18N[l] ? l : 'en'; }
  function tr(k, v) { var s = I18N[lang()][k] || I18N.en[k] || k; if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]); return s; }
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var clean = function (s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n || MAX_STR); };
  var hash = function (s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };

  /** Validează și curăță un element; întoarce null dacă nu e utilizabil. */
  function cleanItem(x, app) {
    if (!x || typeof x !== 'object') return null;
    var title = clean(x.title, 120).trim(), start = String(x.start || '');
    if (!title || !(DATE_RE.test(start) || DT_RE.test(start))) return null;
    var o = { kind: KINDS[x.kind] ? x.kind : 'event', title: title, start: start };
    if (x.end != null) { var e = String(x.end); if (DATE_RE.test(e) || DT_RE.test(e)) o.end = e; }
    if (x.tz) { var z = clean(x.tz, 60); if (/^(UTC|[A-Za-z_]+(\/[A-Za-z0-9_+-]+){1,2})$/.test(z)) o.tz = z; }
    if (x.allDay || DATE_RE.test(start)) o.allDay = true;
    if (x.rrule) { var r = clean(x.rrule, 160).replace(/^RRULE:/i, ''); if (/^[A-Z0-9=;,+\-:]+$/.test(r) && /FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.test(r)) o.rrule = r; }
    if (Array.isArray(x.ex)) { var ex = x.ex.filter(function (v) { return DATE_RE.test(v) || DT_RE.test(v); }).slice(0, 200); if (ex.length) o.ex = ex; }
    if (x.cat) o.cat = clean(x.cat, 40);
    if (x.amount && typeof x.amount === 'object' && isFinite(x.amount.minor) && Math.abs(x.amount.minor) < 1e13) o.amount = { minor: Math.round(x.amount.minor), cur: clean(x.amount.cur || '', 3).toUpperCase() };
    if (x.app || app) o.app = clean(x.app || app, 40);
    o.uid = clean(x.uid, 120) || (hash([o.title, o.start, o.end || '', o.rrule || ''].join('|')) + '@fff.agenda');
    return o;
  }
  function normalize(items, app) {
    var out = [], seen = {};
    (Array.isArray(items) ? items : []).slice(0, MAX_ITEMS).forEach(function (x) { var o = cleanItem(x, app); if (o && !seen[o.uid]) { seen[o.uid] = 1; out.push(o); } });
    return out;
  }
  var fp = function (o) { return [o.title.toLowerCase().trim(), o.start, o.end || '', o.rrule || ''].join('|'); };
  /** Adaugă `incoming` la `base` fără dubluri (același uid sau aceeași amprentă). Întoarce {items, added, skipped}. */
  function merge(base, incoming) {
    var uids = {}, fps = {}, out = base.slice(), added = [], skipped = 0;
    base.forEach(function (o) { uids[o.uid] = 1; fps[fp(o)] = 1; });
    incoming.forEach(function (o) { if (uids[o.uid] || fps[fp(o)]) { skipped++; return; } uids[o.uid] = 1; fps[fp(o)] = 1; out.push(o); added.push(o); });
    return { items: out, added: added, skipped: skipped };
  }

  /* ---------- .ics ---------- */
  var esc = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); };
  var unesc = function (s) { return String(s).replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1'); };
  function fold(l) { var o = [], b = l; while (b.length > 73) { o.push(b.slice(0, 73)); b = ' ' + b.slice(73); } o.push(b); return o.join('\r\n'); }
  var cmp = function (s) { return s.replace(/[-:]/g, ''); };
  function dtLine(name, val, tz, allDay) {
    if (allDay || DATE_RE.test(val)) return name + ';VALUE=DATE:' + cmp(val.slice(0, 10));
    if (tz === 'UTC') return name + ':' + cmp(val) + '00Z';
    if (tz) return name + ';TZID=' + tz + ':' + cmp(val) + '00';
    return name + ':' + cmp(val) + '00';
  }
  /** Elemente → text .ics (VCALENDAR). Linii pliate la 75 de octeți (aprox.), CRLF. */
  function toICS(items, o) {
    o = o || {}; var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//fara-frontiere//agenda//RO', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + esc(o.name || 'Agenda comună FFF')];
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    items.forEach(function (it) {
      L.push('BEGIN:VEVENT', 'UID:' + it.uid, 'DTSTAMP:' + stamp, fold('SUMMARY:' + esc(it.title)), dtLine('DTSTART', it.start, it.tz, it.allDay));
      if (it.end) L.push(dtLine('DTEND', it.end, it.tz, it.allDay));
      if (it.rrule) L.push('RRULE:' + it.rrule);
      (it.ex || []).forEach(function (v) { L.push(dtLine('EXDATE', v, it.tz, it.allDay)); });
      var cats = [it.cat, it.kind === 'due' ? 'scadență' : ''].filter(Boolean); if (cats.length) L.push(fold('CATEGORIES:' + cats.map(esc).join(',')));
      if (it.amount && o.amounts) L.push(fold('DESCRIPTION:' + esc((it.amount.minor / 100).toFixed(2) + ' ' + (it.amount.cur || ''))));
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.join('\r\n') + '\r\n';
  }
  /** Text .ics → elemente (doar VEVENT; ignoră VALARM/VTODO). Orele UTC rămân UTC, TZID se păstrează, restul e plutitor. */
  function fromICS(text, app) {
    var lines = String(text).replace(/^\uFEFF/, '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/), out = [], cur = null, depth = 0;
    lines.forEach(function (ln) {
      if (/^BEGIN:VEVENT/i.test(ln)) { cur = {}; depth = 0; return; }
      if (!cur) return;
      if (/^BEGIN:/i.test(ln)) { depth++; return; }
      if (/^END:VEVENT/i.test(ln)) { var it = fromProps(cur, app); if (it) out.push(it); cur = null; return; }
      if (/^END:/i.test(ln)) { depth--; return; }
      if (depth > 0) return;
      var c = ln.indexOf(':'); if (c < 1) return;
      var head = ln.slice(0, c).split(';'), name = head[0].toUpperCase(), par = {};
      head.slice(1).forEach(function (p) { var q = p.split('='); par[q[0].toUpperCase()] = (q[1] || '').replace(/^"|"$/g, ''); });
      if (name === 'EXDATE') { (cur.EXD = cur.EXD || []).push({ v: ln.slice(c + 1), p: par }); return; }
      if (!cur[name]) cur[name] = { v: ln.slice(c + 1), p: par };
    });
    return normalize(out, app);
  }
  function parseDT(p) {
    if (!p) return null; var v = p.v.trim(), m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
    if (!m) return null; var d = m[1] + '-' + m[2] + '-' + m[3];
    if (m[4] == null) return { s: d, allDay: true };
    return { s: d + 'T' + m[4] + ':' + m[5], tz: m[7] ? 'UTC' : (p.p.TZID || undefined) };
  }
  function fromProps(c, app) {
    if (c['RECURRENCE-ID']) return null;   // exceptii izolate ale unei serii: nu se transportă (limită documentată)
    var s = parseDT(c.DTSTART); if (!s || !c.SUMMARY) return null; var e = parseDT(c.DTEND);
    var o = { kind: 'event', title: unesc(c.SUMMARY.v), start: s.s, tz: s.tz, allDay: s.allDay, uid: c.UID && c.UID.v };
    if (e) { o.end = e.s; if (s.allDay && e.allDay) { /* DTEND exclusiv la ICS; păstrat ca atare */ } }
    if (c.RRULE) o.rrule = c.RRULE.v;
    if (c.EXD) { o.ex = []; c.EXD.forEach(function (x) { x.v.split(',').forEach(function (v) { var d = parseDT({ v: v, p: x.p }); if (d && o.ex.length < 200) o.ex.push(d.s); }); }); if (!o.ex.length) delete o.ex; }
    if (c.CATEGORIES) { var k = unesc(c.CATEGORIES.v).split(',').map(function (x) { return x.trim(); }).filter(Boolean); if (k.indexOf('scadență') >= 0) o.kind = 'due'; o.cat = k.filter(function (x) { return x !== 'scadență'; })[0]; }
    return o;
  }

  /* ---------- timp ---------- */
  function tzOffsetMs(utcMs, tz) {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }), p = {};
    f.formatToParts(new Date(utcMs)).forEach(function (x) { p[x.type] = +x.value; });
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
  }
  /** Element → moment (ms epoch) al începutului, în fusul `tz` al elementului (UTC / IANA / ora locală a dispozitivului). */
  function startMs(it) {
    var m = it.start.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/); if (!m) return NaN;
    var y = +m[1], mo = +m[2] - 1, d = +m[3], h = +(m[4] || 0), mi = +(m[5] || 0);
    if (it.tz === 'UTC') return Date.UTC(y, mo, d, h, mi);
    if (it.tz) { try { var g = Date.UTC(y, mo, d, h, mi); var t1 = g - tzOffsetMs(g, it.tz); return g - tzOffsetMs(t1, it.tz); } catch (e) { return new Date(y, mo, d, h, mi).getTime(); } }
    return new Date(y, mo, d, h, mi).getTime();
  }
  function localStr(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function mondayOf(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  var dstr = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

  /* ---------- CLEPSIDRA: program săptămânal + numărători inverse ---------- */
  var CLEP_CATS = ['somn', 'deplasare', 'serviciu', 'mese', 'timp-liber', 'altele'];
  /** {weekday:[{start,end,cat}], weekend:[…]} + [{name,ts}] → elemente (blocuri săptămânale + evenimente). */
  function fromClepsidra(sched, events, o) {
    o = o || {}; var out = [], mon = mondayOf(o.now ? new Date(o.now) : new Date());
    [['weekday', [1, 2, 3, 4, 5]], ['weekend', [6, 0]]].forEach(function (g) {
      ((sched && sched[g[0]]) || []).forEach(function (b) {
        if (!b || !/^\d\d:\d\d$/.test(b.start) || !/^\d\d:\d\d$/.test(b.end)) return;
        var first = Math.min.apply(null, g[1].map(function (w) { return (w + 6) % 7; })), day = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + first);
        var overnight = b.end <= b.start, nd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + (overnight ? 1 : 0));
        out.push({ kind: 'block', title: b.cat || 'altele', cat: b.cat || 'altele', start: dstr(day) + 'T' + b.start, end: dstr(nd) + 'T' + b.end,
          rrule: 'FREQ=WEEKLY;BYDAY=' + g[1].map(function (w) { return WD[w]; }).join(','), uid: 'clep-' + hash(g[0] + b.start + b.end + b.cat) + '@fff.agenda' });
      });
    });
    (events || []).forEach(function (e) { if (e && typeof e.ts === 'number' && e.name) out.push({ kind: 'event', title: e.name, start: localStr(e.ts), uid: 'clep-ev-' + hash(e.name + e.ts) + '@fff.agenda' }); });
    return normalize(out, 'CLEPSIDRA');
  }
  /** Elemente → {schedule:{weekday,weekend}|null, events:[{name,ts}]} pentru CLEPSIDRA (blocuri săptămânale; evenimente viitoare, cel mult `maxEvents`). */
  function toClepsidra(items, o) {
    o = o || {}; var now = o.now || Date.now(), maxEv = o.maxEvents || 6, wd = [], we = [], evs = [];
    items.forEach(function (it) {
      var r = it.rrule || '', weekly = /FREQ=WEEKLY/.test(r), by = (r.match(/BYDAY=([A-Z,]+)/) || [])[1];
      if (weekly && by && it.start.length === 16 && it.end && it.end.length === 16) {
        var days = by.split(',').map(function (x) { return WD.indexOf(x); }).filter(function (x) { return x >= 0; });
        var blk = { start: it.start.slice(11), end: it.end.slice(11), cat: CLEP_CATS.indexOf(it.cat) >= 0 ? it.cat : (CLEP_CATS.indexOf(it.title) >= 0 ? it.title : 'altele') };
        if (blk.start === blk.end) return;
        if (days.some(function (d) { return d >= 1 && d <= 5; })) wd.push(blk);
        if (days.some(function (d) { return d === 0 || d === 6; })) we.push(blk);
      } else if (!r && !it.allDay) { var ms = startMs(it); if (ms > now) evs.push({ name: it.title.slice(0, 40), ts: ms }); }
    });
    evs.sort(function (a, b) { return a.ts - b.ts; });
    return { schedule: (wd.length || we.length) ? { weekday: wd.slice(0, 40), weekend: we.slice(0, 40) } : null, events: evs.slice(0, maxEv) };
  }

  /* ---------- plic ---------- */
  function envelope(items, o) {
    var E = root.FFF && root.FFF.envelope; if (!E) throw new Error('fără FFF.envelope');
    return E.create({ type: 'agenda/fff', title: o.title || 'Agenda comună', payload: { v: 1, items: items }, app: o.app, source: { label: o.app }, lang: lang() });
  }
  /** Plic primit (agenda/fff sau events/ics) → elemente curate. */
  function fromEnvelope(env, app) {
    if (!env) return [];
    if (env.type === 'events/ics') return fromICS(typeof env.payload === 'string' ? env.payload : '', app);
    if (env.type === 'agenda/fff' && env.payload && env.payload.v === 1) return normalize(env.payload.items, app);
    return [];
  }
  /** Butoane „Trimite / Primește” pentru o aplicație. o = {slug, app, getItems(): Promise<items>|items, addItems(items, env): {added,skipped}|number|void, className, parent, before}. */
  function mount(o) {
    var E = root.FFF && root.FFF.envelope, d = root.document; if (!E || !d) return null;
    var send = E.sendButton({ slug: o.slug, className: o.className, text: tr('send'), getEnv: function () {
      return Promise.resolve(o.getItems()).then(function (it) { it = normalize(it, o.app); if (!it.length) { E.toast(tr('none')); return null; } return envelope(it, { app: o.app, title: tr('cap') + ' · ' + o.app }); });
    } });
    send.id = 'fffAgSend';
    var recv = E.importButton({ accepts: ['agenda/fff', 'events/ics'], className: o.className, text: tr('recv'), onReceive: onRecv });
    recv.id = 'fffAgRecv';
    function onRecv(env) {
      var it = fromEnvelope(env, o.app); if (!it.length) { E.toast(tr('bad')); return; }
      var r = o.addItems(it, env); var n = r && typeof r === 'object' ? r.added : (typeof r === 'number' ? r : it.length), s = r && typeof r === 'object' ? r.skipped || 0 : 0;
      E.toast(tr('done', { n: n, s: s }));
    }
    var host = o.parent || d.body;
    if (o.before && o.before.parentNode) { o.before.parentNode.insertBefore(send, o.before); o.before.parentNode.insertBefore(recv, o.before); } else { host.appendChild(send); host.appendChild(recv); }
    try { E.mount({ accepts: ['agenda/fff', 'events/ics'], onReceive: onRecv }); } catch (e) { /* mount repetat */ }
    return { send: send, recv: recv, onRecv: onRecv };
  }
  return { VERSION: 1, I18N: I18N, normalize: normalize, merge: merge, toICS: toICS, fromICS: fromICS, startMs: startMs, fromClepsidra: fromClepsidra, toClepsidra: toClepsidra,
    envelope: envelope, fromEnvelope: fromEnvelope, mount: mount, tr: tr, hash: hash };
});
