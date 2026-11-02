# Roadmap chiuta.ro · fff-kit și cele 111 aplicații „fără frontiere”

Stare la 2 noiembrie 2026 · autor: Alexandru-Ionuț Chiuță (Alexio) · licență MIT · fără cont, fără telemetrie, fără reclame, offline.

Acest roadmap pornește din trei surse: comparația cu concurența (109 fișe, 374 de produse, vezi pagina de comparație), straturile deja construite (fff-kit 1.2, FFF.bridge, FFF.p2p) și ideile noi de mai jos. Fiecare punct spune ce lipsește, față de cine, ce se livrează și cum se verifică.

## 1. Principii (nu se negociază)

1. **Offline și fără cont.** Orice funcție nouă merge fără rețea; ce are nevoie de rețea e opțională, explicită și marcată.
2. **Clean-room.** Cod scris de la zero după specificații publice; formatele standard se citesc și se scriu, dar codul concurenților nu se copiază. Motoarele cu licență incompatibilă cu MIT nu se încorporează: se oferă „adu-ți propriul motor” (modelul Lexicon: datele aduse de utilizator).
3. **Datele rămân ale utilizatorului.** Fișiere deschise, formate standard (Markdown, ICS, GPX, CSV, GEDCOM, ADIF, CSL), export complet oricând.
4. **Confirmare înainte de orice import** din altă aplicație (regula FFF.bridge).
5. **Onestitate față de utilizator.** Fiecare aplicație își spune limitele (nu e validată clinic, nu e motor de top, datele îmbătrânesc).
6. **Opt limbi la același nivel** (ro, en, fr, it, es, pt, de, hu), cu revizuire nativă pentru cele 6 traduse automat.
7. **MIT peste tot; doar Buy Me a Coffee.**

## 2. Unde stăm față de concurență (rezumat)

| Axă | Noi | Concurența comercială | Lecție |
|---|---|---|---|
| Confidențialitate | peste 4,7 / 5 | circa 2,5 | avantaj structural, de păstrat |
| Preț / acces | peste 4,7 / 5 | circa 2,5 | avantaj structural |
| Offline | peste 4,7 / 5 | circa 2,6 | avantaj structural |
| Profunzime funcțională | deseori 2–3 / 5 | 4–5 / 5 | aici se câștigă sau se pierde |
| Sincronizare, mobil nativ, ecosistem | slab | puternic | rezolvabil local, prin P2P și foldere partajate |

Cele mai mari decalaje (fișe cu încredere medie/mare): VietAR față de iNaturalist (−2,0), OUTPOST față de Uptime Kuma (−1,8), ATINGERE față de NVDA (−1,8), Akasha față de Obsidian (−1,7), Poteca față de QGIS (−1,6), Nexus (−1,3), Trusa față de CyberChef (−1,3), Provenienta față de c2patool (−1,3), LocalMind față de LM Studio (−1,3), Fabrica față de Moodle (−1,2).

## 3. Idei noi (inovații) care nu există la concurență în forma asta

| ID | Idee | Ce o face nouă |
|---|---|---|
| I1 | **Seiful comun** (folder partajat) | Toate aplicațiile scriu și citesc într-un singur folder ales de utilizator (File System Access / OPFS), cu fișiere deschise. Înlocuiește „contul” cu un folder: îl sincronizezi cu ce vrei (Syncthing, USB, Nextcloud). |
| I2 | **Rețete între aplicații** | Lanțuri de plicuri FFF.bridge salvate ca „rețete”: de exemplu AcademiSearch → Akasha → MarkdownAtelier, sau Poteca → Orar → ICS. Fără cod, doar pași alăturați. |
| I3 | **Căutare globală locală** | Un index (în Seif) peste notele, citările, traseele, vocabularul și quiz-urile din toate aplicațiile; fiecare aplicație îl interoghează prin bridge. |
| I4 | **Undava live fără server** | Gazda e telefonul profesorului: jucătorii intră scanând un cod QR, prin WebRTC (FFF.p2p). Elimină principala slăbiciune față de Kahoot și Wayground fără infrastructură. |
| I5 | **Sincronizare P2P cu CRDT mic** | Gospodar, Orar, Arbore, Akasha, Undava se sincronizează între dispozitivele familiei fără server, prin cod QR și fuziune deterministă. |
| I6 | **Motorul local de IA** | O aplicație-gazdă încarcă un model în browser (WebGPU) și îl pune la dispoziția celorlalte prin bridge: rezumate, căutare semantică, generare de quiz din notițe, traducere în cele 8 limbi, OCR, voce (TTS). Modelul se descarcă o singură dată. |
| I7 | **„Adu-ți propriul motor”** pentru jocuri | Șah (UCI), Go (GTP), dame, table: aplicația vorbește protocoale standard cu un motor WASM pe care îl încarcă utilizatorul. Motoarele noastre rămân didactice, dar nu ne mai limitează. |
| I8 | **Atestare fără rețea** | Fiecare aplicație își demonstrează singură că nu comunică: raport automat (CSP, cereri blocate, inventar de date stocate, hash-ul fișierului) verificabil offline, plus buton „șterge tot”. |
| I9 | **Ediția pe stick USB** | Un pachet cu toate aplicațiile, un lansator local și actualizări prin înlocuirea fișierelor; ca PortableApps, dar pentru tot portofoliul. |
| I10 | **Comparator viu** | Fișele de concurență se reîmprospătează trimestrial (prețuri, versiuni, produse închise), cu diferențele evidențiate; fiecare aplicație își arată public locul față de alternative. |
| I11 | **Specificația „FFF Plic 1.0”** | Plicul .fff.json devine specificație publică versionată, cu teste de conformitate, ca oricine să-și facă o aplicație compatibilă. |
| I12 | **Pachete de date aduse de utilizator** | AGORA, Universul-Observabil, VietAR, Lexicon, Poteca primesc date actualizate ca pachete semnate (catalog de galaxii, taxoni, dicționare, plăci de hartă), fără ca aplicația să atingă rețeaua. |

