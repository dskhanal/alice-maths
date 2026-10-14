'use strict';
// AliceGrid & Omnibox Controller — Powered by AliceMath (BigInt Q, Dimensional V, Linear Parser)

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const ROWS = 26;

const unitsRegistry = JSON.parse(JSON.stringify(AliceMath.DEFAULT_UNITS));
let rawCells = new Map();       // coord -> raw string
let evaluatedCells = new Map(); // coord -> evaluation metadata
let selectedCoord = 'B2';
let displayFormat = 'auto';     // 'auto' | 'fraction' | 'float'
let selectedTemplate = 'audit';
let wrapCellText = false;
let fitCellColumns = false;
let commentAnchor = null;
let commentPinned = false;
let commentHideTimer;
const CUSTOM_WORKBOOK_STORAGE_KEY = 'alice.custom-workbooks/v1';
const customWorkbooks = new Map();
const workbookSessions = new Map();
let hasLoadedWorkbook = false;
let customWorkbookCounter = 0;
let workbookStorageError = '';
let pendingDeleteWorkbookId = null;

const WORKBOOK_TEMPLATES = {
  audit: {
    A1: 'Item / Benchmark', B1: 'Input A', C1: 'Input B', D1: 'Exact AliceMath Formula', E1: 'Linear / % / Unit Audit',
    A2: 'Classic 0.1 + 0.2', B2: '=0.1', C2: '=0.2', D2: '=B2 + C2', E2: '=15% of D2',
    A3: 'Thirds + Sixths', B3: '=1/3', C3: '=1/6', D3: '=B3 + C3', E3: '=solve 4*x - D3 = 0',
    A4: 'Repeating Prime 1/97', B4: '=1/97', C4: '=96/97', D4: '=B4 + C4', E4: '=B4 * 97',
    A5: 'Seventh Harmonics', B5: '=1/7', C5: '=2/7', D5: '=4/7', E5: '=SUM(B5:D5)',
    A6: 'High-Power Compound', B6: '=(1 + 1/10)^8', C6: '=1/8', D6: '=B6 * C6', E6: '=AVG(B2:B5)',
    A8: 'Boundary Guard Tests', B8: 'Expression', C8: 'Live Guard Output',
    A9: 'Division by Zero', B9: '1 / (D4 - 1)', C9: '=1 / (D4 - 1)',
    A10: 'Nonlinear Guard', B10: 'x * x = 4', C10: '=x * x = 4',
    A11: 'Unit Mismatch Guard', B11: '5 m + 3 kg', C11: '=5 m + 3 kg'
  },
  physics: {
    A1: 'Robotics / SI Subsystem', B1: 'Measurement 1', C1: 'Measurement 2', D1: 'Combined / Derived SI', E1: 'Converted Target Unit',
    A2: 'Chassis Track Segment', B2: '=3 m', C2: '=45 cm', D2: '=B2 + C2', E2: '=convert D2 to mm',
    A3: 'Lidar Range Sweep', B3: '=1.25 km', C3: '=250 m', D3: '=B3 + C3', E3: '=convert D3 to mi',
    A4: 'Cycle Duration', B4: '=2 min', C4: '=30 s', D4: '=B4 + C4', E4: '=convert D4 to ms',
    A5: 'Kinematics Velocity', B5: '=D3', C5: '=D4', D5: '=B5 / C5', E5: '=D5 * 10 s',
    A6: 'Payload Mass Budget', B6: '=12 kg', C6: '=750 g', D6: '=B6 + C6', E6: '=convert D6 to lb',
    A7: 'Actuator Force & Work', B7: '=25 n', C7: '=4 m', D7: '=B7 * C7', E7: '=convert D7 to kj',
    A8: 'Motor Power Output', B8: '=D7', C8: '=20 s', D8: '=B8 / C8', E8: '=convert D8 to kw'
  },
  algebra: {
    A1: 'Financial / Engineering Scenario', B1: 'Fixed Base', C1: 'Target Outcome', D1: 'Linear Equation (solve for x)', E1: 'Verification Check',
    A2: 'Unit Breakeven Quantity (x)', B2: '=450', C2: '=1950', D2: '=solve 15*x + B2 = C2', E2: '=15 * D2 + B2',
    A3: 'Resistor Divider Balance (x)', B3: '=12', C3: '=4', D3: '=solve (B3 - C3) - 2*x = 0', E3: '=B3 - 2*D3',
    A4: 'Fractional Slope Intercept (x)', B4: '=1/3', C4: '=7/6', D4: '=solve (2/3)*x + B4 = C4', E4: '=(2/3)*D4 + B4',
    A5: 'Tax-Inclusive Reverse Solve (x)', B5: '=10', C5: '=230', D5: '=solve x + 15% of x = C5', E5: '=D5 * 1.15',
    A6: 'Total Solved Unknowns Sum', B6: '=SUM(B2:B5)', C6: '=SUM(C2:C5)', D6: '=SUM(D2:D5)', E6: '=AVG(D2:D5)'
  }
};

for (const [name, workbook] of Object.entries(SCENARIO_WORKBOOKS)) {
  const cells = { A1: 'Scenario', B1: 'Input A', C1: 'Input B', D1: 'Exact result / guard', E1: 'Cross-check', F1: 'What this demonstrates' };
  workbook.rows.forEach((row, index) => {
    row.slice(0, 6).forEach((value, col) => { if (value) cells[COLS[col] + (index + 2)] = value; });
  });
  WORKBOOK_TEMPLATES[name] = cells;
}

// DOM References
const gridEl = document.querySelector('#sheet-grid');
const formulaInput = document.querySelector('#formula-input');
const activeCellBadge = document.querySelector('#active-cell-badge');
const omniboxInput = document.querySelector('#omnibox-input');
const omniboxPreview = document.querySelector('#omnibox-preview');
const omniboxTape = document.querySelector('#omnibox-tape');
const quickChips = document.querySelector('#omni-quick-chips');
const unitListEl = document.querySelector('#unit-list');
const unitCountBadge = document.querySelector('#unit-count-badge');

