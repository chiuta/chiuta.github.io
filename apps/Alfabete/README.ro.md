# Alfabete

[English](README.md) · **Română** · [Français](README.fr.md) · [Italiano](README.it.md) · [Español](README.es.md) · [Português](README.pt.md) · [Deutsch](README.de.md) · [Magyar](README.hu.md)

**Versiune:** 1.0.1 · **Ultima actualizare:** 2026-10-19

Limbile interfeței: **Română, English, Français, Italiano, Español, Português (PT), Deutsch, Magyar**

Alfabete este o aplicație offline pentru alfabete și coduri: pentru fiecare cod ai o referință vizuală, un convertor în ambele sensuri, un antrenor cu verificare și o fișă tipăribilă. Acoperă Morse (audio cu WPM/Farnsworth, lumină, vibrații, Koch, ureche, ritm), braille latin de grad 1 (Unicode, BRF, SVG, scriere Perkins), alfabete fonetice (ITU/NATO, românesc, DIN 5009, francez), semafor, pigpen, Baudot/ITA2, ASCII/binar/hex/octal/Base64/URL/escape Unicode, cifruri clasice cu pași explicați și analiză de frecvență, provocarea zilei și carduri cu repetiție spațiată (SM-2). Completează aplicațiile Eter (Morse/Koch) și Atingere (braille).

![captură](screenshot.ro.png)

**Live:** https://chiuta.github.io/apps/Alfabete/

## Cum se folosește

Alege un panou din bara de sus, apoi o subfilă: Referință, Convertor, antrenor, Fișă tipăribilă. În convertoare scrii în oricare dintre câmpuri, iar celălalt se actualizează. La Morse poți reda sunetul, lumina sau vibrația (unde browserul permite) și exporta WAV. La braille poți descărca BRF sau SVG. „Provocarea zilei” se generează determinist din dată. Limba (ro, en, fr, it, es, pt, hu, de) și tema (automată/luminoasă/întunecată) se schimbă din antet; textul introdus se păstrează.

## Ce NU face și limite

- Braille: doar **grad 1** (literă cu literă). Gradul 2 (contracții) nu este implementat și nu este pretins. Literele românești (ă â î ș ț) nu au fost verificate față de o sursă oficială: sunt oferite profiluri selectabile (de lucru, pliere la litera de bază, personalizat), marcate ca atare. Punctuația variază între limbi.
- Alfabetul fonetic românesc, diacriticele Morse și variantele naționale nu sunt standardizate; sunt marcate „neoficial”/„variantă”. Cele ITU/NATO și semnele ITU-R M.1677-1 sunt cele standard.
- Dactilema: **fără figuri** (nu desenăm mâini aproximative); doar descrieri scurte și trimitere la surse oficiale. Descrierile ASL și sensul prosign-urilor apar în engleză în afara limbilor ro/en.
- Semaforul: tabelul a fost verificat încrucișat cu o sursă publică, dar merită verificat cu o sursă oficială; semnele pentru cifre și anulare nu sunt desenate.
- Cifrurile clasice sunt didactice, **nu oferă securitate**. Atacul asupra Cezar/Vigenère funcționează pe texte suficient de lungi, în engleză sau cu frecvențe proprii.
- Vibrațiile depind de API-ul Vibration (lipsește pe iOS/desktop); lumina rapidă poate afecta persoanele fotosensibile.

## Confidențialitate

Rulează local, nu trimite nimic nicăieri. Singurele date (setări, statistici, carduri, ciorne) stau în localStorage sub prefixul `fff.alfabete.`.

## Formate

Export/import de date: `.fff.json` (format `fff-bundle`, schema 1). Ieșiri: WAV (Morse), BRF și SVG (braille), fișe tipăribile (print/PDF).

## Tehnic

Un singur fișier `index.html`, JS și CSS inline, CSP strict cu hash, fără resurse externe. Teste: `node tests/test.mjs` (Playwright; 44 de teste: vectori cunoscuți, dus-întors pentru fiecare cod, durate Morse calculate și măsurate pe audio randat/clipire, axe 0 în ambele teme, layout la 360 și 1280 px).

## Terți

Nu folosește cod de la terți.

## Traduceri

Româna și engleza sunt scrise de mână; franceza, italiana, spaniola, portugheza, maghiara și germana sunt traduceri automate, neverificate de vorbitori nativi.

## Licență

MIT — vezi fișierul `LICENSE` din rădăcina depozitului.

## Istoric

- 1.0.0 — 2026-10-14: prima versiune
- 1.0.1 — 2026-10-19: panoul se alege doar din partea dinaintea primului „&” a adresei (#panou&from=…), ca linkurile din ETER/INDICATIV să deschidă panoul corect.
