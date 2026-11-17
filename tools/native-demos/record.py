#!/usr/bin/env python3
"""Înregistrează sesiunile reale ale celor 5 programe native (TEZAUR, VERIGA, LegatorOCR, OSATURA, PORUMBEL) pe date demo mici.

Rulare: python3 -I tools/native-demos/record.py [--bin DIR] [slug ...]
Scrie tools/native-demos/captures/<slug>.json: pentru fiecare comandă, textul ieșirii REALE (stdout+stderr combinat),
codul de ieșire și versiunea programului. Singura prelucrare: calea absolută a directorului de lucru e înlocuită cu /home/demo.
Binarele se caută în --bin (implicit: ../<Nume>/target/release din clonele locale)."""
import json, os, shutil, subprocess, sys, tempfile, pathlib

HERE = pathlib.Path(__file__).resolve().parent
PAR = HERE.parents[2]  # părintele hub-ului (clonele programelor)
BINS = {'tezaur': ('TEZAUR', 'tezaur'), 'veriga': ('VERIGA', 'veriga'), 'legatorocr': ('LegatorOCR', 'legatorocr'), 'osatura': ('osatura', 'osatura'), 'porumbel': ('PORUMBEL', 'porumbel')}

# Fiecare scenă = comenzile afișate (rulate real, într-un shell bash) — textul narat e în narration.json
SCENES = {
 'tezaur': [
  ['ls lib', 'cat lib/okafor2021.md'],
  ['tezaur --bib lib/refs.bib ingest lib'],
  ['tezaur --bib lib/refs.bib sources'],
  ['tezaur search "exam anxiety quizzes" > cautare.txt; cut -c1-150 cautare.txt'],
  ['cat draft.md'],
  ['tezaur --bib lib/refs.bib audit draft.md'],
  ['tezaur --bib lib/refs.bib refs draft.md'],
 ],
 'veriga': [
  ['ls -R site'],
  ['veriga ./site --orphans ./site --lang ro -o raport.txt -o linkuri.csv; echo "cod de ieșire: $?"'],
  ['head -n 9 raport.txt'],
  ['cut -d, -f1,3,4 linkuri.csv'],
  ['veriga --version', 'veriga ./site --lang en --no-fail -q -o raport-en.txt; head -n 4 raport-en.txt'],
 ],
 'legatorocr': [
  ['ls -l page-*.png'],
  ['legatorocr page-*.png --format none --pdf book.pdf --ocr --lang en --txt book.txt --timings'],
  ['ls -l book.pdf book.txt', 'head -n 8 book.txt'],
  ['pdftotext book.pdf - | head -n 3'],
 ],
 'osatura': [
  ['osatura --version | head -n 1', 'osatura demo demo.json'],
  ['osatura check demo.json'],
  ['osatura render demo.json 12 frame12.png --bones', 'osatura render demo.json 12 frame12.svg'],
  ['osatura export demo.json demo.gif', 'ls -l frame12.png frame12.svg demo.gif'],
 ],
 'porumbel': [
  ['porumbel --version', 'porumbel --help | head -n 14'],
  ['cat demo.conf', "porumbel print-config --config demo.conf | grep -E '^(token|serve|port|session_gap|open|watch) '"],
  ['ls sync', 'porumbel --config demo.conf --once'],
  ['cat phone.sh'],
  ['./phone.sh & timeout 22 porumbel --config demo.conf'],
  ['ls -R inbox'],
  ['porumbel doctor --config demo.conf'],
 ],
}

