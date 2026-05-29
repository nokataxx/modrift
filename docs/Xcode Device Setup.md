# Xcode で iPhone 実機にアプリをセットする手順

Modrift を **iPhone 実機** にインストールして動かすための手順書。

- **対象**: 開発者本人 (solo dev)
- **作成日**: 2026-05-29
- **前提アプリ構成**: Expo SDK 56 + React Native New Architecture (Fabric)、Dev Client 必須

## なぜ Xcode 実機ビルドが必要か

Modrift は **Expo Go では動作しない**。Markdown 表示に使う `react-native-enriched-markdown` (ネイティブモジュール) が含まれるため、**Expo Dev Client** という独自のネイティブアプリを実機にビルドして入れる必要がある。

実機での開発は **2 つの要素** で成り立つ:

1. **Dev Client アプリ本体** … Xcode から実機にビルド & インストール (本手順の Step 1〜7)
2. **Metro バンドラ** … JS コードを配信する開発サーバ。`npx expo start` で起動 (Step 8)

一度 Dev Client を実機に入れれば、以降の JS の変更は Metro 経由でホットリロードされる。**ネイティブ依存 (新しい native ライブラリ追加や `app.json` の native 設定変更) を加えたときだけ** Xcode で再ビルドが必要。

## 前提条件 (用意するもの)

| 項目 | 要件 |
|---|---|
| Mac | macOS + Xcode 26 以降 (検証環境: Xcode 26.5) |
| iPhone | iOS 16 以降 (Modrift のターゲット下限) |
| ケーブル | Mac と iPhone を繋ぐ USB-C / Lightning ケーブル (初回は有線推奨) |
| Apple ID | 無料 Apple ID で可。詳細は下記「署名 (Signing) について」 |
| CLI ツール | Node 22 / CocoaPods (検証環境: Node 22.17, CocoaPods 1.16.2) |

### 署名 (Signing) について

- **無料 Apple ID (Personal Team)**: 自分の実機にインストール可能。ただし **証明書が 7 日で失効** するため、1 週間ごとに Xcode から再ビルドが必要。同時にインストールできるアプリは 3 つまで。**まず動かしてみる用途ならこれで十分**。
- **Apple Developer Program ($99/年)**: 証明書が 1 年有効。TestFlight 配布もこちらが必須。本格運用・配布時はこちら。

> 注: 上の表とは別に、App Store / TestFlight への**配布**には Apple Developer Program が必須 (`CLAUDE.md` 参照)。本手順は「自分の iPhone で動かす」までをカバーする。

## 手順

### Step 0: `ios/` フォルダを用意する (初回 / クローン直後のみ)

`ios/` は **git 管理外 (gitignore 対象)** で、Expo が生成するフォルダ。すでに `ios/modrift.xcworkspace` が存在するならこの Step は不要。無い場合 (新規クローンなど) はプロジェクトルートで生成する。

```bash
npm install
npx expo prebuild --platform ios
```

`prebuild` は `app.json` の設定 (Bundle ID, Info.plist, plugins) を native プロジェクトに反映し、CocoaPods (`pod install`) まで実行する。

### Step 1: iPhone を Mac に接続し、開発者モードを有効化

1. ケーブルで iPhone を Mac に接続する。
2. iPhone に「このコンピュータを信頼しますか?」が出たら **信頼** をタップ、パスコード入力。
3. iOS 16 以降は **開発者モード (Developer Mode)** の有効化が必要:
   - iPhone の `設定 > プライバシーとセキュリティ > デベロッパモード` をオンにする。
   - (この項目は、一度 Xcode から実機ビルドを試みると表示されるようになる場合がある)
   - オンにすると **再起動を促される** ので再起動し、起動後に確認ダイアログで許可する。

### Step 2: Xcode で `.xcworkspace` を開く

**必ず `.xcworkspace` を開く** (`.xcodeproj` ではない)。CocoaPods を使っているため workspace でないと依存がリンクされない。

```bash
open ios/modrift.xcworkspace
```

### Step 3: Signing (署名) を設定する

