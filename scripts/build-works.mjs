#!/usr/bin/env node
/**
 * build-works.mjs
 * -----------------------------------------------------------------------------
 * works.json を読み、作品詳細ページ /works/<slug>/index.html を生成する。
 *
 * 依存ゼロ（Node.js 標準モジュールのみ）。
 *   - GitHub Actions の `npm run build` から呼ぶ
 *   - 引数なしで実行すると、リポジトリのルートに works/<slug>/index.html を出力
 *   - `--out dist` を与えると dist/ にコピー（index.html, css, js, 画像, robots, sitemap…）
 *
 * works.json に 1 件足して、このスクリプトを走らせると作品ページが 1 つ増える。
 * sitemap.xml も同時に再生成する。
 * -----------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative, extname } from "node:path";

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT_DIR = outIdx >= 0 ? resolve(ROOT, args[outIdx + 1]) : ROOT;

const SITE_ORIGIN = "https://niwayukun-1234.github.io";

/* -------------------------------------------------------------------------- */
function fail(msg) {
  console.error("[build-works] " + msg);
  process.exit(1);
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function monogramOf(title) {
  const en = String(title || "").replace(/[^A-Za-z]/g, "");
  return (en.slice(0, 2) || "WN").toUpperCase();
}

/* -------------------------------------------------------------------------- */
const worksPath = join(ROOT, "works.json");
if (!existsSync(worksPath)) fail("works.json が見つかりません: " + worksPath);

let data;
try {
  data = JSON.parse(readFileSync(worksPath, "utf8"));
} catch (e) {
  fail("works.json の JSON が壊れています: " + e.message);
}
const works = data.works;
if (!Array.isArray(works) || works.length === 0) fail("works.json に works 配列がありません。");

/* slug の重複検出 */
const seen = new Set();
for (const w of works) {
  if (!w.slug) fail("slug の無い作品があります。");
  if (seen.has(w.slug)) fail("slug が重複しています: " + w.slug);
  seen.add(w.slug);
}

const templatePath = join(ROOT, "scripts", "templates", "work.html");
if (!existsSync(templatePath)) fail("テンプレートが見つかりません: " + templatePath);
const template = readFileSync(templatePath, "utf8");

/* -------------------------------------------------------------------------- */
function thumbMarkup(work) {
  const wide = work.thumbnail && work.thumbnail.wide;
  if (wide) {
    /* 作品ページは /works/<slug>/ にあるためルート相対へ変換 */
    const src = "../../" + String(wide).replace(/^\.?\//, "");
    return (
      '<img src="' + esc(src) + '" alt="' + esc(work.title) + ' のスクリーンショット" ' +
      'width="1200" height="675" loading="eager" decoding="async">'
    );
  }
  const tags = (work.tech || []).slice(0, 4).map((t) => "<span>" + esc(t) + "</span>").join("");
  return (
    '<div class="work-card__fallback">' +
    '<span class="mono-mark">' + esc(monogramOf(work.title)) + "</span>" +
    '<span class="work-card__tags-inline">' + tags + "</span>" +
    "</div>"
  );
}

const EXT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
  '<path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>';

/* 1つ目のリンクは「◯◯を開く」の目立つボタン、2つ目以降は控えめなボタン */
function linksMarkup(work, extraClass) {
  if (!work.links || !work.links.length) return "";
  const items = work.links
    .map((l, i) =>
      i === 0
        ? '<a class="btn btn--solid btn--launch btn--lg" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
          esc(l.label) + "を開く" + EXT_ICON + "</a>"
        : '<a class="btn btn--ghost" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
          esc(l.label) + EXT_ICON + "</a>"
    )
    .join("");
  const note = extraClass ? '<span class="detail__links-note">実際に触れます（新しいタブで開きます）</span>' : "";
  return '<div class="detail__links' + (extraClass ? " " + extraClass : "") + '">' + items + note + "</div>";
}

/** 作品ごとの OGP。未用意なら既定キービジュアルにフォールバック。 */
function ogImageFor(slug) {
  const perWork = join(ROOT, "ogp", "work-" + slug + ".png");
  return existsSync(perWork) ? "/ogp/work-" + slug + ".png" : "/ogp/ogp-portfolio.png";
}

function jsonLdType(work) {
  const langs = ["TypeScript", "JavaScript", "HTML", "CSS"];
  const isCode =
    (work.tech || []).some((t) => langs.includes(t)) || work.slug === "pachitango";
  return isCode ? "SoftwareSourceCode" : "CreativeWork";
}

/* -------------------------------------------------------------------------- */
let generated = 0;
works.forEach((work, i) => {
  const prev = works[(i - 1 + works.length) % works.length];
  const next = works[(i + 1) % works.length];
  const body = work.body || {};
  const tech = work.tech || [];

  const html = template
    .replaceAll("{{SLUG}}", esc(work.slug))
    .replaceAll("{{TITLE}}", esc(work.title))
    .replaceAll("{{SUMMARY}}", esc(work.summary))
    .replaceAll("{{ROLE}}", esc(work.role))
    .replaceAll("{{YEAR}}", esc(String(work.year)))
    .replaceAll("{{TECH_PLAIN}}", esc(tech.join(" / ")))
    .replaceAll("{{TECH_TAGS}}", tech.map((t) => '<li class="tag">' + esc(t) + "</li>").join(""))
    .replaceAll("{{BODY_CHALLENGE}}", esc(body.challenge))
    .replaceAll("{{BODY_BUILT}}", esc(body.built))
    .replaceAll("{{BODY_STACK}}", esc(body.stack))
    .replaceAll("{{BODY_RESULT}}", esc(body.result))
    .replaceAll("{{OG_IMAGE}}", esc(ogImageFor(work.slug)))
    .replaceAll("{{JSONLD_TYPE}}", jsonLdType(work))
    .replaceAll("{{THUMB}}", thumbMarkup(work))
    .replaceAll("{{LINKS_TOP}}", linksMarkup(work, "detail__links--top"))
    .replaceAll("{{LINKS}}", linksMarkup(work))
    .replaceAll("{{PREV_SLUG}}", esc(prev.slug))
    .replaceAll("{{PREV_TITLE}}", esc(prev.title))
    .replaceAll("{{NEXT_SLUG}}", esc(next.slug))
    .replaceAll("{{NEXT_TITLE}}", esc(next.title));

  const dir = join(OUT_DIR, "works", work.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf8");
  generated++;
  console.log("  ✓ works/" + work.slug + "/index.html");
});

/* -------------------------------------------------------------------------- */
/* sitemap.xml を works.json から再生成                                        */
/* -------------------------------------------------------------------------- */
const urls = [
  { loc: SITE_ORIGIN + "/", priority: "1.0" },
  ...works.map((w) => ({ loc: SITE_ORIGIN + "/works/" + w.slug + "/", priority: "0.8" })),
];
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls
    .map(
      (u) =>
        "  <url>\n    <loc>" + u.loc + "</loc>\n    <changefreq>monthly</changefreq>\n" +
        "    <priority>" + u.priority + "</priority>\n  </url>"
    )
    .join("\n") +
  "\n</urlset>\n";
writeFileSync(join(OUT_DIR, "sitemap.xml"), sitemap, "utf8");
console.log("  ✓ sitemap.xml");

/* -------------------------------------------------------------------------- */
/* --out 指定時はその他の静的ファイルも dist へコピー                          */
/* -------------------------------------------------------------------------- */
const COPY = ["index.html", "404.html", "robots.txt", "favicon.svg", "favicon.ico",
  "works.json", ".nojekyll", "favicon-16.png", "favicon-32.png", "favicon-48.png",
  "favicon-512.png", "apple-touch-icon-180.png"];
const COPY_DIRS = ["css", "js", "images", "ogp", "admin"];

function copyFile(rel) {
  const from = join(ROOT, rel);
  if (!existsSync(from)) return false;
  const to = join(OUT_DIR, rel);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, readFileSync(from));
  return true;
}

function copyDir(rel) {
  const from = join(ROOT, rel);
  if (!existsSync(from) || !statSync(from).isDirectory()) return;
  for (const name of readdirSync(from)) {
    const child = join(rel, name);
    if (statSync(join(ROOT, child)).isDirectory()) copyDir(child);
    else copyFile(child);
  }
}

if (OUT_DIR !== ROOT) {
  for (const f of COPY) copyFile(f);
  for (const d of COPY_DIRS) {
    const from = join(ROOT, d);
    if (!existsSync(from)) continue;
    if (statSync(from).isDirectory()) copyDir(d);
    else copyFile(d);
  }
  console.log("  ✓ 出力先: " + relative(ROOT, OUT_DIR) + "/");
}

console.log("[build-works] " + generated + " 件の作品ページを生成しました。");