# Fișierele scenei PORUMBEL: phone.sh stă în locul aplicației de sincronizare de pe telefon (copiază pozele în folderul urmărit, una câte una);
# pozele sunt JPEG-uri reale, mici (Pillow), cu nume ca în Open Camera. Totul se vede în scene (cat demo.conf, cat phone.sh).
PORUMBEL_CONF = '''# PORUMBEL — demo settings / setări pentru demonstrație
inbox = inbox
token = demo-token-0123456789
serve = false
watch = sync
open = manual
session_gap = 4
watch_interval = 1
'''
PORUMBEL_PHONE = '''#!/bin/bash
# stands in for the phone's sync app / ține locul aplicației de sincronizare de pe telefon
cd "$(dirname "$0")"
for f in IMG_20261114_135501 IMG_20261114_135512 IMG_20261114_135524; do cp camera/$f.jpg sync/; sleep 2; done
sleep 6
for f in IMG_20261114_141003 IMG_20261114_141011; do cp camera/$f.jpg sync/; sleep 2; done
'''
def prep_porumbel(work):
    from PIL import Image, ImageDraw
    (work / 'camera').mkdir(); (work / 'sync').mkdir()
    def page(path, label):
        im = Image.new('RGB', (240, 160), (250, 248, 240)); d = ImageDraw.Draw(im)
        for y in range(24, 140, 14): d.line((20, y, 220 - (y * 7) % 60, y), fill=(60, 60, 70), width=2)
        d.text((20, 6), label, fill=(120, 30, 30)); im.save(path, quality=70)
    for i, n in enumerate(['IMG_20261114_135501', 'IMG_20261114_135512', 'IMG_20261114_135524', 'IMG_20261114_141003', 'IMG_20261114_141011']): page(work / 'camera' / (n + '.jpg'), 'page %d' % (i + 1))
    page(work / 'sync' / 'IMG_20261113_101500.jpg', 'old')   # o poză veche, deja în folderul sincronizat
    (work / 'demo.conf').write_text(PORUMBEL_CONF, encoding='utf8')
    (work / 'phone.sh').write_text(PORUMBEL_PHONE, encoding='utf8'); (work / 'phone.sh').chmod(0o755)

def prep(slug, work):
    d = HERE / 'data'
    if slug == 'tezaur':
        shutil.copytree(d / 'lib', work / 'lib'); shutil.copy(d / 'draft.md', work)
    elif slug == 'veriga':
        shutil.copytree(d / 'site', work / 'site')
    elif slug == 'legatorocr':
        subprocess.run([sys.executable, '-I', str(HERE / 'make_pages.py'), str(work)], check=True)
    elif slug == 'porumbel':
        prep_porumbel(work)

def main():
    a = sys.argv[1:]; binroot = None
    if '--bin' in a:
        i = a.index('--bin'); binroot = pathlib.Path(a[i + 1]); del a[i:i + 2]
    only = a or list(SCENES)
    for slug in only:
        d, exe = BINS[slug]
        src = (binroot / exe) if binroot else PAR / 'chiuta' / d / 'target' / 'release' / exe
        if not src.exists():
            print('lipsește binarul', src); continue
        tmp = pathlib.Path(tempfile.mkdtemp(prefix='nd-'))
        work = tmp / 'demo'; work.mkdir(); (tmp / 'bin').mkdir()
        (tmp / 'bin' / exe).symlink_to(src)
        prep(slug, work)
        env = dict(os.environ, PATH=str(tmp / 'bin') + ':' + os.environ['PATH'], LANG='C.UTF-8', NO_COLOR='1', TERM='dumb', COLUMNS='100', HOME=str(tmp))
        env.pop('TEZAUR_INDEX', None)
        scenes = []
        for cmds in SCENES[slug]:
            sc = []
            for c in cmds:
                p = subprocess.run(['bash', '-c', c], cwd=work, env=env, capture_output=True, text=True, timeout=300)
                out = (p.stdout + p.stderr).replace(str(work), '/home/demo').replace(str(tmp), '/home/demo')
                sc.append({'cmd': c, 'out': out, 'code': p.returncode})
                print(slug, '$', c[:70], '->', p.returncode, len(out), 'B')
            scenes.append(sc)
        ver = subprocess.run([str(src), '--version'], capture_output=True, text=True).stdout.splitlines()[0:1]
        (HERE / 'captures' / (slug + '.json')).write_text(json.dumps({'slug': slug, 'version': ver[0] if ver else '', 'scenes': scenes}, ensure_ascii=False, indent=1), encoding='utf8')
        shutil.rmtree(tmp, ignore_errors=True)
main()
