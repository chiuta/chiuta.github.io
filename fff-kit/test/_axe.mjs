// Calea către axe.min.js, în ordinea: FFF_AXE / AXE_PATH, pachetul `axe-core` rezolvat din kit sau din /opt/node-tools, /home/claude/pw, apoi vechea cale din scratchpad.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const CANDIDATES = [
  () => process.env.FFF_AXE, () => process.env.AXE_PATH,
  () => createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  () => createRequire('/opt/node-tools/package.json').resolve('axe-core/axe.min.js'),
  () => '/home/claude/pw/node_modules/axe-core/axe.min.js',
  () => '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js',
];
export const AXE = (() => { for (const c of CANDIDATES) { try { const p = c(); if (p && fs.existsSync(p)) return p; } catch { /* următorul */ } } return CANDIDATES[CANDIDATES.length - 1](); })();
