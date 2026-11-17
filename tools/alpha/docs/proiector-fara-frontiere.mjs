// Specificația documentației PROIECTOR FĂRĂ FRONTIERE (opt limbi). Folosită de tools/alpha/docs.mjs.
// Textele despre protocol, limite și sandbox repetă ce spun docs/*.md ale aplicației; test/docs.test.mjs din aplicație le verifică față de cod.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default async function () {
  const legacy = JSON.parse(fs.readFileSync(path.join(HERE, 'proiector-fara-frontiere.legacy.json'), 'utf8'));

  const status = {
    en: 'Alpha, usable: the projector page and five activities (timer, poll, quiz, sticky notes, whiteboard) work in the single `index.html`: open it on the teacher’s device, add phones with a QR or text code, no server and no account. The activities run in isolated frames. What has not been tested (real phones, browsers other than Chromium, real Wi-Fi) is listed below and in `docs/compat.md`.',
    ro: 'Alfa, utilizabil: pagina proiectorului și cinci activități (cronometru, sondaj, quiz, notițe lipicioase, tablă) funcționează în singurul fișier `index.html`: îl deschizi pe dispozitivul profesorului, adaugi telefoane cu un cod QR sau text, fără server și fără cont. Activitățile rulează în cadre izolate. Ce nu a fost testat (telefoane reale, alte browsere decât Chromium, Wi-Fi real) este enumerat mai jos și în `docs/compat.md`.',
    fr: 'Alpha, utilisable : la page du projecteur et cinq activités (minuteur, sondage, quiz, notes autocollantes, tableau blanc) fonctionnent dans l’unique fichier `index.html` : ouvrez-le sur l’appareil de l’enseignant, ajoutez des téléphones avec un code QR ou texte, sans serveur et sans compte. Les activités s’exécutent dans des cadres isolés. Ce qui n’a pas été testé (vrais téléphones, navigateurs autres que Chromium, vrai Wi-Fi) est indiqué plus bas et dans `docs/compat.md`.',
    it: 'Alpha, utilizzabile: la pagina del proiettore e cinque attività (timer, sondaggio, quiz, note adesive, lavagna) funzionano nell’unico file `index.html`: lo apri sul dispositivo dell’insegnante, aggiungi i telefoni con un codice QR o di testo, senza server e senza account. Le attività girano in frame isolati. Ciò che non è stato provato (telefoni reali, browser diversi da Chromium, Wi-Fi reale) è elencato più sotto e in `docs/compat.md`.',
    es: 'Alfa, utilizable: la página del proyector y cinco actividades (temporizador, encuesta, cuestionario, notas adhesivas, pizarra) funcionan en el único archivo `index.html`: ábrelo en el dispositivo del docente, añade teléfonos con un código QR o de texto, sin servidor y sin cuenta. Las actividades se ejecutan en marcos aislados. Lo que no se ha probado (teléfonos reales, navegadores distintos de Chromium, Wi-Fi real) se enumera más abajo y en `docs/compat.md`.',
    pt: 'Alfa, utilizável: a página do projetor e cinco atividades (temporizador, sondagem, questionário, notas autocolantes, quadro) funcionam no único ficheiro `index.html`: abra-o no dispositivo do professor, adicione telemóveis com um código QR ou de texto, sem servidor e sem conta. As atividades correm em quadros isolados. O que não foi testado (telemóveis reais, navegadores que não o Chromium, Wi-Fi real) está listado abaixo e em `docs/compat.md`.',
    de: 'Alpha, nutzbar: die Projektor-Seite und fünf Aktivitäten (Timer, Umfrage, Quiz, Haftnotizen, Whiteboard) laufen in der einen Datei `index.html`: auf dem Gerät der Lehrkraft öffnen, Telefone per QR- oder Textcode hinzufügen, ohne Server und ohne Konto. Die Aktivitäten laufen in isolierten Frames. Was nicht getestet wurde (echte Telefone, andere Browser als Chromium, echtes WLAN), steht weiter unten und in `docs/compat.md`.',
    hu: 'Alfa, használható: a kivetítő oldala és öt tevékenység (időzítő, szavazás, kvíz, jegyzetpapírok, tábla) működik az egyetlen `index.html` fájlban: nyisd meg a tanár eszközén, adj hozzá telefonokat QR- vagy szöveges kóddal, szerver és fiók nélkül. A tevékenységek elkülönített keretekben futnak. Amit nem teszteltünk (valódi telefonok, a Chromiumtól eltérő böngészők, valódi Wi-Fi), az lent és a `docs/compat.md` fájlban olvasható.'
  };

  const does = {
    en: [
      'Two roles in one page: at the projector (it shows the shared screen and controls the activities) and as a phone (it joins and takes part). A session holds up to 30 phones.',
      'Pairing without a server: each phone is paired with the projector by exchanging a code, as QR frames, a photo of the code or pasted text; no account, no signalling server, no tracking. By default nothing leaves the local network.',
      'Five activities: a countdown timer; a poll with live bars and a CSV of the result; a quiz (question files as JSON, plain text or CSV, speed bonus, scoreboard, a CSV of the scores, up to five sets saved on the device) in which the right answer stays on the projector until it is revealed; sticky notes from every phone with a text export; a whiteboard with one colour per phone and a PNG export.',
      'Teacher controls: lock or unlock one phone or all of them, remove a phone, full screen, keep the screen awake, end the session. A phone that drops out and comes back gets its name and colour back.',
      'Each device has its own language (eight) and its own look: light or dark, high contrast, large text.',
      'A widget API and a documented permission model (`docs/widget-api.md`, `docs/sandbox.md`): a new activity is one descriptor in `data/widgets/` plus one script in `widgets/`.',
      'Keyboard and screen-reader support, large touch targets, a layout for narrow phone screens; no tracking, no accounts, works offline.'
    ],
    ro: [
      'Două roluri într-o singură pagină: la proiector (arată ecranul comun și conduce activitățile) și ca telefon (se alătură și participă). O sesiune ține până la 30 de telefoane.',
      'Asociere fără server: fiecare telefon se asociază cu proiectorul schimbând un cod, sub formă de cadre QR, fotografie a codului sau text lipit; fără cont, fără server de semnalizare, fără urmărire. Implicit nu iese nimic din rețeaua locală.',
      'Cinci activități: un cronometru cu numărătoare inversă; un sondaj cu bare în direct și un CSV cu rezultatul; un quiz (fișiere de întrebări JSON, text simplu sau CSV, bonus de viteză, clasament, un CSV cu scorurile, până la cinci seturi salvate pe dispozitiv) la care răspunsul corect rămâne pe proiector până este dezvăluit; notițe lipicioase de la toate telefoanele, cu export text; o tablă cu o culoare pe telefon și export PNG.',
      'Controale pentru profesor: blochezi sau deblochezi un telefon sau pe toate, elimini un telefon, ecran complet, păstrezi ecranul aprins, închei sesiunea. Un telefon care iese și revine își primește înapoi numele și culoarea.',
      'Fiecare dispozitiv are propria limbă (opt) și propriul aspect: luminos sau întunecat, contrast ridicat, text mare.',
      'Un API pentru widgeturi și un model de permisiuni documentat (`docs/widget-api.md`, `docs/sandbox.md`): o activitate nouă înseamnă un descriptor în `data/widgets/` plus un script în `widgets/`.',
      'Suport pentru tastatură și cititoare de ecran, ținte tactile mari, aspect pentru ecrane înguste de telefon; fără urmărire, fără conturi, funcționează offline.'
    ],
    fr: [
      'Deux rôles dans une seule page : au projecteur (il affiche l’écran partagé et pilote les activités) et comme téléphone (il rejoint et participe). Une session accueille jusqu’à 30 téléphones.',
      'Appairage sans serveur : chaque téléphone est appairé au projecteur en échangeant un code, sous forme d’images QR, de photo du code ou de texte collé ; sans compte, sans serveur de signalisation, sans suivi. Par défaut, rien ne quitte le réseau local.',
      'Cinq activités : un minuteur à rebours ; un sondage avec barres en direct et un CSV du résultat ; un quiz (fichiers de questions JSON, texte simple ou CSV, bonus de rapidité, classement, un CSV des scores, jusqu’à cinq séries enregistrées sur l’appareil) dont la bonne réponse reste sur le projecteur jusqu’à sa révélation ; des notes autocollantes de tous les téléphones avec export texte ; un tableau blanc avec une couleur par téléphone et un export PNG.',
      'Commandes de l’enseignant : verrouiller ou déverrouiller un téléphone ou tous, retirer un téléphone, plein écran, garder l’écran allumé, terminer la session. Un téléphone qui se déconnecte puis revient retrouve son nom et sa couleur.',
      'Chaque appareil a sa propre langue (huit) et son propre aspect : clair ou sombre, fort contraste, grand texte.',
      'Une API de widgets et un modèle de permissions documenté (`docs/widget-api.md`, `docs/sandbox.md`) : une nouvelle activité, c’est un descripteur dans `data/widgets/` plus un script dans `widgets/`.',
      'Prise en charge du clavier et des lecteurs d’écran, grandes cibles tactiles, mise en page pour écrans étroits de téléphone ; sans suivi, sans comptes, fonctionne hors ligne.'
    ],
    it: [
      'Due ruoli in una sola pagina: al proiettore (mostra lo schermo condiviso e guida le attività) e come telefono (si unisce e partecipa). Una sessione ospita fino a 30 telefoni.',
      'Abbinamento senza server: ogni telefono si abbina al proiettore scambiando un codice, come fotogrammi QR, foto del codice o testo incollato; nessun account, nessun server di segnalazione, nessun tracciamento. Per impostazione predefinita nulla esce dalla rete locale.',
      'Cinque attività: un timer a conto alla rovescia; un sondaggio con barre dal vivo e un CSV del risultato; un quiz (file di domande JSON, testo semplice o CSV, bonus di velocità, classifica, un CSV dei punteggi, fino a cinque set salvati sul dispositivo) in cui la risposta giusta resta sul proiettore finché non viene rivelata; note adesive da tutti i telefoni con esportazione in testo; una lavagna con un colore per telefono ed esportazione PNG.',
      'Controlli per l’insegnante: bloccare o sbloccare un telefono o tutti, rimuovere un telefono, schermo intero, tenere lo schermo acceso, terminare la sessione. Un telefono che esce e rientra riprende nome e colore.',
      'Ogni dispositivo ha la propria lingua (otto) e il proprio aspetto: chiaro o scuro, alto contrasto, testo grande.',
      'Un’API per widget e un modello di permessi documentato (`docs/widget-api.md`, `docs/sandbox.md`): una nuova attività è un descrittore in `data/widgets/` più uno script in `widgets/`.',
      'Supporto per tastiera e lettori di schermo, bersagli touch grandi, layout per schermi stretti di telefono; nessun tracciamento, nessun account, funziona offline.'
    ],
    es: [
      'Dos papeles en una sola página: en el proyector (muestra la pantalla compartida y dirige las actividades) y como teléfono (se une y participa). Una sesión admite hasta 30 teléfonos.',
      'Emparejamiento sin servidor: cada teléfono se empareja con el proyector intercambiando un código, como fotogramas QR, foto del código o texto pegado; sin cuenta, sin servidor de señalización, sin rastreo. Por defecto nada sale de la red local.',
      'Cinco actividades: un temporizador de cuenta atrás; una encuesta con barras en directo y un CSV del resultado; un cuestionario (archivos de preguntas JSON, texto simple o CSV, bonificación por rapidez, clasificación, un CSV de las puntuaciones, hasta cinco conjuntos guardados en el dispositivo) en el que la respuesta correcta se queda en el proyector hasta que se revela; notas adhesivas de todos los teléfonos con exportación en texto; una pizarra con un color por teléfono y exportación PNG.',
      'Controles del docente: bloquear o desbloquear un teléfono o todos, quitar un teléfono, pantalla completa, mantener la pantalla encendida, terminar la sesión. Un teléfono que se desconecta y vuelve recupera su nombre y su color.',
      'Cada dispositivo tiene su propio idioma (ocho) y su propio aspecto: claro u oscuro, alto contraste, texto grande.',
      'Una API de widgets y un modelo de permisos documentado (`docs/widget-api.md`, `docs/sandbox.md`): una actividad nueva es un descriptor en `data/widgets/` más un script en `widgets/`.',
      'Compatibilidad con teclado y lectores de pantalla, zonas táctiles grandes, diseño para pantallas estrechas de teléfono; sin rastreo, sin cuentas, funciona sin conexión.'
    ],
    pt: [
      'Dois papéis numa só página: no projetor (mostra o ecrã partilhado e dirige as atividades) e como telemóvel (junta-se e participa). Uma sessão aceita até 30 telemóveis.',
      'Emparelhamento sem servidor: cada telemóvel emparelha com o projetor trocando um código, como imagens QR, fotografia do código ou texto colado; sem conta, sem servidor de sinalização, sem rastreamento. Por omissão, nada sai da rede local.',
      'Cinco atividades: um temporizador de contagem decrescente; uma sondagem com barras em direto e um CSV do resultado; um questionário (ficheiros de perguntas JSON, texto simples ou CSV, bónus de rapidez, classificação, um CSV das pontuações, até cinco conjuntos guardados no dispositivo) em que a resposta certa fica no projetor até ser revelada; notas autocolantes de todos os telemóveis com exportação em texto; um quadro branco com uma cor por telemóvel e exportação PNG.',
      'Controlos do professor: bloquear ou desbloquear um telemóvel ou todos, remover um telemóvel, ecrã inteiro, manter o ecrã ligado, terminar a sessão. Um telemóvel que sai e volta recupera o nome e a cor.',
      'Cada dispositivo tem a sua própria língua (oito) e o seu próprio aspeto: claro ou escuro, alto contraste, texto grande.',
      'Uma API de widgets e um modelo de permissões documentado (`docs/widget-api.md`, `docs/sandbox.md`): uma atividade nova é um descritor em `data/widgets/` mais um script em `widgets/`.',
      'Suporte para teclado e leitores de ecrã, alvos táteis grandes, disposição para ecrãs estreitos de telemóvel; sem rastreamento, sem contas, funciona offline.'
    ],
    de: [
      'Zwei Rollen in einer Seite: am Projektor (zeigt den gemeinsamen Bildschirm und steuert die Aktivitäten) und als Telefon (tritt bei und macht mit). Eine Sitzung fasst bis zu 30 Telefone.',
      'Kopplung ohne Server: Jedes Telefon wird mit dem Projektor gekoppelt, indem ein Code ausgetauscht wird, als QR-Bilder, Foto des Codes oder eingefügter Text; kein Konto, kein Signalisierungsserver, kein Tracking. Standardmäßig verlässt nichts das lokale Netz.',
      'Fünf Aktivitäten: ein Countdown-Timer; eine Umfrage mit Live-Balken und einer CSV des Ergebnisses; ein Quiz (Fragedateien als JSON, einfacher Text oder CSV, Tempobonus, Rangliste, eine CSV der Punkte, bis zu fünf auf dem Gerät gespeicherte Sätze), bei dem die richtige Antwort bis zur Auflösung auf dem Projektor bleibt; Haftnotizen von allen Telefonen mit Textexport; ein Whiteboard mit einer Farbe pro Telefon und PNG-Export.',
      'Steuerung für die Lehrkraft: ein Telefon oder alle sperren und entsperren, ein Telefon entfernen, Vollbild, Bildschirm anlassen, Sitzung beenden. Ein Telefon, das ausfällt und zurückkehrt, bekommt Namen und Farbe zurück.',
      'Jedes Gerät hat seine eigene Sprache (acht) und sein eigenes Aussehen: hell oder dunkel, hoher Kontrast, große Schrift.',
      'Eine Widget-API und ein dokumentiertes Berechtigungsmodell (`docs/widget-api.md`, `docs/sandbox.md`): Eine neue Aktivität besteht aus einem Descriptor in `data/widgets/` und einem Skript in `widgets/`.',
      'Unterstützung für Tastatur und Screenreader, große Touch-Ziele, Layout für schmale Handy-Bildschirme; kein Tracking, keine Konten, funktioniert offline.'
    ],
    hu: [
      'Két szerep egyetlen oldalon: a kivetítőnél (megjeleníti a közös képernyőt és vezérli a tevékenységeket) és telefonként (csatlakozik és részt vesz). Egy munkamenet legfeljebb 30 telefont fogad.',
      'Szervermentes párosítás: minden telefon kód cseréjével párosodik a kivetítővel, QR-képkockákkal, a kód fényképével vagy beillesztett szöveggel; fiók, jelzőszerver és követés nélkül. Alapértelmezés szerint semmi nem hagyja el a helyi hálózatot.',
      'Öt tevékenység: visszaszámláló időzítő; szavazás élő oszlopokkal és az eredmény CSV-jével; kvíz (JSON, egyszerű szöveg vagy CSV kérdésfájlok, gyorsasági bónusz, ranglista, a pontok CSV-je, legfeljebb öt, az eszközön mentett készlet), amelyben a helyes válasz a felfedésig a kivetítőn marad; jegyzetpapírok minden telefonról szöveges exporttal; tábla telefononként más színnel és PNG-exporttal.',
      'Tanári vezérlők: egy telefon vagy az összes zárolása és feloldása, telefon eltávolítása, teljes képernyő, a képernyő bekapcsolva tartása, a munkamenet befejezése. A kieső, majd visszatérő telefon visszakapja nevét és színét.',
      'Minden eszköznek saját nyelve (nyolc) és saját megjelenése van: világos vagy sötét, nagy kontraszt, nagy szöveg.',
      'Widget-API és dokumentált jogosultsági modell (`docs/widget-api.md`, `docs/sandbox.md`): egy új tevékenység egy leíró a `data/widgets/` mappában plusz egy szkript a `widgets/` mappában.',
      'Billentyűzet- és képernyőolvasó-támogatás, nagy érintési célpontok, keskeny telefonképernyőre szabott elrendezés; követés és fiókok nélkül, offline is működik.'
    ]
  };

  const how = {
    en: [
      '`node scripts/build.mjs` assembles the single `index.html` from `src/` (`engine.mjs` for the pure logic, `ui.js` for the interface, `sandbox.js` for the code that runs inside a frame, `i18n.mjs`, `app.css`, `sandbox.css`) and from `widgets/`; `--check` verifies that the page matches the sources, including the hash of every widget.',
      'The projector is the authority: a phone sends requests, and the projector checks the protocol version, names, widget ids, message sizes, rates and permissions before it uses anything (`docs/protocol.md`). Votes, answers and scores stay on the projector.',
      'Each activity runs in `<iframe sandbox="allow-scripts" srcdoc>`: no origin, a policy of `default-src \'none\'`, one private message channel and only the permissions its descriptor lists; the page itself allows no network request at all (`docs/sandbox.md`).',
      'Phones and projector talk over WebRTC data channels that are paired by hand (QR frames or pasted text); nothing goes through a server, and unless you enter a STUN server no request leaves the local network.',
      '`npm test` checks the engine, the protocol limits, the quiz importer, the widgets, the translations of the interface and of the widgets, the PWA files and the documentation; the hub’s browser test (`tests/proiector.test.mjs`) opens the page in real Chromium browsers with real WebRTC connections, a hostile widget and hostile phones. Development needs Node.js 24 or newer; the page itself needs a browser with ES2017 and WebRTC data channels.'
    ],
    ro: [
      '`node scripts/build.mjs` asamblează singurul `index.html` din `src/` (`engine.mjs` pentru logica pură, `ui.js` pentru interfață, `sandbox.js` pentru codul care rulează într-un cadru, `i18n.mjs`, `app.css`, `sandbox.css`) și din `widgets/`; `--check` verifică dacă pagina corespunde sursei, inclusiv hash-ul fiecărui widget.',
      'Proiectorul este autoritatea: telefonul trimite cereri, iar proiectorul verifică versiunea protocolului, numele, identificatorii de widget, mărimea mesajelor, ritmul și permisiunile înainte să folosească ceva (`docs/protocol.md`). Voturile, răspunsurile și scorurile rămân pe proiector.',
      'Fiecare activitate rulează într-un `<iframe sandbox="allow-scripts" srcdoc>`: fără origine, cu politica `default-src \'none\'`, un canal privat de mesaje și numai permisiunile din descriptor; pagina însăși nu permite nicio cerere de rețea (`docs/sandbox.md`).',
      'Telefoanele și proiectorul comunică prin canale de date WebRTC asociate manual (cadre QR sau text lipit); nimic nu trece printr-un server și, dacă nu introduci un server STUN, nicio cerere nu iese din rețeaua locală.',
      '`npm test` verifică motorul, limitele protocolului, importatorul de quiz, widgeturile, traducerile interfeței și ale widgeturilor, fișierele PWA și documentația; testul din browser al hubului (`tests/proiector.test.mjs`) deschide pagina în browsere Chromium reale, cu conexiuni WebRTC reale, un widget ostil și telefoane ostile. Dezvoltarea cere Node.js 24 sau mai nou; pagina însăși cere un browser cu ES2017 și canale de date WebRTC.'
    ],
    fr: [
      '`node scripts/build.mjs` assemble l’unique `index.html` à partir de `src/` (`engine.mjs` pour la logique pure, `ui.js` pour l’interface, `sandbox.js` pour le code qui s’exécute dans un cadre, `i18n.mjs`, `app.css`, `sandbox.css`) et de `widgets/` ; `--check` vérifie que la page correspond aux sources, y compris l’empreinte de chaque widget.',
      'Le projecteur fait autorité : un téléphone envoie des demandes, et le projecteur contrôle la version du protocole, les noms, les identifiants de widget, la taille des messages, le débit et les permissions avant d’utiliser quoi que ce soit (`docs/protocol.md`). Votes, réponses et scores restent sur le projecteur.',
      'Chaque activité s’exécute dans `<iframe sandbox="allow-scripts" srcdoc>` : sans origine, avec une politique `default-src \'none\'`, un canal de messages privé et seulement les permissions de son descripteur ; la page elle-même n’autorise aucune requête réseau (`docs/sandbox.md`).',
      'Les téléphones et le projecteur communiquent par des canaux de données WebRTC appairés à la main (images QR ou texte collé) ; rien ne passe par un serveur et, sans serveur STUN saisi par vous, aucune requête ne quitte le réseau local.',
      '`npm test` vérifie le moteur, les limites du protocole, l’importateur de quiz, les widgets, les traductions de l’interface et des widgets, les fichiers PWA et la documentation ; le test navigateur du hub (`tests/proiector.test.mjs`) ouvre la page dans de vrais navigateurs Chromium, avec de vraies connexions WebRTC, un widget hostile et des téléphones hostiles. Le développement demande Node.js 24 ou plus récent ; la page elle-même demande un navigateur avec ES2017 et les canaux de données WebRTC.'
    ],
    it: [
      '`node scripts/build.mjs` assembla l’unico `index.html` da `src/` (`engine.mjs` per la logica pura, `ui.js` per l’interfaccia, `sandbox.js` per il codice che gira in un frame, `i18n.mjs`, `app.css`, `sandbox.css`) e da `widgets/`; `--check` verifica che la pagina corrisponda ai sorgenti, compreso l’hash di ogni widget.',
      'Il proiettore è l’autorità: un telefono invia richieste e il proiettore controlla versione del protocollo, nomi, identificatori di widget, dimensione dei messaggi, frequenza e permessi prima di usare qualsiasi cosa (`docs/protocol.md`). Voti, risposte e punteggi restano sul proiettore.',
      'Ogni attività gira in `<iframe sandbox="allow-scripts" srcdoc>`: senza origine, con la policy `default-src \'none\'`, un canale di messaggi privato e solo i permessi del suo descrittore; la pagina stessa non consente alcuna richiesta di rete (`docs/sandbox.md`).',
      'Telefoni e proiettore comunicano tramite canali di dati WebRTC abbinati a mano (fotogrammi QR o testo incollato); nulla passa da un server e, se non inserisci un server STUN, nessuna richiesta esce dalla rete locale.',
      '`npm test` controlla il motore, i limiti del protocollo, l’importatore dei quiz, i widget, le traduzioni dell’interfaccia e dei widget, i file PWA e la documentazione; il test nel browser dell’hub (`tests/proiector.test.mjs`) apre la pagina in veri browser Chromium, con vere connessioni WebRTC, un widget ostile e telefoni ostili. Lo sviluppo richiede Node.js 24 o più recente; la pagina stessa richiede un browser con ES2017 e canali di dati WebRTC.'
    ],
    es: [
      '`node scripts/build.mjs` ensambla el único `index.html` a partir de `src/` (`engine.mjs` para la lógica pura, `ui.js` para la interfaz, `sandbox.js` para el código que se ejecuta en un marco, `i18n.mjs`, `app.css`, `sandbox.css`) y de `widgets/`; `--check` verifica que la página coincide con las fuentes, incluido el hash de cada widget.',
      'El proyector es la autoridad: un teléfono envía peticiones, y el proyector comprueba la versión del protocolo, los nombres, los identificadores de widget, el tamaño de los mensajes, el ritmo y los permisos antes de usar nada (`docs/protocol.md`). Los votos, las respuestas y las puntuaciones se quedan en el proyector.',
      'Cada actividad se ejecuta en `<iframe sandbox="allow-scripts" srcdoc>`: sin origen, con la política `default-src \'none\'`, un canal de mensajes privado y solo los permisos de su descriptor; la propia página no permite ninguna petición de red (`docs/sandbox.md`).',
      'Los teléfonos y el proyector se comunican por canales de datos WebRTC emparejados a mano (fotogramas QR o texto pegado); nada pasa por un servidor y, si no introduces un servidor STUN, ninguna petición sale de la red local.',
      '`npm test` comprueba el motor, los límites del protocolo, el importador de cuestionarios, los widgets, las traducciones de la interfaz y de los widgets, los archivos PWA y la documentación; la prueba en navegador del hub (`tests/proiector.test.mjs`) abre la página en navegadores Chromium reales, con conexiones WebRTC reales, un widget hostil y teléfonos hostiles. El desarrollo requiere Node.js 24 o posterior; la propia página requiere un navegador con ES2017 y canales de datos WebRTC.'
    ],
    pt: [
      '`node scripts/build.mjs` monta o único `index.html` a partir de `src/` (`engine.mjs` para a lógica pura, `ui.js` para a interface, `sandbox.js` para o código que corre num quadro, `i18n.mjs`, `app.css`, `sandbox.css`) e de `widgets/`; `--check` verifica que a página corresponde às fontes, incluindo o hash de cada widget.',
      'O projetor é a autoridade: um telemóvel envia pedidos, e o projetor verifica a versão do protocolo, os nomes, os identificadores de widget, o tamanho das mensagens, o ritmo e as permissões antes de usar seja o que for (`docs/protocol.md`). Votos, respostas e pontuações ficam no projetor.',
      'Cada atividade corre em `<iframe sandbox="allow-scripts" srcdoc>`: sem origem, com a política `default-src \'none\'`, um canal de mensagens privado e só as permissões do seu descritor; a própria página não permite qualquer pedido de rede (`docs/sandbox.md`).',
      'Os telemóveis e o projetor comunicam por canais de dados WebRTC emparelhados à mão (imagens QR ou texto colado); nada passa por um servidor e, se não introduzir um servidor STUN, nenhum pedido sai da rede local.',
      '`npm test` verifica o motor, os limites do protocolo, o importador de questionários, os widgets, as traduções da interface e dos widgets, os ficheiros PWA e a documentação; o teste no navegador do hub (`tests/proiector.test.mjs`) abre a página em navegadores Chromium reais, com ligações WebRTC reais, um widget hostil e telemóveis hostis. O desenvolvimento exige Node.js 24 ou mais recente; a própria página exige um navegador com ES2017 e canais de dados WebRTC.'
    ],
    de: [
      '`node scripts/build.mjs` baut die eine `index.html` aus `src/` (`engine.mjs` für die reine Logik, `ui.js` für die Oberfläche, `sandbox.js` für den Code im Frame, `i18n.mjs`, `app.css`, `sandbox.css`) und aus `widgets/`; `--check` prüft, dass die Seite zu den Quellen passt, einschließlich des Hashs jedes Widgets.',
      'Der Projektor entscheidet: Ein Telefon sendet Anfragen, und der Projektor prüft Protokollversion, Namen, Widget-IDs, Nachrichtengrößen, Raten und Berechtigungen, bevor er etwas verwendet (`docs/protocol.md`). Stimmen, Antworten und Punkte bleiben auf dem Projektor.',
      'Jede Aktivität läuft in `<iframe sandbox="allow-scripts" srcdoc>`: ohne Origin, mit der Richtlinie `default-src \'none\'`, einem privaten Nachrichtenkanal und nur den Berechtigungen aus ihrem Descriptor; die Seite selbst erlaubt keine einzige Netzwerkanfrage (`docs/sandbox.md`).',
      'Telefone und Projektor sprechen über WebRTC-Datenkanäle, die von Hand gekoppelt werden (QR-Bilder oder eingefügter Text); nichts läuft über einen Server, und ohne einen von dir eingetragenen STUN-Server verlässt keine Anfrage das lokale Netz.',
      '`npm test` prüft die Engine, die Protokollgrenzen, den Quiz-Import, die Widgets, die Übersetzungen der Oberfläche und der Widgets, die PWA-Dateien und die Dokumentation; der Browsertest des Hubs (`tests/proiector.test.mjs`) öffnet die Seite in echten Chromium-Browsern mit echten WebRTC-Verbindungen, einem feindlichen Widget und feindlichen Telefonen. Die Entwicklung braucht Node.js 24 oder neuer; die Seite selbst braucht einen Browser mit ES2017 und WebRTC-Datenkanälen.'
    ],
    hu: [
      'A `node scripts/build.mjs` az egyetlen `index.html` fájlt a `src/` mappából (`engine.mjs` a tiszta logikához, `ui.js` a felülethez, `sandbox.js` a keretben futó kódhoz, `i18n.mjs`, `app.css`, `sandbox.css`) és a `widgets/` mappából állítja össze; a `--check` ellenőrzi, hogy az oldal megegyezik a forrásokkal, minden widget hash-ét is beleértve.',
      'A kivetítő dönt: a telefon kéréseket küld, a kivetítő pedig ellenőrzi a protokollverziót, a neveket, a widget-azonosítókat, az üzenetek méretét, a küldési ütemet és a jogosultságokat, mielőtt bármit felhasználna (`docs/protocol.md`). A szavazatok, válaszok és pontszámok a kivetítőn maradnak.',
      'Minden tevékenység `<iframe sandbox="allow-scripts" srcdoc>` keretben fut: eredet nélkül, `default-src \'none\'` szabállyal, egy privát üzenetcsatornával és csak a leírójában felsorolt jogosultságokkal; maga az oldal egyetlen hálózati kérést sem enged (`docs/sandbox.md`).',
      'A telefonok és a kivetítő kézzel párosított WebRTC-adatcsatornákon beszélnek (QR-képkockák vagy beillesztett szöveg); semmi nem megy át szerveren, és ha nem adsz meg STUN-szervert, egyetlen kérés sem hagyja el a helyi hálózatot.',
      'Az `npm test` ellenőrzi a motort, a protokoll korlátait, a kvízimportálót, a widgeteket, a felület és a widgetek fordításait, a PWA-fájlokat és a dokumentációt; a hub böngészős tesztje (`tests/proiector.test.mjs`) valódi Chromium böngészőkben nyitja meg az oldalt, valódi WebRTC-kapcsolatokkal, egy ellenséges widgettel és ellenséges telefonokkal. A fejlesztéshez Node.js 24 vagy újabb kell; maga az oldal ES2017-et és WebRTC-adatcsatornákat tudó böngészőt igényel.'
    ]
  };

  const limits = {
    en: [
      'Alpha: no real phone or tablet, and no browser other than Chromium, has run it; everything was tested in Chromium with real WebRTC connections on one machine (`docs/compat.md`).',
      'By default pairing works only on the same local network. A STUN server you enter may allow it across networks (not tried here), but there is no relay (no TURN), so guest Wi-Fi that isolates devices, VPNs and many school, corporate and mobile networks can still block it. Each phone needs its own exchange of codes, so adding a whole class takes a few minutes.',
      'Pairing shows each device’s IP address to the other (the dialog asks first). The channel is encrypted, but the identity of the other device is not verified: pair only in your own room.',
      'The sandbox does not stop a hostile activity from freezing its own frame (in some browsers the whole tab), and an activity can use its private channel up to its limits. Add only activities whose source you have read (`docs/sandbox.md`).',
      'The quiz reads JSON, plain-text and CSV files. The “Undava” format asked for in the first plan was not found documented anywhere and has not been tested against real Undava files (`docs/quiz-format.md`).',
      'Between sessions a device keeps only its own settings (name, high contrast, large text) and the quiz sets you choose to save; results, notes and drawings are not kept unless you download them. A projector that reloads the page ends the session and the phones must pair again.',
      'A session holds up to 30 phones, which the engine enforces; the browser tests used at most three real connections.',
      'The interface and the activities exist in eight languages; those in French, Italian, Spanish, Portuguese, German and Hungarian were translated by software and have not been reviewed by native speakers.'
    ],
    ro: [
      'Alfa: nicio încercare pe un telefon sau o tabletă reală și în niciun alt browser decât Chromium; totul a fost testat în Chromium, cu conexiuni WebRTC reale pe o singură mașină (`docs/compat.md`).',
      'Implicit, asocierea merge doar în aceeași rețea locală. Un server STUN introdus de tine ar putea-o permite între rețele (neîncercat aici), dar nu există releu (fără TURN), așa că Wi-Fi-ul pentru oaspeți care izolează dispozitivele, VPN-urile și multe rețele școlare, corporative și mobile o pot totuși bloca. Fiecare telefon cere propriul schimb de coduri, deci adăugarea unei clase întregi durează câteva minute.',
      'Asocierea arată adresa IP a fiecărui dispozitiv celuilalt (dialogul întreabă mai întâi). Canalul este criptat, dar identitatea celuilalt dispozitiv nu este verificată: asociază doar în propria sală.',
      'Sandbox-ul nu împiedică o activitate ostilă să-și blocheze propriul cadru (în unele browsere, toată fila), iar o activitate își poate folosi canalul privat până la limitele sale. Adaugă doar activități a căror sursă ai citit-o (`docs/sandbox.md`).',
      'Quiz-ul citește fișiere JSON, text simplu și CSV. Formatul „Undava” cerut în planul inițial nu a fost găsit documentat nicăieri și nu a fost testat cu fișiere Undava reale (`docs/quiz-format.md`).',
      'Între sesiuni, un dispozitiv păstrează doar propriile setări (nume, contrast ridicat, text mare) și seturile de quiz pe care alegi să le salvezi; rezultatele, bilețelele și desenele nu se păstrează dacă nu le descarci. Un proiector care reîncarcă pagina încheie sesiunea, iar telefoanele trebuie asociate din nou.',
      'O sesiune ține până la 30 de telefoane, limită impusă de motor; testele din browser au folosit cel mult trei conexiuni reale.',
      'Interfața și activitățile există în opt limbi; cele în franceză, italiană, spaniolă, portugheză, germană și maghiară au fost traduse automat și nu au fost verificate de vorbitori nativi.'
    ],
    fr: [
      'Alpha : aucun vrai téléphone ni vraie tablette, et aucun navigateur autre que Chromium, ne l’a fait tourner ; tout a été testé dans Chromium, avec de vraies connexions WebRTC sur une seule machine (`docs/compat.md`).',
      'Par défaut, l’appairage ne marche que sur le même réseau local. Un serveur STUN que vous saisissez peut le permettre entre réseaux (non essayé ici), mais il n’y a pas de relais (pas de TURN) : le Wi-Fi invité qui isole les appareils, les VPN et de nombreux réseaux scolaires, d’entreprise et mobiles peuvent donc encore le bloquer. Chaque téléphone demande son propre échange de codes, donc ajouter une classe entière prend quelques minutes.',
      'L’appairage montre l’adresse IP de chaque appareil à l’autre (la boîte de dialogue demande d’abord). Le canal est chiffré, mais l’identité de l’autre appareil n’est pas vérifiée : n’appairez que dans votre propre salle.',
      'Le bac à sable n’empêche pas une activité hostile de figer son propre cadre (dans certains navigateurs, tout l’onglet), et une activité peut utiliser son canal privé jusqu’à ses limites. N’ajoutez que des activités dont vous avez lu le code source (`docs/sandbox.md`).',
      'Le quiz lit des fichiers JSON, texte simple et CSV. Le format « Undava » demandé dans le premier plan n’a été trouvé documenté nulle part et n’a pas été testé avec de vrais fichiers Undava (`docs/quiz-format.md`).',
      'D’une session à l’autre, un appareil ne conserve que ses propres réglages (nom, fort contraste, grand texte) et les séries de quiz que vous choisissez d’enregistrer ; les résultats, les notes et les dessins ne sont pas conservés si vous ne les téléchargez pas. Un projecteur qui recharge la page met fin à la session et les téléphones doivent être appairés de nouveau.',
      'Une session accueille jusqu’à 30 téléphones, limite imposée par le moteur ; les tests dans le navigateur ont utilisé au plus trois connexions réelles.',
      'L’interface et les activités existent en huit langues ; celles en français, italien, espagnol, portugais, allemand et hongrois ont été traduites automatiquement et n’ont pas été relues par des locuteurs natifs.'
    ],
    it: [
      'Alpha: nessun telefono o tablet reale, e nessun browser diverso da Chromium, l’ha mai eseguita; tutto è stato provato in Chromium, con vere connessioni WebRTC su una sola macchina (`docs/compat.md`).',
      'Per impostazione predefinita l’abbinamento funziona solo nella stessa rete locale. Un server STUN che inserisci potrebbe consentirlo tra reti diverse (non provato qui), ma non c’è un relay (niente TURN): il Wi-Fi ospiti che isola i dispositivi, le VPN e molte reti scolastiche, aziendali e mobili possono quindi ancora bloccarlo. Ogni telefono richiede il proprio scambio di codici, quindi aggiungere una classe intera richiede qualche minuto.',
      'L’abbinamento mostra l’indirizzo IP di ciascun dispositivo all’altro (la finestra lo chiede prima). Il canale è cifrato, ma l’identità dell’altro dispositivo non è verificata: abbina solo nella tua aula.',
      'La sandbox non impedisce a un’attività ostile di bloccare il proprio frame (in alcuni browser l’intera scheda), e un’attività può usare il suo canale privato fino ai propri limiti. Aggiungi solo attività di cui hai letto il codice sorgente (`docs/sandbox.md`).',
      'Il quiz legge file JSON, testo semplice e CSV. Il formato «Undava» richiesto nel primo piano non è stato trovato documentato da nessuna parte e non è stato provato con veri file Undava (`docs/quiz-format.md`).',
      'Tra una sessione e l’altra un dispositivo conserva solo le proprie impostazioni (nome, alto contrasto, testo grande) e i set di quiz che scegli di salvare; risultati, foglietti e disegni non vengono conservati se non li scarichi. Un proiettore che ricarica la pagina chiude la sessione e i telefoni devono essere abbinati di nuovo.',
      'Una sessione ospita fino a 30 telefoni, limite imposto dal motore; i test nel browser hanno usato al massimo tre connessioni reali.',
      'L’interfaccia e le attività esistono in otto lingue; quelle in francese, italiano, spagnolo, portoghese, tedesco e ungherese sono state tradotte automaticamente e non sono state riviste da madrelingua.'
    ],
    es: [
      'Alfa: ningún teléfono ni tableta reales, y ningún navegador distinto de Chromium, la ha ejecutado; todo se probó en Chromium, con conexiones WebRTC reales en una sola máquina (`docs/compat.md`).',
      'De forma predeterminada, el emparejamiento solo funciona en la misma red local. Un servidor STUN que introduzcas podría permitirlo entre redes (no probado aquí), pero no hay relé (sin TURN), así que el Wi-Fi de invitados que aísla los dispositivos, las VPN y muchas redes escolares, corporativas y móviles aún pueden bloquearlo. Cada teléfono necesita su propio intercambio de códigos, de modo que añadir una clase entera lleva unos minutos.',
      'El emparejamiento muestra la dirección IP de cada dispositivo al otro (el diálogo pregunta antes). El canal está cifrado, pero la identidad del otro dispositivo no se verifica: empareja solo en tu propia sala.',
      'El entorno aislado no impide que una actividad hostil congele su propio marco (en algunos navegadores, toda la pestaña), y una actividad puede usar su canal privado hasta sus límites. Añade solo actividades cuyo código fuente hayas leído (`docs/sandbox.md`).',
      'El cuestionario lee archivos JSON, texto simple y CSV. El formato «Undava» pedido en el primer plan no se encontró documentado en ninguna parte y no se ha probado con archivos Undava reales (`docs/quiz-format.md`).',
      'Entre sesiones, un dispositivo conserva solo sus propios ajustes (nombre, alto contraste, texto grande) y los conjuntos de cuestionarios que elijas guardar; los resultados, las notas y los dibujos no se conservan si no los descargas. Un proyector que recarga la página termina la sesión y los teléfonos deben emparejarse de nuevo.',
      'Una sesión admite hasta 30 teléfonos, límite impuesto por el motor; las pruebas en navegador usaron como máximo tres conexiones reales.',
      'La interfaz y las actividades existen en ocho idiomas; las de francés, italiano, español, portugués, alemán y húngaro se tradujeron automáticamente y no las han revisado hablantes nativos.'
    ],
    pt: [
      'Alfa: nenhum telemóvel ou tablet real, e nenhum navegador que não o Chromium, a executou; tudo foi testado no Chromium, com ligações WebRTC reais numa só máquina (`docs/compat.md`).',
      'Por predefinição, o emparelhamento só funciona na mesma rede local. Um servidor STUN que introduza poderá permiti-lo entre redes (não experimentado aqui), mas não há retransmissão (sem TURN), por isso o Wi-Fi de convidados que isola os dispositivos, as VPN e muitas redes escolares, empresariais e móveis ainda o podem bloquear. Cada telemóvel precisa da sua própria troca de códigos, pelo que juntar uma turma inteira leva alguns minutos.',
      'O emparelhamento mostra o endereço IP de cada dispositivo ao outro (a caixa de diálogo pergunta primeiro). O canal é cifrado, mas a identidade do outro dispositivo não é verificada: emparelhe apenas na sua própria sala.',
      'A sandbox não impede que uma atividade hostil congele o seu próprio quadro (em alguns navegadores, o separador inteiro), e uma atividade pode usar o seu canal privado até aos seus limites. Adicione apenas atividades cujo código-fonte tenha lido (`docs/sandbox.md`).',
      'O questionário lê ficheiros JSON, texto simples e CSV. O formato «Undava» pedido no primeiro plano não foi encontrado documentado em lado nenhum e não foi testado com ficheiros Undava reais (`docs/quiz-format.md`).',
      'Entre sessões, um dispositivo guarda apenas as suas próprias definições (nome, alto contraste, texto grande) e os conjuntos de questionários que escolher guardar; os resultados, as notas e os desenhos não são guardados se não os descarregar. Um projetor que recarrega a página termina a sessão e os telemóveis têm de ser emparelhados de novo.',
      'Uma sessão aceita até 30 telemóveis, limite imposto pelo motor; os testes no navegador usaram, no máximo, três ligações reais.',
      'A interface e as atividades existem em oito línguas; as de francês, italiano, espanhol, português, alemão e húngaro foram traduzidas automaticamente e não foram revistas por falantes nativos.'
    ],
    de: [
      'Alpha: Kein echtes Telefon und kein Tablet und kein anderer Browser als Chromium hat sie bisher ausgeführt; alles wurde in Chromium mit echten WebRTC-Verbindungen auf einem einzigen Rechner getestet (`docs/compat.md`).',
      'Standardmäßig funktioniert die Kopplung nur im selben lokalen Netz. Ein von dir eingetragener STUN-Server könnte sie netzübergreifend ermöglichen (hier nicht ausprobiert), aber es gibt kein Relay (kein TURN), daher können Gast-WLANs, die Geräte voneinander trennen, VPNs und viele Schul-, Firmen- und Mobilfunknetze sie weiterhin blockieren. Jedes Telefon braucht seinen eigenen Codeaustausch, eine ganze Klasse hinzuzufügen dauert also einige Minuten.',
      'Die Kopplung zeigt dem anderen Gerät die IP-Adresse jedes Geräts (der Dialog fragt vorher). Der Kanal ist verschlüsselt, die Identität des anderen Geräts wird aber nicht geprüft: Koppele nur in deinem eigenen Raum.',
      'Die Sandbox hindert eine feindliche Aktivität nicht daran, ihren eigenen Frame einzufrieren (in manchen Browsern den ganzen Tab), und eine Aktivität kann ihren privaten Kanal bis zu ihren Grenzen nutzen. Füge nur Aktivitäten hinzu, deren Quelltext du gelesen hast (`docs/sandbox.md`).',
      'Das Quiz liest JSON-, Klartext- und CSV-Dateien. Das im ersten Plan verlangte „Undava“-Format wurde nirgends dokumentiert gefunden und nicht mit echten Undava-Dateien getestet (`docs/quiz-format.md`).',
      'Zwischen Sitzungen behält ein Gerät nur seine eigenen Einstellungen (Name, hoher Kontrast, große Schrift) und die Quizsätze, die du speicherst; Ergebnisse, Notizen und Zeichnungen bleiben nicht erhalten, wenn du sie nicht herunterlädst. Ein Projektor, der die Seite neu lädt, beendet die Sitzung, und die Telefone müssen neu gekoppelt werden.',
      'Eine Sitzung fasst bis zu 30 Telefone, was die Engine erzwingt; die Browsertests nutzten höchstens drei echte Verbindungen.',
      'Oberfläche und Aktivitäten gibt es in acht Sprachen; die auf Französisch, Italienisch, Spanisch, Portugiesisch, Deutsch und Ungarisch wurden maschinell übersetzt und nicht von Muttersprachlern geprüft.'
    ],
    hu: [
      'Alfa: egyetlen valódi telefonon vagy táblagépen, és a Chromiumon kívül egyetlen böngészőben sem futott; mindent Chromiumban teszteltünk, valódi WebRTC-kapcsolatokkal egyetlen gépen (`docs/compat.md`).',
      'Alapértelmezés szerint a párosítás csak ugyanazon a helyi hálózaton működik. Egy általad megadott STUN-szerver talán lehetővé teszi hálózatok között is (ezt itt nem próbáltuk ki), de nincs továbbító (TURN), ezért a vendég Wi-Fi, amely elszigeteli az eszközöket, a VPN, valamint sok iskolai, vállalati és mobilhálózat így is blokkolhatja. Minden telefonhoz külön kódcsere kell, ezért egy egész osztály hozzáadása néhány percig tart.',
      'A párosítás megmutatja minden eszköz IP-címét a másiknak (a párbeszédablak előbb rákérdez). A csatorna titkosított, de a másik eszköz kilétét nem ellenőrzi senki: csak a saját termedben párosíts.',
      'A homokozó nem akadályozza meg, hogy egy ellenséges tevékenység lefagyassza a saját keretét (egyes böngészőkben az egész lapot), és egy tevékenység a korlátaiig használhatja a privát csatornáját. Csak olyan tevékenységet adj hozzá, amelynek a forrását elolvastad (`docs/sandbox.md`).',
      'A kvíz JSON, egyszerű szöveg és CSV fájlokat olvas. Az első tervben kért „Undava” formátumot sehol nem találtuk dokumentálva, és valódi Undava fájlokkal nem teszteltük (`docs/quiz-format.md`).',
      'Munkamenetek között egy eszköz csak a saját beállításait (név, nagy kontraszt, nagy szöveg) és az általad elmentett kvízkészleteket őrzi meg; az eredmények, a cetlik és a rajzok nem maradnak meg, ha nem töltöd le őket. Az oldalt újratöltő kivetítő befejezi a munkamenetet, és a telefonokat újra párosítani kell.',
      'Egy munkamenet legfeljebb 30 telefont fogad, ezt a motor kényszeríti ki; a böngészős tesztek legfeljebb három valódi kapcsolatot használtak.',
      'A felület és a tevékenységek nyolc nyelven érhetők el; a francia, olasz, spanyol, portugál, német és magyar szöveget géppel fordítottuk, anyanyelvi beszélők nem nézték át.'
    ]
  };

  const steps = {
    en: [
      '1. Fork this repository.',
      '2. Copy `data/widgets/example.json` to `data/widgets/<id>.json` and edit it (schema in `schema.json`), then run `python scripts/validate.py`.',
      '3. Write `widgets/<id>/index.js` (see `docs/widget-api.md`): `export function mount(container, api)` and `strings` in all eight languages.',
      '4. Test the pure functions in `test/widgets.test.mjs`, then run `npm test` and `node scripts/build.mjs`.',
      '5. Open a pull request with the regenerated `index.html`.'
    ].join('\n'),
    ro: [
      '1. Fă fork acestui depozit.',
      '2. Copiază `data/widgets/example.json` în `data/widgets/<id>.json` și editează-l (schema este în `schema.json`), apoi rulează `python scripts/validate.py`.',
      '3. Scrie `widgets/<id>/index.js` (vezi `docs/widget-api.md`): `export function mount(container, api)` și `strings` în toate cele opt limbi.',
      '4. Testează funcțiile pure în `test/widgets.test.mjs`, apoi rulează `npm test` și `node scripts/build.mjs`.',
      '5. Deschide un pull request cu `index.html` regenerat.'
    ].join('\n'),
    fr: [
      '1. Forkez ce dépôt.',
      '2. Copiez `data/widgets/example.json` vers `data/widgets/<id>.json` et modifiez-le (schéma dans `schema.json`), puis lancez `python scripts/validate.py`.',
      '3. Écrivez `widgets/<id>/index.js` (voir `docs/widget-api.md`) : `export function mount(container, api)` et `strings` dans les huit langues.',
      '4. Testez les fonctions pures dans `test/widgets.test.mjs`, puis lancez `npm test` et `node scripts/build.mjs`.',
      '5. Ouvrez une pull request avec le `index.html` régénéré.'
    ].join('\n'),
    it: [
      '1. Fai il fork di questo repository.',
      '2. Copia `data/widgets/example.json` in `data/widgets/<id>.json` e modificalo (schema in `schema.json`), poi esegui `python scripts/validate.py`.',
      '3. Scrivi `widgets/<id>/index.js` (vedi `docs/widget-api.md`): `export function mount(container, api)` e `strings` in tutte e otto le lingue.',
      '4. Testa le funzioni pure in `test/widgets.test.mjs`, poi esegui `npm test` e `node scripts/build.mjs`.',
      '5. Apri una pull request con l’`index.html` rigenerato.'
    ].join('\n'),
    es: [
      '1. Haz un fork de este repositorio.',
      '2. Copia `data/widgets/example.json` en `data/widgets/<id>.json` y edítalo (esquema en `schema.json`), y luego ejecuta `python scripts/validate.py`.',
      '3. Escribe `widgets/<id>/index.js` (consulta `docs/widget-api.md`): `export function mount(container, api)` y `strings` en los ocho idiomas.',
      '4. Prueba las funciones puras en `test/widgets.test.mjs`, y luego ejecuta `npm test` y `node scripts/build.mjs`.',
      '5. Abre un pull request con el `index.html` regenerado.'
    ].join('\n'),
    pt: [
      '1. Faça um fork deste repositório.',
      '2. Copie `data/widgets/example.json` para `data/widgets/<id>.json` e edite-o (esquema em `schema.json`), e depois execute `python scripts/validate.py`.',
      '3. Escreva `widgets/<id>/index.js` (veja `docs/widget-api.md`): `export function mount(container, api)` e `strings` nas oito línguas.',
      '4. Teste as funções puras em `test/widgets.test.mjs` e depois execute `npm test` e `node scripts/build.mjs`.',
      '5. Abra um pull request com o `index.html` regenerado.'
    ].join('\n'),
    de: [
      '1. Forke dieses Repository.',
      '2. Kopiere `data/widgets/example.json` nach `data/widgets/<id>.json` und bearbeite die Datei (Schema in `schema.json`), dann führe `python scripts/validate.py` aus.',
      '3. Schreibe `widgets/<id>/index.js` (siehe `docs/widget-api.md`): `export function mount(container, api)` und `strings` in allen acht Sprachen.',
      '4. Teste die reinen Funktionen in `test/widgets.test.mjs`, dann führe `npm test` und `node scripts/build.mjs` aus.',
      '5. Öffne einen Pull Request mit der neu erzeugten `index.html`.'
    ].join('\n'),
    hu: [
      '1. Forkold ezt a tárolót.',
      '2. Másold a `data/widgets/example.json` fájlt `data/widgets/<id>.json` néven, és szerkeszd (a séma a `schema.json` fájlban van), majd futtasd: `python scripts/validate.py`.',
      '3. Írd meg a `widgets/<id>/index.js` fájlt (lásd `docs/widget-api.md`): `export function mount(container, api)` és `strings` mind a nyolc nyelven.',
      '4. Teszteld a tiszta függvényeket a `test/widgets.test.mjs` fájlban, majd futtasd: `npm test` és `node scripts/build.mjs`.',
      '5. Nyiss egy pull requestet az újragenerált `index.html` fájllal.'
    ].join('\n')
  };

  const firstRule = {
    en: 'One activity = one descriptor (`data/widgets/<id>.json`) + one widget (`widgets/<id>/index.js`) + tests.',
    ro: 'O activitate = un descriptor (`data/widgets/<id>.json`) + un widget (`widgets/<id>/index.js`) + teste.',
    fr: 'Une activité = un descripteur (`data/widgets/<id>.json`) + un widget (`widgets/<id>/index.js`) + des tests.',
    it: 'Un’attività = un descrittore (`data/widgets/<id>.json`) + un widget (`widgets/<id>/index.js`) + test.',
    es: 'Una actividad = un descriptor (`data/widgets/<id>.json`) + un widget (`widgets/<id>/index.js`) + pruebas.',
    pt: 'Uma atividade = um descritor (`data/widgets/<id>.json`) + um widget (`widgets/<id>/index.js`) + testes.',
    de: 'Eine Aktivität = ein Descriptor (`data/widgets/<id>.json`) + ein Widget (`widgets/<id>/index.js`) + Tests.',
    hu: 'Egy tevékenység = egy leíró (`data/widgets/<id>.json`) + egy widget (`widgets/<id>/index.js`) + tesztek.'
  };

  const contribHeading = {en: 'Adding an activity', ro: 'Adăugarea unei activități', fr: 'Ajouter une activité', it: 'Aggiungere un’attività', es: 'Añadir una actividad', pt: 'Acrescentar uma atividade', de: 'Eine Aktivität hinzufügen', hu: 'Tevékenység hozzáadása'};
  const contribBody = {
    en: [
      '1. Add `data/widgets/<id>.json` (start from `data/widgets/example.json`; schema in `schema.json`) and run `python scripts/validate.py`. The `id`, the file name, the directory under `widgets/` and `entry` must agree. List the fewest `permissions` that work: `none`, `drawing`, `storage` or `download`; `camera` and `microphone` are reserved and rejected (see `docs/sandbox.md`).',
      '2. Write `widgets/<id>/index.js` as an ES module (ES2017 syntax, no imports) with `export function mount(container, api)` and `export const strings` in all eight languages (see `docs/widget-api.md`). No network, no browser storage, no `parent`, no `eval`, no HTML built from text: `npm test` refuses them, and the builder refuses `<!--`, `<script` and `</script` in the source.',
      '3. Treat every message from a phone as untrusted: check types, ranges and lengths on the projector, keep right answers and scores there, and send phones only what they need. A change to a message shape or to a limit in `src/engine.mjs` means raising `PROTO` and updating `docs/protocol.md` (a test compares its table with the code).',
      '4. Style the widget in `widgets/<id>/style.css` with a class prefix of your own and the theme variables. Keep touch targets of at least 44 pixels, a visible focus, a label for every control and live announcements (`api.announce`) for what changes on screen; check high contrast and large text.',
      '5. Write tests in `test/widgets.test.mjs` for the pure functions you export, with invented data only, and run `npm test`.',
      '6. Run `node scripts/build.mjs` and commit the regenerated `index.html`, `sw.js` and `app.json` together with `src/` and `widgets/`.'
    ].join('\n'),
    ro: [
      '1. Adaugă `data/widgets/<id>.json` (pornește de la `data/widgets/example.json`; schema este în `schema.json`) și rulează `python scripts/validate.py`. `id`-ul, numele fișierului, directorul din `widgets/` și `entry` trebuie să coincidă. Listează cele mai puține `permissions` care merg: `none`, `drawing`, `storage` sau `download`; `camera` și `microphone` sunt rezervate și respinse (vezi `docs/sandbox.md`).',
      '2. Scrie `widgets/<id>/index.js` ca modul ES (sintaxă ES2017, fără importuri) cu `export function mount(container, api)` și `export const strings` în toate cele opt limbi (vezi `docs/widget-api.md`). Fără rețea, fără stocarea browserului, fără `parent`, fără `eval`, fără HTML construit din text: `npm test` le refuză, iar constructorul refuză `<!--`, `<script` și `</script` în sursă.',
      '3. Tratează orice mesaj de la un telefon ca nesigur: verifică tipurile, intervalele și lungimile pe proiector, păstrează acolo răspunsurile corecte și scorurile și trimite telefoanelor doar ce le trebuie. O schimbare a formei unui mesaj sau a unei limite din `src/engine.mjs` înseamnă creșterea lui `PROTO` și actualizarea `docs/protocol.md` (un test compară tabelul lui cu codul).',
      '4. Stilizează widgetul în `widgets/<id>/style.css` cu un prefix propriu pentru clase și cu variabilele temei. Păstrează ținte tactile de cel puțin 44 de pixeli, focalizare vizibilă, o etichetă pentru fiecare control și anunțuri (`api.announce`) pentru ce se schimbă pe ecran; verifică contrastul ridicat și textul mare.',
      '5. Scrie teste în `test/widgets.test.mjs` pentru funcțiile pure pe care le exporți, doar cu date inventate, și rulează `npm test`.',
      '6. Rulează `node scripts/build.mjs` și comite `index.html`, `sw.js` și `app.json` regenerate, împreună cu `src/` și `widgets/`.'
    ].join('\n'),
    fr: [
      '1. Ajoutez `data/widgets/<id>.json` (partez de `data/widgets/example.json` ; schéma dans `schema.json`) et lancez `python scripts/validate.py`. L’`id`, le nom du fichier, le répertoire sous `widgets/` et `entry` doivent concorder. Listez le moins de `permissions` possible : `none`, `drawing`, `storage` ou `download` ; `camera` et `microphone` sont réservées et refusées (voir `docs/sandbox.md`).',
      '2. Écrivez `widgets/<id>/index.js` comme module ES (syntaxe ES2017, sans imports) avec `export function mount(container, api)` et `export const strings` dans les huit langues (voir `docs/widget-api.md`). Pas de réseau, pas de stockage du navigateur, pas de `parent`, pas de `eval`, pas de HTML construit à partir de texte : `npm test` les refuse, et le constructeur refuse `<!--`, `<script` et `</script` dans la source.',
      '3. Considérez tout message d’un téléphone comme non fiable : vérifiez types, plages et longueurs sur le projecteur, gardez-y les bonnes réponses et les scores, et n’envoyez aux téléphones que ce dont ils ont besoin. Changer la forme d’un message ou une limite dans `src/engine.mjs` implique d’augmenter `PROTO` et de mettre à jour `docs/protocol.md` (un test compare son tableau avec le code).',
      '4. Stylez le widget dans `widgets/<id>/style.css` avec un préfixe de classe qui vous est propre et les variables du thème. Gardez des cibles tactiles d’au moins 44 pixels, un focus visible, une étiquette pour chaque contrôle et des annonces (`api.announce`) pour ce qui change à l’écran ; vérifiez le fort contraste et le grand texte.',
      '5. Écrivez des tests dans `test/widgets.test.mjs` pour les fonctions pures que vous exportez, avec des données inventées uniquement, et lancez `npm test`.',
      '6. Lancez `node scripts/build.mjs` et validez (commit) `index.html`, `sw.js` et `app.json` régénérés avec `src/` et `widgets/`.'
    ].join('\n'),
    it: [
      '1. Aggiungi `data/widgets/<id>.json` (parti da `data/widgets/example.json`; schema in `schema.json`) ed esegui `python scripts/validate.py`. L’`id`, il nome del file, la directory sotto `widgets/` e `entry` devono coincidere. Elenca il minor numero possibile di `permissions`: `none`, `drawing`, `storage` o `download`; `camera` e `microphone` sono riservate e respinte (vedi `docs/sandbox.md`).',
      '2. Scrivi `widgets/<id>/index.js` come modulo ES (sintassi ES2017, senza import) con `export function mount(container, api)` ed `export const strings` in tutte e otto le lingue (vedi `docs/widget-api.md`). Niente rete, niente archiviazione del browser, niente `parent`, niente `eval`, niente HTML costruito da testo: `npm test` li rifiuta, e il builder rifiuta `<!--`, `<script` e `</script` nel sorgente.',
      '3. Tratta ogni messaggio di un telefono come non attendibile: controlla tipi, intervalli e lunghezze sul proiettore, tieni lì le risposte giuste e i punteggi, e invia ai telefoni solo ciò che serve. Cambiare la forma di un messaggio o un limite in `src/engine.mjs` significa aumentare `PROTO` e aggiornare `docs/protocol.md` (un test confronta la sua tabella con il codice).',
      '4. Dai uno stile al widget in `widgets/<id>/style.css` con un prefisso di classe tuo e le variabili del tema. Mantieni bersagli touch di almeno 44 pixel, un focus visibile, un’etichetta per ogni controllo e annunci (`api.announce`) per ciò che cambia sullo schermo; verifica l’alto contrasto e il testo grande.',
      '5. Scrivi test in `test/widgets.test.mjs` per le funzioni pure che esporti, solo con dati inventati, ed esegui `npm test`.',
      '6. Esegui `node scripts/build.mjs` e fai il commit di `index.html`, `sw.js` e `app.json` rigenerati insieme a `src/` e `widgets/`.'
    ].join('\n'),
    es: [
      '1. Añade `data/widgets/<id>.json` (parte de `data/widgets/example.json`; esquema en `schema.json`) y ejecuta `python scripts/validate.py`. El `id`, el nombre del archivo, el directorio bajo `widgets/` y `entry` deben coincidir. Lista los menos `permissions` posibles: `none`, `drawing`, `storage` o `download`; `camera` y `microphone` están reservados y se rechazan (consulta `docs/sandbox.md`).',
      '2. Escribe `widgets/<id>/index.js` como módulo ES (sintaxis ES2017, sin imports) con `export function mount(container, api)` y `export const strings` en los ocho idiomas (consulta `docs/widget-api.md`). Sin red, sin almacenamiento del navegador, sin `parent`, sin `eval`, sin HTML construido a partir de texto: `npm test` los rechaza, y el constructor rechaza `<!--`, `<script` y `</script` en el código fuente.',
      '3. Trata todo mensaje de un teléfono como no fiable: comprueba tipos, rangos y longitudes en el proyector, guarda allí las respuestas correctas y las puntuaciones, y envía a los teléfonos solo lo que necesitan. Cambiar la forma de un mensaje o un límite en `src/engine.mjs` implica subir `PROTO` y actualizar `docs/protocol.md` (una prueba compara su tabla con el código).',
      '4. Da estilo al widget en `widgets/<id>/style.css` con un prefijo de clases propio y las variables del tema. Mantén zonas táctiles de al menos 44 píxeles, un foco visible, una etiqueta en cada control y anuncios (`api.announce`) para lo que cambie en pantalla; comprueba el alto contraste y el texto grande.',
      '5. Escribe pruebas en `test/widgets.test.mjs` para las funciones puras que exportes, solo con datos inventados, y ejecuta `npm test`.',
      '6. Ejecuta `node scripts/build.mjs` y haz commit de `index.html`, `sw.js` y `app.json` regenerados junto con `src/` y `widgets/`.'
    ].join('\n'),
    pt: [
      '1. Adicione `data/widgets/<id>.json` (parta de `data/widgets/example.json`; esquema em `schema.json`) e execute `python scripts/validate.py`. O `id`, o nome do ficheiro, o diretório em `widgets/` e `entry` têm de coincidir. Liste o menor número possível de `permissions`: `none`, `drawing`, `storage` ou `download`; `camera` e `microphone` estão reservadas e são rejeitadas (veja `docs/sandbox.md`).',
      '2. Escreva `widgets/<id>/index.js` como módulo ES (sintaxe ES2017, sem imports) com `export function mount(container, api)` e `export const strings` nas oito línguas (veja `docs/widget-api.md`). Sem rede, sem armazenamento do navegador, sem `parent`, sem `eval`, sem HTML construído a partir de texto: `npm test` recusa-os, e o construtor recusa `<!--`, `<script` e `</script` no código-fonte.',
      '3. Trate toda a mensagem de um telemóvel como não fiável: verifique tipos, intervalos e comprimentos no projetor, guarde lá as respostas certas e as pontuações, e envie aos telemóveis só o de que precisam. Mudar a forma de uma mensagem ou um limite em `src/engine.mjs` implica subir `PROTO` e atualizar `docs/protocol.md` (um teste compara a sua tabela com o código).',
      '4. Dê estilo ao widget em `widgets/<id>/style.css` com um prefixo de classes próprio e as variáveis do tema. Mantenha alvos táteis de pelo menos 44 píxeis, foco visível, uma etiqueta em cada controlo e anúncios (`api.announce`) para o que muda no ecrã; verifique o alto contraste e o texto grande.',
      '5. Escreva testes em `test/widgets.test.mjs` para as funções puras que exportar, só com dados inventados, e execute `npm test`.',
      '6. Execute `node scripts/build.mjs` e faça commit de `index.html`, `sw.js` e `app.json` regenerados, juntamente com `src/` e `widgets/`.'
    ].join('\n'),
    de: [
      '1. Füge `data/widgets/<id>.json` hinzu (ausgehend von `data/widgets/example.json`; Schema in `schema.json`) und führe `python scripts/validate.py` aus. `id`, Dateiname, Verzeichnis unter `widgets/` und `entry` müssen übereinstimmen. Führe so wenige `permissions` wie möglich auf: `none`, `drawing`, `storage` oder `download`; `camera` und `microphone` sind reserviert und werden abgelehnt (siehe `docs/sandbox.md`).',
      '2. Schreibe `widgets/<id>/index.js` als ES-Modul (ES2017-Syntax, keine Importe) mit `export function mount(container, api)` und `export const strings` in allen acht Sprachen (siehe `docs/widget-api.md`). Kein Netzwerk, kein Browser-Speicher, kein `parent`, kein `eval`, kein aus Text gebautes HTML: `npm test` lehnt sie ab, und der Builder lehnt `<!--`, `<script` und `</script` im Quelltext ab.',
      '3. Behandle jede Nachricht eines Telefons als nicht vertrauenswürdig: Prüfe Typen, Bereiche und Längen auf dem Projektor, halte richtige Antworten und Punkte dort und sende den Telefonen nur, was sie brauchen. Wer die Form einer Nachricht oder eine Grenze in `src/engine.mjs` ändert, erhöht `PROTO` und aktualisiert `docs/protocol.md` (ein Test vergleicht dessen Tabelle mit dem Code).',
      '4. Gestalte das Widget in `widgets/<id>/style.css` mit einem eigenen Klassenpräfix und den Theme-Variablen. Behalte Touch-Ziele von mindestens 44 Pixeln, einen sichtbaren Fokus, ein Label für jedes Bedienelement und Ansagen (`api.announce`) für das, was sich auf dem Bildschirm ändert; prüfe hohen Kontrast und große Schrift.',
      '5. Schreibe Tests in `test/widgets.test.mjs` für die reinen Funktionen, die du exportierst, nur mit erfundenen Daten, und führe `npm test` aus.',
      '6. Führe `node scripts/build.mjs` aus und committe die neu erzeugten `index.html`, `sw.js` und `app.json` zusammen mit `src/` und `widgets/`.'
    ].join('\n'),
    hu: [
      '1. Add hozzá a `data/widgets/<id>.json` fájlt (a `data/widgets/example.json` alapján; a séma a `schema.json` fájlban van), és futtasd: `python scripts/validate.py`. Az `id`-nek, a fájlnévnek, a `widgets/` alatti mappának és az `entry`-nek egyeznie kell. A lehető legkevesebb `permissions` értéket sorold fel: `none`, `drawing`, `storage` vagy `download`; a `camera` és a `microphone` fenntartott, és elutasítják (lásd `docs/sandbox.md`).',
      '2. Írd meg a `widgets/<id>/index.js` fájlt ES-modulként (ES2017 szintaxis, importok nélkül) `export function mount(container, api)` függvénnyel és `export const strings` objektummal mind a nyolc nyelven (lásd `docs/widget-api.md`). Se hálózat, se böngészőtároló, se `parent`, se `eval`, se szövegből épített HTML: az `npm test` elutasítja őket, az építő pedig a `<!--`, `<script` és `</script` szövegrészeket a forrásban.',
      '3. Minden telefonról érkező üzenetet bizalmatlanul kezelj: a kivetítőn ellenőrizd a típusokat, tartományokat és hosszakat, a helyes válaszokat és pontszámokat ott tartsd, és a telefonoknak csak azt küldd, amire szükségük van. Ha a `src/engine.mjs` fájlban egy üzenet alakját vagy egy korlátot változtatsz, emeld a `PROTO` értékét és frissítsd a `docs/protocol.md` fájlt (egy teszt összeveti a táblázatát a kóddal).',
      '4. Formázd a widgetet a `widgets/<id>/style.css` fájlban saját osztályelőtaggal és a téma változóival. Legyenek az érintési célpontok legalább 44 képpontosak, a fókusz látható, minden vezérlőnek legyen címkéje, és a képernyőn változó tartalmat jelentsd be (`api.announce`); ellenőrizd a nagy kontrasztot és a nagy szöveget.',
      '5. Írj teszteket a `test/widgets.test.mjs` fájlba az exportált tiszta függvényekhez, csak kitalált adatokkal, és futtasd: `npm test`.',
      '6. Futtasd: `node scripts/build.mjs`, majd commitold az újragenerált `index.html`, `sw.js` és `app.json` fájlokat a `src/` és a `widgets/` mappával együtt.'
    ].join('\n')
  };

  const issues = {
    en: [
      'Test the whole flow on a real iPhone (Safari) and a real Android phone (Chrome) with the checklist in `docs/compat.md`, and add your rows to its table',
      'Try pairing on a home network, on a school or guest Wi-Fi that isolates devices and on a mobile hotspot; record what works and the exact error messages in `docs/compat.md`',
      'Get a real Undava quiz file (or its published specification) and make the quiz importer read it, with a test and a note in `docs/quiz-format.md`',
      'Add a “raise your hand” widget: phones queue up, the projector shows the order and lets the teacher call the next one (permission `none`)',
      'Add an exit-ticket widget: each phone picks a face or a number from 1 to 5 and may add a short comment; the projector shows the totals and the comments, with a CSV export',
      'Add a group-maker widget: the projector splits the connected phones into groups of a chosen size, with a reshuffle button, and each phone is shown its group',
      'Quiz: add a second CSV with every phone’s answer to every question, so the teacher can see who got what wrong',
      'Audit the page with a screen reader (NVDA or VoiceOver) and with the keyboard alone, fix what is not announced or not reachable, and record the result in `docs/compat.md`',
      'Review the machine-written translations of the interface and the widgets (fr, de, es, it, pt, hu) and fix what a native speaker would not say',
      'Extend the hub’s browser test (`tests/proiector.test.mjs`) to ten or more simulated phones drawing at the same time, and report how responsive the projector stays'
    ],
    ro: [
      'Testează întregul flux pe un iPhone real (Safari) și pe un telefon Android real (Chrome) cu lista de verificare din `docs/compat.md` și adaugă-ți rândurile în tabelul de acolo',
      'Încearcă asocierea într-o rețea de acasă, într-un Wi-Fi școlar sau pentru oaspeți care izolează dispozitivele și printr-un hotspot mobil; consemnează în `docs/compat.md` ce merge și mesajele de eroare exacte',
      'Procură un fișier de quiz Undava real (sau specificația lui publicată) și fă importatorul de quiz să-l citească, cu un test și o notă în `docs/quiz-format.md`',
      'Adaugă un widget „ridică mâna”: telefoanele se așază la coadă, proiectorul arată ordinea și îl lasă pe profesor să-l cheme pe următorul (permisiunea `none`)',
      'Adaugă un widget de tip „bilet de ieșire”: fiecare telefon alege o față sau un număr de la 1 la 5 și poate adăuga un comentariu scurt; proiectorul arată totalurile și comentariile, cu export CSV',
      'Adaugă un widget de formare a grupelor: proiectorul împarte telefoanele conectate în grupe de o mărime aleasă, cu un buton de amestecare, iar fiecare telefon își vede grupa',
      'Quiz: adaugă un al doilea CSV cu răspunsul fiecărui telefon la fiecare întrebare, ca profesorul să vadă cine a greșit ce',
      'Auditează pagina cu un cititor de ecran (NVDA sau VoiceOver) și numai cu tastatura, repară ce nu este anunțat sau nu poate fi atins și consemnează rezultatul în `docs/compat.md`',
      'Revizuiește traducerile automate ale interfeței și ale widgeturilor (fr, de, es, it, pt, hu) și corectează ce nu ar spune un vorbitor nativ',
      'Extinde testul din browser al hubului (`tests/proiector.test.mjs`) la zece sau mai multe telefoane simulate care desenează simultan și raportează cât de receptiv rămâne proiectorul'
    ],
    fr: [
      'Tester tout le parcours sur un vrai iPhone (Safari) et un vrai téléphone Android (Chrome) avec la liste de contrôle de `docs/compat.md`, et ajouter ses lignes à son tableau',
      'Essayer l’appairage sur un réseau domestique, sur un Wi-Fi scolaire ou invité qui isole les appareils et sur un point d’accès mobile ; consigner dans `docs/compat.md` ce qui marche et les messages d’erreur exacts',
      'Obtenir un vrai fichier de quiz Undava (ou sa spécification publiée) et faire en sorte que l’importateur de quiz le lise, avec un test et une note dans `docs/quiz-format.md`',
      'Ajouter un widget « lever la main » : les téléphones font la queue, le projecteur montre l’ordre et laisse l’enseignant appeler le suivant (permission `none`)',
      'Ajouter un widget de ticket de sortie : chaque téléphone choisit un visage ou un nombre de 1 à 5 et peut ajouter un court commentaire ; le projecteur affiche les totaux et les commentaires, avec un export CSV',
      'Ajouter un widget de constitution de groupes : le projecteur répartit les téléphones connectés en groupes d’une taille choisie, avec un bouton de nouveau tirage, et chaque téléphone voit son groupe',
      'Quiz : ajouter un second CSV avec la réponse de chaque téléphone à chaque question, pour que l’enseignant voie qui s’est trompé sur quoi',
      'Auditer la page avec un lecteur d’écran (NVDA ou VoiceOver) et au clavier seul, corriger ce qui n’est pas annoncé ou pas atteignable, et consigner le résultat dans `docs/compat.md`',
      'Relire les traductions automatiques de l’interface et des widgets (fr, de, es, it, pt, hu) et corriger ce qu’un locuteur natif ne dirait pas',
      'Étendre le test navigateur du hub (`tests/proiector.test.mjs`) à dix téléphones simulés ou plus qui dessinent en même temps, et rapporter la réactivité qui reste au projecteur'
    ],
    it: [
      'Provare l’intero percorso su un vero iPhone (Safari) e un vero telefono Android (Chrome) con la lista di controllo di `docs/compat.md` e aggiungere le proprie righe alla sua tabella',
      'Provare l’abbinamento su una rete domestica, su un Wi-Fi scolastico o ospiti che isola i dispositivi e su un hotspot mobile; annotare in `docs/compat.md` cosa funziona e i messaggi di errore esatti',
      'Procurarsi un vero file di quiz Undava (o la sua specifica pubblicata) e far sì che l’importatore dei quiz lo legga, con un test e una nota in `docs/quiz-format.md`',
      'Aggiungere un widget «alzare la mano»: i telefoni si mettono in coda, il proiettore mostra l’ordine e lascia che l’insegnante chiami il prossimo (permesso `none`)',
      'Aggiungere un widget biglietto di uscita: ogni telefono sceglie una faccina o un numero da 1 a 5 e può aggiungere un breve commento; il proiettore mostra i totali e i commenti, con esportazione CSV',
      'Aggiungere un widget per formare gruppi: il proiettore divide i telefoni connessi in gruppi di una dimensione scelta, con un pulsante per rimescolare, e ogni telefono vede il proprio gruppo',
      'Quiz: aggiungere un secondo CSV con la risposta di ogni telefono a ogni domanda, così l’insegnante vede chi ha sbagliato cosa',
      'Verificare la pagina con un lettore di schermo (NVDA o VoiceOver) e con la sola tastiera, correggere ciò che non viene annunciato o non è raggiungibile e annotare il risultato in `docs/compat.md`',
      'Rivedere le traduzioni automatiche dell’interfaccia e dei widget (fr, de, es, it, pt, hu) e correggere ciò che un madrelingua non direbbe',
      'Estendere il test nel browser dell’hub (`tests/proiector.test.mjs`) a dieci o più telefoni simulati che disegnano contemporaneamente e riferire quanto resta reattivo il proiettore'
    ],
    es: [
      'Probar todo el recorrido en un iPhone real (Safari) y en un teléfono Android real (Chrome) con la lista de comprobación de `docs/compat.md`, y añadir tus filas a su tabla',
      'Probar el emparejamiento en una red doméstica, en un Wi-Fi escolar o de invitados que aísla los dispositivos y en un punto de acceso móvil; anotar en `docs/compat.md` qué funciona y los mensajes de error exactos',
      'Conseguir un archivo de cuestionario Undava real (o su especificación publicada) y hacer que el importador de cuestionarios lo lea, con una prueba y una nota en `docs/quiz-format.md`',
      'Añadir un widget «levantar la mano»: los teléfonos hacen cola, el proyector muestra el orden y deja que el docente llame al siguiente (permiso `none`)',
      'Añadir un widget de ticket de salida: cada teléfono elige una cara o un número del 1 al 5 y puede añadir un comentario breve; el proyector muestra los totales y los comentarios, con exportación CSV',
      'Añadir un widget para formar grupos: el proyector reparte los teléfonos conectados en grupos de un tamaño elegido, con un botón para volver a mezclar, y cada teléfono ve su grupo',
      'Cuestionario: añadir un segundo CSV con la respuesta de cada teléfono a cada pregunta, para que el docente vea quién falló en qué',
      'Auditar la página con un lector de pantalla (NVDA o VoiceOver) y solo con el teclado, corregir lo que no se anuncia o no se alcanza y anotar el resultado en `docs/compat.md`',
      'Revisar las traducciones automáticas de la interfaz y de los widgets (fr, de, es, it, pt, hu) y corregir lo que un hablante nativo no diría',
      'Ampliar la prueba en navegador del hub (`tests/proiector.test.mjs`) a diez o más teléfonos simulados que dibujan a la vez, e informar de lo receptivo que sigue el proyector'
    ],
    pt: [
      'Testar todo o percurso num iPhone real (Safari) e num telemóvel Android real (Chrome) com a lista de verificação de `docs/compat.md`, e acrescentar as suas linhas à tabela',
      'Experimentar o emparelhamento numa rede doméstica, num Wi-Fi escolar ou de convidados que isola os dispositivos e num ponto de acesso móvel; registar em `docs/compat.md` o que funciona e as mensagens de erro exatas',
      'Obter um ficheiro de questionário Undava real (ou a sua especificação publicada) e fazer com que o importador de questionários o leia, com um teste e uma nota em `docs/quiz-format.md`',
      'Acrescentar um widget «levantar a mão»: os telemóveis ficam em fila, o projetor mostra a ordem e deixa o professor chamar o seguinte (permissão `none`)',
      'Acrescentar um widget de bilhete de saída: cada telemóvel escolhe uma cara ou um número de 1 a 5 e pode juntar um comentário curto; o projetor mostra os totais e os comentários, com exportação CSV',
      'Acrescentar um widget para formar grupos: o projetor reparte os telemóveis ligados em grupos de um tamanho escolhido, com um botão para voltar a misturar, e cada telemóvel vê o seu grupo',
      'Questionário: acrescentar um segundo CSV com a resposta de cada telemóvel a cada pergunta, para o professor ver quem errou em quê',
      'Auditar a página com um leitor de ecrã (NVDA ou VoiceOver) e só com o teclado, corrigir o que não é anunciado ou não é alcançável e registar o resultado em `docs/compat.md`',
      'Rever as traduções automáticas da interface e dos widgets (fr, de, es, it, pt, hu) e corrigir o que um falante nativo não diria',
      'Alargar o teste no navegador do hub (`tests/proiector.test.mjs`) a dez ou mais telemóveis simulados a desenhar ao mesmo tempo e relatar o quanto o projetor continua reativo'
    ],
    de: [
      'Den ganzen Ablauf auf einem echten iPhone (Safari) und einem echten Android-Telefon (Chrome) mit der Checkliste in `docs/compat.md` testen und die eigenen Zeilen in deren Tabelle ergänzen',
      'Die Kopplung in einem Heimnetz, in einem Schul- oder Gast-WLAN, das Geräte trennt, und an einem mobilen Hotspot ausprobieren; in `docs/compat.md` festhalten, was funktioniert, und die genauen Fehlermeldungen',
      'Eine echte Undava-Quizdatei (oder deren veröffentlichte Spezifikation) beschaffen und den Quiz-Import so erweitern, dass er sie liest, mit einem Test und einem Hinweis in `docs/quiz-format.md`',
      'Ein „Hand heben“-Widget ergänzen: Telefone reihen sich ein, der Projektor zeigt die Reihenfolge und lässt die Lehrkraft die nächste Person aufrufen (Berechtigung `none`)',
      'Ein Exit-Ticket-Widget ergänzen: Jedes Telefon wählt ein Gesicht oder eine Zahl von 1 bis 5 und kann einen kurzen Kommentar hinzufügen; der Projektor zeigt die Summen und die Kommentare, mit CSV-Export',
      'Ein Widget zur Gruppenbildung ergänzen: Der Projektor teilt die verbundenen Telefone in Gruppen gewählter Größe ein, mit einer Schaltfläche zum Neumischen, und jedes Telefon sieht seine Gruppe',
      'Quiz: eine zweite CSV mit der Antwort jedes Telefons auf jede Frage ergänzen, damit die Lehrkraft sieht, wer was falsch hatte',
      'Die Seite mit einem Screenreader (NVDA oder VoiceOver) und nur mit der Tastatur prüfen, beheben, was nicht angesagt oder nicht erreichbar ist, und das Ergebnis in `docs/compat.md` festhalten',
      'Die maschinellen Übersetzungen der Oberfläche und der Widgets (fr, de, es, it, pt, hu) durchsehen und korrigieren, was ein Muttersprachler nicht sagen würde',
      'Den Browsertest des Hubs (`tests/proiector.test.mjs`) auf zehn oder mehr simulierte Telefone erweitern, die gleichzeitig zeichnen, und berichten, wie reaktionsfähig der Projektor bleibt'
    ],
    hu: [
      'A teljes folyamat kipróbálása valódi iPhone-on (Safari) és valódi Android-telefonon (Chrome) a `docs/compat.md` ellenőrzőlistájával, és a saját sorok hozzáadása a táblázatához',
      'A párosítás kipróbálása otthoni hálózaton, az eszközöket elszigetelő iskolai vagy vendég Wi-Fi-n és mobil hotspoton; a `docs/compat.md` fájlban rögzíteni, mi működik, és a pontos hibaüzeneteket',
      'Valódi Undava kvízfájl (vagy a közzétett specifikációja) beszerzése, és a kvízimportáló megtanítása annak olvasására, teszttel és megjegyzéssel a `docs/quiz-format.md` fájlban',
      '„Jelentkezés” widget hozzáadása: a telefonok sorba állnak, a kivetítő mutatja a sorrendet, és a tanár hívhatja a következőt (`none` jogosultság)',
      'Kilépőjegy widget hozzáadása: minden telefon választ egy arcot vagy egy számot 1-től 5-ig, és írhat rövid megjegyzést; a kivetítő mutatja az összegeket és a megjegyzéseket, CSV-exporttal',
      'Csoportalkotó widget hozzáadása: a kivetítő a csatlakozott telefonokat választott méretű csoportokba osztja, újrakeverő gombbal, és minden telefon látja a saját csoportját',
      'Kvíz: második CSV hozzáadása minden telefon minden kérdésre adott válaszával, hogy a tanár lássa, ki miben tévedett',
      'Az oldal ellenőrzése képernyőolvasóval (NVDA vagy VoiceOver) és csak billentyűzettel, a be nem jelentett vagy el nem érhető részek javítása, az eredmény rögzítése a `docs/compat.md` fájlban',
      'A felület és a widgetek gépi fordításainak (fr, de, es, it, pt, hu) átnézése, és javítása annak, amit egy anyanyelvi beszélő nem mondana',
      'A hub böngészős tesztjének (`tests/proiector.test.mjs`) kiterjesztése tíz vagy több szimulált telefonra, amelyek egyszerre rajzolnak, és jelentés arról, mennyire marad reszponzív a kivetítő'
    ]
  };

  const headings = {
    does: {en: 'What it does', ro: 'Ce face', fr: 'Ce que fait l’application', it: 'Cosa fa', es: 'Qué hace', pt: 'O que faz', de: 'Was es kann', hu: 'Mit tud'},
    how: {en: 'How it works', ro: 'Cum funcționează', fr: 'Comment ça marche', it: 'Come funziona', es: 'Cómo funciona', pt: 'Como funciona', de: 'Wie es funktioniert', hu: 'Hogyan működik'},
    limits: {en: 'Limits', ro: 'Limite', fr: 'Limites', it: 'Limiti', es: 'Límites', pt: 'Limites', de: 'Grenzen', hu: 'Korlátok'}
  };

  const added = {
    en: [
      'The projector and phone page: one `index.html`, built from `src/` and `widgets/` by `node scripts/build.mjs` (`--check` verifies it), with the shared screen, the controls and the phone view in the same file.',
      'Pairing without a server by exchanging codes (QR frames, a photo of the code or pasted text), up to 30 phones per session; teacher controls to lock or unlock, remove a phone, show full screen, keep the screen awake and end the session.',
      'Five activities: countdown timer, poll, quiz, sticky notes and whiteboard, with CSV, text and PNG exports where they apply.',
      'The widget API and the isolation of every activity in a sandboxed frame, with the permissions `none`, `drawing`, `storage` and `download` (`camera` and `microphone` are reserved and refused): `docs/widget-api.md` and `docs/sandbox.md`.',
      'The projector–phone protocol with its limits (phones, names, message sizes, rates, stored data), a session that resynchronises when a weak connection comes back, and CSV exports that neutralise cells starting with a formula character: `docs/protocol.md`.',
      'Quiz files as JSON, plain text or CSV, read by a tolerant importer and documented in English and Romanian in `docs/quiz-format.md`; the “Undava” format is not claimed, because no specification was found.',
      'Eight languages for the interface and the activities, a language and a look (light, dark, high contrast, large text) chosen on each device, and keyboard and screen-reader support.',
      'Tests: `npm test` (engine, protocol limits, quiz importer, widgets, translations, PWA files, build and documentation), a browser test in the hub with real WebRTC connections, a hostile widget and hostile phones, and `docs/compat.md` with a checklist for real devices.',
      'README, CHANGELOG, CONTRIBUTING and ISSUES_GOOD_FIRST rewritten for this version in eight languages, with ten good first issues.'
    ],
    ro: [
      'Pagina de proiector și de telefon: un singur `index.html`, construit din `src/` și `widgets/` cu `node scripts/build.mjs` (`--check` îl verifică), cu ecranul comun, comenzile și vederea telefonului în același fișier.',
      'Asociere fără server prin schimb de coduri (cadre QR, fotografia codului sau text lipit), până la 30 de telefoane pe sesiune; comenzi pentru profesor: blocare sau deblocare, scoaterea unui telefon, ecran complet, ecran mereu aprins și încheierea sesiunii.',
      'Cinci activități: cronometru cu numărătoare inversă, sondaj, quiz, bilețele și tablă, cu exporturi CSV, text și PNG acolo unde se aplică.',
      'API-ul pentru widgeturi și izolarea fiecărei activități într-un cadru în sandbox, cu permisiunile `none`, `drawing`, `storage` și `download` (`camera` și `microphone` sunt rezervate și refuzate): `docs/widget-api.md` și `docs/sandbox.md`.',
      'Protocolul proiector–telefon cu limitele sale (telefoane, nume, mărimea mesajelor, ritm, date stocate), o sesiune care se resincronizează când revine o conexiune slabă și exporturi CSV care neutralizează celulele ce încep cu un caracter de formulă: `docs/protocol.md`.',
      'Fișiere de quiz în JSON, text simplu sau CSV, citite de un importator tolerant și documentate în engleză și română în `docs/quiz-format.md`; formatul „Undava” nu este susținut, pentru că nu s-a găsit nicio specificație.',
      'Opt limbi pentru interfață și activități, limbă și aspect (deschis, întunecat, contrast ridicat, text mare) alese pe fiecare dispozitiv, plus suport pentru tastatură și cititoare de ecran.',
      'Teste: `npm test` (motor, limitele protocolului, importatorul de quiz, widgeturi, traduceri, fișiere PWA, construirea și documentația), un test în browser în hub cu conexiuni WebRTC reale, un widget ostil și telefoane ostile, și `docs/compat.md` cu o listă de verificare pentru dispozitive reale.',
      'README, CHANGELOG, CONTRIBUTING și ISSUES_GOOD_FIRST rescrise pentru această versiune în opt limbi, cu zece sarcini bune pentru început.'
    ],
    fr: [
      'La page du projecteur et du téléphone : un seul `index.html`, construit à partir de `src/` et `widgets/` par `node scripts/build.mjs` (`--check` le vérifie), avec l’écran partagé, les commandes et la vue du téléphone dans le même fichier.',
      'Appairage sans serveur par échange de codes (images QR, photo du code ou texte collé), jusqu’à 30 téléphones par session ; commandes de l’enseignant pour verrouiller ou déverrouiller, retirer un téléphone, passer en plein écran, garder l’écran allumé et terminer la session.',
      'Cinq activités : minuteur, sondage, quiz, notes autocollantes et tableau blanc, avec des exports CSV, texte et PNG là où ils s’appliquent.',
      'L’API des widgets et l’isolation de chaque activité dans un cadre en bac à sable, avec les permissions `none`, `drawing`, `storage` et `download` (`camera` et `microphone` sont réservées et refusées) : `docs/widget-api.md` et `docs/sandbox.md`.',
      'Le protocole projecteur–téléphone avec ses limites (téléphones, noms, taille des messages, débit, données enregistrées), une session qui se resynchronise quand une connexion faible revient et des exports CSV qui neutralisent les cellules commençant par un caractère de formule : `docs/protocol.md`.',
      'Des fichiers de quiz en JSON, texte simple ou CSV, lus par un importateur tolérant et documentés en anglais et en roumain dans `docs/quiz-format.md` ; le format « Undava » n’est pas revendiqué, faute de spécification trouvée.',
      'Huit langues pour l’interface et les activités, une langue et un aspect (clair, sombre, fort contraste, grand texte) choisis sur chaque appareil, et la prise en charge du clavier et des lecteurs d’écran.',
      'Tests : `npm test` (moteur, limites du protocole, importateur de quiz, widgets, traductions, fichiers PWA, construction et documentation), un test navigateur dans le hub avec de vraies connexions WebRTC, un widget hostile et des téléphones hostiles, et `docs/compat.md` avec une liste de contrôle pour de vrais appareils.',
      'README, CHANGELOG, CONTRIBUTING et ISSUES_GOOD_FIRST réécrits pour cette version dans huit langues, avec dix tâches pour débuter.'
    ],
    it: [
      'La pagina del proiettore e del telefono: un solo `index.html`, costruito da `src/` e `widgets/` con `node scripts/build.mjs` (`--check` lo verifica), con lo schermo condiviso, i comandi e la vista del telefono nello stesso file.',
      'Abbinamento senza server tramite scambio di codici (fotogrammi QR, foto del codice o testo incollato), fino a 30 telefoni per sessione; comandi dell’insegnante per bloccare o sbloccare, rimuovere un telefono, passare a schermo intero, tenere acceso lo schermo e terminare la sessione.',
      'Cinque attività: timer, sondaggio, quiz, foglietti adesivi e lavagna, con esportazioni CSV, testo e PNG dove si applicano.',
      'L’API dei widget e l’isolamento di ogni attività in un frame in sandbox, con i permessi `none`, `drawing`, `storage` e `download` (`camera` e `microphone` sono riservati e rifiutati): `docs/widget-api.md` e `docs/sandbox.md`.',
      'Il protocollo proiettore–telefono con i suoi limiti (telefoni, nomi, dimensione dei messaggi, frequenza, dati salvati), una sessione che si risincronizza quando torna una connessione debole ed esportazioni CSV che neutralizzano le celle che iniziano con un carattere di formula: `docs/protocol.md`.',
      'File di quiz in JSON, testo semplice o CSV, letti da un importatore tollerante e documentati in inglese e rumeno in `docs/quiz-format.md`; il formato «Undava» non è dichiarato supportato, perché non è stata trovata alcuna specifica.',
      'Otto lingue per l’interfaccia e le attività, una lingua e un aspetto (chiaro, scuro, alto contrasto, testo grande) scelti su ogni dispositivo, e supporto per tastiera e lettori di schermo.',
      'Test: `npm test` (motore, limiti del protocollo, importatore dei quiz, widget, traduzioni, file PWA, build e documentazione), un test nel browser nell’hub con vere connessioni WebRTC, un widget ostile e telefoni ostili, e `docs/compat.md` con una lista di controllo per dispositivi reali.',
      'README, CHANGELOG, CONTRIBUTING e ISSUES_GOOD_FIRST riscritti per questa versione in otto lingue, con dieci attività per iniziare.'
    ],
    es: [
      'La página del proyector y del teléfono: un solo `index.html`, construido a partir de `src/` y `widgets/` con `node scripts/build.mjs` (`--check` lo verifica), con la pantalla compartida, los controles y la vista del teléfono en el mismo archivo.',
      'Emparejamiento sin servidor mediante intercambio de códigos (fotogramas QR, foto del código o texto pegado), hasta 30 teléfonos por sesión; controles del docente para bloquear o desbloquear, quitar un teléfono, pasar a pantalla completa, mantener la pantalla encendida y terminar la sesión.',
      'Cinco actividades: temporizador, encuesta, cuestionario, notas adhesivas y pizarra, con exportaciones CSV, texto y PNG donde corresponda.',
      'La API de widgets y el aislamiento de cada actividad en un marco aislado, con los permisos `none`, `drawing`, `storage` y `download` (`camera` y `microphone` están reservados y se rechazan): `docs/widget-api.md` y `docs/sandbox.md`.',
      'El protocolo proyector–teléfono con sus límites (teléfonos, nombres, tamaño de los mensajes, ritmo, datos guardados), una sesión que se resincroniza cuando vuelve una conexión débil y exportaciones CSV que neutralizan las celdas que empiezan por un carácter de fórmula: `docs/protocol.md`.',
      'Archivos de cuestionario en JSON, texto simple o CSV, leídos por un importador tolerante y documentados en inglés y rumano en `docs/quiz-format.md`; el formato «Undava» no se afirma, porque no se encontró ninguna especificación.',
      'Ocho idiomas para la interfaz y las actividades, un idioma y un aspecto (claro, oscuro, alto contraste, texto grande) elegidos en cada dispositivo, y compatibilidad con el teclado y los lectores de pantalla.',
      'Pruebas: `npm test` (motor, límites del protocolo, importador de cuestionarios, widgets, traducciones, archivos PWA, compilación y documentación), una prueba en navegador en el hub con conexiones WebRTC reales, un widget hostil y teléfonos hostiles, y `docs/compat.md` con una lista de comprobación para dispositivos reales.',
      'README, CHANGELOG, CONTRIBUTING e ISSUES_GOOD_FIRST reescritos para esta versión en ocho idiomas, con diez tareas para empezar.'
    ],
    pt: [
      'A página do projetor e do telemóvel: um único `index.html`, construído a partir de `src/` e `widgets/` por `node scripts/build.mjs` (`--check` verifica-o), com o ecrã partilhado, os controlos e a vista do telemóvel no mesmo ficheiro.',
      'Emparelhamento sem servidor por troca de códigos (imagens QR, fotografia do código ou texto colado), até 30 telemóveis por sessão; controlos do professor para bloquear ou desbloquear, retirar um telemóvel, passar a ecrã inteiro, manter o ecrã ligado e terminar a sessão.',
      'Cinco atividades: temporizador, sondagem, questionário, notas autocolantes e quadro branco, com exportações CSV, texto e PNG onde se aplicam.',
      'A API de widgets e o isolamento de cada atividade num quadro em sandbox, com as permissões `none`, `drawing`, `storage` e `download` (`camera` e `microphone` estão reservadas e são recusadas): `docs/widget-api.md` e `docs/sandbox.md`.',
      'O protocolo projetor–telemóvel com os seus limites (telemóveis, nomes, tamanho das mensagens, ritmo, dados guardados), uma sessão que se ressincroniza quando volta uma ligação fraca e exportações CSV que neutralizam as células que começam por um caráter de fórmula: `docs/protocol.md`.',
      'Ficheiros de questionário em JSON, texto simples ou CSV, lidos por um importador tolerante e documentados em inglês e romeno em `docs/quiz-format.md`; o formato «Undava» não é afirmado, porque não se encontrou nenhuma especificação.',
      'Oito línguas para a interface e as atividades, uma língua e um aspeto (claro, escuro, alto contraste, texto grande) escolhidos em cada dispositivo, e suporte para teclado e leitores de ecrã.',
      'Testes: `npm test` (motor, limites do protocolo, importador de questionários, widgets, traduções, ficheiros PWA, compilação e documentação), um teste no navegador no hub com ligações WebRTC reais, um widget hostil e telemóveis hostis, e `docs/compat.md` com uma lista de verificação para dispositivos reais.',
      'README, CHANGELOG, CONTRIBUTING e ISSUES_GOOD_FIRST reescritos para esta versão em oito línguas, com dez tarefas para começar.'
    ],
    de: [
      'Die Seite für Projektor und Telefon: eine einzige `index.html`, aus `src/` und `widgets/` mit `node scripts/build.mjs` gebaut (`--check` prüft sie), mit dem gemeinsamen Bildschirm, den Bedienelementen und der Telefonansicht in derselben Datei.',
      'Kopplung ohne Server durch Austausch von Codes (QR-Bilder, Foto des Codes oder eingefügter Text), bis zu 30 Telefone pro Sitzung; Steuerung durch die Lehrkraft zum Sperren oder Entsperren, Entfernen eines Telefons, Vollbild, Bildschirm wach halten und Sitzung beenden.',
      'Fünf Aktivitäten: Countdown-Timer, Umfrage, Quiz, Haftnotizen und Whiteboard, mit CSV-, Text- und PNG-Export, wo es passt.',
      'Die Widget-API und die Isolierung jeder Aktivität in einem Sandbox-Frame, mit den Berechtigungen `none`, `drawing`, `storage` und `download` (`camera` und `microphone` sind reserviert und werden abgelehnt): `docs/widget-api.md` und `docs/sandbox.md`.',
      'Das Protokoll zwischen Projektor und Telefon mit seinen Grenzen (Telefone, Namen, Nachrichtengrößen, Raten, gespeicherte Daten), eine Sitzung, die sich neu synchronisiert, wenn eine schwache Verbindung zurückkehrt, und CSV-Exporte, die Zellen entschärfen, die mit einem Formelzeichen beginnen: `docs/protocol.md`.',
      'Quizdateien als JSON, Klartext oder CSV, gelesen von einem toleranten Import und auf Englisch und Rumänisch in `docs/quiz-format.md` dokumentiert; das „Undava“-Format wird nicht beansprucht, weil keine Spezifikation gefunden wurde.',
      'Acht Sprachen für Oberfläche und Aktivitäten, auf jedem Gerät gewählte Sprache und Darstellung (hell, dunkel, hoher Kontrast, große Schrift) sowie Unterstützung für Tastatur und Screenreader.',
      'Tests: `npm test` (Engine, Protokollgrenzen, Quiz-Import, Widgets, Übersetzungen, PWA-Dateien, Build und Dokumentation), ein Browsertest im Hub mit echten WebRTC-Verbindungen, einem feindlichen Widget und feindlichen Telefonen, und `docs/compat.md` mit einer Checkliste für echte Geräte.',
      'README, CHANGELOG, CONTRIBUTING und ISSUES_GOOD_FIRST für diese Version in acht Sprachen neu geschrieben, mit zehn Einstiegsaufgaben.'
    ],
    hu: [
      'A kivetítő- és telefonoldal: egyetlen `index.html`, amelyet a `node scripts/build.mjs` épít a `src/` és a `widgets/` mappából (a `--check` ellenőrzi), a közös képernyővel, a vezérlőkkel és a telefonnézettel ugyanabban a fájlban.',
      'Kiszolgáló nélküli párosítás kódcserével (QR-képkockák, a kód fényképe vagy beillesztett szöveg), munkamenetenként legfeljebb 30 telefon; a tanár vezérlői: zárolás vagy feloldás, telefon eltávolítása, teljes képernyő, a képernyő ébren tartása és a munkamenet befejezése.',
      'Öt tevékenység: visszaszámláló, szavazás, kvíz, cetlik és tábla, ahol értelmezhető, CSV-, szöveg- és PNG-exporttal.',
      'A widget-API és minden tevékenység elkülönítése egy homokozóban futó keretben, a `none`, `drawing`, `storage` és `download` jogosultságokkal (a `camera` és a `microphone` fenntartott, és elutasítják): `docs/widget-api.md` és `docs/sandbox.md`.',
      'A kivetítő és a telefon közötti protokoll a korlátaival (telefonok, nevek, üzenetméret, ütem, tárolt adatok), egy munkamenet, amely újraszinkronizál, ha egy gyenge kapcsolat visszatér, és CSV-exportok, amelyek hatástalanítják a képletkarakterrel kezdődő cellákat: `docs/protocol.md`.',
      'Kvízfájlok JSON, egyszerű szöveg vagy CSV formában, amelyeket egy toleráns importáló olvas, angolul és románul dokumentálva a `docs/quiz-format.md` fájlban; az „Undava” formátumot nem állítjuk, mert nem találtunk specifikációt.',
      'Nyolc nyelv a felülethez és a tevékenységekhez, minden eszközön külön választható nyelv és megjelenés (világos, sötét, nagy kontraszt, nagy szöveg), valamint billentyűzet- és képernyőolvasó-támogatás.',
      'Tesztek: `npm test` (motor, protokollkorlátok, kvízimportáló, widgetek, fordítások, PWA-fájlok, build és dokumentáció), egy böngészős teszt a hubban valódi WebRTC-kapcsolatokkal, egy ellenséges widgettel és ellenséges telefonokkal, valamint a `docs/compat.md` ellenőrzőlistával valódi eszközökhöz.',
      'A README, a CHANGELOG, a CONTRIBUTING és az ISSUES_GOOD_FIRST újraírva ehhez a verzióhoz nyolc nyelven, tíz kezdő feladattal.'
    ]
  };
  for (const l of Object.keys(added)) added[l] = [...added[l], ...legacy[l]];

  const changed = {
    en: [
      '`data/widgets/example.json` is now a template descriptor (`my-widget`, with translations in eight languages); the countdown-timer descriptor moved to `data/widgets/timer.json`, next to `poll`, `quiz`, `notes` and `whiteboard`.',
      '`widgets/timer/index.js` is now the real countdown timer instead of the demonstration stub.',
      '`schema.json`: `description` and `i18n` are required (English is required, the other seven languages are reported by the validator), `id` and `entry` must follow a fixed form, and `permissions` accepts one to three of `none`, `drawing`, `storage` and `download`; `camera` and `microphone` are no longer accepted.',
      '`scripts/validate.py` also checks that `id` equals the file name, that `entry` exists and exports `mount`, that the reserved permissions are refused with a clear message, and that translations are complete (a warning, or an error with `--strict`).',
      'The workflow runs on Ubuntu 26.04 with Node.js 26 and also runs the tests and the build check.'
    ],
    ro: [
      '`data/widgets/example.json` este acum un descriptor-șablon (`my-widget`, cu traduceri în opt limbi); descriptorul cronometrului s-a mutat în `data/widgets/timer.json`, lângă `poll`, `quiz`, `notes` și `whiteboard`.',
      '`widgets/timer/index.js` este acum cronometrul real, nu mai este exemplul demonstrativ.',
      '`schema.json`: `description` și `i18n` sunt obligatorii (engleza este obligatorie, celelalte șapte limbi sunt raportate de validator), `id` și `entry` trebuie să aibă o formă fixă, iar `permissions` acceptă de la una la trei dintre `none`, `drawing`, `storage` și `download`; `camera` și `microphone` nu mai sunt acceptate.',
      '`scripts/validate.py` verifică și că `id` este egal cu numele fișierului, că `entry` există și exportă `mount`, că permisiunile rezervate sunt refuzate cu un mesaj clar și că traducerile sunt complete (avertisment, sau eroare cu `--strict`).',
      'Workflow-ul rulează pe Ubuntu 26.04 cu Node.js 26 și rulează și testele, și verificarea construirii.'
    ],
    fr: [
      '`data/widgets/example.json` est maintenant un descripteur modèle (`my-widget`, avec des traductions en huit langues) ; le descripteur du minuteur a été déplacé vers `data/widgets/timer.json`, à côté de `poll`, `quiz`, `notes` et `whiteboard`.',
      '`widgets/timer/index.js` est maintenant le vrai minuteur et non plus l’exemple de démonstration.',
      '`schema.json` : `description` et `i18n` sont obligatoires (l’anglais est obligatoire, les sept autres langues sont signalées par le validateur), `id` et `entry` doivent suivre une forme fixe, et `permissions` accepte de une à trois valeurs parmi `none`, `drawing`, `storage` et `download` ; `camera` et `microphone` ne sont plus acceptées.',
      '`scripts/validate.py` vérifie aussi que `id` est égal au nom du fichier, que `entry` existe et exporte `mount`, que les permissions réservées sont refusées avec un message clair et que les traductions sont complètes (un avertissement, ou une erreur avec `--strict`).',
      'Le workflow s’exécute sur Ubuntu 26.04 avec Node.js 26 et lance aussi les tests et la vérification de la construction.'
    ],
    it: [
      '`data/widgets/example.json` è ora un descrittore modello (`my-widget`, con traduzioni in otto lingue); il descrittore del timer è stato spostato in `data/widgets/timer.json`, accanto a `poll`, `quiz`, `notes` e `whiteboard`.',
      '`widgets/timer/index.js` è ora il vero timer e non più l’esempio dimostrativo.',
      '`schema.json`: `description` e `i18n` sono obbligatori (l’inglese è obbligatorio, le altre sette lingue sono segnalate dal validatore), `id` e `entry` devono avere una forma fissa, e `permissions` accetta da uno a tre valori tra `none`, `drawing`, `storage` e `download`; `camera` e `microphone` non sono più accettati.',
      '`scripts/validate.py` controlla anche che `id` sia uguale al nome del file, che `entry` esista ed esporti `mount`, che i permessi riservati siano rifiutati con un messaggio chiaro e che le traduzioni siano complete (un avviso, o un errore con `--strict`).',
      'Il workflow gira su Ubuntu 26.04 con Node.js 26 e esegue anche i test e la verifica della build.'
    ],
    es: [
      '`data/widgets/example.json` es ahora un descriptor plantilla (`my-widget`, con traducciones en ocho idiomas); el descriptor del temporizador se movió a `data/widgets/timer.json`, junto a `poll`, `quiz`, `notes` y `whiteboard`.',
      '`widgets/timer/index.js` es ahora el temporizador real y ya no el ejemplo de demostración.',
      '`schema.json`: `description` e `i18n` son obligatorios (el inglés es obligatorio, los otros siete idiomas los señala el validador), `id` y `entry` deben seguir una forma fija, y `permissions` acepta de uno a tres valores entre `none`, `drawing`, `storage` y `download`; `camera` y `microphone` ya no se aceptan.',
      '`scripts/validate.py` comprueba además que `id` sea igual al nombre del archivo, que `entry` exista y exporte `mount`, que los permisos reservados se rechacen con un mensaje claro y que las traducciones estén completas (una advertencia, o un error con `--strict`).',
      'El workflow se ejecuta en Ubuntu 26.04 con Node.js 26 y ejecuta también las pruebas y la comprobación de la compilación.'
    ],
    pt: [
      '`data/widgets/example.json` é agora um descritor modelo (`my-widget`, com traduções em oito línguas); o descritor do temporizador passou para `data/widgets/timer.json`, ao lado de `poll`, `quiz`, `notes` e `whiteboard`.',
      '`widgets/timer/index.js` é agora o temporizador real e já não o exemplo de demonstração.',
      '`schema.json`: `description` e `i18n` são obrigatórios (o inglês é obrigatório, as outras sete línguas são assinaladas pelo validador), `id` e `entry` têm de seguir uma forma fixa, e `permissions` aceita de um a três valores entre `none`, `drawing`, `storage` e `download`; `camera` e `microphone` já não são aceites.',
      '`scripts/validate.py` verifica também que `id` é igual ao nome do ficheiro, que `entry` existe e exporta `mount`, que as permissões reservadas são recusadas com uma mensagem clara e que as traduções estão completas (um aviso, ou um erro com `--strict`).',
      'O workflow corre em Ubuntu 26.04 com Node.js 26 e executa também os testes e a verificação da compilação.'
    ],
    de: [
      '`data/widgets/example.json` ist jetzt ein Vorlagen-Descriptor (`my-widget`, mit Übersetzungen in acht Sprachen); der Descriptor des Countdown-Timers ist nach `data/widgets/timer.json` umgezogen, neben `poll`, `quiz`, `notes` und `whiteboard`.',
      '`widgets/timer/index.js` ist jetzt der echte Countdown-Timer und nicht mehr das Demonstrationsbeispiel.',
      '`schema.json`: `description` und `i18n` sind Pflicht (Englisch ist Pflicht, die anderen sieben Sprachen meldet der Validator), `id` und `entry` müssen einer festen Form folgen, und `permissions` akzeptiert ein bis drei der Werte `none`, `drawing`, `storage` und `download`; `camera` und `microphone` werden nicht mehr akzeptiert.',
      '`scripts/validate.py` prüft zusätzlich, dass `id` dem Dateinamen entspricht, dass `entry` existiert und `mount` exportiert, dass die reservierten Berechtigungen mit einer klaren Meldung abgelehnt werden und dass die Übersetzungen vollständig sind (eine Warnung, mit `--strict` ein Fehler).',
      'Der Workflow läuft auf Ubuntu 26.04 mit Node.js 26 und führt auch die Tests und die Build-Prüfung aus.'
    ],
    hu: [
      'A `data/widgets/example.json` mostantól sablonleíró (`my-widget`, nyolc nyelvű fordítással); a visszaszámláló leírója a `data/widgets/timer.json` fájlba költözött, a `poll`, `quiz`, `notes` és `whiteboard` mellé.',
      'A `widgets/timer/index.js` mostantól a valódi visszaszámláló, nem a bemutató minta.',
      'A `schema.json`: a `description` és az `i18n` kötelező (az angol kötelező, a másik hét nyelvet az ellenőrző jelzi), az `id` és az `entry` rögzített alakú legyen, a `permissions` pedig egytől háromig fogad el értéket a `none`, `drawing`, `storage` és `download` közül; a `camera` és a `microphone` már nem elfogadott.',
      'A `scripts/validate.py` azt is ellenőrzi, hogy az `id` egyezik a fájlnévvel, hogy az `entry` létezik és exportálja a `mount` függvényt, hogy a fenntartott jogosultságokat egyértelmű üzenettel elutasítja, és hogy a fordítások teljesek (figyelmeztetés, `--strict` esetén hiba).',
      'A munkafolyamat Ubuntu 26.04 és Node.js 26 alatt fut, és a teszteket meg a build-ellenőrzést is futtatja.'
    ]
  };

  return {
    slug: 'proiector-fara-frontiere', version: '0.2.0', updated: '2026-11-17',
    headings,
    status, does, how, limits, steps, firstRule,
    contrib: {heading: contribHeading, body: contribBody},
    issues,
    changelog: {added, changed}
  };
}
