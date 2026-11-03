#!/usr/bin/env python3
"""Construiește demo/nativ/ din captures/*.json (ieșiri reale, record.py) + narration.py (8 limbi).

Rulare:  <python cu espeakng-loader, Pillow>  tools/native-demos/build.py [--no-video] [--no-audio]
  pip install espeakng-loader Pillow     (espeak-ng: GPL-3.0, rulează local; fără TTS cloud). ffmpeg în PATH.
Produce în demo/nativ/: index.html, nativ.css, nativ.js, nativ-data.js, <slug>.cast (asciicast v2), <slug>.<lang>.vtt,
  <slug>.mp4 (+ poster), audio/<slug>.<lang>.ogg (voce sintetică, Opus), <slug>-offline.html (un singur fișier: totul inline).
Ritmul (pauze, tastare) e montat; textul ecranului e ieșirea reală. Traducerile fr/it/es/pt/de/hu sunt automate (marcate în pagină)."""
import base64, hashlib, html, json, os, pathlib, shutil, subprocess, sys, tempfile, wave

HERE = pathlib.Path(__file__).resolve().parent
HUB = HERE.parents[1]
OUT = HUB / 'demo' / 'nativ'
sys.path.insert(0, str(HERE))
from narration import NARR, TITLES, UI, LANGS

COLS, ROWS = 100, 26
SLUGS = ['tezaur', 'veriga', 'legatorocr', 'osatura']
REPO = {'tezaur': 'TEZAUR', 'veriga': 'VERIGA', 'legatorocr': 'LegatorOCR', 'osatura': 'osatura'}
ESPEAK = {'ro': 'ro', 'en': 'en-us', 'fr': 'fr', 'it': 'it', 'es': 'es', 'pt': 'pt', 'de': 'de', 'hu': 'hu'}
TTS_RATE = 150
NO_VIDEO = '--no-video' in sys.argv
NO_AUDIO = '--no-audio' in sys.argv
FFMPEG_OPTS = ['-preset', 'veryfast']

# ---------------------------------------------------------------- ecran de terminal (oglinda lui Screen din nativ.js)
FGN = {30: '0', 31: '1', 32: '2', 33: '3', 34: '4', 35: '5', 36: '6', 37: '7', 90: '8', 97: '9'}

class Screen:
    def __init__(self): self.reset()
    def reset(self):
        self.rows = [dict() for _ in range(ROWS)]; self.r = 0; self.c = 0; self.fg = '0'; self.bold = False; self.esc = ''
    def lf(self):
        self.r += 1
        if self.r >= ROWS:
            self.rows.pop(0); self.rows.append(dict()); self.r = ROWS - 1
    def write(self, s):
        for ch in s:
            if self.esc:
                self.esc += ch
                if len(self.esc) == 2 and ch != '[': self.esc = ''; continue
                if len(self.esc) > 2 and '@' <= ch <= '~': self.csi(self.esc[2:-1], ch); self.esc = ''
                continue
            if ch == '\x1b': self.esc = ch; continue
            if ch == '\r': self.c = 0; continue
            if ch == '\n': self.lf(); continue
            if ch < ' ': continue
            if self.c >= COLS: self.c = 0; self.lf()
            self.rows[self.r][self.c] = (ch, self.fg, self.bold); self.c += 1
    def csi(self, p, f):
        if f == 'm':
            for a in (p.split(';') if p else ['0']):
                n = int(a or 0)
                if n == 0: self.fg = '0'; self.bold = False
                elif n == 1: self.bold = True
                elif n in FGN: self.fg = FGN[n]
                elif n == 39: self.fg = '0'
        elif f == 'J' and p == '2':
            self.rows = [dict() for _ in range(ROWS)]; self.r = 0; self.c = 0
        elif f == 'H': self.r = 0; self.c = 0
    def key(self): return (tuple(tuple(sorted(r.items())) for r in self.rows), self.r, self.c)

