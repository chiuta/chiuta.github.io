/* fff-ab · Motor A/B comun FFF — „ce variantă e mai bună?”: comparații pe perechi, scor Elo, verdict prudent, rezultate în plicul `experiment/ab`.
 * Sursa canonică e ACEST fișier (tools/fff-ab.js); aplicațiile îl primesc prin `node tools/inject-shared.mjs`, nu prin copiere de mână.
 * Ce face: persoana alege variantele (preluate din aplicație sau scrise de ea, 2–12), motorul propune perechi (cele comparate cel mai puțin), persoana
 * apasă A, B, „la egalitate” sau „sar peste”; rezultatul = clasament Elo (K=32, start 1500, în ordinea voturilor) + victorii/înfrângeri.
 * Ce NU face: nu măsoară calitatea; e preferința uneia sau a câtorva persoane, pe criteriul scris în întrebare. Verdictul „conduce X” apare doar
 * după cel puțin 3 comparații per variantă și o diferență de cel puțin 60 de puncte Elo; altfel „încă nu se poate spune”. Fără rețea. */
(function (root, factory) {
  var S = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = S;
  if (root) { try { var F = root.FFF || {}; root.FFF = F; if (root.FFF === F) F.ab = S; } catch (e) { /* inert */ } }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var K = 32, START = 1500, MIN_VARIANTS = 2, MAX_VARIANTS = 12, MAX_ROUNDS = 2000, MIN_GAMES = 3, MIN_GAP = 60, LABEL_MAX = 120, Q_MAX = 200;
  var I18N = {
    ro: { open: 'A/B', title: 'Ce variantă e mai bună?', q: 'Întrebare / criteriu', qph: 'ex. care e mai clar?', vars: 'Variante (câte una pe linie, 2–12)', fill: 'Preia din aplicație', start: 'Începe comparația', pick: 'Care e mai bună?', a: 'A este mai bună', b: 'B este mai bună', tie: 'La egalitate', skip: 'Sar peste', undo: 'Anulează ultimul vot', prog: '{n} voturi', rank: 'Clasament', col1: 'Variantă', col2: 'Elo', col3: 'Victorii', col4: 'Înfrângeri', col5: 'Egalități', verdict: 'Verdict', lead: 'Conduce „{x}” (diferență {d} puncte Elo)', nolead: 'Încă nu se poate spune (nevoie de ≥ {g} comparații per variantă și ≥ {m} puncte diferență)', caveat: 'Preferința uneia sau a câtorva persoane, pe criteriul scris mai sus; nu e o măsurătoare.', send: 'Trimite rezultatul (plic)', recv: 'Primește rezultat', reset: 'Reia de la zero', resetq: 'Ștergi comparațiile și variantele?', close: 'Închide', need: 'Scrie cel puțin două variante.', none: 'Nu e nimic de trimis încă.', edit: 'Schimbă variantele', imported: 'Rezultat primit: {n} voturi', more: 'Continuă' },
    en: { open: 'A/B', title: 'Which variant is better?', q: 'Question / criterion', qph: 'e.g. which is clearer?', vars: 'Variants (one per line, 2–12)', fill: 'Take from the app', start: 'Start comparing', pick: 'Which one is better?', a: 'A is better', b: 'B is better', tie: 'Tie', skip: 'Skip', undo: 'Undo last vote', prog: '{n} votes', rank: 'Ranking', col1: 'Variant', col2: 'Elo', col3: 'Wins', col4: 'Losses', col5: 'Ties', verdict: 'Verdict', lead: '“{x}” leads (gap {d} Elo points)', nolead: 'Too early to say (needs ≥ {g} comparisons per variant and a gap of ≥ {m} points)', caveat: 'The preference of one or a few people on the criterion above; not a measurement.', send: 'Send the result (envelope)', recv: 'Receive a result', reset: 'Start over', resetq: 'Delete the comparisons and variants?', close: 'Close', need: 'Write at least two variants.', none: 'Nothing to send yet.', edit: 'Change variants', imported: 'Result received: {n} votes', more: 'Continue' },
    fr: { open: 'A/B', title: 'Quelle variante est meilleure ?', q: 'Question / critère', qph: 'p. ex. laquelle est plus claire ?', vars: 'Variantes (une par ligne, 2–12)', fill: 'Reprendre de l’appli', start: 'Commencer la comparaison', pick: 'Laquelle est meilleure ?', a: 'A est meilleure', b: 'B est meilleure', tie: 'Égalité', skip: 'Passer', undo: 'Annuler le dernier vote', prog: '{n} votes', rank: 'Classement', col1: 'Variante', col2: 'Elo', col3: 'Victoires', col4: 'Défaites', col5: 'Égalités', verdict: 'Verdict', lead: '« {x} » mène (écart {d} points Elo)', nolead: 'Trop tôt pour conclure (≥ {g} comparaisons par variante et ≥ {m} points d’écart)', caveat: 'La préférence d’une ou de quelques personnes sur le critère ci-dessus ; pas une mesure.', send: 'Envoyer le résultat (enveloppe)', recv: 'Recevoir un résultat', reset: 'Recommencer', resetq: 'Supprimer les comparaisons et les variantes ?', close: 'Fermer', need: 'Écrivez au moins deux variantes.', none: 'Rien à envoyer pour l’instant.', edit: 'Changer les variantes', imported: 'Résultat reçu : {n} votes', more: 'Continuer' },
    it: { open: 'A/B', title: 'Quale variante è migliore?', q: 'Domanda / criterio', qph: 'es. quale è più chiara?', vars: 'Varianti (una per riga, 2–12)', fill: 'Prendi dall’app', start: 'Inizia il confronto', pick: 'Quale è migliore?', a: 'A è migliore', b: 'B è migliore', tie: 'Pari', skip: 'Salta', undo: 'Annulla l’ultimo voto', prog: '{n} voti', rank: 'Classifica', col1: 'Variante', col2: 'Elo', col3: 'Vittorie', col4: 'Sconfitte', col5: 'Pareggi', verdict: 'Verdetto', lead: '«{x}» è in testa (distacco {d} punti Elo)', nolead: 'Troppo presto per dirlo (≥ {g} confronti per variante e ≥ {m} punti di distacco)', caveat: 'La preferenza di una o poche persone sul criterio indicato; non è una misura.', send: 'Invia il risultato (busta)', recv: 'Ricevi un risultato', reset: 'Ricomincia', resetq: 'Eliminare i confronti e le varianti?', close: 'Chiudi', need: 'Scrivi almeno due varianti.', none: 'Ancora nulla da inviare.', edit: 'Cambia le varianti', imported: 'Risultato ricevuto: {n} voti', more: 'Continua' },
    es: { open: 'A/B', title: '¿Qué variante es mejor?', q: 'Pregunta / criterio', qph: 'p. ej. ¿cuál es más clara?', vars: 'Variantes (una por línea, 2–12)', fill: 'Tomar de la aplicación', start: 'Empezar la comparación', pick: '¿Cuál es mejor?', a: 'A es mejor', b: 'B es mejor', tie: 'Empate', skip: 'Saltar', undo: 'Deshacer el último voto', prog: '{n} votos', rank: 'Clasificación', col1: 'Variante', col2: 'Elo', col3: 'Victorias', col4: 'Derrotas', col5: 'Empates', verdict: 'Veredicto', lead: '«{x}» lidera (diferencia {d} puntos Elo)', nolead: 'Aún es pronto (≥ {g} comparaciones por variante y ≥ {m} puntos de diferencia)', caveat: 'La preferencia de una o pocas personas según el criterio indicado; no es una medición.', send: 'Enviar el resultado (sobre)', recv: 'Recibir un resultado', reset: 'Empezar de nuevo', resetq: '¿Borrar las comparaciones y las variantes?', close: 'Cerrar', need: 'Escribe al menos dos variantes.', none: 'Aún no hay nada que enviar.', edit: 'Cambiar las variantes', imported: 'Resultado recibido: {n} votos', more: 'Continuar' },
    pt: { open: 'A/B', title: 'Qual variante é melhor?', q: 'Pergunta / critério', qph: 'p. ex. qual é mais clara?', vars: 'Variantes (uma por linha, 2–12)', fill: 'Obter da aplicação', start: 'Começar a comparação', pick: 'Qual é melhor?', a: 'A é melhor', b: 'B é melhor', tie: 'Empate', skip: 'Saltar', undo: 'Anular o último voto', prog: '{n} votos', rank: 'Classificação', col1: 'Variante', col2: 'Elo', col3: 'Vitórias', col4: 'Derrotas', col5: 'Empates', verdict: 'Veredito', lead: '«{x}» lidera (diferença {d} pontos Elo)', nolead: 'Ainda é cedo (≥ {g} comparações por variante e ≥ {m} pontos de diferença)', caveat: 'A preferência de uma ou poucas pessoas segundo o critério indicado; não é uma medição.', send: 'Enviar o resultado (envelope)', recv: 'Receber um resultado', reset: 'Recomeçar', resetq: 'Apagar as comparações e as variantes?', close: 'Fechar', need: 'Escreva pelo menos duas variantes.', none: 'Ainda nada para enviar.', edit: 'Mudar as variantes', imported: 'Resultado recebido: {n} votos', more: 'Continuar' },
    de: { open: 'A/B', title: 'Welche Variante ist besser?', q: 'Frage / Kriterium', qph: 'z. B. welche ist klarer?', vars: 'Varianten (eine pro Zeile, 2–12)', fill: 'Aus der App übernehmen', start: 'Vergleich starten', pick: 'Welche ist besser?', a: 'A ist besser', b: 'B ist besser', tie: 'Unentschieden', skip: 'Überspringen', undo: 'Letzte Stimme zurücknehmen', prog: '{n} Stimmen', rank: 'Rangliste', col1: 'Variante', col2: 'Elo', col3: 'Siege', col4: 'Niederlagen', col5: 'Remis', verdict: 'Urteil', lead: '„{x}“ führt (Abstand {d} Elo-Punkte)', nolead: 'Noch zu früh (≥ {g} Vergleiche je Variante und ≥ {m} Punkte Abstand)', caveat: 'Die Präferenz einer oder weniger Personen zum oben genannten Kriterium; keine Messung.', send: 'Ergebnis senden (Umschlag)', recv: 'Ergebnis empfangen', reset: 'Von vorn beginnen', resetq: 'Vergleiche und Varianten löschen?', close: 'Schließen', need: 'Mindestens zwei Varianten eingeben.', none: 'Noch nichts zu senden.', edit: 'Varianten ändern', imported: 'Ergebnis empfangen: {n} Stimmen', more: 'Weiter' },
    hu: { open: 'A/B', title: 'Melyik változat jobb?', q: 'Kérdés / szempont', qph: 'pl. melyik érthetőbb?', vars: 'Változatok (soronként egy, 2–12)', fill: 'Átvétel az alkalmazásból', start: 'Összehasonlítás indítása', pick: 'Melyik a jobb?', a: 'Az A jobb', b: 'A B jobb', tie: 'Döntetlen', skip: 'Kihagyás', undo: 'Utolsó szavazat visszavonása', prog: '{n} szavazat', rank: 'Rangsor', col1: 'Változat', col2: 'Elo', col3: 'Győzelem', col4: 'Vereség', col5: 'Döntetlen', verdict: 'Ítélet', lead: '„{x}” vezet (különbség {d} Elo-pont)', nolead: 'Még korai (változatonként ≥ {g} összehasonlítás és ≥ {m} pont különbség kell)', caveat: 'Egy vagy néhány ember preferenciája a fenti szempont szerint; nem mérés.', send: 'Eredmény küldése (boríték)', recv: 'Eredmény fogadása', reset: 'Újrakezdés', resetq: 'Törli az összehasonlításokat és a változatokat?', close: 'Bezárás', need: 'Írj legalább két változatot.', none: 'Még nincs mit küldeni.', edit: 'Változatok módosítása', imported: 'Eredmény megérkezett: {n} szavazat', more: 'Tovább' }
  };
  function lang() { var l = ''; try { l = (root.document && root.document.documentElement.lang || '').slice(0, 2).toLowerCase(); } catch (e) { /* */ } return I18N[l] ? l : 'en'; }
  function tr(k, v) { var s = I18N[lang()][k] || I18N.en[k] || k; if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]); return s; }
  var str = function (x, n) { return String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); };

  /** Variante: listă de texte sau {id,label}; id stabil din poziție dacă lipsește; fără duplicate; 2–12. */
  function cleanVariants(list) {
    var out = [], seen = {};
    (Array.isArray(list) ? list : []).forEach(function (x) {
      var label = str(typeof x === 'string' ? x : x && x.label, LABEL_MAX); if (!label || seen[label.toLowerCase()]) return;
      seen[label.toLowerCase()] = 1; if (out.length < MAX_VARIANTS) out.push({ id: 'v' + (out.length + 1), label: label });
    });
    return out;
  }
  /** Stare: {v:1, q, variants:[{id,label}], rounds:[{a,b,w:'a'|'b'|'t'|'s'}]} — votul se referă la id-uri. Orice altceva e eliminat. */
  function cleanState(x) {
    var s = { v: 1, q: '', variants: [], rounds: [] }; if (!x || typeof x !== 'object') return s;
    s.q = str(x.q, Q_MAX);
    var seen = {}; (Array.isArray(x.variants) ? x.variants : []).forEach(function (v) {
      var id = str(v && v.id, 12), label = str(v && v.label, LABEL_MAX); if (!/^v\d{1,2}$/.test(id) || !label || seen[id] || s.variants.length >= MAX_VARIANTS) return; seen[id] = 1; s.variants.push({ id: id, label: label });
    });
    (Array.isArray(x.rounds) ? x.rounds : []).slice(0, MAX_ROUNDS).forEach(function (r) {
      if (r && seen[r.a] && seen[r.b] && r.a !== r.b && ['a', 'b', 't', 's'].indexOf(r.w) >= 0) s.rounds.push({ a: r.a, b: r.b, w: r.w });
    });
    return s;
  }
  /** Clasament: Elo secvențial (în ordinea voturilor), victorii/înfrângeri/egalități/comparații. Voturile „sar peste” nu contează. */
  function ranking(state) {
    var s = cleanState(state), m = {};
    s.variants.forEach(function (v) { m[v.id] = { id: v.id, label: v.label, elo: START, wins: 0, losses: 0, ties: 0, games: 0 }; });
    s.rounds.forEach(function (r) {
      if (r.w === 's') return;
      var A = m[r.a], B = m[r.b], ea = 1 / (1 + Math.pow(10, (B.elo - A.elo) / 400)), sa = r.w === 'a' ? 1 : r.w === 'b' ? 0 : 0.5;
      A.elo += K * (sa - ea); B.elo += K * ((1 - sa) - (1 - ea)); A.games++; B.games++;
      if (r.w === 'a') { A.wins++; B.losses++; } else if (r.w === 'b') { B.wins++; A.losses++; } else { A.ties++; B.ties++; }
    });
    return s.variants.map(function (v) { var o = m[v.id]; o.elo = Math.round(o.elo * 10) / 10; return o; }).sort(function (x, y) { return y.elo - x.elo || y.wins - x.wins || (x.id < y.id ? -1 : 1); });
  }
  /** Verdict prudent: {leader: id|null, gap, enough}. */
  function verdict(state) {
    var r = ranking(state); if (r.length < 2) return { leader: null, gap: 0, enough: false };
    var gap = Math.round((r[0].elo - r[1].elo) * 10) / 10, enough = r.every(function (x) { return x.games >= MIN_GAMES; }) && gap >= MIN_GAP;
    return { leader: enough ? r[0].id : null, gap: gap, enough: enough, top: r[0].id };
  }
  /** Perechea următoare: cea comparată cel mai rar (votul „sar peste” se numără ca vizită, ca să nu o repete); nu repetă imediat ultima pereche. */
  function nextPair(state) {
    var s = cleanState(state), v = s.variants; if (v.length < MIN_VARIANTS) return null;
    var cnt = {}, tot = {}, key = function (a, b) { return a < b ? a + '|' + b : b + '|' + a; };
    v.forEach(function (x) { tot[x.id] = 0; });
    s.rounds.forEach(function (r) { var k = key(r.a, r.b); cnt[k] = (cnt[k] || 0) + 1; tot[r.a]++; tot[r.b]++; });
    var last = s.rounds.length ? key(s.rounds[s.rounds.length - 1].a, s.rounds[s.rounds.length - 1].b) : '', best = null;
    for (var i = 0; i < v.length; i++) for (var j = i + 1; j < v.length; j++) {
      var k = key(v[i].id, v[j].id), score = [cnt[k] || 0, k === last && v.length > 2 ? 1 : 0, tot[v[i].id] + tot[v[j].id], i * 100 + j];
      if (!best || cmp(score, best.score) < 0) best = { score: score, a: v[i].id, b: v[j].id };
    }
    // ordinea A/B alternează ca să nu favorizeze poziția
    var flip = s.rounds.length % 2 === 1; return flip ? { a: best.b, b: best.a } : { a: best.a, b: best.b };
  }
  function cmp(x, y) { for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; }
  function vote(state, w) {
    var s = cleanState(state), p = nextPair(s); if (!p || ['a', 'b', 't', 's'].indexOf(w) < 0 || s.rounds.length >= MAX_ROUNDS) return s;
    s.rounds.push({ a: p.a, b: p.b, w: w }); return s;
  }
  function undo(state) { var s = cleanState(state); s.rounds.pop(); return s; }
  function csvCell(x) { x = String(x); return /[",\n\r;]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
  /** Tabelul clasamentului, ca CSV (îl deschide DataWeave fără altă logică). */
  function toCsv(state) {
    var rows = [['rank', 'variant', 'elo', 'wins', 'losses', 'ties', 'games']];
    ranking(state).forEach(function (r, i) { rows.push([i + 1, r.label, r.elo, r.wins, r.losses, r.ties, r.games]); });
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n') + '\n';
  }
  /** Payload `experiment/ab`: întrebarea, clasamentul, voturile (cu etichete), verdictul, metoda și avertismentul. */
  function payload(state, app) {
    var s = cleanState(state), r = ranking(s), v = verdict(s), lab = {}; s.variants.forEach(function (x) { lab[x.id] = x.label; });
    return { question: s.q, app: app || '', variants: r, rounds: s.rounds.map(function (x) { return { a: lab[x.a], b: lab[x.b], w: x.w === 'a' ? lab[x.a] : x.w === 'b' ? lab[x.b] : x.w === 't' ? 'tie' : 'skip' }; }),
      votes: s.rounds.filter(function (x) { return x.w !== 's'; }).length, verdict: { leader: v.leader ? lab[v.leader] : null, gap: v.gap, enough: v.enough, minGames: MIN_GAMES, minGap: MIN_GAP },
      method: 'Elo sequential, K=' + K + ', start ' + START + ', pairs by least-compared', caveat: tr('caveat'), csv: toCsv(s) };
  }
  function envelope(state, app, slug) {
    var E = root.FFF && root.FFF.envelope; if (!E) return null; var s = cleanState(state); if (s.variants.length < MIN_VARIANTS || !s.rounds.length) return null;
    return E.create({ type: 'experiment/ab', title: (app ? app + ' · ' : '') + 'A/B' + (s.q ? ' · ' + s.q.slice(0, 80) : ''), payload: payload(s, app), app: app || slug || 'FFF', source: { label: (app || slug || '') + ' · A/B' }, lang: root.document ? root.document.documentElement.lang : '' });
  }
  /** Din plic → stare (variantele cu id-uri noi; voturile în ordine). Folosit la „Primește rezultat”. */
  function fromEnvelope(env) {
    var p = env && env.payload; if (!p || typeof p !== 'object' || !Array.isArray(p.variants)) return null;
    var vs = cleanVariants(p.variants.map(function (x) { return x && x.label; })), id = {}; vs.forEach(function (v) { id[v.label] = v.id; });
    var s = { v: 1, q: str(p.question, Q_MAX), variants: vs, rounds: [] };
    (Array.isArray(p.rounds) ? p.rounds : []).forEach(function (r) {
      if (!r || !id[r.a] || !id[r.b]) return; var w = r.w === 'tie' ? 't' : r.w === 'skip' ? 's' : r.w === r.a ? 'a' : r.w === r.b ? 'b' : ''; if (w) s.rounds.push({ a: id[r.a], b: id[r.b], w: w });
    });
    return cleanState(s);
  }

  /* ---------- persistență locală (per aplicație) ---------- */
  function key(slug) { return 'fff.ab.' + slug; }
  function load(slug) { try { return cleanState(JSON.parse(root.localStorage.getItem(key(slug)))); } catch (e) { return cleanState(null); } }
  function save(slug, s) { try { root.localStorage.setItem(key(slug), JSON.stringify(cleanState(s))); return true; } catch (e) { return false; } }

  /* ---------- interfață ---------- */
  var CSS = '.fffab-fab{position:fixed;left:12px;bottom:12px;z-index:2147483001;min-height:44px;min-width:44px;padding:8px 14px;border:2px solid CanvasText;border-radius:22px;background:Canvas;color:CanvasText;font:600 14px system-ui;cursor:pointer;box-shadow:0 2px 8px #0003}' +
    '.fffab-box{position:fixed;left:12px;bottom:64px;z-index:2147483000;width:min(460px,calc(100vw - 24px));max-height:calc(100vh - 84px);overflow:auto;background:Canvas;color:CanvasText;border:2px solid CanvasText;border-radius:12px;padding:14px;font:14px/1.4 system-ui;box-shadow:0 6px 24px #0005}' +
    '.fffab-box h2,.fffab-box h3,.fffab-box label,.fffab-box p,.fffab-box small,.fffab-box li,.fffab-box strong,.fffab-box th,.fffab-box td,.fffab-box div{color:CanvasText}.fffab-box h2{font:700 16px system-ui;margin:0 0 8px}.fffab-box label{display:block;margin:8px 0 2px;font-weight:600}.fffab-box input,.fffab-box textarea{box-sizing:border-box;width:100%;font:inherit;padding:6px;color:CanvasText;background:Canvas;border:1px solid GrayText;border-radius:6px}' +
    '.fffab-box button{min-height:44px;min-width:44px;padding:6px 12px;margin:4px 6px 4px 0;font:inherit;color:CanvasText;background:Canvas;border:1px solid CanvasText;border-radius:8px;cursor:pointer}.fffab-box button.fffab-pri{background:CanvasText;color:Canvas}' +
    '.fffab-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fffab-pair button{min-height:96px;white-space:normal;text-align:left;font-weight:600}.fffab-box table{width:100%;border-collapse:collapse;margin:8px 0}.fffab-box th,.fffab-box td{border-bottom:1px solid GrayText;padding:4px 6px;text-align:left}' +
    '.fffab-row{display:flex;flex-wrap:wrap;gap:2px}.fffab-box small{opacity:.85}.fffab-box p{margin:6px 0}@media (max-width:420px){.fffab-pair{grid-template-columns:1fr}}';
  function el(tag, attrs, kids) {
    var d = root.document, n = d.createElement(tag); for (var k in (attrs || {})) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? d.createTextNode(c) : c); }); return n;
  }
  function css() { var d = root.document; if (d.getElementById('fffab-css')) return; var s = d.createElement('style'); s.id = 'fffab-css'; s.textContent = CSS; d.head.appendChild(s); }
  function toast(t) { var E = root.FFF && root.FFF.envelope; if (E && E.toast) E.toast(t); }

  /** Panou: o = {app, slug, getItems?: () => [texte | {label}]}. */
  function panel(o) {
    var d = root.document, E = root.FFF && root.FFF.envelope; css(); var old = d.getElementById('fffab-panel'); if (old) { old.remove(); return null; }
    var box = el('div', { 'class': 'fffab-box', role: 'dialog', 'aria-label': tr('title'), id: 'fffab-panel' }), st = load(o.slug), editing = st.variants.length < MIN_VARIANTS;
    function persist() { save(o.slug, st); }
    function closeBox() { box.remove(); var f = d.getElementById('fffabFab'); if (f) f.focus(); }
    function drawSetup() {
      box.textContent = ''; box.appendChild(el('h2', { text: tr('title') }));
      var q = el('input', { id: 'fffab-q', maxlength: String(Q_MAX), placeholder: tr('qph'), value: st.q }), ta = el('textarea', { id: 'fffab-vars', rows: '6', maxlength: '2400' });
      ta.value = st.variants.map(function (v) { return v.label; }).join('\n');
      var msg = el('p', { id: 'fffab-msg', role: 'status', 'aria-live': 'polite' });
      box.appendChild(el('label', { 'for': 'fffab-q', text: tr('q') })); box.appendChild(q); box.appendChild(el('label', { 'for': 'fffab-vars', text: tr('vars') })); box.appendChild(ta); box.appendChild(msg);
      var row = el('div', { 'class': 'fffab-row' });
      if (o.getItems) { var fb = el('button', { type: 'button', id: 'fffab-fill', text: tr('fill') }); fb.addEventListener('click', function () { var it = []; try { it = o.getItems() || []; } catch (e) { it = []; } var v = cleanVariants(it); ta.value = v.map(function (x) { return x.label; }).join('\n'); ta.focus(); }); row.appendChild(fb); }
      var go = el('button', { type: 'button', 'class': 'fffab-pri', id: 'fffab-start', text: tr('start') });
      go.addEventListener('click', function () {
        var vs = cleanVariants(ta.value.split(/\r?\n/)); if (vs.length < MIN_VARIANTS) { msg.textContent = tr('need'); ta.focus(); return; }
        var same = JSON.stringify(vs.map(function (x) { return x.label; })) === JSON.stringify(st.variants.map(function (x) { return x.label; }));
        st = { v: 1, q: str(q.value, Q_MAX), variants: vs, rounds: same ? st.rounds : [] }; persist(); editing = false; drawVote();
      });
      var cl = el('button', { type: 'button', id: 'fffab-close', text: tr('close') }); cl.addEventListener('click', closeBox); row.appendChild(go); row.appendChild(cl); box.appendChild(row);
      if (E) { var rb = E.importButton({ accepts: ['experiment/ab'], text: tr('recv'), onReceive: function (env) { var s2 = fromEnvelope(env); if (!s2) throw 0; st = s2; persist(); editing = false; drawVote(); toast(tr('imported', { n: s2.rounds.length })); } }); rb.id = 'fffab-recv'; box.appendChild(el('div', { 'class': 'fffab-row' }, [rb])); }
      q.focus();
    }
    function drawVote() {
      box.textContent = ''; box.appendChild(el('h2', { text: tr('title') }));
      if (st.q) box.appendChild(el('p', { text: st.q, id: 'fffab-qshow' }));
      var p = nextPair(st), lab = {}; st.variants.forEach(function (v) { lab[v.id] = v.label; });
      if (p) {
        box.appendChild(el('p', { id: 'fffab-pick', text: tr('pick') + ' · ' + tr('prog', { n: st.rounds.filter(function (r) { return r.w !== 's'; }).length }) }));
        var pair = el('div', { 'class': 'fffab-pair', role: 'group', 'aria-labelledby': 'fffab-pick' }), ba = el('button', { type: 'button', id: 'fffab-a', 'aria-label': tr('a') + ': ' + lab[p.a] }, [el('small', { text: 'A' }), el('br'), lab[p.a]]), bb = el('button', { type: 'button', id: 'fffab-b', 'aria-label': tr('b') + ': ' + lab[p.b] }, [el('small', { text: 'B' }), el('br'), lab[p.b]]);
        pair.appendChild(ba); pair.appendChild(bb); box.appendChild(pair);
        [[ba, 'a'], [bb, 'b']].forEach(function (x) { x[0].addEventListener('click', function () { st = vote(st, x[1]); persist(); drawVote(); var n = d.getElementById('fffab-a'); if (n) n.focus(); }); });
        var row = el('div', { 'class': 'fffab-row' });
        [['t', 'tie', 'fffab-tie'], ['s', 'skip', 'fffab-skip']].forEach(function (x) { var b = el('button', { type: 'button', id: x[2], text: tr(x[1]) }); b.addEventListener('click', function () { st = vote(st, x[0]); persist(); drawVote(); var n = d.getElementById('fffab-a'); if (n) n.focus(); }); row.appendChild(b); });
        box.appendChild(row);
      }
      var r = ranking(st), v = verdict(st);
      box.appendChild(el('h3', { text: tr('rank'), style: 'font:700 14px system-ui;margin:10px 0 0' }));
      var tb = el('table', { id: 'fffab-table' }), hd = el('tr', {}, ['col1', 'col2', 'col3', 'col4', 'col5'].map(function (c) { return el('th', { scope: 'col', text: tr(c) }); })); tb.appendChild(el('thead', {}, [hd]));
      var tbody = el('tbody'); r.forEach(function (x) { tbody.appendChild(el('tr', {}, [el('td', { text: x.label }), el('td', { text: String(Math.round(x.elo)) }), el('td', { text: String(x.wins) }), el('td', { text: String(x.losses) }), el('td', { text: String(x.ties) })])); }); tb.appendChild(tbody); box.appendChild(tb);
      box.appendChild(el('p', { id: 'fffab-verdict', text: tr('verdict') + ': ' + (v.leader ? tr('lead', { x: lab[v.leader], d: Math.round(v.gap) }) : tr('nolead', { g: MIN_GAMES, m: MIN_GAP })) }));
      box.appendChild(el('p', {}, [el('small', { text: tr('caveat') })]));
      var bar = el('div', { 'class': 'fffab-row' });
      if (E) { var sb = E.sendButton({ slug: o.slug, text: tr('send'), getEnv: function () { var e = envelope(st, o.app, o.slug); if (!e) { toast(tr('none')); return null; } return e; } }); sb.id = 'fffab-send'; bar.appendChild(sb); }
      var ub = el('button', { type: 'button', id: 'fffab-undo', text: tr('undo') }); ub.addEventListener('click', function () { st = undo(st); persist(); drawVote(); });
      var eb = el('button', { type: 'button', id: 'fffab-edit', text: tr('edit') }); eb.addEventListener('click', function () { drawSetup(); });
      var rs = el('button', { type: 'button', id: 'fffab-reset', text: tr('reset') }); rs.addEventListener('click', function () { if (root.confirm(tr('resetq'))) { st = cleanState(null); persist(); drawSetup(); } });
      var cl = el('button', { type: 'button', id: 'fffab-close2', text: tr('close') }); cl.addEventListener('click', closeBox);
      [ub, eb, rs, cl].forEach(function (b) { bar.appendChild(b); }); box.appendChild(bar);
    }
    box.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeBox(); });
    if (editing) drawSetup(); else drawVote();
    d.body.appendChild(box); var f = box.querySelector('input,button'); if (f) f.focus(); return box;
  }
  /** Montează butonul „A/B”. o = {app, slug, getItems?, host?, className?}. */
  function mount(o) {
    var d = root.document; if (!d || !d.body || d.getElementById('fffabFab')) return null; css();
    var fab = el('button', { type: 'button', id: 'fffabFab', 'class': o.host ? (o.className || '') : 'fffab-fab', text: tr('open'), 'aria-haspopup': 'dialog', 'aria-label': tr('title') });
    fab.addEventListener('click', function () { panel(o); }); (o.host || d.body).appendChild(fab); return fab;
  }
  return { VERSION: 1, K: K, START: START, MIN_GAMES: MIN_GAMES, MIN_GAP: MIN_GAP, I18N: I18N, tr: tr, cleanVariants: cleanVariants, cleanState: cleanState, ranking: ranking, verdict: verdict, nextPair: nextPair, vote: vote, undo: undo,
    toCsv: toCsv, payload: payload, envelope: envelope, fromEnvelope: fromEnvelope, load: load, save: save, panel: panel, mount: mount };
});
