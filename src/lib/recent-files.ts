import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'modrift:recentFiles';
const MAX_ENTRIES = 10;

export type RecentFile = {
  uri: string;
  name: string;
  openedAt: number;
};

function isRecentFile(value: unknown): value is RecentFile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.uri === 'string' && typeof v.name === 'string' && typeof v.openedAt === 'number';
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
  const existing = await loadRecentFiles();
  const next: RecentFile[] = [
    { uri: entry.uri, name: entry.name, openedAt: Date.now() },
    ...existing.filter((item) => item.uri !== entry.uri),
  ].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
