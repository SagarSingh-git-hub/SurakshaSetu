// ── MAIN APPLICATION CONTROLLER & ROUTER ──
let currentPage = '';
let mapInit = false;
let adminLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
let currentAdminPassword = sessionStorage.getItem('adminPassword') || '';
let pageHistory = [];

// Determine initial page and sub-view synchronously
const validPages = ['home', 'map', 'feed', 'admin', 'report'];
let initialPage = 'home';
let initialAdminSubView = 'overview';

function getRouteFromHash() {
  const hash = window.location.hash.substring(1);
  if (!hash) return { page: 'home', subView: '' };

  const parts = hash.split('/');
  const page = parts[0];
  const subView = parts[1] || '';

  if (validPages.includes(page)) {
    return { page, subView };
  }

  // Cross-page redirect for organisation routes
  const orgPages = ['about', 'impact', 'privacy', 'contact', 'ngo-partnership', 'volunteer-program'];
  if (orgPages.includes(page)) {
    window.location.href = 'organisation.html#' + page;
    return { page: 'home', subView: '' };
  }

  return { page: 'home', subView: '' };
}

function resolveInitialPage() {
  if (window.location.hash) {
    const route = getRouteFromHash();
    initialAdminSubView = route.subView || 'overview';
    return route.page;
  }
  const pageParam = new URLSearchParams(window.location.search).get('page');
  if (pageParam && validPages.includes(pageParam)) return pageParam;
  return 'home';
}

initialPage = resolveInitialPage();

function ensureThemeColor() {
  const hex = '#dcfce7';
  let metaThemes = document.querySelectorAll('meta[name="theme-color"]');
  if (metaThemes.length === 0) {
    let metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    metaTheme.content = hex;
    document.head.appendChild(metaTheme);
  } else {
    metaThemes.forEach(meta => meta.setAttribute('content', hex));
  }

  let msTile = document.querySelector('meta[name="msapplication-TileColor"]');
  if (msTile) msTile.setAttribute('content', hex);

  let msNav = document.querySelector('meta[name="msapplication-navbutton-color"]');
  if (msNav) msNav.setAttribute('content', hex);
}

function bootstrapApp() {
  localStorage.removeItem('eco_warrior_last_page');
  ensureThemeColor();
  showPage(initialPage, false);
}

// bootstrapApp initialization moved to bottom of file

