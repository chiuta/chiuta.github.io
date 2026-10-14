import {loadKit, ok, eq, done} from './_node.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function mockEnv({voices, bugLen = 200} = {}) {
  const spoken = [], calls = [];
  class U { constructor(t) { this.text = t; this.voice = null; this.lang = ''; this.rate = 1; } }
  const V = voices || [
    {name: 'Ioana', lang: 'ro-RO', voiceURI: 'ioana', localService: true, default: false},
    {name: 'Google RO', lang: 'ro-RO', voiceURI: 'g-ro', localService: false, default: false},
    {name: 'Alex', lang: 'en-US', voiceURI: 'alex', localService: true, default: true}];
  let queue = [], cur = null, paused = false, ev = {};
  const synth = {
    getVoices: () => V, speaking: false,
    addEventListener(t, f) { (ev[t] = ev[t] || []).push(f); }, removeEventListener(t, f) { ev[t] = (ev[t] || []).filter(x => x !== f); },
    speak(u) { calls.push('speak'); queue.push(u); pump(); },
    cancel() { calls.push('cancel'); const c = cur; queue = []; cur = null; synth.speaking = false; if (c && c.onerror) c.onerror({error: 'interrupted'}); },
    pause() { calls.push('pause'); paused = true; }, resume() { calls.push('resume'); paused = false; pump(); },
    _fire(t) { (ev[t] || []).forEach(f => f()); }
  };
  function pump() {
    if (cur || paused || !queue.length) return;
    cur = queue.shift(); synth.speaking = true; const u = cur;
    const fire = () => {
      if (cur !== u) return;
      if (paused) return void setTimeout(fire, 1);
      if (u.text.length > bugLen) { return; }             // simulează blocarea Chromium la texte lungi: onend nu vine niciodată
      if (u.onstart) u.onstart({}); spoken.push({text: u.text, voice: u.voice && u.voice.name, rate: u.rate, lang: u.lang});
      cur = null; synth.speaking = false; if (u.onend) u.onend({}); pump();
    };
    setTimeout(fire, 1);
  }
  globalThis.SpeechSynthesisUtterance = U; globalThis.speechSynthesis = synth;
  return {spoken, calls, synth};
}

// ---------- fără suport ----------
let F = loadKit(['tts']); delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance;
ok(!F.tts.supported(), 'unsupported detectat');
let r = await F.tts.speak('Salut'); eq([r.ok, r.reason], [false, 'unsupported'], 'degradare grațioasă'); ok(/browser/i.test(r.message), 'mesaj tradus (ro)'); eq(F.tts.voices('ro'), [], 'voices gol');

// ---------- împărțire ----------
F = loadKit(['tts']); let env = mockEnv();
eq(F.tts.split('Bună ziua. Ce faci? Foarte bine!'), ['Bună ziua.', 'Ce faci?', 'Foarte bine!'], 'propoziții');
eq(F.tts.split('Dr. Popescu a venit la ora 3.14 pe str. Mare nr. 5. Apoi a plecat.'), ['Dr. Popescu a venit la ora 3.14 pe str. Mare nr. 5.', 'Apoi a plecat.'], 'abrevieri și zecimale');
eq(F.tts.split('Prima linie\n\nA doua linie'), ['Prima linie', 'A doua linie'], 'linii noi');
eq(F.tts.split('  ...  '), [], 'fără litere -> nimic');
const long = ('cuvânt '.repeat(300)).trim();                      // 2100 caractere, fără punct
const ch = F.tts.split(long, 180); ok(ch.length >= 12 && ch.every(c => c.length <= 180), 'text fără punctuație tăiat ≤180: max=' + Math.max(...ch.map(c => c.length)));
eq(ch.join(' '), long, 'nu se pierde text');
const cm = F.tts.split('a'.repeat(50) + ', ' + 'b'.repeat(50) + ', ' + 'c'.repeat(50) + ', ' + 'd'.repeat(50), 120); ok(cm.length === 2 && cm.every(c => c.length <= 120), 'tăiere la virgule');

