import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { allowLandscapeOnPhone, lockPortraitOnPhone } from '@/lib/orientation';

/**
 * FR-07: let a phone rotate while this screen is focused, and re-lock portrait
 * on the way out. No-ops on iPad, which is free to rotate everywhere.
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
