// Set etichetat pentru FFF.pii, scris manual (+ exemple generate cu validatori scriși independent de modul).
// P(text, [tip, valoare]...) = text cu date personale; N(text) = text fără date personale.
export const ex = [];
const P = (text, ...labels) => ex.push({text, labels: labels.map(([type, value]) => ({type, value})), kind: 'P'});
const N = (text, note) => ex.push({text, labels: [], kind: 'N', note});

// ---- validatori independenți (BigInt, nu aceeași logică ca în modul) ----
export function ibanMake(cc, bban) { const num = (bban + cc + '00').replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55)); const chk = 98n - (BigInt(num) % 97n); return cc + String(chk).padStart(2, '0') + bban; }
export function cnpMake(s, yy, mm, dd, jj, nnn) { const d = `${s}${yy}${mm}${dd}${jj}${nnn}`; const w = [2,7,9,1,4,6,3,5,8,2,7,9]; const sum = [...d].reduce((a, c, i) => a + c * w[i], 0); let c = sum % 11; if (c === 10) c = 1; return d + c; }
export function luhnMake(prefix, len) { const body = prefix + '0'.repeat(len - prefix.length - 1); let best; for (let c = 0; c < 10; c++) { const n = body + c; let sum = 0; [...n].reverse().forEach((ch, i) => { let v = +ch; if (i % 2 === 1) { v *= 2; if (v > 9) v -= 9; } sum += v; }); if (sum % 10 === 0) best = n; } return best; }
export function luhnOk(n) { let sum = 0; [...n].reverse().forEach((ch, i) => { let v = +ch; if (i % 2 === 1) { v *= 2; if (v > 9) v -= 9; } sum += v; }); return sum % 10 === 0; }
const grp = (s, n = 4) => s.match(new RegExp('.{1,' + n + '}', 'g')).join(' ');

// ---------------- e-mail ----------------
P('Scrie la contact@firma.ro pentru detalii.', ['email', 'contact@firma.ro']);
P('Email: maria.ionescu+test@gmail.com', ['email', 'maria.ionescu+test@gmail.com']);
P('Trimite la andrei_g@uni.edu.ro, apoi confirmă.', ['email', 'andrei_g@uni.edu.ro']);
P('Reply to john.doe@example.co.uk today.', ['email', 'john.doe@example.co.uk']);
P('Contactați-ne la info@exemplu-ong.org.', ['email', 'info@exemplu-ong.org']);
P('Adresa: müller@bücher.de', ['email', 'müller@bücher.de']);
P('(secretariat@liceul-nr1.ro)', ['email', 'secretariat@liceul-nr1.ro']);
P('Écrivez à marie.dubois@orange.fr ou appelez.', ['email', 'marie.dubois@orange.fr']);
P('Contact: ion@x.ro, 0722 111 222', ['email', 'ion@x.ro'], ['phone', '0722 111 222']);
N('Urmărește-mă pe @alexio_tf pentru noutăți.');
N('Adresa user@localhost nu are domeniu public.');
N('Imaginea logo@2x.png are rezoluție dublă.');
N('Prețul este 5@3 bucăți la ofertă.');
N('Scrie-mi (la) adresa mea de serviciu.');
N('Formatul este nume@domeniu, completează-l singur.');

// ---------------- telefon ----------------
P('Sunați la 0722 123 456.', ['phone', '0722 123 456']);
P('Tel: 0744-555-666 (seara)', ['phone', '0744-555-666']);
P('Mobil +40 722 123 456 sau fix.', ['phone', '+40 722 123 456']);
P('WhatsApp: +40722123456', ['phone', '+40722123456']);
P('Din străinătate: 0040 722 123 456', ['phone', '0040 722 123 456']);
P('Secretariat 021 312 34 56, program 9-17.', ['phone', '021 312 34 56']);
P('Cluj: 0264 123 456', ['phone', '0264 123 456']);
P('Appelez le +33 1 23 45 67 89 demain.', ['phone', '+33 1 23 45 67 89']);
P('London office +44 20 7946 0958.', ['phone', '+44 20 7946 0958']);
P('US: +1 (415) 555-2671 ext. 5', ['phone', '+1 (415) 555-2671']);
P('Handy: +49 151 23456789', ['phone', '+49 151 23456789']);
P('Telefon: +36 1 234 5678', ['phone', '+36 1 234 5678']);
P('Roma +39 06 1234 5678 ufficio', ['phone', '+39 06 1234 5678']);
P('Llámame al +34 612 345 678.', ['phone', '+34 612 345 678']);
P('Ligue +351 912 345 678 hoje', ['phone', '+351 912 345 678']);
N('Comanda nr. 0723456789012 a fost expediată.');
N('Data: 2026-10-14, ora 10:30.');
N('Numărul de urgență este 112.');
N('Ședința este între 10.30 și 11.45.');
N('Versiunea 2.0.1 a fost lansată.');
N('Suma de 1.234.567,89 lei a fost plătită.');
N('ID client 07123 și cod 4482.');
N('Registrul: J40/1234/2020, CUI RO 1234567.');
N('Anul 2024 a avut 366 de zile.');
N('Greutate 0.5 grame, lungime 0.75 m.');
N('Program 07:30-08:45, pauză 12:00-13:00.');
N('Număr de serie 0045 1234 aprobat intern.');

