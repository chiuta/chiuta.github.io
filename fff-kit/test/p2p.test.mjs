// Teste fff-kit · FFF.p2p — două pagini/contexte în același Chromium schimbă oferta/răspunsul prin cod (rețea externă blocată).
// Steagurile Chromium de mai jos sunt DOAR pentru test (vezi docs/p2p.md): fără ele, în browsere reale conexiunea depinde de
// candidate host (aceeași rețea locală; adresele sunt ascunse prin mDNS) sau de un server STUN introdus de utilizator.
import {createRequire} from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
const require = createRequire('/opt/node-tools/package.json');
const {chromium} = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url)), K = path.resolve(here, '..') + '/';
const S = process.env.S || path.join(os.tmpdir(), 'fff-kit-test') + '/';
fs.mkdirSync(S, {recursive: true});
const AXE = (await import('./_axe.mjs')).AXE;   // FFF_AXE / AXE_PATH / pachetul axe-core
const OUT = process.env.P2P_OUT || S + 'p2p.results.json';
const DEMO = pathToFileURL(K + 'test/p2p-demo.html').href;
const I18N = {p2p: JSON.parse(fs.readFileSync(K + 'i18n/p2p.json', 'utf8')), qr: JSON.parse(fs.readFileSync(K + 'i18n/qr.json', 'utf8'))};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fffp2p-'));

let pass = 0, fail = 0; const results = {};
const ok = (cond, name, info) => { if (cond) pass++; else { fail++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info).slice(0, 600)); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const FLAGS = ['--allow-loopback-in-peer-connection', '--disable-features=WebRtcHideLocalIpsWithMdns'];
const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: FLAGS});
const externalReqs = [], errs = [], contexts = [];

async function mk(opts) {
  opts = opts || {};
  const b = opts.browser || browser;
  const ctx = await b.newContext({viewport: opts.viewport || {width: 1000, height: 800}, colorScheme: opts.colorScheme || 'light', reducedMotion: opts.reducedMotion || 'no-preference'});
  await ctx.route(/^https?:/, r => r.abort());
  ctx.on('request', r => { if (/^https?:/.test(r.url())) externalReqs.push(r.url()); });
  await ctx.addInitScript(i => { window.__I18N = i.i18n; if (i.dialog) window.__DIALOG_OPTS = i.dialog; if (i.noRtc) Object.defineProperty(window, 'RTCPeerConnection', {value: undefined, configurable: true}); }, {i18n: I18N, dialog: opts.dialog, noRtc: opts.noRtc});
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(DEMO);
  contexts.push(ctx);
  return page;
}
const D = (p, role) => p.locator('[data-role=' + role + ']');
async function openDialog(p) { await p.click('#p2p-open'); await D(p, 'p2p-dialog').waitFor(); }
async function optin(p) { await D(p, 'optin').check(); }

/** Conectează două pagini prin dialog (ofertă/răspuns lipite ca text). Returnează cronometrul. */
async function connectViaDialog(A, B) {
  const t0 = Date.now();
  await openDialog(A); await optin(A); await D(A, 'mode-host').click(); await D(A, 'gen-offer').click();
  await D(A, 'offer-out').waitFor(); const offer = await D(A, 'offer-out').inputValue();
  await openDialog(B); await optin(B); await D(B, 'mode-join').click();
  await D(B, 'offer-in').fill(offer); await D(B, 'gen-answer').click();
  await D(B, 'answer-out').waitFor(); const answer = await D(B, 'answer-out').inputValue();
  await D(A, 'answer-in').fill(answer); await D(A, 'connect').click();
  await Promise.all([A, B].map(p => p.waitForFunction(() => window.__game.ls && window.__game.session && window.__game.session.state === 'open', null, {timeout: 20000})));
  await Promise.all([A, B].map(p => D(p, 'p2p-dialog').waitFor({state: 'detached'})));
  return {offer, answer, ms: Date.now() - t0};
}
const board = p => p.evaluate(() => window.__game.board.join('|'));
const waitBoard = async (p, b) => { await p.waitForFunction(x => window.__game.board.join('|') === x, b, {timeout: 8000}).catch(() => {}); return board(p); };
async function rasterDecode(p, selector) {              // decodifică QR-ul SVG afișat (nu doar generat): SVG → imagine → FFF.qr.decode
  return p.evaluate(async sel => {
    const svg = document.querySelector(sel); const str = new XMLSerializer().serializeToString(svg);
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str); await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const c = cv.getContext('2d', {willReadFrequently: true}); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0);
    const r = FFF.qr.decode(c.getImageData(0, 0, cv.width, cv.height)); return r && r.text;
  }, selector);
}

