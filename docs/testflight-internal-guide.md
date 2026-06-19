# TestFlight 内部テスト手順（自分の実機で動作確認）

目的: 本番ビルドを自分の iPhone に TestFlight で入れて動作確認する。**Apple の審査は不要**。
一般公開（App Store）はこの後の別工程 → [app-store-submission-guide.md](app-store-submission-guide.md)。

## 内部テストでは「不要」なもの

以下は App Store 審査では必要だが、**内部テストには要らない**:

- スクリーンショット
- ストア掲載文（説明・キーワード・サブタイトル等）
- プライバシーポリシー / サポート URL の公開
- App プライバシー（データ収集）の申告
- カテゴリ / 価格 / 年齢制限の設定

※ アプリのアイコンはビルドに既に含まれているため、別途の用意は不要。

## 必要なもの

- Apple Developer Program 加入（年 $99）
- App Store Connect のアプリ枠（Bundle ID と紐付け）
- 本番ビルド（署名済み）

## 手順

1. **アプリ枠を作成**（初回のみ）
   App Store Connect → マイApp → ＋ → 新規App
   - プラットフォーム: iOS / 名前: Modrift / 主言語: 日本語 / Bundle ID: `com.modrift.app` / SKU: `modrift`
   - カテゴリ・価格・プライバシー等は**空のままでよい**（App Store 提出時に埋める）

2. **本番ビルド**
   ```
   eas build --platform ios --profile production
   ```
   初回は証明書・プロビジョニングを EAS が自動生成。

3. **アップロード**
   ```
   eas submit --platform ios --profile production --latest
   ```
   初回は App Store Connect API Key を設定。`eas build ... --auto-submit` で 2+3 を一括も可。

4. **処理待ち**（数分〜1時間）
   App Store Connect の **TestFlight タブ**にビルドが出る。
   輸出コンプライアンスの質問は `ITSAppUsesNonExemptEncryption=false` 済みで自動スキップ。

5. **内部テスターに追加**
   TestFlight タブ → 内部テスト → 自分（チームメンバー）を追加。**レビュー不要で即配信**。

6. **実機で受け取る**
   iPhone に **TestFlight アプリ**（App Store から無料）を入れ、同じ Apple ID でサインイン → Modrift をインストール。

7. **動作確認（スモークテスト）**
   - iCloud Drive のファイルを開いて編集 → クラウドに同期されるか
   - Files から「Modriftで開く」（Open In 経路）
   - 編集 → 3秒後に自動保存されるか

## メモ

- 内部テスターは最大100人（App Store Connect のチームメンバー）。
- **一般の人に配る**場合は「外部テスト」になり、初回ビルドに **Beta App Review（約1日）** が必要。本ガイドの範囲外。
