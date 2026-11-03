#!/usr/bin/env node
/* tools/refresh/baseline.mjs — extrage din aplicațiile locale „starea de pornire” cu care alergătorul compară sursele externe:
 *   data/refresh/baseline/ACORDAJ.json          numărul și hash-urile titlurilor din aplicație (nu titlurile: drepturile listei nu sunt verificate)
 *   data/refresh/baseline/AGORA-populatii.json  populațiile (milioane) afișate de AGORA
 * Utilizare: node tools/refresh/baseline.mjs [--apps-root /home/claude/demo/apps]   (rulează local; în Actions se folosesc fișierele comise)
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {HUB, writeJson} from './lib.mjs';
import {h8} from './parsers/common.mjs';

const i = process.argv.indexOf('--apps-root');
const APPS = path.resolve(i >= 0 ? process.argv[i + 1] : path.join(HUB, '..', 'demo', 'apps'));
const rd = (a) => fs.readFileSync(path.join(APPS, a, 'index.html'), 'utf8');
const B = (id) => path.join(HUB, 'data', 'refresh', 'baseline', id + '.json');

{ const m = rd('ACORDAJ').match(/\nconst RAW = (\[[\s\S]*?\]);\n/); if (!m) throw new Error('ACORDAJ: nu găsesc const RAW');
  const RAW = vm.runInNewContext(m[1]);
  writeJson(B('ACORDAJ'), {schema: 1, note: 'Extras din aplicația ACORDAJ (const RAW): doar numărul și hash-urile titlurilor normalizate, nu titlurile (drepturile asupra listei nu sunt verificate). Regenerat cu tools/refresh/baseline.mjs.', count: RAW.length, hashes: RAW.map(h8)});
  console.log('ACORDAJ:', RAW.length, 'titluri'); }
{ const pop = {};
  for (const m of rd('AGORA').matchAll(/\{id:'([A-Z]{2})',name:'[^']*',capital:'[^']*',pop:'~?([\d,.]+) (mil\.|mii)'/g)) pop[m[1]] = m[3] === 'mii' ? +m[2].replace('.', '').replace(',', '.') / 1000 : +m[2].replace(',', '.');
  writeJson(B('AGORA-populatii'), {schema: 1, note: 'Populațiile (milioane, rotunjite) afișate de AGORA, extrase din lista de state; regenerat cu tools/refresh/baseline.mjs.', count: Object.keys(pop).length, popMillions: pop});
  console.log('AGORA:', Object.keys(pop).length, 'state'); }