/* ====================================================================== 1. API de nivel jos, ofertă/răspuns/canal ====================================================================== */
{
  const A = await mk(), B = await mk();
  const info = await A.evaluate(async () => {
    const s = await FFF.p2p.host(); window.s = s; window.msgs = []; s.on('message', m => msgs.push(m));
    const d = await FFF.p2p.decodeSignal(s.offer);
    return {offer: s.offer, kind: d.kind, sdpLines: d.sdp.split('\r\n').length, ice: s.iceServers, state: s.state, candidates: (d.sdp.match(/a=candidate/g) || []).length, rawLen: d.sdp.length};
  });
  ok(/^FFF1\.o\.z\./.test(info.offer), 'oferta: FFF1.o.z.<b64url> (deflate)', info.offer.slice(0, 20));
  ok(/^[A-Za-z0-9._-]+$/.test(info.offer), 'oferta: doar caractere sigure (base64url)');
  ok(info.kind === 'offer' && info.ice.length === 0, 'implicit: fără server ICE', info);
  ok(info.offer.length < info.rawLen, 'compresie reduce dimensiunea', {z: info.offer.length, raw: info.rawLen});
  const ans = await B.evaluate(async o => { const s = await FFF.p2p.join(o); window.s = s; window.msgs = []; s.on('message', m => msgs.push(m)); return {answer: s.answer, state: s.state}; }, info.offer);
  ok(/^FFF1\.a\.z\./.test(ans.answer), 'răspunsul: FFF1.a.z.<b64url>', ans.answer.slice(0, 20));
  await A.evaluate(async a => { window.openP = new Promise(r => s.on('open', r)); await s.accept(a); }, ans.answer);
  await Promise.all([A, B].map(p => p.waitForFunction(() => s.state === 'open', null, {timeout: 15000})));
  ok(true, 'canalul se deschide pe ambele părți');
  // mesaje JSON în ambele sensuri
  const payloads = [{a: 1}, {t: 'chat', text: 'Țară ăîâșț 😀 "ghilimele"'}, {nested: {x: [1, 2, {y: null}], z: true}}, {big: 'x'.repeat(30000)}];
  for (const m of payloads) await A.evaluate(m2 => s.send(m2), m);
  for (const m of payloads) await B.evaluate(m2 => s.send(m2), m);
  await B.waitForFunction(n => msgs.length >= n, payloads.length, {timeout: 8000}); await A.waitForFunction(n => msgs.length >= n, payloads.length, {timeout: 8000});
  const gotB = await B.evaluate(() => msgs), gotA = await A.evaluate(() => msgs);
  ok(JSON.stringify(gotB) === JSON.stringify(payloads) && JSON.stringify(gotA) === JSON.stringify(payloads), 'mesaje JSON identice A→B și B→A, în ordine');
  const lim = await A.evaluate(() => { const errs = []; s.on('error', e => errs.push(e.code)); return {tooBig: s.send({x: 'y'.repeat(70000)}), nul: s.send(null), str: s.send('text'), errs}; });
  ok(lim.tooBig === false && lim.nul === false && lim.str === false, 'send() refuză >64 KiB / non-obiect', lim);
  // intrări malformate: ignorate, fără excepții
  await A.evaluate(() => { const c = s.channel; c.send('nu e json'); c.send('[1,2]'); c.send('null'); c.send('"x"'); c.send('{"_fff":"necunoscut"}'); c.send(' '.repeat(70000)); });
  await sleep(300);
  const after = await B.evaluate(() => ({n: msgs.length, state: s.state}));
  ok(after.n === payloads.length && after.state === 'open', 'intrări malformate ignorate, sesiunea rămâne deschisă', after);
  // latență (ping/pong) și statistici
  await B.evaluate(() => { s.send({x: 1}); });
  const rtt = await A.evaluate(async () => { await new Promise(r => setTimeout(r, 2500)); return s.rtt; });
  ok(typeof rtt === 'number' && rtt >= 0 && rtt < 2000, 'heartbeat: RTT măsurat', rtt);
  results.lowLevel = {offerChars: info.offer.length, answerChars: ans.answer.length, rawSdpChars: info.rawLen, candidates: info.candidates, rttMs: rtt};
  // închidere curată
  const waitB = B.evaluate(() => new Promise(r => { s.on('close', why => r({why, state: s.state, ch: s.channel.readyState})); }));
  await A.evaluate(() => s.close());
  const cl = await Promise.race([waitB, sleep(5000).then(() => null)]);
  ok(cl && cl.why === 'remote' && cl.state === 'closed', 'închidere curată: partenerul primește close(remote)', cl);
  const stA = await A.evaluate(() => ({state: s.state, open: s.open, sendOk: s.send({a: 1})}));
  ok(stA.state === 'closed' && !stA.open && stA.sendOk === false, 'după close(): stare closed, send() = false', stA);
  await sleep(200);
  const chs = await Promise.all([A, B].map(p => p.evaluate(() => s.channel.readyState)));
  ok(chs.every(x => x === 'closed'), 'canale închise', chs);
  await A.evaluate(() => s.close()); // idempotent
  ok(true, 'close() repetat nu aruncă');
  await A.context().close(); await B.context().close();
}

