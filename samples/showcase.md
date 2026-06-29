# Modrift サンプル / Sample

Markdown レンダリングの動作確認用サンプル。CommonMark + GFM の主要要素を網羅。

---

## 見出し / Headings

# H1 見出し
## H2 見出し
### H3 見出し
#### H4 見出し
##### H5 見出し
###### H6 見出し

---

## テキスト書式 / Text formatting

これは **太字** で、これは *斜体* で、これは ***太字+斜体*** です。
This has ~~strikethrough~~ and `inline code` and 日本語 mixed text.

絵文字も問題なく表示されるはず: 🚀 📝 ✨ 🇯🇵

---

## リスト / Lists

### 箇条書き

- 最初の項目
- 2番目の項目
  - ネストした項目
  - もう一つネスト
    - さらにネスト
- 3番目の項目

### 順序付きリスト

1. First
2. Second
3. Third
   1. Nested first
   2. Nested second

### タスクリスト (GFM)

- [x] 完了したタスク
- [x] 別の完了タスク
- [ ] 未完了のタスク
- [ ] もう一つ未完了

---

## 引用 / Blockquote

> これは引用文です。
> 複数行にわたって書くこともできます。
>
> 段落を分けることも可能。

ネストした引用:

> 外側の引用
>> 内側の引用
>>> もっと内側

---

## リンク / Links

- [Anthropic 公式サイト](https://www.anthropic.com)
- [GitHub の Markdown ガイド](https://docs.github.com/en/get-started/writing-on-github)
- 自動リンク: <https://expo.dev>

---

## コードブロック / Code blocks

### TypeScript

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}

const message = greet('Modrift');
console.log(message);
```

### JavaScript

```javascript
const items = [1, 2, 3, 4, 5];
const doubled = items.map((n) => n * 2);
```

### インデント形式 (フェンスなし)

    function plain() {
      return 'indented code';
    }

---

## テーブル / Tables (GFM)

| 機能 | MVP | v1.1 | v2 |
|---|:---:|:---:|:---:|
| Md プレビュー | ✅ | ✅ | ✅ |
| 自動保存 | ✅ | ✅ | ✅ |
| ダークモード | ❌ | ✅ | ✅ |
| Undo/Redo | ❌ | ✅ | ✅ |
| 全文検索 | ❌ | ❌ | ✅ |
| PDF閲覧 | ❌ | ❌ | ❌ |

| Left | Center | Right |
|:---|:---:|---:|
| 左寄せ | 中央 | 右寄せ |
| Lorem | ipsum | dolor |

---

## 画像 / Images

### HTTPS 画像 (表示される)

![Placeholder 600x200](https://placehold.co/600x200.png)

![Random scenic 600x300](https://picsum.photos/600/300)

### ローカル画像 (プレースホルダ表示される)

![スクリーンショット](screenshot.png)

![アイコン](./assets/icon.png)

![相対パス画像](../images/photo.jpg)

---

## 水平線 / Horizontal rule

セクション1

---

セクション2

***

セクション3

---

## 長文 / Long text

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

長い日本語の文章もテストしておきます。どこのクラウドにある単一の Markdown ファイルでもモバイルで軽快に閲覧・編集できることが Modrift のコアバリューであり、シンプルな UX を目指しています。文字の折り返しや段落間のマージンが適切に表示されることを確認してください。

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

---

おしまい / End
