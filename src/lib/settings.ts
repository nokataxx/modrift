import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPPRESS_ICLOUD_COPY_DIALOG_KEY = 'modrift:settings:suppressIcloudCopyDialog';

export async function getSuppressIcloudCopyDialog(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(SUPPRESS_ICLOUD_COPY_DIALOG_KEY);
  return raw === '1';
}

export async function setSuppressIcloudCopyDialog(value: boolean): Promise<void> {
  if (value) {
    await AsyncStorage.setItem(SUPPRESS_ICLOUD_COPY_DIALOG_KEY, '1');
  } else {
    await AsyncStorage.removeItem(SUPPRESS_ICLOUD_COPY_DIALOG_KEY);
  }
}
