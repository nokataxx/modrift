# Modrift Project Context

This file is the persistent context for Claude Code working on the Modrift project.

## What we're building

**Modrift** は iPhone / iPad 向けの**無料・閲覧専用**ビューア。**Files App では生テキストのまま表示されてしまうファイル**を、どこからでも開いて整形して読む。

- **対応形式**: Markdown・プレーンテキスト。v3 で構造化データ (JSON / YAML / TOML / XML) とソースコードのハイライトを足し、以降 CSV/TSV・Jupyter Notebook (.ipynb) へ広げる
- **どこのファイルでも同じ扱い**: iCloud Drive・Google Drive・Dropbox・メール添付のどれでも、開ければ読める
- **想定利用者**: 開発者・技術系。より広い層へ広げるかは、議論してバージョンアップで扱う
- **名前の由来**: Mo (Mobile) + drift (漂う、流れる)

詳細仕様は [docs/Requirements.md](docs/Requirements.md) を参照。**機能の追加・変更の前に、必ず該当 FR と「6. 意図的に実装しないもの」を確認する**。

### やらないこと (v3 で捨てたもの)

v2 までは編集・ホームフォルダ (iCloud › Modrift)・有償 Pro (PDF / Word / Excel) を持っていたが、v3 で仕様を白紙から見直して**すべて削除した**。次のものを提案しない:

- **編集** (Markdown・コードとも)。書き戻しの可否がプロバイダで異なる iOS の制約が、v1〜v2 の複雑さの原因だった
- **ファイル管理** (新規・リネーム・削除・移動・複製) とアプリ専用フォルダ — Files App に任せる
- **PDF・Word・Excel・画像の閲覧** — Files App の Quick Look が得意で、Modrift が勝てる余地がない
- **課金・アカウント・広告**
- フォルダ単位の閲覧・内部リンク `[[...]]`・ローカル画像 — iOS がサードパーティ File Provider のフォルダ参照を塞いでいる

v2 までのコードと要件はタグ `v2.0.0` に残っている。

## 3つの起動経路 (重要)

どの経路からでも同じビューア画面 (`/viewer`) に到達すること。

- **経路A: アプリ内ピッカー** — ホームの「ファイルを開く」→ `expo-document-picker`
- **経路B: Open In** — Files App などで「Modrift で開く」。`app.json` の `CFBundleDocumentTypes` で UTI を宣言し、[+native-intent.tsx](src/app/+native-intent.tsx) が `file://` URL をビューアのルートへ書き換える
- **経路C: 共有シート** — `expo-share-intent` の Share Extension。[share-intent-handler.tsx](src/components/share-intent-handler.tsx) がビューアへ送る

経路B の Inbox コピーと経路C の共有ファイルは使い捨てのコピーなので、**履歴に残さず、ビューアを離れるときに削除する** (`openInPending`)。

## Tech Stack

### Core
- **Expo (React Native)** + TypeScript、**expo-router** (ファイルベースルーティング)
- **New Architecture (Fabric) 前提のため Expo Go では動かない → Expo Dev Client が必須**

### ファイルの読み込み
- **expo-document-picker** — **`copyToCacheDirectory: false` 必須**。`true` (実体コピー) はプロバイダが実体を出さない未実体化ファイルでコピー自体が「no such file」で失敗する (2026-07-27 実機検証)
- **読み込みは協調読み込みで**: `expo-file-system` の `File.text()` ではなく、**自前ネイティブモジュール `FileBookmarkModule.readFileCoordinated(uri)`** を通す ([viewer.tsx](src/app/viewer.tsx))。素の `File.text()` は協調アクセスをしないため、**未ダウンロードの File Provider プレースホルダ (Google Drive 等) で「no such file」やハング**になる。`NSFileCoordinator` の協調読み込みでプロバイダに実体化を促してから読む
- **expo-file-system を patch しない理由**: Expo モジュールはプリコンパイル (`EXPO_USE_PRECOMPILED_MODULES`) で配布されるため、**patch がコンパイルされず効かない**。ネイティブの挙動を変えたいときは自前モジュール ([modules/file-bookmark](modules/file-bookmark)) に書く。自前モジュールは常にソースからコンパイルされる
- **Security-Scoped Bookmark** — 履歴からの再オープン用。**full bookmark** を使う (minimal だと Google Drive 等で開けない)

