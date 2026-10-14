# FFF.ephem — efemeride astronomice locale

**Versiune:** 1.0.0 · **Ultima actualizare:** 14 octombrie 2026 · Module: `ephem` (`src/ephem.js`, 193.6 kB) și `ephemstars` (opțional, `src/ephem-stars.js`, 92.2 kB, doar pentru planetariu).

Bibliotecă astronomică fără dependențe, fără rețea, în JavaScript ES2020: Soare, Lună, planete (Mercur … Neptun, plus Pluto), timp (zi iuliană, ΔT, timp sideral), nutație și oblicitate, coordonate ecuatoriale / ecliptice / orizontale (cu refracție opțională), aberație și paralaxă diurnă, răsărit / apus / trecere la meridian, crepuscule, faze lunare, mărimi aparente, elongații — și **eclipsa totală de Soare din 2 august 2027** (elemente Besselian din propriile efemeride, circumstanțe locale pentru orice coordonate, traseul benzii totalității ca GeoJSON).

> **Avertisment.** Este o unealtă de ilustrare, planificare și educație. **Nu este potrivită pentru navigație** (maritimă, aeriană, terestră sau spațială), geodezie, urmărirea sateliților, ocultații stelare, calendare religioase sau legale, nici pentru observații astrometrice de precizie. Pentru eclipse: **nu priviți Soarele fără filtru certificat** (ISO 12312-2); programul nu înlocuiește publicațiile oficiale ale observatoarelor.

## Convenții

| Mărime | Convenție |
|---|---|
| Timp de intrare `jd` | Zi iuliană pe scara **UT** (UT1 ≈ UTC; diferența ≤ 0,9 s este neglijată). `FFF.ephem.jdFromDate(Date)` convertește din `Date`; ΔT se aplică intern. |
| Unghiuri publice | **Grade**. Longitudine geografică pozitivă spre **est**; azimut de la **nord** spre est (N = 0°, E = 90°). |
| Distanțe | UA (`dist`) sau km (`distKm`). |
| Coordonate ale corpurilor | **Aparente**, geocentrice, în echinocțiul și ecuatorul adevărate ale datei (nutație, aberație anuală, timp-lumină incluse). `ra`, `dec`, `lon`, `lat`. |
| Răsărit / apus | Centrul Soarelui / Lunii cu limbul **superior** la orizont + refracție standard 34′ (`h0 = −34′ − semidiametru`); planete: −34′. Crepuscule: centrul Soarelui la −6°, −12°, −18° (fără refracție). Ziua este ziua civilă locală cu `opts.tz` (ore față de UTC; implicit `round(lon/15)`). |

## API

```js
const E = FFF.ephem;
const jd = E.jdFromDate(new Date());               // UT
E.sun(jd)                                          // {lon,lat,ra,dec,dist,distKm,sd,mag,eps}
E.moon(jd)                                         // + elong, angle(0–360), illum, phaseAngle, brightLimb, parallax, sd, mag
E.planet('mars', jd)                               // 'mercury'…'neptune','pluto' (și 'marte','jupiter'…): + elong, elongSigned, illum, phaseAngle, mag, helioDist, sd
E.observe('moon', jd, lat, lon, elevM, {refraction:true})   // topocentric (paralaxă): ra, dec, alt, az, altGeom, ha
E.toHorizontal(ra, dec, jd, lat, lon, {refraction:true})    // {alt, az, altGeom, ha, refraction}
E.riseSetTransit('sun', date, lat, lon, {tz:3, elev:0})     // {rise,set,transit,transitAlt,lowerTransit,status}  (JD UT sau null)
E.rise / E.set / E.transit                          // scurtături
E.twilight(date, lat, lon, {tz:3})                  // {civil:{dawn,dusk},nautical:{…},astronomical:{…}}
E.moonPhase(jd)                                     // {angle, illum, fraction, age, name, waxing, brightLimb…}
E.nextPhase(jd, 'new'|'first'|'full'|'last', ±1)    // momentul (JD UT) următoarei/precedentei faze
E.moonPhases(from, to)                              // listă [{kind, jd}]
E.elongation('venus', jd) · E.magnitude('jupiter', jd)
E.sidereal(jd, lonE) · E.gmst(jd) · E.gast(jd) · E.nutation(jd) · E.obliquity(jd, apparent)
E.deltaT(jd) · E.setDeltaT(secunde|funcție|null) · E.tt(jdUT) · E.ut(jdTT)
E.jdFromCalendar(y,mo,d,h,mi,s) · E.calendarFromJd(jd) · E.dateFromJd(jd)
E.starPosition(ra2000, dec2000, pmRa, pmDec, jd)    // poziție aparentă a unei stele (mișcare proprie, precesie, nutație, aberație)
E.precess(ra, dec, jdFrom, jdTo) · E.eqToEcl(ra, dec, jd)
E.label('phase', 'full')                            // text tradus în 8 limbi prin FFF.t('ephem', …)
```

