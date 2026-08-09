// Fixes to the display strings SheetJS produces (FR-43).
//
// Both shims here follow the same rule: they rewrite `w` — the string a cell
// shows — and never touch `v`, the value. Pure functions, no DOM, so they can be
// checked against a real workbook with node.
//
// `w` is meant to be "what Excel showed", and twice it is not.

// --- Japanese era -----------------------------------------------------------

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

/**
 * SheetJS CE's SSF does not implement 和暦: `[$-411]ggge"年"m"月"d"日"` comes
 * out as "ggg2026年4月1日" (era tokens emitted literally, year Gregorian) and
 * `[$-411]ge.m.d` makes SSF throw, after which sheet_to_html falls back to the
 * raw serial number. The era data is in the JS engine already, so rewrite the
 * display string after parsing.
 *
 * A normaliser, not a formatter: `ge.m.d` (which Excel shows as "R8.4.1") also
 * comes out as 令和8年4月1日. Far better than a raw serial, but not "what Excel
 * showed" — interpreting g/gg/ggg/e/ee is left until a document asks for it.
 */
export function applyJapaneseEra(worksheet) {
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

// --- Negative numbers whose only sign was a colour ---------------------------

// Anything that already tells a reader the number is negative: a hyphen-minus,
// a real minus sign, the Japanese accounting triangles, or accounting
// parentheses.
const SIGNED = /[-−▲△()（）]/;

/**
 * Put the sign back on negative numbers that lost it.
 *
 * Excel number formats are sectioned `positive;negative;zero;text`, and the
 * negative section decides how a negative number reads. `#,###;[Red]\-#,###`
 * writes the minus itself, so nothing is lost. But `#,##0;[Red]#,##0` is just
 * as common, and there the negative section has **no sign at all** — Excel
 * shows `106,500` and the redness is the only thing that says it is negative.
 *
 * sheet_to_html emits no colour, so that cell would read as a positive number.
 * That is not a cosmetic loss like a missing fill: it inverts the value. A
 * viewer may show less than Excel, but it must not show something different.
 *
 * Detection reads the produced string rather than the format code, so it does
 * not matter how the author wrote the format, how many sections it has, or
 * which of SSF's paths produced the text — if the number is negative and
 * nothing in the string says so, the sign is missing.
 *
 * The minus goes before the first non-space character so that the padding some
 * formats add for column alignment (`_ `) survives.
 */
export function ensureNegativeSign(worksheet) {
  let fixed = 0;
  for (const ref of Object.keys(worksheet)) {
    if (ref.startsWith('!')) continue;
    const cell = worksheet[ref];
    if (!cell || cell.t !== 'n' || !(cell.v < 0)) continue;
    if (typeof cell.w !== 'string' || cell.w.trim() === '') continue;
    if (SIGNED.test(cell.w)) continue;
    cell.w = cell.w.replace(/^(\s*)/, '$1-');
    fixed += 1;
  }
  return fixed;
}
