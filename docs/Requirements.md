# Modrift 要件定義書

iOS / Android 向けの軽量モバイルクライアントアプリ「Modrift」の要件定義書。

- **作成日**: 2026-05-25
- **想定読者**: Nokata (開発者) 本人、将来Claude等と相談する際の参照ドキュメント
- **関連ドキュメント**: なし (本ファイルが唯一のプロジェクトドキュメント。今後、技術ノートなど追加予定)

## 1. 概要

Modrift は クラウドストレージ (iCloud Drive / Dropbox 等) 上の Obsidian Vault を iPhone でサクッと開いて読める、軽く直せる軽量モバイルクライアントアプリ。

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

- ファイルを開く (`.md` / `.markdown` / `.txt` / `.text` 対応)
- Document Pickerからの選択
- **iOS Files App や他アプリから「Modrift で開く」(Open In) 対応** ← FR-08
- Mdプレビュー表示 (見出し、リスト、リンク、コード、引用、HTTPS画像)
- ローカル画像はプレースホルダ表示 (`[画像: filename.png]`)
- 編集モード ⇄ プレビューモードのトグル
- **編集の保存先はストレージで分岐: iCloud / ローカルは in-place 編集、Google Drive 等は iCloud にコピーして編集** ← FR-03
- **自動保存 (3秒 debounce、サイレント) — 保存先は編集対象 (in-place の元ファイル or iCloud コピー)** ← FR-04
- **オフライン編集を許可** ← FR-05
- 最近開いたファイルのリスト + **タップで再オープン (Security-Scoped Bookmark)** ← FR-11
- 日英の UI 切り替え (デバイス言語に追従)

### 5.2 v1.1 (Phase 2)

