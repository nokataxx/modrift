# Modrift Project Context

This file is the persistent context for Claude Code working on the Modrift project.

## What we're building

**Modrift** は iOS / Android 向けの軽量モバイルクライアントアプリ。

- **コア機能**: クラウド (iCloud / Google Drive / Dropbox 等) やメール添付などにある **Markdown ファイルを、どこからでも iPhone でサッと開いて整形表示・軽編集**。特定の Vault やアプリに縛られない「どこのファイルでも開ける軽量 Markdown ビューア＆クイックエディタ」
- **将来的に**: PDF、Word (.docx)、xlsx、画像など他形式の**単一ファイル**も閲覧できる「知的生産ファイルクライアント」へ拡張
- **コンセプト**: Mo (Mobile / Motion) + drift (流れる、漂う) = モバイルでファイルと思考が流れるように行き来する
- **「Vault」を主役にしない (2026-06-29 方針転換)**: iOS はサードパーティ File Provider のフォルダ参照を塞ぐため、フォルダ Vault は Google Drive 等で成立せず iCloud 専用だと Obsidian と競合するだけ。よって**フォルダ Vault・Vault ブラウザ・内部リンク `[[]]`・埋め込み `![[]]`・ローカル画像表示は実装しない**。単一ファイル中心に振り切る (Requirements 改訂11)
- **ホーム = 作業場 (v1.4〜)**: 「どこのファイルでも開く」核はそのままに、**iCloud › Modrift フォルダを自分の作業ホーム**として持つ (アプリ専用の固定コンテナ。任意フォルダをピッカーで選ぶフォルダ Vault の復活ではない)。ホームは「マイファイル (場所) / 最近見た (時間)」の2ビュー。Md をここで一覧・新規・編集・整理し、Google Drive / Dropbox 等は開いて閲覧・必要ならホームへコピー。**編集はホームフォルダのファイルのみ (ポリシーA)**、他は閲覧＋コピー。システムピッカー (Recents 非表示・Browse 固定等の見た目が公開 API で制御不可) は3点メニュー内の予備 (FR-30〜35、Requirements §5.5)

**対応ストレージ (重要)**: OS 的に in-place 編集 (原本への書き戻し) が成立するのは **iCloud Drive のみ** (`com~apple~CloudDocs` / アプリの iCloud コンテナ)。その上で v1.4 の Policy A では編集可判定を **`isHomeFile()` がホーム (iCloud › Modrift コンテナ) のファイルだけ**に絞る (iCloud Drive 全般ではない)。ホーム外は閲覧＋明示「ホームにコピー」(FR-34)。
- **iCloud Drive**: 編集がその場でクラウドへ同期される → **編集用途の推奨ストレージ** (実機確認済み)
- **Dropbox / Google Drive 等のサードパーティ File Provider**: 閲覧は可能だが in-place 編集は不可。編集は iCloud にコピーを作成して行う (原本には書き戻らない、FR-03)。Google Drive は provider 自体が他アプリ編集をアップロードしない制約も別途確認済み。**Dropbox も書き戻し不可を実機確認 (2026-06-28)** — ただしこれは Modrift が iCloud 以外を一律ゲートしている結果で、Dropbox provider 自体の upload 可否は切り分け未実施
- **v1.4〜 編集はホームフォルダ限定 (ポリシーA)**: iCloud Drive 全般ではなく **ホーム (iCloud › Modrift) のファイルだけ**を編集可とする。ホーム外 (Drive/Dropbox・Modrift フォルダ外の iCloud Drive) は閲覧＋明示「ホームにコピー」(FR-34) のみで、FR-03 の暗黙 iCloud コピーは廃止

