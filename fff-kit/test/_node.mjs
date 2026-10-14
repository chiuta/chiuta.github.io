// Încărcare module FFF în Node (fără DOM), pentru teste unitare.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), kit = path.join(here, '..');
export function loadKit(mods, {lang = 'ro', document: doc} = {}) {
  if (!globalThis.localStorage) { const m = new Map(); globalThis.localStorage = {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; }}; }
  globalThis.window = globalThis;
  globalThis.document = doc || {documentElement: {lang}};
  delete globalThis.FFF;
  vm.runInThisContext(fs.readFileSync(path.join(here, 'core-shim.js'), 'utf8'), {filename: 'core-shim.js'});
  for (const m of mods) {
    FFF.registerI18n(m, JSON.parse(fs.readFileSync(path.join(kit, 'i18n', m + '.json'), 'utf8')));
    vm.runInThisContext(fs.readFileSync(path.join(kit, 'src', m + '.js'), 'utf8'), {filename: m + '.js'});
  }
  return globalThis.FFF;
}
export const kitDir = kit;
let pass = 0, fail = 0;
export function ok(c, msg) { if (c) pass++; else { fail++; console.error('FAIL:', msg); } }
export function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' — obținut ' + JSON.stringify(a) + ' așteptat ' + JSON.stringify(b)); }
export function done(name) { console.log(`${name}: ${pass} ok, ${fail} eșuate`); if (fail) process.exit(1); }