## 4. Etape

Notația efort: S = până la o zi, M = câteva zile, L = câteva săptămâni, XL = o lună sau mai mult. Fiecare livrabil trece prin: `build.mjs check`, testele aplicației, testul de fum, testul end-to-end relevant.

### Etapa 0 · Fundație (făcută)
- fff-kit 1.2 (core, store, dialog, label, bundle, qr, p2p, bridge, srs, tts, pii, search, ephem).
- FFF.bridge: plic comun, „Trimite la…”, strat universal, 36 de aplicații integrate (PR-uri deschise).
- Videoclipuri demonstrative pentru toate aplicațiile, pagină demo.
- Comparația cu concurența (109 fișe).

### Etapa 1 · Consolidare și încredere (nov.–dec. 2026)

| ID | Livrabil | Motiv (decalaj) | Efort | Criteriu de acceptare |
|---|---|---|---|---|
| 1.1 | Îmbinarea PR-urilor FFF.bridge și versiune publică a kitului | Integrarea e completă doar când e pe main | S | 36 de PR-uri îmbinate, CI verde |
| 1.2 | Integrarea bridge în restul aplicațiilor compatibile | Acoperire | M | toate aplicațiile cu import/export de fișiere sunt în registru |
| 1.3 | Atestare fără rețea (I8) ca modul fff-kit | Avantajul nostru trebuie dovedit, nu doar afirmat | M | fiecare aplicație are pagină „Ce stochez / ce nu trimit”, hash și buton de ștergere |
| 1.4 | Revizuire nativă a traducerilor fr, it, es, pt, de, hu | Traduceri automate, nerevizuite | L | listă de revizori, 100% din textele interfeței revizuite pentru cel puțin 3 limbi |
| 1.5 | LocalMind în 8 limbi | Singura aplicație doar în română | M | UI complet în 8 limbi |
| 1.6 | Nexus: chei API criptate cu parolă (WebCrypto) | Chei stocate necriptat | S | nicio cheie în clar în localStorage; test automat |
| 1.7 | Provenienta: listă de încredere C2PA și verificare pe fișiere reale | Verificare doar pe fișiere sintetice | M | rezultate identice cu c2patool pe un set de referință |
| 1.8 | Consolidare: generator-frecvente → FrequencyLaboratory; clarificare Universul-Observabil | Suprapuneri | S | redirecționare și mențiune în README |
| 1.9 | X-fara-cont: scoaterea canalului Nitter | Serviciu oprit în septembrie 2026 | S | niciun canal mort în interfață |
| 1.10 | Comparator viu, primul ciclu de actualizare (I10) | Prețuri și produse se schimbă | M | fișe cu data verificării, diferențe față de 2 nov 2026 |
| 1.11 | Specificația FFF Plic 1.0 (I11) | Deschidere către alți autori | M | document + suită de teste de conformitate |

### Etapa 2 · Interconectare adâncă (T1 2027)

