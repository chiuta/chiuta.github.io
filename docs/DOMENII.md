# Domenii și origini web

> GENERAT de `tools/cname-inventory.mjs` din depozitele de pe disc și din cardurile catalogului. Nu edita de mână: rulează `node tools/cname-inventory.mjs`.
> Starea DNS/GitHub Pages „live” nu poate fi dedusă din depozite; vezi secțiunea „Verificare” pentru comenzile care o confirmă.

## Pe scurt

- Aplicații în catalog: **111** (99 în depozite proprii, 12 în `apps/` din hub).
- Cu **origine proprie** (CNAME `<slug>.chiuta.ro`): **1**.
- Pe **origine partajată** `chiuta.ro`: **110** (12 aplicații din hub + 98 depozit(e) fără CNAME: AcademiSearch, Arhiva-fara-frontiere, DataWeave, FreeDetect, MarkdownAtelier, OmniHost, TranslateHub, Undava, Arhiva-LinkedIn, Cadraj, Trade-Free-Link-Guardian, OUTPOST, ScryVeil, Surveyor, Threads-fara-cont, Vitrina, X-fara-cont, VaultCrypt, ATINGERE, Clopotel, ETER, FASCICUL, INDICATIV, PULS, RegexLab, SEOptimum, SEVA, Limpezimea, Nota-Zero, Pendulul, PrintreInteligente, Zicala, AGORA, Cupa-Mondiala-2026, Eclipsa-2027, Horizons.BeyondLimits, Hyper4D, IncredibleCosmos, Nemurirea, orarium, TerRa, Universul-Observabil, Universul-Observabil-1D, Universul-Observabil-2D, Universul-Observabil-3D, VietAR, ExploratoriiEco, FieldObserver, URME, VATRA, ASMR, BorderlessMelodies, CalmWaves, EcoulSpectral, FrequencyLaboratory, generator-frecvente, Akasha, CLEPSIDRA, Belot-fara-frontiere, Carti-de-joc-fara-frontiere, Dame-fara-frontiere, Domino-fara-frontiere, Go-fara-frontiere, Mahjong-fara-frontiere, Profund, Remi-fara-frontiere, Sah-fara-frontiere, Scopone-fara-frontiere, Solitaire-fara-frontiere, Sudoku-fara-frontiere, Table-fara-frontiere, Zaruri-fara-frontiere, AI-Liber, ARENA, LocalMind, Nexus-fara-frontiere, PromptVault, VoiceAtelier, API-fara-frontiere, Constelar, OAZA, Origami, Trusa-fara-frontiere, VNTV, ACORDAJ, Afrodisiace-fara-frontiere, Aurora, Bioenergoterapie, ECLIPSA, HoroScop, Inforenergetica, NOMIA, NumeroLogIA, Numerologie, Radiestezie, Reiki, Tarot, ValeaPlopului1972).
- ATENȚIE, lipsesc de pe disc: AcademiSearch, Arhiva-fara-frontiere, DataWeave, FreeDetect, MarkdownAtelier, OmniHost, TranslateHub, Undava, Arhiva-LinkedIn, Cadraj, Trade-Free-Link-Guardian, OUTPOST, ScryVeil, Surveyor, Threads-fara-cont, Vitrina, X-fara-cont, VaultCrypt, ATINGERE, Clopotel, ETER, FASCICUL, INDICATIV, PULS, RegexLab, SEOptimum, SEVA, Limpezimea, Nota-Zero, Pendulul, PrintreInteligente, Zicala, AGORA, Cupa-Mondiala-2026, Eclipsa-2027, Horizons.BeyondLimits, Hyper4D, IncredibleCosmos, Nemurirea, orarium, TerRa, Universul-Observabil, Universul-Observabil-1D, Universul-Observabil-2D, Universul-Observabil-3D, VietAR, ExploratoriiEco, FieldObserver, URME, VATRA, ASMR, BorderlessMelodies, CalmWaves, EcoulSpectral, FrequencyLaboratory, generator-frecvente, Akasha, CLEPSIDRA, Belot-fara-frontiere, Carti-de-joc-fara-frontiere, Dame-fara-frontiere, Domino-fara-frontiere, Go-fara-frontiere, Mahjong-fara-frontiere, Profund, Remi-fara-frontiere, Sah-fara-frontiere, Scopone-fara-frontiere, Solitaire-fara-frontiere, Sudoku-fara-frontiere, Table-fara-frontiere, Zaruri-fara-frontiere, AI-Liber, ARENA, LocalMind, Nexus-fara-frontiere, PromptVault, VoiceAtelier, API-fara-frontiere, Constelar, OAZA, Origami, Trusa-fara-frontiere, VNTV, ACORDAJ, Afrodisiace-fara-frontiere, Aurora, Bioenergoterapie, ECLIPSA, HoroScop, Inforenergetica, NOMIA, NumeroLogIA, Numerologie, Radiestezie, Reiki, Tarot, ValeaPlopului1972.
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

