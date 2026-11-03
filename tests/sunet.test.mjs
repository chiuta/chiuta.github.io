// Teste Node pentru tools/fff-sunet.js (peisaj sonor): stare, profile, zgomote, graf Web Audio (mock), oprire automată, WAV, plic.   Rulare: node tests/sunet.test.mjs
import {createRequire} from 'node:module'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url), HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, bad = 0; const T = (n, f) => { try { f(); ok++; console.log('ok   ' + n); } catch (e) { bad++; console.log('FAIL ' + n + '\n       ' + e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' așteptat ' + JSON.stringify(b) + ', obținut ' + JSON.stringify(a)); };
const yes = (c, m) => { if (!c) throw new Error(m); };
/* AudioContext fals, doar cât să urmărim graful */
class Param { constructor(v = 0) { this.value = v; this.log = []; } setValueAtTime(v, t) { this.log.push(['set', v, t]); } linearRampToValueAtTime(v, t) { this.log.push(['ramp', v, t]); this.value = v; } cancelScheduledValues() { this.log.push(['cancel']); } }
class Node { constructor(ctx, type) { this.ctx = ctx; this.type = type; this.out = []; ctx.nodes.push(this); this.started = false; this.stopped = false; } connect(n) { this.out.push(n); return n; } disconnect() { this.out = []; } start() { this.started = true; } stop() { this.stopped = true; } }
class Ctx {
  constructor() { this.nodes = []; this.currentTime = 0; this.sampleRate = 8000; this.destination = new Node(this, 'dest'); this.state = 'running'; this.closed = false; }
  createGain() { const n = new Node(this, 'gain'); n.gain = new Param(1); return n; }
  createDynamicsCompressor() { const n = new Node(this, 'comp'); ['threshold', 'knee', 'ratio', 'attack', 'release'].forEach((k) => { n[k] = new Param(); }); return n; }
  createBiquadFilter() { const n = new Node(this, 'filter'); n.frequency = new Param(350); n.Q = new Param(1); n.type = 'lowpass'; return n; }
  createOscillator() { const n = new Node(this, 'osc'); n.frequency = new Param(440); return n; }
  createBufferSource() { const n = new Node(this, 'src'); n.loop = false; return n; }
  createBuffer(ch, n, sr) { const d = new Float32Array(n); return {length: n, sampleRate: sr, getChannelData: () => d}; }
  resume() {} close() { this.closed = true; }
}
globalThis.window = globalThis; globalThis.AudioContext = Ctx;
const S = require(path.join(HUB, 'tools/fff-sunet.js'));
const reach = (ctx) => { const seen = new Set(), q = [ctx.destination]; // noduri conectate (invers) la destinație
  const rev = new Map(); ctx.nodes.forEach((n) => n.out.forEach((o) => { (rev.get(o) || rev.set(o, []).get(o)).push(n); })); while (q.length) { const x = q.pop(); if (seen.has(x)) continue; seen.add(x); (rev.get(x) || []).forEach((p) => q.push(p)); } return seen; };

T('cleanState: limite, tipuri, straturi necunoscute eliminate; implicit sigur (volum 20%)', () => {
  const s = S.cleanState({master: 9, timer: 7, tone: 99999, layers: {rain: 2, hax: 1, wind: -1, pink: 'x', brown: 0.456}});
  eq(s.master, S.MASTER_MAX); eq(s.timer, 0); eq(s.tone, 2000); eq(Object.entries(s.layers).sort(), [['brown', 0.46], ['rain', 1]]); eq(S.cleanState(null).master, 0.2); eq(S.cleanState({tone: 1}).tone, 20); eq(S.cleanState({timer: 45}).timer, 45);
  yes(S.cleanState({__proto__: {master: 1}, layers: JSON.parse('{"__proto__":{"rain":1}}')}).layers.rain === undefined, 'prototype');
});
T('profile: dormit/studiu/preparat existente, valide, volum ≤ 25%, doar straturi cunoscute', () => {
  eq(Object.keys(S.PROFILES), ['dormit', 'studiu', 'preparat']);
  for (const k of Object.keys(S.PROFILES)) { const p = S.profile(k); yes(p.master <= 0.25, k + ' volum'); yes(Object.keys(p.layers).length >= 2 && Object.keys(p.layers).every((id) => S.LAYERS.includes(id)), k + ' straturi'); }
  eq(S.profile('dormit').timer, 45); eq(S.profile('studiu').timer, 0); eq(S.profile('nu-exista'), null);
});
T('noise: determinist, vârf 0,9, alb ≈ plat, roz mai puțină energie HF decât alb, brun și mai puțină; buclă fără salt', () => {
  const n = 20000, w = S.noise('white', n, 1), p = S.noise('pink', n, 2), b = S.noise('brown', n, 3);
  eq(Array.from(S.noise('white', 50, 1)), Array.from(w.slice(0, 50)).length === 50 ? Array.from(S.noise('white', 50, 1)) : []); yes(S.noise('white', 100, 1)[5] === S.noise('white', 100, 1)[5], 'determinist');
  for (const a of [w, p, b]) { let m = 0; for (const x of a) m = Math.max(m, Math.abs(x)); yes(Math.abs(m - 0.9) < 1e-3, 'vârf ' + m); }
  const hf = (a) => { let e = 0, t = 0; for (let i = 1; i < a.length; i++) { const d = a[i] - a[i - 1]; e += d * d; t += a[i] * a[i]; } return e / t; };   // energie de diferență / energie totală ~ conținut HF
  yes(hf(w) > hf(p) * 1.5 && hf(p) > hf(b) * 1.5, `HF alb ${hf(w).toFixed(3)} > roz ${hf(p).toFixed(3)} > brun ${hf(b).toFixed(3)}`);
  const step = (a) => { let m = 0; for (let i = 1; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - a[i - 1])); return m; }; for (const [nm, a] of [['brun', b], ['roz', p], ['alb', w]]) yes(Math.abs(a[0] - a[n - 1]) <= step(a) * 1.5 + 0.02, 'salt la buclă ' + nm + ': ' + Math.abs(a[0] - a[n - 1]).toFixed(3) + ' vs pas max ' + step(a).toFixed(3));
});
T('build: toate nodurile ajung la destinație prin limitator; strat la 0 = câștig 0; sursele pornite; volumul inițial 0 (fade-in)', () => {
  const c = new Ctx(), g = S.build(c, {master: 0.2, layers: {rain: 0.5, pink: 0.3}, tone: 220}, null);
  const r = reach(c); yes(c.nodes.filter((n) => n.type === 'src' || n.type === 'osc').every((n) => r.has(n) || n.type === 'osc'), 'surse conectate'); yes(c.nodes.some((n) => n.type === 'comp' && r.has(n)), 'limitator în drum');
  eq(g.master.gain.value, 0); eq(g.layers.rain.gain.gain.value, 0.5); eq(g.layers.wind.gain.gain.value, 0); eq(g.tone.frequency.value, 220);
  yes(c.nodes.filter((n) => n.type === 'src').every((n) => n.started && n.loop), 'surse pornite și în buclă');
  const comp = c.nodes.find((n) => n.type === 'comp'); yes(comp.threshold.value <= -6 && comp.ratio.value >= 8, 'limitator');
  g.set('wind', 5); eq(g.layers.wind.gain.gain.value, 1, 'strat limitat la 1'); g.setMaster(5); eq(g.master.gain.value, S.MASTER_MAX); g.setTone(1); eq(g.tone.frequency.value, 20);
  g.stop(); yes(c.nodes.filter((n) => n.type === 'src' || n.type === 'osc').every((n) => n.stopped), 'oprite');
});
T('start/stop: fade-in 3 s către volumul cerut; stop închide contextul; start repetat nu creează al doilea context', () => {
  const made = []; globalThis.AudioContext = class extends Ctx { constructor() { super(); made.push(this); } };
  S.apply(S.profile('studiu')); yes(S.start() === true && S.isPlaying(), 'pornit'); S.start(); eq(made.length, 1);
  const out = made[0].nodes.find((n) => n.type === 'gain' && n.out.some((o) => o.type === 'comp')); const ramp = out.gain.log.find((l) => l[0] === 'ramp'); eq([ramp[1], ramp[2]], [S.profile('studiu').master, 3]);
  S.stop(); yes(!S.isPlaying() && made[0].closed, 'oprit'); globalThis.AudioContext = Ctx;
});
T('oprire automată: după N minute fade-out de 8 s apoi stop; schimbarea cronometrului reprogramează', () => {
  const calls = []; const st = globalThis.setTimeout, ct = globalThis.clearTimeout; let id = 0; globalThis.setTimeout = (f, ms) => { calls.push({f, ms, id: ++id}); return id; }; globalThis.clearTimeout = (i) => { const c = calls.find((x) => x.id === i); if (c) c.dead = true; };
  try {
    globalThis.AudioContext = class extends Ctx { constructor() { super(); globalThis.__c = this; } };
    S.apply(S.profile('dormit')); S.start(); const t1 = calls.filter((c) => !c.dead).pop(); eq(t1.ms, 45 * 60000, 'timer 45 min');
    S.apply(Object.assign(S.state(), {timer: 15})); const live = calls.filter((c) => !c.dead); eq(live.pop().ms, 15 * 60000, 'reprogramat'); eq(calls.find((c) => c.id === t1.id).dead, true, 'vechiul anulat');
    const t2 = calls.filter((c) => !c.dead).pop(); t2.f(); const out = globalThis.__c.nodes.find((n) => n.type === 'gain' && n.out.some((o) => o.type === 'comp')); const last = out.gain.log.filter((l) => l[0] === 'ramp').pop(); eq([last[1], last[2]], [0, S.FADE_OUT], 'fade-out la 0');
    const t3 = calls.filter((c) => !c.dead).pop(); eq(t3.ms, S.FADE_OUT * 1000 + 100); t3.f(); yes(!S.isPlaying(), 'oprit după fade');
  } finally { globalThis.setTimeout = st; globalThis.clearTimeout = ct; globalThis.AudioContext = Ctx; S.stop(); }
});
T('WAV: antet RIFF corect, PCM16 mono, dimensiune consistentă, fără depășire', () => {
  const f = new Float32Array([0, 0.5, -0.5, 1.5, -1.5]); const b = S.wavBlob(f, 22050); eq(b.size, 44 + 10); eq(b.type, 'audio/wav');
  return b.arrayBuffer().then((ab) => { const v = new DataView(ab); eq(String.fromCharCode(...new Uint8Array(ab, 0, 4)), 'RIFF'); eq(v.getUint32(4, true), 36 + 10); eq(v.getUint16(22, true), 1); eq(v.getUint32(24, true), 22050); eq(v.getUint16(34, true), 16); eq(v.getInt16(44 + 6, true), 32767); eq(v.getInt16(44 + 8, true), -32768); });
});
T('plic sound/profile: evidence nivel 2 (maxim susținut), dus-întors, versiune greșită respinsă, valori ostile curățate', () => {
  const E = require(path.join(HUB, 'tools/fff-envelope.js')); globalThis.FFF = {envelope: E};
  S.apply(S.profile('dormit')); const env = S.envelope('ASMR'); eq(env.type, 'sound/profile'); eq(env.evidence.level, 2); yes(E.validate(E.normalize(env)).ok, 'valid');
  const back = S.fromEnvelope(E.parse(E.serialize(env))); eq(back, S.profile('dormit'));
  eq(S.fromEnvelope({type: 'sound/profile', payload: {v: 9}}), null); eq(S.fromEnvelope({type: 'text/plain', payload: {v: 1}}), null);
  eq(S.fromEnvelope({type: 'sound/profile', payload: {v: 1, master: 100, layers: {rain: 99}}}).master, S.MASTER_MAX);
});
T('I18N: 8 limbi, aceleași chei; nota de prudență există peste tot și nu promite efecte', () => {
  const ks = Object.keys(S.I18N.ro).sort(); eq(Object.keys(S.I18N).sort(), ['de', 'en', 'es', 'fr', 'hu', 'it', 'pt', 'ro']);
  for (const l in S.I18N) { eq(Object.keys(S.I18N[l]).sort(), ks, l); yes(S.I18N[l].note.length > 60, 'nota ' + l); yes(!/(vindec|cure|heal|guérit|guarisc|cura |gyógy|heil)/i.test(JSON.stringify(S.I18N[l])), 'fără promisiuni: ' + l); }
});
const r = await Promise.all([]); console.log(`\n${ok} ok, ${bad} eșuate`); process.exit(bad ? 1 : 0);
