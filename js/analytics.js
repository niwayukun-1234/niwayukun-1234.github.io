/**
 * analytics.js — 閲覧ログ
 *  いつ・何人が来て・どこまで見たかを記録する。送り先は2つ。
 *   1) 自前のログ（Supabase の portfolio_events テーブル）… /admin/ の管理ページで見る
 *      保存先は js/log-config.js で設定（未設定なら送らない）
 *   2) Google アナリティクス（<head> の gtag）… 同じイベントを送る
 *  記録するもの
 *   - pageview … ページを開いた（流入元・スマホ/PC）
 *                流入元リンクの ?utm_source=instagram / facebook / x / card（名刺）/ qr を value に入れる
 *   - scroll   … 25 / 50 / 75 / 100% までスクロールした（1回ずつ）
 *   - section  … 各セクションが画面に入った（1回ずつ）
 *   - click    … 作品・外部リンク・連絡先のリンクを押した
 *  管理ページでログインした端末（localStorage の pf_no_track）は記録しない。
 */
(function () {
  "use strict";

  var cfg = window.PF_LOG || {};
  var enabled = !!(cfg.url && cfg.key);
  try { if (localStorage.getItem("pf_no_track") === "1") enabled = false; } catch (e) {}

  function store(kind, key) {
    try {
      var s = window[kind], v = s.getItem(key);
      if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); s.setItem(key, v); }
      return v;
    } catch (e) { return "na"; }
  }
  var visitor = store("localStorage", "pf_vid");
  var session = store("sessionStorage", "pf_sid");
  var path = location.pathname;
  var ua = navigator.userAgent;
  var device = /iPad|Tablet/i.test(ua) ? "tablet" : (/Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop");

  var queue = [];
  var timer = null;
  function flush() {
    timer = null;
    if (!queue.length) return;
    var body = JSON.stringify(queue);
    queue = [];
    try {
      fetch(cfg.url.replace(/\/$/, "") + "/rest/v1/portfolio_events", {
        method: "POST",
        keepalive: true,
        headers: { apikey: cfg.key, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: body
      }).catch(function () {});
    } catch (e) {}
  }
  function log(type, value, referrer) {
    if (!enabled) return;
    queue.push({
      visitor_id: visitor, session_id: session, type: type, path: path,
      value: value == null ? null : String(value).slice(0, 300),
      referrer: referrer || null, device: device
    });
    if (!timer) timer = setTimeout(flush, 2000);
  }
  function ga(name, params) {
    if (typeof window.gtag === "function") window.gtag("event", name, params);
  }
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });

  // 流入元（同じサイト内の移動は空にする）
  var ref = "";
  try {
    if (document.referrer) {
      var u = new URL(document.referrer);
      if (u.host !== location.host) ref = u.host;
    }
  } catch (e) {}
  // 流入元リンクの目印（?utm_source=instagram など。?from= でも可）
  var src = "";
  try {
    var q = new URLSearchParams(location.search);
    src = (q.get("utm_source") || q.get("from") || "").toLowerCase().slice(0, 40);
  } catch (e) {}
  log("pageview", src || null, ref);

  // スクロールの到達率
  var marks = [25, 50, 75, 100];
  var sent = {};
  function onScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var pct = max <= 0 ? 100 : Math.round((window.scrollY / max) * 100);
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      if (pct >= m && !sent[m]) {
        sent[m] = true;
        log("scroll", m);
        ga("scroll_depth", { percent: m, page_path: path });
      }
    }
    if (sent[100]) window.removeEventListener("scroll", onScroll);
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  // リンクのクリック（作品ページ・外部リンク・メールなど。ページ内の # は除く）
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;
    log("click", href);
    ga("link_click", { link_url: href, page_path: path });
  }, true);

  // セクションの到達
  if (!("IntersectionObserver" in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      log("section", e.target.id);
      ga("section_view", { section: e.target.id, page_path: path });
    });
  }, { threshold: 0.35 });
  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll("section[id]"), function (s) { io.observe(s); });
  });
})();
