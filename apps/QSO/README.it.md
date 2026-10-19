# QSO — log di stazione radioamatoriale

[English](README.md) · [Română](README.ro.md) · [Français](README.fr.md) · **Italiano** · [Español](README.es.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · [Magyar](README.hu.md)

**Versione:** 1.0.1 · **Ultimo aggiornamento:** 2026-10-19

Lingue dell'interfaccia: **Română, English, Français, Italiano, Español, Português (PT), Deutsch, Magyar**

QSO è un log di stazione offline e non ufficiale per radioamatori: registri i collegamenti (data/ora UTC, nominativo, banda, modo, RST, locatore, QSL, contest), calcoli distanze e azimut dai locatori Maidenhead, rilevi i duplicati, importi ed esporti ADIF 3.1 (oltre a ADX, CSV, JSON, Cabrillo 3.0 di base), e vedi statistiche e una semplice mappa azimutale. Completa **ETER** (enciclopedia di radioamatorismo) e **INDICATIV** (allenatore per l'esame ANCOM), con la stessa terminologia; non li modifica e non dipende da essi.

![schermata](screenshot.png)

**Online:** https://chiuta.github.io/apps/QSO/

## Come si usa

1. **Stazione e impostazioni** → compila il profilo (nominativo, locatore proprio, potenza, operatore). Puoi avere più profili.
2. **Log** → compila il modulo e premi «Salva» (o `Ctrl+Invio`). L'orologio UTC è sempre presente nell'intestazione; «Orologio live» mantiene aggiornati data/ora, «Adesso» le reimposta. La frequenza sceglie la banda; il modo sceglie l'RST predefinito (59 / 599 / −10 per FT8, FT4).
3. Il nominativo viene validato formalmente al volo (YO/YP/YQ/YR + cifra + 1–3 lettere; formati internazionali generali, prefissi portatili `OH0/YO3ABC`, suffissi `/P`, `/M`, `/MM`); compaiono il paese (dalla tabella interna) e l'avviso di duplicato.
4. **Contest** → spunta «Modalità contest», scrivi CONTEST_ID; il numero progressivo (STX) si compila automaticamente e il «dupe» viene giudicato per contest (stessa stazione, banda e gruppo di modi CW/PH/DG).
5. La tabella: ricerca senza diacritici, filtri (banda, modo, anno, QSL, duplicati), ordinamento, **modifica in riga** (pulsante «Modifica» o doppio clic), dettagli (inclusi i campi ADIF sconosciuti), eliminazione con conferma, eliminazione della selezione, **annulla/ripeti**, stampa (CSS di stampa).
6. **Modalità campo** (`Alt+K`): modulo grande, utilizzabile senza mouse (`Alt+C` nominativo, `Alt+B`/`Alt+M` banda/modo, `Ctrl+Invio` salva, `Alt+Z`/`Alt+Y` annulla/ripeti, `Alt+1…5` sezioni, `Alt+H` elenco completo), grande orologio UTC sempre visibile e protezione dalla chiusura accidentale della pagina.
7. **Calcoli**: distanza/azimut tra due locatori, locatore ↔ coordinate, ora locale e alba/tramonto approssimativi, prefisso → paese.
8. **Statistiche**: per banda, modo, paese, anno; grafico dei QSO per ora (UTC); mappa azimutale centrata sulla propria stazione (SVG generato in locale).
9. **Importazione / Esportazione** e **copia di sicurezza** `.fff.json`; «Elimina tutto».

## Cosa NON fa e i suoi limiti

- **La tabella dei prefissi** è interna, parziale (~220 entità) e **NON è l'elenco DXCC completo** né uno strumento ufficiale. Le zone CQ/ITU compaiono solo dove sono certe per l'intera entità; dove variano all'interno di un paese (USA, Canada, Russia, Australia, Cina ecc.) compare «sconosciuto». Mancano le entità DXCC rare/distinte; un nominativo non coperto compare come «paese sconosciuto».
- Non verifica la licenza, l'effettiva validità di un nominativo né la validità di un collegamento per diplomi o contest. Non si connette a QRZ, LoTW, eQSL, Club Log ecc. (non ha rete).
- **Alba/tramonto**: formula semplice (NOAA semplificata, rifrazione 0,833°), errore tipico di qualche minuto; l'ora locale è l'ora solare media (longitudine/15), non il fuso orario ufficiale, e non include l'ora legale.
- **Distanze**: sfera R = 6371,0088 km, dal centro del quadrato del locatore; con 4 caratteri l'errore può arrivare a decine–centinaia di km. Non è una distanza sull'ellissoide.
- **Cabrillo** 3.0: solo intestazione + righe QSO in forma generica (frequenza in kHz, modo CW/PH/FM/RY/DG, scambio da STX/SRX o STX_STRING/SRX_STRING). I formati di scambio differiscono da contest a contest; controlla il regolamento e correggi a mano. Non calcola i punteggi.
- **ADIF**: le lunghezze sono lette in byte UTF-8 (con ripiego sui caratteri se il file è incoerente, segnalato nel rapporto). I campi sconosciuti e `APP_*` vengono conservati e riesportati; gli USERDEF dell'intestazione non vengono interpretati e non tutte le enumerazioni sono validate (ad es. DXCC, STATE). I campi `*_INTL` non sono trattati in modo speciale. ADX: importazione/esportazione di base.
- Nessuna mappa con i contorni dei continenti (non si caricano dati esterni): la mappa mostra i punti QSO per direzione e distanza.
- I dati risiedono in `localStorage`; cancellare i dati del sito nel browser elimina il log. Fai copie di sicurezza regolari (`.fff.json` o ADIF). Per decine di migliaia di QSO il limite del browser (~5 MB) può diventare un problema.

## Privacy

Funziona in locale e non invia nulla sulla rete (CSP con `connect-src 'none'`; 0 richieste esterne, verificato nei test). Il log, i profili e le impostazioni sono conservati solo nel tuo browser, con le chiavi `fff.qso.*`.

## Formati supportati

- Importazione: `.adi`/`.adif` (con o senza intestazione, `<EOH>`, `<EOR>`, tag in minuscolo, indicatore di tipo `<FREQ:9:N>`), `.adx`, `.csv` (intestazione con nomi di campo ADIF), `.json` (elenco di record) e `.fff.json` (copia di sicurezza, `{"format":"fff-bundle","schema":1,"app":"qso",…}`).
- Esportazione: `.adi` (ADIF 3.1.4, intestazione con `ADIF_VER`, `PROGRAMID`), `.adx`, `.csv` (UTF-8 con BOM), `.json`, Cabrillo 3.0, `.fff.json`.
- Campi ADIF scritti: STATION_CALLSIGN, OPERATOR, CALL, QSO_DATE, TIME_ON, BAND, FREQ, MODE, SUBMODE, RST_SENT, RST_RCVD, TX_PWR, MY_GRIDSQUARE, GRIDSQUARE, NAME, QTH, COMMENT, QSL_SENT, QSL_RCVD, CONTEST_ID, STX, SRX, STX_STRING, SRX_STRING, più qualsiasi altro campo importato.
- Bande (ADIF 3.1): 2190m, 630m, 560m, 160m … 10m, 8m, 6m, 5m, 4m, 2m, 1.25m, 70cm, 33cm, 23cm, 13cm, 9cm, 6cm, 3cm, con i limiti dell'enumerazione ADIF.

## Aspetti tecnici

Un unico `index.html` (HTML + CSS + JS inline, senza librerie, senza font esterni), ~165 KB. CSP: `default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; img-src data: blob:; …; connect-src 'none'; worker-src blob:` — `style-src 'unsafe-inline'` e `blob:` sono necessari per gli stili inline e per lo scaricamento dei file generati in locale (Blob). Nessun gestore inline, nessun `eval`. I record sono immutabili, il che rende economici annulla/ripeti (100 passi). La tabella è paginata (100 righe/pagina); la ricerca usa una cache di testo normalizzato; i duplicati si confrontano solo all'interno dello stesso nominativo. Test: `node tests/test.mjs` (Playwright, rete bloccata; axe-core viene letto da un percorso locale dell'ambiente di sviluppo): nominativi positivi/negativi, distanze rispetto a un'implementazione indipendente (legge dei coseni, decodifica separata dei locatori), round trip ADIF/ADX/CSV/JSON/`.fff.json` con diacritici e lunghezze in byte, 3000 QSO per le prestazioni, modalità campo da tastiera, 8 lingue, axe 0 violazioni a 360 px e 1280 px in entrambi i temi.

## Terze parti

Nessun codice di terze parti.

## Traduzioni

L'interfaccia è disponibile in romeno (predefinito), inglese, francese, italiano, spagnolo, portoghese, ungherese e tedesco. Le traduzioni fr/it/es/pt/hu/de sono **automatiche e non verificate da madrelingua**; i termini tecnici (ADIF, Cabrillo, QSO, RST, Maidenhead, DXCC) mantengono il loro nome. I nomi dei paesi nella tabella dei prefissi sono mostrati in romeno.

## Licenza

MIT — vedi il file `LICENSE` nella radice del repository.

## Cronologia

- **1.0.0 — 2026-10-14:** prima versione.
- **1.0.1 — 2026-10-19:** pulsante «Vedi in TerRa» nella finestra Dettagli QSO (locatore del corrispondente + ora del QSO, senza richieste di rete).
