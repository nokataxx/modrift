# App Store 掲載情報 (Listing Copy)

App Store Connect に入力する掲載テキストの下書き。日英2ロケール。実機で確定前に文字数は再確認すること（サブタイトル30字 / キーワード100字 / プロモ170字）。

## 共通メタデータ

| 項目                    | 値                                              |
| ----------------------- | ----------------------------------------------- |
| 表示名 (App Name)       | Modrift                                         |
| Bundle ID               | com.modrift.app                              |
| 主カテゴリ              | Productivity                                    |
| 副カテゴリ              | Utilities（任意・空でも可）                     |
| 価格                    | Free（無料）                                    |
| 年齢制限                | 4+（暴力・成人向け要素なし）                    |
| 著作権 (Copyright)      | 2026 Noriyuki Katahara                          |
| サポートURL             | https://modrift.github.io/support.html          |
| マーケティングURL       | https://modrift.github.io/ （任意）             |
| プライバシーポリシーURL | https://modrift.github.io/privacy.html          |

---

## 日本語 (ja)

### サブタイトル（30字以内）

Markdownをサッと開いて軽く編集

### キーワード（100字以内・カンマ区切り）

markdown,md,obsidian,エディタ,メモ,テキスト,ノート,icloud,ビューア,書類,プレビュー

### プロモーションテキスト（170字以内・審査不要で随時更新可）

iPhoneでクラウドやメール添付のMarkdownをどこからでもサッと開いて、整形表示で読んで、その場で軽く直せる。軽快さに特化したミニマルなMarkdownクライアントです。

### 説明文（Description）

Modrift は、クラウド上の Markdown ファイルを iPhone でサッと開いて読み、その場で軽く直せる軽量クライアントです。重厚なノートアプリではなく、「開いて・読んで・少し直す」を最速で。

■ 主な機能
・Markdown ファイル（.md / .txt / .markdown）を開いて整形表示
・Files アプリや他アプリの「Modriftで開く」からそのまま起動
・自分の作業ホーム（iCloud › Modrift）でファイルを一覧・新規作成・整理
・「マイファイル」（場所）と「最近見た」（時間）の2つの見方を切り替え
・編集モード ⇄ プレビューモードをワンタップで切り替え
・自動保存（手動セーブ不要）
・本文の検索、更新日 / 名前での並び替え
・横向きにすると行が長くなり、長文や表が読みやすい
・日本語 / 英語の UI 切り替え

■ ホームと編集について
・ホーム（iCloud › Modrift）のファイルは、そのまま編集できます。編集は iCloud に同期されます
・ホーム以外のファイル（Dropbox / Google Drive、Modrift フォルダ外の iCloud Drive など）は閲覧できます。編集したいときは「ホームにコピー」でホームに取り込んでから編集します（原本には書き戻りません）
・ホームの保存先は設定で「iCloud」と「この iPhone」から選べます

■ Files アプリとの関係
Modrift は Files アプリの代わりではなく、補完するアプリです。一般的なフォルダ管理は Files に任せ、Modrift は Markdown の整形表示と軽い編集、そして自分のホームフォルダの整理に集中します。

名前の由来は Mo（Mobile / Motion）+ drift（漂う、流れる）。モバイルで思考やファイルが軽やかに行き来する体験を目指しています。

---

## English (en)

### Subtitle (≤30 chars)

Open & edit Markdown, fast

### Keywords (≤100 chars, comma-separated)

markdown,md,obsidian,editor,notes,text,icloud,viewer,document,preview,plain text

### Promotional Text (≤170 chars)

Open Markdown from any cloud or email attachment on iPhone, read it beautifully formatted, and make quick edits in place. A minimal, fast Markdown client.

### Description

Modrift is a lightweight client for quickly opening, reading, and lightly editing Markdown files stored in the cloud — right from your iPhone. Not a heavy notes app: just open, read, and tweak, as fast as possible.

Key features

- Open Markdown files (.md / .txt / .markdown) with clean formatted rendering
- Launch straight from Files or any app via "Open in Modrift"
- Keep your own working home (iCloud › Modrift): list, create and organise files there
- Switch between My Files (by place) and Recent (by time)
- Toggle between edit and preview with one tap
- Automatic saving (no manual save button)
- Full-text search, and sorting by date modified or name
- Turn to landscape for longer lines — easier on long paragraphs and tables
- Japanese / English interface

About your home and editing

- Files in your home (iCloud › Modrift) are editable in place, and edits sync to iCloud
- Files outside your home (Dropbox / Google Drive, or iCloud Drive outside the Modrift folder) are view-only. To edit one, use "Copy to Home" and edit the copy (the original is not written back)
- You can choose whether your home lives in iCloud or on this iPhone, in Settings

Relationship to the Files app
Modrift complements the Files app rather than replacing it. Leave general folder management to Files; Modrift focuses on formatted Markdown viewing, light editing, and tidying its own home folder.

The name combines Mo (Mobile / Motion) + drift — the idea of thoughts and files flowing freely on mobile.

---

## リリースノート (What's New)

