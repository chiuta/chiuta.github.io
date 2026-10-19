# Arbore — helyi családfakutatás

[English](README.md) · [Română](README.ro.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Español](README.es.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · **Magyar**

**Verzió:** 1.0.0 · **Utolsó frissítés:** 2026-10-14

A felület nyelvei: **Română, English, Français, Italiano, Español, Português (PT), Deutsch, Magyar**

Az Arbore egy teljes egészében a böngészőben futó családfakutató program: személyek (több név, leánykori nevek, hiányos dátumok, helyek, foglalkozások, egyéni események, jegyzetek, források, címkék, kis fényképek), családok (partnerek, kapcsolat típusa, vér szerinti/örökbe fogadott/mostoha gyermekek, házasság és válás), GEDCOM 5.5.1 import/export, SVG-diagramok (felmenők 3–7 nemzedéken át, leszármazottak, homokóra, legyező), személyi adatlap, idővonal, helyek listája, a román terminológiát használó rokonsági számoló, valamint adatminőség-ellenőrzések (duplikátumok, ellentmondások, összevonás visszavonási lehetőséggel).

![képernyőkép](screenshot.png)

**Online alkalmazás:** https://chiuta.github.io/apps/Arbore/

## Használat

1. Nyomd meg a **Példa betöltése** gombot (egy kitalált család) vagy az **Adatok és export → Import** gombot egy `.ged` / `.fff.json` fájlhoz; vagy adj hozzá személyeket a **+ Személy** gombbal.
2. **Személyek**: keresés (név, év, hely, címke), szűrők, személyi adatlap eseményekkel, szülőkkel, testvérekkel, kapcsolatokkal és gyermekekkel.
3. **Diagramok**: válaszd ki a kiinduló személyt, a típust és a nemzedékek számát. Nyilak = lépés a személyek között, Enter = újraközpontosítás, Shift+Enter = adatlap, `+`/`-`/`0` = nagyítás/illesztés; egér (húzás, görgő) és érintés (mozgatás, csippentés). Exportálás SVG/PNG formátumban, nyomtatás (több oldalon is 1:1 léptékben).
4. **Rokonság**: válassz ki két személyt; az eredmény megadja a román kifejezést, a kánoni és a polgári fokot, valamint a magyarázott útvonalat.
5. **Adatminőség**: futtasd az ellenőrzéseket, nyisd meg a személyt a jelentésből, keress duplikátumokat és vond össze a **Visszavonás** lehetőségével.
6. **Adatok és export**: opcionális jelszavas titkosítás, adatvédelmi beállítások exportáláskor, GEDCOM, JSON, CSV, nyomtatható jelentés, **Összes törlése**.

## Amit NEM tud, és korlátai

- Nem szinkronizál az eszközök között, és nincs felhőmásolata: exportálj rendszeresen.
- Az adatok a böngészőben vannak (localStorage, IndexedDB tartalékkal); a webhelyadatok törlése vagy a privát mód eltávolíthatja őket.
- GEDCOM 5.5.1 UTF-8 a mindennapi használathoz; az ANSEL/ANSI csak minimálisan, figyelmeztetéssel. A GEDCOM 7 és a ZIP/GEDZIP nem támogatott. Az ismeretlen címkék oda-vissza átalakításkor megmaradnak, de nem szerkeszthetők.
- A nem gergely-naptárak szövegként maradnak meg, és az ellenőrzésekben közelítőleg kezelődnek.
- A rokonsági kifejezések csak románul érhetők el (a felület le van fordítva, a terminológia nem); a nagyon összetett esetekre (rokonok közötti ismételt házasságok) hozzávetőleges leírás vagy a legrövidebb útvonal jelenik meg. Ez nem jogi vagy vallási tanácsadás.
- A duplikátumok csupán javaslatok; összevonás előtt ellenőrizd őket.
- Nincs térkép (a helyek csak egy lista, geokódolás nélkül).
- A fényképek opcionálisak, legfeljebb 400 px-re méretezettek, és `data:` formában tárolódnak a családfában; sok fénykép a böngésző kvótájának nagy részét elfoglalja.
- A titkosítási jelszót nem tároljuk: **elvesztett jelszó = elvesztett adatok**.

## Adatvédelem

A családi adatok érzékenyek. Az alkalmazás helyben fut, és semmit sem küld el: nincs szervere, fiókja, elemzése vagy hálózati kérése (CSP `connect-src 'none'` beállítással), és ezt a felső szalag is közli. A családfa csak a böngésződben tárolódik, opcionálisan AES-GCM 256 titkosítással, PBKDF2-SHA256-tal származtatott kulccsal (310 000 iteráció, véletlen só és IV). Az exportok (GEDCOM, JSON, CSV, jelentés) alapértelmezés szerint elfedik az élő személyeket (vagy teljesen eltávolítják őket; opcionálisan az elmúlt N évben születetteket is); az elfedés nélküli export kifejezett megerősítést igényel. Egy személy élőnek minősül, ha nincs halálozási adata, és nem született több mint 110 évvel ezelőtt, hacsak kézzel nem jelölik meg.

## Támogatott formátumok

- Import: GEDCOM 5.5.1 (`.ged`, UTF-8 BOM-mal vagy anélkül; minimális ANSI/ANSEL), `.fff.json` (titkosítva is).
- Export: GEDCOM 5.5.1 UTF-8 (`CHAR UTF-8`, ≤ 255 karakteres sorok CONC/CONT használatával), `.fff.json` (opcionálisan titkosítva), CSV (személyek, családok), nyomtatható HTML-jelentés, SVG, PNG.
- GEDCOM-címkék: INDI, FAM, NAME (GIVN/SURN/NPFX/NSFX/NICK), SEX, BIRT/DEAT/BURI/CHR/MARR/DIV/OCCU/RESI/EVEN a DATE/PLAC/NOTE/SOUR címkékkel, HUSB/WIFE/CHIL/FAMC/FAMS, SOUR/REPO, OBJE, ASSO; a többi változatlanul megmarad.
- A hibás fájlokat a lehetőségekhez mérten importáljuk, hibák és figyelmeztetések jelentésével.

## Műszaki részletek

Egyetlen `index.html` fájl, külső könyvtárak nélkül, a `file://` címről is offline működik. Szigorú CSP (`default-src 'none'`, SHA-256 hash-sel engedélyezett szkript, `unsafe-eval` nélkül, beágyazott eseménykezelők nélkül); a `style-src 'unsafe-inline'` az SVG-diagramok beágyazott stílusaihoz szükséges, az `img-src`/`worker-src` pedig `data:`/`blob:` értékkel a fényképekhez és a PNG-exporthoz. A GEDCOM-elemzés, az indexelés, az ellenőrzések és a duplikátumkeresés időszeletekben fut (a felület blokkolása nélkül); a személyek listája virtualizált (10 000 személlyel tesztelve). A rokonsági számoló megkeresi a legközelebbi közös felmenőket, levezeti a fokot (polgári = a lépcsőfokok összege, kánoni = a maximum), és román kifejezéstáblákat alkalmaz, sógorsággal, keresztszülőkkel/keresztgyerekekkel, tartalékként pedig a legrövidebb útvonallal.

Tesztek: `node tests/test.mjs` (Playwright/Chromium, letiltott hálózat): indulás/CSP, GEDCOM oda-vissza átalakítás valósághű fájlokon (ékezetes betűk, CONC/CONT, hozzávetőleges dátumok, ismeretlen címkék, hibás fájl), dátumok, rokonság, konzisztencia/duplikátumok/összevonás, élő személyek elfedése, titkosítás, 10 000 személy, diagramok/billentyűzet/export, axe, vízszintes túlcsordulás, témák.

## Harmadik felek

Nem használunk harmadik féltől származó kódot.

## Fordítások

A felület ro, en, fr, it, es, pt, hu, de nyelven érhető el. Az fr/it/es/pt/hu/de fordítások gépiek, anyanyelvi beszélők nem ellenőrizték őket.

## Licenc

MIT — lásd a `LICENSE` fájlt a tároló gyökerében.

## Előzmények

- 1.0.0 — 2026-10-14: első verzió.
