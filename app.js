'use strict';
// AliceGrid & Omnibox Controller — Powered by AliceMath (BigInt Q, Dimensional V, Linear Parser)

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const ROWS = 26;

const unitsRegistry = JSON.parse(JSON.stringify(AliceMath.DEFAULT_UNITS));
let rawCells = new Map();       // coord -> raw string
let evaluatedCells = new Map(); // coord -> evaluation metadata
let selectedCoord = 'B2';
let selectionRange = null;
let calculationMode = 'exact';
let decimalPrecision = 34;
const workbookCalculationSettings = new Map();
let displayFormat = 'auto';     // 'auto' | 'fraction' | 'float'
let selectedTemplate = 'audit';
let wrapCellText = false;
let fitCellColumns = false;
let commentAnchor = null;
let commentPinned = false;
let commentHideTimer;
const CUSTOM_WORKBOOK_STORAGE_KEY = 'alice.custom-workbooks/v1';
const customWorkbooks = new Map();
const workbookSessions = new Map();
let hasLoadedWorkbook = false;
let customWorkbookCounter = 0;
let workbookStorageError = '';
let workbookStore = null;
let workbookStoreReadFailed = false;
let workbookSaveTimer = null;
let workbookSaveTask = Promise.resolve();
const dirtyWorkbooks = new Set();
const workbookRevisions = new Map();
const savedWorkbookJSON = new Map();
const workbookConflicts = new Set();
let workbookSaving = false;
let pendingDeleteWorkbookId = null;
let importIssues = new Map();
const workbookUnits = new Map();
const workbookIssues = new Map();
const workbookHistories = new Map();
let legacyUnits = {};
let pendingImport = null;
let pendingXlsxSheets = null;
let importRevision = 0;
let importWorkerJob = null;


const WORKBOOK_TEMPLATES = {
  audit: {
    A1: 'Item / Benchmark', B1: 'Input A', C1: 'Input B', D1: 'Exact AliceMath Formula', E1: 'Linear / % / Unit Audit',
    A2: 'Classic 0.1 + 0.2', B2: '=0.1', C2: '=0.2', D2: '=B2 + C2', E2: '=15% of D2',
    A3: 'Thirds + Sixths', B3: '=1/3', C3: '=1/6', D3: '=B3 + C3', E3: '=solve 4*x - D3 = 0',
    A4: 'Repeating Prime 1/97', B4: '=1/97', C4: '=96/97', D4: '=B4 + C4', E4: '=B4 * 97',
    A5: 'Seventh Harmonics', B5: '=1/7', C5: '=2/7', D5: '=4/7', E5: '=SUM(B5:D5)',
    A6: 'High-Power Compound', B6: '=(1 + 1/10)^8', C6: '=1/8', D6: '=B6 * C6', E6: '=AVG(B2:B5)',
    A8: 'Boundary Guard Tests', B8: 'Expression', C8: 'Live Guard Output',
    A9: 'Division by Zero', B9: '1 / (D4 - 1)', C9: '=1 / (D4 - 1)',
    A10: 'Nonlinear Guard', B10: 'x * x = 4', C10: '=x * x = 4',
    A11: 'Unit Mismatch Guard', B11: '5 m + 3 kg', C11: '=5 m + 3 kg'
  },
  physics: {
    A1: 'Robotics / SI Subsystem', B1: 'Measurement 1', C1: 'Measurement 2', D1: 'Combined / Derived SI', E1: 'Converted Target Unit',
    A2: 'Chassis Track Segment', B2: '=3 m', C2: '=45 cm', D2: '=B2 + C2', E2: '=convert D2 to mm',
    A3: 'Lidar Range Sweep', B3: '=1.25 km', C3: '=250 m', D3: '=B3 + C3', E3: '=convert D3 to mi',
    A4: 'Cycle Duration', B4: '=2 min', C4: '=30 s', D4: '=B4 + C4', E4: '=convert D4 to ms',
    A5: 'Kinematics Velocity', B5: '=D3', C5: '=D4', D5: '=B5 / C5', E5: '=D5 * 10 s',
    A6: 'Payload Mass Budget', B6: '=12 kg', C6: '=750 g', D6: '=B6 + C6', E6: '=convert D6 to lb',
    A7: 'Actuator Force & Work', B7: '=25 n', C7: '=4 m', D7: '=B7 * C7', E7: '=convert D7 to kj',
    A8: 'Motor Power Output', B8: '=D7', C8: '=20 s', D8: '=B8 / C8', E8: '=convert D8 to kw'
  },
  algebra: {
    A1: 'Financial / Engineering Scenario', B1: 'Fixed Base', C1: 'Target Outcome', D1: 'Linear Equation (solve for x)', E1: 'Verification Check',
    A2: 'Unit Breakeven Quantity (x)', B2: '=450', C2: '=1950', D2: '=solve 15*x + B2 = C2', E2: '=15 * D2 + B2',
    A3: 'Resistor Divider Balance (x)', B3: '=12', C3: '=4', D3: '=solve (B3 - C3) - 2*x = 0', E3: '=B3 - 2*D3',
    A4: 'Fractional Slope Intercept (x)', B4: '=1/3', C4: '=7/6', D4: '=solve (2/3)*x + B4 = C4', E4: '=(2/3)*D4 + B4',
    A5: 'Tax-Inclusive Reverse Solve (x)', B5: '=10', C5: '=230', D5: '=solve x + 15% of x = C5', E5: '=D5 * 1.15',
    A6: 'Total Solved Unknowns Sum', B6: '=SUM(B2:B5)', C6: '=SUM(C2:C5)', D6: '=SUM(D2:D5)', E6: '=AVG(D2:D5)'
  }
};

for (const [name, workbook] of Object.entries(SCENARIO_WORKBOOKS)) {
  const cells = { A1: 'Scenario', B1: 'Input A', C1: 'Input B', D1: 'Exact result / guard', E1: 'Cross-check', F1: 'What this demonstrates' };
  workbook.rows.forEach((row, index) => {
    row.slice(0, 6).forEach((value, col) => { if (value) cells[COLS[col] + (index + 2)] = value; });
  });
  WORKBOOK_TEMPLATES[name] = cells;
}

// DOM References
const gridEl = document.querySelector('#sheet-grid');
const formulaInput = document.querySelector('#formula-input');
const activeCellBadge = document.querySelector('#active-cell-badge');
const omniboxInput = document.querySelector('#omnibox-input');
const omniboxPreview = document.querySelector('#omnibox-preview');
const omniboxTape = document.querySelector('#omnibox-tape');
const quickChips = document.querySelector('#omni-quick-chips');
const unitListEl = document.querySelector('#unit-list');
const unitCountBadge = document.querySelector('#unit-count-badge');

// Coordinate Helpers
function parseCoord(coord) {
  const m = /^\$?([A-Z])\$?(\d+)$/i.exec(coord.trim());
  if (!m) return null;
  const colIdx = COLS.indexOf(m[1].toUpperCase());
  const rowIdx = Number(m[2]) - 1;
  if (colIdx < 0 || rowIdx < 0 || rowIdx >= ROWS) return null;
  return { colIdx, rowIdx, coord: COLS[colIdx] + (rowIdx + 1) };
}

function expandRange(startCoord, endCoord) {
  const a = parseCoord(startCoord);
  const b = parseCoord(endCoord);
  if (!a || !b) return [];
  const c1 = Math.min(a.colIdx, b.colIdx), c2 = Math.max(a.colIdx, b.colIdx);
  const r1 = Math.min(a.rowIdx, b.rowIdx), r2 = Math.max(a.rowIdx, b.rowIdx);
  const out = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      out.push(COLS[c] + (r + 1));
    }
  }
  return out;
}

function normalizeCalculationSettings(settings) {
  if (settings === undefined) return { mode: 'exact', precision: 34 };
  if (!settings || !['exact', 'approximate'].includes(settings.mode) || !AliceApprox.PRECISIONS.includes(settings.precision)) throw new Error('Invalid saved calculation settings.');
  return { mode: settings.mode, precision: settings.precision };
}

function calculationSettings() {
  return { mode: calculationMode, precision: decimalPrecision };
}

function updateCalculationControls() {
  const approximate = calculationMode === 'approximate';
  document.querySelector('#calculation-mode').value = calculationMode;
  document.querySelector('#decimal-precision').value = String(decimalPrecision);
  document.querySelector('#decimal-precision').disabled = !approximate;
  document.querySelector('#calculation-mode-note').textContent = approximate ? '≈ marks decimal approximations; exact results stay exact.' : 'Exact fractions; irrational results show a limit comment.';
}

function calculateExpression(expression, context) {
  return AliceApprox.calculate(expression, unitsRegistry, context.values, { enabled: calculationMode === 'approximate', precision: decimalPrecision });
}

