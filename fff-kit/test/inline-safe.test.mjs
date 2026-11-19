// Teste kit 1.8.1: codul kitului, inclus în pagină între <script>…</script>, nu conține secvențe pe care unelte naive de ștampilare (regex peste tot documentul)
// le-ar lua drept început/sfârșit de element: <style, </style, <script, </script, <!--. Regresie reală: un comentariu cu «<style>» în view.js făcea ca
// web/stamp-site-csp.py din VERIGA să calculeze un hash greșit pentru stilul aplicației, iar browserul bloca tot stilul paginii (pagină fără aspect).
// Rulare: node test/inline-safe.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'src');
let bad = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('✗', m); } else console.log('✓', m); };
for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.js')).sort()) {
  const t = fs.readFileSync(path.join(src, f), 'utf8');
  const hit = t.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /<\/?(?:style|script)\b|<!--/i.test(l));
  ok(hit.length === 0, `src/${f}: fără <style>, <script> sau <!-- în cod${hit.length ? ' (linia ' + hit.map((h) => h[0]).join(', ') + ')' : ''}`);
}
console.log(bad ? `\n${bad} din ${n} eșuate` : `\n${n}/${n} ok`);
process.exit(bad ? 1 : 0);
