// ── DATA CONFIGURATIONS ──
let currentReports = [];
let fetchReportsPromise = null;

const CAT_COLORS = {
  'Garbage':       {bg:'#fee2e2',color:'#dc2626',pin:'#ef4444',emoji:'🗑'},
  'Plastic Waste': {bg:'#ffedd5',color:'#c2410c',pin:'#f97316',emoji:'🧴'},
  'Dirty Area':    {bg:'#fef9c3',color:'#854d0e',pin:'#eab308',emoji:'🪣'},
  'Junkyard':      {bg:'#fef3c7',color:'#92400e',pin:'#d97706',emoji:'🔧'},
  'Water Pollution':{bg:'#dbeafe',color:'#1d4ed8',pin:'#3b82f6',emoji:'💧'},
  'Plantation Opportunity':{bg:'#dcfce7',color:'#15803d',pin:'#22c55e',emoji:'🌱'},
  'Other':         {bg:'#f3f4f6',color:'#4b5563',pin:'#9ca3af',emoji:'✦'},
};

const STATUS_CLASS = {
  'Reported':'status-reported','Verified':'status-verified',
  'Action Planned':'status-planned','In Progress':'status-inprogress','Resolved':'status-resolved'
};

// Hydrate from cache synchronously so first paint can use stale-while-revalidate data
try {
  const cached = localStorage.getItem('eco_warrior_reports_cache');
  if (cached) {
    currentReports = JSON.parse(cached);
  }
} catch (e) {
  console.error('Failed to parse cached reports', e);
}

function notifyReportsUpdated() {
  if (typeof updateHeroStats === 'function') updateHeroStats();
  if (typeof updateGlobeMarkers === 'function') updateGlobeMarkers(currentReports);

  if (typeof currentPage === 'undefined') return;

  if (currentPage === 'feed' && typeof renderFeed === 'function') {
    renderFeed(currentReports);
  }
  if (currentPage === 'map' && typeof refreshMapMarkers === 'function') {
    refreshMapMarkers();
  }
  if (currentPage === 'admin' && typeof adminLoggedIn !== 'undefined' && adminLoggedIn && typeof renderAdminDashboard === 'function') {
    const parts = window.location.hash.substring(1).split('/');
    const sub = (parts[0] === 'admin' && parts[1]) ? parts[1] : 'overview';
    renderAdminDashboard(sub);
  }
}

async function fetchReports(forceRefresh = false) {
  if (forceRefresh) fetchReportsPromise = null;
  if (fetchReportsPromise) return fetchReportsPromise;

  fetchReportsPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/api/get_reports.php`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      data.forEach(report => {
        if (report.photo_urls && Array.isArray(report.photo_urls)) {
          report.photo_urls = report.photo_urls.map(url => {
            return url.startsWith('http') ? url : `${API_URL}/${url}`;
          });
        }
      });

      currentReports = data;
      localStorage.setItem('eco_warrior_reports_cache', JSON.stringify(data));
      notifyReportsUpdated();
      return data;
    } catch (e) {
      console.error('Failed to fetch reports from backend', e);
      if (currentReports.length > 0) notifyReportsUpdated();
      return currentReports;
    }
  })();

  return fetchReportsPromise;
}

// Start network fetch as soon as this script loads (stale-while-revalidate)
fetchReports();
