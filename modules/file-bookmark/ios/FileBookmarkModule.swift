import ExpoModulesCore
import FileProvider

public class FileBookmarkModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FileBookmark")

    AsyncFunction("getProviderDisplayName") { (uri: String) async -> String? in
      guard let url = URL(string: uri) else { return nil }
      let didStart = url.startAccessingSecurityScopedResource()
      defer {
        if didStart { url.stopAccessingSecurityScopedResource() }
      }

      // Document Picker URIs point at the third-party File Provider's on-disk
      // AppGroup storage (e.g. /Containers/Shared/AppGroup/<UUID>/File Provider
      // Storage/...), not at the user-visible Files-App URL. Walk every
      // installed domain, compare the URL prefix against each domain's
      // documentStorageURL, and return the matching domain's display name.
      let domains: [NSFileProviderDomain] = await withCheckedContinuation { continuation in
        NSFileProviderManager.getDomainsWithCompletionHandler { domains, _ in
          continuation.resume(returning: domains)
        }
      }

      let urlPath = url.standardizedFileURL.path
      for domain in domains {
        guard let manager = NSFileProviderManager(for: domain) else { continue }
        let storagePath = manager.documentStorageURL.standardizedFileURL.path
        if urlPath.hasPrefix(storagePath) {
          return domain.displayName
        }
      }
      return nil
    }

    AsyncFunction("createBookmark") { (uri: String) -> String? in
      guard let url = URL(string: uri) else { return nil }

      // Files from UIDocumentPicker / Open-In already carry implicit
      // security-scoped access for the current invocation, but iCloud /
      // third-party File Provider URLs require an explicit start before
      // bookmarkData can read them.
      let didStart = url.startAccessingSecurityScopedResource()
      defer {
        if didStart { url.stopAccessingSecurityScopedResource() }
      }

      do {
        let data = try url.bookmarkData(
          options: [.minimalBookmark],
          includingResourceValuesForKeys: nil,
          relativeTo: nil
        )
        return data.base64EncodedString()
      } catch {
        return nil
      }
    }

    AsyncFunction("resolveBookmark") { (base64: String) -> [String: Any]? in
      guard let data = Data(base64Encoded: base64) else { return nil }

      var isStale = false
      do {
        let url = try URL(
          resolvingBookmarkData: data,
          options: [],
          relativeTo: nil,
          bookmarkDataIsStale: &isStale
        )
        // Start access and leave it held for the rest of the app lifetime.
        // iOS reclaims the scope at termination; the slight overhead of not
        // pairing every start with a stop is acceptable for typical sessions.
        _ = url.startAccessingSecurityScopedResource()
        return [
          "uri": url.absoluteString,
          "isStale": isStale,
        ]
      } catch {
        return nil
      }
    }
  }
}
