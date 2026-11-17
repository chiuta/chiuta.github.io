# Compatibilitate cu browsere mai vechi

Toate aplicațiile single-file HTML din portofoliu (și paginile de prezentare, demo-urile și variantele single-file ale depozitelor cu build propriu) sunt scrise sau coborâte la același prag. Pragul, uneltele care îl păzesc și limitele lui sunt descrise aici. Ce n-am verificat, scrie la „Limite”.

## 1. Ce se garantează

| Motor | Versiune minimă | De ce aceasta |
|---|---|---|
| Chrome / Chromium / Edge nou | 55 | prima versiune cu `async`/`await` (ES2017) |
| Edge vechi (EdgeHTML) | 15 | idem |
| Firefox | 52 | idem (ultima ediție pentru Windows XP/Vista) |
| Safari (macOS) | 10.1 | idem |
| Safari pe iOS/iPadOS | 10.3 | Safari 10.1 vine cu iOS 10.3 |

„Garantat” înseamnă patru lucruri, fiecare verificat de o unealtă din `tools/compat/` (vezi § 3), nu „pe încredere”:

1. **Sintaxa**: fiecare script inline se parsează la nivelul ES2017 (acorn, `ecmaVersion: 2017`). Nu apar `?.`, `??`, `||=`, `catch {}` fără parametru, separatori numerici, literale BigInt, spread de obiect, `import()` în cod clasic, regex cu `\p{…}`/lookbehind/grupuri cu nume/steagurile `s` `d` `v`, câmpuri de clasă, generatoare asincrone, `for await`.
2. **API-urile** mai noi decât pragul sunt fie acoperite de stratul `fff-compat` (rezerve definite doar dacă lipsesc), fie declarate cu `FFF.compat.need(…)`, fie semnalate în audit ca avertisment.
3. **Stratul există**: orice pagină care folosește `FFF.rx`/`FFF.imp` sau un API acoperit are `<script id="fff-compat">` (și `fff-imp` când trebuie), altfel auditul pică.
4. **Comportamentul**: fiecare pagină se deschide într-un „motor vechi” simulat (API-urile peste prag șterse, regex fără sintaxă nouă, fără `<dialog>` nativ) și nu produce nicio eroare de pagină, de CSP sau excepție neprinsă pe care n-o produce în Chromium normal; dialogul „Transparență” se deschide și se închide cu Esc.

Ce înseamnă „merge” într-un browser de la prag: pagina pornește, funcțiile de bază lucrează, dialogurile și copia de siguranță funcționează. **Nu** înseamnă aspect identic: unele rafinamente CSS (de exemplu `backdrop-filter`, `:has()`, unități `dvh`) lipsesc, iar rezervele de CSS acoperă doar cazurile de mai jos (§ 2.4). Funcțiile care cer ceva ce kitul nu poate emula (`BigInt`, `BroadcastChannel`, `CompressionStream`, `OffscreenCanvas`, `Intl.Segmenter`, partajarea nativă, File System Access) se opresc cu un mesaj tradus, iar restul aplicației rămâne utilizabil.

## 2. Cum funcționează (patru straturi)

### 2.1 Sintaxa: `tools/compat/lower.mjs`

Un codemod care transformă *doar nodurile vizate* (parsare cu acorn, înlocuiri pe poziții; comentariile, spațiile și ordinea rămân octet cu octet). Reguli: `?.`, `??`, `||=`/`&&=`/`??=`, `catch {}`, separatori numerici, BigInt → `BigInt("…")`, spread de obiect → `Object.assign({}, …)`, `import()` → `$fffImp(…)`, regex cu sintaxă nouă și `new RegExp("…\p{…}")` → `$fffRx("…", "flags")`. Generatoarele asincrone, `for await`, rest-ul de obiect în pattern și câmpurile de clasă trec prin esbuild (țintă `es2017`) când acesta e disponibil; rezultatul esbuild trece apoi prin aceleași reguli.

