#!/usr/bin/env node
// Generează fixturile SINTETICE pentru alergător: node tools/refresh/fixtures/make.mjs
// ATENȚIE: fixturile NU sunt înregistrate de pe site-urile reale (mediul de lucru nu poate ieși spre ele); sunt construite după codul/documentația sursei.
// Fixturile reale se obțin cu `run.mjs --record DIR` în Actions (artefact „refresh-recordings”) și se pun într-un scenariu „real”.
// Fiecare răspuns = <sha1(url)[:12]>.json (stare, antete) + .body.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', '..', 'data', 'sources.json'), 'utf8'));
const sha = (x) => createHash('sha256').update(x).digest('hex');
const sha1 = (x) => createHash('sha1').update(x).digest('hex');
const get = (id) => S.sources.find((s) => s.id === id);
let N = 0;
function put(id, scen, url, body, status = 200, ctype = 'text/html; charset=utf-8') {
  const d = path.join(HERE, id, scen); fs.mkdirSync(d, {recursive: true});
  const f = path.join(d, sha(url).slice(0, 12));
  fs.writeFileSync(f + '.json', JSON.stringify({url, status, headers: {'content-type': ctype}}, null, 1) + '\n');
  fs.writeFileSync(f + '.body', typeof body === 'string' ? body : JSON.stringify(body));
  N++;
}
const ROBOTS_OK = 'User-agent: *\nDisallow: /private/\nDisallow: /wp-admin/\n';
const robotsAll = (id, scen, urls, txt = ROBOTS_OK, status = 200) => { for (const o of new Set(urls.map((u) => new URL(u).origin))) put(id, scen, o + '/robots.txt', status === 404 ? 'not found' : txt, status, 'text/plain'); };
const scenarios = (id, names, urls) => names.forEach((n) => robotsAll(id, n, urls));
const urlsOf = (s) => [s.url, ...(s.urls || []), ...(((s.expect || {}).checks || []).map((c) => c.url)), ...(((s.expect || {}).files || []).map((f) => f.url)), ...(((s.expect || {}).models || []).map((m) => `https://huggingface.co/api/models/${m}`))].filter(Boolean);

/* ---------- ACORDAJ (webnode-titles) ---------- */
{
  const s = get('ACORDAJ'), id = s.id, base = s.url;
  const title = (n, v = 0) => `Sistem spiritual de test ${String(n).padStart(4, '0')}${v ? ' (varianta ' + v + ')' : ''} ăîșțâ`;
  const page = (from, to, changed = []) => `<!doctype html><html><head><title>Lista – pagina</title><style>p{margin:0}</style></head><body><nav><a href="/">Acasă</a> <a href="/lista-1/">Partea 1</a> <a href="/lista-2/">Partea 2</a> <a href="/contact/">Contact</a> <a href="/img/logo.png">logo</a> <a href="https://exemplu.invalid/">extern</a></nav><main>${
    Array.from({length: to - from + 1}, (_, i) => from + i).map((n) => `<p>${n}. ${title(n, changed.includes(n) ? 1 : 0).replace(/&/g, '&amp;')}</p>`).join('\n')}</main><footer>© 2026 Autor. Toate drepturile rezervate.</footer></body></html>`;
  const home = `<!doctype html><html><body><nav><a href="/lista-1/">Partea 1</a> <a href="/lista-2/">Partea 2</a> <a href="/contact/">Contact</a> <a href="/img/logo.png">logo</a> <a href="https://exemplu.invalid/">extern</a></nav><h1>Cursuri spirituale</h1><p>Bine ați venit. 2026. Actualizat.</p></body></html>`;
  const build = (scen, total, changed = [], mode = 'num') => {
    robotsAll(id, scen, [base]);
    const cut = Math.floor(total / 2);
    if (mode === 'num') { put(id, scen, base, home); put(id, scen, base + 'lista-1/', page(1, cut, changed)); put(id, scen, base + 'lista-2/', page(cut + 1, total, changed)); put(id, scen, base + 'contact/', '<p>Contact: scrieți-ne.</p>'); }
    else { const li = (a, b) => Array.from({length: b - a + 1}, (_, i) => `<li>${title(a + i)}</li>`).join(''); put(id, scen, base, home); put(id, scen, base + 'lista-1/', `<ul>${li(1, cut)}</ul>`); put(id, scen, base + 'lista-2/', `<ul>${li(cut + 1, total)}</ul>`); put(id, scen, base + 'contact/', '<p>Contact</p>'); }
  };
  build('ok', 1134); build('drop', 800); build('grow', 2000); build('structure', 1134, [], 'li'); build('changed-small', 1134, [10, 500, 900]);
  build('changed-big', 1134, Array.from({length: 120}, (_, i) => 5 + i * 9));
  robotsAll(id, 'robots-block', [base], 'User-agent: *\nDisallow: /\n');
  put(id, 'robots-block', base, home);
  robotsAll(id, 'robots-5xx', [base], 'eroare', 503); put(id, 'robots-5xx', base, home);
  fs.writeFileSync(path.join(HERE, id, 'README.txt'), 'Fixturi sintetice (titluri inventate); titlurile reale ale listei nu se copiază în depozit.\n');
}

