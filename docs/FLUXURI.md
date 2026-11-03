# Fluxuri între aplicații (Etapa 4)

Patru fluxuri, toate prin plicul FFF ([FFF-ENVELOPE.md](FFF-ENVELOPE.md)): fișiere `.fff.json`, fără server, fără rețea. Definiția lor e în [`data/flows.json`](../data/flows.json) (noduri = aplicații cu tipurile de plic acceptate/produse și modul `web`/`cli`; muchii = pași). `tools/sync-catalog.mjs` o validează față de carduri (tipurile trebuie să fie produse de sursă și acceptate de țintă, 8 limbi pentru nume și rezumat) și o încorporează în pagină: fiecare card afișează „Înlănțuie cu…” cu aplicațiile vecine (← pasul anterior, pasul următor →), iar eticheta tipului de plic apare ca titlu al butonului.

## 1. Lanțul de surse: LegatorOCR → TEZAUR → VERIGA → AcademiSearch

| Pas | Aplicație | Primește | Produce | Cum |
|---|---|---|---|---|
| 1 | LegatorOCR (Rust, CLI) | scanări | `document/ocr` | `legatorocr scan.png --ocr --lang ro --author "Nume, Prenume" --fff-year 1999 --fff-out doc.fff.json` |
| 2 | TEZAUR (Rust, CLI) | `document/ocr`, `text/plain`, `text/markdown` | `citation/csl` | `tezaur ingest --fff-in doc.fff.json` apoi `tezaur bib --fff-out bib.fff.json` |
| 3 | VERIGA (Rust, CLI) | `citation/csl` | `citation/csl` adnotat | `veriga --fff-in bib.fff.json --fff-out checked.fff.json` |
| 4 | AcademiSearch (web) | `citation/csl` | referință în bibliotecă | Biblioteca mea → „Primește…” → fișierul `checked.fff.json` |

**De ce CLI, nu plic direct în browser.** Cele trei programe sunt Rust și nu rulează în pagină; alternativa implementată este un fișier `.fff.json` pe disc între pași (`--fff-out` / `--fff-in`), exact formatul pe care îl citesc și aplicațiile web. TEZAUR are și variantă HTML, dar lanțul testat folosește binarul.

- **`document/ocr`**: `payload = {title, author?, year?, lang, file, sha256, engine, pages:[{n, text}]}`; `source.id = "sha256:<hex>"` este amprenta scanării originale. Titlul implicit e primul rând al textului OCR (heuristică), deci se verifică înainte de citare; autorul și anul vin doar din `--author` / `--fff-year` și nu sunt verificate.
- **TEZAUR** copiază plicul în `fff-inbox/` lângă index, scrie `fff-<cheie>.bib` (autor, an, titlu, `note = sha256:…`) și indexează paginile, deci `[@cheie, p. N]` și `tezaur audit` funcționează. A doua ingerare e „unchanged”.
- **VERIGA**: URL-urile și DOI-urile din referințe devin puncte de start (adâncime 0). Fiecare referință primește `custom.veriga = {status, checked, date, doi_syntax?, link?, http?}`: `ok`, `redirected`, `broken`, `unreachable` (DNS/conexiune/timp/TLS: **nu** „rupt”), `unchecked`, `no-link` (nimic de verificat în rețea), `bad-doi`. Fără legături nu se face nicio cerere. Un DOI valid ca sintaxă nu e dovedit existent fără rețea.
- **AcademiSearch** păstrează în nota referinței nota CSL (amprenta scanării) și starea VERIGA; referința se exportă BibTeX/RIS/CSV/Markdown cu autor, an, titlu și notă.

**Testat** (`node tests/flows.test.mjs`, rețeaua oprită): cu binarele reale, scanarea `tests/fixtures/flows/scan.png` ajunge prin cei trei pași la bibliotecă, amprenta SHA-256 din plic coincide cu a fișierului, `tezaur search` citează „Popescu (1999), p. 1”, BibTeX-ul exportat conține autor, an, titlu și amprentă, a doua primire nu dublează. Fără binare (CI) se rulează aceleași verificări pe fixturile `doc/bib/checked.fff.json`, produse de acele programe. Teste proprii: `cargo test` în fiecare proiect (modulele `fff`).

