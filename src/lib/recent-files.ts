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
};

function isRecentFile(value: unknown): value is RecentFile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.uri !== 'string' || typeof v.name !== 'string' || typeof v.openedAt !== 'number') {
    return false;
  }
  if (v.bookmark !== undefined && typeof v.bookmark !== 'string') return false;
  return true;
}

export async function loadRecentFiles(): Promise<RecentFile[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentFile);
  } catch {
    return [];
  }
}

export async function recordRecentFile(entry: { uri: string; name: string }): Promise<void> {
  // Refresh the bookmark every time the file is opened so stale bookmarks are
  // healed and newly granted scopes (e.g. fresh Open-In invocations) overwrite
  // older ones. A failed creation keeps the entry but without a bookmark.
  const bookmark = await FileBookmarkModule.createBookmark(entry.uri).catch(() => null);
  const existing = await loadRecentFiles();
  const next: RecentFile[] = [
    {
      uri: entry.uri,
      name: entry.name,
      openedAt: Date.now(),
      ...(bookmark !== null ? { bookmark } : {}),
    },
    ...existing.filter((item) => item.uri !== entry.uri),
  ].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function removeRecentFile(uri: string): Promise<void> {
  const existing = await loadRecentFiles();
  const next = existing.filter((item) => item.uri !== uri);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
