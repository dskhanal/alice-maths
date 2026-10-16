# Reproducible engine benchmark

This is a local latency baseline for AliceMath, not a speed comparison with another library. The independent Python `Fraction` suite must pass before timing starts.

From the repository root:

```sh
python3 tests/benchmark.py --output .test-results/benchmark.json
```

## Method

Three profiles use the same seeded expressions as the correctness suite: rational arithmetic, affine equations and SI conversions. Each profile warms up twice, then records seven samples. Each sample repeats its dataset 25 times so the measurements are long enough to be useful. The Node timer wraps only calls to `AliceMath.calculate`, including parsing and output formatting; it excludes process startup, Python work, JSON transport and all browser rendering.

The report includes every timing sample, median/min/max, median absolute deviation, calculation count, output-length checksum, dataset and engine hashes, CPU, architecture and runtime versions. `--seed`, `--warmups`, `--repeats` and `--node` allow explicit reruns. Timing is descriptive and never a correctness threshold in CI. CPU load, power state, JIT compilation and runtime versions affect it; compare matching hashes, workloads and environments.

## Initial local baseline

Recorded 2026-10-15T20:31:58.150805+00:00 (UTC), on Apple M4 / darwin arm64, Node v25.9.0, Python 3.14.8.

| Profile | Unique expressions | Calculations per sample | Median ms | Min–max ms |
| --- | --- | --- | --- | --- |
| arithmetic | 500 | 12,500 | 67.080 | 66.288–67.694 |
| linear | 100 | 2,500 | 14.492 | 13.705–16.197 |
| conversion | 100 | 2,500 | 10.072 | 9.853–11.244 |

Raw samples and hashes: [`baseline.json`](baseline.json). These timings cover the listed small-expression workloads; they do not predict spreadsheet UI latency, worst-case BigInt performance or irrational/numerical calculation performance.