// Coordinate Helpers
function parseCoord(coord) {
  const m = /^([A-Z])(\d+)$/i.exec(coord.trim());
  if (!m) return null;
  const colIdx = COLS.indexOf(m[1].toUpperCase());
  const rowIdx = Number(m[2]) - 1;
  if (colIdx < 0 || rowIdx < 0 || rowIdx >= ROWS) return null;
  return { colIdx, rowIdx, coord: COLS[colIdx] + (rowIdx + 1) };
}

function expandRange(startCoord, endCoord) {
  const a = parseCoord(startCoord);
  const b = parseCoord(endCoord);
  if (!a || !b) return [];
  const c1 = Math.min(a.colIdx, b.colIdx), c2 = Math.max(a.colIdx, b.colIdx);
  const r1 = Math.min(a.rowIdx, b.rowIdx), r2 = Math.max(a.rowIdx, b.rowIdx);
  const out = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      out.push(COLS[c] + (r + 1));
    }
  }
  return out;
}

function decodeCustomWorkbookStore(json) {
  const data = JSON.parse(json);
  if (data.schema !== 'alice.custom-workbooks/v1' || !Array.isArray(data.workbooks)) throw new Error('Unsupported workbook store.');
  const workbooks = new Map();
  for (const book of data.workbooks) {
    if (!book || typeof book.id !== 'string' || !/^user-[a-z0-9-]+$/i.test(book.id) || workbooks.has(book.id) || typeof book.name !== 'string' || !book.name.trim() || book.name.length > 80 || !Array.isArray(book.cells)) throw new Error('Invalid saved workbook.');
    const cells = new Map();
    for (const entry of book.cells) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !parseCoord(entry[0]) || typeof entry[1] !== 'string') throw new Error('Invalid saved cell.');
      cells.set(parseCoord(entry[0]).coord, entry[1]);
    }
    workbooks.set(book.id, { id: book.id, name: book.name, cells });
  }
  const units = {};
  for (const [name, definition] of Object.entries(data.units || {})) {
    if (!/^[a-z]+$/.test(name) || name === 'x' || name === 'sqrt' || !Array.isArray(definition) || definition.length !== 2 || typeof definition[0] !== 'string' || !Array.isArray(definition[1]) || definition[1].length !== 3 || definition[1].some(n => !Number.isInteger(n) || Math.abs(n) > 10)) throw new Error('Invalid saved unit.');
    AliceMath.Q.read(definition[0]);
    units[name] = definition;
  }
  return { workbooks, active: data.active, units };
}

function restoreCustomWorkbooks() {
  try {
    const json = localStorage.getItem(CUSTOM_WORKBOOK_STORAGE_KEY);
    if (!json) return 'audit';
    const saved = decodeCustomWorkbookStore(json);
    Object.assign(unitsRegistry, saved.units);
    for (const [id, book] of saved.workbooks) { customWorkbooks.set(id, book); appendCustomWorkbookOption(book); }
    return customWorkbooks.has(saved.active) || Object.hasOwn(WORKBOOK_TEMPLATES, saved.active) ? saved.active : 'audit';
  } catch (_) {
    workbookStorageError = 'Browser save unavailable. Use Export JSON to keep a copy.';
    return 'audit';
  }
}

function captureCurrentCustomWorkbook() {
  if (!hasLoadedWorkbook) return;
  const workbook = customWorkbooks.get(selectedTemplate);
  if (workbook) workbook.cells = new Map(rawCells);
  else if (Object.hasOwn(WORKBOOK_TEMPLATES, selectedTemplate)) workbookSessions.set(selectedTemplate, new Map(rawCells));
}

function customUnitDefinitions() {
  return Object.fromEntries(Object.entries(unitsRegistry).filter(([name, definition]) => JSON.stringify(definition) !== JSON.stringify(AliceMath.DEFAULT_UNITS[name])));
}

function persistCustomWorkbooks() {
  if (!workbookStorageError) {
    try {
      const workbooks = [...customWorkbooks.values()].map(book => ({ id: book.id, name: book.name, cells: [...book.cells] }));
      localStorage.setItem(CUSTOM_WORKBOOK_STORAGE_KEY, JSON.stringify({ schema: 'alice.custom-workbooks/v1', active: selectedTemplate, workbooks, units: customUnitDefinitions() }));
    } catch (_) {
      workbookStorageError = 'Browser save unavailable. Use Export JSON to keep a copy.';
    }
  }
  updateWorkbookStorageStatus();
  if (customWorkbooks.has(selectedTemplate)) updateWorkbookGuide(selectedCoord);
}

function updateWorkbookStorageStatus() {
  const status = document.querySelector('#workbook-storage-status');
  status.textContent = workbookStorageError || (customWorkbooks.has(selectedTemplate) ? 'Saved in this browser' : '');
  status.classList.toggle('is-warning', !!workbookStorageError);
  document.querySelector('#delete-workbook').hidden = !customWorkbooks.has(selectedTemplate);
}

function validateNewWorkbookName(value) {
  const name = String(value).trim();
  if (!name) throw new Error('Enter a workbook name.');
  if (name.length > 80) throw new Error('Use a name with 80 characters or fewer.');
  if ([...customWorkbooks.values()].some(book => book.name.toLowerCase() === name.toLowerCase())) throw new Error('A workbook with this name already exists. Choose another name.');
  return name;
}

function defaultNewWorkbookName() {
  let number = 1;
  while ([...customWorkbooks.values()].some(book => book.name.toLowerCase() === ('My Workbook ' + number).toLowerCase())) number++;
  return 'My Workbook ' + number;
}

function appendCustomWorkbookOption(workbook) {
  let group = document.querySelector('#custom-workbook-options');
  if (!group) {
    group = document.createElement('optgroup');
    group.id = 'custom-workbook-options';
    group.label = 'My workbooks';
    document.querySelector('#template-select').append(group);
  }
  const option = document.createElement('option');
  option.value = workbook.id;
  option.textContent = workbook.name;
  group.append(option);
}

