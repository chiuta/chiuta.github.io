#!/usr/bin/env node
// extract-hub-source — extrage din index.html textele de interfață ale hub-ului (T, X_I18N, CTRL, CONTENT.sections/misc) pentru o limbă-sursă
// și le scrie ca JSON în data/hub-i18n/_source.<limbă>.json. Funcțiile-șablon (nProjects, nShown, covLangs …) sunt transformate în șabloane „{n}”.
//   node tools/i18n25/extract-hub-source.mjs [--lang en]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lang = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'en';
const html = fs.readFileSync(path.join(HUB, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/application\/(ld\+)?json|id="fff-/.test(m[1]));
const body = scripts.map((m) => m[2]).sort((a, b) => b.length - a.length)[0];
function literal(name) {
  const m = new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*\\{').exec(body);
  if (!m) throw new Error('lipsește ' + name);
  let i = m.index + m[0].length - 1, depth = 0, q = null;
  const st = i;
  for (; i < body.length; i++) {
    const c = body[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return body.slice(st, i + 1);
  }
  throw new Error('neînchis ' + name);
}
const ev = (s) => vm.runInNewContext('(' + s + ')', {});
const T = ev(literal('T')), X = ev(literal('X_I18N')), CTRL = ev(literal('CTRL')), CONTENT = ev(literal('CONTENT'));
// funcțiile devin șabloane: se apelează cu marcaje cunoscute și se citește șirul rezultat
const tpl = {};
const probe = {
  nProjects: (f) => f('{n}'),
  nShown: (f) => f('{n}')('{m}'),
  labNote: (f) => f('{s}'),
  covLangs: (f) => f('{n}'),
  covOnly: (f) => f('{l}'),
  covPart: (f) => f('{n}'),
  statAppsTip: (f) => f('{n}', '{l}', '{v}'),
  statSecTip: (f) => f('{n}'),
  covScore: (f) => f('{n}'),
};
const strings = {};
for (const [k, v] of Object.entries({...T[lang], ...X[lang]})) {
  if (typeof v === 'function') { if (!probe[k]) throw new Error('funcție necunoscută: ' + k); tpl[k] = probe[k](v); }
  else if (typeof v === 'string') strings[k] = v;
  else strings[`__skip:${k}`] = typeof v;
}
if (strings.copyright) strings.copyright = strings.copyright.replace(/(\d{1,2} \w+ \d{4}|\d\d\.\d\d\.\d{4}|\d{4}\. \d\d\. \d\d\.)\s*$/, '{d}');   // data din subsol: pusă la rulare de blocul i18n25
const out = {lang, T: strings, tpl, CTRL: CTRL[lang], sections: CONTENT[lang].sections, misc: CONTENT[lang].misc};
fs.writeFileSync(path.join(HUB, 'data', 'hub-i18n', `_source.${lang}.json`), JSON.stringify(out, null, 1) + '\n');
console.log(lang, 'șiruri', Object.keys(strings).length, 'șabloane', Object.keys(tpl).length, 'CTRL', Object.keys(out.CTRL).length, 'secțiuni', Object.keys(out.sections).length, 'misc', Object.keys(out.misc).length);
