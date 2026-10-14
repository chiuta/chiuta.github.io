# fff-kit / PWA — mod instalabil opțional

**Versiune:** 1.0.0 · **Ultima actualizare:** 14 octombrie 2026

Adaugă unei aplicații „fără frontiere” câteva fișiere alăturate care o fac **instalabilă** (pe ecranul principal / în fereastră proprie) atunci când e servită prin **https** (sau `localhost`). `index.html` rămâne complet funcțional **singur**, inclusiv deschis din `file://`, offline, fără server: dacă fișierele alăturate lipsesc sau pagina nu e într-un context sigur, nu se întâmplă nimic.

## Ce adaugă

În directorul aplicației (`<dir>`):

| Fișier | Rol |
|---|---|
| `manifest.webmanifest` | `name`, `short_name` (≤ 12 caractere), `start_url` și `scope` `./`, `display: standalone`, `lang`, culori, categorii, 3 icoane |
| `sw.js` | service worker: precache `./`, `./index.html`, manifest, icoane; **cache-first cu revalidare în fundal** pentru resursele de aceeași origine; cheie de cache `fff-<slug>-<versiune>` (versiunea din `<meta name="application-version">`); șterge cache-urile vechi ale aceleiași aplicații la `activate`; nicio cerere externă, fără `importScripts` |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | monograma aplicației (1–2 litere) pe culoarea temei; generate prin Playwright dintr-un SVG; fără mărci terțe |

În `index.html`, doar între marcajele `<!--fff:pwa:start …-->` … `<!--fff:pwa:end-->` (în `<head>`, înainte de `</head>`):

* `<link rel="manifest" href="manifest.webmanifest">`;
* `<meta name="theme-color">` — numai dacă lipsește (culoarea aplicației, altfel extrasă din CSS, altfel neutră `#1f2933`);
* `<link rel="icon">` — numai dacă aplicația nu are deja favicon; `<link rel="apple-touch-icon">` — numai dacă lipsește;
* un script inline mic de înregistrare, activ doar dacă `window.isSecureContext` și protocolul e `http(s):` (deci nu din `file://`).

CSP (fără a slăbi nimic altceva; hash-urile scripturilor se recalculează cu `lib/csp.mjs`):

* `manifest-src 'self'` (se scoate `'none'`; sursele existente rămân);
* `worker-src 'self'` — se păstrează sursele existente (de ex. `blob:`); dacă directiva lipsea, se pornește de la ce permitea implicit lanțul `child-src` → `script-src` → `default-src`, apoi se adaugă `'self'`;
* `img-src` — se adaugă `'self'` (pentru icoane), dacă lipsește.

În marcajul de început se păstrează (codificat) CSP-ul original și lista fișierelor create, ca `remove` să restaureze exact.

## Utilizare

```sh
node fff-kit/pwa/pwa.mjs apply  <dir> --slug S [--name N] [--short N] [--theme #hex] [--bg #hex] [--scope ./]
                                      [--mono XX] [--categories games,entertainment] [--no-icons] [--force] [--force-quine]
node fff-kit/pwa/pwa.mjs check  <dir>      # verifică marcajele, manifestul, icoanele, sw.js, versiunea, CSP; cod de ieșire 1 la probleme
node fff-kit/pwa/pwa.mjs remove <dir>      # scoate blocul, restaurează CSP-ul și șterge fișierele create de apply
```

* **Idempotent:** `apply` rulat din nou nu schimbă nimic (dacă `index.html` e neschimbat). După ce schimbi `<meta name="application-version">`, rulează `apply` din nou: `sw.js` primește versiunea nouă, browserul îl detectează (octeți diferiți), instalează noul cache și îl șterge pe cel vechi.
* `apply` rămâne în afara ordinii de build a nucleului în sensul că modifică `index.html`: rulează-l **înainte** de pasul care calculează SHA-256-ul declarat în eticheta de transparență, sau recalculează-l după.
* `name` e primul segment al `<title>` (înainte de „ — ”, „ | ”, „ : ”); `short_name` e `name` fără sufixul „fără frontiere / fără cont”, tăiat la 12 caractere pe limită de cuvânt. Monograma: inițialele primelor două cuvinte semnificative.
* Icoanele existente, de dimensiunea corectă și care nu au fost create de `apply`, se păstrează.

### Aplicații sărite (nu se suprascrie nimic)

`apply` refuză, cu motiv, aplicațiile care:

