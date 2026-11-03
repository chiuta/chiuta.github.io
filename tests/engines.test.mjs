// Teste e2e ale motoarelor comune (Etapa 5): agenda comună, pașaport, peisaj sonor, nucleu AI, motor de jocuri — pe aplicațiile reale, rețeaua oprită.
// Rulare: node tests/engines.test.mjs [filtru] [--root DIR]    (fără clone: SKIP cu cod 0)
import {createRequire} from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath, pathToFileURL} from 'node:url';
const require = createRequire(process.env.FFF_NODE_TOOLS || '/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), ri = args.indexOf('--root'), rootArg = ri >= 0 ? args.splice(ri, 2)[1] : null;
const cands = [rootArg, process.env.FFF_ROOT, path.join(HUB, '..'), '/home/claude/demo/apps'].filter(Boolean);
const ROOT = cands.find((d) => fs.existsSync(path.join(d, 'Orar', 'index.html')));
if (!ROOT) { console.log('SKIP: clonele aplicațiilor nu sunt disponibile (--root / FFF_ROOT)'); process.exit(0); }
const only = args[0], results = [];
async function T(name, fn) {
  if (only && !name.includes(only)) return; const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).join('\n       ')); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
const url = (app) => pathToFileURL(path.join(ROOT, app, 'index.html')).href;
async function open(app, init, ready) {
  const ctx = await browser.newContext({locale: 'en-US', acceptDownloads: true, reducedMotion: 'reduce', viewport: {width: 1100, height: 900}, timezoneId: 'Europe/Bucharest'});
  await ctx.setOffline(true);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage(), errs = [], reqs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('request', (r) => { if (/^https?:/.test(r.url())) reqs.push(r.url()); });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(url(app)); await page.waitForFunction(ready || (() => window.FFF && FFF.envelope), null, {timeout: 15000});
  await page.evaluate(() => { const g = document.getElementById('hpGate'); if (g && g.open) g.close(); }).catch(() => {});   // generator-frecvente: avertismentul pentru căști (dialog modal propriu)
  const wc = page.locator('#btnWelcomeClose'); if (await wc.isVisible().catch(() => false)) await wc.click();   // INDICATIV: bun venit la prima pornire
  if (['generator-frecvente', 'CalmWaves'].includes(app)) page.click = (sel) => page.dispatchEvent(sel, 'click');   // pagini cu animație continuă: Playwright nu le consideră „stabile”; evenimentul de clic ajunge la buton
  return {ctx, page, errs, reqs};
}
async function sendFile(page, sel = '#fffEnvSend') {
  await page.click(sel); const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[role=menu] button', {hasText: '.fff.json'}).first().click()]);
  return JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
}
async function recvFile(page, env, sel = '#fffEnvRecv', confirm = true) {
  await page.click(sel); const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[role=menu] button', {hasText: '.fff.json'}).first().click()]);
  await fc.setFiles({name: 'plic.fff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(env))});
  if (confirm) await page.locator('[role=alertdialog] button', {hasText: /^Import(ă)?$/}).dispatchEvent('click', {}, {timeout: 5000});
}
const dataOf = (env) => env.payload !== undefined ? env.payload : env.data;
const openDlg = async (page) => { if (await page.locator('#b-data').count() && !(await page.locator('#fffAgSend').isVisible())) await page.click('#b-data'); };   // în Orar butoanele sunt în dialogul „Date”
const A = (page) => ({send: async () => { await openDlg(page); return sendFile(page, '#fffAgSend'); }, recv: async (env, c) => { await openDlg(page); return recvFile(page, env, '#fffAgRecv', c); }});

/* ============ 1) Agenda comună ============ */
const oev = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('fff.orar.events') || '[]'));
const ocals = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem('fff.orar.cals') || '{}').cals || []));
async function until(fn, ms = 6000) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout: ' + fn); await new Promise((r) => setTimeout(r, 120)); } }
await T('agenda: CLEPSIDRA → Orar (program săptămânal + eveniment), a doua primire nu dublează, fără rețea', async () => {
  const C = await open('CLEPSIDRA', () => { try { localStorage.setItem('clepsidra.schedule', JSON.stringify({weekday: [{start: '23:00', end: '07:00', cat: 'somn'}, {start: '09:00', end: '17:00', cat: 'serviciu'}], weekend: [{start: '00:00', end: '09:00', cat: 'somn'}]})); localStorage.setItem('clepsidra.events', JSON.stringify([{name: 'Concert', ts: Date.now() + 20 * 864e5}])); } catch (e) {} }, () => document.getElementById('fffAgSend'));
  const env = await A(C.page).send(); const items = dataOf(env).items;
  ok(items.length === 4 && items.filter((i) => i.kind === 'block').length === 3, 'elemente ' + items.length);
  ok(!C.errs.length && !C.reqs.length, C.errs.join(';') + C.reqs.join(','));
  const O = await open('Orar', null, () => document.getElementById('fffAgRecv'));
  await A(O.page).recv(env);
  const ev1 = await until(async () => { const e = await oev(O.page); return e.some((x) => x.title === 'Concert') && e.filter((x) => /WEEKLY/.test(x.rrule || '')).length === 3 ? e : null; });
  ok(ev1.length === 4, 'evenimente în Orar: ' + ev1.length);
  await A(O.page).recv(env); await O.page.waitForTimeout(900);
  ok((await oev(O.page)).length === 4, 'a doua primire nu dublează');
  const cal = (await ocals(O.page)).filter((c) => c.name === 'Agenda comună FFF'); ok(cal.length === 1, 'un singur calendar „Agenda comună FFF”: ' + cal.length);
  ok(!O.errs.length && !O.reqs.length, O.errs.join(';') + O.reqs.join(',')); await C.ctx.close(); await O.ctx.close();
});
await T('agenda: Orar → CLEPSIDRA (blocuri săptămânale + evenimente viitoare în numărătoare)', async () => {
  const ds = (() => { const d = new Date(Date.now() + 9 * 864e5), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); })();
  const O = await open('Orar', (ds) => { }, () => document.getElementById('fffAgSend'));
  await O.page.evaluate((ds) => { localStorage.setItem('fff.orar.events', JSON.stringify([{title: 'Examen', start: ds + 'T10:00', end: ds + 'T12:00', tz: 'Europe/Bucharest'}, {title: 'Sport', start: ds + 'T18:00', end: ds + 'T19:00', tz: 'Europe/Bucharest', rrule: 'FREQ=WEEKLY;BYDAY=TU,TH'}])); }, ds);
  await O.page.reload(); await O.page.waitForFunction(() => document.getElementById('fffAgSend'));
  const env = await A(O.page).send(); const items = dataOf(env).items;
  ok(items.some((i) => i.title === 'Examen') && items.some((i) => /BYDAY=TU,TH/.test(i.rrule || '')), 'plic Orar: ' + JSON.stringify(items).slice(0, 300));
  const C = await open('CLEPSIDRA', null, () => document.getElementById('fffAgRecv'));
  await Promise.all([C.page.waitForNavigation({timeout: 8000}), A(C.page).recv(env)]);
  await C.page.waitForFunction(() => document.getElementById('fffAgSend'));
  const st = await C.page.evaluate(() => ({ev: JSON.parse(localStorage.getItem('clepsidra.events') || '[]'), sc: JSON.parse(localStorage.getItem('clepsidra.schedule') || 'null')}));
  ok(st.ev.some((e) => e.name === 'Examen'), 'eveniment: ' + JSON.stringify(st.ev));
  ok(st.sc && st.sc.weekday.some((b) => b.start === '18:00' && b.end === '19:00'), 'bloc săptămânal: ' + JSON.stringify(st.sc));
  ok(await C.page.locator('#eventList li').filter({hasText: 'Examen'}).count() === 1, 'Examen apare în lista CLEPSIDRA');
  ok(!O.errs.length && !C.errs.length, O.errs.concat(C.errs).join(';')); await O.ctx.close(); await C.ctx.close();
});
await T('agenda: Gospodar → Orar (scadențe lunare, FĂRĂ sume) și Gospodar ↔ Gospodar (cu sume, fără dubluri)', async () => {
  const G = await open('Gospodar', null, () => window.GOSPODAR && document.getElementById('fffAgSend'));
  await G.page.evaluate(() => { const S = GOSPODAR.S; S.wipeAll(); const a = S.addAccount({name: 'Cont', cur: 'RON', open: 0}); S.data().recs.push({id: S.nid('r'), name: 'Chirie', amt: -250000, acc: a.id, cat: '', freq: 'monthly', interval: 1, start: '2026-12-01', end: '', tags: [], note: '', paused: false}); S.commit('rec'); });
  const env = await A(G.page).send(); const it = dataOf(env).items; ok(it.length === 1 && it[0].kind === 'due' && it[0].rrule === 'FREQ=MONTHLY' && !it[0].amount, 'fără sume: ' + JSON.stringify(it));
  const O = await open('Orar', null, () => document.getElementById('fffAgRecv')); await A(O.page).recv(env);
  await until(async () => (await oev(O.page)).some((e) => e.title === 'Chirie' && /MONTHLY/.test(e.rrule || '')));
  await G.page.check('#fffAgAmt'); const env2 = await A(G.page).send(); const it2 = dataOf(env2).items; ok(it2[0].amount && it2[0].amount.minor === -250000 && it2[0].amount.cur === 'RON', 'cu sume: ' + JSON.stringify(it2));
  const G2 = await open('Gospodar', null, () => window.GOSPODAR && document.getElementById('fffAgRecv'));
  await G2.page.evaluate(() => { const S = GOSPODAR.S; S.wipeAll(); S.addAccount({name: 'Cont', cur: 'RON', open: 0}); S.commit('all'); });
  const nr = (p) => p.evaluate(() => GOSPODAR.S.data().recs.filter((r) => r.name === 'Chirie' && r.amt === -250000 && r.freq === 'monthly').length);
  await A(G2.page).recv(env2); await until(async () => (await nr(G2.page)) === 1);
  await A(G2.page).recv(env2); await G2.page.waitForTimeout(500); ok((await nr(G2.page)) === 1, 'a doua primire nu dublează');
  await A(G2.page).recv(env); await G2.page.waitForTimeout(500);
  ok((await G2.page.evaluate(() => GOSPODAR.S.data().recs.length)) === 1, 'scadența fără sumă nu creează plată');
  ok(![G, O, G2].some((x) => x.errs.length || x.reqs.length), [G, O, G2].map((x) => x.errs.concat(x.reqs).join(',')).join('|')); await G.ctx.close(); await O.ctx.close(); await G2.ctx.close();
});

