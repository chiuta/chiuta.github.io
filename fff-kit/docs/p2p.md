# FFF.p2p — multiplayer fără server (și FFF.qr)

Module: `src/qr.js` (generator + decodor QR), `src/p2p.js` (WebRTC cu semnalizare manuală, sesiune de joc `lockstep`, dialog),
texte în `i18n/p2p.json` și `i18n/qr.json` (ro, en, fr, it, es, pt, hu, de; **fr/it/es/pt/hu/de sunt traduceri automate, neverificate nativ**).
Depind doar de `FFF.core` (`FFF.t`, `FFF.registerI18n`); `p2p.js` folosește `FFF.qr` pentru QR și scanare. Fără rețea externă la pornire.

## Cum se conectează doi jucători (fără server)

1. **Gazda** apelează `FFF.p2p.host()` → obține `session.offer`, un text de forma `FFF1.o.z.<base64url>`.
2. Gazda îl trimite celuilalt jucător (copiere/lipire sau cod QR).
3. **Oaspetele** apelează `FFF.p2p.join(offer)` → obține `session.answer` (`FFF1.a.z.<base64url>`) și îl trimite înapoi.
4. Gazda apelează `await session.accept(answer)`. Canalul de date se deschide (`'open'`).

Nu există server de semnalizare: oferta și răspunsul sunt SDP-ul WebRTC cu toate candidatele ICE incluse (nu se folosește trickle ICE).

### Formatul codului
`FFF1.<o|a>.<z|r>.<b64url>` — `o`=ofertă, `a`=răspuns; `z` = SDP comprimat `deflate` (format zlib, prin `CompressionStream`; are sumă de control Adler-32,
deci un caracter greșit la copiere este detectat: în test, 40/40 corupții simple sunt respinse), `r` = brut (UTF-8) când `CompressionStream` lipsește sau nu câștigă spațiu.
Decodarea unui cod `z` cere `DecompressionStream` (Chrome/Edge 80+, Firefox 113+, Safari 16.4+); altfel eroare tradusă `no-decompress`.
La lipire sunt tolerate spații, linii noi și ghilimele. SDP-ul decodat este verificat (prima linie `v=0`, toate liniile `x=…`, ≤ 400 de linii).

### QR: un cod sau coduri succesive (varianta aleasă și motivul)
- Cod de **≤ 600 de caractere** → **un singur QR** (ECC M; ≈ versiunea 18–19, 89–93 module). O ofertă cu o singură adresă măsoară ≈ 550 de caractere.
- Mai lung (mai multe interfețe de rețea, IPv6 sau un candidat *srflx* adaugă câte ≈ 100–150 de caractere comprimate fiecare) → **cadre QR succesive** `FQ1.<id>.<i>.<n>.<parte>` de câte ≤ 330 de caractere (ECC M, ≈ versiunea 14, 73 module),
  afișate într-un carusel cu „Cod QR i din n”, butoane Anterior/Următorul și Pauză. Redarea automată (1,6 s/cadru) este oprită la `prefers-reduced-motion`.
  Scanarea acceptă cadrele **în orice ordine**, ignoră repetările și refuză cadrele corupte/amestecate (`id` = hash al codului întreg). Motiv: un QR de peste ~100 de module e greu de citit
  de pe ecran cu o cameră obișnuită; cadrele mici sunt fiabile, iar copierea de text rămâne mereu disponibilă ca alternativă.
- `FFF.p2p.frames(cod, {single, per})` și `FFF.p2p.assembler()` sunt publice (pentru aplicații cu interfață proprie).

Testul `test/p2p.test.mjs` verifică ambele variante cu dialogul real (cu `single:120, per:140` forțat): cadrele afișate se decodifică din imagine, se asamblează amestecate, iar conectarea se încheie citind cadrele din fișiere PNG.

