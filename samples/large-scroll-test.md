# 大容量テスト用 Markdown (20000字超・スクロール慣性の確認用)

このファイルは `WHOLE_DOC_DECORATE_LIMIT` (20000字) を超える文書で、編集モードのフリック・入力遅延を確認するためのものです。全体装飾ではなく表示範囲装飾にフォールバックする挙動を見ます。


## セクション 1: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 1.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 1.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 1
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 2: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 2.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 2.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 2
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 3: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 3.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 3.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 3
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 4: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 4.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 4.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 4
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 5: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 5.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 5.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 5
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 6: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 6.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 6.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 6
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 7: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 7.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 7.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 7
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 8: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 8.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 8.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 8
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 9: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 9.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 9.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 9
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 10: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 10.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 10.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 10
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 11: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 11.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 11.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 11
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 12: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 12.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 12.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 12
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 13: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 13.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 13.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 13
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 14: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 14.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 14.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 14
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 15: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 15.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 15.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 15
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 16: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 16.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 16.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 16
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 17: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 17.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 17.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 17
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 18: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 18.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 18.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 18
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 19: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 19.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 19.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 19
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 20: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 20.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 20.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 20
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 21: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 21.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 21.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 21
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 22: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 22.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 22.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 22
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 23: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 23.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 23.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 23
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 24: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 24.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 24.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 24
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 25: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 25.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 25.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 25
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 26: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 26.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 26.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 26
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 27: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 27.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 27.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 27
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 28: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 28.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 28.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 28
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 29: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 29.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 29.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 29
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 30: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 30.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 30.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 30
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 31: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 31.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 31.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 31
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |


## セクション 32: 見出しと本文

これはスクロール検証用の日本語の段落です。CodeMirror のライブプレビューが長文でも滑らかに動くか、フリックが途中で止まらないか、日本語 IME の変換中に描画が乱れないかを確認します。英数字 ABC123 が混ざる CJK/Latin のサイズ調和 (inline font-size span) もここで見えます。

This is an English paragraph used to check inline Latin sizing and line wrapping across a long document. The quick brown fox jumps over the lazy dog 0123456789 while we scroll through many screens of text.

### 32.1 箇条書きとタスク

- 箇条書き項目 A（**太字**と *斜体* と `inline code` を含む）
- 箇条書き項目 B（~~取り消し線~~ と [リンク](https://example.com)）
- [ ] 未完了のタスク
- [x] 完了したタスク

### 32.2 番号付きリスト

1. 最初の手順
2. 次の手順
3. 最後の手順

> 引用ブロック。長文の途中に現れる装飾要素として、スクロール中の再描画コストを確認します。

```js
// コードブロック 32
function scrollTest(n) {
  return Array.from({ length: n }, (_, i) => i * 2);
}
```

| 列A | 列B | 列C |
|---|---|---|
| 値1 | 値2 | 値3 |
| あ | い | う |

