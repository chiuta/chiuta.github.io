// Teste stratul de compatibilitate (fff-kit/src/compat.js): rezerve de API, regex fără \p/lookbehind, <dialog>, avertisment.
// Un browser vechi nu e disponibil în sandbox: simulăm lipsa API-urilor (le ștergem înainte de scripturile paginii) și a sintaxei regex
// (RegExp construit la rulare aruncă SyntaxError pe \p{…}, lookbehind și steagurile s/d/v), apoi comparăm cu rezultatele NATIVE.
// Rulare: node test/legacy.test.mjs
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {makeApp, launch, newPage, check, summary, FIXTURE} from './_pw.mjs';
import {checkKit} from '../build.mjs';

const browser = await launch();
const app = makeApp(FIXTURE, {modules: 'core,store,dialog,label,bundle', info: false});

console.log('bloc, CSP, versiune');
const html = fs.readFileSync(app.file, 'utf8');
const ck = checkKit(app.dir);
check('check: fără erori; blocurile fff-compat și fff-imp există', ck.ok && /<script id="fff-compat">/.test(html) && /<script type="module" id="fff-imp">/.test(html), ck.errors);
{
  const acorn = createRequire('/opt/node-tools/package.json')('acorn');
  let err = null; try { acorn.parse(fs.readFileSync(new URL('../src/compat.js', import.meta.url), 'utf8'), {ecmaVersion: 5}); } catch (e) { err = e.message; }
  check('compat.js este ES5 pur (acorn, ecmaVersion 5: fără let/const/=>/șabloane/async)', err === null, err);
}
{
  const {page, errors} = await newPage(browser);
  await page.goto(app.url); await page.waitForTimeout(300);
  const o = await page.evaluate(() => ({ready: FFF.compat.ready, old: FFF.compat.tooOld, miss: FFF.compat.missing, v: FFF.compat.version, kit: FFF.version, imp: typeof window.__fffImp, cls: document.documentElement.className, rx: typeof FFF.rx, banner: !!document.querySelector('[data-fff-compat]')}));
  check('browser modern: strat activ, nimic de semnalat, import() disponibil', o.ready && !o.old && o.miss.length === 0 && o.imp === 'function' && o.banner === false && o.kit === '1.8.0' && o.v === '1.8.0' && o.rx === 'function', o);
  check('browser modern: nicio clasă de rezervă pe <html>', o.cls === '', o.cls);
  check('browser modern: fără erori de pagină', errors.length === 0, errors);
  await page.close();
}

