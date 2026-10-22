# Decizii care aparțin autorului

Fiecare punct de mai jos nu poate fi „reparat” tehnic fără o hotărâre a autorului: ține de licențe, drepturi, răspundere sau de direcția proiectului. Pentru fiecare: **context**, **toate opțiunile**, **recomandare** și **pași**. Nimic de aici nu a fost aplicat în aplicații, în afară de ce scrie la „Deja făcut”.

> Nu sunt avocat. Pentru licențe și drepturi, rândurile de mai jos sunt o lectură practică a licențelor publicate de proiecte, nu un aviz juridic. Acolo unde miza e mare (GPL, drepturi de imagine), o confirmare de la un jurist sau de la titularul drepturilor merită obținută în scris.

## Tabel de decizie

| # | Decizie | Urgență | Efort | Recomandare pe scurt |
|---|---|---|---|---|
| 1.1 | ATINGERE: tabel kanji derivat din pykakasi (GPL-3.0) | mare (obligație legală dacă se distribuie) | mediu | înlocuiește cu date permisive (Unihan) sau scoate japoneza până atunci |
| 1.2 | ATINGERE: model NLLB-200 (CC-BY-NC) | medie | mic | păstrează, documentează, fixează revizia; evaluează un model permisiv |
| 1.3 | NOTICE.md lipsă | mică | mic | confirmă șabloanele create (vezi mai jos) |
| 1.4 | Valea Plopului: drepturi desen, persoane numite, pagină de erate | mare (persoane reale) | mic–mediu | confirmă drepturile în scris; anonimizează sau marchează „reconstrucție speculativă”; publică pagina de erate |
| 2 | Revizuire nativă maghiară și germană | medie | mediu, continuu | etichetă onestă acum, revizuire pe priorități |
| 3 | Revizuire de specialist (medical, juridic, urgențe) | mare pentru PULS | mediu | avertismente și surse acum; revizuire de specialist pentru PULS |
| 4 | Fuziuni (Numerologie + NumeroLogIA; aplicațiile de relaxare) | mică | mare dacă se face | legături încrucișate acum; nu fuziona relaxarea |
| 5 | Sursă proprie pentru indexul VNTV | medie | mic–mediu | index static generat de CI, cu catalogul oficial ca sursă preferată când există |

## Deja făcut

- Șabloane `NOTICE.md` (marcate „de confirmat de autor”) create doar unde componentele sunt sigure, verificate în fișierele din depozit:
  - `TranslateHub/NOTICE.md`: mammoth (BSD-2-Clause, cu dependențele împachetate), fonturi Barlow / Barlow Condensed / Cormorant Garamond (OFL 1.1).
  - `Universul-Observabil-2D/NOTICE.md`: QRCode.js (MIT), cu suma SHA-256 a fișierului.
  - `docs/notice-sabloane/OmniHost.NOTICE.md`: jsQR (Apache-2.0), QRCode.js (MIT), DM Sans / JetBrains Mono / Playfair Display (OFL). Este în hub, nu în depozitul OmniHost, care era gestionat de alt proces; copiază-l acolo după confirmare.
  - `AI-Liber` și `LocalMind` aveau deja `NOTICE.md` la data pregătirii acestui document; nu au fost atinse.
  - `Universul-Observabil` (1D, 3D, versiunea principală): nu a fost verificat dacă au componente terțe; nu s-a creat nimic acolo.
- `ATINGERE/NOTICE.md` documentează deja sincer pykakasi și NLLB-200 ca „decizia aparține autorului”; punctele 1.1 și 1.2 sunt acele decizii.

---

## 1. Licențe și drepturi

### 1.1 ATINGERE: tabelul kanji → hiragana derivat din pykakasi (GPL-3.0)

**Context.** `index.html` conține un tabel derivat din pykakasi, care este GPL-3.0 (după cum notează propriul `NOTICE.md`). Datele derivate pot purta aceleași condiții. Fișierul este distribuit ca un singur HTML, deci tabelul face parte din „opera combinată”. Codul propriu este MIT / Trade-Free; MIT poate fi inclus într-o operă GPL, dar atunci întreaga operă distribuită trebuie oferită sub GPL-3.0, cu sursa.

**Opțiuni.**

