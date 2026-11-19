# fff-kit — specificație (kit 1.8.1, 19 noiembrie 2026; secțiunile poartă versiunea în care au apărut)

Scop: module comune pentru aplicațiile „fără frontiere”, **lipite în fiecare `index.html`** de un pas de build (aplicația rămâne funcțională ca fișier descărcat, offline, fără server). Regula „un singur fișier” NU mai e strictă: sunt permise fișiere auxiliare opționale (manifest, sw.js, icoane, `app.json`, teste, README, capturi), dar `index.html` singur trebuie să rămână complet funcțional offline.

## Convenții de cod
- **Sintaxă ES2017** (async/await da; din ES2018 în sus nu: `?.`, `??`, `||=`/`&&=`/`??=`, `catch {}` fără parametru, separatori numerici, literal BigInt, spread/rest de obiect, `import()` în cod clasic, regex cu `\p{…}`/lookbehind/grupuri cu nume/steagurile `s` `d` `v`, câmpuri de clasă, generatoare asincrone, `for await`); API-urile mai noi decât pragul se folosesc doar dacă `compat.js` le acoperă (v. „FFF.compat”). Pragul stă într-un singur loc: `tools/compat/compat.config.json`. Fără dependențe externe la rulare, fără `eval`/`new Function`, fără handlere inline, fără rețea (nicio cerere externă în kit; modulele care ating rețeaua sunt opt-in și declarate).
- Fiecare modul = fișier `src/<nume>.js`, o IIFE care definește `window.FFF = window.FFF || {}; FFF.<nume> = {...}`; fără variabile globale în afară de `FFF`. Poate depinde doar de `core`.
- Texte vizibile ale kitului: în `i18n/<nume>.json` → `{"ro":{...},"en":{...},"fr":{},"it":{},"es":{},"pt":{},"hu":{},"de":{}}` (toate 8 limbile; HU/DE traduse de tine, marcate ca neverificate nativ în README). `FFF.t(modul, cheie, vars)`.
- CSS al kitului: prefix `fff-`, cu variabile CSS cu fallback (`var(--fff-bg, Canvas)` …), respectă `prefers-color-scheme` și `prefers-reduced-motion`; fără a modifica stilul aplicației gazdă.
- Accesibilitate: axe 0 violări, focus vizibil, tastatură completă, `<dialog>` nativ cu `aria-labelledby`, ținte tactile ≥ 24 px.
- Date personale: nimic nu pleacă din browser. Orice trimitere externă e opt-in, afișată în etichetă.

## Injectare (build.mjs)
`node fff-kit/build.mjs apply <dir-aplicatie> --slug <slug> --modules core,label,bundle[,...]` face, idempotent:
1. Înlocuiește/inserează blocul între marcajele `<!--fff:kit:start v=1 modules=…-->` și `<!--fff:kit:end-->` imediat după `<meta charset>` în `<head>` (înaintea oricărui alt `<script>`), conținând: `<meta name="fff-app" content="slug">`, `<style id="fff-style">`, **`<script id="fff-compat">`** (v1.8.0; strat ES5, rulează primul dintre scripturi), **`<script type="module" id="fff-imp">`** (v1.8.0; ajutorul pentru `import()` dinamic, ignorat de browserele care nu știu module), `<script id="fff-kit">` (modulele concatenate, în ordinea: core, apoi restul) și `<script type="application/json" id="fff-i18n">`.
2. Recalculează hash-urile SHA-256 pentru TOATE scripturile inline și rescrie lista din `script-src` (păstrând restul directivelor; nu adaugă `unsafe-inline`).
3. `node fff-kit/build.mjs remove <dir>` scoate blocul. `node fff-kit/build.mjs check <dir>` verifică marcajele, hash-urile CSP și că `#app-version`/meta există; de la 1.8.0 cere și `#fff-compat` + `#fff-imp` în pagină; când `style-src` nu are `'unsafe-inline'`, orice alt `<style>` inline (în afara celui al kitului, a `<noscript>` și a textului din scripturi) trebuie să aibă hash în `style-src`, altfel eroare.
4. Nu schimbă nimic altceva în fișier.

