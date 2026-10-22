# fff-kit

**Versiune:** 1.1.4 · **Ultima actualizare:** 22 octombrie 2026

Module comune pentru aplicațiile „fără frontiere”, **lipite în fiecare `index.html`** de un pas de build. Aplicația rămâne un fișier care funcționează descărcat, offline, fără server. Nimic din kit nu face cereri de rețea.

Acest README acoperă nucleul: `core`, `label` („Transparență”) și `bundle` (copie de siguranță `.fff.json`). Celelalte module (`qr`, `p2p`, `srs`, `tts`, `pii`, `search`, `ephem`) au propriile fișiere `src/<nume>.js` + `i18n/<nume>.json` și se includ cu același `build.mjs`; specificația lor este în `SPEC.md`.

## Cum se aplică

Cerințe: Node 18+, fără pachete externe (build-ul folosește doar modulele Node și `lib/csp.mjs`; Playwright e folosit numai de `info --probe`).

```
node fff-kit/build.mjs apply  <dir> --slug <slug> --modules core,label,bundle[,qr,p2p,srs,tts,pii,search,ephem] [--disable "motiv"]
node fff-kit/build.mjs info   <dir> [--slug <slug>] [--probe]
node fff-kit/build.mjs check  <dir> [--lax] [--json]
node fff-kit/build.mjs fixcsp <dir>
node fff-kit/build.mjs remove <dir>
```

`<dir>` este directorul cu `index.html` (sau chiar fișierul HTML).

* **`apply`** (idempotent) înlocuiește/inserează blocul `<!--fff:kit:start …-->…<!--fff:kit:end-->` imediat după `<meta charset>`: `<meta name="fff-app">`, `<style id="fff-style">`, `<script id="fff-kit">` (modulele în ordinea `core, label, bundle, qr, p2p, srs, tts, pii, search, ephem`) și `<script type="application/json" id="fff-i18n">`. Apoi recalculează hash-urile SHA-256 ale **tuturor** scripturilor inline în `script-src` (nu adaugă `unsafe-inline`). Dacă `style-src` nu permite `'unsafe-inline'`, adaugă hash-ul stilului kitului; `remove` îl scoate. Dacă există deja un bloc `fff-info`/`app.json`, `apply` le reîmprospătează, ca hash-ul declarat să rămână valid. Un modul cerut dar lipsă (`src/<nume>.js`) oprește build-ul cu o eroare clară, fără a modifica fișierul. Fișierele care nu sunt UTF-8 valid sunt refuzate.
* **`remove`** readuce fișierul exact la forma de dinainte (verificat în teste), inclusiv CSP.
* **`check`**: marcaje, structura blocului, hash-urile CSP, existența `application-version` / `last-updated` / `#app-version` (cu `--lax` doar avertismente) și, dacă există `fff-info`, valabilitatea SHA-256 declarat. Din 1.1.3 verifică și **politici CSP**: `script-src` (sau `default-src`) cu `'unsafe-inline'` [`script-unsafe-inline`] sau `'unsafe-eval'` [`script-unsafe-eval`], CSP fără `script-src`/`default-src` sau pagină fără CSP [`no-script-src`], hash-uri de scripturi într-o a doua `<meta>` CSP, în afara celei principale [`hash-outside-meta`]. **Fără `--lax` sunt erori; cu `--lax` avertismente** (așa rămân verzi aplicațiile existente). Excepții justificate, în `fff.config.json`: `"cspExceptions": [{"rule": "script-unsafe-inline", "reason": "motiv de cel puțin 8 caractere"}]` (o excepție fără `reason` e ignorată și semnalată). Mai avertizează (mereu doar avertisment) dacă: aplicația are chei de stocare cu nume sensibile (`api key`, `token`, `secret`, `password`, `passwd`, `totp`) și modulul `bundle`, dar nicio apelare `FFF.bundle.redact(...)`; ori **blocul kit din pagină diferă de sursa kitului** (aceeași versiune, conținut diferit: se indică partea — modul, `css` sau `i18n`), deci a fost editat de mână sau e învechit fără schimbare de versiune.
* **`fixcsp`**: recalculează hash-urile CSP ale scripturilor inline (`lib/csp.mjs → recomputeCspHashes`, implementarea unică; `tools/fixcsp.py` doar o apelează). Regulă: lângă `'unsafe-inline'` nu se pune niciun hash (browserul ar ignora `'unsafe-inline'`), hash-urile existente se elimină.
* **`info`** generează `<dir>/app.json` și aceeași informație încorporată în `<script type="application/json" id="fff-info">` + atributul `data-fff-hash` pe `<html>`. Câmpuri: `slug, name, version, updated, description` (din `<meta name="description">`), `egress`, `permissions`, `storageKeys`, `sizeBytes`, `sha256`, `csp`, `features`, `kit`.
  * `egress` = gazde externe găsite **static** în sursă (în `fetch`, XHR, `WebSocket`, `EventSource`, `importScripts`, `import()`, `sendBeacon`, `.src =`, `url()`/`@import` din CSS și atribute `src`/`href` ale resurselor; **nu** linkurile `<a>`, nici `rel=canonical` etc.) + gazdele permise de CSP (`connect-src`, `script-src`, `img-src`, `font-src`, `style-src`, `frame-src`…). Fiecare gazdă are `via` (de unde provine).
  * `permissions` = API-uri detectate în sursa aplicației (fără codul kitului): getUserMedia, geolocation, RTCPeerConnection, navigator.share, Notification, speechSynthesis, SpeechRecognition, clipboard, serviceWorker, indexedDB, localStorage, Web Crypto, WebGL, WebGPU, Worker, BroadcastChannel.
  * `storageKeys` = chei literale din `getItem/setItem/removeItem` pe orice obiect în afară de `sessionStorage` (chei construite dinamic nu pot fi văzute static).
  * `--probe` încarcă pagina în Chromium (Playwright) cu rețeaua blocată, așteaptă 3,5 s și adaugă gazdele încercate și cheile `localStorage` apărute la rulare.
