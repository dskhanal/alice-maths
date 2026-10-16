/*! AliceMath approximate adapter | Alice by San | CC BY-NC 4.0
 * decimal.js is separately licensed under MIT; see vendor/decimal.LICENCE.md.
 * The exact engine is unchanged. Decimal results are never exposed as rationals.
 */
(function (g) {
  'use strict';
  const Exact = typeof module !== 'undefined' && module.exports ? require('./alice-math.min.js') : g.AliceMath;
  const Decimal = typeof module !== 'undefined' && module.exports ? require('./vendor/decimal.js') : g.Decimal;
  const PRECISIONS = [20, 34, 50, 100];
  const FUNCTIONS = ['sqrt', 'exp', 'ln', 'log', 'logten', 'sin', 'cos', 'tan'];
  const RESERVED = Exact.Syntax.RESERVED;
  const fail = (message, code = 'APPROXIMATE_ERROR') => { throw Exact.Syntax.error(code, message); };
  const same = (a, b) => a.every((n, i) => n === b[i]);
  const scalar = [0, 0, 0];
  const suffix = dim => dim.map((e, i) => e ? ['m', 's', 'kg'][i] + (e === 1 ? '' : '^' + e) : '').filter(Boolean).join(' * ');

  const normalize = Exact.Syntax.normalize;

  // A fresh constructor isolates per-calculation precision from any other user of decimal.js.
  function numericContext(precision) {
    const D = Decimal.clone({ precision: precision + 12, rounding: Decimal.ROUND_HALF_EVEN,
      minE: -1233, maxE: 1233, toExpNeg: -7, toExpPos: 21 });
    const rational = q => new D(String(q.n)).div(String(q.d));
    const value = (n, dim = scalar) => {
      if (!n.isFinite()) fail('Approximate numeric range exceeded.');
      if (!Array.isArray(dim) || dim.length !== 3 || dim.some(e => !Number.isInteger(e) || Math.abs(e) > 10)) fail('Unit exponent budget exceeded.');
      return { n, dim: [...dim] };
    };
    const notUnderflow = (n, shouldBeNonzero) => {
      if (shouldBeNonzero && n.isZero()) fail('Approximate numeric range underflow.');
      return n;
    };
    const operate = (a, b, op) => {
      if (op === '+' || op === '-') {
        if (!same(a.dim, b.dim)) fail('Addition requires compatible units.', 'UNIT_MISMATCH');
        return value(op === '+' ? a.n.plus(b.n) : a.n.minus(b.n), a.dim);
      }
      if (op === '*') return value(notUnderflow(a.n.mul(b.n), !a.n.isZero() && !b.n.isZero()), a.dim.map((e, i) => e + b.dim[i]));
      if (op === '/') {
        if (b.n.isZero()) fail('Division by zero.', 'DIVISION_BY_ZERO');
        return value(notUnderflow(a.n.div(b.n), !a.n.isZero()), a.dim.map((e, i) => e - b.dim[i]));
      }
      if (!same(b.dim, scalar) || !b.n.isInteger() || b.n.abs().gt(10)) fail('Use an integer exponent from -10 to 10.');
      const exponent = b.n.toNumber();
      if (a.n.isZero() && exponent < 0) fail('Division by zero.', 'DIVISION_BY_ZERO');
      return value(notUnderflow(a.n.pow(exponent), !a.n.isZero()), a.dim.map(e => e * exponent));
    };
    const apply = (fn, a) => {
      if (fn === 'sqrt') {
        if (a.n.isNegative() && !a.n.isZero()) fail('Square root requires a nonnegative value.', 'SQRT_DOMAIN');
        if (a.dim.some(e => e % 2 !== 0)) fail('Square root requires even SI exponents.', 'ROOT_DIMENSION');
        return value(a.n.sqrt(), a.dim.map(e => e / 2));
      }
      if (!same(a.dim, scalar)) fail(fn + ' requires a dimensionless argument.');
      if (fn === 'ln' || fn === 'log' || fn === 'logten') {
        if (a.n.lte(0)) fail('Natural logarithm requires a positive value.');
        return value(fn === 'logten' ? a.n.log(10) : a.n.ln());
      }
      if (fn === 'exp') {
        if (a.n.abs().gt(1000)) fail('Exponential argument budget exceeded (absolute limit 1000).');
        return value(a.n.exp());
      }
      if (a.n.abs().gt(1000000)) fail('Trigonometric argument budget exceeded (absolute limit 1000000 radians).');
      if (fn === 'tan' && a.n.cos().abs().lt(new D(10).pow(-(precision + 4)))) fail('Tangent is undefined or too close to a pole at this precision.');
      return value(a.n[fn]());
    };
    return { D, rational, value, operate, apply };
  }

  class Parser extends Exact.Syntax.DomainParser {
    constructor(text, units, values, numeric) {
      const { D, rational, value, operate, apply } = numeric;
      super(text, { functions: FUNCTIONS, number: t => value(new D(t)), neg: a => value(a.n.neg(), a.dim), operate, apply,
        implicit: t => Object.hasOwn(units, t) || Object.hasOwn(values, t) || t === '(' || t === 'pi' || t === 'e' || FUNCTIONS.includes(t),
        symbol: t => {
          if (Object.hasOwn(values, t)) {
            const input = values[t];
            if (input.approximate === true) {
              if (typeof input.approximateValue !== 'string' || input.approximateValue.length > 300 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(input.approximateValue)) fail('Invalid approximate reference.', 'INVALID_REFERENCE');
              return value(new D(input.approximateValue), input.dim);
            }
            if (!input.a.zero()) fail('Approximate equations are unsupported; use the exact linear solver.', 'APPROXIMATE_EQUATION');
            return value(rational(input.b), input.dim);
          }
          if (Object.hasOwn(units, t)) return value(rational(Exact.Q.read(units[t][0])), units[t][1]);
          if (t === 'pi') return value(D.acos(-1));
          if (t === 'e') return value(new D(1).exp());
          fail('Use numbers, declared units, pi/e, or sqrt, exp, ln/log, log10, sin, cos and tan.', 'UNKNOWN_SYMBOL');
        }
      });
    }
  }

  function renderApprox(v, numeric, precision, unitLabel = suffix(v.dim), magnitude = v.n, kind = 'value') {
    return { status: 'result', exact: false, approximate: true, kind,
      text: '≈ ' + magnitude.toSignificantDigits(precision).toString() + (unitLabel ? ' ' + unitLabel : ''), precision,
      approximateValue: magnitude.toString(), baseApproximateValue: v.n.toString(), dim: v.dim, unitLabel,
      rounding: 'half-even', workingPrecision: precision + 12 };
  }
  function aggregate(results, fn, options = {}) {
    try {
      const product = /^(PROD|PRODUCT)$/i.test(fn), mean = /^(AVG|AVERAGE)$/i.test(fn);
      if (!results.length) {
        if (mean) fail('Average requires at least one numeric cell.', 'EMPTY_AVERAGE');
        return Exact.calculate('0');
      }
      for (const r of results) if (r.status !== 'result' || (!r.rational && !r.approximate)) throw Exact.Syntax.error(r.code || 'INVALID_REFERENCE', r.text === 'undefined' ? 'Division by zero.' : r.text || 'Referenced cell is unresolved.');
      if (!results.some(r => r.approximate)) {
        const values = results.map(r => new Exact.V(r.baseRational || r.rational, new Exact.Q(0), r.dim));
        let v = values.slice(1).reduce((a, b) => product ? a.mul(b) : a.add(b), values[0]);
        if (mean) v = v.div(new Exact.V(new Exact.Q(values.length)));
        return Exact.calculate('aggregateresult', Exact.DEFAULT_UNITS, { aggregateresult: v });
      }
      if (!options.enabled) fail('Enable Approximate mode to use approximate references.', 'APPROXIMATION_DISABLED');
      const precision = options.precision ?? 34;
      if (!PRECISIONS.includes(precision)) fail('Choose 20, 34, 50 or 100 significant digits.', 'PRECISION');
      const numeric = numericContext(precision);
      const values = results.map(r => numeric.value(r.approximate ? new numeric.D(r.baseApproximateValue) : numeric.rational(r.baseRational || r.rational), r.dim));
      let v = values.slice(1).reduce((a, b) => numeric.operate(a, b, product ? '*' : '+'), values[0]);
      if (mean) v = numeric.operate(v, numeric.value(new numeric.D(values.length)), '/');
      return renderApprox(v, numeric, precision);
    } catch (e) { return { status: e.code === 'DIVISION_BY_ZERO' ? 'error' : 'unsupported', code: e.code || 'AGGREGATE_ERROR', text: e.message, exact: false }; }
  }

  function calculate(input, units = Exact.DEFAULT_UNITS, values = {}, options = {}) {
    const hasApproximateInput = Object.values(values).some(v => v?.approximate === true);
    const exact = hasApproximateInput ? null : Exact.calculate(input, units, values);
    if (!options.enabled) return exact || { status: 'unsupported', text: 'Enable Approximate mode to use approximate references.' };
    if (exact?.status === 'result') return exact;
    // Preserve numeric/unit budgets and solver/domain guards diagnosed by the exact engine.
    const eligible = ['IRRATIONAL_ROOT', 'UNKNOWN_SYMBOL', 'INVALID_SYNTAX', 'TRAILING_SYNTAX'];
    if (exact && !eligible.includes(exact.code)) return exact;
    try {
      const precision = options.precision ?? 34;
      if (!PRECISIONS.includes(precision)) fail('Choose 20, 34, 50 or 100 significant digits.');
      const raw = normalize(input);
      if (raw.includes('=') || /^solve\b/.test(raw)) fail('Approximate equations are unsupported; use the exact linear solver.');
      const numeric = numericContext(precision);
      const expression = raw.replace(/^convert\s+/, '');
      const conversion = expression.match(/^(.+?)\s+(?:to|in)\s+(.+)$/);
      const v = new Parser(conversion ? conversion[1].trim() : expression, units, values, numeric).complete();
      let magnitude = v.n, unitLabel = suffix(v.dim);
      if (conversion) {
        const name = conversion[2].trim();
        // Target units must be exact declared-unit expressions, not pi or approximate references.
        const target = Exact.calculate(name, units);
        if (target.status !== 'result' || !target.rational || target.rational.zero() || same(v.dim, scalar) || !same(v.dim, target.dim) || !/[a-z]/.test(name) || !/^[-a-z*/()^+\d\s]+$/.test(name)) fail('Conversion requires compatible declared unit expressions.');
        magnitude = numeric.operate(v, numeric.value(numeric.rational(target.rational), target.dim), '/').n;
        unitLabel = name;
      }
      return renderApprox(v, numeric, precision, unitLabel, magnitude, conversion ? 'conversion' : 'value');
    } catch (error) {
      return { status: error.code === 'DIVISION_BY_ZERO' ? 'error' : 'unsupported', code: error.code || 'APPROXIMATE_ERROR', text: error.message, exact: false };
    }
  }
  const api = { calculate, aggregate, PRECISIONS, RESERVED };
  g.AliceApprox = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
