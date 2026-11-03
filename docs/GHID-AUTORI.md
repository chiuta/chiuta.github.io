# Ghidul autorilor: cum adaugi sau conectezi o aplicație

Pentru cine scrie o aplicație nouă „fără frontiere” sau o leagă de portofoliul existent. Totul de mai jos e verificat de comenzi din depozit; nu există pași „pe încredere”. Ce n-ai de făcut: nu adaugi cont, telemetrie, reclame, biblioteci externe sau cereri de rețea din pagină.

## 0. Regulile care nu se negociază

1. **Un singur fișier HTML**, funcțional offline (service worker + manifest), licență MIT.
2. **CSP strict** în `<meta http-equiv="Content-Security-Policy">`: `default-src 'none'`, `connect-src 'none'`, scripturi inline doar cu `'sha256-…'` (fără `unsafe-inline`). Excepțiile (cele trei aplicații AI, LocalMind, AcademiSearch ș.a.) se declară în `fff.config.json` → `cspExceptions`, cu motiv, și apar în `app.json` → `egress`.
3. **Opt limbi la același nivel**: ro, en, fr, it, es, pt, de, hu. Cele șase traduse automat se marchează ca atare în README și se revizuiesc nativ.
4. **axe-core: 0 violări** la 360 și 1366 px, temă luminoasă și întunecată, pe pagină și pe dialogul „Transparență”.
5. **Chei de stocare prefixate** cu slug-ul (`fff.<slug>.*` sau `<slug>.*`), nu chei generice.
6. **Onestitate**: limitele aplicației se scriu în fișa din catalog; fără promisiuni medicale sau de „efect”.

## 1. Pornirea unei aplicații

```
node fff-kit/build.mjs apply <dir> --slug <slug> --modules core,store,dialog,label,bundle[,qr,p2p,sync,history,bridge,srs,tts,pii,search,ephem]
node fff-kit/build.mjs check <dir>          # STRICT: CSP, hash-uri, dialoguri native, chei neprefixate, paritate i18n
node fff-kit/build.mjs info <dir>           # scrie app.json din pagină (permisiuni, egress, dimensiune, sha256)
```

Kitul adaugă dialogul „Transparență” (clic pe versiune), copia de siguranță `.fff.json`, `meta application-version`, `last-updated` și `#app-version`. La fiecare modificare: `build.mjs release <dir> --bump patch` (versiune + README-uri + `app.json`), apoi `fixcsp`, `info`, `check`. Constantele de versiune din codul tău (`const VERSION = …`) NU le schimbă `release`: aliniază-le de mână (în Etapa 7 s-au găsit patru aplicații rămase în urmă; testul de pornire trebuie să compare versiunea afișată cu `app.json`).

## 2. Conectarea la plic (`.fff.json`)

Plicul e formatul prin care aplicațiile își dau rezultate fără server. Specificația: [FFF-ENVELOPE.md](FFF-ENVELOPE.md).

1. Alege tipurile pe care aplicația le **produce** și le **acceptă** (`table/csv`, `citation/csl`, `text/markdown`, `geo/gpx`, `events/ics`, `agenda/fff`, `passport/fff`, `place/fff`, …). Adaugă-le în `fff-kit/bridge-adapters/registry.js` sau, pentru aplicații noi, în `tools/envelope-adapters/registry.extra.json` (`{"slug", "produces":[…], "accepts":[…]}`).
2. Scrie adaptorul în `tools/envelope-adapters/<Slug>.js`: o funcție care leagă butonul „Trimite către…” de datele tale și o funcție de primire care validează și cere confirmare. Primirea nu importă niciodată fără apăsarea lui „Importă”.
3. Înscrie aplicația în `tools/envelope-adapters/plan.json` (cheia = slug-ul): `{"adapter": "<Slug>.js", "libs": ["fff-agenda", …]}`.
4. Injectează: `node tools/inject-shared.mjs <dir> <slug> --release "<notă>"`. Verifică: `node tools/inject-shared.mjs --check <dir> <slug>` (copiile din aplicație trebuie să fie identice cu sursele din `tools/`; nu se editează de mână).
5. **Nivelul de dovezi** (`evidence`, 0–4) se pune în plic doar când aplicația îl poate susține, iar în catalog (`data/catalog-meta.json` → `apps.<Nume>.evidence`) este obligatoriu pentru conținutul de practici (listele `policy.evidenceRequired`). Nivelul descrie ce AFIRMĂ conținutul, nu calitatea software-ului.

## 3. Catalogul: card, fișă, acoperire

Cardul se adaugă în `index.html` (copiază un card existent: `data-c="apps|<Nume>|title"`), apoi:

