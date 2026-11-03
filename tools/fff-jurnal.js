/* fff-jurnal · Jurnal de teren FFF — jurnal geolocalizat comun aplicațiilor de teren (FieldObserver, VATRA, URME, Poteca, ExploratoriiEco), în plicul `geo/journal`, cu atlas în Arhiva fără frontiere.
 * Sursa canonică e ACEST fișier (tools/fff-jurnal.js); aplicațiile îl primesc prin `node tools/inject-shared.mjs`, nu prin copiere de mână.
 * Ce face: o intrare = {id, ts, lat, lon, title, note, kind, app}; jurnalul se ține local (localStorage `fff.jurnal`, max 2000), se completează cu locația dispozitivului (doar la cerere,
 * cu permisiunea browserului) sau cu coordonate scrise de mână, se exportă ca plic `geo/journal` / GeoJSON / GPX și se unește cu jurnalele primite (fără duplicate, după id).
 * Confidențialitate: coordonatele sunt date personale; nimic nu pleacă singur. La export se poate rotunji poziția (implicit ~100 m). Fără rețea, fără hărți încărcate de pe servere:
 * „atlasul” e un grafic SVG local al punctelor. Coordonatele sunt cele introduse sau date de dispozitiv, neverificate. */
(function (root, factory) {
  var S = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = S;
  if (root) { try { var F = root.FFF || {}; root.FFF = F; if (root.FFF === F) F.jurnal = S; } catch (e) { /* inert */ } }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var KEY = 'fff.jurnal', MAX = 2000, KINDS = ['obs', 'trail', 'place', 'sample'];
  var I18N = {
    ro: { open: 'Jurnal de teren', title: 'Jurnal de teren', add: 'Adaugă o intrare', ttl: 'Titlu', note: 'Notă', kind: 'Fel', obs: 'observație', trail: 'traseu / punct de trecere', place: 'loc', sample: 'probă', lat: 'Latitudine', lon: 'Longitudine', here: 'Locația mea', locating: 'Se caută locația…', nogeo: 'Locația nu e disponibilă; scrie coordonatele.', bad: 'Coordonate invalide (latitudine −90…90, longitudine −180…180).', need: 'Scrie un titlu.', saved: 'Intrare salvată', del: 'Șterge', count: '{n} intrări, {a} aplicații', empty: 'Jurnalul e gol.', privacy: 'Coordonatele sunt date personale: rămân pe acest dispozitiv până trimiți tu un plic sau exporți.', round: 'La export, poziția', r0: 'exactă', r1: '~100 m', r2: '~1 km', send: 'Trimite jurnalul (plic)', recv: 'Primește jurnal', geojson: 'Exportă GeoJSON', gpx: 'Exportă GPX', close: 'Închide', merged: '{a} intrări noi, {s} deja existente', atlas: 'Atlas (local, fără hartă încărcată de pe server)', clear: 'Șterge tot jurnalul', clearq: 'Ștergi toate intrările din jurnal?', none: 'Nu e nimic de trimis.', pt: 'Punct {i}: {t} ({lat}, {lon})' },
    en: { open: 'Field journal', title: 'Field journal', add: 'Add an entry', ttl: 'Title', note: 'Note', kind: 'Kind', obs: 'observation', trail: 'trail / waypoint', place: 'place', sample: 'sample', lat: 'Latitude', lon: 'Longitude', here: 'My location', locating: 'Locating…', nogeo: 'Location is not available; type the coordinates.', bad: 'Invalid coordinates (latitude −90…90, longitude −180…180).', need: 'Write a title.', saved: 'Entry saved', del: 'Delete', count: '{n} entries, {a} apps', empty: 'The journal is empty.', privacy: 'Coordinates are personal data: they stay on this device until you send an envelope or export.', round: 'On export, position', r0: 'exact', r1: '~100 m', r2: '~1 km', send: 'Send the journal (envelope)', recv: 'Receive a journal', geojson: 'Export GeoJSON', gpx: 'Export GPX', close: 'Close', merged: '{a} new entries, {s} already present', atlas: 'Atlas (local, no map loaded from a server)', clear: 'Clear the whole journal', clearq: 'Delete all journal entries?', none: 'Nothing to send.', pt: 'Point {i}: {t} ({lat}, {lon})' },
    fr: { open: 'Journal de terrain', title: 'Journal de terrain', add: 'Ajouter une entrée', ttl: 'Titre', note: 'Note', kind: 'Type', obs: 'observation', trail: 'sentier / point de passage', place: 'lieu', sample: 'échantillon', lat: 'Latitude', lon: 'Longitude', here: 'Ma position', locating: 'Recherche de la position…', nogeo: 'Position indisponible ; saisissez les coordonnées.', bad: 'Coordonnées invalides (latitude −90…90, longitude −180…180).', need: 'Écrivez un titre.', saved: 'Entrée enregistrée', del: 'Supprimer', count: '{n} entrées, {a} applis', empty: 'Le journal est vide.', privacy: 'Les coordonnées sont des données personnelles : elles restent sur cet appareil jusqu’à ce que vous envoyiez une enveloppe ou exportiez.', round: 'À l’export, la position', r0: 'exacte', r1: '~100 m', r2: '~1 km', send: 'Envoyer le journal (enveloppe)', recv: 'Recevoir un journal', geojson: 'Exporter en GeoJSON', gpx: 'Exporter en GPX', close: 'Fermer', merged: '{a} nouvelles entrées, {s} déjà présentes', atlas: 'Atlas (local, sans carte chargée depuis un serveur)', clear: 'Vider le journal', clearq: 'Supprimer toutes les entrées du journal ?', none: 'Rien à envoyer.', pt: 'Point {i} : {t} ({lat}, {lon})' },
    it: { open: 'Diario di campo', title: 'Diario di campo', add: 'Aggiungi una voce', ttl: 'Titolo', note: 'Nota', kind: 'Tipo', obs: 'osservazione', trail: 'sentiero / punto di passaggio', place: 'luogo', sample: 'campione', lat: 'Latitudine', lon: 'Longitudine', here: 'La mia posizione', locating: 'Ricerca della posizione…', nogeo: 'Posizione non disponibile; scrivi le coordinate.', bad: 'Coordinate non valide (latitudine −90…90, longitudine −180…180).', need: 'Scrivi un titolo.', saved: 'Voce salvata', del: 'Elimina', count: '{n} voci, {a} app', empty: 'Il diario è vuoto.', privacy: 'Le coordinate sono dati personali: restano su questo dispositivo finché non invii una busta o esporti.', round: 'All’esportazione, la posizione', r0: 'esatta', r1: '~100 m', r2: '~1 km', send: 'Invia il diario (busta)', recv: 'Ricevi un diario', geojson: 'Esporta GeoJSON', gpx: 'Esporta GPX', close: 'Chiudi', merged: '{a} voci nuove, {s} già presenti', atlas: 'Atlante (locale, senza mappa caricata da un server)', clear: 'Svuota il diario', clearq: 'Eliminare tutte le voci del diario?', none: 'Niente da inviare.', pt: 'Punto {i}: {t} ({lat}, {lon})' },
    es: { open: 'Diario de campo', title: 'Diario de campo', add: 'Añadir una entrada', ttl: 'Título', note: 'Nota', kind: 'Tipo', obs: 'observación', trail: 'sendero / punto de paso', place: 'lugar', sample: 'muestra', lat: 'Latitud', lon: 'Longitud', here: 'Mi ubicación', locating: 'Buscando la ubicación…', nogeo: 'Ubicación no disponible; escribe las coordenadas.', bad: 'Coordenadas no válidas (latitud −90…90, longitud −180…180).', need: 'Escribe un título.', saved: 'Entrada guardada', del: 'Eliminar', count: '{n} entradas, {a} apps', empty: 'El diario está vacío.', privacy: 'Las coordenadas son datos personales: permanecen en este dispositivo hasta que envíes un sobre o exportes.', round: 'Al exportar, la posición', r0: 'exacta', r1: '~100 m', r2: '~1 km', send: 'Enviar el diario (sobre)', recv: 'Recibir un diario', geojson: 'Exportar GeoJSON', gpx: 'Exportar GPX', close: 'Cerrar', merged: '{a} entradas nuevas, {s} ya existentes', atlas: 'Atlas (local, sin mapa cargado desde un servidor)', clear: 'Vaciar el diario', clearq: '¿Eliminar todas las entradas del diario?', none: 'Nada que enviar.', pt: 'Punto {i}: {t} ({lat}, {lon})' },
    pt: { open: 'Diário de campo', title: 'Diário de campo', add: 'Adicionar uma entrada', ttl: 'Título', note: 'Nota', kind: 'Tipo', obs: 'observação', trail: 'trilho / ponto de passagem', place: 'local', sample: 'amostra', lat: 'Latitude', lon: 'Longitude', here: 'A minha localização', locating: 'A procurar a localização…', nogeo: 'Localização indisponível; escreva as coordenadas.', bad: 'Coordenadas inválidas (latitude −90…90, longitude −180…180).', need: 'Escreva um título.', saved: 'Entrada guardada', del: 'Eliminar', count: '{n} entradas, {a} apps', empty: 'O diário está vazio.', privacy: 'As coordenadas são dados pessoais: ficam neste dispositivo até enviar um envelope ou exportar.', round: 'Ao exportar, a posição', r0: 'exata', r1: '~100 m', r2: '~1 km', send: 'Enviar o diário (envelope)', recv: 'Receber um diário', geojson: 'Exportar GeoJSON', gpx: 'Exportar GPX', close: 'Fechar', merged: '{a} entradas novas, {s} já existentes', atlas: 'Atlas (local, sem mapa carregado de um servidor)', clear: 'Esvaziar o diário', clearq: 'Eliminar todas as entradas do diário?', none: 'Nada para enviar.', pt: 'Ponto {i}: {t} ({lat}, {lon})' },
    de: { open: 'Feldjournal', title: 'Feldjournal', add: 'Eintrag hinzufügen', ttl: 'Titel', note: 'Notiz', kind: 'Art', obs: 'Beobachtung', trail: 'Weg / Wegpunkt', place: 'Ort', sample: 'Probe', lat: 'Breitengrad', lon: 'Längengrad', here: 'Mein Standort', locating: 'Standort wird gesucht…', nogeo: 'Standort nicht verfügbar; Koordinaten eintragen.', bad: 'Ungültige Koordinaten (Breite −90…90, Länge −180…180).', need: 'Titel eingeben.', saved: 'Eintrag gespeichert', del: 'Löschen', count: '{n} Einträge, {a} Apps', empty: 'Das Journal ist leer.', privacy: 'Koordinaten sind personenbezogene Daten: Sie bleiben auf diesem Gerät, bis Sie einen Umschlag senden oder exportieren.', round: 'Beim Export, die Position', r0: 'genau', r1: '~100 m', r2: '~1 km', send: 'Journal senden (Umschlag)', recv: 'Journal empfangen', geojson: 'GeoJSON exportieren', gpx: 'GPX exportieren', close: 'Schließen', merged: '{a} neue Einträge, {s} bereits vorhanden', atlas: 'Atlas (lokal, keine Karte von einem Server)', clear: 'Journal leeren', clearq: 'Alle Journaleinträge löschen?', none: 'Nichts zu senden.', pt: 'Punkt {i}: {t} ({lat}, {lon})' },
    hu: { open: 'Terepnapló', title: 'Terepnapló', add: 'Bejegyzés hozzáadása', ttl: 'Cím', note: 'Megjegyzés', kind: 'Fajta', obs: 'megfigyelés', trail: 'útvonal / útpont', place: 'hely', sample: 'minta', lat: 'Szélesség', lon: 'Hosszúság', here: 'Saját helyzetem', locating: 'Helymeghatározás…', nogeo: 'A helyzet nem érhető el; írd be a koordinátákat.', bad: 'Érvénytelen koordináták (szélesség −90…90, hosszúság −180…180).', need: 'Írj címet.', saved: 'Bejegyzés mentve', del: 'Törlés', count: '{n} bejegyzés, {a} alkalmazás', empty: 'A napló üres.', privacy: 'A koordináták személyes adatok: ezen az eszközön maradnak, amíg borítékot nem küldesz vagy nem exportálsz.', round: 'Exportáláskor a helyzet', r0: 'pontos', r1: '~100 m', r2: '~1 km', send: 'Napló küldése (boríték)', recv: 'Napló fogadása', geojson: 'GeoJSON exportálása', gpx: 'GPX exportálása', close: 'Bezárás', merged: '{a} új bejegyzés, {s} már megvolt', atlas: 'Atlasz (helyi, kiszolgálóról betöltött térkép nélkül)', clear: 'Napló törlése', clearq: 'Törlöd a napló összes bejegyzését?', none: 'Nincs mit küldeni.', pt: '{i}. pont: {t} ({lat}, {lon})' }
  };
  function lang() { var l = ''; try { l = (root.document && root.document.documentElement.lang || '').slice(0, 2).toLowerCase(); } catch (e) { /* */ } return I18N[l] ? l : 'en'; }
  function tr(k, v) { var s = I18N[lang()][k]; if (typeof s !== 'string') s = I18N.en[k]; if (typeof s !== 'string') return k; if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]); return s; }
  var str = function (x, n) { return String(x == null ? '' : x).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, ' ').trim().slice(0, n); };
  function fnv(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); }
  function coord(x, lo, hi) { var v = typeof x === 'number' ? x : parseFloat(String(x == null ? '' : x).replace(',', '.')); return isFinite(v) && v >= lo && v <= hi ? Math.round(v * 1e6) / 1e6 : null; }

  /** Intrare curată sau null: lat/lon valide obligatorii, titlu obligatoriu; id determinist din (app, ts, lat, lon, titlu). */
  function cleanEntry(x) {
    if (!x || typeof x !== 'object') return null;
    var lat = coord(x.lat, -90, 90), lon = coord(x.lon, -180, 180), title = str(x.title, 120), ts = str(x.ts, 40);
    if (lat === null || lon === null || !title) return null;
    if (!ts || isNaN(Date.parse(ts))) ts = new Date().toISOString();
    var app = str(x.app, 40), e = { id: '', ts: ts, lat: lat, lon: lon, title: title, note: str(x.note, 1000), kind: KINDS.indexOf(x.kind) >= 0 ? x.kind : 'obs', app: app };
    if (typeof x.acc === 'number' && isFinite(x.acc) && x.acc >= 0) e.acc = Math.round(x.acc);
    e.id = /^[0-9a-f]{8}$/.test(x.id) ? x.id : fnv([app, ts, lat, lon, title].join('|'));
    return e;
  }
  function load() {
    try { var a = JSON.parse(root.localStorage.getItem(KEY) || '[]'); return (Array.isArray(a) ? a : []).map(cleanEntry).filter(Boolean).slice(0, MAX); } catch (e) { return []; }
  }
  function save(list) { try { root.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); return true; } catch (e) { return false; } }
  /** Unește (fără duplicate, după id). Întoarce {list, added, skipped}. Cele mai noi primele. */
  function merge(base, incoming) {
    var seen = {}, out = (base || []).slice(), added = 0, skipped = 0;
    out.forEach(function (e) { seen[e.id] = 1; });
    (incoming || []).forEach(function (x) { var e = cleanEntry(x); if (!e) { skipped++; return; } if (seen[e.id] || out.length >= MAX) { skipped++; return; } seen[e.id] = 1; out.push(e); added++; });
    out.sort(function (a, b) { return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0; }); return { list: out, added: added, skipped: skipped };
  }
  function add(x) { var e = cleanEntry(x); if (!e) return null; var r = merge(load(), [e]); if (!r.added) return e; return save(r.list) ? e : null; }
  function remove(id) { save(load().filter(function (e) { return e.id !== id; })); }
  /** Rotunjire la export: 0 = exact, 1 = ~100 m (3 zecimale), 2 = ~1 km (2 zecimale). Id-ul se păstrează (nu se recalculează). */
  function rounded(list, level) {
    var d = level === 2 ? 2 : level === 1 ? 3 : 6, p = Math.pow(10, d);
    return list.map(function (e) { var o = {}; for (var k in e) o[k] = e[k]; o.lat = Math.round(e.lat * p) / p; o.lon = Math.round(e.lon * p) / p; if (level) delete o.acc; return o; });
  }
  function payload(list, app, level) { return { entries: rounded(list, level || 0), app: app || '', rounded: level || 0, count: list.length }; }
  function envelope(list, app, slug, level) {
    var E = root.FFF && root.FFF.envelope; if (!E || !list || !list.length) return null;
    return E.create({ type: 'geo/journal', title: (app ? app + ' · ' : '') + tr('title'), payload: payload(list, app, level), app: app || slug || 'FFF', source: { label: (app || slug || '') + ' · ' + tr('title') }, lang: root.document ? root.document.documentElement.lang : '' });
  }
  function fromEnvelope(env) { var p = env && env.payload; if (!p || !Array.isArray(p.entries)) return null; return p.entries.slice(0, MAX).map(cleanEntry).filter(Boolean); }
  var xml = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  function toGeoJSON(list, level) {
    return JSON.stringify({ type: 'FeatureCollection', features: rounded(list, level || 0).map(function (e) { return { type: 'Feature', geometry: { type: 'Point', coordinates: [e.lon, e.lat] }, properties: { id: e.id, title: e.title, note: e.note, kind: e.kind, app: e.app, time: e.ts } }; }) }, null, 1);
  }
  function toGpx(list, level) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="FFF jurnal" xmlns="http://www.topografix.com/GPX/1/1">\n' + rounded(list, level || 0).map(function (e) {
      return '<wpt lat="' + e.lat + '" lon="' + e.lon + '"><time>' + xml(e.ts) + '</time><name>' + xml(e.title) + '</name>' + (e.note ? '<desc>' + xml(e.note) + '</desc>' : '') + '<type>' + xml(e.kind) + '</type></wpt>';
    }).join('\n') + '\n</gpx>\n';
  }
  /** Punctele pe un grafic SVG (proiecție plată lon/lat, fără hartă): întoarce șirul SVG. */
  function atlasSvg(list, w, h) {
    w = w || 360; h = h || 200; var pts = list.slice(0, 500), sx = function (lo) { return Math.round(((lo + 180) / 360) * w * 10) / 10; }, sy = function (la) { return Math.round(((90 - la) / 180) * h * 10) / 10; }, apps = {}, col = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#8c564b', '#e377c2'];
    var g = '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="none" stroke="currentColor"/>';
    for (var lo = -150; lo <= 150; lo += 30) g += '<line x1="' + sx(lo) + '" y1="0" x2="' + sx(lo) + '" y2="' + h + '" stroke="currentColor" opacity=".15"/>';
    for (var la = -60; la <= 60; la += 30) g += '<line x1="0" y1="' + sy(la) + '" x2="' + w + '" y2="' + sy(la) + '" stroke="currentColor" opacity=".15"/>';
    pts.forEach(function (e, i) { if (!(e.app in apps)) apps[e.app] = Object.keys(apps).length; var c = col[apps[e.app] % col.length]; g += '<circle cx="' + sx(e.lon) + '" cy="' + sy(e.lat) + '" r="4" fill="' + c + '" stroke="Canvas" stroke-width="1"><title>' + xml(tr('pt', { i: i + 1, t: e.title, lat: e.lat, lon: e.lon })) + '</title></circle>'; });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="' + xml(tr('atlas')) + '">' + g + '</svg>';
  }
  function stats(list) { var a = {}; list.forEach(function (e) { a[e.app || '?'] = 1; }); return { n: list.length, apps: Object.keys(a).length }; }

  /* ---------- interfață ---------- */
  var CSS = '.fffj-fab{position:fixed;left:12px;bottom:12px;z-index:2147483001;min-height:44px;min-width:44px;padding:8px 14px;border:2px solid CanvasText;border-radius:22px;background:Canvas;color:CanvasText;font:600 14px system-ui;cursor:pointer;box-shadow:0 2px 8px #0003}' +
    '.fffj-box{position:fixed;left:12px;bottom:64px;z-index:2147483000;width:min(480px,calc(100vw - 24px));max-height:calc(100vh - 84px);overflow:auto;background:Canvas;color:CanvasText;border:2px solid CanvasText;border-radius:12px;padding:14px;font:14px/1.4 system-ui;box-shadow:0 6px 24px #0005}' +
    '.fffj-box h2,.fffj-box h3,.fffj-box label,.fffj-box p,.fffj-box small,.fffj-box li,.fffj-box strong,.fffj-box th,.fffj-box td,.fffj-box div{color:CanvasText}.fffj-box h2{font:700 16px system-ui;margin:0 0 8px}.fffj-box label{display:block;margin:8px 0 2px;font-weight:600}.fffj-box input,.fffj-box select,.fffj-box textarea{box-sizing:border-box;width:100%;font:inherit;padding:6px;color:CanvasText;background:Canvas;border:1px solid GrayText;border-radius:6px}' +
    '.fffj-box button{min-height:44px;min-width:44px;padding:6px 12px;margin:4px 6px 4px 0;font:inherit;color:CanvasText;background:Canvas;border:1px solid CanvasText;border-radius:8px;cursor:pointer}.fffj-box button.fffj-pri{background:CanvasText;color:Canvas}' +
    '.fffj-row{display:flex;flex-wrap:wrap;gap:2px}.fffj-2{display:grid;grid-template-columns:1fr 1fr;gap:6px}.fffj-box ul{list-style:none;margin:8px 0;padding:0}.fffj-box li{border-top:1px solid GrayText;padding:6px 0}.fffj-box small{opacity:.85}';
  function el(tag, attrs, kids) {
    var d = root.document, n = d.createElement(tag); for (var k in (attrs || {})) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? d.createTextNode(c) : c); }); return n;
  }
  function css() { var d = root.document; if (d.getElementById('fffj-css')) return; var s = d.createElement('style'); s.id = 'fffj-css'; s.textContent = CSS; d.head.appendChild(s); }
  function toast(t) { var E = root.FFF && root.FFF.envelope; if (E && E.toast) E.toast(t); }
  function download(name, mime, text) {
    var d = root.document, b = new root.Blob([text], { type: mime + ';charset=utf-8' }), u = root.URL.createObjectURL(b), a = d.createElement('a'); a.href = u; a.download = name; d.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { root.URL.revokeObjectURL(u); }, 1000);
  }
  /** Panou: o = {app, slug, draft?: () => {title, note, lat, lon, kind}, atlas?: bool}. */
  function panel(o) {
    var d = root.document, E = root.FFF && root.FFF.envelope; css(); var old = d.getElementById('fffj-panel'); if (old) { old.remove(); return null; }
    var box = el('div', { 'class': 'fffj-box', role: 'dialog', 'aria-label': tr('title'), id: 'fffj-panel' }), level = 1;
    function closeBox() { box.remove(); var f = d.getElementById('fffjFab'); if (f) f.focus(); }
    function draw() {
      box.textContent = ''; var list = load(), st = stats(list), dr = {}; try { dr = (o.draft && o.draft()) || {}; } catch (e) { dr = {}; }
      box.appendChild(el('h2', { text: tr('title') })); box.appendChild(el('small', { id: 'fffj-count', text: tr('count', { n: st.n, a: st.apps }) })); box.appendChild(el('p', {}, [el('small', { text: tr('privacy') })]));
      var ti = el('input', { id: 'fffj-title', maxlength: '120', value: str(dr.title, 120) }), no = el('textarea', { id: 'fffj-note', rows: '2', maxlength: '1000' }); no.value = str(dr.note, 1000);
      var kd = el('select', { id: 'fffj-kind' }, KINDS.map(function (k) { return el('option', { value: k, text: tr(k) }); })); if (KINDS.indexOf(dr.kind) >= 0) kd.value = dr.kind;
      var la = el('input', { id: 'fffj-lat', inputmode: 'decimal', maxlength: '12', value: dr.lat != null ? String(dr.lat) : '' }), lo = el('input', { id: 'fffj-lon', inputmode: 'decimal', maxlength: '13', value: dr.lon != null ? String(dr.lon) : '' });
      var msg = el('p', { id: 'fffj-msg', role: 'status', 'aria-live': 'polite' }), acc = null;
      box.appendChild(el('label', { 'for': 'fffj-title', text: tr('ttl') })); box.appendChild(ti); box.appendChild(el('label', { 'for': 'fffj-note', text: tr('note') })); box.appendChild(no);
      box.appendChild(el('label', { 'for': 'fffj-kind', text: tr('kind') })); box.appendChild(kd);
      box.appendChild(el('div', { 'class': 'fffj-2' }, [el('div', {}, [el('label', { 'for': 'fffj-lat', text: tr('lat') }), la]), el('div', {}, [el('label', { 'for': 'fffj-lon', text: tr('lon') }), lo])]));
      var bar = el('div', { 'class': 'fffj-row' }), here = el('button', { type: 'button', id: 'fffj-here', text: tr('here') });
      here.addEventListener('click', function () {
        var g = root.navigator && root.navigator.geolocation; if (!g) { msg.textContent = tr('nogeo'); return; } msg.textContent = tr('locating');
        g.getCurrentPosition(function (p) { la.value = String(Math.round(p.coords.latitude * 1e5) / 1e5); lo.value = String(Math.round(p.coords.longitude * 1e5) / 1e5); acc = p.coords.accuracy; msg.textContent = ''; }, function () { msg.textContent = tr('nogeo'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
      });
      var sv = el('button', { type: 'button', 'class': 'fffj-pri', id: 'fffj-save', text: tr('add') });
      sv.addEventListener('click', function () {
        if (!ti.value.trim()) { msg.textContent = tr('need'); ti.focus(); return; }
        var e = cleanEntry({ title: ti.value, note: no.value, kind: kd.value, lat: la.value, lon: lo.value, app: o.app, ts: new Date().toISOString(), acc: acc }); if (!e) { msg.textContent = tr('bad'); la.focus(); return; }
        if (add(e)) { toast(tr('saved')); draw(); } else msg.textContent = tr('bad');
      });
      bar.appendChild(here); bar.appendChild(sv); box.appendChild(bar); box.appendChild(msg);
      if (list.length) {
        var wrap = el('div', { id: 'fffj-atlas' }); wrap.innerHTML = atlasSvg(list); box.appendChild(el('h3', { text: tr('atlas'), style: 'font:700 14px system-ui;margin:10px 0 0' })); box.appendChild(wrap);
      }
      var ul = el('ul', { id: 'fffj-list' }); if (!list.length) ul.appendChild(el('li', { text: tr('empty') }));
      list.slice(0, 30).forEach(function (e) {
        var b = el('button', { type: 'button', text: tr('del'), 'aria-label': tr('del') + ': ' + e.title }); b.addEventListener('click', function () { remove(e.id); draw(); });
        ul.appendChild(el('li', {}, [el('strong', { text: e.title }), ' ', el('small', { text: e.app + ' · ' + tr(e.kind) + ' · ' + e.lat + ', ' + e.lon + ' · ' + e.ts.slice(0, 10) }), b]));
      }); box.appendChild(ul);
      var sel = el('select', { id: 'fffj-round', 'aria-label': tr('round') }, [0, 1, 2].map(function (i) { return el('option', { value: String(i), text: tr('r' + i) }); })); sel.value = String(level);
      sel.addEventListener('change', function () { level = +sel.value; });
      box.appendChild(el('label', { 'for': 'fffj-round', text: tr('round') })); box.appendChild(sel);
      var b2 = el('div', { 'class': 'fffj-row' });
      if (E) {
        var sb = E.sendButton({ slug: o.slug, text: tr('send'), getEnv: function () { var e = envelope(load(), o.app, o.slug, level); if (!e) { toast(tr('none')); return null; } return e; } }); sb.id = 'fffj-send'; b2.appendChild(sb);
        var rb = E.importButton({ accepts: ['geo/journal'], text: tr('recv'), onReceive: function (env) { var inc = fromEnvelope(env); if (!inc) throw 0; var r = merge(load(), inc); save(r.list); draw(); return tr('merged', { a: r.added, s: r.skipped }); } }); rb.id = 'fffj-recv'; b2.appendChild(rb);
      }
      [['geojson', 'jurnal.geojson', 'application/geo+json', toGeoJSON], ['gpx', 'jurnal.gpx', 'application/gpx+xml', toGpx]].forEach(function (x) {
        var b = el('button', { type: 'button', id: 'fffj-' + x[0], text: tr(x[0]) }); b.addEventListener('click', function () { var l = load(); if (!l.length) { toast(tr('none')); return; } download(x[1], x[2], x[3](l, level)); }); b2.appendChild(b);
      });
      var cl = el('button', { type: 'button', text: tr('clear') }); cl.addEventListener('click', function () { if (root.confirm(tr('clearq'))) { save([]); draw(); } });
      var xb = el('button', { type: 'button', id: 'fffj-close', text: tr('close') }); xb.addEventListener('click', closeBox); b2.appendChild(cl); b2.appendChild(xb); box.appendChild(b2);
    }
    box.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeBox(); });
    draw(); d.body.appendChild(box); var f = box.querySelector('input'); if (f) f.focus(); return box;
  }
  function mount(o) {
    var d = root.document; if (!d || !d.body || d.getElementById('fffjFab')) return null; css();
    var fab = el('button', { type: 'button', id: 'fffjFab', 'class': o.host ? (o.className || '') : 'fffj-fab', text: tr('open'), 'aria-haspopup': 'dialog' });
    fab.addEventListener('click', function () { panel(o); }); (o.host || d.body).appendChild(fab); return fab;
  }
  return { VERSION: 1, KEY: KEY, MAX: MAX, I18N: I18N, tr: tr, cleanEntry: cleanEntry, load: load, save: save, add: add, remove: remove, merge: merge, rounded: rounded, payload: payload, envelope: envelope, fromEnvelope: fromEnvelope,
    toGeoJSON: toGeoJSON, toGpx: toGpx, atlasSvg: atlasSvg, stats: stats, panel: panel, mount: mount };
});
