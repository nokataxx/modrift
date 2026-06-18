# TestFlight / App Store 提出チェックリスト

Modrift MVP (v1.0.0) を TestFlight 配布 → App Store 申請するための残タスク一覧。

## A. アプリ側（リポジトリ） — ほぼ完了

- [x] アプリアイコン（1024×1024、独自デザイン）
- [x] `ITSAppUsesNonExemptEncryption: false`（提出時の暗号化質問を省略）
- [x] Bundle ID: `com.nokata.modrift`
- [x] バージョン `1.0.0`（`eas.json` の `appVersionSource: remote` + `autoIncrement` でビルド番号は自動）
- [x] データ収集なし（解析/トラッキングSDKなし、ファイル内容のクラウド送信なし）
- [ ] `ITSAppUsesNonExemptEncryption` 反映のため再ビルド（次回 `eas build` で自動反映。ローカルは `expo prebuild` 後に焼き込み）

## B. 用意するアセット・文章

- [x] プライバシーポリシー / サポート本文 → 公開リポ `modrift-site` の HTML（更新手順は [site-maintenance.md](site-maintenance.md)）
- [x] ストア掲載文（日英） → [app-store-listing.md](app-store-listing.md)
- [ ] **スクリーンショット**（必須）— iPhone 6.9"(1320×2868) もしくは 6.5"(1242×2688) を最低1枚（推奨3〜5枚）。シミュレータから生成可能（別途対応）
- [x] プライバシーポリシーURL の公開 → https://modrift.github.io/privacy.html
- [x] サポートURL の公開 → https://modrift.github.io/support.html （問い合わせは GitHub Issues）

## C. App Store Connect（Web、ユーザー作業）

- [ ] App 登録（マイApp → ＋ → 新規App。Bundle ID / 名前 Modrift / 主言語 / SKU）
- [ ] App 情報: カテゴリ = Utilities、コンテンツ配信権、年齢制限（4+）
- [ ] 価格 = 無料（Free）
- [ ] App プライバシー: 「データを収集していません」を選択
- [ ] 掲載情報: サブタイトル / 説明 / キーワード / プロモ / スクショ / 各URL を入力（[app-store-listing.md](app-store-listing.md) から転記）
- [ ] 輸出コンプライアンス: `ITSAppUsesNonExemptEncryption=false` 済みなら質問は自動でスキップ

## D. ビルド & アップロード

- [ ] `eas build --platform ios --profile production`（本番証明書は EAS が自動生成）
- [ ] `eas submit --platform ios --profile production --latest`（App Store Connect API Key 推奨）
- [ ] `eas.json` の `submit.production` に `ascAppId` / `appleTeamId` を記入（App 登録後）

## E. TestFlight

- [ ] 処理完了後、内部テスター（自分）に配布 → レビュー不要で即確認
- [ ] 実機で iCloud 同期 / Open In / 編集保存をスモークテスト
- [ ] （任意）外部テスター配布は初回のみ Beta App Review（約1日）

## F. 審査提出（App Store）

- [ ] 審査メモに「Files アプリから .md を開く手順」を記載（審査者が機能を確認できるように）
- [ ] サンプル `.md` の入手手順 or 同梱を案内（`samples/` 活用）
- [ ] 「App Store」タブでビルドを選び、審査へ提出

---

## メモ: 無料 → 有料への変更について
- MVP を **無料**で出し、後から**有料に変更することは可能**（App Store Connect で価格を変更するだけ）。
- ただし「いったん無料でDLした既存ユーザーから後で課金する」ことはできない（価格変更は新規DLに対して適用）。
- 将来の収益化は「無料アプリ＋App内課金（プレミアム機能）」という形も選択肢。MVP段階では完全無料で問題なし。
