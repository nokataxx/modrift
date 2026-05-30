# iCloud コピー編集セットアップ手順 (Apple Developer Program 加入後)

Modrift の **FR-03「iCloud コピー編集」** を有効化するための環境セットアップ手順。Apple Developer Program (有料) 加入直後に、この手順に沿って Apple Developer サイト・`app.json`・Xcode を構成する。

- **対象**: 開発者本人 (solo dev)
- **作成日**: 2026-05-30
- **前提**: Apple Developer Program ($99/年) に加入済み
- **関連**: [Requirements.md](Requirements.md) FR-03

## なぜこの手順が必要か

Google Drive 等の File Provider は他アプリの in-place 編集をクラウドに上げないため、Modrift では **iCloud Drive 内 `Modrift/` フォルダにコピーを作成して編集する** 設計を取る (Requirements FR-03)。

iCloud Drive のアプリ専用領域 (ubiquity container) を使うには iCloud capability の entitlement が必要で、**有料 Apple Developer Program 加入が必須**。

このため iCloud コピー編集機能の実装は Apple Developer Program 加入を gating としている。本手順はその加入完了直後のセットアップを定義する。

## 確定済みの命名

| 項目 | 値 |
| --- | --- |
| Bundle ID | `com.nokata.modrift` |
| iCloud Container ID | `iCloud.com.nokata.modrift` |
| Files App 上の表示名 | `Modrift` |

> Container ID は Apple Developer サイトで一度作成すると削除できない。Bundle ID と一致させる Apple 公式の慣例に従う ([Apple Developer Forums](https://developer.apple.com/forums/thread/811970), [InformIT iCloud docs](https://www.informit.com/articles/article.aspx?p=2177650&seqNum=2))。

## 全体フロー

```
Apple Developer サイト作業 (Step 1〜3)
  ↓ Container ID と App ID 紐付け
app.json 更新 (Step 4)
  ↓ entitlements / Info.plist 追記
expo prebuild (Step 5)
  ↓ ios/ 再生成
Xcode で確認 (Step 6)
  ↓ Signing & Capabilities で iCloud が緑チェック
実機ビルド・動作確認 (Step 7)
```

## Step 1: Apple Developer サイトで App ID を確認・更新

[Apple Developer Account](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Identifiers**

1. `com.nokata.modrift` の App ID が存在するか確認
   - 無ければ「+」→ App IDs → App を選択して新規作成
   - Bundle ID は **Explicit** で `com.nokata.modrift`
2. 当該 App ID を開く → **Capabilities** タブで **iCloud** をチェック
3. **iCloud Services**: 「Include CloudKit support」は **不要** (Modrift は CloudKit を使わない、CloudDocuments のみ)

> **Personal Team では iCloud capability の有効化自体ができない**。「You don't have permission」が出る場合は加入処理がまだ反映されていない可能性が高い。1〜数時間待って再試行。

## Step 2: iCloud Container を作成

**Identifiers** ページ左上のフィルタで **iCloud Containers** に切り替え → 「+」

1. **Description**: `Modrift Documents` (任意、運営者向けラベル)
2. **Identifier**: `iCloud.com.nokata.modrift`
3. Continue → Register

## Step 3: App ID に Container を紐付け

1. **Identifiers** → **App IDs** に戻り、`com.nokata.modrift` を開く
2. **iCloud** Capability の右の **Configure** または **Edit** をクリック
3. Step 2 で作成した `iCloud.com.nokata.modrift` にチェックを入れて Save
4. Provisioning Profile の再生成は Xcode の自動署名が次回ビルド時にやってくれる (手動操作不要)

## Step 4: `app.json` を更新

[app.json](../app.json) の `ios` ブロックに entitlements と `NSUbiquitousContainers` を追加。

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.nokata.modrift",
      "entitlements": {
        "com.apple.developer.icloud-container-identifiers": [
          "iCloud.com.nokata.modrift"
        ],
        "com.apple.developer.icloud-services": ["CloudDocuments"],
        "com.apple.developer.ubiquity-container-identifiers": [
          "iCloud.com.nokata.modrift"
        ]
      },
      "infoPlist": {
        "LSSupportsOpeningDocumentsInPlace": true,
        "CFBundleDocumentTypes": [
          {
            "CFBundleTypeName": "Markdown Document",
            "LSHandlerRank": "Alternate",
            "LSItemContentTypes": [
              "net.daringfireball.markdown",
              "public.plain-text"
            ]
          }
        ],
        "NSUbiquitousContainers": {
          "iCloud.com.nokata.modrift": {
            "NSUbiquitousContainerIsDocumentScopePublic": true,
            "NSUbiquitousContainerSupportedFolderLevels": "Any",
            "NSUbiquitousContainerName": "Modrift"
          }
        }
      }
    }
  }
}
```

### 設定の意味

| キー | 意味 |
| --- | --- |
| `icloud-container-identifiers` | このアプリが使う Container ID。複数可 |
| `icloud-services` | `CloudDocuments` のみ (CloudKit は使わない) |
| `ubiquity-container-identifiers` | 上と通常同じ値。File Provider 統合のため |
| `NSUbiquitousContainerIsDocumentScopePublic` | `true` で Files App に「Modrift」フォルダが見える |
| `NSUbiquitousContainerSupportedFolderLevels` | `Any` でユーザーが自由にサブフォルダを作れる |
| `NSUbiquitousContainerName` | Files App 上に表示される名前 |

## Step 5: `expo prebuild` で iOS プロジェクト再生成

```bash
npx expo prebuild --platform ios --clean
```

`--clean` で `ios/` を一旦削除して再生成する。**既存の `ios/` への手動変更は失われる** ので注意 (本リポジトリは現状そういう変更を入れていないので問題なし)。

生成後、自動で `pod install` が走る。

## Step 6: Xcode で iCloud capability を確認

```bash
open ios/modrift.xcworkspace
```

1. プロジェクトナビゲータで `modrift` ターゲットを選択
2. **Signing & Capabilities** タブを開く
3. **iCloud** capability が表示されていることを確認
4. **iCloud Documents** がチェックされていることを確認
5. **Containers** に `iCloud.com.nokata.modrift` が緑チェックで表示されていることを確認

> 赤い `!` が出る場合は Step 3 の紐付けがまだ反映されていない or 別の Team が選ばれている。Signing タブで Team が正しい有料アカウントになっているか確認し、`Try Again` ボタンを押す。

## Step 7: 実機での動作確認

Xcode で実機にビルド・インストールして起動 (`Cmd + R`)。

確認項目:

- [ ] アプリ起動後、iPhone の **Files App** → **iCloud Drive** に **「Modrift」フォルダ** が表示される (空のままで OK、Modrift が一度起動すれば作成される)
- [ ] Modrift 起動状態で iCloud Drive の Modrift フォルダにファイルを置く → ピッカーから開ける
- [ ] Modrift の iCloud コピー編集機能を有効化した実装 (実装後) で、Google Drive の md ファイルから「iCloud にコピーして編集」が動作する

## トラブルシュート

### `Provisioning profile doesn't include the iCloud capability` でビルド失敗
- Step 3 の紐付けが反映されていない or Provisioning Profile が古い
- Xcode の Signing & Capabilities タブで **Automatically manage signing** が ON になっているか確認
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