1. **Declari ATINGERE GPL-3.0.** Schimbi `LICENSE`, antetul din `index.html`, README-urile, `NOTICE.md` și eticheta tehnică. Pro: nimic de rescris. Contra: contrazice poziționarea „Trade-Free + MIT” a colecției și obligă pe oricine reutilizează ATINGERE.
2. **Înlocuiești tabelul cu date permisive.** Surse posibile: coloanele de lectură din Unihan (`kJapaneseKun`, `kJapaneseOn`, sub licența Unicode, permisivă), sau Kanjidic2 / JMdict (CC BY-SA 4.0: cer atribuire și share-alike pentru date, mai puțin potrivite). Pro: păstrezi MIT. Contra: calitate mai slabă pentru lecturi contextuale (Unihan dă lecturi pe caracter, nu pe cuvânt); trebuie reîncercate testele de braille japonez.
3. **Scoți limba japoneză** (și tabelul) până la rezolvare. Pro: imediat și sigur. Contra: pierzi o funcție.
4. **Tabel descărcat la cerere, ca fișier separat sub GPL-3.0.** Pro: codul rămâne MIT. Contra: nu rezolvă sigur situația (zona gri a „legării” între cod și date), cere un depozit de date separat. Nu o recomand fără aviz juridic.
5. **Contactezi autorii pykakasi** pentru o licență separată sau pentru confirmarea că datele tale nu sunt derivate (dacă tabelul a fost construit altfel). Pro: poate rezolva totul. Contra: depinde de răspuns.

**Recomandare.** Opțiunea 3 imediat (dacă aplicația este deja publică cu tabelul), apoi opțiunea 2. Fă 5 în paralel dacă vrei să păstrezi tabelul actual.

**Pași.**

1. Stabilește de unde vine exact tabelul (`git log` al depozitului ATINGERE, notele din `NOTICE.md`).
2. Hotărăște între 1 / 2 / 3.
3. Pentru 2: generează un tabel din Unihan, rulează testele braille japonez, actualizează `NOTICE.md` (Unicode License) și șterge rândul pykakasi.
4. Fă un patch de versiune în ATINGERE (kit: `build.mjs info`, `check`), actualizează cele 8 README-uri și rulează `node tools/sync-catalog.mjs` în hub.

### 1.2 ATINGERE: modelul NLLB-200 (CC-BY-NC 4.0)

**Context.** Traducerea automată în română rulează cu NLLB-200 distilled 600M, descărcat de utilizator de la Hugging Face. Licența modelului este CC-BY-NC 4.0 (necomercial), din câte se știe. Aplicația nu redistribuie greutățile; le descarcă la cerere, deci obligația ta se reduce la informare și la nerecomandarea uzului comercial. Revizia modelului nu este fixată pe un commit și nu are hash verificat. NLLB-200 apare doar în ATINGERE.

**Opțiuni.**

1. **Păstrezi** și adaugi un avertisment în interfață („model necomercial, CC-BY-NC”), în `NOTICE.md` și în README (în 8 limbi). Fixezi revizia pe un commit și verifici hash-ul, ca pentru celelalte descărcări.
2. **Înlocuiești** cu un model cu licență permisivă (de exemplu modelele Marian `opus-mt` ale Helsinki-NLP, în general CC-BY 4.0 sau Apache-2.0; verifică fișa fiecărui model). Pro: fără restricție de uz. Contra: un model per pereche de limbi, calitate diferită.
3. **Scoți** funcția de traducere automată.

**Recomandare.** 1 acum (cost mic, onest); evaluează 2 dacă vrei ca ATINGERE să poată fi reutilizat comercial de alții.

**Pași.** Citește fișa modelului pe Hugging Face și confirmă licența; fixează `revision` la un commit; adaugă hash-ul fișierelor în pagină; adaugă textul de avertisment în cele 8 limbi; actualizează `NOTICE.md`; patch de versiune și pipeline-ul obișnuit.

### 1.3 Fișiere NOTICE lipsă

**Opțiuni.** (a) Confirmi șabloanele create (recomandat); (b) alegi să nu ai NOTICE, ceea ce nu este recomandat: licențele MIT, BSD, Apache și OFL cer păstrarea notelor de copyright și a textelor de licență atunci când redistribui.

**Pași (per depozit).**

1. Deschide șablonul, verifică fiecare rând față de fișierele reale (versiune, licență, sumă SHA-256: `sha256sum vendor/*`).
2. Completează versiunile și adaugă textele de licență lângă fișiere (`vendor/<componentă>.LICENSE`) sau în `NOTICE.md`.
3. Șterge blocul „ȘABLON — de confirmat de autor”.
4. Pentru OmniHost: copiază `docs/notice-sabloane/OmniHost.NOTICE.md` în rădăcina depozitului ca `NOTICE.md`.
5. Pentru depozitele cu NOTICE existent (AI-Liber, LocalMind): verifică ca fiecare fișier din `vendor/` să aibă un rând.

### 1.4 Valea Plopului: drepturile desenului, persoane numite, pagină de erate/retractare

**Context (conform auditului din 22 octombrie).** Aplicația numește persoane reale, fără consimțământul lor, într-o reconstrucție a unor evenimente. Drepturile asupra desenului folosit nu sunt documentate în depozit.

