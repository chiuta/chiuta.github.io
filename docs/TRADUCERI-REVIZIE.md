# Revizuirea traducerilor automate (fr, it, es, pt, de, hu)

Nu există vorbitori nativi ai acestor șase limbi în echipă. Traducerile din demonstrațiile native, din README-urile MENSURA și Fenarium și din TEZAUR (subtitrările tutorialelor, interfața web) sunt făcute automat și **au fost controlate doar mecanic**. Controlul prinde greșeli de formă și inconsecvențe; **nu garantează că o frază sună firesc sau e corectă**. Singura revizuire care contează este cea a unui vorbitor nativ. Cum o faci și cum o marchezi: [TRADUCERI-CONTRIBUTIE.md](TRADUCERI-CONTRIBUTIE.md).

## Ce verifică controlul

`node tools/traduceri-control.mjs --apps <apps> --tezaur <TEZAUR>` (fără argumente verifică doar ce e în hub: `demo/nativ`). Cod: [tools/traduceri-lib.mjs](../tools/traduceri-lib.mjs); glosarul și pragurile: [data/traduceri.json](../data/traduceri.json). 1392 de segmente (replici, șiruri de interfață, linii de README), comparate cu textul englez (sursa de lucru) și cu cel românesc (sursa de autor):

| Verificare | Ce prinde | Gravitate |
|---|---|---|
| glosar | 30 de termeni tehnici (bibliotecă, citare, sursă, fragment, ciornă, link rupt, fișier orfan, strat de text, cinematică inversă …) în forma acceptată a fiecărei limbi; calcurile (ex. *librairie* pentru *library*) | formă interzisă = eroare; formă lipsă = avertisment |
| consecvență | același termen tradus în mai multe feluri în aceeași unitate | avertisment |
| invarianți | comenzi, nume de format (BibTeX, CSV, PNG …), cifre, text în ghilimele sau backticks din sursă, păstrate neschimbate (siglele localizate IQ→QI/CI, RQ→QR/CR sunt acceptate) | eroare |
| lungime | traducere de peste 1,5 ori sau sub 0,6 din lungimea englezei (la texte de peste 60 de caractere); subtitrare peste 230 de caractere sau peste 21 de caractere pe secundă | avertisment |
| caractere | alfabetul limbii (ex. maghiara cere ő ű, nu õ û), litere românești scăpate (ă ș ț), mojibake, spații duble, spațiere la punctuație (franceza cere spațiu înainte de `: ; ? !`, celelalte limbi nu), ghilimele drepte, ¿ ¡ perechi în spaniolă | eroare / avertisment |
| netraduse | segment identic cu englezul; cuvinte-funcție englezești rămase | eroare / avertisment |
| registru | tu și vous (du și Sie …) amestecate în aceeași unitate | avertisment |
| variante | portugheza braziliană într-un text în varianta europeană (*arquivo*, *aba*, *baixar*), spaniola latino-americană | avertisment |
| marcaje | starea „automat” / „revizuit de <nume>” din fișiere față de registrul [data/traduceri-revizuite.json](../data/traduceri-revizuite.json) | eroare |

Etichetele românești ale interfeței TEZAUR (*Întreabă*, *Căutare*, *Schiță*, *Redactare* …) apar intenționat în subtitrările tutorialelor în toate limbile, pentru că pe ecran interfața este în română; ele nu sunt tratate ca erori.

## Ce s-a corectat la prima trecere (3 noiembrie 2026)

Greșeli de formă sau de sens găsite de control sau la citirea frazelor semnalate, corectate în text. Nu înlocuiesc revizuirea nativă.

**Demonstrații native** (`tools/native-demos/narration.py`, apoi `build.py`):
- de, OSATURA: *genau wie das Rendern* (= „ca randarea”) în loc de *genau wie der Renderer* („ca randorul”).
- de, VERIGA: *durchsucht … und sucht* (repetiție, și „crawl” nu e „căutare”) → *durchläuft … und sucht*.
- hu, VERIGA: *weboldal / oldal* („pagină web”) pentru „site” → *webhely*, ca să nu se confunde cu „pagină” din fraza următoare.
- pt, OSATURA: *uma imagem* pentru „one frame” → *um fotograma*.
- fr, OSATURA: *comme le rendu* → *comme le moteur de rendu*.

