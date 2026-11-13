#!/usr/bin/env node
/* tools/demo-web/make.mjs — filmulețe demo pentru aplicațiile HTML dintr-un singur fișier: înregistrare REALĂ a paginii (Chromium, rețea blocată),
 * fără sunet, cu subtitrări WebVTT în 8 limbi, în același format ca restul din demo/ (video.mp4, poster.jpg, preview.webp, <lg>.vtt, transcript.json, loc/<lg>/…).
 *   node tools/demo-web/make.mjs --root /home/claude/chiuta [--only FARFURIA,VITALIS] [--langs en,ro]
 * Cere: playwright (NODE_PATH), ffmpeg, python3 cu Pillow (pentru preview.webp animat). Prima propoziție a subtitrării 1 = prima propoziție din fișa cardului (CONTENT din index.html).
 * Textele generice (liniile 2–6) sunt cele din demo/ACORDAJ/transcript.json, deja traduse în cele 8 limbi. Nu se inventează funcții: sunt doar acțiunile reale ale paginii. */
import fs from 'node:fs'; import path from 'node:path'; import {spawnSync} from 'node:child_process'; import {fileURLToPath} from 'node:url'; import {createRequire} from 'node:module';
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(process.env.PW_ROOT || import.meta.url); const {chromium} = require('playwright');
const a = process.argv.slice(2); const opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const ROOT = path.resolve(opt('--root', path.join(HUB, '..'))); const only = opt('--only', '') ? opt('--only').split(',') : null;
const LANGS = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu']; const langs = opt('--langs', '') ? opt('--langs').split(',') : LANGS;
// aplicațiile cu interfață în 8 limbi (înregistrate pe fiecare limbă) vs. doar română
const APPS = {FARFURIA: {dir: 'FARFURIA', loc: true}, VITALIS: {dir: 'VITALIS', loc: true}, DECUPAJ: {dir: 'DECUPAJ', loc: true}, LECTOR: {dir: 'LECTOR', loc: true}, Cronosala: {dir: 'Cronosala', loc: false}, REZONANTA: {dir: 'REZONANTA', loc: false}};

