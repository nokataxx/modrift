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

// Whether the file lives inside the app's iCloud ubiquity container — i.e. it is an
// iCloud editing copy created via the FR-03 copy flow. Used to surface the "editing
// an iCloud copy" banner. A file at the user's iCloud Drive root is NOT in our container.
export function isIcloudCopyLocation(uri: string): boolean {
  if (!uri) return false;
  return uri.includes(UBIQUITY_CONTAINER_SEGMENT);
}
