Modrift Project Context
This file is the persistent context for Claude Code working on the Modrift project.
What we're building
Modrift は iOS / Android 向けの軽量モバイルクライアントアプリ。

コア機能: Google Drive 上の Obsidian Vault (Markdownファイル) を iPhone でサッと開いて閲覧・編集
将来的に: PDF、xlsx、画像なども横断的に閲覧できる「知的生産ファイルクライアント」へ拡張
コンセプト: Mo (Mobile / Motion) + drift (流れる、漂う) = モバイルでファイルと思考が流れるように行き来する

詳細仕様は Requirements.md を参照。
Tech Stack
Core

Expo (React Native) + TypeScript
expo-router (ファイルベースルーティング)

File Operations

expo-document-picker (iOS Document Picker でファイル選択)
expo-file-system (ファイル読み書き)
重要: copyToCacheDirectory: false 必須 — File Provider 経由の直接編集を維持

Markdown Rendering

react-native-enriched-markdown (Software Mansion製、md4cベース、CommonMark + GFM対応)
旧来の react-native-markdown-display は使わない
重要: このライブラリは Expo Go で動作しない → Expo Dev Client が必須

Editing

MVP: TextInput multiline (React Native 標準)
v2: EnrichedMarkdownTextInput への移行

Internationalization

expo-localization (デバイス言語取得)
i18next + react-i18next
翻訳ファイル: /locales/{lang}/translation.json
対応言語: 日本語、英語のみ

Local Persistence

AsyncStorage (@react-native-async-storage/async-storage): 最近開いたファイル履歴、ユーザー設定
expo-secure-store: Security-Scoped Bookmark (v1.1以降)

Auto-save Control

lodash debounce または独自実装 (3秒 debounce)

Distribution

EAS Build (development / preview / production の3プロファイル)
TestFlight → App Store
Apple Developer Program 必須 ($99/年)

Development Principles
コードの書き方

シンプルさを優先: 過剰な抽象化、過剰なライブラリは避ける
個人開発: 1人で保守できるコード量・複雑度に留める
React Native 標準コンポーネントを優先: カスタムコンポーネントは必要最小限
状態管理は最小限: useState + Context で足りる場合は Redux / Zustand 等を導入しない
TypeScript の型安全性を確保: any は避ける、適切な型定義

機能追加の判断

機能追加の提案前に、必ず Requirements.md の「5.6 意図的に実装しないもの」を確認
スコープ外と判断されている機能は提案しない
「あったら便利」を理由とした機能追加はしない

MVP の範囲

詳細は Requirements.md の「5.1 MVP (Phase 1)」を参照
主要機能:

ファイルを開く (.md / .txt / .markdown)
Md プレビュー表示 (HTTPS画像対応、ローカル画像はプレースホルダ)
編集モード ⇄ プレビューモードのトグル
自動保存 (3秒 debounce)
最近開いたファイルリスト (表示のみ)
日英 UI 切り替え



Key Constraints
iOS 固有

Sandbox: アプリは選択されたファイルにのみアクセス可能
Security-Scoped Bookmark: Document Picker の URI はセッションを跨ぐと無効化 (v1.1で対応)
File Provider 同期完了は観測不可: writeAsStringAsync はローカル書き込み完了までしか保証しない

環境

iOS 16以降を対象
Expo Dev Client 必須 (Expo Go では動作しない)
React Native New Architecture (Fabric) が前提

Visual Design
カラー (iOS純正パターンを踏襲、TBD)

Background: White (Dark mode は v1.1)
Primary / Accent: iOS Blue (#007AFF) を起点に、後で Modrift らしさを追求
詳細は実装時に src/theme.ts で管理

タイポグラフィ

システムフォント (San Francisco / ヒラギノ角ゴ ProN) を優先
コードブロック: SF Mono

レイアウト

8px グリッド
余白は標準より少し広め (読み物アプリらしさ)
Dynamic Type 対応

Animations

派手すぎず、控えめだが「drift感」を出す
画面遷移: iOS標準のスライド + ふわっとフェード
保存インジケータ: 主張しないが安心できる見せ方

Settings (App Configuration)
Bundle Identifier

暫定: com.anonymous.modrift (Apple Developer Program 登録後に正式決定)
検討中の正式 ID: app.modrift.ios または io.modrift.app

App Name

表示名: Modrift
スラッグ (Expo): modrift

How to Work with Claude Code
このファイルの位置付け
このファイルは Claude Code がプロジェクト全体のコンテキストを把握するためのものです。
詳細な要件・仕様は Requirements.md を参照してください。
実装依頼時のお願い

機能追加の前に Requirements.md の該当 FR を確認すること
「意図的に実装しないもの」を提案しないこと
シンプルな実装を優先すること
大きな設計変更が必要な場合は提案前に相談すること
テストやドキュメントを過剰に書きすぎないこと (個人開発として実用的なレベルに)

Current Status

✅ Phase 0 (企画): 完了
✅ Phase 1 (要件定義): Requirements.md 完成
✅ Phase 2 (設計): 軽量化 (バイブコーディング前提、頭の中で完結)
🔜 Phase 3 (実装準備): 現在ここ
⬜ Phase 4 (実装)
⬜ Phase 5 (配布準備)
⬜ Phase 6 (リリース)
⬜ Phase 7 (運用)