/* ============ 2) Pașaport de învățare ============ */
const EDU = ['ATINGERE', 'Clopotel', 'Monstrarium', 'ETER', 'Fabrica', 'FASCICUL', 'SEVA', 'INDICATIV', 'MENSURA', 'PULS', 'QSO', 'RegexLab', 'SEOptimum'];
const pass = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('fff.pasaport.v1') || '{"entries":[]}').entries);
for (const app of EDU) await T('pașaport: ' + app + ' — „Notează în pașaport” propune subiectul, salvează, apare în panou; fără rețea/erori', async () => {
  const X = await open(app, null, () => window.FFF && FFF.passport && document.getElementById('fffpNote'));
  await X.page.click('#fffpNote'); const draft = await X.page.inputValue('#fffp-skill'); ok(draft.length > 3 && draft.toLowerCase().includes(app.toLowerCase().slice(0, 4)), 'subiect propus: ' + JSON.stringify(draft));
  await X.page.fill('#fffp-skill', draft + ' (test)'); await X.page.selectOption('#fffp-level', '3'); await X.page.fill('#fffp-memo', 'notiță'); await X.page.click('#fffp-save');
  const es = await pass(X.page); ok(es.length === 1 && es[0].kind === 'card' && es[0].level === 3 && es[0].app && es[0].skill.endsWith('(test)'), JSON.stringify(es));
  await X.page.click('#fffpFab'); ok((await X.page.locator('#fffp-panel').innerText()).includes('(test)'), 'apare în panou');
  ok(!X.errs.length && !X.reqs.length, X.errs.concat(X.reqs).join(';')); await X.ctx.close();
});
await T('pașaport: ETER → INDICATIV prin plic passport/fff (fără dubluri la a doua primire) + repetare notată', async () => {
  const A1 = await open('ETER', null, () => window.FFF && FFF.passport && document.getElementById('fffpNote'));
  await A1.page.evaluate(() => { FFF.passport.add({app: 'ETER', skill: 'Cod Q', level: 3, schedule: true}); FFF.passport.add({app: 'ETER', skill: 'Morse', level: 2}); });
  await A1.page.click('#fffpFab'); const env = await sendFile(A1.page, '#fffpSend'); ok(env.type === 'passport/fff' || env.src, 'tip'); ok(dataOf(env).entries.length === 2, 'două notări');
  const B = await open('INDICATIV', null, () => window.FFF && FFF.passport && document.getElementById('fffpFab'));
  await B.page.click('#fffpFab'); await recvFile(B.page, env, '#fffpRecv'); await until(async () => (await pass(B.page)).length === 2);
  await recvFile(B.page, env, '#fffpRecv'); await B.page.waitForTimeout(400); ok((await pass(B.page)).length === 2, 'fără dubluri');
  await B.page.evaluate(() => { const e = FFF.passport.list().find((x) => x.kind === 'card'); e.due = '2000-01-01'; const db = FFF.passport.load(); db.entries.find((x) => x.id === e.id).due = '2000-01-01'; localStorage.setItem('fff.pasaport.v1', JSON.stringify(db)); });
  await B.page.click('#fffpClose'); await B.page.click('#fffpFab'); ok((await B.page.locator('#fffp-panel').innerText()).match(/\b1\b/), 'o repetare scadentă');
  await B.page.locator('#fffp-panel button[data-q="4"]').click(); const g = (await pass(B.page)).find((x) => x.kind === 'card'); ok(g.reps === 1 && g.due > '2026-11-03', 'notat: ' + JSON.stringify(g));
  ok(![A1, B].some((x) => x.errs.length || x.reqs.length), 'erori'); await A1.ctx.close(); await B.ctx.close();
});
await T('pașaport: Fabrica — certificat tipărabil (mediu print): conține numele, notările, codul de control și avertismentul; restul paginii ascuns', async () => {
  const F = await open('Fabrica', null, () => window.FFF && FFF.passport && document.getElementById('fffpFab'));
  await F.page.evaluate(() => { FFF.passport.add({app: 'Fabrica', skill: 'Curs de test', level: 4}); FFF.passport.add({app: 'ETER', skill: 'Antene', level: 3}); });
  await F.page.click('#fffpFab'); await F.page.fill('#fffp-learner', 'Ana Popescu'); await F.page.locator('#fffp-learner').blur();
  await F.page.evaluate(() => { window.print = () => { window.__printed = true; }; }); await F.page.click('#fffpCert');
  ok(await F.page.evaluate(() => window.__printed), 'a cerut tipărirea');
  await F.page.emulateMedia({media: 'print'});
  const r = await F.page.evaluate(() => { const c = document.querySelector('.fffp-cert'); const hid = [...document.body.children].filter((e) => !e.classList.contains('fffp-cert') && e.tagName !== 'SCRIPT' && e.tagName !== 'STYLE' && getComputedStyle(e).display !== 'none').length; return {txt: c.innerText, vis: getComputedStyle(c).display, hid}; });
  ok(r.vis === 'block' && r.hid === 0, 'doar certificatul se vede la tipărire: ' + JSON.stringify({v: r.vis, h: r.hid}));
  ok(r.txt.includes('Ana Popescu') && r.txt.includes('Curs de test') && r.txt.includes('Antene') && /[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}/.test(r.txt) && /nu este diplom/i.test(r.txt), r.txt.slice(0, 400));
  const pdf = await F.page.pdf({format: 'A4', preferCSSPageSize: false}); ok(pdf.length > 1500 && pdf.slice(0, 4).toString() === '%PDF', 'PDF generat');
  await F.page.evaluate(() => window.dispatchEvent(new Event('afterprint'))); ok(await F.page.evaluate(() => !document.querySelector('.fffp-cert')), 'curățat după tipărire');
  ok(!F.errs.length && !F.reqs.length, F.errs.join(';')); await F.ctx.close();
});
await T('pașaport: Clopotel — repetările scadente devin agendă de scenă (2 min fiecare)', async () => {
  const C = await open('Clopotel', null, () => window.FFF && FFF.passport && document.getElementById('fffpFab'));
  await C.page.evaluate(() => { const e = FFF.passport.add({app: 'ETER', skill: 'Cod Q', schedule: true}); const db = FFF.passport.load(); db.entries[0].due = '2000-01-01'; localStorage.setItem('fff.pasaport.v1', JSON.stringify(db)); });
  await C.page.click('#fffpFab'); await C.page.click('#fffpAgenda');
  await until(async () => (await C.page.evaluate(() => JSON.parse(localStorage.getItem('clopotel.agenda.v1') || '[]'))).some((x) => x.speaker === 'Cod Q' && x.min === 2));
  ok(!C.errs.length && !C.reqs.length, C.errs.join(';')); await C.ctx.close();
});