**TEZAUR, subtitrările tutorialelor** (`scripts/tutorials/tutorials.py` și cele 13 × 6 fișiere `.vtt`):
- fr, it: „pentru teza ta” dispăruse din fraza despre `declare` → adăugat (*de votre thèse*, *della tua tesi*).
- fr, it, es, pt, hu: „serverul de model” fusese redus la „model” (*vers le modèle*) → *vers le serveur du modèle* și echivalentele.
- pt: formele din portugheza braziliană (*aba, arquivo, baixe, seção*) într-o colecție în varianta europeană → *separador, ficheiro, descarregue, secção* (9 replici).
- de: *[@Schlüssel] wird … zu* pierdea „citările” → *[@Schlüssel]-Belege werden …*.
- hu: *Add a kliens konfigurációjához* (ambiguu: „Dă configurația clientului”) → *Add hozzá a kliens konfigurációjához*.

**README-uri**: fr, MENSURA și Fenarium: *tes appareils* (tutoiement) în mijlocul unui text cu *vous/votre* → *vos appareils*.

**Marcaje**: toate unitățile poartă acum un marcaj citibil de mașină (`traducere: fr=automat …`) care urmează registrul de revizuiri; vezi testul din [tests/traduceri.test.mjs](../tests/traduceri.test.mjs).

## De decis de un vorbitor nativ (nu s-a schimbat nimic)

Semnalate de control, dar alegerea ține de ureche, nu de regulă:

- **de, „citation”**: *Zitat / Zitierung* în interfața TEZAUR și în demonstrații, dar *Beleg* în 9 din 12 subtitrări de tutorial. Ambele există în limbajul academic; un singur termen ar fi mai consecvent.
- **hu, „citation”**: *hivatkozás* (peste tot) și o singură dată *idézési címke* (tutorialul 10) pentru „citation labels”.
- **Registrul** (formal / informal): se verifică automat pentru fr, de, es, it, pt (singura nepotrivire găsită, *tes appareils* în README-urile fr, s-a corectat); pentru maghiară nu există verificare, fiindcă registrul stă în sufixe.
- **hu**: textele sunt la persoana a doua singular informal (*tegező*: *kérdezz, a könyvtárad*). Un revizor poate prefera forma de politețe pentru README-uri.
- **it, es, pt**: *font(i) / fuente / fonte* („source”) vs. *sorgente / código* când e vorba de cod sursă; sunt corecte, dar nu sunt aplicate uniform.
- **Toate limbile**: mesajele de eroare ale programelor native apar în engleză în ieșirea reală din terminal (nu sunt traduse; sunt ieșiri reale).

## Ce nu poate verifica controlul

Naturalețea frazei, ordinea cuvintelor, acordul în gen și număr, registrul adecvat, umorul și ambiguitățile, termenii de specialitate care nu sunt în glosar, ortografia dincolo de alfabet (nu există dicționar de ortografie). Glosarul a fost scris de mână, de asemenea fără vorbitor nativ: o abatere e un semnal, nu o dovadă.

## Lista generată

Partea de mai jos se regenerează din [data/traduceri.json](../data/traduceri.json) și [data/traduceri-revizuite.json](../data/traduceri-revizuite.json) cu `node tools/traduceri-control.mjs --report`, iar CI verifică (`--check-report`) că nu a rămas în urmă.

<!-- gen:start (tools/traduceri-control.mjs --report; nu edita de mână) -->

### Stare pe unitate și limbă

| Unitate | Depozit | fr | it | es | pt | de | hu |
|---|---|---|---|---|---|---|---|
| Demonstrații native (demo/nativ) | hub | automat | automat | automat | automat | automat | automat |
| TEZAUR: tutoriale video (subtitrări) | chiuta/TEZAUR | automat | automat | automat | automat | automat | automat |
| TEZAUR: interfața web (tezaur.html, dicționarul I18N) | chiuta/TEZAUR | automat | automat | automat | automat | automat | automat |
| MENSURA: README.<limbă>.md | chiuta/MENSURA | automat | automat | automat | automat | automat | automat |
| Fenarium: README.<limbă>.md | chiuta/Fenarium | automat | automat | automat | automat | automat | automat |

Așteaptă revizuire nativă: **30 din 30** perechi unitate × limbă; revizuite: 0.

### Fișiere care așteaptă revizuire nativă

Căile sunt relative la depozitul unității. Unde apare `{id}`, identificatorii sunt enumerați în paranteză.

