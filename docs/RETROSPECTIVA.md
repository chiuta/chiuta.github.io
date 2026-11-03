# Retrospectiva etapelor 0–8

Scrisă la 3 noiembrie 2026, la închiderea Etapei 7. Pentru fiecare etapă: ce s-a folosit, ce nu, ce se propune a fi scos.

**Despre dovezi.** Hubul nu are telemetrie și nu va avea, deci **nu știm câți vizitatori folosesc ce**. „Folosit” înseamnă aici ce se poate măsura din depozite: câte aplicații au adoptat o piesă, dacă piesa are teste și dacă trece auditul. Un lucru neadoptat de nimeni e un candidat la ieșire; un lucru adoptat dar neîncercat de oameni rămâne necunoscut, și așa e marcat. Cifrele vin din `data/catalog-meta.json`, `tools/envelope-adapters/plan.json`, `data/flows.json`, `data/sources.json`, `data/transparenta.json` (auditul din 3 noiembrie 2026: 112 aplicații măsurate) și din depozitele aplicațiilor.

**Regula acestui document.** Se propun ieșiri, dar **nu se șterge nimic ireversibil**. Fiecare propunere spune ce s-ar pierde. Decizia aparține autorului (vezi și [DECIZII-AUTOR.md](DECIZII-AUTOR.md)).

## Cifre de ansamblu (auditul Etapei 7)

| Indicator | Valoare |
|---|---|
| Aplicații în catalog | 117 (113 pagini HTML, 4 programe native) |
| Aplicații cu scor măsurat | 112 (media 9,28; mediana 9,5; 98 peste 9, 12 între 8 și 9, 2 sub 1) |
| Build check trece | 110 din 112 (pică MENSURA și Fenarium: fără kit) |
| axe-core, 0 violări în 8 scenarii | 110 din 112 (aceleași două) |
| Fișiere de test rulate | 399, toate trec (ultima rulare, fiecare aplicație singură) |
| Aplicații fără niciun test | 2 (MENSURA, Fenarium) |
| Cu cele 8 limbi | 115 din 117 (monolingve: Pendulul, ro; OSATURA, en) |
| Cu cel puțin o relație declarată | 59 din 117 |
| Surse externe | 30 (15 active, 9 doar-inventar, 6 de confirmat) |
| Mărimea totală a paginilor | 125 MB; cea mai mare: Zicala, 5,4 MB |

## Etapa 0 · Curățenie și dovezi

- **Folosit:** fixturile pentru CI (`tests/fixtures/apps`, 113 aplicații) fac ca `hub-test` să ruleze fără clone locale; ordonarea în „Recomandate” după scor; sursa și data pentru cifrele din AGORA (acum și cu o notă despre diferența Eurostat/INSEE).
- **Nefolosit / problematic:** fixturile se **învechesc la fiecare versiune** a oricărei aplicații (în Etapa 7, CI-ul a picat pe `main` din acest motiv; regenerarea a atins 32 de fișiere). Nimeni nu le citește, doar CI.
- **De scos:** nimic. **De schimbat:** `make-fixtures.mjs --check` în CI care spune clar „regenerează”, în loc să pice ca eroare de catalog. Propunere, nefăcută.

## Etapa 1 · Onestitate pe carduri

- **Folosit:** câmpul `fisa` pe 109 aplicații, `coverage` (5), `evidence` (15), `health` (13), `fragile` (10). Etichetele de acoperire (TEZAUR, Pendulul, nativ) apar pe carduri.
- **Nefolosit:** câmpul manual `score` (97 de aplicații) a fost pus lângă scorul **măsurat** (112), care are formulă publică și se recalculează. Cele două coexistă și pot contrazice; scorul manual nu mai are justificare proprie.
- **De scos (propus):** `score` manual, după ce autorul acceptă formula măsurată. Se pierde judecata calitativă din cele 97 de note; ea ar trebui mutată în `fisa.limite`. Nefăcut.
- **Corectat în Etapa 7:** acoperirea TEZAUR (interfața web are acum 8 limbi; CLI-ul rămâne în engleză); Pendulul rămâne cu eticheta permanentă „RO” (e un roman în română).

## Etapa 2 · Plic de schimb și seif