/* ============ 3) Peisaj sonor ============ */
const SND = ['CalmWaves', 'EcoulSpectral', 'Decibel', 'generator-frecvente', 'BorderlessMelodies', 'ASMR'];
const hook = () => { const AC = window.AudioContext; window.__acs = []; window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__acs.push(this); } }; };
for (const app of SND) await T('sunet: ' + app + ' — mixerul pornește (context „running”), profilul „Dormit” se aplică, WAV randat nenul și fără depășire; fără rețea/erori', async () => {
  const X = await open(app, hook, () => window.FFF && FFF.soundscape && document.getElementById('fffsFab'));
  const own = await X.page.evaluate(() => window.__acs.length);
  await X.page.click('#fffsFab'); await X.page.click('[data-profile="dormit"]');
  ok((await X.page.inputValue('#fffsL-brown')) === '0.55' && (await X.page.inputValue('#fffsTimer')) === '45' && Math.abs(+(await X.page.inputValue('#fffsMaster')) - 0.2) < 1e-6, 'profil aplicat');
  await X.page.click('#fffsPlay'); await until(async () => X.page.evaluate((n) => window.__acs.length > n && window.__acs[window.__acs.length - 1].state === 'running', own));
  ok((await X.page.locator('#fffs-status').innerText()) === 'Se aude' || (await X.page.locator('#fffs-status').innerText()) === 'Playing', 'stare');
  const w = await X.page.evaluate(async () => { const b = await FFF.soundscape.renderWav(2); const a = new Uint8Array(await b.arrayBuffer()); const v = new DataView(a.buffer); let n = (a.length - 44) / 2, s = 0, mx = 0, hf = 0, prev = 0; for (let i = 0; i < n; i++) { const x = v.getInt16(44 + i * 2, true) / 32768; s += x * x; mx = Math.max(mx, Math.abs(x)); hf += (x - prev) * (x - prev); prev = x; } return {rms: Math.sqrt(s / n), peak: mx, hf: hf / Math.max(s, 1e-12), n}; });
  ok(w.n === 44100 && w.rms > 0.002 && w.peak < 0.7, 'WAV: ' + JSON.stringify(w));
  const w2 = await X.page.evaluate(async () => { FFF.soundscape.apply(FFF.soundscape.profile('studiu')); const b = await FFF.soundscape.renderWav(2); const v = new DataView(await b.arrayBuffer()); let n = (v.byteLength - 44) / 2, s = 0, hf = 0, prev = 0; for (let i = 0; i < n; i++) { const x = v.getInt16(44 + i * 2, true) / 32768; s += x * x; hf += (x - prev) * (x - prev); prev = x; } return hf / s; });
  ok(w2 > w.hf * 1.5, 'studiu (roz+ploaie) are mai mult conținut de înaltă frecvență decât dormit (brun+valuri): ' + w.hf.toFixed(4) + ' vs ' + w2.toFixed(4));
  await X.page.click('#fffsPlay'); ok(await X.page.evaluate(() => !FFF.soundscape.isPlaying()), 'oprit');
  ok(!X.errs.length && !X.reqs.length, X.errs.concat(X.reqs).join(';')); await X.ctx.close();
});
await T('sunet: ASMR → CalmWaves prin plic sound/profile (evidence 2), valori ostile curățate', async () => {
  const A1 = await open('ASMR', null, () => window.FFF && FFF.soundscape && document.getElementById('fffsFab'));
  await A1.page.click('#fffsFab'); await A1.page.click('[data-profile="preparat"]'); const env = await sendFile(A1.page, '#fffsSend');
  ok(env.type === 'sound/profile' || env.src, 'tip'); ok((env.evidence || {}).level === 2, 'evidence ' + JSON.stringify(env.evidence)); ok(dataOf(env).layers.drone === 0.2, JSON.stringify(dataOf(env)));
  const B = await open('CalmWaves', null, () => window.FFF && FFF.soundscape && document.getElementById('fffsFab')); await B.page.click('#fffsFab'); await recvFile(B.page, env, '#fffsRecv');
  await until(async () => (await B.page.inputValue('#fffsL-drone')) === '0.2');
  const hostile = JSON.parse(JSON.stringify(env)); (hostile.payload || hostile.data).master = 50; (hostile.payload || hostile.data).layers = {rain: 99, evil: 1};
  await recvFile(B.page, hostile, '#fffsRecv'); await until(async () => (await B.page.inputValue('#fffsL-rain')) === '1'); ok(+(await B.page.inputValue('#fffsMaster')) <= 0.6, 'volum limitat');
  ok(![A1, B].some((x) => x.errs.length || x.reqs.length), 'erori'); await A1.ctx.close(); await B.ctx.close();
});