**段階的な進化**:
- MVP / v1.1: 任意の `.md` を Document Picker / Open In で開いて整形表示・軽編集 (2つの起動経路)
- v1.2: ライブプレビュー編集 (CodeMirror 一本化) を主役に、検索・見出しテンプレート等を追加
- v1.3: アプリアイコンの切り替え (設定で複数デザインから選択、iOS Alternate App Icons、FR-29)＋編集オプトイン (設定「MD ファイルを編集する」トグル、既定 OFF、FR-28。**v1.4 で撤去 → 編集は常時有効**)
- v1.4: ファイル選択 UX 刷新。ホームを **iCloud › Modrift フォルダ中心の作業場**に (「マイファイル / 最近見た」2ビュー)、システムピッカーは3点メニュー内の予備、**編集はホームフォルダ限定 (ポリシーA・`isHomeFile`)**、設定でホームを iPhone内に切替可 (ローカルは Documents 直下)。マイファイルは更新日付表示＋並び替え (3点メニュー内)、操作は両ビューとも長押し ActionSheet に統一 (履歴スワイプ廃止・ファイル削除はマイファイルのみ)。**編集オプトイン (FR-28) は撤去し編集を常時有効に**。**ビューアの横向き表示 (FR-36)**: iPhone はビューア画面のみ横向き許可 (他画面は縦固定・`expo-screen-orientation` で画面単位制御)、iPad は全画面4方向のまま。横向きスマホのみ読み幅キャップ (42em) を解除 (FR-30〜36、Requirements §5.5)
- v2: 単一ファイルの PDF / Word (.docx) / xlsx 閲覧 (有償 Pro)

**iOS Files App との関係**: Modrift は Files App と競合せず**補完関係**にある。Files App は一般のファイル管理 (任意フォルダの階層・移動・削除) を担い、Modrift は Md 整形表示・編集と他形式ファイルの閲覧を担う。v1.4〜 は Modrift 自身の作業ホーム (iCloud › Modrift) 内に限りリネーム・削除・複製・新規を持つ (自領域の操作であり一般ファイルマネージャ化ではない)。

詳細仕様は `Requirements.md` を参照。

## Tech Stack

### Core
- **Expo (React Native)** + TypeScript
- **expo-router** (ファイルベースルーティング)

### File Operations
- **expo-document-picker** (iOS Document Picker でファイル選択)
- **expo-file-system** (ファイル読み書き)
- **expo-linking** (Open In 起動時のURI処理)
- **重要**: `copyToCacheDirectory: false` 必須 — File Provider 経由の直接編集を維持。なお `true`(実体コピー)は、プロバイダが実体を出さない未実体化ファイルでコピー自体が「no such file」で失敗するため不採用 (2026-07-27 実機検証)。
- **重要 (ファイル読み込みは協調読み込みで)**: ビューアの初回読み込みは `expo-file-system` の `File.text()` ではなく **自前ネイティブモジュール `FileBookmarkModule.readFileCoordinated(uri)`** を通す ([viewer.tsx](src/app/viewer.tsx))。素の `File.text()` は協調アクセスをしないため、**未ダウンロードの File Provider プレースホルダ (Google Drive 等) で「no such file」やハング**になる。`readFileCoordinated` は `NSFileCoordinator` の協調読み込み＋security scope で**プロバイダに実体化 (ダウンロード) を促してから読む** (2026-07-27 実機で Google Drive 解決)。expo-file-system 側を patch しない理由: **Expo モジュールはプリコンパイル (`EXPO_USE_PRECOMPILED_MODULES`) 配布で patch が無効化される**ため。自前モジュールは常にソースコンパイルなので確実に効く