/* ====================================================================== 2. validări de cod, STUN, tipuri greșite ====================================================================== */
{
  const A = await mk(), B = await mk();
  const r = await A.evaluate(async () => {
    const out = {};
    const s = await FFF.p2p.host(); const off = s.offer;
    const tryJoin = async c => { try { const x = await FFF.p2p.join(c); x.close(); return 'ok'; } catch (e) { return e.code + ':' + e.message; } };
    out.empty = await tryJoin(''); out.garbage = await tryJoin('abc'); out.prefixOnly = await tryJoin('FFF1.o.z.'); out.badB64 = await tryJoin('FFF1.o.z.@@@@');
    out.wrongKindJoinWithAnswer = await tryJoin(off.replace('FFF1.o.', 'FFF1.a.'));
    // coruperea unui caracter → eșec (suma de control zlib), nu SDP greșit acceptat
    let rejected = 0, accepted = 0, harmless = 0;   // «harmless»: biții de umplutură base64 din ultimul caracter nu schimbă conținutul decodat
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    for (let k = 0; k < 40; k++) {
      const i = 12 + Math.floor((off.length - 12) * (k + 0.5) / 40), ch = off[i], repl = alphabet[(alphabet.indexOf(ch) + 7) % 64];
      try { const d = await FFF.p2p.decodeSignal(off.slice(0, i) + repl + off.slice(i + 1)); if (d.sdp === (await FFF.p2p.decodeSignal(off)).sdp) harmless++; else accepted++; } catch (e) { if (e.code === 'bad-code') rejected++; }
    }
    out.corrupt = {rejected, accepted, harmless};
    // spații, linii noi și ghilimele în jurul codului sunt tolerate
    out.tolerant = (await FFF.p2p.decodeSignal('  "' + off.slice(0, 40) + '\n' + off.slice(40) + '"  ')).kind;
    // accept() cu ofertă în loc de răspuns
    try { await s.accept(off); out.acceptOffer = 'ok'; } catch (e) { out.acceptOffer = e.code; }
    out.stun = {ok: FFF.p2p.parseStun('stun:stun.example.org:3478, example.net'), none: FFF.p2p.parseStun('  '), v6: FFF.p2p.parseStun('stun:[2001:db8::1]:3478')};
    for (const bad of ['javascript:alert(1)', 'turn:x.example', 'stun:exa_mple!', 'http://a.b', 'stun:a.b:99999x', 'a,b,c,d']) { try { FFF.p2p.parseStun(bad); out.stun['bad:' + bad] = 'ok'; } catch (e) { out.stun['bad:' + bad] = e.code; } }
    try { await FFF.p2p.host({stun: 'javascript:alert(1)'}); out.hostBadStun = 'ok'; } catch (e) { out.hostBadStun = e.code + ':' + e.message; }
    const hs = await FFF.p2p.host({stun: 'stun.example.org:3478', gatherTimeout: 1500}).catch(e => ({err: e.code}));
    out.hostWithStun = hs.err || hs.iceServers; if (hs.close) hs.close();
    s.close();
    return out;
  });
  ok(['empty', 'garbage', 'prefixOnly', 'badB64'].every(k => /^bad-code:/.test(r[k]) && !/^bad-code:badCode$/.test(r[k])), 'coduri invalide → bad-code cu mesaj tradus', r);
  ok(/^wrong-kind:/.test(r.wrongKindJoinWithAnswer) || /^bad-code:/.test(r.wrongKindJoinWithAnswer), 'join() cu cod de tip răspuns este refuzat', r.wrongKindJoinWithAnswer);
  ok(r.corrupt.rejected + r.corrupt.harmless === 40 && r.corrupt.accepted === 0 && r.corrupt.harmless <= 1, 'un caracter corupt este întotdeauna detectat (40/40; cel mult un caracter de umplutură base64 inofensiv)', r.corrupt);
  ok(r.tolerant === 'offer', 'spații/linii noi/ghilimele tolerate la lipire', r.tolerant);
  ok(r.acceptOffer === 'wrong-kind', 'accept(ofertă) refuzat', r.acceptOffer);
  ok(JSON.stringify(r.stun.ok) === '["stun:stun.example.org:3478","stun:example.net"]' && r.stun.none.length === 0 && r.stun.v6.length === 1, 'parseStun: formate valide', r.stun);
  ok(Object.keys(r.stun).filter(k => k.startsWith('bad:')).every(k => r.stun[k] === 'stun-invalid'), 'parseStun: refuză scheme/forme nevalide', r.stun);
  ok(/^stun-invalid:/.test(r.hostBadStun), 'host({stun:nevalid}) respins', r.hostBadStun);
  ok(Array.isArray(r.hostWithStun) && r.hostWithStun[0] && JSON.stringify(r.hostWithStun[0].urls) === '["stun:stun.example.org:3478"]' || r.hostWithStun === 'no-candidates', 'STUN opt-in ajunge în configurația ICE', r.hostWithStun);
  results.validation = {corruptDetected: r.corrupt.rejected + '/40'};
  await A.context().close(); await B.context().close();
}

