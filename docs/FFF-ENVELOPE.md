# Plicul FFF (`.fff.json`) — specificație v1

Plicul este formatul comun prin care aplicațiile „fără frontiere” își dau rezultate una alteia **fără server**: un fișier JSON mic, cu tip, titlu, conținut, sursă și nivel de dovezi. Aplicațiile rămân fișiere HTML unice, offline, cu `connect-src 'none'`; plicul circulă prin fișier, clipboard, cod QR, link cu fragment (`#fff=…`) sau între file ale aceluiași browser (BroadcastChannel).

- Codul comun: [`tools/fff-envelope.js`](../tools/fff-envelope.js) (creare, validare, semnare, transport, meniul „Trimite către…”) și [`tools/fff-seif.js`](../tools/fff-seif.js) (seiful comun de chei API).
- Injectare în aplicații: `node tools/inject-shared.mjs <dir> <slug> [--release "<notă>"]`; verificare că copiile sunt identice cu sursa: `node tools/inject-shared.mjs --check <dir> <slug>`. Nu se copiază de mână.
- Teste: `node tests/envelope.test.mjs` (Node, fără browser, rulează în CI) și `node tests/envelope-pilots.test.mjs` (Chromium, aplicațiile reale, rețea oprită).

## 1. Câmpuri

| Câmp | Obligatoriu | Tip | Sens |
|---|---|---|---|
| `fff` | da | întreg | Versiunea schemei canonice: `2`. (Forma de transport „compat” poartă `1`, vezi §3.) |
| `type` | da | text `tip/subtip` | `table/csv`, `citation/csl`, `text/markdown`, `text/plain`, `quiz/undava`, `geo/gpx`, `events/ics`, `note/akasha`, `cards/qa`, `link/fff`, `clips/list`, `chat/transcript`, `keys/vault`, `agenda/fff`, `passport/fff`, `sound/profile`; din Etapa 4 (vezi [FLUXURI.md](FLUXURI.md)): `document/ocr`, `experiment/ab`, `claim/repro`, `geo/journal`. Orice `[a-z0-9][a-z0-9.+-]*/[a-z0-9][a-z0-9.+-]*` este valid; aplicațiile ignoră ce nu înțeleg. |
| `title` | nu | text ≤ 200 | Titlu afișat în banda de confirmare. |
| `payload` | da | orice JSON | Conținutul. Pentru `table/csv`: text CSV; `citation/csl`: listă CSL-JSON; `text/markdown`: text; `keys/vault`: blobul criptat (§5). |
| `source` | nu | text sau `{label,url,id,doi}` | De unde provine (adresă, DOI, numele aplicației/corpusului). |
| `evidence` | nu | `{level 0–4, note?}` | Scara de dovezi din hub: 0 tradiție/cultural, 1 relatări izolate, 2 studii mici/preliminare, 3 studii controlate, 4 verificat. Se pune doar când aplicația emițătoare o poate susține; lipsa înseamnă „nespecificat”, nu „0”. |
| `created` | da | ISO 8601 | Momentul creării. |
| `app` | da | text | Aplicația emițătoare (nume sau slug). |
| `lang` | nu | cod limbă | Limba conținutului (nu intră în semnătură). |
| `sig` | nu | obiect | Semnătură HMAC opțională (§4). |

Limite: plicul serializat ≤ 8 MiB (`MAX_BYTES`); ca link ≤ 24 000 de caractere după comprimare (altfel `TOO_BIG` și se folosește fișierul); ca QR ≤ capacitatea `FFF.qr.maxBytes`. Chei interzise în obiecte (`__proto__`, `constructor`, `prototype`) sunt eliminate la citire.

Exemplu:

```json
{
  "fff": 2, "type": "citation/csl", "title": "AcademiSearch",
  "payload": [{"id":"k1","type":"article-journal","title":"…","author":[{"literal":"A. Popescu"}],"issued":{"date-parts":[[2021]]},"DOI":"10.1000/x"}],
  "source": {"label": "AcademiSearch · biblioteca mea", "url": "https://academisearch.chiuta.ro/"},
  "created": "2026-11-03T10:15:00.000Z", "app": "AcademiSearch"
}
```

## 2. Primire sigură

