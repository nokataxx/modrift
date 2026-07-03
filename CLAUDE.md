# Modrift Project Context

This file is the persistent context for Claude Code working on the Modrift project.

## What we're building

**Modrift** は iOS / Android 向けの軽量モバイルクライアントアプリ。

- **コア機能**: クラウド (iCloud / Google Drive / Dropbox 等) やメール添付などにある **Markdown ファイルを、どこからでも iPhone でサッと開いて整形表示・軽編集**。特定の Vault やアプリに縛られない「どこのファイルでも開ける軽量 Markdown ビューア＆クイックエディタ」
- **将来的に**: PDF、Word (.docx)、xlsx、画像など他形式の**単一ファイル**も閲覧できる「知的生産ファイルクライアント」へ拡張
- **コンセプト**: Mo (Mobile / Motion) + drift (流れる、漂う) = モバイルでファイルと思考が流れるように行き来する
- **「Vault」を主役にしない (2026-06-29 方針転換)**: iOS はサードパーティ File Provider のフォルダ参照を塞ぐため、フォルダ Vault は Google Drive 等で成立せず iCloud 専用だと Obsidian と競合するだけ。よって**フォルダ Vault・Vault ブラウザ・内部リンク `[[]]`・埋め込み `![[]]`・ローカル画像表示は実装しない**。単一ファイル中心に振り切る (Requirements 改訂11)

**対応ストレージ (重要)**: in-place 編集 (原本への書き戻し) が成立するのは **iCloud Drive のみ**。これは Modrift の設計仕様で、`isInPlaceEditable()` が iCloud Drive (`com~apple~CloudDocs`) とアプリの iCloud コンテナだけを編集可と判定する。
- **iCloud Drive**: 編集がその場でクラウドへ同期される → **編集用途の推奨ストレージ** (実機確認済み)
- **Dropbox / Google Drive 等のサードパーティ File Provider**: 閲覧は可能だが in-place 編集は不可。編集は iCloud にコピーを作成して行う (原本には書き戻らない、FR-03)。Google Drive は provider 自体が他アプリ編集をアップロードしない制約も別途確認済み。**Dropbox も書き戻し不可を実機確認 (2026-06-28)** — ただしこれは Modrift が iCloud 以外を一律ゲートしている結果で、Dropbox provider 自体の upload 可否は切り分け未実施

**段階的な進化**:
- MVP / v1.1: 任意の `.md` を Document Picker / Open In で開いて整形表示・軽編集 (2つの起動経路)
- v2: ライブプレビュー編集 (CodeMirror 一本化) を主役に、検索・編集履歴等を追加
- v3: 単一ファイルの PDF / Word (.docx) / xlsx 閲覧 (有償 Pro)

**iOS Files App との関係**: Modrift は Files App と競合せず**補完関係**にある。Files App はファイル管理 (フォルダ階層、リネーム、移動、削除) を担い、Modrift は Md 整形表示・編集と他形式ファイルの閲覧を担う。

詳細仕様は `Requirements.md` を参照。

## Tech Stack

### Core
- **Expo (React Native)** + TypeScript
- **expo-router** (ファイルベースルーティング)

### File Operations
- **expo-document-picker** (iOS Document Picker でファイル選択)
- **expo-file-system** (ファイル読み書き)
- **expo-linking** (Open In 起動時のURI処理)
- **重要**: `copyToCacheDirectory: false` 必須 — File Provider 経由の直接編集を維持

### Markdown Rendering + Editing (v2 で CodeMirror に一本化 — FR-20)
- **CodeMirror 6** (`@codemirror/*`) を **react-native-webview** 上でホストし、**閲覧・編集の両方を単一エディタ**で賄う (`src/lib/cm/`)。バンドルは `editor-entry.mjs` を esbuild で `bundle.ts` に固めて WebView へ注入
- 閲覧はカーソル行の記法も含めて整形表示、編集はカーソル行だけ生の記法を露出するライブプレビュー。GFM (表/タスク/取り消し線)・シンタックスハイライト・タスクタップ・リンクタップ・undo/redo (CM history) 対応
- **重要**: WKWebView は `@font-face` の `size-adjust` を無視するため、CJK/Latin のサイズ調和は inline `font-size` span で行う。ヘッドレス Chrome は実機と乖離するので**実機検証必須**
- 設定画面のライブプレビュー見本 (`settings.tsx`) も同じ `MarkdownWebView` を read-only (`editable={false}`) で描画 → ビューアと完全に同じ見た目。アプリ内の Md レンダラは **CodeMirror のみ** (`react-native-enriched-markdown` 依存は v2 で撤去済み)
- 旧来の `react-native-markdown-display` も使わない
- **重要**: New Architecture / ネイティブモジュール前提のため Expo Go では動作しない → **Expo Dev Client が必須**
- MVP の構成 (履歴): 閲覧=enriched-markdown、編集=`TextInput multiline`。v2 (FR-20) で CodeMirror 一本化に置換し enriched-markdown 依存を撤去

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
- **クラウド同期はプロバイダ依存**: 書き込みは `NSFileCoordinator` で協調済み。**in-place 編集が成立するのは iCloud Drive のみ** (`isInPlaceEditable` のゲート)。**Dropbox / Google Drive 等は in-place 編集不可** (編集は iCloud コピー経由、原本に書き戻らない)。閲覧は全プロバイダ可
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

