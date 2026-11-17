// Specificația documentației ATELIER DE VERIFICARE (opt limbi). Folosită de tools/alpha/docs.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default async function (root) {
  const I18N = (await import(pathToFileURL(path.join(root, 'atelier-verificare', 'src', 'i18n.mjs')).href)).default;
  const legacy = JSON.parse(fs.readFileSync(path.join(HERE, 'atelier-verificare.legacy.json'), 'utf8'));
  const limits = {}, limHeading = {};
  for (const l of Object.keys(I18N)) { limits[l] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => I18N[l]['lim_' + i]); limHeading[l] = I18N[l].h_limits; }

  const status = {
    en: 'Alpha, usable: eleven checks (nine offline, two on request over the network) work in the single `index.html` (open it offline, no server). A check is a descriptor in `data/checks/` plus a plugin in `checks/`; what these checks cannot prove is listed below.',
    ro: 'Alfa, utilizabil: unsprezece verificări (nouă offline, două la cerere prin rețea) funcționează în singurul fișier `index.html` (îl deschizi offline, fără server). O verificare înseamnă un descriptor în `data/checks/` plus un plugin în `checks/`; ce nu pot dovedi aceste verificări este enumerat mai jos.',
    fr: 'Alpha, utilisable : onze vérifications (neuf hors ligne, deux à la demande via le réseau) fonctionnent dans l’unique fichier `index.html` (à ouvrir hors ligne, sans serveur). Une vérification est un descripteur dans `data/checks/` plus un plugin dans `checks/` ; ce que ces vérifications ne peuvent pas prouver est indiqué plus bas.',
    it: 'Alpha, utilizzabile: undici verifiche (nove offline, due su richiesta via rete) funzionano nell’unico file `index.html` (si apre offline, senza server). Una verifica è un descrittore in `data/checks/` più un plugin in `checks/`; ciò che queste verifiche non possono provare è elencato più sotto.',
    es: 'Alfa, utilizable: once comprobaciones (nueve sin conexión, dos a petición por la red) funcionan en el único archivo `index.html` (se abre sin conexión, sin servidor). Una comprobación es un descriptor en `data/checks/` más un plugin en `checks/`; lo que estas comprobaciones no pueden demostrar se enumera más abajo.',
    pt: 'Alfa, utilizável: onze verificações (nove offline, duas a pedido pela rede) funcionam no único ficheiro `index.html` (abre-se offline, sem servidor). Uma verificação é um descritor em `data/checks/` mais um plugin em `checks/`; o que estas verificações não podem provar está listado abaixo.',
    de: 'Alpha, nutzbar: elf Prüfungen (neun offline, zwei auf Anfrage über das Netz) laufen in der einen Datei `index.html` (offline öffnen, ohne Server). Eine Prüfung ist ein Descriptor in `data/checks/` plus ein Plugin in `checks/`; was diese Prüfungen nicht beweisen können, steht weiter unten.',
    hu: 'Alfa, használható: tizenegy ellenőrzés (kilenc offline, kettő kérésre a hálózaton át) működik az egyetlen `index.html` fájlban (offline nyitható, szerver nélkül). Egy ellenőrzés egy leíró a `data/checks/` mappában plusz egy bővítmény a `checks/` mappában; amit ezek az ellenőrzések nem bizonyíthatnak, az lent olvasható.'
  };

  const does = {
    en: [
      'Add images, videos, links, domains or pasted text (drag and drop, file picker, paste) and run the checks on each item; nothing is uploaded.',
      'File structure: the real type from the content, mismatch with the extension, dimensions, data appended after the end of the file, JPEG quality estimate, truncation, and a SHA-256 so you can later show that the copy you analysed is the one you received.',
      'EXIF inspector: camera, lens, software (and whether it names an image editor), dates and time zone, a modification later than the capture, GPS position, embedded thumbnail and size mismatches, serial numbers.',
      'Other embedded metadata: XMP (tool, edit history, declared AI source), IPTC press fields, JPEG comments, and PNG text fields that match the output of AI image generators.',
      'Content Credentials (C2PA): reads the manifests (who signed, with what, which actions, AI declarations) in JPEG, PNG, WebP, MP4, MOV, HEIC and AVIF; it reads them but does not validate signatures.',
      'Error-level analysis for JPEG, with a map you can save as PNG; video metadata (container, dates, stored location, re-encoding signatures); keyframes extracted locally for reverse-image search.',
      'Link anatomy (the `@` trick, look-alike letters, IP addresses, shorteners, tracking parameters) and text hygiene (invisible characters, text-direction controls, look-alike letters), without opening anything.',
      'Two optional network checks, only after you tick a consent box and press their button: a DNS summary from two public resolvers (sends the domain name to `cloudflare-dns.com` and `dns.google`) and an Internet Archive lookup (sends the address to `archive.org`). The links to save or view archived copies are plain links you open yourself.',
      'A report for the whole case as Markdown, JSON or print/PDF, in the interface language, with the date, each file’s SHA-256, every finding and the limits of the method.',
      'Interface in eight languages, dark and light themes, keyboard and screen-reader support, mobile layout; no tracking, no accounts.'
    ],
    ro: [
      'Adaugi imagini, videoclipuri, linkuri, domenii sau text lipit (tragere și plasare, selector de fișiere, lipire) și rulezi verificările pe fiecare element; nu se încarcă nimic.',
      'Structura fișierului: tipul real din conținut, nepotrivirea cu extensia, dimensiuni, date adăugate după sfârșitul fișierului, calitatea JPEG estimată, trunchierea și un SHA-256 cu care poți dovedi mai târziu că exemplarul analizat este cel primit.',
      'Inspector EXIF: aparatul, obiectivul, programul (și dacă numește un editor de imagini), datele și fusul orar, o modificare ulterioară capturii, poziția GPS, miniatura încorporată și nepotrivirile de dimensiuni, numerele de serie.',
      'Alte metadate încorporate: XMP (instrument, istoricul modificărilor, sursa IA declarată), câmpuri de presă IPTC, comentarii JPEG și câmpuri text PNG care corespund ieșirii generatoarelor de imagini IA.',
      'Content Credentials (C2PA): citește manifestele (cine a semnat, cu ce, ce acțiuni, declarații despre IA) din JPEG, PNG, WebP, MP4, MOV, HEIC și AVIF; le citește, dar nu validează semnăturile.',
      'Analiza nivelului de eroare pentru JPEG, cu o hartă pe care o poți salva ca PNG; metadatele video (container, date, locație memorată, semnături de recodificare); cadre-cheie extrase local pentru căutare inversă de imagini.',
      'Anatomia linkurilor (trucul cu `@`, litere asemănătoare, adrese IP, scurtatoare, parametri de urmărire) și igiena textului (caractere invizibile, controale de direcție a textului, litere asemănătoare), fără a deschide nimic.',
      'Două verificări opționale prin rețea, doar după ce bifezi o casetă de consimțământ și apeși butonul lor: un rezumat DNS de la două rezolvatoare publice (trimite numele de domeniu către `cloudflare-dns.com` și `dns.google`) și o căutare în Internet Archive (trimite adresa către `archive.org`). Linkurile pentru a salva sau a vedea copii arhivate sunt linkuri obișnuite pe care le deschizi tu.',
      'Un raport pentru întregul dosar în Markdown, JSON sau tipărire/PDF, în limba interfeței, cu data, SHA-256 al fiecărui fișier, fiecare constatare și limitele metodei.',
      'Interfață în opt limbi, teme întunecată și luminoasă, suport pentru tastatură și cititoare de ecran, aspect pentru mobil; fără urmărire, fără conturi.'
    ],
    fr: [
      'Ajoutez des images, des vidéos, des liens, des domaines ou du texte collé (glisser-déposer, sélecteur de fichiers, collage) et lancez les vérifications sur chaque élément ; rien n’est envoyé.',
      'Structure du fichier : le type réel d’après le contenu, l’écart avec l’extension, les dimensions, les données ajoutées après la fin du fichier, la qualité JPEG estimée, la troncature, et un SHA-256 pour montrer plus tard que l’exemplaire analysé est celui que vous avez reçu.',
      'Inspecteur EXIF : appareil, objectif, logiciel (et s’il nomme un éditeur d’images), dates et fuseau horaire, une modification postérieure à la prise de vue, position GPS, vignette intégrée et écarts de dimensions, numéros de série.',
      'Autres métadonnées intégrées : XMP (outil, historique des modifications, source IA déclarée), champs de presse IPTC, commentaires JPEG et champs de texte PNG correspondant à la sortie de générateurs d’images IA.',
      'Content Credentials (C2PA) : lit les manifestes (qui a signé, avec quoi, quelles actions, déclarations sur l’IA) dans les JPEG, PNG, WebP, MP4, MOV, HEIC et AVIF ; il les lit mais ne valide pas les signatures.',
      'Analyse du niveau d’erreur pour JPEG, avec une carte enregistrable en PNG ; métadonnées vidéo (conteneur, dates, position stockée, signatures de réencodage) ; images clés extraites localement pour la recherche d’images inversée.',
      'Anatomie des liens (l’astuce du `@`, lettres semblables, adresses IP, raccourcisseurs, paramètres de suivi) et hygiène du texte (caractères invisibles, contrôles de direction du texte, lettres semblables), sans rien ouvrir.',
      'Deux vérifications facultatives par le réseau, seulement après avoir coché une case de consentement et appuyé sur leur bouton : un résumé DNS de deux résolveurs publics (envoie le nom de domaine à `cloudflare-dns.com` et `dns.google`) et une recherche dans Internet Archive (envoie l’adresse à `archive.org`). Les liens pour enregistrer ou voir des copies archivées sont de simples liens que vous ouvrez vous-même.',
      'Un rapport pour tout le dossier en Markdown, JSON ou impression/PDF, dans la langue de l’interface, avec la date, le SHA-256 de chaque fichier, chaque constat et les limites de la méthode.',
      'Interface en huit langues, thèmes sombre et clair, prise en charge du clavier et des lecteurs d’écran, mise en page mobile ; sans suivi, sans comptes.'
    ],
    it: [
      'Aggiungi immagini, video, link, domini o testo incollato (trascinamento, selettore di file, incolla) ed esegui le verifiche su ogni elemento; non viene caricato nulla.',
      'Struttura del file: il tipo reale dal contenuto, il disaccordo con l’estensione, le dimensioni, i dati aggiunti dopo la fine del file, la qualità JPEG stimata, il troncamento e uno SHA-256 per poter dimostrare in seguito che la copia analizzata è quella ricevuta.',
      'Ispettore EXIF: fotocamera, obiettivo, software (e se nomina un editor di immagini), date e fuso orario, una modifica successiva allo scatto, posizione GPS, miniatura incorporata e incongruenze di dimensione, numeri di serie.',
      'Altri metadati incorporati: XMP (strumento, cronologia delle modifiche, fonte IA dichiarata), campi stampa IPTC, commenti JPEG e campi di testo PNG che corrispondono all’output dei generatori di immagini IA.',
      'Content Credentials (C2PA): legge i manifesti (chi ha firmato, con cosa, quali azioni, dichiarazioni sull’IA) in JPEG, PNG, WebP, MP4, MOV, HEIC e AVIF; li legge ma non convalida le firme.',
      'Analisi del livello di errore per JPEG, con una mappa salvabile come PNG; metadati video (contenitore, date, posizione memorizzata, firme di ricodifica); fotogrammi chiave estratti in locale per la ricerca inversa di immagini.',
      'Anatomia dei link (il trucco della `@`, lettere simili, indirizzi IP, accorciatori, parametri di tracciamento) e igiene del testo (caratteri invisibili, controlli di direzione del testo, lettere simili), senza aprire nulla.',
      'Due verifiche facoltative via rete, solo dopo aver spuntato una casella di consenso e premuto il loro pulsante: un riepilogo DNS da due risolutori pubblici (invia il nome di dominio a `cloudflare-dns.com` e `dns.google`) e una ricerca su Internet Archive (invia l’indirizzo a `archive.org`). I link per salvare o vedere copie archiviate sono semplici link che apri tu.',
      'Un rapporto per l’intero caso in Markdown, JSON o stampa/PDF, nella lingua dell’interfaccia, con la data, lo SHA-256 di ogni file, ogni constatazione e i limiti del metodo.',
      'Interfaccia in otto lingue, temi scuro e chiaro, supporto per tastiera e lettori di schermo, layout mobile; senza tracciamento, senza account.'
    ],
    es: [
      'Añade imágenes, vídeos, enlaces, dominios o texto pegado (arrastrar y soltar, selector de archivos, pegar) y ejecuta las comprobaciones sobre cada elemento; no se sube nada.',
      'Estructura del archivo: el tipo real según el contenido, la discrepancia con la extensión, las dimensiones, los datos añadidos tras el final del archivo, la calidad JPEG estimada, el truncamiento y un SHA-256 para demostrar después que la copia analizada es la recibida.',
      'Inspector EXIF: cámara, objetivo, software (y si nombra un editor de imágenes), fechas y zona horaria, una modificación posterior a la captura, posición GPS, miniatura incrustada e incoherencias de tamaño, números de serie.',
      'Otros metadatos incrustados: XMP (herramienta, historial de ediciones, fuente de IA declarada), campos de prensa IPTC, comentarios JPEG y campos de texto PNG que coinciden con la salida de generadores de imágenes con IA.',
      'Content Credentials (C2PA): lee los manifiestos (quién firmó, con qué, qué acciones, declaraciones sobre IA) en JPEG, PNG, WebP, MP4, MOV, HEIC y AVIF; los lee, pero no valida las firmas.',
      'Análisis del nivel de error para JPEG, con un mapa que puedes guardar como PNG; metadatos de vídeo (contenedor, fechas, ubicación guardada, firmas de recodificación); fotogramas clave extraídos en local para la búsqueda inversa de imágenes.',
      'Anatomía de los enlaces (el truco de la `@`, letras parecidas, direcciones IP, acortadores, parámetros de seguimiento) e higiene del texto (caracteres invisibles, controles de dirección del texto, letras parecidas), sin abrir nada.',
      'Dos comprobaciones opcionales por la red, solo después de marcar una casilla de consentimiento y pulsar su botón: un resumen DNS de dos resolvedores públicos (envía el nombre de dominio a `cloudflare-dns.com` y `dns.google`) y una consulta a Internet Archive (envía la dirección a `archive.org`). Los enlaces para guardar o ver copias archivadas son enlaces normales que abres tú.',
      'Un informe de todo el caso en Markdown, JSON o impresión/PDF, en el idioma de la interfaz, con la fecha, el SHA-256 de cada archivo, cada hallazgo y los límites del método.',
      'Interfaz en ocho idiomas, temas oscuro y claro, compatibilidad con teclado y lectores de pantalla, diseño móvil; sin rastreo, sin cuentas.'
    ],
    pt: [
      'Acrescente imagens, vídeos, ligações, domínios ou texto colado (arrastar e largar, seletor de ficheiros, colar) e execute as verificações em cada elemento; nada é enviado.',
      'Estrutura do ficheiro: o tipo real pelo conteúdo, a discordância com a extensão, as dimensões, os dados acrescentados após o fim do ficheiro, a qualidade JPEG estimada, a truncagem e um SHA-256 para poder demonstrar mais tarde que a cópia analisada é a que recebeu.',
      'Inspetor EXIF: câmara, objetiva, software (e se nomeia um editor de imagens), datas e fuso horário, uma modificação posterior à captura, posição GPS, miniatura incorporada e incoerências de tamanho, números de série.',
      'Outros metadados incorporados: XMP (ferramenta, histórico de edições, fonte de IA declarada), campos de imprensa IPTC, comentários JPEG e campos de texto PNG que correspondem ao resultado de geradores de imagens com IA.',
      'Content Credentials (C2PA): lê os manifestos (quem assinou, com quê, que ações, declarações sobre IA) em JPEG, PNG, WebP, MP4, MOV, HEIC e AVIF; lê-os, mas não valida as assinaturas.',
      'Análise do nível de erro para JPEG, com um mapa que pode guardar como PNG; metadados de vídeo (contentor, datas, localização guardada, assinaturas de recodificação); fotogramas-chave extraídos localmente para a pesquisa inversa de imagens.',
      'Anatomia das ligações (o truque do `@`, letras parecidas, endereços IP, encurtadores, parâmetros de rastreio) e higiene do texto (caracteres invisíveis, controlos de direção do texto, letras parecidas), sem abrir nada.',
      'Duas verificações opcionais pela rede, só depois de assinalar uma caixa de consentimento e premir o respetivo botão: um resumo DNS de dois resolvedores públicos (envia o nome de domínio para `cloudflare-dns.com` e `dns.google`) e uma pesquisa no Internet Archive (envia o endereço para `archive.org`). As ligações para guardar ou ver cópias arquivadas são ligações normais que abre você mesmo.',
      'Um relatório de todo o caso em Markdown, JSON ou impressão/PDF, no idioma da interface, com a data, o SHA-256 de cada ficheiro, cada constatação e os limites do método.',
      'Interface em oito idiomas, temas escuro e claro, suporte para teclado e leitores de ecrã, disposição para telemóvel; sem rastreio, sem contas.'
    ],
    de: [
      'Füge Bilder, Videos, Links, Domains oder eingefügten Text hinzu (Ziehen und Ablegen, Dateiauswahl, Einfügen) und führe die Prüfungen für jedes Element aus; es wird nichts hochgeladen.',
      'Dateistruktur: der tatsächliche Typ aus dem Inhalt, Abweichung von der Endung, Abmessungen, nach dem Dateiende angehängte Daten, geschätzte JPEG-Qualität, Abschneiden und ein SHA-256, mit dem du später zeigen kannst, dass die analysierte Kopie die erhaltene ist.',
      'EXIF-Inspektor: Kamera, Objektiv, Software (und ob sie einen Bildeditor nennt), Daten und Zeitzone, eine Änderung nach der Aufnahme, GPS-Position, eingebettetes Vorschaubild und Größenabweichungen, Seriennummern.',
      'Weitere eingebettete Metadaten: XMP (Werkzeug, Bearbeitungsverlauf, angegebene KI-Quelle), IPTC-Pressefelder, JPEG-Kommentare und PNG-Textfelder, die der Ausgabe von KI-Bildgeneratoren entsprechen.',
      'Content Credentials (C2PA): liest die Manifeste (wer signiert hat, womit, welche Aktionen, KI-Angaben) in JPEG, PNG, WebP, MP4, MOV, HEIC und AVIF; sie werden gelesen, Signaturen aber nicht validiert.',
      'Fehlerniveau-Analyse für JPEG mit einer Karte, die du als PNG speichern kannst; Videometadaten (Container, Daten, gespeicherter Ort, Spuren einer Neukodierung); lokal extrahierte Schlüsselbilder für die umgekehrte Bildersuche.',
      'Link-Anatomie (der `@`-Trick, ähnlich aussehende Buchstaben, IP-Adressen, Kurzlinks, Tracking-Parameter) und Texthygiene (unsichtbare Zeichen, Textrichtungssteuerzeichen, ähnlich aussehende Buchstaben), ohne etwas zu öffnen.',
      'Zwei optionale Netzprüfungen, erst nachdem du ein Einwilligungsfeld angekreuzt und ihre Schaltfläche gedrückt hast: eine DNS-Zusammenfassung von zwei öffentlichen Resolvern (sendet den Domainnamen an `cloudflare-dns.com` und `dns.google`) und eine Internet-Archive-Abfrage (sendet die Adresse an `archive.org`). Die Links zum Speichern oder Ansehen archivierter Kopien sind gewöhnliche Links, die du selbst öffnest.',
      'Ein Bericht für den ganzen Fall als Markdown, JSON oder Druck/PDF, in der Sprache der Oberfläche, mit Datum, dem SHA-256 jeder Datei, jedem Befund und den Grenzen der Methode.',
      'Oberfläche in acht Sprachen, dunkles und helles Design, Tastatur- und Screenreader-Unterstützung, mobiles Layout; kein Tracking, keine Konten.'
    ],
    hu: [
      'Képeket, videókat, hivatkozásokat, tartományokat vagy beillesztett szöveget adhatsz hozzá (húzással, fájlválasztóval, beillesztéssel), és minden tételen futtathatod az ellenőrzéseket; semmi sem kerül feltöltésre.',
      'Fájlszerkezet: a valódi típus a tartalom alapján, eltérés a kiterjesztéstől, méretek, a fájl vége után hozzáfűzött adatok, becsült JPEG-minőség, csonkolás és egy SHA-256, amellyel később igazolhatod, hogy az elemzett példány az, amit kaptál.',
      'EXIF-vizsgáló: fényképezőgép, objektív, szoftver (és hogy képszerkesztőt nevez-e meg), dátumok és időzóna, a felvételnél későbbi módosítás, GPS-pozíció, beágyazott előnézet és méreteltérések, sorozatszámok.',
      'Egyéb beágyazott metaadatok: XMP (eszköz, szerkesztési előzmények, bevallott MI-forrás), IPTC sajtómezők, JPEG-megjegyzések és olyan PNG-szövegmezők, amelyek MI-képgenerátorok kimenetével egyeznek.',
      'Content Credentials (C2PA): beolvassa a manifesztumokat (ki írta alá, mivel, milyen műveletek, MI-nyilatkozatok) JPEG, PNG, WebP, MP4, MOV, HEIC és AVIF fájlokból; beolvassa, de az aláírásokat nem érvényesíti.',
      'Hibaszint-elemzés JPEG-hez, PNG-ként menthető térképpel; videó-metaadatok (konténer, dátumok, tárolt hely, újrakódolás nyomai); helyben kinyert kulcskockák a fordított képkereséshez.',
      'Hivatkozások felépítése (a `@`-trükk, hasonló betűk, IP-címek, rövidítők, követőparaméterek) és szöveghigiénia (láthatatlan karakterek, írásirány-vezérlők, hasonló betűk), bármi megnyitása nélkül.',
      'Két választható hálózati ellenőrzés, csak a hozzájárulás bejelölése és a gombjuk megnyomása után: DNS-összefoglaló két nyilvános feloldótól (a tartománynevet küldi a `cloudflare-dns.com` és a `dns.google` felé) és Internet Archive-keresés (a címet küldi az `archive.org` felé). Az archivált másolatok mentésére vagy megtekintésére szolgáló hivatkozások egyszerű hivatkozások, amelyeket te nyitsz meg.',
      'Jelentés az egész ügyről Markdown, JSON vagy nyomtatás/PDF formában, a felület nyelvén, a dátummal, minden fájl SHA-256 értékével, minden megállapítással és a módszer korlátaival.',
      'Felület nyolc nyelven, sötét és világos téma, billentyűzet- és képernyőolvasó-támogatás, mobil elrendezés; követés és fiókok nélkül.'
    ]
  };

  const how = {
    en: [
      '`node scripts/build.mjs` assembles the single `index.html` from `src/`: `src/engine.mjs` (parsers and pure functions), `checks/*.js` (one plugin per check; API in `docs/check-api.md`), `data/checks/*.json` (descriptors validated by `schema.json`), `src/ui.js`, `src/app.css` and `src/i18n.mjs`; `--check` verifies that the page matches the sources.',
      'A check returns coded findings (`{code, level, args}`), never sentences: the interface turns them into the reader’s language, so adding a language or fixing a sentence never touches the parsers.',
      'Files are read in the browser (File API) and never leave the device. Only the case title and notes are kept in the browser’s local storage; the items and results disappear when you reload the page.',
      'The Content-Security-Policy allows network requests only to the hosts the descriptors declare (`archive.org`, `cloudflare-dns.com`, `dns.google`). The interface adds the consent gate, no credentials, no referrer and a 10 s timeout, and a plugin cannot call `fetch` itself.',
      '`npm test` runs the parsers on generated fixtures (JPEG, PNG, WebP, MP4, WebM, C2PA stores), the plugins with a simulated network and canvas, the translations in all eight languages and the descriptor/CSP contract; the hub’s browser tests exercise the whole page. Development needs Node.js 24 or newer; the page itself only needs a browser with ES2017.'
    ],
    ro: [
      '`node scripts/build.mjs` asamblează singurul `index.html` din `src/`: `src/engine.mjs` (parsere și funcții pure), `checks/*.js` (un plugin pentru fiecare verificare; API-ul în `docs/check-api.md`), `data/checks/*.json` (descriptori validați de `schema.json`), `src/ui.js`, `src/app.css` și `src/i18n.mjs`; `--check` verifică dacă pagina corespunde surselor.',
      'O verificare întoarce constatări codificate (`{code, level, args}`), niciodată propoziții: interfața le transformă în limba cititorului, deci adăugarea unei limbi sau corectarea unei propoziții nu atinge parserele.',
      'Fișierele sunt citite în browser (File API) și nu părăsesc dispozitivul. Doar titlul și notele dosarului se păstrează în stocarea locală a browserului; elementele și rezultatele dispar la reîncărcarea paginii.',
      'Content-Security-Policy permite cereri de rețea doar către gazdele pe care le declară descriptorii (`archive.org`, `cloudflare-dns.com`, `dns.google`). Interfața adaugă poarta de consimțământ, fără credențiale, fără referrer și cu un timp limită de 10 s, iar un plugin nu poate apela singur `fetch`.',
      '`npm test` rulează parserele pe fixturi generate (JPEG, PNG, WebP, MP4, WebM, depozite C2PA), plugin-urile cu rețea și canvas simulate, traducerile în toate cele opt limbi și contractul descriptori/CSP; testele de browser din hub exersează întreaga pagină. Dezvoltarea cere Node.js 24 sau mai nou; pagina însăși cere doar un browser cu ES2017.'
    ],
    fr: [
      '`node scripts/build.mjs` assemble l’unique `index.html` à partir de `src/` : `src/engine.mjs` (analyseurs et fonctions pures), `checks/*.js` (un plugin par vérification ; API dans `docs/check-api.md`), `data/checks/*.json` (descripteurs validés par `schema.json`), `src/ui.js`, `src/app.css` et `src/i18n.mjs` ; `--check` vérifie que la page correspond aux sources.',
      'Une vérification renvoie des constats codés (`{code, level, args}`), jamais des phrases : l’interface les traduit dans la langue du lecteur, donc ajouter une langue ou corriger une phrase ne touche jamais aux analyseurs.',
      'Les fichiers sont lus dans le navigateur (File API) et ne quittent jamais l’appareil. Seuls le titre et les notes du dossier sont gardés dans le stockage local du navigateur ; les éléments et les résultats disparaissent au rechargement de la page.',
      'La Content-Security-Policy n’autorise les requêtes réseau que vers les hôtes déclarés par les descripteurs (`archive.org`, `cloudflare-dns.com`, `dns.google`). L’interface ajoute la porte du consentement, aucun identifiant, aucun referrer et un délai de 10 s, et un plugin ne peut pas appeler `fetch` lui-même.',
      '`npm test` exécute les analyseurs sur des fixtures générées (JPEG, PNG, WebP, MP4, WebM, magasins C2PA), les plugins avec un réseau et un canvas simulés, les traductions dans les huit langues et le contrat descripteurs/CSP ; les tests de navigateur du hub exercent toute la page. Le développement demande Node.js 24 ou plus récent ; la page elle-même n’exige qu’un navigateur compatible ES2017.'
    ],
    it: [
      '`node scripts/build.mjs` assembla l’unico `index.html` da `src/`: `src/engine.mjs` (parser e funzioni pure), `checks/*.js` (un plugin per verifica; API in `docs/check-api.md`), `data/checks/*.json` (descrittori validati da `schema.json`), `src/ui.js`, `src/app.css` e `src/i18n.mjs`; `--check` verifica che la pagina corrisponda ai sorgenti.',
      'Una verifica restituisce constatazioni codificate (`{code, level, args}`), mai frasi: l’interfaccia le trasforma nella lingua del lettore, quindi aggiungere una lingua o correggere una frase non tocca mai i parser.',
      'I file vengono letti nel browser (File API) e non lasciano mai il dispositivo. Solo il titolo e le note del caso restano nella memoria locale del browser; gli elementi e i risultati spariscono ricaricando la pagina.',
      'La Content-Security-Policy consente richieste di rete solo verso gli host dichiarati dai descrittori (`archive.org`, `cloudflare-dns.com`, `dns.google`). L’interfaccia aggiunge il passaggio del consenso, nessuna credenziale, nessun referrer e un timeout di 10 s, e un plugin non può chiamare `fetch` da sé.',
      '`npm test` esegue i parser su fixture generate (JPEG, PNG, WebP, MP4, WebM, store C2PA), i plugin con rete e canvas simulati, le traduzioni nelle otto lingue e il contratto descrittori/CSP; i test del browser nell’hub esercitano l’intera pagina. Lo sviluppo richiede Node.js 24 o successivo; la pagina stessa richiede solo un browser con ES2017.'
    ],
    es: [
      '`node scripts/build.mjs` ensambla el único `index.html` a partir de `src/`: `src/engine.mjs` (analizadores y funciones puras), `checks/*.js` (un plugin por comprobación; API en `docs/check-api.md`), `data/checks/*.json` (descriptores validados por `schema.json`), `src/ui.js`, `src/app.css` y `src/i18n.mjs`; `--check` verifica que la página coincida con las fuentes.',
      'Una comprobación devuelve hallazgos codificados (`{code, level, args}`), nunca frases: la interfaz los convierte al idioma del lector, así que añadir un idioma o corregir una frase no toca nunca los analizadores.',
      'Los archivos se leen en el navegador (File API) y no salen nunca del dispositivo. Solo el título y las notas del caso se guardan en el almacenamiento local del navegador; los elementos y los resultados desaparecen al recargar la página.',
      'La Content-Security-Policy solo permite peticiones de red a los hosts que declaran los descriptores (`archive.org`, `cloudflare-dns.com`, `dns.google`). La interfaz añade la puerta del consentimiento, sin credenciales, sin referrer y con un tiempo límite de 10 s, y un plugin no puede llamar a `fetch` por sí mismo.',
      '`npm test` ejecuta los analizadores sobre fixtures generados (JPEG, PNG, WebP, MP4, WebM, almacenes C2PA), los plugins con red y canvas simulados, las traducciones en los ocho idiomas y el contrato descriptores/CSP; las pruebas de navegador del hub ejercitan toda la página. El desarrollo requiere Node.js 24 o posterior; la página solo necesita un navegador con ES2017.'
    ],
    pt: [
      '`node scripts/build.mjs` monta o único `index.html` a partir de `src/`: `src/engine.mjs` (analisadores e funções puras), `checks/*.js` (um plugin por verificação; API em `docs/check-api.md`), `data/checks/*.json` (descritores validados por `schema.json`), `src/ui.js`, `src/app.css` e `src/i18n.mjs`; `--check` verifica que a página corresponde às fontes.',
      'Uma verificação devolve constatações codificadas (`{code, level, args}`), nunca frases: a interface converte-as para o idioma do leitor, pelo que acrescentar um idioma ou corrigir uma frase nunca toca nos analisadores.',
      'Os ficheiros são lidos no navegador (File API) e nunca saem do dispositivo. Apenas o título e as notas do caso ficam no armazenamento local do navegador; os elementos e os resultados desaparecem ao recarregar a página.',
      'A Content-Security-Policy só permite pedidos de rede aos anfitriões que os descritores declaram (`archive.org`, `cloudflare-dns.com`, `dns.google`). A interface acrescenta a porta do consentimento, sem credenciais, sem referrer e com um limite de 10 s, e um plugin não pode chamar `fetch` por si.',
      '`npm test` executa os analisadores sobre fixtures geradas (JPEG, PNG, WebP, MP4, WebM, armazéns C2PA), os plugins com rede e canvas simulados, as traduções nos oito idiomas e o contrato descritores/CSP; os testes de navegador do hub exercitam toda a página. O desenvolvimento exige Node.js 24 ou posterior; a página só precisa de um navegador com ES2017.'
    ],
    de: [
      '`node scripts/build.mjs` setzt die eine `index.html` aus `src/` zusammen: `src/engine.mjs` (Parser und reine Funktionen), `checks/*.js` (ein Plugin je Prüfung; API in `docs/check-api.md`), `data/checks/*.json` (Descriptoren, validiert durch `schema.json`), `src/ui.js`, `src/app.css` und `src/i18n.mjs`; `--check` prüft, ob die Seite zu den Quellen passt.',
      'Eine Prüfung liefert kodierte Befunde (`{code, level, args}`), nie Sätze: Die Oberfläche übersetzt sie in die Sprache der Leserin oder des Lesers, sodass eine neue Sprache oder ein korrigierter Satz die Parser nie berührt.',
      'Dateien werden im Browser gelesen (File API) und verlassen das Gerät nie. Nur Titel und Notizen des Falls bleiben im lokalen Speicher des Browsers; Elemente und Ergebnisse verschwinden beim Neuladen der Seite.',
      'Die Content-Security-Policy erlaubt Netzanfragen nur an die Hosts, die die Descriptoren deklarieren (`archive.org`, `cloudflare-dns.com`, `dns.google`). Die Oberfläche fügt die Einwilligungsschranke hinzu, keine Anmeldedaten, keinen Referrer und ein Zeitlimit von 10 s; ein Plugin kann `fetch` nicht selbst aufrufen.',
      '`npm test` führt die Parser auf erzeugten Fixtures (JPEG, PNG, WebP, MP4, WebM, C2PA-Speicher), die Plugins mit simuliertem Netz und Canvas, die Übersetzungen in allen acht Sprachen und den Descriptor/CSP-Vertrag aus; die Browsertests im Hub prüfen die ganze Seite. Die Entwicklung braucht Node.js 24 oder neuer; die Seite selbst braucht nur einen Browser mit ES2017.'
    ],
    hu: [
      'A `node scripts/build.mjs` az `src/` mappából állítja össze az egyetlen `index.html` fájlt: `src/engine.mjs` (értelmezők és tiszta függvények), `checks/*.js` (ellenőrzésenként egy bővítmény; az API a `docs/check-api.md` fájlban), `data/checks/*.json` (a `schema.json` által ellenőrzött leírók), `src/ui.js`, `src/app.css` és `src/i18n.mjs`; a `--check` azt ellenőrzi, hogy az oldal megegyezik-e a forrásokkal.',
      'Egy ellenőrzés kódolt megállapításokat ad vissza (`{code, level, args}`), soha nem mondatokat: a felület az olvasó nyelvére alakítja őket, így egy új nyelv vagy egy javított mondat sosem érinti az értelmezőket.',
      'A fájlokat a böngésző olvassa be (File API), és soha nem hagyják el az eszközt. Csak az ügy címe és jegyzetei maradnak a böngésző helyi tárolójában; a tételek és az eredmények az oldal újratöltésekor eltűnnek.',
      'A Content-Security-Policy csak a leírók által megadott gazdákhoz (`archive.org`, `cloudflare-dns.com`, `dns.google`) enged hálózati kérést. A felület hozzáteszi a hozzájárulási kaput, hitelesítő adatok és referrer nélkül, 10 s időkorláttal, és egy bővítmény maga nem hívhatja a `fetch` függvényt.',
      'Az `npm test` generált mintákon futtatja az értelmezőket (JPEG, PNG, WebP, MP4, WebM, C2PA-tárolók), a bővítményeket szimulált hálózattal és vászonnal, a fordításokat mind a nyolc nyelven és a leíró/CSP szerződést; a hub böngészős tesztjei az egész oldalt végigjárják. A fejlesztéshez Node.js 24 vagy újabb kell; maga az oldal csak ES2017-et tudó böngészőt igényel.'
    ]
  };

  const steps = {
    en: [
      '1. Fork this repository.',
      '2. Copy `data/checks/example.json` to `data/checks/<id>.json` and edit it (schema in `schema.json`), then run `python scripts/validate.py`.',
      '3. Write `checks/<id>.js` (see `docs/check-api.md`): an ES module that exports `async function run(input, ctx)` and returns coded findings.',
      '4. Add the texts for the check and for each finding code in all eight languages in `src/i18n.mjs`.',
      '5. Write tests in `test/`, run `npm test` and `node scripts/build.mjs`, and open a pull request.'
    ].join('\n'),
    ro: [
      '1. Fă un fork acestui depozit.',
      '2. Copiază `data/checks/example.json` în `data/checks/<id>.json` și editează-l (schema este în `schema.json`), apoi rulează `python scripts/validate.py`.',
      '3. Scrie `checks/<id>.js` (vezi `docs/check-api.md`): un modul ES care exportă `async function run(input, ctx)` și întoarce constatări codificate.',
      '4. Adaugă textele verificării și ale fiecărui cod de constatare în toate cele opt limbi în `src/i18n.mjs`.',
      '5. Scrie teste în `test/`, rulează `npm test` și `node scripts/build.mjs`, apoi deschide un pull request.'
    ].join('\n'),
    fr: [
      '1. Faites un fork de ce dépôt.',
      '2. Copiez `data/checks/example.json` vers `data/checks/<id>.json` et modifiez-le (schéma dans `schema.json`), puis lancez `python scripts/validate.py`.',
      '3. Écrivez `checks/<id>.js` (voir `docs/check-api.md`) : un module ES qui exporte `async function run(input, ctx)` et renvoie des constats codés.',
      '4. Ajoutez les textes de la vérification et de chaque code de constat dans les huit langues dans `src/i18n.mjs`.',
      '5. Écrivez des tests dans `test/`, lancez `npm test` et `node scripts/build.mjs`, puis ouvrez une pull request.'
    ].join('\n'),
    it: [
      '1. Fai un fork di questo repository.',
      '2. Copia `data/checks/example.json` in `data/checks/<id>.json` e modificalo (schema in `schema.json`), poi esegui `python scripts/validate.py`.',
      '3. Scrivi `checks/<id>.js` (vedi `docs/check-api.md`): un modulo ES che esporta `async function run(input, ctx)` e restituisce constatazioni codificate.',
      '4. Aggiungi i testi della verifica e di ogni codice di constatazione nelle otto lingue in `src/i18n.mjs`.',
      '5. Scrivi test in `test/`, esegui `npm test` e `node scripts/build.mjs`, poi apri una pull request.'
    ].join('\n'),
    es: [
      '1. Haz un fork de este repositorio.',
      '2. Copia `data/checks/example.json` en `data/checks/<id>.json` y edítalo (esquema en `schema.json`), luego ejecuta `python scripts/validate.py`.',
      '3. Escribe `checks/<id>.js` (consulta `docs/check-api.md`): un módulo ES que exporta `async function run(input, ctx)` y devuelve hallazgos codificados.',
      '4. Añade los textos de la comprobación y de cada código de hallazgo en los ocho idiomas en `src/i18n.mjs`.',
      '5. Escribe pruebas en `test/`, ejecuta `npm test` y `node scripts/build.mjs`, y abre un pull request.'
    ].join('\n'),
    pt: [
      '1. Faça um fork deste repositório.',
      '2. Copie `data/checks/example.json` para `data/checks/<id>.json` e edite-o (esquema em `schema.json`), depois execute `python scripts/validate.py`.',
      '3. Escreva `checks/<id>.js` (veja `docs/check-api.md`): um módulo ES que exporta `async function run(input, ctx)` e devolve constatações codificadas.',
      '4. Acrescente os textos da verificação e de cada código de constatação nos oito idiomas em `src/i18n.mjs`.',
      '5. Escreva testes em `test/`, execute `npm test` e `node scripts/build.mjs`, e abra um pull request.'
    ].join('\n'),
    de: [
      '1. Forke dieses Repository.',
      '2. Kopiere `data/checks/example.json` nach `data/checks/<id>.json` und bearbeite die Datei (Schema in `schema.json`), dann führe `python scripts/validate.py` aus.',
      '3. Schreibe `checks/<id>.js` (siehe `docs/check-api.md`): ein ES-Modul, das `async function run(input, ctx)` exportiert und kodierte Befunde zurückgibt.',
      '4. Ergänze die Texte der Prüfung und jedes Befundcodes in allen acht Sprachen in `src/i18n.mjs`.',
      '5. Schreibe Tests in `test/`, führe `npm test` und `node scripts/build.mjs` aus und öffne einen Pull Request.'
    ].join('\n'),
    hu: [
      '1. Forkold ezt a tárolót.',
      '2. Másold a `data/checks/example.json` fájlt `data/checks/<id>.json` néven, és szerkeszd (séma: `schema.json`), majd futtasd a `python scripts/validate.py` parancsot.',
      '3. Írd meg a `checks/<id>.js` fájlt (lásd `docs/check-api.md`): egy ES-modul, amely exportálja az `async function run(input, ctx)` függvényt, és kódolt megállapításokat ad vissza.',
      '4. Add hozzá az ellenőrzés és az egyes megállapításkódok szövegeit mind a nyolc nyelven az `src/i18n.mjs` fájlban.',
      '5. Írj teszteket a `test/` mappába, futtasd az `npm test` és a `node scripts/build.mjs` parancsot, majd nyiss egy pull requestet.'
    ].join('\n')
  };

  const firstRule = {
    en: 'One check = one descriptor (`data/checks/<id>.json`) + one plugin (`checks/<id>.js`) + tests.',
    ro: 'O verificare = un descriptor (`data/checks/<id>.json`) + un plugin (`checks/<id>.js`) + teste.',
    fr: 'Une vérification = un descripteur (`data/checks/<id>.json`) + un plugin (`checks/<id>.js`) + des tests.',
    it: 'Una verifica = un descrittore (`data/checks/<id>.json`) + un plugin (`checks/<id>.js`) + test.',
    es: 'Una comprobación = un descriptor (`data/checks/<id>.json`) + un plugin (`checks/<id>.js`) + pruebas.',
    pt: 'Uma verificação = um descritor (`data/checks/<id>.json`) + um plugin (`checks/<id>.js`) + testes.',
    de: 'Eine Prüfung = ein Descriptor (`data/checks/<id>.json`) + ein Plugin (`checks/<id>.js`) + Tests.',
    hu: 'Egy ellenőrzés = egy leíró (`data/checks/<id>.json`) + egy bővítmény (`checks/<id>.js`) + tesztek.'
  };

  const contribHeading = {en: 'Adding a check', ro: 'Adăugarea unei verificări', fr: 'Ajouter une vérification', it: 'Aggiungere una verifica', es: 'Añadir una comprobación', pt: 'Acrescentar uma verificação', de: 'Eine Prüfung hinzufügen', hu: 'Ellenőrzés hozzáadása'};
  const contribBody = {
    en: [
      '1. Add `data/checks/<id>.json` (start from `data/checks/example.json`; schema in `schema.json`) and run `python scripts/validate.py`. The `id`, the file name and the plugin name must match.',
      '2. Write `checks/<id>.js` as an ES module (ES2017 syntax, no imports) that exports `async function run(input, ctx)` and returns `ctx.lib.result(findings, data, artifacts)`. Each finding is `ctx.lib.finding(code, level, args)` with `level` one of `ok`, `info`, `warn` or `fail` and `args` an array of strings or numbers. Never put sentences in a finding: the code is the message (see `docs/check-api.md`).',
      '3. Add the texts to `src/i18n.mjs` in all eight languages: `c_<id>_name`, `c_<id>_desc` and `f_<code with dots as underscores>` for each code. `npm test` fails when a language lacks a key or a code has no text.',
      '4. A check that needs the network sets `"offline": false` and lists every host in `"network"`; add the same origins to `connect` in `src/app.json`, call only `ctx.net.json(url)` and say in the description what is sent. Prefer a check that works offline: a new host needs a reason in the pull request.',
      '5. Write tests in `test/` with generated or public-domain samples (never photos of real people) and run `npm test`.',
      '6. Run `node scripts/build.mjs` and commit the regenerated `index.html`, `sw.js` and `app.json` together with `src/`.'
    ].join('\n'),
    ro: [
      '1. Adaugă `data/checks/<id>.json` (pornește de la `data/checks/example.json`; schema este în `schema.json`) și rulează `python scripts/validate.py`. `id`-ul, numele fișierului și numele plugin-ului trebuie să coincidă.',
      '2. Scrie `checks/<id>.js` ca modul ES (sintaxă ES2017, fără importuri) care exportă `async function run(input, ctx)` și întoarce `ctx.lib.result(findings, data, artifacts)`. Fiecare constatare este `ctx.lib.finding(code, level, args)`, cu `level` unul dintre `ok`, `info`, `warn` sau `fail` și `args` o listă de șiruri sau numere. Nu pune niciodată propoziții într-o constatare: codul este mesajul (vezi `docs/check-api.md`).',
      '3. Adaugă textele în `src/i18n.mjs` în toate cele opt limbi: `c_<id>_name`, `c_<id>_desc` și `f_<codul cu puncte schimbate în underscore>` pentru fiecare cod. `npm test` eșuează dacă unei limbi îi lipsește o cheie sau dacă un cod nu are text.',
      '4. O verificare care are nevoie de rețea setează `"offline": false` și enumeră fiecare gazdă în `"network"`; adaugă aceleași origini în `connect` din `src/app.json`, apelează doar `ctx.net.json(url)` și spune în descriere ce se trimite. Preferă o verificare care funcționează offline: o gazdă nouă are nevoie de un motiv în pull request.',
      '5. Scrie teste în `test/` cu eșantioane generate sau din domeniul public (niciodată fotografii cu oameni reali) și rulează `npm test`.',
      '6. Rulează `node scripts/build.mjs` și fă commit cu `index.html`, `sw.js` și `app.json` regenerate, împreună cu `src/`.'
    ].join('\n'),
    fr: [
      '1. Ajoutez `data/checks/<id>.json` (partez de `data/checks/example.json` ; schéma dans `schema.json`) et lancez `python scripts/validate.py`. L’`id`, le nom du fichier et le nom du plugin doivent coïncider.',
      '2. Écrivez `checks/<id>.js` comme un module ES (syntaxe ES2017, sans imports) qui exporte `async function run(input, ctx)` et renvoie `ctx.lib.result(findings, data, artifacts)`. Chaque constat est `ctx.lib.finding(code, level, args)`, avec `level` parmi `ok`, `info`, `warn` ou `fail` et `args` une liste de chaînes ou de nombres. Ne mettez jamais de phrases dans un constat : le code est le message (voir `docs/check-api.md`).',
      '3. Ajoutez les textes dans `src/i18n.mjs` dans les huit langues : `c_<id>_name`, `c_<id>_desc` et `f_<code avec points remplacés par des tirets bas>` pour chaque code. `npm test` échoue quand une langue n’a pas une clé ou qu’un code n’a pas de texte.',
      '4. Une vérification qui a besoin du réseau met `"offline": false` et liste chaque hôte dans `"network"` ; ajoutez les mêmes origines à `connect` dans `src/app.json`, n’appelez que `ctx.net.json(url)` et dites dans la description ce qui est envoyé. Préférez une vérification qui fonctionne hors ligne : un nouvel hôte demande une justification dans la pull request.',
      '5. Écrivez des tests dans `test/` avec des échantillons générés ou du domaine public (jamais des photos de personnes réelles) et lancez `npm test`.',
      '6. Lancez `node scripts/build.mjs` et commitez `index.html`, `sw.js` et `app.json` régénérés avec `src/`.'
    ].join('\n'),
    it: [
      '1. Aggiungi `data/checks/<id>.json` (parti da `data/checks/example.json`; schema in `schema.json`) ed esegui `python scripts/validate.py`. L’`id`, il nome del file e il nome del plugin devono coincidere.',
      '2. Scrivi `checks/<id>.js` come modulo ES (sintassi ES2017, senza import) che esporta `async function run(input, ctx)` e restituisce `ctx.lib.result(findings, data, artifacts)`. Ogni constatazione è `ctx.lib.finding(code, level, args)`, con `level` tra `ok`, `info`, `warn` o `fail` e `args` un elenco di stringhe o numeri. Non mettere mai frasi in una constatazione: il codice è il messaggio (vedi `docs/check-api.md`).',
      '3. Aggiungi i testi in `src/i18n.mjs` nelle otto lingue: `c_<id>_name`, `c_<id>_desc` e `f_<codice con i punti sostituiti da trattini bassi>` per ogni codice. `npm test` fallisce se a una lingua manca una chiave o se un codice non ha testo.',
      '4. Una verifica che richiede la rete imposta `"offline": false` ed elenca ogni host in `"network"`; aggiungi le stesse origini a `connect` in `src/app.json`, chiama solo `ctx.net.json(url)` e di’ nella descrizione che cosa viene inviato. Preferisci una verifica che funziona offline: un nuovo host richiede una motivazione nella pull request.',
      '5. Scrivi test in `test/` con campioni generati o di pubblico dominio (mai foto di persone reali) ed esegui `npm test`.',
      '6. Esegui `node scripts/build.mjs` e fai il commit di `index.html`, `sw.js` e `app.json` rigenerati insieme a `src/`.'
    ].join('\n'),
    es: [
      '1. Añade `data/checks/<id>.json` (parte de `data/checks/example.json`; esquema en `schema.json`) y ejecuta `python scripts/validate.py`. El `id`, el nombre del archivo y el nombre del plugin deben coincidir.',
      '2. Escribe `checks/<id>.js` como módulo ES (sintaxis ES2017, sin imports) que exporta `async function run(input, ctx)` y devuelve `ctx.lib.result(findings, data, artifacts)`. Cada hallazgo es `ctx.lib.finding(code, level, args)`, con `level` entre `ok`, `info`, `warn` o `fail` y `args` una lista de cadenas o números. No pongas nunca frases en un hallazgo: el código es el mensaje (consulta `docs/check-api.md`).',
      '3. Añade los textos a `src/i18n.mjs` en los ocho idiomas: `c_<id>_name`, `c_<id>_desc` y `f_<código con los puntos cambiados por guiones bajos>` para cada código. `npm test` falla si a un idioma le falta una clave o si un código no tiene texto.',
      '4. Una comprobación que necesita la red pone `"offline": false` y enumera cada host en `"network"`; añade los mismos orígenes a `connect` en `src/app.json`, llama solo a `ctx.net.json(url)` y di en la descripción qué se envía. Prefiere una comprobación que funcione sin conexión: un host nuevo necesita una razón en el pull request.',
      '5. Escribe pruebas en `test/` con muestras generadas o de dominio público (nunca fotos de personas reales) y ejecuta `npm test`.',
      '6. Ejecuta `node scripts/build.mjs` y haz commit de `index.html`, `sw.js` y `app.json` regenerados junto con `src/`.'
    ].join('\n'),
    pt: [
      '1. Acrescente `data/checks/<id>.json` (parta de `data/checks/example.json`; esquema em `schema.json`) e execute `python scripts/validate.py`. O `id`, o nome do ficheiro e o nome do plugin têm de coincidir.',
      '2. Escreva `checks/<id>.js` como módulo ES (sintaxe ES2017, sem imports) que exporta `async function run(input, ctx)` e devolve `ctx.lib.result(findings, data, artifacts)`. Cada constatação é `ctx.lib.finding(code, level, args)`, com `level` entre `ok`, `info`, `warn` ou `fail` e `args` uma lista de cadeias ou números. Nunca ponha frases numa constatação: o código é a mensagem (veja `docs/check-api.md`).',
      '3. Acrescente os textos em `src/i18n.mjs` nos oito idiomas: `c_<id>_name`, `c_<id>_desc` e `f_<código com os pontos trocados por sublinhados>` para cada código. `npm test` falha se a um idioma faltar uma chave ou se um código não tiver texto.',
      '4. Uma verificação que precisa da rede define `"offline": false` e enumera cada anfitrião em `"network"`; acrescente as mesmas origens a `connect` em `src/app.json`, chame apenas `ctx.net.json(url)` e diga na descrição o que é enviado. Prefira uma verificação que funcione offline: um anfitrião novo precisa de uma razão no pull request.',
      '5. Escreva testes em `test/` com amostras geradas ou de domínio público (nunca fotografias de pessoas reais) e execute `npm test`.',
      '6. Execute `node scripts/build.mjs` e faça commit de `index.html`, `sw.js` e `app.json` regenerados juntamente com `src/`.'
    ].join('\n'),
    de: [
      '1. Lege `data/checks/<id>.json` an (starte mit `data/checks/example.json`; Schema in `schema.json`) und führe `python scripts/validate.py` aus. `id`, Dateiname und Plugin-Name müssen übereinstimmen.',
      '2. Schreibe `checks/<id>.js` als ES-Modul (ES2017-Syntax, keine Imports), das `async function run(input, ctx)` exportiert und `ctx.lib.result(findings, data, artifacts)` zurückgibt. Jeder Befund ist `ctx.lib.finding(code, level, args)`, mit `level` aus `ok`, `info`, `warn` oder `fail` und `args` als Liste von Zeichenketten oder Zahlen. Setze nie Sätze in einen Befund: Der Code ist die Meldung (siehe `docs/check-api.md`).',
      '3. Ergänze die Texte in `src/i18n.mjs` in allen acht Sprachen: `c_<id>_name`, `c_<id>_desc` und `f_<Code mit Punkten als Unterstrichen>` für jeden Code. `npm test` schlägt fehl, wenn einer Sprache ein Schlüssel fehlt oder ein Code keinen Text hat.',
      '4. Eine Prüfung, die das Netz braucht, setzt `"offline": false` und listet jeden Host in `"network"`; füge dieselben Ursprünge zu `connect` in `src/app.json` hinzu, rufe nur `ctx.net.json(url)` auf und nenne in der Beschreibung, was gesendet wird. Bevorzuge eine Prüfung, die offline funktioniert: Ein neuer Host braucht eine Begründung im Pull Request.',
      '5. Schreibe Tests in `test/` mit erzeugten oder gemeinfreien Beispielen (nie Fotos echter Personen) und führe `npm test` aus.',
      '6. Führe `node scripts/build.mjs` aus und committe die neu erzeugten `index.html`, `sw.js` und `app.json` zusammen mit `src/`.'
    ].join('\n'),
    hu: [
      '1. Add hozzá a `data/checks/<id>.json` fájlt (indulj a `data/checks/example.json` fájlból; séma: `schema.json`), és futtasd a `python scripts/validate.py` parancsot. Az `id`, a fájlnév és a bővítmény neve egyezzen.',
      '2. Írd meg a `checks/<id>.js` fájlt ES-modulként (ES2017 szintaxis, importok nélkül), amely exportálja az `async function run(input, ctx)` függvényt, és `ctx.lib.result(findings, data, artifacts)` értéket ad vissza. Minden megállapítás `ctx.lib.finding(code, level, args)`, ahol a `level` `ok`, `info`, `warn` vagy `fail`, az `args` pedig szövegek vagy számok listája. Soha ne tegyél mondatot egy megállapításba: a kód maga az üzenet (lásd `docs/check-api.md`).',
      '3. Add hozzá a szövegeket az `src/i18n.mjs` fájlban mind a nyolc nyelven: `c_<id>_name`, `c_<id>_desc` és minden kódhoz `f_<a kód pontok helyett aláhúzásokkal>`. Az `npm test` megbukik, ha egy nyelvből hiányzik egy kulcs, vagy egy kódnak nincs szövege.',
      '4. A hálózatot igénylő ellenőrzés `"offline": false` értéket állít be, és minden gazdát felsorol a `"network"` listában; ugyanezeket a forrásokat add az `src/app.json` `connect` listájához, csak a `ctx.net.json(url)` függvényt hívd, és a leírásban mondd meg, mi kerül elküldésre. Az offline működő ellenőrzést részesítsd előnyben: egy új gazdához indoklás kell a pull requestben.',
      '5. Írj teszteket a `test/` mappába generált vagy közkincs mintákkal (soha nem valódi személyek fényképeivel), és futtasd az `npm test` parancsot.',
      '6. Futtasd a `node scripts/build.mjs` parancsot, és commitold az újragenerált `index.html`, `sw.js` és `app.json` fájlokat az `src/` mappával együtt.'
    ].join('\n')
  };

  const issues = {
    en: [
      'Add a PDF metadata check that works offline (Info dictionary, XMP, producer, creation and modification dates, incremental updates)',
      'Replace the byte scan for the Exif block in HEIC and AVIF with a proper ISO BMFF item lookup (`iinf`, `iloc`) and add tests',
      'Add an RDAP domain-age lookup as a clearly labelled network check (declare every host in the descriptor and in `connect`, and document what is sent)',
      'Validate C2PA signatures with Web Crypto (COSE_Sign1 and the certificate chain), tested against the public c2pa-rs sample files',
      'Add `geo:` and OpenStreetMap links for the GPS position in the EXIF finding (opened only when the user clicks)',
      'Improve the error-level map: several quality levels and an amplification slider, with tests on generated images',
      'Add an offline audio metadata check (ID3, MP4 tags, Vorbis comments)',
      'Add a helper that re-encodes an image without EXIF, XMP and IPTC so the user can save a clean copy before publishing',
      'Review the machine-written translations of the interface (fr, de, es, it, pt, hu) and fix what a native speaker would not say',
      'Research an opt-in, self-hosted helper that follows redirect chains (a web page cannot) and open an issue with the design before writing code'
    ],
    ro: [
      'Adaugă o verificare a metadatelor PDF care funcționează offline (dicționarul Info, XMP, producătorul, datele de creare și modificare, actualizări incrementale)',
      'Înlocuiește căutarea octet cu octet a blocului Exif din HEIC și AVIF cu o căutare corectă a elementului ISO BMFF (`iinf`, `iloc`) și adaugă teste',
      'Adaugă o căutare RDAP a vârstei domeniului ca verificare prin rețea etichetată clar (declară fiecare gazdă în descriptor și în `connect` și documentează ce se trimite)',
      'Validează semnăturile C2PA cu Web Crypto (COSE_Sign1 și lanțul de certificate), testate pe fișierele publice de probă din c2pa-rs',
      'Adaugă linkuri `geo:` și OpenStreetMap pentru poziția GPS din constatarea EXIF (se deschid doar la clicul utilizatorului)',
      'Îmbunătățește harta nivelului de eroare: mai multe niveluri de calitate și un cursor de amplificare, cu teste pe imagini generate',
      'Adaugă o verificare offline a metadatelor audio (ID3, etichete MP4, comentarii Vorbis)',
      'Adaugă un ajutor care recodifică o imagine fără EXIF, XMP și IPTC, ca utilizatorul să salveze o copie curată înainte de publicare',
      'Revizuiește traducerile interfeței scrise automat (fr, de, es, it, pt, hu) și corectează ce nu ar spune un vorbitor nativ',
      'Cercetează un ajutor opțional, găzduit de utilizator, care urmărește lanțurile de redirecționări (o pagină web nu poate) și deschide un issue cu designul înainte de a scrie cod'
    ],
    fr: [
      'Ajouter une vérification des métadonnées PDF qui fonctionne hors ligne (dictionnaire Info, XMP, producteur, dates de création et de modification, mises à jour incrémentales)',
      'Remplacer le balayage octet par octet du bloc Exif dans HEIC et AVIF par une vraie recherche d’élément ISO BMFF (`iinf`, `iloc`) et ajouter des tests',
      'Ajouter une recherche RDAP de l’âge d’un domaine comme vérification réseau clairement étiquetée (déclarer chaque hôte dans le descripteur et dans `connect`, et documenter ce qui est envoyé)',
      'Valider les signatures C2PA avec Web Crypto (COSE_Sign1 et chaîne de certificats), testées sur les fichiers d’exemple publics de c2pa-rs',
      'Ajouter des liens `geo:` et OpenStreetMap pour la position GPS du constat EXIF (ouverts seulement au clic de l’utilisateur)',
      'Améliorer la carte du niveau d’erreur : plusieurs niveaux de qualité et un curseur d’amplification, avec des tests sur des images générées',
      'Ajouter une vérification hors ligne des métadonnées audio (ID3, balises MP4, commentaires Vorbis)',
      'Ajouter un utilitaire qui réencode une image sans EXIF, XMP ni IPTC pour que l’utilisateur enregistre une copie propre avant publication',
      'Relire les traductions de l’interface écrites automatiquement (fr, de, es, it, pt, hu) et corriger ce qu’un locuteur natif ne dirait pas',
      'Étudier un utilitaire facultatif, auto-hébergé, qui suit les chaînes de redirections (une page web ne le peut pas) et ouvrir un issue avec la conception avant d’écrire du code'
    ],
    it: [
      'Aggiungere una verifica dei metadati PDF che funzioni offline (dizionario Info, XMP, produttore, date di creazione e modifica, aggiornamenti incrementali)',
      'Sostituire la scansione byte per byte del blocco Exif in HEIC e AVIF con una vera ricerca di elementi ISO BMFF (`iinf`, `iloc`) e aggiungere test',
      'Aggiungere una ricerca RDAP dell’età di un dominio come verifica di rete chiaramente etichettata (dichiarare ogni host nel descrittore e in `connect` e documentare ciò che viene inviato)',
      'Convalidare le firme C2PA con Web Crypto (COSE_Sign1 e catena di certificati), testate sui file di esempio pubblici di c2pa-rs',
      'Aggiungere link `geo:` e OpenStreetMap per la posizione GPS della constatazione EXIF (aperti solo al clic dell’utente)',
      'Migliorare la mappa del livello di errore: più livelli di qualità e un cursore di amplificazione, con test su immagini generate',
      'Aggiungere una verifica offline dei metadati audio (ID3, tag MP4, commenti Vorbis)',
      'Aggiungere un aiuto che ricodifica un’immagine senza EXIF, XMP e IPTC, così l’utente salva una copia pulita prima di pubblicare',
      'Rivedere le traduzioni dell’interfaccia scritte automaticamente (fr, de, es, it, pt, hu) e correggere ciò che un madrelingua non direbbe',
      'Studiare un aiuto facoltativo, ospitato dall’utente, che segue le catene di reindirizzamenti (una pagina web non può) e aprire un issue con il progetto prima di scrivere codice'
    ],
    es: [
      'Añadir una comprobación de metadatos PDF que funcione sin conexión (diccionario Info, XMP, productor, fechas de creación y modificación, actualizaciones incrementales)',
      'Sustituir el barrido byte a byte del bloque Exif en HEIC y AVIF por una búsqueda correcta de elementos ISO BMFF (`iinf`, `iloc`) y añadir pruebas',
      'Añadir una consulta RDAP de la antigüedad de un dominio como comprobación de red claramente etiquetada (declarar cada host en el descriptor y en `connect`, y documentar qué se envía)',
      'Validar las firmas C2PA con Web Crypto (COSE_Sign1 y cadena de certificados), probadas con los archivos de muestra públicos de c2pa-rs',
      'Añadir enlaces `geo:` y OpenStreetMap para la posición GPS del hallazgo EXIF (se abren solo al hacer clic el usuario)',
      'Mejorar el mapa del nivel de error: varios niveles de calidad y un control de amplificación, con pruebas sobre imágenes generadas',
      'Añadir una comprobación sin conexión de metadatos de audio (ID3, etiquetas MP4, comentarios Vorbis)',
      'Añadir una ayuda que recodifique una imagen sin EXIF, XMP ni IPTC para que la persona guarde una copia limpia antes de publicar',
      'Revisar las traducciones de la interfaz escritas automáticamente (fr, de, es, it, pt, hu) y corregir lo que un hablante nativo no diría',
      'Investigar una ayuda opcional, alojada por el usuario, que siga cadenas de redirecciones (una página web no puede) y abrir un issue con el diseño antes de escribir código'
    ],
    pt: [
      'Acrescentar uma verificação de metadados PDF que funcione offline (dicionário Info, XMP, produtor, datas de criação e modificação, atualizações incrementais)',
      'Substituir a varredura byte a byte do bloco Exif em HEIC e AVIF por uma pesquisa correta de itens ISO BMFF (`iinf`, `iloc`) e acrescentar testes',
      'Acrescentar uma consulta RDAP da idade de um domínio como verificação de rede claramente identificada (declarar cada anfitrião no descritor e em `connect`, e documentar o que é enviado)',
      'Validar as assinaturas C2PA com Web Crypto (COSE_Sign1 e cadeia de certificados), testadas com os ficheiros de amostra públicos do c2pa-rs',
      'Acrescentar ligações `geo:` e OpenStreetMap para a posição GPS da constatação EXIF (abertas apenas quando o utilizador clica)',
      'Melhorar o mapa do nível de erro: vários níveis de qualidade e um controlo de amplificação, com testes em imagens geradas',
      'Acrescentar uma verificação offline de metadados de áudio (ID3, etiquetas MP4, comentários Vorbis)',
      'Acrescentar um auxiliar que recodifique uma imagem sem EXIF, XMP e IPTC para o utilizador guardar uma cópia limpa antes de publicar',
      'Rever as traduções da interface escritas automaticamente (fr, de, es, it, pt, hu) e corrigir o que um falante nativo não diria',
      'Investigar um auxiliar opcional, alojado pelo utilizador, que siga cadeias de redirecionamentos (uma página web não consegue) e abrir um issue com o desenho antes de escrever código'
    ],
    de: [
      'Eine PDF-Metadatenprüfung ergänzen, die offline funktioniert (Info-Dictionary, XMP, Producer, Erstellungs- und Änderungsdaten, inkrementelle Updates)',
      'Das Byte-Scannen nach dem Exif-Block in HEIC und AVIF durch eine richtige ISO-BMFF-Item-Suche (`iinf`, `iloc`) ersetzen und Tests ergänzen',
      'Eine RDAP-Abfrage des Domainalters als klar gekennzeichnete Netzprüfung ergänzen (jeden Host im Descriptor und in `connect` deklarieren und dokumentieren, was gesendet wird)',
      'C2PA-Signaturen mit Web Crypto validieren (COSE_Sign1 und Zertifikatskette), getestet an den öffentlichen Beispieldateien von c2pa-rs',
      '`geo:`- und OpenStreetMap-Links für die GPS-Position im EXIF-Befund ergänzen (nur per Klick der Nutzerin oder des Nutzers geöffnet)',
      'Die Fehlerniveau-Karte verbessern: mehrere Qualitätsstufen und ein Verstärkungsregler, mit Tests an erzeugten Bildern',
      'Eine Offline-Prüfung für Audio-Metadaten ergänzen (ID3, MP4-Tags, Vorbis-Kommentare)',
      'Ein Hilfsmittel ergänzen, das ein Bild ohne EXIF, XMP und IPTC neu kodiert, damit man vor dem Veröffentlichen eine saubere Kopie speichern kann',
      'Die maschinell geschriebenen Übersetzungen der Oberfläche (fr, de, es, it, pt, hu) prüfen und korrigieren, was Muttersprachler nicht sagen würden',
      'Ein optionales, selbst gehostetes Hilfsmittel erforschen, das Weiterleitungsketten verfolgt (eine Webseite kann das nicht), und vor dem Programmieren ein Issue mit dem Entwurf eröffnen'
    ],
    hu: [
      'Offline működő PDF-metaadat-ellenőrzés hozzáadása (Info szótár, XMP, készítő program, létrehozási és módosítási dátumok, inkrementális frissítések)',
      'A HEIC és AVIF fájlokban az Exif-blokk bájtonkénti keresését lecserélni valódi ISO BMFF elemkeresésre (`iinf`, `iloc`), és teszteket írni',
      'Egy tartomány korának RDAP-lekérdezése világosan megjelölt hálózati ellenőrzésként (minden gazdát deklarálni a leíróban és a `connect` listában, és dokumentálni, mi kerül elküldésre)',
      'C2PA-aláírások érvényesítése Web Crypto-val (COSE_Sign1 és tanúsítványlánc), a c2pa-rs nyilvános mintafájljain tesztelve',
      '`geo:` és OpenStreetMap hivatkozások hozzáadása az EXIF-megállapítás GPS-pozíciójához (csak a felhasználó kattintására nyílnak meg)',
      'A hibaszint-térkép javítása: több minőségi szint és erősítő csúszka, generált képeken írt tesztekkel',
      'Offline hangfájl-metaadat ellenőrzés hozzáadása (ID3, MP4-címkék, Vorbis-megjegyzések)',
      'Segédeszköz hozzáadása, amely EXIF, XMP és IPTC nélkül újrakódol egy képet, hogy a felhasználó közzététel előtt tiszta másolatot menthessen',
      'A felület gépi segítséggel írt fordításainak átnézése (fr, de, es, it, pt, hu), és kijavítása annak, amit egy anyanyelvi beszélő nem mondana így',
      'Egy választható, saját üzemeltetésű segédeszköz kutatása, amely követi az átirányítási láncokat (egy weboldal erre nem képes), és terv-issue nyitása a kódolás előtt'
    ]
  };

  const added = {
    en: [
      'Eleven working checks: file structure with SHA-256, EXIF inspector, other embedded metadata (XMP, IPTC, PNG text), Content Credentials (C2PA) reader, error-level analysis for JPEG, video metadata, video keyframes, link anatomy, text hygiene, DNS summary and Internet Archive lookup (the last two only on request, after consent).',
      'A common check API (`docs/check-api.md`): coded findings with four levels, one descriptor and one plugin per check, and a simulated network and canvas for tests.',
      'Case view: add files, links, domains and text by drag and drop, file picker or paste; run the checks per item or all at once; a report in Markdown, JSON or print/PDF with the date, each SHA-256 and the limits; a section on limits and ethics (`docs/ethics.md`).',
      'Interface in eight languages (291 texts each, checked for the same keys and placeholders), dark and light themes, keyboard and screen-reader support, mobile layout.',
      'The Content-Security-Policy lists exactly the three hosts the network checks use (`connect` in `src/app.json`); the network checks stay off until the user ticks a consent box.',
      'Tests: `node --test` for parsers, plugins, translations and the descriptor/CSP contract; browser tests in the hub (all languages, accessibility, hostile files, simulated network).',
      '`src/`, `checks/` and `scripts/build.mjs`: the single `index.html` is now built from sources, and `--check` verifies it.'
    ],
    ro: [
      'Unsprezece verificări funcționale: structura fișierului cu SHA-256, inspector EXIF, alte metadate încorporate (XMP, IPTC, text PNG), cititor Content Credentials (C2PA), analiza nivelului de eroare pentru JPEG, metadate video, cadre-cheie video, anatomia linkurilor, igiena textului, rezumat DNS și căutare în Internet Archive (ultimele două doar la cerere, după consimțământ).',
      'Un API comun al verificărilor (`docs/check-api.md`): constatări codificate cu patru niveluri, un descriptor și un plugin pentru fiecare verificare, plus rețea și canvas simulate pentru teste.',
      'Vedere de dosar: adaugi fișiere, linkuri, domenii și text prin tragere, selector de fișiere sau lipire; rulezi verificările pe fiecare element sau pe toate odată; un raport în Markdown, JSON sau tipărire/PDF cu data, fiecare SHA-256 și limitele; o secțiune despre limite și etică (`docs/ethics.md`).',
      'Interfață în opt limbi (câte 291 de texte, verificate pentru aceleași chei și substituenți), teme întunecată și luminoasă, suport pentru tastatură și cititoare de ecran, aspect pentru mobil.',
      'Content-Security-Policy enumeră exact cele trei gazde folosite de verificările prin rețea (`connect` în `src/app.json`); verificările prin rețea rămân oprite până când utilizatorul bifează o casetă de consimțământ.',
      'Teste: `node --test` pentru parsere, plugin-uri, traduceri și contractul descriptori/CSP; teste de browser în hub (toate limbile, accesibilitate, fișiere ostile, rețea simulată).',
      '`src/`, `checks/` și `scripts/build.mjs`: singurul `index.html` este acum construit din surse, iar `--check` îl verifică.'
    ],
    fr: [
      'Onze vérifications fonctionnelles : structure du fichier avec SHA-256, inspecteur EXIF, autres métadonnées intégrées (XMP, IPTC, texte PNG), lecteur Content Credentials (C2PA), analyse du niveau d’erreur pour JPEG, métadonnées vidéo, images clés vidéo, anatomie des liens, hygiène du texte, résumé DNS et recherche Internet Archive (les deux dernières seulement à la demande, après consentement).',
      'Une API commune des vérifications (`docs/check-api.md`) : constats codés à quatre niveaux, un descripteur et un plugin par vérification, et un réseau et un canvas simulés pour les tests.',
      'Vue de dossier : ajout de fichiers, liens, domaines et texte par glisser-déposer, sélecteur de fichiers ou collage ; vérifications par élément ou toutes à la fois ; un rapport en Markdown, JSON ou impression/PDF avec la date, chaque SHA-256 et les limites ; une section sur les limites et l’éthique (`docs/ethics.md`).',
      'Interface en huit langues (291 textes chacune, vérifiés pour les mêmes clés et substituants), thèmes sombre et clair, prise en charge du clavier et des lecteurs d’écran, mise en page mobile.',
      'La Content-Security-Policy liste exactement les trois hôtes utilisés par les vérifications réseau (`connect` dans `src/app.json`) ; les vérifications réseau restent désactivées tant que l’utilisateur n’a pas coché une case de consentement.',
      'Tests : `node --test` pour les analyseurs, les plugins, les traductions et le contrat descripteurs/CSP ; tests de navigateur dans le hub (toutes les langues, accessibilité, fichiers hostiles, réseau simulé).',
      '`src/`, `checks/` et `scripts/build.mjs` : l’unique `index.html` est désormais construit à partir des sources, et `--check` le vérifie.'
    ],
    it: [
      'Undici verifiche funzionanti: struttura del file con SHA-256, ispettore EXIF, altri metadati incorporati (XMP, IPTC, testo PNG), lettore Content Credentials (C2PA), analisi del livello di errore per JPEG, metadati video, fotogrammi chiave video, anatomia dei link, igiene del testo, riepilogo DNS e ricerca su Internet Archive (le ultime due solo su richiesta, dopo il consenso).',
      'Un’API comune delle verifiche (`docs/check-api.md`): constatazioni codificate a quattro livelli, un descrittore e un plugin per verifica, e una rete e un canvas simulati per i test.',
      'Vista del caso: aggiungi file, link, domini e testo con trascinamento, selettore di file o incolla; esegui le verifiche per elemento o tutte insieme; un rapporto in Markdown, JSON o stampa/PDF con la data, ogni SHA-256 e i limiti; una sezione su limiti ed etica (`docs/ethics.md`).',
      'Interfaccia in otto lingue (291 testi ciascuna, controllati per le stesse chiavi e segnaposto), temi scuro e chiaro, supporto per tastiera e lettori di schermo, layout mobile.',
      'La Content-Security-Policy elenca esattamente i tre host usati dalle verifiche di rete (`connect` in `src/app.json`); le verifiche di rete restano disattivate finché l’utente non spunta una casella di consenso.',
      'Test: `node --test` per parser, plugin, traduzioni e contratto descrittori/CSP; test del browser nell’hub (tutte le lingue, accessibilità, file ostili, rete simulata).',
      '`src/`, `checks/` e `scripts/build.mjs`: l’unico `index.html` è ora costruito dai sorgenti e `--check` lo verifica.'
    ],
    es: [
      'Once comprobaciones funcionales: estructura del archivo con SHA-256, inspector EXIF, otros metadatos incrustados (XMP, IPTC, texto PNG), lector de Content Credentials (C2PA), análisis del nivel de error para JPEG, metadatos de vídeo, fotogramas clave de vídeo, anatomía de enlaces, higiene del texto, resumen DNS y consulta a Internet Archive (las dos últimas solo a petición, tras el consentimiento).',
      'Una API común de comprobaciones (`docs/check-api.md`): hallazgos codificados con cuatro niveles, un descriptor y un plugin por comprobación, y una red y un canvas simulados para las pruebas.',
      'Vista del caso: añade archivos, enlaces, dominios y texto arrastrando, con el selector de archivos o pegando; ejecuta las comprobaciones por elemento o todas a la vez; un informe en Markdown, JSON o impresión/PDF con la fecha, cada SHA-256 y los límites; una sección sobre límites y ética (`docs/ethics.md`).',
      'Interfaz en ocho idiomas (291 textos cada una, comprobados para las mismas claves y marcadores), temas oscuro y claro, compatibilidad con teclado y lectores de pantalla, diseño móvil.',
      'La Content-Security-Policy enumera exactamente los tres hosts que usan las comprobaciones de red (`connect` en `src/app.json`); las comprobaciones de red permanecen desactivadas hasta que la persona marque una casilla de consentimiento.',
      'Pruebas: `node --test` para analizadores, plugins, traducciones y el contrato descriptores/CSP; pruebas de navegador en el hub (todos los idiomas, accesibilidad, archivos hostiles, red simulada).',
      '`src/`, `checks/` y `scripts/build.mjs`: el único `index.html` se construye ahora a partir de las fuentes, y `--check` lo verifica.'
    ],
    pt: [
      'Onze verificações funcionais: estrutura do ficheiro com SHA-256, inspetor EXIF, outros metadados incorporados (XMP, IPTC, texto PNG), leitor de Content Credentials (C2PA), análise do nível de erro para JPEG, metadados de vídeo, fotogramas-chave de vídeo, anatomia das ligações, higiene do texto, resumo DNS e pesquisa no Internet Archive (as duas últimas só a pedido, após o consentimento).',
      'Uma API comum das verificações (`docs/check-api.md`): constatações codificadas com quatro níveis, um descritor e um plugin por verificação, e uma rede e um canvas simulados para os testes.',
      'Vista do caso: acrescente ficheiros, ligações, domínios e texto arrastando, com o seletor de ficheiros ou colando; execute as verificações por elemento ou todas de uma vez; um relatório em Markdown, JSON ou impressão/PDF com a data, cada SHA-256 e os limites; uma secção sobre limites e ética (`docs/ethics.md`).',
      'Interface em oito idiomas (291 textos cada, verificados quanto às mesmas chaves e marcadores), temas escuro e claro, suporte para teclado e leitores de ecrã, disposição para telemóvel.',
      'A Content-Security-Policy enumera exatamente os três anfitriões usados pelas verificações de rede (`connect` em `src/app.json`); as verificações de rede ficam desativadas até o utilizador assinalar uma caixa de consentimento.',
      'Testes: `node --test` para analisadores, plugins, traduções e o contrato descritores/CSP; testes de navegador no hub (todos os idiomas, acessibilidade, ficheiros hostis, rede simulada).',
      '`src/`, `checks/` e `scripts/build.mjs`: o único `index.html` é agora construído a partir das fontes, e `--check` verifica-o.'
    ],
    de: [
      'Elf funktionierende Prüfungen: Dateistruktur mit SHA-256, EXIF-Inspektor, weitere eingebettete Metadaten (XMP, IPTC, PNG-Text), Content-Credentials-Leser (C2PA), Fehlerniveau-Analyse für JPEG, Videometadaten, Video-Schlüsselbilder, Link-Anatomie, Texthygiene, DNS-Zusammenfassung und Internet-Archive-Abfrage (die letzten beiden nur auf Anfrage, nach Einwilligung).',
      'Eine gemeinsame Prüf-API (`docs/check-api.md`): kodierte Befunde mit vier Stufen, ein Descriptor und ein Plugin je Prüfung sowie ein simuliertes Netz und Canvas für Tests.',
      'Fallansicht: Dateien, Links, Domains und Text per Ziehen und Ablegen, Dateiauswahl oder Einfügen hinzufügen; Prüfungen je Element oder alle zugleich ausführen; ein Bericht als Markdown, JSON oder Druck/PDF mit Datum, jedem SHA-256 und den Grenzen; ein Abschnitt zu Grenzen und Ethik (`docs/ethics.md`).',
      'Oberfläche in acht Sprachen (je 291 Texte, geprüft auf gleiche Schlüssel und Platzhalter), dunkles und helles Design, Tastatur- und Screenreader-Unterstützung, mobiles Layout.',
      'Die Content-Security-Policy nennt genau die drei Hosts, die die Netzprüfungen nutzen (`connect` in `src/app.json`); die Netzprüfungen bleiben aus, bis die Nutzerin oder der Nutzer ein Einwilligungsfeld ankreuzt.',
      'Tests: `node --test` für Parser, Plugins, Übersetzungen und den Descriptor/CSP-Vertrag; Browsertests im Hub (alle Sprachen, Barrierefreiheit, feindliche Dateien, simuliertes Netz).',
      '`src/`, `checks/` und `scripts/build.mjs`: Die eine `index.html` wird nun aus den Quellen gebaut, und `--check` prüft sie.'
    ],
    hu: [
      'Tizenegy működő ellenőrzés: fájlszerkezet SHA-256-tal, EXIF-vizsgáló, egyéb beágyazott metaadatok (XMP, IPTC, PNG-szöveg), Content Credentials (C2PA) olvasó, hibaszint-elemzés JPEG-hez, videó-metaadatok, videó-kulcskockák, hivatkozások felépítése, szöveghigiénia, DNS-összefoglaló és Internet Archive-keresés (az utolsó kettő csak kérésre, hozzájárulás után).',
      'Közös ellenőrzési API (`docs/check-api.md`): kódolt, négyszintű megállapítások, ellenőrzésenként egy leíró és egy bővítmény, valamint szimulált hálózat és vászon a teszteléshez.',
      'Ügynézet: fájlok, hivatkozások, tartományok és szöveg hozzáadása húzással, fájlválasztóval vagy beillesztéssel; ellenőrzések tételenként vagy egyszerre; jelentés Markdown, JSON vagy nyomtatás/PDF formában a dátummal, minden SHA-256 értékkel és a korlátokkal; korlátokról és etikáról szóló szakasz (`docs/ethics.md`).',
      'Felület nyolc nyelven (nyelvenként 291 szöveg, azonos kulcsokra és helyőrzőkre ellenőrizve), sötét és világos téma, billentyűzet- és képernyőolvasó-támogatás, mobil elrendezés.',
      'A Content-Security-Policy pontosan azt a három gazdát sorolja fel, amelyet a hálózati ellenőrzések használnak (`connect` az `src/app.json` fájlban); a hálózati ellenőrzések kikapcsolva maradnak, amíg a felhasználó be nem jelöli a hozzájárulást.',
      'Tesztek: `node --test` az értelmezőkre, bővítményekre, fordításokra és a leíró/CSP szerződésre; böngészős tesztek a hubban (minden nyelv, akadálymentesség, ellenséges fájlok, szimulált hálózat).',
      '`src/`, `checks/` és `scripts/build.mjs`: az egyetlen `index.html` mostantól a forrásokból készül, és a `--check` ellenőrzi.'
    ]
  };
  for (const l of Object.keys(added)) added[l] = [...added[l], ...legacy[l]];

  const changed = {
    en: [
      '`data/checks/example.json` is now the template descriptor, and `docs/examples/my-check.js` is the matching template plugin.',
      '`schema.json`: `input` accepts `file`, `image`, `video`, `url`, `domain` and `text` (alone or as a list), and `network` lists the hosts of a check that is not offline.',
      '`scripts/validate.py` also checks that every descriptor has its plugin, that the `id` matches the file name and that every network host is declared in `src/app.json`.',
      'The workflow runs on Ubuntu 26.04 with Node.js 26 and also runs the tests and the build check.'
    ],
    ro: [
      '`data/checks/example.json` este acum descriptorul-model, iar `docs/examples/my-check.js` este plugin-ul-model corespunzător.',
      '`schema.json`: `input` acceptă `file`, `image`, `video`, `url`, `domain` și `text` (singure sau ca listă), iar `network` enumeră gazdele unei verificări care nu este offline.',
      '`scripts/validate.py` verifică și dacă fiecare descriptor are plugin-ul lui, dacă `id` coincide cu numele fișierului și dacă fiecare gazdă de rețea este declarată în `src/app.json`.',
      'Fluxul de lucru rulează pe Ubuntu 26.04 cu Node.js 26 și rulează și testele, plus verificarea construcției.'
    ],
    fr: [
      '`data/checks/example.json` est désormais le descripteur modèle, et `docs/examples/my-check.js` le plugin modèle correspondant.',
      '`schema.json` : `input` accepte `file`, `image`, `video`, `url`, `domain` et `text` (seuls ou en liste), et `network` liste les hôtes d’une vérification qui n’est pas hors ligne.',
      '`scripts/validate.py` vérifie aussi que chaque descripteur a son plugin, que l’`id` correspond au nom du fichier et que chaque hôte réseau est déclaré dans `src/app.json`.',
      'Le workflow s’exécute sur Ubuntu 26.04 avec Node.js 26 et lance aussi les tests et la vérification de la construction.'
    ],
    it: [
      '`data/checks/example.json` è ora il descrittore modello, e `docs/examples/my-check.js` il plugin modello corrispondente.',
      '`schema.json`: `input` accetta `file`, `image`, `video`, `url`, `domain` e `text` (singoli o in elenco), e `network` elenca gli host di una verifica non offline.',
      '`scripts/validate.py` controlla anche che ogni descrittore abbia il suo plugin, che l’`id` corrisponda al nome del file e che ogni host di rete sia dichiarato in `src/app.json`.',
      'Il workflow gira su Ubuntu 26.04 con Node.js 26 ed esegue anche i test e il controllo della build.'
    ],
    es: [
      '`data/checks/example.json` es ahora el descriptor plantilla, y `docs/examples/my-check.js` el plugin plantilla correspondiente.',
      '`schema.json`: `input` acepta `file`, `image`, `video`, `url`, `domain` y `text` (solos o en lista), y `network` enumera los hosts de una comprobación que no es sin conexión.',
      '`scripts/validate.py` comprueba además que cada descriptor tenga su plugin, que el `id` coincida con el nombre del archivo y que cada host de red esté declarado en `src/app.json`.',
      'El workflow se ejecuta en Ubuntu 26.04 con Node.js 26 y ejecuta también las pruebas y la comprobación de la compilación.'
    ],
    pt: [
      '`data/checks/example.json` é agora o descritor modelo, e `docs/examples/my-check.js` o plugin modelo correspondente.',
      '`schema.json`: `input` aceita `file`, `image`, `video`, `url`, `domain` e `text` (sozinhos ou em lista), e `network` enumera os anfitriões de uma verificação que não é offline.',
      '`scripts/validate.py` verifica também que cada descritor tem o seu plugin, que o `id` corresponde ao nome do ficheiro e que cada anfitrião de rede está declarado em `src/app.json`.',
      'O workflow corre em Ubuntu 26.04 com Node.js 26 e executa também os testes e a verificação da compilação.'
    ],
    de: [
      '`data/checks/example.json` ist jetzt der Vorlagen-Descriptor, und `docs/examples/my-check.js` das passende Vorlagen-Plugin.',
      '`schema.json`: `input` akzeptiert `file`, `image`, `video`, `url`, `domain` und `text` (einzeln oder als Liste), und `network` listet die Hosts einer Prüfung, die nicht offline ist.',
      '`scripts/validate.py` prüft zusätzlich, dass jeder Descriptor sein Plugin hat, dass die `id` zum Dateinamen passt und dass jeder Netz-Host in `src/app.json` deklariert ist.',
      'Der Workflow läuft auf Ubuntu 26.04 mit Node.js 26 und führt auch die Tests und die Build-Prüfung aus.'
    ],
    hu: [
      'A `data/checks/example.json` mostantól a sablonleíró, a `docs/examples/my-check.js` pedig a hozzá tartozó sablonbővítmény.',
      'A `schema.json`: az `input` elfogadja a `file`, `image`, `video`, `url`, `domain` és `text` értékeket (önállóan vagy listaként), a `network` pedig a nem offline ellenőrzés gazdáit sorolja fel.',
      'A `scripts/validate.py` azt is ellenőrzi, hogy minden leírónak megvan a bővítménye, az `id` egyezik a fájlnévvel, és minden hálózati gazda deklarálva van az `src/app.json` fájlban.',
      'A munkafolyamat Ubuntu 26.04 és Node.js 26 alatt fut, és a teszteket meg a build-ellenőrzést is futtatja.'
    ]
  };

  return {
    slug: 'atelier-verificare', version: '0.2.0', updated: '2026-11-17',
    headings: {
      does: {en: 'What it does', ro: 'Ce face', fr: 'Ce que fait l’application', it: 'Cosa fa', es: 'Qué hace', pt: 'O que faz', de: 'Was es kann', hu: 'Mit tud'},
      how: {en: 'How it works', ro: 'Cum funcționează', fr: 'Comment ça marche', it: 'Come funziona', es: 'Cómo funciona', pt: 'Como funciona', de: 'Wie es funktioniert', hu: 'Hogyan működik'},
      limits: limHeading
    },
    status, does, how, limits, steps, firstRule,
    contrib: {heading: contribHeading, body: contribBody},
    issues,
    changelog: {added, changed}
  };
}