/* ---------- VNTV (videoneat-index) ---------- */
{
  const s = get('VNTV'), id = s.id;
  const item = (i, extra = {}) => ({id: 1000 + i, title: `Documentar de test ${i}`, link: `https://www.videoneat.com/documentar-${i}/`, date: `2026-0${1 + (i % 9)}-1${i % 9}`, cats: [2, 7], img: null,
    trailer: i % 5 ? {host: 'videos.trom.tf', id: `uuid${String(i).padStart(6, '0')}`} : null, year: String(1990 + (i % 30)), length: '52 min', source: 'PBS', source_url: 'https://example.invalid/', excerpt: 'Rezumat.', ...extra});
  const idx = (n, over = {}) => ({v: 1, generated: '2026-11-01T06:00:00Z', site: 'https://www.videoneat.com/', count: n, items: Array.from({length: n}, (_, i) => item(i)), ...over});
  const base = idx(120); const put1 = (scen, body, status = 200) => { robotsAll(id, scen, [s.url, ...s.urls]); put(id, scen, s.url, body, status, 'application/json'); };
  put1('ok', base);
  { const j = idx(120); j.items = j.items.slice(1); j.items.push(item(500)); j.items.push(item(501)); j.items[3].title += ' (corectat)'; j.count = j.items.length; put1('changed-small', j); }
  { const j = idx(160); put1('changed-big', j); }
  put1('drop', idx(60));
  { const j = idx(120); j.v = 2; j.items = j.items.map(({title, ...r}) => ({name: title, ...r})); put1('structure', j); }
  put1('garbage', '<html><body>Mentenanță</body></html>', 200);
  { robotsAll(id, 'fallback', [s.url, ...s.urls]); put(id, 'fallback', s.url, 'indisponibil', 503, 'text/plain'); put(id, 'fallback', s.urls[0], base, 200, 'application/json'); }
  { const j = idx(120); j.items[5].id = j.items[6].id; put1('duplicates', j); }
  { const wp = s.urls[1], posts = Array.from({length: 130}, (_, i) => ({id: 2000 + i, title: {rendered: `Articol WP ${i} &amp; co`}, link: `https://www.videoneat.com/a-${i}/`, date: '2026-10-01T10:00:00'}));
    robotsAll(id, 'wp-fallback', [s.url, ...s.urls]); put(id, 'wp-fallback', s.url, 'nu există', 404, 'text/plain'); put(id, 'wp-fallback', s.urls[0], 'nu există', 404, 'text/plain');
    put(id, 'wp-fallback', wp + '&page=1', posts.slice(0, 100), 200, 'application/json'); put(id, 'wp-fallback', wp + '&page=2', posts.slice(100), 200, 'application/json'); }
}

