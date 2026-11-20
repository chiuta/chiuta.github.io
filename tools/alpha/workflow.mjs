#!/usr/bin/env node
// Scrie .github/workflows/validate.yml pentru o aplicație alpha: Ubuntu 26.04, Node.js 26, validarea datelor (Python),
// testele node (dacă există test/), verificarea construcției (dacă există scripts/build.mjs), verificarea pachetelor asamblate (dacă există scripts/pack.mjs).
// Utilizare: node tools/alpha/workflow.mjs <slug> [--root DIR] [--check]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function renderWorkflow(dir) {
  const has = (p) => fs.existsSync(path.join(dir, p));
  const hasTests = has('test') && fs.readdirSync(path.join(dir, 'test')).some((f) => f.endsWith('.test.mjs'));
  const lines = [
    'name: validate',
    'on: [push, pull_request]',
    'jobs:',
    '  validate:',
    '    runs-on: ubuntu-26.04',
    '    steps:',
    '      - uses: actions/checkout@v7',
    '      - uses: actions/setup-node@v7',
    '        with: { node-version: 26 }'
  ];
  if (has('scripts/pack.mjs')) lines.push('      - run: node scripts/pack.mjs --check');   // pachetele din data/dist corespund fișierelor de specii și manifestelor
  if (has('scripts/validate.py')) {
    // Pillow doar când există optimizatorul de fotografii (testul lui se sare fără Pillow)
    lines.push('      - uses: actions/setup-python@v7', "        with: { python-version: '3.12' }", '      - run: pip install jsonschema' + (has('scripts/optimize.py') ? ' pillow' : ''), '      - run: python scripts/validate.py');
  }
  if (hasTests) lines.push('      - run: node --test "test/*.test.mjs"');
  if (has('scripts/build.mjs')) lines.push('      - run: node scripts/build.mjs --check');
  return lines.join('\n') + '\n';
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const ri = args.indexOf('--root');
  const root = path.resolve(ri >= 0 ? args.splice(ri, 2)[1] : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..'));
  const slug = args.filter((a) => !a.startsWith('--'))[0];
  if (!slug) { console.error('utilizare: node tools/alpha/workflow.mjs <slug> [--root DIR] [--check]'); process.exit(2); }
  const dir = path.join(root, slug);
  const f = path.join(dir, '.github', 'workflows', 'validate.yml');
  const text = renderWorkflow(dir);
  const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  if (cur === text) { console.log('validate.yml: neschimbat'); return; }
  if (check) { console.log('validate.yml diferă'); process.exit(1); }
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, text);
  console.log('validate.yml scris');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
