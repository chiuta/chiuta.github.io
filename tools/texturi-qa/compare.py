#!/usr/bin/env python3
"""Compară două capturi (înainte/după) și scrie un JSON cu cât s-a schimbat imaginea: ca să vezi că textura se vede, dar nu strică lizibilitatea.
Utilizare: compare.py before.png after.png      → {"mean":…, "p95":…, "p99":…, "gt24":…, "gt48":…}  (diferențe pe canal, 0–255; gtN = fracțiunea pixelilor cu diferență > N)
Praguri orientative pentru o aplicație obișnuită (a=1): mean 3–14, p99 ≤ 55, gt48 ≤ 0.02. Peste: textura e prea tare (coboară --a) sau acoperă textul.
Sub mean 1.5: textura nu se vede (verifică info.surfaces, ridică --a)."""
import json
import sys

from PIL import Image, ImageChops

a, b = Image.open(sys.argv[1]).convert('RGB'), Image.open(sys.argv[2]).convert('RGB')
if a.size != b.size:
    h = min(a.size[1], b.size[1]); a, b = a.crop((0, 0, min(a.size[0], b.size[0]), h)), b.crop((0, 0, min(a.size[0], b.size[0]), h))
d = ImageChops.difference(a, b).convert('L')
px = sorted(d.getdata()); n = len(px)
q = lambda p: px[min(n - 1, int(n * p))]
print(json.dumps({'mean': round(sum(px) / n, 2), 'p95': q(0.95), 'p99': q(0.99), 'gt24': round(sum(1 for v in px if v > 24) / n, 4), 'gt48': round(sum(1 for v in px if v > 48) / n, 4), 'size': list(a.size)}))