* **`fff.config.json`** (opțional, în directorul aplicației) suprascrie/adaugă câmpuri în `app.json`/`fff-info`, de ex. `{"egressNote": "…", "description": "…", "selfModifying": true, "disable": "motiv"}`. `sha256`, `sizeBytes` și `schema` nu pot fi suprascrise. Alte câmpuri recunoscute: `cspExceptions` (vezi `check`) și `bundleKeys` (listă de chei sau prefixe `prefix_*` pe care importul le consideră ale aplicației, pentru chei construite dinamic). `disable` (șir) scrie `<meta name="fff-disable">`: kitul nu mai înfășoară `Storage`, nu transformă `#app-version` și dialogul afișează motivul.

## API pe scurt

Toate modulele sunt IIFE care definesc `window.FFF`; singura variabilă globală este `FFF`.

**`FFF.core`**
* `FFF.app` → `{slug, name, version, updated}` (din `<meta name="fff-app">`, `<title>`, `application-version`, `last-updated`).
* `FFF.lang()` → una din `ro,en,fr,it,es,pt,hu,de`: `html[lang]`, apoi `localStorage` (`lang`/`language`/`locale`), apoi `navigator.language`, apoi `en`. `FFF.onLang(fn)` observă schimbarea lui `html[lang]` și întoarce funcția de dezabonare.
* `FFF.t(modul, cheie, vars)` (cădere pe `en`, apoi `ro`, apoi cheia) și `FFF.registerI18n(modul, {ro:{…},en:{…}})`.
* **Observator de stocare**: înfășoară `Storage.prototype.getItem/setItem/removeItem/clear` și, doar pentru `localStorage`, ține indexul `fff.<slug>.__keys` (JSON) cu cheile atinse de aplicație (set; get doar dacă cheia există; fără cheile care încep cu `fff.`). **Nu redenumește chei și nu mută date.** Dacă aplicația suprascrie ulterior `Storage.prototype`, lanțul continuă (apelul ajunge tot la kit).
* `FFF.store` → `get(k, implicit)`, `set(k, v)`, `remove(k)`, `keys()` (date proprii ale kitului/aplicațiilor noi, în spațiul `fff.<slug>.<cheie>`, serializate JSON); `indexKeys()` = cheile indexate ale aplicației + cele `fff.<slug>.*`. Dacă `localStorage` aruncă (blocat, mod privat) → memorie, fără excepții.
* `FFF.bus` → `on(ev, fn)` (întoarce `off`), `off`, `once`, `emit` (erorile ascultătorilor nu se propagă).
* `FFF.sha256(șir|bytes|ArrayBuffer|Blob)` → hex (Web Crypto; rezervă în JS dacă `crypto.subtle` lipsește). `FFF.download(nume, blob|șir, mime)`; `FFF.pickFile(accept)` → `Promise<File|null>` (`null` dacă utilizatorul renunță).