// ---------------- IBAN ----------------
P('IBAN: RO49 AAAA 1B31 0075 9384 0000', ['iban', 'RO49 AAAA 1B31 0075 9384 0000']);
P('Cont RO49AAAA1B31007593840000 deschis la bancă.', ['iban', 'RO49AAAA1B31007593840000']);
P('IBAN DE89 3704 0044 0532 0130 00.', ['iban', 'DE89 3704 0044 0532 0130 00']);
P('Konto GB29 NWBK 6016 1331 9268 19 erhalten', ['iban', 'GB29 NWBK 6016 1331 9268 19']);
P('RIB FR14 2004 1010 0505 0001 3M02 606', ['iban', 'FR14 2004 1010 0505 0001 3M02 606']);
P('IT60 X054 2811 1010 0000 0123 456 è il conto.', ['iban', 'IT60 X054 2811 1010 0000 0123 456']);
P('Cuenta ES91 2100 0418 4502 0005 1332', ['iban', 'ES91 2100 0418 4502 0005 1332']);
P('NIB PT50 0002 0123 1234 5678 9015 4', ['iban', 'PT50 0002 0123 1234 5678 9015 4']);
P('Bankszámla HU42 1177 3016 1111 1018 0000 0000', ['iban', 'HU42 1177 3016 1111 1018 0000 0000']);
P('NL91 ABNA 0417 1643 00 is mijn rekening', ['iban', 'NL91 ABNA 0417 1643 00']);
P('CH93 0076 2011 6238 5295 7', ['iban', 'CH93 0076 2011 6238 5295 7']);
P('BG80 BNBG 9661 1020 3456 78', ['iban', 'BG80 BNBG 9661 1020 3456 78']);
P('PL61 1090 1014 0000 0712 1981 2874', ['iban', 'PL61 1090 1014 0000 0712 1981 2874']);
N('Contul RO49 AAAA 1B31 0075 9384 0001 are cifra greșită.');
N('DE89 3704 0044 0532 0130 01 nu este valid.');
N('RO49 AAAA 1B31 0075 9384 este prea scurt.');
N('XX00 1234 5678 9012 3456 este un cod fals.');
N('Referința ROMANIA2024 TEST ACCOUNT 12345.');
N('Codul comenzii AB12 CD34 EF56 GH78.');

// ---------------- CNP ----------------
P('CNP: ' + cnpMake(1, '85', '06', '12', '40', '123'), ['cnp', cnpMake(1, '85', '06', '12', '40', '123')]);
P('Cod numeric personal ' + cnpMake(2, '92', '11', '30', '22', '045'), ['cnp', cnpMake(2, '92', '11', '30', '22', '045')]);
P(cnpMake(5, '05', '02', '28', '12', '001') + ' este CNP-ul copilului.', ['cnp', cnpMake(5, '05', '02', '28', '12', '001')]);
P('Act identitate, CNP ' + cnpMake(6, '12', '07', '04', '03', '999') + ', emis în 2020.', ['cnp', cnpMake(6, '12', '07', '04', '03', '999')]);
P('Titular: CNP ' + cnpMake(1, '64', '02', '29', '46', '321'), ['cnp', cnpMake(1, '64', '02', '29', '46', '321')]);
P('CNP ' + cnpMake(2, '78', '12', '31', '51', '100'), ['cnp', cnpMake(2, '78', '12', '31', '51', '100')]);
P('(' + cnpMake(7, '01', '03', '15', '08', '555') + ')', ['cnp', cnpMake(7, '01', '03', '15', '08', '555')]);
P('Parintele: ' + cnpMake(1, '70', '05', '01', '10', '010') + ' și ' + cnpMake(2, '72', '09', '09', '10', '011'), ['cnp', cnpMake(1, '70', '05', '01', '10', '010')], ['cnp', cnpMake(2, '72', '09', '09', '10', '011')]);
for (const [i, bad] of [
  cnpMake(1, '85', '06', '12', '40', '123').slice(0, 12) + '5',     // cifră de control greșită (sau întâmplător corectă – verificat în test)
  cnpMake(1, '85', '13', '12', '40', '123'), cnpMake(1, '85', '04', '31', '40', '123'), cnpMake(2, '90', '02', '30', '40', '123'),
  cnpMake(2, '92', '11', '30', '77', '045'), cnpMake(0, '92', '11', '30', '22', '045'), cnpMake(5, '99', '02', '28', '12', '001'),
  cnpMake(1, '85', '00', '12', '40', '123'), cnpMake(1, '85', '06', '00', '40', '123'), cnpMake(1, '70', '02', '29', '10', '010')
].entries()) N(['CNP de probă: ', 'Număr: ', 'Referință ', 'ID intern ', 'Cod ', 'Serie ', 'Nr. dosar ', 'Număr comandă ', 'Cheie ', 'Cod de bare '][i] + (i === 0 ? bad.slice(0, 12) + ((+bad[12] + 3) % 10) : bad), 'CNP-lookalike invalid');
N('Numărul 12345678901234 are paisprezece cifre.');
N('ISBN 9780306406157 este o carte.');
N('EAN 5901234123457 pe ambalaj.');
N('Comanda 1000000000008 a fost livrată.');
N('Tracking 2000000000013 la curier.');

