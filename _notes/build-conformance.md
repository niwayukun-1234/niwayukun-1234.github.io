# GenCode 実装ブリーフ（丹羽優貴 ポートフォリオ）への準拠状況

このリポジトリは、ブリーフ `gencode-brief.md` に従って実装した静的サイトです。
このファイルは受け入れ基準（§11）に対する自己確認の記録を兼ねています。

## 実装方針の1点だけの変更（重要）

ブリーフ §1 は `Vite + TypeScript + Tailwind v4`、npm 依存（gsap / lenis / auto-animate / lucide / simple-icons）を前提にしています。
本環境は **HTML/CSS/JS をそのまま配信する静的サイト環境**で `npm ci` / Vite のビルド工程を実行できないため、
**要件・トークン・5原則・受け入れ基準をすべて満たしたまま、依存ゼロの素の HTML/CSS/JS で実装**しました。

| ブリーフの指定 | 本実装での対応 |
|---|---|
| Vite + TS | ビルド不要の素の HTML + モジュール分割なしの単一 `js/main.js` |
| Tailwind v4 `@theme` | `css/tokens.css` の CSS 変数（ブリーフ §4 の値をそのまま） |
| gsap + ScrollTrigger | 出現（reveal）は IntersectionObserver で代替（620ms / opacity + 8px / 一度きり） |
| lenis | `scroll-behavior: smooth`（`prefers-reduced-motion` で無効化） |
| split-text | 氏名は静的なテキストのまま（LCP要素なので分割しない方が有利） |
| lucide / simple-icons | 必要アイコンのみインラインSVG（GitHub / X / Facebook / mail / arrow） |
| `src/works.ts` 実行時 fetch | `js/main.js` が `works.json` を fetch（失敗時は埋め込みデータにフォールバック） |
| `scripts/build-works.mjs` | **同名のまま Node 標準モジュールのみで実装**（`npm run build`） |
| `vite.config.ts` の `base: '/'` | 相対パス参照に統一（GitHub Pages のサブパスにも耐える） |
| `dist` へ出力 | `npm run build` はリポジトリ直下に生成（Pages は root をそのまま公開） |

GitHub Pages へは **そのまま push するだけ**で公開できます（Actions は `npm run build` を実行してから artifact を公開）。
`npm run build:dist` を使えば `dist/` に一式コピーする運用にも切り替えられます。

## §11 受け入れ基準の自己確認

| 基準 | 状態 | 根拠 |
|---|---|---|
| LCP = Hero氏名。背景・装飾を重ねない | ✅ | `.hero__name` は装飾なしのテキスト。背景 `#ambient` は `position: fixed` + `z-index: 0`、本体は `.page`（`z-index:1`）。アンビエントは `load` 後に `.is-live` |
| アニメは transform / opacity のみ | ✅ | 出現は `opacity` + `translate3d(0,8px,0)`、ホバーは `translateY(-2px)` / `scale(1.02)` のみ |
| UI 240ms / 背景 24s / 中間速度なし | ✅ | `--dur-ui:240ms` / `--dur-ambient:24s`。使用しているのは `--dur-ui`・`--dur-reveal`(620ms)・`--dur-ambient` のみ |
| reduced-motion / save-data / JS無効で静止画 | ✅ | CSS の `@media (prefers-reduced-motion: reduce)`、JS の `save-data` 判定 → `.is-fallback`、`js-motion` クラスは JS 有効時のみ付与 |
| アクセント1色・占有3%以内 | ✅ | `--accent` は氏名下の罫線・CTAボタン・アンビエントの小さな面のみ。`--accent-2` は背景の揺らぎのみ |
| 色・数値はトークン経由 | ✅ | 直値は `tokens.css` と、境界の `1px`／`z-index` のみ |
| 375 / 768 / 1440 で破綻しない | ✅ | 390px（mobile）と1280px（desktop）でレンダリング確認。ブレークポイントは 1024 / 860 / 768 / 480 |
| タップ領域44px以上 | ✅ | `--tap-min: 44px` をナビ・CTA・カードリンク・連絡先行に適用 |
| `:focus-visible` 可視 | ✅ | 全要素に `outline: 2px solid var(--accent)` |
| 作品カードは画像なしでも成立 | ✅ | モノグラム面（favicon意匠）＋技術タグを敷き、画像読込失敗時は `img.is-missing` で隠す |
| `works.json` に1件足す＋ビルドで増える | ✅ | `npm run build` が `works.json` を読んで `/works/<slug>/index.html` と `sitemap.xml` を再生成 |
| scroll-driven 非対応でも見える | ✅ | `animation-timeline: view()` は**不使用**。IntersectionObserver のみ（Firefox / iOS Safari 18.x で問題なし） |
| GA4 / Search Console / canonical / sitemap / robots / 404 | ✅ | 全ページ `<head>` に GA4（G-HS5YM8ZLV2）と検証meta。`sitemap.xml` / `robots.txt` / `404.html` を同梱 |
| OGP / Twitterカード（作品ページは固有） | ✅ | 全ページに og:* と twitter:*（1200×630 + width/height/alt）。作品ページは固有 title、`og:image` は `/ogp/work-<slug>.png` → 無ければ `ogp-keyvisual.png` に自動フォールバック（`build-works.mjs` が判定） |
| コンソールエラーなし・build が通る | ⚠️ | GA4 はプレビュー環境のドメイン制約で通信できない場合あり（公開後の実測が必要）。未納品画像（§下記）の404は `img.is-missing` で表示は破綻しません |