function showPage(id, pushHistory = true) {
  // Push the previous page onto the history stack
  if (pushHistory && currentPage !== id && currentPage !== '') {
    pageHistory.push(currentPage);
  }

  // Get current subview if routing within admin
  let routeHash = id;
  if (id === 'admin') {
    const currentHash = window.location.hash.substring(1);
    const parts = currentHash.split('/');
    const subView = (parts[0] === 'admin' && parts[1]) ? parts[1] : (initialAdminSubView || 'overview');
    routeHash = `admin/${subView}`;
  }

  // Persist the route state with query parameters preserved
  const queryParams = window.location.search;
  const targetHash = '#' + routeHash;

  if (window.location.hash !== targetHash) {
    const newUrl = window.location.pathname + queryParams + targetHash;
    try {
      if (pushHistory) {
        window.history.pushState({ page: id, hash: targetHash }, '', newUrl);
      } else {
        window.history.replaceState({ page: id, hash: targetHash }, '', newUrl);
      }
    } catch (e) {
      console.warn('History API not supported on file:// protocol, skipping state update.');
    }
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  const targetPage = document.getElementById('page-' + id);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  const tabMap = { home: 0, map: 1, feed: 2, admin: 3 };
  const tabs = document.querySelectorAll('.nav-tab');
  if (tabMap[id] !== undefined && tabs.length > tabMap[id]) {
    tabs[tabMap[id]].classList.add('active');
  }

  updateNavIndicator();

  currentPage = id;
  window.scrollTo(0, 0);

  if (id === 'map') {
    if (!mapInit) {
      initMap();
      mapInit = true;
    } else {
      requestAnimationFrame(() => {
        if (typeof mainMap !== 'undefined') mainMap.invalidateSize();
        if (typeof refreshMapMarkers === 'function') refreshMapMarkers();
      });
    }
  }
  if (id === 'feed') {
    if (typeof renderFeed === 'function') renderFeed(currentReports);
    fetchReports().then(() => {
      if (typeof renderFeed === 'function') renderFeed(currentReports);
    });
  }
  if (id === 'home') {
    mountHomePage();
  } else {
    // Navigate away from home: stop globe animation
    if (typeof stopGlobeAnimation === 'function') {
      stopGlobeAnimation();
    }
  }

  if (id === 'report') {
    initReportForm();
  }
  if (id === 'admin') {
    if (adminLoggedIn) {
      if (typeof stopLoginAnimation === 'function') stopLoginAnimation();
      const loginWrap = document.getElementById('admin-login-wrap');
      const dashboard = document.getElementById('admin-dashboard');
      if (loginWrap) loginWrap.style.display = 'none';
      if (dashboard) dashboard.classList.add('active');

      const parts = window.location.hash.substring(1).split('/');
      const sub = (parts[0] === 'admin' && parts[1]) ? parts[1] : 'overview';
      renderAdminDashboard(sub);
    } else {
      mountAdminLogin();
    }
  } else {
    if (typeof stopLoginAnimation === 'function') stopLoginAnimation();
  }
  window.scrollTo(0, 0);
}

function updateNavIndicator() {
  const activeTab = document.querySelector('.nav-tab.active');
  const indicator = document.getElementById('nav-indicator');
  if (activeTab && indicator) {
    indicator.style.width = activeTab.offsetWidth + 'px';
    indicator.style.left = activeTab.offsetLeft + 'px';
  }
}

// Navigates to the previous page in history
function goBack() {
  if (pageHistory.length > 0) {
    const prev = pageHistory.pop();
    showPage(prev, false);
  } else {
    showPage('home');
  }
}

// ── CUSTOM SELECT INITIALIZATION ──
function initCustomSelects() {
  const selects = document.querySelectorAll('select.filter-select, select.status-select');
  selects.forEach(select => {
    // Check if already initialized
    if (select.nextElementSibling && select.nextElementSibling.classList.contains('custom-select-wrapper')) {
      return;
    }

    select.classList.add('custom-select-hidden');

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    if (select.classList.contains('w-full')) {
      wrapper.classList.add('w-full');
    }

    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';

    const selectedOption = select.options[select.selectedIndex];
    const triggerText = document.createElement('span');
    triggerText.textContent = selectedOption ? selectedOption.text : 'Select...';

    const arrow = document.createElement('div');
    arrow.className = 'custom-select-arrow';
    arrow.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

    trigger.appendChild(triggerText);
    trigger.appendChild(arrow);
    wrapper.appendChild(trigger);

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options';

    Array.from(select.options).forEach((option, index) => {
      const optionDiv = document.createElement('div');
      optionDiv.className = 'custom-select-option';
      if (option.selected) optionDiv.classList.add('selected');
      optionDiv.textContent = option.text;

      optionDiv.addEventListener('click', () => {
        // Update native select
        select.selectedIndex = index;
        // Dispatch events to trigger original handlers
        select.dispatchEvent(new Event('change'));
        select.dispatchEvent(new Event('input'));

        // Update custom UI
        triggerText.textContent = option.text;
        optionsContainer.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
        optionDiv.classList.add('selected');
        wrapper.classList.remove('open');
      });
      optionsContainer.appendChild(optionDiv);
    });

    wrapper.appendChild(optionsContainer);

    // Listen to programmatic updates on the select
    const syncUI = () => {
      const selectedOpt = select.options[select.selectedIndex];
      triggerText.textContent = selectedOpt ? selectedOpt.text : 'Select...';
      optionsContainer.querySelectorAll('.custom-select-option').forEach((el, idx) => {
        if (idx === select.selectedIndex) {
          el.classList.add('selected');
        } else {
          el.classList.remove('selected');
        }
      });
    };
    if (select.customSyncUI) {
      select.removeEventListener('change', select.customSyncUI);
      select.removeEventListener('input', select.customSyncUI);
    }
    select.customSyncUI = syncUI;
    select.addEventListener('change', syncUI);
    select.addEventListener('input', syncUI);

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.custom-select-wrapper').forEach(w => {
        if (w !== wrapper) w.classList.remove('open');
      });
      wrapper.classList.toggle('open');
    });

    select.parentNode.insertBefore(wrapper, select.nextSibling);
  });
}

