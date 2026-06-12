// ── REAL-TIME WEBSOCKETS (PUSHER) ──

// IMPORTANT: Replace 'YOUR_APP_KEY' and 'YOUR_APP_CLUSTER' with your actual Pusher credentials
// matching the ones in backend/config.php
const PUSHER_KEY = '850e64cc0944f72172df';
const PUSHER_CLUSTER = 'ap2';

if (PUSHER_KEY !== 'YOUR_APP_KEY') {
    // Enable pusher logging for debugging (optional)
    Pusher.logToConsole = false;

    var pusher = new Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER
    });

    var channel = pusher.subscribe('eco-channel');
    channel.bind('new-report', function(data) {
        console.log('Real-time report received:', data);
        
        // Show a non-intrusive notification
        showToast('📍 New report added nearby!');
        
        // Ensure relative URLs are converted to absolute URLs for frontend viewing
        if (data.photo_urls && Array.isArray(data.photo_urls)) {
            data.photo_urls = data.photo_urls.map(path => {
                if (path.startsWith('http') || path.startsWith('data:')) return path;
                return API_BASE_URL + '/../' + path;
            });
        }
        
        // Check if optimistic report already exists (e.g. we just submitted it)
        const existingIdx = currentReports.findIndex(r => r.id === data.id);
        if (existingIdx !== -1) {
            // Replace the optimistic report with the real one from Pusher
            currentReports[existingIdx] = data;
        } else {
            // Add to global array
            currentReports.unshift(data);
        }
        
        // Update Map if active
        if (typeof mainMap !== 'undefined' && mapInit) {
            addMapMarker(data);
            const activeBtn = document.querySelector('.filter-pill.active');
            if (activeBtn) filterMap(currentMapFilter, activeBtn);
        }
        
        // Update UI depending on current page
        if (currentPage === 'feed') {
            renderFeed(currentReports);
        } else if (currentPage === 'admin' && typeof adminLoggedIn !== 'undefined' && adminLoggedIn) {
            renderAdminDashboard();
        }
        if (typeof updateHeroStats === 'function') updateHeroStats();
    });

    channel.bind('update-status', function(data) {
        console.log('Status update received:', data);
        
        // Show notification
        showToast('🔄 Report status updated!');
        
        // Update global array
        const report = currentReports.find(r => r.id === data.id);
        if (report) {
            report.status = data.status;
            
            // Update UI depending on current page
            if (currentPage === 'feed') {
                renderFeed(currentReports);
            } else if (currentPage === 'admin' && typeof adminLoggedIn !== 'undefined' && adminLoggedIn) {
                renderAdminDashboard();
            }
            if (typeof updateHeroStats === 'function') updateHeroStats();
            
            if (typeof mainMap !== 'undefined' && mapInit) {
                // Update marker popup content and icon
                const markerObj = allMarkers.find(m => m.report.id === report.id);
                if (markerObj) {
                    markerObj.marker.setIcon(makeIcon(report.cat, report.status));
                    markerObj.marker.setPopupContent(`<div style="font-family:Outfit,sans-serif;min-width:180px">
                        <div style="font-size:14px;font-weight:800;margin-bottom:4px">${(CAT_COLORS[report.cat]||CAT_COLORS.Other).emoji} ${report.id}</div>
                        <div style="font-size:12px;font-weight:700;color:${(CAT_COLORS[report.cat]||CAT_COLORS.Other).color}">${report.cat}</div>
                        <div style="font-size:12px;color:#6b7280;margin:4px 0">${report.loc}</div>
                        <div style="font-size:11px;color:#374151">${(report.desc||'').substring(0,80)}...</div>
                        <div style="margin-top:8px"><span style="padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;background:#dcfce7;color:#15803d">${report.status}</span></div>
                    </div>`);
                }
                const activeBtn = document.querySelector('.filter-pill.active');
                if (activeBtn) filterMap(currentMapFilter, activeBtn);
            }
        }
    });

    channel.bind('new-activity', function(data) {
        console.log('New activity received:', data);
        if (currentPage === 'admin' && typeof renderLiveActivityFeed === 'function') {
            renderLiveActivityFeed();
        }
    });

    channel.bind('update-priority', function(data) {
        console.log('Priority update received:', data);
        const report = currentReports.find(r => r.id === data.id);
        if (report) {
            report.priority = data.priority;
            if (currentPage === 'admin' && typeof adminLoggedIn !== 'undefined' && adminLoggedIn) {
                renderAdminDashboard();
            }
        }
    });

} else {
    console.warn("Pusher is not configured. Real-time updates are disabled.");
}
