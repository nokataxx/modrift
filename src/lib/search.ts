import { File } from 'expo-file-system';

import FileBookmarkModule from '@modules/file-bookmark';

import { classifyFileLocation, type FileLocationKind } from './file-location';
import { loadRecentFiles, type RecentFile } from './recent-files';
import { normalizeMarkdown } from './text';

// FR-15: full-text search is scoped to the recently-opened files (≤10), read on
// demand — there's no disk-wide index (iOS sandboxing wouldn't allow it, and the
// recents cap keeps in-memory search trivial). Each searchable file carries a
// readable URI (bookmark-resolved so its security scope is live), so a matched
// result can be opened straight from the captured URI.

export type SearchableFile = {
  /** A URI readable now (bookmark-resolved, or the raw URI for iCloud copies). */
  uri: string;
  name: string;
  /** Normalized so match offsets line up with what the viewer displays. */
  content: string;
  locationKind: FileLocationKind;
  providerName?: string;
};

export type SearchMatch = {
  /** Index into the SearchableFile[] this match came from. */
  fileIndex: number;
  /** 1-based line number of the match, for display. */
  line: number;
  /** Char offsets on the normalized content — passed to the viewer to reveal. */
  from: number;
  to: number;
  /** Snippet pieces around the match (single line, context-trimmed). */
  before: string;
  matchText: string;
  after: string;
};

// Keep result lists bounded so a common word across 10 files can't produce a
// runaway list. Per-file and total caps; callers can surface "truncated".
const MAX_PER_FILE = 20;
const MAX_TOTAL = 80;
const CTX_BEFORE = 32;
const CTX_AFTER = 80;

// Resolve a recent-files entry to a URI we can read right now. Mirrors the
// reopen logic on the home screen: prefer the bookmark (carries a live security
// scope for iCloud / third-party providers), else the raw URI if the file is
// reachable (our own iCloud copies open without a scope).
async function resolveReadableUri(item: RecentFile): Promise<string | null> {
  if (item.bookmark) {
    const resolved = await FileBookmarkModule.resolveBookmark(item.bookmark).catch(() => null);
    if (resolved !== null) return resolved.uri;
  }
  try {
    if (new File(item.uri).exists) return item.uri;
  } catch {
    // Fall through — treat as unreadable.
  }
  return null;
}

// Load and read every recent file we can actually open, returning their
// normalized content for in-memory search. Files that fail to resolve or read
// (evicted iCloud, dead bookmark, provider that won't hand over content) are
// skipped silently — search simply covers what's reachable.
export async function loadSearchableRecentFiles(): Promise<SearchableFile[]> {
  const items = await loadRecentFiles();
  const results = await Promise.all(
    items.map(async (item): Promise<SearchableFile | null> => {
      const uri = await resolveReadableUri(item);
      if (uri === null) return null;
      try {
        const text = await new File(uri).text();
        const location = classifyFileLocation(uri);
        return {
          uri,
          name: item.name,
          content: normalizeMarkdown(text),
          locationKind: location.kind,
          providerName: item.providerName ?? location.providerName,
        };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((f): f is SearchableFile => f !== null);
}

function snippet(content: string, from: number, to: number) {
  const lineStart = content.lastIndexOf('\n', from - 1) + 1;
  let lineEnd = content.indexOf('\n', to);
  if (lineEnd === -1) lineEnd = content.length;

  const beforeStart = Math.max(lineStart, from - CTX_BEFORE);
  const afterEnd = Math.min(lineEnd, to + CTX_AFTER);
  const before = (beforeStart > lineStart ? '…' : '') + content.slice(beforeStart, from);
  const after = content.slice(to, afterEnd) + (afterEnd < lineEnd ? '…' : '');
  return { before, matchText: content.slice(from, to), after };
}

// Case-insensitive substring search across the loaded files. Returns matches in
// file-then-position order, bounded by the caps above. `truncated` is true when
// a cap dropped some matches, so the UI can say so instead of implying total
// coverage.
export function findMatches(
  files: SearchableFile[],
  query: string,
): { matches: SearchMatch[]; truncated: boolean } {
  const needle = query.trim().toLowerCase();
  if (needle === '') return { matches: [], truncated: false };

  const matches: SearchMatch[] = [];
  let truncated = false;

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const { content } = files[fileIndex];
    const hay = content.toLowerCase();
    let perFile = 0;
    let idx = hay.indexOf(needle);
    // Track line number incrementally so we don't re-slice the whole prefix per
    // match: count newlines between the previous match and this one.
    let scannedTo = 0;
    let line = 1;
    while (idx !== -1) {
      if (perFile >= MAX_PER_FILE) {
        truncated = true;
        break;
      }
      for (let i = scannedTo; i < idx; i++) {
        if (content.charCodeAt(i) === 10) line++;
      }
      scannedTo = idx;
      const to = idx + needle.length;
      matches.push({ fileIndex, line, from: idx, to, ...snippet(content, idx, to) });
      perFile++;
      if (matches.length >= MAX_TOTAL) {
        truncated = true;
        return { matches, truncated };
      }
      idx = hay.indexOf(needle, to);
    }
  }
  return { matches, truncated };
}