### Citirea codului
`FFF.qr.scan(File)` (imagine din fișier/galerie) funcționează oriunde. `FFF.qr.scan(videoEl, {camera:true})` pornește camera **doar la această cerere explicită** (butonul „Scanează cu camera”);
cere HTTPS sau fișier local de încredere și permisiunea utilizatorului; erorile (refuz, lipsă cameră, context nesigur) au mesaje traduse; imaginile nu pleacă din browser.
Se folosește `BarcodeDetector` dacă există, altfel decodorul propriu (vezi mai jos). `FFF.qr.stopScan()` oprește camera.

## Opt-in, IP și limite (afișate și în dialog)
- Fiecare jucător își **expune adresa IP** (inclusiv adresa din rețeaua locală) celuilalt: face parte din cod. Dialogul cere bifa explicită înainte de „Găzduiește”/„Alătură-te”.
- Implicit **nu există niciun server ICE** → nicio cerere externă; apar doar candidate *host*. Conexiunea merge **în aceeași rețea locală** (sau pe același dispozitiv).
  Browserele reale ascund adresele locale în spatele unor nume mDNS (`<uuid>.local`); celălalt jucător le rezolvă prin multicast, ceea ce poate eșua în rețele cu izolare între clienți (Wi-Fi pentru oaspeți, rețele corporative).
- Câmpul **„Server STUN”** (gol implicit, opt-in) adaugă candidate publice (*srflx*): serverul STUN află adresa IP publică. Acceptă `stun:host:port` / `stuns:` (cel mult 3); alte scheme sunt respinse (`stun-invalid`). Nu există suport TURN.
- **Limită onestă:** NAT-urile **simetrice** (frecvente la rețelele mobile și corporative) **nu se pot traversa fără STUN/TURN** și nici cu STUN simplu; conexiunea eșuează după 30 s cu mesajul tradus „Conexiunea a eșuat…”. Nu există relay.
- Mesajele sunt text JSON (≤ 64 KiB); canalul este criptat de DTLS, dar identitatea celuilalt jucător nu este verificată (oferta/răspunsul trebuie primite pe un canal pe care îl consideri de încredere).
- Teste: Chromium headless a fost lansat cu `--allow-loopback-in-peer-connection` și `--disable-features=WebRtcHideLocalIpsWithMdns` (DOAR în test, ca să existe candidate resolvabile între două contexte). Un test informativ rulează și fără aceste steaguri; în mediul de test
  conexiunea s-a stabilit și așa (aceeași mașină, mDNS local), dar asta **nu** dovedește comportamentul între dispozitive diferite — acolo depinde de rețea, așa cum e descris mai sus.

## API `FFF.p2p`
| Funcție | Rezultat |
|---|---|
| `supported()` | `true` dacă există `RTCPeerConnection` |
| `host(opts)` | `Promise<session>` cu `.offer`; apoi `await session.accept(answerCode)` |
| `join(offerCode, opts)` | `Promise<session>` cu `.answer` |
| `dialog({title, onOpen(session), heartbeat, gatherTimeout, single, per})` | `<dialog>` modal cu pașii Găzduiește / Alătură-te; returnează `{element, promise, close(), session}`; `onOpen` primește sesiunea deschisă; închiderea înainte de conectare închide sesiunea |
| `lockstep(session, opts)` | sesiune de joc (mai jos) |
| `encodeSignal`, `decodeSignal`, `parseStun`, `frames`, `assembler`, `qrView` | utilitare publice |

`opts` (host/join): `stun` (șir sau listă), `heartbeat: {interval:2000, timeout:9000, giveUp:30000, connect:30000}`, `gatherTimeout` (4000 ms).
Colectarea candidatelor se încheie la `complete`, sau după ≥ 1 candidat și 500 ms de liniște (cu STUN: până la 2,5 s pentru un candidat *srflx*); fără niciun candidat → eroare `no-candidates`.

