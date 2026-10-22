#!/usr/bin/env python3
"""Recalculează hash-urile CSP ale scripturilor inline dintr-un index.html: python3 tools/fixcsp.py <director-aplicație> [...]

Nu mai conține o implementare proprie: apelează `node build.mjs fixcsp`, adică lib/csp.mjs → recomputeCspHashes (sursa unică a regulii).
Regula: hash-urile din script-src devin exact mulțimea scripturilor inline executabile; dacă script-src conține 'unsafe-inline',
hash-urile se elimină (un hash lângă 'unsafe-inline' face browserul să ignore 'unsafe-inline').
Necesită Node ≥ 18 în PATH. Cod de ieșire ≠ 0 dacă build.mjs eșuează pentru vreun director."""
import os, subprocess, sys

BUILD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build.mjs')
if len(sys.argv) < 2:
    sys.exit(__doc__)
bad = 0
for d in sys.argv[1:]:
    r = subprocess.run(['node', BUILD, 'fixcsp', d], capture_output=True, text=True)
    print((r.stdout or r.stderr).strip())
    bad += r.returncode != 0
sys.exit(1 if bad else 0)
