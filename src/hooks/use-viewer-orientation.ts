import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { allowLandscapeOnPhone, lockPortraitOnPhone } from '@/lib/orientation';

/**
 * FR-36: let a phone rotate while this screen is focused, and re-lock portrait
 * on the way out. No-ops on iPad, which is free to rotate everywhere (FR-16).
 *
 * One definition for the same reason the extension gate has one (file-types.ts):
 * the policy is per-screen, so every new viewer has to opt in, and the v2
 * viewers shipped without it — PDF, docx and xlsx stayed portrait-locked while
 * Markdown rotated, which is exactly the drift a duplicated three-line effect
 * invites. A wide spreadsheet is the case that wants landscape most.
 */
export function useViewerOrientation(): void {
  useFocusEffect(
    useCallback(() => {
      allowLandscapeOnPhone();
      return () => {
        lockPortraitOnPhone();
      };
    }, []),
  );
}
