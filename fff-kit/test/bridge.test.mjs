import {loadKit, ok, eq, done} from './_node.mjs';
const F = loadKit(['bridge']); const B = F.bridge;

const env = B.make({type: 'citation/csl', src: 'AcademiSearch', title: 'Ref', lang: 'ro', data: [{title: 'Ștefan cel Mare – Δ ✓'}]});
ok(B.valid(env), 'plic valid'); eq(env.fff, 1, 'versiune');
let threw = false; try { B.make({type: 'x'}); } catch (e) { threw = true; } ok(threw, 'make fără data aruncă');

// link: dus-întors, Unicode intact, fără prefix în partea de bază
const link = await B.toLink(env, 'https://markdownatelier.chiuta.ro/?x=1#vechi');
ok(link.startsWith('https://markdownatelier.chiuta.ro/?x=1#fff='), 'link cu fragment');
ok(!link.includes('vechi'), 'fragmentul vechi eliminat');
const back = await B.fromHash(link.slice(link.indexOf('#')));
eq(back.data[0].title, 'Ștefan cel Mare – Δ ✓', 'dus-întors Unicode');
eq(await B.fromHash('#q=abc'), null, 'fără plic -> null');
eq(await B.fromHash('#q=1&fff=' + link.split('fff=')[1]).then(e => e.type), 'citation/csl', 'plic după alți parametri');

// prea mare -> TOO_BIG
let code = ''; try { await B.toLink(B.make({type: 'text/plain', data: Array.from({length: 60000}, () => Math.random().toString(36)).join(' ')}), 'http://x/'); } catch (e) { code = e.code; }
eq(code, 'TOO_BIG', 'link prea mare');

// respinge / curăță
for (const bad of ['{"fff":2,"type":"a","data":1}', '{"fff":1,"data":1}', '{"fff":1,"type":"a"}', 'nu e json', '[]']) { let r = 'acceptat'; try { B.parse(bad); } catch (e) { r = 'respins'; } eq(r, 'respins', 'respins: ' + bad); }
const p = B.parse('{"fff":1,"type":"text/plain","data":{"__proto__":{"x":1},"constructor":2,"a":1}}');
eq(Object.keys(p.data), ['a'], 'chei periculoase eliminate'); ok(({}).x === undefined, 'fără poluare de prototip');
let bad = 'ok'; try { await B.fromHash('#fff=z.AAAA'); } catch (e) { bad = 'respins'; } eq(bad, 'respins', 'hash corupt respins');

// ținte
const reg = [{slug: 'a', name: 'A', accepts: [], produces: ['citation/csl']}, {slug: 'b', name: 'B', accepts: ['citation/csl']}, {slug: 'c', name: 'C', accepts: ['quiz/undava']}];
eq(B.targetsFor(env, reg, 'a').map(x => x.slug), ['b'], 'ținte: doar compatibile, fără sine');
B.setRegistry(reg); eq(B.targetsFor(env, null, 'b').map(x => x.slug), [], 'registru implicit, fără sine');

// fișier
const f = B.toFile(env); ok(f.name === 'Ref.fff.json', 'nume fișier: ' + f.name);
eq((await B.fromFile(f)).data[0].title, 'Ștefan cel Mare – Δ ✓', 'fromFile');

// i18n: toate cheile în toate cele 8 limbi
import fs from 'node:fs'; import {kitDir} from './_node.mjs';
const d = JSON.parse(fs.readFileSync(kitDir + '/i18n/bridge.json', 'utf8')), ro = Object.keys(d.ro);
for (const l of ['en', 'fr', 'it', 'es', 'pt', 'de', 'hu']) eq(Object.keys(d[l]).sort(), ro.slice().sort(), 'chei i18n ' + l);
ok(/\{src\}/.test(d.hu.inc) && /\{title\}/.test(d.hu.inc), 'substituenți în inc (hu)');
done('bridge');