function createCustomWorkbook(value) {
  const name = validateNewWorkbookName(value);
  let id;
  do { id = 'user-' + Date.now().toString(36) + '-' + (++customWorkbookCounter).toString(36); } while (customWorkbooks.has(id));
  const workbook = { id, name, cells: new Map() };
  customWorkbooks.set(id, workbook);
  appendCustomWorkbookOption(workbook);
  loadTemplate(id);
  return workbook;
}

function deleteCustomWorkbook(id) {
  if (!customWorkbooks.has(id)) throw new Error('This workbook is no longer available.');
  if (workbookStorageError) throw new Error('Browser storage is unavailable. Export your workbook and retry when storage is available.');
  captureCurrentCustomWorkbook();
  const nextActive = selectedTemplate === id ? 'audit' : selectedTemplate;
  const workbooks = [...customWorkbooks.values()].filter(book => book.id !== id).map(book => ({ id: book.id, name: book.name, cells: [...book.cells] }));
  // Save first: a storage failure must leave the workbook and its selector intact.
  try {
    localStorage.setItem(CUSTOM_WORKBOOK_STORAGE_KEY, JSON.stringify({ schema: 'alice.custom-workbooks/v1', active: nextActive, workbooks, units: customUnitDefinitions() }));
  } catch (_) {
    throw new Error('Could not delete the saved workbook. Browser storage is unavailable; your workbook is still here.');
  }
  customWorkbooks.delete(id);
  const group = document.querySelector('#custom-workbook-options');
  if (group) {
    for (const option of [...group.children]) if (option.value === id) option.remove();
    if (!group.children.length) group.remove();
  }
  workbookSessions.delete(id);
  if (selectedTemplate === id) loadTemplate(nextActive);
  else updateWorkbookStorageStatus();
}

function loadTemplate(name) {
  captureCurrentCustomWorkbook();
  selectedTemplate = customWorkbooks.has(name) || Object.hasOwn(WORKBOOK_TEMPLATES, name) ? name : 'audit';
  const custom = customWorkbooks.get(selectedTemplate);
  rawCells = custom ? new Map(custom.cells) : workbookSessions.has(selectedTemplate) ? new Map(workbookSessions.get(selectedTemplate)) : new Map(Object.entries(WORKBOOK_TEMPLATES[selectedTemplate]));
  hasLoadedWorkbook = true;
  document.querySelector('#template-select').value = selectedTemplate;
  recalculateAll();
  selectCell(custom ? 'A1' : 'D2');
  persistCustomWorkbooks();
}

// Convert an evaluated AliceMath result back into an exact canonical token string for downstream cells
function createReferenceContext(expr) {
  return { values: Object.create(null), reserved: new Set(expr.toLowerCase().match(/[a-z]+/g) || []), next: 0 };
}

function canonicalToken(evalObj, context) {
  if (!evalObj || evalObj.status !== 'result' || !evalObj.rational) {
    throw new Error(evalObj?.text || 'Referenced cell is unresolved.');
  }
  // Conversion results expose a target-unit magnitude; downstream arithmetic needs SI magnitude.
  const q = evalObj.baseRational || evalObj.rational;
  const dim = evalObj.dim || [0, 0, 0];
  // Keep valid large rationals as typed values rather than reparsing oversized numeric tokens.
  if (context && (String(q.n).replace('-', '').length > 100 || String(q.d).length > 100)) {
    let name;
    do {
      let id = context.next++, suffix = '';
      do { suffix = String.fromCharCode(97 + id % 26) + suffix; id = Math.floor(id / 26); } while (id);
      name = 'cellref' + suffix;
    } while (context.reserved.has(name) || Object.hasOwn(unitsRegistry, name) || Object.hasOwn(context.values, name));
    context.values[name] = new AliceMath.V(q, new AliceMath.Q(0), dim);
    return name;
  }
  const frac = `(${q.n}/${q.d})`;
  const unitFactors = dim
    .map((exp, i) => (exp ? `${['m', 's', 'kg'][i]}${exp === 1 ? '' : '^' + exp}` : ''))
    .filter(Boolean)
    .join(' * ');
  return unitFactors ? `(${frac} *${unitFactors})` : frac;
}

// Evaluate a single cell with recursive DAG resolution and cycle detection
function evaluateCell(coord, visiting = new Set()) {
  if (evaluatedCells.has(coord)) return evaluatedCells.get(coord);
  const raw = (rawCells.get(coord) || '').trim();
  if (!raw) {
    const emptyRes = { kind: 'empty', raw: '', display: '', status: 'empty' };
    evaluatedCells.set(coord, emptyRes);
    return emptyRes;
  }

  // Plain text label if it doesn't start with '=' and isn't a pure number
  const isFormula = raw.startsWith('=');
  const isPureNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw);
  if (!isFormula && !isPureNumber) {
    const labelRes = { kind: 'label', raw, display: raw, status: 'label' };
    evaluatedCells.set(coord, labelRes);
    return labelRes;
  }

  if (visiting.has(coord)) {
    const cycleRes = {
      kind: 'error',
      raw,
      resolvedExpr: raw.replace(/^=/, ''),
      display: raw.replace(/^=/, ''),
      status: 'unsupported',
      text: 'Circular cell dependency detected.'
    };
    evaluatedCells.set(coord, cycleRes);
    return cycleRes;
  }

  visiting.add(coord);
  let expr = isFormula ? raw.slice(1).trim() : raw;
  try {
    const referenceContext = createReferenceContext(expr);
    expr = expandMacrosAndCellRefs(expr, visiting, referenceContext);
    const calc = AliceMath.calculate(expr, unitsRegistry, referenceContext.values);
    const floatApprox = computeFloatComparison(expr, calc);
    const expectedLimit = isExpectedLimit(coord, raw, calc);
    const resultObj = {
      ...calc,
      raw,
      resolvedExpr: expr,
      floatApprox,
      expectedLimit,
      display: formatCellDisplay(calc, floatApprox)
    };
    const issue = getCalculationIssue(resultObj);
    if (issue) resultObj.display = issue.expression;
    evaluatedCells.set(coord, resultObj);
    visiting.delete(coord);
    return resultObj;
  } catch (err) {
    visiting.delete(coord);
    const errRes = {
      kind: 'error',
      raw,
      resolvedExpr: expr,
      status: 'unsupported',
      text: err.message,
      display: expr
    };
    evaluatedCells.set(coord, errRes);
    return errRes;
  }
}

