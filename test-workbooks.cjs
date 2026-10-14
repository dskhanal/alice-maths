const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.argv[2] || __dirname;
const AliceMath = require(path.join(root, 'alice-math.min.js'));
const context = vm.createContext({ AliceMath, document: { querySelector: () => ({ classList: { toggle() {} } }) } });
vm.runInContext(fs.readFileSync(path.join(root, 'workbooks.js'), 'utf8'), context);
const controller = fs.readFileSync(path.join(root, 'app.js'), 'utf8').split('// Event Listeners & Shortcuts')[0];
vm.runInContext(controller, context);
const results = vm.runInContext(`
  const checks = [];
  for (const [name, workbook] of Object.entries(SCENARIO_WORKBOOKS)) {
    selectedTemplate = name;
    rawCells = new Map(Object.entries(WORKBOOK_TEMPLATES[name]));
    evaluatedCells.clear();
    workbook.rows.forEach((row, i) => {
      const coord = 'D' + (i + 2), actual = evaluateCell(coord);
      const pass = row[6] === 'Unsupported expression' ? actual.status === 'unsupported' : actual.text === row[6];
      checks.push({ workbook: name, coord, scenario: row[0], expected: row[6], actual: actual.text, pass });
      if (row[4]) {
        const check = evaluateCell('E' + (i + 2));
        checks.push({ workbook: name, coord: 'E' + (i + 2), scenario: row[0] + ' cross-check resolves', actual: check.text, pass: check.status === 'result' && !!check.rational });
      }
    });
  }
  checks;
`, context);
function check(name, run) {
  try { run(); results.push({ scenario: name, pass: true }); }
  catch (e) { results.push({ scenario: name, pass: false, actual: e.message }); }
}
check('conversion exposes exact SI magnitude', () => {
  const result=AliceMath.calculate('convert 3.45 m to mm');
  assert.equal(result.rational.n,3450n);
  assert.equal(result.baseRational.n,69n);
  assert.equal(result.baseRational.d,20n);
});
check('variable exponent rejected', () => assert.equal(AliceMath.calculate('solve 2^x=4').status,'unsupported'));
check('linear first power accepted', () => assert.equal(AliceMath.calculate('solve x^1=4').text,'x = 4'));
check('zero-power identity accepted', () => assert.equal(AliceMath.calculate('solve x^0=1').text,'all x'));
check('full-grid references and ranges', () => {
  const out = vm.runInContext(`rawCells = new Map([['I19','=5'],['Z26','=7'],['A1','=I19+Z26'],['A2','=SUM(I19:I19)']]); evaluatedCells.clear(); [evaluateCell('A1').text,evaluateCell('A2').text];`,context);
  assert.equal(out[0],'12.0'); assert.equal(out[1],'5.0');
});
check('compound float drift is simulated', () => {
  const value=vm.runInContext(`computeFloatComparison('(1+1/10)^8',AliceMath.calculate('(1+1/10)^8')).naiveFloat`,context);
  assert.equal(value,(1+1/10)**8);
});
for (const [expr,expected] of [['sqrt(25)','5'],['sqrt(9/16)','0.75'],['sqrt(0)','0'],['sqrt((3 m/s)^2)','3 m * s^-1'],['sqrt(2)','Square root is irrational; exact rational results only.'],['sqrt(-1)','Square root requires a nonnegative value.'],['sqrt(1 m)','Square root requires even SI exponents.'],['solve sqrt(x)=2','Square roots with variables are unsupported.']]) {
  check('exact square root: '+expr,()=>assert.equal(AliceMath.calculate(expr).text,expected));
}
for (const invalid of ['1/2/3','1.2.3','','abc','1//2']) {
  check('malformed scale rejected: '+invalid,()=>assert.throws(()=>AliceMath.Q.read(invalid),/Invalid rational/));
}
check('large rationals survive direct and chained references',()=>{
  const values=vm.runInContext(`selectedTemplate='audit';rawCells=new Map([['A1','=(((9/10)^10)^10)^10'],['A2','=A1'],['A3','=A2*2'],['A4','=SUM(A1:A2)']]);evaluatedCells.clear();[evaluateCell('A1'),evaluateCell('A2'),evaluateCell('A3'),evaluateCell('A4')];`,context);
  assert.equal(values[1].text,values[0].text);
  assert.equal(values[2].rational.n*values[0].rational.d,2n*values[0].rational.n*values[2].rational.d);
  assert.equal(values[3].text,values[2].text);
});
check('large typed aliases do not resolve undeclared user symbols',()=>{
  const value=vm.runInContext(`rawCells.set('B1','=cellrefa+A1');evaluatedCells.clear();evaluateCell('B1');`,context);
  assert.equal(value.status,'unsupported');
});
for (const [name,n,d,expected] of [
  ['large finite ratio',9n**1000n,10n**1000n,Number('1.7478712517226516e-46')],
  ['halfway ties to even',2n**53n+1n,2n**53n,1],
  ['smallest subnormal',1n,2n**1074n,Number.MIN_VALUE],
  ['half-minimum rounds to zero',1n,2n**1075n,0],
  ['subnormal tie rounds to even',3n,2n**1075n,2*Number.MIN_VALUE],
  ['overflow is infinity',2n**1024n,1n,Infinity],
  ['underflow is zero',1n,2n**2000n,0],
  ['signed underflow',-1n,2n**2000n,-0]
]) {
  context.testQ=new AliceMath.Q(n,d);
  check('Float64 rounding: '+name,()=>assert.equal(vm.runInContext('rationalToFloat(testQ)',context),expected));
}
check('finite large rational float comparison never becomes NaN',()=>{
  context.testQ=new AliceMath.Q(9n**1000n,10n**1000n);
  const value=vm.runInContext(`computeFloatComparison('cellrefa',{rational:testQ}).naiveFloat`,context);
  assert.equal(value,Number('1.7478712517226516e-46'));
});
check('expected limits are classified separately from edited errors',()=>{
  const out=vm.runInContext(`selectedTemplate='risk';rawCells=new Map(Object.entries(WORKBOOK_TEMPLATES.risk));evaluatedCells.clear();const expected=evaluateCell('D20');rawCells.set('D20','=5 m+3 s');evaluatedCells.clear();const changed=evaluateCell('D20');[expected.expectedLimit,expected.display,changed.expectedLimit];`,context);
  assert.equal(out[0],true);assert.equal(out[1],'sqrt((37/2500))');assert.equal(out[2],false);
});
check('undefined calculations show the resolved expression and a reason',()=>{
  const value=vm.runInContext(`selectedTemplate='audit';displayFormat='auto';rawCells=new Map([['A1','=5'],['A2','=A1/0']]);evaluatedCells.clear();const undefinedCell=evaluateCell('A2');[undefinedCell.display,getCalculationIssue(undefinedCell)];`,context);
  assert.equal(value[0],'(5/1)/0');assert.equal(value[1].title,'Undefined calculation');assert.match(value[1].reason,/Division by zero/);
});
check('failed reference expansion retains the unresolved expression',()=>{
  const value=vm.runInContext(`rawCells=new Map([['A1','=B1+1']]);evaluatedCells.clear();const failed=evaluateCell('A1');[failed.display,getCalculationIssue(failed)];`,context);
  assert.equal(value[0],'B1+1');assert.equal(value[1].title,'Calculation error');assert.match(value[1].reason,/unresolved/);
});
check('finite rational outside Float64 range shows a limit expression',()=>{
  const value=vm.runInContext(`displayFormat='float';rawCells=new Map([['A1','=((((2^10)^10)^10)^4)']]);evaluatedCells.clear();const overflow=evaluateCell('A1');[overflow.display,getCalculationIssue(overflow)];`,context);
  assert.equal(value[0],'((((2^10)^10)^10)^4)');assert.equal(value[1].title,'Float64 limit');
});
check('valid identity and contradiction are not calculation comments',()=>{
  const values=vm.runInContext(`displayFormat='auto';rawCells=new Map([['A1','=solve x=x'],['A2','=solve x+1=x+2']]);evaluatedCells.clear();[getCalculationIssue(evaluateCell('A1')),getCalculationIssue(evaluateCell('A2'))];`,context);
  assert.equal(values[0],null);assert.equal(values[1],null);
});
const memoryStorage = new Map();
context.localStorage = { getItem: key => memoryStorage.get(key) || null, setItem: (key,value) => memoryStorage.set(key,value) };
vm.runInContext(`
  appendCustomWorkbookOption = () => {};
  recalculateAll = () => { evaluatedCells.clear(); for (const coord of rawCells.keys()) evaluateCell(coord); };
  selectCell = coord => { selectedCoord = coord; };
`,context);
check('new named workbook starts empty with A1 selected',()=>{
  const value=vm.runInContext(`customWorkbooks.clear();workbookSessions.clear();hasLoadedWorkbook=false;workbookStorageError='';loadTemplate('audit');const created=createCustomWorkbook('Mission Budget');[created.name,rawCells.size,selectedCoord,selectedTemplate];`,context);
  assert.equal(value[0],'Mission Budget');assert.equal(value[1],0);assert.equal(value[2],'A1');assert.match(value[3],/^user-/);
});
check('custom workbook edits survive switching and remain isolated',()=>{
  const value=vm.runInContext(`const firstBook=selectedTemplate;commitCellValue('A1','=1/97');createCustomWorkbook('Second Budget');commitCellValue('A1','=3');loadTemplate(firstBook);[evaluateCell('A1').text,customWorkbooks.size,customWorkbooks.get(firstBook).cells.get('A1')];`,context);
  assert.equal(value[0],'1/97');assert.equal(value[1],2);assert.equal(value[2],'=1/97');
});
check('duplicate and empty workbook names are rejected',()=>{
  assert.throws(()=>vm.runInContext(`createCustomWorkbook(' mission budget ')`,context),/already exists/);
  assert.throws(()=>vm.runInContext(`createCustomWorkbook('   ')`,context),/name/);
});
check('saved workbook store restores exact raw formulas and active workbook',()=>{
  const value=vm.runInContext(`const savedBook=selectedTemplate;customWorkbooks.clear();workbookSessions.clear();hasLoadedWorkbook=false;selectedTemplate='audit';rawCells=new Map();const restored=restoreCustomWorkbooks();loadTemplate(restored);[restored===savedBook,evaluateCell('A1').text,customWorkbooks.size];`,context);
  assert.equal(value[0],true);assert.equal(value[1],'1/97');assert.equal(value[2],2);
});
check('edited example is preserved when creating a new workbook',()=>{
  const value=vm.runInContext(`loadTemplate('audit');commitCellValue('B2','=7/10');createCustomWorkbook('Third Budget');loadTemplate('audit');[rawCells.get('B2'),evaluateCell('D2').text];`,context);
  assert.equal(value[0],'=7/10');assert.equal(value[1],'0.9');
});
check('custom unit definitions round-trip with saved workbooks',()=>{
  const value=vm.runInContext(`unitsRegistry.testspan=['1/3',[1,0,0]];persistCustomWorkbooks();const savedUnits=decodeCustomWorkbookStore(localStorage.getItem(CUSTOM_WORKBOOK_STORAGE_KEY)).units;[savedUnits.testspan[0],savedUnits.testspan[1].join(',')];`,context);
  assert.equal(value[0],'1/3');assert.equal(value[1],'1,0,0');
});
check('invalid saved coordinates and unit scales are rejected',()=>{
  assert.throws(()=>vm.runInContext(`decodeCustomWorkbookStore(JSON.stringify({schema:'alice.custom-workbooks/v1',workbooks:[{id:'user-a',name:'bad',cells:[['Z27','=1']]}]}))`,context),/Invalid saved cell/);
  assert.throws(()=>vm.runInContext(`decodeCustomWorkbookStore(JSON.stringify({schema:'alice.custom-workbooks/v1',workbooks:[],units:{badscale:['1/2/3',[1,0,0]]}}))`,context),/Invalid rational/);
});
check('failed browser storage preserves session data and reports fallback',()=>{
  context.localStorage.setItem=()=>{throw new Error('Storage full');};
  const value=vm.runInContext(`loadTemplate([...customWorkbooks.keys()][0]);commitCellValue('A2','=2/3');[rawCells.get('A2'),customWorkbooks.get(selectedTemplate).cells.get('A2'),workbookStorageError];`,context);
  assert.equal(value[0],'=2/3');assert.equal(value[1],'=2/3');assert.match(value[2],/Export JSON/);
});
check('nonzero exact values underflowing Float64 show a limit comment',()=>{
  const value=vm.runInContext(`displayFormat='float';selectedTemplate='excel';rawCells=new Map(Object.entries(WORKBOOK_TEMPLATES.excel));evaluatedCells.clear();const tiny=evaluateCell('D7');[tiny.display,getCalculationIssue(tiny).title,tiny.rational.n];`,context);
  assert.match(value[0],/^1\//);assert.equal(value[1],'Float64 limit');assert.equal(value[2],1n);
});
const originalQuerySelector = context.document.querySelector;
context.document.querySelector = selector => selector === '#custom-workbook-options' ? null : originalQuerySelector(selector);
context.localStorage.setItem = (key,value) => memoryStorage.set(key,value);
check('deleting one custom workbook retains other workbook cells',()=>{
  const value=vm.runInContext(`workbookStorageError='';customWorkbooks.clear();hasLoadedWorkbook=false;createCustomWorkbook('Keep');commitCellValue('A1','=1/97');const keepId=selectedTemplate;createCustomWorkbook('Delete');const deleteId=selectedTemplate;deleteCustomWorkbook(deleteId);[customWorkbooks.has(deleteId),customWorkbooks.get(keepId).cells.get('A1'),selectedTemplate,decodeCustomWorkbookStore(localStorage.getItem(CUSTOM_WORKBOOK_STORAGE_KEY)).workbooks.size];`,context);
  assert.equal(value[0],false);assert.equal(value[1],'=1/97');assert.equal(value[2],'audit');assert.equal(value[3],1);
});
check('deleting final workbook persists empty store and cannot resurrect on reload',()=>{
  const value=vm.runInContext(`loadTemplate([...customWorkbooks.keys()][0]);deleteCustomWorkbook(selectedTemplate);const saved=decodeCustomWorkbookStore(localStorage.getItem(CUSTOM_WORKBOOK_STORAGE_KEY));[customWorkbooks.size,saved.workbooks.size,restoreCustomWorkbooks()];`,context);
  assert.equal(value[0],0);assert.equal(value[1],0);assert.equal(value[2],'audit');
});
check('failed deletion storage write preserves workbook and current cells',()=>{
  vm.runInContext(`createCustomWorkbook('Storage Failure');commitCellValue('A1','=2/3');`,context);
  context.localStorage.setItem=()=>{throw new Error('Storage full');};
  assert.throws(()=>vm.runInContext(`deleteCustomWorkbook(selectedTemplate)`,context),/still here/);
  const value=vm.runInContext(`[customWorkbooks.has(selectedTemplate),rawCells.get('A1')];`,context);
  assert.equal(value[0],true);assert.equal(value[1],'=2/3');
});
check('built-in example workbooks cannot be deleted',()=>{
  assert.throws(()=>vm.runInContext(`deleteCustomWorkbook('rocket')`,context),/no longer available/);
  assert.equal(vm.runInContext(`Object.hasOwn(WORKBOOK_TEMPLATES,'rocket')`,context),true);
});
const failures=results.filter(r=>!r.pass);
fs.writeFileSync(path.join(require('node:os').tmpdir(),'alice-maths-workbook-results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({ total:results.length,passed:results.length-failures.length,failures },null,2));
process.exitCode=failures.length?1:0;