// ---------------- card ----------------
P('Card: 4111 1111 1111 1111', ['card', '4111 1111 1111 1111']);
P('Plata cu 4111111111111111 a trecut.', ['card', '4111111111111111']);
P('MC 5555 5555 5555 4444 exp 12/29', ['card', '5555 5555 5555 4444']);
P('Amex 3782 822463 10005', ['card', '3782 822463 10005']);
P('Amex 3714 496353 98431 valid', ['card', '3714 496353 98431']);
P('Discover 6011 1111 1111 1117', ['card', '6011 1111 1111 1117']);
P('Card 5105-1051-0510-5100.', ['card', '5105-1051-0510-5100']);
P('Diners 3056 9309 0259 04', ['card', '3056 9309 0259 04']);
P('Visa 4012 8888 8888 1881', ['card', '4012 8888 8888 1881']);
P('JCB 3530 1113 3330 0000', ['card', '3530 1113 3330 0000']);
N('Card 4111 1111 1111 1112 (cifră greșită).');
N('Numărul 1234 5678 9012 3456 e un exemplu.');
N('ID 9999 9999 9999 9999 intern.');
N('Comanda ' + luhnMake('1', 16) + ' livrată.', 'Luhn valid dar fără IIN');
N('Cod ' + luhnMake('9', 16) + ' de verificare.', 'Luhn valid dar fără IIN');
N('Serie ' + grp(luhnMake('8', 16)) + ' produs.', 'Luhn valid dar fără IIN');
P('Telefon-fax 0722123456 0744123456.', ['phone', '0722123456'], ['phone', '0744123456']);
N('Cod bare 4006381333931 (EAN).', 'EAN-13 începe cu 4 dar are 13 cifre Luhn?');

// ---------------- IP ----------------
P('Serverul 203.0.113.42 răspunde.', ['ip', '203.0.113.42']);
P('IP: 8.8.8.8', ['ip', '8.8.8.8']);
P('Conexiune de la 85.120.33.7:8080', ['ip', '85.120.33.7']);
P('Adresa 2001:db8::ff00:42:8329 e IPv6.', ['ip', '2001:db8::ff00:42:8329']);
P('Link-local fe80::1ff:fe23:4567:890a', ['ip', 'fe80::1ff:fe23:4567:890a']);
P('2001:0db8:85a3:0000:0000:8a2e:0370:7334', ['ip', '2001:0db8:85a3:0000:0000:8a2e:0370:7334']);
N('Router intern 192.168.1.1 (rețea locală).', 'IP privat: nu este PII');
N('Bucla locală 127.0.0.1 și ::1.', 'loopback');
N('Versiunea 1.2.3.4 a fost lansată.');
N('Adresa 999.1.1.1 nu există.');
N('Secțiunea 1.2.3 din raport.');
N('Ora 12:30:45 UTC.');
N('MAC aa:bb:cc:dd:ee:ff al plăcii.');
N('Versiune 10.0.19045.1 build.');
N('Numerotare 1.2.3.4.5 în listă.');
N('Raport 10.0.0.256 invalid.');