### Markdown Rendering + Editing (v1.2 で CodeMirror に一本化 — FR-20)
- **CodeMirror 6** (`@codemirror/*`) を **react-native-webview** 上でホストし、**閲覧・編集の両方を単一エディタ**で賄う (`src/lib/cm/`)。バンドルは `editor-entry.mjs` を esbuild で `bundle.ts` に固めて WebView へ注入
- 閲覧はカーソル行の記法も含めて整形表示、編集はカーソル行だけ生の記法を露出するライブプレビュー。GFM (表/タスク/取り消し線)・シンタックスハイライト・タスクタップ・リンクタップ・undo/redo (CM history) 対応
- **重要**: WKWebView は `@font-face` の `size-adjust` を無視するため、CJK/Latin のサイズ調和は inline `font-size` span で行う。ヘッドレス Chrome は実機と乖離するので**実機検証必須**
- **重要 (スクロール慣性)**: CM エディタに `height: 100%` を当てない (ページのネイティブスクロールが必要)、かつ WebView に `decelerationRate="normal"` を**明示**する。どちらを外しても長文フリックが途中で「カチン」と止まる。同根で、live-preview はスクロール中に装飾を再構築しない (`WHOLE_DOC_DECORATE_LIMIT` = 20000 文字以下は文書全体を装飾する。改訂35)。**回帰検体は [samples/large-scroll-test.md](samples/large-scroll-test.md)** — この上限を超える長さなので、フォールバック側の経路を踏める
- 設定画面のライブプレビュー見本 (`settings.tsx`) も同じ `MarkdownWebView` を read-only (`editable={false}`) で描画 → ビューアと完全に同じ見た目。アプリ内の Md レンダラは **CodeMirror のみ** (`react-native-enriched-markdown` 依存は v1.2 で撤去済み)
- 旧来の `react-native-markdown-display` も使わない
- **重要**: New Architecture / ネイティブモジュール前提のため Expo Go では動作しない → **Expo Dev Client が必須**
- MVP の構成 (履歴): 閲覧=enriched-markdown、編集=`TextInput multiline`。v1.2 (FR-20) で CodeMirror 一本化に置換し enriched-markdown 依存を撤去

### Other Formats (v2 — 閲覧専用。PDF / Word / xlsx は有償 Pro、画像は無料)

- **PDF**: `react-native-pdf-renderer` (ネイティブ。iOS は PDFView のサブクラス)
- **Word (.docx)**: **mammoth 1.12.0** で OOXML → HTML (`src/lib/docx/`)
- **Excel (.xlsx)**: **SheetJS CE (`@e965/xlsx` 0.20.3)** でワークブック → HTML テーブル (`src/lib/xlsx/`)
- **画像**: `expo-image` (PNG / JPEG / GIF / HEIC / WebP)
- **重要 (mammoth / SheetJS は devDependencies にある)**: どちらも**アプリのランタイムには載せず、esbuild で WebView 用バンドル (`bundle.ts`) に固めて注入**する — CodeMirror と同じ方式。`build-bundle.mjs` を実行して生成する。**RN のランタイムに入れると Node 前提の API で落ちる**ため、形式ごとに独立したバンドルにしている
- **重要 (バイナリの読み込み)**: PDF / docx / xlsx は Md の `readFileCoordinated` ではなく **`FileBookmarkModule.materializeFileCoordinated(uri)`** を通す。**シミュレータではこれが解決しない** (実機では正常) ので、シミュレータで v2 ビューアを触るときは一時的に `Promise.resolve(fileUri)` に置換する
- **意図的にやらないこと**: これらの形式の**編集**。閲覧専用と決めている (FR-21)

### Billing (v2 — FR-44)

- **RevenueCat (`react-native-purchases` 10.7.0)**。買い切りの非消耗型1本 (`com.modrift.app.pro`)
- **SDK を知っているのは [`src/lib/purchases.ts`](src/lib/purchases.ts) 1枚だけ**。アプリ側は `useProEntitlement()` フック (Context) と `Paywall` コンポーネントしか見ない
- **アカウントを持たない**方針 (5.9)。`logIn()` を呼ばないので App User ID は匿名で、復元はストアの購入履歴から。**プラットフォーム跨ぎの引き継ぎは無い** (Android で買い直し) — 買い切りなので許容する、と決めた判断
- **鍵が無ければ fail-closed**: `app.json` の `extra.revenueCatApiKey` が空なら `isPro: false`。解錠側に倒さない
- **`test_` で始まる鍵は RevenueCat の Test Store**。出荷すると誰も買えないのに画面上は成功するので、`isBillingConfigured()` がリリースビルドで弾く
- ダッシュボード設定 (Git に残らない) は [`docs/adr-v2-pro-formats.md`](docs/adr-v2-pro-formats.md) に記録

