# ビルドと配布 (ローカル実機 / TestFlight / App Store)

Modrift をビルドして実機・テスター・一般ユーザーに届けるまでの **4 つの方法** (Debug / Release ローカル / TestFlight / App Store) の違いと使い分け、コマンド、トラブルシュートをまとめる。

- **対象**: 開発者本人 (solo dev)
- **作成日**: 2026-06-05
- **前提**: Expo Dev Client / `expo run:ios` でローカルビルド (`ios/` フォルダあり)。iOS 26 実機 (nokata iPhone)。配布は EAS Build / App Store Connect
- **関連**: [Requirements.md](Requirements.md) 11章 (受け入れ基準・配布面)

## 配布方法の全体像と役割

ビルドの届け先は大きく **ローカル実機 / TestFlight / App Store** の 3 系統。ローカルはさらに Debug / Release に分かれるので、実質 4 つ。

| 方法 | ビルド場所 | 届け方 | 署名 | ケーブル | 主な用途 |
| --- | --- | --- | --- | --- | --- |
| **Debug + Metro** | ローカル (Mac) | ケーブルで実機に直接 | development | **起動中ずっと** | コードを書いて即確認 (開発中) |
| **Release (焼付)** | ローカル (Mac) | ケーブルで実機に直接 | development | インストール時だけ | 自分の実機で素早く検証・持ち歩き |
| **TestFlight** | クラウド (EAS Build) or Xcode Archive | App Store Connect 経由で **OTA 配信** | **Distribution (配布署名)** | 不要 | テスター配布・**App Store 提出前の必須ゲート** |
| **App Store** | 同上 | 審査通過後に一般公開 | Distribution | 不要 | 一般リリース |

### 役割の違い (なぜ使い分けるか)

- **Debug / Release (ローカル)** は「**Mac から自分の実機へケーブルで入れる**」点が共通。手元で完結し、待ち時間がほぼないので、**開発と一次検証**に向く。TestFlight のようなアップロード・審査処理待ちがない。
- **TestFlight** は「**配布署名でビルドして App Store Connect 経由で OTA 配信する**」もの。ローカル焼付では検証できない次の点を確認できる:
  - 本番と同じ **Distribution provisioning / 配布署名** が通るか
  - ケーブルなし・OTA でのインストール体験 (実ユーザーと同じ経路)
  - クラッシュレポート収集、ビルド番号管理
  - これは [Requirements.md](Requirements.md) 11章の配布基準 `TestFlight に内部配布できている` を満たすステップでもある。
- **App Store** は TestFlight と同じ成果物 (アーカイブ) を **審査に出して一般公開**する最終段階。

### 進める順序

```
1. Debug + Metro     … コードを書いて即確認 (開発ループ)
       ↓ 機能が固まる
2. Release ローカル   … 自分の実機で受け入れ基準を素早く潰す ← 一次検証はここが速い
       ↓ バグが落ち着く
3. TestFlight        … 配布署名で内部配布、本番に近い経路で検証 (提出前の必須ゲート)
       ↓ 安定
4. App Store 申請     … スクショ・申請文・Privacy Manifest を添えて審査へ
```

> **要点**: ローカル焼付と TestFlight は競合せず**順番**。ローカルで素早く一次検証 → 落ち着いたら TestFlight で配布経路ごと検証、という流れ。TestFlight をスキップして App Store には出せない (11章の配布基準に含まれる)。

