'use strict';
// JSON bridge for the independent Python oracle. No eval or external dependencies.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const enginePath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'alice-math.min.js'));
const AliceMath = require(enginePath);
const request = JSON.parse(fs.readFileSync(0, 'utf8'));
const rational = q => q ? { n: String(q.n), d: String(q.d) } : null;
if (!Array.isArray(request.cases)) throw new Error('Expected a cases array.');
if (request.mode === 'approximate') {
  const Approx = require(path.join(path.dirname(enginePath), 'alice-approx.js'));
  const results = request.cases.map(c => {
    const r = Approx.calculate(c.expr, undefined, {}, { enabled: true, precision: c.precision });
    return { id: c.id, status: r.status, code: r.code, exact: r.exact, approximate: r.approximate,
      text: r.text, precision: r.precision, approximateValue: r.approximateValue,
      baseApproximateValue: r.baseApproximateValue, dim: r.dim, unitLabel: r.unitLabel };
  });
  process.stdout.write(JSON.stringify({ node: process.version, results }));
} else if (request.mode === 'benchmark') {
  const { warmups = 2, repeats = 7, batches = 25 } = request;
  if (!Number.isInteger(batches) || batches < 1 || batches > 100 || !request.cases.length || !Number.isInteger(warmups) || warmups < 0 || warmups > 20 || !Number.isInteger(repeats) || repeats < 1 || repeats > 50) throw new Error('Invalid benchmark settings.');
  const run = () => {
    let checksum = 0;
    for (let batch = 0; batch < batches; batch++) for (const c of request.cases) {
      const result = AliceMath.calculate(c.expr);
      if (result.status !== 'result' || !result.rational) throw new Error('Benchmark calculation failed: ' + c.id);
      checksum += result.text.length;
    }
    return checksum;
  };
  for (let i = 0; i < warmups; i++) run();
  const samplesMs = [];
  let checksum;
  for (let i = 0; i < repeats; i++) {
    const start = process.hrtime.bigint();
    checksum = run();
    samplesMs.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  process.stdout.write(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model || 'unknown', uniqueCases: request.cases.length, casesPerSample: request.cases.length * batches, batches, warmups, repeats, samplesMs, checksum }));
} else {
  const results = request.cases.map(c => {
    const r = AliceMath.calculate(c.expr);
    return { id: c.id, status: r.status, code: r.code, exact: r.exact, kind: r.kind ?? null, text: r.text, rational: rational(r.rational), baseRational: rational(r.baseRational), dim: r.dim ?? null, unitLabel: r.unitLabel ?? null };
  });
  process.stdout.write(JSON.stringify({ node: process.version, results }));
}
