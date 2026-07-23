import { Directory, File } from 'expo-file-system';

import { isHomeFile } from './file-location';
import { getHomeDirectoryUri } from './home-files';
import { type HomeLocation } from './settings';

export class IcloudUnavailableError extends Error {
  constructor() {
    super('iCloud Drive is not available on this device');
    this.name = 'IcloudUnavailableError';
  }
}

export class IcloudCopyFailedError extends Error {
  constructor(cause?: unknown) {
    super('Failed to create iCloud copy');
    this.name = 'IcloudCopyFailedError';
    if (cause instanceof Error) this.cause = cause;
  }
}

// Raised when a rename/delete targets a file that isn't a Modrift-generated
// iCloud copy — a guard against turning into a general file manager (FR-22).
export class NotAnIcloudCopyError extends Error {
  constructor() {
    super('File is not a Modrift iCloud copy');
    this.name = 'NotAnIcloudCopyError';
  }
}

// Raised when a rename target name already exists in the Modrift folder.
export class NameInUseError extends Error {
  constructor() {
    super('A file with that name already exists');
    this.name = 'NameInUseError';
  }
}

function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

// Modrift treats the iCloud editing copy as the user's "real" file going
// forward, and we always read/write it as Markdown — normalize any source
// extension (.txt, .text, .markdown, none) to .md so the iCloud Drive >
// Modrift folder stays uniformly Markdown.
function normalizeToMarkdownName(originalName: string): string {
  const { base, ext } = splitFileName(originalName);
  return ext.toLowerCase() === '.md' ? originalName : `${base}.md`;
}

// Pick `originalName` if it isn't taken, otherwise `${base}-1${ext}`, `${base}-2${ext}`, ...
// `exists` decides whether a candidate name is already taken in the destination directory.
export function findAvailableCopyName(
  originalName: string,
  exists: (name: string) => boolean,
): string {
  if (!exists(originalName)) return originalName;
  const { base, ext } = splitFileName(originalName);
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base}-${i}${ext}`;
    if (!exists(candidate)) return candidate;
  }
  throw new Error(`Could not find an available copy name for "${originalName}"`);
}

// Copy `content` into the app's iCloud ubiquity container's Documents folder, picking a
// non-colliding filename based on `originalName`. Returns the new file's URI and name.
//
// Uses the synchronous expo-file-system File/Directory API deliberately: it
// writes through NSFileCoordinator, which is required for the iCloud ubiquity
// container (the async legacy writeAsStringAsync does not coordinate and fails
// there). Throws IcloudUnavailableError when iCloud Drive is not signed in /
// disabled, and IcloudCopyFailedError on filesystem errors.
export async function createIcloudCopy(
  content: string,
  originalName: string,
  location: HomeLocation = 'icloud',
): Promise<{ uri: string; name: string }> {
  // FR-31: write into the active home. 'local' always resolves to a created
  // dir; 'icloud' is null (→ IcloudUnavailableError) when iCloud is signed out.
  const documentsUri = await getHomeDirectoryUri(location);
  if (documentsUri === null) throw new IcloudUnavailableError();

  try {
    const dir = new Directory(documentsUri);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

    const name = findAvailableCopyName(normalizeToMarkdownName(originalName), (candidate) => {
      return new File(dir, candidate).exists;
    });
    const file = new File(dir, name);
    file.create();
    file.write(content);
    return { uri: file.uri, name };
  } catch (err) {
    throw new IcloudCopyFailedError(err);
  }
}

// Turn a user-typed name into a `.md` filename without mangling interior dots:
// strip any path separators, drop a trailing `.md`, then re-append it. So
// "My Notes" → "My Notes.md" and "v1.2 plan" → "v1.2 plan.md".
// Exported for the pre-creation rename of a new note (FR-22/FR-23), which
// stores the user-typed name until the lazy file creation uses it.
export function toMarkdownFileName(input: string): string {
  const cleaned = input.trim().replace(/[/\\]/g, '');
  return `${cleaned.replace(/\.md$/i, '')}.md`;
}

// Guard for rename/delete/duplicate: the target must be one of Modrift's own
// home files (iCloud › Modrift OR the on-device home) — never an arbitrary file.
// FR-31 means "home" can be either location, so this uses isHomeFile rather than
// the iCloud-only classification.
function ensureHomeFile(uri: string): void {
  if (!isHomeFile(uri)) {
    throw new NotAnIcloudCopyError();
  }
}

// Rename a Modrift-generated iCloud copy to a user-chosen name (FR-22).
// Returns the new uri and name. Throws NotAnIcloudCopyError for anything
// outside our iCloud container, NameInUseError on collision, and
// IcloudCopyFailedError for an empty name or filesystem failure.
export function renameIcloudCopy(
  uri: string,
  newBaseName: string,
): { uri: string; name: string } {
  ensureHomeFile(uri);
  if (!newBaseName.trim()) throw new IcloudCopyFailedError();
  const name = toMarkdownFileName(newBaseName);
  const file = new File(uri);
  if (name === file.name) return { uri: file.uri, name }; // unchanged
  try {
    if (new File(file.parentDirectory, name).exists) throw new NameInUseError();
    file.rename(name);
    return { uri: file.uri, name };
  } catch (err) {
    if (err instanceof NameInUseError) throw err;
    throw new IcloudCopyFailedError(err);
  }
}

// Duplicate a Modrift iCloud copy in place (FR-35). Copies the file's bytes to
// a new, non-colliding "… copy" name in the same folder and returns the new
// uri/name. copySync (not read+write) is used so the copy goes through the same
// NSFileCoordinator path the container requires and preserves the bytes exactly.
// Throws NotAnIcloudCopyError outside our container, IcloudCopyFailedError on
// filesystem failure.
export function duplicateIcloudCopy(uri: string): { uri: string; name: string } {
  ensureHomeFile(uri);
  try {
    const source = new File(uri);
    const dir = source.parentDirectory;
    const { base, ext } = splitFileName(source.name);
    const name = findAvailableCopyName(`${base} copy${ext}`, (candidate) => {
      return new File(dir, candidate).exists;
    });
    const dest = new File(dir, name);
    source.copySync(dest);
    return { uri: dest.uri, name };
  } catch (err) {
    throw new IcloudCopyFailedError(err);
  }
}

// Delete a Modrift-generated iCloud copy's file body (FR-22). Caller is
// responsible for the confirmation dialog and for pruning the history entry.
export function deleteIcloudCopy(uri: string): void {
  ensureHomeFile(uri);
  try {
    new File(uri).delete();
  } catch (err) {
    throw new IcloudCopyFailedError(err);
  }
}