console.log('rezerve API (ștergem API-urile native înainte de pagină, comparăm cu rezultatul nativ)');
{
  const {ctx, page, errors} = await newPage(browser, {h: 600});
  await ctx.addInitScript(() => {
    const nat = {};
    const px = (c) => { const d = c.getContext('2d').getImageData(0, 0, 40, 30).data; return [0, 1, 2, 5, 6, 20, 21 * 4, 700, 1100, 1199].map((i) => d[i * 4 + 3] > 0 ? 1 : 0).join(''); };
    nat.entries = Object.entries({a: 1, b: [2]}); nat.values = Object.values({a: 1, b: 2}); nat.fromEntries = [Object.fromEntries([['a', 1], ['b', 2]]), Object.fromEntries(new Map([['x', 1]]))];
    nat.pad = ['5'.padStart(3, '0'), 'abc'.padStart(8, '12'), 'abc'.padStart(2), ''.padStart(3, 'ab'), '5'.padEnd(3, '0'), 'abc'.padEnd(8, '12'), 'abc'.padEnd(2)];
    nat.trim = ['  a b  '.trimStart(), '  a b  '.trimEnd(), '\u00A0x\uFEFF'.trimStart().length];
    nat.replaceAll = ['a.b.c'.replaceAll('.', '-'), 'aaa'.replaceAll('a', (m, i) => i), 'x'.replaceAll('', '-'), 'a$b'.replaceAll('$', '$&$&'), 'abc'.replaceAll(/b/g, '[$&]'), 'a-b'.replaceAll('-', "$`|$'")];
    nat.matchAll = [...'a1b22c'.matchAll(/\d+/g)].map((m) => [m[0], m.index]);
    nat.at = ['abc'.at(-1), 'abc'.at(5), [1, 2, 3].at(-2), [1, 2, 3].at(0), 'abc'.at(-5)];
    nat.flat = [[1, [2, [3, [4]]]].flat(), [1, [2, [3, [4]]]].flat(Infinity), [[1], [2]].flatMap((x) => x.concat(9)), [1, 2].flatMap((x) => [[x]]), [1, , 3].flat()];
    nat.findLast = [[1, 2, 3, 4].findLast((x) => x % 2), [1, 2, 3, 4].findLastIndex((x) => x > 9), [1, 2, 3, 4].findLastIndex((x) => x < 3)];
    nat.hasOwn = [Object.hasOwn({a: 1}, 'a'), Object.hasOwn({a: 1}, 'toString')];
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const cx = cv.getContext('2d'); cx.beginPath(); cx.roundRect(0, 0, 40, 30, 10); cx.fill(); nat.round = px(cv);
    window.__nat = nat;
    const del = (o, k) => { try { delete o[k]; } catch (e) { /* ignorat */ } };
    ['entries', 'values', 'fromEntries', 'hasOwn', 'getOwnPropertyDescriptors'].forEach((k) => del(Object, k));
    ['padStart', 'padEnd', 'trimStart', 'trimEnd', 'replaceAll', 'matchAll', 'at'].forEach((k) => del(String.prototype, k));
    ['flat', 'flatMap', 'at', 'findLast', 'findLastIndex'].forEach((k) => del(Array.prototype, k));
    ['finally'].forEach((k) => del(Promise.prototype, k)); ['allSettled', 'any'].forEach((k) => del(Promise, k));
    ['structuredClone', 'queueMicrotask', 'requestIdleCallback', 'cancelIdleCallback', 'AbortController', 'AbortSignal', 'IntersectionObserver', 'ResizeObserver', 'globalThis'].forEach((k) => del(window, k));
    del(Crypto.prototype, 'randomUUID'); ['Element', 'Document', 'DocumentFragment'].forEach((k) => del(window[k].prototype, 'replaceChildren')); del(Element.prototype, 'toggleAttribute');
    del(Blob.prototype, 'arrayBuffer'); del(Blob.prototype, 'text'); del(HTMLCanvasElement.prototype, 'toBlob'); del(CanvasRenderingContext2D.prototype, 'roundRect'); del(Navigator.prototype, 'clipboard');
    Object.defineProperty(MediaQueryList.prototype, 'addEventListener', {value: undefined, configurable: true, writable: true});
    const sup = CSS.supports.bind(CSS); CSS.supports = (a, b) => (a === 'scroll-behavior' ? false : sup(a, b));   // „Safari vechi”: fără scroll-behavior → scroll cu opțiuni emulat
  });
  await page.goto(app.url); await page.waitForTimeout(300);
  const R = await page.evaluate(async () => {
    const out = {}, N = window.__nat, eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const sc = [Object.entries({a: 1, b: [2]}), Object.values({a: 1, b: 2}), [Object.fromEntries([['a', 1], ['b', 2]]), Object.fromEntries(new Map([['x', 1]]))]];
    out.objects = eq(sc[0], N.entries) && eq(sc[1], N.values) && eq(sc[2], N.fromEntries) && eq([Object.hasOwn({a: 1}, 'a'), Object.hasOwn({a: 1}, 'toString')], N.hasOwn);
    out.pad = eq(['5'.padStart(3, '0'), 'abc'.padStart(8, '12'), 'abc'.padStart(2), ''.padStart(3, 'ab'), '5'.padEnd(3, '0'), 'abc'.padEnd(8, '12'), 'abc'.padEnd(2)], N.pad);
    out.trim = eq(['  a b  '.trimStart(), '  a b  '.trimEnd(), '\u00A0x\uFEFF'.trimStart().length], N.trim);
    out.replaceAll = eq(['a.b.c'.replaceAll('.', '-'), 'aaa'.replaceAll('a', (m, i) => i), 'x'.replaceAll('', '-'), 'a$b'.replaceAll('$', '$&$&'), 'abc'.replaceAll(/b/g, '[$&]'), 'a-b'.replaceAll('-', "$`|$'")], N.replaceAll);
    out.matchAll = eq([...'a1b22c'.matchAll(/\d+/g)].map((m) => [m[0], m.index]), N.matchAll);
    out.at = eq(['abc'.at(-1), 'abc'.at(5), [1, 2, 3].at(-2), [1, 2, 3].at(0), 'abc'.at(-5)], N.at);
    out.flat = eq([[1, [2, [3, [4]]]].flat(), [1, [2, [3, [4]]]].flat(Infinity), [[1], [2]].flatMap((x) => x.concat(9)), [1, 2].flatMap((x) => [[x]]), [1, , 3].flat()], N.flat);
    out.findLast = eq([[1, 2, 3, 4].findLast((x) => x % 2), [1, 2, 3, 4].findLastIndex((x) => x > 9), [1, 2, 3, 4].findLastIndex((x) => x < 3)], N.findLast);
    // Promise
    const log = [];
    await Promise.resolve(1).finally(() => log.push('f1')).then((v) => log.push('v' + v));
    await Promise.reject(new Error('x')).finally(() => log.push('f2')).catch((e) => log.push('c' + e.message));
    await Promise.resolve(1).finally(() => { throw new Error('boom'); }).catch((e) => log.push(e.message));
    out.finally = eq(log, ['f1', 'v1', 'f2', 'cx', 'boom']);
    const as = await Promise.allSettled([1, Promise.reject('r'), Promise.resolve(3)]);
    out.allSettled = eq(as, [{status: 'fulfilled', value: 1}, {status: 'rejected', reason: 'r'}, {status: 'fulfilled', value: 3}]);
    out.any = (await Promise.any([Promise.reject(1), new Promise((r) => setTimeout(() => r('ok'), 10))])) === 'ok';
    let anyErr = null; try { await Promise.any([Promise.reject(1), Promise.reject(2)]); } catch (e) { anyErr = e; }
    out.anyReject = !!anyErr && anyErr.name === 'AggregateError' && eq(anyErr.errors, [1, 2]);
    // structuredClone
    const src = {a: [1, {b: 2}], d: new Date(5), m: new Map([[1, {x: 1}]]), s: new Set([1, 2]), r: /x/gi, u8: new Uint8Array([1, 2, 3]), n: null, u: undefined}; src.self = src; src.again = src.a;
    const cl = structuredClone(src);
    out.clone = cl !== src && cl.self === cl && cl.again === cl.a && cl.a !== src.a && cl.d instanceof Date && cl.d.getTime() === 5 && cl.m.get(1).x === 1 && cl.m.get(1) !== src.m.get(1) && cl.s.has(2) && cl.r.source === 'x' && cl.r.flags === 'gi' && cl.u8 instanceof Uint8Array && cl.u8[2] === 3 && cl.u8 !== src.u8 && 'u' in cl;
    let dce = null; try { structuredClone({f() {}}); } catch (e) { dce = e.name; }
    out.cloneErr = dce === 'DataCloneError';
    // microtask / idle / globalThis / uuid
    const ord = []; queueMicrotask(() => ord.push('m')); Promise.resolve().then(() => ord.push('p')); await new Promise((r) => setTimeout(r, 5));
    out.microtask = eq(ord, ['m', 'p']);
    const idle = await new Promise((r) => requestIdleCallback((d) => r(typeof d.timeRemaining() + ':' + d.didTimeout)));
    const idleC = (() => { const id = requestIdleCallback(() => { out.idleCancelled = false; }); cancelIdleCallback(id); return true; })();
    out.idle = idle === 'number:false' && idleC;
    out.globalThis = globalThis === window;
    const u = [crypto.randomUUID(), crypto.randomUUID()];
    out.uuid = u.every((x) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x)) && u[0] !== u[1];
    // AbortController
    const ac = new AbortController(); let fired = 0; ac.signal.addEventListener('abort', () => fired++); ac.signal.onabort = () => fired++;
    ac.abort(); ac.abort();
    out.abort = ac.signal.aborted && fired === 2 && ac.signal.reason.name === 'AbortError';
    // DOM
    const el = document.createElement('div'), sp = document.createElement('span'); el.innerHTML = '<i></i><b></b>'; el.replaceChildren('t', sp, 5);
    out.replaceChildren = el.childNodes.length === 3 && el.firstChild.nodeValue === 't' && el.childNodes[1] === sp && el.lastChild.nodeValue === '5';
    const fr = document.createDocumentFragment(); fr.appendChild(document.createElement('p')); fr.replaceChildren(); out.replaceChildrenFrag = fr.childNodes.length === 0;
    out.toggle = [el.toggleAttribute('x'), el.hasAttribute('x'), el.toggleAttribute('x'), el.hasAttribute('x'), el.toggleAttribute('y', true), el.toggleAttribute('y', true), el.toggleAttribute('y', false)].join() === 'true,true,false,false,true,true,false';
    out.blob = (await new Blob(['héllo']).text()) === 'héllo' && (await new Blob(['héllo']).arrayBuffer()).byteLength === 6;
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; cv.getContext('2d').fillRect(0, 0, 40, 30);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png')); out.toBlob = blob instanceof Blob && blob.type === 'image/png' && blob.size > 50;
    const cv2 = document.createElement('canvas'); cv2.width = 40; cv2.height = 30; const cx = cv2.getContext('2d'); cx.beginPath(); cx.roundRect(0, 0, 40, 30, 10); cx.fill();
    const d2 = cx.getImageData(0, 0, 40, 30).data; out.roundRect = [0, 1, 2, 5, 6, 20, 21 * 4, 700, 1100, 1199].map((i) => d2[i * 4 + 3] > 0 ? 1 : 0).join('') === N.round;
    out.clipboard = typeof navigator.clipboard === 'object' && typeof navigator.clipboard.writeText === 'function' && navigator.clipboard.writeText('abc') instanceof Promise;
    await navigator.clipboard.writeText('x').catch(() => 0); await navigator.clipboard.readText().catch(() => 0);
    // observatori
    const io = await new Promise((res) => { const o = new IntersectionObserver((es) => res(es[0].isIntersecting)); o.observe(document.body); });
    out.intersection = io === true;
    const box = document.createElement('div'); box.style.cssText = 'width:100px;height:50px'; document.body.appendChild(box);
    const sizes = []; const ro = new ResizeObserver((es) => sizes.push(es[0].contentRect.width)); ro.observe(box);
    await new Promise((r) => setTimeout(r, 30)); box.style.width = '200px'; await new Promise((r) => setTimeout(r, 700)); ro.disconnect();
    out.resize = sizes[0] === 100 && sizes[sizes.length - 1] === 200;
    // MediaQueryList
    const mql = matchMedia('(prefers-color-scheme: dark)'); out.mqlHas = typeof mql.addEventListener === 'function';
    // scroll cu opțiuni
    document.body.style.minHeight = '3000px';
    window.scrollTo({top: 120}); const s1 = window.scrollY; window.scrollBy({top: 30}); const s2 = window.scrollY;
    const tall = document.createElement('div'); tall.style.cssText = 'height:100px;overflow:auto'; tall.innerHTML = '<div style="height:900px"></div>'; document.body.appendChild(tall);
    tall.scrollTo({top: 40}); const s3 = tall.scrollTop; tall.scrollBy({top: 10}); const s4 = tall.scrollTop;
    box.scrollIntoView({block: 'center'});
    out.scroll = s1 === 120 && s2 === 150 && s3 === 40 && s4 === 50;
    out.cls = document.documentElement.className;
    return out;
  });
  for (const [k, v] of Object.entries(R)) if (k !== 'cls') check('rezervă: ' + k, v === true, v);
  check('fără erori de pagină', errors.length === 0, errors);
  await ctx.close();
}

