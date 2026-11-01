/* registru de capabilități (prototip: 3 aplicații) — în producție vine din app.json "fff" */
var FFF_REG = [
 {slug:'academisearch',name:'AcademiSearch',url:'https://academisearch.chiuta.ro/',accepts:['citation/csl'],produces:['citation/csl']},
 {slug:'markdownatelier',name:'MarkdownAtelier',url:'https://markdownatelier.chiuta.ro/',accepts:['text/markdown','text/plain','citation/csl','note/akasha'],produces:['text/markdown']},
 {slug:'akasha',name:'Akasha',url:'https://akasha.chiuta.ro/',accepts:['note/akasha','text/markdown','text/plain','citation/csl'],produces:['note/akasha']}
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
