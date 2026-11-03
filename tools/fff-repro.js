/* fff-repro · Laborator de reproducere FFF — re-rulează o afirmație numerică pe datele atașate (CSV) și o marchează reprodusă / nereprodusă; rezultatul merge în plicul `claim/repro`.
 * Sursa canonică e ACEST fișier (tools/fff-repro.js); aplicațiile îl primesc prin `node tools/inject-shared.mjs`, nu prin copiere de mână.
 * Ce face: citește un CSV (virgulă, punct și virgulă sau tab; zecimale cu virgulă sau punct), calculează medie / sumă / număr / minim / maxim / mediană / pondere
 * (opțional cu un filtru pe o coloană) și compară cu cifra afirmată: „reprodusă” dacă rotunjită la precizia cifrei afirmate dă același număr sau dacă diferența
 * relativă e în toleranță (implicit 0,5 %). Plicul poartă datele (dacă ≤ 200 KB), amprenta lor SHA-256 și specificația, așa că oricine le poate re-rula.
 * Ce NU face: nu verifică proveniența datelor, doar aritmetica afirmației din ele; „reprodusă” ≠ „adevărată”. Fără rețea. */
(function (root, factory) {
  var S = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = S;
  if (root) { try { var F = root.FFF || {}; root.FFF = F; if (root.FFF === F) F.repro = S; } catch (e) { /* inert */ } }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var FNS = ['mean', 'sum', 'count', 'min', 'max', 'median', 'share'], OPS = ['=', '!=', '>', '<', '>=', '<=', 'contains'], MAX_CSV = 200000, MAX_ROWS = 100000, TOL = 0.5;
  var I18N = {
    ro: { open: 'Reproducere', title: 'Laborator de reproducere', claim: 'Afirmația (ce se susține)', value: 'Cifra afirmată', fn: 'Calcul', col: 'Coloana', where: 'Filtru (opțional): coloană, operator, valoare', tol: 'Toleranță (%)', ind: 'Indicator (pentru AGORA)', cty: 'Stat / cod (pentru AGORA)', data: 'Datele (CSV, lipite aici)', load: 'Încarcă un fișier CSV', useTable: 'Folosește tabelul din aplicație', run: 'Re-rulează', result: 'Rezultat', rep: 'REPRODUSĂ: datele atașate dau {r} (afirmat {c})', not: 'NEREPRODUSĂ: datele atașate dau {r}, nu {c}', inc: 'NECONCLUDENT: {w}', caveat: 'Verifică aritmetica afirmației din aceste date, nu proveniența lor; „reprodusă” nu înseamnă „adevărată”.', send: 'Trimite (plic)', recv: 'Primește o afirmație', close: 'Închide', rerun: 'Re-rulat din plic: {s}', same: 'rezultat identic', diff: 'rezultat DIFERIT față de plic ({a} → {b})', nodata: 'Lipsesc datele.', nocol: 'Coloana „{c}” nu există (disponibile: {l}).', nonum: 'Coloana nu are valori numerice.', badval: 'Cifra afirmată nu e un număr.', big: 'Datele sunt prea mari (maxim {n} rânduri).', none: 'Nu e nimic de trimis: rulează întâi calculul.', empty: 'Filtrul nu lasă niciun rând.', cols: 'Coloane: {l}', fns: { mean: 'media', sum: 'suma', count: 'numărul de rânduri', min: 'minimul', max: 'maximul', median: 'mediana', share: 'ponderea (%) din total' } },
    en: { open: 'Reproduce', title: 'Reproduction lab', claim: 'The claim (what is asserted)', value: 'Claimed figure', fn: 'Calculation', col: 'Column', where: 'Filter (optional): column, operator, value', tol: 'Tolerance (%)', ind: 'Indicator (for AGORA)', cty: 'Country / code (for AGORA)', data: 'The data (CSV, pasted here)', load: 'Load a CSV file', useTable: 'Use the table from the app', run: 'Re-run', result: 'Result', rep: 'REPRODUCED: the attached data give {r} (claimed {c})', not: 'NOT REPRODUCED: the attached data give {r}, not {c}', inc: 'INCONCLUSIVE: {w}', caveat: 'Checks the arithmetic of the claim from this data, not where the data came from; “reproduced” does not mean “true”.', send: 'Send (envelope)', recv: 'Receive a claim', close: 'Close', rerun: 'Re-run from the envelope: {s}', same: 'same result', diff: 'DIFFERENT result from the envelope ({a} → {b})', nodata: 'No data.', nocol: 'Column “{c}” does not exist (available: {l}).', nonum: 'The column has no numeric values.', badval: 'The claimed figure is not a number.', big: 'The data is too large (at most {n} rows).', none: 'Nothing to send: run the calculation first.', empty: 'The filter leaves no rows.', cols: 'Columns: {l}', fns: { mean: 'the mean', sum: 'the sum', count: 'the row count', min: 'the minimum', max: 'the maximum', median: 'the median', share: 'the share (%) of the total' } },
    fr: { open: 'Reproduire', title: 'Laboratoire de reproduction', claim: 'L’affirmation', value: 'Chiffre affirmé', fn: 'Calcul', col: 'Colonne', where: 'Filtre (facultatif) : colonne, opérateur, valeur', tol: 'Tolérance (%)', ind: 'Indicateur (pour AGORA)', cty: 'Pays / code (pour AGORA)', data: 'Les données (CSV, collées ici)', load: 'Charger un fichier CSV', useTable: 'Utiliser le tableau de l’appli', run: 'Relancer', result: 'Résultat', rep: 'REPRODUIT : les données jointes donnent {r} (affirmé {c})', not: 'NON REPRODUIT : les données jointes donnent {r}, pas {c}', inc: 'NON CONCLUANT : {w}', caveat: 'Vérifie l’arithmétique de l’affirmation à partir de ces données, pas leur origine ; « reproduit » ne veut pas dire « vrai ».', send: 'Envoyer (enveloppe)', recv: 'Recevoir une affirmation', close: 'Fermer', rerun: 'Relancé depuis l’enveloppe : {s}', same: 'même résultat', diff: 'résultat DIFFÉRENT de l’enveloppe ({a} → {b})', nodata: 'Pas de données.', nocol: 'La colonne « {c} » n’existe pas (disponibles : {l}).', nonum: 'La colonne n’a pas de valeurs numériques.', badval: 'Le chiffre affirmé n’est pas un nombre.', big: 'Données trop volumineuses (maximum {n} lignes).', none: 'Rien à envoyer : lancez d’abord le calcul.', empty: 'Le filtre ne laisse aucune ligne.', cols: 'Colonnes : {l}', fns: { mean: 'la moyenne', sum: 'la somme', count: 'le nombre de lignes', min: 'le minimum', max: 'le maximum', median: 'la médiane', share: 'la part (%) du total' } },
    it: { open: 'Riprodurre', title: 'Laboratorio di riproduzione', claim: 'L’affermazione', value: 'Cifra affermata', fn: 'Calcolo', col: 'Colonna', where: 'Filtro (facoltativo): colonna, operatore, valore', tol: 'Tolleranza (%)', ind: 'Indicatore (per AGORA)', cty: 'Paese / codice (per AGORA)', data: 'I dati (CSV, incollati qui)', load: 'Carica un file CSV', useTable: 'Usa la tabella dell’app', run: 'Riesegui', result: 'Risultato', rep: 'RIPRODOTTA: i dati allegati danno {r} (affermato {c})', not: 'NON RIPRODOTTA: i dati allegati danno {r}, non {c}', inc: 'NON CONCLUSIVO: {w}', caveat: 'Verifica l’aritmetica dell’affermazione da questi dati, non la loro provenienza; «riprodotta» non significa «vera».', send: 'Invia (busta)', recv: 'Ricevi un’affermazione', close: 'Chiudi', rerun: 'Rieseguito dalla busta: {s}', same: 'stesso risultato', diff: 'risultato DIVERSO dalla busta ({a} → {b})', nodata: 'Nessun dato.', nocol: 'La colonna «{c}» non esiste (disponibili: {l}).', nonum: 'La colonna non ha valori numerici.', badval: 'La cifra affermata non è un numero.', big: 'Dati troppo grandi (massimo {n} righe).', none: 'Niente da inviare: esegui prima il calcolo.', empty: 'Il filtro non lascia nessuna riga.', cols: 'Colonne: {l}', fns: { mean: 'la media', sum: 'la somma', count: 'il numero di righe', min: 'il minimo', max: 'il massimo', median: 'la mediana', share: 'la quota (%) sul totale' } },
    es: { open: 'Reproducir', title: 'Laboratorio de reproducción', claim: 'La afirmación', value: 'Cifra afirmada', fn: 'Cálculo', col: 'Columna', where: 'Filtro (opcional): columna, operador, valor', tol: 'Tolerancia (%)', ind: 'Indicador (para AGORA)', cty: 'País / código (para AGORA)', data: 'Los datos (CSV, pegados aquí)', load: 'Cargar un archivo CSV', useTable: 'Usar la tabla de la aplicación', run: 'Volver a ejecutar', result: 'Resultado', rep: 'REPRODUCIDA: los datos adjuntos dan {r} (afirmado {c})', not: 'NO REPRODUCIDA: los datos adjuntos dan {r}, no {c}', inc: 'NO CONCLUYENTE: {w}', caveat: 'Comprueba la aritmética de la afirmación con estos datos, no su procedencia; «reproducida» no significa «verdadera».', send: 'Enviar (sobre)', recv: 'Recibir una afirmación', close: 'Cerrar', rerun: 'Reejecutado desde el sobre: {s}', same: 'mismo resultado', diff: 'resultado DISTINTO del sobre ({a} → {b})', nodata: 'Sin datos.', nocol: 'La columna «{c}» no existe (disponibles: {l}).', nonum: 'La columna no tiene valores numéricos.', badval: 'La cifra afirmada no es un número.', big: 'Datos demasiado grandes (máximo {n} filas).', none: 'Nada que enviar: ejecuta primero el cálculo.', empty: 'El filtro no deja ninguna fila.', cols: 'Columnas: {l}', fns: { mean: 'la media', sum: 'la suma', count: 'el número de filas', min: 'el mínimo', max: 'el máximo', median: 'la mediana', share: 'la proporción (%) del total' } },
    pt: { open: 'Reproduzir', title: 'Laboratório de reprodução', claim: 'A afirmação', value: 'Número afirmado', fn: 'Cálculo', col: 'Coluna', where: 'Filtro (opcional): coluna, operador, valor', tol: 'Tolerância (%)', ind: 'Indicador (para o AGORA)', cty: 'País / código (para o AGORA)', data: 'Os dados (CSV, colados aqui)', load: 'Carregar um ficheiro CSV', useTable: 'Usar a tabela da aplicação', run: 'Executar de novo', result: 'Resultado', rep: 'REPRODUZIDA: os dados anexos dão {r} (afirmado {c})', not: 'NÃO REPRODUZIDA: os dados anexos dão {r}, não {c}', inc: 'INCONCLUSIVO: {w}', caveat: 'Verifica a aritmética da afirmação com estes dados, não a sua origem; «reproduzida» não significa «verdadeira».', send: 'Enviar (envelope)', recv: 'Receber uma afirmação', close: 'Fechar', rerun: 'Reexecutado a partir do envelope: {s}', same: 'mesmo resultado', diff: 'resultado DIFERENTE do envelope ({a} → {b})', nodata: 'Sem dados.', nocol: 'A coluna «{c}» não existe (disponíveis: {l}).', nonum: 'A coluna não tem valores numéricos.', badval: 'O número afirmado não é um número.', big: 'Dados demasiado grandes (máximo {n} linhas).', none: 'Nada para enviar: execute primeiro o cálculo.', empty: 'O filtro não deixa nenhuma linha.', cols: 'Colunas: {l}', fns: { mean: 'a média', sum: 'a soma', count: 'o número de linhas', min: 'o mínimo', max: 'o máximo', median: 'a mediana', share: 'a proporção (%) do total' } },
    de: { open: 'Reproduzieren', title: 'Reproduktionslabor', claim: 'Die Aussage', value: 'Behauptete Zahl', fn: 'Berechnung', col: 'Spalte', where: 'Filter (optional): Spalte, Operator, Wert', tol: 'Toleranz (%)', ind: 'Indikator (für AGORA)', cty: 'Land / Code (für AGORA)', data: 'Die Daten (CSV, hier eingefügt)', load: 'CSV-Datei laden', useTable: 'Tabelle der App verwenden', run: 'Erneut ausführen', result: 'Ergebnis', rep: 'REPRODUZIERT: die angehängten Daten ergeben {r} (behauptet {c})', not: 'NICHT REPRODUZIERT: die angehängten Daten ergeben {r}, nicht {c}', inc: 'NICHT ENTSCHEIDBAR: {w}', caveat: 'Prüft die Rechnung der Aussage mit diesen Daten, nicht deren Herkunft; „reproduziert“ heißt nicht „wahr“.', send: 'Senden (Umschlag)', recv: 'Aussage empfangen', close: 'Schließen', rerun: 'Aus dem Umschlag neu berechnet: {s}', same: 'gleiches Ergebnis', diff: 'ABWEICHENDES Ergebnis gegenüber dem Umschlag ({a} → {b})', nodata: 'Keine Daten.', nocol: 'Spalte „{c}“ existiert nicht (vorhanden: {l}).', nonum: 'Die Spalte hat keine numerischen Werte.', badval: 'Die behauptete Zahl ist keine Zahl.', big: 'Daten zu groß (höchstens {n} Zeilen).', none: 'Nichts zu senden: zuerst rechnen.', empty: 'Der Filter lässt keine Zeile übrig.', cols: 'Spalten: {l}', fns: { mean: 'der Mittelwert', sum: 'die Summe', count: 'die Zeilenzahl', min: 'das Minimum', max: 'das Maximum', median: 'der Median', share: 'der Anteil (%) an der Summe' } },
    hu: { open: 'Reprodukálás', title: 'Reprodukciós labor', claim: 'Az állítás', value: 'Állított szám', fn: 'Számítás', col: 'Oszlop', where: 'Szűrő (nem kötelező): oszlop, művelet, érték', tol: 'Tűrés (%)', ind: 'Mutató (az AGORA-hoz)', cty: 'Ország / kód (az AGORA-hoz)', data: 'Az adatok (CSV, ide beillesztve)', load: 'CSV-fájl betöltése', useTable: 'Az alkalmazás táblázatának használata', run: 'Újrafuttatás', result: 'Eredmény', rep: 'REPRODUKÁLVA: a csatolt adatok szerint {r} (állítva {c})', not: 'NEM REPRODUKÁLHATÓ: a csatolt adatok szerint {r}, nem {c}', inc: 'NEM ELDÖNTHETŐ: {w}', caveat: 'Az állítás számítását ellenőrzi ezekből az adatokból, nem az adatok eredetét; a „reprodukálva” nem jelent „igazat”.', send: 'Küldés (boríték)', recv: 'Állítás fogadása', close: 'Bezárás', rerun: 'Borítékból újrafuttatva: {s}', same: 'ugyanaz az eredmény', diff: 'a borítékétól ELTÉRŐ eredmény ({a} → {b})', nodata: 'Nincs adat.', nocol: 'A(z) „{c}” oszlop nem létezik (elérhető: {l}).', nonum: 'Az oszlopban nincs számérték.', badval: 'Az állított szám nem szám.', big: 'Túl sok adat (legfeljebb {n} sor).', none: 'Nincs mit küldeni: előbb futtasd a számítást.', empty: 'A szűrő nem hagy egy sort sem.', cols: 'Oszlopok: {l}', fns: { mean: 'az átlag', sum: 'az összeg', count: 'a sorok száma', min: 'a minimum', max: 'a maximum', median: 'a medián', share: 'az arány (%) az összegből' } }
  };
  function lang() { var l = ''; try { l = (root.document && root.document.documentElement.lang || '').slice(0, 2).toLowerCase(); } catch (e) { /* */ } return I18N[l] ? l : 'en'; }
  function tr(k, v) { var s = I18N[lang()][k]; if (typeof s !== 'string') s = I18N.en[k]; if (typeof s !== 'string') return k; if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]); return s; }
  var str = function (x, n) { return String(x == null ? '' : x).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, ' ').trim().slice(0, n); };

  /* ---------- CSV ---------- */
  function parseCsv(text) {
    text = String(text == null ? '' : text).replace(/^﻿/, ''); var first = text.split(/\r?\n/)[0] || '', sep = ',';
    var best = 0; [',', ';', '\t'].forEach(function (c) { var n = first.split(c).length - 1; if (n > best) { best = n; sep = c; } });
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"' && cell === '') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; if (rows.length > MAX_ROWS + 1) break; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    var head = (rows.shift() || []).map(function (h) { return str(h, 80); });
    return { head: head, rows: rows, sep: sep };
  }
  /** 1.234,5 / 1,234.5 / 12,5 / 12.5 / 12 % / 1 234 → număr; altfel NaN. */
  function num(x) {
    var s = String(x == null ? '' : x).replace(/[\s %€$£]/g, ''); if (!/^[-+]?[\d.,]+$/.test(s)) return NaN;
    var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc >= 0 && ld >= 0) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (lc >= 0) s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
    else if (ld >= 0 && s.split('.').length > 2) s = s.replace(/\./g, '');
    var v = parseFloat(s); return isFinite(v) ? v : NaN;
  }
  function colIndex(t, c) {
    var h = t.head.map(function (x) { return x.toLowerCase(); }), k = String(c == null ? '' : c).trim().toLowerCase();
    var i = h.indexOf(k); if (i < 0 && /^\d+$/.test(k) && +k >= 1 && +k <= h.length) i = +k - 1; return i;
  }
  function matches(cell, op, val) {
    var a = num(cell), b = num(val), numeric = !isNaN(a) && !isNaN(b);
    switch (op) {
      case '=': return numeric ? a === b : String(cell).trim().toLowerCase() === String(val).trim().toLowerCase();
      case '!=': return numeric ? a !== b : String(cell).trim().toLowerCase() !== String(val).trim().toLowerCase();
      case '>': return numeric && a > b; case '<': return numeric && a < b; case '>=': return numeric && a >= b; case '<=': return numeric && a <= b;
      case 'contains': return String(cell).toLowerCase().indexOf(String(val).toLowerCase()) >= 0;
    } return false;
  }
  /** spec = {fn, col, where?: {col, op, val}} → {ok, value, n} | {ok:false, err, ...}. Nu aruncă. */
  function compute(table, spec) {
    if (!table || !table.rows || !table.rows.length) return { ok: false, err: 'nodata' };
    if (table.rows.length > MAX_ROWS) return { ok: false, err: 'big' };
    if (FNS.indexOf(spec && spec.fn) < 0) return { ok: false, err: 'nodata' };
    var ci = spec.fn === 'count' && !str(spec.col, 80) ? -2 : colIndex(table, spec.col);
    if (ci === -1) return { ok: false, err: 'nocol', col: str(spec.col, 80), cols: table.head.join(', ') };
    var rows = table.rows;
    if (spec.where && str(spec.where.col, 80)) {
      var wi = colIndex(table, spec.where.col); if (wi < 0) return { ok: false, err: 'nocol', col: str(spec.where.col, 80), cols: table.head.join(', ') };
      if (OPS.indexOf(spec.where.op) < 0) return { ok: false, err: 'nodata' };
      rows = rows.filter(function (r) { return matches(r[wi], spec.where.op, spec.where.val); }); if (!rows.length) return { ok: false, err: 'empty' };
    }
    if (spec.fn === 'count') return { ok: true, value: ci === -2 ? rows.length : rows.filter(function (r) { return String(r[ci] == null ? '' : r[ci]).trim() !== ''; }).length, n: rows.length };
    var v = rows.map(function (r) { return num(r[ci]); }).filter(function (x) { return !isNaN(x); }); if (!v.length) return { ok: false, err: 'nonum' };
    var sum = v.reduce(function (a, b) { return a + b; }, 0), out;
    if (spec.fn === 'mean') out = sum / v.length; else if (spec.fn === 'sum') out = sum; else if (spec.fn === 'min') out = Math.min.apply(null, v); else if (spec.fn === 'max') out = Math.max.apply(null, v);
    else if (spec.fn === 'median') { var s = v.slice().sort(function (a, b) { return a - b; }), m = s.length >> 1; out = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
    else { var tot = table.rows.map(function (r) { return num(r[ci]); }).filter(function (x) { return !isNaN(x); }).reduce(function (a, b) { return a + b; }, 0); if (!tot) return { ok: false, err: 'nonum' }; out = sum / tot * 100; }
    return { ok: true, value: out, n: v.length };
  }
  function decimals(x) { var s = String(x).replace(/[\s%]/g, ''); var m = s.match(/[.,](\d+)$/); return m ? m[1].length : 0; }
  /** Verdict: reproduced | not-reproduced. Rotunjit la precizia cifrei afirmate sau în toleranța relativă (procente). */
  function judge(claimed, result, tolPct) {
    var c = typeof claimed === 'number' ? claimed : num(claimed); if (isNaN(c) || !isFinite(result)) return 'inconclusive';
    var d = typeof claimed === 'number' ? Math.min(6, (String(claimed).split('.')[1] || '').length) : decimals(claimed), p = Math.pow(10, d), tol = Math.max(0, +tolPct || 0) / 100;
    if (Math.round(result * p) / p === Math.round(c * p) / p) return 'reproduced';
    var base = Math.abs(c) > 1e-12 ? Math.abs(c) : 1; return Math.abs(result - c) <= tol * base ? 'reproduced' : 'not-reproduced';
  }
  function sha256(text) {
    var sub = root.crypto && root.crypto.subtle; if (!sub) return Promise.resolve('');
    return sub.digest('SHA-256', new TextEncoder().encode(String(text))).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); });
  }
  /** Rulează o afirmație: q = {claim, value, spec, tol, csv, dataName, subject?:{indicator,country}} → Promise<payload>. */
  function run(q) {
    var csv = String(q && q.csv || ''), t = parseCsv(csv), c = compute(t, q && q.spec);
    return sha256(csv).then(function (h) {
      var cl = typeof q.value === 'number' ? q.value : num(q.value), p = { claim: str(q.claim, 400), value: isNaN(cl) ? null : cl, valueText: str(q.value, 40), spec: { fn: q.spec && q.spec.fn, col: str(q.spec && q.spec.col, 80) }, tol: +q.tol >= 0 ? +q.tol : TOL,
        data: { name: str(q.dataName, 120), sha256: h, rows: t.rows.length, cols: t.head }, at: new Date().toISOString(), tool: (q.app || '') };
      if (q.spec && q.spec.where && str(q.spec.where.col, 80)) p.spec.where = { col: str(q.spec.where.col, 80), op: q.spec.where.op, val: str(q.spec.where.val, 80) };
      if (q.subject && (str(q.subject.indicator, 80) || str(q.subject.country, 40))) p.subject = { indicator: str(q.subject.indicator, 80), country: str(q.subject.country, 40) };
      if (csv.length <= MAX_CSV) p.data.csv = csv;
      if (!c.ok) { p.verdict = 'inconclusive'; p.why = c.err + (c.col ? ':' + c.col : ''); p.result = null; return p; }
      p.result = Math.round(c.value * 1e9) / 1e9; p.n = c.n; p.verdict = isNaN(cl) ? 'inconclusive' : judge(q.value, c.value, p.tol); if (isNaN(cl)) p.why = 'badval'; return p;
    });
  }
  /** Re-rulează un payload primit (cu datele atașate) și spune dacă rezultatul s-a schimbat. */
  function rerun(p) {
    if (!p || !p.data || typeof p.data.csv !== 'string') return Promise.resolve({ ok: false, err: 'nodata' });
    return run({ claim: p.claim, value: p.valueText || p.value, spec: p.spec, tol: p.tol, csv: p.data.csv, dataName: p.data.name, subject: p.subject, app: p.tool }).then(function (n) {
      return { ok: true, payload: n, same: n.result === p.result && n.verdict === p.verdict, before: p.result, after: n.result };
    });
  }
  function envelope(p, app, slug) {
    var E = root.FFF && root.FFF.envelope; if (!E || !p || p.result == null) return null;
    return E.create({ type: 'claim/repro', title: (app ? app + ' · ' : '') + (p.claim || 'claim').slice(0, 80), payload: p, app: app || slug || 'FFF', source: { label: (app || slug || '') + ' · ' + (p.data && p.data.name || 'data'), id: p.data && p.data.sha256 ? 'sha256:' + p.data.sha256 : undefined }, lang: root.document ? root.document.documentElement.lang : '' });
  }
  /** Păstrează doar câmpurile cunoscute dintr-un payload primit (nu are încredere în rest). */
  function cleanPayload(p) {
    if (!p || typeof p !== 'object' || ['reproduced', 'not-reproduced', 'inconclusive'].indexOf(p.verdict) < 0) return null;
    var o = { claim: str(p.claim, 400), value: typeof p.value === 'number' && isFinite(p.value) ? p.value : null, valueText: str(p.valueText, 40), result: typeof p.result === 'number' && isFinite(p.result) ? p.result : null, verdict: p.verdict,
      tol: +p.tol >= 0 ? +p.tol : TOL, at: str(p.at, 40), tool: str(p.tool, 40), spec: { fn: FNS.indexOf(p.spec && p.spec.fn) >= 0 ? p.spec.fn : '', col: str(p.spec && p.spec.col, 80) }, data: { name: str(p.data && p.data.name, 120), sha256: /^[0-9a-f]{64}$/.test(p.data && p.data.sha256) ? p.data.sha256 : '', rows: +(p.data && p.data.rows) || 0, cols: Array.isArray(p.data && p.data.cols) ? p.data.cols.slice(0, 200).map(function (x) { return str(x, 80); }) : [] } };
    if (p.data && typeof p.data.csv === 'string' && p.data.csv.length <= MAX_CSV) o.data.csv = p.data.csv;
    if (p.spec && p.spec.where && OPS.indexOf(p.spec.where.op) >= 0) o.spec.where = { col: str(p.spec.where.col, 80), op: p.spec.where.op, val: str(p.spec.where.val, 80) };
    if (p.subject) o.subject = { indicator: str(p.subject.indicator, 80), country: str(p.subject.country, 40) };
    if (p.why) o.why = str(p.why, 120); return o;
  }

  /* ---------- interfață ---------- */
  var CSS = '.fffr-fab{position:fixed;left:12px;bottom:12px;z-index:2147483001;min-height:44px;min-width:44px;padding:8px 14px;border:2px solid CanvasText;border-radius:22px;background:Canvas;color:CanvasText;font:600 14px system-ui;cursor:pointer;box-shadow:0 2px 8px #0003}' +
    '.fffr-box{position:fixed;left:12px;bottom:64px;z-index:2147483000;width:min(500px,calc(100vw - 24px));max-height:calc(100vh - 84px);overflow:auto;background:Canvas;color:CanvasText;border:2px solid CanvasText;border-radius:12px;padding:14px;font:14px/1.4 system-ui;box-shadow:0 6px 24px #0005}' +
    '.fffr-box h2,.fffr-box h3,.fffr-box label,.fffr-box p,.fffr-box small,.fffr-box li,.fffr-box strong,.fffr-box th,.fffr-box td,.fffr-box div{color:CanvasText}.fffr-box h2{font:700 16px system-ui;margin:0 0 8px}.fffr-box label{display:block;margin:8px 0 2px;font-weight:600}.fffr-box input,.fffr-box select,.fffr-box textarea{box-sizing:border-box;width:100%;font:inherit;padding:6px;color:CanvasText;background:Canvas;border:1px solid GrayText;border-radius:6px}' +
    '.fffr-box button{min-height:44px;min-width:44px;padding:6px 12px;margin:4px 6px 4px 0;font:inherit;color:CanvasText;background:Canvas;border:1px solid CanvasText;border-radius:8px;cursor:pointer}.fffr-box button.fffr-pri{background:CanvasText;color:Canvas}' +
    '.fffr-row{display:flex;flex-wrap:wrap;gap:2px}.fffr-3{display:grid;grid-template-columns:2fr 1fr 2fr;gap:6px}.fffr-2{display:grid;grid-template-columns:1fr 1fr;gap:6px}.fffr-box small{opacity:.85}.fffr-out{border:2px solid CanvasText;border-radius:8px;padding:8px;margin:8px 0;font-weight:600}.fffr-mark{display:inline-block;margin-left:.5em;padding:0 .4em;border:1px solid currentColor;border-radius:4px;font:600 .75em system-ui;white-space:nowrap}';
  function el(tag, attrs, kids) {
    var d = root.document, n = d.createElement(tag); for (var k in (attrs || {})) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? d.createTextNode(c) : c); }); return n;
  }
  function css() { var d = root.document; if (d.getElementById('fffr-css')) return; var s = d.createElement('style'); s.id = 'fffr-css'; s.textContent = CSS; d.head.appendChild(s); }
  function toast(t) { var E = root.FFF && root.FFF.envelope; if (E && E.toast) E.toast(t); }
  function whyText(w) { w = String(w || ''); var k = w.split(':')[0]; return k === 'nocol' ? tr('nocol', { c: w.split(':').slice(1).join(':'), l: '…' }) : tr(k) === k ? w : tr(k); }

  /** Panou: o = {app, slug, getTable?: () => csv text | null, prefill?: payload}. */
  function panel(o, prefill) {
    var d = root.document, E = root.FFF && root.FFF.envelope; css(); var old = d.getElementById('fffr-panel'); if (old) { old.remove(); if (!prefill) return null; }
    var box = el('div', { 'class': 'fffr-box', role: 'dialog', 'aria-label': tr('title'), id: 'fffr-panel' }), last = null;
    function closeBox() { box.remove(); var f = d.getElementById('fffrFab'); if (f) f.focus(); }
    function f(id, label, node) { box.appendChild(el('label', { 'for': id, text: label })); box.appendChild(node); return node; }
    box.appendChild(el('h2', { text: tr('title') }));
    var claim = f('fffr-claim', tr('claim'), el('textarea', { id: 'fffr-claim', rows: '2', maxlength: '400' })), val = el('input', { id: 'fffr-value', inputmode: 'decimal', maxlength: '40', autocomplete: 'off' });
    var fn = el('select', { id: 'fffr-fn' }, FNS.map(function (x) { return el('option', { value: x, text: (I18N[lang()].fns || I18N.en.fns)[x] }); })), col = el('input', { id: 'fffr-col', maxlength: '80', autocomplete: 'off' }), tol = el('input', { id: 'fffr-tol', inputmode: 'decimal', value: String(TOL).replace('.', lang() === 'en' || lang() === 'hu' ? '.' : ',') });
    box.appendChild(el('div', { 'class': 'fffr-2' }, [el('div', {}, [el('label', { 'for': 'fffr-value', text: tr('value') }), val]), el('div', {}, [el('label', { 'for': 'fffr-tol', text: tr('tol') }), tol])]));
    box.appendChild(el('div', { 'class': 'fffr-2' }, [el('div', {}, [el('label', { 'for': 'fffr-fn', text: tr('fn') }), fn]), el('div', {}, [el('label', { 'for': 'fffr-col', text: tr('col') }), col])]));
    var wc = el('input', { id: 'fffr-wcol', maxlength: '80', 'aria-label': tr('where') }), wo = el('select', { id: 'fffr-wop', 'aria-label': tr('where') }, OPS.map(function (x) { return el('option', { value: x, text: x }); })), wv = el('input', { id: 'fffr-wval', maxlength: '80', 'aria-label': tr('where') });
    box.appendChild(el('label', { 'for': 'fffr-wcol', text: tr('where') })); box.appendChild(el('div', { 'class': 'fffr-3' }, [wc, wo, wv]));
    var si = el('input', { id: 'fffr-sind', maxlength: '80', autocomplete: 'off' }), sc = el('input', { id: 'fffr-scty', maxlength: '40', autocomplete: 'off' });
    box.appendChild(el('div', { 'class': 'fffr-2' }, [el('div', {}, [el('label', { 'for': 'fffr-sind', text: tr('ind') }), si]), el('div', {}, [el('label', { 'for': 'fffr-scty', text: tr('cty') }), sc])]));
    var data = f('fffr-data', tr('data'), el('textarea', { id: 'fffr-data', rows: '5', spellcheck: 'false' })), dname = '';
    var out = el('div', { id: 'fffr-out', 'class': 'fffr-out', role: 'status', 'aria-live': 'polite', hidden: '' }), sub = el('p', {}, [el('small', { id: 'fffr-cols' })]);
    box.appendChild(sub);
    var bar = el('div', { 'class': 'fffr-row' });
    var lb = el('button', { type: 'button', id: 'fffr-load', text: tr('load') }), file = el('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv,text/plain', hidden: '', id: 'fffr-file', 'aria-label': tr('load') });
    lb.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () { var fl = file.files && file.files[0]; if (!fl) return; var r = new root.FileReader(); r.onload = function () { data.value = String(r.result || '').slice(0, 2000000); dname = fl.name; colsHint(); }; r.readAsText(fl); });
    bar.appendChild(lb); bar.appendChild(file);
    if (o.getTable) { var tb = el('button', { type: 'button', id: 'fffr-table', text: tr('useTable') }); tb.addEventListener('click', function () { var t = null; try { t = o.getTable(); } catch (e) { t = null; } if (t) { data.value = t; dname = (o.app || '') + ' table'; colsHint(); } }); bar.appendChild(tb); }
    function colsHint() { var t = parseCsv(data.value); sub.firstChild.textContent = t.head.length ? tr('cols', { l: t.head.join(', ') }) : ''; }
    data.addEventListener('input', colsHint);
    var go = el('button', { type: 'button', 'class': 'fffr-pri', id: 'fffr-run', text: tr('run') });
    function query() { return { claim: claim.value, value: val.value, spec: { fn: fn.value, col: col.value, where: wc.value.trim() ? { col: wc.value, op: wo.value, val: wv.value } : null }, tol: String(tol.value).replace(',', '.'), csv: data.value, dataName: dname || 'data.csv', subject: { indicator: si.value, country: sc.value }, app: o.app }; }
    function show(p, extra) {
      last = p; out.hidden = false; out.textContent = '';
      var cl = p.valueText || p.value, line = p.verdict === 'reproduced' ? tr('rep', { r: fmt(p.result), c: cl }) : p.verdict === 'not-reproduced' ? tr('not', { r: fmt(p.result), c: cl }) : tr('inc', { w: whyText(p.why) });
      out.appendChild(el('div', { id: 'fffr-verdict', text: line })); if (extra) out.appendChild(el('div', { id: 'fffr-rerun', text: extra })); out.appendChild(el('small', { text: tr('caveat') }));
    }
    function fmt(x) { return x == null ? '—' : String(Math.round(x * 1e6) / 1e6).replace('.', lang() === 'en' || lang() === 'hu' ? '.' : ','); }
    go.addEventListener('click', function () { if (!data.value.trim()) { out.hidden = false; out.textContent = tr('nodata'); return; } run(query()).then(function (p) { show(p); }); });
    bar.appendChild(go);
    if (E) {
      var sb = E.sendButton({ slug: o.slug, text: tr('send'), getEnv: function () { var e = last && envelope(last, o.app, o.slug); if (!e) { toast(tr('none')); return null; } return e; } }); sb.id = 'fffr-send'; bar.appendChild(sb);
      var rb = E.importButton({ accepts: ['claim/repro'], text: tr('recv'), onReceive: function (env) { var p = cleanPayload(env.payload); if (!p) throw 0; fill(p); return rerun(p).then(function (r) { if (!r.ok) { show(p); return p.verdict; } show(r.payload, tr('rerun', { s: r.same ? tr('same') : tr('diff', { a: fmt(r.before), b: fmt(r.after) }) })); return r.payload.verdict; }); } }); rb.id = 'fffr-recv'; bar.appendChild(rb);
    }
    var cb = el('button', { type: 'button', id: 'fffr-close', text: tr('close') }); cb.addEventListener('click', closeBox); bar.appendChild(cb);
    box.appendChild(bar); box.appendChild(out);
    function fill(p) {
      claim.value = p.claim || ''; val.value = p.valueText || (p.value == null ? '' : String(p.value)); fn.value = p.spec && p.spec.fn || 'mean'; col.value = p.spec && p.spec.col || ''; tol.value = String(p.tol);
      wc.value = p.spec && p.spec.where ? p.spec.where.col : ''; wo.value = p.spec && p.spec.where ? p.spec.where.op : '='; wv.value = p.spec && p.spec.where ? p.spec.where.val : '';
      si.value = p.subject ? p.subject.indicator : ''; sc.value = p.subject ? p.subject.country : ''; data.value = p.data && p.data.csv || ''; dname = p.data && p.data.name || ''; colsHint();
    }
    box.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeBox(); });
    d.body.appendChild(box);
    if (prefill) { var cp = cleanPayload(prefill); if (cp) { fill(cp); rerun(cp).then(function (r) { if (!r.ok) { show(cp); return; } show(r.payload, tr('rerun', { s: r.same ? tr('same') : tr('diff', { a: fmt(r.before), b: fmt(r.after) }) })); }); } }
    claim.focus(); return box;
  }
  /** Montează butonul „Reproducere”. o = {app, slug, getTable?, host?, className?}. */
  function mount(o) {
    var d = root.document; if (!d || !d.body || d.getElementById('fffrFab')) return null; css();
    var fab = el('button', { type: 'button', id: 'fffrFab', 'class': o.host ? (o.className || '') : 'fffr-fab', text: tr('open'), 'aria-haspopup': 'dialog' });
    if (!o.host) fab.style.left = '88px';
    fab.addEventListener('click', function () { panel(o); }); (o.host || d.body).appendChild(fab); return fab;
  }
  return { VERSION: 1, FNS: FNS, OPS: OPS, I18N: I18N, tr: tr, parseCsv: parseCsv, num: num, compute: compute, judge: judge, sha256: sha256, run: run, rerun: rerun, envelope: envelope, cleanPayload: cleanPayload, panel: panel, mount: mount };
});