## FFF.core
- `FFF.app` = `{slug, name (document.title), version, updated}` citite din `<meta name="fff-app">`, `application-version`, `last-updated`.
- `FFF.lang()` → una din `ro,en,fr,it,es,pt,hu,de`: din `document.documentElement.lang`, apoi `localStorage` (chei uzuale `lang`,`language`,`locale`), apoi `navigator.language`, apoi `en`. `FFF.onLang(fn)` (observă schimbarea `html[lang]`).
- `FFF.t(modul, cheie, vars)`; `FFF.registerI18n(modul, obiect)`.
- **Observator de stocare (nu redenumește chei, nu mută date):** înfășoară `Storage.prototype.getItem/setItem/removeItem/clear` doar pentru `localStorage` ca să țină un index `fff.<slug>.__keys` (JSON, lista cheilor atinse de această aplicație, fără cele care încep cu `fff.`). `FFF.store`: `get/set/remove/keys()` pentru date proprii ale kitului/aplicațiilor noi, namespaced `fff.<slug>.<cheie>`; `FFF.store.indexKeys()` = cheile indexate ale aplicației (inclusiv ale kitului). Dacă `localStorage` aruncă excepție → memorie (fără a crăpa).
- `FFF.bus`: `on(ev,fn)`, `emit(ev,data)`.
- `FFF.sha256(bytes|string)` → hex (Web Crypto); `FFF.download(nume, blob|string, mime)`; `FFF.pickFile(accept)` → Promise<File>.

## FFF.label (etichetă de transparență)
- Transformă elementul existent `#app-version` într-un buton (adaugă `role="button"`, `tabindex="0"`, `aria-haspopup="dialog"`, `title`; click/Enter/Space) care deschide un `<dialog>` „Transparență”. Dacă `#app-version` lipsește → `FFF.label.open()` rămâne disponibil și se adaugă un buton discret DOAR în `<footer>` dacă există, altfel nimic.
- Conținut (din `<script type="application/json" id="fff-info">` generat de `build.mjs info`): nume, versiune · dată, descriere pe scurt; **Rețea** (lista gazdelor contactate, declarate; „0 cereri externe” dacă lista e goală); **Stocare** (chei indexate + dimensiuni în octeți, live); **Permisiuni/API folosite** (detectate la build: cameră/microfon, geolocație, WebRTC, Web Share, notificări, vorbire, etc.); **Fișier** (dimensiune, SHA-256 declarat, metoda de verificare: hash calculat după golirea atributului `data-fff-hash` din `<html>`); **Copie de siguranță** (butoane Exportă / Importă / Șterge datele aplicației; „Criptează cu parolă” opțional).
- `FFF.label.open()`, `FFF.label.close()`.

## FFF.bundle (export/import unitar)
- Format `.fff.json`: `{"format":"fff-bundle","schema":1,"app":"<slug>","version":"X.Y.Z","updated":"YYYY-MM-DD","exported":"ISO","data":{"<cheie>":"<șir>"…}}` (valori exact ca în `localStorage`).
- Criptat: `{"format":"fff-bundle-enc","schema":1,"app":…,"kdf":"PBKDF2-SHA256","iter":600000,"salt":b64,"iv":b64,"ct":b64}` cu AES-GCM 256 (Web Crypto).
- `FFF.bundle.export({encrypt, password})` (parolă ≥ 12 caractere; exportul necriptat cu chei sensibile cere confirmare și propune criptarea), `FFF.bundle.import(file,{password})` (validează schema și `app`; cere confirmare cu numele cheilor și semnalează cheile nedeclarate; scrie doar chei din bundle; cu `reload:true` îngheață scrierile în stocare până la reload ca salvările la `pagehide` să nu suprascrie importul), `FFF.bundle.wipe()` (șterge doar cheile indexate ale aplicației, cu confirmare).

## FFF.qr
`FFF.qr.svg(text,{ecc:'M',scale:4,margin:2})` → șir SVG (fără rețea); `FFF.qr.canvas(...)`. Fără cameră necesară. Capacitate suficientă pentru ≥ 1000 de octeți (versiune ≥ 20, ECC L/M). `FFF.qr.scan(videoEl|file)` opțional (jsQR-lite sau getUserMedia + decodor propriu) — dacă nu e fezabil, se documentează și se oferă copiere/lipire text.

