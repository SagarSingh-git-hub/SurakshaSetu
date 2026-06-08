// ── MAIN APPLICATION CONTROLLER & ROUTER ──
let currentPage = '';
let mapInit = false, feedInit = false;
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
  return { page: 'home', subView: '' };
}

const route = getRouteFromHash();
initialPage = route.page;
initialAdminSubView = route.subView || 'overview';

if (!window.location.hash) {
  const params = new URLSearchParams(window.location.search);
  const pageParam = params.get('page');
  if (pageParam && validPages.includes(pageParam)) {
    initialPage = pageParam;
  } else {
    const lastPage = localStorage.getItem('eco_warrior_last_page');
    if (lastPage && validPages.includes(lastPage)) {
      initialPage = lastPage;
    }
  }
}

// Ensure the right page is active before paint if DOM is ready, or wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => showPage(initialPage, false));
} else {
  showPage(initialPage, false);
}

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
    if (pushHistory) {
      window.history.pushState({page: id, hash: targetHash}, '', newUrl);
    } else {
      window.history.replaceState({page: id, hash: targetHash}, '', newUrl);
    }
  }
  localStorage.setItem('eco_warrior_last_page', id);

  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  
  const targetPage = document.getElementById('page-'+id);
  if(targetPage) {
    targetPage.classList.add('active');
  }
  
  const tabMap = {home:0,map:1,feed:2,admin:3};
  const tabs = document.querySelectorAll('.nav-tab');
  if(tabMap[id]!==undefined && tabs.length > tabMap[id]) {
    tabs[tabMap[id]].classList.add('active');
  }
  
  updateNavIndicator();
  
  currentPage = id;
  
  if(id==='map') {
    if (!mapInit) {
      initMap();
      mapInit=true;
    } else {
      setTimeout(() => { if(typeof mainMap !== 'undefined') mainMap.invalidateSize(); }, 100);
    }
  }
  if(id==='feed') {
    if (!feedInit) {
      fetchReports().then(() => {
          if (typeof renderFeed === 'function') renderFeed(currentReports);
          if (typeof updateGlobeMarkers === 'function') {
            updateGlobeMarkers(currentReports);
          }
          feedInit=true;
      });
    } else {
      if (typeof renderFeed === 'function') renderFeed(currentReports);
    }
  }
  if(id==='home') {
    // Fire premium GSAP Hero animations instantly
    if (typeof animateHeroSection === 'function') {
      animateHeroSection();
    }
    if (typeof initAnimations === 'function') {
      setTimeout(initAnimations, 50);
    }
    // Resume/initialize globe
    if (typeof initGlobe === 'function') {
      if (typeof globeScene === 'undefined' || !globeScene) {
        initGlobe();
      } else {
        if (typeof triggerGlobeResize === 'function') triggerGlobeResize();
        if (typeof resumeGlobeAnimation === 'function') resumeGlobeAnimation();
      }
    }
  } else {
    // Navigate away from home: stop globe animation
    if (typeof stopGlobeAnimation === 'function') {
      stopGlobeAnimation();
    }
  }

  // Handle Three.js Login Scene performance optimization
  if (id === 'admin' && !adminLoggedIn) {
    if (typeof resumeLoginAnimation === 'function') resumeLoginAnimation();
  } else {
    if (typeof stopLoginAnimation === 'function') stopLoginAnimation();
  }

  if(id==='report') {
    initReportForm();
  }
  if(id==='admin') { 
    if(adminLoggedIn) {
      const loginWrap = document.getElementById('admin-login-wrap');
      const dashboard = document.getElementById('admin-dashboard');
      if(loginWrap) loginWrap.style.display='none';
      if(dashboard) dashboard.classList.add('active');
      
      const parts = window.location.hash.substring(1).split('/');
      const sub = (parts[0] === 'admin' && parts[1]) ? parts[1] : 'overview';
      renderAdminDashboard(sub);
    } else {
      if (typeof initLoginAnimations === 'function') initLoginAnimations();
    }
  }
  window.scrollTo(0,0);
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
        // Dispatch change event to trigger original onchange handler
        select.dispatchEvent(new Event('change'));
        
        // Update custom UI
        triggerText.textContent = option.text;
        optionsContainer.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
        optionDiv.classList.add('selected');
        wrapper.classList.remove('open');
      });
      optionsContainer.appendChild(optionDiv);
    });
    
    wrapper.appendChild(optionsContainer);
    
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
      if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  };
  
  document.getElementById('confirm-btn-yes').onclick = () => {
    close();
    if(onConfirm) onConfirm();
  };
  
  document.getElementById('confirm-btn-no').onclick = close;
}