### Internationalization
- **expo-localization** (デバイス言語取得)
- **i18next** + **react-i18next**
- 翻訳ファイル: `/locales/{lang}/translation.json`
- 対応言語: 日本語、英語のみ

### Local Persistence
- **AsyncStorage** (@react-native-async-storage/async-storage): 最近開いたファイル履歴、ユーザー設定
- **expo-secure-store**: Security-Scoped Bookmark (v1.1以降)

### Auto-save Control
- **lodash debounce** または独自実装 (3秒 debounce)

### Distribution
- **EAS Build** (development / preview / production の3プロファイル)
- **TestFlight** → **App Store**
- Apple Developer Program 必須 ($99/年)

## Development Principles

### コードの書き方
- **シンプルさを優先**: 過剰な抽象化、過剰なライブラリは避ける
- **個人開発**: 1人で保守できるコード量・複雑度に留める
- **React Native 標準コンポーネントを優先**: カスタムコンポーネントは必要最小限
- **状態管理は最小限**: useState + Context で足りる場合は Redux / Zustand 等を導入しない
- **TypeScript の型安全性を確保**: any は避ける、適切な型定義

### 機能追加の判断
- 機能追加の提案前に、必ず `Requirements.md` の「5.6 意図的に実装しないもの」を確認
- スコープ外と判断されている機能は提案しない
- 「あったら便利」を理由とした機能追加はしない

### MVP の範囲

詳細は `Requirements.md` の「5.1 MVP (Phase 1)」を参照。主要機能:

- **ファイルを開く (2つの起動経路、FR-01)**:
  - 経路A: Modrift 内の Document Picker (アプリ起動時)
  - 経路B: iOS Files App / 他アプリからの「Open In」(UTIハンドリング)
- 対応形式: `.md` / `.txt` / `.markdown`
- Md プレビュー表示 (HTTPS画像対応、ローカル画像はプレースホルダ)
- 編集モード ⇄ プレビューモードのトグル
- 自動保存 (3秒 debounce)
- 最近開いたファイルリスト (表示のみ)
- 日英 UI 切り替え

## 2つの起動経路 (重要)

Modrift は **2つの起動経路** をフラットに対応する。これは Modrift のコア体験を支える重要な設計。

### 経路A: アプリ内 Document Picker

```
ホーム画面 → Modrift 起動 → 「ファイルを開く」ボタン
→ iOS Document Picker → Drive のファイル選択
```

実装: `expo-document-picker` を使用

### 経路B: 他アプリからの Open In

```
ホーム画面 → Files App → Drive → .md ファイル
→ 「Modrift で開く」を選択 → Modrift が起動してファイル表示
```

実装に必要なもの:
- `app.json` の `ios.infoPlist.CFBundleDocumentTypes` で `.md` ファイルハンドリングを宣言
  ```json
  {
    "ios": {
      "infoPlist": {
        "CFBundleDocumentTypes": [
          {
            "CFBundleTypeName": "Markdown Document",
            "LSHandlerRank": "Alternate",
            "LSItemContentTypes": ["net.daringfireball.markdown", "public.plain-text"]
          }
        ]
      }
    }
  }
  ```
- `expo-linking` または React Native の `Linking` で起動URIを受け取る処理
- 起動URIをファイル表示画面に渡す状態管理

## Key Constraints