| ID | Livrabil | Motiv | Efort | Criteriu de acceptare |
|---|---|---|---|---|
| 2.1 | Seiful comun (I1) | Fără cont, dar cu continuitate | L | 10 aplicații pilot scriu/citesc în Seif; export complet și import între mașini |
| 2.2 | Rețete între aplicații (I2) | Fluxuri de lucru fără cod | M | 5 rețete livrate (cercetare → notă → document; traseu → calendar; quiz din notițe) |
| 2.3 | Căutare globală locală (I3) | „Unde era nota aceea?” | L | căutare în notițe, citări, quiz-uri, vocabular din cel puțin 8 aplicații |
| 2.4 | Tipuri noi de plic: contacte (vCard), sarcini, evenimente cu invitați, chat-uri | Acoperă cazurile din Orar, Gospodar, Akasha | M | tipuri în specificație + adaptoare |
| 2.5 | Copie de siguranță criptată pentru tot portofoliul | Reducerea riscului de pierdere a datelor din browser | M | un fișier .fff criptat cu parolă, restaurabil în orice aplicație |
| 2.6 | Alarme care sună cu aplicația închisă (Orar, CLEPSIDRA) | Limită documentată față de Google Calendar | L | variantă de pachet nativ mic (Tauri) sau notificări programate unde platforma permite; documentat pe platformă |
| 2.7 | Eclipsa 2 august 2027: pachet complet (Eclipsa-2027, Bolta, ECLIPSA, orarium) | Eveniment cu termen fix | L | numărătoare inversă, ora locală a contactelor, plăci de hartă pentru traseu, mod grup (P2P), ghid de siguranță pentru observare; gata cu cel puțin 2 luni înainte |

### Etapa 3 · P2P și colaborare fără server (T2 2027)

| ID | Livrabil | Motiv | Efort | Criteriu de acceptare |
|---|---|---|---|---|
| 3.1 | Undava live fără server (I4) | Principalul decalaj față de Kahoot și Wayground | XL | 30 de jucători pe telefoane proprii, QR, clasament live, rapoarte pe elev exportabile |
| 3.2 | Rapoarte pe clasă și export QTI / Anki / SCORM 2004, xAPI, cmi5 (Undava, Fabrica) | Fabrica are doar SCORM 1.2 | L | import și export validate cu cel puțin două platforme de învățare |
| 3.3 | Sincronizare P2P cu CRDT (I5) pentru Gospodar, Orar, Arbore, Akasha | Fără sincronizare multi-dispozitiv | XL | două dispozitive converg după editări concurente, test determinist |
| 3.4 | Multiplayer P2P pentru jocuri (Belot, Remi, Domino, Table, Go, Dame, Șah) | Lipsă joc online | L | masă de 2–4 jucători prin cod QR; reconectare |
| 3.5 | FASCICUL v2: tablă comună prin P2P, fără semnalizare manuală | Experiență mai simplă la conferințe | M | conectare în sub 15 secunde cu un singur QR |
| 3.6 | Arbore: import/export complet GEDCOM 7, hărți, partajare cu rude prin P2P | Decalaj față de Gramps | L | conversie GEDCOM 5.5.1 ↔ 7 fără pierderi de date |

### Etapa 4 · IA locală și voce (T3 2027)

| ID | Livrabil | Motiv | Efort | Criteriu de acceptare |
|---|---|---|---|---|
| 4.1 | Motorul local de IA (I6) | LocalMind e izolat; celelalte nu au IA | XL | model încărcat o dată, folosit de 5 aplicații prin bridge |
| 4.2 | Căutare semantică în Akasha și AcademiSearch | Obsidian/Elicit au clasare inteligentă | L | rezultate relevante pe un set de test în 8 limbi |
| 4.3 | Quiz generat din notițe (Akasha → Undava, Fabrica) | Reduce munca profesorului | M | 10 întrebări valide din text, cu confirmare |
| 4.4 | Traducere locală în 8 limbi (TranslateHub, Lexicon) | Alternativă la servicii cu cont | L | calitate măsurată pe un set de frază, documentată |
| 4.5 | OCR și voce locală (TTS) pentru ATINGERE, VoiceAtelier | VoiceAtelier nu generează audio; ATINGERE are nevoie de audiobook | XL | audio generat offline în cel puțin 4 limbi |
| 4.6 | VietAR: model verificat, acuratețe măsurată, acoperire extinsă | −2,0 față de iNaturalist | XL | raport de acuratețe public; licențe de date și modele auditate |
| 4.7 | „Adu-ți propriul motor” (I7): UCI pentru Șah, GTP pentru Go | Motoare didactice față de Stockfish 19 și KataGo | L | rulează un motor WASM încărcat de utilizator; fără licențe încorporate |