Nimic nu se importă fără apăsarea explicită a lui „Importă” în banda de confirmare, care arată aplicația emițătoare, titlul, sursa, nivelul de dovezi și dacă plicul e semnat. Un tip pe care aplicația nu-l acceptă primește doar un mesaj („plic invalid sau neacceptat”), fără bandă. Validarea (`FFF.envelope.validate`) rulează înainte de orice afișare.

## 3. Compatibilitate cu `FFF.bridge` (kit)

Aplicațiile cu `FFF.bridge` din registrul kitului (`fff-kit/bridge-adapters/registry.js`) folosesc deja un plic `{fff:1, type, src, title, lang, theme, ts, data}` și prefixul `#fff=`. Ca să nu existe două formate incompatibile, **forma de transport implicită** („compat”) este `fff:1` cu `data` = `payload`, `src` = `app`, `ts` = `created`, la care se adaugă `app`, `created`, `source`, `evidence`, `sig`. Vechiul `FFF.bridge` o citește (verificat în test, într-un `vm`, cu `bridge.js` real); `FFF.envelope.normalize()` primește ambele forme și întoarce forma canonică `fff:2`. Fișierele `.fff.json` salvate de `download()` sunt în forma de transport, deci se pot deschide și în aplicațiile cu bridge vechi.

## 4. Semnătură opțională

`sig = {alg:"HMAC-SHA256", kdf:"PBKDF2-SHA256", it, salt, mac}`; cheia HMAC se derivă din parola comună (≥ 600 000 de iterații implicit). Se semnează octeții JSON canonici (chei sortate) ai câmpurilor `fff, type, title, payload, source, evidence, created, app` — **fără** `lang` și `sig`. `verify()` întoarce `"ok"`, `"bad"` sau `"none"`. Semnătura dovedește doar că cine știe parola a creat plicul și că nu a fost modificat; **nu** dovedește identitatea unei persoane și nu este o semnătură cu cheie publică.

## 5. Plicul `keys/vault` (seiful comun de chei API)

`payload` este un blob **criptat** în formatul KeyVault/1 (`{kv:1, kdf:"PBKDF2-SHA256", it≥600000, s, iv, ct}`, AES-256-GCM, AAD `KeyVault/1`), identic cu `KeyVault 1.0.0` din Nexus, AI Liber și ARENA. Reguli:

1. Seiful se creează și se editează în **VaultCrypt**, fila „Chei API”; parola nu se trimite niciodată, iar cheile în clar nu se scriu în `localStorage`.
2. Plicul `keys/vault` circulă **doar** prin fișier, clipboard, cod QR sau altă filă — niciodată prin link (fragmentul rămâne în istoricul browserului) și nu apare în lista de aplicații-țintă.
3. Nexus, AI Liber și ARENA arată în Setări „Importă din seiful comun”: cer parola, deschid blobul, păstrează doar furnizorii cunoscuți și îi pun în **propriul** seif KeyVault (îl creează dacă nu există, cu aceeași parolă). ARENA potrivește cheia pe modele după furnizor/adresa API.
4. Limite oneste: componentă neauditată de un terț; parola pierdută = chei pierdute; cheile deblocate stau în memoria paginii cât e deschisă; un seif cu parolă slabă se sparge offline.

## 6. API (`window.FFF.envelope`)

`create({type,title,payload,source,evidence,app,lang})`, `validate`, `normalize`, `toCompat`, `serialize`/`parse`, `sign`/`verify`, `pack`/`unpack`, `toLink`/`fromHash`, `toFile`/`download`/`fromFile`, `toClipboard`/`fromClipboard`, `toQR`/`fromQR` (cu `FFF.qr` din kit), `broadcast` (canal `fff-envelope`), `capture(trigger)` (prinde fișierul pe care l-ar descărca butonul de export al aplicației, fără descărcare reală), `sendButton`/`sendMenu`/`importButton`/`mount`, `registry` (lista aplicațiilor-țintă, completată de adaptorul aplicației), `I18N` (8 limbi, paritate verificată în test).

## 7. Aplicațiile-pilot