App Store Connect のバージョンごとの「このバージョンの新機能」欄。**掲載文の Description とは別枠**なので、バージョンを作るたびにここから貼る。

### 1.5.0 — 編集ツールバーと読みやすさの改善

> ネイティブ変更あり（File Provider の未ダウンロードファイルを協調読み込みで開けるようにした、FR-40）。権限・データの扱いに変更はなく、審査メモは v1.4 を踏襲。

**日本語 (ja)**

```
編集と表示を快適にする改善を加えました。

・編集モードでキーボードの上に書式ツールバーを追加。見出し・箇条書き・番号付き・チェックボックス・太字・斜体・取り消し線・コード・引用・リンク・水平線をワンタップで。undo / redo も手元から
・スクロールするとヘッダーが隠れ、本文の表示領域が広がります（上にスクロールで再表示）
・ホームでファイルをまとめて選択して削除できるようになりました
・「見出し 下線（--- / ===）」の記法を正しく見出しとして表示するようにしました
・クラウド（Google Drive など）のまだ端末にダウンロードされていないファイルを、開くときに確実に取り込んで表示するよう改善しました。読み込みに失敗したときは分かりやすいメッセージと「再試行」を表示します
・横向き・オフライン表示まわりの細かなレイアウトを調整しました
```

**English (en)**

```
Improvements that make editing and reading more comfortable.

- A new formatting toolbar above the keyboard in edit mode: headings, bullet/numbered/checkbox lists, bold, italic, strikethrough, code, quote, link and horizontal rule — one tap each, with undo / redo at your thumb
- The header now hides as you scroll, giving the text more room (scroll up to bring it back)
- You can now select and delete multiple files at once in your home
- Setext headings (underlined with --- / ===) now render correctly as headings
- Files in the cloud (e.g. Google Drive) that aren't downloaded yet are now fetched reliably when you open them. If a read fails, you get a clear message and a Retry button
- Small layout fixes around landscape and the offline state
```

---

### 1.4.0 — ホームフォルダ中心のリデザイン

> **重要な変更点**: 編集できる範囲がホームフォルダ内に変わった。v1.3 までは Modrift フォルダ外の iCloud Drive ファイルもその場で編集できたため、既存ユーザーが気付く変更。リリースノートで明示し、代替手段 (ホームにコピー) を必ず併記する。

**日本語 (ja)**

```
Modrift のホーム画面を刷新しました。

・ホーム（iCloud › Modrift）にファイルをまとめて、一覧・新規作成・名前変更・複製・削除ができます
・ホームは「マイファイル」（場所）と「最近見た」（時間）の2つの見方を切り替えて使えます
・マイファイルに更新日付を表示。更新日 / ファイル名で並び替えできます
・ファイルの種類がアイコンで見分けられるようになりました
・検索がマイファイルと最近見たの両方に対応しました
・横向きに対応（ファイルを開いているとき）。行が長くなり、長文や表が読みやすくなります
・ホームの保存先を「iCloud」と「この iPhone」から選べます

編集できる範囲について:
編集はホームフォルダ内のファイルが対象になりました。ホーム以外のファイル（Dropbox / Google Drive、Modrift フォルダ外の iCloud Drive など）は閲覧できます。編集したいときは「ホームにコピー」でホームに取り込んでください。
```

**English (en)**

```
Modrift's home screen has been redesigned.

- Keep your files in your home (iCloud › Modrift): list, create, rename, duplicate and delete them there
- Switch the home between two views: My Files (by place) and Recent (by time)
- My Files now shows the date modified, and can be sorted by date or name
- File types are now distinguishable at a glance by their icons
- Search now covers both My Files and Recent
- Landscape support while viewing a file — longer lines make long paragraphs and tables easier to read
- Choose whether your home lives in iCloud or on this iPhone

About what you can edit:
Editing now applies to files in your home folder. Files outside it (Dropbox / Google Drive, or iCloud Drive outside the Modrift folder) are view-only — use "Copy to Home" to bring one in and edit the copy.
```

---

## スクリーンショット

現行: 6.9" iPhone (1320×2868) 3枚 ＋ 13" iPad 3枚 → `store-assets/screenshots/`（01 ビューア / 02 設定 / 03 ホーム）

**v1.5 での差し替え要否:**

| ファイル | 要否 | 理由 |
|---|---|---|
| `*-03-home.png` | **必須** | タブ名が「マイファイル/最近見た」→「ホーム/履歴」に変わった。旧スクショはラベルが古い |
| `*-01-viewer.png` | 推奨 | v1.5 の目玉である編集ツールバー（キーボード上の書式バー）を写した編集モードの1枚に差し替えると訴求できる |
| `*-02-settings.png` | 任意 | 設定は v1.4 から実質変化なし（「この iPhone」→「Local」の表記のみ）。差し替えは任意 |

> 撮影は iPhone 実機 or シミュレータ。iPad は 13" シミュレータ（[[project_ipad_native_support]] の手順）。ホームは実ファイルが数件入った状態で撮ると内容が伝わりやすい。編集ツールバーは編集可能なホーム内ファイルを開き、編集モードに入るとキーボード上に出る。