// ---------------- chei, token-uri ----------------
P('OPENAI=sk-proj-abcdefghijklmnopqrstuvwxyz123456', ['secret', 'sk-proj-abcdefghijklmnopqrstuvwxyz123456']);
P('AWS key '+('AKIAIO'+'SFODNN7EXAMPLE')+' în depozit.', ['secret', ('AKIAIO'+'SFODNN7EXAMPLE')]);
P('token '+('ghp_1234567890'+'abcdefghijklmnopqrstuvwxyz12')+' expus', ['secret', ('ghp_1234567890'+'abcdefghijklmnopqrstuvwxyz12')]);
P('jwt='+('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'+'.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U')+'', ['secret', ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'+'.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U')]);
P("api_key = 'f3a9c1d27b8e4a6f90b1c2d3e4f5a6b7'", ['secret', 'f3a9c1d27b8e4a6f90b1c2d3e4f5a6b7']);
P('password: Parola123!', ['secret', 'Parola123!']);
P('parola=MamaAre2Mere', ['secret', 'MamaAre2Mere']);
P('Authorization: Bearer abcdef0123456789abcdef', ['secret', 'abcdef0123456789abcdef']);
P('SLACK '+('xoxb-12345'+'6789012-abcdefghijkl')+'', ['secret', ('xoxb-12345'+'6789012-abcdefghijkl')]);
P('STRIPE '+('sk_live_4e'+'C39HqLyjWDarjtT1zdp7dc')+'', ['secret', ('sk_live_4e'+'C39HqLyjWDarjtT1zdp7dc')]);
P('-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAxample\n-----END RSA PRIVATE KEY-----', ['secret', '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAxample\n-----END RSA PRIVATE KEY-----']);
P('GOOGLE '+('AIzaSyA123456'+'7890abcdefghijklmnopqrstuv')+'', ['secret', ('AIzaSyA123456'+'7890abcdefghijklmnopqrstuv')]);
N('password: ********');
N('token: <your-token>');
N('Cheia API se obține din panoul de control.');
N('Un risk-averse investor evită riscul.');
N('api_key = YOUR_API_KEY_HERE');
N('token = abc');
N('password: password');
N('secret: changeme');
N('Parola trebuie să aibă cel puțin 8 caractere.');
N('Tokenul expiră după o oră; reînnoiește-l.');
N('sk-1 și sk-2 sunt notații din tabel.');

// ---------------- URL ----------------
P('Resetare: https://app.exemplu.ro/reset?token=9f8a7b6c5d4e3f2a', ['url', 'https://app.exemplu.ro/reset?token=9f8a7b6c5d4e3f2a']);
P('GET https://api.x.com/v1/data?api_key=ABCDEF123456&fmt=json', ['url', 'https://api.x.com/v1/data?api_key=ABCDEF123456&fmt=json']);
P('Conectare https://user:pass123@host.ro/path', ['url', 'https://user:pass123@host.ro/path']);
P('https://exemplu.ro/login?session=abc123def456&lang=ro.', ['url', 'https://exemplu.ro/login?session=abc123def456&lang=ro']);
P('Fișier: https://files.ro/d?sig=ZXhhbXBsZXNpZ25hdHVyZQ', ['url', 'https://files.ro/d?sig=ZXhhbXBsZXNpZ25hdHVyZQ']);
N('https://exemplu.ro/articol?id=42&utm_source=news');
N('https://ro.wikipedia.org/wiki/Bucure%C8%99ti');
N('https://exemplu.ro/?key=');
N('https://exemplu.ro/?page=2&sort=asc');
N('https://exemplu.ro/?code=RO');
N('Vezi https://exemplu.ro/ghid și https://exemplu.ro/contact.');

// ---------------- adrese ----------------
P('Locuiesc pe Str. Libertății nr. 12, bl. B3, sc. 2, ap. 14, sector 5.', ['address', 'Str. Libertății nr. 12, bl. B3, sc. 2, ap. 14, sector 5']);
P('Adresa: Strada Mihai Eminescu 23', ['address', 'Strada Mihai Eminescu 23']);
P('Sediul: Bd. Unirii nr. 45', ['address', 'Bd. Unirii nr. 45']);
P('Calea Victoriei 120, București', ['address', 'Calea Victoriei 120']);
P('Aleea Trandafirilor, nr. 3', ['address', 'Aleea Trandafirilor, nr. 3']);
P('Office at 123 Main Street, Springfield', ['address', '123 Main Street']);
P('J’habite au 12 rue de la Paix à Paris.', ['address', '12 rue de la Paix']);
P('Anschrift: Hauptstraße 12', ['address', 'Hauptstraße 12']);
P('Cím: Kossuth utca 5', ['address', 'Kossuth utca 5']);
P('Abito in Via Roma 12.', ['address', 'Via Roma 12']);
P('Vivo en Calle Mayor 5, Madrid', ['address', 'Calle Mayor 5']);
P('Moro na Rua Augusta 100.', ['address', 'Rua Augusta 100']);
P('Cod poștal 010101', ['address', 'Cod poștal 010101']);
N('Strada principală este aglomerată dimineața.');
N('Bulevardul era gol la ora aceea.');
N('Piața de valori a scăzut cu 3% astăzi.');
N('Strada Mare nu are asfalt.');
N('Am citit 3 pagini din carte.');
N('Calea de acces a fost închisă.');
N('Trimis via Email 2 ori, fără răspuns.', 'heuristic: „via” + cuvânt cu majusculă + număr');

// ---------------- nume (evaluate separat) ----------------
P('Domnul Ion Popescu a semnat contractul.', ['name', 'Ion Popescu']);
P('Dr. Maria Ionescu primește joi.', ['name', 'Maria Ionescu']);
P('Mă numesc Andrei Georgescu.', ['name', 'Andrei Georgescu']);
P('My name is John Smith.', ['name', 'John Smith']);
P("Je m'appelle Marie Dubois.", ['name', 'Marie Dubois']);
P('Ich heiße Hans Müller.', ['name', 'Hans Müller']);
P('Mrs. Susan Carter will attend.', ['name', 'Susan Carter']);
P('Prof. Dumitru Popa conduce comisia.', ['name', 'Dumitru Popa']);
N('Mă numesc ca el, dar nu sunt el.');
N('Domnul director a venit târziu.');
N('Universitatea Politehnica București a anunțat rezultatele.');
N('Ministerul Educației a publicat ghidul.');
N('Uniunea Europeană finanțează proiectul.');
N('Centrul Național organizează conferința.');
N('Joi, 14 Octombrie, la ora 10.');

// ---------------- proză curentă, fără PII ----------------
for (const t of [
  'Raportul are 1.234 pagini și costă 56,78 lei.', 'În 2026, 3 din 5 elevi au absolvit liceul.', 'Ședința este programată pe 14.10.2026, la ora 10:00.',
  'Cod produs: RO-2024-0099, lot 77A.', 'Suprafața construită este de 120,5 mp.', 'Temperatura a urcat la 23,5 grade.', 'Capitolul 4, secțiunea 4.2.1, pagina 87.',
  'Studiul a inclus 12.450 de participanți în 18 țări.', 'The meeting is on Monday at 3 pm in Room 204.', 'Le prix est de 1 299,00 € TTC.', 'Il treno parte alle 14:35 dal binario 7.',
  'El pedido llegará en 3 a 5 días hábiles.', 'A reunião é às 10h30 na sala 12.', 'A találkozó 2026. október 14-én lesz.', 'Der Zug fährt um 14:35 Uhr auf Gleis 7 ab.',
  'Documentul are 23 de pagini și 4 anexe.', 'Fișierul ocupă 2,4 MB și are 1920x1080 pixeli.', 'Conform art. 12 alin. (3) din Directiva 2005/36/CE.',
  'Ordinul nr. 3.456/2024 se aplică de la 1 ianuarie.', 'Scorul final a fost 3-2 după prelungiri.'
]) N(t);

// ---------------- nume fără indiciu (încredere joasă, evaluate la prag 0.2) ----------------
export const low = [];
const LP = (text, ...v) => low.push({text, labels: v.map(value => ({type: 'name', value})), kind: 'P'});
const LN = (text) => low.push({text, labels: [], kind: 'N'});
LP('Am vorbit cu Ana Ionescu ieri.', 'Ana Ionescu');
LP('Ion Popescu a venit târziu.', 'Ion Popescu');
LP('Elena Vasilescu și Radu Marin au semnat.', 'Elena Vasilescu', 'Radu Marin');
LP('Fotografia lui Mihai Eminescu e celebră.', 'Mihai Eminescu');
LP('Scrisoarea îi aparține lui Gabriel Dumitrescu.', 'Gabriel Dumitrescu');
LP('Pierre Martin a răspuns primul.', 'Pierre Martin');
LP('Ieri Maria Popa a plecat.', 'Maria Popa');
LN('Sistemul Solar are opt planete.'); LN('Marea Neagră este caldă vara.'); LN('Războiul Rece s-a încheiat.'); LN('Revoluția Franceză a schimbat Europa.');
LN('Casa Albă a dat un comunicat.'); LN('Banca Națională a decis.'); LN('Piatra Neamț este un oraș.'); LN('Muntele Athos are mănăstiri.');
LN('Ședința a început la ora zece.'); LN('Lista cu prețuri a fost actualizată.');
