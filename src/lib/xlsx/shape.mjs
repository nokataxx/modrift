// Turns a worksheet's stored extent into the part a reader actually wants
// (FR-43). Pure functions, no DOM — so they can be checked against a real
// workbook with node before going anywhere near the device.
//
// sheet_to_html renders `!ref` verbatim, and `!ref` is not the shape of the
// document. In the workbook this was written against, one sheet declares 988
// rows and stops having content at row 51: the remaining 937 carry formatting
// only, and Excel never shows them as anything. A second sheet opens with 11
// blank rows above its title, so the first screenful was empty. A third hides
// 35 rows — `hidden="1"` with `outlineLevel="1"`, i.e. outline groups the
// author collapsed, holding the template sections they chose not to fill in.
// Rendering all of that faithfully reproduces the file and misrepresents the
// document.

import * as XLSX from '@e965/xlsx';

/** A cell counts as content only if it carries a value; style-only cells do not. */
function hasValue(cell) {
  return !!cell && cell.v !== undefined && String(cell.v).trim() !== '';
}

/**
 * The tight box around the cells that have values, plus any merge anchored on
 * one (a merged title is content across its whole span, even though only the
 * anchor holds the string).
 *
 * Walks the cell keys rather than the declared range: the declared range is the
 * thing we distrust, and on a sheet padded to 16384 columns walking it would
 * cost more than the parse.
 */
export function contentBounds(worksheet) {
  const declared = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1:A1');
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;
  const see = (r, c) => {
    if (r < minRow) minRow = r;
    if (r > maxRow) maxRow = r;
    if (c < minCol) minCol = c;
    if (c > maxCol) maxCol = c;
  };

  for (const ref of Object.keys(worksheet)) {
    if (ref.startsWith('!')) continue;
    if (!hasValue(worksheet[ref])) continue;
    const { r, c } = XLSX.utils.decode_cell(ref);
    see(r, c);
  }
  if (maxRow === -Infinity) return declared; // Nothing to go on; leave it alone.

  for (const merge of worksheet['!merges'] ?? []) {
    if (!hasValue(worksheet[XLSX.utils.encode_cell(merge.s)])) continue;
    see(merge.s.r, merge.s.c);
    see(merge.e.r, merge.e.c);
  }

  // Never widen past what the sheet claims.
  return {
    s: { r: Math.max(minRow, declared.s.r), c: Math.max(minCol, declared.s.c) },
    e: { r: Math.min(maxRow, declared.e.r), c: Math.min(maxCol, declared.e.c) },
  };
}

/**
 * How each row in `range` should be treated:
 *
 *   'hide'   — drop it entirely (outline-collapsed, or a blank continuing a run)
 *   'spacer' — the first blank of a run, kept as a thin gap
 *   ''       — render normally
 *
 * Blank runs collapse to one thin row rather than vanishing, because in this
 * workbook the gaps carry the grouping: without them ■企業概要 and its rows run
 * straight into ■事業内容. One gap says the same thing as sixteen.
 *
 * Rows are marked, never removed. A removed <tr> would have to be paid for by
 * rewriting every rowspan crossing it — the title on the first sheet spans
 * three rows, two of which read as blank — and getting that wrong shears the
 * table apart. Marking leaves the table's structure to the browser.
 */
export function classifyRows(worksheet, range) {
  const valued = new Set();
  for (const ref of Object.keys(worksheet)) {
    if (ref.startsWith('!')) continue;
    if (!hasValue(worksheet[ref])) continue;
    valued.add(XLSX.utils.decode_cell(ref).r);
  }
  // A row under a vertical merge is occupied even with no cell of its own.
  for (const merge of worksheet['!merges'] ?? []) {
    if (!hasValue(worksheet[XLSX.utils.encode_cell(merge.s)])) continue;
    for (let r = merge.s.r; r <= merge.e.r; r += 1) valued.add(r);
  }

  const rowMeta = worksheet['!rows'] ?? [];
  const classes = [];
  let inBlankRun = false;
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    if (rowMeta[r]?.hidden) {
      classes.push('hide');
      continue; // Leaves inBlankRun alone: a collapsed group is not a gap.
    }
    if (valued.has(r)) {
      inBlankRun = false;
      classes.push('');
      continue;
    }
    classes.push(inBlankRun ? 'hide' : 'spacer');
    inBlankRun = true;
  }
  return classes;
}

// `!cols` is deliberately not applied, and it is worth saying why here, because
// this is where the next person will try it.
//
// The columns are laid out `auto` with `white-space: nowrap`, so every column is
// already exactly as wide as its widest cell. A <colgroup> width in an auto
// layout is a floor, never a ceiling: it can widen a column past its content but
// can never pull one below it. Since the stored widths are narrower than the
// content on the sheets that matter, applying them changes nothing — measured,
// not assumed: before and after screenshots of the same sheet were identical to
// the pixel, and the only width that came back was the empty leading column that
// contentBounds now trims.
//
// Making them bind would take `table-layout: fixed`, which clips instead: Excel
// stores 17px for a column holding 販売一般管理費 and gets away with it by
// spilling the text across the empty cells beside it, which a table cannot do.
// A viewer that ellipsises the labels is worse than one that scrolls.
