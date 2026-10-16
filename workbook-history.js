/*! AliceGrid history | Alice by San | CC BY-NC 4.0 */
(function(g){
 'use strict';
 class History {
  constructor(maxEntries=50,maxBytes=16*1024*1024){this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.undoStack=[];this.redoStack=[];this.states=new Map();this.bytes=0;}
  pack(value){
   const selection=value&&typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(value,'selected');
   let content=value;if(selection){const{selected,...rest}=value;content=rest;}
   return{json:JSON.stringify(content),selection,selected:selection?value.selected:undefined};
  }
  retain(p){let state=this.states.get(p.json);if(!state){state={json:p.json,refs:0};this.states.set(p.json,state);this.bytes+=2*p.json.length;}state.refs++;return{state,selection:p.selection,selected:p.selected};}
  release(p){if(--p.state.refs===0){this.states.delete(p.state.json);this.bytes-=2*p.state.json.length;}}
  drop(e){this.release(e.before);this.release(e.after);}
  read(p){const result=JSON.parse(p.state.json);if(p.selection)result.selected=p.selected;return result;}
  record(label,before,after){
   const a=this.pack(before),b=this.pack(after);if(a.json===b.json&&a.selected===b.selected)return false;
   if(2*(a.json.length+(a.json===b.json?0:b.json.length))>this.maxBytes)throw new Error('This change exceeds the undo capacity. Import a smaller workbook.');
   for(const e of this.redoStack)this.drop(e);this.redoStack=[];
   this.undoStack.push({label,before:this.retain(a),after:this.retain(b)});
   while(this.undoStack.length>this.maxEntries||this.bytes>this.maxBytes)this.drop(this.undoStack.shift());
   return true;
  }
  undo(){const e=this.undoStack.pop();if(!e)return null;this.redoStack.push(e);return{label:e.label,state:this.read(e.before)};}
  redo(){const e=this.redoStack.pop();if(!e)return null;this.undoStack.push(e);return{label:e.label,state:this.read(e.after)};}
  get undoLabel(){return this.undoStack.at(-1)?.label||'';}get redoLabel(){return this.redoStack.at(-1)?.label||'';}
 }
 const api={History};g.AliceHistory=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
