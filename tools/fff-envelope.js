/* fff-envelope · plic FFF (.fff.json) — creare, validare, semnare, transport (fișier, clipboard, link, QR, BroadcastChannel) și „Trimite către…”.
 * Specificație: docs/FFF-ENVELOPE.md. Fără dependențe, fără rețea, compatibil cu connect-src 'none'.
 * Sursa canonică e ACEST fișier (tools/fff-envelope.js); aplicațiile îl primesc prin `node tools/inject-shared.mjs`, nu prin copiere de mână
 * (`inject-shared.mjs --check` verifică că fiecare copie e identică cu sursa). Rulează și în Node (module.exports) pentru teste.
 * Opțional folosește FFF.qr (cod QR) și FFF.bridge (registrul de aplicații, primirea prin banda kitului) dacă există. */
(function (root, factory) {
  var E = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = E;
  if (root) { try { var F = root.FFF || {}; root.FFF = F; if (root.FFF === F) F.envelope = E; } catch (e) { /* fără FFF (ex. blocat): biblioteca rămâne inertă */ } }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var VERSION = 2, COMPAT = 1, MAX_BYTES = 8 * 1024 * 1024, MAX_LINK = 24000, PREFIX = 'fff=', CHANNEL = 'fff-envelope', SIG_IT = 600000;
  var TYPES = ['text/markdown', 'text/plain', 'citation/csl', 'table/csv', 'quiz/undava', 'geo/gpx', 'events/ics', 'note/akasha', 'cards/qa', 'link/fff', 'keys/vault', 'clips/list', 'chat/transcript'];
  var TYPE_RE = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/;
  var enc = new TextEncoder(), dec = new TextDecoder();
  var BAD_KEYS = { '__proto__': 1, 'constructor': 1, 'prototype': 1 };
  var I18N = {
 "ro": {
  "send": "Trimite către…",
  "toApp": "Trimite către {name}",
  "file": "Descarcă fișier .fff.json",
  "copy": "Copiază în clipboard",
  "qr": "Arată cod QR",
  "tabs": "Alte file ale acestei aplicații",
  "none": "Nicio aplicație compatibilă în listă; folosește fișier, clipboard sau QR.",
  "copied": "Copiat în clipboard.",
  "qrBig": "Prea mare pentru un cod QR; folosește fișierul.",
  "qrTitle": "Scanează codul în aplicația care primește",
  "close": "Închide",
  "recv": "Primește…",
  "recvFile": "Alege fișier .fff.json",
  "recvPaste": "Lipește din clipboard",
  "recvScan": "Scanează cod QR (imagine)",
  "incoming": "Plic de la {src}: „{title}”. Îl imporți?",
  "imp": "Importă",
  "no": "Nu",
  "done": "Importat.",
  "bad": "Plic invalid sau neacceptat de această aplicație.",
  "sent": "Trimis către celelalte file deschise.",
  "ev": "Dovezi",
  "noev": "nevaluat",
  "sigOk": "semnătură verificată",
  "sigBad": "semnătură NEvalidă",
  "sigYes": "semnat",
  "sigNone": "nesemnat",
  "source": "Sursa",
  "ask": "Parola semnăturii",
  "ev0": "tradiție / valoare culturală",
  "ev1": "relatări și observații izolate",
  "ev2": "observații sistematice, studii mici sau preliminare",
  "ev3": "studii controlate",
  "ev4": "verificat (replicat, consens)"
 },
 "en": {
  "send": "Send to…",
  "toApp": "Send to {name}",
  "file": "Download .fff.json file",
  "copy": "Copy to clipboard",
  "qr": "Show QR code",
  "tabs": "Other tabs of this app",
  "none": "No compatible app in the list; use a file, the clipboard or QR.",
  "copied": "Copied to the clipboard.",
  "qrBig": "Too large for a QR code; use the file.",
  "qrTitle": "Scan the code in the receiving app",
  "close": "Close",
  "recv": "Receive…",
  "recvFile": "Choose a .fff.json file",
  "recvPaste": "Paste from clipboard",
  "recvScan": "Scan QR code (image)",
  "incoming": "Envelope from {src}: “{title}”. Import it?",
  "imp": "Import",
  "no": "No",
  "done": "Imported.",
  "bad": "Invalid envelope, or not accepted by this app.",
  "sent": "Sent to the other open tabs.",
  "ev": "Evidence",
  "noev": "not rated",
  "sigOk": "signature verified",
  "sigBad": "signature INVALID",
  "sigYes": "signed",
  "sigNone": "unsigned",
  "source": "Source",
  "ask": "Signature password",
  "ev0": "tradition / cultural value",
  "ev1": "isolated reports and observations",
  "ev2": "systematic observations, small or preliminary studies",
  "ev3": "controlled studies",
  "ev4": "verified (replicated, consensus)"
 },
 "fr": {
  "send": "Envoyer vers…",
  "toApp": "Envoyer vers {name}",
  "file": "Télécharger le fichier .fff.json",
  "copy": "Copier dans le presse-papiers",
  "qr": "Afficher le code QR",
  "tabs": "Autres onglets de cette application",
  "none": "Aucune application compatible dans la liste ; utilisez un fichier, le presse-papiers ou un QR.",
  "copied": "Copié dans le presse-papiers.",
  "qrBig": "Trop volumineux pour un code QR ; utilisez le fichier.",
  "qrTitle": "Scannez le code dans l’application destinataire",
  "close": "Fermer",
  "recv": "Recevoir…",
  "recvFile": "Choisir un fichier .fff.json",
  "recvPaste": "Coller depuis le presse-papiers",
  "recvScan": "Scanner un code QR (image)",
  "incoming": "Enveloppe de {src} : « {title} ». L’importer ?",
  "imp": "Importer",
  "no": "Non",
  "done": "Importé.",
  "bad": "Enveloppe invalide ou non acceptée par cette application.",
  "sent": "Envoyé aux autres onglets ouverts.",
  "ev": "Preuves",
  "noev": "non évalué",
  "sigOk": "signature vérifiée",
  "sigBad": "signature INVALIDE",
  "sigYes": "signé",
  "sigNone": "non signé",
  "source": "Source",
  "ask": "Mot de passe de la signature",
  "ev0": "tradition / valeur culturelle",
  "ev1": "témoignages et observations isolés",
  "ev2": "observations systématiques, études petites ou préliminaires",
  "ev3": "études contrôlées",
  "ev4": "vérifié (reproduit, consensus)"
 },
 "it": {
  "send": "Invia a…",
  "toApp": "Invia a {name}",
  "file": "Scarica il file .fff.json",
  "copy": "Copia negli appunti",
  "qr": "Mostra il codice QR",
  "tabs": "Altre schede di questa app",
  "none": "Nessuna app compatibile nell’elenco; usa un file, gli appunti o un QR.",
  "copied": "Copiato negli appunti.",
  "qrBig": "Troppo grande per un codice QR; usa il file.",
  "qrTitle": "Scansiona il codice nell’app che riceve",
  "close": "Chiudi",
  "recv": "Ricevi…",
  "recvFile": "Scegli un file .fff.json",
  "recvPaste": "Incolla dagli appunti",
  "recvScan": "Scansiona un codice QR (immagine)",
  "incoming": "Busta da {src}: «{title}». Importarla?",
  "imp": "Importa",
  "no": "No",
  "done": "Importato.",
  "bad": "Busta non valida o non accettata da questa app.",
  "sent": "Inviato alle altre schede aperte.",
  "ev": "Prove",
  "noev": "non valutato",
  "sigOk": "firma verificata",
  "sigBad": "firma NON valida",
  "sigYes": "firmato",
  "sigNone": "non firmato",
  "source": "Fonte",
  "ask": "Password della firma",
  "ev0": "tradizione / valore culturale",
  "ev1": "resoconti e osservazioni isolati",
  "ev2": "osservazioni sistematiche, studi piccoli o preliminari",
  "ev3": "studi controllati",
  "ev4": "verificato (replicato, consenso)"
 },
 "es": {
  "send": "Enviar a…",
  "toApp": "Enviar a {name}",
  "file": "Descargar archivo .fff.json",
  "copy": "Copiar al portapapeles",
  "qr": "Mostrar código QR",
  "tabs": "Otras pestañas de esta aplicación",
  "none": "No hay ninguna aplicación compatible en la lista; usa un archivo, el portapapeles o un QR.",
  "copied": "Copiado al portapapeles.",
  "qrBig": "Demasiado grande para un código QR; usa el archivo.",
  "qrTitle": "Escanea el código en la aplicación receptora",
  "close": "Cerrar",
  "recv": "Recibir…",
  "recvFile": "Elegir un archivo .fff.json",
  "recvPaste": "Pegar desde el portapapeles",
  "recvScan": "Escanear código QR (imagen)",
  "incoming": "Sobre de {src}: «{title}». ¿Importarlo?",
  "imp": "Importar",
  "no": "No",
  "done": "Importado.",
  "bad": "Sobre no válido o no aceptado por esta aplicación.",
  "sent": "Enviado a las demás pestañas abiertas.",
  "ev": "Evidencia",
  "noev": "sin valorar",
  "sigOk": "firma verificada",
  "sigBad": "firma NO válida",
  "sigYes": "firmado",
  "sigNone": "sin firmar",
  "source": "Fuente",
  "ask": "Contraseña de la firma",
  "ev0": "tradición / valor cultural",
  "ev1": "relatos y observaciones aislados",
  "ev2": "observaciones sistemáticas, estudios pequeños o preliminares",
  "ev3": "estudios controlados",
  "ev4": "verificado (replicado, consenso)"
 },
 "pt": {
  "send": "Enviar para…",
  "toApp": "Enviar para {name}",
  "file": "Descarregar ficheiro .fff.json",
  "copy": "Copiar para a área de transferência",
  "qr": "Mostrar código QR",
  "tabs": "Outros separadores desta aplicação",
  "none": "Nenhuma aplicação compatível na lista; use um ficheiro, a área de transferência ou um QR.",
  "copied": "Copiado para a área de transferência.",
  "qrBig": "Demasiado grande para um código QR; use o ficheiro.",
  "qrTitle": "Leia o código na aplicação recetora",
  "close": "Fechar",
  "recv": "Receber…",
  "recvFile": "Escolher um ficheiro .fff.json",
  "recvPaste": "Colar da área de transferência",
  "recvScan": "Ler código QR (imagem)",
  "incoming": "Envelope de {src}: «{title}». Importá-lo?",
  "imp": "Importar",
  "no": "Não",
  "done": "Importado.",
  "bad": "Envelope inválido ou não aceite por esta aplicação.",
  "sent": "Enviado para os outros separadores abertos.",
  "ev": "Evidências",
  "noev": "não avaliado",
  "sigOk": "assinatura verificada",
  "sigBad": "assinatura INVÁLIDA",
  "sigYes": "assinado",
  "sigNone": "não assinado",
  "source": "Fonte",
  "ask": "Palavra-passe da assinatura",
  "ev0": "tradição / valor cultural",
  "ev1": "relatos e observações isolados",
  "ev2": "observações sistemáticas, estudos pequenos ou preliminares",
  "ev3": "estudos controlados",
  "ev4": "verificado (replicado, consenso)"
 },
 "de": {
  "send": "Senden an…",
  "toApp": "An {name} senden",
  "file": "Datei .fff.json herunterladen",
  "copy": "In die Zwischenablage kopieren",
  "qr": "QR-Code anzeigen",
  "tabs": "Andere Tabs dieser App",
  "none": "Keine kompatible App in der Liste; nutze eine Datei, die Zwischenablage oder einen QR-Code.",
  "copied": "In die Zwischenablage kopiert.",
  "qrBig": "Zu groß für einen QR-Code; nutze die Datei.",
  "qrTitle": "Code in der empfangenden App scannen",
  "close": "Schließen",
  "recv": "Empfangen…",
  "recvFile": "Datei .fff.json wählen",
  "recvPaste": "Aus der Zwischenablage einfügen",
  "recvScan": "QR-Code scannen (Bild)",
  "incoming": "Umschlag von {src}: „{title}“. Importieren?",
  "imp": "Importieren",
  "no": "Nein",
  "done": "Importiert.",
  "bad": "Ungültiger Umschlag oder von dieser App nicht akzeptiert.",
  "sent": "An die anderen offenen Tabs gesendet.",
  "ev": "Belege",
  "noev": "nicht bewertet",
  "sigOk": "Signatur geprüft",
  "sigBad": "Signatur UNGÜLTIG",
  "sigYes": "signiert",
  "sigNone": "unsigniert",
  "source": "Quelle",
  "ask": "Passwort der Signatur",
  "ev0": "Tradition / kultureller Wert",
  "ev1": "vereinzelte Berichte und Beobachtungen",
  "ev2": "systematische Beobachtungen, kleine oder vorläufige Studien",
  "ev3": "kontrollierte Studien",
  "ev4": "verifiziert (repliziert, Konsens)"
 },
 "hu": {
  "send": "Küldés ide…",
  "toApp": "Küldés ide: {name}",
  "file": ".fff.json fájl letöltése",
  "copy": "Másolás a vágólapra",
  "qr": "QR-kód mutatása",
  "tabs": "Az alkalmazás többi lapja",
  "none": "Nincs kompatibilis alkalmazás a listában; használj fájlt, vágólapot vagy QR-kódot.",
  "copied": "Vágólapra másolva.",
  "qrBig": "Túl nagy QR-kódnak; használd a fájlt.",
  "qrTitle": "Olvasd be a kódot a fogadó alkalmazásban",
  "close": "Bezárás",
  "recv": "Fogadás…",
  "recvFile": ".fff.json fájl kiválasztása",
  "recvPaste": "Beillesztés a vágólapról",
  "recvScan": "QR-kód beolvasása (kép)",
  "incoming": "Boríték innen: {src}: „{title}”. Importálod?",
  "imp": "Importálás",
  "no": "Nem",
  "done": "Importálva.",
  "bad": "Érvénytelen boríték, vagy ez az alkalmazás nem fogadja el.",
  "sent": "Elküldve a többi nyitott lapnak.",
  "ev": "Bizonyítékok",
  "noev": "nincs értékelve",
  "sigOk": "aláírás ellenőrizve",
  "sigBad": "az aláírás ÉRVÉNYTELEN",
  "sigYes": "aláírt",
  "sigNone": "aláíratlan",
  "source": "Forrás",
  "ask": "Az aláírás jelszava",
  "ev0": "hagyomány / kulturális érték",
  "ev1": "elszigetelt beszámolók és megfigyelések",
  "ev2": "rendszeres megfigyelések, kis vagy előzetes tanulmányok",
  "ev3": "kontrollált vizsgálatok",
  "ev4": "igazolt (megismételt, konszenzus)"
 }
};

  /* ---------- utilitare ---------- */
  function lang() {
    var l = '';
    try { if (root.FFF && root.FFF.lang) l = root.FFF.lang(); } catch (e) { /* fără core */ }
    if (!l) try { l = root.document.documentElement.lang; } catch (e) { /* fără document */ }
    l = String(l || 'en').slice(0, 2).toLowerCase();
    return I18N[l] ? l : 'en';
  }
  function tr(k, v) {
    var s = (I18N[lang()] || I18N.en)[k] || I18N.en[k] || k;
    if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]);
    return s;
  }
  function b64(u) { var s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function b64u(u) { return b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return unb64(s); }
  function subtle() { var c = root.crypto; if (!c || !c.subtle) throw new Error('fff: WebCrypto indisponibil'); return c.subtle; }
  function clean(o) {   /* doar JSON simplu; cheile periculoase dispar */
    return JSON.parse(JSON.stringify(o), function (k, v) { return BAD_KEYS[k] ? undefined : v; });
  }
  /* JSON canonic: chei sortate, fără spații — baza semnăturii */
  function canon(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
  }
  function err(code, msg) { var e = new Error('fff: ' + msg); e.code = code; return e; }

  /* ---------- plic ---------- */
  function isoNow() { return new Date().toISOString(); }
  function normSource(s) {
    if (s === undefined || s === null || s === '') return undefined;
    if (typeof s === 'string') return s.slice(0, 500);
    if (typeof s === 'object') { var o = {}; ['label', 'url', 'id', 'doi'].forEach(function (k) { if (typeof s[k] === 'string' && s[k]) o[k] = s[k].slice(0, 500); }); return Object.keys(o).length ? o : undefined; }
    return undefined;
  }
  function normEvidence(e) {
    if (e === undefined || e === null) return undefined;
    var lv = typeof e === 'number' ? e : e.level;
    if (!Number.isInteger(lv) || lv < 0 || lv > 4) throw err('evidence', 'evidence.level trebuie să fie un întreg 0–4');
    var o = { level: lv };
    if (e && typeof e === 'object' && typeof e.note === 'string' && e.note) o.note = e.note.slice(0, 500);
    return o;
  }
  /** Construiește un plic canonic (fff:2). o = {type, title, payload, source, evidence, app, lang, created}. */
  function create(o) {
    if (!o || typeof o !== 'object') throw err('arg', 'create cere un obiect');
    var env = { fff: VERSION, type: o.type, title: String(o.title || '').slice(0, 200), payload: o.payload, created: o.created || isoNow(), app: String(o.app || '').slice(0, 80) };
    var s = normSource(o.source), ev = normEvidence(o.evidence);
    if (s !== undefined) env.source = s;
    if (ev !== undefined) env.evidence = ev;
    if (o.lang) env.lang = String(o.lang).slice(0, 8);
    var v = validate(env); if (!v.ok) throw err('invalid', v.errors.join('; '));
    return env;
  }
  /** Verificări; întoarce {ok, errors}. Acceptă forma canonică (fff:2). */
  function validate(env) {
    var er = [];
    if (!env || typeof env !== 'object' || Array.isArray(env)) return { ok: false, errors: ['nu e obiect'] };
    if (env.fff !== VERSION) er.push('fff trebuie să fie ' + VERSION);
    if (typeof env.type !== 'string' || !TYPE_RE.test(env.type)) er.push('type invalid (ex. table/csv)');
    if (!('payload' in env) || env.payload === undefined) er.push('lipsește payload');
    if (env.title !== undefined && typeof env.title !== 'string') er.push('title trebuie să fie text');
    if (typeof env.created !== 'string' || isNaN(Date.parse(env.created))) er.push('created trebuie să fie dată ISO 8601');
    if (typeof env.app !== 'string') er.push('app trebuie să fie text (slug)');
    if (env.source !== undefined && !(typeof env.source === 'string' || (env.source && typeof env.source === 'object' && !Array.isArray(env.source)))) er.push('source: text sau obiect');
    if (env.evidence !== undefined) { var l = env.evidence && env.evidence.level; if (!Number.isInteger(l) || l < 0 || l > 4) er.push('evidence.level: întreg 0–4'); }
    if (env.sig !== undefined && !(env.sig && env.sig.alg === 'HMAC-SHA256' && env.sig.salt && env.sig.mac && Number.isInteger(env.sig.it))) er.push('sig invalid');
    try { var n = enc.encode(JSON.stringify(env)).length; if (n > MAX_BYTES) er.push('plic prea mare (' + n + ' octeți; maxim ' + MAX_BYTES + ')'); } catch (e) { er.push('nu e JSON serializabil'); }
    return { ok: er.length === 0, errors: er };
  }
  /** Orice plic (canonic fff:2 sau compat/legacy fff:1 din FFF.bridge) → canonic. Aruncă la plic invalid. */
  function normalize(any) {
    var e = clean(any);
    if (!e || typeof e !== 'object') throw err('invalid', 'plic invalid');
    var out;
    if (e.fff === VERSION) out = e;
    else if (e.fff === COMPAT && typeof e.type === 'string' && 'data' in e) {
      out = { fff: VERSION, type: e.type, title: typeof e.title === 'string' ? e.title : '', payload: e.data, created: e.created || e.ts || isoNow(), app: typeof e.app === 'string' ? e.app : String(e.src || '') };
      if (e.source !== undefined) out.source = e.source;
      if (e.evidence !== undefined) out.evidence = e.evidence;
      if (e.sig !== undefined) out.sig = e.sig;
      if (e.lang) out.lang = e.lang;
    } else throw err('invalid', 'plic invalid');
    var v = validate(out); if (!v.ok) throw err('invalid', v.errors.join('; '));
    return out;
  }
  /** Forma de transport „compat” (fff:1): citită și de FFF.bridge din kit ≤ 1.2; câmpurile noi (source, evidence, app, sig) rămân ca extra. */
  function toCompat(env) {
    var e = normalize(env), o = { fff: COMPAT, type: e.type, src: e.app, title: e.title, lang: e.lang || '', theme: '', ts: e.created, data: e.payload, app: e.app, created: e.created };
    if (e.source !== undefined) o.source = e.source;
    if (e.evidence !== undefined) o.evidence = e.evidence;
    if (e.sig !== undefined) o.sig = e.sig;
    return o;
  }
  function serialize(env, o) { return JSON.stringify((o && o.format === 'canonical') ? normalize(env) : toCompat(env), null, o && o.pretty ? 2 : 0); }
  function parse(text) { return normalize(JSON.parse(text)); }

  /* ---------- semnătură opțională: HMAC-SHA256 cu cheie derivată din parolă (PBKDF2-SHA256) ---------- */
  /* octeții semnați: câmpurile de conținut; `lang` și `sig` nu intră (lang e informativ și poate lipsi din forma compat) */
  function sigBytes(env) { var e = normalize(env), c = {}; ['fff', 'type', 'title', 'payload', 'source', 'evidence', 'created', 'app'].forEach(function (k) { if (e[k] !== undefined) c[k] = e[k]; }); return enc.encode(canon(c)); }
  function macKey(secret, salt, it) {
    return subtle().importKey('raw', enc.encode(String(secret).normalize('NFC')), 'PBKDF2', false, ['deriveKey']).then(function (k) {
      return subtle().deriveKey({ name: 'PBKDF2', salt: salt, iterations: it, hash: 'SHA-256' }, k, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify']);
    });
  }
  /** Întoarce un plic nou, semnat. Semnătura dovedește integritatea față de cine știe parola; NU e identitate (nu e cheie publică). */
  function sign(env, secret, opt) {
    var e = normalize(env); delete e.sig;
    var it = (opt && opt.it) || SIG_IT, salt = root.crypto.getRandomValues(new Uint8Array(16));
    return macKey(secret, salt, it).then(function (k) { return subtle().sign('HMAC', k, sigBytes(e)); }).then(function (mac) {
      e.sig = { alg: 'HMAC-SHA256', kdf: 'PBKDF2-SHA256', it: it, salt: b64(salt), mac: b64(new Uint8Array(mac)) }; return e;
    });
  }
  /** Promise<'ok'|'bad'|'none'>. */
  function verify(env, secret) {
    var e = normalize(env);
    if (!e.sig) return Promise.resolve('none');
    if (e.sig.it < 1000 || e.sig.it > 5000000) return Promise.resolve('bad');
    return macKey(secret, unb64(e.sig.salt), e.sig.it).then(function (k) { return subtle().verify('HMAC', k, unb64(e.sig.mac), sigBytes(e)); }).then(function (ok) { return ok ? 'ok' : 'bad'; }, function () { return 'bad'; });
  }

  /* ---------- transport: pachet (link / QR) ---------- */
  function pipe(bytes, Ctor, mode) { return new Response(new Blob([bytes]).stream().pipeThrough(new Ctor(mode))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function pack(text) {
    var raw = enc.encode(text);
    if (typeof CompressionStream === 'undefined') return Promise.resolve('p.' + b64u(raw));
    return pipe(raw, CompressionStream, 'deflate-raw').then(function (z) { return z.length < raw.length ? 'z.' + b64u(z) : 'p.' + b64u(raw); });
  }
  function unpack(s) {
    var k = s.slice(0, 2), body = unb64u(s.slice(2));
    if (k === 'p.') return Promise.resolve(dec.decode(body));
    if (k === 'z.') { if (typeof DecompressionStream === 'undefined') return Promise.reject(err('nodecomp', 'fără DecompressionStream')); return pipe(body, DecompressionStream, 'deflate-raw').then(function (u) { return dec.decode(u); }); }
    return Promise.reject(err('format', 'format necunoscut'));
  }
  function toLink(env, targetUrl) {
    return pack(serialize(env)).then(function (p) {
      if (p.length > MAX_LINK) throw err('TOO_BIG', 'prea mare pentru link');
      return String(targetUrl).split('#')[0] + '#' + PREFIX + p;
    });
  }
  function fromHash(hash) {
    hash = String(hash || '').replace(/^#/, ''); var i = hash.indexOf(PREFIX);
    if (i < 0) return Promise.resolve(null);
    return unpack(hash.slice(i + PREFIX.length).split('&')[0]).then(parse);
  }
  /* ---------- fișier ---------- */
  function fileName(env) { return (String(env.title || env.type).replace(/[^\w\-]+/g, '_').slice(0, 40) || 'plic') + '.fff.json'; }
  function toFile(env) { return new File([serialize(env, { pretty: true })], fileName(normalize(env)), { type: 'application/json' }); }
  function download(env) {
    var f = toFile(env), a = root.document.createElement('a'), u = URL.createObjectURL(f);
    a.href = u; a.download = f.name; root.document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); return f.name;
  }
  function fromFile(file) { if (file.size > MAX_BYTES) return Promise.reject(err('big', 'fișier prea mare')); return file.text().then(parse); }
  /* ---------- clipboard ---------- */
  function toClipboard(env) { return root.navigator.clipboard.writeText(serialize(env)); }
  function fromClipboard() { return root.navigator.clipboard.readText().then(function (t) { return parse(t.trim()); }); }
  /* ---------- QR (necesită FFF.qr din kit) ---------- */
  function toQR(env) {
    var Q = root.FFF && root.FFF.qr; if (!Q) return Promise.reject(err('noqr', 'FFF.qr lipsește'));
    return pack(serialize(env)).then(function (p) {
      var text = PREFIX + p;
      if (enc.encode(text).length > Q.maxBytes) throw err('TOO_BIG', 'prea mare pentru QR');
      return { text: text, svg: Q.svg(text, { ecc: 'L', border: 2 }) };
    });
  }
  /** source = Blob/File imagine | HTMLImageElement | HTMLVideoElement (cu {camera:true}) */
  function fromQR(source, opt) {
    var Q = root.FFF && root.FFF.qr; if (!Q) return Promise.reject(err('noqr', 'FFF.qr lipsește'));
    return Q.scan(source, opt).then(function (t) { t = String(t).trim(); var i = t.indexOf(PREFIX); if (i < 0) throw err('format', 'codul nu conține un plic'); return unpack(t.slice(i + PREFIX.length)); }).then(parse);
  }
  /* ---------- BroadcastChannel (aceeași origine: alte file ale aceleiași aplicații) ---------- */
  function broadcast(name) {
    if (typeof BroadcastChannel === 'undefined') return null;
    var ch = new BroadcastChannel(name || CHANNEL), subs = [];
    ch.onmessage = function (m) { var e; try { e = normalize(m.data); } catch (x) { return; } subs.forEach(function (f) { f(e); }); };
    return { send: function (env) { ch.postMessage(JSON.parse(serialize(env))); }, onReceive: function (f) { subs.push(f); }, close: function () { ch.close(); } };
  }

  /* ---------- UI (fără dialoguri native; stiluri inline) ---------- */
  var doc = function () { return root.document; };
  function node(tag, css, txt) { var n = doc().createElement(tag); if (css) n.style.cssText = css; if (txt != null) n.textContent = txt; return n; }
  function toast(txt) {
    var d = node('div', 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;background:#222;color:#fff;padding:10px 16px;border-radius:8px;font:14px system-ui;box-shadow:0 4px 16px #0006;max-width:90vw', txt);
    d.setAttribute('role', 'status'); doc().body.appendChild(d); setTimeout(function () { d.remove(); }, 3500); return d;
  }
  function btn(txt, fn, css) { var b = node('button', 'min-height:44px;min-width:44px;padding:6px 14px;border-radius:6px;border:1px solid #fff8;background:#fff2;color:#fff;font:inherit;cursor:pointer;' + (css || ''), txt); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function describe(env) {
    var parts = [], e = env.evidence;
    parts.push(tr('ev') + ': ' + (e ? e.level + '/4 · ' + tr('ev' + e.level) + (e.note ? ' (' + e.note + ')' : '') : tr('noev')));
    if (env.source) parts.push(tr('source') + ': ' + (typeof env.source === 'string' ? env.source : (env.source.label || env.source.url || env.source.id || env.source.doi || '')));
    parts.push(env.sig ? tr('sigYes') : tr('sigNone'));
    return parts;
  }
  /** Bandă de confirmare: nimic nu se importă fără apăsarea „Importă”. onAccept(env) poate întoarce text sau arunca. */
  function banner(env, onAccept) {
    var d = node('div', 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483000;background:#1b2a3a;color:#fff;padding:12px 14px;border-radius:10px;font:15px system-ui;display:flex;gap:10px;flex-wrap:wrap;align-items:center;box-shadow:0 4px 20px #0007');
    d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-live', 'assertive');
    var m = node('div', 'flex:1 1 240px'); m.appendChild(node('div', 'font-weight:600', tr('incoming', { src: env.app || '?', title: String(env.title || env.type).slice(0, 80) })));
    var meta = node('div', 'font-size:13px;opacity:.85;margin-top:4px', describe(env).join(' · ')); m.appendChild(meta); d.appendChild(m);
    var ok = btn(tr('imp'), function () { d.remove(); Promise.resolve().then(function () { return onAccept(env); }).then(function (r) { toast(typeof r === 'string' && r ? r : tr('done')); }, function () { toast(tr('bad')); }); });
    d.appendChild(ok); d.appendChild(btn(tr('no'), function () { d.remove(); }));
    doc().body.appendChild(d); try { ok.focus(); } catch (e) { /* fără focus */ } return d;
  }
  function menu(anchor, items) {
    var box = node('div', 'position:absolute;z-index:2147483000;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:8px;padding:6px;min-width:220px;max-width:92vw;box-shadow:0 4px 16px #0004;font:14px system-ui');
    box.setAttribute('role', 'menu');
    items.forEach(function (it) {
      if (it.note) { box.appendChild(node('div', 'padding:6px 8px;opacity:.8', it.note)); return; }
      var b = node('button', 'display:block;width:100%;text-align:left;min-height:44px;padding:6px 8px;border:0;background:none;color:inherit;cursor:pointer;font:inherit', it.text);
      b.type = 'button'; b.setAttribute('role', 'menuitem'); b.addEventListener('click', function () { box.remove(); it.run(); }); box.appendChild(b);
    });
    var r = anchor.getBoundingClientRect();
    box.style.left = Math.max(4, r.left + root.scrollX) + 'px'; box.style.top = (r.bottom + root.scrollY + 4) + 'px';
    doc().body.appendChild(box);
    var first = box.querySelector('button'); if (first) try { first.focus(); } catch (e) { /* fără focus */ }
    box.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { box.remove(); try { anchor.focus(); } catch (e) { /* fără focus */ } } });
    setTimeout(function () { doc().addEventListener('click', function f(ev) { if (!box.contains(ev.target)) { box.remove(); doc().removeEventListener('click', f); } }); });
    return box;
  }
  function qrDialog(env) {
    return toQR(env).then(function (q) {
      var ov = node('div', 'position:fixed;inset:0;z-index:2147483001;background:#000a;display:flex;align-items:center;justify-content:center;padding:12px');
      var box = node('div', 'background:#fff;color:#111;border-radius:12px;padding:16px;max-width:min(92vw,420px);text-align:center;font:15px system-ui');
      box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', tr('qr'));
      box.appendChild(node('p', 'margin:0 0 8px', tr('qrTitle')));
      var holder = node('div', 'width:100%'); holder.innerHTML = q.svg; var sv = holder.querySelector('svg'); if (sv) { sv.style.width = '100%'; sv.style.height = 'auto'; sv.setAttribute('role', 'img'); sv.setAttribute('aria-label', tr('qr')); }
      box.appendChild(holder);
      var c = btn(tr('close'), function () { ov.remove(); }, 'margin-top:10px;background:#1b2a3a'); box.appendChild(c); ov.appendChild(box);
      ov.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') ov.remove(); }); doc().body.appendChild(ov); try { c.focus(); } catch (e) { /* fără focus */ }
    }, function (e) { toast(e && e.code === 'TOO_BIG' ? tr('qrBig') : tr('bad')); });
  }
  function openLink(url) { var a = node('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; doc().body.appendChild(a); a.click(); a.remove(); }
  /** Meniul „Trimite către…”. o = {env, registry:[{slug,name,url,accepts}], selfSlug, anchor, channel} */
  function sendMenu(o) {
    var env = normalize(o.env), reg = (o.registry || api.registry || []);
    var targets = env.type === 'keys/vault' ? [] : reg.filter(function (a) { return a.slug !== o.selfSlug && (a.accepts || []).indexOf(env.type) >= 0; });   // cheile nu circulă prin link (fragmentul rămâne în istoric)
    var items = [];
    if (!targets.length && env.type !== 'keys/vault') items.push({ note: tr('none') });
    targets.forEach(function (a) { items.push({ text: tr('toApp', { name: a.name }), run: function () { toLink(env, a.url).then(openLink, function (e) { if (e && e.code === 'TOO_BIG') download(env); else toast(tr('bad')); }); } }); });
    items.push({ text: tr('file'), run: function () { download(env); } });
    items.push({ text: tr('copy'), run: function () { toClipboard(env).then(function () { toast(tr('copied')); }, function () { toast(tr('bad')); }); } });
    if (root.FFF && root.FFF.qr) items.push({ text: tr('qr'), run: function () { qrDialog(env); } });
    if (typeof BroadcastChannel !== 'undefined') items.push({ text: tr('tabs'), run: function () { var b = broadcast(o.channel); if (b) { b.send(env); setTimeout(function () { b.close(); }, 500); toast(tr('sent')); } } });
    return menu(o.anchor, items);
  }
  /** Butonul „Trimite către…”. o = {slug, registry, getEnv:()=>env|Promise<env>|null, className, style, text, channel} */
  function sendButton(o) {
    var b = doc().createElement('button'); b.type = 'button'; b.textContent = o.text || tr('send'); b.setAttribute('data-fff-send', '1');
    if (o.className) b.className = o.className; if (o.style) b.style.cssText = o.style;
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      Promise.resolve(o.getEnv()).then(function (env) { if (env) sendMenu({ env: env, registry: o.registry, selfSlug: o.slug, anchor: b, channel: o.channel }); }, function () { toast(tr('bad')); });
    });
    return b;
  }
  function pickFile(accept) {
    return new Promise(function (res) { var i = node('input'); i.type = 'file'; i.accept = accept || '.json,application/json'; i.style.display = 'none'; i.addEventListener('change', function () { var f = i.files && i.files[0]; i.remove(); res(f || null); }); doc().body.appendChild(i); i.click(); });
  }
  /** Primire: link (#fff=), fișiere trase pe pagină (doar dacă FFF.bridge nu o face deja), alte file (BroadcastChannel).
   *  o = {accepts:[tipuri], onReceive(env), viaBridge:true|false (implicit: true dacă există FFF.bridge — atunci primirea din link/drop o face bridge)}. */
  function mount(o) {
    var accepts = o.accepts || [], hasBridge = !!(root.FFF && root.FFF.bridge && root.FFF.bridge.mount) && o.viaBridge !== false;
    function handle(env) {
      if (!env) return;
      if (accepts.length && accepts.indexOf(env.type) < 0) { toast(tr('bad')); return; }
      banner(env, o.onReceive);
    }
    function go() {
      if (!hasBridge && o.link !== false) {
        fromHash(root.location.hash).then(function (e) { if (e && root.history && root.history.replaceState) root.history.replaceState(null, '', root.location.pathname + root.location.search); handle(e); }, function () { toast(tr('bad')); });
        doc().body.addEventListener('dragover', function (ev) { ev.preventDefault(); });
        doc().body.addEventListener('drop', function (ev) {
          var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
          if (!f || !/\.json$/i.test(f.name)) return; ev.preventDefault(); fromFile(f).then(handle, function () { toast(tr('bad')); });
        });
      }
      var bc = broadcast(o.channel); if (bc) bc.onReceive(handle);
    }
    if (doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', go); else go();
    return { handle: handle };
  }
  /** Butonul „Primește…”: fișier / clipboard / imagine cu cod QR. o = {accepts, onReceive, className, style, text} */
  function importButton(o) {
    var b = doc().createElement('button'); b.type = 'button'; b.textContent = o.text || tr('recv'); b.setAttribute('data-fff-recv', '1');
    if (o.className) b.className = o.className; if (o.style) b.style.cssText = o.style;
    function got(p) { p.then(function (env) { if (env) { if ((o.accepts || []).length && o.accepts.indexOf(env.type) < 0) toast(tr('bad')); else banner(env, o.onReceive); } }, function () { toast(tr('bad')); }); }
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var items = [{ text: tr('recvFile'), run: function () { got(pickFile().then(function (f) { return f && fromFile(f); })); } }, { text: tr('recvPaste'), run: function () { got(fromClipboard()); } }];
      if (root.FFF && root.FFF.qr) items.push({ text: tr('recvScan'), run: function () { got(pickFile('image/*').then(function (f) { return f && fromQR(f); })); } });
      menu(b, items);
    });
    return b;
  }

  /** Capturează fișierul pe care aplicația l-ar descărca la apăsarea unui buton propriu de export (fără descărcare reală).
   *  trigger = funcție care declanșează exportul aplicației; întoarce Promise<{text, name, type}>. Folosit de adaptoarele pentru aplicații cu cod închis într-un IIFE. */
  function capture(trigger) {
    return new Promise(function (res, rej) {
      var A = root.HTMLAnchorElement && root.HTMLAnchorElement.prototype, U = root.URL;
      if (!A || !U) { rej(err('env', 'fără DOM')); return; }
      var oc = U.createObjectURL, ac = A.click, blobs = [], name = '';
      function restore() { U.createObjectURL = oc; A.click = ac; }
      U.createObjectURL = function (b) { blobs.push(b); return oc.call(U, b); };
      A.click = function () { if (this.hasAttribute('download') && /^blob:/.test(this.href)) { name = this.getAttribute('download') || ''; return; } return ac.apply(this, arguments); };
      try { trigger(); } catch (e) { restore(); rej(e); return; }
      setTimeout(function () {
        restore(); var b = blobs[blobs.length - 1];
        if (!b) { rej(err('nocapture', 'aplicația nu a produs niciun fișier')); return; }
        b.text().then(function (t) { res({ text: t.replace(/^\uFEFF/, ''), name: name, type: b.type || '' }); }, rej);
      }, 60);
    });
  }
  var api = { registry: [], capture: capture, VERSION: VERSION, COMPAT: COMPAT, TYPES: TYPES, MAX_BYTES: MAX_BYTES, MAX_LINK: MAX_LINK, I18N: I18N, tr: tr, create: create, validate: validate, normalize: normalize, toCompat: toCompat,
    serialize: serialize, parse: parse, canonical: canon, sign: sign, verify: verify, pack: pack, unpack: unpack, toLink: toLink, fromHash: fromHash, toFile: toFile, download: download,
    fromFile: fromFile, toClipboard: toClipboard, fromClipboard: fromClipboard, toQR: toQR, fromQR: fromQR, broadcast: broadcast, banner: banner, menu: menu, toast: toast,
    sendMenu: sendMenu, sendButton: sendButton, importButton: importButton, mount: mount, pickFile: pickFile };
  return api;
});