* au **deja PWA propriu** (link `manifest`, inclusiv `data:`/blob, sau cod `serviceWorker`, sau `manifest.webmanifest`/`sw.js` proprii); `--force` le suprascrie, dar nu e recomandat (două mecanisme de înregistrare s-ar ciocni);
* sunt **quine** (își salvează propriul `index.html`, de ex. OmniHost, Akasha): cache-ul ar servi o copie veche după ce utilizatorul își salvează datele în fișier; `--force-quine` o permite, pe răspunderea ta.

## Cum se servește

Orice server static prin **https** (GitHub Pages, YunoHost/nginx) sau `localhost` pentru probe. Directorul aplicației trebuie servit cu `index.html`, `sw.js` și `manifest.webmanifest` în același loc (scope `./`). Exemplu local: `python3 -m http.server 8000 -d <dir>` apoi `http://localhost:8000/`.

Mai multe aplicații pe aceeași origine (de ex. `chiuta.github.io/<repo>/`): fiecare are propriul scope (calea ei) și propriul cache (`fff-<slug>-<versiune>`, curățat doar pentru slug-ul respectiv); folosește slug-uri distincte.

## Butonul „Instalează” (`pwa-ui.js`, opțional)

Modul mic `FFF.pwa`, destinat etichetei de transparență; **nu îl injectează `pwa.mjs`** (îl injectează nucleul). Captează `beforeinstallprompt`, expune `supported()`, `installed()`, `canInstall()`, `install()` și `mount(el)`, și emite `pwa:state` pe `FFF.bus`. Textele sunt în `pwa-ui.i18n.json` (8 limbi; fr/it/es/pt/hu/de sunt traduceri automate, **neverificate nativ**). Butonul apare doar când browserul poate instala; pe iOS apare indiciul „Partajează → Adaugă pe ecranul principal”; din `file://` rămâne ascuns.

## Limite (reale)

* **Nu funcționează din `file://`:** service worker-ul cere context sigur. Din fișier aplicația merge, dar nu se instalează.
* **iOS/iPadOS (Safari):** nu există `beforeinstallprompt`; instalarea se face manual din „Partajează → Adaugă pe ecranul principal”. Icoana apple-touch folosită e `icon-192.png`.
* **Firefox desktop** nu instalează PWA; service worker-ul și cache-ul offline funcționează totuși.
* Aplicațiile care cer rețea (API-uri externe, imagini de pe alte domenii) rămân dependente de rețea pentru acele funcții: service worker-ul nu face cereri externe și nu le salvează în cache (cache-uiește doar aceeași origine, doar răspunsuri `200` simple).
* Cache-ul ține **ultima** versiune descărcată: prima deschidere după o actualizare poate afișa încă versiunea veche; cea următoare o arată pe cea nouă (revalidare în fundal; schimbarea versiunii declanșează oricum instalarea imediată a noului `sw.js`).
* Pagini cu bucle de randare foarte grele pot întârzia detectarea actualizării `sw.js` de către browser (observat în teste headless, la o pagină cu animație continuă); în utilizare normală, actualizarea apare la una–două deschideri.
* Pe aceeași origine, spațiul de stocare al browserului e partajat între aplicații; curățarea unui cache nu le afectează pe celelalte.

## Dezinstalarea service worker-ului

* **Utilizator:** setările site-ului din browser → „Șterge datele site-ului” / „Șterge cache-ul”; sau Chrome: `chrome://serviceworker-internals` → *Unregister*; sau DevTools → Application → Service Workers → *Unregister*; aplicația instalată se elimină ca orice aplicație.
* **Autor:** `node pwa.mjs remove <dir>` și republică; vizitatorii care au deja `sw.js` instalat îl păstrează până la următoarea verificare (care primește 404): pentru dezinstalare activă publică un `sw.js` de curățare (`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('fff-')).map(x=>caches.delete(x)))).then(()=>self.registration.unregister())))`).

## Teste

`test/test.mjs` (Playwright, `python3 -m http.server` pe localhost, rețea externă blocată) pe 10 aplicații reale (copii): manifest, înregistrare SW, cache cu shell, repornire offline (`context.setOffline(true)`), versiune nouă ⇒ cache vechi șters, 0 `pageerror`, 0 încălcări CSP, axe fără violări noi față de aplicația neschimbată, `file://` funcțional, `apply` idempotent, `remove` restaurează. `test/batch.mjs` aplică `apply` pe copii ale tuturor aplicațiilor din inventar și verifică CSP-ul rezultat și încărcarea reală. Fără dependențe de terți la rulare; Playwright doar pentru icoane și teste.
