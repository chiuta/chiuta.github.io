// Teste Node pentru tools/fff-ai.js (nucleul AI comun): cereri, SSE (la orice tăietură de bucăți), erori, anulare, comparare.   Rulare: node tests/ai.test.mjs
import {createRequire} from 'node:module'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url), HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AI = require(path.join(HUB, 'tools/fff-ai.js'));
let ok = 0, bad = 0; const T = async (n, f) => { try { await f(); ok++; console.log('ok   ' + n); } catch (e) { bad++; console.log('FAIL ' + n + '\n       ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n       ')); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' așteptat ' + JSON.stringify(b) + ', obținut ' + JSON.stringify(a)); };
const yes = (c, m) => { if (!c) throw new Error(m); };
const enc = new TextEncoder();
const body = (chunks) => new ReadableStream({start(c) { chunks.forEach((x) => c.enqueue(typeof x === 'string' ? enc.encode(x) : x)); c.close(); }});
const resp = (chunks, init) => new Response(body(chunks), Object.assign({status: 200}, init));
const split = (s, k) => { const b = enc.encode(s), out = []; for (let i = 0; i < b.length; i += k) out.push(b.slice(i, i + k)); return out; };
const oaiSSE = (words) => words.map((w) => `data: ${JSON.stringify({choices: [{delta: {content: w}}]})}\n\n`).join('') + 'data: [DONE]\n\n';
const antSSE = (words) => `event: message_start\ndata: {"type":"message_start"}\n\n` + words.map((w) => `event: content_block_delta\ndata: ${JSON.stringify({type: 'content_block_delta', index: 0, delta: {type: 'text_delta', text: w}})}\n\n`).join('') + 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
const rec = (r) => { const calls = []; const f = async (url, init) => { calls.push({url, init, body: init.body ? JSON.parse(init.body) : null}); return typeof r === 'function' ? r(url, init, calls.length) : r; }; f.calls = calls; return f; };