```
node tools/sync-catalog.mjs --root <rădăcina cu depozitele>    # versiune, dată, limbi, offline, hash-uri CSP, sw.js
node tools/sync-catalog.mjs --root <…> --check                  # exit 1 la orice abatere
```

În `data/catalog-meta.json` → `apps.<Nume>` completezi: `line` (descrierea scurtă), `fisa` (în cele 8 limbi: `limite`, `cifre` unde cardul conține cifre; `figures: true` cere un rând „Cifre și surse” cu dată), `status` (derivat din versiune, suprascrie numai dacă e nevoie), `score` (auditul din 22.10, folosit doar pentru ordinea din „Recomandate”), `health: true` (conținut legat de sănătate), `fragile: true` (depinde de servicii terțe). **Acoperirea** (`coverage`: `langs` + `platform`) se derivă din `app.json` → `features.i18n`; o scrii de mână doar dacă aplicația nu declară limbile (ex. Pendulul: ro) sau e un program nativ. Scorul de acoperire: 8 limbi = 4, 4–7 = 3, 2–3 = 2, 1 = 1.

## 4. Relații și fluxuri

- `related`: grupuri de aplicații înrudite (apar la „Vezi și”); `extraRelations`: perechi `[A, B]` simetrice; `variants`: o aplicație-părinte cu variante ascunse (Universul Observabil 1D/2D/3D).
- Fluxurile (lanțuri de aplicații prin plicuri) se declară în `data/flows.json` (noduri cu `produces`/`accepts` și modul `web`/`cli`, muchii `[de la, la, tip]`); `tools/sync-catalog.mjs` le validează față de registru și testele din `tests/flows*.test.mjs` le execută. Vezi [FLUXURI.md](FLUXURI.md).
- Aplicația fără nicio relație **declarată** (grup `related`, pereche, flux) apare în tabloul de sănătate ca „orfană”. Nu e o greșeală, dar e o ocazie: o legătură reală (un tip de plic comun) valorează mai mult decât un link.
- **Regula Etapei 9: fiecare card are cel puțin 2 relații justificate**, inclusiv variantele ascunse (Universul Observabil 1D/2D/3D). O relație e justificată doar dacă are un motiv verificabil din depozit: subiect comun (`topic:<id>`, cu cel mult 8 membri, altfel nu ajunge singur), grup `related`, pereche `extraRelations`, variantă, flux (`flow:<id>`), plic (`envelope:<tip>`: unul produce un tip specific pe care celălalt îl acceptă; `text/plain`, `text/markdown` și `table/csv` nu contează singure), sursă externă comună (`data:<gazdă>`) sau motor comun cu date proprii (`module:fff-…`: locație, pașaport, agendă, sunet, jurnal, nucleul AI, jocuri).
- Perechile noi se scriu cu motiv în cuvinte: `["Curatitor", "VaultCrypt", "doi pași ai aceleiași igiene a fișierelor trimise: ștergi metadatele, apoi încuii fișierul"]`. Forma `[A, B]` rămâne validă, dar nu o folosi pentru o legătură pe care n-o poți explica într-o frază.
- `node tools/sync-catalog.mjs` generează `data/relations.json` (toate perechile cu motivele lor; nu se editează) și pică (`--check`, în CI) dacă un card are sub 2 relații justificate sau o relație n-are motiv. `node tests/relations.test.mjs` verifică același lucru fără browser.

## 5. Surse externe (date care îmbătrânesc)

Aplicația rămâne offline; datele proaspete vin printr-un job din GitHub Actions, nu din pagină.

1. Descrie sursa în `data/sources.json`: `id`, `app`, `url`, `kind` (`data` = instantaneu cu hash-uri, `watch` = doar verifică deriva), `parser` (din `tools/refresh/parsers/`), `cadenta` (`viu` săptămânal / `lent` lunar / `înghețat` trimestrial), `stare` (`activ`, `oprit`, `inventar`, `de-confirmat`), `validator` (praguri: minim înregistrări, coincidență cu aplicația, scădere/creștere maximă, duplicate tolerate), `licenta`, `termeni`, `robots`.
2. Fixturi sintetice în `tools/refresh/fixtures/<id>/<scenariu>/` (generate de `fixtures/make.mjs`): `ok`, `drop`, `grow`, `structure`, `robots-block`, `robots-5xx`. Testul: `node --test tools/refresh/test.mjs`.
3. Reguli: `robots.txt` se respectă (RFC 9309), cereri politicoase, `User-Agent` identificat. Conținut cu drepturi neclarificate: `noRecord: true` (nu se arhivează răspunsul; instantaneul păstrează doar hash-uri). Dacă sursa interzice sau autorul refuză: `stare: "oprit"` cu motivul în `note`, nu o ocolești.
4. Rezultatul respins devine issue (`[refresh] <id>: <tip>`); cel valid devine PR sau commit (după `autoMerge`). Când repari un parser, **lucrează pe forma reală**: dacă mediul tău nu poate ajunge la sursă, rulează `workflow_dispatch` cu o sondă care tipărește scheletul mascat al paginii (litere → `a`) și citește logul prin `gh api …/actions/jobs/<id>/logs` (așa s-a reparat ACORDAJ în Etapa 7).

