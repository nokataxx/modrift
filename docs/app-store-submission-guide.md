# App Store 提出手順（一般公開・要 Apple 審査）

目的: 一般公開のため App Store の本審査に提出する。
位置づけ: まず [Build and Run.md](Build%20and%20Run.md) のビルド〜TestFlight 内部テスト → 問題なければ本ガイドで審査提出、という順番。**同じ本番ビルドを審査に使える**（再ビルド不要）。

## TestFlight 内部テストに「追加で」必要なもの

- [x] アプリアイコン（実装済み・ビルドに含まれる）
- [x] スクリーンショット 6.9"(1320×2868) 3枚 → `store-assets/screenshots/`（01 整形表示 / 02 コード・表 / 03 編集モード）
- [x] プライバシーポリシー URL → https://modrift.github.io/privacy.html
- [x] サポート URL → https://modrift.github.io/support.html
- [ ] ストア掲載文（[app-store-listing.md](app-store-listing.md) から転記）
- [ ] App プライバシー（データ収集）の申告 → 「収集なし」
- [ ] カテゴリ / 価格 / 年齢制限

## 手順（App Store Connect、Web）

1. **App 情報**: カテゴリ（Utilities / Productivity）、年齢制限 4+、コンテンツ配信権
2. **価格**: 無料（Free）
3. **App プライバシー**: 「データを収集していません」を選択（解析・トラッキング無し、ファイル内容のクラウド送信無し）
4. **掲載情報**（[app-store-listing.md](app-store-listing.md) から転記）
   - 名前 / サブタイトル / 説明 / キーワード / プロモーションテキスト
   - スクリーンショット 3枚アップロード
   - サポートURL / マーケティングURL / プライバシーポリシーURL
5. **ビルドを選択**: TestFlight に上げた本番ビルドを「App Store」タブで選ぶ
6. **審査メモ（App Review Information）**
   - 連絡先: 氏名・電話・メール（**既存の個人メールで可。非公開**でユーザーには見えない）
   - メモ例: 「Files アプリから .md ファイルを『Modriftで開く』で機能を確認できます。動作確認用サンプルは `samples/showcase.md` を同梱/参照」
7. **審査へ提出** → 通常数日で結果。差し戻し時は指摘に対応して再提出。

## 審査で注意したい Modrift 固有点

- **機能の実証（Guideline 2.1）**: 審査者がファイルを開けないと機能を確認できない。審査メモに「Files から .md を開く手順」を明記。
- **Google Drive の編集非同期**: アプリ内・掲載文で「閲覧向け」と説明済みなら問題なし。

## v2 (2.0.0) 固有の手順 — 初回の App 内課金を同時提出する

v1.x との決定的な違いは **初回の非消耗型 IAP をアプリのバージョンと一緒に審査へ出す**こと。IAP 単独では提出できず、**一緒にしそこねるとアプリだけ審査に出て IAP が置き去りになる**。承認後は2つめ以降の IAP をバージョン無しで単独提出できる。

### 提出のしかた（2026-08-13 実施・**バージョン画面から添付するのではない**）

App Store Connect は「**提出物 (submission)**」という箱に項目を集めてから一括で出す方式になっている。バージョンページに「App内課金」セクションがあってそこに添付する、という古い手順の解説が世に多いが、**現行 UI にその欄は無い**。実際はこう:

1. **収益化 → アプリ内購入 → `Modrift Pro` → 「審査用に追加」** — 下書きの提出物が作られ、IAP が1件入る
2. この時点では「**審査へ提出できません — 最初の非消耗型アプリ内購入は、新しいアプリバージョンとともに提出する必要があります**」と出てボタンが押せない。**バージョンを選ぶプルダウンは無く**、「選択したプラットフォームの最新バージョンとともに審査されます」という自動合流方式
3. **バージョン 2.0.0 を作って中身を全部埋める**（下記チェック）
4. **2.0.0 のページ右上「審査用に追加」** — 同じ下書きに合流し、件数が (2) になる
5. 下書きパネルに `Modrift Pro` と `2.0.0` が**2件並んでいることを確認**して「**審査へ提出**」

> 「審査用に追加」は提出ではない。追加後も「項目を削除」で外せるので、先に押して構わない。

### 提出前チェック

- [ ] `app.json` の `extra.revenueCatApiKey` が **`appl_` で始まっている**こと（`test_` は RevenueCat の Test Store 用。出荷するとシミュレータへ購入が流れる。リリースビルドではガードが効いて「購入できません」表示になるので気づけるが、そもそも入れない）
- [ ] IAP `com.modrift.app.pro` に **価格 (¥1,000)**・**ローカリゼーション (日英)**・**審査用スクリーンショット**が揃っていること
- [ ] スクリーンショット iPhone 6.9" / iPad 13" **各6枚**（[screenshot-recipe.md](screenshot-recipe.md)）
- [ ] 掲載文・新機能を **日英どちらも** v2 版に更新（言語切替を忘れやすい）
- [ ] ビルドが選択されていること
- [ ] 審査メモを下記に差し替え（**前バージョンの文面が残りやすい**）
- [ ] 「価格および配信状況」で**本体が無料**のまま（課金は IAP だけ。金額は要約表に出ないので「現在の価格」を展開して見る）