| Aplicație | Trimite | Primește |
|---|---|---|
| AcademiSearch | `citation/csl` (biblioteca ★; înlocuiește vechiul „Trimite la…”) | `citation/csl` |
| DataWeave | `table/csv` (tabelul vizibil) | `table/csv` (se încarcă ca un fișier deschis) |
| Arhiva fără frontiere | `citation/csl` (favoritele) | `citation/csl` cu adrese `archive.org/details/…` (restul se ignoră) |
| Cadraj | `table/csv` (colecțiile) | `table/csv`/`text/plain` cu linkuri TikTok → formularul „Adaugă” |
| Constelar | `text/markdown` (conversația activă) | `text/markdown`/`text/plain` → caseta de scris (nu se trimite nimic automat) |
| VaultCrypt | `keys/vault` | `keys/vault` |
| Nexus, AI Liber, ARENA | — | `keys/vault` |

Adaptoarele sunt în [`tools/envelope-adapters/`](../tools/envelope-adapters/) (un fișier pe aplicație, plus `plan.json`, `registry.extra.json`, `patches.json`) și lucrează prin DOM și API-ul public al paginii, fără a atinge codul aplicației (excepție: o linie de apel `FFFSeif.mount` în Nexus, AI Liber și ARENA, aplicată de `patches.json`).

## 8. Limite cunoscute

- `capture()` pornește butonul de export al aplicației; aplicația poate afișa propriul mesaj „descărcat” deși nu s-a descărcat nimic (Cadraj, Constelar).
- Un plic mare (> ~24 000 de caractere comprimate) nu încape în link sau QR; fișierul și clipboardul merg până la 8 MiB.
- Primirea prin link în aplicațiile fără `FFF.bridge` o face `mount()`; în cele cu bridge, o face banda bridge-ului (același prefix).
- `evidence` este o judecată a aplicației emițătoare, nu o certificare.

## 9. Motoare comune (Etapa 5)

Cinci module canonice în [`tools/`](../tools/), injectate în aplicații de `node tools/inject-shared.mjs` (câmpul `libs` din `plan.json` → `<script id="fff-mod-…">`; `--check` verifică identitatea copiilor). Fiecare aplicație rămâne un singur fișier HTML, offline, cu CSP `connect-src 'none'` (excepție: cele trei aplicații AI).

| Modul | Tip de plic | Ce face | Aplicații |
|---|---|---|---|
| `fff-agenda.js` | `agenda/fff` (+ import/export `events/ics`) | O singură listă de evenimente/sarcini, convertită în/din ICS (subset RFC 5545), între Orar, Gospodar și CLEPSIDRA | 3 |
| `fff-pasaport.js` | `passport/fff` | Pașaport de învățare: buton „Notează în pașaport”, repetiție eșalonată (SM-2 simplificat), certificat tipăribil; stocat per origine, circulă prin fișier | 13 (repetiția eșalonată e afișată în Clopotel, certificatul tipăribil în Fabrica) |
| `fff-sunet.js` | `sound/profile` | Mixer de peisaj sonor (straturi, profile dormit/studiu/preparat, oprire automată, WAV offline). Fără promisiuni de efect asupra somnului sau sănătății | 6 (Gospodar nu are sunet) |
| `fff-ai.js` | — (cheile vin din seiful `keys/vault`) | Transport comun pentru Anthropic/OpenAI/Google: cerere, SSE, anulare, comparare; trei fețe: AI-Liber, Nexus, ARENA | 3 |
| `fff-jocuri.js` | — | Stratul TBL (i18n 8 limbi, Elo, turnee tur-retur, p2p lockstep) + `FFF.games`: istoric local, clasament Elo pe nume, hub „Turneu și Elo” cu rezultate notate de mână; export/import `{fff:"games",v:1}` | 11 din 14 (Dame, Go, Șah îl primesc în locul copiei lipite; 8 jocuri primesc hub-ul prin adaptorul `Jocuri.js`) |

Jocurile fără modul (Sudoku, Solitaire, Zaruri) nu au adversari sau partide cu rezultat, deci un clasament Elo n-ar avea sens. Un adversar AI în rețea (ARENA) nu se potrivește jocurilor: ele rulează cu `connect-src 'none'`; adversarii rămân motoarele locale (Dame, Go, Șah) și oamenii (hot-seat). Testele: `tests/{agenda,pasaport,sunet,ai,jocuri}.test.mjs` (Node) și `tests/engines.test.mjs` (Playwright, rețea oprită).