`riseSetTransit(...).status` ∈ `normal` · `alwaysUp` (Soarele de la miezul nopții) · `alwaysDown` (noaptea polară) · `noRise` · `noSet` (evenimentul nu are loc în ziua respectivă).

### Eclipsa din 2 august 2027

```js
E.eclipse.greatest()                        // γ, momentul maxim global, punctul (lat,lon), magnitudinea, durata, lățimea benzii
E.eclipse.local(lat, lon, elevM, {timeZone:'Europe/Bucharest'})
   // {type:'total'|'partial'|'annular'|'none', magnitude, magnitudeFraction, obscuration,
   //  c1,c2,max,c3,c4:{jd,utc,local,localDate,offsetMin,sunAlt,sunAz,visible}, durationTotality, durationPartial, inBand, marginKm}
E.eclipse.inBand(lat, lon, elevM)           // {inBand, type, magnitude, obscuration, marginKm}
E.eclipse.path({stepMin:5})                 // GeoJSON FeatureCollection: central-line, north-limit, south-limit, totality-band (Polygon), greatest-eclipse (Point)
E.eclipse.elements()                        // polinoame cubice (t în ore față de 10:00 TT) pentru x, y, d, μ, l1, l2 — format Espenak
E.eclipse.bessel(jdTT)                      // elementele instantanee
E.eclipse.places                            // câteva localități (RO + traseul benzii) cu fusul orar IANA
E.eclipseLocal                              // alias pentru E.eclipse.local
```

Convenții ale eclipsei: raza Soarelui 696 000 km; raza Lunii / raza ecuatorială a Pământului **k = 0,2725076** pentru penumbră (contacte C1/C4, magnitudine și obscurare ale fazei parțiale) și **k = 0,272281** pentru umbră (C2/C3, durata totalității, raportul diametrelor) — convenția NASA/Espenak; `opts.k` (număr sau `{penumbra, umbra}`) o poate schimba. *Magnitudinea* (`magnitude`) urmează NASA: raportul diametrelor Lună/Soare în banda totalității (1,0790 în punctul maxim), fracția din diametrul Soarelui în faza parțială; `magnitudeFraction` este fracția din diametru (definiția Meeus) peste tot. *Obscurarea* este fracția din **aria** discului solar acoperită. Ora locală se dă cu `timeZone` (nume IANA, prin `Intl`) sau `tz` (ore); implicit `round(lon/15)`.

## Ce este în fișier

| Componentă | Conținut | Dimensiune |
|---|---|---|
| Planete + Soare (VSOP87D) | 3735 din 31577 termeni (prag 3e-7 UA·cos, ponderat cu 0,15^k pentru seria t^k) — serii heliocentrice sferice, echinocțiul datei (Bretagnon & Francou 1988) | 121 kB |
| Luna (ELP/MPP02) | 669 din 4862 termeni (praguri: L 0.02″, B 0.02″, R 0.2 km) (Chapront & Francou 2002, ajustat pe DE405) + tabelele Meeus 47 (60+60 termeni) ca verificare încrucișată | 24 kB |
| Pluto | Meeus cap. 37 (43 termeni; valabil 1885–2099) | ~3 kB |
| Nutație | IAU 1980, 63 termeni (Meeus 22.A); oblicitate medie IAU 2006 | ~3 kB |
| ΔT | tabel anual 1973–2027 (IERS) + polinoamele Espenak–Meeus (2004) | ~1 kB |
| Eclipsa 2027 | elemente Besselian calculate direct (fără polinoame), contacte prin rezolvare numerică, traseu GeoJSON | ~25 kB cod |
| **Total `ephem.js`** | | **193.6 kB** (țintă ≤ 350 kB) |
| `ephem-stars.js` | 1627 stele (V ≤ 5,0) cu J2000, mișcare proprie, V, B−V; nume proprii pentru stelele V ≤ 3,0 (156); 88 de constelații cu figuri (150 segmente) și denumiri românești | **92.2 kB** |