**`FFF.label`** — transformă `#app-version` într-un buton (`role="button"`, `tabindex="0"`, `aria-haspopup="dialog"`, `title`; click/Enter/Space) care deschide un `<dialog>` modal „Transparență”: nume, versiune · dată, descriere; **Rețea** (gazde declarate sau „0 cereri externe declarate”); **Stocare** (chei + octeți, actualizat live); **Permisiuni/API**; **Fișier** (dimensiune, SHA-256 declarat, verificator); **Copie de siguranță** (Exportă / Exportă criptat / Importă / Șterge); butonul „Instalează aplicația” dacă browserul a emis `beforeinstallprompt`. Dacă `#app-version` lipsește, apare un buton discret în primul `<footer>`, iar dacă nu există nici footer, rămâne doar `FFF.label.open()` / `FFF.label.close()`. Dacă `#app-version` e deja în interiorul unui `<a>`/`<button>`, nu se transformă (evită controale imbricate). Dialogul este creat la deschidere și scos din DOM la închidere (nu rămâne în ieșirea `outerHTML` a aplicațiilor care își serializează pagina).

**`FFF.bundle`** — `export({encrypt, password, filename, confirm, sensitive})`, `inspect(file, {password})`, `import(file, {password, confirm, reload, delay})`, `wipe({confirm, reload})`, `build()`, `redact(fn)`, `allow(chei)`, `minPassword`, `passwordStrength(parolă)`, `iterations`; erorile au `.code` (`format, schema, app, password_required, bad_password, pw_short, iter, nocrypto, read, too_big, quota, key`) și mesaj tradus în limba curentă. Confirmările folosesc un `<dialog>` propriu (nu `window.confirm`).

**Redactare (kit 1.1.0, întărită în 1.1.1; 1.1.2: PBKDF2 la 600 000 de iterații și protecție anti-clickjacking).** `FFF.bundle.redact(function (cheie, valoare) { … return valoareCurățată; })` înregistrează un redactor pentru secrete (chei API etc.). Redactorii se aplică doar exportului **necriptat** (`export()` fără `encrypt`); un redactor care aruncă excepție sau întoarce altceva decât un șir golește valoarea (eșuează închis; pentru a păstra o valoare, întoarce-o). `export({encrypt:true, password})` (copie criptată) păstrează totul, iar `export({secrets:true})` dezactivează explicit redactarea. `build()` rămâne complet (neredactat), pentru apelurile existente. La restaurarea unei copii necriptate, valorile redactate trebuie reintroduse manual.

**Dimensiuni minime în 1.1.4 (re-audit dinamic: ținte tactile < 24 px în 69 de aplicații, text < 12 px în 43).** Din cele 112 depistări, singurele elemente generate de kit erau `#app-version` (transformat în buton de `FFF.label`) și rezerva `.fff-chip`; restul aparțin aplicațiilor.

* `#app-version[data-fff-label]` primește `min-height`/`min-width` de 24 px (CSS, fără a-i schimba `display`). Dacă elementul e `display:inline` (de obicei un `<span>`, a cărui casetă are doar ~15 px), `FFF.label` îi pune `data-fff-inl` și devine `inline-flex` cu `align-items:center`; blocurile (`div`, `p`) rămân blocuri. Nicio altă proprietate de layout nu e atinsă.
* Text ≥ 12 px: `FFF.label` marchează cu `data-fff-fs` doar nodurile din `#app-version` al căror font calculat e < 12 px (inclusiv descendenții și valorile puse inline) și le ridică la 12 px; fonturile deja ≥ 12 px nu se schimbă. Măsurarea se repetă la `load` și la `resize` (breakpoint-urile aplicației).
* `.fff-chip`: `font-size:max(12px,.85em)`. Dialogurile kitului: pe `pointer:coarse`, butoanele, câmpurile și `summary` au minimum 44 px.
* Ce NU face kitul: nu atinge butoane, linkuri, casete de bifat sau text ale aplicației (subsol, bare de unelte, glisoare etc.) — acestea se corectează în fiecare aplicație.

