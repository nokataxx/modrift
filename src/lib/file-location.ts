import { Paths } from 'expo-file-system';

const UBIQUITY_CONTAINER_SEGMENT = '/iCloud~com~nokata~modrift/';
const ICLOUD_DRIVE_SEGMENT = '/com~apple~CloudDocs/';

// The app's container root, e.g. file://.../Application/<UUID>/, derived from the document dir.
function appContainerRoot(): string | null {
  try {
    const doc = Paths.document.uri; // file://.../Application/<UUID>/Documents/
    const idx = doc.lastIndexOf('/Documents');
    return idx >= 0 ? doc.slice(0, idx + 1) : null;
  } catch {
    return null;
  }
}

// Whether a file can be edited in place so that writes actually persist / sync.
// iCloud Drive, the app's iCloud ubiquity container, and the app's own sandbox qualify.
// Third-party File Providers (e.g. Google Drive) do NOT upload third-party in-place edits,
// so those files are treated as view-only — editing happens via an iCloud copy instead
// (Requirements.md FR-03).
export function isInPlaceEditable(uri: string): boolean {
  if (!uri) return false;
  if (uri.includes(ICLOUD_DRIVE_SEGMENT)) return true; // iCloud Drive
  if (uri.includes(UBIQUITY_CONTAINER_SEGMENT)) return true; // app's iCloud ubiquity container
  const root = appContainerRoot();
  if (root && uri.startsWith(root)) return true; // app sandbox (e.g. Open-In Inbox copies)
  return false;
}

export type FileLocationKind = 'icloudCopy' | 'icloudDrive' | 'appSandbox' | 'external';

// Classify the file's storage location for UI labelling in the recent-files
// list. Drives the small subtitle that lets the user distinguish identically-
// named files coming from different places (e.g. the original vs. its iCloud
// editing copy).
export function classifyFileLocation(uri: string): FileLocationKind {
  if (!uri) return 'external';
  if (uri.includes(UBIQUITY_CONTAINER_SEGMENT)) return 'icloudCopy';
  if (uri.includes(ICLOUD_DRIVE_SEGMENT)) return 'icloudDrive';
  const root = appContainerRoot();
  if (root && uri.startsWith(root)) return 'appSandbox';
  return 'external';
}
