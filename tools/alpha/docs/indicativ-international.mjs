// Specificația documentației INDICATIV International (opt limbi). Folosită de tools/alpha/docs.mjs.
// Numele filelor și ale butoanelor din text vin din src/i18n.mjs (marcate §cheie§), ca documentația să spună exact ce scrie în pagină.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const L = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
const QU = {en: ['“', '”'], ro: ['«', '»'], fr: ['« ', ' »'], it: ['«', '»'], es: ['«', '»'], pt: ['«', '»'], de: ['„', '“'], hu: ['„', '”']};

// Textele fiecărei limbi. Marcajul §cheie§ devine numele din interfață, între ghilimelele limbii.
// Ghidurile din docs/ există în engleză (`.md`) și în română (`.ro.md`): celelalte limbi trimit la cele englezești.
const T = {
  en: {
    status: 'Alpha, usable: the single `index.html` is a trainer and exam simulator for amateur-radio licence questions. It practises with a five-box repetition schedule, runs timed practice exams with a pass mark and imports question packs in one shared JSON format. The built-in pack holds 50 original practice questions written for this project; it is not an official question bank, and no country pack is included yet. Everything stays in your browser, without accounts, tracking or network requests.',
    does: [
      '§tab_train§: choose a pack, a subject and which questions to practise (due and new, any question, or your weak spots); every answer is checked at once and explained, with its source. Right answers come back after 1, 3, 7, 14 and 30 days; wrong ones come back today and once more at the end of the session. Keys 1–6 or A–F choose an answer, Enter goes on.',
      '§tab_exam§: a timed test drawn at random from the pack, with a countdown, a question map, §x_flag§ and a pass mark; nothing is marked until you finish (or time runs out). The result shows the score by subject and the questions you got wrong; the same seed repeats an exam; an exam you started continues after a reload. The rules (questions, minutes, pass mark, penalty for wrong answers) come from the pack together with their source; without them the page uses practice defaults (20 questions, 30 minutes, 75 %).',
      '§tab_packs§: the built-in practice pack and the packs you import by pasting JSON or choosing a file (at most 8 at a time), each with its source, licence and exam rules; progress by subject; download a pack, reset its progress or remove it; back up your progress to a file and load it on another device. A pack with problems is listed line by line, and you can import only its valid questions.',
      'Format: formulas in questions written as `f_{o}` or `10^{-6}`; small drawings as restricted SVG with a text alternative; an optional syllabus with `syllabus_ref` on each question; one JSON file per pack in `data/packs/`, described by `schema.json` and `docs/pack-format.md`.',
      'Tools for contributors: `scripts/validate.py` checks the packs with the same rules as the page; `scripts/import_csv.mjs` turns a spreadsheet saved as CSV into a pack and names the line of every problem; `scripts/pack_report.mjs` summarises a pack to check it against the official bank. The interface is in eight languages and can be used with the keyboard and with a screen reader.'
    ],
    how: [
      '`schema.json` describes a pack; `scripts/validate.py` checks every file in `data/packs/` against it and against the rules a schema cannot express: the file is named after the pack id, ids and questions are unique within a pack, `syllabus_ref` exists in the syllabus, figures use only the allowed elements and the exam rules fit the pack.',
      '`src/engine.mjs` is the engine (no screen, no network): validation, the five-box schedule, the queues of questions, exams drawn from a seed, marking and the progress files. `scripts/validate.py` and `scripts/import_csv.mjs` apply the same rules; the tests compare the implementations on the same cases.',
      '`src/ui.js`, `src/i18n.mjs` and `src/app.css` are the interface; `scripts/build.mjs` builds the single `index.html` from `src/` and embeds the packs of `data/packs/` (all but `example.json`); `node scripts/build.mjs --check` fails when the page is out of date.',
      'The browser keeps three entries (imported packs, progress, an exam in progress); each is checked again when the page loads, so a damaged or hostile saved state is ignored, not trusted. Nothing is sent anywhere.',
      'Tests: `npm test` (engine, validator parity, CSV import, interface texts, data, documentation, build) and browser tests in the hub (eight languages, accessibility, hostile saved state, import, exam timing) Development needs Node.js 24 or newer and Python 3 with `jsonschema`; the page itself only needs a browser that knows ES2017.'
    ],
    steps: [
      '1. Fork this repository.',
      '2. Copy `data/packs/example.json` to `data/packs/<your-pack-id>.json` (the file name is the pack id) and fill it in, or turn a spreadsheet into a pack with `node scripts/import_csv.mjs` (see `docs/contributor-guide.md`).',
      '3. Run `python3 scripts/validate.py` and `npm test`, then `node scripts/build.mjs` so that the pack is in `index.html`.',
      '4. Open a pull request — data contributions need no coding.',
      '5. No coding needed: try the pack on the page first (tab §tab_packs§, button §i_go§), then send the file in an issue or a pull request; a maintainer adds it to `data/packs/`.'
    ],
    firstRule: 'One pack = one file, named after the pack id.',
    contribHeading: 'Adding a question pack',
    contrib: [
      '1. Choose the source first. A country pack must come from that country’s public question bank (or from another source you may legally share): write down the edition, the date and the web address. Do not copy from a book, a course or a website unless its licence allows it; if you cannot copy, write original questions and say so in `source`.',
      '2. Copy `data/packs/example.json` to `data/packs/<your-pack-id>.json`. The file name is the pack id: lower-case letters, digits and hyphens, for example `hu-ham-a`. Fill in the header: `country`, `licence_class`, `lang`, `source`, `source_url`, `license`, and the `exam` rules only when the official rules are published (with their source).',
      '3. Add the questions: by hand in the file, or from a spreadsheet saved as CSV with `node scripts/import_csv.mjs questions.csv --id <pack-id> --title … --country … --class … --lang … --source … --license …` (columns and options: `docs/contributor-guide.md`). Keep the official numbering in `id` and `source`.',
      '4. Check the pack against the official bank (`docs/verify-against-official-bank.md`): every question text, every answer and every correct answer; have a second person check a sample, and write in the pull request who checked what and how.',
      '5. Run `python3 scripts/validate.py`, then `node scripts/build.mjs` (it puts the pack into `index.html`) and `npm test`. You can also try the pack before you send it: open `index.html`, tab §tab_packs§, button §i_go§.',
      '6. Open a pull request or an issue and say which edition you used and on what terms you may share it. A pack without a stated source is not merged.'
    ],
    issues: [
      'Add a pack for Hungary from the public question bank (`scripts/import_csv.mjs`, official numbering in `id` and `source`, `source_url`, the exam rules with their source)',
      'Add a pack for Italy from the public question bank, with the same care (edition, source address, numbering, exam rules)',
      'Add a pack for Germany (class E or A) from the public question bank, with the same care',
      'Add a pack for your own country from its official question bank, in any language, and tell us what you checked',
      'Write a converter from the official file format of one country (PDF, spreadsheet or XML) to the CSV columns of `scripts/import_csv.mjs`',
      'Add the CEPT HAREC syllabus (Recommendation T/R 61-02) as the `syllabus` of a pack and link each question with `syllabus_ref`',
      'Have a radio amateur review the 50 built-in practice questions and report any wrong answer or unclear wording',
      'Redraw the circuit and antenna figures of a pack as restricted SVG, each with a `figure_alt` text alternative',
      'Test the exam simulator with a screen reader (NVDA, VoiceOver or Orca) and report what is hard to use',
      'Have a native speaker review the interface texts of your language in `src/i18n.mjs`'
    ],
    added: [
      'The engine in `src/engine.mjs`: validation of packs and figures, the five-box repetition schedule, queues of questions, exams drawn from a seed, marking and progress files.',
      'The page: tabs §tab_train§, §tab_exam§, §tab_packs§ and §tab_guide§ in eight languages; keyboard shortcuts, announcements for screen readers, an exam timer that survives a reload; import, download, reset and removal of packs; a backup of the progress.',
      'A built-in practice pack of 50 original questions (with explanations, formulas and two figures), written for this project with an AI assistant and checked by calculation; it is not an official question bank.',
      'The shared pack format: `schema.json`, the template `data/packs/example.json` and `docs/pack-format.md` (English and Romanian).',
      '`scripts/validate.py` applies the same rules as the page; the tests compare it with the engine on the same cases.',
      '`scripts/import_csv.mjs`: a spreadsheet saved as CSV becomes a pack, and every problem names its line in the file.',
      '`scripts/pack_report.mjs`: a summary of a pack (counts, missing official numbers, positions of the right answers, a text listing, a random sample) to check it against the official bank.',
      '`docs/contributor-guide.md` and `docs/verify-against-official-bank.md` (English and Romanian).',
      'Tests: `npm test` and browser tests in the hub.',
      '`src/` and `scripts/build.mjs`: the single `index.html` is now built from sources with the packs embedded, and `--check` verifies it.'
    ],
    changed: [
      'The workflow runs on Ubuntu 26.04 with Node.js 26 and also runs the tests, the build check and the validation.',
      'The data are now packs: `data/packs/example.json` replaces `data/questions/example.json`, and one pack is one file named after its id; `scripts/validate.py`, the README steps and the templates changed accordingly.',
      'The list of good first issues now holds the tasks that remain (country packs, syllabus, reviews); the trainer, the exam simulator, figures and the check of `correct` that it used to list now exist.'
    ]
  },
  ro: {
    status: 'Alfa, utilizabil: singurul `index.html` este un antrenor și un simulator de examen pentru întrebările de radioamator. Exersează cu o programare a repetărilor în cinci cutii, rulează examene de probă cu timp limită și prag de promovare și importă pachete de întrebări într-un format JSON comun. Pachetul încorporat are 50 de întrebări de exersare originale, scrise pentru acest proiect; nu este o bancă oficială de întrebări și nu este inclus încă niciun pachet de țară. Totul rămâne în browserul tău, fără conturi, urmărire sau cereri de rețea.',
    does: [
      '§tab_train§: alegi un pachet, o materie și ce întrebări vrei (scadente și noi, orice întrebare sau punctele tale slabe); fiecare răspuns este verificat pe loc și explicat, cu sursa lui. Răspunsurile corecte revin după 1, 3, 7, 14 și 30 de zile; cele greșite revin azi și încă o dată la sfârșitul sesiunii. Tastele 1–6 sau A–F aleg un răspuns, Enter merge mai departe.',
      '§tab_exam§: un test cu timp limită, tras la întâmplare din pachet, cu numărătoare inversă, hartă a întrebărilor, §x_flag§ și prag de promovare; nimic nu este notat până nu termini (sau până nu se scurge timpul). Rezultatul arată scorul pe materii și întrebările la care ai greșit; aceeași sămânță repetă un examen; un examen început continuă după o reîncărcare. Regulile (întrebări, minute, prag, penalizarea răspunsurilor greșite) vin din pachet împreună cu sursa lor; fără ele pagina folosește valori de exersare (20 de întrebări, 30 de minute, 75 %).',
      '§tab_packs§: pachetul încorporat și pachetele pe care le imporți lipind JSON sau alegând un fișier (cel mult 8 odată), fiecare cu sursa, licența și regulile de examen; progres pe materii; poți descărca un pachet, îi poți reseta progresul sau îl poți șterge; copie de siguranță a progresului într-un fișier, pe care o încarci pe alt dispozitiv. Un pachet cu probleme este listat rând cu rând și poți importa doar întrebările valide.',
      'Format: formule în întrebări scrise `f_{o}` sau `10^{-6}`; desene mici ca SVG restrâns, cu text alternativ; o programă opțională, cu `syllabus_ref` la fiecare întrebare; un fișier JSON pe pachet în `data/packs/`, descris de `schema.json` și de `docs/pack-format.ro.md`.',
      'Unelte pentru contribuitori: `scripts/validate.py` verifică pachetele cu aceleași reguli ca pagina; `scripts/import_csv.mjs` transformă un tabel salvat ca CSV într-un pachet și numește linia fiecărei probleme; `scripts/pack_report.mjs` rezumă un pachet ca să-l verifici față de banca oficială. Interfața este în opt limbi și poate fi folosită de la tastatură și cu un cititor de ecran.'
    ],
    how: [
      '`schema.json` descrie un pachet; `scripts/validate.py` verifică fiecare fișier din `data/packs/` după el și după regulile pe care o schemă nu le poate spune: fișierul poartă numele pachetului (`id`), identificatorii și întrebările sunt unice într-un pachet, `syllabus_ref` există în programă, desenele folosesc doar elementele permise, iar regulile de examen încap în pachet.',
      '`src/engine.mjs` este motorul (fără ecran, fără rețea): validarea, programarea în cinci cutii, cozile de întrebări, examenele trase dintr-o sămânță, notarea și fișierele de progres. `scripts/validate.py` și `scripts/import_csv.mjs` aplică aceleași reguli; testele compară implementările pe aceleași cazuri.',
      '`src/ui.js`, `src/i18n.mjs` și `src/app.css` sunt interfața; `scripts/build.mjs` construiește singurul `index.html` din `src/` și încorporează pachetele din `data/packs/` (toate în afară de `example.json`); `node scripts/build.mjs --check` eșuează dacă pagina nu este la zi.',
      'Browserul păstrează trei intrări (pachetele importate, progresul, un examen început); fiecare este verificată din nou la încărcarea paginii, așa că o stare salvată stricată sau ostilă este ignorată, nu crezută. Nimic nu este trimis nicăieri.',
      'Teste: `npm test` (motorul, paritatea validatorului, importul CSV, textele interfeței, datele, documentația, construcția) și teste în browser în hub (opt limbi, accesibilitate, stare salvată ostilă, import, cronometrarea examenului) Dezvoltarea cere Node.js 24 sau mai nou și Python 3 cu `jsonschema`; pagina în sine cere doar un browser care știe ES2017.'
    ],
    steps: [
      '1. Fă un fork al acestui depozit.',
      '2. Copiază `data/packs/example.json` în `data/packs/<id-ul-pachetului>.json` (numele fișierului este id-ul pachetului) și completează-l, sau transformă un tabel într-un pachet cu `node scripts/import_csv.mjs` (vezi `docs/contributor-guide.ro.md`).',
      '3. Rulează `python3 scripts/validate.py` și `npm test`, apoi `node scripts/build.mjs`, ca pachetul să intre în `index.html`.',
      '4. Deschide un pull request — contribuțiile cu date nu cer programare.',
      '5. Fără programare: încearcă întâi pachetul în pagină (fila §tab_packs§, butonul §i_go§), apoi trimite fișierul într-un issue sau un pull request; un responsabil îl adaugă în `data/packs/`.'
    ],
    firstRule: 'Un pachet = un fișier, numit după id-ul pachetului.',
    contribHeading: 'Adăugarea unui pachet de întrebări',
    contrib: [
      '1. Alege mai întâi sursa. Un pachet de țară trebuie să vină din banca publică de întrebări a acelei țări (sau dintr-o altă sursă pe care ai voie să o distribui): notează ediția, data și adresa web. Nu copia dintr-o carte, dintr-un curs sau de pe un site decât dacă licența o permite; dacă nu poți copia, scrie întrebări originale și spune asta în `source`.',
      '2. Copiază `data/packs/example.json` în `data/packs/<id-ul-pachetului>.json`. Numele fișierului este id-ul pachetului: litere mici, cifre și cratime, de exemplu `hu-ham-a`. Completează antetul: `country`, `licence_class`, `lang`, `source`, `source_url`, `license` și regulile `exam` doar dacă regulile oficiale sunt publicate (cu sursa lor).',
      '3. Adaugă întrebările: de mână în fișier sau dintr-un tabel salvat ca CSV, cu `node scripts/import_csv.mjs questions.csv --id <id-pachet> --title … --country … --class … --lang … --source … --license …` (coloane și opțiuni: `docs/contributor-guide.ro.md`). Păstrează numerotarea oficială în `id` și în `source`.',
      '4. Verifică pachetul față de banca oficială (`docs/verify-against-official-bank.ro.md`): textul fiecărei întrebări, fiecare răspuns și fiecare răspuns corect; cere unei a doua persoane să verifice un eșantion și scrie în pull request cine a verificat ce și cum.',
      '5. Rulează `python3 scripts/validate.py`, apoi `node scripts/build.mjs` (pune pachetul în `index.html`) și `npm test`. Poți încerca pachetul și înainte să-l trimiți: deschide `index.html`, fila §tab_packs§, butonul §i_go§.',
      '6. Deschide un pull request sau un issue și spune ce ediție ai folosit și în ce condiții ai voie să o distribui. Un pachet fără sursă declarată nu este preluat.'
    ],
    issues: [
      'Adaugă un pachet pentru Ungaria din banca publică de întrebări (`scripts/import_csv.mjs`, numerotarea oficială în `id` și `source`, `source_url`, regulile de examen cu sursa lor)',
      'Adaugă un pachet pentru Italia din banca publică de întrebări, cu aceeași grijă (ediție, adresa sursei, numerotare, reguli de examen)',
      'Adaugă un pachet pentru Germania (clasa E sau A) din banca publică de întrebări, cu aceeași grijă',
      'Adaugă un pachet pentru propria țară din banca ei oficială de întrebări, în orice limbă, și spune-ne ce ai verificat',
      'Scrie un convertor din formatul oficial de fișier al unei țări (PDF, tabel sau XML) în coloanele CSV ale `scripts/import_csv.mjs`',
      'Adaugă programa CEPT HAREC (Recomandarea T/R 61-02) ca `syllabus` al unui pachet și leagă fiecare întrebare cu `syllabus_ref`',
      'Cere unui radioamator să revizuiască cele 50 de întrebări de exersare încorporate și să raporteze orice răspuns greșit sau formulare neclară',
      'Redesenează figurile cu circuite și antene ale unui pachet ca SVG restrâns, fiecare cu un text alternativ în `figure_alt`',
      'Testează simulatorul de examen cu un cititor de ecran (NVDA, VoiceOver sau Orca) și raportează ce este greu de folosit',
      'Cere unui vorbitor nativ să revizuiască textele interfeței în limba lui din `src/i18n.mjs`'
    ],
    added: [
      'Motorul din `src/engine.mjs`: validarea pachetelor și a figurilor, programarea repetărilor în cinci cutii, cozile de întrebări, examenele trase dintr-o sămânță, notarea și fișierele de progres.',
      'Pagina: filele §tab_train§, §tab_exam§, §tab_packs§ și §tab_guide§ în opt limbi; scurtături de tastatură, anunțuri pentru cititoarele de ecran, un cronometru de examen care supraviețuiește unei reîncărcări; importul, descărcarea, resetarea și ștergerea pachetelor; o copie de siguranță a progresului.',
      'Un pachet încorporat de exersare cu 50 de întrebări originale (cu explicații, formule și două figuri), scris pentru acest proiect cu un asistent AI și verificat prin calcul; nu este o bancă oficială de întrebări.',
      'Formatul comun de pachet: `schema.json`, șablonul `data/packs/example.json` și `docs/pack-format.md` (în engleză și în română).',
      '`scripts/validate.py` aplică aceleași reguli ca pagina; testele îl compară cu motorul pe aceleași cazuri.',
      '`scripts/import_csv.mjs`: un tabel salvat ca CSV devine un pachet, iar fiecare problemă își numește linia din fișier.',
      '`scripts/pack_report.mjs`: un rezumat al unui pachet (numărători, numere oficiale lipsă, poziții ale răspunsurilor corecte, o listă de text, un eșantion aleatoriu) pentru verificarea lui față de banca oficială.',
      '`docs/contributor-guide.md` și `docs/verify-against-official-bank.md` (în engleză și în română).',
      'Teste: `npm test` și teste în browser în hub.',
      '`src/` și `scripts/build.mjs`: singurul `index.html` este acum construit din surse, cu pachetele încorporate, iar `--check` îl verifică.'
    ],
    changed: [
      'Fluxul de lucru rulează pe Ubuntu 26.04 cu Node.js 26 și rulează și testele, verificarea construcției și validarea.',
      'Datele sunt acum pachete: `data/packs/example.json` înlocuiește `data/questions/example.json`, iar un pachet este un fișier numit după id-ul lui; `scripts/validate.py`, pașii din README și șabloanele s-au schimbat în consecință.',
      'Lista sarcinilor pentru începători conține acum ce a rămas de făcut (pachete de țară, programă, revizuiri); antrenorul, simulatorul de examen, figurile și verificarea lui `correct`, pe care le enumera, există acum.'
    ]
  },
  fr: {
    status: 'Alpha, utilisable : l’unique `index.html` est un entraîneur et un simulateur d’examen pour les questions de radioamateur. Il s’exerce avec un calendrier de répétition en cinq boîtes, lance des examens blancs chronométrés avec un seuil de réussite et importe des paquets de questions dans un format JSON commun. Le paquet intégré contient 50 questions d’entraînement originales écrites pour ce projet ; ce n’est pas une banque de questions officielle, et aucun paquet de pays n’est encore inclus. Tout reste dans votre navigateur, sans compte, sans suivi ni requête réseau.',
    does: [
      '§tab_train§ : choisissez un paquet, un sujet et les questions à travailler (à revoir et nouvelles, n’importe quelle question ou vos points faibles) ; chaque réponse est vérifiée aussitôt et expliquée, avec sa source. Les bonnes réponses reviennent après 1, 3, 7, 14 et 30 jours ; les mauvaises reviennent aujourd’hui et encore une fois à la fin de la séance. Les touches 1–6 ou A–F choisissent une réponse, Entrée continue.',
      '§tab_exam§ : un test chronométré tiré au hasard dans le paquet, avec compte à rebours, carte des questions, §x_flag§ et seuil de réussite ; rien n’est noté avant que vous terminiez (ou que le temps s’écoule). Le résultat montre le score par sujet et les questions ratées ; la même graine répète un examen ; un examen commencé continue après un rechargement. Les règles (questions, minutes, seuil, pénalité des mauvaises réponses) viennent du paquet avec leur source ; sans elles la page utilise des valeurs d’entraînement (20 questions, 30 minutes, 75 %).',
      '§tab_packs§ : le paquet d’entraînement intégré et les paquets que vous importez en collant du JSON ou en choisissant un fichier (8 au plus à la fois), chacun avec sa source, sa licence et ses règles d’examen ; progression par sujet ; télécharger un paquet, réinitialiser sa progression ou le supprimer ; sauvegarder la progression dans un fichier et la charger sur un autre appareil. Un paquet avec des problèmes est listé ligne par ligne, et vous pouvez n’importer que ses questions valides.',
      'Format : formules dans les questions écrites `f_{o}` ou `10^{-6}` ; petits dessins en SVG restreint avec une alternative textuelle ; un programme facultatif avec `syllabus_ref` sur chaque question ; un fichier JSON par paquet dans `data/packs/`, décrit par `schema.json` et `docs/pack-format.md`.',
      'Outils pour les contributeurs : `scripts/validate.py` vérifie les paquets avec les mêmes règles que la page ; `scripts/import_csv.mjs` transforme un tableau enregistré en CSV en paquet et nomme la ligne de chaque problème ; `scripts/pack_report.mjs` résume un paquet pour le vérifier par rapport à la banque officielle. L’interface est en huit langues et s’utilise au clavier et avec un lecteur d’écran.'
    ],
    how: [
      '`schema.json` décrit un paquet ; `scripts/validate.py` vérifie chaque fichier de `data/packs/` d’après lui et d’après les règles qu’un schéma ne sait pas dire : le fichier porte le nom de l’identifiant du paquet, les identifiants et les questions sont uniques dans un paquet, `syllabus_ref` existe dans le programme, les figures n’utilisent que les éléments autorisés et les règles d’examen conviennent au paquet.',
      '`src/engine.mjs` est le moteur (sans écran, sans réseau) : validation, calendrier en cinq boîtes, files de questions, examens tirés d’une graine, notation et fichiers de progression. `scripts/validate.py` et `scripts/import_csv.mjs` appliquent les mêmes règles ; les tests comparent les implémentations sur les mêmes cas.',
      '`src/ui.js`, `src/i18n.mjs` et `src/app.css` forment l’interface ; `scripts/build.mjs` construit l’unique `index.html` à partir de `src/` et y intègre les paquets de `data/packs/` (tous sauf `example.json`) ; `node scripts/build.mjs --check` échoue quand la page n’est pas à jour.',
      'Le navigateur garde trois entrées (paquets importés, progression, examen en cours) ; chacune est revérifiée au chargement de la page, de sorte qu’un état enregistré abîmé ou hostile est ignoré, pas cru. Rien n’est envoyé nulle part.',
      'Tests : `npm test` (moteur, parité du validateur, import CSV, textes de l’interface, données, documentation, construction) et tests de navigateur dans le hub (huit langues, accessibilité, état enregistré hostile, import, chronométrage de l’examen) Le développement demande Node.js 24 ou plus récent et Python 3 avec `jsonschema` ; la page elle-même n’a besoin que d’un navigateur qui connaît ES2017.'
    ],
    steps: [
      '1. Faites un fork de ce dépôt.',
      '2. Copiez `data/packs/example.json` vers `data/packs/<id-de-votre-paquet>.json` (le nom du fichier est l’identifiant du paquet) et remplissez-le, ou transformez un tableau en paquet avec `node scripts/import_csv.mjs` (voir `docs/contributor-guide.md`).',
      '3. Lancez `python3 scripts/validate.py` et `npm test`, puis `node scripts/build.mjs` pour que le paquet soit dans `index.html`.',
      '4. Ouvrez une pull request — les contributions de données ne demandent pas de programmation.',
      '5. Sans programmer : essayez d’abord le paquet dans la page (onglet §tab_packs§, bouton §i_go§), puis envoyez le fichier dans une issue ou une pull request ; un mainteneur l’ajoute à `data/packs/`.'
    ],
    firstRule: 'Un paquet = un fichier, nommé d’après l’identifiant du paquet.',
    contribHeading: 'Ajouter un paquet de questions',
    contrib: [
      '1. Choisissez d’abord la source. Un paquet de pays doit provenir de la banque de questions publique de ce pays (ou d’une autre source que vous avez le droit de partager) : notez l’édition, la date et l’adresse web. Ne copiez pas d’un livre, d’un cours ou d’un site sauf si sa licence le permet ; si vous ne pouvez pas copier, écrivez des questions originales et dites-le dans `source`.',
      '2. Copiez `data/packs/example.json` vers `data/packs/<id-de-votre-paquet>.json`. Le nom du fichier est l’identifiant du paquet : lettres minuscules, chiffres et tirets, par exemple `hu-ham-a`. Remplissez l’en-tête : `country`, `licence_class`, `lang`, `source`, `source_url`, `license`, et les règles `exam` seulement si les règles officielles sont publiées (avec leur source).',
      '3. Ajoutez les questions : à la main dans le fichier, ou depuis un tableau enregistré en CSV avec `node scripts/import_csv.mjs questions.csv --id <id-paquet> --title … --country … --class … --lang … --source … --license …` (colonnes et options : `docs/contributor-guide.md`). Gardez la numérotation officielle dans `id` et `source`.',
      '4. Vérifiez le paquet par rapport à la banque officielle (`docs/verify-against-official-bank.md`) : le texte de chaque question, chaque réponse et chaque bonne réponse ; faites vérifier un échantillon par une seconde personne et écrivez dans la pull request qui a vérifié quoi et comment.',
      '5. Lancez `python3 scripts/validate.py`, puis `node scripts/build.mjs` (il met le paquet dans `index.html`) et `npm test`. Vous pouvez aussi essayer le paquet avant de l’envoyer : ouvrez `index.html`, onglet §tab_packs§, bouton §i_go§.',
      '6. Ouvrez une pull request ou une issue et indiquez quelle édition vous avez utilisée et à quelles conditions vous pouvez la partager. Un paquet sans source déclarée n’est pas fusionné.'
    ],
    issues: [
      'Ajouter un paquet pour la Hongrie à partir de la banque de questions publique (`scripts/import_csv.mjs`, numérotation officielle dans `id` et `source`, `source_url`, règles d’examen avec leur source)',
      'Ajouter un paquet pour l’Italie à partir de la banque de questions publique, avec le même soin (édition, adresse de la source, numérotation, règles d’examen)',
      'Ajouter un paquet pour l’Allemagne (classe E ou A) à partir de la banque de questions publique, avec le même soin',
      'Ajouter un paquet pour votre propre pays à partir de sa banque de questions officielle, dans n’importe quelle langue, et dire ce que vous avez vérifié',
      'Écrire un convertisseur du format de fichier officiel d’un pays (PDF, tableau ou XML) vers les colonnes CSV de `scripts/import_csv.mjs`',
      'Ajouter le programme CEPT HAREC (Recommandation T/R 61-02) comme `syllabus` d’un paquet et relier chaque question avec `syllabus_ref`',
      'Faire relire par un radioamateur les 50 questions d’entraînement intégrées et signaler toute réponse fausse ou formulation peu claire',
      'Redessiner les figures de circuits et d’antennes d’un paquet en SVG restreint, chacune avec une alternative textuelle dans `figure_alt`',
      'Tester le simulateur d’examen avec un lecteur d’écran (NVDA, VoiceOver ou Orca) et signaler ce qui est difficile à utiliser',
      'Faire relire par un locuteur natif les textes de l’interface de sa langue dans `src/i18n.mjs`'
    ],
    added: [
      'Le moteur de `src/engine.mjs` : validation des paquets et des figures, calendrier de répétition en cinq boîtes, files de questions, examens tirés d’une graine, notation et fichiers de progression.',
      'La page : onglets §tab_train§, §tab_exam§, §tab_packs§ et §tab_guide§ en huit langues ; raccourcis clavier, annonces pour les lecteurs d’écran, un chronomètre d’examen qui survit à un rechargement ; import, téléchargement, réinitialisation et suppression des paquets ; une sauvegarde de la progression.',
      'Un paquet d’entraînement intégré de 50 questions originales (avec explications, formules et deux figures), écrit pour ce projet avec un assistant IA et vérifié par le calcul ; ce n’est pas une banque de questions officielle.',
      'Le format de paquet commun : `schema.json`, le modèle `data/packs/example.json` et `docs/pack-format.md` (en anglais et en roumain).',
      '`scripts/validate.py` applique les mêmes règles que la page ; les tests le comparent au moteur sur les mêmes cas.',
      '`scripts/import_csv.mjs` : un tableau enregistré en CSV devient un paquet, et chaque problème nomme sa ligne dans le fichier.',
      '`scripts/pack_report.mjs` : un résumé d’un paquet (comptes, numéros officiels manquants, positions des bonnes réponses, une liste de texte, un échantillon aléatoire) pour le vérifier par rapport à la banque officielle.',
      '`docs/contributor-guide.md` et `docs/verify-against-official-bank.md` (en anglais et en roumain).',
      'Tests : `npm test` et tests de navigateur dans le hub.',
      '`src/` et `scripts/build.mjs` : l’unique `index.html` est désormais construit à partir des sources, avec les paquets intégrés, et `--check` le vérifie.'
    ],
    changed: [
      'Le workflow s’exécute sur Ubuntu 26.04 avec Node.js 26 et lance aussi les tests, la vérification de la construction et la validation.',
      'Les données sont désormais des paquets : `data/packs/example.json` remplace `data/questions/example.json`, et un paquet est un fichier nommé d’après son identifiant ; `scripts/validate.py`, les étapes du README et les modèles ont changé en conséquence.',
      'La liste des tâches pour débutants contient maintenant ce qui reste à faire (paquets de pays, programme, relectures) ; l’entraîneur, le simulateur d’examen, les figures et la vérification de `correct` qu’elle énumérait existent maintenant.'
    ]
  },
  it: {
    status: 'Alfa, utilizzabile: l’unico `index.html` è un allenatore e un simulatore d’esame per le domande di radioamatore. Si esercita con una pianificazione delle ripetizioni in cinque scatole, esegue esami di prova a tempo con una soglia di superamento e importa pacchetti di domande in un unico formato JSON. Il pacchetto integrato contiene 50 domande di esercizio originali scritte per questo progetto; non è una banca dati ufficiale di domande e non è ancora incluso nessun pacchetto nazionale. Tutto resta nel tuo browser, senza account, tracciamento o richieste di rete.',
    does: [
      '§tab_train§: scegli un pacchetto, un argomento e quali domande esercitare (da ripassare e nuove, qualsiasi domanda o i tuoi punti deboli); ogni risposta è controllata subito e spiegata, con la sua fonte. Le risposte giuste tornano dopo 1, 3, 7, 14 e 30 giorni; quelle sbagliate tornano oggi e ancora una volta alla fine della sessione. I tasti 1–6 o A–F scelgono una risposta, Invio prosegue.',
      '§tab_exam§: una prova a tempo estratta a caso dal pacchetto, con conto alla rovescia, mappa delle domande, §x_flag§ e soglia di superamento; nulla viene valutato finché non termini (o il tempo scade). Il risultato mostra il punteggio per argomento e le domande sbagliate; lo stesso seme ripete un esame; un esame iniziato continua dopo un ricaricamento. Le regole (domande, minuti, soglia, penalità per le risposte sbagliate) vengono dal pacchetto insieme alla loro fonte; senza di esse la pagina usa valori di esercizio (20 domande, 30 minuti, 75 %).',
      '§tab_packs§: il pacchetto di esercizio integrato e i pacchetti che importi incollando JSON o scegliendo un file (al massimo 8 alla volta), ciascuno con fonte, licenza e regole d’esame; progressi per argomento; puoi scaricare un pacchetto, azzerarne i progressi o rimuoverlo; copia di sicurezza dei progressi in un file, da caricare su un altro dispositivo. Un pacchetto con problemi è elencato riga per riga e puoi importare solo le domande valide.',
      'Formato: formule nelle domande scritte `f_{o}` o `10^{-6}`; piccoli disegni come SVG ristretto con un’alternativa testuale; un programma facoltativo con `syllabus_ref` su ogni domanda; un file JSON per pacchetto in `data/packs/`, descritto da `schema.json` e da `docs/pack-format.md`.',
      'Strumenti per chi contribuisce: `scripts/validate.py` controlla i pacchetti con le stesse regole della pagina; `scripts/import_csv.mjs` trasforma una tabella salvata come CSV in un pacchetto e indica la riga di ogni problema; `scripts/pack_report.mjs` riassume un pacchetto per controllarlo rispetto alla banca dati ufficiale. L’interfaccia è in otto lingue e si usa con la tastiera e con uno screen reader.'
    ],
    how: [
      '`schema.json` descrive un pacchetto; `scripts/validate.py` controlla ogni file di `data/packs/` secondo lo schema e secondo le regole che uno schema non sa esprimere: il file porta il nome dell’id del pacchetto, gli id e le domande sono unici in un pacchetto, `syllabus_ref` esiste nel programma, le figure usano solo gli elementi consentiti e le regole d’esame si adattano al pacchetto.',
      '`src/engine.mjs` è il motore (senza schermo, senza rete): validazione, pianificazione in cinque scatole, code di domande, esami estratti da un seme, valutazione e file dei progressi. `scripts/validate.py` e `scripts/import_csv.mjs` applicano le stesse regole; i test confrontano le implementazioni sugli stessi casi.',
      '`src/ui.js`, `src/i18n.mjs` e `src/app.css` sono l’interfaccia; `scripts/build.mjs` costruisce l’unico `index.html` da `src/` e vi incorpora i pacchetti di `data/packs/` (tutti tranne `example.json`); `node scripts/build.mjs --check` fallisce se la pagina non è aggiornata.',
      'Il browser conserva tre voci (pacchetti importati, progressi, un esame in corso); ciascuna viene ricontrollata al caricamento della pagina, così uno stato salvato danneggiato o ostile viene ignorato, non creduto. Nulla viene inviato da nessuna parte.',
      'Test: `npm test` (motore, parità del validatore, importazione CSV, testi dell’interfaccia, dati, documentazione, build) e test nel browser nell’hub (otto lingue, accessibilità, stato salvato ostile, importazione, tempi dell’esame) Lo sviluppo richiede Node.js 24 o più recente e Python 3 con `jsonschema`; la pagina in sé richiede solo un browser che conosca ES2017.'
    ],
    steps: [
      '1. Fai un fork di questo repository.',
      '2. Copia `data/packs/example.json` in `data/packs/<id-del-tuo-pacchetto>.json` (il nome del file è l’id del pacchetto) e compilalo, oppure trasforma una tabella in un pacchetto con `node scripts/import_csv.mjs` (vedi `docs/contributor-guide.md`).',
      '3. Esegui `python3 scripts/validate.py` e `npm test`, poi `node scripts/build.mjs` perché il pacchetto entri in `index.html`.',
      '4. Apri una pull request — i contributi di dati non richiedono programmazione.',
      '5. Senza programmare: prova prima il pacchetto nella pagina (scheda §tab_packs§, pulsante §i_go§), poi invia il file in una issue o in una pull request; un maintainer lo aggiunge a `data/packs/`.'
    ],
    firstRule: 'Un pacchetto = un file, con il nome dell’id del pacchetto.',
    contribHeading: 'Aggiungere un pacchetto di domande',
    contrib: [
      '1. Scegli prima la fonte. Un pacchetto nazionale deve venire dalla banca dati pubblica di domande di quel paese (o da un’altra fonte che puoi legalmente condividere): annota l’edizione, la data e l’indirizzo web. Non copiare da un libro, da un corso o da un sito se la sua licenza non lo permette; se non puoi copiare, scrivi domande originali e dillo in `source`.',
      '2. Copia `data/packs/example.json` in `data/packs/<id-del-tuo-pacchetto>.json`. Il nome del file è l’id del pacchetto: lettere minuscole, cifre e trattini, per esempio `hu-ham-a`. Compila l’intestazione: `country`, `licence_class`, `lang`, `source`, `source_url`, `license`, e le regole `exam` solo se le regole ufficiali sono pubblicate (con la loro fonte).',
      '3. Aggiungi le domande: a mano nel file, oppure da una tabella salvata come CSV con `node scripts/import_csv.mjs questions.csv --id <id-pacchetto> --title … --country … --class … --lang … --source … --license …` (colonne e opzioni: `docs/contributor-guide.md`). Mantieni la numerazione ufficiale in `id` e `source`.',
      '4. Controlla il pacchetto rispetto alla banca dati ufficiale (`docs/verify-against-official-bank.md`): il testo di ogni domanda, ogni risposta e ogni risposta giusta; fai controllare un campione a una seconda persona e scrivi nella pull request chi ha controllato cosa e come.',
      '5. Esegui `python3 scripts/validate.py`, poi `node scripts/build.mjs` (mette il pacchetto in `index.html`) e `npm test`. Puoi anche provare il pacchetto prima di inviarlo: apri `index.html`, scheda §tab_packs§, pulsante §i_go§.',
      '6. Apri una pull request o una issue e indica quale edizione hai usato e a quali condizioni puoi condividerla. Un pacchetto senza fonte dichiarata non viene integrato.'
    ],
    issues: [
      'Aggiungi un pacchetto per l’Ungheria dalla banca dati pubblica di domande (`scripts/import_csv.mjs`, numerazione ufficiale in `id` e `source`, `source_url`, regole d’esame con la loro fonte)',
      'Aggiungi un pacchetto per l’Italia dalla banca dati pubblica di domande, con la stessa cura (edizione, indirizzo della fonte, numerazione, regole d’esame)',
      'Aggiungi un pacchetto per la Germania (classe E o A) dalla banca dati pubblica di domande, con la stessa cura',
      'Aggiungi un pacchetto per il tuo paese dalla sua banca dati ufficiale di domande, in qualsiasi lingua, e dicci che cosa hai controllato',
      'Scrivi un convertitore dal formato di file ufficiale di un paese (PDF, tabella o XML) alle colonne CSV di `scripts/import_csv.mjs`',
      'Aggiungi il programma CEPT HAREC (Raccomandazione T/R 61-02) come `syllabus` di un pacchetto e collega ogni domanda con `syllabus_ref`',
      'Fai rivedere da un radioamatore le 50 domande di esercizio integrate e segnala ogni risposta sbagliata o formulazione poco chiara',
      'Ridisegna le figure di circuiti e antenne di un pacchetto come SVG ristretto, ciascuna con un’alternativa testuale in `figure_alt`',
      'Prova il simulatore d’esame con uno screen reader (NVDA, VoiceOver o Orca) e segnala che cosa è difficile da usare',
      'Fai rivedere da una persona madrelingua i testi dell’interfaccia della tua lingua in `src/i18n.mjs`'
    ],
    added: [
      'Il motore in `src/engine.mjs`: validazione di pacchetti e figure, pianificazione delle ripetizioni in cinque scatole, code di domande, esami estratti da un seme, valutazione e file dei progressi.',
      'La pagina: schede §tab_train§, §tab_exam§, §tab_packs§ e §tab_guide§ in otto lingue; scorciatoie da tastiera, annunci per gli screen reader, un cronometro d’esame che sopravvive a un ricaricamento; importazione, download, azzeramento e rimozione dei pacchetti; una copia di sicurezza dei progressi.',
      'Un pacchetto di esercizio integrato di 50 domande originali (con spiegazioni, formule e due figure), scritto per questo progetto con un assistente AI e controllato con il calcolo; non è una banca dati ufficiale di domande.',
      'Il formato comune dei pacchetti: `schema.json`, il modello `data/packs/example.json` e `docs/pack-format.md` (in inglese e in rumeno).',
      '`scripts/validate.py` applica le stesse regole della pagina; i test lo confrontano con il motore sugli stessi casi.',
      '`scripts/import_csv.mjs`: una tabella salvata come CSV diventa un pacchetto, e ogni problema indica la sua riga nel file.',
      '`scripts/pack_report.mjs`: un riepilogo di un pacchetto (conteggi, numeri ufficiali mancanti, posizioni delle risposte giuste, un elenco di testo, un campione casuale) per controllarlo rispetto alla banca dati ufficiale.',
      '`docs/contributor-guide.md` e `docs/verify-against-official-bank.md` (in inglese e in rumeno).',
      'Test: `npm test` e test nel browser nell’hub.',
      '`src/` e `scripts/build.mjs`: l’unico `index.html` è ora costruito dai sorgenti, con i pacchetti incorporati, e `--check` lo verifica.'
    ],
    changed: [
      'Il workflow gira su Ubuntu 26.04 con Node.js 26 ed esegue anche i test, il controllo della build e la convalida.',
      'I dati sono ora pacchetti: `data/packs/example.json` sostituisce `data/questions/example.json`, e un pacchetto è un file che porta il nome del suo id; `scripts/validate.py`, i passi del README e i modelli sono cambiati di conseguenza.',
      'L’elenco dei good first issue contiene ora ciò che resta da fare (pacchetti nazionali, programma, revisioni); l’allenatore, il simulatore d’esame, le figure e il controllo di `correct` che elencava ora esistono.'
    ]
  },
  es: {
    status: 'Alfa, utilizable: el único `index.html` es un entrenador y simulador de examen para las preguntas de radioaficionado. Practica con un calendario de repaso en cinco cajas, realiza exámenes de prueba cronometrados con una nota de corte e importa paquetes de preguntas en un formato JSON común. El paquete integrado contiene 50 preguntas de práctica originales escritas para este proyecto; no es un banco de preguntas oficial y todavía no se incluye ningún paquete de país. Todo se queda en tu navegador, sin cuentas, seguimiento ni peticiones de red.',
    does: [
      '§tab_train§: elige un paquete, un tema y qué preguntas practicar (pendientes y nuevas, cualquier pregunta o tus puntos débiles); cada respuesta se comprueba al instante y se explica, con su fuente. Las respuestas correctas vuelven al cabo de 1, 3, 7, 14 y 30 días; las incorrectas vuelven hoy y una vez más al final de la sesión. Las teclas 1–6 o A–F eligen una respuesta, Intro continúa.',
      '§tab_exam§: una prueba cronometrada sacada al azar del paquete, con cuenta atrás, mapa de preguntas, §x_flag§ y nota de corte; nada se califica hasta que termines (o se acabe el tiempo). El resultado muestra la puntuación por tema y las preguntas falladas; la misma semilla repite un examen; un examen empezado continúa tras recargar. Las reglas (preguntas, minutos, nota de corte, penalización de las respuestas incorrectas) vienen del paquete junto con su fuente; sin ellas la página usa valores de práctica (20 preguntas, 30 minutos, 75 %).',
      '§tab_packs§: el paquete de práctica integrado y los paquetes que importes pegando JSON o eligiendo un archivo (como máximo 8 a la vez), cada uno con su fuente, licencia y reglas de examen; progreso por tema; puedes descargar un paquete, reiniciar su progreso o quitarlo; copia de seguridad del progreso en un archivo, que cargas en otro dispositivo. Un paquete con problemas se lista línea por línea y puedes importar solo sus preguntas válidas.',
      'Formato: fórmulas en las preguntas escritas `f_{o}` o `10^{-6}`; dibujos pequeños como SVG restringido con una alternativa de texto; un programa opcional con `syllabus_ref` en cada pregunta; un archivo JSON por paquete en `data/packs/`, descrito por `schema.json` y `docs/pack-format.md`.',
      'Herramientas para quien contribuye: `scripts/validate.py` comprueba los paquetes con las mismas reglas que la página; `scripts/import_csv.mjs` convierte una tabla guardada como CSV en un paquete y nombra la línea de cada problema; `scripts/pack_report.mjs` resume un paquete para comprobarlo con el banco oficial. La interfaz está en ocho idiomas y se puede usar con el teclado y con un lector de pantalla.'
    ],
    how: [
      '`schema.json` describe un paquete; `scripts/validate.py` comprueba cada archivo de `data/packs/` con él y con las reglas que un esquema no sabe expresar: el archivo se llama como el id del paquete, los id y las preguntas son únicos dentro de un paquete, `syllabus_ref` existe en el programa, las figuras usan solo los elementos permitidos y las reglas de examen caben en el paquete.',
      '`src/engine.mjs` es el motor (sin pantalla, sin red): validación, calendario en cinco cajas, colas de preguntas, exámenes sacados de una semilla, calificación y archivos de progreso. `scripts/validate.py` y `scripts/import_csv.mjs` aplican las mismas reglas; las pruebas comparan las implementaciones con los mismos casos.',
      '`src/ui.js`, `src/i18n.mjs` y `src/app.css` son la interfaz; `scripts/build.mjs` construye el único `index.html` desde `src/` e incorpora los paquetes de `data/packs/` (todos menos `example.json`); `node scripts/build.mjs --check` falla cuando la página no está al día.',
      'El navegador guarda tres entradas (paquetes importados, progreso, un examen en curso); cada una se vuelve a comprobar al cargar la página, de modo que un estado guardado dañado u hostil se ignora, no se cree. No se envía nada a ninguna parte.',
      'Pruebas: `npm test` (motor, paridad del validador, importación CSV, textos de la interfaz, datos, documentación, compilación) y pruebas de navegador en el hub (ocho idiomas, accesibilidad, estado guardado hostil, importación, cronometraje del examen) El desarrollo necesita Node.js 24 o posterior y Python 3 con `jsonschema`; la página en sí solo necesita un navegador que conozca ES2017.'
    ],
    steps: [
      '1. Haz un fork de este repositorio.',
      '2. Copia `data/packs/example.json` en `data/packs/<id-de-tu-paquete>.json` (el nombre del archivo es el id del paquete) y rellénalo, o convierte una tabla en un paquete con `node scripts/import_csv.mjs` (consulta `docs/contributor-guide.md`).',
      '3. Ejecuta `python3 scripts/validate.py` y `npm test`, y después `node scripts/build.mjs` para que el paquete esté en `index.html`.',
      '4. Abre un pull request — las contribuciones de datos no requieren programar.',
      '5. Sin programar: prueba primero el paquete en la página (pestaña §tab_packs§, botón §i_go§) y envía después el archivo en una issue o un pull request; un responsable lo añade a `data/packs/`.'
    ],
    firstRule: 'Un paquete = un archivo, con el nombre del id del paquete.',
    contribHeading: 'Añadir un paquete de preguntas',
    contrib: [
      '1. Elige primero la fuente. Un paquete de país debe venir del banco público de preguntas de ese país (o de otra fuente que puedas compartir legalmente): anota la edición, la fecha y la dirección web. No copies de un libro, un curso o un sitio web si su licencia no lo permite; si no puedes copiar, escribe preguntas originales y dilo en `source`.',
      '2. Copia `data/packs/example.json` en `data/packs/<id-de-tu-paquete>.json`. El nombre del archivo es el id del paquete: letras minúsculas, cifras y guiones, por ejemplo `hu-ham-a`. Rellena la cabecera: `country`, `licence_class`, `lang`, `source`, `source_url`, `license`, y las reglas `exam` solo si las reglas oficiales están publicadas (con su fuente).',
      '3. Añade las preguntas: a mano en el archivo, o desde una tabla guardada como CSV con `node scripts/import_csv.mjs questions.csv --id <id-paquete> --title … --country … --class … --lang … --source … --license …` (columnas y opciones: `docs/contributor-guide.md`). Conserva la numeración oficial en `id` y `source`.',
      '4. Comprueba el paquete con el banco oficial (`docs/verify-against-official-bank.md`): el texto de cada pregunta, cada respuesta y cada respuesta correcta; pide a una segunda persona que revise una muestra y escribe en el pull request quién comprobó qué y cómo.',
      '5. Ejecuta `python3 scripts/validate.py`, después `node scripts/build.mjs` (pone el paquete en `index.html`) y `npm test`. También puedes probar el paquete antes de enviarlo: abre `index.html`, pestaña §tab_packs§, botón §i_go§.',
      '6. Abre un pull request o una issue e indica qué edición has usado y en qué condiciones puedes compartirla. Un paquete sin fuente declarada no se acepta.'
    ],
    issues: [
      'Añadir un paquete para Hungría desde el banco público de preguntas (`scripts/import_csv.mjs`, numeración oficial en `id` y `source`, `source_url`, reglas de examen con su fuente)',
      'Añadir un paquete para Italia desde el banco público de preguntas, con el mismo cuidado (edición, dirección de la fuente, numeración, reglas de examen)',
      'Añadir un paquete para Alemania (clase E o A) desde el banco público de preguntas, con el mismo cuidado',
      'Añadir un paquete para tu propio país desde su banco oficial de preguntas, en cualquier idioma, y contarnos qué has comprobado',
      'Escribir un conversor del formato de archivo oficial de un país (PDF, tabla o XML) a las columnas CSV de `scripts/import_csv.mjs`',
      'Añadir el programa CEPT HAREC (Recomendación T/R 61-02) como `syllabus` de un paquete y vincular cada pregunta con `syllabus_ref`',
      'Pedir a un radioaficionado que revise las 50 preguntas de práctica integradas y que señale cualquier respuesta incorrecta o redacción poco clara',
      'Redibujar las figuras de circuitos y antenas de un paquete como SVG restringido, cada una con una alternativa de texto en `figure_alt`',
      'Probar el simulador de examen con un lector de pantalla (NVDA, VoiceOver u Orca) y señalar qué resulta difícil de usar',
      'Pedir a un hablante nativo que revise los textos de la interfaz de su idioma en `src/i18n.mjs`'
    ],
    added: [
      'El motor de `src/engine.mjs`: validación de paquetes y figuras, calendario de repaso en cinco cajas, colas de preguntas, exámenes sacados de una semilla, calificación y archivos de progreso.',
      'La página: pestañas §tab_train§, §tab_exam§, §tab_packs§ y §tab_guide§ en ocho idiomas; atajos de teclado, avisos para lectores de pantalla, un cronómetro de examen que sobrevive a una recarga; importación, descarga, reinicio y eliminación de paquetes; una copia de seguridad del progreso.',
      'Un paquete de práctica integrado de 50 preguntas originales (con explicaciones, fórmulas y dos figuras), escrito para este proyecto con un asistente de IA y comprobado mediante cálculo; no es un banco de preguntas oficial.',
      'El formato común de paquete: `schema.json`, la plantilla `data/packs/example.json` y `docs/pack-format.md` (en inglés y en rumano).',
      '`scripts/validate.py` aplica las mismas reglas que la página; las pruebas lo comparan con el motor con los mismos casos.',
      '`scripts/import_csv.mjs`: una tabla guardada como CSV se convierte en un paquete, y cada problema nombra su línea en el archivo.',
      '`scripts/pack_report.mjs`: un resumen de un paquete (recuentos, números oficiales que faltan, posiciones de las respuestas correctas, un listado de texto, una muestra aleatoria) para comprobarlo con el banco oficial.',
      '`docs/contributor-guide.md` y `docs/verify-against-official-bank.md` (en inglés y en rumano).',
      'Pruebas: `npm test` y pruebas de navegador en el hub.',
      '`src/` y `scripts/build.mjs`: el único `index.html` se construye ahora desde las fuentes, con los paquetes incorporados, y `--check` lo verifica.'
    ],
    changed: [
      'El workflow se ejecuta en Ubuntu 26.04 con Node.js 26 y ejecuta también las pruebas, la comprobación de la compilación y la validación.',
      'Los datos son ahora paquetes: `data/packs/example.json` sustituye a `data/questions/example.json`, y un paquete es un archivo que se llama como su id; `scripts/validate.py`, los pasos del README y las plantillas cambiaron en consecuencia.',
      'La lista de good first issues contiene ahora lo que queda por hacer (paquetes de país, programa, revisiones); el entrenador, el simulador de examen, las figuras y la comprobación de `correct` que enumeraba ya existen.'
    ]
  },
  pt: {
    status: 'Alfa, utilizável: o único `index.html` é um treinador e simulador de exame para as perguntas de radioamador. Pratica com um calendário de revisão em cinco caixas, faz exames de treino cronometrados com uma nota mínima e importa pacotes de perguntas num formato JSON comum. O pacote incluído tem 50 perguntas de treino originais, escritas para este projeto; não é um banco de perguntas oficial e ainda não está incluído nenhum pacote de país. Tudo fica no seu navegador, sem contas, rastreio ou pedidos de rede.',
    does: [
      '§tab_train§: escolha um pacote, um assunto e as perguntas a treinar (por rever e novas, qualquer pergunta ou os seus pontos fracos); cada resposta é verificada de imediato e explicada, com a sua fonte. As respostas certas voltam passados 1, 3, 7, 14 e 30 dias; as erradas voltam hoje e mais uma vez no fim da sessão. As teclas 1–6 ou A–F escolhem uma resposta, Enter avança.',
      '§tab_exam§: um teste cronometrado, sorteado do pacote, com contagem decrescente, mapa de perguntas, §x_flag§ e nota mínima; nada é classificado até terminar (ou o tempo acabar). O resultado mostra a pontuação por assunto e as perguntas erradas; a mesma semente repete um exame; um exame começado continua depois de recarregar. As regras (perguntas, minutos, nota mínima, penalização das respostas erradas) vêm do pacote com a sua fonte; sem elas a página usa valores de treino (20 perguntas, 30 minutos, 75 %).',
      '§tab_packs§: o pacote de treino incluído e os pacotes que importa colando JSON ou escolhendo um ficheiro (no máximo 8 de cada vez), cada um com a sua fonte, licença e regras de exame; progresso por assunto; pode descarregar um pacote, repor o seu progresso ou removê-lo; cópia de segurança do progresso num ficheiro, que carrega noutro dispositivo. Um pacote com problemas é listado linha a linha e pode importar apenas as perguntas válidas.',
      'Formato: fórmulas nas perguntas escritas `f_{o}` ou `10^{-6}`; pequenos desenhos em SVG restrito com alternativa em texto; um programa opcional com `syllabus_ref` em cada pergunta; um ficheiro JSON por pacote em `data/packs/`, descrito por `schema.json` e `docs/pack-format.md`.',
      'Ferramentas para quem contribui: `scripts/validate.py` verifica os pacotes com as mesmas regras da página; `scripts/import_csv.mjs` transforma uma tabela guardada como CSV num pacote e indica a linha de cada problema; `scripts/pack_report.mjs` resume um pacote para o verificar face ao banco oficial. A interface está em oito línguas e usa-se com o teclado e com um leitor de ecrã.'
    ],
    how: [
      '`schema.json` descreve um pacote; `scripts/validate.py` verifica cada ficheiro de `data/packs/` por ele e pelas regras que um esquema não sabe exprimir: o ficheiro tem o nome do id do pacote, os id e as perguntas são únicos num pacote, `syllabus_ref` existe no programa, as figuras usam apenas os elementos permitidos e as regras de exame cabem no pacote.',
      '`src/engine.mjs` é o motor (sem ecrã, sem rede): validação, calendário em cinco caixas, filas de perguntas, exames sorteados a partir de uma semente, classificação e ficheiros de progresso. `scripts/validate.py` e `scripts/import_csv.mjs` aplicam as mesmas regras; os testes comparam as implementações nos mesmos casos.',
      '`src/ui.js`, `src/i18n.mjs` e `src/app.css` são a interface; `scripts/build.mjs` constrói o único `index.html` a partir de `src/` e incorpora os pacotes de `data/packs/` (todos menos `example.json`); `node scripts/build.mjs --check` falha quando a página não está atualizada.',
      'O navegador guarda três entradas (pacotes importados, progresso, um exame em curso); cada uma é verificada de novo quando a página carrega, pelo que um estado guardado danificado ou hostil é ignorado, não acreditado. Nada é enviado para lado nenhum.',
      'Testes: `npm test` (motor, paridade do validador, importação CSV, textos da interface, dados, documentação, compilação) e testes de navegador no hub (oito línguas, acessibilidade, estado guardado hostil, importação, cronometragem do exame) O desenvolvimento precisa de Node.js 24 ou mais recente e de Python 3 com `jsonschema`; a própria página só precisa de um navegador que conheça ES2017.'
    ],
    steps: [
      '1. Faça um fork deste repositório.',
      '2. Copie `data/packs/example.json` para `data/packs/<id-do-seu-pacote>.json` (o nome do ficheiro é o id do pacote) e preencha-o, ou transforme uma tabela num pacote com `node scripts/import_csv.mjs` (veja `docs/contributor-guide.md`).',
      '3. Execute `python3 scripts/validate.py` e `npm test`, e depois `node scripts/build.mjs` para que o pacote fique em `index.html`.',
      '4. Abra um pull request — as contribuições de dados não exigem programação.',
      '5. Sem programar: experimente primeiro o pacote na página (separador §tab_packs§, botão §i_go§) e envie depois o ficheiro numa issue ou num pull request; um responsável acrescenta-o a `data/packs/`.'
    ],
    firstRule: 'Um pacote = um ficheiro, com o nome do id do pacote.',
    contribHeading: 'Acrescentar um pacote de perguntas',
    contrib: [
      '1. Escolha primeiro a fonte. Um pacote de país tem de vir do banco público de perguntas desse país (ou de outra fonte que possa partilhar legalmente): anote a edição, a data e o endereço web. Não copie de um livro, de um curso ou de um sítio se a licença não o permitir; se não puder copiar, escreva perguntas originais e diga-o em `source`.',
      '2. Copie `data/packs/example.json` para `data/packs/<id-do-seu-pacote>.json`. O nome do ficheiro é o id do pacote: letras minúsculas, algarismos e hífenes, por exemplo `hu-ham-a`. Preencha o cabeçalho: `country`, `licence_class`, `lang`, `source`, `source_url`, `license`, e as regras `exam` só se as regras oficiais estiverem publicadas (com a sua fonte).',
      '3. Acrescente as perguntas: à mão no ficheiro, ou a partir de uma tabela guardada como CSV com `node scripts/import_csv.mjs questions.csv --id <id-pacote> --title … --country … --class … --lang … --source … --license …` (colunas e opções: `docs/contributor-guide.md`). Mantenha a numeração oficial em `id` e `source`.',
      '4. Verifique o pacote face ao banco oficial (`docs/verify-against-official-bank.md`): o texto de cada pergunta, cada resposta e cada resposta certa; peça a uma segunda pessoa que verifique uma amostra e escreva no pull request quem verificou o quê e como.',
      '5. Execute `python3 scripts/validate.py`, depois `node scripts/build.mjs` (põe o pacote em `index.html`) e `npm test`. Também pode experimentar o pacote antes de o enviar: abra `index.html`, separador §tab_packs§, botão §i_go§.',
      '6. Abra um pull request ou uma issue e diga que edição usou e em que condições a pode partilhar. Um pacote sem fonte declarada não é integrado.'
    ],
    issues: [
      'Acrescentar um pacote para a Hungria a partir do banco público de perguntas (`scripts/import_csv.mjs`, numeração oficial em `id` e `source`, `source_url`, regras de exame com a sua fonte)',
      'Acrescentar um pacote para a Itália a partir do banco público de perguntas, com o mesmo cuidado (edição, endereço da fonte, numeração, regras de exame)',
      'Acrescentar um pacote para a Alemanha (classe E ou A) a partir do banco público de perguntas, com o mesmo cuidado',
      'Acrescentar um pacote para o seu próprio país a partir do banco oficial de perguntas, em qualquer língua, e dizer o que verificou',
      'Escrever um conversor do formato de ficheiro oficial de um país (PDF, tabela ou XML) para as colunas CSV de `scripts/import_csv.mjs`',
      'Acrescentar o programa CEPT HAREC (Recomendação T/R 61-02) como `syllabus` de um pacote e ligar cada pergunta com `syllabus_ref`',
      'Pedir a um radioamador que reveja as 50 perguntas de treino incluídas e assinale qualquer resposta errada ou formulação pouco clara',
      'Redesenhar as figuras de circuitos e antenas de um pacote em SVG restrito, cada uma com uma alternativa em texto em `figure_alt`',
      'Testar o simulador de exame com um leitor de ecrã (NVDA, VoiceOver ou Orca) e assinalar o que é difícil de usar',
      'Pedir a um falante nativo que reveja os textos da interface da sua língua em `src/i18n.mjs`'
    ],
    added: [
      'O motor em `src/engine.mjs`: validação de pacotes e figuras, calendário de revisão em cinco caixas, filas de perguntas, exames sorteados a partir de uma semente, classificação e ficheiros de progresso.',
      'A página: separadores §tab_train§, §tab_exam§, §tab_packs§ e §tab_guide§ em oito línguas; atalhos de teclado, avisos para leitores de ecrã, um cronómetro de exame que sobrevive a um recarregamento; importação, descarga, reposição e remoção de pacotes; uma cópia de segurança do progresso.',
      'Um pacote de treino incluído com 50 perguntas originais (com explicações, fórmulas e duas figuras), escrito para este projeto com um assistente de IA e verificado por cálculo; não é um banco de perguntas oficial.',
      'O formato comum de pacote: `schema.json`, o modelo `data/packs/example.json` e `docs/pack-format.md` (em inglês e em romeno).',
      '`scripts/validate.py` aplica as mesmas regras da página; os testes comparam-no com o motor nos mesmos casos.',
      '`scripts/import_csv.mjs`: uma tabela guardada como CSV torna-se um pacote, e cada problema indica a sua linha no ficheiro.',
      '`scripts/pack_report.mjs`: um resumo de um pacote (contagens, números oficiais em falta, posições das respostas certas, uma listagem de texto, uma amostra aleatória) para o verificar face ao banco oficial.',
      '`docs/contributor-guide.md` e `docs/verify-against-official-bank.md` (em inglês e em romeno).',
      'Testes: `npm test` e testes de navegador no hub.',
      '`src/` e `scripts/build.mjs`: o único `index.html` é agora construído a partir dos fontes, com os pacotes incorporados, e `--check` verifica-o.'
    ],
    changed: [
      'O workflow corre em Ubuntu 26.04 com Node.js 26 e executa também os testes, a verificação da compilação e a validação.',
      'Os dados são agora pacotes: `data/packs/example.json` substitui `data/questions/example.json`, e um pacote é um ficheiro com o nome do seu id; `scripts/validate.py`, os passos do README e os modelos mudaram em conformidade.',
      'A lista de good first issues contém agora o que falta fazer (pacotes de país, programa, revisões); o treinador, o simulador de exame, as figuras e a verificação de `correct` que enumerava já existem.'
    ]
  },
  de: {
    status: 'Alpha, nutzbar: Die eine `index.html` ist ein Trainer und Prüfungssimulator für Fragen der Amateurfunkprüfung. Er übt mit einem Wiederholungsplan in fünf Fächern, führt zeitbegrenzte Probeprüfungen mit Bestehensgrenze durch und importiert Fragenpakete in einem gemeinsamen JSON-Format. Das eingebaute Paket enthält 50 eigens für dieses Projekt geschriebene Übungsfragen; es ist kein offizieller Fragenkatalog, und ein Länderpaket ist noch nicht enthalten. Alles bleibt in Ihrem Browser, ohne Konten, Tracking oder Netzwerkanfragen.',
    does: [
      '§tab_train§: Wählen Sie ein Paket, ein Fachgebiet und die zu übenden Fragen (fällige und neue, beliebige Fragen oder Ihre Schwächen); jede Antwort wird sofort geprüft und erklärt, mit ihrer Quelle. Richtige Antworten kommen nach 1, 3, 7, 14 und 30 Tagen wieder; falsche kommen heute und am Ende der Sitzung noch einmal wieder. Die Tasten 1–6 oder A–F wählen eine Antwort, die Eingabetaste geht weiter.',
      '§tab_exam§: ein zeitbegrenzter Test, zufällig aus dem Paket gezogen, mit Countdown, Fragenübersicht, §x_flag§ und Bestehensgrenze; nichts wird bewertet, bis Sie fertig sind (oder die Zeit abläuft). Das Ergebnis zeigt die Punktzahl nach Fachgebiet und die falsch beantworteten Fragen; derselbe Startwert wiederholt eine Prüfung; eine begonnene Prüfung läuft nach einem Neuladen weiter. Die Regeln (Fragen, Minuten, Bestehensgrenze, Abzug für falsche Antworten) kommen mit ihrer Quelle aus dem Paket; ohne sie nutzt die Seite Übungswerte (20 Fragen, 30 Minuten, 75 %).',
      '§tab_packs§: das eingebaute Übungspaket und die Pakete, die Sie durch Einfügen von JSON oder Auswahl einer Datei importieren (höchstens 8 gleichzeitig), jedes mit Quelle, Lizenz und Prüfungsregeln; Fortschritt nach Fachgebiet; ein Paket herunterladen, seinen Fortschritt zurücksetzen oder es entfernen; den Fortschritt in einer Datei sichern und auf einem anderen Gerät laden. Ein Paket mit Problemen wird Zeile für Zeile aufgelistet, und Sie können nur seine gültigen Fragen importieren.',
      'Format: Formeln in den Fragen als `f_{o}` oder `10^{-6}`; kleine Zeichnungen als eingeschränktes SVG mit Textalternative; ein optionaler Lehrplan mit `syllabus_ref` an jeder Frage; eine JSON-Datei pro Paket in `data/packs/`, beschrieben durch `schema.json` und `docs/pack-format.md`.',
      'Werkzeuge für Mitwirkende: `scripts/validate.py` prüft die Pakete mit denselben Regeln wie die Seite; `scripts/import_csv.mjs` macht aus einer als CSV gespeicherten Tabelle ein Paket und nennt bei jedem Problem die Zeile; `scripts/pack_report.mjs` fasst ein Paket zusammen, damit Sie es gegen den offiziellen Katalog prüfen können. Die Oberfläche ist in acht Sprachen und lässt sich mit der Tastatur und mit einem Screenreader bedienen.'
    ],
    how: [
      '`schema.json` beschreibt ein Paket; `scripts/validate.py` prüft jede Datei in `data/packs/` dagegen und gegen die Regeln, die ein Schema nicht ausdrücken kann: Die Datei heißt wie die Paket-ID, IDs und Fragen sind innerhalb eines Pakets eindeutig, `syllabus_ref` existiert im Lehrplan, Abbildungen verwenden nur die erlaubten Elemente und die Prüfungsregeln passen zum Paket.',
      '`src/engine.mjs` ist die Engine (ohne Bildschirm, ohne Netzwerk): Validierung, der Plan in fünf Fächern, die Fragenwarteschlangen, aus einem Startwert gezogene Prüfungen, Bewertung und die Fortschrittsdateien. `scripts/validate.py` und `scripts/import_csv.mjs` wenden dieselben Regeln an; die Tests vergleichen die Implementierungen an denselben Fällen.',
      '`src/ui.js`, `src/i18n.mjs` und `src/app.css` sind die Oberfläche; `scripts/build.mjs` baut die eine `index.html` aus `src/` und bettet die Pakete aus `data/packs/` ein (alle außer `example.json`); `node scripts/build.mjs --check` schlägt fehl, wenn die Seite nicht aktuell ist.',
      'Der Browser speichert drei Einträge (importierte Pakete, Fortschritt, eine laufende Prüfung); jeder wird beim Laden der Seite erneut geprüft, sodass ein beschädigter oder feindlicher gespeicherter Zustand ignoriert statt geglaubt wird. Nichts wird irgendwohin gesendet.',
      'Tests: `npm test` (Engine, Parität des Validators, CSV-Import, Oberflächentexte, Daten, Dokumentation, Build) und Browser-Tests im Hub (acht Sprachen, Barrierefreiheit, feindlicher gespeicherter Zustand, Import, Zeitmessung der Prüfung) Die Entwicklung braucht Node.js 24 oder neuer und Python 3 mit `jsonschema`; die Seite selbst braucht nur einen Browser, der ES2017 kennt.'
    ],
    steps: [
      '1. Forken Sie dieses Repository.',
      '2. Kopieren Sie `data/packs/example.json` nach `data/packs/<id-ihres-pakets>.json` (der Dateiname ist die Paket-ID) und füllen Sie sie aus, oder machen Sie aus einer Tabelle ein Paket mit `node scripts/import_csv.mjs` (siehe `docs/contributor-guide.md`).',
      '3. Führen Sie `python3 scripts/validate.py` und `npm test` aus, danach `node scripts/build.mjs`, damit das Paket in `index.html` steht.',
      '4. Öffnen Sie einen Pull Request — Datenbeiträge brauchen keine Programmierung.',
      '5. Ohne Programmieren: Probieren Sie das Paket zuerst auf der Seite aus (Reiter §tab_packs§, Schaltfläche §i_go§) und schicken Sie die Datei dann in einem Issue oder Pull Request; ein Maintainer fügt sie zu `data/packs/` hinzu.'
    ],
    firstRule: 'Ein Paket = eine Datei, benannt nach der Paket-ID.',
    contribHeading: 'Ein Fragenpaket hinzufügen',
    contrib: [
      '1. Wählen Sie zuerst die Quelle. Ein Länderpaket muss aus dem öffentlichen Fragenkatalog dieses Landes stammen (oder aus einer anderen Quelle, die Sie rechtmäßig weitergeben dürfen): Notieren Sie Ausgabe, Datum und Webadresse. Kopieren Sie nicht aus einem Buch, einem Kurs oder von einer Website, wenn deren Lizenz es nicht erlaubt; wenn Sie nicht kopieren können, schreiben Sie eigene Fragen und sagen Sie das in `source`.',
      '2. Kopieren Sie `data/packs/example.json` nach `data/packs/<id-ihres-pakets>.json`. Der Dateiname ist die Paket-ID: Kleinbuchstaben, Ziffern und Bindestriche, zum Beispiel `hu-ham-a`. Füllen Sie den Kopf aus: `country`, `licence_class`, `lang`, `source`, `source_url`, `license`, und die `exam`-Regeln nur, wenn die offiziellen Regeln veröffentlicht sind (mit ihrer Quelle).',
      '3. Fügen Sie die Fragen hinzu: von Hand in der Datei oder aus einer als CSV gespeicherten Tabelle mit `node scripts/import_csv.mjs questions.csv --id <paket-id> --title … --country … --class … --lang … --source … --license …` (Spalten und Optionen: `docs/contributor-guide.md`). Behalten Sie die offizielle Nummerierung in `id` und `source`.',
      '4. Prüfen Sie das Paket gegen den offiziellen Katalog (`docs/verify-against-official-bank.md`): den Text jeder Frage, jede Antwort und jede richtige Antwort; lassen Sie eine zweite Person eine Stichprobe prüfen und schreiben Sie im Pull Request, wer was wie geprüft hat.',
      '5. Führen Sie `python3 scripts/validate.py` aus, dann `node scripts/build.mjs` (es legt das Paket in `index.html`) und `npm test`. Sie können das Paket auch vor dem Senden ausprobieren: `index.html` öffnen, Reiter §tab_packs§, Schaltfläche §i_go§.',
      '6. Öffnen Sie einen Pull Request oder ein Issue und sagen Sie, welche Ausgabe Sie benutzt haben und unter welchen Bedingungen Sie sie weitergeben dürfen. Ein Paket ohne angegebene Quelle wird nicht übernommen.'
    ],
    issues: [
      'Ein Paket für Ungarn aus dem öffentlichen Fragenkatalog hinzufügen (`scripts/import_csv.mjs`, offizielle Nummerierung in `id` und `source`, `source_url`, Prüfungsregeln mit ihrer Quelle)',
      'Ein Paket für Italien aus dem öffentlichen Fragenkatalog hinzufügen, mit derselben Sorgfalt (Ausgabe, Quellenadresse, Nummerierung, Prüfungsregeln)',
      'Ein Paket für Deutschland (Klasse E oder A) aus dem öffentlichen Fragenkatalog hinzufügen, mit derselben Sorgfalt',
      'Ein Paket für das eigene Land aus dessen offiziellem Fragenkatalog hinzufügen, in beliebiger Sprache, und mitteilen, was geprüft wurde',
      'Einen Konverter vom offiziellen Dateiformat eines Landes (PDF, Tabelle oder XML) zu den CSV-Spalten von `scripts/import_csv.mjs` schreiben',
      'Den CEPT-HAREC-Lehrplan (Empfehlung T/R 61-02) als `syllabus` eines Pakets hinzufügen und jede Frage mit `syllabus_ref` verknüpfen',
      'Die 50 eingebauten Übungsfragen von einem Funkamateur prüfen lassen und jede falsche Antwort oder unklare Formulierung melden',
      'Die Schaltungs- und Antennenabbildungen eines Pakets als eingeschränktes SVG neu zeichnen, jede mit einer Textalternative in `figure_alt`',
      'Den Prüfungssimulator mit einem Screenreader (NVDA, VoiceOver oder Orca) testen und melden, was schwer zu bedienen ist',
      'Die Oberflächentexte der eigenen Sprache in `src/i18n.mjs` von einer Muttersprachlerin oder einem Muttersprachler prüfen lassen'
    ],
    added: [
      'Die Engine in `src/engine.mjs`: Validierung von Paketen und Abbildungen, der Wiederholungsplan in fünf Fächern, Fragenwarteschlangen, aus einem Startwert gezogene Prüfungen, Bewertung und Fortschrittsdateien.',
      'Die Seite: die Reiter §tab_train§, §tab_exam§, §tab_packs§ und §tab_guide§ in acht Sprachen; Tastenkürzel, Ansagen für Screenreader, ein Prüfungstimer, der ein Neuladen übersteht; Import, Download, Zurücksetzen und Entfernen von Paketen; eine Sicherung des Fortschritts.',
      'Ein eingebautes Übungspaket mit 50 eigenen Fragen (mit Erklärungen, Formeln und zwei Abbildungen), für dieses Projekt mit einem KI-Assistenten geschrieben und durch Rechnung geprüft; es ist kein offizieller Fragenkatalog.',
      'Das gemeinsame Paketformat: `schema.json`, die Vorlage `data/packs/example.json` und `docs/pack-format.md` (auf Englisch und Rumänisch).',
      '`scripts/validate.py` wendet dieselben Regeln an wie die Seite; die Tests vergleichen es an denselben Fällen mit der Engine.',
      '`scripts/import_csv.mjs`: Eine als CSV gespeicherte Tabelle wird zum Paket, und jedes Problem nennt seine Zeile in der Datei.',
      '`scripts/pack_report.mjs`: eine Zusammenfassung eines Pakets (Zählungen, fehlende offizielle Nummern, Positionen der richtigen Antworten, eine Textliste, eine Zufallsstichprobe), um es gegen den offiziellen Katalog zu prüfen.',
      '`docs/contributor-guide.md` und `docs/verify-against-official-bank.md` (auf Englisch und Rumänisch).',
      'Tests: `npm test` und Browser-Tests im Hub.',
      '`src/` und `scripts/build.mjs`: Die eine `index.html` wird jetzt aus den Quellen gebaut, mit eingebetteten Paketen, und `--check` prüft sie.'
    ],
    changed: [
      'Der Workflow läuft auf Ubuntu 26.04 mit Node.js 26 und führt auch die Tests, die Build-Prüfung und die Validierung aus.',
      'Die Daten sind jetzt Pakete: `data/packs/example.json` ersetzt `data/questions/example.json`, und ein Paket ist eine nach seiner ID benannte Datei; `scripts/validate.py`, die README-Schritte und die Vorlagen wurden entsprechend geändert.',
      'Die Liste der Good First Issues enthält jetzt, was noch zu tun ist (Länderpakete, Lehrplan, Prüfungen durch Fachleute); der Trainer, der Prüfungssimulator, die Abbildungen und die Prüfung von `correct`, die sie früher aufzählte, gibt es jetzt.'
    ]
  },
  hu: {
    status: 'Alfa, használható: az egyetlen `index.html` egy gyakorló és vizsgaszimulátor rádióamatőr-vizsgakérdésekhez. Öt dobozos ismétlési ütemezéssel gyakorol, időkorlátos próbavizsgát futtat ponthatárral, és közös JSON formátumú kérdéscsomagokat importál. A beépített csomag 50, kifejezetten ehhez a projekthez írt eredeti gyakorlókérdést tartalmaz; nem hivatalos kérdésbank, és országcsomag még nincs benne. Minden a böngésződben marad, fiókok, követés és hálózati kérések nélkül.',
    does: [
      '§tab_train§: válassz csomagot, témát és azt, hogy mely kérdéseket gyakorlod (esedékes és új, bármelyik kérdés, vagy a gyenge pontjaid); minden választ azonnal ellenőriz és megmagyaráz, a forrásával együtt. A helyes válaszok 1, 3, 7, 14 és 30 nap múlva jönnek vissza; a hibásak ma, és a gyakorlás végén még egyszer. Az 1–6 vagy A–F billentyűk választ választanak, az Enter továbblép.',
      '§tab_exam§: a csomagból véletlenszerűen húzott, időkorlátos teszt visszaszámlálóval, kérdéstérképpel, §x_flag§ funkcióval és ponthatárral; semmi sincs értékelve, amíg be nem fejezed (vagy le nem jár az idő). Az eredmény témánként mutatja a pontszámot és a hibásan megválaszolt kérdéseket; ugyanaz a magérték megismétel egy vizsgát; egy megkezdett vizsga újratöltés után is folytatódik. A szabályok (kérdések, percek, ponthatár, a hibás válaszok levonása) a csomagból jönnek a forrásukkal; nélkülük az oldal gyakorló értékeket használ (20 kérdés, 30 perc, 75 %).',
      '§tab_packs§: a beépített gyakorlócsomag és a JSON beillesztésével vagy fájl választásával importált csomagok (egyszerre legfeljebb 8), mindegyik a forrásával, licencével és vizsgaszabályaival; haladás témánként; letölthetsz egy csomagot, nullázhatod a haladását vagy eltávolíthatod; a haladásról fájlba mentett másolat, amelyet egy másik eszközön betölthetsz. A problémás csomagot sorról sorra felsorolja, és csak az érvényes kérdéseit is importálhatod.',
      'Formátum: a kérdésekben képletek `f_{o}` vagy `10^{-6}` alakban; kis rajzok korlátozott SVG-ként szöveges alternatívával; elhagyható tananyagterv, minden kérdésen `syllabus_ref`-fel; csomagonként egy JSON-fájl a `data/packs/` mappában, amelyet a `schema.json` és a `docs/pack-format.md` ír le.',
      'Eszközök a közreműködőknek: a `scripts/validate.py` ugyanazokkal a szabályokkal ellenőrzi a csomagokat, mint az oldal; a `scripts/import_csv.mjs` a CSV-ként mentett táblázatból csomagot készít, és minden hibánál megnevezi a sorát; a `scripts/pack_report.mjs` összefoglal egy csomagot, hogy a hivatalos kérdésbankkal szemben ellenőrizhesd. A felület nyolc nyelvű, és billentyűzettel meg képernyőolvasóval is használható.'
    ],
    how: [
      'A `schema.json` leír egy csomagot; a `scripts/validate.py` a `data/packs/` minden fájlját ellenőrzi ellene és azokkal a szabályokkal, amelyeket egy séma nem tud kifejezni: a fájl a csomag azonosítójáról kapja a nevét, az azonosítók és a kérdések egy csomagon belül egyediek, a `syllabus_ref` létezik a tananyagtervben, az ábrák csak az engedélyezett elemeket használják, a vizsgaszabályok pedig illenek a csomaghoz.',
      'A `src/engine.mjs` a motor (képernyő és hálózat nélkül): érvényesítés, az ötdobozos ütemezés, a kérdéssorok, magértékből húzott vizsgák, értékelés és a haladásfájlok. A `scripts/validate.py` és a `scripts/import_csv.mjs` ugyanazokat a szabályokat alkalmazza; a tesztek ugyanazokon az eseteken hasonlítják össze a megvalósításokat.',
      'A `src/ui.js`, a `src/i18n.mjs` és a `src/app.css` a felület; a `scripts/build.mjs` a `src/` mappából építi fel az egyetlen `index.html` fájlt, és beágyazza a `data/packs/` csomagjait (az `example.json` kivételével mindet); a `node scripts/build.mjs --check` hibával leáll, ha az oldal nem naprakész.',
      'A böngésző három bejegyzést őriz (importált csomagok, haladás, egy folyamatban lévő vizsga); mindegyiket újra ellenőrzi az oldal betöltésekor, így a sérült vagy ellenséges mentett állapotot figyelmen kívül hagyja, nem hiszi el. Semmi sem megy sehová.',
      'Tesztek: `npm test` (motor, az érvényesítő egyezése, CSV-import, a felület szövegei, adatok, dokumentáció, építés) és böngészőtesztek a hubban (nyolc nyelv, akadálymentesség, ellenséges mentett állapot, import, a vizsga időmérése) A fejlesztéshez Node.js 24 vagy újabb, valamint Python 3 és `jsonschema` kell; maga az oldal csak egy ES2017-et ismerő böngészőt igényel.'
    ],
    steps: [
      '1. Forkold ezt a tárolót.',
      '2. Másold a `data/packs/example.json` fájlt a `data/packs/<a-csomagod-azonosítója>.json` helyre (a fájlnév a csomag azonosítója), és töltsd ki, vagy készíts egy táblázatból csomagot a `node scripts/import_csv.mjs` paranccsal (lásd `docs/contributor-guide.md`).',
      '3. Futtasd a `python3 scripts/validate.py` és az `npm test` parancsot, majd a `node scripts/build.mjs` parancsot, hogy a csomag bekerüljön az `index.html` fájlba.',
      '4. Nyiss egy pull requestet — az adatok hozzáadásához nem kell programozni.',
      '5. Programozás nélkül: próbáld ki előbb a csomagot az oldalon (§tab_packs§ lap, §i_go§ gomb), majd küldd el a fájlt egy issue-ban vagy pull requestben; egy karbantartó felveszi a `data/packs/` mappába.'
    ],
    firstRule: 'Egy csomag = egy fájl, a csomag azonosítójáról elnevezve.',
    contribHeading: 'Kérdéscsomag hozzáadása',
    contrib: [
      '1. Először a forrást válaszd ki. Egy országcsomagnak az adott ország nyilvános kérdésbankjából kell származnia (vagy más olyan forrásból, amelyet jogszerűen megoszthatsz): jegyezd fel a kiadást, a dátumot és a webcímet. Ne másolj könyvből, tanfolyamról vagy weboldalról, ha a licence nem engedi; ha nem másolhatsz, írj eredeti kérdéseket, és mondd ezt a `source` mezőben.',
      '2. Másold a `data/packs/example.json` fájlt a `data/packs/<a-csomagod-azonosítója>.json` helyre. A fájlnév a csomag azonosítója: kisbetűk, számjegyek és kötőjelek, például `hu-ham-a`. Töltsd ki a fejlécet: `country`, `licence_class`, `lang`, `source`, `source_url`, `license`, és az `exam` szabályokat csak akkor, ha a hivatalos szabályok közzé vannak téve (a forrásukkal).',
      '3. Add hozzá a kérdéseket: kézzel a fájlban, vagy CSV-ként mentett táblázatból a `node scripts/import_csv.mjs questions.csv --id <csomag-azonosító> --title … --country … --class … --lang … --source … --license …` paranccsal (oszlopok és kapcsolók: `docs/contributor-guide.md`). A hivatalos számozást tartsd meg az `id` és a `source` mezőben.',
      '4. Ellenőrizd a csomagot a hivatalos kérdésbankkal szemben (`docs/verify-against-official-bank.md`): minden kérdés szövegét, minden választ és minden helyes választ; kérd meg egy második embert, hogy ellenőrizzen egy mintát, és írd meg a pull requestben, ki mit és hogyan ellenőrzött.',
      '5. Futtasd a `python3 scripts/validate.py` parancsot, majd a `node scripts/build.mjs` parancsot (ez beteszi a csomagot az `index.html` fájlba) és az `npm test` parancsot. A csomagot elküldés előtt ki is próbálhatod: nyisd meg az `index.html` fájlt, §tab_packs§ lap, §i_go§ gomb.',
      '6. Nyiss egy pull requestet vagy issue-t, és írd meg, melyik kiadást használtad, és milyen feltételekkel oszthatod meg. A forrás nélküli csomagot nem vesszük át.'
    ],
    issues: [
      'Csomag hozzáadása Magyarországhoz a nyilvános kérdésbankból (`scripts/import_csv.mjs`, hivatalos számozás az `id` és a `source` mezőben, `source_url`, a vizsgaszabályok a forrásukkal)',
      'Csomag hozzáadása Olaszországhoz a nyilvános kérdésbankból, ugyanilyen gondossággal (kiadás, a forrás címe, számozás, vizsgaszabályok)',
      'Csomag hozzáadása Németországhoz (E vagy A osztály) a nyilvános kérdésbankból, ugyanilyen gondossággal',
      'Csomag hozzáadása a saját országodhoz annak hivatalos kérdésbankjából, bármilyen nyelven, és írd meg, mit ellenőriztél',
      'Átalakító írása egy ország hivatalos fájlformátumából (PDF, táblázat vagy XML) a `scripts/import_csv.mjs` CSV-oszlopaira',
      'A CEPT HAREC tananyagterv (T/R 61-02 ajánlás) hozzáadása egy csomag `syllabus` mezőjeként, és minden kérdés összekötése a `syllabus_ref` mezővel',
      'Egy rádióamatőrrel átnézetni az 50 beépített gyakorlókérdést, és jelenteni minden hibás választ vagy érthetetlen megfogalmazást',
      'Egy csomag áramköri és antennaábráinak újrarajzolása korlátozott SVG-ként, mindegyik szöveges alternatívával a `figure_alt` mezőben',
      'A vizsgaszimulátor kipróbálása képernyőolvasóval (NVDA, VoiceOver vagy Orca), és jelenteni, mi nehezen használható',
      'A saját nyelv felületi szövegeinek átnézetése egy anyanyelvi beszélővel a `src/i18n.mjs` fájlban'
    ],
    added: [
      'A motor a `src/engine.mjs` fájlban: csomagok és ábrák érvényesítése, az ötdobozos ismétlési ütemezés, kérdéssorok, magértékből húzott vizsgák, értékelés és haladásfájlok.',
      'Az oldal: a §tab_train§, §tab_exam§, §tab_packs§ és §tab_guide§ lap nyolc nyelven; billentyűparancsok, bejelentések képernyőolvasóknak, újratöltést túlélő vizsgaidőzítő; csomagok importálása, letöltése, nullázása és eltávolítása; a haladás mentése.',
      'Egy beépített gyakorlócsomag 50 eredeti kérdéssel (magyarázatokkal, képletekkel és két ábrával), amelyet ehhez a projekthez írtak egy MI-asszisztenssel, és számolással ellenőriztek; nem hivatalos kérdésbank.',
      'A közös csomagformátum: a `schema.json`, a `data/packs/example.json` sablon és a `docs/pack-format.md` (angolul és románul).',
      'A `scripts/validate.py` ugyanazokat a szabályokat alkalmazza, mint az oldal; a tesztek ugyanazokon az eseteken hasonlítják össze a motorral.',
      '`scripts/import_csv.mjs`: a CSV-ként mentett táblázatból csomag lesz, és minden hiba megnevezi a fájlbeli sorát.',
      '`scripts/pack_report.mjs`: egy csomag összefoglalója (számlálások, hiányzó hivatalos számok, a helyes válaszok helye, szöveges lista, véletlen minta), hogy a hivatalos kérdésbankkal szemben ellenőrizhető legyen.',
      'A `docs/contributor-guide.md` és a `docs/verify-against-official-bank.md` (angolul és románul).',
      'Tesztek: `npm test` és böngészőtesztek a hubban.',
      '`src/` és `scripts/build.mjs`: az egyetlen `index.html` mostantól forrásokból épül, beágyazott csomagokkal, és a `--check` ellenőrzi.'
    ],
    changed: [
      'A munkafolyamat Ubuntu 26.04 és Node.js 26 alatt fut, és a teszteket, a build-ellenőrzést meg az érvényesítést is futtatja.',
      'Az adatok mostantól csomagok: a `data/packs/example.json` váltja a `data/questions/example.json` fájlt, és egy csomag egy, az azonosítójáról elnevezett fájl; a `scripts/validate.py`, a README lépései és a sablonok ennek megfelelően módosultak.',
      'A „good first issues” lista most azt tartalmazza, ami még hátravan (országcsomagok, tananyagterv, átnézések); a gyakorló felület, a vizsgaszimulátor, az ábrák és a `correct` ellenőrzése, amelyeket korábban felsorolt, már léteznek.'
    ]
  }
};

