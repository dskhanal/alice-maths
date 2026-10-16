#!/usr/bin/env python3
"""Reproducible AliceMath latency measurements, separate from correctness checks.

Measures parsing, exact calculation and output formatting inside Node. Python
oracle generation, process startup and JSON transport are outside timed samples.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import statistics
import sys
from test_reference import DEFAULT_SEED, ROOT, dataset_hash, generate_cases, run_node, verify


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', default='node')
    parser.add_argument('--seed', type=int, default=DEFAULT_SEED)
    parser.add_argument('--warmups', type=int, default=2, choices=range(0, 21))
    parser.add_argument('--repeats', type=int, default=7, choices=range(3, 51))
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    cases = generate_cases(args.seed)
    checked = run_node(cases, args.node)
    failures = verify(cases, checked)
    if failures:
        print(json.dumps({'error': 'Correctness check failed; no benchmark recorded.', 'failures': failures}, indent=2))
        return 1
    profiles = []
    runtime = {}
    for group in ('arithmetic', 'linear', 'conversion'):
        selected = [case for case in cases if case['group'] == group]
        result = run_node(selected, args.node, mode='benchmark', warmups=args.warmups, repeats=args.repeats)
        samples = result['samplesMs']
        median = statistics.median(samples)
        profiles.append({'name': group, 'uniqueCases': len(selected), 'casesPerSample': result['casesPerSample'], 'batches': result['batches'], 'datasetSha256': dataset_hash(selected),
                         'warmups': args.warmups, 'repeats': args.repeats, 'samplesMs': samples,
                         'medianMs': median, 'minMs': min(samples), 'maxMs': max(samples),
                         'medianAbsoluteDeviationMs': statistics.median(abs(v - median) for v in samples),
                         'medianCalculationsPerSecond': result['casesPerSample'] * 1000 / median,
                         'checksum': result['checksum']})
        runtime = {key: result[key] for key in ('node', 'platform', 'arch', 'cpu')}
    report = {'schema': 'alice.engine-benchmark/v1', 'seed': args.seed,
              'generatedAt': datetime.now(timezone.utc).isoformat(),
              'engineSha256': hashlib.sha256((ROOT / 'alice-math.min.js').read_bytes()).hexdigest(),
              'suiteDatasetSha256': dataset_hash(cases), 'correctnessPassed': len(cases),
              'environment': {**runtime, 'python': platform.python_version()},
              'timedWork': 'AliceMath.calculate: parsing, exact arithmetic and output formatting',
              'excludedWork': 'Oracle generation, Node startup, JSON transport, browser rendering and spreadsheet recalculation',
              'profiles': profiles}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
