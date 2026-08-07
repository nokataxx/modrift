// Runs inside the xlsx WebView (FR-43): parses the workbook with SheetJS,
// renders one sheet at a time as an HTML table, and offers tabs to switch
// sheets. A third bundle, for the same reason docx has its own — the Markdown
// path must not carry SheetJS (FR-21).
//
// The Japanese era shim below is the reason this file is not just a call to
// sheet_to_html. SheetJS CE's SSF does not implement 和暦:
// `[$-411]ggge"年"m"月"d"日"` comes out as "ggg2026年4月1日" (era tokens
// emitted literally, year Gregorian) and `[$-411]ge.m.d` makes SSF throw, after
// which sheet_to_html falls back to the raw serial number. The era data is in
// the JS engine already (Intl's japanese calendar), so the display strings can
// be rewritten after parsing.
import * as XLSX from '@e965/xlsx';

// Rendering every row of a big sheet blows up the DOM. Start capped and let the
// reader ask for the rest (FR-43).
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

// True when a number format asks for a Japanese era. Quoted literals and the
// leading [$-411] locale tag are stripped first, so the "g" in a literal like
// "gross" cannot trigger it.
//
// "General" has to be excluded explicitly, and getting this wrong is not
// subtle: General is the default format, so a bare /g/ test rewrites every
// plain number in the workbook into a date (3004 cells against the 4 that
// actually wanted an era, when this was first written).
function isEraFormat(z) {
  if (typeof z !== 'string') return false;
  const bare = z.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
  if (/general/i.test(bare)) return false;
  return /g/i.test(bare);
}

const eraParts = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', {
  era: 'long',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

// Excel serial → Date. Serial 1 is 1900-01-01 with the well-known 1900
// leap-year bug, which the 1899-12-30 epoch absorbs for every date after
// 1900-03-01.
function serialToDate(serial) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
}

// Rewrite the display string of every era-formatted cell. Only `w` is touched —
// the underlying value stays exactly as SheetJS read it.
//
// A normaliser, not a formatter: `ge.m.d` (which Excel shows as "R8.4.1") also
// comes out as 令和8年4月1日. Far better than a raw serial number, but not
// "what Excel showed" — interpreting g/gg/ggg/e/ee is left until a real
// document asks for it (FR-43).
function applyJapaneseEra(worksheet) {
  for (const ref of Object.keys(worksheet)) {
    if (ref.startsWith('!')) continue;
    const cell = worksheet[ref];
    if (!cell || cell.t !== 'n' || !isEraFormat(cell.z)) continue;
    try {
      const parts = eraParts.formatToParts(serialToDate(cell.v));
      const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
      cell.w = `${get('era')}${get('year')}年${get('month')}月${get('day')}日`;
    } catch {
      // Leave SheetJS's own output alone if anything goes wrong.
    }
  }
}

const labels = window.CONFIG.labels;
let workbook = null;

function fill(template, values) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]);
}

function renderSheet(name, showAll) {
  const original = workbook.Sheets[name];
  const range = XLSX.utils.decode_range(original['!ref'] ?? 'A1:A1');
  const totalRows = range.e.r - range.s.r + 1;
  const capped = !showAll && totalRows > ROW_CAP;

  // sheet_to_html has no row limit, so narrow the sheet's own range instead.
  let sheet = original;
  if (capped) {
    sheet = { ...original };
    sheet['!ref'] = XLSX.utils.encode_range({
      s: range.s,
      e: { c: range.e.c, r: range.s.r + ROW_CAP - 1 },
    });
  }

  // Removed inline rather than by an observer: SheetJS is synchronous, so a
  // MutationObserver armed after this call would never see the change (the
  // docx page can use one only because mammoth is async).
  document.getElementById('status')?.remove();

  const table = XLSX.utils.sheet_to_html(sheet);
  // sheet_to_html returns a whole document; we only want the table element.
  const body = table.slice(table.indexOf('<table'), table.lastIndexOf('</table>') + 8);
  document.getElementById('sheet').innerHTML = body;

  const note = document.getElementById('note');
  if (capped) {
    note.innerHTML = '';
    note.append(fill(labels.rowsTruncated, { total: totalRows, shown: ROW_CAP }) + ' ');
    const button = document.createElement('button');
    button.textContent = labels.showAll;
    button.onclick = () => renderSheet(name, true);
    note.appendChild(button);
  } else {
    note.textContent = fill(labels.rows, { count: totalRows });
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
  for (const name of workbook.SheetNames) applyJapaneseEra(workbook.Sheets[name]);
  const first = workbook.SheetNames[0];
  renderTabs(first);
  renderSheet(first, false);
  post({ type: 'ready' });
} catch (error) {
  post({ type: 'error', message: String((error && error.message) || error) });
}
