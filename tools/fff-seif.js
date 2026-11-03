/* fff-seif · seif comun de chei API — criptat cu parolă (PBKDF2-SHA256 + AES-256-GCM), format KeyVault/1.
 * Sursa canonică: tools/fff-seif.js (injectat de tools/inject-shared.mjs; nu se copiază de mână). Rulează și în Node (module.exports).
 *  • nucleu: seal / open / toEnvelope / fromEnvelope / mapProviders — formatul e IDENTIC cu KeyVault 1.0.0 din Nexus, AI-Liber și ARENA
 *    ({kv:1, kdf:'PBKDF2-SHA256', it, s, iv, ct}, AAD „KeyVault/1”, ≥ 600 000 de iterații), deci un seif creat în VaultCrypt poate fi deschis
 *    și de acele aplicații cu propriul lor KeyVault;
 *  • panou (VaultCrypt): creează/deblochează seiful, editează cheile, îl trimite ca plic `keys/vault` (fișier, clipboard, QR, alte file); nimic în clar pe disc;
 *  • mount (Nexus, AI-Liber, ARENA): „Importă din seiful comun” — cere parola, deschide plicul, pune cheile în KeyVault-ul aplicației (nu în clar).
 * Limite oneste: componentă NEauditată de un terț; parola pierdută = chei pierdute; cheile deblocate stau în memoria paginii cât e deschisă. */
