// Teste pentru tools/anthropic-audit.mjs: prinde exact încălcările regulilor de centralizare (fără browser, fără rețea).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AI = createRequire(import.meta.url)(path.join(HUB, 'tools', 'fff-ai.js'));
let fail = 0;
const T = (name, fn) => { try { fn(); console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + (e.message || e)); } };
const audit = (files, extra = []) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'anth-'));
  for (const [n, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, n)), {recursive: true}); fs.writeFileSync(path.join(d, n), c); }
  const r = spawnSync('node', [path.join(HUB, 'tools', 'anthropic-audit.mjs'), '--root', d, '--json', ...extra], {encoding: 'utf8'});
  fs.rmSync(d, {recursive: true, force: true});
  return {code: r.status, out: JSON.parse(r.stdout)};
};
const CORE = '<script id="fff-mod-ai">/* copia nucleului */ var x = "anthropic-version";</script>\n';

T('o pagină curată (folosește FFF.ai.anthropicHeaders) trece', () => {
  const r = audit({'A/index.html': CORE + '<script>fetch("https://api.anthropic.com/v1/messages",{headers:FFF.ai.anthropicHeaders(k),body:JSON.stringify({model:FFF.ai.MODELS.default,max_tokens:5})})</script>'});
  assert.equal(r.code, 0, JSON.stringify(r.out.findings));
});
T('literal anthropic-version într-o pagină cu nucleul AI: respins', () => {
  const r = audit({'A/index.html': CORE + `<script>var h={"anthropic-version":"${AI.ANTHROPIC_VERSION}"}</script>`});
  assert.equal(r.code, 1); assert.match(r.out.findings[0], /literal anthropic-version/);
});
T('opțiunea version: "…" către nucleu: respinsă', () => {
  const r = audit({'A/index.html': CORE + '<script>FFF.ai.run("anthropic",{version:"2023-06-01",model:"m"})</script>'});
  assert.equal(r.code, 1); assert.match(r.out.findings[0], /opțiunea version/);
});
T('worker fără nucleu: valoarea trebuie să fie cea centrală', () => {
  assert.equal(audit({'w.js': `const h={'anthropic-version': '${AI.ANTHROPIC_VERSION}'}; // api.anthropic.com`}).code, 0);
  const bad = audit({'w.js': "const h={'anthropic-version': '2023-06-01'}; // api.anthropic.com"});
  assert.equal(bad.code, 1); assert.match(bad.out.findings[0], /≠/);
});
T('model retras fără explicație: respins; cu explicație („retras”): acceptat', () => {
  assert.equal(audit({'w.js': "const m='claude-3-haiku-20240307'; // api.anthropic.com"}).code, 1);
  assert.equal(audit({'w.js': "// modelul a fost retras\nconst m='claude-3-haiku-20240307'; // api.anthropic.com"}).code, 0);
});
T('temperature într-un corp către Anthropic: respins; la OpenAI/Ollama: acceptat', () => {
  assert.equal(audit({'w.js': "fetch('https://api.anthropic.com/v1/messages',{body:JSON.stringify({model:m,max_tokens:5,temperature:0.2})})"}).code, 1);
  assert.equal(audit({'w.js': "fetch('https://api.anthropic.com/v1/messages',{});\nfetch(ollama,{body:JSON.stringify({options:{num_predict:5,temperature:0.2}})}) // ollama max_tokens"}).code, 0);
});
T('modele active din nucleu nu sunt raportate', () => {
  const r = audit({'w.js': `// api.anthropic.com\nconst l=${JSON.stringify(AI.MODELS.anthropic)};`});
  assert.equal(r.code, 0); assert.equal(r.out.warnings.length, 0);
});
T('hub-ul curat (apps/ și tools/) trece', () => {
  const r = spawnSync('node', [path.join(HUB, 'tools', 'anthropic-audit.mjs')], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stdout);
});
console.log(fail ? `\n${fail} eșuate` : '\ntoate trec');
process.exit(fail ? 1 : 0);
