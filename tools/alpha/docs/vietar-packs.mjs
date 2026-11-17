// Specificația documentației VietAR Packs (opt limbi). Folosită de tools/alpha/docs.mjs.
// Numele filelor și ale butoanelor din text vin din src/i18n.mjs (marcate §cheie§), ca documentația să spună exact ce scrie în pagină.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const L = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
const QU = {en: ['“', '”'], ro: ['«', '»'], fr: ['« ', ' »'], it: ['«', '»'], es: ['«', '»'], pt: ['«', '»'], de: ['„', '“'], hu: ['„', '”']};

// Textele fiecărei limbi. Marcajul §cheie§ devine numele din interfață, între ghilimelele limbii.
// Ghidurile din docs/ există în engleză (`.md`) și în română (`.ro.md`): celelalte limbi trimit la cele englezești.
// Cifrele (71 de specii: 19 + 17 + 15 + 10 + 10) sunt cele din versiunea 0.2.0; testele depozitului verifică doar că documentația nu promite mai mult decât există.
const T = {
  en: {
    status: 'Alpha, usable: the single `index.html` browses, imports, checks and creates regional species packs: names in several languages, a toxic flag, dangerous look-alikes, licensed photos and links to xeno-canto sounds. It holds five built-in starter packs with 71 species in all (Romania: 19 plants and fungi, 17 birds and 15 mammals; Bulgaria and Moldova: the same 10 widespread species each, as skeletons). Every built-in pack is a draft or a skeleton: names and notes were written with an AI assistant and checked only in part, no biologist, mycologist or native speaker has reviewed them, and they contain no photos and no sound links yet. The page identifies nothing and is not a field guide: the label §d_tox_no§ never means safe to eat or touch. The VietAR app cannot import these packs yet.',
    does: [
      '§tab_browse§: choose a pack, search by a name in any language or by the Latin name (capitals and accents do not matter), filter by group and by toxic flag, and open a species: its names (in the language of the page, with English as the fallback), toxic flag and toxicity note, notes, source, the species it is often confused with (each one a link), photos and sound links. A red safety box stays visible on every tab and says what the page is not.',
      '§tab_packs§: the built-in packs and the ones you import (paste the JSON or choose a file; at most 12 at a time), each with its region, version, licence, authors, an honest status badge (§st_skeleton§, §st_draft§, §st_reviewed§) and counts by group; download any pack or remove the ones you imported. A pack is checked completely before it is added: if anything is wrong, nothing is imported and you see what to fix.',
      '§tab_build§: make a pack for a school class, a nature club or a region: fill in the pack, add species one by one (up to 400), link look-alikes in both directions, check the pack with the same rules as the repository and download the file. The draft is kept in this browser while you work. A pack made here is never marked as reviewed; photos and sounds are added through the JSON of the species.',
      '§tab_guide§: how to use the page, and an example of a species with a photo and a sound.',
      'Format: one JSON file per species in `data/species/`, one manifest per pack in `data/packs/`, built into complete packs (format `vietar-pack`) in `data/dist/`; described by `schema.json` and `pack.schema.json` and explained in `docs/pack-format.md`.',
      'Tools for contributors: `scripts/pack.mjs` (builds the packs and splits a downloaded one into files), `scripts/validate.py`, `scripts/optimize.py` (a photo to WebP of at most 640 px, without metadata), `scripts/check_licences.mjs` (photo licences, online with `--online`). The interface is in eight languages and works with the keyboard and with a screen reader.'
    ],
    how: [
      'A species file and a manifest (the list of species ids and their count) become a complete pack: `node scripts/pack.mjs` writes it to `data/dist/<id>.json`. The page embeds `data/dist/`, so what you browse is exactly what you download.',
      '`schema.json` and `pack.schema.json` describe the files; `scripts/validate.py` applies them and the rules a schema cannot say: the file name, the id and the Latin name agree, the group fits the kingdom, plants and fungi say whether they are toxic, a toxic species has a toxicity note, look-alikes point back at each other, photos stay within 3 MB, a reviewed pack names the reviewer and the date. `src/engine.mjs` applies the same rules in the page; the tests compare the two.',
      'Safe by construction: text from a pack is always shown as text, never as HTML; links open only `https://` addresses; the page makes no network request (photos are embedded, sounds are links that open xeno-canto.org in a new tab); an imported pack and the saved state are checked again when the page loads, so a damaged or hostile one is refused, not trusted.',
      '`src/ui.js`, `src/i18n.mjs` and `src/app.css` are the interface; `scripts/build.mjs` builds the single `index.html` from `src/` and embeds the packs of `data/dist/`; `node scripts/build.mjs --check` fails when the page is out of date.',
      'Tests: `npm test` (engine, validator parity, scripts, licence checker, photo optimiser, documentation) and browser tests in the hub (eight languages, accessibility, hostile imports, limits, full storage). Development needs Node.js 24 or newer and Python 3 with `jsonschema` (Pillow only for the photo optimiser); the page itself needs a browser that knows ES2017.'
    ],
    steps: [
      '1. Fork this repository.',
      '2. Make or extend a pack: on the page use the tab §tab_build§ and download the file, or write `data/species/<latin-name>.json` files by hand (see `docs/pack-format.md`).',
      '3. Turn a downloaded pack into files with `node scripts/pack.mjs --split vietar-pack-<id>.json`, or list the new species ids in the manifest of the pack in `data/packs/`.',
      '4. Run `node scripts/pack.mjs`, `python3 scripts/validate.py`, `npm test` and `node scripts/build.mjs`.',
      '5. Open a pull request — data contributions need no coding. Give a source for every name, note and toxic flag, and never mark a pack as reviewed yourself (see `docs/review-guide.md`).'
    ],
    firstRule: 'One species = one file in `data/species/`, named after its id (the Latin name in lower case with hyphens).',
    contribHeading: 'Adding species and packs',
    contrib: [
      '1. Start from a source you may use: your own knowledge and observations, or public pages whose licence allows reuse (write down the address and the date). Do not copy text from field guides, apps or websites unless the licence allows it: write the note in your own words and say so in `source`.',
      '2. Write a name only in a language you know or can check with a native speaker or a reliable dictionary. English is required; the page shows the language of the reader first and English as the fallback.',
      '3. For plants and fungi `toxic` is required. Say `true` when any part of the species is known to be poisonous, and write a toxicity note that says what the danger is. `false` only means that nobody marked the species as toxic here: it never means edible. When in doubt, ask a local expert before you write `false`.',
      '4. List a dangerous pair of look-alikes on both species, with a warning note such as “The leaves can be mistaken for each other; confusing them has caused serious poisonings”. Say that they are confused, never how to tell them apart: a wrong tip can kill.',
      '5. Photos: your own, public-domain or with a licence listed in `docs/pack-format.md`, each with its author, licence and a link to its source; reduce them with `python3 scripts/optimize.py` (WebP, at most 640 px, no location data) and check Wikimedia Commons photos with `node scripts/check_licences.mjs --online`. Sounds: only links to xeno-canto.org that you listened to, with the recordist and the licence.',
      '6. A new pack is a `draft` (or a `skeleton` when it only shows the format). Only a reviewer who has checked every species may set `reviewed`, with their name and the date: see `docs/review-guide.md`.',
      '7. More: `docs/contributor-guide.md` (commands, files, checks), `docs/school-class-guide.md` (a class or a club makes a pack) and `docs/pack-format.md` (every field and limit).'
    ],
    issues: [
      'Grow `ro-mammals` to 30 Carpathian mammals, with names in en/ro/hu/de',
      'Grow `ro-birds` to 50 common birds of Romania',
      'Grow `ro-plants-fungi` to 40 wild plants and mushrooms, each with a toxic flag and its look-alikes',
      'Grow the Bulgarian skeleton `bg-starter` to 20 species, with names checked by a Bulgarian speaker',
      'Grow the Moldovan skeleton `md-starter` to 20 species, with names checked by a local speaker',
      'Have a biologist or mycologist review one built-in pack and record it (see `docs/review-guide.md`)',
      'Add real photos with their licences to built-in species (`scripts/optimize.py`, `scripts/check_licences.mjs --online`)',
      'Add xeno-canto links to the birds, each one checked by listening',
      'Ask native speakers to review the interface translations (fr, it, es, pt, de, hu, ro)',
      'Let the VietAR app import `vietar-pack` files (a change in the VietAR repository)'
    ],
    added: [
      'The page: the tabs §tab_browse§, §tab_packs§, §tab_build§ and §tab_guide§ in eight languages, with a red safety box that stays visible on every tab, keyboard shortcuts and screen-reader support.',
      'The viewer: search in any language (capitals and accents ignored), filters by group and toxic flag, species pages with names, toxic flag and note, notes, source, look-alikes (as links), photos and sound links; §d_tox_no§ is never shown in green and always carries a warning.',
      'Packs: import (paste or file, checked completely before anything is added), download, remove and replace by id; counts by group; honest status badges (§st_skeleton§, §st_draft§, §st_reviewed§) with what each means.',
      'The creator: a pack form, a species form with names in several languages, toxic flag and notes, look-alike links in both directions, a JSON editor for photos and sounds, a check, a download, and a draft kept in the browser (with a warning when the browser has no room).',
      'The pack format: `schema.json` (a species), `pack.schema.json` (a manifest), built packs in `data/dist/` (format `vietar-pack`, version 1) and `data/dist/example.json` as a format example.',
      'Five built-in starter packs with 71 species: Romania (19 plants and fungi, 17 birds, 15 mammals) and skeletons for Bulgaria and Moldova (the same 10 species each); drafts written with an AI assistant and checked only in part, with no photos and no sound links.',
      '`scripts/pack.mjs` (build, `--check`, `--split`), `scripts/validate.py` (the same rules as the page, for every file and every built pack), `scripts/optimize.py` (photos) and `scripts/check_licences.mjs` (licence and author of photos; `--online` asks Wikimedia Commons).',
      'Guides in English and Romanian: `docs/pack-format.md`, `docs/school-class-guide.md`, `docs/contributor-guide.md` and `docs/review-guide.md`.',
      '`src/` and `scripts/build.mjs`: the single `index.html` is now built from the sources with the packs of `data/dist/` embedded, and `--check` verifies it.',
      'Tests: `npm test` and browser tests in the hub.'
    ],
    changed: [
      'The workflow runs on Ubuntu 26.04 and Node.js 26, and runs the pack check, the validator, the tests and the build check.',
      'The data are now one file per species and one manifest per pack (`data/species/`, `data/packs/`), built into `data/dist/`; `data/species/example.json` is replaced by `data/dist/example.json`, and `scripts/validate.py`, the README steps and the templates changed with it.',
      'The “good first issues” list now holds what is still to do (more species, expert review, photos, sounds, translations); the format specification, the look-alike field, the photo optimiser, the licence checker and the school-class guide that it listed before exist.'
    ]
  },
  ro: {
    status: 'Alfa, utilizabilă: singurul `index.html` răsfoiește, importă, verifică și creează pachete regionale de specii: nume în mai multe limbi, un marcaj de toxicitate, sosii periculoase, fotografii cu licență și legături către sunete de pe xeno-canto. Conține cinci pachete de pornire incluse, cu 71 de specii în total (România: 19 plante și ciuperci, 17 păsări și 15 mamifere; Bulgaria și Moldova: aceleași 10 specii răspândite, ca schelete). Fiecare pachet inclus este o ciornă sau un schelet: numele și notele au fost scrise cu un asistent IA și verificate doar în parte, niciun biolog, micolog sau vorbitor nativ nu le-a revizuit, iar pachetele nu au încă fotografii și nici legături către sunete. Pagina nu identifică nimic și nu este un ghid de teren: eticheta §d_tox_no§ nu înseamnă niciodată că e sigur de mâncat sau de atins. Aplicația VietAR nu poate încă importa aceste pachete.',
    does: [
      '§tab_browse§: alegi un pachet, cauți după un nume în orice limbă sau după numele latinesc (majusculele și diacriticele nu contează), filtrezi după grup și după marcajul de toxicitate și deschizi o specie: numele ei (în limba paginii, cu engleza ca rezervă), marcajul și nota despre toxicitate, notele, sursa, speciile cu care e adesea confundată (fiecare o legătură), fotografiile și legăturile către sunete. O casetă roșie de siguranță rămâne vizibilă în fiecare filă și spune ce nu este pagina.',
      '§tab_packs§: pachetele incluse și cele pe care le imporți (lipești JSON-ul sau alegi un fișier; cel mult 12 odată), fiecare cu regiunea, versiunea, licența, autorii, o insignă sinceră de stare (§st_skeleton§, §st_draft§, §st_reviewed§) și numărul de specii pe grupe; descarci orice pachet sau le ștergi pe cele importate. Un pachet este verificat integral înainte de a fi adăugat: dacă ceva nu e în regulă, nu se importă nimic și vezi ce trebuie corectat.',
      '§tab_build§: faci un pachet pentru o clasă, un club de natură sau o regiune: completezi pachetul, adaugi specii pe rând (până la 400), legi sosiile în ambele sensuri, verifici pachetul cu aceleași reguli ca depozitul și descarci fișierul. Ciorna se păstrează în acest browser cât lucrezi. Un pachet făcut aici nu poate fi marcat ca revizuit; fotografiile și sunetele se adaugă prin JSON-ul speciei.',
      '§tab_guide§: cum se folosește pagina și un exemplu de specie cu o fotografie și un sunet.',
      'Format: un fișier JSON pe specie în `data/species/`, un manifest pe pachet în `data/packs/`, asamblate în pachete complete (format `vietar-pack`) în `data/dist/`; descrise de `schema.json` și `pack.schema.json` și explicate în `docs/pack-format.md`.',
      'Unelte pentru contribuitori: `scripts/pack.mjs` (asamblează pachetele și desparte în fișiere un pachet descărcat), `scripts/validate.py`, `scripts/optimize.py` (o fotografie în WebP de cel mult 640 px, fără metadate), `scripts/check_licences.mjs` (licențele fotografiilor, online cu `--online`). Interfața este în opt limbi și merge cu tastatura și cu un cititor de ecran.'
    ],
    how: [
      'Un fișier de specie și un manifest (lista id-urilor de specii și numărul lor) devin un pachet complet: `node scripts/pack.mjs` îl scrie în `data/dist/<id>.json`. Pagina încorporează `data/dist/`, deci ce răsfoiești este exact ce descarci.',
      '`schema.json` și `pack.schema.json` descriu fișierele; `scripts/validate.py` le aplică și verifică regulile pe care o schemă nu le poate spune: numele fișierului, id-ul și numele latinesc se potrivesc, grupul se potrivește cu regnul, plantele și ciupercile spun dacă sunt toxice, o specie toxică are notă despre toxicitate, sosiile se indică reciproc, fotografiile încap în 3 MB, un pachet revizuit își numește revizorul și data. `src/engine.mjs` aplică aceleași reguli în pagină; testele le compară.',
      'Sigură prin construcție: textul dintr-un pachet este mereu afișat ca text, niciodată ca HTML; legăturile deschid doar adrese `https://`; pagina nu face nicio cerere în rețea (fotografiile sunt încorporate, sunetele sunt legături care deschid xeno-canto.org într-o filă nouă); un pachet importat și starea salvată sunt verificate din nou la încărcarea paginii, deci unul deteriorat sau ostil este refuzat, nu i se acordă încredere.',
      '`src/ui.js`, `src/i18n.mjs` și `src/app.css` sunt interfața; `scripts/build.mjs` construiește singurul `index.html` din `src/` și încorporează pachetele din `data/dist/`; `node scripts/build.mjs --check` eșuează dacă pagina e depășită.',
      'Teste: `npm test` (motorul, paritatea cu validatorul, scripturile, verificatorul de licențe, optimizatorul de fotografii, documentația) și teste de browser în hub (opt limbi, accesibilitate, importuri ostile, limite, stocare plină). Dezvoltarea cere Node.js 24 sau mai nou și Python 3 cu `jsonschema` (Pillow doar pentru optimizatorul de fotografii); pagina însăși cere un browser care știe ES2017.'
    ],
    steps: [
      '1. Fă un fork al acestui depozit.',
      '2. Fă sau extinde un pachet: în pagină folosește fila §tab_build§ și descarcă fișierul, sau scrie de mână fișiere `data/species/<nume-latinesc>.json` (vezi `docs/pack-format.md`).',
      '3. Transformă un pachet descărcat în fișiere cu `node scripts/pack.mjs --split vietar-pack-<id>.json` sau treci id-urile noilor specii în manifestul pachetului din `data/packs/`.',
      '4. Rulează `node scripts/pack.mjs`, `python3 scripts/validate.py`, `npm test` și `node scripts/build.mjs`.',
      '5. Deschide un pull request — contribuțiile de date nu cer programare. Dă o sursă pentru fiecare nume, notă și marcaj de toxicitate și nu marca niciodată singur un pachet ca revizuit (vezi `docs/review-guide.md`).'
    ],
    firstRule: 'O specie = un fișier în `data/species/`, numit după id-ul ei (numele latinesc cu litere mici și cratime).',
    contribHeading: 'Adăugarea de specii și pachete',
    contrib: [
      '1. Pornește de la o sursă pe care ai voie s-o folosești: cunoștințele și observațiile tale sau pagini publice a căror licență permite reutilizarea (notează adresa și data). Nu copia text din ghiduri de teren, aplicații sau site-uri decât dacă licența o permite: scrie nota cu cuvintele tale și spune asta în `source`.',
      '2. Scrie un nume doar într-o limbă pe care o cunoști sau pe care o poți verifica cu un vorbitor nativ sau cu un dicționar de încredere. Engleza este obligatorie; pagina arată întâi limba cititorului și engleza ca rezervă.',
      '3. La plante și ciuperci `toxic` este obligatoriu. Scrie `true` când se știe că vreo parte a speciei este otrăvitoare și scrie o notă despre toxicitate care spune ce pericol există. `false` înseamnă doar că nimeni n-a marcat aici specia ca toxică: nu înseamnă niciodată comestibilă. La îndoială, întreabă un specialist local înainte să scrii `false`.',
      '4. Notează o pereche periculoasă de sosii pe ambele specii, cu o notă de avertizare de felul „Frunzele pot fi confundate; confuzia a provocat intoxicații grave”. Spune că se confundă, niciodată cum se deosebesc: un sfat greșit poate ucide.',
      '5. Fotografii: ale tale, din domeniul public sau cu o licență din lista din `docs/pack-format.md`, fiecare cu autorul, licența și o legătură către sursă; micșorează-le cu `python3 scripts/optimize.py` (WebP, cel mult 640 px, fără date despre loc) și verifică fotografiile din Wikimedia Commons cu `node scripts/check_licences.mjs --online`. Sunete: doar legături către xeno-canto.org pe care le-ai ascultat, cu autorul înregistrării și licența.',
      '6. Un pachet nou este `draft` (sau `skeleton`, când doar arată formatul). Doar un revizor care a verificat fiecare specie poate pune `reviewed`, cu numele lui și data: vezi `docs/review-guide.md`.',
      '7. Mai mult: `docs/contributor-guide.md` (comenzi, fișiere, verificări), `docs/school-class-guide.md` (o clasă sau un club face un pachet) și `docs/pack-format.md` (fiecare câmp și limită).'
    ],
    issues: [
      'Extinde `ro-mammals` la 30 de mamifere din Carpați, cu nume în en/ro/hu/de',
      'Extinde `ro-birds` la 50 de păsări comune din România',
      'Extinde `ro-plants-fungi` la 40 de plante sălbatice și ciuperci, fiecare cu marcaj de toxicitate și cu sosiile ei',
      'Extinde scheletul bulgar `bg-starter` la 20 de specii, cu nume verificate de un vorbitor de bulgară',
      'Extinde scheletul moldovenesc `md-starter` la 20 de specii, cu nume verificate de un vorbitor local',
      'Cere unui biolog sau micolog să revizuiască un pachet inclus și să consemneze revizuirea (vezi `docs/review-guide.md`)',
      'Adaugă fotografii reale cu licențele lor la speciile incluse (`scripts/optimize.py`, `scripts/check_licences.mjs --online`)',
      'Adaugă legături xeno-canto la păsări, fiecare verificată prin ascultare',
      'Cere vorbitorilor nativi să revizuiască traducerile interfeței (fr, it, es, pt, de, hu, ro)',
      'Fă aplicația VietAR să importe fișiere `vietar-pack` (o schimbare în depozitul VietAR)'
    ],
    added: [
      'Pagina: filele §tab_browse§, §tab_packs§, §tab_build§ și §tab_guide§ în opt limbi, cu o casetă roșie de siguranță mereu vizibilă, comenzi de la tastatură și suport pentru cititoare de ecran.',
      'Vizualizatorul: căutare în orice limbă (majusculele și diacriticele ignorate), filtre după grup și după marcajul de toxicitate, pagini de specii cu nume, marcaj și notă despre toxicitate, note, sursă, sosii (ca legături), fotografii și legături către sunete; §d_tox_no§ nu apare niciodată în verde și are mereu un avertisment.',
      'Pachete: import (lipit sau fișier, verificat integral înainte de a adăuga ceva), descărcare, ștergere și înlocuire după id; număr de specii pe grupe; insigne sincere de stare (§st_skeleton§, §st_draft§, §st_reviewed§) cu ce înseamnă fiecare.',
      'Creatorul: formular de pachet, formular de specie cu nume în mai multe limbi, marcaj și note de toxicitate, sosii legate în ambele sensuri, editor JSON pentru fotografii și sunete, verificare, descărcare și o ciornă păstrată în browser (cu avertisment când browserul nu mai are loc).',
      'Formatul pachetelor: `schema.json` (o specie), `pack.schema.json` (un manifest), pachete asamblate în `data/dist/` (format `vietar-pack`, versiunea 1) și `data/dist/example.json` ca exemplu de format.',
      'Cinci pachete de pornire incluse, cu 71 de specii: România (19 plante și ciuperci, 17 păsări, 15 mamifere) și schelete pentru Bulgaria și Moldova (aceleași 10 specii fiecare); ciorne scrise cu un asistent IA și verificate doar în parte, fără fotografii și fără legături către sunete.',
      '`scripts/pack.mjs` (asamblare, `--check`, `--split`), `scripts/validate.py` (aceleași reguli ca pagina, pentru fiecare fișier și fiecare pachet asamblat), `scripts/optimize.py` (fotografii) și `scripts/check_licences.mjs` (licența și autorul fotografiilor; `--online` întreabă Wikimedia Commons).',
      'Ghiduri în engleză și română: `docs/pack-format.md`, `docs/school-class-guide.md`, `docs/contributor-guide.md` și `docs/review-guide.md`.',
      '`src/` și `scripts/build.mjs`: singurul `index.html` se construiește acum din surse, cu pachetele din `data/dist/` încorporate, iar `--check` îl verifică.',
      'Teste: `npm test` și teste de browser în hub.'
    ],
    changed: [
      'Fluxul de lucru rulează pe Ubuntu 26.04 și Node.js 26 și rulează verificarea pachetelor, validatorul, testele și verificarea construcției.',
      'Datele sunt acum un fișier pe specie și un manifest pe pachet (`data/species/`, `data/packs/`), asamblate în `data/dist/`; `data/species/example.json` este înlocuit de `data/dist/example.json`, iar `scripts/validate.py`, pașii din README și șabloanele s-au schimbat odată cu el.',
      'Lista „good first issues” cuprinde acum ce mai e de făcut (mai multe specii, revizuire de specialiști, fotografii, sunete, traduceri); specificația formatului, câmpul de sosii, optimizatorul de fotografii, verificatorul de licențe și ghidul pentru clase, pe care le enumera înainte, există.'
    ]
  },
  fr: {
    status: 'Alpha, utilisable : l’unique `index.html` parcourt, importe, vérifie et crée des paquets régionaux d’espèces : noms en plusieurs langues, un indicateur de toxicité, des sosies dangereux, des photos sous licence et des liens vers des sons de xeno-canto. Il contient cinq paquets de départ intégrés, avec 71 espèces au total (Roumanie : 19 plantes et champignons, 17 oiseaux et 15 mammifères ; Bulgarie et Moldavie : les mêmes 10 espèces répandues chacune, en squelettes). Chaque paquet intégré est un brouillon ou un squelette : les noms et les notes ont été rédigés avec un assistant IA et vérifiés en partie seulement, aucun biologiste, mycologue ni locuteur natif ne les a relus, et ils ne contiennent encore ni photos ni liens vers des sons. La page n’identifie rien et n’est pas un guide de terrain : la mention §d_tox_no§ ne veut jamais dire qu’on peut manger ou toucher sans danger. L’application VietAR ne peut pas encore importer ces paquets.',
    does: [
      '§tab_browse§ : choisissez un paquet, cherchez par un nom dans n’importe quelle langue ou par le nom latin (majuscules et accents sans importance), filtrez par groupe et par indicateur de toxicité, puis ouvrez une espèce : ses noms (dans la langue de la page, avec l’anglais en repli), l’indicateur et la note de toxicité, les notes, la source, les espèces avec lesquelles on la confond souvent (chacune est un lien), les photos et les liens vers des sons. Un encadré rouge de sécurité reste visible dans chaque onglet et dit ce que la page n’est pas.',
      '§tab_packs§ : les paquets intégrés et ceux que vous importez (collez le JSON ou choisissez un fichier ; 12 au plus à la fois), chacun avec sa région, sa version, sa licence, ses auteurs, un badge d’état honnête (§st_skeleton§, §st_draft§, §st_reviewed§) et le nombre d’espèces par groupe ; téléchargez n’importe quel paquet ou supprimez ceux que vous avez importés. Un paquet est vérifié en entier avant d’être ajouté : si quelque chose cloche, rien n’est importé et vous voyez ce qu’il faut corriger.',
      '§tab_build§ : composez un paquet pour une classe, un club nature ou une région : remplissez le paquet, ajoutez les espèces une à une (jusqu’à 400), reliez les sosies dans les deux sens, vérifiez le paquet avec les mêmes règles que le dépôt et téléchargez le fichier. Le brouillon reste dans ce navigateur pendant que vous travaillez. Un paquet fait ici ne peut jamais être marqué comme relu ; les photos et les sons s’ajoutent par le JSON de l’espèce.',
      '§tab_guide§ : comment utiliser la page, et un exemple d’espèce avec une photo et un son.',
      'Format : un fichier JSON par espèce dans `data/species/`, un manifeste par paquet dans `data/packs/`, assemblés en paquets complets (format `vietar-pack`) dans `data/dist/` ; décrits par `schema.json` et `pack.schema.json` et expliqués dans `docs/pack-format.md`.',
      'Outils pour les contributeurs : `scripts/pack.mjs` (assemble les paquets et découpe en fichiers un paquet téléchargé), `scripts/validate.py`, `scripts/optimize.py` (une photo en WebP de 640 px au plus, sans métadonnées), `scripts/check_licences.mjs` (licences des photos, en ligne avec `--online`). L’interface existe en huit langues et se manie au clavier et avec un lecteur d’écran.'
    ],
    how: [
      'Un fichier d’espèce et un manifeste (la liste des identifiants d’espèces et leur nombre) deviennent un paquet complet : `node scripts/pack.mjs` l’écrit dans `data/dist/<id>.json`. La page embarque `data/dist/` : ce que vous parcourez est exactement ce que vous téléchargez.',
      '`schema.json` et `pack.schema.json` décrivent les fichiers ; `scripts/validate.py` les applique, avec les règles qu’un schéma ne peut pas dire : le nom du fichier, l’identifiant et le nom latin concordent, le groupe correspond au règne, les plantes et les champignons disent s’ils sont toxiques, une espèce toxique a une note de toxicité, les sosies se désignent mutuellement, les photos tiennent en 3 Mo, un paquet relu nomme son relecteur et la date. `src/engine.mjs` applique les mêmes règles dans la page ; les tests comparent les deux.',
      'Sûre par construction : le texte d’un paquet s’affiche toujours comme du texte, jamais comme du HTML ; les liens n’ouvrent que des adresses `https://` ; la page ne fait aucune requête réseau (les photos sont intégrées, les sons sont des liens qui ouvrent xeno-canto.org dans un nouvel onglet) ; un paquet importé et l’état enregistré sont revérifiés au chargement de la page, donc un état abîmé ou hostile est refusé, non cru.',
      '`src/ui.js`, `src/i18n.mjs` et `src/app.css` forment l’interface ; `scripts/build.mjs` construit l’unique `index.html` à partir de `src/` et embarque les paquets de `data/dist/` ; `node scripts/build.mjs --check` échoue si la page n’est plus à jour.',
      'Tests : `npm test` (moteur, parité avec le validateur, scripts, vérificateur de licences, optimiseur de photos, documentation) et tests de navigateur dans le hub (huit langues, accessibilité, imports hostiles, limites, stockage plein). Le développement demande Node.js 24 ou plus récent et Python 3 avec `jsonschema` (Pillow seulement pour l’optimiseur de photos) ; la page elle-même demande un navigateur qui connaît ES2017.'
    ],
    steps: [
      '1. Faites un fork de ce dépôt.',
      '2. Créez ou complétez un paquet : dans la page, utilisez l’onglet §tab_build§ et téléchargez le fichier, ou écrivez à la main des fichiers `data/species/<nom-latin>.json` (voir `docs/pack-format.md`).',
      '3. Transformez un paquet téléchargé en fichiers avec `node scripts/pack.mjs --split vietar-pack-<id>.json`, ou ajoutez les identifiants des nouvelles espèces au manifeste du paquet dans `data/packs/`.',
      '4. Lancez `node scripts/pack.mjs`, `python3 scripts/validate.py`, `npm test` et `node scripts/build.mjs`.',
      '5. Ouvrez une pull request — les contributions de données n’exigent pas de programmer. Donnez une source pour chaque nom, chaque note et chaque indicateur de toxicité, et ne marquez jamais vous-même un paquet comme relu (voir `docs/review-guide.md`).'
    ],
    firstRule: 'Une espèce = un fichier dans `data/species/`, nommé d’après son identifiant (le nom latin en minuscules avec des tirets).',
    contribHeading: 'Ajouter des espèces et des paquets',
    contrib: [
      '1. Partez d’une source que vous avez le droit d’utiliser : vos propres connaissances et observations, ou des pages publiques dont la licence autorise la réutilisation (notez l’adresse et la date). Ne copiez pas de texte de guides de terrain, d’applications ou de sites, sauf si la licence l’autorise : rédigez la note avec vos mots et dites-le dans `source`.',
      '2. N’écrivez un nom que dans une langue que vous connaissez ou que vous pouvez vérifier avec un locuteur natif ou un dictionnaire fiable. L’anglais est obligatoire ; la page montre d’abord la langue du lecteur et l’anglais en repli.',
      '3. Pour les plantes et les champignons, `toxic` est obligatoire. Écrivez `true` quand une partie de l’espèce est connue pour être vénéneuse, et rédigez une note de toxicité qui dit quel est le danger. `false` signifie seulement que personne n’a marqué l’espèce comme toxique ici : cela ne veut jamais dire comestible. Dans le doute, demandez à un spécialiste local avant d’écrire `false`.',
      '4. Indiquez une paire dangereuse de sosies sur les deux espèces, avec une note d’avertissement du genre « Les feuilles peuvent être confondues ; cette confusion a causé de graves intoxications ». Dites qu’elles se confondent, jamais comment les distinguer : un mauvais conseil peut tuer.',
      '5. Photos : les vôtres, du domaine public ou sous une licence de la liste de `docs/pack-format.md`, chacune avec son auteur, sa licence et un lien vers sa source ; réduisez-les avec `python3 scripts/optimize.py` (WebP, 640 px au plus, sans données de lieu) et vérifiez les photos de Wikimedia Commons avec `node scripts/check_licences.mjs --online`. Sons : uniquement des liens vers xeno-canto.org que vous avez écoutés, avec l’enregistreur et la licence.',
      '6. Un nouveau paquet est un `draft` (ou un `skeleton` quand il ne fait que montrer le format). Seul un relecteur qui a vérifié chaque espèce peut mettre `reviewed`, avec son nom et la date : voir `docs/review-guide.md`.',
      '7. Pour aller plus loin : `docs/contributor-guide.md` (commandes, fichiers, vérifications), `docs/school-class-guide.md` (une classe ou un club crée un paquet) et `docs/pack-format.md` (chaque champ et chaque limite).'
    ],
    issues: [
      'Porter `ro-mammals` à 30 mammifères des Carpates, avec des noms en en/ro/hu/de',
      'Porter `ro-birds` à 50 oiseaux communs de Roumanie',
      'Porter `ro-plants-fungi` à 40 plantes sauvages et champignons, chacun avec un indicateur de toxicité et ses sosies',
      'Porter le squelette bulgare `bg-starter` à 20 espèces, avec des noms vérifiés par un locuteur du bulgare',
      'Porter le squelette moldave `md-starter` à 20 espèces, avec des noms vérifiés par un locuteur local',
      'Faire relire un paquet intégré par un biologiste ou un mycologue et consigner la relecture (voir `docs/review-guide.md`)',
      'Ajouter de vraies photos avec leurs licences aux espèces intégrées (`scripts/optimize.py`, `scripts/check_licences.mjs --online`)',
      'Ajouter aux oiseaux des liens xeno-canto, chacun vérifié à l’écoute',
      'Faire relire les traductions de l’interface par des locuteurs natifs (fr, it, es, pt, de, hu, ro)',
      'Faire importer des fichiers `vietar-pack` par l’application VietAR (une modification dans le dépôt VietAR)'
    ],
    added: [
      'La page : les onglets §tab_browse§, §tab_packs§, §tab_build§ et §tab_guide§ en huit langues, avec un encadré rouge de sécurité toujours visible, des raccourcis clavier et la prise en charge des lecteurs d’écran.',
      'Le visualiseur : recherche dans n’importe quelle langue (majuscules et accents ignorés), filtres par groupe et par indicateur de toxicité, fiches d’espèces avec noms, indicateur et note de toxicité, notes, source, sosies (sous forme de liens), photos et liens vers des sons ; §d_tox_no§ n’apparaît jamais en vert et s’accompagne toujours d’un avertissement.',
      'Paquets : import (collé ou fichier, vérifié en entier avant tout ajout), téléchargement, suppression et remplacement par identifiant ; nombre d’espèces par groupe ; badges d’état honnêtes (§st_skeleton§, §st_draft§, §st_reviewed§) avec leur signification.',
      'Le créateur : un formulaire de paquet, un formulaire d’espèce avec noms en plusieurs langues, indicateur et notes de toxicité, sosies reliés dans les deux sens, un éditeur JSON pour les photos et les sons, une vérification, un téléchargement et un brouillon conservé dans le navigateur (avec un avertissement quand le navigateur manque de place).',
      'Le format des paquets : `schema.json` (une espèce), `pack.schema.json` (un manifeste), paquets assemblés dans `data/dist/` (format `vietar-pack`, version 1) et `data/dist/example.json` comme exemple de format.',
      'Cinq paquets de départ intégrés, avec 71 espèces : Roumanie (19 plantes et champignons, 17 oiseaux, 15 mammifères) et squelettes pour la Bulgarie et la Moldavie (les mêmes 10 espèces chacun) ; des brouillons rédigés avec un assistant IA et vérifiés en partie seulement, sans photos ni liens vers des sons.',
      '`scripts/pack.mjs` (assemblage, `--check`, `--split`), `scripts/validate.py` (les mêmes règles que la page, pour chaque fichier et chaque paquet assemblé), `scripts/optimize.py` (photos) et `scripts/check_licences.mjs` (licence et auteur des photos ; `--online` interroge Wikimedia Commons).',
      'Guides en anglais et en roumain : `docs/pack-format.md`, `docs/school-class-guide.md`, `docs/contributor-guide.md` et `docs/review-guide.md`.',
      '`src/` et `scripts/build.mjs` : l’unique `index.html` est désormais construit à partir des sources, avec les paquets de `data/dist/` embarqués, et `--check` le vérifie.',
      'Tests : `npm test` et tests de navigateur dans le hub.'
    ],
    changed: [
      'Le workflow tourne sur Ubuntu 26.04 et Node.js 26, et lance la vérification des paquets, le validateur, les tests et la vérification de la construction.',
      'Les données sont désormais un fichier par espèce et un manifeste par paquet (`data/species/`, `data/packs/`), assemblés dans `data/dist/` ; `data/species/example.json` est remplacé par `data/dist/example.json`, et `scripts/validate.py`, les étapes du README et les modèles ont changé en conséquence.',
      'La liste des « good first issues » contient maintenant ce qui reste à faire (plus d’espèces, relecture par des spécialistes, photos, sons, traductions) ; la spécification du format, le champ des sosies, l’optimiseur de photos, le vérificateur de licences et le guide pour les classes, qu’elle énumérait avant, existent.'
    ]
  },
  it: {
    status: 'Alfa, utilizzabile: l’unico `index.html` sfoglia, importa, controlla e crea pacchetti regionali di specie: nomi in più lingue, un indicatore di tossicità, sosia pericolosi, foto con licenza e link a suoni di xeno-canto. Contiene cinque pacchetti di partenza incorporati, con 71 specie in tutto (Romania: 19 piante e funghi, 17 uccelli e 15 mammiferi; Bulgaria e Moldavia: le stesse 10 specie diffuse ciascuna, come scheletri). Ogni pacchetto incorporato è una bozza o uno scheletro: nomi e note sono stati scritti con un assistente IA e controllati solo in parte, nessun biologo, micologo o madrelingua li ha rivisti, e non contengono ancora foto né link a suoni. La pagina non identifica nulla e non è una guida da campo: l’etichetta §d_tox_no§ non significa mai che sia sicuro mangiare o toccare. L’app VietAR non può ancora importare questi pacchetti.',
    does: [
      '§tab_browse§: scegli un pacchetto, cerca per un nome in qualsiasi lingua o per il nome latino (maiuscole e accenti non contano), filtra per gruppo e per indicatore di tossicità, e apri una specie: i suoi nomi (nella lingua della pagina, con l’inglese come ripiego), l’indicatore e la nota di tossicità, le note, la fonte, le specie con cui viene spesso confusa (ognuna è un link), le foto e i link ai suoni. Un riquadro rosso di sicurezza resta visibile in ogni scheda e dice che cosa la pagina non è.',
      '§tab_packs§: i pacchetti incorporati e quelli che importi (incolla il JSON o scegli un file; al massimo 12 alla volta), ciascuno con regione, versione, licenza, autori, un’etichetta di stato onesta (§st_skeleton§, §st_draft§, §st_reviewed§) e il numero di specie per gruppo; scarica qualsiasi pacchetto o rimuovi quelli importati. Un pacchetto viene controllato per intero prima di essere aggiunto: se qualcosa non va, non si importa nulla e vedi che cosa correggere.',
      '§tab_build§: crea un pacchetto per una classe, un club naturalistico o una regione: compila il pacchetto, aggiungi le specie una per una (fino a 400), collega i sosia nei due sensi, controlla il pacchetto con le stesse regole del repository e scarica il file. La bozza resta in questo browser mentre lavori. Un pacchetto fatto qui non può mai essere segnato come rivisto; foto e suoni si aggiungono tramite il JSON della specie.',
      '§tab_guide§: come usare la pagina e un esempio di specie con una foto e un suono.',
      'Formato: un file JSON per specie in `data/species/`, un manifesto per pacchetto in `data/packs/`, assemblati in pacchetti completi (formato `vietar-pack`) in `data/dist/`; descritti da `schema.json` e `pack.schema.json` e spiegati in `docs/pack-format.md`.',
      'Strumenti per chi contribuisce: `scripts/pack.mjs` (assembla i pacchetti e divide in file un pacchetto scaricato), `scripts/validate.py`, `scripts/optimize.py` (una foto in WebP di al massimo 640 px, senza metadati), `scripts/check_licences.mjs` (licenze delle foto, online con `--online`). L’interfaccia è in otto lingue e funziona con la tastiera e con uno screen reader.'
    ],
    how: [
      'Un file di specie e un manifesto (l’elenco degli id delle specie e il loro numero) diventano un pacchetto completo: `node scripts/pack.mjs` lo scrive in `data/dist/<id>.json`. La pagina incorpora `data/dist/`, quindi ciò che sfogli è esattamente ciò che scarichi.',
      '`schema.json` e `pack.schema.json` descrivono i file; `scripts/validate.py` li applica, insieme alle regole che uno schema non può dire: il nome del file, l’id e il nome latino coincidono, il gruppo è coerente con il regno, piante e funghi dicono se sono tossici, una specie tossica ha una nota di tossicità, i sosia si indicano a vicenda, le foto stanno entro 3 MB, un pacchetto rivisto indica chi l’ha rivisto e la data. `src/engine.mjs` applica le stesse regole nella pagina; i test confrontano le due implementazioni.',
      'Sicura per costruzione: il testo di un pacchetto è sempre mostrato come testo, mai come HTML; i link aprono solo indirizzi `https://`; la pagina non fa alcuna richiesta di rete (le foto sono incorporate, i suoni sono link che aprono xeno-canto.org in una nuova scheda); un pacchetto importato e lo stato salvato vengono ricontrollati al caricamento della pagina, quindi uno danneggiato o ostile viene rifiutato, non creduto.',
      '`src/ui.js`, `src/i18n.mjs` e `src/app.css` sono l’interfaccia; `scripts/build.mjs` costruisce l’unico `index.html` da `src/` e incorpora i pacchetti di `data/dist/`; `node scripts/build.mjs --check` fallisce se la pagina non è aggiornata.',
      'Test: `npm test` (motore, parità con il validatore, script, verifica delle licenze, ottimizzatore di foto, documentazione) e test del browser nell’hub (otto lingue, accessibilità, importazioni ostili, limiti, archivio pieno). Lo sviluppo richiede Node.js 24 o più recente e Python 3 con `jsonschema` (Pillow solo per l’ottimizzatore di foto); la pagina stessa richiede un browser che conosca ES2017.'
    ],
    steps: [
      '1. Fai un fork di questo repository.',
      '2. Crea o amplia un pacchetto: nella pagina usa la scheda §tab_build§ e scarica il file, oppure scrivi a mano file `data/species/<nome-latino>.json` (vedi `docs/pack-format.md`).',
      '3. Trasforma un pacchetto scaricato in file con `node scripts/pack.mjs --split vietar-pack-<id>.json`, oppure aggiungi gli id delle nuove specie al manifesto del pacchetto in `data/packs/`.',
      '4. Esegui `node scripts/pack.mjs`, `python3 scripts/validate.py`, `npm test` e `node scripts/build.mjs`.',
      '5. Apri una pull request — i contributi di dati non richiedono di programmare. Indica una fonte per ogni nome, nota e indicatore di tossicità, e non segnare mai da solo un pacchetto come rivisto (vedi `docs/review-guide.md`).'
    ],
    firstRule: 'Una specie = un file in `data/species/`, chiamato come il suo id (il nome latino in minuscolo con trattini).',
    contribHeading: 'Aggiungere specie e pacchetti',
    contrib: [
      '1. Parti da una fonte che puoi usare: le tue conoscenze e osservazioni, oppure pagine pubbliche la cui licenza consente il riuso (annota l’indirizzo e la data). Non copiare testo da guide da campo, app o siti se la licenza non lo permette: scrivi la nota con parole tue e dillo in `source`.',
      '2. Scrivi un nome solo in una lingua che conosci o che puoi controllare con un madrelingua o con un dizionario affidabile. L’inglese è obbligatorio; la pagina mostra prima la lingua di chi legge e l’inglese come ripiego.',
      '3. Per piante e funghi `toxic` è obbligatorio. Scrivi `true` quando si sa che una parte della specie è velenosa e scrivi una nota di tossicità che dica qual è il pericolo. `false` significa solo che nessuno ha segnato qui la specie come tossica: non significa mai commestibile. Nel dubbio, chiedi a un esperto locale prima di scrivere `false`.',
      '4. Indica una coppia pericolosa di sosia su entrambe le specie, con una nota di avvertimento del tipo «Le foglie possono essere confuse; la confusione ha causato gravi intossicazioni». Di’ che si confondono, mai come distinguerle: un consiglio sbagliato può uccidere.',
      '5. Foto: tue, di pubblico dominio o con una licenza dell’elenco in `docs/pack-format.md`, ciascuna con autore, licenza e un link alla fonte; riducile con `python3 scripts/optimize.py` (WebP, al massimo 640 px, senza dati di luogo) e controlla le foto di Wikimedia Commons con `node scripts/check_licences.mjs --online`. Suoni: solo link a xeno-canto.org che hai ascoltato, con l’autore della registrazione e la licenza.',
      '6. Un nuovo pacchetto è un `draft` (o uno `skeleton` quando mostra soltanto il formato). Solo chi ha controllato ogni specie può mettere `reviewed`, con il proprio nome e la data: vedi `docs/review-guide.md`.',
      '7. Per saperne di più: `docs/contributor-guide.md` (comandi, file, controlli), `docs/school-class-guide.md` (una classe o un club crea un pacchetto) e `docs/pack-format.md` (ogni campo e limite).'
    ],
    issues: [
      'Portare `ro-mammals` a 30 mammiferi dei Carpazi, con nomi in en/ro/hu/de',
      'Portare `ro-birds` a 50 uccelli comuni della Romania',
      'Portare `ro-plants-fungi` a 40 piante selvatiche e funghi, ciascuno con un indicatore di tossicità e i suoi sosia',
      'Portare lo scheletro bulgaro `bg-starter` a 20 specie, con nomi controllati da un madrelingua bulgaro',
      'Portare lo scheletro moldavo `md-starter` a 20 specie, con nomi controllati da un madrelingua locale',
      'Far rivedere un pacchetto incorporato a un biologo o a un micologo e registrare la revisione (vedi `docs/review-guide.md`)',
      'Aggiungere foto reali con le loro licenze alle specie incorporate (`scripts/optimize.py`, `scripts/check_licences.mjs --online`)',
      'Aggiungere agli uccelli link xeno-canto, ciascuno verificato all’ascolto',
      'Far rivedere le traduzioni dell’interfaccia a madrelingua (fr, it, es, pt, de, hu, ro)',
      'Far importare file `vietar-pack` all’app VietAR (una modifica nel repository VietAR)'
    ],
    added: [
      'La pagina: le schede §tab_browse§, §tab_packs§, §tab_build§ e §tab_guide§ in otto lingue, con un riquadro rosso di sicurezza sempre visibile, scorciatoie da tastiera e supporto per gli screen reader.',
      'Il visualizzatore: ricerca in qualsiasi lingua (maiuscole e accenti ignorati), filtri per gruppo e indicatore di tossicità, schede di specie con nomi, indicatore e nota di tossicità, note, fonte, sosia (come link), foto e link ai suoni; §d_tox_no§ non appare mai in verde e porta sempre un avvertimento.',
      'Pacchetti: importazione (incollata o da file, controllata per intero prima di aggiungere qualcosa), download, rimozione e sostituzione per id; numero di specie per gruppo; etichette di stato oneste (§st_skeleton§, §st_draft§, §st_reviewed§) con il loro significato.',
      'Il creatore: un modulo del pacchetto, un modulo della specie con nomi in più lingue, indicatore e note di tossicità, sosia collegati nei due sensi, un editor JSON per foto e suoni, un controllo, un download e una bozza conservata nel browser (con un avviso quando il browser non ha più spazio).',
      'Il formato dei pacchetti: `schema.json` (una specie), `pack.schema.json` (un manifesto), pacchetti assemblati in `data/dist/` (formato `vietar-pack`, versione 1) e `data/dist/example.json` come esempio di formato.',
      'Cinque pacchetti di partenza incorporati, con 71 specie: Romania (19 piante e funghi, 17 uccelli, 15 mammiferi) e scheletri per Bulgaria e Moldavia (le stesse 10 specie ciascuno); bozze scritte con un assistente IA e controllate solo in parte, senza foto né link a suoni.',
      '`scripts/pack.mjs` (assemblaggio, `--check`, `--split`), `scripts/validate.py` (le stesse regole della pagina, per ogni file e ogni pacchetto assemblato), `scripts/optimize.py` (foto) e `scripts/check_licences.mjs` (licenza e autore delle foto; `--online` interroga Wikimedia Commons).',
      'Guide in inglese e rumeno: `docs/pack-format.md`, `docs/school-class-guide.md`, `docs/contributor-guide.md` e `docs/review-guide.md`.',
      '`src/` e `scripts/build.mjs`: l’unico `index.html` ora si costruisce dai sorgenti, con i pacchetti di `data/dist/` incorporati, e `--check` lo verifica.',
      'Test: `npm test` e test del browser nell’hub.'
    ],
    changed: [
      'Il workflow gira su Ubuntu 26.04 e Node.js 26, ed esegue il controllo dei pacchetti, il validatore, i test e il controllo della costruzione.',
      'I dati sono ora un file per specie e un manifesto per pacchetto (`data/species/`, `data/packs/`), assemblati in `data/dist/`; `data/species/example.json` è sostituito da `data/dist/example.json`, e `scripts/validate.py`, i passi del README e i modelli sono cambiati di conseguenza.',
      'L’elenco dei «good first issues» contiene ora ciò che resta da fare (più specie, revisione di esperti, foto, suoni, traduzioni); la specifica del formato, il campo dei sosia, l’ottimizzatore di foto, il verificatore di licenze e la guida per le classi, che elencava prima, esistono.'
    ]
  },
  es: {
    status: 'Alfa, utilizable: el único `index.html` explora, importa, comprueba y crea paquetes regionales de especies: nombres en varios idiomas, un indicador de toxicidad, dobles peligrosos, fotos con licencia y enlaces a sonidos de xeno-canto. Incluye cinco paquetes de partida integrados, con 71 especies en total (Rumanía: 19 plantas y hongos, 17 aves y 15 mamíferos; Bulgaria y Moldavia: las mismas 10 especies comunes cada uno, como esqueletos). Cada paquete integrado es un borrador o un esqueleto: los nombres y las notas se escribieron con un asistente de IA y se comprobaron solo en parte, ningún biólogo, micólogo ni hablante nativo los ha revisado, y todavía no contienen fotos ni enlaces a sonidos. La página no identifica nada y no es una guía de campo: la etiqueta §d_tox_no§ nunca significa que sea seguro comerla o tocarla. La app VietAR todavía no puede importar estos paquetes.',
    does: [
      '§tab_browse§: elige un paquete, busca por un nombre en cualquier idioma o por el nombre latino (mayúsculas y tildes no importan), filtra por grupo y por indicador de toxicidad, y abre una especie: sus nombres (en el idioma de la página, con el inglés como respaldo), el indicador y la nota de toxicidad, las notas, la fuente, las especies con las que a menudo se confunde (cada una es un enlace), las fotos y los enlaces a sonidos. Un recuadro rojo de seguridad sigue visible en todas las pestañas y dice lo que la página no es.',
      '§tab_packs§: los paquetes integrados y los que importes (pega el JSON o elige un archivo; 12 como máximo a la vez), cada uno con su región, versión, licencia, autores, una insignia de estado sincera (§st_skeleton§, §st_draft§, §st_reviewed§) y el número de especies por grupo; descarga cualquier paquete o elimina los que importaste. Un paquete se comprueba por completo antes de añadirse: si algo falla, no se importa nada y ves qué corregir.',
      '§tab_build§: crea un paquete para una clase, un club de naturaleza o una región: rellena el paquete, añade las especies una a una (hasta 400), enlaza los dobles en los dos sentidos, comprueba el paquete con las mismas reglas que el repositorio y descarga el archivo. El borrador se guarda en este navegador mientras trabajas. Un paquete hecho aquí nunca puede marcarse como revisado; las fotos y los sonidos se añaden mediante el JSON de la especie.',
      '§tab_guide§: cómo usar la página y un ejemplo de especie con una foto y un sonido.',
      'Formato: un archivo JSON por especie en `data/species/`, un manifiesto por paquete en `data/packs/`, ensamblados en paquetes completos (formato `vietar-pack`) en `data/dist/`; descritos por `schema.json` y `pack.schema.json` y explicados en `docs/pack-format.md`.',
      'Herramientas para quienes contribuyen: `scripts/pack.mjs` (ensambla los paquetes y divide en archivos un paquete descargado), `scripts/validate.py`, `scripts/optimize.py` (una foto en WebP de 640 px como máximo, sin metadatos), `scripts/check_licences.mjs` (licencias de las fotos, en línea con `--online`). La interfaz está en ocho idiomas y funciona con el teclado y con un lector de pantalla.'
    ],
    how: [
      'Un archivo de especie y un manifiesto (la lista de ids de especies y su número) se convierten en un paquete completo: `node scripts/pack.mjs` lo escribe en `data/dist/<id>.json`. La página incorpora `data/dist/`, así que lo que exploras es exactamente lo que descargas.',
      '`schema.json` y `pack.schema.json` describen los archivos; `scripts/validate.py` los aplica, junto con las reglas que un esquema no puede decir: el nombre del archivo, el id y el nombre latino coinciden, el grupo encaja con el reino, las plantas y los hongos dicen si son tóxicos, una especie tóxica tiene una nota de toxicidad, los dobles se señalan mutuamente, las fotos caben en 3 MB, un paquete revisado nombra al revisor y la fecha. `src/engine.mjs` aplica las mismas reglas en la página; las pruebas comparan ambas.',
      'Segura por construcción: el texto de un paquete se muestra siempre como texto, nunca como HTML; los enlaces solo abren direcciones `https://`; la página no hace ninguna petición de red (las fotos van incorporadas, los sonidos son enlaces que abren xeno-canto.org en una pestaña nueva); un paquete importado y el estado guardado se vuelven a comprobar al cargar la página, de modo que uno dañado u hostil se rechaza, no se da por bueno.',
      '`src/ui.js`, `src/i18n.mjs` y `src/app.css` son la interfaz; `scripts/build.mjs` construye el único `index.html` desde `src/` e incorpora los paquetes de `data/dist/`; `node scripts/build.mjs --check` falla si la página está desactualizada.',
      'Pruebas: `npm test` (motor, paridad con el validador, scripts, verificador de licencias, optimizador de fotos, documentación) y pruebas de navegador en el hub (ocho idiomas, accesibilidad, importaciones hostiles, límites, almacenamiento lleno). El desarrollo requiere Node.js 24 o más reciente y Python 3 con `jsonschema` (Pillow solo para el optimizador de fotos); la página en sí requiere un navegador que conozca ES2017.'
    ],
    steps: [
      '1. Haz un fork de este repositorio.',
      '2. Crea o amplía un paquete: en la página usa la pestaña §tab_build§ y descarga el archivo, o escribe a mano archivos `data/species/<nombre-latino>.json` (consulta `docs/pack-format.md`).',
      '3. Convierte un paquete descargado en archivos con `node scripts/pack.mjs --split vietar-pack-<id>.json`, o añade los ids de las nuevas especies al manifiesto del paquete en `data/packs/`.',
      '4. Ejecuta `node scripts/pack.mjs`, `python3 scripts/validate.py`, `npm test` y `node scripts/build.mjs`.',
      '5. Abre un pull request — las contribuciones de datos no requieren programar. Indica una fuente para cada nombre, nota e indicador de toxicidad, y nunca marques tú mismo un paquete como revisado (consulta `docs/review-guide.md`).'
    ],
    firstRule: 'Una especie = un archivo en `data/species/`, con el nombre de su id (el nombre latino en minúsculas con guiones).',
    contribHeading: 'Añadir especies y paquetes',
    contrib: [
      '1. Parte de una fuente que puedas usar: tus propios conocimientos y observaciones, o páginas públicas cuya licencia permita la reutilización (anota la dirección y la fecha). No copies texto de guías de campo, apps o sitios web salvo que la licencia lo permita: escribe la nota con tus palabras y dilo en `source`.',
      '2. Escribe un nombre solo en un idioma que conozcas o que puedas comprobar con un hablante nativo o con un diccionario fiable. El inglés es obligatorio; la página muestra primero el idioma de quien lee y el inglés como respaldo.',
      '3. En plantas y hongos `toxic` es obligatorio. Escribe `true` cuando se sepa que alguna parte de la especie es venenosa, y escribe una nota de toxicidad que diga cuál es el peligro. `false` solo significa que nadie ha marcado aquí la especie como tóxica: nunca significa comestible. Ante la duda, pregunta a un experto local antes de escribir `false`.',
      '4. Anota una pareja peligrosa de dobles en ambas especies, con una nota de advertencia del tipo «Las hojas pueden confundirse; la confusión ha causado intoxicaciones graves». Di que se confunden, nunca cómo distinguirlas: un consejo equivocado puede matar.',
      '5. Fotos: tuyas, de dominio público o con una licencia de la lista de `docs/pack-format.md`, cada una con su autor, su licencia y un enlace a la fuente; redúcelas con `python3 scripts/optimize.py` (WebP, 640 px como máximo, sin datos de lugar) y comprueba las fotos de Wikimedia Commons con `node scripts/check_licences.mjs --online`. Sonidos: solo enlaces a xeno-canto.org que hayas escuchado, con el autor de la grabación y la licencia.',
      '6. Un paquete nuevo es un `draft` (o un `skeleton` cuando solo muestra el formato). Solo un revisor que haya comprobado cada especie puede poner `reviewed`, con su nombre y la fecha: consulta `docs/review-guide.md`.',
      '7. Más información: `docs/contributor-guide.md` (comandos, archivos, comprobaciones), `docs/school-class-guide.md` (una clase o un club crea un paquete) y `docs/pack-format.md` (cada campo y límite).'
    ],
    issues: [
      'Ampliar `ro-mammals` a 30 mamíferos de los Cárpatos, con nombres en en/ro/hu/de',
      'Ampliar `ro-birds` a 50 aves comunes de Rumanía',
      'Ampliar `ro-plants-fungi` a 40 plantas silvestres y hongos, cada uno con un indicador de toxicidad y sus dobles',
      'Ampliar el esqueleto búlgaro `bg-starter` a 20 especies, con nombres comprobados por un hablante de búlgaro',
      'Ampliar el esqueleto moldavo `md-starter` a 20 especies, con nombres comprobados por un hablante local',
      'Pedir a un biólogo o micólogo que revise un paquete integrado y que deje constancia (consulta `docs/review-guide.md`)',
      'Añadir fotos reales con sus licencias a las especies integradas (`scripts/optimize.py`, `scripts/check_licences.mjs --online`)',
      'Añadir a las aves enlaces de xeno-canto, cada uno comprobado escuchándolo',
      'Pedir a hablantes nativos que revisen las traducciones de la interfaz (fr, it, es, pt, de, hu, ro)',
      'Hacer que la app VietAR importe archivos `vietar-pack` (un cambio en el repositorio de VietAR)'
    ],
    added: [
      'La página: las pestañas §tab_browse§, §tab_packs§, §tab_build§ y §tab_guide§ en ocho idiomas, con un recuadro rojo de seguridad siempre visible, atajos de teclado y compatibilidad con lectores de pantalla.',
      'El visor: búsqueda en cualquier idioma (mayúsculas y tildes ignoradas), filtros por grupo y por indicador de toxicidad, fichas de especies con nombres, indicador y nota de toxicidad, notas, fuente, dobles (como enlaces), fotos y enlaces a sonidos; §d_tox_no§ no aparece nunca en verde y lleva siempre una advertencia.',
      'Paquetes: importación (pegada o desde un archivo, comprobada por completo antes de añadir nada), descarga, eliminación y sustitución por id; número de especies por grupo; insignias de estado sinceras (§st_skeleton§, §st_draft§, §st_reviewed§) con lo que significa cada una.',
      'El creador: un formulario de paquete, un formulario de especie con nombres en varios idiomas, indicador y notas de toxicidad, dobles enlazados en los dos sentidos, un editor JSON para fotos y sonidos, una comprobación, una descarga y un borrador guardado en el navegador (con un aviso cuando el navegador se queda sin espacio).',
      'El formato de los paquetes: `schema.json` (una especie), `pack.schema.json` (un manifiesto), paquetes ensamblados en `data/dist/` (formato `vietar-pack`, versión 1) y `data/dist/example.json` como ejemplo de formato.',
      'Cinco paquetes de partida integrados, con 71 especies: Rumanía (19 plantas y hongos, 17 aves, 15 mamíferos) y esqueletos para Bulgaria y Moldavia (las mismas 10 especies cada uno); borradores escritos con un asistente de IA y comprobados solo en parte, sin fotos ni enlaces a sonidos.',
      '`scripts/pack.mjs` (ensamblado, `--check`, `--split`), `scripts/validate.py` (las mismas reglas que la página, para cada archivo y cada paquete ensamblado), `scripts/optimize.py` (fotos) y `scripts/check_licences.mjs` (licencia y autor de las fotos; `--online` consulta Wikimedia Commons).',
      'Guías en inglés y rumano: `docs/pack-format.md`, `docs/school-class-guide.md`, `docs/contributor-guide.md` y `docs/review-guide.md`.',
      '`src/` y `scripts/build.mjs`: el único `index.html` se construye ahora desde las fuentes, con los paquetes de `data/dist/` incorporados, y `--check` lo verifica.',
      'Pruebas: `npm test` y pruebas de navegador en el hub.'
    ],
    changed: [
      'El workflow se ejecuta en Ubuntu 26.04 y Node.js 26, y ejecuta la comprobación de los paquetes, el validador, las pruebas y la comprobación de la construcción.',
      'Los datos son ahora un archivo por especie y un manifiesto por paquete (`data/species/`, `data/packs/`), ensamblados en `data/dist/`; `data/species/example.json` se sustituye por `data/dist/example.json`, y `scripts/validate.py`, los pasos del README y las plantillas cambiaron con ello.',
      'La lista de «good first issues» contiene ahora lo que queda por hacer (más especies, revisión de expertos, fotos, sonidos, traducciones); la especificación del formato, el campo de dobles, el optimizador de fotos, el verificador de licencias y la guía para clases, que enumeraba antes, existen.'
    ]
  },
  pt: {
    status: 'Alfa, utilizável: o único `index.html` explora, importa, verifica e cria pacotes regionais de espécies: nomes em vários idiomas, um indicador de toxicidade, sósias perigosos, fotos com licença e ligações a sons do xeno-canto. Inclui cinco pacotes de arranque integrados, com 71 espécies no total (Roménia: 19 plantas e fungos, 17 aves e 15 mamíferos; Bulgária e Moldávia: as mesmas 10 espécies comuns cada uma, como esqueletos). Cada pacote integrado é um rascunho ou um esqueleto: os nomes e as notas foram escritos com um assistente de IA e verificados só em parte, nenhum biólogo, micologista ou falante nativo os reviu, e ainda não têm fotos nem ligações a sons. A página não identifica nada e não é um guia de campo: a etiqueta §d_tox_no§ nunca significa que seja seguro comer ou tocar. A aplicação VietAR ainda não consegue importar estes pacotes.',
    does: [
      '§tab_browse§: escolha um pacote, pesquise por um nome em qualquer língua ou pelo nome latino (maiúsculas e acentos não contam), filtre por grupo e por indicador de toxicidade, e abra uma espécie: os seus nomes (na língua da página, com o inglês como alternativa), o indicador e a nota de toxicidade, as notas, a fonte, as espécies com que é muitas vezes confundida (cada uma é uma ligação), as fotos e as ligações a sons. Uma caixa vermelha de segurança fica visível em todos os separadores e diz o que a página não é.',
      '§tab_packs§: os pacotes integrados e os que importar (cole o JSON ou escolha um ficheiro; no máximo 12 de cada vez), cada um com a sua região, versão, licença, autores, um distintivo de estado sincero (§st_skeleton§, §st_draft§, §st_reviewed§) e o número de espécies por grupo; descarregue qualquer pacote ou remova os que importou. Um pacote é verificado por inteiro antes de ser adicionado: se algo estiver errado, nada é importado e vê o que corrigir.',
      '§tab_build§: crie um pacote para uma turma, um clube de natureza ou uma região: preencha o pacote, adicione as espécies uma a uma (até 400), ligue os sósias nos dois sentidos, verifique o pacote com as mesmas regras do repositório e descarregue o ficheiro. O rascunho é guardado neste navegador enquanto trabalha. Um pacote feito aqui nunca pode ser marcado como revisto; as fotos e os sons acrescentam-se através do JSON da espécie.',
      '§tab_guide§: como usar a página e um exemplo de espécie com uma foto e um som.',
      'Formato: um ficheiro JSON por espécie em `data/species/`, um manifesto por pacote em `data/packs/`, montados em pacotes completos (formato `vietar-pack`) em `data/dist/`; descritos por `schema.json` e `pack.schema.json` e explicados em `docs/pack-format.md`.',
      'Ferramentas para quem contribui: `scripts/pack.mjs` (monta os pacotes e divide em ficheiros um pacote descarregado), `scripts/validate.py`, `scripts/optimize.py` (uma foto em WebP de 640 px no máximo, sem metadados), `scripts/check_licences.mjs` (licenças das fotos, online com `--online`). A interface está em oito línguas e funciona com o teclado e com um leitor de ecrã.'
    ],
    how: [
      'Um ficheiro de espécie e um manifesto (a lista dos ids das espécies e o seu número) tornam-se um pacote completo: `node scripts/pack.mjs` escreve-o em `data/dist/<id>.json`. A página incorpora `data/dist/`, por isso o que explora é exatamente o que descarrega.',
      '`schema.json` e `pack.schema.json` descrevem os ficheiros; `scripts/validate.py` aplica-os, com as regras que um esquema não consegue dizer: o nome do ficheiro, o id e o nome latino coincidem, o grupo é compatível com o reino, as plantas e os fungos dizem se são tóxicos, uma espécie tóxica tem uma nota de toxicidade, os sósias apontam um para o outro, as fotos cabem em 3 MB, um pacote revisto indica o revisor e a data. `src/engine.mjs` aplica as mesmas regras na página; os testes comparam as duas.',
      'Segura por construção: o texto de um pacote é sempre mostrado como texto, nunca como HTML; as ligações só abrem endereços `https://`; a página não faz nenhum pedido de rede (as fotos vão incorporadas, os sons são ligações que abrem xeno-canto.org num novo separador); um pacote importado e o estado guardado são verificados de novo ao carregar a página, por isso um estado danificado ou hostil é recusado, não aceite como bom.',
      '`src/ui.js`, `src/i18n.mjs` e `src/app.css` são a interface; `scripts/build.mjs` constrói o único `index.html` a partir de `src/` e incorpora os pacotes de `data/dist/`; `node scripts/build.mjs --check` falha se a página estiver desatualizada.',
      'Testes: `npm test` (motor, paridade com o validador, scripts, verificador de licenças, otimizador de fotos, documentação) e testes de navegador no hub (oito línguas, acessibilidade, importações hostis, limites, armazenamento cheio). O desenvolvimento exige Node.js 24 ou mais recente e Python 3 com `jsonschema` (Pillow só para o otimizador de fotos); a própria página exige um navegador que conheça ES2017.'
    ],
    steps: [
      '1. Faça um fork deste repositório.',
      '2. Crie ou alargue um pacote: na página use o separador §tab_build§ e descarregue o ficheiro, ou escreva à mão ficheiros `data/species/<nome-latino>.json` (veja `docs/pack-format.md`).',
      '3. Transforme um pacote descarregado em ficheiros com `node scripts/pack.mjs --split vietar-pack-<id>.json`, ou acrescente os ids das novas espécies ao manifesto do pacote em `data/packs/`.',
      '4. Execute `node scripts/pack.mjs`, `python3 scripts/validate.py`, `npm test` e `node scripts/build.mjs`.',
      '5. Abra um pull request — as contribuições de dados não exigem programar. Indique uma fonte para cada nome, nota e indicador de toxicidade, e nunca marque você mesmo um pacote como revisto (veja `docs/review-guide.md`).'
    ],
    firstRule: 'Uma espécie = um ficheiro em `data/species/`, com o nome do seu id (o nome latino em minúsculas com hífenes).',
    contribHeading: 'Acrescentar espécies e pacotes',
    contrib: [
      '1. Parta de uma fonte que possa usar: os seus próprios conhecimentos e observações, ou páginas públicas cuja licença permita a reutilização (anote o endereço e a data). Não copie texto de guias de campo, aplicações ou sítios web, a menos que a licença o permita: escreva a nota com as suas palavras e diga-o em `source`.',
      '2. Escreva um nome apenas numa língua que conheça ou que possa verificar com um falante nativo ou com um dicionário fiável. O inglês é obrigatório; a página mostra primeiro a língua de quem lê e o inglês como alternativa.',
      '3. Em plantas e fungos `toxic` é obrigatório. Escreva `true` quando se sabe que alguma parte da espécie é venenosa, e escreva uma nota de toxicidade que diga qual é o perigo. `false` significa apenas que ninguém marcou aqui a espécie como tóxica: nunca significa comestível. Em caso de dúvida, pergunte a um especialista local antes de escrever `false`.',
      '4. Registe um par perigoso de sósias nas duas espécies, com uma nota de aviso do género «As folhas podem ser confundidas; a confusão já causou intoxicações graves». Diga que se confundem, nunca como distingui-las: um conselho errado pode matar.',
      '5. Fotos: suas, de domínio público ou com uma licença da lista de `docs/pack-format.md`, cada uma com o seu autor, a licença e uma ligação à fonte; reduza-as com `python3 scripts/optimize.py` (WebP, 640 px no máximo, sem dados de local) e verifique as fotos da Wikimedia Commons com `node scripts/check_licences.mjs --online`. Sons: apenas ligações a xeno-canto.org que tenha ouvido, com o autor da gravação e a licença.',
      '6. Um pacote novo é um `draft` (ou um `skeleton` quando apenas mostra o formato). Só um revisor que tenha verificado cada espécie pode pôr `reviewed`, com o seu nome e a data: veja `docs/review-guide.md`.',
      '7. Mais informação: `docs/contributor-guide.md` (comandos, ficheiros, verificações), `docs/school-class-guide.md` (uma turma ou um clube cria um pacote) e `docs/pack-format.md` (cada campo e limite).'
    ],
    issues: [
      'Alargar `ro-mammals` a 30 mamíferos dos Cárpatos, com nomes em en/ro/hu/de',
      'Alargar `ro-birds` a 50 aves comuns da Roménia',
      'Alargar `ro-plants-fungi` a 40 plantas silvestres e fungos, cada um com um indicador de toxicidade e os seus sósias',
      'Alargar o esqueleto búlgaro `bg-starter` a 20 espécies, com nomes verificados por um falante de búlgaro',
      'Alargar o esqueleto moldavo `md-starter` a 20 espécies, com nomes verificados por um falante local',
      'Pedir a um biólogo ou micologista que reveja um pacote integrado e que registe a revisão (veja `docs/review-guide.md`)',
      'Acrescentar fotos reais com as suas licenças às espécies integradas (`scripts/optimize.py`, `scripts/check_licences.mjs --online`)',
      'Acrescentar às aves ligações do xeno-canto, cada uma verificada a ouvir',
      'Pedir a falantes nativos que revejam as traduções da interface (fr, it, es, pt, de, hu, ro)',
      'Fazer a aplicação VietAR importar ficheiros `vietar-pack` (uma alteração no repositório VietAR)'
    ],
    added: [
      'A página: os separadores §tab_browse§, §tab_packs§, §tab_build§ e §tab_guide§ em oito línguas, com uma caixa vermelha de segurança sempre visível, atalhos de teclado e suporte para leitores de ecrã.',
      'O visualizador: pesquisa em qualquer língua (maiúsculas e acentos ignorados), filtros por grupo e por indicador de toxicidade, fichas de espécies com nomes, indicador e nota de toxicidade, notas, fonte, sósias (como ligações), fotos e ligações a sons; §d_tox_no§ nunca aparece a verde e traz sempre um aviso.',
      'Pacotes: importação (colada ou de um ficheiro, verificada por inteiro antes de acrescentar o que quer que seja), descarga, remoção e substituição por id; número de espécies por grupo; distintivos de estado sinceros (§st_skeleton§, §st_draft§, §st_reviewed§) com o significado de cada um.',
      'O criador: um formulário de pacote, um formulário de espécie com nomes em várias línguas, indicador e notas de toxicidade, sósias ligados nos dois sentidos, um editor de JSON para fotos e sons, uma verificação, uma descarga e um rascunho guardado no navegador (com um aviso quando o navegador fica sem espaço).',
      'O formato dos pacotes: `schema.json` (uma espécie), `pack.schema.json` (um manifesto), pacotes montados em `data/dist/` (formato `vietar-pack`, versão 1) e `data/dist/example.json` como exemplo de formato.',
      'Cinco pacotes de arranque integrados, com 71 espécies: Roménia (19 plantas e fungos, 17 aves, 15 mamíferos) e esqueletos para a Bulgária e a Moldávia (as mesmas 10 espécies cada um); rascunhos escritos com um assistente de IA e verificados só em parte, sem fotos nem ligações a sons.',
      '`scripts/pack.mjs` (montagem, `--check`, `--split`), `scripts/validate.py` (as mesmas regras da página, para cada ficheiro e cada pacote montado), `scripts/optimize.py` (fotos) e `scripts/check_licences.mjs` (licença e autor das fotos; `--online` consulta a Wikimedia Commons).',
      'Guias em inglês e romeno: `docs/pack-format.md`, `docs/school-class-guide.md`, `docs/contributor-guide.md` e `docs/review-guide.md`.',
      '`src/` e `scripts/build.mjs`: o único `index.html` é agora construído a partir das fontes, com os pacotes de `data/dist/` incorporados, e `--check` verifica-o.',
      'Testes: `npm test` e testes de navegador no hub.'
    ],
    changed: [
      'O workflow corre em Ubuntu 26.04 e Node.js 26, e executa a verificação dos pacotes, o validador, os testes e a verificação da construção.',
      'Os dados são agora um ficheiro por espécie e um manifesto por pacote (`data/species/`, `data/packs/`), montados em `data/dist/`; `data/species/example.json` é substituído por `data/dist/example.json`, e `scripts/validate.py`, os passos do README e os modelos mudaram em conformidade.',
      'A lista de «good first issues» contém agora o que ainda falta fazer (mais espécies, revisão por especialistas, fotos, sons, traduções); a especificação do formato, o campo de sósias, o otimizador de fotos, o verificador de licenças e o guia para turmas, que antes enumerava, existem.'
    ]
  },
  de: {
    status: 'Alpha, nutzbar: die einzige `index.html` durchstöbert, importiert, prüft und erstellt regionale Artenpakete: Namen in mehreren Sprachen, eine Giftigkeitsangabe, gefährliche Doppelgänger, Fotos mit Lizenz und Links zu Lauten von xeno-canto. Sie enthält fünf eingebaute Startpakete mit insgesamt 71 Arten (Rumänien: 19 Pflanzen und Pilze, 17 Vögel und 15 Säugetiere; Bulgarien und Moldau: je dieselben 10 verbreiteten Arten, als Gerüste). Jedes eingebaute Paket ist ein Entwurf oder ein Gerüst: Namen und Hinweise wurden mit einem KI-Assistenten geschrieben und nur teilweise geprüft, weder Fachleute für Biologie oder Pilzkunde noch Muttersprachler haben sie durchgesehen, und sie enthalten noch keine Fotos und keine Links zu Lauten. Die Seite bestimmt keine Arten und ist kein Bestimmungsbuch: die Angabe §d_tox_no§ heißt nie, dass man etwas gefahrlos essen oder berühren kann. Die VietAR-App kann diese Pakete noch nicht importieren.',
    does: [
      '§tab_browse§: Wähle ein Paket, suche nach einem Namen in einer beliebigen Sprache oder nach dem lateinischen Namen (Groß- und Kleinschreibung und Akzente spielen keine Rolle), filtere nach Gruppe und Giftigkeitsangabe und öffne eine Art: ihre Namen (in der Sprache der Seite, mit Englisch als Rückfall), Giftigkeitsangabe und -hinweis, Hinweise, Quelle, die Arten, mit denen sie oft verwechselt wird (jede ein Link), Fotos und Links zu Lauten. Ein roter Sicherheitskasten bleibt in jedem Reiter sichtbar und sagt, was die Seite nicht ist.',
      '§tab_packs§: die eingebauten Pakete und die, die du importierst (JSON einfügen oder eine Datei wählen; höchstens 12 auf einmal), jedes mit Region, Version, Lizenz, Urhebern, einem ehrlichen Statusabzeichen (§st_skeleton§, §st_draft§, §st_reviewed§) und der Artenzahl je Gruppe; lade jedes Paket herunter oder entferne die importierten. Ein Paket wird vollständig geprüft, bevor es hinzugefügt wird: Stimmt etwas nicht, wird nichts importiert und du siehst, was zu korrigieren ist.',
      '§tab_build§: Erstelle ein Paket für eine Schulklasse, einen Naturverein oder eine Region: Fülle das Paket aus, füge die Arten einzeln hinzu (bis zu 400), verknüpfe Doppelgänger in beide Richtungen, prüfe das Paket mit denselben Regeln wie das Repository und lade die Datei herunter. Der Entwurf bleibt in diesem Browser, während du arbeitest. Ein hier erstelltes Paket kann nie als geprüft markiert werden; Fotos und Laute kommen über das JSON der Art dazu.',
      '§tab_guide§: wie man die Seite benutzt, und ein Beispiel für eine Art mit einem Foto und einem Laut.',
      'Format: eine JSON-Datei je Art in `data/species/`, ein Manifest je Paket in `data/packs/`, zusammengesetzt zu vollständigen Paketen (Format `vietar-pack`) in `data/dist/`; beschrieben durch `schema.json` und `pack.schema.json` und erklärt in `docs/pack-format.md`.',
      'Werkzeuge für Mitwirkende: `scripts/pack.mjs` (baut die Pakete und zerlegt ein heruntergeladenes in Dateien), `scripts/validate.py`, `scripts/optimize.py` (ein Foto als WebP von höchstens 640 px, ohne Metadaten), `scripts/check_licences.mjs` (Fotolizenzen, online mit `--online`). Die Oberfläche gibt es in acht Sprachen; sie lässt sich mit der Tastatur und mit einem Screenreader bedienen.'
    ],
    how: [
      'Eine Artendatei und ein Manifest (die Liste der Art-IDs und ihre Anzahl) werden zu einem vollständigen Paket: `node scripts/pack.mjs` schreibt es nach `data/dist/<id>.json`. Die Seite bettet `data/dist/` ein; was du durchstöberst, ist also genau das, was du herunterlädst.',
      '`schema.json` und `pack.schema.json` beschreiben die Dateien; `scripts/validate.py` wendet sie an, dazu die Regeln, die ein Schema nicht ausdrücken kann: Dateiname, ID und lateinischer Name stimmen überein, die Gruppe passt zum Reich, Pflanzen und Pilze geben an, ob sie giftig sind, eine giftige Art hat einen Giftigkeitshinweis, Doppelgänger verweisen aufeinander, Fotos bleiben unter 3 MB, ein geprüftes Paket nennt Prüfer und Datum. `src/engine.mjs` wendet dieselben Regeln in der Seite an; die Tests vergleichen beide.',
      'Sicher von Grund auf: Text aus einem Paket wird immer als Text angezeigt, nie als HTML; Links öffnen nur `https://`-Adressen; die Seite stellt keine Netzwerkanfrage (Fotos sind eingebettet, Laute sind Links, die xeno-canto.org in einem neuen Tab öffnen); ein importiertes Paket und der gespeicherte Zustand werden beim Laden der Seite erneut geprüft, ein beschädigter oder feindlicher wird also abgelehnt, nicht für wahr gehalten.',
      '`src/ui.js`, `src/i18n.mjs` und `src/app.css` sind die Oberfläche; `scripts/build.mjs` baut die einzige `index.html` aus `src/` und bettet die Pakete aus `data/dist/` ein; `node scripts/build.mjs --check` schlägt fehl, wenn die Seite veraltet ist.',
      'Tests: `npm test` (Engine, Parität mit dem Validator, Skripte, Lizenzprüfer, Foto-Optimierer, Dokumentation) und Browser-Tests im Hub (acht Sprachen, Barrierefreiheit, feindliche Importe, Grenzen, voller Speicher). Die Entwicklung braucht Node.js 24 oder neuer und Python 3 mit `jsonschema` (Pillow nur für den Foto-Optimierer); die Seite selbst braucht einen Browser, der ES2017 kennt.'
    ],
    steps: [
      '1. Forke dieses Repository.',
      '2. Erstelle oder erweitere ein Paket: Nutze auf der Seite den Reiter §tab_build§ und lade die Datei herunter, oder schreibe Dateien `data/species/<lateinischer-name>.json` von Hand (siehe `docs/pack-format.md`).',
      '3. Mache aus einem heruntergeladenen Paket Dateien mit `node scripts/pack.mjs --split vietar-pack-<id>.json`, oder trage die IDs der neuen Arten in das Manifest des Pakets in `data/packs/` ein.',
      '4. Führe `node scripts/pack.mjs`, `python3 scripts/validate.py`, `npm test` und `node scripts/build.mjs` aus.',
      '5. Öffne einen Pull Request — Datenbeiträge brauchen keine Programmierung. Gib für jeden Namen, Hinweis und jede Giftigkeitsangabe eine Quelle an und markiere ein Paket nie selbst als geprüft (siehe `docs/review-guide.md`).'
    ],
    firstRule: 'Eine Art = eine Datei in `data/species/`, benannt nach ihrer ID (dem lateinischen Namen in Kleinbuchstaben mit Bindestrichen).',
    contribHeading: 'Arten und Pakete hinzufügen',
    contrib: [
      '1. Gehe von einer Quelle aus, die du nutzen darfst: deinem eigenen Wissen und deinen Beobachtungen oder öffentlichen Seiten, deren Lizenz die Weiterverwendung erlaubt (notiere Adresse und Datum). Kopiere keinen Text aus Bestimmungsbüchern, Apps oder Websites, es sei denn, die Lizenz erlaubt es: Schreibe den Hinweis mit eigenen Worten und sage das in `source`.',
      '2. Schreibe einen Namen nur in einer Sprache, die du kennst oder mit Menschen, die sie als Muttersprache sprechen, oder einem verlässlichen Wörterbuch prüfen kannst. Englisch ist Pflicht; die Seite zeigt zuerst die Sprache der Lesenden und Englisch als Rückfall.',
      '3. Bei Pflanzen und Pilzen ist `toxic` Pflicht. Schreibe `true`, wenn bekannt ist, dass irgendein Teil der Art giftig ist, und schreibe einen Giftigkeitshinweis, der sagt, worin die Gefahr besteht. `false` heißt nur, dass hier niemand die Art als giftig markiert hat: Es heißt nie essbar. Im Zweifel frage vor dem Schreiben von `false` eine örtliche Fachperson.',
      '4. Trage ein gefährliches Doppelgängerpaar bei beiden Arten ein, mit einem Warnhinweis wie „Die Blätter können verwechselt werden; die Verwechslung hat schwere Vergiftungen verursacht“. Sage, dass sie verwechselt werden, nie, wie man sie unterscheidet: Ein falscher Tipp kann tödlich sein.',
      '5. Fotos: eigene, gemeinfreie oder mit einer Lizenz aus der Liste in `docs/pack-format.md`, jedes mit Urheber, Lizenz und einem Link zur Quelle; verkleinere sie mit `python3 scripts/optimize.py` (WebP, höchstens 640 px, ohne Ortsdaten) und prüfe Fotos von Wikimedia Commons mit `node scripts/check_licences.mjs --online`. Laute: nur Links zu xeno-canto.org, die du dir angehört hast, mit Aufnehmendem und Lizenz.',
      '6. Ein neues Paket ist ein `draft` (oder ein `skeleton`, wenn es nur das Format zeigt). Nur wer jede Art geprüft hat, darf `reviewed` setzen, mit Namen und Datum: siehe `docs/review-guide.md`.',
      '7. Mehr: `docs/contributor-guide.md` (Befehle, Dateien, Prüfungen), `docs/school-class-guide.md` (eine Klasse oder ein Verein erstellt ein Paket) und `docs/pack-format.md` (jedes Feld und jede Grenze).'
    ],
    issues: [
      '`ro-mammals` auf 30 Säugetiere der Karpaten erweitern, mit Namen in en/ro/hu/de',
      '`ro-birds` auf 50 häufige Vögel Rumäniens erweitern',
      '`ro-plants-fungi` auf 40 Wildpflanzen und Pilze erweitern, jeweils mit Giftigkeitsangabe und Doppelgängern',
      'Das bulgarische Gerüst `bg-starter` auf 20 Arten erweitern, mit Namen, die jemand prüft, der Bulgarisch spricht',
      'Das moldauische Gerüst `md-starter` auf 20 Arten erweitern, mit Namen, die jemand vor Ort prüft',
      'Ein eingebautes Paket von Fachleuten für Biologie oder Pilzkunde prüfen lassen und die Prüfung festhalten (siehe `docs/review-guide.md`)',
      'Echte Fotos mit ihren Lizenzen zu eingebauten Arten hinzufügen (`scripts/optimize.py`, `scripts/check_licences.mjs --online`)',
      'xeno-canto-Links zu den Vögeln hinzufügen, jeden einzelnen durch Anhören geprüft',
      'Die Übersetzungen der Oberfläche (fr, it, es, pt, de, hu, ro) von Menschen mit der jeweiligen Muttersprache prüfen lassen',
      'Die VietAR-App `vietar-pack`-Dateien importieren lassen (eine Änderung im VietAR-Repository)'
    ],
    added: [
      'Die Seite: die Reiter §tab_browse§, §tab_packs§, §tab_build§ und §tab_guide§ in acht Sprachen, mit einem roten Sicherheitskasten, der immer sichtbar bleibt, Tastaturkürzeln und Unterstützung für Screenreader.',
      'Der Betrachter: Suche in jeder Sprache (Groß- und Kleinschreibung und Akzente ignoriert), Filter nach Gruppe und Giftigkeitsangabe, Artenseiten mit Namen, Giftigkeitsangabe und -hinweis, Hinweisen, Quelle, Doppelgängern (als Links), Fotos und Links zu Lauten; §d_tox_no§ erscheint nie in Grün und trägt immer eine Warnung.',
      'Pakete: Import (eingefügt oder aus einer Datei, vollständig geprüft, bevor etwas hinzugefügt wird), Download, Entfernen und Ersetzen nach ID; Artenzahl je Gruppe; ehrliche Statusabzeichen (§st_skeleton§, §st_draft§, §st_reviewed§) mit ihrer jeweiligen Bedeutung.',
      'Der Ersteller: ein Paketformular, ein Artenformular mit Namen in mehreren Sprachen, Giftigkeitsangabe und Hinweisen, in beide Richtungen verknüpfte Doppelgänger, ein JSON-Editor für Fotos und Laute, eine Prüfung, ein Download und ein im Browser gespeicherter Entwurf (mit einer Warnung, wenn der Browser keinen Platz mehr hat).',
      'Das Paketformat: `schema.json` (eine Art), `pack.schema.json` (ein Manifest), zusammengesetzte Pakete in `data/dist/` (Format `vietar-pack`, Version 1) und `data/dist/example.json` als Formatbeispiel.',
      'Fünf eingebaute Startpakete mit 71 Arten: Rumänien (19 Pflanzen und Pilze, 17 Vögel, 15 Säugetiere) und Gerüste für Bulgarien und Moldau (je dieselben 10 Arten); mit einem KI-Assistenten geschriebene und nur teilweise geprüfte Entwürfe, ohne Fotos und ohne Links zu Lauten.',
      '`scripts/pack.mjs` (Zusammenbau, `--check`, `--split`), `scripts/validate.py` (dieselben Regeln wie die Seite, für jede Datei und jedes zusammengesetzte Paket), `scripts/optimize.py` (Fotos) und `scripts/check_licences.mjs` (Lizenz und Urheber der Fotos; `--online` fragt Wikimedia Commons).',
      'Anleitungen auf Englisch und Rumänisch: `docs/pack-format.md`, `docs/school-class-guide.md`, `docs/contributor-guide.md` und `docs/review-guide.md`.',
      '`src/` und `scripts/build.mjs`: Die einzige `index.html` wird jetzt aus den Quellen gebaut, mit den eingebetteten Paketen aus `data/dist/`, und `--check` prüft sie.',
      'Tests: `npm test` und Browser-Tests im Hub.'
    ],
    changed: [
      'Der Workflow läuft auf Ubuntu 26.04 und Node.js 26 und führt die Paketprüfung, den Validator, die Tests und die Build-Prüfung aus.',
      'Die Daten sind jetzt eine Datei je Art und ein Manifest je Paket (`data/species/`, `data/packs/`), zusammengesetzt in `data/dist/`; `data/species/example.json` wird durch `data/dist/example.json` ersetzt, und `scripts/validate.py`, die README-Schritte und die Vorlagen haben sich entsprechend geändert.',
      'Die „Good first issues“-Liste enthält jetzt, was noch zu tun ist (mehr Arten, Prüfung durch Fachleute, Fotos, Laute, Übersetzungen); die Formatspezifikation, das Doppelgänger-Feld, der Foto-Optimierer, der Lizenzprüfer und die Anleitung für Klassen, die sie vorher aufführte, gibt es.'
    ]
  },
  hu: {
    status: 'Alfa, használható: az egyetlen `index.html` regionális fajcsomagokat böngész, importál, ellenőriz és hoz létre: neveket több nyelven, mérgezőségi jelzést, veszélyes hasonmásokat, licencelt fényképeket és hivatkozásokat az xeno-canto hangjaira. Öt beépített kezdőcsomagot tartalmaz, összesen 71 fajjal (Románia: 19 növény és gomba, 17 madár és 15 emlős; Bulgária és Moldova: mindkettő ugyanaz a 10 elterjedt faj, vázként). Minden beépített csomag vázlat vagy váz: a neveket és a megjegyzéseket MI-asszisztenssel írták, és csak részben ellenőrizték, sem biológus, sem gombaszakértő, sem anyanyelvi beszélő nem nézte át őket, és még nincs bennük fénykép és hanghivatkozás. Az oldal nem határoz meg fajokat, és nem terepi határozó: a §d_tox_no§ jelölés soha nem jelenti, hogy biztonságosan megehető vagy megérinthető. A VietAR alkalmazás még nem tudja importálni ezeket a csomagokat.',
    does: [
      '§tab_browse§: válassz egy csomagot, keress bármely nyelvű névre vagy a latin névre (a kis- és nagybetű és az ékezetek nem számítanak), szűrj csoportra és mérgezőségi jelzésre, és nyiss meg egy fajt: a nevei (az oldal nyelvén, tartalékként angolul), a mérgezőségi jelzés és megjegyzés, a megjegyzések, a forrás, azok a fajok, amelyekkel gyakran összetévesztik (mindegyik hivatkozás), a fényképek és a hanghivatkozások. Egy piros biztonsági keret minden lapon látható marad, és megmondja, mi nem az oldal.',
      '§tab_packs§: a beépített csomagok és az általad importáltak (illeszd be a JSON-t vagy válassz egy fájlt; egyszerre legfeljebb 12), mindegyik a régiójával, verziójával, licencével, szerzőivel, egy őszinte állapotjelvénnyel (§st_skeleton§, §st_draft§, §st_reviewed§) és a fajok számával csoportonként; tölts le bármelyik csomagot, vagy töröld az importáltakat. Egy csomagot teljes egészében ellenőriz a rendszer, mielőtt hozzáadná: ha valami hibás, semmi sem importálódik, és látod, mit kell javítani.',
      '§tab_build§: készíts csomagot egy osztálynak, egy természetjáró körnek vagy egy régiónak: töltsd ki a csomagot, add hozzá egyenként a fajokat (legfeljebb 400-at), kösd össze a hasonmásokat mindkét irányban, ellenőrizd a csomagot ugyanazokkal a szabályokkal, mint a tároló, és töltsd le a fájlt. A vázlat a böngészőben marad, amíg dolgozol. Az itt készített csomagot soha nem lehet átnézettnek jelölni; a fényképeket és a hangokat a faj JSON-ján keresztül lehet hozzáadni.',
      '§tab_guide§: hogyan használd az oldalt, és egy példa egy fajra fényképpel és hanggal.',
      'Formátum: fajonként egy JSON-fájl a `data/species/` mappában, csomagonként egy jegyzék a `data/packs/` mappában, teljes csomagokká (`vietar-pack` formátum) összeállítva a `data/dist/` mappában; a `schema.json` és a `pack.schema.json` írja le, a `docs/pack-format.md` magyarázza.',
      'Eszközök közreműködőknek: `scripts/pack.mjs` (összeállítja a csomagokat, és fájlokra bontja a letöltöttet), `scripts/validate.py`, `scripts/optimize.py` (egy fénykép legfeljebb 640 px-es WebP-be, metaadatok nélkül), `scripts/check_licences.mjs` (a fényképek licencei, online a `--online` kapcsolóval). A felület nyolc nyelven érhető el, és használható billentyűzettel és képernyőolvasóval.'
    ],
    how: [
      'Egy fajfájlból és egy jegyzékből (a fajazonosítók listája és a számuk) teljes csomag lesz: a `node scripts/pack.mjs` a `data/dist/<id>.json` fájlba írja. Az oldal beágyazza a `data/dist/` mappát, így amit böngészel, az pontosan az, amit letöltesz.',
      'A `schema.json` és a `pack.schema.json` leírja a fájlokat; a `scripts/validate.py` alkalmazza őket, és azokat a szabályokat is, amelyeket egy séma nem tud kimondani: a fájlnév, az azonosító és a latin név egyezik, a csoport illik a rendszertani országhoz, a növények és a gombák megmondják, mérgezők-e, a mérgező fajnak van mérgezőségi megjegyzése, a hasonmások kölcsönösen egymásra mutatnak, a fényképek együtt legfeljebb 3 MB-nyiak, az átnézett csomag megnevezi az átnézőt és a dátumot. A `src/engine.mjs` ugyanezeket a szabályokat alkalmazza az oldalon; a tesztek összehasonlítják a kettőt.',
      'Biztonságos már a felépítésében: a csomag szövegét az oldal mindig szövegként mutatja, soha nem HTML-ként; a hivatkozások csak `https://` címeket nyitnak meg; az oldal nem indít hálózati kérést (a fényképek be vannak ágyazva, a hangok olyan hivatkozások, amelyek az xeno-canto.org-ot új lapon nyitják meg); az importált csomagot és a mentett állapotot az oldal betöltésekor újra ellenőrzi, így a sérült vagy ellenséges állapotot elutasítja, nem hiszi el.',
      'A `src/ui.js`, a `src/i18n.mjs` és a `src/app.css` a felület; a `scripts/build.mjs` a `src/` mappából építi az egyetlen `index.html` fájlt, és beágyazza a `data/dist/` csomagjait; a `node scripts/build.mjs --check` hibával áll meg, ha az oldal elavult.',
      'Tesztek: `npm test` (motor, egyezés az érvényesítővel, szkriptek, licencellenőrző, fényképoptimalizáló, dokumentáció) és böngészőtesztek a hubban (nyolc nyelv, akadálymentesség, ellenséges importok, korlátok, megtelt tároló). A fejlesztéshez Node.js 24 vagy újabb és Python 3 kell a `jsonschema` csomaggal (a Pillow csak a fényképoptimalizálóhoz); maga az oldal olyan böngészőt kér, amely ismeri az ES2017-et.'
    ],
    steps: [
      '1. Forkold ezt a tárolót.',
      '2. Készíts vagy bővíts egy csomagot: az oldalon használd a §tab_build§ lapot, és töltsd le a fájlt, vagy írj kézzel `data/species/<latin-nev>.json` fájlokat (lásd `docs/pack-format.md`).',
      '3. Alakíts egy letöltött csomagot fájlokká a `node scripts/pack.mjs --split vietar-pack-<id>.json` paranccsal, vagy vedd fel az új fajok azonosítóit a csomag jegyzékébe a `data/packs/` mappában.',
      '4. Futtasd a `node scripts/pack.mjs`, a `python3 scripts/validate.py`, az `npm test` és a `node scripts/build.mjs` parancsot.',
      '5. Nyiss egy pull requestet – az adathozzájárulásokhoz nem kell programozni. Minden névhez, megjegyzéshez és mérgezőségi jelzéshez adj forrást, és soha ne jelölj meg magad egy csomagot átnézettnek (lásd `docs/review-guide.md`).'
    ],
    firstRule: 'Egy faj = egy fájl a `data/species/` mappában, az azonosítójáról elnevezve (a latin név kisbetűkkel, kötőjelekkel).',
    contribHeading: 'Fajok és csomagok hozzáadása',
    contrib: [
      '1. Olyan forrásból indulj ki, amelyet használhatsz: a saját tudásodból és megfigyeléseidből, vagy olyan nyilvános oldalakból, amelyek licence engedi az újrafelhasználást (jegyezd fel a címet és a dátumot). Ne másolj szöveget terepi határozókból, alkalmazásokból vagy weboldalakról, hacsak a licenc nem engedi: a megjegyzést a saját szavaiddal írd meg, és mondd ki ezt a `source` mezőben.',
      '2. Nevet csak olyan nyelven írj, amelyet ismersz, vagy amelyet anyanyelvi beszélővel vagy megbízható szótárral ellenőrizni tudsz. Az angol kötelező; az oldal először az olvasó nyelvét mutatja, tartalékként az angolt.',
      '3. Növényeknél és gombáknál a `toxic` kötelező. `true`-t írj, ha a faj valamely része ismerten mérgező, és írj olyan mérgezőségi megjegyzést, amely megmondja, mi a veszély. A `false` csak annyit jelent, hogy itt senki nem jelölte mérgezőnek a fajt: soha nem jelenti, hogy ehető. Kétség esetén kérdezz meg egy helyi szakértőt, mielőtt `false`-t írsz.',
      '4. Egy veszélyes hasonmáspárt mindkét fajnál tüntess fel, olyan figyelmeztető megjegyzéssel, mint „A levelek összetéveszthetők; az összetévesztés súlyos mérgezéseket okozott”. Azt írd, hogy összetévesztik őket, soha azt, hogyan lehet megkülönböztetni: egy téves tanács halálos lehet.',
      '5. Fényképek: saját, közkincs vagy a `docs/pack-format.md` listájában szereplő licencű képek, mindegyik a szerzőjével, licencével és a forrásra mutató hivatkozással; kicsinyítsd őket a `python3 scripts/optimize.py` paranccsal (WebP, legfeljebb 640 px, helyadatok nélkül), és a Wikimedia Commons-képeket ellenőrizd a `node scripts/check_licences.mjs --online` paranccsal. Hangok: csak olyan xeno-canto.org hivatkozások, amelyeket meghallgattál, a felvevő és a licenc megadásával.',
      '6. Egy új csomag `draft` (vagy `skeleton`, ha csak a formátumot mutatja). Csak az állíthatja `reviewed`-re, aki minden fajt ellenőrzött, a nevével és a dátummal: lásd `docs/review-guide.md`.',
      '7. Továbbiak: `docs/contributor-guide.md` (parancsok, fájlok, ellenőrzések), `docs/school-class-guide.md` (egy osztály vagy kör csomagot készít) és `docs/pack-format.md` (minden mező és korlát).'
    ],
    issues: [
      'A `ro-mammals` bővítése 30 kárpáti emlősre, en/ro/hu/de nevekkel',
      'A `ro-birds` bővítése 50 gyakori romániai madárra',
      'A `ro-plants-fungi` bővítése 40 vadon élő növényre és gombára, mindegyik mérgezőségi jelzéssel és hasonmásokkal',
      'A bolgár `bg-starter` váz bővítése 20 fajra, bolgárul beszélő által ellenőrzött nevekkel',
      'A moldovai `md-starter` váz bővítése 20 fajra, helyi beszélő által ellenőrzött nevekkel',
      'Egy beépített csomag átnézetése biológussal vagy gombaszakértővel, és az átnézés rögzítése (lásd `docs/review-guide.md`)',
      'Valódi fényképek hozzáadása licencükkel a beépített fajokhoz (`scripts/optimize.py`, `scripts/check_licences.mjs --online`)',
      'xeno-canto hivatkozások hozzáadása a madarakhoz, mindegyik meghallgatással ellenőrizve',
      'A felület fordításainak átnézetése anyanyelvi beszélőkkel (fr, it, es, pt, de, hu, ro)',
      'A VietAR alkalmazás importáljon `vietar-pack` fájlokat (módosítás a VietAR tárolóban)'
    ],
    added: [
      'Az oldal: a §tab_browse§, §tab_packs§, §tab_build§ és §tab_guide§ lap nyolc nyelven, mindig látható piros biztonsági kerettel, billentyűparancsokkal és képernyőolvasó-támogatással.',
      'A megjelenítő: keresés bármely nyelven (a kis- és nagybetű és az ékezetek figyelmen kívül hagyva), szűrés csoportra és mérgezőségi jelzésre, fajoldalak nevekkel, mérgezőségi jelzéssel és megjegyzéssel, megjegyzésekkel, forrással, hasonmásokkal (hivatkozásként), fényképekkel és hanghivatkozásokkal; a §d_tox_no§ soha nem jelenik meg zölden, és mindig figyelmeztetés kíséri.',
      'Csomagok: importálás (beillesztve vagy fájlból, teljes egészében ellenőrizve, mielőtt bármi hozzáadódna), letöltés, törlés és csere azonosító szerint; fajszám csoportonként; őszinte állapotjelvények (§st_skeleton§, §st_draft§, §st_reviewed§) a jelentésükkel.',
      'A készítő: csomagűrlap, fajűrlap több nyelvű nevekkel, mérgezőségi jelzéssel és megjegyzésekkel, mindkét irányban összekötött hasonmásokkal, JSON-szerkesztő a fényképekhez és hangokhoz, ellenőrzés, letöltés és a böngészőben tárolt vázlat (figyelmeztetéssel, ha a böngészőben elfogy a hely).',
      'A csomagformátum: `schema.json` (egy faj), `pack.schema.json` (egy jegyzék), a `data/dist/` mappában összeállított csomagok (`vietar-pack` formátum, 1-es verzió) és a `data/dist/example.json` formátumpéldaként.',
      'Öt beépített kezdőcsomag 71 fajjal: Románia (19 növény és gomba, 17 madár, 15 emlős) és vázak Bulgáriához és Moldovához (mindkettő ugyanaz a 10 faj); MI-asszisztenssel írt, csak részben ellenőrzött vázlatok, fényképek és hanghivatkozások nélkül.',
      '`scripts/pack.mjs` (összeállítás, `--check`, `--split`), `scripts/validate.py` (ugyanazok a szabályok, mint az oldalon, minden fájlra és minden összeállított csomagra), `scripts/optimize.py` (fényképek) és `scripts/check_licences.mjs` (a fényképek licence és szerzője; a `--online` a Wikimedia Commonst kérdezi).',
      'Útmutatók angolul és románul: `docs/pack-format.md`, `docs/school-class-guide.md`, `docs/contributor-guide.md` és `docs/review-guide.md`.',
      '`src/` és `scripts/build.mjs`: az egyetlen `index.html` mostantól forrásokból épül, beágyazott `data/dist/` csomagokkal, és a `--check` ellenőrzi.',
      'Tesztek: `npm test` és böngészőtesztek a hubban.'
    ],
    changed: [
      'A munkafolyamat Ubuntu 26.04 és Node.js 26 alatt fut, és a csomagellenőrzést, az érvényesítőt, a teszteket és a build-ellenőrzést is futtatja.',
      'Az adatok mostantól fajonként egy fájl és csomagonként egy jegyzék (`data/species/`, `data/packs/`), a `data/dist/` mappába összeállítva; a `data/species/example.json` helyét a `data/dist/example.json` veszi át, és a `scripts/validate.py`, a README lépései és a sablonok ennek megfelelően módosultak.',
      'A „good first issues” lista most azt tartalmazza, ami még hátravan (több faj, szakértői átnézés, fényképek, hangok, fordítások); a formátumleírás, a hasonmás-mező, a fényképoptimalizáló, a licencellenőrző és az osztályoknak szóló útmutató, amelyeket korábban felsorolt, már léteznek.'
    ]
  }
};

