// Modrift's Markdown editor, run inside a WebView. Bundled by esbuild into a
// single IIFE (build-bundle.mjs → bundle.ts) so there is exactly one
// @codemirror/state instance — CDN imports failed to dedupe it, leaving the
// syntax tree empty. Reads window.CONFIG (content, editable, theme), renders a
// CodeMirror live-preview editor, and talks to React Native over postMessage:
// posts {ready}, {change} (with undo/redo depth), {error}; exposes
// window.__cmUndo/__cmRedo/__cmSetDoc for the RN header buttons and reloads.
import {
  EditorView,
  Decoration,
  ViewPlugin,
  WidgetType,
  keymap,
} from "@codemirror/view";
import { EditorState, Compartment, StateField, StateEffect } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { javascript } from "@codemirror/lang-javascript";
import {
  syntaxTree,
  ensureSyntaxTree,
  indentOnInput,
  LanguageDescription,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags as tg } from "@lezer/highlight";
import {
  history,
  defaultKeymap,
  historyKeymap,
  undo,
  redo,
  undoDepth,
  redoDepth,
} from "@codemirror/commands";

// Tasteful dark-mode code palette (GitHub-dark-ish). Colours only apply inside
// fenced code (parsed via the JS nested language); prose styling is handled by
// the live-preview decorations. (Light-mode palette tuned in real impl.)
const codeHighlight = HighlightStyle.define([
  { tag: tg.keyword, color: "#FF7B72" },
  { tag: [tg.string, tg.special(tg.string)], color: "#A5D6FF" },
  { tag: [tg.number, tg.bool, tg.null], color: "#79C0FF" },
  { tag: tg.comment, color: "#8B949E", fontStyle: "italic" },
  { tag: [tg.function(tg.variableName), tg.function(tg.propertyName)], color: "#D2A8FF" },
  { tag: [tg.propertyName, tg.variableName], color: "#79C0FF" },
  { tag: [tg.typeName, tg.className], color: "#FFA657" },
  { tag: [tg.operator, tg.punctuation], color: "#C9D1D9" },
]);

// Monochrome variant for the "mono" style preset — no hues. Tokens are kept
// legible via weight/italic and a two-step grey (body vs muted), and use CSS
// vars so light/dark both resolve correctly.
const codeHighlightMono = HighlightStyle.define([
  { tag: tg.keyword, color: "var(--fg)", fontWeight: "600" },
  { tag: [tg.string, tg.special(tg.string)], color: "var(--muted)" },
  { tag: [tg.number, tg.bool, tg.null], color: "var(--fg)" },
  { tag: tg.comment, color: "var(--muted)", fontStyle: "italic" },
  {
    tag: [tg.function(tg.variableName), tg.function(tg.propertyName)],
    color: "var(--fg)",
    fontWeight: "600",
  },
  { tag: [tg.propertyName, tg.variableName], color: "var(--fg)" },
  { tag: [tg.typeName, tg.className], color: "var(--fg)", fontWeight: "600" },
  { tag: [tg.operator, tg.punctuation], color: "var(--muted)" },
]);

const codeLanguages = [
  LanguageDescription.of({
    name: "javascript",
    alias: ["js", "jsx", "ts", "tsx", "typescript"],
    load: async () => javascript(),
  }),
];

// Japanese/CJK range: kana, kanji (+ ext-A), CJK punctuation, fullwidth forms.
const CJK = /[　-〿぀-ヿ㐀-鿿豈-﫿＀-￯]/;

// Below this document size we decorate the WHOLE document instead of only the
// visible range, so scrolling never triggers a decoration rebuild. That rebuild,
// running on every viewport move during a fling, churns the DOM and — when the
// editor is an active (focused) contentEditable — makes WebKit reconcile the
// editable selection, which kills scroll momentum ("カチン") in edit mode.
// Whole-doc decoration costs more per keystroke, so it's capped to small/medium
// files; larger ones keep the visible-range behaviour (rarer, and any stall is
// proportional to the doc anyway).
const WHOLE_DOC_DECORATE_LIMIT = 20000;

function post(o) {
  try {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(o));
  } catch {
    // ignore
  }
}

function selTouches(state, from, to) {
  for (const r of state.selection.ranges) {
    if (r.from <= to && r.to >= from) return true;
  }
  return false;
}
function lineTouched(state, pos) {
  const line = state.doc.lineAt(pos);
  return selTouches(state, line.from, line.to);
}
function addLineClass(widgets, state, from, to, cls) {
  const firstLine = state.doc.lineAt(from).number;
  const lastLine = state.doc.lineAt(to).number;
  for (let n = firstLine; n <= lastLine; n++) {
    const line = state.doc.line(n);
    let c = cls;
    if (n === firstLine) c += " " + cls + "-first";
    if (n === lastLine) c += " " + cls + "-last";
    widgets.push(Decoration.line({ class: c }).range(line.from));
  }
}

class BulletWidget extends WidgetType {
  toDOM() {
    const s = document.createElement("span");
    s.className = "cm-bullet";
    s.textContent = "•";
    return s;
  }
}

