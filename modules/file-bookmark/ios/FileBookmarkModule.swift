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
      do {
        // getIdentifierForUserVisibleFile throws for files that aren't
        // surfaced by a third-party File Provider (our own sandbox, iCloud
        // copies in our ubiquity container, etc.) — caller falls back to
        // the URI-based classification in those cases.
        let (_, domainIdentifier) = try await NSFileProviderManager
          .getIdentifierForUserVisibleFile(at: url)
        let domains = try await NSFileProviderManager.domains()
        return domains.first(where: { $0.identifier == domainIdentifier })?.displayName
      } catch {
        return nil
      }
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
