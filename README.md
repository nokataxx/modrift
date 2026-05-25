# Modrift

iOS / Android 向けの軽量モバイルクライアントアプリ。Google Drive 上の Obsidian Vault (Markdown ファイル) をサクッと閲覧・編集する。

詳細は [`docs/Requirements.md`](./docs/Requirements.md) と [`CLAUDE.md`](./CLAUDE.md) を参照。

## 開発

```bash
npm install
npx expo start --dev-client
```

Expo Dev Client が必須 (Expo Go では `react-native-enriched-markdown` が動かない)。初回のみ EAS でビルドが必要:

```bash
npx eas build --profile development --platform ios
```

ビルドプロファイルは [`eas.json`](./eas.json) を参照 (development / preview / production)。

## ディレクトリ構成

```
src/
  app/           expo-router (ファイルベースルーティング)
  components/    軽量な theme ラッパー (ThemedText, ThemedView)
  hooks/         useTheme / useColorScheme
  i18n.ts        i18next + expo-localization 初期化
  theme.ts       Colors / Spacing / Fonts
locales/
  {en,ja}/translation.json
docs/
  Requirements.md
```
