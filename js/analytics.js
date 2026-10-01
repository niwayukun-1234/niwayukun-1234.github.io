/**
 * analytics.js — どこまで見てくれたかを Google アナリティクス（GA4）に送る
 *  - scroll_depth … ページを 25 / 50 / 75 / 100% までスクロールしたとき（1回ずつ）
 *  - section_view … 各セクション（作品・わたしについて・技術・連絡先など）が画面に入ったとき（1回ずつ）
 *  訪問数・日時・流入元は <head> の gtag（G-HS5YM8ZLV2）が自動で記録する。
 */
(function () {
  "use strict";
  function send(name, params) {
    if (typeof window.gtag === "function") window.gtag("event", name, params);
  }

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
        send("scroll_depth", { percent: m, page_path: location.pathname });
      }
    }
    if (sent[100]) window.removeEventListener("scroll", onScroll);
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  if (!("IntersectionObserver" in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      send("section_view", { section: e.target.id, page_path: location.pathname });
    });
  }, { threshold: 0.35 });
  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll("main section[id], section[id]"), function (s) {
      io.observe(s);
    });
  });
})();
