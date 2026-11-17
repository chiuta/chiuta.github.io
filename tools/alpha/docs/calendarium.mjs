// Specificația documentației CALENDARIUM (opt limbi). Folosită de tools/alpha/docs.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default async function (root) {
  const I18N = (await import(pathToFileURL(path.join(root, 'calendarium', 'src', 'i18n.mjs')).href)).default;
  const legacy = JSON.parse(fs.readFileSync(path.join(HERE, 'calendarium.legacy.json'), 'utf8'));
  const limits = {};
  for (const l of Object.keys(I18N)) limits[l] = [1, 2, 3, 4, 5, 6].map((i) => I18N[l]['lim_' + i]);
  const limHeading = {};
  for (const l of Object.keys(I18N)) limHeading[l] = I18N[l].h_limits;

  const added = {
    en: [
      'A working converter between eleven calendars (Gregorian, Julian, Revised Julian, Hebrew, Hijri tabular, Persian, Coptic, Ethiopian, Chinese lunisolar, Maya, Mars Sol Date), one tested plugin each.',
      'Month view with a second calendar, Romanian old/new style notes, Western and Orthodox Easter, Chinese solar terms and New Year, and an atlas built from `data/calendars/`.',
      'Interface in eight languages (with each language’s date order), dark and light themes, keyboard and screen-reader support, mobile layout.',
      'Tests: `node --test` for plugins, engine, data and translations; browser tests in the hub (all languages, accessibility, hostile inputs, out-of-range dates).',
      '`src/`, `plugins/` and `scripts/build.mjs`: the single `index.html` is now built from sources, and `--check` verifies it.'
    ],
    ro: [
      'Un convertor funcțional între unsprezece calendare (gregorian, iulian, iulian revizuit, ebraic, hijri tabelar, persan, copt, etiopian, lunisolar chinez, maya, ziua solară marțiană), câte un plugin testat pentru fiecare.',
      'Vedere lunară cu al doilea calendar, note despre stil vechi/nou în România, Paștele occidental și ortodox, termenii solari și Anul Nou chinezesc, plus un atlas construit din `data/calendars/`.',
      'Interfață în opt limbi (cu ordinea datei specifică fiecărei limbi), teme întunecată și luminoasă, suport pentru tastatură și cititoare de ecran, aspect pentru mobil.',
      'Teste: `node --test` pentru plugin-uri, motor, date și traduceri; teste de browser în hub (toate limbile, accesibilitate, intrări ostile, date în afara intervalelor).',
      '`src/`, `plugins/` și `scripts/build.mjs`: singurul `index.html` este acum construit din surse, iar `--check` îl verifică.'
    ],
    fr: [
      'Un convertisseur fonctionnel entre onze calendriers (grégorien, julien, julien révisé, hébraïque, hégirien tabulaire, persan, copte, éthiopien, luni-solaire chinois, maya, date solaire martienne), un plugin testé pour chacun.',
      'Vue du mois avec un second calendrier, notes sur l’ancien/nouveau style en Roumanie, Pâques occidentales et orthodoxes, termes solaires et Nouvel An chinois, et un atlas construit à partir de `data/calendars/`.',
      'Interface en huit langues (avec l’ordre des dates propre à chaque langue), thèmes sombre et clair, prise en charge du clavier et des lecteurs d’écran, mise en page mobile.',
      'Tests : `node --test` pour les plugins, le moteur, les données et les traductions ; tests de navigateur dans le hub (toutes les langues, accessibilité, saisies hostiles, dates hors plage).',
      '`src/`, `plugins/` et `scripts/build.mjs` : l’unique `index.html` est désormais construit à partir des sources, et `--check` le vérifie.'
    ],
    it: [
      'Un convertitore funzionante tra undici calendari (gregoriano, giuliano, giuliano riveduto, ebraico, egiriano tabulare, persiano, copto, etiope, lunisolare cinese, maya, data solare marziana), un plugin testato per ciascuno.',
      'Vista mensile con un secondo calendario, note sullo stile vecchio/nuovo in Romania, Pasqua occidentale e ortodossa, termini solari e Capodanno cinese, e un atlante costruito da `data/calendars/`.',
      'Interfaccia in otto lingue (con l’ordine della data di ciascuna lingua), temi scuro e chiaro, supporto per tastiera e lettori di schermo, layout mobile.',
      'Test: `node --test` per plugin, motore, dati e traduzioni; test del browser nell’hub (tutte le lingue, accessibilità, input ostili, date fuori intervallo).',
      '`src/`, `plugins/` e `scripts/build.mjs`: l’unico `index.html` è ora costruito dai sorgenti e `--check` lo verifica.'
    ],
    es: [
      'Un conversor funcional entre once calendarios (gregoriano, juliano, juliano revisado, hebreo, hégira tabular, persa, copto, etíope, lunisolar chino, maya, fecha solar marciana), un plugin probado para cada uno.',
      'Vista mensual con un segundo calendario, notas sobre el estilo antiguo/nuevo en Rumanía, Pascua occidental y ortodoxa, términos solares y Año Nuevo chino, y un atlas construido a partir de `data/calendars/`.',
      'Interfaz en ocho idiomas (con el orden de fecha de cada idioma), temas oscuro y claro, compatibilidad con teclado y lectores de pantalla, diseño móvil.',
      'Pruebas: `node --test` para plugins, motor, datos y traducciones; pruebas de navegador en el hub (todos los idiomas, accesibilidad, entradas hostiles, fechas fuera de intervalo).',
      '`src/`, `plugins/` y `scripts/build.mjs`: el único `index.html` se construye ahora a partir de las fuentes, y `--check` lo verifica.'
    ],
    pt: [
      'Um conversor funcional entre onze calendários (gregoriano, juliano, juliano revisto, hebraico, hégira tabular, persa, copta, etíope, lunissolar chinês, maia, data solar marciana), um plugin testado para cada um.',
      'Vista mensal com um segundo calendário, notas sobre o estilo antigo/novo na Roménia, Páscoa ocidental e ortodoxa, termos solares e Ano Novo chinês, e um atlas construído a partir de `data/calendars/`.',
      'Interface em oito idiomas (com a ordem da data de cada idioma), temas escuro e claro, suporte para teclado e leitores de ecrã, disposição para telemóvel.',
      'Testes: `node --test` para plugins, motor, dados e traduções; testes de navegador no hub (todos os idiomas, acessibilidade, entradas hostis, datas fora do intervalo).',
      '`src/`, `plugins/` e `scripts/build.mjs`: o único `index.html` é agora construído a partir das fontes, e `--check` verifica-o.'
    ],
    de: [
      'Ein funktionierender Umrechner zwischen elf Kalendern (gregorianisch, julianisch, revidiert julianisch, hebräisch, Hidschri tabellarisch, persisch, koptisch, äthiopisch, chinesisch lunisolar, Maya, Marssol-Datum), je ein getestetes Plugin.',
      'Monatsansicht mit zweitem Kalender, Hinweise zu altem/neuem Stil in Rumänien, westliches und orthodoxes Ostern, chinesische Sonnenjahrpunkte und Neujahr sowie ein Atlas aus `data/calendars/`.',
      'Oberfläche in acht Sprachen (mit der Datumsreihenfolge jeder Sprache), dunkles und helles Design, Tastatur- und Screenreader-Unterstützung, mobiles Layout.',
      'Tests: `node --test` für Plugins, Engine, Daten und Übersetzungen; Browsertests im Hub (alle Sprachen, Barrierefreiheit, feindliche Eingaben, Daten außerhalb des Bereichs).',
      '`src/`, `plugins/` und `scripts/build.mjs`: Die eine `index.html` wird jetzt aus Quellen gebaut, `--check` prüft sie.'
    ],
    hu: [
      'Működő átváltó tizenegy naptár között (Gergely, Julián, Javított Julián, héber, táblázatos hidzsra, perzsa, kopt, etióp, kínai holdnaptár-napnaptár, maja, Mars-szoláris dátum), mindegyikhez egy tesztelt bővítmény.',
      'Havi nézet második naptárral, jegyzetek a romániai régi/új időszámításról, nyugati és ortodox húsvét, kínai napévszakok és újév, valamint a `data/calendars/` fájlokból épülő atlasz.',
      'Nyolc nyelvű felület (nyelvenként a dátum szokásos sorrendjével), sötét és világos téma, billentyűzet- és képernyőolvasó-támogatás, mobil elrendezés.',
      'Tesztek: `node --test` a bővítményekhez, a motorhoz, az adatokhoz és a fordításokhoz; böngészőtesztek a hubban (minden nyelv, akadálymentesség, ellenséges bemenetek, tartományon kívüli dátumok).',
      '`src/`, `plugins/` és `scripts/build.mjs`: az egyetlen `index.html` mostantól forrásokból épül, és a `--check` ellenőrzi.'
    ]
  };
  for (const l of Object.keys(added)) added[l] = [...added[l], ...legacy[l]];

  return {
    slug: 'calendarium', version: '0.2.0', updated: '2026-11-17',
    headings: {
      does: {en: 'What it does', ro: 'Ce face', fr: 'Ce que fait l’application', it: 'Cosa fa', es: 'Qué hace', pt: 'O que faz', de: 'Was es kann', hu: 'Mit tud'},
      how: {en: 'How it works', ro: 'Cum funcționează', fr: 'Comment ça marche', it: 'Come funziona', es: 'Cómo funciona', pt: 'Como funciona', de: 'Wie es funktioniert', hu: 'Hogyan működik'},
      limits: limHeading
    },
    status: {
      en: 'Alpha, usable: the converter, the month view, the Romanian date notes and the atlas work in the single `index.html` (open it offline, no server). Eleven calendars are implemented as plugins with tests; the limits are listed below.',
      ro: 'Alfa, utilizabil: convertorul, vederea lunară, notele despre datele românești și atlasul funcționează în singurul fișier `index.html` (îl deschizi offline, fără server). Unsprezece calendare sunt implementate ca plugin-uri cu teste; limitele sunt enumerate mai jos.',
      fr: 'Alpha, utilisable : le convertisseur, la vue du mois, les notes sur les dates roumaines et l’atlas fonctionnent dans l’unique fichier `index.html` (à ouvrir hors ligne, sans serveur). Onze calendriers sont implémentés sous forme de plugins avec tests ; les limites sont indiquées plus bas.',
      it: 'Alpha, utilizzabile: il convertitore, la vista mensile, le note sulle date romene e l’atlante funzionano nell’unico file `index.html` (si apre offline, senza server). Undici calendari sono implementati come plugin con test; i limiti sono elencati più sotto.',
      es: 'Alfa, utilizable: el conversor, la vista mensual, las notas sobre fechas rumanas y el atlas funcionan en el único archivo `index.html` (se abre sin conexión, sin servidor). Once calendarios están implementados como plugins con pruebas; los límites se enumeran más abajo.',
      pt: 'Alfa, utilizável: o conversor, a vista mensal, as notas sobre datas romenas e o atlas funcionam no único ficheiro `index.html` (abre-se offline, sem servidor). Onze calendários estão implementados como plugins com testes; os limites estão listados abaixo.',
      de: 'Alpha, nutzbar: Umrechner, Monatsansicht, Hinweise zu rumänischen Daten und Atlas laufen in der einen Datei `index.html` (offline öffnen, ohne Server). Elf Kalender sind als Plugins mit Tests umgesetzt; die Grenzen stehen weiter unten.',
      hu: 'Alfa, használható: az átváltó, a havi nézet, a román dátumokról szóló jegyzetek és az atlasz az egyetlen `index.html` fájlban működik (offline nyitható, szerver nélkül). Tizenegy naptár van megvalósítva tesztelt bővítményként; a korlátok lent olvashatók.'
    },
    does: {
      en: [
        'Type a date in any calendar and see the same day in all the others: Gregorian, Julian, Revised Julian (Milanković), Hebrew, Hijri (tabular), Persian (Solar Hijri), Coptic, Ethiopian, Chinese lunisolar (with leap months), Maya (Long Count, Tzolk’in, Haab’) and the Mars Sol Date.',
        'Julian Day, Modified Julian Day, weekday, ISO week, day of the year and days since 1970-01-01.',
        'Month view with a second calendar under each day; click a day to convert it.',
        'Romanian notes: old style / new style and the gap in days, the 1919 switch in the Old Kingdom, a note on Transylvania, Banat and Bukovina, Western and Orthodox Easter.',
        'Chinese solar terms and New Year for the chosen year; an atlas of the calendars built from `data/calendars/*.json`.',
        'Interface in eight languages, dark and light themes, keyboard accessible; no network, no tracking.'
      ],
      ro: [
        'Scrii o dată în orice calendar și vezi aceeași zi în toate celelalte: gregorian, iulian, iulian revizuit (Milanković), ebraic, hijri (tabelar), persan (hijri solar), copt, etiopian, lunisolar chinez (cu luni bisecte), maya (Long Count, Tzolk’in, Haab’) și ziua solară marțiană.',
        'Zi iuliană, zi iuliană modificată, ziua săptămânii, săptămâna ISO, ziua din an și zilele de la 1970-01-01.',
        'Vedere lunară cu al doilea calendar sub fiecare zi; un clic pe zi o convertește.',
        'Note românești: stil vechi / stil nou și diferența în zile, trecerea din 1919 în Vechiul Regat, o notă despre Transilvania, Banat și Bucovina, Paștele occidental și ortodox.',
        'Termenii solari chinezești și Anul Nou pentru anul ales; un atlas al calendarelor construit din `data/calendars/*.json`.',
        'Interfață în opt limbi, teme întunecată și luminoasă, accesibilă de la tastatură; fără rețea, fără urmărire.'
      ],
      fr: [
        'Saisissez une date dans n’importe quel calendrier et voyez le même jour dans tous les autres : grégorien, julien, julien révisé (Milanković), hébraïque, hégirien (tabulaire), persan (hégire solaire), copte, éthiopien, luni-solaire chinois (avec mois intercalaires), maya (Compte long, Tzolk’in, Haab’) et date solaire martienne.',
        'Jour julien, jour julien modifié, jour de la semaine, semaine ISO, jour de l’année et jours depuis 1970-01-01.',
        'Vue du mois avec un second calendrier sous chaque jour ; un clic sur un jour le convertit.',
        'Notes roumaines : ancien style / nouveau style et écart en jours, le passage de 1919 dans le Vieux Royaume, une note sur la Transylvanie, le Banat et la Bucovine, Pâques occidentales et orthodoxes.',
        'Termes solaires chinois et Nouvel An de l’année choisie ; un atlas des calendriers construit à partir de `data/calendars/*.json`.',
        'Interface en huit langues, thèmes sombre et clair, accessible au clavier ; sans réseau, sans suivi.'
      ],
      it: [
        'Digita una data in qualsiasi calendario e vedi lo stesso giorno in tutti gli altri: gregoriano, giuliano, giuliano riveduto (Milanković), ebraico, egiriano (tabulare), persiano (Egira solare), copto, etiope, lunisolare cinese (con mesi intercalari), maya (Lungo Computo, Tzolk’in, Haab’) e data solare marziana.',
        'Giorno giuliano, giorno giuliano modificato, giorno della settimana, settimana ISO, giorno dell’anno e giorni dal 1970-01-01.',
        'Vista mensile con un secondo calendario sotto ogni giorno; un clic su un giorno lo converte.',
        'Note romene: stile vecchio / stile nuovo e differenza in giorni, il passaggio del 1919 nel Vecchio Regno, una nota su Transilvania, Banato e Bucovina, Pasqua occidentale e ortodossa.',
        'Termini solari cinesi e Capodanno dell’anno scelto; un atlante dei calendari costruito da `data/calendars/*.json`.',
        'Interfaccia in otto lingue, temi scuro e chiaro, accessibile da tastiera; senza rete, senza tracciamento.'
      ],
      es: [
        'Escribe una fecha en cualquier calendario y mira el mismo día en todos los demás: gregoriano, juliano, juliano revisado (Milanković), hebreo, hégira (tabular), persa (Hégira solar), copto, etíope, lunisolar chino (con meses intercalares), maya (Cuenta Larga, Tzolk’in, Haab’) y fecha solar marciana.',
        'Día juliano, día juliano modificado, día de la semana, semana ISO, día del año y días desde 1970-01-01.',
        'Vista mensual con un segundo calendario bajo cada día; un clic en un día lo convierte.',
        'Notas rumanas: estilo antiguo / estilo nuevo y diferencia en días, el cambio de 1919 en el Viejo Reino, una nota sobre Transilvania, el Banato y Bucovina, Pascua occidental y ortodoxa.',
        'Términos solares chinos y Año Nuevo del año elegido; un atlas de los calendarios construido a partir de `data/calendars/*.json`.',
        'Interfaz en ocho idiomas, temas oscuro y claro, accesible por teclado; sin red, sin rastreo.'
      ],
      pt: [
        'Escreva uma data em qualquer calendário e veja o mesmo dia em todos os outros: gregoriano, juliano, juliano revisto (Milanković), hebraico, hégira (tabular), persa (Hégira solar), copta, etíope, lunissolar chinês (com meses intercalares), maia (Contagem Longa, Tzolk’in, Haab’) e data solar marciana.',
        'Dia juliano, dia juliano modificado, dia da semana, semana ISO, dia do ano e dias desde 1970-01-01.',
        'Vista mensal com um segundo calendário sob cada dia; um clique num dia converte-o.',
        'Notas romenas: estilo antigo / estilo novo e diferença em dias, a mudança de 1919 no Velho Reino, uma nota sobre a Transilvânia, o Banato e a Bucovina, Páscoa ocidental e ortodoxa.',
        'Termos solares chineses e Ano Novo do ano escolhido; um atlas dos calendários construído a partir de `data/calendars/*.json`.',
        'Interface em oito idiomas, temas escuro e claro, acessível por teclado; sem rede, sem rastreamento.'
      ],
      de: [
        'Gib ein Datum in einem beliebigen Kalender ein und sieh denselben Tag in allen anderen: gregorianisch, julianisch, revidiert julianisch (Milanković), hebräisch, Hidschri (tabellarisch), persisch (Sonnen-Hidschra), koptisch, äthiopisch, chinesisch lunisolar (mit Schaltmonaten), Maya (Lange Zählung, Tzolk’in, Haab’) und Marssol-Datum.',
        'Julianisches Datum, modifiziertes Julianisches Datum, Wochentag, ISO-Woche, Tag des Jahres und Tage seit 1970-01-01.',
        'Monatsansicht mit einem zweiten Kalender unter jedem Tag; ein Klick auf einen Tag rechnet ihn um.',
        'Rumänien-Hinweise: alter / neuer Stil und die Differenz in Tagen, die Umstellung 1919 im Altreich, ein Hinweis zu Siebenbürgen, Banat und Bukowina, westliches und orthodoxes Ostern.',
        'Chinesische Sonnenjahrpunkte und Neujahr des gewählten Jahres; ein Kalenderatlas, aufgebaut aus `data/calendars/*.json`.',
        'Oberfläche in acht Sprachen, dunkles und helles Design, per Tastatur bedienbar; ohne Netz, ohne Tracking.'
      ],
      hu: [
        'Írj be egy dátumot bármelyik naptárban, és nézd meg ugyanazt a napot az összes többiben: Gergely, Julián, Javított Julián (Milanković), héber, hidzsra (táblázatos), perzsa (napéves hidzsra), kopt, etióp, kínai holdnaptár-napnaptár (szökőhónapokkal), maja (hosszú számolás, Tzolk’in, Haab’) és Mars-szoláris dátum.',
        'Julián-dátum, módosított Julián-dátum, a hét napja, ISO-hét, az év napja és az 1970-01-01 óta eltelt napok.',
        'Havi nézet, minden nap alatt egy második naptárral; egy napra kattintva átváltja.',
        'Román jegyzetek: régi / új időszámítás és a napokban mért eltérés, az 1919-es váltás a Régi Királyságban, megjegyzés Erdélyről, a Bánságról és Bukovináról, nyugati és ortodox húsvét.',
        'Kínai napévszakok és a választott év újéve; a naptárak atlasza a `data/calendars/*.json` fájlokból.',
        'Nyolc nyelvű felület, sötét és világos téma, billentyűzettel használható; hálózat és követés nélkül.'
      ]
    },
    how: {
      en: [
        '`plugins/<id>.js`: one ES module per calendar (`toJD`, `fromJD`, `format`, `fields`); the contract is described in `CONTRIBUTING.md`.',
        '`src/engine.mjs` is pure logic (no DOM); `src/ui.js`, `src/i18n.mjs` and `src/app.css` hold the interface.',
        '`node scripts/build.mjs` assembles everything into the single `index.html` (and `--check` verifies that it matches `src/`).',
        '`npm test` runs the tests: round trips over long ranges, known historical dates and the out-of-range guards. Development needs Node.js 24 or newer; the page itself needs only a browser with ES2017.'
      ],
      ro: [
        '`plugins/<id>.js`: un modul ES pe calendar (`toJD`, `fromJD`, `format`, `fields`); contractul este descris în `CONTRIBUTING.md`.',
        '`src/engine.mjs` este logică pură (fără DOM); `src/ui.js`, `src/i18n.mjs` și `src/app.css` conțin interfața.',
        '`node scripts/build.mjs` asamblează totul în singurul `index.html` (iar `--check` verifică dacă acesta corespunde cu `src/`).',
        '`npm test` rulează testele: dus-întors pe intervale lungi, date istorice cunoscute și protecțiile din afara intervalului. Dezvoltarea cere Node.js 24 sau mai nou; pagina în sine cere doar un browser cu ES2017.'
      ],
      fr: [
        '`plugins/<id>.js` : un module ES par calendrier (`toJD`, `fromJD`, `format`, `fields`) ; le contrat est décrit dans `CONTRIBUTING.md`.',
        '`src/engine.mjs` est de la logique pure (sans DOM) ; `src/ui.js`, `src/i18n.mjs` et `src/app.css` contiennent l’interface.',
        '`node scripts/build.mjs` assemble le tout dans l’unique `index.html` (et `--check` vérifie qu’il correspond à `src/`).',
        '`npm test` lance les tests : allers-retours sur de longues plages, dates historiques connues et garde-fous hors plage. Le développement demande Node.js 24 ou plus récent ; la page elle-même n’exige qu’un navigateur compatible ES2017.'
      ],
      it: [
        '`plugins/<id>.js`: un modulo ES per calendario (`toJD`, `fromJD`, `format`, `fields`); il contratto è descritto in `CONTRIBUTING.md`.',
        '`src/engine.mjs` è logica pura (senza DOM); `src/ui.js`, `src/i18n.mjs` e `src/app.css` contengono l’interfaccia.',
        '`node scripts/build.mjs` assembla tutto nell’unico `index.html` (e `--check` verifica che corrisponda a `src/`).',
        '`npm test` esegue i test: andata e ritorno su lunghi intervalli, date storiche note e protezioni fuori intervallo. Lo sviluppo richiede Node.js 24 o successivo; la pagina stessa richiede solo un browser con ES2017.'
      ],
      es: [
        '`plugins/<id>.js`: un módulo ES por calendario (`toJD`, `fromJD`, `format`, `fields`); el contrato se describe en `CONTRIBUTING.md`.',
        '`src/engine.mjs` es lógica pura (sin DOM); `src/ui.js`, `src/i18n.mjs` y `src/app.css` contienen la interfaz.',
        '`node scripts/build.mjs` ensambla todo en el único `index.html` (y `--check` verifica que coincide con `src/`).',
        '`npm test` ejecuta las pruebas: idas y vueltas en intervalos largos, fechas históricas conocidas y protecciones fuera de intervalo. El desarrollo requiere Node.js 24 o posterior; la página solo necesita un navegador con ES2017.'
      ],
      pt: [
        '`plugins/<id>.js`: um módulo ES por calendário (`toJD`, `fromJD`, `format`, `fields`); o contrato está descrito em `CONTRIBUTING.md`.',
        '`src/engine.mjs` é lógica pura (sem DOM); `src/ui.js`, `src/i18n.mjs` e `src/app.css` contêm a interface.',
        '`node scripts/build.mjs` monta tudo no único `index.html` (e `--check` verifica que coincide com `src/`).',
        '`npm test` executa os testes: idas e voltas em intervalos longos, datas históricas conhecidas e proteções fora do intervalo. O desenvolvimento exige Node.js 24 ou posterior; a página só precisa de um navegador com ES2017.'
      ],
      de: [
        '`plugins/<id>.js`: ein ES-Modul pro Kalender (`toJD`, `fromJD`, `format`, `fields`); der Vertrag steht in `CONTRIBUTING.md`.',
        '`src/engine.mjs` ist reine Logik (ohne DOM); `src/ui.js`, `src/i18n.mjs` und `src/app.css` enthalten die Oberfläche.',
        '`node scripts/build.mjs` setzt alles zur einen `index.html` zusammen (`--check` prüft, ob sie zu `src/` passt).',
        '`npm test` führt die Tests aus: Hin-und-zurück über lange Bereiche, bekannte historische Daten und Schutz außerhalb des Bereichs. Entwicklung braucht Node.js 24 oder neuer; die Seite selbst nur einen Browser mit ES2017.'
      ],
      hu: [
        '`plugins/<id>.js`: naptáranként egy ES-modul (`toJD`, `fromJD`, `format`, `fields`); a szerződést a `CONTRIBUTING.md` írja le.',
        'A `src/engine.mjs` tiszta logika (DOM nélkül); a `src/ui.js`, `src/i18n.mjs` és `src/app.css` adja a felületet.',
        'A `node scripts/build.mjs` az egyetlen `index.html` fájlba állít össze mindent (a `--check` ellenőrzi, hogy egyezik-e a `src/` tartalmával).',
        'Az `npm test` futtatja a teszteket: oda-vissza átváltás hosszú tartományokon, ismert történelmi dátumok és a tartományon kívüli védelem. A fejlesztéshez Node.js 24 vagy újabb kell; maga az oldal csak ES2017-et tudó böngészőt igényel.'
      ]
    },
    limits,
    extraSteps: {
      en: '5. To add a calendar, write `plugins/<id>.js` and its tests, then run `npm test` and `node scripts/build.mjs` (see `CONTRIBUTING.md`).',
      ro: '5. Pentru un calendar nou, scrie `plugins/<id>.js` și testele lui, apoi rulează `npm test` și `node scripts/build.mjs` (vezi `CONTRIBUTING.md`).',
      fr: '5. Pour ajouter un calendrier, écrivez `plugins/<id>.js` et ses tests, puis lancez `npm test` et `node scripts/build.mjs` (voir `CONTRIBUTING.md`).',
      it: '5. Per aggiungere un calendario, scrivi `plugins/<id>.js` e i suoi test, poi esegui `npm test` e `node scripts/build.mjs` (vedi `CONTRIBUTING.md`).',
      es: '5. Para añadir un calendario, escribe `plugins/<id>.js` y sus pruebas, y ejecuta `npm test` y `node scripts/build.mjs` (consulta `CONTRIBUTING.md`).',
      pt: '5. Para acrescentar um calendário, escreva `plugins/<id>.js` e os seus testes, depois execute `npm test` e `node scripts/build.mjs` (veja `CONTRIBUTING.md`).',
      de: '5. Für einen neuen Kalender schreibe `plugins/<id>.js` samt Tests und führe dann `npm test` und `node scripts/build.mjs` aus (siehe `CONTRIBUTING.md`).',
      hu: '5. Új naptárhoz írd meg a `plugins/<id>.js` fájlt és a teszteit, majd futtasd az `npm test` és a `node scripts/build.mjs` parancsot (lásd `CONTRIBUTING.md`).'
    },
    contrib: {
      heading: {en: 'Adding a calendar plugin', ro: 'Adăugarea unui plugin de calendar', fr: 'Ajouter un plugin de calendrier', it: 'Aggiungere un plugin di calendario', es: 'Añadir un plugin de calendario', pt: 'Acrescentar um plugin de calendário', de: 'Ein Kalender-Plugin hinzufügen', hu: 'Naptár-bővítmény hozzáadása'},
      body: {
        en: [
          '1. Add `data/calendars/<id>.json` (schema in `schema.json`) and run `python scripts/validate.py`.',
          '2. Write `plugins/<id>.js` as an ES module (ES2017 syntax, no imports) that exports `id`, `fields` and:',
          '   - `toJD(...fields)`: the Julian Day at 0h UT of the date, or `NaN` if the date does not exist or is out of range;',
          '   - `fromJD(jd)`: an object with the same fields (numeric fields are `NaN` outside the supported range);',
          '   - `format(date, L)`: the display string; `L.month(n)`, `L.era(year)`, `L.date(d, m, y)`, `L.t(key)` and `L.list(key)` come from the interface;',
          '   - optionally `monthList(year, L)` → `[{v, n}]` and `monthTitle(year, month, leap, L)`.',
          '3. Add the id to `ORDER` and `GROUPS` in `src/engine.mjs`, and the texts `cal_<id>`, `reg_<id>` and `rule_<id>` in all eight languages in `src/i18n.mjs`.',
          '4. Write tests in `test/`: round trips over a long range and known dates from a cited source; run `npm test`.',
          '5. Run `node scripts/build.mjs` and commit the regenerated `index.html` together with `src/`.'
        ].join('\n'),
        ro: [
          '1. Adaugă `data/calendars/<id>.json` (schema este în `schema.json`) și rulează `python scripts/validate.py`.',
          '2. Scrie `plugins/<id>.js` ca modul ES (sintaxă ES2017, fără importuri) care exportă `id`, `fields` și:',
          '   - `toJD(...fields)`: ziua iuliană la 0h UT a datei sau `NaN` dacă data nu există ori e în afara intervalului;',
          '   - `fromJD(jd)`: un obiect cu aceleași câmpuri (câmpurile numerice sunt `NaN` în afara intervalului acceptat);',
          '   - `format(date, L)`: șirul afișat; `L.month(n)`, `L.era(year)`, `L.date(d, m, y)`, `L.t(key)` și `L.list(key)` vin din interfață;',
          '   - opțional `monthList(year, L)` → `[{v, n}]` și `monthTitle(year, month, leap, L)`.',
          '3. Adaugă id-ul în `ORDER` și `GROUPS` din `src/engine.mjs`, iar textele `cal_<id>`, `reg_<id>` și `rule_<id>` în toate cele opt limbi din `src/i18n.mjs`.',
          '4. Scrie teste în `test/`: dus-întors pe un interval lung și date cunoscute dintr-o sursă citată; rulează `npm test`.',
          '5. Rulează `node scripts/build.mjs` și trimite `index.html` regenerat împreună cu `src/`.'
        ].join('\n'),
        fr: [
          '1. Ajoutez `data/calendars/<id>.json` (schéma dans `schema.json`) et lancez `python scripts/validate.py`.',
          '2. Écrivez `plugins/<id>.js` comme module ES (syntaxe ES2017, sans imports) qui exporte `id`, `fields` et :',
          '   - `toJD(...fields)` : le jour julien à 0 h UT de la date, ou `NaN` si la date n’existe pas ou est hors plage ;',
          '   - `fromJD(jd)` : un objet avec les mêmes champs (les champs numériques valent `NaN` hors de la plage prise en charge) ;',
          '   - `format(date, L)` : la chaîne affichée ; `L.month(n)`, `L.era(year)`, `L.date(d, m, y)`, `L.t(key)` et `L.list(key)` viennent de l’interface ;',
          '   - en option `monthList(year, L)` → `[{v, n}]` et `monthTitle(year, month, leap, L)`.',
          '3. Ajoutez l’identifiant à `ORDER` et `GROUPS` dans `src/engine.mjs`, et les textes `cal_<id>`, `reg_<id>` et `rule_<id>` dans les huit langues de `src/i18n.mjs`.',
          '4. Écrivez des tests dans `test/` : allers-retours sur une longue plage et dates connues d’une source citée ; lancez `npm test`.',
          '5. Lancez `node scripts/build.mjs` et validez l’`index.html` régénéré avec `src/`.'
        ].join('\n'),
        it: [
          '1. Aggiungi `data/calendars/<id>.json` (schema in `schema.json`) ed esegui `python scripts/validate.py`.',
          '2. Scrivi `plugins/<id>.js` come modulo ES (sintassi ES2017, senza import) che esporta `id`, `fields` e:',
          '   - `toJD(...fields)`: il giorno giuliano alle 0h UT della data, oppure `NaN` se la data non esiste o è fuori intervallo;',
          '   - `fromJD(jd)`: un oggetto con gli stessi campi (i campi numerici sono `NaN` fuori dall’intervallo supportato);',
          '   - `format(date, L)`: la stringa mostrata; `L.month(n)`, `L.era(year)`, `L.date(d, m, y)`, `L.t(key)` e `L.list(key)` arrivano dall’interfaccia;',
          '   - facoltativi `monthList(year, L)` → `[{v, n}]` e `monthTitle(year, month, leap, L)`.',
          '3. Aggiungi l’id a `ORDER` e `GROUPS` in `src/engine.mjs`, e i testi `cal_<id>`, `reg_<id>` e `rule_<id>` nelle otto lingue di `src/i18n.mjs`.',
          '4. Scrivi test in `test/`: andata e ritorno su un lungo intervallo e date note da una fonte citata; esegui `npm test`.',
          '5. Esegui `node scripts/build.mjs` e fai il commit dell’`index.html` rigenerato insieme a `src/`.'
        ].join('\n'),
        es: [
          '1. Añade `data/calendars/<id>.json` (esquema en `schema.json`) y ejecuta `python scripts/validate.py`.',
          '2. Escribe `plugins/<id>.js` como módulo ES (sintaxis ES2017, sin imports) que exporte `id`, `fields` y:',
          '   - `toJD(...fields)`: el día juliano a las 0 h UT de la fecha, o `NaN` si la fecha no existe o está fuera de intervalo;',
          '   - `fromJD(jd)`: un objeto con los mismos campos (los campos numéricos son `NaN` fuera del intervalo admitido);',
          '   - `format(date, L)`: la cadena que se muestra; `L.month(n)`, `L.era(year)`, `L.date(d, m, y)`, `L.t(key)` y `L.list(key)` vienen de la interfaz;',
          '   - opcionalmente `monthList(year, L)` → `[{v, n}]` y `monthTitle(year, month, leap, L)`.',
          '3. Añade el id a `ORDER` y `GROUPS` en `src/engine.mjs`, y los textos `cal_<id>`, `reg_<id>` y `rule_<id>` en los ocho idiomas de `src/i18n.mjs`.',
          '4. Escribe pruebas en `test/`: idas y vueltas en un intervalo largo y fechas conocidas de una fuente citada; ejecuta `npm test`.',
          '5. Ejecuta `node scripts/build.mjs` y haz commit del `index.html` regenerado junto con `src/`.'
        ].join('\n'),
        pt: [
          '1. Acrescente `data/calendars/<id>.json` (esquema em `schema.json`) e execute `python scripts/validate.py`.',
          '2. Escreva `plugins/<id>.js` como módulo ES (sintaxe ES2017, sem imports) que exporte `id`, `fields` e:',
          '   - `toJD(...fields)`: o dia juliano às 0 h UT da data, ou `NaN` se a data não existir ou estiver fora do intervalo;',
          '   - `fromJD(jd)`: um objeto com os mesmos campos (os campos numéricos são `NaN` fora do intervalo suportado);',
          '   - `format(date, L)`: o texto mostrado; `L.month(n)`, `L.era(year)`, `L.date(d, m, y)`, `L.t(key)` e `L.list(key)` vêm da interface;',
          '   - opcionalmente `monthList(year, L)` → `[{v, n}]` e `monthTitle(year, month, leap, L)`.',
          '3. Acrescente o id a `ORDER` e `GROUPS` em `src/engine.mjs`, e os textos `cal_<id>`, `reg_<id>` e `rule_<id>` nos oito idiomas de `src/i18n.mjs`.',
          '4. Escreva testes em `test/`: idas e voltas num intervalo longo e datas conhecidas de uma fonte citada; execute `npm test`.',
          '5. Execute `node scripts/build.mjs` e faça commit do `index.html` regenerado junto com `src/`.'
        ].join('\n'),
        de: [
          '1. Lege `data/calendars/<id>.json` an (Schema in `schema.json`) und führe `python scripts/validate.py` aus.',
          '2. Schreibe `plugins/<id>.js` als ES-Modul (ES2017-Syntax, ohne Imports), das `id`, `fields` und Folgendes exportiert:',
          '   - `toJD(...fields)`: den Julianischen Tag um 0 Uhr UT des Datums oder `NaN`, wenn das Datum nicht existiert oder außerhalb des Bereichs liegt;',
          '   - `fromJD(jd)`: ein Objekt mit denselben Feldern (numerische Felder sind außerhalb des unterstützten Bereichs `NaN`);',
          '   - `format(date, L)`: den angezeigten Text; `L.month(n)`, `L.era(year)`, `L.date(d, m, y)`, `L.t(key)` und `L.list(key)` kommen von der Oberfläche;',
          '   - optional `monthList(year, L)` → `[{v, n}]` und `monthTitle(year, month, leap, L)`.',
          '3. Trage die ID in `ORDER` und `GROUPS` in `src/engine.mjs` ein und die Texte `cal_<id>`, `reg_<id>` und `rule_<id>` in allen acht Sprachen in `src/i18n.mjs`.',
          '4. Schreibe Tests in `test/`: Hin-und-zurück über einen langen Bereich und bekannte Daten aus einer zitierten Quelle; führe `npm test` aus.',
          '5. Führe `node scripts/build.mjs` aus und committe die neu erzeugte `index.html` zusammen mit `src/`.'
        ].join('\n'),
        hu: [
          '1. Add hozzá a `data/calendars/<id>.json` fájlt (séma: `schema.json`), és futtasd: `python scripts/validate.py`.',
          '2. Írd meg a `plugins/<id>.js` fájlt ES-modulként (ES2017 szintaxis, importok nélkül), amely exportálja az `id`, `fields` elemeket és ezeket:',
          '   - `toJD(...fields)`: a dátum Julián-napja 0 órakor UT, vagy `NaN`, ha a dátum nem létezik vagy tartományon kívül esik;',
          '   - `fromJD(jd)`: ugyanezekkel a mezőkkel rendelkező objektum (a támogatott tartományon kívül a numerikus mezők `NaN`-ek);',
          '   - `format(date, L)`: a megjelenített szöveg; az `L.month(n)`, `L.era(year)`, `L.date(d, m, y)`, `L.t(key)` és `L.list(key)` a felülettől jön;',
          '   - opcionálisan `monthList(year, L)` → `[{v, n}]` és `monthTitle(year, month, leap, L)`.',
          '3. Vedd fel az azonosítót a `src/engine.mjs` `ORDER` és `GROUPS` listáiba, a `cal_<id>`, `reg_<id>` és `rule_<id>` szövegeket pedig mind a nyolc nyelven a `src/i18n.mjs` fájlba.',
          '4. Írj teszteket a `test/` mappába: oda-vissza átváltás hosszú tartományon és ismert dátumok idézett forrásból; futtasd: `npm test`.',
          '5. Futtasd a `node scripts/build.mjs` parancsot, és commitold az újragenerált `index.html` fájlt a `src/` mappával együtt.'
        ].join('\n')
      }
    },
    issues: {
      en: [
        'Add the French Republican calendar plugin (start from `data/calendars/example.json`; test 1 Vendémiaire An I = 1792-09-22 and 18 Brumaire An VIII = 1799-11-09)',
        'Add a Byzantine (Anno Mundi, year starting on 1 September) plugin for older Romanian documents',
        'Add the Indian national (Saka) calendar plugin with tests',
        'Add an Umm al-Qura Hijri variant from a cited, redistributable table of month starts',
        'Check the 1924 date of the Romanian Orthodox Church’s calendar change in a primary source and mark it verified',
        'Check the Chinese New Year and leap-month data before 1984 against an official table (for example the Hong Kong Observatory) and add tests',
        'Add arrow-key navigation to the month view'
      ],
      ro: [
        'Adaugă pluginul calendarului republican francez (pornește de la `data/calendars/example.json`; testează 1 Vendémiaire An I = 1792-09-22 și 18 Brumaire An VIII = 1799-11-09)',
        'Adaugă un plugin bizantin (Anno Mundi, anul începe la 1 septembrie) pentru documentele românești mai vechi',
        'Adaugă pluginul calendarului național indian (Saka), cu teste',
        'Adaugă varianta hijri Umm al-Qura dintr-un tabel citat și redistribuibil cu începuturile lunilor',
        'Verifică într-o sursă primară data din 1924 a schimbării calendarului Bisericii Ortodoxe Române și marchează-o ca verificată',
        'Verifică datele Anului Nou chinezesc și ale lunilor bisecte dinainte de 1984 față de un tabel oficial (de exemplu Observatorul din Hong Kong) și adaugă teste',
        'Adaugă navigarea cu săgețile în vederea lunară'
      ],
      fr: [
        'Ajouter le plugin du calendrier républicain français (partir de `data/calendars/example.json` ; tester 1er vendémiaire an I = 1792-09-22 et 18 brumaire an VIII = 1799-11-09)',
        'Ajouter un plugin byzantin (Anno Mundi, année commençant le 1er septembre) pour les anciens documents roumains',
        'Ajouter le plugin du calendrier national indien (Saka), avec tests',
        'Ajouter une variante hégirienne Umm al-Qura à partir d’une table citée et redistribuable des débuts de mois',
        'Vérifier dans une source primaire la date de 1924 du changement de calendrier de l’Église orthodoxe roumaine et la marquer comme vérifiée',
        'Vérifier les dates du Nouvel An chinois et des mois intercalaires avant 1984 avec une table officielle (par exemple l’Observatoire de Hong Kong) et ajouter des tests',
        'Ajouter la navigation aux flèches dans la vue du mois'
      ],
      it: [
        'Aggiungere il plugin del calendario repubblicano francese (partire da `data/calendars/example.json`; testare 1 vendemmiaio anno I = 1792-09-22 e 18 brumaio anno VIII = 1799-11-09)',
        'Aggiungere un plugin bizantino (Anno Mundi, anno che inizia il 1° settembre) per i documenti romeni più antichi',
        'Aggiungere il plugin del calendario nazionale indiano (Saka), con test',
        'Aggiungere una variante egiriana Umm al-Qura da una tabella citata e ridistribuibile degli inizi dei mesi',
        'Verificare in una fonte primaria la data del 1924 del cambio di calendario della Chiesa ortodossa romena e segnarla come verificata',
        'Verificare le date del Capodanno cinese e dei mesi intercalari prima del 1984 con una tabella ufficiale (per esempio l’Osservatorio di Hong Kong) e aggiungere test',
        'Aggiungere la navigazione con i tasti freccia nella vista mensile'
      ],
      es: [
        'Añadir el plugin del calendario republicano francés (partir de `data/calendars/example.json`; probar 1 vendimiario año I = 1792-09-22 y 18 brumario año VIII = 1799-11-09)',
        'Añadir un plugin bizantino (Anno Mundi, año que empieza el 1 de septiembre) para documentos rumanos antiguos',
        'Añadir el plugin del calendario nacional indio (Saka), con pruebas',
        'Añadir una variante hégira Umm al-Qura a partir de una tabla citada y redistribuible de inicios de mes',
        'Comprobar en una fuente primaria la fecha de 1924 del cambio de calendario de la Iglesia Ortodoxa Rumana y marcarla como verificada',
        'Comprobar las fechas del Año Nuevo chino y de los meses intercalares anteriores a 1984 con una tabla oficial (por ejemplo el Observatorio de Hong Kong) y añadir pruebas',
        'Añadir la navegación con las teclas de flecha en la vista mensual'
      ],
      pt: [
        'Acrescentar o plugin do calendário republicano francês (partir de `data/calendars/example.json`; testar 1 vindimário ano I = 1792-09-22 e 18 brumário ano VIII = 1799-11-09)',
        'Acrescentar um plugin bizantino (Anno Mundi, ano que começa a 1 de setembro) para documentos romenos antigos',
        'Acrescentar o plugin do calendário nacional indiano (Saka), com testes',
        'Acrescentar uma variante hégira Umm al-Qura a partir de uma tabela citada e redistribuível dos inícios dos meses',
        'Confirmar numa fonte primária a data de 1924 da mudança de calendário da Igreja Ortodoxa Romena e marcá-la como verificada',
        'Confirmar as datas do Ano Novo chinês e dos meses intercalares anteriores a 1984 com uma tabela oficial (por exemplo o Observatório de Hong Kong) e acrescentar testes',
        'Acrescentar a navegação com as teclas de seta na vista mensal'
      ],
      de: [
        'Das Plugin für den französischen Revolutionskalender hinzufügen (ausgehend von `data/calendars/example.json`; testen: 1. Vendémiaire An I = 1792-09-22 und 18. Brumaire An VIII = 1799-11-09)',
        'Ein byzantinisches Plugin (Anno Mundi, Jahresbeginn am 1. September) für ältere rumänische Dokumente hinzufügen',
        'Das Plugin für den indischen Nationalkalender (Saka) mit Tests hinzufügen',
        'Eine Umm-al-Qura-Hidschri-Variante aus einer zitierten, weiterverbreitbaren Tabelle der Monatsanfänge hinzufügen',
        'Das Datum 1924 der Kalenderumstellung der Rumänisch-Orthodoxen Kirche in einer Primärquelle prüfen und als geprüft markieren',
        'Chinesisches Neujahr und Schaltmonate vor 1984 mit einer amtlichen Tabelle (zum Beispiel dem Hong Kong Observatory) abgleichen und Tests ergänzen',
        'Pfeiltasten-Navigation in der Monatsansicht hinzufügen'
      ],
      hu: [
        'A francia forradalmi naptár bővítményének hozzáadása (kiindulás: `data/calendars/example.json`; teszt: I. év vendémiaire 1. = 1792-09-22 és VIII. év brumaire 18. = 1799-11-09)',
        'Bizánci (Anno Mundi, szeptember 1-jén induló év) bővítmény hozzáadása a régebbi román iratokhoz',
        'Az indiai nemzeti (Szaka) naptár bővítményének hozzáadása tesztekkel',
        'Umm al-Qura hidzsra-változat hozzáadása a hónapkezdetek idézett, szabadon terjeszthető táblázatából',
        'A Román Ortodox Egyház 1924-es naptárváltásának dátumát elsődleges forrásban ellenőrizni és ellenőrzöttnek jelölni',
        'Az 1984 előtti kínai újév- és szökőhónap-adatokat hivatalos táblázattal (például a hongkongi obszervatóriuméval) összevetni és teszteket írni',
        'Nyílbillentyűs navigáció hozzáadása a havi nézethez'
      ]
    },
    changelog: {
      added,
      changed: {
        en: ['`data/calendars/example.json` now describes the French Republican calendar (no plugin yet) as the template for contributors.', 'The workflow runs on Ubuntu 26.04 with Node.js 26 and also runs the tests and the build check.'],
        ro: ['`data/calendars/example.json` descrie acum calendarul republican francez (încă fără plugin) ca model pentru contribuitori.', 'Fluxul de lucru rulează pe Ubuntu 26.04 cu Node.js 26 și rulează și testele, plus verificarea construcției.'],
        fr: ['`data/calendars/example.json` décrit désormais le calendrier républicain français (pas encore de plugin) comme modèle pour les contributeurs.', 'Le workflow s’exécute sur Ubuntu 26.04 avec Node.js 26 et lance aussi les tests et la vérification de la construction.'],
        it: ['`data/calendars/example.json` descrive ora il calendario repubblicano francese (ancora senza plugin) come modello per i contributori.', 'Il workflow gira su Ubuntu 26.04 con Node.js 26 ed esegue anche i test e il controllo della build.'],
        es: ['`data/calendars/example.json` describe ahora el calendario republicano francés (aún sin plugin) como plantilla para colaboradores.', 'El workflow se ejecuta en Ubuntu 26.04 con Node.js 26 y ejecuta también las pruebas y la comprobación de la compilación.'],
        pt: ['`data/calendars/example.json` descreve agora o calendário republicano francês (ainda sem plugin) como modelo para colaboradores.', 'O workflow corre em Ubuntu 26.04 com Node.js 26 e executa também os testes e a verificação da compilação.'],
        de: ['`data/calendars/example.json` beschreibt jetzt den französischen Revolutionskalender (noch ohne Plugin) als Vorlage für Beitragende.', 'Der Workflow läuft auf Ubuntu 26.04 mit Node.js 26 und führt auch die Tests und die Build-Prüfung aus.'],
        hu: ['A `data/calendars/example.json` mostantól a francia forradalmi naptárat írja le (még bővítmény nélkül), sablonként a közreműködőknek.', 'A munkafolyamat Ubuntu 26.04 és Node.js 26 alatt fut, és a teszteket meg a build-ellenőrzést is futtatja.']
      }
    }
  };
}