### Etapa 5 · Adâncime pe produsele cu decalaj mare (T4 2027)

| ID | Livrabil | Decalaj | Efort | Criteriu de acceptare |
|---|---|---|---|---|
| 5.1 | Akasha/MarkdownAtelier: folder de fișiere .md (Seif), legături între note, grafic, WYSIWYG | −1,7 / −1,0 față de Obsidian și Typora | XL | deschide și scrie un seif compatibil Obsidian fără pierderi |
| 5.2 | Poteca: plăci PMTiles aduse de utilizator, UTM/MGRS, datum, GeoTIFF, rutare offline | −1,6 față de QGIS, Gaia GPS | XL | afișează hartă offline; conversii verificate pe valori de referință |
| 5.3 | OUTPOST: agent mic opțional (un singur executabil) + pagină de stare | −1,8 față de Uptime Kuma; browserul nu vede coduri HTTP | L | monitorizare cu fila închisă, coduri HTTP, certificate; notificări locale |
| 5.4 | ATINGERE: liblouis actual, validare cu cititori nativi, ecrane braille prin Web Bluetooth/Web Serial | −1,8 față de NVDA | XL | rapoarte de testare cu utilizatori; tabele actualizate |
| 5.5 | Trusa: module cu adâncime și rețete CyberChef-like | −1,3 | L | 30 de operații cu teste |
| 5.6 | Fabrica: rapoarte pe cursant și evaluare cu banca de întrebări (după 3.2) | −1,2 față de Moodle | L | raport exportabil pe cursant |
| 5.7 | Surveyor / Trade-Free-Link-Guardian: coduri HTTP complete prin agentul de la 5.3 | CORS limitează | M | legătură cu agentul, fără browser |
| 5.8 | RegexLab: motor PCRE-compatibil în WASM aduse de utilizator | Doar JavaScript | M | rulează teste PCRE de referință |
| 5.9 | Gospodar: istoric al cursurilor valutare, import bancar (CSV/OFX/CAMT) | −0,8 față de Firefly III | M | rapoarte cu curs istoric |
| 5.10 | Pachete de date aduse (I12) pentru AGORA, Universul-Observabil, VietAR, Lexicon | Date îmbătrânite | L | pachete semnate, verificate offline |

### Etapa 6 · Distribuție și sustenabilitate (continuu)

| ID | Livrabil | Efort |
|---|---|---|
| 6.1 | Ediția pe stick USB (I9) cu lansator | M |
| 6.2 | Pachete PWA instalabile pentru toate aplicațiile; wrapper Tauri unde e nevoie de lucruri native | L |
| 6.3 | Pachete PortableApps, Flatpak, F-Droid (pentru aplicațiile mature) | L |
| 6.4 | Releases cu sume de control și semnătură, compilări reproductibile | M |
| 6.5 | Audit de accesibilitate (axe) în CI pentru toate aplicațiile | M |
| 6.6 | Ghid de contribuție și comunitate de mentenanță | S |

## 5. Riscuri și ce nu facem

- **Aplicații medicale și de supraviețuire (PULS, VATRA, SEVA):** rămân ghiduri informative, nevalidate clinic; fiecare conține trimitere la ghidurile oficiale (AHA/ERC/Crucea Roșie).
- **Cursuri esoterice:** rămân conținut educațional/cultural; se arată nivelul de dovezi științifice, fără afirmații medicale.
- **Servicii terțe care dispar** (Nitter, Jamboard, aplicații retrase): monitorizate prin comparatorul viu și scoase din interfață.
- **Licențe:** nu încorporăm cod GPL/AGPL în aplicațiile MIT; motoare externe doar aduse de utilizator.
- **Traduceri automate:** marcate ca atare până la revizuire nativă.
- **Dependența de browser:** WebGPU, File System Access și Web Bluetooth diferă între browsere; fiecare funcție documentează platformele.

## 6. Ordinea recomandată (primele 90 de zile)

1. Îmbinarea PR-urilor FFF.bridge și publicarea kitului (1.1, 1.2).
2. Atestare fără rețea și Nexus criptat (1.3, 1.6): cele mai ieftine câștiguri de încredere.
3. Revizuire nativă și LocalMind în 8 limbi (1.4, 1.5).
4. Specificația FFF Plic 1.0 (1.11), baza pentru tot ce urmează.
5. Pornirea Seifului comun (2.1) și a pachetului Eclipsa 2027 (2.7), care are termen fix.
6. Prototip Undava live (3.1): cel mai vizibil decalaj față de un produs comercial popular.