// Expand ranges and single references; parseCoord validates against COLS and ROWS.
function expandMacrosAndCellRefs(expr, visiting, context) {
  let out = expr.replace(/\b(SUM|AVG|PROD)\s*\(\s*([A-Z]\d+)\s*:\s*([A-Z]\d+)\s*\)/gi, (_, fn, c1, c2) => {
    const coords = expandRange(c1, c2);
    if (!coords.length) throw new Error('Invalid cell range.');
    const tokens = coords.map(c => {
      const ev = evaluateCell(c, new Set(visiting));
      return canonicalToken(ev, context);
    });
    const op = fn.toUpperCase() === 'PROD' ? ' * ' : ' + ';
    const joined = `(${tokens.join(op)})`;
    return fn.toUpperCase() === 'AVG' ? `(${joined} /${coords.length})` : joined;
  });

  out = out.replace(/\b([A-Z]\d+)\b/gi, match => {
    const parsed = parseCoord(match);
    if (!parsed) throw new Error('Invalid cell coordinate: ' + match);
    const norm = parsed.coord;
    const ev = evaluateCell(norm, new Set(visiting));
    return canonicalToken(ev, context);
  });

  return out;
}

function rationalToFloat(q) {
  if (q.n === 0n) return 0;
  const sign = q.n < 0n ? -1 : 1;
  const n = q.n < 0n ? -q.n : q.n, d = q.d;
  let exponent = n.toString(2).length - d.toString(2).length;
  if (exponent >= 0 ? n < (d << BigInt(exponent)) : (n << BigInt(-exponent)) < d) exponent--;
  if (exponent > 1023) return sign * Infinity;
  if (exponent < -1075) return sign * 0;
  const unitExponent = exponent < -1022 ? -1074 : exponent - 52;
  const numerator = unitExponent < 0 ? n << BigInt(-unitExponent) : n;
  const denominator = unitExponent > 0 ? d << BigInt(unitExponent) : d;
  let mantissa = numerator / denominator;
  const twiceRemainder = 2n * (numerator % denominator);
  if (twiceRemainder > denominator || (twiceRemainder === denominator && mantissa % 2n)) mantissa++;
  return sign * Number(mantissa) * 2 ** unitExponent;
}

function isExpectedLimit(coord, raw, calc) {
  const parsed = parseCoord(coord);
  const row = SCENARIO_WORKBOOKS[selectedTemplate]?.rows[(parsed?.rowIdx ?? 0) - 1];
  if (!row || parsed.colIdx !== 3 || raw !== row[3]) return false;
  if (calc.status === 'unsupported') return row[6] === 'Unsupported expression' || row[6] === calc.text;
  return row[6] === 'undefined' && calc.text === 'undefined';
}

function computeFloatComparison(resolvedExpr, calc) {
  if (!calc || !calc.rational) return null;
  const q = calc.rational;
  const exactFloat = rationalToFloat(q);
  // Also simulate naive JS IEEE-754 evaluation on simple arithmetic to expose classic 0.1 + 0.2 drift
  let naiveFloat = exactFloat;
  try {
    const clean = resolvedExpr.replace(/[^0-9+\-*/^().\s]/g, '');
    if (clean && clean === resolvedExpr) {
      // Compute binary float step-by-step using AliceMath tokens without eval
      const p = new AliceMath.Parser(clean, {});
      naiveFloat = evalFloatTokens(p.tokens);
      if (Number.isNaN(naiveFloat)) naiveFloat = exactFloat;
    }
  } catch (_) {}
  return { exactFloat, naiveFloat };
}

// Safe token-based float evaluator (no eval) to demonstrate IEEE-754 drift vs BigInt Q
function evalFloatTokens(tokens) {
  let i = 0;
  function parseExpr(minBp = 0) {
    let t = tokens[i++];
    let lhs = 0;
    if (t === '+' || t === '-') {
      const v = parseExpr(25);
      lhs = t === '-' ? -v : v;
    } else if (t === '(') {
      lhs = parseExpr(0);
      i++; // ')'
    } else {
      lhs = parseFloat(t);
    }
    while (i < tokens.length) {
      const op = tokens[i];
      const bp = { '+': 10, '-': 10, '*': 20, '/': 20, '^': 30 }[op] ?? -1;
      if (bp < minBp) break;
      i++;
      const rhs = parseExpr(op === '^' ? bp : bp + 1);
      lhs = op === '+' ? lhs + rhs : op === '-' ? lhs - rhs : op === '*' ? lhs * rhs : op === '/' ? lhs / rhs : Math.pow(lhs, rhs);
    }
    return lhs;
  }
  return parseExpr(0);
}

function formatCellDisplay(calc, floatApprox) {
  if (!calc) return '';
  if (calc.status !== 'result') return calc.text;
  if (!calc.rational) return calc.text;

  const q = calc.rational;
  const unitSuffix = calc.unitLabel ? ' ' + calc.unitLabel : '';
  const eqPrefix = calc.kind === 'equation' ? 'x = ' : '';

  if (displayFormat === 'fraction') {
    return `${eqPrefix}${q.n}/${q.d}${unitSuffix}`;
  }
  if (displayFormat === 'float' && floatApprox) {
    const fStr = String(floatApprox.naiveFloat);
    return `${eqPrefix}${fStr}${unitSuffix}`;
  }
  return calc.text;
}

function getCalculationIssue(ev) {
  if (!ev || ev.kind === 'empty' || ev.kind === 'label') return null;
  const expression = ev.resolvedExpr || (ev.raw || '').replace(/^=/, '');
  if (ev.status === 'unsupported' || ev.kind === 'error') {
    return { expression, title: ev.expectedLimit ? 'Expected limit' : ev.kind === 'error' ? 'Calculation error' : 'Unsupported calculation', reason: ev.text || 'This calculation could not be completed.' };
  }
  if (ev.text === 'undefined') {
    return { expression, title: ev.expectedLimit ? 'Expected limit' : 'Undefined calculation', reason: 'Division by zero has no defined result.' };
  }
  if (displayFormat === 'float' && ev.floatApprox && (!Number.isFinite(ev.floatApprox.naiveFloat) || (ev.rational?.n !== 0n && ev.floatApprox.naiveFloat === 0))) {
    return { expression, title: 'Float64 limit', reason: 'Float64 cannot represent this result. Switch to Exact Auto or Strict Fraction to inspect the exact value.' };
  }
  return null;
}

