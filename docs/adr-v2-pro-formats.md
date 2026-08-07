# ADR: v2 有償 Pro 他形式閲覧 (PDF / Word / xlsx) の技術選定

- **ステータス**: **実装フェーズ (2026-08-07)** — 表示系3形式は `v2` ブランチで製品コード化済み、実データ検証まで完了。残作業は下記「残作業」節。以下は選定時の記録: **PDF・読み込み基盤 (実機検証済み) と docx (シミュレータ確認済み) は採用確定 (Accepted, 2026-08-06)**。**xlsx も実データ検証を経て採用 (2026-08-07)**。課金は提案 (Proposed) のままだが、**SDK のビルドと New Arch 実行時疎通は確認済み (2026-08-07)**
- **経緯**: 当初 `v2-spike` ブランチ (v1.3 時点) にのみ存在。2026-07-30 に v1.5 リリース後の `main` へ移設し、統合ポイントを現行コードに突き合わせて更新した (下記「前提の更新」)。技術選定そのものは 2026-07-17 の調査結果のまま
- **対象**: [Requirements.md](Requirements.md) FR-21〜 (v2 / Pro)。「具体ライブラリは v2 着手時に ADR で確定」(改訂12) を受けた文書
- **前提環境**: Expo SDK 56 / React Native 0.85.3 / New Architecture (Fabric) / Expo Dev Client / react-native-webview 13.16.1 / iOS 16+
- **要件の芯**: 単一ファイルの**閲覧のみ**(編集・注釈なし)。完全再現より「モバイルで読みやすい整形表示」。個人開発として保守できる薄さを最優先

## 決定 (提案)

| 領域 | 採用案 | コスト | 却下した主な代替 |
|---|---|---|---|
| PDF | **react-native-pdf-renderer** (ネイティブ PDFKit、依存ゼロ) | S | react-native-pdf (依存重・issue 393件) / WKWebView 直 (大容量でクラッシュ) |
| Word (.docx) | **mammoth.js** → HTML を既存 WebView 基盤で表示 | S | docx-preview (A4 再現がモバイルと相性悪) / QuickLook (Files と同一表示で課金根拠なし) |
| xlsx | **SheetJS CE 0.20.3** (`sheet_to_html`) + 自前 CSS + 行ページング | S〜M | exceljs (本家停止・書式レンダラ自作) / Univer (import が Pro サーバー前提) |
| 課金 | **RevenueCat** (react-native-purchases v10) + 非消耗型 1 SKU + Entitlement `pro` | S〜M | expo-iap 直 (OpenIAP 移行で体制流動的、サブス後付けが重い) |

共通ストーリー: **docx / xlsx は「HTML に変換して既存の esbuild → WebView 注入基盤で表示」**。CJK/Latin タイポグラフィの知見・スタイルプリセット (FR-25) の CSS 資産を再利用し、「Files の QuickLook より読みやすい」を差別化に据える。PDF だけはページレンダリングが必要なのでネイティブ (PDFKit) を薄く借りる。

## 各論

### PDF: react-native-pdf-renderer

- iOS 実装は Apple PDFKit。ページ送り・ピンチズーム・タイルレンダリング (数十MB 対応) は OS 品質
- 依存ゼロ・config plugin 不要 (autolinking のみ、prebuild でそのまま通る)。Fabric codegen 同梱で New Arch ネイティブ対応。MIT。2026-07 時点でメンテ活発 (open issue 5件)
- API は `<PdfRendererView source="file://..." maxZoom onPageChange />` とミニマルで、ローカルファイル閲覧という用途に過不足なし
- **リスク**: ★295 と小規模コミュニティ。ただしラッパーが薄いので、万一止まったら自作 Expo Module + PDFKit (Swift 100〜200行、`kishannareshpal/expo-pdf` が写経元) へ移行可能。この撤退経路があるため許容
- 安全牌は react-native-pdf 7.0.4 + @config-plugins 14 (Expo 56 対応が公式互換表に明記) だが、react-native-blob-util 含む依存4つと追従の遅さ (New Arch 対応に約5ヶ月) が「シンプル優先」に反するため次点

### Word: mammoth.js

