# Modrift

iOS / Android 向けの軽量モバイルクライアントアプリ。クラウド (iCloud / Google Drive / Dropbox 等) やメール添付にある**単一の Markdown ファイル**を、どこからでもサッと開いて整形表示・軽編集する「軽量 Markdown ビューア＆クイックエディタ」。

詳細は [`docs/Requirements.md`](./docs/Requirements.md) と [`CLAUDE.md`](./CLAUDE.md) を参照。

## 開発

```bash
npm install
npx expo start --dev-client
```

Expo Dev Client が必須 (New Architecture / ネイティブモジュール前提で Expo Go 非対応)。初回のみ EAS でビルドが必要:

```bash
npx eas build --profile development --platform ios
```

ビルドプロファイルは [`eas.json`](./eas.json) を参照 (development / preview / production)。

## ディレクトリ構成

```
src/
  app/           expo-router (ファイルベースルーティング。viewer.tsx = 閲覧+編集画面)
  components/    軽量な theme ラッパー + markdown-web-view (CodeMirror ホスト)
  lib/           ロジック層。cm/ = WebView 上の CodeMirror バンドル (閲覧+編集の描画)
  hooks/         useTheme / useColorScheme / useSettings
  i18n.ts        i18next + expo-localization 初期化
  theme.ts       Colors / Spacing / Fonts
locales/
  {en,ja}/translation.json
docs/
  Requirements.md
```