## 6. Motoare comune

Nu copia cod: cere modulul prin `plan.json` → `libs`, iar `inject-shared.mjs` îl pune ca `<script id="fff-mod-…">`.

| Modul | Ce oferă | Când îl folosești |
|---|---|---|
| `fff-envelope.js` | plic, „Trimite către…”, validare, semnătură opțională | orice aplicație cu export/import |
| `fff-seif.js` | seiful comun de chei API (`keys/vault`) | aplicații care apelează modele AI |
| `fff-agenda.js` | evenimente/sarcini ↔ ICS (`agenda/fff`) | calendare, planificatoare |
| `fff-pasaport.js` | pașaport de învățare, repetiție eșalonată, certificat | aplicații educaționale |
| `fff-sunet.js` | mixer de peisaj sonor (profile, WAV offline) | aplicații cu sunet ambiental |
| `fff-ai.js` | transport comun Anthropic/OpenAI/Google; **singurul loc** pentru `anthropic-version` (`FFF.ai.ANTHROPIC_VERSION`) și modelele Anthropic (`FFF.ai.MODELS`, `modelStatus`, `migrateModel`, `anthropicHeaders`) | orice aplicație care apelează `api.anthropic.com` (plan.json: `"libs": ["fff-ai"]`, sau `"libsOnly": true` dacă n-are nevoie de plic) |
| `fff-jocuri.js` | i18n TBL, Elo, turnee, p2p lockstep | jocuri cu adversar |
| `fff-place.js` | locația, ora și fusul comune (`place/fff`) | suita cer–timp |
| `fff-jurnal.js` | jurnal de teren → atlas | observare, hărți |
| `fff-ab.js`, `fff-repro.js` | comparare A/B, laborator de reproducere | rezultate comparabile |

### 6.1 API-ul Anthropic: nu scrie versiunea și modelele de mână

- Nu scrie literal `anthropic-version`, `x-api-key` + `anthropic-dangerous-direct-browser-access` sau id-uri de model în aplicație. Pentru un apel propriu: `fetch(url, {headers: FFF.ai.anthropicHeaders(cheia), body: …})`; pentru conversație: `FFF.ai.run('anthropic', {…})`. Modelul gol sau retras se normalizează cu `FFF.ai.migrateModel(id)`; listele de sugestii iau `FFF.ai.MODELS.anthropic`.
- Nu trimite `temperature`, `top_p` sau `top_k` către Anthropic: versiunea API `2026-10-21` le-a eliminat (400 pe orice model). Nucleul nu le trimite niciodată.
- Valorile din `tools/fff-ai.js` au fost verificate în documentația oficială la **3 noiembrie 2026** (platform.claude.com: versionare, ghid de migrare 2026-10-21, prezentarea modelelor, deprecieri). La o versiune nouă: schimbi o singură constantă, rulezi `node tests/ai.test.mjs`, `node tools/anthropic-audit.mjs --root <aplicații>`, apoi `inject-shared` în cele șase aplicații (AI-Liber, ARENA, Nexus, Constelar, TranslateHub, VietAR). Worker-ul Cloudflare din PrintreInteligente nu poate importa nucleul: își repetă valoarea, iar auditul o compară cu cea centrală (se redeployează de mână).
- Sursa `Anthropic-API-versiune` din `data/sources.json` urmărește pagina de versionare și dă alertă când nu mai apare valoarea centrală.

## 7. Testele obligatorii

Fiecare aplicație are `tests/*.test.mjs` (Playwright, rețea blocată prin `ctx.route(/^https?:/, r => r.abort())`) care acoperă cel puțin:

1. **pornire**: zero erori JS, CSP exact (număr de hash-uri ≥ scripturi inline, fără `unsafe-inline`), nicio cerere de rețea, versiunea afișată = `app.json`;
2. **funcția de bază** (calcul, import/export cu valori de referință; oracole externe acolo unde există: Python pentru calendar, `icalendar` pentru ICS);
3. **accesibilitate**: axe 0 violări în ambele teme, la 360 și 1366 px;
4. **8 limbi**: nicio cheie lipsă, nicio depășire de layout;
5. **import ostil**: fișier corupt/gol/uriaș nu strică starea (copia de siguranță are rollback).

