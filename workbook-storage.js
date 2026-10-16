/*! Per-workbook storage with cross-tab revision locks | Alice by San | CC BY-NC 4.0 */
(function(g){
 'use strict';
 const PREFIX='alice.workbook/v2/',ACTIVE='alice.active-workbook/v2';
 const error=(code,message)=>Object.assign(new Error(message),{code});
 class Store {
  constructor(storage,locks){this.storage=storage;this.locks=locks;}
  read(id){
   const raw=this.storage.getItem(PREFIX+id);if(raw===null)return null;
   const r=JSON.parse(raw);
   if(!r||r.schema!=='alice.workbook/v2'||r.id!==id||!Number.isSafeInteger(r.revision)||r.revision<1||(!r.deleted&&r.book?.id!==id))throw error('INVALID_STORE','Invalid saved workbook; automatic writes stopped to preserve stored data.');
   return r;
  }
  list(){const ids=[];for(let i=0;i<this.storage.length;i++){const k=this.storage.key(i);if(k?.startsWith(PREFIX))ids.push(k.slice(PREFIX.length));}return ids.map(id=>this.read(id)).filter(Boolean);}
  async write(id,book,expected,deleted=false){
   if(!/^user-[a-z0-9-]+$/i.test(id))throw error('INVALID_STORE','Invalid workbook id.');
   if(!this.locks?.request)throw error('LOCKS_UNAVAILABLE','Safe browser saving needs Web Locks over HTTPS or localhost. Use Export JSON in this browser.');
   return this.locks.request(PREFIX+id,()=>{
    const current=this.read(id),revision=current?.revision||0;
    if(revision!==expected&&!deleted&&!current?.deleted&&JSON.stringify(current.book)===JSON.stringify(book))return current;
    if(revision!==expected)throw error('STORAGE_CONFLICT','Another tab changed this workbook. Load saved version or save a conflict copy.');
    if(revision===Number.MAX_SAFE_INTEGER)throw error('INVALID_STORE','Workbook revision limit reached. Save a copy.');
    const record={schema:'alice.workbook/v2',id,revision:revision+1,...(deleted?{deleted:true}:{book})};
    this.storage.setItem(PREFIX+id,JSON.stringify(record));return record;
   });
  }
  save(book,expected){return this.write(book.id,book,expected);}
  remove(id,expected){return this.write(id,null,expected,true);}
 }
 const api={Store,PREFIX,ACTIVE};if(typeof module!=='undefined'&&module.exports)module.exports=api;else g.AliceWorkbookStorage=api;
})(globalThis);