/* ====================================================================== 3. dialog complet + joc X și 0 + lockstep ====================================================================== */
let gameResults = {};
{
  const A = await mk(), B = await mk();
  // înainte de opt-in: butoanele sunt dezactivate, avertismentul este vizibil
  await openDialog(A);
  const w = await D(A, 'warning').innerText();
  ok(/IP/.test(w) && /NAT/.test(w), 'avertisment IP + limită NAT vizibile în dialog', w);
  ok(await D(A, 'mode-host').isDisabled() && await D(A, 'mode-join').isDisabled(), 'fără opt-in, Găzduiește/Alătură-te sunt dezactivate');
  ok(await D(A, 'stun').inputValue() === '', 'câmpul STUN este gol implicit');
  const lbl = await A.evaluate(() => document.querySelector('[data-role=p2p-dialog]').getAttribute('aria-labelledby'));
  ok(await A.evaluate(id => !!document.getElementById(id), lbl), 'dialog cu aria-labelledby valid', lbl);
  await A.keyboard.press('Escape');
  ok(await D(A, 'p2p-dialog').count() === 0, 'Escape închide dialogul');

  const conn = await connectViaDialog(A, B);
  ok(true, 'conectare prin dialog (text lipit) reușită, ' + conn.ms + ' ms');
  ok(/^FFF1\.o\.z\./.test(conn.offer) && /^FFF1\.a\.z\./.test(conn.answer), 'coduri din dialog în formatul FFF1');
  const roles = await Promise.all([A, B].map(p => p.evaluate(() => [__game.me, __game.session.role, __game.ls.seed])));
  ok(roles[0][0] === 'X' && roles[1][0] === 'O' && roles[0][2] === roles[1][2], 'roluri host=X/guest=0 și același seed', roles);
  const seqs = async () => (await Promise.all([A, B].map(p => p.evaluate(() => __game.ls.seq))));

  // joc: X(0) O(4) X(1) O(5) X(2) → X câștigă
  const click = (p, i) => p.click('#board button[data-i="' + i + '"]');
  await click(A, 0); await waitBoard(B, 'X||||||||');
  await click(B, 4); await waitBoard(A, 'X|||O||||');
  await click(A, 1); await click(B, 5); await click(A, 2);
  const exp = 'X|X|X||O|O|||';
  const bb = await Promise.all([waitBoard(A, exp), waitBoard(B, exp)]);
  ok(bb[0] === exp && bb[1] === exp, 'tablele coincid după 5 mutări', bb);
  await Promise.all([A, B].map(p => p.waitForFunction(() => __game.ls.seq === 5, null, {timeout: 5000}).catch(() => {})));
  ok((await seqs()).every(s => s === 5), 'seq = 5 pe ambele părți', await seqs());
  ok(/câștigat X/.test(await A.textContent('#status')) && /câștigat X/.test(await B.textContent('#status')), 'ambii văd câștigătorul');

  // validare: oaspetele nu poate muta când e rândul gazdei / după final
  await click(B, 8); await B.waitForFunction(() => /refuzată/.test(document.getElementById('status').textContent), null, {timeout: 4000}).catch(() => {});
  ok(/refuzată/.test(await B.textContent('#status')), 'mutare după final: refuzată de gazdă', await B.textContent('#status'));
  const st = await A.evaluate(() => __game.ls.stats);
  ok(st.rejected >= 1, 'gazda numără mutările respinse', st);

  // joc nou: RNG determinist, aceleași valori și același jucător care începe
  for (let k = 0; k < 3; k++) {
    await A.click('#newgame'); await A.waitForFunction(n => __game.rolls.length >= n, k + 1);
    await B.waitForFunction(n => __game.rolls.length >= n, k + 1);
    // termină repede jocul pentru următoarea rundă: jucătorul curent câștigă pe prima linie
    const q = {X: [0, 1, 2], O: [3, 4, 5]};
    for (let step = 0; step < 6; step++) {
      if (await A.evaluate(() => !!__game.winner)) break;
      const turn = await A.evaluate(() => __game.turn), p = turn === 'X' ? A : B, cell = q[turn].shift();
      const before = await A.evaluate(() => __game.log.length);
      await click(p, cell); await A.waitForFunction(n => __game.log.length > n, before);
    }
  }
  const rolls = await Promise.all([A, B].map(p => p.evaluate(() => __game.rolls)));
  ok(JSON.stringify(rolls[0]) === JSON.stringify(rolls[1]) && rolls[0].length === 3, 'RNG cu seed comun: aceleași 3 valori la ambii', rolls);
  results.rolls = rolls[0];
  gameResults.rolls = rolls[0];

  // pierdere de mesaj: B scapă un mesaj 'move' → următorul dezvăluie golul → cerere + reluare
  if (await A.evaluate(() => !!__game.winner)) await A.click('#newgame');
  await Promise.all([A, B].map(p => p.waitForFunction(() => !__game.winner, null, {timeout: 5000})));
  const startTurn = await A.evaluate(() => __game.turn);
  const hostPlays = startTurn === 'X';
  const first = hostPlays ? A : B, second = hostPlays ? B : A;
  await B.evaluate(() => { const ch = __game.session.channel, orig = ch.onmessage; window.__dropped = 0; window.__orig = orig; ch.onmessage = e => { try { if (window.__dropped < 1 && JSON.parse(e.data).t === 'move') { window.__dropped++; return; } } catch (er) { /* */ } orig(e); }; });
  await click(first, 3);                                  // mutare pierdută de B
  await sleep(300);
  await click(second, 4);                                 // B va vedea seq cu gol sau va fi el cel care așteaptă
  await sleep(300);
  await click(first, 5);
  await sleep(1200);
  const [bA, bB] = await Promise.all([board(A), board(B)]);
  ok(bA === bB, 'după un mesaj pierdut, tablele converg (reluare prin need/moves)', {bA, bB});
  const dropped = await B.evaluate(() => window.__dropped);
  ok(dropped === 1, 'mesajul a fost într-adevăr scăpat în test', dropped);
  await B.evaluate(() => { __game.session.channel.onmessage = window.__orig; });

  // divergență: B își strică local tabla → hash-ul de la gazdă detectează → resincronizare completă
  await B.evaluate(() => { __game.board[0] = 'Z'; __game.board[8] = 'Q'; });
  const turnNow = await A.evaluate(() => __game.turn);
  const mover = turnNow === 'X' ? A : B;
  // o celulă liberă
  const free = await A.evaluate(() => __game.board.findIndex(c => !c));
  const freeCell = free === 0 ? 1 : free === 8 ? 7 : free;
  await B.evaluate(() => { __game.board[0] = __game.board[0] === 'Z' ? '' : __game.board[0]; });
  await click(mover, await A.evaluate(() => __game.board.findIndex((c, i) => !c && i !== 8 && i !== 0)));
  void freeCell;
  await sleep(1500);
  const [cA, cB] = await Promise.all([board(A), board(B)]);
  ok(cA === cB, 'după stricarea locală a stării, hash-ul declanșează resincronizarea completă', {cA, cB});
  const rs = await B.evaluate(() => __game.ls.stats.resyncs), lg = await B.evaluate(() => __game.log.filter(x => x.startsWith('state:')));
  ok(rs >= 1 && lg.includes('state:resync'), 'oaspetele raportează resync (stats.resyncs, onState reason=resync)', {rs, lg});

  // mutare duplicată / seq vechi, mesaje false de la „gazdă”
  const dup = await A.evaluate(() => { const s = __game.session; const before = __game.board.join('|'); s.send({t: 'move', seq: 1, move: {i: 0}, from: 'host'}); s.send({t: 'move', seq: 9999, move: 'nu-obiect', from: 'host'}); s.send({t: 'sync', seq: -5, seed: 1}); s.send({t: 'moves', list: 'x'}); s.send({t: 'reject', cid: 12345}); return before; });
  await sleep(500);
  const afterDup = await board(B);
  ok(afterDup === dup && (await B.evaluate(() => __game.ls.stats.dupes)) >= 1, 'duplicate/valori false sunt ignorate (dupes numărat)', {afterDup, dup});

  // reconectare manuală: gazda joacă în timpul întreruperii, apoi rebind → oaspetele primește starea
  const ofr = await A.evaluate(async () => { __game.session.close('test'); const s2 = await __game.session.reconnect(); __game.session = s2; __game.ls.rebind(s2); return s2.offer; });
  const closedB = await B.evaluate(() => __game.session.state);
  ok(closedB === 'closed' || closedB === 'lost' || closedB === 'open', 'oaspetele observă închiderea (stare: ' + closedB + ')');
  await sleep(300);
  const freeNow = await A.evaluate(() => __game.board.findIndex(c => !c));
  const turnA = await A.evaluate(() => [__game.turn, __game.me, __game.winner]);
  let hostMoved = false;
  if (turnA[0] === turnA[1] && !turnA[2]) { await A.evaluate(i => __game.ls.move({i}).catch(() => {}), freeNow); hostMoved = true; }
  const ans2 = await B.evaluate(async o => { const s3 = await FFF.p2p.join(o); __game.session = s3; __game.ls.rebind(s3); return s3.answer; }, ofr);
  await A.evaluate(async a => { await __game.session.accept(a); }, ans2);
  await Promise.all([A, B].map(p => p.waitForFunction(() => __game.session.state === 'open', null, {timeout: 15000})));
  await sleep(800);
  const [dA, dB] = await Promise.all([board(A), board(B)]);
  ok(dA === dB, 'după reconectare + rebind(), starea de joc este aceeași (mutare făcută în întrerupere: ' + hostMoved + ')', {dA, dB});
  const sq = await seqs();
  ok(sq[0] === sq[1], 'seq egal după reconectare', sq);

  // axe + overflow pe pagina de joc conectată
  gameResults.reconnect = {hostMovedDuringOutage: hostMoved};
  await A.context().close(); await B.context().close();
}