Reguli pentru teste: să ruleze din depozitul autonom (cale către kit prin `FFF_KIT`, cale către axe prin `FFF_AXE`/`AXE_PATH`, fără căi absolute ale unei sesiuni); să nu depindă de data de azi (ceas fix sau date explicite); să iasă cu cod ≠ 0 la eșec; să dea un mesaj clar când lipsește o dependență, nu o excepție criptică. Rulează-le pe rând (suita e lentă în paralel).

## 8. Scorul măsurat (cum se calculează)

`node tools/audit-run.mjs --root <apps> --out /tmp/audit7` rulează, pe fiecare aplicație: `build.mjs check`, `axe-check.mjs` (8 scenarii), fiecare `tests/*.test.mjs` și citește fapte statice. Apoi `node tools/transparenta.mjs audit` calculează scorul și scrie `data/transparenta.json` (`a7`, `health`) și `catalog-meta.json` (`measured`).

| Componentă | Puncte | Regula |
|---|---|---|
| Build check | 2 | trece = 2 |
| axe-core | 2 | 0 violări în 8 scenarii = 2, altfel 0 |
| Teste proprii | 2 | 2 × (fișiere de test care trec / total); fără teste = 0 |
| CSP | 1,5 | `connect-src 'none'` + scripturi doar cu hash = 1,5; listă declarată de gazde = 1; politică prezentă = 0,5 |
| Offline | 1 | service worker + manifest + zero `egress` = 1; cu `egress` = 0,5 |
| Limbi | 1 | n/8 |
| Dimensiune | 0,5 | ≤ 1 MB = 0,5; ≤ 2 MB = 0,35; ≤ 4 MB = 0,2; mai mare = 0,1 |

Dacă build-ul, axe sau testele nu au putut fi rulate (timeout, lipsă), scorul e **gol** și rândul e marcat incomplet; nu se completează cu estimări. **Scorul măsurat este singurul scor al catalogului**: trăiește doar în `data/transparenta.json` (a7), `loadMeta` îl pune în fișa fiecărui card și el ordonează „Recomandate” (descrescător; la egalitate rămâne ordinea editorială). Câmpul manual `score` din `catalog-meta.json` este **depreciat**: se acceptă doar ca rezervă pentru o aplicație fără scor măsurat și este respins pe una măsurată (arhiva scorurilor din 22.10.2026: `data/score-legacy.json`). Starea „laborator” nu se mai deduce din niciun scor: se declară în `apps.<Nume>.status: "lab"`. `node tools/score-compare.mjs --check` (rulat în CI și în `tests/retro.test.mjs`) verifică că mulțimea „laborator” și ordinea din „Recomandate” coincid cu cele așteptate. Dacă adaugi o aplicație în „Recomandate”, pune-o la locul dat de scorul măsurat; `sync-catalog --check` spune unde greșește ordinea.

## 9. Lista de verificare înainte de push

```
node fff-kit/build.mjs release <dir> --bump patch --no-tests ; node fff-kit/build.mjs fixcsp <dir> ; node fff-kit/build.mjs info <dir>
node fff-kit/build.mjs check <dir>
node fff-kit/ci/axe-check.mjs <dir>
bash -c 'for t in <dir>/tests/*.mjs; do node $t || exit 1; done'
# în hub:
node tools/sync-catalog.mjs --root <apps> && node tools/sync-catalog.mjs --root <apps> --check
node fff-kit/build.mjs fixcsp index.html
node tools/transparenta.mjs health && node tools/transparenta.mjs build && node tools/transparenta.mjs --check
node tools/make-fixtures.mjs --root <apps>        # NU fără --root (acum refuză să scrie): altfel fixturile CI rămân în urmă și hub-test cade
node tools/make-fixtures.mjs --check              # fără clone: fixturile se potrivesc cu cardurile? (în CI; mesaj clar „regenerează”)
node tests/relations.test.mjs && node tests/retro.test.mjs
node tools/anthropic-audit.mjs --root <apps>      # nicio versiune/model Anthropic scrise de mână, niciun model retras
```

Commit cu identitatea `alexio@trom.tf`; mesajul se încheie cu liniile de atribuire ale sesiunii. Pentru fiecare aplicație modificată: versiune incrementată, `CHANGELOG.md`, teste proprii verzi.
