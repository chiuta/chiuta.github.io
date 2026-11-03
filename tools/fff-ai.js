/* fff-ai · Nucleul AI comun FFF — UN singur strat de transport pentru conversații cu modele (Anthropic Messages, OpenAI Chat Completions și compatibile, Google generateContent).
 * Sursa canonică e ACEST fișier (tools/fff-ai.js); aplicațiile îl primesc prin `node tools/inject-shared.mjs`, nu prin copiere de mână.
 * Trei „fețe” îl folosesc: AI-Liber (furnizori liberi/cu cheie), Nexus (Anthropic/OpenAI/Google/local) și ARENA (compararea modelelor). Fiecare își păstrează interfața, sistemul de mesaje, limbile
 * și textele de eroare (le transmite prin cârlige: `httpError`, `redact`, `checkKey`, `blocked`); nucleul face doar ce era identic în toate: construirea cererii, SSE, extragerea textului, anulare, `touch`.
 * Cheile NU se păstrează aici: vin din seiful aplicației (KeyVault / seiful comun FFFSeif) prin `apiKey`, la fiecare apel. Fără dependențe, fără stocare. Rulează și în Node (module.exports). */
(function (root, factory) {
  var A = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = A;
  if (root) { try { var F = root.FFF || {}; root.FFF = F; if (root.FFF === F) F.ai = A; } catch (e) { /* inert */ } }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var KINDS = ['anthropic', 'openai', 'google'];
  var DEFAULT_URL = { anthropic: 'https://api.anthropic.com/v1/messages', openai: 'https://api.openai.com/v1/chat/completions' };
  var GOOGLE_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

  function AIError(code, msg, status) { var e = new Error(msg); e.name = 'AIError'; e.code = code; if (status != null) e.status = status; return e; }
  function codeFor(status) { return status === 401 || status === 403 ? 'auth' : status === 404 ? 'model' : status === 429 ? 'rate' : status >= 500 ? 'server' : status === 400 || status === 422 ? 'request' : 'http'; }
  /** Elimină cheia dintr-un text (mesaje de eroare). */
  function redact(msg, key) { msg = String(msg == null ? '' : msg); return key && key.length > 6 ? msg.split(key).join('[cheie]') : msg; }
  /** Cheile cu spații/diacritice fac fetch() să arunce un TypeError obscur: le refuzăm înainte. */
  function checkKey(key) { if (key && !/^[\x21-\x7E]+$/.test(key)) throw AIError('badkey', 'Cheia conține caractere nepermise în antete (spații, diacritice).'); }

  function msgs(o) { return (o.messages || []).map(function (m) { return { role: m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'), content: String(m.content == null ? '' : m.content) }; }); }
  /** Construiește cererea: întoarce {url, init} (fără rețea). */
  function build(kind, o) {
    if (KINDS.indexOf(kind) < 0) throw AIError('kind', 'tip necunoscut: ' + kind);
    var m = msgs(o), stream = o.stream !== false && kind !== 'google', h = { 'Content-Type': 'application/json' }, body, url;
    if (o.apiKey) checkKey(o.apiKey);
    if (kind === 'anthropic') {
      url = o.url || DEFAULT_URL.anthropic;
      if (o.apiKey) h['x-api-key'] = o.apiKey; if (!o.version) throw AIError('version', 'anthropic: aplicația trebuie să indice versiunea API (o.version)'); h['anthropic-version'] = o.version; h['anthropic-dangerous-direct-browser-access'] = 'true';   // necesar pentru apeluri directe din browser
      var sys = [o.system].concat(m.filter(function (x) { return x.role === 'system'; }).map(function (x) { return x.content; })).filter(Boolean).join('\n\n');
      body = { model: o.model, messages: m.filter(function (x) { return x.role !== 'system'; }), max_tokens: o.maxTokens || 4096, stream: stream }; if (sys) body.system = sys;
    } else if (kind === 'openai') {
      url = o.url || DEFAULT_URL.openai; if (o.apiKey) h.Authorization = 'Bearer ' + o.apiKey;
      var all = (o.system ? [{ role: 'system', content: o.system }] : []).concat(m);
      body = { model: o.model, messages: all, stream: stream }; if (o.maxTokens) body.max_tokens = o.maxTokens; if (o.temperature != null) body.temperature = o.temperature;
    } else {
      url = o.url || (GOOGLE_BASE + encodeURIComponent(o.model) + ':generateContent'); if (o.apiKey) h['x-goog-api-key'] = o.apiKey;   // cheia în antet, nu în URL (URL-urile ajung în istoric/loguri)
      var sy = [o.system].concat(m.filter(function (x) { return x.role === 'system'; }).map(function (x) { return x.content; })).filter(Boolean).join('\n\n');
      body = { contents: m.filter(function (x) { return x.role !== 'system'; }).map(function (x) { return { role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content }] }; }) };
      if (sy) body.systemInstruction = { parts: [{ text: sy }] };
      var gc = {}; if (o.temperature != null) gc.temperature = o.temperature; if (o.maxTokens) gc.maxOutputTokens = o.maxTokens; if (Object.keys(gc).length) body.generationConfig = gc;
    }
    for (var k in (o.headers || {})) h[k] = o.headers[k];
    return { url: url, init: { method: 'POST', headers: h, body: JSON.stringify(body), signal: o.signal, credentials: o.credentials } };
  }
  /** Text dintr-un eveniment SSE deja parsat; aruncă la eveniment de eroare. */
  function deltaOf(kind, evt, o) {
    if (!evt || typeof evt !== 'object') return null;
    var lim = function (s) { return String(s).slice(0, o.errLimit || 200); }, rd = o.redact || redact;
    if (kind === 'openai') {
      if (evt.error) throw AIError('stream', (o.errPrefix || '') + lim(rd(evt.error.message || o.streamErrDefault || JSON.stringify(evt.error), o.apiKey)));
      var c = evt.choices && evt.choices[0] && evt.choices[0].delta && evt.choices[0].delta.content; return typeof c === 'string' && c ? c : null;
    }
    if (kind === 'anthropic') {
      if (evt.type === 'error') throw AIError('stream', (o.errPrefix || '') + lim(rd((evt.error && (evt.error.message || evt.error.type)) || o.streamErrDefault || 'stream error', o.apiKey)));
      return evt.type === 'content_block_delta' && evt.delta && typeof evt.delta.text === 'string' && evt.delta.text ? evt.delta.text : null;
    }
    return null;
  }
  /** Generator asincron de evenimente SSE (obiecte JSON) dintr-un Response: linii `data:`, `[DONE]` încheie, JSON stricat se ignoră. */
  async function* sse(resp, o) {
    o = o || {}; var rd = resp.body.getReader(), dec = new TextDecoder(), buf = '';
    try {
      for (;;) {
        if (o.signal && o.signal.aborted && o.silentAbort) return;
        var r = await rd.read(); if (r.done) break; if (o.touch) o.touch();
        buf += dec.decode(r.value, { stream: true }); var i;
        while ((i = buf.indexOf('\n')) >= 0) { var ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); var ev = line(ln); if (ev === DONE) return; if (ev !== undefined) yield ev; }
      }
      buf += dec.decode(); var last = line(buf.trim()); if (last !== undefined && last !== DONE) yield last;
    } finally { try { rd.cancel().catch(function () { /* */ }); } catch (e) { /* */ } }
  }
  var DONE = {};
  function line(ln) {
    if (ln.indexOf('data:') !== 0) return undefined; var d = ln.slice(5).trim(); if (d === '[DONE]') return DONE; if (!d) return undefined;
    try { return JSON.parse(d); } catch (e) { return undefined; }
  }
  async function open(kind, o) {
    var req = build(kind, o), f = o.fetch || (root.fetch && root.fetch.bind(root)); if (!f) throw AIError('network', 'fără fetch');
    var resp;
    try { resp = await f(req.url, req.init); }
    catch (e) { if (o.signal && o.signal.aborted && o.silentAbort) return null; throw e; }
    if (!resp.ok) {
      if (o.httpError) throw await o.httpError(resp);
      var t = ''; try { t = (await resp.text()).slice(0, o.errLimit || 200); } catch (e) { /* */ }
      throw AIError(codeFor(resp.status), redact(resp.status + ' ' + t, o.apiKey), resp.status);
    }
    if (o.touch) o.touch();
    return resp;
  }
  /** Generator asincron de fragmente de text (delta-uri). Google (fără streaming) dă un singur fragment. */
  async function* stream(kind, o) {
    var resp = await open(kind, o); if (!resp) return;
    if (kind === 'google') {
      var data = await resp.json(), cand = data.candidates && data.candidates[0], parts = (cand && cand.content && cand.content.parts) || [], text = parts.map(function (p) { return p.text || ''; }).join('');
      if (data.error) throw AIError('stream', (o.errPrefix || '') + (o.redact || redact)(data.error.message || 'error', o.apiKey));
      if (!text && cand && cand.finishReason && cand.finishReason !== 'STOP') throw AIError('blocked', o.blocked ? o.blocked(cand.finishReason) : 'blocat: ' + cand.finishReason);
      yield text; return;
    }
    for await (var ev of sse(resp, o)) { var d = deltaOf(kind, ev, o); if (d) yield d; }
  }
  /** Variantă cu cârlige: onDelta(delta, textCumulat), touch(). Întoarce {text}. */
  async function run(kind, o) {
    var full = '';
    for await (var d of stream(kind, o)) { full += d; if (o.onDelta) o.onDelta(d, full); }
    return { text: full };
  }
  /** Aceeași întrebare către mai multe modele în paralel (fața ARENA). models = [{id, kind, ...opțiuni}]; întoarce [{id, text, error, ms}] în aceeași ordine; un model care cade nu le oprește pe celelalte. */
  function compare(models, common) {
    return Promise.all(models.map(function (m) {
      var t0 = Date.now(), o = Object.assign({}, common, m);
      return run(m.kind, o).then(function (r) { return { id: m.id, text: r.text, ms: Date.now() - t0 }; }, function (e) { return { id: m.id, error: String(e && e.message || e), code: e && e.code, ms: Date.now() - t0 }; });
    }));
  }
  return { VERSION: 1, KINDS: KINDS, AIError: AIError, build: build, sse: sse, stream: stream, run: run, compare: compare, redact: redact, checkKey: checkKey, codeFor: codeFor, deltaOf: deltaOf };
});