`$fffRx` și `$fffImp` sunt două ajutoare locale, puse la începutul scriptului: sunt `FFF.rx`/`FFF.imp` când stratul `fff-compat` există și, altfel, `new RegExp(…)` nativ, respectiv o promisiune respinsă. Aplicația nu devine mai fragilă decât originalul în motoarele moderne nici dacă kitul e scos sau întârzie.

Ce nu se poate coborî automat nu se ghicește: apare în `manual` (cu locul) și raportul iese cu cod 1. Excepțiile aprobate stau în `compat.config.json` → `exceptions` și cer un motiv scris (`because`).

Garanții ale codemodului, toate cu teste (`tests/compat-lower.test.mjs`): rezultat identic înainte/după pe zeci de eșantioane rulate în `vm`; rezultatul se parsează la ES2017; lipirea corectă a cuvintelor-cheie (`return{...s}` → `return Object.assign(…)`); textul din `${…}` nu primește spații; un control de integritate al identificatorilor (`tokenCheck`) oprește scrierea dacă s-ar fi lipit ceva; rularea fără stratul FFF dă același rezultat ca originalul.

### 2.2 API-uri: `fff-kit/src/compat.js` (kit ≥ 1.8.0)

Script ES5, primul din blocul kit. Rezerve de API definite doar dacă lipsesc, `<dialog>` emulat, `FFF.rx`, `FFF.imp`, avertisment în 8 limbi, `FFF.compat.need`. Lista completă: [`fff-kit/SPEC.md`](../fff-kit/SPEC.md) § FFF.compat.

### 2.3 Regex și import dinamic

Regexul scris ca literal cu sintaxă nouă nu poate fi nici măcar parsat de un motor vechi (SyntaxError pe tot scriptul). De aceea devine `$fffRx("sursă", "flaguri")`: nativ când motorul îl știe, altfel `\p{…}` → clase explicite, steagul `s` → `[\s\S]`, lookbehind emulat. Excepția: steagul `d` (indices) nu se emulează; aplicația care citește `m.indices` are un fallback propriu, descris în `compat.config.json` (VERIGA, Trade-Free-Link-Guardian), comparat cu rezultatul nativ pe sute de mii de potriviri în testele lor.

### 2.4 CSS și `<dialog>`

* `<dialog>` lipsă (Firefox < 98, Safari < 15.4): emulat; stilurile stau sub `html.fff-no-dialog`.
* Selectoare fără `:where()` / `:not(listă)` (Chrome < 88): stilurile panoului de accesibilitate au variante simple sub `html.fff-oldsel`; limită: descendenții casetelor `data-fff-keep` nu sunt scutiți de „contrast ridicat”.
* `gap` în flex lipsă (Chrome < 84, Safari < 14.1): clasa `html.fff-no-flexgap`.
* Unități `vh`/`vw`/`vmin`/`vmax` sub zoomul automat al kitului (`FFF.view`): corecția nu creează niciun element `<style>`, deci merge și sub un `style-src` strict (doar hash-uri) — în browserele cu foi construibile (Chrome 73+, Firefox 101+, Safari 16.4+) printr-o foaie `adoptedStyleSheets`, în cele mai vechi prin rescrierea pe loc a regulilor (CSSOM). Un `<style>` creat din script ar fi fost blocat și raportat ca încălcare CSP (`style-src-elem`).
* Declarații duble înaintea `calc(… env(safe-area-inset-…))`, ca un motor care nu știe `env()` să păstreze valoarea simplă.
* Restul diferențelor de CSS (auditul le listează pe aplicație) rămân avertismente: nu le ascundem și nu pretindem că le-am rezolvat.

## 3. Uneltele (`tools/compat/`)

Dependențe de dezvoltare (nu intră în aplicații): `acorn` (obligatoriu), `esbuild` (opțional, pentru cazurile de mai sus), `playwright` + un Chromium (doar pentru `smoke.mjs`). Fără instalare în depozit, se pun într-un director și se arată cu `NODE_PATH`.

