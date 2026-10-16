/*! AliceGrid import preview | Alice by San | CC BY-NC 4.0 */
(function(){
  'use strict';
  const $=selector=>document.querySelector(selector);
  let loadedFile=null,loadedText='',fileKind='',busy=false;
  const options=()=>({cols:COLS,rows:ROWS});
  function error(message){$('#import-error').textContent=message;$('#import-error').hidden=!message;}
  function cancelWorker(){if(importWorkerJob){importWorkerJob.worker.terminate();clearTimeout(importWorkerJob.timer);importWorkerJob.reject(new Error('Import cancelled.'));importWorkerJob=null;}}
  async function readXlsx(buffer){
    AliceWorkbookIO.inspectZip(buffer);
    if(typeof Worker==='undefined'||location.protocol==='file:')throw new Error('Safe XLSX import requires a worker over HTTPS or localhost. JSON and CSV still work here.');
    return new Promise((resolve,reject)=>{
      const worker=new Worker('xlsx-worker.js?v=1.0.3');
      const timer=setTimeout(()=>{worker.terminate();importWorkerJob=null;reject(new Error('XLSX parsing took too long. Reduce the source workbook.'));},10000);
      importWorkerJob={worker,timer,reject};
      const finish=()=>{clearTimeout(timer);worker.terminate();if(importWorkerJob?.worker===worker)importWorkerJob=null;};
      worker.onmessage=e=>{finish();e.data.error?reject(new Error(e.data.error)):resolve(e.data.sheets);};
      worker.onerror=()=>{finish();reject(new Error('Could not read the XLSX workbook. Check the file and bundled parser.'));};
      worker.postMessage({buffer,options:options()},[buffer]);
    });
  }
  function nameFromFile(){return (loadedFile?.name||'Imported Workbook').replace(/\.[^.]+$/,'');}
  function showPreview(model){
    pendingImport=model;error(model.blockedReason||'');
    $('#import-confirm').disabled=!!model.blockedReason||busy;
    $('#import-name').disabled=$('#import-target').value!=='new';
    const count=Object.keys(model.cells).length,issues=Object.keys(model.issues||{}).length;
    const settings=model.format==='json'?`; ${model.calculation.mode} mode, ${model.calculation.precision} digits`:$('#import-target').value==='current'?'; retains current units and calculation settings':'; new workbook starts in Exact only mode';
    $('#import-summary').textContent=`${count} populated cells · ${model.rows} rows × ${model.cols} columns · ${issues} formula comments${settings}`;
    const warnings=$('#import-warnings');warnings.replaceChildren();
    for(const note of model.warnings||[]){const li=document.createElement('li');li.textContent=note;warnings.append(li);}
    for(const[coord,issue]of Object.entries(model.issues||{}).slice(0,12)){const li=document.createElement('li');li.textContent=coord+': '+issue.reason;warnings.append(li);}
    if(issues>12){const li=document.createElement('li');li.textContent=(issues-12)+' more formula comments will be attached to their cells.';warnings.append(li);}
    const table=$('#import-preview');table.replaceChildren();
    const head=document.createElement('tr');
    for(const label of ['Row',...COLS.slice(0,6)]){const th=document.createElement('th');th.textContent=label;head.append(th);}table.append(head);
    for(let r=1;r<=Math.min(8,Math.max(1,model.rows));r++){
      const row=document.createElement('tr'),th=document.createElement('th');th.textContent=r;row.append(th);
      for(const col of COLS.slice(0,6)){const c=col+r,td=document.createElement('td');td.textContent=model.cells[c]||'';if(model.issues?.[c]){td.className='import-issue';td.title=model.issues[c].reason;}row.append(td);}table.append(row);
    }
  }
  function rebuild(){
    if(!loadedFile||busy)return;
    try{
      let model;
      if(fileKind==='xlsx')model=pendingXlsxSheets[Number($('#import-sheet').value)||0];
      else if(fileKind==='json')model=AliceWorkbookIO.parseJSON(loadedText,options());
      else model=AliceWorkbookIO.parseCSV(loadedText,options(),{delimiter:$('#import-delimiter').value,formulas:$('#import-formulas').checked,numbersAsText:$('#import-numbers-text').checked});
      showPreview(model);
    }catch(e){pendingImport=null;$('#import-confirm').disabled=true;error(e.message);}
  }
  $('#import-workbook').onclick=()=>{
    importRevision++;cancelWorker();pendingImport=null;pendingXlsxSheets=null;loadedFile=null;loadedText='';fileKind='';busy=false;
    $('#import-file').value='';$('#import-target').value='new';$('#import-name').value=uniqueImportedName('Imported Workbook');
    $('#import-sheet-wrap').hidden=true;$('#import-csv-options').hidden=true;$('#import-confirm').disabled=true;
    $('#import-summary').textContent='Choose a JSON, CSV or XLSX file (up to 2 MiB). Preview the data before importing.';
    $('#import-preview').replaceChildren();$('#import-warnings').replaceChildren();error('');
    $('#import-dialog').showModal();$('#import-file').focus();
  };
  $('#import-file').onchange=async()=>{
    const revision=++importRevision;cancelWorker();pendingImport=null;pendingXlsxSheets=null;$('#import-confirm').disabled=true;
    const file=$('#import-file').files[0];if(!file)return;
    loadedFile=file;fileKind=file.name.toLowerCase().split('.').at(-1);busy=true;error('');
    $('#import-summary').textContent='Reading import preview…';$('#import-preview').replaceChildren();$('#import-warnings').replaceChildren();
    $('#import-sheet-wrap').hidden=true;$('#import-csv-options').hidden=fileKind!=='csv';
    try{
      if(file.size>AliceWorkbookIO.MAX_FILE_BYTES)throw new Error('Import file exceeds 2 MiB.');
      if(!['json','csv','xlsx'].includes(fileKind))throw new Error('Choose a .json, .csv or .xlsx file.');
      if(fileKind==='xlsx'){
        const sheets=await readXlsx(await file.arrayBuffer());if(revision!==importRevision)return;
        pendingXlsxSheets=sheets;const select=$('#import-sheet');select.replaceChildren();
        sheets.forEach((sheet,index)=>{const option=document.createElement('option');option.value=index;option.textContent=sheet.name;select.append(option);});
        $('#import-sheet-wrap').hidden=false;
      }else{loadedText=await file.text();if(revision!==importRevision)return;}
      $('#import-name').value=uniqueImportedName(fileKind==='json'?AliceWorkbookIO.parseJSON(loadedText,options()).name:nameFromFile());
      busy=false;rebuild();
    }catch(e){if(revision===importRevision){busy=false;pendingImport=null;error(e.message);$('#import-summary').textContent='Preview unavailable. Current workbook has not changed.';}}
  };
  for(const id of ['#import-sheet','#import-delimiter','#import-formulas','#import-numbers-text'])$(id).onchange=rebuild;
  $('#import-target').onchange=()=>{if(pendingImport)showPreview(pendingImport);else $('#import-name').disabled=$('#import-target').value!=='new';};
  $('#cancel-import').onclick=()=>$('#import-dialog').close();
  $('#import-dialog').addEventListener('close',()=>{importRevision++;cancelWorker();busy=false;pendingImport=null;$('#import-workbook').focus();});
  $('#import-form').onsubmit=e=>{
    e.preventDefault();if(!pendingImport||busy)return;
    try{applyImportedWorkbook(pendingImport,$('#import-target').value,$('#import-name').value);$('#import-dialog').close();}
    catch(e){error(e.message);}
  };
})();