**Opțiuni pentru desen.** (a) Confirmi în scris autorul și condițiile (licență sau acord) și adaugi creditul în aplicație și `NOTICE.md`; (b) înlocuiești cu o ilustrație proprie sau abstractă; (c) elimini desenul.

**Opțiuni pentru persoanele numite.**

1. **Anonimizezi** (inițiale, roluri sau nume schimbate).
2. **Marchezi vizibil** „RECONSTRUCȚIE SPECULATIVĂ” (bandă fixă sau filigran pe fiecare ecran și în export), cu o notă despre ce este documentat și ce este imaginat.
3. **Obții consimțământul** persoanelor sau al moștenitorilor.
4. **Retragi** aplicația până la clarificare.

**Pagina de erate/retractare.** Un fișier `erata.html` (sau secțiune în aplicație) care spune: ce s-a corectat sau retras, când, de ce, ce rămâne neverificat, cum se poate cere o corectură (un canal de contact ales de tine; nu pune date personale aici fără să vrei). Pagina trebuie să existe în cele 8 limbi, să fie legată din aplicație, din README și din cardul din hub, și să păstreze o listă datată a modificărilor (jurnal public).

**Recomandare.** (a) sau (c) pentru desen, imediat ce nu poți confirma drepturile; 1 + 2 pentru persoane; pagină de erate publicată în orice variantă (costă puțin și arată bună-credință).

**Pași.**

1. Identifică autorul desenului și scrie-i; păstrează răspunsul.
2. Hotărăște varianta pentru persoane și aplică-o în `src/` sau în fișierul HTML, cu texte noi în cele 8 limbi.
3. Scrie `erata.html` cu aceeași structură pentru toate limbile; leagă-o din subsol.
4. Patch de versiune, README-uri (8 limbi), pipeline kit, `node tools/sync-catalog.mjs` în hub.

---

## 2. Revizuire nativă maghiară și germană

**Context.** Traducerile în maghiară și germană din toate aplicațiile și din hub nu au fost revizuite de vorbitori nativi; testele automate verifică doar existența și structura cheilor (toate cele 110 aplicații declară cele 8 limbi), nu calitatea.

**Opțiuni.**

1. **Voluntari nativi** din comunitatea ta (cea mai ieftină, ritm incert).
2. **Traducători / revizori plătiți**, per aplicație sau per pachet de texte (predictibil, costă).
3. **Verificare automată de triaj** (retraducere, glosare, consecvența terminologiei), doar pentru a ordona prioritățile; nu înlocuiește un nativ.
4. **Etichetă onestă** pe hub și în aplicații: „traducere neverificată de un vorbitor nativ”, cu link pentru semnalarea greșelilor.
5. **Retragi limba** acolo unde textul este sensibil (medical, juridic) și neverificat.

**Recomandare.** 4 imediat (cost mic, onest), 3 pentru a găsi unde sunt problemele, apoi 1 sau 2 pe priorități: întâi textele sensibile (PULS, avertismente, termeni de licență), apoi hub-ul și aplicațiile cele mai folosite, la final restul.

**Pași.** Alege 1–2 aplicații pilot; exportă textele hu/de într-un fișier tabelar (cheie, ro, hu, de) din dicționarul aplicației; trimite revizorului; reintegrează; patch de versiune, README-uri, pipeline. Păstrează o listă „revizuit de, la data” în README.

---

## 3. Revizuire de specialist (medical, juridic, urgențe)

**Context.** Aplicații cu conținut cu miză: **PULS** (prim ajutor, fără validare clinică), **Reiki**, **Bioenergoterapie**, **Radiestezie**, **Inforenergetica**, **Afrodisiace-fara-frontiere**, **Decibel** (audiogramă orientativă, nu diagnostic), **SEVA**, **VATRA**, **ACORDAJ** (atlas spiritual, deja cu precizarea „fără validare științifică”). Conținutul nu a fost evaluat editorial în audituri.

**Opțiuni.**

1. **Revizuire de specialist** (medic / asistent de urgență sau instructor de prim ajutor pentru PULS, jurist pentru textele juridice), cu nume, dată și versiune revizuită în README.
2. **Avertismente și surse**: un bloc vizibil „nu înlocuiește un medic / un specialist”, numărul de urgență (112 în România), sursele (ghiduri recunoscute) și data ultimei verificări.
3. **Reduci afirmațiile**: scoți indicațiile prescriptive, păstrezi informarea generală.
4. **Retragi aplicația** sau o muți într-o categorie clar marcată „cultural / non-medical”.