#### fr · franceză (5 unități)

- **Demonstrații native (demo/nativ)** (hub)
  - `demo/nativ/{id}.fr.vtt` × 4 (id: tezaur, veriga, legatorocr, osatura)
  - `demo/nativ/nativ-data.js` (șirurile interfeței, cheia ui.*)
  - `demo/nativ/audio/{id}.fr.ogg` (voce sintetică: se regenerează din același text cu tools/native-demos/build.py)
- **TEZAUR: tutoriale video (subtitrări)** (chiuta/TEZAUR)
  - `assets/tutorials/{id}.fr.vtt` × 13 (id: 01-first-question, 02-search-compare-gaps, 03-audit-references, 04-outline-and-draft, 05-cli-ingest-search, 06-cli-ask-receipts, 07-cli-pdf-tables-equations, 08-cli-audit-coverage, 09-cli-bibliography-export, 10-mcp-assistant, 11-server-api, 12-mesh-p2p, 13-install)
  - `scripts/tutorials/tutorials.py` (sursa textelor; se editează aici și în .vtt)
- **TEZAUR: interfața web (tezaur.html, dicționarul I18N)** (chiuta/TEZAUR)
  - `tezaur.html (dicționarul I18N, 105 chei)`
- **MENSURA: README.<limbă>.md** (chiuta/MENSURA)
  - `README.fr.md`
- **Fenarium: README.<limbă>.md** (chiuta/Fenarium)
  - `README.fr.md`

#### it · italiană (5 unități)

- **Demonstrații native (demo/nativ)** (hub)
  - `demo/nativ/{id}.it.vtt` × 4 (id: tezaur, veriga, legatorocr, osatura)
  - `demo/nativ/nativ-data.js` (șirurile interfeței, cheia ui.*)
  - `demo/nativ/audio/{id}.it.ogg` (voce sintetică: se regenerează din același text cu tools/native-demos/build.py)
- **TEZAUR: tutoriale video (subtitrări)** (chiuta/TEZAUR)
  - `assets/tutorials/{id}.it.vtt` × 13 (id: 01-first-question, 02-search-compare-gaps, 03-audit-references, 04-outline-and-draft, 05-cli-ingest-search, 06-cli-ask-receipts, 07-cli-pdf-tables-equations, 08-cli-audit-coverage, 09-cli-bibliography-export, 10-mcp-assistant, 11-server-api, 12-mesh-p2p, 13-install)
  - `scripts/tutorials/tutorials.py` (sursa textelor; se editează aici și în .vtt)
- **TEZAUR: interfața web (tezaur.html, dicționarul I18N)** (chiuta/TEZAUR)
  - `tezaur.html (dicționarul I18N, 105 chei)`
- **MENSURA: README.<limbă>.md** (chiuta/MENSURA)
  - `README.it.md`
- **Fenarium: README.<limbă>.md** (chiuta/Fenarium)
  - `README.it.md`

#### es · spaniolă (5 unități)

- **Demonstrații native (demo/nativ)** (hub)
  - `demo/nativ/{id}.es.vtt` × 4 (id: tezaur, veriga, legatorocr, osatura)
  - `demo/nativ/nativ-data.js` (șirurile interfeței, cheia ui.*)
  - `demo/nativ/audio/{id}.es.ogg` (voce sintetică: se regenerează din același text cu tools/native-demos/build.py)
- **TEZAUR: tutoriale video (subtitrări)** (chiuta/TEZAUR)
  - `assets/tutorials/{id}.es.vtt` × 13 (id: 01-first-question, 02-search-compare-gaps, 03-audit-references, 04-outline-and-draft, 05-cli-ingest-search, 06-cli-ask-receipts, 07-cli-pdf-tables-equations, 08-cli-audit-coverage, 09-cli-bibliography-export, 10-mcp-assistant, 11-server-api, 12-mesh-p2p, 13-install)
  - `scripts/tutorials/tutorials.py` (sursa textelor; se editează aici și în .vtt)
- **TEZAUR: interfața web (tezaur.html, dicționarul I18N)** (chiuta/TEZAUR)
  - `tezaur.html (dicționarul I18N, 105 chei)`
- **MENSURA: README.<limbă>.md** (chiuta/MENSURA)
  - `README.es.md`
- **Fenarium: README.<limbă>.md** (chiuta/Fenarium)
  - `README.es.md`

#### pt · portugheză (5 unități)

