import AsyncStorage from '@react-native-async-storage/async-storage';

import FileBookmarkModule from '@modules/file-bookmark';

const STORAGE_KEY = 'modrift:recentFiles';
const MAX_ENTRIES = 10;

export type RecentFile = {
  uri: string;
  name: string;
  openedAt: number;
  // Security-Scoped Bookmark (base64). Absent when bookmark creation failed
  // — the entry is still listed but tap-to-reopen falls back to the raw URI,
  // which may or may not still be valid across launches.
  bookmark?: string;
  // Display name of the File Provider that hosts this file ("Google Drive",
  // "Dropbox", etc.), captured at record time via NSFileProviderManager.
  // Absent for files in our own sandbox / iCloud copy / iCloud Drive — the
  // UI falls back to a kind-based label in that case.
  providerName?: string;
};

// iOS reports the same file as both `file:///var/...` and `file:///private/var/...`
// depending on how the URL was constructed. Both resolve to the same on-disk
// file but they are different strings, which breaks naive URI dedup. Normalize
// to the `/private/var/` form before storage and comparison.
export function normalizeUri(uri: string): string {
  return uri.replace(/^file:\/\/\/var\//, 'file:///private/var/');
}

// A stable identity key for deciding whether two URIs point at the same file.
// Beyond the /var vs /private/var difference, the same iCloud file can surface
// with different percent-encoding depending on how the URI was produced — e.g.
// "Mobile%20Documents/あ.md" (File.uri) vs "Mobile Documents/あ.md" (decoded).
// Comparing raw strings would then leave two history rows for one file. Decode
// so encoded and decoded forms collapse to the same key.
export function sameFileKey(uri: string): string {
  const privatized = normalizeUri(uri);
  try {
    return decodeURI(privatized);
  } catch {
    return privatized;
  }
}

function isRecentFile(value: unknown): value is RecentFile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.uri !== 'string' || typeof v.name !== 'string' || typeof v.openedAt !== 'number') {
    return false;
  }
  if (v.bookmark !== undefined && typeof v.bookmark !== 'string') return false;
  if (v.providerName !== undefined && typeof v.providerName !== 'string') return false;
  return true;
}

export async function loadRecentFiles(): Promise<RecentFile[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isRecentFile);
    // Collapse any legacy duplicate rows: the same file recorded under
    // different encodings (e.g. "Mobile%20Documents" vs "Mobile Documents")
    // before sameFileKey dedup existed. Keeps the first (most recent) row.
    return valid.filter(
      (item, i) => valid.findIndex((o) => sameFileKey(o.uri) === sameFileKey(item.uri)) === i,
    );
  } catch {
    return [];
  }
}

export async function recordRecentFile(entry: { uri: string; name: string }): Promise<void> {
  const normalizedUri = normalizeUri(entry.uri);
  const key = sameFileKey(entry.uri);
  // Refresh both pieces of metadata on every open so stale bookmarks heal
  // themselves and provider renames flow through to the recent-files list.
  // Failures keep the entry but without the missing piece.
  const [bookmark, providerName] = await Promise.all([
    FileBookmarkModule.createBookmark(entry.uri).catch(() => null),
    FileBookmarkModule.getProviderDisplayName(entry.uri).catch(() => null),
  ]);
  const existing = await loadRecentFiles();
  const next: RecentFile[] = [
    {
      uri: normalizedUri,
      name: entry.name,
      openedAt: Date.now(),
      ...(bookmark !== null ? { bookmark } : {}),
      ...(providerName !== null ? { providerName } : {}),
    },
    // Drop any prior row for the same file, regardless of /var vs /private/var
    // or percent-encoding differences (sameFileKey), so it never duplicates.
    ...existing.filter((item) => sameFileKey(item.uri) !== key),
  ].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

// Update a history entry in place after its file was renamed (FR-22). The uri
// and name change; the bookmark is dropped because it no longer resolves — our
// iCloud copies re-open by uri without one anyway (see handleRecentPress).
export async function renameRecentFile(
  oldUri: string,
  next: { uri: string; name: string },
): Promise<void> {
  const oldKey = sameFileKey(oldUri);
  const normalizedNext = normalizeUri(next.uri);
  const existing = await loadRecentFiles();
  const updated = existing.map((item) =>
    sameFileKey(item.uri) === oldKey
      ? { uri: normalizedNext, name: next.name, openedAt: item.openedAt }
      : item,
  );
  // Renaming onto a uri that another entry already occupies would leave two
  // rows for the same file. Keep only the first occurrence of each file so the
  // rename can't duplicate (sameFileKey ignores /var and encoding differences).
  const deduped = updated.filter(
    (item, i) =>
      updated.findIndex((other) => sameFileKey(other.uri) === sameFileKey(item.uri)) === i,
  );
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
}

export async function removeRecentFile(uri: string): Promise<void> {
  const key = sameFileKey(uri);
  const existing = await loadRecentFiles();
  const next = existing.filter((item) => sameFileKey(item.uri) !== key);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

// Clear the whole recently-opened list (FR-06 / 最近見た). Non-destructive to
// the files themselves — only the history entries are removed.
export async function clearRecentFiles(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
