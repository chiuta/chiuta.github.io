// Specificația documentației REGULA (opt limbi). Folosită de tools/alpha/docs.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAMES = ['nine-mens-morris', 'alquerque', 'fanorona', 'mu-torere', 'hnefatafl'];

export default async function (root) {
  const dir = path.join(root, 'regula');
  const I18N = (await import(pathToFileURL(path.join(dir, 'src', 'i18n.mjs')).href)).default;
  const legacy = JSON.parse(fs.readFileSync(path.join(HERE, 'regula.legacy.json'), 'utf8'));
  const games = GAMES.map((id) => JSON.parse(fs.readFileSync(path.join(dir, 'data', 'games', id + '.json'), 'utf8')));
  const L = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
  const list = {};
  for (const l of L) list[l] = games.map((g) => (l === 'en' ? g.name : (g.names && g.names[l]) || g.name)).join(', ');
  const limits = {}, limHeading = {};
  for (const l of L) { limits[l] = [1, 2, 3, 4, 5, 6].map((i) => I18N[l]['lim_' + i]); limHeading[l] = I18N[l].h_limits; }
  const cu = {}, va = {};
  for (const l of L) { cu[l] = I18N[l].h_custom; va[l] = I18N[l].btn_validate; }

  const status = {
    en: 'Alpha, usable: five classic two-player games are playable in the single `index.html` (open it offline, no server) against the computer or another person; the rules of each game are written out in eight languages from the same data the engine plays, and you can paste your own game file. The limits are listed below.',
    ro: 'Alfa, utilizabil: cinci jocuri clasice pentru doi jucători se pot juca în singurul fișier `index.html` (îl deschizi offline, fără server) împotriva calculatorului sau a altei persoane; regulile fiecărui joc sunt scrise în opt limbi din aceleași date pe care le joacă motorul, iar tu poți lipi propriul fișier de joc. Limitele sunt enumerate mai jos.',
    fr: 'Alpha, utilisable : cinq jeux classiques à deux joueurs se jouent dans l’unique fichier `index.html` (à ouvrir hors ligne, sans serveur), contre l’ordinateur ou une autre personne ; les règles de chaque jeu sont écrites en huit langues à partir des mêmes données que celles que joue le moteur, et vous pouvez coller votre propre fichier de jeu. Les limites sont listées plus bas.',
    it: 'Alpha, utilizzabile: cinque giochi classici per due giocatori si giocano nell’unico file `index.html` (si apre offline, senza server), contro il computer o un’altra persona; le regole di ogni gioco sono scritte in otto lingue a partire dagli stessi dati che il motore gioca, e puoi incollare il tuo file di gioco. I limiti sono elencati più sotto.',
    es: 'Alfa, utilizable: cinco juegos clásicos para dos jugadores se juegan en el único archivo `index.html` (se abre sin conexión, sin servidor), contra el ordenador o contra otra persona; las reglas de cada juego se escriben en ocho idiomas a partir de los mismos datos que juega el motor, y puedes pegar tu propio archivo de juego. Los límites están listados más abajo.',
    pt: 'Alfa, utilizável: cinco jogos clássicos para dois jogadores jogam-se no único ficheiro `index.html` (abre-se offline, sem servidor), contra o computador ou outra pessoa; as regras de cada jogo estão escritas em oito idiomas a partir dos mesmos dados que o motor joga, e pode colar o seu próprio ficheiro de jogo. Os limites estão listados mais abaixo.',
    de: 'Alpha, nutzbar: fünf klassische Spiele für zwei Personen sind in der einen Datei `index.html` spielbar (offline öffnen, ohne Server), gegen den Computer oder eine andere Person; die Regeln jedes Spiels werden in acht Sprachen aus denselben Daten geschrieben, die der Motor spielt, und du kannst deine eigene Spieldatei einfügen. Die Grenzen stehen weiter unten.',
    hu: 'Alfa, használható: öt klasszikus kétszemélyes játék játszható az egyetlen `index.html` fájlban (offline nyitható, szerver nélkül), a számítógép vagy egy másik ember ellen; minden játék szabályai nyolc nyelven íródnak ki ugyanabból az adatból, amelyet a motor játszik, és beilleszthetsz saját játékfájlt is. A korlátok lent vannak felsorolva.'
  };

  const does = {
    en: [
      `Plays five classic games from data files: ${list.en}. Each has an origin, a statement of how sure the rules are, notes on the choices made, and sources.`,
      'Each side can be a person, a random player or the computer at two levels; moves by mouse, touch or keyboard; undo, redo, a hint, and a move record you can copy.',
      'Writes the rules of the chosen game in eight languages, generated from the same data that the engine plays, so the text and the game cannot disagree.',
      'Your own game: paste a game as JSON, validate it with messages that name the faulty field, play it and download it. Nothing is uploaded.',
      'Interface in eight languages, dark and light themes, a labelled button for every point (screen readers, keyboard), works from 360 px wide; no network, no tracking.'
    ],
    ro: [
      `Joacă cinci jocuri clasice din fișiere de date: ${list.ro}. Fiecare are origine, o precizare despre cât de sigure sunt regulile, note despre alegerile făcute și surse.`,
      'Fiecare latură poate fi un om, un jucător aleator sau calculatorul, la două niveluri; mutări cu mouse-ul, cu degetul sau de la tastatură; anulare, refacere, sugestie și o înregistrare a mutărilor pe care o poți copia.',
      'Scrie regulile jocului ales în opt limbi, generate din aceleași date pe care le joacă motorul, deci textul și jocul nu pot fi în dezacord.',
      'Jocul tău: lipește un joc ca JSON, verifică-l cu mesaje care numesc câmpul greșit, joacă-l și descarcă-l. Nu se trimite nimic undeva.',
      'Interfață în opt limbi, teme întunecată și luminoasă, un buton cu etichetă pentru fiecare punct (cititoare de ecran, tastatură), funcționează de la 360 px lățime; fără rețea, fără urmărire.'
    ],
    fr: [
      `Joue cinq jeux classiques décrits dans des fichiers de données : ${list.fr}. Chacun a une origine, une indication de la fiabilité des règles, des notes sur les choix faits et des sources.`,
      'Chaque camp peut être une personne, un joueur aléatoire ou l’ordinateur à deux niveaux ; coups à la souris, au doigt ou au clavier ; annuler, rétablir, un conseil et un historique des coups que l’on peut copier.',
      'Écrit les règles du jeu choisi en huit langues, générées à partir des mêmes données que celles que joue le moteur : le texte et le jeu ne peuvent donc pas se contredire.',
      'Votre propre jeu : collez un jeu en JSON, validez-le avec des messages qui nomment le champ fautif, jouez-y et téléchargez-le. Rien n’est envoyé.',
      'Interface en huit langues, thèmes sombre et clair, un bouton étiqueté pour chaque point (lecteurs d’écran, clavier), utilisable dès 360 px de large ; sans réseau, sans suivi.'
    ],
    it: [
      `Gioca cinque giochi classici da file di dati: ${list.it}. Ognuno ha un’origine, un’indicazione di quanto sono sicure le regole, note sulle scelte fatte e fonti.`,
      'Ogni lato può essere una persona, un giocatore casuale o il computer a due livelli; mosse con il mouse, con il dito o con la tastiera; annulla, ripeti, un suggerimento e un registro delle mosse che si può copiare.',
      'Scrive le regole del gioco scelto in otto lingue, generate dagli stessi dati che il motore gioca, quindi il testo e il gioco non possono contraddirsi.',
      'Il tuo gioco: incolla un gioco come JSON, convalidalo con messaggi che nominano il campo sbagliato, giocalo e scaricalo. Non viene caricato nulla.',
      'Interfaccia in otto lingue, temi scuro e chiaro, un pulsante con etichetta per ogni punto (lettori di schermo, tastiera), funziona da 360 px di larghezza; senza rete, senza tracciamento.'
    ],
    es: [
      `Juega cinco juegos clásicos desde archivos de datos: ${list.es}. Cada uno tiene un origen, una indicación de lo seguras que son las reglas, notas sobre las decisiones tomadas y fuentes.`,
      'Cada bando puede ser una persona, un jugador aleatorio o el ordenador en dos niveles; jugadas con el ratón, con el dedo o con el teclado; deshacer, rehacer, una sugerencia y un registro de jugadas que se puede copiar.',
      'Escribe las reglas del juego elegido en ocho idiomas, generadas a partir de los mismos datos que juega el motor, así que el texto y el juego no pueden contradecirse.',
      'Tu propio juego: pega un juego como JSON, valídalo con mensajes que nombran el campo erróneo, juégalo y descárgalo. No se sube nada.',
      'Interfaz en ocho idiomas, temas oscuro y claro, un botón con etiqueta para cada punto (lectores de pantalla, teclado), funciona desde 360 px de ancho; sin red, sin rastreo.'
    ],
    pt: [
      `Joga cinco jogos clássicos a partir de ficheiros de dados: ${list.pt}. Cada um tem uma origem, uma indicação da fiabilidade das regras, notas sobre as escolhas feitas e fontes.`,
      'Cada lado pode ser uma pessoa, um jogador aleatório ou o computador em dois níveis; jogadas com o rato, com o dedo ou com o teclado; anular, refazer, uma sugestão e um registo das jogadas que se pode copiar.',
      'Escreve as regras do jogo escolhido em oito idiomas, geradas a partir dos mesmos dados que o motor joga, pelo que o texto e o jogo não se podem contradizer.',
      'O seu próprio jogo: cole um jogo em JSON, valide-o com mensagens que nomeiam o campo errado, jogue-o e descarregue-o. Nada é enviado.',
      'Interface em oito idiomas, temas escuro e claro, um botão com etiqueta para cada ponto (leitores de ecrã, teclado), funciona desde 360 px de largura; sem rede, sem rastreamento.'
    ],
    de: [
      `Spielt fünf klassische Spiele aus Datendateien: ${list.de}. Jedes hat eine Herkunft, eine Angabe zur Verlässlichkeit der Regeln, Hinweise zu den getroffenen Entscheidungen und Quellen.`,
      'Jede Seite kann ein Mensch, ein Zufallsspieler oder der Computer auf zwei Stufen sein; Züge per Maus, Fingertipp oder Tastatur; Rückgängig, Wiederholen, ein Tipp und ein kopierbares Zugprotokoll.',
      'Schreibt die Regeln des gewählten Spiels in acht Sprachen, erzeugt aus denselben Daten, die der Motor spielt – Text und Spiel können sich also nicht widersprechen.',
      'Dein eigenes Spiel: Spiel als JSON einfügen, mit Meldungen prüfen, die das fehlerhafte Feld nennen, spielen und herunterladen. Es wird nichts hochgeladen.',
      'Oberfläche in acht Sprachen, dunkles und helles Design, ein beschrifteter Knopf für jeden Punkt (Screenreader, Tastatur), nutzbar ab 360 px Breite; ohne Netzwerk, ohne Tracking.'
    ],
    hu: [
      `Öt klasszikus játékot játszik adatfájlokból: ${list.hu}. Mindegyiknek van eredete, jelzése arról, mennyire biztosak a szabályok, jegyzete a meghozott döntésekről és forrásai.`,
      'Mindkét oldalt játszhatja ember, véletlenszerű játékos vagy a számítógép két szinten; lépés egérrel, ujjal vagy billentyűzettel; visszavonás, újra, tipp és másolható lépéslista.',
      'Kiírja a választott játék szabályait nyolc nyelven, ugyanabból az adatból előállítva, amelyet a motor játszik, így a szöveg és a játék nem mondhat ellent egymásnak.',
      'Saját játék: illessz be egy játékot JSON-ként, ellenőrizd olyan üzenetekkel, amelyek megnevezik a hibás mezőt, játszd le és töltsd le. Semmi sem kerül feltöltésre.',
      'Nyolc nyelvű felület, sötét és világos téma, minden ponthoz feliratozott gomb (képernyőolvasók, billentyűzet), 360 px szélességtől működik; hálózat és követés nélkül.'
    ]
  };

  const how = {
    en: [
      'One JSON file per game in `data/games/`, checked by `schema.json`; the format is described in `docs/moves.md` and the tutorial is `docs/tutorial.md` (English and Romanian).',
      '`src/engine.mjs` is the rules engine (no screen, no network): it compiles a game, lists the legal moves, applies them, and searches with minimax and alpha–beta pruning for the computer opponent.',
      '`src/ui.js`, `src/i18n.mjs` and `src/app.css` are the interface; `node scripts/build.mjs` builds the single `index.html` (`--check` verifies that it matches).',
      '`npm test` runs the tests of the engine (move counts worked out by hand), the data files and the documentation; `python scripts/validate.py` checks the JSON files. Development needs Node.js 24 or newer; the page itself only needs a browser that knows ES2017.'
    ],
    ro: [
      'Un fișier JSON pe joc în `data/games/`, verificat de `schema.json`; formatul e descris în `docs/moves.md`, iar tutorialul este `docs/tutorial.md` (engleză și română).',
      '`src/engine.mjs` este motorul de reguli (fără ecran, fără rețea): compilează un joc, enumeră mutările legale, le aplică și caută cu minimax și tăiere alfa–beta pentru adversarul calculator.',
      '`src/ui.js`, `src/i18n.mjs` și `src/app.css` sunt interfața; `node scripts/build.mjs` construiește singurul `index.html` (`--check` verifică dacă se potrivește).',
      '`npm test` rulează testele motorului (numere de mutări calculate de mână), ale fișierelor de date și ale documentației; `python scripts/validate.py` verifică fișierele JSON. Dezvoltarea cere Node.js 24 sau mai nou; pagina în sine cere doar un browser care cunoaște ES2017.'
    ],
    fr: [
      'Un fichier JSON par jeu dans `data/games/`, vérifié par `schema.json` ; le format est décrit dans `docs/moves.md` et le tutoriel est `docs/tutorial.md` (anglais et roumain).',
      '`src/engine.mjs` est le moteur de règles (sans écran, sans réseau) : il compile un jeu, liste les coups légaux, les applique et cherche avec minimax et élagage alpha–bêta pour l’adversaire ordinateur.',
      '`src/ui.js`, `src/i18n.mjs` et `src/app.css` forment l’interface ; `node scripts/build.mjs` construit l’unique `index.html` (`--check` vérifie qu’il correspond).',
      '`npm test` lance les tests du moteur (nombres de coups calculés à la main), des fichiers de données et de la documentation ; `python scripts/validate.py` vérifie les fichiers JSON. Le développement demande Node.js 24 ou plus récent ; la page elle-même demande seulement un navigateur qui connaît ES2017.'
    ],
    it: [
      'Un file JSON per gioco in `data/games/`, controllato da `schema.json`; il formato è descritto in `docs/moves.md` e il tutorial è `docs/tutorial.md` (inglese e rumeno).',
      '`src/engine.mjs` è il motore delle regole (senza schermo, senza rete): compila un gioco, elenca le mosse legali, le applica e cerca con minimax e potatura alfa–beta per l’avversario computer.',
      '`src/ui.js`, `src/i18n.mjs` e `src/app.css` sono l’interfaccia; `node scripts/build.mjs` costruisce l’unico `index.html` (`--check` verifica che corrisponda).',
      '`npm test` esegue i test del motore (numeri di mosse calcolati a mano), dei file di dati e della documentazione; `python scripts/validate.py` controlla i file JSON. Lo sviluppo richiede Node.js 24 o più recente; la pagina stessa richiede solo un browser che conosca ES2017.'
    ],
    es: [
      'Un archivo JSON por juego en `data/games/`, comprobado por `schema.json`; el formato se describe en `docs/moves.md` y el tutorial es `docs/tutorial.md` (inglés y rumano).',
      '`src/engine.mjs` es el motor de reglas (sin pantalla, sin red): compila un juego, enumera las jugadas legales, las aplica y busca con minimax y poda alfa–beta para el rival ordenador.',
      '`src/ui.js`, `src/i18n.mjs` y `src/app.css` son la interfaz; `node scripts/build.mjs` construye el único `index.html` (`--check` verifica que coincide).',
      '`npm test` ejecuta las pruebas del motor (números de jugadas calculados a mano), de los archivos de datos y de la documentación; `python scripts/validate.py` comprueba los archivos JSON. El desarrollo requiere Node.js 24 o más reciente; la página en sí solo requiere un navegador que conozca ES2017.'
    ],
    pt: [
      'Um ficheiro JSON por jogo em `data/games/`, verificado por `schema.json`; o formato está descrito em `docs/moves.md` e o tutorial é `docs/tutorial.md` (inglês e romeno).',
      '`src/engine.mjs` é o motor de regras (sem ecrã, sem rede): compila um jogo, enumera as jogadas legais, aplica-as e procura com minimax e poda alfa–beta para o adversário computador.',
      '`src/ui.js`, `src/i18n.mjs` e `src/app.css` são a interface; `node scripts/build.mjs` constrói o único `index.html` (`--check` verifica que coincide).',
      '`npm test` executa os testes do motor (números de jogadas calculados à mão), dos ficheiros de dados e da documentação; `python scripts/validate.py` verifica os ficheiros JSON. O desenvolvimento requer Node.js 24 ou mais recente; a página em si só requer um navegador que conheça ES2017.'
    ],
    de: [
      'Eine JSON-Datei pro Spiel in `data/games/`, geprüft durch `schema.json`; das Format steht in `docs/moves.md`, die Anleitung in `docs/tutorial.md` (Englisch und Rumänisch).',
      '`src/engine.mjs` ist der Regelmotor (ohne Bildschirm, ohne Netzwerk): Er kompiliert ein Spiel, listet die erlaubten Züge auf, wendet sie an und sucht mit Minimax und Alpha-Beta-Beschneidung für den Computergegner.',
      '`src/ui.js`, `src/i18n.mjs` und `src/app.css` bilden die Oberfläche; `node scripts/build.mjs` baut die eine `index.html` (`--check` prüft, ob sie übereinstimmt).',
      '`npm test` führt die Tests des Motors (von Hand berechnete Zugzahlen), der Datendateien und der Dokumentation aus; `python scripts/validate.py` prüft die JSON-Dateien. Für die Entwicklung braucht man Node.js 24 oder neuer; die Seite selbst braucht nur einen Browser, der ES2017 kennt.'
    ],
    hu: [
      'Játékonként egy JSON-fájl a `data/games/` mappában, a `schema.json` ellenőrzi; a formátumot a `docs/moves.md`, az útmutatót a `docs/tutorial.md` írja le (angolul és románul).',
      'A `src/engine.mjs` a szabálymotor (képernyő és hálózat nélkül): lefordít egy játékot, felsorolja a szabályos lépéseket, alkalmazza őket, és minimax- és alfa–béta-vágással keres a számítógépes ellenfélnek.',
      'A `src/ui.js`, `src/i18n.mjs` és `src/app.css` a felület; a `node scripts/build.mjs` építi az egyetlen `index.html` fájlt (a `--check` ellenőrzi, hogy egyezik-e).',
      'Az `npm test` futtatja a motor (kézzel kiszámolt lépésszámok), az adatfájlok és a dokumentáció tesztjeit; a `python scripts/validate.py` a JSON-fájlokat ellenőrzi. A fejlesztéshez Node.js 24 vagy újabb kell; maga az oldal csak ES2017-et ismerő böngészőt igényel.'
    ]
  };

  const extraSteps = {
    en: '5. To change the engine or the interface, edit `src/`, then run `npm test` and `node scripts/build.mjs` (see `CONTRIBUTING.md`).',
    ro: '5. Pentru a schimba motorul sau interfața, editează `src/`, apoi rulează `npm test` și `node scripts/build.mjs` (vezi `CONTRIBUTING.md`).',
    fr: '5. Pour modifier le moteur ou l’interface, éditez `src/`, puis lancez `npm test` et `node scripts/build.mjs` (voir `CONTRIBUTING.md`).',
    it: '5. Per modificare il motore o l’interfaccia, modifica `src/`, poi esegui `npm test` e `node scripts/build.mjs` (vedi `CONTRIBUTING.md`).',
    es: '5. Para cambiar el motor o la interfaz, edita `src/` y ejecuta `npm test` y `node scripts/build.mjs` (consulta `CONTRIBUTING.md`).',
    pt: '5. Para alterar o motor ou a interface, edite `src/` e execute `npm test` e `node scripts/build.mjs` (veja `CONTRIBUTING.md`).',
    de: '5. Um den Motor oder die Oberfläche zu ändern, bearbeite `src/` und führe dann `npm test` und `node scripts/build.mjs` aus (siehe `CONTRIBUTING.md`).',
    hu: '5. A motor vagy a felület módosításához szerkeszd a `src/` mappát, majd futtasd az `npm test` és a `node scripts/build.mjs` parancsot (lásd `CONTRIBUTING.md`).'
  };

  const body = (l, t) => t.join('\n');
  const contrib = {
    heading: {en: 'Adding a game', ro: 'Adăugarea unui joc', fr: 'Ajouter un jeu', it: 'Aggiungere un gioco', es: 'Añadir un juego', pt: 'Acrescentar um jogo', de: 'Ein Spiel hinzufügen', hu: 'Játék hozzáadása'},
    body: {
      en: body('en', [
        '1. Read `docs/tutorial.md` (20 minutes) and keep `docs/moves.md` open: it describes every field.',
        '2. Copy `data/games/example.json` to `data/games/<id>.json`. The description alone (`name`, `region`, `setup`, `moves`, `win`, `sources`) is already a valid contribution; add `rules` to make the game playable.',
        `3. Run \`python scripts/validate.py\`, then paste the file into **${cu.en}** in the app: *${va.en}* names every mistake.`,
        '4. For a playable game add `names` in `ro fr de es it hu pt`, an honest `status` and `notes` in `en` and `ro` about every choice you made; cite a source for every rule.',
        '5. Add the number of first moves, worked out by hand, to `test/engine.test.mjs`, and run `npm test`.',
        '6. To add a new kind of move or win, edit `src/engine.mjs` (`MOVE_TYPES` or `WIN_TYPES`, `compile`, `explain`), add the rule sentences in all eight languages to `src/i18n.mjs`, extend `schema.json` and `docs/moves.md`, and add tests.',
        '7. Run `node scripts/build.mjs` and commit the regenerated `index.html` together with `src/`.'
      ]),
      ro: body('ro', [
        '1. Citește `docs/tutorial.ro.md` (20 de minute) și ține deschis `docs/moves.ro.md`: descrie fiecare câmp.',
        '2. Copiază `data/games/example.json` în `data/games/<id>.json`. Descrierea singură (`name`, `region`, `setup`, `moves`, `win`, `sources`) este deja o contribuție validă; adaugă `rules` ca să faci jocul jucabil.',
        `3. Rulează \`python scripts/validate.py\`, apoi lipește fișierul în **${cu.ro}** din aplicație: *${va.ro}* numește fiecare greșeală.`,
        '4. Pentru un joc jucabil adaugă `names` în `ro fr de es it hu pt`, un `status` sincer și `notes` în `en` și `ro` despre fiecare alegere făcută; citează o sursă pentru fiecare regulă.',
        '5. Adaugă în `test/engine.test.mjs` numărul primelor mutări, calculat de mână, și rulează `npm test`.',
        '6. Ca să adaugi un fel nou de mutare sau de câștig, editează `src/engine.mjs` (`MOVE_TYPES` sau `WIN_TYPES`, `compile`, `explain`), adaugă propozițiile regulii în toate cele opt limbi în `src/i18n.mjs`, extinde `schema.json` și `docs/moves.md` și adaugă teste.',
        '7. Rulează `node scripts/build.mjs` și fă commit cu `index.html` regenerat împreună cu `src/`.'
      ]),
      fr: body('fr', [
        '1. Lisez `docs/tutorial.md` (20 minutes) et gardez `docs/moves.md` ouvert : il décrit chaque champ.',
        '2. Copiez `data/games/example.json` vers `data/games/<id>.json`. La description seule (`name`, `region`, `setup`, `moves`, `win`, `sources`) est déjà une contribution valide ; ajoutez `rules` pour rendre le jeu jouable.',
        `3. Lancez \`python scripts/validate.py\`, puis collez le fichier dans **${cu.fr}** de l’application : *${va.fr}* nomme chaque erreur.`,
        '4. Pour un jeu jouable, ajoutez `names` en `ro fr de es it hu pt`, un `status` honnête et des `notes` en `en` et `ro` sur chaque choix fait ; citez une source pour chaque règle.',
        '5. Ajoutez à `test/engine.test.mjs` le nombre de premiers coups, calculé à la main, et lancez `npm test`.',
        '6. Pour ajouter un nouveau type de coup ou de victoire, modifiez `src/engine.mjs` (`MOVE_TYPES` ou `WIN_TYPES`, `compile`, `explain`), ajoutez les phrases de la règle dans les huit langues dans `src/i18n.mjs`, complétez `schema.json` et `docs/moves.md`, et ajoutez des tests.',
        '7. Lancez `node scripts/build.mjs` et validez l’`index.html` régénéré avec `src/`.'
      ]),
      it: body('it', [
        '1. Leggi `docs/tutorial.md` (20 minuti) e tieni aperto `docs/moves.md`: descrive ogni campo.',
        '2. Copia `data/games/example.json` in `data/games/<id>.json`. La sola descrizione (`name`, `region`, `setup`, `moves`, `win`, `sources`) è già un contributo valido; aggiungi `rules` per rendere il gioco giocabile.',
        `3. Esegui \`python scripts/validate.py\`, poi incolla il file in **${cu.it}** nell’app: *${va.it}* nomina ogni errore.`,
        '4. Per un gioco giocabile aggiungi `names` in `ro fr de es it hu pt`, uno `status` onesto e `notes` in `en` e `ro` su ogni scelta fatta; cita una fonte per ogni regola.',
        '5. Aggiungi a `test/engine.test.mjs` il numero delle prime mosse, calcolato a mano, ed esegui `npm test`.',
        '6. Per aggiungere un nuovo tipo di mossa o di vittoria, modifica `src/engine.mjs` (`MOVE_TYPES` o `WIN_TYPES`, `compile`, `explain`), aggiungi le frasi della regola in tutte e otto le lingue in `src/i18n.mjs`, estendi `schema.json` e `docs/moves.md` e aggiungi test.',
        '7. Esegui `node scripts/build.mjs` e fai il commit dell’`index.html` rigenerato insieme a `src/`.'
      ]),
      es: body('es', [
        '1. Lee `docs/tutorial.md` (20 minutos) y ten abierto `docs/moves.md`: describe cada campo.',
        '2. Copia `data/games/example.json` en `data/games/<id>.json`. La descripción sola (`name`, `region`, `setup`, `moves`, `win`, `sources`) ya es una contribución válida; añade `rules` para que el juego se pueda jugar.',
        `3. Ejecuta \`python scripts/validate.py\` y pega el archivo en **${cu.es}** de la aplicación: *${va.es}* nombra cada error.`,
        '4. Para un juego jugable añade `names` en `ro fr de es it hu pt`, un `status` sincero y `notes` en `en` y `ro` sobre cada decisión tomada; cita una fuente para cada regla.',
        '5. Añade a `test/engine.test.mjs` el número de primeras jugadas, calculado a mano, y ejecuta `npm test`.',
        '6. Para añadir un nuevo tipo de jugada o de victoria, edita `src/engine.mjs` (`MOVE_TYPES` o `WIN_TYPES`, `compile`, `explain`), añade las frases de la regla en los ocho idiomas en `src/i18n.mjs`, amplía `schema.json` y `docs/moves.md` y añade pruebas.',
        '7. Ejecuta `node scripts/build.mjs` y haz commit del `index.html` regenerado junto con `src/`.'
      ]),
      pt: body('pt', [
        '1. Leia `docs/tutorial.md` (20 minutos) e mantenha `docs/moves.md` aberto: descreve cada campo.',
        '2. Copie `data/games/example.json` para `data/games/<id>.json`. A descrição sozinha (`name`, `region`, `setup`, `moves`, `win`, `sources`) já é uma contribuição válida; acrescente `rules` para tornar o jogo jogável.',
        `3. Execute \`python scripts/validate.py\` e cole o ficheiro em **${cu.pt}** na aplicação: *${va.pt}* nomeia cada erro.`,
        '4. Para um jogo jogável acrescente `names` em `ro fr de es it hu pt`, um `status` honesto e `notes` em `en` e `ro` sobre cada escolha feita; cite uma fonte para cada regra.',
        '5. Acrescente a `test/engine.test.mjs` o número de primeiras jogadas, calculado à mão, e execute `npm test`.',
        '6. Para acrescentar um novo tipo de jogada ou de vitória, edite `src/engine.mjs` (`MOVE_TYPES` ou `WIN_TYPES`, `compile`, `explain`), acrescente as frases da regra nos oito idiomas em `src/i18n.mjs`, alargue `schema.json` e `docs/moves.md` e acrescente testes.',
        '7. Execute `node scripts/build.mjs` e faça commit do `index.html` regenerado juntamente com `src/`.'
      ]),
      de: body('de', [
        '1. Lies `docs/tutorial.md` (20 Minuten) und halte `docs/moves.md` offen: Es beschreibt jedes Feld.',
        '2. Kopiere `data/games/example.json` nach `data/games/<id>.json`. Die Beschreibung allein (`name`, `region`, `setup`, `moves`, `win`, `sources`) ist schon ein gültiger Beitrag; ergänze `rules`, damit das Spiel spielbar wird.',
        `3. Führe \`python scripts/validate.py\` aus und füge die Datei in **${cu.de}** in der App ein: *${va.de}* nennt jeden Fehler.`,
        '4. Für ein spielbares Spiel ergänze `names` in `ro fr de es it hu pt`, einen ehrlichen `status` und `notes` in `en` und `ro` zu jeder getroffenen Entscheidung; zitiere für jede Regel eine Quelle.',
        '5. Trage die von Hand berechnete Zahl der ersten Züge in `test/engine.test.mjs` ein und führe `npm test` aus.',
        '6. Für eine neue Zug- oder Siegart bearbeite `src/engine.mjs` (`MOVE_TYPES` oder `WIN_TYPES`, `compile`, `explain`), ergänze die Regelsätze in allen acht Sprachen in `src/i18n.mjs`, erweitere `schema.json` und `docs/moves.md` und füge Tests hinzu.',
        '7. Führe `node scripts/build.mjs` aus und committe die neu erzeugte `index.html` zusammen mit `src/`.'
      ]),
      hu: body('hu', [
        '1. Olvasd el a `docs/tutorial.md` fájlt (20 perc), és tartsd nyitva a `docs/moves.md` fájlt: minden mezőt leír.',
        '2. Másold a `data/games/example.json` fájlt a `data/games/<id>.json` helyre. Önmagában a leírás (`name`, `region`, `setup`, `moves`, `win`, `sources`) is érvényes hozzájárulás; add hozzá a `rules` részt, hogy a játék játszható legyen.',
        `3. Futtasd a \`python scripts/validate.py\` parancsot, majd illeszd be a fájlt az alkalmazás **${cu.hu}** részébe: a *${va.hu}* minden hibát megnevez.`,
        '4. Játszható játékhoz add meg a `names` mezőt a `ro fr de es it hu pt` nyelveken, őszinte `status` értéket, és `notes` jegyzetet `en` és `ro` nyelven minden meghozott döntésről; minden szabályhoz idézz forrást.',
        '5. Add hozzá a `test/engine.test.mjs` fájlhoz az első lépések kézzel kiszámolt számát, és futtasd az `npm test` parancsot.',
        '6. Új lépés- vagy győzelemtípushoz szerkeszd a `src/engine.mjs` fájlt (`MOVE_TYPES` vagy `WIN_TYPES`, `compile`, `explain`), add hozzá a szabálymondatokat mind a nyolc nyelven a `src/i18n.mjs` fájlban, bővítsd a `schema.json` és a `docs/moves.md` fájlt, és írj teszteket.',
        '7. Futtasd a `node scripts/build.mjs` parancsot, és commitold az újragenerált `index.html` fájlt a `src/` mappával együtt.'
      ])
    }
  };

  const issues = {
    en: [
      'Add Three Men’s Morris as a bundled game: start from `docs/examples/three-mens-morris.json`, compare the variant with two more sources, add the names in seven languages and move the file to `data/games/`',
      'Have native speakers review the French, Italian, Spanish, Portuguese, German and Hungarian texts: the `notes` of the five games and the rule sentences (`r_*`) in `src/i18n.mjs`',
      'Add traditional Romanian board games for two players without dice (ask older relatives, cite a book or a page for every rule) as data files',
      'Add Six Men’s Morris and Twelve Men’s Morris as data files, with a cited source for the rules (mills are already supported)',
      'Add the missing tafl rules to the engine: the shieldwall capture, the edge-fort win for the defenders and the win by encircling all defenders (new `rules` fields, sentences in eight languages, tests)',
      'Add other tafl variants as data (Brandubh, Tablut, Fetlar), each with its sources and its differences from the Copenhagen rules',
      'Add the import of a saved record: paste a list of moves and replay it on the board',
      'Add a stronger computer level (for example iterative deepening with a transposition table) and test that it beats the current medium level',
      'Design dice and other chance for the format (a seeded roll, so that records can be replayed) and write the proposal in `docs/`',
      'Add three card-game examples with a `deck` section in the schema (they cannot be played yet: describe them, with sources)'
    ],
    ro: [
      'Adaugă Three Men’s Morris ca joc inclus: pornește de la `docs/examples/three-mens-morris.json`, compară varianta cu încă două surse, adaugă numele în șapte limbi și mută fișierul în `data/games/`',
      'Cere vorbitorilor nativi să revizuiască textele în franceză, italiană, spaniolă, portugheză, germană și maghiară: `notes` ale celor cinci jocuri și propozițiile regulilor (`r_*`) din `src/i18n.mjs`',
      'Adaugă jocuri de masă tradiționale românești pentru doi jucători, fără zaruri (întreabă rudele mai în vârstă, citează o carte sau o pagină pentru fiecare regulă), ca fișiere de date',
      'Adaugă Six Men’s Morris și Twelve Men’s Morris ca fișiere de date, cu o sursă citată pentru reguli (morile sunt deja acceptate)',
      'Adaugă în motor regulile tafl lipsă: captura „zid de scuturi”, victoria apărătorilor prin fort pe margine și victoria prin încercuirea tuturor apărătorilor (câmpuri `rules` noi, propoziții în opt limbi, teste)',
      'Adaugă alte variante tafl ca date (Brandubh, Tablut, Fetlar), fiecare cu sursele ei și diferențele față de regulile de la Copenhaga',
      'Adaugă importul unei înregistrări salvate: lipește o listă de mutări și redă-o pe tablă',
      'Adaugă un nivel mai puternic al calculatorului (de exemplu aprofundare iterativă cu tabel de transpoziție) și testează că bate nivelul mediu actual',
      'Proiectează zarurile și alte forme de șansă pentru format (o aruncare cu sămânță, ca înregistrările să poată fi redate) și scrie propunerea în `docs/`',
      'Adaugă trei exemple de jocuri de cărți cu o secțiune `deck` în schemă (încă nu se pot juca: descrie-le, cu surse)'
    ],
    fr: [
      'Ajouter le Three Men’s Morris comme jeu fourni : partir de `docs/examples/three-mens-morris.json`, comparer la variante avec deux autres sources, ajouter les noms en sept langues et déplacer le fichier dans `data/games/`',
      'Faire relire par des locuteurs natifs les textes français, italiens, espagnols, portugais, allemands et hongrois : les `notes` des cinq jeux et les phrases de règles (`r_*`) de `src/i18n.mjs`',
      'Ajouter sous forme de fichiers de données des jeux de plateau traditionnels roumains à deux joueurs, sans dés (interroger les aînés, citer un livre ou une page pour chaque règle)',
      'Ajouter le Six Men’s Morris et le Twelve Men’s Morris sous forme de fichiers de données, avec une source citée pour les règles (les moulins sont déjà pris en charge)',
      'Ajouter au moteur les règles tafl manquantes : la capture par mur de boucliers, la victoire des défenseurs par fort de bord et la victoire par encerclement de tous les défenseurs (nouveaux champs `rules`, phrases en huit langues, tests)',
      'Ajouter d’autres variantes du tafl sous forme de données (Brandubh, Tablut, Fetlar), chacune avec ses sources et ses différences avec les règles de Copenhague',
      'Ajouter l’import d’un historique enregistré : coller une liste de coups et la rejouer sur le plateau',
      'Ajouter un niveau d’ordinateur plus fort (par exemple approfondissement itératif avec table de transposition) et tester qu’il bat le niveau moyen actuel',
      'Concevoir les dés et autres formes de hasard pour le format (un tirage à graine, pour que les historiques puissent être rejoués) et rédiger la proposition dans `docs/`',
      'Ajouter trois exemples de jeux de cartes avec une section `deck` dans le schéma (ils ne sont pas encore jouables : les décrire, avec leurs sources)'
    ],
    it: [
      'Aggiungere il Three Men’s Morris come gioco incluso: partire da `docs/examples/three-mens-morris.json`, confrontare la variante con altre due fonti, aggiungere i nomi in sette lingue e spostare il file in `data/games/`',
      'Far rivedere da madrelingua i testi in francese, italiano, spagnolo, portoghese, tedesco e ungherese: le `notes` dei cinque giochi e le frasi delle regole (`r_*`) in `src/i18n.mjs`',
      'Aggiungere come file di dati giochi da tavolo tradizionali rumeni per due giocatori, senza dadi (chiedere ai parenti più anziani, citare un libro o una pagina per ogni regola)',
      'Aggiungere il Six Men’s Morris e il Twelve Men’s Morris come file di dati, con una fonte citata per le regole (i mulini sono già supportati)',
      'Aggiungere al motore le regole tafl mancanti: la cattura con il muro di scudi, la vittoria dei difensori con il forte sul bordo e la vittoria accerchiando tutti i difensori (nuovi campi `rules`, frasi in otto lingue, test)',
      'Aggiungere altre varianti del tafl come dati (Brandubh, Tablut, Fetlar), ciascuna con le sue fonti e le differenze rispetto alle regole di Copenaghen',
      'Aggiungere l’importazione di un registro salvato: incollare un elenco di mosse e rigiocarlo sulla scacchiera',
      'Aggiungere un livello di computer più forte (per esempio approfondimento iterativo con tabella di trasposizione) e verificare che batta l’attuale livello medio',
      'Progettare i dadi e altre forme di casualità per il formato (un lancio con seme, così i registri si possono rigiocare) e scrivere la proposta in `docs/`',
      'Aggiungere tre esempi di giochi di carte con una sezione `deck` nello schema (non sono ancora giocabili: descriverli, con le fonti)'
    ],
    es: [
      'Añadir el Three Men’s Morris como juego incluido: partir de `docs/examples/three-mens-morris.json`, comparar la variante con otras dos fuentes, añadir los nombres en siete idiomas y mover el archivo a `data/games/`',
      'Pedir a hablantes nativos que revisen los textos en francés, italiano, español, portugués, alemán y húngaro: las `notes` de los cinco juegos y las frases de reglas (`r_*`) de `src/i18n.mjs`',
      'Añadir como archivos de datos juegos de tablero tradicionales rumanos para dos jugadores, sin dados (preguntar a los familiares mayores, citar un libro o una página para cada regla)',
      'Añadir el Six Men’s Morris y el Twelve Men’s Morris como archivos de datos, con una fuente citada para las reglas (los molinos ya están soportados)',
      'Añadir al motor las reglas tafl que faltan: la captura por muro de escudos, la victoria de los defensores con el fuerte del borde y la victoria por cercar a todos los defensores (nuevos campos `rules`, frases en ocho idiomas, pruebas)',
      'Añadir otras variantes del tafl como datos (Brandubh, Tablut, Fetlar), cada una con sus fuentes y sus diferencias con las reglas de Copenhague',
      'Añadir la importación de un registro guardado: pegar una lista de jugadas y reproducirla en el tablero',
      'Añadir un nivel de ordenador más fuerte (por ejemplo profundización iterativa con tabla de transposición) y comprobar que gana al nivel medio actual',
      'Diseñar los dados y otras formas de azar para el formato (una tirada con semilla, para poder reproducir los registros) y escribir la propuesta en `docs/`',
      'Añadir tres ejemplos de juegos de cartas con una sección `deck` en el esquema (aún no se pueden jugar: describirlos, con fuentes)'
    ],
    pt: [
      'Acrescentar o Three Men’s Morris como jogo incluído: partir de `docs/examples/three-mens-morris.json`, comparar a variante com outras duas fontes, acrescentar os nomes em sete idiomas e mover o ficheiro para `data/games/`',
      'Pedir a falantes nativos que revejam os textos em francês, italiano, espanhol, português, alemão e húngaro: as `notes` dos cinco jogos e as frases das regras (`r_*`) em `src/i18n.mjs`',
      'Acrescentar como ficheiros de dados jogos de tabuleiro tradicionais romenos para dois jogadores, sem dados (perguntar aos familiares mais velhos, citar um livro ou uma página para cada regra)',
      'Acrescentar o Six Men’s Morris e o Twelve Men’s Morris como ficheiros de dados, com uma fonte citada para as regras (os moinhos já são suportados)',
      'Acrescentar ao motor as regras tafl em falta: a captura por muro de escudos, a vitória dos defensores com o forte na margem e a vitória por cercar todos os defensores (novos campos `rules`, frases em oito idiomas, testes)',
      'Acrescentar outras variantes do tafl como dados (Brandubh, Tablut, Fetlar), cada uma com as suas fontes e as suas diferenças em relação às regras de Copenhaga',
      'Acrescentar a importação de um registo guardado: colar uma lista de jogadas e reproduzi-la no tabuleiro',
      'Acrescentar um nível de computador mais forte (por exemplo aprofundamento iterativo com tabela de transposição) e testar que vence o nível médio atual',
      'Desenhar os dados e outras formas de acaso para o formato (um lançamento com semente, para que os registos possam ser reproduzidos) e escrever a proposta em `docs/`',
      'Acrescentar três exemplos de jogos de cartas com uma secção `deck` no esquema (ainda não se podem jogar: descrevê-los, com fontes)'
    ],
    de: [
      'Three Men’s Morris als mitgeliefertes Spiel hinzufügen: von `docs/examples/three-mens-morris.json` ausgehen, die Variante mit zwei weiteren Quellen vergleichen, die Namen in sieben Sprachen ergänzen und die Datei nach `data/games/` verschieben',
      'Muttersprachler die französischen, italienischen, spanischen, portugiesischen, deutschen und ungarischen Texte prüfen lassen: die `notes` der fünf Spiele und die Regelsätze (`r_*`) in `src/i18n.mjs`',
      'Traditionelle rumänische Brettspiele für zwei Personen ohne Würfel als Datendateien hinzufügen (ältere Verwandte fragen, für jede Regel ein Buch oder eine Seite zitieren)',
      'Sechs- und Zwölfmühle (Six Men’s Morris, Twelve Men’s Morris) als Datendateien hinzufügen, mit zitierter Quelle für die Regeln (Mühlen werden bereits unterstützt)',
      'Die fehlenden Tafl-Regeln im Motor ergänzen: den Schildwall-Fang, den Sieg der Verteidiger durch die Randfestung und den Sieg durch Einkreisen aller Verteidiger (neue `rules`-Felder, Sätze in acht Sprachen, Tests)',
      'Weitere Tafl-Varianten als Daten hinzufügen (Brandubh, Tablut, Fetlar), jede mit Quellen und Unterschieden zu den Kopenhagener Regeln',
      'Den Import eines gespeicherten Zugprotokolls ergänzen: eine Zugliste einfügen und auf dem Brett abspielen',
      'Eine stärkere Computerstufe ergänzen (zum Beispiel iterative Vertiefung mit Transpositionstabelle) und testen, dass sie die aktuelle mittlere Stufe schlägt',
      'Würfel und andere Zufallselemente für das Format entwerfen (ein Wurf mit Startwert, damit sich Protokolle abspielen lassen) und den Vorschlag in `docs/` schreiben',
      'Drei Kartenspiel-Beispiele mit einem `deck`-Abschnitt im Schema hinzufügen (noch nicht spielbar: beschreiben, mit Quellen)'
    ],
    hu: [
      'A Three Men’s Morris felvétele a mellékelt játékok közé: kiindulás a `docs/examples/three-mens-morris.json` fájlból, a változat összevetése még két forrással, a nevek hozzáadása hét nyelven, és a fájl áthelyezése a `data/games/` mappába',
      'Anyanyelvi beszélőkkel átnézetni a francia, olasz, spanyol, portugál, német és magyar szövegeket: az öt játék `notes` jegyzeteit és a szabálymondatokat (`r_*`) a `src/i18n.mjs` fájlban',
      'Hagyományos román, kétszemélyes, kocka nélküli táblajátékok felvétele adatfájlként (idősebb rokonok megkérdezése, minden szabályhoz könyv vagy oldal idézése)',
      'A Six Men’s Morris és a Twelve Men’s Morris felvétele adatfájlként, a szabályok idézett forrásával (a malmok már támogatottak)',
      'A hiányzó tafl-szabályok hozzáadása a motorhoz: a pajzsfal-fogás, a védők győzelme a peremerőddel és a győzelem az összes védő bekerítésével (új `rules` mezők, mondatok nyolc nyelven, tesztek)',
      'További tafl-változatok felvétele adatként (Brandubh, Tablut, Fetlar), mindegyik forrásokkal és a koppenhágai szabályoktól való eltérésekkel',
      'Mentett lépéslista importálása: lépéslista beillesztése és lejátszása a táblán',
      'Erősebb számítógépes szint hozzáadása (például iteratív mélyítés transzpozíciós táblával), és annak tesztelése, hogy legyőzi a mostani közepes szintet',
      'Kockák és más véletlenelemek megtervezése a formátumhoz (magos dobás, hogy a lépéslisták újra lejátszhatók legyenek), és a javaslat megírása a `docs/` mappában',
      'Három kártyajáték-példa hozzáadása `deck` szakasszal a sémában (még nem játszhatók: leírni őket, forrásokkal)'
    ]
  };

  const added = {
    en: [
      `Five playable games as data files in \`data/games/\`: ${list.en}, each with sources and notes on the choices made.`,
      'A rules engine (`src/engine.mjs`) for two-player games on grid and graph boards: placing, steps, slides, flying, jumps, approach and withdrawal, mills, custodial and king capture, restricted points, win and draw rules; a computer opponent (minimax with alpha–beta pruning).',
      'Interface: a labelled button for every point (mouse, touch, keyboard, screen reader), a player type for each side, undo and redo, hint, move record, rules written in eight languages from the game data, and your own game as JSON (validate, play, download).',
      '`schema.json` extended (board, pieces, rules, status, names, notes); `docs/moves.md` (the format) and `docs/tutorial.md` (20 minutes), in English and Romanian, with a tested example game.',
      'Tests: `node --test` for the engine (move counts worked out by hand), the data and the documentation; browser tests in the hub (eight languages, accessibility, hostile stored state, small screens).',
      '`src/` and `scripts/build.mjs`: the single `index.html` is now built from sources, and `--check` verifies it.'
    ],
    ro: [
      `Cinci jocuri jucabile ca fișiere de date în \`data/games/\`: ${list.ro}, fiecare cu surse și note despre alegerile făcute.`,
      'Un motor de reguli (`src/engine.mjs`) pentru jocuri cu doi jucători pe table de tip grilă și graf: plasare, pași, alunecări, zbor, sărituri, apropiere și retragere, mori, captură custodială și a regelui, puncte restricționate, reguli de câștig și de remiză; un adversar calculator (minimax cu tăiere alfa–beta).',
      'Interfață: un buton cu etichetă pentru fiecare punct (mouse, atingere, tastatură, cititor de ecran), un tip de jucător pentru fiecare latură, anulare și refacere, sugestie, înregistrarea mutărilor, reguli scrise în opt limbi din datele jocului și jocul tău ca JSON (verificare, joc, descărcare).',
      '`schema.json` extins (board, pieces, rules, status, names, notes); `docs/moves.md` (formatul) și `docs/tutorial.md` (20 de minute), în engleză și română, cu un joc-exemplu testat.',
      'Teste: `node --test` pentru motor (numere de mutări calculate de mână), date și documentație; teste de browser în hub (opt limbi, accesibilitate, stare stocată ostilă, ecrane mici).',
      '`src/` și `scripts/build.mjs`: singurul `index.html` este acum construit din surse, iar `--check` îl verifică.'
    ],
    fr: [
      `Cinq jeux jouables sous forme de fichiers de données dans \`data/games/\` : ${list.fr}, chacun avec des sources et des notes sur les choix faits.`,
      'Un moteur de règles (`src/engine.mjs`) pour les jeux à deux joueurs sur plateaux en grille et en graphe : placement, pas, glissements, vol, sauts, approche et retrait, moulins, capture par encadrement et capture du roi, points réservés, règles de victoire et de nulle ; un adversaire ordinateur (minimax avec élagage alpha–bêta).',
      'Interface : un bouton étiqueté pour chaque point (souris, toucher, clavier, lecteur d’écran), un type de joueur pour chaque camp, annuler et rétablir, conseil, historique des coups, règles écrites en huit langues à partir des données du jeu, et votre propre jeu en JSON (validation, jeu, téléchargement).',
      '`schema.json` étendu (board, pieces, rules, status, names, notes) ; `docs/moves.md` (le format) et `docs/tutorial.md` (20 minutes), en anglais et en roumain, avec un jeu d’exemple testé.',
      'Tests : `node --test` pour le moteur (nombres de coups calculés à la main), les données et la documentation ; tests de navigateur dans le hub (huit langues, accessibilité, état stocké hostile, petits écrans).',
      '`src/` et `scripts/build.mjs` : l’unique `index.html` est désormais construit à partir des sources, et `--check` le vérifie.'
    ],
    it: [
      `Cinque giochi giocabili come file di dati in \`data/games/\`: ${list.it}, ciascuno con fonti e note sulle scelte fatte.`,
      'Un motore di regole (`src/engine.mjs`) per giochi a due su tavolieri a griglia e a grafo: piazzamento, passi, scivolamenti, volo, salti, avvicinamento e allontanamento, mulini, cattura per custodia e del re, punti riservati, regole di vittoria e di patta; un avversario computer (minimax con potatura alfa–beta).',
      'Interfaccia: un pulsante con etichetta per ogni punto (mouse, tocco, tastiera, lettore di schermo), un tipo di giocatore per ogni lato, annulla e ripeti, suggerimento, registro delle mosse, regole scritte in otto lingue dai dati del gioco e il tuo gioco come JSON (convalida, gioco, download).',
      '`schema.json` esteso (board, pieces, rules, status, names, notes); `docs/moves.md` (il formato) e `docs/tutorial.md` (20 minuti), in inglese e rumeno, con un gioco di esempio testato.',
      'Test: `node --test` per il motore (numeri di mosse calcolati a mano), i dati e la documentazione; test del browser nell’hub (otto lingue, accessibilità, stato memorizzato ostile, schermi piccoli).',
      '`src/` e `scripts/build.mjs`: l’unico `index.html` è ora costruito dai sorgenti e `--check` lo verifica.'
    ],
    es: [
      `Cinco juegos jugables como archivos de datos en \`data/games/\`: ${list.es}, cada uno con fuentes y notas sobre las decisiones tomadas.`,
      'Un motor de reglas (`src/engine.mjs`) para juegos de dos jugadores en tableros de cuadrícula y de grafo: colocación, pasos, deslizamientos, vuelo, saltos, aproximación y retirada, molinos, captura por custodia y del rey, puntos reservados, reglas de victoria y de tablas; un rival ordenador (minimax con poda alfa–beta).',
      'Interfaz: un botón con etiqueta para cada punto (ratón, táctil, teclado, lector de pantalla), un tipo de jugador para cada bando, deshacer y rehacer, sugerencia, registro de jugadas, reglas escritas en ocho idiomas a partir de los datos del juego y tu propio juego como JSON (validar, jugar, descargar).',
      '`schema.json` ampliado (board, pieces, rules, status, names, notes); `docs/moves.md` (el formato) y `docs/tutorial.md` (20 minutos), en inglés y rumano, con un juego de ejemplo probado.',
      'Pruebas: `node --test` para el motor (números de jugadas calculados a mano), los datos y la documentación; pruebas de navegador en el hub (ocho idiomas, accesibilidad, estado guardado hostil, pantallas pequeñas).',
      '`src/` y `scripts/build.mjs`: el único `index.html` se construye ahora a partir de las fuentes, y `--check` lo verifica.'
    ],
    pt: [
      `Cinco jogos jogáveis como ficheiros de dados em \`data/games/\`: ${list.pt}, cada um com fontes e notas sobre as escolhas feitas.`,
      'Um motor de regras (`src/engine.mjs`) para jogos de dois jogadores em tabuleiros de grelha e de grafo: colocação, passos, deslizamentos, voo, saltos, aproximação e afastamento, moinhos, captura por custódia e do rei, pontos reservados, regras de vitória e de empate; um adversário computador (minimax com poda alfa–beta).',
      'Interface: um botão com etiqueta para cada ponto (rato, toque, teclado, leitor de ecrã), um tipo de jogador para cada lado, anular e refazer, sugestão, registo das jogadas, regras escritas em oito idiomas a partir dos dados do jogo e o seu próprio jogo como JSON (validar, jogar, descarregar).',
      '`schema.json` alargado (board, pieces, rules, status, names, notes); `docs/moves.md` (o formato) e `docs/tutorial.md` (20 minutos), em inglês e romeno, com um jogo de exemplo testado.',
      'Testes: `node --test` para o motor (números de jogadas calculados à mão), os dados e a documentação; testes de navegador no hub (oito idiomas, acessibilidade, estado guardado hostil, ecrãs pequenos).',
      '`src/` e `scripts/build.mjs`: o único `index.html` é agora construído a partir das fontes, e `--check` verifica-o.'
    ],
    de: [
      `Fünf spielbare Spiele als Datendateien in \`data/games/\`: ${list.de}, jedes mit Quellen und Hinweisen zu den getroffenen Entscheidungen.`,
      'Ein Regelmotor (`src/engine.mjs`) für Zwei-Personen-Spiele auf Gitter- und Graphbrettern: Setzen, Schritte, Gleiten, Fliegen, Sprünge, Annähern und Zurückziehen, Mühlen, Fang durch Einklemmen und Königsfang, gesperrte Punkte, Sieg- und Remisregeln; ein Computergegner (Minimax mit Alpha-Beta-Beschneidung).',
      'Oberfläche: ein beschrifteter Knopf für jeden Punkt (Maus, Touch, Tastatur, Screenreader), ein Spielertyp je Seite, Rückgängig und Wiederholen, Tipp, Zugprotokoll, Regeln in acht Sprachen aus den Spieldaten und dein eigenes Spiel als JSON (prüfen, spielen, herunterladen).',
      '`schema.json` erweitert (board, pieces, rules, status, names, notes); `docs/moves.md` (das Format) und `docs/tutorial.md` (20 Minuten), auf Englisch und Rumänisch, mit einem getesteten Beispielspiel.',
      'Tests: `node --test` für den Motor (von Hand berechnete Zugzahlen), die Daten und die Dokumentation; Browsertests im Hub (acht Sprachen, Barrierefreiheit, feindlicher gespeicherter Zustand, kleine Bildschirme).',
      '`src/` und `scripts/build.mjs`: Die eine `index.html` wird jetzt aus Quellen gebaut, `--check` prüft sie.'
    ],
    hu: [
      `Öt játszható játék adatfájlként a \`data/games/\` mappában: ${list.hu}, mindegyik forrásokkal és jegyzetekkel a meghozott döntésekről.`,
      'Szabálymotor (`src/engine.mjs`) kétszemélyes játékokhoz rácsos és gráf alapú táblákon: lerakás, lépés, csúszás, repülés, ugrás, közeledés és távolodás, malmok, bekerítéses és királyfogás, tiltott pontok, győzelmi és döntetlen-szabályok; számítógépes ellenfél (minimax alfa–béta-vágással).',
      'Felület: minden ponthoz feliratozott gomb (egér, érintés, billentyűzet, képernyőolvasó), oldalanként választható játékostípus, visszavonás és újra, tipp, lépéslista, nyolc nyelven kiírt szabályok a játékadatokból, és saját játék JSON-ként (ellenőrzés, játék, letöltés).',
      'A `schema.json` bővítve (board, pieces, rules, status, names, notes); `docs/moves.md` (a formátum) és `docs/tutorial.md` (20 perc), angolul és románul, tesztelt példajátékkal.',
      'Tesztek: `node --test` a motorhoz (kézzel kiszámolt lépésszámok), az adatokhoz és a dokumentációhoz; böngészőtesztek a hubban (nyolc nyelv, akadálymentesség, ellenséges tárolt állapot, kis képernyők).',
      'A `src/` és a `scripts/build.mjs`: az egyetlen `index.html` mostantól forrásokból épül, és a `--check` ellenőrzi.'
    ]
  };
  for (const l of L) added[l] = [...added[l], ...legacy[l]];

  const changed = {
    en: ['The workflow runs on Ubuntu 26.04 with Node.js 26 and also runs the tests and the build check.'],
    ro: ['Fluxul de lucru rulează pe Ubuntu 26.04 cu Node.js 26 și rulează și testele, plus verificarea construcției.'],
    fr: ['Le workflow s’exécute sur Ubuntu 26.04 avec Node.js 26 et lance aussi les tests et la vérification de la construction.'],
    it: ['Il workflow gira su Ubuntu 26.04 con Node.js 26 ed esegue anche i test e il controllo della build.'],
    es: ['El workflow se ejecuta en Ubuntu 26.04 con Node.js 26 y ejecuta también las pruebas y la comprobación de la compilación.'],
    pt: ['O workflow corre em Ubuntu 26.04 com Node.js 26 e executa também os testes e a verificação da compilação.'],
    de: ['Der Workflow läuft auf Ubuntu 26.04 mit Node.js 26 und führt auch die Tests und die Build-Prüfung aus.'],
    hu: ['A munkafolyamat Ubuntu 26.04 és Node.js 26 alatt fut, és a teszteket meg a build-ellenőrzést is futtatja.']
  };

  return {
    slug: 'regula', version: '0.2.0', updated: '2026-11-17',
    headings: {
      does: {en: 'What it does', ro: 'Ce face', fr: 'Ce que fait l’application', it: 'Cosa fa', es: 'Qué hace', pt: 'O que faz', de: 'Was es kann', hu: 'Mit tud'},
      how: {en: 'How it works', ro: 'Cum funcționează', fr: 'Comment ça marche', it: 'Come funziona', es: 'Cómo funciona', pt: 'Como funciona', de: 'Wie es funktioniert', hu: 'Hogyan működik'},
      limits: limHeading
    },
    status, does, how, limits, extraSteps, contrib, issues,
    changelog: {added, changed}
  };
}