Alegerea ELP/MPP02 în locul seriei Meeus 47 (60+60 termeni) reduce eroarea Lunii de la ≈ 9″ la < 1″ cu doar ~20 kB în plus; seria Meeus rămâne în fișier (`E.moonMeeus(jd)`) ca verificare încrucișată.

## Acuratețe măsurată (și ce se garantează)

**Metodă.** Referințele sunt calculate *independent* de cod, în `test/ref/make_ephem_ref.py`: efemeridele JPL **DE421** (1900–2050) și **DE423** (2050–2100) citite cu `jplephem`, cu timp-lumină, aberație (`erfa.ab`) și matricea bias–precesie–nutație IAU 2006/2000A (`erfa.pnm06a`) din ERFA; ΔT și timpul sideral din `astropy` + IERS; momentele fazelor și evenimentele de răsărit/apus din DE421 (cod propriu, Python); verificare încrucișată cu `pyephem` (libastro). Testele (`test/ephem.test.mjs`) compară 240 de date între 1900 și 2100 (poziții), 100 de combinații loc–moment (orizont), 50 de zile–locuri (răsărit/apus/trecere/crepuscule), 112 momente de fază, 120 de momente (timp sideral) și eclipsa din 2027. Pragurile din ultima coloană sunt cele **verificate automat** (depășirea lor face testul să eșueze); ele sunt și valorile pe care le **garantăm**, cu o marjă de ~2× peste maximul măsurat.

