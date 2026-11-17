// Specificația documentației GLOSAR (opt limbi). Folosită de tools/alpha/docs.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default async function (root) {
  const dir = path.join(root, 'glosar');
  const I18N = (await import(pathToFileURL(path.join(dir, 'src', 'i18n.mjs')).href)).default;
  const legacy = JSON.parse(fs.readFileSync(path.join(HERE, 'glosar.legacy.json'), 'utf8'));
  const L = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
  const limits = {}, limHeading = {};
  for (const l of L) { limits[l] = [1, 2, 3, 4, 5, 6].map((i) => I18N[l]['lim_' + i]); limHeading[l] = I18N[l].h_limits; }

  const status = {
    en: 'Alpha, usable: the single `index.html` is an offline dictionary for Aromanian, Megleno-Romanian and Romani (Istro-Romanian is declared but still has no entries). It searches without regard to diacritics, shows which of 50 basic words are missing, lets you add words with a source and a recording, exports to TSV and Anki, and produces a contribution file that `scripts/import_bundle.py` turns into data files. The 43 starter entries come from cited public pages and have not been reviewed by speakers.',
    ro: 'Alfa, utilizabil: singurul `index.html` este un dicționar offline pentru aromână, meglenoromână și romani (istroromâna este declarată, dar încă nu are intrări). Caută fără să țină seama de diacritice, arată care dintre cele 50 de cuvinte de bază lipsesc, permite adăugarea de cuvinte cu sursă și înregistrare, exportă în TSV și Anki și produce un fișier de contribuție pe care `scripts/import_bundle.py` îl transformă în fișiere de date. Cele 43 de intrări de pornire provin din pagini publice citate și nu au fost revizuite de vorbitori.',
    fr: 'Alpha, utilisable : l’unique `index.html` est un dictionnaire hors ligne pour l’aroumain, le mégléno-roumain et le romani (l’istro-roumain est déclaré mais n’a pas encore d’entrées). Il cherche sans tenir compte des diacritiques, montre lesquels des 50 mots de base manquent, permet d’ajouter des mots avec une source et un enregistrement, exporte en TSV et pour Anki, et produit un fichier de contribution que `scripts/import_bundle.py` transforme en fichiers de données. Les 43 entrées de départ proviennent de pages publiques citées et n’ont pas été relues par des locuteurs.',
    it: 'Alfa, utilizzabile: l’unico `index.html` è un dizionario offline per l’aromeno, il megleno-rumeno e il romaní (l’istro-rumeno è dichiarato ma non ha ancora voci). Cerca senza badare ai segni diacritici, mostra quali delle 50 parole di base mancano, permette di aggiungere parole con una fonte e una registrazione, esporta in TSV e per Anki e produce un file di contributo che `scripts/import_bundle.py` trasforma in file di dati. Le 43 voci iniziali provengono da pagine pubbliche citate e non sono state riviste da parlanti.',
    es: 'Alfa, utilizable: el único `index.html` es un diccionario sin conexión para el arrumano, el megleno-rumano y el romaní (el istro-rumano está declarado pero aún no tiene entradas). Busca sin tener en cuenta los diacríticos, muestra cuáles de las 50 palabras básicas faltan, permite añadir palabras con una fuente y una grabación, exporta a TSV y a Anki y genera un archivo de contribución que `scripts/import_bundle.py` convierte en archivos de datos. Las 43 entradas iniciales proceden de páginas públicas citadas y no las han revisado hablantes.',
    pt: 'Alfa, utilizável: o único `index.html` é um dicionário offline para o arromeno, o megleno-romeno e o romani (o istro-romeno está declarado, mas ainda não tem entradas). Pesquisa sem ter em conta os diacríticos, mostra quais das 50 palavras básicas faltam, permite acrescentar palavras com uma fonte e uma gravação, exporta para TSV e Anki e produz um ficheiro de contribuição que o `scripts/import_bundle.py` transforma em ficheiros de dados. As 43 entradas iniciais vêm de páginas públicas citadas e não foram revistas por falantes.',
    de: 'Alpha, nutzbar: Die eine `index.html` ist ein Offline-Wörterbuch für Aromunisch, Megleno-Rumänisch und Romani (Istro-Rumänisch ist angelegt, hat aber noch keine Einträge). Es sucht ohne Rücksicht auf Diakritika, zeigt, welche der 50 Grundwörter fehlen, erlaubt das Ergänzen von Wörtern mit Quelle und Aufnahme, exportiert nach TSV und Anki und erzeugt eine Beitragsdatei, die `scripts/import_bundle.py` in Datendateien umwandelt. Die 43 Startdatensätze stammen von zitierten öffentlichen Seiten und wurden noch nicht von Sprechern geprüft.',
    hu: 'Alfa, használható: az egyetlen `index.html` egy offline szótár az aromán, a meglenoromán és a romani nyelvhez (az isztroromán deklarálva van, de még nincs szócikke). Ékezetektől függetlenül keres, megmutatja, hogy az 50 alapszó közül melyek hiányoznak, lehetővé teszi szavak hozzáadását forrással és hangfelvétellel, TSV és Anki formátumba exportál, és hozzájárulási fájlt készít, amelyet a `scripts/import_bundle.py` adatfájlokká alakít. A 43 kezdő szócikk idézett nyilvános oldalakról származik, és beszélők még nem nézték át.'
  };

  const does = {
    en: [
      'Search by word, variant or meaning (in any of the eight interface languages), ignoring diacritics: typing `tinti` finds `ținți`. Filters for language, reliability (draft, sourced, reviewed) and recordings; every result shows the part of speech, dialect, spelling system, source and licence, and plays the recording.',
      'Coverage: a table of 50 basic concepts (numbers, family, body, nature, qualities) shows for every language which words exist and which are missing; a click on a gap opens the add form with the concept already filled in.',
      'Add: a form that checks every field, warns about duplicates, adds many words from a pasted list, and records or uploads a pronunciation (Opus in Ogg or WebM, at most 50 KB); what you add stays in the browser until you download it.',
      'Export: everything or only your own entries as TSV (opens in a spreadsheet) or as an Anki file (language, reliability and concept as tags), and a contribution file, recordings included, that you can send to the project.',
      'Data: one JSON file per entry in `data/dictionaries/`, the language index `data/languages.json` (ISO 639-3 codes, dialects, spelling systems) and the list `data/concepts.json`; interface in eight languages, dark and light themes, keyboard, works from 360 px wide; no network, no tracking.'
    ],
    ro: [
      'Căutare după cuvânt, variantă sau sens (în oricare dintre cele opt limbi ale interfeței), fără să țină seama de diacritice: scriind `tinti` găsește `ținți`. Filtre pentru limbă, încredere (schiță, cu sursă, revizuit) și înregistrări; fiecare rezultat arată partea de vorbire, dialectul, sistemul de scriere, sursa și licența și redă înregistrarea.',
      'Acoperire: un tabel cu 50 de concepte de bază (numere, familie, corp, natură, calități) arată pentru fiecare limbă ce cuvinte există și care lipsesc; un clic pe un loc gol deschide formularul de adăugare cu conceptul deja completat.',
      'Adăugare: un formular care verifică fiecare câmp, avertizează la duplicate, adaugă mai multe cuvinte dintr-o listă lipită și înregistrează sau încarcă o pronunție (Opus în Ogg sau WebM, cel mult 50 KB); ce adaugi rămâne în browser până îl descarci.',
      'Export: tot sau doar intrările tale în TSV (se deschide într-un tabel) sau ca fișier Anki (limba, încrederea și conceptul ca etichete), plus un fișier de contribuție, cu înregistrările incluse, pe care îl poți trimite proiectului.',
      'Date: un fișier JSON pe intrare în `data/dictionaries/`, indexul limbilor `data/languages.json` (coduri ISO 639-3, dialecte, sisteme de scriere) și lista `data/concepts.json`; interfață în opt limbi, teme întunecată și luminoasă, tastatură, funcționează de la 360 px lățime; fără rețea, fără urmărire.'
    ],
    fr: [
      'Recherche par mot, variante ou sens (dans l’une des huit langues de l’interface), sans tenir compte des diacritiques : taper `tinti` trouve `ținți`. Filtres par langue, fiabilité (brouillon, sourcé, relu) et enregistrements ; chaque résultat montre la catégorie grammaticale, le dialecte, le système d’écriture, la source et la licence, et lit l’enregistrement.',
      'Couverture : un tableau de 50 concepts de base (nombres, famille, corps, nature, qualités) montre pour chaque langue quels mots existent et lesquels manquent ; un clic sur une case vide ouvre le formulaire d’ajout avec le concept déjà rempli.',
      'Ajout : un formulaire qui vérifie chaque champ, signale les doublons, ajoute plusieurs mots à partir d’une liste collée, et enregistre ou téléverse une prononciation (Opus dans Ogg ou WebM, 50 Ko au plus) ; ce que vous ajoutez reste dans le navigateur jusqu’au téléchargement.',
      'Export : tout ou seulement vos propres entrées en TSV (s’ouvre dans un tableur) ou en fichier Anki (langue, fiabilité et concept comme étiquettes), plus un fichier de contribution, enregistrements inclus, que vous pouvez envoyer au projet.',
      'Données : un fichier JSON par entrée dans `data/dictionaries/`, l’index des langues `data/languages.json` (codes ISO 639-3, dialectes, systèmes d’écriture) et la liste `data/concepts.json` ; interface en huit langues, thèmes sombre et clair, clavier, utilisable dès 360 px de large ; sans réseau, sans suivi.'
    ],
    it: [
      'Ricerca per parola, variante o significato (in una qualsiasi delle otto lingue dell’interfaccia), senza badare ai segni diacritici: digitando `tinti` trova `ținți`. Filtri per lingua, affidabilità (bozza, con fonte, rivisto) e registrazioni; ogni risultato mostra la parte del discorso, il dialetto, il sistema ortografico, la fonte e la licenza, e riproduce la registrazione.',
      'Copertura: una tabella di 50 concetti di base (numeri, famiglia, corpo, natura, qualità) mostra per ogni lingua quali parole esistono e quali mancano; un clic su una casella vuota apre il modulo di aggiunta con il concetto già compilato.',
      'Aggiunta: un modulo che controlla ogni campo, avvisa dei duplicati, aggiunge più parole da un elenco incollato e registra o carica una pronuncia (Opus in Ogg o WebM, al massimo 50 KB); ciò che aggiungi resta nel browser finché non lo scarichi.',
      'Esportazione: tutto o solo le tue voci in TSV (si apre in un foglio di calcolo) o come file Anki (lingua, affidabilità e concetto come etichette), più un file di contributo, registrazioni incluse, che puoi inviare al progetto.',
      'Dati: un file JSON per voce in `data/dictionaries/`, l’indice delle lingue `data/languages.json` (codici ISO 639-3, dialetti, sistemi ortografici) e l’elenco `data/concepts.json`; interfaccia in otto lingue, temi scuro e chiaro, tastiera, funziona da 360 px di larghezza; senza rete, senza tracciamento.'
    ],
    es: [
      'Búsqueda por palabra, variante o significado (en cualquiera de los ocho idiomas de la interfaz), sin tener en cuenta los diacríticos: al escribir `tinti` encuentra `ținți`. Filtros por idioma, fiabilidad (borrador, con fuente, revisado) y grabaciones; cada resultado muestra la categoría gramatical, el dialecto, el sistema ortográfico, la fuente y la licencia, y reproduce la grabación.',
      'Cobertura: una tabla de 50 conceptos básicos (números, familia, cuerpo, naturaleza, cualidades) muestra para cada idioma qué palabras existen y cuáles faltan; un clic en un hueco abre el formulario de alta con el concepto ya rellenado.',
      'Alta: un formulario que comprueba cada campo, avisa de los duplicados, añade varias palabras desde una lista pegada y graba o sube una pronunciación (Opus en Ogg o WebM, 50 KB como máximo); lo que añades se queda en el navegador hasta que lo descargues.',
      'Exportación: todo o solo tus propias entradas en TSV (se abre en una hoja de cálculo) o como archivo de Anki (idioma, fiabilidad y concepto como etiquetas), más un archivo de contribución, con las grabaciones incluidas, que puedes enviar al proyecto.',
      'Datos: un archivo JSON por entrada en `data/dictionaries/`, el índice de idiomas `data/languages.json` (códigos ISO 639-3, dialectos, sistemas ortográficos) y la lista `data/concepts.json`; interfaz en ocho idiomas, temas oscuro y claro, teclado, funciona desde 360 px de ancho; sin red, sin rastreo.'
    ],
    pt: [
      'Pesquisa por palavra, variante ou significado (em qualquer das oito línguas da interface), sem ter em conta os diacríticos: ao escrever `tinti` encontra `ținți`. Filtros por língua, fiabilidade (rascunho, com fonte, revisto) e gravações; cada resultado mostra a classe gramatical, o dialeto, o sistema ortográfico, a fonte e a licença, e reproduz a gravação.',
      'Cobertura: uma tabela de 50 conceitos básicos (números, família, corpo, natureza, qualidades) mostra, para cada língua, que palavras existem e quais faltam; um clique numa lacuna abre o formulário de adição com o conceito já preenchido.',
      'Adição: um formulário que verifica cada campo, avisa dos duplicados, acrescenta várias palavras a partir de uma lista colada e grava ou carrega uma pronúncia (Opus em Ogg ou WebM, no máximo 50 KB); o que acrescenta fica no navegador até o descarregar.',
      'Exportação: tudo ou só as suas entradas em TSV (abre-se numa folha de cálculo) ou como ficheiro Anki (língua, fiabilidade e conceito como etiquetas), mais um ficheiro de contribuição, com as gravações incluídas, que pode enviar ao projeto.',
      'Dados: um ficheiro JSON por entrada em `data/dictionaries/`, o índice de línguas `data/languages.json` (códigos ISO 639-3, dialetos, sistemas ortográficos) e a lista `data/concepts.json`; interface em oito línguas, temas escuro e claro, teclado, funciona desde 360 px de largura; sem rede, sem rastreamento.'
    ],
    de: [
      'Suche nach Wort, Variante oder Bedeutung (in jeder der acht Oberflächensprachen), ohne Rücksicht auf Diakritika: Die Eingabe `tinti` findet `ținți`. Filter für Sprache, Verlässlichkeit (Entwurf, belegt, geprüft) und Aufnahmen; jedes Ergebnis zeigt Wortart, Dialekt, Schreibsystem, Quelle und Lizenz und spielt die Aufnahme ab.',
      'Abdeckung: Eine Tabelle mit 50 Grundbegriffen (Zahlen, Familie, Körper, Natur, Eigenschaften) zeigt für jede Sprache, welche Wörter vorhanden sind und welche fehlen; ein Klick auf eine Lücke öffnet das Formular zum Hinzufügen mit bereits ausgefülltem Begriff.',
      'Hinzufügen: ein Formular, das jedes Feld prüft, vor Duplikaten warnt, mehrere Wörter aus einer eingefügten Liste ergänzt und eine Aussprache aufnimmt oder hochlädt (Opus in Ogg oder WebM, höchstens 50 KB); was du hinzufügst, bleibt im Browser, bis du es herunterlädst.',
      'Export: alles oder nur die eigenen Einträge als TSV (öffnet sich in einer Tabellenkalkulation) oder als Anki-Datei (Sprache, Verlässlichkeit und Begriff als Schlagwörter) sowie eine Beitragsdatei samt Aufnahmen, die du dem Projekt schicken kannst.',
      'Daten: eine JSON-Datei pro Eintrag in `data/dictionaries/`, der Sprachindex `data/languages.json` (ISO-639-3-Codes, Dialekte, Schreibsysteme) und die Liste `data/concepts.json`; Oberfläche in acht Sprachen, dunkles und helles Design, Tastatur, nutzbar ab 360 px Breite; ohne Netzwerk, ohne Tracking.'
    ],
    hu: [
      'Keresés szó, változat vagy jelentés szerint (a felület nyolc nyelvének bármelyikén), az ékezetektől függetlenül: a `tinti` beírása megtalálja a `ținți` szót. Szűrők nyelv, megbízhatóság (vázlat, forrással, ellenőrzött) és hangfelvétel szerint; minden találat mutatja a szófajt, a nyelvjárást, az írásrendszert, a forrást és a licencet, és lejátssza a felvételt.',
      'Lefedettség: egy 50 alapfogalomból (számok, család, test, természet, tulajdonságok) álló táblázat megmutatja minden nyelvre, hogy mely szavak vannak meg és melyek hiányoznak; egy hiányzó helyre kattintva megnyílik a hozzáadás űrlapja a fogalommal előre kitöltve.',
      'Hozzáadás: egy űrlap, amely minden mezőt ellenőriz, figyelmeztet az ismétlődésekre, beillesztett listából több szót is hozzáad, és kiejtést vesz fel vagy tölt fel (Opus Ogg vagy WebM tárolóban, legfeljebb 50 KB); amit hozzáadsz, a letöltésig a böngészőben marad.',
      'Exportálás: minden vagy csak a saját szócikkeid TSV-ben (táblázatkezelőben nyílik meg) vagy Anki-fájlként (a nyelv, a megbízhatóság és a fogalom címkeként), továbbá egy hozzájárulási fájl a felvételekkel együtt, amelyet elküldhetsz a projektnek.',
      'Adatok: szócikkenként egy JSON-fájl a `data/dictionaries/` mappában, a nyelvek jegyzéke a `data/languages.json` (ISO 639-3 kódok, nyelvjárások, írásrendszerek) és az alapfogalmak listája a `data/concepts.json`; nyolcnyelvű felület, sötét és világos téma, billentyűzet, 360 px szélességtől működik; hálózat és követés nélkül.'
    ]
  };

  const how = {
    en: [
      '`schema.json`, `languages.schema.json` and `concepts.schema.json` describe the data; `scripts/validate.py` checks every file against them and against the rules a schema cannot express: the file name, references to languages, dialects, spelling systems and concepts, a web address for `sourced` and a reviewer for `reviewed`, duplicates, and the audio files (Opus in Ogg or WebM, at most 50 KB).',
      '`src/engine.mjs` is the engine (no screen, no network): the folding rule used for searching and for file names, validation, ranking of results, duplicates, coverage, TSV and Anki export, the contribution file and the parser for pasted lists. `scripts/validate.py` and `scripts/import_bundle.py` apply the same folding rule; the tests compare the two.',
      '`src/ui.js`, `src/i18n.mjs` and `src/app.css` are the interface; `node scripts/build.mjs` builds the single `index.html` with the data and the recordings from `audio/` embedded (`--check` verifies that it matches).',
      '`npm test` runs the tests of the engine, the data, the Python scripts, the build and the interface texts; the browser tests are in the hub. Development needs Node.js 24 or newer and Python 3 with `jsonschema`; the page itself only needs a browser that knows ES2017.'
    ],
    ro: [
      '`schema.json`, `languages.schema.json` și `concepts.schema.json` descriu datele; `scripts/validate.py` verifică fiecare fișier față de ele și față de regulile pe care o schemă nu le poate exprima: numele fișierului, trimiterile la limbi, dialecte, sisteme de scriere și concepte, o adresă web pentru `sourced` și un revizor pentru `reviewed`, duplicatele și fișierele audio (Opus în Ogg sau WebM, cel mult 50 KB).',
      '`src/engine.mjs` este motorul (fără ecran, fără rețea): regula de normalizare folosită la căutare și la numele fișierelor, validarea, ordonarea rezultatelor, duplicatele, acoperirea, exportul TSV și Anki, fișierul de contribuție și analizorul listelor lipite. `scripts/validate.py` și `scripts/import_bundle.py` aplică aceeași regulă de normalizare; testele le compară.',
      '`src/ui.js`, `src/i18n.mjs` și `src/app.css` sunt interfața; `node scripts/build.mjs` construiește singurul `index.html`, cu datele și înregistrările din `audio/` încorporate (`--check` verifică dacă se potrivește).',
      '`npm test` rulează testele motorului, ale datelor, ale scripturilor Python, ale construcției și ale textelor interfeței; testele de browser sunt în hub. Dezvoltarea cere Node.js 24 sau mai nou și Python 3 cu `jsonschema`; pagina în sine cere doar un browser care cunoaște ES2017.'
    ],
    fr: [
      '`schema.json`, `languages.schema.json` et `concepts.schema.json` décrivent les données ; `scripts/validate.py` vérifie chaque fichier par rapport à eux et aux règles qu’un schéma ne peut pas exprimer : le nom du fichier, les renvois aux langues, dialectes, systèmes d’écriture et concepts, une adresse web pour `sourced` et un relecteur pour `reviewed`, les doublons et les fichiers audio (Opus dans Ogg ou WebM, 50 Ko au plus).',
      '`src/engine.mjs` est le moteur (sans écran, sans réseau) : la règle de normalisation utilisée pour la recherche et les noms de fichiers, la validation, le classement des résultats, les doublons, la couverture, l’export TSV et Anki, le fichier de contribution et l’analyseur des listes collées. `scripts/validate.py` et `scripts/import_bundle.py` appliquent la même règle ; les tests les comparent.',
      '`src/ui.js`, `src/i18n.mjs` et `src/app.css` forment l’interface ; `node scripts/build.mjs` construit l’unique `index.html` avec les données et les enregistrements de `audio/` intégrés (`--check` vérifie qu’il correspond).',
      '`npm test` lance les tests du moteur, des données, des scripts Python, de la construction et des textes de l’interface ; les tests de navigateur sont dans le hub. Le développement demande Node.js 24 ou plus récent et Python 3 avec `jsonschema` ; la page elle-même n’exige qu’un navigateur qui connaît ES2017.'
    ],
    it: [
      '`schema.json`, `languages.schema.json` e `concepts.schema.json` descrivono i dati; `scripts/validate.py` controlla ogni file rispetto a essi e alle regole che uno schema non può esprimere: il nome del file, i rinvii a lingue, dialetti, sistemi ortografici e concetti, un indirizzo web per `sourced` e un revisore per `reviewed`, i duplicati e i file audio (Opus in Ogg o WebM, al massimo 50 KB).',
      '`src/engine.mjs` è il motore (senza schermo, senza rete): la regola di normalizzazione usata per la ricerca e per i nomi dei file, la convalida, l’ordinamento dei risultati, i duplicati, la copertura, l’esportazione TSV e Anki, il file di contributo e l’analizzatore degli elenchi incollati. `scripts/validate.py` e `scripts/import_bundle.py` applicano la stessa regola; i test le confrontano.',
      '`src/ui.js`, `src/i18n.mjs` e `src/app.css` sono l’interfaccia; `node scripts/build.mjs` costruisce l’unico `index.html` con i dati e le registrazioni di `audio/` incorporati (`--check` verifica che corrisponda).',
      '`npm test` esegue i test del motore, dei dati, degli script Python, della build e dei testi dell’interfaccia; i test del browser sono nell’hub. Lo sviluppo richiede Node.js 24 o più recente e Python 3 con `jsonschema`; la pagina stessa richiede solo un browser che conosca ES2017.'
    ],
    es: [
      '`schema.json`, `languages.schema.json` y `concepts.schema.json` describen los datos; `scripts/validate.py` comprueba cada archivo con ellos y con las reglas que un esquema no puede expresar: el nombre del archivo, las referencias a idiomas, dialectos, sistemas ortográficos y conceptos, una dirección web para `sourced` y un revisor para `reviewed`, los duplicados y los archivos de audio (Opus en Ogg o WebM, 50 KB como máximo).',
      '`src/engine.mjs` es el motor (sin pantalla, sin red): la regla de normalización usada para buscar y para los nombres de archivo, la validación, la ordenación de los resultados, los duplicados, la cobertura, la exportación a TSV y Anki, el archivo de contribución y el analizador de listas pegadas. `scripts/validate.py` y `scripts/import_bundle.py` aplican la misma regla; las pruebas las comparan.',
      '`src/ui.js`, `src/i18n.mjs` y `src/app.css` son la interfaz; `node scripts/build.mjs` construye el único `index.html` con los datos y las grabaciones de `audio/` incorporados (`--check` verifica que coincide).',
      '`npm test` ejecuta las pruebas del motor, de los datos, de los scripts de Python, de la compilación y de los textos de la interfaz; las pruebas de navegador están en el hub. El desarrollo requiere Node.js 24 o más reciente y Python 3 con `jsonschema`; la página en sí solo necesita un navegador que conozca ES2017.'
    ],
    pt: [
      '`schema.json`, `languages.schema.json` e `concepts.schema.json` descrevem os dados; `scripts/validate.py` verifica cada ficheiro com eles e com as regras que um esquema não consegue exprimir: o nome do ficheiro, as referências a línguas, dialetos, sistemas ortográficos e conceitos, um endereço web para `sourced` e um revisor para `reviewed`, os duplicados e os ficheiros de áudio (Opus em Ogg ou WebM, no máximo 50 KB).',
      '`src/engine.mjs` é o motor (sem ecrã, sem rede): a regra de normalização usada na pesquisa e nos nomes de ficheiros, a validação, a ordenação dos resultados, os duplicados, a cobertura, a exportação para TSV e Anki, o ficheiro de contribuição e o analisador de listas coladas. `scripts/validate.py` e `scripts/import_bundle.py` aplicam a mesma regra; os testes comparam-nas.',
      '`src/ui.js`, `src/i18n.mjs` e `src/app.css` são a interface; `node scripts/build.mjs` constrói o único `index.html` com os dados e as gravações de `audio/` incorporados (`--check` verifica que coincide).',
      '`npm test` executa os testes do motor, dos dados, dos scripts Python, da compilação e dos textos da interface; os testes de navegador estão no hub. O desenvolvimento requer Node.js 24 ou mais recente e Python 3 com `jsonschema`; a página em si só precisa de um navegador que conheça ES2017.'
    ],
    de: [
      '`schema.json`, `languages.schema.json` und `concepts.schema.json` beschreiben die Daten; `scripts/validate.py` prüft jede Datei dagegen und gegen die Regeln, die ein Schema nicht ausdrücken kann: den Dateinamen, die Verweise auf Sprachen, Dialekte, Schreibsysteme und Begriffe, eine Webadresse für `sourced` und eine prüfende Person für `reviewed`, Duplikate und die Audiodateien (Opus in Ogg oder WebM, höchstens 50 KB).',
      '`src/engine.mjs` ist der Motor (ohne Bildschirm, ohne Netzwerk): die Normalisierungsregel für die Suche und die Dateinamen, die Validierung, die Rangfolge der Ergebnisse, Duplikate, Abdeckung, TSV- und Anki-Export, die Beitragsdatei und der Parser für eingefügte Listen. `scripts/validate.py` und `scripts/import_bundle.py` wenden dieselbe Regel an; die Tests vergleichen beide.',
      '`src/ui.js`, `src/i18n.mjs` und `src/app.css` bilden die Oberfläche; `node scripts/build.mjs` baut die eine `index.html` mit eingebetteten Daten und den Aufnahmen aus `audio/` (`--check` prüft, ob sie übereinstimmt).',
      '`npm test` führt die Tests des Motors, der Daten, der Python-Skripte, des Builds und der Oberflächentexte aus; die Browsertests liegen im Hub. Für die Entwicklung braucht man Node.js 24 oder neuer und Python 3 mit `jsonschema`; die Seite selbst braucht nur einen Browser, der ES2017 kennt.'
    ],
    hu: [
      'A `schema.json`, a `languages.schema.json` és a `concepts.schema.json` írja le az adatokat; a `scripts/validate.py` minden fájlt ellenőriz ezek szerint és azokkal a szabályokkal, amelyeket egy séma nem tud kifejezni: a fájlnév, a nyelvekre, nyelvjárásokra, írásrendszerekre és fogalmakra való hivatkozások, a `sourced` állapotnál webcím, a `reviewed` állapotnál ellenőrző személy, az ismétlődések és a hangfájlok (Opus Ogg vagy WebM tárolóban, legfeljebb 50 KB).',
      'A `src/engine.mjs` a motor (képernyő és hálózat nélkül): a kereséshez és a fájlnevekhez használt normalizálási szabály, az ellenőrzés, a találatok rangsorolása, az ismétlődések, a lefedettség, a TSV- és Anki-export, a hozzájárulási fájl és a beillesztett listák értelmezője. A `scripts/validate.py` és a `scripts/import_bundle.py` ugyanazt a szabályt alkalmazza; a tesztek összehasonlítják őket.',
      'A `src/ui.js`, a `src/i18n.mjs` és a `src/app.css` a felület; a `node scripts/build.mjs` építi az egyetlen `index.html` fájlt a beágyazott adatokkal és az `audio/` mappa felvételeivel (a `--check` ellenőrzi, hogy egyezik-e).',
      'Az `npm test` futtatja a motor, az adatok, a Python-szkriptek, az építés és a felületi szövegek tesztjeit; a böngészőtesztek a hubban vannak. A fejlesztéshez Node.js 24 vagy újabb és Python 3 `jsonschema`-val kell; maga az oldal csak ES2017-et ismerő böngészőt igényel.'
    ]
  };

  const extraSteps = {
    en: '5. No coding needed: add words on the page (tab “Add”), download your contribution file and send it in an issue or a pull request; a maintainer imports it with `python scripts/import_bundle.py` (see `docs/contributor-guide.md`).',
    ro: '5. Fără programare: adaugă cuvinte în pagină (fila «Adăugare»), descarcă fișierul tău de contribuție și trimite-l într-un issue sau un pull request; un responsabil îl importă cu `python scripts/import_bundle.py` (vezi `docs/contributor-guide.ro.md`).',
    fr: '5. Sans programmer : ajoutez des mots dans la page (onglet « Ajout »), téléchargez votre fichier de contribution et envoyez-le dans une issue ou une pull request ; un mainteneur l’importe avec `python scripts/import_bundle.py` (voir `docs/contributor-guide.md`).',
    it: '5. Senza programmare: aggiungi parole nella pagina (scheda «Aggiunta»), scarica il tuo file di contributo e invialo in una issue o in una pull request; un manutentore lo importa con `python scripts/import_bundle.py` (vedi `docs/contributor-guide.md`).',
    es: '5. Sin programar: añade palabras en la página (pestaña «Añadir»), descarga tu archivo de contribución y envíalo en una issue o un pull request; un mantenedor lo importa con `python scripts/import_bundle.py` (consulta `docs/contributor-guide.md`).',
    pt: '5. Sem programar: acrescente palavras na página (separador «Adicionar»), descarregue o seu ficheiro de contribuição e envie-o numa issue ou num pull request; um responsável importa-o com `python scripts/import_bundle.py` (veja `docs/contributor-guide.md`).',
    de: '5. Ohne Programmieren: Füge Wörter auf der Seite hinzu (Reiter „Hinzufügen“), lade deine Beitragsdatei herunter und schicke sie in einem Issue oder Pull Request; eine betreuende Person importiert sie mit `python scripts/import_bundle.py` (siehe `docs/contributor-guide.md`).',
    hu: '5. Programozás nélkül: adj hozzá szavakat az oldalon („Hozzáadás” lap), töltsd le a hozzájárulási fájlodat, és küldd el egy issue-ban vagy pull requestben; egy karbantartó a `python scripts/import_bundle.py` paranccsal importálja (lásd `docs/contributor-guide.md`).'
  };

  const body = (t) => t.join('\n');
  const contrib = {
    heading: {en: 'Adding words and recordings', ro: 'Adăugarea de cuvinte și înregistrări', fr: 'Ajouter des mots et des enregistrements', it: 'Aggiungere parole e registrazioni', es: 'Añadir palabras y grabaciones', pt: 'Acrescentar palavras e gravações', de: 'Wörter und Aufnahmen beitragen', hu: 'Szavak és hangfelvételek hozzáadása'},
    body: {
      en: body([
        '1. Open the page (`index.html`, or https://glosar.chiuta.ro) and go to the “Add” tab: choose the language, write the word and its meaning in at least one language, pick the part of speech, and add the dialect and the spelling system if you know them.',
        '2. Always give the source: a book or a web page (with its address), or the speaker you heard the word from. Mark an entry `sourced` only when you copied it from a published source, and `reviewed` only when a speaker other than you confirmed it and gave their name.',
        '3. Write only what you know or can cite; never fill a gap from memory for a language you do not speak. Do not reproduce a copyrighted dictionary (single words with their source are fine; long lists and definitions are not), and record only people who agreed.',
        '4. Optionally record the word (see `docs/recording-guide.md`): Opus in Ogg or WebM, at most 50 KB.',
        '5. Press “Download everything” and send `glosar-contribution.json` in an issue or a pull request; a maintainer runs `python scripts/import_bundle.py glosar-contribution.json` and then `python scripts/validate.py`.',
        '6. If you prefer files, copy `data/dictionaries/example.json` to `data/dictionaries/<lang>-<headword>.json` (the headword without diacritics: `ruq-tinti.json`; a second entry with the same headword gets `-2`), edit it and run `python scripts/validate.py`.',
        '7. Speakers can help most by reviewing the starter entries and recording the numerals: open an issue with the entry id (`rup-tsintsi`) and your correction. Details in `docs/contributor-guide.md`.'
      ]),
      ro: body([
        '1. Deschide pagina (`index.html` sau https://glosar.chiuta.ro) și mergi la fila «Adăugare»: alege limba, scrie cuvântul și sensul lui în cel puțin o limbă, alege partea de vorbire și adaugă dialectul și sistemul de scriere dacă le știi.',
        '2. Dă mereu sursa: o carte sau o pagină web (cu adresa ei) ori vorbitorul de la care ai auzit cuvântul. Marchează o intrare `sourced` doar dacă ai copiat-o dintr-o sursă publicată și `reviewed` doar dacă un alt vorbitor decât tine a confirmat-o și și-a spus numele.',
        '3. Scrie doar ce știi sau poți cita; nu completa niciodată din memorie o limbă pe care nu o vorbești. Nu reproduce un dicționar protejat de drepturi de autor (cuvintele luate separat, cu sursa lor, sunt în regulă; listele lungi și definițiile nu) și înregistrează doar persoane care au fost de acord.',
        '4. Opțional, înregistrează cuvântul (vezi `docs/recording-guide.ro.md`): Opus în Ogg sau WebM, cel mult 50 KB.',
        '5. Apasă «Descarcă tot» și trimite `glosar-contribution.json` într-un issue sau un pull request; un responsabil rulează `python scripts/import_bundle.py glosar-contribution.json`, apoi `python scripts/validate.py`.',
        '6. Dacă preferi fișierele, copiază `data/dictionaries/example.json` în `data/dictionaries/<lang>-<headword>.json` (cuvântul fără diacritice: `ruq-tinti.json`; a doua intrare cu același cuvânt primește `-2`), editează-l și rulează `python scripts/validate.py`.',
        '7. Vorbitorii pot ajuta cel mai mult revizuind intrările de pornire și înregistrând numeralele: deschide un issue cu id-ul intrării (`rup-tsintsi`) și corectura ta. Detalii în `docs/contributor-guide.ro.md`.'
      ]),
      fr: body([
        '1. Ouvrez la page (`index.html` ou https://glosar.chiuta.ro) et allez à l’onglet « Ajout » : choisissez la langue, écrivez le mot et son sens dans au moins une langue, choisissez la catégorie grammaticale et ajoutez le dialecte et le système d’écriture si vous les connaissez.',
        '2. Donnez toujours la source : un livre ou une page web (avec son adresse), ou le locuteur dont vous tenez le mot. Marquez une entrée `sourced` seulement si vous l’avez copiée d’une source publiée, et `reviewed` seulement si un autre locuteur que vous l’a confirmée et a donné son nom.',
        '3. N’écrivez que ce que vous savez ou pouvez citer ; ne comblez jamais un vide de mémoire pour une langue que vous ne parlez pas. Ne reproduisez pas un dictionnaire protégé (des mots isolés avec leur source, c’est permis ; de longues listes et des définitions, non) et n’enregistrez que des personnes consentantes.',
        '4. Facultatif : enregistrez le mot (voir `docs/recording-guide.md`) : Opus dans Ogg ou WebM, 50 Ko au plus.',
        '5. Appuyez sur « Tout télécharger » et envoyez `glosar-contribution.json` dans une issue ou une pull request ; un mainteneur lance `python scripts/import_bundle.py glosar-contribution.json`, puis `python scripts/validate.py`.',
        '6. Si vous préférez les fichiers, copiez `data/dictionaries/example.json` vers `data/dictionaries/<lang>-<headword>.json` (le mot sans diacritiques : `ruq-tinti.json` ; une deuxième entrée avec le même mot reçoit `-2`), modifiez-le et lancez `python scripts/validate.py`.',
        '7. Les locuteurs aident le plus en relisant les entrées de départ et en enregistrant les nombres : ouvrez une issue avec l’identifiant de l’entrée (`rup-tsintsi`) et votre correction. Détails dans `docs/contributor-guide.md`.'
      ]),
      it: body([
        '1. Apri la pagina (`index.html` o https://glosar.chiuta.ro) e vai alla scheda «Aggiunta»: scegli la lingua, scrivi la parola e il suo significato in almeno una lingua, scegli la parte del discorso e aggiungi il dialetto e il sistema ortografico se li conosci.',
        '2. Indica sempre la fonte: un libro o una pagina web (con il suo indirizzo), oppure il parlante da cui hai sentito la parola. Segna una voce `sourced` solo se l’hai copiata da una fonte pubblicata e `reviewed` solo se un altro parlante l’ha confermata e ha dato il suo nome.',
        '3. Scrivi solo ciò che sai o puoi citare; non colmare mai un vuoto a memoria per una lingua che non parli. Non riprodurre un dizionario protetto (singole parole con la loro fonte vanno bene; lunghi elenchi e definizioni no) e registra solo persone consenzienti.',
        '4. Facoltativo: registra la parola (vedi `docs/recording-guide.md`): Opus in Ogg o WebM, al massimo 50 KB.',
        '5. Premi «Scarica tutto» e invia `glosar-contribution.json` in una issue o in una pull request; un manutentore esegue `python scripts/import_bundle.py glosar-contribution.json` e poi `python scripts/validate.py`.',
        '6. Se preferisci i file, copia `data/dictionaries/example.json` in `data/dictionaries/<lang>-<headword>.json` (la parola senza segni diacritici: `ruq-tinti.json`; una seconda voce con la stessa parola riceve `-2`), modificalo ed esegui `python scripts/validate.py`.',
        '7. I parlanti aiutano di più rivedendo le voci iniziali e registrando i numerali: apri una issue con l’id della voce (`rup-tsintsi`) e la tua correzione. Dettagli in `docs/contributor-guide.md`.'
      ]),
      es: body([
        '1. Abre la página (`index.html` o https://glosar.chiuta.ro) y ve a la pestaña «Añadir»: elige el idioma, escribe la palabra y su significado en al menos un idioma, elige la categoría gramatical y añade el dialecto y el sistema ortográfico si los conoces.',
        '2. Indica siempre la fuente: un libro o una página web (con su dirección), o el hablante de quien oíste la palabra. Marca una entrada como `sourced` solo si la copiaste de una fuente publicada, y como `reviewed` solo si otro hablante distinto de ti la confirmó y dio su nombre.',
        '3. Escribe solo lo que sabes o puedes citar; nunca rellenes un hueco de memoria en un idioma que no hablas. No reproduzcas un diccionario protegido (las palabras sueltas con su fuente están bien; las listas largas y las definiciones, no) y graba solo a personas que lo hayan aceptado.',
        '4. Opcionalmente, graba la palabra (consulta `docs/recording-guide.md`): Opus en Ogg o WebM, 50 KB como máximo.',
        '5. Pulsa «Descargar todo» y envía `glosar-contribution.json` en una issue o un pull request; un mantenedor ejecuta `python scripts/import_bundle.py glosar-contribution.json` y después `python scripts/validate.py`.',
        '6. Si prefieres los archivos, copia `data/dictionaries/example.json` en `data/dictionaries/<lang>-<headword>.json` (la palabra sin diacríticos: `ruq-tinti.json`; una segunda entrada con la misma palabra recibe `-2`), edítalo y ejecuta `python scripts/validate.py`.',
        '7. Los hablantes ayudan más revisando las entradas iniciales y grabando los numerales: abre una issue con el id de la entrada (`rup-tsintsi`) y tu corrección. Detalles en `docs/contributor-guide.md`.'
      ]),
      pt: body([
        '1. Abra a página (`index.html` ou https://glosar.chiuta.ro) e vá ao separador «Adicionar»: escolha a língua, escreva a palavra e o seu significado em pelo menos uma língua, escolha a classe gramatical e acrescente o dialeto e o sistema ortográfico, se os conhecer.',
        '2. Indique sempre a fonte: um livro ou uma página web (com o seu endereço), ou o falante de quem ouviu a palavra. Marque uma entrada como `sourced` só se a copiou de uma fonte publicada, e como `reviewed` só se outro falante, que não você, a confirmou e deu o seu nome.',
        '3. Escreva só o que sabe ou pode citar; nunca preencha uma lacuna de memória numa língua que não fala. Não reproduza um dicionário protegido (palavras soltas com a sua fonte estão bem; listas longas e definições não) e grave apenas pessoas que concordaram.',
        '4. Opcionalmente, grave a palavra (veja `docs/recording-guide.md`): Opus em Ogg ou WebM, no máximo 50 KB.',
        '5. Prima «Descarregar tudo» e envie `glosar-contribution.json` numa issue ou num pull request; um responsável executa `python scripts/import_bundle.py glosar-contribution.json` e depois `python scripts/validate.py`.',
        '6. Se preferir ficheiros, copie `data/dictionaries/example.json` para `data/dictionaries/<lang>-<headword>.json` (a palavra sem diacríticos: `ruq-tinti.json`; uma segunda entrada com a mesma palavra recebe `-2`), edite-o e execute `python scripts/validate.py`.',
        '7. Os falantes ajudam mais revendo as entradas iniciais e gravando os numerais: abra uma issue com o id da entrada (`rup-tsintsi`) e a sua correção. Detalhes em `docs/contributor-guide.md`.'
      ]),
      de: body([
        '1. Öffne die Seite (`index.html` oder https://glosar.chiuta.ro) und wechsle zum Reiter „Hinzufügen“: Wähle die Sprache, schreibe das Wort und seine Bedeutung in mindestens einer Sprache, wähle die Wortart und ergänze Dialekt und Schreibsystem, wenn du sie kennst.',
        '2. Gib immer die Quelle an: ein Buch oder eine Webseite (mit Adresse) oder die Sprecherin bzw. den Sprecher, von der oder dem du das Wort gehört hast. Markiere einen Eintrag nur dann als `sourced`, wenn du ihn aus einer veröffentlichten Quelle übernommen hast, und nur dann als `reviewed`, wenn eine andere Person als du ihn bestätigt und ihren Namen genannt hat.',
        '3. Schreibe nur, was du weißt oder belegen kannst; fülle für eine Sprache, die du nicht sprichst, nie eine Lücke aus dem Gedächtnis. Gib kein urheberrechtlich geschütztes Wörterbuch wieder (einzelne Wörter mit Quelle sind in Ordnung, lange Listen und Definitionen nicht) und nimm nur Personen auf, die einverstanden sind.',
        '4. Optional: Nimm das Wort auf (siehe `docs/recording-guide.md`): Opus in Ogg oder WebM, höchstens 50 KB.',
        '5. Drücke „Alles herunterladen“ und schicke `glosar-contribution.json` in einem Issue oder Pull Request; eine betreuende Person führt `python scripts/import_bundle.py glosar-contribution.json` und danach `python scripts/validate.py` aus.',
        '6. Wenn du Dateien bevorzugst, kopiere `data/dictionaries/example.json` nach `data/dictionaries/<lang>-<headword>.json` (das Wort ohne Diakritika: `ruq-tinti.json`; ein zweiter Eintrag mit demselben Wort erhält `-2`), bearbeite sie und führe `python scripts/validate.py` aus.',
        '7. Sprecherinnen und Sprecher helfen am meisten, indem sie die Startdatensätze prüfen und die Zahlwörter aufnehmen: Eröffne ein Issue mit der Eintrags-id (`rup-tsintsi`) und deiner Korrektur. Einzelheiten in `docs/contributor-guide.md`.'
      ]),
      hu: body([
        '1. Nyisd meg az oldalt (`index.html` vagy https://glosar.chiuta.ro), és lépj a „Hozzáadás” lapra: válaszd ki a nyelvet, írd le a szót és a jelentését legalább egy nyelven, válaszd ki a szófajt, és add meg a nyelvjárást és az írásrendszert, ha ismered őket.',
        '2. Mindig add meg a forrást: egy könyvet vagy weboldalt (a címével), illetve a beszélőt, akitől a szót hallottad. Egy szócikket csak akkor jelölj `sourced` állapotúnak, ha közölt forrásból másoltad, és csak akkor `reviewed` állapotúnak, ha rajtad kívül egy másik beszélő megerősítette, és megadta a nevét.',
        '3. Csak azt írd le, amit tudsz vagy amit idézni tudsz; olyan nyelvnél, amelyet nem beszélsz, soha ne pótolj hiányt emlékezetből. Ne másolj le jogvédett szótárt (egyes szavak a forrásukkal rendben vannak, hosszú listák és meghatározások nem), és csak olyanokat vegyél fel, akik beleegyeztek.',
        '4. Opcionálisan vedd fel a szót (lásd `docs/recording-guide.md`): Opus Ogg vagy WebM tárolóban, legfeljebb 50 KB.',
        '5. Nyomd meg a „Minden letöltése” gombot, és küldd el a `glosar-contribution.json` fájlt egy issue-ban vagy pull requestben; egy karbantartó lefuttatja a `python scripts/import_bundle.py glosar-contribution.json`, majd a `python scripts/validate.py` parancsot.',
        '6. Ha inkább fájlokkal dolgozol, másold a `data/dictionaries/example.json` fájlt a `data/dictionaries/<lang>-<headword>.json` helyre (a szó ékezetek nélkül: `ruq-tinti.json`; az azonos szóval készült második szócikk `-2` végződést kap), szerkeszd, és futtasd a `python scripts/validate.py` parancsot.',
        '7. A beszélők úgy segíthetnek a legtöbbet, ha átnézik a kezdő szócikkeket és felveszik a számneveket: nyiss egy issue-t a szócikk azonosítójával (`rup-tsintsi`) és a javításoddal. Részletek a `docs/contributor-guide.md` fájlban.'
      ])
    }
  };

  const issues = {
    en: [
      'Have Aromanian speakers review the 11 starter entries (`rup-*`), correct them and set `status: reviewed` with `reviewed_by`',
      'Have Megleno-Romanian speakers review the 10 starter entries (`ruq-*`) in the same way',
      'Have Romani speakers review the 22 starter entries (`rom-*`) and add the `dialect` of each form (the sources do not give it)',
      'Add the first Istro-Romanian (`ruo`) entries from a published source, with its web address (never from memory)',
      'Add another minority or endangered language to `data/languages.json` (ISO 639-3 code, dialects, spelling systems) with a first word list from a cited source',
      'Extend the basic list to 100 concepts in `data/concepts.json` and add the concept names in French, Italian, Spanish, Portuguese, German and Hungarian (they exist only in English and Romanian)',
      'Record the ten numerals of each language with the app (Opus, under 50 KB) and send the contribution file (speakers only)',
      'Have native speakers review the interface texts in `src/i18n.mjs` (French, Italian, Spanish, Portuguese, German, Hungarian); they were written with an AI assistant',
      'Add a dialect filter and a spelling-system filter to the search tab, with tests',
      'Make recording work in Safari: record WAV in the page and encode it to Opus in JavaScript (no network, at most 50 KB), or document an `ffmpeg` command in `docs/recording-guide.md`'
    ],
    ro: [
      'Cere vorbitorilor de aromână să revizuiască cele 11 intrări de pornire (`rup-*`), să le corecteze și să pună `status: reviewed` cu `reviewed_by`',
      'Cere vorbitorilor de meglenoromână să revizuiască în același fel cele 10 intrări de pornire (`ruq-*`)',
      'Cere vorbitorilor de romani să revizuiască cele 22 de intrări de pornire (`rom-*`) și să adauge `dialect` pentru fiecare formă (sursele nu îl dau)',
      'Adaugă primele intrări în istroromână (`ruo`) dintr-o sursă publicată, cu adresa ei web (niciodată din memorie)',
      'Adaugă în `data/languages.json` o altă limbă minoritară sau pe cale de dispariție (cod ISO 639-3, dialecte, sisteme de scriere), cu o primă listă de cuvinte dintr-o sursă citată',
      'Extinde lista de bază la 100 de concepte în `data/concepts.json` și adaugă numele conceptelor în franceză, italiană, spaniolă, portugheză, germană și maghiară (există doar în engleză și română)',
      'Înregistrează cele zece numerale ale fiecărei limbi cu aplicația (Opus, sub 50 KB) și trimite fișierul de contribuție (doar vorbitori)',
      'Cere vorbitorilor nativi să revizuiască textele interfeței din `src/i18n.mjs` (franceză, italiană, spaniolă, portugheză, germană, maghiară); au fost scrise cu un asistent de IA',
      'Adaugă un filtru de dialect și unul de sistem de scriere în fila de căutare, cu teste',
      'Fă înregistrarea să funcționeze în Safari: înregistrează WAV în pagină și codează-l în Opus în JavaScript (fără rețea, cel mult 50 KB) sau documentează o comandă `ffmpeg` în `docs/recording-guide.ro.md`'
    ],
    fr: [
      'Faire relire par des locuteurs de l’aroumain les 11 entrées de départ (`rup-*`), les corriger et mettre `status: reviewed` avec `reviewed_by`',
      'Faire relire de la même façon par des locuteurs du mégléno-roumain les 10 entrées de départ (`ruq-*`)',
      'Faire relire par des locuteurs du romani les 22 entrées de départ (`rom-*`) et ajouter le `dialect` de chaque forme (les sources ne le donnent pas)',
      'Ajouter les premières entrées en istro-roumain (`ruo`) à partir d’une source publiée, avec son adresse web (jamais de mémoire)',
      'Ajouter une autre langue minoritaire ou en danger à `data/languages.json` (code ISO 639-3, dialectes, systèmes d’écriture) avec une première liste de mots tirée d’une source citée',
      'Étendre la liste de base à 100 concepts dans `data/concepts.json` et ajouter les noms des concepts en français, italien, espagnol, portugais, allemand et hongrois (ils n’existent qu’en anglais et en roumain)',
      'Enregistrer les dix nombres de chaque langue avec l’application (Opus, moins de 50 Ko) et envoyer le fichier de contribution (locuteurs uniquement)',
      'Faire relire par des locuteurs natifs les textes de l’interface dans `src/i18n.mjs` (français, italien, espagnol, portugais, allemand, hongrois) ; ils ont été rédigés avec un assistant d’IA',
      'Ajouter un filtre de dialecte et un filtre de système d’écriture à l’onglet de recherche, avec des tests',
      'Faire fonctionner l’enregistrement dans Safari : enregistrer en WAV dans la page et l’encoder en Opus en JavaScript (sans réseau, 50 Ko au plus), ou documenter une commande `ffmpeg` dans `docs/recording-guide.md`'
    ],
    it: [
      'Far rivedere da parlanti di aromeno le 11 voci iniziali (`rup-*`), correggerle e impostare `status: reviewed` con `reviewed_by`',
      'Far rivedere allo stesso modo da parlanti di megleno-rumeno le 10 voci iniziali (`ruq-*`)',
      'Far rivedere da parlanti di romaní le 22 voci iniziali (`rom-*`) e aggiungere il `dialect` di ogni forma (le fonti non lo indicano)',
      'Aggiungere le prime voci in istro-rumeno (`ruo`) da una fonte pubblicata, con il suo indirizzo web (mai a memoria)',
      'Aggiungere a `data/languages.json` un’altra lingua minoritaria o in pericolo (codice ISO 639-3, dialetti, sistemi ortografici) con un primo elenco di parole da una fonte citata',
      'Estendere l’elenco di base a 100 concetti in `data/concepts.json` e aggiungere i nomi dei concetti in francese, italiano, spagnolo, portoghese, tedesco e ungherese (esistono solo in inglese e rumeno)',
      'Registrare con l’app i dieci numerali di ogni lingua (Opus, sotto i 50 KB) e inviare il file di contributo (solo parlanti)',
      'Far rivedere da madrelingua i testi dell’interfaccia in `src/i18n.mjs` (francese, italiano, spagnolo, portoghese, tedesco, ungherese); sono stati scritti con un assistente di IA',
      'Aggiungere alla scheda di ricerca un filtro per dialetto e uno per sistema ortografico, con test',
      'Far funzionare la registrazione in Safari: registrare in WAV nella pagina e codificare in Opus in JavaScript (senza rete, al massimo 50 KB), oppure documentare un comando `ffmpeg` in `docs/recording-guide.md`'
    ],
    es: [
      'Pedir a hablantes de arrumano que revisen las 11 entradas iniciales (`rup-*`), las corrijan y pongan `status: reviewed` con `reviewed_by`',
      'Pedir del mismo modo a hablantes de megleno-rumano que revisen las 10 entradas iniciales (`ruq-*`)',
      'Pedir a hablantes de romaní que revisen las 22 entradas iniciales (`rom-*`) y añadan el `dialect` de cada forma (las fuentes no lo dan)',
      'Añadir las primeras entradas en istro-rumano (`ruo`) a partir de una fuente publicada, con su dirección web (nunca de memoria)',
      'Añadir a `data/languages.json` otra lengua minoritaria o en peligro (código ISO 639-3, dialectos, sistemas ortográficos) con una primera lista de palabras de una fuente citada',
      'Ampliar la lista básica a 100 conceptos en `data/concepts.json` y añadir los nombres de los conceptos en francés, italiano, español, portugués, alemán y húngaro (solo existen en inglés y rumano)',
      'Grabar con la aplicación los diez numerales de cada idioma (Opus, menos de 50 KB) y enviar el archivo de contribución (solo hablantes)',
      'Pedir a hablantes nativos que revisen los textos de la interfaz de `src/i18n.mjs` (francés, italiano, español, portugués, alemán, húngaro); se escribieron con un asistente de IA',
      'Añadir a la pestaña de búsqueda un filtro de dialecto y otro de sistema ortográfico, con pruebas',
      'Hacer que la grabación funcione en Safari: grabar WAV en la página y codificarlo a Opus en JavaScript (sin red, 50 KB como máximo), o documentar un comando `ffmpeg` en `docs/recording-guide.md`'
    ],
    pt: [
      'Pedir a falantes de arromeno que revejam as 11 entradas iniciais (`rup-*`), as corrijam e ponham `status: reviewed` com `reviewed_by`',
      'Pedir do mesmo modo a falantes de megleno-romeno que revejam as 10 entradas iniciais (`ruq-*`)',
      'Pedir a falantes de romani que revejam as 22 entradas iniciais (`rom-*`) e acrescentem o `dialect` de cada forma (as fontes não o indicam)',
      'Acrescentar as primeiras entradas em istro-romeno (`ruo`) a partir de uma fonte publicada, com o seu endereço web (nunca de memória)',
      'Acrescentar a `data/languages.json` outra língua minoritária ou em risco (código ISO 639-3, dialetos, sistemas ortográficos) com uma primeira lista de palavras de uma fonte citada',
      'Alargar a lista básica para 100 conceitos em `data/concepts.json` e acrescentar os nomes dos conceitos em francês, italiano, espanhol, português, alemão e húngaro (só existem em inglês e romeno)',
      'Gravar com a aplicação os dez numerais de cada língua (Opus, abaixo de 50 KB) e enviar o ficheiro de contribuição (só falantes)',
      'Pedir a falantes nativos que revejam os textos da interface em `src/i18n.mjs` (francês, italiano, espanhol, português, alemão, húngaro); foram escritos com um assistente de IA',
      'Acrescentar ao separador de pesquisa um filtro de dialeto e outro de sistema ortográfico, com testes',
      'Fazer a gravação funcionar no Safari: gravar WAV na página e codificá-lo em Opus em JavaScript (sem rede, no máximo 50 KB), ou documentar um comando `ffmpeg` em `docs/recording-guide.md`'
    ],
    de: [
      'Sprecher des Aromunischen die 11 Startdatensätze (`rup-*`) prüfen und korrigieren lassen und `status: reviewed` mit `reviewed_by` setzen',
      'Sprecher des Megleno-Rumänischen die 10 Startdatensätze (`ruq-*`) auf dieselbe Weise prüfen lassen',
      'Romani-Sprecher die 22 Startdatensätze (`rom-*`) prüfen lassen und den `dialect` jeder Form ergänzen (die Quellen nennen ihn nicht)',
      'Die ersten Einträge für Istro-Rumänisch (`ruo`) aus einer veröffentlichten Quelle mit ihrer Webadresse ergänzen (nie aus dem Gedächtnis)',
      'Eine weitere Minderheiten- oder gefährdete Sprache in `data/languages.json` aufnehmen (ISO-639-3-Code, Dialekte, Schreibsysteme) mit einer ersten Wortliste aus einer zitierten Quelle',
      'Die Grundliste in `data/concepts.json` auf 100 Begriffe erweitern und die Begriffsnamen auf Französisch, Italienisch, Spanisch, Portugiesisch, Deutsch und Ungarisch ergänzen (sie gibt es nur auf Englisch und Rumänisch)',
      'Die zehn Zahlwörter jeder Sprache mit der App aufnehmen (Opus, unter 50 KB) und die Beitragsdatei schicken (nur Sprecher)',
      'Die Oberflächentexte in `src/i18n.mjs` (Französisch, Italienisch, Spanisch, Portugiesisch, Deutsch, Ungarisch) von Muttersprachlern prüfen lassen; sie wurden mit einem KI-Assistenten geschrieben',
      'Dem Suchreiter einen Dialektfilter und einen Schreibsystemfilter hinzufügen, mit Tests',
      'Die Aufnahme in Safari zum Laufen bringen: WAV in der Seite aufnehmen und in JavaScript nach Opus kodieren (ohne Netzwerk, höchstens 50 KB) oder einen `ffmpeg`-Befehl in `docs/recording-guide.md` dokumentieren'
    ],
    hu: [
      'Aromán beszélőkkel átnézetni a 11 kezdő szócikket (`rup-*`), kijavíttatni őket, és beállítani a `status: reviewed` értéket a `reviewed_by` mezővel',
      'Meglenoromán beszélőkkel ugyanígy átnézetni a 10 kezdő szócikket (`ruq-*`)',
      'Romani beszélőkkel átnézetni a 22 kezdő szócikket (`rom-*`), és megadni minden alak `dialect` mezőjét (a források nem közlik)',
      'Az első isztroromán (`ruo`) szócikkek felvétele közölt forrásból, a webcímével (soha nem emlékezetből)',
      'Újabb kisebbségi vagy veszélyeztetett nyelv felvétele a `data/languages.json` fájlba (ISO 639-3 kód, nyelvjárások, írásrendszerek) idézett forrásból származó első szólistával',
      'Az alaplista bővítése 100 fogalomra a `data/concepts.json` fájlban, és a fogalomnevek hozzáadása franciául, olaszul, spanyolul, portugálul, németül és magyarul (jelenleg csak angolul és románul vannak meg)',
      'Minden nyelv tíz számnevének felvétele az alkalmazással (Opus, 50 KB alatt), és a hozzájárulási fájl elküldése (csak beszélőknek)',
      'A `src/i18n.mjs` felületi szövegeinek (francia, olasz, spanyol, portugál, német, magyar) átnézetése anyanyelvi beszélőkkel; MI-asszisztenssel íródtak',
      'Nyelvjárás- és írásrendszer-szűrő hozzáadása a keresés laphoz, tesztekkel',
      'A felvétel működtetése Safariban: WAV felvétele az oldalon és Opus-szá kódolása JavaScriptben (hálózat nélkül, legfeljebb 50 KB), vagy egy `ffmpeg` parancs dokumentálása a `docs/recording-guide.md` fájlban'
    ]
  };

  const added = {
    en: [
      'The engine in `src/engine.mjs`: search without regard to diacritics with ranking, validation of entries, duplicates, coverage of the basic list, TSV and Anki export, the contribution file and the parser for pasted lists.',
      'TSV export for spreadsheets: a cell that starts with `=`, `+`, `-` or `@` gets an apostrophe in front, so that Excel or LibreOffice does not run it as a formula (a word that really starts with `-` therefore shows the apostrophe); the Anki file escapes HTML.',
      'The interface in `src/ui.js`, `src/i18n.mjs` and `src/app.css`: search, coverage, add (with recording or upload), export and guide; eight languages, dark and light themes, keyboard, works from 360 px wide; what you add stays in the browser.',
      'Data: the language index `data/languages.json` (Aromanian, Megleno-Romanian, Istro-Romanian, Romani, with ISO 639-3 dialects and spelling systems), the list of 50 basic concepts `data/concepts.json` and 43 starter entries, each with a source (Wikipedia, Wiktionary, the Angloromani dictionary); a licence field for each source.',
      '`scripts/validate.py`: checks every file against its schema and the rules a schema cannot express (file name, references, `sourced` and `reviewed`, duplicates, Opus audio of at most 50 KB); `scripts/import_bundle.py` turns a contribution file into data files without overwriting anything.',
      '`docs/contributor-guide.md` and `docs/recording-guide.md` (also in Romanian): how to add words and recordings without coding.',
      'Tests: `npm test` (the engine, the data, the Python scripts, the build and the interface texts) and browser tests in the hub (eight languages, accessibility, hostile stored state, import and export, small screens).',
      '`src/` and `scripts/build.mjs`: the single `index.html` is now built from the sources, with the data and the recordings embedded, and `--check` verifies it.'
    ],
    ro: [
      'Motorul din `src/engine.mjs`: căutare fără să țină seama de diacritice, cu ordonarea rezultatelor, validarea intrărilor, duplicate, acoperirea listei de bază, export TSV și Anki, fișierul de contribuție și analizorul listelor lipite.',
      'Export TSV pentru foi de calcul: o celulă care începe cu `=`, `+`, `-` sau `@` primește un apostrof în față, ca Excel sau LibreOffice să nu o ruleze ca formulă (un cuvânt care chiar începe cu `-` arată deci apostroful); fișierul Anki scapă HTML-ul.',
      'Interfața din `src/ui.js`, `src/i18n.mjs` și `src/app.css`: căutare, acoperire, adăugare (cu înregistrare sau încărcare), export și ghid; opt limbi, teme întunecată și luminoasă, tastatură, funcționează de la 360 px lățime; ce adaugi rămâne în browser.',
      'Date: indexul limbilor `data/languages.json` (aromână, meglenoromână, istroromână, romani, cu dialecte ISO 639-3 și sisteme de scriere), lista celor 50 de concepte de bază `data/concepts.json` și 43 de intrări de pornire, fiecare cu sursă (Wikipedia, Wiktionary, dicționarul Angloromani); un câmp de licență pentru fiecare sursă.',
      '`scripts/validate.py`: verifică fiecare fișier față de schema lui și de regulile pe care o schemă nu le poate exprima (numele fișierului, trimiteri, `sourced` și `reviewed`, duplicate, audio Opus de cel mult 50 KB); `scripts/import_bundle.py` transformă un fișier de contribuție în fișiere de date fără să suprascrie nimic.',
      '`docs/contributor-guide.md` și `docs/recording-guide.md` (și în română): cum adaugi cuvinte și înregistrări fără programare.',
      'Teste: `npm test` (motorul, datele, scripturile Python, construcția și textele interfeței) și teste de browser în hub (opt limbi, accesibilitate, stare salvată ostilă, import și export, ecrane mici).',
      '`src/` și `scripts/build.mjs`: singurul `index.html` este acum construit din surse, cu datele și înregistrările încorporate, iar `--check` îl verifică.'
    ],
    fr: [
      'Le moteur dans `src/engine.mjs` : recherche sans tenir compte des diacritiques avec classement, validation des entrées, doublons, couverture de la liste de base, export TSV et Anki, fichier de contribution et analyseur des listes collées.',
      'Export TSV pour tableurs : une cellule qui commence par `=`, `+`, `-` ou `@` reçoit une apostrophe devant, pour qu’Excel ou LibreOffice ne l’exécute pas comme une formule (un mot qui commence vraiment par `-` montre donc l’apostrophe) ; le fichier Anki échappe le HTML.',
      'L’interface dans `src/ui.js`, `src/i18n.mjs` et `src/app.css` : recherche, couverture, ajout (avec enregistrement ou téléversement), export et guide ; huit langues, thèmes sombre et clair, clavier, utilisable dès 360 px de large ; ce que vous ajoutez reste dans le navigateur.',
      'Données : l’index des langues `data/languages.json` (aroumain, mégléno-roumain, istro-roumain, romani, avec dialectes ISO 639-3 et systèmes d’écriture), la liste des 50 concepts de base `data/concepts.json` et 43 entrées de départ, chacune avec une source (Wikipédia, Wiktionnaire, dictionnaire Angloromani) ; un champ de licence pour chaque source.',
      '`scripts/validate.py` : vérifie chaque fichier par rapport à son schéma et aux règles qu’un schéma ne peut pas exprimer (nom du fichier, renvois, `sourced` et `reviewed`, doublons, audio Opus de 50 Ko au plus) ; `scripts/import_bundle.py` transforme un fichier de contribution en fichiers de données sans rien écraser.',
      '`docs/contributor-guide.md` et `docs/recording-guide.md` (aussi en roumain) : comment ajouter des mots et des enregistrements sans programmer.',
      'Tests : `npm test` (le moteur, les données, les scripts Python, la construction et les textes de l’interface) et tests de navigateur dans le hub (huit langues, accessibilité, état enregistré hostile, import et export, petits écrans).',
      '`src/` et `scripts/build.mjs` : l’unique `index.html` est désormais construit à partir des sources, données et enregistrements intégrés, et `--check` le vérifie.'
    ],
    it: [
      'Il motore in `src/engine.mjs`: ricerca senza badare ai segni diacritici con ordinamento, convalida delle voci, duplicati, copertura dell’elenco di base, esportazione TSV e Anki, file di contributo e analizzatore degli elenchi incollati.',
      'Esportazione TSV per fogli di calcolo: una cella che inizia con `=`, `+`, `-` o `@` riceve un apostrofo davanti, in modo che Excel o LibreOffice non la eseguano come formula (una parola che inizia davvero con `-` mostra quindi l’apostrofo); il file Anki esegue l’escape dell’HTML.',
      'L’interfaccia in `src/ui.js`, `src/i18n.mjs` e `src/app.css`: ricerca, copertura, aggiunta (con registrazione o caricamento), esportazione e guida; otto lingue, temi scuro e chiaro, tastiera, funziona da 360 px di larghezza; ciò che aggiungi resta nel browser.',
      'Dati: l’indice delle lingue `data/languages.json` (aromeno, megleno-rumeno, istro-rumeno, romaní, con dialetti ISO 639-3 e sistemi ortografici), l’elenco dei 50 concetti di base `data/concepts.json` e 43 voci iniziali, ciascuna con una fonte (Wikipedia, Wikizionario, dizionario Angloromani); un campo licenza per ogni fonte.',
      '`scripts/validate.py`: controlla ogni file rispetto al suo schema e alle regole che uno schema non può esprimere (nome del file, rinvii, `sourced` e `reviewed`, duplicati, audio Opus di al massimo 50 KB); `scripts/import_bundle.py` trasforma un file di contributo in file di dati senza sovrascrivere nulla.',
      '`docs/contributor-guide.md` e `docs/recording-guide.md` (anche in rumeno): come aggiungere parole e registrazioni senza programmare.',
      'Test: `npm test` (il motore, i dati, gli script Python, la build e i testi dell’interfaccia) e test del browser nell’hub (otto lingue, accessibilità, stato salvato ostile, importazione ed esportazione, schermi piccoli).',
      '`src/` e `scripts/build.mjs`: l’unico `index.html` è ora costruito dai sorgenti, con dati e registrazioni incorporati, e `--check` lo verifica.'
    ],
    es: [
      'El motor en `src/engine.mjs`: búsqueda sin tener en cuenta los diacríticos con ordenación, validación de entradas, duplicados, cobertura de la lista básica, exportación a TSV y Anki, archivo de contribución y analizador de listas pegadas.',
      'Exportación TSV para hojas de cálculo: una celda que empieza por `=`, `+`, `-` o `@` recibe un apóstrofo delante, para que Excel o LibreOffice no la ejecuten como fórmula (una palabra que de verdad empieza por `-` muestra, por tanto, el apóstrofo); el archivo de Anki escapa el HTML.',
      'La interfaz en `src/ui.js`, `src/i18n.mjs` y `src/app.css`: búsqueda, cobertura, alta (con grabación o subida), exportación y guía; ocho idiomas, temas oscuro y claro, teclado, funciona desde 360 px de ancho; lo que añades se queda en el navegador.',
      'Datos: el índice de idiomas `data/languages.json` (arrumano, megleno-rumano, istro-rumano, romaní, con dialectos ISO 639-3 y sistemas ortográficos), la lista de 50 conceptos básicos `data/concepts.json` y 43 entradas iniciales, cada una con fuente (Wikipedia, Wikcionario, diccionario Angloromani); un campo de licencia para cada fuente.',
      '`scripts/validate.py`: comprueba cada archivo con su esquema y con las reglas que un esquema no puede expresar (nombre del archivo, referencias, `sourced` y `reviewed`, duplicados, audio Opus de 50 KB como máximo); `scripts/import_bundle.py` convierte un archivo de contribución en archivos de datos sin sobrescribir nada.',
      '`docs/contributor-guide.md` y `docs/recording-guide.md` (también en rumano): cómo añadir palabras y grabaciones sin programar.',
      'Pruebas: `npm test` (el motor, los datos, los scripts de Python, la compilación y los textos de la interfaz) y pruebas de navegador en el hub (ocho idiomas, accesibilidad, estado guardado hostil, importación y exportación, pantallas pequeñas).',
      '`src/` y `scripts/build.mjs`: el único `index.html` se construye ahora a partir de las fuentes, con los datos y las grabaciones incorporados, y `--check` lo verifica.'
    ],
    pt: [
      'O motor em `src/engine.mjs`: pesquisa sem ter em conta os diacríticos com ordenação, validação das entradas, duplicados, cobertura da lista básica, exportação para TSV e Anki, ficheiro de contribuição e analisador de listas coladas.',
      'Exportação TSV para folhas de cálculo: uma célula que começa por `=`, `+`, `-` ou `@` recebe um apóstrofo à frente, para que o Excel ou o LibreOffice não a executem como fórmula (uma palavra que realmente começa por `-` mostra, por isso, o apóstrofo); o ficheiro Anki escapa o HTML.',
      'A interface em `src/ui.js`, `src/i18n.mjs` e `src/app.css`: pesquisa, cobertura, adição (com gravação ou carregamento), exportação e guia; oito línguas, temas escuro e claro, teclado, funciona desde 360 px de largura; o que acrescenta fica no navegador.',
      'Dados: o índice de línguas `data/languages.json` (arromeno, megleno-romeno, istro-romeno, romani, com dialetos ISO 639-3 e sistemas ortográficos), a lista dos 50 conceitos básicos `data/concepts.json` e 43 entradas iniciais, cada uma com fonte (Wikipédia, Wikcionário, dicionário Angloromani); um campo de licença para cada fonte.',
      '`scripts/validate.py`: verifica cada ficheiro com o seu esquema e com as regras que um esquema não consegue exprimir (nome do ficheiro, referências, `sourced` e `reviewed`, duplicados, áudio Opus de no máximo 50 KB); `scripts/import_bundle.py` transforma um ficheiro de contribuição em ficheiros de dados sem sobrescrever nada.',
      '`docs/contributor-guide.md` e `docs/recording-guide.md` (também em romeno): como acrescentar palavras e gravações sem programar.',
      'Testes: `npm test` (o motor, os dados, os scripts Python, a compilação e os textos da interface) e testes de navegador no hub (oito línguas, acessibilidade, estado guardado hostil, importação e exportação, ecrãs pequenos).',
      '`src/` e `scripts/build.mjs`: o único `index.html` é agora construído a partir das fontes, com os dados e as gravações incorporados, e `--check` verifica-o.'
    ],
    de: [
      'Der Motor in `src/engine.mjs`: Suche ohne Rücksicht auf Diakritika mit Rangfolge, Validierung der Einträge, Duplikate, Abdeckung der Grundliste, TSV- und Anki-Export, Beitragsdatei und Parser für eingefügte Listen.',
      'TSV-Export für Tabellenkalkulationen: Eine Zelle, die mit `=`, `+`, `-` oder `@` beginnt, erhält ein Apostroph davor, damit Excel oder LibreOffice sie nicht als Formel ausführt (ein Wort, das wirklich mit `-` beginnt, zeigt daher das Apostroph); die Anki-Datei maskiert HTML.',
      'Die Oberfläche in `src/ui.js`, `src/i18n.mjs` und `src/app.css`: Suche, Abdeckung, Hinzufügen (mit Aufnahme oder Upload), Export und Anleitung; acht Sprachen, dunkles und helles Design, Tastatur, nutzbar ab 360 px Breite; was du hinzufügst, bleibt im Browser.',
      'Daten: der Sprachindex `data/languages.json` (Aromunisch, Megleno-Rumänisch, Istro-Rumänisch, Romani, mit ISO-639-3-Dialekten und Schreibsystemen), die Liste der 50 Grundbegriffe `data/concepts.json` und 43 Startdatensätze, jeweils mit Quelle (Wikipedia, Wiktionary, Angloromani-Wörterbuch); ein Lizenzfeld für jede Quelle.',
      '`scripts/validate.py`: prüft jede Datei gegen ihr Schema und die Regeln, die ein Schema nicht ausdrücken kann (Dateiname, Verweise, `sourced` und `reviewed`, Duplikate, Opus-Audio von höchstens 50 KB); `scripts/import_bundle.py` wandelt eine Beitragsdatei in Datendateien um, ohne etwas zu überschreiben.',
      '`docs/contributor-guide.md` und `docs/recording-guide.md` (auch auf Rumänisch): wie man Wörter und Aufnahmen ohne Programmieren beiträgt.',
      'Tests: `npm test` (der Motor, die Daten, die Python-Skripte, der Build und die Oberflächentexte) und Browsertests im Hub (acht Sprachen, Barrierefreiheit, feindlicher gespeicherter Zustand, Import und Export, kleine Bildschirme).',
      '`src/` und `scripts/build.mjs`: Die eine `index.html` wird jetzt aus den Quellen gebaut, mit eingebetteten Daten und Aufnahmen, und `--check` prüft sie.'
    ],
    hu: [
      'A motor a `src/engine.mjs` fájlban: ékezetektől független keresés rangsorolással, a szócikkek ellenőrzése, ismétlődések, az alaplista lefedettsége, TSV- és Anki-export, hozzájárulási fájl és a beillesztett listák értelmezője.',
      'TSV-export táblázatkezelőknek: az `=`, `+`, `-` vagy `@` jellel kezdődő cella elé aposztróf kerül, hogy az Excel vagy a LibreOffice ne futtassa képletként (az a szó, amely valóban `-` jellel kezdődik, ezért az aposztrófot is mutatja); az Anki-fájl elmenekíti a HTML-t.',
      'A felület a `src/ui.js`, `src/i18n.mjs` és `src/app.css` fájlokban: keresés, lefedettség, hozzáadás (felvétellel vagy feltöltéssel), exportálás és útmutató; nyolc nyelv, sötét és világos téma, billentyűzet, 360 px szélességtől működik; amit hozzáadsz, a böngészőben marad.',
      'Adatok: a nyelvek jegyzéke a `data/languages.json` (aromán, meglenoromán, isztroromán, romani, ISO 639-3 nyelvjárásokkal és írásrendszerekkel), az 50 alapfogalom listája a `data/concepts.json` és 43 kezdő szócikk, mindegyik forrással (Wikipédia, Wikiszótár, Angloromani szótár); minden forráshoz licencmező.',
      '`scripts/validate.py`: minden fájlt ellenőriz a sémája és azok a szabályok szerint, amelyeket egy séma nem tud kifejezni (fájlnév, hivatkozások, `sourced` és `reviewed`, ismétlődések, legfeljebb 50 KB-os Opus hang); a `scripts/import_bundle.py` a hozzájárulási fájlt adatfájlokká alakítja, anélkül hogy bármit felülírna.',
      '`docs/contributor-guide.md` és `docs/recording-guide.md` (románul is): hogyan adhatsz hozzá szavakat és felvételeket programozás nélkül.',
      'Tesztek: `npm test` (a motor, az adatok, a Python-szkriptek, az építés és a felületi szövegek) és böngészőtesztek a hubban (nyolc nyelv, akadálymentesség, ellenséges mentett állapot, import és export, kis képernyők).',
      '`src/` és `scripts/build.mjs`: az egyetlen `index.html` mostantól forrásokból épül, beágyazott adatokkal és felvételekkel, és a `--check` ellenőrzi.'
    ]
  };
  for (const l of L) added[l] = [...added[l], ...legacy[l]];

  const changed = {
    en: ['The workflow runs on Ubuntu 26.04 with Node.js 26 and also runs the tests, the build check and the data validation.', '`schema.json` rejects unknown fields; `lang` is a bare ISO 639-3 code (dialects go in `dialect`) and `numeral` is a new part of speech.', 'The README no longer lists a planned scope: it describes what the page does and what it does not do yet.'],
    ro: ['Fluxul de lucru rulează pe Ubuntu 26.04 cu Node.js 26 și rulează și testele, verificarea construcției și validarea datelor.', '`schema.json` respinge câmpurile necunoscute; `lang` este un cod ISO 639-3 simplu (dialectele merg în `dialect`), iar `numeral` este o parte de vorbire nouă.', 'README nu mai enumeră un domeniu planificat: descrie ce face pagina și ce nu face încă.'],
    fr: ['Le workflow s’exécute sur Ubuntu 26.04 avec Node.js 26 et lance aussi les tests, la vérification de la construction et la validation des données.', '`schema.json` rejette les champs inconnus ; `lang` est un simple code ISO 639-3 (les dialectes vont dans `dialect`) et `numeral` est une nouvelle catégorie grammaticale.', 'Le README ne liste plus un périmètre prévu : il décrit ce que fait la page et ce qu’elle ne fait pas encore.'],
    it: ['Il workflow gira su Ubuntu 26.04 con Node.js 26 ed esegue anche i test, il controllo della build e la convalida dei dati.', '`schema.json` rifiuta i campi sconosciuti; `lang` è un semplice codice ISO 639-3 (i dialetti vanno in `dialect`) e `numeral` è una nuova parte del discorso.', 'Il README non elenca più un ambito previsto: descrive cosa fa la pagina e cosa non fa ancora.'],
    es: ['El workflow se ejecuta en Ubuntu 26.04 con Node.js 26 y ejecuta también las pruebas, la comprobación de la compilación y la validación de los datos.', '`schema.json` rechaza los campos desconocidos; `lang` es un código ISO 639-3 simple (los dialectos van en `dialect`) y `numeral` es una nueva categoría gramatical.', 'El README ya no enumera un alcance previsto: describe lo que hace la página y lo que aún no hace.'],
    pt: ['O workflow corre em Ubuntu 26.04 com Node.js 26 e executa também os testes, a verificação da compilação e a validação dos dados.', '`schema.json` rejeita os campos desconhecidos; `lang` é um código ISO 639-3 simples (os dialetos vão em `dialect`) e `numeral` é uma nova classe gramatical.', 'O README já não enumera um âmbito previsto: descreve o que a página faz e o que ainda não faz.'],
    de: ['Der Workflow läuft auf Ubuntu 26.04 mit Node.js 26 und führt auch die Tests, die Build-Prüfung und die Datenvalidierung aus.', '`schema.json` lehnt unbekannte Felder ab; `lang` ist ein einfacher ISO-639-3-Code (Dialekte gehören in `dialect`) und `numeral` ist eine neue Wortart.', 'Die README führt keinen geplanten Umfang mehr auf: Sie beschreibt, was die Seite kann und was sie noch nicht kann.'],
    hu: ['A munkafolyamat Ubuntu 26.04 és Node.js 26 alatt fut, és a teszteket, a build-ellenőrzést meg az adatok ellenőrzését is futtatja.', 'A `schema.json` elutasítja az ismeretlen mezőket; a `lang` egyszerű ISO 639-3 kód (a nyelvjárások a `dialect` mezőbe kerülnek), a `numeral` pedig új szófaj.', 'A README már nem sorol fel tervezett terjedelmet: azt írja le, mit tud az oldal, és mit nem tud még.']
  };

  return {
    slug: 'glosar', version: '0.2.0', updated: '2026-11-17',
    headings: {
      does: {en: 'What it does', ro: 'Ce face', fr: 'Ce que fait l’application', it: 'Cosa fa', es: 'Qué hace', pt: 'O que faz', de: 'Was es kann', hu: 'Mit tud'},
      how: {en: 'How it works', ro: 'Cum funcționează', fr: 'Comment ça marche', it: 'Come funziona', es: 'Cómo funciona', pt: 'Como funciona', de: 'Wie es funktioniert', hu: 'Hogyan működik'},
      limits: limHeading
    },
    status, does, how, limits, extraSteps, contrib, issues,
    changelog: {added, changed}
  };
}
