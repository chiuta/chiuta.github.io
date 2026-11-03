"""Generează 3 pagini „scanate” (text înclinat) pentru demonstrația LegatorOCR. Deterministă. Rulare: make_pages.py DIR"""
import sys
from PIL import Image, ImageDraw, ImageFont
f = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf', 40)
txt = ["Chapter %d. The Beginnings", "The library was founded in 1864 by a", "group of teachers and merchants. In the", "first years the books were kept in a single", "room, and lending was recorded in a ledger.", "By the end of the century the collection", "held over ten thousand volumes, mostly gifts."]
for i, ang in enumerate((2.3, -1.7, 3.1), 1):
    page = Image.new('L', (1240, 1754), 238); d = ImageDraw.Draw(page)
    for k, l in enumerate(txt): d.text((120, 200 + k * 62), l % i if k == 0 else l, font=f, fill=25)
    d.text((600, 1600), str(i), font=f, fill=25)
    page.rotate(ang, expand=False, fillcolor=238, resample=Image.BICUBIC).convert('RGB').save(f'{sys.argv[1]}/page-{i}.png', dpi=(150, 150))
