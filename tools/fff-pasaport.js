/* fff-pasaport · Pașaportul de învățare FFF — caiet local comun pentru aplicațiile de educație: notări, repetiție eșalonată (SM-2 simplificat), export/import prin plicul FFF, certificat tipărabil.
 * Sursa canonică e ACEST fișier (tools/fff-pasaport.js); aplicațiile îl primesc prin `node tools/inject-shared.mjs`, nu prin copiere de mână.
 * Stocare: localStorage, cheia `fff.pasaport.v1`, PER ORIGINE. Aplicațiile servite de pe același domeniu (ex. chiuta.github.io/<Aplicație>/) văd același caiet; cele cu domenii proprii
 * (*.chiuta.ro) au fiecare caiet propriu și le unești prin plicul `passport/fff` (export/import, îmbinare fără dubluri). Fără rețea, fără cont, fără telemetrie.
 * Certificatul este AUTO-DECLARAT: spune ce a notat persoana în caietul ei; nu este diplomă, atestat sau dovadă de identitate. */
(function (root, factory) {
  var P = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = P;
  if (root) { try { var F = root.FFF || {}; root.FFF = F; if (root.FFF === F) F.passport = P; } catch (e) { /* inert */ } }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var KEY = 'fff.pasaport.v1', MAX = 3000, DAY = 864e5;
  var I18N = {
    ro: { open: 'Pașaport', title: 'Pașaport de învățare', note: 'Notează în pașaport', skill: 'Ce ai învățat sau exersat', level: 'Nivel', l1: '1 · Am întâlnit', l2: '2 · Înțeleg', l3: '3 · Pot aplica', l4: '4 · Pot explica', l5: '5 · Pot preda', memo: 'Notiță (opțional)', sched: 'Programează repetări eșalonate', save: 'Notează', cancel: 'Renunță', saved: 'Notat în pașaport.', empty: 'Pașaportul e gol. Folosește „Notează în pașaport”.', due: 'De repetat azi: {n}', nodue: 'Nimic de repetat azi.', again: 'Nu am știut', hard: 'Greu', good: 'Am știut', next: 'următoarea: {d}', cert: 'Certificat tipărabil', learner: 'Numele tău (pe certificat)', clear: 'Șterge tot', clearq: 'Ștergi tot pașaportul din acest browser?', close: 'Închide', del: 'Șterge', ctitle: 'Certificat de parcurs de învățare', cby: 'Acordat lui', cwhat: 'pentru {n} notări în pașaportul personal de învățare', cdisc: 'Document auto-declarat, generat local pe baza notărilor făcute de titular. Nu este diplomă, atestat sau dovadă de identitate și nu are valoare oficială.', ccode: 'Cod de control', cdate: 'Generat la', cprint: 'Tipărește', done: 'Importat în pașaport: {n} notări ({s} sărite ca duplicate).', none: 'Pașaportul e gol: nimic de trimis.', bad: 'Plic de pașaport invalid.', stats: '{n} notări · {a} aplicații', where: 'Salvat doar în acest browser, pe acest domeniu.', send: 'Pașaport · Trimite', recv: 'Pașaport · Primește', sess: 'Încarcă repetările de azi în agendă', sessn: 'Adăugat în agendă: {n} repetări.', sessz: 'Nu ai repetări scadente.' },
    en: { open: 'Passport', title: 'Learning passport', note: 'Log in passport', skill: 'What you learned or practised', level: 'Level', l1: '1 · Met it', l2: '2 · Understand', l3: '3 · Can apply', l4: '4 · Can explain', l5: '5 · Can teach', memo: 'Note (optional)', sched: 'Schedule spaced reviews', save: 'Log', cancel: 'Cancel', saved: 'Logged in the passport.', empty: 'The passport is empty. Use “Log in passport”.', due: 'To review today: {n}', nodue: 'Nothing to review today.', again: 'Didn’t know', hard: 'Hard', good: 'Knew it', next: 'next: {d}', cert: 'Printable certificate', learner: 'Your name (on the certificate)', clear: 'Clear all', clearq: 'Delete the whole passport from this browser?', close: 'Close', del: 'Delete', ctitle: 'Learning record certificate', cby: 'Issued to', cwhat: 'for {n} entries in the personal learning passport', cdisc: 'Self-declared document generated locally from the entries made by the holder. It is not a diploma, attestation or proof of identity and has no official value.', ccode: 'Check code', cdate: 'Generated on', cprint: 'Print', done: 'Imported into the passport: {n} entries ({s} skipped as duplicates).', none: 'The passport is empty: nothing to send.', bad: 'Invalid passport envelope.', stats: '{n} entries · {a} apps', where: 'Stored only in this browser, on this domain.', send: 'Passport · Send', recv: 'Passport · Receive', sess: 'Load today’s reviews into the agenda', sessn: 'Added to the agenda: {n} reviews.', sessz: 'No reviews due.' },
    fr: { open: 'Passeport', title: 'Passeport d’apprentissage', note: 'Noter dans le passeport', skill: 'Ce que vous avez appris ou pratiqué', level: 'Niveau', l1: '1 · Rencontré', l2: '2 · Je comprends', l3: '3 · Je sais appliquer', l4: '4 · Je sais expliquer', l5: '5 · Je sais enseigner', memo: 'Note (facultatif)', sched: 'Programmer des révisions espacées', save: 'Noter', cancel: 'Annuler', saved: 'Noté dans le passeport.', empty: 'Le passeport est vide. Utilisez « Noter dans le passeport ».', due: 'À réviser aujourd’hui : {n}', nodue: 'Rien à réviser aujourd’hui.', again: 'Je ne savais pas', hard: 'Difficile', good: 'Je savais', next: 'prochaine : {d}', cert: 'Certificat imprimable', learner: 'Votre nom (sur le certificat)', clear: 'Tout effacer', clearq: 'Supprimer tout le passeport de ce navigateur ?', close: 'Fermer', del: 'Supprimer', ctitle: 'Certificat de parcours d’apprentissage', cby: 'Décerné à', cwhat: 'pour {n} notes dans le passeport d’apprentissage personnel', cdisc: 'Document auto-déclaré, généré localement à partir des notes saisies par le titulaire. Ce n’est ni un diplôme, ni une attestation, ni une preuve d’identité, et il n’a aucune valeur officielle.', ccode: 'Code de contrôle', cdate: 'Généré le', cprint: 'Imprimer', done: 'Importé dans le passeport : {n} notes ({s} ignorées comme doublons).', none: 'Le passeport est vide : rien à envoyer.', bad: 'Enveloppe de passeport invalide.', stats: '{n} notes · {a} applications', where: 'Enregistré uniquement dans ce navigateur, sur ce domaine.', send: 'Passeport · Envoyer', recv: 'Passeport · Recevoir', sess: 'Charger les révisions du jour dans l’agenda', sessn: 'Ajouté à l’agenda : {n} révisions.', sessz: 'Aucune révision due.' },
    it: { open: 'Passaporto', title: 'Passaporto di apprendimento', note: 'Annota nel passaporto', skill: 'Cosa hai imparato o esercitato', level: 'Livello', l1: '1 · Incontrato', l2: '2 · Capisco', l3: '3 · So applicare', l4: '4 · So spiegare', l5: '5 · So insegnare', memo: 'Nota (facoltativa)', sched: 'Programma ripassi scaglionati', save: 'Annota', cancel: 'Annulla', saved: 'Annotato nel passaporto.', empty: 'Il passaporto è vuoto. Usa «Annota nel passaporto».', due: 'Da ripassare oggi: {n}', nodue: 'Niente da ripassare oggi.', again: 'Non lo sapevo', hard: 'Difficile', good: 'Lo sapevo', next: 'prossimo: {d}', cert: 'Certificato stampabile', learner: 'Il tuo nome (sul certificato)', clear: 'Cancella tutto', clearq: 'Eliminare l’intero passaporto da questo browser?', close: 'Chiudi', del: 'Elimina', ctitle: 'Certificato di percorso di apprendimento', cby: 'Rilasciato a', cwhat: 'per {n} annotazioni nel passaporto personale di apprendimento', cdisc: 'Documento autodichiarato, generato localmente dalle annotazioni fatte dal titolare. Non è un diploma, un attestato né una prova d’identità e non ha valore ufficiale.', ccode: 'Codice di controllo', cdate: 'Generato il', cprint: 'Stampa', done: 'Importate nel passaporto: {n} annotazioni ({s} saltate come duplicati).', none: 'Il passaporto è vuoto: niente da inviare.', bad: 'Busta di passaporto non valida.', stats: '{n} annotazioni · {a} app', where: 'Salvato solo in questo browser, su questo dominio.', send: 'Passaporto · Invia', recv: 'Passaporto · Ricevi', sess: 'Carica i ripassi di oggi nell’agenda', sessn: 'Aggiunti all’agenda: {n} ripassi.', sessz: 'Nessun ripasso in scadenza.' },
    es: { open: 'Pasaporte', title: 'Pasaporte de aprendizaje', note: 'Anotar en el pasaporte', skill: 'Qué aprendiste o practicaste', level: 'Nivel', l1: '1 · Lo conocí', l2: '2 · Lo entiendo', l3: '3 · Sé aplicarlo', l4: '4 · Sé explicarlo', l5: '5 · Sé enseñarlo', memo: 'Nota (opcional)', sched: 'Programar repasos espaciados', save: 'Anotar', cancel: 'Cancelar', saved: 'Anotado en el pasaporte.', empty: 'El pasaporte está vacío. Usa «Anotar en el pasaporte».', due: 'Para repasar hoy: {n}', nodue: 'Nada que repasar hoy.', again: 'No lo sabía', hard: 'Difícil', good: 'Lo sabía', next: 'siguiente: {d}', cert: 'Certificado imprimible', learner: 'Tu nombre (en el certificado)', clear: 'Borrar todo', clearq: '¿Borrar todo el pasaporte de este navegador?', close: 'Cerrar', del: 'Borrar', ctitle: 'Certificado de trayectoria de aprendizaje', cby: 'Otorgado a', cwhat: 'por {n} anotaciones en el pasaporte personal de aprendizaje', cdisc: 'Documento autodeclarado, generado localmente a partir de las anotaciones hechas por el titular. No es un diploma, certificación ni prueba de identidad y no tiene valor oficial.', ccode: 'Código de control', cdate: 'Generado el', cprint: 'Imprimir', done: 'Importado en el pasaporte: {n} anotaciones ({s} omitidas por duplicadas).', none: 'El pasaporte está vacío: nada que enviar.', bad: 'Sobre de pasaporte no válido.', stats: '{n} anotaciones · {a} apps', where: 'Guardado solo en este navegador, en este dominio.', send: 'Pasaporte · Enviar', recv: 'Pasaporte · Recibir', sess: 'Cargar los repasos de hoy en la agenda', sessn: 'Añadidos a la agenda: {n} repasos.', sessz: 'No hay repasos pendientes.' },
    pt: { open: 'Passaporte', title: 'Passaporte de aprendizagem', note: 'Anotar no passaporte', skill: 'O que aprendeu ou praticou', level: 'Nível', l1: '1 · Conheci', l2: '2 · Compreendo', l3: '3 · Sei aplicar', l4: '4 · Sei explicar', l5: '5 · Sei ensinar', memo: 'Nota (opcional)', sched: 'Agendar revisões espaçadas', save: 'Anotar', cancel: 'Cancelar', saved: 'Anotado no passaporte.', empty: 'O passaporte está vazio. Use «Anotar no passaporte».', due: 'Para rever hoje: {n}', nodue: 'Nada para rever hoje.', again: 'Não sabia', hard: 'Difícil', good: 'Sabia', next: 'próxima: {d}', cert: 'Certificado imprimível', learner: 'O seu nome (no certificado)', clear: 'Apagar tudo', clearq: 'Apagar todo o passaporte deste navegador?', close: 'Fechar', del: 'Apagar', ctitle: 'Certificado de percurso de aprendizagem', cby: 'Atribuído a', cwhat: 'por {n} anotações no passaporte pessoal de aprendizagem', cdisc: 'Documento autodeclarado, gerado localmente a partir das anotações feitas pelo titular. Não é diploma, atestado nem prova de identidade e não tem valor oficial.', ccode: 'Código de controlo', cdate: 'Gerado em', cprint: 'Imprimir', done: 'Importado no passaporte: {n} anotações ({s} ignoradas por duplicadas).', none: 'O passaporte está vazio: nada para enviar.', bad: 'Envelope de passaporte inválido.', stats: '{n} anotações · {a} apps', where: 'Guardado apenas neste navegador, neste domínio.', send: 'Passaporte · Enviar', recv: 'Passaporte · Receber', sess: 'Carregar as revisões de hoje na agenda', sessn: 'Adicionadas à agenda: {n} revisões.', sessz: 'Sem revisões pendentes.' },
    hu: { open: 'Útlevél', title: 'Tanulási útlevél', note: 'Jegyezd be az útlevélbe', skill: 'Mit tanultál vagy gyakoroltál', level: 'Szint', l1: '1 · Találkoztam vele', l2: '2 · Értem', l3: '3 · Alkalmazni tudom', l4: '4 · Magyarázni tudom', l5: '5 · Taníthatom', memo: 'Megjegyzés (nem kötelező)', sched: 'Elosztott ismétlések ütemezése', save: 'Bejegyzés', cancel: 'Mégse', saved: 'Bejegyezve az útlevélbe.', empty: 'Az útlevél üres. Használd a „Jegyezd be az útlevélbe” gombot.', due: 'Ma ismétlendő: {n}', nodue: 'Ma nincs ismétlendő.', again: 'Nem tudtam', hard: 'Nehéz', good: 'Tudtam', next: 'következő: {d}', cert: 'Nyomtatható igazolás', learner: 'A neved (az igazoláson)', clear: 'Összes törlése', clearq: 'Törlöd a teljes útlevelet ebből a böngészőből?', close: 'Bezárás', del: 'Törlés', ctitle: 'Tanulási út igazolása', cby: 'Kiállítva', cwhat: '{n} bejegyzésért a személyes tanulási útlevélben', cdisc: 'Önbevalláson alapuló, helyben generált dokumentum a tulajdonos bejegyzései alapján. Nem oklevél, igazolvány vagy személyazonosság-igazolás, és nincs hivatalos értéke.', ccode: 'Ellenőrző kód', cdate: 'Létrehozva', cprint: 'Nyomtatás', done: 'Importálva az útlevélbe: {n} bejegyzés ({s} kihagyva duplikátumként).', none: 'Az útlevél üres: nincs mit küldeni.', bad: 'Érvénytelen útlevélboríték.', stats: '{n} bejegyzés · {a} alkalmazás', where: 'Csak ebben a böngészőben, ezen a tartományon tárolva.', send: 'Útlevél · Küldés', recv: 'Útlevél · Fogadás', sess: 'A mai ismétlések betöltése a naplóba', sessn: 'Hozzáadva a naplóhoz: {n} ismétlés.', sessz: 'Nincs esedékes ismétlés.' },
    de: { open: 'Pass', title: 'Lernpass', note: 'Im Lernpass notieren', skill: 'Was du gelernt oder geübt hast', level: 'Stufe', l1: '1 · Kennengelernt', l2: '2 · Verstanden', l3: '3 · Kann anwenden', l4: '4 · Kann erklären', l5: '5 · Kann lehren', memo: 'Notiz (optional)', sched: 'Verteilte Wiederholungen planen', save: 'Notieren', cancel: 'Abbrechen', saved: 'Im Lernpass notiert.', empty: 'Der Lernpass ist leer. Nutze „Im Lernpass notieren“.', due: 'Heute zu wiederholen: {n}', nodue: 'Heute nichts zu wiederholen.', again: 'Nicht gewusst', hard: 'Schwer', good: 'Gewusst', next: 'nächste: {d}', cert: 'Druckbares Zertifikat', learner: 'Dein Name (auf dem Zertifikat)', clear: 'Alles löschen', clearq: 'Den ganzen Lernpass aus diesem Browser löschen?', close: 'Schließen', del: 'Löschen', ctitle: 'Zertifikat über den Lernweg', cby: 'Ausgestellt für', cwhat: 'für {n} Einträge im persönlichen Lernpass', cdisc: 'Selbst erklärtes Dokument, lokal aus den Einträgen der Inhaberin bzw. des Inhabers erzeugt. Es ist kein Diplom, Zeugnis oder Identitätsnachweis und hat keinen amtlichen Wert.', ccode: 'Prüfcode', cdate: 'Erzeugt am', cprint: 'Drucken', done: 'In den Lernpass importiert: {n} Einträge ({s} als Duplikate übersprungen).', none: 'Der Lernpass ist leer: nichts zu senden.', bad: 'Ungültiger Lernpass-Umschlag.', stats: '{n} Einträge · {a} Apps', where: 'Nur in diesem Browser auf dieser Domain gespeichert.', send: 'Lernpass · Senden', recv: 'Lernpass · Empfangen', sess: 'Heutige Wiederholungen in die Agenda laden', sessn: 'Zur Agenda hinzugefügt: {n} Wiederholungen.', sessz: 'Keine fälligen Wiederholungen.' }
  };
  function lang() { var l = ''; try { l = (root.document && root.document.documentElement.lang || '').slice(0, 2).toLowerCase(); } catch (e) { /* */ } return I18N[l] ? l : 'en'; }
  function tr(k, v) { var s = I18N[lang()][k] || I18N.en[k] || k; if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]); return s; }
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var dstr = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var clean = function (s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n); };
  var rid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  function addDays(ds, n) { var p = ds.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + n); return dstr(d); }
  function today(now) { return dstr(new Date(now == null ? Date.now() : now)); }

  /** Curăță o notare (din stocare sau din plic). Întoarce null dacă nu e utilizabilă. */
  function cleanEntry(x) {
    if (!x || typeof x !== 'object') return null;
    var skill = clean(x.skill, 120).trim(); if (!skill) return null;
    var e = { id: clean(x.id, 40).replace(/[^A-Za-z0-9_.:-]/g, '') || rid(), app: clean(x.app, 40), skill: skill, kind: x.kind === 'card' ? 'card' : 'note', level: Math.min(5, Math.max(1, Math.round(+x.level) || 1)), note: clean(x.note, 500) };
    var ts = String(x.ts || ''); e.ts = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(ts) ? ts : new Date().toISOString();
    if (x.score && isFinite(x.score.got) && isFinite(x.score.max) && x.score.max > 0 && x.score.max < 1e6) e.score = { got: +x.score.got, max: +x.score.max };
    if (e.kind === 'card') {
      e.due = DATE_RE.test(x.due) ? x.due : addDays(today(), 1);
      e.interval = Math.min(3650, Math.max(0, Math.round(+x.interval) || 0)); e.ease = Math.min(3, Math.max(1.3, +x.ease || 2.5)); e.reps = Math.min(1000, Math.max(0, Math.round(+x.reps) || 0));
      if (x.last && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(String(x.last))) e.last = String(x.last);
    }
    return e;
  }
  function store() { try { return root.localStorage || null; } catch (e) { return null; } }
  var mem = null;   // dacă localStorage lipsește sau e blocat, caietul trăiește doar cât pagina
  function load() {
    var s = store(), raw = null; if (s) { try { raw = s.getItem(KEY); } catch (e) { s = null; } }
    var o = null; if (raw) { try { o = JSON.parse(raw); } catch (e) { o = null; } }
    if (!o && !s && mem) return mem;
    var list = (o && Array.isArray(o.entries) ? o.entries : []).slice(0, MAX).map(cleanEntry).filter(Boolean);
    return { v: 1, learner: clean(o && o.learner, 80), entries: list };
  }
  function save(db) { db.entries = db.entries.slice(-MAX); mem = db; var s = store(); if (!s) return false; try { s.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; } }
  /** Adaugă o notare. e = {app, skill, level?, note?, score?, schedule?:true (devine „card” cu repetări), kind?}. */
  function add(e) {
    var db = load(), c = cleanEntry({ id: e.id, app: e.app, skill: e.skill, kind: e.schedule || e.kind === 'card' ? 'card' : 'note', level: e.level, note: e.note, score: e.score, ts: new Date().toISOString(), due: addDays(today(), 1), interval: 0, ease: 2.5, reps: 0 });
    if (!c) return null; db.entries.push(c); save(db); emit('add', c); return c;
  }
  function remove(id) { var db = load(), n = db.entries.length; db.entries = db.entries.filter(function (x) { return x.id !== id; }); save(db); return n - db.entries.length; }
  function clearAll() { save({ v: 1, learner: load().learner, entries: [] }); }
  function setLearner(n) { var db = load(); db.learner = clean(n, 80); save(db); }
  function list() { return load().entries; }
  function due(now) { var t = today(now); return load().entries.filter(function (x) { return x.kind === 'card' && x.due <= t; }).sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; }); }
  /** SM-2 simplificat. q: 0 = nu am știut, 3 = greu, 4 = am știut, 5 = ușor. Pașii: 1 zi, 3 zile, apoi interval × ease. */
  function schedule(e, q, now) {
    var ease = e.ease || 2.5, reps = e.reps || 0, iv = e.interval || 0;
    if (q < 3) { reps = 0; iv = 1; } else { reps += 1; iv = reps === 1 ? 1 : reps === 2 ? 3 : Math.max(iv + 1, Math.round(iv * ease)); }
    ease = Math.max(1.3, ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    return { interval: iv, ease: Math.round(ease * 100) / 100, reps: reps, due: addDays(today(now), iv), last: new Date(now == null ? Date.now() : now).toISOString() };
  }
  function grade(id, q, now) {
    var db = load(), e = db.entries.filter(function (x) { return x.id === id && x.kind === 'card'; })[0]; if (!e) return null;
    Object.assign(e, schedule(e, q, now)); save(db); emit('grade', e); return e;
  }
  /** Îmbină notări primite (fără dubluri; la același id rămâne cea mai recentă după `last`/`ts`). */
  function merge(incoming) {
    var db = load(), by = {}, added = 0, skipped = 0, fp = {};
    db.entries.forEach(function (e) { by[e.id] = e; fp[e.app + '|' + e.skill + '|' + e.ts] = 1; });
    (Array.isArray(incoming) ? incoming : []).slice(0, MAX).map(cleanEntry).filter(Boolean).forEach(function (e) {
      var k = e.app + '|' + e.skill + '|' + e.ts;
      if (by[e.id]) { var o = by[e.id]; if ((e.last || e.ts) > (o.last || o.ts)) { Object.assign(o, e); added++; } else skipped++; return; }
      if (fp[k]) { skipped++; return; }
      db.entries.push(e); by[e.id] = e; fp[k] = 1; added++;
    });
    save(db); return { added: added, skipped: skipped };
  }
  function digest(entries) {   // cod de control (FNV-1a pe 32 de biți, de două ori): detectează modificări accidentale, nu e semnătură
    var s = entries.map(function (e) { return [e.id, e.app, e.skill, e.level, e.ts].join('~'); }).join('\n'), h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0; h2 = Math.imul(h2 + s.charCodeAt(i), 0x85ebca6b) >>> 0; }
    return (h1.toString(16) + h2.toString(16)).toUpperCase().padStart(16, '0').replace(/(.{4})(?=.)/g, '$1-');
  }
  function stats(es) { es = es || list(); var a = {}; es.forEach(function (e) { a[e.app || '?'] = 1; }); return { n: es.length, apps: Object.keys(a).length }; }
  function envelope(app) {
    var E = root.FFF && root.FFF.envelope; if (!E) throw new Error('fără FFF.envelope'); var db = load();
    return E.create({ type: 'passport/fff', title: tr('title'), payload: { v: 1, learner: db.learner, entries: db.entries }, app: app || 'FFF', source: { label: app || 'FFF' }, lang: lang() });
  }
  function fromEnvelope(env) { return env && env.type === 'passport/fff' && env.payload && env.payload.v === 1 && Array.isArray(env.payload.entries) ? env.payload.entries : []; }
  var listeners = [];
  function emit(ev, e) { listeners.forEach(function (f) { try { f(ev, e); } catch (x) { /* */ } }); }
  function on(f) { listeners.push(f); }

  /* ---------- interfață ---------- */
  var CSS = '.fffp-fab{position:fixed;right:12px;bottom:12px;z-index:2147483001;min-height:44px;min-width:44px;padding:8px 14px;border:2px solid CanvasText;border-radius:22px;background:Canvas;color:CanvasText;font:600 14px system-ui;cursor:pointer;box-shadow:0 2px 8px #0003}' +
    '.fffp-box{position:fixed;right:12px;bottom:64px;z-index:2147482999;width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 84px);overflow:auto;background:Canvas;color:CanvasText;border:2px solid CanvasText;border-radius:12px;padding:14px;font:14px/1.4 system-ui;box-shadow:0 6px 24px #0005}' +
    '.fffp-box h2{font:700 16px system-ui;margin:0 0 8px}.fffp-box label{display:block;margin:8px 0 2px;font-weight:600}.fffp-box input,.fffp-box select,.fffp-box textarea{box-sizing:border-box;width:100%;font:inherit;padding:6px;color:CanvasText;background:Canvas;border:1px solid GrayText;border-radius:6px}' +
    '.fffp-box button{min-height:44px;min-width:44px;padding:6px 12px;margin:4px 6px 4px 0;font:inherit;color:CanvasText;background:Canvas;border:1px solid CanvasText;border-radius:8px;cursor:pointer}.fffp-box button.fffp-pri{background:CanvasText;color:Canvas}' +
    '.fffp-box ul{list-style:none;margin:8px 0;padding:0}.fffp-box li{border-top:1px solid GrayText;padding:6px 0}.fffp-box small{opacity:.85}.fffp-row{display:flex;flex-wrap:wrap;gap:2px}.fffp-chk{display:flex!important;align-items:center;gap:8px;font-weight:400!important}.fffp-chk input{width:auto}' +
    '.fffp-cert{display:none}@media print{body.fffp-printing>*:not(.fffp-cert){display:none!important}body.fffp-printing .fffp-cert{display:block!important;position:static;color:#000;background:#fff;font:16px/1.5 Georgia,serif;padding:24mm 18mm}.fffp-cert h1{font:700 30px Georgia,serif;text-align:center;margin:0 0 12mm}.fffp-cert .fffp-who{font:700 26px Georgia,serif;text-align:center;margin:6mm 0}.fffp-cert table{width:100%;border-collapse:collapse;margin:8mm 0;font-size:13px}.fffp-cert th,.fffp-cert td{border-bottom:1px solid #888;padding:3px 6px;text-align:left}.fffp-cert p{margin:3mm 0}.fffp-cert .fffp-disc{font-size:12px;border-top:1px solid #000;padding-top:4mm;margin-top:10mm}}';
  function el(tag, attrs, kids) {
    var d = root.document, n = d.createElement(tag); for (var k in (attrs || {})) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? d.createTextNode(c) : c); }); return n;
  }
  function css() { var d = root.document; if (d.getElementById('fffp-css')) return; var s = d.createElement('style'); s.id = 'fffp-css'; s.textContent = CSS; d.head.appendChild(s); }
  function toast(t) { var E = root.FFF && root.FFF.envelope; if (E && E.toast) E.toast(t); }

  /** Construiește (fără a tipări) nodul certificatului. */
  function certificateNode(o) {
    o = o || {}; var es = (o.entries || list()).slice().sort(function (a, b) { return a.ts < b.ts ? -1 : 1; }), db = load(), name = clean(o.learner != null ? o.learner : db.learner, 80);
    var rows = es.map(function (e) { return el('tr', {}, [el('td', { text: e.ts.slice(0, 10) }), el('td', { text: e.app }), el('td', { text: e.skill }), el('td', { text: String(e.level) + '/5' })]); });
    var head = el('tr', {}, ['', '', '', ''].map(function (_, i) { return el('th', { scope: 'col', text: [tr('cdate'), 'App', tr('skill'), tr('level')][i] }); }));
    return el('div', { 'class': 'fffp-cert', role: 'document', 'aria-label': tr('ctitle') }, [
      el('h1', { text: tr('ctitle') }), el('p', { text: tr('cby'), style: 'text-align:center' }), el('p', { 'class': 'fffp-who', text: name || '________________' }),
      el('p', { text: tr('cwhat', { n: es.length }), style: 'text-align:center' }),
      el('table', {}, [el('thead', {}, [head]), el('tbody', {}, rows)]),
      el('p', { text: tr('ccode') + ': ' + digest(es) + ' · ' + tr('cdate') + ' ' + today() }), el('p', { 'class': 'fffp-disc', text: tr('cdisc') })]);
  }
  function printCertificate(o) {
    var d = root.document; css(); var n = certificateNode(o), old = d.querySelector('.fffp-cert'); if (old) old.remove();
    d.body.appendChild(n); d.body.classList.add('fffp-printing');
    var done = function () { d.body.classList.remove('fffp-printing'); n.remove(); root.removeEventListener('afterprint', done); };
    root.addEventListener('afterprint', done); try { root.print(); } catch (e) { done(); }
    return n;
  }
  /** Formularul „Notează în pașaport”. o = {app, draft: ()=>({skill, note, level})}. */
  function noteDialog(o, onDone) {
    var d = root.document; css(); var dr = (o.draft && o.draft()) || {};
    var sk = el('input', { id: 'fffp-skill', maxlength: '120', value: clean(dr.skill, 120) }), lv = el('select', { id: 'fffp-level' }, [1, 2, 3, 4, 5].map(function (i) { return el('option', { value: String(i), text: tr('l' + i) }); }));
    lv.value = String(dr.level || 2);
    var memo = el('textarea', { id: 'fffp-memo', rows: '2', maxlength: '500' }); memo.value = clean(dr.note, 500);
    var sc = el('input', { type: 'checkbox', id: 'fffp-sched' }); sc.checked = true;
    var box = el('div', { 'class': 'fffp-box', role: 'dialog', 'aria-label': tr('note'), id: 'fffp-note' }, [el('h2', { text: tr('note') }),
      el('label', { 'for': 'fffp-skill', text: tr('skill') }), sk, el('label', { 'for': 'fffp-level', text: tr('level') }), lv, el('label', { 'for': 'fffp-memo', text: tr('memo') }), memo,
      el('label', { 'class': 'fffp-chk', 'for': 'fffp-sched' }, [sc, tr('sched')])]);
    var ok = el('button', { type: 'button', 'class': 'fffp-pri', id: 'fffp-save', text: tr('save') }), no = el('button', { type: 'button', text: tr('cancel') });
    box.appendChild(el('div', { 'class': 'fffp-row' }, [ok, no]));
    function close() { box.remove(); }
    ok.addEventListener('click', function () { var e = add({ app: o.app, skill: sk.value, level: +lv.value, note: memo.value, schedule: sc.checked, score: dr.score }); if (!e) { sk.focus(); return; } close(); toast(tr('saved')); if (onDone) onDone(e); });
    no.addEventListener('click', close); box.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });
    d.body.appendChild(box); sk.focus(); return box;
  }
  /** Panoul pașaportului: listă, repetări scadente, export/import, certificat. */
  function panel(o) {
    var d = root.document, E = root.FFF && root.FFF.envelope; css(); var old = d.getElementById('fffp-panel'); if (old) { old.remove(); return null; }
    var box = el('div', { 'class': 'fffp-box', role: 'dialog', 'aria-label': tr('title'), id: 'fffp-panel' });
    function draw() {
      box.textContent = ''; var db = load(), st = stats(db.entries), dues = due();
      box.appendChild(el('h2', { text: tr('title') })); box.appendChild(el('small', { text: tr('stats', { n: st.n, a: st.apps }) + ' · ' + tr('where') }));
      var bar = el('div', { 'class': 'fffp-row' }); var nb = el('button', { type: 'button', 'class': 'fffp-pri', text: tr('note') }); nb.addEventListener('click', function () { noteDialog(o, draw); }); bar.appendChild(nb);
      if (E) {
        var sb = E.sendButton({ slug: o.slug, text: tr('send'), getEnv: function () { if (!list().length) { toast(tr('none')); return null; } return envelope(o.app); } }); sb.id = 'fffpSend';
        var rb = E.importButton({ accepts: ['passport/fff'], text: tr('recv'), onReceive: function (env) { var r = merge(fromEnvelope(env)); toast(tr('done', { n: r.added, s: r.skipped })); draw(); } }); rb.id = 'fffpRecv'; bar.appendChild(sb); bar.appendChild(rb);
      }
      var cb = el('button', { type: 'button', id: 'fffpCert', text: tr('cert') }); cb.addEventListener('click', function () { printCertificate({ learner: ln.value }); });
      var ln = el('input', { id: 'fffp-learner', maxlength: '80', value: db.learner, autocomplete: 'name' }); ln.addEventListener('change', function () { setLearner(ln.value); });
      (o.extras || []).forEach(function (x) { var b = el('button', { type: 'button', id: x.id, text: x.text }); b.addEventListener('click', function () { x.run(draw); }); bar.appendChild(b); });
      box.appendChild(bar);
      box.appendChild(el('h3', { text: dues.length ? tr('due', { n: dues.length }) : tr('nodue'), style: 'font:700 14px system-ui;margin:10px 0 0' }));
      var ul = el('ul', {});
      dues.slice(0, 20).forEach(function (e) {
        var li = el('li', {}, [el('strong', { text: e.skill }), ' ', el('small', { text: e.app })]), row = el('div', { 'class': 'fffp-row' });
        [[0, 'again'], [3, 'hard'], [4, 'good']].forEach(function (g) { var b = el('button', { type: 'button', text: tr(g[1]), 'data-q': String(g[0]) }); b.addEventListener('click', function () { grade(e.id, g[0]); draw(); }); row.appendChild(b); }); li.appendChild(row); ul.appendChild(li);
      });
      box.appendChild(ul);
      var all = el('ul', {}); if (!db.entries.length) all.appendChild(el('li', { text: tr('empty') }));
      db.entries.slice(-30).reverse().forEach(function (e) {
        var b = el('button', { type: 'button', text: tr('del'), 'aria-label': tr('del') + ': ' + e.skill }); b.addEventListener('click', function () { remove(e.id); draw(); });
        all.appendChild(el('li', {}, [el('strong', { text: e.skill }), ' ', el('small', { text: e.app + ' · ' + e.ts.slice(0, 10) + ' · ' + e.level + '/5' + (e.kind === 'card' ? ' · ' + tr('next', { d: e.due }) : '') + (e.note ? ' · ' + e.note : '') }), b]));
      });
      box.appendChild(all);
      box.appendChild(el('label', { 'for': 'fffp-learner', text: tr('learner') })); box.appendChild(ln); box.appendChild(cb);
      var cl = el('button', { type: 'button', text: tr('clear') }); cl.addEventListener('click', function () { if (root.confirm(tr('clearq'))) { clearAll(); draw(); } });
      var xb = el('button', { type: 'button', id: 'fffpClose', text: tr('close') }); xb.addEventListener('click', function () { box.remove(); var f = d.getElementById('fffpFab'); if (f) f.focus(); });
      box.appendChild(cl); box.appendChild(xb);
    }
    box.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { box.remove(); var f = d.getElementById('fffpFab'); if (f) f.focus(); } });
    draw(); d.body.appendChild(box); var first = box.querySelector('button'); if (first) first.focus(); return box;
  }
  /** Montează butoanele: „Notează în pașaport” + „Pașaport”. o = {app, slug, draft(), host?: element (altfel plutitor), className?}. */
  function mount(o) {
    var d = root.document; if (!d || !d.body || d.getElementById('fffpFab')) return null; css();
    var fab = el('button', { type: 'button', id: 'fffpFab', 'class': o.host ? (o.className || '') : 'fffp-fab', text: tr('open'), 'aria-haspopup': 'dialog' });
    var nb = el('button', { type: 'button', id: 'fffpNote', 'class': o.host ? (o.className || '') : 'fffp-fab', text: tr('note') });
    if (!o.host) nb.style.cssText = 'right:auto;left:12px;';
    fab.addEventListener('click', function () { panel(o); }); nb.addEventListener('click', function () { var b = d.getElementById('fffp-note'); if (b) { b.remove(); return; } noteDialog(o); });
    var h = o.host || d.body; h.appendChild(nb); h.appendChild(fab); return { fab: fab, note: nb };
  }
  return { VERSION: 1, KEY: KEY, I18N: I18N, tr: tr, cleanEntry: cleanEntry, load: load, add: add, remove: remove, list: list, due: due, schedule: schedule, grade: grade, merge: merge, digest: digest, stats: stats,
    envelope: envelope, fromEnvelope: fromEnvelope, setLearner: setLearner, clearAll: clearAll, on: on, certificateNode: certificateNode, printCertificate: printCertificate, noteDialog: noteDialog, panel: panel, mount: mount, today: today };
});
