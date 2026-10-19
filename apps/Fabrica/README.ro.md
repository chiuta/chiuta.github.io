# Fabrica

[English](README.md) · **Română** · [Français](README.fr.md) · [Italiano](README.it.md) · [Español](README.es.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · [Magyar](README.hu.md)

**Versiune:** 1.1.0 · **Ultima actualizare:** 2026-10-19

Limbile interfeței: **Română, English, Français, Italiano, Español, Português (PT), Deutsch, Magyar**

Fabrica este o fabrică de cursuri și chestionare: scrii un curs (date, avertismente, niveluri și lecții în Markdown simplu, întrebări de șapte tipuri, glosar, tablou de dovezi, test final cu bancă de întrebări și extragere determinată de seed), îl validezi și îl exporți ca **un singur fișier HTML autonom** (opțional ZIP cu README). Fișierul generat rulează offline, are navigare, progres salvat local, repetiție spațiată pentru întrebările greșite, test final, certificat de parcurgere tipăribil (fără valoare de acreditare), mod luminos/întunecat și interfață în 8 limbi. Include un exemplu complet („Cum citești o etichetă nutrițională”) și trei șabloane de pornire.

![captură](screenshot.png)

**Live:** https://chiuta.github.io/apps/Fabrica/

## Cum se folosește

1. **Șabloane** (sus) → alege „Curs scurt cu test”, „Ghid cu tablou de dovezi”, „Quiz simplu” sau exemplul complet; sau completezi direct panoul **Curs**.
2. **Curs**: titlu, descriere, autor, licența conținutului, limba conținutului, versiune, avertismente (șabloane: informativ, nu e sfat medical / juridic / financiar), domenii sensibile, culoare de accent, certificat, repetiție spațiată.
3. **Conținut**: niveluri și lecții (mută sus/jos, duplică, șterge); textul lecției cu bară Markdown (titluri, liste, bold/italic, linkuri externe și interne `[text](lesson:id)`, tabele, citate, imagini); întrebări de exersare per lecție.
4. **Tipuri de întrebări**: alegere unică, alegere multiplă, adevărat/fals, completare (`[[răspuns|variantă]]`), ordonare (cu butoane sus/jos, accesibil de la tastatură), potrivire perechi, răspuns scurt (variante acceptate; comparația ignoră majusculele, diacriticele și punctuația). Fiecare are explicație și feedback pe răspuns corect/greșit.
5. **Glosar** (`{gl:Termen}` în lecții) și **Tablou de dovezi**: afirmații cu nivel (studii controlate / observațional / tradițional / fără dovezi), surse text, marcate în lecții cu `{ev:ID}`.
6. **Test final**: prag, număr de întrebări extrase din bancă, seed (aceeași valoare → aceeași extragere și ordine), altă extragere la fiecare încercare (seed + număr de încercare), opțional și întrebările din lecții. „Simulează extragerea” arată rezultatul.
7. **Validare**: lecții goale, întrebări fără răspuns corect, linkuri interne rupte, imagini prea mari/externe/fără alt, avertismente lipsă pentru domenii sensibile (explicit sau euristic), surse lipsă la afirmații, duplicate etc. „Mergi la” duce la locul problemei.
8. **Previzualizare**: fișierul exact ca la export, într-un cadru izolat (sandbox), cu lățime completă sau de telefon (360 px).
9. **Export**: HTML, ZIP (index.html + README.md + sursa `.course.json`), sursa `.course.json`, copie de siguranță `.fff.json`. **Import**: `.course.json`, HTML-ul sau ZIP-ul exportat (cursul se recuperează din ele), `.fff.json`; întrebări din **CSV** (coloane: `tip;întrebare;corect;greșit1;greșit2;greșit3;explicație`; tipuri `unic, multi, adevarat-fals, completare, scurt, ordonare, potrivire`; variantele multiple se separă cu `|`, perechile cu `stânga=dreapta`; delimitator `,` `;` sau tab, ghilimele RFC 4180).

Anulare/refacere: butoanele din antet, `Ctrl+Z` / `Ctrl+Y` (în afara câmpurilor de text) și butonul „Anulează” din notificarea de după ștergere.

## Ce NU face și limitele

- **Nu acreditează nimic.** Certificatul este un document informativ local, fără valoare de acreditare sau recunoaștere; textul lui o spune.
- Nu verifică corectitudinea științifică, juridică sau medicală a conținutului: validatorul prinde probleme formale și (euristic, după cuvinte-cheie) lipsa unui avertisment; răspunderea pentru conținut rămâne a autorului. Nivelul de dovezi îl alege autorul; Fabrica nu verifică sursele.
- Fără conturi, fără sincronizare, fără colaborare în timp real, fără servere. Progresul cursantului este local (browserul lui) și nu poate fi verificat de nimeni; testul nu este supraveghere (răspunsurile corecte sunt în fișier).
- Markdown este un subset (titluri, liste imbricate, bold/italic, cod, linkuri, imagini, tabele, citate, linie); fără HTML brut, fără formule matematice, fără audio/video încorporat. Imaginile sunt doar `data:` (png/jpeg/gif/webp), redimensionate la max. 1000 px la inserare; linkurile externe nu se verifică offline.
- Ordonarea se face cu butoane (nu prin tragere). Ordinea aleatorie se bazează pe un generator cu seed, nu pe unul criptografic.
- Interfața generată are 8 limbi, dar **conținutul** cursului este doar în limba scrisă de autor. Șabloanele de pornire sunt în română și engleză (restul limbilor primesc varianta engleză); exemplul complet este în română.
- Compresia ZIP: scriitorul propriu folosește „stored” (fără compresie); cititorul acceptă și ZIP-uri comprimate (deflate) unde browserul oferă `DecompressionStream`.
- Ciorna se salvează în `localStorage`; dacă imaginile depășesc cota, apare un avertisment și trebuie exportat cursul.

## Confidențialitate

Rulează local, **nu trimite nimic** (`connect-src 'none'`). Ciorna cursului se păstrează doar în acest browser (`fff.fabrica.draft`, plus limba și tema); „Șterge tot” le elimină. Fișierul generat nu conține telemetrie; progresul cursantului stă în `fff.course.<id>.*` și poate fi exportat/importat/șters din pagina „Setări și date” a cursului.

## Securitate și CSP

Editorul: `default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src about:; object-src 'none'; worker-src blob:; manifest-src 'none'`. Abateri justificate: `frame-src about:` pentru previzualizarea în cadru izolat (`srcdoc`, `sandbox="allow-scripts allow-modals"`).

Fișierul generat: `default-src 'none'; script-src 'sha256-<hash>'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; media-src 'none'; worker-src 'none'; manifest-src 'none'`. **Hash-ul SHA-256 este calculat în browser** (Web Crypto, cu rezervă în JavaScript) în momentul exportului, din textul exact al scriptului inserat, și scris în `<meta http-equiv="Content-Security-Policy">`; după export, Fabrica reparsează fișierul și verifică hash-ul, absența handlerelor inline și a resurselor externe. Datele cursului stau într-un bloc `application/json` neexecutabil (cu `<`, `>`, `&` scăpate); toate textele sunt scăpate la afișare, linkurile sunt limitate la `https:`, `mailto:` și rute interne.

## Formate

- `.course.json`: `{"format":"fabrica-course","schema":1,"app":"Fabrica","version":"1.0.0","saved":"…","course":{…}}` — schema este versionată; importul normalizează și validează (tipuri, id-uri unice, o singură variantă corectă la alegere unică, imagini `data:` permise doar de tip imagine) și refuză fișierele cu schemă mai nouă.
- `.fff.json` (copie de siguranță): `{"format":"fff-bundle","schema":1,"app":"fabrica","version":"1.0.0","updated":"2026-10-14","data":{"draft":{…}}}`.
- Progres cursant (din fișierul generat): `{"format":"fff-bundle","app":"course:<id>",…,"data":{"progress":{…}}}`.
- Import: `.course.json`, `.html`/`.zip` exportate, `.fff.json`, `.csv` (întrebări). Export: `.html`, `.zip`, `.course.json`, `.fff.json`.

## Tehnic

Un singur `index.html` (HTML + CSS + JS inline, fără biblioteci externe). Motorul de curs (player) este un script separat în pagină; **același text** este inserat în fișierul exportat și rulează în previzualizare, deci previzualizarea este identică cu rezultatul. Repetiția spațiată folosește SM-2 simplificat (EF minim 1,3; intervale 1 zi, 6 zile, apoi înmulțire cu EF; la eșec intervalul revine la 1 zi). Selecția testului: amestec Fisher–Yates cu generator mulberry32 inițializat din hash(seed + încercare). Scriitor/cititor ZIP și CRC-32 proprii. Accesibilitate: legende și etichete reale, mesaje `aria-live`, focus gestionat la schimbarea paginii, contrast AA în ambele teme (accentele pot fi alese dintre cinci palete verificate), `prefers-reduced-motion`, tabele derulabile cu focus. Scurtături în cursul generat: `Alt+Shift+→` / `Alt+Shift+←` (lecția următoare/anterioară).

Testele (`tests/test.mjs`, Playwright, rețea blocată) acoperă editorul (structură cu anulare, întrebări, validator, import/export, CSV, ZIP, imagini, previzualizare, axe) și **fișierul generat încărcat fără rețea** (0 pageerror/CSP, hash CSP recalculat în Node, parcurgerea lecțiilor, scorarea fiecărui tip, progres persistent, repetiție, test cu extragere, certificat, 8 limbi, axe în ambele teme, 360 px).

## Terți

Niciun cod terț. (Testele folosesc Playwright și axe-core, doar în dezvoltare.)

## Traduceri

Interfața editorului și a cursurilor generate: română și engleză scrise de autor; **fr, it, es, pt, hu, de sunt traduceri automate, neverificate nativ**. Avertismentele-șablon (informativ/medical/juridic/financiar) sunt tot traduceri automate: ar trebui verificate de un jurist/vorbitor nativ înainte de folosire publică.

## Licență

Licență: MIT — vezi fișierul `LICENSE` din rădăcina depozitului.

## Istoric

- 1.0.0 — 2026-10-14: prima versiune.
- 1.1.0 — 2026-10-19: export „Quiz pentru Undava (.json)” și import din fișiere Undava (.json) prin butonul de import CSV; se transferă doar întrebările cu echivalent (alegere unică, adevărat/fals, răspuns scurt, completare cu un gol).
