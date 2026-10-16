
'use strict';
importScripts('alice-math.min.js?v=1.0.3','xlsx-safe-zip.js?v=1.0.3','workbook-io.js?v=1.0.3');
onmessage=async function(event){
 try{
  const safe=await AliceSafeZip.unpack(event.data.buffer);
  importScripts('vendor/xlsx.full.min.js?v=1.0.3');
  const workbook=XLSX.read(safe,{type:'array',cellDates:true,cellFormula:true,cellHTML:false,bookVBA:false});
  postMessage({sheets:AliceWorkbookIO.extractXlsx(workbook,event.data.options)});
 }catch(error){postMessage({error:error.message});}
};