// GFM task list marker → a checkbox glyph. Read-only display (tapping doesn't
// toggle — the source is the truth); editing happens by revealing the source.
class CheckboxWidget extends WidgetType {
  constructor(checked) {
    super();
    this.checked = checked;
  }
  eq(o) {
    return o.checked === this.checked;
  }
  toDOM(view) {
    const s = document.createElement("span");
    // The checkmark is drawn in CSS (::after) rather than as text — a text glyph
    // gives the checked box a different baseline from the empty one, which
    // shifts it out of alignment.
    s.className = "cm-task" + (this.checked ? " cm-task-on" : "");
    // Notion-style: tap toggles [ ] <-> [x] in the source (which auto-saves).
    // The flag is read at TAP time, not attach time — taskInteractive can be
    // flipped at runtime (FR-28 edit opt-in) on an already-mounted editor, and
    // widgets built earlier must honour the new value.
    s.classList.add("cm-task-tap");
    s.addEventListener("mousedown", (e) => {
      if (!(window.CONFIG && window.CONFIG.taskInteractive)) return;
      e.preventDefault();
      e.stopPropagation();
      toggleTaskAt(view, view.posAtDOM(s));
    });
    return s;
  }
  ignoreEvent() {
    return true;
  }
}

// Flip the [ ] / [x] marker on the task line containing `pos`. Works even in
// read mode (the editor is non-editable, not read-only, so a programmatic
// dispatch still applies) — the change posts back and the file auto-saves.
function toggleTaskAt(view, pos) {
  if (pos == null) return;
  const line = view.state.doc.lineAt(pos);
  const text = view.state.doc.sliceString(line.from, line.to);
  const m = /\[[ xX]\]/.exec(text);
  if (!m) return;
  const from = line.from + m.index;
  const checked = /[xX]/.test(m[0]);
  view.dispatch({
    changes: { from, to: from + 3, insert: checked ? "[ ]" : "[x]" },
  });
}

// Horizontal rule — a full-width line replacing the "---" source.
class HrWidget extends WidgetType {
  toDOM() {
    const s = document.createElement("span");
    s.className = "cm-hr";
    return s;
  }
}

// Image: real <img> for https (FR: HTTPS images), placeholder for anything else
// (local/relative images aren't reachable from the sandboxed WebView).
class ImageWidget extends WidgetType {
  constructor(url, alt) {
    super();
    this.url = url;
    this.alt = alt;
  }
  eq(o) {
    return o.url === this.url && o.alt === this.alt;
  }
  toDOM() {
    if (/^https:\/\//.test(this.url)) {
      const img = document.createElement("img");
      img.className = "cm-img";
      img.src = this.url;
      img.alt = this.alt || "";
      return img;
    }
    const s = document.createElement("span");
    s.className = "cm-img-ph";
    const filename = this.url.split("/").pop() || this.url;
    const tpl =
      (window.CONFIG && window.CONFIG.imagePlaceholder) || "[Image: __F__]";
    s.textContent = tpl.replace("__F__", filename);
    return s;
  }
  get estimatedHeight() {
    return -1;
  }
}