Depozite fără CNAME (origine partajată cu hub-ul, de aliniat la convenție): AcademiSearch → `academisearch.chiuta.ro`, Arhiva-fara-frontiere → `arhiva-fara-frontiere.chiuta.ro`, DataWeave → `dataweave.chiuta.ro`, FreeDetect → `freedetect.chiuta.ro`, MarkdownAtelier → `markdownatelier.chiuta.ro`, OmniHost → `omnihost.chiuta.ro`, TranslateHub → `translatehub.chiuta.ro`, Undava → `undava.chiuta.ro`, Arhiva-LinkedIn → `arhiva-linkedin.chiuta.ro`, Cadraj → `cadraj.chiuta.ro`, Trade-Free-Link-Guardian → `trade-free-link-guardian.chiuta.ro`, OUTPOST → `outpost.chiuta.ro`, ScryVeil → `scryveil.chiuta.ro`, Surveyor → `surveyor.chiuta.ro`, Threads-fara-cont → `threads-fara-cont.chiuta.ro`, Vitrina → `vitrina.chiuta.ro`, X-fara-cont → `x-fara-cont.chiuta.ro`, VaultCrypt → `vaultcrypt.chiuta.ro`, ATINGERE → `atingere.chiuta.ro`, Clopotel → `clopotel.chiuta.ro`, ETER → `eter.chiuta.ro`, FASCICUL → `fascicul.chiuta.ro`, INDICATIV → `indicativ.chiuta.ro`, PULS → `puls.chiuta.ro`, RegexLab → `regexlab.chiuta.ro`, SEOptimum → `seoptimum.chiuta.ro`, SEVA → `seva.chiuta.ro`, Limpezimea → `limpezimea.chiuta.ro`, Nota-Zero → `nota-zero.chiuta.ro`, Pendulul → `pendulul.chiuta.ro`, PrintreInteligente → `printreinteligente.chiuta.ro`, Zicala → `zicala.chiuta.ro`, AGORA → `agora.chiuta.ro`, Cupa-Mondiala-2026 → `cupa-mondiala-2026.chiuta.ro`, Eclipsa-2027 → `eclipsa-2027.chiuta.ro`, Horizons.BeyondLimits → `horizons-beyondlimits.chiuta.ro`, Hyper4D → `hyper4d.chiuta.ro`, IncredibleCosmos → `incrediblecosmos.chiuta.ro`, Nemurirea → `nemurirea.chiuta.ro`, orarium → `orarium.chiuta.ro`, TerRa → `terra.chiuta.ro`, Universul-Observabil → `universul-observabil.chiuta.ro`, Universul-Observabil-1D → `universul-observabil-1d.chiuta.ro`, Universul-Observabil-2D → `universul-observabil-2d.chiuta.ro`, Universul-Observabil-3D → `universul-observabil-3d.chiuta.ro`, VietAR → `vietar.chiuta.ro`, ExploratoriiEco → `exploratoriieco.chiuta.ro`, FieldObserver → `fieldobserver.chiuta.ro`, URME → `urme.chiuta.ro`, VATRA → `vatra.chiuta.ro`, ASMR → `asmr.chiuta.ro`, BorderlessMelodies → `borderlessmelodies.chiuta.ro`, CalmWaves → `calmwaves.chiuta.ro`, EcoulSpectral → `ecoulspectral.chiuta.ro`, FrequencyLaboratory → `frequencylaboratory.chiuta.ro`, generator-frecvente → `generator-frecvente.chiuta.ro`, Akasha → `akasha.chiuta.ro`, CLEPSIDRA → `clepsidra.chiuta.ro`, Belot-fara-frontiere → `belot-fara-frontiere.chiuta.ro`, Carti-de-joc-fara-frontiere → `carti-de-joc-fara-frontiere.chiuta.ro`, Dame-fara-frontiere → `dame-fara-frontiere.chiuta.ro`, Domino-fara-frontiere → `domino-fara-frontiere.chiuta.ro`, Go-fara-frontiere → `go-fara-frontiere.chiuta.ro`, Mahjong-fara-frontiere → `mahjong-fara-frontiere.chiuta.ro`, Profund → `profund.chiuta.ro`, Remi-fara-frontiere → `remi-fara-frontiere.chiuta.ro`, Sah-fara-frontiere → `sah-fara-frontiere.chiuta.ro`, Scopone-fara-frontiere → `scopone-fara-frontiere.chiuta.ro`, Solitaire-fara-frontiere → `solitaire-fara-frontiere.chiuta.ro`, Sudoku-fara-frontiere → `sudoku-fara-frontiere.chiuta.ro`, Table-fara-frontiere → `table-fara-frontiere.chiuta.ro`, Zaruri-fara-frontiere → `zaruri-fara-frontiere.chiuta.ro`, AI-Liber → `ai-liber.chiuta.ro`, ARENA → `arena.chiuta.ro`, LocalMind → `localmind.chiuta.ro`, Nexus-fara-frontiere → `nexus-fara-frontiere.chiuta.ro`, PromptVault → `promptvault.chiuta.ro`, VoiceAtelier → `voiceatelier.chiuta.ro`, API-fara-frontiere → `api-fara-frontiere.chiuta.ro`, Constelar → `constelar.chiuta.ro`, OAZA → `oaza.chiuta.ro`, Origami → `origami.chiuta.ro`, Trusa-fara-frontiere → `trusa-fara-frontiere.chiuta.ro`, VNTV → `vntv.chiuta.ro`, ACORDAJ → `acordaj.chiuta.ro`, Afrodisiace-fara-frontiere → `afrodisiace-fara-frontiere.chiuta.ro`, Aurora → `aurora.chiuta.ro`, Bioenergoterapie → `bioenergoterapie.chiuta.ro`, ECLIPSA → `eclipsa.chiuta.ro`, HoroScop → `horoscop.chiuta.ro`, Inforenergetica → `inforenergetica.chiuta.ro`, NOMIA → `nomia.chiuta.ro`, NumeroLogIA → `numerologia.chiuta.ro`, Numerologie → `numerologie.chiuta.ro`, Radiestezie → `radiestezie.chiuta.ro`, Reiki → `reiki.chiuta.ro`, Tarot → `tarot.chiuta.ro`, ValeaPlopului1972 → `valeaplopului1972.chiuta.ro`.

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
| AcademiSearch | LIPSĂ | — | partajată: https://chiuta.ro/AcademiSearch/ (proiect fără CNAME, aceeași origine cu hub-ul) | pe origine proprie (corect) | fără CNAME; propus `academisearch.chiuta.ro` |
| Arhiva-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Arhiva-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `arhiva-fara-frontiere.chiuta.ro` |
| DataWeave | LIPSĂ | — | partajată: https://chiuta.ro/DataWeave/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `dataweave.chiuta.ro` |
| FreeDetect | LIPSĂ | — | partajată: https://chiuta.ro/FreeDetect/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `freedetect.chiuta.ro` |
| MarkdownAtelier | LIPSĂ | — | partajată: https://chiuta.ro/MarkdownAtelier/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `markdownatelier.chiuta.ro` |
| OmniHost | LIPSĂ | — | partajată: https://chiuta.ro/OmniHost/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `omnihost.chiuta.ro` |
| TranslateHub | LIPSĂ | — | partajată: https://chiuta.ro/TranslateHub/ (proiect fără CNAME, aceeași origine cu hub-ul) | pe origine proprie (corect) | fără CNAME; propus `translatehub.chiuta.ro` |
| Undava | LIPSĂ | — | partajată: https://chiuta.ro/Undava/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `undava.chiuta.ro` |
| Arhiva-LinkedIn | LIPSĂ | — | partajată: https://chiuta.ro/Arhiva-LinkedIn/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `arhiva-linkedin.chiuta.ro` |
| Cadraj | LIPSĂ | — | partajată: https://chiuta.ro/Cadraj/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `cadraj.chiuta.ro` |
| Trade-Free-Link-Guardian | LIPSĂ | — | partajată: https://chiuta.ro/Trade-Free-Link-Guardian/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `trade-free-link-guardian.chiuta.ro` |
| OUTPOST | LIPSĂ | — | partajată: https://chiuta.ro/OUTPOST/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `outpost.chiuta.ro` |
| ScryVeil | LIPSĂ | — | partajată: https://chiuta.ro/ScryVeil/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `scryveil.chiuta.ro` |
| Surveyor | LIPSĂ | — | partajată: https://chiuta.ro/Surveyor/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `surveyor.chiuta.ro` |
| Threads-fara-cont | LIPSĂ | — | partajată: https://chiuta.ro/Threads-fara-cont/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `threads-fara-cont.chiuta.ro` |
| Vitrina | LIPSĂ | — | partajată: https://chiuta.ro/Vitrina/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `vitrina.chiuta.ro` |
| X-fara-cont | LIPSĂ | — | partajată: https://chiuta.ro/X-fara-cont/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `x-fara-cont.chiuta.ro` |
| Curatitor | hub (apps/) | — | partajată: https://chiuta.ro/apps/Curatitor/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | — |  |
| Provenienta | hub (apps/) | — | partajată: https://chiuta.ro/apps/Provenienta/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | — |  |
| VaultCrypt | LIPSĂ | — | partajată: https://chiuta.ro/VaultCrypt/ (proiect fără CNAME, aceeași origine cu hub-ul) | pe origine proprie (corect) | fără CNAME; propus `vaultcrypt.chiuta.ro` |
| ATINGERE | LIPSĂ | — | partajată: https://chiuta.ro/ATINGERE/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `atingere.chiuta.ro` |
| Clopotel | LIPSĂ | — | partajată: https://chiuta.ro/Clopotel/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `clopotel.chiuta.ro` |
| ETER | LIPSĂ | — | partajată: https://chiuta.ro/ETER/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `eter.chiuta.ro` |
| Fabrica | hub (apps/) | — | partajată: https://chiuta.ro/apps/Fabrica/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | — |  |
| FASCICUL | LIPSĂ | — | partajată: https://chiuta.ro/FASCICUL/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `fascicul.chiuta.ro` |
| INDICATIV | LIPSĂ | — | partajată: https://chiuta.ro/INDICATIV/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `indicativ.chiuta.ro` |
| PULS | LIPSĂ | — | partajată: https://chiuta.ro/PULS/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `puls.chiuta.ro` |
| QSO | hub (apps/) | — | partajată: https://chiuta.ro/apps/QSO/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 1) |  |
| RegexLab | LIPSĂ | — | partajată: https://chiuta.ro/RegexLab/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `regexlab.chiuta.ro` |
| SEOptimum | LIPSĂ | — | partajată: https://chiuta.ro/SEOptimum/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `seoptimum.chiuta.ro` |
| SEVA | LIPSĂ | — | partajată: https://chiuta.ro/SEVA/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `seva.chiuta.ro` |
| Alfabete | hub (apps/) | — | partajată: https://chiuta.ro/apps/Alfabete/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | — |  |
| Lexicon | hub (apps/) | — | partajată: https://chiuta.ro/apps/Lexicon/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 2) |  |
| Limpezimea | LIPSĂ | — | partajată: https://chiuta.ro/Limpezimea/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `limpezimea.chiuta.ro` |
| Nota-Zero | LIPSĂ | — | partajată: https://chiuta.ro/Nota-Zero/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `nota-zero.chiuta.ro` |
| Pendulul | LIPSĂ | — | partajată: https://chiuta.ro/Pendulul/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `pendulul.chiuta.ro` |
| PrintreInteligente | LIPSĂ | — | partajată: https://chiuta.ro/PrintreInteligente/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `printreinteligente.chiuta.ro` |
| Zicala | LIPSĂ | — | partajată: https://chiuta.ro/Zicala/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `zicala.chiuta.ro` |
| AGORA | LIPSĂ | — | partajată: https://chiuta.ro/AGORA/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `agora.chiuta.ro` |
| Bolta | hub (apps/) | — | partajată: https://chiuta.ro/apps/Bolta/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 2) |  |
| Cupa-Mondiala-2026 | LIPSĂ | — | partajată: https://chiuta.ro/Cupa-Mondiala-2026/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `cupa-mondiala-2026.chiuta.ro` |
| Eclipsa-2027 | LIPSĂ | — | partajată: https://chiuta.ro/Eclipsa-2027/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `eclipsa-2027.chiuta.ro` |
| Horizons.BeyondLimits | LIPSĂ | — | partajată: https://chiuta.ro/Horizons.BeyondLimits/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `horizons-beyondlimits.chiuta.ro` |
| Hyper4D | LIPSĂ | — | partajată: https://chiuta.ro/Hyper4D/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `hyper4d.chiuta.ro` |
| IncredibleCosmos | LIPSĂ | — | partajată: https://chiuta.ro/IncredibleCosmos/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `incrediblecosmos.chiuta.ro` |
| Nemurirea | LIPSĂ | — | partajată: https://chiuta.ro/Nemurirea/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `nemurirea.chiuta.ro` |
| orarium | LIPSĂ | — | partajată: https://chiuta.ro/orarium/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `orarium.chiuta.ro` |
| TerRa | LIPSĂ | — | partajată: https://chiuta.ro/TerRa/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `terra.chiuta.ro` |
| Universul-Observabil | LIPSĂ | — | partajată: https://chiuta.ro/Universul-Observabil/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `universul-observabil.chiuta.ro` |
| Universul-Observabil-1D | LIPSĂ | — | partajată: https://chiuta.ro/Universul-Observabil-1D/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `universul-observabil-1d.chiuta.ro` |
| Universul-Observabil-2D | LIPSĂ | — | partajată: https://chiuta.ro/Universul-Observabil-2D/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `universul-observabil-2d.chiuta.ro` |
| Universul-Observabil-3D | LIPSĂ | — | partajată: https://chiuta.ro/Universul-Observabil-3D/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `universul-observabil-3d.chiuta.ro` |
| VietAR | LIPSĂ | — | partajată: https://chiuta.ro/VietAR/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `vietar.chiuta.ro` |
| ExploratoriiEco | LIPSĂ | — | partajată: https://chiuta.ro/ExploratoriiEco/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `exploratoriieco.chiuta.ro` |
| FieldObserver | LIPSĂ | — | partajată: https://chiuta.ro/FieldObserver/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `fieldobserver.chiuta.ro` |
| Poteca | hub (apps/) | — | partajată: https://chiuta.ro/apps/Poteca/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 1) |  |
| URME | LIPSĂ | — | partajată: https://chiuta.ro/URME/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `urme.chiuta.ro` |
| VATRA | LIPSĂ | — | partajată: https://chiuta.ro/VATRA/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `vatra.chiuta.ro` |
| ASMR | LIPSĂ | — | partajată: https://chiuta.ro/ASMR/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `asmr.chiuta.ro` |
| BorderlessMelodies | LIPSĂ | — | partajată: https://chiuta.ro/BorderlessMelodies/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `borderlessmelodies.chiuta.ro` |
| CalmWaves | LIPSĂ | — | partajată: https://chiuta.ro/CalmWaves/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `calmwaves.chiuta.ro` |
| Decibel | hub (apps/) | — | partajată: https://chiuta.ro/apps/Decibel/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | — |  |
| EcoulSpectral | LIPSĂ | — | partajată: https://chiuta.ro/EcoulSpectral/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `ecoulspectral.chiuta.ro` |
| FrequencyLaboratory | LIPSĂ | — | partajată: https://chiuta.ro/FrequencyLaboratory/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `frequencylaboratory.chiuta.ro` |
| generator-frecvente | LIPSĂ | — | partajată: https://chiuta.ro/generator-frecvente/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `generator-frecvente.chiuta.ro` |
| Akasha | LIPSĂ | — | partajată: https://chiuta.ro/Akasha/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `akasha.chiuta.ro` |
| Arbore | hub (apps/) | — | partajată: https://chiuta.ro/apps/Arbore/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 1) |  |
| CLEPSIDRA | LIPSĂ | — | partajată: https://chiuta.ro/CLEPSIDRA/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `clepsidra.chiuta.ro` |
| Gospodar | hub (apps/) | — | partajată: https://chiuta.ro/apps/Gospodar/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 1) |  |
| Orar | hub (apps/) | — | partajată: https://chiuta.ro/apps/Orar/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub) | DA (prio 1) |  |
| Belot-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Belot-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `belot-fara-frontiere.chiuta.ro` |
| Carti-de-joc-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Carti-de-joc-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `carti-de-joc-fara-frontiere.chiuta.ro` |
| Dame-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Dame-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `dame-fara-frontiere.chiuta.ro` |
| Domino-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Domino-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `domino-fara-frontiere.chiuta.ro` |
| Go-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Go-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `go-fara-frontiere.chiuta.ro` |
| Mahjong-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Mahjong-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `mahjong-fara-frontiere.chiuta.ro` |
| Profund | LIPSĂ | — | partajată: https://chiuta.ro/Profund/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `profund.chiuta.ro` |
| Remi-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Remi-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `remi-fara-frontiere.chiuta.ro` |
| Sah-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Sah-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `sah-fara-frontiere.chiuta.ro` |
| Scopone-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Scopone-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `scopone-fara-frontiere.chiuta.ro` |
| Solitaire-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Solitaire-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `solitaire-fara-frontiere.chiuta.ro` |
| Sudoku-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Sudoku-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `sudoku-fara-frontiere.chiuta.ro` |
| Table-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Table-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `table-fara-frontiere.chiuta.ro` |
| Zaruri-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Zaruri-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `zaruri-fara-frontiere.chiuta.ro` |
| AI-Liber | LIPSĂ | — | partajată: https://chiuta.ro/AI-Liber/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `ai-liber.chiuta.ro` |
| ARENA | LIPSĂ | — | partajată: https://chiuta.ro/ARENA/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `arena.chiuta.ro` |
| LocalMind | LIPSĂ | — | partajată: https://chiuta.ro/LocalMind/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `localmind.chiuta.ro` |
| Nexus-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Nexus-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | pe origine proprie (corect) | fără CNAME; propus `nexus-fara-frontiere.chiuta.ro` |
| PromptVault | LIPSĂ | — | partajată: https://chiuta.ro/PromptVault/ (proiect fără CNAME, aceeași origine cu hub-ul) | pe origine proprie (corect) | fără CNAME; propus `promptvault.chiuta.ro` |
| VoiceAtelier | LIPSĂ | — | partajată: https://chiuta.ro/VoiceAtelier/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `voiceatelier.chiuta.ro` |
| API-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/API-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `api-fara-frontiere.chiuta.ro` |
| Constelar | LIPSĂ | — | partajată: https://chiuta.ro/Constelar/ (proiect fără CNAME, aceeași origine cu hub-ul) | pe origine proprie (corect) | fără CNAME; propus `constelar.chiuta.ro` |
| OAZA | LIPSĂ | — | partajată: https://chiuta.ro/OAZA/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `oaza.chiuta.ro` |
| Origami | LIPSĂ | — | partajată: https://chiuta.ro/Origami/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `origami.chiuta.ro` |
| Trusa-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Trusa-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `trusa-fara-frontiere.chiuta.ro` |
| VNTV | LIPSĂ | — | partajată: https://chiuta.ro/VNTV/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `vntv.chiuta.ro` |
| OSATURA | depozit | `armatura.chiuta.ro` | proprie: https://armatura.chiuta.ro/ | — | proiect Rust (CLI + studio + WASM), site propriu; depozit chiuta/armatura |
| ACORDAJ | LIPSĂ | — | partajată: https://chiuta.ro/ACORDAJ/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `acordaj.chiuta.ro` |
| Afrodisiace-fara-frontiere | LIPSĂ | — | partajată: https://chiuta.ro/Afrodisiace-fara-frontiere/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `afrodisiace-fara-frontiere.chiuta.ro` |
| Aurora | LIPSĂ | — | partajată: https://chiuta.ro/Aurora/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `aurora.chiuta.ro` |
| Bioenergoterapie | LIPSĂ | — | partajată: https://chiuta.ro/Bioenergoterapie/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `bioenergoterapie.chiuta.ro` |
| ECLIPSA | LIPSĂ | — | partajată: https://chiuta.ro/ECLIPSA/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `eclipsa.chiuta.ro` |
| HoroScop | LIPSĂ | — | partajată: https://chiuta.ro/HoroScop/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `horoscop.chiuta.ro` |
| Inforenergetica | LIPSĂ | — | partajată: https://chiuta.ro/Inforenergetica/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `inforenergetica.chiuta.ro` |
| NOMIA | LIPSĂ | — | partajată: https://chiuta.ro/NOMIA/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `nomia.chiuta.ro` |
| NumeroLogIA | LIPSĂ | — | partajată: https://chiuta.ro/NumeroLogIA/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `numerologia.chiuta.ro` |
| Numerologie | LIPSĂ | — | partajată: https://chiuta.ro/Numerologie/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `numerologie.chiuta.ro` |
| Radiestezie | LIPSĂ | — | partajată: https://chiuta.ro/Radiestezie/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `radiestezie.chiuta.ro` |
| Reiki | LIPSĂ | — | partajată: https://chiuta.ro/Reiki/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `reiki.chiuta.ro` |
| Tarot | LIPSĂ | — | partajată: https://chiuta.ro/Tarot/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `tarot.chiuta.ro` |
| ValeaPlopului1972 | LIPSĂ | — | partajată: https://chiuta.ro/ValeaPlopului1972/ (proiect fără CNAME, aceeași origine cu hub-ul) | — | fără CNAME; propus `valeaplopului1972.chiuta.ro` |