// Secțiunea «License» din README: datele au licența pachetului (nu a codului), fotografiile și sunetele își păstrează licențele.
const LICENSE = {
  en: 'Code: MIT. Data: every pack states its own licence (CC0-1.0, CC-BY-4.0 or CC-BY-SA-4.0); the built-in packs are CC0-1.0. Photos and sounds keep their own licences: each one names its author, licence and source. Contributed data: state its source; it is released under the licence of the pack it joins.',
  ro: 'Cod: MIT. Date: fiecare pachet își indică licența (CC0-1.0, CC-BY-4.0 sau CC-BY-SA-4.0); pachetele incluse sunt CC0-1.0. Fotografiile și sunetele își păstrează licențele lor: fiecare numește autorul, licența și sursa. Datele contribuite: indică sursa; sunt publicate sub licența pachetului la care se adaugă.',
  fr: 'Code : MIT. Données : chaque paquet indique sa propre licence (CC0-1.0, CC-BY-4.0 ou CC-BY-SA-4.0) ; les paquets intégrés sont sous CC0-1.0. Les photos et les sons gardent leur propre licence : chacun nomme son auteur, sa licence et sa source. Données contribuées : indiquez la source ; elles sont publiées sous la licence du paquet auquel elles s’ajoutent.',
  it: 'Codice: MIT. Dati: ogni pacchetto indica la propria licenza (CC0-1.0, CC-BY-4.0 o CC-BY-SA-4.0); i pacchetti incorporati sono CC0-1.0. Foto e suoni mantengono le proprie licenze: ciascuno indica autore, licenza e fonte. Dati contribuiti: indica la fonte; sono pubblicati con la licenza del pacchetto a cui si aggiungono.',
  es: 'Código: MIT. Datos: cada paquete indica su propia licencia (CC0-1.0, CC-BY-4.0 o CC-BY-SA-4.0); los paquetes integrados son CC0-1.0. Las fotos y los sonidos conservan sus propias licencias: cada uno nombra su autor, su licencia y su fuente. Datos aportados: indica la fuente; se publican con la licencia del paquete al que se suman.',
  pt: 'Código: MIT. Dados: cada pacote indica a sua própria licença (CC0-1.0, CC-BY-4.0 ou CC-BY-SA-4.0); os pacotes integrados são CC0-1.0. As fotos e os sons mantêm as suas próprias licenças: cada um indica o autor, a licença e a fonte. Dados contribuídos: indique a fonte; são publicados sob a licença do pacote a que se juntam.',
  de: 'Code: MIT. Daten: Jedes Paket nennt seine eigene Lizenz (CC0-1.0, CC-BY-4.0 oder CC-BY-SA-4.0); die eingebauten Pakete stehen unter CC0-1.0. Fotos und Laute behalten ihre eigenen Lizenzen: Jedes nennt Urheber, Lizenz und Quelle. Beigesteuerte Daten: Quelle angeben; sie stehen unter der Lizenz des Pakets, dem sie sich anschließen.',
  hu: 'Kód: MIT. Adatok: minden csomag megadja a saját licencét (CC0-1.0, CC-BY-4.0 vagy CC-BY-SA-4.0); a beépített csomagok CC0-1.0 alatt vannak. A fényképek és a hangok megtartják a saját licencüket: mindegyik megnevezi a szerzőjét, licencét és forrását. A beküldött adatoknál add meg a forrást; annak a csomagnak a licence alatt jelennek meg, amelyhez csatlakoznak.'
};