const livePreview = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.build(view);
      this.tree = syntaxTree(view.state);
    }
    update(u) {
      // Rebuild only on edits, viewport moves, cursor moves (reveal/hide
      // marks), and parse progress (markdown parses async). Skipping the
      // measure-cycle updates in between matters on iOS: a full rebuild on
      // every update during a fling stalls the main thread, and WebKit kills
      // scroll momentum when the DOM churns mid-scroll.
      //
      // For small/medium docs we decorate the whole document, so a viewport
      // move (scrolling) needs NO rebuild at all — this is what removes the
      // edit-mode fling stall. Only larger docs still rebuild on viewport move.
      const tree = syntaxTree(u.state);
      const wholeDoc = u.state.doc.length <= WHOLE_DOC_DECORATE_LIMIT;
      const viewportTrigger = !wholeDoc && u.viewportChanged;
      if (u.docChanged || viewportTrigger || u.selectionSet || tree !== this.tree) {
        this.decorations = this.build(u.view);
        this.tree = syntaxTree(u.state);
      }
    }
    build(view) {
      const widgets = [];
      const state = view.state;
      const editing = !!(window.CONFIG && window.CONFIG.editable);

      // Whole-doc vs visible-range decoration (see WHOLE_DOC_DECORATE_LIMIT).
      // Decorating the whole doc means scrolling triggers no rebuild, so the
      // fling isn't stalled; only large docs fall back to the visible range.
      const ranges =
        state.doc.length <= WHOLE_DOC_DECORATE_LIMIT
          ? [{ from: 0, to: state.doc.length }]
          : view.visibleRanges;

      // Ranges the text passes below (CJK spacing, Latin sizing) must skip:
      // code (its own monospace font) and widget-replaced spans (image/HR),
      // where inline marks would clash with the replacement.
      const skipRanges = [];
      // Blockquote nesting depth per line number (for stacked bars + indent).
      const qDepth = new Map();

      for (const vr of ranges) {
        // Small budget: this runs during scrolling, and a long synchronous
        // parse here freezes the fling. Anything unparsed within the budget
        // catches up via the background parser (the tree check in update()).
        ensureSyntaxTree(state, vr.to, 20);
        syntaxTree(state).iterate({
          from: vr.from,
          to: vr.to,
          enter: (node) => {
            const name = node.name;

            // Tables are rendered as a block by tableField (below); skip the
            // whole subtree here and keep the text passes out of its range.
            if (name === "Table") {
              skipRanges.push({ from: node.from, to: node.to });
              return false;
            }

            // Headings — enlarge the line, hide the leading "# " off-cursor.
            const h = /^ATXHeading(\d)$/.exec(name);
            if (h) {
              const line = state.doc.lineAt(node.from);
              widgets.push(Decoration.line({ class: "cm-h" + h[1] }).range(line.from));
              if (!editing || !lineTouched(state, node.from)) {
                const m = /^#{1,6}\s/.exec(state.doc.sliceString(line.from, line.to));
                if (m) widgets.push(Decoration.replace({}).range(line.from, line.from + m[0].length));
              }
              return;
            }

            // Setext heading — "text\n===" (H1) or "text\n---" (H2). The text
            // line(s) are enlarged like a heading; the underline (===/---) is
            // hidden off-cursor and its line collapsed. This is why a bare line
            // of text directly above "---" (no blank line) is a heading, not a
            // horizontal rule — per CommonMark.
            const sh = /^SetextHeading(\d)$/.exec(name);
            if (sh) {
              const firstLine = state.doc.lineAt(node.from);
              const lastLine = state.doc.lineAt(node.to);
              if (lastLine.number > firstLine.number) {
                for (let n = firstLine.number; n < lastLine.number; n++) {
                  widgets.push(
                    Decoration.line({ class: "cm-h" + sh[1] }).range(state.doc.line(n).from),
                  );
                }
                // Reveal the underline whenever the cursor is anywhere in the
                // heading (text line OR the underline). A fully-replaced line is
                // atomic — you can't tap into it — so keying off the underline
                // line alone left "---" impossible to bring back; keying off the
                // whole node means tapping the visible heading text reveals it.
                if (!editing || !selTouches(state, node.from, node.to)) {
                  widgets.push(
                    Decoration.line({ class: "cm-setext-underline" }).range(lastLine.from),
                  );
                  widgets.push(Decoration.replace({}).range(lastLine.from, lastLine.to));
                }
              }
              return;
            }

            if (name === "StrongEmphasis" || name === "Emphasis") {
              const cls = name === "StrongEmphasis" ? "cm-strong" : "cm-em";
              const len = name === "StrongEmphasis" ? 2 : 1;
              widgets.push(Decoration.mark({ class: cls }).range(node.from, node.to));
              if (!editing || !selTouches(state, node.from, node.to)) {
                widgets.push(Decoration.replace({}).range(node.from, node.from + len));
                widgets.push(Decoration.replace({}).range(node.to - len, node.to));
              }
              return;
            }

            if (name === "InlineCode") {
              skipRanges.push({ from: node.from, to: node.to });
              widgets.push(Decoration.mark({ class: "cm-code" }).range(node.from, node.to));
              if (!editing || !selTouches(state, node.from, node.to)) {
                widgets.push(Decoration.replace({}).range(node.from, node.from + 1));
                widgets.push(Decoration.replace({}).range(node.to - 1, node.to));
              }
              return;
            }

            // Link — show only the [text] in link color, hide "[", "](url)".
            if (name === "Link") {
              widgets.push(Decoration.mark({ class: "cm-link" }).range(node.from, node.to));
              if (!editing || !selTouches(state, node.from, node.to)) {
                for (let c = node.node.firstChild; c; c = c.nextSibling) {
                  if (c.name === "LinkMark" || c.name === "URL") {
                    widgets.push(Decoration.replace({}).range(c.from, c.to));
                  }
                }
              }
              return;
            }

            // Blockquote — left bar + soft card. Only the OUTERMOST quote paints
            // the card (bg + rounded ends); nesting adds indent + extra bars via
            // qDepth below. Depth is tallied per line so `>>` stacks correctly.
            if (name === "Blockquote") {
              const parent = node.node.parent;
              if (!parent || parent.name !== "Blockquote") {
                addLineClass(widgets, state, node.from, node.to, "cm-quote");
              }
              const first = state.doc.lineAt(node.from).number;
              const last = state.doc.lineAt(node.to).number;
              for (let n = first; n <= last; n++) {
                qDepth.set(n, (qDepth.get(n) || 0) + 1);
              }
              return;
            }
            if (name === "QuoteMark") {
              if (!editing || !lineTouched(state, node.from)) {
                let end = node.to;
                if (state.doc.sliceString(end, end + 1) === " ") end += 1;
                widgets.push(Decoration.replace({}).range(node.from, end));
              }
              return;
            }

            // Roomier line spacing for list items (matches native lists).
            if (name === "BulletList" || name === "OrderedList") {
              addLineClass(widgets, state, node.from, node.to, "cm-li");
              return;
            }

            // Bullet list marker → "•" (ordered lists keep their number). Task
            // list items ("- [ ] …") show a checkbox instead of a bullet, so
            // suppress the bullet when a TaskMarker follows.
            if (name === "ListMark") {
              const ch = state.doc.sliceString(node.from, node.to);
              const mLine = state.doc.lineAt(node.from);
              const isTask = /^\s*[-*+]\s+\[[ xX]\]/.test(
                state.doc.sliceString(mLine.from, mLine.to),
              );
              const reveal = editing && lineTouched(state, node.from);
              if (!reveal) {
                if (isTask) {
                  // Hide the "- " so the checkbox stands alone.
                  let end = node.to;
                  if (state.doc.sliceString(end, end + 1) === " ") end += 1;
                  widgets.push(Decoration.replace({}).range(node.from, end));
                } else if (/^[-*+]$/.test(ch)) {
                  widgets.push(
                    Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to),
                  );
                }
              }
              return;
            }

            // GFM task checkbox: "[ ]" / "[x]" → checkbox glyph.
            if (name === "TaskMarker") {
              if (!editing || !lineTouched(state, node.from)) {
                const checked = /\[[xX]\]/.test(
                  state.doc.sliceString(node.from, node.to),
                );
                widgets.push(
                  Decoration.replace({ widget: new CheckboxWidget(checked) }).range(
                    node.from,
                    node.to,
                  ),
                );
              }
              return;
            }

            // Horizontal rule — replace "---" with a full-width line, and give
            // the line a tight height so it doesn't leave a big gap.
            if (name === "HorizontalRule") {
              skipRanges.push({ from: node.from, to: node.to });
              const line = state.doc.lineAt(node.from);
              widgets.push(Decoration.line({ class: "cm-hrline" }).range(line.from));
              if (!editing || !lineTouched(state, node.from)) {
                widgets.push(
                  Decoration.replace({ widget: new HrWidget() }).range(node.from, node.to),
                );
              }
              return;
            }

            // GFM strikethrough — hide the "~~" markers off-cursor.
            if (name === "Strikethrough") {
              widgets.push(Decoration.mark({ class: "cm-strike" }).range(node.from, node.to));
              if (!editing || !selTouches(state, node.from, node.to)) {
                widgets.push(Decoration.replace({}).range(node.from, node.from + 2));
                widgets.push(Decoration.replace({}).range(node.to - 2, node.to));
              }
              return;
            }

            // Image — real <img> (https) or a placeholder, in place of the source.
            if (name === "Image") {
              skipRanges.push({ from: node.from, to: node.to });
              if (!editing || !selTouches(state, node.from, node.to)) {
                const src = state.doc.sliceString(node.from, node.to);
                const m = /^!\[([^\]]*)\]\(\s*([^)\s]+)/.exec(src);
                if (m) {
                  widgets.push(
                    Decoration.replace({
                      widget: new ImageWidget(m[2], m[1]),
                    }).range(node.from, node.to),
                  );
                }
              }
              return;
            }

            // Fenced code block — monospace block bg, hide the ``` fences.
            if (name === "FencedCode") {
              skipRanges.push({ from: node.from, to: node.to });
              addLineClass(widgets, state, node.from, node.to, "cm-cb");
              return;
            }
            if (name === "CodeMark" || name === "CodeInfo") {
              if (!editing || !selTouches(state, node.from, node.to)) {
                widgets.push(Decoration.replace({}).range(node.from, node.to));
              }
              return;
            }
          },
        });
      }

      const inSkip = (a, b) => skipRanges.some((r) => a < r.to && b > r.from);

      // Nested blockquotes (depth ≥ 2): indent each level deeper. The outer card
      // keeps its single accent bar; the growing indent conveys the nesting.
      qDepth.forEach((depth, n) => {
        if (depth < 2) return;
        const line = state.doc.line(n);
        widgets.push(
          Decoration.line({
            attributes: {
              style: "padding-left:" + (20 + (depth - 1) * 18) + "px !important",
            },
          }).range(line.from),
        );
      });

      // Tighten ASCII spaces that touch a CJK character. Japanese authors often
      // wrap inline Latin in spaces ("これは CodeMirror と …"); a full word-gap on
      // each side leaves lone particles floating. Skip code/widget spans.
      for (const vr of ranges) {
        const text = state.doc.sliceString(vr.from, vr.to);
        for (let i = 0; i < text.length; i++) {
          if (text[i] !== " ") continue;
          const p = vr.from + i;
          if (inSkip(p, p + 1)) continue;
          const prev = text[i - 1];
          const next = text[i + 1];
          if ((prev && CJK.test(prev)) || (next && CJK.test(next))) {
            widgets.push(Decoration.mark({ class: "cm-tsp" }).range(p, p + 1));
          }
        }
      }

      // Enlarge Latin runs so SF's cap-height matches the kanji body height. iOS
      // WebKit ignores @font-face size-adjust, so we scale per-run with an inline
      // font-size (.cm-lat). Skip code/widget spans.
      for (const vr of ranges) {
        const text = state.doc.sliceString(vr.from, vr.to);
        const re = /[0-9A-Za-zÀ-ɏ]+/g;
        let m;
        while ((m = re.exec(text))) {
          const from = vr.from + m.index;
          const to = from + m[0].length;
          if (inSkip(from, to)) continue;
          widgets.push(Decoration.mark({ class: "cm-lat" }).range(from, to));
        }
      }

      return Decoration.set(widgets, true);
    }
  },
  { decorations: (p) => p.decorations },
);

