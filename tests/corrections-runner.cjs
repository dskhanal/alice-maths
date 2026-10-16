'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const root=path.resolve(__dirname,'..');
const A=require(path.join(root,'alice-math.min.js')),IO=require(path.join(root,'workbook-io.js'));
const context=vm.createContext({AliceMath:A,AliceApprox:require(path.join(root,'alice-approx.js')),AliceWorkbookIO:IO,AliceHistory:require(path.join(root,'workbook-history.js')),AliceSheet:require(path.join(root,'spreadsheet-tools.js')),AliceWorkbookStorage:require(path.join(root,'workbook-storage.js')),document:{querySelector:()=>({classList:{toggle(){}}})}});
vm.runInContext(fs.readFileSync(path.join(root,'workbooks.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').split('// Event Listeners & Shortcuts')[0],context);
const requests=JSON.parse(fs.readFileSync(0,'utf8'));
const results=requests.map(c=>{let expr=c.expr;if(c.imported){const t=IO.translateFormula(expr,{cols:'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),rows:26});if(t.reason)return{status:'unsupported',text:t.reason};expr=t.raw.slice(1);}context.sample={...c,expr};const r=vm.runInContext(`rawCells=new Map(Object.entries(sample.cells||{}));evaluatedCells.clear();calculationMode=sample.approximate?'approximate':'exact';decimalPrecision=sample.precision||50;evaluateOmniboxText(sample.expr).res`,context);return{status:r.status,code:r.code,text:r.text,exact:r.exact,approximate:r.approximate,dim:r.dim,n:r.rational?.n.toString(),d:r.rational?.d.toString()};});
process.stdout.write(JSON.stringify(results));
