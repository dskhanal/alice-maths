"""Independent exact aggregates/scientific/import oracles and Decimal base-ten logs."""
import argparse
from decimal import Decimal, localcontext, ROUND_HALF_UP
from fractions import Fraction
import json
import math
from pathlib import Path
import random
import subprocess


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    rng = random.Random(61017)
    cases = []

    def add(expr, expected, cells=None, **extra):
        cases.append({'expr': expr, 'cells': cells or {}, 'expected': str(expected), **extra})

    for _ in range(120):
        numerator = rng.randint(-10**18, 10**18)
        exponent = rng.randint(-250, 250)
        literal = f'{numerator}e{exponent}'
        add(literal, Fraction(Decimal(literal)))
    for fn in ['SUM', 'AVG', 'PROD']:
        for _ in range(45):
            cells, values = {}, []
            for col in ['A', 'B']:
                for row in range(1, 27):
                    if rng.randrange(8) == 0:
                        continue
                    if rng.randrange(8) == 0:
                        cells[f'{col}{row}'] = 'text'
                        continue
                    q = Fraction(rng.randint(-9, 9), rng.choice([3, 7, 11, 97]))
                    values.append(q)
                    cells[f'{col}{row}'] = f'=({q.numerator}/{q.denominator})'
            expected = math.prod(values) if fn == 'PROD' else sum(values, Fraction()) / (len(values) if fn == 'AVG' else 1)
            add(f'{fn}(A1:B26)', expected, cells)
    grid = {f'{col}{row}': '=1/97' for col in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' for row in range(1, 27)}
    add('SUM(A1:Z26)', Fraction(676, 97), grid)
    add('AVG(A1:Z26)', Fraction(1, 97), grid)
    add('PROD(A1:Z26)', Fraction(1, 2**676), {c: '=1/2' for c in grid})
    for fn, oracle in [('GCD', math.gcd), ('LCM', math.lcm)]:
        for _ in range(35):
            a, b = rng.randint(0, 99999), rng.randint(0, 99999)
            add(f'{fn}(A1,B1)', Fraction(oracle(a//100, b//100)), {'A1': f'={a}/100', 'B1': f'={b}/100'}, imported=True)
    for _ in range(35):
        n = rng.randint(-100000, 100000)
        places = rng.randint(-4, 4)
        value = Decimal(n)/Decimal(1000)
        with localcontext() as ctx:
            ctx.prec = 100
            expected = Fraction(value.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))
        add('ROUND(A1,B1)', expected, {'A1': f'={n}/1000', 'B1': f'={places}'}, imported=True)
    for exponent in [-50, -3, 0, 1, 2, 50, 100, 250]:
        for precision in [20, 34, 50, 100]:
            with localcontext() as ctx:
                ctx.prec = 160
                value = Decimal('1.23456789').scaleb(exponent)
                logarithm = value.log10()
                ctx.prec = precision
                expected = +logarithm
            add(f'log10({value})', expected, approximate=True, precision=precision, decimal=True)
    proc = subprocess.run(['node', str(Path(__file__).with_name('corrections-runner.cjs'))], input=json.dumps(cases), text=True, capture_output=True, check=True, timeout=60)
    actual = json.loads(proc.stdout)
    if len(actual) != len(cases):
        raise AssertionError('Missing runner results')
    failures = []
    for case, result in zip(cases, actual):
        success = result.get('status') == 'result'
        if case.get('decimal'):
            success = success and result.get('approximate') is True and Decimal(result['text'][2:]) == Decimal(case['expected'])
        else:
            success = success and result.get('exact') is True and result.get('n') is not None and Fraction(int(result['n']), int(result['d'])) == Fraction(case['expected'])
        if not success:
            failures.append({'expr': case['expr'], 'expected': case['expected'], 'actual': result})
    report = {'total': len(cases), 'passed': len(cases)-len(failures), 'failures': failures, 'seed': 61017, 'oracles': 'Python Fraction, Decimal.log10/ROUND_HALF_UP, math.gcd/lcm'}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))
    raise SystemExit(bool(failures))


if __name__ == '__main__':
    main()
