// Canonicalize loaded text: strips a leading UTF-8 BOM and normalizes Windows
// CRLF line endings to LF.
export function normalizeMarkdown(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
}
