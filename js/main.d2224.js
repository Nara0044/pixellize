/* ═══════════════════════════════════════════════════════════════
   NUDGEBEE — Main JavaScript
   Nav scroll, mobile menu, FAQ accordion, scroll reveal
   ═══════════════════════════════════════════════════════════════ */

/* ── Reduced-motion preference ── */
var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Hero entry animation ── */
(function () {
  var items = [
    { sel: '.hero-h1',      delay: 100 },
    { sel: '.hero-desc',    delay: 250 },
    { sel: '.hero-actions', delay: 400 },
    { sel: '.hero-trust',   delay: 550 }
  ];
  /* Elements start hidden via inline style in HTML.
     Animate them in after page load. */
  items.forEach(function (item) {
    var el = document.querySelector(item.sel);
    if (!el) return;
    setTimeout(function () {
      el.style.transition = 'opacity 0.7s cubic-bezier(.22,1,.36,1), transform 0.7s cubic-bezier(.22,1,.36,1)';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, item.delay);
  });
})();

/* ── Pause CSS animations when tab is hidden ── */
document.addEventListener('visibilitychange', function () {
  document.documentElement.classList.toggle('page-hidden', document.hidden);
});

/* ── Close mobile menu on any navigation ── */
window.addEventListener('pageshow', function () {
  var mob = document.getElementById('mobNav');
  if (mob) mob.classList.remove('open');
});

/* ── Beehive Grid — mouse flashlight effect (RAF-throttled) ── */
(function () {
  var hero = document.getElementById('hero');
  var active = hero && hero.querySelector('.beehive-grid--active');
  if (!hero || !active) return;

  var pending = false;
  var pendingX, pendingY;

  hero.addEventListener('mousemove', function (e) {
    pendingX = e.clientX;
    pendingY = e.clientY;
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      var rect = hero.getBoundingClientRect();
      active.style.setProperty('--mx', (pendingX - rect.left) + 'px');
      active.style.setProperty('--my', (pendingY - rect.top) + 'px');
      if (!active.classList.contains('visible')) active.classList.add('visible');
      pending = false;
    });
  });

  hero.addEventListener('mouseleave', function () {
    active.classList.remove('visible');
  });
})();

/* ── Nav solid on scroll ── */
const nav = document.getElementById('nav');
const onScroll = () => { if (nav) nav.classList.toggle('solid', window.scrollY > 8); };
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ── Mobile menu ── */
function toggleMenu() { document.getElementById('mobNav').classList.toggle('open'); }
document.querySelectorAll('.mob-menu a, #mobNav a').forEach(a =>
  a.addEventListener('click', () => document.getElementById('mobNav').classList.remove('open'))
);

/* ── FAQ accordion ── */
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.faq-q').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
      const el = document.getElementById(b.getAttribute('aria-controls'));
      if (el) el.classList.remove('open');
    });
    if (!isOpen) {
      btn.setAttribute('aria-expanded', 'true');
      const el = document.getElementById(btn.getAttribute('aria-controls'));
      if (el) el.classList.add('open');
    }
  });
});

/* ── Hero slideshow (SRE / FinOps / Cloud Ops / Workflow) ── */
(function () {
  var slides   = document.querySelectorAll('.hss-slide');
  var tabs     = document.querySelectorAll('.hss-tab');
  var fill     = document.getElementById('hssProgressFill');
  var total    = slides.length;
  var current  = 0;
  var DURATION = 4000;
  var startTime = null;
  var paused   = false;
  var rafId;

  if (!slides.length) return;

  function goTo(idx) {
    slides[current].classList.remove('active');
    tabs[current].classList.remove('active');
    tabs[current].setAttribute('aria-selected', 'false');
    current = idx % total;
    slides[current].classList.add('active');
    tabs[current].classList.add('active');
    tabs[current].setAttribute('aria-selected', 'true');
    startTime = null;
    if (fill) fill.style.width = '0%';
  }

  function tick(ts) {
    if (!paused) {
      if (!startTime) startTime = ts;
      var pct = Math.min(100, ((ts - startTime) / DURATION) * 100);
      if (fill) fill.style.width = pct + '%';
      if (ts - startTime >= DURATION) goTo((current + 1) % total);
    }
    rafId = requestAnimationFrame(tick);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () { goTo(parseInt(tab.dataset.slide, 10)); });
  });

  var wrap = document.querySelector('.hss-wrap');
  if (wrap) {
    wrap.addEventListener('mouseenter', function () { paused = true; });
    wrap.addEventListener('mouseleave', function () { paused = false; startTime = null; });
  }

  /* Pause RAF when tab is hidden, resume when visible */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!rafId) {
      startTime = null;
      rafId = requestAnimationFrame(tick);
    }
  });

  /* Cancel on page unload */
  window.addEventListener('pagehide', function () {
    cancelAnimationFrame(rafId);
    rafId = null;
  });

  if (!reducedMotion) {
    rafId = requestAnimationFrame(tick);
  }
})();

