# iCloud コピー編集 — 構成リファレンス

Modrift の **FR-03「iCloud コピー編集」** に関する iCloud 構成の参照ドキュメント。

初期セットアップ (Apple Developer サイトでの App ID / Container 作成、`app.json` への entitlements 追記、`expo prebuild`) は **完了済み**。設定はすべて [app.json](../app.json) の `ios` ブロックと `ios/modrift/modrift.entitlements` にコード化されている。

このファイルは、再セットアップ (新しい Mac / Apple アカウント) やトラブル時の参照用として、確定事項とトラブルシュートのみを残す。

- **関連**: [Requirements.md](Requirements.md) FR-03

## なぜ iCloud コピー編集なのか

Google Drive 等の File Provider は他アプリの in-place 編集をクラウドに上げないため、Modrift では **iCloud Drive 内 `Modrift/` フォルダにコピーを作成して編集する** 設計を取る (Requirements FR-03)。

iCloud Drive のアプリ専用領域 (ubiquity container) を使うには iCloud capability の entitlement が必要で、**有料 Apple Developer Program 加入が必須**。

## 確定済みの命名

| 項目 | 値 |
| --- | --- |
| Bundle ID | `com.nokata.modrift` |
| iCloud Container ID | `iCloud.com.nokata.modrift` |
| Files App 上の表示名 | `Modrift` |

> Container ID は Apple Developer サイトで一度作成すると削除できない。Bundle ID と一致させる Apple 公式の慣例に従う ([Apple Developer Forums](https://developer.apple.com/forums/thread/811970), [InformIT iCloud docs](https://www.informit.com/articles/article.aspx?p=2177650&seqNum=2))。

## 構成の所在と意味

entitlements / `NSUbiquitousContainers` は [app.json](../app.json) の `ios` ブロックに定義され、`expo prebuild` で `ios/modrift/modrift.entitlements` および `Info.plist` に反映される。

| キー | 意味 |
| --- | --- |
| `icloud-container-identifiers` | このアプリが使う Container ID。複数可 |
| `icloud-services` | `CloudDocuments` のみ (CloudKit は使わない) |
| `ubiquity-container-identifiers` | 上と通常同じ値。File Provider 統合のため |
| `NSUbiquitousContainerIsDocumentScopePublic` | `true` で Files App に「Modrift」フォルダが見える |
| `NSUbiquitousContainerSupportedFolderLevels` | `Any` でユーザーが自由にサブフォルダを作れる |
| `NSUbiquitousContainerName` | Files App 上に表示される名前 |

## 再セットアップ時の要点 (新 Mac / 新アカウント)

1. Apple Developer サイト → **Identifiers** で App ID `com.nokata.modrift` に **iCloud** capability を有効化 (CloudKit は不要、CloudDocuments のみ)
2. **iCloud Containers** に `iCloud.com.nokata.modrift` を作成し、App ID に紐付け
3. `npx expo prebuild --platform ios --clean` で `ios/` を再生成 (entitlements は `app.json` から自動反映)
4. Xcode の **Signing & Capabilities** で iCloud Documents と Container が緑チェックになっていることを確認

## トラブルシュート

### `Provisioning profile doesn't include the iCloud capability` でビルド失敗
- App ID への Container 紐付けが反映されていない or Provisioning Profile が古い
- Xcode の Signing & Capabilities タブで **Automatically manage signing** が ON か確認
- 一度 capability を削除して再追加すると再生成される

### Files App に Modrift フォルダが出てこない
- `NSUbiquitousContainerIsDocumentScopePublic` が `true` か確認
- iOS 設定 → Apple ID → iCloud → Drive がオン
- アプリを一度起動して container を初期化する必要あり (起動だけで作られる)
- それでも出ない場合: iCloud Drive アプリ自体が iOS 設定で OFF になっていないか確認

### `Your development team does not support the iCloud capability` (Personal Team で出る)
- Apple Developer Program の加入が反映されていない、または Xcode 側で Personal Team が選ばれている
- Xcode → Settings → Accounts で **有料アカウントの Team** が選択肢に出ているか確認、ターゲットの Signing タブで切り替え

## 関連リソース

- Apple: [iCloud Storage](https://developer.apple.com/icloud/) (概要)
- Apple: [Configuring iCloud capability](https://developer.apple.com/documentation/xcode/configuring-icloud-capability)
- Apple: [`NSUbiquitousContainers`](https://developer.apple.com/documentation/bundleresources/information_property_list/nsubiquitouscontainers)
- Expo: [iOS entitlements in app.json](https://docs.expo.dev/versions/latest/config/app/#entitlements)