function decodeCustomWorkbookStore(json) {
  const data = JSON.parse(json);
  if (data.schema !== 'alice.custom-workbooks/v1' || !Array.isArray(data.workbooks)) throw new Error('Unsupported workbook store.');
  const workbooks = new Map();
  for (const book of data.workbooks) {
    if (!book || typeof book.id !== 'string' || !/^user-[a-z0-9-]+$/i.test(book.id) || workbooks.has(book.id) || typeof book.name !== 'string' || !book.name.trim() || book.name.length > 80 || !Array.isArray(book.cells)) throw new Error('Invalid saved workbook.');
    const cells = new Map();
    for (const entry of book.cells) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !parseCoord(entry[0]) || typeof entry[1] !== 'string') throw new Error('Invalid saved cell.');
      cells.set(parseCoord(entry[0]).coord, entry[1]);
    }
    workbooks.set(book.id, { id: book.id, name: book.name, cells, calculation: normalizeCalculationSettings(book.calculation), units: book.units === undefined ? undefined : AliceWorkbookIO.validateUnits(book.units, Number.MAX_SAFE_INTEGER, true), importIssues: AliceWorkbookIO.validateIssues(book.importIssues || {}, Object.fromEntries(cells), {cols:COLS,rows:ROWS}) });
  }
  const units = {};
  for (const [name, definition] of Object.entries(data.units || {})) {
    if (!/^[a-z]+$/.test(name) || name === 'x' || name === 'sqrt' || !Array.isArray(definition) || definition.length !== 2 || typeof definition[0] !== 'string' || !Array.isArray(definition[1]) || definition[1].length !== 3 || definition[1].some(n => !Number.isInteger(n) || Math.abs(n) > 10)) throw new Error('Invalid saved unit.');
    AliceMath.Q.read(definition[0]);
    units[name] = definition;
  }
  return { workbooks, active: data.active, units, unitScope: data.unitScope };
}

function workbookRecord(book) {
  return {id:book.id,name:book.name,cells:[...book.cells],calculation:book.calculation||normalizeCalculationSettings(),units:book.units||{},importIssues:book.importIssues||{}};
}
function storageRepository() {
  if (!workbookStore) workbookStore = new AliceWorkbookStorage.Store(localStorage, typeof navigator === 'undefined' ? null : navigator.locks);
  return workbookStore;
}
function decodeStoredBook(record) {
  return decodeCustomWorkbookStore(JSON.stringify({schema:'alice.custom-workbooks/v1',workbooks:[record],unitScope:'workbook'})).workbooks.get(record.id);
}
function restoreCustomWorkbooks() {
  try {
    const repository = storageRepository(), records = repository.list();
    const savedJSON = localStorage.getItem(CUSTOM_WORKBOOK_STORAGE_KEY);
    const legacy = savedJSON ? decodeCustomWorkbookStore(savedJSON) : {workbooks:new Map(),units:{},active:'audit',unitScope:'workbook'};
    legacyUnits = {};
    const existing = new Set(records.map(r=>r.id));
    for (const [id,book] of legacy.workbooks) if (!existing.has(id)) {
      if (book.units === undefined) book.units = legacy.units;
      customWorkbooks.set(id,book);workbookRevisions.set(id,0);dirtyWorkbooks.add(id);appendCustomWorkbookOption(book);
    }
    for (const record of records) {
      workbookRevisions.set(record.id,record.revision);
      if (record.deleted) continue;
      const book=decodeStoredBook(record.book);customWorkbooks.set(book.id,book);savedWorkbookJSON.set(book.id,JSON.stringify(workbookRecord(book)));appendCustomWorkbookOption(book);
    }
    workbookStoreReadFailed=false;
    const active=localStorage.getItem(AliceWorkbookStorage.ACTIVE)||legacy.active;
    return customWorkbooks.has(active)||Object.hasOwn(WORKBOOK_TEMPLATES,active)?active:'audit';
  } catch (error) {
    workbookStoreReadFailed=true;
    workbookStorageError='Browser restore failed; stored data was left untouched. Reload to retry; Export JSON for current session data. '+error.message;
    return 'audit';
  }
}

function captureCurrentCustomWorkbook() {
  if (!hasLoadedWorkbook) return;
  const workbook = customWorkbooks.get(selectedTemplate);
  if (workbook) { dirtyWorkbooks.add(workbook.id); workbook.cells = new Map(rawCells); workbook.calculation = calculationSettings(); workbook.units = customUnitDefinitions(); workbook.importIssues = Object.fromEntries(importIssues); }
  else if (Object.hasOwn(WORKBOOK_TEMPLATES, selectedTemplate)) { workbookSessions.set(selectedTemplate, new Map(rawCells)); workbookCalculationSettings.set(selectedTemplate, calculationSettings()); workbookUnits.set(selectedTemplate, customUnitDefinitions()); workbookIssues.set(selectedTemplate, Object.fromEntries(importIssues)); }
}

function customUnitDefinitions() {
  return Object.fromEntries(Object.entries(unitsRegistry).filter(([name, definition]) => JSON.stringify(definition) !== JSON.stringify(AliceMath.DEFAULT_UNITS[name])));
}

function persistCustomWorkbooks() {
  captureCurrentCustomWorkbook();
  try { if (localStorage.getItem(AliceWorkbookStorage.ACTIVE)!==selectedTemplate) localStorage.setItem(AliceWorkbookStorage.ACTIVE,selectedTemplate); } catch (_) {}
  if (typeof setTimeout === 'function') {
    clearTimeout(workbookSaveTimer);
    workbookSaveTimer=setTimeout(()=>{workbookSaveTimer=null;flushWorkbookSaves();},150);
  }
  updateWorkbookStorageStatus();
}
async function flushWorkbookSaves() {
  if (typeof clearTimeout === 'function') clearTimeout(workbookSaveTimer);
  workbookSaveTimer=null;
  const task=workbookSaveTask.then(async()=>{
    if (workbookStoreReadFailed) { updateWorkbookStorageStatus();return false; }
    workbookSaving=true;updateWorkbookStorageStatus();let failed=false;
    for (const id of [...dirtyWorkbooks]) {
      const book=customWorkbooks.get(id);if(!book){dirtyWorkbooks.delete(id);continue;}
      if(workbookConflicts.has(id)){failed=true;continue;}
      const record=workbookRecord(book),json=JSON.stringify(record);
      if(json===savedWorkbookJSON.get(id)){dirtyWorkbooks.delete(id);continue;}
      try {
        const result=await storageRepository().save(record,workbookRevisions.get(id)||0);
        workbookRevisions.set(id,result.revision);savedWorkbookJSON.set(id,json);
        if(customWorkbooks.has(id)&&JSON.stringify(workbookRecord(customWorkbooks.get(id)))===json)dirtyWorkbooks.delete(id);
      } catch(error) {
        failed=true;
        if(error.code==='STORAGE_CONFLICT')workbookConflicts.add(id);
        workbookStorageError=error.code==='STORAGE_CONFLICT'?error.message:'Browser save unavailable. Use Retry Save or Export JSON. '+error.message;
      }
    }
    if(!failed&&!workbookConflicts.size)workbookStorageError='';
    workbookSaving=false;updateWorkbookStorageStatus();return !failed;
  });
  workbookSaveTask=task.catch(error=>{workbookSaving=false;workbookStorageError='Browser save unavailable. Use Retry Save or Export JSON. '+error.message;updateWorkbookStorageStatus();return false;});
  return workbookSaveTask;
}
function legacyUnitNames() { return Object.keys(customUnitDefinitions()).filter(name=>AliceMath.Syntax.RESERVED.includes(name)); }
function updateWorkbookStorageStatus() {
  const status=document.querySelector('#workbook-storage-status'),conflict=workbookConflicts.has(selectedTemplate),legacy=legacyUnitNames();
  const warning=conflict?'Another tab changed this workbook. Your local cells are retained. Load saved version or save a conflict copy.':workbookStorageError;
  status.textContent=warning||(workbookSaving?'Saving…':customWorkbooks.has(selectedTemplate)?dirtyWorkbooks.has(selectedTemplate)?'Changes waiting to save':'Saved in this browser':'');
  if(legacy.length)status.textContent+=' · Legacy reserved units: '+legacy.join(', ')+'. Rename them in the unit registry.';
  status.classList.toggle('is-warning',!!warning||!!legacy.length);
  document.querySelector('#delete-workbook').hidden=!customWorkbooks.has(selectedTemplate);
  document.querySelector('#retry-workbook-save').hidden=!workbookStorageError||conflict||workbookStoreReadFailed;
  document.querySelector('#save-conflict-copy').hidden=!conflict;
  document.querySelector('#load-shared-version').hidden=!conflict;
  document.querySelector('#rename-legacy-unit').hidden=!legacy.length;
  if(customWorkbooks.has(selectedTemplate))updateWorkbookGuide(selectedCoord);
}
function handleWorkbookStorageEvent(event) {
  if(!event.key?.startsWith(AliceWorkbookStorage.PREFIX)&&event.key!==null)return;
  try {
    for(const record of storageRepository().list()) {
      const id=record.id;if(record.revision===(workbookRevisions.get(id)||0))continue;
      if(customWorkbooks.has(id)) {workbookConflicts.add(id);continue;}
      workbookRevisions.set(id,record.revision);
      if(!record.deleted){const book=decodeStoredBook(record.book);customWorkbooks.set(id,book);savedWorkbookJSON.set(id,JSON.stringify(workbookRecord(book)));appendCustomWorkbookOption(book);}
    }
    // A site-data clear must not let an old tab recreate removed books silently.
    for(const [id,revision] of workbookRevisions)if(revision&&!storageRepository().read(id)&&customWorkbooks.has(id))workbookConflicts.add(id);
    updateWorkbookStorageStatus();
  } catch(error){workbookStorageError='Could not read shared workbook changes. Export JSON. '+error.message;updateWorkbookStorageStatus();}
}
function removeWorkbookOption(id) {
  const group=document.querySelector('#custom-workbook-options');if(!group)return;
  for(const option of [...group.children])if(option.value===id)option.remove();
  if(!group.children.length)group.remove();
}
function adoptSharedWorkbook(id, record) {
  workbookConflicts.delete(id);dirtyWorkbooks.delete(id);savedWorkbookJSON.delete(id);workbookHistories.delete(id);removeWorkbookOption(id);
  workbookRevisions.set(id,record?.revision||0);
  if(record&&!record.deleted){const book=decodeStoredBook(record.book);customWorkbooks.set(id,book);savedWorkbookJSON.set(id,JSON.stringify(workbookRecord(book)));appendCustomWorkbookOption(book);}
  else customWorkbooks.delete(id);
}
async function loadSharedWorkbook() {
  await flushWorkbookSaves();
  const id=selectedTemplate,record=storageRepository().read(id);
  adoptSharedWorkbook(id,record);hasLoadedWorkbook=false;workbookStorageError='';
  loadTemplate(record&&!record.deleted?id:'audit');
}
async function saveConflictCopy() {
  captureCurrentCustomWorkbook();
  const id=selectedTemplate,book=customWorkbooks.get(id),snapshot=workbookSnapshot(),record=storageRepository().read(id);
  if(!book)throw new Error('Select a custom workbook first.');
  if(typeof formulaInput.value==='string'&&formulaInput.value!==(rawCells.get(selectedCoord)||'')){
    const draft=formulaInput.value.startsWith("'")?formulaInput.value:formulaInput.value.trim();
    if(draft.length>AliceWorkbookIO.MAX_TEXT)throw new Error('Uncommitted cell text exceeds 2000 characters. Shorten it or export JSON first.');
    const cells=new Map(snapshot.cells);if(draft)cells.set(selectedCoord,draft);else cells.delete(selectedCoord);snapshot.cells=[...cells];snapshot.issues=snapshot.issues.filter(([c])=>c!==selectedCoord);
  }
  const name=uniqueImportedName(book.name+' (conflict copy)');
  adoptSharedWorkbook(id,record);hasLoadedWorkbook=false;
  const copy=createCustomWorkbook(name);
  changeWorkbook('Recover conflict copy',()=>{rawCells=new Map(snapshot.cells);importIssues=new Map(snapshot.issues);setWorkbookUnits(snapshot.units);calculationMode=snapshot.calculation.mode;decimalPrecision=snapshot.calculation.precision;selectedCoord=snapshot.selected;});
  await flushWorkbookSaves();return copy;
}
function renameLegacyUnit(oldName,newName) {
  if(!legacyUnitNames().includes(oldName))throw new Error('Choose a legacy reserved unit.');
  newName=String(newName).trim().toLowerCase();
  AliceWorkbookIO.validateUnits({[newName]:unitsRegistry[oldName]});
  if(Object.hasOwn(unitsRegistry,newName))throw new Error('This unit name already exists.');
  const rewrite=raw=>raw.replace(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|\$?[a-z]\$?\d+\b|[a-z]+|π/gi,token=>(token==='π'?'pi':token.toLowerCase())===oldName?newName:token);
  changeWorkbook('Rename unit '+oldName+' to '+newName,()=>{
    unitsRegistry[newName]=unitsRegistry[oldName];delete unitsRegistry[oldName];
    for(const [coord,raw] of rawCells)if(raw.startsWith('=')){
      const updated=rewrite(raw);rawCells.set(coord,updated);
      if(importIssues.get(coord)?.raw===raw)importIssues.set(coord,{...importIssues.get(coord),raw:updated});
    }
  });
}

