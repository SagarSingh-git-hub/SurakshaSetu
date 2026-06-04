// ── DATA CONFIGURATIONS ──
let currentReports = []; // Dynamically fetched reports

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

async function fetchReports() {
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
        return data;
    } catch (e) {
        console.error("Failed to fetch reports from backend", e);
        return [];
    }
}