- **Folosit:** plicul `.fff.json` e în 56 de aplicații prin adaptoare (`plan.json`); `FFF.bridge` în 36. Registrul are 72 de intrări în 15 tipuri; cele mai folosite sunt `table/csv` (25 producători, 21 acceptori) și `passport/fff` (13/13).
- **Nefolosit:** tipurile acceptate dar **nicicând produse**: `text/plain` și `cards/qa`; `quiz/undava` are 8 producători și un singur acceptor. Seiful comun (`fff-seif.js`, 33 KB) e în 4 aplicații.
- **De scos (propus):** acceptorii pentru `text/plain` și `cards/qa` dacă nu apare un producător până la următoarea revizie; altfel promit o legătură care nu există. Seiful: de păstrat (securitate), dar de verificat dacă cele patru aplicații chiar îl citesc.

## Etapa 3 · Descoperire

- **Folosit:** relațiile (59 din 117 aplicații au cel puțin una; 51 de perechi declarate), constelația, căutarea universală, planificatorul „Spune-mi ce ai de făcut”, testele `discover` (10) și `hub` (10).
- **Nefolosit:** **58 de aplicații sunt orfane** (jocurile de masă, aplicațiile ezoterice, majoritatea utilitarelor izolate). Nu e o greșeală; forțarea unor relații artificiale ar fi mai rea decât orfanii. Tabloul de sănătate le listează.
- **De scos:** nimic. **De evitat:** ținta „toate cele 117 carduri cu relații” din plan; nu e onestă pentru aplicații care chiar sunt independente.
- **Necunoscut:** cât din căutarea universală și din planificator e folosit de vizitatori.

## Etapa 4 · Fluxuri între aplicații

- **Folosit:** 4 fluxuri (sursa 4 noduri, A/B 5, reproducere 3, jurnal 6) pe 16 aplicații (14%). Au teste (`flows` 9, `flows-unit` 34).
- **Nefolosit:** fluxul „sursa” lucrează cu programe native (LegatorOCR, TEZAUR, VERIGA) care nu au înregistrări de demonstrație; nu poate fi arătat fără instalare.
- **De scos:** nimic acum. **De decis:** motorul A/B (4 aplicații, 28 KB) și laboratorul de reproducere (3 aplicații, 34 KB) rămân nișe; de păstrat înghețate, fără funcții noi, până apare cerere.

## Etapa 5 · Motoare comune

| Motor | Aplicații | Dimensiune sursă |
|---|---|---|
| fff-pasaport | 13 | 34 KB |
| fff-jocuri | 11 | 83 KB |
| fff-jurnal | 8 | 27 KB |
| fff-place | 7 | 97 KB |
| fff-sunet | 6 | 27 KB |
| fff-ab | 4 | 28 KB |
| fff-ai | 3 | 10 KB |
| fff-agenda | 3 | 18 KB |
| fff-repro | 3 | 34 KB |

- **Folosit:** pașaportul, jocurile, jurnalul, locația. Motoarele sunt testate în hub (`engines`, `jocuri`, `pasaport`, `place`, `sunet`, `agenda`, `ai`).
- **Probleme găsite de auditul din Etapa 7:** motorul A/B avea un nume accesibil care nu conținea textul vizibil (axe `label-content-name-mismatch`, 4 aplicații); reparat în motor și în cele 4 copii. Testele Bolta nu știau de cheia comună `fff.place.v1`; ajustate.
- **De scos (propus):** nimic. **Preț:** fiecare copie încorporată crește pagina; `fff-place` (97 KB) e în 7 aplicații. De avut în vedere încărcarea doar când e nevoie, dacă mărimea devine problemă (cea mai mare pagină are 5,4 MB și nu e din cauza lui).

## Etapa 6 · Suita cer–timp

- **Folosit:** locația comună în 7 aplicații; panoul „deasupra ta mâine”; arhivarea Cupei Mondiale.
- **Corectat:** zvonul că axe pe pagina completă „atârnă” la Horizons și Universul Observabil 3D **nu s-a reprodus**: 8 scenarii în 11,6 s (Horizons) și 50 s (UO3D). Timpul mare al UO3D justifică un plafon de 240 s în `audit-run.mjs`.
- **De scos:** nimic.

## Etapa 7 · Consolidare și evaluare