# ---------------------------------------------------------------- scenariu: cast + cronologie
PROMPT = '\x1b[32m$\x1b[0m '

def tts(text, lang, path):
    import ctypes, espeakng_loader as L
    global _lib, _buf
    if '_lib' not in globals():
        CB = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
        _lib = ctypes.CDLL(L.get_library_path()); _lib.espeak_Initialize.restype = ctypes.c_int
        globals()['_rate'] = _lib.espeak_Initialize(2, 0, L.get_data_path().encode(), 0)
        _buf = bytearray()
        def cb(w, n, ev):
            if w and n > 0: _buf.extend(ctypes.string_at(w, n * 2))
            return 0
        globals()['_cb'] = CB(cb); _lib.espeak_SetSynthCallback(_cb)
    _buf.clear()
    if _lib.espeak_SetVoiceByName(ESPEAK[lang].encode()) != 0: raise SystemExit('voce indisponibilă: ' + lang)
    _lib.espeak_SetParameter(1, TTS_RATE, 0)
    t = text.encode() + b'\0'
    _lib.espeak_Synth(t, len(t), 0, 0, 0, 1, None, None); _lib.espeak_Synchronize()
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(_rate); w.writeframes(bytes(_buf))
    return len(_buf) / 2 / _rate

def build_prog(slug, tmp):
    cap = json.loads((HERE / 'captures' / (slug + '.json')).read_text(encoding='utf8'))
    narr = NARR[slug]; assert len(narr) == len(cap['scenes']), (slug, len(narr), len(cap['scenes']))
    # durata vocii pe scenă/limbă
    dur = {}
    for i, sc in enumerate(narr):
        for l in LANGS:
            w = tmp / f'{slug}-{i}-{l}.wav'
            dur[(i, l)] = tts(sc[l], l, w) if (not NO_AUDIO or True) else 0
    events = []; scenes = []; t = 0.0
    def put(at, text): events.append([round(at, 3), 'o', text])
    for i, cmds in enumerate(cap['scenes']):
        t0 = t
        if i > 0: put(t0, '\x1b[2J\x1b[H')
        tt = t0 + 0.35
        for k, c in enumerate(cmds):
            put(tt, PROMPT); tt += 0.2
            cmd = c['cmd']; step = min(0.035, 2.4 / max(1, len(cmd)))
            for ch in cmd: put(tt, ch); tt += step
            tt += 0.35; put(tt, '\r\n')
            lines = c['out'].replace('\r', '').split('\n')
            if lines and lines[-1] == '': lines.pop()
            ls = min(0.07, 2.4 / max(1, len(lines)))
            for ln in lines: put(tt, ln + '\r\n'); tt += ls
            tt += 0.9 if k < len(cmds) - 1 else 0.3
        need = max(max(dur[(i, l)] for l in LANGS) + 1.5, tt - t0 + 1.2)
        scenes.append({'t0': round(t0, 3), 't1': round(t0 + need, 3), 'narr': {l: narr[i][l] for l in LANGS}, 'cmds': [c['cmd'] for c in cmds], 'outs': [c['out'] for c in cmds],
                       'codes': [c['code'] for c in cmds], 'voice': {l: round(dur[(i, l)], 3) for l in LANGS}})
        t = t0 + need
    total = round(t + 1.0, 3)
    cues = {l: [[round(s['t0'] + 0.4, 3), round(s['t0'] + 0.4 + s['voice'][l] + 0.25, 3), s['narr'][l]] for s in scenes] for l in LANGS}
    return {'slug': slug, 'name': TITLES[slug][0], 'desc': TITLES[slug][1], 'version': cap['version'], 'dur': total, 'events': events, 'scenes': scenes, 'cues': cues}

