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

    // Materialize a file into our own sandbox and return a local file:// URI.
    //
    // This is readFileCoordinated's counterpart for binary formats (PDF / docx /
    // xlsx, v2). That one ends in String(contentsOf:encoding:.utf8), so it can
    // only serve text — the bytes of a PDF are not valid UTF-8. Rather than hand
    // bytes across the bridge (a 30MB PDF becomes a ~40MB base64 string, and
    // PDFKit would only write them back to disk anyway), copy the file under
    // coordination and hand back a path.
    //
    // Once the bytes are inside our sandbox the File Provider problem is gone:
    // the copy is a real local file, so ordinary uncoordinated APIs work again —
    // PDFKit takes the path directly, and expo-file-system's arrayBuffer() can
    // read it for mammoth / SheetJS. One function covers all three formats.
    //
    // The copy must happen INSIDE the coordination block. A plain copy of a
    // not-yet-downloaded placeholder fails with "no such file" — that is the
    // same failure that ruled out the picker's copyToCacheDirectory:true (FR-40).
    AsyncFunction("materializeFileCoordinated") { (uri: String) throws -> String in
      guard let url = URL(string: uri) else {
        throw NSError(domain: NSCocoaErrorDomain, code: NSFileReadInvalidFileNameError)
      }

      let fileManager = FileManager.default

      // Files already inside our own sandbox (the on-device home under Documents,
      // or a previous materialization in Caches) are real local bytes — copying
      // them would just duplicate a large file for nothing. Note this must NOT
      // skip the iCloud home: the ubiquity container lives outside the sandbox,
      // under Mobile Documents, and its files can be evicted, so those still need
      // coordinating. Symlinks are resolved on both sides because iOS reports the
      // same path as both /var/... and /private/var/... (mirrors normalizePrivate
      // in src/lib/file-location.ts).
      let sourcePath = url.resolvingSymlinksInPath().path
      let sandboxRoots = [
        fileManager.urls(for: .documentDirectory, in: .userDomainMask).first,
        fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first,
      ].compactMap { $0?.resolvingSymlinksInPath().path }
      if sandboxRoots.contains(where: { sourcePath.hasPrefix($0) }) {
        return uri
      }

      let didStart = url.startAccessingSecurityScopedResource()
      defer {
        if didStart { url.stopAccessingSecurityScopedResource() }
      }

      guard let cachesUrl = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first else {
        throw NSError(domain: NSCocoaErrorDomain, code: NSFileNoSuchFileError)
      }
      // A dedicated subfolder so these copies are identifiable and can be cleared
      // wholesale. iOS reclaims Caches under storage pressure, which is the right
      // lifetime for them: each is reproducible by materializing again.
      let destinationDirectory = cachesUrl.appendingPathComponent("MaterializedFiles", isDirectory: true)
      try fileManager.createDirectory(at: destinationDirectory, withIntermediateDirectories: true)
      // Keyed by file name, so re-opening the same document reuses the same path
      // instead of growing the cache. Two same-named files from different sources
      // therefore overwrite each other — harmless, because the copy is only ever
      // read straight after being written, for the document just opened.
      let destination = destinationDirectory.appendingPathComponent(url.lastPathComponent)

      let coordinator = NSFileCoordinator()
      var coordinationError: NSError?
      var copyError: Error?
      coordinator.coordinate(readingItemAt: url, options: [], error: &coordinationError) { coordinatedUrl in
        do {
          // Replace any previous copy: the source may have changed since, and
          // copyItem refuses to overwrite.
          if fileManager.fileExists(atPath: destination.path) {
            try fileManager.removeItem(at: destination)
          }
          try fileManager.copyItem(at: coordinatedUrl, to: destination)
        } catch {
          copyError = error
        }
      }
      if let coordinationError { throw coordinationError }
      if let copyError { throw copyError }
      return destination.absoluteString
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