/* ============ 4) Nucleu AI comun: trei fețe, același transport (cereri interceptate, fără rețea reală) ============ */
const sse = (objs) => objs.map((o) => 'data: ' + JSON.stringify(o) + '\n\n').join('') + 'data: [DONE]\n\n';
async function openAI(app, mock, init, arg) {
  const ctx = await browser.newContext({locale: 'en-US', viewport: {width: 1100, height: 900}}), seen = [], ext = [];
  await ctx.route(/^https?:/, async (r) => { const rq = r.request(), u = rq.url(); const m = mock(u, rq, seen); if (m) return r.fulfill(m); ext.push(u); r.abort(); });
  if (init) await ctx.addInitScript(init, arg);
  const page = await ctx.newPage(), errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(url(app)); await page.waitForFunction(() => window.FFF && FFF.ai, null, {timeout: 15000});
  await page.evaluate(() => { window.__aiCalls = 0; for (const k of ['run', 'stream']) { const o = FFF.ai[k]; FFF.ai[k] = function () { window.__aiCalls++; return o.apply(this, arguments); }; } });
  return {ctx, page, errs, seen, ext};
}
const apiMock = (seen) => (u, rq) => {
  const body = rq.postData() ? JSON.parse(rq.postData()) : null, h = rq.headers();
  if (u.startsWith('https://api.anthropic.com/v1/messages')) { seen.push({u, h, body}); return body.model === 'bad-model' ? {status: 404, contentType: 'application/json', body: '{"error":{"message":"nope"}}'} : {status: 200, contentType: 'text/event-stream', body: sse([{type: 'content_block_delta', delta: {type: 'text_delta', text: 'Bună '}}, {type: 'content_block_delta', delta: {type: 'text_delta', text: 'lume'}}])}; }
  if (/^https:\/\/api\.(openai|groq)\.com|^http:\/\/localhost:(1234|11434)/.test(u) && u.includes('/chat/completions')) { seen.push({u, h, body}); return {status: 200, contentType: 'text/event-stream', body: sse([{choices: [{delta: {content: 'Salut '}}]}, {choices: [{delta: {content: 'OpenAI'}}]}])}; }
  if (u.startsWith('https://generativelanguage.googleapis.com/')) { seen.push({u, h, body}); return {status: 200, contentType: 'application/json', body: JSON.stringify({candidates: [{content: {parts: [{text: 'Salut Google'}]}, finishReason: 'STOP'}]})}; }
  return null;
};
await T('ai: AI-Liber — streamAnthropic / streamOAI / callGoogle trec prin FFF.ai (antete, corp, text cumulat, 404 cu textul aplicației, cheia Google în antet)', async () => {
  const X = await openAI('AI-Liber', (u, rq, seen) => apiMock(seen)(u, rq));
  const r1 = await X.page.evaluate(async () => { const ch = []; const full = await streamAnthropic('claude-x', [{role: 'user', content: 'salut'}], 'sk-ant-1', (t) => ch.push(t)); return {full, ch}; });
  ok(r1.full === 'Bună lume' && r1.ch[r1.ch.length - 1] === 'Bună lume' && r1.ch[0] === 'Bună ', 'anthropic: ' + JSON.stringify(r1));
  const a = X.seen.find((x) => x.u.includes('anthropic')); ok(a.h['x-api-key'] === 'sk-ant-1' && a.h['anthropic-version'] === '2026-10-21' && a.body.max_tokens === 2000 && a.body.stream === true && typeof a.body.system === 'string' && a.body.system.length > 5 && a.body.messages[0].content === 'salut', JSON.stringify(a.body).slice(0, 200));
  const r2 = await X.page.evaluate(async () => streamOAI('https://api.groq.com/openai/v1/chat/completions', 'llama', [{role: 'user', content: 'hei'}], 'gsk-1', false, () => {})); ok(r2 === 'Salut OpenAI', r2);
  const o = X.seen.find((x) => x.u.includes('groq')); ok(o.h.authorization === 'Bearer gsk-1' && o.body.messages[0].role === 'system' && o.body.messages[1].content === 'hei' && o.body.max_tokens === 2000, JSON.stringify(o.body).slice(0, 160));
  const r3 = await X.page.evaluate(async () => callGoogle('gemini-x', [{role: 'user', content: 'hi'}], 'AIzaKEY')); ok(r3 === 'Salut Google', r3);
  const g = X.seen.find((x) => x.u.includes('googleapis')); ok(!g.u.includes('AIzaKEY') && g.h['x-goog-api-key'] === 'AIzaKEY' && g.body.generationConfig.maxOutputTokens === 2000, g.u);
  const e404 = await X.page.evaluate(async () => { try { await streamAnthropic('bad-model', [{role: 'user', content: 'x'}], 'k', () => {}); } catch (e) { return e.message; } }); ok(/Model 404/.test(e404), 'eroare 404: ' + e404);
  ok((await X.page.evaluate(() => window.__aiCalls)) === 4, 'toate cele 4 apeluri au trecut prin nucleu: ' + await X.page.evaluate(() => window.__aiCalls));
  ok(!X.errs.length && !X.ext.length, X.errs.concat(X.ext).join(';')); await X.ctx.close();
});
await T('ai: ARENA — openaiStream / anthropicStream (generatoare) trec prin FFF.ai; eroare HTTP în stilul ARENA; anulare tăcută', async () => {
  const X = await openAI('ARENA', (u, rq, seen) => apiMock(seen)(u, rq));
  const r1 = await X.page.evaluate(async () => { const out = []; for await (const d of openaiStream({baseUrl: 'http://localhost:11434/v1', model: 'm', apiKey: ''}, 'salut', new AbortController().signal)) out.push(d); return out; }); ok(JSON.stringify(r1) === '["Salut ","OpenAI"]', JSON.stringify(r1));
  const r2 = await X.page.evaluate(async () => { const out = []; for await (const d of anthropicStream({model: 'claude-x', apiKey: 'sk-ant-9'}, 'salut', new AbortController().signal)) out.push(d); return out.join(''); }); ok(r2 === 'Bună lume', r2);
  const a = X.seen.find((x) => x.u.includes('anthropic')); ok(a.body.max_tokens === 2048 && a.h['anthropic-version'] === '2026-10-21' && a.body.messages[0].content === 'salut', JSON.stringify(a.body));
  const err = await X.page.evaluate(async () => { try { for await (const d of anthropicStream({model: 'bad-model', apiKey: 'k'}, 'x', new AbortController().signal)); } catch (e) { return e.message; } }); ok(/^404 /.test(err), 'eroare: ' + err);
  const ab = await X.page.evaluate(async () => { const ac = new AbortController(); ac.abort(); const out = []; try { for await (const d of openaiStream({baseUrl: 'http://localhost:11434/v1', model: 'm'}, 'x', ac.signal)) out.push(d); } catch (e) { return 'aruncat ' + e.name; } return out.length; }); ok(ab === 0, 'anulare tăcută: ' + ab);
  ok((await X.page.evaluate(() => window.__aiCalls)) === 4, 'prin nucleu'); ok(!X.errs.length && !X.ext.length, X.errs.concat(X.ext).join(';')); await X.ctx.close();
});
await T('ai: Nexus — conversație prin interfață cu Anthropic, OpenAI și Google: text afișat, antete/corp corecte, nucleul folosit', async () => {
  const cfg = {providers: {anthropic: {apiKey: 'sk-ant-test', defaultModel: 'claude-x'}, openai: {apiKey: 'sk-oai-test', defaultModel: 'gpt-x'}, google: {apiKey: 'AIzaTEST', defaultModel: 'gemini-x'}}};
  const X = await openAI('Nexus-fara-frontiere', (u, rq, seen) => apiMock(seen)(u, rq), (c) => { try { localStorage.setItem('nexus:settings', JSON.stringify(c)); } catch (e) {} }, cfg);
  await X.page.evaluate(() => document.querySelector('#btn-new-conv') && 0);
  const turn = async (prov, expect) => { await X.page.evaluate(() => document.querySelector('#btn-new-conv').click()); await X.page.selectOption('#provider-select', prov); await X.page.fill('#input-text', 'salut ' + prov); await X.page.evaluate(() => document.querySelector('#btn-send').click());
    await X.page.waitForFunction((t) => document.body.innerText.includes(t) && !document.querySelector('#btn-send').disabled, expect, {timeout: 15000}); };
  await X.page.waitForSelector('#btn-new-conv');
  await turn('anthropic', 'Bună lume'); await turn('openai', 'Salut OpenAI'); await turn('google', 'Salut Google');
  const a = X.seen.find((x) => x.u.includes('anthropic')), o = X.seen.find((x) => x.u.includes('api.openai.com')), g = X.seen.find((x) => x.u.includes('googleapis'));
  ok(a.h['anthropic-version'] === '2026-10-21' && a.h['x-api-key'] === 'sk-ant-test' && !('temperature' in a.body), 'anthropic'); ok(o.h.authorization === 'Bearer sk-oai-test' && o.body.model === 'gpt-x' && o.body.stream === true && !('max_tokens' in o.body), JSON.stringify(o.body).slice(0, 200));
  ok(!g.u.includes('AIzaTEST') && g.h['x-goog-api-key'] === 'AIzaTEST' && g.body.contents[0].parts[0].text === 'salut google', JSON.stringify(g.body).slice(0, 200));
  ok((await X.page.evaluate(() => window.__aiCalls)) === 3, 'trei apeluri prin nucleu'); ok(!X.errs.length && !X.ext.length, X.errs.concat(X.ext).join(';')); await X.ctx.close();
});
/* ---------- motor de jocuri (FFF.games) ---------- */
const ATT = ['Domino-fara-frontiere', 'Table-fara-frontiere', 'Remi-fara-frontiere', 'Belot-fara-frontiere', 'Scopone-fara-frontiere', 'Profund', 'Mahjong-fara-frontiere', 'Carti-de-joc-fara-frontiere'];
await T('jocuri: Domino — partidă notată de mână → Elo, clasament, istoric; persistă după reîncărcare; rețea 0', async () => {
  const X = await open('Domino-fara-frontiere', null, () => window.FFF && FFF.games && document.getElementById('fffJgOpen'));
  await X.page.click('#fffJgOpen'); await X.page.fill('.c1a-dlg input[type=text] >> nth=0', 'Ana'); await X.page.fill('.c1a-dlg input[type=text] >> nth=1', 'Ion');
  await X.page.click('.c1a-dlg button:has-text("Record result")'); await X.page.waitForSelector('.c1a-dlg .c1a-ok');
  ok((await X.page.textContent('.c1a-dlg .c1a-ok')).includes('+20.0'), 'delta Elo afișat');
  await X.page.click('.c1a-dlg [role=tab]:has-text("Ladder")'); const rows = await X.page.locator('.c1a-dlg tbody tr').allTextContents(); ok(rows.length === 2 && rows[0].includes('Ana') && rows[0].includes('1220'), rows.join('|'));
  await X.page.click('.c1a-dlg [role=tab]:has-text("History")'); ok((await X.page.textContent('.c1a-dlg .c1a-list')).includes('Ana – Ion : 1–0'), 'istoric');
  await X.page.click('.c1a-x'); await X.page.reload(); await X.page.waitForSelector('#fffJgOpen'); await X.page.click('#fffJgOpen'); await X.page.click('.c1a-dlg [role=tab]:has-text("Ladder")');
  ok((await X.page.locator('.c1a-dlg tbody tr').count()) === 2, 'persistă'); ok(!X.reqs.length && !X.errs.length, X.reqs.concat(X.errs).join(';')); await X.ctx.close();
});
await T('jocuri: Domino — turneu hot-seat 3 jucători, rezultate manuale, câștigător, export JSON', async () => {
  const X = await open('Domino-fara-frontiere', null, () => window.FFF && FFF.games && document.getElementById('fffJgOpen'));
  await X.page.click('#fffJgOpen'); await X.page.click('.c1a-dlg [role=tab]:has-text("Tournament")');
  const P = '.c1a-dlg [role=tabpanel]:not([hidden]) input[type=text]'; await X.page.fill(P, 'Maria'); await X.page.click('.c1a-dlg button:has-text("Add person")'); await X.page.fill(P, 'Dan'); await X.page.click('.c1a-dlg button:has-text("Add person")');
  await X.page.click('.c1a-dlg button:has-text("Create tournament")'); await X.page.waitForSelector('.c1a-matches');
  for (let i = 0; i < 3; i++) await X.page.locator('.c1a-match').nth(i).locator('button:has-text("1–0")').first().click();
  await X.page.waitForSelector('.c1a-dlg .c1a-ok'); ok(!X.errs.length && !X.reqs.length, X.errs.concat(X.reqs).join(';'));
  const [dl] = await Promise.all([X.page.waitForEvent('download'), X.page.click('.c1a-dlg button:has-text("JSON")')]); const j = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); ok(j.players.length === 3 && j.matches.every((m) => m.res === 1), 'export');
  await X.ctx.close();
});
for (const app of ATT) await T('jocuri: ' + app + ' — buton „Turneu și Elo” prezent, hub se deschide fără erori, fără rețea', async () => {
  const X = await open(app, null, () => window.FFF && FFF.games && document.getElementById('fffJgOpen'));
  await X.page.click('#fffJgOpen'); await X.page.waitForSelector('.c1a-dlg[open] [role=tablist]'); ok((await X.page.locator('.c1a-dlg [role=tab]').count()) === 4, '4 tab-uri');
  ok(!X.errs.length && !X.reqs.length, X.errs.concat(X.reqs).join(';')); await X.ctx.close();
});
/*@@MORE@@*/
await browser.close();
const bad = results.filter((r) => !r[1]).length;
console.log(`\n${results.length - bad} ok, ${bad} eșuate`); process.exit(bad ? 1 : 0);
