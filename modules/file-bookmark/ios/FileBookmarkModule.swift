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
        // Use a full bookmark (not .minimalBookmark): the minimal form can drop
        // the persisted security scope, which iCloud tolerates (covered by the
        // app's iCloud entitlement) but third-party File Providers like Google
        // Drive do not — their bookmarks then resolve to a URL that
        // startAccessingSecurityScopedResource() can't actually open.
        let data = try url.bookmarkData(
          options: [],
          includingResourceValuesForKeys: nil,
          relativeTo: nil
        )
        return data.base64EncodedString()
      } catch {
        return nil
      }
    }

    // Read a file's UTF-8 text through an NSFileCoordinator coordinated read.
    // This is what makes not-yet-downloaded third-party File Provider files
    // (e.g. Google Drive placeholders) readable: the coordinated read tells the
    // provider to materialize (download) the file before the accessor runs.
    // expo-file-system's File.text() does a plain contentsOf with no
    // coordination, which throws "no such file" (or hangs) on a placeholder —
    // and we can't fix it there because expo modules ship precompiled, so the
    // coordinated read lives in this (always-from-source) module instead.
    AsyncFunction("readFileCoordinated") { (uri: String) throws -> String in
      guard let url = URL(string: uri) else {
        throw NSError(domain: NSCocoaErrorDomain, code: NSFileReadInvalidFileNameError)
      }
      // Picker/Open-In URLs are security-scoped; iCloud / third-party providers
      // need an explicit start. (The picker also holds a session-wide scope, but
      // starting again here is safe and covers history/bookmark-resolved URLs.)
      let didStart = url.startAccessingSecurityScopedResource()
      defer {
        if didStart { url.stopAccessingSecurityScopedResource() }
      }

      let coordinator = NSFileCoordinator()
      var coordinationError: NSError?
      var text: String?
      var readError: Error?
      coordinator.coordinate(readingItemAt: url, options: [], error: &coordinationError) { coordinatedUrl in
        do {
          text = try String(contentsOf: coordinatedUrl, encoding: .utf8)
        } catch {
          readError = error
        }
      }
      if let coordinationError { throw coordinationError }
      if let readError { throw readError }
      guard let text else {
        throw NSError(domain: NSCocoaErrorDomain, code: NSFileReadUnknownError)
      }
      return text
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