const SAMPLE = '/tmp/demo-sample.wav'; if (!fs.existsSync(SAMPLE)) spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=f=180:d=45', '-f', 'lavfi', '-i', 'sine=f=330:d=45', '-filter_complex', '[0][1]amix=inputs=2,tremolo=f=3:d=0.7,volume=2', '-ar', '16000', '-ac', '1', SAMPLE]);
const T = (m) => (l) => m[l] || m.en;
const EP = T({ro: 'Episodul 12', en: 'Episode 12', fr: 'Épisode 12', it: 'Episodio 12', es: 'Episodio 12', pt: 'Episódio 12', de: 'Folge 12', hu: '12. epizód'});
const WEL = T({ro: 'Bine ați venit', en: 'Welcome', fr: 'Bienvenue', it: 'Benvenuti', es: 'Bienvenidos', pt: 'Bem-vindos', de: 'Willkommen', hu: 'Üdvözöljük'});
const SCENES = {
  Cronosala: {intro: [['wait', 1500], ['scroll', 200], ['wait', 1200], ['scroll', -200]],
    explore: [['click', 'button:has-text("Tabata")'], ['wait', 1500], ['click', 'button:has-text("30/15")'], ['wait', 1200], ['click', '#goBtn'], ['wait', 3500], ['key', 'Escape'], ['wait', 900], ['click', 'button:has-text("Oprește")'], ['wait', 900], ['click', '#back'], ['wait', 600]],
    try: [['click', 'button:has-text("Serii pe exerciții")'], ['wait', 2000], ['click', '#back'], ['wait', 500], ['click', 'button:has-text("Program lunar")'], ['wait', 2400], ['click', '#back']], offline: [['wait', 1200], ['scroll', 300], ['wait', 1200], ['scroll', -300]]},
  FARFURIA: {intro: [['wait', 1800], ['scroll', 250], ['wait', 1500], ['scroll', -250]],
    explore: [['nth', 'button', 2], ['wait', 2200], ['scroll', 300], ['wait', 1200], ['scroll', -300], ['nth', 'button', 3], ['scroll', 300], ['wait', 1500]],
    try: [['nth', 'button', 4], ['wait', 1600], ['nth', 'button', 5], ['wait', 1600]], offline: [['nth', 'button', 1], ['wait', 1200], ['scroll', 300], ['wait', 1200]]},
  VITALIS: {intro: [['wait', 1800], ['scroll', 250], ['wait', 1500], ['scroll', -250]],
    explore: [['nth', '.tabs button', 2], ['wait', 2200], ['scroll', 400], ['wait', 1200], ['scroll', -400], ['nth', '.tabs button', 3], ['wait', 2200]],
    try: [['nth', '.tabs button', 4], ['wait', 2200], ['scroll', 300], ['wait', 1200], ['nth', '.tabs button', 6], ['wait', 1800]], offline: [['nth', '.tabs button', 0], ['wait', 1200], ['scroll', 300], ['wait', 1200]]},
  LECTOR: {intro: [['wait', 1800]],
    explore: [['fill', '#paste', 'Lectura cu voce tare ajută la odihnă și la învățare. Aplicația citește cărți și texte folosind vocile instalate pe dispozitivul tău. Nimic nu pleacă din browser. Poți alege viteza, tonul și un temporizator de somn.'], ['wait', 1000], ['click', '#load'], ['wait', 2200]],
    try: [['click', '#fsp'], ['click', '#fsp'], ['wait', 900], ['click', '#bmadd'], ['wait', 900], ['sel', '#sleep', 2], ['wait', 900], ['click', '#lo'], ['wait', 1500], ['click', '#lo']], offline: [['click', '#fsm'], ['wait', 1200], ['scroll', 300], ['wait', 1200]]},
  DECUPAJ: {intro: [['wait', 1800]],
    explore: [['file', '#file', SAMPLE], ['wait', 3500], ['fill', '#t0', '00:08'], ['fill', '#t1', '00:30'], ['wait', 1500]],
    try: [['fill', '#title', EP], ['fill', '#sub', 'Podcast'], ['fill', '#caps', (l) => '00:09 ' + WEL(l) + '\n00:14 Podcast'], ['sel', '#fmt', 1], ['wait', 1500], ['sel', '#wstyle', 2], ['wait', 1500]], offline: [['scroll', 500], ['wait', 1500], ['scroll', -500]]},
  REZONANTA: {intro: [['wait', 1800], ['scroll', 300], ['wait', 1500], ['scroll', -300]],
    explore: [['click', '#t-msg'], ['wait', 2200], ['click', '#t-can'], ['wait', 2200], ['scroll', 300], ['wait', 1200]],
    try: [['click', '#t-txt'], ['wait', 1000], ['type', '#s-txt textarea', 'Propoziția scurtă se înțelege ușor. Propozițiile foarte lungi, încărcate de expresii greoaie și de subordonate, obosesc cititorul și îi îndepărtează atenția de mesaj.'], ['wait', 2200]], offline: [['click', '#t-cri'], ['wait', 1800], ['scroll', 300], ['wait', 1200]]},
};
const html = fs.readFileSync(path.join(HUB, 'index.html'), 'utf8');
const CONTENT = JSON.parse(html.match(/const CONTENT=(\{.*?\});\n/s)[1]);
const generic = JSON.parse(fs.readFileSync(path.join(HUB, 'demo/ACORDAJ/transcript.json'), 'utf8'));
const man = JSON.parse(fs.readFileSync(path.join(HUB, 'demo/manifest.json'), 'utf8'));
const DESTR = /șterg|sterg|reset|delete|wipe|clear|remove|elimin|import|export|print|tipăr|imprim|golește|supprim|eliminar|löschen|törl|apag|cancel/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const first = (s) => (s.match(/^.*?[.!?](?=\s|$)/) || [s])[0];
function cuesFor(slug, lang, loc) {
  const L = CONTENT[lang].apps[slug].line, G = generic[lang];
  const lines = [first(L), G[1], G[2]]; if (loc) lines.push(G[3]); lines.push(G[4], G[5]); return lines;
}
const ts = (t) => { const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + s.toFixed(3).padStart(6, '0'); };
function vtt(lines, marks) { let o = 'WEBVTT\n\n'; lines.forEach((t, i) => { o += `${i + 1}\n${ts(marks[i] + 0.3)} --> ${ts(marks[i + 1] - 0.2)}\n${t}\n\n`; }); return o; }
async function safeClick(page, loc) { try { await loc.click({timeout: 2500, trial: false}); return true; } catch { return false; } }
async function record(slug, lang, loc, outDir) {
  const dir = path.join(ROOT, APPS[slug].dir); const file = 'file://' + path.join(dir, 'index.html');
  const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
  const tmp = fs.mkdtempSync('/tmp/demo-' + slug + '-');
  const ctx = await b.newContext({viewport: {width: 1280, height: 720}, serviceWorkers: 'block', locale: lang === 'en' ? 'en-US' : lang});
  await ctx.route(/^https?:/, (r) => r.abort());
  const page = await ctx.newPage(); const frames = []; let rec = true; const t0 = Date.now();
  // Playwright nu are ffmpeg-ul lui aici: capturi JPEG în buclă (≈10 cadre/s), asamblate cu ffmpeg din sistem după durata reală a fiecărui cadru
  const loop = (async () => { let i = 0; while (rec) { const f = path.join(tmp, 'f' + String(i++).padStart(5, '0') + '.jpg'); const t = (Date.now() - t0) / 1000; try { await page.screenshot({path: f, type: 'jpeg', quality: 70, timeout: 6000}); frames.push({f, t}); } catch (e) { if (process.env.DEMO_DEBUG && !globalThis.__e) { globalThis.__e = 1; console.log('  screenshot:', String(e.message).split('\n')[0]); } await sleep(150); } } })(); const T = () => (Date.now() - t0) / 1000; const marks = [0];
  await page.addInitScript(([l, s]) => { try { localStorage.setItem(s + '.lang', l); localStorage.setItem('lang', l); } catch (e) {} }, [lang, slug.toLowerCase()]);
  await page.goto(file); await sleep(1200);
  if (loc) { try { const sel = await page.$('#lang, #langsel'); if (sel) { const idx = await sel.evaluate((s, l) => [...s.options].findIndex((o) => o.value === l || o.value.slice(0, 2) === l), lang); if (idx >= 0) await sel.selectOption({index: idx}); } } catch {} }
  await sleep(1500);
  const mark = () => marks.push(T());
  const SC = SCENES[slug]; const run = async (steps) => { for (const st of steps) { const [k, x, y] = st; try {
    if (k === 'click') await page.locator(x).first().click({timeout: 2500}); else if (k === 'nth') await page.locator(x).nth(y).click({timeout: 2500});
    else if (k === 'fill') await page.locator(x).first().fill(typeof y === 'function' ? y(lang) : y, {timeout: 2500}); else if (k === 'type') { await page.locator(x).first().click({timeout: 2500}); await page.keyboard.type(typeof y === 'function' ? y(lang) : y, {delay: 70}); }
    else if (k === 'file') await page.locator(x).first().setInputFiles(y, {timeout: 4000}); else if (k === 'sel') await page.locator(x).first().selectOption({index: y}, {timeout: 2500});
    else if (k === 'key') await page.keyboard.press(x); else if (k === 'scroll') await page.mouse.wheel(0, x); else if (k === 'wait') await sleep(x); } catch (e) { console.log('  pas omis', slug, lang, JSON.stringify(st).slice(0, 60), String(e.message).split('\n')[0].slice(0, 80)); } await sleep(350); } };
  await sleep(1500); await run(SC.intro); mark();       // 1 — prezentare
  await run(SC.explore); mark();                          // 2 — secțiunile
  await run(SC.try); await sleep(1200); mark();           // 3 — încearcă
  if (loc) { const sel = await page.$('#lang, #langsel'); if (sel) { try { const n2 = await sel.evaluate((s) => s.options.length); for (const i of [1, 3, 0]) { await sel.selectOption({index: i % n2}); await sleep(1100); } const idx = await sel.evaluate((s, l) => [...s.options].findIndex((o) => o.value === l || o.value.slice(0, 2) === l), lang); if (idx >= 0) await sel.selectOption({index: idx}); } catch {} } await sleep(900); mark(); }  // 4 — limba
  await run(SC.offline); await sleep(1000); mark();      // 5 — offline
  await sleep(3000); mark();                              // 6 — final
  const total = T(); rec = false; await loop; if (process.env.DEMO_DEBUG) console.log('  cadre', frames.length, 'total', total.toFixed(1)); await ctx.close(); await b.close(); fs.mkdirSync(outDir, {recursive: true});
  const list = frames.map((x, i) => `file '${x.f}'\nduration ${((i + 1 < frames.length ? frames[i + 1].t : total) - x.t).toFixed(3)}`).join('\n') + `\nfile '${frames[frames.length - 1].f}'\n`; fs.writeFileSync(path.join(tmp, 'list.txt'), list);
  const mp4 = path.join(outDir, 'video.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-vf', 'scale=1280:720', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', '-an', mp4]);
  if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);
  const dur = +(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], {encoding: 'utf8'}).stdout.trim());
  const scale = dur / total; const mk = marks.map((x) => x * scale); mk[mk.length - 1] = dur;
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(Math.min(6, dur / 3)), '-i', mp4, '-frames:v', '1', '-vf', 'scale=640:360', '-q:v', '4', path.join(outDir, 'poster.jpg')]);
  // preview animat: 5 cadre 400x225
  const fr = []; for (let i = 0; i < 5; i++) { const f = path.join(tmp, `p${i}.png`); spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(dur * (0.1 + i * 0.17)), '-i', mp4, '-frames:v', '1', '-vf', 'scale=400:225', f]); fr.push(f); }
  spawnSync('python3', ['-I', '-c', 'import sys;from PIL import Image;fs=[Image.open(f).convert("RGB") for f in sys.argv[2:]];fs[0].save(sys.argv[1],save_all=True,append_images=fs[1:],duration=700,loop=0,quality=70,method=6)', path.join(outDir, 'preview.webp'), ...fr]);
  if (!process.env.DEMO_DEBUG) fs.rmSync(tmp, {recursive: true, force: true}); else console.log('  tmp', tmp);
  return {dur, marks: mk, size: fs.statSync(mp4).size, frames: frames.length, total};
}
const out = [];
for (const slug of Object.keys(APPS)) {
  if (only && !only.includes(slug)) continue; const A = APPS[slug];
  const base = path.join(HUB, 'demo', slug); fs.mkdirSync(base, {recursive: true});
  const todo = A.loc ? langs : ['en']; const res = {};
  for (let i = 0; i < todo.length; i += 3) { const part = todo.slice(i, i + 3); const recs = await Promise.all(part.map((l) => record(slug, l, A.loc, l === 'en' ? base : path.join(base, 'loc', l)))); part.forEach((l, j) => { res[l] = recs[j]; }); }
  // înregistrările cu cadre prea puține (captură blocată sub încărcare) se refac, una câte una
  for (const l of todo) { for (let k = 0; k < 3 && res[l].frames < res[l].total * 12; k++) { console.log('  refac', slug, l, res[l].frames, 'cadre'); res[l] = await record(slug, l, A.loc, l === 'en' ? base : path.join(base, 'loc', l)); } }
  const tr = {}; const vt = {};
  for (const l of LANGS) {
    const rr = res[A.loc ? l : 'en'] || res.en; const lines = cuesFor(slug, l, A.loc); tr[l] = lines;
    const v = vtt(lines, rr.marks); fs.writeFileSync(path.join(base, l + '.vtt'), v); vt[l] = `${slug}/${l}.vtt`;
    if (A.loc && l !== 'en') { fs.mkdirSync(path.join(base, 'loc', l), {recursive: true}); fs.writeFileSync(path.join(base, 'loc', l, l + '.vtt'), v); }
  }
  fs.writeFileSync(path.join(base, 'transcript.json'), JSON.stringify(tr));
  const card = {slug, res};
  out.push(card);
  // manifest
  const ti = html.indexOf(`data-c="apps|${slug}|title"`); const cs = html.lastIndexOf('<div class="app-card', ti); const head = html.slice(cs, html.indexOf('>', cs));
  const at = (k) => (head.match(new RegExp('data-' + k + '="([^"]*)"')) || [])[1] || '';
  const sec = at('cat');
  const old = man.items.findIndex((x) => x.slug === slug);
  const it = {slug, title: slug, section: sec, tags: Object.fromEntries(LANGS.map((l) => [l, CONTENT[l].apps[slug].tags])), line: Object.fromEntries(LANGS.map((l) => [l, CONTENT[l].apps[slug].line])),
    url: (html.match(new RegExp('href="(https://chiuta\\.github\\.io/' + slug + '/)"')) || [])[1], readme: `https://github.com/chiuta/${slug}#readme`, off: at('off'), status: at('status') || 'stable',
    video: `${slug}/video.mp4`, poster: `${slug}/poster.jpg`, duration: +res.en.dur.toFixed(1), size: res.en.size, vtt: vt, transcript: `${slug}/transcript.json`,
    videos: A.loc ? Object.fromEntries(LANGS.filter((l) => l !== 'en').map((l) => [l, {video: `${slug}/loc/${l}/video.mp4`, vtt: `${slug}/loc/${l}/${l}.vtt`, duration: +res[l].dur.toFixed(1), size: res[l].size}])) : {}};
  if (old >= 0) man.items[old] = it; else man.items.push(it);
  console.log(slug, 'ok', Object.keys(res).length, 'înregistrări', res.en.dur.toFixed(1) + 's');
}
fs.writeFileSync(path.join(HUB, 'demo/manifest.json'), JSON.stringify(man, null, 1) + '\n');
