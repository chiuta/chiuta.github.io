# Fabrica

[English](README.md) · [Română](README.ro.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Español](README.es.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · **Magyar**

**Verzió:** 1.1.0 · **Utolsó frissítés:** 2026-10-19

A felület nyelvei: **Română, English, Français, Italiano, Español, Português (PT), Deutsch, Magyar**

A Fabrica tanfolyamok és kvízek gyára: megírsz egy tanfolyamot (adatok, figyelmeztetések, szintek és leckék egyszerű Markdownban, hétféle típusú kérdések, szószedet, bizonyítéktábla, záróteszt kérdésbankkal és seed által meghatározott sorsolással), érvényesíted, és exportálod **egyetlen önálló HTML-fájlként** (opcionálisan ZIP-ként README-vel). A létrehozott fájl offline fut, és rendelkezik navigációval, helyben mentett haladással, térközökkel ismétlő gyakorlással a hibásan megválaszolt kérdésekhez, zárótesttel, kinyomtatható teljesítési tanúsítvánnyal (akkreditációs érték nélkül), világos/sötét móddal és 8 nyelvű felülettel. Tartalmaz egy teljes példát („Hogyan olvassunk élelmiszer-címkét”) és három kezdősablont.

![képernyőkép](screenshot.png)

**Online alkalmazás:** https://chiuta.github.io/apps/Fabrica/

## Használat

1. **Sablonok** (felül) → válaszd a „Rövid tanfolyam teszttel”, az „Útmutató bizonyítéktáblával”, az „Egyszerű kvíz” sablont vagy a teljes példát; vagy töltsd ki közvetlenül a **Tanfolyam** panelt.
2. **Tanfolyam**: cím, leírás, szerző, a tartalom licence, a tartalom nyelve, verzió, figyelmeztetések (sablonok: tájékoztató jellegű, nem orvosi / jogi / pénzügyi tanács), érzékeny területek, kiemelőszín, tanúsítvány, térközökkel ismétlő gyakorlás.
3. **Tartalom**: szintek és leckék (mozgatás fel/le, duplikálás, törlés); a lecke szövege Markdown-eszköztárral (címsorok, listák, félkövér/dőlt, külső és belső hivatkozások `[szöveg](lesson:id)`, táblázatok, idézetek, képek); gyakorlókérdések leckénként.
4. **Kérdéstípusok**: egyszeres választás, többszörös választás, igaz/hamis, kitöltés (`[[válasz|változat]]`), sorba rendezés (fel/le gombokkal, billentyűzettel is elérhető), párosítás, rövid válasz (elfogadott változatok; az összehasonlítás figyelmen kívül hagyja a kis- és nagybetűket, az ékezeteket és az írásjeleket). Mindegyikhez tartozik magyarázat és visszajelzés helyes/hibás válasz esetén.
5. **Szószedet** (`{gl:Kifejezés}` a leckékben) és **Bizonyítéktábla**: szinttel ellátott állítások (kontrollált vizsgálatok / megfigyeléses / hagyományos / bizonyíték nélkül), szöveges források, a leckékben `{ev:ID}` jelöli őket.
6. **Záróteszt**: küszöb, a bankból kisorsolt kérdések száma, seed (azonos érték → azonos sorsolás és sorrend), minden próbálkozásnál más sorsolás (seed + a próbálkozás sorszáma), opcionálisan a leckék kérdései is. A „Sorsolás szimulálása” megmutatja az eredményt.
7. **Érvényesítés**: üres leckék, helyes válasz nélküli kérdések, törött belső hivatkozások, túl nagy/külső/alternatív szöveg nélküli képek, hiányzó figyelmeztetések érzékeny területeken (kifejezett vagy heurisztikus), hiányzó források az állításoknál, duplikátumok stb. Az „Ugrás” a probléma helyére visz.
8. **Előnézet**: a pontosan olyan fájl, mint az exportálás után, elszigetelt keretben (sandbox), teljes szélességben vagy telefonszélességben (360 px).
9. **Exportálás**: HTML, ZIP (index.html + README.md + `.course.json` forrás), a `.course.json` forrás, `.fff.json` biztonsági mentés. **Importálás**: `.course.json`, az exportált HTML vagy ZIP (a tanfolyam ezekből visszaállítható), `.fff.json`; kérdések **CSV**-ből (oszlopok: `tip;întrebare;corect;greșit1;greșit2;greșit3;explicație`; típusok `unic, multi, adevarat-fals, completare, scurt, ordonare, potrivire`; a több változatot `|` választja el, a párokat `bal=jobb`; elválasztó `,` `;` vagy tabulátor, RFC 4180 szerinti idézőjelek).

Visszavonás/újra: a fejléc gombjai, a `Ctrl+Z` / `Ctrl+Y` (szövegmezőkön kívül) és a törlés utáni értesítés „Visszavonás” gombja.

## Amit NEM tud, és korlátai

- **Semmit sem akkreditál.** A tanúsítvány helyi tájékoztató dokumentum, akkreditációs vagy elismerési érték nélkül; a szövege ezt kimondja.
- Nem ellenőrzi a tartalom tudományos, jogi vagy orvosi helyességét: az érvényesítő a formai problémákat és (heurisztikusan, kulcsszavak alapján) a figyelmeztetés hiányát észleli; a tartalomért a felelősség a szerzőé marad. A bizonyítékszintet a szerző választja meg; a Fabrica nem ellenőrzi a forrásokat.
- Nincsenek fiókok, nincs szinkronizálás, nincs valós idejű együttműködés, nincsenek szerverek. A tanuló haladása helyi (az ő böngészőjében), és senki sem tudja ellenőrizni; a teszt nem felügyelt (a helyes válaszok a fájlban vannak).
- A Markdown egy részhalmaz (címsorok, egymásba ágyazott listák, félkövér/dőlt, kód, hivatkozások, képek, táblázatok, idézetek, vonal); nincs nyers HTML, nincsenek matematikai képletek, nincs beágyazott hang/videó. A képek csak `data:` típusúak (png/jpeg/gif/webp), beszúrásnál legfeljebb 1000 px-re méretezve; a külső hivatkozásokat offline nem ellenőrzi.
- A sorba rendezés gombokkal történik (nem húzással). A véletlen sorrend seedelt generátoron alapul, nem kriptográfiain.
- A létrehozott felület 8 nyelvű, de a tanfolyam **tartalma** csak a szerző által írt nyelven van meg. A kezdősablonok románul és angolul vannak (a többi nyelv az angol változatot kapja); a teljes példa román nyelvű.
- ZIP-tömörítés: a saját író „stored” módot használ (tömörítés nélkül); az olvasó a tömörített (deflate) ZIP-eket is elfogadja, ahol a böngésző biztosítja a `DecompressionStream`-et.
- A piszkozat a `localStorage`-ban mentődik; ha a képek meghaladják a kvótát, figyelmeztetés jelenik meg, és a tanfolyamot exportálni kell.

## Adatvédelem

Helyben fut, és **semmit sem küld el** (`connect-src 'none'`). A tanfolyam piszkozata csak ebben a böngészőben marad meg (`fff.fabrica.draft`, valamint a nyelv és a téma); a „Minden törlése” eltávolítja őket. A létrehozott fájl nem tartalmaz telemetriát; a tanuló haladása az `fff.course.<id>.*` kulcsok alatt van, és a tanfolyam „Beállítások és adatok” oldaláról exportálható/importálható/törölhető.

## Biztonság és CSP

A szerkesztő: `default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src about:; object-src 'none'; worker-src blob:; manifest-src 'none'`. Indokolt eltérések: `frame-src about:` az elszigetelt keretben megjelenő előnézethez (`srcdoc`, `sandbox="allow-scripts allow-modals"`).

A létrehozott fájl: `default-src 'none'; script-src 'sha256-<hash>'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; media-src 'none'; worker-src 'none'; manifest-src 'none'`. **Az SHA-256 hash a böngészőben számítódik** (Web Crypto, JavaScript-tartalékkal) az exportálás pillanatában, a beillesztett szkript pontos szövegéből, és a `<meta http-equiv="Content-Security-Policy">` elembe íródik; az exportálás után a Fabrica újra elemzi a fájlt, és ellenőrzi a hasht, a beágyazott eseménykezelők és a külső erőforrások hiányát. A tanfolyam adatai egy nem futtatható `application/json` blokkban vannak (a `<`, `>`, `&` karakterek escape-elve); minden szöveg megjelenítéskor escape-elődik, a hivatkozások az `https:`, a `mailto:` és a belső útvonalak közé vannak korlátozva.

## Formátumok

- `.course.json`: `{"format":"fabrica-course","schema":1,"app":"Fabrica","version":"1.0.0","saved":"…","course":{…}}` — a séma verziózott; az importálás normalizál és érvényesít (típusok, egyedi azonosítók, egyszeres választásnál egyetlen helyes opció, `data:` képek csak kép típusúak lehetnek), és elutasítja az újabb sémájú fájlokat.
- `.fff.json` (biztonsági mentés): `{"format":"fff-bundle","schema":1,"app":"fabrica","version":"1.0.0","updated":"2026-10-14","data":{"draft":{…}}}`.
- A tanuló haladása (a létrehozott fájlból): `{"format":"fff-bundle","app":"course:<id>",…,"data":{"progress":{…}}}`.
- Importálás: `.course.json`, exportált `.html`/`.zip`, `.fff.json`, `.csv` (kérdések). Exportálás: `.html`, `.zip`, `.course.json`, `.fff.json`.

## Műszaki részletek

Egyetlen `index.html` (HTML + CSS + JS beágyazva, külső könyvtárak nélkül). A tanfolyam-motor (lejátszó) egy különálló szkript az oldalban; **ugyanaz a szöveg** kerül be az exportált fájlba, és fut az előnézetben, így az előnézet megegyezik az eredménnyel. A térközökkel ismétlő gyakorlás egyszerűsített SM-2-t használ (minimális EF 1,3; intervallumok 1 nap, 6 nap, majd EF-fel szorzás; hiba esetén az intervallum visszaáll 1 napra). A teszt kiválasztása: Fisher–Yates keverés, a hash(seed + próbálkozás) értékből inicializált mulberry32 generátorral. Saját ZIP-író/-olvasó és CRC-32. Akadálymentesség: valódi feliratok és címkék, `aria-live` üzenetek, kezelt fókusz oldalváltáskor, AA kontraszt mindkét témában (a kiemelőszínek öt ellenőrzött paletta közül választhatók), `prefers-reduced-motion`, fókuszálható görgethető táblázatok. Billentyűparancsok a létrehozott tanfolyamban: `Alt+Shift+→` / `Alt+Shift+←` (következő/előző lecke).

A tesztek (`tests/test.mjs`, Playwright, blokkolt hálózat) lefedik a szerkesztőt (szerkezet visszavonással, kérdések, érvényesítő, importálás/exportálás, CSV, ZIP, képek, előnézet, axe) és a **hálózat nélkül betöltött létrehozott fájlt** (0 pageerror/CSP, Node-ban újraszámolt CSP-hash, a leckék végigjárása, minden típus pontozása, tartós haladás, ismétlés, teszt sorsolással, tanúsítvány, 8 nyelv, axe mindkét témában, 360 px).

## Harmadik felek

Nincs harmadik féltől származó kód. (A tesztek a Playwrightot és az axe-core-t használják, csak fejlesztés közben.)

## Fordítások

A szerkesztő és a létrehozott tanfolyamok felülete: román és angol, a szerző írta; **az fr, it, es, pt, hu, de automatikus fordítások, anyanyelvi beszélők nem ellenőrizték őket**. A sablonok figyelmeztetései (tájékoztató/orvosi/jogi/pénzügyi) szintén automatikus fordítások: nyilvános használat előtt jogásznak/anyanyelvi beszélőnek kellene ellenőriznie őket.

## Licenc

Licenc: MIT — lásd a `LICENSE` fájlt a tároló gyökerében.

## Előzmények

- 1.0.0 — 2026-10-14: első verzió.
- 1.1.0 — 2026-10-19: „Kvíz az Undavához (.json)” exportálás és importálás Undava-fájlokból (.json) a CSV-importgombon keresztül; csak a megfelelővel rendelkező kérdések kerülnek át (egyszeres választás, igaz/hamis, rövid válasz, egyetlen üres helyes kitöltés).