// ── TOAST NOTIFICATIONS ──
function showToast(msg) {
  const t = document.getElementById('toast');
  if(t) {
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),2500);
  }
}

// ── PARSE INCOMING ROUTE ON INITIAL LOAD ──
window.addEventListener('DOMContentLoaded', async () => {
  // Fetch reports immediately to prime the cache
  fetchReports();

  // Wait a bit for font loading and initial layout before setting indicator
  setTimeout(updateNavIndicator, 100);
});

function animateHeroSection() {
  if (typeof gsap === 'undefined') return;
  
  // Set elements to zero/hidden states before animating to prevent flash of content
  gsap.set(['.hero-h1', '.hero-tagline', '.hero-cta', '.hero-stats', '#hero-globe-wrapper'], { 
    opacity: 0,
    y: 30
  });
  
  gsap.set('#hero-globe-wrapper', {
    x: 50,
    y: 0
  });

  // Run the premium animations
  gsap.to('.hero-h1', {
    y: 0,
    opacity: 1,
    duration: 0.8,
    ease: 'power3.out',
    delay: 0.1
  });
  gsap.to('.hero-tagline', {
    y: 0,
    opacity: 1,
    duration: 0.8,
    ease: 'power3.out',
    delay: 0.2
  });
  gsap.to('.hero-cta', {
    y: 0,
    opacity: 1,
    duration: 0.8,
    ease: 'power3.out',
    delay: 0.3
  });
  gsap.to('.hero-stats', {
    y: 0,
    opacity: 1,
    duration: 0.8,
    ease: 'power3.out',
    delay: 0.4
  });
  gsap.to('#hero-globe-wrapper', {
    x: 0,
    opacity: 1,
    duration: 1.0,
    ease: 'power3.out',
    delay: 0.3
  });
}

let animationsInitialized = false;
function initAnimations() {
  if (typeof ScrollReveal === 'undefined') return;
  if (!animationsInitialized) {
    window.sr = ScrollReveal({
      distance: '60px',
      duration: 1000,
      easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
      opacity: 0,
      scale: 0.95
    });
    
    // Hero section (Disabled ScrollReveal on hero elements to avoid SPA visibility bugs. Handled by GSAP.)
    // window.sr.reveal('.hero h1', { delay: 100, origin: 'bottom' });
    // window.sr.reveal('.hero > p', { delay: 200, origin: 'bottom' });
    // window.sr.reveal('.hero .hero-stats', { delay: 300, origin: 'bottom' });
    // window.sr.reveal('.hero .btn', { delay: 400, origin: 'bottom' });
    // window.sr.reveal('#globe-canvas', { delay: 500, origin: 'right', distance: '100px' });
    
    // Sections
    window.sr.reveal('section h2', { origin: 'left', viewFactor: 0.2 });
    window.sr.reveal('section > p', { delay: 100, origin: 'left', viewFactor: 0.2 });
    
    // Cards stagger
    window.sr.reveal('.step-card', { interval: 150, origin: 'bottom', viewFactor: 0.2 });
    window.sr.reveal('.cat-card', { interval: 100, origin: 'bottom', viewFactor: 0.2, scale: 0.9 });
    window.sr.reveal('.testimonial-card', { interval: 150, origin: 'bottom', viewFactor: 0.2 });
    
    animationsInitialized = true;
  } else if (window.sr) {
    window.sr.sync();
  }
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