function validateNewWorkbookName(value) {
  const name = String(value).trim();
  if (!name) throw new Error('Enter a workbook name.');
  if (name.length > 80) throw new Error('Use a name with 80 characters or fewer.');
  if ([...customWorkbooks.values()].some(book => book.name.toLowerCase() === name.toLowerCase())) throw new Error('A workbook with this name already exists. Choose another name.');
  return name;
}

function defaultNewWorkbookName() {
  let number = 1;
  while ([...customWorkbooks.values()].some(book => book.name.toLowerCase() === ('My Workbook ' + number).toLowerCase())) number++;
  return 'My Workbook ' + number;
}

function appendCustomWorkbookOption(workbook) {
  let group = document.querySelector('#custom-workbook-options');
  if (!group) {
    group = document.createElement('optgroup');
    group.id = 'custom-workbook-options';
    group.label = 'My workbooks';
    document.querySelector('#template-select').append(group);
  }
  const option = document.createElement('option');
  option.value = workbook.id;
  option.textContent = workbook.name;
  group.append(option);
}

function createCustomWorkbook(value) {
  const name = validateNewWorkbookName(value);
  let id;
  do { id = 'user-' + Date.now().toString(36) + '-' + (++customWorkbookCounter).toString(36) + '-' + Math.random().toString(36).slice(2,10); } while (customWorkbooks.has(id));
  const workbook = { id, name, cells: new Map(), calculation: normalizeCalculationSettings(), units: {}, importIssues: {} };
  customWorkbooks.set(id, workbook);dirtyWorkbooks.add(id);
  appendCustomWorkbookOption(workbook);
  loadTemplate(id);
  return workbook;
}

async function deleteCustomWorkbook(id) {
  if(!customWorkbooks.has(id))throw new Error('This workbook is no longer available.');
  if(workbookStoreReadFailed)throw new Error('Reload after the browser restore failure before deleting saved data.');
  captureCurrentCustomWorkbook();await flushWorkbookSaves();
  if(workbookConflicts.has(id))throw new Error('Another tab changed this workbook. Load its saved version before deleting.');
  try {const result=await storageRepository().remove(id,workbookRevisions.get(id)||0);workbookRevisions.set(id,result.revision);}
  catch(error){throw new Error('Could not delete the saved workbook; your workbook is still here. '+error.message);}
  dirtyWorkbooks.delete(id);savedWorkbookJSON.delete(id);customWorkbooks.delete(id);removeWorkbookOption(id);
  workbookSessions.delete(id);workbookHistories.delete(id);workbookUnits.delete(id);workbookIssues.delete(id);workbookCalculationSettings.delete(id);
  if(selectedTemplate===id){hasLoadedWorkbook=false;loadTemplate('audit');}else updateWorkbookStorageStatus();
}

function loadTemplate(name) {
  captureCurrentCustomWorkbook();
  selectedTemplate = customWorkbooks.has(name) || Object.hasOwn(WORKBOOK_TEMPLATES, name) ? name : 'audit';
  const custom = customWorkbooks.get(selectedTemplate);
  const settings = normalizeCalculationSettings(custom?.calculation || workbookCalculationSettings.get(selectedTemplate));
  calculationMode = settings.mode; decimalPrecision = settings.precision;
  updateCalculationControls();
  setWorkbookUnits(custom?.units || workbookUnits.get(selectedTemplate) || legacyUnits);
  importIssues = new Map(Object.entries(custom?.importIssues || workbookIssues.get(selectedTemplate) || {}));
  rawCells = custom ? new Map(custom.cells) : workbookSessions.has(selectedTemplate) ? new Map(workbookSessions.get(selectedTemplate)) : new Map(Object.entries(WORKBOOK_TEMPLATES[selectedTemplate]));
  hasLoadedWorkbook = true;
  document.querySelector('#template-select').value = selectedTemplate;
  recalculateAll();
  selectCell(custom ? 'A1' : 'D2');
  renderUnitsRegistry(); updateHistoryControls();
  persistCustomWorkbooks();
}

