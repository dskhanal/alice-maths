/*! AliceGrid exact spreadsheet helpers | Alice by San | CC BY-NC 4.0 */
(function (g) {
  'use strict';
  const ACCENTS = Object.freeze({
    purple: { label: 'Purple · default', primary: '#7761c7', dark: '#574291', pale: '#eee7f8', selected: '#f3effc', bg: '#fbfaff', side: '#f4f1f8', line: '#e5dcf0' },
    ocean: { label: 'Ocean blue', primary: '#2563b5', dark: '#18477f', pale: '#e5effb', selected: '#edf4fd', bg: '#f8fbff', side: '#eff4fa', line: '#d2e0f1' },
    teal: { label: 'Deep teal', primary: '#08786f', dark: '#07564f', pale: '#dff2ee', selected: '#eaf7f3', bg: '#f8fcfb', side: '#edf5f2', line: '#cce3dd' },
    rose: { label: 'Berry rose', primary: '#ab3565', dark: '#7d2248', pale: '#fae5ed', selected: '#fdf0f5', bg: '#fff9fc', side: '#f9eff4', line: '#efd3df' },
    amber: { label: 'Burnt amber', primary: '#9b580d', dark: '#724006', pale: '#f9edda', selected: '#fff5e5', bg: '#fffcf7', side: '#f8f2e8', line: '#eadbc5' }
  });
  const ACCENT_KEY = 'alice.ui-accent/v1';
  const normalizeAccent = name => Object.hasOwn(ACCENTS, name) ? name : 'purple';
  const readAccent = storage => { try { return normalizeAccent(storage.getItem(ACCENT_KEY)); } catch (_) { return 'purple'; } };
  function saveAccent(storage, name) { try { storage.setItem(ACCENT_KEY, normalizeAccent(name)); return true; } catch (_) { return false; } }
  const abs = n => n < 0n ? -n : n;
  function gcd(a, b) { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; }

  // Only these spreadsheet functions are intercepted. The engine parses all other syntax.
  function expandFunctions(expression, evaluate, token, Q) {
    let count = 0;
    function exact(text, name) {
      const value = evaluate(text);
      if (value.code === 'DIVISION_BY_ZERO') throw Object.assign(new Error('Division by zero.'),{code:value.code});
      if (value.status !== 'result' || !value.rational || value.approximate) throw new Error(name + ' requires an exact rational input. ' + (value.text || ''));
      if (value.dim?.some(d => d !== 0)) throw new Error(name + ' requires dimensionless inputs. Divide by the desired unit before rounding.');
      return value.rational;
    }
    function walk(text, depth) {
      if (depth > 32) throw new Error('Spreadsheet function nesting limit is 32.');
      const pattern = /\b(EXCELROUND|EXCELGCD|EXCELLCM|ROUND|FLOOR|GCD|LCM)\s*\(/gi;
      let out = '', previous = 0, match;
      while ((match = pattern.exec(text))) {
        if (++count > 256) throw new Error('Spreadsheet function count limit is 256.');
        const originalName = match[1].toUpperCase(), excel = originalName.startsWith('EXCEL'), name = originalName.replace(/^EXCEL/, ''), open = pattern.lastIndex - 1;
        let level = 1, end = open + 1, start = end;
        const args = [];
        for (; end < text.length && level; end++) {
          if (text[end] === '(') { if (++level + depth > 32) throw new Error('Spreadsheet function nesting limit is 32.'); }
          if (text[end] === ')') level--;
          if ((text[end] === ',' && level === 1) || level === 0) { args.push(text.slice(start, end).trim()); start = end + 1; }
        }
        if (level) throw new Error('Missing closing parenthesis in ' + name + '.');
        if (args.some(a => !a)) throw new Error(name + ' requires nonempty arguments.');
        const arity = name === 'ROUND' ? args.length >= 1 && args.length <= 2 : name === 'FLOOR' ? args.length === 1 : args.length >= 1 && args.length <= 32;
        if (!arity) throw new Error(name + (name === 'ROUND' ? ' accepts value and optional decimal places.' : name === 'FLOOR' ? ' accepts one value.' : ' accepts 1 to 32 integers.'));
        let values = args.map(a => exact(walk(a, depth + 1), name));
        if (excel) {
          if (name !== 'ROUND' && values.some(q => q.n < 0n)) throw new Error('Imported '+name+' requires nonnegative arguments (Excel #NUM!).');
          values = values.map((q, i) => name === 'ROUND' && i === 0 ? q : new Q(q.n / q.d));
          if (name === 'GCD' && values.some(q => q.n >= 2n ** 53n)) throw new Error('Imported GCD arguments must be below 2^53 (Excel #NUM!).');
        }
        let result;
        if (name === 'ROUND') {
          const places = values[1] || new Q(0);
          if (places.d !== 1n || places.n < -100n || places.n > 100n) throw new Error('ROUND decimal places must be an integer from -100 to 100.');
          const power = new Q(10n ** abs(places.n));
          const scaled = places.n < 0n ? values[0].div(power) : values[0].mul(power);
          let rounded = abs(scaled.n) / scaled.d;
          if ((abs(scaled.n) % scaled.d) * 2n >= scaled.d) rounded++;
          const integer = new Q(scaled.n < 0n ? -rounded : rounded);
          result = places.n < 0n ? integer.mul(power) : integer.div(power);
        } else if (name === 'FLOOR') {
          const q = values[0];
          result = new Q(q.n / q.d - (q.n < 0n && q.n % q.d !== 0n ? 1n : 0n));
        } else {
          if (values.some(q => q.d !== 1n)) throw new Error(name + ' requires integers; fractions are not truncated.');
          result = values.reduce((acc, q) => {
            const n = abs(q.n), factor = gcd(acc.n, n);
            return new Q(name === 'GCD' ? factor : (!acc.n || !n ? 0n : (acc.n / factor) * n));
          }, new Q(name === 'GCD' ? 0 : 1));
        }
        if (excel && name === 'LCM' && result.n >= 2n ** 53n) throw new Error('Imported LCM must be below 2^53 (Excel #NUM!).');
        out += text.slice(previous, match.index) + token({ status: 'result', rational: result, dim: [0, 0, 0] });
        previous = end; pattern.lastIndex = end;
      }
      return out + text.slice(previous);
    }
    if (expression.length > 2000) throw new Error('Expression limit is 2000 characters.');
    return walk(expression, 0);
  }

  function coordinate(text, options) {
    const m = /^\$?([A-Z])\$?(\d+)$/i.exec(text.trim());
    if (!m) return null;
    const col = options.cols.indexOf(m[1].toUpperCase()), row = Number(m[2]) - 1;
    return col < 0 || row < 0 || row >= options.rows ? null : { col, row, coord: options.cols[col] + (row + 1) };
  }
  function shiftFormula(raw, dRow, dCol, options) {
    if (!raw.startsWith('=')) return raw;
    return raw.replace(/(?<![a-z0-9_])(\$?)([A-Z])(\$?)(\d+)\b/gi, (all, fixedCol, col, fixedRow, row) => {
      const original = coordinate(fixedCol + col + fixedRow + row, options);
      if (!original) throw new Error('Invalid source reference: ' + all);
      const c = original.col + (fixedCol ? 0 : dCol), r = original.row + (fixedRow ? 0 : dRow);
      if (c < 0 || c >= options.cols.length || r < 0 || r >= options.rows) throw new Error('Fill would move ' + all + ' outside the grid. No cells were changed.');
      return fixedCol + options.cols[c] + fixedRow + (r + 1);
    });
  }
  // Snapshot the source before building the entire plan; validation precedes mutation.
  function planFill(cells, issues, source, throughRow, options) {
    const parts = source.trim().split(':');
    if (parts.length > 2) throw new Error('Use a source cell or rectangular range, such as B2:D2.');
    const a = coordinate(parts[0], options), b = coordinate(parts[1] || parts[0], options);
    if (!a || !b) throw new Error('Source range must be inside the current grid.');
    const left = Math.min(a.col, b.col), right = Math.max(a.col, b.col), top = Math.min(a.row, b.row), bottom = Math.max(a.row, b.row);
    if (bottom + 1 >= options.rows) throw new Error('No rows remain below the source range.');
    if (!Number.isInteger(throughRow) || throughRow <= bottom + 1 || throughRow > options.rows) throw new Error('Last row must be between ' + (bottom + 2) + ' and ' + options.rows + '.');
    const changes = []; let overwrites = 0;
    for (let r = bottom + 1; r < throughRow; r++) for (let c = left; c <= right; c++) {
      const fromRow = top + (r - bottom - 1) % (bottom - top + 1), from = options.cols[c] + (fromRow + 1), to = options.cols[c] + (r + 1);
      const original = cells.get(from) || '', raw = shiftFormula(original, r - fromRow, 0, options);
      if (raw.length > 2000) throw new Error('Filled formula exceeds 2000 characters.');
      const issue = issues.get(from);
      changes.push({ coord: to, raw, issue: issue?.raw === original ? { raw, reason: issue.reason } : null });
      if (cells.has(to)) overwrites++;
    }
    return { changes, overwrites, range: options.cols[left] + (bottom + 2) + ':' + options.cols[right] + throughRow };
  }
  const api = { ACCENTS, ACCENT_KEY, normalizeAccent, readAccent, saveAccent, expandFunctions, shiftFormula, planFill };
  if (typeof module === 'object' && module.exports) module.exports = api; else g.AliceSheet = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
