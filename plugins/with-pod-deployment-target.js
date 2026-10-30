const { withPodfile } = require('expo/config-plugins');

// Raise every Pod target's IPHONEOS_DEPLOYMENT_TARGET to a floor Xcode accepts.
//
// Xcode 27 refuses deployment targets below iOS 15.0. Most Pods inherit the
// app's target, but some pods declare their own older minimum in the podspec
// and keep it — @react-native-async-storage/async-storage declares 13.4, and
// its resource-bundle target stops the whole build with "the range of
// supported deployment target versions is 15.0 to …". Raising only the app's
// target (expo-build-properties) doesn't reach those per-pod targets, so the
// fix goes into the Podfile's post_install, re-applied on every prebuild
// because ios/ is regenerated from scratch (CNG).
const MIN_TARGET = '15.1';
const MARKER = '# with-pod-deployment-target';

const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        if c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN_TARGET}
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_TARGET}'
        end
      end
    end
`;

module.exports = function withPodDeploymentTarget(config) {
  return withPodfile(config, (cfg) => {
    const podfile = cfg.modResults.contents;
    if (podfile.includes(MARKER)) return cfg;
    // Insert right after react_native_post_install(...) so it runs last and
    // wins over anything that call sets.
    const anchor = /(react_native_post_install\([\s\S]*?\n\s*\))/;
    if (!anchor.test(podfile)) {
      throw new Error('with-pod-deployment-target: react_native_post_install not found in Podfile');
    }
    cfg.modResults.contents = podfile.replace(anchor, `$1\n${SNIPPET}`);
    return cfg;
  });
};