function recalculateAll() {
  evaluatedCells.clear();
  for (let r = 1; r <= ROWS; r++) {
    for (const c of COLS) {
      const coord = c + r;
      if (rawCells.has(coord)) evaluateCell(coord);
    }
  }
  renderGridValues();
  updateInspector(selectedCoord);
  updateOmniboxPreview();
}

// Build DOM Grid
function buildGridDOM() {
  gridEl.replaceChildren();
  const colgroup = document.createElement('colgroup');
  for (let i = 0; i <= COLS.length; i++) {
    const col = document.createElement('col');
    col.style.width = (i === 0 ? 46 : 155) + 'px';
    colgroup.append(col);
  }
  gridEl.append(colgroup);
  const thead = document.createElement('thead');
  const hRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'row-hdr';
  corner.textContent = '∑';
  hRow.append(corner);

  for (const col of COLS) {
    const th = document.createElement('th');
    th.className = 'col-hdr';
    th.textContent = col;
    hRow.append(th);
  }
  thead.append(hRow);
  gridEl.append(thead);

  const tbody = document.createElement('tbody');
  for (let r = 1; r <= ROWS; r++) {
    const tr = document.createElement('tr');
    const rHdr = document.createElement('th');
    rHdr.className = 'row-hdr';
    rHdr.textContent = String(r);
    tr.append(rHdr);

    for (const col of COLS) {
      const coord = col + r;
      const td = document.createElement('td');
      td.className = 'sheet-cell';
      td.dataset.coord = coord;
      td.onclick = () => selectCell(coord);
      td.ondblclick = () => startInlineEdit(coord, td);
      tr.append(td);
    }
    tbody.append(tr);
  }
  gridEl.append(tbody);
}

function renderGridValues() {
  closeCellComment();
  const cells = gridEl.querySelectorAll('.sheet-cell');
  cells.forEach(td => {
    const coord = td.dataset.coord;
    const ev = evaluatedCells.get(coord);
    td.className = 'sheet-cell' + (coord === selectedCoord ? ' selected' : '');
    if (!ev || ev.kind === 'empty') {
      td.textContent = '';
      td.removeAttribute('title');
      return;
    }
    const content = document.createElement('span');
    content.className = 'cell-content';
    content.textContent = ev.display;
    td.replaceChildren(content);
    td.title = ev.raw !== ev.display ? `${ev.raw} →${ev.display}` : ev.display;
    const issue = getCalculationIssue(ev);
    if (issue) {
      td.removeAttribute('title');
      td.classList.add('has-comment');
      const marker = document.createElement('button');
      marker.className = 'cell-comment-marker';
      marker.type = 'button';
      marker.setAttribute('aria-label', 'Show calculation comment for ' + coord);
      marker.setAttribute('aria-controls', 'cell-comment');
      marker.setAttribute('aria-expanded', 'false');
      marker.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4V5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
      marker.onclick = e => {
        e.stopPropagation();
        const closing = commentAnchor === marker && commentPinned;
        if (closing) { closeCellComment(); return; }
        if (selectedCoord !== coord) selectCell(coord);
        const currentMarker = gridEl.querySelector(`[data-coord="${coord}"] .cell-comment-marker`);
        openCellComment(currentMarker, coord, issue, ev.raw, true);
      };
      marker.onmouseenter = () => { if (!commentPinned) openCellComment(marker, coord, issue, ev.raw); };
      marker.onmouseleave = scheduleCommentClose;
      marker.onfocus = () => { if (!commentPinned) openCellComment(marker, coord, issue, ev.raw); };
      marker.onblur = scheduleCommentClose;
      td.append(marker);
    }
    if (ev.expectedLimit || issue?.title === 'Float64 limit') td.classList.add('is-limit');
    else if (ev.status === 'unsupported' || ev.kind === 'error') td.classList.add('is-err');
    else if (issue) td.classList.add('is-err');
    else if (ev.kind === 'label') td.classList.add('is-label');
    else if (ev.kind === 'equation') td.classList.add('is-eq');
    else if (ev.unitLabel) td.classList.add('is-unit');
    else td.classList.add('is-num');
  });
  updateGridTextLayout();
}

function updateGridTextLayout() {
  gridEl.classList.toggle('wrap-cell-text', wrapCellText);
  document.querySelector('#wrap-cell-text').setAttribute('aria-pressed', String(wrapCellText));
  document.querySelector('#wrap-cell-text').classList.toggle('active', wrapCellText);
  document.querySelector('#fit-cell-columns').setAttribute('aria-pressed', String(fitCellColumns));
  document.querySelector('#fit-cell-columns').classList.toggle('active', fitCellColumns);
  const widths = COLS.map(() => 155);
  if (fitCellColumns) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    gridEl.querySelectorAll('.sheet-cell').forEach(td => {
      const col = parseCoord(td.dataset.coord).colIdx;
      const content = td.querySelector('.cell-content');
      if (!content) return;
      ctx.font = getComputedStyle(content).font;
      const width = Math.max(...content.textContent.split('\n').map(line => ctx.measureText(line).width));
      widths[col] = Math.max(widths[col], Math.ceil(width) + (td.classList.contains('has-comment') ? 40 : 20));
    });
  }
  gridEl.querySelectorAll('colgroup col').forEach((col, i) => { col.style.width = (i === 0 ? 46 : widths[i - 1]) + 'px'; });
  gridEl.querySelectorAll('.col-hdr').forEach((th, i) => { th.style.width = widths[i] + 'px'; });
  gridEl.style.width = (46 + widths.reduce((sum, width) => sum + width, 0)) + 'px';
}