def vtt_time(x):
    ms = int(round(x * 1000)); return '%02d:%02d:%02d.%03d' % (ms // 3600000, ms // 60000 % 60, ms // 1000 % 60, ms % 1000)

def write_cast(p):
    hdr = {'version': 2, 'width': COLS, 'height': ROWS, 'timestamp': 1793700000, 'title': f"{p['name']} — {p['version']}", 'idle_time_limit': 3,
           'env': {'SHELL': '/bin/bash', 'TERM': 'xterm-256color'}}
    lines = [json.dumps(hdr, ensure_ascii=False)] + [json.dumps(e, ensure_ascii=False, separators=(',', ':')) for e in p['events']]
    (OUT / (p['slug'] + '.cast')).write_text('\n'.join(lines) + '\n', encoding='utf8')

def write_vtt(p):
    for l in LANGS:
        out = ['WEBVTT', '']
        for a, b, tx in p['cues'][l]: out += [f'{vtt_time(a)} --> {vtt_time(b)}', tx, '']
        (OUT / f"{p['slug']}.{l}.vtt").write_text('\n'.join(out), encoding='utf8')

def write_audio(p, tmp):
    (OUT / 'audio').mkdir(exist_ok=True)
    for l in LANGS:
        # o singură pistă pe limbă: pauză până la începutul fiecărei scene, apoi vocea
        parts = []; pos = 0.0
        sr = None
        pcm = bytearray()
        for i, s in enumerate(p['scenes']):
            with wave.open(str(tmp / f"{p['slug']}-{i}-{l}.wav")) as w: sr = w.getframerate(); data = w.readframes(w.getnframes())
            start = s['t0'] + 0.4
            gap = int((start - len(pcm) / 2 / sr) * sr)
            if gap > 0: pcm.extend(b'\0\0' * gap)
            pcm.extend(data)
        pcm.extend(b'\0\0' * int(max(0, p['dur'] - len(pcm) / 2 / sr) * sr))
        wp = tmp / f"{p['slug']}-{l}.wav"
        with wave.open(str(wp), 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(bytes(pcm))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wp), '-c:a', 'libopus', '-b:a', '14k', '-application', 'voip', str(OUT / 'audio' / f"{p['slug']}.{l}.ogg")], check=True)

# ---------------------------------------------------------------- video (cadre PIL -> ffmpeg)
PAL = {'0': (230, 227, 245), '1': (255, 123, 123), '2': (94, 234, 212), '3': (240, 200, 110), '4': (140, 160, 255), '5': (200, 150, 255), '6': (110, 220, 240), '7': (255, 255, 255), '8': (140, 136, 170), '9': (255, 255, 255)}
BG = (13, 11, 26)

def render_video(p):
    from PIL import Image, ImageDraw, ImageFont
    fr = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 18)
    fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 18)
    ft = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
    W, H, CW, CH, X0, Y0 = 1280, 720, 11, 24, 90, 64
    fps = 10; n = int(p['dur'] * fps) + 1
    ev = p['events']; scr = Screen(); i = 0; last_key = None; last_bytes = None
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-', '-c:v', 'libx264', *FFMPEG_OPTS, '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', str(OUT / (p['slug'] + '.mp4'))]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    poster = None
    for f in range(n):
        t = f / fps
        while i < len(ev) and ev[i][0] <= t: scr.write(ev[i][2]); i += 1
        cur = int(t * 2) % 2 == 0
        key = (scr.key(), cur)
        if key != last_key:
            im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
            d.rounded_rectangle((X0 - 20, Y0 - 44, X0 + CW * COLS + 20, Y0 + CH * ROWS + 16), 10, fill=(20, 17, 38), outline=(42, 38, 68))
            for k, col in enumerate(((255, 95, 86), (255, 189, 46), (39, 201, 63))): d.ellipse((X0 - 6 + k * 22, Y0 - 32, X0 + 8 + k * 22, Y0 - 18), fill=col)
            d.text((X0 + 80, Y0 - 36), f"{p['name']}  {p['version']}", font=ft, fill=(154, 149, 184))
            for y, row in enumerate(scr.rows):
                for x, (ch, fg, b) in row.items(): d.text((X0 + x * CW, Y0 + y * CH), ch, font=fb if b else fr, fill=PAL.get(fg, PAL['0']))
            if cur: d.rectangle((X0 + scr.c * CW, Y0 + scr.r * CH + 2, X0 + scr.c * CW + CW - 1, Y0 + scr.r * CH + CH - 3), fill=(157, 139, 255))
            last_bytes = im.tobytes(); last_key = key
            if poster is None and t >= p['scenes'][min(1, len(p['scenes']) - 1)]['t0'] + 4: poster = im.copy()
        pr.stdin.write(last_bytes)
    pr.stdin.close(); pr.wait()
    if poster is None: poster = Image.frombytes('RGB', (W, H), last_bytes)
    poster.convert('RGB').resize((640, 360)).save(OUT / (p['slug'] + '.jpg'), quality=80, optimize=True)