**Întărire în 1.1.3.**

* **Restaurarea nu mai e suprascrisă (M2).** Aplicațiile care își salvează starea din memorie la `pagehide`/`beforeunload` rescriau datele tocmai importate (sau șterse) în timpul `location.reload()`. Acum, cu `reload: true` (cazul dialogului „Transparență”), kitul **îngheață scrierile** după ce a scris cheile și înainte de reload: `Storage.prototype.setItem/removeItem/clear` devin no-op (inclusiv `sessionStorage`), `IDBObjectStore.put/add/delete/clear` nu mai scriu, iar `FFF.store.set/remove` și `FFF.store.raw.set/remove` sunt blocate (`FFF.store.freeze()`, `FFF.store.frozen()`). `bundle:imported` / `bundle:wiped` se emit **sincron, după înghețare**. Atribuirea directă `localStorage.cheie = valoare` nu poate fi interceptată și rămâne în afara protecției. Fără `reload`, nu se îngheață nimic.
* **Chei la import (D1).** Dialogul de confirmare listează numele cheilor (primele 8, apoi „… (+N)”). Cheile care nu sunt `fff.<slug>.*`, nu sunt deja indexate și nu sunt declarate (`fff-info.storageKeys`, `fff.config.json → bundleKeys`, `FFF.bundle.allow([...])`; declarațiile care se termină în `*`, `_`, `.`, `:`, `-` sunt prefixe) apar într-un avertisment separat („Atenție: N chei nu sunt declarate…”); importul rămâne posibil, cu confirmare, ca să nu se rupă aplicațiile cu chei dinamice. `import()` întoarce și `unknown` (lista lor).
* **Rollback (D2).** Valorile vechi se rețin într-un `Map`; cheile `constructor`, `toString`, `__proto__` ș.a. se restaurează corect; la export, `data` nu are prototip.
* **Export necriptat cu date sensibile (M4).** Dacă o cheie exportată se potrivește cu `/api[-_]?key|token|secret|password|passwd|totp/i` și valoarea n-a fost golită de un redactor, `export()` cere confirmare: „Criptează (recomandat)” (cere parola în dialog), „Exportă necriptat” sau „Anulează” (`{cancelled: true}`). `{confirm: false}` / `{sensitive: false}` omit dialogul.
* **Parola de export** are cel puțin 12 caractere (eroare `pw_short`) și, în UI, un indicator de tărie (slabă/acceptabilă/bună); la import nu se impune minim, ca să rămână deschise copiile mai vechi. **Iterațiile** din plic trebuie să fie un întreg între 100 000 și 5 000 000 (altfel eroare `iter`, cu mesaj explicit).
* **Anti-clickjacking (D7).** În cadre cross-origin sau iframe-uri `sandbox`, conținutul aplicației rămâne ascuns, dar apare un mesaj minimal tradus (8 limbi) cu un link `target="_blank" rel="noopener"` către pagină; stilurile se pun prin CSSOM, deci merge și sub `style-src` fără `unsafe-inline`.
* **p2p (F2).** `decodeSignal` validează fiecare `a=candidate:` (format RFC 8839, `typ` doar host/srflx/relay, adrese IP sau nume mDNS `*.local`, porturi 1–65535) și limitează la 32 de candidate; `lockstep` păstrează cel mult 256 de mutări „din viitor” (restul cer resincronizare).
* **Texte.** „600 000 de iterații” provine din constanta din `bundle.js` (`{iter}` în `label.json`); un test pică dacă diferă. `.fff-msg{white-space:pre-line}`.
* **Unelte (F9).** `tools/fixcsp.py`, `tools/ver.py`, `tools/lang.py` (vezi „Unelte” mai jos); `test/all.mjs` rulează toate testele.

## Formatul `.fff.json`

```json
{"format":"fff-bundle","schema":1,"app":"<slug>","version":"X.Y.Z","updated":"YYYY-MM-DD","exported":"ISO-8601","data":{"<cheie>":"<șir exact ca în localStorage>"}}
```

Criptat (parolă ≥ 12 caractere la export, normalizată NFC):

```json
{"format":"fff-bundle-enc","schema":1,"app":"<slug>","kdf":"PBKDF2-SHA256","iter":600000,"salt":"<b64, 16 B>","iv":"<b64, 12 B>","ct":"<b64>"}
```

