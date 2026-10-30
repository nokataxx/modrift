# Modrift

iPhone / iPad 向けの無料ビューア。Files App では生テキストのまま表示されてしまうファイル (Markdown など) を、iCloud Drive・Google Drive・Dropbox・メール添付のどこからでも開いて、整形して読む。**閲覧専用**で、編集・課金はない。

詳細は [`docs/Requirements.md`](./docs/Requirements.md) を参照。

## 開発

```bash
npm install
npm run start:dev        # APP_VARIANT=development で Metro を起動
```

Expo Dev Client が必須 (New Architecture / ネイティブモジュール前提で Expo Go 非対応)。初回のみ EAS でビルドが必要:

```bash
npx eas build --profile development --platform ios
```

ビルドプロファイルは [`eas.json`](./eas.json) を参照 (development / preview / production)。

**dev バリアントは別アプリ** (`com.modrift.app.dev` / スキーム `modrift-dev`) として本番と共存する。Bundle ID は pbxproj に焼き込まれるので、**切り替えには `npm run prebuild:dev` (= `prebuild --clean`) が必要**。素の `npm start` で起動するとスキームが合わず、共有拡張や Open In がホーム画面で止まる。

## ディレクトリ構成

```
src/
  app/           expo-router (ファイルベースルーティング)
                   index.tsx    = ホーム (最近見たファイル + ファイルを開く)
                   viewer.tsx   = ビューア
                   settings.tsx = 設定
  components/    theme ラッパー + markdown-web-view (CodeMirror ホスト) + viewer-header
  lib/           ロジック層
                   cm/          WebView 上の CodeMirror バンドル (読み取り専用の描画)
  hooks/         useTheme / useSettings / useViewerOrientation ほか
  i18n.ts        i18next + expo-localization 初期化
  theme.ts       Colors / Spacing / Fonts
modules/
  file-bookmark/ NSFileCoordinator による協調読み込み (未実体化ファイル対策) と Security-Scoped Bookmark
locales/
  {en,ja}/translation.json
docs/
  Requirements.md  仕様の正 (v3〜)
```
