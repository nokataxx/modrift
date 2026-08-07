import { useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect } from 'react';

import { routeForFile } from '@/lib/file-types';

// Routes a file arriving through the iOS Share Sheet (FR-08) into the viewer.
//
// A shared file is delivered as a throwaway copy in the app-group container —
// the same nature as an Open-In Inbox copy (経路B) — so we hand it to the
// existing openInPending flow rather than inventing a new one: the viewer opens
// it preview-first, keeps it out of history, and either deletes it on leave or
// promotes it to a durable iCloud copy when the user edits (see viewer.tsx).
//
// Renders nothing; it only watches the share-intent context and navigates.
export function ShareIntentHandler() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) return;
    // We only handle file shares. Text / URL shares have no file to open, so we
    // just clear them (Modrift is a file client, not a note-capture target).
    const file = shareIntent.files?.[0];
    if (!file?.path) {
      resetShareIntent();
      return;
    }
    const fileUri = file.path.startsWith('file://') ? file.path : `file://${file.path}`;
    const fileName = file.fileName || decodeURIComponent(fileUri.split('/').pop() ?? 'file');
    router.push({
      // FR-21: route by type, same as every other entry point.
      pathname: routeForFile(fileName),
      params: { fileUri, fileName, openInPending: 'true' },
    });
    // Clear so re-foregrounding or a second share doesn't re-trigger the push.
    resetShareIntent();
  }, [hasShareIntent, shareIntent, router, resetShareIntent]);

  return null;
}
