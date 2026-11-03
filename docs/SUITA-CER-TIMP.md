# Suita cer–timp (Etapa 6)

Șapte aplicații „fără frontiere” împart o singură locație, ora și fusul orar: **Eclipsa-2027, Bolta, Horizons.BeyondLimits, Universul-Observabil-3D, ORARIUM, CLEPSIDRA, Orar**. Codul comun e un singur fișier, [`tools/fff-place.js`](../tools/fff-place.js), injectat cu `node tools/inject-shared.mjs <dir> <slug>` (modul `fff-place` în `tools/envelope-adapters/plan.json`; `fff-jurnal` în plus la Eclipsa-2027 și Bolta). `inject-shared.mjs --check` verifică că fiecare copie e identică cu sursa. Adaptoarele `tools/envelope-adapters/Place-*.js` leagă modulul de starea proprie a fiecărei aplicații, fără a atinge codul acesteia.

## 1. Ce vede persoana

- Butonul **„📍 Locație”** (colț, stânga-jos) deschide dialogul „Locul și ora mele”: nume, latitudine, longitudine, fus orar IANA, listă de 38 de orașe, **„Folosește poziția dispozitivului”**, „Șterge locul”, alerta la eclipsă (oprită / 1 zi / 7 zile / 30 de zile), partajarea către celelalte aplicații și panoul de mai jos.
- Panoul **„Astea se întâmplă deasupra ta mâine”**: Soare (răsărit/apus), Lună (fază, % luminat, răsărit/apus), planetele de pe cerul întunecat (magnitudine, ora cea mai bună, înălțime, direcție; Uranus și Neptun „cu binoclul”), eclipsele de mâine și, dacă nu sunt, **următoarea eclipsă vizibilă de la locul tău** (până la 3 ani). În **Orar** apare direct în bara laterală; în celelalte, în dialog.
- **Alerta la eclipsă**: bară `role="alert"` în partea de sus a oricărei aplicații din suită, când o eclipsă (Soare: orice mărime; Lună: parțială sau totală) e vizibilă de la locul ales în intervalul ales; se poate ascunde (memorat pe eclipsă). La eclipsele de Soare arată „Nu privi Soarele fără filtre solare certificate (ISO 12312-2)”. Eclipsele de Lună doar prin penumbră se arată în panou, nu în alertă.
- **Orar**: butonul „Adaugă în agendă” pune eclipsele din panou în agenda Orar (prin importul `.ics` al aplicației); „Fus orar de afișare” din Setări urmează fusul locației comune.
- **Jurnalul de teren** (Etapa 4, `FFF.jurnal`) în **Eclipsa-2027 și Bolta**: în dialog, secțiunea „Jurnal de teren și eclipse” arată observațiile din jurnal care coincid (±12 ore) cu o eclipsă vizibilă de la coordonatele lor, cu atlasul SVG local al punctelor, iar „Adaugă o observație în jurnal” deschide jurnalul cu titlul eclipsei următoare și coordonatele locației comune.

## 2. Cum se propagă locația (exact)

Fiecare aplicație are **adresa ei** (`eclipsa-2027.chiuta.ro`, `bolta.chiuta.ro`, …), deci **origine web diferită**: `localStorage`, `BroadcastChannel` și evenimentul `storage` nu trec de la o adresă la alta, iar un cookie pe `.chiuta.ro` ar fi trimis la fiecare cerere către găzduire (scurgere de locație) — respins. Din acest motiv există două căi, ambele testate:

| Situație | Mecanism | Efort |
|---|---|---|
| Aplicații pe **aceeași origine** (aceeași adresă; de ex. toate sub un singur gazdă local, sau aceeași aplicație în mai multe file) | `localStorage` `fff.place.v1` + `BroadcastChannel("fff-place")` + evenimentul `storage`; „cea mai nouă (`t`) câștigă”; o aplicație deschisă mai târziu citește locația din stocare | automat, fără apăsări |
| Aplicații pe **origini diferite** (cazul real al celor 7 adrese) | plicul FFF `place/fff` ([FFF-ENVELOPE.md](FFF-ENVELOPE.md)): linkurile „Deschide {aplicație} cu acest loc” din dialog poartă plicul într-un fragment `#fffplace=…` (nu pleacă la server; se șterge din adresă imediat la încărcare); aplicația destinație arată banda „Importă / Nu” și **nu importă nimic fără apăsare**. Alternative: fișier `.fff.json`, clipboard, cod QR (dacă aplicația are `FFF.qr`), „Primește un loc…” | **o apăsare în fiecare aplicație de destinație** (6 apăsări pentru toate celelalte 6); introducerea locației rămâne **una singură** |

