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

v1.x との決定的な違いは **初回の非消耗型 IAP をアプリのバージョンに添付して同時に審査へ出す**こと。単独では提出できず、**添付を忘れるとアプリだけ審査に出て IAP が置き去りになる**（App Store Connect の IAP 画面にも明記される）。

### 提出前チェック

- [ ] `app.json` の `extra.revenueCatApiKey` が **`appl_` で始まっている**こと（`test_` は RevenueCat の Test Store 用。出荷するとシミュレータへ購入が流れる。リリースビルドではガードが効いて「購入できません」表示になるので気づけるが、そもそも入れない）
- [ ] IAP `com.modrift.app.pro` に **価格 (¥1,000)**・**ローカリゼーション (日英)**・**審査用スクリーンショット**が揃っていること
- [ ] バージョン 2.0.0 のページで **IAP が添付されている**こと
- [ ] App 内課金ありの申告、スクリーンショット6枚（[screenshot-recipe.md](screenshot-recipe.md)）、掲載文（[app-store-listing.md](app-store-listing.md)）

### 審査員が検体ファイルを持っていない問題

**iOS には既定で PDF / .docx / .xlsx が無い。** 審査員がファイルを用意できないと有料機能を確認できず、[Guideline 2.1](https://developer.apple.com/app-store/review/guidelines/#2.1) のリジェクト要因になる。**サポートサイトに検体を置き、審査メモからリンクする**のが確実（生成手順は [screenshot-recipe.md](screenshot-recipe.md) の「検体ファイル」）。

### 審査メモ (App Review Information → Notes)

> Modrift opens a single file from anywhere — Files, iCloud Drive, Google Drive, Dropbox, mail attachments — and renders it formatted. Markdown, plain text and images are free. PDF, Word (.docx) and Excel (.xlsx) viewing is unlocked by one non-consumable in-app purchase (Modrift Pro).
>
> **Sample files for testing**
> Sample documents are available at https://modrift.github.io/samples/ — a PDF, a .docx and an .xlsx. Open a link in Safari, tap Share → Save to Files, then follow the steps below.
>
> **To reach the paywall**
> 1. Open Modrift.
> 2. Tap the ⋯ menu at the top right → **Open File**, then choose the PDF (or .docx / .xlsx) you saved.
> 3. The paywall appears in place of the document, showing the price and a Restore Purchase button.
>
> Alternatively, from the Files app: long-press the file → Share → Modrift.
>
> **To restore a purchase**
> - On the paywall: **Restore Purchase**.
> - Or the ⋯ menu → **Settings** → **Purchase** → **Restore Purchase**.
>
> **Notes**
> - No account is required. The purchase is tied to the App Store account and restored from its purchase history.
> - The app collects no data and sends no file contents anywhere.
> - Files outside the app's home folder (iCloud › Modrift) are view-only by design: iOS only permits in-place editing for iCloud Drive. This is a platform constraint, not a missing feature.
> - PDF, Word and Excel files are view-only in all locations.

### リリースノート (What's New) は [app-store-listing.md](app-store-listing.md) から転記

## メモ: 無料 → 有料への変更

- MVP を無料で出し、後から有料へ変更可能（価格を変えるだけ）。
- ただし「無料DL済みの既存ユーザーから後追い課金」はできない（価格変更は新規DLに適用）。
- 将来の収益化は「無料 + App内課金（プレミアム機能）」も選択肢。MVP は完全無料で問題なし。
