# AI×SVG で Liquid Glass アイコンを作る手順

iOS 26 / Expo SDK 56 向け（`.icon` 対応は SDK 54+）。AIでSVGを生成し、Icon Composer でLiquid Glass化して `.icon` で書き出し、Expo に組み込むまでの一連の流れ。

---

## 0. 大前提（考え方）

- **Liquid Glass は「自分で描く効果」ではなく、システムが後から適用する素材。** 光沢・反射・透明感・奥行き・ダイナミックライティング・Light/Dark/Mono/Tinted の各モードは iOS と Icon Composer が自動生成する。
- したがって **手でハイライトやグラデーションを描き込まない。** フラットなレイヤー分けアートワークを渡すのが正しい。
- iOS 26 では、何もせずフラットな PNG を渡してもシステムが勝手にグラス処理をかける。**ただし制御が効かず、App Store でぼやける報告あり。** 自分で制御したいなら Icon Composer を使う。
- フラットSVGで作るのは間違いではなく、**Liquid Glass の正しい入口**。フラット案をレイヤーに分けて渡すだけ。

---

## 1. 必要なもの

| 項目 | 用途 | 備考 |
|---|---|---|
| MacBook (macOS) | Icon Composer 実行 | macOS 専用。M3 で可 |
| Xcode 26 | ビルド / Icon Composer 同梱 | EAS Build は SDK 56 で Xcode 26 系をデフォルト使用 |
| Icon Composer | レイヤー合成・グラス調整・`.icon` 書き出し | Apple Design Resources / Additional Tools から無料 |
| Claude / Claude Code | SVG 生成・数値調整 | サブスク追加なし（Max 契約済み） |
| コードエディタ (VS Code 等) | SVG をテキスト編集 | Figma 不要 |
| Node + sharp（任意） | フォールバック用 PNG 書き出し | |

---

## 2. ステップ

### Step 1. コンセプトをAIで生成

Claude Code に方向性を出させ、2〜3案から選ぶ。

**原則（最小サイズで成立するか）**
- 要素は 1〜2 個
- 色は 2〜3 色（Modrift は `#181512` / `#F4EEE2` の2色）
- iPhone 最小 29×29 で判別できるか

**プロンプト例**
```
Modrift（Markdown中心の軽量ファイルビューア）のアプリアイコン。
- 角丸の黒背景（#181512）
- 書類とMarkdownを抽象化した幾何学マーク（#F4EEE2）
- 2色のみ、ミニマル
- pathの曲線は極力使わず、rect/line/polylineで構成
- viewBox 0 0 1024 1024
方向性の異なる案を2つ、SVGで出して。
```

### Step 2. レイヤーに分割してSVGを作る

Icon Composer は **レイヤー = 深度 / 色** で読む。フラット案を分割して個別SVGにする。

- **背景レイヤー**：全面1024正方形の黒板（`#181512`）
- **前景レイヤー**：マーク部分（透明背景）
- 必要なら**中景レイヤー**を追加して奥行きを稼ぐ

> 曲線が必要な箇所だけ AI に `path` の叩き台を出させ、数値を自分で微調整する。ゼロから手書きしない。

**背景レイヤー `bg.svg`**
```svg
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#181512"/>
</svg>
```

**前景レイヤー `mark.svg`（案A：書類＋下矢印）**
```svg
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect x="300" y="232" width="424" height="560" rx="44" fill="#F4EEE2"/>
  <g stroke="#181512" stroke-width="52" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <line x1="512" y1="356" x2="512" y2="648"/>
    <polyline points="430,566 512,660 594,566"/>
  </g>
</svg>
```

> **さらに分けるなら**：背景（黒板）／中景（白い書類）／前景（矢印）の3レイヤーにすると、レイヤーごとに異なるグラスの屈折・深度をかけられる。矢印は書類と同じ黒なので、前景レイヤーでは半透明の暗色として独立させると光の抜けが作りやすい。

### Step 3. Icon Composer に取り込む

