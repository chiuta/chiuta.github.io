// Teste FFF.ux (kit 1.5.0): ținte de atingere, câmpuri ≥16 px, confirmări (copiere/salvare), „/” → căutare, opriri. Rulare: node test/ux.test.mjs
import {makeApp, launch, check, summary, sleep, axe} from './_pw.mjs';

const browser = await launch();
function page(extra = '', head = '') {
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>t</title>${head}
<style>body{font:15px/1.5 sans-serif;margin:0;background:#fff;color:#111}main{padding:12px}.mic{height:24px;width:24px;padding:0}input,select{font-size:12px}.tall{min-height:60px}a.btn{display:block;height:20px;width:80px;background:#ddd}</style></head><body>
<main><h1>Titlu</h1><p>Text <a href="#x" id="inl">legătură în text</a></p>
<button id="b1" class="mic" aria-label="mic">×</button><button id="b2" class="tall">Mare</button><button id="b3" style="min-height:10px">Propriu</button>
<a class="btn" id="lnk" href="#y">Buton-link</a>
<label for="s">Caută</label><input id="s" type="search" placeholder="Caută…"><input id="t" type="text" aria-label="text"><select id="sel" aria-label="sel"><option>1</option></select><input id="cb" type="checkbox" aria-label="cb">
<button id="copy">Copiază</button><button id="copyown">Copiază+mesaj</button><button id="dl">Salvează</button><button id="dlown">Salvează+mesaj</button><div id="msg" role="status"></div>
${extra}</main>
<script>
document.getElementById('copy').onclick=function(){navigator.clipboard.writeText('abc')};
document.getElementById('copyown').onclick=function(){navigator.clipboard.writeText('abc');document.getElementById('msg').textContent='Copiat!'};
function dl(own){var a=document.createElement('a');a.href='data:text/plain,abc';a.download='fisier.txt';document.body.appendChild(a);a.click();a.remove();if(own)document.getElementById('msg').textContent='Exportat cu succes'}
document.getElementById('dl').onclick=function(){dl(false)};document.getElementById('dlown').onclick=function(){dl(true)};
</script></body></html>`;
}
async function open(url, {touch = true, query = '', w = 390, h = 844} = {}) {
  const ctx = await browser.newContext({viewport: {width: w, height: h}, isMobile: touch, hasTouch: touch, permissions: ['clipboard-read', 'clipboard-write']});
  await ctx.route(/^https?:/, (r) => r.abort());
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url + query); await p.waitForTimeout(700);
  return {ctx, p, errors};
}
const app = makeApp(page(), {modules: 'core,dialog,ux', info: false});
const H = (p, sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }, sel);

console.log('ecran tactil');
{
  const {ctx, p, errors} = await open(app.url);
  check('API prezent', await p.evaluate(() => !!(FFF.ux && FFF.ux.hitPass)));
  let [w, h] = await H(p, '#b1');
  check('buton mic (24 px) ajunge la 44×44', w >= 44 && h >= 44, w + '×' + h);
  [w, h] = await H(p, '#b2'); check('buton deja mare rămâne mare', h >= 60, String(h));
  [w, h] = await H(p, '#b3'); check('înălțimea proprie mică (min-height în stilul inline) are prioritate', h <= 44, String(h));
  [w, h] = await H(p, '#t'); check('câmp text ≥ 44 px înălțime', h >= 44, String(h));
  check('câmp text: font ≥16 px (fără zoom iOS)', await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('t')).fontSize) >= 16));
  check('select: font ≥16 px', await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('sel')).fontSize) >= 16));
  await sleep(700);
  check('legătură-buton (display:block, 20 px) primește zonă de atingere', await p.evaluate(() => document.getElementById('lnk').hasAttribute('data-fff-hit') && document.getElementById('lnk').getBoundingClientRect().height >= 44));
  check('legătura din text nu e modificată', await p.evaluate(() => !document.getElementById('inl').hasAttribute('data-fff-hit')));
  check('touch-action: manipulation pe butoane', await p.evaluate(() => getComputedStyle(document.getElementById('b2')).touchAction === 'manipulation'));
  check('fără depășire orizontală', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  check('fără erori de pagină', errors.length === 0, errors.join('|'));
  const ax = await axe(p); check('axe 0 violări', ax.length === 0, JSON.stringify(ax.map((v) => v.id)));
  await ctx.close();
}

console.log('mouse (desktop): mărimile proprii rămân');
{
  const {ctx, p} = await open(app.url, {touch: false, w: 1280, h: 800});
  const [w, h] = await H(p, '#b1'); check('buton mic rămâne mic pe desktop', w <= 30 && h <= 30, w + '×' + h);
  check('câmp: fontul propriu rămâne 12 px', await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('t')).fontSize) === 12));
  await ctx.close();
}

console.log('confirmări');
{
  const {ctx, p} = await open(app.url);
  await p.click('#copy'); await sleep(900);
  check('copiere fără mesaj propriu → toast „Copiat”', await p.evaluate(() => /Copiat/.test(document.querySelector('[data-fff-toasts]')?.textContent || '')));
  await ctx.close();
}
{
  const {ctx, p} = await open(app.url);
  await p.click('#copyown'); await sleep(900);
  check('copiere cu mesaj propriu → fără dublură', await p.evaluate(() => !/Copiat/.test(document.querySelector('[data-fff-toasts]')?.textContent || '')));
  await ctx.close();
}
{
  const {ctx, p} = await open(app.url);
  await p.click('#dl'); await sleep(900);
  check('descărcare fără mesaj propriu → toast cu numele fișierului', await p.evaluate(() => /Salvat: fisier\.txt/.test(document.querySelector('[data-fff-toasts]')?.textContent || '')));
  await ctx.close();
}
{
  const {ctx, p} = await open(app.url);
  await p.click('#dlown'); await sleep(900);
  check('descărcare cu mesaj propriu → fără dublură', await p.evaluate(() => !/Salvat:/.test(document.querySelector('[data-fff-toasts]')?.textContent || '')));
  await ctx.close();
}

console.log('tastatură');
{
  const {ctx, p} = await open(app.url, {touch: false, w: 1280, h: 800});
  await p.keyboard.press('/'); await sleep(100);
  check('„/” duce focusul în câmpul de căutare', await p.evaluate(() => document.activeElement && document.activeElement.id === 's'));
  await p.keyboard.type('a/b');
  check('„/” scris într-un câmp nu e interceptat', await p.evaluate(() => document.getElementById('s').value === 'a/b'));
  await p.keyboard.press('Escape'); await sleep(50);
  check('Esc părăsește câmpul de căutare', await p.evaluate(() => document.activeElement.id !== 's'));
  await ctx.close();
}

console.log('opriri');
{
  const {ctx, p} = await open(app.url, {query: '?noux=1'});
  const [w, h] = await H(p, '#b1'); check('?noux=1: butonul mic rămâne mic', w <= 30 && h <= 30, w + '×' + h);
  check('?noux=1: fără confirmări', await p.evaluate(() => { document.getElementById('copy').click(); return true; }));
  await sleep(800); check('?noux=1: fără toast', await p.evaluate(() => !/Copiat/.test(document.querySelector('[data-fff-toasts]')?.textContent || '')));
  await ctx.close();
}
{
  const app2 = makeApp(page('', '<meta name="fff-ux" content="off">'), {modules: 'core,dialog,ux', info: false});
  const {ctx, p} = await open(app2.url);
  const [w, h] = await H(p, '#b1'); check('<meta fff-ux=off>: butonul mic rămâne mic', w <= 30 && h <= 30, w + '×' + h);
  await ctx.close();
}
await browser.close();
summary('ux');
