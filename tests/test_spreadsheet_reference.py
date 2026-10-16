"""Independent Python Decimal/Fraction/math oracles for spreadsheet scalar functions."""
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
    cases = []
    rng = random.Random(17329)
    inputs = [(1005, 1000), (-1005, 1000), (0, 1), (1, 3), (-1, 3), (250, 1), (-250, 1)]
    inputs += [(rng.randint(-10**25, 10**25), rng.choice([3, 7, 11, 97, 1000])) for _ in range(50)]
    for n, d in inputs:
        for places in [-100, -3, -2, 0, 2, 10, 100]:
            with localcontext() as ctx:
                ctx.prec = 300
                expected = Fraction((Decimal(n) / Decimal(d)).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))
            cases.append((f'ROUND(({n}/{d}),{places})', expected))
        cases.append((f'FLOOR({n}/{d})', Fraction(math.floor(Fraction(n, d)))))
    integers = [[0, 0], [0, 97], [-84, 30], [17, 19, 23], [9007199254740993, 3]]
    integers += [[rng.randint(-10**30, 10**30) for _ in range(rng.randint(1, 5))] for _ in range(50)]
    for values in integers:
        for name, oracle in [('GCD', math.gcd), ('LCM', math.lcm)]:
            cases.append((name + '(' + ','.join(map(str, values)) + ')', Fraction(oracle(*values))))
    proc = subprocess.run(['node', str(Path(__file__).with_name('spreadsheet-runner.cjs'))], input=json.dumps([e for e, _ in cases]), capture_output=True, text=True, timeout=30, check=True)
    actual = json.loads(proc.stdout)
    if len(actual) != len(cases):
        raise AssertionError('Runner result count differs from submitted cases')
    failures = []
    for (expression, expected), result in zip(cases, actual):
        if result.get('status') != 'result' or not result.get('n') or Fraction(int(result['n']), int(result['d'])) != expected:
            failures.append({'expression': expression, 'expected': str(expected), 'actual': result})
    report = {'total': len(cases), 'passed': len(cases) - len(failures), 'failures': failures, 'seed': 17329, 'oracles': 'Python Decimal ROUND_HALF_UP, Fraction, math.floor/gcd/lcm'}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    raise SystemExit(bool(failures))


if __name__ == '__main__':
    main()
