# Componente de terți — fff-kit

Fiecare modul își declară mai jos sursele și licențele (doar licențe permisive: MIT/BSD/Apache/ISC/CC0/domeniu public).

<!-- ephem:start -->
## FFF.ephem / FFF.ephem.stars (efemeride astronomice)

Cod propriu (scris pentru acest kit). Datele numerice și tabelele de mai jos provin din surse permisive, iar generatoarele lor sunt în `tools/gen-ephem.mjs` și `tools/gen-stars.mjs`.

| Componentă | Sursă | Licență | Unde apare |
|---|---|---|---|
| Serii VSOP87D (8 planete, truncate la 3735 din 31577 termeni) | P. Bretagnon & G. Francou, *A&A* 202, 309 (1988); catalog CDS VI/81; extrase din pachetul npm `astronomia` 0.x (Sonia Keys, commenthol) | date științifice libere (CDS); pachetul de ambalare: MIT (text mai jos) | `src/ephem.js` (`VS`) |
| Tabele Luna 47.A/47.B, nutație 22.A, Pluto 37 | J. Meeus, *Astronomical Algorithms*, ed. 2 (coeficienți numerici); transcriere din `astronomia` (MIT) | MIT (ambalare); coeficienții sunt fapte numerice, cu citare | `src/ephem.js` (`MOON_A`, `MOON_B`, `NUT`, `PLUTO`) |
| ΔT: polinoame Espenak–Meeus (2004) | F. Espenak, J. Meeus, NASA TP-2006-214141 | public (NASA) | `src/ephem.js` (`dtPoly`) |
| ΔT 1973–2027 (tabel anual) | valori UT1−UTC și TAI−UTC publicate de IERS (Observatorul Paris / USNO), extrase prin `astropy-iers-data` | date publice IERS | `src/ephem.js` (`DT_OBS`), `tools/dt_obs.json` |
| Catalog stelar (1627 stele, V ≤ 5,0): poziții, mișcări proprii | Hipparcos, noua reducere (F. van Leeuwen 2007; ESA; CDS I/311), prin pachetul PyPI `hipparcos-catalog` (Steven Michael) | date ESA publice; ambalare MIT | `src/ephem-stars.js` |
| V, B−V, denumiri IAU/Bayer/Flamsteed, figurile constelațiilor, centre de etichetă | `d3-celestial` 0.7.x (Olaf Frohn), derivat din XHIP (CDS V/137D) și lista IAU WGSN | BSD-3-Clause (text mai jos) | `src/ephem-stars.js` |
| Denumiri românești ale constelațiilor și ale câtorva stele | autorul kitului (nomenclatură uzuală, neoficială) | MIT (ca restul kitului) | `src/ephem-stars.js` |

Instrumentele de verificare (NU sunt distribuite cu kitul, doar folosite în `test/ref/make_ephem_ref.py`): JPL DE421 și DE423 (efemeride NASA/JPL, domeniu public) ambalate de B. Rhodes (pachetele PyPI `de421`, `de423`, MIT), `jplephem` (MIT), `astropy` (BSD-3-Clause), `pyerfa`/ERFA (BSD-3-Clause), `ephem` (pyephem, MIT).

### astronomia — MIT

```
The MIT License (MIT)

Copyright (c) 2013 Sonia Keys
Copyright (c) 2016 Commenthol

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### d3-celestial — BSD-3-Clause

```
Copyright (c) 2015, Olaf Frohn
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
<!-- ephem:end -->