**Sesiune** (`session`): `role` (`host`|`guest`), `state` (`new`, `gathering`, `waiting-answer`, `connecting`, `open`, `lost`, `failed`, `closed`), `send(obj)` → `true|false`, `on(ev, fn)` → funcție de dezabonare, `off`,
`close()`, `reconnect(offerCode?)`, `rtt`, `stats`, `iceServers`, `channel` (`RTCDataChannel`), `open`.
Evenimente: `open`, `message(obj)`, `close(motiv)` (`local`, `remote`, `timeout`, `failed`, `channel-closed`, `cancel`, `reconnect`), `state`, `lost`, `recovered`, `latency(ms)`, `error(Error{code})`.
Coduri de eroare: `unsupported`, `bad-code`, `wrong-kind`, `no-decompress`, `no-candidates`, `stun-invalid`, `too-large`, `ice-failed`, `timeout`; `error.message` este tradus în limba curentă.

- **Heartbeat:** la fiecare 2 s se trimite `{"_fff":"ping"}`; partenerul răspunde `pong` (de aici `rtt`). Fără trafic 9 s → stare `lost` (eveniment `lost`); dacă traficul revine → `recovered`; după 30 s de tăcere → `close('timeout')`, stare `failed`. Mesajele `_fff` sunt interne și nu ajung la aplicație.
- **Închidere curată:** `close()` trimite `{"_fff":"bye"}`, închide canalul și conexiunea; partenerul primește `close('remote')`. Repetarea lui `close()` nu face nimic.
- **Intrări ignorate:** orice mesaj non-text, > 64 KiB, JSON invalid sau care nu e obiect este ignorat fără excepții.
- **Reconectare manuală:** `await session.reconnect()` (gazdă) → sesiune nouă cu ofertă nouă; oaspetele face `FFF.p2p.join(oferta)`; apoi `lockstep.rebind(sesiuneaNouă)` la ambii, ca să păstreze starea jocului.
- **Refuz grațios:** fără `RTCPeerConnection`, `host()`/`join()` resping cu `unsupported` (mesaj tradus) iar `dialog()` arată doar mesajul și butonul Închide.

## Protocol de joc: `FFF.p2p.lockstep(session, opts)`
Gazda este **autoritară**. Toate mutările primesc de la gazdă un număr de secvență `seq` (1, 2, 3, …) și sunt aplicate de ambii în aceeași ordine; oaspetele nu aplică nimic înainte ca gazda să confirme.

`opts`: `seed` (gazdă; implicit aleator pe 32 de biți), `onMove(move, info)`, `onState(state, info)`, `validate(move, {from, seq})` (doar gazda), `snapshot()` (gazda: starea completă, pentru resincronizare),
`hash()` (opțional: șir care rezumă starea; verifică divergența), `onChat(text, from)`, `onError(err)`, `timeout` (8000 ms, așteptarea confirmării la oaspete), `history` (500 de mutări păstrate de gazdă).

- `onMove(move, {seq, from:'host'|'guest', mine, rng})` aplică mutarea; **trebuie să fie deterministă** și să folosească doar `rng()` (PRNG mulberry32 inițializat cu `seed` comun) pentru aleatoriu. Returnează `false` sau un șir (motivul) ca să o refuze.
- `onState(state, {reason:'start'|'resync', seq, seed, rng})` — la început (`state` nedefinit) și la fiecare resincronizare completă (`state` = rezultatul lui `snapshot()`); aplicația își înlocuiește starea cu el.
- Returnează: `move(m)` → `Promise<{seq}>` (se respinge cu `code`: `rejected`, `timeout`, `closed`, `stopped`), `chat(text)`, `resync()`, `rebind(session)`, `stop()`, `seq`, `seed`, `role`, `rng()`, `stats` (`applied`, `rejected`, `dupes`, `resyncs`).

Mesaje (câmpul `t`):