await T('build openai: URL implicit, antet Bearer, system primul, stream implicit, fără max_tokens/temperature dacă lipsesc', async () => {
  const r = AI.build('openai', {model: 'gpt-x', apiKey: 'sk-abc', system: 'Fii scurt', messages: [{role: 'user', content: 'Salut'}, {role: 'assistant', content: 'Bună'}]});
  eq(r.url, 'https://api.openai.com/v1/chat/completions'); eq(r.init.headers.Authorization, 'Bearer sk-abc'); const b = JSON.parse(r.init.body);
  eq(b.messages, [{role: 'system', content: 'Fii scurt'}, {role: 'user', content: 'Salut'}, {role: 'assistant', content: 'Bună'}]); eq(b.stream, true); yes(!('max_tokens' in b) && !('temperature' in b), 'implicite absente');
  const c = JSON.parse(AI.build('openai', {model: 'm', messages: [], maxTokens: 2000, temperature: 0, url: 'http://localhost:1234/v1/chat/completions', headers: {'X-Title': 'T'}}).init.body); eq([c.max_tokens, c.temperature], [2000, 0]);
  const d = AI.build('openai', {model: 'm', messages: [], url: 'http://localhost:1234/v1/chat/completions', headers: {'X-Title': 'T'}}); eq(d.url, 'http://localhost:1234/v1/chat/completions'); eq(d.init.headers['X-Title'], 'T'); yes(!d.init.headers.Authorization, 'fără cheie → fără Authorization (local)');
});
await T('build anthropic: antete obligatorii pentru browser, versiune configurabilă, system separat, max_tokens implicit 4096, rolurile curățate', async () => {
  const r = AI.build('anthropic', {model: 'claude-x', apiKey: 'k-1', version: '2026-10-21', system: 'S', messages: [{role: 'system', content: 'extra'}, {role: 'user', content: 'q'}, {role: 'weird', content: 'z'}]});
  eq(r.url, 'https://api.anthropic.com/v1/messages'); eq(r.init.headers['x-api-key'], 'k-1'); eq(r.init.headers['anthropic-version'], '2026-10-21'); eq(r.init.headers['anthropic-dangerous-direct-browser-access'], 'true');
  const b = JSON.parse(r.init.body); eq(b.system, 'S\n\nextra'); eq(b.messages, [{role: 'user', content: 'q'}, {role: 'user', content: 'z'}]); eq(b.max_tokens, 4096); eq(b.stream, true); yes(!('temperature' in b), 'fără temperature (API-ul îl respinge)');
  let v = null; try { AI.build('anthropic', {model: 'm', messages: []}); } catch (e) { v = e.code; } eq(v, 'version', 'versiunea API e obligatorie: o fixează aplicația');
});
await T('build google: cheia în antet (nu în URL), roluri user/model, systemInstruction, generationConfig doar dacă e cerut, fără streaming', async () => {
  const r = AI.build('google', {model: 'gemini 2/x', apiKey: 'G-key', system: 'S', temperature: 0.3, maxTokens: 100, messages: [{role: 'user', content: 'a'}, {role: 'assistant', content: 'b'}]});
  yes(r.url === 'https://generativelanguage.googleapis.com/v1beta/models/gemini%202%2Fx:generateContent' && !r.url.includes('G-key'), r.url); eq(r.init.headers['x-goog-api-key'], 'G-key');
  const b = JSON.parse(r.init.body); eq(b.contents.map((c) => c.role), ['user', 'model']); eq(b.systemInstruction.parts[0].text, 'S'); eq(b.generationConfig, {temperature: 0.3, maxOutputTokens: 100}); yes(!('stream' in b), 'google fără stream');
  yes(!('generationConfig' in JSON.parse(AI.build('google', {model: 'm', messages: []}).init.body)), 'fără config');
});
await T('chei: caractere nepermise respinse înainte de rețea (badkey); redact scoate cheia din mesaje', async () => {
  let c = null; try { AI.build('openai', {model: 'm', apiKey: 'cheie cu spații', messages: []}); } catch (e) { c = e.code; } eq(c, 'badkey');
  eq(AI.redact('Invalid key sk-SECRET123 here', 'sk-SECRET123'), 'Invalid key [cheie] here'); eq(AI.redact('x', 'ab'), 'x', 'chei prea scurte nu se caută');
  let k = null; try { AI.build('nope', {}); } catch (e) { k = e.code; } eq(k, 'kind');
});
await T('SSE openai: același text la orice tăietură a fluxului (octet cu octet, 2, 3, 7, 64), cu diacritice multi-octet și CRLF', async () => {
  const words = ['Salut', ', ', 'lume ', 'ț', 'ă', ' ș', 'i ', '😀', '!']; const full = words.join('');
  for (const k of [1, 2, 3, 7, 64, 100000]) { const f = rec(() => resp(split(oaiSSE(words).replace(/\n\n/g, '\r\n\r\n'), k))); const r = await AI.run('openai', {model: 'm', messages: [], fetch: f}); eq(r.text, full, 'k=' + k); }
});
await T('SSE anthropic: text_delta asamblat; event/ping ignorate; JSON stricat ignorat; eveniment error → AIError(stream) cu mesaj redactat', async () => {
  const words = ['Bună ', 'ziua']; const f = rec(() => resp(split(': ping\n\n' + antSSE(words) + 'data: {stricat\n\n', 5))); eq((await AI.run('anthropic', {model: 'm', version: 'v', messages: [], fetch: f})).text, 'Bună ziua');
  const f2 = rec(() => resp([antSSE(['ab']) + `event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"cheia sk-ZZZ9999 e greșită"}}\n\n`]));
  let e = null; const got = []; try { await AI.run('anthropic', {model: 'm', version: 'v', apiKey: 'sk-ZZZ9999', messages: [], fetch: f2, onDelta: (d) => got.push(d)}); } catch (x) { e = x; } yes(e && e.code === 'stream' && !e.message.includes('sk-ZZZ9999') && e.message.includes('[cheie]'), String(e && e.message)); eq(got, ['ab'], 'ce a venit înainte de eroare s-a livrat');
});
await T('SSE openai: eveniment error în flux → AIError; fără [DONE] la sfârșit tot se încheie; linia finală fără \\n se procesează', async () => {
  const f = rec(() => resp([`data: ${JSON.stringify({error: {message: 'limită'}})}\n\n`])); let e = null; try { await AI.run('openai', {model: 'm', messages: [], fetch: f}); } catch (x) { e = x; } eq(e.code, 'stream'); yes(/limită/.test(e.message), e.message);
  eq((await AI.run('openai', {model: 'm', messages: [], fetch: rec(() => resp([`data: ${JSON.stringify({choices: [{delta: {content: 'fără final'}}]})}`]))})).text, 'fără final');
});
await T('onDelta primește (delta, cumulat); touch la răspuns și la fiecare bucată', async () => {
  const seen = []; let touches = 0; await AI.run('openai', {model: 'm', messages: [], fetch: rec(() => resp(split(oaiSSE(['a', 'b', 'c']), 40))), onDelta: (d, full) => seen.push([d, full]), touch: () => touches++});
  eq(seen, [['a', 'a'], ['b', 'ab'], ['c', 'abc']]); yes(touches >= 3, 'touch ' + touches);
});
await T('erori HTTP: cod din status, mesaj cu corpul tăiat și redactat; cârlig httpError al aplicației are prioritate (textele ei)', async () => {
  const f401 = rec(() => new Response('{"error":"bad key sk-LEAK0001"}', {status: 401})); let e = null; try { await AI.run('openai', {model: 'm', apiKey: 'sk-LEAK0001', messages: [], fetch: f401}); } catch (x) { e = x; }
  eq([e.code, e.status], ['auth', 401]); yes(!e.message.includes('sk-LEAK0001'), 'redactat');
  for (const [s, c] of [[404, 'model'], [429, 'rate'], [503, 'server'], [400, 'request'], [418, 'http']]) eq(AI.codeFor(s), c);
  const f404 = rec(() => new Response('{}', {status: 404})); let m = null; try { await AI.run('anthropic', {model: 'm', version: 'v', messages: [], fetch: f404, httpError: async (r) => new Error('Model ' + r.status + ' — verifică modelul')}); } catch (x) { m = x.message; } eq(m, 'Model 404 — verifică modelul');
  const long = rec(() => new Response('x'.repeat(5000), {status: 500})); let l = null; try { await AI.run('openai', {model: 'm', messages: [], fetch: long}); } catch (x) { l = x.message; } yes(l.length < 260, 'mesaj tăiat: ' + l.length);
});
await T('anulare: AbortController oprește fluxul (AbortError); cu silentAbort generatorul se încheie fără eroare (stil ARENA)', async () => {
  const mk = () => new ReadableStream({start(c) { c.enqueue(enc.encode(oaiSSE(['a']).replace('data: [DONE]\n\n', ''))); }, pull() { return new Promise(() => {}); }});
  const ac = new AbortController(); const f = rec(() => new Response(mk(), {status: 200})); const out = []; const it = AI.stream('openai', {model: 'm', messages: [], fetch: f, signal: ac.signal, silentAbort: true});
  for await (const d of it) { out.push(d); ac.abort(); break; } eq(out, ['a']);
  const ac2 = new AbortController(); ac2.abort(); const f2 = async (u, init) => { if (init.signal.aborted) { const e = new Error('abort'); e.name = 'AbortError'; throw e; } };
  let n = null; try { await AI.run('openai', {model: 'm', messages: [], fetch: f2, signal: ac2.signal}); } catch (x) { n = x.name; } eq(n, 'AbortError'); const quiet = []; for await (const d of AI.stream('openai', {model: 'm', messages: [], fetch: f2, signal: ac2.signal, silentAbort: true})) quiet.push(d); eq(quiet, []);
});
await T('google: text din părți, blocat (finishReason) → AIError(blocked) cu textul aplicației, eroare în corp, cheie în antet', async () => {
  const f = rec(() => new Response(JSON.stringify({candidates: [{content: {parts: [{text: 'Un '}, {text: 'răspuns'}]}, finishReason: 'STOP'}]}), {status: 200})); const out = []; const r = await AI.run('google', {model: 'g', apiKey: 'AIza1234', messages: [{role: 'user', content: 'q'}], fetch: f, onDelta: (d) => out.push(d)});
  eq(r.text, 'Un răspuns'); eq(out, ['Un răspuns'], 'o singură livrare (fără streaming)'); yes(!f.calls[0].url.includes('AIza1234') && f.calls[0].init.headers['x-goog-api-key'] === 'AIza1234', 'cheie în antet');
  const fb = rec(() => new Response(JSON.stringify({candidates: [{finishReason: 'SAFETY'}]}), {status: 200})); let e = null; try { await AI.run('google', {model: 'g', messages: [], fetch: fb, blocked: (r) => 'Blocat de Google: ' + r}); } catch (x) { e = x; } eq([e.code, e.message], ['blocked', 'Blocat de Google: SAFETY']);
  const fe = rec(() => new Response(JSON.stringify({error: {message: 'quota'}}), {status: 200})); let q = null; try { await AI.run('google', {model: 'g', messages: [], fetch: fe}); } catch (x) { q = x; } eq(q.code, 'stream');
});
await T('compare: paralel, ordinea păstrată, un model căzut nu le oprește pe celelalte, timpul măsurat', async () => {
  const f = rec((url) => url.includes('bad') ? new Response('nu', {status: 500}) : resp(split(oaiSSE(['Răspuns ', url.includes('slow') ? 'lent' : 'rapid']), 9)));
  const r = await AI.compare([{id: 'A', kind: 'openai', model: 'a', url: 'http://x/ok/chat'}, {id: 'B', kind: 'openai', model: 'b', url: 'http://x/bad/chat'}, {id: 'C', kind: 'openai', model: 'c', url: 'http://x/slow/chat'}], {messages: [{role: 'user', content: 'q'}], fetch: f});
  eq(r.map((x) => x.id), ['A', 'B', 'C']); eq(r[0].text, 'Răspuns rapid'); eq(r[1].code, 'server'); yes(r[1].error && !r[1].text, 'B eșuat'); eq(r[2].text, 'Răspuns lent'); yes(r.every((x) => x.ms >= 0), 'ms');
});
console.log(`\n${ok} ok, ${bad} eșuate`); process.exit(bad ? 1 : 0);
