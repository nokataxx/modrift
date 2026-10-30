// What Modrift can open.
//
// `.text` mirrors the public.plain-text UTI we declare in CFBundleDocumentTypes,
// so the in-app picker takes the same file shapes the Files App "Modrift で開く"
// path already does — iCloud sometimes assigns .text to plain text files
// instead of .txt.
export const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.txt', '.text'] as const;

export function isSupportedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
