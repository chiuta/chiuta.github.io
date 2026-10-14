import fs from 'node:fs';
import {loadKit, ok, eq, done, kitDir} from './_node.mjs';
import {ex, low, cnpMake, ibanMake, luhnMake, luhnOk} from './pii-dataset.mjs';
const F = loadKit(['pii']);
const heldout = fs.existsSync(new URL('./pii-heldout.mjs', import.meta.url)) ? (await import('./pii-heldout.mjs')).ex : [];

function iou(a, b) { const i = Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0])); return i / ((a[1] - a[0]) + (b[1] - b[0]) - i); }
function evaluate(set, minConfidence) {
  const per = {}, T = t => per[t] = per[t] || {tp: 0, fp: 0, fn: 0}, fails = [];
  for (const e of set) {
    const found = F.pii.scan(e.text, {minConfidence}), used = new Set();
    for (const l of e.labels) {
      const s = e.text.indexOf(l.value), span = [s, s + l.value.length];
      const k = found.findIndex((f, i) => !used.has(i) && f.type === l.type && iou([f.start, f.end], span) >= 0.5);
      if (k >= 0) { used.add(k); T(l.type).tp++; } else { T(l.type).fn++; fails.push(['FN', l.type, l.value, e.text]); }
    }
    found.forEach((f, i) => { if (!used.has(i)) { T(f.type).fp++; fails.push(['FP', f.type, f.value, e.text]); } });
  }
  return {per, fails};
}
function summarize(per, types) {
  let tp = 0, fp = 0, fn = 0; const out = {};
  for (const t of Object.keys(per)) { if (types && !types.includes(t)) continue; const p = per[t]; tp += p.tp; fp += p.fp; fn += p.fn;
    out[t] = {tp: p.tp, fp: p.fp, fn: p.fn, precision: p.tp + p.fp ? +(p.tp / (p.tp + p.fp)).toFixed(3) : null, recall: p.tp + p.fn ? +(p.tp / (p.tp + p.fn)).toFixed(3) : null}; }
  return {total: {tp, fp, fn, precision: tp + fp ? +(tp / (tp + fp)).toFixed(3) : null, recall: tp + fn ? +(tp / (tp + fn)).toFixed(3) : null}, per_type: out};
}

// ---- sănătatea setului: generatoarele independente confirmă ce pretinde eticheta ----
ok(ex.length + generated() >= 150, 'set ≥ 150 exemple: ' + ex.length);
function generated() { return 0; }
ok(luhnOk('4111111111111111') && !luhnOk('4111111111111112'), 'luhn independent');
eq(ibanMake('RO', 'AAAA1B31007593840000'), 'RO49AAAA1B31007593840000', 'IBAN generat independent = cel din documentație');
eq(ibanMake('DE', '370400440532013000'), 'DE89370400440532013000', 'IBAN DE independent');

// ---- validatori direct ----
const V = F.pii.validators;
ok(V.iban('RO49 AAAA 1B31 0075 9384 0000') && !V.iban('RO49 AAAA 1B31 0075 9384 0001'), 'IBAN mod 97');
ok(!V.iban('RO49 AAAA 1B31 0075 9384'), 'IBAN lungime pe țară');
ok(V.cnp(cnpMake(1, '85', '06', '12', '40', '123')) && !V.cnp(cnpMake(1, '85', '06', '12', '77', '123')), 'CNP județ');
ok(!V.cnp(cnpMake(1, '85', '02', '29', '40', '123')), 'CNP 29 feb 1985 invalid'); ok(V.cnp(cnpMake(1, '84', '02', '29', '40', '123')), 'CNP 29 feb 1984 valid');
ok(!V.cnp(cnpMake(5, '99', '01', '01', '40', '123'), new Date(2026, 9, 14)), 'CNP din viitor invalid');