Cheie AES-GCM 256 derivată cu PBKDF2-SHA256 (600 000 iterații); textul clar este JSON-ul bundle-ului de mai sus; datele autentificate suplimentar (AAD) sunt `fff-bundle-enc|1|<slug>`, deci schimbarea antetului (`app`) sau a numărului de iterații face decriptarea să eșueze. Parola nu poate fi recuperată.

Reguli la import: `format`/`schema`/`app` trebuie să corespundă; toate valorile sunt șiruri; cheile `fff.*` sunt acceptate doar în spațiul `fff.<slug>.`; indexul `__keys` nu poate fi importat; fișier maximum 64 MB. Se cere confirmare (număr de chei, numele lor, versiune, dată; chei nedeclarate semnalate separat). Se scriu **doar** cheile din bundle (îmbinare: nu șterge restul); dacă scrierea eșuează (cotă plină), valorile anterioare sunt restaurate. **Ștergerea** înlătură doar cheile indexate ale aplicației (inclusiv `fff.<slug>.*`), cu confirmare.

## Verificarea hash-ului (SHA-256)

Fișierul distribuit declară un SHA-256 în `<html data-fff-hash="…">` și în `fff-info` (`"sha256":"…"`). Pentru a evita circularitatea, hash-ul se calculează pe forma **canonică**: toate aparițiile `data-fff-hash="[0-9a-f]*"` devin `data-fff-hash=""` și `"sha256":"[0-9a-f]*"` devin `"sha256":""`, pe octeții fișierului (UTF-8, fără alte transformări).

* În aplicație: dialogul „Transparență” → „Verifică un fișier descărcat…” (alegi fișierul; se calculează local și se compară).
* În terminal, același rezultat:

```
LC_ALL=C sed -E 's/data-fff-hash="[0-9a-f]*"/data-fff-hash=""/g; s/"sha256":"[0-9a-f]*"/"sha256":""/g' index.html | sha256sum
```

`sizeBytes` este dimensiunea fișierului final; build-ul găsește prin iterație punctul fix (cifrele lui apar în fișier).

## Teste

```
node fff-kit/test/all.mjs [--timeout=900] [--only=core,bundle] [--skip=ephem] [--list] [--fail-fast]   # TOATE testele autonome, pe rând
node fff-kit/test/core.test.mjs      # 34 verificări
node fff-kit/test/label.test.mjs     # 57 (inclusiv axe în dialog, luminos/întunecat, 360 px, dimensiuni minime 1.1.4)
node fff-kit/test/bundle.test.mjs    # 53 (export/import/ștergere, criptare, rollback, UI)
node fff-kit/test/build.test.mjs     # 68 (apply/idempotență/remove/check/info, politici CSP)
node fff-kit/test/hardening.test.mjs # kit 1.1.3: pagehide vs. restaurare, chei la import, rollback, parolă/iterații, export sensibil, anti-clickjacking, politici CSP, derivă, ICE/lockstep, tools/
# + qr, p2p, srs, tts, pii, search, ephem (*.test.mjs), ephem.browser.mjs, kit3-ui.mjs
node fff-kit/test/compat.mjs --inv shots_inv.json --work <dir> --out rezultate.json   # copii ale aplicațiilor existente (nu le modifică pe cele originale)
node fff-kit/test/quine.mjs --work <dir>   # aplicații care își salvează propria copie: fișierul salvat trebuie să rămână funcțional
```

`compat.mjs` aplică `core,label,bundle` (+ `info`) pe câte o copie a fiecărei aplicații și măsoară, cu rețeaua blocată, la 1280×800 și 360×740 după 3,5 s: erori de pagină/CSP noi, depășire orizontală nouă, violări axe noi, cereri de rețea noi, transformarea lui `#app-version` în buton și deschiderea dialogului (după deschiderea panoului „despre” unde elementul e ascuns), axe în dialog (luminos și întunecat), apoi export → ștergere → import cu verificarea valorilor și a faptului că o cheie străină rămâne neatinsă.

Testele folosesc Playwright cu Chromium (`/opt/pw-browsers/chromium`), rețea blocată; variabilele `FFF_TMP` (directorul temporar) și `FFF_AXE` (calea `axe.min.js`) sunt opționale.

