// The HTML page for the xlsx WebView (FR-43). Third bundle, same reasoning as
// docx: keeping it separate is what stops the Markdown path from carrying
// SheetJS (FR-21).
//
// sheet_to_html emits a bare <table> with no styling at all — no borders, no
// header row, no cell colours. Everything that makes a spreadsheet legible on a
// phone is below, which is the same bargain mammoth offers: we get meaning, and
// the presentation is ours to write.
//
// Cell fills and red negatives are NOT restored yet. Verified as feasible
// against a real workbook — every <td> carries id="sjs-<address>", so a colour
// map keyed by address resolves 1:1 and costs a few KB — but deferred until
// real use says whether their absence actually hurts (FR-43).

import { XLSX_BUNDLE } from "./bundle";

export type XlsxTheme = {
  bg: string;
  fg: string;
  muted: string;
  codeBg: string;
  tint: string;
  base: number;
};

export type XlsxLabels = {
  /** "{{count}} rows" */
  rows: string;
  /** "Showing the first {{shown}} of {{total}} rows" */
  rowsTruncated: string;
  /** Button that drops the row cap. */
  showAll: string;
};

export function buildXlsxHtml({
  base64,
  theme,
  labels,
  loadingLabel,
}: {
  base64: string;
  theme: XlsxTheme;
  labels: XlsxLabels;
  loadingLabel: string;
}): string {
  const config = JSON.stringify({ base64, labels });
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    --bg: ${theme.bg};
    --fg: ${theme.fg};
    --muted: ${theme.muted};
    --codeBg: ${theme.codeBg};
    --tint: ${theme.tint};
  }
  html, body {
    margin: 0; padding: 0;
    background: var(--bg); color: var(--fg);
    font-family: "SF Pro Text", -apple-system, "Hiragino Kaku Gothic ProN", sans-serif;
    -webkit-text-size-adjust: 100%;
  }
  /* Sheet tabs pin to the top: on a spreadsheet the sheet you are looking at is
     context you need while scrolling, unlike a document's title. */
  #tabs {
    position: sticky; top: 0; z-index: 2;
    display: flex; gap: 6px; overflow-x: auto;
    padding: 10px 12px 8px;
    background: var(--bg);
    border-bottom: 1px solid var(--codeBg);
  }
  .tab {
    flex: 0 0 auto;
    font: inherit; font-size: 13px;
    padding: 6px 12px; border-radius: 14px;
    border: 1px solid var(--codeBg); background: var(--codeBg); color: var(--muted);
  }
  .tab.active { background: var(--tint); border-color: var(--tint); color: #fff; font-weight: 600; }
  #note { padding: 8px 12px; font-size: 12px; color: var(--muted); }
  #note button {
    font: inherit; font-size: 12px; margin-left: 8px;
    padding: 4px 10px; border-radius: 12px;
    border: 1px solid var(--tint); background: transparent; color: var(--tint);
  }
  /* The grid scrolls horizontally on its own so the page never does — a wide
     sheet must not drag the tabs off screen. */
  #sheet { overflow-x: auto; padding: 0 12px 40px; }
  #sheet table { border-collapse: collapse; font-size: ${Math.max(12, theme.base - 3)}px; }
  #sheet td {
    border: 1px solid var(--codeBg);
    padding: 5px 9px; white-space: nowrap;
    max-width: 20em; overflow: hidden; text-overflow: ellipsis;
  }
  /* No header-row styling. SheetJS emits no <th>, and the spike filled the gap
     by treating row 1 as one — which a real workbook immediately disproved: its
     first row was the sheet's title (■収支計画表), and on another sheet it was
     blank. Shading and pinning a row that is not a header states something
     false about the data, so nothing is assumed. Where a header exists at all
     it is usually several rows down, and finding it is guesswork we would be
     wrong about often enough to be worse than doing nothing. */
  #status { padding: 10px 16px 16px; color: var(--muted); }
</style>
</head>
<body>
<div id="status">${loadingLabel}</div>
<div id="tabs"></div>
<div id="note"></div>
<div id="sheet"></div>
<script>window.CONFIG = ${config};</script>
<script>${XLSX_BUNDLE}</script>
</body>
</html>`;
}