function openCellComment(marker, coord, issue, raw, pinned = false) {
  clearTimeout(commentHideTimer);
  if (commentAnchor && commentAnchor !== marker) commentAnchor.setAttribute('aria-expanded', 'false');
  commentAnchor = marker;
  commentPinned = pinned;
  marker.setAttribute('aria-expanded', 'true');
  const popup = document.querySelector('#cell-comment');
  document.querySelector('#cell-comment-title').textContent = coord + ' · ' + issue.title;
  document.querySelector('#cell-comment-reason').textContent = issue.reason;
  document.querySelector('#cell-comment-expression').textContent = issue.expression;
  document.querySelector('#cell-comment-raw').textContent = raw;
  popup.hidden = false;
  const rect = marker.getBoundingClientRect();
  popup.style.left = Math.max(12, Math.min(rect.right + 8, window.innerWidth - popup.offsetWidth - 12)) + 'px';
  popup.style.top = Math.max(12, Math.min(rect.top, window.innerHeight - popup.offsetHeight - 12)) + 'px';
}

function closeCellComment(restoreFocus = false) {
  clearTimeout(commentHideTimer);
  const marker = commentAnchor;
  commentAnchor = null;
  commentPinned = false;
  if (marker) marker.setAttribute('aria-expanded', 'false');
  document.querySelector('#cell-comment').hidden = true;
  if (restoreFocus && marker?.isConnected) {
    // Focusing the marker again must not immediately reopen its hover/focus comment.
    marker.onfocus = null;
    marker.focus();
    marker.onfocus = () => marker.onmouseenter();
  }
}

function scheduleCommentClose() {
  if (commentPinned) return;
  clearTimeout(commentHideTimer);
  commentHideTimer = setTimeout(() => {
    const popup = document.querySelector('#cell-comment');
    if (!popup.contains(document.activeElement) && document.activeElement !== commentAnchor) closeCellComment();
  }, 250);
}

function selectCell(coord) {
  selectedCoord = coord;
  activeCellBadge.textContent = coord;
  formulaInput.value = rawCells.get(coord) || '';
  renderGridValues();
  updateInspector(coord);
}

function commitCellValue(coord, val) {
  const trimmed = val.trim();
  if (trimmed) rawCells.set(coord, trimmed);
  else rawCells.delete(coord);
  recalculateAll();
  captureCurrentCustomWorkbook();
  persistCustomWorkbooks();
}

function startInlineEdit(coord, td) {
  selectCell(coord);
  const currentRaw = rawCells.get(coord) || '';
  td.textContent = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cell-inline-editor';
  input.value = currentRaw;
  td.append(input);
  input.focus();
  input.select();

  let committed = false;
  const finish = save => {
    if (committed) return;
    committed = true;
    if (save) commitCellValue(coord, input.value);
    else renderGridValues();
  };

  input.onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
      moveSelection(0, 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      finish(true);
      moveSelection(e.shiftKey ? -1 : 1, 0);
    }
  };
  input.onblur = () => finish(true);
}

function moveSelection(dCol, dRow) {
  const p = parseCoord(selectedCoord);
  if (!p) return;
  const nextCol = Math.max(0, Math.min(COLS.length - 1, p.colIdx + dCol));
  const nextRow = Math.max(0, Math.min(ROWS - 1, p.rowIdx + dRow));
  selectCell(COLS[nextCol] + (nextRow + 1));
}

// Inspector Panel Update
function updateInspector(coord) {
  updateWorkbookGuide(coord);
  const ev = evaluatedCells.get(coord);
  document.querySelector('#insp-coord').textContent = coord;
  const statusEl = document.querySelector('#inspector-status');

  if (!ev || ev.kind === 'empty') {
    statusEl.textContent = 'Empty';
    statusEl.className = 'badge';
    document.querySelector('#insp-raw').textContent = '—';
    document.querySelector('#insp-resolved').textContent = '—';
    document.querySelector('#insp-output').textContent = '—';
    document.querySelector('#insp-fraction').textContent = '—';
    document.querySelector('#insp-bits').textContent = '—';
    document.querySelector('#insp-dim').textContent = '[0, 0, 0] (dimensionless)';
    document.querySelector('#insp-float').textContent = '—';
    return;
  }

  const issue = getCalculationIssue(ev);
  statusEl.textContent = issue ? issue.title : ev.status || ev.kind;
  statusEl.className = 'badge ' + (ev.expectedLimit || issue?.title === 'Float64 limit' ? 'warn' : issue ? 'err' : ev.status === 'result' ? 'good' : ev.kind === 'label' ? '' : 'err');
  document.querySelector('#insp-raw').textContent = ev.raw || '—';
  document.querySelector('#insp-resolved').textContent = ev.resolvedExpr || ev.raw || '—';
  document.querySelector('#insp-output').textContent = ev.text || ev.display || '—';

  if (ev.rational) {
    const q = ev.rational;
    document.querySelector('#insp-fraction').textContent = `${q.n} /${q.d}`;
    const nBits = q.n === 0n ? 1 : q.n.toString(2).replace('-', '').length;
    const dBits = q.d.toString(2).length;
    document.querySelector('#insp-bits').textContent = `${nBits}b num / ${dBits}b den (limit 4096b)`;
  } else {
    document.querySelector('#insp-fraction').textContent = '—';
    document.querySelector('#insp-bits').textContent = '—';
  }

  const dim = ev.dim || [0, 0, 0];
  const dimDesc = dim.every(x => x === 0)
    ? '[0, 0, 0] (dimensionless)'
    : `[${dim.join(', ')}] → m^${dim[0]} · s^${dim[1]} · kg^${dim[2]}`;
  document.querySelector('#insp-dim').textContent = dimDesc;

  if (ev.floatApprox) {
    document.querySelector('#insp-float').textContent = String(ev.floatApprox.naiveFloat);
  } else {
    document.querySelector('#insp-float').textContent = '—';
  }
}

