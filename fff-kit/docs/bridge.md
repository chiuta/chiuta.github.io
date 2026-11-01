# FFF.bridge — plic „fff” și „Trimite la…”

Modul: `src/bridge.js`, texte în `i18n/bridge.json` (ro, en, fr, it, es, pt, de, hu; **fr/it/es/pt/de/hu sunt traduceri automate, neverificate nativ**).
Depinde doar de `FFF.core`. Fără rețea, fără dependențe, compatibil cu `connect-src 'none'`.

## De ce
Fiecare aplicație are propria origine (subdomeniu), deci nu partajează `localStorage` sau `BroadcastChannel`. Datele circulă prin trei canale, toate inițiate de utilizator:
1. **link cu fragment** `https://…/#fff=z.<deflate-raw base64url>` — fragmentul nu ajunge la server; max. 24 000 de caractere, altfel se trece automat pe fișier; se șterge din adresă după citire;
2. **fișier** `.fff.json` (max. 8 MB), descărcat sau tras pe pagină (drag-and-drop; doar fișiere `.json`, restul rămân în seama aplicației);
3. **clipboard** (JSON).

## Plic
`{fff:1, type, src, title, lang, theme, ts, data}`. Tipuri: `text/markdown`, `text/plain`, `citation/csl`, `table/csv`, `quiz/undava`, `geo/gpx`, `events/ics`, `note/akasha`, `cards/qa`, `link/fff`.
Securitate: doar JSON simplu; cheile `__proto__`, `constructor`, `prototype` sunt eliminate; un tip pe care aplicația nu îl declară se respinge; **nimic nu se importă fără apăsarea „Importă”** în banda de confirmare; nimic nu se execută.

## API
`FFF.bridge.make({type, src, title, data})`, `valid`, `parse(text)`, `toLink(env, url)`, `fromHash(hash)`, `receiveFromLocation()`, `toFile`, `download`, `fromFile`, `acceptDrop(el, cb)`, `toClipboard`,
`setRegistry([{slug,name,url,accepts,produces}])`, `targetsFor(env, registry, selfSlug)`, `openIn(app, env)`,
UI: `sendButton({slug, registry, getEnv, className})`, `sendMenu`, `banner(env, onAccept)`, `mount({accepts, onReceive})`, `toast`.

## Integrare într-o aplicație
```
node fff-kit/tools/add-bridge.mjs <dirAplicație> <slug> <versiune> "<notă de changelog>"
```
Adaugă modulul (păstrând modulele existente), inserează `bridge-adapters/registry.js` + `bridge-adapters/<slug>.js` ca `<script id="fff-bridge-adapter">`, recalculează hash-urile CSP (`fixcsp`), `app.json` (`info`), ridică versiunea (index.html, sw.js, manifest) și scrie în `CHANGELOG.md`.
Adaptorul decide ce înseamnă „trimite” și „primește” pentru aplicație (`mount({accepts, onReceive})`; `onReceive` aruncă o eroare dacă importul eșuează). Adaptoare existente: `akasha`, `markdownatelier`, `academisearch`, `undava` (primește `quiz/undava`, `cards/qa`), `seva` (trimite quiz-ul către Undava).
Registrul de capabilități e în `bridge-adapters/registry.js`; extinde-l când adaugi aplicații.

## Fluxuri active
SEVA (quiz) → Undava · AcademiSearch (bibliotecă → CSL) → MarkdownAtelier (bibliografie în editor) · Akasha (notă cu tag `fff`) ; MarkdownAtelier (text) → Akasha (notă) ; Akasha (notă) → MarkdownAtelier (document).

## Testare
`node test/bridge.test.mjs` (29 verificări: dus-întors cu Unicode, link prea mare, plicuri invalide, poluare de prototip, ținte, fișier, paritate i18n). Test end-to-end cu trei origini în Chromium: `fff-kit/test/bridge.e2e.mjs`.

## Strat universal (`FFF.bridge.auto`, `bridge-adapters/auto.js`)
Fără adaptor scris de mână, orice aplicație cu kitul poate:
* **trimite**: după orice export de fișier `.gpx`, `.ics`, `.csv`, `.tsv`, `.md` (detectat prin `URL.createObjectURL` + clic pe `<a download>`) apare, 12 secunde, butonul „↗ Trimite la…”, dacă există aplicații compatibile în registru;
* **primi**: plicul acceptat se transformă într-un `File` și este dat câmpului `<input type=file>` al aplicației care acceptă extensia (se declanșează `change`), deci aplicația își folosește propriul import; dacă câmpul se creează dinamic, fișierul rămâne „pregătit” și e dat la următoarea deschidere a selectorului de fișiere.
Tipuri: `geo/gpx`, `events/ics`, `table/csv`, `text/markdown`; datele sunt întotdeauna textul fișierului.
Registrul (`bridge-adapters/registry.js`) e generat din `app.json`, `CNAME` și atributele `accept` ale aplicațiilor; `rollout.json` listează cele 33 de aplicații conectate. `test/bridge-auto.e2e.mjs`: FieldObserver (CSV) → DataWeave.
Limite cunoscute: LocalMind are un ecran de bun-venit care acoperă banda de confirmare la prima pornire; în Gospodar importul rămâne „pregătit” până apeși Import.