export default async function (root) {
  const dir = path.join(root, 'indicativ-international');
  const I18N = (await import(pathToFileURL(path.join(dir, 'src', 'i18n.mjs')).href)).default;
  const legacy = JSON.parse(fs.readFileSync(path.join(HERE, 'indicativ-international.legacy.json'), 'utf8'));
  const q = (l, k) => {
    if (typeof I18N[l][k] !== 'string') throw new Error('indicativ-international: cheie lipsă în src/i18n.mjs: ' + k + ' (' + l + ')');
    return QU[l][0] + I18N[l][k] + QU[l][1];
  };
  const fill = (l, s) => s.replace(/§([a-z_0-9]+)§/g, (m, k) => q(l, k));
  const each = (key, map) => Object.fromEntries(L.map((l) => {
    if (!T[l] || T[l][key] === undefined) throw new Error('indicativ-international: lipsește «' + key + '» pentru limba ' + l);
    return [l, map(l, T[l][key])];
  }));
  const list = (l, a) => a.map((x) => fill(l, x));
  const limits = {}, limHeading = {};
  for (const l of L) { limits[l] = [1, 2, 3, 4, 5, 6].map((i) => I18N[l]['lim_' + i]); limHeading[l] = I18N[l].h_limits; }
  const added = each('added', list);
  for (const l of L) added[l] = [...added[l], ...legacy[l]];

  return {
    slug: 'indicativ-international', version: '0.2.0', updated: '2026-11-17',
    headings: {
      does: {en: 'What it does', ro: 'Ce face', fr: 'Ce que fait l’application', it: 'Cosa fa', es: 'Qué hace', pt: 'O que faz', de: 'Was es kann', hu: 'Mit tud'},
      how: {en: 'How it works', ro: 'Cum funcționează', fr: 'Comment ça marche', it: 'Come funziona', es: 'Cómo funciona', pt: 'Como funciona', de: 'Wie es funktioniert', hu: 'Hogyan működik'},
      limits: limHeading
    },
    status: each('status', (l, s) => fill(l, s)),
    does: each('does', list),
    how: each('how', list),
    limits,
    steps: each('steps', (l, a) => list(l, a).join('\n')),
    firstRule: each('firstRule', (l, s) => s),
    contrib: {
      heading: each('contribHeading', (l, s) => s),
      body: each('contrib', (l, a) => list(l, a).join('\n'))
    },
    issues: each('issues', list),
    changelog: {added, changed: each('changed', list)}
  };
}
