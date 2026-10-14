/* FFF.pii — detector local de date personale (euristic + validări de sumă de control). Nimic nu părăsește browserul.
   Limite: euristicile (adrese, nume) sunt aproximative; formatele nerecunoscute nu sunt detectate. */
(function () {
  'use strict';
  var F = (window.FFF = window.FFF || {});
  function T(k, v) { return F.t ? F.t('pii', k, v) : k; }

  /* ---------- validări ---------- */
  var IBAN_LEN = { AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20 };
  function ibanValid(s) {
    s = s.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s) || IBAN_LEN[s.slice(0, 2)] !== s.length) return false;
    var r = s.slice(4) + s.slice(0, 4), rem = 0;
    for (var i = 0; i < r.length; i++) {
      var c = r.charCodeAt(i), v = c >= 65 ? c - 55 : c - 48;
      rem = (v > 9 ? rem * 100 + v : rem * 10 + v) % 97;
    }
    return rem === 1;
  }
  function luhn(d) {
    var sum = 0, alt = false;
    for (var i = d.length - 1; i >= 0; i--) { var n = d.charCodeAt(i) - 48; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
    return sum % 10 === 0;
  }
  function cardIin(d) {
    var n = d.length, p2 = +d.slice(0, 2), p3 = +d.slice(0, 3), p4 = +d.slice(0, 4);
    if (d[0] === '4') return n === 13 || n === 16 || n === 19;
    if ((p2 >= 51 && p2 <= 55) || (p4 >= 2221 && p4 <= 2720)) return n === 16;
    if (p2 === 34 || p2 === 37) return n === 15;
    if (p4 === 6011 || p2 === 65 || (p3 >= 644 && p3 <= 649)) return n >= 16 && n <= 19;
    if (p2 === 35) return n >= 16 && n <= 19;
    if (p2 === 62) return n >= 16 && n <= 19;
    if (p2 === 36 || p2 === 38 || (p3 >= 300 && p3 <= 305)) return n === 14;
    if (p2 === 50 || (p2 >= 56 && p2 <= 69)) return n >= 12 && n <= 19;
    return false;
  }
  function dim(y, m) { return m === 2 ? ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28) : [4, 6, 9, 11].indexOf(m) >= 0 ? 30 : 31; }
  function cnpValid(s, now) {
    if (!/^[1-9]\d{12}$/.test(s)) return false;
    var W = '279146358279', sum = 0, i;
    for (i = 0; i < 12; i++) sum += (+s[i]) * (+W[i]);
    var c = sum % 11; if (c === 10) c = 1;
    if (c !== +s[12]) return false;
    var S = +s[0], yy = +s.slice(1, 3), mm = +s.slice(3, 5), dd = +s.slice(5, 7), jj = +s.slice(7, 9);
    if (!((jj >= 1 && jj <= 46) || jj === 51 || jj === 52)) return false;
    if (mm < 1 || mm > 12 || dd < 1) return false;
    var cy = (now || new Date()).getFullYear(), years;
    if (S <= 2) years = [1900 + yy]; else if (S <= 4) years = [1800 + yy]; else if (S <= 6) years = [2000 + yy]; else years = [1900 + yy, 2000 + yy];
    return years.some(function (y) { return y <= cy && dd <= dim(y, mm); });
  }
  var CC2 = '20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98'.split(' ');
  var CC3 = /^(21[2-8]|22\d|23\d|24\d|25\d|26\d|29[0-1]|297|298|299|350|351|352|353|354|355|356|357|358|359|370|371|372|373|374|375|376|377|378|380|381|382|383|385|386|387|389|420|421|423|50\d|59\d|67\d|68\d|69[0-2]|850|852|853|855|856|880|886|96\d|97\d|992|993|994|995|996|998)/;
  function ccLen(d) {   // lungimea prefixului de țară sau 0
    if (d[0] === '1' || d[0] === '7') return 1;
    if (CC2.indexOf(d.slice(0, 2)) >= 0) return 2;
    if (CC3.test(d.slice(0, 3))) return 3;
    return 0;
  }
  function phoneCheck(raw) {   // -> confidență sau 0
    var plus = /^\s*(\+|00)/.test(raw), d = raw.replace(/\D/g, '');
    if (plus) {
      if (/^\s*00/.test(raw)) d = d.slice(2);
      var cl = ccLen(d); if (!cl) return 0;
      if (d.length < 8 || d.length > 15) return 0;
      if (cl === 1 && d.length !== 11) return 0;
      if (d.slice(0, 2) === '40') { var n = d.slice(2).replace(/^0/, ''); return /^[237]\d{8}$/.test(n) ? 0.92 : 0; }
      return 0.88;
    }
    if (d.length === 10 && d[0] === '0') {
      if (/^07[2-8]\d{7}$/.test(d)) return 0.9;
      if (/^0[23]\d{8}$/.test(d)) return 0.8;
    }
    return 0;
  }
  function entropy(s) { var f = {}, i, e = 0; for (i = 0; i < s.length; i++) f[s[i]] = (f[s[i]] || 0) + 1; for (var k in f) { var p = f[k] / s.length; e -= p * Math.log2(p); } return e; }
  function ipv6Valid(s) {
    if (!/^[0-9a-fA-F:.]+$/.test(s) || /:::/.test(s)) return false;
    var dbl = s.split('::'); if (dbl.length > 2) return false;
    var parts = s.replace('::', ':').split(':').filter(function (x) { return x !== ''; });
    if (!parts.every(function (p) { return /^[0-9a-fA-F]{1,4}$/.test(p); })) return false;
    if (dbl.length === 2) return parts.length <= 7;
    return parts.length === 8;
  }

  /* ---------- liste euristice ---------- */
  var TITLES = 'Dl|Dl\\.|Dna|Dna\\.|Domnul|Doamna|Domnișoara|Dr|Dr\\.|Prof|Prof\\.|Ing|Ing\\.|Conf|Lect|Mr|Mr\\.|Mrs|Mrs\\.|Ms|Ms\\.|Miss|Mme|Mme\\.|Monsieur|Madame|M\\.|Herr|Frau|Sig|Sig\\.ra|Signor|Signora|Sr|Sr\\.|Sra|Sra\\.|Señor|Señora|Senhor|Senhora|Dott|Dott\\.|Doktor|Úr|Asszony';
  var INTRO = '(?:mă numesc|ma numesc|numele meu este|numele meu e|my name is|je m[’\']appelle|je suis|mi chiamo|il mio nome è|me llamo|mi nombre es|chamo-me|o meu nome é|ich heiße|ich heisse|mein name ist|a nevem|nevem|semnat|semnează|cu stimă|cu respect|sincères salutations|cordialement|best regards|kind regards|mit freundlichen grüßen|cordiali saluti|atentamente|atenciosamente|üdvözlettel)[,:]?';
  var FIRST = {}; ('Ion Ioan Andrei Alexandru Alexandra Maria Mihai Mihaela Elena Ana Adrian Adriana Cristian Cristina Daniel Daniela Dan Florin Florina George Gabriel Gabriela Ștefan Stefan Ștefania Bogdan Răzvan Razvan Vasile Vlad Radu Marius Marian Mariana Nicolae Nicoleta Paul Pavel Sorin Sorina Silviu Simona Teodor Teodora Tudor Victor Victoria Viorel Viorica Carmen Claudia Claudiu Constantin Corina Cosmin Dumitru Eugen Emil Emilia Irina Iulia Iulian Laura Liviu Lucian Luminița Mădălina Mircea Monica Octavian Oana Ovidiu Petru Raluca Roxana Sandu Sergiu Tiberiu Valentin Valeriu Vera Zoe John James Robert Michael William David Richard Joseph Thomas Charles Mary Patricia Jennifer Linda Elizabeth Barbara Susan Sarah Karen Jean Pierre Jacques Michel Philippe Marie Sophie Camille Luc Giuseppe Giovanni Marco Luca Francesco Giulia Francesca Carlos José Juan Miguel Pablo Lucía Carmen João António Pedro Ricardo Hans Peter Klaus Jürgen Wolfgang Anna Petra László István Zoltán Gábor Katalin Éva').split(/\s+/).forEach(function (n) { FIRST[n] = 1; });
  var STOP = {}; ('Aceasta Acesta Acestea Acești Pentru Dacă Daca În La Prin Și Si Cu Din Despre Dar Când Cand Unde Cum Care Ce Cine De Pe Sub Peste După Dupa Înainte Între Intre Către Catre Ieri Azi Mâine Maine Astăzi Astazi Luni Marți Marti Miercuri Joi Vineri Sâmbătă Sambata Duminică Duminica Ianuarie Februarie Martie Aprilie Mai Iunie Iulie August Septembrie Octombrie Noiembrie Decembrie Universitatea Ministerul Centrul Institutul Societatea Compania Banca Primăria Primaria Facultatea Școala Scoala Liceul Spitalul Regatul Republica Uniunea Statele Piața Piata Strada Bulevardul Calea Aleea Casa Muzeul Biblioteca Parcul Gara Aeroportul Direcția Directia Agenția Agentia Autoritatea Comisia Consiliul Guvernul Parlamentul Curtea Tribunalul Inspectoratul Serviciul Departamentul Biroul Asociația Asociatia Fundația Fundatia Editura Revista Ziarul Hotelul Restaurantul Cafeneaua Magazinul România Romania Franța Franta Germania Italia Spania Portugalia Ungaria Bulgaria Moldova Ucraina Polonia Anglia Londra Paris Berlin Roma Madrid Lisabona Budapesta București Bucuresti Cluj Napoca Iași Iasi Timișoara Timisoara Brașov Brasov Constanța Constanta Sibiu Oradea Craiova Galați Galati Ploiești Ploiesti Europa Asia Africa America Dunărea Dunarea Carpați Carpati Crăciun Craciun Paște Paste The This That These Those There Here What When Where Why How Who Which If In On At By For With From About After Before Between Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July September October November December University Ministry Center Centre Institute Company Bank School Hospital Kingdom Republic Union States Street Avenue Road Park Museum Library Hotel Restaurant Le La Les Un Une Des Du Dans Pour Avec Sans Sur Sous Lundi Mardi Mercredi Jeudi Vendredi Samedi Dimanche Janvier Février Mars Avril Juin Juillet Août Septembre Octobre Novembre Décembre Il Lo Gli Una Per Con Tra Fra Come Lunedì Martedì Mercoledì Giovedì Venerdì Sabato Domenica Gennaio Febbraio Marzo Aprile Maggio Giugno Luglio Agosto Settembre Ottobre Novembre Dicembre El Los Las Unos Unas Por Para Con Sin Sobre Entre Lunes Martes Miércoles Jueves Viernes Sábado Domingo Enero Febrero Marzo Abril Mayo Junio Julio Agosto Septiembre Octubre Noviembre Diciembre Os As Uns Umas Com Sem Sobre Segunda Terça Quarta Quinta Sexta Sábado Domingo Janeiro Fevereiro Março Maio Junho Julho Setembro Outubro Novembro Dezembro Der Die Das Ein Eine Und Oder Mit Ohne Für Über Unter Zwischen Montag Dienstag Mittwoch Donnerstag Freitag Samstag Sonntag Januar Februar März Juni Juli Oktober Dezember A Az Egy És Vagy Hétfő Kedd Szerda Csütörtök Péntek Szombat Vasárnap Január Február Március Április Május Június Július Augusztus Szeptember Október').split(/\s+/).forEach(function (n) { STOP[n] = 1; });

  /* ---------- detectori ---------- */
  var RX = {
    email: /(?<![\p{L}\p{N}._%+\-])[\p{L}\p{N}][\p{L}\p{N}._%+\-]{0,63}@(?:[\p{L}\p{N}](?:[\p{L}\p{N}\-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}]{2,24}(?![\p{L}\p{N}@])/gu,
    phone: /(?<![\p{L}\p{N}_+.\-])(?:(?:\+|00)[ ]?\d[\d ().\-]{6,19}\d|0[2-7][\d ().\-]{7,12}\d)(?![\p{L}\p{N}_]|[.\-]\d)/gu,
    iban: /(?<![\p{L}\p{N}])[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{1,4}){3,10}(?![\p{L}\p{N}])/gu,
    digits13: /(?<![\d])[1-9]\d{12}(?![\d])/g,
    card: /(?<![\d])\d(?:[ \-]?\d){11,18}(?![\d])/g,
    ip4: /(?<![\w.\-])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\w]|\.\d|\-\d)/g,
    ip6: /(?<![\w:.])(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(?![\w:])/g,
    url: /\bhttps?:\/\/[^\s<>"'`]+/gi
  };
  var SECRETS = [
    [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_\-]{20,}/g, 0.97], [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, 0.97],
    [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, 0.97], [/\bgithub_pat_[A-Za-z0-9_]{40,}\b/g, 0.97],
    [/\bxox[abprs]-[A-Za-z0-9\-]{10,}/g, 0.96], [/\bAIza[0-9A-Za-z_\-]{35}\b/g, 0.96],
    [/\b[sr]k_(?:live|test)_[0-9A-Za-z]{16,}/g, 0.96], [/\bglpat-[0-9A-Za-z_\-]{20,}/g, 0.96],
    [/\beyJ[A-Za-z0-9_\-]{8,}\.eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}/g, 0.96],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, 0.99]
  ];
  var PH = /^(?:x+|\*+|\.{3,}|<[^>]*>|\[[^\]]*\]|your[_\-].*|example.*|changeme|change_me|password|parola|secret|token|null|undefined|none|true|false|\$\{.*\}|\{\{.*\}\}|%\w+%|xxx.*|\*{3,}.*)$/i;
  var SENSITIVE_PARAM = /^(?:token|access_token|id_token|refresh_token|api[_\-]?key|apikey|key|secret|client_secret|password|passwd|pass|pwd|sig|signature|auth|authorization|session|sessionid|session_id|sid|jwt|code|otp|reset|x-amz-signature|x-amz-credential|x-amz-security-token)$/i;

  var ADDR = [
    /\b(?:[Ss]trada|[Ss]tr\.|[Bb]ulevardul|[Bb]d\.|[Bb]-dul|[Cc]alea|[Șș]oseaua|[Șș]os\.|[Aa]leea|[Ii]ntrarea|[Pp]iața|[Ss]plaiul|[Pp]relungirea)\s+\p{Lu}[\p{L}.'\-]*(?:\s+(?:\p{Lu}|\d)[\p{L}.'\-\d]*){0,3}?,?\s*(?:nr\.?\s*)?\d{1,4}[A-Za-z]?(?:\s*,?\s*(?:bl|sc|et|ap|bloc|scara|etaj|apartament)\.?\s*[\p{L}\d]+){0,4}(?:,?\s*(?:sector(?:ul)?\s*\d|(?:jud\.?|județul)\s+\p{Lu}\p{L}+))?/gu,
    /\b\d{1,5}\s+\p{Lu}[\p{L}]+(?:\s+\p{Lu}[\p{L}]+)?\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Drive|Boulevard|Blvd|Way|Court)\b\.?/gu,
    /\b\d{1,3}(?:\s?bis)?,?\s+(?:rue|avenue|boulevard|place|chemin|impasse|allée)\s+(?:(?:de la|du|des|de l[’']|de|d[’'])\s?)?\p{Lu}[\p{L}'’\-]+(?:\s+\p{Lu}[\p{L}'’\-]+){0,2}/gu,
    /\b\p{Lu}[\p{L}\-]*[ ]?(?:[Ss]traße|[Ss]trasse|[Ss]tr\.|[Ww]eg|[Pp]latz|[Aa]llee|[Gg]asse)\s+\d{1,4}[a-z]?(?:,?\s*\d{5}\s+\p{Lu}\p{L}+)?/gu,
    /\b\p{Lu}[\p{L}\-]+\s+(?:utca|út|tér|körút|krt\.|u\.)\s+\d{1,4}(?:\/\w)?/gu,
    /\b(?:[Vv]ia|[Vv]iale|[Pp]iazza|[Cc]orso|[Vv]icolo)\s+(?:(?:d[ei]l?|della|dell[’'])\s?)?\p{Lu}[\p{L}’']+(?:\s+\p{Lu}[\p{L}’']+)?,?\s+(?:n\.?\s*)?\d{1,4}[a-z]?/gu,
    /\b(?:[Cc]alle|[Aa]venida|[Aa]vda\.|[Pp]laza|[Pp]aseo)\s+(?:(?:de|del|de la)\s)?\p{Lu}[\p{L}]+(?:\s+\p{Lu}[\p{L}]+)?,?\s+(?:n[º°o]\.?\s*)?\d{1,4}/gu,
    /\b(?:[Rr]ua|[Aa]venida|[Tt]ravessa|[Pp]raça|[Ll]argo)\s+(?:(?:d[aeo]s?|do|da)\s)?\p{Lu}[\p{L}]+(?:\s+\p{Lu}[\p{L}]+)?,?\s+(?:n[º°.]?\s*)?\d{1,4}/gu
  ];
  var POSTAL = /\b[Cc]od(?:ul)?\s+po[sșş]tal:?\s*\d{6}\b/gu;

  var PRI = { url: 11, secret: 10, email: 8, iban: 8, cnp: 8, card: 7, phone: 6, ip: 5, address: 4, name: 3 };
  var TYPES = ['email', 'phone', 'iban', 'cnp', 'card', 'ip', 'secret', 'url', 'address', 'name'];

  function each(rx, text, fn) { rx.lastIndex = 0; var m; while ((m = rx.exec(text))) { if (m[0].length === 0) { rx.lastIndex++; continue; } fn(m); } }

  function scan(text, opts) {
    opts = opts || {}; text = String(text == null ? '' : text);
    var want = opts.types ? opts.types.reduce(function (o, t) { o[t] = 1; return o; }, {}) : null, now = opts.now || new Date(), C = [];
    function add(type, start, end, conf, extra) {
      if (want && !want[type]) return;
      C.push(Object.assign({ type: type, start: start, end: end, value: text.slice(start, end), confidence: Math.round(conf * 100) / 100 }, extra || {}));
    }
    // e-mail
    each(RX.email, text, function (m) {
      if (/\.(?:png|jpe?g|gif|svg|webp|avif|css|js|mjs|json|html?|woff2?|ico)$/i.test(m[0])) return;      // logo@2x.png
      add('email', m.index, m.index + m[0].length, 0.98);
    });
    // IBAN
    each(RX.iban, text, function (m) {
      var cc = m[0].slice(0, 2), L = IBAN_LEN[cc]; if (!L) return;
      var cnt = 0, end = -1;
      for (var i = 0; i < m[0].length; i++) { if (m[0][i] !== ' ') cnt++; if (cnt === L) { end = i + 1; break; } }
      if (end < 0) return;
      if (end < m[0].length && m[0][end] !== ' ') return;                     // se continuă în același cuvânt
      var cand = m[0].slice(0, end); if (ibanValid(cand)) add('iban', m.index, m.index + end, 0.98);
    });
    // CNP
    each(RX.digits13, text, function (m) { if (cnpValid(m[0], now)) add('cnp', m.index, m.index + 13, 0.96); });
    // card
    each(RX.card, text, function (m) {
      var d = m[0].replace(/[ \-]/g, ''); if (d.length < 12 || d.length > 19) return;
      if (/[ \-]/.test(m[0]) && !/^\d{4}([ \-]\d{4}){2,3}(\d{0,3})$|^\d{4}[ \-]\d{6}[ \-]\d{5}$|^\d{4}[ \-]\d{6}[ \-]\d{4}$|^\d{4}([ \-]\d{4}){2}[ \-]\d{2}$/.test(m[0])) return;   // grupări nefirești
      if (d.length === 13 && d[0] !== '4') return;                                  // 13 cifre compacte: doar Visa (altfel EAN-13 etc.)
      if (luhn(d) && cardIin(d)) add('card', m.index, m.index + m[0].length, 0.93);
    });
    // telefon
    each(RX.phone, text, function (m) {
      var raw = m[0], c = phoneCheck(raw); if (!c) return;
      var grpz = raw.trim().split(/[ \-]/); if (grpz.length >= 3 && grpz.slice(0, -1).every(function (g) { return /^\d{4}$/.test(g); })) return;   // grupări de IBAN/card
      var s = m.index, e = s + raw.length, tail = /[\s.\-()]+$/.exec(raw); if (tail) e -= tail[0].length;
      add('phone', s, e, c);
    });
    // IP
    each(RX.ip4, text, function (m) {
      var v = m[0]; if (v === '0.0.0.0' || v === '255.255.255.255') return;
      var before = text.slice(Math.max(0, m.index - 16), m.index);
      if (/(?:version|versiunea|versiune|ver|release|build|v|rev)\.?\s*$/i.test(before)) return;
      var p = v.split('.').map(Number), priv = p[0] === 10 || p[0] === 127 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 169 && p[1] === 254);
      add('ip', m.index, m.index + v.length, priv ? 0.4 : 0.85, { version: 4, private: priv });
    });
    each(RX.ip6, text, function (m) {
      var v = m[0]; if (!ipv6Valid(v)) return;
      if (v.indexOf('::') < 0 && v.split(':').length !== 8) return;
      if (/^[\d:]+$/.test(v) && v.indexOf('::') < 0 && v.split(':').every(function (x) { return x.length <= 2; })) return;
      var loop = v === '::1' || v === '::';
      if (v === '::') return;
      add('ip', m.index, m.index + v.length, loop ? 0.3 : 0.85, { version: 6, private: loop });
    });
    // secrete
    SECRETS.forEach(function (sp) { each(sp[0], text, function (m) { add('secret', m.index, m.index + m[0].length, sp[1]); }); });
    each(/\bBearer\s+([A-Za-z0-9\-._~+\/]{20,}=*)/g, text, function (m) { var s = m.index + m[0].length - m[1].length; add('secret', s, m.index + m[0].length, 0.9); });
    each(/\b(?:api[_\-]?key|apikey|secret(?:[_\-]?key)?|client[_\-]?secret|access[_\-]?(?:key|token)|auth[_\-]?token|token|passwd|password|pwd|parola|parolă|pass)\b["']?\s*[:=]\s*["']?([^\s"'<>,;]{6,})/gi, text, function (m) {
      var v = m[1], isPw = /pass|pwd|parol/i.test(m[0].slice(0, 12)), s = m.index + m[0].length - v.length;
      if (PH.test(v)) return;
      if (!isPw && (v.length < 16 || entropy(v) < 3.0)) return;
      if (isPw && /^[\p{L}]+$/u.test(v) && v.length < 8 && !/\d/.test(v)) { add('secret', s, s + v.length, 0.55); return; }
      add('secret', s, s + v.length, isPw ? 0.8 : 0.85);
    });
    // URL cu parametri sensibili
    each(RX.url, text, function (m) {
      var u = m[0].replace(/[.,;:!?)\]]+$/, ''), why = [];
      var ui = /^https?:\/\/([^\/?#@\s]+)@/i.exec(u); if (ui && /:/.test(ui[1])) why.push('userinfo');
      var qi = u.search(/[?#]/);
      if (qi >= 0) u.slice(qi + 1).split(/[&;#?]/).forEach(function (kv) {
        var eq = kv.indexOf('='); if (eq < 1) return;
        var k = kv.slice(0, eq), v = kv.slice(eq + 1);
        try { k = decodeURIComponent(k); } catch (e) { /* */ }
        if (SENSITIVE_PARAM.test(k) && v.length >= 6 && !PH.test(v)) why.push(k);
      });
      if (why.length) add('url', m.index, m.index + u.length, 0.9, { params: why });
    });
    // adrese
    ADDR.forEach(function (rx) { each(rx, text, function (m) {
      if (/^via\s+(?:e-?mail|mail|skype|zoom|telegram|whatsapp|phone|post|sms|fax|web|app|api)\b/i.test(m[0]) && m[0][0] === 'v') return;   // „via Email 2 ori”
      add('address', m.index, m.index + m[0].length, 0.65);
    }); });
    each(POSTAL, text, function (m) { add('address', m.index, m.index + m[0].length, 0.6); });
    // nume
    if (!want || want.name) scanNames(text, add);

    // rezolvare suprapuneri: prioritate, apoi lungime
    C.sort(function (a, b) { return (PRI[b.type] - PRI[a.type]) || ((b.end - b.start) - (a.end - a.start)) || a.start - b.start; });
    var kept = [];
    C.forEach(function (c) { if (!kept.some(function (k) { return c.start < k.end && k.start < c.end; })) kept.push(c); });
    kept.sort(function (a, b) { return a.start - b.start; });
    var min = opts.minConfidence || 0;
    return kept.filter(function (k) { return k.confidence >= min; });
  }

  var NAMERX = /\p{Lu}[\p{Ll}’'\-]{1,}(?:[ ]\p{Lu}[\p{Ll}’'\-]{1,}){0,2}/gu;
  var TITLE_RX = new RegExp('^(?:' + TITLES + ')$');
  function scanNames(text, add) {
    var CAP = '\\p{Lu}[\\p{Ll}’\'\\-]+', NAME = '(' + CAP + '(?:[ ]' + CAP + '){0,2})';
    var titleRx = new RegExp('(?<![\\p{L}])(?:' + TITLES + ')\\s+' + NAME, 'gu');
    each(titleRx, text, function (m) {
      var nm = m[1], s = m.index + m[0].length - nm.length; if (nm.split(' ').every(function (w) { return STOP[w]; })) return;
      add('name', s, s + nm.length, 0.55);
    });
    var introRx = new RegExp('(?<![\\p{L}])' + INTRO + '\\s+', 'giu'), nameY = new RegExp(NAME, 'uy');
    each(introRx, text, function (m) {
      nameY.lastIndex = m.index + m[0].length; var r = nameY.exec(text); if (!r) return;
      var nm = r[1]; if (STOP[nm.split(' ')[0]]) return;
      add('name', r.index, r.index + nm.length, 0.6);
    });
    each(NAMERX, text, function (m) {
      // rupe șirul la cuvinte-stop/titluri și păstrează sub-secvențe de ≥ 2 cuvinte
      var words = [], pos = m.index; m[0].split(' ').forEach(function (w) { words.push({ w: w, s: pos }); pos += w.length + 1; });
      var run = [];
      function flush() {
        if (run.length >= 2) {
          var st = run[0].s, en = run[run.length - 1].s + run[run.length - 1].w.length;
          add('name', st, en, (FIRST[run[0].w] || FIRST[run[1].w]) ? 0.4 : 0.22);
        }
        run = [];
      }
      words.forEach(function (x) { if (STOP[x.w] || TITLE_RX.test(x.w)) flush(); else run.push(x); });
      flush();
    });
  }

  /* ---------- mascare ---------- */
  var PH_LABEL = { email: 'EMAIL', phone: 'PHONE', iban: 'IBAN', cnp: 'CNP', card: 'CARD', ip: 'IP', secret: 'SECRET', url: 'URL', address: 'ADDRESS', name: 'NAME' };
  function partial(f) {
    var v = f.value, d;
    switch (f.type) {
      case 'email': { var at = v.lastIndexOf('@'), dom = v.slice(at + 1), dot = dom.lastIndexOf('.'); return v[0] + '***@' + dom[0] + '***' + dom.slice(dot); }
      case 'phone': { var ds = v.replace(/\D/g, ''); return (/^\s*\+/.test(v) ? '+' + ds.slice(0, 2) + ' ' : '') + '*** *** *' + ds.slice(-2); }
      case 'iban': { var c = v.replace(/\s/g, ''); return c.slice(0, 4) + ' **** **** ' + c.slice(-4); }
      case 'cnp': return v[0] + '*********' + v.slice(-3);
      case 'card': d = v.replace(/\D/g, ''); return '**** **** **** ' + d.slice(-4);
      case 'ip': return f.version === 6 ? v.split(':').slice(0, 2).join(':') + ':****' : v.split('.').slice(0, 2).join('.') + '.*.*';
      case 'secret': return v.length > 8 ? v.slice(0, 4) + '…[' + (v.length - 4) + ']' : '****';
      case 'url': { var mm = /^(https?:\/\/)([^\/?#]*)/i.exec(v); var host = mm[2].replace(/^[^@]*@/, ''); return mm[1] + host + '/…[…]'; }
      case 'name': return v.split(/\s+/).map(function (w) { return w[0] + '.'; }).join(' ');
      default: return '[' + PH_LABEL[f.type] + ']';
    }
  }
  function mask(text, findings, opts) {
    opts = opts || {}; var mode = opts.mode || 'placeholder', out = text, min = opts.minConfidence || 0;
    var list = (findings || scan(text)).filter(function (f) { return f.confidence >= min; }).slice().sort(function (a, b) { return b.start - a.start; });
    list.forEach(function (f) { out = out.slice(0, f.start) + (mode === 'partial' ? partial(f) : '[' + PH_LABEL[f.type] + ']') + out.slice(f.end); });
    return out;
  }

  /* ---------- guard (dialog accesibil) ---------- */
  function css() {
    if (document.getElementById('fff-pii-style')) return;
    var s = document.createElement('style'); s.id = 'fff-pii-style';
    s.textContent = 'dialog.fff-pii{max-width:min(36rem,calc(100vw - 32px));width:100%;border:1px solid var(--fff-border,color-mix(in srgb,CanvasText 40%,transparent));border-radius:12px;padding:16px;background:var(--fff-bg,Canvas);color:var(--fff-fg,CanvasText);font:inherit}' +
      'dialog.fff-pii::backdrop{background:rgba(0,0,0,.5)}' +
      '.fff-pii h2{margin:0 0 8px;font-size:1.15em}.fff-pii p{margin:6px 0}' +
      '.fff-pii ul{list-style:none;margin:8px 0;padding:0;max-height:40vh;overflow:auto}' +
      '.fff-pii li{margin:4px 0}.fff-pii li label{display:flex;gap:10px;align-items:flex-start;min-height:44px;padding:4px 0;overflow-wrap:anywhere}' +
      '.fff-pii input[type=checkbox]{width:24px;height:24px;flex:none;margin:2px 0}' +
      '.fff-pii code{font-family:ui-monospace,monospace;background:color-mix(in srgb,CanvasText 10%,transparent);padding:0 4px;border-radius:4px}' +
      '.fff-pii-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}' +
      '.fff-pii button{font:inherit;min-height:44px;min-width:44px;padding:6px 14px;border-radius:8px;border:1px solid var(--fff-border,color-mix(in srgb,CanvasText 45%,transparent));background:var(--fff-btn,ButtonFace);color:var(--fff-btn-fg,ButtonText);cursor:pointer}' +
      '.fff-pii button[data-primary]{background:var(--fff-accent,#0b57d0);color:var(--fff-accent-fg,#fff);border-color:transparent}' +
      '@media(prefers-color-scheme:dark){.fff-pii button[data-primary]{background:var(--fff-accent,#8ab4f8);color:var(--fff-accent-fg,#101418)}}' +
      '.fff-pii :focus-visible{outline:3px solid var(--fff-focus,Highlight);outline-offset:2px}.fff-pii-note{font-size:.88em;opacity:.9}';
    document.head.appendChild(s);
  }
  function confLabel(c) { return c >= 0.85 ? T('conf_high') : c >= 0.5 ? T('conf_mid') : T('conf_low'); }
  var gid = 0;
  function dialog(text, findings, opts) {
    css();
    return new Promise(function (resolve) {
      var id = 'fff-pii-' + (++gid), prev = document.activeElement;
      var dlg = document.createElement('dialog'); dlg.className = 'fff-pii'; dlg.setAttribute('aria-labelledby', id + '-t'); dlg.setAttribute('aria-describedby', id + '-d');
      var h = document.createElement('h2'); h.id = id + '-t'; h.textContent = T('title');
      var p = document.createElement('p'); p.id = id + '-d'; p.textContent = T('intro', { n: findings.length });
      var ul = document.createElement('ul'), boxes = [];
      findings.forEach(function (f, i) {
        var li = document.createElement('li'), lb = document.createElement('label'), cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = f.confidence >= (opts.preselect == null ? 0.5 : opts.preselect); boxes.push(cb);
        var sp = document.createElement('span'), cd = document.createElement('code'); cd.textContent = partial(f);
        sp.appendChild(document.createTextNode(T('t_' + f.type) + ' · ' + confLabel(f.confidence) + ' (' + Math.round(f.confidence * 100) + '%) '));
        sp.appendChild(cd); lb.appendChild(cb); lb.appendChild(sp); li.appendChild(lb); ul.appendChild(li);
      });
      var note = document.createElement('p'); note.className = 'fff-pii-note'; note.textContent = T('note');
      var act = document.createElement('div'); act.className = 'fff-pii-actions';
      function btn(label, res, primary) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (primary) b.setAttribute('data-primary', ''); b.addEventListener('click', function () { done(res); }); act.appendChild(b); return b; }
      var done = function (res) {
        var chosen = findings.filter(function (f, i) { return boxes[i].checked; });
        dlg.close(); dlg.remove(); try { if (prev && prev.focus) prev.focus(); } catch (e) { /* */ }
        resolve({ action: res, chosen: chosen });
      };
      var bm = btn(T('mask'), 'mask', true); btn(T('continue'), 'continue'); btn(T('cancel'), 'cancel');
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); done('cancel'); });
      [h, p, ul, note, act].forEach(function (n) { dlg.appendChild(n); });
      document.body.appendChild(dlg); dlg.showModal(); bm.focus();
    });
  }
  function guard(o) {
    o = o || {};
    var api = {
      scan: function () { return scan(o.getText(), { minConfidence: o.minConfidence == null ? 0.5 : o.minConfidence, types: o.types }); },
      run: function () {
        var text = o.getText(), fs = api.scan();
        if (!fs.length) { if (o.onSend) o.onSend(text); return Promise.resolve('clean'); }
        return dialog(text, fs, o).then(function (r) {
          if (r.action === 'mask') { var m = mask(text, r.chosen, { mode: o.mode || 'placeholder' }); if (o.setText) o.setText(m); if (o.onSend) o.onSend(m); return 'masked'; }
          if (r.action === 'continue') { if (o.onSend) o.onSend(text); return 'continued'; }
          return 'cancelled';
        });
      }
    };
    api.send = api.run; api.check = api.run;
    return api;
  }

  F.pii = { scan: scan, mask: mask, guard: guard, validators: { iban: ibanValid, luhn: luhn, cnp: cnpValid, phone: phoneCheck }, types: TYPES };
})();