function setWorkbookUnits(definitions) {
  for (const name of Object.keys(unitsRegistry)) delete unitsRegistry[name];
  Object.assign(unitsRegistry, JSON.parse(JSON.stringify(AliceMath.DEFAULT_UNITS)), JSON.parse(JSON.stringify(definitions || {})));
}
function historyForWorkbook() {
  if (!workbookHistories.has(selectedTemplate)) workbookHistories.set(selectedTemplate, new AliceHistory.History());
  return workbookHistories.get(selectedTemplate);
}
function updateHistoryControls(message) {
  const history = historyForWorkbook();
  const undo = document.querySelector('#undo-workbook'), redo = document.querySelector('#redo-workbook');
  undo.disabled = !history.undoLabel; redo.disabled = !history.redoLabel;
  undo.title = history.undoLabel ? 'Undo ' + history.undoLabel : 'Nothing to undo';
  redo.title = history.redoLabel ? 'Redo ' + history.redoLabel : 'Nothing to redo';
  if (message !== undefined) document.querySelector('#edit-history-status').textContent = message;
}
function workbookSnapshot() {
  return { cells: [...rawCells], calculation: calculationSettings(), units: customUnitDefinitions(), issues: [...importIssues], selected: selectedCoord };
}
function restoreWorkbookSnapshot(state) {
  rawCells = new Map(state.cells); importIssues = new Map(state.issues);
  calculationMode = state.calculation.mode; decimalPrecision = state.calculation.precision;
  setWorkbookUnits(state.units); updateCalculationControls(); renderUnitsRegistry();
  recalculateAll(); selectCell(parseCoord(state.selected) ? state.selected : 'A1');
  captureCurrentCustomWorkbook(); persistCustomWorkbooks();
}
function changeWorkbook(label, mutate) {
  const before = workbookSnapshot();
  try {
    mutate();
    const after = workbookSnapshot();
    const changed = historyForWorkbook().record(label, before, after);
    if (changed) {
      if (typeof formulaInput.value==='string' && formulaInput.value===(new Map(before.cells).get(before.selected)||'')) formulaInput.value=rawCells.get(selectedCoord)||'';
      updateCalculationControls(); renderUnitsRegistry(); recalculateAll();
      captureCurrentCustomWorkbook(); persistCustomWorkbooks();
      updateHistoryControls(label + ' — Undo available');
    }
    return changed;
  } catch (error) {
    restoreWorkbookSnapshot(before);
    throw error;
  }
}
function undoWorkbook(redo = false) {
  const result = redo ? historyForWorkbook().redo() : historyForWorkbook().undo();
  if (!result) return;
  restoreWorkbookSnapshot(result.state);
  updateHistoryControls((redo ? 'Redid ' : 'Undid ') + result.label);
}
function applyImportedWorkbook(model, target, name) {
  if (model.blockedReason) throw new Error(model.blockedReason);
  const options = {cols:COLS,rows:ROWS};
  const cells = AliceWorkbookIO.normalizedCells(model.cells, options);
  const units = AliceWorkbookIO.validateUnits(model.units || {});
  const issues = AliceWorkbookIO.validateIssues(model.issues || {}, cells, options);
  const calculation = normalizeCalculationSettings(model.calculation);
  if (target === 'new') createCustomWorkbook(name);
  else if (target !== 'current') throw new Error('Choose an import destination.');
  changeWorkbook('Import ' + model.format.toUpperCase(), () => {
    rawCells = new Map(Object.entries(cells)); importIssues = new Map(Object.entries(issues));
    if (model.format === 'json' || target === 'new') {
      setWorkbookUnits(units); calculationMode = calculation.mode; decimalPrecision = calculation.precision;
    }
    selectedCoord = 'A1';
  });
  selectCell('A1');
  return selectedTemplate;
}
function uniqueImportedName(value) {
  const base = String(value || 'Imported Workbook').trim().slice(0,70) || 'Imported Workbook';
  let name = base, suffix = 2;
  while ([...customWorkbooks.values()].some(book => book.name.toLowerCase() === name.toLowerCase())) name = base + ' (' + suffix++ + ')';
  return name;
}

// Convert an evaluated AliceMath result back into an exact canonical token string for downstream cells
function createReferenceContext(expr) {
  return { values: Object.create(null), floatValues: Object.create(null), reserved: new Set(expr.toLowerCase().match(/[a-z]+/g) || []), next: 0 };
}

function referenceAlias(value, context) {
  if (!context) throw new Error('A typed reference requires a calculation context.');
  let name;
  do {
    let id = context.next++, suffix = '';
    do { suffix = String.fromCharCode(97 + id % 26) + suffix; id = Math.floor(id / 26); } while (id);
    name = 'cellref' + suffix;
  } while (context.reserved.has(name) || Object.hasOwn(unitsRegistry, name) || Object.hasOwn(context.values, name));
  context.values[name] = value;
  return name;
}

function readableResolvedExpression(expression, context) {
  return expression.replace(/\bcellref[a-z]+\b/gi, name => {
    const input = context.values[name];
    if (!input) return name;
    const units = input.dim.map((exponent, i) => exponent ? ['m', 's', 'kg'][i] + (exponent === 1 ? '' : '^' + exponent) : '').filter(Boolean).join(' * ');
    return input.approximate ? `(≈ ${input.approximateValue}${units ? ' ' + units : ''})` : `(${input.b.n}/${input.b.d}${units ? ' * '+units : ''})`;
  });
}

function canonicalToken(evalObj, context) {
  if (evalObj?.status === 'result' && evalObj.approximate === true) {
    return referenceAlias({ approximate: true, approximateValue: evalObj.baseApproximateValue, dim: evalObj.dim }, context);
  }

  if (!evalObj || evalObj.status !== 'result' || !evalObj.rational) {
    throw AliceMath.Syntax.error(evalObj?.code || 'UNRESOLVED_REFERENCE', evalObj?.code === 'DIVISION_BY_ZERO' ? 'Division by zero.' : evalObj?.text || 'Referenced cell is unresolved.');
  }
  // Conversion results expose a target-unit magnitude; downstream arithmetic needs SI magnitude.
  const q = evalObj.baseRational || evalObj.rational;
  const dim = evalObj.dim || [0, 0, 0];
  // Keep valid large rationals as typed values rather than reparsing oversized numeric tokens.
  if (context && (String(q.n).replace('-', '').length > 100 || String(q.d).length > 100)) {
    return referenceAlias(new AliceMath.V(q, new AliceMath.Q(0), dim), context);
  }
  const frac = `(${q.n}/${q.d})`;
  const unitFactors = dim
    .map((exp, i) => (exp ? `${['m', 's', 'kg'][i]}${exp === 1 ? '' : '^' + exp}` : ''))
    .filter(Boolean)
    .join(' * ');
  return unitFactors ? `(${frac} *${unitFactors})` : frac;
}

// Evaluate a single cell with recursive DAG resolution and cycle detection
function evaluateCell(coord, visiting = new Set()) {
  if (evaluatedCells.has(coord)) return evaluatedCells.get(coord);
  const originalRaw = rawCells.get(coord) || '';
  const raw = originalRaw.startsWith("'") ? originalRaw : originalRaw.trim();
  if (!raw) {
    const emptyRes = { kind: 'empty', raw: '', display: '', status: 'empty' };
    evaluatedCells.set(coord, emptyRes);
    return emptyRes;
  }

  const importedIssue = importIssues.get(coord);
  if (importedIssue && importedIssue.raw === originalRaw) {
    const result = { kind: 'error', raw, status: 'unsupported', text: importedIssue.reason, resolvedExpr: raw.replace(/^=/, ''), display: raw.replace(/^=/, '') };
    evaluatedCells.set(coord, result); return result;
  }
  if (raw.startsWith("'")) {
    const result = { kind: 'label', raw, display: raw.slice(1), status: 'label' };
    evaluatedCells.set(coord, result); return result;
  }

  // Plain text label if it doesn't start with '=' and isn't a pure number
  const isFormula = raw.startsWith('=');
  const isPureNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw);
  if (!isFormula && !isPureNumber) {
    const labelRes = { kind: 'label', raw, display: raw, status: 'label' };
    evaluatedCells.set(coord, labelRes);
    return labelRes;
  }

  if (visiting.has(coord)) {
    const cycleRes = {
      kind: 'error',
      raw,
      resolvedExpr: raw.replace(/^=/, ''),
      display: raw.replace(/^=/, ''),
      status: 'unsupported',
      text: 'Circular cell dependency detected.'
    };
    evaluatedCells.set(coord, cycleRes);
    return cycleRes;
  }

  visiting.add(coord);
  let expr = isFormula ? raw.slice(1).trim() : raw;
  try {
    const referenceContext = createReferenceContext(expr);
    expr = expandMacrosAndCellRefs(expr, visiting, referenceContext);
    const calc = calculateExpression(expr, referenceContext);
    const floatApprox = computeFloatComparison(expr, calc, referenceContext);
    const expectedLimit = isExpectedLimit(coord, raw, calc);
    const resultObj = {
      ...calc,
      raw,
      resolvedExpr: readableResolvedExpression(expr, referenceContext),
      floatApprox,
      expectedLimit,
      display: formatCellDisplay(calc, floatApprox)
    };
    const issue = getCalculationIssue(resultObj);
    if (issue) resultObj.display = issue.expression;
    evaluatedCells.set(coord, resultObj);
    visiting.delete(coord);
    return resultObj;
  } catch (err) {
    visiting.delete(coord);
    const errRes = {
      kind: 'error',
      raw,
      resolvedExpr: expr,
      status: err.code === 'DIVISION_BY_ZERO' ? 'error' : 'unsupported',
      code: err.code || 'CELL_ERROR',
      exact: false,
      text: err.code === 'DIVISION_BY_ZERO' ? 'undefined' : err.message,
      display: expr
    };
    errRes.expectedLimit = isExpectedLimit(coord, raw, errRes);
    evaluatedCells.set(coord, errRes);
    return errRes;
  }
}

