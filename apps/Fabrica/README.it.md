# Fabrica

[English](README.md) · [Română](README.ro.md) · [Français](README.fr.md) · **Italiano** · [Español](README.es.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · [Magyar](README.hu.md)

**Versione:** 1.1.0 · **Ultimo aggiornamento:** 2026-10-19

Lingue dell'interfaccia: **Română, English, Français, Italiano, Español, Português (PT), Deutsch, Magyar**

Fabrica è una fabbrica di corsi e quiz: scrivi un corso (dati, avvertenze, livelli e lezioni in Markdown semplice, domande di sette tipi, glossario, quadro delle prove, test finale con banca di domande ed estrazione determinata da un seed), lo convalidi e lo esporti come **un unico file HTML autonomo** (facoltativamente uno ZIP con un README). Il file generato funziona offline e ha navigazione, progressi salvati localmente, ripetizione dilazionata per le domande sbagliate, test finale, attestato di completamento stampabile (senza valore di accreditamento), modalità chiara/scura e interfaccia in 8 lingue. Include un esempio completo («Come leggere un'etichetta nutrizionale») e tre modelli di partenza.

![schermata](screenshot.png)

**App online:** https://chiuta.github.io/apps/Fabrica/

## Come si usa

1. **Modelli** (in alto) → scegli «Corso breve con test», «Guida con quadro delle prove», «Quiz semplice» o l'esempio completo; oppure compila direttamente il pannello **Corso**.
2. **Corso**: titolo, descrizione, autore, licenza del contenuto, lingua del contenuto, versione, avvertenze (modelli: informativo, non è un consiglio medico / legale / finanziario), ambiti sensibili, colore di accento, attestato, ripetizione dilazionata.
3. **Contenuto**: livelli e lezioni (sposta su/giù, duplica, elimina); testo della lezione con barra Markdown (titoli, elenchi, grassetto/corsivo, link esterni e interni `[testo](lesson:id)`, tabelle, citazioni, immagini); domande di esercitazione per lezione.
4. **Tipi di domande**: scelta singola, scelta multipla, vero/falso, completamento (`[[risposta|variante]]`), ordinamento (con pulsanti su/giù, accessibile da tastiera), abbinamento di coppie, risposta breve (varianti accettate; il confronto ignora maiuscole, segni diacritici e punteggiatura). Ognuna ha una spiegazione e un feedback per risposta corretta/errata.
5. **Glossario** (`{gl:Termine}` nelle lezioni) e **Quadro delle prove**: affermazioni con un livello (studi controllati / osservazionale / tradizionale / senza prove), fonti testuali, indicate nelle lezioni con `{ev:ID}`.
6. **Test finale**: soglia, numero di domande estratte dalla banca, seed (stesso valore → stessa estrazione e stesso ordine), estrazione diversa a ogni tentativo (seed + numero del tentativo), facoltativamente anche le domande delle lezioni. «Simula l'estrazione» mostra il risultato.
7. **Convalida**: lezioni vuote, domande senza risposta corretta, link interni interrotti, immagini troppo grandi/esterne/senza testo alternativo, avvertenze mancanti per gli ambiti sensibili (esplicite o euristiche), fonti mancanti per le affermazioni, duplicati ecc. «Vai a» porta al punto del problema.
8. **Anteprima**: il file esatto come esportato, in un frame isolato (sandbox), a larghezza piena o a larghezza di telefono (360 px).
9. **Esportazione**: HTML, ZIP (index.html + README.md + sorgente `.course.json`), sorgente `.course.json`, copia di sicurezza `.fff.json`. **Importazione**: `.course.json`, l'HTML o lo ZIP esportato (il corso viene recuperato da essi), `.fff.json`; domande da **CSV** (colonne: `tip;întrebare;corect;greșit1;greșit2;greșit3;explicație`; tipi `unic, multi, adevarat-fals, completare, scurt, ordonare, potrivire`; le varianti multiple si separano con `|`, le coppie con `sinistra=destra`; delimitatore `,` `;` o tabulazione, virgolette RFC 4180).

Annulla/ripeti: i pulsanti nell'intestazione, `Ctrl+Z` / `Ctrl+Y` (fuori dai campi di testo) e il pulsante «Annulla» nella notifica dopo un'eliminazione.

## Cosa NON fa e i suoi limiti

- **Non accredita nulla.** L'attestato è un documento informativo locale, senza valore di accreditamento o riconoscimento; il suo testo lo dichiara.
- Non verifica la correttezza scientifica, giuridica o medica del contenuto: il validatore rileva problemi formali e (in modo euristico, in base a parole chiave) la mancanza di un'avvertenza; la responsabilità del contenuto resta dell'autore. Il livello di prova è scelto dall'autore; Fabrica non verifica le fonti.
- Niente account, niente sincronizzazione, niente collaborazione in tempo reale, niente server. I progressi del discente sono locali (nel suo browser) e non possono essere verificati da nessuno; il test non è sorvegliato (le risposte corrette sono nel file).
- Markdown è un sottoinsieme (titoli, elenchi annidati, grassetto/corsivo, codice, link, immagini, tabelle, citazioni, linea); niente HTML grezzo, niente formule matematiche, niente audio/video incorporato. Le immagini sono solo `data:` (png/jpeg/gif/webp), ridimensionate a un massimo di 1000 px all'inserimento; i link esterni non vengono verificati offline.
- L'ordinamento avviene con i pulsanti (non con il trascinamento). L'ordine casuale si basa su un generatore con seed, non su uno crittografico.
- L'interfaccia generata ha 8 lingue, ma il **contenuto** del corso è solo nella lingua scritta dall'autore. I modelli di partenza sono in romeno e inglese (le altre lingue ricevono la versione inglese); l'esempio completo è in romeno.
- Compressione ZIP: il writer incorporato usa «stored» (senza compressione); il lettore accetta anche ZIP compressi (deflate) dove il browser offre `DecompressionStream`.
- La bozza viene salvata in `localStorage`; se le immagini superano la quota, compare un avviso e occorre esportare il corso.

## Privacy

Funziona in locale e **non invia nulla** (`connect-src 'none'`). La bozza del corso è conservata solo in questo browser (`fff.fabrica.draft`, più lingua e tema); «Elimina tutto» le rimuove. Il file generato non contiene telemetria; i progressi del discente stanno in `fff.course.<id>.*` e possono essere esportati/importati/eliminati dalla pagina «Impostazioni e dati» del corso.

## Sicurezza e CSP

L'editor: `default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src about:; object-src 'none'; worker-src blob:; manifest-src 'none'`. Deroghe giustificate: `frame-src about:` per l'anteprima in frame isolato (`srcdoc`, `sandbox="allow-scripts allow-modals"`).

Il file generato: `default-src 'none'; script-src 'sha256-<hash>'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; media-src 'none'; worker-src 'none'; manifest-src 'none'`. **L'hash SHA-256 viene calcolato nel browser** (Web Crypto, con ripiego in JavaScript) al momento dell'esportazione, dal testo esatto dello script inserito, e scritto in `<meta http-equiv="Content-Security-Policy">`; dopo l'esportazione, Fabrica rianalizza il file e verifica l'hash, l'assenza di gestori inline e di risorse esterne. I dati del corso stanno in un blocco `application/json` non eseguibile (con `<`, `>`, `&` sottoposti a escape); tutti i testi sono sottoposti a escape alla visualizzazione, i link sono limitati a `https:`, `mailto:` e a percorsi interni.

## Formati

- `.course.json`: `{"format":"fabrica-course","schema":1,"app":"Fabrica","version":"1.0.0","saved":"…","course":{…}}` — lo schema è versionato; l'importazione normalizza e convalida (tipi, id univoci, una sola opzione corretta nella scelta singola, immagini `data:` consentite solo di tipo immagine) e rifiuta i file con schema più recente.
- `.fff.json` (copia di sicurezza): `{"format":"fff-bundle","schema":1,"app":"fabrica","version":"1.0.0","updated":"2026-10-14","data":{"draft":{…}}}`.
- Progressi del discente (dal file generato): `{"format":"fff-bundle","app":"course:<id>",…,"data":{"progress":{…}}}`.
- Importazione: `.course.json`, `.html`/`.zip` esportati, `.fff.json`, `.csv` (domande). Esportazione: `.html`, `.zip`, `.course.json`, `.fff.json`.

## Aspetti tecnici

Un unico `index.html` (HTML + CSS + JS inline, senza librerie esterne). Il motore del corso (player) è uno script separato nella pagina; **lo stesso testo** viene inserito nel file esportato e viene eseguito nell'anteprima, quindi l'anteprima è identica al risultato. La ripetizione dilazionata usa un SM-2 semplificato (EF minimo 1,3; intervalli di 1 giorno, 6 giorni, poi moltiplicazione per EF; in caso di errore l'intervallo torna a 1 giorno). Selezione del test: rimescolamento Fisher–Yates con generatore mulberry32 inizializzato da hash(seed + tentativo). Writer/reader ZIP e CRC-32 propri. Accessibilità: vere legende ed etichette, messaggi `aria-live`, focus gestito al cambio di pagina, contrasto AA in entrambi i temi (gli accenti si possono scegliere tra cinque tavolozze verificate), `prefers-reduced-motion`, tabelle scorrevoli con focus. Scorciatoie nel corso generato: `Alt+Shift+→` / `Alt+Shift+←` (lezione successiva/precedente).

I test (`tests/test.mjs`, Playwright, rete bloccata) coprono l'editor (struttura con annullamento, domande, validatore, importazione/esportazione, CSV, ZIP, immagini, anteprima, axe) e il **file generato caricato senza rete** (0 pageerror/CSP, hash CSP ricalcolato in Node, percorrenza delle lezioni, punteggio di ogni tipo, progressi persistenti, ripetizione, test con estrazione, attestato, 8 lingue, axe in entrambi i temi, 360 px).

## Terze parti

Nessun codice di terze parti. (I test usano Playwright e axe-core, solo in sviluppo.)

## Traduzioni

L'interfaccia dell'editor e dei corsi generati: romeno e inglese scritti dall'autore; **fr, it, es, pt, hu, de sono traduzioni automatiche, non verificate da madrelingua**. Le avvertenze dei modelli (informativo/medico/legale/finanziario) sono anch'esse traduzioni automatiche: dovrebbero essere verificate da un giurista/madrelingua prima dell'uso pubblico.

## Licenza

Licenza: MIT — vedi il file `LICENSE` nella radice del repository.

## Cronologia

- 1.0.0 — 2026-10-14: prima versione.
- 1.1.0 — 2026-10-19: esportazione «Quiz per Undava (.json)» e importazione da file Undava (.json) tramite il pulsante di importazione CSV; vengono trasferite solo le domande con un equivalente (scelta singola, vero/falso, risposta breve, completamento con un solo spazio).
