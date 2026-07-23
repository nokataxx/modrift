import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform } from 'react-native';

// FR-36: screen orientation policy.
//
// iPhone is portrait-locked everywhere except the viewer, where landscape gives
// long lines room so they wrap far less. iPad already supports every
// orientation on every screen (FR-16 / UISupportedInterfaceOrientations~ipad),
// so these helpers deliberately no-op there and leave the OS in charge.
//
// Info.plist declares all orientations (app.json orientation: "default") —
// without that the OS would refuse landscape outright and these locks would
// have nothing to widen to. The per-screen policy therefore lives here, at
// runtime, rather than in the static manifest.
const isPhone = Platform.OS === 'ios' && !Platform.isPad;

// Portrait-only. Called on startup and whenever the viewer is left, so rotating
// the device while reading doesn't leave the list screens sideways.
export async function lockPortraitOnPhone(): Promise<void> {
  if (!isPhone) return;
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch {
    // Non-fatal: orientation is a reading nicety, never a blocker.
  }
}

// Portrait + both landscapes. DEFAULT is iOS's "everything except upside-down",
// which is exactly the set an iPhone should offer. Called while the viewer is
// focused.
export async function allowLandscapeOnPhone(): Promise<void> {
  if (!isPhone) return;
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
  } catch {
    // Non-fatal.
  }
}