| Măsurătoare | n | max | medie | prag | unit. |
|---|---:|---:|---:|---:|---|
| ΔT față de IERS (1973–2026) | 108 | 0.06892 | 0.01544 | 0.15 | s |
| timp sideral aparent (GAST) față de ERFA gst06a | 120 | 0.08738 | 0.03626 | 0.3 | ″ |
| poziție aparentă sun (ra/dec) față de DE421/423 | 240 | 0.6879 | 0.1957 | 1.5 | ″ |
| distanță sun (eroare relativă) | 240 | 2.58e-6 | 5.86e-7 | 5.00e-6 | — |
| poziție aparentă moon (ra/dec) față de DE421/423 | 240 | 0.6747 | 0.1634 | 1.5 | ″ |
| distanță moon (eroare relativă) | 240 | 8.51e-6 | 1.62e-6 | 2.00e-5 | — |
| poziție aparentă mercury (ra/dec) față de DE421/423 | 240 | 0.777 | 0.2429 | 2 | ″ |
| distanță mercury (eroare relativă) | 240 | 3.66e-6 | 7.77e-7 | 1.00e-5 | — |
| poziție aparentă venus (ra/dec) față de DE421/423 | 240 | 1.326 | 0.3039 | 3 | ″ |
| distanță venus (eroare relativă) | 240 | 9.24e-6 | 1.07e-6 | 2.00e-5 | — |
| poziție aparentă mars (ra/dec) față de DE421/423 | 240 | 1.45 | 0.3014 | 3 | ″ |
| distanță mars (eroare relativă) | 240 | 9.02e-6 | 7.85e-7 | 2.00e-5 | — |
| poziție aparentă jupiter (ra/dec) față de DE421/423 | 240 | 0.7923 | 0.3001 | 2 | ″ |
| distanță jupiter (eroare relativă) | 240 | 8.90e-7 | 2.41e-7 | 5.00e-6 | — |
| poziție aparentă saturn (ra/dec) față de DE421/423 | 240 | 0.6352 | 0.2809 | 2 | ″ |
| distanță saturn (eroare relativă) | 240 | 8.61e-7 | 2.65e-7 | 5.00e-6 | — |
| poziție aparentă uranus (ra/dec) față de DE421/423 | 240 | 1.437 | 0.4895 | 3 | ″ |
| distanță uranus (eroare relativă) | 240 | 3.47e-6 | 1.15e-6 | 1.00e-5 | — |
| poziție aparentă neptune (ra/dec) față de DE421/423 | 240 | 2.936 | 1.194 | 5 | ″ |
| distanță neptune (eroare relativă) | 240 | 2.55e-6 | 1.11e-6 | 1.00e-5 | — |
| poziție aparentă pluto (ra/dec) față de DE421/423 | 240 | 3.504 | 0.9219 | 7 | ″ |
| distanță pluto (eroare relativă) | 240 | 7.04e-6 | 3.19e-6 | 2.00e-5 | — |
| Lună: ELP/MPP02 față de Meeus 47 (longitudine, inclusiv ~0,7″ timp-lumină) | 60 | 7.379 | 2.298 | 14 | ″ |
| altitudine topocentrică față de DE421 | 100 | 0.4146 | 0.1394 | 2 | ″ |
| azimut topocentric față de DE421 (×cos alt) | 100 | 0.3529 | 0.1099 | 2 | ″ |
| răsărit Soare | 48 | 0.07837 | 0.03306 | 1 | s |
| apus Soare | 48 | 0.09342 | 0.03819 | 1 | s |
| trecere Soare | 50 | 0.106 | 0.05379 | 1 | s |
| răsărit Lună | 47 | 0.103 | 0.04098 | 2 | s |
| apus Lună | 47 | 0.116 | 0.04742 | 2 | s |
| trecere Lună | 50 | 0.1118 | 0.05498 | 2 | s |
| răsărit Jupiter | 50 | 0.08747 | 0.03958 | 2 | s |
| apus Jupiter | 50 | 0.1006 | 0.03555 | 2 | s |
| trecere Jupiter | 50 | 0.1194 | 0.05126 | 2 | s |
| răsărit Venus | 48 | 0.2517 | 0.05038 | 2 | s |
| apus Venus | 48 | 0.1642 | 0.05607 | 2 | s |
| crepuscul civil (dimineața) | 48 | 0.08473 | 0.04229 | 1.5 | s |
| crepuscul civil (seara) | 48 | 0.08578 | 0.03608 | 1.5 | s |
| crepuscul nautical (dimineața) | 48 | 0.0795 | 0.0367 | 1.5 | s |
| crepuscul nautical (seara) | 48 | 0.07636 | 0.04326 | 1.5 | s |
| crepuscul astronomical (dimineața) | 48 | 0.09527 | 0.03908 | 1.5 | s |
| crepuscul astronomical (seara) | 48 | 0.08529 | 0.03671 | 1.5 | s |
| fază lunară față de valori publicate (minut) | 10 | 26.58 | 13.32 | 200 | s |
| fază lunară new față de DE421 (TT) | 28 | 0.9866 | 0.3507 | 5 | s |
| fază lunară first față de DE421 (TT) | 28 | 1.599 | 0.3843 | 5 | s |
| fază lunară full față de DE421 (TT) | 28 | 1.019 | 0.3554 | 5 | s |
| fază lunară last față de DE421 (TT) | 28 | 1.001 | 0.4585 | 5 | s |
| poziție sun față de pyephem | 40 | 0.5089 | 0.2464 | 15 | ″ |
| poziție moon față de pyephem | 40 | 2.806 | 0.5037 | 40 | ″ |
| mărime aparentă moon față de pyephem | 40 | 0.2376 | 0.09074 | 0.5 | mag |
| elongație moon față de pyephem | 40 | 0.005842 | 0.005547 | 0.02 | ° |
| fracție iluminată moon față de pyephem | 40 | 0.0152 | 0.004235 | 0.5 | % |
| poziție mercury față de pyephem | 40 | 0.5866 | 0.2672 | 15 | ″ |
| mărime aparentă mercury față de pyephem | 40 | 0.7063 | 0.1539 | 0.9 | mag |
| elongație mercury față de pyephem | 40 | 5.19e-4 | 2.01e-4 | 0.02 | ° |
| fracție iluminată mercury față de pyephem | 40 | 0.0297 | 0.0147 | 0.5 | % |
| poziție venus față de pyephem | 40 | 1.424 | 0.3417 | 15 | ″ |
| mărime aparentă venus față de pyephem | 40 | 0.2037 | 0.1131 | 0.25 | mag |
| elongație venus față de pyephem | 40 | 0.001842 | 7.30e-4 | 0.02 | ° |
| fracție iluminată venus față de pyephem | 40 | 0.005694 | 0.003776 | 0.5 | % |
| poziție mars față de pyephem | 40 | 0.9544 | 0.3341 | 15 | ″ |
| mărime aparentă mars față de pyephem | 40 | 0.1113 | 0.01699 | 0.25 | mag |
| elongație mars față de pyephem | 40 | 0.01032 | 0.003064 | 0.02 | ° |
| fracție iluminată mars față de pyephem | 40 | 0.001125 | 6.01e-4 | 0.5 | % |
| poziție jupiter față de pyephem | 40 | 0.4496 | 0.2385 | 15 | ″ |
| mărime aparentă jupiter față de pyephem | 40 | 0.1578 | 0.1499 | 0.25 | mag |
| elongație jupiter față de pyephem | 40 | 0.01141 | 0.004542 | 0.02 | ° |
| fracție iluminată jupiter față de pyephem | 40 | 5.33e-5 | 2.88e-5 | 0.5 | % |
| poziție saturn față de pyephem | 40 | 0.4824 | 0.2586 | 15 | ″ |
| mărime aparentă saturn față de pyephem | 40 | 0.2798 | 0.1777 | 0.6 | mag |
| elongație saturn față de pyephem | 40 | 0.01111 | 0.005277 | 0.02 | ° |
| fracție iluminată saturn față de pyephem | 40 | 1.34e-5 | 6.12e-6 | 0.5 | % |
| poziție uranus față de pyephem | 40 | 0.4701 | 0.2416 | 15 | ″ |
| mărime aparentă uranus față de pyephem | 40 | 0.01161 | 0.005666 | 0.25 | mag |
| elongație uranus față de pyephem | 40 | 0.01122 | 0.004556 | 0.02 | ° |
| fracție iluminată uranus față de pyephem | 40 | 4.34e-6 | 2.09e-6 | 0.5 | % |
| poziție neptune față de pyephem | 40 | 0.4386 | 0.2381 | 15 | ″ |
| mărime aparentă neptune față de pyephem | 40 | 0.004878 | 0.002363 | 0.25 | mag |
| elongație neptune față de pyephem | 40 | 0.01121 | 0.004913 | 0.02 | ° |
| fracție iluminată neptune față de pyephem | 40 | 3.66e-6 | 2.08e-6 | 0.5 | % |
| poziție pluto față de pyephem | 40 | 9.815 | 6.783 | 40 | ″ |
| mărime aparentă pluto față de pyephem | 40 | 0.06643 | 0.0357 | 0.25 | mag |
| elongație pluto față de pyephem | 40 | 0.01314 | 0.007406 | 0.02 | ° |
| fracție iluminată pluto față de pyephem | 40 | 4.47e-6 | 1.96e-6 | 0.5 | % |
| poziție aparentă stea (PM+precesie+nutație+aberație) față de ERFA atci13 | 93 | 0.2575 | 0.1308 | 1 | ″ |
| γ față de valoarea publicată 0,1421 | 1 | 2.60e-5 | 2.60e-5 | 3.00e-4 | — |
| momentul maximului față de „≈ 10:07 UT” (ordin minut) | 1 | 19.87 | 19.87 | 90 | s |
| momentul maximului (TT) față de 10:07:50 TD (valoare publicată, la secundă) | 1 | 0.1215 | 0.1215 | 20 | s |
| magnitudinea (raport diametre) față de 1,0790 | 1 | 4.36e-5 | 4.36e-5 | 5.00e-4 | — |
| durata maximă față de 6 m 23 s | 1 | 0.5793 | 0.5793 | 1.5 | s |
| latitudinea maximului față de 25°31,5′N | 1 | 0.02354 | 0.02354 | 0.06 | ° |
| longitudinea maximului față de 33°09,5′E | 1 | 0.01282 | 0.01282 | 0.06 | ° |
| lățimea benzii față de 258 km | 1 | 0.0483 | 0.0483 | 0.5 | km |
| element Besselian x (raze ecuatoriale ×1e6) | 9 | 34.26 | 34.14 | 100 | ×1e-6 Re |
| element Besselian y (×1e6) | 9 | 38.07 | 36.72 | 100 | ×1e-6 Re |
| element Besselian d | 9 | 0.03281 | 0.03167 | 0.2 | ″ |
| element Besselian μ | 9 | 0.001352 | 6.21e-4 | 0.05 | ″ |
| element Besselian l1 (×1e6) | 9 | 0.321 | 0.3144 | 5 | ×1e-6 Re |
| element Besselian l2 (×1e6) | 9 | 0.3194 | 0.3128 | 5 | ×1e-6 Re |
| γ față de DE421 | 1 | 2.18e-5 | 2.18e-5 | 1.00e-4 | — |
| momentul maximului global față de DE421 | 1 | 0.2804 | 0.2804 | 2 | s |
| contact C1 față de referință | 15 | 0.4212 | 0.3181 | 3 | s |
| contact C4 față de referință | 15 | 0.3299 | 0.2091 | 3 | s |
| momentul maximului local față de referință | 15 | 1.265 | 0.7387 | 3 | s |
| magnitudine (fracție) față de referință | 15 | 8.63e-5 | 6.89e-5 | 5.00e-4 | — |
| obscurare față de referință | 15 | 0.0098 | 0.005925 | 0.05 | % din disc |
| altitudinea Soarelui la maxim față de referință | 15 | 0.004594 | 0.00124 | 0.02 | ° |
| contact C2 față de referință | 4 | 0.4997 | 0.2988 | 3 | s |
| contact C3 față de referință | 4 | 0.4509 | 0.2046 | 3 | s |
| durata totalității față de referință | 4 | 0.2526 | 0.1368 | 1.5 | s |
| linia centrală: separarea Soare–Lună (referință DE421) | 22 | 0.225 | 0.1735 | 3 | ″ |
| limita benzii: separarea − raza umbrei (referință DE421) | 40 | 0.1625 | 0.1328 | 3 | ″ |

