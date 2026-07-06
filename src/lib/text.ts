// Canonicalize Markdown text the same way everywhere it's loaded, so character
// offsets line up between what the viewer displays and what search matched
// against (FR-15 jump-to-match relies on identical offsets). Strips a leading
// UTF-8 BOM and normalizes Windows CRLF line endings to LF.
export function normalizeMarkdown(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
}