// Expand ranges and single references; parseCoord validates against COLS and ROWS.
function expandMacrosAndCellRefs(expr, visiting, context) {
  const functions = AliceSheet.expandFunctions(expr,
    arg => calculateExpression(expandMacrosAndCellRefs(arg, visiting, context), context),
    value => canonicalToken(value, context), AliceMath.Q);
  let out = functions.replace(/\b(SUM|AVG|AVERAGE|PROD|PRODUCT)\s*\(\s*(\$?[A-Z]\$?\d+)\s*:\s*(\$?[A-Z]\$?\d+)\s*\)/gi, (_, fn, c1, c2) => {
    const coords = expandRange(c1, c2);
    if (!coords.length) throw new Error('Invalid cell range.');
    const values = coords.map(c => evaluateCell(c, new Set(visiting))).filter(v => v.kind !== 'empty' && v.kind !== 'label');
    const result = AliceApprox.aggregate(values, fn, { enabled: calculationMode === 'approximate', precision: decimalPrecision });
    if (result.status !== 'result') throw AliceMath.Syntax.error(result.code || 'AGGREGATE_ERROR', result.text);
    if(result.approximate)return canonicalToken(result,context);
    const name=referenceAlias(new AliceMath.V(result.rational,new AliceMath.Q(0),result.dim),context);
    if(values.every(v=>!v.dim?.some(d=>d!==0))){
      const floats=values.map(v=>rationalToFloat(v.baseRational||v.rational));
      const product=/^(PROD|PRODUCT)$/i.test(fn),mean=/^(AVG|AVERAGE)$/i.test(fn);
      let value=floats.length?floats.slice(1).reduce((a,b)=>product?a*b:a+b,floats[0]):0;
      if(mean)value/=floats.length;
      context.floatValues[name]=value;
    }
    return '('+name+'/1)';
  });

  out = out.replace(/(?<![a-z0-9_])(\$?[A-Z]\$?\d+)\b/gi, match => {
    const parsed = parseCoord(match);
    if (!parsed) throw new Error('Invalid cell coordinate: ' + match);
    const norm = parsed.coord;
    const ev = evaluateCell(norm, new Set(visiting));
    return canonicalToken(ev, context);
  });

  return out;
}

function rationalToFloat(q) {
  if (q.n === 0n) return 0;
  const sign = q.n < 0n ? -1 : 1;
  const n = q.n < 0n ? -q.n : q.n, d = q.d;
  let exponent = n.toString(2).length - d.toString(2).length;
  if (exponent >= 0 ? n < (d << BigInt(exponent)) : (n << BigInt(-exponent)) < d) exponent--;
  if (exponent > 1023) return sign * Infinity;
  if (exponent < -1075) return sign * 0;
  const unitExponent = exponent < -1022 ? -1074 : exponent - 52;
  const numerator = unitExponent < 0 ? n << BigInt(-unitExponent) : n;
  const denominator = unitExponent > 0 ? d << BigInt(unitExponent) : d;
  let mantissa = numerator / denominator;
  const twiceRemainder = 2n * (numerator % denominator);
  if (twiceRemainder > denominator || (twiceRemainder === denominator && mantissa % 2n)) mantissa++;
  return sign * Number(mantissa) * 2 ** unitExponent;
}

function isExpectedLimit(coord, raw, calc) {
  const parsed = parseCoord(coord);
  const row = SCENARIO_WORKBOOKS[selectedTemplate]?.rows[(parsed?.rowIdx ?? 0) - 1];
  if (!row || parsed.colIdx !== 3 || raw !== row[3]) return false;
  if (calc.status === 'unsupported') return row[6] === 'Unsupported expression' || row[6] === calc.text;
  return row[6] === 'undefined' && calc.code === 'DIVISION_BY_ZERO';
}

function computeFloatComparison(resolvedExpr, calc, context) {
  if (!calc || !calc.rational || calc.approximate) return null;
  const q = calc.rational;
  const exactFloat = rationalToFloat(q);
  // Also simulate naive JS IEEE-754 evaluation on simple arithmetic to expose classic 0.1 + 0.2 drift
  let naiveFloat = exactFloat;
  try {
    const values=context?.floatValues||{};
    const tokens=AliceMath.Syntax.lex(resolvedExpr);
    if(tokens.length&&tokens.every(t=>/^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[+*/^().-])$/i.test(t)||Object.hasOwn(values,t))) {
      naiveFloat=evalFloatTokens(tokens,values);
      if(Number.isNaN(naiveFloat))naiveFloat=exactFloat;
    }
  } catch (_) {}
  return { exactFloat, naiveFloat };
}

// Safe token-based float evaluator (no eval) to demonstrate IEEE-754 drift vs BigInt Q
function evalFloatTokens(tokens, values = {}) {
  let i = 0;
  function parseExpr(minBp = 0) {
    let t = tokens[i++];
    let lhs = 0;
    if (t === '+' || t === '-') {
      const v = parseExpr(25);
      lhs = t === '-' ? -v : v;
    } else if (t === '(') {
      lhs = parseExpr(0);
      i++; // ')'
    } else {
      lhs = Object.hasOwn(values,t) ? values[t] : parseFloat(t);
    }
    while (i < tokens.length) {
      const op = tokens[i];
      const bp = { '+': 10, '-': 10, '*': 20, '/': 20, '^': 30 }[op] ?? -1;
      if (bp < minBp) break;
      i++;
      const rhs = parseExpr(op === '^' ? bp : bp + 1);
      lhs = op === '+' ? lhs + rhs : op === '-' ? lhs - rhs : op === '*' ? lhs * rhs : op === '/' ? lhs / rhs : Math.pow(lhs, rhs);
    }
    return lhs;
  }
  return parseExpr(0);
}

function formatCellDisplay(calc, floatApprox) {
  if (!calc) return '';
  if (calc.status !== 'result') return calc.text;
  if (!calc.rational) return calc.text;

  const q = calc.rational;
  const unitSuffix = calc.unitLabel ? ' ' + calc.unitLabel : '';
  const eqPrefix = calc.kind === 'equation' ? 'x = ' : '';

  if (displayFormat === 'fraction') {
    return `${eqPrefix}${q.n}/${q.d}${unitSuffix}`;
  }
  if (displayFormat === 'float' && floatApprox) {
    const fStr = String(floatApprox.naiveFloat);
    return `${eqPrefix}${fStr}${unitSuffix}`;
  }
  return calc.text;
}

function getCalculationIssue(ev) {
  if (!ev || ev.kind === 'empty' || ev.kind === 'label') return null;
  const expression = ev.resolvedExpr || (ev.raw || '').replace(/^=/, '');
  if (ev.status === 'unsupported' || ev.kind === 'error') {
    return { expression, title: ev.expectedLimit ? 'Expected limit' : ev.kind === 'error' ? 'Calculation error' : 'Unsupported calculation', reason: ev.text || 'This calculation could not be completed.' };
  }
  if (ev.text === 'undefined') {
    return { expression, title: ev.expectedLimit ? 'Expected limit' : 'Undefined calculation', reason: 'Division by zero has no defined result.' };
  }
  if (displayFormat === 'float' && ev.floatApprox && (!Number.isFinite(ev.floatApprox.naiveFloat) || (ev.rational?.n !== 0n && ev.floatApprox.naiveFloat === 0))) {
    return { expression, title: 'Float64 limit', reason: 'Float64 cannot represent this result. Switch to Exact Auto or Strict Fraction to inspect the exact value.' };
  }
  return null;
}

function recalculateAll() {
  evaluatedCells.clear();
  for (let r = 1; r <= ROWS; r++) {
    for (const c of COLS) {
      const coord = c + r;
      if (rawCells.has(coord)) evaluateCell(coord);
    }
  }
  renderGridValues();
  updateInspector(selectedCoord);
  updateOmniboxPreview();
}

// Build DOM Grid
function buildGridDOM() {
  gridEl.replaceChildren();
  const colgroup = document.createElement('colgroup');
  for (let i = 0; i <= COLS.length; i++) {
    const col = document.createElement('col');
    col.style.width = (i === 0 ? 46 : 155) + 'px';
    colgroup.append(col);
  }
  gridEl.append(colgroup);
  const thead = document.createElement('thead');
  const hRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'row-hdr';
  corner.textContent = '∑';
  hRow.append(corner);

  for (const col of COLS) {
    const th = document.createElement('th');
    th.className = 'col-hdr';
    th.textContent = col;
    hRow.append(th);
  }
  thead.append(hRow);
  gridEl.append(thead);

  const tbody = document.createElement('tbody');
  for (let r = 1; r <= ROWS; r++) {
    const tr = document.createElement('tr');
    const rHdr = document.createElement('th');
    rHdr.className = 'row-hdr';
    rHdr.textContent = String(r);
    tr.append(rHdr);

    for (const col of COLS) {
      const coord = col + r;
      const td = document.createElement('td');
      td.className = 'sheet-cell';
      td.dataset.coord = coord;
      td.onmousedown = e => { if (e.shiftKey) e.preventDefault(); };
      td.onclick = e => selectCell(coord, e.shiftKey);
      td.ondblclick = () => startInlineEdit(coord, td);
      tr.append(td);
    }
    tbody.append(tr);
  }
  gridEl.append(tbody);
}

