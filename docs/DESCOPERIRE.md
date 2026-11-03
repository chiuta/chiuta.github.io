# Descoperire (Etapa 3)

Totul rulează în `index.html` (un singur fișier, CSP `connect-src 'none'`), fără biblioteci externe, în cele 8 limbi. Sursa modulului: `tools/discover/` (CSS, HTML, dialog, texte, JS); se inserează cu `node tools/build-discover.mjs` (idempotent, rulează și `fixcsp`; `--check` verifică că `index.html` e la zi).

## 1. Relații declarate
- `data/catalog-meta.json`: `topics` (subiecte cu membri, nume în 8 limbi și cuvinte-cheie), `extraRelations` (perechi alese de mână) și grupurile vechi `related`.
- `tools/catalog-meta-lib.mjs → buildRelations()` face graful simetric (greutate = câte subiecte comune; perechile manuale cântăresc dublu). `tools/sync-catalog.mjs` îl încorporează în `#catalog-meta` ca `relations`/`topics`, iar `validateMeta` **oprește** sincronizarea dacă un card (fără variante) are < 2 relații sau dacă o cheie nu are card.
- Cardul arată până la 5 chip-uri „Înrudite”, fișa le arată pe toate. Subiectele se adaugă și în căutarea din catalog (cuvinte-cheie + numele în 8 limbi).

## 2. Constelația
Dialog nativ (`#cs-dlg`), SVG generat local: graf cu layout de forțe determinist, culoarea = `--h/--c` ale secțiunii (urmează tema). Mouse: trecerea peste stea evidențiază vecinii, clic deschide cardul (`gotoCard`). Tastatură: un singur punct de tab (roving tabindex), săgețile merg la steaua cea mai apropiată în direcție, Enter/Spațiu deschide cardul, Esc închide. Alternativă fără pointer: selectorul „Alege o aplicație” + panoul cu relații ca butoane. Zoom prin butoane, derulare în regiune cu `tabindex=0`. Constelar **nu** e o aplicație-graf (e un companion AI), deci constelația e în hub.

## 3. Căutare universală
Câmpul din catalog caută (fără diacritice, în toate cele 8 limbi) în nume, descriere, etichete, fișă, **numele secțiunii** și subiectele cardului. Fără rezultate, apare butonul „Întreabă asistentul” cu aceleași cuvinte.

**Căutare în datele aplicațiilor — limită.** Fiecare aplicație își ține datele în `localStorage`/IndexedDB ale propriului site (`chiuta.github.io/<App>/`, altă origine decât hub-ul), pe care hub-ul nu le poate citi, iar `frame-src`/`connect-src` ale hub-ului sunt închise. Alternativa implementată, cu consimțământ explicit: panoul „Caută în fișierele mele” indexează **în memorie** fișierele alese de utilizator (plicuri `.fff.json`, CSV, text, Markdown, GPX, ICS) după bifarea căsuței de consimțământ; nu se scrie nimic în `localStorage`/IndexedDB, nu se trimite nimic, „Uită fișierele” șterge indexul.

## 4. „Spune-mi ce ai de făcut”
Reguli locale: cuvintele (fără diacritice, fără cuvinte-ciot) sunt potrivite cu titlul (×6), etichetele (×4), cuvintele-cheie ale subiectelor (×3) și descrierile din toate limbile (×1,5), cu potrivire pe prefix comun ≥ 5. Prima aplicație = cea mai bună; a doua/a treia = alte potriviri puternice, favorizând vecinii din graf; dacă lipsesc, se completează cu vecinii cei mai apropiați. Fără nicio potrivire: trei puncte de pornire (TranslateHub, AcademiSearch, MarkdownAtelier). Fiecare propunere are „Deschide aplicația” și „Arată cardul”; după „Deschide”, pasul următor e marcat „Urmează” (browserul nu permite deschiderea a trei file dintr-un singur clic). Căi: întrebare + Enter (1 clic pe câmp) + „Deschide” = 2 clicuri.

## 5. Auditor
Panou în hub: alegi/tragi un fișier; se citește doar în memoria filei (SHA-256 prin `crypto.subtle`, analiză de octeți). Triere locală pe cele trei axe ale aplicațiilor: **proveniență** (manifest C2PA/JUMBF detectat, declarații de generare IA în XMP/IPTC/PNG), **metadate** (EXIF: aparat, program, autor, date, GPS decodat; XMP; PDF: Author/Creator/Producer, JavaScript, criptare, fișiere încorporate; OOXML/ODF: autor, ultimul editor, macrouri VBA, legături externe), **linkuri** (URL-uri distincte, domenii, `http` simplu, `javascript:`). Raportul se salvează ca plic `.fff.json` compatibil (`fff:1`, `type: text/markdown`) sau se copiază.

**Limită și alternativă documentată.** Nu rulează efectiv Proveniență, Curățitor și Surveyor pe fișier: sunt pe site-uri separate (altă origine), nu se pot încorpora (CSP) și nu au adaptor de plic pentru fișiere arbitrare (plicul e ≤ 8 MiB și nu poartă imagini mari; în link ar încăpea ≤ 24 000 de caractere). De aceea raportul spune explicit ce **nu** validează (semnătură, listă de încredere, valabilitatea linkurilor – care cere rețea) și trimite la cele trei aplicații, cu instrucțiunea de a trage acolo același fișier. Un adaptor `file/ref` în cele trei aplicații ar putea fi o etapă ulterioară.

## 6. Teste
`node tests/discover.test.mjs` (Playwright, google-chrome; axe-core prin `FFF_AXE`): ≥ 2 relații pe card în 8 limbi, 6 întrebări × 8 limbi pe desktop și mobil cu numărarea clicurilor (≤ 3), constelația (mouse, tastatură, mobil), căutare, auditor pe JPEG/HTML/PDF/binar, căutare în fișiere proprii, axe 0 violări (desktop + mobil, 8 limbi), offline și CSP.
