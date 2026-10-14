#!/usr/bin/env python3
"""Generează oracol independent (rațional exact, fractions) pentru calculatoarele Gospodar.
Rulare: python3 -I gen_oracle.py > oracle.json   (nu folosește cod din aplicație)
Convenții (rapoarte exacte, fără zecimale trunchiate): sume în subunități (bani); rotunjire „jumătate în sus” la fiecare perioadă."""
import json
from fractions import Fraction
from math import floor, ceil

def rnd(x):  # -> int, jumătate în sus (în afara lui zero), pe raționale exacte
    x = Fraction(x)
    return floor(x + Fraction(1, 2)) if x >= 0 else -floor(-x + Fraction(1, 2))

def loan(P, pct, n, kind):
    r = Fraction(pct) / Fraction(1200)
    pay = None
    if kind == 'annuity':
        pay = rnd(Fraction(P) / n) if r == 0 else rnd(Fraction(P) * r / (1 - (1 + r) ** (-n)))
    B = P; rows = []; tot = 0
    base = P // n
    for k in range(1, n + 1):
        i = rnd(Fraction(B) * r)
        if k == n: pr = B; pm = B + i
        elif kind == 'annuity':
            pr = min(pay - i, B); pm = pay
            if pr < 0: pr = 0; pm = i
        else: pr = base; pm = pr + i
        B -= pr; tot += i; rows.append([pm, pr, i, B])
    return {'P': P, 'pct': pct, 'n': n, 'kind': kind, 'payment': pay, 'totalInterest': tot, 'first': rows[0], 'last': rows[-1], 'mid': rows[n // 2], 'sumPay': sum(x[0] for x in rows)}

def compound(P0, D, pct, n, timing):
    r = Fraction(pct) / Fraction(1200); B = P0; it = 0; c = P0
    for k in range(n):
        if timing == 'begin': B += D; c += D
        i = rnd(Fraction(B) * r); B += i; it += i
        if timing != 'begin': B += D; c += D
    return {'P': P0, 'D': D, 'pct': pct, 'n': n, 'timing': timing, 'final': B, 'contrib': c, 'interest': it}

def goal(T, C, pct, n):
    r = Fraction(pct) / Fraction(1200)
    if r == 0: d = max(0, -((-(T - C)) // n))
    else:
        pw = (1 + r) ** n; x = (Fraction(T) - Fraction(C) * pw) * r / (pw - 1)
        d = 0 if x <= 0 else ceil(x)
    def sim(d):
        B = C
        for _ in range(n):
            B += rnd(Fraction(B) * r); B += d
        return B
    while sim(d) < T: d += 1
    return {'T': T, 'C': C, 'pct': pct, 'n': n, 'deposit': d, 'final': sim(d)}

def infl(A, pct, y):
    g = Fraction(pct) / 100
    return {'A': A, 'pct': pct, 'y': y, 'nominal': rnd(Fraction(A) * (1 + g) ** y), 'real': rnd(Fraction(A) / (1 + g) ** y)}

def vat(A, pct, mode):
    p = Fraction(pct)
    if mode == 'add':
        v = rnd(Fraction(A) * p / 100); return {'A': A, 'pct': pct, 'mode': mode, 'net': A, 'vat': v, 'gross': A + v}
    net = rnd(Fraction(A) * 100 / (100 + p)); return {'A': A, 'pct': pct, 'mode': mode, 'net': net, 'vat': A - net, 'gross': A}

out = {
 'loans': [loan(P, pct, n, k) for P, pct, n in [(25000000, '7.5', 300), (1000000, '0', 12), (12345678, '5.99', 241), (9999999, '12.375', 60), (500000, '3.1', 7), (80000000, '6.25', 360), (123456, '18', 24), (100, '5', 3), (7777777, '0.5', 120)] for k in ('annuity', 'equal')],
 'compound': [compound(*a) for a in [(1000000, 50000, '4', 120, 'end'), (0, 30000, '6.5', 60, 'begin'), (2500000, 0, '3.25', 360, 'end'), (123456, 7777, '8.8', 37, 'begin'), (100000, 10000, '0', 24, 'end')]],
 'goals': [goal(*a) for a in [(5000000, 500000, '3', 60), (100000, 0, '0', 10), (777777, 12345, '7.7', 33), (100, 5000, '4', 12), (30000000, 1000000, '5.5', 240)]],
 'infl': [infl(*a) for a in [(100000, '5', 10), (123456, '2.7', 25), (99999, '-1.5', 7), (1, '10', 3)]],
 'vat': [vat(*a) for a in [(10000, '21', 'add'), (12100, '21', 'remove'), (9999, '9', 'add'), (12345, '19', 'remove'), (1, '5', 'add'), (555555, '7.5', 'remove')]],
}
print(json.dumps(out))