function renderGridValues() {
  closeCellComment();
  const cells = gridEl.querySelectorAll('.sheet-cell');
  cells.forEach(td => {
    const coord = td.dataset.coord;
    const ev = evaluatedCells.get(coord);
    td.className = 'sheet-cell' + (coord === selectedCoord ? ' selected' : '') + (selectionRange?.includes(coord) ? ' in-selection' : '');
    if (!ev || ev.kind === 'empty') {
      td.textContent = '';
      td.removeAttribute('title');
      return;
    }
    const content = document.createElement('span');
    content.className = 'cell-content';
    content.textContent = ev.display;
    td.replaceChildren(content);
    td.title = (ev.approximate ? `Approximate · ${ev.precision} significant digits · ` : '') + (ev.raw !== ev.display ? `${ev.raw} →${ev.display}` : ev.display);
    const issue = getCalculationIssue(ev);
    if (issue) {
      td.removeAttribute('title');
      td.classList.add('has-comment');
      const marker = document.createElement('button');
      marker.className = 'cell-comment-marker';
      marker.type = 'button';
      marker.setAttribute('aria-label', 'Show calculation comment for ' + coord);
      marker.setAttribute('aria-controls', 'cell-comment');
      marker.setAttribute('aria-expanded', 'false');
      marker.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4V5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
      marker.onclick = e => {
        e.stopPropagation();
        const closing = commentAnchor === marker && commentPinned;
        if (closing) { closeCellComment(); return; }
        if (selectedCoord !== coord) selectCell(coord);
        const currentMarker = gridEl.querySelector(`[data-coord="${coord}"] .cell-comment-marker`);
        openCellComment(currentMarker, coord, issue, ev.raw, true);
      };
      marker.onmouseenter = () => { if (!commentPinned) openCellComment(marker, coord, issue, ev.raw); };
      marker.onmouseleave = scheduleCommentClose;
      marker.onfocus = () => { if (!commentPinned) openCellComment(marker, coord, issue, ev.raw); };
      marker.onblur = scheduleCommentClose;
      td.append(marker);
    }
    if (ev.expectedLimit || issue?.title === 'Float64 limit') td.classList.add('is-limit');
    else if (ev.status === 'unsupported' || ev.kind === 'error') td.classList.add('is-err');
    else if (issue) td.classList.add('is-err');
    else if (ev.kind === 'label') td.classList.add('is-label');
    else if (ev.approximate) td.classList.add('is-approx');
    else if (ev.kind === 'equation') td.classList.add('is-eq');
    else if (ev.unitLabel) td.classList.add('is-unit');
    else td.classList.add('is-num');
  });
  updateGridTextLayout();
}

function updateGridTextLayout() {
  gridEl.classList.toggle('wrap-cell-text', wrapCellText);
  document.querySelector('#wrap-cell-text').setAttribute('aria-pressed', String(wrapCellText));
  document.querySelector('#wrap-cell-text').classList.toggle('active', wrapCellText);
  document.querySelector('#fit-cell-columns').setAttribute('aria-pressed', String(fitCellColumns));
  document.querySelector('#fit-cell-columns').classList.toggle('active', fitCellColumns);
  const widths = COLS.map(() => 155);
  if (fitCellColumns) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    gridEl.querySelectorAll('.sheet-cell').forEach(td => {
      const col = parseCoord(td.dataset.coord).colIdx;
      const content = td.querySelector('.cell-content');
      if (!content) return;
      ctx.font = getComputedStyle(content).font;
      const width = Math.max(...content.textContent.split('\n').map(line => ctx.measureText(line).width));
      widths[col] = Math.max(widths[col], Math.ceil(width) + (td.classList.contains('has-comment') ? 40 : 20));
    });
  }
  gridEl.querySelectorAll('colgroup col').forEach((col, i) => { col.style.width = (i === 0 ? 46 : widths[i - 1]) + 'px'; });
  gridEl.querySelectorAll('.col-hdr').forEach((th, i) => { th.style.width = widths[i] + 'px'; });
  gridEl.style.width = (46 + widths.reduce((sum, width) => sum + width, 0)) + 'px';
}

function openCellComment(marker, coord, issue, raw, pinned = false) {
  clearTimeout(commentHideTimer);
  if (commentAnchor && commentAnchor !== marker) commentAnchor.setAttribute('aria-expanded', 'false');
  commentAnchor = marker;
  commentPinned = pinned;
  marker.setAttribute('aria-expanded', 'true');
  const popup = document.querySelector('#cell-comment');
  document.querySelector('#cell-comment-title').textContent = coord + ' · ' + issue.title;
  document.querySelector('#cell-comment-reason').textContent = issue.reason;
  document.querySelector('#cell-comment-expression').textContent = issue.expression;
  document.querySelector('#cell-comment-raw').textContent = raw;
  popup.hidden = false;
  const rect = marker.getBoundingClientRect();
  popup.style.left = Math.max(12, Math.min(rect.right + 8, window.innerWidth - popup.offsetWidth - 12)) + 'px';
  popup.style.top = Math.max(12, Math.min(rect.top, window.innerHeight - popup.offsetHeight - 12)) + 'px';
}

function closeCellComment(restoreFocus = false) {
  clearTimeout(commentHideTimer);
  const marker = commentAnchor;
  commentAnchor = null;
  commentPinned = false;
  if (marker) marker.setAttribute('aria-expanded', 'false');
  document.querySelector('#cell-comment').hidden = true;
  if (restoreFocus && marker?.isConnected) {
    // Focusing the marker again must not immediately reopen its hover/focus comment.
    marker.onfocus = null;
    marker.focus();
    marker.onfocus = () => marker.onmouseenter();
  }
}

function scheduleCommentClose() {
  if (commentPinned) return;
  clearTimeout(commentHideTimer);
  commentHideTimer = setTimeout(() => {
    const popup = document.querySelector('#cell-comment');
    if (!popup.contains(document.activeElement) && document.activeElement !== commentAnchor) closeCellComment();
  }, 250);
}

function selectCell(coord, extend = false) {
  if (extend) selectionRange = expandRange(selectedCoord, coord);
  else { selectedCoord = coord; selectionRange = null; }
  activeCellBadge.textContent = selectedCoord;
  formulaInput.value = rawCells.get(selectedCoord) || '';
  renderGridValues();
  updateInspector(selectedCoord);
}

function commitCellValue(coord, val) {
  const trimmed = val.startsWith("'") ? val : val.trim();
  if (trimmed.length > AliceWorkbookIO.MAX_TEXT) { updateHistoryControls('Cell text must have at most 2000 characters.'); return false; }
  try {
    return changeWorkbook('Edit ' + coord, () => {
      if (trimmed) rawCells.set(coord, trimmed); else rawCells.delete(coord);
      importIssues.delete(coord);
    });
  } catch (error) { updateHistoryControls(error.message); return false; }
}

function fillDown(source, throughRow) {
  const plan = AliceSheet.planFill(rawCells, importIssues, source, throughRow, { cols: COLS, rows: ROWS });
  changeWorkbook('Fill ' + plan.range, () => {
    for (const change of plan.changes) {
      if (change.raw) rawCells.set(change.coord, change.raw); else rawCells.delete(change.coord);
      if (change.issue) importIssues.set(change.coord, change.issue); else importIssues.delete(change.coord);
    }
  });
  return plan;
}

function startInlineEdit(coord, td) {
  selectCell(coord);
  const currentRaw = rawCells.get(coord) || '';
  td.textContent = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cell-inline-editor';
  input.value = currentRaw;
  td.append(input);
  input.focus();
  input.select();

  let committed = false;
  const finish = save => {
    if (committed) return;
    committed = true;
    if (save) commitCellValue(coord, input.value);
    else renderGridValues();
  };

  input.onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
      moveSelection(0, 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      finish(true);
      moveSelection(e.shiftKey ? -1 : 1, 0);
    }
  };
  input.onblur = () => finish(true);
}

function moveSelection(dCol, dRow) {
  const p = parseCoord(selectedCoord);
  if (!p) return;
  const nextCol = Math.max(0, Math.min(COLS.length - 1, p.colIdx + dCol));
  const nextRow = Math.max(0, Math.min(ROWS - 1, p.rowIdx + dRow));
  selectCell(COLS[nextCol] + (nextRow + 1));
}