**România (calcul; marja de eroare din rândurile de mai sus):**

| Localitate | C1 | maxim | C4 | Obscurare | Magnitudine (fracție de diametru) | Obscurare, referință independentă |
|---|---|---|---|---:|---:|---:|
| București | 11:24:21 | 12:32:09 | 13:40:28 | 51.2% | 0.597 | 51.2% |
| Constanța | 11:28:33 | 12:36:06 | 13:43:41 | 49% | 0.578 | 49% |
| Cluj-Napoca | 11:22:36 | 12:27:21 | 13:33:01 | 45.8% | 0.552 | 45.8% |
| Iași | 11:29:30 | 12:32:38 | 13:36:03 | 40.3% | 0.503 | 40.3% |
| Timișoara | 11:17:47 | 12:24:24 | 13:32:22 | 51.9% | 0.603 | 51.9% |
| Brașov | 11:24:35 | 12:30:41 | 13:37:23 | 47.6% | 0.567 | 47.6% |
| Craiova | 11:20:27 | 12:28:48 | 13:38:06 | 54.3% | 0.623 | 54.3% |
| Sulina | 11:31:12 | 12:36:52 | 13:42:26 | 44.3% | 0.539 | 44.3% |

(Ore locale în EEST, UTC+3, 2 august 2027.)


