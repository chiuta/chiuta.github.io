// TEMPORAR: rulează parserul pe sursa reală, doar numere agregate.
import {spawnSync} from 'node:child_process';
const r = spawnSync('node', ['tools/refresh/run.mjs', '--only', 'ACORDAJ', '--dry-run', '--out', '/tmp/acordaj-out'], {encoding: 'utf8'});
console.log((r.stdout + r.stderr).split('\n').map((l) => l.slice(0, 600)).join('\n'));
