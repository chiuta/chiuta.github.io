# Pagini de prezentare (9 depozite Rust fără aplicație web)

Depozitele de mai jos nu sunt aplicații de sine stătătoare în browser: în hub apar doar ca carduri de proiect (cu link la README, fără „Deschide”). Fiecare are totuși o pagină de prezentare într-un singur fișier (`index.html`, CSP cu hash-uri, interfață în ro, en, fr, de, es, it, hu, pt, temă închisă/deschisă) și un `CNAME`.

Conținutul vine din README-urile existente; paginile Rust spun deschis că sunt pre-alpha. Titlurile sarcinilor rămân în engleză (sunt preluate din `docs/issues`). Traducerile interfeței paginilor sunt asistate de AI și nu au fost verificate de vorbitori nativi.

| Depozit | Tip | Subdomeniu |
|---|---|---|
| [ANTENA](https://github.com/chiuta/ANTENA) | Rust (pre-alpha) | https://antena.chiuta.ro |
| [ARBITRU](https://github.com/chiuta/ARBITRU) | Rust (pre-alpha) | https://arbitru.chiuta.ro |
| [ASTROLABIU](https://github.com/chiuta/ASTROLABIU) | Rust (pre-alpha) | https://astrolabiu.chiuta.ro |
| [ECOGRAMA](https://github.com/chiuta/ECOGRAMA) | Rust (pre-alpha) | https://ecograma.chiuta.ro |
| [EXIF-CURAT](https://github.com/chiuta/EXIF-CURAT) | Rust (pre-alpha) | https://exif-curat.chiuta.ro |
| [MARTOR](https://github.com/chiuta/MARTOR) | Rust (pre-alpha) | https://martor.chiuta.ro |
| [NEAMURI](https://github.com/chiuta/NEAMURI) | Rust (pre-alpha) | https://neamuri.chiuta.ro |
| [TACTIL](https://github.com/chiuta/TACTIL) | Rust (pre-alpha) | https://tactil.chiuta.ro |
| [ecou-spectral-rs](https://github.com/chiuta/ecou-spectral-rs) | Rust | https://ecou-spectral-rs.chiuta.ro |

## Aplicații alpha single-file HTML (9 depozite, cu card în hub)

Aceste depozite au început ca pagini de prezentare, dar sunt acum aplicații într-un singur fișier `index.html` (versiunea 0.2.0, alpha): construite cu `tools/alpha/build.mjs` (copiat ca `scripts/build.mjs` în fiecare depozit), cu CSP cu hash-uri, interfață în 8 limbi, instalabile (PWA) și utilizabile fără rețea după prima deschidere. Fiecare are card în hub, documentație în 8 limbi generată cu `tools/alpha/docs.mjs` și teste (`npm test`, plus testele din browser din `tests/alpha-apps.test.mjs` și `tests/proiector.test.mjs`).

| Depozit | Ce face | Aplicația |
|---|---|---|
| [atelier-verificare](https://github.com/chiuta/atelier-verificare) | verifică fotografii, clipuri, linkuri și domenii în browser: EXIF/GPS, Content Credentials citite, nivel de eroare, cadre-cheie | https://atelier-verificare.chiuta.ro |
| [balanta](https://github.com/chiuta/balanta) | compară modele de IA pe orbește: 92 de cerințe în română, engleză și maghiară, vot A/B și clasament cu intervale | https://balanta.chiuta.ro |
| [calendarium](https://github.com/chiuta/calendarium) | convertor între unsprezece calendare (gregorian, iulian, ebraic, hijri, persan, chinezesc, maya, marțian…) | https://calendarium.chiuta.ro |
| [glosar](https://github.com/chiuta/glosar) | dicționar offline pentru aromână, meglenoromână și romani, cu cuvinte adăugate cu sursă și înregistrare | https://glosar.chiuta.ro |
| [graiul](https://github.com/chiuta/graiul) | arhivă offline de folclor românesc (proverbe, descântece, ghicitori, colinde) cu sursă, județ și acord | https://graiul.chiuta.ro |
| [indicativ-international](https://github.com/chiuta/indicativ-international) | exersare pentru examenul de radioamator: repetare în cinci cutii, examene de probă, pachete de întrebări JSON | https://indicativ-international.chiuta.ro |
| [proiector-fara-frontiere](https://github.com/chiuta/proiector-fara-frontiere) | telefoanele din clasă ca ecran comun: cronometru, sondaj, quiz, bilețele, tablă | https://proiector-fara-frontiere.chiuta.ro |
| [regula](https://github.com/chiuta/regula) | cinci jocuri clasice pentru doi (Moara, Alquerque, Fanorona, Mū tōrere, Hnefatafl), cu calculatorul sau cu un prieten | https://regula.chiuta.ro |
| [vietar-packs](https://github.com/chiuta/vietar-packs) | pachete regionale de specii pentru VietAR: răsfoire, import, verificare și creare | https://vietar-packs.chiuta.ro |

Alpha înseamnă că nu au fost încă încercate pe dispozitive reale în afara testelor automate din Chromium; limitele fiecărei aplicații sunt în `README.md` (secțiunea „Limite”) și pe fișa din hub. Traducerile în franceză, italiană, spaniolă, portugheză, germană și maghiară sunt asistate de AI.

Pentru activare: Settings → Pages (ramura `main`, rădăcină) în fiecare depozit și o înregistrare DNS `CNAME <slug>` → `chiuta.github.io`.