| `t` | sens | conținut |
|---|---|---|
| `hello` | oaspete → gazdă | `{seq}`; trimis la deschidere, reluat de până la 8 ori (la 1,5 s) cât timp nu sosește `sync` |
| `sync` | gazdă → oaspete | `{seq, seed, rng, state?, resync?}` — început de joc sau stare completă |
| `move` | oaspete → gazdă | `{cid, move}` (propunere) |
| `move` | gazdă → oaspete | `{seq, move, from, cid?, h?}` (`h` = `hash()` după aplicare) |
| `reject` | gazdă → oaspete | `{cid, reason}` — mutare nevalidă (validate/onMove) |
| `need` | oaspete → gazdă | `{from, force?}` — lipsesc mutări după `from`, sau divergență (`force`) |
| `moves` | gazdă → oaspete | `{list:[{seq,move,from}…]}` — reluare din istoric |
| `chat` | ambele | `{text}` |
| `fatal` | gazdă → oaspete | `{reason}` — nu există istoric și nici `snapshot()` |

Reguli: gazda validează (`validate`, apoi `onMove`) înainte de a numerota; mutările duplicate/vechi (`seq` ≤ curent) sunt ignorate (`stats.dupes`); un `seq` cu gol este reținut și se cere `need` → gazda reia mutările din istoric, iar dacă nu le mai are (sau cererea e `force`) trimite starea completă (`sync` cu `resync:true`);
dacă `hash()` al oaspetelui nu coincide cu `h` primit, sau `onMove` eșuează la oaspete (divergență), oaspetele cere resincronizare completă. La reconectare, `rebind()` retrimite `hello`; gazda răspunde cu `sync` (cu `state` dacă există `snapshot()`), iar oaspetele aliniază `seq`/starea. Mutările făcute de gazdă cât timp nu există conexiune sunt recuperate prin acest `sync`.
Fără `snapshot()`, resincronizarea se face doar din istoric.
Demonstrație: `test/p2p-demo.html` (X și 0) — gazda joacă X, oaspetele 0; „Joc nou” alege cine începe cu `rng()` comun.

## FFF.qr (rezumat)
- `FFF.qr.matrix(text, {ecc:'M', minVersion, maxVersion, mask, mode:'auto'|'numeric'|'alnum'|'byte', eci:false, boost:false})` → `{size, version, ecc, mask, mode, eccPerBlock, blocks, dataCodewords, rows, get(x,y)}`; versiunile 1–40, ECC L/M/Q/H, numeric/alfanumeric/octet (UTF-8), mască aleasă după penalizările standard. Text prea lung → `Error{code:'qr-too-long'}` (maxim 2953 de octeți la L).
- `svg(text, {ecc, scale, margin, dark, light, label})` → șir SVG (`role="img"`, `aria-label` tradus, fără referințe externe); `canvas(text, opts)` → `<canvas>`; `render(matrix, opts)` → `{width,height,data}` (RGBA); `capacity(version, ecc)` → octeți.
- `decode(imageData)` → `{text, bytes, version, ecc, mask, corrected, corners}` sau `null`. Decodor propriu: binarizare adaptivă + Otsu (și variantă inversată), localizare *finder patterns* (raport 1:1:3:1:1, verificare încrucișată), mărimea modulului măsurată pe axa codului (corectă la rotire),
  omografie cu modelul de aliniere pentru perspectivă, citire format/versiune, corecție Reed–Solomon (Berlekamp–Massey + Chien + Forney) cu verificare a sindroamelor, ECI/UTF-8. **Nu** decodează Kanji, nu citește coduri Micro QR, nu face deblurare serioasă.
- Testat (vezi `test/qr.test.mjs`): toate cele 160 de combinații versiune×ECC la limita capacității, 160+ șiruri (diacritice, emoji, numeric, alfanumeric, până la ~1500 de octeți), deteriorări controlate (≤ ⌊ecc/2⌋ cuvinte per bloc, inclusiv rafale calculate din aranjarea reală), rotiri, scalări, zgomot, inversare, forfecare — comparat cu jsQR (Apache-2.0), folosit **numai ca referință în test**, nu este livrat.
