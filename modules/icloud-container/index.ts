import { requireNativeModule } from 'expo-modules-core';

export interface IcloudContainerModuleType {
  // Returns the URI of the app's iCloud ubiquity container's Documents folder
  // (file://.../Mobile Documents/iCloud~com~nokata~modrift/Documents/), or null
  // if iCloud Drive is not available (signed out or disabled).
  getContainerDocumentsURL(): Promise<string | null>;
}

const IcloudContainerModule = requireNativeModule<IcloudContainerModuleType>('IcloudContainer');

export default IcloudContainerModule;