// ---- măsurare ----
const R = {};
const main = evaluate(ex.filter(e => !e.labels.some(l => l.type === 'name') && !/nume/.test('') ), 0.5);
const structured = ['email', 'phone', 'iban', 'cnp', 'card', 'ip', 'secret', 'url', 'address'];
const dev = evaluate(ex, 0.5);
R.dev_n = ex.length; R.dev = summarize(dev.per, structured); R.dev_names_cue = summarize(dev.per, ['name']);
const lo = evaluate(low, 0.2); R.low_names_n = low.length; R.low_names = summarize(lo.per, ['name']);
let hold = null; if (heldout.length) { const h = evaluate(heldout, 0.5); R.heldout_n = heldout.length; R.heldout = summarize(h.per, structured); R.heldout_names_cue = summarize(h.per, ['name']); hold = h; }
console.log(JSON.stringify(R, null, 1));
const showFails = process.argv.includes('--fails');
if (showFails) { console.log('--- dev'); dev.fails.forEach(f => console.log(f.join(' | '))); console.log('--- low'); lo.fails.forEach(f => console.log(f.join(' | '))); if (hold) { console.log('--- heldout'); hold.fails.forEach(f => console.log(f.join(' | '))); } }
fs.writeFileSync(new URL('./pii-metrics.json', import.meta.url), JSON.stringify(R, null, 1));

const lo4 = evaluate(low, 0.4); R.low_names_lexicon_threshold = summarize(lo4.per, ['name']);
ok(R.dev.total.precision >= 0.95 && R.dev.total.recall >= 0.9, 'dev P/R'); ok(R.heldout.total.precision >= 0.95 && R.heldout.total.recall >= 0.9, 'heldout P/R');
ok(R.dev_names_cue.total.precision >= 0.9 && R.dev_names_cue.total.recall >= 0.9, 'nume cu indiciu');
// ---- mask ----
const t = 'Scrie la ion.popescu@exemplu.ro, tel 0722 123 456, IBAN RO49 AAAA 1B31 0075 9384 0000.';
const fs1 = F.pii.scan(t);
eq(F.pii.mask(t, fs1), 'Scrie la [EMAIL], tel [PHONE], IBAN [IBAN].', 'mask placeholder');
eq(F.pii.mask(t, fs1, {mode: 'partial'}), 'Scrie la i***@e***.ro, tel *** *** *56, IBAN RO49 **** **** 0000.', 'mask partial');
ok(!F.pii.mask(t, fs1).includes('popescu'), 'nu rămâne nimic din valoare');
eq(F.pii.scan('x', {}), [], 'text scurt');
eq(F.pii.scan('', {}), [], 'text gol'); eq(F.pii.scan(null), [], 'null');
// performanță
const big = 'Lorem ipsum dolor sit amet, 12 cuvinte fără date. '.repeat(20000); const t0 = performance.now(); F.pii.scan(big); R.perf_ms_1MB = Math.round(performance.now() - t0); R.perf_bytes = big.length; console.log('scan', big.length, 'caractere:', R.perf_ms_1MB, 'ms');
fs.writeFileSync(new URL('./pii-metrics.json', import.meta.url), JSON.stringify(R, null, 1));
// intrări patologice (fără blocaj / backtracking exponențial)
const path = {'cifre': '1 '.repeat(20000), 'majuscule': 'Ab '.repeat(20000), 'zerouri': '0'.repeat(100000), 'strada': 'Str. ' + 'Aaa '.repeat(5000), 'ip': '1.'.repeat(30000), 'email': 'a'.repeat(50000) + '@', 'iban': 'RO49 ' + 'A1 '.repeat(10000), 'url': 'https://' + 'a?b='.repeat(10000), 'dubla': ':'.repeat(50000)};
R.pathological_ms = {};
for (const [k, v] of Object.entries(path)) { const t1 = performance.now(); F.pii.scan(v); const dt = Math.round(performance.now() - t1); R.pathological_ms[k] = dt; ok(dt < 3000, 'intrare patologică ' + k + ': ' + dt + ' ms'); }
fs.writeFileSync(new URL('./pii-metrics.json', import.meta.url), JSON.stringify(R, null, 1));
console.log('patologice (ms):', JSON.stringify(R.pathological_ms));
done('pii');
