/* ═══════════════════════════════════════════════════════════════
   NUDGEBEE — Cookie consent banner
   Drop `<script src="/assets/js/cookie-consent.js"></script>` on a page
   and it self-mounts a slim, site-wide bar pinned to the bottom of the
   viewport on first visit. Non-blocking by design: no backdrop, no
   scroll lock, no focus trap — visitors can keep reading/scrolling
   with the bar in view until they make a choice.

   Choice is stored in localStorage ("nb_cookie_consent") and mirrored to
   Google Consent Mode v2 via gtag('consent','update', …) so GTM/GA/Ads
   tags configured to respect consent signals honor the visitor's choice.
   The <head> of every page sets the Consent Mode DEFAULT to "denied"
   before GTM loads (see the inline snippet next to the GTM tag) — this
   script only ever grants/updates from that default.

   Reopen anytime via window.openCookiePreferences(), or a
   [data-cookie-settings] link/button anywhere on the page (used by the
   footer's "Cookie Settings" link).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var STORAGE_KEY = "nb_cookie_consent";
  var POLICY_URL = "/privacy-policy#cookies";

  var root, built = false, panel = "consent"; // "consent" | "prefs"

  function readConsent() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (v && typeof v === "object") return v;
    } catch (e) { /* private mode / corrupt value */ }
    return null;
  }

  function writeConsent(analytics, advertising) {
    var v = { essential: true, analytics: !!analytics, advertising: !!advertising, ts: Date.now() };
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch (e) { /* private mode */ }
    return v;
  }

  function pushConsentUpdate(v) {
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag("consent", "update", {
      analytics_storage: v.analytics ? "granted" : "denied",
      ad_storage: v.advertising ? "granted" : "denied",
      ad_user_data: v.advertising ? "granted" : "denied",
      ad_personalization: v.advertising ? "granted" : "denied"
    });
    window.dataLayer.push({ event: v.analytics || v.advertising ? "cookie_consent_update" : "cookie_consent_decline" });
  }

  var CSS =
    "#nb-cc{position:fixed;left:0;right:0;bottom:0;z-index:100000;display:none;background:#fff;border-top:1px solid rgba(56,162,255,.18);box-shadow:0 -8px 32px rgba(13,27,46,.14);font-family:'Instrument Sans',system-ui,-apple-system,sans-serif;animation:nb-cc-rise .3s cubic-bezier(.22,.68,.35,1)}" +
    "#nb-cc.nb-open{display:block}" +
    "#nb-cc .nb-cc-inner{max-width:1200px;margin:0 auto;padding:16px 48px}" +
    "#nb-cc .nb-cc-row-main{display:flex;align-items:center;gap:24px;flex-wrap:wrap}" +
    "#nb-cc .nb-cc-body{flex:1 1 420px;min-width:240px;color:#2A3F56;font-size:.88rem;line-height:1.55;margin:0}" +
    "#nb-cc .nb-cc-body a{color:#1B2D4A;font-weight:700;text-decoration:underline;text-underline-offset:2px;cursor:pointer}" +
    "#nb-cc .nb-cc-actions{display:flex;flex-wrap:wrap;gap:10px;flex-shrink:0}" +
    "#nb-cc .nb-cc-btn{font-family:inherit;font-size:.85rem;font-weight:700;padding:9px 18px;border-radius:9px;cursor:pointer;transition:transform .18s ease,opacity .18s ease;border:1.5px solid transparent;line-height:1.2;white-space:nowrap}" +
    "#nb-cc .nb-cc-btn:hover{transform:translateY(-1px)}" +
    "#nb-cc .nb-cc-btn.nb-cc-outline{background:#fff;color:#1B2D4A;border-color:#D1D5DB}" +
    "#nb-cc .nb-cc-btn.nb-cc-outline:hover{border-color:#FAC835}" +
    "#nb-cc .nb-cc-btn.nb-cc-dark{background:#1B2D4A;color:#fff}" +
    "#nb-cc .nb-cc-btn.nb-cc-dark:hover{background:#111827}" +
    "#nb-cc .nb-cc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}" +
    "#nb-cc .nb-cc-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;color:#0F1B2D;font-size:1rem}" +
    "#nb-cc .nb-cc-back{background:transparent;border:none;color:#4A6178;font-size:.85rem;font-weight:700;cursor:pointer;padding:2px 0}" +
    "#nb-cc .nb-cc-back:hover{color:#0F1B2D}" +
    "#nb-cc .nb-cc-prefs{max-height:min(60vh,520px);overflow:auto}" +
    "#nb-cc .nb-cc-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:10px 0;border-top:1px solid rgba(56,162,255,.14)}" +
    "#nb-cc .nb-cc-row:first-of-type{border-top:none}" +
    "#nb-cc .nb-cc-row-tx{min-width:0}" +
    "#nb-cc .nb-cc-row-tt{font-weight:700;color:#0F1B2D;font-size:.88rem;margin-bottom:2px}" +
    "#nb-cc .nb-cc-row-dd{color:#4A6178;font-size:.8rem;line-height:1.45}" +
    "#nb-cc .nb-cc-switch{flex-shrink:0;position:relative;width:40px;height:23px;border-radius:999px;background:#D1D5DB;border:none;cursor:pointer;padding:0;transition:background .18s ease}" +
    "#nb-cc .nb-cc-switch::after{content:'';position:absolute;top:3px;left:3px;width:17px;height:17px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .18s ease}" +
    "#nb-cc .nb-cc-switch.nb-on{background:#38A2FF}" +
    "#nb-cc .nb-cc-switch.nb-on::after{transform:translateX(17px)}" +
    "#nb-cc .nb-cc-switch[disabled]{cursor:not-allowed;opacity:.7}" +
    "#nb-cc .nb-cc-prefs-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:14px}" +
    "@keyframes nb-cc-rise{from{opacity:0;transform:translateY(16px)}}" +
    "@media(max-width:900px){#nb-cc .nb-cc-inner{padding:14px 20px}}" +
    "@media(max-width:640px){#nb-cc .nb-cc-row-main{flex-direction:column;align-items:stretch}#nb-cc .nb-cc-body{flex:none}#nb-cc .nb-cc-actions,#nb-cc .nb-cc-prefs-actions{justify-content:stretch}#nb-cc .nb-cc-btn{flex:1;text-align:center}}";

  function renderConsentView() {
    return (
      '<div class="nb-cc-row-main">' +
        '<p class="nb-cc-body">' +
          "We use essential cookies to make our site work. With your consent, we may also use non-essential " +
          "cookies to improve user experience, personalize advertisements, and analyze web traffic. By clicking " +
          '&ldquo;Accept,&rdquo; you agree to our website&rsquo;s cookie use as described in our ' +
          '<a href="' + POLICY_URL + '">Cookie Policy</a>. Change your cookie settings anytime by ' +
          'clicking &ldquo;<a data-open-prefs>Preferences</a>.&rdquo;' +
        "</p>" +
        '<div class="nb-cc-actions">' +
          '<button type="button" class="nb-cc-btn nb-cc-outline" data-open-prefs>Preferences</button>' +
          '<button type="button" class="nb-cc-btn nb-cc-dark" data-decline>Decline</button>' +
          '<button type="button" class="nb-cc-btn nb-cc-dark" data-accept>Accept</button>' +
        "</div>" +
      "</div>"
    );
  }

  function switchRow(key, label, desc, checked, locked) {
    return (
      '<div class="nb-cc-row">' +
        '<div class="nb-cc-row-tx">' +
          '<div class="nb-cc-row-tt">' + label + "</div>" +
          '<div class="nb-cc-row-dd">' + desc + "</div>" +
        "</div>" +
        '<button type="button" class="nb-cc-switch' + (checked ? " nb-on" : "") + '" ' +
          'data-toggle="' + key + '" role="switch" aria-checked="' + (checked ? "true" : "false") + '" ' +
          'aria-label="' + label + '"' + (locked ? " disabled" : "") + "></button>" +
      "</div>"
    );
  }

  function renderPrefsView(state) {
    return (
      '<div class="nb-cc-prefs">' +
      '<div class="nb-cc-head">' +
        '<span class="nb-cc-title">Cookie preferences</span>' +
        '<button type="button" class="nb-cc-back" data-back>&larr; Back</button>' +
      "</div>" +
      switchRow("essential", "Essential", "Required for the site to work. Always on.", true, true) +
      switchRow("analytics", "Analytics", "Helps us understand how visitors use the site so we can improve it.", state.analytics, false) +
      switchRow("advertising", "Advertising", "Used to personalize ads and measure their performance.", state.advertising, false) +
      '<div class="nb-cc-prefs-actions">' +
        '<button type="button" class="nb-cc-btn nb-cc-outline" data-save>Save preferences</button>' +
        '<button type="button" class="nb-cc-btn nb-cc-dark" data-accept>Accept all</button>' +
      "</div>" +
      "</div>"
    );
  }

  function build() {
    if (built) return;
    built = true;
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement("div");
    root.id = "nb-cc";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "Cookie consent");
    root.innerHTML = '<div class="nb-cc-inner"></div>';
    document.body.appendChild(root);

    root.addEventListener("click", onClick);
  }

  function inner() { return root.querySelector(".nb-cc-inner"); }

  var prefsState = { analytics: false, advertising: false };

  function render() {
    var c = inner();
    c.innerHTML = panel === "prefs" ? renderPrefsView(prefsState) : renderConsentView();
  }

  function onClick(e) {
    var t = e.target;
    if (t.closest("[data-open-prefs]")) {
      panel = "prefs";
      render();
      return;
    }
    if (t.closest("[data-back]")) {
      panel = "consent";
      render();
      return;
    }
    if (t.closest("[data-toggle]")) {
      var key = t.closest("[data-toggle]").getAttribute("data-toggle");
      if (key === "essential") return; // locked on
      prefsState[key] = !prefsState[key];
      render();
      return;
    }
    if (t.closest("[data-accept]")) {
      var v = writeConsent(true, true);
      pushConsentUpdate(v);
      close();
      return;
    }
    if (t.closest("[data-decline]")) {
      var v2 = writeConsent(false, false);
      pushConsentUpdate(v2);
      close();
      return;
    }
    if (t.closest("[data-save]")) {
      var v3 = writeConsent(prefsState.analytics, prefsState.advertising);
      pushConsentUpdate(v3);
      close();
      return;
    }
  }

  function open(startPanel) {
    build();
    panel = startPanel === "prefs" ? "prefs" : "consent";
    var existing = readConsent();
    prefsState = { analytics: !!(existing && existing.analytics), advertising: !!(existing && existing.advertising) };
    render();
    root.classList.add("nb-open");
  }

  function close() {
    if (!root) return;
    root.classList.remove("nb-open");
  }

  window.openCookiePreferences = function () { open("prefs"); };

  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-cookie-settings]") : null;
    if (!el) return;
    e.preventDefault();
    open("prefs");
  });

  function init() {
    // Skip inside iframes (e.g. the briefing popup, embedded demo pages) —
    // the hosting page already owns its own consent banner.
    if (window.self !== window.top) return;
    var existing = readConsent();
    if (existing) {
      pushConsentUpdate(existing); // reapply on every load since Consent Mode default resets per pageview
      return;
    }
    open("consent");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
