/**
 * main.js — 初期化
 *  - 出現（IntersectionObserver）… 620ms / opacity + 8px / 一度きり
 *  - アンビエント… load 後に .is-live（24s）、reduced-motion・save-data・画面外・タブ非表示で停止
 *  - works.json の読み込み・描画（失敗時は埋め込みデータへフォールバック）
 *  - ナビ開閉 / 現在地ハイライト / ヘッダー罫線
 *  - カードのポインタ追従は行わない（transform のみで抑制的に）
 *
 * 依存ライブラリなし（GSAP/Lenis 相当の役割を最小実装で代替）。
 * Lenis のスムーススクロールは prefers-reduced-motion: reduce で初期化しない。
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mqSaveData =
    (navigator.connection && navigator.connection.saveData) ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-data: reduce)").matches);

  /* ------------------------------------------------------------------
     1. フォールバック判定
     ------------------------------------------------------------------ */
  function motionAllowed() {
    return !mqReduce.matches && !mqSaveData;
  }
  if (!motionAllowed()) {
    root.classList.remove("js-motion");
    root.classList.add("motion-off");
  }

  /* ------------------------------------------------------------------
     1.2 オープニング演出の後片付け（終わったら要素ごと外す。クリックでスキップ）
     ------------------------------------------------------------------ */
  var intro = document.getElementById("intro");
  if (intro) {
    if (!root.classList.contains("intro-on")) {
      intro.remove();
    } else {
      var introSound = null;
      var endIntro = function () { if (intro.parentNode) intro.remove(); };
      var skip = function () {
        if (introSound) introSound.stop();
        root.classList.remove("intro-on");
        endIntro();
        window.removeEventListener("pointerdown", skip);
        window.removeEventListener("keydown", skip);
      };
      var play = function (withSound) {
        if (withSound) introSound = playIntroSound();
        root.classList.remove("intro-wait");
        intro.addEventListener("animationend", function (e) {
          if (e.target === intro) endIntro();
        });
        setTimeout(endIntro, 3000); /* animationend が来ない環境の保険 */
        setTimeout(function () {
          window.addEventListener("pointerdown", skip, { once: true });
          window.addEventListener("keydown", skip, { once: true });
        }, 300);
      };
      if (root.classList.contains("intro-wait")) {
        // アプリ内ブラウザ：ボタンを押した瞬間（＝操作の中）なら音を鳴らせる
        var buttons = intro.querySelectorAll("[data-intro-sound]");
        Array.prototype.forEach.call(buttons, function (btn) {
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            play(btn.getAttribute("data-intro-sound") === "on");
          }, { once: true });
        });
        if (buttons[0]) buttons[0].focus({ preventScroll: true });
      } else {
        play(true);
      }
    }
  }

  /* オープニングの効果音（Web Audio で合成。音源ファイルなし）
     タイムラインは CSS の演出（2.3s）に合わせている：
     0〜0.65s ロゴがぼかしから浮かぶ → 0.4〜1.0s 線が伸びる →
     1.25s ロゴが手前に抜ける → 1.45s 本編が現れる（見出しが順に上がる） */
  function playIntroSound() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // iPhone のマナーモード中でも鳴らせるようにする（対応ブラウザのみ）
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    var ctx;
    try { ctx = new AC(); } catch (e) { return null; }
    // ページを一度も操作していないと、ブラウザによっては音を出せない（その場合は無音で演出だけ流す）
    if (ctx.state !== "running") {
      try { ctx.resume(); } catch (e) {}
    }
    var t0 = ctx.currentTime + 0.03;
    var master = ctx.createGain();
    master.gain.value = 1.6;
    // 音量を上げつつ割れないように軽く圧縮してから持ち上げる
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    var makeup = ctx.createGain();
    makeup.gain.value = 1.15;
    master.connect(comp).connect(makeup).connect(ctx.destination);

    var noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    function env(g, points) {
      g.gain.setValueAtTime(0.0001, t0);
      points.forEach(function (p) { g.gain.exponentialRampToValueAtTime(Math.max(p[1], 0.0001), t0 + p[0]); });
    }
    function noise(start, dur, type, f0, f1, points) {
      var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf;
      f.type = type; f.Q.value = 1.2;
      f.frequency.setValueAtTime(f0, t0 + start);
      f.frequency.exponentialRampToValueAtTime(f1, t0 + start + dur);
      env(g, points);
      src.connect(f).connect(g).connect(master);
      src.start(t0 + start); src.stop(t0 + start + dur + 0.1);
    }
    function tone(type, start, dur, f0, f1, points) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t0 + start);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + start + dur);
      env(g, points);
      o.connect(g).connect(master);
      o.start(t0 + start); o.stop(t0 + start + dur + 0.05);
    }

    // ロゴが浮かび上がる：空気が満ちるようなスウェルと、静かな和音
    noise(0, 0.9, "bandpass", 300, 2400, [[0.05, 0.001], [0.6, 0.12], [0.9, 0.0001]]);
    [220, 329.63, 440, 554.37].forEach(function (f, k) {
      tone("sine", 0, 1.6, f * (1 + (k - 1.5) * 0.002), 0, [[0.05, 0.001], [0.6, 0.05], [1.2, 0.04], [1.6, 0.0001]]);
    });
    // 線が伸びる：上昇するきらめき
    tone("sine", 0.42, 0.6, 880, 1760, [[0.45, 0.001], [0.6, 0.035], [1.02, 0.0001]]);
    // ロゴが手前に抜ける：シュッと加速する風切り音
    noise(1.1, 0.4, "highpass", 500, 7000, [[1.12, 0.001], [1.42, 0.28], [1.7, 0.0001]]);
    // 本編が現れる瞬間：低いインパクトと明るいチャイム
    tone("sine", 1.45, 0.7, 130, 38, [[1.46, 0.6], [2.15, 0.0001]]);
    [1318.5, 1975.5, 2637].forEach(function (f, k) {
      tone("triangle", 1.45 + k * 0.03, 1.4, f, 0, [[1.46 + k * 0.03, 0.07 - k * 0.015], [2.85, 0.0001]]);
    });
    // 見出しが順に上がる：小さなティック
    for (var n = 0; n < 7; n++) {
      var at = 1.45 + n * 0.09;
      tone("sine", at, 0.08, 1800 + n * 140, 0, [[at + 0.005, 0.03], [at + 0.08, 0.0001]]);
    }

    var closed = false;
    function close() { if (!closed) { closed = true; ctx.close().catch(function () {}); } }
    // 再生を許可されないまま止まっている場合、後で一斉に鳴らないよう閉じておく
    setTimeout(function () { if (ctx.state !== "running") close(); }, 400);
    setTimeout(close, 3800);
    return {
      stop: function () {
        if (closed) return;
        master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
        setTimeout(close, 300);
      }
    };
  }

  /* ------------------------------------------------------------------
     1.5 画像フォールバック
        素材（profile-photo / work-*.jpg|png）が未配置でも破綻させない。
        読み込み失敗した img を隠し、下に敷いたモノグラム面を見せる。
     ------------------------------------------------------------------ */
  document.addEventListener(
    "error",
    function (e) {
      var el = e.target;
      if (el && el.tagName === "IMG") el.classList.add("is-missing");
    },
    true /* capture: img の error はバブリングしない */
  );
  Array.prototype.slice.call(document.images).forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) img.classList.add("is-missing");
  });

  /* ------------------------------------------------------------------
     2. アンビエント（背景）… LCP を邪魔しないよう load 後に開始
     ------------------------------------------------------------------ */
  var ambient = document.getElementById("ambient");
  if (ambient) {
    function startAmbient() {
      if (!motionAllowed()) {
        ambient.classList.add("is-fallback");
        return;
      }
      ambient.classList.add("is-live");
    }
    if (document.readyState === "complete") {
      requestAnimationFrame(startAmbient);
    } else {
      window.addEventListener("load", function () {
        requestAnimationFrame(startAmbient);
      });
    }

    /* 画面外 / タブ非表示で停止（CPU・バッテリー配慮） */
    document.addEventListener("visibilitychange", function () {
      ambient.classList.toggle("is-paused", document.hidden);
    });
    mqReduce.addEventListener("change", function () {
      ambient.classList.toggle("is-fallback", mqReduce.matches);
      if (mqReduce.matches) {
        root.classList.remove("js-motion");
        root.classList.add("motion-off");
      }
    });
  }

  /* ------------------------------------------------------------------
     3. 出現（reveal）
        scroll-driven CSS は使わず IntersectionObserver のみ。
        → Firefox / iOS Safari 18.x でも見える（フォールバック不要化）
     ------------------------------------------------------------------ */
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (reveals.length) {
    if (!("IntersectionObserver" in window) || !motionAllowed()) {
      reveals.forEach(function (el) { el.classList.add("is-in"); });
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
      );
      reveals.forEach(function (el) { io.observe(el); });
    }
  }

  /* ------------------------------------------------------------------
     4. ヘッダー / ナビ
     ------------------------------------------------------------------ */
  var header = document.getElementById("site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  var nav = document.getElementById("site-nav");
  var toggle = document.getElementById("nav-toggle");
  if (nav && toggle) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* 現在地ハイライト（静的1ページなので簡易判定） */
  var hash = window.location.hash;
  if (hash) {
    var current = document.querySelector('.nav__link[href$="' + hash + '"]');
    if (current) current.classList.add("is-current");
  }

  /* ------------------------------------------------------------------
     5. works.json の読み込みと描画（トップのみ）
     ------------------------------------------------------------------ */
  var grid = document.getElementById("works-grid");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function monogramOf(title) {
    var en = String(title || "").replace(/[^A-Za-z]/g, "");
    return (en.slice(0, 2) || "WN").toUpperCase();
  }

  function thumbMarkup(work, sizes) {
    var wide = work.thumbnail && work.thumbnail.wide;
    if (wide) {
      return (
        '<img src="' + esc(wide) + '" alt="' + esc(work.title) + ' のスクリーンショット" ' +
        'width="' + sizes.w + '" height="' + sizes.h + '" loading="lazy" decoding="async">'
      );
    }
    /* 画像が無い場合はモノグラム面（favicon意匠）＋技術タグで成立させる */
    var tags = (work.tech || []).slice(0, 4)
      .map(function (t) { return "<span>" + esc(t) + "</span>"; })
      .join("");
    return (
      '<div class="work-card__fallback">' +
        '<span class="mono-mark">' + esc(monogramOf(work.title)) + "</span>" +
        '<span class="work-card__tags-inline">' + tags + "</span>" +
      "</div>"
    );
  }

  var EXT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>';

  /* 実物のプロダクトへ飛ぶボタン（カード内で詳細リンクより前面に置く） */
  function launchMarkup(work) {
    var link = work.links && work.links[0];
    if (!link) return "";
    return (
      '<a class="btn btn--solid btn--launch" href="' + esc(link.url) + '" target="_blank" rel="noopener">' +
        esc(link.label) + "を開く" + EXT_ICON +
      "</a>"
    );
  }

  function cardMarkup(work, index) {
    var tags = (work.tech || [])
      .map(function (t) { return '<li class="tag">' + esc(t) + "</li>"; })
      .join("");
    return (
      '<li class="works__item reveal" data-delay="' + (index % 2) + '">' +
        '<article class="work-card">' +
          '<div class="work-card__thumb">' + thumbMarkup(work, { w: 800, h: 450 }) + "</div>" +
          '<div class="work-card__body">' +
            '<span class="work-card__year">' + esc(work.year) + "</span>" +
            '<h3 class="work-card__title"><a class="work-card__link" href="/works/' + esc(work.slug) + '/">' + esc(work.title) + "</a></h3>" +
            '<p class="work-card__summary">' + esc(work.summary) + "</p>" +
            '<ul class="tags">' + tags + "</ul>" +
            '<div class="work-card__foot">' +
              launchMarkup(work) +
              '<span class="work-card__more">詳細を見る' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
                'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
              "</span>" +
            "</div>" +
          "</div>" +
        "</article>" +
      "</li>"
    );
  }


  function renderWorks(works) {
    if (!grid || !works || !works.length) return;
    grid.innerHTML = works.map(cardMarkup).join("");
    var items = Array.prototype.slice.call(grid.querySelectorAll(".reveal"));
    if (!("IntersectionObserver" in window) || !motionAllowed()) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    items.forEach(function (el) { io.observe(el); });
  }

  if (grid) {
    var inline = document.getElementById("works-fallback-data");
    var inlineData = null;
    if (inline) {
      try { inlineData = JSON.parse(inline.textContent).works; } catch (e) { inlineData = null; }
    }
    fetch("works.json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("works.json " + r.status);
        return r.json();
      })
      .then(function (data) { renderWorks(data.works); })
      .catch(function () { renderWorks(inlineData); });
  }
})();
