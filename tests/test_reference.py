#!/usr/bin/env python3
"""Seeded, exact Python Fraction oracle for AliceMath. Python 3.10+, Node 22+.

No JavaScript-generated expected values and no floating-point comparisons.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
from fractions import Fraction
import hashlib
import json
from math import gcd
from pathlib import Path
import platform
import random
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SEED = 20261016


def pair(q):
    return {'n': str(q.numerator), 'd': str(q.denominator)}


def token(q):
    return f'({q.numerator}/{q.denominator})'


def exact_text(q):
    """Independent terminating-decimal renderer using powers of 2 and 5."""
    n, d = q.numerator, q.denominator
    remainder, twos, fives = d, 0, 0
    while remainder % 2 == 0:
        remainder //= 2
        twos += 1
    while remainder % 5 == 0:
        remainder //= 5
        fives += 1
    if remainder != 1:
        return f'{n}/{d}'
    places = max(twos, fives)
    if places == 0:
        return str(n)
    digits = str(abs(n) * (2 ** (places - twos)) * (5 ** (places - fives))).zfill(places + 1)
    return ('-' if n < 0 else '') + digits[:-places] + '.' + digits[-places:]


def generate_cases(seed=DEFAULT_SEED):
    rng = random.Random(seed)
    cases = []

    def add(group, expr, value, dim=None, **extra):
        cases.append({'id': f'{group}-{len(cases):04d}', 'group': group, 'expr': expr,
                      'expected': {'status': 'result', 'exact': True, 'rational': pair(value),
                                   'dim': dim if dim is not None else [0, 0, 0], **extra}})

    for i in range(500):
        a = Fraction(rng.randint(-10**18, 10**18), rng.randint(1, 100003))
        b = Fraction(rng.choice([-1, 1]) * rng.randint(1, 10**12), rng.randint(1, 100019))
        c = Fraction(rng.randint(-99999, 99999), rng.randint(1, 997))
        op = ['+', '-', '*', '/'][i % 4]
        result = {'+': lambda: a + b, '-': lambda: a - b, '*': lambda: a * b, '/': lambda: a / b}[op]()
        add('arithmetic', f'({token(a)}{op}{token(b)})+{token(c)}', result + c)
    for _ in range(100):
        a = Fraction(rng.randint(1, 999), rng.randint(1, 997))
        exponent = rng.randint(-10, 10)
        add('powers', f'{token(a)}^{exponent}', a ** exponent)
    for _ in range(100):
        a = Fraction(rng.choice([-1, 1]) * rng.randint(1, 9999), rng.randint(1, 997))
        b = Fraction(rng.randint(-9999, 9999), rng.randint(1, 991))
        c = Fraction(rng.randint(-9999, 9999), rng.randint(1, 983))
        add('linear', f'solve {token(a)}*x+{token(b)}={token(c)}', (c - b) / a, kind='equation')
    for _ in range(100):
        root = Fraction(rng.randint(0, 999999), rng.randint(1, 997))
        add('roots', f'sqrt({token(root * root)})', root, text=exact_text(root))
    for _ in range(100):
        cm, seconds = rng.randint(-99999, 99999), rng.randint(1, 999)
        si = Fraction(cm, 100 * seconds)
        # 1 km/hr = 5/18 m/s. Check displayed AND SI magnitudes independently.
        add('conversion', f'convert ({cm} cm)/({seconds} s) to km/hr', si * Fraction(18, 5),
            [1, -1, 0], baseRational=pair(si), kind='conversion', unitLabel='km/hr')
    for _ in range(100):
        places = rng.randint(1, 80)
        numerator = rng.randint(-10**18, 10**18)
        magnitude = str(abs(numerator)).zfill(places + 1)
        literal = ('-' if numerator < 0 else '') + magnitude[:-places] + '.' + magnitude[-places:]
        q = Fraction(numerator, 10**places)
        add('decimals', literal, q, text=exact_text(q))
    for _ in range(100):
        force, length = rng.randint(-99999, 99999), rng.randint(1, 999)
        add('dimensions', f'({force} n)*({length} cm)', Fraction(force * length, 100), [2, -2, 1])
    add('large', '(((2^10)^10)^10)^4', Fraction(2**4000))
    add('large', '1/(((2^10)^10)^10)^4', Fraction(1, 2**4000))
    q = Fraction(1, 5**100 * 2**5)
    add('large', '(((1/5)^10)^5)^2*(1/2)^5', q, text=exact_text(q))
    add('large', '1+0.00000000000000000001', Fraction(1) + Fraction(1, 10**20))
    for fixture in json.loads((ROOT / 'tests' / 'regressions.json').read_text()):
        expected = fixture['expected']
        if expected.get('status', 'result') == 'result':
            expected = {'status': 'result', 'exact': True, **expected}
        cases.append({**fixture, 'group': 'regressions', 'expected': expected})
    return cases


def dataset_hash(cases):
    return hashlib.sha256(json.dumps(cases, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def run_node(cases, node='node', engine=None, mode='check', **options):
    command = [node, str(ROOT / 'tests' / 'engine-runner.cjs'), str(engine or ROOT / 'alice-math.min.js')]
    completed = subprocess.run(command, input=json.dumps({'mode': mode, 'cases': cases, **options}),
                               text=True, capture_output=True, timeout=120, check=True)
    return json.loads(completed.stdout)


def compare_case(case, actual):
    errors = []
    if actual.get('id') != case['id']:
        errors.append('result ID/order mismatch')
    for field, expected in case['expected'].items():
        if actual.get(field) != expected:
            errors.append(f'{field}: expected {expected!r}, got {actual.get(field)!r}')
    for field in ('rational', 'baseRational'):
        q = actual.get(field)
        if q is not None:
            try:
                n, d = int(q['n']), int(q['d'])
                if d <= 0 or gcd(abs(n), d) != 1:
                    errors.append(f'{field}: fraction is not normalized')
            except (KeyError, TypeError, ValueError):
                errors.append(f'{field}: malformed fraction')
    return errors


def verify(cases, response):
    results = response.get('results', [])
    if len(results) != len(cases):
        raise ValueError(f'Expected {len(cases)} results, received {len(results)}')
    failures = []
    for case, actual in zip(cases, results):
        errors = compare_case(case, actual)
        if errors:
            failures.append({'id': case['id'], 'expression': case['expr'], 'errors': errors})
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed', type=int, default=DEFAULT_SEED)
    parser.add_argument('--node', default='node', help='Node executable name or path')
    parser.add_argument('--engine', type=Path, default=ROOT / 'alice-math.min.js')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        cases = generate_cases(args.seed)
        response = run_node(cases, args.node, args.engine.resolve())
        failures = verify(cases, response)
        summary = {'schema': 'alice.reference-results/v1', 'seed': args.seed,
                   'total': len(cases), 'passed': len(cases) - len(failures),
                   'groups': dict(Counter(c['group'] for c in cases)),
                   'datasetSha256': dataset_hash(cases),
                   'engineSha256': hashlib.sha256(args.engine.read_bytes()).hexdigest(),
                   'node': response['node'], 'python': platform.python_version(),
                   'generatedAt': datetime.now(timezone.utc).isoformat(), 'failures': failures}
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(summary, indent=2) + '\n')
        print(json.dumps(summary, indent=2))
        return 1 if failures else 0
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f'Reference suite failed to run: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
