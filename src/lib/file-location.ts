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

export type FileLocation = {
  kind: FileLocationKind;
  // For external File Providers, the human-readable provider name extracted
  // from the URI when possible (e.g. "Google Drive", "Dropbox"). Undefined
  // when the URI doesn't match a known mount-point pattern.
  providerName?: string;
};

// Classify the file's storage location for UI labelling in the recent-files
// list. Drives the small subtitle that lets the user distinguish identically-
// named files coming from different places.
export function classifyFileLocation(uri: string): FileLocation {
  if (!uri) return { kind: 'external' };
  if (uri.includes(UBIQUITY_CONTAINER_SEGMENT)) return { kind: 'icloudCopy' };
  if (uri.includes(ICLOUD_DRIVE_SEGMENT)) return { kind: 'icloudDrive' };
  const root = appContainerRoot();
  if (root && uri.startsWith(root)) return { kind: 'appSandbox' };
  return { kind: 'external', providerName: detectProvider(uri) };
}

function detectProvider(uri: string): string | undefined {
  // iOS 16+ third-party File Providers mount under /Library/CloudStorage/<name>/.
  // Folder names look like "GoogleDrive-name@example.com" or just "Dropbox".
  const cs = uri.match(/\/CloudStorage\/([^/]+)/);
  if (cs) {
    const decoded = decodeURIComponent(cs[1]);
    // Drop the trailing "-account@something" portion if present.
    const base = decoded.split('-')[0];
    return splitCamelCase(base) || undefined;
  }
  // Legacy: /Library/Mobile Documents/<container>/ where container is the
  // provider's reverse-DNS like "com~google~Drive" or "com~getdropbox~Dropbox".
  const mob = uri.match(/\/Mobile Documents\/([^/]+)/);
  if (mob) {
    return prettifyContainerId(mob[1]) || undefined;
  }
  return undefined;
}

function splitCamelCase(name: string): string {
  // "GoogleDrive" → "Google Drive", "Dropbox" → "Dropbox".
  return name.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function prettifyContainerId(segment: string): string | undefined {
  // Bare provider names are sometimes used as-is (e.g. "Dropbox").
  if (!/[.~]/.test(segment)) return splitCamelCase(segment);
  // Reverse-DNS form: "com~google~Drive" → "Google Drive".
  if (segment.startsWith('com~') || segment.startsWith('com.')) {
    const parts = segment.replace(/^com[~.]/, '').split(/[~.]/);
    const name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    return name || undefined;
  }
  return undefined;
}