> App 内課金ありの申告欄は現行 UI に無い。提出物に IAP が入っていることがそれに当たる。

### 審査員が検体ファイルを持っていない問題

**iOS には既定で PDF / .docx / .xlsx が無い。** 審査員がファイルを用意できないと有料機能を確認できず、[Guideline 2.1](https://developer.apple.com/app-store/review/guidelines/#2.1) のリジェクト要因になる。**サポートサイトに検体を置き、審査メモからリンクする**のが確実（生成手順は [screenshot-recipe.md](screenshot-recipe.md) の「検体ファイル」）。

### 審査メモ (App Review Information → Notes) — 2.0.0 で実際に提出した全文

前バージョンの文面が最初から入っているので、**全部消して**これを貼る。v1.5 の目玉（編集ツールバー等）の説明はもう要らない。逆に**有料機能への到達手順と復元手順**が必須になった (Guideline 3.1.1)。

```
No account or sign-in is required, so no demo account is needed.

Modrift opens a single file from anywhere — Files, iCloud Drive, Google
Drive, Dropbox, mail attachments — and renders it formatted. Markdown,
plain text and images are free. New in this version: PDF, Word (.docx) and
Excel (.xlsx) viewing, unlocked by one non-consumable in-app purchase
(Modrift Pro). This is the app's first in-app purchase, submitted together
with this version.

SAMPLE FILES FOR TESTING
iOS has no PDF / .docx / .xlsx files by default, so we host samples here:
https://modrift.github.io/samples/
Open a link in Safari, tap Share > "Save to Files", and save it anywhere.
A sample PDF is also attached to this submission.

TO REACH THE PAYWALL
1. Launch the app.
2. Tap the "..." menu (top right) > "Open File", then pick the PDF
   (or .docx / .xlsx) you saved.
3. The paywall appears in place of the document, showing the price and a
   Restore Purchase button.
Alternatively, from the Files app: long-press the file > Share > Modrift.

TO RESTORE A PURCHASE
- On the paywall: "Restore Purchase".
- Or the "..." menu > Settings > Purchase > Restore Purchase.
No account is required. The purchase is tied to the App Store account and
restored from its purchase history.

FREE FUNCTIONALITY (no purchase needed)
1. Tap "+" (top left) to create a new note. It is created in the app's
   home folder and is immediately editable.
2. Type anything — it auto-saves (there is no Save button, by design).
3. Tap the pencil / eye icon (top right) to switch between edit and
   preview. In edit mode a formatting toolbar appears above the keyboard.
Images (PNG / JPEG / GIF / HEIC / WebP) also open free of charge.

HOW EDITING IS SCOPED (please read before testing)
Editing applies only to files in the app's own home folder (iCloud >
Modrift). Files from other locations (Google Drive, Dropbox, or iCloud
Drive outside the Modrift folder) open as view-only, because iOS does not
allow this app to write back to them reliably. To edit such a file, tap
"Copy to Home" (folder icon, top right): the copy lands in the home folder
and becomes editable, and the original is never modified.
PDF, Word and Excel files are view-only in every location, by design.

If the test device has no iCloud account: open Settings (the "..." menu,
top right) and set "Home location" to "Local" — the app then works fully
on-device.

The app has no server backend and collects no data. File contents never
leave the device except through the user's own iCloud.
```

**添付ファイル**: `samples/Field Note.pdf` を付けた。**.md は付けない** — 審査員は「＋」で新規ノートを作れるうえ、`UIFileSharingEnabled` / `LSSupportsOpeningDocumentsInPlace` により**ホームが iCloud でもローカルでもそのノートは Files に現れる**ので、経路B の確認もそれで足りる。アプリ内で作れない PDF / docx / xlsx に添付枠を使う。

なお添付は**保険にすぎない**。審査員から見れば添付は管理画面側にあり、端末へ移す手間がかかる。URL ならテスト端末の Safari で完結するので**そちらが主**。付けないなら "A sample PDF is also attached..." の行を消すこと。

### リリースノート (What's New) は [app-store-listing.md](app-store-listing.md) から転記

## メモ: 無料 → 有料への変更

- MVP を無料で出し、後から有料へ変更可能（価格を変えるだけ）。
- ただし「無料DL済みの既存ユーザーから後追い課金」はできない（価格変更は新規DLに適用）。
- 将来の収益化は「無料 + App内課金（プレミアム機能）」も選択肢。MVP は完全無料で問題なし。
