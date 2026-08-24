# Modrift

iOS / Android 向けの軽量モバイルクライアントアプリ。クラウド (iCloud / Google Drive / Dropbox 等) やメール添付にある**単一ファイル**を、どこからでもサッと開いて読むための「軽量ファイルビューア＆クイックエディタ」。特定の Vault やアプリに縛られないのが芯。

- **Markdown / テキスト / 画像** — 無料。Md は整形表示に加えて**軽編集**もできる (編集はアプリのホームフォルダ内のみ)
- **PDF / Word (.docx) / Excel (.xlsx)** — 買い切りの App 内課金で解錠。**閲覧専用**

詳細は [`docs/Requirements.md`](./docs/Requirements.md) と [`CLAUDE.md`](./CLAUDE.md) を参照。

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

> **しばらく触っていない場合は [build-and-run.md の「開発を再開するとき」](./docs/build-and-run.md#開発を再開するときしばらく触っていない場合)から。** 現在地の確認・止め忘れた Metro の扱い・`prebuild --clean` の要否まで手順化してある。

**dev バリアントは別アプリ** (`com.modrift.app.dev` / スキーム `modrift-dev`) として本番と共存する。Bundle ID は pbxproj に焼き込まれるので、**切り替えには `npm run prebuild:dev` (= `prebuild --clean`) が必要**。素の `npm start` で起動するとスキームが合わず、共有拡張や Open In がホーム画面で止まる。

## ディレクトリ構成

```
src/
  app/           expo-router (ファイルベースルーティング)
                   viewer.tsx      = Markdown の閲覧+編集
                   pdf/docx/xlsx/image-viewer.tsx = 形式別ビューア (前3つは Pro)
  components/    theme ラッパー + markdown-web-view (CodeMirror ホスト) + paywall
  lib/           ロジック層
                   cm/         WebView 上の CodeMirror バンドル (閲覧+編集の描画)
                   docx/       mammoth で OOXML → HTML
                   xlsx/       SheetJS でワークブック → HTML テーブル
                   purchases.ts RevenueCat の唯一の窓口
  hooks/         useTheme / useSettings / useProEntitlement / useViewerOrientation ほか
  i18n.ts        i18next + expo-localization 初期化
  theme.ts       Colors / Spacing / Fonts
modules/
  file-bookmark/    NSFileCoordinator による協調読み込み (未実体化ファイル対策)
  icloud-container/ iCloud › Modrift (ホームフォルダ) へのアクセス
locales/
  {en,ja}/translation.json
docs/
  Requirements.md            仕様の正 (FR 番号と改訂履歴)
  adr-v2-pro-formats.md      v2 (他形式閲覧 + 課金) の判断と検証記録
  app-store-*.md             提出手順 / 掲載文 / マーケティング
  screenshot-recipe.md       ストア用スクショの撮影手順 (シミュレータ全自動)
```