## Unelte (`tools/`)

* `tools/fixcsp.py <dir>…` — recalculează hash-urile CSP (apelează `node build.mjs fixcsp`; fără implementare proprie). Necesită Node ≥ 18.
* `tools/ver.py [--apply]` — rescrie linia „Versiune · Ultima actualizare” din `README*.md` (8 limbi) pornind de la `<meta application-version / last-updated>`; fără `--apply` doar numără. `tools/lang.py [--apply]` — adaugă linia „Limbile interfeței”. Portabile: rădăcina e trei niveluri deasupra `tools/` (sau `FFF_ROOT=/cale`) și așteaptă `<rădăcină>/<depozit>/{README*.md,index.html}` plus `<rădăcină>/chiuta.github.io/apps/<aplicație>/…`; sar peste aplicațiile fără `index.html` sau fără README. Se rulează cu `python3 -I`.
* `tools/gen-ephem.mjs`, `gen-stars.mjs` — generatoarele modulului `ephem` (vezi `docs/ephem.md`).

## Limite (pe scurt, pe cinstite)

* **Traduceri**: `ro` și `en` sunt scrise de autor; `fr, it, es, pt, hu, de` sunt traduse automat și **neverificate de vorbitori nativi**.
* **Analiza este statică**: `egress`, `permissions` și `storageKeys` provin din citirea codului, nu dintr-o garanție de rulare. Pot apărea false pozitive (cod mort din biblioteci) și false negative (URL-uri sau chei construite dinamic, cod încărcat din blob-uri). `--probe` ajută, dar acoperă doar ce se întâmplă în 3,5 s fără interacțiune. Verificarea tehnică de referință rămâne fila „Rețea” a browserului și CSP-ul din `<meta>`.
* **Doar `localStorage`**: IndexedDB, Cache Storage, cookie-urile și `sessionStorage` nu intră în copia de siguranță și nu sunt șterse; dialogul avertizează când aplicația folosește IndexedDB. Accesul direct la proprietăți (`localStorage.cheie = …`, `localStorage["cheie"]`) ocolește metodele observate și deci nu este indexat, iar înghețarea scrierilor din timpul restaurării nu îl poate opri.
* **Origine partajată**: pe `chiuta.github.io` toate aplicațiile împart același `localStorage`. Indexul este pe slug, dar o aplicație care enumeră și citește toate cheile (`Object.keys(localStorage)` + `getItem`) își „însușește” și cheile altora, iar „Șterge datele aplicației” le-ar șterge (cu confirmare și număr de chei afișat).
* **Aplicații care își salvează propria copie** (`document.documentElement.outerHTML` → descărcare): kitul nu le strică (blocul kit e static, dialogul nu rămâne în DOM), dar copia salvată conține un `data-fff-hash` care nu mai corespunde, iar datele din fișier nu sunt în `localStorage`, deci nu intră în `.fff.json`. Se marchează cu `"selfModifying": true` în `fff.config.json` (dialogul afișează avertismentul) sau, dacă e nevoie, cu `disable`.
* **Hash-ul nu e o semnătură**: dovedește doar că fișierul coincide cu valoarea declarată *în el însuși*; cine poate modifica fișierul poate modifica și hash-ul. Util pentru a verifica o descărcare față de valoarea publicată separat (de ex. în README sau pe pagina de pornire).
* **CSP**: hash-urile se calculează pe textul exact al scripturilor; fișierele cu CRLF în scripturi pot avea hash-uri diferite după normalizarea făcută de browser (build-ul avertizează).
* **Context sigur**: criptarea cere Web Crypto (`https:` sau fișier local); fără el, exportul/importul criptat dă o eroare tradusă. SHA-256 are rezervă în JS.
* **Teme**: dialogul preia culorile deschis/închis din fundalul paginii gazdă (altfel din `prefers-color-scheme`); variabilele `--fff-bg`, `--fff-fg`, `--fff-muted`, `--fff-line`, `--fff-btn`, `--fff-accent`, `--fff-accent-fg`, `--fff-font` pot fi setate de aplicație.

## Terți

Niciun cod de terți în kit. Testele folosesc Playwright și axe-core (MPL-2.0) doar local, ca instrumente de dezvoltare; nu sunt incluse în aplicații.
