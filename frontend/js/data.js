// ── DATA CONFIGURATIONS ──
let currentReports = []; // Dynamically fetched reports
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

// Load cached reports from localStorage immediately on startup
try {
  const cached = localStorage.getItem('eco_warrior_reports_cache');
  if (cached) {
    currentReports = JSON.parse(cached);
  }
} catch (e) {
  console.error("Failed to parse cached reports", e);
}

async function fetchReports(forceRefresh = false) {
    // If we have cached reports and we haven't fetched yet, trigger UI updates with cached data first
    if (currentReports.length > 0 && !fetchReportsPromise) {
        setTimeout(() => {
            if (typeof updateHeroStats === 'function') updateHeroStats();
            if (typeof updateGlobeMarkers === 'function') updateGlobeMarkers(currentReports);
            
            const feedPage = document.getElementById('page-feed');
            if (typeof renderFeed === 'function' && feedPage && feedPage.classList.contains('active')) {
                renderFeed(currentReports);
            }
            
            const adminPage = document.getElementById('page-admin');
            if (typeof renderAdminDashboard === 'function' && adminPage && adminPage.classList.contains('active') && typeof adminLoggedIn !== 'undefined' && adminLoggedIn) {
                const parts = window.location.hash.substring(1).split('/');
                const sub = (parts[0] === 'admin' && parts[1]) ? parts[1] : 'overview';
                renderAdminDashboard(sub);
            }
        }, 10);
    }

    if (fetchReportsPromise && !forceRefresh) {
        return fetchReportsPromise;
    }

    fetchReportsPromise = (async () => {
        try {
            const response = await fetch(`${API_URL}/api/get_reports.php`);
            const data = await response.json();
            
            // Fix relative image paths to use the backend API URL
            data.forEach(report => {
                if (report.photo_urls && Array.isArray(report.photo_urls)) {
                    report.photo_urls = report.photo_urls.map(url => {
                        return url.startsWith('http') ? url : `${API_URL}/${url}`;
                    });
                }
            });

            currentReports = data;
            
            // Cache the reports
            localStorage.setItem('eco_warrior_reports_cache', JSON.stringify(data));
            
            // Update UI components if they exist
            if (typeof updateHeroStats === 'function') updateHeroStats();
            if (typeof updateGlobeMarkers === 'function') updateGlobeMarkers(currentReports);
            if (typeof renderFeed === 'function') {
                renderFeed(currentReports);
            }
            if (typeof renderAdminDashboard === 'function' && typeof adminLoggedIn !== 'undefined' && adminLoggedIn) {
                const adminPage = document.getElementById('page-admin');
                if (adminPage && adminPage.classList.contains('active')) {
                    const parts = window.location.hash.substring(1).split('/');
                    const sub = (parts[0] === 'admin' && parts[1]) ? parts[1] : 'overview';
                    renderAdminDashboard(sub);
                }
            }
            
            return data;
        } catch (e) {
            console.error("Failed to fetch reports from backend", e);
            return currentReports;
        }
    })();
    
    return fetchReportsPromise;
}
