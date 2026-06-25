import AsyncStorage from '@react-native-async-storage/async-storage';

// User-assigned display names for third-party cloud sources, keyed by the
// stable per-provider container id (see externalContainerKey in file-location).
// iOS won't tell a sandboxed app which provider a file came from (verified on
// device), but the container id is stable within an install, so the user can
// name each source once ("Google Drive", "Dropbox") and it sticks for every
// file from that source.
const STORAGE_KEY = 'modrift:cloudNames';

export type CloudNames = Record<string, string>;

export async function loadCloudNames(): Promise<CloudNames> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: CloudNames = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

// Set (or clear, when name is blank) the user label for a container key.
// Returns the updated map so callers can drop it straight into state.
export async function setCloudName(key: string, name: string): Promise<CloudNames> {
  const names = await loadCloudNames();
  const trimmed = name.trim();
  if (trimmed) names[key] = trimmed;
  else delete names[key];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  return names;
}
