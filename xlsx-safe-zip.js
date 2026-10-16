/*! Bounded XLSX ZIP validation | Alice by San | CC BY-NC 4.0 */
(function(g){
 'use strict';
 const LIMITS=Object.freeze({file:2*1024*1024,entry:16*1024*1024,total:32*1024*1024,entries:4096});
 const fail=m=>{throw new Error(m);};
 function inspect(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length>LIMITS.file)fail('Import file exceeds 2 MiB.');
  let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===bytes.length){end=i;break;}
  if(end<0)fail('Choose a valid unencrypted .xlsx ZIP workbook.');
  const count=v.getUint16(end+10,true),offset=v.getUint32(end+16,true),size=v.getUint32(end+12,true);
  if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||v.getUint16(end+8,true)!==count||!count||count>LIMITS.entries||offset===0xffffffff||offset+size!==end)fail('XLSX archive structure exceeds the import limits (ZIP64/multi-disk unsupported).');
  let at=offset,total=0;const entries=[],names=new Set(),spans=[];
  for(let i=0;i<count;i++){
   if(at+46>end||v.getUint32(at,true)!==0x02014b50)fail('Invalid XLSX archive directory.');
   const flags=v.getUint16(at+8,true),method=v.getUint16(at+10,true),crc=v.getUint32(at+16,true),compressed=v.getUint32(at+20,true),expanded=v.getUint32(at+24,true),nl=v.getUint16(at+28,true),xl=v.getUint16(at+30,true),cl=v.getUint16(at+32,true),local=v.getUint32(at+42,true);
   total+=expanded;
   if(flags&1||![0,8].includes(method)||expanded>LIMITS.entry||total>LIMITS.total||v.getUint16(at+34,true)||local===0xffffffff||at+46+nl+xl+cl>end)fail('XLSX archive is encrypted or exceeds the expanded-size/structure limit.');
   const nameBytes=bytes.slice(at+46,at+46+nl);let name;try{name=new TextDecoder('utf-8',{fatal:true}).decode(nameBytes);}catch(_){fail('XLSX ZIP entry names must use UTF-8.');}
   if(!name||name.includes('\\')||name.startsWith('/')||name.split('/').some(p=>p==='..')||names.has(name))fail('Invalid or duplicate XLSX ZIP path.');names.add(name);
   if(local+30>offset||v.getUint32(local,true)!==0x04034b50||v.getUint16(local+6,true)!==flags||v.getUint16(local+8,true)!==method)fail('Invalid XLSX local ZIP header.');
   const localName=v.getUint16(local+26,true),localExtra=v.getUint16(local+28,true),start=local+30+localName+localExtra;
   if(start+compressed>offset||localName!==nl||!nameBytes.every((b,j)=>bytes[local+30+j]===b))fail('XLSX ZIP entry exceeds its bounds.');
   if(!(flags&8)&&(v.getUint32(local+14,true)!==crc||v.getUint32(local+18,true)!==compressed||v.getUint32(local+22,true)!==expanded))fail('XLSX ZIP headers disagree.');
   if(method===0&&compressed!==expanded)fail('Stored ZIP entry size mismatch.');
   spans.push([local,start+compressed]);entries.push({name,nameBytes,method,crc,compressed,expanded,start});at+=46+nl+xl+cl;
  }
  if(at!==end)fail('Invalid XLSX directory length.');
  spans.sort((a,b)=>a[0]-b[0]);for(let i=1;i<spans.length;i++)if(spans[i][0]<spans[i-1][1])fail('Overlapping XLSX ZIP entries.');
  return{bytes,entries};
 }
 const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
 async function unpack(input,inflate){
  const archive=inspect(input),entries=[];let total=0;
  for(const e of archive.entries){
   const packed=archive.bytes.subarray(e.start,e.start+e.compressed);let chunks=[],length=0;
   const accept=chunk=>{length+=chunk.length;total+=chunk.length;if(length>e.expanded||length>LIMITS.entry||total>LIMITS.total)fail('XLSX actual decompressed data exceeds its declared or allowed size.');chunks.push(chunk);};
   if(e.method===0)accept(packed);
   else if(inflate)await inflate(packed,accept);
   else {
    let stream;try{stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch(_){fail('This browser cannot safely decompress XLSX files. Use a current browser over HTTPS or localhost.');}
    const reader=stream.getReader();try{while(true){const r=await reader.read();if(r.done)break;accept(r.value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
   }
   if(length!==e.expanded)fail('XLSX actual decompressed size does not match its header.');
   const data=new Uint8Array(length);let n=0;for(const c of chunks){data.set(c,n);n+=c.length;}
   if(crc32(data)!==e.crc)fail('XLSX ZIP integrity check failed.');entries.push({...e,data});
  }
  // Rebuild a stored ZIP so SheetJS never inflates unvalidated compressed bytes.
  const localSize=entries.reduce((n,e)=>n+30+e.nameBytes.length+e.data.length,0),centralSize=entries.reduce((n,e)=>n+46+e.nameBytes.length,0);
  const out=new Uint8Array(localSize+centralSize+22),v=new DataView(out.buffer);let at=0,central=localSize;
  for(const e of entries){
   v.setUint32(at,0x04034b50,true);v.setUint16(at+4,20,true);v.setUint16(at+6,0x800,true);v.setUint32(at+14,e.crc,true);v.setUint32(at+18,e.data.length,true);v.setUint32(at+22,e.data.length,true);v.setUint16(at+26,e.nameBytes.length,true);out.set(e.nameBytes,at+30);out.set(e.data,at+30+e.nameBytes.length);
   v.setUint32(central,0x02014b50,true);v.setUint16(central+4,20,true);v.setUint16(central+6,20,true);v.setUint16(central+8,0x800,true);v.setUint32(central+16,e.crc,true);v.setUint32(central+20,e.data.length,true);v.setUint32(central+24,e.data.length,true);v.setUint16(central+28,e.nameBytes.length,true);v.setUint32(central+42,at,true);out.set(e.nameBytes,central+46);at+=30+e.nameBytes.length+e.data.length;central+=46+e.nameBytes.length;
  }
  v.setUint32(central,0x06054b50,true);v.setUint16(central+8,entries.length,true);v.setUint16(central+10,entries.length,true);v.setUint32(central+12,centralSize,true);v.setUint32(central+16,localSize,true);return out;
 }
 const api={LIMITS,inspect,unpack,crc32};if(typeof module!=='undefined'&&module.exports)module.exports=api;else g.AliceSafeZip=api;
})(globalThis);
