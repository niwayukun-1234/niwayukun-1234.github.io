# 丹羽優貴 ポートフォリオサイト — 静けさの精度 / Quiet Precision

丹羽優貴（にわ ゆうき / YUKI NIWA）本人のポートフォリオサイト。サイト自体がポートフォリオとして通用する見せ方を目指し、
**余白・字間・動きの抑制**で技術力を伝えるコンセプトで構築しています。

- 公開URL（想定）: `https://niwayukun-1234.github.io/`
- 構成: 1ページ縦スクロール（Hero / Works / About / Skills / Contact）＋ 作品詳細 `/works/<slug>/`
- 言語: 日本語のみ

## 1. 守っている5原則（実装上の制約）

1. **アニメーションは `transform` と `opacity` のみ**。`width` / `top` / `margin` は動かしません。
2. **UIは240ms以内**（`--dur-ui`）／**背景は24秒以上**（`--dur-ambient`）／**中間の速さを使わない**。
3. **LCP要素は Hero の氏名テキスト**。背景・装飾を初期描画に関与させません（`load` 後に `.is-live`）。
4. `prefers-reduced-motion: reduce` / `save-data` / JS無効 で**静止画フォールバック**。
5. アクセントは `--accent` の1色のみ、画面占有3%以内（`--accent-2` は背景の揺らぎのみ・文字に使わない）。

数値・色はすべて `css/tokens.css` の CSS 変数経由です。

## 2. ファイル構成

```
/
├─ index.html                       # トップ（Hero/Works/About/Skills/Contact）
├─ works/<slug>/index.html          # 作品詳細（scripts/build-works.mjs が生成）
├─ works.json                       # 作品データ（ブリーフ§5 の内容そのまま）
├─ 404.html                         # 404ページ
├─ robots.txt / sitemap.xml         # SEO（sitemap は works.json から自動生成）
├─ favicon.ico / favicon-*.png      # NYロゴ（apple-touch-icon-180.png も）
├─ css/
│  ├─ tokens.css                    # デザイントークン（ブリーフ§4）
│  └─ main.css                      # コンポーネントCSS
├─ js/
│  └─ main.js                       # 出現 / アンビエント / ナビ / works描画 / 画像フォールバック
├─ scripts/
│  ├─ build-works.mjs               # works.json → /works/<slug>/ と sitemap.xml を生成
│  ├─ templates/work.html           # 作品詳細テンプレート
│  └─ serve.mjs                     # ローカル確認用サーバ（node scripts/serve.mjs）
├─ images/                          # work-<slug>.jpg（各作品のトップ画面）／ profile-photo.jpg は納品待ち
├─ ogp/                             # ogp-portfolio.png（NYロゴ＋名前、1200×630）
├─ .github/workflows/deploy.yml     # GitHub Pages デプロイ
└─ _notes/build-conformance.md      # 受け入れ基準の自己確認記録
```

## 3. 機能一覧（実装済み）

| セクション | 内容 |
|---|---|
| Header | ナビ（Works / About / Skills / Contact）。768px以下はハンバーガー開閉（Escで閉じる）。スクロールで罫線表示 |
| Hero | ラベル `PORTFOLIO / 2026` → 氏名（LCP）→ `YUKI NIWA`（字間9）→ アクセント罫線 → 姿勢の一文 → 所属3行 → CTA2つ。右にアンビエント面（静止画フォールバックあり） |
| Works | `works.json` を実行時 fetch して描画。2カラム→モバイル1カラム。16:9サムネ／タイトル／一文サマリ／技術タグ／年。ホバーで `translateY(-2px)` ＋ 画像 `scale(1.02)`。カード全体が `/works/<slug>/` へのリンク |
| About | 本文（最大68ch、冒頭1文に「同志社大学経済学部の学生エンジニア」）＋ メタ表（学歴・生年・関心領域）＋ プロフィール写真枠 |
| Skills | 言語 / フレームワーク / インフラ・ツール の3カテゴリを mono タグで列挙。**習熟度%バーは不使用** |
| Contact | GitHub / X / Facebook / Email の4本。`target="_blank" rel="noopener"`、Emailは `mailto:yuki.niwa0626@gmail.com` |
| Footer | `丹羽優貴` ＋ `YUKI NIWA` と© |
| 作品詳細 | ラベル／タイトル／サマリ／Role・Year・Tech／16:9ヒーロー／`課題 → 作ったもの → 使った技術 → 結果` の4ブロック／外部リンク／前後の作品ナビ |
| モーション | 出現620ms（opacity+8px・一度きり）、UI 240ms、背景24s。`prefers-reduced-motion` / `save-data` / JS無効 / 画面外 / タブ非表示で停止 |

