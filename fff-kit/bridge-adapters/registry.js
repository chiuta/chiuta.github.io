/* registru de capabilități (generat din app.json, CNAME și importurile de fișiere ale aplicațiilor) */
var FFF_REG = [
 {"slug":"akasha","name":"Akasha","url":"https://akasha.chiuta.ro/","accepts":["note/akasha","text/markdown","text/plain","citation/csl"],"produces":["note/akasha","text/markdown"]},
 {"slug":"markdownatelier","name":"MarkdownAtelier","url":"https://markdownatelier.chiuta.ro/","accepts":["text/markdown","text/plain","citation/csl","note/akasha"],"produces":["text/markdown"]},
 {"slug":"academisearch","name":"AcademiSearch","url":"https://academisearch.chiuta.ro/","accepts":["citation/csl"],"produces":["citation/csl"]},
 {"slug":"undava","name":"Undava","url":"https://undava.chiuta.ro/","accepts":["quiz/undava","cards/qa"],"produces":[]},
 {"slug":"seva","name":"SEVA","url":"https://seva.chiuta.ro/","accepts":[],"produces":["quiz/undava"]},
 {"slug":"ai-liber","name":"AI Liber","url":"https://ai-liber.chiuta.ro/","accepts":["table/csv","text/markdown"],"produces":["table/csv","text/markdown"]},
 {"slug":"atingere","name":"ATINGERE","url":"https://atingere.chiuta.ro/","accepts":["text/markdown"],"produces":[]},
 {"slug":"arhiva-linkedin","name":"Arhivă & Galerie LinkedIn","url":"https://arhiva-linkedin.chiuta.ro/","accepts":["table/csv"],"produces":["text/markdown"]},
 {"slug":"clopotel","name":"CLOPOȚEL","url":"https://clopotel.chiuta.ro/","accepts":["table/csv"],"produces":["table/csv"]},
 {"slug":"dataweave","name":"DataWeave","url":"https://dataweave.chiuta.ro/","accepts":["table/csv"],"produces":["table/csv"]},
 {"slug":"fabrica","name":"Fabrica","url":"https://fabrica.chiuta.ro/","accepts":["table/csv"],"produces":[]},
 {"slug":"freedetect","name":"FreeDetect Hub","url":"https://freedetect.chiuta.ro/","accepts":["text/markdown"],"produces":["text/markdown"]},
 {"slug":"gospodar","name":"Gospodar","url":"https://gospodar.chiuta.ro/","accepts":["table/csv"],"produces":["table/csv"]},
 {"slug":"lexicon","name":"Lexicon","url":"https://lexicon.chiuta.ro/","accepts":["table/csv"],"produces":[]},
 {"slug":"localmind","name":"LocalMind v2.2.0","url":"https://localmind.chiuta.ro/","accepts":["table/csv","text/markdown"],"produces":["table/csv","text/markdown"]},
 {"slug":"omnihost","name":"OmniHost","url":"https://omnihost.chiuta.ro/","accepts":["table/csv"],"produces":["text/markdown"]},
 {"slug":"orar","name":"Orar","url":"https://orar.chiuta.ro/","accepts":["events/ics"],"produces":["events/ics"]},
 {"slug":"poteca","name":"Poteca","url":"https://poteca.chiuta.ro/","accepts":["geo/gpx","table/csv"],"produces":["table/csv"]},
 {"slug":"qso","name":"QSO","url":"https://qso.chiuta.ro/","accepts":["table/csv"],"produces":[]},
 {"slug":"trade-free-link-guardian","name":"Trade-Free Link Guardian","url":"https://trade-free-link-guardian.chiuta.ro/","accepts":["table/csv","text/markdown"],"produces":["table/csv"]},
 {"slug":"translatehub","name":"TranslateHub","url":"https://translatehub.chiuta.ro/","accepts":["table/csv","text/markdown"],"produces":["text/markdown"]},
 {"slug":"universul-observabil-3d","name":"Universul Observabil","url":"https://universul-observabil-3d.chiuta.ro/","accepts":["table/csv"],"produces":["table/csv"]},
 {"slug":"urme","name":"URME","url":"https://urme.chiuta.ro/","accepts":[],"produces":["geo/gpx"]},
 {"slug":"fieldobserver","name":"ASFAN","url":"https://fieldobserver.chiuta.ro/","accepts":[],"produces":["table/csv"]},
 {"slug":"eclipsa","name":"ECLIPSA","url":"https://eclipsa.chiuta.ro/","accepts":[],"produces":["events/ics"]},
 {"slug":"eclipsa-2027","name":"Eclipsa Totală de Soare","url":"https://eclipsa-2027.chiuta.ro/","accepts":[],"produces":["events/ics"]},
 {"slug":"bolta","name":"Bolta","url":"https://bolta.chiuta.ro/","accepts":[],"produces":["events/ics"]},
 {"slug":"clepsidra","name":"Clepsidra","url":"https://clepsidra.chiuta.ro/","accepts":[],"produces":["table/csv"]},
 {"slug":"decibel","name":"Decibel","url":"https://decibel.chiuta.ro/","accepts":[],"produces":["table/csv"]},
 {"slug":"generator-frecvente","name":"Laborator de Frecvențe","url":"https://generator-frecvente.chiuta.ro/","accepts":[],"produces":["table/csv"]},
 {"slug":"monstrarium","name":"MONSTRARIUM","url":"https://monstrarium.chiuta.ro/","accepts":[],"produces":["table/csv"]},
 {"slug":"surveyor","name":"SURVEYOR","url":"https://surveyor.chiuta.ro/","accepts":[],"produces":["table/csv"]},
 {"slug":"orarium","name":"ORARIUM","url":"https://orarium.chiuta.ro/","accepts":[],"produces":["events/ics"]}
];
function fffCslToMd(items){
  return items.map(function(c){
    var a=(c.author||[]).map(function(x){return x.literal||((x.family||'')+(x.given?', '+x.given:''));}).join('; ');
    var y=c.issued&&c.issued['date-parts']&&c.issued['date-parts'][0]&&c.issued['date-parts'][0][0];
    var s='- '+(a?a+' ':'')+(y?'('+y+'). ':'')+(c.title||'')+'.'+(c['container-title']?' *'+c['container-title']+'*.':'');
    if(c.DOI) s+=' https://doi.org/'+c.DOI; else if(c.URL) s+=' '+c.URL;
    return s;
  }).join('\n');
}
