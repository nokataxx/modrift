# ストア用スクリーンショット撮影レシピ（シミュレータ・全自動）

毎リリースで App Store 用スクショ（iPhone 6.9" / iPad 13"）を**シミュレータだけで**撮るための手順。実機は不要。
出力は `store-assets/screenshots/`（`iphone-69-0N-*.png` 1320×2868 / `ipad-13-0N-*.png` 2064×2752）。

> **⚠️ 2026-08-13 改訂**: **openurl 方式は使えなくなった。** iOS 26.4 では `simctl openurl` に対して **必ず「Open in "Modrift Dev"?」の確認ダイアログ**が出る（アプリの起動中・終了中を問わず、`modrift-dev://` でも出る）。タップ自動化が無いので、この経路は詰む。代わりに **アプリへ一時フックを仕込んで、コンテナ内のファイルから遷移先を読ませる**。詳細は下の「遷移方式（現行）」。以降の openurl の記述は経緯として残す。

## 遷移方式（現行・2026-08-13〜）

`src/app/index.tsx` の `HomeScreen` に**撮影用の一時フック**を足し、撮影後に戻す。

```tsx
// TEMP: store screenshots only — REVERT
useEffect(() => {
  try {
    const f = new File(Paths.document, '.shot.json');
    if (!f.exists) return;
    const { pathname, params } = JSON.parse(f.textSync());
    const id = setTimeout(() => router.push({ pathname, params }), 900);
    return () => clearTimeout(id);
  } catch {}
}, [router]);
```

撮影ハーネスは `Documents/.shot.json` を書いてからアプリを再起動するだけ。**URL 層を通らないので確認ダイアログが出ない。**

```sh
printf '%s' '{"pathname":"/pdf-viewer","params":{"fileUri":"file://...","fileName":"Field Note.pdf"}}' > "$DOC/.shot.json"
xcrun simctl terminate $U com.modrift.app.dev; xcrun simctl launch $U com.modrift.app.dev; sleep 15
xcrun simctl io $U screenshot 04-pdf.png
```

### 有料形式（PDF / docx / xlsx）を撮るときの追加パッチ

`.dev` の Bundle ID では App Store の商品を取得できないため、そのままでは Paywall が出る。撮影用に [`use-pro-entitlement.tsx`](../src/hooks/use-pro-entitlement.tsx) を2箇所いじる。**片方だけでは足りない**:

- `useState(false)` → `useState(true)`（`isPro`）
- `useState(isBillingConfigured)` → `useState(false)`（**`isLoading`**。effect を早期 return させると `isLoading` が永遠に true のままになり、ビューアが「Loading...」で止まる ← 実際に踏んだ）
- provider の effect 先頭に `return;`

さらに **シミュレータでは `materializeFileCoordinated` が解決しない**（Markdown の `readFileCoordinated` は動く）。PDF / docx / xlsx の3ビューアで、この呼び出しを `Promise.resolve(fileUri)` に一時置換する。**実機では正常なので、シミュレータ固有の問題**。

**撮影後は必ず全パッチを戻し、`grep -rn "TEMP: store screenshots" src/` が空になることを確認する。**

### 逆に Paywall を撮りたいとき (IAP の審査用スクリーンショット)

**シミュレータでは撮れない。** `.dev` の Bundle ID では App Store の商品を取得できず価格が出ないし、Test Store の商品価格は **USD 固定**なので ¥1,000 にならない。**実機で、本番 Bundle ID のビルドを使う。**

厄介なのは購入を外す手順で、**次の2つを両方やらないと Pro のまま**になる:

1. **設定 → デベロッパ → Sandbox Apple Account → サインアウト** — StoreKit 2 は Apple アカウントの購入履歴を自動同期するので、**アプリを消して入れ直しても購入が戻る**。履歴の出どころを断つ必要がある
2. **アプリを削除して再インストール** — RevenueCat がエンタイトルメントをローカルにキャッシュしている

> この「再インストールでも購入が自動で戻る」挙動は、**製品としては望ましい** (利用者は復元ボタンを押さなくてよい)。撮影だけが割を食う。

## 何がキモか（ハマりどころ・openurl 時代の記録）

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

## 検体ファイル（v2 以降）

有料形式のスクショには PDF / docx / xlsx が要る。**利用者の実データは使わない**ので生成する:

- **xlsx** — `@e965/xlsx` で書き出す（`XLSX.write(wb, {type:'buffer'})` + `fs.writeFileSync`。**`writeFile` は ESM だと `fs` が繋がっておらず "cannot save file" になる**）。スクリプトはプロジェクト直下に置いて実行しないと依存を解決できない
- **docx** — 最小構成の OOXML を手で組んで zip する（`[Content_Types].xml` / `_rels/.rels` / `word/document.xml` / `word/styles.xml` / `word/_rels/document.xml.rels` の5ファイル）。mammoth は読み専用なので書けない
- **PDF** — Swift + AppKit の `CGContext` PDF コンシューマ（`cupsfilter` に HTML→PDF フィルタが無いため）

## 参考: 使った UDID（環境依存なので都度確認）

- iPhone 6.9": iPhone 17 Pro Max — 1320×2868（2026-08 時点 `3D903E0F-…`）
- iPad 13": iPad Pro 13-inch (M5) **iOS 26.4** — 2064×2752（iOS 26.2 の個体はネットワーク不良で真っ白 → 26.4 で解決）

## v2 の構成（2026-08-13）

編集を残しつつ新形式に枠を割いた6枚。旧 `04-settings` は落とした。

| # | 画面 |
|---|---|
| 01 | ホーム |
| 02 | Markdown ビューア |
| 03 | Markdown 編集（ツールバー＋キーボード） |
| 04 | PDF |
| 05 | Excel（シートタブ・表） |
| 06 | Word（見出し・箇条書き・表） |

> **キーボードが日本語で写る**ことがある。`AppleKeyboards` を en_US だけにして **respring してから撮り直す**（`AppleLocale` も en_US にすると確実）。撮影の途中で sim を再起動すると設定が戻ることがあるので、**編集画面は最後に確認する**。