### Markdown の描画
- **CodeMirror 6** (`@codemirror/*`) を **react-native-webview** 上で**読み取り専用**で動かす ([src/lib/cm/](src/lib/cm/))。記法を隠して整形表示する。`editor-entry.mjs` を esbuild で `bundle.ts` に固めて WebView へ注入する — **`editor-entry.mjs` を変えたら `node src/lib/cm/build-bundle.mjs` を実行**
- 設定画面のプレビュー ([settings.tsx](src/app/settings.tsx)) も同じ `MarkdownWebView` で描く → ビューアと完全に同じ見た目
- **WKWebView は `@font-face` の `size-adjust` を無視する**。和文と欧文のサイズ調和は inline の `font-size` (`.cm-lat` の装飾) で行う。ヘッドレス Chrome は実機と見た目が違うので**表示の確認は実機で**
- **スクロール慣性**: CodeMirror に `height: 100%` を当てない (ページのネイティブスクロールが必要)、かつ WebView に `decelerationRate="normal"` を**明示**する。どちらを外しても長文フリックが途中で「カチン」と止まる。同根で、スクロール中に装飾を再構築しない (`WHOLE_DOC_DECORATE_LIMIT` = 20000 文字以下は文書全体を装飾)。**回帰検体は [samples/large-scroll-test.md](samples/large-scroll-test.md)** — 上限を超える長さなので、フォールバック側の経路を踏める

### 画面レイアウト (Expo SDK 58 / iOS 26+)
- **Stack のヘッダーは iOS 26 以降で既定が透明 (Liquid Glass)** で、画面の中身がヘッダーの下に潜り込む。**スクロールする画面は、ルートの `ScrollView` / `FlatList` に `contentInsetAdjustmentBehavior="automatic"` を必ず付ける**。付けないと先頭の行がヘッダーに隠れてタップできない。スクロールしない画面は `headerTransparent: false` にする。`SafeAreaView` (react-native-safe-area-context) でずらそうとしない — ステータスバー分しか動かない
- 空の状態の表示などは、スクロールビューの外に置かず `ListEmptyComponent` に入れて同じ inset を受けさせる
- ビューアは独自ヘッダー (`headerShown: false`) なので対象外

### その他
- **i18n**: `expo-localization` + `i18next` + `react-i18next`。翻訳は `/locales/{lang}/translation.json`、日本語・英語のみ
- **永続化**: AsyncStorage (最近見たファイル・設定)
- **画面の向き**: `expo-screen-orientation`。iPhone はビューアだけ横向きを許可し、他は縦固定。iPad は全画面4方向
- **アイコン切り替え**: `expo-alternate-app-icons`
- **配布**: EAS Build (development / preview / production) → TestFlight → App Store

## 開発環境の注意

- **`app.json` のネイティブ設定やネイティブ依存を変えたら `npm run prebuild:dev` (= `prebuild --clean --platform ios`) が必須**。古い設定が `ios/` の pbxproj に残る。`ios/` は prebuild が生成するもので、git 管理外。**iOS 専用なので `android/` は生成しない** (`--platform` を付けない prebuild や `expo run:android` は使わない)
- **開発版は別アプリ** (`com.modrift.app.dev` / スキーム `modrift-dev`、[app.config.js](app.config.js))。Metro は必ず `npm run start:dev` (`APP_VARIANT=development`) で起動する。素の `npm start` だとスキームが合わず、Open In・共有シートがホームで止まる
- **xcodebuild で開発版を直接ビルドするときも `APP_VARIANT=development` を付ける**。Release 構成は app.config をビルド時にアプリへ埋め込むため、付け忘れると埋め込みの scheme が `modrift` になり、`modrift-dev://` で届く共有を expo-share-intent が無視する (表示されずホームのまま)
- **iOS 27 SDK (Xcode 27) でビルドしたアプリは UIScene ライフサイクルが必須** (無いと起動直後に SIGTRAP)。Expo SDK 58 以降の prebuild が `SceneDelegate.swift` を生成するので、**SDK 57 以前に戻さない**
- Xcode 27 は Pod の最低デプロイターゲット iOS 15.0 未満を拒否する。[plugins/with-pod-deployment-target.js](plugins/with-pod-deployment-target.js) が prebuild のたびに補正する