/* ====================================================================== 4. QR: cadre succesive, citire din imagini, cameră doar la cerere ====================================================================== */
{
  const dialog = {single: 120, per: 140};
  const A = await mk({dialog}), B = await mk({dialog});
  await openDialog(A); await optin(A); await D(A, 'mode-host').click(); await D(A, 'gen-offer').click(); await D(A, 'offer-out').waitFor();
  const offer = await D(A, 'offer-out').inputValue();
  const nFrames = Math.ceil(offer.length / 140);
  const cap = async () => (await D(A, 'qr-caption').innerText());
  ok(nFrames > 1 && /1\D+\d+/.test(await cap()) && new RegExp('\\b' + nFrames + '\\b').test(await cap()), 'cod lung → cadre QR succesive „1 din n”', {nFrames, cap: await cap()});
  // auto-redare: după ~2,2 s legenda s-a schimbat; pauză o oprește
  const c0 = await cap(); await sleep(2300); const c1 = await cap();
  ok(c0 !== c1, 'cadrele avansează automat (mișcare permisă)', {c0, c1});
  await A.getByRole('button', {name: /Pauză/}).click(); const c2 = await cap(); await sleep(2000); ok(await cap() === c2, 'Pauză oprește avansarea');
  // fiecare cadru afișat se decodează din imagine; asamblare în ordine amestecată
  const frames = [];
  for (let i = 0; i < nFrames; i++) {
    const t = await rasterDecode(A, '[data-role=qr] svg'); frames.push(t);
    await A.getByRole('button', {name: 'Următorul'}).click();
  }
  const shown = await A.evaluate(() => FFF.p2p.frames);
  const asm = await A.evaluate(fr => { const a = FFF.p2p.assembler(); const order = fr.map((_, i) => i).reverse().sort((x, y) => (x * 7 % 5) - (y * 7 % 5)); let last; for (const i of order) last = a.add(fr[i]); const dupAdd = a.add(fr[0]); return {last, order, dupAdd: dupAdd.done}; }, frames);
  ok(frames.every(f => /^FQ1\./.test(f)) && asm.last.done && asm.last.code === offer, 'cadre QR decodate din imagine și asamblate (ordine amestecată) = oferta', {n: frames.length, order: asm.order});
  // cadre din alt cod nu se amestecă; cadru corupt nu produce cod
  const mix = await A.evaluate(fr => { const a = FFF.p2p.assembler(); a.add(fr[0]); const bad = fr[1].slice(0, -2) + 'AA'; const r = a.add(bad); let r2; for (let i = 2; i < fr.length; i++) r2 = a.add(fr[i]); return {r: r.done, r2: r2 && r2.done, corrupt: r2 && r2.corrupt}; }, frames);
  ok(mix.r2 === false && mix.corrupt === true, 'cadru corupt: asamblarea refuză (verificare id)', mix);

  // scrie cadrele ca PNG-uri și le „scanează” prin câmpul de fișiere al lui B
  const writeFrames = async (p, prefix) => {
    const urls = await p.evaluate(async () => { const out = []; for (const f of FFF.p2p.frames(document.querySelector('[data-role=offer-out],[data-role=answer-out]').value, window.__DIALOG_OPTS)) { const cv = FFF.qr.canvas(f, {scale: 5, margin: 4}); out.push(cv.toDataURL('image/png')); } return out; });
    return urls.map((u, i) => { const f = path.join(tmp, prefix + i + '.png'); fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); return f; });
  };
  const offerFiles = await writeFrames(A, 'offer');
  await openDialog(B); await optin(B); await D(B, 'mode-join').click();
  // o imagine fără QR → mesaj
  const blank = path.join(tmp, 'blank.png'); fs.writeFileSync(blank, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await D(B, 'scan-file').setInputFiles(blank); await B.waitForFunction(() => /QR/.test(document.querySelector('[data-role=status]').textContent), null, {timeout: 5000});
  ok(await D(B, 'offer-in').inputValue() === '', 'imagine fără QR: câmpul rămâne gol, mesaj în status', await D(B, 'status').innerText());
  // doar o parte din cadre → progres
  await D(B, 'scan-file').setInputFiles(offerFiles.slice(0, 1)); await sleep(500);
  ok(/1/.test(await D(B, 'status').innerText()) && await D(B, 'offer-in').inputValue() === '', 'progres parțial raportat', await D(B, 'status').innerText());
  await D(B, 'scan-file').setInputFiles(offerFiles.slice().reverse()); // toate, ordine inversă
  await B.waitForFunction(() => document.querySelector('[data-role=offer-in]').value.length > 50, null, {timeout: 8000});
  ok(await D(B, 'offer-in').inputValue() === offer, 'oferta reconstruită din imaginile cadrelor (fișiere, ordine inversă)');
  // camera: abia la apăsare; în mediul de test eșuează grațios, cu mesaj tradus
  ok(await D(B, 'video').isHidden(), 'camera/preview nu pornesc singure');
  await D(B, 'scan-cam').click();
  await B.waitForFunction(() => document.querySelector('[data-role=status]').getAttribute('role') === 'alert' || !document.querySelector('[data-role=scan-cam]').disabled, null, {timeout: 8000});
  await sleep(300);
  const camMsg = await D(B, 'status').innerText();
  ok(camMsg.length > 5 && !/^(denied|noCamera|insecure|cameraError)$/.test(camMsg) && await D(B, 'scan-cam').isEnabled() && await D(B, 'video').isHidden(), 'cameră indisponibilă: mesaj tradus, UI revine', camMsg);
  await D(B, 'gen-answer').click(); await D(B, 'answer-out').waitFor();
  const answer = await D(B, 'answer-out').inputValue();
  const aFramesN = await B.evaluate(() => FFF.p2p.frames(document.querySelector('[data-role=answer-out]').value, window.__DIALOG_OPTS).length);
  ok(aFramesN > 1, 'răspunsul apare tot în cadre succesive', aFramesN);
  const ansFiles = await writeFrames(B, 'answer');
  await D(A, 'answer-in').waitFor();
  await D(A, 'scan-file').setInputFiles(ansFiles);
  await A.waitForFunction(() => document.querySelector('[data-role=answer-in]').value.length > 50, null, {timeout: 8000});
  ok(await D(A, 'answer-in').inputValue() === answer, 'răspunsul reconstruit din imagini');
  await D(A, 'connect').click();
  await Promise.all([A, B].map(p => p.waitForFunction(() => window.__game.ls && window.__game.session.state === 'open', null, {timeout: 20000})));
  await A.click('#board button[data-i="4"]'); const bq = await waitBoard(B, '||||X||||');
  ok(bq === '||||X||||', 'conectare întreagă prin cadre QR din imagini + prima mutare');
  results.qrFlow = {offerChars: offer.length, frames: nFrames, answerFrames: aFramesN};
  await A.context().close(); await B.context().close();
}