### iOS 固有
- **Sandbox**: アプリは選択されたファイルにのみアクセス可能
- **Security-Scoped Bookmark**: Document Picker の URI はセッションを跨ぐと無効化 (v1.1で対応)
- **File Provider 同期完了は観測不可**: `writeAsStringAsync` はローカル書き込み完了までしか保証しない
- **クラウド同期はプロバイダ依存**: **in-place 編集が成立するのは iCloud Drive のみ**、さらに v1.4 Policy A では編集可はホーム (iCloud › Modrift) 限定 (`isHomeFile` のゲート)。**Dropbox / Google Drive 等・ホーム外は in-place 編集不可** (編集は「ホームにコピー」経由、原本に書き戻らない、FR-34)。閲覧は全プロバイダ可
- **書き込みは協調していない (2026-08-13 訂正)**: 保存は `expo-file-system` の素の write。かつて `NSFileCoordinator` で包む patch を当てていたが、**expo-file-system はプリコンパイル配布 (`ios/Pods/ExpoFileSystem/ExpoFileSystem.xcframework`) なので patch がコンパイルされておらず、効いていなかった**。読み込み側で同じ問題に気づいて自前モジュールへ移した (上記) のに、書き込み側は patch のまま放置されていた。**効かない patch を持ち続けるほうが有害**なので削除した。編集可なのはホーム (iCloud) だけで、iCloud は協調なしでも同期するため実害は無い。**ホーム外を編集可にするなら、まず協調書き込みを自前モジュールへ実装すること**
- **UTI 登録が必要 (Open In対応のため)**: `CFBundleDocumentTypes` で `.md` ハンドリングを宣言

### 環境
- **iOS 16以降を対象**
- **Expo Dev Client 必須** (Expo Go では動作しない)
- **React Native New Architecture (Fabric)** が前提

## Visual Design

### カラー (iOS純正パターンを踏襲、Modrift らしさは追求中)
- Background: White (Dark mode は v1.1)
- Primary / Accent: iOS Blue (#007AFF) を起点に、後で Modrift らしさを追求
- 詳細は実装時に `constants/Colors.ts` で管理 (Expo標準の慣習に従う)

### タイポグラフィ
- システムフォント (San Francisco / ヒラギノ角ゴ ProN) を優先
- コードブロック: SF Mono

### レイアウト
- 8px グリッド
- 余白は標準より少し広め (読み物アプリらしさ)
- Dynamic Type 対応

### Animations
- 派手すぎず、控えめだが「drift感」を出す
- 画面遷移: iOS標準のスライド + ふわっとフェード
- 保存インジケータ: 主張しないが安心できる見せ方

## Settings (App Configuration)

### Bundle Identifier
- **Bundle ID**: `com.modrift.app` (個人名を含まない永続ID。iCloud コンテナは `iCloud.com.modrift.app`)

### App Name
- 表示名: **Modrift**
- スラッグ (Expo): `modrift`

## Competitive Positioning

Modrift は以下の競合とは**コンセプトが異なる**ので、機能の追従ではなく差別化を重視する:

| 競合 | 違い |
|---|---|
| **Obsidian Mobile** | Obsidianは重く、自分の Vault に閉じる。Modriftは「**どこのファイルでも**軽快に開いてサッと使う」が真価 |
| **iA Writer** | iA Writerは「執筆」特化で Library 取り込み前提。Modriftは「**どこの単一ファイルでも開いて読む・軽く直す**」特化 |
| **Bear** | Bearは独自フォーマット。Modriftは `.md` ファイル直接 (相互運用) |
| **iOS Files App** | Files Appはファイル管理 (整形できず生テキスト)。Modriftは整形表示・編集。**補完関係** |

詳細は `Requirements.md` 「2. 背景・目的」を参照。

## How to Work with Claude Code

### このファイルの位置付け
このファイルは Claude Code がプロジェクト全体のコンテキストを把握するためのものです。
詳細な要件・仕様は `Requirements.md` を参照してください。

### 実装依頼時のお願い
1. 機能追加の前に `Requirements.md` の該当 FR を確認すること
2. 「意図的に実装しないもの」を提案しないこと
3. シンプルな実装を優先すること
4. 大きな設計変更が必要な場合は提案前に相談すること
5. テストやドキュメントを過剰に書きすぎないこと (個人開発として実用的なレベルに)
6. 「2つの起動経路」(経路A: Document Picker、経路B: Open In) はコア機能なので、どちらの経路でもファイル表示画面に到達できる実装にすること