- Share Extension対応 — Drive アプリや他アプリの「共有」シートから Modrift で直接開ける (Open In と異なり、複数アプリ共通の共有メニュー対応)
- ダーク/ライトモード
- フォントサイズ調整
- 見出し (H1〜H4) のカラーリング — Preview の見出しに階層別の色を付与して可読性・アプリらしさを高める
- ネットワーク状態の監視UI (オンライン/オフラインバッジ)
- 競合警告UI (Drive側のタイムスタンプ確認)
- Undo / Redo
- Modrift 生成の iCloud 編集コピーの整理 (リネーム・削除) — Modrift 自身が作ったコピー限定。一般のファイル管理機能は持たない ([FR-22](#fr-22-modrift-生成-icloud-コピーの整理-リネーム削除-v11))

### 5.3 v2 (Phase 4)

- 検索 (最近開いたファイル内の全文検索)
- iPad対応の左右分割プレビュー
- Obsidian風 `![[...]]` リンク (同フォルダ内ファイルへの参照のみ、ピッカー経由)
- **フォルダピッカー対応 — ローカル画像表示** ← FR-18
- **新規 Md ファイルの作成 — フォルダピッカーで選んだ Vault フォルダ内に作成** ← FR-23
- **Vault ブラウザ — 指定フォルダを Modrift 独自 UI で参照、日常導線から Document Picker を外す** ← FR-24
- **見出しスタイルのユーザー選択 — プリセット・テンプレートから配色を選ぶ** ← FR-25
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
- 一般的なファイル管理機能 (任意ファイルのリネーム・移動・削除、フォルダ管理) — Files アプリに任せる。**例外**: Modrift 自身が生成した iCloud 編集コピーの整理 (リネーム・削除) のみ v1.1 で対応 ([FR-22](#fr-22-modrift-生成-icloud-コピーの整理-リネーム削除-v11))。これは自分の生成物の後始末であり、ファイルマネージャ化ではない
- リアルタイム共同編集
- プラグイン機構
- 明示的な手動Saveボタン (FR-04で自動保存に統一)
- PDFのページ追加・削除等の本格編集 (Files App や Apple Books に委ねる)
- xlsx の数式編集や複雑な編集 (Numbers や Excel に委ねる)
- 画像の編集機能 (写真アプリや専用編集ツールに委ねる)
- Google Drive 等 (書き戻し非対応の File Provider) への編集の直接書き戻し — 編集は iCloud コピーで行う (**Google Drive API 連携は採用しない**)
- 編集用 iCloud コピーと元ファイルの永続リンク・双方向同期 — コピーは作成時点のスナップショット (FR-03)

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
- iOS Document Picker で `.md` / `.markdown` / `.txt` / `.text` ファイルを選択して開く
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

**編集の保存先 — ストレージにより分岐 (重要)**:

iOS の File Provider はプロバイダにより書き戻し可否が異なる (10.1 参照)。Modrift は「編集が確実に保存される場所」でのみ in-place 編集し、それ以外は iCloud にコピーして編集する。

- **iCloud Drive / アプリローカル のファイル → その場で in-place 編集・保存** (元ファイルを直接更新)
  - 判定: URI が `…/Mobile Documents/com~apple~CloudDocs/…` (iCloud) またはアプリサンドボックス配下
- **それ以外 (Google Drive 等のサードパーティ File Provider) → iCloud にコピーして編集**
  - 「編集」操作時に iCloud Drive 内 `Modrift/` フォルダへ**新規コピーを作成**し、そのコピーを編集する
  - 同名コピーが既にあれば `-1`, `-2` … で重複回避 (**上書き・永続リンクはしない**。コピーは作成時点のスナップショット)
  - **元の Google Drive ファイルは更新されない** (書き戻し不可。10.1 参照)
  - 以前作った編集用コピーの続きを編集したい場合は、ユーザーが iCloud から直接そのファイルを開く (= in-place 編集)

**全経路 preview-first に統一 (確定)**:

開く経路 (経路A Document Picker / 経路B Open In / Files) や iOS の配送方式 (in-place か Inbox コピーか) に関わらず、**すべて preview で開く**。コピーは「開いたこと」ではなく**編集意思 (編集ボタン)** に紐づく ([FR-20](#fr-20-enrichedmarkdowntextinput-への移行-v2) と同じ原則)。これにより「同じファイルが開き方で違う挙動になる」非一貫を解消する。

- **in-place 編集可 (iCloud / ローカル)**: preview → 編集モードでそのまま in-place 編集・保存。
- **非 in-place ソース (Google Drive 等)**: preview → 編集ボタンで iCloud コピー → コピーを編集。
- **Open-In の Inbox コピー (Mail 添付・AirDrop 等の使い捨て)**: 他と同様に preview で開く (in-place 編集不可なので編集は iCloud コピー経由)。
  - **読み捨て** (編集せず離脱) なら Inbox の使い捨てコピーは削除。**編集** したら iCloud コピーを作成し Inbox 元を削除。
  - 受信時に即コピーする旧フロー (eager copy + ダイアログ) は廃止。

**UI (誤解を防ぐ)**:

- 編集不可ソース (Google Drive 等) で「編集」を押したとき、「このファイルは直接編集できないため iCloud にコピーを作成して編集します」と明示するダイアログを表示 (2 ボタン: キャンセル / 編集)
  - 「次回から表示しない」suppress 機能は MVP では持たず、v1.1 の Settings 画面に温存
- 「iCloud の編集用コピーを編集中」バナーは**表示しない** (実装初期に廃止)

**実装段階 (重要)**:
- iCloud コピー編集 (上記) は iCloud コンテナの entitlement が必要 → **有料 Apple Developer Program 加入後に実装**（無料 Personal Team では iCloud capability を使えない）
- それまでの暫定動作: in-place 編集不可のファイル (Google Drive 等) は **閲覧のみ** とし、編集ボタンを出さず「閲覧のみ」を明示。iCloud / ローカルのファイルは従来どおり in-place 編集可
- 判定ロジック (`isInPlaceEditable`) は暫定・本実装で共通利用

### FR-04: 自動保存 [MVP]

- 編集後3秒間の無操作で自動保存 (debounce)
- アプリがバックグラウンドに遷移した瞬間に強制保存 (pending な debounce を flush)
- **保存状態の UI 表示は出さない (サイレント保存)** — Apple Notes / Bear / Obsidian と同じ「黙って保存」スタイル
- **保存先は現在編集中のファイル** (FR-03 の分岐に従う。in-place 編集なら元ファイル、コピー編集なら iCloud の編集用コピー)。**Google Drive の原本には書き戻さない**

**設計判断の経緯**:

- 検討した代替案: (a) ボタン式 (明示的Save)、(b) 自動保存、(c) ハイブリッド (自動+手動)
- 採用: **(b) 自動保存** — iOSメモ・Apple純正アプリと同等のUX、「保存し忘れ」リスクを根本回避、モバイルアプリらしい体験
- 状態 UI を出すか出さないかの検討: (a) サブタイトル表示、(b) 完全サイレント
  - 採用: **(b) 完全サイレント** — Apple純正アプリの主流パターンに合わせ、UI ノイズを最小化。「いま保存されたか?」をユーザに考えさせない設計を優先
  - トレードオフ: 保存エラー時にユーザが気付きにくい → MVP では稀な書き込み失敗は許容、必要なら v1.1 でエラー時のみアラート追加
- トレードオフ: 誤編集の取り消しが必要 → v1.1で Undo/Redo (FR-14) で対応。競合リスク → v1.1で警告UI (FR-13) で対応
- 「意図的に実装しないもの」に明示的な手動Saveボタンを追加 (5.6 参照)

### FR-05: オフライン編集 [MVP]

- オフラインでも編集・ローカル保存可能 (in-place 編集の場合、File Provider が後でクラウドへアップロード)
- MVPではネットワーク状態の監視UIは省略 (機能のみオフライン許可)

**設計判断の経緯**:

- 検討した代替案: (a) 許可 (警告UIなし)、(b) 読み取り専用、(c) 許可 + 警告UI
- 採用: **(c) 許可 + 警告UI** (ただしMVPは最小実装) — Obsidian Mobile、iA Writer、Bear、Apple純正メモ全てがオフライン編集を許可、「軽く直す」コンセプトと一致
- MVPの妥協: 機能としてオフライン編集は許可するが、UIは「オンライン前提」で割り切る。ネットワーク監視UIは v1.1 (FR-12)、競合警告UIは v1.1 (FR-13) に回す
- トレードオフ: 競合発生時のデータロス → Driveのバージョン履歴で回復可能

### FR-06: 最近開いたファイルリスト [MVP]

- 過去に開いたファイルを AsyncStorage に保存し、ホーム画面に表示
- **記録するのは「Modrift が確実に再オープンできる入口」で開いたものだけ** (入口で判定):
  - ✅ 記録: アプリ内「ファイルを開く」(Document Picker, `source=picker`) / 履歴からの再オープン (`source=history`) / 編集で生成した iCloud コピー (`source=icloudCopy`)
  - ❌ 記録しない: **iOS の Open In / 共有シート経由 (source なし)** — 全部記録しない。理由:
    - 外部 File Provider (Google Drive 等) を Files から in-place で開いた URI (`/Library/CloudStorage/…`) は **bookmark が起動を跨いで解決できず再オープン不可**。同じファイルでも **Document Picker 経由 (アプリグループの File Provider Storage 実体) なら再オープンできる**ため、入口で差が出る
    - Inbox の使い捨てコピーは読み捨てで削除されるため死リンクになる
  - 結果: **Google Drive 等を履歴に残したいなら「ファイルを開く」から開く**。Files の Open In は「今だけ開く」。iCloud Drive のファイルも Open In では記録しない (記録したいなら「ファイルを開く」か、編集して iCloud コピー化)
- **タップで再オープン対応** — Security-Scoped Bookmark を URI と一緒に保存し、再オープン時に bookmark を解決して security scope を取得する (FR-11)
- **再オープンの判定順**: bookmark 解決 → 失敗時は `uri` 直接オープンを試す (アプリ自身の iCloud コピーは bookmark 不要で開けるため、有効なエントリを誤削除しない) → それでも開けなければエントリを削除しエラー表示
- エラー文言は断定を避ける (移動・削除のほか「iCloud から未ダウンロード」の可能性も示し、後で再試行できることを伝える)

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

### FR-11: 再オープン対応 (Security-Scoped Bookmark) [MVP]

- 最近開いたファイルをリストからタップして再オープン可能に
- iOSの `URL.bookmarkData()` を使用、Expo Modules API でネイティブモジュール (Swift) を実装
- Bookmark は base64 文字列化して **AsyncStorage** に保存 (Bookmark データ自体は機微情報ではないため Keychain は使わない)
- ファイル取得時に毎回 Bookmark を再生成 (stale 状態の自己回復)
- **解決失敗時のフォールバック**: いきなり削除せず `uri` 直接オープンを試す (アプリ自身の iCloud コピーは bookmark なしで開けるため)。それでも開けないエントリだけ削除し、断定を避けた再オープンエラーを表示 (FR-06 参照)

### FR-12: ネットワーク監視UI [v1.1]

- `@react-native-community/netinfo` でネットワーク状態を監視
- オフライン時はヘッダーに「オフライン」バッジ表示
- オンライン復帰時に「同期しました」トースト表示

### FR-13: 競合警告UI [v1.1]

Modrift はファイルを**その場で直接編集**し、独立した「ローカルキャッシュ」を持たない (FR-03)。そのため競合の本質は「開く時点の食い違い」ではなく、**保存時の上書き事故 (lost update)** にある: 開いてから別デバイスのクラウド同期や他アプリが同じファイルを更新した状態で自動保存すると、新しい外部版を古い編集内容で踏み潰してしまう。

- **検知は保存時**に行う。ファイルを読んだ時点の更新時刻 (`modificationTime`) を baseline として記録し、保存直前に現在の更新時刻と比較する。baseline より新しければ外部変更ありと判定
- 外部変更を検知したら**サイレント自動保存 (FR-04) を止めて**警告ダイアログを表示
- 選択肢は2つ:
  - **編集中の内容を保持**: 自分の編集で上書き保存する (外部版は失われる)
  - **最新版を取得**: ディスクから読み直してエディタを差し替える (自分の編集は破棄)
- ダイアログは**ロックではなく確認**。「編集中の内容を保持」を選べば常に保存できる
- 自分が保存した直後は baseline を更新し、自分の書き込みやクラウド同期の往復を誤検知しない
- バックグラウンド遷移・画面離脱時の保存ではモーダルを出せないため、競合時は書き込みを保留する (編集内容はメモリに残り、次の保存時に確認)

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
- このフォルダアクセス (security-scoped bookmark) を土台に、Vault を独自 UI で参照する [FR-24 (Vault ブラウザ)](#fr-24-vault-ブラウザ-v2) と、Vault 内への新規作成 ([FR-23](#fr-23-新規-md-ファイルの作成-v2)) が乗る

### FR-19: 編集履歴 [v2]

- アプリ内でのローカルな編集履歴を保持 (10件程度)
- 過去のバージョンに戻せる

### FR-20: EnrichedMarkdownTextInput への移行 [v2]

- 編集UIを TextInput multiline から EnrichedMarkdownTextInput に移行
- 編集中もリアルタイムでMd記法を整形表示 (太字、見出し等)

**編集スタイルの方針 (確定): Obsidian 形式 (A) を採用**

- **閲覧モード (Reading view) と編集モード (ライブプレビュー) の2モード構造を維持する**。Notion 風の完全 WYSIWYG (ソースを見せない単一モード) は採用しない。
  - 理由: Modrift のコアは「読むが主・書くが従」。読む道具 (閲覧) と書く道具 (編集) を分ける Obsidian のメンタルモデルが軽快さ・Vault 互換と相性が良い。
  - ライブプレビューはカーソル行で生の Md 記法を露出する「整形されたエディタ」、閲覧モードは記法を一切見せない読み専用ビュー、という役割分担。

- **コピーは「モードを開いたこと」ではなく「編集の意思」に紐づける (FR-03 の原則を保持)**:
  - in-place 編集可 (iCloud / ローカル) のファイルは、編集モードでそのままライブプレビュー編集し in-place 保存。
  - **非 in-place ソース (Google Drive 等) は閲覧モードで開き、iCloud コピーは作成しない**。明示的に編集モードに入った時点で初めて iCloud コピーのゲート (FR-03 のダイアログ) が働く。
  - → ライブプレビュー化しても「閲覧しただけで iCloud にコピーが溜まる」ことは起きない。
  - 詳細な実装方針 (read-only 整形ビュー / 遅延コピー等の選択) は v2 着手時の ADR で確定する。

### FR-21〜: 関連ファイル対応 [v3] (概略のみ)

- **PDF閲覧**: `react-native-pdf` で表示、ページめくり、ピンチズーム、テキスト選択
- **xlsx閲覧**: SheetJS で表示、シート切り替え、セル選択 (AnyFolio資産を移植)
- **Obsidian埋め込み記法**: `![[file.pdf]]` 形式でMdノートから関連ファイルを参照
- 詳細仕様は v3 着手時に別途 ADR で定義

### FR-22: Modrift 生成 iCloud コピーの整理 (リネーム・削除) [v1.1]

FR-03 で Modrift は iCloud Drive の `Modrift/` フォルダに編集用コピーを生成する (`Bookmarks-1.md` 等)。これらは**ユーザーの任意ファイルではなく Modrift 自身の生成物**なので、その後始末 (リネーム・削除) のみアプリ内で行えるようにする。

- **対象は Modrift が生成した iCloud コピーに限定**。任意の iCloud ファイルや他フォルダのファイルは対象外 (= 一般的なファイルマネージャにはしない。[5.6](#56-意図的に実装しないもの) を維持)。
  - 判定: iCloud ubiquity container / `iCloud Drive › Modrift` 配下、かつ Modrift 経由で作成したコピー。
- **リネーム**: コピーの名前を変更 (`-1` のままにせず意味のある名前に)。
- **削除**: コピーのファイル本体を削除。**確認ダイアログ必須** (誤削除防止)。削除後は履歴からも除去。
- **Other / Local ソース (非 iCloud)**: 従来どおり**履歴の削除のみ** (ファイル本体は触らない)。これは MVP で実装済み (recent リストのスワイプ削除 = `removeRecentFile`)。
- **UI (確定)**: 最近開いたファイルリストの**スワイプアクション**で出し分ける。iCloud コピー行は「名前を変更」+「削除」、非 iCloud 行は従来どおり「削除」(履歴のみ)。リネームは `Alert.prompt` で新名を入力 (拡張子 `.md` は自動補完)、削除は確認ダイアログ必須。
- リネームは iCloud Drive › Modrift 内でファイル本体を `rename` し、履歴エントリの uri/name を追従更新 (`renameRecentFile`)。bookmark は失効するが、iCloud コピーは uri 直接で再オープンできるため破棄してよい。
- iCloud 削除の File Provider 上の反映 (他デバイスからも消えるか) は実機検証で確認する。

> 背景: 補完関係 (Files App がファイル管理、Modrift は表示・編集) は維持しつつ、Modrift がコピーを量産する FR-03 の副作用 (コピーが溜まる・名前が機械的) だけをアプリ内で解消する折衷。一般のファイル操作までは広げない。

### FR-23: 新規 Md ファイルの作成 [v2]

Modrift 内から新規の `.md` ファイルを作成し、そのまま編集を開始できるようにする。Modrift の「軽編集」を「その場で書き始める」まで自然に広げる機能。

**作成先 — フォルダピッカー (FR-18) に依存 (重要)**:

新規作成は「どこに作るか」が核心で、File Provider の書き込み制約 (FR-03 / 10.1) がそのまま効く。

- **フォルダピッカー (FR-18, v2) で選んだ Vault フォルダ内に作成**する。これによりユーザーの Vault に溶け込んだ新規ノートを作れる (iCloud Drive › Modrift に隔離されない)。
- 作成できるのは、フォルダピッカーで取得した security scope 内で書き込みが成立する場所。Google Drive 等で他アプリの書き込みがクラウドへ反映されない制約 (10.1) が新規作成にも当てはまるかは v2 着手時に実機検証する。
- フォルダアクセスが無い段階 (MVP / v1.1) では新規作成は提供しない。FR-18 を前提とするため v2 に配置する。

**UI / 挙動 (概略)**:

- ファイル名を入力して作成 (拡張子 `.md` は自動補完)。
- 同名ファイルがある場合の扱い (`-1`, `-2` で重複回避 or 上書き確認) は着手時に決定。
- 作成後は preview ではなく**編集モード**で開く (中身が空なのですぐ書ける)。
- テンプレート挿入・フロントマター自動生成・`.md` 以外の形式作成は対象外 (スコープを絞る)。

詳細仕様 (作成先の選択方法、Google Drive 等での挙動、命名規則) は v2 着手時に別途 ADR で確定する。

### FR-24: Vault ブラウザ [v2]

[FR-18](#fr-18-フォルダピッカー対応-ローカル画像表示-v2) で取得したフォルダアクセスの上に、Modrift 独自の「フォルダ閲覧 UI」を載せ、毎回システムの Document Picker を経由せずに Vault 内を辿ってファイルを開けるようにする。Document Picker の Recents タブがアプリ履歴と紛らわしい問題を、**日常導線から Picker を外す**ことで解消する。

**位置づけ — フォルダ参照を主役化、個別オープンは併存**:

- [「Vault 扱いの進化」(1章)](#1-概要) の v2 段階。フォルダ／Vault 単位の参照が主たる導線になる。
- ただし**個別ファイルを開く経路 ([FR-01](#fr-01-ファイルを開く-mvp) の経路A / 経路B) は最終形でも残す**。Vault に属さない単発の `.md` (メール添付・AirDrop・Files の1ファイル) を開く価値は別にあり、「2つの起動経路」はコア設計のまま。
- → 最終像は「**フォルダ参照が主・個別オープンが従**」の併存。

**「Vault」= フォルダ。Obsidian 非依存**:

- ここでの Vault は Obsidian 用語だが、実体は「`.md` が入ったフォルダ」。Obsidian ユーザーでなくても、クラウド上に整理用フォルダを持つ人は同じ体験になる。
- フォルダで整理していない／単発で1つ開くだけの人は、個別オープン (FR-01) で従来どおり対応。

**ホーム画面 — 履歴を主、Vault を併設 (案A 採用)**:

- 起動直後は**履歴 ([FR-06](#fr-06-最近開いたファイルリスト-mvp)) を表示**する。「軽快に開いてサッと続きを使う」コンセプトに最も合うため。Vault 未指定でも成立する (履歴は全ストレージ・単発で動く)。
- 検討した代替案 (案B: Vault をホームにする Obsidian 風) は不採用 — Obsidian Mobile に寄りすぎ、差別化軸の「軽さ」が薄れるため。

| ユーザーの状態 | ホーム表示 |
|---|---|
| Vault 未指定 | 履歴 + 「ファイルを開く」(現状と同じ) |
| Vault 指定済み | 履歴 (主) + 「My Vault」エントリ (従) |

**Document Picker との関係 — 3つの別アクション**:

| アクション | Document Picker | 頻度 |
|---|---|---|
| ① Vault を指定 (フォルダ許可) | 出る (システムのフォルダピッカー) | 初回1回・たまに変更 |
| ② Vault 内をブラウズ | 出ない (Modrift 自前 UI) | 毎日 |
| ③ Vault 外の単発ファイルを開く | 出る (Document Picker) | 随時・任意 |

- Vault 指定済みユーザーの日常 (②) では Document Picker が出ないため、Recents タブの混同は起きない。
- **Document Picker をアプリから完全に消すことは不可** (iOS サンドボックス)。① の初回フォルダ許可は必ずシステムピッカーを通る。タブ非表示の API も存在しない ([10.4](#104-iosapp-store関連) 参照)。

**初回セットアップのフレーミング (UX)**:

- 「初回だけ Picker・以降は出ない」差は、初回を**「ファイルを開く」ではなく「Vault を設定する」**というセットアップ文脈で見せれば混乱しない (Obsidian Mobile・写真アプリ・Dropbox 連携と同じ王道パターン)。
- Vault 不要な人向けに「あとで設定／単発で開くだけ」の逃げ道を用意。

**フォルダの変更導線 (必須)**:

- ① ホームの Vault 名 (例: `My Vault ▾`) タップ →「別のフォルダに変更／Vault を解除」
- ② 設定画面の「Vault フォルダ」→「変更する」
- 変更時はフォルダピッカーを再表示し、新しい security-scoped bookmark に差し替えるだけ。旧 Vault 配下の履歴エントリは各自の bookmark で開けるため壊れない ([FR-06](#fr-06-最近開いたファイルリスト-mvp) / [FR-11](#fr-11-再オープン対応-security-scoped-bookmark-mvp) の自己回復)。

**編集の制約は従来どおり ([FR-03](#fr-03-md編集-mvp))**:

- 参照 (ブラウズ) は全プロバイダで可能。**編集の保存は置き場所依存**: iCloud Drive / Dropbox は in-place 同期、Google Drive 等は iCloud コピー経由。編集まで快適にしたいなら Vault は iCloud Drive 推奨。

**実装の見通し (難易度: 中)**:

- フォルダの security-scoped bookmark: 既存の `modules/file-bookmark` (FR-11) をフォルダ対応に拡張。
- フォルダ内の列挙: security scope 内で `FileManager.contentsOfDirectory` を呼ぶネイティブモジュールの追加が必要 (expo-file-system だけでは security-scoped フォルダの列挙が難しい)。
- iCloud 未ダウンロードファイルの表示・ダウンロード制御を考慮。
- 初回のアクセス許可をシステムピッカー以外で置き換えることはできない (サンドボックス)。

詳細仕様 (ブラウズ UI、複数 Vault 対応の要否、並び替え・ソート) は v2 着手時に別途 ADR で確定する。

### FR-25: 見出しスタイルのユーザー選択 (テンプレート方式) [v2]

v1.1 で実装する固定の見出しカラーリング ([5.2](#52-v11-phase-2)) の上に、ユーザーがアプリ内設定で見出しの配色を選べる層を載せる。

**方式 — プリセット・テンプレート (確定)**:

- 「ネイビー」「モノクロ」「カラフル」等の curated なテンプレートから1つ選ぶ方式を採用。
- 各テンプレートは theme の見出しトークン (`heading1`〜`heading4`) の組を差し替えるだけで実装できる (現行のカラーリングがトークン駆動のため素直)。
- **不採用**: 各見出しを任意 hex で自由指定するフルカラーピッカー。UI が重く、読めない配色を選べてしまう品質リスクがあるためスコープ外 (必要なら将来の上級オプションとして再検討)。

**依存 — 設定画面が前提**:

- 設定画面＋永続化 (AsyncStorage) を使う。これは v1.1 のフォントサイズ調整 ([FR-10](#fr-10-フォントサイズ調整-v11))・ダーク固定 ([FR-09](#fr-09-ダークライトモード-v11)) と同じ基盤。設定画面が整ってから載せる。

**範囲**:

- 当面は配色テンプレートの選択。見出しサイズの調整 (別途検討項目) も、必要ならテンプレートに含める形で拡張可能。

詳細 (テンプレートの数・内容、サイズを含めるか) は v2 着手時に確定する。

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
- AsyncStorage には機微情報を保存しない (ファイル名・Security-Scoped Bookmark の base64 文字列のみ。Bookmark データはファイル参照情報で機微情報ではない)

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

- Security-Scoped Bookmark (FR-11): URI と一緒に base64 化して AsyncStorage に保存。expo-secure-store は使わない (Bookmark データは機微情報ではないため)
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

- **Security-Scoped Bookmark の保存が必須 (FR-11)**:
  Document Pickerで開いたファイルURIは**セッションを跨ぐと無効化**される。「最近開いたファイル」の再オープンを実装するには、URIをそのまま保存しても次回起動時に開けない。iOSの `URL.bookmarkData()` 相当の処理が必要
  - `modules/file-bookmark/` で Expo Modules API の Swift ネイティブモジュールとして実装済み
  - Bookmark は base64 文字列で AsyncStorage に保存。ファイルを開くたびに再生成して stale 状態を自己回復
  - resolveBookmark 失敗時 (ファイル移動・削除等) はエントリを削除して再オープンエラーを表示

- **Google Drive公式アプリが未インストールだとピッカーにDriveが出ない**:
  オンボーディングで明示する必要あり

- **同期完了のコールバックがない**:
  `writeAsStringAsync` は「ローカルファイルへの書き込み完了」までしか保証しない。クラウドへのアップロード完了はFile Provider内部で進行し、Modriftからは観測できない。MVP は状態 UI を出さないサイレント保存方針なので、この差を表示で誤魔化す必要はない (Apple Notes 流)

- **Google Drive は他アプリの編集をクラウドへ上げない (実機確認 2026-05-29)**:
  Google Drive の iOS File Provider は、外部アプリ (Modrift 含む) の in-place 編集をクラウドへアップロードしない (ローカル / Files アプリには反映されるが Google Drive web には反映されない)。iCloud Drive / Dropbox では同期される。Modrift の書き込みは `NSFileCoordinator` で協調済みで、原因は Google Drive 側。**対応方針 (FR-03)**: Google Drive 等は閲覧は直接行い、編集は iCloud Drive 内 `Modrift/` へコピーを作成して行う。in-place 編集は iCloud / アプリローカルのみ。Google Drive への直接書き戻し (Drive API 連携) は採用しない方針。Dropbox 等が in-place で同期可能かは未検証

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

- **番号付きリストの連番挙動 (既知の制約)**:
  番号付きリストの途中に見出しや段落が挟まると、Obsidian は連番を継続して描画するが、`react-native-enriched-markdown` (CommonMark 標準) はそこでリストが区切れて 1 から振り直す。標準仕様通りの挙動なので MVP では許容。v1.1 以降で必要ならプリプロセスでの対応を検討。

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

- **Document Picker のタブ (Recents / Shared / Browse) は非表示にできない**:
  `UIDocumentPickerViewController` のタブはシステム UI で、アプリから隠す/「Browse 固定」にする公開 API はない。初期表示フォルダの指定 (`directoryURL`) のみ可能だが expo-document-picker は未公開。このため Picker の Recents とアプリ履歴の混同は Picker 側では解消できず、FR-24 (Vault ブラウザ) で日常導線から Picker を外して解消する方針

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
- [ ] 編集内容がクラウド側にも反映される (iCloud Drive / Dropbox 等。**Google Drive は他アプリ編集を同期しないため対象外**)
- [ ] 最近開いたファイルがリストに表示される
- [ ] UI が日本語・英語で切り替わる (デバイス言語に追従)

### 品質面

- [ ] 日本語IMEで長文編集しても文字化けや変換崩れがない (実機検証済み)
- [ ] アプリ起動 → ファイル選択 → プレビュー表示が3秒以内
- [ ] アプリをバックグラウンド遷移しても編集内容が消えない (強制保存される)
- [ ] オフライン時に編集してオンライン復帰するとクラウド (iCloud Drive / Dropbox 等) に反映される
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
- ネットワーク監視UI・競合警告UI・Undo/Redo

### Phase 3: 公開準備 (1-2週)

- App Store 審査対応
- スクリーンショット・申請文の整備
- 初期フィードバックの反映

**Phase 1〜3 合計目安**: TestFlight 内部配布まで 1.5-2ヶ月、App Store 公開まで約3ヶ月

### Phase 4: v2 (Md機能の充実) (公開後、ユーザーフィードバック次第)

- 検索、iPad 左右分割プレビュー
- フォルダピッカー対応 (ローカル画像表示、Obsidian風リンク、新規ファイル作成、Vault ブラウザ)
- 見出しスタイルのユーザー選択 (テンプレート方式)
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

- **R-01: Security-Scoped Bookmark の Swift ネイティブモジュール実装** (FR-11、実装済み)
- **R-02: 日本語IMEと自動保存の組み合わせでの挙動崩れ** (実機検証必須)
- **R-03: react-native-enriched-markdown の Obsidian Vault 互換性** (大規模Vaultで未検証)
- **R-04: 競合発生時のユーザー体験** (last-write-winsの許容範囲は要検証)

### 戦略リスク

- **R-05: iOS Files App との差別化が薄いと感じられる懸念** (Md整形・xlsx対応で差別化、Whyセクションで明示)
- **R-06: Obsidian Mobile が軽量化された場合の競合激化** (公式の更新動向をウォッチ)
- **R-07: App Store審査で「機能不足」リジェクト** (スクリーンショット + ユースケース明示で対応)

## 14. 用語定義

- **Vault**: Obsidian の用語で、Mdファイル群を格納するフォルダ。Modrift では「`.md` が入ったフォルダ」一般を指し、Obsidian の利用は必須ではない
- **Vault ブラウザ**: FR-18 で許可した Vault フォルダを、Document Picker を経由せず Modrift 独自 UI で階層参照・オープンする機能 (FR-24, v2)
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
- **2026-06-20 (改訂4)**: 新規ファイル作成を計画に追加:
  - FR-23 (新規 Md ファイルの作成) を新設。フォルダピッカー (FR-18) 依存のため v2 に配置
  - スコープ 5.3 (v2) とロードマップ Phase 4 (v2) に新規作成を追記
- **2026-06-20 (改訂5)**: Vault ブラウザ構想を統合:
  - FR-24 (Vault ブラウザ) を新設。FR-18 のフォルダアクセスを土台に、Document Picker を経由しない独自参照 UI を v2 で提供
  - 決定事項を明文化: フォルダ参照を主役化しつつ個別オープン (FR-01) は併存 / 「Vault」はフォルダ一般で Obsidian 非依存 / ホームは履歴主軸 (案A) / 初回は「Vault を設定」とフレーミング / フォルダ変更導線 (ホーム + 設定) / 編集制約は FR-03 のまま
  - 制約 10.4 に「Document Picker のタブは非表示にできない」を追記。スコープ 5.3・ロードマップ Phase 4・用語定義 (Vault 再定義 / Vault ブラウザ) を更新
  - FR-18 を Vault ブラウザ・新規作成の土台として相互参照
- **2026-06-20 (改訂6)**: 見出しスタイルのユーザー選択を計画に追加:
  - FR-25 (見出しスタイルのユーザー選択) を新設。プリセット・テンプレート方式を採用 (フルカラーピッカーは不採用)
  - v1.1 の固定カラーリングの上に乗せる拡張。設定画面 (FR-09/FR-10) 依存のため v2 に配置
  - スコープ 5.3 (v2) とロードマップ Phase 4 に追記