## 4. データ構造（`works.json`）

```json
{
  "works": [{
    "slug": "univtap",
    "title": "…", "summary": "…", "role": "…",
    "tech": ["React", "…"], "year": 2026,
    "thumbnail": { "wide": "images/work-univtap.jpg", "square": "…" },
    "links": [{ "label": "Uタップ", "url": "https://…" }],
    "body": { "challenge": "…", "built": "…", "stack": "…", "result": "…" }
  }]
}
```

作品は3件（univtap / pachitango / niwa-lp）。`body` の4項目が詳細ページの4ブロックになります。
**1件足して `npm run build` すると、作品ページと sitemap.xml が自動で増えます。**

## 5. 実行・ビルド

```bash
npm run serve        # ローカル確認（http://localhost:4173）
npm run build        # works.json から /works/<slug>/ と sitemap.xml を生成（リポジトリ直下）
npm run build:dist   # 上記＋一式を dist/ にコピー
```

依存パッケージはありません（Node.js 標準モジュールのみ）。`npm ci` は不要です。

## 6. デプロイ（GitHub Pages）

リポジトリ `niwayukun-1234.github.io` の `main` に push するだけで、
`.github/workflows/deploy.yml` が `npm run build` を実行して Pages へ公開します（Pages の Source は「GitHub Actions」）。

## 7. タグ / SEO

- 全ページ `<head>` に GA4（`G-HS5YM8ZLV2`）と Search Console 検証meta。
- canonical / og:url / sitemap / 構造化データのURLは現状 `https://niwayukun-1234.github.io/`（独自ドメイン取得後に一括差し替え）。
- OGP は og:* と twitter:* を併記、1200×630 ＋ `og:image:width/height/alt`。
- 作品ページは固有 title「`<作品名> | 丹羽優貴のポートフォリオ`」＋ 固有 `og:image`（`/ogp/work-<slug>.png`、無ければ既定キービジュアルへ自動フォールバック）。
- JSON-LD: トップに `Person`（＋作品 `ItemList`）、作品ページに `CreativeWork` / `SoftwareSourceCode`。
- `robots.txt` / `sitemap.xml` / `404.html` を同梱。

## 8. 未実装 / 納品待ち

- **画像素材**: 作品サムネ・プロフィール写真・OGP・favicon は配置済み。作品別OGP（`ogp/work-<slug>.png`）は未作成のため既定キービジュアルを使用。
  未配置でもモノグラム面＋技術タグで表示が破綻しないよう実装済み（詳細は `_notes/build-conformance.md`）。
- **X / Facebook のユーザーURL**: `https://x.com/narakendaihyou1` と `https://www.facebook.com/share/1CCJJEPvf8/` に設定済み。
- 英語切替（今回は対象外）、WebGL/シェーダの見せ場（初版では不要）。

## 9. 次の一手（おすすめ）

1. 納品画像を `images/` と `ogp/` に配置し、OGPの表示を X Card Validator / Facebook Sharing Debugger / LINE で確認。
2. X / Facebook のURLを確定し、`index.html` の Contact と `sameAs` を更新。
3. `works.json` の `body.result` に実測値を記入（現在は「本人記入待ち。（デモ）」）。
4. 独自ドメイン取得後、canonical / og:url / sitemap / JSON-LD のURLを一括差し替え。

## 10. 環境上の注意

本環境は静的サイト配信用のため `npm ci` を伴う Vite ビルドを実行できません。そのため
**ブリーフの要件・トークン・5原則・受け入れ基準を満たしたまま、依存ゼロの素の HTML/CSS/JS で実装**しています。
Vite 前提のソース（`src/`）へ戻す場合は、ビルドはユーザー側の Actions に委ねる分担になります。
詳細な対応表と受け入れ基準の自己確認は `_notes/build-conformance.md` にまとめています。