export default async function (root) {
  const dir = path.join(root, 'vietar-packs');
  const I18N = (await import(pathToFileURL(path.join(dir, 'src', 'i18n.mjs')).href)).default;
  const legacy = JSON.parse(fs.readFileSync(path.join(HERE, 'vietar-packs.legacy.json'), 'utf8'));
  const q = (l, k) => {
    if (typeof I18N[l][k] !== 'string') throw new Error('vietar-packs: cheie lipsă în src/i18n.mjs: ' + k + ' (' + l + ')');
    return QU[l][0] + I18N[l][k] + QU[l][1];
  };
  const fill = (l, s) => s.replace(/§([a-z_0-9]+)§/g, (m, k) => q(l, k));
  const each = (key, map) => Object.fromEntries(L.map((l) => {
    if (!T[l] || T[l][key] === undefined) throw new Error('vietar-packs: lipsește «' + key + '» pentru limba ' + l);
    return [l, map(l, T[l][key])];
  }));
  const list = (l, a) => a.map((x) => fill(l, x));
  const limits = {}, limHeading = {};
  for (const l of L) { limits[l] = [1, 2, 3, 4, 5, 6].map((i) => I18N[l]['lim_' + i]); limHeading[l] = I18N[l].h_limits; }
  const added = each('added', list);
  for (const l of L) added[l] = [...added[l], ...legacy[l]];

  return {
    slug: 'vietar-packs', version: '0.2.0', updated: '2026-11-17',
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
    license: Object.fromEntries(L.map((l) => [l, LICENSE[l]])),
    contrib: {
      heading: each('contribHeading', (l, s) => s),
      body: each('contrib', (l, a) => list(l, a).join('\n'))
    },
    issues: each('issues', list),
    changelog: {added, changed: each('changed', list)}
  };
}