## FFF.p2p (multiplayer fără server)
WebRTC `RTCPeerConnection` fără ICE servere (doar candidate locale/host; opțional câmp „server STUN” gol implicit, opt-in), semnalizare manuală: oferta/răspunsul comprimate (deflate prin `CompressionStream` dacă există, apoi base64url) afișate ca text copiabil și ca QR; `FFF.p2p.host()` → `{offer, accept(answer), channel}`; `FFF.p2p.join(offer)` → `{answer, channel}`; canal de date cu mesaje JSON, `send(obj)`, `on('message'|'open'|'close',fn)`, heartbeat, reconectare manuală. UI gata făcut: `FFF.p2p.dialog({title, onOpen(session)})` (pași: „Găzduiește” / „Alătură-te”, copiere/lipire/QR). Avertisment vizibil: adresa IP se vede celuilalt jucător; opt-in. `FFF.p2p.supported()`.
Protocol de joc recomandat: host e autoritar; mesaje `{t:'move'|'state'|'chat'|'sync', seq, ...}`; seed comun pentru determinism.

## FFF.srs
SM-2: `FFF.srs.create(deckId)`, `.add(items)`, `.next(now)`, `.grade(id,0..5)`, `.stats()`, persistat în `FFF.store`; UI minim `FFF.srs.panel(containerEl,{items,deckId})` (carduri cu față/verso, butoane „Din nou/Greu/Bine/Ușor”, statistici, export în `.fff.json`).

## FFF.tts
`FFF.tts.speak(text,{lang,rate,voice})`, `.stop()`, `.voices(lang)`, `.supported()`; selector de voce `FFF.tts.picker(el)`; fără voce disponibilă → eșec grațios (mesaj tradus).

## FFF.pii
`FFF.pii.scan(text)` → listă `{type,start,end,value,confidence}` pentru: e-mail, telefon RO/INTL, IBAN (verificare mod 97), CNP (cifră de control), card (Luhn), IP, URL cu token/cheie API (`sk-…`, `AKIA…`, JWT), adrese (heuristic), nume proprii (heuristic, confidență joasă). `FFF.pii.mask(text,findings,{mode:'placeholder'|'partial'})`, `FFF.pii.guard({getText,setText,onSend})` → dialog „Date personale detectate” cu opțiuni (maschează toate / continuă / anulează). Totul local.

## FFF.search (căutare locală „după sens”)
`FFF.search.index(docs,{lang})` și `.query(q,{limit})`: BM25 + n-grame de caractere + stemming ușor + sinonime opționale + fuzzy + normalizare diacritice (RO/HU/DE/FR/IT/ES/PT); rezultat cu scor și fragmente evidențiate. Opțional (opt-in, documentat): `FFF.search.useEmbeddings(modelFiles)` dacă utilizatorul furnizează local un model; fără el, se folosește varianta lexicală. Nu descărca nimic automat.

## FFF.ephem (astronomie)
Biblioteca `src/ephem.js`: `FFF.ephem.sun(jd)`, `.moon(jd)`, `.planet(name,jd)` (Mercur…Neptun; poziții geocentrice ecliptice și ecuatoriale, distanță), `.toHorizontal(ra,dec,jd,lat,lon)`, `.rise/.set/.transit`, `.sidereal`, `.jdFromDate`, `.dateFromJd`, `.moonPhase`, `.eclipseLocal(besselianOrComputed, lat, lon, elev)` pentru Eclipsa din 2 august 2027 (contacte C1–C4, magnitudine, obscurare, durată, altitudine Soare). Algoritmi: Meeus (VSOP87 trunchiat, ELP2000-82 trunchiat) cu erori documentate (≤ 1′ Soare/planete, ≤ 10′ Lună). Teste împotriva valorilor publicate (efemeride JPL/USNO/NASA Espenak pentru eclipsa din 2 aug 2027: maxim ≈ 10:07 UTC, durată maximă ≈ 6 m 23 s lângă Luxor).

## FFF.dialog (v1.2.0)
`src/dialog.js` + `i18n/dialog.json` (8 limbi). `FFF.dialog.{confirm,alert,prompt,choice,show,toast,notify,closeAll,isOpen,open}`; `<dialog>` modal nativ cu `role=dialog`, `aria-labelledby/describedby`, Escape, capcană de focus, restaurarea focusului; toasturi în regiuni `aria-live` (`popover=manual`, max. 4). Ținte ≥ 44 px pe `pointer:coarse`; tema prin `--fff-*` (+ `--fff-bad/ok`, `--fff-toast-*`). Aliasuri `ffAsk/ffShow/ffPrompt` (doar dacă lipsesc). `FFF.bundle.confirm` e un strat peste el când modulul există.