/* ── Hero card tab cycling ── */
(function () {
  const tabs = document.querySelectorAll('.hc-nav[data-tab]');
  const panels = document.querySelectorAll('.hc-panel[data-panel]');
  if (!tabs.length) return;

  let current = 0;
  const total = tabs.length;
  const INTERVAL = 3000;
  let timer;

  function activate(index) {
    tabs.forEach(t => {
      t.classList.remove('active');
      const dot = t.querySelector('.hc-nav-dot');
      if (dot) dot.style.opacity = '.3';
    });
    panels.forEach(p => p.classList.remove('active'));

    tabs[index].classList.add('active');
    const activeDot = tabs[index].querySelector('.hc-nav-dot');
    if (activeDot) activeDot.style.opacity = '1';
    const panelId = tabs[index].dataset.tab;
    const targetPanel = document.querySelector('.hc-panel[data-panel="' + panelId + '"]');
    if (targetPanel) targetPanel.classList.add('active');
    current = index;
  }

  function next() {
    activate((current + 1) % total);
  }

  function startCycle() {
    clearInterval(timer);
    if (!reducedMotion) timer = setInterval(next, INTERVAL);
  }

  function stopCycle() {
    clearInterval(timer);
    timer = null;
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => {
      activate(i);
      startCycle();
    });
  });

  const card = document.querySelector('.hero-card');
  if (card) {
    card.addEventListener('mouseenter', stopCycle);
    card.addEventListener('mouseleave', startCycle);
  }

  /* Pause when tab is hidden */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopCycle(); } else { startCycle(); }
  });

  window.addEventListener('pagehide', stopCycle);

  startCycle();
})();

/* ── Agents marquee — infinite loop for any screen size ── */
(function () {
  document.querySelectorAll('.agents-marquee').forEach(function (marquee) {
    var track = marquee.querySelector('.agents-track');
    if (!track) return;

    var origCards = Array.from(track.children);
    var gap = 16;

    function fill() {
      var setWidth = origCards.reduce(function (sum, c) {
        return sum + c.offsetWidth + gap;
      }, 0);

      var needed = Math.ceil((window.innerWidth * 3) / setWidth);
      if (needed < 2) needed = 2;

      var currentSets = Math.round(track.children.length / origCards.length);
      while (currentSets < needed) {
        origCards.forEach(function (card) {
          var clone = card.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          track.appendChild(clone);
        });
        currentSets++;
      }

      var offsetPx = -setWidth;
      track.style.setProperty('--marquee-offset', offsetPx + 'px');

      var speed = 40;
      var duration = setWidth / speed;
      track.style.setProperty('--marquee-duration', duration + 's');
    }

    fill();

    var resizeTimer;
    var resizeHandler = function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fill, 200);
    };
    window.addEventListener('resize', resizeHandler);

    window.addEventListener('pagehide', function () {
      window.removeEventListener('resize', resizeHandler);
    });
  });
})();

/* ── Assistant tabs (auto-slideshow, 8s loop) ── */
(function () {
  var tabs    = document.querySelectorAll('.assist-tab[data-assist]');
  var panels  = document.querySelectorAll('.assist-panel[data-assist-panel]');
  if (!tabs.length) return;

  var idx      = 0;
  var FADE_OUT = 350; /* ms to let outgoing panel fade before incoming appears */
  var DELAY    = 8000; /* ms between auto-advances */
  var busy     = false;
  var timer    = null;

  function activate(i) {
    if (busy) return;
    if (i === idx && panels[i] && panels[i].classList.contains('active')) return;

    busy = true;
    var outPanel = document.querySelector('.assist-panel.active');

    /* Fade out current panel */
    if (outPanel) {
      outPanel.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      outPanel.style.opacity    = '0';
      outPanel.style.transform  = 'translateY(-8px)';
    }

    /* Update tab highlights immediately */
    tabs.forEach(function (t) {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tabs[i].classList.add('active');
    tabs[i].setAttribute('aria-selected', 'true');

    setTimeout(function () {
      /* Remove active from all panels, then activate new one */
      panels.forEach(function (p) {
        p.classList.remove('active');
        p.style.transition = '';
        p.style.opacity    = '';
        p.style.transform  = '';
      });

      var key      = tabs[i].dataset.assist;
      var newPanel = document.querySelector('.assist-panel[data-assist-panel="' + key + '"]');
      if (newPanel) newPanel.classList.add('active');
      idx  = i;
      busy = false;
    }, FADE_OUT);
  }

  function next() {
    activate((idx + 1) % tabs.length);
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(next, DELAY);
  }

  /* Click handlers - restart timer on manual click */
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      activate(i);
      startTimer();
    });
  });

  /* Start auto-rotation */
  startTimer();
})();

