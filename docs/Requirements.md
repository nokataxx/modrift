# Modrift 要件定義書

iOS / Android 向けの軽量モバイルクライアントアプリ「Modrift」の要件定義書。

- **作成日**: 2026-05-25
- **想定読者**: Nokata (開発者) 本人、将来Claude等と相談する際の参照ドキュメント
- **関連ドキュメント**: なし (本ファイルが唯一のプロジェクトドキュメント。今後、技術ノートなど追加予定)

## 1. 概要

Modrift は Google Drive上のObsidian VaultをiPhoneでサクッと開いて読める、軽く直せる軽量モバイルクライアントアプリ。

**Markdownの閲覧・編集を中核**としつつ、Vault に含まれる**関連ファイル (PDF、xlsx、画像) も横断的に閲覧できる「知的生産ファイルクライアント」**を目指す。

**段階的な「Vault 扱い」の進化**:

- **MVP**: Vault 内の **個別の Md ファイル** を Document Picker で開いて編集
- **v2**: フォルダピッカー対応により、フォルダ単位でMdとローカル画像を扱う
- **v3**: PDF/xlsx/画像を含む **Vault 全体** を横断的に扱う

**iOS Files App との関係**: Modrift は Files App と競合せず**補完関係**にある。Files App はファイル管理 (フォルダ階層、リネーム、移動、削除) を担い、Modrift は Md 整形表示・編集と関連ファイル閲覧を担う。

**名前の由来**: **Mo** (Mobile / Motion) + **drift** (漂う、流れる) の合成。「モバイルで思考やファイルが漂うように流れる、Vault内を軽やかに行き来する」というコンセプトを表現。

## 2. 背景・目的

### Why Modrift

#### モバイル特化 Mdエディタの選択肢が限られている

- **Obsidian Mobile は重い**: モバイルでサッと開いて読むユースケースに対して、機能が多すぎ、起動が遅い
- **iOS Files App は Md を整形表示できない**: `.md` ファイルを開くと生のテキスト (`# 見出し` などのMd記法そのまま) しか見えず、xlsx もプレビュー不可。Md/xlsx ユーザーには不便
- **iA Writer は執筆ツールとしては優秀だが、コンセプトが異なる**: 「執筆」に特化した深いUX (Focus Mode等)、Vault という概念を持たず、関連ファイル (PDF、xlsx) にも対応しない。Modrift は「執筆」より「Vault参照+軽編集」、「単一ファイル」より「Vault全体」を志向する点で本質的に違う
- **Bear 等は独自フォーマットで他ツールと相互運用できない**

#### 競合との比較表

| アプリ | 主目的 | Vault連携 | 関連ファイル | 起動の軽さ | 価格 |
|||||||
| **Obsidian Mobile** | Vault管理 | ◎ ネイティブ | ✕ Mdのみ | ✕ 重い | フリーミアム |
| **iA Writer** | 執筆 | ✕ Libraryに取り込み | ✕ Mdのみ | ○ 軽い | iOS $19.99 (買い切り) |
| **Bear** | 執筆+管理 | ✕ 独自フォーマット | ○ 画像のみ | ○ 軽い | サブスク $14.99/年 |
| **iOS Files App** | ファイル管理 | △ 閲覧のみ | ◎ PDF等 | ◎ 軽い | 無料 |
| **Modrift** | **Vault参照+軽編集** | ◎ Drive直接 | ◎ v3で対応 | ◎ 軽快 | 無料or安価 |

### 差別化軸

**「Obsidian Vault全体をモバイルで軽く扱える」**というワンユースケースに振り切る。Vault互換 + 軽量 + ローカルファースト。

iA Writer のような「執筆ツール」とは目的が異なる。Modrift は **「移動中や隙間時間に、Vault のファイルにサッとアクセスして、読んだり軽く追記したりする」** ことに特化する。

## 3. 想定ユースケース

### MVP (Md 中心)

#### 主要シーン

- **外出先でObsidian Vaultを参照したい**: PC上のObsidian Vaultを Google Drive に置き、iPhoneでサッと開いて検索・閲覧
- **思いついたアイデアを既存ノートに追記**: 移動中・カフェで既存の.mdファイルを開いて短い追記をする
- **会議メモを後から見返す**: PCで取った議事録(Mdファイル)をiPhoneでレビュー
- **読書メモ・引用の確認**: 蓄積した読書ノートを通勤中に振り返る
- **タスクリスト・TODO の確認**: Markdown形式で管理しているTODOリストを外出先で確認

#### 2つの起動経路 (両方をフラットに対応)

Modrift は以下の2つの起動経路を両方とも自然に対応する:

