# Decibel

[English](README.md) · [Română](README.ro.md) · [Français](README.fr.md) · **Italiano** · [Español](README.es.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · [Magyar](README.hu.md)

**Versione:** 1.0.0 · **Ultimo aggiornamento:** 2026-10-14

Lingue dell'interfaccia: **Română, English, Français, Italiano, Español, Português (PT), Deutsch, Magyar**

Fonometro, analizzatore di spettro e test uditivo indicativo, in un unico file HTML. Misura il livello sonoro in tempo reale con le ponderazioni A, C e Z (IEC 61672, filtri IIR), le costanti di tempo Fast/Slow, il LAeq su un intervallo scelto, Lmax/Lmin, L10/L50/L90, un istogramma, il SEL e la dose di rumore rispetto a un limite scelto. Mostra lo spettro in bande di 1/3 di ottava e di 1/1 ottava (20 Hz–20 kHz) e una FFT lineare, con la frequenza di picco e uno spettrogramma. Include la calibrazione con scostamento in dB, un generatore di rumore rosa/bianco e di sinusoide a 1 kHz, un test audiometrico separato e un registro locale delle sessioni. Completa le app audio FrequencyLaboratory, generator-frecvente, Aurora, CalmWaves e ASMR.

![schermata](screenshot.png)

**App online:** https://chiuta.github.io/apps/Decibel/

## Come si usa

1. **Misura:** premi «Pornește microfonul» (Avvia il microfono; il browser chiede l'autorizzazione), scegli la ponderazione e la costante di tempo. «Marchează eveniment» (Segna evento, o il tasto M) inserisce un indicatore nel grafico. «Analizează fișier audio…» (Analizza file audio…) e «Încarcă exemplu» (Carica esempio) usano lo stesso motore, senza microfono.
2. **Calibrazione:** senza calibrazione, i valori sono in dBFS (non in dB SPL). Inserisci uno scostamento manuale o usa la procedura guidata: misura per 10 s un calibratore o un fonometro di riferimento, e tu inserisci il livello di riferimento. Lo scostamento viene salvato per profilo (microfono e browser) e applicato retroattivamente.
3. **Spettro:** bande di 1/3 o 1/1 di ottava, FFT lineare (finestra di Hann), picco con interpolazione parabolica, spettrogramma; curve NR solo per i valori calibrati.
4. **Audiogramma:** toni puri da 250 Hz a 8 kHz, metodo di Hughson–Westlake semplificato. Senza calibrare le cuffie con un fonometro, il risultato è solo una soglia relativa, non dB HL.
5. **Registro:** le sessioni (data, durata, LAeq, Lmax, posizione) vengono salvate localmente; esportazione in CSV, JSON, `.fff.json` e stampa (PDF dalla finestra di stampa). Il pulsante «Șterge tot» (Cancella tutto) elimina tutti i dati locali.

## Cosa NON fa, e limiti

- **Non è un fonometro certificato.** I microfoni di telefoni/portatili non sono calibrati, hanno una risposta in frequenza irregolare, compressione, e saturano oltre ~90–100 dB. Le misure NON hanno valore legale e NON sostituiscono la valutazione dell'esposizione al rumore prevista dalla sicurezza sul lavoro; verifica la normativa applicabile.
- La dose usa limiti indicativi (NIOSH 85 dB(A)/8 h con tasso di scambio di 3 dB, le raccomandazioni UE di 80/85/87 dB(A) della direttiva 2003/10/CE, o valori personalizzati); non vengono inventati valori legali.
- L'incertezza mostrata è indicativa (±3/±4/±5 dB a seconda del metodo di calibrazione, con +5 dB al di fuori dell'intervallo 35–90 dB).
- La verifica dei filtri rispetto alle tolleranze di classe 2 riguarda solo i filtri; le tabelle e le tolleranze sono state trascritte a memoria e possono contenere piccoli errori. Oltre ~8 kHz i filtri bilineari si discostano dalla forma analogica.
- Lmax/Lmin/L10/L50/L90 escludono i primi 0,5 s (Fast) o 3 s (Slow). Le sessioni inferiori a 5 s non vengono salvate automaticamente.
- Nessuna curva NC (valori inaffidabili); NR si basa sui coefficienti ISO R 1996, trascritti a memoria.
- **L'audiogramma non è un test medico** e non offre alcuna interpretazione clinica. I valori RETSPL predefiniti (TDH-39) sono modificabili e sono stati trascritti a memoria. In caso di problemi di udito, consulta un otorinolaringoiatra o un audiologo.
- La modalità file usa il primo canale, per un massimo di 60 minuti. I bundle cifrati non sono accettati.
- Il browser può ignorare la disattivazione di AGC/cancellazione dell'eco/riduzione del rumore; l'app verifica e avvisa.

## Privacy

Funziona in locale e non invia nulla. Il suono non viene registrato e non lascia la pagina; viene elaborato in tempo reale. Le impostazioni, i profili di calibrazione e il registro sono conservati solo in `localStorage` (prefisso `fff.decibel.`), nel tuo browser.

## Formati supportati

File audio: WAV PCM 8/16/24/32 bit e float 32/64 (parser proprio), altri formati tramite il decodificatore del browser. Importazione/esportazione: `.fff.json`; esportazione CSV e JSON.

## Aspetti tecnici

- Un unico `index.html`, senza librerie esterne, senza rete. CSP rigorosa standard (`default-src 'none'`, script con hash SHA-256 ricalcolato con `fff-kit/lib/csp.mjs`, `connect-src 'none'`); non sono stati necessari adattamenti della CSP.
- Livello: dBFS RMS (una sinusoide a fondo scala = −3,01 dBFS); SPL = dBFS + scostamento, applicato in fase di visualizzazione.
- Ponderazioni: biquad bilineari dai poli della IEC 61672, normalizzati a 0 dB a 1 kHz. Tempo: media esponenziale dei quadrati (125 ms / 1 s).
- Spettro: FFT radix-2 propria, bande IEC 61260 in base 10. Microfono: `getUserMedia` + `ScriptProcessorNode` (AudioWorklet evitato a causa della CSP).
- Test: `node tests/test.mjs` (Playwright, microfono simulato con WAV generati: sinusoide a 1 kHz, rumore rosa, impulsi; axe, overflow a 360×740 e 1280×800, tastiera).

## Terze parti

Nessuna libreria o risorsa di terze parti.

## Traduzioni

La lingua predefinita è il rumeno. Le traduzioni in francese, italiano, spagnolo, portoghese, ungherese e tedesco sono automatiche e non sono state verificate da madrelingua.

## Licenza

Licenza: MIT — vedi il file `LICENSE` nella radice del repository

## Cronologia

- 1.0.0 — 2026-10-14: prima versione