/* ---------- AGORA-populatii (eurostat-population) ---------- */
{
  const s = get('AGORA-populatii'), id = s.id;
  const EA = ['AT', 'BE', 'BG', 'CY', 'DE', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'];
  const POP = {AT: 9.2, BE: 11.9, BG: 6.4, CY: 0.98, DE: 83.5, EE: 1.36, EL: 10.4, ES: 49.6, FI: 5.7, FR: 69.1, HR: 3.9, IE: 5.4, IT: 58.9, LT: 2.89, LU: 0.691, LV: 1.85, MT: 0.588, NL: 18.1, PT: 11.4, SI: 2.13, SK: 5.4};
  const js = (geos, over = {}, cls = 'dataset') => {
    const times = ['2024', '2025', '2026'], value = {};
    geos.forEach((g, gi) => times.forEach((t, ti) => { if (!(t === '2026' && gi % 2)) value[String(gi * 3 + ti)] = Math.round(POP[g] * 1e6 * (1 + 0.002 * ti) * (over[g] || 1)); }));
    return {version: '2.0', class: cls, label: 'Population on 1 January - total', id: ['freq', 'indic_de', 'geo', 'time'], size: [1, 1, geos.length, 3],
      dimension: {freq: {category: {index: {A: 0}}}, indic_de: {category: {index: {JAN: 0}}}, geo: {category: {index: Object.fromEntries(geos.map((g, i) => [g, i]))}}, time: {category: {index: {2024: 0, 2025: 1, 2026: 2}}}}, value};
  };
  const put1 = (scen, body, status = 200) => { robotsAll(id, scen, [s.url]); put(id, scen, s.url, body, status, 'application/json'); };
  put1('ok', js(EA)); put1('missing-geo', js(EA.filter((g) => g !== 'LU'))); put1('structure', js(EA, {}, 'collection')); put1('deviation', js(EA, {FR: 0.95})); put1('implausible', js(EA, {MT: 1000}));
  put1('http-500', 'eroare', 500);
}

/* ---------- page-mentions ---------- */
for (const s of S.sources.filter((x) => x.stare === 'activ' && x.parser === 'page-mentions')) {
  const pad = '<p>' + 'Text de documentație. '.repeat(120) + '</p>';
  const page = (tokens) => `<!doctype html><html><head><title>Docs</title><script>var x=1</script></head><body><h1>Modele</h1>${tokens.map((t) => `<table><tr><td><code>${t}</code></td></tr></table>`).join('')}${pad}</body></html>`;
  const t = s.expect.contains;
  scenarios(s.id, ['ok', 'drift', 'short'], [s.url]);
  put(s.id, 'ok', s.url, page(t)); put(s.id, 'drift', s.url, page(t.slice(0, -1))); put(s.id, 'short', s.url, '<html><div id="root"></div><script src="/app.js"></script></html>');
}
/* ---------- hf-models ---------- */
{
  const s = get('LocalMind-modele'), ms = s.expect.models, u = (m) => `https://huggingface.co/api/models/${m}`;
  scenarios(s.id, ['ok', 'drift'], ms.map(u));
  for (const m of ms) put(s.id, 'ok', u(m), {id: m, lastModified: '2026-09-01T00:00:00.000Z', pipeline_tag: 'text-generation'}, 200, 'application/json');
  ms.forEach((m, i) => { if (i === 0) put(s.id, 'drift', u(m), {error: 'Repository not found'}, 404, 'application/json'); else if (i === 1) put(s.id, 'drift', u(m), {id: 'onnx-community/Alt-Nume'}, 200, 'application/json'); else put(s.id, 'drift', u(m), {id: m}, 200, 'application/json'); });
}
/* ---------- sha256-pinned (ATINGERE) ---------- */
{
  const s = get('ATINGERE-tessdata'), files = s.expect.files; scenarios(s.id, ['ok', 'drift'], files.map((f) => f.url));
  const hashes = {};
  files.forEach((f, i) => { const body = `tessdata sintetic ${f.name}\n`; hashes[f.name] = sha(body); put(s.id, 'ok', f.url, body, 200, 'application/octet-stream'); put(s.id, 'drift', f.url, i === 2 ? body + 'alterat' : body, 200, 'application/octet-stream'); });
  fs.writeFileSync(path.join(HERE, s.id, 'ok', '_hashes.json'), JSON.stringify(hashes, null, 1) + '\n');
}
/* ---------- npm / pypi ---------- */
{
  const a = get('fff-kit-astronomia'); scenarios(a.id, ['ok', 'deprecated', 'missing'], [a.url]);
  const npm = (dep) => ({name: 'astronomia', 'dist-tags': {latest: '4.2.0'}, versions: {'4.2.0': dep ? {name: 'astronomia', version: '4.2.0', deprecated: 'Pachet abandonat'} : {name: 'astronomia', version: '4.2.0'}}});
  put(a.id, 'ok', a.url, npm(false), 200, 'application/json'); put(a.id, 'deprecated', a.url, npm(true), 200, 'application/json'); put(a.id, 'missing', a.url, {error: 'Not found'}, 404, 'application/json');
  const p = get('fff-kit-hipparcos'); scenarios(p.id, ['ok', 'yanked'], [p.url]);
  put(p.id, 'ok', p.url, {info: {name: 'hipparcos-catalog', version: '0.1.0', yanked: false}}, 200, 'application/json'); put(p.id, 'yanked', p.url, {info: {name: 'hipparcos-catalog', version: '0.1.0', yanked: true, yanked_reason: 'bug'}}, 200, 'application/json');
}
/* ---------- json-shape ---------- */
for (const s of S.sources.filter((x) => x.stare === 'activ' && x.parser === 'json-shape')) {
  const mk = (paths, skip) => { const o = {}; for (const p of paths) { if (p === skip) continue; const ks = p.split('.'); let c = o; ks.forEach((k, i) => { const last = i === ks.length - 1, nextNum = !last && /^\d+$/.test(ks[i + 1]); if (/^\d+$/.test(k)) return; const key = k; if (last) c[key] = 1; else c = c[key] ||= nextNum ? [{}] : {}; if (Array.isArray(c)) c = c[0]; }); } return o; };
  const root = (p) => /^\d+\./.test(p);
  const body = (c, skip) => (c.paths.every(root) ? [mk(c.paths.map((p) => p.replace(/^\d+\./, '')), skip && skip.replace(/^\d+\./, ''))] : mk(c.paths, skip));
  scenarios(s.id, ['ok', 'drift', 'http-503'], s.expect.checks.map((c) => c.url));
  for (const c of s.expect.checks) { put(s.id, 'ok', c.url, body(c), 200, 'application/json'); put(s.id, 'http-503', c.url, 'indisponibil', 503, 'text/plain'); }
  s.expect.checks.forEach((c, i) => put(s.id, 'drift', c.url, i === 0 ? body(c, c.paths[c.paths.length - 1]) : body(c), 200, 'application/json'));
}
console.log(`${N} fișiere de răspuns scrise`);