// ---------- voci ----------
eq(F.tts.voices('ro').map(v => v.name), ['Ioana'], 'doar voci locale implicit');
eq(F.tts.voices('ro', {allowRemote: true}).map(v => v.name), ['Ioana', 'Google RO'], 'voci online la cerere, locale primele');
eq(F.tts.voices('en').map(v => v.name), ['Alex'], 'filtru limbă'); eq(F.tts.voices('ro-RO').length, 1, 'ro-RO');

// ---------- coadă pe text lung (bug simulat > 200 caractere) ----------
const text = Array.from({length: 40}, (_, i) => `Aceasta este propoziția numărul ${i + 1}, scrisă pentru a umple coada de citire.`).join(' ');
ok(text.length > 2500, 'text lung ' + text.length);
r = await F.tts.speak(text, {lang: 'ro'});
eq([r.ok, r.chunks], [true, 40], 'toate cele 40 de propoziții citite fără blocaj');
eq(env.spoken.length, 40, 'număr utterance'); ok(env.spoken.every(s => s.voice === 'Ioana' && s.lang === 'ro-RO'), 'voce locală ro aleasă');
ok(env.spoken.every(s => s.text.length <= 180), 'bucăți scurte');
// verificare: fără împărțire, mock-ul s-ar bloca (dovada că testul prinde bug-ul)
env.spoken.length = 0; let blocked = true;
const u = new SpeechSynthesisUtterance(text); u.onend = () => { blocked = false; }; speechSynthesis.speak(u); await sleep(30); ok(blocked, 'mock: textul întreg ar bloca');
speechSynthesis.cancel();

// ---------- pauză / reluare / oprire / viteză ----------
env = mockEnv(); F = loadKit(['tts']);
let p = F.tts.speak(text, {lang: 'ro', rate: 1.5}); await sleep(10);
eq(F.tts.state(), 'speaking', 'stare speaking'); ok(F.tts.pause(), 'pause'); eq(F.tts.state(), 'paused', 'stare paused');
const n0 = env.spoken.length; await sleep(20); eq(env.spoken.length, n0, 'în pauză nu avansează'); ok(env.calls.includes('pause'), 'synth.pause apelat');
ok(F.tts.resume(), 'resume'); await sleep(20); ok(env.spoken.length > n0, 'după reluare avansează');
ok(env.spoken.every(s => s.rate === 1.5), 'viteza din opțiuni');
F.tts.setRate(2); await sleep(10); ok(env.spoken.at(-1).rate === 2, 'setRate se aplică din bucata următoare/curentă'); eq(F.store.get('tts.rate'), 2, 'viteza persistată');
F.tts.stop(); r = await p; eq([r.ok, r.stopped], [true, true], 'stop rezolvă promisiunea'); eq(F.tts.state(), 'idle', 'idle după stop');
const cnt = env.spoken.length; await sleep(15); eq(env.spoken.length, cnt, 'după stop nu mai citește');
// speak nou întrerupe pe cel vechi
env = mockEnv(); F = loadKit(['tts']);
const p1 = F.tts.speak(text, {lang: 'ro'}); await sleep(5); const p2 = F.tts.speak('Scurt.', {lang: 'ro'});
const [r1, r2] = await Promise.all([p1, p2]); ok(r1.stopped && r2.ok, 'al doilea speak oprește primul');

// ---------- fără voce pentru limbă ----------
r = await F.tts.speak('Szia', {lang: 'hu'}); eq([r.ok, r.reason], [false, 'no-voice'], 'fără voce hu'); ok(r.message.includes('hu'), 'mesaj cu limba');
// voce explicită după nume + eroare reală
r = await F.tts.speak('Hello world.', {lang: 'en', voice: 'Alex'}); eq(r.ok, true, 'voce după nume');
// eroare din motor
env = mockEnv(); F = loadKit(['tts']); const o = speechSynthesis.speak; speechSynthesis.speak = u => setTimeout(() => u.onerror({error: 'synthesis-failed'}), 1);
r = await F.tts.speak('Test.', {lang: 'ro'}); eq([r.ok, r.reason], [false, 'error'], 'eroare motor -> rezultat, fără excepție'); speechSynthesis.speak = o;
// niciun apel de rețea în modul
ok(!/fetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test((await import('node:fs')).readFileSync(new URL('../src/tts.js', import.meta.url), 'utf8')), 'fără API de rețea în sursă');
done('tts');