- docx のスタイルを意味ベースの単純な HTML (Heading 1 → `<h1>`) に変換する設計思想が、FR-21 の「本文・見出し・表が読みやすければよい / 完全再現不要」とそのまま一致
- `convertToHtml({arrayBuffer})` が browser 公式 API。JSZip は依存に内包され esbuild が丸ごとバンドルする。min 489KB / gzip 121KB。BSD-2-Clause。v1.12.0 (2026-03) までメンテ活発
- 画像はデフォルトで base64 data URI インライン → 外部リクエスト不要で WKWebView と好相性
- フォント指定を出力しない = アプリ側 CSS で完全制御でき、**inline font-size span による CJK/Latin サイズ調和の既存ノウハウを適用可能**
- 表は `<table>` になるが罫線等の書式は落ちる → 自前 CSS で読みやすく整形 (方針どおり)
- ~~段組・テキストボックス・図形は落ちる~~ → **3点とも誤り (2026-08-07 に検体で実測)**。**テキストボックスは中身のテキストが残り**、**段組は本文が残って1段に流れ** (順序も保たれる)、落ちるのは**文字なしの図形**と**レビューコメント**だった。**しかも `result.messages` は0件** — 警告の有無で欠落は判定できない。実質的な損失はコメントのみ。必要になったら「オリジナルレイアウトで表示」ボタンとして QuickLook (QLPreviewController の自作 Expo Module ラップ、S コスト) をフォールバック併載する拡張余地を残す。詳細は [FR-42](Requirements.md#fr-42-word-docx-閲覧-v2--pro)
- docx→Markdown 変換して CodeMirror で表示する案は不採用: 二重変換の劣化、base64 画像が既存ビューアで表示不能、turndown のメンテ停止、「編集できそうに見えて書き戻せない」UX 混乱

### xlsx: SheetJS CE 0.20.3

- `XLSX.read` → `sheet_to_html` で HTML テーブル生成 → 既存 WebView 基盤に注入。min 412KB / gzip 140KB。Apache-2.0
- 閲覧ビューアに必要な2機能を標準で持つ唯一の JS パーサ:
  - 結合セル (`!merges`) の colspan/rowspan 自動変換
  - 内蔵 SSF による**書式コードどおりの表示文字列 `w`** (「Excel で見えていた通りの値」)。和暦等ロケール依存書式は実データで要確認
- **導入経路に注意 (重要)**: npm の `xlsx` は 0.18.5 (2022) で凍結され、**CVE-2023-30533 (Prototype Pollution) / CVE-2024-22363 (ReDoS) が未修正のまま残る**。細工ファイルを開くビューアなので実害リスクあり。導入は公式 CDN tarball (`npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) か非公式ミラー `@e965/xlsx` (0.20.3、Apache-2.0 なので再配布合法) の二択。**npm の `xlsx@0.18.5` は使用禁止**
- 大きいシート対策: DOM は数万行で破綻する。`content-visibility: auto` は iOS 18 (Safari 18) 以降で iOS 16 ターゲットでは使えないため、「先頭 1000 行 + 追加読み込み」のページングで開始し、需要が出てから仮想化を検討
- ~~パースは WebView 内でなく RN 側 JS で行う~~ → **実装では WebView 内に置いた (2026-08-07)**。RN 側でパースすると SheetJS が RN のバンドルに載ってしまい、「Md しか使わない利用者に負担させない」という前提と衝突するため。シート切替タブもページ内 (docx と同じ構成)
- リリースが 0.20.3 (2024-07) で約2年止まっている点は「閲覧用パーサとして枯れている」と割り切る

### 課金: RevenueCat + 非消耗型 + Entitlement

> **⚠️ 保留に差し戻し (2026-08-07)**: 本節は **iOS 単独を前提**に書かれている。その後 **Android 版を出す意思**が示され、判断の分かれ目が「RevenueCat か StoreKit 直か」ではなく「**購入をプラットフォーム間で引き継ぐか**」に移った。引き継がないなら StoreKit 直 + Play Billing 直で足りる (課金コードは2系統)、引き継ぐならアカウント無しで束ねられる RevenueCat が現実的な唯一手。**StoreKit 2 単体でもサブスクは扱える** (`Transaction.currentEntitlements` が期限切れを除外) ので「サブスク後付け＝RevenueCat 必須」という本節の前提も、iOS 単独なら成り立たない。**どちらを選んでも既存購入者は失われない** — 購入記録を持つのは Apple / Google であり、後から RevenueCat を入れても遡って `pro` を付与できるため、この保留は袋小路ではない。詳細は [Requirements 5.9](Requirements.md#59-収益化--価格モデル) / [FR-44](Requirements.md#fr-44-pro-課金とエンタイトルメント-v2--pro)。以下は **RevenueCat に倒れた場合の構成**として読むこと。

- `react-native-purchases` v10 (2026-07 時点 v10.4.3): RN 0.73+ / New Arch 対応済み。**config plugin 不要**、`npx expo install` + prebuild の autolinking で完結。実購入テストは Dev Client 必須 (現行運用どおり)
- 構成: 非消耗型 1 SKU `com.modrift.app.pro_lifetime` → RevenueCat Entitlement **`pro`** に紐付け → コードは `customerInfo.entitlements.active['pro']` の有無だけ見る。**将来サブスクを足しても解錠ロジック不変** ([5.9](Requirements.md#59-収益化--価格モデル) のエンタイトルメント方式そのもの)
- 費用: 月間トラッキング収益 $2,500 まで完全無料 → 当面ゼロ
- Paywall は `react-native-purchases-ui` の既製でなく自作のシンプル画面 (価格 + 解錠内容 + 購入 + 復元)
- **審査要点**:
  - 「購入を復元」ボタン必須 (Guideline 3.1.1 の定番リジェクト理由)。Paywall と設定画面の両方に配置。`restorePurchases()` はユーザー操作からのみ呼ぶ (Apple ID プロンプトが出るため)。結果は「復元しました / 対象なし」を明示
  - **初回 IAP はアプリの新バージョンに添付して同時審査に出す** (添付忘れは定番の落とし穴)
  - 事前に有料 App 契約 (Paid Apps Agreement) の署名、In-App Purchase Key の RevenueCat 登録が必要
  - アカウント作成を購入条件にしない (匿名 App User ID + Apple ID 復元で完結)

## アプリへの統合ポイント

- 拡張子ゲート → **実装済み**。[file-types.ts](../src/lib/file-types.ts) の単一定義 (`SUPPORTED_EXTENSIONS` / `isSupportedFile()` / `routeForFile()`) に集約した。**当初「2箇所」と書いたが実際は4箇所**あり — ピッカー判定・ホーム一覧に加えて **Open In ([+native-intent.tsx](../src/app/+native-intent.tsx)) と共有シート**が独自にルートを決めていた。とくに Open In は拡張子ゲートを通らず `file://` を無条件に Md ビューアへ送っていたので、UTI 宣言と同時に直す必要があった
- Document Picker (経路A): **`type` 指定は現在無い** ([index.tsx:328](../src/app/index.tsx#L328) は `copyToCacheDirectory: false` と `multiple: false` のみ)。ピッカーは全形式を出し、**選択後に拡張子で弾く**設計 ([index.tsx:347](../src/app/index.tsx#L347))。したがって経路A は上の拡張子ゲートを広げるだけで通り、**UTI の追加作業は不要** (調査時点の「`type` に UTI を追加」は当時のコード前提で、現行には該当しない)
- Open In (経路B): `app.json` の `CFBundleDocumentTypes` に PDF (`com.adobe.pdf`)、docx (`org.openxmlformats.wordprocessingml.document`)、xlsx (`org.openxmlformats.spreadsheetml.sheet`) を追加 → **prebuild --clean 必須** (ネイティブ設定変更のため)
- ビューア: [viewer.tsx](../src/app/viewer.tsx) は Markdown 専用のまま触らず、`pdf-viewer` / `office-viewer` 等の別ルートを新設して拡張子で振り分け (どちらの起動経路からも到達できること — 2経路はコア設計)。ヘッダーは v1.5 で自前化された ([viewer-header.tsx](../src/components/viewer-header.tsx)・FR-38) ので新ルートでも流用できる。ただし hide-on-scroll のスクロール量は CM の注入 JS から取っており、PDF (ネイティブ) では別途繋ぐ必要がある — **PDF は素の固定ヘッダーで始めるのが安全**
- 編集まわり: 他形式は**常に閲覧のみ**。in-place 編集・iCloud コピーのフローは発動させない。サードパーティクラウド由来のファイルはキャッシュへ実体化して表示 (閲覧専用なので原本書き戻し問題なし — 既存の「ホーム外は閲覧のみ」= Policy A と整合)
- **読み込み (v1.5 の FR-40 が効く範囲に注意・重要)**: 未ダウンロードの File Provider プレースホルダを**実体化してから読む**必要は他形式でも同じ。ところが既存の `FileBookmarkModule.readFileCoordinated` は **UTF-8 テキスト専用** ([index.ts:28](../modules/file-bookmark/index.ts#L28) / Swift 側は `String(contentsOf:encoding:.utf8)`) で、PDF/docx/xlsx には**使えない**。また `copyToCacheDirectory: true` 相当の素のコピーは、FR-40 の調査でプレースホルダに対し「no such file」で失敗すると判明済み。→ **バイナリ用の協調読み込みをネイティブに追加するのが前提作業** (base64 で返す / `NSFileCoordinator` 協調下でキャッシュへコピーする、のいずれか)。これは PoC 1 (PDF) の着手前に必要
- Pro ゲート: 非 Pro 状態で他形式を開いたら Paywall へ誘導。無料機能 (Md/txt) は一切ゲートしない ([5.8](Requirements.md#58-意図的に実装しないもの)「既存の無料機能の有償化はしない」)
- 履歴 (recent-files): 他形式ファイルも履歴に記録。種別アイコン等は実装時に検討

## PoC の順序 (2026-08-06 確定)

**PDF を先、バイナリ協調読み込みを後**とする。調査時点では協調読み込みを前提作業 (PoC 0) に置いていたが、順序を入れ替えた。

理由: **協調読み込みの価値は v2 が成立することに依存する**。Md はテキストなので、他形式を扱わないならあの関数は使われない。一方 `react-native-pdf-renderer` は ★295 の小規模ラッパーで、Expo 56 / New Architecture でビルドが通るかどうか自体が未知数であり、倒れれば v2 の形 (自作 PDFKit モジュール) が変わる。**Swift を書く前に、最も早く倒れうるものを倒す。**

ローカル (ホーム / 端末内) のファイルだけを扱えばプロバイダの都合が絡まないので、協調読み込みが無くても PDF の品質判断はできる。シミュレータで完結する。

1. ~~**PDF・ローカルのみ** (`v2-spike`)~~ → **完了・合格 (2026-08-06)**。下記「検証結果」参照
2. ~~**バイナリ協調読み込み** (**`v2`**)~~ → **完了・合格 (2026-08-06、実機検証済み)**。下記「検証結果」参照
3. ~~**docx** (`v2-spike`)~~ → **完了・合格 (2026-08-06)**。第二の WebView バンドルとして追加 (同居案は不採用 — 別バンドルにすることが #5 の答えでもあった)。下記「検証結果」参照
4. ~~**xlsx** (`v2-spike`)~~ → **条件付き合格 (2026-08-07)。実データ未検証**。下記「検証結果」参照
5. **課金** (**`v2`**): 表示系3つの目処が立ってから。App Store Connect の IAP 登録 → RevenueCat 設定 → Sandbox で購入→アンインストール→復元まで通す。アカウント側の設定が伴い捨てられないのでスパイクでやらない

## 検証計画

スパイクの成果物は**コードではなく判断**。各ステップは「合格ライン」と「不合格なら何に切り替えるか」を先に決めてから着手する。コードは抽象化・共通化・設定可能化をせず、日英/ダーク/iPad も後回しでよい — **作り込むと撤退が心理的に高くつく**ため。

| # | 問い | 合格ライン | 不合格なら |
|---|---|---|---|
| 1 | react-native-pdf-renderer が Expo 56 / New Arch で動くか。**まずビルドが通ること自体が関門** | 数十MB の PDF がズーム・ページ送りで実用速度。日本語 PDF が化けない | 自作 Expo Module + PDFKit へ (`kishannareshpal/expo-pdf` が写経元)。**その薄さの確認まで含めて判断する** |
| 2 | バイナリ協調読み込みの返し方: base64 か、キャッシュへ協調コピーしてローカル URI か | 未ダウンロードの Drive 上の PDF が開く | — (案の選択であって撤退はない) |
| 3 | mammoth の**日本語 docx** 出力品質 | 見出し・箇条書き・表・画像が「読める」。段組/テキストボックスの欠落は許容 | QuickLook フォールバック併載を検討 |
| 4 | SheetJS SSF の**和暦・日付書式**の再現範囲 | 「Excel で見えていた通り」の文字列。結合セルが崩れない | 書式を諦め生値表示にするか、xlsx を v2 から落とす |
| 5 | **バンドル構成** (下記の数字を参照) | Md だけを開く利用者の負担が増えない | 形式別バンドルの遅延読み込みへ |
| 6 | `CFBundleDocumentTypes` 追加で共有シートの候補がどう変わるか (`prebuild --clean` 必須) | Md の Open In が退行しない | 宣言する UTI を絞る |

**#5 は着手前から数字が不利**: 現在の CodeMirror バンドルは minify 済み約500KB を [html.ts](../src/lib/cm/html.ts) が HTML 文字列へ丸ごとインライン注入している。ここに mammoth (min 489KB) と SheetJS (min 412KB) を素朴に足すと**約3倍**になり、Md を開くだけの利用者まで負担する。「軽量 Md ビューア」の看板に直接触るため、形式別バンドル前提で測る。

**失敗系も測る**: v1.5 で WebView のコンテンツプロセス終了を拾う `onError` を入れた ([markdown-web-view.tsx](../src/components/markdown-web-view.tsx))。大きな xlsx/docx はこれを踏む筋なので、「巨大ファイルを開いたら黒画面でなくエラーになる」ことまで確認する。

**スパイクのコードの扱い**: ブランチは消さない。捨てるのは足場 (ベタ書きの拡張子ゲート、Pro ゲートの抜け道、ハードコードしたパス) であって、中身 (ネイティブ関数、mammoth 出力の CSS、SheetJS のテーブル整形) は残す価値がある。通ったコードが既に薄ければ儀式的に書き直さず昇格させる。守るのは1つだけ — **着手のたびに `v2` から再ベースラインする** (`v2` 開始前は main から)。旧 `v2-spike` が v1.3 で古びて v1.4/v1.5 を巻き戻しかけた前例がある。

**ブランチの役割 (v1.4 / v1.5 の運用を踏襲)**: このリポジトリはリリース単位の長命ブランチに積んで main へ fast-forward する形で一貫しており (`feat/*` は一度も使っていない・main にマージコミットは無い)、v2 もそれに合わせる。

| ブランチ | 役割 |
|---|---|
| `main` | **出荷済みの状態**。ここを汚さないので、hotfix (v1.5.1 等) は main から切ればそのまま出荷状態から始められる |
| `v2` | v2 の製品コード (PoC 2 のネイティブ、実ビューア、Pro ゲート、ペイウォール)。リリース時に main へ ff |
| `v2-spike` | 捨てる探索 (PoC 3 docx / PoC 4 xlsx)。`v2` から切り直す |

> **⚠️ `v2` ⇄ `v2-spike` を行き来したらネイティブ再ビルドが必須** (2026-08-06 に踏んだ)。スパイクだけが `react-native-pdf-renderer` を持つため、`v2` でビルドするとその Pod が外れ、スパイクに戻ったとき `Unimplemented component: <RNPdfRendererView>` になる。**症状がネイティブ実装の不具合に見える**のが厄介なので注意。ネイティブ依存を持つスパイクを分けている限り、ブランチ分割の代償として残る。

## 検証結果

### #1 PDF (react-native-pdf-renderer 2.3.0) — **合格・採用確定 (2026-08-06)**

環境: シミュレータ iPhone 17 Pro / iOS 26.5、dev variant の Debug ビルド。テストファイルは自前生成 (40ページの日英混在・ヒラギノ埋め込み / 600ページ)。

- **ビルドが通る**。`npx expo run:ios` で `Build Succeeded`。**config plugin 不要**で autolinking のみ、`Podfile.lock` に `ReactNativePdfRenderer (2.3.0)`。`npm view` の `dependencies` は空 = 依存ゼロ。ADR の想定どおり
- **実装は PDFKit の `PDFView` の直サブクラス** (`@interface RNPDFView: PDFView` — [RNPDFView.h](../node_modules/react-native-pdf-renderer/ios/ReactNativePdfRendererLibrary/RNPDFView.h))。`autoScales = YES` / `displayMode = kPDFDisplaySinglePageContinuous`。独自のビットマップ描画ではないので、**タイルレンダリングも選択もリンクも OS 実装がそのまま効く**
- **ピンチズームで深く拡大しても文字が鮮明** (実測)。ADR が採用根拠にしていた「ページレンダリングだけネイティブに薄く借りる」が事実として裏付けられた
- **テキスト選択が既定で動く** — 長押しで Copy / Select All / Look Up。props に無いのはラッパーが公開していないだけで、`PDFView` の標準機能。これで **[Requirements 5.6](Requirements.md#56-v2-他形式の単一ファイル閲覧-phase-7) の PDF 3要件 (ページめくり・ピンチズーム・テキスト選択) が追加のネイティブ実装なしに満たせる**
- `onPageChange` は発火する (スパイク画面のページ番号表示で確認)

**撤退経路 (自作 Expo Module + PDFKit) は使わない。** ラッパーが `PDFView` そのものである以上、自作しても同じ実装に行き着くため。

**残っていた未確認 → 実機で解消 (2026-08-06)**:

- [x] **実機での性能**・**数十MBの画像主体 PDF**。実機 (iPhone / iOS 26.5.2) で **39MB・10ページの画像主体 PDF** (1ページごとに別の JPEG を埋め込んだ生成物) と **600ページ**の PDF を確認 — **どちらも落ちず、期待どおりの挙動**。ズーム・ページ送りとも実用範囲
- [ ] しおり (outline) の扱い。`PDFView` はサイドバー UI を持たない (`PDFDocument.outlineRoot` は取れる)。ただし **Requirements 5.6 はしおりを要件にしていない**ので、無くても要件は満たす → **v2 では対応しない**

> **スパイクの検証手順メモ**: シミュレータのピンチは **⌥ + ドラッグ** (⌥+Shift で中心移動)。トラックパッドのピンチは渡らない。なお `xcrun simctl openurl` による画面遷移は、Debug + Metro のビルドだと iOS の「Open in …?」確認ダイアログが出て自動化では抜けられない (タップ自動化ツールは本環境に無い)。埋め込みバンドルを持つビルドなら抜けられる — [screenshot-recipe.md](screenshot-recipe.md) 参照。

### #2 バイナリ協調読み込み — 実装済み・シミュレータ確認済み (2026-08-06)

`FileBookmarkModule.materializeFileCoordinated(uri) → ローカル file:// URI` を追加 (commit b10e0a9)。**返し方は案B (協調下でキャッシュへコピーし、パスを返す) を採用**。base64 案は、30MB の PDF が ~40MB の文字列としてブリッジを渡り、PDFKit がそれをディスクに書き戻すだけなので不採用。パスなら PDFKit は直接読め、docx/xlsx は `new File(cacheUri).arrayBuffer()` が使える = **1本で3形式を賄える**。

**コピーは協調ブロックの内側**で行う。外でコピーするとプレースホルダに対し「no such file」で失敗する — FR-40 でピッカーの `copyToCacheDirectory: true` を不採用にしたのと同じ失敗。

シミュレータ (iPhone 17 Pro / iOS 26.5) で確認できたこと:

| 経路 | 対象 | 結果 |
|---|---|---|
| コピー | `Documents` / `Caches` の外のファイル | `Caches/MaterializedFiles/` に **SHA-256 一致**のコピーが1件でき、そこから PDFKit が描画 (日本語も正常) |
| 素通し | `Documents` 配下 (端末内ホーム) | コピーせず元 URI を返し、**キャッシュが増えない** |

素通しの対象を「サンドボックス内」に限り **iCloud ホームを含めない**のは意図的。ubiquity コンテナは Mobile Documents 配下でサンドボックス外にあり、かつ退避され得るため協調が要る。パス比較は `resolvingSymlinksInPath()` 経由 (iOS が同じファイルを `/var/...` とも `/private/var/...` とも報告するため)。

#### 実機検証 — **合格 (2026-08-06、iPhone / iOS 26.5.2、dev variant の Debug + Metro)**

| # | 条件 | 結果 |
|---|---|---|
| ① | **Google Drive の未ダウンロード PDF** (本 PoC の本題) | **合格** — `materialized to cache` で描画 |
| ② | **iCloud ホームの退避ファイル** (Files で「ダウンロードを削除」済み) | **合格** — 素通しされず協調経路を通り描画 |
| ③ | ①をオフライン (機内モード) で再実行 | **`Could not materialize the file.` で失敗** |

**③が①の証明になっている点が重要**。「Drive アプリで開いていない = 未ダウンロード」は手順による担保にすぎず、表示だけでは「元々ローカルにあったものを読んだ」可能性を排除できない。オフラインで**必ず失敗する**ことを確かめたことで、①の成功が**実際にネットワーク越しの実体化を伴っていた**と対照実験で示せた。

**副次的な収穫 — 失敗経路が graceful**。③はハングも黒画面もせずエラー表示で返った。**FR-40 が Md で達成したこと (無限 Loading と黒画面の排除) が、バイナリ形式でも成立している**。狙って設計した挙動ではないので、記録に値する。

**製品化時の要件 (スパイクには意図的に入れていない)**:

- **読み込み失敗時の再試行ボタン**。Md 側は [FR-40](Requirements.md#fr-40-file-provider-ファイルの協調読み込みと読み込み失敗のハンドリング-v15) で `reloadNonce` による再試行を持つ ([viewer.tsx](../src/app/viewer.tsx))。他形式ビューアにも同じものが要る — オフラインや一時的な provider 不調は時間で回復するため
- 39MB のコピーには相応の時間がかかる。実機では待てる範囲だったが、**進捗表示の要否は実装時に判断**する

> **実機検証の罠 (2026-08-06 に踏んだ)**: 以前の Modrift Dev の設定が端末に残っており、**ホームの保存先が `Local` のまま**だったため iCloud に置いたテストファイルが一覧に出なかった。アプリを入れ直しても設定は保持される。実機検証を始める前に**設定 → ホームの保存先**を確認すること。加えてホーム一覧は `useFocusEffect` で読み込むので、**画面を開いたまま同期が届いても反映されない** (一度離れて戻る必要がある)。

### #3 docx (mammoth 1.12.0) — **合格 (2026-08-06、シミュレータ)**

CodeMirror と同一の方式: mammoth は **devDependency** (RN が import するのではなく esbuild が `src/lib/docx/bundle.ts` に固める)、`platform: "browser"` 必須 (mammoth は unzip とファイル読みをブラウザ実装にマップしており、node 版は `fs` を引き込む)。

テスト文書は自前生成の .docx (見出し・太字/斜体・箇条書き・番号付き・3列の表・画像・日本語)。

| 観点 | 結果 |
|---|---|
| 変換速度 | **57〜96ms**、**警告 0件** |
| 見出し / 強調 | `h1` `h2` / `strong` `em` に正しく変換 |
| リスト | bullet → `ul`、decimal → `ol` に正しく分岐 |
| 表 | 構造は正しい。**罫線・背景は自前 CSS で付与** |
| 画像 | **base64 data URI でインライン** — ネットワーク不要なので WebView の CSP と好相性 |
| 日本語 | 化けなし、組版も自然 |

**実装上の発見 (実機に載せる前に node で変換して判明)**:

- **`<th>` が一切出ない**。Word は `tblHeader` を明示しない限り意味的なヘッダー行を持たず、1行目も `<td><p><strong>` で来る。`th` 指定は当たらないので `tr:first-child > td` で当てる
- **セルの中身が `<p>` で包まれる**。段落の下マージンが行間に効いて表が間延びするので `td > p { margin: 0 }` が要る

どちらも「mammoth は意味だけ渡し、体裁は渡さない」という設計の帰結。**裏を返せば体裁は全部こちらで作れる = QuickLook より読みやすくできる余地がここにある**ということでもあり、差別化の置き場所と一致する。

> 検証手順のメモ: **アプリに載せる前に node で `mammoth.convertToHtml` を直接叩く**のが効率的だった。docx の妥当性と変換結果を同時に確認でき、上記2件の CSS 修正はこの段階で気づけた。

### #5 バンドル構成 — **形式別バンドルで解決 (2026-08-06、実測)**

**懸念は的中しなかった。** 「素朴に足すと約3倍」は *1つの WebView バンドルに同居させた場合* の話で、**別バンドルにすれば Markdown 側のページは従来どおり (約500KB) のまま**、mammoth を読み込まない。

残るコストは**アプリのサイズのみ**。`expo export:embed` で実測:

| | JS バンドル |
|---|---|
| mammoth なし | 3,359,442 bytes (3.20 MB) |
| mammoth あり | 3,907,946 bytes (3.73 MB) |
| **増分** | **548,504 bytes (536 KB, +16.3%)** |

増分は `bundle.ts` のファイルサイズ (548,623 bytes) とほぼ一致 = **エスケープされた文字列がそのまま載っている**。SheetJS も同程度と見込まれ、**3形式で +1MB 前後**。ベースライン 3.2MB に対して +31% だが、**Md しか使わない利用者の実行時負担はゼロ**なので、有償 Pro の対価として妥当と判断する。

**未計測**: 起動時間とメモリへの影響。巨大な文字列定数が Hermes のバイトコードにどう載るかは実測しないと分からないため断定しない。判断を覆すほどの差が出るとは考えにくく、優先度は低い。

### #4 xlsx (SheetJS CE 0.20.3 / `@e965/xlsx`) — **条件付き合格 (2026-08-07、シミュレータ)**

**SheetJS CE は和暦 (Japanese era) を実装していない。** これが本 PoC 最大の発見で、xlsx を v2 から落としかねない欠陥だった。

| 書式コード | SheetJS の出力 |
|---|---|
| `[$-411]ggge"年"m"月"d"日"` | **`ggg2026年4月1日`** — 元号記号がリテラルとして出力され、年は西暦 |
| `[$-411]ge.m.d` | **SSF が例外を投げ**、`sheet_to_html` は生のシリアル値 **`46113`** を出す (落ちはしない) |

日本語の業務文書で和暦は日常的であり、そこが xlsx 対応の価値の中心なので、放置はできない。

**解決策: 元号データは JS エンジン側にある。** `Intl.DateTimeFormat("ja-JP-u-ca-japanese")` が元号を持つので、**パース後に元号書式セルの表示文字列 (`w`) だけを差し替える**シム (`applyJapaneseEra`、約20行) で解決する。値は触らない。結果は `令和8年04月01日`。

**確認できたこと**:

| 観点 | 結果 |
|---|---|
| パース速度 | 40〜56ms (2シート・3000行込み) |
| 和暦 | シムで解決 (`era-fixed 4`) |
| 西暦 / 通貨 / パーセント | `2026/04/01` / `¥1,250,000` / `82.3%` — SSF が正しく処理 |
| 結合セル | `!merges` → `colspan` に正しく変換 |
| シート切り替え | タブで動作 |
| 3000行 | 先頭1000行 + 「すべて表示」で破綻なし |
| バンドル | **364KB** (見積もり 412KB より小さい)。実測増分 **+394,522 bytes**、docx と合わせて **+943,026 bytes (+28.1%)** |

**「条件付き」の中身 — 合格と言い切れない3点**:

1. **シムは formatter ではなく normaliser**。`ge.m.d` (Excel では `R8.4.1`) も `令和8年4月1日` になる。生シリアルよりはるかにマシだが**「Excel で見えていた通り」ではない**。忠実にやるなら `g`/`gg`/`ggg`/`e`/`ee` を解釈する実装が要る
2. **テストファイルが生成物**で、実物の複雑さ (sharedStrings・セルの色/罫線/配置・数式・条件付き書式・グラフ・ウィンドウ枠固定) を一切含まない。特に **`sheet_to_html` はセル書式を一切出力しない**ため、**色で意味を伝えている表はその情報が丸ごと落ちる**。mammoth と同じ「体裁は自前」だが、xlsx では*元の色情報を拾って反映する*追加実装になる
3. **規模と実機が未確認**。3000行は通ったが ADR が警戒したのは数万行。「すべて表示」も未実行 (タップ自動化が無いため)。横長シート・実機も未検証

**実装着手時の最初の作業**: **実物の xlsx を1つ開く**。生成物では出ない問題 (書式欠落の実用上の痛み、色情報消失の影響) はそこで初めて分かる。

> **スパイクで踏んだ自分のバグ (同種の事故を避けるため記録)**: 元号書式の判定を素朴な `/g/i` で書いたところ、**既定書式である `"General"` に一致し、ワークブック中の全数値 (3004セル) を日付に書き換えた** (正しくは4セル)。また `Loading…` の消去が効かなかったのは、**SheetJS が同期処理**で、監視を仕掛ける前に描画が終わっていたため (mammoth は非同期なので偶然動いていた)。どちらも画面に出した計測値 (`era-fixed N`) のおかげで即座に気づけた — **スパイクに計測表示を仕込む価値はここにある**。

## 次の一手 (2026-08-07 更新・①〜④完了)

表示系3形式の PoC は終わった。**PoC 5 (課金) はスパイクとして立てない** — 課金で本当に危ないのは技術ではなく審査プロセス (復元ボタンの欠落 = Guideline 3.1.1、初回 IAP をバージョンに添付し忘れる、有料App契約の未署名) であり、コードを捨てても何も減らないため。加えて RevenueCat 設定・IAP 登録・Sandbox テスターはそもそも捨てられない。

**着手順序**:

1. ~~**FR-21〜 を書き起こす**~~ → **完了 (2026-08-07、Requirements 改訂47)**。旧「FR-21〜 (概略のみ)」を [FR-21 共通仕様](Requirements.md#fr-21-他形式ファイルの閲覧-共通仕様-v2--pro) に作り替え、[FR-41 PDF](Requirements.md#fr-41-pdf-閲覧-v2--pro) / [FR-42 docx](Requirements.md#fr-42-word-docx-閲覧-v2--pro) / [FR-43 xlsx](Requirements.md#fr-43-xlsx-閲覧-v2--pro) / [FR-44 課金](Requirements.md#fr-44-pro-課金とエンタイトルメント-v2--pro) を新設 (FR-22〜40 が埋まっているため連番「FR-21〜」は使えず、FR-21 を傘にして詳細を末尾に追加した)。本 ADR との食い違い2点 (`react-native-pdf` → **`react-native-pdf-renderer`**、xlsx の「セル選択」→ **非対応に訂正**) も解消済み
2. ~~**`react-native-purchases` がビルドできるか確認**~~ → **完了・合格 (2026-08-07)**。`react-native-purchases@10.7.0` を `npx expo install` で導入 → **config plugin 不要・autolinking のみ**で `Podfile.lock` に `RNPurchases (10.7.0)` + `PurchasesHybridCommon (18.29.0)`、`prebuild --clean` 後の Debug / iphonesimulator ビルドが `** BUILD SUCCEEDED **`。
   **ただしビルド成功だけでは足りなかった**: `RNPurchases` は `RCTEventEmitter <RCTBridgeModule>` の**レガシーブリッジモジュール**で `codegenConfig` を持たない (= TurboModule ではない) ため、New Architecture では bridgeless の interop 越しに動く形になる。コンパイルが通ることは「New Arch で動く」の証明にならないので、**シミュレータ (iPhone 17 Pro / iOS 26.5) で実行時プローブ**を追加した — 結果は `module: present (4 keys)` / `isConfigured(): false` / **`canMakePayments(): true`**。3つ目が JS → ネイティブ → StoreKit → 戻り値の往復を示すので**合格**。`expo-iap` への切り替えは不要。
   > 注意: `Purchases.isConfigured()` は**ネイティブモジュールが見つからない場合も警告を出して `false` を返す**実装なので、単体では判定に使えない。`NativeModules.RNPurchases` の存在確認と、値を返すネイティブ呼び出し (`canMakePayments()`) の2点で見ること。
3. ~~**Pro ゲートを「スタブ付きの単一フック」として先に置く**~~ → **完了 (2026-08-07)**。[`src/hooks/use-pro-entitlement.ts`](../src/hooks/use-pro-entitlement.ts) が `{ isPro: boolean }` を返す (現状 `true` 固定)。ビューアは最初からこれを経由させ、課金の中身は後からフックの中だけ差し替える。**ゲートを後付けにすると3つのビューアを2度触ることになる**ため先に置いた。
   結果として、この判断は**課金 SDK が未定のまま先へ進める**ことも意味している (上の保留を参照) — フックの内側が `Transaction.currentEntitlements` でも `entitlements.active['pro']` でも、呼び出し側は無改修。**`isPro: true` のまま出荷しないこと**が v2 のリリースブロッカー
4. ~~**ビューアをスパイクから製品コードへ昇格**~~ → **完了 (2026-08-07)**。PDF → docx → xlsx の順に**1形式ずつ**昇格した (PDF だけネイティブ依存を伴うので混ぜない、という切り分けのため)。足場は撤去し、Pro ゲート・再試行・履歴 (成功時のみ記録)・i18n・オフラインバナーを入れた。拡張子とルーティングは [file-types.ts](../src/lib/file-types.ts) の**単一定義**に集約 (ゲートは「2箇所」ではなく **4箇所**あった — Open In と共有シートを数え落としていた)。commit `4c040f2` / `0f4ccf2` / `13c6c02`
5. **課金の実装とアカウント側の設定** — **SDK 未定のまま保留中** (上の「保留に差し戻し」を参照)

## 残作業 (2026-08-07 時点)

`v2` ブランチに7コミット。**push はまだしていない**。

| # | 作業 | なぜ | 状態 |
|---|---|---|---|
| 1 | **実機確認** | 今日 UTI を3つ (`com.adobe.pdf` / docx / xlsx) 宣言した。**既存機能の退行に関わる唯一の未確認事項**で、シミュレータでは自動化できない。とくに **Md の Open In が退行していないか** | **完了 (2026-08-07、iPhone)。iPad のみ未確認** |
| 2 | **xlsx の列幅と空行** | 実データで**最優先と判明**した2点。`!cols` が無視されて金額列が画面外に出る / レイアウト用の空行がそのまま描画され最初の1画面がほぼ空白になる。どちらも `sheet_to_html` 出力への後処理 | 未着手 |
| 3 | **docx のコメント欠落への方針** | 実質的な損失はこれだけ。コメント本文が消えるうえ、**コメントが付いていること自体が分からない**。表示するか、存在だけ示すか、非対応と明記するか | 未決 |
| 4 | **xlsx の塗り色と `[Red]` マイナス値** | **実現性は検証済み・未実装** (id 解決 320/320・マップ 7.3KB)。ダークモードで淡色に白文字が乗る問題への対処が要る | 未着手 |
| 5 | **課金** | Android を出すかで SDK が決まる。先に進めてよいのは**有料 App 契約 (Paid Apps Agreement) の署名**で、税務手続きを伴い時間がかかるうえ SDK 選定と独立している | 保留 |
| 6 | **push** | — | **完了 (2026-08-07)** |

**1 を先に置く理由**: 2〜4 は新機能の質を上げる作業だが、1 は**すでに入れた変更が既存機能を壊していないか**の確認で、性質が違う。

### 実機確認の結果 — **合格 (2026-08-07、iPhone 17 / iOS 26.5.2、dev variant の Debug + Metro)**

**UTI を3つ足したことによる退行は無かった。** 確認できたこと:

| 観点 | 結果 |
|---|---|
| **Md の Open In** (最重要・既存機能) | 退行なし。共有シートの候補にも従来どおり出る |
| 他形式の Open In (経路B) | PDF / docx / xlsx とも各ビューアへ到達 |
| アプリ内ピッカー (経路A) | 同上。**2経路とも通った** |
| ホーム外のファイル | 閲覧のみで正しく扱われる (Policy A と整合) |
| ダークモード | 問題なし |

検体は iCloud Drive の作業用フォルダ (Modrift ホーム**外**) に置いた。ホーム外に置いたことで「ホーム外は閲覧のみ」の経路を同時に確認でき、テスト後にフォルダごと消せる。PDF は日英混在12ページをヒラギノ埋め込みで生成 (`swift` + AppKit の `CGContext` PDF コンシューマ、20行程度 — `cupsfilter` は HTML → PDF のフィルタを持たない)。

**未確認: iPad のみ** (確認時オフラインだったため)。他は iPhone で通っている。

> **手順の罠 (再掲・今回も該当した)**: `expo run:ios --device` に渡す UDID は **`xcrun xctrace list devices` の括弧内**であって、`devicectl list devices` の Identifier 列 (coredevice UUID) ではない。後者を渡すと `No device UDID or name matching` で落ちる。

> **検証手順の再利用メモ**: 実機・シミュレータともタップ自動化は無い。画面外の確認は WebView に一時的に `injectedJavaScript` でスクロールさせ、撮影後に外す (スパイクの `scrollBottom` パラメータの代替)。**`prebuild --clean` を挟むとシミュレータのアプリコンテナ UUID が変わる**ので、deep link に埋めるパスは**毎回取り直す** (古いパスのままだと「アプリの不具合」に見える読み込みエラーになる — 実際に一度踏んだ)。

## 未確定事項 (実装着手時)

- [x] **実物の xlsx を開く** → **実施 (2026-08-07)**。4シート・最大 1012行×40列・11,371セル・数式 2,046・結合 136 の実在ワークブック。**懸案の優先順位が入れ替わった** — 色の欠落より、**列幅 (`!cols`) が無視されて金額列が画面外に出る**ことと、**レイアウト用の空行がそのまま描画されて最初の1画面がほぼ空白になる**ことの方が実用上痛い。加えて、**スパイクの「1行目＝ヘッダー」という仮定が即座に否定された** (1行目は表題、別シートでは空行) ので撤去した。**この文書には元号書式が1つも無く、本 ADR 最大の発見だった和暦シムは出番が無かった** — シムの価値は文書次第という位置づけに改める。詳細は [FR-43](Requirements.md#fr-43-xlsx-閲覧-v2--pro)
- [x] **実物の .docx を開く** → **実施 (2026-08-07)・問題なし**。140段落が取りこぼしなく変換され警告0件、落ちたのは装飾的な文字色50箇所のみ。**xlsx と対照的**なのは、docx では意味を段落スタイルが担い mammoth がそれを写すのに対し、xlsx では意味を塗り色そのものが担っていたため。ただし**段組・テキストボックス・図形・画像・表・脚注・コメントはこの文書に無く、依然未検証**。詳細は [FR-42](Requirements.md#fr-42-word-docx-閲覧-v2--pro)
- [ ] 和暦の忠実な formatter (`g`/`gg`/`ggg`/`e`/`ee`)
- [ ] **xlsx の列幅と空行の扱い** (実データで最優先と判明。上記参照)
- [ ] xlsx のセル書式をどこまで拾うか → **塗り色と `[Red]` マイナス値の赤字は実現性を検証済み・未実装**。`sheet_to_html` が振る `id="sjs-<番地>"` に後付けで色を当てられる (実データで id 解決 320/320・マップ 7.3KB)。ダークモードでは淡色の塗りに白文字が乗るため、塗ったセルの文字色を濃色固定にする規則が要る。罫線・配置・条件付き書式は対象外のまま
- [ ] 他形式の Open In 追加で共有シート・「このアプリで開く」の候補がどう変わるか (Requirements 10.4 の `NSExtensionActivationRules` 周り)
- [ ] 課金 (PoC 5) — 未着手

## 調査出典 (抜粋)

- PDF: [react-native-pdf-renderer](https://github.com/douglasjunior/react-native-pdf-renderer) / [react-native-pdf New Arch 修正 #942](https://github.com/wonday/react-native-pdf/issues/942) / [@config-plugins 互換表](https://github.com/expo/config-plugins/tree/main/packages/react-native-pdf)
- docx: [mammoth.js](https://github.com/mwilliamson/mammoth.js/) / [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) / [bundlephobia: mammoth](https://bundlephobia.com/package/mammoth)
- xlsx: [SheetJS CDN (公式配布)](https://cdn.sheetjs.com/) / [npm 離脱の経緯](https://git.sheetjs.com/sheetjs/sheetjs/issues/2667) / [@e965/xlsx ミラー](https://www.npmjs.com/package/@e965/xlsx) / [CVE-2023-30533](https://www.sentinelone.com/vulnerability-database/cve-2023-30533/) / [sheet_to_html](https://docs.sheetjs.com/docs/api/utilities/html/)
- 課金: [RevenueCat Expo Installation](https://www.revenuecat.com/docs/getting-started/installation/expo) / [Pricing](https://www.revenuecat.com/pricing) / [Restoring Purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases) / [Expo 公式 IAP ガイド](https://docs.expo.dev/guides/in-app-purchases/)