1. 左ペイン最上部のプロジェクト **modrift** を選択。
2. `TARGETS > modrift` を選び、**Signing & Capabilities** タブを開く。
3. **Automatically manage signing** にチェック。
4. **Team** で自分の Apple ID を選択する。
   - 候補に無ければ `Add an Account...` → Apple ID でサインイン (無料 Apple ID で可)。
5. **Bundle Identifier** が `com.nokata.modrift` であることを確認。
   - 無料 Apple ID で「すでに使われている」等のエラーが出たら、`com.nokata.modrift.dev` のように **末尾を変えて一意にする** とビルドが通る (実機テスト用途なら問題なし)。

### Step 4: ビルドターゲットに実機を選択

Xcode 上部 (ツールバー) の実行先 (Run Destination) ドロップダウンで、シミュレータではなく **接続した iPhone の名前** を選ぶ。

### Step 5: ビルド & インストール

- `Cmd + R` を押す (または ▶ ボタン)。
- 初回は CocoaPods の依存ビルドを含むため数分かかる。
- 完了すると iPhone に Modrift (Dev Client) アプリがインストールされる。

### Step 6: 「デベロッパ」を信頼する (初回起動時)

無料 / 個人 Team の証明書は OS が初期状態で信頼していないため、アプリ起動が弾かれることがある。

1. iPhone の `設定 > 一般 > VPN とデバイス管理`。
2. 「デベロッパ App」配下に自分の Apple ID が出ているのでタップ。
3. **信頼** を選択。
4. もう一度アプリを起動する。

### Step 7: Metro バンドラを起動して接続

Dev Client アプリだけでは JS が無いので、**開発サーバ (Metro) を起動**する。プロジェクトルートで:

```bash
npx expo start --dev-client
```

- Mac と iPhone が **同じ Wi-Fi** にいること。
- iPhone で Modrift アプリを開くと、自動的に Metro に接続して画面が表示される。
- ターミナルの QR コードを iPhone のカメラで読むか、アプリ内の開発メニューから手動で接続先を指定することもできる。

## 2 回目以降の起動

ネイティブ変更が無ければ Xcode は不要。

```bash
npx expo start --dev-client
```

を起動し、iPhone で Modrift アプリを開くだけでよい。

**再ビルド (Xcode から) が必要になるケース**:

- 新しいネイティブライブラリを追加した
- `app.json` の native に影響する設定 (Bundle ID, Info.plist, plugins 等) を変えた → `npx expo prebuild` し直してから再ビルド
- 無料 Apple ID で 7 日が経過し証明書が失効した

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| `Signing for "modrift" requires a development team` | Step 3 で Team を選択する |
| Bundle ID 重複でビルド不可 (無料 Apple ID) | Bundle Identifier の末尾を変えて一意にする (例 `com.nokata.modrift.dev`) |
| `Untrusted Developer` でアプリが起動しない | Step 6 のデバイス信頼を実施 |
| 開発者モード関連で実機が選べない / インストール不可 | Step 1 の Developer Mode を有効化して再起動 |
| `pod install` 系のエラー | `cd ios && pod install` を手動実行。改善しなければ `npx expo prebuild --clean --platform ios` |
| `Could not connect to development server` | Mac と iPhone が同じ Wi-Fi か確認。`npx expo start --dev-client` が起動中か確認。ファイアウォールでブロックされていないか確認 |
| 7 日後にアプリが起動しなくなった | 無料 Apple ID の証明書失効。Xcode から再ビルド (`Cmd + R`)。恒久対応は Apple Developer Program |
| ビルドは通るが古い画面のまま | Metro のキャッシュ。`npx expo start --dev-client -c` でキャッシュクリア |

## 補足: EAS Build という選択肢

Mac の Xcode を使わずにクラウドでビルドする方法もある (`eas.json` に development プロファイル定義済み)。

```bash
eas build --profile development --platform ios
```

ただし実機向けには Apple Developer Program と端末登録 (UDID) が必要。**手元の Mac で完結させたい場合は本手順 (Xcode 実機ビルド) が最短**。