# ---------------------------------------------------------------- HTML
def esc(s): return html.escape(s, quote=True)

def section_html(p, offline=False):
    slug = p['slug']; l = 'ro'; U = UI[l]
    sc = []
    for i, s in enumerate(p['scenes']):
        cmds = ''.join(f'<li><code class="cmd">$ {esc(c)}</code><pre class="out" tabindex="0">{esc(o)}</pre></li>' for c, o in zip(s['cmds'], s['outs']))
        sc.append(f'<li><p class="narr" lang="{l}" data-n="{slug}:{i}">{esc(s["narr"][l])}</p><ul class="cmds" aria-label="{esc(U["cmdhdr"])}">{cmds}</ul></li>')
    links = []
    if not offline:
        links += [f'<a href="{slug}.cast" download>{esc(U["cast"])}</a>', f'<a data-vtt="{slug}" href="{slug}.ro.vtt" download>{esc(U["vtt"])}</a>',f'<a href="{slug}.mp4" download>{esc(U["video"])}</a>', f'<a href="{slug}-offline.html">{esc(U["offline"])}</a>']
    links.append(f'<a href="https://github.com/chiuta/{REPO[slug]}" rel="noopener noreferrer">{esc(U["gh"])}</a>')
    links_html = ' · '.join(links)
    for k, v in (('cast', 'cast'), ('vtt', 'vtt'), ('video', 'video'), ('offline', 'offline'), ('gh', 'gh')):
        links_html = links_html.replace('>' + esc(U[k]) + '<', f' data-ui="{k}">' + esc(U[k]) + '<', 1)
    video = ''
    if not offline:
        tr = ''.join(f'<track kind="subtitles" src="{slug}.{x}.vtt" srclang="{x}" label="{x.upper()}">' for x in LANGS)
        video = f'<details class="vid"><summary data-ui="video">{esc(U["video"])}</summary><video data-slug="{slug}" controls preload="none" playsinline poster="{slug}.jpg" src="{slug}.mp4">{tr}</video></details>'
    return f'''<section class="prog" id="{slug}" aria-labelledby="h-{slug}">
<h2 id="h-{slug}">{esc(p["name"])} <small>{esc(p["version"])}</small></h2>
<p class="pdesc" data-t="{slug}" lang="ro">{esc(p["desc"]["ro"])}</p>
<div class="player" data-slug="{slug}">
<pre class="term" role="img" aria-label="{esc(U["term"])}: {esc(p["name"])}"></pre>
<div class="subline empty" aria-hidden="true"></div>
<div class="ctl"></div>
<div class="scenes" role="group" aria-label="{esc(U["scene"])}"></div>
<p class="nojs" data-ui="no_js">{esc(U["no_js"])}</p>
</div>
<p class="links">{links_html}</p>
{video}
<details class="transcript"><summary data-ui="transcript">{esc(U["transcript"])}</summary><ol>{"".join(sc)}</ol></details>
</section>'''