/* ====================================================================== 5. un singur QR când încape; decodat din SVG-ul afișat ====================================================================== */
{
  const A = await mk();
  await openDialog(A); await optin(A); await D(A, 'mode-host').click(); await D(A, 'gen-offer').click(); await D(A, 'offer-out').waitFor();
  const offer = await D(A, 'offer-out').inputValue();
  const single = offer.length <= 600;
  const t = await rasterDecode(A, '[data-role=qr] svg');
  ok(single ? t === offer : /^FQ1\./.test(t), 'QR afișat se decodează din imagine: ' + (single ? 'cod unic = oferta' : 'cadru'), {len: offer.length, t: (t || '').slice(0, 30)});
  ok(single ? await D(A, 'qr-caption').count() === 0 : true, 'cod unic: fără carusel');
  results.singleQr = {offerChars: offer.length, singleFrame: single};
  await A.context().close();
}

/* ====================================================================== 6. refuz grațios fără RTCPeerConnection ====================================================================== */
{
  const A = await mk({noRtc: true});
  const r = await A.evaluate(async () => {
    const out = {supported: FFF.p2p.supported(), type: typeof RTCPeerConnection};
    try { await FFF.p2p.host(); out.host = 'ok'; } catch (e) { out.host = e.code + ':' + e.message; }
    try { await FFF.p2p.join('FFF1.o.z.xx'); out.join = 'ok'; } catch (e) { out.join = e.code; }
    return out;
  });
  ok(r.supported === false && /^unsupported:/.test(r.host) && r.join === 'unsupported' && r.host !== 'unsupported:unsupported', 'fără RTCPeerConnection: supported()=false, host()/join() refuză cu mesaj tradus', r);
  await openDialog(A);
  const un = await D(A, 'unsupported').innerText();
  ok(/WebRTC/.test(un) && await D(A, 'mode-host').count() === 0 && await D(A, 'optin').count() === 0, 'dialog: mesaj de refuz, fără Găzduiește/Alătură-te', un);
  ok(await A.evaluate(() => document.querySelector('[data-role=unsupported]').getAttribute('role')) === 'alert', 'mesajul de refuz are role=alert');
  await D(A, 'close').click(); ok(await D(A, 'p2p-dialog').count() === 0, 'dialogul de refuz se închide');
  // limbile: același mesaj în toate cele 8 limbi
  const langs = await A.evaluate(() => ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de'].map(l => { document.documentElement.lang = l; return FFF.t('p2p', 'unsupported'); }));
  ok(new Set(langs).size === 8, '8 limbi distincte pentru mesajul de refuz', langs);
  await A.context().close();
}

/* ====================================================================== 7. heartbeat: lost / recovered / timeout ====================================================================== */
{
  const A = await mk(), B = await mk();
  const hb = {interval: 100, timeout: 500, giveUp: 1500};
  const offer = await A.evaluate(async hb => { const s = await FFF.p2p.host({heartbeat: hb}); window.s = s; window.ev = []; ['lost', 'recovered', 'open'].forEach(e => s.on(e, () => ev.push(e))); s.on('close', w => ev.push('close:' + w)); return s.offer; }, hb);
  const answer = await B.evaluate(async o => { const s = await FFF.p2p.join(o); window.s = s; return s.answer; }, offer);
  await A.evaluate(a => s.accept(a), answer);
  await Promise.all([A, B].map(p => p.waitForFunction(() => s.state === 'open', null, {timeout: 15000})));
  await A.evaluate(() => { window.__h = s.channel.onmessage; s.channel.onmessage = null; });      // A nu mai primește nimic (partener „mut”)
  await A.waitForFunction(() => ev.includes('lost'), null, {timeout: 6000}).catch(() => {});
  ok(await A.evaluate(() => s.state) === 'lost' || (await A.evaluate(() => ev)).includes('lost'), 'tăcere → stare „lost”', await A.evaluate(() => ev));
  await A.evaluate(() => { s.channel.onmessage = window.__h; });                                   // traficul revine înainte de giveUp
  await A.waitForFunction(() => ev.includes('recovered'), null, {timeout: 4000}).catch(() => {});
  const ev1 = await A.evaluate(() => ev);
  ok(ev1.includes('recovered') && await A.evaluate(() => s.state) === 'open', 'trafic reluat → „recovered”, stare open', ev1);
  await A.evaluate(() => { s.channel.onmessage = null; });                                         // tăcere lungă → renunțare
  await A.waitForFunction(() => ev.some(x => x.startsWith('close:')), null, {timeout: 8000}).catch(() => {});
  const ev2 = await A.evaluate(() => ({ev, state: s.state}));
  ok(ev2.ev.includes('close:timeout') && ev2.state === 'failed', 'tăcere prelungită → close(timeout), stare failed', ev2);
  await A.context().close(); await B.context().close();
}

/* ====================================================================== 8. accesibilitate, contrast, tastatură, overflow, mișcare redusă ====================================================================== */
{
  const axeSrc = fs.readFileSync(AXE, 'utf8');
  const runAxe = async p => { await p.addScriptTag({content: axeSrc}); await sleep(3600); return p.evaluate(async () => { const r = await axe.run(document, {resultTypes: ['violations']}); return r.violations.map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')); }); };
  const overflow = p => p.evaluate(() => { const d = document.querySelector('dialog'); return {doc: document.documentElement.scrollWidth - innerWidth, dlg: d ? d.scrollWidth - d.clientWidth : 0}; });
  const axeResults = {};
  for (const scheme of ['light', 'dark']) for (const vp of [{width: 1280, height: 800}, {width: 360, height: 740}]) {
    const tag = scheme + '@' + vp.width;
    const A = await mk({colorScheme: scheme, viewport: vp, dialog: {single: 120, per: 140}});
    await openDialog(A);
    let v = await runAxe(A); axeResults[tag + ' inițial'] = v; ok(v.length === 0, 'axe 0 violări: dialog inițial ' + tag, v);
    let o = await overflow(A); ok(o.doc <= 0 && o.dlg <= 1, 'fără depășire orizontală (inițial) ' + tag, o);
    await optin(A); await D(A, 'mode-host').click(); await D(A, 'gen-offer').click(); await D(A, 'offer-out').waitFor();
    v = await runAxe(A); axeResults[tag + ' găzduiește+QR'] = v; ok(v.length === 0, 'axe 0 violări: Găzduiește + cadre QR ' + tag, v);
    o = await overflow(A); ok(o.doc <= 0 && o.dlg <= 1, 'fără depășire orizontală (găzduiește) ' + tag, o);
    await D(A, 'mode-join').click();
    v = await runAxe(A); axeResults[tag + ' alătură-te'] = v; ok(v.length === 0, 'axe 0 violări: Alătură-te ' + tag, v);
    o = await overflow(A); ok(o.doc <= 0 && o.dlg <= 1, 'fără depășire orizontală (alătură-te) ' + tag, o);
    await A.context().close();
  }
  const U = await mk({noRtc: true}); await openDialog(U);
  const vu = await runAxe(U); ok(vu.length === 0, 'axe 0 violări: dialog de refuz', vu); axeResults.unsupported = vu; await U.context().close();
  results.axe = axeResults;

  // tastatură: Tab parcurge elementele, focus vizibil, Space pe checkbox activează butoanele
  const K1 = await mk(); await openDialog(K1);
  await K1.evaluate(() => document.activeElement && document.activeElement.blur());
  const order = []; for (let i = 0; i < 6; i++) { await K1.keyboard.press('Tab'); order.push(await K1.evaluate(() => document.activeElement.getAttribute('data-role') || document.activeElement.tagName)); }
  ok(order.includes('optin') && order.includes('stun'), 'tastatură: Tab ajunge la opt-in și STUN', order);
  await D(K1, 'optin').focus(); await K1.keyboard.press('Space');
  ok(await D(K1, 'mode-host').isEnabled(), 'tastatură: Space pe opt-in activează butoanele');
  await D(K1, 'mode-host').focus(); await K1.keyboard.press('Enter'); await D(K1, 'gen-offer').waitFor();
  await K1.keyboard.press('Enter'); await D(K1, 'offer-out').waitFor();
  ok(true, 'tastatură: Enter parcurge Găzduiește → Generează oferta');
  const minSize = await K1.evaluate(() => [...document.querySelectorAll('dialog button, dialog input[type=checkbox]')].filter(b => b.offsetParent !== null).map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }).reduce((a, b) => Math.min(a, b), 999));
  ok(minSize >= 24, 'ținte tactile ≥ 24 px', minSize);
  await K1.context().close();

  // prefers-reduced-motion: cadrele nu avansează singure
  const R = await mk({reducedMotion: 'reduce', dialog: {single: 120, per: 140}}); await openDialog(R); await optin(R); await D(R, 'mode-host').click(); await D(R, 'gen-offer').click(); await D(R, 'offer-out').waitFor();
  const r0 = await D(R, 'qr-caption').innerText(); await sleep(2600);
  ok(await D(R, 'qr-caption').innerText() === r0, 'prefers-reduced-motion: carusel fără avansare automată', r0);
  await R.context().close();
}

/* ====================================================================== 9. rețea, erori, fără conectare fără steaguri (informativ) ====================================================================== */
{
  // informativ: fără steagurile de test, în acest mediu, conexiunea prin host candidates (mDNS) se stabilește?
  const plain = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const A = await mk({browser: plain}), B = await mk({browser: plain});
  const res = {};
  try {
    const offer = await A.evaluate(async () => { const s = await FFF.p2p.host({gatherTimeout: 3000}); window.s = s; return s.offer; });
    res.offerCandidates = await A.evaluate(async () => ((await FFF.p2p.decodeSignal(s.offer)).sdp.match(/a=candidate:[^\r]*/g) || []).map(x => x.split(' ')[4].replace(/[0-9a-f-]{8,}\.local/, '<uuid>.local')));
    const ans = await B.evaluate(async o => { const s = await FFF.p2p.join(o, {gatherTimeout: 3000}); window.s = s; return s.answer; }, offer);
    await A.evaluate(a => s.accept(a), ans);
    await Promise.all([A, B].map(p => p.waitForFunction(() => s.state === 'open', null, {timeout: 12000})));
    res.connectedWithoutFlags = true;
  } catch (e) { res.connectedWithoutFlags = false; res.reason = String(e.message).slice(0, 120); }
  results.withoutTestFlags = res;
  await A.context().close(); await B.context().close(); await plain.close();
}

ok(errs.length === 0, '0 pageerror', errs);
ok(externalReqs.length === 0, '0 cereri de rețea externe în toate testele', externalReqs);
await browser.close();
fs.rmSync(tmp, {recursive: true, force: true});
results.game = gameResults;
results.summary = {pass, fail};
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(`p2p.test: ${pass} reușite, ${fail} eșuate`);
process.exit(fail ? 1 : 0);
