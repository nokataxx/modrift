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

// File Provider mount-point names vary across installs (Google Drive can be
// "Drive", "GoogleDrive", or "Google Drive"; Dropbox is sometimes
// "com~getdropbox~Dropbox"). Normalize the recognised ones to a single
// canonical label so the recent-files list reads consistently.
const KNOWN_PROVIDERS: { pattern: RegExp; name: string }[] = [
  { pattern: /^(google ?drive|drive)$/i, name: 'Google Drive' },
  { pattern: /^dropbox$/i, name: 'Dropbox' },
  { pattern: /^(one ?drive|microsoft ?onedrive)$/i, name: 'OneDrive' },
  { pattern: /^box$/i, name: 'Box' },
];

function canonicalize(base: string): string {
  for (const { pattern, name } of KNOWN_PROVIDERS) {
    if (pattern.test(base)) return name;
  }
  // Fall back to a humanised camelCase split: "MyCloud" → "My Cloud".
  return base.replace(/([a-z])([A-Z])/g, '$1 $2');
}

// AppGroup container UUIDs are derived from a fixed hash of the group
// identifier ("group.com.google.Drive..." → fixed UUID), so the same provider
// app yields the same UUID on every iOS device. NSFileProviderManager only
// returns domains your own app registered, which leaves us no public API to
// look up third-party providers — fall back to known-UUID mapping instead.
const KNOWN_APPGROUP_PROVIDERS: { [uuid: string]: string } = {
  '6574EA41-4584-4087-98B6-04C563D447C4': 'Google Drive',
};

function detectProvider(uri: string): string | undefined {
  // iOS 16+ third-party File Providers mount under /Library/CloudStorage/<name>/
  // when accessed in place (Files-App view). Folder names look like
  // "GoogleDrive-name@example.com" or just "Drive".
  const cs = uri.match(/\/CloudStorage\/([^/]+)/);
  if (cs) {
    const decoded = decodeURIComponent(cs[1]);
    const base = decoded.split('-')[0];
    return canonicalize(base) || undefined;
  }
  // Document Picker (non-in-place) returns the third-party File Provider's
  // on-disk AppGroup storage path, which has the provider's AppGroup UUID:
  // /Containers/Shared/AppGroup/<UUID>/File Provider Storage/.../file
  const ag = uri.match(/\/AppGroup\/([0-9A-Fa-f-]+)\//);
  if (ag) return KNOWN_APPGROUP_PROVIDERS[ag[1].toUpperCase()];
  // Legacy: /Library/Mobile Documents/<container>/ where container is the
  // provider's reverse-DNS like "com~google~Drive" or "com~getdropbox~Dropbox".
  const mob = uri.match(/\/Mobile Documents\/([^/]+)/);
  if (mob) return providerNameFromContainerId(mob[1]) || undefined;
  return undefined;
}

function providerNameFromContainerId(segment: string): string | undefined {
  let base: string;
  if (!/[.~]/.test(segment)) {
    base = segment;
  } else if (segment.startsWith('com~') || segment.startsWith('com.')) {
    // Use the last reverse-DNS component as the app name — it's the most
    // distinguishing piece ("com~getdropbox~Dropbox" → "Dropbox").
    const parts = segment.replace(/^com[~.]/, '').split(/[~.]/);
    base = parts[parts.length - 1] || segment;
  } else {
    return undefined;
  }
  return canonicalize(base);
}
