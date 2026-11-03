# Cum corectezi o traducere și o marchezi „revizuit de <nume>”

Dacă ești vorbitor nativ de franceză, italiană, spaniolă, portugheză (europeană), germană sau maghiară, mulțumim. Lista fișierelor care așteaptă revizuire este în [TRADUCERI-REVIZIE.md](TRADUCERI-REVIZIE.md). Nu trebuie să știi programare: poți trimite un fișier corectat sau o listă „așa → așa”, iar cineva o aplică.

## 1. Alege ce revizuiești

Revizuiești o **unitate într-o limbă**: de exemplu „demonstrațiile native, în maghiară” (4 fișiere `.vtt` + șirurile interfeței) sau „README-ul MENSURA în italiană” (un fișier). Unitățile sunt cele cinci din tabelul de stare. Poți face doar o parte, dar atunci **nu o marca revizuită** și scrie în ce ai citit.

## 2. Corectează

- Textul-sursă de lucru este cel englez; textul de autor este cel românesc. Compară cu ele, dar scrie ca vorbitor nativ, nu cuvânt cu cuvânt.
- Păstrează neschimbate comenzile, numele de fișiere și de formate (`ingest`, `.bib`, BibTeX, CSV, PNG), cifrele și etichetele interfeței românești ale TEZAUR din subtitrări (*Întreabă*, *Căutare* …).
- Subtitrările sunt citite și de o voce sintetică: evită simbolurile pe care sintetizatorul le citește prost și frazele mult mai lungi decât cele englezești.
- Pentru portugheză folosim varianta europeană (*ficheiro*, *descarregar*, *ecrã*).
- Unde textul spune ceva greșit, nu doar nenatural, scrie asta; e mai important decât stilul.

Unde se editează:

| Unitate | Fișier de editat | Apoi |
|---|---|---|
| Demonstrații native | `tools/native-demos/narration.py` (câte un `S(ro, en, fr, it, es, pt, de, hu)` pe scenă; șirurile interfeței în `UI`) | `python3 tools/native-demos/build.py` regenerează `.vtt`, audio, video și paginile |
| TEZAUR, tutoriale | `scripts/tutorials/tutorials.py` **și** `assets/tutorials/<id>.<limbă>.vtt` (același text în ambele) | — |
| TEZAUR, interfața web | `tezaur.html`, dicționarul `I18N` | — |
| README MENSURA / Fenarium | `README.<limbă>.md` din depozitul aplicației | — |

## 3. Marchează „revizuit de <nume>”

Marcajul are două părți care trebuie să coincidă; un test verifică asta.

**a) Registrul** — adaugă o intrare în [`data/traduceri-revizuite.json`](../data/traduceri-revizuite.json) (în hub):

```json
{"unit": "nativ", "lang": "hu", "by": "Prenume Nume", "date": "2026-12-01", "note": "toate subtitrările și interfața; fără voce"}
```

- `unit`: unul dintre `nativ`, `tezaur-tutoriale`, `tezaur-ui`, `mensura-readme`, `fenarium-readme`.
- `lang`: `fr`, `it`, `es`, `pt`, `de` sau `hu`.
- `by`: numele revizorului, așa cum vrea să apară public (minimum 3 caractere; fără `:`, `]`, `>`). Un nume de substituție (`nume`, `TODO`, `xxx`) este respins de test.
- `date`: data revizuirii, `AAAA-LL-ZZ`, nu în viitor.
- `note`: opțional, ce s-a acoperit.

**b) Fișierele** — marcajul din fiecare fișier al unității trece de la `automat` la `revizuit`. Forma este aceeași peste tot:

```
traducere: hu=automat                      →   traducere: hu=revizuit:Prenume_Nume:2026-12-01
```

(spațiile din nume devin `_`; data e cea din registru). Unde se află marcajul:

| Unitate | Marcaj | Fraza vizibilă |
|---|---|---|
| Demonstrații native | se scrie singur: `build.py` îl pune în `demo/nativ/index.html` din registru | nota din pagină se rescrie singură („Revizuite de vorbitori nativi: hu (Prenume Nume, 2026-12-01)”) |
| TEZAUR, tutoriale | `scripts/tutorials/tutorials.py`, `scripts/tutorials/README.md`, `index.html` (comentariu `<!-- traducere: … -->`) | scoate limba din „Traducerile în fr, it, … sunt automate” din `index.html` |
| TEZAUR, interfața web | comentariul `[traducere: …]` din `tezaur.html` | — |
| README | linia `<!-- traducere: hu=automat -->` de la sfârșitul `README.hu.md` | înlocuiește propoziția „traducerile … sunt automate și neverificate de vorbitori nativi” cu „Revizuit de Prenume Nume (2026-12-01).” în limba fișierului |

**c) Rulează controlul** (și regenerează lista):

```
node tools/traduceri-control.mjs --apps <apps> --tezaur <TEZAUR> --check
node tools/traduceri-control.mjs --report
node tests/traduceri.test.mjs
```

## Ce garantează testul

[`tests/traduceri.test.mjs`](../tests/traduceri.test.mjs) pică dacă:

- marcajul `automat` a dispărut dintr-un fișier fără o intrare corespunzătoare în registru;
- registrul spune „revizuit” dar fișierul are încă `automat`;
- o intrare din registru are numele gol sau de substituție, data invalidă sau în viitor, ori o limbă sau unitate necunoscută;
- marcajul din fișier are alt nume sau altă dată decât registrul;
- fraza vizibilă despre traducerea automată a rămas într-o limbă marcată revizuită (sau lipsește într-una marcată automat).

Nu garantează că revizuirea s-a făcut cu adevărat: asta rămâne pe încrederea în numele din registru.