**Ce garantăm, pe scurt (1900–2100):** Soare și planete, poziții aparente ≤ 3″ (Neptun ≤ 5″, Pluto ≤ 7″); Luna ≤ 1,5″ în direcție și ≤ 2·10⁻⁵ în distanță; timp sideral ≤ 0,6″ (0,04 s); răsărit/apus ale Soarelui ≤ 6 s, ale Lunii ≤ 25 s față de modelul fizic de referință (definiția orizontului de mai sus); fazele lunare ≤ 30 s; ΔT față de IERS ≤ 0,25 s în 1973–2026. Cerința inițială a kitului era mai relaxată (Soare/planete ≤ 1′, Lună ≤ 10″); în practică se obține mult mai bine, dar **doar** în condițiile de mai jos.

### Ce NU se garantează

- **Magnitudinea aparentă a lui Mercur** la unghiuri de fază mari (aproape de conjuncții) diferă de pyephem cu până la ≈ 0,7 mag (formula Mallama–Hilton vs. formulele clasice); celelalte corpuri ≤ 0,3 mag, iar magnitudinile sunt oricum orientative.

* **ΔT în viitor.** Rotația Pământului nu este predictibilă: ΔT este *măsurat* până în 2026 și *prezis de IERS* pentru 2027; după aceea polinomul Espenak–Meeus este ancorat la ultima valoare (decalaj atenuat cu e-fold de 50 de ani). Eroarea ΔT este eroarea directă a oricărui moment exprimat în UT: ≲ 1 s în 2027, de ordinul secundelor până în 2035, de ordinul minutelor spre 2100. `E.setDeltaT(x)` permite actualizarea. Înainte de 1973 se folosește polinomul (≈ 0,1–1 s față de observații în secolul XX).
* **Navigație și siguranță.** Nu se garantează nimic pentru utilizări unde o eroare poate periclita persoane sau bunuri.
* **În afara 1900–2100.** VSOP87D și ELP degradează lent în afara intervalului testat, Pluto (serie Meeus) este valid doar 1885–2099, ΔT devine nesigur.
* **Refracția** (Sæmundsson, 1010 hPa, 10 °C) este o aproximare: aproape de orizont, în funcție de vreme și relief, momentele de răsărit/apus reale diferă cu minute; nu este modelat relieful, atmosfera locală, anomaliile de refracție (Novaya Zemlya) și nici „dip-ul” orizontului (doar opțional prin `elev` pentru răsărit/apus).
* **Aberația diurnă, deflexia luminii de către Soare, paralaxa stelară și viteza radială** nu sunt modelate (efecte ≲ 0,3″, 0,004″, ≤ 0,8″ pentru Alpha Cen).
* **Ocultații, eclipse de Lună, tranzite, satelitul planetelor** nu sunt incluse. Eclipsa din 2027 este singura eclipsă calculată (cu `opts`/`eclGlobal` extensibil, dar neverificat pentru alte date).
* **Dimensiunile aparente și mărimile planetelor** sunt formule medii (Meeus/Almanahul Astronomic); inelele lui Saturn sunt modelate simplu; mărimile pot diferi cu 0,1–0,3 mag față de observații.
* **Denumirile românești** ale constelațiilor și ale stelelor sunt uzuale/propuse, **nu o nomenclatură oficială**; traducerile fr/it/es/pt/hu/de ale etichetelor sunt automate și **neverificate nativ**.

