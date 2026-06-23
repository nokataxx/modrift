const { withXcodeProject } = require('expo/config-plugins');

// Xcode build-graph fixes needed after expo-share-intent adds the iOS share
// extension target. All are re-applied on every prebuild because the generated
// ios/ project is regenerated from scratch (CNG). The transform is exported so
// the same logic can be applied to an already-generated project if needed.
function applyXcodeFixes(objects) {
  // Fix 1 — break the App Intents metadata extraction cycle (the real fix).
  // Xcode 15+ runs an "ExtractAppIntentsMetadata" step that scans the built app
  // bundle (including the embedded share extension) for App Intents / Siri
  // Shortcuts. Once the extension is embedded, that scan participates in the
  // build graph and forms a cycle: embed ModriftShare.appex → Embed Pods
  // Frameworks → Strip Local Network Keys → process Info.plist →
  // ExtractAppIntentsMetadata → back to the embed. Modrift declares no App
  // Intents, so skipping the extraction removes the cyclic node entirely and is
  // behaviourally a no-op. Applied to every build configuration.
  const buildConfigs = objects.XCBuildConfiguration || {};
  for (const key of Object.keys(buildConfigs)) {
    const cfg = buildConfigs[key];
    if (cfg && typeof cfg === 'object' && cfg.buildSettings) {
      cfg.buildSettings.LM_SKIP_METADATA_EXTRACTION = 'YES';
    }
  }

  // Fix 2 — break the strip-script dependency cycle.
  // expo-dev-client's "[Expo Dev Launcher] Strip Local Network Keys" script
  // declares the app Info.plist as an input and rewrites that plist in place.
  // Once the share extension is embedded, that in-place edit forms a cycle with
  // the tasks that produce/consume the final bundle (Process Info.plist, embed
  // ModriftShare.appex, dSYM generation). Clearing inputPaths/outputPaths removes
  // the strip phase from file-dependency analysis entirely, and alwaysOutOfDate
  // keeps it running every build in its existing phase position — where the
  // Info.plist already exists (it worked there before the extension was added).
  // The script is idempotent, so running it unconditionally is harmless.
  const scriptPhases = objects.PBXShellScriptBuildPhase || {};
  for (const key of Object.keys(scriptPhases)) {
    const phase = scriptPhases[key];
    if (
      phase &&
      typeof phase === 'object' &&
      typeof phase.name === 'string' &&
      phase.name.includes('Strip Local Network Keys')
    ) {
      phase.alwaysOutOfDate = 1;
      phase.inputPaths = [];
      phase.outputPaths = [];
    }
  }

  // Fix 3 — embed the share extension last (Xcode default order).
  // expo-share-intent inserts the "Embed App Extensions" copy phase before
  // "[CP] Embed Pods Frameworks"; both touch BUILT_PRODUCTS_DIR, so the build
  // system reorders them and the listed order no longer matches the data
  // dependency. Moving the embed (dstSubfolderSpec 13 = PlugIns) to the end of
  // the app target's phases keeps the listed order consistent.
  const copyPhases = objects.PBXCopyFilesBuildPhase || {};
  let embedPhaseUuid = null;
  for (const key of Object.keys(copyPhases)) {
    const phase = copyPhases[key];
    if (phase && typeof phase === 'object' && String(phase.dstSubfolderSpec) === '13') {
      embedPhaseUuid = key;
      break;
    }
  }
  if (embedPhaseUuid) {
    const nativeTargets = objects.PBXNativeTarget || {};
    for (const key of Object.keys(nativeTargets)) {
      const target = nativeTargets[key];
      if (!target || typeof target !== 'object' || !Array.isArray(target.buildPhases)) continue;
      const idx = target.buildPhases.findIndex((bp) => bp.value === embedPhaseUuid);
      if (idx !== -1) {
        const [entry] = target.buildPhases.splice(idx, 1);
        target.buildPhases.push(entry);
      }
    }
  }
}

module.exports = function withShareExtensionXcodeFixes(config) {
  return withXcodeProject(config, (cfg) => {
    applyXcodeFixes(cfg.modResults.hash.project.objects);
    return cfg;
  });
};

module.exports.applyXcodeFixes = applyXcodeFixes;
