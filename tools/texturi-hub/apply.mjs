#!/usr/bin/env node
// Pune texturile fractale în paginile de prezentare ale hubului. Idempotent; `--check` nu scrie nimic și iese cu 1 dacă ceva nu corespunde sursei.
//   index.html             bloc inline între <!--TX:JS:START--> și <!--TX:JS:END--> (ca stratul hub-ux), apoi hash-urile CSP și versiunea sw.js
//   demo/index.html, demo/nativ/index.html   două <script src> (CSP are script-src 'self'); configurația e în tools/texturi-hub/cfg-demo.js (scris de acest script)
//   transparenta.html      generată: tools/transparenta.mjs include același bloc (configurația din pages.json, cheia „transparenta”)
// Configurația fiecărei pagini: tools/texturi-hub/pages.json.
import fs from 'node:fs'; import path from 'node:path'; import {createHash} from 'node:crypto'; import {execFileSync} from 'node:child_process';
import {HUB, pages, configCall, inlineBlock} from './inline.mjs';
const CHECK = process.argv.includes('--check'), rd = (p) => fs.readFileSync(path.join(HUB, p), 'utf8'), problems = [];
const write = (p, s) => { if (CHECK) { if (rd(p) !== s) problems.push(p + ' nu corespunde (rulează node tools/texturi-hub/apply.mjs)'); } else if (!fs.existsSync(path.join(HUB, p)) || rd(p) !== s) { fs.writeFileSync(path.join(HUB, p), s); console.log('scris ' + p); } };

// 1) index.html
{
  const marked = `<!--TX:JS:START-->\n${inlineBlock('index')}\n<!--TX:JS:END-->`, re = /^<!--TX:JS:START-->$[\s\S]*?^<!--TX:JS:END-->$/m;
  let html = rd('index.html');
  if (re.test(html)) html = html.replace(re, () => marked);
  else { const i = html.lastIndexOf('</body>'); if (i < 0) throw new Error('lipsește </body>'); html = html.slice(0, i) + marked + '\n' + html.slice(i); }
  if (CHECK) {
    const tmp = path.join(HUB, '.tx-check.html'); fs.writeFileSync(tmp, html);
    try { execFileSync(process.execPath, [path.join(HUB, 'fff-kit/build.mjs'), 'fixcsp', tmp], {stdio: 'pipe'}); const done = fs.readFileSync(tmp, 'utf8'); if (done !== rd('index.html')) problems.push('index.html: blocul texturi sau hash-urile CSP nu corespund (rulează node tools/texturi-hub/apply.mjs)'); } finally { fs.unlinkSync(tmp); }
  } else if (html !== rd('index.html')) {
    fs.writeFileSync(path.join(HUB, 'index.html'), html);
    execFileSync(process.execPath, [path.join(HUB, 'fff-kit/build.mjs'), 'fixcsp', path.join(HUB, 'index.html')], {stdio: 'inherit'});
    const version = 'h' + createHash('sha256').update(rd('index.html')).digest('hex').slice(0, 8), sw = rd('sw.js'), swNew = sw.replace(/var VERSION = "[^"]*";/, () => `var VERSION = "${version}";`);
    if (swNew !== sw) fs.writeFileSync(path.join(HUB, 'sw.js'), swNew);
    console.log('scris index.html (sw.js → ' + version + ')');
  }
}
// 2) paginile demo (scripturi externe) + configurația lor
{
  write('tools/texturi-hub/cfg-demo.js', `/* generat de tools/texturi-hub/apply.mjs din pages.json („demo”) */\n${configCall(pages().demo)}\n`);
  for (const [p, up] of [['demo/index.html', '../'], ['demo/nativ/index.html', '../../']]) {
    const tag = `<!--TX:EXT:START--><script src="${up}tools/fff-texturi.js"></script><script src="${up}tools/texturi-hub/cfg-demo.js"></script><!--TX:EXT:END-->`, re = /<!--TX:EXT:START-->[\s\S]*?<!--TX:EXT:END-->/;
    let html = rd(p);
    if (re.test(html)) html = html.replace(re, () => tag); else { const i = html.lastIndexOf('</body>'); if (i < 0) throw new Error('lipsește </body> în ' + p); html = html.slice(0, i) + tag + '\n' + html.slice(i); }
    write(p, html);
  }
}
// 3) transparenta.html: doar verificare (o scrie tools/transparenta.mjs)
if (CHECK && !rd('transparenta.html').includes('id="fff-mod-texturi"')) problems.push('transparenta.html nu conține modulul (rulează node tools/transparenta.mjs build)');
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
if (CHECK) console.log('texturi-hub: ok');
