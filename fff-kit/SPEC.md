# fff-kit — specificație (14 octombrie 2026)

Scop: module comune pentru aplicațiile „fără frontiere”, **lipite în fiecare `index.html`** de un pas de build (aplicația rămâne funcțională ca fișier descărcat, offline, fără server). Regula „un singur fișier” NU mai e strictă: sunt permise fișiere auxiliare opționale (manifest, sw.js, icoane, `app.json`, teste, README, capturi), dar `index.html` singur trebuie să rămână complet funcțional offline.

## Convenții de cod
- ES2020, fără dependențe externe la rulare, fără `eval`/`new Function`, fără handlere inline, fără rețea (nicio cerere externă în kit; modulele care ating rețeaua sunt opt-in și declarate).
- Fiecare modul = fișier `src/<nume>.js`, o IIFE care definește `window.FFF = window.FFF || {}; FFF.<nume> = {...}`; fără variabile globale în afară de `FFF`. Poate depinde doar de `core`.
- Texte vizibile ale kitului: în `i18n/<nume>.json` → `{"ro":{...},"en":{...},"fr":{},"it":{},"es":{},"pt":{},"hu":{},"de":{}}` (toate 8 limbile; HU/DE traduse de tine, marcate ca neverificate nativ în README). `FFF.t(modul, cheie, vars)`.
- CSS al kitului: prefix `fff-`, cu variabile CSS cu fallback (`var(--fff-bg, Canvas)` …), respectă `prefers-color-scheme` și `prefers-reduced-motion`; fără a modifica stilul aplicației gazdă.
- Accesibilitate: axe 0 violări, focus vizibil, tastatură completă, `<dialog>` nativ cu `aria-labelledby`, ținte tactile ≥ 24 px.
- Date personale: nimic nu pleacă din browser. Orice trimitere externă e opt-in, afișată în etichetă.

## Injectare (build.mjs)
`node fff-kit/build.mjs apply <dir-aplicatie> --slug <slug> --modules core,label,bundle[,...]` face, idempotent:
1. Înlocuiește/inserează blocul între marcajele `<!--fff:kit:start v=1 modules=…-->` și `<!--fff:kit:end-->` imediat după `<meta charset>` în `<head>` (înaintea oricărui alt `<script>`), conținând: `<meta name="fff-app" content="slug">`, `<style id="fff-style">`, `<script id="fff-kit">` (modulele concatenate, în ordinea: core, apoi restul) și `<script type="application/json" id="fff-i18n">`.
2. Recalculează hash-urile SHA-256 pentru TOATE scripturile inline și rescrie lista din `script-src` (păstrând restul directivelor; nu adaugă `unsafe-inline`).
3. `node fff-kit/build.mjs remove <dir>` scoate blocul. `node fff-kit/build.mjs check <dir>` verifică marcajele, hash-urile CSP și că `#app-version`/meta există.
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
- `FFF.bundle.export({encrypt})`, `FFF.bundle.import(file,{password})` (validează schema și `app`; cere confirmare; scrie doar chei din bundle; apoi `location.reload()` opțional), `FFF.bundle.wipe()` (șterge doar cheile indexate ale aplicației, cu confirmare).

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

## Teste
`fff-kit/test/*.mjs` (Playwright cu `createRequire('/opt/node-tools/package.json')`, chromium `/opt/pw-browsers/chromium`, rețea blocată). Fiecare modul: teste unitare în pagină + test de integrare pe un `index.html` demonstrativ `fff-kit/test/fixture.html`.
