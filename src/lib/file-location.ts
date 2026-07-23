import { Paths } from 'expo-file-system';

const UBIQUITY_CONTAINER_SEGMENT = '/iCloud~com~modrift~app/';
const ICLOUD_DRIVE_SEGMENT = '/com~apple~CloudDocs/';

// FR-31: the on-device home IS the app's Documents directory — that is exactly
// what UIFileSharingEnabled surfaces as "On My iPhone › Modrift" (Modrift being
// the app's display name). Using a subfolder here would show as a confusing
// "Modrift › Modrift" nesting in the Files app, so the home is the Documents
// root itself. Home files are the DIRECT children of Documents; subfolders
// (e.g. an Open-In Inbox) are excluded from the home (see isLocalHomeFile).
export function localHomeDirectoryUri(): string | null {
  try {
    const doc = Paths.document.uri; // file://.../Documents/ (trailing slash)
    return doc.endsWith('/') ? doc : `${doc}/`;
  } catch {
    return null;
  }
}

// True for a file sitting directly in the on-device home (Documents root), not
// in a subfolder. Keeps Inbox / other sandbox subfolders out of "home" so they
// stay view-only (Policy A) instead of becoming editable.
function isLocalHomeFile(uri: string): boolean {
  const home = localHomeDirectoryUri();
  if (home === null) return false;
  const u = normalizePrivate(uri);
  const h = normalizePrivate(home);
  if (!u.startsWith(h)) return false;
  const rest = u.slice(h.length);
  return rest.length > 0 && !rest.includes('/');
}

// iOS reports the same file as both `file:///var/...` and `file:///private/var/...`
// depending on how the URL was constructed. They point at the same file but are
// different strings, so a naive startsWith() comparison between the document
// dir and an Open-In Inbox URI can miss. Normalize to the `/private/var/` form
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

// Policy A (v1.4): editing is limited to the app's home folder — the iCloud ›
// Modrift ubiquity container. Third-party clouds, the app sandbox, AND iCloud
// Drive files OUTSIDE the Modrift folder are all view-only; editing them means
// first taking an explicit "copy to home" (FR-34). This replaces the pre-v1.4
// gate (isInPlaceEditable), which let any iCloud Drive file be edited in place —
// now iCloud Drive outside Modrift is view+copy like everything else, so there's
// one simple rule for the user ("you can edit files in your home"). FR-31
// (home on-device) will extend this to also accept the local home directory.
export function isHomeFile(uri: string): boolean {
  if (!uri) return false;
  if (uri.includes(UBIQUITY_CONTAINER_SEGMENT)) return true; // iCloud home
  return isLocalHomeFile(uri); // on-device home (direct children of Documents)
}

export type FileLocationKind = 'icloudCopy' | 'localHome' | 'icloudDrive' | 'appSandbox' | 'external';

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
  if (uri.includes(UBIQUITY_CONTAINER_SEGMENT)) return { kind: 'icloudCopy' };
  if (uri.includes(ICLOUD_DRIVE_SEGMENT)) {
    return { kind: 'icloudDrive', folder: icloudDriveFolder(uri) };
  }
  // FR-31 on-device home (App Documents root) — checked before the generic
  // app-sandbox test below, since it lives inside the sandbox but is a home file.
  if (isLocalHomeFile(uri)) return { kind: 'localHome' };
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

// A stable identifier for the third-party cloud source a file came from. iOS
// embeds a per-provider container id in the path — Document-Picker URIs under
// the provider's AppGroup, Files-app in-place URIs under /CloudStorage, legacy
// ones under /Mobile Documents. The id is opaque (usually a UUID) but stable
// within an install, so it groups all files from the same source. We can't turn
// it into "Google Drive"/"Dropbox" (iOS exposes no such API — verified), but it
// lets the user name each source once (see cloud-names) and tell two clouds
// apart even before they do.
export function externalContainerKey(uri: string): string | undefined {
  if (!uri) return undefined;
  const m =
    uri.match(/\/AppGroup\/([^/]+)/) ??
    uri.match(/\/CloudStorage\/([^/]+)/) ??
    uri.match(/\/Mobile Documents\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

// A short, stable tag derived from the container key (first hex group of the
// UUID), shown as "他のクラウド · A348" so identically-labelled sources are at
// least visually distinct until the user names them.
export function shortContainerTag(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
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
