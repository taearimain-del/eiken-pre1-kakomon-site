/* 学習時間ログ v2（2026-10-11 Fort様「すべてのものになるべくlogつけてほしい」）
   どのアプリにも <script src="timelog.js" data-app="アプリID"></script> を足すだけで動く単体版。
   - 画面が見えていて、60秒以内に操作があった時間だけを数える（放置・別アプリの時間は入らない）。
   - 端末ごとに Supabase writing_sync の行 `tl:<アカウント>:<アプリID>:<端末ID>` へ {"YYYY-MM-DD": 秒} を保存する
     （端末ごとに行を分けるので、複数端末で同時に使っても上書きし合わない）。
   - アカウントは URL の ?account=（ポータルが付ける）→ この端末で前回使った名前 → アプリ側の選択（*-account）の順に探す。
     どれもなければ「guest」として記録する（アカウントを持たない人、例：弟。端末IDで見分ける。2026-10-11 Fort様指示）。
   - 端末の見分け用に、OSとブラウザの短い名前（_ua）も一緒に保存する。
   - ヘッダー（header 要素）があれば「今日 N分」を小さく表示する。
   原本：claude-workspace/tools/timelog/timelog.js。各アプリへはコピーして置く。 */
(function () {
  var SUPA = "https://bggwfdctijbdnihdfqhb.supabase.co/rest/v1/writing_sync";
  var KEY = "sb_publishable_xqsFshtehk9nAkqaokOJhg_sGCLJaf9";
  var me = document.currentScript;
  var APP = (me && me.getAttribute("data-app")) || location.hostname.split(".")[0] || "app";
  var LS = "tl2:" + APP;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function account() {
    try { var q = new URLSearchParams(location.search).get("account"); if (q) { set("tl2-account", q); return q; } } catch (e) {}
    var a = get("tl2-account") || get("portal-account");
    if (a) return a;
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/-account$/.test(k) && localStorage.getItem(k)) return localStorage.getItem(k); } } catch (e) {}
    return "guest";
  }
  function device() { var d = get("tl2-device"); if (!d) { d = Math.random().toString(36).slice(2, 10); set("tl2-device", d); } return d; }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function ua() {
    var u = navigator.userAgent || "";
    var os = /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Android" : /Windows/.test(u) ? "Windows" : /Mac/.test(u) ? "Mac" : "その他";
    var br = /Line\//.test(u) ? "LINE" : /EdgA?\//.test(u) ? "Edge" : /CriOS|Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : /Firefox|FxiOS/.test(u) ? "Firefox" : "";
    return os + (br ? " / " + br : "");
  }
  function load() { try { return JSON.parse(get(LS)) || {}; } catch (e) { return {}; } }

  var data = load(), last = Date.now(), act = Date.now(), dirty = false, lastPush = 0;
  ["pointerdown", "keydown", "input", "touchstart", "scroll", "wheel"].forEach(function (e) {
    addEventListener(e, function () { act = Date.now(); }, { passive: true, capture: true });
  });

  function show(sec) {
    var host = document.querySelector("header");
    if (!host) return;
    var el = document.getElementById("tl2meta");
    if (!el) { el = document.createElement("span"); el.id = "tl2meta"; el.style.cssText = "font-size:11px;opacity:.65;margin-left:8px;white-space:nowrap"; host.appendChild(el); }
    el.textContent = "今日 " + Math.floor(sec / 60) + "分";
  }
  function push(force) {
    var acc = account();
    if (!acc || (!dirty && !force)) return;
    var pay = {}; for (var k in data) pay[k] = data[k]; pay._ua = ua();
    var body = JSON.stringify({ sync_code: "tl:" + acc + ":" + APP + ":" + device(), payload: pay });
    dirty = false; lastPush = Date.now();
    try {
      var opt = { method: "POST", headers: { "apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal" }, body: body, keepalive: true };
      fetch(SUPA + "?on_conflict=sync_code", opt).catch(function () { dirty = true; });
    } catch (e) { dirty = true; }
  }
  function tick() {
    var now = Date.now(), dt = (now - last) / 1000; last = now;
    var d = ymd(new Date());
    if (document.visibilityState === "visible" && now - act <= 60000 && dt > 0 && dt <= 15) {
      data[d] = Math.round((data[d] || 0) + dt); dirty = true; set(LS, JSON.stringify(data));
    }
    show(data[d] || 0);
    if (dirty && now - lastPush > 30000) push();
  }
  setInterval(tick, 5000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState !== "visible") push(); });
  addEventListener("pagehide", function () { push(); });
})();