def page_html(progs, offline_slug=None, css='', js='', data_js='', hashes=None, audio_data=None):
    U = UI['ro']
    body = ''.join(section_html(p, bool(offline_slug)) for p in progs)
    nav_back = '' if offline_slug else '<a href="./">' + '</a>'  # (nu se folosește)
    csp = ("default-src 'none'; img-src 'self' data:; media-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
           if not offline_slug else
           "default-src 'none'; img-src data:; media-src data:; style-src " + ' '.join(f"'sha256-{h}'" for h in hashes['style']) + "; script-src " + ' '.join(f"'sha256-{h}'" for h in hashes['script']) + "; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'")
    head_assets = (f'<style>{css}</style>' if offline_slug else '<link rel="stylesheet" href="../demo.css"><link rel="stylesheet" href="nativ.css">')
    tail = (f'<script>{data_js}</script><script>{js}</script>' if offline_slug else '<script src="nativ-data.js"></script><script src="nativ.js"></script>')
    back = '' if offline_slug else f'<a class="brand" href="../">chiuta.ro</a>'
    nav = (f'{back}' if back else '<span class="brand">chiuta.ro</span>')
    allink = '' if offline_slug else f'<p class="back"><a href="../" data-ui="back">{esc(U["back"])}</a></p>'
    return f'''<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(U["title"])} — chiuta.ro</title>
<meta name="description" content="{esc(U["lead"])}">
<meta name="color-scheme" content="dark light">
<meta http-equiv="Content-Security-Policy" content="{csp}">
<meta name="robots" content="index, follow">
<link rel="icon" href="data:,">
{head_assets}
</head>
<body>
<header><div class="wrap">
 {nav}
 <div class="hdr-right">
  <label for="lang" class="meta" id="lblLang">{esc(U["lang"])}</label>
  <select id="lang" aria-labelledby="lblLang"></select>
  <button id="theme" type="button" aria-label="Theme">◐</button>
 </div>
</div></header>
<main class="wrap">
 <h1 data-ui="title">{esc(U["title"])}</h1>
 <p class="lead" data-ui="lead">{esc(U["lead"])}</p>
 <p class="note" data-ui="auto">{esc(U["auto"])}</p>
 {body}
 <p class="note" data-ui="tts">{esc(U["tts"])}</p>
 <p class="note" data-ui="note">{esc(U["note"])}</p>
 {allink}
</main>
{tail}
</body>
</html>
'''

CSS_EXTRA = '''
.note{color:var(--mut);font-size:.9rem;max-width:80ch}
.prog{scroll-margin-top:72px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px;margin:0 0 26px}
.prog h2{margin:2px 4px 2px;font-size:1.3rem}.prog h2 small{color:var(--mut);font-weight:400;font-size:.8rem;margin-left:6px}
.pdesc{margin:0 4px 12px;color:var(--mut)}
.term{margin:0;background:#0d0b1a;color:#e6e3f5;border:1px solid var(--line);border-radius:10px;padding:12px 14px;font:14px/1.3 ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace;overflow-x:auto;white-space:pre;min-height:calc(26 * 1.3em + 24px)}
.term .c1{color:#ff7b7b}.term .c2{color:#5eead4}.term .c3{color:#f0c86e}.term .c4{color:#8ca0ff}.term .c5{color:#c896ff}.term .c6{color:#6edcf0}.term .c8{color:#a8a4c8}.term .c7,.term .c9{color:#fff}
.term .c1b,.term .c2b,.term .c3b,.term .c4b,.term .c5b,.term .c6b,.term .c8b,.term .c7b,.term .c9b,.term .c0b{font-weight:700}
.term .c0b{color:#fff}.term .cur{background:#9d8bff;color:#0d0b1a}
.subline{min-height:3.2em;margin:8px 0 0;padding:8px 12px;border-radius:8px;background:#000;color:#fff;font-size:1.02rem;text-align:center;display:flex;align-items:center;justify-content:center}
.subline.empty{visibility:hidden}
.ctl{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;margin:10px 0 6px}
.ctl .seek{flex:1 1 220px;min-width:140px;padding:0;accent-color:var(--acc)}
.ctl .time{font-variant-numeric:tabular-nums;color:var(--mut);min-width:5.5em}
.ctl label{display:inline-flex;gap:6px;align-items:center;color:var(--mut);font-size:.92rem}
.ctl input[type=checkbox]{width:18px;height:18px;padding:0;accent-color:var(--acc)}
.ctl select{padding:3px 6px}
.scenes{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}
.chip{min-width:2.4rem;padding:4px 8px}.chip.on{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 22%,var(--panel))}
.links{margin:8px 4px;font-size:.95rem}.links a{white-space:nowrap}
.vid,.transcript{margin:8px 4px}.vid summary,.transcript summary{cursor:pointer;color:var(--acc)}
.vid video{margin-top:8px;max-width:100%}
.transcript ol{padding-left:1.4em}.transcript li{margin:0 0 14px}
.transcript .narr{margin:0 0 6px}.transcript ul.cmds{list-style:none;margin:0;padding:0}
.transcript code.cmd{display:block;color:var(--acc2);font-family:ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace;font-size:.88rem;overflow-wrap:anywhere}
.transcript pre.out{margin:2px 0 8px;padding:8px 10px;background:#0d0b1a;color:#e6e3f5;border:1px solid var(--line);border-radius:8px;overflow-x:auto;font:13px/1.35 ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.nojs{color:var(--mut)}
.back{margin:20px 0}
@media (max-width:640px){.term{font-size:11px}.subline{font-size:.95rem}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
'''