```
node tools/compat/audit.mjs   --root <depozite> [--only A,B] [--skip A,B] [--gate] [--quiet] [--json data/compat.json]
node tools/compat/lower.mjs   --root <depozite> [--only A,B] [--skip A,B] [--write] [--verbose] [--json raport.json]
node tools/compat/kit-sync.mjs --root <depozite> [--only A,B] [--write] [--force]
node tools/compat/smoke.mjs   --root <depozite> [--only A,B] [--shard K/N] [--jobs 4] [--mode both|legacy|native] [--json fisier]
node tests/compat-lower.test.mjs
node fff-kit/test/legacy.test.mjs
```

* **`audit.mjs`**: pentru fiecare țintă măsoară sintaxa față de prag, existența stratului, API-urile și CSS-ul peste prag (cu „acoperit/neacoperit”). `--gate` iese cu cod 1 la orice eșec (sintaxă peste prag, strat lipsă, `FFF.rx`/`FFF.imp`/API acoperit fără `fff-compat`).
* **Poarta „ajutor serializat”** (în `audit.mjs`, `serializedHelperUses`): codemodul pune `$fffRx(…)`/`$fffImp(…)` în locul regex-urilor și al `import()`; ajutoarele sunt definite o singură dată în prologul paginii. O funcție al cărei **text** se serializează (`f.toString()` într-un script exportat, într-un Worker creat din Blob, `new Function`, șablon `${f}`) pierde acel prolog și ar da `ReferenceError` abia la rulare. Auditul o găsește static și pică dacă funcția care serializează nu scrie și definiția ajutorului în codul generat (un șir cu `var $fffRx = function (s, f) { return new RegExp(s, f); };`, cum fac DataWeave `genJs()` și Curatitor `getWorker()`) sau dacă ajutorul e declarat local. Rezolvarea numelor e pe domenii, deci o variabilă locală cu același nume nu dă alarmă falsă.
* **`lower.mjs`**: fără `--write` raportează; cu `--write` rescrie scripturile, adaugă stratul `fff-compat` paginilor fără kit (doar dacă folosesc `FFF.rx`/`FFF.imp`/API acoperit) și recalculează hash-urile CSP. Nu atinge blocul kit (`<!--fff:kit:start … end-->`) și nici `fff-info`.
* **`kit-sync.mjs`**: aduce la versiunea curentă a kitului variantele distribuite separat (`extraTargets`) cu bloc kit mai vechi, prin comanda oficială `build.mjs apply` pe o copie temporară (nu atinge `app.json`). `--force` reaplică kitul și când versiunea e la zi (după o modificare a surselor kitului fără ridicarea versiunii; `apply` e idempotent).
* **`smoke.mjs`** + **`legacy-env.mjs`**: motorul vechi simulat. Nu poate verifica sintaxa (o face auditul) și nici aspectul CSS.
* `compat.config.json` = **singurul loc** unde se schimbă ținta: `floor` (versiuni + `ecma`), `kitMinVersion`, `exceptions`, `extraTargets` (fișiere HTML suplimentare ale unui depozit, de ex. pagini de prezentare sau variante de distribuție).

### Lanțul după orice modificare a unei aplicații

```
# 1. build-ul propriu al depozitului (dacă există: build.py, build.js, publish.sh …)
# 2. kitul:      node fff-kit/build.mjs release <dir> --bump patch --no-tests      (include fixcsp, info, check)
# 3. sintaxa:    node tools/compat/lower.mjs --root <depozite> --only <Nume> --write
# 4. poarta:     node tools/compat/audit.mjs --root <depozite> --only <Nume> --gate
# 5. motorul vechi: node tools/compat/smoke.mjs --root <depozite> --only <Nume>
```

