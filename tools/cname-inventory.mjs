#!/usr/bin/env node
/* tools/cname-inventory.mjs — inventarul domeniilor/originilor pentru toate aplicațiile din catalog → docs/DOMENII.md
 *
 *   node tools/cname-inventory.mjs            scrie docs/DOMENII.md (din depozitele de pe disc)
 *   node tools/cname-inventory.mjs --check    exit 1 dacă docs/DOMENII.md nu corespunde stării depozitelor
 *   node tools/cname-inventory.mjs --dns      în plus, interoghează DNS-ul public pentru fiecare CNAME (necesită rețea; informativ)
 *   node tools/cname-inventory.mjs --root DIR depozitele sunt în DIR (implicit: părintele hub-ului)
 *
 * Sursa: cardurile din index.html (aplicațiile din catalog), fișierul CNAME din fiecare depozit și apps/<X>/ din hub.
 * Nimic nu se presupune: „origine proprie” = depozitul are CNAME; „partajată” = servit sub chiuta.ro împreună cu hub-ul.
 */
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import {fileURLToPath} from 'node:url';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const ri = argv.indexOf('--root');
const ROOT = path.resolve(ri >= 0 ? argv[ri + 1] : path.join(HUB, '..'));
const OUT = path.join(HUB, 'docs', 'DOMENII.md');
const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);
const OWNER = 'chiuta';
const APEX = (() => { try { return read(path.join(HUB, 'CNAME')).trim(); } catch { return 'chiuta.ro'; } })();

// Aplicații care țin date personale sau secrete în localStorage/IndexedDB. Motivul vine din audit și din app.json; lista e decizia de proiect.
// prio: 1 = de mutat primele; 2 = de mutat după; „proprie” = deja pe origine proprie (se menționează doar pentru context).
const SENSITIVE = {
  Gospodar: {prio: 1, why: 'buget de gospodărie: conturi, tranzacții, categorii (date financiare personale)'},
  Arbore: {prio: 1, why: 'genealogie: persoane reale, relații de rudenie, date de naștere (IndexedDB)'},
  Orar: {prio: 1, why: 'calendar și program: evenimente personale; cheile `clepsidra.events/schedule` sunt comune cu CLEPSIDRA (coliziune confirmată la audit)'},
  QSO: {prio: 1, why: 'jurnal de stație radioamator: indicative, locatori Maidenhead (loc aproximativ)'},
  Poteca: {prio: 1, why: 'trasee GPX/KML/GeoJSON: locuri frecventate (IndexedDB)'},
  Bolta: {prio: 2, why: 'folosește geolocația și păstrează locul ales'},
  Lexicon: {prio: 2, why: 'dicționare încărcate de utilizator (IndexedDB), potențial volum mare și date proprii'},
};
const SENSITIVE_OWN = {
  'Nexus-fara-frontiere': 'chei API pentru modele AI', Constelar: 'cheie API în clar în localStorage (confirmat la audit)', AcademiSearch: 'cheie în sessionStorage',
  TranslateHub: 'cheie în sessionStorage', PromptVault: 'seif de prompturi', VaultCrypt: 'seif criptat',
};

