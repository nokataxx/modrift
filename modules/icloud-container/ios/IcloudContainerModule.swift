import ExpoModulesCore

public class IcloudContainerModule: Module {
  private static let containerIdentifier = "iCloud.com.modrift.app"

  public func definition() -> ModuleDefinition {
    Name("IcloudContainer")

    AsyncFunction("getContainerDocumentsURL") { () -> String? in
      // Blocking call — Apple recommends running off the main thread, which Expo's
      // AsyncFunction already does. Returns nil if iCloud Drive is signed out or
      // the container is not yet available.
      guard let containerURL = FileManager.default.url(
        forUbiquityContainerIdentifier: Self.containerIdentifier
      ) else {
        return nil
      }

      let documentsURL = containerURL.appendingPathComponent("Documents", isDirectory: true)
      try? FileManager.default.createDirectory(
        at: documentsURL,
        withIntermediateDirectories: true
      )
      return documentsURL.absoluteString
    }
  }
}
