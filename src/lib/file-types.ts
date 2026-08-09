// What Modrift can open, and which screen opens it (FR-21).
//
// One definition on purpose. The extension list used to be duplicated between
// the picker's post-selection check and the home listing, which is exactly the
// kind of pair that drifts — widen one and the home stops showing files the
// picker happily accepts.

/**
 * Extensions Modrift accepts. Markdown/text are the free core; PDF, docx and
 * xlsx are the v2 paid formats (FR-41〜43); images are v2 too but stay free
 * (FR-45). All of the v2 formats open view-only.
 *
 * `.text` mirrors the public.plain-text UTI we declare in
 * CFBundleDocumentTypes, so the in-app picker takes the same file shapes the
 * Files App "Modrift で開く" path already does — iCloud sometimes assigns .text
 * to plain text files instead of .txt.
 *
 * Legacy binary Office formats (.doc / .xls) are deliberately absent: mammoth
 * cannot read .doc at all, so supporting only half would be arbitrary.
 */
export const IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.heic',
  '.heif',
  '.webp',
] as const;

export const SUPPORTED_EXTENSIONS = [
  '.md',
  '.markdown',
  '.txt',
  '.text',
  '.pdf',
  '.docx',
  '.xlsx',
  ...IMAGE_EXTENSIONS,
] as const;

export function isSupportedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * The route that renders a given file. Markdown and text keep the CodeMirror
 * viewer; each v2 format gets its own screen (FR-21: the Markdown viewer is not
 * touched).
 *
 * Every entry point must go through this — the picker, the home list, history,
 * Open In (+native-intent) and the share sheet — or a format reaches a screen
 * that cannot render it. Open In is the easiest to forget, since iOS filters by
 * UTI there and hands us a bare file:// URL.
 */
export function routeForFile(
  name: string,
): '/viewer' | '/pdf-viewer' | '/docx-viewer' | '/xlsx-viewer' | '/image-viewer' {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return '/pdf-viewer';
  if (lower.endsWith('.docx')) return '/docx-viewer';
  if (lower.endsWith('.xlsx')) return '/xlsx-viewer';
  if (IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return '/image-viewer';
  return '/viewer';
}
