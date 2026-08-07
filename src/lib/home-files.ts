import { Directory, File } from 'expo-file-system';

import { localHomeDirectoryUri } from '@/lib/file-location';
import { isSupportedFile } from '@/lib/file-types';
import { type HomeLocation } from '@/lib/settings';
import IcloudContainerModule from '@modules/icloud-container';

// v1.4 home = a flat folder of files Modrift can open. Shares one definition
// with the picker (file-types.ts) so the home lists exactly what Modrift can
// open — including the v2 formats, which are listed but view-only (FR-21).

export type HomeFile = {
  uri: string;
  name: string;
  // Epoch ms of last modification, or null when the filesystem doesn't report
  // one. Used only for newest-first sorting, so null sinks to the bottom.
  modifiedAt: number | null;
};

// The home folder's directory URI for the given location. FR-31:
// - 'icloud': the app's iCloud ubiquity container (iCloud › Modrift). Returns
//   null when iCloud Drive is signed out or the container isn't available.
// - 'local': the app's Documents root (= On My iPhone › Modrift via
//   UIFileSharingEnabled). Always available, but not iCloud-synced or backed up
//   — see the FR-31 switch warning. No subfolder, to avoid a "Modrift › Modrift"
//   nesting in Files.
// Neither needs a picker, security scope, or bookmark to enumerate/read/write.
export async function getHomeDirectoryUri(location: HomeLocation): Promise<string | null> {
  if (location === 'local') {
    return localHomeDirectoryUri();
  }
  return IcloudContainerModule.getContainerDocumentsURL();
}

// List the home folder's Markdown/text files, newest first. Sub-directories are
// skipped — the v1.4 home is flat (no folder browsing, unlike the abandoned
// Vault). Returns [] when the home folder is unavailable or can't be read, so
// callers render an empty state rather than crash. iCloud files that are evicted
// (not downloaded) still enumerate here; reading them happens later in the viewer.
export async function listHomeFiles(location: HomeLocation): Promise<HomeFile[]> {
  const dirUri = await getHomeDirectoryUri(location);
  if (dirUri === null) return [];
  try {
    const dir = new Directory(dirUri);
    if (!dir.exists) return [];
    const files: HomeFile[] = [];
    for (const entry of dir.list()) {
      if (entry instanceof File && isSupportedFile(entry.name)) {
        files.push({
          uri: entry.uri,
          name: entry.name,
          modifiedAt: entry.modificationTime ?? null,
        });
      }
    }
    files.sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
    return files;
  } catch {
    return [];
  }
}
