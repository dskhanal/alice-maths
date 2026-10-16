#!/usr/bin/env python3
"""Decimal oracle for well-conditioned approximate calculations, without third-party Python libraries."""
import argparse
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal, localcontext, ROUND_HALF_EVEN
import hashlib
import json
from math import isqrt
from pathlib import Path
import platform
import random
import sys
from test_reference import ROOT, run_node


def pi_decimal(precision):
    # Independent Machin formula; decimal.js uses its own transcendental implementation.
    with localcontext() as c:
        c.prec = precision + 10
        def atan_reciprocal(n):
            x = Decimal(1) / n
            power, total, k, sign = x, x, 1, -1
            threshold = Decimal(10) ** (-c.prec - 2)
            while True:
                power *= x * x
                term = power / (2 * k + 1)
                total += sign * term
                if abs(term) < threshold:
                    return total
                sign *= -1
                k += 1
        return +(16 * atan_reciprocal(5) - 4 * atan_reciprocal(239))


def trig(x, cosine=False):
    with localcontext() as c:
        # Caller supplies guard digits; no binary math.sin/cos is used.
        term = Decimal(1) if cosine else x
        total, k = term, 1
        threshold = Decimal(10) ** (-c.prec - 2)
        while True:
            denominator = (2 * k - 1) * (2 * k) if cosine else (2 * k) * (2 * k + 1)
            term *= -x * x / denominator
            total += term
            if abs(term) < threshold:
                return total
            k += 1


def generate_cases(seed):
    rng = random.Random(seed)
    cases = []
    for precision in (20, 34, 50, 100):
        with localcontext() as c:
            c.prec = precision + 60
            def add(group, expression, expected, dim=None):
                with localcontext() as rounded:
                    rounded.prec = precision
                    rounded.rounding = ROUND_HALF_EVEN
                    value = str(+expected)
                cases.append({'id': f'{group}-{precision}-{len(cases):04d}', 'group': group,
                              'expr': expression, 'precision': precision, 'expected': value,
                              'dim': dim if dim is not None else [0, 0, 0]})
            pi = pi_decimal(c.prec)
            add('constants', 'pi', pi)
            add('constants', 'e', Decimal(1).exp())
            add('trigonometry', 'sin(pi/6)', Decimal('0.5'))
            add('trigonometry', 'cos(pi)', Decimal(-1))
            add('units', 'sqrt(2 m^2)', Decimal(2).sqrt(), [1, 0, 0])
            add('units', 'convert sqrt(2 m^2) to cm', Decimal(2).sqrt() * 100, [1, 0, 0])
            for _ in range(30):
                n = rng.randint(2, 10000)
                while isqrt(n) ** 2 == n:
                    n = rng.randint(2, 10000)
                add('square-roots', f'sqrt({n})', Decimal(n).sqrt())
                x = Decimal(rng.randint(-99, 99)) / 10
                add('exponentials', f'exp({x})', x.exp())
                y = Decimal(rng.randint(1, 9999)) / 100
                add('logarithms', f'ln({y})', y.ln())
                add('sigmoid', f'1/(1+exp(-({x})))', 1 / (1 + (-x).exp()))
            for _ in range(12):
                angle = Decimal(rng.randint(-30, 30)) / 10
                sine, cosine = trig(angle), trig(angle, True)
                add('trigonometry', f'sin({angle})', sine)
                add('trigonometry', f'cos({angle})', cosine)
                add('trigonometry', f'tan({angle})', sine / cosine)
    return cases


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed', type=int, default=20261016)
    parser.add_argument('--node', default='node')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    cases = generate_cases(args.seed)
    response = run_node(cases, args.node, mode='approximate')
    results = response['results']
    if len(results) != len(cases):
        raise ValueError('Result count mismatch')
    failures = []
    for case, actual in zip(cases, results):
        try:
            assert actual['id'] == case['id'], 'Result order mismatch'
            assert actual['status'] == 'result', actual['text']
            assert actual['approximate'] is True and actual['exact'] is False, 'Missing approximate provenance'
            assert actual['precision'] == case['precision'], 'Wrong precision'
            assert actual['dim'] == case['dim'], 'Wrong dimensions'
            assert actual['text'].startswith('≈ '), 'Missing visible approximation marker'
            displayed = Decimal(actual['text'][2:].split()[0])
            assert displayed == Decimal(case['expected']), f"Expected rounded {case['expected']}, got {displayed}"
        except (AssertionError, KeyError) as error:
            failures.append({'id': case['id'], 'expression': case['expr'], 'error': str(error)})
    report = {'schema': 'alice.approx-reference/v1', 'seed': args.seed, 'total': len(cases),
              'passed': len(cases)-len(failures), 'groups': dict(Counter(c['group'] for c in cases)),
              'precisions': [20, 34, 50, 100], 'oracle': 'Python Decimal sqrt/exp/ln; Machin pi; Taylor sin/cos',
              'generatedAt': datetime.now(timezone.utc).isoformat(), 'python': platform.python_version(),
              'node': response['node'], 'failures': failures,
              'adapterSha256': hashlib.sha256((ROOT/'alice-approx.js').read_bytes()).hexdigest(),
              'decimalSha256': hashlib.sha256((ROOT/'vendor/decimal.js').read_bytes()).hexdigest()}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