## 2. Motorul A/B comun („Ce variantă e mai bună?”)

`tools/fff-ab.js` (injectat cu `inject-shared.mjs`) în Cadraj, Surveyor, ScryVeil, FreeDetect: butonul „A/B”, 2–12 variante (preluate din pagină sau scrise), perechile cele mai rar comparate, votul A / B / egal / sar peste, clasament Elo secvențial (K=32, start 1500), verdict prudent („conduce X” doar după ≥ 3 comparații per variantă și ≥ 60 de puncte diferență; altfel „încă nu se poate spune”). Rezultatul iese ca `experiment/ab` (întrebare, clasament, voturi, verdict, metodă, avertisment, `csv`); DataWeave îl deschide ca tabel, iar alt A/B îl poate relua. **Limită:** e preferința uneia sau a câtorva persoane pe un criteriu scris, nu o măsurătoare; starea stă în `localStorage` (`fff.ab.<slug>`).

## 3. Laboratorul de reproducere

`tools/fff-repro.js` în DataWeave și AcademiSearch (butonul „Reproducere”): afirmația + cifra afirmată + calculul (medie, sumă, număr, minim, maxim, mediană, pondere; filtru opțional pe o coloană) + CSV atașat (lipit, fișier sau tabelul din DataWeave) → „reprodusă” (rotunjit la precizia cifrei afirmate sau în toleranța relativă, implicit 0,5 %), „nereprodusă” sau „neconcludent” (motiv). Plicul `claim/repro` poartă datele (≤ 200 KB), SHA-256 și specificația; la primire se **re-rulează** și se spune „rezultat identic” sau „rezultat DIFERIT”. **AGORA** (adaptor `Agora.js`) primește `claim/repro` cu `subject = {indicator, country}` și marchează în comparator fiecare cifră „verificat” / „nepotrivit” / „neverificat”, cu rezumat; reproducerile se țin în `agora.repro` (fără CSV). **Limită:** verifică aritmetica afirmației din datele atașate, nu proveniența datelor; „reprodusă” nu înseamnă „adevărată”. Câmpurile sursă/dată din Etapa 0 rămân sursa pentru cifrele din AGORA; marcajul nu le modifică.

## 4. Jurnal de teren → atlas

`tools/fff-jurnal.js` în FieldObserver, VATRA, URME, Poteca, ExploratoriiEco și Arhiva fără frontiere: butonul „Jurnal de teren” (titlu, notă, fel, latitudine/longitudine scrise, preluate din câmpurile paginii unde există — Poteca, ExploratoriiEco, FieldObserver — sau din „Locația mea”, la cerere, cu permisiunea browserului). Jurnalul (`fff.jurnal`, max. 2000 de intrări) se exportă ca plic `geo/journal`, GeoJSON sau GPX; la export poziția poate fi rotunjită (implicit ~100 m). Plicurile primite se unesc fără duplicate (după id), iar Arhiva fără frontiere le arată într-un atlas SVG local (fără hartă încărcată de pe server) și le poate retrimite. **Limite:** fiecare aplicație are propriul `localStorage` (origini diferite), deci „jurnalul comun” este formatul comun plus plicul, nu o stocare partajată; coordonatele sunt cele introduse sau date de dispozitiv, neverificate; nu se citesc jurnalele vechi ale aplicațiilor (de ex. `exploratoriieco.jurnal-v1`).

## Rulare

```
node tests/flows-unit.test.mjs        # Node: fluxuri, A/B, reproducere (fără browser)
node tests/flows.test.mjs [filtru]    # Chromium, aplicațiile reale, rețea oprită; FFF_RUST_ROOT pentru binarele Rust; FFF_AXE pentru axe-core
```