const html = read(path.join(HUB, 'index.html'));
const keys = html.split('<div class="app-card"').slice(1).map((c) => (c.match(/data-c="apps\|([^|"]+)\|title"/) || [])[1]).filter(Boolean);
const slugOf = (k) => k.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const rows = keys.map((key) => {
  const repo = path.join(ROOT, key), hubApp = path.join(HUB, 'apps', key);
  const inRepo = exists(path.join(repo, 'index.html')) || exists(path.join(repo, 'docs', 'index.html'));
  const inHub = exists(path.join(hubApp, 'index.html'));
  const where = inRepo ? 'depozit' : inHub ? 'hub (apps/)' : 'LIPSĂ';
  let cname = '';
  if (inRepo && exists(path.join(repo, 'CNAME'))) cname = read(path.join(repo, 'CNAME')).trim().toLowerCase();
  const expected = `${slugOf(key)}.${APEX}`;
  let origin, note = '';
  if (inHub) origin = `partajată: https://${APEX}/apps/${key}/ (aceeași origine cu hub-ul și cu celelalte aplicații din hub)`;
  else if (cname) { origin = `proprie: https://${cname}/`; if (cname !== expected) note = `CNAME diferă de convenția \`${expected}\``; }
  else { origin = `partajată: https://${APEX}/${key}/ (proiect fără CNAME, aceeași origine cu hub-ul)`; note = `fără CNAME; propus \`${expected}\``; }
  const s = SENSITIVE[key];
  const sens = s ? (inHub ? `DA (prio ${s.prio})` : 'da, dar deja pe origine proprie') : SENSITIVE_OWN[key] ? 'pe origine proprie (corect)' : '';
  return {key, where, cname, expected, origin, note, sens, inHub, inRepo, own: !!cname && !inHub, prio: s ? s.prio : 0};
});

const own = rows.filter((r) => r.own), hubApps = rows.filter((r) => r.inHub), noCname = rows.filter((r) => !r.inHub && !r.cname), odd = rows.filter((r) => r.cname && r.cname !== r.expected);
const missing = rows.filter((r) => r.where === 'LIPSĂ');
for (const k of Object.keys(SENSITIVE)) if (!keys.includes(k)) throw new Error(`SENSITIVE conține ${k}, care nu e în catalog`);

function render() {
  const L = [];
  const P = (s = '') => L.push(s);
  P('# Domenii și origini web');
  P();
  P('> GENERAT de `tools/cname-inventory.mjs` din depozitele de pe disc și din cardurile catalogului. Nu edita de mână: rulează `node tools/cname-inventory.mjs`.');
  P('> Starea DNS/GitHub Pages „live” nu poate fi dedusă din depozite; vezi secțiunea „Verificare” pentru comenzile care o confirmă.');
  P();
  P('## Pe scurt');
  P();
  P(`- Aplicații în catalog: **${rows.length}** (${rows.length - hubApps.length} în depozite proprii, ${hubApps.length} în \`apps/\` din hub).`);
  P(`- Cu **origine proprie** (CNAME \`<slug>.${APEX}\`): **${own.length}**.`);
  P(`- Pe **origine partajată** \`${APEX}\`: **${hubApps.length + noCname.length}** (${hubApps.length} aplicații din hub + ${noCname.length} depozit(e) fără CNAME${noCname.length ? ': ' + noCname.map((r) => r.key).join(', ') : ''}).`);
  if (odd.length) P(`- CNAME-uri care nu urmează convenția: ${odd.map((r) => `${r.key} → \`${r.cname}\``).join('; ')} (intenționat, caracterele nepermise în slug devin „-”).`);
  if (missing.length) P(`- ATENȚIE, lipsesc de pe disc: ${missing.map((r) => r.key).join(', ')}.`);
  P(`- De mutat pe origine proprie (sensibile, din hub): **${hubApps.filter((r) => r.prio === 1).length}** cu prioritate 1 (${hubApps.filter((r) => r.prio === 1).map((r) => r.key).join(', ')}), **${hubApps.filter((r) => r.prio === 2).length}** cu prioritate 2 (${hubApps.filter((r) => r.prio === 2).map((r) => r.key).join(', ')}).`);
  P();
  P('## De ce contează originea');
  P();
  P('Pentru browser, o origine este protocol + domeniu + port; **calea nu contează**. `localStorage`, `IndexedDB`, cookie-urile și service worker-ele sunt separate pe origine, nu pe aplicație. Orice aplicație de pe aceeași origine poate citi și scrie datele celorlalte, iar o singură aplicație compromisă (sau un pachet extern încărcat de ea) le expune pe toate. Un CSP strict într-o aplicație nu ajută dacă alta, de pe aceeași origine, este slabă. La auditul din 22 octombrie s-au demonstrat și coliziuni reale de chei (`clepsidra.*` între CLEPSIDRA și Orar).');
  P();
  P('Rezolvarea gratuită pe GitHub Pages: fiecare depozit își primește propriul subdomeniu (`<slug>.' + APEX + '`) prin fișierul `CNAME`. Pentru browser, `gospodar.' + APEX + '` și `' + APEX + '` sunt origini diferite.');
  P();
  P('## Aplicații sensibile din hub, de mutat');
  P();
  P('| Aplicație | Prio | De ce | Depozit nou | Domeniu nou |');
  P('|---|---|---|---|---|');
  for (const r of hubApps.filter((x) => x.prio).sort((a, b) => a.prio - b.prio || a.key.localeCompare(b.key))) P(`| ${r.key} | ${r.prio} | ${SENSITIVE[r.key].why} | \`${OWNER}/${r.key}\` | \`${r.expected}\` |`);
  P();
  const others = hubApps.filter((r) => !r.prio);
  P(`Celelalte aplicații din hub (${others.map((r) => r.key).join(', ')}) nu păstrează date personale sau secrete; pot rămâne pe origine partajată, dar ar urma același traseu dacă se schimbă acest lucru.`);
  const ownSens = rows.filter((r) => SENSITIVE_OWN[r.key]);
  if (ownSens.length) { P(); P('Deja pe origine proprie și sensibile (corect): ' + ownSens.map((r) => `${r.key} (${SENSITIVE_OWN[r.key]})`).join('; ') + '.'); }
  if (noCname.length) { P(); P(`Depozite fără CNAME (origine partajată cu hub-ul, de aliniat la convenție): ${noCname.map((r) => `${r.key} → \`${r.expected}\``).join(', ')}.`); }
  P();
  P('## Pași exacți: DNS și verificarea domeniului ' + APEX);
  P();
  P('Se fac o singură dată pentru domeniu, apoi câte un pas scurt pentru fiecare aplicație mutată.');
  P();
  P(`### 1. Înregistrările DNS ale domeniului (la registrar/furnizorul DNS al lui \`${APEX}\`)`);
  P();
  P('| Nume | Tip | Valoare |');
  P('|---|---|---|');
  for (const ip of ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153']) P(`| \`@\` (apex ${APEX}) | A | \`${ip}\` |`);
  for (const ip of ['2606:50c0:8000::153', '2606:50c0:8001::153', '2606:50c0:8002::153', '2606:50c0:8003::153']) P(`| \`@\` | AAAA | \`${ip}\` |`);
  P(`| \`www\` (opțional) | CNAME | \`${OWNER}.github.io.\` |`);
  P(`| \`<slug>\` (ex. \`gospodar\`), câte unul pentru fiecare aplicație | CNAME | \`${OWNER}.github.io.\` |`);
  P();
  P('Notă: adresele de mai sus sunt cele documentate de GitHub pentru Pages; se confirmă în documentația GitHub („Managing a custom domain for your GitHub Pages site”) înainte de aplicare, fiindcă pot fi actualizate. Nu folosi o înregistrare wildcard (`*`) înainte de pasul 2, ca un subdomeniu neconfigurat să nu poată fi revendicat de altcineva.');
  P();
  P(`### 2. Verificarea domeniului \`${APEX}\` în contul GitHub (protejează împotriva revendicării subdomeniilor)`);
  P();
  P(`1. GitHub → fotografia de profil → **Settings** → **Pages** (în bara laterală, secțiunea „Code, planning, and automation”) → **Add a domain**.`);
  P(`2. Introdu \`${APEX}\` → **Add domain**. GitHub arată o înregistrare TXT.`);
  P(`3. La furnizorul DNS creează: nume \`_github-pages-challenge-${OWNER}.${APEX}\` (în unele panouri doar \`_github-pages-challenge-${OWNER}\`), tip **TXT**, valoarea exact cum o arată GitHub.`);
  P('4. Așteaptă propagarea (de obicei minute, cel mult ore), apoi în aceeași pagină apasă **Verify** (sau „Continue verifying”). Domeniul verificat acoperă și toate subdomeniile.');
  P(`5. Verificare din terminal: \`dig +short TXT _github-pages-challenge-${OWNER}.${APEX}\` trebuie să returneze valoarea din GitHub.`);
  P();
  P('### 3. Pentru fiecare aplicație (depozit) cu domeniu propriu');
  P();
  P('1. DNS: adaugă `CNAME <slug>` → `' + OWNER + '.github.io.`.');
  P(`2. Depozitul are deja fișierul \`CNAME\` la rădăcină, cu un singur rând \`<slug>.${APEX}\` (pentru depozitele noi, creează-l).`);
  P('3. GitHub → depozitul → **Settings** → **Pages** → **Custom domain** = `<slug>.' + APEX + '` → **Save**. Așteaptă „DNS check successful”.');
  P('4. Bifează **Enforce HTTPS** când devine disponibil (certificatul se emite în cel mult ~1 oră).');
  P('5. Alternativ din linia de comandă (necesită `gh` autentificat): `gh api -X PUT repos/' + OWNER + '/<Depozit>/pages -f cname=<slug>.' + APEX + '` apoi `gh api repos/' + OWNER + '/<Depozit>/pages --jq \'{cname,https_enforced,status}\'`.');
  P('6. Verifică: `dig +short CNAME <slug>.' + APEX + '` → `' + OWNER + '.github.io.`; `curl -sI https://<slug>.' + APEX + '/ | head -1` → `HTTP/2 200`.');
  P();
  P('### 4. Mutarea unei aplicații din hub pe depozit propriu (ex. Gospodar)');
  P();
  P('Datele din `localStorage`/`IndexedDB` **nu se mută singure**: noua origine pornește goală. Ordinea contează.');
  P();
  P(`1. Cere utilizatorilor (și fă tu) un **export** din aplicație (JSON/CSV/GEDCOM/ICS/GPX, după caz) de pe adresa veche \`https://${APEX}/apps/<Aplicație>/\`.`);
  P(`2. Creează depozitul \`${OWNER}/<Aplicație>\`, copiază conținutul lui \`apps/<Aplicație>/\` la rădăcină (inclusiv \`sw.js\`, \`manifest\`, \`app.json\`, teste, README-urile), adaugă \`CNAME\` și activează Pages (branch \`main\`, folder \`/ (root)\`).`);
  P('3. Parcurge pașii 1 și 3 de mai sus pentru DNS și domeniul personalizat.');
  P(`4. Rulează în depozitul nou \`fff-kit check\` și testele aplicației (calea \`start_url\`/\`scope\` din manifest și din \`sw.js\` trebuie să fie relative, deci rămân corecte).`);
  P(`5. În hub, înlocuiește \`apps/<Aplicație>/index.html\` cu un **stub** (\`<meta http-equiv="refresh" content="0;url=https://<slug>.${APEX}/">\` și un link vizibil) și \`apps/<Aplicație>/sw.js\` cu un service worker care se dezînregistrează (\`self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', e => e.waitUntil(self.registration.unregister().then(() => self.clients.matchAll()).then(cs => cs.forEach(c => c.navigate(c.url)))));\`), ca vechile instalări să nu rămână blocate pe versiunea veche.`);
  P(`6. Rulează \`node tools/sync-catalog.mjs\`: cardul va indica automat depozitul nou, iar \`node tools/cname-inventory.mjs\` reface acest document.`);
  P(`7. După o perioadă (de exemplu 30 de zile), șterge stub-ul. Datele rămase pe vechea origine (\`https://${APEX}\`) pot fi șterse din setările site-ului din browser.`);
  P();
  P('## Verificare');
  P();
  P('```');
  P('node tools/cname-inventory.mjs --check   # documentul corespunde depozitelor de pe disc');
  P('node tools/cname-inventory.mjs --dns     # informativ: interoghează DNS-ul public pentru fiecare CNAME (necesită rețea)');
  P('```');
  P();
  P('## Inventar complet');
  P();
  P('| Aplicație | Loc | CNAME | Origine | Sensibilă | Observații |');
  P('|---|---|---|---|---|---|');
  for (const r of rows) P(`| ${r.key} | ${r.where} | ${r.cname ? '`' + r.cname + '`' : '—'} | ${r.origin} | ${r.sens || '—'} | ${r.note || ''} |`);
  P();
  return L.join('\n');
}