**経路1: Modrift 起点 (アプリ中心型)**

```
ホーム画面 → Modrift → 「ファイルを開く」→ Document Picker → Drive のファイル選択
```

→ 「Modrift を起点に Vault のファイルにアクセス」する使い方

**経路2: Files App 起点 (ファイル中心型)**

```
ホーム画面 → Files → Google Drive → Vault フォルダ → .md ファイル → 「Modrift で開く」
```

→ 「Files App でファイルをブラウズしている時、Modrift で開く」使い方

iOS の標準的なメンタルモデルに合わせ、ユーザーの好みで両方を使い分けられるよう設計する。

### v3 以降 (関連ファイル対応後)

- **Md ノートからリンクされた PDF (論文・配布資料) を同じアプリで開く**: 引用元の論文をその場で確認、Md ノートに戻って続きを書ける
- **Vault に同梱された xlsx (家計簿・読書リスト) をモバイルから閲覧**: テーブル形式で整形表示、シート切り替え可能
- **Md ノートに埋め込まれた画像 (スクリーンショット・図解) を同じアプリで表示**: フォルダピッカー対応により、ローカル画像もレンダリング

## 4. 対応言語

- **UI**: 日本語・英語の2言語対応 (デバイス言語に追従)
- **i18nライブラリ**: `expo-localization` + `i18next` + `react-i18next`
- **翻訳ファイル**: `/locales/{lang}/translation.json` 形式、キーは `screens.recentFiles.title` のような階層構造
- **Mdコンテンツ表示・編集**: 全Unicode対応 (システムフォント任せ)
- **スコープ外**: 3言語目以降の追加、日付ロケール書式の精密化、RTL言語対応

## 5. スコープ

### 5.1 MVP (Phase 1)

- ファイルを開く (`.md` / `.txt` / `.markdown` 対応)
- Document Pickerからの選択
- **iOS Files App や他アプリから「Modrift で開く」(Open In) 対応** ← FR-08
- Mdプレビュー表示 (見出し、リスト、リンク、コード、引用、HTTPS画像)
- ローカル画像はプレースホルダ表示 (`[画像: filename.png]`)
- 編集モード ⇄ プレビューモードのトグル
- **自動保存 (3秒 debounce で Drive へ反映、サイレント)** ← FR-04
- **オフライン編集を許可** ← FR-05
- 最近開いたファイルのリスト (表示のみ、再オープンはピッカー経由)
- 日英の UI 切り替え (デバイス言語に追従)

### 5.2 v1.1 (Phase 2)

- Share Extension対応 — Drive アプリや他アプリの「共有」シートから Modrift で直接開ける (Open In と異なり、複数アプリ共通の共有メニュー対応)
- ダーク/ライトモード
- フォントサイズ調整
- Security-Scoped Bookmark による「最近開いたファイル」の再オープン対応
- ネットワーク状態の監視UI (オンライン/オフラインバッジ)
- 競合警告UI (Drive側のタイムスタンプ確認)
- Undo / Redo

### 5.3 v2 (Phase 4)

- 検索 (最近開いたファイル内の全文検索)
- iPad対応の左右分割プレビュー
- Obsidian風 `![[...]]` リンク (同フォルダ内ファイルへの参照のみ、ピッカー経由)
- **フォルダピッカー対応 — ローカル画像表示** ← FR-18
- 編集履歴 (アプリ内のローカル履歴)
- EnrichedMarkdownTextInput への編集UI移行

### 5.4 v3: 関連ファイル対応 (Phase 5)

- **PDF閲覧**: ページめくり、ピンチズーム、テキスト選択 (react-native-pdf 等)
- **xlsx閲覧**: シート切り替え、セル選択、テーブル整形表示 (SheetJS、AnyFolio資産の移植)
- Obsidian の `![[file.pdf]]` 等の埋め込み記法対応 (Md ノートから関連ファイルへのリンク)

### 5.5 v4以降: 検討

- PDF注釈・ハイライト
- xlsx の簡易編集 (セル値の書き換え程度)

### 5.6 意図的に実装しないもの

- 複数ファイル同時編集
- アプリ独自のフォルダ管理 (Filesアプリに任せる)
- リアルタイム共同編集
- プラグイン機構
- 明示的な手動Saveボタン (FR-04で自動保存に統一)
- PDFのページ追加・削除等の本格編集 (Files App や Apple Books に委ねる)
- xlsx の数式編集や複雑な編集 (Numbers や Excel に委ねる)
- 画像の編集機能 (写真アプリや専用編集ツールに委ねる)

## 6. 主要な設計判断

主要な設計判断3点。検討した代替案・採用理由・トレードオフは、各機能要件 (FR) の項を参照。

