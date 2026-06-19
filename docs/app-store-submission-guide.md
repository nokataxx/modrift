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

## メモ: 無料 → 有料への変更

- MVP を無料で出し、後から有料へ変更可能（価格を変えるだけ）。
- ただし「無料DL済みの既存ユーザーから後追い課金」はできない（価格変更は新規DLに適用）。
- 将来の収益化は「無料 + App内課金（プレミアム機能）」も選択肢。MVP は完全無料で問題なし。
