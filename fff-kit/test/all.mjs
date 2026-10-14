// Rulează testele nucleului una după alta: node test/all.mjs
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
let bad = 0;
for (const t of ['core', 'label', 'bundle', 'build']) {
  const r = spawnSync('node', [path.join(here, t + '.test.mjs')], {stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8'});
  const last = r.stdout.trim().split('\n').pop();
  console.log(last);
  if (r.status !== 0) { bad++; console.log(r.stdout.split('\n').filter((l) => /FAIL/.test(l)).join('\n')); }
}
process.exit(bad ? 1 : 0);
