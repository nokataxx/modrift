// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Generated WebView bundles (each format's build-bundle.mjs).
    ignores: ["dist/*", "src/lib/cm/bundle.ts", "src/lib/docx/bundle.ts"],
  }
]);