## Eclipsa totală de Soare din 2 august 2027 — rezultate și validare

Calculate cu `E.eclipse.*` (ΔT = 69,75 s, valoare prezisă de IERS pentru 2027,6):

| Mărime | Calculat (FFF.ephem) | Publicat (NASA/Espenak) |
|---|---|---|
| γ (gamma) | 0.14207 | 0,1421 |
| Maxim global | 10:06:40 UT | ≈ 10:07 UT (10:07:50 TD) |
| Magnitudine (raport diametre) | 1.0790 | 1,0790 |
| Durata totalității la maxim | 6 m 22.4 s | 6 m 23 s |
| Lățimea benzii | 258.0 km | 258 km |
| Punct de maxim | 25.501°N 33.171°E | 25°31,5′N 33°09,5′E |
| Altitudinea Soarelui la maxim | 81.7° | 82° |

Sensibilitate la raza Lunii: cu k = 0,2725076 și pentru umbră, durata ar fi 386.8 s, magnitudinea 1.0799, banda 261.0 km (convenția aleasă reproduce valorile NASA).

**Validare.** (1) Față de valorile publicate (NASA/Espenak, rotunjite): γ = 0,1421; maxim 10:07:50 TD ≈ 10:06:40 UT; magnitudine 1,0790; durată maximă 6 m 23 s; lățimea benzii 258 km; punct de maxim ≈ 25°31,5′N 33°09,5′E (lângă Luxor). (2) Față de un calcul independent, în Python, bazat pe DE421, cu o formulare *diferită* (separarea topocentrică a centrelor, nu planul Besselian): erorile măsurate (contacte, magnitudine, obscurare, durată, limitele benzii) sunt în tabelul de mai sus, rândurile „eclipsă / contact / element Besselian / linia centrală / limita benzii”.

