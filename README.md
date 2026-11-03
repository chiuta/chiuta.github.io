# chiuta.ro: hubul aplicațiilor „fără frontiere”

Hubul adună **117 aplicații** (113 pagini HTML unice, offline, plus 4 programe native: OSATURA, VERIGA, TEZAUR, LegatorOCR), kitul lor comun `fff-kit`, plicul `.fff.json` prin care își dau rezultate fără server, și uneltele care țin totul onest: catalogul, auditul, sănătatea surselor. Fără cont, fără telemetrie, fără reclame; licență MIT; interfață în 8 limbi (ro, en, fr, it, es, pt, de, hu).

*English in short:* a hub for 117 offline, trade-free apps (single HTML files + 4 native programs), their shared kit (`fff-kit`), the `.fff.json` envelope that lets them pass results to each other without a server, and the tooling that keeps the portfolio honest (catalog sync, a reproducible measured audit, source-health monitoring). Everything is in Romanian-first documentation; the UI of each app is in 8 languages.

## Ce găsești aici

| Cale | Ce este |
|---|---|
| `index.html` | catalogul (carduri, fișe, căutare universală, constelație, planificator „Spune-mi ce ai de făcut”) |
| `transparenta.html` | rezultatele auditurilor, **sănătatea portofoliului**, **auditul măsurat** (scor pe aplicație), sănătatea surselor externe; 8 limbi |
| `fff-kit/` | kitul comun (CSP, dialogul „Transparență”, copie de siguranță, i18n, p2p, sync, bridge…) și `build.mjs` |
| `tools/` | sincronizarea catalogului, motoarele comune `fff-*.js`, injectorul de plic, auditul (`audit-run.mjs`), tabloul de sănătate (`portfolio-health.mjs`), reîmprospătarea surselor (`refresh/`) |
| `data/` | `catalog-meta.json` (fișe, relații, acoperire, stare), `score-legacy.json` (arhiva scorului manual depreciat), `flows.json` (fluxuri), `sources.json` + `source-health.json` (surse externe), `transparenta.json` (audit + sănătate) |
| `docs/` | specificația plicului, descoperire, fluxuri, suita cer–timp, domenii, **ghidul autorilor**, **retrospectiva** |
| `tests/` | testele hubului (Node + Chromium, rețea blocată) |
| `ROADMAP.md` | ce urmează |

## Documentație

- [Ghidul autorilor](docs/GHID-AUTORI.md): cum conectezi o aplicație (plic, dovezi, acoperire, relații, surse, motoare comune, teste obligatorii, scorul).
- [Plicul FFF](docs/FFF-ENVELOPE.md) · [Descoperire](docs/DESCOPERIRE.md) · [Fluxuri](docs/FLUXURI.md) · [Suita cer–timp](docs/SUITA-CER-TIMP.md) · [Domenii](docs/DOMENII.md) · [Decizii ale autorului](docs/DECIZII-AUTOR.md)
- [Retrospectiva etapelor 0–8](docs/RETROSPECTIVA.md): ce s-a folosit, ce nu, ce se propune a fi scos (judecat pe date măsurate).
- [Revizuirea traducerilor automate](docs/TRADUCERI-REVIZIE.md): ce verifică controlul mecanic (`tools/traduceri-control.mjs`), ce s-a corectat, ce fișiere așteaptă vorbitori nativi · [cum corectezi și marchezi „revizuit de <nume>”](docs/TRADUCERI-CONTRIBUTIE.md).

## Comenzi uzuale

```bash
# catalog: sincronizare și verificare (rădăcina cu depozitele aplicațiilor)
node tools/sync-catalog.mjs --root <apps> && node tools/sync-catalog.mjs --root <apps> --check
node fff-kit/build.mjs fixcsp index.html

# audit măsurat și sănătatea portofoliului
node tools/audit-run.mjs --root <apps> --out /tmp/audit7        # build, axe, teste, fapte statice
node tools/transparenta.mjs audit                                # scor pe aplicație + health + fișele din catalog
node tools/transparenta.mjs build && node tools/transparenta.mjs --check

# surse externe
node --test tools/refresh/test.mjs
node tools/refresh/run.mjs --list

# testele hubului (pe rând; sunt lente în paralel)
node tools/make-fixtures.mjs --root <apps>                       # NU fără --root
for t in tests/*.test.mjs; do node $t || break; done
```

CI: `hub-test.yml` (catalog, transparență, offline, documente), `refresh-test.yml` (parsere și praguri), `refresh.yml` (reîmprospătarea periodică a surselor; rețeaua se folosește doar aici), `fff-check.yml` (workflow reutilizabil apelat de depozitele aplicațiilor).

## Principii

Offline și fără cont · clean-room · datele rămân ale utilizatorului · confirmare înainte de orice import · onestitate față de utilizator (limite scrise pe fișă) · opt limbi la același nivel · MIT; doar Buy Me a Coffee.

Autor: Alexandru-Ionuț Chiuță (Alexio), proiecte personale independente, nu servicii ale vreunei instituții.
