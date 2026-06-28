import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory } from 'expo-file-system';

import FileBookmarkModule from '@modules/file-bookmark';

const STORAGE_KEY = 'modrift:vaultFolder';

// FR-18: a folder the user has granted access to. Its security-scoped bookmark
// lets the grant survive relaunches; holding that scope is what makes child
// files (notably note images) readable. The Vault browser (FR-24) and in-Vault
// file creation (FR-23) build on this same grant.
export type VaultFolder = {
  // file:// URI of the granted folder. Refreshed from the bookmark on resolve
  // when iOS relocates the folder (e.g. the provider re-mounts at a new path).
  uri: string;
  // Folder display name (last path segment), shown in settings.
  name: string;
  // Security-Scoped Bookmark (base64) so the grant survives relaunches. Absent
  // when bookmark creation failed — the folder still works for the session it
  // was picked in, but may not re-activate on the next launch.
  bookmark?: string;
};

function isVaultFolder(value: unknown): value is VaultFolder {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.uri !== 'string' || typeof v.name !== 'string') return false;
  if (v.bookmark !== undefined && typeof v.bookmark !== 'string') return false;
  return true;
}

function folderName(uri: string): string {
  const trimmed = uri.replace(/\/+$/, '');
  const last = trimmed.slice(trimmed.lastIndexOf('/') + 1);
  return decodeURIComponent(last) || 'Vault';
}

export async function loadVaultFolder(): Promise<VaultFolder | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isVaultFolder(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Present the system folder picker (Directory.pickDirectoryAsync wraps
// UIDocumentPicker in folder mode) and persist the chosen folder plus a
// security-scoped bookmark. Returns the stored folder, or null if the user
// cancelled or the picker failed.
export async function pickVaultFolder(): Promise<VaultFolder | null> {
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    // User cancelled, or the picker couldn't open — nothing to persist.
    return null;
  }
  const uri = dir.uri;
  const bookmark = await FileBookmarkModule.createBookmark(uri).catch(() => null);
  const folder: VaultFolder = {
    uri,
    name: folderName(uri),
    ...(bookmark !== null ? { bookmark } : {}),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(folder));
  return folder;
}

export async function clearVaultFolder(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// (Re)activate security-scoped access to the Vault folder for this launch by
// resolving its bookmark — child files (e.g. note images) are only readable
// while this scope is held. Returns the active folder URI (refreshed from the
// bookmark when iOS relocated the folder) or null when no folder is set. Safe
// to call repeatedly; resolveBookmark holds the scope for the app's lifetime.
export async function activateVaultScope(): Promise<string | null> {
  const folder = await loadVaultFolder();
  if (!folder) return null;
  if (folder.bookmark) {
    const resolved = await FileBookmarkModule.resolveBookmark(folder.bookmark).catch(() => null);
    if (resolved !== null) {
      if (resolved.uri !== folder.uri) {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...folder, uri: resolved.uri, name: folderName(resolved.uri) }),
        );
      }
      return resolved.uri;
    }
  }
  // No bookmark, or it failed to resolve: return the stored URI as a best
  // effort. Reads will work only if the path is still accessible without a
  // freshly-started scope (e.g. the app's own sandbox).
  return folder.uri;
}