> TestFlight 配布の具体手順 (EAS Build、`eas submit`、App Store Connect) は後半の [TestFlight 配布手順](#testflight-配布手順) を参照。

## ローカルビルドの使い分け (Debug / Release)

ここから先は、上表のうち **ローカル実機ビルド (Debug / Release)** の詳細。TestFlight / App Store は範囲外。

| 用途 | ビルド | コマンド | ケーブル | コード変更の反映 |
| --- | --- | --- | --- | --- |
| 開発中 (コードを直して即確認) | **Debug + Metro** | `npx expo run:ios --device` ＋ `npx expo start` | **起動中ずっと必要** | 保存で即反映 (Fast Refresh) |
| 普段使い (Mac なしで単体起動) | **Release (焼き込み)** | `npx expo run:ios --device --configuration Release` | **インストール時だけ** | 再ビルドが必要 |

迷ったら: **コードをいじる間は Debug、完成したものを持ち歩くなら Release**。

## なぜ 2 種類あるのか

React Native アプリは「ネイティブの殻 (.app)」と「JS コード (バンドル)」の 2 層でできている。この JS をどう供給するかが Debug と Release で違う。

### Debug ビルド = JS を Metro から読む

- JS を **Mac の Metro サーバー (`expo start`) からネットワーク越しに読み込む**。
- アプリ内に JS を埋め込まないので、**起動のたびに Metro への接続が必要**。
- 接続が生きていればコードを保存するたび即反映される (Fast Refresh)。開発に最適。
- 接続できないと「**Error loading app**」「**No development servers found**」になる。

```bash
# 1. Debug ビルドを実機に入れる (ケーブル接続)
npx expo run:ios --device

# 2. Metro を起動しておく (ビルドが自動で起動することも多い)
npx expo start
```

> **このプロジェクトの注意**: 本機の環境では **Wi-Fi 経由で Metro に繋がらない** (LAN 自動検出・手動 URL・tunnel いずれも不通)。そのため Debug で開発する間は **ケーブルを繋ぎっぱなし**にして Metro へ繋ぐのが確実。ケーブルを抜くと Metro 接続が切れて起動できなくなる (これは正常な挙動)。

### Release ビルド = JS を焼き込む (埋め込む)

- ビルド時に **JS をアプリ内に埋め込む (焼き込む)**。
- 起動に **Metro も Mac も不要**。ケーブルを抜いても単体で動く。
- そのぶん **コードを変更しても反映されない** → 反映するには再ビルドが必要。

```bash
# ケーブル接続した状態で実行
npx expo run:ios --device --configuration Release
```

- ケーブルが必要なのは **ビルド〜インストールの瞬間だけ**。
- インストール後、iPhone でアプリが自動起動したのを確認したら **ケーブルを抜いてOK**。以降はホーム画面のアイコンからいつでも起動できる。
- **重要**: ビルド完了 (アプリが iPhone で自動起動) まで待ってからケーブルを抜く。途中で抜くと入りきらず、古い Debug 版のまま残る。

## 署名と有効期限

- 署名が **無料の Apple ID** の場合、Debug / Release どちらのビルドでもアプリは **7 日で期限切れ** になり、再インストールが必要。
- **有料の Apple Developer Program ($99/年)** なら 1 年持つ。
- 期限切れ時はアイコンをタップしても一瞬で閉じる / 「App を検証できません」等が出る → 同じコマンドで入れ直す。

## トラブルシュート

| 症状 | 原因 | 対処 |
| --- | --- | --- |
| 「Error loading app」 | Debug 版が Metro に繋がっていない | Mac で `npx expo start` を起動し、ケーブル接続のまま再読み込み |
| 「No development servers found」 | 同上 (Metro 未検出) | ケーブル接続を確認。Metro 起動を確認。Debug の宿命なので、単体起動したいなら Release にする |
| Xcode「The debug session ended because … disconnected」 | ケーブルを抜いてデバッガが切断されただけ | **故障ではない**。OK で閉じてよい。アプリ本体には影響なし |
| コードを直したのに反映されない | Release (焼き込み) 版で動いている | Debug + Metro に切り替える。または Release を再ビルド |
| ヘッダー等の変更が Fast Refresh で出ない | ナビゲーション設定は Fast Refresh で更新されないことがある | iPhone を**シェイク → Reload**、またはアプリを完全終了→再起動 |

## 開発フローの目安

1. **コードを試行錯誤する間** → Debug をケーブル接続したまま使う。`expo start` を起動 → 保存で即反映 (反映されなければシェイク→Reload)。
2. **数値や見た目が確定** → Release で焼き直して、ケーブルなしで普段使い。
3. **次に修正したくなったら** → また Debug に戻すか、Release を再ビルド。

## TestFlight 配布手順

ここからは、上の「ローカルビルド」とは別系統。**クラウド (EAS Build) で配布署名のビルドを作り、App Store Connect 経由で TestFlight に内部配布する**手順。ローカルで受け入れ基準を一次検証し終えた後に行う ([Requirements.md](Requirements.md) 11章の配布基準を満たすステップ)。

### 前提

- **Apple Developer Program ($99/年) 加入済み** (配布署名に必須)
- **Expo (EAS) アカウント** にログイン済み
- `eas.json` に `production` ビルドプロファイルと `submit.production` がある (本リポジトリは設定済み)
  - `appVersionSource: "remote"` … バージョン/ビルド番号は EAS 側で管理
  - `production.autoIncrement: true` … ビルド番号は毎回自動で +1 (TestFlight は同じビルド番号を二度受け付けないため重要)

### Step 1: eas-cli を用意してログイン

eas-cli はローカル未インストールなので `npx eas-cli` で実行する (グローバル導入なら `npm install -g eas-cli`)。

```bash
npx eas-cli login        # Expo アカウントでログイン
npx eas-cli whoami       # ログイン確認
```

### Step 2: 本番ビルドを作成 (配布署名)

```bash
npx eas-cli build --platform ios --profile production
```

- **初回は対話で iOS の認証情報セットアップが走る**。EAS に Apple アカウントでログインすると、**Distribution 証明書**と **App Store 用 Provisioning Profile** を EAS が自動生成・管理する (ローカル焼付の development 署名とは別物)。
- ビルドはクラウドで実行され、完了すると `.ipa` が EAS 上に生成される (数分〜十数分)。
- `appVersionSource: remote` + `autoIncrement` により、ビルド番号は EAS が自動採番する。

> App Store Connect にアプリレコード (Bundle ID `com.modrift.app`) がまだ無い場合は、次の `submit` 時に対話で作成できる。手動で作るなら [App Store Connect](https://appstoreconnect.apple.com) → My Apps → + で先に登録しておく。

### Step 3: TestFlight に提出 (submit)

ビルド完了後、最新ビルドを App Store Connect に送る:

```bash
npx eas-cli submit --platform ios --latest --profile production
```

- 初回は **App Store Connect API キー** (推奨) か Apple ID を対話で設定。API キーを使うと以降は非対話で回せる。設定値は `eas.json` の `submit.production` に `ascApiKeyPath` / `ascApiKeyId` / `ascApiKeyIssuerId` / `ascAppId` / `appleTeamId` として記録できる。
- 内部テストグループに直接追加するなら `-g`:
  ```bash
  npx eas-cli submit --platform ios --latest -g "Internal Testers" --what-to-test "iCloud コピー編集と自動保存の確認"
  ```

**ビルドと提出をまとめて**行うなら `--auto-submit`:

```bash
npx eas-cli build --platform ios --profile production --auto-submit
```

### Step 4: App Store Connect での処理 → TestFlight 配信

1. 提出後、**App Store Connect 側で 10〜30 分の処理 (Processing)** が走る。完了するとビルドが TestFlight タブに現れる。
2. **輸出コンプライアンス** (暗号化の質問) に回答 (標準的な HTTPS のみなら「対象外」で進められることが多い。`app.json` に `ITSAppUsesNonExemptEncryption: false` を入れておくと毎回の質問を省略できる)。
3. **内部テスト (Internal Testing)**: App Store Connect → TestFlight → 内部テスターに自分の Apple ID を追加。内部テスターは審査不要で即配信される (最大 100 名)。
4. テスターの iPhone に **TestFlight アプリ**を入れ、招待を受けるとアプリをインストールできる (**ケーブル不要・OTA**)。

> **内部テスト vs 外部テスト**: 自分や少人数の確認は審査不要の**内部テスト**で十分。不特定多数に配るときだけ Apple の**ベータ審査**が要る**外部テスト**を使う。MVP の一次配布は内部テストで OK。

### Step 5: 次のビルドを上げるとき

- コードや `app.json` を直したら **Step 2〜3 を再実行**するだけ。`autoIncrement` でビルド番号は自動更新される。
- バージョン表記 (`1.0.0` → `1.0.1` 等) を上げるのは App Store 公開の節目で。TestFlight の反復はビルド番号の自動採番だけで回せる。

### TestFlight トラブルシュート

| 症状 | 原因 | 対処 |
| --- | --- | --- |
| `submit` で「build number already used」 | 同じビルド番号を再提出した | `production.autoIncrement: true` を確認。ローカルで番号固定していないか確認 |
| TestFlight にビルドが出てこない | Processing 中、または輸出コンプライアンス未回答 | 10〜30 分待つ。App Store Connect で暗号化の質問に回答 |
| `Invalid ascAppId` | App Store Connect App ID の指定誤り | 数字のみの App ID を確認 ([expo.fyi/asc-app-id](https://expo.fyi/asc-app-id)) |
| 認証情報の対話が毎回出る | API キー未登録 | App Store Connect API キーを作成し `eas.json` の `submit.production` に登録 |

## App Store 申請 (TestFlight の後)

TestFlight で安定したら、同じ production ビルドを審査に出す。TestFlight 提出時点で大半の素材は揃っているので、追加で必要なのは主に審査・公開まわり:

- スクリーンショット (6.7" / 6.5" など必須サイズ)、説明文、キーワード、サポート URL
- **Privacy Manifest / プライバシー情報** (データ収集の有無の申告)
- レビュアー向けノート (アプリ目的・使い方。シンプルすぎるアプリはここで補足)
- App Store Connect で「審査へ提出」。`eas submit` で送ったビルドをそのまま審査対象に選べる。

詳細手順は申請時に別途まとめる。

## 関連メモ

- ライブ反映 (Fast Refresh) が効くのは **Debug + Metro** のときだけ。Release は静的スナップショット。
- ネイティブ設定 (`app.json` の `ios.infoPlist` 等) を変えた場合は、Debug/Release どちらでも **再ビルドが必須** (JS の Fast Refresh では反映されない)。
- **ローカル焼付 (Release) と TestFlight は署名が別**。ローカルは development 署名 (自分の実機専用)、TestFlight は Distribution 署名 (EAS が管理)。同じ Release configuration でも経路が違う。
