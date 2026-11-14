// Blocul <script> cu motorul fff-texturi + configurația unei pagini din tools/texturi-hub/pages.json (folosit de apply.mjs și de tools/transparenta.mjs).
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
export const HUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const pages = () => JSON.parse(fs.readFileSync(path.join(HUB, 'tools/texturi-hub/pages.json'), 'utf8'));
export const engine = () => fs.readFileSync(path.join(HUB, 'tools/fff-texturi.js'), 'utf8').trimEnd();
export const configCall = (cfg) => `;(function(){var T=window.FFF&&window.FFF.texturi;if(T&&T.configure)T.configure(${JSON.stringify(cfg)});})();`;
export function inlineBlock(page) {
  const cfg = pages()[page]; if (!cfg) throw new Error('pagină necunoscută în pages.json: ' + page);
  const src = engine() + '\n' + configCall(cfg) + '\n';
  if (/<\/script/i.test(src)) throw new Error('motorul conține </script');
  return `<script id="fff-mod-texturi">${src}</script>`;
}