/* ── Hero slideshow (2 slides, auto-cycle, looping) ── */
(function () {
  var wrap = document.getElementById('hsWrap');
  if (!wrap) return;

  /* Slide durations:
     slide 1 (assistants) = 5 s display + 0.6 s fade
     slide 2 (workflow)   = 6 s display (animations finish ~3.5 s in) + 0.6 s fade
     Total loop ≈ 12.2 s                                                          */
  var SLIDE_DURATION = 5000; /* ms each slide is fully visible */
  var FADE_DURATION  = 600;  /* ms — must match CSS .hs-slide transition */

  var slides = [
    document.getElementById('hsSlide1'),
    document.getElementById('hsSlide2')
  ];
  var tabs = [
    document.getElementById('hsTab1'),
    document.getElementById('hsTab2')
  ];

  if (!slides[0] || !slides[1]) return;

  /* On mobile/tablet — keep slide 1 fixed, no slideshow */
  if (window.innerWidth <= 1024) return;

  var current = 0;
  var timer   = null;

  function activateSlide(idx) {
    /* Fade out current */
    slides[current].classList.remove('hs-slide-active');
    tabs[current].classList.remove('hs-tab-active');
    tabs[current].setAttribute('aria-selected', 'false');

    current = idx % slides.length;

    /* After fade, make next slide active — CSS animations replay automatically */
    setTimeout(function () {
      slides[current].classList.add('hs-slide-active');
      tabs[current].classList.add('hs-tab-active');
      tabs[current].setAttribute('aria-selected', 'true');
    }, FADE_DURATION);
  }

  function getSliceDuration() {
    /* Workflow slide gets extra time for its animations to complete */
    return current === 1 ? 6000 : SLIDE_DURATION;
  }

  function schedule() {
    timer = setTimeout(function () {
      activateSlide(current + 1);
      schedule();
    }, getSliceDuration() + FADE_DURATION);
  }

  /* Tab nav buttons */
  tabs.forEach(function (btn, idx) {
    if (btn) btn.addEventListener('click', function () {
      if (idx === current) return;
      clearTimeout(timer); timer = null;
      activateSlide(idx);
      schedule();
    });
  });

  /* Pause on hover */
  wrap.addEventListener('mouseenter', function () { clearTimeout(timer); timer = null; });
  wrap.addEventListener('mouseleave', function () { if (!timer) schedule(); });

  /* Pause when tab hidden */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearTimeout(timer); timer = null;
    } else {
      if (!timer) schedule();
    }
  });

  window.addEventListener('pagehide', function () { clearTimeout(timer); });

  /* Init */
  if (!reducedMotion) {
    schedule();
  }
})();