def b64(path): return base64.b64encode(pathlib.Path(path).read_bytes()).decode()

def sha(s): return base64.b64encode(hashlib.sha256(s.encode('utf8')).digest()).decode()

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='nativ-'))
    progs = []
    for slug in SLUGS:
        p = build_prog(slug, tmp); progs.append(p)
        write_cast(p); write_vtt(p)
        if not NO_AUDIO: write_audio(p, tmp)
        if not NO_VIDEO: render_video(p)
        print(slug, 'durată', p['dur'], 's;', len(p['events']), 'evenimente')
    def data_for(offline_slug=None, inline_audio=False):
        d = {'cols': COLS, 'rows': ROWS, 'ui': UI, 'progs': {}}
        for p in progs:
            if offline_slug and p['slug'] != offline_slug: continue
            aud = {}
            for l in LANGS:
                f = OUT / 'audio' / f"{p['slug']}.{l}.ogg"
                if f.exists(): aud[l] = ('data:audio/ogg;base64,' + b64(f)) if inline_audio else f"audio/{p['slug']}.{l}.ogg"
            d['progs'][p['slug']] = {'name': p['name'], 'desc': p['desc'], 'version': p['version'], 'dur': p['dur'], 'events': p['events'], 'cues': p['cues'], 'audio': aud,
                                      'scenes': [{'t0': s['t0'], 't1': s['t1'], 'narr': s['narr']} for s in p['scenes']]}
        return 'window.NATIV=' + json.dumps(d, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';'
    css = (HUB / 'demo' / 'demo.css').read_text(encoding='utf8') + CSS_EXTRA
    js = (HERE / 'nativ.js').read_text(encoding='utf8')
    (OUT / 'nativ.css').write_text(CSS_EXTRA, encoding='utf8')
    (OUT / 'nativ.js').write_text(js, encoding='utf8')
    (OUT / 'nativ-data.js').write_text(data_for(), encoding='utf8')
    (OUT / 'index.html').write_text(page_html(progs), encoding='utf8')
    for p in progs:
        dj = data_for(p['slug'], inline_audio=True)
        hashes = {'style': [sha(css)], 'script': [sha(dj), sha(js)]}
        (OUT / f"{p['slug']}-offline.html").write_text(page_html([p], p['slug'], css=css, js=js, data_js=dj, hashes=hashes), encoding='utf8')
    shutil.rmtree(tmp, ignore_errors=True)
    tot = sum(f.stat().st_size for f in OUT.rglob('*') if f.is_file())
    print('total demo/nativ:', round(tot / 1e6, 2), 'MB')

if __name__ == '__main__':
    main()