Limită onestă: pe origini diferite propagarea **nu e automată** — browserul nu permite, fără server sau cookie comun, ca o pagină să scrie în stocarea alteia. Apăsarea e un link, nu o reintroducere a coordonatelor. Aplicațiile care consumă locația în starea proprie (`Place-*.js`):

| Aplicație | Ce primește din locația comună | Sens invers |
|---|---|---|
| Eclipsa-2027 | calculatorul local de eclipsă (`e27.setLocation`, creat la prima deschidere) primește loc + fus | locul ales în calculator devine locația comună |
| Bolta | locul planetariului (`applyPlace`: nume, lat, lon, altitudine, fus) | locul aplicat în Bolta devine locația comună |
| ORARIUM | „Ora Pământului de referință” (`setRef`) = fusul locului | — |
| Orar | „Fus orar de afișare” (Setări) = fusul locului; panou în bara laterală; eclipsa → agendă | — |
| Horizons, Universul-Observabil-3D, CLEPSIDRA | aplicațiile n-au un loc propriu; primesc butonul, panoul și alerta (CLEPSIDRA își păstrează ceasul local) | — |

## 3. Confidențialitate

- Locația rămâne în `localStorage` (cheia `fff.place.v1`), nu se trimite nicăieri (CSP `connect-src 'none'`; testul blochează orice cerere în afara localhost).
- **Geolocalizarea doar la cerere**: la apăsarea „Folosește poziția dispozitivului” apare mai întâi acordul din aplicație („citesc poziția o singură dată… o păstrez doar în acest browser… o poți șterge oricând”); abia după „Da” se apelează `navigator.geolocation.getCurrentPosition` (și browserul cere propria permisiune). Coordonatele se rotunjesc la 3 zecimale (~100 m), fusul orar e cel al dispozitivului. Zero apeluri la încărcare și la deschiderea dialogului (testat cu un spion pe `geolocation`).
- Plicul `place/fff` conține doar `{v, lat, lon, name, tz, alt}` (fără semnătură; poate fi semnat de modulul plicului). Linkurile și fișierele cu locația sunt date personale: ca orice plic, nu circulă fără gestul persoanei.

## 4. Precizie și limite

Motorul e propriu (Meeus: Soare cap. 25, Lună cap. 47 cu 60+60 de termeni; planete prin elemente keplerian aproximative JPL 1800–2050; eclipse prin geometria Soare–Lună topocentrică, Lună prin umbra Pământului cu factorul Danjon 1,02). Verificat în `tests/place.test.mjs` față de `FFF.ephem` din kit (VSOP87D/ELP truncate, validat în kit față de JPL DE421 și pyephem): Soare < 0,01°, Lună < 0,003°, planete < 0,08° (poziție), răsărit/apus Soare < 5 s și Lună < 15 s, eclipsa din 2 aug 2027 pe 7 locuri: tip identic, maximul la ≤ 19 s, mărimea la ≤ 0,0025, durata totalității la ≤ 4 s; eclipse de Lună 2025–2026 (tip, moment ±2 min, mărime umbrală ±0,01 față de valorile NASA reținute din memorie, marcate ca atare în test). Magnitudinile planetelor folosesc aceleași formule Meeus ca kitul (deci nu sunt o verificare independentă). **Nu e un instrument de navigație, de astrofotografie de precizie sau de siguranță la privirea Soarelui.** Panoul „mâine” se calculează pe ora locului (fusul IANA din locație); ziua de „mâine” e data locală + 1.

## 5. API (`window.FFF.place`)

`get()`, `set({lat,lon,name,tz,alt}, src)`, `clear()`, `onChange(f)`, `envelope()` / `accept(env)` / `linkFor(app)`, `panel(container, {bare})`, `openDialog()`, `configure({corner, into, chip})`, `options()` / `setOptions({alertDays})`, `hooks.addToAgenda`, `locate(cb)`, `setNow(ms)` (teste), `setApps(list)` (teste), `engine` (sunGeo, moonGeo, planet, topo, crossings, findEclipses, local, nextVisible, sky), `I18N` (8 limbi, paritate verificată). Rulează și în Node (`require('./tools/fff-place.js')`).

## 6. Teste

```
node tests/place.test.mjs                                   # Node: motor vs kit, locație, paritate i18n (16 verificări)
node tests/place-suite.test.mjs [filtru] [--root DIR]       # Chromium, rețea blocată; DIR = depozitele aplicațiilor injectate; FFF_AXE pentru axe-core
```

Pe lângă acestea, fiecare aplicație își rulează testele proprii. Cupa-Mondiala-2026 (arhivare după eveniment) are `tests/arhiva-mod.test.mjs` în depozitul ei.