/* ── Hero reveal — time-based, not gated on scroll/IntersectionObserver timing ── */
function revealHero() {
  document.querySelectorAll('[class$="-hero"] .reveal, [class$="-hero"] .reveal-left').forEach(el => {
    el.classList.add('visible');
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', revealHero);
} else {
  revealHero();
}

/* ── Scroll reveal (IntersectionObserver, CSS-only, no GSAP) — below-fold sections ── */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

/* Mark elements already visible on load, observe the rest */
requestAnimationFrame(() => {
  document.querySelectorAll('.reveal, .reveal-left').forEach(el => {
    if (el.classList.contains('visible')) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
      el.classList.add('visible');
    } else {
      io.observe(el);
    }
  });
});

/* ── Workflow cursor animation (JS-driven, pixel-accurate) ── */
(function () {
  var cursor    = document.getElementById('hsCursor');
  var addAction = document.getElementById('hsAddAction');
  var slide2    = document.getElementById('hsSlide2');
  var k8sRow    = document.querySelector('.hs-anp-row:nth-child(3)');
  var nodeAdded = document.querySelector('.hs-vn-added');
  var connAdded = document.querySelector('.hs-vconn-added');

  if (!cursor || !addAction || !slide2 || !k8sRow) return;

  var timers = [];
  var running = false;

  function after(ms, fn) {
    var t = setTimeout(fn, ms);
    timers.push(t);
  }

  function clearAll() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  var wrap = document.getElementById('hsWrap');

  function getCenter(el) {
    var r = el.getBoundingClientRect();
    var w = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0 };
    return { x: r.left + r.width / 2 - w.left, y: r.top + r.height / 2 - w.top };
  }

  function place(x, y) {
    cursor.style.left = (x - 10) + 'px';
    cursor.style.top  = (y - 10) + 'px';
  }

  function glide(x, y, dur) {
    cursor.style.transition = 'left ' + dur + 'ms cubic-bezier(.4,0,.2,1), top ' + dur + 'ms cubic-bezier(.4,0,.2,1), opacity 250ms';
    place(x, y);
  }

  function resetState() {
    cursor.style.transition = 'none';
    cursor.style.opacity = '0';
    /* Force remove visible class — node goes back to display:none */
    if (nodeAdded) { nodeAdded.classList.remove('hs-node-visible'); }
    if (connAdded) { connAdded.classList.remove('hs-node-visible'); }
    addAction.classList.remove('hs-add-active');
    k8sRow.classList.remove('hs-row-active');
  }

  /* Call once immediately on page load to guarantee hidden state */
  resetState();

  function runSequence() {
    clearAll();
    resetState();

    /* Measure real positions fresh each loop */
    var addPt = getCenter(addAction);
    var k8sPt = getCenter(k8sRow);

    /* t=0: place cursor below Add Action, hidden */
    place(addPt.x, addPt.y + 55);

    /* t=400: fade in + glide toward Add Action */
    after(400, function () {
      cursor.style.opacity = '1';
      glide(addPt.x, addPt.y, 500);
    });

    /* t=1100: cursor arrives — click Add Action (highlight) */
    after(1100, function () {
      addAction.classList.add('hs-add-active');
    });

    /* t=1400: release Add Action click */
    after(1400, function () {
      addAction.classList.remove('hs-add-active');
    });

    /* t=1700: glide to Kubernetes row in right panel */
    after(1700, function () {
      glide(k8sPt.x, k8sPt.y, 600);
    });

    /* t=2500: cursor arrives — click Kubernetes row */
    after(2500, function () {
      k8sRow.classList.add('hs-row-active');
    });

    /* t=2800: release + node appears on canvas */
    after(2800, function () {
      k8sRow.classList.remove('hs-row-active');
      if (connAdded) connAdded.classList.add('hs-node-visible');
      if (nodeAdded) nodeAdded.classList.add('hs-node-visible');
    });

    /* t=4000: fade cursor out */
    after(4000, function () {
      cursor.style.transition = 'opacity 400ms';
      cursor.style.opacity = '0';
    });

    /* t=4800: hide node, pause before next loop */
    after(4800, function () {
      if (nodeAdded) nodeAdded.classList.remove('hs-node-visible');
      if (connAdded) connAdded.classList.remove('hs-node-visible');
    });

    /* t=5800: restart */
    after(5800, function () {
      if (running) runSequence();
    });
  }

  function start() {
    if (reducedMotion || running) return;
    running = true;
    resetState(); /* ensure clean state before sequence */
    /* Wait 800ms for slide fade-in to complete before animating */
    after(800, function () {
      if (running) runSequence();
    });
  }

  function stop() {
    running = false;
    clearAll();
    resetState();
  }

  /* Watch slide 2 active state */
  new MutationObserver(function () {
    if (slide2.classList.contains('hs-slide-active')) { start(); }
    else { stop(); }
  }).observe(slide2, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); }
    else if (slide2.classList.contains('hs-slide-active')) { start(); }
  });

  window.addEventListener('pagehide', stop);
})();

/* ── Blog post TOC scroll-spy ──
   Highlights the section you're reading in the on-this-page TOC.
   No-ops on any page without a .bp-toc (catalog, home, etc.). */
(function () {
  var toc = document.querySelector('.bp-toc');
  if (!toc) return;
  var links = Array.prototype.slice.call(toc.querySelectorAll('.bp-toc-list a'));
  if (!links.length) return;

  var map = {};        // heading id -> TOC link
  var headings = [];   // heading elements, in document order
  links.forEach(function (a) {
    var id = (a.getAttribute('href') || '').replace(/^#/, '');
    if (!id) return;
    var el = document.getElementById(id);
    if (el) { map[id] = a; headings.push(el); }
  });
  if (!headings.length) return;

  var OFFSET = 130;    // a section goes active once its heading passes this line
  var current = null;

  function update() {
    var idx = 0;
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top - OFFSET <= 0) idx = i;
      else break;
    }
    if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight - 2) {
      idx = headings.length - 1;
    }
    var link = map[headings[idx].id];
    if (!link || link === current) return;
    if (current) current.classList.remove('active');
    link.classList.add('active');
    current = link;

    // keep the active item visible within the TOC's own scroll area
    var tr = toc.getBoundingClientRect();
    var lr = link.getBoundingClientRect();
    if (lr.top < tr.top) toc.scrollTop -= (tr.top - lr.top) + 8;
    else if (lr.bottom > tr.bottom) toc.scrollTop += (lr.bottom - tr.bottom) + 8;
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { update(); ticking = false; });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();

