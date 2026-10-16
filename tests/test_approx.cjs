'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const AliceMath = require(path.join(root, 'alice-math.min.js'));
const AliceApprox = require(path.join(root, 'alice-approx.js'));
const AliceHistory = require(path.join(root, 'workbook-history.js'));
const AliceWorkbookIO = require(path.join(root, 'workbook-io.js'));
const Decimal = require(path.join(root, 'vendor/decimal.js'));
let total = 0;
const failures = [];
function check(name, run) {
  total++;
  try { run(); }
  catch (e) { failures.push({name,error:e.message}); console.error(name + ': ' + e.stack); process.exitCode = 1; }
}
const calc = (s, precision = 34, values = {}, units) => AliceApprox.calculate(s, units, values, { enabled: true, precision });
check('exact mode is the API default', () => assert.equal(AliceApprox.calculate('sqrt(2)').status, 'unsupported'));
for (const expression of ['1/3','sqrt(9/16)','convert 3 mi to m','solve 2*x+1=5']) {
  check('exact results unchanged: ' + expression, () => assert.deepEqual(calc(expression), AliceMath.calculate(expression)));
}
for (const precision of AliceApprox.PRECISIONS) {
  check('precision ' + precision + ' is computational, not Float64 formatting', () => {
    const r = calc('sqrt(2)', precision);
    assert.equal(r.exact, false); assert.equal(r.approximate, true); assert.equal(r.precision, precision);
    assert.equal(r.workingPrecision, precision + 12); assert.match(r.text,/^≈ /); assert.equal(r.rational,undefined);
    assert.equal(r.text.slice(2).replace('.','').length,precision);
  });
}
for (const [expression,reason] of [
  ['sqrt(-1)','nonnegative'], ['sqrt(1 m)','even SI'], ['exp(2 m)','dimensionless'],
  ['ln(0)','positive'], ['ln(-1)','positive'], ['sin(1 s)','dimensionless'],
  ['sqrt(2 m^2)+1 s','compatible units'], ['convert sqrt(2 m^2) to s','compatible'],
  ['exp(1001)','argument budget'], ['sin(1000001)','argument budget'], ['tan(pi/2)','pole'],
  ['sqrt(2)^11','integer exponent'], ['sqrt(2)^(1/2)','integer exponent'],
  ['solve sqrt(2)*x=1','Approximate equations'], ['solve x*x=4','linear'],
  ['(((2^10)^10)^10)^10+sqrt(2)','Numeric budget'], ['(1 m)^10*1 m+sqrt(2)','Unit exponent'],
  ['sqrt(2)/0','zero'], ['mystery(2)','Use numbers'], ['pi;process.exit()','syntax']
]) check('guard: ' + expression,()=>{const r=calc(expression);assert.equal(r.status,expression==='sqrt(2)/0'?'error':'unsupported');assert.match(r.text,new RegExp(reason,'i'));});
check('invalid precision is rejected',()=>assert.match(calc('pi',17).text,/Choose/));
check('pi and Unicode pi agree',()=>assert.equal(calc('pi').text,calc('π').text));
check('log is natural logarithm',()=>assert.equal(calc('log(2)').text,calc('ln(2)').text));
check('implicit multiplication and precedence',()=>assert.equal(calc('2pi').text,calc('2*pi').text));
check('pi minus pi retains approximation provenance',()=>{const r=calc('pi-pi');assert.equal(r.text,'≈ 0');assert.equal(r.exact,false);});
check('decimal settings do not mutate the shared Decimal constructor',()=>{const p=Decimal.precision;calc('sqrt(2)',100);assert.equal(Decimal.precision,p);});
check('converted approximations keep SI magnitude separately',()=>{const r=calc('convert sqrt(2 m^2) to cm');assert.deepEqual(r.dim,[1,0,0]);assert(new Decimal(r.approximateValue).div(r.baseApproximateValue).eq(100));});
check('old custom units named pi remain exact',()=>{const units={...AliceMath.DEFAULT_UNITS,pi:['2',[1,0,0]]};assert.equal(calc('3 pi',34,{},units).text,'6 m');});
const document = { querySelector: () => ({ classList:{toggle(){}}, textContent:'', hidden:false }) };
const AliceSheet=require(path.join(root,'spreadsheet-tools.js'));
const context=vm.createContext({AliceSheet,AliceMath,AliceApprox,AliceHistory,AliceWorkbookIO,document});
vm.runInContext(fs.readFileSync(path.join(root,'workbooks.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').split('// Event Listeners & Shortcuts')[0],context);
check('approximate cells, ranges and conversions propagate without rationalizing',()=>{
  const out=vm.runInContext(`calculationMode='approximate';decimalPrecision=50;rawCells=new Map([['A1','=sqrt(2)'],['A2','=A1*A1'],['B1','=convert sqrt(2 m^2) to cm'],['B2','=B1/(1 m)'],['C1','=SUM(A1:A2)'],['C2','=PROD(A1:A2)']]);evaluatedCells.clear();['A1','A2','B1','B2','C1','C2'].map(c=>evaluateCell(c));`,context);
  for(const r of out) {assert.equal(r.status,'result');assert.equal(r.approximate,true);assert.equal(r.rational,undefined);assert.match(r.display,/^≈ /);}
  assert(new Decimal(out[3].approximateValue).minus('1.4142135623730950488016887242096980785696718753769').abs().lt('1e-49'));
});
check('resolved errors show decimal values instead of internal reference aliases',()=>{
  const r=vm.runInContext(`rawCells.set('D1','=A1+1 m');evaluatedCells.clear();evaluateCell('D1');`,context);
  assert.match(r.display,/≈ 1\.414/);assert.doesNotMatch(r.display,/cellref/);
});
check('changing precision recomputes from raw formulas',()=>{
  const out=vm.runInContext(`decimalPrecision=20;evaluatedCells.clear();const a=evaluateCell('A1');decimalPrecision=100;evaluatedCells.clear();const b=evaluateCell('A1');[a,b];`,context);
  assert.equal(out[0].precision,20);assert.equal(out[1].precision,100);assert(out[1].text.length>out[0].text.length);
});
check('fraction and Float Drift display never remove approximate label',()=>{
  for(const mode of ['fraction','float']) {const out=vm.runInContext(`displayFormat='${mode}';evaluatedCells.clear();evaluateCell('A1');`,context);assert.match(out.display,/^≈ /);assert.equal(out.floatApprox,null);}
});
check('exports retain approximate flags, precision and settings',()=>{
  const out=vm.runInContext(`selectedTemplate='approximations';displayFormat='auto';exportWorkbookData();`,context);
  assert.equal(out.calculation.mode,'approximate');assert.equal(out.evaluated.A1.exact,false);assert.equal(out.evaluated.A1.approximate,true);assert.equal(out.evaluated.A1.precision,100);assert.match(out.evaluated.A1.output,/^≈ /);
});
check('exact mode blocks previous approximations and dependent ranges',()=>{
  const out=vm.runInContext(`calculationMode='exact';evaluatedCells.clear();[evaluateCell('A1'),evaluateCell('A2'),evaluateCell('C1')];`,context);
  for(const r of out) assert.equal(r.status,'unsupported');
});
check('legacy saves default to exact and new settings round-trip',()=>{
  const out=vm.runInContext(`const old=decodeCustomWorkbookStore(JSON.stringify({schema:'alice.custom-workbooks/v1',workbooks:[{id:'user-old',name:'Legacy',cells:[]}]}));const next=decodeCustomWorkbookStore(JSON.stringify({schema:'alice.custom-workbooks/v1',workbooks:[{id:'user-new',name:'Approx',cells:[],calculation:{mode:'approximate',precision:50}}]}));[old.workbooks.get('user-old').calculation,next.workbooks.get('user-new').calculation];`,context);
  assert.equal(out[0].mode,'exact');assert.equal(out[0].precision,34);assert.equal(out[1].mode,'approximate');assert.equal(out[1].precision,50);
});
check('malformed saved precision is rejected',()=>assert.throws(()=>vm.runInContext(`normalizeCalculationSettings({mode:'approximate',precision:99999})`,context),/Invalid/));
console.log(JSON.stringify({total,passed:total-failures.length,failures},null,2));