- 各 SVG / PNG を左サイドバーにドラッグ → 自動で新規レイヤーに割り当て。
- フォルダごとドラッグするとグループになり、中の各ファイルがレイヤーになる。
- 取り込んだ時点で Liquid Glass が自動適用される。

### Step 4. グラスを調整

右側インスペクタで調整。

- **specular highlight（光沢）／ blur ／ translucency（透明感）／ shadow（影）**
- **Individual モード**：レイヤーごとに異なるグラス。
- **Combined モード**：グループ全体を1枚のガラスとして扱う（ミニマル寄りはこちら）。
- **Default / Dark / Mono** の見え方をプレビューし、必要に応じて注釈（annotate）。
- プレビュー上でマウスを動かすとダイナミックライティングに反応する。

### Step 5. 書き出し

- `.icon` 形式で書き出し（1ファイルに全モード・全サイズ情報を内包）。
- マーケティング用に**フラット版**も書き出せる（App Store スクショ等に使用）。

### Step 6. Expo に組み込む

- `.icon` をプロジェクトに配置（例：`./assets/icons/Modrift.icon`）。
- `app.json` の `ios.icon` で参照する。

```json
{
  "expo": {
    "ios": {
      "icon": "./assets/icons/Modrift.icon"
    }
  }
}
```

- EAS Build（Xcode 26）でビルド。
- iOS ≤ 19 では OS が自動でフォールバックを提供する。

> Expo CLI / VSCode 拡張が `.icon` に対して検証警告を出すことがあるが、**使用には支障なし**（既知の問題）。

### Step 7. 検証

実機 or シミュレータ（iOS 26）で確認：

- ホーム画面 / App Store / 設定 / Spotlight
- Light / Dark / Tinted / Clear
- 最小サイズで潰れないか

---

## 3. フォールバック用フラットPNG（任意）

従来 PNG も併存させる場合の要件：

- **1024×1024、透過なし、角丸なし、全面塗り**（角丸は OS が自動でかける）。

**SVG → PNG（sharp）**
```js
// export-png.js  ->  node export-png.js
const sharp = require('sharp');

sharp('icon-flat.svg', { density: 512 })
  .resize(1024, 1024)
  .flatten({ background: '#181512' }) // 透過を除去
  .png()
  .toFile('icon-1024.png')
  .then(() => console.log('icon-1024.png 出力完了'));
```

---

## 4. 注意点・ハマりどころ

- **フラットPNGだけ渡すとシステムが勝手にグラス化** → ぼやける場合あり。制御したいなら Icon Composer 必須。
- **Icon Composer は macOS 専用。** Windows 機では作れない。
- **iPhone 専用アプリでも、Supported Destinations に iPad を含めないと** Home Screen で各モードが反映されない不具合報告あり。
- **visionOS / tvOS は現状 Icon Composer 非対応**（サードパーティはグラス化されない）。Modrift が iOS 中心なら影響なし。
- **純AI生成物は著作権保護が認められにくい**（多くの法域、2026年初頭時点）。アイコンはブランドの顔なので、AI出力は叩き台にして**最終的な色・座標は自分の手で確定**する。

---

## 5. ワークフロー要約

```
AIでコンセプト生成（Claude Code）
        ↓
レイヤー分けSVGを作成・数値調整（VS Code）
        ↓
Icon Composer に取り込み → Liquid Glass 調整（macOS）
        ↓
.icon 書き出し
        ↓
app.json の ios.icon で参照
        ↓
EAS Build（Xcode 26）→ 実機検証
```

---

## 参考

- Apple — Icon Composer: https://developer.apple.com/icon-composer/
- Apple — Human Interface Guidelines > App icons
- Expo — Splash screen and app icon（`ios.icon` / SDK 56）: https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/
- Expo SDK 54 Changelog（`.icon` 対応が入ったバージョン）: https://expo.dev/changelog/sdk-54
- Expo SDK 56 Changelog: https://expo.dev/changelog/sdk-56
