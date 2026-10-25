# Domenii și origini web

> GENERAT de `tools/cname-inventory.mjs` din depozitele de pe disc și din cardurile catalogului. Nu edita de mână: rulează `node tools/cname-inventory.mjs`.
> Starea DNS/GitHub Pages „live” nu poate fi dedusă din depozite; vezi secțiunea „Verificare” pentru comenzile care o confirmă.

## Pe scurt

- Aplicații în catalog: **112** (100 în depozite proprii, 12 în `apps/` din hub).
- Cu **origine proprie** (CNAME `<slug>.chiuta.ro`): **97**.
- Pe **origine partajată** `chiuta.ro`: **15** (12 aplicații din hub + 3 depozit(e) fără CNAME: Profund, Constelar, Origami).
- ATENȚIE, lipsesc de pe disc: Profund, Constelar, Origami.
- De mutat pe origine proprie (sensibile, din hub): **5** cu prioritate 1 (QSO, Poteca, Arbore, Gospodar, Orar), **2** cu prioritate 2 (Lexicon, Bolta).

## De ce contează originea

Pentru browser, o origine este protocol + domeniu + port; **calea nu contează**. `localStorage`, `IndexedDB`, cookie-urile și service worker-ele sunt separate pe origine, nu pe aplicație. Orice aplicație de pe aceeași origine poate citi și scrie datele celorlalte, iar o singură aplicație compromisă (sau un pachet extern încărcat de ea) le expune pe toate. Un CSP strict într-o aplicație nu ajută dacă alta, de pe aceeași origine, este slabă. La auditul din 22 octombrie s-au demonstrat și coliziuni reale de chei (`clepsidra.*` între CLEPSIDRA și Orar).

Rezolvarea gratuită pe GitHub Pages: fiecare depozit își primește propriul subdomeniu (`<slug>.chiuta.ro`) prin fișierul `CNAME`. Pentru browser, `gospodar.chiuta.ro` și `chiuta.ro` sunt origini diferite.

## Aplicații sensibile din hub, de mutat

| Aplicație | Prio | De ce | Depozit nou | Domeniu nou |
|---|---|---|---|---|
| Arbore | 1 | genealogie: persoane reale, relații de rudenie, date de naștere (IndexedDB) | `chiuta/Arbore` | `arbore.chiuta.ro` |
| Gospodar | 1 | buget de gospodărie: conturi, tranzacții, categorii (date financiare personale) | `chiuta/Gospodar` | `gospodar.chiuta.ro` |
| Orar | 1 | calendar și program: evenimente personale; cheile `clepsidra.events/schedule` sunt comune cu CLEPSIDRA (coliziune confirmată la audit) | `chiuta/Orar` | `orar.chiuta.ro` |
| Poteca | 1 | trasee GPX/KML/GeoJSON: locuri frecventate (IndexedDB) | `chiuta/Poteca` | `poteca.chiuta.ro` |
| QSO | 1 | jurnal de stație radioamator: indicative, locatori Maidenhead (loc aproximativ) | `chiuta/QSO` | `qso.chiuta.ro` |
| Bolta | 2 | folosește geolocația și păstrează locul ales | `chiuta/Bolta` | `bolta.chiuta.ro` |
| Lexicon | 2 | dicționare încărcate de utilizator (IndexedDB), potențial volum mare și date proprii | `chiuta/Lexicon` | `lexicon.chiuta.ro` |

Celelalte aplicații din hub (Curatitor, Provenienta, Fabrica, Alfabete, Decibel) nu păstrează date personale sau secrete; pot rămâne pe origine partajată, dar ar urma același traseu dacă se schimbă acest lucru.

Deja pe origine proprie și sensibile (corect): AcademiSearch (cheie în sessionStorage); TranslateHub (cheie în sessionStorage); VaultCrypt (seif criptat); Nexus-fara-frontiere (chei API pentru modele AI); PromptVault (seif de prompturi); Constelar (cheie API în clar în localStorage (confirmat la audit)).

Depozite fără CNAME (origine partajată cu hub-ul, de aliniat la convenție): Profund → `profund.chiuta.ro`, Constelar → `constelar.chiuta.ro`, Origami → `origami.chiuta.ro`.

## Pași exacți: DNS și verificarea domeniului chiuta.ro

Se fac o singură dată pentru domeniu, apoi câte un pas scurt pentru fiecare aplicație mutată.

