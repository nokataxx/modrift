import { Directory, File } from 'expo-file-system';

import IcloudContainerModule from '@modules/icloud-container';

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

function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
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

    const name = findAvailableCopyName(originalName, (candidate) => {
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
