/* ═══════════════════════════════════════════════════════════════
   NUDGEBEE — Briefing popup launcher
   Drop `<script src="/assets/js/briefing-popup.js" defer></script>` on a
   page and it injects a modal that iframes the chrome-less briefing form
   (/briefing?embed=1). Auto-opens ONCE per visitor on first visit; also
   exposes window.openBriefingPopup() for a manual CTA.

   Flow — the form (inside the iframe) posts messages back as the visitor
   submits, and the parent turns them into an unobtrusive, keep-browsing UX:
     nb-briefing:loading  → CLOSE the popup and drop a "generating…" toast
                            (bottom-right), so the visitor isn't trapped in
                            a spinner while the brief is assembled.
     nb-briefing:ready    → flip the toast to "your brief is ready" and pin a
                            persistent "Your brief is ready" button top-right.
                            Clicking either opens the report (openReport).
     nb-briefing:error    → error toast with a Retry that reopens the form.

   The report view reuses the SAME popup: it swaps the iframe to the finished
   brief and shows Open full page / Download PDF actions.

   Fully self-contained (styles injected) so it can't disturb the host page.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var SEEN_KEY = "nb_briefing_seen";
  // Iframe the CLEAN path, never /briefing.html: cleanUrls 301-redirects
  // /briefing.html -> /briefing and DROPS the query string, so ?embed=1 would
  // be lost and the full-chrome page (navbar/hero/footer) would show in the
  // popup. /briefing?embed=1 serves 200 with no redirect in both dev and prod.
  var FORM_URL = "/briefing?embed=1";
  var AUTO_OPEN_DELAY_MS = 900;
  var TITLE_FORM = "Get your personalized briefing";
  var TITLE_BRIEF = "Your NudgeBee briefing";

  var root, frame, titleEl, subEl, openEl, loadingEl, closeEl, built = false;
  var inerted = [], prevFocus = null;
  var report = null;                 // { id, landingUrl, pdfUrl } once ready
  var toastEl, toastTimer = null, topBtn;

  /* Friendly rotating lines for the "generating" toast, ordered start →
     finish (kept in sync with briefing.js). When the list runs out (long
     generation), keep cycling the last few "almost there" lines instead
     of restarting from the top. */
  var LOADER_MSGS = [
    "Reading your answers…",
    "Matching your role to the right talking points…",
    "Skimming our knowledge base for the good bits…",
    "Tailoring this to your stack…",
    "Finding what's relevant to your industry…",
    "Cross-checking your priorities…",
    "Connecting the dots between your tools…",
    "Herding a few Kubernetes pods…",
    "Politely asking the cluster for insights…",
    "Turning YAML into plain English…",
    "Skipping the generic stuff you've read before…",
    "Writing the part your finance team will like…",
    "Trimming the fluff…",
    "Making it sound less like marketing…",
    "Brewing a fresh brief…",
    "Sharpening the pencils…",
    "Asking the robots to type faster…",
    "Weaving in your priorities…",
    "Double-checking the numbers…",
    "Lining up the sections…",
    "Making the tables look presentable…",
    "Packing it into a few tidy pages…",
    "Running a quick sanity check…",
    "Checking everything twice…",
    "Giving it one last read…",
    "Adding the finishing touches…",
    "Rendering your shareable pages…",
    "Warming up the PDF printer…",
    "Nearly there — formatting nicely…",
    "Still faster than writing it yourself…",
    "Good things take a few seconds…",
    "Taking a touch longer than usual — hang tight…",
    "Almost done — promise…",
    "Any moment now…"
  ];
  var LOADER_TAIL = 4, LOADER_TICK_MS = 2400;
  var msgTimer = null, msgIdx = 0;

  function startMsgs() {
    stopMsgs();
    msgIdx = 0;
    msgTimer = window.setInterval(function () {
      var tx = toastEl && toastEl.querySelector(".nb-toast-tx");
      if (!tx || !toastEl.classList.contains("nb-show")) return stopMsgs();
      msgIdx++;
      if (msgIdx >= LOADER_MSGS.length) msgIdx = LOADER_MSGS.length - LOADER_TAIL;
      tx.textContent = LOADER_MSGS[msgIdx];
    }, LOADER_TICK_MS);
  }
  function stopMsgs() {
    if (msgTimer) { window.clearInterval(msgTimer); msgTimer = null; }
  }

  var CSS =
    "#nb-bp{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:24px}" +
    "#nb-bp.nb-open{display:flex}" +
    "#nb-bp .nb-bp-bd{position:absolute;inset:0;background:rgba(13,27,46,.62);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);animation:nb-bp-fade .2s ease}" +
    "#nb-bp .nb-bp-card{position:relative;width:min(880px,100%);height:min(90vh,100%);background:#fff;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(13,27,46,.42);animation:nb-bp-pop .28s cubic-bezier(.22,.68,.35,1)}" +
    "#nb-bp .nb-bp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 12px 12px 20px;border-bottom:1px solid rgba(56,162,255,.18);background:#F7F9FC}" +
    "#nb-bp .nb-bp-headtx{display:flex;flex-direction:column;gap:2px;min-width:0}" +
    "#nb-bp .nb-bp-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;color:#0F1B2D;font-size:1rem}" +
    "#nb-bp .nb-bp-sub{font-family:'Instrument Sans',system-ui,sans-serif;font-size:.78rem;color:#4A6178;line-height:1.45}" +
    "#nb-bp .nb-bp-sub[hidden]{display:none}" +
    "#nb-bp .nb-bp-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}" +
    "#nb-bp .nb-bp-open{font-size:.82rem;font-weight:700;text-decoration:none;padding:8px 14px;border-radius:8px;cursor:pointer}" +
    "#nb-bp .nb-bp-open{color:#1B2D4A;border:1.5px solid rgba(56,162,255,.25);background:#fff;font-family:'Instrument Sans',system-ui,sans-serif}" +
    "#nb-bp .nb-bp-open:hover{border-color:#FAC835}" +
    "#nb-bp .nb-bp-open[hidden]{display:none}" +
    "#nb-bp .nb-bp-close{font-size:1.6rem;line-height:1;color:#4A6178;background:transparent;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer}" +
    "#nb-bp .nb-bp-close:hover{background:rgba(0,0,0,.06);color:#111827}" +
    "#nb-bp .nb-bp-body{position:relative;flex:1;display:flex;flex-direction:column;overflow:hidden}" +
    "#nb-bp .nb-bp-frame{flex:1;min-height:0;width:100%;border:0;display:block}" +
    "#nb-bp .nb-bp-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#fff;color:#4A6178;font-family:'Instrument Sans',system-ui,sans-serif}" +
    "#nb-bp .nb-bp-loading[hidden]{display:none}" +
    "#nb-bp .nb-bp-spin{width:40px;height:40px;border-radius:50%;border:3px solid rgba(56,162,255,.18);border-top-color:#38A2FF;animation:nb-bp-spin .8s linear infinite}" +
    "#nb-bp .nb-bp-err{color:#dc2626;font-weight:600;padding:24px;text-align:center;max-width:420px}" +
    // Persistent "your brief is ready" button, pinned top-right below the nav.
    "#nb-brief-btn{position:fixed;right:24px;top:calc(var(--nb-announce-height,0px) + 88px);z-index:99998;display:none;align-items:center;gap:9px;padding:11px 18px;border-radius:999px;border:1.5px solid rgba(56,162,255,.25);background:#fff;color:#1B2D4A;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:800;font-size:.85rem;cursor:pointer;box-shadow:0 10px 30px rgba(13,27,46,.2);animation:nb-bp-pop .3s cubic-bezier(.22,.68,.35,1)}" +
    "#nb-brief-btn.nb-show{display:inline-flex}" +
    "#nb-brief-btn:hover{border-color:#FAC835}" +
    "#nb-brief-btn .nb-brief-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.18)}" +
    // Bottom-right toast for generating / ready / error.
    // Bottom-CENTER so it never collides with the chat bubble (bottom-right),
    // and wide enough that the rotating messages don't truncate.
    "#nb-toast{position:fixed;left:0;right:0;bottom:24px;margin:0 auto;width:fit-content;min-width:320px;z-index:99998;display:none;max-width:min(520px,calc(100vw - 32px));align-items:center;gap:12px;padding:14px 18px;border-radius:14px;background:#0F1B2D;color:#fff;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.9rem;box-shadow:0 16px 48px rgba(13,27,46,.4);animation:nb-bp-pop .3s cubic-bezier(.22,.68,.35,1)}" +
    "#nb-toast.nb-show{display:flex}" +
    "#nb-toast .nb-toast-spin{width:20px;height:20px;flex-shrink:0;border-radius:50%;border:2.5px solid rgba(255,255,255,.25);border-top-color:#FAC835;animation:nb-bp-spin .8s linear infinite}" +
    "#nb-toast .nb-toast-ic{width:22px;height:22px;flex-shrink:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem}" +
    "#nb-toast .nb-toast-ic.ok{background:#22c55e;color:#04120a}" +
    "#nb-toast .nb-toast-ic.err{background:#dc2626;color:#fff}" +
    "#nb-toast .nb-toast-tx{flex:1;line-height:1.35}" +
    "#nb-toast .nb-toast-cta{flex-shrink:0;font-weight:800;color:#0F1B2D;background:#FAC835;border:none;border-radius:8px;padding:7px 13px;cursor:pointer;font-size:.82rem}" +
    "#nb-toast .nb-toast-x{flex-shrink:0;background:transparent;border:none;color:rgba(255,255,255,.6);font-size:1.25rem;line-height:1;cursor:pointer;padding:0 2px}" +
    "#nb-toast .nb-toast-x:hover{color:#fff}" +
    "@keyframes nb-bp-spin{to{transform:rotate(360deg)}}" +
    "@keyframes nb-bp-fade{from{opacity:0}}" +
    "@keyframes nb-bp-pop{from{opacity:0;transform:translateY(12px) scale(.98)}}" +
    "@media(max-width:640px){#nb-bp{padding:0}#nb-bp .nb-bp-card{width:100%;height:100%;border-radius:0}" +
    "#nb-toast{left:12px;right:12px;bottom:12px;width:auto;min-width:0;max-width:none}#nb-brief-btn{right:12px;top:calc(var(--nb-announce-height,0px) + 76px)}}";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function build() {
    if (built) return;
    built = true;
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement("div");
    root.id = "nb-bp";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", TITLE_FORM);
    root.innerHTML =
      '<div class="nb-bp-bd" data-close></div>' +
      '<div class="nb-bp-card">' +
      '  <div class="nb-bp-head">' +
      '    <div class="nb-bp-headtx">' +
      '      <span class="nb-bp-title">' + TITLE_FORM + '</span>' +
      '      <span class="nb-bp-sub">Answer a few quick questions &mdash; get a shareable 5&ndash;6 page brief tailored to your role, stack &amp; priorities.</span>' +
      '    </div>' +
      '    <div class="nb-bp-actions">' +
      '      <a class="nb-bp-open" target="_blank" rel="noopener" hidden>Open full page ↗</a>' +
      '      <button class="nb-bp-close" data-close aria-label="Close">&times;</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="nb-bp-body">' +
      '    <iframe class="nb-bp-frame" title="Personalized briefing" loading="lazy"></iframe>' +
      '    <div class="nb-bp-loading" hidden><div class="nb-bp-spin"></div><p>Assembling your briefing…</p></div>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(root);

    frame = root.querySelector(".nb-bp-frame");
    titleEl = root.querySelector(".nb-bp-title");
    subEl = root.querySelector(".nb-bp-sub");
    openEl = root.querySelector(".nb-bp-open");
    loadingEl = root.querySelector(".nb-bp-loading");
    closeEl = root.querySelector(".nb-bp-close");

    var closers = root.querySelectorAll("[data-close]");
    for (var i = 0; i < closers.length; i++) closers[i].addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && root.classList.contains("nb-open")) close();
    });
  }

  /* Reset the header/body to the form view (used every time the FORM opens). */
  function resetToForm() {
    titleEl.textContent = TITLE_FORM;
    subEl.hidden = false;              // the intro line belongs to the form view
    openEl.hidden = true; openEl.removeAttribute("href");
    loadingEl.hidden = true;
    frame.onload = null;
    frame.setAttribute("src", FORM_URL);
  }

  /* Focus trap: make everything behind the popup inert so Tab can't reach
     the page's navbar/links while the dialog is open. Only touch elements we
     ourselves set, so a pre-existing inert element is left as-is on close. */
  function setBackgroundInert(on) {
    if (on) {
      inerted = [];
      var kids = document.body.children;
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (el === root || el.inert) continue;
        el.inert = true;
        inerted.push(el);
      }
    } else {
      for (var j = 0; j < inerted.length; j++) inerted[j].inert = false;
      inerted = [];
    }
  }

  function showRoot() {
    prevFocus = document.activeElement;
    root.classList.add("nb-open");
    document.body.style.overflow = "hidden";
    setBackgroundInert(true);
    if (closeEl) closeEl.focus();   // land focus inside the dialog
  }

  /* Open the FORM (the CTA entry point + first-visit auto-open). */
  function openForm() {
    build();
    resetToForm();
    showRoot();
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (e) { /* private mode */ }
    (window.dataLayer = window.dataLayer || []).push({ event: "briefing_popup_open" });
  }

  /* Open the finished brief with Open full page / Download PDF actions. */
  function openReport() {
    if (!report || !report.landingUrl) return;
    build();
    titleEl.textContent = TITLE_BRIEF;
    subEl.hidden = true;
    openEl.href = report.landingUrl; openEl.hidden = false;
    /* No PDF action here: the brief itself renders a Download PDF button in
       its own toolbar, and two identical buttons stacked in one view read as a
       bug. "Open full page" stays — the iframe cannot offer that. */
    loadingEl.innerHTML = '<div class="nb-bp-spin"></div><p>Loading your briefing…</p>';
    loadingEl.hidden = false;
    frame.onload = function () { loadingEl.hidden = true; frame.onload = null; };
    frame.setAttribute("src", report.landingUrl);
    showRoot();
    (window.dataLayer = window.dataLayer || []).push({ event: "briefing_report_open" });
  }

  function close() {
    if (!root) return;
    root.classList.remove("nb-open");
    document.body.style.overflow = "";
    setBackgroundInert(false);
    if (prevFocus && typeof prevFocus.focus === "function") { try { prevFocus.focus(); } catch (e) { /* noop */ } }
    prevFocus = null;
  }

  /* ── Top button + toast ────────────────────────────────────────── */

  function buildTopBtn() {
    if (topBtn) return;
    build();
    topBtn = document.createElement("button");
    topBtn.id = "nb-brief-btn";
    topBtn.type = "button";
    topBtn.innerHTML = '<span class="nb-brief-dot"></span>Your brief is ready';
    topBtn.addEventListener("click", openReport);
    document.body.appendChild(topBtn);
  }

  function revealTopBtn() {
    buildTopBtn();
    topBtn.classList.add("nb-show");
  }

  function buildToast() {
    if (toastEl) return;
    build();
    toastEl = document.createElement("div");
    toastEl.id = "nb-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    document.body.appendChild(toastEl);
  }

  function hideToast() { stopMsgs(); if (toastEl) toastEl.classList.remove("nb-show"); }

  function showToast(state, msg) {
    buildToast();
    if (toastTimer) { window.clearTimeout(toastTimer); toastTimer = null; }
    stopMsgs();

    var html;
    if (state === "generating") {
      html = '<div class="nb-toast-spin"></div>' +
        '<div class="nb-toast-tx">' + LOADER_MSGS[0] + '</div>';
    } else if (state === "ready") {
      html = '<div class="nb-toast-ic ok">✓</div>' +
        '<div class="nb-toast-tx">Your brief is ready.</div>' +
        '<button class="nb-toast-cta" type="button">View</button>' +
        '<button class="nb-toast-x" type="button" aria-label="Dismiss">&times;</button>';
    } else {
      html = '<div class="nb-toast-ic err">!</div>' +
        '<div class="nb-toast-tx">' + esc(msg || "Something went wrong generating your brief.") + '</div>' +
        '<button class="nb-toast-cta" type="button">Retry</button>' +
        '<button class="nb-toast-x" type="button" aria-label="Dismiss">&times;</button>';
    }
    toastEl.innerHTML = html;
    toastEl.classList.add("nb-show");
    if (state === "generating") startMsgs();

    var cta = toastEl.querySelector(".nb-toast-cta");
    if (cta) cta.addEventListener("click", function () {
      hideToast();
      if (state === "ready") openReport(); else openForm();
    });
    var x = toastEl.querySelector(".nb-toast-x");
    if (x) x.addEventListener("click", hideToast);

    // The "ready" toast is transient — the top button is the durable entry point.
    if (state === "ready") toastTimer = window.setTimeout(hideToast, 12000);
  }

  /* ── Messages from the embedded form ───────────────────────────── */

  window.addEventListener("message", function (e) {
    if (e.origin !== window.location.origin) return; // form is same-origin
    var d = e.data;
    if (!d || typeof d !== "object" || typeof d.type !== "string") return;
    if (d.type.indexOf("nb-briefing:") !== 0) return;

    if (d.type === "nb-briefing:loading") {
      close();                       // let the visitor keep browsing while it builds
      showToast("generating");
    } else if (d.type === "nb-briefing:ready") {
      report = { id: d.id, landingUrl: d.landingUrl, pdfUrl: d.pdfUrl || null };
      showToast("ready");
      revealTopBtn();
    } else if (d.type === "nb-briefing:error") {
      close();
      showToast("error", d.message);
    }
  });

  /* Site CTAs: any [data-briefing-cta] link (navbar button, homepage section)
     opens the popup here instead of navigating. On pages that don't load this
     script the links simply navigate to /briefing. */
  document.addEventListener("click", function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest("[data-briefing-cta]") : null;
    if (!a) return;
    e.preventDefault();
    hideToast();
    openForm();
  });

  window.openBriefingPopup = openForm;
  window.closeBriefingPopup = close;

  // Auto-open once per visitor on first visit.
  function maybeAutoOpen() {
    return; // TEMP: auto-open disabled until launch — test via window.openBriefingPopup() in the console.
    var seen;
    try { seen = localStorage.getItem(SEEN_KEY); } catch (e) { seen = "1"; }
    if (!seen) window.setTimeout(openForm, AUTO_OPEN_DELAY_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", maybeAutoOpen);
  } else {
    maybeAutoOpen();
  }
})();