### 1. Înregistrările DNS ale domeniului (la registrar/furnizorul DNS al lui `chiuta.ro`)

| Nume | Tip | Valoare |
|---|---|---|
| `@` (apex chiuta.ro) | A | `185.199.108.153` |
| `@` (apex chiuta.ro) | A | `185.199.109.153` |
| `@` (apex chiuta.ro) | A | `185.199.110.153` |
| `@` (apex chiuta.ro) | A | `185.199.111.153` |
| `@` | AAAA | `2606:50c0:8000::153` |
| `@` | AAAA | `2606:50c0:8001::153` |
| `@` | AAAA | `2606:50c0:8002::153` |
| `@` | AAAA | `2606:50c0:8003::153` |
| `www` (opțional) | CNAME | `chiuta.github.io.` |
| `<slug>` (ex. `gospodar`), câte unul pentru fiecare aplicație | CNAME | `chiuta.github.io.` |

Notă: adresele de mai sus sunt cele documentate de GitHub pentru Pages; se confirmă în documentația GitHub („Managing a custom domain for your GitHub Pages site”) înainte de aplicare, fiindcă pot fi actualizate. Nu folosi o înregistrare wildcard (`*`) înainte de pasul 2, ca un subdomeniu neconfigurat să nu poată fi revendicat de altcineva.

### 2. Verificarea domeniului `chiuta.ro` în contul GitHub (protejează împotriva revendicării subdomeniilor)

1. GitHub → fotografia de profil → **Settings** → **Pages** (în bara laterală, secțiunea „Code, planning, and automation”) → **Add a domain**.
2. Introdu `chiuta.ro` → **Add domain**. GitHub arată o înregistrare TXT.
3. La furnizorul DNS creează: nume `_github-pages-challenge-chiuta.chiuta.ro` (în unele panouri doar `_github-pages-challenge-chiuta`), tip **TXT**, valoarea exact cum o arată GitHub.
4. Așteaptă propagarea (de obicei minute, cel mult ore), apoi în aceeași pagină apasă **Verify** (sau „Continue verifying”). Domeniul verificat acoperă și toate subdomeniile.
5. Verificare din terminal: `dig +short TXT _github-pages-challenge-chiuta.chiuta.ro` trebuie să returneze valoarea din GitHub.

### 3. Pentru fiecare aplicație (depozit) cu domeniu propriu

1. DNS: adaugă `CNAME <slug>` → `chiuta.github.io.`.
2. Depozitul are deja fișierul `CNAME` la rădăcină, cu un singur rând `<slug>.chiuta.ro` (pentru depozitele noi, creează-l).
3. GitHub → depozitul → **Settings** → **Pages** → **Custom domain** = `<slug>.chiuta.ro` → **Save**. Așteaptă „DNS check successful”.
4. Bifează **Enforce HTTPS** când devine disponibil (certificatul se emite în cel mult ~1 oră).
5. Alternativ din linia de comandă (necesită `gh` autentificat): `gh api -X PUT repos/chiuta/<Depozit>/pages -f cname=<slug>.chiuta.ro` apoi `gh api repos/chiuta/<Depozit>/pages --jq '{cname,https_enforced,status}'`.
6. Verifică: `dig +short CNAME <slug>.chiuta.ro` → `chiuta.github.io.`; `curl -sI https://<slug>.chiuta.ro/ | head -1` → `HTTP/2 200`.

### 4. Mutarea unei aplicații din hub pe depozit propriu (ex. Gospodar)

Datele din `localStorage`/`IndexedDB` **nu se mută singure**: noua origine pornește goală. Ordinea contează.

1. Cere utilizatorilor (și fă tu) un **export** din aplicație (JSON/CSV/GEDCOM/ICS/GPX, după caz) de pe adresa veche `https://chiuta.ro/apps/<Aplicație>/`.
2. Creează depozitul `chiuta/<Aplicație>`, copiază conținutul lui `apps/<Aplicație>/` la rădăcină (inclusiv `sw.js`, `manifest`, `app.json`, teste, README-urile), adaugă `CNAME` și activează Pages (branch `main`, folder `/ (root)`).
3. Parcurge pașii 1 și 3 de mai sus pentru DNS și domeniul personalizat.
4. Rulează în depozitul nou `fff-kit check` și testele aplicației (calea `start_url`/`scope` din manifest și din `sw.js` trebuie să fie relative, deci rămân corecte).
5. În hub, înlocuiește `apps/<Aplicație>/index.html` cu un **stub** (`<meta http-equiv="refresh" content="0;url=https://<slug>.chiuta.ro/">` și un link vizibil) și `apps/<Aplicație>/sw.js` cu un service worker care se dezînregistrează (`self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', e => e.waitUntil(self.registration.unregister().then(() => self.clients.matchAll()).then(cs => cs.forEach(c => c.navigate(c.url)))));`), ca vechile instalări să nu rămână blocate pe versiunea veche.
6. Rulează `node tools/sync-catalog.mjs`: cardul va indica automat depozitul nou, iar `node tools/cname-inventory.mjs` reface acest document.
7. După o perioadă (de exemplu 30 de zile), șterge stub-ul. Datele rămase pe vechea origine (`https://chiuta.ro`) pot fi șterse din setările site-ului din browser.