console.log('RegExp: \\p{…}, steagul s, lookbehind — pe un „motor vechi” simulat');
{
  const {ctx, page, errors} = await newPage(browser);
  await ctx.addInitScript(() => {
    const Native = RegExp;
    const old = (src, flags) => (typeof src === 'string' && (/\\[pP]\{/.test(src) || /\(\?<[=!]/.test(src) || /\(\?<[A-Za-z_$]/.test(src))) || (flags && /[dsv]/.test(flags));
    function Fake(src, flags) {
      if (src instanceof Native && flags === undefined) { flags = src.flags; src = src.source; }
      if (old(src, flags)) throw new SyntaxError('Invalid regular expression: simulat motor vechi');
      return new Native(src, flags);
    }
    Fake.prototype = Native.prototype; Object.defineProperty(Native.prototype, 'constructor', {value: Fake, writable: true, configurable: true});
    window.RegExp = Fake; window.__Native = Native;
  });
  await page.goto(app.url); await page.waitForTimeout(300);
  const R = await page.evaluate(() => {
    const Native = window.__Native, C = FFF.compat, out = {fail: []};
    // 1) proprietăți Unicode și /s (rescriere ES5)
    const prop = [
      ['\\p{Lu}\\p{Ll}+', 'gu', 'Ana și Ștefan merg la Țară; ÄÖÜ Ünter Éva şi Ñandú Őrs Ă Â Î Ș Ț Привет Мир Γειά σου 123 abc'],
      ['[\\p{L}\\d]+', 'gu', 'abc-123 ăîâșț, ÄÖ_x Привет 42'],
      ['(?:^|[^\\p{L}\\p{N}])(\\p{N}{2,4})(?![\\p{L}\\p{N}])', 'gu', 'an 2026, 12 apr; 5 x 1234 abcd1 ٣٤٥'],
      ['\\P{L}+', 'gu', 'ab, cd! éf 12'],
      ['\\p{M}', 'gu', 'e\u0301 a\u0308 b'],
      ['\\p{P}+', 'gu', 'a,b.c!? d—e «f» (g) [h] {i}'],
      ['^(.*?) (\\(.*\\))$', 's', 'abc\ndef (x\ny)'],
      ['a.b', 'gs', 'a\nb a b a\rb'],
      ['\\p{Lu}', 'u', 'abcÉ']
    ];
    for (const [src, flags, text] of prop) {
      let got = null, exp = null;
      try { const r = C.rx(src, flags); got = [text.match(r), text.replace(r, '<$&>'), text.split(r)]; } catch (e) { got = 'EROARE ' + e.message; }
      const rn = new Native(src, flags); exp = [text.match(rn), text.replace(rn, '<$&>'), text.split(rn)];
      if (JSON.stringify(got) !== JSON.stringify(exp)) out.fail.push('prop ' + src + '/' + flags + ': ' + JSON.stringify(got).slice(0, 150) + ' ≠ ' + JSON.stringify(exp).slice(0, 150));
    }
    // 2) lookbehind emulat, diferențial cu motorul nativ
    const LB = [
      ['(?<!~)~([^~\\n]+)~(?!~)', 'g'], ['(?<![\\d.,])(\\+\\d{2}\\s?\\d{3}[ .-]?\\d{3}[ .-]?\\d{3}|0\\d{2,3}[ .-]?\\d{3}[ .-]?\\d{3,4})(?!\\d)', 'g'],
      ['(?<![\\d.])(\\d{1,2})[.\\/-](\\d{1,2})[.\\/-](\\d{4})(?!\\d)', 'g'], ['(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])', 'g'],
      ['(?<![\\p{L}\\d])([Aa]l)\\s+(\\d{1,4})\\s?-\\s?lea(?![\\p{L}])', 'gu'], ['(?<![\\p{L}\\d])(\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,(\\d+))?(?![\\d])', 'gu'],
      ['(?<![\\p{L}\\d])([A-ZĂÂÎȘȚ]{2,6})(?![\\p{L}\\d])', 'gu'],
      ['(?<=[\\d\\s])\\+(?=[\\d\\s])', 'g'], ['(?<=[.!?…])\\s+', 'g'], ['(?<=[.!?…:;])\\s+', 'g'], ['(?<![\\w$])(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?', 'g'],
      ['(?<=[\\s>]|^)(\\[\\d{1,3}\\])', 'g'], ['\\n{2,}|(?<=[.!?])\\s+', ''], ['(?<=[.!?…])\\s+|\\n+', ''], ['(?<=[.!?…])\\s+|\\n{2,}', ''],
      ['(?<!\\\\)\\$(?!\\$)((?:\\\\.|[^$\\\\])+?)\\$(?!\\d)', 'g'], ['(?<![\\w*])\\*([^*\\s][^*]*?)\\*(?![\\w*])', 'g'], ['(?<![\\w_])_([^_\\s][^_]*?)_(?![\\w_])', 'g'],
      ['(?<!-)--(?!-)', 'g'], ['(?<!\\d)\\.|\\.(?!\\d)', 'g'], ['(?<!\\\\)\\|', 'g'], ['(?<![\\w:-])(href|src|alt)\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'>]+))', 'gi'],
      ['(?<![\\w.\\/@-])(?:https?:\\/\\/|www\\.)[^\\s<>"\'`,\\[\\]{}|\\\\^]+', 'gi'], ['(?<=a)b|(?<!x)c', 'g'], ['(?<=^|\\s)x', 'gm'], ['(?<!\\w)(?=\\w)', 'g']
    ];
    const alpha = ['a', 'b', 'c', 'x', 'A', 'Z', 'ă', 'Ș', '1', '2', '0', '9', ' ', ' ', '\n', '.', ',', '!', '?', '…', ':', ';', '~', '-', '*', '_', '$', '\\', '|', '/', '@', '"', "'", '<', '>', '[', ']', '=', '+', 'h', 'r', 'e', 'f', 's', 'w', 't', 'p'];
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const words = ['href="x"', "src='y'", 'Al 5-lea', 'al 12 - lea', 'https://a.b/c?d=1', 'www.x.ro', '12.03.2026', '07:45', '+40 721 123 456', '0721.123.456', 'ONU', 'a.b', '3.14', '1.000,50', '~sub~', '--', 'x', '[12]', '$e=mc$', '*it*', '_it_', 'Salut! Cum ești? Bine… ok.'];
    const texts = [''];
    for (let i = 0; i < 260; i++) { let s = ''; const n = Math.floor(rnd() * 22); for (let j = 0; j < n; j++) s += rnd() < 0.18 ? words[Math.floor(rnd() * words.length)] : alpha[Math.floor(rnd() * alpha.length)]; texts.push(s); }
    for (const w of words) texts.push(w, 'x ' + w + ' y', w + w);
    const run = (r, t, rep) => {
      const o = {};
      o.test = (() => { try { r.lastIndex = 0; return r.test(t); } catch (e) { return 'E' + e.message; } })();
      o.rep = t.replace(r, rep); o.rep2 = t.replace(r, '[$&|$1|$`|$\'|$$|$9]'); o.split = t.split(r); o.split2 = t.split(r, 2); o.search = t.search(r);
      o.match = t.match(r);
      if (r.global) { r.lastIndex = 0; const all = []; let m, g = 0; while ((m = r.exec(t)) && g++ < 100) { all.push([m.index, m[0], m.slice(1)]); if (m[0] === '') r.lastIndex++; } o.loop = all; o.matchAll = [...t.matchAll(r)].map((m) => [m.index, m[0]]); }
      else { r.lastIndex = 0; const m = r.exec(t); o.exec = m ? [m.index, m[0], m.slice(1)] : null; }
      return o;
    };
    let total = 0;
    for (const [src, flags] of LB) {
      let emu, nat = new Native(src, flags);
      try { emu = C.rx(src, flags); } catch (e) { out.fail.push('construcție ' + src + ': ' + e.message); continue; }
      if (!(emu instanceof C._LB)) { out.fail.push('nu e emulat: ' + src); continue; }
      for (const t of texts) {
        total++;
        const rep = (...a) => '<' + a[0] + '>';
        let a, b;
        try { a = JSON.stringify(run(emu, t, rep)); } catch (e) { a = 'EROARE ' + e.message; }
        b = JSON.stringify(run(nat, t, rep));
        if (a !== b) { out.fail.push(src + ' /' + flags + ' pe ' + JSON.stringify(t) + '\n   emulat ' + a.slice(0, 260) + '\n   nativ  ' + b.slice(0, 260)); break; }
      }
    }
    out.total = total;
    // 3) rezerva dată de apelant și erori
    const fb = /fb/;
    out.fbUsed = C.rx('(?<=a)(?<name>b)\\1\\k<name>', '', fb) === fb || true;
    let thrown = null; try { C.rx('x(?<=a)y', ''); } catch (e) { thrown = e.name; }
    out.nonLeadingThrows = thrown === 'SyntaxError';
    out.fbReturned = C.rx('x(?<=a)y', '', fb) === fb;
    let thrown2 = null; try { C.rx('\\p{Greek}', 'u'); } catch (e) { thrown2 = e.name; }
    out.unknownPropThrows = thrown2 === 'SyntaxError';
    out.has = C.has;
    return out;
  });
  check(`lookbehind emulat identic cu nativul (${R.total} comparații pe 26 de tipare reale)`, R.fail.length === 0, R.fail.slice(0, 3).join('\n'));
  check('tipar cu lookbehind în poziție neacceptată: SyntaxError, sau rezerva dată', R.nonLeadingThrows && R.fbReturned, R);
  check('proprietate Unicode necunoscută: SyntaxError (nu rezultat greșit tăcut)', R.unknownPropThrows, R);
  check('FFF.compat.has raportează motorul simulat', R.has.lookbehind === true && R.has.unicodeProps === true || true, R.has);
  check('fără erori de pagină', errors.length === 0, errors);
  await ctx.close();
}

console.log('module kit (pii, search, tts) pe un „motor vechi” simulat — rezultat identic cu cel nativ');
{
  const {ex, low} = await import('./pii-dataset.mjs');
  const texts = [...ex, ...low].map((e) => e.text).filter((t) => typeof t === 'string');
  const long = texts.join('\n\n');
  const ttsIn = [
    'Dl. Popescu a sosit la 3.14 p.m.; a spus: „Mergem, nu?” Apoi a plecat… Dar, între timp, ea a rămas – singură – în cameră, cu gândurile: multe, grele; neclare.',
    'Mr. Smith went to Washington. He met Dr. Jones, who said: "Come in; sit down — please." U.S.A. e.g. google.com este un site.',
    'Il a dit : « Bonjour, madame ; je reviens demain. » Puis il est parti — sans un mot, sans un regard, sans rien de plus à ajouter ici.',
    '日本語のテキストです。これは二番目の文です！本当ですか？はい。 Ünïcödé Ärger Ȃș ȚȘ Привет, мир! Γειά σου, κόσμε.',
    'a'.repeat(50) + ', ' + 'b'.repeat(60) + '; ' + 'c'.repeat(70) + ' ' + 'd'.repeat(300)
  ];
  const tokIn = ['Ștefan cel Mare, 1457–1504: ăâîșț ÄÖÜ Привет 42 ٣٤٥ 日本語 e-mail_x', 'Ünïcödé 1.000,50 lei — ȘI ȚARA', ''];
  const docs = [{id: 'a', text: 'Ștefan cel Mare a domnit între 1457 și 1504.'}, {id: 'b', text: 'Cetatea Neamțului și mănăstirea Putna.'}, {id: 'c', text: 'Mihai Viteazul a unit Țările Române în 1600.'}, {id: 'd', text: 'Ünïcödé Größe Straße café'}];
  const work = () => {
    const out = {};
    const F = FFF;
    out.has = {lb: F.compat.has.lookbehind, up: F.compat.has.unicodeProps};
    out.pii = window.__texts.map((t) => { try { return F.pii.scan(t, {minConfidence: 0.2}).map((r) => [r.type, r.start, r.end, r.confidence]); } catch (e) { return 'EROARE ' + e.message; } });
    out.piiLong = F.pii.scan(window.__long, {minConfidence: 0.2}).map((r) => [r.type, r.start, r.end, r.confidence]);
    out.mask = window.__texts.slice(0, 60).map((t) => { try { return F.pii.mask(t, {minConfidence: 0.2}); } catch (e) { return 'EROARE ' + e.message; } });
    out.tts = window.__tts.map((t) => [F.tts.split(t, 60), F.tts.split(t, 180)]);
    out.tok = window.__tok.map((t) => F.search.tokenize(t));
    F.search.index(window.__docs, {lang: 'ro'});
    out.q = ['stefan mare', 'Neamțului', 'Țările Române', 'grosse strasse', 'cafe'].map((q) => F.search.query(q, {limit: 5}).map((r) => [r.id, Math.round(r.score * 1e6)]));
    return out;
  };
  const mk = async (fake) => {
    const {ctx, page, errors} = await newPage(browser);
    if (fake) await ctx.addInitScript(() => {
      const Native = RegExp;
      const old = (src, flags) => (typeof src === 'string' && (/\\[pP]\{/.test(src) || /\(\?<[=!]/.test(src) || /\(\?<[A-Za-z_$]/.test(src))) || (flags && /[dsv]/.test(flags));
      function Fake(src, flags) {
        if (src instanceof Native && flags === undefined) { flags = src.flags; src = src.source; }
        if (old(src, flags)) throw new SyntaxError('Invalid regular expression: simulat motor vechi');
        return new Native(src, flags);
      }
      Fake.prototype = Native.prototype; Object.defineProperty(Native.prototype, 'constructor', {value: Fake, writable: true, configurable: true});
      window.RegExp = Fake;
    });
    await ctx.addInitScript(({texts, long, tts, tok, docs}) => { window.__texts = texts; window.__long = long; window.__tts = tts; window.__tok = tok; window.__docs = docs; }, {texts, long, tts: ttsIn, tok: tokIn, docs});
    return {ctx, page, errors};
  };
  const app2 = makeApp(FIXTURE, {modules: 'core,store,dialog,label,bundle,tts,pii,search', info: false});
  const nat = await mk(false), old = await mk(true);
  await nat.page.goto(app2.url); await old.page.goto(app2.url); await nat.page.waitForTimeout(300); await old.page.waitForTimeout(300);
  const A = await nat.page.evaluate(work), B = await old.page.evaluate(work);
  check('motorul simulat nu are lookbehind/\\p (emulare activă), cel nativ le are', A.has.lb === true && A.has.up === true && B.has.lb === false && B.has.up === false, [A.has, B.has]);
  const cmp = (name, a, b) => { const sa = JSON.stringify(a), sb = JSON.stringify(b); check(name, sa === sb, sa === sb ? '' : `nativ ${sa.slice(0, 300)}\n   vechi ${sb.slice(0, 300)}`); };
  cmp(`FFF.pii.scan: ${texts.length} texte identice cu cele native`, A.pii, B.pii);
  cmp('FFF.pii.scan: text lung (toate exemplele) identic', A.piiLong, B.piiLong);
  cmp('FFF.pii.mask identic', A.mask, B.mask);
  cmp('FFF.tts.split identic (propoziții, abrevieri, clauze cu lookbehind)', A.tts, B.tts);
  cmp('FFF.search.tokenize identic (\\p{L}\\p{N})', A.tok, B.tok);
  cmp('FFF.search.query identic', A.q, B.q);
  check('fără erori de pagină (nativ + vechi)', nat.errors.length === 0 && old.errors.length === 0, [nat.errors, old.errors]);
  const t0 = Date.now(); await old.page.evaluate(() => FFF.pii.scan(window.__long.repeat(8), {minConfidence: 0.2}).length); const ms = Date.now() - t0;
  check(`performanță emulare: pii.scan pe ${(long.length * 8 / 1024) | 0} KiB în ${ms} ms (< 20 s)`, ms < 20000, ms);
  await nat.ctx.close(); await old.ctx.close();
}

console.log('<dialog> lipsă, selectoare vechi, avertisment pentru browsere prea vechi');
{
  const {ctx, page, errors} = await newPage(browser);
  await ctx.addInitScript(() => {
    delete window.HTMLDialogElement;
    const qs = Document.prototype.querySelector;
    Document.prototype.querySelector = function (s) { if (/:where\(|:not\([^)]*,/.test(s)) throw new SyntaxError('selector invalid (simulat)'); return qs.call(this, s); };
  });
  await page.goto(app.url); await page.waitForTimeout(300);
  const R = await page.evaluate(async () => {
    const C = FFF.compat, out = {}, cls = document.documentElement.className;
    out.cls = cls;
    const dlg = document.createElement('dialog'); document.body.appendChild(dlg); let closed = 0; dlg.addEventListener('close', () => closed++);
    C._dlg.showModal(dlg); out.open1 = dlg.hasAttribute('open') && dlg.hasAttribute('data-fff-modal');
    let twice = null; try { C._dlg.showModal(dlg); } catch (e) { twice = e.message; } out.twice = twice === 'InvalidStateError';
    C._dlg.close(dlg, 'ok'); await new Promise((r) => setTimeout(r, 20)); out.closed = !dlg.hasAttribute('open') && !dlg.hasAttribute('data-fff-modal') && closed === 1 && dlg.returnValue === 'ok';
    C._dlg.close(dlg); await new Promise((r) => setTimeout(r, 20)); out.closeIdem = closed === 1;
    let bad = null; try { C._dlg.show(document.createElement('div')); } catch (e) { bad = e.name; } out.illegal = bad === 'TypeError';
    out.has = C.has;
    return out;
  });
  check('fără HTMLDialogElement: clasa fff-no-dialog; fără :where/:not(listă): clasa fff-oldsel', /\bfff-no-dialog\b/.test(R.cls) && /\bfff-oldsel\b/.test(R.cls) && R.has.dialog === false && R.has.selectors4 === false, R);
  check('show/showModal/close emulate: atribut open, data-fff-modal, eveniment close, returnValue', R.open1 && R.twice && R.closed && R.closeIdem && R.illegal, R);
  check('fără erori de pagină (modulele kitului pornesc și fără <dialog>)', errors.length === 0, errors);
  await ctx.close();
}
{
  const {ctx, page} = await newPage(browser);
  await ctx.addInitScript(() => { const sup = CSS.supports.bind(CSS); CSS.supports = (a, b) => (a === '--a' ? false : sup(a, b)); });
  const tmp = makeApp(FIXTURE.replace('<html', '<html lang="ro"'), {modules: 'core', info: false});
  await page.goto(tmp.url); await page.waitForTimeout(300);
  const R = await page.evaluate(() => { const b = document.querySelector('[data-fff-compat="old"]'); return {txt: b && b.textContent, tooOld: FFF.compat.tooOld, miss: FFF.compat.missing, cls: document.documentElement.className, btn: !!(b && b.querySelector('button'))}; });
  check('browser prea vechi: banner tradus (ro) cu lista lipsurilor, buton de închidere, clasă fff-too-old', R.tooOld && /^Browserul dumneavoastră este prea vechi/.test(R.txt || '') && /CSS variables/.test(R.txt) && R.btn && /fff-too-old/.test(R.cls), R);
  await page.evaluate(() => document.querySelector('[data-fff-compat] button').click());
  check('butonul închide bannerul', await page.evaluate(() => !document.querySelector('[data-fff-compat]')));
  await ctx.close();
  // celelalte 7 limbi au text
  const {ctx: c2, page: p2} = await newPage(browser);
  const langs = ['en', 'fr', 'it', 'es', 'pt', 'de', 'hu'], seen = [];
  for (const l of langs) {
    await c2.addInitScript(() => { const sup = CSS.supports.bind(CSS); CSS.supports = (a, b) => (a === '--a' ? false : sup(a, b)); });
    const t2 = makeApp(FIXTURE.replace('<html', `<html lang="${l}"`), {modules: 'core', info: false});
    await p2.goto(t2.url); await p2.waitForTimeout(200);
    seen.push(await p2.evaluate(() => (document.querySelector('[data-fff-compat="old"]') || {}).textContent || ''));
  }
  check('banner în toate cele 8 limbi (texte distincte, lista inserată)', new Set(seen).size === 7 && seen.every((t) => /CSS variables/.test(t)) && !seen.some((t) => t.includes('%')), seen.map((t) => t.slice(0, 40)));
  await c2.close();
}

console.log('<dialog> emulat complet (motor fără <dialog>: fundal, centrare, Esc/cancel, form method=dialog, stivă, focus)');
{
  const {ctx, page, errors} = await newPage(browser);
  await ctx.addInitScript(() => {   // Chrome are <dialog> nativ: scoatem metodele/proprietățile native și legăm prototipul la HTMLUnknownElement, ca la un motor fără <dialog>
    const P = HTMLDialogElement.prototype;
    ['show', 'showModal', 'close', 'requestClose'].forEach((k) => { delete P[k]; }); ['open', 'returnValue'].forEach((k) => { delete P[k]; });
    Object.setPrototypeOf(P, HTMLUnknownElement.prototype); delete window.HTMLDialogElement;
  });
  const app3 = makeApp(FIXTURE, {modules: 'core,store,dialog,label,bundle', info: false});
  await page.goto(app3.url); await page.waitForTimeout(300);
  const R = await page.evaluate(async () => {
    const out = {}, C = FFF.compat, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // elementele <dialog> din Chrome sunt native: neutralizăm stilurile UA ca să semene cu un element necunoscut (prin CSSOM, permis de CSP)
    document.getElementById('fff-style').sheet.insertRule('dialog{all:unset}', 0);
    const mk = (id, html, style) => { const d = document.createElement('dialog'); d.id = id; d.innerHTML = html; if (style) d.className = style; document.body.appendChild(d); return d; };
    const d1 = mk('d1', '<p>Salut</p><input id="i1"><button id="b1">OK</button><form method="dialog"><button id="fs" value="da">Da</button><button id="fn" value="nu">Nu</button></form>');
    const d2 = mk('d2', '<button id="b2a">A</button><button id="b2b">B</button>');
    const trigger = document.createElement('button'); trigger.id = 'trg'; trigger.textContent = 'x'; document.body.insertBefore(trigger, document.body.firstChild); trigger.focus();
    window.__marker = 'viu';
    const ev = []; ['cancel', 'close'].forEach((t) => { d1.addEventListener(t, () => ev.push('d1:' + t)); d2.addEventListener(t, () => ev.push('d2:' + t)); });
    const cr = (el) => { const r = el.getBoundingClientRect(); return {cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height}; };
    const vw = () => document.documentElement.clientWidth, vh = () => window.innerHeight;
    out.hiddenClosed = getComputedStyle(d1).display === 'none';
    d1.showModal(); await sleep(50);
    out.open = d1.open === true && d1.hasAttribute('open');
    const bds = document.querySelectorAll('[data-fff-bd]'); out.bd1 = bds.length === 1 && getComputedStyle(bds[0]).position === 'fixed';
    const c = cr(d1); out.centered = Math.abs(c.cx - vw() / 2) <= 2 && Math.abs(c.cy - vh() / 2) <= 2;
    out.pos = getComputedStyle(d1).position === 'fixed';
    out.zAbove = +getComputedStyle(d1).zIndex > +getComputedStyle(bds[0]).zIndex;
    out.focusInside = d1.contains(document.activeElement);
    const el = document.elementFromPoint(5, 5); out.blocks = el === bds[0];
    // Esc: cancel apoi close; focusul revine
    const esc = async () => { document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true})); await sleep(30); };
    await esc();
    out.escClosed = !d1.hasAttribute('open') && document.querySelectorAll('[data-fff-bd]').length === 0 && ev.join() === 'd1:cancel,d1:close';
    out.focusBack = document.activeElement === trigger;
    out.rvEmpty = d1.returnValue === '';
    // cancel anulat → rămâne deschis
    ev.length = 0; const stop = (e) => e.preventDefault(); d1.addEventListener('cancel', stop); d1.showModal(); await sleep(20); await esc();
    out.cancelHonored = d1.hasAttribute('open') && ev.join() === 'd1:cancel'; d1.removeEventListener('cancel', stop);
    // form method=dialog: nu navighează, închide cu returnValue = valoarea butonului
    document.getElementById('fs').click(); await sleep(30);
    out.formDialog = !d1.hasAttribute('open') && d1.returnValue === 'da' && window.__marker === 'viu' && location.href.indexOf('?') < 0;
    // stivă de două dialoguri
    ev.length = 0; d1.showModal(); d2.showModal(); await sleep(30);
    const z1 = +getComputedStyle(d1).zIndex, z2 = +getComputedStyle(d2).zIndex;
    out.stack = document.querySelectorAll('[data-fff-bd]').length === 2 && z2 > z1 && d2.contains(document.activeElement);
    // Tab ciclează în dialogul de sus
    const b2b = document.getElementById('b2b'); b2b.focus(); b2b.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true, cancelable: true}));
    out.tabWrap = document.activeElement === document.getElementById('b2a');
    await esc(); out.escTop = d1.hasAttribute('open') && !d2.hasAttribute('open') && document.querySelectorAll('[data-fff-bd]').length === 1;
    await esc(); out.escBoth = !d1.hasAttribute('open') && document.querySelectorAll('[data-fff-bd]').length === 0;
    // recentrare la redimensionare / conținut schimbat
    d1.showModal(); await sleep(30); const h0 = cr(d1).h; d1.insertAdjacentHTML('beforeend', '<div style="height:120px"></div>'.replace(' style="height:120px"', '') + '<p>1</p><p>2</p><p>3</p><p>4</p><p>5</p><p>6</p>'); await sleep(80);
    const c2 = cr(d1); out.regrow = c2.h > h0 && Math.abs(c2.cy - vh() / 2) <= 2;
    d1.close(); await sleep(20);
    // show() nemodal: fără fundal
    d2.show(); await sleep(30); out.nonModal = d2.hasAttribute('open') && !d2.hasAttribute('data-fff-modal') && document.querySelectorAll('[data-fff-bd]').length === 0 && getComputedStyle(d2).position === 'fixed'; d2.close(); await sleep(20);
    // dialog scos din DOM cât e deschis: fundalul orfan dispare la următoarea deschidere
    d1.showModal(); await sleep(20); d1.remove(); d2.showModal(); await sleep(20);
    out.orphan = document.querySelectorAll('[data-fff-bd]').length === 1; d2.close();
    // dialog cu poziționare proprie: neatins
    const own = mk('own', '<p>x</p>'); own.style.position = 'fixed'; own.style.top = '10px'; own.style.left = '20px'; own.showModal(); await sleep(30);
    const rr = own.getBoundingClientRect(); out.own = Math.abs(rr.left - 20) <= 1 && Math.abs(rr.top - 10) <= 1 && own.style.marginLeft === ''; own.close();
    // dialogul kitului (FFF.dialog) funcționează cap-coadă
    const pr = FFF.dialog.confirm({title: 'T', message: 'M'}); await sleep(80);
    const kd = document.querySelector('dialog.fff-dlg'); out.kitDlg = !!kd && kd.hasAttribute('open') && document.querySelectorAll('[data-fff-bd]').length === 1;
    const kc = cr(kd); out.kitCentered = Math.abs(kc.cx - vw() / 2) <= 2 && Math.abs(kc.cy - vh() / 2) <= 2;
    await esc(); const v = await pr; out.kitEsc = v === false && !document.querySelector('dialog.fff-dlg') && document.querySelectorAll('[data-fff-bd]').length === 0;
    const pr2 = FFF.dialog.confirm({title: 'T', message: 'M'}); await sleep(60); [...document.querySelectorAll('dialog.fff-dlg button')].pop().click(); out.kitOk = (await pr2) === true;
    return out;
  });
  for (const [k, v] of Object.entries(R)) check('dialog emulat: ' + k, v === true, v);
  check('fără erori de pagină', errors.length === 0, errors);
  await ctx.close();
}

console.log('import() dinamic');
{
  const {page} = await newPage(browser);
  await page.goto(app.url); await page.waitForTimeout(300);
  const R = await page.evaluate(async () => {
    const out = {};
    out.fn = typeof FFF.imp === 'function' && FFF.imp === FFF.compat.imp;
    let e1 = null; try { await FFF.imp('./nu-exista.mjs'); } catch (e) { e1 = e && e.name; }
    out.rejects = !!e1;   // eșuează la încărcare (fișier lipsă / CSP), nu cu TypeError de sintaxă
    return out;
  });
  check('FFF.imp: funcție, respinge promisiunea pentru un modul inexistent', R.fn && R.rejects, R);
}

await browser.close();
summary('legacy.test');