(function (root, factory) {
  var S = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = S;
  if (root) { try { var F = root.FFF || {}; root.FFF = F; if (root.FFF === F) F.seif = S; root.FFFSeif = S; } catch (e) { /* fără FFF: inert */ } }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var ITER = 600000, ITER_MAX = 5000000, PW_MIN = 12, AAD = new TextEncoder().encode('KeyVault/1'), enc = new TextEncoder(), dec = new TextDecoder();
  var KNOWN = ['anthropic', 'openai', 'google', 'groq', 'mistral', 'perplexity', 'openrouter', 'pollinations', 'custom'];
  var I18N = {
 "ro": {
  "title": "Seif comun de chei API",
  "intro": "Un singur loc pentru cheile API ale furnizorilor de IA, criptat cu o parolă (AES-256-GCM, cheie derivată prin PBKDF2-SHA256, 600 000 de iterații). Nu se păstrează nicio cheie în clar; Nexus, AI Liber și ARENA îl pot citi prin plic.",
  "stNone": "Nu există încă un seif.",
  "stOpen": "Seif deblocat: cheile sunt în memoria paginii și criptate pe disc.",
  "stLocked": "Seif blocat: introdu parola.",
  "pw": "Parolă (cel puțin 12 caractere)",
  "pw2": "Repetă parola",
  "create": "Creează seiful",
  "created": "Seif creat.",
  "mism": "Parolele nu coincid.",
  "short": "Parola trebuie să aibă cel puțin {n} caractere.",
  "wrong": "Parolă greșită sau date modificate.",
  "fail": "Operația a eșuat.",
  "unlock": "Deblochează",
  "opened": "Seif deblocat.",
  "delVault": "Șterge seiful",
  "deleted": "Seif șters.",
  "empty": "Seiful nu are chei încă.",
  "remove": "Șterge",
  "saved": "Salvat (criptat).",
  "provider": "Furnizor (ex. anthropic)",
  "key": "Cheie API",
  "add": "Adaugă / înlocuiește",
  "badId": "Furnizor invalid (litere mici, cifre, - _ .) sau cheie goală.",
  "send": "Trimite către…",
  "lock": "Blochează",
  "locked": "Seif blocat.",
  "impEnv": "Importă plic de seif…",
  "pwOf": "Parola seifului din plic",
  "cancel": "Anulează",
  "imported": "{n} chei importate.",
  "none": "Plicul nu conține chei pentru această aplicație.",
  "work": "Se lucrează…",
  "warn": "Componentă neauditată de un terț. Parola pierdută = chei pierdute. Plicul conține doar blobul criptat; parola nu e trimisă niciodată. Cheile deblocate stau în memoria paginii cât timp e deschisă.",
  "importBtn": "Importă din seiful comun",
  "importHint": "Seiful comun (VaultCrypt): alege plicul și introdu parola seifului; cheile ajung în seiful acestei aplicații, nu în clar."
 },
 "en": {
  "title": "Shared API key vault",
  "intro": "One place for the API keys of AI providers, encrypted with a password (AES-256-GCM, key derived with PBKDF2-SHA256, 600,000 iterations). No key is kept in plain text; Nexus, AI Liber and ARENA can read it through an envelope.",
  "stNone": "There is no vault yet.",
  "stOpen": "Vault unlocked: keys are in the page memory and encrypted on disk.",
  "stLocked": "Vault locked: enter the password.",
  "pw": "Password (at least 12 characters)",
  "pw2": "Repeat password",
  "create": "Create the vault",
  "created": "Vault created.",
  "mism": "The passwords do not match.",
  "short": "The password must be at least {n} characters.",
  "wrong": "Wrong password or modified data.",
  "fail": "The operation failed.",
  "unlock": "Unlock",
  "opened": "Vault unlocked.",
  "delVault": "Delete the vault",
  "deleted": "Vault deleted.",
  "empty": "The vault has no keys yet.",
  "remove": "Remove",
  "saved": "Saved (encrypted).",
  "provider": "Provider (e.g. anthropic)",
  "key": "API key",
  "add": "Add / replace",
  "badId": "Invalid provider (lowercase letters, digits, - _ .) or empty key.",
  "send": "Send to…",
  "lock": "Lock",
  "locked": "Vault locked.",
  "impEnv": "Import a vault envelope…",
  "pwOf": "Password of the vault in the envelope",
  "cancel": "Cancel",
  "imported": "{n} keys imported.",
  "none": "The envelope has no keys for this app.",
  "work": "Working…",
  "warn": "Component not audited by a third party. A lost password means lost keys. The envelope carries only the encrypted blob; the password is never sent. Unlocked keys stay in the page memory while it is open.",
  "importBtn": "Import from the shared vault",
  "importHint": "Shared vault (VaultCrypt): choose the envelope and enter the vault password; the keys go into this app’s own vault, not in plain text."
 },
 "fr": {
  "title": "Coffre commun de clés API",
  "intro": "Un seul endroit pour les clés API des fournisseurs d’IA, chiffré par mot de passe (AES-256-GCM, clé dérivée par PBKDF2-SHA256, 600 000 itérations). Aucune clé n’est conservée en clair ; Nexus, AI Liber et ARENA peuvent le lire via une enveloppe.",
  "stNone": "Il n’y a pas encore de coffre.",
  "stOpen": "Coffre déverrouillé : les clés sont en mémoire de la page et chiffrées sur le disque.",
  "stLocked": "Coffre verrouillé : saisissez le mot de passe.",
  "pw": "Mot de passe (12 caractères au moins)",
  "pw2": "Répétez le mot de passe",
  "create": "Créer le coffre",
  "created": "Coffre créé.",
  "mism": "Les mots de passe ne correspondent pas.",
  "short": "Le mot de passe doit comporter au moins {n} caractères.",
  "wrong": "Mot de passe erroné ou données modifiées.",
  "fail": "L’opération a échoué.",
  "unlock": "Déverrouiller",
  "opened": "Coffre déverrouillé.",
  "delVault": "Supprimer le coffre",
  "deleted": "Coffre supprimé.",
  "empty": "Le coffre ne contient pas encore de clés.",
  "remove": "Retirer",
  "saved": "Enregistré (chiffré).",
  "provider": "Fournisseur (ex. anthropic)",
  "key": "Clé API",
  "add": "Ajouter / remplacer",
  "badId": "Fournisseur invalide (minuscules, chiffres, - _ .) ou clé vide.",
  "send": "Envoyer vers…",
  "lock": "Verrouiller",
  "locked": "Coffre verrouillé.",
  "impEnv": "Importer une enveloppe de coffre…",
  "pwOf": "Mot de passe du coffre contenu dans l’enveloppe",
  "cancel": "Annuler",
  "imported": "{n} clés importées.",
  "none": "L’enveloppe ne contient pas de clés pour cette application.",
  "work": "En cours…",
  "warn": "Composant non audité par un tiers. Mot de passe perdu = clés perdues. L’enveloppe ne contient que le blob chiffré ; le mot de passe n’est jamais envoyé. Les clés déverrouillées restent en mémoire tant que la page est ouverte.",
  "importBtn": "Importer depuis le coffre commun",
  "importHint": "Coffre commun (VaultCrypt) : choisissez l’enveloppe et saisissez le mot de passe du coffre ; les clés vont dans le coffre propre de cette application, pas en clair."
 },
 "it": {
  "title": "Cassaforte comune di chiavi API",
  "intro": "Un solo posto per le chiavi API dei fornitori di IA, cifrato con una password (AES-256-GCM, chiave derivata con PBKDF2-SHA256, 600.000 iterazioni). Nessuna chiave resta in chiaro; Nexus, AI Liber e ARENA possono leggerla tramite una busta.",
  "stNone": "Non esiste ancora una cassaforte.",
  "stOpen": "Cassaforte sbloccata: le chiavi sono nella memoria della pagina e cifrate su disco.",
  "stLocked": "Cassaforte bloccata: inserisci la password.",
  "pw": "Password (almeno 12 caratteri)",
  "pw2": "Ripeti la password",
  "create": "Crea la cassaforte",
  "created": "Cassaforte creata.",
  "mism": "Le password non coincidono.",
  "short": "La password deve avere almeno {n} caratteri.",
  "wrong": "Password errata o dati modificati.",
  "fail": "Operazione non riuscita.",
  "unlock": "Sblocca",
  "opened": "Cassaforte sbloccata.",
  "delVault": "Elimina la cassaforte",
  "deleted": "Cassaforte eliminata.",
  "empty": "La cassaforte non ha ancora chiavi.",
  "remove": "Rimuovi",
  "saved": "Salvato (cifrato).",
  "provider": "Fornitore (es. anthropic)",
  "key": "Chiave API",
  "add": "Aggiungi / sostituisci",
  "badId": "Fornitore non valido (minuscole, cifre, - _ .) o chiave vuota.",
  "send": "Invia a…",
  "lock": "Blocca",
  "locked": "Cassaforte bloccata.",
  "impEnv": "Importa una busta di cassaforte…",
  "pwOf": "Password della cassaforte nella busta",
  "cancel": "Annulla",
  "imported": "{n} chiavi importate.",
  "none": "La busta non contiene chiavi per questa app.",
  "work": "Elaborazione…",
  "warn": "Componente non verificato da terzi. Password persa = chiavi perse. La busta contiene solo il blob cifrato; la password non viene mai inviata. Le chiavi sbloccate restano nella memoria della pagina finché è aperta.",
  "importBtn": "Importa dalla cassaforte comune",
  "importHint": "Cassaforte comune (VaultCrypt): scegli la busta e inserisci la password della cassaforte; le chiavi vanno nella cassaforte propria di questa app, non in chiaro."
 },
 "es": {
  "title": "Caja fuerte común de claves API",
  "intro": "Un solo lugar para las claves API de los proveedores de IA, cifrado con una contraseña (AES-256-GCM, clave derivada con PBKDF2-SHA256, 600 000 iteraciones). Ninguna clave se guarda en claro; Nexus, AI Liber y ARENA pueden leerla mediante un sobre.",
  "stNone": "Todavía no hay caja fuerte.",
  "stOpen": "Caja desbloqueada: las claves están en la memoria de la página y cifradas en disco.",
  "stLocked": "Caja bloqueada: introduce la contraseña.",
  "pw": "Contraseña (al menos 12 caracteres)",
  "pw2": "Repite la contraseña",
  "create": "Crear la caja fuerte",
  "created": "Caja creada.",
  "mism": "Las contraseñas no coinciden.",
  "short": "La contraseña debe tener al menos {n} caracteres.",
  "wrong": "Contraseña incorrecta o datos modificados.",
  "fail": "La operación ha fallado.",
  "unlock": "Desbloquear",
  "opened": "Caja desbloqueada.",
  "delVault": "Eliminar la caja fuerte",
  "deleted": "Caja eliminada.",
  "empty": "La caja aún no tiene claves.",
  "remove": "Quitar",
  "saved": "Guardado (cifrado).",
  "provider": "Proveedor (p. ej. anthropic)",
  "key": "Clave API",
  "add": "Añadir / reemplazar",
  "badId": "Proveedor no válido (minúsculas, dígitos, - _ .) o clave vacía.",
  "send": "Enviar a…",
  "lock": "Bloquear",
  "locked": "Caja bloqueada.",
  "impEnv": "Importar un sobre de caja fuerte…",
  "pwOf": "Contraseña de la caja del sobre",
  "cancel": "Cancelar",
  "imported": "{n} claves importadas.",
  "none": "El sobre no contiene claves para esta aplicación.",
  "work": "Trabajando…",
  "warn": "Componente no auditado por terceros. Contraseña perdida = claves perdidas. El sobre solo lleva el bloque cifrado; la contraseña nunca se envía. Las claves desbloqueadas permanecen en la memoria de la página mientras está abierta.",
  "importBtn": "Importar desde la caja común",
  "importHint": "Caja común (VaultCrypt): elige el sobre e introduce la contraseña de la caja; las claves van a la caja propia de esta aplicación, no en claro."
 },
 "pt": {
  "title": "Cofre comum de chaves API",
  "intro": "Um só lugar para as chaves API dos fornecedores de IA, cifrado com palavra-passe (AES-256-GCM, chave derivada com PBKDF2-SHA256, 600 000 iterações). Nenhuma chave é guardada em claro; Nexus, AI Liber e ARENA podem lê-lo através de um envelope.",
  "stNone": "Ainda não existe um cofre.",
  "stOpen": "Cofre desbloqueado: as chaves estão na memória da página e cifradas no disco.",
  "stLocked": "Cofre bloqueado: introduza a palavra-passe.",
  "pw": "Palavra-passe (pelo menos 12 caracteres)",
  "pw2": "Repita a palavra-passe",
  "create": "Criar o cofre",
  "created": "Cofre criado.",
  "mism": "As palavras-passe não coincidem.",
  "short": "A palavra-passe deve ter pelo menos {n} caracteres.",
  "wrong": "Palavra-passe errada ou dados modificados.",
  "fail": "A operação falhou.",
  "unlock": "Desbloquear",
  "opened": "Cofre desbloqueado.",
  "delVault": "Eliminar o cofre",
  "deleted": "Cofre eliminado.",
  "empty": "O cofre ainda não tem chaves.",
  "remove": "Remover",
  "saved": "Guardado (cifrado).",
  "provider": "Fornecedor (ex. anthropic)",
  "key": "Chave API",
  "add": "Adicionar / substituir",
  "badId": "Fornecedor inválido (minúsculas, dígitos, - _ .) ou chave vazia.",
  "send": "Enviar para…",
  "lock": "Bloquear",
  "locked": "Cofre bloqueado.",
  "impEnv": "Importar um envelope de cofre…",
  "pwOf": "Palavra-passe do cofre no envelope",
  "cancel": "Cancelar",
  "imported": "{n} chaves importadas.",
  "none": "O envelope não contém chaves para esta aplicação.",
  "work": "A processar…",
  "warn": "Componente não auditado por terceiros. Palavra-passe perdida = chaves perdidas. O envelope leva apenas o bloco cifrado; a palavra-passe nunca é enviada. As chaves desbloqueadas ficam na memória da página enquanto estiver aberta.",
  "importBtn": "Importar do cofre comum",
  "importHint": "Cofre comum (VaultCrypt): escolha o envelope e introduza a palavra-passe do cofre; as chaves vão para o cofre próprio desta aplicação, não em claro."
 },
 "de": {
  "title": "Gemeinsamer Tresor für API-Schlüssel",
  "intro": "Ein einziger Ort für die API-Schlüssel der KI-Anbieter, mit Passwort verschlüsselt (AES-256-GCM, Schlüssel per PBKDF2-SHA256 abgeleitet, 600.000 Iterationen). Kein Schlüssel liegt im Klartext; Nexus, AI Liber und ARENA können ihn über einen Umschlag lesen.",
  "stNone": "Es gibt noch keinen Tresor.",
  "stOpen": "Tresor entsperrt: Die Schlüssel liegen im Seitenspeicher und verschlüsselt auf der Platte.",
  "stLocked": "Tresor gesperrt: Passwort eingeben.",
  "pw": "Passwort (mindestens 12 Zeichen)",
  "pw2": "Passwort wiederholen",
  "create": "Tresor anlegen",
  "created": "Tresor angelegt.",
  "mism": "Die Passwörter stimmen nicht überein.",
  "short": "Das Passwort muss mindestens {n} Zeichen haben.",
  "wrong": "Falsches Passwort oder veränderte Daten.",
  "fail": "Der Vorgang ist fehlgeschlagen.",
  "unlock": "Entsperren",
  "opened": "Tresor entsperrt.",
  "delVault": "Tresor löschen",
  "deleted": "Tresor gelöscht.",
  "empty": "Der Tresor enthält noch keine Schlüssel.",
  "remove": "Entfernen",
  "saved": "Gespeichert (verschlüsselt).",
  "provider": "Anbieter (z. B. anthropic)",
  "key": "API-Schlüssel",
  "add": "Hinzufügen / ersetzen",
  "badId": "Ungültiger Anbieter (Kleinbuchstaben, Ziffern, - _ .) oder leerer Schlüssel.",
  "send": "Senden an…",
  "lock": "Sperren",
  "locked": "Tresor gesperrt.",
  "impEnv": "Tresor-Umschlag importieren…",
  "pwOf": "Passwort des Tresors im Umschlag",
  "cancel": "Abbrechen",
  "imported": "{n} Schlüssel importiert.",
  "none": "Der Umschlag enthält keine Schlüssel für diese App.",
  "work": "Wird verarbeitet…",
  "warn": "Komponente nicht von Dritten geprüft. Passwort verloren = Schlüssel verloren. Der Umschlag enthält nur den verschlüsselten Block; das Passwort wird nie gesendet. Entsperrte Schlüssel bleiben im Seitenspeicher, solange die Seite offen ist.",
  "importBtn": "Aus dem gemeinsamen Tresor importieren",
  "importHint": "Gemeinsamer Tresor (VaultCrypt): Umschlag wählen und Tresor-Passwort eingeben; die Schlüssel landen im eigenen Tresor dieser App, nicht im Klartext."
 },
 "hu": {
  "title": "Közös API-kulcs-széf",
  "intro": "Egyetlen hely az AI-szolgáltatók API-kulcsainak, jelszóval titkosítva (AES-256-GCM, PBKDF2-SHA256-tal származtatott kulcs, 600 000 iteráció). Egyetlen kulcs sem marad nyílt szövegben; a Nexus, az AI Liber és az ARENA borítékon keresztül olvashatja.",
  "stNone": "Még nincs széf.",
  "stOpen": "A széf feloldva: a kulcsok az oldal memóriájában vannak, lemezen titkosítva.",
  "stLocked": "A széf zárolva: add meg a jelszót.",
  "pw": "Jelszó (legalább 12 karakter)",
  "pw2": "Jelszó újra",
  "create": "Széf létrehozása",
  "created": "A széf létrejött.",
  "mism": "A jelszavak nem egyeznek.",
  "short": "A jelszó legalább {n} karakter legyen.",
  "wrong": "Hibás jelszó vagy módosított adatok.",
  "fail": "A művelet nem sikerült.",
  "unlock": "Feloldás",
  "opened": "A széf feloldva.",
  "delVault": "Széf törlése",
  "deleted": "A széf törölve.",
  "empty": "A széfben még nincs kulcs.",
  "remove": "Eltávolítás",
  "saved": "Mentve (titkosítva).",
  "provider": "Szolgáltató (pl. anthropic)",
  "key": "API-kulcs",
  "add": "Hozzáadás / csere",
  "badId": "Érvénytelen szolgáltató (kisbetű, szám, - _ .) vagy üres kulcs.",
  "send": "Küldés ide…",
  "lock": "Zárolás",
  "locked": "A széf zárolva.",
  "impEnv": "Széf-boríték importálása…",
  "pwOf": "A borítékban lévő széf jelszava",
  "cancel": "Mégse",
  "imported": "{n} kulcs importálva.",
  "none": "A boríték nem tartalmaz kulcsot ehhez az alkalmazáshoz.",
  "work": "Folyamatban…",
  "warn": "Harmadik fél által nem auditált komponens. Elvesztett jelszó = elvesztett kulcsok. A boríték csak a titkosított blokkot tartalmazza; a jelszót soha nem küldjük el. A feloldott kulcsok az oldal memóriájában maradnak, amíg nyitva van.",
  "importBtn": "Importálás a közös széfből",
  "importHint": "Közös széf (VaultCrypt): válaszd ki a borítékot és add meg a széf jelszavát; a kulcsok az alkalmazás saját széfjébe kerülnek, nem nyílt szövegben."
 }
};

  function lang() { var l = ''; try { l = root.FFF && root.FFF.lang ? root.FFF.lang() : ''; } catch (e) { /* fără core */ } if (!l) try { l = root.document.documentElement.lang; } catch (e) { /* fără document */ } l = String(l || 'en').slice(0, 2).toLowerCase(); return I18N[l] ? l : 'en'; }
  function tr(k, v) { var s = (I18N[lang()] || I18N.en)[k] || I18N.en[k] || k; if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]); return s; }
  function b64(u) { var s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function subtle() { var c = root.crypto; if (!c || !c.subtle) throw new Error('WebCrypto'); return c.subtle; }
  function derive(pw, salt, it) {
    return subtle().importKey('raw', enc.encode(String(pw)), 'PBKDF2', false, ['deriveKey']).then(function (k) {
      return subtle().deriveKey({ name: 'PBKDF2', salt: salt, iterations: it, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function clean(o) { return JSON.parse(JSON.stringify(o), function (k, v) { return (k === '__proto__' || k === 'constructor' || k === 'prototype') ? undefined : v; }); }

  /** map = {furnizor: cheie} → blob KeyVault/1 (text JSON). opt.it doar pentru teste (≥ 1000); implicit 600 000. */
  function seal(map, password, opt) {
    if (typeof password !== 'string' || password.length < PW_MIN) return Promise.reject(new Error('fff-seif: parola are sub ' + PW_MIN + ' caractere'));
    var it = (opt && opt.it) || ITER; if (it < 1000) return Promise.reject(new Error('fff-seif: iterații prea puține'));
    var salt = root.crypto.getRandomValues(new Uint8Array(16)), iv = root.crypto.getRandomValues(new Uint8Array(12));
    return derive(password, salt, it).then(function (k) { return subtle().encrypt({ name: 'AES-GCM', iv: iv, additionalData: AAD }, k, enc.encode(JSON.stringify(map || {}))); }).then(function (ct) {
      return JSON.stringify({ kv: 1, kdf: 'PBKDF2-SHA256', it: it, s: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) });
    });
  }
  function parseBlob(blob, minIt) {
    var o; try { o = JSON.parse(blob); } catch (e) { throw new Error('fff-seif: format'); }
    if (!o || o.kv !== 1 || typeof o.it !== 'number' || o.it < (minIt || ITER) || o.it > ITER_MAX || !o.s || !o.iv || !o.ct) throw new Error('fff-seif: format');
    return o;
  }
  /** Promise<map>; aruncă la parolă greșită, blob modificat sau format necunoscut. opt.minIt doar pentru teste. */
  function open(blob, password, opt) {
    var o; try { o = parseBlob(blob, opt && opt.minIt); } catch (e) { return Promise.reject(e); }
    return derive(password, unb64(o.s), o.it).then(function (k) { return subtle().decrypt({ name: 'AES-GCM', iv: unb64(o.iv), additionalData: AAD }, k, unb64(o.ct)); })
      .then(function (pt) { var m = clean(JSON.parse(dec.decode(pt))); if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error('fff-seif: conținut'); return m; });
  }
  /** Plic keys/vault: DOAR blobul criptat; fără chei în clar. */
  function toEnvelope(blob, o) {
    var E = root.FFF && root.FFF.envelope; if (!E) throw new Error('fff-seif: lipsește FFF.envelope');
    parseBlob(blob, 1000);
    return E.create({ type: 'keys/vault', title: (o && o.title) || tr('title'), payload: blob, app: (o && o.app) || (root.FFF && root.FFF.app && root.FFF.app.slug) || '', source: { label: tr('title') } });
  }
  function fromEnvelope(env) {
    var E = root.FFF && root.FFF.envelope, e = E ? E.normalize(env) : env;
    if (!e || e.type !== 'keys/vault' || typeof e.payload !== 'string') throw new Error('fff-seif: nu e plic keys/vault');
    parseBlob(e.payload, 1000); return e.payload;
  }
  /** Păstrează doar intrările cu cheie nevidă pentru furnizorii cunoscuți (listă sau funcție). */
  function mapProviders(map, known) {
    var out = {}, ok = typeof known === 'function' ? known : function (id) { return known.indexOf(id) >= 0; };
    Object.keys(map || {}).forEach(function (id) { if (typeof map[id] === 'string' && map[id] && ok(id)) out[id] = map[id]; });
    return out;
  }

  /* ---------- UI comună ---------- */
  var doc = function () { return root.document; };
  function node(tag, cls, txt) { var n = doc().createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function toast(t) { var E = root.FFF && root.FFF.envelope; if (E) E.toast(t); }

  /* ---------- consumator (Nexus, AI-Liber, ARENA): importă din seiful comun în KeyVault-ul aplicației ----------
   * o = {KV, vault, ad, known:[id…]|fn, toApp(map)->map în spațiul aplicației (opțional), hostId:'kv-host'}.
   * Aplicarea nu scrie niciodată chei în clar: dacă aplicația nu are încă seif, îl creează cu parola seifului comun (flux identic cu „Activează protecția”). */
  var ctx = null, mounted = false;
  function applyToApp(blobEnv) {
    var c = ctx, KV = c.KV, vault = c.vault, ad = c.ad, blob = fromEnvelope(blobEnv), opened = null;
    return KV.ask('unlock', function (pw) { return open(blob, pw).then(function (m) { opened = m; }); }).then(function (pw) {
      if (pw === null || !opened) return tr('cancel');
      var shared = mapProviders(opened, c.known || KNOWN), app = c.toApp ? c.toApp(shared) : shared, n = Object.keys(app).length;
      if (!n) return tr('none');
      var step;
      if (!vault.exists()) {
        step = Promise.resolve(ad.collect()).then(function (cur) { return vault.setup(pw, Object.assign({}, cur, app)); }).then(function () { return ad.drop(); }).then(function () { return ad.load(Object.assign({}, vault.data)); }).then(function () { return ad.clear(); });
      } else {
        step = (vault.unlocked() ? Promise.resolve(true) : KV.unlock(vault, ad)).then(function (ok) {
          if (!ok) throw new Error('cancel');
          vault.data = Object.assign({}, vault.data, app);
          return vault.save().then(function () { return ad.drop(); }).then(function () { return ad.load(Object.assign({}, vault.data)); });
        });
      }
      return step.then(function () { return ad.changed && ad.changed(); }).then(function () { return tr('imported', { n: n }); });
    });
  }
  function ensureButton() {
    var host = doc().getElementById((ctx && ctx.hostId) || 'kv-host'); if (!host || !host.parentNode) return;
    if (host.parentNode.querySelector('.fff-seif-box')) return;
    var E = root.FFF.envelope, box = node('div', 'fff-seif-box'); box.style.cssText = 'margin-top:8px;font:inherit';
    var p = node('p', null, tr('importHint')); p.style.cssText = 'margin:0 0 6px;font-size:.85em;opacity:.85'; box.appendChild(p);
    box.appendChild(E.importButton({ accepts: ['keys/vault'], onReceive: applyToApp, text: tr('importBtn'), className: 'kv-b', style: 'min-height:44px' }));
    host.insertAdjacentElement('afterend', box);
  }
  function mount(o) {
    ctx = o; if (mounted) { ensureButton(); return; }
    mounted = true;
    var E = root.FFF && root.FFF.envelope; if (!E) return;
    E.mount({ accepts: ['keys/vault'], onReceive: applyToApp, link: false, viaBridge: false });
    function tick() { ensureButton(); }
    if (doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', tick); else tick();
    if (typeof MutationObserver !== 'undefined') new MutationObserver(tick).observe(doc().body || doc().documentElement, { childList: true, subtree: true });
  }

  /* ---------- panou (VaultCrypt) ---------- */
  /* o = {host:Element, store:{get(k),set(k,v),remove(k)}  (text; doar blobul criptat), app:'vaultcrypt', it?:număr (teste)} */
  function panel(o) {
    var E = root.FFF.envelope, host = o.host, st = o.store, KEY = 'seif-keys', state = { map: null, pw: null }, msg = '', busy = false;
    function blob() { try { return st.get(KEY) || ''; } catch (e) { return ''; } }
    function say(t) { msg = t; render(); }
    function run(fn) { if (busy) return; busy = true; render(); Promise.resolve().then(fn).then(function (m) { busy = false; msg = m || ''; render(); }, function (e) { busy = false; msg = (e && e.message === 'wrong') ? tr('wrong') : (e && e.message && /^fff-seif: parola/.test(e.message)) ? tr('short', { n: PW_MIN }) : tr('fail'); render(); }); }
    function persist() { return seal(state.map, state.pw, { it: o.it }).then(function (b) { st.set(KEY, b); return b; }); }
    function field(label, type, id, ac) { var l = node('label', 'fffs-l', label), i = node('input', 'fffs-i'); i.type = type; i.id = id; i.autocomplete = ac || 'off'; i.spellcheck = false; l.appendChild(i); return { l: l, i: i }; }
    function btn(label, fn) { var b = node('button', 'fffs-b', label); b.type = 'button'; b.disabled = busy; b.addEventListener('click', function () { run(fn); }); return b; }
    function render() {
      host.textContent = '';
      var c = node('div', 'fffs'), has = !!blob(), un = !!state.map;
      c.appendChild(node('h3', null, tr('title'))); c.appendChild(node('p', 'fffs-s', tr('intro')));
      c.appendChild(node('p', 'fffs-s', tr(!has ? 'stNone' : un ? 'stOpen' : 'stLocked')));
      if (!has) {
        var f = node('form', 'fffs-f'), p1 = field(tr('pw'), 'password', 'fffs-pw1', 'new-password'), p2 = field(tr('pw2'), 'password', 'fffs-pw2', 'new-password');
        f.appendChild(p1.l); f.appendChild(p2.l);
        var go = node('button', 'fffs-b', tr('create')); go.type = 'submit'; go.disabled = busy; f.appendChild(go);
        f.addEventListener('submit', function (ev) { ev.preventDefault(); run(function () {
          if (p1.i.value.length < PW_MIN) throw new Error('fff-seif: parola'); if (p1.i.value !== p2.i.value) return tr('mism');
          state.pw = p1.i.value; state.map = {}; return persist().then(function () { return tr('created'); });
        }); });
        c.appendChild(f);
        c.appendChild(importRow());
      } else if (!un) {
        var f2 = node('form', 'fffs-f'), p = field(tr('pw'), 'password', 'fffs-pw', 'current-password'); f2.appendChild(p.l);
        var u = node('button', 'fffs-b', tr('unlock')); u.type = 'submit'; u.disabled = busy; f2.appendChild(u);
        f2.addEventListener('submit', function (ev) { ev.preventDefault(); run(function () { return open(blob(), p.i.value).then(function (m) { state.map = m; state.pw = p.i.value; return tr('opened'); }, function () { throw new Error('wrong'); }); }); });
        c.appendChild(f2);
        c.appendChild(importRow());
        var del = btn(tr('delVault'), function () { st.remove(KEY); state.map = null; state.pw = null; return tr('deleted'); }); c.appendChild(del);
      } else {
        var list = node('div', 'fffs-list'), ids = Object.keys(state.map);
        if (!ids.length) list.appendChild(node('p', 'fffs-s', tr('empty')));
        ids.forEach(function (id) {
          var row = node('div', 'fffs-row'); row.appendChild(node('span', 'fffs-n', id)); row.appendChild(node('span', 'fffs-k', '••••••••' + String(state.map[id]).slice(-4)));
          row.appendChild(btn(tr('remove'), function () { delete state.map[id]; return persist().then(function () { return tr('saved'); }); })); list.appendChild(row);
        });
        c.appendChild(list);
        var af = node('form', 'fffs-f'), dl = node('datalist'); dl.id = 'fffs-ids'; KNOWN.forEach(function (k) { var op = node('option'); op.value = k; dl.appendChild(op); });
        var pid = field(tr('provider'), 'text', 'fffs-id'); pid.i.setAttribute('list', 'fffs-ids'); var pk = field(tr('key'), 'password', 'fffs-key', 'off');
        af.appendChild(pid.l); af.appendChild(pk.l); af.appendChild(dl);
        var add = node('button', 'fffs-b', tr('add')); add.type = 'submit'; add.disabled = busy; af.appendChild(add);
        af.addEventListener('submit', function (ev) { ev.preventDefault(); run(function () {
          var id = pid.i.value.trim().toLowerCase(), k = pk.i.value.trim();
          if (!/^[a-z0-9][a-z0-9_.-]{0,40}$/.test(id) || !k) return tr('badId'); state.map[id] = k; return persist().then(function () { return tr('saved'); });
        }); });
        c.appendChild(af);
        var row2 = node('div', 'fffs-row2');
        row2.appendChild(E.sendButton({ slug: o.app, className: 'fffs-b', text: tr('send'), registry: [], getEnv: function () { return seal(state.map, state.pw, { it: o.it }).then(function (b) { return toEnvelope(b, { app: o.app }); }); } }));
        row2.appendChild(btn(tr('lock'), function () { state.map = null; state.pw = null; return tr('locked'); }));
        c.appendChild(row2); c.appendChild(importRow());
      }
      if (busy) c.appendChild(node('p', 'fffs-s', tr('work')));
      var m = node('p', 'fffs-st', msg); m.setAttribute('role', 'status'); c.appendChild(m);
      c.appendChild(node('p', 'fffs-w', tr('warn')));
      host.appendChild(c);
    }
    /* import plic keys/vault: parola plicului; cheile se unesc în seiful curent (dacă e deblocat) sau devin seiful (dacă nu există unul) */
    function importRow() {
      var d = node('div', 'fffs-row2');
      d.appendChild(E.importButton({ accepts: ['keys/vault'], className: 'fffs-b', text: tr('impEnv'), onReceive: onImport }));
      return d;
    }
    function onImport(env) {
      var b = fromEnvelope(env);
      return new Promise(function (res, rej) {
        var f = node('form', 'fffs-f fffs-ask'), p = field(tr('pwOf'), 'password', 'fffs-pwi', 'current-password'); f.appendChild(p.l);
        var ok = node('button', 'fffs-b', tr('unlock')); ok.type = 'submit'; f.appendChild(ok);
        var no = node('button', 'fffs-b', tr('cancel')); no.type = 'button'; f.appendChild(no); var s = node('p', 'fffs-st'); f.appendChild(s);
        no.addEventListener('click', function () { f.remove(); res(tr('cancel')); });
        f.addEventListener('submit', function (ev) {
          ev.preventDefault(); s.textContent = tr('work');
          open(b, p.i.value).then(function (m) {
            var pw = p.i.value; f.remove();
            if (!state.map) { state.map = m; state.pw = pw; } else Object.assign(state.map, m);
            return persist().then(function () { render(); res(tr('imported', { n: Object.keys(m).length })); });
          }, function () { s.textContent = tr('wrong'); });
        });
        host.appendChild(f); try { p.i.focus(); } catch (e) { /* fără focus */ }
      });
    }
    render(); return { render: render, lock: function () { state.map = null; state.pw = null; render(); } };
  }

  return { ITER: ITER, PW_MIN: PW_MIN, KNOWN: KNOWN, I18N: I18N, tr: tr, seal: seal, open: open, toEnvelope: toEnvelope, fromEnvelope: fromEnvelope, mapProviders: mapProviders, mount: mount, panel: panel, applyToApp: applyToApp };
});