// Inspector Panel Update
function updateInspector(coord) {
  updateWorkbookGuide(coord);
  const ev = evaluatedCells.get(coord);
  document.querySelector('#insp-coord').textContent = coord;
  const statusEl = document.querySelector('#inspector-status');

  if (!ev || ev.kind === 'empty') {
    document.querySelector('#insp-output-label').textContent = 'Exact Output';
    document.querySelector('#insp-precision-label').textContent = 'BigInt Bit-Length';
    statusEl.textContent = 'Empty';
    statusEl.className = 'badge';
    document.querySelector('#insp-raw').textContent = '—';
    document.querySelector('#insp-resolved').textContent = '—';
    document.querySelector('#insp-output').textContent = '—';
    document.querySelector('#insp-fraction').textContent = '—';
    document.querySelector('#insp-bits').textContent = '—';
    document.querySelector('#insp-dim').textContent = '[0, 0, 0] (dimensionless)';
    document.querySelector('#insp-float').textContent = '—';
    return;
  }

  const issue = getCalculationIssue(ev);
  statusEl.textContent = issue ? issue.title : ev.approximate ? `Approximate · ${ev.precision} digits` : ev.status || ev.kind;
  document.querySelector('#insp-output-label').textContent = ev.approximate ? 'Approximate Output' : 'Exact Output';
  document.querySelector('#insp-precision-label').textContent = ev.approximate ? 'Decimal Precision' : 'BigInt Bit-Length';
  statusEl.className = 'badge ' + (ev.approximate ? 'warn' : ev.expectedLimit || issue?.title === 'Float64 limit' ? 'warn' : issue ? 'err' : ev.status === 'result' ? 'good' : ev.kind === 'label' ? '' : 'err');
  document.querySelector('#insp-raw').textContent = ev.raw || '—';
  document.querySelector('#insp-resolved').textContent = ev.resolvedExpr || ev.raw || '—';
  document.querySelector('#insp-output').textContent = ev.text || ev.display || '—';

  if (ev.rational) {
    const q = ev.rational;
    document.querySelector('#insp-fraction').textContent = `${q.n} /${q.d}`;
    const nBits = q.n === 0n ? 1 : q.n.toString(2).replace('-', '').length;
    const dBits = q.d.toString(2).length;
    document.querySelector('#insp-bits').textContent = `${nBits}b num / ${dBits}b den (limit 4096b)`;
  } else {
    document.querySelector('#insp-fraction').textContent = ev.approximate ? 'Not an exact fraction' : '—';
    document.querySelector('#insp-bits').textContent = ev.approximate ? `${ev.precision} significant digits · decimal rounding, not an error bound` : '—';
  }

  const dim = ev.dim || [0, 0, 0];
  const dimDesc = dim.every(x => x === 0)
    ? '[0, 0, 0] (dimensionless)'
    : `[${dim.join(', ')}] → m^${dim[0]} · s^${dim[1]} · kg^${dim[2]}`;
  document.querySelector('#insp-dim').textContent = dimDesc;

  if (ev.floatApprox) {
    document.querySelector('#insp-float').textContent = String(ev.floatApprox.naiveFloat);
  } else {
    document.querySelector('#insp-float').textContent = '—';
  }
}

function updateWorkbookGuide(coord) {
  const workbook = SCENARIO_WORKBOOKS[selectedTemplate];
  const custom = customWorkbooks.get(selectedTemplate);
  document.querySelector('#workbook-guide').hidden = !workbook && !custom;
  document.querySelector('#workbook-sources').hidden = !!custom;
  if (custom) {
    document.querySelector('#workbook-title').textContent = custom.name;
    document.querySelector('#workbook-summary').textContent = workbookConflicts.has(selectedTemplate) ? 'Another tab changed the saved version. Your local cells and draft are retained; load the saved version or save a conflict copy.' : workbookStorageError ? 'Your workbook is kept for this session. Export JSON to keep a copy.' : workbookSaving || dirtyWorkbooks.has(selectedTemplate) ? 'Changes are waiting to save. Keep this tab open until the save completes, or export JSON.' : 'Your workbook is saved in this browser. Export JSON to keep a portable copy.';
    document.querySelector('#workbook-example').textContent = 'Enter numbers, = formulas, fractions, unit expressions, or a linear equation. Cell references stay within this workbook.';
    document.querySelector('#workbook-expected').textContent = '';
    return;
  }
  if (!workbook) return;
  document.querySelector('#workbook-title').textContent = workbook.title.replace(/^Workbook \d+ · /, '');
  document.querySelector('#workbook-summary').textContent = workbook.summary;
  const row = workbook.rows[(parseCoord(coord)?.rowIdx ?? 0) - 1];
  document.querySelector('#workbook-example').textContent = row ? row[0] + ': ' + row[5] : 'Select a result or guard cell to inspect its formula and exact rational output.';
  document.querySelector('#workbook-expected').textContent = row ? 'Template result (Exact only): ' + (row[7] || row[6]) : '';
  const links = document.querySelector('#workbook-sources');
  links.replaceChildren();
  const sources = workbook.sources || [];
  for (const [label, href] of sources) {
    const a = document.createElement('a');
    a.textContent = label;
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    links.append(a);
  }
}

// Smart Omnibox Controller (Supports live cell references inside Omnibox!)
function evaluateOmniboxText(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  try {
    const expr = trimmed.replace(/^=/, '');
    const referenceContext = createReferenceContext(expr);
    const expanded = expandMacrosAndCellRefs(expr, new Set(), referenceContext);
    return { expanded: readableResolvedExpression(expanded, referenceContext), res: calculateExpression(expanded, referenceContext) };
  } catch (e) {
    return { expanded: trimmed, res: { status: e.code === 'DIVISION_BY_ZERO' ? 'error' : 'unsupported', code: e.code || 'CELL_ERROR', exact: false, text: e.message } };
  }
}

function updateOmniboxPreview() {
  const out = evaluateOmniboxText(omniboxInput.value);
  if (!out) {
    omniboxPreview.textContent = 'Type an expression…';
    return;
  }
  omniboxPreview.textContent = out.res.text;
}

function addTapeItem(expr) {
  const out = evaluateOmniboxText(expr);
  if (!out) return;
  const item = document.createElement('div');
  item.className = 'tape-item';
  const top = document.createElement('div');
  top.className = 'tape-expr';
  top.textContent = expr + (out.expanded !== expr ? `  [${out.expanded}]` : '');
  const bot = document.createElement('div');
  bot.className = 'tape-res';
  bot.textContent = '= ' + out.res.text;
  item.append(top, bot);
  item.onclick = () => {
    omniboxInput.value = expr;
    updateOmniboxPreview();
  };
  omniboxTape.prepend(item);
}

// Unit Registry Panel
function renderUnitsRegistry() {
  const entries = Object.entries(unitsRegistry);
  unitCountBadge.textContent = `${entries.length} units`;
  unitListEl.replaceChildren();
  entries.forEach(([name, [scale, dim]]) => {
    const div = document.createElement('div');
    const dimStr = dim.map((e, i) => (e ? `${['m', 's', 'kg'][i]}${e === 1 ? '' : '^' + e}` : '')).filter(Boolean).join('·') || '1';
    div.textContent = `${name}: ${scale} (${dimStr})`;
    unitListEl.append(div);
  });
}

function exportWorkbookData() {
  return {
    schema: 'alice.grid-workbook/v1',
    name: customWorkbooks.get(selectedTemplate)?.name || SCENARIO_WORKBOOKS[selectedTemplate]?.title || document.querySelector('#template-select').selectedOptions[0].textContent,
    calculation: calculationSettings(),
    units: customUnitDefinitions(),
    importIssues: Object.fromEntries(importIssues),
    cells: Object.fromEntries(rawCells),
    evaluated: Object.fromEntries([...evaluatedCells.entries()].filter(([, v]) => v.kind !== 'empty').map(([k, v]) => [k, {
      raw: v.raw, output: v.text || v.display, status: v.status, ...(v.code ? {code:v.code} : {}), exact: v.exact === true,
      ...(v.approximate ? { approximate: true, precision: v.precision, approximateValue: v.approximateValue,
        baseApproximateValue: v.baseApproximateValue, dim: v.dim, unitLabel: v.unitLabel,
        rounding: v.rounding, workingPrecision: v.workingPrecision } : {})
    }]))
  };
}

// Event Listeners & Shortcuts
window.addEventListener('storage',handleWorkbookStorageEvent);
window.addEventListener('beforeunload',e=>{if(workbookSaving||[...dirtyWorkbooks].some(id=>customWorkbooks.has(id)&&JSON.stringify(workbookRecord(customWorkbooks.get(id)))!==savedWorkbookJSON.get(id))){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{captureCurrentCustomWorkbook();flushWorkbookSaves();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){captureCurrentCustomWorkbook();flushWorkbookSaves();}});
document.querySelector('#retry-workbook-save').onclick=()=>{captureCurrentCustomWorkbook();flushWorkbookSaves();};
document.querySelector('#save-conflict-copy').onclick=async()=>{try{await saveConflictCopy();}catch(e){workbookStorageError=e.message;updateWorkbookStorageStatus();}};
document.querySelector('#load-shared-version').onclick=()=>document.querySelector('#storage-reload-dialog').showModal();
document.querySelector('#cancel-storage-reload').onclick=()=>document.querySelector('#storage-reload-dialog').close();
document.querySelector('#confirm-storage-reload').onclick=async()=>{try{await loadSharedWorkbook();document.querySelector('#storage-reload-dialog').close();}catch(e){document.querySelector('#storage-reload-error').textContent=e.message;}};
document.querySelector('#rename-legacy-unit').onclick=()=>{
  const select=document.querySelector('#legacy-unit-name');select.replaceChildren();
  for(const name of legacyUnitNames()){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);}
  document.querySelector('#legacy-unit-new-name').value='';document.querySelector('#legacy-unit-error').textContent='';document.querySelector('#legacy-unit-dialog').showModal();
};
document.querySelector('#cancel-legacy-unit').onclick=()=>document.querySelector('#legacy-unit-dialog').close();
document.querySelector('#legacy-unit-form').onsubmit=e=>{e.preventDefault();try{renameLegacyUnit(document.querySelector('#legacy-unit-name').value,document.querySelector('#legacy-unit-new-name').value);document.querySelector('#legacy-unit-dialog').close();updateWorkbookStorageStatus();}catch(error){document.querySelector('#legacy-unit-error').textContent=error.message;}};

