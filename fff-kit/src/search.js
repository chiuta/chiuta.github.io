/* FFF.search — căutare locală lexicală „după formă și sens aproximativ”: BM25 + expansiune de termeni
   (stemming ușor, n-grame de caractere, fuzzy Damerau-Levenshtein, sinonime). FĂRĂ modele de embeddings incluse;
   useEmbeddings() acceptă doar o funcție embed(...) furnizată de utilizator. Fără rețea. */
(function () {
  'use strict';
  var F = (window.FFF = window.FFF || {});
  var LANGS = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de'];

  /* ---------- normalizare ---------- */
  var SPECIAL = { 'ß': 'ss', 'ł': 'l', 'đ': 'd', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ı': 'i', 'ð': 'd', 'þ': 'th' };
  function norm(s) {
    s = String(s == null ? '' : s).toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');     // ă â î ș ş ț ţ ő ű é ü …
    return s.replace(/[ßłđøæœıðþ]/g, function (c) { return SPECIAL[c]; });
  }
  var TOKEN = /[\p{L}\p{N}]+/gu;
  function tokenize(s) { return norm(s).match(TOKEN) || []; }

  /* ---------- stemming ușor (reguli de sufixe pe text normalizat) ---------- */
  function rules(list, min, passes) {                  // trecerile ulterioare folosesc doar sufixe ≥ 3 caractere (evită supra-tăierea)
    var L = list.map(function (x) { return typeof x === 'string' ? [x, ''] : x; }).sort(function (a, b) { return b[0].length - a[0].length; });
    return function (w) {
      for (var p = 0; p < (passes || 1); p++) {
        var hit = false;
        for (var i = 0; i < L.length; i++) {
          var s = L[i][0];
          if (p > 0 && s.length < 3) continue;
          if (w.length - s.length >= min && w.endsWith(s)) { w = w.slice(0, w.length - s.length) + L[i][1]; hit = true; break; }
        }
        if (!hit) break;
      }
      return w;
    };
  }
  var STEM = {
    ro: (function () {      // întâi flexiunea, apoi derivarea: autoturismul -> autoturism -> autotur ; autoturism -> autotur
      var infl = rules(['urilor', 'urile', 'ilor', 'elor', 'ului', 'ele', 'ile', 'uri', 'lor', 'ul', 'ea', 'ei', 'ii', 'le', 'a', 'e', 'i', 'u'], 3, 1);
      var der = rules(['atiilor', 'itatilor', 'itatile', 'atiile', 'iunile', 'iunilor', 'itati', 'itate', 'atie', 'iune', 'iuni', 'atori', 'atoare', 'ator', 'itor', 'ament', 'imente', 'ism', 'ist', 'eaza', 'esc', 'ind', 'and', 'area', 'are', 'ere', 'ire', 'ata', 'ate', 'ati', 'ita', 'ite', 'iti', 'uta', 'ute', 'uti', 'at', 'it', 'ut'], 4, 1);
      return function (w) { return der(infl(w)); };
    })(),
    en: rules([['ingly', ''], ['edly', ''], ['ations', 'ate'], ['ation', 'ate'], ['ators', 'ate'], ['ments', ''], ['ment', ''], ['ness', ''], ['ities', ''], ['ity', ''], ['ings', ''], ['ing', ''], ['ers', ''], ['er', ''], ['ies', 'y'], ['ied', 'y'], ['ed', ''], ['es', ''], ['ly', ''], ['s', '']], 3, 1),
    fr: rules([['issements', ''], ['issement', ''], ['ements', ''], ['ement', ''], ['ations', ''], ['ation', ''], ['ateurs', ''], ['ateur', ''], ['trices', ''], ['trice', ''], ['euses', ''], ['euse', ''], ['eux', ''], ['aux', 'al'], ['ites', ''], ['ite', ''], ['ees', ''], ['ee', ''], ['es', ''], ['er', ''], ['ez', ''], ['ent', ''], ['ant', ''], ['ir', ''], 's', 'x', 'e'], 3, 1),
    it: rules(['azioni', 'azione', 'amente', 'mente', 'atori', 'atore', 'abili', 'abile', 'ando', 'endo', 'are', 'ere', 'ire', 'ati', 'ato', 'ate', 'ata', 'i', 'e', 'o', 'a'], 3, 1),
    es: rules(['aciones', 'acion', 'amente', 'mente', 'adores', 'ador', 'ando', 'iendo', 'ables', 'able', 'ibles', 'ible', 'idades', 'idad', 'ar', 'er', 'ir', 'os', 'as', 'es', 'o', 'a', 's'], 3, 1),
    pt: rules([['coes', 'ca'], ['cao', 'ca'], ['oes', 'o'], ['aes', 'a'], 'acoes', 'acao', 'amente', 'mente', 'adores', 'ador', 'ando', 'endo', 'aveis', 'avel', 'idades', 'idade', 'ar', 'er', 'ir', 'os', 'as', 'es', 'o', 'a', 's'], 3, 1),
    hu: rules(['ekben', 'okban', 'akban', 'ban', 'ben', 'nak', 'nek', 'hoz', 'hez', 'bol', 'rol', 'tol', 'val', 'vel', 'ra', 're', 'ba', 'be', 'on', 'en', 'ig', 'kent', 'ert', 'nal', 'nel', 'ot', 'et', 'at', 'ok', 'ek', 'ak', 'ul', 'k', 't'], 3, 1),
    de: rules(['ungen', 'ung', 'heiten', 'heit', 'keiten', 'keit', 'lich', 'isch', 'ern', 'ens', 'en', 'er', 'es', 'em', 'e', 'n', 's'], 3, 1)
  };
  var STOP = {};
  ('ro:si in la de cu pe un o a al ai ale este sunt era au am ca sa se nu mai din pentru care ce dar sau lui ei lor acest aceasta acestei' +
   '|en:the a an of and or in on to is are was were be for with as by at from it this that these' +
   '|fr:le la les un une des de du et ou en dans sur pour par avec est sont ce cette' +
   '|it:il lo la i gli le un una di e o in su per con da che e sono questo questa' +
   '|es:el la los las un una de y o en sobre para por con es son este esta que' +
   '|pt:o a os as um uma de e ou em sobre para por com e sao este esta que' +
   '|hu:a az egy es vagy de hogy van volt meg is' +
   '|de:der die das ein eine und oder in auf zu ist sind war mit von fur den dem des').split('|').forEach(function (g) {
    var p = g.split(':'); STOP[p[0]] = p[1].split(' ').reduce(function (o, w) { o[norm(w)] = 1; return o; }, {});
  });

  /* ---------- Damerau-Levenshtein (OSA) cu prag ---------- */
  function dl(a, b, max) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    var p2 = null, p1 = new Array(lb + 1), cur = new Array(lb + 1), i, j;
    for (j = 0; j <= lb; j++) p1[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i; var rowMin = i;
      for (j = 1; j <= lb; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        var v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + cost);
        if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) v = Math.min(v, p2[j - 2] + 1);
        cur[j] = v; if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      p2 = p1; p1 = cur; cur = new Array(lb + 1);
    }
    return p1[lb];
  }
  function grams(w) { var s = ' ' + w + ' ', out = []; for (var i = 0; i + 3 <= s.length; i++) out.push(s.substr(i, 3)); return out; }

  function esc(s) { return s.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- indexul ---------- */
  function Index(o) { for (var k in o) this[k] = o[k]; this._tri = null; this._stemCache = Object.create(null); }

  function stemOf(ix, w) {
    var c = ix._stemCache[w]; if (c !== undefined) return c;
    var st = ix.stem(w); ix._stemCache[w] = st; return st;
  }

  function build(docs, opts) {
    opts = opts || {}; var t0 = Date.now();
    var lang = opts.lang && opts.lang !== 'auto' ? opts.lang : (F.lang ? F.lang() : 'ro'); if (lang !== 'none' && !STEM[lang]) lang = 'none';
    var first = docs[0] || {}, weights = opts.fields;
    if (!weights) { weights = {}; Object.keys(first).forEach(function (k) { if (k !== 'id' && typeof first[k] === 'string') weights[k] = k === 'title' ? 3 : 1; }); }
    var ix = new Index({ lang: lang, weights: weights, k1: opts.k1 || 1.2, b: opts.b == null ? 0.75 : opts.b, synonyms: null, docs: [], dl: [], terms: [], post: [], termIdx: new Map(), emb: null,
      stem: lang === 'none' ? function (w) { return w; } : STEM[lang] });
    var fields = Object.keys(weights), total = 0, td = new Map();
    docs.forEach(function (d, n) {
      var rec = { id: d.id != null ? d.id : n }; fields.forEach(function (f) { if (d[f] != null) rec[f] = String(d[f]); });
      ix.docs.push(rec); td.clear(); var len = 0;
      fields.forEach(function (f) {
        if (rec[f] == null) return; var w = weights[f];
        var toks = tokenize(rec[f]);
        for (var i = 0; i < toks.length; i++) {
          var t = toks[i]; len += w;
          var st = stemOf(ix, t); td.set(st, (td.get(st) || 0) + w);
        }
      });
      ix.dl.push(len); total += len;
      td.forEach(function (tf, st) {
        var ti = ix.termIdx.get(st);
        if (ti === undefined) { ti = ix.terms.length; ix.termIdx.set(st, ti); ix.terms.push(st); ix.post.push([]); }
        ix.post[ti].push(n, tf);
      });
    });
    ix.avgdl = docs.length ? total / docs.length : 1;
    if (opts.synonyms) ix.setSynonyms(opts.synonyms);
    ix.buildMs = Date.now() - t0;
    return ix;
  }

  var P = Index.prototype;
  P.setSynonyms = function (syn) {
    var ix = this, map = new Map();
    function link(group) {
      var stems = []; group.forEach(function (ph) { tokenize(ph).forEach(function (w) { stems.push(stemOf(ix, w)); }); });
      stems.forEach(function (a) { var s = map.get(a) || new Set(); stems.forEach(function (b) { if (b !== a) s.add(b); }); map.set(a, s); });
    }
    if (Array.isArray(syn)) syn.forEach(link);
    else Object.keys(syn).forEach(function (k) { link([k].concat(syn[k])); });
    this.synonyms = map; this._synRaw = syn; return this;
  };
  P._trigrams = function () {
    if (this._tri) return this._tri;
    var tri = new Map();
    for (var i = 0; i < this.terms.length; i++) {
      var g = grams(this.terms[i]), seen = {};
      for (var j = 0; j < g.length; j++) { if (seen[g[j]]) continue; seen[g[j]] = 1; var a = tri.get(g[j]); if (a) a.push(i); else tri.set(g[j], [i]); }
    }
    return (this._tri = tri);
  };
  P._idf = function (ti) { var df = this.post[ti].length / 2, N = this.docs.length; return Math.log(1 + (N - df + 0.5) / (df + 0.5)); };

  /* termeni candidați pentru un cuvânt de interogare: Map termIdx -> pondere */
  P._expand = function (word, o) {
    var ix = this, cand = new Map(), st = stemOf(ix, word), ti = ix.termIdx.get(st);
    function put(i, w) { if ((cand.get(i) || 0) < w) cand.set(i, w); }
    if (ti !== undefined) put(ti, 1);
    var syn = (o.synonymMap && o.synonymMap.get(st)) || (ix.synonyms && ix.synonyms.get(st));
    if (syn) syn.forEach(function (s) { var i = ix.termIdx.get(s); if (i !== undefined) put(i, 0.8); });
    if (o.fuzzy !== false || o.ngram !== false) {
      if (st.length >= 4) {
        var tri = ix._trigrams(), g = grams(st), cnt = new Map();
        for (var j = 0; j < g.length; j++) { var a = tri.get(g[j]); if (a) for (var q = 0; q < a.length; q++) cnt.set(a[q], (cnt.get(a[q]) || 0) + 1); }
        var maxd = st.length >= 9 ? 2 : 1, need = Math.max(1, Math.ceil(g.length * 0.34));
        cnt.forEach(function (c, i) {
          if (c < need || i === ti) return;
          var t = ix.terms[i];
          if (o.fuzzy !== false) {
            var d = dl(st, t, maxd);
            if (d <= maxd) { put(i, 0.7 * (1 - d / (st.length + 1))); return; }
          }
          if (o.ngram !== false && st.length >= 5 && t.length >= 5) {
            var dice = 2 * c / (g.length + grams(t).length);
            if (dice >= 0.62) put(i, 0.5 * dice);
            else if (t.length >= 6 && (t.indexOf(st) >= 0 || (st.length >= 6 && st.indexOf(t) >= 0))) put(i, 0.45);     // conținere (compuse, derivate)
          }
        });
      }
    }
    if (o.prefix && word.length >= 2) {
      var ps = word; for (var i2 = 0; i2 < ix.terms.length; i2++) if (ix.terms[i2].startsWith(ps) || ix.terms[i2].startsWith(st)) put(i2, 0.6);
    }
    if (cand.size > 40) { var arr = Array.from(cand.entries()).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 40); cand = new Map(arr); }
    return cand;
  };

  P.query = function (q, o) {
    o = o || {}; var ix = this, limit = o.limit == null ? 10 : o.limit, t0 = performance.now();
    var words = tokenize(q), sw = STOP[ix.lang] || {}, kept = words.filter(function (w) { return !sw[w]; });
    if (!kept.length) kept = words;
    if (o.synonyms) { o = Object.assign({}, o); var tmp = new Index({ stem: ix.stem, _stemCache: ix._stemCache, synonyms: null }); tmp.stem = ix.stem; Index.prototype.setSynonyms.call(tmp, o.synonyms); o.synonymMap = tmp.synonyms; }
    var seen = {}, qterms = [];
    kept.forEach(function (w) { var st = stemOf(ix, w); if (!seen[st]) { seen[st] = 1; qterms.push(w); } });
    var total = new Float64Array(ix.docs.length), matched = new Uint8Array(ix.docs.length), allTerms = new Set(), k1 = ix.k1, b = ix.b, avg = ix.avgdl;
    qterms.forEach(function (w) {
      var cand = ix._expand(w, o), best = new Map();
      cand.forEach(function (wt, ti) {
        allTerms.add(ix.terms[ti]);
        var idf = ix._idf(ti), pl = ix.post[ti];
        for (var j = 0; j < pl.length; j += 2) {
          var d = pl[j], tf = pl[j + 1], s = wt * idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * ix.dl[d] / avg));
          if ((best.get(d) || 0) < s) best.set(d, s);
        }
      });
      best.forEach(function (s, d) { total[d] += s; matched[d]++; });
    });
    var n = qterms.length, res = [];
    for (var d = 0; d < total.length; d++) {
      if (!matched[d]) continue;
      if (o.mode === 'and' && matched[d] < n) continue;
      res.push({ i: d, score: total[d] * (0.6 + 0.4 * matched[d] / n) });
    }
    res.sort(function (a, c) { return c.score - a.score || a.i - c.i; });
    var out = res.slice(0, limit).map(function (r) {
      var doc = ix.docs[r.i], hit = { id: doc.id, score: Math.round(r.score * 1000) / 1000, doc: doc };
      if (o.snippets !== false) Object.assign(hit, ix._snippet(doc, allTerms, o));
      return hit;
    });
    out.total = res.length; out.ms = Math.round((performance.now() - t0) * 100) / 100;
    return out;
  };

  P._snippet = function (doc, termSet, o) {
    var ix = this, len = o.snippetLen || 160, fieldName = o.snippetField || (doc.text != null ? 'text' : Object.keys(ix.weights).filter(function (f) { return f !== 'title'; })[0] || 'title');
    var text = doc[fieldName] || '', marks = [], m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(text))) { var w = norm(m[0]); if (termSet.has(stemOf(ix, w)) || termSet.has(w)) marks.push([m.index, m.index + m[0].length]); }
    var start = 0;
    if (marks.length && text.length > len) {
      var bestC = -1; for (var i = 0; i < marks.length; i++) { var s = Math.max(0, marks[i][0] - 30), c = 0; for (var j = i; j < marks.length && marks[j][1] <= s + len; j++) c++; if (c > bestC) { bestC = c; start = s; } }
      var sp = text.indexOf(' ', start); if (start > 0 && sp > 0 && sp - start < 20) start = sp + 1;
    }
    var end = Math.min(text.length, start + len); if (end < text.length) { var ls = text.lastIndexOf(' ', end); if (ls > start + len * 0.6) end = ls; }
    var snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : ''), off = (start > 0 ? 1 : 0) - start;
    var hl = marks.filter(function (r) { return r[0] >= start && r[1] <= end; }).map(function (r) { return [r[0] + off, r[1] + off]; });
    var open = (o.tags && o.tags[0]) || '<mark>', close = (o.tags && o.tags[1]) || '</mark>', html = '', pos = 0;
    hl.forEach(function (r) { html += esc(snippet.slice(pos, r[0])) + open + esc(snippet.slice(r[0], r[1])) + close; pos = r[1]; });
    html += esc(snippet.slice(pos));
    return { snippet: snippet, highlights: hl, html: html };
  };

  P.stats = function () {
    var p = 0; this.post.forEach(function (a) { p += a.length / 2; });
    return { docs: this.docs.length, terms: this.terms.length, postings: p, avgdl: Math.round(this.avgdl * 100) / 100, buildMs: this.buildMs, lang: this.lang, embeddings: !!this.emb };
  };

  /* ---------- serializare compactă ---------- */
  P.export = function (o) {
    o = o || {}; var out = { fmt: 'fff-search', v: 1, lang: this.lang, w: this.weights, k1: this.k1, b: this.b, n: this.docs.length, dl: this.dl, terms: this.terms, post: this.post.map(function (a) {
      var r = new Array(a.length), prev = 0; for (var i = 0; i < a.length; i += 2) { r[i] = a[i] - prev; prev = a[i]; r[i + 1] = a[i + 1]; } return r; }) };
    if (o.docs !== false) out.docs = this.docs;
    if (this._synRaw) out.syn = this._synRaw;
    return out;
  };
  P.exportString = function (o) { return JSON.stringify(this.export(o)); };
  P.exportGzip = function (o) {
    if (typeof CompressionStream === 'undefined') return Promise.reject(new Error('CompressionStream indisponibil'));
    var cs = new CompressionStream('gzip'), w = cs.writable.getWriter(); w.write(new TextEncoder().encode(this.exportString(o))); w.close();
    return new Response(cs.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  };

  function load(src, o) {
    o = o || {}; var t0 = Date.now(); var d = typeof src === 'string' ? JSON.parse(src) : src;
    if (!d || d.fmt !== 'fff-search' || d.v !== 1) throw new Error('search: format invalid');
    var lang = d.lang, docs = d.docs || o.docs;
    if (!docs || docs.length !== d.n) throw new Error('search: documentele lipsesc sau nu corespund indexului');
    var ix = new Index({ lang: lang, weights: d.w, k1: d.k1, b: d.b, docs: docs.map(function (x, n) { return Object.assign({ id: n }, x); }), dl: d.dl, terms: d.terms, termIdx: new Map(), emb: null, synonyms: null,
      stem: lang === 'none' ? function (w) { return w; } : STEM[lang] });
    ix.post = d.post.map(function (a) { var r = new Array(a.length), prev = 0; for (var i = 0; i < a.length; i += 2) { prev += a[i]; r[i] = prev; r[i + 1] = a[i + 1]; } return r; });
    for (var i = 0; i < d.terms.length; i++) ix.termIdx.set(d.terms[i], i);
    var tot = 0; for (var j = 0; j < d.dl.length; j++) tot += d.dl[j]; ix.avgdl = d.n ? tot / d.n : 1;
    if (d.syn) ix.setSynonyms(d.syn); if (o.synonyms) ix.setSynonyms(o.synonyms);
    ix.buildMs = Date.now() - t0; return ix;
  }

  /* ---------- embeddings opționale (model furnizat de utilizator) ---------- */
  function cosNorm(v) { var n = 0, i; for (i = 0; i < v.length; i++) n += v[i] * v[i]; n = Math.sqrt(n) || 1; var r = new Float32Array(v.length); for (i = 0; i < v.length; i++) r[i] = v[i] / n; return r; }
  function dot(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  /* model = { embed: async (texts[]) => number[][] , name?, vectors?: { [docId]: number[] } } */
  P.useEmbeddings = function (model) {
    if (!model || typeof model.embed !== 'function') throw new Error('search.useEmbeddings: este necesară o funcție embed(texts) furnizată de utilizator. ' + (F.t ? F.t('search', 'embed_missing') : '') + ' Fișierele de model singure nu pot fi rulate fără un runtime încărcat de tine (de ex. transformers.js sau ONNX Runtime).');
    var vec = new Map(); if (model.vectors) Object.keys(model.vectors).forEach(function (k) { vec.set(String(k), cosNorm(model.vectors[k])); });
    this.emb = { model: model, vec: vec }; return this;
  };
  P.embedAll = function (o) {
    o = o || {}; var ix = this; if (!ix.emb) return Promise.reject(new Error('useEmbeddings() nu a fost apelat'));
    var batch = o.batch || 32, todo = ix.docs.filter(function (d) { return !ix.emb.vec.has(String(d.id)); }), p = Promise.resolve(), done = 0;
    for (var i = 0; i < todo.length; i += batch) (function (chunk) {
      p = p.then(function () { return ix.emb.model.embed(chunk.map(function (d) { return Object.keys(ix.weights).map(function (f) { return d[f] || ''; }).join('. ').slice(0, o.maxChars || 1200); })); })
        .then(function (vs) { chunk.forEach(function (d, k) { ix.emb.vec.set(String(d.id), cosNorm(vs[k])); }); done += chunk.length; if (o.onProgress) o.onProgress(done, todo.length); });
    })(todo.slice(i, i + batch));
    return p.then(function () { return ix.emb.vec.size; });
  };
  P.queryAsync = function (q, o) {
    o = o || {}; var ix = this, limit = o.limit == null ? 10 : o.limit, lex = ix.query(q, Object.assign({}, o, { limit: Math.max(limit, 50) }));
    if (!ix.emb || !ix.emb.vec.size) return Promise.resolve(lex.slice(0, limit));
    var w = o.weight == null ? 0.5 : o.weight;
    return Promise.resolve(ix.emb.model.embed([q])).then(function (r) {
      var qv = cosNorm(r[0]), sims = [];
      ix.docs.forEach(function (d, i) { var v = ix.emb.vec.get(String(d.id)); if (v && v.length === qv.length) sims.push({ i: i, s: dot(qv, v) }); });
      sims.sort(function (a, c) { return c.s - a.s; });
      var score = new Map(), info = new Map(), K = 60;
      lex.forEach(function (h, rank) { var i = ix.docs.findIndex(function (d) { return d.id === h.id; }); score.set(i, (1 - w) / (K + rank + 1)); info.set(i, { lexRank: rank + 1, hit: h }); });
      sims.slice(0, Math.max(limit, 50)).forEach(function (x, rank) { score.set(x.i, (score.get(x.i) || 0) + w / (K + rank + 1)); var o2 = info.get(x.i) || {}; o2.embRank = rank + 1; o2.cos = Math.round(x.s * 1000) / 1000; info.set(x.i, o2); });
      var out = Array.from(score.entries()).sort(function (a, c) { return c[1] - a[1] || a[0] - c[0]; }).slice(0, limit).map(function (e) {
        var doc = ix.docs[e[0]], inf = info.get(e[0]), h = inf.hit || Object.assign({ id: doc.id, doc: doc }, ix._snippet(doc, new Set(), o));
        return Object.assign({}, h, { score: Math.round(e[1] * 100000) / 100000, lexRank: inf.lexRank || null, embRank: inf.embRank || null, cos: inf.cos == null ? null : inf.cos });
      });
      return out;
    });
  };

  var current = null;
  F.search = {
    index: function (docs, opts) { current = build(docs || [], opts); return current; },
    load: function (src, o) { current = load(src, o); return current; },
    query: function (q, o) { if (!current) throw new Error('search: niciun index'); return current.query(q, o); },
    queryAsync: function (q, o) { if (!current) return Promise.reject(new Error('search: niciun index')); return current.queryAsync(q, o); },
    useEmbeddings: function (m) { if (!current) throw new Error('search: niciun index'); current.useEmbeddings(m); return current; },
    current: function () { return current; },
    describe: function (res) { var n = res && res.total != null ? res.total : (res ? res.length : 0), T = function (k, v) { return F.t ? F.t('search', k, v) : k; }; return n === 0 ? T('none') : n === 1 ? T('one') : T('count', { n: n }); },
    normalize: norm, tokenize: tokenize, stem: function (w, lang) { return STEM[lang] ? STEM[lang](norm(w)) : norm(w); }, distance: dl, LANGS: LANGS
  };
})();