**Recomandare.** 2 acum pentru toate; 1 pentru PULS înainte de orice altă promovare; 3 pentru Reiki, Bioenergoterapie, Radiestezie, Inforenergetica, Afrodisiace (formulări de tip „informativ / tradiție”, fără promisiuni terapeutice); 2 + calibrare documentată pentru Decibel.

**Pași.** Inventariază afirmațiile (listă pe aplicație); alege revizorul (medic de familie, medic de urgență, instructor de prim ajutor al unei organizații recunoscute); trimite textul în română (limba sursă); apoi aplică corecturile în cele 8 limbi; adaugă în README „Revizuit de … (funcția), data, versiunea”.

---

## 4. Fuziuni

### 4.1 Numerologie + NumeroLogIA

**Context.** **Numerologie** este un curs; **NumeroLogIA** este un calculator cu oracol AI. Publicul este comun, funcțiile se completează.

**Opțiuni.**

1. **Rămân separate**, cu legături încrucișate vizibile (zero risc).
2. **Fuziune într-o singură aplicație** cu module („Curs” și „Calculator”), kitul comun are deja mecanismul de module. Cere migrarea cheilor de stocare, un stub de redirecționare (cu service worker care se dezînregistrează) pe adresa dispărută, actualizarea cardurilor, domeniilor și testelor.
3. **O pagină-colecție** în hub (categorie) care le grupează, fără a le uni.

**Recomandare.** 1 acum. Fuziunea (2) doar dacă ai date că oamenii le folosesc împreună; costă cel mai mult în testare și în păstrarea datelor utilizatorilor.

**Pași pentru 1.** Adaugă un link reciproc în fiecare aplicație (text nou, 8 limbi); patch; pipeline. **Pași pentru 2.** Alege aplicația-țintă; exportă și importă datele vechi (cheile `localStorage` diferă); stub + SW de dezînregistrare; actualizează `index.html` din hub; `tools/sync-catalog.mjs`; `tools/cname-inventory.mjs`.

### 4.2 Aplicațiile de relaxare (ASMR, Aurora, BorderlessMelodies, CalmWaves)

**Context.** Patru aplicații cu scop apropiat (sunet, ambianță), dar fiecare cu motor audio și interfață proprii.

**Opțiuni.** (1) Rămân separate, cu legături încrucișate. (2) Fuziune într-o aplicație „Relaxare” cu patru module. (3) Motor audio comun, extras într-un modul al kitului, aplicații separate. (4) Pagină-categorie în hub.

**Recomandare.** 4 + 1 acum. Nu fuziona (2): pierzi identitatea și riști regresii sonore; (3) are sens doar dacă apar bug-uri comune.

**Pași.** Legături încrucișate (text în 8 limbi); verifică în `index.html` din hub că cele patru sunt în aceeași secțiune; reevaluează după o perioadă de utilizare.

---

## 5. Sursă proprie pentru indexul VNTV

**Context.** Catalogul oficial este pluginul WordPress `videoneat-index` al site-ului videoneat.com (`/wp-json/videoneat/v1/index`); fallback-ul este API-ul public WordPress. Dacă pluginul nu este instalat, VNTV depinde de fallback. În depozit există `docs/PROPOSAL-TROM.md` și `docs/TROM-ADMIN.md` pentru discuția cu administratorii.

**Opțiuni.**

1. **Ceri instalarea pluginului** oficial (după `PROPOSAL-TROM.md`). Pro: sursa autoritară. Contra: depinde de alții.
2. **Index static `index.json`** generat de un job periodic (GitHub Actions) care citește sursele publice și publică fișierul pe domeniul VNTV (`vntv.chiuta.ro`), cu schemă, număr de clipuri și sumă SHA-256. Aplicația îl citește de pe aceeași origine (nu schimbă CSP-ul). Pro: independent, verificabil. Contra: întârziere până la următoarea rulare.
3. **Păstrezi fallback-ul actual.** Pro: nimic de făcut. Contra: se strică dacă formatul public se schimbă.
4. **Combinat:** ordinea de citire pluginul oficial → index propriu → fallback public.

**Recomandare.** 4, începând cu 2: valorifică și testele existente; cere 1 în paralel.

**Pași (2).**

1. Scrie un script (`tools/build-index.mjs` în depozitul VNTV) care produce `index.json` cu aceeași schemă ca răspunsul pluginului și un câmp `generated`.
2. Un workflow GitHub Actions periodic (de exemplu la 6 ore) care rulează scriptul, validează schema și face commit doar dacă fișierul s-a schimbat.
3. În `src/`, adaugă `index.json` din aceeași origine în lanțul de surse și rulează `node build.mjs`.
4. Testele VNTV (mock) acoperă deja ordinea surselor; adaugă un caz pentru noua sursă.
5. Documentează în README (8 limbi) de unde vine catalogul.