- **Livrat:** auditul reproductibil (`tools/audit-run.mjs`), scorul pe aplicație cu formulă publică, tabloul de sănătate, ghidul autorilor, cele 8 limbi pentru TEZAUR.
- **A găsit, reparat și publicat:** constante de versiune învechite în 8 aplicații (Bolta, Orar, Poteca, Universul Observabil 3D, panoul Universul Observabil, orarium, FieldObserver, VietAR; la VietAR constanta declanșa curățarea cache-ului), o încălcare axe în Cupa Mondială, butonul A/B în 4 aplicații, testele care depindeau de dată, de calea kitului sau de număr exact de scripturi.
- **Cea mai utilă piesă:** auditul măsurat, pentru că a găsit erori reale. **Cea mai puțin utilă:** a doua listă de relații în tabloul de sănătate (duplică lista orfanilor din Etapa 3).
- **Limite:** nu s-a putut face audit pentru cele 4 programe native și pentru Pendulul (nu sunt o pagină unică); MENSURA și Fenarium nu au kit (build check pică, fără teste); testele pornite în paralel dau rezultate false (Zicala, TerRa, Lexicon au picat în paralel și trec singure): **auditul se rulează pe rând**.

## Etapa 8 · Actualizare automată a surselor

- **Folosit:** 30 de surse; 15 active, toate ok la rularea din 3 noiembrie (după reparațiile din Etapa 7; înainte, 2 erau în alertă: ACORDAJ și LocalMind); 7 probleme deschise ca issue-uri (#13–#19), din care 4 s-au închis singure după reparații.
- **A prins probleme reale:** analizorul ACORDAJ dădea 4 titluri în loc de ~1130 (reparat: 1132); LocalMind ținea nume de modele redenumite (reparat); canarul Gutendex din AcademiSearch-API bloca robots (scos).
- **Nefolosit:** 9 surse „doar-inventar” și 6 „de confirmat” nu se descarcă niciodată; sunt documentație, nu automatizare. Trei ramuri „gata de PR” (ACORDAJ, AGORA, VNTV) așteaptă recenzia autorului (PR #20–#22): `autoMerge` e oprit intenționat.
- **De scos (propus):** nimic; sursele „doar-inventar” se pot muta într-un fișier separat dacă încurcă tabloul.

## Ce n-a fost făcut în Etapa 7

- **Înregistrări native pentru TEZAUR, VERIGA, OSATURA, LegatorOCR:** doar TEZAUR are binar construit și poate rula fără interfață grafică (CLI cu comenzi fără model: `ingest`, `search`, `audit`). Celelalte trei nu au binare construite în acest mediu. O înregistrare în 8 limbi cere și narațiune; nu s-a livrat. Videoclipurile existente rămân cele ale interfeței web.
- **MENSURA și Fenarium fără kit:** aplicarea kitului cere înlocuirea dialogurilor native (`alert`/`confirm`: 1 la MENSURA, 10 la Fenarium) și migrarea cheilor de stocare; risc de pierdere de date ale utilizatorilor. Lăsate cum sunt, cu scorul real (0,3 și 0,5).
- **Localizarea Pendulului:** nu se face; romanul e în română. Eticheta „RO” rămâne permanentă.
- **Traducerile noi TEZAUR în fr/it/es/pt/de/hu** sunt automate și nerevizuite de vorbitori nativi.
- **Verificarea DNS** a domeniilor (`cname-inventory.mjs --dns`) n-a putut rula aici (ENOTFOUND); cele 117 fișiere CNAME sunt verificate doar local.

## Propuneri de ieșire, la un loc

| Ce | Motiv măsurat | Ce se pierde | Stare |
|---|---|---|---|
| Câmpul `score` manual din `catalog-meta.json` | dublat de scorul măsurat (112 vs 97) | nota calitativă | propus |
| Acceptorii `text/plain`, `cards/qa` | niciun producător | promisiune de legătură | propus |
| Fixturile CI comise | se învechesc la fiecare versiune | CI fără clone | de înlocuit cu generare în CI |
| Surse „doar-inventar” din `sources.json` | 9, niciodată descărcate | inventarul lor | de mutat, nu de șters |
| Orfanii ca „problemă” | 58 din 117 | nimic | de reformulat ca informație |

Nimic din această listă n-a fost șters.