- **Demonstrații native (demo/nativ)** (hub)
  - `demo/nativ/{id}.pt.vtt` × 4 (id: tezaur, veriga, legatorocr, osatura)
  - `demo/nativ/nativ-data.js` (șirurile interfeței, cheia ui.*)
  - `demo/nativ/audio/{id}.pt.ogg` (voce sintetică: se regenerează din același text cu tools/native-demos/build.py)
- **TEZAUR: tutoriale video (subtitrări)** (chiuta/TEZAUR)
  - `assets/tutorials/{id}.pt.vtt` × 13 (id: 01-first-question, 02-search-compare-gaps, 03-audit-references, 04-outline-and-draft, 05-cli-ingest-search, 06-cli-ask-receipts, 07-cli-pdf-tables-equations, 08-cli-audit-coverage, 09-cli-bibliography-export, 10-mcp-assistant, 11-server-api, 12-mesh-p2p, 13-install)
  - `scripts/tutorials/tutorials.py` (sursa textelor; se editează aici și în .vtt)
- **TEZAUR: interfața web (tezaur.html, dicționarul I18N)** (chiuta/TEZAUR)
  - `tezaur.html (dicționarul I18N, 105 chei)`
- **MENSURA: README.<limbă>.md** (chiuta/MENSURA)
  - `README.pt.md`
- **Fenarium: README.<limbă>.md** (chiuta/Fenarium)
  - `README.pt.md`

#### de · germană (5 unități)

- **Demonstrații native (demo/nativ)** (hub)
  - `demo/nativ/{id}.de.vtt` × 4 (id: tezaur, veriga, legatorocr, osatura)
  - `demo/nativ/nativ-data.js` (șirurile interfeței, cheia ui.*)
  - `demo/nativ/audio/{id}.de.ogg` (voce sintetică: se regenerează din același text cu tools/native-demos/build.py)
- **TEZAUR: tutoriale video (subtitrări)** (chiuta/TEZAUR)
  - `assets/tutorials/{id}.de.vtt` × 13 (id: 01-first-question, 02-search-compare-gaps, 03-audit-references, 04-outline-and-draft, 05-cli-ingest-search, 06-cli-ask-receipts, 07-cli-pdf-tables-equations, 08-cli-audit-coverage, 09-cli-bibliography-export, 10-mcp-assistant, 11-server-api, 12-mesh-p2p, 13-install)
  - `scripts/tutorials/tutorials.py` (sursa textelor; se editează aici și în .vtt)
- **TEZAUR: interfața web (tezaur.html, dicționarul I18N)** (chiuta/TEZAUR)
  - `tezaur.html (dicționarul I18N, 105 chei)`
- **MENSURA: README.<limbă>.md** (chiuta/MENSURA)
  - `README.de.md`
- **Fenarium: README.<limbă>.md** (chiuta/Fenarium)
  - `README.de.md`

#### hu · maghiară (5 unități)

- **Demonstrații native (demo/nativ)** (hub)
  - `demo/nativ/{id}.hu.vtt` × 4 (id: tezaur, veriga, legatorocr, osatura)
  - `demo/nativ/nativ-data.js` (șirurile interfeței, cheia ui.*)
  - `demo/nativ/audio/{id}.hu.ogg` (voce sintetică: se regenerează din același text cu tools/native-demos/build.py)
- **TEZAUR: tutoriale video (subtitrări)** (chiuta/TEZAUR)
  - `assets/tutorials/{id}.hu.vtt` × 13 (id: 01-first-question, 02-search-compare-gaps, 03-audit-references, 04-outline-and-draft, 05-cli-ingest-search, 06-cli-ask-receipts, 07-cli-pdf-tables-equations, 08-cli-audit-coverage, 09-cli-bibliography-export, 10-mcp-assistant, 11-server-api, 12-mesh-p2p, 13-install)
  - `scripts/tutorials/tutorials.py` (sursa textelor; se editează aici și în .vtt)
- **TEZAUR: interfața web (tezaur.html, dicționarul I18N)** (chiuta/TEZAUR)
  - `tezaur.html (dicționarul I18N, 105 chei)`
- **MENSURA: README.<limbă>.md** (chiuta/MENSURA)
  - `README.hu.md`
- **Fenarium: README.<limbă>.md** (chiuta/Fenarium)
  - `README.hu.md`

<!-- gen:end -->