function updateWorkbookGuide(coord) {
  const workbook = SCENARIO_WORKBOOKS[selectedTemplate];
  const custom = customWorkbooks.get(selectedTemplate);
  document.querySelector('#workbook-guide').hidden = !workbook && !custom;
  document.querySelector('#workbook-sources').hidden = !!custom;
  if (custom) {
    document.querySelector('#workbook-title').textContent = custom.name;
    document.querySelector('#workbook-summary').textContent = workbookStorageError ? 'Your workbook is kept for this session. Export JSON to keep a copy.' : 'Your workbook is saved in this browser. Export JSON to keep a portable copy.';
    document.querySelector('#workbook-example').textContent = 'Enter numbers, = formulas, fractions, unit expressions, or a linear equation. Cell references stay within this workbook.';
    document.querySelector('#workbook-expected').textContent = '';
    return;
  }
  if (!workbook) return;
  document.querySelector('#workbook-title').textContent = workbook.title.replace(/^Workbook \d+ · /, '');
  document.querySelector('#workbook-summary').textContent = workbook.summary;
  const row = workbook.rows[(parseCoord(coord)?.rowIdx ?? 0) - 1];
  document.querySelector('#workbook-example').textContent = row ? row[0] + ': ' + row[5] : 'Select a result or guard cell to inspect its formula and exact rational output.';
  document.querySelector('#workbook-expected').textContent = row ? 'Template result (Exact Auto): ' + (row[7] || row[6]) : '';
  const links = document.querySelector('#workbook-sources');
  links.replaceChildren();
  const sources = workbook.sources || [];
  for (const [label, href] of sources) {
    const a = document.createElement('a');
    a.textContent = label;
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    links.append(a);
  }
}

// Smart Omnibox Controller (Supports live cell references inside Omnibox!)
function evaluateOmniboxText(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  try {
    const expr = trimmed.replace(/^=/, '');
    const referenceContext = createReferenceContext(expr);
    const expanded = expandMacrosAndCellRefs(expr, new Set(), referenceContext);
    return { expanded, res: AliceMath.calculate(expanded, unitsRegistry, referenceContext.values) };
  } catch (e) {
    return { expanded: trimmed, res: { status: 'unsupported', text: e.message } };
  }
}

function updateOmniboxPreview() {
  const out = evaluateOmniboxText(omniboxInput.value);
  if (!out) {
    omniboxPreview.textContent = 'Type an expression…';
    return;
  }
  omniboxPreview.textContent = out.res.text;
}

function addTapeItem(expr) {
  const out = evaluateOmniboxText(expr);
  if (!out) return;
  const item = document.createElement('div');
  item.className = 'tape-item';
  const top = document.createElement('div');
  top.className = 'tape-expr';
  top.textContent = expr + (out.expanded !== expr ? `  [${out.expanded}]` : '');
  const bot = document.createElement('div');
  bot.className = 'tape-res';
  bot.textContent = '= ' + out.res.text;
  item.append(top, bot);
  item.onclick = () => {
    omniboxInput.value = expr;
    updateOmniboxPreview();
  };
  omniboxTape.prepend(item);
}

// Unit Registry Panel
function renderUnitsRegistry() {
  const entries = Object.entries(unitsRegistry);
  unitCountBadge.textContent = `${entries.length} units`;
  unitListEl.replaceChildren();
  entries.forEach(([name, [scale, dim]]) => {
    const div = document.createElement('div');
    const dimStr = dim.map((e, i) => (e ? `${['m', 's', 'kg'][i]}${e === 1 ? '' : '^' + e}` : '')).filter(Boolean).join('·') || '1';
    div.textContent = `${name}: ${scale} (${dimStr})`;
    unitListEl.append(div);
  });
}

// Event Listeners & Shortcuts
document.querySelector('#delete-workbook').onclick = () => {
  const book = customWorkbooks.get(selectedTemplate);
  if (!book) return;
  closeCellComment();
  pendingDeleteWorkbookId = book.id;
  document.querySelector('#delete-workbook-name').textContent = book.name;
  document.querySelector('#delete-workbook-error').hidden = true;
  document.querySelector('#delete-workbook-dialog').showModal();
  document.querySelector('#cancel-delete-workbook').focus();
};
document.querySelector('#cancel-delete-workbook').onclick = () => document.querySelector('#delete-workbook-dialog').close();
document.querySelector('#delete-workbook-dialog').addEventListener('close', () => {
  pendingDeleteWorkbookId = null;
  const button = document.querySelector('#delete-workbook');
  (button.hidden ? document.querySelector('#template-select') : button).focus();
});
document.querySelector('#delete-workbook-form').addEventListener('submit', e => {
  e.preventDefault();
  try {
    deleteCustomWorkbook(pendingDeleteWorkbookId);
    document.querySelector('#delete-workbook-dialog').close();
  } catch (err) {
    const error = document.querySelector('#delete-workbook-error');
    error.textContent = err.message;
    error.hidden = false;
  }
});
document.querySelector('#new-workbook').onclick = () => {
  closeCellComment();
  const input = document.querySelector('#new-workbook-name');
  input.value = defaultNewWorkbookName();
  document.querySelector('#new-workbook-hint').textContent = workbookStorageError ? 'Start with a blank grid for this session. Export JSON to keep a copy.' : 'Start with a blank grid. Your workbooks are saved in this browser.';
  document.querySelector('#new-workbook-error').hidden = true;
  document.querySelector('#new-workbook-dialog').showModal();
  input.focus();
  input.select();
};
document.querySelector('#cancel-new-workbook').onclick = () => document.querySelector('#new-workbook-dialog').close();
document.querySelector('#new-workbook-dialog').addEventListener('close', () => {
  if (document.activeElement === document.body) document.querySelector('#new-workbook').focus();
});
document.querySelector('#new-workbook-form').addEventListener('submit', e => {
  e.preventDefault();
  try {
    createCustomWorkbook(document.querySelector('#new-workbook-name').value);
    document.querySelector('#new-workbook-dialog').close();
    formulaInput.focus();
  } catch (err) {
    const error = document.querySelector('#new-workbook-error');
    error.textContent = err.message;
    error.hidden = false;
  }
});
document.querySelector('#wrap-cell-text').onclick = () => {
  wrapCellText = !wrapCellText;
  closeCellComment();
  updateGridTextLayout();
};
document.querySelector('#fit-cell-columns').onclick = () => {
  fitCellColumns = !fitCellColumns;
  closeCellComment();
  updateGridTextLayout();
};
document.querySelector('#close-cell-comment').onclick = () => closeCellComment(true);
document.querySelector('#cell-comment').onmouseenter = () => clearTimeout(commentHideTimer);
document.querySelector('#cell-comment').onmouseleave = scheduleCommentClose;
document.querySelector('.table-scroll').addEventListener('scroll', () => closeCellComment());
window.addEventListener('resize', () => closeCellComment());
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('.cell-comment-marker, #cell-comment')) closeCellComment();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && commentAnchor) { e.preventDefault(); closeCellComment(true); }
});
formulaInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    commitCellValue(selectedCoord, formulaInput.value);
    moveSelection(0, 1);
  }
});

