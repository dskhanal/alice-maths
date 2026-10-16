/*! AliceGrid workbook import | Alice by San | CC BY-NC 4.0 */
(function(g){
  'use strict';
  const Exact = typeof module !== 'undefined' && module.exports ? require('./alice-math.min.js') : g.AliceMath;
  const Zip = typeof module !== 'undefined' && module.exports ? require('./xlsx-safe-zip.js') : g.AliceSafeZip;
  const MAX_FILE_BYTES=2*1024*1024,MAX_TEXT=2000;
  const own=(o,k)=>Object.hasOwn(o,k);
  const fail=m=>{throw new Error(m);};
  const numeric=s=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s);
  const numericInput=s=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s);
  const plain=o=>o&&typeof o==='object'&&!Array.isArray(o);
  const defaults=()=>({mode:'exact',precision:34});
  function settings(value){if(value===undefined)return defaults();if(!plain(value)||!['exact','approximate'].includes(value.mode)||![20,34,50,100].includes(value.precision))fail('Invalid calculation settings.');return{mode:value.mode,precision:value.precision};}
  function coordinate(text,options){const m=/^([A-Z]+)(\d+)$/i.exec(String(text));if(!m)return null;const col=options.cols.indexOf(m[1].toUpperCase()),row=Number(m[2]);return col<0||row<1||row>options.rows?null:options.cols[col]+row;}
  function validateUnits(input={},maxUnits=100,allowLegacy=false){
    if(!plain(input)||Object.keys(input).length>maxUnits)fail('Invalid custom units (maximum 100).');
    const out=Object.create(null);
    for(const[name,def]of Object.entries(input)){
      if(!/^[a-z]{1,20}$/.test(name)||(allowLegacy ? ['x','sqrt'].includes(name) : Exact.Syntax.RESERVED.includes(name))||!Array.isArray(def)||def.length!==2||typeof def[0]!=='string'||def[0].length>2500||!Array.isArray(def[1])||def[1].length!==3||def[1].some(n=>!Number.isInteger(n)||Math.abs(n)>10))fail('Invalid custom unit: '+name);
      const q=def[0];if(!numeric(q)&&!/^[-+]?\d+\/[-+]?\d+$/.test(q))fail('Invalid rational scale for '+name);
      if(q.includes('/')&&BigInt(q.split('/')[1])===0n)fail('Zero unit-scale denominator for '+name);
      let n,d;
      if(q.includes('/'))[n,d]=q.split('/').map(BigInt);
      else {const sign=q.startsWith('-')?-1n:1n;const[a,b='']=q.replace(/^[-+]/,'').split('.');n=sign*BigInt((a||'0')+b);d=10n**BigInt(b.length);}
      let a=n<0n?-n:n,b=d<0n?-d:d;while(b)[a,b]=[b,a%b];const divisor=a||1n;
      if((n/divisor).toString(2).replace('-','').length>4096||(d/divisor).toString(2).replace('-','').length>4096)fail('Numeric budget exceeded for custom unit '+name);
      out[name]=[q,[...def[1]]];
    }return out;
  }
  function validateIssues(input={},cells,options){
    if(!plain(input))fail('Invalid imported formula comments.');const out=Object.create(null);
    for(const[c,issue]of Object.entries(input)){
      const key=coordinate(c,options);
      if(!key||!plain(issue)||typeof issue.raw!=='string'||issue.raw!==cells[key]||typeof issue.reason!=='string'||issue.reason.length>500)fail('Invalid imported formula comment at '+c);
      out[key]={raw:issue.raw,reason:issue.reason};
    }return out;
  }
  function normalizedCells(input,options){
    if(!plain(input))fail('Workbook cells must be an object.');const out=Object.create(null);
    for(const[c,raw]of Object.entries(input)){
      const key=coordinate(c,options);if(!key)fail('Cell '+c+' is outside the current grid.');
      if(own(out,key))fail('Duplicate cell coordinate: '+key);
      if(typeof raw!=='string'||raw.length>MAX_TEXT)fail('Cell '+key+' must contain at most '+MAX_TEXT+' text characters.');
      if(raw.trim())out[key]=raw;
    }return out;
  }
  function dimensions(cells,options){let rows=0,cols=0;for(const c of Object.keys(cells)){const m=/^([A-Z]+)(\d+)$/.exec(c);rows=Math.max(rows,Number(m[2]));cols=Math.max(cols,options.cols.indexOf(m[1])+1);}return{rows,cols};}
  function parseJSON(text,options){
    const data=JSON.parse(text.replace(/^\uFEFF/,''));
    if(!plain(data)||data.schema!=='alice.grid-workbook/v1')fail('Choose an AliceMath Export JSON workbook (alice.grid-workbook/v1).');
    const cells=normalizedCells(data.cells,options),issues=validateIssues(data.importIssues||{},cells,options);
    return{format:'json',name:typeof data.name==='string'?data.name.slice(0,80):'Restored Workbook',cells,issues,units:validateUnits(data.units),calculation:settings(data.calculation),warnings:['Restores raw formulas and settings. Cached evaluated outputs are ignored.'],...dimensions(cells,options)};
  }
  function detectDelimiter(text){
    let quoted=false;const counts={',':0,';':0,'\t':0};
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted){if(c==='\n'||c==='\r')break;if(own(counts,c))counts[c]++;}}
    return Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  }
  function csvRows(text,delimiter){
    text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
    const pushField=()=>{row.push(field);field='';closed=false;};
    const pushRow=()=>{pushField();rows.push(row);row=[];};
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
      if(c===delimiter){pushField();continue;}
      if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;pushRow();continue;}
      if(closed){if(c===' '||c==='\t')continue;fail('Unexpected text after a CSV closing quote.');}
      if(c==='"'){if(field.length)fail('CSV quotes must start at the beginning of a field.');quoted=true;}else field+=c;
    }
    if(quoted)fail('Unclosed CSV quoted field.');
    if(field.length||row.length||closed)pushRow();
    while(rows.length&&rows.at(-1).every(v=>v===''))rows.pop();
    return rows;
  }
  function literal(text){return "'"+text;}
  function parseCSV(text,options,config={}){
    const delimiter=config.delimiter&&config.delimiter!=='auto'?config.delimiter:detectDelimiter(text);
    if(![',',';','\t'].includes(delimiter))fail('Choose comma, semicolon or tab as the delimiter.');
    const rows=csvRows(text,delimiter),cells=Object.create(null);
    if(rows.length>options.rows||rows.some(r=>r.length>options.cols.length))fail('CSV exceeds the '+options.cols.length+' columns × '+options.rows+' rows grid. No data was imported.');
    rows.forEach((row,r)=>row.forEach((v,c)=>{if(v.length>MAX_TEXT)fail('CSV cell exceeds '+MAX_TEXT+' characters.');if(v){let raw=v;if(v.startsWith("'")||(v.trimStart().startsWith('=')&&config.formulas===false)||(numericInput(v.trim())&&config.numbersAsText))raw="'"+v;cells[options.cols[c]+(r+1)]=raw;}}));
    return{format:'csv',name:'Imported CSV',cells,issues:{},units:{},calculation:defaults(),warnings:['CSV imports values and optional = formulas; it has no unit definitions or calculation settings.'],delimiter,...dimensions(cells,options)};
  }
  function numberText(n){if(!Number.isFinite(n))fail('Non-finite spreadsheet number.');return String(n);}

  function translateFormula(formula,options){
    const sourceFloor=/\bFLOOR\s*\(/i.test(String(formula));
    let text=String(formula).replace(/^=/,'').trim();const notes=[];
    const parts=text.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|\$?[a-z]+\$?\d+|[a-z_][a-z0-9_.]*|[^\s]/gi)||[];
    const operand=t=>/^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|\$?[a-z]+\$?\d+|[a-z_][a-z0-9_.]*)$/i.test(t);
    for(let i=1;i<parts.length;i++){
      const previous=parts[i-1],next=parts[i],call=/^[a-z_][a-z0-9_.]*$/i.test(previous)&&!coordinate(previous.replace(/\$/g,''),options)&&next==='(';
      if(!call&&(operand(previous)||previous===')'||previous==='%')&&(operand(next)||next==='('))return{raw:'='+text,reason:'Excel range-intersection or implicit multiplication is unsupported. Use explicit operators; cached values are ignored.'};
    }
    if(/[!\[\]{}<>=&"#;]/.test(text))return{raw:'='+text,reason:'Cross-sheet/external references, arrays, comparisons and string formulas are unsupported. The original formula is retained; cached values are ignored.'};
    if(/(?:^|[+(*/^%-])\s*-\s*(?:\d+(?:\.\d*)?|\$?[A-Z]+\$?\d+)\s*\^/i.test(text)||text.split('^').length>2)return{raw:'='+text,reason:'This power formula may have different precedence in AliceMath. Rewrite it with explicit parentheses before calculating.'};
    if(/\bAVERAGE\s*\(/i.test(text)){text=text.replace(/\bAVERAGE\s*\(/gi,'AVG(');notes.push('AVERAGE → AVG');}
    if(/\bPRODUCT\s*\(/i.test(text)){text=text.replace(/\bPRODUCT\s*\(/gi,'PROD(');notes.push('PRODUCT → PROD');}
    text=text.replace(/\bROUND\s*\(/gi,'EXCELROUND(').replace(/\bGCD\s*\(/gi,'EXCELGCD(').replace(/\bLCM\s*\(/gi,'EXCELLCM(').replace(/\bINT\s*\(/gi,'FLOOR(').replace(/\bLOG10\s*\(/gi,'LOGTEN(');
    if(/\bPI\b(?!\s*\()/i.test(text))return{raw:'='+text,reason:'Named ranges are unsupported. Use PI() explicitly for the circle constant.'};
    text=text.replace(/\bPI\s*\(\s*\)/gi,'pi');
    const functions=[...text.matchAll(/\b([A-Z]+)\s*\(/gi)].map(m=>m[1].toUpperCase());
    const allowed=['SUM','AVG','PROD','SQRT','EXP','LN','SIN','COS','TAN','EXCELROUND','EXCELGCD','EXCELLCM','FLOOR','LOGTEN'];
    if(sourceFloor)return{raw:'='+text,reason:'Excel FLOOR takes a significance argument. Use INT for integer floor, or rewrite the formula explicitly.'};
    const bad=functions.find(fn=>!allowed.includes(fn));
    if(bad)return{raw:'='+text,reason:bad==='LOG'?'Excel LOG uses a different default base. Rewrite as LN(value)/LN(10), or use LN explicitly. Cached values are ignored.':bad+' is unsupported. The formula is retained and cached values are ignored.'};
    const validation=text.replace(/\$(?=[A-Z]|\d)/gi,'');
    let stripped=validation.replace(/\b(?:SUM|AVG|PROD)\s*\(\s*([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\s*\)/gi,(_,a,b)=>coordinate(a,options)&&coordinate(b,options)?'0':'INVALID');
    if(/\b(?:SUM|AVG|PROD)\s*\(/i.test(stripped))return{raw:'='+text,reason:'Aggregate imports currently require one rectangular range, such as SUM(A1:A5).'};
    const refValidation=validation.replace(/(?<![a-z0-9_])(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/gi,'0');
    const references=[...refValidation.matchAll(/\b([A-Z]+\d+)\b/gi)];
    if(references.some(m=>!coordinate(m[1],options)))return{raw:'='+text,reason:'Formula refers to a cell outside the current grid.'};
    stripped=stripped.replace(/\b[A-Z]+\d+\b/gi,'0').replace(/\b(?:SQRT|EXP|LN|SIN|COS|TAN|EXCELROUND|EXCELGCD|EXCELLCM|FLOOR|LOGTEN)\b(?=\s*\()/gi,'').replace(/\bpi\b/g,'');
    stripped=stripped.replace(/(?<![a-z0-9_])(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/gi,'0');
    if(/[a-z:]/i.test(stripped))return{raw:'='+text,reason:'Named ranges and unsupported formula arguments cannot be imported as calculations.'};
    return{raw:'='+text,notes};
  }
  function extractXlsx(workbook,options){
    if(!workbook.SheetNames?.length)fail('The XLSX file has no worksheets.');
    if(workbook.SheetNames.length>20)fail('XLSX import supports up to 20 source worksheets.');
    return workbook.SheetNames.map(name=>{
      const sheet=workbook.Sheets[name],cells=Object.create(null),issues=Object.create(null),warnings=[];let outside=0,normalized=0,numbers=0,dates=0;
      for(const[c,cell]of Object.entries(sheet)){
        if(c.startsWith('!')||!cell||cell.t==='z')continue;
        if(cell.v===undefined&&!cell.f&&!cell.F)continue;
        const key=coordinate(c,options);if(!key){outside++;continue;}
        let raw,reason;
        if(cell.F){raw='='+(cell.f||'ARRAY('+cell.F+')');reason='Array formulas are unsupported. Cached values are ignored.';}
        else if(cell.f){const translated=translateFormula(cell.f,options);raw=translated.raw;reason=translated.reason;if(translated.notes?.length)normalized++;}
        else if(cell.t==='e'){raw=cell.w||'Spreadsheet error';reason='Source worksheet contains an error value; no numeric result was imported.';}
        else if(cell.t==='n'){try{raw=numberText(cell.v);numbers++;if(raw.replace(/^[-+]/,'').length>100)reason='This number exceeds the engine’s 100-character numeric-token limit. The value is preserved for inspection.';}catch(e){raw=String(cell.v);reason=e.message;}}
        else if(cell.t==='d'){const d=new Date(cell.v);raw=Number.isNaN(d.getTime())?String(cell.v):d.toISOString();dates++;}
        else if(cell.t==='b')raw=cell.v?'TRUE':'FALSE';
        else raw=literal(String(cell.v??''),true);
        if(raw.length>MAX_TEXT)fail('XLSX cell '+c+' exceeds '+MAX_TEXT+' characters.');
        if(raw){cells[key]=raw;if(reason)issues[key]={raw,reason};}
      }
      if(numbers)warnings.push('XLSX numeric cells reflect source floating-point precision. Long integers and fractions stored as text stay text.');
      if(normalized)warnings.push(normalized+' formula(s) normalized: AVERAGE/PRODUCT aliases or absolute references.');
      if(dates)warnings.push(dates+' date cell(s) imported as ISO text; dates are not numeric serials.');
      if(sheet['!merges']?.length)warnings.push('Merged-cell layout is not imported.');
      warnings.push('One source worksheet per import. Formatting, charts and macros are not imported. Unsupported formulas retain comments; cached outputs are ignored.');
      return{format:'xlsx',name,cells,issues,units:{},calculation:defaults(),warnings,blockedReason:outside?outside+' populated cell(s) are outside the current grid. Choose another sheet or reduce the source range.':'',...dimensions(cells,options)};
    });
  }
  function inspectZip(buffer){Zip.inspect(buffer);return true;}
  function exportCSV(cells, evaluated, options, formulas=false){
    const rows=[];
    for(let r=1;r<=options.rows;r++)rows.push(options.cols.map(col=>{
      const raw=cells.get(col+r)||'',ev=evaluated.get(col+r);
      let text=formulas?raw:ev?.display||'';
      const genuineNumber=!formulas&&ev?.status==='result'&&!!ev.rational&&!ev.unitLabel&&numeric(text);
      if(!formulas&&!genuineNumber&&/^[\s\uFEFF]*[=+@\-＝＋－＠]|^[\t\r\n]/u.test(text))text='\t'+text;
      return '"'+text.replace(/"/g,'""')+'"';
    }).join(','));
    return rows.join('\n');
  }
  const api={MAX_FILE_BYTES,MAX_TEXT,settings,coordinate,validateUnits,validateIssues,normalizedCells,dimensions,parseJSON,parseCSV,translateFormula,extractXlsx,inspectZip,numberText,exportCSV};
  g.AliceWorkbookIO=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