function refreshCustomSelect(select) {
  if (typeof select === 'string') {
    select = document.getElementById(select);
  }
  if (!select) return;

  const wrapper = select.nextElementSibling;
  if (wrapper && wrapper.classList.contains('custom-select-wrapper')) {
    wrapper.remove();
  }
  select.classList.remove('custom-select-hidden');
  initCustomSelects();
}

// Close custom selects on click outside
document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
});

// ── CONFIRM MODAL ──
function showConfirmModal(title, text, confirmText, cancelText, onConfirm) {
  let overlay = document.getElementById('confirm-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'confirm-overlay';
    overlay.className = 'confirm-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="confirm-modal">
      <div class="confirm-icon-wrap">⚠️</div>
      <div class="confirm-title">${title}</div>
      <div class="confirm-text">${text}</div>
      <button class="confirm-btn-primary" id="confirm-btn-yes">${confirmText}</button>
      <button class="confirm-btn-secondary" id="confirm-btn-no">${cancelText}</button>
    </div>
  `;

  // Show
  requestAnimationFrame(() => overlay.classList.add('open'));

  // Handlers
  const close = () => {
    overlay.classList.remove('open');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  };

  document.getElementById('confirm-btn-yes').onclick = () => {
    close();
    if (onConfirm) onConfirm();
  };

  document.getElementById('confirm-btn-no').onclick = close;
}

// ── TOAST NOTIFICATIONS ──
function showToast(msg) {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(updateNavIndicator, 100);
});

function resetAdminLoginUI() {
  const targets = ['#login-form-card', '#login-badge-1', '#login-badge-2', '#login-3d-canvas'];
  if (typeof gsap !== 'undefined') gsap.killTweensOf(targets);

  const loginWrap = document.getElementById('admin-login-wrap');
  if (loginWrap) loginWrap.style.display = '';

  const dashboard = document.getElementById('admin-dashboard');
  if (dashboard) dashboard.classList.remove('active');

  targets.forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.style.removeProperty('opacity');
    el.style.removeProperty('transform');
    el.style.removeProperty('visibility');
  });
}

function mountAdminLogin() {
  resetAdminLoginUI();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (typeof initLogin3DScene === 'function') initLogin3DScene();
      if (typeof initLoginAnimations === 'function') initLoginAnimations();

      const bootLoginScene = (attempts = 0) => {
        const sized = typeof triggerLoginResize === 'function' ? triggerLoginResize() : true;
        if (typeof resumeLoginAnimation === 'function') resumeLoginAnimation();
        if (!sized && attempts < 10) setTimeout(() => bootLoginScene(attempts + 1), 50);
      };
      bootLoginScene();
    });
  });
}

let homeVisitCount = 0;

const HOME_SR_TARGETS = [
  '#page-home section > p',
  '#page-home .step-card',
  '#page-home .cat-card',
  '#page-home .testimonial-card'
];

const HOME_VISIBILITY_SELECTORS = [
  '.hero-h1', '.hero-tagline', '.hero-cta', '.hero-stats', '#hero-globe-wrapper',
  '.step-card', '.cat-card', '.testimonial-card', 'section > p', '.reveal-line', '.reveal-heading'
];

function resetHomeVisibility() {
  const home = document.getElementById('page-home');
  if (!home) return;

  if (window.sr) {
    HOME_SR_TARGETS.forEach(sel => window.sr.clean(sel));
  }

  HOME_VISIBILITY_SELECTORS.forEach(sel => {
    home.querySelectorAll(sel).forEach(el => {
      if (typeof gsap !== 'undefined') gsap.killTweensOf(el);
      el.style.removeProperty('opacity');
      el.style.removeProperty('transform');
      el.style.removeProperty('visibility');
    });
  });

}

function bootGlobe(attempts = 0) {
  const sized = typeof triggerGlobeResize === 'function' ? triggerGlobeResize() : true;
  if (typeof resumeGlobeAnimation === 'function') resumeGlobeAnimation();
  if (!sized && attempts < 8) setTimeout(() => bootGlobe(attempts + 1), 50);
}

function mountHomePage() {
  const isRevisit = homeVisitCount > 0;
  homeVisitCount++;

  resetHomeVisibility();

  // Reveal headings on scroll with IntersectionObserver
  const headings = document.querySelectorAll('#page-home .reveal-heading');
  headings.forEach(el => {
    el.classList.remove('is-visible');
    el.style.transitionDelay = '0s';
    el.style.animationDelay = '0s';
  });

  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, observer) => {
    let delay = 0;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (delay > 0) {
          entry.target.style.transitionDelay = `${delay}s`;
          entry.target.style.animationDelay = `${delay}s`;
        }
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
        delay += 0.2;
      }
    });
  }, observerOptions);

  headings.forEach(heading => {
    observer.observe(heading);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        if (typeof initGlobe === 'function') {
          try {
            if (typeof globeScene === 'undefined' || !globeScene) {
              initGlobe();
            } else {
              bootGlobe();
            }
          } catch (globeErr) {
            console.error('Failed to initialize globe:', globeErr);
          }
        }

        if (typeof updateHeroStats === 'function') {
          try {
            updateHeroStats();
          } catch (statsErr) {
            console.error('Failed to update stats initially:', statsErr);
          }
        }

        try {
          fetchReports().then(() => {
            try {
              if (typeof updateHeroStats === 'function') updateHeroStats();
              if (typeof updateGlobeMarkers === 'function') updateGlobeMarkers(currentReports);
            } catch (postFetchErr) {
              console.error('Failed to update stats/markers post fetch:', postFetchErr);
            }
          }).catch(err => {
            console.error('Failed in fetchReports promise:', err);
          });
        } catch (fetchErr) {
          console.error('Failed to trigger fetchReports:', fetchErr);
        }

        animateHeroSection(isRevisit);
        initHomeScrollReveal(isRevisit);
      } catch (err) {
        console.error('General error in mountHomePage requestAnimationFrame:', err);
      }
    });
  });
}

function animateHeroSection(isRevisit = false) {
  try {
    const targets = ['.hero-h1', '.hero-tagline', '.hero-cta', '.hero-stats', '#hero-globe-wrapper'];

    if (typeof gsap === 'undefined') {
      document.querySelectorAll(targets.join(',')).forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      document.querySelectorAll('.reveal-line').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    gsap.killTweensOf(targets);
    gsap.killTweensOf('.reveal-line');

    if (isRevisit) {
      gsap.set(targets, { opacity: 1, y: 0, x: 0 });
      gsap.set('.reveal-line', { opacity: 1, y: 0 });
      return;
    }

    // Set initial states (matches CSS initial states, ensuring clean reset)
    gsap.set('.hero-h1', { opacity: 1 });
    gsap.set('.reveal-line', { y: '120%', opacity: 0 });
    gsap.set(['.hero-tagline', '.hero-cta', '.hero-stats'], { opacity: 0, y: 30 });
    gsap.set('#hero-globe-wrapper', { x: 50, opacity: 0 });

    // Premium text reveal animation
    gsap.to('.reveal-line', { y: '0%', opacity: 1, duration: 1.0, stagger: 0.15, ease: 'power4.out', delay: 0.1 });

    gsap.to('.hero-tagline', { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.6 });
    gsap.to('.hero-cta', { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.7 });
    gsap.to('.hero-stats', { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.8 });
    gsap.to('#hero-globe-wrapper', { x: 0, opacity: 1, duration: 1.2, ease: 'power3.out', delay: 0.5 });
  } catch (err) {
    console.error('Exception in animateHeroSection: ' + err.message);
  }
}

function initHomeScrollReveal(isRevisit = false) {
  if (typeof ScrollReveal === 'undefined') return;

  if (isRevisit) return;

  if (!window.sr) {
    window.sr = ScrollReveal({
      distance: '40px',
      duration: 800,
      easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
      opacity: 0,
      scale: 0.98,
      viewFactor: 0.15,
      mobile: true
    });
  }

  window.sr.reveal('#page-home section > p', { delay: 80, origin: 'left' });
  window.sr.reveal('#page-home .step-card', { interval: 120, origin: 'bottom' });
  window.sr.reveal('#page-home .cat-card', { interval: 80, origin: 'bottom', scale: 0.95 });
  window.sr.reveal('#page-home .testimonial-card', { interval: 120, origin: 'bottom' });
  requestAnimationFrame(() => window.sr.sync());
}
window.addEventListener('resize', updateNavIndicator);

// Listen for browser Back/Forward navigation
window.addEventListener('popstate', (e) => {
  const route = getRouteFromHash();
  showPage(route.page, false);
});

function updateHeroStats() {
  if (typeof currentReports === 'undefined') return;
  const total = currentReports.length;
  const resolved = currentReports.filter(r => r.status === 'Resolved').length;
  const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  const statTotal = document.getElementById('stat-total');
  const statResolved = document.getElementById('stat-resolved');
  const statRate = document.getElementById('stat-rate');
  const impactTotal = document.getElementById('impact-total');
  const impactResolved = document.getElementById('impact-resolved');

  if (statTotal) statTotal.textContent = total;
  if (statResolved) statResolved.textContent = resolved;
  if (statRate) statRate.textContent = rate + '%';
  if (impactTotal) impactTotal.textContent = total;
  if (impactResolved) impactResolved.textContent = resolved;

  updateCategoryCounts();
}

function updateCategoryCounts() {
  if (typeof currentReports === 'undefined') return;

  const counts = {
    'Garbage': 0, 'Plastic Waste': 0, 'Dirty Area': 0,
    'Junkyard': 0, 'Water Pollution': 0, 'Plantation Opportunity': 0, 'Other': 0
  };

  currentReports.forEach(r => {
    if (counts[r.cat] !== undefined) counts[r.cat]++;
    else counts['Other']++;
  });

  const cards = document.querySelectorAll('.cat-card');
  cards.forEach(card => {
    const titleEl = card.querySelector('div:nth-child(2)');
    const countEl = card.querySelector('div:nth-child(3)');
    if (!titleEl || !countEl) return;

    const title = titleEl.textContent.trim();
    if (title === 'Garbage') {
      countEl.innerHTML = `<span id="cat-count-Garbage">${counts['Garbage']}</span> reports • Most common`;
    } else if (title === 'Plastic Waste') {
      countEl.innerHTML = `<span id="cat-count-Plastic-Waste">${counts['Plastic Waste']}</span> reports`;
    } else if (title === 'Dirty Area') {
      countEl.innerHTML = `<span id="cat-count-Dirty-Area">${counts['Dirty Area']}</span> reports`;
    } else if (title === 'Junkyard') {
      countEl.innerHTML = `<span id="cat-count-Junkyard">${counts['Junkyard']}</span> reports`;
    } else if (title === 'Water Pollution') {
      countEl.innerHTML = `<span id="cat-count-Water-Pollution">${counts['Water Pollution']}</span> reports`;
    } else if (title === 'Plantation Opp.') {
      countEl.innerHTML = `<span id="cat-count-Plantation-Opportunity">${counts['Plantation Opportunity']}</span> reports`;
    } else if (title === 'Other Issues') {
      countEl.innerHTML = `<span id="cat-count-Other">${counts['Other']}</span> reports`;
    }
  });
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}

function handleNewsletterSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('newsletter-btn');
  const emailInput = document.getElementById('newsletter-email');
  const successMsg = document.getElementById('newsletter-success');

  if (!emailInput || !emailInput.value) return;

  const originalContent = btn.innerHTML;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Subscribing...`;
  btn.disabled = true;
  emailInput.disabled = true;

  // Simulate API call
  setTimeout(() => {
    btn.innerHTML = originalContent;
    btn.disabled = false;
    emailInput.disabled = false;
    emailInput.value = '';
    
    if (successMsg) {
      successMsg.classList.remove('hidden');
      setTimeout(() => {
        successMsg.classList.add('hidden');
      }, 5000);
    }
  }, 1200);
}
