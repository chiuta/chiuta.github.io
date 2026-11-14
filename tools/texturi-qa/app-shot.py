#!/usr/bin/env python3
"""Captură a unei aplicații/pagini HTML cu texturile fractale forțate (sau oprite) în Chrome headless cu WebGL2 (SwiftShader).
Utilizare: app-shot.py <fișier.html|url> <out.png> [--w 1280] [--h 800] [--full] [--dark] [--off] [--size 512] [--wait 600] [--scroll Y]
  --off     fără texturi (?notex=1), pentru „înainte”
  --size N  dimensiunea plăcii (implicit 512 aici, ca să fie repede în SwiftShader)
Scrie pe stdout un JSON cu: info (FFF.texturi.info()), erori de consolă, încălcări CSP, ms până la textură, nr. de elemente marcate."""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

a = sys.argv[1:]
src, out = a[0], a[1]


def opt(name, default=None, cast=str):
    if name in a:
        i = a.index(name)
        return cast(a[i + 1])
    return default


W, H = opt('--w', 1280, int), opt('--h', 800, int)
SIZE, WAIT, SCROLL = opt('--size', 512, int), opt('--wait', 600, int), opt('--scroll', 0, int)
FULL, DARK, OFF = '--full' in a, '--dark' in a, '--off' in a
url = src if '://' in src else 'file://' + os.path.abspath(src)
if OFF:
    url += ('&' if '?' in url else '?') + 'notex=1'
ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files']
INIT = """
window.FFF_TEXTURI_FORCE = 1; window.FFF_TEXTURI_SIZE = %d; window.__csp = []; window.__t0 = performance.now();
document.addEventListener('securitypolicyviolation', function (e) { window.__csp.push(e.violatedDirective + ' ← ' + String(e.blockedURI).slice(0, 80)); });
""" % SIZE
res = {'url': url, 'errors': []}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
    ctx = b.new_context(viewport={'width': W, 'height': H}, color_scheme='dark' if DARK else 'light')
    ctx.add_init_script(INIT)
    pg = ctx.new_page()
    pg.on('console', lambda m: res['errors'].append(m.type + ': ' + m.text[:200]) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: res['errors'].append('PAGEERROR: ' + str(e)[:200]))
    pg.goto(url, wait_until='load')
    if not OFF:
        t_end = time.time() + 240
        while time.time() < t_end:  # sondare cu evaluate (wait_for_function ar folosi eval, blocat de CSP-ul aplicațiilor)
            if pg.evaluate('window.FFF && FFF.texturi ? FFF.texturi.info() : null'):
                break
            time.sleep(0.4)
        else:
            res['errors'].append('TIMEOUT textura')
    pg.wait_for_timeout(WAIT)
    if SCROLL:
        pg.evaluate('window.scrollTo(0, %d)' % SCROLL)
        pg.wait_for_timeout(200)
    res['info'] = pg.evaluate('window.FFF && FFF.texturi ? FFF.texturi.info() : null')
    res['marked'] = pg.evaluate("document.querySelectorAll('[data-fffx]').length")
    res['csp'] = pg.evaluate('window.__csp')
    res['scrollH'] = pg.evaluate('document.documentElement.scrollHeight')
    pg.screenshot(path=out, full_page=FULL)
    b.close()
res['errors'] = res['errors'][:8]
print(json.dumps(res, ensure_ascii=False))