## FFF.store (v1.2.0)
`src/store.js`. Prefix `<slug>.` (rezervă la citire: `fff.<slug>.`), JSON sigur, erori/cote prinse (`lastError`, `store:error`), `migrate(map,{wrap,dryRun,dropOld})` idempotentă (copiază, verifică, șterge vechiul; nu suprascrie niciodată valori noi). Cheile `<slug>.*` sunt „cunoscute” pentru bundle/freeze. Ordinea modulelor: `core, store, dialog, label, bundle, …`.

## Stocare indisponibilă (v1.8.1)
`src/core.js`, la începutul scriptului, înainte de orice cod al kitului. Pentru fiecare dintre `localStorage` și `sessionStorage`: dacă citirea proprietății aruncă, valoarea este `null`/`undefined` sau `getItem` aruncă, proprietatea de pe `window` este redefinită (`Object.defineProperty`, `configurable`) cu o stocare doar în memorie (obiect simplu), cu `getItem/setItem/removeItem/clear/key/length`; unde există `Proxy`, `store.cheie = valoare`, `store.cheie`, `cheie in store`, `delete store.cheie` și `Object.keys(store)` lucrează asupra aceleiași memorii. Valorile sunt convertite în șir ca în `Storage`. O stocare care funcționează nu este înlocuită; o eroare la `setItem` (cotă) nu declanșează înlocuirea. `FFF.storageVolatile = true` marchează trecerea pe memorie. Nimic nu se scrie în altă parte (fără cookie, fără `indexedDB`): la închiderea paginii datele dispar. Garanția: pagina nu mai aruncă `SecurityError` la pornire din cauza stocării.

## Cod inclus fără secvențe de marcaj (v1.8.1)
Codul din `src/*.js`, inclus în pagină între `<script>…</script>`, nu conține `<style`, `</style`, `<script`, `</script` și `<!--` (nici în comentarii sau șiruri; se scrie `\x3c` ori se reformulează). Unele unelte ale aplicațiilor ștampilează CSP cu un regex peste tot documentul și ar lua o asemenea secvență drept început sau sfârșit de element, calculând un hash greșit; browserul ar bloca apoi stilul sau scriptul real. Se verifică prin `test/inline-safe.test.mjs`.

## Ținte tactile: ghidajul de lățime (v1.8.1)
`src/ux.js`, `sizePass`: pe ecrane tactile controalele vizibile sub 44 px primesc `min-height`/`min-width` 44 px (inline, `!important`), pe grupuri de frați. Grupul rămâne neatins (`data-fff-nosz`) dacă mărirea lui ar lărgi pagina: lățimea paginii este `max(documentElement.scrollWidth, body.scrollWidth)` (aplicațiile cu `html, body { overflow-x: hidden }` nu derulează, deci doar `documentElement.scrollWidth` nu vede depășirea), iar părintele grupului (când nu are derulare proprie, adică `overflow-x` este `visible`/`hidden`/`clip`) nu are voie să capete `scrollWidth - clientWidth` mai mare cu peste 1 px decât înainte. Celulele de tablă (≥ 8 frați identici, aproape pătrați) se sar. Teste: `test/ux.test.mjs`.

