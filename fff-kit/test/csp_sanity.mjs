import fs from 'node:fs';
import {checkCspHashes, recomputeCspHashes} from '../lib/csp.mjs';
const inv = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/site2/shots_inv.json','utf8'));
let bad = [], diff = [];
for (const e of inv) {
  const h = fs.readFileSync(e.path + '/index.html', 'utf8');
  const c = checkCspHashes(h); if (!c.ok) bad.push(e.proper);
  const r = recomputeCspHashes(h); if (r.changed) diff.push(e.proper);
}
console.log('neacoperite:', bad.length, bad.join(','));
console.log('hash-uri care s-ar schimba la recalculare:', diff.length, diff.join(','));