// GFM tables render as a real <table>. This must be a block widget spanning
// several lines, which a ViewPlugin isn't allowed to provide — so tables live
// in a StateField (recomputed on doc/selection changes). With the cursor inside
// a table the source is shown instead, for editing.
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function renderTable(src) {
  const lines = src.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return "";
  const cells = (l) => {
    let s = l.trim();
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|")) s = s.slice(0, -1);
    return s.split("|").map((c) => c.trim());
  };
  const header = cells(lines[0]);
  const align = cells(lines[1]).map((c) => {
    const l = c.startsWith(":");
    const r = c.endsWith(":");
    return l && r ? "center" : r ? "right" : l ? "left" : "";
  });
  const at = (i) => (align[i] ? ` style="text-align:${align[i]}"` : "");
  const head =
    "<tr>" + header.map((c, i) => `<th${at(i)}>${escapeHtml(c)}</th>`).join("") + "</tr>";
  const body = lines
    .slice(2)
    .map(
      (l) =>
        "<tr>" +
        cells(l)
          .map((c, i) => `<td${at(i)}>${escapeHtml(c)}</td>`)
          .join("") +
        "</tr>",
    )
    .join("");
  return `<table class="cm-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

class TableWidget extends WidgetType {
  constructor(src) {
    super();
    this.src = src;
  }
  eq(o) {
    return o.src === this.src;
  }
  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-table-wrap";
    wrap.innerHTML = renderTable(this.src);
    return wrap;
  }
}

function buildTables(state) {
  const editing = !!(window.CONFIG && window.CONFIG.editable);
  const deco = [];
  const tree = ensureSyntaxTree(state, state.doc.length, 1000) || syntaxTree(state);
  tree.iterate({
    enter: (node) => {
      if (node.name !== "Table") return;
      const from = state.doc.lineAt(node.from).from;
      const to = state.doc.lineAt(node.to).to;
      if (!editing || !selTouches(state, from, to)) {
        deco.push(
          Decoration.replace({
            widget: new TableWidget(state.doc.sliceString(from, to)),
            block: true,
          }).range(from, to),
        );
      }
      return false;
    },
  });
  return Decoration.set(deco, true);
}

const tableField = StateField.define({
  create: (state) => buildTables(state),
  update(value, tr) {
    if (tr.docChanged || tr.selection) return buildTables(tr.state);
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Transient search-match highlight (FR-15 jump-to-match). __cmReveal scrolls to
// a range and sets this effect to mark it; a timer clears it after a moment.
// Any edit clears it too, so a stale highlight never lingers over changed text.
const setHighlight = StateEffect.define();
const highlightMark = Decoration.mark({ class: "cm-search-hl" });
const highlightField = StateField.define({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setHighlight)) {
        value =
          e.value && e.value.to > e.value.from
            ? Decoration.set([highlightMark.range(e.value.from, e.value.to)])
            : Decoration.none;
      }
    }
    if (tr.docChanged) value = Decoration.none;
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

(function () {
  const t0 = performance.now();
  const cfg = window.CONFIG;
  const t = cfg.theme;
  const r = document.documentElement.style;
  r.setProperty("--bg", t.bg);
  r.setProperty("--fg", t.fg);
  r.setProperty("--tint", t.tint);
  // Links + task checkboxes follow the style preset's accent; fall back to tint.
  r.setProperty("--link", t.link || t.tint);
  r.setProperty("--sel", t.sel);
  r.setProperty("--codeBg", t.codeBg);
  r.setProperty("--muted", t.muted);
  r.setProperty("--base", t.base + "px");
  r.setProperty("--h1", t.h1);
  r.setProperty("--h2", t.h2);
  r.setProperty("--h3", t.h3);
  r.setProperty("--h4", t.h4);
  document.body.classList.toggle("readonly", !cfg.editable);

  // editable is toggled at runtime (preview ⇄ edit) via a compartment so the one
  // editor instance — and its undo history — survives the switch, no reload.
  // We use editable (keyboard on/off) but NOT readOnly, so a preview-mode tap on
  // a checkbox can still apply its toggle programmatically.
  const editableCompartment = new Compartment();
  const editableExt = (on) => [EditorView.editable.of(on)];

  try {
    const view = new EditorView({
      parent: document.getElementById("editor"),
      state: EditorState.create({
        doc: cfg.content,
        extensions: [
          history(),
          // No drawSelection(): rely on the browser's native caret/selection —
          // CM's custom cursor layer can fail to paint in an iOS WebView. The
          // native caret is coloured via `caret-color` in the CSS.
          keymap.of(defaultKeymap.concat(historyKeymap)),
          markdown({ base: markdownLanguage, codeLanguages, extensions: [GFM] }),
          syntaxHighlighting(cfg.theme.codeMono ? codeHighlightMono : codeHighlight),
          indentOnInput(),
          EditorView.lineWrapping,
          livePreview,
          tableField,
          highlightField,
          editableCompartment.of(editableExt(cfg.editable)),
          EditorView.updateListener.of((u) => {
            // Report every doc change (typing, or a checkbox tap in read mode)
            // so the RN side keeps the buffer and auto-saves. Includes fresh
            // undo/redo depth for the header buttons.
            if (u.docChanged) {
              post({
                type: "change",
                doc: u.state.doc.toString(),
                canUndo: undoDepth(u.state) > 0,
                canRedo: redoDepth(u.state) > 0,
              });
            }
          }),
        ],
      }),
    });

    // Imperative API for React Native (called via injectJavaScript).
    // Undo/redo drive the header buttons; setDoc replaces the whole buffer on
    // conflict "load latest" without a reload. Each posts the new history state.
    function postHistory() {
      post({
        type: "history",
        canUndo: undoDepth(view.state) > 0,
        canRedo: redoDepth(view.state) > 0,
      });
    }
    window.__cmUndo = function () {
      undo(view);
      view.focus();
      postHistory();
    };
    window.__cmRedo = function () {
      redo(view);
      view.focus();
      postHistory();
    };
    // Toggle preview ⇄ edit without losing undo history. Also flips the
    // livePreview "editing" flag (it reads window.CONFIG.editable) and the
    // caret via the body.readonly class; the dispatch forces a decoration
    // rebuild so the cursor-line syntax marks show/hide immediately.
    // FR-28: enable/disable checkbox tap-toggling at runtime (the widget's tap
    // handler reads this flag live, so no redraw is needed).
    window.__cmSetTaskInteractive = function (on) {
      window.CONFIG.taskInteractive = !!on;
    };
    window.__cmSetEditable = function (on) {
      window.CONFIG.editable = on;
      document.body.classList.toggle("readonly", !on);
      view.dispatch({
        selection: view.state.selection,
        effects: editableCompartment.reconfigure(editableExt(on)),
      });
      if (on) view.focus();
    };

    // v1.5 (FR-37): formatting-toolbar commands. Each toggles or inserts the
    // Markdown syntax for the current selection and re-focuses the editor; the
    // dispatch fires the updateListener above, which posts the change so the
    // file auto-saves. All operate on the primary selection (single caret/range
    // — multi-cursor isn't reachable on the phone editor).
    //
    // Toggle a line-head prefix on every line the selection spans. `match`
    // returns the existing prefix string to strip (null → the line gets `add`).
    function toggleLinePrefix(match, add) {
      const { state } = view;
      const r = state.selection.main;
      const first = state.doc.lineAt(r.from);
      const last = state.doc.lineAt(r.to);
      const changes = [];
      for (let n = first.number; n <= last.number; n++) {
        const line = state.doc.line(n);
        const found = match(line.text);
        if (found != null) {
          changes.push({ from: line.from, to: line.from + found.length, insert: "" });
        } else {
          changes.push({ from: line.from, insert: add });
        }
      }
      // Map the caret with assoc +1 so it lands AFTER the inserted marker
      // (default mapping keeps it before, leaving you unable to type on).
      const changeSet = state.changes(changes);
      view.dispatch({
        changes: changeSet,
        selection: state.selection.map(changeSet, 1),
        scrollIntoView: true,
      });
      view.focus();
    }
    // The three list styles (bullet / numbered / task) share one line-head slot,
    // so they must be mutually exclusive: detect whichever marker a line already
    // has. Task is checked first since "- [ ] " also starts with a bullet "- ".
    function listMarker(text) {
      let m;
      if ((m = /^[-*+] \[[ xX]\] /.exec(text))) return { type: "task", len: m[0].length };
      if ((m = /^[-*+] /.exec(text))) return { type: "bullet", len: m[0].length };
      if ((m = /^\d+\. /.exec(text))) return { type: "numbered", len: m[0].length };
      return null;
    }
    const LIST_PREFIX = { bullet: "- ", task: "- [ ] " };
    // Set every selected line to `target`: same type → remove (toggle off),
    // a different list type → convert (replace its marker, no stacking), none →
    // add. Fixes "tap bullet then number leaves both". Numbered target counts up
    // (1. 2. 3.) across the lines it applies to, rather than repeating "1. ".
    function toggleListType(target) {
      const { state } = view;
      const r = state.selection.main;
      const first = state.doc.lineAt(r.from);
      const last = state.doc.lineAt(r.to);
      const changes = [];
      let ordinal = 0;
      for (let n = first.number; n <= last.number; n++) {
        const line = state.doc.line(n);
        const cur = listMarker(line.text);
        if (cur && cur.type === target) {
          changes.push({ from: line.from, to: line.from + cur.len, insert: "" });
        } else {
          ordinal += 1;
          const prefix = target === "numbered" ? ordinal + ". " : LIST_PREFIX[target];
          const to = cur ? line.from + cur.len : line.from;
          changes.push({ from: line.from, to, insert: prefix });
        }
      }
      const changeSet = state.changes(changes);
      view.dispatch({
        changes: changeSet,
        selection: state.selection.map(changeSet, 1),
        scrollIntoView: true,
      });
      view.focus();
    }
    // Count the run of `ch` starting at `pos` (used for inline-code fences,
    // which can be one or more backticks).
    function runAfter(doc, pos, ch) {
      const len = doc.length;
      let n = 0;
      while (pos + n + 1 <= len && doc.sliceString(pos + n, pos + n + 1) === ch) n++;
      return n;
    }
    // Innermost syntax node named `name` that contains the current selection, or
    // null. Resolving from both sides catches a caret sitting just inside the
    // opening/closing marker. Detecting the ENCLOSING node (not just markers
    // adjacent to the selection) is what lets a caret inside `code` or **bold**
    // toggle it off, and lets bold be removed even when wrapped by ~~…~~.
    function enclosingNode(state, name) {
      const r = state.selection.main;
      ensureSyntaxTree(state, Math.min(state.doc.length, r.to + 1), 50);
      const tree = syntaxTree(state);
      for (const side of [1, -1]) {
        let node = tree.resolveInner(r.from, side);
        while (node) {
          if (node.name === name) return node;
          node = node.parent;
        }
      }
      return null;
    }
    // Toggle an inline wrap: bold (** / StrongEmphasis), italic (* / Emphasis),
    // strikethrough (~~ / Strikethrough), inline code (` / InlineCode). These are
    // independent toggles that can stack (***x***, ~~**x**~~ are all valid). If
    // the caret/selection is inside an existing node of this kind, strip that
    // node's markers; otherwise wrap the selection (or insert an empty pair with
    // the caret between it). `fixedLen` is the marker length for the * / ~ kinds;
    // pass null for inline code, whose fence length is read from the source.
    function toggleInline(ch, fixedLen, nodeName) {
      const { state } = view;
      const r = state.selection.main;
      const node = enclosingNode(state, nodeName);
      if (node) {
        const k = fixedLen || runAfter(state.doc, node.from, ch) || 1;
        const changeSet = state.changes([
          { from: node.from, to: node.from + k, insert: "" },
          { from: node.to - k, to: node.to, insert: "" },
        ]);
        view.dispatch({
          changes: changeSet,
          selection: state.selection.map(changeSet),
          scrollIntoView: true,
        });
        view.focus();
        return;
      }
      const pair = ch.repeat(fixedLen || 1);
      if (r.empty) {
        view.dispatch({
          changes: { from: r.from, insert: pair + pair },
          selection: { anchor: r.from + pair.length },
          scrollIntoView: true,
        });
      } else {
        const inner = state.doc.sliceString(r.from, r.to);
        view.dispatch({
          changes: { from: r.from, to: r.to, insert: pair + inner + pair },
          selection: { anchor: r.from + pair.length, head: r.to + pair.length },
          scrollIntoView: true,
        });
      }
      view.focus();
    }
    // Cycle the current line's heading level none → # → ## → ### → none.
    window.__cmHeading = function () {
      const { state } = view;
      const line = state.doc.lineAt(state.selection.main.head);
      const m = /^(#{1,6}) /.exec(line.text);
      const cur = m ? Math.min(m[1].length, 3) : 0;
      const next = cur >= 3 ? 0 : cur + 1;
      const insert = next === 0 ? "" : "#".repeat(next) + " ";
      const changeSet = state.changes({
        from: line.from,
        to: line.from + (m ? m[0].length : 0),
        insert,
      });
      view.dispatch({
        changes: changeSet,
        selection: state.selection.map(changeSet, 1),
        scrollIntoView: true,
      });
      view.focus();
    };
    window.__cmBulletList = function () {
      toggleListType("bullet");
    };
    window.__cmNumberedList = function () {
      toggleListType("numbered");
    };
    window.__cmCheckbox = function () {
      toggleListType("task");
    };
    window.__cmQuote = function () {
      toggleLinePrefix((t) => {
        const m = /^> ?/.exec(t);
        return m && m[0] ? m[0] : null;
      }, "> ");
    };
    window.__cmBold = function () {
      toggleInline("*", 2, "StrongEmphasis");
    };
    window.__cmItalic = function () {
      toggleInline("*", 1, "Emphasis");
    };
    window.__cmStrikethrough = function () {
      toggleInline("~", 2, "Strikethrough");
    };
    window.__cmCode = function () {
      toggleInline("`", null, "InlineCode");
    };
    window.__cmLink = function () {
      const { state } = view;
      const r = state.selection.main;
      if (r.empty) {
        view.dispatch({
          changes: { from: r.from, insert: "[]()" },
          selection: { anchor: r.from + 1 },
          scrollIntoView: true,
        });
      } else {
        const inner = state.doc.sliceString(r.from, r.to);
        view.dispatch({
          changes: { from: r.from, to: r.to, insert: "[" + inner + "]()" },
          selection: { anchor: r.from + inner.length + 3 },
          scrollIntoView: true,
        });
      }
      view.focus();
    };
    window.__cmCodeBlock = function () {
      const { state } = view;
      // Inside a fenced block already → unwrap: drop the opening and closing
      // fence lines (their whole line, incl. the line break) and keep the code.
      // Without this, pressing the button again just nested another ``` pair.
      const node = enclosingNode(state, "FencedCode");
      if (node) {
        let firstMark = null;
        let lastMark = null;
        for (let c = node.firstChild; c; c = c.nextSibling) {
          if (c.name === "CodeMark") {
            if (!firstMark) firstMark = c;
            lastMark = c;
          }
        }
        if (firstMark && lastMark && lastMark !== firstMark) {
          const openLine = state.doc.lineAt(firstMark.from);
          const closeLine = state.doc.lineAt(lastMark.from);
          const changeSet = state.changes([
            { from: openLine.from, to: Math.min(openLine.to + 1, state.doc.length), insert: "" },
            { from: Math.max(0, closeLine.from - 1), to: closeLine.to, insert: "" },
          ]);
          view.dispatch({
            changes: changeSet,
            selection: state.selection.map(changeSet),
            scrollIntoView: true,
          });
          view.focus();
          return;
        }
      }
      const r = state.selection.main;
      const inner = state.doc.sliceString(r.from, r.to);
      view.dispatch({
        changes: { from: r.from, to: r.to, insert: "```\n" + inner + "\n```" },
        selection: { anchor: r.from + 4, head: r.from + 4 + inner.length },
        scrollIntoView: true,
      });
      view.focus();
    };
    window.__cmHorizontalRule = function () {
      const { state } = view;
      const line = state.doc.lineAt(state.selection.main.head);
      if (line.text.trim() === "") {
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: "---" },
          selection: { anchor: line.from + 3 },
          scrollIntoView: true,
        });
      } else {
        const insert = "\n\n---\n";
        view.dispatch({
          changes: { from: line.to, insert },
          selection: { anchor: line.to + insert.length },
          scrollIntoView: true,
        });
      }
      view.focus();
    };

    // FR-15: scroll to a match (char offsets on the same normalized text the RN
    // side searched), select it, and flash a highlight that auto-clears. Called
    // from RN once the editor is ready after opening a search result.
    let revealTimer = null;
    window.__cmReveal = function (from, to) {
      const len = view.state.doc.length;
      const a = Math.max(0, Math.min(from | 0, len));
      const b = Math.max(a, Math.min(to | 0, len));
      view.dispatch({
        selection: { anchor: a, head: b },
        effects: [
          EditorView.scrollIntoView(a, { y: "center" }),
          setHighlight.of({ from: a, to: b }),
        ],
      });
      if (revealTimer) clearTimeout(revealTimer);
      revealTimer = setTimeout(() => {
        revealTimer = null;
        try {
          view.dispatch({ effects: setHighlight.of(null) });
        } catch {
          // View may be gone if the screen closed — nothing to clear.
        }
      }, 2600);
    };

    // Tapping a link in read mode opens it (RN handles the URL). In edit mode a
    // tap just places the caret, so links stay editable.
    view.dom.addEventListener("click", (e) => {
      if (window.CONFIG && window.CONFIG.editable) return;
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos == null) return;
      let node = syntaxTree(view.state).resolveInner(pos, 0);
      while (node && node.name !== "Link") node = node.parent;
      if (!node) return;
      let url = null;
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.name === "URL") {
          url = view.state.doc.sliceString(c.from, c.to);
          break;
        }
      }
      if (url) {
        e.preventDefault();
        post({ type: "link", url: url });
      }
    });

    // FR-38: report page scroll for the hide-on-scroll header. We use a passive
    // JS scroll listener on the page's own scroll rather than react-native-
    // webview's onScroll (which re-applies native scroll props each event). rAF-
    // throttled to at most one post per frame.
    let scrollTick = false;
    window.addEventListener(
      "scroll",
      function () {
        if (scrollTick) return;
        scrollTick = true;
        requestAnimationFrame(function () {
          scrollTick = false;
          const y =
            window.scrollY ||
            (document.scrollingElement ? document.scrollingElement.scrollTop : 0);
          post({ type: "scroll", y: y });
        });
      },
      { passive: true },
    );

    post({ type: "ready", ms: Math.round(performance.now() - t0) });
  } catch (e) {
    post({ type: "error", message: String((e && e.stack) || e) });
  }
})();