## FFF.compat (v1.8.0)
`src/compat.js` (ES5 pur, fără `let`/`const`/săgeți/șabloane; ~54 KB; script separat, **primul** din bloc, ca să poată semnala problema și în browsere care nu pot rula restul kitului). Prag garantat (`tools/compat/compat.config.json`): Chrome/Edge 55+ (Edge vechi 15+), Firefox 52+, Safari/iOS 10.1+, sintaxă ES2017. Fără rețea, fără `eval`/`new Function`, fără stiluri inline (doar CSSOM). Face:
1. **Rezerve de API, definite doar dacă lipsesc** (nu înlocuiesc niciodată ce există): `Object.entries/values/fromEntries/hasOwn/getOwnPropertyDescriptors`, `String` `padStart/padEnd/trimStart/trimEnd/at/replaceAll/matchAll`, `Array` `flat/flatMap/at/findLast/findLastIndex`, `Promise` `finally/allSettled/any`, `globalThis`, `queueMicrotask`, `requestIdleCallback`/`cancelIdleCallback`, `crypto.randomUUID`, `structuredClone`, `AbortController`, `MediaQueryList.addEventListener`, `Element` `replaceChildren/toggleAttribute`, `Blob` `arrayBuffer/text`, `canvas.toBlob`, `ctx.roundRect`, `scrollTo/scrollBy/scrollIntoView` cu opțiuni, `navigator.clipboard` (prin `execCommand`), `IntersectionObserver`, `ResizeObserver`.
2. **`<dialog>`** emulat (`show/showModal/close`, atributul `open`, `returnValue`, evenimentele `cancel`/`close`) când elementul nu există nativ; stilurile de rezervă stau sub `html.fff-no-dialog`.
3. **`FFF.rx(sursă, flaguri[, rezervă])`** (și `FFF.compat.rx`): RegExp construit la rulare. Încearcă întâi nativ; altfel rescrie `\p{…}` și steagul `s`, emulează lookbehind-ul, iar dacă nu reușește întoarce `rezervă` (sau aruncă). Rezultatele sunt comparate cu cele native în `test/legacy.test.mjs`. Steagul `d` (indices) nu se emulează: aplicația care folosește `m.indices` își aduce propriul fallback (`FFF.compat.has.hasIndices` arată dacă motorul îl are).
4. **`FFF.imp(url)`** (și `FFF.compat.imp`): `import()` dinamic fără sintaxă nouă în scriptul clasic (prin `window.__fffImp`, definit de `<script type="module" id="fff-imp">`; browserele fără module îl ignoră).
5. **Avertisment tradus** (8 limbi, fără stiluri inline) dacă lipsesc elemente de bază (`Promise`, `Symbol`, `Map`, `Set`, `Object.assign`, `Array.from`, variabile CSS): clasa `html.fff-too-old`, lista în `FFF.compat.missing`, `FFF.compat.tooOld`.
6. **Clase pe `<html>`** pentru stilurile de rezervă ale kitului: `fff-no-dialog`, `fff-oldsel` (fără `:where()`/`:not(listă)`), `fff-no-flexgap` (fără `gap` în flex).
7. **`FFF.compat.need(nume[, prezent])`**: aplicația declară o cerință pe care kitul nu o acoperă (de ex. `FFF.compat.need('BigInt')`); întoarce `true` când lipsește și arată o singură dată un banner tradus care spune ce funcție nu merge, restul aplicației rămâne utilizabil.
Citibile: `FFF.compat.{version, floor, has, missing, tooOld}`. Nu există detectare după user-agent. **Neacoperit** (auditul le semnalează ca avertisment, nu le ascunde): `BigInt`, `BroadcastChannel`, `CompressionStream`, `OffscreenCanvas`, `Intl.RelativeTimeFormat/ListFormat/Segmenter`, `navigator.share`, File System Access, `toSorted/toReversed/toSpliced`; din CSS: `:has()`, `dvh`, `color-mix()`, `@container`, `@layer`, `backdrop-filter`, nesting CSS.
**Cum ajunge codul unei aplicații la prag:** aplicațiile noi se scriu direct în subsetul ES2017 (ghid: `docs/GHID-AUTORI.md` § 10); codul existent se coboară cu `node tools/compat/lower.mjs` (transformare care păstrează formatarea; regex și `import()` noi devin apeluri `FFF.rx`/`FFF.imp`, prin ajutoarele locale `$fffRx`/`$fffImp` care cad pe `RegExp` nativ când kitul lipsește), se verifică cu `node tools/compat/audit.mjs --gate` și se rulează în motoare simulate cu `node tools/compat/smoke.mjs`. Detalii, limite și excepțiile aprobate: `docs/COMPATIBILITATE.md`.

## Reguli de verificare, release, CI (v1.2.0)
`check`: `unprefixed-storage`, `native-dialog`, `cdn-without-sri`, `i18n-parity` (avertisment în lax, eroare în strict; excepții în `fff.config.json → exceptions`, prefixe în `storagePrefixes`). `build.mjs release|release-all` (bump, apply păstrând slug/module/disable, fixcsp, info, check; `--dry-run`, raport JSON). `ci/fff-check.yml` (workflow reutilizabil), `ci/caller.yml`, `tools/add-ci.mjs`, `tools/portable-tests.mjs`, `tools/i18n-parity.mjs`. Detalii în README. De la 1.8.0, `check` cere și blocurile `fff-compat`/`fff-imp` (kit ≥ 1.8.0). De la 1.8.1, `release` ridică versiunea și în fișierele din `fff.config.json → versionFiles` (ștampile între ghilimele; vezi README).

## Teste
`fff-kit/test/*.mjs` (Playwright cu `createRequire('/opt/node-tools/package.json')`, chromium `/opt/pw-browsers/chromium`, rețea blocată). Fiecare modul: teste unitare în pagină + test de integrare pe un `index.html` demonstrativ `fff-kit/test/fixture.html`.