const md = render();
if (argv.includes('--check')) {
  if (!exists(OUT) || read(OUT) !== md) { console.error('docs/DOMENII.md nu corespunde depozitelor (rulează `node tools/cname-inventory.mjs`)'); process.exit(1); }
  console.log(`DOMENII.md ok · ${rows.length} aplicații · ${own.length} cu domeniu propriu · ${hubApps.length + noCname.length} pe origine partajată`);
} else {
  fs.mkdirSync(path.dirname(OUT), {recursive: true});
  fs.writeFileSync(OUT, md);
  console.log(`docs/DOMENII.md scris · ${rows.length} aplicații · ${own.length} cu domeniu propriu · ${hubApps.length + noCname.length} pe origine partajată`);
}
if (argv.includes('--dns')) {
  let bad = 0;
  for (const r of rows.filter((x) => x.cname)) {
    try { const c = await dns.resolveCname(r.cname); const ok = c.some((x) => x.toLowerCase().replace(/\.$/, '') === `${OWNER}.github.io`); console.log(`${ok ? 'ok  ' : 'DIFER'} ${r.cname} → ${c.join(', ')}`); if (!ok) bad++; }
    catch (e) { console.log(`?    ${r.cname}: ${e.code || e.message}`); bad++; }
  }
  console.log(bad ? `${bad} necesită atenție (rețea indisponibilă sau DNS neconfigurat)` : 'DNS ok');
}