Depozitele cu build propriu (PUNCTUM, VNTV, TEZAUR, FASCICUL, osatura …) regenerează fișierul HTML din surse: rulează pașii 3–5 **după** build, altfel următorul build rescrie fișierul necoborât. Auditul din CI prinde exact această abatere.

## 4. Cum se schimbă pragul

Se editează `floor` din `tools/compat/compat.config.json` (versiuni de browser și `ecma`) și se rulează `audit.mjs --gate`. **Ridicarea** pragului (de exemplu la ES2020) nu strică nimic: codul deja coborât rămâne valid, iar auditul acceptă sintaxa până la noul nivel; codemodul însă coboară în continuare tot ce știe, fără un mod „doar peste nivelul X”. **Coborârea** sub ES2017 (Chrome 49–54, Safari 10.0) nu e implementată: ar cere transformarea lui `async`/`await` și a operatorului `**`, iar rezervele din `compat.js` presupun cel puțin ES5 + `Promise`/`Symbol`/`Map`/`Set` (fără ele apare avertismentul „browser prea vechi”, nu un ecran gol).

## 5. Aplicații noi

Se scriu **de la început** în subsetul ES2017 (ghid: [GHID-AUTORI.md](GHID-AUTORI.md) § 10): fără `?.`/`??`/…; regex cu `\p{…}` sau lookbehind prin `FFF.rx`; `import()` prin `FFF.imp`; API-uri noi doar acoperite sau cu `FFF.compat.need`. `audit.mjs --gate` și `smoke.mjs` sunt pași obligatorii înaintea publicării.

## 6. Limite (pe cinstite)

* **Nu avem un Chrome 55 real, un Firefox 52 sau un iOS 10 în mediul de lucru.** Sintaxa e verificată formal (parser ES2017); comportamentul e verificat într-un Chromium modern din care am scos ce lipsea în motoarele vechi. Asta prinde regresii de compatibilitate de cod, nu defecte specifice unui motor (randare, bug-uri de motor, performanță, limite de memorie). O trecere pe dispozitive reale rămâne de făcut; un raport de la cineva cu un dispozitiv vechi este binevenit (issue cu aplicația, versiunea browserului și mesajul din consolă).
* **CSS**: nu există un parser CSS la prag. Auditul numără caracteristicile peste prag (`:has()`, `dvh`, `color-mix()`, `@container`, `@layer`, `backdrop-filter`, nesting …) și le raportează; rezervele sunt doar cele din § 2.4.
* **Poarta „ajutor serializat” e analiză statică**: prinde tiparele uzuale (`F.toString()`, `String(F)`, `${F}`, `'…' + F`, `[F, G].map(f => f.toString())`), nu și o listă de funcții păstrată într-o variabilă și serializată în altă funcție. Dacă o aplicație își serializează codul altfel, verifică exportul/Worker-ul în test (DataWeave: `tests/notebook.test.mjs`; Curatitor: testul „MP3 în Worker”).
* **Grupurile cu nume în regex** nu se coboară automat (apar în `manual`). Nu există în portofoliu la data aceasta.
* **Codul de terți** inclus în pagină (de exemplu Three.js) a fost parsat ca orice alt script; ce nu s-a putut coborî (câmpuri de clasă) a trecut prin esbuild. Nu l-am rulat pe un motor real.
* **Dimensiunea**: stratul `fff-compat` adaugă ~54 KB (necomprimat) la fiecare pagină cu kit; codemodul adaugă ajutoarele `$fffRx`/`$fffImp` (câteva sute de octeți) și rezultatele intermediare ale esbuild acolo unde a fost nevoie.
* **Nu emulăm** `BigInt`, `BroadcastChannel`, `CompressionStream`, `OffscreenCanvas`, `Intl.RelativeTimeFormat/ListFormat/Segmenter`, `navigator.share`, File System Access; aplicațiile care le folosesc declară `FFF.compat.need(…)` sau au rezervă proprie.