## Verificare

```
node tools/cname-inventory.mjs --check   # documentul corespunde depozitelor de pe disc
node tools/cname-inventory.mjs --dns     # informativ: interoghează DNS-ul public pentru fiecare CNAME (necesită rețea)
```

## Inventar complet

| Aplicație | Loc | CNAME | Origine | Sensibilă | Observații |
|---|---|---|---|---|---|
| AcademiSearch | depozit | `academisearch.chiuta.ro` | proprie: https://academisearch.chiuta.ro/ | pe origine proprie (corect) |  |
| Arhiva-fara-frontiere | depozit | `arhiva-fara-frontiere.chiuta.ro` | proprie: https://arhiva-fara-frontiere.chiuta.ro/ | — |  |
| DataWeave | depozit | `dataweave.chiuta.ro` | proprie: https://dataweave.chiuta.ro/ | — |  |
| FreeDetect | depozit | `freedetect.chiuta.ro` | proprie: https://freedetect.chiuta.ro/ | — |  |
| MarkdownAtelier | depozit | `markdownatelier.chiuta.ro` | proprie: https://markdownatelier.chiuta.ro/ | — |  |
| OmniHost | depozit | `omnihost.chiuta.ro` | proprie: https://omnihost.chiuta.ro/ | — |  |
| TranslateHub | depozit | `translatehub.chiuta.ro` | proprie: https://translatehub.chiuta.ro/ | pe origine proprie (corect) |  |
| Undava | depozit | `undava.chiuta.ro` | proprie: https://undava.chiuta.ro/ | — |  |
| Arhiva-LinkedIn | depozit | `arhiva-linkedin.chiuta.ro` | proprie: https://arhiva-linkedin.chiuta.ro/ | — |  |
| Cadraj | depozit | `cadraj.chiuta.ro` | proprie: https://cadraj.chiuta.ro/ | — |  |
| Trade-Free-Link-Guardian | depozit | `trade-free-link-guardian.chiuta.ro` | proprie: https://trade-free-link-guardian.chiuta.ro/ | — |  |
| OUTPOST | depozit | `outpost.chiuta.ro` | proprie: https://outpost.chiuta.ro/ | — |  |
| ScryVeil | depozit | `scryveil.chiuta.ro` | proprie: https://scryveil.chiuta.ro/ | — |  |
| Surveyor | depozit | `surveyor.chiuta.ro` | proprie: https://surveyor.chiuta.ro/ | — |  |
| Threads-fara-cont | depozit | `threads-fara-cont.chiuta.ro` | proprie: https://threads-fara-cont.chiuta.ro/ | — |  |
| Vitrina | depozit | `vitrina.chiuta.ro` | proprie: https://vitrina.chiuta.ro/ | — |  |
| X-fara-cont | depozit | `x-fara-cont.chiuta.ro` | proprie: https://x-fara-cont.chiuta.ro/ | — |  |
| Curatitor | hub (apps/) | — | partajată: https://chiuta.ro/apps/Curatitor/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | — |  |
| Provenienta | hub (apps/) | — | partajată: https://chiuta.ro/apps/Provenienta/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | — |  |
| VaultCrypt | depozit | `vaultcrypt.chiuta.ro` | proprie: https://vaultcrypt.chiuta.ro/ | pe origine proprie (corect) |  |
| ATINGERE | depozit | `atingere.chiuta.ro` | proprie: https://atingere.chiuta.ro/ | — |  |
| Clopotel | depozit | `clopotel.chiuta.ro` | proprie: https://clopotel.chiuta.ro/ | — |  |
| Monstrarium | depozit | `monstrarium.chiuta.ro` | proprie: https://monstrarium.chiuta.ro/ | — |  |
| ETER | depozit | `eter.chiuta.ro` | proprie: https://eter.chiuta.ro/ | — |  |
| Fabrica | hub (apps/) | — | partajată: https://chiuta.ro/apps/Fabrica/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | — |  |
| FASCICUL | depozit | `fascicul.chiuta.ro` | proprie: https://fascicul.chiuta.ro/ | — |  |
| INDICATIV | depozit | `indicativ.chiuta.ro` | proprie: https://indicativ.chiuta.ro/ | — |  |
| PULS | depozit | `puls.chiuta.ro` | proprie: https://puls.chiuta.ro/ | — |  |
| QSO | hub (apps/) | — | partajată: https://chiuta.ro/apps/QSO/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 1) |  |
| RegexLab | depozit | `regexlab.chiuta.ro` | proprie: https://regexlab.chiuta.ro/ | — |  |
| SEOptimum | depozit | `seoptimum.chiuta.ro` | proprie: https://seoptimum.chiuta.ro/ | — |  |
| SEVA | depozit | `seva.chiuta.ro` | proprie: https://seva.chiuta.ro/ | — |  |
| Alfabete | hub (apps/) | — | partajată: https://chiuta.ro/apps/Alfabete/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | — |  |
| Lexicon | hub (apps/) | — | partajată: https://chiuta.ro/apps/Lexicon/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 2) |  |
| Limpezimea | depozit | `limpezimea.chiuta.ro` | proprie: https://limpezimea.chiuta.ro/ | — |  |
| Nota-Zero | depozit | `nota-zero.chiuta.ro` | proprie: https://nota-zero.chiuta.ro/ | — |  |
| Pendulul | depozit | `pendulul.chiuta.ro` | proprie: https://pendulul.chiuta.ro/ | — |  |
| PrintreInteligente | depozit | `printreinteligente.chiuta.ro` | proprie: https://printreinteligente.chiuta.ro/ | — |  |
| Zicala | depozit | `zicala.chiuta.ro` | proprie: https://zicala.chiuta.ro/ | — |  |
| AGORA | depozit | `agora.chiuta.ro` | proprie: https://agora.chiuta.ro/ | — |  |
| Bolta | hub (apps/) | — | partajată: https://chiuta.ro/apps/Bolta/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 2) |  |
| Cupa-Mondiala-2026 | depozit | `cupa-mondiala-2026.chiuta.ro` | proprie: https://cupa-mondiala-2026.chiuta.ro/ | — |  |
| Eclipsa-2027 | depozit | `eclipsa-2027.chiuta.ro` | proprie: https://eclipsa-2027.chiuta.ro/ | — |  |
| Horizons.BeyondLimits | depozit | `horizons-beyondlimits.chiuta.ro` | proprie: https://horizons-beyondlimits.chiuta.ro/ | — |  |
| Hyper4D | depozit | `hyper4d.chiuta.ro` | proprie: https://hyper4d.chiuta.ro/ | — |  |
| IncredibleCosmos | depozit | `incrediblecosmos.chiuta.ro` | proprie: https://incrediblecosmos.chiuta.ro/ | — |  |
| Nemurirea | depozit | `nemurirea.chiuta.ro` | proprie: https://nemurirea.chiuta.ro/ | — |  |
| orarium | depozit | `orarium.chiuta.ro` | proprie: https://orarium.chiuta.ro/ | — |  |
| TerRa | depozit | `terra.chiuta.ro` | proprie: https://terra.chiuta.ro/ | — |  |
| Universul-Observabil | depozit | `universul-observabil.chiuta.ro` | proprie: https://universul-observabil.chiuta.ro/ | — |  |
| Universul-Observabil-1D | depozit | `universul-observabil-1d.chiuta.ro` | proprie: https://universul-observabil-1d.chiuta.ro/ | — |  |
| Universul-Observabil-2D | depozit | `universul-observabil-2d.chiuta.ro` | proprie: https://universul-observabil-2d.chiuta.ro/ | — |  |
| Universul-Observabil-3D | depozit | `universul-observabil-3d.chiuta.ro` | proprie: https://universul-observabil-3d.chiuta.ro/ | — |  |
| VietAR | depozit | `vietar.chiuta.ro` | proprie: https://vietar.chiuta.ro/ | — |  |
| ExploratoriiEco | depozit | `exploratoriieco.chiuta.ro` | proprie: https://exploratoriieco.chiuta.ro/ | — |  |
| FieldObserver | depozit | `fieldobserver.chiuta.ro` | proprie: https://fieldobserver.chiuta.ro/ | — |  |
| Poteca | hub (apps/) | — | partajată: https://chiuta.ro/apps/Poteca/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 1) |  |
| URME | depozit | `urme.chiuta.ro` | proprie: https://urme.chiuta.ro/ | — |  |
| VATRA | depozit | `vatra.chiuta.ro` | proprie: https://vatra.chiuta.ro/ | — |  |
| ASMR | depozit | `asmr.chiuta.ro` | proprie: https://asmr.chiuta.ro/ | — |  |
| BorderlessMelodies | depozit | `borderlessmelodies.chiuta.ro` | proprie: https://borderlessmelodies.chiuta.ro/ | — |  |
| CalmWaves | depozit | `calmwaves.chiuta.ro` | proprie: https://calmwaves.chiuta.ro/ | — |  |
| Decibel | hub (apps/) | — | partajată: https://chiuta.ro/apps/Decibel/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | — |  |
| EcoulSpectral | depozit | `ecoulspectral.chiuta.ro` | proprie: https://ecoulspectral.chiuta.ro/ | — |  |
| FrequencyLaboratory | depozit | `frequencylaboratory.chiuta.ro` | proprie: https://frequencylaboratory.chiuta.ro/ | — |  |
| generator-frecvente | depozit | `generator-frecvente.chiuta.ro` | proprie: https://generator-frecvente.chiuta.ro/ | — |  |
| Akasha | depozit | `akasha.chiuta.ro` | proprie: https://akasha.chiuta.ro/ | — |  |
| Arbore | hub (apps/) | — | partajată: https://chiuta.ro/apps/Arbore/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 1) |  |
| CLEPSIDRA | depozit | `clepsidra.chiuta.ro` | proprie: https://clepsidra.chiuta.ro/ | — |  |
| Gospodar | hub (apps/) | — | partajată: https://chiuta.ro/apps/Gospodar/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 1) |  |
| Orar | hub (apps/) | — | partajată: https://chiuta.ro/apps/Orar/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 1) |  |
| Belot-fara-frontiere | depozit | `belot-fara-frontiere.chiuta.ro` | proprie: https://belot-fara-frontiere.chiuta.ro/ | — |  |
| Carti-de-joc-fara-frontiere | depozit | `carti-de-joc-fara-frontiere.chiuta.ro` | proprie: https://carti-de-joc-fara-frontiere.chiuta.ro/ | — |  |
| Dame-fara-frontiere | depozit | `dame-fara-frontiere.chiuta.ro` | proprie: https://dame-fara-frontiere.chiuta.ro/ | — |  |
| Domino-fara-frontiere | depozit | `domino-fara-frontiere.chiuta.ro` | proprie: https://domino-fara-frontiere.chiuta.ro/ | — |  |
| Go-fara-frontiere | depozit | `go-fara-frontiere.chiuta.ro` | proprie: https://go-fara-frontiere.chiuta.ro/ | — |  |
| Mahjong-fara-frontiere | depozit | `mahjong-fara-frontiere.chiuta.ro` | proprie: https://mahjong-fara-frontiere.chiuta.ro/ | — |  |
| Profund | LIPSĂ | — | partajată: https://chiuta.ro/Profund/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `profund.chiuta.ro` |
| Remi-fara-frontiere | depozit | `remi-fara-frontiere.chiuta.ro` | proprie: https://remi-fara-frontiere.chiuta.ro/ | — |  |
| Sah-fara-frontiere | depozit | `sah-fara-frontiere.chiuta.ro` | proprie: https://sah-fara-frontiere.chiuta.ro/ | — |  |
| Scopone-fara-frontiere | depozit | `scopone-fara-frontiere.chiuta.ro` | proprie: https://scopone-fara-frontiere.chiuta.ro/ | — |  |
| Solitaire-fara-frontiere | depozit | `solitaire-fara-frontiere.chiuta.ro` | proprie: https://solitaire-fara-frontiere.chiuta.ro/ | — |  |
| Sudoku-fara-frontiere | depozit | `sudoku-fara-frontiere.chiuta.ro` | proprie: https://sudoku-fara-frontiere.chiuta.ro/ | — |  |
| Table-fara-frontiere | depozit | `table-fara-frontiere.chiuta.ro` | proprie: https://table-fara-frontiere.chiuta.ro/ | — |  |
| Zaruri-fara-frontiere | depozit | `zaruri-fara-frontiere.chiuta.ro` | proprie: https://zaruri-fara-frontiere.chiuta.ro/ | — |  |
| AI-Liber | depozit | `ai-liber.chiuta.ro` | proprie: https://ai-liber.chiuta.ro/ | — |  |
| ARENA | depozit | `arena.chiuta.ro` | proprie: https://arena.chiuta.ro/ | — |  |
| LocalMind | depozit | `localmind.chiuta.ro` | proprie: https://localmind.chiuta.ro/ | — |  |
| Nexus-fara-frontiere | depozit | `nexus-fara-frontiere.chiuta.ro` | proprie: https://nexus-fara-frontiere.chiuta.ro/ | pe origine proprie (corect) |  |
| PromptVault | depozit | `promptvault.chiuta.ro` | proprie: https://promptvault.chiuta.ro/ | pe origine proprie (corect) |  |
| VoiceAtelier | depozit | `voiceatelier.chiuta.ro` | proprie: https://voiceatelier.chiuta.ro/ | — |  |
| API-fara-frontiere | depozit | `api-fara-frontiere.chiuta.ro` | proprie: https://api-fara-frontiere.chiuta.ro/ | — |  |
| Constelar | LIPSĂ | — | partajată: https://chiuta.ro/Constelar/ (proiect fără CNAME, aceeași origine cu hub-ul) | pe origine proprie (corect) | fără CNAME; propus `constelar.chiuta.ro` |
| OAZA | depozit | `oaza.chiuta.ro` | proprie: https://oaza.chiuta.ro/ | — |  |
| Origami | LIPSĂ | — | partajată: https://chiuta.ro/Origami/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `origami.chiuta.ro` |
| Trusa-fara-frontiere | depozit | `trusa-fara-frontiere.chiuta.ro` | proprie: https://trusa-fara-frontiere.chiuta.ro/ | — |  |
| VNTV | depozit | `vntv.chiuta.ro` | proprie: https://vntv.chiuta.ro/ | — |  |
| OSATURA | depozit | `osatura.chiuta.ro` | proprie: https://osatura.chiuta.ro/ | — | proiect Rust (CLI + studio + WASM), site propriu; depozit chiuta/osatura |
| ACORDAJ | depozit | `acordaj.chiuta.ro` | proprie: https://acordaj.chiuta.ro/ | — |  |
| Afrodisiace-fara-frontiere | depozit | `afrodisiace-fara-frontiere.chiuta.ro` | proprie: https://afrodisiace-fara-frontiere.chiuta.ro/ | — |  |
| Aurora | depozit | `aurora.chiuta.ro` | proprie: https://aurora.chiuta.ro/ | — |  |
| Bioenergoterapie | depozit | `bioenergoterapie.chiuta.ro` | proprie: https://bioenergoterapie.chiuta.ro/ | — |  |
| ECLIPSA | depozit | `eclipsa.chiuta.ro` | proprie: https://eclipsa.chiuta.ro/ | — |  |
| HoroScop | depozit | `horoscop.chiuta.ro` | proprie: https://horoscop.chiuta.ro/ | — |  |
| Inforenergetica | depozit | `inforenergetica.chiuta.ro` | proprie: https://inforenergetica.chiuta.ro/ | — |  |
| NOMIA | depozit | `nomia.chiuta.ro` | proprie: https://nomia.chiuta.ro/ | — |  |
| NumeroLogIA | depozit | `numerologia.chiuta.ro` | proprie: https://numerologia.chiuta.ro/ | — |  |
| Numerologie | depozit | `numerologie.chiuta.ro` | proprie: https://numerologie.chiuta.ro/ | — |  |
| Radiestezie | depozit | `radiestezie.chiuta.ro` | proprie: https://radiestezie.chiuta.ro/ | — |  |
| Reiki | depozit | `reiki.chiuta.ro` | proprie: https://reiki.chiuta.ro/ | — |  |
| Tarot | depozit | `tarot.chiuta.ro` | proprie: https://tarot.chiuta.ro/ | — |  |
| ValeaPlopului1972 | depozit | `valeaplopului1972.chiuta.ro` | proprie: https://valeaplopului1972.chiuta.ro/ | — |  |
