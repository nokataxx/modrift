# ストア用スクリーンショット撮影レシピ（シミュレータ・全自動）

毎リリースで App Store 用スクショ（iPhone 6.9" / iPad 13"）を**シミュレータだけで**撮るための手順。実機は不要。
出力は `store-assets/screenshots/`（`iphone-69-0N-*.png` 1320×2868 / `ipad-13-0N-*.png` 2064×2752）。

## 何がキモか（ハマりどころ）

- アプリは **dev-client ビルド**。dev-client は起動時に **expo-dev-launcher** が動き、Metro に繋ぐか埋め込みバンドルをロードする。
- **Metro に繋いだ状態だと `modrift-dev://` の openurl を dev-launcher が横取り**してアプリ内ルーティングに渡らない → 画面遷移できない。
- **埋め込みバンドルをロードした状態なら、`modrift-dev://` openurl がアプリ内遷移する（確認ダイアログも出ない）** = これが iPhone で撮れていた本体。
- production standalone は直接描画するが、`modrift://`(標準スキーム) の openurl は毎回 iOS の「Open in modrift?」確認ダイアログが出て**タップ不可の自動化では詰む**。→ **dev-client＋埋め込みで撮るのが正解**。
- **⚠️ シミュレータの当たり外れ**: 一部の sim はネットワーク/状態が壊れており、dev-launcher が接続チェックでハングして埋め込みにフォールバックできず**真っ白**になる。**別の sim に変えると一発で直る**（実際 iPad Pro 13" iOS 26.2 はダメ・iOS 26.4 はOK）。真っ白なら sim を疑う。
- タップ自動化ツール（idb/maestro）は本環境に無い。`xcrun simctl` にタップは無い。**タップ不要で完結させる**のが条件。

## 前提（1回だけ用意）

1. **埋め込みバンドル入りの dev アプリ**が対象 sim に入っていること。作り方は下の「埋め込みバンドルの作成」。
2. 対象 sim（6.9" iPhone / 13" iPad）が**健全**であること（真っ白なら別 sim）。
3. 撮影中は **Metro を止める**（dev-launcher に埋め込みを読ませるため）。

## 手順

### 1. v1.5 の JS 埋め込みバンドルを作る

```sh
APP_VARIANT=development npx expo export:embed \
  --platform ios --dev false \
  --bundle-output /tmp/mod/main.jsbundle \
  --assets-dest /tmp/mod/assets
```

### 2. dev アプリの埋め込みバンドルを差し替える

対象 sim にインストール済みの `ModriftDev.app` の `main.jsbundle` を上書き（アプリ本体パスは `xcrun simctl get_app_container <UDID> com.modrift.app.dev app`）。
※ Debug の `run:ios` は埋め込みバンドルを持たない場合がある。その時は `--configuration Release`（dev variant）でビルドすると `main.jsbundle` を持つ。差し替え方式なら JS だけ最新化できる。

### 3. Metro を全部止める

```sh
lsof -nP -iTCP:8081 -sTCP:LISTEN   # pid を確認して kill（8082/8083 等も）
```

### 4. コンテナを整える（ローカルホーム＋見栄えするサンプル）

- `Library/Application Support/com.modrift.app.dev/RCTAsyncLocalStorage_V1/manifest.json` の `modrift:settings` に
  `{"appearance":"light","fontSize":"medium","styleTheme":"navy","homeLocation":"local"}`
- `Documents/` に英語中心の md を数点コピー。**ビューア/エディタ用の映えるサンプルは [samples/screenshot-showcase.md](../samples/screenshot-showcase.md) を `Product Kickoff.md` としてコピー**（見出し・太字/斜体・チェックボックス・引用・コード・表を網羅）。ホーム一覧を賑やかにしたい場合は他の md も数点足す

### 5. 英語キーボード＋ QuickPath 抑制＋クリーンなステータスバー

```sh
xcrun simctl spawn <UDID> defaults write -g AppleLanguages -array "en-US" "ja-JP"
xcrun simctl spawn <UDID> defaults write -g AppleKeyboards -array "en_US@sw=QWERTY;hw=Automatic"
xcrun simctl spawn <UDID> defaults write -g KeyboardContinuousPathEnabled -bool false
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false   # ソフトキーボードを出す
xcrun simctl spawn <UDID> launchctl stop com.apple.SpringBoard                  # 反映のため respring
xcrun simctl status_bar <UDID> override --time "9:41" --batteryState discharging --batteryLevel 100 --cellularBars 4 --wifiBars 3
```

### 6. 撮影（openurl でアプリ内遷移）

`FILE` はコンテナ内 `Documents/Product Kickoff.md` の `file://` を URL エンコードしたもの。

```sh
V="modrift-dev:///viewer?fileUri=<ENC>&fileName=Product%20Kickoff.md&source=home"
# home
xcrun simctl terminate <UDID> com.modrift.app.dev; xcrun simctl launch <UDID> com.modrift.app.dev; sleep 9
xcrun simctl io <UDID> screenshot 01-home.png
# viewer
xcrun simctl openurl <UDID> "$V"; sleep 6; xcrun simctl io <UDID> screenshot 02-viewer.png
# editor（編集モード＝キーボード＋ツールバー）
xcrun simctl terminate <UDID> com.modrift.app.dev; xcrun simctl launch <UDID> com.modrift.app.dev; sleep 5
xcrun simctl openurl <UDID> "$V&initialMode=edit"; sleep 7; xcrun simctl io <UDID> screenshot 03-editor.png
# settings
xcrun simctl openurl <UDID> "modrift-dev:///settings"; sleep 5; xcrun simctl io <UDID> screenshot 04-settings.png
```

`initialMode=edit` は viewer 画面の deep-link パラメータ（[viewer.tsx](../src/app/viewer.tsx) の `initialMode`）。編集モードに入ると CM が `view.focus()` し、`keyboardDisplayRequiresUserAction=false` によりソフトキーボードが出て、その上に FR-37 ツールバーが乗る。

### 7. 後片付け

```sh
xcrun simctl status_bar <UDID> clear
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool true
# 開発を続けるなら Metro を再開: npm run start:dev
```

## 参考: 使った UDID（2026-07 時点・環境依存なので都度確認）

- iPhone 6.9": iPhone 17 Pro Max (iOS 26.2) — 1320×2868
- iPad 13": iPad Pro 13-inch (M5) **iOS 26.4** — 2064×2752（iOS 26.2 の個体はネットワーク不良で真っ白 → 26.4 で解決）
