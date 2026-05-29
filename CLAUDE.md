# Modrift Project Context

This file is the persistent context for Claude Code working on the Modrift project.

## What we're building

**Modrift** は iOS / Android 向けの軽量モバイルクライアントアプリ。

- **コア機能**: クラウドストレージ上の Obsidian Vault (Markdownファイル) を iPhone でサッと開いて閲覧・編集
- **将来的に**: PDF、xlsx、画像なども横断的に閲覧できる「知的生産ファイルクライアント」へ拡張
- **コンセプト**: Mo (Mobile / Motion) + drift (流れる、漂う) = モバイルでファイルと思考が流れるように行き来する

**対応ストレージ (重要)**: 編集→保存のクラウド同期は、ファイルが置かれた iOS File Provider に依存する。
- **iCloud Drive / Dropbox 等の素直なプロバイダ**: 編集がクラウドへ同期される → **編集用途の推奨ストレージ**
- **Google Drive**: 閲覧は可能だが、**他アプリの in-place 編集をクラウドへアップロードしない**ため編集の保存が同期されない (Google Drive 側の File Provider 制約。Modrift の書き込みコードは正しく、iCloud では同期を実機で確認済み)

**段階的な「Vault 扱い」の進化**:
- MVP: Vault 内の **個別の Md ファイル** を Document Picker で開いて編集
- v2: フォルダピッカー対応により、フォルダ単位で Md とローカル画像を扱う
- v3: PDF/xlsx/画像を含む **Vault 全体** を横断的に扱う

**iOS Files App との関係**: Modrift は Files App と競合せず**補完関係**にある。Files App はファイル管理 (フォルダ階層、リネーム、移動、削除) を担い、Modrift は Md 整形表示・編集と関連ファイル閲覧を担う。

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

### Markdown Rendering
- **react-native-enriched-markdown** (Software Mansion製、md4cベース、CommonMark + GFM対応)
- 旧来の `react-native-markdown-display` は使わない
- **重要**: このライブラリは Expo Go で動作しない → **Expo Dev Client が必須**

### Editing
- MVP: `TextInput multiline` (React Native 標準)
- v2: EnrichedMarkdownTextInput への移行

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
- **クラウド同期はプロバイダ依存**: 書き込みは `NSFileCoordinator` で協調済み。iCloud Drive / Dropbox は編集をクラウドへ同期するが、**Google Drive は他アプリの編集をアップロードしない**ため編集用途では非推奨 (閲覧は可)
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
- **現在**: `com.nokata.modrift` (開発用、App Store 提出前に再検討の余地あり)

### App Name
- 表示名: **Modrift**
- スラッグ (Expo): `modrift`

## Competitive Positioning

Modrift は以下の競合とは**コンセプトが異なる**ので、機能の追従ではなく差別化を重視する:

| 競合 | 違い |
|---|---|
| **Obsidian Mobile** | Obsidianは重い。Modriftは「軽快に開いてサッと使う」が真価 |
| **iA Writer** | iA Writerは「執筆」特化。Modriftは「Vault参照+軽編集」特化。コア目的が違う |
| **Bear** | Bearは独自フォーマット。ModriftはVault互換 (.md ファイル直接) |
| **iOS Files App** | Files Appはファイル管理。Modriftは整形表示・編集。**補完関係** |

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