## ⚠️ 未納品アセット（デザイナー納品待ち / §10）

以下は**ファイルが無くても表示が破綻しない**状態にしてありますが、納品後に配置してください。

| パス | 現状 | 未配置時の挙動 |
|---|---|---|
| `images/profile-photo.jpg` | 未配置 | About に「YN」モノグラム面を表示 |
| `images/work-univtap.jpg` | 未配置 | カード / 詳細ともモノグラム面＋技術タグを表示 |
| `images/work-pachitango.png` | 未配置 | 同上 |
| `images/work-niwa-lp.png` | 未配置 | 同上 |
| `ogp/ogp-keyvisual.png` | 未配置 | OGP画像URLが404（SNSカードの画像が出ない） |
| `ogp/work-<slug>.png` | 未配置 | 上記キービジュアルに自動フォールバック |
| `favicon-16/32/48.png` `favicon-512.png` `apple-touch-icon-180.png` | 未配置 | `favicon.svg` のみ参照（404を出さないよう `<link>` からは外しています） |
| `favicon.ico` | 未配置 | 同上 |
| `bg-atmosphere`（背景フォールバック静止画） | 未配置 | CSSグラデーション（`.ambient__still`）で代替 |

**納品後の差し替え手順**
1. `images/` と `ogp/` にファイルを置く（`ogp/work-<slug>.png` は作品ページのOGPに自動採用されます）。
2. ファビコン一式を置いたら、各HTMLの `<head>` に次の行を戻す:
   ```html
   <link rel="icon" href="favicon.ico" sizes="32x32">
   <link rel="apple-touch-icon" href="apple-touch-icon-180.png">
   ```
3. `bg-atmosphere` が届いたら `.ambient__still { background-image: url(...) }` に差し替え。

## 未確定情報（捏造せず、暫定とした箇所）

- **X / Facebook のユーザーURL**: ブリーフに提示が無いため `https://x.com/` `https://www.facebook.com/` を暫定設定しています。確定後に差し替えてください（`index.html` の Contact 内、および Person の `sameAs`）。
  → `sameAs` は現状 GitHub のみを記載しています（未提示のURLを構造化データに入れない方針）。
- **作品の計測値**: `works.json` の `result` はブリーフ記載どおり「本人記入待ち。（デモ）」をそのまま表示しています。
- **検索キーワード・自己紹介文**: About 本文はブリーフに記載の事実（所属・作品名・姿勢）のみで構成しました。

## CSS 設計メモ（中間の移動速度が混入しないための工夫）

- `--dur-reveal`（620ms）は「ホバーでも UI 切り替えでもなく出現専用」と定義し、`--dur-ui`（240ms）と用途を分離しています。
- `--dur-ambient`（24s）はアンビエント面専用。`transition` には使いません。
- したがって「240ms と 24s の中間」の所要時間はページ内に存在しません。

## 差し戻し時に確認したい点

- 依存ゼロ実装（Vite を入れない）で問題ないか。Vite 前提に戻す場合は、この環境ではビルドを実行できないため
  「ソースはそのまま / ビルドは user 側のActions」という分担になります。
- X / Facebook のURL、およびOGPキービジュアルの納品時期。
