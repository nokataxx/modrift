# ADR: v2 有償 Pro 他形式閲覧 (PDF / Word / xlsx) の技術選定

- **ステータス**: 提案 (Proposed) — 2026-07-17 調査完了、PoC 未着手
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
- 段組・テキストボックス・図形は落ちる。必要になったら「オリジナルレイアウトで表示」ボタンとして QuickLook (QLPreviewController の自作 Expo Module ラップ、S コスト) をフォールバック併載する拡張余地を残す
- docx→Markdown 変換して CodeMirror で表示する案は不採用: 二重変換の劣化、base64 画像が既存ビューアで表示不能、turndown のメンテ停止、「編集できそうに見えて書き戻せない」UX 混乱

### xlsx: SheetJS CE 0.20.3

- `XLSX.read` → `sheet_to_html` で HTML テーブル生成 → 既存 WebView 基盤に注入。min 412KB / gzip 140KB。Apache-2.0
- 閲覧ビューアに必要な2機能を標準で持つ唯一の JS パーサ:
  - 結合セル (`!merges`) の colspan/rowspan 自動変換
  - 内蔵 SSF による**書式コードどおりの表示文字列 `w`** (「Excel で見えていた通りの値」)。和暦等ロケール依存書式は実データで要確認
- **導入経路に注意 (重要)**: npm の `xlsx` は 0.18.5 (2022) で凍結され、**CVE-2023-30533 (Prototype Pollution) / CVE-2024-22363 (ReDoS) が未修正のまま残る**。細工ファイルを開くビューアなので実害リスクあり。導入は公式 CDN tarball (`npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) か非公式ミラー `@e965/xlsx` (0.20.3、Apache-2.0 なので再配布合法) の二択。**npm の `xlsx@0.18.5` は使用禁止**
- 大きいシート対策: DOM は数万行で破綻する。`content-visibility: auto` は iOS 18 (Safari 18) 以降で iOS 16 ターゲットでは使えないため、「先頭 1000 行 + 追加読み込み」のページングで開始し、需要が出てから仮想化を検討
- パースは WebView 内でなく RN 側 JS で行い、シート単位 (または行範囲) で HTML を生成して注入する構成。シート切替タブは RN 側 UI
- リリースが 0.20.3 (2024-07) で約2年止まっている点は「閲覧用パーサとして枯れている」と割り切る

### 課金: RevenueCat + 非消耗型 + Entitlement

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

- 拡張子ゲート: `SUPPORTED_EXTENSIONS` ([src/app/index.tsx:102](../src/app/index.tsx#L102)) に `.pdf` / `.docx` / `.xlsx` を追加し、種別でルーティング。ホーム一覧側にも同名の定数がある ([home-files.ts:10](../src/lib/home-files.ts#L10)) ので**2箇所**要更新 (ホームに置いた PDF を一覧に出すかは要判断)。種別アイコンは [index.tsx](../src/app/index.tsx#L109) の `FileKind` に PDF/sheet/word が**既に用意済み**
- Document Picker (経路A): **`type` 指定は現在無い** ([index.tsx:328](../src/app/index.tsx#L328) は `copyToCacheDirectory: false` と `multiple: false` のみ)。ピッカーは全形式を出し、**選択後に拡張子で弾く**設計 ([index.tsx:347](../src/app/index.tsx#L347))。したがって経路A は上の拡張子ゲートを広げるだけで通り、**UTI の追加作業は不要** (調査時点の「`type` に UTI を追加」は当時のコード前提で、現行には該当しない)
- Open In (経路B): `app.json` の `CFBundleDocumentTypes` に PDF (`com.adobe.pdf`)、docx (`org.openxmlformats.wordprocessingml.document`)、xlsx (`org.openxmlformats.spreadsheetml.sheet`) を追加 → **prebuild --clean 必須** (ネイティブ設定変更のため)
- ビューア: [viewer.tsx](../src/app/viewer.tsx) は Markdown 専用のまま触らず、`pdf-viewer` / `office-viewer` 等の別ルートを新設して拡張子で振り分け (どちらの起動経路からも到達できること — 2経路はコア設計)。ヘッダーは v1.5 で自前化された ([viewer-header.tsx](../src/components/viewer-header.tsx)・FR-38) ので新ルートでも流用できる。ただし hide-on-scroll のスクロール量は CM の注入 JS から取っており、PDF (ネイティブ) では別途繋ぐ必要がある — **PDF は素の固定ヘッダーで始めるのが安全**
- 編集まわり: 他形式は**常に閲覧のみ**。in-place 編集・iCloud コピーのフローは発動させない。サードパーティクラウド由来のファイルはキャッシュへ実体化して表示 (閲覧専用なので原本書き戻し問題なし — 既存の「ホーム外は閲覧のみ」= Policy A と整合)
- **読み込み (v1.5 の FR-40 が効く範囲に注意・重要)**: 未ダウンロードの File Provider プレースホルダを**実体化してから読む**必要は他形式でも同じ。ところが既存の `FileBookmarkModule.readFileCoordinated` は **UTF-8 テキスト専用** ([index.ts:28](../modules/file-bookmark/index.ts#L28) / Swift 側は `String(contentsOf:encoding:.utf8)`) で、PDF/docx/xlsx には**使えない**。また `copyToCacheDirectory: true` 相当の素のコピーは、FR-40 の調査でプレースホルダに対し「no such file」で失敗すると判明済み。→ **バイナリ用の協調読み込みをネイティブに追加するのが前提作業** (base64 で返す / `NSFileCoordinator` 協調下でキャッシュへコピーする、のいずれか)。これは PoC 1 (PDF) の着手前に必要
- Pro ゲート: 非 Pro 状態で他形式を開いたら Paywall へ誘導。無料機能 (Md/txt) は一切ゲートしない ([5.8](Requirements.md#58-意図的に実装しないもの)「既存の無料機能の有償化はしない」)
- 履歴 (recent-files): 他形式ファイルも履歴に記録。種別アイコン等は実装時に検討

## PoC の順序 (提案)

0. **バイナリの協調読み込み** (前提作業・上記「読み込み」参照): `FileBookmarkModule` にバイナリ版を追加。これが無いと未ダウンロードのクラウドファイルで PDF が開けず、PoC 1 の品質判断がプロバイダ都合のノイズに埋もれる。ホーム / ローカルの実体化済みファイルだけで先に PoC 1 を回す判断も可 (その場合は順序を入れ替えるだけ)
1. **PDF** (最小・独立): react-native-pdf-renderer を入れて prebuild → 実機で数十MB の PDF・ズーム・ページ送りを確認。撤退判断が最も早く出る
2. **docx**: mammoth.js を第二の WebView バンドルとして追加 (または editor-entry.mjs に条件分岐で同居)、表・画像・日本語文書で表示品質を確認
3. **xlsx**: `@e965/xlsx` 導入、`sheet_to_html` + ページング。和暦・日付書式・結合セルを実データで確認
4. **課金**: 表示系3つの目処が立ってから。App Store Connect の IAP 登録 → RevenueCat 設定 → Sandbox で購入→アンインストール→復元まで通す

## 未確定事項 (実機検証待ち)

- [ ] react-native-pdf-renderer の実機品質 (大容量 PDF、日本語しおり/リンク)
- [ ] バイナリ協調読み込みの返し方: base64 (JS ブリッジのコスト・数十MB PDF で現実的か) vs キャッシュへ協調コピーしてローカル URI を渡す (PDFKit にファイルパスを渡せるので PDF はこちらが素直か)
- [ ] mammoth の日本語 docx 出力品質 (表・画像・縦書きは非対応でよいか)
- [ ] SheetJS SSF の和暦・ロケール書式の再現範囲
- [ ] WebView バンドルの構成: editor-entry.mjs に同居 vs 形式別バンドル分割 (起動サイズへの影響)
- [ ] 他形式の Open In 追加で共有シート・「このアプリで開く」の候補がどう変わるか (Requirements 10.4 の `NSExtensionActivationRules` 周り)

## 調査出典 (抜粋)

- PDF: [react-native-pdf-renderer](https://github.com/douglasjunior/react-native-pdf-renderer) / [react-native-pdf New Arch 修正 #942](https://github.com/wonday/react-native-pdf/issues/942) / [@config-plugins 互換表](https://github.com/expo/config-plugins/tree/main/packages/react-native-pdf)
- docx: [mammoth.js](https://github.com/mwilliamson/mammoth.js/) / [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) / [bundlephobia: mammoth](https://bundlephobia.com/package/mammoth)
- xlsx: [SheetJS CDN (公式配布)](https://cdn.sheetjs.com/) / [npm 離脱の経緯](https://git.sheetjs.com/sheetjs/sheetjs/issues/2667) / [@e965/xlsx ミラー](https://www.npmjs.com/package/@e965/xlsx) / [CVE-2023-30533](https://www.sentinelone.com/vulnerability-database/cve-2023-30533/) / [sheet_to_html](https://docs.sheetjs.com/docs/api/utilities/html/)
- 課金: [RevenueCat Expo Installation](https://www.revenuecat.com/docs/getting-started/installation/expo) / [Pricing](https://www.revenuecat.com/pricing) / [Restoring Purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases) / [Expo 公式 IAP ガイド](https://docs.expo.dev/guides/in-app-purchases/)
