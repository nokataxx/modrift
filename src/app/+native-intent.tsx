// Handles "Open In" launches (経路B). iOS already filters by UTI via
// CFBundleDocumentTypes (markdown / plain-text), so any file:// URL that reaches
// us is an acceptable file. We must NOT re-filter by extension here, because the
// source app (e.g. Google Drive) may deliver a name without a recognizable
// extension. expo-router would otherwise treat the file:// URL as an unknown
// route ("Unmatched Route"), so we rewrite it into the in-app viewer route.
//
// Files that iOS copied into our Inbox (i.e. came from apps without File
// Provider in-place support — Mail attachments, AirDrop, etc.) carry an
// `openInPending=true` flag. These are throwaway sandbox copies: the viewer
// opens them in preview like any other file, keeps them out of history, and
// deletes them on leave — or, if the user edits, turns them into a durable
// iCloud copy and removes the Inbox source.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    // A file shared through the iOS Share Sheet (FR-08) reaches us as a custom-
    // scheme deep link (modrift://dataUrl=...) from expo-share-intent, not as a
    // file:// URL. Without this, expo-router treats it as an unknown route
    // ("Unmatched Route"). Send it to home so ShareIntentHandler can read the
    // shared file from the share-intent context and route it into the viewer
    // (the openInPending throwaway-copy flow).
    if (path.includes('dataUrl=')) return '/';
    if (!path.startsWith('file://')) return path;
    const fileName = decodeURIComponent(path.split('/').pop() ?? 'file');
    const isInbox = path.includes('/Documents/Inbox/');
    const base = `/viewer?fileUri=${encodeURIComponent(path)}&fileName=${encodeURIComponent(fileName)}`;
    return isInbox ? `${base}&openInPending=true` : base;
  } catch {
    return '/';
  }
}
