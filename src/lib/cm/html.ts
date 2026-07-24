// Builds the HTML document for Modrift's CodeMirror Markdown editor, loaded
// inside a WebView for both reading and editing (FR-20 live preview). The editor
// logic is in editor-entry.mjs, bundled offline into CM_BUNDLE (build-bundle.mjs)
// — CDN imports failed to dedupe @codemirror/state, which left the syntax tree
// empty, so we inline a single self-contained bundle instead.
//
// Typography is fixed: SF Pro for Latin, Hiragino Kaku Gothic for Japanese (the
// system pairing Apple tunes to sit together). Latin runs are pushed to SF via
// the .cm-lat decoration because -apple-system also covers Japanese — if it led
// the family the browser would render Japanese with it and never reach Hiragino.

import { CM_BUNDLE } from "./bundle";

export type CmTheme = {
  bg: string;
  fg: string;
  tint: string;
  /** Style-preset accent for links + task checkboxes (falls back to tint). */
  link?: string;
  /** When true, code-block syntax highlighting is greyscale (mono preset). */
  codeMono?: boolean;
  sel: string;
  codeBg: string;
  muted: string;
  h1: string;
  h2: string;
  h3: string;
  h4: string;
  base: number;
};

const LATIN = `-apple-system, sans-serif`;
const JP = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif`;
// Heading Latin is cap-dominated and SF caps (~0.72em) are shorter than the
// kanji body (~0.88em), so lift heading Latin to match.
const HEAD_SCALE = 1.2;

export function buildEditorHtml(opts: {
  content: string;
  editable: boolean;
  theme: CmTheme;
  // Placeholder template for non-https images, with "__F__" where the filename
  // goes — e.g. "[Image: __F__]" (from i18n, so it's localized).
  imagePlaceholder?: string;
  // When true, tapping a task checkbox toggles it (only for savable files).
  taskInteractive?: boolean;
  // Preview mode (settings screen): trims the scroller's bottom padding so a
  // short sample fits its card without the reading surface's scroll margin.
  compact?: boolean;
  // Extra top padding (px) so the first lines clear the transparent, floating
  // header (FR-38 hide-on-scroll). It scrolls away with the content, so the only
  // place it shows is at the very top — where the header is shown anyway.
  topInset?: number;
}): string {
  const config = JSON.stringify(opts).replace(/</g, "\\u003c");
  const padBottom = opts.compact ? 12 : 34;
  const padTop = 10 + (opts.topInset ?? 0);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  :root { color-scheme: light dark; }
  /* No fixed heights: the editor grows to its content and the PAGE scrolls,
     via WKWebView's native UIScrollView. An inner .cm-scroller overflow div
     kills fling momentum on iOS whenever CodeMirror redraws or corrects the
     scroll position mid-scroll; native page scrolling survives that churn. */
  html, body, #editor { margin: 0; padding: 0; }

  body {
    background: var(--bg); color: var(--fg); -webkit-text-size-adjust: 100%;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }
  .cm-editor { background: transparent; }
  .cm-editor.cm-focused { outline: none; }
  /* Base family is the Japanese font (so Japanese picks it); Latin runs are
     pushed to SF by .cm-lat below. */
  .cm-scroller {
    font-family: ${JP};
    line-height: 1.55; letter-spacing: -0.006em;
    /* Proportional kana/punctuation — without palt, Japanese is set full-width
       (monospaced) and brackets/commas leave big gaps. Reliable on iOS WebKit. */
    font-feature-settings: "palt" 1;
  }
  .cm-lat { font-family: ${LATIN}; font-size: 1em; }
  .cm-h1 .cm-lat, .cm-h2 .cm-lat, .cm-h3 .cm-lat,
  .cm-h4 .cm-lat, .cm-h5 .cm-lat, .cm-h6 .cm-lat { font-size: ${HEAD_SCALE}em; }
  /* A space adjacent to CJK, narrowed so inline Latin doesn't float. */
  .cm-tsp { font-size: 0.34em; }
  .cm-content {
    font-size: var(--base);
    padding: ${padTop}px 10px ${padBottom}px 10px !important;
    caret-color: var(--tint) !important;
    /* FR-16 (iPad / large screens): cap the text measure and centre it so lines
       stay readable instead of running edge-to-edge. em-based so the column
       scales with the font size; a no-op on phones (screen < the cap).
       !important beats CodeMirror's baseTheme margin:0 on .cm-content, which
       loads after this and would otherwise left-align the column. */
    max-width: 42em;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  /* FR-36: a phone held in landscape drops the cap and uses the full width —
     widening the measure is the whole point of rotating. Keyed on viewport
     height, not width: a landscape phone is short (<=500px tall) while a
     landscape iPad is not, so iPad keeps its FR-16 reading column. */
  @media (orientation: landscape) and (max-height: 500px) {
    .cm-content { max-width: none; }
  }
  /* CodeMirror's baseTheme adds .cm-line { padding: 0 2px 0 6px } after our
     styles — zero it so our own horizontal padding is the only source. */
  .cm-line { padding-left: 0 !important; padding-right: 0 !important; }
  /* Read-only (preview): hide the caret. !important to beat .cm-content above. */
  body.readonly .cm-content { caret-color: transparent !important; }
  ::selection { background: var(--sel); }
  /* Transient search-match highlight (FR-15). Amber reads as "find" in both
     light and dark; translucent so the text underneath stays legible. */
  .cm-search-hl { background: rgba(255, 204, 0, 0.42); border-radius: 2px; }

  /* Headings — size + colour carry the hierarchy, no bold weight. */
  .cm-h1 { font-size: 1.6em;  font-weight: 500; letter-spacing: -0.012em; line-height: 1.25; color: var(--h1); padding-top: 2px; }
  .cm-h2 { font-size: 1.3em;  font-weight: 500; letter-spacing: -0.008em; line-height: 1.3;  color: var(--h2); padding-top: 12px; }
  .cm-h3 { font-size: 1.13em; font-weight: 500; line-height: 1.35; color: var(--h3); padding-top: 8px; }
  .cm-h4 { font-size: 1.03em; font-weight: 500; color: var(--h4); padding-top: 6px; }
  .cm-h5 { font-size: 1em;    font-weight: 500; color: var(--h4); }
  .cm-h6 { font-size: 0.95em; font-weight: 500; color: var(--h4); }

  .cm-strong { font-weight: 700; }
  .cm-em { font-style: italic; }
  .cm-link {
    color: var(--link); text-decoration: underline;
    text-decoration-thickness: 1px; text-underline-offset: 3px;
  }
  .cm-code {
    font-family: ui-monospace, "SF Mono", monospace; font-size: 0.86em;
    background: var(--codeBg); border-radius: 5px; padding: 0.12em 0.38em;
  }
  .cm-bullet { color: var(--fg); }
  .cm-strike { text-decoration: line-through; opacity: 0.7; }
  /* List items get roomier lines than prose (matches the native renderer's
     list lineHeight of base×1.65 — consecutive items need breathing room). */
  .cm-li { line-height: 1.72; }

  /* GFM task checkbox — muted outline when empty, tint fill + a cut-out check
     when done (mirrors the native taskList styling). */
  /* Empty inline-block box; its baseline never changes with content, so checked
     and unchecked always sit at the same height. */
  .cm-task {
    display: inline-block; position: relative; box-sizing: border-box;
    width: 1.05em; height: 1.05em;
    border: 1.5px solid var(--muted); border-radius: 3px;
    vertical-align: -0.16em; margin-right: 0.35em;
  }
  .cm-task-on { background: var(--link); border-color: var(--link); }
  .cm-task-tap { cursor: pointer; }
  /* Checkmark drawn with borders, absolutely positioned so it never affects the
     box's baseline (which would shift checked boxes out of alignment). */
  .cm-task-on::after {
    content: ""; position: absolute; left: 50%; top: 47%;
    width: 0.26em; height: 0.5em;
    border: solid var(--bg); border-width: 0 0.14em 0.14em 0;
    transform: translate(-50%, -58%) rotate(45deg);
  }

  /* Horizontal rule — thin divider (native uses the textSecondary tone). */
  .cm-hrline { line-height: 1.1; }
  .cm-hr {
    display: block; width: 100%; height: 0;
    border-top: 1px solid var(--muted); margin: 0.1em 0;
  }

  /* Images — https render inline; local/relative show "[Image: name]" text. */
  .cm-img {
    display: block; max-width: 100%; height: auto;
    border-radius: 8px; margin: 0.4em 0;
  }
  .cm-img-ph { color: var(--muted); }

  /* GFM table — thin bordered grid, no header shading (matches native). */
  .cm-table-wrap { margin: 0.4em 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .cm-table { border-collapse: collapse; width: 100%; }
  .cm-table th, .cm-table td {
    border: 1px solid var(--muted); padding: 6px 10px; text-align: left;
  }
  .cm-table thead th { font-weight: 600; }

  /* Blockquote — straight accent bar (left corners square), rounded right side.
     The bar follows the style preset's accent (mono → grey, colorful → teal). */
  .cm-quote {
    background: var(--codeBg); box-shadow: inset 3px 0 0 var(--link);
    padding-left: 20px !important; padding-right: 14px !important;
  }
  .cm-quote-first { border-radius: 0 8px 0 0; padding-top: 12px !important; }
  .cm-quote-last { border-radius: 0 0 8px 0; padding-bottom: 12px !important; }

  /* Code block — rounded card, roomy padding, syntax colours via highlight. */
  .cm-cb {
    font-family: ui-monospace, "SF Mono", monospace; font-size: 0.86em;
    background: var(--codeBg); padding-left: 14px !important; padding-right: 14px !important;
  }
  .cm-cb-first { border-radius: 10px 10px 0 0; padding-top: 12px; }
  .cm-cb-last { border-radius: 0 0 10px 10px; padding-bottom: 12px; }
</style>
</head>
<body>
<div id="editor"></div>
<script>window.CONFIG = ${config};</script>
<script>${CM_BUNDLE}</script>
</body>
</html>`;
}
