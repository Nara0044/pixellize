/* ═══════════════════════════════════════════════════════════════
   NUDGEBEE — Footer Component
   Single source of truth for the site footer — buildFooterHTML() is a
   pure function (no DOM access) so it can run both here in the browser
   and in Node (see scripts/inject-static-chrome.js, which requires this
   file to server-render the same markup into every static page's
   <div id="footer"></div> for non-JS crawlers).
   Usage: add <div id="footer"></div> in your HTML where the
   <footer> used to be, then load this script.
   ═══════════════════════════════════════════════════════════════ */
function buildFooterHTML() {
  var html = ''
    + '<footer role="contentinfo">'
    + '\n    <div class="foot-inner">'
    + '\n      <div class="foot-grid">'
    + '\n        <div>'
    + '\n          <div class="foot-brand">'
    + '\n            <img src="/assets/images/logo-footer.svg" alt="Nudgebee" class="foot-logo-img">'
    + '\n          </div>'
    + '\n          <p class="foot-tagline">AIOps platform and AI agentic automation platform for SRE, DevOps, and CloudOps teams. Pre-built AI agents for incident management, cloud cost optimization, and cloud automation.</p>'
    + '\n        </div>'
    + '\n        <div class="foot-col">'
    + '\n          <p class="foot-h">Product</p>'
    + '\n          <ul class="foot-links">'
    + '\n            <li><a href="/integrations">Integrations</a></li>'
    + '\n            <li><a href="/pricing">Pricing</a></li>'
    + '\n            <li><a href="https://docs.nudgebee.com/" target="_blank" rel="noopener">Docs</a></li>'
    + '\n            <li><a href="https://docs.nudgebee.com/docs/features/ai/use-cases/" target="_blank" rel="noopener">Use Cases</a></li>'
    + '\n          </ul>'
    + '\n        </div>'
    + '\n        <div class="foot-col">'
    + '\n          <p class="foot-h">Company</p>'
    + '\n          <ul class="foot-links">'
    + '\n            <li><a href="/about">About</a></li>'
    + '\n            <li><a href="/case-studies">Case Studies</a></li>'
    + '\n            <li><a href="/resources/blog">Blog</a></li>'
    + '\n            <li><a href="/discover">Discover</a></li>'
    + '\n            <li><a href="/contact">Contact</a></li>'
    + '\n          </ul>'
    + '\n        </div>'
    + '\n        <div class="foot-col">'
    + '\n          <p class="foot-h">Connect</p>'
    + '\n          <ul class="foot-links">'
    + '\n            <li><a href="https://www.linkedin.com/company/nudgebee" target="_blank" rel="noopener">LinkedIn</a></li>'
    + '\n            <li><a href="https://www.youtube.com/@nudgebee" target="_blank" rel="noopener">YouTube</a></li>'
    + '\n            <li><a href="https://discord.com/invite/PzkHAuTfT7" target="_blank" rel="noopener">Discord</a></li>'
    + '\n            <li><a href="/demo" style="color:var(--yellow);font-weight:700;">Book a Demo</a></li>'
    + '\n          </ul>'
    + '\n        </div>'
    + '\n      </div>'
    + '\n      <div class="foot-bot">'
    + '\n        <div>'
    + '\n          <div class="foot-copy">2026 Nudgebee, Inc. All rights reserved.</div>'
    + '\n        </div>'
    + '\n        <div class="foot-legal">'
    + '\n          <a href="/privacy-policy">Privacy Policy</a>'
    + '\n          <a href="/terms">Terms of Service</a>'
    + '\n          <a href="#" data-cookie-settings>Cookie Settings</a>'
    + '\n        </div>'
    + '\n      </div>'
    + '\n    </div>'
    + '\n  </footer>';

  return html;
}

if (typeof document !== 'undefined') {
  (function () {
    var el = document.getElementById('footer');
    if (!el) return;
    el.innerHTML = buildFooterHTML();
  })();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildFooterHTML: buildFooterHTML };
}
