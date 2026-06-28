import { File } from 'expo-file-system';

// Markdown image syntax: ![alt](url) or ![alt](url "title").
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

// Cap inlined images so a huge file can't blow up memory by becoming a multi-MB
// base64 string embedded in the document. Larger local images fall back to the
// text placeholder.
const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  svg: 'image/svg+xml',
};

// http/https are remote; data: is already inlined. Everything else is treated
// as a local file reference.
function isRemote(url: string): boolean {
  return /^(https?:|data:)/i.test(url);
}

// Resolve a possibly-relative image URL against the directory of the Markdown
// file. Absolute file:// URLs and rooted paths pass through; relative paths
// (image.png, ./img/a.png, ../assets/b.png) are joined onto baseDir with the
// `.` and `..` segments collapsed.
function resolveImageUri(url: string, baseDir: string): string | null {
  if (url.startsWith('file://')) return url;
  if (url.startsWith('/')) return `file://${url}`;
  const baseParts = baseDir.replace(/^file:\/\//, '').split('/').filter(Boolean);
  for (const part of url.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') baseParts.pop();
    else baseParts.push(part);
  }
  if (baseParts.length === 0) return null;
  return `file:///${baseParts.join('/')}`;
}

function mimeFor(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase().split(/[?#]/)[0] ?? '';
  return MIME_BY_EXT[ext] ?? 'image/png';
}

// FR-18: replace local image references with inlined base64 `data:` URIs so the
// Markdown renderer can display them. The renderer loads images via NSURLSession,
// which doesn't support `file://` but does support `data:`, so inlining the bytes
// is the way to show on-disk images. Reading them requires the Vault folder's
// security scope to be active (see activateVaultScope in vault-folder.ts).
//
// Images that can't be read (no scope, missing, too large) fall back to the
// text placeholder; remote (http/https) and already-inlined (data:) images are
// left untouched.
export async function inlineLocalImages(
  md: string,
  baseFileUri: string,
  placeholder: (filename: string) => string,
): Promise<string> {
  const baseDir = baseFileUri.slice(0, baseFileUri.lastIndexOf('/') + 1);

  // Resolve the distinct local image URLs up front (concurrently), then do a
  // single synchronous replace from the precomputed map — String.replace can't
  // await per match.
  const localUrls = new Set<string>();
  for (const m of md.matchAll(IMAGE_RE)) {
    if (!isRemote(m[2])) localUrls.add(m[2]);
  }
  if (localUrls.size === 0) return md;

  const dataUriByUrl = new Map<string, string | null>();
  await Promise.all(
    Array.from(localUrls, async (url) => {
      try {
        const abs = resolveImageUri(decodeURI(url), baseDir);
        if (abs === null) {
          dataUriByUrl.set(url, null);
          return;
        }
        const file = new File(abs);
        if (!file.exists || (file.size ?? 0) > MAX_INLINE_IMAGE_BYTES) {
          dataUriByUrl.set(url, null);
          return;
        }
        const base64 = await file.base64();
        dataUriByUrl.set(url, `data:${mimeFor(abs)};base64,${base64}`);
      } catch {
        dataUriByUrl.set(url, null);
      }
    }),
  );

  return md.replace(IMAGE_RE, (match, alt: string, url: string) => {
    if (isRemote(url)) return match;
    const dataUri = dataUriByUrl.get(url);
    if (dataUri) return `![${alt}](${dataUri})`;
    let filename = url;
    try {
      filename = decodeURI(url).split('/').pop() || url;
    } catch {
      // Malformed escape sequence — fall back to the raw url as the name.
    }
    return placeholder(filename);
  });
}
