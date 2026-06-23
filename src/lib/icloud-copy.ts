import { Directory, File } from 'expo-file-system';

import IcloudContainerModule from '@modules/icloud-container';

import { classifyFileLocation } from './file-location';

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
// Throws IcloudUnavailableError when iCloud Drive is not signed in / disabled, and
// IcloudCopyFailedError on filesystem errors.
export async function createIcloudCopy(
  content: string,
  originalName: string,
): Promise<{ uri: string; name: string }> {
  const documentsUri = await IcloudContainerModule.getContainerDocumentsURL();
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
function toMarkdownFileName(input: string): string {
  const cleaned = input.trim().replace(/[/\\]/g, '');
  return `${cleaned.replace(/\.md$/i, '')}.md`;
}

function ensureIcloudCopy(uri: string): void {
  if (classifyFileLocation(uri).kind !== 'icloudCopy') {
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
  ensureIcloudCopy(uri);
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

// Delete a Modrift-generated iCloud copy's file body (FR-22). Caller is
// responsible for the confirmation dialog and for pruning the history entry.
export function deleteIcloudCopy(uri: string): void {
  ensureIcloudCopy(uri);
  try {
    new File(uri).delete();
  } catch (err) {
    throw new IcloudCopyFailedError(err);
  }
}
