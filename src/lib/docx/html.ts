// The HTML page for the docx WebView (FR-42). Mirrors src/lib/cm/html.ts in
// shape (a CONFIG object plus an inlined bundle) but is a separate page on
// purpose: mammoth must not be loaded by anyone opening a Markdown file
// (FR-21, per-format bundles).
//
// The CSS is where "more readable than the Files app's QuickLook" is earned.
// mammoth hands over meaning and no presentation — no fonts, no borders — so
// everything below is ours to decide, which cuts both ways: nothing is
// inherited, and nothing is imposed.
//
// Not yet applied: the per-run CJK/Latin size harmonisation the Markdown editor
// does with inline font-size spans (WKWebView ignores @font-face size-adjust —
// see the note in cm/html.ts). Worth revisiting once real documents show
// whether the mismatch is noticeable here.

import { DOCX_BUNDLE } from './bundle';

export type DocxTheme = {
  bg: string;
  fg: string;
  muted: string;
  codeBg: string;
  base: number;
};

export function buildDocxHtml({
  base64,
  theme,
  loadingLabel,
}: {
  base64: string;
  theme: DocxTheme;
  /** Localized placeholder shown until the conversion writes into the page. */
  loadingLabel: string;
}): string {
  const config = JSON.stringify({ base64 });
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  :root {
    --bg: ${theme.bg};
    --fg: ${theme.fg};
    --muted: ${theme.muted};
    --codeBg: ${theme.codeBg};
  }
  html, body {
    margin: 0; padding: 0;
    background: var(--bg); color: var(--fg);
    -webkit-text-size-adjust: 100%;
  }
  #doc {
    /* Same reading-width cap as FR-16 uses for Markdown, so a wide iPad does
       not stretch lines past a comfortable measure. */
    max-width: 42em;
    margin: 0 auto;
    padding: 10px 16px 48px;
    font-family: "SF Pro Text", -apple-system, "Hiragino Kaku Gothic ProN", sans-serif;
    font-size: ${theme.base}px;
    line-height: 1.75;
    word-wrap: break-word;
  }
  #doc h1 { font-size: 1.6em; line-height: 1.3; margin: 1.4em 0 0.5em; }
  #doc h2 { font-size: 1.35em; line-height: 1.35; margin: 1.3em 0 0.5em; }
  #doc h3 { font-size: 1.15em; margin: 1.2em 0 0.4em; }
  #doc h4, #doc h5, #doc h6 { font-size: 1em; margin: 1.1em 0 0.4em; }
  #doc p { margin: 0 0 0.9em; }
  #doc ul, #doc ol { padding-left: 1.4em; margin: 0 0 0.9em; }
  #doc li { margin: 0.2em 0; }
  #doc a { color: inherit; }
  /* Word's borders do not survive the conversion, so draw our own — a bare
     mammoth table is unreadable without them. */
  #doc table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.92em; }
  #doc th, #doc td { border: 1px solid var(--muted); padding: 6px 8px; text-align: left; vertical-align: top; }
  #doc th { background: var(--codeBg); font-weight: 600; }
  /* mammoth wraps every cell's text in <p>, whose bottom margin would pad the
     row out; and it emits no <th> at all (Word has no semantic header row
     unless tblHeader is set, so the first row arrives as <td><strong>). The
     first-row rule below is therefore what actually styles headers. */
  #doc td > p, #doc th > p { margin: 0; }
  #doc tr:first-child > td { background: var(--codeBg); }
  #doc img { max-width: 100%; height: auto; }
  #doc blockquote {
    margin: 1em 0; padding: 0.2em 0 0.2em 1em;
    border-left: 3px solid var(--muted); color: var(--muted);
  }
  #status { padding: 10px 16px 16px; color: var(--muted); font-family: -apple-system, sans-serif; }
</style>
</head>
<body>
<div id="status">${loadingLabel}</div>
<div id="doc"></div>
<script>window.CONFIG = ${config};</script>
<script>${DOCX_BUNDLE}</script>
<script>
  // Clear the placeholder once the bundle has written into #doc. mammoth is
  // async, so the observer is armed before the conversion finishes; a format
  // whose parser is synchronous would need the removal inline instead.
  new MutationObserver(function () {
    var s = document.getElementById('status');
    if (s && document.getElementById('doc').childNodes.length > 0) s.remove();
  }).observe(document.getElementById('doc'), { childList: true });
</script>
</body>
</html>`;
}