| 判断 | 結論 | 参照 |
||||
| 保存方式 | 自動保存 (3秒 debounce)、明示的Saveボタンなし | [FR-04](#fr-04-自動保存-mvp) |
| オフライン編集 | 許可 (MVPは最小実装、v1.1で警告UI追加) | [FR-05](#fr-05-オフライン編集-mvp), [FR-12](#fr-12-ネットワーク監視ui-v11), [FR-13](#fr-13-競合警告ui-v11) |
| 画像表示 | MVPはHTTPS画像のみ + プレースホルダ、v2でフォルダピッカー対応 | [FR-02](#fr-02-mdレンダリング-プレビュー表示-mvp), [FR-18](#fr-18-フォルダピッカー対応-ローカル画像表示-v2) |

## 7. 機能要件 (FR)

### FR-01: ファイルを開く [MVP]

Modrift は **2つの起動経路** からファイルを開けるよう対応する:

#### 経路A: アプリ内 Document Picker

- Modrift のホーム画面から「ファイルを開く」をタップ
- iOS Document Picker で `.md` / `.txt` / `.markdown` ファイルを選択して開く
- `expo-document-picker` を使用、`copyToCacheDirectory: false` を指定 (File Provider経由の直接編集を維持)

#### 経路B: 他アプリからの Open In (UTIハンドリング)

- iOS Files App や他のアプリで `.md` ファイルをタップ/長押し → 「Modrift で開く」を選択
- Modrift が起動して、渡されたファイルを直接表示
- `app.json` の `ios.infoPlist.CFBundleDocumentTypes` で `.md` ファイルのハンドリングを宣言
  - `LSItemContentTypes`: `["net.daringfireball.markdown", "public.plain-text"]`
  - `LSHandlerRank`: `Alternate` (他のMdエディタとも共存)
- アプリ起動時に `expo-linking` または React Native の `Linking` で渡された URI を受け取り、ファイル内容を読み込む

#### 共通エラーハンドリング

- ファイル取得失敗時はエラーメッセージを表示 (「ファイルを開けませんでした」)
- 対応していない形式のファイルが渡された場合、適切なエラー表示

### FR-02: Mdレンダリング (プレビュー表示) [MVP]

- `react-native-enriched-markdown` で CommonMark + GFM を表示 (見出し、リスト、リンク、コード、引用、テーブル、タスクリスト)
- HTTPS画像 (`https://...`) は表示、ローカル相対パス画像は `[画像: filename.png]` プレースホルダ表示
- コードブロックは等幅フォント + 単色表示 (MVPではシンタックスハイライト未対応)

**画像表示の設計判断の経緯**:

- 検討した代替案: (a) 画像表示なし、(b) HTTPS画像のみ、(c) フォルダピッカーでローカル画像対応 (フルサポート)、(d) MVPは(b)、v2で(c)
- 採用: **(d)** — MVPの実装範囲を絞り、早く価値検証する。Document Pickerはアクセス権が選択1ファイルのみのため、ローカル画像は同フォルダ内でもアクセス不可
- v2でフォルダピッカー対応 (FR-18) によりローカル画像表示も可能に
- トレードオフ: MVPでスクリーンショット入りメモは画像が見えない → プレースホルダでファイル名は表示

### FR-03: Md編集 [MVP]

- TextInput multiline でテキスト編集
- 編集モード ⇄ プレビューモードのトグルボタン
- 編集中もMd記法は生のテキストで表示 (WYSIWYG ではない)

### FR-04: 自動保存 [MVP]

- 編集後3秒間の無操作で自動保存 (debounce)
- アプリがバックグラウンドに遷移した瞬間に強制保存 (pending な debounce を flush)
- **保存状態の UI 表示は出さない (サイレント保存)** — Apple Notes / Bear / Obsidian と同じ「黙って保存」スタイル

**設計判断の経緯**:

- 検討した代替案: (a) ボタン式 (明示的Save)、(b) 自動保存、(c) ハイブリッド (自動+手動)
- 採用: **(b) 自動保存** — iOSメモ・Apple純正アプリと同等のUX、「保存し忘れ」リスクを根本回避、モバイルアプリらしい体験
- 状態 UI を出すか出さないかの検討: (a) サブタイトル表示、(b) 完全サイレント
  - 採用: **(b) 完全サイレント** — Apple純正アプリの主流パターンに合わせ、UI ノイズを最小化。「いま保存されたか?」をユーザに考えさせない設計を優先
  - トレードオフ: 保存エラー時にユーザが気付きにくい → MVP では稀な書き込み失敗は許容、必要なら v1.1 でエラー時のみアラート追加
- トレードオフ: 誤編集の取り消しが必要 → v1.1で Undo/Redo (FR-14) で対応。競合リスク → v1.1で警告UI (FR-13) で対応
- 「意図的に実装しないもの」に明示的な手動Saveボタンを追加 (5.6 参照)

### FR-05: オフライン編集 [MVP]

- オフラインでも編集・ローカル保存可能 (File Provider が後でDriveへアップロード)
- MVPではネットワーク状態の監視UIは省略 (機能のみオフライン許可)

**設計判断の経緯**:

- 検討した代替案: (a) 許可 (警告UIなし)、(b) 読み取り専用、(c) 許可 + 警告UI
- 採用: **(c) 許可 + 警告UI** (ただしMVPは最小実装) — Obsidian Mobile、iA Writer、Bear、Apple純正メモ全てがオフライン編集を許可、「軽く直す」コンセプトと一致
- MVPの妥協: 機能としてオフライン編集は許可するが、UIは「オンライン前提」で割り切る。ネットワーク監視UIは v1.1 (FR-12)、競合警告UIは v1.1 (FR-13) に回す
- トレードオフ: 競合発生時のデータロス → Driveのバージョン履歴で回復可能

### FR-06: 最近開いたファイルリスト [MVP]

- 過去に開いたファイル名を AsyncStorage に保存し、ホーム画面に表示
- MVPでは「表示のみ」(タップしても再オープン不可、ピッカー経由で再選択)

### FR-07: 国際化 (i18n) [MVP]

- デバイス言語に追従して UI を日本語/英語で切り替え
- `expo-localization` + `i18next` + `react-i18next` を使用
- 翻訳ファイルは `/locales/{lang}/translation.json`、キーは `screens.recentFiles.title` のような階層構造

### FR-08: Share Extension [v1.1]

- iOS の共有シート (Share Sheet) から Modrift を選択し、ファイルを直接開ける
- FR-01 経路Bの「Open In」とは別の仕組み: Open In はファイルタップから直接、Share Extensionは「共有」メニュー経由で複数アプリの選択肢に並ぶ
- `expo-share-extension` または自前のApp Extensionで実装
- これにより、メールの添付ファイル、Safariのダウンロード、他Mdアプリからの共有等、より広い起動経路に対応

### FR-09: ダーク/ライトモード [v1.1]

- システム設定に追従するか、アプリ内設定で固定可能
- Mdレンダリングのテーマも切り替わる

### FR-10: フォントサイズ調整 [v1.1]

- アプリ内設定でMdレンダリングおよび編集時のフォントサイズを変更可能
- Dynamic Type にも追従

### FR-11: 再オープン対応 (Security-Scoped Bookmark) [v1.1]

- 最近開いたファイルをリストからタップして再オープン可能に
- iOSの `URL.bookmarkData()` を使用、Expo Modules API でネイティブモジュール (Swift) を実装
- Bookmark は `expo-secure-store` に保存

### FR-12: ネットワーク監視UI [v1.1]

- `@react-native-community/netinfo` でネットワーク状態を監視
- オフライン時はヘッダーに「オフライン」バッジ表示
- オンライン復帰時に「同期しました」トースト表示

### FR-13: 競合警告UI [v1.1]

- ファイルを開く時に Drive 側のタイムスタンプを確認
- ローカルキャッシュとタイムスタンプが異なる場合、警告ダイアログ表示
- 「最新版を取得」「編集中の内容を保持」を選択可能

### FR-14: Undo / Redo [v1.1]

- 編集画面で Undo / Redo ボタンを提供
- 自動保存と組み合わせて、誤編集の取り消しを実現

### FR-15: 全文検索 [v2]

- 最近開いたファイル内のテキストを横断検索
- マッチした箇所を一覧表示、タップでジャンプ

### FR-16: iPad 左右分割プレビュー [v2]

- iPad では編集とプレビューを同時に左右分割で表示

### FR-17: Obsidian風 `![[...]]` リンク [v2]

- Obsidianの内部リンク記法 `[[note.md]]` をパースし、同フォルダ内ファイルへの参照としてレンダリング
- プリプロセスで標準Mdに変換するアプローチ
- 再オープンはピッカー経由 (MVP/v1.1と同様)

### FR-18: フォルダピッカー対応 (ローカル画像表示) [v2]

- `UIDocumentPicker` のフォルダ選択モードを追加
- 選択したフォルダ内のローカル画像 (`![](image.png)`) を表示可能に

### FR-19: 編集履歴 [v2]

- アプリ内でのローカルな編集履歴を保持 (10件程度)
- 過去のバージョンに戻せる

### FR-20: EnrichedMarkdownTextInput への移行 [v2]

- 編集UIを TextInput multiline から EnrichedMarkdownTextInput に移行
- 編集中もリアルタイムでMd記法を整形表示 (太字、見出し等)

### FR-21〜: 関連ファイル対応 [v3] (概略のみ)

- **PDF閲覧**: `react-native-pdf` で表示、ページめくり、ピンチズーム、テキスト選択
- **xlsx閲覧**: SheetJS で表示、シート切り替え、セル選択 (AnyFolio資産を移植)
- **Obsidian埋め込み記法**: `![[file.pdf]]` 形式でMdノートから関連ファイルを参照
- 詳細仕様は v3 着手時に別途 ADR で定義

## 8. 非機能要件 (NFR)

### NFR-01: パフォーマンス

- アプリ起動から最初のファイルを開けるまで 3秒以内
- 数千行以下のMdファイルのレンダリングは 1秒以内
- 自動保存の debounce 遅延は3秒 (ユーザー体感で「すぐ保存される」レベル)

### NFR-02: 信頼性

- ローカルファイルへの書き込みが成功した場合、編集内容のデータ損失は発生しない
- Drive 同期の失敗は File Provider に委譲 (Modrift側では確認できない)
- 競合発生時もデータロスは致命的ではない (Driveのバージョン履歴で回復可能)

### NFR-03: ユーザビリティ

- 日本語IME での長文編集が崩れないこと (実機検証必須)
- システム文字サイズ設定 (Dynamic Type) に追従
- キーボード表示時もテキストが隠れないレイアウト (`KeyboardAvoidingView`)

### NFR-04: セキュリティ・プライバシー

- ユーザーが選択したファイルのみアクセス可能 (iOS Sandbox 制約に従う)
- ファイル内容のクラウド送信なし (Drive 同期は File Provider 経由のみ)
- AsyncStorage には機微情報を保存しない (ファイル名のみ)
- Bookmark は `expo-secure-store` に保存 (v1.1以降)

### NFR-05: 互換性

- iOS 16以降を対象 (Expo Dev Client 最新版に追従)
- iPhone 12以降のRAMを推奨 (実機検証で要確認)
- Obsidian Vault の標準的なフォルダ構成と互換性あり

### NFR-06: 国際化

- UI: 日本語・英語の2言語対応 (3言語目以降はスコープ外)
- Mdコンテンツ: 全Unicode対応 (システムフォント任せ)
- 日付・数値ロケール: 簡易対応のみ (精密対応はスコープ外)

### NFR-07: 保守性

- TypeScriptで型安全性を確保
- ADR で重要な設計判断を記録 (`04_DesignDecisions/`)
- READMEに開発環境セットアップ手順を記載

## 9. 技術スタック

### コア

- Expo (React Native) + TypeScript
- expo-router

### 開発環境

- Expo Dev Client (react-native-enriched-markdown が Expo Go 非対応のため必須)

### ファイル取得

- expo-document-picker: `UIDocumentPickerViewController` のラッパー。Drive/iCloud/Dropbox全対応
- expo-file-system: ファイル読み書き。`copyToCacheDirectory: false` でFile Provider経由の直接編集が可能

### Mdレンダリング (閲覧)

- react-native-enriched-markdown (Software Mansion製、Fabric/New Architecture必須、md4cベースでCommonMark+GFM対応、ネイティブテキストレンダリング、LaTeX対応)
- 旧来の `react-native-markdown-display` は非推奨で、本ライブラリへの移行が公式推奨

### Md編集

- TextInput multiline (MVP)
- v2でEnrichedMarkdownTextInputへの移行を検討

### 国際化 (i18n)

- expo-localization: デバイス言語の取得
- i18next + react-i18next: 翻訳キー解決とReactコンポーネントへの統合

### ローカル永続化

- expo-secure-store: Security-Scoped Bookmark等のセキュア情報 (v1.1で使用開始)
- AsyncStorage (@react-native-async-storage/async-storage): 最近開いたファイル履歴、ユーザー設定

### 自動保存制御

- lodash debounce または独自実装で3秒debounce

### v3で追加予定 (関連ファイル対応)

- react-native-pdf: PDF閲覧
- SheetJS (xlsx): xlsx閲覧、AnyFolio資産の移植

### 配布

- EAS Build (development / preview / production の3プロファイル)
- TestFlight → App Store
- Apple Developer Program ($99/年)

## 10. 制約事項 (Gotchas)

### 10.1 File Provider関連

- **`copyToCacheDirectory: false` を必ず指定**:
  trueにするとアプリのキャッシュへ独立コピーされ、編集してもDriveに反映されない。

- **Security-Scoped Bookmark の保存が必須 (v1.1以降)**:
  Document Pickerで開いたファイルURIは**セッションを跨ぐと無効化**される。「最近開いたファイル」の再オープンを実装するには、URIをそのまま保存しても次回起動時に開けない。iOSの `URL.bookmarkData()` 相当の処理が必要
  - Expoだとこれが少し厄介。`expo-document-picker` 単体ではBookmark生成APIが露出していないので、**Expo Modules APIで自作のネイティブモジュール** (Swift数十行) を書く必要が出る可能性が高い (推定5-10営業日)
  - **MVPでの妥協案**: 「最近開いた」は表示のみで、再オープンはピッカー経由という設計にすればBookmark不要。v1.1以降でネイティブモジュールを追加実装

- **Google Drive公式アプリが未インストールだとピッカーにDriveが出ない**:
  オンボーディングで明示する必要あり

- **同期完了のコールバックがない**:
  `writeAsStringAsync` は「ローカルファイルへの書き込み完了」までしか保証しない。Driveへのアップロード完了はFile Provider内部で進行し、Modriftからは観測できない。MVP は状態 UI を出さないサイレント保存方針なので、この差を表示で誤魔化す必要はない (Apple Notes 流)

- **オフライン時の挙動 (FR-05で対応方針確定)**:
  オフラインで保存すると、書き込みはローカルキャッシュに成功、Driveへの反映はオンライン復帰時。MVPではUI上は明示しない (機能のみオフライン許可)。v1.1でネットワーク監視バッジを追加

- **競合 (Conflict)**:
  last-write-wins。Modriftで編集中にPCで同じファイルが更新・保存されると、Modrift側の保存で上書きされる。Google Drive側に変更履歴は残るので致命的ではないが、v1.1で警告UIを実装

- **大きいファイルの遅延**:
  数MB超のMdは滅多にないが、画像埋め込みMdだとあり得る。ピッカーでファイル選択 → 実際に開けるまでに数秒かかる場合の進捗表示が必要

### 10.2 自動保存関連 (FR-04で確定)

- **debounce 実装の留意点**:
  3秒の無操作で保存。連続入力中は保存しない。アプリがバックグラウンドに行った瞬間に強制保存 (pending な debounce を flush) する処理が必要

- **保存状態の UI は出さない (サイレント保存)**:
  Apple Notes / Bear / Obsidian と同様に、ユーザーに「保存」を意識させない設計。明示的な「保存中…」「保存済み」表示は持たない。書き込み失敗は MVP では受容、必要なら v1.1 でエラー時のみアラートを追加

- **Driveへの書き込み頻度**:
  自動保存だとローカル書き込み回数は増えるが、File Provider が intelligently に同期するため通信負荷は深刻ではない想定

### 10.3 Mdレンダリング関連 (react-native-enriched-markdown)

- **GFM (GitHub Flavored Markdown) は標準対応**:
  `react-native-enriched-markdown` はmd4cベースでCommonMark準拠 + GFM対応。テーブル、タスクリスト、取り消し線、URL自動リンクは標準で動く。脚注 (`[^1]`) はCommonMark/GFMの範囲外なので注意。

- **コードブロックのシンタックスハイライト**:
  ライブラリ単体ではコードブロックの言語別ハイライトは提供されない (フェンス記法 ` ```js ` 自体は認識するが、色分けは別実装)。MVPでは等幅フォント + 単色表示で割り切るのが現実的。v2で必要なら `shiki` や `prismjs` をWeb Workerで動かす、もしくはカスタムレンダラで自前実装。

- **画像の表示 (FR-02・FR-18で対応方針確定)**:
  MVPはHTTPS画像のみ表示、ローカル画像はプレースホルダ。Md内の `![](image.png)` (相対パス) はModriftから同フォルダの画像にアクセスできない (Document Pickerは選択した1ファイルのみアクセス許可)。v2でフォルダ選択モード対応

- **LaTeX数式**:
  ライブラリはLaTeX数式レンダリング (ブロック `$$...$$` はGFM flavor、インライン `$...$` は全flavor) をサポート、オプションのpeer dependencyとして `katex` のインストールが必要。SAP業務メモやObsidianノート用途では当面不要なら入れない。

- **絵文字や日本語の表示**:
  ネイティブテキストレンダリング (WebViewなし) のため、システムフォントが直接使われる。日本語・絵文字は基本問題なく表示される。カスタムフォントを指定する場合のみ、絵文字フォールバックを意識する。

- **Obsidian独自記法は非対応**:
  `![[wikilink]]`、`[[内部リンク]]`、`==ハイライト==`、`%%コメント%%`、Callout (`> [!note]`) などObsidian拡張は標準では認識されない。CommonMark/GFM外なので想定通り。v2の「Obsidian風リンク対応」では、レンダリング前にプリプロセスで標準Mdに変換するアプローチが現実的。

- **大きなファイルでのパフォーマンス**:
  ネイティブレンダリング + md4cパーサで高速だが、数万行のMdは未検証。実機での挙動確認は実装後に行う。

### 10.4 iOS/App Store関連

- **TextInput multilineの日本語入力**:
  iOSのIME (日本語入力) で長文編集すると、変換確定前のテキスト処理が稀に崩れる。`onChangeText` で逐次state更新する設計だと顕在化しやすい。実機での検証必須。自動保存とIMEの組み合わせは特に要注意

- **編集中のキーボード表示でレイアウト崩れ**:
  `KeyboardAvoidingView` を正しく組み込む必要あり。iPhone Xシリーズ以降はSafe Areaも考慮

- **Dynamic Type 対応**:
  システム文字サイズ設定に追従しないと、視覚アクセシビリティ的に減点される。App Store審査で指摘されることがある

- **Share Extension の実装 (v1.1)**:
  Expoの`expo-share-extension` または自前のApp Extension。**Expoのプレビルド外**の追加実装が必要で、ここで詰まる人が多い

- **審査での「アプリの目的」説明**:
  シンプルすぎるアプリは「機能不足」でリジェクトされることがある。スクリーンショットとレビュアー向けノートでユースケースを明示

- **Files Appとの統合は App Store的にウケが良い**:
  「iOSのファイルシステムを正しく使っている」のはAppleの推奨パターン。逆風はない

### 10.5 制約事項のサマリー

| カテゴリ | 制約 |
|||
| 技術 | Expo Dev Client必須、React Native New Architecture (Fabric) |
| iOS固有 | Sandbox、Security-Scoped Bookmark、File Provider同期完了は観測不可 |
| App Store審査 | Dynamic Type対応、アプリ目的の明示、Privacy Manifest |
| 配布 | Apple Developer Program ($99/年)、EAS Build、TestFlight→App Store |

## 11. 受け入れ基準 (MVP リリース判定)

### 機能面

- [ ] `.md` ファイルを Modrift の Document Picker から Drive 経由で開ける (経路A)
- [ ] iOS Files App で `.md` ファイルを長押し → 「Modrift で開く」で Modrift が起動して該当ファイルが表示される (経路B、Open In)
- [ ] プレビュー表示が正しい (見出し、リスト、リンク、コード、引用、HTTPS画像)
- [ ] 編集して3秒後に自動保存される (UI 表示なし、再オープンで反映を確認)
- [ ] 編集内容が Drive 側にも反映される (オンライン時)
- [ ] 最近開いたファイルがリストに表示される
- [ ] UI が日本語・英語で切り替わる (デバイス言語に追従)

### 品質面

- [ ] 日本語IMEで長文編集しても文字化けや変換崩れがない (実機検証済み)
- [ ] アプリ起動 → ファイル選択 → プレビュー表示が3秒以内
- [ ] アプリをバックグラウンド遷移しても編集内容が消えない (強制保存される)
- [ ] オフライン時に編集してオンライン復帰すると Drive に反映される
- [ ] iPhone 12以降の実機で動作確認済み

### 配布面

- [ ] TestFlight に内部配布できている
- [ ] EAS Build (production プロファイル) でビルド成功
- [ ] App Store スクリーンショット 6枚以上、申請文を準備

## 12. ロードマップ

### Phase 1: MVP (1-2週)

- 基本機能の実装 (ファイルを開く、プレビュー、編集、自動保存)
- 日英 i18n 対応
- HTTPS画像表示
- TestFlight 内部配布

### Phase 2: v1.1 (2-3週)

- Share Extension 実装
- ダーク/ライトモード・フォントサイズ調整
- Security-Scoped Bookmark によるネイティブモジュール追加
- ネットワーク監視UI・競合警告UI・Undo/Redo

### Phase 3: 公開準備 (1-2週)

- App Store 審査対応
- スクリーンショット・申請文の整備
- 初期フィードバックの反映

**Phase 1〜3 合計目安**: TestFlight 内部配布まで 1.5-2ヶ月、App Store 公開まで約3ヶ月

### Phase 4: v2 (Md機能の充実) (公開後、ユーザーフィードバック次第)

- 検索、iPad 左右分割プレビュー
- フォルダピッカー対応 (ローカル画像表示、Obsidian風リンク)
- 編集履歴、EnrichedMarkdownTextInput への移行

### Phase 5: v3 (関連ファイル対応) (v2 リリース後)

- PDF閲覧 (react-native-pdf 統合、ページめくり、ズーム)
- xlsx閲覧 (SheetJS 統合、AnyFolio 資産の移植)
- Obsidian の `![[file.pdf]]` 埋め込み記法対応

### Phase 6 以降

- PDF注釈、xlsx簡易編集
- コミュニティの声に応じた拡張

## 13. リスク

### 技術リスク

- **R-01: Security-Scoped Bookmark の Swift ネイティブモジュール実装** (v1.1の難所、推定5-10営業日)
- **R-02: 日本語IMEと自動保存の組み合わせでの挙動崩れ** (実機検証必須)
- **R-03: react-native-enriched-markdown の Obsidian Vault 互換性** (大規模Vaultで未検証)
- **R-04: 競合発生時のユーザー体験** (last-write-winsの許容範囲は要検証)

### 戦略リスク

- **R-05: iOS Files App との差別化が薄いと感じられる懸念** (Md整形・xlsx対応で差別化、Whyセクションで明示)
- **R-06: Obsidian Mobile が軽量化された場合の競合激化** (公式の更新動向をウォッチ)
- **R-07: App Store審査で「機能不足」リジェクト** (スクリーンショット + ユースケース明示で対応)

## 14. 用語定義

- **Vault**: Obsidian の用語で、Mdファイル群を格納するフォルダ
- **File Provider**: iOS のファイル共有機能。Google Drive アプリ等が iOS Files App に統合される仕組み
- **Document Picker**: iOS の `UIDocumentPickerViewController`。ファイル選択ダイアログ
- **Security-Scoped Bookmark**: iOS でファイルアクセス権限を永続化する仕組み (`URL.bookmarkData()`)
- **debounce**: 連続したイベントを一定時間待ってまとめる処理。自動保存に使用
- **GFM**: GitHub Flavored Markdown。CommonMark拡張で、テーブル、タスクリスト等を含む

## 15. 関連リンク

### プロジェクト内ドキュメント

(現状、本ドキュメントが唯一のプロジェクト内ドキュメント。今後、技術ノート・ロードマップ詳細などを追加予定。)

### 外部ドキュメント

- react-native-enriched-markdown: [https://github.com/software-mansion-labs/react-native-enriched-markdown](https://github.com/software-mansion-labs/react-native-enriched-markdown)
- expo-document-picker: [https://docs.expo.dev/versions/latest/sdk/document-picker/](https://docs.expo.dev/versions/latest/sdk/document-picker/)
- expo-file-system: [https://docs.expo.dev/versions/latest/sdk/filesystem/](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- Apple File Provider Extension: [https://developer.apple.com/documentation/fileprovider](https://developer.apple.com/documentation/fileprovider)

## 16. 改訂履歴

- **2026-05-25 (初版)**: Overview.md と分離していた要件定義書を統合、1ファイルに集約。Modrift (旧名Markdot) としてのコンセプト確定 (Md中核 + 関連ファイル横断)。
- **2026-05-25 (改訂1)**: ADR (`04_DesignDecisions/`) を廃止し、設計判断の経緯を各FRに統合。ドキュメント体系を1ファイルに完全集約。
- **2026-05-25 (改訂2)**: 以下を更新:
  - 概要: 「段階的な Vault 扱いの進化」を明示 (MVP=個別ファイル、v2=フォルダ、v3=Vault全体)
  - 概要: Files App との補完関係を明示
  - 背景・目的: iA Writer との差別化を強化 (執筆ツール vs 軽量参照ツール)
  - 背景・目的: 競合との比較表を追加
  - 想定ユースケース: 2つの起動経路 (Modrift起点 / Files App起点) を明示
  - スコープMVP: 「Files App / 他アプリからの Open In 対応」を追加
  - FR-01: Document Picker (経路A) と Open In (経路B) を統合
  - FR-08: Share Extension と Open In の違いを明確化
  - 受け入れ基準: Open In のテスト項目を追加
- **2026-05-25 (改訂3)**: 自動保存の状態表示方針を変更:
  - スコープMVP: 「保存状態インジケータ」項目を削除
  - FR-04: 「サブタイトル表示 vs 完全サイレント」の検討経緯を追加、**完全サイレント** を採用 (Apple Notes / Bear / Obsidian と同様、ユーザに保存を意識させない)
  - 制約事項 10.2: 「保存状態の UI 表示」項目をサイレント方針に書き換え
  - 受け入れ基準: 「保存状態 UI が更新される」を「3秒後に自動保存される (再オープンで反映を確認)」に修正