**Pentru România** (calcul, nu citat din memorie): eclipsa este **parțială** pe tot teritoriul; banda totalității trece prin Gibraltar/Maroc, Tunisia, Libia, Egipt, Arabia Saudită, Yemen și Somalia. Obscurarea (aria discului solar acoperită), ora locală (EEST = UTC+3) și Soarele la maxim sunt în tabelul „România” de mai sus; marja de eroare a obscurării din model este ≲ 0,05 puncte procentuale (max 0,01 puncte procentuale față de referința independentă), la care se adaugă incertitudinea ΔT (≈ ± 1 s ⇒ ± 0,01 puncte procentuale).

## Traseul benzii (GeoJSON)

`E.eclipse.path({stepMin: 5})` întoarce `FeatureCollection` cu: `central-line` (LineString, `properties.times` = ore UTC `HH:MM:SS` pentru fiecare punct), `north-limit` / `south-limit` (LineString), `totality-band` (Polygon închis) și `greatest-eclipse` (Point). Coordonate `[lon, lat]` în grade (WGS84). Punctele sunt la multipli de `stepMin` minute UTC, plus capetele. `properties.samples` conține și momentele în TT. Limitele nu sunt calculate unde umbra nu mai taie elipsoidul (apropiere de terminator).

## Catalog stelar (`ephemstars`)

`FFF.ephem.stars`: `list` (obiecte `{hip, ra, dec, pmRa, pmDec, mag, bv, desig, en, ro}`; `ra`/`dec` în grade J2000 ICRS, `pm*` în mas/an, `pmRa` include cos δ), `byHip`, `constellations` (`{id, la, gen, en, ro, label:{ra,dec}, lines:[[[ra,dec],…]]}`), `color(bv)` → `#rrggbb`, `find(text)`, `nearest(ra,dec,maxDeg)`, `position(star, jd)` (poziție aparentă). Surse: **Hipparcos** noua reducere (ESA, van Leeuwen 2007, domeniu public) prin pachetul MIT `hipparcos-catalog`; **d3-celestial** (BSD-3-Clause, Olaf Frohn) pentru V, B−V, denumiri IAU/Bayer/Flamsteed și figurile constelațiilor; licențele complete sunt în `THIRD-PARTY.md`. Limite: V ≤ 5,0 (nu e potrivit pentru câmpuri înguste), poziția la epoca J2000 fără paralaxă, două stele cu coordonate din d3-celestial fără mișcare proprie, figurile sunt „stick figures” convenționale (nu limite oficiale IAU).

## Reproducere

```
node test/ephem.test.mjs                  # 0 eșecuri; EPHEM_TABLE=1 afișează tabelul erorilor, EPHEM_REPORT=cale.json îl salvează
node test/ephem.browser.mjs               # integrare în Chromium, rețea blocată
node tools/gen-ephem.mjs  <node_modules/astronomia>        # regenerează src/ephem.js din date
node tools/gen-stars.mjs  <node_modules/d3-celestial> <hip2.dat>   # regenerează src/ephem-stars.js
node test/ref/dump_js_inputs.mjs > in.json && python3 test/ref/make_ephem_ref.py in.json   # regenerează referințele (≈ 20 min; vezi antetul scriptului)
```
