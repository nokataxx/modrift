# ビルド・実行・配布ガイド（Debug / Release / TestFlight）

Modrift をビルドして実機・テスターに届けるまでの方法と使い分け・コマンド・つまずきポイントをまとめた決定版。
**App Store の一般公開（本審査）は別ドキュメント** → [app-store-submission-guide.md](app-store-submission-guide.md)。

- 対象: 開発者本人（solo dev）
- 前提: Expo Dev Client / `expo run:ios` でローカルビルド（`ios/` あり）。実機は nokata iPhone（iOS 26）。配布は EAS。Bundle ID は本番 `com.modrift.app`（「Modrift」）と、端末で本番と共存させる開発用 **dev バリアント** `com.modrift.app.dev`（「Modrift Dev」）の2つ（→ [3章のバリアント節](#アプリの名義-本番--dev-バリアント)）

---

## 0. 全体像

届け先は **ローカル実機 / TestFlight / App Store** の3系統。ローカルは Debug / Release に分かれる。

| 方法 | ビルド場所 | 反復速度 | 本番忠実度 | ケーブル | 署名 | 主な用途 |
| --- | --- | --- | --- | --- | --- | --- |
| **Debug + Metro** | ローカル(Mac) | 最速(保存で即反映) | 低(Expoアイコン等) | 起動中ずっと | development | 開発中の即確認 |
| **Release(焼付)** | ローカル(Mac) | 遅(変更ごと再ビルド) | 高(実アイコン) | インストール時だけ | development | 本番挙動の一次検証・持ち歩き |
| **TestFlight** | クラウド(EAS) | 最遅(処理待ち) | 最高(ストアと同一) | 不要(OTA) | Distribution | 配布・最終確認・提出前ゲート |
| **App Store** | クラウド(EAS) | — | 最高 | 不要 | Distribution | 一般公開(要審査) |

```
Debug + Metro   … 書きながら即確認（開発ループ）
     ↓ 機能が固まる
Release ローカル … 自分の実機で本番相当を一次検証（実アイコン・署名・iCloud 等）
     ↓ 落ち着く
TestFlight      … 配布署名で内部配布。本番経路で最終確認（提出前の必須ゲート）
     ↓ 安定
App Store 申請   … 審査へ（別ドキュメント）
```

> 要点: ローカルと TestFlight は競合せず**順番**。速さ＝ローカル、忠実度＝TestFlight。

---

## 1. EAS とは

**EAS = Expo Application Services**。Expo 製アプリの**ビルド・提出をクラウドで肩代わり**するサービス。特に面倒な **iOS 署名（証明書・プロビジョニングプロファイル）を自動管理**してくれるのが価値。

| サービス | 役割 |
| --- | --- |
| **EAS Build** | クラウドで `.ipa` をビルド。署名情報を生成・保管 |
| **EAS Submit** | ビルドを App Store Connect へアップロード |
| EAS Update | JS だけの変更を**審査なしで OTA 配信**（ネイティブ非変更時に再ビルド不要）|

- **ローカル `expo run:ios`** = 自分の Mac でビルド（開発用）
- **`eas build`** = クラウドでビルド（配布用、署名を EAS が管理）

---

## 2. 使い分け（迷ったらここ）

| やりたいこと | 使うもの |
| --- | --- |
| 画面・ロジックをサクサク作る | **Debug + Metro**（シミュレータが最速）|
| **iCloud 同期 / Open In / File Provider** を試す | Debug + Metro（**実機＋ケーブル必須**。シミュレータ不可）|
| アイコン・パフォーマンス・本番挙動の確認、ケーブル抜き常用 | **Release ローカル**（実機）|
| 署名・entitlements（iCloud コンテナ等）を変えた後の検証 | Release ローカル（実機）|
| 配布・他人テスト・提出前の最終確認 | **TestFlight** |

> ざっくり: **書いてる最中は Debug+Metro、出す前に Release で本番確認、配るなら TestFlight。**
> Modrift はコア機能（iCloud / Open In）が実機必須なので「実機 Debug で機能確認 → Release/TestFlight で最終確認」の2段構え。

---

## 3. ローカルビルド詳細（Debug / Release）

| 用途 | ビルド | コマンド | ケーブル | コード変更の反映 |
| --- | --- | --- | --- | --- |
| 開発中 | **Debug + Metro** | `npx expo run:ios --device` ＋ `npx expo start` | 起動中ずっと | 保存で即反映(Fast Refresh) |
| 普段使い | **Release** | `npx expo run:ios --device --configuration Release` | インストール時だけ | 再ビルドが必要 |

> 上の表のコマンドは**本番名義**（`com.modrift.app`）でビルドする。開発中の v1.1 を TestFlight の本番と並べて検証したい場合は、下記の **dev バリアント** で名義を変える。

### アプリの名義: 本番 / dev バリアント

端末は「1つの Bundle ID = 1つのアプリ枠」で、同じ ID は上書きされる。TestFlight の本番（`com.modrift.app`「Modrift」）と開発中のローカルビルドを**並べて共存**させるため、ローカル開発用に別名義の **dev バリアント**（`com.modrift.app.dev`「Modrift Dev」）を用意している。

- **何が違うか**: Bundle ID / 表示名 / scheme（`modrift-dev`）**だけ**。ビルド方法も中身も同じ。共有拡張の ID（`…app.dev.share-extension`）は自動で追従。iCloud コンテナと共有 App Group は本番と共用（テスト用途では問題なし。だから [iCloud をハードコードした箇所](#5-つまずきポイント今回の学び)の変更は不要）。
- **どう切り替えるか**: いつものコマンドの**先頭に環境変数 `APP_VARIANT=development` を付けるだけ**。[app.config.js](../app.config.js) がそれを見て名義を差し替える。

| | 本番名義「Modrift」 | dev 名義「Modrift Dev」 |
| --- | --- | --- |
| **Release ローカル実機** | `npx expo run:ios --device --configuration Release` | `npm run ios:dev` |
| **ネイティブ再生成** | `npx expo prebuild --clean` | `npm run prebuild:dev` |
| **Debug + Metro** | `npx expo run:ios --device` | `APP_VARIANT=development npx expo run:ios --device` |
| **TestFlight / 配布** | `eas build --profile production` | （使わない。`development`/`preview` プロファイルは自動で dev 名義）|

> `npm run ios:dev` / `npm run prebuild:dev` は「いつものコマンド + `APP_VARIANT=development`」を短い名前に包んだだけ（[package.json](../package.json) の scripts）。実体は同じ `expo run:ios` / `expo prebuild`。嫌なら env 付きで直接打っても同じ。
>
> 使い分け: **普段の v1.1 開発・実機検証は dev 名義（`npm run ios:dev`）**で「Modrift Dev」を使い、TestFlight の本番「Modrift」は消さずに隣に置く。配る本番だけ `eas build --profile production`。
>
> ⚠️ 本番名義 ⇄ dev 名義を切り替えた直後は Bundle ID が変わるので、`prebuild`（`npm run prebuild:dev` など）→ 再ビルドが必要。

### Debug + Metro の手順（開発ループ）

1. **iPhone をケーブル接続**（このプロジェクトは Wi-Fi で Metro に繋がらないため有線必須）
2. **Debug ビルドを実機に入れる**
   ```bash
   npx expo run:ios --device
   # 端末を明示するなら: npx expo run:ios --device "00008150-0002131E217A401C"
   ```
3. **Metro を起動**（上のビルドが自動で起動することも多い。別途なら）
   ```bash
   npx expo start
   ```
4. アプリ起動後、**コードを保存するたび即反映**（Fast Refresh）
   - 反映されない時（ナビ設定等）は iPhone を**シェイク → Reload**
5. 開発中は**ケーブルを繋ぎっぱなし**。抜くと Metro 接続が切れて起動できない（正常）

> UI だけならシミュレータが最速: `npx expo run:ios`（`--device` なし）。ただし **iCloud / Open In は実機が必要**。

### Release（単体）の手順（本番相当の確認・持ち歩き）

1. **iPhone をケーブル接続**
2. **Release ビルド＆インストール**
   ```bash
   npx expo run:ios --device --configuration Release
   ```
3. **アプリが iPhone で自動起動するまで待つ**（ビルド〜インストール完了の合図）
4. 自動起動を確認したら **ケーブルを抜いてOK**。以降はホーム画面のアイコンから単体起動
   - 本物のアイコン（M）で起動する（Debug の Expo アイコンとは別物）
5. コードを直したら、反映には**再ビルド**（手順2を再実行）

> ⚠️ 新しい Bundle ID の初回や署名変更後は、`expo run:ios` がプロファイルを自動生成できず「No profiles found」で失敗することがある（→ 5章）。その場合は一度だけ
> `xcodebuild -workspace ios/modrift.xcworkspace -scheme modrift -configuration Release -destination 'id=<UDID>' -allowProvisioningUpdates build`
> でプロファイル・App ID・iCloud コンテナを作成してから、`xcrun devicectl device install app` で入れる。

### なぜ2種類あるのか
RN アプリは「ネイティブの殻(.app)」＋「JS バンドル」の2層。JS の供給方法が違う。

- **Debug** = JS を **Mac の Metro(`expo start`) からネット越しに読む**。起動のたび Metro 接続が必要。繋がっていれば保存で即反映。切れると「Error loading app」「No development servers found」。
- **Release** = JS を **アプリ内に焼き込む**。Metro も Mac も不要で単体起動。そのぶん変更は再ビルドしないと反映されない。

> このプロジェクトの注意: 本機環境では **Wi-Fi 経由で Metro に繋がらない**（LAN自動検出・手動URL・tunnel いずれも不通）。Debug 開発中は**ケーブルを繋ぎっぱなし**にするのが確実。抜くと起動できなくなる(正常な挙動)。

> アイコンの注意: **Debug 開発ビルドはホーム画面が Expo アイコン**（dev-client の仕様）。**本物のアイコン(M)は Release / TestFlight でのみ**表示される。

### Release のケーブル
- 必要なのは **ビルド〜インストールの瞬間だけ**。アプリが iPhone で自動起動したのを確認したら**抜いてOK**。
- 途中で抜くと入りきらず古い版が残る → 自動起動まで待つ。

---

## 4. TestFlight 配信

クラウド(EAS)で配布署名のビルドを作り、App Store Connect 経由で内部配布する。

### 4-1. 一度きりの登録（セットアップ）

| # | やること | 頻度 |
| --- | --- | --- |
| 1 | Apple Developer Program 加入（年 $99）| 1回(年更新) |
| 2 | **App レコード作成**（App Store Connect で Bundle ID `com.modrift.app` を登録。User Access は **Full Access**）| アプリごと1回 |
| 3 | **PLA（使用許諾契約）に同意**（developer.apple.com のバナー）| 契約更新時 |
| 4 | **EAS プロジェクトをリンク**（`eas init`）| プロジェクトごと1回 |
| 5 | **署名情報生成**（証明書・プロファイル。`eas build` 初回に Apple ログイン→EAS が自動生成・保管）| 1回 |
| 6 | **ASC API キー生成**（`eas submit` 初回に「Generate? → Yes」「role: ADMIN」）| 1回 |

> **5・6 の Apple 認証(2FA)は一度きり**。以降 EAS が保管し非対話で回せる。
> ⚠️ 新しい Bundle ID で初めてビルドするときは **PLA 同意が未だと「PLA Update available」で失敗**する（新規 App ID/プロファイル作成がブロックされる）。先に同意しておく。

### 4-2. 毎回の配信フロー

```bash
# 1. クラウドで本番ビルド（.ipa 生成、約5〜40分）
eas build --platform ios --profile production

# 2. App Store Connect へアップロード（数分）
eas submit --platform ios --profile production --latest

# まとめてやるなら
eas build --platform ios --profile production --auto-submit
```

3. **Apple の処理(Processing)**: 数分〜30分。終わるまで TestFlight に **「No Builds」** 表示（＝処理中で正常）。
4. **内部テストグループ**: EAS が「Team (Expo)」グループを自動作成・割当。
5. **テスター招待メール**（"…has invited you to test Modrift"）が届く＝配信準備完了の合図。

- `eas.json` は `appVersionSource: remote` + `production.autoIncrement: true`。**ビルド番号は EAS が自動採番**（TestFlight は同番号を二度受け付けないため重要）。
- バージョン表記(1.0.0→1.0.1)を上げるのは公開の節目だけ。TestFlight 反復はビルド番号自動採番で回る。

### 4-3. 内部テストでは「不要」なもの

内部テスト（自分・チーム）では、App Store 審査で要るものが**不要**:
- スクリーンショット / ストア掲載文 / プライバシー・サポートURL公開 / App プライバシー申告 / カテゴリ・価格・年齢制限
- 「Add Test Information」⚠️ は**外部テスト用**。内部では無視でOK
- 輸出コンプライアンスは `ITSAppUsesNonExemptEncryption: false` 済みで自動スキップ

### 4-4. 実機での実行（インストール）

1. iPhone に **TestFlight アプリ**（App Store から無料）を入れてサインイン
2. 招待メールの「View in TestFlight」or TestFlight アプリを開く
3. Modrift が **「Ready to Test」** → **INSTALL**（既存なら UPDATE / OPEN）
4. **OPEN** で起動 → 動作確認（iCloud同期 / Open In / 自動保存）

- すべて**無線**（ケーブル不要）。
- 上書きは**同じ Bundle ID 同士だけ**。TestFlight の本番（`com.modrift.app`）とローカルの **dev バリアント**（`com.modrift.app.dev`「Modrift Dev」）は別アプリなので**共存**する（端末に「Modrift」と「Modrift Dev」が並ぶ）。本番名義のローカル Release を入れた場合は TestFlight 版と同じ枠で上書きになる。

---

## 5. つまずきポイント（今回の学び）

| 表示・状況 | 意味・対処 |
| --- | --- |
| App Store タブ「**Prepare for Submission**」 | 一般公開用の初期状態。TestFlight とは無関係、今は無視 |
| TestFlight「**No Builds**」 | アップロード後の**処理中**。10〜30分待つ |
| メール「**invited you to test**」 | テスター招待＝配信準備完了 |
| TestFlight「**Ready to Test**」 | インストール可能 |
| 実機に **「Modrift」と「Modrift Dev」が2つ** | dev バリアントによる**意図した共存**（本番 `com.modrift.app` ＋ dev `com.modrift.app.dev`）。正常。不要な旧 ID だけ消すなら `xcrun devicectl device uninstall app --device <id> <bundleId>` |
| ローカルビルドが「**No profiles for 'com.modrift.app'**」 | 新 Bundle ID の初回プロビジョニング。`expo run:ios` は `-allowProvisioningUpdates` を渡さないので失敗 → 直接 `xcodebuild ... -allowProvisioningUpdates build` で作成、または EAS に任せる |
| 「**PLA Update available**」 | 使用許諾契約が未同意。developer.apple.com で同意 |
| Bundle ID を変えた時 | `app.json` だけでなく、**iCloud コンテナをハードコードしている箇所**（`modules/icloud-container/ios/IcloudContainerModule.swift`、`src/lib/file-location.ts`）も更新が必要。漏れると iCloud が動かない |

---

## 6. 署名と有効期限

- 無料の Apple ID 署名: Debug/Release とも **7日で期限切れ** → 入れ直し。
- **有料 Apple Developer Program**: 1年持つ。
- ローカル(development 署名・自分の実機専用)と TestFlight(Distribution 署名・EAS 管理)は**別物**。同じ Release configuration でも経路が違う。
- ネイティブ設定（`app.json` の `ios.*`、ネイティブモジュール、Bundle ID 等）を変えたら **`expo prebuild --clean` ＋ 再ビルド**が必須（JS の Fast Refresh では反映されない）。

---

## 7. トラブルシュート

| 症状 | 原因 | 対処 |
| --- | --- | --- |
| 「Error loading app」「No development servers found」 | Debug 版が Metro に繋がっていない | `expo start` を起動し、ケーブル接続のまま再読み込み。単体起動したいなら Release |
| Xcode「debug session ended … disconnected」 | ケーブルを抜いてデバッガ切断 | 故障ではない。OK で閉じてよい |
| コードを直したのに反映されない | Release(焼付)版で動いている | Debug+Metro に切替、または Release 再ビルド |
| `submit` で「build number already used」 | 同じビルド番号を再提出 | `autoIncrement: true` を確認 |
| TestFlight にビルドが出ない | Processing 中 or 輸出コンプライアンス未回答 | 10〜30分待つ。`ITSAppUsesNonExemptEncryption: false` を確認 |
| 認証の対話が毎回出る | API キー未登録 | `eas submit` 初回で API キーを生成・保管させる |

---

## 8. App Store 一般公開（次の段階）

TestFlight で安定したら、**同じ production ビルド**を審査に出す（再ビルド不要）。追加で必要なのはスクショ・掲載文・プライバシー申告・審査メモなど。
→ 手順は [app-store-submission-guide.md](app-store-submission-guide.md) を参照。

---

## 9. 次回からは速い

セットアップ（4-1）は完了済み。2回目以降は:

```
コード修正 → eas build → eas submit → (処理待ち) → TestFlight で更新
```

認証は保存済みで 2FA も不要。**コマンド2つで TestFlight 更新**できる。
JS だけの修正なら `eas update`（OTA）で再ビルドすら省ける。
