// Dynamic config layered on top of app.json (Expo app variants).
//
// Building with APP_VARIANT=development produces a separate app —
// "Modrift Dev" / com.modrift.app.dev / modrift-dev scheme — that installs
// alongside the production (TestFlight / App Store) build com.modrift.app
// instead of overwriting it. Same bundle id = one app slot on a device, so a
// distinct bundle id is what lets the two coexist.
//
// The share-extension bundle id (…app.dev.share-extension) follows the main
// bundle id automatically. The iCloud container and share-extension App Group
// stay shared with production (acceptable for testing); split them later if dev
// data needs to be isolated. Production builds (no APP_VARIANT) use app.json
// unchanged, so TestFlight/App Store are unaffected.
const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }) => {
  if (!IS_DEV) return config;
  return {
    ...config,
    name: 'Modrift Dev',
    scheme: 'modrift-dev',
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.modrift.app.dev',
    },
  };
};
