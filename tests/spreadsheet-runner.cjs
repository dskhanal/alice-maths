'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({AliceMath:require(path.join(root,'alice-math.min.js')),AliceApprox:require(path.join(root,'alice-approx.js')),AliceHistory:require(path.join(root,'workbook-history.js')),AliceWorkbookIO:require(path.join(root,'workbook-io.js')),AliceSheet:require(path.join(root,'spreadsheet-tools.js')),document:{querySelector:()=>({classList:{toggle(){}}})}});
vm.runInContext(fs.readFileSync(path.join(root,'workbooks.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').split('// Event Listeners & Shortcuts')[0],context);
const expressions=JSON.parse(fs.readFileSync(0,'utf8'));
const result=expressions.map(expression=>{context.expression=expression;const r=vm.runInContext(`rawCells=new Map([['A1','='+expression]]);evaluatedCells.clear();evaluateCell('A1')`,context);return{status:r.status,text:r.text,n:r.rational?.n.toString(),d:r.rational?.d.toString()};});
process.stdout.write(JSON.stringify(result));