omniboxInput.addEventListener('input', updateOmniboxPreview);
omniboxInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addTapeItem(omniboxInput.value);
  }
});

document.querySelector('#omnibox-send-cell').onclick = () => {
  const val = omniboxInput.value.trim();
  if (!val) return;
  const asFormula = val.startsWith('=') ? val : '=' + val;
  formulaInput.value = asFormula;
  commitCellValue(selectedCoord, asFormula);
};

document.querySelector('#omnibox-pin').onclick = () => addTapeItem(omniboxInput.value);
document.querySelector('#clear-tape').onclick = () => omniboxTape.replaceChildren();

// Display Format Toggle
document.querySelectorAll('.display-mode-group .chip').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.display-mode-group .chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    displayFormat = btn.dataset.format;
    recalculateAll();
  };
});

// Workbook Selector
document.querySelector('#template-select').onchange = e => loadTemplate(e.target.value);
document.querySelector('#clear-sheet').onclick = () => {
  rawCells.clear();
  recalculateAll();
  selectCell('A1');
  captureCurrentCustomWorkbook();
  persistCustomWorkbooks();
};

// Custom Unit Registration
document.querySelector('#add-unit-btn').onclick = () => {
  const name = document.querySelector('#new-unit-name').value.trim().toLowerCase();
  const scale = document.querySelector('#new-unit-scale').value.trim();
  const dimRaw = document.querySelector('#new-unit-dim').value.trim();
  if (!/^[a-z]+$/.test(name)) {
    alert('Unit name must contain lowercase letters only (a-z).');
    return;
  }
  if (name === 'x' || name === 'sqrt') {
    alert('This name is reserved for the variable or a math function.');
    return;
  }
  try {
    AliceMath.Q.read(scale);
    const dim = dimRaw.split(',').map(s => Number(s.trim()));
    if (dim.length !== 3 || dim.some(n => !Number.isInteger(n) || Math.abs(n) > 10)) {
      throw new Error('Dimensions must be 3 integers between -10 and 10.');
    }
    unitsRegistry[name] = [scale, dim];
    renderUnitsRegistry();
    recalculateAll();
    document.querySelector('#new-unit-name').value = '';
    document.querySelector('#new-unit-scale').value = '';
    persistCustomWorkbooks();
  } catch (e) {
    alert('Invalid unit definition: ' + e.message);
  }
};

// Export CSV & JSON
function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.querySelector('#export-csv').onclick = () => {
  const rows = [];
  for (let r = 1; r <= ROWS; r++) {
    const line = COLS.map(c => {
      const ev = evaluatedCells.get(c + r);
      const val = ev?.display || '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    rows.push(line.join(','));
  }
  downloadBlob('alice-grid-export.csv', rows.join('\n'), 'text/csv');
};

document.querySelector('#export-json').onclick = () => {
  const dump = {
    schema: 'alice.grid-workbook/v1',
    name: customWorkbooks.get(selectedTemplate)?.name || SCENARIO_WORKBOOKS[selectedTemplate]?.title || document.querySelector('#template-select').selectedOptions[0].textContent,
    units: customUnitDefinitions(),
    cells: Object.fromEntries(rawCells),
    evaluated: Object.fromEntries(
      [...evaluatedCells.entries()]
        .filter(([, v]) => v.kind !== 'empty')
        .map(([k, v]) => [k, { raw: v.raw, output: v.text || v.display, status: v.status }])
    )
  };
  downloadBlob('alice-grid-workbook.json', JSON.stringify(dump, null, 2), 'application/json');
};

// Global Keyboard Navigation (Cmd/Ctrl+K for Omnibox, Arrow keys in grid)
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    omniboxInput.focus();
    omniboxInput.select();
    return;
  }
  if (document.activeElement === document.body) {
    if (e.key === 'ArrowRight') { e.preventDefault(); moveSelection(1, 0); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); moveSelection(-1, 0); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(0, 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(0, -1); }
    else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      commitCellValue(selectedCoord, '');
      formulaInput.value = '';
    }
  }
});

// Initialize Quick Omnibox Chips & Boot
[
  'solve 2*x + 3 = 11',
  '1/3 + 1/6',
  'convert 500 w * 2 hr to kj',
  '15% of 240',
  '1 / 97',
  'SUM(B2:B5)'
].forEach(sample => {
  const btn = document.createElement('button');
  btn.className = 'chip';
  btn.textContent = sample;
  btn.onclick = () => {
    omniboxInput.value = sample;
    updateOmniboxPreview();
    addTapeItem(sample);
  };
  quickChips.append(btn);
});

for (const [name, workbook] of Object.entries(SCENARIO_WORKBOOKS).sort(([, a], [, b]) => Number(a.title.match(/\d+/)[0]) - Number(b.title.match(/\d+/)[0]))) {
  const option = document.createElement('option');
  option.value = name;
  option.textContent = workbook.title;
  document.querySelector('#template-select').append(option);
}
const initialWorkbook = restoreCustomWorkbooks();
buildGridDOM();
renderUnitsRegistry();
loadTemplate(initialWorkbook);
[
  'solve 2*x + 3 = 11',
  'convert 1500 m to km',
  '0.1 + 0.2',
  '1 / 97'
].forEach(addTapeItem);
