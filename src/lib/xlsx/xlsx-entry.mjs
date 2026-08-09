// Runs inside the xlsx WebView (FR-43): parses the workbook with SheetJS,
// renders one sheet at a time as an HTML table, and offers tabs to switch
// sheets. A third bundle, for the same reason docx has its own — the Markdown
// path must not carry SheetJS (FR-21).
//
// What SheetJS hands us is not quite ready to show: the shape of a sheet is not
// its stored extent (shape.mjs) and its display strings are not always what
// Excel showed (display.mjs). This file is the part that turns the corrected
// result into a page.
import * as XLSX from '@e965/xlsx';

import { applyJapaneseEra, ensureNegativeSign } from './display.mjs';
import { classifyRows, contentBounds } from './shape.mjs';

// Rendering every row of a big sheet blows up the DOM. Start capped and let the
// reader ask for the rest (FR-43). The cap counts rows we actually render, so a
// sheet padded out to a thousand empty rows no longer spends the budget on
// nothing.
const ROW_CAP = 1000;

function post(message) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const labels = window.CONFIG.labels;
let workbook = null;

function fill(template, values) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]);
}

function renderSheet(name, showAll) {
  const original = workbook.Sheets[name];
  // `!ref` is the sheet's stored extent, not the document: it counts rows that
  // hold formatting and nothing else. Read from the cells instead (FR-43).
  const bounds = contentBounds(original);
  const totalRows = bounds.e.r - bounds.s.r + 1;
  const capped = !showAll && totalRows > ROW_CAP;

  // sheet_to_html has no row limit, so narrow the sheet's own range instead.
  const range = capped
    ? { s: bounds.s, e: { c: bounds.e.c, r: bounds.s.r + ROW_CAP - 1 } }
    : bounds;
  const sheet = { ...original, '!ref': XLSX.utils.encode_range(range) };

  // Removed inline rather than by an observer: SheetJS is synchronous, so a
  // MutationObserver armed after this call would never see the change (the
  // docx page can use one only because mammoth is async).
  document.getElementById('status')?.remove();

  const table = XLSX.utils.sheet_to_html(sheet);
  // sheet_to_html returns a whole document; we only want the table element.
  const body = table.slice(table.indexOf('<table'), table.lastIndexOf('</table>') + 8);

  const container = document.getElementById('sheet');
  container.innerHTML = body;

  // One <tr> per row of `range`, in order, so the classes line up by index.
  const classes = classifyRows(original, range);
  const rows = container.querySelectorAll('tr');
  for (let i = 0; i < rows.length; i += 1) {
    if (classes[i]) rows[i].className = classes[i];
  }

  const note = document.getElementById('note');
  if (capped) {
    note.innerHTML = '';
    note.append(fill(labels.rowsTruncated, { total: totalRows, shown: ROW_CAP }) + ' ');
    const button = document.createElement('button');
    button.textContent = labels.showAll;
    button.onclick = () => renderSheet(name, true);
    note.appendChild(button);
  } else {
    // The count is what is on screen, not what `!ref` claims — saying "988 rows"
    // over a 51-row sheet was the stored extent talking.
    const shown = classes.filter((cls) => cls !== 'hide').length;
    note.textContent = fill(labels.rows, { count: shown });
  }
}

function renderTabs(active) {
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';
  // One sheet needs no tab strip — it would just take reading space.
  if (workbook.SheetNames.length < 2) return;
  for (const name of workbook.SheetNames) {
    const button = document.createElement('button');
    button.textContent = name;
    button.className = name === active ? 'tab active' : 'tab';
    button.onclick = () => {
      renderTabs(name);
      renderSheet(name, false);
    };
    tabs.appendChild(button);
  }
}

try {
  // cellNF keeps the number-format string on each cell, which is what the era
  // detection above reads.
  workbook = XLSX.read(base64ToArrayBuffer(window.CONFIG.base64), {
    type: 'array',
    cellNF: true,
    cellStyles: true,
  });
  for (const name of workbook.SheetNames) {
    applyJapaneseEra(workbook.Sheets[name]);
    // Must run after the era shim, which replaces `w` wholesale.
    ensureNegativeSign(workbook.Sheets[name]);
  }
  const first = workbook.SheetNames[0];
  renderTabs(first);
  renderSheet(first, false);
  post({ type: 'ready' });
} catch (error) {
  post({ type: 'error', message: String((error && error.message) || error) });
}
