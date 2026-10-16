/*! AliceGrid fill preview and accent picker | Alice by San | CC BY-NC 4.0 */
'use strict';
(function () {
  const accent = document.querySelector('#accent-select');
  function applyAccent(name) {
    const key = AliceSheet.normalizeAccent(name), palette = AliceSheet.ACCENTS[key];
    const vars = { purple: 'primary', 'purple-dark': 'dark', pale: 'pale', 'cell-sel': 'selected', bg: 'bg', side: 'side', line: 'line' };
    for (const [css, field] of Object.entries(vars)) document.documentElement.style.setProperty('--' + css, palette[field]);
    document.documentElement.dataset.accent = key;
    accent.value = key;
  }
  for (const [key, palette] of Object.entries(AliceSheet.ACCENTS)) {
    const option = document.createElement('option'); option.value = key; option.textContent = palette.label; accent.append(option);
  }
  let saved = 'purple'; try { saved = AliceSheet.readAccent(localStorage); } catch (_) {}
  applyAccent(saved);
  accent.onchange = () => {
    applyAccent(accent.value);
    let stored = false; try { stored = AliceSheet.saveAccent(localStorage, accent.value); } catch (_) {}
    document.querySelector('#accent-status').textContent = stored ? '' : 'Accent applies this session; browser storage is unavailable.';
  };
  const dialog = document.querySelector('#fill-dialog'), source = document.querySelector('#fill-source'), last = document.querySelector('#fill-last-row');
  const confirm = document.querySelector('#fill-confirm'), error = document.querySelector('#fill-error');
  const options = { cols: COLS, rows: ROWS };
  last.max = ROWS;
  function makePlan() { return AliceSheet.planFill(rawCells, importIssues, source.value, Number(last.value), options); }
  function preview() {
    const table = document.querySelector('#fill-preview'); table.replaceChildren(); error.hidden = true; confirm.disabled = true;
    try {
      const plan = makePlan();
      document.querySelector('#fill-summary').textContent = plan.changes.length + ' cells in ' + plan.range + ' · ' + plan.overwrites + ' existing cells replaced.';
      for (const change of plan.changes.slice(0, 8)) {
        const row = document.createElement('tr');
        for (const value of [change.coord, change.raw || '(clear cell)']) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
        table.append(row);
      }
      confirm.disabled = false;
    } catch (e) { document.querySelector('#fill-summary').textContent = ''; error.textContent = e.message; error.hidden = false; }
  }
  function openFill() {
    closeCellComment();
    const selected = selectionRange || [selectedCoord], positions = selected.map(parseCoord);
    const top = Math.min(...positions.map(p => p.rowIdx)), bottom = Math.max(...positions.map(p => p.rowIdx));
    const left = Math.min(...positions.map(p => p.colIdx)), right = Math.max(...positions.map(p => p.colIdx));
    source.value = COLS[left] + (top + 1) + (left !== right ? ':' + COLS[right] + (top + 1) : '');
    last.value = Math.min(ROWS, (bottom > top ? bottom : top + 1) + 1);
    preview(); dialog.showModal(); source.focus(); source.select();
  }
  document.querySelector('#fill-down').onclick = openFill;
  source.oninput = preview; last.oninput = preview;
  document.querySelector('#cancel-fill').onclick = () => dialog.close();
  dialog.addEventListener('close', () => document.querySelector('#fill-down').focus());
  document.querySelector('#fill-form').onsubmit = e => {
    e.preventDefault();
    try {
      fillDown(source.value, Number(last.value));
      selectionRange = null; renderGridValues(); dialog.close();
    } catch (e) { error.textContent = e.message; error.hidden = false; }
  };
  document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'd' || document.querySelector('dialog[open]')) return;
    if (document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault(); openFill();
  });
})();
