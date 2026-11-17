// Specificația documentației BALANTA (opt limbi). Folosită de tools/alpha/docs.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default async function (root) {
  const dir = path.join(root, 'balanta');
  const I18N = (await import(pathToFileURL(path.join(dir, 'src', 'i18n.mjs')).href)).default;
  const legacy = JSON.parse(fs.readFileSync(path.join(HERE, 'balanta.legacy.json'), 'utf8'));
  const L = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
  const limits = {}, limHeading = {};
  for (const l of L) { limits[l] = [1, 2, 3, 4, 5, 6].map((i) => I18N[l]['lim_' + i]); limHeading[l] = I18N[l].h_limits; }

  const status = {
    en: 'Alpha, usable: the single `index.html` compares AI models blind, offline and without a server. You paste the answers of two to eight models to the 92 bundled prompts (Romanian, English, Hungarian) or to your own, vote A or B without seeing model names, and get a Bradley–Terry and Elo ranking with confidence intervals, a static results page and a `votes.jsonl` file that anyone can recompute with `scripts/rank.py`. Nothing is sent anywhere and no model is called.',
    ro: 'Alfa, utilizabil: singurul `index.html` compară modele de IA la orb, offline și fără server. Lipești răspunsurile a două până la opt modele la cele 92 de prompturi incluse (română, engleză, maghiară) sau la ale tale, votezi A sau B fără să vezi numele modelelor și primești un clasament Bradley–Terry și Elo cu intervale de încredere, o pagină statică de rezultate și un fișier `votes.jsonl` pe care oricine îl poate recalcula cu `scripts/rank.py`. Nu se trimite nimic undeva și nu se apelează niciun model.',
    fr: 'Alpha, utilisable : l’unique `index.html` compare des modèles d’IA à l’aveugle, hors ligne et sans serveur. Vous collez les réponses de deux à huit modèles aux 92 prompts fournis (roumain, anglais, hongrois) ou aux vôtres, vous votez A ou B sans voir les noms des modèles, et vous obtenez un classement Bradley–Terry et Elo avec intervalles de confiance, une page de résultats statique et un fichier `votes.jsonl` que chacun peut recalculer avec `scripts/rank.py`. Rien n’est envoyé et aucun modèle n’est appelé.',
    it: 'Alfa, utilizzabile: l’unico `index.html` confronta modelli di IA alla cieca, offline e senza server. Incolli le risposte da due a otto modelli ai 92 prompt inclusi (rumeno, inglese, ungherese) o ai tuoi, voti A o B senza vedere i nomi dei modelli e ottieni una classifica Bradley–Terry ed Elo con intervalli di confidenza, una pagina di risultati statica e un file `votes.jsonl` che chiunque può ricalcolare con `scripts/rank.py`. Non viene inviato nulla e non viene chiamato nessun modello.',
    es: 'Alfa, utilizable: el único `index.html` compara modelos de IA a ciegas, sin conexión y sin servidor. Pegas las respuestas de dos a ocho modelos a los 92 prompts incluidos (rumano, inglés, húngaro) o a los tuyos, votas A o B sin ver los nombres de los modelos y obtienes una clasificación Bradley–Terry y Elo con intervalos de confianza, una página de resultados estática y un archivo `votes.jsonl` que cualquiera puede recalcular con `scripts/rank.py`. No se envía nada y no se llama a ningún modelo.',
    pt: 'Alfa, utilizável: o único `index.html` compara modelos de IA às cegas, offline e sem servidor. Cola as respostas de dois a oito modelos aos 92 prompts incluídos (romeno, inglês, húngaro) ou aos seus, vota A ou B sem ver os nomes dos modelos e obtém uma classificação Bradley–Terry e Elo com intervalos de confiança, uma página de resultados estática e um ficheiro `votes.jsonl` que qualquer pessoa pode recalcular com `scripts/rank.py`. Nada é enviado e nenhum modelo é chamado.',
    de: 'Alpha, nutzbar: Die eine `index.html` vergleicht KI-Modelle blind, offline und ohne Server. Du fügst die Antworten von zwei bis acht Modellen auf die 92 mitgelieferten Prompts (Rumänisch, Englisch, Ungarisch) oder auf eigene ein, stimmst für A oder B ab, ohne die Modellnamen zu sehen, und erhältst eine Bradley–Terry- und Elo-Rangliste mit Konfidenzintervallen, eine statische Ergebnisseite und eine Datei `votes.jsonl`, die jeder mit `scripts/rank.py` nachrechnen kann. Nichts wird gesendet, und kein Modell wird aufgerufen.',
    hu: 'Alfa, használható: az egyetlen `index.html` vakon, offline és szerver nélkül hasonlít össze MI-modelleket. Beillesztheted két–nyolc modell válaszait a 92 mellékelt promptra (román, angol, magyar) vagy a sajátjaidra, A-ra vagy B-re szavazol a modellnevek ismerete nélkül, és kapsz egy Bradley–Terry- és Elo-rangsort megbízhatósági intervallumokkal, egy statikus eredményoldalt és egy `votes.jsonl` fájlt, amelyet bárki újraszámolhat a `scripts/rank.py` segítségével. Semmi sem kerül elküldésre, és egyetlen modellt sem hív meg.'
  };

  const does = {
    en: [
      'Ships 92 prompts as data files: Romanian grammar (30), culture and history with sources (20), reasoning (20), translation RO→EN and EN→RO (10) and a Hungarian set (12). Every prompt has reference notes.',
      'Blind voting: you paste each model’s answer, the app hides model names inside the answers (“[model]”), fixes the order and the A/B sides from a seed, and records A, B, tie or both bad (keys 1–4, undo, optional reveal after each vote).',
      'Ranking: Bradley–Terry (the main score) and Elo, 95% bootstrap intervals, win rate, both-bad rate, position bias, head to head, order by category and by language, filters.',
      'Open formats: `votes.jsonl` and `answers.jsonl` (JSON Lines, described in `docs/votes.md`), import that ignores duplicates and names faulty lines, `scripts/rank.py` that recomputes the same table without libraries, a static results page and a Markdown table.',
      'Your own prompts, checked automatically (e-mail, phone, CNP, IBAN, long quotations, Romanian diacritics) and exported as a JSON file ready for a pull request; interface in eight languages, dark and light themes, keyboard, works from 360 px wide; data stays in the browser, no network, no tracking.'
    ],
    ro: [
      'Include 92 de prompturi ca fișiere de date: gramatică românească (30), cultură și istorie cu surse (20), raționament (20), traducere RO→EN și EN→RO (10) și un set în maghiară (12). Fiecare prompt are note de referință.',
      'Vot orb: lipești răspunsul fiecărui model, aplicația ascunde numele modelelor din răspunsuri («[model]»), fixează ordinea și laturile A/B dintr-o sămânță și înregistrează A, B, egal sau ambele slabe (tastele 1–4, anulare, dezvăluire opțională după fiecare vot).',
      'Clasament: Bradley–Terry (scorul principal) și Elo, intervale bootstrap de 95%, rata de victorii, rata «ambele slabe», influența poziției, față în față, ordinea pe categorii și pe limbi, filtre.',
      'Formate deschise: `votes.jsonl` și `answers.jsonl` (JSON Lines, descrise în `docs/votes.md`), import care ignoră duplicatele și numește rândurile greșite, `scripts/rank.py` care recalculează același tabel fără biblioteci, o pagină statică de rezultate și un tabel Markdown.',
      'Prompturi proprii, verificate automat (e-mail, telefon, CNP, IBAN, citări lungi, diacritice românești) și exportate ca fișier JSON gata pentru un pull request; interfață în opt limbi, teme întunecată și luminoasă, tastatură, funcționează de la 360 px lățime; datele rămân în browser, fără rețea, fără urmărire.'
    ],
    fr: [
      'Fournit 92 prompts sous forme de fichiers de données : grammaire roumaine (30), culture et histoire avec sources (20), raisonnement (20), traduction RO→EN et EN→RO (10) et un jeu en hongrois (12). Chaque prompt a des notes de référence.',
      'Vote à l’aveugle : vous collez la réponse de chaque modèle, l’application masque les noms de modèles dans les réponses (« [model] »), fixe l’ordre et les côtés A/B à partir d’une graine et enregistre A, B, égalité ou les deux mauvaises (touches 1 à 4, annuler, affichage facultatif après chaque vote).',
      'Classement : Bradley–Terry (le score principal) et Elo, intervalles bootstrap à 95 %, taux de victoires, taux de « les deux mauvaises », influence de la position, face à face, ordre par catégorie et par langue, filtres.',
      'Formats ouverts : `votes.jsonl` et `answers.jsonl` (JSON Lines, décrits dans `docs/votes.md`), import qui ignore les doublons et nomme les lignes fautives, `scripts/rank.py` qui recalcule le même tableau sans bibliothèque, une page de résultats statique et un tableau Markdown.',
      'Vos propres prompts, vérifiés automatiquement (e-mail, téléphone, CNP, IBAN, longues citations, diacritiques roumains) et exportés en fichier JSON prêt pour une pull request ; interface en huit langues, thèmes sombre et clair, clavier, utilisable dès 360 px de large ; les données restent dans le navigateur, sans réseau, sans suivi.'
    ],
    it: [
      'Include 92 prompt come file di dati: grammatica rumena (30), cultura e storia con fonti (20), ragionamento (20), traduzione RO→EN ed EN→RO (10) e un set in ungherese (12). Ogni prompt ha note di riferimento.',
      'Voto alla cieca: incolli la risposta di ogni modello, l’app nasconde i nomi dei modelli nelle risposte («[model]»), fissa l’ordine e i lati A/B a partire da un seme e registra A, B, pari o entrambe scarse (tasti 1–4, annulla, rivelazione facoltativa dopo ogni voto).',
      'Classifica: Bradley–Terry (il punteggio principale) ed Elo, intervalli bootstrap al 95%, percentuale di vittorie, percentuale di «entrambe scarse», influenza della posizione, testa a testa, ordine per categoria e per lingua, filtri.',
      'Formati aperti: `votes.jsonl` e `answers.jsonl` (JSON Lines, descritti in `docs/votes.md`), importazione che ignora i duplicati e nomina le righe errate, `scripts/rank.py` che ricalcola la stessa tabella senza librerie, una pagina di risultati statica e una tabella Markdown.',
      'Prompt personali, controllati automaticamente (e-mail, telefono, CNP, IBAN, citazioni lunghe, segni diacritici rumeni) ed esportati come file JSON pronto per una pull request; interfaccia in otto lingue, temi scuro e chiaro, tastiera, funziona da 360 px di larghezza; i dati restano nel browser, senza rete, senza tracciamento.'
    ],
    es: [
      'Incluye 92 prompts como archivos de datos: gramática rumana (30), cultura e historia con fuentes (20), razonamiento (20), traducción RO→EN y EN→RO (10) y un conjunto en húngaro (12). Cada prompt tiene notas de referencia.',
      'Voto a ciegas: pegas la respuesta de cada modelo, la aplicación oculta los nombres de modelos dentro de las respuestas («[model]»), fija el orden y los lados A/B a partir de una semilla y registra A, B, empate o ambas malas (teclas 1–4, deshacer, revelación opcional tras cada voto).',
      'Clasificación: Bradley–Terry (la puntuación principal) y Elo, intervalos bootstrap del 95 %, porcentaje de victorias, porcentaje de «ambas malas», influencia de la posición, cara a cara, orden por categoría y por idioma, filtros.',
      'Formatos abiertos: `votes.jsonl` y `answers.jsonl` (JSON Lines, descritos en `docs/votes.md`), importación que ignora los duplicados y nombra las líneas erróneas, `scripts/rank.py` que recalcula la misma tabla sin bibliotecas, una página de resultados estática y una tabla Markdown.',
      'Tus propios prompts, comprobados automáticamente (correo, teléfono, CNP, IBAN, citas largas, diacríticos rumanos) y exportados como archivo JSON listo para un pull request; interfaz en ocho idiomas, temas oscuro y claro, teclado, funciona desde 360 px de ancho; los datos se quedan en el navegador, sin red, sin rastreo.'
    ],
    pt: [
      'Inclui 92 prompts como ficheiros de dados: gramática romena (30), cultura e história com fontes (20), raciocínio (20), tradução RO→EN e EN→RO (10) e um conjunto em húngaro (12). Cada prompt tem notas de referência.',
      'Votação às cegas: cola a resposta de cada modelo, a aplicação oculta os nomes dos modelos dentro das respostas («[model]»), fixa a ordem e os lados A/B a partir de uma semente e regista A, B, empate ou ambas ruins (teclas 1–4, anular, revelação opcional após cada voto).',
      'Classificação: Bradley–Terry (a pontuação principal) e Elo, intervalos bootstrap de 95%, percentagem de vitórias, percentagem de «ambas ruins», influência da posição, frente a frente, ordem por categoria e por idioma, filtros.',
      'Formatos abertos: `votes.jsonl` e `answers.jsonl` (JSON Lines, descritos em `docs/votes.md`), importação que ignora os duplicados e nomeia as linhas erradas, `scripts/rank.py` que recalcula a mesma tabela sem bibliotecas, uma página de resultados estática e uma tabela Markdown.',
      'Os seus próprios prompts, verificados automaticamente (e-mail, telefone, CNP, IBAN, citações longas, diacríticos romenos) e exportados como ficheiro JSON pronto para um pull request; interface em oito idiomas, temas escuro e claro, teclado, funciona desde 360 px de largura; os dados ficam no navegador, sem rede, sem rastreamento.'
    ],
    de: [
      'Liefert 92 Prompts als Datendateien: rumänische Grammatik (30), Kultur und Geschichte mit Quellen (20), logisches Denken (20), Übersetzung RO→EN und EN→RO (10) und einen ungarischen Satz (12). Jeder Prompt hat Referenznotizen.',
      'Blindes Abstimmen: Du fügst die Antwort jedes Modells ein, die App verbirgt die Modellnamen in den Antworten („[model]“), legt Reihenfolge und A/B-Seiten aus einem Seed fest und speichert A, B, Unentschieden oder beide schlecht (Tasten 1–4, Rückgängig, optionale Anzeige nach jeder Stimme).',
      'Rangliste: Bradley–Terry (die Hauptwertung) und Elo, 95-%-Bootstrap-Intervalle, Siegquote, Quote „beide schlecht“, Positionseinfluss, Direktvergleich, Reihenfolge nach Kategorie und nach Sprache, Filter.',
      'Offene Formate: `votes.jsonl` und `answers.jsonl` (JSON Lines, beschrieben in `docs/votes.md`), Import, der Duplikate ignoriert und fehlerhafte Zeilen benennt, `scripts/rank.py`, das dieselbe Tabelle ohne Bibliotheken nachrechnet, eine statische Ergebnisseite und eine Markdown-Tabelle.',
      'Eigene Prompts, automatisch geprüft (E-Mail, Telefon, CNP, IBAN, lange Zitate, rumänische Diakritika) und als JSON-Datei für einen Pull Request exportiert; Oberfläche in acht Sprachen, dunkles und helles Design, Tastatur, nutzbar ab 360 px Breite; die Daten bleiben im Browser, ohne Netzwerk, ohne Tracking.'
    ],
    hu: [
      '92 promptot tartalmaz adatfájlként: román nyelvtan (30), kultúra és történelem forrásokkal (20), gondolkodás (20), RO→EN és EN→RO fordítás (10) és egy magyar készlet (12). Minden prompthoz tartozik referenciajegyzet.',
      'Vak szavazás: beilleszted az egyes modellek válaszát, az alkalmazás elrejti a modellneveket a válaszokban („[model]”), egy magból rögzíti a sorrendet és az A/B oldalakat, és rögzíti az A-t, a B-t, a döntetlent vagy a mindkettő gyenge értékelést (1–4 billentyűk, visszavonás, opcionális felfedés minden szavazat után).',
      'Rangsor: Bradley–Terry (a fő pontszám) és Elo, 95%-os bootstrap-intervallumok, győzelmi arány, „mindkettő gyenge” arány, a pozíció hatása, egymás elleni mérleg, sorrend kategóriánként és nyelvenként, szűrők.',
      'Nyílt formátumok: `votes.jsonl` és `answers.jsonl` (JSON Lines, a `docs/votes.md` írja le), import, amely figyelmen kívül hagyja az ismétlődéseket és megnevezi a hibás sorokat, a `scripts/rank.py`, amely könyvtárak nélkül újraszámolja ugyanazt a táblázatot, statikus eredményoldal és Markdown-táblázat.',
      'Saját promptok automatikus ellenőrzéssel (e-mail, telefon, CNP, IBAN, hosszú idézetek, román ékezetek), pull requestre kész JSON-fájlként exportálva; nyolc nyelvű felület, sötét és világos téma, billentyűzet, 360 px szélességtől működik; az adatok a böngészőben maradnak, hálózat és követés nélkül.'
    ]
  };

  const how = {
    en: [
      'One JSON file per prompt in `data/prompts/`, checked by `schema.json`; `docs/votes.md` (and `docs/votes.ro.md`) describes the vote format, the algorithms and the prompt-quality checklist.',
      '`src/engine.mjs` is the engine (no screen, no network): vote format, Elo, Bradley–Terry (with a virtual anchor opponent so that unbeaten and winless models get finite ratings), bootstrap, pairing from a hash of the seed, anonymisation, prompt checks and exports. `scripts/rank.py` redoes the same arithmetic in Python without libraries; the tests compare both to 1e-6.',
      '`src/ui.js`, `src/i18n.mjs` and `src/app.css` are the interface; `node scripts/build.mjs` builds the single `index.html` (`--check` verifies that it matches).',
      '`npm test` runs the tests of the engine, the data files and the interface texts; `python scripts/validate.py` checks the JSON files; the browser tests are in the hub. Development needs Node.js 24 or newer; the page itself only needs a browser that knows ES2017.'
    ],
    ro: [
      'Un fișier JSON pe prompt în `data/prompts/`, verificat de `schema.json`; `docs/votes.ro.md` (și `docs/votes.md`) descrie formatul voturilor, algoritmii și lista de verificare a calității prompturilor.',
      '`src/engine.mjs` este motorul (fără ecran, fără rețea): formatul voturilor, Elo, Bradley–Terry (cu un adversar virtual de ancorare, ca modelele neînvinse sau fără nicio victorie să primească scoruri finite), bootstrap, perechi din hash-ul sămânței, anonimizare, verificarea prompturilor și exporturi. `scripts/rank.py` refă aceleași calcule în Python, fără biblioteci; testele le compară pe amândouă la 1e-6.',
      '`src/ui.js`, `src/i18n.mjs` și `src/app.css` sunt interfața; `node scripts/build.mjs` construiește singurul `index.html` (`--check` verifică dacă se potrivește).',
      '`npm test` rulează testele motorului, ale fișierelor de date și ale textelor interfeței; `python scripts/validate.py` verifică fișierele JSON; testele de browser sunt în hub. Dezvoltarea cere Node.js 24 sau mai nou; pagina în sine cere doar un browser care cunoaște ES2017.'
    ],
    fr: [
      'Un fichier JSON par prompt dans `data/prompts/`, vérifié par `schema.json` ; `docs/votes.md` (et `docs/votes.ro.md`) décrit le format des votes, les algorithmes et la liste de contrôle de qualité des prompts.',
      '`src/engine.mjs` est le moteur (sans écran, sans réseau) : format des votes, Elo, Bradley–Terry (avec un adversaire virtuel d’ancrage pour que les modèles invaincus ou sans victoire aient des scores finis), bootstrap, appariement à partir d’un hachage de la graine, anonymisation, vérification des prompts et exports. `scripts/rank.py` refait le même calcul en Python sans bibliothèque ; les tests comparent les deux à 1e-6.',
      '`src/ui.js`, `src/i18n.mjs` et `src/app.css` forment l’interface ; `node scripts/build.mjs` construit l’unique `index.html` (`--check` vérifie qu’il correspond).',
      '`npm test` lance les tests du moteur, des fichiers de données et des textes de l’interface ; `python scripts/validate.py` vérifie les fichiers JSON ; les tests de navigateur sont dans le hub. Le développement demande Node.js 24 ou plus récent ; la page elle-même n’exige qu’un navigateur qui connaît ES2017.'
    ],
    it: [
      'Un file JSON per prompt in `data/prompts/`, controllato da `schema.json`; `docs/votes.md` (e `docs/votes.ro.md`) descrive il formato dei voti, gli algoritmi e la lista di controllo della qualità dei prompt.',
      '`src/engine.mjs` è il motore (senza schermo, senza rete): formato dei voti, Elo, Bradley–Terry (con un avversario virtuale di ancoraggio, così i modelli imbattuti o senza vittorie ottengono punteggi finiti), bootstrap, accoppiamenti a partire da un hash del seme, anonimizzazione, controllo dei prompt ed esportazioni. `scripts/rank.py` rifà lo stesso calcolo in Python senza librerie; i test confrontano i due a 1e-6.',
      '`src/ui.js`, `src/i18n.mjs` e `src/app.css` sono l’interfaccia; `node scripts/build.mjs` costruisce l’unico `index.html` (`--check` verifica che corrisponda).',
      '`npm test` esegue i test del motore, dei file di dati e dei testi dell’interfaccia; `python scripts/validate.py` controlla i file JSON; i test del browser sono nell’hub. Lo sviluppo richiede Node.js 24 o più recente; la pagina stessa richiede solo un browser che conosca ES2017.'
    ],
    es: [
      'Un archivo JSON por prompt en `data/prompts/`, comprobado por `schema.json`; `docs/votes.md` (y `docs/votes.ro.md`) describe el formato de los votos, los algoritmos y la lista de control de calidad de los prompts.',
      '`src/engine.mjs` es el motor (sin pantalla, sin red): formato de los votos, Elo, Bradley–Terry (con un rival virtual de anclaje para que los modelos invictos o sin victorias obtengan puntuaciones finitas), bootstrap, emparejamientos a partir de un hash de la semilla, anonimización, comprobación de prompts y exportaciones. `scripts/rank.py` rehace la misma aritmética en Python sin bibliotecas; las pruebas comparan ambos a 1e-6.',
      '`src/ui.js`, `src/i18n.mjs` y `src/app.css` son la interfaz; `node scripts/build.mjs` construye el único `index.html` (`--check` verifica que coincide).',
      '`npm test` ejecuta las pruebas del motor, de los archivos de datos y de los textos de la interfaz; `python scripts/validate.py` comprueba los archivos JSON; las pruebas de navegador están en el hub. El desarrollo requiere Node.js 24 o más reciente; la página en sí solo necesita un navegador que conozca ES2017.'
    ],
    pt: [
      'Um ficheiro JSON por prompt em `data/prompts/`, verificado por `schema.json`; `docs/votes.md` (e `docs/votes.ro.md`) descreve o formato dos votos, os algoritmos e a lista de verificação da qualidade dos prompts.',
      '`src/engine.mjs` é o motor (sem ecrã, sem rede): formato dos votos, Elo, Bradley–Terry (com um adversário virtual de ancoragem, para que os modelos invictos ou sem vitórias obtenham pontuações finitas), bootstrap, emparelhamentos a partir de um hash da semente, anonimização, verificação dos prompts e exportações. `scripts/rank.py` refaz a mesma aritmética em Python sem bibliotecas; os testes comparam ambos a 1e-6.',
      '`src/ui.js`, `src/i18n.mjs` e `src/app.css` são a interface; `node scripts/build.mjs` constrói o único `index.html` (`--check` verifica que coincide).',
      '`npm test` executa os testes do motor, dos ficheiros de dados e dos textos da interface; `python scripts/validate.py` verifica os ficheiros JSON; os testes de navegador estão no hub. O desenvolvimento requer Node.js 24 ou mais recente; a página em si só precisa de um navegador que conheça ES2017.'
    ],
    de: [
      'Eine JSON-Datei pro Prompt in `data/prompts/`, geprüft durch `schema.json`; `docs/votes.md` (und `docs/votes.ro.md`) beschreibt das Stimmenformat, die Algorithmen und die Qualitäts-Checkliste für Prompts.',
      '`src/engine.mjs` ist der Motor (ohne Bildschirm, ohne Netzwerk): Stimmenformat, Elo, Bradley–Terry (mit einem virtuellen Ankergegner, damit ungeschlagene und sieglose Modelle endliche Wertungen erhalten), Bootstrap, Paarbildung aus einem Hash des Seeds, Anonymisierung, Prompt-Prüfung und Exporte. `scripts/rank.py` rechnet dasselbe in Python ohne Bibliotheken nach; die Tests vergleichen beide auf 1e-6.',
      '`src/ui.js`, `src/i18n.mjs` und `src/app.css` bilden die Oberfläche; `node scripts/build.mjs` baut die eine `index.html` (`--check` prüft, ob sie übereinstimmt).',
      '`npm test` führt die Tests des Motors, der Datendateien und der Oberflächentexte aus; `python scripts/validate.py` prüft die JSON-Dateien; die Browsertests liegen im Hub. Für die Entwicklung braucht man Node.js 24 oder neuer; die Seite selbst braucht nur einen Browser, der ES2017 kennt.'
    ],
    hu: [
      'Promptonként egy JSON-fájl a `data/prompts/` mappában, a `schema.json` ellenőrzi; a `docs/votes.md` (és a `docs/votes.ro.md`) leírja a szavazatok formátumát, az algoritmusokat és a promptok minőségi ellenőrzőlistáját.',
      'A `src/engine.mjs` a motor (képernyő és hálózat nélkül): szavazatformátum, Elo, Bradley–Terry (virtuális horgonyellenféllel, hogy a veretlen és a győzelem nélküli modellek véges pontszámot kapjanak), bootstrap, párosítás a mag hash-éből, anonimizálás, promptellenőrzés és exportok. A `scripts/rank.py` könyvtárak nélkül, Pythonban újraszámolja ugyanazt; a tesztek 1e-6 pontossággal összevetik a kettőt.',
      'A `src/ui.js`, `src/i18n.mjs` és `src/app.css` a felület; a `node scripts/build.mjs` építi az egyetlen `index.html` fájlt (a `--check` ellenőrzi, hogy egyezik-e).',
      'Az `npm test` futtatja a motor, az adatfájlok és a felületi szövegek tesztjeit; a `python scripts/validate.py` a JSON-fájlokat ellenőrzi; a böngészőtesztek a hubban vannak. A fejlesztéshez Node.js 24 vagy újabb kell; maga az oldal csak ES2017-et ismerő böngészőt igényel.'
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

  const body = (t) => t.join('\n');
  const contrib = {
    heading: {en: 'Adding prompts and votes', ro: 'Adăugarea de prompturi și voturi', fr: 'Ajouter des prompts et des votes', it: 'Aggiungere prompt e voti', es: 'Añadir prompts y votos', pt: 'Acrescentar prompts e votos', de: 'Prompts und Stimmen beitragen', hu: 'Promptok és szavazatok hozzáadása'},
    body: {
      en: body([
        '1. Copy `data/prompts/example.json` to `data/prompts/<lang>-<category>-<NNNN>.json`: the file name is the `id`, with the next free number of its group (`ro-grammar-0031`).',
        '2. Write the `prompt` in the language given by `lang`, as a complete question that can be answered without opening a link. In `reference_notes` say what a correct answer must contain, in one or two sentences. For `culture` the notes and at least one `https` source are mandatory.',
        '3. Quality checklist: no personal data (private people, e-mail, phone, CNP, IBAN); no copied copyrighted text (paraphrase; the app blocks a quoted passage of 300 characters or more); Romanian with comma-below diacritics (ș, ț), never the cedilla; one clear correct answer or clear criteria; every fact checked against a source, and time-sensitive facts marked as such; an honest `difficulty`.',
        '4. Run `python scripts/validate.py` and `npm test`: the tests check the schema, the id and the numbering, the notes and sources, the checklist rules and duplicates.',
        '5. To contribute votes, export `votes.jsonl` from the app (format in `docs/votes.md`), check it with `python scripts/rank.py votes.jsonl`, and attach it to an issue or pull request together with `answers.jsonl` and the exact model names, versions and settings; never include personal data.',
        '6. Native-speaker review of the Hungarian and translation prompts is very welcome: open an issue with the id and the proposed fix.'
      ]),
      ro: body([
        '1. Copiază `data/prompts/example.json` în `data/prompts/<lang>-<category>-<NNNN>.json`: numele fișierului este `id`, cu următorul număr liber din grupul lui (`ro-grammar-0031`).',
        '2. Scrie `prompt` în limba dată de `lang`, ca o întrebare completă la care se poate răspunde fără să deschizi un link. În `reference_notes` spune ce trebuie să conțină un răspuns corect, în una-două propoziții. Pentru `culture` notele și cel puțin o sursă `https` sunt obligatorii.',
        '3. Lista de verificare a calității: fără date personale (persoane private, e-mail, telefon, CNP, IBAN); fără text copiat protejat de drepturi de autor (parafrazează; aplicația blochează un pasaj citat de 300 de caractere sau mai mult); română cu diacritice cu virgulă (ș, ț), niciodată cu sedilă; un singur răspuns corect clar sau criterii clare; fiecare fapt verificat într-o sursă, iar faptele care se pot schimba în timp marcate ca atare; o `difficulty` sinceră.',
        '4. Rulează `python scripts/validate.py` și `npm test`: testele verifică schema, id-ul și numerotarea, notele și sursele, regulile din lista de verificare și duplicatele.',
        '5. Pentru a contribui cu voturi, exportă `votes.jsonl` din aplicație (formatul în `docs/votes.ro.md`), verifică-l cu `python scripts/rank.py votes.jsonl` și atașează-l la un issue sau la un pull request împreună cu `answers.jsonl` și cu numele exacte, versiunile și setările modelelor; nu include niciodată date personale.',
        '6. Revizuirea de către vorbitori nativi a prompturilor în maghiară și de traducere este foarte binevenită: deschide un issue cu id-ul și corectura propusă.'
      ]),
      fr: body([
        '1. Copiez `data/prompts/example.json` vers `data/prompts/<lang>-<category>-<NNNN>.json` : le nom du fichier est l’`id`, avec le prochain numéro libre de son groupe (`ro-grammar-0031`).',
        '2. Rédigez le `prompt` dans la langue donnée par `lang`, comme une question complète à laquelle on peut répondre sans ouvrir un lien. Dans `reference_notes`, dites ce qu’une bonne réponse doit contenir, en une ou deux phrases. Pour `culture`, les notes et au moins une source `https` sont obligatoires.',
        '3. Liste de contrôle de qualité : pas de données personnelles (personnes privées, e-mail, téléphone, CNP, IBAN) ; pas de texte protégé copié (paraphrasez ; l’application bloque un passage cité de 300 caractères ou plus) ; roumain avec les diacritiques à virgule (ș, ț), jamais la cédille ; une seule bonne réponse claire ou des critères clairs ; chaque fait vérifié dans une source, et les faits susceptibles de changer signalés comme tels ; une `difficulty` honnête.',
        '4. Lancez `python scripts/validate.py` et `npm test` : les tests vérifient le schéma, l’id et la numérotation, les notes et les sources, les règles de la liste de contrôle et les doublons.',
        '5. Pour apporter des votes, exportez `votes.jsonl` depuis l’application (format dans `docs/votes.md`), vérifiez-le avec `python scripts/rank.py votes.jsonl` et joignez-le à une issue ou à une pull request avec `answers.jsonl` et les noms exacts, versions et réglages des modèles ; n’incluez jamais de données personnelles.',
        '6. La relecture des prompts en hongrois et de traduction par des locuteurs natifs est la bienvenue : ouvrez une issue avec l’id et la correction proposée.'
      ]),
      it: body([
        '1. Copia `data/prompts/example.json` in `data/prompts/<lang>-<category>-<NNNN>.json`: il nome del file è l’`id`, con il prossimo numero libero del suo gruppo (`ro-grammar-0031`).',
        '2. Scrivi il `prompt` nella lingua indicata da `lang`, come una domanda completa a cui si può rispondere senza aprire un link. In `reference_notes` indica cosa deve contenere una risposta corretta, in una o due frasi. Per `culture` le note e almeno una fonte `https` sono obbligatorie.',
        '3. Lista di controllo della qualità: nessun dato personale (persone private, e-mail, telefono, CNP, IBAN); nessun testo protetto copiato (parafrasa; l’app blocca un passo citato di 300 caratteri o più); rumeno con i segni diacritici con virgola (ș, ț), mai con la cediglia; una sola risposta corretta chiara o criteri chiari; ogni fatto verificato su una fonte, e i fatti che possono cambiare nel tempo indicati come tali; una `difficulty` onesta.',
        '4. Esegui `python scripts/validate.py` e `npm test`: i test controllano lo schema, l’id e la numerazione, le note e le fonti, le regole della lista di controllo e i duplicati.',
        '5. Per contribuire con dei voti, esporta `votes.jsonl` dall’app (formato in `docs/votes.md`), controllalo con `python scripts/rank.py votes.jsonl` e allegalo a una issue o a una pull request insieme a `answers.jsonl` e ai nomi esatti, alle versioni e alle impostazioni dei modelli; non includere mai dati personali.',
        '6. La revisione da parte di madrelingua dei prompt in ungherese e di traduzione è molto gradita: apri una issue con l’id e la correzione proposta.'
      ]),
      es: body([
        '1. Copia `data/prompts/example.json` en `data/prompts/<lang>-<category>-<NNNN>.json`: el nombre del archivo es el `id`, con el siguiente número libre de su grupo (`ro-grammar-0031`).',
        '2. Escribe el `prompt` en el idioma indicado por `lang`, como una pregunta completa que se pueda responder sin abrir un enlace. En `reference_notes` indica qué debe contener una respuesta correcta, en una o dos frases. Para `culture` las notas y al menos una fuente `https` son obligatorias.',
        '3. Lista de control de calidad: sin datos personales (personas privadas, correo, teléfono, CNP, IBAN); sin texto protegido copiado (parafrasea; la aplicación bloquea un pasaje citado de 300 caracteres o más); rumano con los diacríticos con coma (ș, ț), nunca con cedilla; una única respuesta correcta clara o criterios claros; cada hecho comprobado en una fuente, y los hechos que pueden cambiar con el tiempo marcados como tales; una `difficulty` honesta.',
        '4. Ejecuta `python scripts/validate.py` y `npm test`: las pruebas comprueban el esquema, el id y la numeración, las notas y las fuentes, las reglas de la lista de control y los duplicados.',
        '5. Para aportar votos, exporta `votes.jsonl` desde la aplicación (formato en `docs/votes.md`), compruébalo con `python scripts/rank.py votes.jsonl` y adjúntalo a una issue o a un pull request junto con `answers.jsonl` y los nombres exactos, versiones y ajustes de los modelos; nunca incluyas datos personales.',
        '6. La revisión por hablantes nativos de los prompts en húngaro y de traducción es muy bienvenida: abre una issue con el id y la corrección propuesta.'
      ]),
      pt: body([
        '1. Copie `data/prompts/example.json` para `data/prompts/<lang>-<category>-<NNNN>.json`: o nome do ficheiro é o `id`, com o próximo número livre do seu grupo (`ro-grammar-0031`).',
        '2. Escreva o `prompt` no idioma indicado por `lang`, como uma pergunta completa a que se possa responder sem abrir uma ligação. Em `reference_notes` diga o que uma resposta correta deve conter, em uma ou duas frases. Para `culture` as notas e pelo menos uma fonte `https` são obrigatórias.',
        '3. Lista de verificação da qualidade: sem dados pessoais (pessoas privadas, e-mail, telefone, CNP, IBAN); sem texto protegido copiado (parafraseie; a aplicação bloqueia uma passagem citada de 300 carateres ou mais); romeno com os diacríticos com vírgula (ș, ț), nunca com cedilha; uma única resposta correta clara ou critérios claros; cada facto verificado numa fonte, e os factos que podem mudar com o tempo assinalados como tal; uma `difficulty` honesta.',
        '4. Execute `python scripts/validate.py` e `npm test`: os testes verificam o esquema, o id e a numeração, as notas e as fontes, as regras da lista de verificação e os duplicados.',
        '5. Para contribuir com votos, exporte `votes.jsonl` da aplicação (formato em `docs/votes.md`), verifique-o com `python scripts/rank.py votes.jsonl` e anexe-o a uma issue ou a um pull request juntamente com `answers.jsonl` e os nomes exatos, versões e definições dos modelos; nunca inclua dados pessoais.',
        '6. A revisão por falantes nativos dos prompts em húngaro e de tradução é muito bem-vinda: abra uma issue com o id e a correção proposta.'
      ]),
      de: body([
        '1. Kopiere `data/prompts/example.json` nach `data/prompts/<lang>-<category>-<NNNN>.json`: Der Dateiname ist die `id`, mit der nächsten freien Nummer ihrer Gruppe (`ro-grammar-0031`).',
        '2. Schreibe den `prompt` in der Sprache aus `lang`, als vollständige Frage, die sich ohne Öffnen eines Links beantworten lässt. In `reference_notes` steht in ein bis zwei Sätzen, was eine richtige Antwort enthalten muss. Für `culture` sind die Notizen und mindestens eine `https`-Quelle Pflicht.',
        '3. Qualitäts-Checkliste: keine personenbezogenen Daten (Privatpersonen, E-Mail, Telefon, CNP, IBAN); kein kopierter urheberrechtlich geschützter Text (paraphrasieren; die App blockiert eine zitierte Passage ab 300 Zeichen); Rumänisch mit Komma-Diakritika (ș, ț), nie mit Cedille; eine klare richtige Antwort oder klare Kriterien; jeder Fakt an einer Quelle geprüft, zeitabhängige Fakten als solche markiert; eine ehrliche `difficulty`.',
        '4. Führe `python scripts/validate.py` und `npm test` aus: Die Tests prüfen Schema, id und Nummerierung, Notizen und Quellen, die Regeln der Checkliste und Duplikate.',
        '5. Um Stimmen beizusteuern, exportiere `votes.jsonl` aus der App (Format in `docs/votes.md`), prüfe sie mit `python scripts/rank.py votes.jsonl` und hänge sie an ein Issue oder einen Pull Request, zusammen mit `answers.jsonl` und den genauen Modellnamen, Versionen und Einstellungen; füge nie personenbezogene Daten hinzu.',
        '6. Die Durchsicht der ungarischen und der Übersetzungs-Prompts durch Muttersprachler ist sehr willkommen: Eröffne ein Issue mit der id und dem Korrekturvorschlag.'
      ]),
      hu: body([
        '1. Másold a `data/prompts/example.json` fájlt a `data/prompts/<lang>-<category>-<NNNN>.json` helyre: a fájlnév az `id`, a csoportja következő szabad számával (`ro-grammar-0031`).',
        '2. Írd meg a `prompt` mezőt a `lang` által megadott nyelven, olyan teljes kérdésként, amelyre hivatkozás megnyitása nélkül is lehet válaszolni. A `reference_notes` mezőben egy-két mondatban írd le, mit kell tartalmaznia a helyes válasznak. A `culture` kategóriánál a jegyzet és legalább egy `https` forrás kötelező.',
        '3. Minőségi ellenőrzőlista: nincs személyes adat (magánszemélyek, e-mail, telefon, CNP, IBAN); nincs másolt, jogvédett szöveg (fogalmazd át; az alkalmazás blokkolja a 300 vagy több karakteres idézett részletet); román szöveg vesszős ékezetekkel (ș, ț), soha nem cedillával; egyetlen egyértelmű helyes válasz vagy egyértelmű szempontok; minden tény forrással ellenőrizve, az idővel változó tények megjelölve; őszinte `difficulty`.',
        '4. Futtasd a `python scripts/validate.py` és az `npm test` parancsot: a tesztek ellenőrzik a sémát, az id-t és a számozást, a jegyzeteket és a forrásokat, az ellenőrzőlista szabályait és az ismétlődéseket.',
        '5. Szavazatok beküldéséhez exportáld a `votes.jsonl` fájlt az alkalmazásból (formátum: `docs/votes.md`), ellenőrizd a `python scripts/rank.py votes.jsonl` paranccsal, és csatold egy issue-hoz vagy pull requesthez az `answers.jsonl` fájllal, valamint a modellek pontos nevével, verziójával és beállításaival; soha ne tegyél bele személyes adatot.',
        '6. A magyar és a fordítási promptok anyanyelvi átnézését nagyon szívesen fogadjuk: nyiss egy issue-t az id-vel és a javasolt javítással.'
      ])
    }
  };

  const issues = {
    en: [
      'Have native speakers review the 12 Hungarian prompts and the 10 translation prompts (RO→EN, EN→RO): wording, reference notes and the choice of idioms',
      'Re-check the facts of the 22 culture prompts against their sources, add a second source to each, and mark the facts that can change over time',
      'Add 20 Romanian prompts for the `law` category (constitutional basics, consumer rights, contracts) with reference notes and official sources',
      'Add 20 Romanian prompts for the `science` category (physics, chemistry, biology, mathematics) with verified reference answers',
      'Add `creative` prompts (short text, rhyme, register) whose reference notes state clear judging criteria and that do not ask to reproduce protected works',
      'Add `code` prompts (short Python and JavaScript tasks with Romanian comments) whose reference notes include a test that checks the answer',
      'Add prompt sets in French, German, Italian, Spanish or Portuguese for the categories that fit (the interface and the schema already accept these languages)',
      'Write `scripts/agreement.py`: when two people vote the same pairs, report their agreement (Cohen’s kappa) and the pairs where they differ, with tests on a small example',
      'Write a helper script that turns the output of a local model runner into `answers.jsonl` (no API keys in the repository, no network calls from the page)',
      'Add a bootstrap over prompts (not only over votes) to `src/engine.mjs` and `scripts/rank.py`, show both intervals in the results and test that the two programs agree'
    ],
    ro: [
      'Cere vorbitorilor nativi să revizuiască cele 12 prompturi în maghiară și cele 10 prompturi de traducere (RO→EN, EN→RO): formulări, note de referință și alegerea expresiilor idiomatice',
      'Reverifică faptele celor 22 de prompturi de cultură în sursele lor, adaugă o a doua sursă fiecăruia și marchează faptele care se pot schimba în timp',
      'Adaugă 20 de prompturi în română pentru categoria `law` (noțiuni constituționale, drepturile consumatorului, contracte), cu note de referință și surse oficiale',
      'Adaugă 20 de prompturi în română pentru categoria `science` (fizică, chimie, biologie, matematică), cu răspunsuri de referință verificate',
      'Adaugă prompturi `creative` (text scurt, rimă, registru) ale căror note de referință dau criterii clare de apreciere și care nu cer reproducerea unor opere protejate',
      'Adaugă prompturi `code` (sarcini scurte în Python și JavaScript, cu comentarii în română) ale căror note de referință includ un test care verifică răspunsul',
      'Adaugă seturi de prompturi în franceză, germană, italiană, spaniolă sau portugheză pentru categoriile potrivite (interfața și schema acceptă deja aceste limbi)',
      'Scrie `scripts/agreement.py`: când două persoane votează aceleași perechi, raportează acordul lor (kappa Cohen) și perechile în care diferă, cu teste pe un exemplu mic',
      'Scrie un script ajutător care transformă ieșirea unui executor local de modele în `answers.jsonl` (fără chei API în depozit, fără apeluri de rețea din pagină)',
      'Adaugă în `src/engine.mjs` și în `scripts/rank.py` un bootstrap peste prompturi (nu doar peste voturi), arată ambele intervale în rezultate și testează că cele două programe sunt de acord'
    ],
    fr: [
      'Faire relire par des locuteurs natifs les 12 prompts en hongrois et les 10 prompts de traduction (RO→EN, EN→RO) : formulations, notes de référence et choix des expressions idiomatiques',
      'Revérifier les faits des 22 prompts de culture dans leurs sources, ajouter une seconde source à chacun et signaler les faits susceptibles de changer',
      'Ajouter 20 prompts en roumain pour la catégorie `law` (notions constitutionnelles, droits des consommateurs, contrats), avec notes de référence et sources officielles',
      'Ajouter 20 prompts en roumain pour la catégorie `science` (physique, chimie, biologie, mathématiques), avec des réponses de référence vérifiées',
      'Ajouter des prompts `creative` (texte court, rime, registre) dont les notes de référence donnent des critères d’appréciation clairs et qui ne demandent pas de reproduire des œuvres protégées',
      'Ajouter des prompts `code` (courtes tâches en Python et JavaScript, avec commentaires en roumain) dont les notes de référence incluent un test qui vérifie la réponse',
      'Ajouter des jeux de prompts en français, allemand, italien, espagnol ou portugais pour les catégories qui s’y prêtent (l’interface et le schéma acceptent déjà ces langues)',
      'Écrire `scripts/agreement.py` : quand deux personnes votent les mêmes paires, indiquer leur accord (kappa de Cohen) et les paires où elles divergent, avec des tests sur un petit exemple',
      'Écrire un script d’aide qui transforme la sortie d’un exécuteur local de modèles en `answers.jsonl` (pas de clés d’API dans le dépôt, pas d’appels réseau depuis la page)',
      'Ajouter à `src/engine.mjs` et à `scripts/rank.py` un bootstrap sur les prompts (et pas seulement sur les votes), afficher les deux intervalles dans les résultats et tester que les deux programmes concordent'
    ],
    it: [
      'Far rivedere da madrelingua i 12 prompt in ungherese e i 10 prompt di traduzione (RO→EN, EN→RO): formulazioni, note di riferimento e scelta delle espressioni idiomatiche',
      'Ricontrollare i fatti dei 22 prompt di cultura sulle loro fonti, aggiungere una seconda fonte a ciascuno e segnalare i fatti che possono cambiare nel tempo',
      'Aggiungere 20 prompt in rumeno per la categoria `law` (nozioni costituzionali, diritti dei consumatori, contratti), con note di riferimento e fonti ufficiali',
      'Aggiungere 20 prompt in rumeno per la categoria `science` (fisica, chimica, biologia, matematica), con risposte di riferimento verificate',
      'Aggiungere prompt `creative` (testo breve, rima, registro) le cui note di riferimento indichino criteri di valutazione chiari e che non chiedano di riprodurre opere protette',
      'Aggiungere prompt `code` (brevi compiti in Python e JavaScript, con commenti in rumeno) le cui note di riferimento includano un test che verifichi la risposta',
      'Aggiungere set di prompt in francese, tedesco, italiano, spagnolo o portoghese per le categorie adatte (l’interfaccia e lo schema accettano già queste lingue)',
      'Scrivere `scripts/agreement.py`: quando due persone votano le stesse coppie, riportare il loro accordo (kappa di Cohen) e le coppie in cui divergono, con test su un piccolo esempio',
      'Scrivere uno script di aiuto che trasformi l’output di un esecutore locale di modelli in `answers.jsonl` (nessuna chiave API nel repository, nessuna chiamata di rete dalla pagina)',
      'Aggiungere a `src/engine.mjs` e a `scripts/rank.py` un bootstrap sui prompt (non solo sui voti), mostrare entrambi gli intervalli nei risultati e verificare che i due programmi concordino'
    ],
    es: [
      'Pedir a hablantes nativos que revisen los 12 prompts en húngaro y los 10 prompts de traducción (RO→EN, EN→RO): redacción, notas de referencia y elección de las expresiones idiomáticas',
      'Volver a comprobar los hechos de los 22 prompts de cultura en sus fuentes, añadir una segunda fuente a cada uno y marcar los hechos que pueden cambiar con el tiempo',
      'Añadir 20 prompts en rumano para la categoría `law` (nociones constitucionales, derechos del consumidor, contratos), con notas de referencia y fuentes oficiales',
      'Añadir 20 prompts en rumano para la categoría `science` (física, química, biología, matemáticas), con respuestas de referencia verificadas',
      'Añadir prompts `creative` (texto breve, rima, registro) cuyas notas de referencia den criterios de valoración claros y que no pidan reproducir obras protegidas',
      'Añadir prompts `code` (tareas breves en Python y JavaScript, con comentarios en rumano) cuyas notas de referencia incluyan una prueba que compruebe la respuesta',
      'Añadir conjuntos de prompts en francés, alemán, italiano, español o portugués para las categorías que encajen (la interfaz y el esquema ya aceptan estos idiomas)',
      'Escribir `scripts/agreement.py`: cuando dos personas votan los mismos pares, informar de su acuerdo (kappa de Cohen) y de los pares en que difieren, con pruebas sobre un ejemplo pequeño',
      'Escribir un script auxiliar que convierta la salida de un ejecutor local de modelos en `answers.jsonl` (sin claves de API en el repositorio, sin llamadas de red desde la página)',
      'Añadir a `src/engine.mjs` y a `scripts/rank.py` un bootstrap sobre los prompts (y no solo sobre los votos), mostrar ambos intervalos en los resultados y comprobar que los dos programas coinciden'
    ],
    pt: [
      'Pedir a falantes nativos que revejam os 12 prompts em húngaro e os 10 prompts de tradução (RO→EN, EN→RO): formulações, notas de referência e escolha das expressões idiomáticas',
      'Voltar a verificar os factos dos 22 prompts de cultura nas suas fontes, acrescentar uma segunda fonte a cada um e assinalar os factos que podem mudar com o tempo',
      'Acrescentar 20 prompts em romeno para a categoria `law` (noções constitucionais, direitos do consumidor, contratos), com notas de referência e fontes oficiais',
      'Acrescentar 20 prompts em romeno para a categoria `science` (física, química, biologia, matemática), com respostas de referência verificadas',
      'Acrescentar prompts `creative` (texto curto, rima, registo) cujas notas de referência deem critérios de avaliação claros e que não peçam a reprodução de obras protegidas',
      'Acrescentar prompts `code` (tarefas curtas em Python e JavaScript, com comentários em romeno) cujas notas de referência incluam um teste que verifique a resposta',
      'Acrescentar conjuntos de prompts em francês, alemão, italiano, espanhol ou português para as categorias adequadas (a interface e o esquema já aceitam estes idiomas)',
      'Escrever `scripts/agreement.py`: quando duas pessoas votam os mesmos pares, indicar a sua concordância (kappa de Cohen) e os pares em que divergem, com testes sobre um pequeno exemplo',
      'Escrever um script auxiliar que converta a saída de um executor local de modelos em `answers.jsonl` (sem chaves de API no repositório, sem chamadas de rede a partir da página)',
      'Acrescentar a `src/engine.mjs` e a `scripts/rank.py` um bootstrap sobre os prompts (e não apenas sobre os votos), mostrar os dois intervalos nos resultados e testar que os dois programas concordam'
    ],
    de: [
      'Muttersprachler die 12 ungarischen Prompts und die 10 Übersetzungs-Prompts (RO→EN, EN→RO) prüfen lassen: Formulierungen, Referenznotizen und Auswahl der Redewendungen',
      'Die Fakten der 22 Kultur-Prompts an ihren Quellen erneut prüfen, jedem eine zweite Quelle hinzufügen und Fakten markieren, die sich mit der Zeit ändern können',
      '20 rumänische Prompts für die Kategorie `law` ergänzen (Verfassungsgrundlagen, Verbraucherrechte, Verträge), mit Referenznotizen und amtlichen Quellen',
      '20 rumänische Prompts für die Kategorie `science` ergänzen (Physik, Chemie, Biologie, Mathematik), mit geprüften Referenzantworten',
      '`creative`-Prompts ergänzen (kurzer Text, Reim, Stilebene), deren Referenznotizen klare Bewertungskriterien nennen und die nicht verlangen, geschützte Werke wiederzugeben',
      '`code`-Prompts ergänzen (kurze Python- und JavaScript-Aufgaben mit rumänischen Kommentaren), deren Referenznotizen einen Test enthalten, der die Antwort prüft',
      'Prompt-Sätze auf Französisch, Deutsch, Italienisch, Spanisch oder Portugiesisch für passende Kategorien ergänzen (Oberfläche und Schema akzeptieren diese Sprachen bereits)',
      '`scripts/agreement.py` schreiben: Wenn zwei Personen über dieselben Paare abstimmen, ihre Übereinstimmung (Cohens Kappa) und die abweichenden Paare ausgeben, mit Tests an einem kleinen Beispiel',
      'Ein Hilfsskript schreiben, das die Ausgabe eines lokalen Modell-Runners in `answers.jsonl` umwandelt (keine API-Schlüssel im Repository, keine Netzwerkaufrufe aus der Seite)',
      'In `src/engine.mjs` und `scripts/rank.py` einen Bootstrap über Prompts (nicht nur über Stimmen) ergänzen, beide Intervalle in den Ergebnissen zeigen und testen, dass beide Programme übereinstimmen'
    ],
    hu: [
      'Anyanyelvi beszélőkkel átnézetni a 12 magyar promptot és a 10 fordítási promptot (RO→EN, EN→RO): megfogalmazás, referenciajegyzetek és a szólások kiválasztása',
      'A 22 kultúra-prompt tényeinek újraellenőrzése a forrásaikban, mindegyikhez egy második forrás hozzáadása, és az idővel változó tények megjelölése',
      '20 román prompt hozzáadása a `law` kategóriához (alkotmányos alapfogalmak, fogyasztói jogok, szerződések), referenciajegyzetekkel és hivatalos forrásokkal',
      '20 román prompt hozzáadása a `science` kategóriához (fizika, kémia, biológia, matematika), ellenőrzött referenciaválaszokkal',
      '`creative` promptok hozzáadása (rövid szöveg, rím, stílusréteg), amelyek referenciajegyzetei egyértelmű értékelési szempontokat adnak, és nem kérik védett művek reprodukálását',
      '`code` promptok hozzáadása (rövid Python- és JavaScript-feladatok román megjegyzésekkel), amelyek referenciajegyzetei tartalmaznak a választ ellenőrző tesztet',
      'Francia, német, olasz, spanyol vagy portugál promptkészletek hozzáadása a megfelelő kategóriákhoz (a felület és a séma már elfogadja ezeket a nyelveket)',
      'A `scripts/agreement.py` megírása: ha ketten ugyanazokra a párokra szavaznak, jelentse az egyezésüket (Cohen-kappa) és azokat a párokat, ahol eltérnek, tesztekkel egy kis példán',
      'Segédszkript írása, amely egy helyi modellfuttató kimenetét `answers.jsonl` fájllá alakítja (nincs API-kulcs a tárolóban, nincs hálózati hívás az oldalról)',
      'A `src/engine.mjs` és a `scripts/rank.py` kiegészítése promptok feletti bootstrappel (nemcsak a szavazatok felettivel), mindkét intervallum megjelenítése az eredményekben, és annak tesztelése, hogy a két program egyezik'
    ]
  };

  const added = {
    en: [
      'The engine in `src/engine.mjs`: votes as JSON Lines (`votes.jsonl`, versioned, with a named error code for every faulty line), Elo, Bradley–Terry with bootstrap intervals, head to head, position bias, pairing from a seed, anonymisation, prompt checks, Markdown and static HTML exports.',
      '`scripts/rank.py`: the same ranking in Python without libraries; the tests check that it agrees with the JavaScript engine to 1e-6.',
      '92 prompts in `data/prompts/`: Romanian grammar (30), culture and history with sources (20), reasoning (20), translation RO→EN and EN→RO (10) and a Hungarian set (12), all with reference notes; `schema.json` now rejects unknown fields and accepts `sources`.',
      'Interface in `src/ui.js`, `src/i18n.mjs` and `src/app.css`: setup, answers, blind voting, results and your own prompts; eight languages, dark and light themes, keyboard, works from 360 px wide; data stays in the browser.',
      '`docs/votes.md` and `docs/votes.ro.md`: the vote format, the algorithms and the prompt-quality checklist (also in `CONTRIBUTING.md`).',
      'Tests: `npm test` (the engine, the data files and the interface texts) and browser tests in the hub (eight languages, accessibility, hostile stored state, import and export, small screens).',
      '`src/` and `scripts/build.mjs`: the single `index.html` is now built from sources, and `--check` verifies it.'
    ],
    ro: [
      'Motorul din `src/engine.mjs`: voturi în JSON Lines (`votes.jsonl`, cu versiune și un cod de eroare numit pentru fiecare rând greșit), Elo, Bradley–Terry cu intervale bootstrap, față în față, influența poziției, perechi dintr-o sămânță, anonimizare, verificarea prompturilor, exporturi Markdown și HTML static.',
      '`scripts/rank.py`: același clasament în Python, fără biblioteci; testele verifică dacă e de acord cu motorul JavaScript la 1e-6.',
      '92 de prompturi în `data/prompts/`: gramatică românească (30), cultură și istorie cu surse (20), raționament (20), traducere RO→EN și EN→RO (10) și un set în maghiară (12), toate cu note de referință; `schema.json` respinge acum câmpurile necunoscute și acceptă `sources`.',
      'Interfață în `src/ui.js`, `src/i18n.mjs` și `src/app.css`: pregătire, răspunsuri, vot orb, rezultate și prompturi proprii; opt limbi, teme întunecată și luminoasă, tastatură, funcționează de la 360 px lățime; datele rămân în browser.',
      '`docs/votes.md` și `docs/votes.ro.md`: formatul voturilor, algoritmii și lista de verificare a calității prompturilor (și în `CONTRIBUTING.md`).',
      'Teste: `npm test` (motorul, fișierele de date și textele interfeței) și teste de browser în hub (opt limbi, accesibilitate, stare stocată ostilă, import și export, ecrane mici).',
      '`src/` și `scripts/build.mjs`: singurul `index.html` este acum construit din surse, iar `--check` îl verifică.'
    ],
    fr: [
      'Le moteur de `src/engine.mjs` : votes en JSON Lines (`votes.jsonl`, versionné, avec un code d’erreur nommé pour chaque ligne fautive), Elo, Bradley–Terry avec intervalles bootstrap, face à face, influence de la position, appariement à partir d’une graine, anonymisation, vérification des prompts, exports Markdown et HTML statique.',
      '`scripts/rank.py` : le même classement en Python sans bibliothèque ; les tests vérifient qu’il concorde avec le moteur JavaScript à 1e-6.',
      '92 prompts dans `data/prompts/` : grammaire roumaine (30), culture et histoire avec sources (20), raisonnement (20), traduction RO→EN et EN→RO (10) et un jeu en hongrois (12), tous avec notes de référence ; `schema.json` rejette désormais les champs inconnus et accepte `sources`.',
      'Interface dans `src/ui.js`, `src/i18n.mjs` et `src/app.css` : préparation, réponses, vote à l’aveugle, résultats et vos propres prompts ; huit langues, thèmes sombre et clair, clavier, utilisable dès 360 px de large ; les données restent dans le navigateur.',
      '`docs/votes.md` et `docs/votes.ro.md` : le format des votes, les algorithmes et la liste de contrôle de qualité des prompts (aussi dans `CONTRIBUTING.md`).',
      'Tests : `npm test` (le moteur, les fichiers de données et les textes de l’interface) et tests de navigateur dans le hub (huit langues, accessibilité, état stocké hostile, import et export, petits écrans).',
      '`src/` et `scripts/build.mjs` : l’unique `index.html` est désormais construit à partir des sources, et `--check` le vérifie.'
    ],
    it: [
      'Il motore in `src/engine.mjs`: voti in JSON Lines (`votes.jsonl`, con versione e un codice di errore nominato per ogni riga errata), Elo, Bradley–Terry con intervalli bootstrap, testa a testa, influenza della posizione, accoppiamenti da un seme, anonimizzazione, controllo dei prompt, esportazioni Markdown e HTML statico.',
      '`scripts/rank.py`: la stessa classifica in Python senza librerie; i test verificano che concordi con il motore JavaScript a 1e-6.',
      '92 prompt in `data/prompts/`: grammatica rumena (30), cultura e storia con fonti (20), ragionamento (20), traduzione RO→EN ed EN→RO (10) e un set in ungherese (12), tutti con note di riferimento; `schema.json` ora rifiuta i campi sconosciuti e accetta `sources`.',
      'Interfaccia in `src/ui.js`, `src/i18n.mjs` e `src/app.css`: preparazione, risposte, voto alla cieca, risultati e prompt personali; otto lingue, temi scuro e chiaro, tastiera, funziona da 360 px di larghezza; i dati restano nel browser.',
      '`docs/votes.md` e `docs/votes.ro.md`: il formato dei voti, gli algoritmi e la lista di controllo della qualità dei prompt (anche in `CONTRIBUTING.md`).',
      'Test: `npm test` (il motore, i file di dati e i testi dell’interfaccia) e test del browser nell’hub (otto lingue, accessibilità, stato memorizzato ostile, importazione ed esportazione, schermi piccoli).',
      '`src/` e `scripts/build.mjs`: l’unico `index.html` è ora costruito dai sorgenti e `--check` lo verifica.'
    ],
    es: [
      'El motor en `src/engine.mjs`: votos en JSON Lines (`votes.jsonl`, con versión y un código de error con nombre para cada línea errónea), Elo, Bradley–Terry con intervalos bootstrap, cara a cara, influencia de la posición, emparejamientos a partir de una semilla, anonimización, comprobación de prompts, exportaciones Markdown y HTML estático.',
      '`scripts/rank.py`: la misma clasificación en Python sin bibliotecas; las pruebas comprueban que coincide con el motor JavaScript a 1e-6.',
      '92 prompts en `data/prompts/`: gramática rumana (30), cultura e historia con fuentes (20), razonamiento (20), traducción RO→EN y EN→RO (10) y un conjunto en húngaro (12), todos con notas de referencia; `schema.json` rechaza ahora los campos desconocidos y acepta `sources`.',
      'Interfaz en `src/ui.js`, `src/i18n.mjs` y `src/app.css`: preparación, respuestas, voto a ciegas, resultados y tus propios prompts; ocho idiomas, temas oscuro y claro, teclado, funciona desde 360 px de ancho; los datos se quedan en el navegador.',
      '`docs/votes.md` y `docs/votes.ro.md`: el formato de los votos, los algoritmos y la lista de control de calidad de los prompts (también en `CONTRIBUTING.md`).',
      'Pruebas: `npm test` (el motor, los archivos de datos y los textos de la interfaz) y pruebas de navegador en el hub (ocho idiomas, accesibilidad, estado guardado hostil, importación y exportación, pantallas pequeñas).',
      '`src/` y `scripts/build.mjs`: el único `index.html` se construye ahora a partir de las fuentes, y `--check` lo verifica.'
    ],
    pt: [
      'O motor em `src/engine.mjs`: votos em JSON Lines (`votes.jsonl`, com versão e um código de erro com nome para cada linha errada), Elo, Bradley–Terry com intervalos bootstrap, frente a frente, influência da posição, emparelhamentos a partir de uma semente, anonimização, verificação dos prompts, exportações Markdown e HTML estático.',
      '`scripts/rank.py`: a mesma classificação em Python sem bibliotecas; os testes verificam que concorda com o motor JavaScript a 1e-6.',
      '92 prompts em `data/prompts/`: gramática romena (30), cultura e história com fontes (20), raciocínio (20), tradução RO→EN e EN→RO (10) e um conjunto em húngaro (12), todos com notas de referência; `schema.json` rejeita agora os campos desconhecidos e aceita `sources`.',
      'Interface em `src/ui.js`, `src/i18n.mjs` e `src/app.css`: preparação, respostas, votação às cegas, resultados e os seus próprios prompts; oito idiomas, temas escuro e claro, teclado, funciona desde 360 px de largura; os dados ficam no navegador.',
      '`docs/votes.md` e `docs/votes.ro.md`: o formato dos votos, os algoritmos e a lista de verificação da qualidade dos prompts (também em `CONTRIBUTING.md`).',
      'Testes: `npm test` (o motor, os ficheiros de dados e os textos da interface) e testes de navegador no hub (oito idiomas, acessibilidade, estado guardado hostil, importação e exportação, ecrãs pequenos).',
      '`src/` e `scripts/build.mjs`: o único `index.html` é agora construído a partir das fontes, e `--check` verifica-o.'
    ],
    de: [
      'Der Motor in `src/engine.mjs`: Stimmen als JSON Lines (`votes.jsonl`, versioniert, mit benanntem Fehlercode für jede fehlerhafte Zeile), Elo, Bradley–Terry mit Bootstrap-Intervallen, Direktvergleich, Positionseinfluss, Paarbildung aus einem Seed, Anonymisierung, Prompt-Prüfung, Markdown- und statische HTML-Exporte.',
      '`scripts/rank.py`: dieselbe Rangliste in Python ohne Bibliotheken; die Tests prüfen, dass sie mit dem JavaScript-Motor auf 1e-6 übereinstimmt.',
      '92 Prompts in `data/prompts/`: rumänische Grammatik (30), Kultur und Geschichte mit Quellen (20), logisches Denken (20), Übersetzung RO→EN und EN→RO (10) und ein ungarischer Satz (12), alle mit Referenznotizen; `schema.json` lehnt jetzt unbekannte Felder ab und akzeptiert `sources`.',
      'Oberfläche in `src/ui.js`, `src/i18n.mjs` und `src/app.css`: Vorbereitung, Antworten, blindes Abstimmen, Ergebnisse und eigene Prompts; acht Sprachen, dunkles und helles Design, Tastatur, nutzbar ab 360 px Breite; die Daten bleiben im Browser.',
      '`docs/votes.md` und `docs/votes.ro.md`: das Stimmenformat, die Algorithmen und die Qualitäts-Checkliste für Prompts (auch in `CONTRIBUTING.md`).',
      'Tests: `npm test` (der Motor, die Datendateien und die Oberflächentexte) und Browsertests im Hub (acht Sprachen, Barrierefreiheit, feindlicher gespeicherter Zustand, Import und Export, kleine Bildschirme).',
      '`src/` und `scripts/build.mjs`: Die eine `index.html` wird jetzt aus Quellen gebaut, `--check` prüft sie.'
    ],
    hu: [
      'A motor a `src/engine.mjs` fájlban: szavazatok JSON Lines formátumban (`votes.jsonl`, verziózva, minden hibás sorhoz névvel ellátott hibakóddal), Elo, Bradley–Terry bootstrap-intervallumokkal, egymás elleni mérleg, a pozíció hatása, párosítás egy magból, anonimizálás, promptellenőrzés, Markdown- és statikus HTML-exportok.',
      '`scripts/rank.py`: ugyanaz a rangsor Pythonban, könyvtárak nélkül; a tesztek ellenőrzik, hogy 1e-6 pontossággal egyezik a JavaScript-motorral.',
      '92 prompt a `data/prompts/` mappában: román nyelvtan (30), kultúra és történelem forrásokkal (20), gondolkodás (20), RO→EN és EN→RO fordítás (10) és egy magyar készlet (12), mind referenciajegyzettel; a `schema.json` mostantól elutasítja az ismeretlen mezőket, és elfogadja a `sources` mezőt.',
      'Felület a `src/ui.js`, `src/i18n.mjs` és `src/app.css` fájlokban: előkészítés, válaszok, vak szavazás, eredmények és saját promptok; nyolc nyelv, sötét és világos téma, billentyűzet, 360 px szélességtől működik; az adatok a böngészőben maradnak.',
      '`docs/votes.md` és `docs/votes.ro.md`: a szavazatok formátuma, az algoritmusok és a promptok minőségi ellenőrzőlistája (a `CONTRIBUTING.md` fájlban is).',
      'Tesztek: `npm test` (a motor, az adatfájlok és a felületi szövegek) és böngészőtesztek a hubban (nyolc nyelv, akadálymentesség, ellenséges tárolt állapot, import és export, kis képernyők).',
      'A `src/` és a `scripts/build.mjs`: az egyetlen `index.html` mostantól forrásokból épül, és a `--check` ellenőrzi.'
    ]
  };
  for (const l of L) added[l] = [...added[l], ...legacy[l]];

  const changed = {
    en: ['The workflow runs on Ubuntu 26.04 with Node.js 26 and also runs the tests, the build check and the data validation.', '`data/prompts/example.json` is now a template with the reserved id `ro-culture-0000`; it is not part of the bundled set.'],
    ro: ['Fluxul de lucru rulează pe Ubuntu 26.04 cu Node.js 26 și rulează și testele, verificarea construcției și validarea datelor.', '`data/prompts/example.json` este acum un șablon cu id-ul rezervat `ro-culture-0000`; nu face parte din setul inclus.'],
    fr: ['Le workflow s’exécute sur Ubuntu 26.04 avec Node.js 26 et lance aussi les tests, la vérification de la construction et la validation des données.', '`data/prompts/example.json` est désormais un modèle avec l’id réservé `ro-culture-0000` ; il ne fait pas partie du jeu fourni.'],
    it: ['Il workflow gira su Ubuntu 26.04 con Node.js 26 ed esegue anche i test, il controllo della build e la convalida dei dati.', '`data/prompts/example.json` è ora un modello con l’id riservato `ro-culture-0000`; non fa parte del set incluso.'],
    es: ['El workflow se ejecuta en Ubuntu 26.04 con Node.js 26 y ejecuta también las pruebas, la comprobación de la compilación y la validación de los datos.', '`data/prompts/example.json` es ahora una plantilla con el id reservado `ro-culture-0000`; no forma parte del conjunto incluido.'],
    pt: ['O workflow corre em Ubuntu 26.04 com Node.js 26 e executa também os testes, a verificação da compilação e a validação dos dados.', '`data/prompts/example.json` é agora um modelo com o id reservado `ro-culture-0000`; não faz parte do conjunto incluído.'],
    de: ['Der Workflow läuft auf Ubuntu 26.04 mit Node.js 26 und führt auch die Tests, die Build-Prüfung und die Datenvalidierung aus.', '`data/prompts/example.json` ist jetzt eine Vorlage mit der reservierten id `ro-culture-0000`; sie gehört nicht zum mitgelieferten Satz.'],
    hu: ['A munkafolyamat Ubuntu 26.04 és Node.js 26 alatt fut, és a teszteket, a build-ellenőrzést meg az adatok ellenőrzését is futtatja.', 'A `data/prompts/example.json` mostantól sablon a fenntartott `ro-culture-0000` azonosítóval; nem része a mellékelt készletnek.']
  };

  return {
    slug: 'balanta', version: '0.2.0', updated: '2026-11-17',
    headings: {
      does: {en: 'What it does', ro: 'Ce face', fr: 'Ce que fait l’application', it: 'Cosa fa', es: 'Qué hace', pt: 'O que faz', de: 'Was es kann', hu: 'Mit tud'},
      how: {en: 'How it works', ro: 'Cum funcționează', fr: 'Comment ça marche', it: 'Come funziona', es: 'Cómo funciona', pt: 'Como funciona', de: 'Wie es funktioniert', hu: 'Hogyan működik'},
      limits: limHeading
    },
    status, does, how, limits, extraSteps, contrib, issues,
    changelog: {added, changed}
  };
}
