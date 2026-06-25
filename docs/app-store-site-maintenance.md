# 公開サイト(プライバシーポリシー / サポート)の管理・更新手順

App Store 用のプライバシーポリシー・サポートページは、**このアプリ本体リポとは別の公開リポ**で配信している。本ドキュメントはその場所と更新方法の記録。

## 構成

| 役割 | リポジトリ | 可視性 | 実体 |
|---|---|---|---|
| アプリ本体(ソース) | `modrift` (このリポ) | **Private** | アプリのコード |
| 公開サイト | `modrift/modrift.github.io` | **Public** | プライバシー/サポートの HTML |

- 公開サイトは **GitHub Pages** が `modrift.github.io` リポの `main` ルートを自動配信(リポ名が `<org>.github.io` のため Pages は自動有効)。
- ローカル作業コピー: **`/Users/nokata/Projects/modrift-site/`**
- アプリのソース(Private)とは完全に分離。公開サイトに本体コードは含まれない。

## 公開 URL(App Store Connect に登録済み)

| 用途 | URL |
|---|---|
| サポート | https://modrift.github.io/support.html |
| プライバシーポリシー | https://modrift.github.io/privacy.html |
| トップ(マーケティング) | https://modrift.github.io/ |
| 問い合わせ窓口(GitHub Issues) | https://github.com/modrift/modrift.github.io/issues |

## ファイル構成(modrift-site)

- `index.html` — トップ(ランディング)
- `privacy.html` — プライバシーポリシー(日英)
- `support.html` — サポート・FAQ(日英)
- `style.css` — 共通スタイル
- `.nojekyll` — Jekyll ビルドを無効化し、HTML をそのまま配信

## 更新手順

プライバシーポリシーやサポート内容を変えるときは、**`modrift-site` の HTML を編集して push** する(このアプリ本体リポの docs ではない)。

```bash
cd /Users/nokata/Projects/modrift-site
# privacy.html / support.html などを編集
git add -A
git commit -m "Update privacy policy"   # 例
git push
```

push すると GitHub Pages が自動で再公開(数十秒〜数分)。ブラウザのキャッシュで古く見えることがあるのでスーパーリロードで確認。

## 注意

- **ファイル名は変えない**。`privacy.html` / `support.html` の名前を変えると URL が変わり、App Store Connect 側の URL 更新が必要になる。中身だけ差し替える分には URL は不変。
- **提出後はサイトを Unpublish しない**。URL が 404 になると「プライバシーポリシー URL 無効」で審査差し戻しになる。
- 連絡先はメールではなく GitHub Issues(`modrift/modrift.github.io` の Issues)。
- 将来 `modrift.app` 等の独自ドメインを当てる場合は、`modrift.github.io` リポの Settings → Pages → Custom domain で設定し、ASC の URL を差し替える。
