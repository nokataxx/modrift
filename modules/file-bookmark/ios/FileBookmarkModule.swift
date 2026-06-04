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

      // Both APIs use completion handlers across the iOS versions we target;
      // wrap each in a continuation so the function stays async/await-friendly.
      let domainIdentifier: NSFileProviderDomainIdentifier? = await withCheckedContinuation { continuation in
        NSFileProviderManager.getIdentifierForUserVisibleFile(at: url) { _, identifier, _ in
          // For files outside any third-party File Provider (our own sandbox,
          // iCloud copies in our ubiquity container, etc.) the callback yields
          // nil identifiers + a non-nil error; we just surface that as nil.
          continuation.resume(returning: identifier)
        }
      }
      guard let domainIdentifier else { return nil }

      let domains: [NSFileProviderDomain] = await withCheckedContinuation { continuation in
        NSFileProviderManager.getDomainsWithCompletionHandler { domains, _ in
          continuation.resume(returning: domains)
        }
      }
      return domains.first(where: { $0.identifier == domainIdentifier })?.displayName
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
