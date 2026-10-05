/**
 * admin.js — 閲覧ログの管理ページ
 *  Supabase にメールとパスワードでログインし、portfolio_events を読む。
 *  読めるのは portfolio_admins に登録されたアカウントだけ（データベース側の RLS で制限）。
 *  このページのコードは公開されているが、ログイン無しではデータは1件も返らない。
 */
(function () {
  "use strict";

  var cfg = window.PF_LOG || {};
  var BASE = (cfg.url || "").replace(/\/$/, "");
  var KEY = cfg.key || "";
  var SESSION_KEY = "pf_admin_session";
  var days = 30;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    notice: $("notice"), login: $("login"), loginError: $("login-error"),
    dash: $("dash"), actions: $("actions"), tip: $("tip")
  };

  var SECTIONS = [["hero", "トップ"], ["works", "作品"], ["about", "わたしについて"], ["skills", "技術"], ["contact", "連絡先"]];
  var SECTION_NAME = {}; SECTIONS.forEach(function (s) { SECTION_NAME[s[0]] = s[1]; });
  var DEVICE_NAME = { mobile: "スマホ", desktop: "PC", tablet: "タブレット" };

  function show(el, on) { el.hidden = !on; }
  function notice(msg) { els.notice.textContent = msg || ""; show(els.notice, !!msg); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function getSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; } }
  function setSession(s) { try { s ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) : sessionStorage.removeItem(SESSION_KEY); } catch (e) {} }

  function api(path, opts) {
    var s = getSession();
    var headers = { apikey: KEY };
    if (s && s.access_token) headers.Authorization = "Bearer " + s.access_token;
    if (opts && opts.headers) for (var k in opts.headers) headers[k] = opts.headers[k];
    return fetch(BASE + path, { method: (opts && opts.method) || "GET", headers: headers, body: opts && opts.body })
      .then(function (r) {
        return r.text().then(function (t) {
          var data = null; try { data = t ? JSON.parse(t) : null; } catch (e) {}
          if (!r.ok) { var err = new Error((data && (data.error_description || data.msg || data.message)) || ("HTTP " + r.status)); err.status = r.status; throw err; }
          return data;
        });
      });
  }

  /* ---------- ログイン ---------- */
  els.login.addEventListener("submit", function (e) {
    e.preventDefault();
    els.loginError.textContent = "";
    var f = new FormData(els.login);
    api("/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.get("email"), password: f.get("password") })
    }).then(function (s) {
      setSession({ access_token: s.access_token, expires_at: Date.now() + (s.expires_in || 3600) * 1000 });
      // この端末からの閲覧は自分のログに数えない
      try { localStorage.setItem("pf_no_track", "1"); } catch (e2) {}
      start();
    }).catch(function () {
      els.loginError.textContent = "メールアドレスかパスワードが違います。";
    });
  });

  $("logout").addEventListener("click", function () { setSession(null); start(); });

  Array.prototype.forEach.call(document.querySelectorAll(".seg [data-days]"), function (b) {
    b.addEventListener("click", function () {
      days = Number(b.getAttribute("data-days"));
      Array.prototype.forEach.call(document.querySelectorAll(".seg [data-days]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      load();
    });
  });

  function start() {
    notice("");
    show(els.dash, false); show(els.actions, false); show(els.login, false);
    if (!BASE || !KEY) { notice("ログの保存先がまだ設定されていません（js/log-config.js）。"); return; }
    var s = getSession();
    if (!s || !s.access_token || s.expires_at < Date.now()) { setSession(null); show(els.login, true); return; }
    api("/rest/v1/portfolio_admins?select=user_id").then(function (rows) {
      if (!rows || !rows.length) {
        notice("このアカウントには閲覧権限がありません。");
        show(els.actions, true);
        return;
      }
      show(els.actions, true);
      load();
    }).catch(function (err) {
      if (err.status === 401) { setSession(null); show(els.login, true); return; }
      notice("読み込めませんでした：" + err.message);
    });
  }

  /* ---------- 読み込みと集計 ---------- */
  function load() {
    var since = new Date(Date.now() - days * 864e5).toISOString();
    var all = [];
    var PAGE = 1000;
    function page(from) {
      return api("/rest/v1/portfolio_events?select=created_at,visitor_id,session_id,type,path,value,referrer,device" +
        "&created_at=gte." + encodeURIComponent(since) + "&order=created_at.desc", {
        headers: { Range: from + "-" + (from + PAGE - 1), "Range-Unit": "items" }
      }).then(function (rows) {
        all = all.concat(rows || []);
        if (rows && rows.length === PAGE && all.length < 50000) return page(from + PAGE);
      });
    }
    notice("読み込み中…");
    page(0).then(function () {
      notice(all.length ? "" : "この期間のログはまだありません。");
      render(all);
      show(els.dash, true);
    }).catch(function (err) {
      if (err.status === 401) { setSession(null); start(); return; }
      notice("読み込めませんでした：" + err.message);
    });
  }

  function jstDate(iso) {
    var d = new Date(new Date(iso).getTime() + 9 * 3600e3);
    return d.toISOString().slice(0, 10);
  }
  function jstTime(iso) {
    var d = new Date(new Date(iso).getTime() + 9 * 3600e3);
    return d.toISOString().slice(5, 16).replace("-", "/").replace("T", " ");
  }

  function render(rows) {
    var visitors = {}, sessions = {}, pv = 0;
    rows.forEach(function (r) {
      visitors[r.visitor_id] = 1;
      var s = sessions[r.session_id] || (sessions[r.session_id] = {
        id: r.session_id, first: r.created_at, last: r.created_at, device: r.device, ref: null, src: null,
        pages: {}, top: false, scroll: 0, sections: {}, lastSection: null, lastSectionAt: ""
      });
      if (r.created_at < s.first) s.first = r.created_at;
      if (r.created_at > s.last) s.last = r.created_at;
      if (r.type === "pageview") {
        pv++;
        s.pages[r.path] = 1;
        if (r.path === "/" || r.path === "/index.html") s.top = true;
        if (r.referrer && !s.ref) s.ref = r.referrer;
        if (r.value && !s.src) s.src = r.value;
      } else if (r.type === "scroll" && (r.path === "/" || r.path === "/index.html")) {
        s.scroll = Math.max(s.scroll, Number(r.value) || 0);
      } else if (r.type === "section") {
        s.sections[r.value] = 1;
        if (r.created_at >= s.lastSectionAt) { s.lastSectionAt = r.created_at; s.lastSection = r.value; }
      }
    });
    var list = Object.keys(sessions).map(function (k) { return sessions[k]; });
    var tops = list.filter(function (s) { return s.top; });

    $("k-visitors").textContent = Object.keys(visitors).length;
    $("k-sessions").textContent = list.length;
    $("k-pv").textContent = pv;
    var full = tops.filter(function (s) { return s.scroll >= 100; }).length;
    $("k-full").textContent = tops.length ? Math.round(full / tops.length * 100) + "%" : "–";
    $("k-full-sub").textContent = tops.length ? full + " / " + tops.length + " 回" : "";

    // 日別の訪問者（重複なし）
    var byDay = {};
    rows.forEach(function (r) {
      var d = jstDate(r.created_at);
      (byDay[d] || (byDay[d] = {}))[r.visitor_id] = 1;
    });
    var dayList = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = jstDate(new Date(Date.now() - i * 864e5).toISOString());
      dayList.push([d, byDay[d] ? Object.keys(byDay[d]).length : 0]);
    }
    var maxDay = Math.max.apply(null, dayList.map(function (x) { return x[1]; }).concat([1]));
    $("daily").innerHTML = dayList.map(function (x) {
      var h = x[1] ? Math.max(2, x[1] / maxDay * 100) : 0;
      return '<div class="daily__col" tabindex="0" data-tip="' + esc(x[0].slice(5).replace("-", "/") + "：" + x[1] + "人") + '"><div class="daily__bar" style="height:' + h + '%"></div></div>';
    }).join("");
    $("daily").insertAdjacentHTML("afterend", "");
    var axis = $("daily").nextElementSibling;
    if (!axis || !axis.classList.contains("daily__axis")) {
      axis = document.createElement("div"); axis.className = "daily__axis";
      $("daily").parentNode.insertBefore(axis, $("daily").nextSibling);
    }
    axis.innerHTML = "<span>" + dayList[0][0].slice(5).replace("-", "/") + "</span><span>最大 " + maxDay + "人/日</span><span>" + dayList[dayList.length - 1][0].slice(5).replace("-", "/") + "</span>";

    // どこまで見たか
    bars("reach", SECTIONS.map(function (s) {
      var n = tops.filter(function (x) { return x.sections[s[0]]; }).length;
      return [s[1], n, tops.length];
    }), true);
    bars("scroll", [25, 50, 75, 100].map(function (m) {
      var n = tops.filter(function (x) { return x.scroll >= m; }).length;
      return [m + "%", n, tops.length];
    }), true);

    // 流入元（決めた5つは0件でも常に表示し、それ以外は多い順に続ける）
    var refs = {};
    list.forEach(function (s) { var k = sourceOf(s); refs[k] = (refs[k] || 0) + 1; });
    var fixed = MAIN_SOURCES.map(function (k) { return [k, refs[k] || 0, list.length]; });
    var others = top(refs, 20).filter(function (x) { return MAIN_SOURCES.indexOf(x[0]) < 0; }).slice(0, 5)
      .map(function (x) { return [x[0], x[1], list.length]; });
    bars("refs", fixed.concat(others), false);

    // 押されたリンク
    var clicks = {};
    rows.forEach(function (r) { if (r.type === "click") clicks[r.value] = (clicks[r.value] || 0) + 1; });
    var clickList = top(clicks, 8);
    var maxClick = clickList.length ? clickList[0][1] : 1;
    bars("clicks", clickList.map(function (x) { return [linkName(x[0]), x[1], maxClick]; }), false);

    // 最近の訪問
    list.sort(function (a, b) { return a.first < b.first ? 1 : -1; });
    $("recent").innerHTML = list.slice(0, 50).map(function (s) {
      return "<tr><td>" + esc(jstTime(s.first)) + "</td><td>" + esc(DEVICE_NAME[s.device] || s.device || "") + "</td><td>" + esc(sourceOf(s)) +
        "</td><td>" + Object.keys(s.pages).length + "</td><td>" + (s.top ? s.scroll + "%" : "–") + "</td><td>" + esc(SECTION_NAME[s.lastSection] || s.lastSection || "–") + "</td></tr>";
    }).join("") || '<tr><td colspan="6" class="empty">まだありません</td></tr>';
  }

  function top(obj, n) {
    return Object.keys(obj).map(function (k) { return [k, obj[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n);
  }
  // 流入元の名前。専用リンクの目印（?utm_source=）を優先し、なければ参照元のドメインから判定する
  var MAIN_SOURCES = ["Instagram", "Facebook", "X", "LINE", "名刺", "QRコード"];
  var SOURCE_NAME = {
    instagram: "Instagram", ig: "Instagram", facebook: "Facebook", fb: "Facebook",
    x: "X", twitter: "X", line: "LINE", card: "名刺", meishi: "名刺", qr: "QRコード"
  };
  function sourceOf(s) {
    if (s.src) return SOURCE_NAME[s.src] || s.src;
    var h = String(s.ref || "").replace(/^www\./, "");
    if (/(^|\.)instagram\.com$/.test(h)) return "Instagram";
    if (/(^|\.)facebook\.com$/.test(h) || h === "fb.me") return "Facebook";
    if (/^(t\.co|x\.com|twitter\.com|mobile\.twitter\.com)$/.test(h)) return "X";
    if (/(^|\.)line\.me$/.test(h) || h === "lin.ee") return "LINE";
    return h || "直接・不明";
  }

  function linkName(href) {
    if (/^mailto:/.test(href)) return "メール";
    var m = href.match(/works\/([^/]+)/); if (m) return "作品ページ：" + m[1];
    try { var u = new URL(href, location.origin); return u.host === location.host ? u.pathname : u.host + u.pathname.replace(/\/$/, ""); } catch (e) { return href; }
  }
  function bars(id, items, pct) {
    var el = $(id);
    if (!items.length || !items.some(function (x) { return x[2]; })) { el.innerHTML = '<p class="empty">まだデータがありません</p>'; return; }
    el.innerHTML = items.map(function (x) {
      var ratio = x[2] ? x[1] / x[2] : 0;
      var val = pct ? Math.round(ratio * 100) + "%" : String(x[1]);
      var tip = x[0] + "：" + x[1] + (pct ? " / " + x[2] + " 回" : " 回");
      return '<div class="bar" data-tip="' + esc(tip) + '"><span class="bar__label" title="' + esc(x[0]) + '">' + esc(x[0]) + '</span><span class="bar__track"><span class="bar__fill" style="display:block;width:' + (ratio * 100).toFixed(1) + '%"></span></span><span class="bar__val">' + esc(val) + "</span></div>";
    }).join("");
  }

  /* ---------- ホバーで数値を出す ---------- */
  function tipAt(target, x, y) {
    var t = target && target.closest ? target.closest("[data-tip]") : null;
    if (!t) { els.tip.hidden = true; return; }
    els.tip.textContent = t.getAttribute("data-tip");
    els.tip.hidden = false;
    var w = els.tip.offsetWidth;
    els.tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2)) + "px";
    els.tip.style.top = Math.max(8, y - 40) + "px";
  }
  document.addEventListener("pointermove", function (e) { tipAt(e.target, e.clientX, e.clientY); });
  document.addEventListener("focusin", function (e) {
    var r = e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : null;
    if (r) tipAt(e.target, r.left + r.width / 2, r.top);
  });

  start();
})();
