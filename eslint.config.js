// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Generated WebView bundle (src/lib/cm/build-bundle.mjs).
    ignores: ["dist/*", "src/lib/cm/bundle.ts"],
  }
]);
