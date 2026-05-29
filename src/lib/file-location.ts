import { Paths } from 'expo-file-system';

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
// iCloud Drive and the app's own sandbox qualify. Third-party File Providers (e.g. Google
// Drive) do NOT upload third-party in-place edits, so those files are treated as view-only.
// (Editing Google-Drive-hosted files via an iCloud copy is planned and requires a paid
// Apple Developer Program for the iCloud container — see Requirements.md FR-03.)
export function isInPlaceEditable(uri: string): boolean {
  if (!uri) return false;
  if (uri.includes('/com~apple~CloudDocs/')) return true; // iCloud Drive
  const root = appContainerRoot();
  if (root && uri.startsWith(root)) return true; // app sandbox (e.g. Open-In Inbox copies)
  return false;
}