## Development Principles

### コードの書き方
- **シンプルさを優先**: 過剰な抽象化、過剰なライブラリは避ける
- **個人開発**: 1人で保守できるコード量・複雑度に留める
- **React Native 標準コンポーネントを優先**: カスタムコンポーネントは必要最小限
- **状態管理は最小限**: useState + Context で足りる場合は Redux / Zustand 等を導入しない
- **TypeScript の型安全性を確保**: any は避ける、適切な型定義
- テストやドキュメントを過剰に書かない (個人開発として実用的なレベルに)

### 機能追加の判断
- 機能追加の提案前に、必ず `docs/Requirements.md` の「6. 意図的に実装しないもの」を確認する
- 「あったら便利」を理由とした機能追加はしない
- 大きな設計変更が必要な場合は、提案前に相談する

### ブランチ運用
- **リリース単位の長命ブランチに積み、出荷後に `main` へ fast-forward** (`git merge --ff-only`)。`feat/*` は使わない。**`main` にマージコミットは1つも無い**ので、この形を崩さない
- **`main` = 出荷済みの状態を保つ**。崩すと hotfix を `main` から切れなくなる。**審査中のコードを先に `main` へ入れない** (リジェクトされたときに嘘になる)
- ブランチ名はリリース名 (`v3` など)。捨てる探索は `<release>-spike` とし、**着手のたびに親ブランチから再ベースライン**する
- **タグは出荷した時点で打つ** (`v3.0.0`)。審査提出時ではない — 作り直しでタグが嘘になる
- 出荷して `main` に取り込んだブランチは削除する。コミットはタグが固定しているので失われない
- **コミット / マージ / push はユーザーの明示指示があるまで行わない。前のタスクの承認を持ち越さない**。コミットメッセージは英語 (docs・コード内コメント・チャットは日本語のまま)

## Key Constraints (iOS)

- **Sandbox**: アプリは選択されたファイルにしかアクセスできない。同じフォルダの他のファイル (相対パスの画像など) も読めない
- **未実体化ファイル**: クラウド上にしかないファイルは、協調読み込み (上記) で実体化してから読む。読み込みにはタイムアウトを設け、失敗時は黒画面や無限ローディングにせずエラーと再試行を出す
- **Open In の URI は再起動を跨いで開き直せない** (Google Drive 等を Files から in-place で開いた `/Library/CloudStorage/…` は bookmark が解決できない)。だから**履歴に記録するのはピッカー経由のものだけ**
- **ピッカーの開始位置やタブは公開 API で変えられない**。独自のファイル選択 UI にすると Google Drive / Dropbox を失うので、システムの既定のまま使う
- **対象は iOS 16 以降**

## Visual Design

- **カラー**: iOS 純正パターンを踏襲。ライト/ダークはシステムに追従、または設定で固定。配色プリセット (ネイビー / モノクロ / カラフル) は [theme.ts](src/theme.ts)
- **タイポグラフィ**: 欧文は SF Pro、和文はヒラギノ角ゴ。コードは SF Mono
- **レイアウト**: 8px グリッド、余白は標準より少し広め (読み物アプリらしさ)。iPad では本文を 42em で中央に寄せる。横向きの iPhone では幅の上限を外す
- **アニメーション**: 控えめに。ビューアのヘッダーはスクロールに連動して隠れる

## Settings (App Configuration)

- **Bundle ID**: `com.modrift.app` (開発版は `com.modrift.app.dev`)
- **表示名**: Modrift / **スラッグ (Expo)**: `modrift`
- **App Group** (共有シート用): `group.com.modrift.app`

## Competitive Positioning

| 相手 | 違い |
|---|---|
| **iOS Files App (Quick Look)** | PDF・Office・画像はきれいに表示するが、Markdown・JSON・コードは生テキストのまま。**Modrift はこの隙間だけを埋める補完関係**で、ファイル管理は Files App に任せる |
| **Obsidian Mobile / iA Writer / Bear** | 自分の Vault・ライブラリに取り込んで書くためのアプリ。Modrift は**どこにある単一ファイルでも、取り込まずにその場で読む** |
