/* ═══════════════════════════════════════════════════════════════
   NUDGEBEE — Blog catalog category filter
   Client-side only: every card already exists in the DOM with a
   data-cats="Cat A|Cat B" attribute, so filtering just toggles
   visibility instead of re-fetching or re-rendering anything.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var filter = document.querySelector('.blog-filter');
  if (!filter) return;

  var chips = Array.prototype.slice.call(filter.querySelectorAll('.blog-filter-btn'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.blog-grid .blog-card'));
  var featured = document.querySelector('.blog-featured');

  function catsOf(el) {
    return (el.getAttribute('data-cats') || '').split('|').filter(Boolean);
  }

  function applyFilter(cat) {
    cards.forEach(function (card) {
      var show = cat === 'all' || catsOf(card).indexOf(cat) !== -1;
      card.style.display = show ? '' : 'none';
    });
    // The featured slot only makes sense for "All" — a filtered view should show every
    // matching post in the grid, not bury one above it under a different heading.
    if (featured) {
      var slot = featured.closest('.blog-featured-slot');
      if (slot) slot.style.display = cat === 'all' ? '' : 'none';
    }
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      applyFilter(chip.getAttribute('data-cat'));
    });
  });
})();

/* ── Reading progress — tracks scroll depth through the article body only,
   so the bar reads 0→100% across the actual content, not the whole page
   (hero, related posts, and the closing CTA don't count as "reading"). ── */
(function () {
  var bar = document.querySelector('.bp-progress-bar');
  var article = document.querySelector('.bp-body');
  if (!bar || !article) return;

  var ticking = false;
  function update() {
    ticking = false;
    var top = article.getBoundingClientRect().top + window.scrollY;
    var height = article.offsetHeight - window.innerHeight * 0.5;
    var scrolled = window.scrollY - top + window.innerHeight * 0.5;
    var pct = height > 0 ? Math.min(100, Math.max(0, (scrolled / height) * 100)) : 0;
    bar.style.width = pct + '%';
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
})();

/* ── Floating CTA — appears once the reader has scrolled past the hero,
   hides again while the closing CTA card is on screen (no point showing
   the same offer twice at once), and stays dismissed for the session
   once closed. IntersectionObserver-driven, no scroll-position math. ── */
(function () {
  var bar = document.getElementById('bpFloatCta');
  var hero = document.querySelector('.bp-hero');
  if (!bar || !hero || !('IntersectionObserver' in window)) return;

  var dismissed = false;
  try { dismissed = sessionStorage.getItem('bpFloatCtaDismissed') === '1'; } catch (e) {}
  if (dismissed) return;

  var pastHero = false;
  var onClosingCta = false;

  function sync() {
    bar.classList.toggle('is-visible', pastHero && !onClosingCta);
  }

  new IntersectionObserver(function (entries) {
    pastHero = !entries[0].isIntersecting;
    sync();
  }, { rootMargin: '-40% 0px 0px 0px' }).observe(hero);

  var closingCta = document.getElementById('cta');
  if (closingCta) {
    new IntersectionObserver(function (entries) {
      onClosingCta = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.15 }).observe(closingCta);
  }

  var closeBtn = bar.querySelector('.bp-float-cta-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      bar.classList.remove('is-visible');
      try { sessionStorage.setItem('bpFloatCtaDismissed', '1'); } catch (e) {}
    });
  }
})();