document.querySelector('#calculation-mode').onchange = e => {
  changeWorkbook('Change calculation mode', () => { calculationMode = e.target.value === 'approximate' ? 'approximate' : 'exact'; });
};
document.querySelector('#decimal-precision').onchange = e => {
  const chosen = Number(e.target.value);
  if (AliceApprox.PRECISIONS.includes(chosen)) changeWorkbook('Change decimal precision', () => { decimalPrecision = chosen; });
};
document.querySelector('#undo-workbook').onclick = () => undoWorkbook();
document.querySelector('#redo-workbook').onclick = () => undoWorkbook(true);
document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || document.querySelector('dialog[open]')) return;
  const key = e.key.toLowerCase();
  if (key !== 'z' && key !== 'y') return;
  const active = document.activeElement;
  if (active?.matches('input, textarea, [contenteditable="true"]')) {
    if (active !== formulaInput || formulaInput.value.trim() !== (rawCells.get(selectedCoord) || '')) return;
  }
  e.preventDefault(); e.stopImmediatePropagation(); undoWorkbook(key === 'y' || e.shiftKey);
}, true);
document.querySelector('#delete-workbook').onclick = () => {
  const book = customWorkbooks.get(selectedTemplate);
  if (!book) return;
  closeCellComment();
  pendingDeleteWorkbookId = book.id;
  document.querySelector('#delete-workbook-name').textContent = book.name;
  document.querySelector('#delete-workbook-error').hidden = true;
  document.querySelector('#delete-workbook-dialog').showModal();
  document.querySelector('#cancel-delete-workbook').focus();
};
document.querySelector('#cancel-delete-workbook').onclick = () => document.querySelector('#delete-workbook-dialog').close();
document.querySelector('#delete-workbook-dialog').addEventListener('close', () => {
  pendingDeleteWorkbookId = null;
  const button = document.querySelector('#delete-workbook');
  (button.hidden ? document.querySelector('#template-select') : button).focus();
});
document.querySelector('#delete-workbook-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await deleteCustomWorkbook(pendingDeleteWorkbookId);
    document.querySelector('#delete-workbook-dialog').close();
  } catch (err) {
    const error = document.querySelector('#delete-workbook-error');
    error.textContent = err.message;
    error.hidden = false;
  }
});
document.querySelector('#new-workbook').onclick = () => {
  closeCellComment();
  const input = document.querySelector('#new-workbook-name');
  input.value = defaultNewWorkbookName();
  document.querySelector('#new-workbook-hint').textContent = workbookStorageError ? 'Start with a blank grid for this session. Export JSON to keep a copy.' : 'Start with a blank grid. Your workbooks are saved in this browser.';
  document.querySelector('#new-workbook-error').hidden = true;
  document.querySelector('#new-workbook-dialog').showModal();
  input.focus();
  input.select();
};
document.querySelector('#cancel-new-workbook').onclick = () => document.querySelector('#new-workbook-dialog').close();
document.querySelector('#new-workbook-dialog').addEventListener('close', () => {
  if (document.activeElement === document.body) document.querySelector('#new-workbook').focus();
});
document.querySelector('#new-workbook-form').addEventListener('submit', e => {
  e.preventDefault();
  try {
    createCustomWorkbook(document.querySelector('#new-workbook-name').value);
    document.querySelector('#new-workbook-dialog').close();
    formulaInput.focus();
  } catch (err) {
    const error = document.querySelector('#new-workbook-error');
    error.textContent = err.message;
    error.hidden = false;
  }
});
document.querySelector('#wrap-cell-text').onclick = () => {
  wrapCellText = !wrapCellText;
  closeCellComment();
  updateGridTextLayout();
};
document.querySelector('#fit-cell-columns').onclick = () => {
  fitCellColumns = !fitCellColumns;
  closeCellComment();
  updateGridTextLayout();
};
document.querySelector('#close-cell-comment').onclick = () => closeCellComment(true);
document.querySelector('#cell-comment').onmouseenter = () => clearTimeout(commentHideTimer);
document.querySelector('#cell-comment').onmouseleave = scheduleCommentClose;
document.querySelector('.table-scroll').addEventListener('scroll', () => closeCellComment());
window.addEventListener('resize', () => closeCellComment());
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('.cell-comment-marker, #cell-comment')) closeCellComment();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && commentAnchor) { e.preventDefault(); closeCellComment(true); }
});
formulaInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    commitCellValue(selectedCoord, formulaInput.value);
    moveSelection(0, 1);
  }
});

omniboxInput.addEventListener('input', updateOmniboxPreview);
omniboxInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addTapeItem(omniboxInput.value);
  }
});

document.querySelector('#omnibox-send-cell').onclick = () => {
  const val = omniboxInput.value.trim();
  if (!val) return;
  const asFormula = val.startsWith('=') ? val : '=' + val;
  formulaInput.value = asFormula;
  commitCellValue(selectedCoord, asFormula);
};

document.querySelector('#omnibox-pin').onclick = () => addTapeItem(omniboxInput.value);
document.querySelector('#clear-tape').onclick = () => omniboxTape.replaceChildren();

// Display Format Toggle
document.querySelectorAll('.display-mode-group .chip').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.display-mode-group .chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    displayFormat = btn.dataset.format;
    recalculateAll();
  };
});

// Workbook Selector
document.querySelector('#template-select').onchange = e => loadTemplate(e.target.value);
document.querySelector('#clear-sheet').onclick = () => {
  changeWorkbook('Clear Grid', () => { rawCells.clear(); importIssues.clear(); selectedCoord = 'A1'; });
  selectCell('A1');
};

// Custom Unit Registration
document.querySelector('#add-unit-btn').onclick = () => {
  const name = document.querySelector('#new-unit-name').value.trim().toLowerCase();
  const scale = document.querySelector('#new-unit-scale').value.trim();
  const dimRaw = document.querySelector('#new-unit-dim').value.trim();
  if (!/^[a-z]+$/.test(name)) {
    alert('Unit name must contain lowercase letters only (a-z).');
    return;
  }
  if (AliceMath.Syntax.RESERVED.includes(name)) {
    alert('This name is reserved for the variable or a math function.');
    return;
  }
  try {
    const dim = dimRaw.split(',').map(s => Number(s.trim()));
    if (dim.length !== 3 || dim.some(n => !Number.isInteger(n) || Math.abs(n) > 10)) {
      throw new Error('Dimensions must be 3 integers between -10 and 10.');
    }
    AliceWorkbookIO.validateUnits({ [name]: [scale, dim] });
    if (!Object.hasOwn(unitsRegistry,name) && Object.keys(customUnitDefinitions()).length >= 100) throw new Error('Use at most 100 custom units per workbook.');
    changeWorkbook('Define unit ' + name, () => { unitsRegistry[name] = [scale, dim]; });
    document.querySelector('#new-unit-name').value = '';
    document.querySelector('#new-unit-scale').value = '';
  } catch (e) {
    alert('Invalid unit definition: ' + e.message);
  }
};

// Export CSV & JSON
function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.querySelector('#export-csv').onclick = () => {
  const formulas = document.querySelector('#csv-export-mode').value === 'formulas';
  downloadBlob(formulas ? 'alice-grid-formulas.csv' : 'alice-grid-values.csv', AliceWorkbookIO.exportCSV(rawCells, evaluatedCells, {cols:COLS, rows:ROWS}, formulas), 'text/csv');
};

document.querySelector('#export-json').onclick = () => {
  const dump = exportWorkbookData();
  downloadBlob('alice-grid-workbook.json', JSON.stringify(dump, null, 2), 'application/json');
};

// Global Keyboard Navigation (Cmd/Ctrl+K for Omnibox, Arrow keys in grid)
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    omniboxInput.focus();
    omniboxInput.select();
    return;
  }
  if (document.activeElement === document.body) {
    if (e.key === 'ArrowRight') { e.preventDefault(); moveSelection(1, 0); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); moveSelection(-1, 0); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(0, 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(0, -1); }
    else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      commitCellValue(selectedCoord, '');
      formulaInput.value = '';
    }
  }
});

// Initialize Quick Omnibox Chips & Boot
[
  'solve 2*x + 3 = 11',
  '1/3 + 1/6',
  'convert 500 w * 2 hr to kj',
  '15% of 240',
  '1 / 97',
  'SUM(B2:B5)'
].forEach(sample => {
  const btn = document.createElement('button');
  btn.className = 'chip';
  btn.textContent = sample;
  btn.onclick = () => {
    omniboxInput.value = sample;
    updateOmniboxPreview();
    addTapeItem(sample);
  };
  quickChips.append(btn);
});

for (const [name, workbook] of Object.entries(SCENARIO_WORKBOOKS).sort(([, a], [, b]) => Number(a.title.match(/\d+/)[0]) - Number(b.title.match(/\d+/)[0]))) {
  const option = document.createElement('option');
  option.value = name;
  option.textContent = workbook.title;
  document.querySelector('#template-select').append(option);
}
const initialWorkbook = restoreCustomWorkbooks();
buildGridDOM();
renderUnitsRegistry();
loadTemplate(initialWorkbook);
[
  'solve 2*x + 3 = 11',
  'convert 1500 m to km',
  '0.1 + 0.2',
  '1 / 97'
].forEach(addTapeItem);
