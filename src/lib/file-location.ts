import { Paths } from 'expo-file-system';

const ICLOUD_DRIVE_SEGMENT = '/com~apple~CloudDocs/';

// iOS reports the same file as both `file:///var/...` and `file:///private/var/...`
// depending on how the URL was constructed. They point at the same file but are
// different strings, so a naive startsWith() comparison between the app
// container and a file URI can miss. Normalize to the `/private/var/` form
// before comparing (mirrors normalizeUri in recent-files.ts).
function normalizePrivate(uri: string): string {
  return uri.replace(/^file:\/\/\/var\//, 'file:///private/var/');
}

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

export type FileLocationKind = 'icloudDrive' | 'appSandbox' | 'external';

export type FileLocation = {
  kind: FileLocationKind;
  // For external File Providers, the human-readable provider name extracted
  // from the URI when possible (e.g. "Google Drive", "Dropbox"). Undefined
  // when the URI doesn't match a known mount-point pattern.
  providerName?: string;
  // For icloudDrive files, the immediate parent folder name (decoded) so the
  // UI can show "iCloud Drive › Notes", mirroring the Files-app breadcrumb.
  // Undefined when the file sits at the iCloud Drive root.
  folder?: string;
};

// The immediate parent folder of an iCloud Drive file, e.g.
// ".../com~apple~CloudDocs/Documents/Notes/foo.md" → "Notes". Undefined when the
// file is directly at the iCloud Drive root (no folder to show).
function icloudDriveFolder(uri: string): string | undefined {
  const i = uri.indexOf(ICLOUD_DRIVE_SEGMENT);
  if (i < 0) return undefined;
  const after = uri.slice(i + ICLOUD_DRIVE_SEGMENT.length);
  // segments = [...folders, filename]; the parent is the second-to-last.
  const segments = after.split('/').filter(Boolean);
  if (segments.length < 2) return undefined;
  const parent = segments[segments.length - 2];
  try {
    return decodeURIComponent(parent);
  } catch {
    return parent;
  }
}

// Classify the file's storage location for UI labelling in the recent-files
// list. Drives the small subtitle that lets the user distinguish identically-
// named files coming from different places.
export function classifyFileLocation(uri: string): FileLocation {
  if (!uri) return { kind: 'external' };
  if (uri.includes(ICLOUD_DRIVE_SEGMENT)) {
    return { kind: 'icloudDrive', folder: icloudDriveFolder(uri) };
  }
  const root = appContainerRoot();
  if (root && normalizePrivate(uri).startsWith(normalizePrivate(root))) {
    return { kind: 'appSandbox' };
  }
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

function canonicalize(base: string): string | undefined {
  for (const { pattern, name } of KNOWN_PROVIDERS) {
    if (pattern.test(base)) return name;
  }
  // Unknown segment. On some installs the CloudStorage mount is named with an
  // opaque domain UUID (e.g. "A34873B3-4295-..."), not a human provider name —
  // surfacing that raw string as the "provider" is worse than no name. iOS
  // exposes no API to map it back to "Google Drive"/"Dropbox" (verified on
  // device), so return undefined and let the caller fall back to the generic
  // location label rather than leak a UUID.
  return undefined;
}

function detectProvider(uri: string): string | undefined {
  // iOS 16+ third-party File Providers mount under /Library/CloudStorage/<name>/
  // when accessed in place (Files-App view). Folder names look like
  // "GoogleDrive-name@example.com" or just "Drive" so split on "-" first.
  const cs = uri.match(/\/CloudStorage\/([^/]+)/);
  if (cs) {
    const decoded = decodeURIComponent(cs[1]);
    const base = decoded.split('-')[0];
    return canonicalize(base) || undefined;
  }
  // Document Picker URIs go to the third-party provider's AppGroup storage
  // (/Containers/Shared/AppGroup/<UUID>/File Provider Storage/...). The UUID
  // is randomly generated per fresh install of the provider app — there is
  // no public API to map it back to "Google Drive", so we deliberately do
  // not try to identify these. The caller surfaces them as cloud storage.
  // Legacy reverse-DNS Mobile Documents: "com~google~Drive" → "Google Drive".
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
